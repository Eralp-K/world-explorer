// Terrain lighting, color and atmosphere run in the existing terrain pass.
export const SHADER_PRESETS=Object.freeze({
  plain:{exposure:1,saturation:1,contrast:1,warmth:0,fog:0},
  soft:{exposure:1.02,saturation:1.08,contrast:1.045,warmth:.035,fog:.13},
  natural:{exposure:1.06,saturation:1.12,contrast:1.06,warmth:.015,fog:.28},
  golden:{exposure:1.04,saturation:1.08,contrast:1.08,warmth:.13,fog:.30},
  cool:{exposure:.98,saturation:.88,contrast:1.12,warmth:-.07,fog:.38}
});
export function shaderProfile(value){
  if(!value||value.format!=='world-explorer-shader'||value.version!==1)throw Error('shaderFormat');
  const defaults=SHADER_PRESETS.natural,limits={exposure:[.4,1.8],saturation:[0,2],contrast:[.5,1.6],warmth:[-.25,.25],fog:[0,.7]},profile={};
  for(const [key,[min,max]] of Object.entries(limits)){
    const n=value[key]??defaults[key];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error('shaderRange');profile[key]=n;
  }
  return {name:String(value.name||'Custom').slice(0,60),...profile};
}
export function shaderSource(source){
  if(typeof source!=='string'||source.length>16384||!source.trim())throw Error('shaderFormat');
  const clean=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  if(!/vec3\s+worldExplorerShader\s*\(/.test(clean)||/\b(for|while|do|discard|uniform|varying|attribute|layout)\b|#|\bvoid\s+main\s*\(/.test(clean))throw Error('shaderContract');
  return source;
}
export function validateShader(gl,source){
  shaderSource(source);const fragment=gl.createShader(gl.FRAGMENT_SHADER);
  try{
    gl.shaderSource(fragment,'#version 300 es\nprecision highp float;\nout vec4 resultColor;\n'+source+'\nvoid main(){resultColor=vec4(worldExplorerShader(vec3(1.0),vec3(0.0),vec3(0.0,1.0,0.0),0.0),1.0);}');
    gl.compileShader(fragment);if(!gl.getShaderParameter(fragment,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(fragment)||'GLSL compile error');
  }finally{gl.deleteShader(fragment);}
}
export function enhanceFragment(source,custom='') {
  if(source.includes('// WORLD_EXPLORER_VISUALS'))return source;
  if(!source.includes('gl_FragColor = color;'))throw Error('Unsupported BlueMap fragment shader');
  const fn=custom?shaderSource(custom):'vec3 worldExplorerShader(vec3 color, vec3 worldPosition, vec3 normal, float time) { return color; }';
  return `// WORLD_EXPLORER_VISUALS
uniform float explorerLook;
uniform float explorerRadius;
uniform vec2 explorerCenter;
uniform vec3 explorerCamera;
uniform vec4 explorerGrade;
uniform float explorerFog;
uniform float explorerFar;
uniform float explorerTime;
uniform float explorerStrength;
${fn}
`+source.replace('void main() {',`void main() {
  if (explorerRadius > 0.0 && length(vWorldPosition.xz - explorerCenter) > explorerRadius) discard;
`).replace('gl_FragColor = color;',`
  if (explorerLook > 0.5) {
    vec3 originalColor = color.rgb;
    float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    color.rgb = mix(vec3(luminance), color.rgb, explorerGrade.y);
    color.rgb = (color.rgb * explorerGrade.x - 0.5) * explorerGrade.z + 0.5;
    color.rgb *= vec3(1.0 + explorerGrade.w, 1.0 + explorerGrade.w * 0.25, 1.0 - explorerGrade.w);
    vec3 faceNormal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
    color.rgb *= 0.94 + 0.06 * abs(dot(faceNormal, normalize(vec3(0.4, 0.85, 0.3))));
    float atmosphere = smoothstep(explorerFar * 0.25, explorerFar * 1.15, length(vWorldPosition - explorerCamera)) * explorerFog;
    vec3 fogColor = vec3(0.63 + explorerGrade.w * 0.5, 0.73, 0.78 - explorerGrade.w * 0.5);
    color.rgb = mix(clamp(color.rgb, 0.0, 1.0), fogColor, atmosphere);
    color.rgb = worldExplorerShader(color.rgb, vWorldPosition, faceNormal, explorerTime);
    color.rgb = mix(originalColor, clamp(color.rgb, 0.0, 1.0), explorerStrength);
  }
  gl_FragColor = color;
`);
}
export class WorldVisuals {
  constructor(viewer,Three){
    this.viewer=viewer;this.scope=null;this.dimension=null;this.custom='';this.sources=new WeakMap();
    this.uniforms={explorerLook:{value:0},explorerRadius:{value:-1},explorerCenter:{value:new Three.Vector2()},explorerCamera:{value:new Three.Vector3()},explorerGrade:{value:new Three.Vector4(1,1,1,0)},explorerFog:{value:0},explorerFar:{value:512},explorerTime:{value:0},explorerStrength:{value:1}};
    Object.assign(viewer.data.uniforms,this.uniforms);
    viewer.events.addEventListener('bluemapRenderFrame',()=>this.update());
    viewer.events.addEventListener('bluemapTileLoaded',e=>e.detail?.tile?.model?.traverse(o=>this.patchMaterial(o.material,e.detail?.tileManager?.tileLoader?.explorerOriginalFragment)));
  }
  patchMaterial(material,originalSource){
    if(Array.isArray(material)){material.forEach(m=>this.patchMaterial(m,originalSource));return;}
    if(!material?.fragmentShader)return;
    if(originalSource)this.sources.set(material,originalSource);
    else if(!this.sources.has(material))this.sources.set(material,material.fragmentShader);
    const source=enhanceFragment(this.sources.get(material),this.custom);
    Object.assign(material.uniforms,this.uniforms);
    if(material.fragmentShader!==source){material.fragmentShader=source;material.needsUpdate=true;}
  }
  apply(scope,dimension,style='plain',settings={}){
    this.scope=scope;this.dimension=dimension;
    const profile=style==='custom'?settings.shaderProfile||SHADER_PRESETS.natural:SHADER_PRESETS[style]||SHADER_PRESETS.soft;
    const custom=style==='custom'?settings.shaderSource||'':'';
    if(custom!==this.custom){if(custom)validateShader(this.viewer.renderer.getContext(),custom);this.custom=custom;}
    this.uniforms.explorerLook.value=style==='plain'?0:1;
    this.uniforms.explorerGrade.value.set(profile.exposure,profile.saturation,profile.contrast,profile.warmth);
    this.uniforms.explorerFog.value=profile.fog;this.uniforms.explorerFar.value=(settings.viewChunks||32)*16;
    this.uniforms.explorerStrength.value=Math.max(0,Math.min(1,Number(settings.shaderStrength??1)));
    const map=this.viewer.map;if(!map)return;
    if(this.map!==map){this.sources=new WeakMap();this.map=map;}
    for(const m of map.hiresMaterial||[])this.patchMaterial(m);
    for(const mgr of map.lowresTileManager||[]){
      mgr.tileLoader.explorerOriginalFragment ||= mgr.tileLoader.fragmentShader;
      mgr.tileLoader.fragmentShader=enhanceFragment(mgr.tileLoader.explorerOriginalFragment,this.custom);
      Object.assign(mgr.tileLoader.uniforms,this.uniforms);mgr.scene.traverse(o=>this.patchMaterial(o.material,mgr.tileLoader.explorerOriginalFragment));
    }
    this.update();this.viewer.redraw();
  }
  update(){
    const p=this.viewer.camera.position,sx=Math.round(p.x/10000)*10000,sz=Math.round(p.z/10000)*10000;
    this.uniforms.explorerCamera.value.set(p.x-sx,p.y,p.z-sz);this.uniforms.explorerTime.value=performance.now()/1000;
    const c=this.scope?.centers?.[this.dimension];this.uniforms.explorerRadius.value=this.scope?.mode==='player-radius'?this.scope.radius:-1;
    this.uniforms.explorerCenter.value.set((c?.x||0)-sx,(c?.z||0)-sz);
  }
}
