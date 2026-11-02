import test from 'node:test';
import assert from 'node:assert/strict';
import { rows } from '../web/translations.js';
import { LOCALES, LANGUAGE_NAMES, t, setLocale, getLocale, normalizeLocale, formatNumber, dimensionName } from '../web/i18n.js';
import {siteRows,SITE_LOCALES,copyMessages} from '../docs/site-translations.js';

test('eleven language catalogs are complete and preserve every interpolation token',()=>{
  assert.equal(LANGUAGE_NAMES.length,LOCALES.length);
  assert.equal(new Set(LANGUAGE_NAMES).size,LOCALES.length);
  const tokens=value=>[...value.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
  for(const [key,values] of Object.entries(rows)) {
    assert.equal(values.length,LOCALES.length,key);
    for(const value of values){assert.ok(typeof value==='string'&&value.trim(),key);assert.deepEqual(tokens(value),tokens(values[0]),key);}
  }
});

test('Pages installation text and copy feedback cover the same eleven locales as the application',()=>{
  assert.deepEqual(SITE_LOCALES,LOCALES);
  assert.equal(copyMessages.length,LOCALES.length);
  for(const [key,values] of Object.entries(siteRows)){
    assert.equal(values.length,LOCALES.length,key);
    for(const value of values)assert.ok(typeof value==='string'&&value.trim(),key);
  }
  assert.equal(t('folder',{},'pl'),'Otwórz folder świata');
  assert.equal(t('language',{},'pt-BR'),'Idioma');
});
test('regional locales, saved language fallbacks and formatted numbers behave consistently',()=>{
  assert.equal(normalizeLocale('JA_jp'),'ja');assert.equal(normalizeLocale('zh-Hans-CN'),'zh-CN');
  assert.equal(normalizeLocale('en-GB'),'en');assert.equal(normalizeLocale('unsupported'),'tr');
  for(const [input,expected] of [['de-CH','de'],['es-MX','es'],['fr-CA','fr'],['pt_BR','pt-BR'],['pt','pt-BR'],['pl-PL','pl']])assert.equal(normalizeLocale(input),expected);
  assert.equal(LOCALES.length,11);
  for(const locale of ['de','es','fr','pt-BR','pl']){setLocale(locale);assert.equal(getLocale(),locale);assert.equal(formatNumber(12345.5),new Intl.NumberFormat(locale==='pt-BR'?'pt-BR':locale).format(12345.5));}
  setLocale('en');assert.equal(getLocale(),'en');assert.equal(formatNumber(2000),'2,000');
  setLocale('tr');assert.equal(formatNumber(2000),'2.000');
});
test('translations interpolate literal user strings without interpreting replacement syntax',()=>{
  assert.equal(t('startupError',{message:'$& <world>'},'en'),'Could not start: $& <world>');
  assert.equal(t('missing-key',{},'ru'),'missing-key');
  setLocale('ja');assert.equal(dimensionName({id:'minecraft:the_nether'}),'ネザー');
  assert.equal(dimensionName({id:'custom:moon',label:'My Moon'}),'My Moon');setLocale('tr');
});
