import fs from 'node:fs/promises';
import path from 'node:path';
import { decodeChunk } from './nbt.mjs';

export function inside(root, candidate) {
  const r = path.relative(root, candidate); return r === '' || (!r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r));
}
export async function safeFile(root, candidate) {
  const real = await fs.realpath(candidate); if (!inside(root, real)) throw Error('Path leaves the selected world'); return real;
}
export async function readRegionChunk(file, slot, root) {
  file = await safeFile(root, file);
  const handle = await fs.open(file, 'r');
  try {
    const head = Buffer.alloc(4096); await handle.read(head, 0, 4096, 0);
    const location = head.readUInt32BE(slot * 4), sector = location >>> 8, count = location & 255;
    if (!sector || !count) return null;
    const meta = Buffer.alloc(5); const { bytesRead } = await handle.read(meta, 0, 5, sector * 4096);
    if (bytesRead !== 5) throw Error('Truncated region chunk header');
    const length = meta.readUInt32BE(), compression = meta[4], external = (compression & 128) !== 0;
    if (length < 1 || length > count * 4096 - 4) throw Error('Invalid chunk length');
    let bytes;
    if (external) {
      const m = /r\.(-?\d+)\.(-?\d+)\.mca$/.exec(file); if (!m) throw Error('Invalid region name');
      const cx = Number(m[1]) * 32 + slot % 32, cz = Number(m[2]) * 32 + Math.floor(slot / 32);
      const ext = await safeFile(root, path.join(path.dirname(file), `c.${cx}.${cz}.mcc`)); bytes = await fs.readFile(ext);
    } else {
      bytes = Buffer.alloc(length - 1); const r = await handle.read(bytes, 0, bytes.length, sector * 4096 + 5);
      if (r.bytesRead !== bytes.length) throw Error('Truncated region chunk');
    }
    return decodeChunk(bytes, compression & 127);
  } finally { await handle.close(); }
}
export async function getChunk(world, dimension, cx, cz, kind = 'region') {
  const dim = world.dimensions.find(d => d.id === dimension); if (!dim) throw Error('Unknown dimension');
  const rx = Math.floor(cx / 32), rz = Math.floor(cz / 32), slot = ((cz % 32 + 32) % 32) * 32 + ((cx % 32 + 32) % 32);
  try { return await readRegionChunk(path.join(dim.path, kind, `r.${rx}.${rz}.mca`), slot, world.path); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
