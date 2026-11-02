import { gunzipSync, inflateSync } from 'node:zlib';

// All public entry points consume bytes. This module never writes world files.
export function parseNBT(input, { skipLongArrays = false } = {}) {
  const b = Buffer.from(input); let p = 0, nodes = 0;
  function need(n) { if (!Number.isSafeInteger(n) || n < 0 || p + n > b.length) throw Error('Truncated or invalid NBT'); }
  function u8() { need(1); return b[p++]; }
  function u16() { need(2); const v = b.readUInt16BE(p); p += 2; return v; }
  function i32() { need(4); const v = b.readInt32BE(p); p += 4; return v; }
  function str() { const n = u16(); need(n); const v = b.toString('utf8', p, p + n); p += n; return v; }
  function len() { const n = i32(); if (n < 0 || n > 16777216) throw Error('NBT array too large'); return n; }
  function value(t, depth = 0, name = '', parent = '') {
    if (depth > 96 || ++nodes > 4000000) throw Error('NBT complexity limit exceeded');
    switch (t) {
      case 1: need(1); return b.readInt8(p++);
      case 2: { need(2); const v = b.readInt16BE(p); p += 2; return v; }
      case 3: return i32();
      case 4: { need(8); const v = b.readBigInt64BE(p); p += 8; return v; }
      case 5: { need(4); const v = b.readFloatBE(p); p += 4; return v; }
      case 6: { need(8); const v = b.readDoubleBE(p); p += 8; return v; }
      case 7: { const n = len(); need(n); const v = b.subarray(p, p + n); p += n; return v; }
      case 8: return str();
      case 9: { const type = u8(), n = len(); if (type === 0 && n) throw Error('Invalid NBT list'); return Array.from({ length: n }, () => value(type, depth + 1, name, parent)); }
      case 10: { const out = Object.create(null); let type; while ((type = u8()) !== 0) { const field = str(); out[field] = value(type, depth + 1, field, name); } return out; }
      case 11: { const n = len(); need(n * 4); return Array.from({ length: n }, () => i32()); }
      case 12: { const n = len(); need(n * 8); if (skipLongArrays && ((name === 'data' && parent === 'block_states') || name === 'BlockStates' || parent === 'Heightmaps')) { p += n * 8; return []; } const out = new BigInt64Array(n); for (let i = 0; i < n; i++, p += 8) out[i] = b.readBigInt64BE(p); return out; }
      default: throw Error('Unsupported NBT tag ' + t);
    }
  }
  const t = u8(); if (t !== 10) throw Error('NBT root must be a compound'); str(); return value(t);
}

export function readLevelBytes(bytes) { return parseNBT(gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 })).Data; }
export function decodeChunk(bytes, compression, nbtOptions) {
  const options = { maxOutputLength: 32 * 1024 * 1024 };
  if (compression === 1) return parseNBT(gunzipSync(bytes, options), nbtOptions);
  if (compression === 2) return parseNBT(inflateSync(bytes, options), nbtOptions);
  if (compression === 3) return parseNBT(bytes, nbtOptions);
  if (compression === 4) return parseNBT(decodeLZ4Java(bytes), nbtOptions);
  throw Error('Unsupported region compression: ' + compression);
}

function decodeLZ4Java(b) {
  let p = 0, total = 0; const output = [];
  while (p + 21 <= b.length) {
    if (b.toString('ascii', p, p + 8) !== 'LZ4Block') throw Error('Invalid LZ4 stream');
    const method = b[p + 8] & 0xf0, size = b.readInt32LE(p + 9), length = b.readInt32LE(p + 13); p += 21;
    if (!size && !length) break;
    if (size < 0 || length < 0 || p + size > b.length || (total += length) > 32 * 1024 * 1024) throw Error('Invalid LZ4 block');
    if (method === 0x10) { if (size !== length) throw Error('Invalid LZ4 raw block'); output.push(b.subarray(p, p + size)); }
    else if (method === 0x20) {
      const src = b.subarray(p, p + size), dst = Buffer.alloc(length); let r = 0, w = 0;
      function extra(n) { if (n === 15) { let v; do { if (r >= src.length) throw Error('Truncated LZ4'); v = src[r++]; n += v; } while (v === 255); } return n; }
      while (r < src.length) {
        const token = src[r++], literal = extra(token >> 4);
        if (r + literal > src.length || w + literal > length) throw Error('Invalid LZ4 literal');
        src.copy(dst, w, r, r + literal); r += literal; w += literal;
        if (r === src.length) break;
        if (r + 2 > src.length) throw Error('Truncated LZ4 offset');
        const offset = src.readUInt16LE(r); r += 2; const match = extra(token & 15) + 4;
        if (!offset || offset > w || w + match > length) throw Error('Invalid LZ4 match');
        for (let i = 0; i < match; i++) dst[w + i] = dst[w + i - offset]; w += match;
      }
      if (w !== length) throw Error('Invalid LZ4 decoded length'); output.push(dst);
    } else throw Error('Unknown LZ4 method');
    p += size;
  }
  return Buffer.concat(output);
}

export function json(value) { return JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : ArrayBuffer.isView(v) && !Buffer.isBuffer(v) ? Array.from(v, x => typeof x === 'bigint' ? x.toString() : x) : v); }
export function text(c) {
  if (c == null) return '';
  if (typeof c === 'string') { try { return text(JSON.parse(c)); } catch { return c; } }
  if (Array.isArray(c)) return c.map(text).join('');
  if (typeof c === 'object') return (c.text || c.translate || '') + (c.extra ? text(c.extra) : '');
  return String(c);
}

export const chunkRoot = c => c.Level || c;
export const sectionsOf = c => chunkRoot(c).sections || chunkRoot(c).Sections || [];
export function sectionStates(section) { return section.block_states || { palette: section.Palette, data: section.BlockStates }; }
export function paletteIndex(states, index) {
  if (!states?.palette?.length) return 0;
  if (states.palette.length === 1 || !states.data?.length) return 0;
  const bits = Math.max(4, Math.ceil(Math.log2(states.palette.length))), perLong = Math.floor(64 / bits);
  const long = states.data[Math.floor(index / perLong)];
  return Number((BigInt.asUintN(64, BigInt(long)) >> BigInt((index % perLong) * bits)) & ((1n << BigInt(bits)) - 1n));
}
export function blockAt(chunk, x, y, z) {
  const s = sectionsOf(chunk).find(s => s.Y === Math.floor(y / 16));
  if (!s) return { Name: 'minecraft:air' };
  const states = sectionStates(s), index = ((y & 15) << 8) | ((z & 15) << 4) | (x & 15);
  return states?.palette?.[paletteIndex(states, index)] || { Name: 'minecraft:air' };
}
