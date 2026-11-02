import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

// Read geometry from the user's installed client. Never ship game model/texture
// data with the application; only this independent reflection bridge is bundled.
export async function loadEntityModels(local,assets,cacheRoot){
  if(!local.clientJar||!assets)throw Error('Minecraft client assets are unavailable');
  const version=JSON.parse(assets.read('version.json')?.toString()||'{}').id;
  if(!version)throw Error('Minecraft client version is unavailable');
  const stat=await fs.stat(local.clientJar),key=createHash('sha256').update(local.clientJar+stat.size+stat.mtimeMs+':models-v2').digest('hex').slice(0,20);
  const dir=path.join(cacheRoot,'entity-models',key),output=path.join(dir,'models.json');
  const valid=data=>{if(data.format!==1||!data.models?.pig||!data.models?.villager)throw Error('Client model export is incomplete');return data;};
  try{return valid(JSON.parse(await fs.readFile(output,'utf8')));}catch{}
  const candidates=[local.minecraftInstall,local.java&&path.resolve(path.dirname(local.java),'../../..'),path.join(os.homedir(),'curseforge','minecraft','Install'),process.env.APPDATA&&path.join(process.env.APPDATA,'.minecraft')].filter(Boolean);
  let install,manifest;
  for(const root of candidates)try{manifest=JSON.parse(await fs.readFile(path.join(root,'versions',version,version+'.json'),'utf8'));install=root;break;}catch{}
  if(!manifest)throw Error('Install the matching Minecraft client and libraries to display native creature models');
  const libraries=[];
  for(const library of manifest.libraries||[]){const name=library.downloads?.artifact?.path;if(!name)continue;const jar=path.resolve(install,'libraries',name);try{await fs.access(jar);libraries.push(jar);}catch{}}
  await fs.mkdir(dir,{recursive:true});
  const bridge=new URL('./entity-models-exporter.jar',import.meta.url);
  const {fileURLToPath}=await import('node:url');
  const classpath=[fileURLToPath(bridge),local.clientJar,...libraries].join(path.delimiter);
  const argfile=path.join(dir,'export.args');
  const quote=value=>'"'+value.replaceAll('\\','/').replaceAll('"','\\"')+'"';
  await fs.writeFile(argfile,['-Xmx768m','-Djava.awt.headless=true','-cp',quote(classpath),'ExportModels',quote(output)].join('\n'));
  await new Promise((resolve,reject)=>{
    const child=spawn(local.java||'java',['@'+argfile],{cwd:dir,windowsHide:true,stdio:['ignore','pipe','pipe']});let detail='';
    const collect=b=>{detail=(detail+b).slice(-3000);};child.stdout.on('data',collect);child.stderr.on('data',collect);
    const timer=setTimeout(()=>{child.kill();reject(Error('Client model export timed out'));},45000);
    child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Client model export failed: '+detail));});
  });
  return valid(JSON.parse(await fs.readFile(output,'utf8')));
}
