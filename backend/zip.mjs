import fs from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';

// Minimal read-only central-directory ZIP reader for installed Minecraft assets.
export class ZipAssets {
  async load(file) {
    this.bytes = await fs.readFile(file); const b = this.bytes; let end = b.length - 22;
    while (end >= Math.max(0, b.length - 65558) && b.readUInt32LE(end) !== 0x06054b50) end--;
    if (end < 0 || b.readUInt32LE(end) !== 0x06054b50) throw Error('ZIP directory missing');
    this.entries = new Map(); const count = b.readUInt16LE(end + 10); let p = b.readUInt32LE(end + 16);
    for (let i = 0; i < count; i++) {
      if (b.readUInt32LE(p) !== 0x02014b50) throw Error('Invalid ZIP directory');
      const n = b.readUInt16LE(p + 28), x = b.readUInt16LE(p + 30), c = b.readUInt16LE(p + 32);
      const name = b.toString('utf8', p + 46, p + 46 + n);
      this.entries.set(name, { compression: b.readUInt16LE(p + 10), size: b.readUInt32LE(p + 20), offset: b.readUInt32LE(p + 42) });
      p += 46 + n + x + c;
    }
    return this;
  }
  read(name) {
    const e = this.entries.get(name); if (!e) return null;
    const b = this.bytes, p = e.offset + 30 + b.readUInt16LE(e.offset + 26) + b.readUInt16LE(e.offset + 28);
    const data = b.subarray(p, p + e.size);
    if (e.compression === 0) return data;
    if (e.compression === 8) return inflateRawSync(data, { maxOutputLength: 32 * 1024 * 1024 });
    return null;
  }
}
