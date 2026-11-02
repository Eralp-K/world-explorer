import { t, formatNumber as num, dimensionName } from './i18n.js';
const paths = {
  back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  folder:'<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11H3Z"/><path d="M3 8h18"/>',
  archive:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M10 3v3h4v3h-4v3h4v3h-4v3h4"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z M9 3v16 M15 5v16"/>',
  box:'<path d="m12 3 9 5-9 5-9-5Z M3 8v9l9 5 9-5V8 M12 13v9 M7.5 5.5l9 5"/>',
  shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z m-4 9 3 3 5-6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1-1.5 3 M12 17h.01"/>',
  arrow:'<path d="M4 12h16 m-6-6 6 6-6 6"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8Z M2 12l10 5 10-5 M2 16l10 5 10-5"/>',
  slice:'<path d="m3 12 9-6 9 6-9 6Z M3 17l9 6 9-6 M12 2v2"/>',
  refresh:'<path d="M20 10a8 8 0 0 0-14-5L3 8 m0-5v5h5 M4 14a8 8 0 0 0 14 5l3-3 m0 5v-5h-5"/>',
  settings:'<path d="M4 6h16 M4 12h16 M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 1 1 M5 19l1.5-1.5 M17.5 6.5 1-1"/>'
};
export function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.compass}</svg>`; }
export function mountUI() {
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  document.getElementById('render-button').innerHTML=icon('sun')+'<small>'+t('areaTool')+'</small>';
  document.querySelectorAll('[data-help]').forEach(button=>button.onclick=()=>{
    if(document.pointerLockElement)document.exitPointerLock();
    document.getElementById('help-dialog').showModal();
  });
  document.getElementById('close-help').onclick=()=>document.getElementById('help-dialog').close();
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  }));
  document.querySelectorAll('output[data-for]').forEach(output=>{
    const input=document.getElementById(output.dataset.for);
    const update=()=>output.value=input.id==='speed'?t('speedUnit',{count:num(Number(input.value))}):num(Number(input.value))+(input.id==='fov'?'°':input.id==='sprint'?'×':'');
    input.addEventListener('input',update);document.addEventListener('explorer-languagechange',update); update();
  });
  // Reflect panel visibility for keyboard and assistive-technology users.
  const pairs=[['settings-button','settings-panel'],['layers-button','layers-panel'],['cut-button','cut-panel'],['render-button','render-panel']];
  const sync=()=>pairs.forEach(([b,p])=>{
    const button=document.getElementById(b), panel=document.getElementById(p);
    button.setAttribute('aria-controls',p); button.setAttribute('aria-expanded',String(!panel.hidden));
    button.classList.toggle('active',!panel.hidden);
  });
  pairs.forEach(([,p])=>new MutationObserver(sync).observe(document.getElementById(p),{attributes:true,attributeFilter:['hidden']})); sync();
}
export function updateUIStatus(state) {
  const r=state.render||{}, i=state.index||{}, $=id=>document.getElementById(id);
  const busy=['starting','rendering'].includes(r.phase);
  const indexReady=['ready','ready-with-warnings'].includes(i.phase), renderReady=['ready','existing-render'].includes(r.phase);
  $('progress-text').textContent=i.phase==='error'?t('indexError'):indexReady?t('interactions',{count:num(i.objects||0)}):t('indexing');
  $('progress-detail').textContent=indexReady?(i.errorCount?t('warnings',{count:num(i.errorCount)}):t('ready')):`${num(i.done||0)} / ${i.total?num(i.total):'…'}`;
  const percent=Number(r.percent)||0;
  $('progress-fill').style.width=Math.max(0,Math.min(100,indexReady&&renderReady?100:busy?percent:i.total?100*i.done/i.total:0))+'%';
  $('stop-render').hidden=!busy;
  $('stop-render').textContent=t('stop');
  $('progress-phase').textContent=busy?t('busy'):r.phase==='paused'?t('paused'):r.phase==='error'?t('error'):'';
  $('progress').dataset.phase=r.phase||'';
  $('progress').title=r.lastError||r.error||i.error||'';
  if(busy) {
    const dimension=state.world.dimensions.find(d=>d.mapId===r.map||d.id===r.map);
    $('progress-text').textContent=r.phase==='starting'?t('startingRender'):dimension?dimensionName(dimension):r.map||t('processingWorld');
    $('progress-detail').textContent=num(Math.round(percent*10)/10)+'%';
    const message=String(r.message||r.status?.message||'');
    const eta=message.match(/ETA\s*:\s*([^\n)]+)/i)?.[1]?.trim();
    const localized=eta?.replace(/hours?/gi,t('hours')).replace(/minutes?/gi,t('minutes')).replace(/seconds?/gi,t('seconds'));
    $('progress-note').textContent=localized?t('remaining',{time:localized}):t('partialExplore');
  } else if(r.phase==='paused') {
    $('progress-text').textContent=t('stopped');$('progress-detail').textContent=t('changeArea');
    $('progress-fill').style.width=Math.max(0,Math.min(100,Number(r.percent)||0))+'%';
    $('progress-note').textContent=t('pausedHelp');
  }
  else if(r.phase==='error'||i.phase==='error') {
    $('progress-text').textContent=t(r.phase==='error'?'renderError':'indexError');$('progress-detail').textContent=t('checkLog');
    $('progress-note').textContent=t('failed');
  }
  else if(['ready','existing-render'].includes(r.phase)&&['ready','ready-with-warnings'].includes(i.phase)) {
    $('progress-text').textContent=t('exploreReady');
    $('progress-detail').textContent=t('interactions',{count:num(i.objects||0)});
    $('progress-note').textContent=t('updateHelp');
  } else if(r.phase==='not-rendered') {
    $('progress-text').textContent=t(state.availableMaps?.length?'cachedAvailable':'notRendered');
    $('progress-detail').textContent=t(state.availableMaps?.length?'noActiveRender':'waiting');
    $('progress-fill').style.width='0%';
    $('progress-note').textContent=t('applySelected');
  } else $('progress-note').textContent=t('preparingIndex');
}
