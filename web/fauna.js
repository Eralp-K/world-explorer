import {flattenNativeModel,modelAppearance,nativeGeometry} from './native-models.js';
export const MOB_TYPES=Object.freeze(['villager','zombie','husk','drowned','skeleton','stray','wither_skeleton','creeper','cow','mooshroom','pig','sheep','chicken','wolf','cat','enderman','iron_golem','snow_golem','horse','donkey','rabbit','slime','magma_cube','allay','bee','fox','turtle','squid','glow_squid','axolotl','bat','goat','polar_bear']);
export function livingType(id){const type=String(id).replace(/^minecraft:/,'');return MOB_TYPES.includes(type)?type:null;}
const woolColors=[0xf9fffe,0xf9801d,0xc74ebd,0x3ab3da,0xfed83d,0x80c71f,0xf38baa,0x474f52,0x9d9d97,0x169c9c,0x8932b8,0x3c44aa,0x835432,0x5e7c16,0xb02e26,0x1d1d21];
async function image(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Creature texture unavailable: '+url));img.src=url;});}
async function materialFor(T,appearance,wool=false){
  const base=await image(wool?'/api/entity-texture/sheep?layer=wool':appearance.texture);
  const canvas=document.createElement('canvas');canvas.width=base.naturalWidth;canvas.height=base.naturalHeight;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(base,0,0);
  const overlays=[];
  if(appearance.type==='villager'){
    overlays.push('/api/entity-texture/villager?layer=biome&variant='+encodeURIComponent(appearance.biome));
    if(appearance.profession&&appearance.profession!=='none')overlays.push('/api/entity-texture/villager?layer=profession&variant='+encodeURIComponent(appearance.profession));
  }
  if(appearance.type==='enderman')overlays.push('/api/entity-texture/enderman?layer=eyes');
  for(const url of overlays)try{ctx.drawImage(await image(url),0,0,canvas.width,canvas.height);}catch{}
  const texture=new T.CanvasTexture(canvas);texture.magFilter=T.NearestFilter;texture.minFilter=T.NearestFilter;texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;
  return new T.MeshBasicMaterial({map:texture,color:wool?woolColors[appearance.color]:0xffffff,alphaTest:.1});
}
export class FaunaLayer{
  constructor(viewer,T){
    this.viewer=viewer;this.T=T;this.group=new T.Group();this.group.name='Saved world creatures';viewer.markers.add(this.group);
    this.batches=new Map();this.enabled=true;this.animate=true;this.next=0;this.dummy=new T.Object3D();this.root=new T.Object3D();this.models=null;this.records=[];this.modelCount=0;
    this.loading=fetch('/api/entity-models').then(async response=>{if(!response.ok)throw Error((await response.json()).error);return response.json();}).then(data=>{
      this.models=data.models;this.setRecords(this.records);viewer.events.dispatchEvent(new Event('explorerModelsReady'));
    }).catch(error=>{this.error=true;console.warn(error);viewer.events.dispatchEvent(new CustomEvent('explorerModelsError',{detail:error.message}));});
  }
  hasModel(record){const appearance=this.models&&modelAppearance(record,this.models);return !!appearance&&!this.batches.get(appearance.batchKey)?.failed;}
  clear(){for(const batch of this.batches.values()){batch.disposed=true;for(const mesh of batch.meshes){mesh.parent?.remove(mesh);mesh.geometry.dispose();}for(const m of batch.materials){m.map?.dispose();m.dispose();}}this.batches.clear();this.records=[];this.modelCount=0;}
  setRecords(records){
    this.records=records;if(!this.models)return;
    const grouped=new Map();let total=0;
    for(const r of records){const appearance=modelAppearance(r,this.models);if(!appearance||r.invisible)continue;if(total++>=64)break;
      const entry=grouped.get(appearance.batchKey)||{appearance,records:[]};entry.records.push(r);grouped.set(appearance.batchKey,entry);
    }
    this.modelCount=Math.min(64,total);
    for(const batch of this.batches.values()){batch.records=[];batch.meshes.forEach(m=>m.count=0);}
    for(const [key,entry] of grouped){let batch=this.batches.get(key);if(!batch){
      batch={...entry,parts:[],records:entry.records,meshes:[],materials:[],disposed:false};this.batches.set(key,batch);
      this.build(batch).catch(error=>{console.warn(error);batch.failed=true;this.viewer.events.dispatchEvent(new Event('explorerModelsReady'));});
    }batch.records=entry.records;}
    // Release batches that left the query area, including their texture sheets.
    for(const [key,batch] of this.batches)if(!grouped.has(key)){
      batch.disposed=true;for(const mesh of batch.meshes){this.group.remove(mesh);mesh.geometry.dispose();}for(const m of batch.materials){m.map?.dispose();m.dispose();}this.batches.delete(key);
    }
    this.next=0;
  }
  async build(batch){
    const definitions=[{root:this.models[batch.appearance.key],wool:false}];
    if(batch.appearance.wool)definitions.push({root:this.models.sheep_wool,wool:true});
    for(const definition of definitions){
      const material=await materialFor(this.T,batch.appearance,definition.wool);
      if(batch.disposed){material.map?.dispose();material.dispose();return;}batch.materials.push(material);
      for(const part of flattenNativeModel(definition.root)){
        const p=nativeGeometry(this.T,part),mesh=new this.T.InstancedMesh(p.geometry,material,64);mesh.count=0;mesh.frustumCulled=false;mesh.userData.entityBatch=batch;
        batch.parts.push(p);batch.meshes.push(mesh);this.group.add(mesh);
      }
    }this.next=0;this.viewer.redraw();
  }
  configure(enabled,animate){this.enabled=enabled;this.animate=animate;this.group.visible=enabled;this.next=0;}
  update(now,cut=Infinity){
    if(!this.enabled||now<this.next)return;this.next=now+(this.animate?80:500);const p=this.viewer.camera.position;
    for(const batch of this.batches.values()){
      const records=batch.records.filter(r=>r.y<=cut&&(r.x-p.x)**2+(r.y-p.y)**2+(r.z-p.z)**2<64**2);
      for(let pi=0;pi<batch.meshes.length;pi++){
        const mesh=batch.meshes[pi],part=batch.parts[pi];mesh.userData.records=records;mesh.count=records.length;
        for(let i=0;i<records.length;i++){
          const r=records[i],phase=now*.0015+r.rowid*1.7,near=(r.x-p.x)**2+(r.z-p.z)**2<24**2,animate=this.animate&&near;
          this.root.position.set(r.x,r.y,r.z);this.root.rotation.set(0,Math.PI-r.yaw*Math.PI/180,0);this.root.scale.setScalar(batch.appearance.scale);this.root.updateMatrix();
          this.dummy.position.set(part.x,part.y+(animate?Math.sin(phase)*.007:0),part.z);this.dummy.rotation.set(0,part.bone==='head'&&animate?Math.sin(phase*.7)*.08:0,part.bone==='wing'&&animate?Math.sin(phase*10)*.1:0);this.dummy.scale.set(1,1,1);this.dummy.updateMatrix();
          this.dummy.matrix.premultiply(this.root.matrix);mesh.setMatrixAt(i,this.dummy.matrix);
        }mesh.instanceMatrix.needsUpdate=true;
      }
    }
  }
  hit(ray){if(!this.enabled)return null;this.group.updateMatrixWorld(true);for(const hit of ray.intersectObject(this.group,true)){const record=hit.object.userData.records?.[hit.instanceId];if(record)return {...hit,record};}return null;}
  dispose(){this.clear();this.group.parent?.remove(this.group);}
}
