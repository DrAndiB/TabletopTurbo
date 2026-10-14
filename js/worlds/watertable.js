// World 7: a children's sand-and-water play table on a sunny patio. Toy speedboats race through
// channels dug in the sand and a lagoon with a lighthouse island: clear sunlit water with dancing
// caustics, a hose-fed current, a water wheel, a sluice lock with alternating gates, soap suds,
// shallow sandbars, a plughole whirlpool, a floating jump ramp and rubber ducks to shove around.

const TRACK = [
  [-80, 62], [-20, 63], [40, 61], [80, 53], [104, 32], [112, 6], [109, -20], [113, -42, 17], [100, -59, 17], [70, -64],
  [30, -64], [-8, -63], [-26, -61], [-39, -54, 17], [-43, -42, 17], [-38, -30, 17], [-24, -24], [0, -24], [26, -25],
  [52, -22], [64, -6, 17], [58, 12, 17], [36, 22], [0, 24], [-36, 20, 18], [-66, 6, 20], [-90, -14, 20], [-116, -16, 20],
  [-132, 6, 19], [-128, 34, 17], [-114, 55], [-96, 62],
];

// tub interior (half extents, corner radius), rim
const IX = 146, IZ = 88, RC = 24, RIM_W = 9, RIM_Y = 4.2;
const GW = 2 * IX + 1, GH = 2 * IZ + 1, G0X = -IX, G0Z = -IZ; // 1-unit terrain grid
const HMIN = -8, HMAX = 4, FMAX = 14;
const DRAIN = { x: -80, z: -29, r: 3.3, pull: 16 };
const ISLAND = { x: -100, z: 18, R: 12, H: 3.2 };
const LAGOON = [[-54, 4], [-57, -14], [-68, -32], [-86, -45], [-108, -50], [-130, -46], [-152, -38], [-152, 30], [-136, 42],
  [-120, 46], [-100, 47], [-80, 42], [-64, 30], [-56, 16]];
const WHEEL = { w: 0.9, R: 7.4, axleY: 5.0, rm: 6.2 };
const GATE_P = 8; // sluice cycle (s)

let A = null; // runtime state for tick/animate

// Safety net: nothing may slip past the tub's rounded inner wall (it would vanish under the rim).
function keepInTub(c, margin = 1.3) {
  const ax = Math.abs(c.x), az = Math.abs(c.z), sx = Math.sign(c.x) || 1, sz = Math.sign(c.z) || 1;
  const qx = ax - (IX - RC), qz = az - (IZ - RC);
  let inside, nx, nz; // inside distance and outward normal
  if (qx > 0 && qz > 0) { const l = Math.hypot(qx, qz) || 1; inside = RC - l; nx = sx * qx / l; nz = sz * qz / l; }
  else if (qx > qz) { inside = RC - qx; nx = sx; nz = 0; }
  else { inside = RC - qz; nx = 0; nz = sz; }
  if (inside >= margin) return;
  const push = margin - inside;
  c.x -= nx * push; c.z -= nz * push;
  const vn = c.vx * nx + c.vz * nz;
  if (vn > 0) { c.vx -= nx * vn * 1.3; c.vz -= nz * vn * 1.3; }
}

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// leaf position of the sluice gate: 0 = down (blocking), 1 = raised; side 0 = left half, 1 = right half
function gateLift(side, t) {
  const u = (((t / GATE_P) % 1) + 1) % 1;
  const a = side === 0 ? 0 : 0.5;
  const v = (((u - a) % 1) + 1) % 1; // 0..1 within this leaf's cycle: down during [0, 0.3], both open between
  if (v < 0.3) return 0;
  if (v < 0.36) return ss(0.3, 0.36, v);
  if (v < 0.94) return 1;
  return 1 - ss(0.94, 1.0, v);
}

function flowAt(x, z) {
  if (!A) return null;
  const fx = x - G0X, fz = z - G0Z;
  if (fx < 0 || fz < 0 || fx >= GW - 1 || fz >= GH - 1) return null;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const k = j * GW + i, F = A.FX, G = A.FZ;
  const a = lerp(lerp(F[k], F[k + 1], u), lerp(F[k + GW], F[k + GW + 1], u), v);
  const b = lerp(lerp(G[k], G[k + 1], u), lerp(G[k + GW], G[k + GW + 1], u), v);
  return a === 0 && b === 0 ? null : [a, b];
}

