// A controls adapter for BlueMap's existing ControlsManager. No renderer fork.
import { t } from './i18n.js';
export class SpectatorControls {
  constructor(canvas, config, onInspect, onError) {
    // BlueMap's background update reads controls.data.followingPlayer.
    this.data = { followingPlayer: null };
    this.canvas = canvas; this.config = config; this.onInspect = onInspect; this.onError = onError; this.keys = new Set();
    this.onDown = e => { if (document.pointerLockElement !== canvas) return; if (['KeyW','KeyA','KeyS','KeyD','Space','ControlLeft','ControlRight','KeyC','ShiftLeft','ShiftRight'].includes(e.code)) { e.preventDefault(); this.keys.add(e.code); } };
    this.onUp = e => this.keys.delete(e.code);
    this.onBlur = () => this.keys.clear();
    this.onLock = () => { this.keys.clear(); document.body.classList.toggle('locked', document.pointerLockElement === canvas); };
    this.onMouse = e => {
      if (document.pointerLockElement !== canvas || !this.manager) return;
      this.manager.rotation += e.movementX * 0.002 * this.config.sensitivity;
      this.manager.angle = Math.max(0.01, Math.min(Math.PI - 0.01, this.manager.angle - e.movementY * 0.002 * this.config.sensitivity));
    };
    this.onClick = async e => {
      if (e.button !== 0) return;
      if (document.pointerLockElement === canvas) { this.onInspect(); return; }
      if (!canvas.requestPointerLock) { this.onError(t('pointerUnsupported')); return; }
      try { await canvas.requestPointerLock(); } catch (err) { this.onError(t('pointerError',{message:err.message})); }
    };
    this.onWheel = e => { if (document.pointerLockElement !== canvas) return; e.preventDefault(); this.config.speed = Math.max(1, Math.min(200, this.config.speed * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); };
  }
  start(manager) {
    this.manager = manager;
    window.addEventListener('keydown', this.onDown); window.addEventListener('keyup', this.onUp); window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onLock); document.addEventListener('mousemove', this.onMouse);
    this.canvas.addEventListener('click', this.onClick); this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }
  stop() {
    this.keys.clear(); window.removeEventListener('keydown', this.onDown); window.removeEventListener('keyup', this.onUp); window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onLock); document.removeEventListener('mousemove', this.onMouse);
    this.canvas.removeEventListener('click', this.onClick); this.canvas.removeEventListener('wheel', this.onWheel);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
  update(delta) {
    const cm = this.manager; cm.distance = 0; cm.ortho = 0; cm.tilt = 0;
    if (document.pointerLockElement !== this.canvas) return;
    const k = this.keys, forward = Number(k.has('KeyW')) - Number(k.has('KeyS')), right = Number(k.has('KeyD')) - Number(k.has('KeyA'));
    const vertical = Number(k.has('Space')) - Number(k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyC'));
    const sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    const movement = cm.position.clone().set(0, 0, 0);
    movement.x = forward * Math.sin(cm.rotation) * Math.sin(cm.angle) + right * Math.cos(cm.rotation);
    movement.z = -forward * Math.cos(cm.rotation) * Math.sin(cm.angle) + right * Math.sin(cm.rotation);
    movement.y = -forward * Math.cos(cm.angle) + vertical;
    if (movement.lengthSq() > 0) cm.position.add(movement.normalize().multiplyScalar(Math.min(delta, 50) / 1000 * this.config.speed * (sprint ? this.config.sprint : 1)));
  }
}
