import { SpectatorControls } from './freecam.js';
import { CameraModes } from './camera-modes.js';
import { WorldVisuals, SHADER_PRESETS, shaderProfile, shaderSource, validateShader } from './visuals.js';
import { detailBudget, installMapBudget, AdaptiveDetail } from './performance.js';
import { FaunaLayer, livingType } from './fauna.js';
import { CloudLayer } from './clouds.js';
import { normalizeViewDistance, viewDistances } from './view-config.js';
import { mountUI, updateUIStatus, icon } from './ui.js';
import { initI18n, localize, t, formatNumber as num, dimensionName, kindName, translateError } from './i18n.js';
import { shouldResumeWorld } from './navigation.js';
import { initTheme } from './theme.js';

const $ = id => document.getElementById(id);
let bootstrap, state, app, viewer, controls, activeDim, loading = false, viewerLoading = false, markerGroup, markerMaterials;
let lastMarkers = '', markerBusy = false, inspectBusy = false, toastTimer, searchTimer, availableKey = '', uiTick = 0;
let lastRenderPhase = '', lastTileRetry = 0, polling = false;
let visuals=null, fauna=null, clouds=null, faunaBusy=false, lastFauna='', frameTime=0;
let cameraModes=null;
const adaptive=new AdaptiveDetail();
let settings = { sensitivity: 1, speed: 15, fov: 75, sprint: 4,style:'natural',performanceMode:'balanced',adaptiveDetail:true,mobs:true,idleMobs:true,clouds:true,shaderStrength:1,cameraMode:'free' };
let renderOptions={mode:'player-radius',diameter:10000};
try{renderOptions={...renderOptions,...JSON.parse(localStorage.getItem('explorer-render')||'{}')};}catch{}
try { settings = { ...settings, ...JSON.parse(localStorage.getItem('explorer-camera') || '{}') }; } catch {}
// New preference: old fixed 64-chunk sessions start at the lighter 32 default.
settings.viewChunks = normalizeViewDistance(settings.viewChunks);
settings.cameraMode=settings.cameraMode==='top'?'top':'free';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6500); }
async function api(url, data) {
  const r = await fetch(url, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Explorer-Token': bootstrap.token }, body: JSON.stringify(data) });
  const b = await r.json(); if (!r.ok) throw Error(translateError(b.error || r.statusText,r.status)); return b;
}
function nice(id) { return id.replace(/^minecraft:/, '').split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '); }
function itemName(item) { const id = item.id.replace(':', '.'); return item.name || bootstrap.itemNames['item.' + id] || bootstrap.itemNames['block.' + id] || nice(item.id); }
function pos(p) { return `${Math.floor(p.x)} / ${Math.floor(p.y)} / ${Math.floor(p.z)}`; }
function release() { if (document.pointerLockElement) document.exitPointerLock(); }
function showHome(event) {
  event?.preventDefault();
  try{release();}catch{}
  document.body.classList.remove('ui-hidden','locked');
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  document.querySelectorAll('.floating').forEach(panel=>panel.hidden=true);
  $('search-results').hidden=true;
  $('explorer').hidden=true;$('home').hidden=false;$('home').scrollTop=0;
  history.replaceState(null,'','/?view=home');
  try{sessionStorage.setItem('explorer-stay-home','1');}catch{}
  $('pick-world').focus({preventScroll:true});
}
// Bind menu navigation before bootstrap/viewer initialization can fail.
$('home-button').onclick=showHome;
function saveSettings() { localStorage.setItem('explorer-camera', JSON.stringify(settings)); }
function syncScopeControls() {
  $('scope-limited').checked=$('scope-settings-enabled').checked=renderOptions.mode==='player-radius';
  $('scope-diameter').value=$('scope-settings-diameter').value=renderOptions.diameter;
  $('scope-diameter').disabled=$('scope-settings-diameter').disabled=renderOptions.mode==='all';
  $('scope-size-info').textContent=renderOptions.mode==='all'?t('scopeAll'):t('scopeSummary',{diameter:num(Number(renderOptions.diameter)),radius:num(renderOptions.diameter/2)});
  localStorage.setItem('explorer-render',JSON.stringify(renderOptions));
  document.querySelectorAll('[data-diameter]').forEach(b => { b.textContent=num(Number(b.dataset.diameter)); b.disabled=renderOptions.mode==='all'; b.setAttribute('aria-pressed',String(Number(b.dataset.diameter)===Number(renderOptions.diameter))); });
}
function applyVisuals() {
  if(!viewer?.map||!activeDim)return;
  visuals ||= new WorldVisuals(viewer,window.BlueMap.Three);
  try{visuals.apply(state.world.scope,activeDim.id,settings.style,settings);}
  catch(error){
    console.warn(error);settings.style='natural';settings.shaderSource='';saveSettings();$('visual-style').value='natural';
    visuals.apply(state.world.scope,activeDim.id,'natural',settings);toast(t('shaderFallback'));
  }
  if(!fauna){
    fauna=new FaunaLayer(viewer,window.BlueMap.Three);
    viewer.events.addEventListener('explorerModelsReady',()=>{refreshMarkers(true);refreshFauna(true);});
    viewer.events.addEventListener('explorerModelsError',()=>{$('fauna-status').textContent=t('modelUnavailable');refreshMarkers(true);});
  }
  clouds ||= new CloudLayer(viewer,window.BlueMap.Three);
  fauna.configure(settings.mobs&&$('entities').checked,settings.idleMobs);
  clouds.configure(settings.clouds&&settings.cameraMode!=='top',activeDim.id);
  viewer.data.uniforms.ambientLight.value=settings.style==='soft'?0.6:0.8;
  applyResolution();
  const c=state.world.scope?.centers?.[activeDim.id];
  $('scope-center').textContent=c?t('center',{position:`${Math.round(c.x)} / ${Math.round(c.y)} / ${Math.round(c.z)}`,source:t(c.source==='player'?'playerRecord':c.source==='portal-scale'?'portalScale':'spawn'),area:state.world.scope.mode==='player-radius'?t('areaDiameter',{count:num(state.world.scope.diameter)}):t('allWorld')}):'';
}
function insideScope(p) {const s=state?.world?.scope;if(!s||s.mode==='all')return true;const c=s.centers[activeDim.id];return c&&(p.x-c.x)**2+(p.z-c.z)**2<=s.radius**2;}
function renderRecents() {
  $('recent-count').textContent = String(bootstrap.recents.length).padStart(2, '0');
  $('recents').replaceChildren();
  for (const r of bootstrap.recents) {
    const b = document.createElement('button'); b.className = 'recent';
    b.innerHTML = `<span class="world-icon">${icon(r.sourceType === 'zip' ? 'archive' : 'map')}</span><span class="recent-info"><strong>${esc(r.name)}</strong><small>JAVA ${esc(r.version)} · ${t(r.sourceType === 'zip' ? 'archiveType' : 'localType')}</small></span><span class="arrow">${icon('arrow')}</span>`;
    b.title = r.path; b.onclick = () => open(r.path); $('recents').append(b);
  }
  if (!bootstrap.recents.length) {const p=document.createElement('p');p.className='quiet';p.textContent=t('emptyRecents');$('recents').append(p);}
}
async function open(path) {
  if (loading || !path) return; loading = true;
  for (const b of document.querySelectorAll('#home button')) b.disabled = true;
  const button = $('pick-world'); const label = button.innerHTML; button.textContent = t(/\.zip$/i.test(path) ? 'openingZip' : 'openingWorld');
  try {
    state = await api('/api/world/open', { path,scope:renderOptions });sessionStorage.removeItem('explorer-stay-home');await showOpenedWorld();
    bootstrap = { ...bootstrap, recents: (await api('/api/bootstrap')).recents }; renderRecents();
  } catch (e) { toast(e.message); }
  finally { loading = false; button.innerHTML = label; for (const b of document.querySelectorAll('#home button')) b.disabled = false; syncScopeControls(); localize(); }
}
async function showOpenedWorld() {
  activeDim=state.world.dimensions.find(d=>d.id===state.world.lastPlayer?.dimension)||state.world.dimensions[0];availableKey='';
  $('home').hidden=true;$('explorer').hidden=false;$('search').value='';$('search-results').hidden=true;
  history.replaceState(null,'','/?view=world'+location.hash);
  $('world-name').textContent=state.world.name;$('world-version').textContent='JAVA '+state.world.version;
  $('dimension').innerHTML=state.world.dimensions.map(d=>`<option value="${esc(d.id)}">${esc(dimensionName(d))}</option>`).join('');$('dimension').value=activeDim.id;
  if(app){viewer.clearTileCache();app.settings=null;await app.load();}
  await updateState();
}
async function initViewer() {
  if (viewerLoading) return; viewerLoading = true;
  try {
    if (!window.bluemap) {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/vendor/assets/index-C6zAnFcX.css'; // BlueMap's app styles are kept but its UI is hidden.
      // The renderer bundle itself exposes window.BlueMap and window.bluemap.
      await import('/vendor/assets/index-CiYMyZas.js');
      const deadline = Date.now() + 20000;
      while (!window.bluemap?.mapViewer?.map?.isLoaded && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
      if (!window.bluemap?.mapViewer?.map?.isLoaded) throw Error(t('viewerError'));
    }
    app = window.bluemap; viewer = app.mapViewer;
    app.initEventSource = () => {}; // Static read-only snapshots need no server-player polling.
    app.appState.controls.pauseTileLoading = false;
    viewer.events.addEventListener('bluemapMapInteraction',event=>{
      if(settings.cameraMode==='top'&&!$('explorer').hidden&&!event.detail.data.doubleTap)inspect(event.detail.ray);
    });
    const ready=state.availableMaps.includes(activeDim.mapId)?activeDim:state.world.dimensions.find(d=>state.availableMaps.includes(d.mapId));
    if(ready)await enterDimension(ready);
  } finally { viewerLoading = false; }
}
function attachControls() {
  const cm = viewer.controlsManager;
  if (controls) controls.stop();
  controls = new SpectatorControls(viewer.renderer.domElement, settings, inspect, toast);
  cm.controls = controls; cm.distance = 0; cm.ortho = 0; cm.angle = Math.PI / 2; cm.tilt = 0;
  app.appState.controls.state = 'free'; viewer.camera.fov = settings.fov;
  app.mapControls.minDistance=16;app.mapControls.maxDistance=Math.max(64,Math.min(2048,settings.viewChunks*16));
  cameraModes=new CameraModes(app,controls);
  try{cameraModes.select(settings.cameraMode);}catch{settings.cameraMode='free';saveSettings();toast(t('mapViewUnavailable'));}
  syncCameraModeUI();
  applyViewDistance();
}
function syncCameraModeUI(){
  document.body.classList.toggle('map-view',settings.cameraMode==='top');
  for(const button of document.querySelectorAll('[data-camera-mode]'))button.setAttribute('aria-pressed',String(button.dataset.cameraMode===settings.cameraMode));
  $('map-hint').textContent=t('mapHint');
}
function changeCameraMode(mode){
  if(!viewer?.map||!cameraModes)return toast(t('waitRender'));
  release();
  try{cameraModes.select(mode);settings.cameraMode=cameraModes.mode;saveSettings();syncCameraModeUI();applyVisuals();applyViewDistance();refreshMarkers(true);refreshFauna(true);}
  catch(error){toast(t(error.message));}
}
function currentBudget(){return detailBudget(settings.viewChunks,settings.performanceMode,adaptive.cap);}
function applyResolution(){if(!viewer)return;const ratio=Math.min(1,1/window.devicePixelRatio)*currentBudget().scale*adaptive.scale;if(Math.abs(viewer.superSampling-ratio)>.01)viewer.superSampling=ratio;}
function applyViewDistance() {
  const distance=viewDistances(settings.viewChunks);
  $('view-distance').value=String(distance.chunks);
  const budget=currentBudget();
  $('view-distance-info').textContent=t('detailInfo',{near:budget.near,far:budget.selected});
  $('distance-badge').textContent=t('chunkCount',{count:distance.chunks});
  $('speed-hud').textContent=t('speedUnit',{count:num(Math.round(settings.speed))});
  $('fly-hint').title=t('detailInfo',{near:budget.near,far:budget.selected});
  if(!viewer?.map)return;
  if(app?.mapControls)app.mapControls.maxDistance=Math.max(64,Math.min(2048,distance.hires));
  const p=viewer.controlsManager.position;
  installMapBudget(viewer.map,currentBudget);
  viewer.loadMapArea(p.x,p.z,budget.hires,budget.far);applyResolution();
}
async function enterDimension(d) {
  release();
  if (!state.availableMaps.includes(d.mapId)) { $('dimension').value = activeDim.id; toast(t('waitingDimension',{name:dimensionName(d)})); return; }
  activeDim = d; $('dimension').value = d.id; clearMarkers();fauna?.clear();lastFauna='';
  if (!app.mapsMap.has(d.mapId)) { app.settings = null; await app.load(); }
  await app.switchMap(d.mapId, false);
  const spawn = state.world.scope?.centers?.[d.id] || (d.id === 'minecraft:overworld' ? state.world.spawn : { x: 0, y: d.id === 'minecraft:the_nether' ? 70 : 80, z: 0 });
  viewer.controlsManager.position.set(spawn.x, spawn.y + 3, spawn.z);
  attachControls();
  applyViewDistance();
  viewer.data.uniforms.ambientLight.value = 0.8;
  patchCutaway();applyVisuals(); applyLayers(); await refreshMarkers(true);await refreshFauna(true);
}
async function updateState() {
  if (!state?.world) return;
  state = await api('/api/world');
  const i = state.index, r = state.render;
  const indexReady = ['ready', 'ready-with-warnings'].includes(i.phase);
  updateUIStatus(state);
  if (i.phase === 'error') $('progress').title = i.error || '';
  const key = state.world.id + ':' +(state.world.scope?.key||'all')+ ':' + state.availableMaps.join(',');
  if (state.availableMaps.length && !app && !viewerLoading) await initViewer();
  else if (app && key !== availableKey && !viewerLoading && !loading) {
    const previous = viewer.controlsManager.position.clone();
    app.settings = null; await app.load();
    if (state.availableMaps.includes(activeDim.mapId)) { await app.switchMap(activeDim.mapId, false); attachControls(); viewer.controlsManager.position.copy(previous); patchCutaway();applyVisuals(); }
  }
  if (viewer?.map) {
    const managers = [viewer.map.hiresTileManager, ...(viewer.map.lowresTileManager || [])];
    if (r.phase === 'ready' && ['starting','rendering'].includes(lastRenderPhase)) {
      viewer.clearTileCache(); for (const m of managers) m?.removeAllTiles(); viewer.updateLoadedMapArea();
    } else if (['starting','rendering'].includes(r.phase) && Date.now() - lastTileRetry > 6000) {
      // Retry tiles that did not exist yet when a partial render was opened.
      for (const m of managers) for (const [key, tile] of m?.tiles || []) if (tile.unloaded && !tile.loading) m.tiles.delete(key);
      viewer.updateLoadedMapArea(); lastTileRetry = Date.now();
    }
  }
  lastRenderPhase = r.phase;
  availableKey = key;
  refreshDimensionLabels();
  if (app && indexReady) {refreshMarkers();refreshFauna();}
}
function refreshDimensionLabels(){
  for(const option of $('dimension').options){const d=state?.world?.dimensions.find(d=>d.id===option.value);if(d)option.textContent=dimensionName(d)+(state.availableMaps.includes(d.mapId)?'':' · '+t('renderWaiting'));}
}
const patched = new WeakSet(), cutUniform = { value: 100000 };
function patchCutaway() {
  const map = viewer?.map; if (!map) return;
  for (const m of map.hiresMaterial || []) if (!patched.has(m)) {
    m.uniforms.explorerCut = cutUniform;
    m.fragmentShader = 'uniform float explorerCut;\n' + m.fragmentShader.replace('void main() {', 'void main() {\n if (vWorldPosition.y > explorerCut + 1.001) discard;');
    m.needsUpdate = true; patched.add(m);
  }
  cutUniform.value = $('cut-enabled').checked ? Number($('cut-y').value) : 100000;
  $('cut-value').textContent = $('cut-y').value;
  applyLayers();
}
function applyLayers() {
  if (!viewer?.map) return;
  const map = viewer.map, show = $('terrain').checked;
  if (map.hiresTileManager) map.hiresTileManager.scene.visible = show;
  for (const lod of map.lowresTileManager || []) lod.scene.visible = show && !$('cut-enabled').checked;
  for (const sprite of markerGroup?.children || []) sprite.visible = markerVisible(sprite.userData.record);
  fauna?.configure(settings.mobs&&$('entities').checked,settings.idleMobs);
}
function markerVisible(r) { return insideScope(r)&&(r.kind === 'entity' ? $('entities').checked : /sign/.test(r.id) ? $('signs').checked : $('containers').checked); }
function clearMarkers() {
  if (markerGroup) { markerGroup.parent?.remove(markerGroup); markerGroup.clear(); markerGroup = null; }
  if (markerMaterials) { for (const m of Object.values(markerMaterials)) { m.map?.dispose(); m.dispose(); } markerMaterials = null; }
  lastMarkers = '';
}
async function refreshMarkers(force = false) {
  if (!viewer?.map || markerBusy || !activeDim) return;
  const p = viewer.controlsManager.position, key = state.world.id + activeDim.id + ':' + Math.floor(p.x / 32) + ':' + Math.floor(p.z / 32) + ':' + Math.floor((state.index.done || 0) / 200);
  if (!force && lastMarkers === key) return;
  markerBusy = true; const dim = activeDim.id;
  try {
    const data = await api(`/api/markers?dimension=${encodeURIComponent(dim)}&x=${p.x}&z=${p.z}`);
    if (activeDim.id !== dim) return; clearMarkers(); lastMarkers = key;
    const T = window.BlueMap.Three; markerGroup = new T.Group(); markerMaterials = {};
    for (const [name, color, symbol] of [['entity', '#8ccaf2', '◇'], ['container', '#f3ce83', '▣'], ['sign', '#bcdfa0', '≡']]) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#14251ce0'; ctx.beginPath(); ctx.arc(32, 32, 24, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = color; ctx.font = 'bold 33px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(symbol, 32, 31);
      markerMaterials[name] = new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), depthTest: true, transparent: true });
    }
    for (const r of data.results) {
      if(settings.mobs&&r.kind==='entity'&&fauna?.hasModel(r))continue;
      const name = r.kind === 'entity' ? 'entity' : /sign/.test(r.id) ? 'sign' : 'container';
      const sprite = new T.Sprite(markerMaterials[name]); sprite.position.set(r.x + (r.kind === 'entity' ? 0 : 0.5), r.y + 1.2, r.z + (r.kind === 'entity' ? 0 : 0.5));
      sprite.scale.setScalar(0.65); sprite.userData.record = r; sprite.visible = markerVisible(r); markerGroup.add(sprite);
    }
    viewer.markers.add(markerGroup);
  } catch (e) { console.warn(e); } finally { markerBusy = false; }
}
async function refreshFauna(force=false){
  if(!viewer?.map||!fauna||faunaBusy||!settings.mobs||!$('entities').checked)return;
  const p=viewer.controlsManager.position,dim=activeDim.id,worldId=state.world.id;
  const key=worldId+dim+':'+Math.floor(p.x/16)+':'+Math.floor(p.y/16)+':'+Math.floor(p.z/16)+':'+Math.floor((state.index.done||0)/200);
  if(!force&&lastFauna===key)return;faunaBusy=true;
  try{const result=await api(`/api/entities/near?dimension=${encodeURIComponent(dim)}&x=${p.x}&y=${p.y}&z=${p.z}`);
    if(state.world.id!==worldId||activeDim.id!==dim)return;
    const records=result.results.filter(insideScope);fauna.setRecords(records);lastFauna=key;
    $('fauna-status').textContent=fauna.models?t('faunaCount',{count:fauna.modelCount}):t(fauna.error?'modelUnavailable':'modelLoading');
  }catch(e){console.warn(e);}finally{faunaBusy=false;}
}
function centerHit(screenRay=null) {
  if (!viewer?.map) return null;
  const T = window.BlueMap.Three, ray = new T.Raycaster();
  if(screenRay){ray.ray.copy(screenRay);ray.camera=viewer.camera;}else ray.setFromCamera(new T.Vector2(0, 0), viewer.camera);
  ray.far=settings.cameraMode==='top'?Math.min(8000,viewer.controlsManager.distance+1200):128;
  const scene = viewer.map.hiresTileManager.scene; scene.position.x = 0; scene.position.z = 0; scene.updateMatrixWorld(true);
  const objects = $('terrain').checked ? [scene] : [];
  if (markerGroup) { markerGroup.updateMatrixWorld(true); objects.push(markerGroup); }
  const hits = ray.intersectObjects(objects, true);
  const mobHit=fauna?.hit(ray);if(mobHit)hits.push(mobHit);hits.sort((a,b)=>a.distance-b.distance);
  for (const hit of hits) {
    if (hit.object.visible === false) continue;
    if(hit.record){if(insideScope(hit.record))return {record:hit.record};continue;}
    if (hit.object.userData.record) { if (markerVisible(hit.object.userData.record)) return { record: hit.object.userData.record }; continue; }
    if ($('cut-enabled').checked && hit.point.y > Number($('cut-y').value) + 1.001) continue;
    const p = hit.point.clone().addScaledVector(ray.ray.direction, 0.025);
    if(!insideScope(p))continue;
    return { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
  }
  return null;
}
async function inspect(screenRay=null) {
  if (inspectBusy) return; const hit = centerHit(screenRay);
  if (!hit) { toast(t('noBlock')); return; }
  inspectBusy = true;
  try {
    if (hit.record?.kind === 'entity') await showEntity(hit.record.rowid);
    else { const p = hit.record || hit; const b = await api(`/api/block?dimension=${encodeURIComponent(activeDim.id)}&x=${p.x}&y=${p.y}&z=${p.z}`); showBlock(b); }
  } catch (e) { toast(e.message); } finally { inspectBusy = false; }
}
function dialog(title, kind, p) {
  release(); $('inspect-title').textContent = title; $('inspect-kind').textContent = kind; $('inspect-position').textContent = pos(p);
  $('inspect-content').replaceChildren(); if (!$('inspection').open) $('inspection').showModal();
}
function rawDetails(data) {
  const d = document.createElement('details'); const summary=document.createElement('summary');summary.textContent=t('raw');d.append(summary); const pre = document.createElement('pre'); pre.className = 'nbt-data'; pre.textContent = JSON.stringify(data, null, 2); d.append(pre); return d;
}
function showBlock(b) {
  dialog(b.title ? nice(b.title) : nice(b.id), b.id, b); const content = $('inspect-content');
  if (b.inventory) {
    if (b.lootTable) { const p = document.createElement('p'); p.className = 'quiet'; p.textContent = t('loot',{table:b.lootTable}); content.append(p); }
    const grid = document.createElement('div'); grid.className = 'inventory';
    const detail = document.createElement('div'); detail.className = 'item-detail'; detail.textContent = t('inventoryHelp',{count:b.slots});
    const items = new Map(b.inventory.map(i => [i.slot, i]));
    for (let i = 0; i < b.slots; i++) {
      const slot = document.createElement('button'); slot.className = 'slot'; const item = items.get(i);
      if (item) {
        slot.classList.add('filled'); slot.title = itemName(item) + ' ×' + item.count; slot.setAttribute('aria-label', slot.title);
        const img = document.createElement('img'); img.src = '/api/icon/' + item.id; img.alt = itemName(item);
        img.onerror = () => { const f = document.createElement('span'); f.className = 'fallback-icon'; f.textContent = nice(item.id); img.replaceWith(f); }; slot.append(img);
        const count = document.createElement('span'); count.className = 'count'; count.textContent = item.count > 1 ? item.count : ''; slot.append(count);
        const show = () => {
          detail.hidden = false; detail.innerHTML = `<h3>${esc(itemName(item))} <small>×${item.count}</small></h3><small>${esc(item.id)}</small>`;
          const pre = document.createElement('pre'); pre.textContent = JSON.stringify(item.components, null, 2); detail.append(pre);
        };
        slot.onmouseenter = show; slot.onfocus = show; slot.onclick = async () => { show(); const book = await api('/api/book', { item: item.raw }).catch(() => null); if (book) { content.replaceChildren(); renderBook(content, book); } };
      } else { slot.setAttribute('aria-label', t('emptySlot',{count:i+1})); }
      grid.append(slot);
    }
    const layout = document.createElement('div'); layout.className = 'inventory-layout'; layout.append(grid, detail); content.append(layout);
    const note = document.createElement('p'); note.className = 'quiet'; note.textContent = b.doubleChest ? t('doubleChest') : t('inventoryHelp',{count:b.slots}); content.append(note);
  }
  if (b.sign) { const faces = document.createElement('div'); faces.className = 'sign-faces'; content.append(faces); for (const [name, lines] of [[t('signFront'), b.sign.front], [t('signBack'), b.sign.back]]) {
    if (!lines.some(Boolean)) continue; const label = document.createElement('p'); label.className = 'quiet'; label.textContent = name;
    const sign = document.createElement('div'); sign.className = 'sign-text'; sign.textContent = lines.join('\n'); const face = document.createElement('section'); face.className = 'sign-face'; face.append(label, sign); faces.append(face);
  }}
  if (b.book) renderBook(content, b.book);
  if (Object.keys(b.properties || {}).length) { const pre = document.createElement('pre'); pre.className = 'nbt-data'; pre.textContent = JSON.stringify(b.properties, null, 2); content.append(pre); }
  if (b.blockEntity) content.append(rawDetails(b.blockEntity));
}
function renderBook(content, book) {
  let index = 0; const title = document.createElement('p'); title.textContent = `${book.title}${book.author ? ' · ' + book.author : ''}`;
  const page = document.createElement('div'); page.className = 'book-page'; const nav = document.createElement('div'); nav.className = 'book-controls';
  const prev = document.createElement('button'), next = document.createElement('button'), count = document.createElement('span'); prev.textContent = t('previous'); next.textContent = t('next');
  function draw() { page.textContent = book.pages[index]; count.textContent = `${index + 1} / ${book.pages.length}`; prev.disabled = index === 0; next.disabled = index === book.pages.length - 1; }
  prev.onclick = () => { index--; draw(); }; next.onclick = () => { index++; draw(); }; nav.append(prev, count, next); content.append(title, page, nav); draw();
}
async function showEntity(id) {
  const e = await api('/api/entity?id=' + id); dialog(nice(e.id), t('entitySaved'), e);
  const c = e.payload, content = $('inspect-content');
  for (const [label, value] of [[t('type'), e.id], [t('name'), textComponent(c.CustomName || c.custom_name)], [t('profession'), c.VillagerData?.profession], [t('level'), c.VillagerData?.level], [t('health'), c.Health], [t('heldItem'), c.Item?.id || c.item?.id]]) if (value !== undefined && value !== '') {
    const row = document.createElement('div'); row.className = 'info-row'; row.innerHTML = `<span>${esc(label)}</span><span>${esc(value)}</span>`; content.append(row);
  }
  if (c.Offers?.Recipes) for (const trade of c.Offers.Recipes) { const p = document.createElement('p'); p.textContent = `${nice(trade.buy?.id || '?')} ×${trade.buy?.count ?? trade.buy?.Count ?? 1} → ${nice(trade.sell?.id || '?')} ×${trade.sell?.count ?? trade.sell?.Count ?? 1}`; content.append(p); }
  content.append(rawDetails(c));
}
function textComponent(c) { if (c == null) return ''; if (typeof c === 'string') { try { return textComponent(JSON.parse(c)); } catch { return c; } } if (Array.isArray(c)) return c.map(textComponent).join(''); return (c.text || c.translate || '') + textComponent(c.extra); }
let searchGeneration = 0;
async function search() {
  const q = $('search').value.trim(), generation = ++searchGeneration;
  if (!q || !state?.world) { $('search-results').hidden = true; return; }
  try {
    const data = await api(`/api/search?dimension=${encodeURIComponent(activeDim.id)}&q=${encodeURIComponent(q)}`);
    if (generation !== searchGeneration) return;
    const list = $('search-results'); list.replaceChildren(); list.hidden = false;
    for (const r of data.results) {
      const button = document.createElement('button'); button.innerHTML = `<span class="result-name">${esc(nice(r.id))}<small>${esc(kindName(r.kind))}${r.count ? esc(t('sectionBlocks',{count:num(r.count)})) : ''}</small></span><small>${pos(r)}</small>`;
      button.onclick = () => { if (!viewer) return toast(t('waitRender')); const cm = viewer.controlsManager; cm.position.set(r.x + 0.5, r.y + 1.5, r.z + 3.5); cm.rotation = 0; cm.angle = settings.cameraMode==='top'?0:Math.PI / 2; list.hidden = true; refreshMarkers(true); };
      list.append(button);
    }
    if (!data.results.length) { const p = document.createElement('p'); p.textContent = t(data.indexing ? 'indexingResults' : 'noResults'); list.append(p); }
    if (data.results.length >= 80) { const p = document.createElement('p'); p.textContent = t('first80'); list.append(p); }
  } catch (e) { toast(e.message); }
}
function hudLoop(now) {
  if(viewer&&!$('explorer').hidden&&!document.hidden){
    if(frameTime&&adaptive.sample(now,now-frameTime,settings.adaptiveDetail&&settings.performanceMode!=='full'))applyViewDistance();
    clouds?.update(now);fauna?.update(now,$('cut-enabled').checked?Number($('cut-y').value):Infinity);
  }frameTime=now;
  if (viewer && !$('explorer').hidden && now - uiTick > 160) {
    const cm = viewer.controlsManager; $('coords').textContent = `X ${Math.floor(cm.position.x)} · Y ${Math.floor(cm.position.y)} · Z ${Math.floor(cm.position.z)}`;
    $('speed-hud').textContent = t('speedUnit',{count:num(Math.round(settings.speed))});
    $('fps').textContent = Math.round(1000 / cm.averageDeltaTime) + ' FPS'; uiTick = now;
  }
  requestAnimationFrame(hudLoop);
}

try {
  initI18n();
  initTheme();
  bootstrap = await api('/api/bootstrap'); renderRecents();
  $('clear-recents').onclick=async()=>{try{const result=await api('/api/recents/clear',{});bootstrap.recents=result.recents;renderRecents();}catch(e){toast(e.message);}};
  const stopButton=document.createElement('button');stopButton.id='stop-render';stopButton.textContent=t('stop');$('progress').append(stopButton);
  stopButton.onclick=async()=>{stopButton.disabled=true;try{state=await api('/api/render/stop',{});await updateState();toast(t('stopped'));}catch(e){toast(e.message);}finally{stopButton.disabled=false;}};
  syncScopeControls();
  for(const id of ['scope-limited','scope-settings-enabled'])$(id).onchange=()=>{renderOptions.mode=$(id).checked?'player-radius':'all';syncScopeControls();};
  for(const id of ['scope-diameter','scope-settings-diameter'])$(id).onchange=()=>{renderOptions.diameter=Number($(id).value);syncScopeControls();};
  if(!SHADER_PRESETS[settings.style]&&settings.style!=='custom')settings.style='natural';
  if(settings.shaderSource){try{shaderSource(settings.shaderSource);}catch{settings.shaderSource='';settings.style='natural';}}
  $('visual-style').value=settings.style;
  $('visual-style').onchange=()=>{settings.style=$('visual-style').value;saveSettings();applyVisuals();};
  $('shader-strength').value=String(settings.shaderStrength);$('shader-strength-value').textContent=Math.round(settings.shaderStrength*100)+'%';
  $('shader-strength').oninput=()=>{settings.shaderStrength=Number($('shader-strength').value);$('shader-strength-value').textContent=Math.round(settings.shaderStrength*100)+'%';saveSettings();applyVisuals();};
  $('shader-import').onclick=()=> $('shader-file').click();
  $('shader-file').onchange=async()=>{
    const file=$('shader-file').files?.[0];if(!file)return;
    try{
      if(file.size>16384)throw Error(t('shaderSize'));
      const source=await file.text();let next;
      if(/\.json$/i.test(file.name))next={shaderProfile:shaderProfile(JSON.parse(source)),shaderSource:'',shaderName:file.name};
      else if(/\.(glsl|frag)$/i.test(file.name)){shaderSource(source);const gl=viewer?.renderer.getContext()||document.createElement('canvas').getContext('webgl2');if(!gl)throw Error(t('viewerError'));validateShader(gl,source);next={shaderSource:source,shaderProfile:SHADER_PRESETS.natural,shaderName:file.name};}
      else throw Error(t('shaderCompatibility'));
      settings={...settings,...next,style:'custom'};$('visual-style').value='custom';saveSettings();applyVisuals();$('shader-name').textContent=file.name;toast(t('shaderLoaded'));
    }catch(e){toast(['shaderFormat','shaderRange','shaderContract'].includes(e.message)?t(e.message):e.message);}
    finally{$('shader-file').value='';}
  };
  $('shader-name').textContent=settings.shaderName||'';
  $('performance-mode').value=settings.performanceMode;
  $('performance-mode').onchange=()=>{settings.performanceMode=$('performance-mode').value;adaptive.cap=12;adaptive.scale=1;saveSettings();applyViewDistance();};
  for(const [id,key] of [['adaptive-detail','adaptiveDetail'],['show-mobs','mobs'],['idle-mobs','idleMobs'],['show-clouds','clouds']]){
    $(id).checked=settings[key];$(id).onchange=()=>{settings[key]=$(id).checked;saveSettings();applyViewDistance();applyVisuals();refreshMarkers(true);refreshFauna(true);};
  }
  $('scope-apply').onclick=async()=>{if(!state?.world)return;release();await open(state.world.sourcePath||state.world.path);$('render-panel').hidden=true;};
  const visualButton=document.createElement('button');visualButton.id='render-button';visualButton.title=t('areaTitle');visualButton.innerHTML=icon('sun')+'<small>'+t('areaTool')+'</small>';$('tools').append(visualButton);
  applyViewDistance();
  $('view-distance').onchange=()=>{settings.viewChunks=normalizeViewDistance($('view-distance').value);saveSettings();applyViewDistance();toast(t('viewApplied',{count:settings.viewChunks}));};
  document.querySelectorAll('[data-diameter]').forEach(b=>b.onclick=()=>{renderOptions.diameter=Number(b.dataset.diameter);syncScopeControls();});
  visualButton.onclick=()=>{const show=$('render-panel').hidden;document.querySelectorAll('.floating').forEach(p=>p.hidden=true);$('render-panel').hidden=!show;};
  for (const key of ['sensitivity', 'fov', 'speed', 'sprint']) { $(key).value = settings[key]; $(key).oninput = () => { settings[key] = Number($(key).value); if (viewer) viewer.camera.fov = settings.fov; saveSettings(); }; }
  mountUI();
  for(const button of document.querySelectorAll('[data-camera-mode]'))button.onclick=()=>changeCameraMode(button.dataset.cameraMode);
  syncCameraModeUI();
  document.addEventListener('explorer-languagechange',()=>{
    syncScopeControls();applyViewDistance();renderRecents();refreshDimensionLabels();
    syncCameraModeUI();
    if(state?.world){updateUIStatus(state);applyVisuals();}
    stopButton.textContent=t('stop');visualButton.title=t('areaTitle');visualButton.innerHTML=icon('sun')+'<small>'+t('areaTool')+'</small>';
    // User-authored inspection content is left intact; reopen it in the selected language.
    if($('inspection').open)$('inspection').close();
    $('search-results').hidden=true;$('toast').hidden=true;
  });
  async function pick(kind) {
    const buttons = [$('pick-world'), $('pick-zip')]; buttons.forEach(b => b.disabled = true);
    try { const result = await api(kind === 'zip' ? '/api/pick-zip' : '/api/pick-folder', {}); if (result.path) { $('world-path').value = result.path; await open(result.path); } }
    catch (e) { toast(e.message); } finally { buttons.forEach(b => b.disabled = false); }
  }
  $('pick-world').onclick = () => pick('folder'); $('pick-zip').onclick = () => pick('zip');
  $('open-path').onclick = () => open($('world-path').value); $('world-path').onkeydown = e => { if (e.key === 'Enter') open(e.target.value); };
  $('home-button').onclick = showHome;
  $('dimension').onchange = async e => { try { await enterDimension(state.world.dimensions.find(d => d.id === e.target.value)); } catch (err) { toast(err.message); } };
  for (const [button, panel] of [['settings-button','settings-panel'],['layers-button','layers-panel'],['cut-button','cut-panel']]) $(button).onclick = () => { const show = $(panel).hidden; document.querySelectorAll('.floating').forEach(p => p.hidden = true); $(panel).hidden = !show; };
  document.querySelectorAll('.close-panel').forEach(b => b.onclick = () => b.closest('aside').hidden = true);
  for (const key of ['terrain','containers','entities','signs']) $(key).onchange = applyLayers;
  $('cut-enabled').onchange = patchCutaway; $('cut-y').oninput = patchCutaway;
  $('update-button').onclick = async () => { try { state = await api('/api/update', {}); toast(t('updating')); } catch (e) { toast(e.message); } };
  $('close-inspection').onclick = () => $('inspection').close();
  $('search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(search, 220); };
  $('search').onkeydown = e => { if (e.key === 'Escape') { $('search-results').hidden = true; e.target.blur(); } };
  document.addEventListener('keydown', e => {
    if (e.code === 'F1') { e.preventDefault(); document.body.classList.toggle('ui-hidden'); }
    if (e.key === '/' && !['INPUT','TEXTAREA'].includes(e.target.tagName) && !document.pointerLockElement && !$('explorer').hidden) { e.preventDefault(); $('search').focus(); }
  });
  setInterval(async () => { if (polling || loading) return; polling = true; try { await updateState(); } catch (e) { console.warn(e); } finally { polling = false; } }, 1800);
  setInterval(() => { if (!$('explorer').hidden) {refreshMarkers();refreshFauna();} }, 2500);
  requestAnimationFrame(hudLoop);
  // Refresh the viewer without POSTing world/open, which would interrupt an active render.
  const existing=await api('/api/world');
  if(existing.world&&shouldResumeWorld(location.href)){state=existing;renderOptions={mode:state.world.scope?.mode||'all',diameter:state.world.scope?.diameter||10000};syncScopeControls();await showOpenedWorld();}
} catch (e) { toast(t('startupError',{message:e.message})); }
