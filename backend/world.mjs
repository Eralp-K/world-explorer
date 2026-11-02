import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readLevelBytes, parseNBT } from './nbt.mjs';
import { gunzipSync } from 'node:zlib';
import { playerPosition, newestPlayer } from './render-scope.mjs';
import { inside, safeFile } from './region.mjs';

export async function openWorld(input) {
  if (typeof input !== 'string' || !input.trim() || input.includes('\0')) throw Error('Select a Minecraft Java save folder');
  const root = await fs.realpath(input.trim());
  const levelPath = await safeFile(root, path.join(root, 'level.dat'));
  const data = readLevelBytes(await fs.readFile(levelPath));
  if (!data?.Version?.Name || !Number.isInteger(data.DataVersion)) throw Error('This is not a supported Minecraft Java world');
  const version = data.Version.Name;
  const supported = /^(1\.(18|19|20|21)(\.\d+)?|26\.[12](\.\d+)?)$/.test(version);
  if (!supported) throw Error(`Minecraft ${version} (DataVersion ${data.DataVersion}) is not supported. Supported saves: Java 1.18–26.2 release versions.`);
  const dimensions = [];
  async function add(id, folder, label) {
    try {
      const real = await fs.realpath(folder); if (!inside(root, real)) return;
      const regions = await fs.readdir(path.join(real, 'region'));
      if (regions.some(n => /^r\.-?\d+\.-?\d+\.mca$/.test(n)) && !dimensions.some(d => d.id === id)) dimensions.push({ id, path: real, label, mapId: 'd' + dimensions.length });
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  await add('minecraft:overworld', root, 'Overworld');
  await add('minecraft:the_nether', path.join(root, 'DIM-1'), 'Nether');
  await add('minecraft:the_end', path.join(root, 'DIM1'), 'The End');
  async function scan(folder, segments = []) {
    let entries; try { entries = await fs.readdir(folder, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    if (segments.length > 8) return;
    for (const e of entries) if (e.isDirectory() && !['region', 'entities', 'poi', 'data'].includes(e.name)) {
      const seg = [...segments, e.name], dir = path.join(folder, e.name);
      if (seg.length >= 2) { const id = seg[0] + ':' + seg.slice(1).join('/'); await add(id, dir, ({ 'minecraft:overworld': 'Overworld', 'minecraft:the_nether': 'Nether', 'minecraft:the_end': 'The End' })[id] || seg.join(' / ')); }
      await scan(dir, seg);
    }
  }
  await scan(path.join(root, 'dimensions'));
  if (!dimensions.length) throw Error('No generated Anvil region chunks were found in this save');
  const id = createHash('sha256').update(root).digest('hex').slice(0, 20);
  // Spawn changed from scalar fields to a compound in newer versions.
  const spawn = data.spawn?.pos || data.SpawnPos || [data.SpawnX || 0, data.SpawnY || 80, data.SpawnZ || 0];
  const candidates = [];
  if (data.Player) candidates.push(playerPosition(data.Player, (await fs.stat(levelPath)).mtimeMs, 'level.dat/Player'));
  for(const relative of ['playerdata',path.join('players','data')])try {
    const directory = await safeFile(root, path.join(root,relative));
    for (const file of await fs.readdir(directory)) if (/^[0-9a-f-]{32,36}\.dat$/i.test(file)) {
      try {
        const p=await safeFile(root,path.join(directory,file)),stat=await fs.stat(p);
        const player=parseNBT(gunzipSync(await fs.readFile(p),{maxOutputLength:16*1024*1024}));
        candidates.push(playerPosition(player,stat.mtimeMs,relative.replaceAll('\\','/')+'/'+file));
      } catch { /* Ignore a corrupt player record; other records and spawn remain usable. */ }
    }
  } catch(e) { if(e.code!=='ENOENT')throw e; }
  const valid=candidates.filter(Boolean),playersByDimension={};
  for(const d of dimensions) { const player=newestPlayer(valid.filter(p=>p.dimension===d.id));if(player)playersByDimension[d.id]=player; }
  return { id, path: root, name: data.LevelName || path.basename(root), version, dataVersion: data.DataVersion, dimensions, lastPlayer:newestPlayer(valid),playersByDimension,
    spawn: Array.isArray(spawn) ? { x: spawn[0], y: spawn[1], z: spawn[2] } : { x: spawn.x || 0, y: spawn.y || 80, z: spawn.z || 0 } };
}
