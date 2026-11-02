import test from 'node:test';
import assert from 'node:assert/strict';
import {flattenNativeModel,modelAppearance} from '../web/native-models.js';
import {entityTexture} from '../backend/entity-view.mjs';

test('baked UV coordinates are preserved exactly instead of inferred from box size',()=>{
  const face=[[0,24,0,.125,.25],[8,24,0,.25,.25],[8,16,0,.25,.5],[0,16,0,.125,.5]];
  const parts=flattenNativeModel({name:'root',pose:[0,0,0,0,0,0,1,1,1],faces:[face],children:[]});
  assert.deepEqual(parts[0].uv,[.125,.75,.25,.75,.25,.5,.125,.75,.25,.5,.125,.5]);
  assert.deepEqual(parts[0].positions.slice(0,9),[-0,0,0,-.5,0,0,-.5,.5,0]);
});
test('native hierarchical rotations and offsets are baked into the rendered geometry',()=>{
  const vertex=[1,0,0,0,0];
  const model={name:'root',pose:[16,0,0,0,0,Math.PI/2,1,1,1],faces:[],children:[{name:'head',pose:[1,0,0,0,0,0,1,1,1],faces:[[vertex,vertex,vertex,vertex]],children:[]}]};
  const point=flattenNativeModel(model)[0].positions;
  assert.ok(Math.abs(point[0]+1)<1e-6);assert.ok(Math.abs(point[1]-1.375)<1e-6);assert.equal(point[2],0);
});
test('baby geometry, cold variants and sheared wool use separate model batches',()=>{
  const models={pig:{},pig_baby:{},cold_pig:{},sheep:{},sheep_wool:{},villager:{}};
  const baby=modelAppearance({id:'minecraft:pig',baby:true},models);assert.equal(baby.key,'pig_baby');assert.equal(baby.scale,1);
  assert.equal(modelAppearance({id:'minecraft:pig',variant:'minecraft:cold'},models).key,'cold_pig');
  assert.equal(modelAppearance({id:'minecraft:sheep',sheared:true},models).wool,false);
  const white=modelAppearance({id:'minecraft:sheep',color:0},models),red=modelAppearance({id:'minecraft:sheep',color:14},models);assert.notEqual(white.batchKey,red.batchKey);
  assert.equal(modelAppearance({id:'modded:pig'},models),null);
});
test('variant and overlay texture requests remain restricted to known installed assets',()=>{
  const paths=[];const assets={read:path=>{paths.push(path);return path.endsWith('pig_cold.png')||path.endsWith('sheep_wool.png')||path.endsWith('librarian.png')?Buffer.from([1]):null;}};
  assert.ok(entityTexture(assets,'pig',{variant:'cold'}));assert.ok(paths[0].endsWith('/pig/pig_cold.png'));
  assert.ok(entityTexture(assets,'sheep',{layer:'wool'}));assert.ok(entityTexture(assets,'villager',{layer:'profession',variant:'librarian'}));
  assert.equal(entityTexture(assets,'villager',{layer:'profession',variant:'../../secret'}),null);
});
