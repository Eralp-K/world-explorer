import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeViewDistance, viewDistances } from '../web/view-config.js';

test('invalid saved distances fall back to 32 chunks instead of unbounded geometry',()=>{
  for(const value of [undefined,null,'broken',-8,0,33,Infinity,100000]) assert.equal(normalizeViewDistance(value),32);
  assert.equal(normalizeViewDistance('16'),16);
});
test('reducing detail distance also reduces distant terrain loading',()=>{
  assert.deepEqual(viewDistances(32),{chunks:32,hires:512,lowres:1024});
  assert.deepEqual(viewDistances(8),{chunks:8,hires:128,lowres:256});
  assert.equal(viewDistances(64).lowres,1800);
});
