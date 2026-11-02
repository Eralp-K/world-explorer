import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readRegionChunk, safeFile } from './region.mjs';
import { chunkRoot, json, sectionsOf, sectionStates, decodeChunk } from './nbt.mjs';
import { intersectsArea, intersectsChunk } from './render-scope.mjs';

const { world, database, rebuild } = workerData;
const db = new DatabaseSync(database); db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=10000;');
db.exec(`CREATE TABLE IF NOT EXISTS chunks (key TEXT PRIMARY KEY, signature TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS regions (path TEXT PRIMARY KEY, stamp TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS objects (dim TEXT,kind TEXT,id TEXT,x REAL,y REAL,z REAL,chunk_key TEXT,payload TEXT);
CREATE INDEX IF NOT EXISTS object_position ON objects(dim,x,y,z);
CREATE INDEX IF NOT EXISTS object_id ON objects(id);
CREATE INDEX IF NOT EXISTS object_chunk ON objects(chunk_key);
CREATE TABLE IF NOT EXISTS blocks (dim TEXT,name TEXT,x INTEGER,y INTEGER,z INTEGER,count INTEGER,chunk_key TEXT);
CREATE INDEX IF NOT EXISTS block_name ON blocks(dim,name);
CREATE INDEX IF NOT EXISTS block_chunk ON blocks(chunk_key);`);
if (rebuild) db.exec('DELETE FROM chunks; DELETE FROM regions; DELETE FROM objects; DELETE FROM blocks;');
const existing = db.prepare('SELECT signature FROM chunks WHERE key=?');
const putChunk = db.prepare('INSERT OR REPLACE INTO chunks VALUES (?,?)');
const putObject = db.prepare('INSERT INTO objects VALUES (?,?,?,?,?,?,?,?)');
const putBlock = db.prepare('INSERT INTO blocks VALUES (?,?,?,?,?,?,?)');
const delObject = db.prepare('DELETE FROM objects WHERE chunk_key=?'), delBlock = db.prepare('DELETE FROM blocks WHERE chunk_key=?');
const allFiles = [], errors = []; let total = 0, done = 0, changed = 0,skipped=0;
function report(extra = {}) { parentPort.postMessage({ phase: 'indexing', done, total, changed, skipped,errors: errors.slice(-8), ...extra }); }
function indexNBT(dim, kind, key, nbt, cx, cz) {
  const c = chunkRoot(nbt);
  if (kind === 'region') {
    for (const be of c.block_entities || c.TileEntities || []) {
      putObject.run(dim, 'block', be.id || 'unknown', Number(be.x), Number(be.y), Number(be.z), key, json(be));
    }
    for (const e of c.Entities || []) insertEntity(dim, key, e);
    for (const s of sectionsOf(nbt)) {
      const states = sectionStates(s); if (!states?.palette?.length) continue;
      // Index section palettes only. Exact coordinates are resolved lazily for search
      // results, avoiding billions of bit-unpacks during a large world's first scan.
      for (let j = 0; j < states.palette.length; j++) {
        const name = states.palette[j].Name;
        if (['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'].includes(name)) continue;
        putBlock.run(dim, name, cx * 16, Number(s.Y) * 16, cz * 16, states.palette.length === 1 ? 4096 : -1, key);
      }
    }
  } else if (kind === 'entities') for (const e of c.Entities || c.entities || []) insertEntity(dim, key, e);
  else if (kind === 'poi') {
    for (const section of Object.values(c.Sections || c.sections || {})) for (const record of section.Records || section.records || []) {
      const p = record.pos || []; if (p.length === 3) putObject.run(dim, 'poi', record.type || 'poi', ...p.map(Number), key, json(record));
    }
  }
}
function insertEntity(dim, key, e) {
  const p = e.Pos || e.pos || [0, 0, 0];
  putObject.run(dim, 'entity', e.id || 'unknown', Number(p[0]), Number(p[1]), Number(p[2]), key, json(e));
  for (const passenger of e.Passengers || []) insertEntity(dim, key, passenger);
}
try {
  for (const dim of world.dimensions) for (const kind of ['region', 'entities', 'poi']) {
    const dir = path.join(dim.path, kind); let entries; try { entries = await fs.readdir(dir); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    for (const name of entries) {
      const match = /^r\.(-?\d+)\.(-?\d+)\.mca$/.exec(name); if (!match) continue;
      if(!intersectsArea(world.scope,dim.id,+match[1]*512,+match[2]*512,(+match[1]+1)*512,(+match[2]+1)*512))continue;
      const file = await safeFile(world.path, path.join(dir, name)), stat = await fs.stat(file);
      if (stat.size === 0) continue; // Minecraft leaves empty entity/POI region placeholders.
      if (stat.size < 8192) { errors.push(name + ': truncated region header'); continue; }
      const handle = await fs.open(file, 'r'); const header = Buffer.alloc(8192);
      try { const r = await handle.read(header, 0, 8192, 0); if (r.bytesRead !== 8192) throw Error('Truncated region header'); } finally { await handle.close(); }
      const slots = []; for (let i = 0; i < 1024; i++) if (header.readUInt32BE(i * 4) >>> 8) {
        if(intersectsChunk(world.scope,dim.id,+match[1]*32+i%32,+match[2]*32+Math.floor(i/32)))slots.push(i);else skipped++;
      }
      total += slots.length; allFiles.push({ dim: dim.id, kind, file, slots, header, rx: +match[1], rz: +match[2], stamp: stat.mtimeMs + ':' + stat.size });
    }
  }
  report();
  const fileSet = new Set(allFiles.map(f => f.file));
  for (const old of db.prepare('SELECT path FROM regions').all()) if (!fileSet.has(old.path)) {
    const prefix = old.path + '#';
    for (const row of db.prepare('SELECT key FROM chunks WHERE substr(key,1,?)=?').all(prefix.length, prefix)) { delObject.run(row.key); delBlock.run(row.key); db.prepare('DELETE FROM chunks WHERE key=?').run(row.key); }
    db.prepare('DELETE FROM regions WHERE path=?').run(old.path);
  }
  for (const f of allFiles) {
    const previous = db.prepare('SELECT stamp FROM regions WHERE path=?').get(f.file);
    if (previous?.stamp === f.stamp) { done += f.slots.length; report(); continue; }
    const activeKeys = new Set();
    const regionBytes = await fs.readFile(f.file);
    db.exec('BEGIN IMMEDIATE'); let batch = 0;
    for (const slot of f.slots) {
      const key = f.file + '#' + slot; activeKeys.add(key);
      try {
        // Hash compressed bytes when a region changes: timestamps alone can miss rapid edits.
        const loc = f.header.readUInt32BE(slot * 4), sector = loc >>> 8, length = (loc & 255) * 4096;
        const raw = regionBytes.subarray(sector * 4096, sector * 4096 + length);
        if (raw.length < 5) throw Error('Truncated chunk sector');
        let signature = createHash('sha256').update(raw).digest('hex');
        // External chunk payload lives in c.x.z.mcc, not in the .mca sector.
        if (raw[4] & 128) { const ext = await safeFile(world.path, path.join(path.dirname(f.file), `c.${f.rx * 32 + slot % 32}.${f.rz * 32 + Math.floor(slot / 32)}.mcc`)); signature += createHash('sha256').update(await fs.readFile(ext)).digest('hex'); }
        if (existing.get(key)?.signature !== signature) {
          const chunkLength = raw.readUInt32BE(0);
          if (chunkLength < 1 || chunkLength > raw.length - 4) throw Error('Invalid chunk sector length');
          const nbt = raw[4] & 128 ? await readRegionChunk(f.file, slot, world.path) : decodeChunk(raw.subarray(5, 4 + chunkLength), raw[4], { skipLongArrays: true });
          db.exec('SAVEPOINT current_chunk');
          try { delObject.run(key); delBlock.run(key); if (nbt) indexNBT(f.dim, f.kind, key, nbt, f.rx * 32 + slot % 32, f.rz * 32 + Math.floor(slot / 32)); putChunk.run(key, signature); db.exec('RELEASE current_chunk'); changed++; }
          catch (e) { db.exec('ROLLBACK TO current_chunk; RELEASE current_chunk'); throw e; }
        }
      } catch (e) { errors.push(path.basename(f.file) + '#' + slot + ': ' + e.message); }
      done++; if (done % 30 === 0) report();
      if (++batch % 128 === 0) db.exec('COMMIT; BEGIN IMMEDIATE');
    }
    db.exec('COMMIT');
    const prefix = f.file + '#';
    for (const row of db.prepare('SELECT key FROM chunks WHERE substr(key,1,?)=?').all(prefix.length, prefix)) if (!activeKeys.has(row.key)) { delObject.run(row.key); delBlock.run(row.key); db.prepare('DELETE FROM chunks WHERE key=?').run(row.key); }
    // Do not mark errored regions clean: retry them on the next update.
    if (!errors.some(e => e.startsWith(path.basename(f.file) + '#'))) db.prepare('INSERT OR REPLACE INTO regions VALUES (?,?)').run(f.file, f.stamp);
    report();
  }
  db.exec('PRAGMA optimize;');
  report({ phase: errors.length ? 'ready-with-warnings' : 'ready', errorCount: errors.length,
    objects: db.prepare('SELECT count(*) AS n FROM objects').get().n, blockGroups: db.prepare('SELECT count(*) AS n FROM blocks').get().n });
} catch (e) { report({ phase: 'error', error: e.stack }); }
finally { db.close(); }
