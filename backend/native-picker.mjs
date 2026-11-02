import { ensureNativeHelper, runNative } from './windows-native.mjs';

let pending = false;
export async function nativePicker(mode = 'folder') {
  if (!['folder', 'zip'].includes(mode)) throw Error('Invalid selection type');
  if (process.platform !== 'win32') throw Error('Klasör veya ZIP yolunu metin alanına yapıştır.');
  if (pending) throw Error('Bir seçim penceresi zaten açık.');
  pending = true;
  try {
    return await runNative(await ensureNativeHelper(), [mode]);
  } finally { pending = false; }
}
