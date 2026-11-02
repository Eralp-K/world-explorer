import test from 'node:test';
import assert from 'node:assert/strict';
import {detailBudget,lodTileRadius,installMapBudget,AdaptiveDetail} from '../web/performance.js';
import {shaderProfile,shaderSource,enhanceFragment,WorldVisuals} from '../web/visuals.js';
import {entityAppearance,entityTexture} from '../backend/entity-view.mjs';
import {livingType} from '../web/fauna.js';

test('balanced distance preserves the selected horizon while bounding detailed geometry',()=>{
  assert.deepEqual(detailBudget(64),{selected:64,near:12,hires:192,far:1024,scale:1});
  assert.equal(detailBudget(8).hires,128);assert.equal(detailBudget(32,'full').hires,512);
  assert.equal(detailBudget(64,'balanced',6).hires,96);assert.equal(detailBudget(32,'fast').scale,.75);
});
test('coarser LODs use world-block distances rather than multiplying the horizon',()=>{
  assert.equal(lodTileRadius(1024,192,32,1,0),10);
  assert.equal(lodTileRadius(1024,192,32,5,1),7);
  assert.equal(lodTileRadius(1024,192,32,25,2),2);
  const calls=[];const mgr=()=>({loadAroundTile:(...args)=>calls.push(args)});
  const map={isLoaded:true,data:{lowres:{tileSize:{x:32,z:32},lodFactor:5},hires:{tileSize:{x:32,z:32},translate:{x:2,z:2}}},lowresTileManager:[mgr(),mgr(),mgr()],hiresTileManager:mgr()};
  installMapBudget(map,()=>detailBudget(64));map.loadMapArea(-33,-33);
  assert.deepEqual(calls[0],[-1,-1,2,2]);assert.deepEqual(calls.at(-1),[-2,-2,6,6]);
});
test('adaptive quality decreases only at a bounded interval and can be disabled',()=>{
  const adaptive=new AdaptiveDetail();for(let i=0;i<30;i++)adaptive.sample(i*40,40,true);
  assert.equal(adaptive.cap,10);for(let i=0;i<60;i++)adaptive.sample(1200+i*40,40,true);
  assert.equal(adaptive.cap,10);assert.equal(adaptive.sample(5000,16,false),true);assert.equal(adaptive.cap,12);assert.equal(adaptive.scale,1);
});
test('imported profiles validate format and numeric limits; shader functions cannot replace the pipeline',()=>{
  assert.equal(shaderProfile({format:'world-explorer-shader',version:1,name:'Forest'}).name,'Forest');
  assert.throws(()=>shaderProfile({format:'world-explorer-shader',version:1,fog:NaN}));
  assert.throws(()=>shaderProfile({format:'iris'}));
  const fn='vec3 worldExplorerShader(vec3 c,vec3 p,vec3 n,float t){return c;}';assert.equal(shaderSource(fn),fn);
  for(const bad of ['void main(){}',fn+'\nwhile(true){}',fn+'\n#define nope 1'])assert.throws(()=>shaderSource(bad));
  const fragment='varying vec3 vWorldPosition; void main() { vec4 color=vec4(1.0); gl_FragColor = color; }';
  assert.match(enhanceFragment(fragment,fn),/worldExplorerShader\(color.rgb/);assert.doesNotMatch(enhanceFragment(fragment,fn),/color.a\s*=/);
});
test('entity visual projection preserves saved coordinates and keeps private payload fields out',()=>{
  const entity=entityAppearance({rowid:2,id:'minecraft:cow',x:-3.5,y:64,z:8,payload:JSON.stringify({Rotation:[90,0],Age:-20,CustomName:'Private',Inventory:[{id:'secret'}]})});
  assert.equal(entity.yaw,90);assert.equal(entity.baby,true);assert.equal(entity.x,-3.5);assert.equal(entity.payload,undefined);assert.equal(entity.CustomName,undefined);
  assert.equal(livingType('minecraft:cow'),'cow');assert.equal(livingType('minecraft:chest_minecart'),null);assert.equal(livingType('modded:cow'),null);
  const asset={read:p=>p.endsWith('cow/cow_temperate.png')?Buffer.from([1]):null};assert.ok(entityTexture(asset,'cow'));assert.equal(entityTexture(asset,'../cow'),null);
});

test('changing a custom shader replaces both detailed and already-loaded distant materials',()=>{
  class Vector{set(...values){this.values=values;return this;}}
  const original='varying vec3 vWorldPosition; void main() { vec4 color=vec4(1.0); gl_FragColor = color; }';
  const hi={fragmentShader:original,uniforms:{}},lo={fragmentShader:enhanceFragment(original),uniforms:{}};
  const loader={fragmentShader:original,uniforms:{}};
  const gl={FRAGMENT_SHADER:1,COMPILE_STATUS:2,createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,deleteShader(){}};
  const viewer={data:{uniforms:{}},events:new EventTarget(),camera:{position:{x:0,y:64,z:0}},redraw(){},renderer:{getContext:()=>gl},map:{hiresMaterial:[hi],lowresTileManager:[{tileLoader:loader,scene:{traverse:fn=>fn({material:lo})}}]}};
  const visuals=new WorldVisuals(viewer,{Vector2:Vector,Vector3:Vector,Vector4:Vector});
  const custom='vec3 worldExplorerShader(vec3 c,vec3 p,vec3 n,float t){return c * 0.5;}';
  visuals.apply(null,'minecraft:overworld','custom',{shaderSource:custom});
  assert.ok(hi.fragmentShader.includes(custom));assert.ok(lo.fragmentShader.includes(custom));assert.ok(loader.fragmentShader.includes(custom));
  visuals.apply(null,'minecraft:overworld','soft');
  assert.ok(!hi.fragmentShader.includes(custom));assert.ok(!lo.fragmentShader.includes(custom));assert.equal(lo.fragmentShader.match(/WORLD_EXPLORER_VISUALS/g).length,1);
});
