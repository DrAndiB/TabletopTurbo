// Closed race track defined by control points; sampled at even spacing along its length.
import * as THREE from '../vendor/three.bundle.js';
import { clamp, lerp } from './util.js';

function catmull(p0, p1, p2, p3, t, alpha = 0.5) {
  // centripetal Catmull-Rom between p1 and p2
  const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-4, alpha);
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const tt = lerp(t1, t2, t);
  const A1 = [0, 0], A2 = [0, 0], A3 = [0, 0], B1 = [0, 0], B2 = [0, 0], C = [0, 0];
  for (let k = 0; k < 2; k++) {
    A1[k] = ((t1 - tt) / (t1 - t0)) * p0[k] + ((tt - t0) / (t1 - t0)) * p1[k];
    A2[k] = ((t2 - tt) / (t2 - t1)) * p1[k] + ((tt - t1) / (t2 - t1)) * p2[k];
    A3[k] = ((t3 - tt) / (t3 - t2)) * p2[k] + ((tt - t2) / (t3 - t2)) * p3[k];
    B1[k] = ((t2 - tt) / (t2 - t0)) * A1[k] + ((tt - t0) / (t2 - t0)) * A2[k];
    B2[k] = ((t3 - tt) / (t3 - t1)) * A2[k] + ((tt - t1) / (t3 - t1)) * A3[k];
    C[k] = ((t2 - tt) / (t2 - t1)) * B1[k] + ((tt - t1) / (t2 - t1)) * B2[k];
  }
  return C;
}

