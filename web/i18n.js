import { rows } from './translations.js';
import { mountLanguagePicker } from './language-picker.js';

export const LOCALES = Object.freeze(['tr','en','ja','zh-CN','ko','ru']);
export const LANGUAGE_NAMES = Object.freeze(['Türkçe','English','日本語','简体中文','한국어','Русский']);
const formats=['tr-TR','en-US','ja-JP','zh-CN','ko-KR','ru-RU'];
export function normalizeLocale(value) {
  const code=String(value||'').toLowerCase().replaceAll('_','-');
  if(code==='zh'||code==='zh-cn'||code==='zh-hans'||code.startsWith('zh-hans-'))return 'zh-CN';
  return LOCALES.find(locale=>locale===code.split('-')[0])||'tr';
}
let locale='tr';
try { locale=normalizeLocale(globalThis.localStorage?.getItem('explorer-language')); } catch {}
export function getLocale(){return locale;}
export function formatNumber(value){return new Intl.NumberFormat(formats[LOCALES.indexOf(locale)]).format(value);}
export function t(key,values={},language=locale) {
  const entry=rows[key];
  const template=entry?.[LOCALES.indexOf(normalizeLocale(language))]||entry?.[1]||key;
  return template.replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(values,name)?String(values[name]):match);
}
export function dimensionName(dimension) {
  const key={'minecraft:overworld':'overworld','minecraft:the_nether':'nether','minecraft:the_end':'end'}[dimension?.id];
  return key?t(key):dimension?.label||dimension?.id||'';
}
export function kindName(kind) {return t({entity:'entityKind',coordinate:'coordinateKind','block-group':'groupKind',block:'blockKind'}[kind]||kind);}
export function translateError(message,status=400) {
  const key=message==='Wait for indexing/rendering to finish'?'waitJob':[...Object.entries(rows)].find(([,values])=>values[0]===message||values[1]===message)?.[0];
  // Keep unfamiliar diagnostic details intact instead of guessing their meaning.
  return key?t(key):`${t('requestError',{status})} ${t('apiDetail',{message})}`;
}
const textSources=new WeakMap(), attributeSources=new WeakMap();
const languagePickers=[];
const sourceKeys=new Map(Object.entries(rows).flatMap(([key,values])=>values.map(value=>[value,key])));
// Never translate authored world content or renderer/vendor DOM by matching words.
const excluded='#map-container,#app,#recents,#inspect-content,#inspect-title,#inspect-kind,#inspect-position,#world-name,#world-version,#search-results,#toast,#progress-text,#progress-detail,#progress-note,#progress-phase,#stop-render,#scope-center,#scope-size-info,[data-no-i18n],script,style,svg';
export function localize(root=document.body) {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode()) {
    if(node.parentElement?.closest(excluded))continue;
    let source=textSources.get(node);
    if(!source){const key=sourceKeys.get(node.nodeValue.trim());if(!key)continue;source={key,prefix:node.nodeValue.match(/^\s*/)[0],suffix:node.nodeValue.match(/\s*$/)[0]};textSources.set(node,source);}
    node.nodeValue=source.prefix+t(source.key)+source.suffix;
  }
  for(const element of root.querySelectorAll('[title],[placeholder],[aria-label]')) {
    if(element.closest(excluded)||element.hasAttribute('data-language'))continue;
    let sources=attributeSources.get(element);if(!sources){sources={};attributeSources.set(element,sources);}
    for(const attribute of ['title','placeholder','aria-label']) {
      const key=sources[attribute]||sourceKeys.get(element.getAttribute(attribute));if(!key)continue;
      sources[attribute]=key;element.setAttribute(attribute,t(key));
    }
  }
  document.documentElement.lang=locale;
  document.title=t('title');
  document.querySelectorAll('[data-language]').forEach(select=>select.value=locale);
  languagePickers.forEach(picker=>picker.sync(locale,t('language')));
  document.querySelectorAll('#view-distance option').forEach(option=>{
    const chunks=Number(option.value);
    option.textContent=t('chunkOption',{chunks:formatNumber(chunks),blocks:formatNumber(chunks*16)})+(chunks===32?' ('+t('default')+')':'');
  });
}
export function setLocale(value) {
  locale=normalizeLocale(value);
  try{globalThis.localStorage?.setItem('explorer-language',locale);}catch{}
  if(typeof document!=='undefined') {
    localize();
    document.dispatchEvent(new CustomEvent('explorer-languagechange',{detail:{locale}}));
  }
  return locale;
}
export function initI18n() {
  document.querySelectorAll('[data-language]').forEach(select=>{
    select.replaceChildren(...LOCALES.map((code,index)=>{const option=document.createElement('option');option.value=code;option.textContent=LANGUAGE_NAMES[index];option.lang=code;return option;}));
    select.onchange=()=>setLocale(select.value);
    languagePickers.push(mountLanguagePicker(select,setLocale));
  });
  localize();
}
