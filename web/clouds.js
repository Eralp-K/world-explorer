export class CloudLayer{
  constructor(viewer,T){
    this.viewer=viewer;this.enabled=true;this.dimension='';this.next=0;
    this.geometry=new T.BoxGeometry(1,1,1);this.material=new T.MeshBasicMaterial({color:0xe9eee3});
    this.mesh=new T.InstancedMesh(this.geometry,this.material,256);this.mesh.name='World Explorer clouds';this.mesh.frustumCulled=false;
    this.mesh.userData.explorerEnvironment=true;this.dummy=new T.Object3D();viewer.markers.add(this.mesh);
  }
  configure(enabled,dimension){this.enabled=enabled;this.dimension=dimension;this.mesh.visible=enabled&&dimension==='minecraft:overworld';this.next=0;}
  update(now){
    if(!this.mesh.visible||now<this.next)return;this.next=now+100;
    const p=this.viewer.camera.position,drift=now*.0015,cell=112,cx=Math.floor((p.x-drift)/cell),cz=Math.floor(p.z/cell);let count=0;
    for(let x=-6;x<=6;x++)for(let z=-6;z<=6;z++){
      const wx=cx+x,wz=cz+z,seed=((Math.imul(wx,73856093)^Math.imul(wz,19349663))>>>0);
      if(seed%7>2)continue;
      for(let part=0;part<2;part++){
        this.dummy.position.set(wx*cell+drift+part*24,192+(seed%3)*3,wz*cell+part*12);
        this.dummy.scale.set(42+(seed%5)*8,3+(seed%3),28+(seed%7)*5);this.dummy.updateMatrix();this.mesh.setMatrixAt(count++,this.dummy.matrix);
      }
    }
    this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;
  }
  dispose(){this.mesh.parent?.remove(this.mesh);this.geometry.dispose();this.material.dispose();}
}
