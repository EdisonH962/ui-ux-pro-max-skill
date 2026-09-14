// Keyboard + mouse (pointer lock) and an on-screen touch layer for phones.

const KEY_ACTIONS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyR: 'reload',
  KeyQ: 'ability', KeyF: 'ability',
  KeyE: 'ability',
  Tab: 'scoreboard',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.actions = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false };
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.locked = false;
    this.touch = {
      enabled: false,
      move: { x: 0, y: 0 },
      look: { dx: 0, dy: 0 },
      fire: false,
    };
    this.onLockChange = null;
    this.onKey = null;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (action) {
        this.actions.add(action);
        if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      }
      if (this.onKey) this.onKey(e.code, true);
    });
    window.addEventListener('keyup', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (action) this.actions.delete(action);
      if (this.onKey) this.onKey(e.code, false);
    });
    window.addEventListener('blur', () => { this.actions.clear(); this.mouse.left = false; this.mouse.right = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.mouse.left = false; this.mouse.right = false; }
      if (this.onLockChange) this.onLockChange(this.locked);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    document.addEventListener('contextmenu', (e) => {
      if (this.locked) e.preventDefault();
    });
  }

  requestLock() {
    if (this.touch.enabled) return;
    this.canvas.requestPointerLock?.();
  }

  releaseLock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  down(action) {
    if (action === 'jump' && this.touch.jumpHeld) return true;
    return this.actions.has(action);
  }

  press(action) {
    if (this.actions.has(action)) { this.actions.delete(action); return true; }
    return false;
  }

  consumeLook() {
    const dx = this.mouse.dx + this.touch.look.dx;
    const dy = this.mouse.dy + this.touch.look.dy;
    this.mouse.dx = 0; this.mouse.dy = 0;
    this.touch.look.dx = 0; this.touch.look.dy = 0;
    return { dx, dy };
  }

  moveVector() {
    let x = 0, y = 0;
    if (this.down('forward')) y += 1;
    if (this.down('back')) y -= 1;
    if (this.down('right')) x += 1;
    if (this.down('left')) x -= 1;
    if (this.touch.enabled) {
      x += this.touch.move.x;
      y += this.touch.move.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  firing() { return this.mouse.left || this.touch.fire; }

  // ---------------------------------------------------------------- touch

  /** Wires up the on-screen controls used on touch devices. */
  setupTouch(root) {
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isTouch) return false;
    this.touch.enabled = true;
    root.classList.add('touch-mode');

    const stick = root.querySelector('#stick');
    const knob = root.querySelector('#stick-knob');
    const lookPad = root.querySelector('#look-pad');

    let stickId = null, stickOrigin = { x: 0, y: 0 };
    const stickRadius = 56;

    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      stickOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      e.preventDefault();
    }, { passive: false });

    const stickMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        let dx = t.clientX - stickOrigin.x;
        let dy = t.clientY - stickOrigin.y;
        const len = Math.hypot(dx, dy);
        if (len > stickRadius) { dx *= stickRadius / len; dy *= stickRadius / len; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.touch.move.x = dx / stickRadius;
        this.touch.move.y = -dy / stickRadius;
      }
      e.preventDefault();
    };
    stick.addEventListener('touchmove', stickMove, { passive: false });

    const stickEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        stickId = null;
        knob.style.transform = 'translate(0,0)';
        this.touch.move.x = 0;
        this.touch.move.y = 0;
      }
    };
    stick.addEventListener('touchend', stickEnd);
    stick.addEventListener('touchcancel', stickEnd);

    let lookId = null, lastLook = { x: 0, y: 0 };
    lookPad.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lastLook = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    }, { passive: false });
    lookPad.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        this.touch.look.dx += (t.clientX - lastLook.x) * 1.5;
        this.touch.look.dy += (t.clientY - lastLook.y) * 1.5;
        lastLook = { x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    }, { passive: false });
    const lookEnd = () => { lookId = null; };
    lookPad.addEventListener('touchend', lookEnd);
    lookPad.addEventListener('touchcancel', lookEnd);

    const hold = (selector, on, off) => {
      const el = root.querySelector(selector);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { on(); e.preventDefault(); }, { passive: false });
      el.addEventListener('touchend', (e) => { off?.(); e.preventDefault(); }, { passive: false });
      el.addEventListener('touchcancel', () => off?.());
    };

    hold('#btn-fire', () => { this.touch.fire = true; }, () => { this.touch.fire = false; });
    hold('#btn-jump', () => { this.touch.jumpHeld = true; this.actions.add('jump'); },
                     () => { this.touch.jumpHeld = false; this.actions.delete('jump'); });
    hold('#btn-reload', () => this.actions.add('reload'), () => this.actions.delete('reload'));
    hold('#btn-ability', () => this.actions.add('ability'), () => this.actions.delete('ability'));
    return true;
  }
}
