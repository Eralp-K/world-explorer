import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { openWorld } from './world.mjs';
import { ensureNativeHelper, runNative } from './windows-native.mjs';

export async function resolveWorldSource(input, cacheRoot) {
  if (typeof input !== 'string' || !input.trim() || input.includes('\0')) throw Error('Bir Minecraft klasörü veya ZIP dosyası seç.');
  const source = await fs.realpath(input.trim()), stat = await fs.stat(source);
  if (stat.isDirectory()) return { path: source, sourcePath: source, sourceType: 'folder' };
  if (!stat.isFile() || path.extname(source).toLowerCase() !== '.zip') throw Error('Bir save klasörü veya .zip dünya arşivi seç.');
  if (process.platform !== 'win32') throw Error('Bu sürümde ZIP içe aktarma Windows üzerinde destekleniyor.');
  const hash = createHash('sha256'); for await (const bytes of createReadStream(source)) hash.update(bytes);
  const imports = path.join(cacheRoot, 'imports'), final = path.join(imports, 'v2-' + hash.digest('hex'));
  const ready = path.join(final, 'ready.json'), folder = path.join(final, 'world');
  try { const data = JSON.parse(await fs.readFile(ready, 'utf8')); if (data.format === 2) { await openWorld(folder); return { path: folder, sourcePath: source, sourceType: 'zip' }; } } catch (e) { if (!['ENOENT', 'ENOTDIR'].includes(e.code)) throw e; }
  await fs.mkdir(imports, { recursive: true });
  // A fresh UUID staging path prevents stale or untrusted files becoming extraction targets.
  const staging = path.join(imports, 'pending-' + randomUUID()), extracted = path.join(staging, 'world');
  await fs.mkdir(staging);
  try {
    await runNative(await ensureNativeHelper(), ['extract', source, extracted]);
    await openWorld(extracted); // Reject invalid saves before publishing the import cache.
    await fs.writeFile(path.join(staging, 'ready.json'), JSON.stringify({ format: 2, importedAt: new Date().toISOString() }));
    await fs.rename(staging, final);
    return { path: folder, sourcePath: source, sourceType: 'zip' };
  } catch (e) {
    // Only remove this invocation's newly created, explicitly bounded staging directory.
    const relative = path.relative(imports, staging);
    if (relative.startsWith('pending-') && !relative.includes(path.sep)) await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}
