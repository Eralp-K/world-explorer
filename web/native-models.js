const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function multiply(a,b){const r=new Array(16).fill(0);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r;}
function poseMatrix(p){
  const [x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1]=p||[],cx=Math.cos(rx),cy=Math.cos(ry),cz=Math.cos(rz),ax=Math.sin(rx),ay=Math.sin(ry),az=Math.sin(rz);
  const a=[1,0,0,0,0,cx,ax,0,0,-ax,cx,0,0,0,0,1],b=[cy,0,-ay,0,0,1,0,0,ay,0,cy,0,0,0,0,1],c=[cz,az,0,0,-az,cz,0,0,0,0,1,0,0,0,0,1];
  const s=[sx,0,0,0,0,sy,0,0,0,0,sz,0,0,0,0,1],m=multiply(c,multiply(b,multiply(a,s)));m[12]=x;m[13]=y;m[14]=z;return m;
}
// Exact baked polygons already include UV mirrors and texture-sheet dimensions.
// Match Minecraft's (-X,-Y,+Z) model transform, with feet at world Y=0.
export function flattenNativeModel(root){
  const parts=[];
  function visit(node,parent,path){
    const m=multiply(parent,poseMatrix(node.pose)),name=path+'/'+node.name;
    if(node.faces?.length){const positions=[],uv=[];
      for(const face of node.faces){if(face.length!==4)continue;for(const i of [0,1,2,0,2,3]){
        const [x,y,z,u,v]=face[i];positions.push(-(m[0]*x+m[4]*y+m[8]*z+m[12])/16,1.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/16,(m[2]*x+m[6]*y+m[10]*z+m[14])/16);uv.push(u,1-v);
      }}
      parts.push({name,positions,uv,bone:/head/.test(name)?'head':/wing/.test(name)?'wing':''});
    }
    for(const child of node.children||[])visit(child,m,name);
  }visit(root,identity(),'');return parts;
}
export function modelAppearance(record,models){
  const type=String(record.id).replace(/^minecraft:/,''),variant=String(record.variant||'temperate').replace(/^minecraft:/,'');let key=type;
  if(['pig','cow','chicken'].includes(type)&&['cold','warm'].includes(variant)&&models[variant+'_'+type])key=variant+'_'+type;
  const babyKey=key+'_baby',nativeBaby=!!(record.baby&&models[babyKey]);if(nativeBaby)key=babyKey;
  if(!models[key])return null;
  const wool=type==='sheep'&&!record.sheared&&models.sheep_wool;
  const biome=type==='villager'?String(record.biome||'minecraft:plains').replace(/^minecraft:/,''):'',profession=type==='villager'?String(record.profession||'').replace(/^minecraft:/,''):'';
  const query=new URLSearchParams();if(variant)query.set('variant',variant);if(nativeBaby)query.set('baby','1');
  const texture='/api/entity-texture/'+type+(query.size?'?'+query:'');
  return {type,key,nativeBaby,scale:record.baby&&!nativeBaby?.5:1,wool:!!wool,color:Math.max(0,Math.min(15,record.color||0)),biome,profession,texture,batchKey:[key,nativeBaby,!!wool,wool?record.color:0,biome,profession,texture].join('|')};
}
export function nativeGeometry(T,part){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(part.positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(part.uv,2));g.computeVertexNormals();g.computeBoundingBox();
  const center=new T.Vector3();g.boundingBox.getCenter(center);g.translate(-center.x,-center.y,-center.z);return {geometry:g,x:center.x,y:center.y,z:center.z,bone:part.bone,name:part.name};
}
