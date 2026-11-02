import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import fs from 'node:fs/promises';
const local = JSON.parse(await fs.readFile(new URL('../local.config.json', import.meta.url), 'utf8').catch(() => '{}'));
const hasClientAssets = Boolean(local.clientJar && await fs.access(local.clientJar).then(() => true, () => false));
process.env.EXPLORER_NO_LISTEN = '1';
const { handler, cleanup } = await import('../backend/server.mjs');
class Response extends Writable {
  constructor() { super(); this.headers={}; this.chunks=[]; this.statusCode=200; this.done=new Promise((resolve,reject)=>{this.on('finish',resolve);this.on('error',reject);}); }
  _write(chunk,encoding,callback) { this.chunks.push(Buffer.from(chunk)); callback(); }
  setHeader(k,v) { this.headers[k.toLowerCase()]=v; }
  writeHead(code,headers={}) { this.statusCode=code; this.headersSent=true; for(const [k,v] of Object.entries(headers))this.setHeader(k,v);return this; }
}
async function request(url, {method='GET',data,headers={}}={}) {
  const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]); Object.assign(req,{url,method,headers:{host:'127.0.0.1:8101',...headers}});
  const res=new Response(); await handler(req,res); await res.done; const text=Buffer.concat(res.chunks).toString(); return {status:res.statusCode,headers:res.headers,text,body:()=>JSON.parse(text)};
}
after(cleanup);
test('local backend health and bootstrap expose a session token', async()=>{
  assert.equal((await request('/health')).body().ok,true);
  const b=await request('/api/bootstrap'); assert.equal(b.status,200); assert.match(b.body().token,/^[a-f0-9]{48}$/); assert.equal(b.headers['cache-control'],'no-store');
});
test('host checks, cross-origin policy and CSRF reject unauthorized world access',async()=>{
  assert.equal((await request('/api/bootstrap',{headers:{host:'evil.example:8101'}})).status,403);
  assert.equal((await request('/api/world',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await request('/api/world/open',{method:'POST',data:{path:'C:/'}})).status,403);
  const token=(await request('/api/bootstrap')).body().token;
  assert.equal((await request('/api/world/open',{method:'POST',data:{path:'C:/'},headers:{'x-explorer-token':token,origin:'https://evil.example'}})).status,403);
});

test('a clicked cross-site home link opens the app without permitting cross-site API or embedded access',async()=>{
  const headers={'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document','sec-fetch-user':'?1'};
  for(const url of ['/', '/?view=home']){
    const home=await request(url,{headers});assert.equal(home.status,200);assert.match(home.text,/id="pick-world"/);
  }
  for(const url of ['/api/bootstrap','/api/world','/api/recents/clear','/?view=world'])assert.equal((await request(url,{headers})).status,403);
  assert.equal((await request('/?view=home',{headers:{...headers,'sec-fetch-mode':'cors','sec-fetch-dest':'empty'}})).status,403);
  assert.equal((await request('/?view=home',{headers:{...headers,'sec-fetch-dest':'iframe'}})).status,403);
  assert.equal((await request('/?view=home',{headers:{...headers,'sec-fetch-user':'?0'}})).status,403);
  assert.equal((await request('/?view=home',{headers:{...headers,host:'evil.example:8101'}})).status,403);
  assert.equal((await request('/?view=home',{method:'POST',headers})).status,403);
});
test('world APIs require selection and static access cannot escape approved roots',async()=>{
  assert.equal((await request('/api/block?x=0&y=0&z=0')).status,409);
  assert.equal((await request('/vendor/%2e%2e%2flocal.config.json')).status,403);
  assert.equal((await request('/local.config.json')).status,404);
  const home=await request('/');assert.equal(home.status,200);assert.match(home.text,/id="pick-world"/);
  const js=await request('/explorer.js');assert.equal(js.status,200);assert.match(js.headers['content-type'],/javascript/);
});
test('item icons are served from the installed Minecraft assets without external requests',{skip:!hasClientAssets},async()=>{
  const r=await request('/api/icon/minecraft:diamond');assert.equal(r.status,200);assert.equal(r.headers['content-type'],'image/png');
  assert.ok((await request('/api/icon/minecraft:../../level.dat')).status>=400);
});

test('creature view requires a world and texture URLs expose only known local assets',async()=>{
  assert.equal((await request('/api/entities/near?x=0&y=64&z=0')).status,409);
  if(hasClientAssets){const r=await request('/api/entity-texture/pig');assert.equal(r.status,200);assert.equal(r.headers['content-type'],'image/png');}
  assert.ok((await request('/api/entity-texture/../../local.config.json')).status>=400);
  assert.equal((await request('/api/entity-texture/not_a_known_entity')).status,404);
});
