import { getChunk } from './region.mjs';
import { blockAt, chunkRoot, text } from './nbt.mjs';

export function item(raw, offset = 0) {
  const components = raw.components || raw.tag || {};
  return { slot: Number(raw.Slot ?? raw.slot ?? 0) + offset, id: raw.id || 'unknown', count: Number(raw.count ?? raw.Count ?? 1),
    name: text(components['minecraft:custom_name'] || components.display?.Name), components, raw };
}
export function inventorySize(id) {
  if (id.includes('hopper') || id.includes('brewing_stand')) return 5;
  if (/furnace|smoker/.test(id)) return 3;
  if (/dispenser|dropper|crafter/.test(id)) return 9;
  if (/lectern|jukebox|decorated_pot/.test(id)) return 1;
  if (/chiseled_bookshelf/.test(id)) return 6;
  return 27;
}
export function bookData(raw) {
  if (!raw) return null;
  const c = raw.components || raw.tag || {}, b = c['minecraft:written_book_content'] || c['minecraft:writable_book_content'] || c;
  const pages = (b.pages || []).map(p => text(p.raw ?? p.text ?? p));
  return pages.length ? { title: text(b.title?.raw || b.title || 'Book'), author: text(b.author), pages } : null;
}
export async function inspectBlock(world, dim, x, y, z) {
  const chunk = await getChunk(world, dim, Math.floor(x / 16), Math.floor(z / 16));
  if (!chunk) return { x, y, z, id: 'unloaded', message: 'This chunk has not been generated' };
  const block = blockAt(chunk, x, y, z), be = (chunkRoot(chunk).block_entities || chunkRoot(chunk).TileEntities || []).find(b => b.x === x && b.y === y && b.z === z);
  const result = { x, y, z, id: block.Name, properties: block.Properties || {}, blockEntity: be || null };
  if (!be) return result;
  if (Array.isArray(be.Items || be.items) || /chest|barrel|shulker|furnace|smoker|hopper|dropper|dispenser|brewing_stand|crafter|decorated_pot|chiseled_bookshelf/.test(be.id)) {
    result.inventory = (be.Items || be.items || []).map(i => item(i)); result.slots = inventorySize(be.id); result.title = text(be.CustomName || be.custom_name) || be.id;
    if (be.item) result.inventory.push(item(be.item));
    if (be.LootTable || be.loot_table) result.lootTable = be.LootTable || be.loot_table;
    const type = block.Properties?.type, facing = block.Properties?.facing;
    if (['minecraft:chest', 'minecraft:trapped_chest'].includes(block.Name) && ['left', 'right'].includes(type)) {
      // Chest type=left points to its right-hand neighbour, relative to facing.
      const right = { north: [1, 0], south: [-1, 0], west: [0, -1], east: [0, 1] }[facing];
      if (right) {
        const sign = type === 'left' ? 1 : -1, nx = x + right[0] * sign, nz = z + right[1] * sign;
        const otherChunk = await getChunk(world, dim, Math.floor(nx / 16), Math.floor(nz / 16));
        if (otherChunk) {
          const otherBlock = blockAt(otherChunk, nx, y, nz);
          const other = (chunkRoot(otherChunk).block_entities || chunkRoot(otherChunk).TileEntities || []).find(b => b.x === nx && b.y === y && b.z === nz);
          if (other && otherBlock.Name === block.Name && otherBlock.Properties?.facing === facing && otherBlock.Properties?.type === (type === 'left' ? 'right' : 'left')) {
            const own = result.inventory, peer = (other.Items || other.items || []).map(i => item(i));
            // Minecraft menu order: RIGHT chest is slots 0..26, LEFT chest is 27..53.
            result.inventory = type === 'right' ? [...own, ...peer.map(i => ({ ...i, slot: i.slot + 27 }))] : [...peer, ...own.map(i => ({ ...i, slot: i.slot + 27 }))];
            result.slots = 54; result.title = 'Large Chest'; result.doubleChest = { x: nx, y, z: nz };
          }
        }
      }
    }
  }
  if (be.front_text || /sign/.test(be.id)) {
    result.sign = { front: (be.front_text?.messages || [be.Text1, be.Text2, be.Text3, be.Text4]).map(text), back: (be.back_text?.messages || []).map(text) };
  }
  result.book = bookData(be.Book || be.book || be.RecordItem);
  return result;
}
