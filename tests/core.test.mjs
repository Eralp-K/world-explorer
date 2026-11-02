import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deflateSync, gzipSync } from 'node:zlib';
import { parseNBT, decodeChunk, blockAt, paletteIndex, text, json } from '../backend/nbt.mjs';
import { inside, readRegionChunk } from '../backend/region.mjs';
import { bookData, item } from '../backend/interactions.mjs';

const str = s => { const b = Buffer.from(s); const n = Buffer.alloc(2); n.writeUInt16BE(b.length); return Buffer.concat([n,b]); };
function tag(type, name, value) { return Buffer.concat([Buffer.from([type]), str(name), value]); }
const i32 = n => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };
const rootNBT = Buffer.concat([Buffer.from([10,0,0]), tag(8,'id',str('minecraft:chest')), tag(3,'x',i32(-17)), Buffer.from([0])]);

test('NBT reads named values and negative coordinates; rejects truncated and malicious tags', () => {
  const n = parseNBT(rootNBT); assert.equal(n.id,'minecraft:chest'); assert.equal(n.x,-17);
  assert.throws(() => parseNBT(rootNBT.subarray(0,rootNBT.length-1)));
  assert.throws(() => parseNBT(Buffer.from([10,0,0,99,0,0])));
});
test('gzip, zlib and uncompressed chunk decoding agree', () => {
  for (const [compression,b] of [[1,gzipSync(rootNBT)],[2,deflateSync(rootNBT)],[3,rootNBT]]) assert.equal(decodeChunk(b,compression).x,-17);
  assert.throws(() => decodeChunk(rootNBT,7));
});
test('block palette bit packing uses padded longs and handles negative chunk positions', () => {
  const data = new BigInt64Array(342); data[0] = 1n << 55n; // 5 bits, 12 values per long, index 11.
  const palette = Array.from({length:17},(_,i)=>({Name:'test:'+i}));
  assert.equal(paletteIndex({palette,data},11),1);
  const chunk = {sections:[{Y:-4,block_states:{palette:[{Name:'minecraft:stone'}]}}]};
  assert.equal(blockAt(chunk,-17,-64,-1).Name,'minecraft:stone'); assert.equal(blockAt(chunk,-17,0,-1).Name,'minecraft:air');
});
test('NBT text, modern item components and written books stay read-only', () => {
  assert.equal(text('{"text":"Hello","extra":[{"text":" world"}]}'),'Hello world');
  const raw = {id:'minecraft:written_book',count:1,Slot:2,components:{'minecraft:written_book_content':{title:{raw:'Notes'},author:'A',pages:[{raw:{text:'Page 1'}},{raw:'Page 2'}]}}};
  const before = JSON.stringify(raw); assert.equal(item(raw,27).slot,29); assert.deepEqual(bookData(raw).pages,['Page 1','Page 2']); assert.equal(JSON.stringify(raw),before);
  assert.equal(JSON.parse(json({long:2n})).long,'2');
});
test('safe paths reject traversal and sibling prefix collisions', () => {
  const r = path.resolve('world'); assert.equal(inside(r,path.join(r,'region','r.0.0.mca')),true); assert.equal(inside(r,path.resolve('world-other','level.dat')),false); assert.equal(inside(r,path.join(r,'..','outside')),false);
});
test('region reader reads chunk sectors without changing the source', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'worldexplorer-test-'));
  const file = path.join(dir,'r.-1.0.mca'), payload = deflateSync(rootNBT), b = Buffer.alloc(12288);
  b.writeUInt32BE((2<<8)|1,31*4); b.writeUInt32BE(payload.length+1,8192); b[8196]=2; payload.copy(b,8197);
  await fs.writeFile(file,b); assert.equal((await readRegionChunk(file,31,dir)).x,-17); assert.equal(await readRegionChunk(file,0,dir),null); assert.deepEqual(await fs.readFile(file),b);
  await fs.rm(dir,{recursive:true});
});
