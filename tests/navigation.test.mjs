import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldResumeWorld } from '../web/navigation.js';
test('root and explicit menu stay at home even with a legacy BlueMap camera hash',()=>{
  for(const url of ['/','/?view=home','/#overworld:10:64:20','/?view=home#overworld:10:64:20'])assert.equal(shouldResumeWorld(url),false,url);
});
test('refreshing an explicit world view can restore it without reopening the save',()=>{
  assert.equal(shouldResumeWorld('/?view=world#overworld:10:64:20'),true);
});
