// Detailed view distance in Minecraft chunks (one chunk = 16 blocks).
export const VIEW_DISTANCE_CHUNKS = 32;
export const VIEW_DISTANCE_BLOCKS = VIEW_DISTANCE_CHUNKS * 16;
export const LOWRES_VIEW_DISTANCE_BLOCKS = 1800;

export const VIEW_DISTANCE_OPTIONS = Object.freeze([4, 8, 12, 16, 24, 32, 48, 64]);
export function normalizeViewDistance(value) {
  const chunks = Number(value);
  return VIEW_DISTANCE_OPTIONS.includes(chunks) ? chunks : VIEW_DISTANCE_CHUNKS;
}
export function viewDistances(value) {
  const chunks = normalizeViewDistance(value);
  return { chunks, hires: chunks * 16, lowres: Math.min(LOWRES_VIEW_DISTANCE_BLOCKS, chunks * 32) };
}