export default {
  id: 'watertable',
  name: 'Splash Lagoon Regatta',
  blurb: 'Speedboats on a sunny sand-and-water table: currents, a sluice lock and a whirlpool.',
  vehicle: 'boat',
  seed: 31,
  track: { points: TRACK, width: 16, startS: 40 },
  bounds: { minX: -IX, maxX: IX, minZ: -IZ, maxZ: IZ },
  fallOffEdges: false,
  floorY: -76,
  offCourse: 18,
  wake: { color: 0xf3fcff },
  dustColor: 0xeefaff,
  lighting: {
    sunDir: [-0.55, 1.0, -0.42], sunColor: 0xfff1d8, sunIntensity: 2.6,
    hemiSky: 0xb8dcff, hemiGround: 0xc7ad80, hemiIntensity: 0.55,
    envIntensity: 0.4, exposure: 0.92, background: 0xa6d4f2, shadowRadius: 1.4,
    fog: { color: 0xcfe6f6, near: 125, far: 560 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const PI = Math.PI, L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const Q = (K.quality && K.quality.grass) || 0.7;
    A = { uTime: { value: 0 }, anim: [], ducks: [], emit: [] };
    const keep = [];
    const sAt = (x, z) => track.distTo(x, z).s;
    const wrapS = (s) => ((s % L) + L) % L;
    const dS = (a, b) => { let d = wrapS(a - b); if (d > L / 2) d -= L; return d; };
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`watertable: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };
    const PLC = new Map();
    const PL = (c, rough = 0.35) => { const k = c + ':' + rough; if (!PLC.has(k)) PLC.set(k, K.plastic(c, rough)); return PLC.get(k); };
    // merge a prop's meshes per material (one draw per material instead of one per part)
    const mergeGroup = (g) => {
      g.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(g.matrixWorld).invert();
      const buckets = new Map();
      g.traverse((o) => { if (o.isMesh && !Array.isArray(o.material)) { const k = o.material.uuid; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(o); } });
      const out = new T.Group();
      for (const list of buckets.values()) {
        const geos = list.map((o) => {
          const gg = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          gg.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
          for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k);
          if (!gg.attributes.uv) gg.setAttribute('uv', new T.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
          return gg;
        });
        const m = new T.Mesh(K.BufferGeometryUtils.mergeGeometries(geos, false), list[0].material);
        m.castShadow = true; m.receiveShadow = true;
        out.add(m);
      }
      return out;
    };

    // batched contact shadows (opacity rides in the unused y scale)
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.35, ang = 0, y = 0.06) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });

    // ============================================================================
    // FIELDS: distance to the track, lagoon signed distance, heights, flow
    // ============================================================================
    const NC = GW * GH;
    const DIST = new Float32Array(NC).fill(99), SI = new Int32Array(NC).fill(-1);
    for (let i = 0; i < track.N; i++) {
      const x = track.x[i], z = track.z[i], R = track.w[i] / 2 + 16;
      const x0 = Math.max(0, Math.floor(x - R - G0X)), x1 = Math.min(GW - 1, Math.ceil(x + R - G0X));
      const z0 = Math.max(0, Math.floor(z - R - G0Z)), z1 = Math.min(GH - 1, Math.ceil(z + R - G0Z));
      for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
        const d = Math.hypot(gx + G0X - x, gz + G0Z - z), k = gz * GW + gx;
        if (d < DIST[k]) { DIST[k] = d; SI[k] = i; }
      }
    }
    const latOf = (k, x, z) => { const i = SI[k]; return (x - track.x[i]) * -track.tz[i] + (z - track.z[i]) * track.tx[i]; };

    // lagoon outline: smooth closed curve through the hand points
    const lagPoly = (() => {
      const c = new T.CatmullRomCurve3(LAGOON.map(([x, z]) => new T.Vector3(x, 0, z)), true, 'centripetal');
      return c.getSpacedPoints(160).slice(0, 160).map((p, i) => [p.x + Math.sin(i * 0.9) * 0.8, p.z + Math.cos(i * 1.3) * 0.8]);
    })();
    const inPoly = (x, z, poly) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      }
      return inside;
    };
    const LD = new Float32Array(NC).fill(99);
    {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const [x, z] of lagPoly) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); }
      for (let gz = 0; gz < GH; gz++) for (let gx = 0; gx < GW; gx++) {
        const x = gx + G0X, z = gz + G0Z;
        if (x < a - 20 || x > c + 20 || z < b - 20 || z > d + 20) continue;
        let m = Infinity;
        for (let i = 0; i < lagPoly.length; i++) {
          const p = lagPoly[i], q = lagPoly[(i + 1) % lagPoly.length];
          const dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz;
          const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / l2));
          const e = Math.hypot(x - p[0] - dx * t, z - p[1] - dz * t);
          if (e < m) m = e;
        }
        LD[gz * GW + gx] = inPoly(x, z, lagPoly) ? -m : m;
      }
    }
    const lagSD = (x, z) => { const gx = Math.round(x - G0X), gz = Math.round(z - G0Z); if (gx < 0 || gz < 0 || gx >= GW || gz >= GH) return 99; return LD[gz * GW + gx]; };

    // noise (bilinear on tileable fields)
    const NS = 256;
    const nA = TX.noiseField(NS, { seed: 301, period: 6, oct: 5 });
    const nB = TX.noiseField(NS, { seed: 302, period: 16, oct: 3 });
    const samp = (f, u, v) => {
      u = ((u % NS) + NS) % NS; v = ((v % NS) + NS) % NS;
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, i1 = (i + 1) % NS, j1 = (j + 1) % NS;
      return lerp(lerp(f[j * NS + i], f[j * NS + i1], fu), lerp(f[j1 * NS + i], f[j1 * NS + i1], fu), fv);
    };
    const n1 = (x, z) => samp(nA, x * 0.72 + 40, z * 0.72 + 90);
    const n2 = (x, z) => samp(nB, x * 1.6, z * 1.6);
    const sNoise = (s) => samp(nB, s * 0.35, 17.3);

    // track features (arc lengths)
    const S = {
      start: 40,
      sandbar1: sAt(92, 47), currentE0: sAt(108, 22), currentE1: sAt(112, -44), hose: sAt(100, -59),
      plastic0: sAt(92, -61), plastic1: sAt(-12, -63), north1: sAt(-28, -60),
      wheel: sAt(60, -64), gate: sAt(14, -64), suds: sAt(30, -25), ramp: sAt(14, 23.5),
      sandbar2: sAt(-130, 18),
    };
    const inRange = (s, a, b) => wrapS(s - a) <= wrapS(b - a);
    const SANDBARS = [
      { s: S.sandbar1, lat: -4.2, la: 15, lc: 4.6 },
      { s: S.sandbar2, lat: -5.5, la: 14, lc: 5.5 },
    ];

    // ---------------- heights ----------------
    const H = new Float32Array(NC), MAT = new Float32Array(NC);
    const bank = (e, bh) => (e < 1 ? -0.9 + 0.9 * e : bh * ss(1, 5.5, e));
    const rrIn = (x, z, hx, hz, rad) => { // signed distance, positive inside a rounded rectangle
      const qx = Math.abs(x) - (hx - rad), qz = Math.abs(z) - (hz - rad);
      return -(Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rad);
    };
    for (let gz = 0; gz < GH; gz++) for (let gx = 0; gx < GW; gx++) {
      const k = gz * GW + gx, x = gx + G0X, z = gz + G0Z;
      const a1 = n1(x, z), b1 = n2(x, z);
      const bh = 1.7 + 1.5 * a1 + 0.5 * (b1 - 0.5);
      let y = bh;
      const d = DIST[k];
      let s = -1, hw = 8, lat = 0;
      if (SI[k] >= 0) {
        const i = SI[k]; s = i * track.ds; hw = track.w[i] / 2; lat = latOf(k, x, z);
        const depth = 2.7 + 1.5 * sNoise(s) + 0.6 * (b1 - 0.5);
        const e = d - hw;
        y = e >= 0 ? bank(e, bh) : -0.9 - (depth - 0.9) * Math.pow(1 - (d / hw) ** 2, 0.75);
        const pspan = wrapS(S.plastic1 - S.plastic0), pu = wrapS(s - S.plastic0);
        if (pu < pspan + 5 || pu > L - 5) {
          const uu = pu > L - 5 ? pu - L : pu;
          const wgt = ss(-5, 1.5, uu) * (1 - ss(pspan - 1.5, pspan + 5, uu));
          if (wgt > 0 && d < hw + 0.6) {
            const t = Math.min(1, d / hw);
            y = lerp(y, -2.7 + 1.9 * Math.pow(t, 6), wgt);
            MAT[k] = wgt;
          }
        }
        // sandbars
        for (const sb of SANDBARS) {
          const da = dS(s, sb.s), dl = lat - sb.lat;
          const q = (da / sb.la) ** 2 + (dl / sb.lc) ** 2;
          if (q < 2.2 && d < hw + 1) y = Math.max(y, -0.33 - 0.25 * (b1 - 0.5) - 1.8 * ss(0.5, 1.5, q));
        }
      }
      // lagoon
      const le = LD[k];
      if (le < 30) {
        const ldep = 4.0 + 1.4 * a1;
        const yl = le >= 0 ? bank(le, bh) : -0.9 - (ldep - 0.9) * Math.pow(ss(0, 18, -le), 0.8);
        y = Math.min(y, yl);
      }
      // the lighthouse island
      {
        const rr = Math.hypot(x - ISLAND.x, z - ISLAND.z) * (1 + 0.08 * Math.sin(Math.atan2(z - ISLAND.z, x - ISLAND.x) * 3 + 1));
        if (rr < ISLAND.R + 9) y = Math.max(y, -3.5 + (ISLAND.H + 0.3 * a1 + 3.5) * ss(ISLAND.R + 5, ISLAND.R - 5, rr));
      }
      // small surface detail on land, a little relief on the bottom
      if (y > 0.2) y += (b1 - 0.5) * 0.35 * ss(0.2, 1.5, y);
      else if (y < -1.5) y += (a1 - 0.5) * 0.5;
      // sand piled against the tub wall; nothing pokes through the rim
      const dw = rrIn(x, z, IX, IZ, RC);
      if (y > 0.3 && dw < 7) y += 0.7 * ss(7, 0, dw);
      if (dw < 0) y = Math.min(y, 0.6);
      H[k] = Math.max(-7.5, Math.min(3.9, y));
    }
    const hAt = (x, z) => {
      const fx = Math.min(GW - 1.001, Math.max(0, x - G0X)), fz = Math.min(GH - 1.001, Math.max(0, z - G0Z));
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * GW + i;
      return lerp(lerp(H[k], H[k + 1], u), lerp(H[k + GW], H[k + GW + 1], u), v);
    };
    A.hAt = hAt;

    // ---------------- flow field (currents) ----------------
    const FX = new Float32Array(NC), FZ = new Float32Array(NC);
    const CURRENTS = [
      { a: S.currentE0, b: S.currentE1, v: -8 },   // the hose water runs south down the east channel: against you
      { a: S.hose, b: S.north1, v: 11 },           // and west along the moulded river: with you
    ];
    const LC = { x: -98, z: -2 };
    for (let gz = 0; gz < GH; gz++) for (let gx = 0; gx < GW; gx++) {
      const k = gz * GW + gx, x = gx + G0X, z = gz + G0Z;
      if (H[k] > -0.15) continue;
      let fx = 0, fz = 0;
      if (SI[k] >= 0) {
        const i = SI[k], s = i * track.ds, hw = track.w[i] / 2, d = DIST[k];
        if (d < hw + 2) {
          for (const c of CURRENTS) {
            if (!inRange(s, c.a, c.b)) continue;
            const span = wrapS(c.b - c.a), u = wrapS(s - c.a);
            const w = ss(0, 16, u) * (1 - ss(span - 16, span, u)) * (1 - 0.4 * Math.min(1, (d / hw) ** 2));
            fx += track.tx[i] * c.v * w; fz += track.tz[i] * c.v * w;
          }
        }
      }
      const le = LD[k];
      if (le < 0) {
        // gentle anticlockwise (on screen) swirl round the lagoon
        const dx = x - LC.x, dz = z - LC.z, rr = Math.hypot(dx, dz) || 1;
        const v = 3.2 * ss(0, 10, -le) * ss(4, 20, rr);
        fx += (dz / rr) * v; fz += (-dx / rr) * v;
      }
      {
        const dx = x - DRAIN.x, dz = z - DRAIN.z, rr = Math.hypot(dx, dz) || 1;
        if (rr < 22) {
          const kk = 1 - rr / 22;
          const vt = 11 * Math.pow(kk, 1.3), vr = 5 * kk * kk;
          fx += (dz / rr) * vt - (dx / rr) * vr; fz += (-dx / rr) * vt - (dz / rr) * vr;
        }
      }
      FX[k] = fx; FZ[k] = fz;
    }
    A.FX = FX; A.FZ = FZ;

    // ---------------- data texture for the water shader: height, flow, shore proximity ----------------
    const landish = (k, x, z) => H[k] > -0.05 || rrIn(x, z, IX, IZ, RC) < 0.8;
    const SHORE = new Float32Array(NC);
    {
      const land = new Uint8Array(NC);
      for (let gz = 0; gz < GH; gz++) for (let gx = 0; gx < GW; gx++) { const k = gz * GW + gx; land[k] = landish(k, gx + G0X, gz + G0Z) ? 1 : 0; }
      const R = 3;
      for (let gz = 0; gz < GH; gz++) for (let gx = 0; gx < GW; gx++) {
        const k = gz * GW + gx;
        if (land[k]) { SHORE[k] = 1; continue; }
        let m = 9;
        for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
          const xx = gx + i, zz = gz + j;
          if (xx < 0 || zz < 0 || xx >= GW || zz >= GH) { m = Math.min(m, Math.hypot(i, j)); continue; }
          if (land[zz * GW + xx]) m = Math.min(m, Math.hypot(i, j));
        }
        SHORE[k] = Math.max(0, 1 - m / 3.2);
      }
    }
    const dataTex = (() => {
      const d = new Uint8Array(NC * 4);
      for (let k = 0; k < NC; k++) {
        d[k * 4] = Math.round(Math.max(0, Math.min(1, (H[k] - HMIN) / (HMAX - HMIN))) * 255);
        d[k * 4 + 1] = Math.round(128 + Math.max(-1, Math.min(1, FX[k] / FMAX)) * 127);
        d[k * 4 + 2] = Math.round(128 + Math.max(-1, Math.min(1, FZ[k] / FMAX)) * 127);
        d[k * 4 + 3] = Math.round(SHORE[k] * 255);
      }
      const t = new T.DataTexture(d, GW, GH, T.RGBAFormat, T.UnsignedByteType);
      t.magFilter = T.LinearFilter; t.minFilter = T.LinearFilter; t.generateMipmaps = false;
      t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.flipY = false; t.needsUpdate = true;
      return t;
    })();
    const uGrid = { value: new T.Vector4(G0X, G0Z, 1 / GW, 1 / GH) };

    // ============================================================================
    // TEXTURES
    // ============================================================================
    const noiseTex = (() => {
      const f1 = TX.noiseField(256, { seed: 311, period: 8, oct: 4 }), f2 = TX.noiseField(256, { seed: 312, period: 4, oct: 4 });
      const c = TX.paint(256, 256, (x, y, u, v, o) => { const k = y * 256 + x; o[0] = f1[k] * 255; o[1] = f2[k] * 255; o[2] = 128; });
      return TX.toTexture(c, { srgb: false });
    })();
    const waterN = (() => {
      const f = TX.noiseField(256, { seed: 321, period: 10, oct: 4, gain: 0.55 });
      return TX.toTexture(TX.normalFromHeight(f, 256, 256, 5.0), { srgb: false });
    })();
    const caustTex = (() => {
      const SZ = 256, C = 7, rr = K.rng(77);
      const pts = [];
      for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push([(i + 0.1 + rr() * 0.8) / C, (j + 0.1 + rr() * 0.8) / C]);
      const c = TX.paint(SZ, SZ, (x, y, u, v, o) => {
        const ci = Math.floor(u * C), cj = Math.floor(v * C);
        let f1 = 9, f2 = 9;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = ci + di, jj = cj + dj;
          const p = pts[((jj + C) % C) * C + ((ii + C) % C)];
          const px = p[0] + (ii < 0 ? -1 : ii >= C ? 1 : 0), py = p[1] + (jj < 0 ? -1 : jj >= C ? 1 : 0);
          const dd = Math.hypot(u - px, v - py) * C;
          if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
        }
        const e = f2 - f1;
        const val = Math.pow(1 - ss(0, 0.42, e), 2.4) * 0.92 + 0.08 * (1 - ss(0, 1.0, e));
        o[0] = o[1] = o[2] = val * 255;
      });
      return TX.toTexture(c, { srgb: false });
    })();
    const skyEnv = (() => {
      const c = TX.makeCanvas(512, 256), g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#3d8ee0'); gr.addColorStop(0.75, '#9ccdf2'); gr.addColorStop(1, '#e4f3fc');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
      const rr = K.rng(5);
      for (let i = 0; i < 22; i++) {
        const x = rr() * 512, y = 18 + rr() * 90, w = 22 + rr() * 50;
        for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(255,255,255,${0.3 + rr() * 0.4})`; g.beginPath(); g.ellipse(x + rr() * w, y + rr() * 8, w * 0.4, w * 0.15, 0, 0, 6.3); g.fill(); }
      }
      g.fillStyle = '#b9a98c'; g.fillRect(0, 128, 512, 128);
      g.fillStyle = '#4f8a3a'; for (let x = 0; x < 512; x += 5) g.fillRect(x, 118 + Math.sin(x * 0.05) * 5 + rr() * 6, 6, 22);
      const t = TX.toTexture(c, { wrap: false });
      t.mapping = T.EquirectangularReflectionMapping;
      return t;
    })();

    // ============================================================================
    // UNDERWATER LOOK: absorption tint + dancing caustics for anything below the waterline
    // ============================================================================
    const uDeepTint = { value: new T.Color(0x1f7f8c) };
    const aquaVert = (sh) => {
      sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 wq = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          wq = instanceMatrix * wq;
          #endif
          vWP = (modelMatrix * wq).xyz; }`);
    };
    const AQUA_FRAG = `
      if (vWP.y < 0.02) {
        float dep = max(0.0, -vWP.y);
        vec2 cp = vWP.xz;
        vec2 wob = (texture2D(uNoiseT, cp * 0.021 + uTime * 0.013).rg - 0.5) * 3.0;
        float c1 = texture2D(uCaust, (cp + wob) * 0.072 + vec2(uTime * 0.041, uTime * 0.023)).r;
        float c2 = texture2D(uCaust, (cp - wob) * 0.053 + vec2(-uTime * 0.029, uTime * 0.037) + 0.37).r;
        float caus = c1 * c2 * 3.2 + (c1 + c2) * 0.1;
        float att = exp(-dep * 0.3);
        vec3 tint = mix(uDeepTint, vec3(1.0), att);
        diffuseColor.rgb *= tint * (1.0 + caus * smoothstep(0.0, 0.5, dep) * (0.35 + 0.65 * att) * 1.5);
      }`;
    const aqua = (mat, extraFrag = '') => {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = A.uTime; sh.uniforms.uCaust = { value: caustTex }; sh.uniforms.uNoiseT = { value: noiseTex }; sh.uniforms.uDeepTint = uDeepTint;
        aquaVert(sh);
        sh.fragmentShader = 'varying vec3 vWP;\nuniform float uTime;\nuniform sampler2D uCaust;\nuniform sampler2D uNoiseT;\nuniform vec3 uDeepTint;\n' +
          sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + extraFrag + AQUA_FRAG);
      };
      mat.customProgramCacheKey = () => 'aqua' + (extraFrag ? extraFrag.length : 0);
      return mat;
    };

    // ============================================================================
    // TERRAIN: sand banks, islands, channel bottoms
    // ============================================================================
    const sand = TX.mottledTextures({ size: 512, a: 0xe3c896, b: 0xcfae78, c: 0xefdcb2, seed: 331, period: 16, speck: 0.32, bump: 3.2, pebbles: 260, pebbleColor: 0xb59c78 });
    for (const t of [sand.map, sand.normalMap]) t.repeat.set(1, 1);
    const terrMat = K.std({ map: sand.map, normalMap: sand.normalMap, normalScale: V2(0.9), roughness: 0.93 });
    {
      const SAND_FRAG = `
        float mac = texture2D(uNoiseT, vWP.xz * 0.009).r, mic = texture2D(uNoiseT, vWP.xz * 0.061 + 0.3).g;
        diffuseColor.rgb *= 0.86 + mac * 0.24 + (mic - 0.5) * 0.1;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.84, 0.97) * (0.95 + mic * 0.08), vMat);
        float wet = 1.0 - smoothstep(0.03, 0.95, vWP.y);
        diffuseColor.rgb *= 1.0 - 0.32 * wet * (1.0 - vMat);
      `;
      terrMat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = A.uTime; sh.uniforms.uCaust = { value: caustTex }; sh.uniforms.uNoiseT = { value: noiseTex }; sh.uniforms.uDeepTint = uDeepTint;
        aquaVert(sh);
        sh.vertexShader = 'attribute float aMat;\nvarying float vMat;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;');
        sh.fragmentShader = 'varying vec3 vWP;\nvarying float vMat;\nuniform float uTime;\nuniform sampler2D uCaust;\nuniform sampler2D uNoiseT;\nuniform vec3 uDeepTint;\n' +
          sh.fragmentShader
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + SAND_FRAG + AQUA_FRAG)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
              roughnessFactor = mix(roughnessFactor, 0.42, (1.0 - smoothstep(0.03, 0.7, vWP.y)) * step(0.0, vWP.y));
              roughnessFactor = mix(roughnessFactor, 0.5, vMat);`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
              if (vWP.y < -0.3) {
                float ph = dot(vWP.xz, vec2(0.62, 0.95)) * 1.25 + texture2D(uNoiseT, vWP.xz * 0.02).r * 9.0;
                vec3 rp = vec3(0.62, 0.0, 0.95) * cos(ph) * 0.22 * (1.0 - vMat);
                normal = normalize(normal + (viewMatrix * vec4(rp, 0.0)).xyz);
              }`);
      };
      terrMat.customProgramCacheKey = () => 'wt-terrain';
      const CH = 49;
      for (let cz = 0; cz < GH - 1; cz += CH) for (let cx = 0; cx < GW - 1; cx += CH) {
        const nx = Math.min(CH, GW - 1 - cx), nz = Math.min(CH, GH - 1 - cz), W1 = nx + 1;
        const nv = (nx + 1) * (nz + 1);
        const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), U = new Float32Array(nv * 2), M = new Float32Array(nv);
        for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
          const gx = cx + i, gz = cz + j, k = gz * GW + gx, v = j * W1 + i;
          const x = gx + G0X, z = gz + G0Z;
          P[v * 3] = x; P[v * 3 + 1] = H[k]; P[v * 3 + 2] = z;
          const hl = H[gz * GW + Math.max(0, gx - 1)], hr = H[gz * GW + Math.min(GW - 1, gx + 1)];
          const hu = H[Math.max(0, gz - 1) * GW + gx], hd = H[Math.min(GH - 1, gz + 1) * GW + gx];
          const ddx = (hr - hl) / 2, ddz = (hd - hu) / 2, l = Math.hypot(ddx, 1, ddz);
          Nn[v * 3] = -ddx / l; Nn[v * 3 + 1] = 1 / l; Nn[v * 3 + 2] = -ddz / l;
          U[v * 2] = x / 13; U[v * 2 + 1] = -z / 13;
          M[v] = MAT[k];
        }
        const idx = [];
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
          const a = j * W1 + i, b = a + 1, c = a + W1, d = c + 1;
          if (Math.abs(P[a * 3 + 1] - P[d * 3 + 1]) < Math.abs(P[b * 3 + 1] - P[c * 3 + 1])) idx.push(a, c, d, a, d, b);
          else idx.push(a, c, b, b, c, d);
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(Nn, 3));
        g.setAttribute('uv', new T.BufferAttribute(U, 2)); g.setAttribute('aMat', new T.BufferAttribute(M, 1));
        g.setIndex(idx); g.computeBoundingSphere();
        const m = new T.Mesh(g, terrMat); m.receiveShadow = true; m.castShadow = false;
        K.group.add(m); keep.push(m);
      }
    }

    // ============================================================================
    // WATER SURFACE
    // ============================================================================
    {
      const mat = K.phys({ color: 0xffffff, roughness: 0.05, metalness: 0, ior: 1.33, specularIntensity: 1, transparent: true, envMap: skyEnv, envMapIntensity: 1.0 });
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, {
          uTime: A.uTime, uData: { value: dataTex }, uGrid, uWN: { value: waterN }, uNoiseT: { value: noiseTex },
          uShallow: { value: new T.Color(0x86e4d6) }, uMid: { value: new T.Color(0x22aabd) }, uDeep: { value: new T.Color(0x0b5d7e) },
        });
        sh.vertexShader = 'varying vec2 vWXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
        sh.fragmentShader = `varying vec2 vWXZ;
          uniform float uTime; uniform sampler2D uData, uWN, uNoiseT; uniform vec4 uGrid; uniform vec3 uShallow, uMid, uDeep;
          float gDepth; vec2 gFlow; float gShore; vec3 gNW = vec3(0.0, 1.0, 0.0);
          vec3 flowN(vec2 p, vec2 fl, float sc, float ofs) {
            float t = uTime * 0.6 + ofs;
            float p0 = fract(t), p1 = fract(t + 0.5);
            float w = abs(0.5 - p0) * 2.0;
            vec3 a = texture2D(uWN, p * sc - fl * p0 * sc * 1.66).xyz;
            vec3 b = texture2D(uWN, p * sc - fl * p1 * sc * 1.66 + 0.43).xyz;
            return mix(b, a, w) * 2.0 - 1.0;
          }
          ` + sh.fragmentShader
          .replace('#include <color_fragment>', `#include <color_fragment>
            {
              vec4 hs = texture2D(uData, (vWXZ - uGrid.xy + 0.5) * uGrid.zw);
              float hgt = hs.r * 12.0 - 8.0;
              gDepth = max(0.0, -hgt);
              gFlow = (hs.gb * 2.0 - 1.0) * 14.0;
              gShore = hs.a;
              float kd = 1.0 - exp(-gDepth * 0.4);
              vec3 wc = mix(uShallow, uMid, smoothstep(0.0, 0.6, kd));
              wc = mix(wc, uDeep, smoothstep(0.6, 1.0, kd));
              float alpha = 0.07 + 0.83 * kd;
              // foam lapping at the shore, broken up by noise
              vec2 fp = vWXZ;
              float fnz = texture2D(uNoiseT, fp * 0.09 + vec2(uTime * 0.03, -uTime * 0.02)).g;
              float fnz2 = texture2D(uNoiseT, fp * 0.21 - vec2(uTime * 0.05, uTime * 0.04)).r;
              float lap = 0.5 + 0.5 * sin(uTime * 1.9 + fp.x * 0.23 + fp.y * 0.31 + fnz * 6.0);
              float band = gShore * (1.0 - smoothstep(0.05, 1.25, gDepth));
              float foam = smoothstep(0.5, 0.72, band * 0.95 + fnz2 * 0.35 - 0.12 + lap * 0.12);
              foam = max(foam, smoothstep(0.84, 0.95, band + lap * 0.1 + (fnz2 - 0.5) * 0.3) * 0.85);
              // streaks of foam drawn along by currents
              float fs = length(gFlow);
              vec3 sn = flowN(fp * 0.6, gFlow, 0.11, 0.21);
              float streak = smoothstep(0.42, 0.75, sn.x * 0.5 + 0.5) * smoothstep(1.5, 9.0, fs) * 0.55;
              foam = max(foam, streak * (0.5 + 0.5 * fnz));
              diffuseColor.rgb = mix(wc, vec3(1.0), foam);
              diffuseColor.a = max(alpha, foam * 0.9);
            }`)
          .replace('#include <normal_fragment_maps>', `{
              vec2 p = vWXZ;
              vec3 a = flowN(p, gFlow + vec2(0.7, 0.45), 0.085, 0.0);
              vec3 b = texture2D(uWN, p * 0.041 + vec2(-0.016, 0.021) * uTime).xyz * 2.0 - 1.0;
              vec3 c = texture2D(uWN, p * 0.19 + vec2(0.031, 0.012) * uTime + 0.5).xyz * 2.0 - 1.0;
              vec2 d = a.xy * 0.5 + b.xy * 0.55 + c.xy * 0.22;
              d *= 0.55 + 0.45 * smoothstep(0.0, 1.5, gDepth) + 0.6 * smoothstep(2.0, 10.0, length(gFlow));
              vec3 nW = normalize(vec3(d.x, 3.2, d.y));
              gNW = nW;
              normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
            }`)
          .replace('#include <opaque_fragment>', `
            float aOut = diffuseColor.a;
            vec3 spk = vec3(0.0);
            #if NUM_DIR_LIGHTS > 0
            {
              // tiny sun glints on the ripple crests
              vec3 gn = texture2D(uWN, vWXZ * 0.43 + vec2(uTime * 0.07, -uTime * 0.05)).xyz * 2.0 - 1.0;
              vec3 nW2 = normalize(gNW + vec3(gn.x, 0.0, gn.y) * 0.22);
              vec3 n2 = normalize((viewMatrix * vec4(nW2, 0.0)).xyz);
              vec3 Rv = reflect(-geometryViewDir, n2);
              float g = pow(max(dot(Rv, directionalLights[0].direction), 0.0), 600.0);
              spk = directionalLights[0].color * g * 18.0;
            }
            #endif
            gl_FragColor = vec4(totalDiffuse + totalEmissiveRadiance + (totalSpecular + spk) / max(aOut, 0.05), aOut);`);
      };
      mat.customProgramCacheKey = () => 'wt-water';
      const g = new T.PlaneGeometry(2 * IX + 2, 2 * IZ + 2, 1, 1); g.rotateX(-PI / 2);
      const m = K.mesh(g, mat, 0, 0, 0, { cast: false, receive: false });
      m.receiveShadow = false; keep.push(m);
    }

    // ============================================================================
    // COLLIDERS: channel banks, lagoon shore, island
    // ============================================================================
    {
      const RC_ = 1.5;
      const wet = (x, z) => lagSD(x, z) < -0.5;
      for (const side of [-1, 1]) {
        const pts = track.edgePoints(side, 4, 1.0 + RC_);
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], q = pts[(i + 1) % pts.length];
          if (wet(p.x, p.z) && wet(q.x, q.z)) continue;
          K.capsule(p.x, p.z, q.x, q.z, RC_, 6);
        }
      }
      // lagoon shore (outline pushed outward), skipping the channel mouths and the tub wall
      const n = lagPoly.length, step = 3;
      const sh = [];
      for (let i = 0; i < n; i += step) {
        const p = lagPoly[i], a = lagPoly[(i - 1 + n) % n], b = lagPoly[(i + 1) % n];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        let nx = tz, nz = -tx; // outward if the polygon runs clockwise on screen
        if (inPoly(p[0] + nx * 2, p[1] + nz * 2, lagPoly)) { nx = -nx; nz = -nz; }
        const x = p[0] + nx * (1.0 + RC_), z = p[1] + nz * (1.0 + RC_);
        const tn = track.distTo(x, z);
        const ok = tn.dist > track.w[tn.i] / 2 + 3.5 && rrIn(x, z, IX, IZ, RC) > 1.5;
        sh.push(ok ? [x, z] : null);
      }
      for (let i = 0; i < sh.length; i++) {
        const p = sh[i], q = sh[(i + 1) % sh.length];
        if (p && q) K.capsule(p[0], p[1], q[0], q[1], RC_, 6);
      }
      K.circle(ISLAND.x, ISLAND.z, ISLAND.R + 1.2, 6);
      // rounded tub corners: the square bounds walls leave gaps under the rim there
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = sx * (IX - RC), cz = sz * (IZ - RC), R = RC + RC_;
        let prev = null;
        for (let i = 0; i <= 10; i++) {
          const a = (i / 10) * PI / 2, pt = [cx + sx * Math.cos(a) * R, cz + sz * Math.sin(a) * R];
          if (prev) K.capsule(prev[0], prev[1], pt[0], pt[1], RC_, 6);
          prev = pt;
        }
      }
    }

    // ============================================================================
    // HAZARDS: sandbars (slow), soap suds (slick), the plughole whirlpool (hole)
    // ============================================================================
    for (const sb of SANDBARS) {
      const poly = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * PI * 2;
        const p = track.place(sb.s + Math.cos(a) * sb.la * 0.85, sb.lat + Math.sin(a) * sb.lc * 0.85);
        poly.push([p.x, p.z]);
      }
      K.surface('slow', { poly });
    }
    // ---- soap suds: a bubble-mixture bottle knocked over on the bank of the middle channel ----
    {
      const sp = track.place(S.suds, 3.2);
      const poly = K.blobOutline(r, sp.x, sp.z, 5.2, 0.32, 36, 1.7, sp.angle);
      K.surface('slick', { poly });
      // foam film
      const fc = TX.paint(256, 256, (x, y, u, v, o) => {
        const dx = u - 0.5, dy = v - 0.5, d = Math.hypot(dx, dy) * 2;
        const n = TX.sampleField(nA, 256, u * 256 * 2, v * 256 * 2);
        const a = (1 - ss(0.55, 1.0, d + (n - 0.5) * 0.5)) * (0.55 + 0.45 * ss(0.35, 0.7, n));
        o[0] = 250; o[1] = 252; o[2] = 255; o[3] = a * 255;
      });
      const film = K.mesh(new T.PlaneGeometry(1, 1), K.std({ map: TX.toTexture(fc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.3 }), sp.x, 0.05, sp.z, { rx: -PI / 2, cast: false });
      film.rotation.z = -sp.angle; film.scale.set(5.2 * 2 * 1.9, 5.2 * 2.2, 1); film.renderOrder = 2;
      // bubbles
      const bubMat = K.phys({ color: 0xffffff, roughness: 0.0, metalness: 0, transparent: true, opacity: 0.38, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 620], envMap: skyEnv, envMapIntensity: 1.6, depthWrite: false, clearcoat: 1 });
      const bubs = [];
      for (let i = 0; i < 160 * Q + 40; i++) {
        const a = r() * PI * 2, d = Math.sqrt(r()) * 1.05;
        const lx = Math.cos(a) * d * 5.2 * 1.7, lz = Math.sin(a) * d * 5.2;
        const x = sp.x + lx * Math.cos(sp.angle) - lz * Math.sin(sp.angle), z = sp.z + lx * Math.sin(sp.angle) + lz * Math.cos(sp.angle);
        const s = r() < 0.15 ? r.range(0.7, 1.15) : r.range(0.18, 0.55);
        bubs.push({ x, y: 0.05, z, s });
      }
      const bg = new T.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2);
      const bi = K.instances(bg, bubMat, bubs, { cast: false });
      bi.renderOrder = 3;
      // the bottle, lying on the bank, neck pointing at the water
      const bp = track.place(S.suds - 6, track.at(S.suds).w / 2 + 4.6);
      const bottle = new T.Group();
      const prof = [[0, 0], [2.0, 0], [2.3, 0.4], [2.3, 7.2], [1.9, 8.6], [1.0, 9.4], [1.0, 10.6], [0, 10.6]];
      const lc = TX.makeCanvas(512, 128); const lg = lc.getContext('2d');
      const grd = lg.createLinearGradient(0, 0, 512, 0); grd.addColorStop(0, '#ff5fa2'); grd.addColorStop(0.5, '#ffd23f'); grd.addColorStop(1, '#3ec1ff');
      lg.fillStyle = grd; lg.fillRect(0, 0, 512, 128);
      lg.fillStyle = '#ffffff'; lg.font = '64px "Lilita One", Impact, sans-serif'; lg.textAlign = 'center'; lg.lineWidth = 8; lg.strokeStyle = '#7a2d8c';
      lg.strokeText('BUBBLES!', 256, 86); lg.fillText('BUBBLES!', 256, 86);
      for (let i = 0; i < 9; i++) { lg.strokeStyle = 'rgba(255,255,255,0.8)'; lg.lineWidth = 3; lg.beginPath(); lg.arc(30 + i * 56, 20 + (i % 3) * 8, 6 + (i % 2) * 5, 0, 7); lg.stroke(); }
      const body = new T.Mesh(K.lathe(prof, 32), K.phys({ color: 0xff79c6, roughness: 0.25, clearcoat: 0.6, transparent: true, opacity: 0.8 }));
      bottle.add(body);
      const label = new T.Mesh(new T.CylinderGeometry(2.36, 2.36, 4.2, 32, 1, true), K.std({ map: TX.toTexture(lc, { wrap: true }), roughness: 0.5 }));
      label.position.y = 3.8; bottle.add(label);
      const cap = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 1.6, 20), PL(0x7a2dd0, 0.35)); cap.position.set(2.4, 0.2, 2.6); bottle.add(cap);
      bottle.rotation.order = 'YXZ';
      bottle.rotation.y = -sp.angle + PI / 2 + 0.5; bottle.rotation.x = PI / 2; bottle.rotation.z = 0.0;
      bottle.position.set(bp.x, hAt(bp.x, bp.z) + 2.1, bp.z);
      K.add(bottle);
      K.circle(bp.x, bp.z, 3.0, 5);
      AO(bp.x, bp.z, 5.5, 3, 0.4, sp.angle);
      // the bubble wand dropped next to it
      const wand = new T.Group();
      const ring = new T.Mesh(new T.TorusGeometry(1.4, 0.22, 8, 24), PL(0x7a2dd0, 0.3)); ring.position.x = 6.5; wand.add(ring);
      const stick = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 10, 8), PL(0x7a2dd0, 0.3)); stick.rotation.z = PI / 2; stick.position.x = 0.4; wand.add(stick);
      wand.rotation.x = -PI / 2;
      const wg = new T.Group(); wg.add(wand);
      const wp = track.place(S.suds + 9, track.at(S.suds).w / 2 + 3.5);
      wg.position.set(wp.x, hAt(wp.x, wp.z) + 0.3, wp.z); wg.rotation.y = -wp.angle + 2.6;
      K.add(wg);
    }
    // ---- the plughole whirlpool ----
    {
      K.hole(DRAIN.x, DRAIN.z, DRAIN.r);
      const mat = new T.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: A.uTime },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `varying vec2 vP; uniform float uTime;
          void main(){
            float r = length(vP) / 14.0; float a = atan(vP.y, vP.x);
            float sp = a * 3.0 + log(r + 0.03) * 7.0 + uTime * 6.0;
            float arms = smoothstep(0.35, 1.0, sin(sp) * 0.5 + 0.5);
            float arms2 = smoothstep(0.6, 1.0, sin(sp * 2.0 + 1.3) * 0.5 + 0.5);
            float fade = 1.0 - smoothstep(0.45, 1.0, r);
            float core = 1.0 - smoothstep(0.1, 0.32, r);
            float rim = smoothstep(0.12, 0.2, r) * (1.0 - smoothstep(0.2, 0.34, r));
            vec3 col = mix(vec3(0.95, 0.99, 1.0), vec3(0.02, 0.16, 0.2), core);
            float alpha = (arms * 0.5 + arms2 * 0.25) * fade * smoothstep(0.08, 0.2, r) + core * 0.9 + rim * 0.35;
            gl_FragColor = vec4(col * 1.4, clamp(alpha, 0.0, 1.0));
          }`,
      });
      const g = new T.CircleGeometry(14, 64); g.rotateX(-PI / 2);
      // CircleGeometry lies in xy; after rotateX the original xy is now x,-z in world; vP uses local xy (pre-rotation) via position -> keep simple
      const g2 = new T.CircleGeometry(14, 64);
      const m = new T.Mesh(g2, mat); m.rotation.x = -PI / 2; m.position.set(DRAIN.x, 0.05, DRAIN.z); m.renderOrder = 2;
      K.group.add(m); keep.push(m);
      A.vortex = m;
      // the plughole grate on the bottom
      const gr = K.mesh(new T.CylinderGeometry(3.4, 3.6, 0.6, 32), aqua(K.metal(0xb8bec4, 0.3)), DRAIN.x, hAt(DRAIN.x, DRAIN.z) + 0.2, DRAIN.z, { cast: false });
      K.mesh(new T.CircleGeometry(2.6, 32), K.std({ color: 0x050a0c, roughness: 1 }), DRAIN.x, hAt(DRAIN.x, DRAIN.z) + 0.52, DRAIN.z, { rx: -PI / 2, cast: false });
      keep.push(gr);
    }

    // ============================================================================
    // THE TABLE: moulded plastic tub, rim, legs; the patio far below
    // ============================================================================
    const rrPath = (p, hx, hz, rad) => {
      p.moveTo(-hx + rad, -hz); p.lineTo(hx - rad, -hz); p.absarc(hx - rad, -hz + rad, rad, -PI / 2, 0, false);
      p.lineTo(hx, hz - rad); p.absarc(hx - rad, hz - rad, rad, 0, PI / 2, false);
      p.lineTo(-hx + rad, hz); p.absarc(-hx + rad, hz - rad, rad, PI / 2, PI, false);
      p.lineTo(-hx, -hz + rad); p.absarc(-hx + rad, -hz + rad, rad, PI, 1.5 * PI, false);
      return p;
    };
    const ring = (outer, inner, depth, bevel = 0, bs = bevel) => {
      const s = rrPath(new T.Shape(), outer[0], outer[1], outer[2]);
      s.holes.push(rrPath(new T.Path(), inner[0], inner[1], inner[2]));
      const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bs, bevelSegments: 4, curveSegments: 14 });
      g.rotateX(-PI / 2);
      return g;
    };
    const blueMat = K.phys({ color: 0x2f8ae0, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.35 });
    const blueDark = K.phys({ color: 0x1e64b8, roughness: 0.42, clearcoat: 0.3 });
    const yellowMat = K.phys({ color: 0xffc62a, roughness: 0.34, clearcoat: 0.45, clearcoatRoughness: 0.3 });
    const redMat = K.phys({ color: 0xe0402c, roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.3 });
    {
      const bs = 1.6, bt = 1.1;
      // rim
      K.mesh(ring([IX + RIM_W - bs, IZ + RIM_W - bs, RC + RIM_W - bs], [IX + bs, IZ + bs, RC + bs], 1.6, bt, bs), yellowMat, 0, RIM_Y - 1.6 - bt, 0);
      // inner tub wall (below the rim, down into the water)
      K.mesh(ring([IX + 1.6, IZ + 1.6, RC + 1.6], [IX, IZ, RC], 9.2), aqua(K.phys({ color: 0x5aa8ee, roughness: 0.4, clearcoat: 0.3 })), 0, -8.4, 0, { cast: false });
      // outer tub body with a moulded band
      K.mesh(ring([IX + RIM_W - 1.4, IZ + RIM_W - 1.4, RC + RIM_W - 1.4], [IX + 1.0, IZ + 1.0, RC + 1.0], 22, 1.2, 1.2), blueMat, 0, -22.5, 0, { cast: false });
      K.mesh(ring([IX + RIM_W - 0.4, IZ + RIM_W - 0.4, RC + RIM_W - 0.4], [IX + 2, IZ + 2, RC + 2], 1.0, 0.6, 0.6), blueDark, 0, -9.5, 0, { cast: false });
      const bottom = rrPath(new T.Shape(), IX + RIM_W - 1.4, IZ + RIM_W - 1.4, RC + RIM_W - 1.4);
      const bg = new T.ShapeGeometry(bottom, 12); bg.rotateX(PI / 2);
      K.mesh(bg, blueMat, 0, -23.6, 0, { cast: false });
      // legs + frame
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * (IX - 6), z = sz * (IZ - 6);
        K.mesh(new T.CylinderGeometry(3.6, 4.2, 54, 24), redMat, x, -50, z, { cast: true });
        K.mesh(new T.CylinderGeometry(5.2, 5.2, 1.6, 24), PL(0x222222, 0.6), x, -75.2, z);
        AO(x, z, 9, 9, 0.5, 0, -75.9);
      }
      for (const sz of [-1, 1]) K.mesh(new T.CylinderGeometry(1.6, 1.6, 2 * (IX - 6), 14), redMat, 0, -62, sz * (IZ - 6), { rz: PI / 2 });
      for (const sx of [-1, 1]) K.mesh(new T.CylinderGeometry(1.6, 1.6, 2 * (IZ - 6), 14), redMat, sx * (IX - 6), -62, 0, { rx: PI / 2 });
      // cup holders moulded into the rim corners
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * (IX + 1.5), z = sz * (IZ + 1.5);
        K.mesh(new T.CylinderGeometry(3.2, 3.0, 0.4, 32), K.phys({ color: 0xe0a812, roughness: 0.5 }), x, RIM_Y + 0.02, z, { cast: false });
      }
      // invisible bound walls follow the box; the rim is the visible wall
    }
    // ---------------- patio far below ----------------
    {
      const c = TX.makeCanvas(512, 512), g = c.getContext('2d');
      const rr = K.rng(91);
      g.fillStyle = '#8f8a80'; g.fillRect(0, 0, 512, 512);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const b = 150 + rr() * 30;
        g.fillStyle = `rgb(${b},${b * 0.95 | 0},${b * 0.86 | 0})`;
        g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
        for (let k = 0; k < 220; k++) { const q = rr() * 40 - 20; g.fillStyle = `rgba(${q > 0 ? 255 : 60},${q > 0 ? 250 : 55},${q > 0 ? 240 : 45},${Math.abs(q) / 160})`; g.fillRect(i * 128 + 3 + rr() * 120, j * 128 + 3 + rr() * 120, 2 + rr() * 5, 2 + rr() * 5); }
      }
      g.fillStyle = 'rgba(70,110,40,0.55)';
      for (let k = 0; k < 90; k++) { const t = rr() * 4 | 0; const v = rr() * 512; if (rr() < 0.5) g.fillRect(t * 128 - 2 + rr() * 2, v, 4, 3 + rr() * 8); else g.fillRect(v, t * 128 - 2 + rr() * 2, 3 + rr() * 8, 4); }
      const tex = TX.toTexture(c, { repeat: [2000 / 240, 2000 / 240] });
      K.mesh(new T.PlaneGeometry(2000, 2000), K.std({ map: tex, roughness: 0.85 }), 0, -76, 0, { rx: -PI / 2, cast: false });
      // striped beach towel to the west, flip-flops
      const tc = TX.makeCanvas(512, 256), tg = tc.getContext('2d');
      const cols = ['#f25c3b', '#ffffff', '#ffb82e', '#ffffff', '#2f8ae0', '#ffffff'];
      for (let i = 0; i < 16; i++) { tg.fillStyle = cols[i % 6]; tg.fillRect(i * 32, 0, 32, 256); }
      for (let i = 0; i < 4000; i++) { tg.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; tg.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); }
      const towel = K.mesh(new K.RoundedBoxGeometry(150, 0.6, 80, 2, 0.3), K.std({ map: TX.toTexture(tc, { wrap: false }), roughness: 0.95 }), -250, -75.6, 30, { ry: 0.25, cast: false });
      const flop = (x, z, ry, col) => {
        const s = new T.Shape(); s.absellipse(0, 0, 4.6, 12, 0, PI * 2, false, 0);
        const fg = new T.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.4, bevelSegments: 2 }); fg.rotateX(-PI / 2);
        K.mesh(fg, PL(col, 0.6), x, -75.8, z, { ry });
        AO(x, z, 6, 13, 0.35, -ry, -75.9);
      };
      flop(-180, -60, 0.4, 0x2f8ae0); flop(-168, -52, 0.15, 0x2f8ae0);
      // terracotta pots with leafy plants
      const potMat = K.std({ color: 0xc0653a, roughness: 0.85 });
      const leafGeo = (() => { const s = new T.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(3.5, 7, 0, 16); s.quadraticCurveTo(-3.5, 7, 0, 0); const g = new T.ShapeGeometry(s, 6); return g; })();
      const leafMat = K.std({ color: 0x4d9a3c, roughness: 0.6, side: T.DoubleSide });
      const leaves = [];
      const pot = (x, z, sc) => {
        K.mesh(K.lathe([[0, 0], [11, 0], [14, 22], [15.5, 22], [15.5, 25], [13.5, 25], [13, 23], [0, 23]].map(([a, b]) => [a * sc, b * sc]), 32), potMat, x, -76, z);
        K.mesh(new T.CircleGeometry(13 * sc, 24), K.std({ color: 0x3e2a1c, roughness: 1 }), x, -76 + 23.5 * sc, z, { rx: -PI / 2, cast: false });
        for (let i = 0; i < 26; i++) {
          const a = r() * PI * 2, tilt = r.range(0.3, 1.1);
          leaves.push({ x: x + Math.cos(a) * 2, y: -76 + 23 * sc, z: z + Math.sin(a) * 2, ry: -a + PI / 2, rx: -PI / 2 + tilt, s: sc * r.range(1.2, 1.9), order: 'YXZ' });
        }
        AO(x, z, 18 * sc, 18 * sc, 0.45, 0, -75.9);
      };
      pot(-215, -150, 1.1); pot(230, -140, 1.2); pot(250, 120, 1.0); pot(-240, 150, 1.0);
      K.instances(leafGeo, leafMat, leaves, { cast: true });
      // a ball on the patio
      const bc = TX.paint(256, 128, (x, y, u, v, o) => { const k = Math.floor(u * 6); const c = [[230, 60, 50], [255, 255, 255], [255, 200, 40], [255, 255, 255], [47, 138, 224], [255, 255, 255]][k]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; });
      K.mesh(new T.SphereGeometry(11, 32, 20), K.phys({ map: TX.toTexture(bc), roughness: 0.3, clearcoat: 0.6 }), 205, -65, 70);
      AO(205, 70, 12, 12, 0.5, 0, -75.9);
    }

    // ============================================================================
    // START / FINISH: floating checkered boom and flag buoys
    // ============================================================================
    {
      const p = track.at(S.start);
      const c = TX.makeCanvas(256, 64), g = c.getContext('2d');
      for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#1b1b1b' : '#f7f4ec'; g.fillRect(x * 16, y * 32, 16, 32); }
      const w = p.w + 2;
      const strip = new T.Mesh(new K.RoundedBoxGeometry(w, 0.3, 2.2, 2, 0.12), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.6 }));
      strip.position.set(p.x, 0.04, p.z); strip.rotation.y = -p.angle + PI / 2;
      K.add(strip, { cast: false }); keep.push(strip);
      A.startStrip = strip;
      const fc = TX.makeCanvas(128, 96), fg2 = fc.getContext('2d');
      for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) { fg2.fillStyle = (x + y) % 2 ? '#111' : '#fafafa'; fg2.fillRect(x * 16, y * 16, 16, 16); }
      const flagMat = K.std({ map: TX.toTexture(fc, { wrap: false }), side: T.DoubleSide, roughness: 0.7 });
      for (const side of [-1, 1]) {
        const q = track.place(S.start, side * (p.w / 2 + 2.6));
        const y0 = hAt(q.x, q.z);
        K.mesh(new T.CylinderGeometry(0.28, 0.28, 12, 10), PL(0xf0f0f0, 0.3), q.x, y0 + 6, q.z);
        K.mesh(new T.CylinderGeometry(1.6, 1.9, 1.4, 20), redMat, q.x, y0 + 0.6, q.z);
        const fl = new T.Mesh(new T.PlaneGeometry(5, 3.4, 6, 1), flagMat);
        const pos = fl.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) + 2.5) * 1.3) * 0.35 * (pos.getX(i) + 2.5) / 5);
        fl.geometry.computeVertexNormals();
        fl.position.set(q.x + 2.5 * Math.cos(-0.5), y0 + 10.3, q.z); fl.rotation.y = 0.5;
        K.add(fl);
        AO(q.x, q.z, 2.4, 2.4, 0.4, 0, y0 + 0.05);
      }
    }

    // "START" scratched into the sand with a stick, an arrow pointing the way
    {
      const c = TX.makeCanvas(512, 160), g = c.getContext('2d');
      g.font = '112px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(255,246,225,0.55)'; g.lineWidth = 9; g.strokeText('START', 236, 86);
      g.fillStyle = 'rgba(92,62,30,0.62)'; g.fillText('START', 230, 80);
      g.strokeStyle = 'rgba(92,62,30,0.62)'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(410, 80); g.lineTo(490, 80); g.moveTo(462, 52); g.lineTo(492, 80); g.lineTo(462, 108); g.stroke();
      const mat = K.std({ map: TX.toTexture(c, { wrap: false }), transparent: true, depthWrite: false, roughness: 1 });
      const pl = new T.PlaneGeometry(22, 6.9, 22, 6); pl.rotateX(-PI / 2);
      const q = track.place(S.start - 22, -(track.at(S.start).w / 2 + 6.2));
      const ang = q.angle, pp = pl.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const lx = pp.getX(i), lz = pp.getZ(i);
        const wx = q.x + lx * Math.cos(ang) - lz * Math.sin(ang), wz = q.z + lx * Math.sin(ang) + lz * Math.cos(ang);
        pp.setXYZ(i, wx, hAt(wx, wz) + 0.07, wz);
      }
      pl.computeVertexNormals();
      const m = new T.Mesh(pl, mat); m.renderOrder = 1; m.receiveShadow = true; K.group.add(m);
    }
    // little red warning flags planted on the sandbars
    for (const sb of SANDBARS) {
      const q = track.place(sb.s, sb.lat + Math.sign(sb.lat) * 1.8);
      K.mesh(new T.CylinderGeometry(0.12, 0.12, 5, 6), K.std({ color: 0xe9d6ae, roughness: 0.8 }), q.x, 2.0, q.z);
      const fl = new T.Mesh(new T.PlaneGeometry(2.2, 1.4), K.std({ color: 0xe8402e, side: T.DoubleSide, roughness: 0.7 }));
      fl.position.set(q.x + 1.1, 3.8, q.z); K.add(fl);
      K.circle(q.x, q.z, 0.4, 6);
    }
    // a moulded groove along the rim top
    {
      const g = ring([IX + RIM_W * 0.62, IZ + RIM_W * 0.62, RC + RIM_W * 0.62], [IX + RIM_W * 0.5, IZ + RIM_W * 0.5, RC + RIM_W * 0.5], 0.06);
      K.mesh(g, K.phys({ color: 0xe0a812, roughness: 0.5 }), 0, RIM_Y - 0.02, 0, { cast: false });
    }

    // ============================================================================
    // LAGOON BUOY ROPES (lane markers) + channel marker posts
    // ============================================================================
    {
      const floats = [];
      for (const side of [-1, 1]) {
        let run = [];
        const flush = () => {
          if (run.length > 3) {
            const curve = new T.CatmullRomCurve3(run.map((p) => new T.Vector3(p.x, 0.05, p.z)));
            const tg = new T.TubeGeometry(curve, run.length * 2, 0.09, 5, false);
            const m = new T.Mesh(tg, K.std({ color: 0xf2f2f2, roughness: 0.8 })); K.add(m, { cast: false });
          }
          run = [];
        };
        const pts = track.edgePoints(side, 2.1, 0.4);
        let n = 0;
        for (const p of pts) {
          const ok = lagSD(p.x, p.z) < -1.2 && hAt(p.x, p.z) < -0.8;
          if (!ok) { flush(); continue; }
          run.push(p);
          floats.push({ x: p.x, y: 0.12, z: p.z, ry: -p.angle, sx: 1.25, sy: 0.85, sz: 0.85, color: (n++ % 6 < 3) ? 0xe8402e : 0xf6f6f2 });
        }
        flush();
      }
      const fmat = K.phys({ color: 0xffffff, roughness: 0.3, clearcoat: 0.6 });
      fmat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = A.uTime;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          { float ph = instanceMatrix[3].x * 0.41 + instanceMatrix[3].z * 0.27; transformed.y += sin(uTime * 2.3 + ph) * 0.09 / 0.85; }
          #endif`);
      };
      fmat.customProgramCacheKey = () => 'wt-bob';
      const fi = K.instances(new T.SphereGeometry(0.55, 14, 10), fmat, floats, { colors: true, cast: true });
      keep.push(fi);
    }

    // ============================================================================
    // SHARED PROP HELPERS
    // ============================================================================
    const groundY = (x, z) => Math.max(0, hAt(x, z));
    const bucket = (x, z, col, { y = null, tilt = 0, ry = 0, sc = 1, sandFill = true } = {}) => {
      const g = new T.Group();
      const prof = [[0, 0.3], [4.2, 0.3], [4.5, 0], [4.9, 0.2], [6.0, 10.8], [6.6, 11.2], [6.6, 11.9], [6.1, 11.9], [5.5, 11.0], [4.3, 1.0], [0, 0.9]];
      const body = new T.Mesh(K.lathe(prof, 40), K.phys({ color: col, roughness: 0.32, clearcoat: 0.5, side: T.DoubleSide }));
      g.add(body);
      if (sandFill) { const sf = new T.Mesh(new T.CircleGeometry(5.6, 32), terrMat2); sf.rotation.x = -PI / 2; sf.position.y = 9.6; g.add(sf); }
      const handle = new T.Mesh(new T.TorusGeometry(6.4, 0.3, 8, 32, PI), PL(col, 0.35)); handle.position.y = 11.2; handle.rotation.y = 0.4; g.add(handle);
      for (const sx of [-1, 1]) { const lug = new T.Mesh(new T.SphereGeometry(0.6, 10, 8), PL(col, 0.35)); lug.position.set(Math.cos(0.4) * 6.4 * sx, 11.2, -Math.sin(0.4) * 6.4 * sx); g.add(lug); }
      g.scale.setScalar(sc);
      const holder = new T.Group(); holder.add(g); g.rotation.z = tilt;
      if (tilt) g.position.y = 6 * sc * Math.sin(Math.abs(tilt)) * 0.9;
      holder.position.set(x, y ?? groundY(x, z) - 0.2, z); holder.rotation.y = ry;
      K.add(holder);
      AO(x, z, 7 * sc, 7 * sc, 0.42, 0, (y ?? groundY(x, z)) + 0.06);
      return holder;
    };
    const spade = (col) => {
      const g = new T.Group();
      const handle = new T.Mesh(new T.CylinderGeometry(0.55, 0.6, 15, 12), PL(col, 0.35)); handle.position.y = 7.5; g.add(handle);
      const grip = new T.Mesh(new T.TorusGeometry(1.5, 0.45, 8, 20), PL(col, 0.35)); grip.position.y = 16.2; g.add(grip);
      const bs = new T.Shape(); bs.moveTo(-3.2, 0); bs.lineTo(3.2, 0); bs.lineTo(3.0, -5.5); bs.quadraticCurveTo(0, -9.5, -3.0, -5.5); bs.closePath();
      const bg = new T.ExtrudeGeometry(bs, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2 });
      bg.translate(0, 0, -0.18);
      const blade = new T.Mesh(bg, PL(col, 0.35)); g.add(blade);
      return g;
    };
    // moulded / heaped sand on props: world-space (triplanar) sand so lathe UVs don't stretch the grain
    const triSand = (color, ns = 0.35) => {
      const m = K.std({ map: sand.map, normalMap: sand.normalMap, normalScale: V2(ns), color, roughness: 0.96 });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying vec3 vWP3;\nvarying vec3 vWN3;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          { vec4 wq = vec4(transformed, 1.0); vec3 wn = objectNormal;
            #ifdef USE_INSTANCING
            wq = instanceMatrix * wq; wn = mat3(instanceMatrix) * wn;
            #endif
            vWP3 = (modelMatrix * wq).xyz; vWN3 = normalize(mat3(modelMatrix) * wn); }`);
        sh.fragmentShader = 'varying vec3 vWP3;\nvarying vec3 vWN3;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
          { vec3 bw = pow(abs(normalize(vWN3)), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
            vec2 sc = vec2(1.0 / 3.5);
            vec4 tx = texture2D(map, vWP3.zy * sc) * bw.x + texture2D(map, vWP3.xz * sc) * bw.y + texture2D(map, vWP3.xy * sc) * bw.z;
            diffuseColor.rgb *= mix(vec3(1.0), tx.rgb * 1.15, 0.55); }`);
      };
      m.customProgramCacheKey = () => 'wt-trisand';
      return m;
    };
    const terrMat2 = triSand(0xd9c08f);
    const rockGeo = (() => {
      const g = new T.IcosahedronGeometry(1, 2);
      const pos = g.attributes.position, rr = K.rng(5);
      const seen = new Map();
      for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
        if (!seen.has(key)) seen.set(key, 0.82 + rr() * 0.3);
        const k = seen.get(key);
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
      }
      g.computeVertexNormals();
      return g;
    })();

    // ============================================================================
    // LANDMARK: the lighthouse island in the lagoon
    // ============================================================================
    {
      const { x, z } = ISLAND;
      const y0 = hAt(x, z);
      const g = new T.Group();
      const prof = [[3.0, 0], [3.0, 0.8], [2.7, 1.0], [2.2, 14.5], [2.6, 14.6], [2.6, 15.2], [0, 15.2]];
      const lg = K.lathe(prof, 40);
      const col = new Float32Array(lg.attributes.position.count * 3), pp = lg.attributes.position;
      const red = new T.Color(0xd7322a), wht = new T.Color(0xf7f4ee);
      for (let i = 0; i < pp.count; i++) { const yy = pp.getY(i); const c = yy < 1.0 ? red : Math.floor((yy - 1.0) / 3.4) % 2 ? wht : red; col.set([c.r, c.g, c.b], i * 3); }
      lg.setAttribute('color', new T.BufferAttribute(col, 3));
      g.add(new T.Mesh(lg, K.phys({ vertexColors: true, roughness: 0.35, clearcoat: 0.5 })));
      const rail = new T.Mesh(new T.TorusGeometry(2.55, 0.12, 6, 32), PL(0x222222, 0.4)); rail.rotation.x = PI / 2; rail.position.y = 16.2; g.add(rail);
      for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; const pst = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 1.0, 5), PL(0x222222, 0.4)); pst.position.set(Math.cos(a) * 2.55, 15.7, Math.sin(a) * 2.55); g.add(pst); }
      const lamp = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 1.6, 20), K.std({ color: 0xfff2b0, emissive: 0xffd24a, emissiveIntensity: 1.4, roughness: 0.3 })); lamp.position.y = 16.1; g.add(lamp);
      const glass = new T.Mesh(new T.CylinderGeometry(1.55, 1.55, 2.4, 20, 1, true), K.glass(0xeaf6ff, 0.25)); glass.position.y = 16.4; g.add(glass);
      const roof = new T.Mesh(new T.ConeGeometry(2.0, 2.0, 24), K.phys({ color: 0xd7322a, roughness: 0.35, clearcoat: 0.5 })); roof.position.y = 18.6; g.add(roof);
      const knob = new T.Mesh(new T.SphereGeometry(0.4, 12, 8), PL(0x222222, 0.4)); knob.position.y = 19.8; g.add(knob);
      const door = new T.Mesh(new K.RoundedBoxGeometry(1.4, 2.4, 0.4, 2, 0.15), PL(0x3b6fb8, 0.5)); door.position.set(0, 1.9, 2.75); g.add(door);
      for (const yy of [5.5, 9.2, 12.4]) { const wdw = new T.Mesh(new T.CircleGeometry(0.45, 14), K.std({ color: 0x1d2a38, roughness: 0.2 })); wdw.position.set(0, yy, 2.62 - (yy - 1) * 0.034); g.add(wdw); }
      g.position.set(x, y0 - 0.2, z);
      K.add(g);
      AO(x, z, 5, 5, 0.5, 0, y0 + 0.05);
      // rocks round the island + a little jetty
      const rocks = [];
      for (let i = 0; i < 26; i++) {
        const a = r() * PI * 2, d = ISLAND.R * r.range(0.65, 1.05);
        const rx = x + Math.cos(a) * d, rz = z + Math.sin(a) * d;
        const s = r.range(0.9, 2.3);
        rocks.push({ x: rx, y: hAt(rx, rz) + s * 0.25, z: rz, s, ry: r() * 6, color: r.pick([0x9b968e, 0xb5aea2, 0x857f77, 0xc8c0b2]) });
      }
      K.instances(rockGeo, aqua(K.std({ color: 0xffffff, roughness: 0.75 })), rocks, { colors: true });
      // a tiny palm tree (toy) and a beach umbrella
      const palm = new T.Group();
      const trunk = new T.Mesh(new T.CylinderGeometry(0.35, 0.55, 8, 10, 6), K.std({ color: 0x9a7348, roughness: 0.8 }));
      const tp = trunk.geometry.attributes.position;
      for (let i = 0; i < tp.count; i++) { const yy = tp.getY(i) + 4; tp.setX(i, tp.getX(i) + yy * yy * 0.03); }
      trunk.geometry.computeVertexNormals(); trunk.position.y = 4; palm.add(trunk);
      const frond = (() => { const s = new T.Shape(); s.moveTo(0, -0.1); s.quadraticCurveTo(2.5, 1.4, 5.2, -0.6); s.quadraticCurveTo(2.5, 0.5, 0, 0.1); return new T.ShapeGeometry(s, 6); })();
      for (let i = 0; i < 7; i++) { const f = new T.Mesh(frond, K.std({ color: 0x3f9a3a, roughness: 0.6, side: T.DoubleSide })); f.position.set(1.9, 8, 0); f.rotation.set(-PI / 2 + 0.5, i / 7 * PI * 2, 0, 'YXZ'); palm.add(f); }
      palm.position.set(x + 6, hAt(x + 6, z + 3) - 0.2, z + 3);
      K.add(palm);
      AO(x + 6, z + 3, 2.5, 2.5, 0.4, 0, hAt(x + 6, z + 3) + 0.05);
    }

    // ============================================================================
    // LANDMARK: sand castle on the start-straight infield
    // ============================================================================
    {
      const cx = -16, cz = 42;
      const y0 = groundY(cx, cz) - 0.3;
      const sandC = triSand(0xcfaa74);
      const tower = (x, z, rad, h) => {
        const prof = [[rad * 1.12, 0], [rad, h * 0.3], [rad * 0.92, h], [rad * 0.98, h + 0.2], [0, h + 0.2]];
        const t = K.mesh(K.lathe(prof, 28), sandC, x, y0, z);
        // crenellations
        const n = 8;
        for (let i = 0; i < n; i++) { const a = i / n * PI * 2; K.mesh(new T.BoxGeometry(0.9, 1.0, 0.9), sandC, x + Math.cos(a) * rad * 0.82, y0 + h + 0.6, z + Math.sin(a) * rad * 0.82, { ry: -a }); }
        // bucket-mould ridges
        K.mesh(new T.TorusGeometry(rad * 1.02, 0.18, 6, 28), sandC, x, y0 + h * 0.62, z, { rx: PI / 2 });
        return t;
      };
      tower(cx - 6, cz - 4, 2.8, 7.2); tower(cx + 6, cz - 4, 2.8, 7.2); tower(cx - 6, cz + 4, 2.8, 6.4); tower(cx + 6, cz + 4, 2.8, 6.4);
      tower(cx, cz - 1, 3.8, 10.5);
      for (const [x1, z1, x2, z2] of [[-6, -4, 6, -4], [-6, 4, 6, 4], [-6, -4, -6, 4], [6, -4, 6, 4]]) {
        const mx = cx + (x1 + x2) / 2, mz = cz + (z1 + z2) / 2, len = Math.hypot(x2 - x1, z2 - z1);
        const ang = Math.atan2(z2 - z1, x2 - x1);
        K.mesh(new K.RoundedBoxGeometry(len, 4.2, 1.6, 2, 0.4), sandC, mx, y0 + 2.1, mz, { ry: -ang });
        for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4 - 0.5; K.mesh(new T.BoxGeometry(0.9, 0.9, 1.2), sandC, mx + Math.cos(ang) * t * len * 0.8, y0 + 4.6, mz + Math.sin(ang) * t * len * 0.8, { ry: -ang }); }
      }
      // gate arch
      K.mesh(new T.CylinderGeometry(1.2, 1.2, 1.8, 20, 1, false, 0, PI), K.std({ color: 0x5a4126, roughness: 1 }), cx, y0 + 1.3, cz + 4.85, { rz: 0, rx: PI / 2 });
      // flag on a lolly stick
      K.mesh(new T.CylinderGeometry(0.15, 0.15, 7, 6), K.std({ color: 0xe8d7b0, roughness: 0.8 }), cx, y0 + 13.5, cz - 1);
      const fl = new T.Mesh(new T.PlaneGeometry(3.4, 2.2), K.std({ color: 0xe8402e, side: T.DoubleSide, roughness: 0.7 }));
      fl.position.set(cx + 1.7, y0 + 15.8, cz - 1); fl.rotation.y = 0.3; K.add(fl);
      // shells pressed into the walls
      const sh = [];
      for (let i = 0; i < 10; i++) sh.push({ x: cx + r.range(-6, 6), y: y0 + r.range(1, 3.6), z: cz + 4.85, rx: PI / 2, s: r.range(0.35, 0.55), color: r.pick([0xf6e6da, 0xf1c9b5, 0xffffff]) });
      K.instances(new T.SphereGeometry(1, 10, 6, 0, PI * 2, 0, PI / 2), K.std({ color: 0xffffff, roughness: 0.5 }), sh, { colors: true });
      AO(cx, cz, 11, 8, 0.45, 0, y0 + 0.35);
      K.box(cx, cz, 9, 6.4, 0, 8);
      warnRoad('castle', cx, cz, 9);
    }

    // ============================================================================
    // LANDMARK: water wheel on the moulded river (moving hazard: the dipping paddles)
    // ============================================================================
    {
      const p = track.at(S.wheel), hw = p.w / 2;
      const latW = hw - 1.2; // wheel plane
      const c = track.place(S.wheel, latW);
      const yaw = new T.Group(); yaw.position.set(c.x, 0, c.z); yaw.rotation.y = -p.angle;
      const wheel = new T.Group();
      const R = WHEEL.R;
      for (const zz of [-2.1, 2.1]) {
        const rim = new T.Mesh(new T.TorusGeometry(R - 0.6, 0.35, 8, 40), redMat); rim.position.z = zz; wheel.add(rim);
        for (let i = 0; i < 8; i++) { const sp = new T.Mesh(new T.BoxGeometry(0.45, R - 0.6, 0.45), redMat); const a = i / 8 * PI * 2; sp.position.set(Math.cos(a) * (R - 0.6) / 2, Math.sin(a) * (R - 0.6) / 2, zz); sp.rotation.z = a - PI / 2; wheel.add(sp); }
      }
      const pmat = aqua(K.phys({ color: 0xffc62a, roughness: 0.35, clearcoat: 0.4 }));
      for (let i = 0; i < 8; i++) {
        const a = -PI / 2 + i * PI / 4;
        const pd = new T.Mesh(new K.RoundedBoxGeometry(0.4, 2.6, 4.8, 2, 0.15), pmat);
        pd.position.set(Math.cos(a) * (R - 1.1), Math.sin(a) * (R - 1.1), 0); pd.rotation.z = a - PI / 2; wheel.add(pd);
      }
      const hub = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 5, 20), blueMat); hub.rotation.x = PI / 2; wheel.add(hub);
      const wheelM = mergeGroup(wheel); wheelM.position.y = WHEEL.axleY; yaw.add(wheelM);
      // axle + A-frame on the north bank
      const ax = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 9.5, 12), K.metal(0xcfd4da, 0.3)); ax.rotation.x = PI / 2; ax.position.set(0, WHEEL.axleY, 3.4); yaw.add(ax);
      for (const dx of [-3.2, 3.2]) {
        const leg = new T.Mesh(new K.RoundedBoxGeometry(0.9, 9.0, 0.9, 2, 0.25), blueMat);
        leg.position.set(dx * 0.5, 2.5, 7.2); leg.rotation.z = dx > 0 ? -0.33 : 0.33; yaw.add(leg);
      }
      const cap = new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 1.4, 16), yellowMat); cap.rotation.x = PI / 2; cap.position.set(0, WHEEL.axleY, 7.6); yaw.add(cap);
      K.add(yaw); keep.push(yaw);
      A.wheel = wheelM;
      // paddle colliders: even and odd paddles take turns dipping into the channel edge
      const along = (dl, lat) => track.place(S.wheel + dl, lat);
      const mk = (offs) => K.mover({ type: 'capsule', r: 0.9, h: 0 }, (t) => {
        const w = WHEEL.w;
        const d = ((((w * t + offs) % (PI / 2)) + PI / 2) % (PI / 2)) - PI / 4; // paddle angle from the bottom
        const dl = WHEEL.rm * Math.sin(d);
        const a = along(dl, hw - 3.6), b = along(dl, hw + 0.5);
        const sub = (R - 1.1) * Math.cos(d) - WHEEL.axleY;
        return { x1: a.x, z1: a.z, x2: b.x, z2: b.z, h: sub > 0.5 && Math.abs(d) < 0.7 ? 3 : 0 };
      });
      mk(PI / 4); mk(0);
      // the bank under the frame
      AO(c.x + Math.sin(p.angle) * 7, c.z - Math.cos(p.angle) * 7, 5, 3, 0.4, p.angle, groundY(c.x, c.z - 7) + 0.05);
    }

    // ============================================================================
    // LANDMARK: sluice lock with two gates that take turns (moving hazard)
    // ============================================================================
    {
      const p = track.at(S.gate), hw = p.w / 2;
      const yaw = new T.Group(); yaw.position.set(p.x, 0, p.z); yaw.rotation.y = -p.angle;
      const yaw0 = yaw;
      {
      const yaw = new T.Group();
      // posts on both banks + top beam with a crank wheel
      for (const sd of [-1, 1]) {
        const post = new T.Mesh(new K.RoundedBoxGeometry(1.6, 13, 1.8, 2, 0.35), blueMat); post.position.set(0, 4.5, sd * (hw + 2.0)); yaw.add(post);
        const base = new T.Mesh(new K.RoundedBoxGeometry(3.4, 1.2, 3.4, 2, 0.4), blueDark); base.position.set(0, 1.6, sd * (hw + 2.0)); yaw.add(base);
      }
      const beam = new T.Mesh(new K.RoundedBoxGeometry(1.8, 1.4, 2 * hw + 6, 2, 0.4), yellowMat); beam.position.set(0, 11.2, 0); yaw.add(beam);
      const crank = new T.Mesh(new T.TorusGeometry(1.4, 0.22, 8, 20), redMat); crank.position.set(1.4, 12.6, 0); crank.rotation.y = PI / 2; yaw.add(crank);
      yaw0.add(mergeGroup(yaw));
      }
      // the two gate leaves (red), sliding in grooves
      const leafW = hw + 0.8;
      const leaves = [];
      const lmat = aqua(K.phys({ color: 0xe0402c, roughness: 0.38, clearcoat: 0.4 }));
      for (const side of [0, 1]) {
        const lf = new T.Mesh(new K.RoundedBoxGeometry(0.9, 6.0, leafW, 2, 0.25), lmat);
        const zc = side === 0 ? -(hw + 0.6) / 2 + 0.25 : (hw + 0.6) / 2 - 0.25;
        lf.position.set(0, 0.5, zc);
        yaw.add(lf); leaves.push(lf);
      }
      // signal lamps on the beam above each half (red = closed / closing)
      const lamps = [];
      for (const side of [0, 1]) {
        const lm = K.std({ color: 0x441111, emissive: 0xff2a1a, emissiveIntensity: 0, roughness: 0.3 });
        const lamp = new T.Mesh(new T.SphereGeometry(0.7, 14, 10), lm); lamp.position.set(0, 12.4, side === 0 ? -hw / 2 : hw / 2); yaw.add(lamp);
        lamps.push(lm);
      }
      K.add(yaw); keep.push(yaw);
      A.gate = { leaves, lamps, hw };
      for (const side of [0, 1]) {
        const lat = side === 0 ? -(hw + 0.6) / 2 + 0.25 : (hw + 0.6) / 2 - 0.25;
        const q = track.place(S.gate, lat);
        K.mover({ type: 'box', hw: 0.55, hd: leafW / 2, h: 0 }, (t) => ({ x: q.x, z: q.z, angle: p.angle, h: gateLift(side, t) < 0.55 ? 7 : 0 }));
      }
      for (const sd of [-1, 1]) {
        const q = track.place(S.gate, sd * (hw + 2.0));
        K.circle(q.x, q.z, 1.6, 14);
        AO(q.x, q.z, 2.5, 2.5, 0.4, 0, groundY(q.x, q.z) + 0.05);
      }
    }

    // ============================================================================
    // moulded river kerbs along the plastic channel section
    // ============================================================================
    {
      const prof = [[0.2, -1.2], [0.25, 0.6], [0.6, 1.3], [1.4, 1.55], [2.4, 1.4], [3.0, 0.8], [3.4, 0.4]];
      const s0 = S.plastic0, span = wrapS(S.plastic1 - S.plastic0);
      for (const side of [-1, 1]) {
        const rows = Math.ceil(span / 1.0) + 1, cols = prof.length;
        const P = new Float32Array(rows * cols * 3);
        for (let i = 0; i < rows; i++) {
          const s = s0 + Math.min(span, i * 1.0);
          const p = track.at(s);
          const f = ss(0, 4, Math.min(i * 1.0, span - i * 1.0));
          for (let j = 0; j < cols; j++) {
            const e = prof[j][0] * (0.7 + 0.3 * f), y = prof[j][1] - 2.0 * (1 - f);
            const off = side * (p.w / 2 + e);
            const k = (i * cols + j) * 3;
            P[k] = p.x + p.nx * off; P[k + 1] = y; P[k + 2] = p.z + p.nz * off;
          }
        }
        const idx = [];
        for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) {
          const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
          if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
        const m = new T.Mesh(g, aqua(K.phys({ color: 0x3b95e6, roughness: 0.35, clearcoat: 0.45, side: T.DoubleSide })));
        K.add(m, { cast: true }); keep.push(m);
      }
    }

    // ============================================================================
    // the hose feeding the table (NE), and its jet
    // ============================================================================
    {
      const pts = [[150, -76, -175], [128, -74, -140], [112, -60, -112], [107, -25, -101], [105, 3.0, -98.5], [104, 5.6, -94], [103.5, 5.0, -89],
        [103, 3.0, -84], [102.5, 2.9, -79], [101, 3.0, -75]].map(([x, y, z]) => new T.Vector3(x, y, z));
      const curve = new T.CatmullRomCurve3(pts);
      const hc = TX.paint(64, 256, (x, y, u, v, o) => { const st = Math.floor(v * 24) % 2; o[0] = st ? 52 : 70; o[1] = st ? 150 : 172; o[2] = st ? 60 : 70; });
      K.mesh(new T.TubeGeometry(curve, 120, 0.85, 10, false), K.phys({ map: TX.toTexture(hc), roughness: 0.4, clearcoat: 0.5 }), 0, 0, 0);
      // spray nozzle
      const end = pts[pts.length - 1], dir = new T.Vector3().subVectors(end, pts[pts.length - 2]).normalize();
      const nz = new T.Group();
      const n1_ = new T.Mesh(new T.CylinderGeometry(1.05, 1.2, 3.2, 16), PL(0xff8a1e, 0.35)); n1_.rotation.x = PI / 2; n1_.position.z = 1.6; nz.add(n1_);
      const n2_ = new T.Mesh(new T.CylinderGeometry(0.7, 1.0, 1.8, 16), PL(0xffc62a, 0.35)); n2_.rotation.x = PI / 2; n2_.position.z = 3.8; nz.add(n2_);
      nz.position.copy(end); nz.lookAt(end.clone().add(dir));
      K.add(nz);
      AO(end.x, end.z - 2, 2.5, 4, 0.4, 0, groundY(end.x, end.z) + 0.05);
      const tip = end.clone().add(dir.clone().multiplyScalar(4.6));
      const land = new T.Vector3(tip.x - 2.5, 0.0, tip.z + 9);
      const jc = new T.QuadraticBezierCurve3(tip, new T.Vector3((tip.x + land.x) / 2, tip.y + 1.6, (tip.z + land.z) / 2), land);
      const jt = TX.paint(64, 256, (x, y, u, v, o) => { const n = Math.sin(v * 50 + Math.sin(u * 12) * 2) * 0.5 + 0.5; o[0] = 235 + n * 20; o[1] = 248; o[2] = 255; o[3] = (120 + n * 120) * (1 - Math.abs(u - 0.5) * 0.6); });
      const jtx = TX.toTexture(jt); jtx.repeat.set(1, 3);
      const jm = K.mesh(new T.TubeGeometry(jc, 30, 0.45, 8, false), K.phys({ map: jtx, transparent: true, roughness: 0.05, depthWrite: false, envMap: skyEnv }), 0, 0, 0, { cast: false });
      jm.renderOrder = 2;
      A.jets = [jtx];
      A.emit.push({ x: land.x, z: land.z, rate: 30, kind: 'splash' });
      // the hose reel on the patio
      K.mesh(new T.CylinderGeometry(16, 16, 10, 32), PL(0x2f8a3a, 0.5), 175, -71, -195, { rz: PI / 2 });
      K.mesh(new T.TorusGeometry(15, 1.6, 10, 40), PL(0xffc62a, 0.4), 181, -71, -195, { ry: PI / 2 });
      K.mesh(new T.TorusGeometry(15, 1.6, 10, 40), PL(0xffc62a, 0.4), 169, -71, -195, { ry: PI / 2 });
    }

    // ============================================================================
    // watering can on the west rim, pouring into the lagoon
    // ============================================================================
    {
      const g = new T.Group();
      const gm = K.phys({ color: 0x35b86a, roughness: 0.32, clearcoat: 0.5 });
      const body = new T.Mesh(K.lathe([[0, 0], [5.6, 0], [6.0, 0.6], [6.0, 9.0], [5.2, 10.2], [3.0, 10.6], [0, 10.6]], 36), gm); g.add(body);
      const handle = new T.Mesh(new T.TorusGeometry(4.6, 0.8, 10, 28, PI * 1.1), gm); handle.position.set(-1.5, 10.0, 0); handle.rotation.z = -0.05; g.add(handle);
      const spout = new T.Mesh(new T.CylinderGeometry(0.7, 1.4, 12, 14), gm); spout.position.set(8.5, 7.5, 0); spout.rotation.z = -0.95; g.add(spout);
      const rose = new T.Mesh(new T.CylinderGeometry(1.9, 1.0, 1.6, 18), PL(0xffc62a, 0.35)); rose.position.set(13.3, 11.0, 0); rose.rotation.z = -0.95; g.add(rose);
      g.position.set(-150.5, RIM_Y + 0.3, -32); g.rotation.z = -0.48;
      K.add(g);
      AO(-150.5, -32, 7, 7, 0.4, 0, RIM_Y + 0.05);
      // stream from the rose
      g.updateMatrixWorld(true);
      const rp = new T.Vector3(14.0, 11.6, 0).applyMatrix4(g.matrixWorld);
      const land = new T.Vector3(rp.x + 3, 0, rp.z);
      const jc = new T.QuadraticBezierCurve3(rp, new T.Vector3(rp.x + 3.2, rp.y * 0.6, rp.z), land);
      const jt = TX.paint(64, 256, (x, y, u, v, o) => { const n = Math.sin(v * 40 + Math.sin(u * 30) * 3) * 0.5 + 0.5; o[0] = 235; o[1] = 248; o[2] = 255; o[3] = (60 + n * 150) * (1 - Math.abs(u - 0.5)); });
      const jtx = TX.toTexture(jt); jtx.repeat.set(1, 2);
      const jm = K.mesh(new T.TubeGeometry(jc, 24, 0.9, 10, false), K.phys({ map: jtx, transparent: true, roughness: 0.05, depthWrite: false, side: T.DoubleSide }), 0, 0, 0, { cast: false });
      jm.renderOrder = 2;
      A.jets.push(jtx);
      A.emit.push({ x: land.x, z: land.z, rate: 22, kind: 'splash' });
      A.rings = { x: land.x, z: land.z };
    }

    // ============================================================================
    // the jump: a floating ramp board into the lagoon run
    // ============================================================================
    {
      const s = S.ramp, p = track.place(s, 0.3);
      const len = 10, wid = 10, hgt = 2.7;
      K.ramp(p.x, p.z, p.angle, len, wid, hgt, 0);
      const g = new T.Group();
      const c = TX.makeCanvas(256, 256), cg = c.getContext('2d');
      cg.fillStyle = '#ffc62a'; cg.fillRect(0, 0, 256, 256);
      cg.fillStyle = '#e0402c';
      for (let i = -1; i < 5; i++) { cg.beginPath(); cg.moveTo(i * 64, 0); cg.lineTo(i * 64 + 32, 128); cg.lineTo(i * 64, 256); cg.lineTo(i * 64 + 22, 256); cg.lineTo(i * 64 + 54, 128); cg.lineTo(i * 64 + 22, 0); cg.fill(); }
      cg.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 400; i++) cg.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      const top = new T.Mesh(new K.RoundedBoxGeometry(len + 0.6, 0.5, wid, 2, 0.2), [PL(0xffc62a, 0.4), PL(0xffc62a, 0.4), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.45 }), PL(0xffc62a, 0.4), PL(0xffc62a, 0.4), PL(0xffc62a, 0.4)]);
      const ang = Math.atan2(hgt, len);
      top.rotation.z = ang; top.position.y = hgt / 2 - 0.25;
      g.add(top);
      // pontoons under the raised end
      const pm = aqua(K.phys({ color: 0x2f8ae0, roughness: 0.35, clearcoat: 0.4 }));
      for (const sz of [-3.2, 3.2]) {
        const pn = new T.Mesh(new T.CapsuleGeometry(1.25, 3.0, 6, 14), pm); pn.rotation.x = PI / 2; pn.position.set(3.4, 0.6, sz); g.add(pn);
        const st = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, hgt, 8), K.metal(0xd8dade, 0.3)); st.position.set(4.6, hgt / 2, sz); g.add(st);
      }
      g.position.set(p.x, 0, p.z); g.rotation.y = -p.angle;
      K.add(g);
      // little warning buoys at its corners
      for (const sd of [-1, 1]) {
        const q = track.place(s - len / 2 - 0.8, 0.3 + sd * (wid / 2 + 0.3));
        K.mesh(new T.ConeGeometry(0.75, 1.6, 16), PL(0xff8a1e, 0.35), q.x, 0.7, q.z);
      }
    }

    // ============================================================================
    // floating toys: rubber ducks, fish, a toy yacht, a beach ball (pushable)
    // ============================================================================
    {
      const duckMat = K.phys({ color: 0xffd21f, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 });
      const beakMat = PL(0xff7a12, 0.35);
      const eyeMat = PL(0x111111, 0.2);
      const duck = (sc) => {
        const g = new T.Group();
        const b = new T.Mesh(new T.SphereGeometry(1, 24, 16), duckMat); b.scale.set(2.1, 1.35, 1.6); b.position.y = 0.35; g.add(b);
        const tail = new T.Mesh(new T.ConeGeometry(0.8, 1.5, 12), duckMat); tail.position.set(-2.0, 1.25, 0); tail.rotation.z = 0.9; g.add(tail);
        const h = new T.Mesh(new T.SphereGeometry(1.15, 24, 16), duckMat); h.position.set(1.1, 2.15, 0); g.add(h);
        const bk = new T.Mesh(new T.SphereGeometry(0.6, 14, 10), beakMat); bk.scale.set(1.3, 0.45, 0.95); bk.position.set(2.15, 1.95, 0); g.add(bk);
        for (const sz of [-0.55, 0.55]) { const e = new T.Mesh(new T.SphereGeometry(0.17, 10, 8), eyeMat); e.position.set(1.85, 2.45, sz); g.add(e); }
        const wing = new T.Mesh(new T.SphereGeometry(1, 16, 10), duckMat); wing.scale.set(1.0, 0.55, 0.3);
        for (const sz of [-1.45, 1.45]) { const w = wing.clone(); w.position.set(-0.3, 0.7, sz); w.rotation.y = sz > 0 ? 0.2 : -0.2; g.add(w); }
        const mg = mergeGroup(g);
        mg.scale.setScalar(sc);
        return mg;
      };
      const fish = (col) => {
        const g = new T.Group();
        const m = K.phys({ color: col, roughness: 0.3, clearcoat: 0.6 });
        const b = new T.Mesh(new T.SphereGeometry(1, 20, 14), m); b.scale.set(2.2, 1.1, 0.8); b.position.y = 0.4; g.add(b);
        const tl = new T.Mesh(new T.ConeGeometry(1.0, 1.4, 4), m); tl.rotation.z = PI / 2; tl.scale.set(1, 1, 0.3); tl.position.set(-2.5, 0.4, 0); g.add(tl);
        const fin = new T.Mesh(new T.ConeGeometry(0.6, 1.0, 4), m); fin.scale.set(1.4, 1, 0.25); fin.position.set(0, 1.4, 0); g.add(fin);
        for (const sz of [-0.62, 0.62]) { const e = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), eyeMat); e.position.set(1.5, 0.7, sz); g.add(e); }
        return mergeGroup(g);
      };
      const yacht = () => {
        const g = new T.Group();
        const hs = new T.Shape(); hs.moveTo(3.2, 0); hs.quadraticCurveTo(1.0, 1.4, -2.6, 1.1); hs.lineTo(-2.6, -1.1); hs.quadraticCurveTo(1.0, -1.4, 3.2, 0);
        const hg = new T.ExtrudeGeometry(hs, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2 }); hg.rotateX(-PI / 2);
        const hull = new T.Mesh(hg, K.std({ color: 0xb5793f, roughness: 0.55 })); hull.position.y = -0.4; g.add(hull);
        const mast = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 6.5, 6), K.std({ color: 0xe8d7b0, roughness: 0.6 })); mast.position.set(0.4, 3.6, 0); g.add(mast);
        const ss_ = new T.Shape(); ss_.moveTo(0, 0); ss_.lineTo(0, 5.6); ss_.lineTo(-3.6, 0.2); ss_.closePath();
        const sail = new T.Mesh(new T.ShapeGeometry(ss_), K.std({ color: 0xffffff, side: T.DoubleSide, roughness: 0.8 })); sail.position.set(0.3, 0.9, 0); g.add(sail);
        const s2 = new T.Shape(); s2.moveTo(0, 0); s2.lineTo(0, 4.6); s2.lineTo(2.4, 0.2); s2.closePath();
        const jib = new T.Mesh(new T.ShapeGeometry(s2), K.std({ color: 0xe8402e, side: T.DoubleSide, roughness: 0.8 })); jib.position.set(0.55, 1.2, 0); g.add(jib);
        return mergeGroup(g);
      };
      const ballMat = (() => {
        const c = TX.paint(256, 128, (x, y, u, v, o) => { const k = Math.floor(u * 6); const cc = [[230, 60, 50], [255, 255, 255], [255, 200, 40], [255, 255, 255], [47, 138, 224], [255, 255, 255]][k]; const cap = v < 0.1 || v > 0.9; o[0] = cap ? 255 : cc[0]; o[1] = cap ? 255 : cc[1]; o[2] = cap ? 255 : cc[2]; });
        return K.phys({ map: TX.toTexture(c), roughness: 0.25, clearcoat: 0.7 });
      })();
      const add = (mesh, x, z, rad, m, opts = {}) => {
        K.add(mesh);
        mesh.position.set(x, 0, z); mesh.rotation.y = r() * 6.28;
        const d = K.physics.addDynamic({ x, z, r: rad, m, h: 3, mesh, friction: opts.friction ?? 4.5, baseY: opts.baseY ?? 0, slide: opts.slide ?? true, spin: 0.05 });
        d.respawn = 5;
        A.ducks.push({ d, mesh, ph: r() * 6.28, amp: opts.amp ?? 1 });
        keep.push(mesh);
      };
      const place = (s, lat) => track.place(s, lat);
      // on the course
      const spots = [[S.suds + 40, -3.5, 'duck'], [S.suds - 30, 4, 'duck'], [100, 4.5, 'duck'], [S.ramp + 40, -6, 'fish'], [S.gate - 30, -3.5, 'fish'], [S.wheel + 32, 3, 'duck'], [210, -3, 'yacht']];
      for (const [s, lat, kind] of spots) {
        const q = place(s, lat);
        if (kind === 'duck') add(duck(1.0), q.x, q.z, 2.2, 1.1);
        else if (kind === 'fish') add(fish(r.pick([0xff7a2a, 0x3fb6ff, 0xb455e0])), q.x, q.z, 1.9, 0.8);
        else add(yacht(), q.x, q.z, 2.3, 1.0);
      }
      // in the lagoon
      for (const [x, z, kind] of [[-104, -36, 'duck'], [-124, -30, 'duck'], [-118, 0, 'fish'], [-92, -40, 'yacht'], [-74, 20, 'duck'], [-140, 16, 'fish']]) {
        if (hAt(x, z) > -1) continue;
        if (kind === 'duck') add(duck(r.range(0.9, 1.15)), x, z, 2.2, 1.1);
        else if (kind === 'fish') add(fish(r.pick([0xff7a2a, 0x3fb6ff])), x, z, 1.9, 0.8);
        else add(yacht(), x, z, 2.3, 1.0);
      }
      // beach ball: rolls instead of sliding
      {
        const x = -112, z = -26;
        const ball = new T.Mesh(new T.SphereGeometry(3.4, 32, 20), ballMat);
        K.add(ball); ball.position.set(x, 2.4, z);
        const d = K.physics.addDynamic({ x, z, r: 3.4, m: 0.6, h: 6, mesh: ball, friction: 3, baseY: 2.4 });
        d.respawn = 5;
        A.ducks.push({ d, mesh: ball, ph: 1.3, amp: 0.6, ball: true });
        keep.push(ball);
      }
    }

    // ============================================================================
    // SAND TOYS on the banks: buckets, spades, rake, sieve, moulds, starfish
    // ============================================================================
    {
      // blue bucket full of sand on the east bank, spade stuck in the sand beside it
      bucket(132, 18, 0x2f8ae0, { ry: 0.4 });
      K.circle(132, 18, 6.6, 12);
      const sp1 = spade(0xffc62a); sp1.position.set(130, groundY(130, -2) + 3.8, -2); sp1.rotation.set(0.35, 0.8, 0.2, 'YXZ'); K.add(sp1);
      AO(130, -2, 3, 3, 0.4, 0, groundY(130, -2) + 0.05);
      K.circle(130, -2, 2.6, 10);
      // red bucket on its side in the middle infield, sand spilling out
      bucket(36, 1, 0xe0402c, { tilt: PI / 2 - 0.12, ry: 2.6, sandFill: false });
      K.circle(36, 1, 6.5, 10);
      K.spill(30, 6, 5, terrMat2, { lump: 0.5, y: groundY(30, 6) + 0.25, thick: 0.6 }).mesh.castShadow = true;
      // yellow bucket on the north rim and a red spade lying on the south bank
      bucket(-40, -92.5, 0xffc62a, { y: RIM_Y, ry: 0.3, sc: 0.85 });
      const sp2 = spade(0xe0402c); sp2.rotation.set(-PI / 2 + 0.06, PI / 2 - 0.08, 0, 'YXZ'); sp2.position.set(-78, groundY(-78, 80) + 0.8, 80); K.add(sp2);
      AO(-86, 80, 9, 3.5, 0.35, 0.08, groundY(-78, 80) + 0.05);
      // green rake in the north infield
      {
        const g = new T.Group(); const gm = PL(0x35b86a, 0.35);
        const h = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 18, 10), gm); h.rotation.z = PI / 2; h.position.x = -9; g.add(h);
        const head = new T.Mesh(new K.RoundedBoxGeometry(1.2, 0.8, 8, 2, 0.3), gm); g.add(head);
        for (let i = 0; i < 7; i++) { const t = new T.Mesh(new T.ConeGeometry(0.28, 1.8, 6), gm); t.position.set(0.8, -0.2, -3.3 + i * 1.1); t.rotation.z = -PI / 2; g.add(t); }
        g.position.set(70, groundY(70, -40) + 0.7, -40); g.rotation.y = 0.35;
        K.add(g); AO(62, -40, 11, 3, 0.35, -0.35, groundY(70, -40) + 0.05);
      }
      // sieve in the middle infield
      {
        const sc = TX.paint(256, 256, (x, y, u, v, o) => {
          const gx = (u * 22) % 1, gy = (v * 22) % 1;
          const hole = Math.hypot(gx - 0.5, gy - 0.5) < 0.3;
          o[0] = 230; o[1] = 70; o[2] = 160; o[3] = hole ? 0 : 255;
        });
        const g = new T.Group();
        const rimG = K.lathe([[7.2, 0], [7.6, 0.2], [8.4, 3.6], [9.0, 3.8], [9.0, 4.2], [8.2, 4.1], [7.0, 0.6]], 48);
        g.add(new T.Mesh(rimG, K.phys({ color: 0xe64aa0, roughness: 0.35, clearcoat: 0.4, side: T.DoubleSide })));
        const mesh = new T.Mesh(new T.CircleGeometry(7.3, 48), K.std({ map: TX.toTexture(sc, { wrap: false }), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.4 }));
        mesh.rotation.x = -PI / 2; mesh.position.y = 0.4; g.add(mesh);
        const hx = 10, hz = -6;
        g.position.set(hx, groundY(hx, hz) + 0.6, hz); g.rotation.set(0.12, 0.3, -0.18);
        K.add(g); AO(hx, hz, 9, 9, 0.35, 0, groundY(hx, hz) + 0.05);
        K.circle(hx, hz, 8.6, 4);
        warnRoad('sieve', hx, hz, 9);
      }
      // sand moulds (star, fish, shell) turned out on the banks
      const moulds = [[86, 0, 'star'], [126, -60, 'shell'], [-72, 40, 'star'], [130, 62, 'fish'], [8, 46, 'shell'], [-28, -42, 'star'], [92, 76, 'star'], [-134, -64, 'shell']];
      const sandM = triSand(0xd0ad78);
      for (const [x, z, kind] of moulds) {
        if (!K.offRoad(x, z, 6) || hAt(x, z) < 0.6) continue;
        const s = new T.Shape();
        if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 - PI / 2, rad = i % 2 ? 1.8 : 4.2; if (!i) s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } }
        else if (kind === 'fish') { s.moveTo(4, 0); s.quadraticCurveTo(1, 3, -2.5, 0.3); s.lineTo(-4.5, 2.2); s.lineTo(-4.2, -2.2); s.lineTo(-2.5, -0.3); s.quadraticCurveTo(1, -3, 4, 0); }
        else { s.moveTo(-1.2, -3.0); s.lineTo(-1.6, -3.7); s.lineTo(1.6, -3.7); s.lineTo(1.2, -3.0); for (let i = 0; i <= 26; i++) { const a = PI * (0.08 + 0.84 * (1 - i / 26)); const rad = 6.4 - (i % 2) * 0.45; s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad - 3.2); } s.closePath(); }
        const g = new T.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 3 }); g.rotateX(-PI / 2);
        K.mesh(g, sandM, x, groundY(x, z) - 0.1, z, { ry: r() * 6 });
        AO(x, z, 5, 5, 0.25, 0, groundY(x, z) + 0.05);
      }
    }

    // ============================================================================
    // RIM PROPS: sunglasses, frisbee, a second spade
    // ============================================================================
    {
      // sunglasses on the south rim, near the start
      const g = new T.Group();
      const lens = (() => { const s = new T.Shape(); s.absellipse(0, 0, 2.6, 2.1, 0, PI * 2, false, 0); return new T.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 }); })();
      const frameS = (() => { const s = new T.Shape(); s.absellipse(0, 0, 3.0, 2.5, 0, PI * 2, false, 0); const h = new T.Path(); h.absellipse(0, 0, 2.55, 2.05, 0, PI * 2, true, 0); s.holes.push(h); return new T.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2 }); })();
      const fm = K.phys({ color: 0xe0402c, roughness: 0.25, clearcoat: 0.8 });
      const lm = K.phys({ color: 0x1a2a3a, roughness: 0.05, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.85 });
      for (const sx of [-3.3, 3.3]) {
        const f = new T.Mesh(frameS, fm); f.position.x = sx; g.add(f);
        const l = new T.Mesh(lens, lm); l.position.set(sx, 0, 0.12); g.add(l);
      }
      const br = new T.Mesh(new T.TorusGeometry(0.9, 0.22, 6, 12, PI), fm); br.position.set(0, 1.0, 0.25); g.add(br);
      for (const sx of [-1, 1]) { const arm = new T.Mesh(new K.RoundedBoxGeometry(0.35, 0.5, 10, 2, 0.12), fm); arm.position.set(sx * 6.0, 0.6, -4.8); arm.rotation.y = sx * 0.05; g.add(arm); }
      g.rotation.set(-PI / 2 + 0.08, 0, 0.3, 'YXZ');
      const hd = new T.Group(); hd.add(g); hd.position.set(-8, RIM_Y + 0.35, 93); hd.rotation.y = 0.35;
      K.add(hd);
      AO(-8, 93, 7, 4.5, 0.35, 0.35, RIM_Y + 0.02);
      // frisbee on the east rim
      const fprof = [[0, 1.2], [8.5, 1.1], [10.2, 0.8], [10.8, 0.2], [10.6, -0.7], [10.2, -0.8], [9.8, 0.1], [8.6, 0.5], [0, 0.6]];
      K.mesh(K.lathe(fprof, 48), K.phys({ color: 0xff8a1e, roughness: 0.3, clearcoat: 0.6, side: T.DoubleSide }), 151, RIM_Y + 0.85, 42, { rx: 0.04 });
      K.mesh(new T.RingGeometry(5, 6.2, 40), K.std({ color: 0xffd8a8, roughness: 0.5 }), 151, RIM_Y + 2.0, 42, { rx: -PI / 2, cast: false });
      AO(151, 42, 10, 10, 0.35, 0, RIM_Y + 0.02);
      // a spade lying across the north-west rim corner
      const sp = spade(0x2f8ae0); sp.rotation.set(-PI / 2 + 0.05, 2.2, 0, 'YXZ'); sp.position.set(-120, RIM_Y + 0.75, -93); K.add(sp);
    }

    // ============================================================================
    // MORE SAND PLAY: turned-out bucket castles, a toy dump truck, a crab, cocktail-stick flags
    // ============================================================================
    {
      const sandM = triSand(0xc9a46e);
      const pieGeo = K.lathe([[0, 0], [3.7, 0], [3.9, 0.3], [3.55, 2.2], [3.75, 2.45], [3.4, 4.7], [3.55, 5.0], [3.1, 5.3], [0, 5.3]], 28);
      const pies = [];
      const spots = [[84, 22], [76, 30], [128, -26], [46, 44], [120, 72], [-6, -6], [42, -44], [-26, -76], [-74, 74], [-134, 64], [136, -74], [-4, 74]];
      for (const [x, z] of spots) {
        if (!K.offRoad(x, z, 5.5) || hAt(x, z) < 0.7 || lagSD(x, z) < 4) continue;
        const s = r.range(0.75, 1.1);
        pies.push({ x, y: hAt(x, z) - 0.15, z, s, ry: r() * 6 });
        AO(x, z, 4.6 * s, 4.6 * s, 0.35, 0, hAt(x, z) + 0.05);
        if (r() < 0.5) pies.push({ x: x + r.range(4, 6) * r.sign(), y: hAt(x, z) - 0.15, z: z + r.range(3, 5) * r.sign(), s: s * 0.7, ry: r() * 6 });
      }
      K.instances(pieGeo, sandM, pies.filter((p) => K.offRoad(p.x, p.z, 4)));
      for (const p of pies) if (K.offRoad(p.x, p.z, 4)) K.circle(p.x, p.z, 3.7 * p.s, 5);

      // toy dump truck parked in the north infield, its tipper full of sand
      {
        const x = 20, z = -44, ry = -0.25;
        const g = new T.Group();
        const yel = PL(0xffc62a, 0.35), red = PL(0xe0402c, 0.35), blk = PL(0x2a2a2a, 0.7);
        const chassis = new T.Mesh(new K.RoundedBoxGeometry(14, 1.2, 6, 2, 0.3), blk); chassis.position.y = 2.2; g.add(chassis);
        const cab = new T.Mesh(new K.RoundedBoxGeometry(4.2, 4.4, 6.2, 3, 0.8), yel); cab.position.set(4.6, 5.0, 0); g.add(cab);
        const win = new T.Mesh(new K.RoundedBoxGeometry(0.3, 2.0, 5.0, 2, 0.2), K.std({ color: 0x223344, roughness: 0.1, metalness: 0.3 })); win.position.set(6.75, 5.8, 0); g.add(win);
        const tip = new T.Group(); tip.position.set(-1.5, 2.8, 0); tip.rotation.z = 0.32; g.add(tip);
        const bin = new T.Mesh(new K.RoundedBoxGeometry(8.4, 3.6, 6.6, 3, 0.5), red); bin.position.set(-1.6, 1.8, 0); tip.add(bin);
        const load = new T.Mesh(new T.SphereGeometry(1, 20, 12), sandM); load.scale.set(4.0, 1.4, 3.0); load.position.set(-1.6, 3.6, 0); tip.add(load);
        for (const wx of [4.4, -4.2]) for (const wz of [-3.3, 3.3]) {
          const w = new T.Mesh(new T.CylinderGeometry(1.9, 1.9, 1.4, 22), blk); w.rotation.x = PI / 2; w.position.set(wx, 1.9, wz); g.add(w);
          const hub = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 1.5, 14), yel); hub.rotation.x = PI / 2; hub.position.set(wx, 1.9, wz); g.add(hub);
        }
        g.position.set(x, groundY(x, z) - 0.3, z); g.rotation.y = ry;
        K.add(g);
        AO(x, z, 9, 5, 0.45, -ry, groundY(x, z) + 0.05);
        K.box(x, z, 7.5, 3.8, -ry, 8);
        warnRoad('truck', x, z, 8);
        // a little spill of sand behind it
        K.spill(x - 9.5, z - 2.4, 2.4, sandM, { lump: 0.5, y: groundY(x - 9.5, z - 2.4) + 0.2, thick: 0.5, n: 20 });
      }
      // pinwheels stuck in the sand at the back corners, spinning in the breeze
      A.pinwheels = [];
      for (const [x, z, cols] of [[-104, -74, [0xe8402e, 0xffc62a, 0x2f8ae0, 0x35b86a]], [136, -66, [0xff5f8a, 0xffffff, 0xb455e0, 0xffffff]]]) {
        const y0 = groundY(x, z);
        K.mesh(new T.CylinderGeometry(0.32, 0.32, 17, 8), PL(0xf6f6f2, 0.4), x, y0 + 8.0, z);
        const hub = new T.Group(); hub.position.set(x, y0 + 16.6, z + 0.5); hub.rotation.x = -0.75;
        const spin = new T.Group(); hub.add(spin);
        const bl = new T.Shape(); bl.moveTo(0, 0); bl.lineTo(4.6, 0.2); bl.quadraticCurveTo(3.8, 2.6, 0.4, 0.6); bl.closePath();
        const bg = new T.ShapeGeometry(bl, 6);
        for (let i = 0; i < 4; i++) {
          const b = new T.Mesh(bg, K.std({ color: cols[i], side: T.DoubleSide, roughness: 0.5 }));
          b.rotation.z = i * PI / 2; b.rotation.y = 0.35; spin.add(b);
        }
        const pin = new T.Mesh(new T.SphereGeometry(0.5, 10, 8), PL(0xffc62a, 0.3)); spin.add(pin);
        K.add(hub); keep.push(hub);
        A.pinwheels.push(spin);
        AO(x, z, 1.2, 1.2, 0.4, 0, y0 + 0.05);
      }
      // the north-west corner: a green bucket of wet sand and a little row of sand pies
      bucket(-124, -70, 0x35b86a, { ry: 1.2, sc: 0.9 });
      K.circle(-124, -70, 6, 12);
      // a toy crab on the east bank
      {
        const x = 124, z = 46;
        const g = new T.Group(); const cm = PL(0xe8402e, 0.35);
        const b = new T.Mesh(new T.SphereGeometry(1, 20, 12), cm); b.scale.set(2.4, 1.0, 1.8); b.position.y = 1.0; g.add(b);
        for (const sd of [-1, 1]) {
          for (let i = 0; i < 3; i++) { const l = new T.Mesh(new T.CylinderGeometry(0.18, 0.12, 2.6, 6), cm); l.position.set(-0.8 + i * 0.8, 0.7, sd * 2.0); l.rotation.x = sd * 1.1; g.add(l); }
          const claw = new T.Mesh(new T.SphereGeometry(0.7, 12, 8), cm); claw.scale.set(1.2, 0.7, 0.8); claw.position.set(2.6, 1.1, sd * 1.4); g.add(claw);
          const eye = new T.Mesh(new T.SphereGeometry(0.26, 8, 6), PL(0x111111, 0.2)); eye.position.set(1.6, 2.0, sd * 0.5); g.add(eye);
        }
        g.position.set(x, groundY(x, z) - 0.1, z); g.rotation.y = 2.4; K.add(g);
        AO(x, z, 3.5, 3, 0.4, 0, groundY(x, z) + 0.05);
      }
      // cocktail-stick paper flags stuck in the banks at the corners
      const sticks = [], flags = [];
      for (const s of [150, 175, 268, 290, 420, 445, 455, 565, 590, 845, 870]) {
        for (const side of [-1, 1]) {
          const q = track.place(s, side * (track.at(s).w / 2 + 3.6));
          if (hAt(q.x, q.z) < 0.6 || lagSD(q.x, q.z) < 2) continue;
          const y = hAt(q.x, q.z);
          sticks.push({ x: q.x, y: y + 2.4, z: q.z, rz: r.range(-0.12, 0.12), rx: r.range(-0.12, 0.12) });
          flags.push({ x: q.x + 1.1, y: y + 4.0, z: q.z, ry: r.range(-0.4, 0.4), color: r.pick([0xe8402e, 0x2f8ae0, 0xffc62a, 0x35b86a]) });
        }
      }
      const fg = (() => { const s = new T.Shape(); s.moveTo(-1.1, 0.8); s.lineTo(1.4, 0); s.lineTo(-1.1, -0.8); s.closePath(); return new T.ShapeGeometry(s); })();
      K.instances(new T.CylinderGeometry(0.1, 0.1, 5, 5), K.std({ color: 0xe9d6ae, roughness: 0.8 }), sticks);
      K.instances(fg, K.std({ color: 0xffffff, side: T.DoubleSide, roughness: 0.75 }), flags, { colors: true });
      // pebbles and shells that rolled into the water
      const wet = [];
      const rr = K.rng(808);
      for (let i = 0; i < 2600 && wet.length < 220 * Q + 60; i++) {
        const x = rr.range(-IX + 3, IX - 3), z = rr.range(-IZ + 3, IZ - 3), h = hAt(x, z);
        if (h > -0.5 || h < -5) continue;
        wet.push({ x, y: h + 0.1, z, s: rr.range(0.3, 0.9), ry: rr() * 6, color: rr.pick([0xb9b2a6, 0x9c948a, 0xd8d2c6, 0x8a8178, 0xe8e2d8, 0xf3d2c4]) });
      }
      K.instances(rockGeo, aqua(K.std({ color: 0xffffff, roughness: 0.6 })), wet, { colors: true, cast: false });
    }

    // ============================================================================
    // FINE SCATTER: shells, pebbles, starfish on the sand; leaves and petals on the water
    // ============================================================================
    {
      const pebbles = [], shells = [], stars = [], leaves = [];
      const rr = K.rng(404);
      let tries = 0;
      while ((pebbles.length < 520 * Q + 120 || shells.length < 120 * Q + 40) && tries++ < 20000) {
        const x = rr.range(-IX + 2, IX - 2), z = rr.range(-IZ + 2, IZ - 2);
        const h = hAt(x, z);
        if (h < 0.15 || rrIn(x, z, IX, IZ, RC) < 1) continue;
        // denser along the shorelines
        const near = h < 1.2 ? 1 : 0.35;
        if (rr() > near) continue;
        if (rr() < 0.8) pebbles.push({ x, y: h + 0.1, z, s: rr.range(0.3, 0.95), ry: rr() * 6, rx: rr() * 0.4, color: rr.pick([0xb9b2a6, 0x9c948a, 0xd8d2c6, 0x8a8178, 0xc6b49a, 0xe8e2d8]) });
        else shells.push({ x, y: h + 0.1, z, s: rr.range(0.6, 1.25), ry: rr() * 6, rx: -0.1, color: rr.pick([0xf7efe6, 0xf3d2c4, 0xffe9d6, 0xe9d6f0]) });
      }
      K.instances(rockGeo, K.std({ color: 0xffffff, roughness: 0.65 }), pebbles, { colors: true, cast: false });
      // scallop shell: ribbed fan
      const shellGeo = (() => {
        const s = new T.Shape(); s.moveTo(0, 0);
        for (let i = 0; i <= 16; i++) { const a = PI * (0.12 + 0.76 * i / 16); const rad = 1.2 + (i % 2) * 0.08; s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
        s.closePath();
        const g = new T.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.08, bevelSegments: 2, curveSegments: 4 });
        g.rotateX(-PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i), p.getZ(i)); if (p.getY(i) > 0.05) p.setY(i, p.getY(i) + 0.35 * (1 - d / 1.3)); }
        g.computeVertexNormals();
        return g;
      })();
      K.instances(shellGeo, K.phys({ color: 0xffffff, roughness: 0.4, clearcoat: 0.6 }), shells, { colors: true, cast: false });
      // plastic toy starfish
      for (const [x, z] of [[120, 40], [-60, 78], [50, -44], [-6, 6], [140, -40], [-80, 54]]) {
        if (hAt(x, z) < 0.4 || !K.offRoad(x, z, 4)) continue;
        stars.push({ x, y: hAt(x, z) + 0.15, z, ry: rr() * 6, s: rr.range(0.9, 1.2), color: rr.pick([0xff7a3a, 0xff5f8a, 0xb455e0]) });
      }
      const starGeo = (() => { const s = new T.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2, rad = i % 2 ? 0.9 : 2.6; if (!i) s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } const g = new T.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 3 }); g.rotateX(-PI / 2); return g; })();
      if (stars.length) K.instances(starGeo, K.phys({ color: 0xffffff, roughness: 0.35, clearcoat: 0.5 }), stars, { colors: true });
      // leaves and blossom petals floating on the water (off the racing line mostly)
      const leafG = (() => { const s = new T.Shape(); s.moveTo(-1, 0); s.quadraticCurveTo(0, 0.7, 1.1, 0); s.quadraticCurveTo(0, -0.7, -1, 0); const g = new T.ShapeGeometry(s, 5); g.rotateX(-PI / 2); return g; })();
      for (let i = 0; i < 70; i++) {
        const x = rr.range(-IX + 4, IX - 4), z = rr.range(-IZ + 4, IZ - 4);
        if (hAt(x, z) > -0.4) continue;
        leaves.push({ x, y: 0.04, z, ry: rr() * 6, s: rr.range(0.8, 1.6), color: rr.pick([0x7aa83a, 0x9cbc4a, 0xf2a7c0, 0xffffff, 0xd9c24a]) });
      }
      K.instances(leafG, K.std({ color: 0xffffff, roughness: 0.6, side: T.DoubleSide }), leaves, { colors: true, cast: false });
    }

    // ---------------- contact shadows: one instanced draw ----------------
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      mat.customProgramCacheKey = () => 'wt-ao';
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1;
    }

    // ---------------- merge static meshes per material (fewer draw calls) ----------------
    {
      const BU = K.BufferGeometryUtils;
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.material.transparent || o.renderOrder) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 70) return;
        const cell = Math.floor((c.x + 300) / 100) + ':' + Math.floor((c.z + 300) / 100);
        const key = o.material.uuid + cell + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(o);
      });
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        const geos = [];
        for (const o of list) {
          let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
          if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          if (!g.attributes.normal) g.computeVertexNormals();
          geos.push(g);
        }
        const hasCol = geos.some((g) => g.attributes.color);
        if (hasCol !== geos.every((g) => g.attributes.color)) continue;
        const merged = BU.mergeGeometries(geos, false);
        if (!merged) continue;
        const m = new T.Mesh(merged, list[0].material);
        m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
        for (const o of list) o.parent.remove(o);
        K.group.add(m);
      }
    }
    A.S = S;
  },

  // fixed-rate forces: currents, the lagoon swirl and the plughole's pull
  tick(dt, time, game) {
    if (!A || !A.FX) return;
    const D = DRAIN;
    for (const e of game.cars) {
      const c = e.car;
      if (c.state !== 'drive' || c.airborne || e.out) continue;
      keepInTub(c);
      // the water carries the boat along (its own velocity is relative to the water)
      const f = flowAt(c.x, c.z);
      if (f) { c.x += f[0] * dt; c.z += f[1] * dt; }
      const dx = D.x - c.x, dz = D.z - c.z, rr = Math.hypot(dx, dz);
      if (rr < D.pull && rr > 0.01) {
        const k = 1 - rr / D.pull;
        const vin = 14 * k * k + 2.5 * k;
        c.x += (dx / rr) * vin * dt; c.z += (dz / rr) * vin * dt;
        c.vx += (dx / rr) * 20 * k * k * dt; c.vz += (dz / rr) * 20 * k * k * dt;
        c.w += 1.8 * k * dt;
      }
    }
    for (const d of game.physics.dynamics) {
      if (d.state !== 'live') continue;
      const f = flowAt(d.x, d.z);
      if (f) { d.vx += f[0] * 0.3 * dt; d.vz += f[1] * 0.3 * dt; }
      const dx = D.x - d.x, dz = D.z - d.z, rr = Math.hypot(dx, dz);
      if (rr < D.pull && rr > 0.01) { const k = 1 - rr / D.pull; d.vx += (dx / rr) * 30 * k * k * dt; d.vz += (dz / rr) * 30 * k * k * dt; }
    }
  },

  animate(time, dt, game) {
    if (!A) return;
    A.uTime.value = time;
    if (A.wheel) A.wheel.rotation.z = WHEEL.w * time;
    if (A.gate) {
      const { leaves, lamps } = A.gate;
      for (let i = 0; i < 2; i++) {
        const l = gateLift(i, time);
        leaves[i].position.y = 0.5 + l * 6.2;
        const soon = gateLift(i, time + 0.7) < 0.5 || l < 0.5;
        lamps[i].emissiveIntensity = soon ? 2.2 : 0;
        lamps[i].color.setHex(soon ? 0xff3a2a : 0x2a8a3a);
        lamps[i].emissive.setHex(soon ? 0xff2a1a : 0x2aff5a);
        if (!soon) lamps[i].emissiveIntensity = 1.2;
      }
    }
    if (A.jets) for (const t of A.jets) t.offset.y = -time * 2.2;
    if (A.pinwheels) A.pinwheels.forEach((p, i) => { p.rotation.z = -time * (4.5 + i * 1.3); });
    for (const it of A.ducks) {
      const m = it.mesh, d = it.d;
      if (d.state !== 'live') continue;
      const b = Math.sin(time * 2.1 + it.ph);
      if (!it.ball) {
        m.position.y += b * 0.12 * it.amp;
        m.rotation.x = Math.sin(time * 1.7 + it.ph * 1.3) * 0.06;
        m.rotation.z = Math.cos(time * 1.9 + it.ph) * 0.07;
      } else m.position.y += b * 0.15;
    }
    if (game && game.particles && dt > 0 && dt < 0.2) {
      for (const em of A.emit) {
        if (Math.random() < dt * em.rate) game.particles.emit(em.x + (Math.random() - 0.5) * 1.5, 0.3, em.z + (Math.random() - 0.5) * 1.5, { color: 0xf4fcff, size: 0.7, life: 0.5, spread: 5, up: 8, grav: 40, grow: 1.4, alpha: 0.85 });
        if (Math.random() < dt * 4) game.particles.emit(em.x, 0.1, em.z, { color: 0xffffff, size: 2.4, life: 1.1, spread: 1, up: 0, grav: 0, grow: 3.5, alpha: 0.35 });
      }
      // suds kicked up by boats on the soap slick, foam at the wheel paddles
      for (const e of game.cars) {
        const c = e.car;
        if (c.state === 'drive' && c.surface === 'slick' && c.speed > 6 && Math.random() < dt * 25) {
          game.particles.emit(c.x, 0.6, c.z, { color: 0xffffff, size: 0.9, life: 0.9, spread: 4, up: 2.5, grav: -1, grow: 1.6, alpha: 0.7 });
        }
      }
    }
  },
};
