import test from 'node:test';
import assert from 'node:assert/strict';
import { SpectatorControls } from '../web/freecam.js';
class V {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  clone(){return new V(this.x,this.y,this.z);}
  set(x,y,z){Object.assign(this,{x,y,z});return this;}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}
  normalize(){const l=Math.sqrt(this.lengthSq());this.x/=l;this.y/=l;this.z/=l;return this;}
  multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
}
test('spectator controls require pointer lock, move in blocks/second, sprint, and release cleanly',async()=>{
  const doc=new EventTarget(),win=new EventTarget(),canvas=new EventTarget();globalThis.document=doc;globalThis.window=win;
  doc.body={classList:{toggle(){}}};doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
  canvas.requestPointerLock=async()=>{doc.pointerLockElement=canvas;doc.dispatchEvent(new Event('pointerlockchange'));};
  const config={sensitivity:1,speed:10,sprint:4};let selected=0;const errors=[];
  const c=new SpectatorControls(canvas,config,()=>selected++,e=>errors.push(e));
  assert.equal(c.data.followingPlayer,null);
  const m={position:new V(),rotation:0,angle:Math.PI/2};c.start(m);c.keys.add('KeyW');c.update(50);assert.equal(m.position.z,0);
  await c.onClick({button:0});assert.equal(doc.pointerLockElement,canvas);
  c.keys.add('KeyW');c.update(50);assert.equal(m.position.z,-0.5);
  c.keys.add('ShiftLeft');c.update(50);assert.equal(m.position.z,-2.5);
  c.keys.clear();c.keys.add('Space');c.update(50);assert.ok(Math.abs(m.position.y-0.5)<0.001);
  c.keys.clear();c.keys.add('ControlLeft');c.update(50);assert.ok(Math.abs(m.position.y)<0.001);
  c.onMouse({movementX:100,movementY:20});assert.ok(m.rotation>0);assert.ok(m.angle<Math.PI/2);
  await c.onClick({button:0});assert.equal(selected,1);c.stop();assert.equal(doc.pointerLockElement,null);assert.equal(c.keys.size,0);assert.deepEqual(errors,[]);
  delete globalThis.document;delete globalThis.window;
});
