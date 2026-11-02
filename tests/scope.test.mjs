import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { deflateSync } from 'node:zlib';
import { Worker } from 'node:worker_threads';
import { playerPosition,newestPlayer,createRenderScope,containsPoint,intersectsChunk,scopeMask } from '../backend/render-scope.mjs';
import { enhanceFragment } from '../web/visuals.js';

const world={spawn:{x:0,y:80,z:0},dimensions:[{id:'minecraft:overworld'},{id:'minecraft:the_nether'},{id:'minecraft:the_end'}],lastPlayer:{x:8000,y:74,z:-1600,dimension:'minecraft:overworld'},playersByDimension:{}};
test('newest valid player uses saved position, dimension and record time',()=>{
  const a=playerPosition({Pos:[1,70,2],Dimension:'minecraft:overworld'},100,'a');
  const b=playerPosition({Pos:[8,80,9],Dimension:'minecraft:the_nether'},200,'b');
  assert.equal(newestPlayer([null,a,b]),b);assert.equal(playerPosition({Pos:[NaN,1,2],Dimension:'minecraft:overworld'},300,'bad'),null);
});
test('10,000-block diameter means a 5,000-block radius and circle, not a square',()=>{
  const scope=createRenderScope(world,{mode:'player-radius',diameter:10000});
  assert.equal(scope.radius,5000);assert.equal(containsPoint(scope,'minecraft:overworld',13000,-1600),true);
  assert.equal(containsPoint(scope,'minecraft:overworld',13001,-1600),false);
  assert.equal(containsPoint(scope,'minecraft:overworld',12000,2400),false);
  assert.equal(scope.centers['minecraft:the_nether'].x,1000);assert.equal(scope.centers['minecraft:the_nether'].source,'portal-scale');
  assert.match(scopeMask(scope,'minecraft:overworld'),/type: circle.*radius: 5000/);
});
test('scope profiles are stable, validate input, and use spawn when no player exists',()=>{
  const blank={...world,lastPlayer:null};const a=createRenderScope(blank,{mode:'player-radius',diameter:2000});
  assert.equal(a.centers['minecraft:overworld'].source,'spawn');assert.equal(a.playerFound,false);
  const b=createRenderScope({...blank,name:'renamed'},{mode:'player-radius',diameter:2000});assert.equal(a.key,b.key);
  assert.notEqual(a.key,createRenderScope(blank,{mode:'player-radius',diameter:4000}).key);
  assert.throws(()=>createRenderScope(blank,{mode:'player-radius',diameter:0}));
  assert.equal(scopeMask(createRenderScope(blank,{mode:'all'}),'minecraft:overworld'),'');
  assert.equal(containsPoint({mode:'all'},'anything',999999,999999),true);
});
test('chunk boundary intersection handles negative coordinates and circular corners',()=>{
  const s=createRenderScope({...world,lastPlayer:null},{mode:'player-radius',diameter:256});
  assert.equal(intersectsChunk(s,'minecraft:overworld',-8,0),true);
  assert.equal(intersectsChunk(s,'minecraft:overworld',10,10),false);
});
test('lightweight shader patch preserves alpha, is idempotent, and adds no texture samples',()=>{
  const original='uniform float distance; varying vec3 vWorldPosition; void main() { vec4 color=vec4(1.0); gl_FragColor = color; }';
  const patched=enhanceFragment(original);assert.equal(enhanceFragment(patched),patched);
  assert.match(patched,/length\(vWorldPosition.xz - explorerCenter\)/);assert.match(patched,/gl_FragColor = color;/);
  assert.doesNotMatch(patched,/texture2D\(|sampler2D|distance\(/);assert.throws(()=>enhanceFragment('unsupported'));
});
test('index worker skips out-of-radius chunks and regions before parsing their payloads',async()=>{
  const parent=await fs.realpath(os.tmpdir()),dir=await fs.mkdtemp(path.join(parent,'world-explorer-scope-'));
  try{
    const regionDir=path.join(dir,'world','region');await fs.mkdir(regionDir,{recursive:true});
    const bytes=Buffer.alloc(16384),payload=deflateSync(Buffer.from([10,0,0,0]));
    bytes.writeUInt32BE((2<<8)|1,0);bytes.writeUInt32BE(payload.length+1,8192);bytes[8196]=2;payload.copy(bytes,8197);
    // Deliberately corrupt data outside the circle must never be decompressed.
    bytes.writeUInt32BE((3<<8)|1,330*4);bytes.writeUInt32BE(3,12288);bytes[12292]=2;
    await fs.writeFile(path.join(regionDir,'r.0.0.mca'),bytes);
    await fs.writeFile(path.join(regionDir,'r.10000.0.mca'),Buffer.from([1,2,3]));
    const source={...world,id:'fixture',path:path.join(dir,'world'),lastPlayer:null,dimensions:[{id:'minecraft:overworld',path:path.join(dir,'world')}]};source.scope=createRenderScope(source,{mode:'player-radius',diameter:256});
    const result=await new Promise((resolve,reject)=>{let last;const worker=new Worker(new URL('../backend/index-worker.mjs',import.meta.url),{workerData:{world:source,database:path.join(dir,'index.sqlite')}});worker.on('message',s=>last=s);worker.on('error',reject);worker.on('exit',c=>c?reject(Error('Worker exit '+c)):resolve(last));});
    assert.equal(result.phase,'ready');assert.equal(result.total,1);assert.equal(result.changed,1);assert.equal(result.skipped,1);assert.equal(result.errorCount,0);
  }finally{const rel=path.relative(parent,dir);assert.ok(rel.startsWith('world-explorer-scope-')&&!rel.includes(path.sep));await fs.rm(dir,{recursive:true,force:true});}
});
