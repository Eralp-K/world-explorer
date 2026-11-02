import test from 'node:test';
import assert from 'node:assert/strict';
import { rows } from '../web/translations.js';
import { LOCALES, t, setLocale, getLocale, normalizeLocale, formatNumber, dimensionName } from '../web/i18n.js';

test('six language catalogs are complete and preserve every interpolation token',()=>{
  const tokens=value=>[...value.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
  for(const [key,values] of Object.entries(rows)) {
    assert.equal(values.length,LOCALES.length,key);
    for(const value of values){assert.ok(typeof value==='string'&&value.trim(),key);assert.deepEqual(tokens(value),tokens(values[0]),key);}
  }
});
test('regional locales, saved language fallbacks and formatted numbers behave consistently',()=>{
  assert.equal(normalizeLocale('JA_jp'),'ja');assert.equal(normalizeLocale('zh-Hans-CN'),'zh-CN');
  assert.equal(normalizeLocale('en-GB'),'en');assert.equal(normalizeLocale('unsupported'),'tr');
  setLocale('en');assert.equal(getLocale(),'en');assert.equal(formatNumber(2000),'2,000');
  setLocale('tr');assert.equal(formatNumber(2000),'2.000');
});
test('translations interpolate literal user strings without interpreting replacement syntax',()=>{
  assert.equal(t('startupError',{message:'$& <world>'},'en'),'Could not start: $& <world>');
  assert.equal(t('missing-key',{},'ru'),'missing-key');
  setLocale('ja');assert.equal(dimensionName({id:'minecraft:the_nether'}),'ネザー');
  assert.equal(dimensionName({id:'custom:moon',label:'My Moon'}),'My Moon');setLocale('tr');
});
