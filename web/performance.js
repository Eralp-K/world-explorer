import {normalizeViewDistance} from './view-config.js';
export function detailBudget(chunks, mode='balanced', nearCap=12) {
  const selected=normalizeViewDistance(chunks), full=mode==='full';
  const near=full?selected:Math.min(selected,Math.max(4,Math.min(12,nearCap)));
  return {selected,near,hires:near*16,far:selected*16,scale:mode==='fast'?0.75:1};
}
// Each LOD tile covers tileSize * lodFactor^level blocks. Using the same tile
// count at every level loaded a vastly larger area than the selected distance.
export function lodTileRadius(far,hires,tileSize,scale,level) {
  const range=level===0?Math.min(far,hires+128):far;
  return Math.max(1,Math.ceil(range/(tileSize*scale)));
}
export function installMapBudget(map, getBudget) {
  if(!map||map.explorerBudget)return;
  map.explorerBudget=true;
  map.loadMapArea=function(x,z){
    if(!this.isLoaded)return;const b=getBudget(),low=this.data.lowres,high=this.data.hires;
    for(let i=this.lowresTileManager.length-1;i>=0;i--){
      const scale=Math.pow(low.lodFactor,i),sx=low.tileSize.x*scale,sz=low.tileSize.z*scale;
      this.lowresTileManager[i].loadAroundTile(Math.floor(x/sx),Math.floor(z/sz),lodTileRadius(b.far,b.hires,low.tileSize.x,scale,i),lodTileRadius(b.far,b.hires,low.tileSize.z,scale,i));
    }
    this.hiresTileManager.loadAroundTile(Math.floor((x-high.translate.x)/high.tileSize.x),Math.floor((z-high.translate.z)/high.tileSize.z),Math.ceil(b.hires/high.tileSize.x),Math.ceil(b.hires/high.tileSize.z));
  };
}
export class AdaptiveDetail {
  constructor(){this.cap=12;this.scale=1;this.next=0;this.samples=[];}
  sample(now,delta,enabled){
    if(!enabled){const changed=this.cap!==12||this.scale!==1;this.cap=12;this.scale=1;this.samples=[];return changed;}
    if(delta>0&&delta<250)this.samples.push(delta);
    if(now<this.next||this.samples.length<30)return false;
    this.next=now+6000;const sorted=this.samples.splice(0).sort((a,b)=>a-b),ms=sorted[Math.floor(sorted.length*.65)];
    const old=this.cap+this.scale;
    if(ms>32){this.cap=Math.max(4,this.cap-2);this.scale=Math.max(.7,this.scale-.1);}
    else if(ms<18){this.cap=Math.min(12,this.cap+2);this.scale=Math.min(1,this.scale+.05);}
    return old!==this.cap+this.scale;
  }
}
