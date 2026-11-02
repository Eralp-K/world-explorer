import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { openWorld } from './world.mjs';
import { inside, getChunk } from './region.mjs';
import { Renderer } from './renderer.mjs';
import { inspectBlock, bookData } from './interactions.mjs';
import { json, text, sectionsOf, sectionStates, paletteIndex } from './nbt.mjs';
import { ZipAssets } from './zip.mjs';
import { nativePicker } from './native-picker.mjs';
import { resolveWorldSource } from './world-source.mjs';
import { createRenderScope, containsPoint } from './render-scope.mjs';
import { VIEW_DISTANCE_BLOCKS, LOWRES_VIEW_DISTANCE_BLOCKS } from '../web/view-config.js';
import { entityAppearance, entityTexture } from './entity-view.mjs';
import { loadEntityModels } from './model-assets.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const local = JSON.parse(await fs.readFile(path.join(root, 'local.config.json'), 'utf8').catch(() => '{}'));
local.jar ||= path.join(root, 'vendor', 'bluemap-5.29-cli.jar');
local.java ||= process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java.exe') : 'java';
if (!path.isAbsolute(local.jar)) local.jar = path.resolve(root, local.jar);
const args = process.argv.slice(2), portFlag = args.indexOf('--port');
const port = Number(portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || 8101);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid port');
const base = `http://127.0.0.1:${port}`, token = randomBytes(24).toString('hex');
const cacheRoot = path.join(root, 'cache'), stateDir = path.join(root, 'state');
await fs.mkdir(cacheRoot, { recursive: true }); await fs.mkdir(stateDir, { recursive: true });
let recents = JSON.parse(await fs.readFile(path.join(stateDir, 'recents.json'), 'utf8').catch(() => '[]'));
const pathKey = p => process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p);
recents = recents.filter((w, i, all) => all.findIndex(r => pathKey(r.path) === pathKey(w.path)) === i);
let world = null, worker = null, db = null, indexStatus = { phase: 'idle' }, busy = false, assets = null;
let currentCache=null;
const renderer = new Renderer(local);
if (local.clientJar) try { assets = await new ZipAssets().load(local.clientJar); } catch (e) { console.error('Item icons unavailable:', e.message); }
let language = {}; try { language = JSON.parse(assets?.read('assets/minecraft/lang/en_us.json')?.toString() || '{}'); } catch {}
let nativeModelPromise;

