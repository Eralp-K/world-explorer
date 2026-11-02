import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipAssets } from '../backend/zip.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const day = path.dirname(path.dirname(root));
let installed = process.argv[2];
if (!installed) for (const e of await fs.readdir(day, { withFileTypes: true })) if (e.isDirectory()) {
  const candidate = path.join(day, e.name, 'BlueMap'); try { await fs.access(path.join(candidate, 'bluemap-5.29-cli.jar')); installed = candidate; break; } catch {}
}
if (!installed) throw Error('Run: node scripts/setup.mjs "PATH_TO_INSTALLED_BLUEMAP"');
installed = await fs.realpath(installed);
await fs.mkdir(path.join(root, 'vendor'), { recursive: true });
for (const dir of ['assets', 'lang']) await fs.cp(path.join(installed, 'web', dir), path.join(root, 'vendor', dir), { recursive: true });
await fs.copyFile(path.join(installed, 'bluemap-5.29-cli.jar'), path.join(root, 'vendor', 'bluemap-5.29-cli.jar'));
const jar = await new ZipAssets().load(path.join(root, 'vendor', 'bluemap-5.29-cli.jar'));
const license = jar.read('LICENSE') || jar.read('META-INF/LICENSE');
const mit = `MIT License\n\nCopyright (c) Blue (Lukas Rieger) <https://bluecolored.de>\nCopyright (c) contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`;
// A shaded JAR's top-level LICENSE may belong to a bundled dependency.
// Preserve it separately; use the verified upstream MIT notice for BlueMap.
if (license) await fs.writeFile(path.join(root, 'vendor', 'LICENSE-bundled.txt'), license);
await fs.copyFile(path.join(root, 'licenses', 'BlueMap.txt'), path.join(root, 'vendor', 'LICENSE-BlueMap.txt'));
const config = { installedBlueMap: installed, jar: path.join(root, 'vendor', 'bluemap-5.29-cli.jar'), java: process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java.exe') : 'java', existingRenders: [] };
const java = path.join(process.env.USERPROFILE || '', 'curseforge', 'minecraft', 'Install', 'java', 'java-runtime-epsilon', 'bin', 'java.exe');
try { await fs.access(java); config.java = java; } catch {}
for (const name of await fs.readdir(path.join(installed, 'config', 'maps'))) if (name.endsWith('.conf')) {
  const c = await fs.readFile(path.join(installed, 'config', 'maps', name), 'utf8');
  const worldPath = /world:\s*"([^"]+)"/.exec(c)?.[1], dimension = /dimension:\s*"([^"]+)"/.exec(c)?.[1] || 'minecraft:overworld';
  if (worldPath) { let entry = config.existingRenders.find(r => r.worldPath === worldPath); if (!entry) { entry = { worldPath, name: /name:\s*"([^"]+)"/.exec(c)?.[1] || path.basename(worldPath), version: '26.2', dimensions: {} }; config.existingRenders.push(entry); }
    entry.dimensions[dimension] = path.join(installed, 'web', 'maps', path.basename(name, '.conf')); }
}
const clients = (await fs.readdir(path.join(installed, 'data'))).filter(f => /^minecraft-client-.+\.jar$/.test(f));
if (clients.length) config.clientJar = path.join(installed, 'data', clients.at(-1));
await fs.writeFile(path.join(root, 'local.config.json'), JSON.stringify(config, null, 2));
// Recover original web sources for review without patching the compiled renderer.
const maps = (await fs.readdir(path.join(root, 'vendor', 'assets'))).filter(n => n.endsWith('.js.map'));
for (const name of maps) {
  const m = JSON.parse(await fs.readFile(path.join(root, 'vendor', 'assets', name), 'utf8'));
  for (let i = 0; i < m.sources.length; i++) {
    const marker = m.sources[i].indexOf('/src/'); if (marker < 0 || !m.sourcesContent?.[i]) continue;
    const relative = m.sources[i].slice(marker + 1); if (relative.includes('..')) continue;
    const dst = path.join(root, 'upstream-web', relative); await fs.mkdir(path.dirname(dst), { recursive: true }); await fs.writeFile(dst, m.sourcesContent[i]);
  }
}
console.log('BlueMap 5.29 installed. Renderer remains unmodified. Start: node backend/server.mjs');
