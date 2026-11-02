import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
let building;
export function runNative(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    let out = '', err = ''; child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', b => out += b); child.stderr.on('data', b => err += b);
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve(out.replace(/^\uFEFF/, '').trim()) : reject(Error(err.trim() || out.trim() || 'Windows helper failed')));
  });
}
export async function ensureNativeHelper() {
  if (process.platform !== 'win32') throw Error('Bu işlem Windows üzerinde destekleniyor.');
  if (building) return await building;
  building = (async () => {
    const names = ['windows-native.cs','native-dialog.cs','zip-import.cs'], sources = names.map(n => path.join(here,n));
    const hash = createHash('sha256'); for (const file of sources) hash.update(await fs.readFile(file));
    const directory = path.resolve(here,'..','cache','native'), exe = path.join(directory,'world-explorer-' + hash.digest('hex').slice(0,20) + '.exe');
    try { await fs.access(exe); return exe; } catch {}
    const windows = process.env.WINDIR || 'C:\\Windows'; let compiler;
    for (const arch of ['Framework64','Framework']) {
      const candidate = path.join(windows,'Microsoft.NET',arch,'v4.0.30319','csc.exe');
      try { await fs.access(candidate); compiler = candidate; break; } catch {}
    }
    if (!compiler) throw Error('Windows .NET Framework derleyicisi bulunamadı. Klasör yolunu kullanabilirsin.');
    await fs.mkdir(directory,{recursive:true});
    const compression = path.join(path.dirname(compiler),'System.IO.Compression.dll');
    // Compile our local helper; no PowerShell scripts or execution-policy changes.
    await runNative(compiler,['/nologo','/target:winexe','/optimize+','/out:' + exe,'/reference:' + compression,...sources]);
    return exe;
  })();
  try { return await building; } catch (e) { building = null; throw e; }
}
