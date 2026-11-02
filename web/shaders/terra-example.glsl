// World Explorer WebGL shader function. Not an Iris/OptiFine shader pack.
// color: existing terrain color; worldPosition: local world coordinates;
// normal: surface normal; time: seconds. Return RGB in the 0..1 range.
vec3 worldExplorerShader(vec3 color, vec3 worldPosition, vec3 normal, float time) {
    float skyFacing = abs(normal.y);
    vec3 warmSun = vec3(1.035, 1.015, 0.97);
    return color * mix(vec3(0.97, 1.0, 1.025), warmSun, skyFacing);
}
