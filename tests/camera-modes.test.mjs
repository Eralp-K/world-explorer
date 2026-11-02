import test from 'node:test';
import assert from 'node:assert/strict';
import {CameraModes} from '../web/camera-modes.js';
class Position{constructor(x=0,y=70,z=0){Object.assign(this,{x,y,z});}clone(){return new Position(this.x,this.y,this.z);}copy(p){Object.assign(this,p);return this;}}
function fixture(){
  const free={},mapControls={maxDistance:512},cm={position:new Position(10,75,20),rotation:.7,angle:1.2,distance:0,ortho:0,tilt:0,controls:free};
  const app={mapViewer:{controlsManager:cm,map:{data:{flatView:true},terrainHeightAt:()=>64}},mapControls,appState:{controls:{state:'free'}},viewAnimation:{cancel(){}},setFlatView(transition,distance){assert.equal(transition,0);cm.distance=distance;cm.angle=0;cm.ortho=1;cm.controls=mapControls;this.appState.controls.state='flat';}};
  return {app,cm,free,modes:new CameraModes(app,free)};
}
test('top-down uses native map controls and restores the original flight pose when the center is unchanged',()=>{
  const {app,cm,free,modes}=fixture();modes.select('top');assert.equal(cm.controls,app.mapControls);assert.equal(cm.ortho,1);assert.equal(cm.angle,0);assert.equal(cm.distance,256);assert.equal(cm.position.y,67);
  modes.select('free');assert.equal(cm.controls,free);assert.equal(cm.ortho,0);assert.equal(cm.distance,0);assert.equal(cm.position.y,75);assert.equal(cm.rotation,.7);assert.equal(cm.angle,1.2);
});
test('returning to flight after panning uses the new map center at terrain height instead of teleporting back',()=>{
  const {cm,modes}=fixture();modes.select('top');cm.position.x=150;cm.position.z=-80;modes.select('free');assert.deepEqual([cm.position.x,cm.position.y,cm.position.z],[150,67,-80]);
});
test('unavailable flat maps leave the flight controls intact and repeated selections do not overwrite the saved pose',()=>{
  const {app,cm,free,modes}=fixture();app.mapViewer.map.data.flatView=false;assert.throws(()=>modes.select('top'),/mapViewUnavailable/);assert.equal(cm.controls,free);assert.equal(modes.mode,'free');app.mapViewer.map.data.flatView=true;modes.select('top');modes.select('top');modes.select('free');assert.equal(cm.position.y,75);
});
