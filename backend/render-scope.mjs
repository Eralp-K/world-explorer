import { createHash } from 'node:crypto';

export function playerPosition(data, modifiedAt, source) {
  const p = data?.Pos || data?.pos, dimension = data?.Dimension ?? data?.dimension;
  if (!Array.isArray(p) || p.length !== 3 || p.some(n => !Number.isFinite(n) || Math.abs(n) > 30000000) || typeof dimension !== 'string') return null;
  return { x: p[0], y: p[1], z: p[2], dimension, modifiedAt, source };
}
export function newestPlayer(candidates) {
  return candidates.filter(Boolean).sort((a,b) => b.modifiedAt-a.modifiedAt || a.source.localeCompare(b.source))[0] || null;
}
export function createRenderScope(world, request = {}) {
  const mode = request.mode ?? 'all';
  if (!['all','player-radius'].includes(mode)) throw Error('Geçersiz render alanı.');
  const diameter = mode === 'all' ? 10000 : Number(request.diameter ?? 10000);
  if (!Number.isInteger(diameter) || diameter < 256 || diameter > 100000) throw Error('Çap 256 ile 100.000 blok arasında olmalı.');
  const last = world.lastPlayer, centers = {};
  for (const dim of world.dimensions) {
    const local = world.playersByDimension?.[dim.id];
    if (local) centers[dim.id] = { x:local.x,y:local.y,z:local.z,source:'player' };
    else if (last && dim.id === last.dimension) centers[dim.id] = { x:last.x,y:last.y,z:last.z,source:'player' };
    else if (last && last.dimension === 'minecraft:overworld' && dim.id === 'minecraft:the_nether') centers[dim.id] = { x:last.x/8,y:70,z:last.z/8,source:'portal-scale' };
    else if (last && last.dimension === 'minecraft:the_nether' && dim.id === 'minecraft:overworld') centers[dim.id] = { x:last.x*8,y:world.spawn.y,z:last.z*8,source:'portal-scale' };
    else centers[dim.id] = dim.id === 'minecraft:overworld' ? { ...world.spawn,source:'spawn' } : { x:0,y:80,z:0,source:'dimension-origin' };
  }
  const geometry = { mode, diameter: mode === 'all' ? 0 : diameter, centers: mode === 'all' ? {} : Object.fromEntries(Object.entries(centers).map(([id,c])=>[id,[c.x,c.z]])) };
  const key = mode === 'all' ? 'all' : createHash('sha256').update(JSON.stringify(geometry)).digest('hex').slice(0,16);
  return { mode, diameter, radius:diameter/2, centers, key, playerFound:!!last, playerDimension:last?.dimension || null };
}
export function containsPoint(scope, dimension, x, z) {
  if (!scope || scope.mode === 'all') return true;
  const c=scope.centers[dimension];return !!c && (x-c.x)**2+(z-c.z)**2 <= scope.radius**2;
}
export function intersectsArea(scope, dimension, minX, minZ, maxX, maxZ) {
  if (!scope || scope.mode === 'all') return true;
  const c=scope.centers[dimension];if(!c)return false;
  const x=Math.max(minX,Math.min(c.x,maxX)),z=Math.max(minZ,Math.min(c.z,maxZ));return (x-c.x)**2+(z-c.z)**2<=scope.radius**2;
}
export const intersectsChunk=(scope,dim,cx,cz)=>intersectsArea(scope,dim,cx*16,cz*16,cx*16+16,cz*16+16);
export function scopeMask(scope, dimension) {
  if (!scope || scope.mode === 'all') return '';
  const c=scope.centers[dimension];
  return `render-mask: [{ type: circle, center-x: ${c.x}, center-z: ${c.z}, radius: ${scope.radius} }]\n`;
}
