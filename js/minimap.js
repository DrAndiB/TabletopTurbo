// Mini map: a small top-down outline of the track, turned like the race camera (screen right = +x, down the
// screen = +z), with a dot per car in its player colour. The outline is drawn once per track and size into an
// offscreen canvas; the dots are redrawn at most ~30 times a second. Lives inside #hud, so it hides with the HUD.
const LONG = 160, LONG_SMALL = 112; // long side in CSS px: desktop and tablets, phones
const PAD = 7;
const INK = '#1f1a17', ROAD = '#fff4dc';

export class MiniMap {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.track = null; this.startS = 0;
    this.on = false;
    this.key = ''; this.last = 0; this.hintT = 0;
  }

  setTrack(track, startS = 0) {
    if (track === this.track && startS === this.startS) return;
    this.track = track; this.startS = startS; this.key = '';
  }

  show(on) {
    this.on = !!on && !!this.track;
    this.cv.hidden = !this.on;
    this.last = 0; this.hintT = 0;
  }
  toggle() { this.show(!this.on); return this.on; }

  // size the canvas and draw the outline (again only when the screen class or pixel ratio changes)
  layout() {
    const tr = this.track;
    const small = innerHeight <= 500 || innerWidth <= 600;
    const long = small ? LONG_SMALL : LONG;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const key = `${long}|${dpr}`;
    if (key === this.key) return;
    this.key = key;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, wSum = 0;
    for (let i = 0; i < tr.N; i++) {
      const h = tr.w[i] / 2;
      minX = Math.min(minX, tr.x[i] - h); maxX = Math.max(maxX, tr.x[i] + h);
      minZ = Math.min(minZ, tr.z[i] - h); maxZ = Math.max(maxZ, tr.z[i] + h);
      wSum += tr.w[i];
    }
    const k = (long - 2 * PAD) / Math.max(maxX - minX, maxZ - minZ, 1); // CSS px per world unit
    const cw = Math.round((maxX - minX) * k + 2 * PAD), ch = Math.round((maxZ - minZ) * k + 2 * PAD);
    this.cv.style.width = cw + 'px'; this.cv.style.height = ch + 'px';
    this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr);
    this.s = k * dpr; this.ox = (PAD - minX * k) * dpr; this.oz = (PAD - minZ * k) * dpr;
    this.dpr = dpr; this.dot = dpr * Math.max(0.8, long / LONG);

    const base = document.createElement('canvas');
    base.width = this.cv.width; base.height = this.cv.height;
    const g = base.getContext('2d');
    g.fillStyle = 'rgba(20, 16, 14, 0.3)';
    roundRect(g, 0, 0, base.width, base.height, 10 * dpr); g.fill();
    const path = new Path2D();
    for (let i = 0; i < tr.N; i += 2) {
      const px = this.ox + tr.x[i] * this.s, pz = this.oz + tr.z[i] * this.s;
      if (i === 0) path.moveTo(px, pz); else path.lineTo(px, pz);
    }
    path.closePath();
    const rw = Math.max(2.4 * dpr, (wSum / tr.N) * this.s);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = rw + 3 * dpr; g.stroke(path);
    g.strokeStyle = ROAD; g.lineWidth = rw; g.stroke(path);
    // start/finish: a dark tick across the road
    const p = tr.at(this.startS), half = rw / 2 + 2.5 * dpr;
    const sx = this.ox + p.x * this.s, sz = this.oz + p.z * this.s;
    g.strokeStyle = INK; g.lineWidth = 2.4 * dpr; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(sx - p.nx * half, sz - p.nz * half); g.lineTo(sx + p.nx * half, sz + p.nz * half); g.stroke();
    this.base = base;
  }

  draw(game, force = false) {
    if (!this.on || !this.track) return;
    const now = performance.now();
    if (!force && now - this.last < 33) return;
    this.last = now;
    this.layout();
    if (now - this.hintT > 500) { this.hintT = now; this.avoidHint(); }
    const g = this.ctx, s = this.s, d = this.dot;
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    g.drawImage(this.base, 0, 0);
    const X = (x) => this.ox + x * s, Z = (z) => this.oz + z * s;
    const cars = game.cars.filter((e) => !e.out && e.car.state !== 'hidden' && e.car.state !== 'out');
    // CPU cars first, the ghost, then the human drivers on top: bigger, with a white ring
    for (const e of cars) {
      if (e.human) continue;
      g.beginPath(); g.arc(X(e.car.x), Z(e.car.z), 3.2 * d, 0, Math.PI * 2);
      g.fillStyle = e.color.hex; g.fill();
      g.lineWidth = 1 * d; g.strokeStyle = INK; g.stroke();
    }
    const gp = game.tt && game.cars[0] ? game.ghostPose() : null;
    if (gp) {
      g.beginPath(); g.arc(X(gp.x), Z(gp.z), 3.6 * d, 0, Math.PI * 2);
      g.lineWidth = 3.4 * d; g.strokeStyle = INK; g.stroke();
      g.lineWidth = 1.8 * d; g.strokeStyle = game.cars[0].color.hex; g.stroke();
    }
    for (const e of cars) {
      if (!e.human) continue;
      g.beginPath(); g.arc(X(e.car.x), Z(e.car.z), 4.6 * d, 0, Math.PI * 2);
      g.fillStyle = e.color.hex; g.fill();
      g.lineWidth = 2 * d; g.strokeStyle = '#fff'; g.stroke();
      g.beginPath(); g.arc(X(e.car.x), Z(e.car.z), 5.8 * d, 0, Math.PI * 2);
      g.lineWidth = 0.9 * d; g.strokeStyle = INK; g.stroke();
    }
  }

  // the built-in graphics hint sits at the bottom of the screen while it is up: stay above it
  avoidHint() {
    const h = document.getElementById('gpu-hint');
    let bottom = '';
    if (h && !h.hidden) {
      const r = h.getBoundingClientRect(), m = this.cv.getBoundingClientRect();
      if (r.width && r.left < m.right && r.right > m.left) bottom = Math.ceil(innerHeight - r.top + 10) + 'px';
    }
    if (this.cv.style.bottom !== bottom) this.cv.style.bottom = bottom;
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
