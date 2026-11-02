import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scopeMask } from './render-scope.mjs';

const quote = p => JSON.stringify(p.replaceAll('\\', '/'));
export class Renderer {
  constructor(config) { this.config = config; this.status = { phase: 'idle', percent: 0 }; this.child = null; this.maps = {}; }
  async prepare(world, cache) {
    if (this.child) throw Error('Wait for the current renderer to stop');
    this.world = world; this.cache = cache; this.maps = {};
    const cfg = path.join(cache, 'renderer', 'config'), data = path.join(cache, 'renderer', 'data'), web = path.join(cache, 'renderer', 'web');
    this.cwd = path.join(cache, 'renderer'); this.cfg = cfg; this.web = web;
    for (const dir of [cfg, data, web, path.join(cfg, 'maps'), path.join(cfg, 'storages')]) await fs.mkdir(dir, { recursive: true });
    // These paths always belong to the application's cache, never the selected save.
    await fs.writeFile(path.join(cfg, 'core.conf'), `accept-download: true\ndata: ${quote(data)}\nrender-thread-count: 2\nscan-for-mod-resources: true\nmetrics: false\n`);
    await fs.writeFile(path.join(cfg, 'webapp.conf'), `enabled: true\nwebroot: ${quote(web)}\n`);
    await fs.writeFile(path.join(cfg, 'webserver.conf'), 'enabled: false\nip: "127.0.0.1"\nport: 0\n');
    await fs.writeFile(path.join(cfg, 'storages', 'file.conf'), `storage-type: file\nroot: ${quote(path.join(web, 'maps'))}\ncompression: gzip\n`);
    for (const dim of world.dimensions) {
      this.maps[dim.mapId] = path.join(web, 'maps', dim.mapId);
      await fs.writeFile(path.join(cfg, 'maps', dim.mapId + '.conf'), `world: ${quote(world.path)}\ndimension: ${JSON.stringify(dim.id)}\nname: ${JSON.stringify(dim.label)}\nremove-caves-below-y: -10000\ncave-detection-ocean-floor: 10000\nambient-light: 0.65\nrender-edges: true\nignore-missing-light-data: true\nenable-hires: true\nenable-free-flight-view: true\nstorage: "file"\n`);
      await fs.appendFile(path.join(cfg,'maps',dim.mapId+'.conf'),scopeMask(world.scope,dim.id));
    }
    const installed = this.config.installedBlueMap;
    if (installed) {
      const source = path.join(installed, 'data', `minecraft-client-${world.version}.jar`);
      try { await fs.copyFile(source, path.join(data, `minecraft-client-${world.version}.jar`), fs.constants.COPYFILE_EXCL); } catch (e) { if (!['ENOENT', 'EEXIST'].includes(e.code)) throw e; }
      try { await fs.copyFile(path.join(installed, 'data', 'resourceExtensions.zip'), path.join(data, 'resourceExtensions.zip'), fs.constants.COPYFILE_EXCL); } catch (e) { if (!['ENOENT', 'EEXIST'].includes(e.code)) throw e; }
    }
    // Existing render outputs may be reused read-only. No tile copying or save copying.
    this.reused = false;
    for (const render of this.config.existingRenders || []) if ((!world.scope || world.scope.mode === 'all') && path.resolve(render.worldPath) === world.path) {
      for (const dim of world.dimensions) if (render.dimensions[dim.id]) { this.maps[dim.mapId] = render.dimensions[dim.id]; this.reused = true; }
    }
    this.status = { phase: this.reused ? 'existing-render' : 'not-rendered', percent: this.reused ? null : 0 };
  }
  async start(force = false, missingOnly = false) {
    if (this.child) throw Error('Renderer is already running');
    const jar = this.config.jar; if (!jar) throw Error('BlueMap CLI JAR is not configured');
    const args = ['-Xmx1536M', '-jar', jar, '-c', this.cfg, '-v', this.world.version, '-r', '-g', '-s'];
    const available = await this.available();
    const selected = this.world.dimensions.filter(d => !missingOnly || !available.includes(d.mapId));
    if (!selected.length) return this.status;
    if (missingOnly) args.push('-m', selected.map(d => d.mapId).join(','));
    if (force) args.push('-f');
    const logPath = path.join(this.cwd, 'render.log');
    this.status = { phase: 'starting', percent: 0, log: logPath };
    const child = spawn(this.config.java || 'java', args, { cwd: this.cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); this.child = child;
    const log = await fs.open(logPath, 'a'); let pending = '';
    const consume = data => {
      const s = data.toString(); log.appendFile(s).catch(() => {}); pending = (pending + s).slice(-6000);
      const matches = [...pending.matchAll(/updating map '([^']+)':\s*([\d.]+)%[^\r\n]*/g)];
      if (matches.length) { const m = matches.at(-1); this.status = { phase: 'rendering', map: m[1], percent: Number(m[2]), message: m[0] }; }
      if (/ERROR|Exception/.test(s)) this.status.lastError = s.slice(-1500);
    };
    child.stdout.on('data', consume); child.stderr.on('data', consume);
    child.once('error', e => { this.status = { phase: 'error', error: e.message }; this.child = null; log.close().catch(() => {}); });
    child.once('exit', code => { this.status = { ...this.status, phase: code === 0 ? 'ready' : 'error', percent: code === 0 ? 100 : this.status.percent, exitCode: code }; this.child = null; log.close().catch(() => {}); });
    // Own output paths from now on; existing renders stay untouched.
    for (const d of selected) this.maps[d.mapId] = path.join(this.web, 'maps', d.mapId);
    return this.status;
  }
  async available() {
    const result = [];
    for (const d of this.world?.dimensions || []) {
      try { await fs.access(path.join(this.maps[d.mapId], 'settings.json')); await fs.access(path.join(this.maps[d.mapId], 'textures.json.gz')); result.push(d.mapId); }
      catch { try { await fs.access(path.join(this.maps[d.mapId], 'textures.json')); result.push(d.mapId); } catch {} }
    }
    return result;
  }
  stop() { if (this.child) this.child.kill(); }
  async stopAndWait() {
    const child=this.child;if(!child)return;
    await new Promise(resolve=>{child.once('close',resolve);child.kill();});
  }
}