async function snapshot() {
  return { world, index: indexStatus, render: renderer.status, availableMaps: await renderer.available(), readOnly: true };
}
function startIndex(rebuild = false) {
  if (worker) throw Error('Indexing is already in progress');
  const database = path.join(currentCache, 'index.sqlite');
  indexStatus = { phase: 'indexing', done: 0, total: 0 };
  const w = new Worker(new URL('./index-worker.mjs', import.meta.url), { workerData: { world, database, rebuild } }); worker = w;
  w.on('message', status => {
    if(worker!==w)return;
    indexStatus = status;
    if (!db && status.total !== undefined) {
      try { db = new DatabaseSync(database, { readOnly: true }); db.exec('PRAGMA busy_timeout=10000;'); } catch {}
    }
  });
  w.on('error', e => { indexStatus = { phase: 'error', error: e.message }; });
  w.on('exit', code => { if (worker === w) worker = null; if (code && indexStatus.phase !== 'error') indexStatus = { phase: 'error', error: 'Indexer exited with code ' + code }; });
}
async function selectWorld(input, { renderAll = false, rebuild = false, scope: scopeRequest } = {}) {
  if (busy) throw Error('Another world is opening');
  busy = true;
  try {
    const source = await resolveWorldSource(input, cacheRoot);
    const next = { ...await openWorld(source.path), sourcePath: source.sourcePath, sourceType: source.sourceType }; // Validate before replacing active state.
    next.scope=createRenderScope(next,scopeRequest);
    await renderer.stopAndWait();
    if (worker) { const old = worker; worker = null; await old.terminate(); }
    if (db) { db.close(); db = null; }
    world = next; const baseCache=path.join(cacheRoot,world.id);
    const cache=world.scope.mode==='all'?baseCache:path.join(baseCache,'profiles',world.scope.key);currentCache=cache;await fs.mkdir(cache, { recursive: true });
    await renderer.prepare(world, cache);
    recents = [{ path: world.sourcePath, sourceType: world.sourceType, name: world.name, version: world.version, lastOpened: new Date().toISOString() }, ...recents.filter(w => pathKey(w.path) !== pathKey(world.sourcePath))].slice(0, 12);
    await fs.writeFile(path.join(stateDir, 'recents.json'), JSON.stringify(recents, null, 2));
    startIndex(rebuild);
    if (renderAll) await renderer.start(rebuild);
    else if ((await renderer.available()).length < world.dimensions.length) await renderer.start(false, true);
    return await snapshot();
  } finally { busy = false; }
}
const fail = (message, status = 400) => Object.assign(Error(message), { status });
function needWorld() { if (!world) throw fail('Open a Minecraft world first', 409); }
function coords(url) {
  const d = url.searchParams.get('dimension') || world.dimensions[0].id;
  if (!world.dimensions.some(x => x.id === d)) throw fail('Unknown dimension');
  const p = ['x', 'y', 'z'].map(k => Number(url.searchParams.get(k)));
  if (!['x', 'y', 'z'].every(k => url.searchParams.has(k)) || p.some(x => !Number.isSafeInteger(x) || Math.abs(x) > 30000000)) throw fail('Invalid block coordinates');
  return [d, ...p];
}
function send(res, data, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(json(data)); }
async function body(req) {
  let s = ''; for await (const c of req) { s += c; if (s.length > 2 * 1024 * 1024) throw fail('Request too large', 413); }
  try { return JSON.parse(s || '{}'); } catch { throw fail('Invalid JSON'); }
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.gz': 'application/octet-stream' };
async function staticFile(res, dir, relative, mapData = false) {
  const p = path.resolve(dir, relative); if (!inside(path.resolve(dir), p)) throw fail('Invalid path', 403);
  const real = await fs.realpath(p).catch(() => null);
  if (real && !inside(await fs.realpath(dir), real)) throw fail('Invalid path', 403);
  let file = real, compressed = false;
  if (!file && mapData) { file = await fs.realpath(p + '.gz').catch(() => null); compressed = !!file; if (file && !inside(await fs.realpath(dir), file)) throw fail('Invalid path', 403); }
  if (!file) throw fail('File not found', 404);
  const st = await fs.stat(file); if (!st.isFile()) throw fail('File not found', 404);
  const headers = { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': mapData ? 'no-cache' : 'no-cache' };
  if (compressed) headers['Content-Encoding'] = 'gzip';
  headers['Content-Length'] = st.size; res.writeHead(200, headers);
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

export const handler = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  try {
    // Reject DNS rebinding, cross-origin reads and all mutations without a per-session token.
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) throw fail('Invalid Host', 403);
    const url = new URL(req.url, base), u = decodeURIComponent(url.pathname);
    // A clicked link from the public download portal may open the static home
    // document. It never grants cross-site access to bootstrap, world data,
    // embedded documents, background fetches or state-changing requests.
    const homeNavigation = req.method === 'GET' && u === '/' &&
      (!url.searchParams.has('view') || url.searchParams.get('view') === 'home') &&
      req.headers['sec-fetch-mode'] === 'navigate' &&
      req.headers['sec-fetch-dest'] === 'document' &&
      req.headers['sec-fetch-user'] === '?1';
    if (req.headers['sec-fetch-site'] === 'cross-site' && !homeNavigation) throw fail('Cross-site request rejected', 403);
    if (!['GET', 'POST'].includes(req.method)) throw fail('Method not allowed', 405);
    if (req.method === 'POST') {
      if (req.headers['x-explorer-token'] !== token) throw fail('Invalid session token', 403);
      if (req.headers.origin && ![base, `http://localhost:${port}`].includes(req.headers.origin)) throw fail('Invalid origin', 403);
    }
    if (u.includes('\0') || u.includes('\\') || u.split('/').includes('..')) throw fail('Invalid path', 403);
    if (u === '/api/bootstrap') return send(res, { token, recents, port, attribution: 'BlueMap 5.29 · MIT', itemNames: language });
    if (u === '/api/world' || u === '/api/render/status') return send(res, await snapshot());
    if (u === '/api/recents/clear' && req.method === 'POST') {recents=[];await fs.writeFile(path.join(stateDir,'recents.json'),'[]\n');return send(res,{recents});}
    if (u === '/api/render/stop' && req.method === 'POST') {needWorld();await renderer.stopAndWait();renderer.status={...renderer.status,phase:'paused'};return send(res,await snapshot());}
    if ((u === '/api/pick-folder' || u === '/api/pick-zip') && req.method === 'POST') return send(res, { path: await nativePicker(u === '/api/pick-zip' ? 'zip' : 'folder') });
    if (u === '/api/world/open' && req.method === 'POST') { const b=await body(req);return send(res,await selectWorld(b.path,{scope:b.scope})); }
    if (u === '/api/update' && req.method === 'POST') { needWorld(); const b = await body(req); if (worker || renderer.child) throw fail('Wait for indexing/rendering to finish', 409); startIndex(b.rebuild === true); await renderer.start(b.rebuild === true); return send(res, await snapshot()); }
    if (u === '/api/dimensions') { needWorld(); return send(res, world.dimensions); }
    if (u === '/api/block' || u === '/api/container') { needWorld();const p=coords(url);if(!containsPoint(world.scope,p[0],p[1]+0.5,p[3]+0.5))throw fail('Bu konum seçilen render alanının dışında.',404);return send(res, await inspectBlock(world, ...p)); }
    if (u === '/api/entity-models') {
      nativeModelPromise ||= loadEntityModels(local,assets,cacheRoot);
      try{return send(res,await nativeModelPromise);}catch(e){nativeModelPromise=null;throw fail(e.message,503);}
    }
    if (u.startsWith('/api/entity-texture/')) {
      const bytes=entityTexture(assets,u.slice('/api/entity-texture/'.length),Object.fromEntries(url.searchParams));
      if(!bytes)throw fail('Entity texture not available',404);
      res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'private, max-age=3600'});return res.end(bytes);
    }
    if (u === '/api/entities/near') {
      needWorld();if(!db)return send(res,{results:[],indexing:true});
      const dim=url.searchParams.get('dimension')||world.dimensions[0].id;
      const x=Number(url.searchParams.get('x')),y=Number(url.searchParams.get('y')),z=Number(url.searchParams.get('z'));
      if(![x,y,z].every(Number.isFinite))throw fail('Invalid entity coordinates');
      const rows=db.prepare("SELECT rowid,id,x,y,z,payload FROM objects WHERE dim=? AND kind='entity' AND x BETWEEN ? AND ? AND z BETWEEN ? AND ? AND y BETWEEN ? AND ? ORDER BY (x-?)*(x-?)+(y-?)*(y-?)+(z-?)*(z-?) LIMIT 128").all(dim,x-64,x+64,z-64,z+64,y-48,y+48,x,x,y,y,z,z);
      return send(res,{results:rows.filter(r=>containsPoint(world.scope,dim,r.x,r.z)&&(r.x-x)**2+(r.y-y)**2+(r.z-z)**2<=64**2).map(entityAppearance),indexing:indexStatus.phase==='indexing'});
    }
    if (u === '/api/entity') {
      needWorld(); if (!db) throw fail('Index is still starting', 409);
      const row = db.prepare('SELECT rowid,* FROM objects WHERE rowid=? AND kind=?').get(Number(url.searchParams.get('id')), 'entity');
      if (!row || !containsPoint(world.scope,row.dim,row.x,row.z)) throw fail('Entity not found', 404); return send(res, { ...row, payload: JSON.parse(row.payload) });
    }
    if (u === '/api/book' && req.method === 'POST') return send(res, bookData((await body(req)).item));
    if (u === '/api/search' || u === '/api/markers') {
      needWorld(); if (!db) return send(res, { results: [], indexing: true });
      const dim = url.searchParams.get('dimension') || world.dimensions[0].id;
      const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 150), offset = Math.max(0, Math.min(1000000, Number(url.searchParams.get('offset')) || 0));
      const coordinate = /^(-?\d+)\s*[, ]\s*(-?\d+)\s*[, ]\s*(-?\d+)$/.exec(q);
      if (coordinate) return send(res, { results: containsPoint(world.scope,dim,+coordinate[1],+coordinate[3])?[{ kind: 'coordinate', id: 'Coordinates', x: +coordinate[1], y: +coordinate[2], z: +coordinate[3], dim }]:[] });
      let rows;
      if (u === '/api/markers') {
        const x = Number(url.searchParams.get('x')) || 0, z = Number(url.searchParams.get('z')) || 0;
        rows = db.prepare('SELECT rowid,dim,kind,id,x,y,z FROM objects WHERE dim=? AND x BETWEEN ? AND ? AND z BETWEEN ? AND ? AND kind<>? ORDER BY (x-?)*(x-?)+(z-?)*(z-?) LIMIT 400').all(dim, x - 96, x + 96, z - 96, z + 96, 'poi', x, x, z, z);
      } else {
        if (!q) return send(res, { results: [] });
        const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
        rows = db.prepare("SELECT rowid,dim,kind,id,x,y,z FROM objects WHERE dim=? AND id LIKE ? ESCAPE '\\' ORDER BY x,z LIMIT 80 OFFSET ?").all(dim, like, offset);
        if (rows.length < 80) {
          const blockRows = db.prepare("SELECT dim,'block-group' AS kind,name AS id,x,y,z,count FROM blocks WHERE dim=? AND name LIKE ? ESCAPE '\\' ORDER BY x,z LIMIT 80 OFFSET ?").all(dim, like, offset);
          const loaded = new Map();
          for (const b of blockRows) if (b.count === -1) {
            const cx = Math.floor(b.x / 16), cz = Math.floor(b.z / 16), key = `${cx},${cz}`;
            if (!loaded.has(key)) loaded.set(key, await getChunk(world, dim, cx, cz));
            const section = loaded.get(key) && sectionsOf(loaded.get(key)).find(s => s.Y === Math.floor(b.y / 16));
            const states = section && sectionStates(section); let first = -1, count = 0;
            if (states?.palette) for (let i = 0; i < 4096; i++) if (states.palette[paletteIndex(states, i)]?.Name === b.id) { if (first < 0) first = i; count++; }
            b.count = count;
            if (first >= 0) { b.x += first & 15; b.y += first >> 8; b.z += (first >> 4) & 15; }
          }
          const positions = new Set(rows.map(r => `${r.id}|${r.x}|${r.y}|${r.z}`));
          rows.push(...blockRows.filter(r => r.count > 0 && !positions.has(`${r.id}|${r.x}|${r.y}|${r.z}`)));
        }
      }
      return send(res, { results: rows.filter(r=>containsPoint(world.scope,dim,r.x,r.z)).slice(0, u === '/api/markers' ? 400 : 80), offset, indexing: indexStatus.phase === 'indexing' });
    }
    if (u.startsWith('/api/icon/')) {
      const id = u.slice(10); if (!/^[a-z0-9_.-]+:[a-z0-9_/.-]+$/.test(id) || id.includes('..')) throw fail('Invalid item ID');
      const [ns, name] = id.split(':'); const b = assets?.read(`assets/${ns}/textures/item/${name}.png`) || assets?.read(`assets/${ns}/textures/block/${name}.png`);
      if (!b) throw fail('Texture not available', 404); res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' }); return res.end(b);
    }
    if (u === '/settings.json') {
      needWorld(); return send(res, { version: '5.29', useCookies: false, mapDataRoot: '/maps', liveDataRoot: '/maps', maps: await renderer.available(), scripts: [], styles: [], clientDecompression: false, hiresSliderDefault: VIEW_DISTANCE_BLOCKS, hiresSliderMax:VIEW_DISTANCE_BLOCKS, lowresSliderDefault: LOWRES_VIEW_DISTANCE_BLOCKS });
    }
    if (u.startsWith('/maps/')) {
      needWorld(); const parts = u.slice(6).split('/'), dir = renderer.maps[parts.shift()]; if (!dir) throw fail('Unknown map', 404);
      const name = parts.join('/');
      if (name === 'live/players.json') return send(res, { players: [] });
      if (name === 'live/markers.json') return send(res, {});
      if (name === 'live/sse') { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.write(': local static world\n\n'); const interval = setInterval(() => res.write(': heartbeat\n\n'), 20000); req.on('close', () => clearInterval(interval)); return; }
      return await staticFile(res, dir, name, true);
    }
    if (u.startsWith('/vendor/')) return await staticFile(res, path.join(root, 'vendor'), u.slice(8));
    if (u.startsWith('/lang/')) return await staticFile(res, path.join(root, 'vendor', 'lang'), u.slice(6));
    if (u.startsWith('/assets/')) return await staticFile(res, path.join(root, 'vendor', 'assets'), u.slice(8));
    if (u === '/health') return send(res, { ok: true });
    return await staticFile(res, path.join(root, 'web'), u === '/' ? 'index.html' : u.slice(1));
  } catch (e) { if (!res.headersSent) send(res, { error: e.message }, e.status || (e.code === 'ENOENT' ? 404 : 400)); else res.destroy(); }
};
const server = http.createServer(handler);
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is in use. Start with --port 8101.` : e.message); process.exitCode = 1; });
if (process.env.EXPLORER_NO_LISTEN !== '1') server.listen(port, '127.0.0.1', async () => {
  console.log(`Minecraft World Explorer: ${base}\nRead-only worlds. Cache: ${cacheRoot}`);
  const openIndex = args.indexOf('open');
  const command = args[0], updating = ['update','rebuild'].includes(command);
  const input = openIndex >= 0 ? args[openIndex + 1] : updating ? recents[0]?.path : args[0] && !args[0].startsWith('-') ? args[0] : null;
  if (input) try { await selectWorld(input, { renderAll: updating, rebuild: command === 'rebuild' }); } catch (e) { console.error(e.message); }
  if (!args.includes('--no-browser') && process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', base], { windowsHide: true, stdio: 'ignore' });
});
export async function cleanup() { renderer.stop(); if (worker) { const w = worker; worker = null; await w.terminate(); } if (db) { db.close(); db = null; } }
async function shutdown() { await cleanup(); server.close(); process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