export class Track {
  // points: [[x,z,(width)], ...] closed loop, driving direction = order of points
  constructor(points, { width = 14, spacing = 0.5 } = {}) {
    this.baseWidth = width;
    const n = points.length;
    // dense polyline
    const dense = [];
    const denseW = [];
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
      const w1 = p1[2] ?? width, w2 = p2[2] ?? width;
      const seg = Math.max(8, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.25));
      for (let j = 0; j < seg; j++) {
        const t = j / seg;
        dense.push(catmull(p0, p1, p2, p3, t));
        const ts = t * t * (3 - 2 * t);
        denseW.push(lerp(w1, w2, ts));
      }
    }
    // cumulative length of dense
    const cum = [0];
    for (let i = 1; i <= dense.length; i++) {
      const a = dense[i - 1], b = dense[i % dense.length];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const L = cum[dense.length];
    this.length = L;
    const N = Math.ceil(L / spacing);
    this.N = N;
    this.ds = L / N;
    this.x = new Float32Array(N); this.z = new Float32Array(N);
    this.tx = new Float32Array(N); this.tz = new Float32Array(N);
    this.w = new Float32Array(N); this.curv = new Float32Array(N);
    let k = 0;
    for (let i = 0; i < N; i++) {
      const s = i * this.ds;
      while (cum[k + 1] < s && k < dense.length - 1) k++;
      const f = (s - cum[k]) / (cum[k + 1] - cum[k] || 1);
      const a = dense[k], b = dense[(k + 1) % dense.length];
      this.x[i] = lerp(a[0], b[0], f);
      this.z[i] = lerp(a[1], b[1], f);
      this.w[i] = lerp(denseW[k], denseW[(k + 1) % dense.length], f);
    }
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      let dx = this.x[b] - this.x[a], dz = this.z[b] - this.z[a];
      const l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l; this.tz[i] = dz / l;
    }
    for (let i = 0; i < N; i++) {
      const a = (i - 2 + N) % N, b = (i + 2) % N;
      const ang1 = Math.atan2(this.tz[a], this.tx[a]), ang2 = Math.atan2(this.tz[b], this.tx[b]);
      let da = ang2 - ang1;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.curv[i] = da / (4 * this.ds); // signed curvature (1/units); + = turning right (towards +normal)
    }
  }

  idx(s) {
    const i = Math.floor(((s % this.length) + this.length) % this.length / this.ds);
    return clamp(i, 0, this.N - 1);
  }

  // Interpolated frame at arc length s. Normal n = (-tz, tx) is the driver's right-hand side
  // (screen x right, screen z down).
  at(s) {
    const L = this.length;
    s = ((s % L) + L) % L;
    const f = s / this.ds;
    const i = Math.floor(f) % this.N, j = (i + 1) % this.N, t = f - Math.floor(f);
    const x = lerp(this.x[i], this.x[j], t), z = lerp(this.z[i], this.z[j], t);
    let tx = lerp(this.tx[i], this.tx[j], t), tz = lerp(this.tz[i], this.tz[j], t);
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    return { x, z, tx, tz, nx: -tz, nz: tx, w: lerp(this.w[i], this.w[j], t), angle: Math.atan2(tz, tx), curv: this.curv[i] };
  }

  // Position offset sideways from the centreline (+ = right of travel direction).
  place(s, offset = 0) {
    const p = this.at(s);
    return { x: p.x + p.nx * offset, z: p.z + p.nz * offset, angle: p.angle, tx: p.tx, tz: p.tz, nx: p.nx, nz: p.nz, w: p.w };
  }

  // Nearest sample to (x,z). If hint given, searches a window around it first.
  nearest(x, z, hint = -1, win = 120) {
    let best = -1, bd = Infinity;
    const N = this.N;
    if (hint >= 0) {
      for (let k = -win; k <= win; k++) {
        const i = (hint + k + N) % N;
        const dx = this.x[i] - x, dz = this.z[i] - z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      // if far away, fall back to a global search
      if (Math.sqrt(bd) > this.w[best] * 1.5 + 10) hint = -1;
    }
    if (hint < 0) {
      bd = Infinity;
      for (let i = 0; i < N; i += 2) {
        const dx = this.x[i] - x, dz = this.z[i] - z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
    }
    const lateral = (x - this.x[best]) * -this.tz[best] + (z - this.z[best]) * this.tx[best];
    return { i: best, s: best * this.ds, dist: Math.sqrt(bd), lateral };
  }

  // Distance from (x,z) to centreline (global, approximate, coarse+refine).
  distTo(x, z) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.N; i += 4) {
      const dx = this.x[i] - x, dz = this.z[i] - z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return this.nearest(x, z, best, 6);
  }

  // Ribbon mesh following the track. u across (0 at left edge, 1 at right), v along in world units / vScale.
  ribbonGeometry({ width = null, offset = 0, y = 0.02, vScale = 10, step = 2, uSegments = 1, widthFn = null } = {}) {
    const N = this.N;
    const rows = Math.ceil(N / step);
    const cols = uSegments + 1;
    const pos = new Float32Array((rows + 1) * cols * 3);
    const uv = new Float32Array((rows + 1) * cols * 2);
    const idx = [];
    for (let r = 0; r <= rows; r++) {
      const i = (r * step) % N;
      const s = r * step * this.ds;
      const w = widthFn ? widthFn(this.w[i], s) : (width ?? this.w[i]);
      const nx = -this.tz[i], nz = this.tx[i];
      for (let c = 0; c < cols; c++) {
        const u = c / uSegments;
        const off = offset + (u - 0.5) * w;
        const k = (r * cols + c);
        pos[k * 3] = this.x[i] + nx * off; // right = +normal; u=0 is the left edge
        pos[k * 3 + 1] = y;
        pos[k * 3 + 2] = this.z[i] + nz * off;
        uv[k * 2] = u;
        uv[k * 2 + 1] = s / vScale;
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < uSegments; c++) {
        const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idx.push(a, b, d, b, e, d); // counter-clockwise seen from above
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // make sure normals point up regardless of winding
    const nrm = g.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    return g;
  }

  // Evenly spaced points along an edge (side: -1 left, +1 right), offset beyond the half-width.
  edgePoints(side, spacing, extra = 0, fromS = 0, toS = this.length) {
    const out = [];
    for (let s = fromS; s < toS; s += spacing) {
      const p = this.at(s);
      const off = side * (p.w / 2 + extra);
      out.push({ x: p.x + p.nx * off, z: p.z + p.nz * off, angle: p.angle, s, curv: p.curv });
    }
    return out;
  }
}
