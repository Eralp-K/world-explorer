// BlueMap owns orthographic projection, map panning, wheel zoom and touch input.
// This adapter only switches between those native controls and our spectator.
export class CameraModes {
  constructor(app, freeControls) {
    this.app=app;this.freeControls=freeControls;this.mode='free';this.freePose=null;
  }
  select(mode) {
    mode=mode==='top'?'top':'free';
    const app=this.app,cm=app.mapViewer.controlsManager,map=app.mapViewer.map;
    if(mode===this.mode)return;
    if(mode==='top'){
      if(!map?.data.flatView||!app.mapControls)throw Error('mapViewUnavailable');
      this.freePose={position:cm.position.clone(),rotation:cm.rotation,angle:cm.angle};
      const height=map.terrainHeightAt(cm.position.x,cm.position.z);
      if(Number.isFinite(height))cm.position.y=height+3;
      app.setFlatView(0,Math.min(256,app.mapControls.maxDistance));
    }else{
      app.viewAnimation?.cancel();
      cm.controls=null;
      const pose=this.freePose,unchanged=pose&&Math.hypot(cm.position.x-pose.position.x,cm.position.z-pose.position.z)<1;
      if(unchanged)cm.position.copy(pose.position);
      else{const height=map?.terrainHeightAt(cm.position.x,cm.position.z);if(Number.isFinite(height))cm.position.y=height+3;}
      cm.distance=0;cm.ortho=0;cm.tilt=0;cm.rotation=pose?.rotation||0;cm.angle=pose?.angle??Math.PI/2;
      cm.controls=this.freeControls;app.appState.controls.state='free';
    }
    this.mode=mode;
  }
}
