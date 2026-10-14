// Keyboard (up to 4 players on one keyboard), gamepads and touch.
const DEFAULT_BINDINGS = [
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL' },
  { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6' },
];
const STORE = 'tabletop-turbo.bindings.v1';

const PRETTY = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Enter: 'Enter',
  ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt',
  Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Minus: '-', Equal: '=',
  Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', Insert: 'Ins', Delete: 'Del', Backspace: '⌫', Tab: 'Tab',
  NumpadEnter: 'Num ↵', NumpadAdd: 'Num +', NumpadSubtract: 'Num −', NumpadMultiply: 'Num ×', NumpadDivide: 'Num ÷', NumpadDecimal: 'Num .',
};

export class Input {
  constructor() {
    this.down = new Set();
    this.layout = null;
    this.bindings = this.loadBindings();
    this.listeners = [];
    this.capture = null; // fn(code) when rebinding
    this.touch = { left: false, right: false, active: false };
    this.padPrev = new Map();
    window.addEventListener('keydown', (e) => this.onKey(e, true), { passive: false });
    window.addEventListener('keyup', (e) => this.onKey(e, false), { passive: false });
    window.addEventListener('blur', () => this.down.clear());
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard.getLayoutMap().then((m) => { this.layout = m; this.emit('layout'); }).catch(() => {});
    }
  }

  on(fn) { this.listeners.push(fn); }
  emit(type, data) { for (const f of this.listeners) f(type, data); }

  loadBindings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (Array.isArray(s) && s.length === 4) return s;
    } catch (e) { /* storage unavailable */ }
    return DEFAULT_BINDINGS.map((b) => ({ ...b }));
  }
  saveBindings() {
    try { localStorage.setItem(STORE, JSON.stringify(this.bindings)); } catch (e) { /* ignore */ }
  }
  resetBindings() { this.bindings = DEFAULT_BINDINGS.map((b) => ({ ...b })); this.saveBindings(); }

  isGameKey(code) {
    for (const b of this.bindings) for (const k of Object.values(b)) if (k === code) return true;
    return false;
  }

  onKey(e, isDown) {
    if (this.capture && isDown) {
      e.preventDefault();
      const fn = this.capture; this.capture = null;
      fn(e.code);
      return;
    }
    const tag = (e.target && e.target.tagName) || '';
    if (this.isGameKey(e.code) && tag !== 'INPUT' && tag !== 'SELECT') e.preventDefault();
    if (isDown) {
      if (!this.down.has(e.code)) { this.down.add(e.code); this.emit('keydown', e); }
    } else {
      this.down.delete(e.code);
    }
  }

  keyLabel(code) {
    if (!code) return '—';
    if (this.layout && this.layout.get(code)) {
      const k = this.layout.get(code);
      return k.length === 1 ? k.toUpperCase() : k;
    }
    if (PRETTY[code]) return PRETTY[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
    return code;
  }

  pads() {
    const list = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    return list.filter((p) => p && p.connected);
  }
  pad(index) {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    return list[index] || null;
  }

  // Button press edges on any gamepad: returns [{pad, button}]
  pollPadPresses() {
    const out = [];
    for (const p of this.pads()) {
      const prev = this.padPrev.get(p.index) || [];
      const now = p.buttons.map((b) => b.pressed);
      now.forEach((pr, i) => { if (pr && !prev[i]) out.push({ pad: p.index, button: i }); });
      this.padPrev.set(p.index, now);
    }
    return out;
  }

  // Read controls for one driver config: {type:'keys'|'simple'|'pad'|'touch', slot, pad}
  read(cfg) {
    const out = { throttle: 0, brake: 0, steer: 0 };
    if (cfg.type === 'keys' || cfg.type === 'simple') {
      const b = this.bindings[cfg.slot];
      const L = this.down.has(b.left), R = this.down.has(b.right);
      const U = this.down.has(b.up), D = this.down.has(b.down);
      if (cfg.type === 'keys') {
        out.throttle = U ? 1 : 0; out.brake = D ? 1 : 0;
        out.steer = (R ? 1 : 0) - (L ? 1 : 0);
      } else {
        // two-key mode: always accelerating, both keys together = brake
        if (L && R) { out.brake = 1; }
        else { out.throttle = 1; out.steer = (R ? 1 : 0) - (L ? 1 : 0); }
        if (D) { out.brake = 1; out.throttle = 0; }
      }
    } else if (cfg.type === 'pad') {
      const p = this.pad(cfg.pad);
      if (p) {
        let sx = p.axes[0] || 0;
        if (Math.abs(sx) < 0.18) sx = 0; else sx = Math.sign(sx) * (Math.abs(sx) - 0.18) / 0.82;
        if (p.buttons[14]?.pressed) sx = -1;
        if (p.buttons[15]?.pressed) sx = 1;
        out.steer = Math.max(-1, Math.min(1, sx));
        const rt = p.buttons[7]?.value || 0, lt = p.buttons[6]?.value || 0;
        const a = p.buttons[0]?.pressed ? 1 : 0, bb = (p.buttons[1]?.pressed || p.buttons[2]?.pressed) ? 1 : 0;
        out.throttle = Math.max(rt, a);
        out.brake = Math.max(lt, bb);
        if (out.brake > 0.2 && out.throttle > 0.2 && lt > 0.2 && rt < 0.2) out.throttle = 0;
      }
    } else if (cfg.type === 'touch') {
      const t = this.touch;
      if (t.left && t.right) out.brake = 1;
      else { out.throttle = 1; out.steer = (t.right ? 1 : 0) - (t.left ? 1 : 0); }
    }
    return out;
  }
}
