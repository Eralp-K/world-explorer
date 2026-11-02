import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { gzipSync, crc32 } from 'node:zlib';
import { resolveWorldSource } from '../backend/world-source.mjs';
import { openWorld } from '../backend/world.mjs';
import { ensureNativeHelper, runNative } from '../backend/windows-native.mjs';

const s = value => { const b=Buffer.from(value), n=Buffer.alloc(2);n.writeUInt16BE(b.length);return Buffer.concat([n,b]); };
const i = value => {const b=Buffer.alloc(4);b.writeInt32BE(value);return b;};
const tag=(type,name,payload)=>Buffer.concat([Buffer.from([type]),s(name),payload]);
const compound=(name,children)=>tag(10,name,Buffer.concat([...children,Buffer.from([0])]));
const level=gzipSync(Buffer.concat([Buffer.from([10,0,0]),compound('Data',[
  tag(8,'LevelName',s('Türkçe ZIP dünyası')),tag(3,'DataVersion',i(4903)),compound('Version',[tag(8,'Name',s('26.2'))])
]),Buffer.from([0])]));
const double=n=>{const b=Buffer.alloc(8);b.writeDoubleBE(n);return b;};
const player=gzipSync(Buffer.concat([Buffer.from([10,0,0]),tag(9,'Pos',Buffer.concat([Buffer.from([6]),i(3),double(128),double(75),double(256)])),tag(8,'Dimension',s('minecraft:overworld')),Buffer.from([0])]));
const region=Buffer.alloc(8192);
function zip(entries, zip64=false) {
  const local=[], central=[];let offset=0;
  for(const [name,content,attributes=0] of entries){
    const n=Buffer.from(name),b=Buffer.from(content),h=Buffer.alloc(30),c=Buffer.alloc(46),crc=crc32(b);
    h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE((44<<9)|(1<<5)|2,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(b.length,18);h.writeUInt32LE(b.length,22);h.writeUInt16LE(n.length,26);
    c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(0x314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(b.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(attributes>>>0,38);c.writeUInt32LE(offset,42);
    c.writeUInt16LE((44<<9)|(1<<5)|2,14);
    local.push(h,n,b);central.push(c,n);offset+=h.length+n.length+b.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);
  if(!zip64){end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);}
  const wide=Buffer.alloc(56),locator=Buffer.alloc(20);
  wide.writeUInt32LE(0x06064b50);wide.writeBigUInt64LE(44n,4);wide.writeUInt16LE(45,12);wide.writeUInt16LE(45,14);wide.writeBigUInt64LE(BigInt(entries.length),24);wide.writeBigUInt64LE(BigInt(entries.length),32);wide.writeBigUInt64LE(BigInt(directory.length),40);wide.writeBigUInt64LE(BigInt(offset),48);
  locator.writeUInt32LE(0x07064b50);locator.writeBigUInt64LE(BigInt(offset+directory.length),8);locator.writeUInt32LE(1,16);
  end.writeUInt16LE(65535,8);end.writeUInt16LE(65535,10);end.writeUInt32LE(0xffffffff,12);end.writeUInt32LE(0xffffffff,16);
  return Buffer.concat([...local,directory,wide,locator,end]);
}
async function temporary(run){
  const parent=await fs.realpath(os.tmpdir()),folder=await fs.mkdtemp(path.join(parent,'world-explorer-zip-'));
  try{return await run(folder);}finally{const rel=path.relative(parent,folder);assert.ok(rel.startsWith('world-explorer-zip-')&&!rel.includes(path.sep));await fs.rm(folder,{recursive:true,force:true});}
}
const win={skip:process.platform!=='win32'};
test('modern Windows Common Item Dialog COM interface initializes',win,async()=>{
  assert.equal(await runNative(await ensureNativeHelper(),['probe']),'Windows Common Item Dialog ready');
});
test('nested Unicode world ZIP opens from cache and leaves archive bytes unchanged',win,async()=>temporary(async dir=>{
  const file=path.join(dir,'Dünya & [test].ZIP'),cache=path.join(dir,'cache');
  const modernPlayer='players/data/00000000-0000-0000-0000-000000000001.dat',oldPlayer='playerdata/00000000-0000-0000-0000-000000000002.dat';
  const bytes=zip([['Özgür Dünya/level.dat',level],['Özgür Dünya/dimensions/minecraft/overworld/region/r.0.0.mca',region],['Özgür Dünya/'+modernPlayer,player],['Özgür Dünya/'+oldPlayer,player],['readme.txt',Buffer.from('outside world subtree')]]);
  await fs.writeFile(file,bytes);const first=await resolveWorldSource(file,cache),world=await openWorld(first.path);
  assert.equal(world.name,'Türkçe ZIP dünyası');assert.equal(world.version,'26.2');assert.equal(first.sourceType,'zip');assert.equal(first.sourcePath,await fs.realpath(file));
  assert.equal(new Date((await fs.stat(path.join(first.path,'level.dat'))).mtimeMs).getFullYear(),2024);
  await fs.utimes(path.join(first.path,modernPlayer),new Date('2025-01-01'),new Date('2025-01-01'));
  const withPlayer=await openWorld(first.path);assert.equal(withPlayer.lastPlayer.x,128);assert.equal(withPlayer.lastPlayer.source,modernPlayer);
  await assert.rejects(fs.access(path.join(first.path,'readme.txt')));assert.deepEqual(await fs.readFile(file),bytes);
  const again=await resolveWorldSource(file,cache);assert.equal(again.path,first.path);
  const folder=await resolveWorldSource(first.path,cache);assert.equal(folder.sourceType,'folder');assert.equal(folder.path,first.path);
}));
test('ZIP64 directory and root-level level.dat are supported',win,async()=>temporary(async dir=>{
  const file=path.join(dir,'world.zip');await fs.writeFile(file,zip([['level.dat',level],['region/r.0.0.mca',region]],true));
  const source=await resolveWorldSource(file,path.join(dir,'cache'));assert.equal((await openWorld(source.path)).version,'26.2');
}));
test('unsafe paths, duplicate names, links and multi-world archives are rejected',win,async()=>temporary(async dir=>{
  const cases=[
    [['level.dat',level],['../escaped.txt',Buffer.from('x')]],
    [['level.dat',level],['C:/escaped.txt',Buffer.from('x')]],
    [['level.dat',level],['region/r.0.0.mca',region],['REGION/r.0.0.mca',region]],
    [['level.dat',level],['link',Buffer.from('outside'),0xa1ff0000]],
    [['one/level.dat',level],['two/level.dat',level]],
    [['no-world.txt',Buffer.from('x')]],
  ];
  for(let n=0;n<cases.length;n++){const file=path.join(dir,n+'.zip');await fs.writeFile(file,zip(cases[n]));await assert.rejects(resolveWorldSource(file,path.join(dir,'cache')));}
  await assert.rejects(fs.access(path.join(dir,'escaped.txt')));
  const imports=await fs.readdir(path.join(dir,'cache','imports'));assert.equal(imports.some(n=>n.startsWith('pending-')),false);
}));
test('corrupt archives fail without publishing an import cache',win,async()=>temporary(async dir=>{
  const file=path.join(dir,'bad.zip');await fs.writeFile(file,'not a zip');await assert.rejects(resolveWorldSource(file,path.join(dir,'cache')));
  assert.deepEqual(await fs.readdir(path.join(dir,'cache','imports')),[]);
}));
