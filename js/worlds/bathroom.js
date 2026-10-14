// World: the family bathroom just after the bath overflowed. Hovercraft race over glossy floor tiles along a
// course the kids drew in bath crayon: through the flood under the cascade spilling over the tub rim, across
// a fluffy bath mat, over a towel ramp onto the bathroom scale, past a gurgling floor drain, a clockwork frog,
// a rubber-duck flotilla, foam islands, a fizzing bath bomb and a slick of spilt bubble bath.

const TRACK = [
  [-70, 72], [45, 71], [92, 60], [120, 36], [130, 4], [128, -25], [116, -55], [88, -74], [40, -80], [-35, -79],
  [-75, -71], [-98, -52], [-98, -28], [-80, -16], [-45, -17], [-5, -26], [35, -34], [64, -28], [74, -6], [60, 15],
  [28, 22], [-30, 35], [-90, 22], [-124, 32], [-128, 56], [-105, 70],
];
const WIDTH = 15;

// the bath along the north edge
const TUB = { x0: -72, x1: 112, zf: -95, zb: -170, h: 55, rim: 9 };
const CASC = { x: 17, w: 22 }; // the main overflow: a sheet of water down the bath panel
// the flood on the floor (smoothed outline)
const FLOOD = [
  [-66, -97], [112, -97], [107, -86], [94, -70], [78, -56], [80, -42], [72, -26], [52, -16], [26, -8], [-2, -2],
  [-28, 0], [-50, -5], [-60, -16], [-60, -34], [-66, -50], [-72, -66], [-72, -84],
];
// flood mask grid (world rect -> canvas)
const MK = { x0: -170, x1: 170, z0: -105, z1: 105, w: 512, h: 316 };
// bath mat in front of the bath's west end: a low platform (the pile)
const MAT = { x: -94, z: -32, hw: 44, hd: 30, ang: -0.05, h: 0.6 };
const SCALE_S = 241; // bathroom scale on the east straight (towel ramp up onto it)
const DRAIN_S = 612, DRAIN_OFF = 9.6, DRAIN_R = 3.3;
const FROG = { s: 664, lat: 15.5, P: 12, W: 4.6, TN: 1.4 };

let A = null; // runtime state for tick/animate

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// closed centripetal-ish Catmull-Rom smoothing of a polygon (for organic outlines)
function smoothPoly(pts, per = 6) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

function maskAt(x, z) {
  if (!A || !A.mask) return 0;
  const u = (x - MK.x0) / (MK.x1 - MK.x0) * MK.w, v = (z - MK.z0) / (MK.z1 - MK.z0) * MK.h;
  const i = Math.floor(u), j = Math.floor(v);
  if (i < 0 || j < 0 || i >= MK.w || j >= MK.h) return 0;
  return A.mask[j * MK.w + i] / 255;
}

// clockwork frog: swims across the road and back, turning round at each end. Pure function of time.
function frogPose(ax, az, bx, bz) {
  const dir = Math.atan2(bz - az, bx - ax);
  const ease = (f) => f * f * (3 - 2 * f);
  return (t) => {
    const { P, W, TN } = FROG;
    const u = (((t + 3.1) % P) + P) % P;
    let f, angle, kick = 0, moving = true;
    if (u < W) { f = ease(u / W); angle = dir; kick = u / W; }
    else if (u < W + TN) { f = 1; angle = dir + Math.PI * ease((u - W) / TN); moving = false; }
    else if (u < 2 * W + TN) { const q = (u - W - TN) / W; f = 1 - ease(q); angle = dir + Math.PI; kick = q; }
    else { f = 0; angle = dir + Math.PI + Math.PI * ease((u - 2 * W - TN) / TN); moving = false; }
    return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, angle, kick, moving, t };
  };
}

export default {
  id: 'bathroom',
  name: 'Bath Time Overflow',
  blurb: 'The bath overflowed! Hovercraft skim the flood, a fluffy mat and a towel ramp.',
  vehicle: 'hover',
  seed: 41,
  track: { points: TRACK, width: WIDTH, startS: 40 },
  bounds: { minX: -155, maxX: 155, minZ: -96, maxZ: 95 },
  fallOffEdges: false,
  floorY: -76,
  offCourse: 18,
  skidColor: 0x6a7a88,
  hoverSpray: 0xf2f8fc,
  wake: { color: 0xf4fcff },
  clackOnBump: false,
  dust: {
    normal: { color: 0xeef6fb, size: 0.9, life: 0.45, up: 1.2, grav: 2, alpha: 0.35, grow: 2.2 },
    slow: { color: 0xc9b6ee, size: 0.6, life: 0.5, up: 3, grav: 12, alpha: 0.7, grow: 1.3 },
    slick: { color: 0xffd6f0, size: 0.9, life: 0.7, up: 2.5, grav: -1, alpha: 0.75, grow: 1.6, rate: 2 },
  },
  lighting: {
    sunDir: [-0.85, 1.05, -0.3], sunColor: 0xf3f7ff, sunIntensity: 2.3,
    hemiSky: 0xe3eeff, hemiGround: 0xb9b2a8, hemiIntensity: 0.6,
    envIntensity: 0.5, exposure: 0.95, background: 0xdde5ea, shadowRadius: 2.4,
    fog: { color: 0xe6eef3, near: 240, far: 1100 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const PI = Math.PI, L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const Q = (K.quality && K.quality.grass) || 0.7;
    A = { uTime: { value: 0 }, floats: [], emit: [], cars: [], scaleTxt: '' };
    const keep = []; // objects excluded from the static merge (animated / dynamic)
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`bathroom: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };

    // ---------------- helpers ----------------
    const C = new T.Color();
    // paint a constant vertex colour onto a geometry (props share a few vertex-coloured materials -> merged draws)
    const vcol = (geo, hex) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const n = g.attributes.position.count, a = new Float32Array(n * 3);
      C.set(hex);
      for (let i = 0; i < n; i++) { a[i * 3] = C.r; a[i * 3 + 1] = C.g; a[i * 3 + 2] = C.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2));
      return g;
    };
    const mPlast = K.plastic(0xffffff, 0.32, { vertexColors: true });
    const mGloss = K.phys({ color: 0xffffff, vertexColors: true, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    const mMatte = K.std({ color: 0xffffff, vertexColors: true, roughness: 0.88 });
    const mWax = K.std({ color: 0xffffff, vertexColors: true, roughness: 0.55 });
    const chrome = K.metal(0xeef0f3, 0.1);
    // add a coloured part to a group
    const part = (grp, geo, hex, mat, x = 0, y = 0, z = 0, o = {}) => {
      const m = new T.Mesh(vcol(geo, hex), mat);
      m.position.set(x, y, z);
      if (o.rx || o.ry || o.rz) m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
      if (o.s) { if (Array.isArray(o.s)) m.scale.set(...o.s); else m.scale.setScalar(o.s); }
      grp.add(m);
      return m;
    };
    // merge a group's meshes per material into one mesh per material (for moving props)
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
          for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) gg.deleteAttribute(k);
          if (!gg.attributes.uv) gg.setAttribute('uv', new T.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
          return gg;
        });
        const hasC = geos.some((x) => x.attributes.color);
        if (hasC) for (const x of geos) if (!x.attributes.color) vcol(x, 0xffffff);
        const m = new T.Mesh(K.BufferGeometryUtils.mergeGeometries(geos, false), list[0].material);
        m.castShadow = true; m.receiveShadow = true;
        out.add(m);
      }
      return out;
    };
    // batched contact shadows (opacity rides in the unused y scale)
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.35, ang = 0, y = 0.05) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const place = (s, off = 0) => track.place(s, off);
    const sAt = (x, z) => track.distTo(x, z).s;

    // ============================================================================
    // SHARED TEXTURES
    // ============================================================================
    const noiseTex = (() => {
      const f1 = TX.noiseField(256, { seed: 411, period: 8, oct: 4 }), f2 = TX.noiseField(256, { seed: 412, period: 4, oct: 4 });
      const c = TX.paint(256, 256, (x, y, u, v, o) => { const k = y * 256 + x; o[0] = f1[k] * 255; o[1] = f2[k] * 255; o[2] = 128; });
      return TX.toTexture(c, { srgb: false });
    })();
    const waterN = (() => {
      const f = TX.noiseField(256, { seed: 421, period: 12, oct: 4, gain: 0.5 });
      return TX.toTexture(TX.normalFromHeight(f, 256, 256, 4.0), { srgb: false });
    })();
    const caustTex = (() => {
      const SZ = 256, CN = 7, rr = K.rng(97);
      const pts = [];
      for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) pts.push([(i + 0.1 + rr() * 0.8) / CN, (j + 0.1 + rr() * 0.8) / CN]);
      const c = TX.paint(SZ, SZ, (x, y, u, v, o) => {
        const ci = Math.floor(u * CN), cj = Math.floor(v * CN);
        let f1 = 9, f2 = 9;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = ci + di, jj = cj + dj;
          const p = pts[((jj + CN) % CN) * CN + ((ii + CN) % CN)];
          const px = p[0] + (ii < 0 ? -1 : ii >= CN ? 1 : 0), py = p[1] + (jj < 0 ? -1 : jj >= CN ? 1 : 0);
          const dd = Math.hypot(u - px, v - py) * CN;
          if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
        }
        const e = f2 - f1;
        const val = Math.pow(1 - ss(0, 0.4, e), 2.4) * 0.92 + 0.08 * (1 - ss(0, 1.0, e));
        o[0] = o[1] = o[2] = val * 255;
      });
      return TX.toTexture(c, { srgb: false });
    })();

    // ---------------- flood mask: R = water (sharp-ish edge), G = depth (wide blur) ----------------
    const floodPoly = smoothPoly(FLOOD, 8);
    A.floodPoly = floodPoly;
    {
      const draw = (blur) => {
        const c = TX.makeCanvas(MK.w, MK.h), g = c.getContext('2d');
        g.fillStyle = '#000'; g.fillRect(0, 0, MK.w, MK.h);
        g.filter = `blur(${blur}px)`;
        g.fillStyle = '#fff'; g.beginPath();
        floodPoly.forEach(([x, z], i) => {
          const u = (x - MK.x0) / (MK.x1 - MK.x0) * MK.w, v = (z - MK.z0) / (MK.z1 - MK.z0) * MK.h;
          if (i) g.lineTo(u, v); else g.moveTo(u, v);
        });
        g.closePath(); g.fill();
        g.fillRect((TUB.x0 + 2 - MK.x0) / (MK.x1 - MK.x0) * MK.w, 0, (TUB.x1 - TUB.x0 - 4) / (MK.x1 - MK.x0) * MK.w, (TUB.zf - 1 - MK.z0) / (MK.z1 - MK.z0) * MK.h);
        return g.getImageData(0, 0, MK.w, MK.h).data;
      };
      const a = draw(3), b = draw(16);
      const out = TX.makeCanvas(MK.w, MK.h), og = out.getContext('2d');
      const img = og.createImageData(MK.w, MK.h);
      A.mask = new Uint8Array(MK.w * MK.h);
      for (let i = 0; i < MK.w * MK.h; i++) {
        img.data[i * 4] = a[i * 4]; img.data[i * 4 + 1] = Math.min(a[i * 4], b[i * 4]); img.data[i * 4 + 2] = 0; img.data[i * 4 + 3] = 255;
        A.mask[i] = a[i * 4];
      }
      og.putImageData(img, 0, 0);
      A.maskTex = TX.toTexture(out, { srgb: false, wrap: false, flipY: false });
    }
    const uMaskRect = { value: new T.Vector4(MK.x0, MK.z0, 1 / (MK.x1 - MK.x0), 1 / (MK.z1 - MK.z0)) };

    // ============================================================================
    // FLOOR: glossy ceramic tiles with grout; wet + caustics under the flood
    // ============================================================================
    {
      const S = 1024, TILES = 5; // 100 units per texture repeat, 20-unit tiles
      const tp = S / TILES, grout = 0.42 * S / 100, bev = 0.9 * S / 100;
      const mott = TX.noiseField(256, { seed: 431, period: 6, oct: 4 });
      const fine = TX.noiseField(256, { seed: 432, period: 32, oct: 2 });
      const tint = [];
      for (let i = 0; i < TILES * TILES; i++) tint.push(0.965 + r() * 0.05);
      const H = new Float32Array(S * S);
      const rough = TX.makeCanvas(S);
      const Dp = 3.3 * S / 100; // cabochon half-diagonal (px)
      const map = TX.paint(S, S, (x, y, u, v, o) => {
        const ix = Math.floor(x / tp), iy = Math.floor(y / tp);
        const fx = x - ix * tp, fy = y - iy * tp;
        const gx = Math.min(fx, tp - fx), gy = Math.min(fy, tp - fy), dc = gx + gy;
        const m = TX.sampleField(mott, 256, u * 256 * 2, v * 256 * 2), f = TX.sampleField(fine, 256, x * 0.25, y * 0.25);
        let h;
        if (dc < Dp - grout / 2) {
          // small deep-teal square set diagonally where four tiles meet
          const e = ss(0, bev * 0.8, Dp - grout / 2 - dc);
          const k = (0.92 + (m - 0.5) * 0.16) * (0.9 + 0.1 * e);
          o[0] = 44 * k; o[1] = 118 * k; o[2] = 128 * k;
          h = 0.25 + 0.7 * Math.sqrt(e);
        } else if (dc < Dp + grout / 2 || Math.min(gx, gy) < grout / 2) {
          const gk = 1 + (f - 0.5) * 0.18;
          o[0] = 178 * gk; o[1] = 174 * gk; o[2] = 166 * gk;
          h = 0.05 + f * 0.04;
        } else {
          const d = Math.min(gx - grout / 2, gy - grout / 2, (dc - Dp - grout / 2) * 0.7071);
          const e = ss(0, bev, d);
          const k = tint[iy * TILES + ix] * (0.975 + (m - 0.5) * 0.06) * (0.92 + 0.08 * e);
          o[0] = 238 * k; o[1] = 234 * k; o[2] = 225 * k;
          if (f > 0.83 && ((x * 7 + y * 13) % 17) < 2) { o[0] *= 0.82; o[1] *= 0.82; o[2] *= 0.84; }
          h = 0.25 + 0.75 * Math.sqrt(e) + (m - 0.5) * 0.02;
        }
        H[y * S + x] = h;
      });
      TX.paint(S, S, (x, y, u, v, o) => {
        const h = H[y * S + x];
        const q = h < 0.15 ? 0.82 : 0.12 + (1 - h) * 0.25;
        o[0] = o[1] = o[2] = q * 255;
      }, rough);
      const tex = { map: TX.toTexture(map), normalMap: TX.toTexture(TX.normalFromHeight(H, S, S, 3.0), { srgb: false }), roughnessMap: TX.toTexture(rough, { srgb: false }) };
      const FX0 = -160, FX1 = 160, FZ0 = -175, FZ1 = 185;
      for (const t of Object.values(tex)) t.repeat.set((FX1 - FX0) / 100, (FZ1 - FZ0) / 100);
      const floorMat = K.phys({ map: tex.map, normalMap: tex.normalMap, normalScale: V2(0.55, 0.55), roughnessMap: tex.roughnessMap, clearcoat: 0.35, clearcoatRoughness: 0.16, clearcoatRoughnessMap: tex.roughnessMap, envMapIntensity: 0.22 });
      floorMat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uTime: A.uTime, uMask: { value: A.maskTex }, uMR: uMaskRect, uCaust: { value: caustTex }, uNoiseT: { value: noiseTex } });
        sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'varying vec3 vWP;\nuniform float uTime;\nuniform sampler2D uMask, uCaust, uNoiseT;\nuniform vec4 uMR;\nfloat gWet;\n' + sh.fragmentShader
          .replace('#include <color_fragment>', `#include <color_fragment>
            {
              vec2 mu = (vWP.xz - uMR.xy) * uMR.zw;
              vec2 mk = texture2D(uMask, mu).rg;
              gWet = mk.r;
              float mac = texture2D(uNoiseT, vWP.xz * 0.006).r;
              diffuseColor.rgb *= 0.965 + mac * 0.07;
              // damp halo round the flood, then the tinted, caustic-lit floor under the water
              float damp = smoothstep(0.0, 0.12, mk.r);
              float wet = smoothstep(0.1, 0.55, mk.r);
              diffuseColor.rgb *= 1.0 - 0.07 * damp;
              diffuseColor.rgb *= mix(vec3(1.0), vec3(0.70, 0.90, 0.93) - vec3(0.12, 0.06, 0.04) * mk.g, wet);
              vec2 cp = vWP.xz;
              vec2 wob = (texture2D(uNoiseT, cp * 0.021 + uTime * 0.013).rg - 0.5) * 3.0;
              float c1 = texture2D(uCaust, (cp + wob) * 0.068 + vec2(uTime * 0.045, uTime * 0.026)).r;
              float c2 = texture2D(uCaust, (cp - wob) * 0.051 + vec2(-uTime * 0.031, uTime * 0.04) + 0.37).r;
              float caus = c1 * c2 * 2.6 + (c1 + c2) * 0.05;
              diffuseColor.rgb *= 1.0 + caus * wet * (0.3 + 0.25 * mk.g);
            }`)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, min(roughnessFactor, 0.12), smoothstep(0.0, 0.15, gWet));');
      };
      floorMat.customProgramCacheKey = () => 'bath-floor';
      const g = new T.PlaneGeometry(FX1 - FX0, FZ1 - FZ0, 1, 1); g.rotateX(-PI / 2);
      const fm = K.mesh(g, floorMat, (FX0 + FX1) / 2, 0, (FZ0 + FZ1) / 2, { cast: false });
      keep.push(fm);
      A.floorMat = floorMat;
    }

    // ---------------- wall tiles (bath panel, walls) ----------------
    const wallTiles = (base, grout, accent = null, seed = 1, n = 4) => {
      const S = 512, tp = S / n, gw = 4;
      const f = TX.noiseField(256, { seed: 440 + seed, period: 8, oct: 3 });
      const H = new Float32Array(S * S);
      const B = TX.hex3(base), G = TX.hex3(grout), Ac = accent != null ? TX.hex3(accent) : null;
      const rr = K.rng(seed * 7);
      const tints = []; for (let i = 0; i < n * n; i++) tints.push([0.97 + rr() * 0.05, rr()]);
      const map = TX.paint(S, S, (x, y, u, v, o) => {
        const ix = Math.floor(x / tp), iy = Math.floor(y / tp);
        const fx = x - ix * tp, fy = y - iy * tp, d = Math.min(fx, fy, tp - fx, tp - fy);
        const nz = TX.sampleField(f, 256, u * 256, v * 256);
        if (d < gw / 2) { o[0] = G[0]; o[1] = G[1]; o[2] = G[2]; H[y * S + x] = 0; return; }
        const t = tints[iy * n + ix];
        const col = Ac && t[1] < 0.18 ? Ac : B;
        const e = ss(0, 6, d - gw / 2);
        const k = t[0] * (0.92 + 0.08 * e) * (0.98 + (nz - 0.5) * 0.05);
        o[0] = col[0] * k; o[1] = col[1] * k; o[2] = col[2] * k;
        H[y * S + x] = 0.3 + 0.7 * Math.sqrt(e);
      });
      return { map: TX.toTexture(map), normalMap: TX.toTexture(TX.normalFromHeight(H, S, S, 2.2), { srgb: false }) };
    };

    // ============================================================================
    // THE BATH along the north edge: tiled side panel, acrylic rim, water + foam, taps
    // ============================================================================
    const acrylic = K.phys({ color: 0xfbfbf8, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 });
    {
      const { x0, x1, zf, zb, h, rim } = TUB;
      const pt = wallTiles(0x9fd8d3, 0xf2f2ee, 0x6cc0bd, 3, 4); // aqua mosaic, 10-unit tiles
      for (const t of [pt.map, pt.normalMap]) { t.repeat.set((x1 - x0) / 40, (h - 4) / 40); }
      const panelMat = K.phys({ map: pt.map, normalMap: pt.normalMap, normalScale: V2(0.6), roughness: 0.14, clearcoat: 0.7, clearcoatRoughness: 0.06 });
      // front panel (only the front face shows)
      const pg = new T.PlaneGeometry(x1 - x0, h - 4); pg.translate((x0 + x1) / 2, (h - 4) / 2, zf);
      const pm = new T.Mesh(pg, panelMat); pm.receiveShadow = true; K.group.add(pm);
      // side return at the west end (visible from the top/west)
      const sg = new T.PlaneGeometry(zf - zb, h - 4); sg.rotateY(-PI / 2); sg.translate(x0, (h - 4) / 2, (zf + zb) / 2);
      const sm = new T.Mesh(sg, panelMat); sm.receiveShadow = true; K.group.add(sm);
      // tiny tiled skirting strip where the panel meets the floor (darker grout line)
      K.mesh(new T.BoxGeometry(x1 - x0, 0.5, 0.6), K.std({ color: 0xc8cfcc, roughness: 0.5 }), (x0 + x1) / 2, 0.25, zf + 0.1, { cast: false });
      // rounded acrylic rim on top (frame round the tub interior)
      const rimGeo = (len, depth) => new K.RoundedBoxGeometry(len, 4.4, depth, 3, 1.6);
      K.mesh(rimGeo(x1 - x0 + 2, rim), acrylic, (x0 + x1) / 2, h - 2.2, zf - rim / 2 + 0.8);
      K.mesh(rimGeo(x1 - x0 + 2, rim), acrylic, (x0 + x1) / 2, h - 2.2, zb + rim / 2);
      K.mesh(rimGeo(rim, zf - zb), acrylic, x0 + rim / 2 - 1, h - 2.2, (zf + zb) / 2);
      K.mesh(rimGeo(rim + 10, zf - zb), acrylic, x1 - rim / 2 - 4, h - 2.2, (zf + zb) / 2);
      // the bath water, brim full, with bubble-bath foam heaped on it
      const iw = x1 - x0 - 2 * rim - 8, idp = zf - zb - 2 * rim;
      const bw = K.phys({ color: 0x9fdbe6, roughness: 0.05, transparent: true, opacity: 0.85, clearcoat: 1, envMapIntensity: 1.3 });
      K.mesh(new T.PlaneGeometry(iw + 2, idp + 2), bw, (x0 + x1) / 2 - 5, h - 0.9, (zf + zb) / 2, { rx: -PI / 2, cast: false });
      const foamMat = K.phys({ color: 0xffffff, roughness: 0.42, sheen: 1, sheenColor: new T.Color(0xeaf6ff), clearcoat: 0.3 });
      const foam = [];
      for (let i = 0; i < 90; i++) {
        const x = x0 + rim + 4 + r() * (iw - 6), z = zb + rim + 3 + r() * (idp - 6);
        if (r() < 0.35 && x > x1 - 40) continue;
        foam.push({ x, y: h - 1, z, s: r.range(2.5, 6.5), sy: r.range(0.35, 0.8) });
      }
      for (const f of foam) { f.sx = f.sz = f.s; f.sy = f.s * f.sy; delete f.s; }
      K.instances(new T.SphereGeometry(1, 14, 10), foamMat, foam, { cast: false });
      // taps on the wall at the east end: a chrome mixer, spout running
      {
        const g = new T.Group();
        const tx = x1 - 26, tz = zb + 2;
        part(g, new T.CylinderGeometry(3.2, 3.6, 2, 24), 0xffffff, chrome, 0, 0, 0, { rx: PI / 2 });
        part(g, new T.CylinderGeometry(1.4, 1.4, 9, 16), 0xffffff, chrome, 0, 0, 5, { rx: PI / 2 });
        part(g, new T.SphereGeometry(1.5, 16, 12), 0xffffff, chrome, 0, -0.3, 9.6);
        part(g, new T.CylinderGeometry(1.1, 1.3, 2.5, 16), 0xffffff, chrome, 0, -1.8, 9.8);
        for (const sx of [-9, 9]) {
          part(g, new T.CylinderGeometry(2.2, 2.6, 3.2, 20), 0xffffff, chrome, sx, 0, 1.4, { rx: PI / 2 });
          part(g, new T.BoxGeometry(5.5, 1.1, 1.1), 0xffffff, chrome, sx, 0, 3.4);
          part(g, new T.CylinderGeometry(0.9, 0.9, 0.3, 16), sx < 0 ? 0xd83a2e : 0x2f6fe0, mGloss, sx, 0.62, 3.4);
        }
        g.position.set(tx, h + 9, tz);
        K.add(g);
        // running water from the spout
        const st = K.mesh(new T.CylinderGeometry(0.8, 1.0, 9, 12, 1, true), K.phys({ color: 0xdff6ff, roughness: 0.02, transparent: true, opacity: 0.55, clearcoat: 1 }), tx, h + 3.5, tz + 9.8, { cast: false });
        st.renderOrder = 2;
      }
      // the north wall behind the bath and the side walls
      const wt = wallTiles(0xf4f3ee, 0xd5d3cc, 0xa9dcd8, 5, 4);
      const wallMat = (rx, ry) => { const m = K.phys({ map: wt.map.clone(), normalMap: wt.normalMap.clone(), normalScale: V2(0.5), roughness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.1 }); m.map.repeat.set(rx, ry); m.normalMap.repeat.set(rx, ry); m.map.needsUpdate = m.normalMap.needsUpdate = true; return m; };
      const nw = new T.PlaneGeometry(330, 120); nw.translate(0, 60, -171);
      K.add(new T.Mesh(nw, wallMat(330 / 40, 3)), { cast: false });
      for (const sd of [-1, 1]) {
        const w = new T.PlaneGeometry(360, 120); w.rotateY(-sd * PI / 2); w.translate(sd * 160, 60, 5);
        K.add(new T.Mesh(w, wallMat(9, 3)), { cast: false });
        // skirting tile band
        K.mesh(new T.BoxGeometry(1.2, 6, 360), K.phys({ color: 0x5aa9b0, roughness: 0.2, clearcoat: 0.6 }), sd * 159.4, 3, 5, { cast: false });
      }
      // colliders: the bath panel is the north wall of the course
      K.box((x0 + x1) / 2, zf - 5, (x1 - x0) / 2, 5, 0, 60);
    }

    // ---------------- the overflow: a sheet of water down the bath panel, trickles, splash ----------------
    const fallMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      uniforms: { uTime: A.uTime, uN: { value: noiseTex } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform sampler2D uN;
        void main(){
          float u = vUv.x, v = vUv.y;
          float s1 = texture2D(uN, vec2(u * 2.2, v * 0.55 + uTime * 0.9)).r;
          float s2 = texture2D(uN, vec2(u * 5.1 + 0.3, v * 1.3 + uTime * 1.7)).g;
          float streak = smoothstep(0.45, 0.8, s1 * 0.6 + s2 * 0.6);
          float edge = smoothstep(0.0, 0.14, u) * smoothstep(1.0, 0.86, u);
          float lip = smoothstep(0.93, 1.0, v);
          float foot = smoothstep(0.12, 0.0, v);
          vec3 col = mix(vec3(0.78, 0.93, 0.98), vec3(1.0), streak * 0.85 + lip * 0.5 + foot * 0.6);
          float a = (0.4 + streak * 0.5 + lip * 0.3 + foot * 0.55) * edge;
          gl_FragColor = vec4(col * 1.08, clamp(a, 0.0, 0.92));
        }`,
    });
    const sheet = (cx, w, bulge = 1) => {
      // rows from the lip (v=1) down to the floor (v=0)
      const rows = 26, cols = 8;
      const pos = [], uv = [], idx = [];
      for (let j = 0; j <= rows; j++) {
        const v = j / rows; // 0 bottom -> 1 top
        const y = -0.2 + v * (TUB.h + 0.6);
        let z = TUB.zf + 0.35 + bulge * (0.9 * Math.pow(Math.max(0, (v - 0.9) / 0.1), 2) + 1.2 * Math.pow(Math.max(0, (0.1 - v) / 0.1), 2));
        const wv = w * (1 + 0.22 * (1 - v) * (1 - v));
        for (let i = 0; i <= cols; i++) {
          const u = i / cols;
          pos.push(cx + (u - 0.5) * wv, y, z + Math.sin(u * PI) * 0.15 * bulge);
          uv.push(u, v);
        }
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      g.computeVertexNormals();
      const m = new T.Mesh(g, fallMat); m.renderOrder = 3; m.frustumCulled = false;
      K.group.add(m); keep.push(m);
      return m;
    };
    sheet(CASC.x, CASC.w, 1.6);
    for (const [x, w] of [[-38, 2.6], [64, 3.4], [-60, 1.6]]) sheet(x, w, 0.6);
    A.emit.push({ x: CASC.x, z: TUB.zf + 1.6, w: CASC.w, rate: 46, big: true });
    {
      const fm = K.phys({ color: 0xffffff, roughness: 0.35, sheen: 1, sheenColor: new T.Color(0xe6f6ff), transparent: true, opacity: 0.92 });
      const lumps = [];
      for (let i = 0; i < 46; i++) {
        const u = r.range(-0.6, 0.6), d = Math.abs(r.gauss()) * 3.2;
        const sz = r.range(0.7, 1.9) * (1 - Math.abs(u) * 0.6);
        lumps.push({ x: CASC.x + u * CASC.w * 1.1, y: 0.3, z: TUB.zf + 0.8 + d, sx: sz * 1.3, sy: sz * 0.55, sz });
      }
      K.instances(new T.SphereGeometry(1, 12, 8), fm, lumps, { cast: false }).renderOrder = 3;
    }
    for (const x of [-38, 64]) A.emit.push({ x, z: TUB.zf + 0.8, w: 2.5, rate: 6 });

    // ============================================================================
    // THE FLOOD: clear shallow water with ripples, reflections, cascade and car ripples
    // ============================================================================
    const uCars = { value: [new T.Vector4(), new T.Vector4(), new T.Vector4(), new T.Vector4()] };
    A.uCars = uCars;
    {
      const mat = K.phys({ color: 0xffffff, roughness: 0.05, metalness: 0, ior: 1.33, transparent: true, depthWrite: false, envMapIntensity: 0.55, specularIntensity: 0.8 });
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uTime: A.uTime, uMask: { value: A.maskTex }, uMR: uMaskRect, uWN: { value: waterN }, uNoiseT: { value: noiseTex }, uCars, uCasc: { value: new T.Vector2(CASC.x, TUB.zf) } });
        sh.vertexShader = 'varying vec2 vWXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
        sh.fragmentShader = `varying vec2 vWXZ;
          uniform float uTime; uniform sampler2D uMask, uWN, uNoiseT; uniform vec4 uMR; uniform vec4 uCars[4]; uniform vec2 uCasc;
          float gDep; vec3 gNW = vec3(0.0, 1.0, 0.0);
          ` + sh.fragmentShader
          .replace('#include <color_fragment>', `#include <color_fragment>
            {
              vec2 mk = texture2D(uMask, (vWXZ - uMR.xy) * uMR.zw).rg;
              if (mk.r < 0.16) discard;
              gDep = mk.g;
              vec3 wc = mix(vec3(0.55, 0.88, 0.92), vec3(0.22, 0.66, 0.76), smoothstep(0.2, 1.0, gDep));
              float alpha = 0.12 + 0.2 * gDep;
              // bright meniscus line along the water's edge
              float men = smoothstep(0.16, 0.22, mk.r) * (1.0 - smoothstep(0.24, 0.42, mk.r));
              float fn = texture2D(uNoiseT, vWXZ * 0.12 + vec2(uTime * 0.02, -uTime * 0.015)).g;
              // foam where the cascade lands, swirling outwards
              vec2 dc = vWXZ - uCasc; dc.x *= 0.62;
              float dcl = length(dc);
              float f1 = texture2D(uNoiseT, vWXZ * 0.16 + vec2(0.0, -uTime * 0.12)).r;
              float f2 = texture2D(uNoiseT, vWXZ * 0.34 + vec2(uTime * 0.05, -uTime * 0.2)).g;
              float foam = smoothstep(0.42, 0.7, f1 * 0.7 + f2 * 0.5 - dcl * 0.028) * (1.0 - smoothstep(6.0, 24.0, dcl));
              foam = max(foam, smoothstep(0.7, 0.85, f2 + fn * 0.3) * (1.0 - smoothstep(8.0, 26.0, dcl)) * 0.6);
              // little white wakes behind moving hovercraft
              for (int i = 0; i < 4; i++) {
                vec4 cr = uCars[i];
                if (cr.w < 0.5) continue;
                float d = length(vWXZ - cr.xy);
                foam = max(foam, smoothstep(0.55, 0.8, f2 + 0.2) * (1.0 - smoothstep(1.5, 4.5, d)) * cr.z * 0.8);
              }
              diffuseColor.rgb = mix(wc, vec3(1.0), max(foam, men * 0.7));
              diffuseColor.a = max(alpha, max(foam * 0.85, men * (0.35 + 0.2 * fn)));
            }`)
          .replace('#include <normal_fragment_maps>', `{
              vec2 p = vWXZ;
              vec3 a = texture2D(uWN, p * 0.05 + vec2(0.012, 0.02) * uTime).xyz * 2.0 - 1.0;
              vec3 b = texture2D(uWN, p * 0.13 + vec2(-0.03, 0.011) * uTime + 0.5).xyz * 2.0 - 1.0;
              vec2 d = a.xy * 0.35 + b.xy * 0.22;
              // rings spreading from where the cascade lands
              vec2 dc = p - uCasc; float rc = length(dc) + 0.001;
              d += (dc / rc) * sin(rc * 1.25 - uTime * 7.0) * 0.55 * exp(-rc * 0.045);
              // bow waves round each hovercraft
              for (int i = 0; i < 4; i++) {
                vec4 cr = uCars[i];
                if (cr.w < 0.5) continue;
                vec2 dv = p - cr.xy; float rr = length(dv) + 0.001;
                d += (dv / rr) * sin(rr * 2.3 - uTime * 16.0) * cr.z * 0.9 * exp(-rr * 0.22) * smoothstep(1.0, 2.5, rr);
              }
              vec3 nW = normalize(vec3(d.x, 3.0, d.y));
              gNW = nW;
              normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
            }`)
          .replace('#include <opaque_fragment>', `
            float aOut = diffuseColor.a;
            vec3 spk = vec3(0.0);
            #if NUM_DIR_LIGHTS > 0
            {
              vec3 gn = texture2D(uWN, vWXZ * 0.41 + vec2(uTime * 0.07, -uTime * 0.05)).xyz * 2.0 - 1.0;
              vec3 nW2 = normalize(gNW + vec3(gn.x, 0.0, gn.y) * 0.25);
              vec3 n2 = normalize((viewMatrix * vec4(nW2, 0.0)).xyz);
              vec3 Rv = reflect(-geometryViewDir, n2);
              float g = pow(max(dot(Rv, directionalLights[0].direction), 0.0), 500.0);
              spk = directionalLights[0].color * g * 10.0;
            }
            #endif
            gl_FragColor = vec4(totalDiffuse + totalEmissiveRadiance + (min(totalSpecular, vec3(0.15)) + spk) / max(aOut, 0.05), aOut);`);
      };
      mat.customProgramCacheKey = () => 'bath-water';
      let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
      for (const [x, z] of floodPoly) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
      bx0 -= 8; bx1 += 8; bz1 += 8; bz0 = TUB.zf - 2;
      const g = new T.PlaneGeometry(bx1 - bx0, bz1 - bz0, 1, 1); g.rotateX(-PI / 2);
      const m = K.mesh(g, mat, (bx0 + bx1) / 2, 0.32, (bz0 + bz1) / 2, { cast: false, receive: false });
      m.renderOrder = 2; keep.push(m);
    }

    // ============================================================================
    // TRACK MARKINGS: drawn by the kids in bath crayon
    // ============================================================================
    const CRAY = [0xe5352b, 0x2f6fe0, 0x24a84a, 0x8a4fd0, 0xff8a1f, 0xf0559d];
    const inMat = (x, z, m = 0) => {
      const dx = x - MAT.x, dz = z - MAT.z, c = Math.cos(MAT.ang), s = Math.sin(MAT.ang);
      const a = dx * c + dz * s, b = -dx * s + dz * c;
      return Math.abs(a) < MAT.hw + m && Math.abs(b) < MAT.hd + m;
    };
    // waxy crayon stroke (white, alpha), u across, v along
    const crayonTex = (() => {
      const c = TX.makeCanvas(64, 256), g = c.getContext('2d');
      const img = g.createImageData(64, 256), d = img.data;
      const nf = TX.noiseField(256, { seed: 451, period: 16, oct: 3, sx: 0.08, sy: 1 });
      const nf2 = TX.noiseField(256, { seed: 452, period: 32, oct: 2 });
      for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
        const u = x / 63;
        const wob = (TX.sampleField(nf2, 256, y * 0.5, 3) - 0.5) * 0.18;
        const edge = ss(0.04 + wob, 0.2 + wob, u) * ss(0.96 + wob, 0.8 + wob, u);
        const streak = TX.sampleField(nf, 256, x * 4, y);
        const grain = TX.sampleField(nf2, 256, x * 4, y * 1.5);
        const a = edge * (0.55 + 0.45 * ss(0.3, 0.6, streak)) * (0.75 + 0.25 * grain);
        const i = (y * 64 + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, a * 340);
      }
      g.putImageData(img, 0, 0);
      return TX.toTexture(c);
    })();
    const crayonMat = K.std({ map: crayonTex, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.6, envMapIntensity: 0.3, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 });
    const crayonColorAt = (side, s) => {
      const seg = Math.floor(((s + (side > 0 ? 55 : 0)) % L) / 125);
      return CRAY[(seg + (side > 0 ? 2 : 0)) % CRAY.length];
    };
    const crayonChanges = [];
    {
      const pos = [], uv = [], col = [], idx = [];
      let vi = 0;
      const strip = (pts) => { // pts: [{x,z,nx,nz,hw,s,c,a}]
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          pos.push(p.x - p.nx * p.hw, 0.05, p.z - p.nz * p.hw, p.x + p.nx * p.hw, 0.05, p.z + p.nz * p.hw);
          uv.push(0, p.v, 1, p.v);
          C.set(p.c);
          col.push(C.r, C.g, C.b, p.a, C.r, C.g, C.b, p.a);
          if (i > 0) { const a = vi + (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        vi += pts.length * 2;
      };
      for (const side of [-1, 1]) {
        let cur = [], curC = null;
        const flush = () => {
          if (cur.length > 2) {
            // fade the stroke ends
            const n = cur.length;
            for (let i = 0; i < n; i++) cur[i].a = Math.min(1, i / 2.5, (n - 1 - i) / 2.5) * 0.95;
            strip(cur);
          }
          cur = [];
        };
        for (let s = 0; s < L + 0.5; s += 0.8) {
          const p = track.at(s);
          const wob = 0.24 * Math.sin(s * 0.09 + side * 2) + 0.1 * Math.sin(s * 0.33 + side);
          const off = side * (p.w / 2 + 0.3) + wob;
          const x = p.x + p.nx * off, z = p.z + p.nz * off;
          const c = crayonColorAt(side, s);
          if (inMat(x, z, 1.2)) { flush(); curC = c; continue; }
          if (curC !== null && c !== curC && cur.length) {
            // a new crayon: overlap the strokes a little
            crayonChanges.push({ s, side, c });
            const tail = cur.slice(-3);
            flush();
            cur = tail.map((q) => ({ ...q, c }));
          }
          curC = c;
          const hw = 0.72 + 0.1 * Math.sin(s * 0.21 + side * 5);
          cur.push({ x, z, nx: p.nx, nz: p.nz, hw, v: s / 6, c, a: 1 });
        }
        flush();
      }
      // kerbs: hatched crayon zig-zags on the outside of the tighter corners
      for (let s = 0; s < L; s += 1.7) {
        const p = track.at(s);
        if (Math.abs(p.curv) < 1 / 34) continue;
        const side = p.curv > 0 ? -1 : 1;
        const x0 = p.x + p.nx * side * (p.w / 2 + 1.0), z0 = p.z + p.nz * side * (p.w / 2 + 1.0);
        if (inMat(x0, z0, 2)) continue;
        const k = Math.floor(s / 1.7) % 2;
        const c = k ? crayonColorAt(side, s) : 0xffffff;
        const len = 2.4;
        const q0 = { x: x0, z: z0 }, q1 = { x: x0 + p.nx * side * len + p.tx * 1.1, z: z0 + p.nz * side * len + p.tz * 1.1 };
        const dx = q1.x - q0.x, dz = q1.z - q0.z, l = Math.hypot(dx, dz);
        const nx = -dz / l, nz = dx / l;
        strip([{ x: q0.x, z: q0.z, nx, nz, hw: 0.32, v: 0, c, a: k ? 0.9 : 0.75 }, { x: q1.x, z: q1.z, nx, nz, hw: 0.32, v: 0.4, c, a: k ? 0.9 : 0.75 }]);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new T.Float32BufferAttribute(col, 4));
      g.setIndex(idx);
      g.computeVertexNormals();
      const nrm = g.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
      const m = new T.Mesh(g, crayonMat); m.receiveShadow = true; m.renderOrder = 1;
      K.group.add(m); keep.push(m);
    }

    // crayon doodles on canvas (start grid, finish line, pictures on the tiles)
    const crayonCanvas = (w, h, draw) => {
      const c = TX.makeCanvas(w, h), g = c.getContext('2d');
      g.lineCap = 'round'; g.lineJoin = 'round';
      draw(g, w, h);
      // waxy grain: knock random speckles out of the strokes
      g.globalCompositeOperation = 'destination-out';
      const rr = K.rng(w + h);
      for (let i = 0; i < w * h * 0.035; i++) { g.fillStyle = `rgba(0,0,0,${0.25 + rr() * 0.6})`; g.fillRect(rr() * w, rr() * h, 1 + rr() * 2, 1 + rr() * 1.2); }
      g.globalCompositeOperation = 'source-over';
      return c;
    };
    const decalMat = (c) => K.std({ map: TX.toTexture(c, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -3 });
    const flatDecal = (mat, x, z, w, h, ang, y = 0.06) => {
      const m = K.mesh(new T.PlaneGeometry(w, h), mat, x, y, z, { cast: false });
      m.rotation.order = 'YXZ'; m.rotation.y = ang; m.rotation.x = -PI / 2;
      m.renderOrder = 1; keep.push(m);
      return m;
    };
    // start/finish: chequers scribbled in black crayon, grid boxes with numbers, an arrow
    {
      const s0 = 40, p = track.at(s0);
      const c = crayonCanvas(512, 640, (g) => {
        // layout: x across the road (512 px = 19.2 units), y along it (640 px = 24 units), top = ahead
        const U = 512 / 19.2;
        const yLine = 640 - 14 * U; // the line sits 14 units from the bottom edge
        const cell = 1.45 * U;
        for (let i = 0; i < 11; i++) for (let j = 0; j < 2; j++) {
          const x0 = (19.2 / 2 - 7.6) * U + i * cell * 0.955, y0 = yLine - cell + j * cell;
          if ((i + j) % 2) {
            g.strokeStyle = '#1d1d22'; g.lineWidth = 5;
            for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(x0 + 2, y0 + 3 + k * cell / 7); g.lineTo(x0 + cell - 2, y0 + 1 + k * cell / 7 + 3); g.stroke(); }
          }
        }
        g.strokeStyle = '#1d1d22'; g.lineWidth = 4;
        g.strokeRect((19.2 / 2 - 7.6) * U, yLine - cell, 15.2 * U, cell * 2);
        // grid boxes (2x2 staggered) with numbers
        const slots = [[0, -3.2], [2.5, 3.2], [7.5, -3.2], [10, 3.2]];
        g.font = 'bold 54px "Lilita One", Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        slots.forEach(([back, lat], i) => {
          const cx = (9.6 + lat) * U, cy = yLine + cell + back * U + 1.0 * U;
          const col = ['#e5352b', '#2f6fe0', '#e8a400', '#24a84a'][i];
          g.strokeStyle = col; g.lineWidth = 7;
          g.beginPath(); g.moveTo(cx - 1.7 * U, cy - 2.6 * U); g.lineTo(cx - 1.7 * U, cy + 2.4 * U); g.lineTo(cx + 1.7 * U, cy + 2.4 * U); g.lineTo(cx + 1.7 * U, cy - 2.6 * U); g.stroke();
          g.fillStyle = col; g.fillText(String(i + 1), cx, cy + 3.4 * U);
        });
        // arrow ahead of the line
        g.strokeStyle = '#ff8a1f'; g.lineWidth = 10;
        const ay = yLine - cell - 3.2 * U;
        g.beginPath(); g.moveTo(9.6 * U, ay + 2.2 * U); g.lineTo(9.6 * U, ay - 2.4 * U); g.stroke();
        g.beginPath(); g.moveTo(9.6 * U - 1.4 * U, ay - 1.0 * U); g.lineTo(9.6 * U, ay - 2.6 * U); g.lineTo(9.6 * U + 1.4 * U, ay - 1.0 * U); g.stroke();
      });
      const m = flatDecal(decalMat(c), 0, 0, 19.2, 24, 0);
      // centre the decal so its line lands at s0; canvas top = ahead (+tangent)
      const ctr = place(s0 - 2, 0);
      m.position.set(ctr.x, 0.065, ctr.z);
      m.rotation.order = 'YXZ'; m.rotation.y = -p.angle - PI / 2; m.rotation.x = -PI / 2;
      // FINISH / START words written beside the line, off the road
      const wc = crayonCanvas(512, 128, (g) => {
        g.font = 'bold 92px "Lilita One", Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 6; g.strokeStyle = '#2f6fe0'; g.fillStyle = 'rgba(47,111,224,0.0)';
        g.strokeText('START', 256, 66);
      });
      const wp = place(s0 - 6, 14.5);
      flatDecal(decalMat(wc), wp.x, wp.z, 18, 4.5, -p.angle);
    }
    // doodles: an atlas of 8 drawings, scattered on the tiles (one merged draw)
    {
      const c = crayonCanvas(1024, 512, (g) => {
        const cellAt = (i) => [(i % 4) * 256, Math.floor(i / 4) * 256];
        const stroke = (col, w) => { g.strokeStyle = col; g.lineWidth = w; };
        // 0 sun
        { const [x, y] = cellAt(0); stroke('#ffb000', 9); g.beginPath(); g.arc(x + 128, y + 128, 46, 0, 7); g.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; g.beginPath(); g.moveTo(x + 128 + Math.cos(a) * 62, y + 128 + Math.sin(a) * 62); g.lineTo(x + 128 + Math.cos(a) * 98, y + 128 + Math.sin(a) * 98); g.stroke(); } stroke('#e5352b', 7); g.beginPath(); g.arc(x + 128, y + 136, 22, 0.3, PI - 0.3); g.stroke(); g.fillStyle = '#e5352b'; g.fillRect(x + 108, y + 108, 9, 9); g.fillRect(x + 140, y + 108, 9, 9); }
        // 1 fish
        { const [x, y] = cellAt(1); stroke('#ff8a1f', 9); g.beginPath(); g.ellipse(x + 118, y + 128, 72, 44, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x + 186, y + 128); g.lineTo(x + 236, y + 88); g.lineTo(x + 236, y + 168); g.closePath(); g.stroke(); g.fillStyle = '#222'; g.beginPath(); g.arc(x + 78, y + 116, 8, 0, 7); g.fill(); stroke('#2f6fe0', 6); for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + 30 - k * 4, y + 60 - k * 24, 8 + k * 3, 0, 7); g.stroke(); } }
        // 2 house
        { const [x, y] = cellAt(2); stroke('#8a4fd0', 9); g.strokeRect(x + 58, y + 118, 140, 110); g.beginPath(); g.moveTo(x + 44, y + 124); g.lineTo(x + 128, y + 40); g.lineTo(x + 212, y + 124); g.stroke(); stroke('#24a84a', 8); g.strokeRect(x + 110, y + 168, 36, 60); stroke('#2f6fe0', 7); g.strokeRect(x + 76, y + 140, 26, 22); g.strokeRect(x + 156, y + 140, 26, 22); }
        // 3 heart
        { const [x, y] = cellAt(3); stroke('#f0559d', 11); g.beginPath(); g.moveTo(x + 128, y + 210); g.bezierCurveTo(x + 20, y + 140, x + 40, y + 40, x + 128, y + 90); g.bezierCurveTo(x + 216, y + 40, x + 236, y + 140, x + 128, y + 210); g.stroke(); }
        // 4 race car
        { const [x, y] = cellAt(4); stroke('#e5352b', 9); g.beginPath(); g.moveTo(x + 30, y + 160); g.lineTo(x + 40, y + 120); g.lineTo(x + 90, y + 112); g.lineTo(x + 120, y + 80); g.lineTo(x + 170, y + 80); g.lineTo(x + 196, y + 116); g.lineTo(x + 230, y + 124); g.lineTo(x + 230, y + 160); g.closePath(); g.stroke(); stroke('#222', 9); g.beginPath(); g.arc(x + 74, y + 164, 20, 0, 7); g.stroke(); g.beginPath(); g.arc(x + 188, y + 164, 20, 0, 7); g.stroke(); stroke('#2f6fe0', 6); for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 6, y + 110 + k * 18); g.lineTo(x + 24 - k * 4, y + 110 + k * 18); g.stroke(); } }
        // 5 VROOM
        { const [x, y] = cellAt(5); g.font = 'bold 66px "Lilita One", Rubik, sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#24a84a'; g.save(); g.translate(x + 128, y + 140); g.rotate(-0.15); g.strokeText('VROOM!', 0, 0); g.restore(); }
        // 6 flower
        { const [x, y] = cellAt(6); stroke('#24a84a', 8); g.beginPath(); g.moveTo(x + 128, y + 240); g.quadraticCurveTo(x + 118, y + 180, x + 128, y + 130); g.stroke(); stroke('#f0559d', 8); for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; g.beginPath(); g.ellipse(x + 128 + Math.cos(a) * 34, y + 96 + Math.sin(a) * 34, 22, 14, a, 0, 7); g.stroke(); } stroke('#ffb000', 9); g.beginPath(); g.arc(x + 128, y + 96, 14, 0, 7); g.stroke(); }
        // 7 smiley stick family
        { const [x, y] = cellAt(7); for (let k = 0; k < 3; k++) { const cx = x + 60 + k * 68, sc = k === 2 ? 0.7 : 1; stroke(['#2f6fe0', '#e5352b', '#8a4fd0'][k], 7); g.beginPath(); g.arc(cx, y + 90 + (1 - sc) * 60, 22 * sc, 0, 7); g.stroke(); g.beginPath(); g.moveTo(cx, y + 112 + (1 - sc) * 60); g.lineTo(cx, y + 180); g.lineTo(cx - 20 * sc, y + 230); g.moveTo(cx, y + 180); g.lineTo(cx + 20 * sc, y + 230); g.moveTo(cx - 28 * sc, y + 140 + (1 - sc) * 40); g.lineTo(cx + 28 * sc, y + 140 + (1 - sc) * 40); g.stroke(); } }
      });
      const mat = decalMat(c);
      const spots = [[0, 70, 48, 12], [1, -20, -46, 13], [2, 18, 46, 15], [3, -75, 46, 11], [4, 110, 12, 12], [5, -8, 88, 13], [6, 140, 70, 13], [7, -136, 76, 14], [1, 46, -56, 11], [6, -30, 10, 11]];
      const geos = [];
      for (const [i, x, z, sz] of spots) {
        warnRoad('doodle', x, z, sz * 0.45);
        const g = new T.PlaneGeometry(sz, sz); g.rotateX(-PI / 2); g.rotateY(r.range(-0.6, 0.6));
        const u0 = (i % 4) / 4, v0 = 1 - (Math.floor(i / 4) + 1) / 2, uvA = g.attributes.uv;
        for (let k = 0; k < uvA.count; k++) uvA.setXY(k, u0 + uvA.getX(k) / 4, v0 + uvA.getY(k) / 2);
        g.translate(x, 0.055, z);
        geos.push(g);
      }
      const m = new T.Mesh(K.BufferGeometryUtils.mergeGeometries(geos, false), mat); m.renderOrder = 1; m.receiveShadow = true;
      K.group.add(m); keep.push(m);
    }

    // ============================================================================
    // BATH MAT: fluffy shag pile (instanced shells) on a low platform
    // ============================================================================
    {
      const { x, z, hw, hd, ang, h } = MAT;
      K.platform(x, z, hw, hd, ang, h);
      K.surface('slow', { poly: [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [x + a * Math.cos(ang) - b * Math.sin(ang), z + a * Math.sin(ang) + b * Math.cos(ang)]) });
      // colour: lavender with a white wave border
      const mc = TX.paint(512, 352, (px, py, u, v, o) => {
        const ex = Math.min(u, 1 - u) * hw * 2, ez = Math.min(v, 1 - v) * hd * 2, e = Math.min(ex, ez);
        const wave = 3.4 + Math.sin((u * hw * 2 + v * hd * 2) * 0.55) * 0.6;
        const band = e > wave && e < wave + 2.2;
        const n = Math.random() * 14;
        if (band) { o[0] = 246 + n * 0.5; o[1] = 244 + n * 0.5; o[2] = 250; }
        else { o[0] = 176 + n; o[1] = 156 + n; o[2] = 222 + n * 0.5; }
      });
      const mapT = TX.toTexture(mc, { wrap: false });
      // strand heights: random cells with clumps
      const sc = TX.makeCanvas(256), sg = sc.getContext('2d');
      const img = sg.createImageData(256, 256);
      const clump = TX.noiseField(256, { seed: 461, period: 16, oct: 3 });
      const cellH = new Float32Array(64 * 64);
      for (let i = 0; i < cellH.length; i++) cellH[i] = r();
      for (let py = 0; py < 256; py++) for (let px = 0; px < 256; px++) {
        const cx = px >> 2, cy = py >> 2, fx = (px & 3) - 1.5, fy = (py & 3) - 1.5;
        const rad = Math.hypot(fx, fy) / 2.2;
        const hh = cellH[cy * 64 + cx] * 0.75 + clump[py * 256 + px] * 0.45;
        const v = Math.max(0, hh * (1 - rad * rad * 0.9));
        const i = (py * 256 + px) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, v * 255); img.data[i + 3] = 255;
      }
      sg.putImageData(img, 0, 0);
      const strandT = TX.toTexture(sc, { srgb: false });
      const N = Math.round(8 + 8 * Q);
      const y0 = h - 0.45, y1 = h + 1.0;
      const shellMat = K.std({ map: mapT, roughness: 0.95, side: T.DoubleSide, alphaTest: 0.5, transparent: false });
      shellMat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uStrand: { value: strandT }, uMask: { value: A.maskTex }, uMR: uMaskRect, uY: { value: new T.Vector2(y0, y1) } });
        sh.vertexShader = 'varying float vLay; varying vec3 vWP2;\nuniform vec2 uY;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          vLay = (instanceMatrix[3].y - uY.x) / (uY.y - uY.x);
          #else
          vLay = 0.0;
          #endif
          vWP2 = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
        sh.fragmentShader = 'varying float vLay; varying vec3 vWP2;\nuniform sampler2D uStrand, uMask; uniform vec4 uMR;\n' + sh.fragmentShader
          .replace('#include <alphatest_fragment>', `
            vec2 lean = (texture2D(uStrand, vWP2.xz * 0.006 + 0.3).rg - 0.45) * 2.2;
            float sv = texture2D(uStrand, (vWP2.xz + lean * vLay * vLay * 1.4) * 0.034).r;
            float bend = texture2D(uStrand, vWP2.xz * 0.011 + 0.7).g;
            diffuseColor.a = (sv + 0.06 - vLay * 0.95 > 0.0 || vLay < 0.02) ? 1.0 : 0.0;
            diffuseColor.rgb *= 0.36 + 0.78 * vLay * vLay + 0.12 * (bend - 0.5) + 0.25 * vLay * (sv - 0.5);
            float soak = texture2D(uMask, (vWP2.xz - uMR.xy) * uMR.zw).g;
            diffuseColor.rgb *= 1.0 - 0.38 * smoothstep(0.05, 0.6, soak);
            #include <alphatest_fragment>`);
      };
      shellMat.customProgramCacheKey = () => 'bath-mat-shell';
      const pg = new T.PlaneGeometry(hw * 2, hd * 2); pg.rotateX(-PI / 2);
      const shells = [];
      for (let i = 0; i < N; i++) shells.push({ x, y: y0 + (y1 - y0) * (i / (N - 1)), z, ry: -ang });
      const im = K.instances(pg, shellMat, shells, { cast: false, receive: true });
      keep.push(im);
      // backing + bound edge
      K.mesh(new K.RoundedBoxGeometry(hw * 2 + 0.6, h, hd * 2 + 0.6, 2, 0.25), K.std({ color: 0x9c88c8, roughness: 0.9 }), x, h / 2, z, { ry: -ang, cast: false });
      AO(x, z, hw + 3, hd + 3, 0.28, ang);
      // pop-bead chains along the road edges where it crosses the mat
      const beads = [];
      const bc = [0xe5352b, 0xffb000, 0x24a84a, 0x2f6fe0, 0xf0559d, 0x8a4fd0];
      for (const side of [-1, 1]) {
        let k = 0;
        for (const p of track.edgePoints(side, 0.95, 0.55)) {
          if (!inMat(p.x, p.z, -0.8)) continue;
          beads.push({ x: p.x, y: h + 0.75, z: p.z, s: 0.5, color: bc[Math.floor(k++ / 2) % bc.length], ry: p.angle });
        }
      }
      K.instances(new T.SphereGeometry(1, 12, 8), K.plastic(0xffffff, 0.22), beads, { colors: true });
    }

    // ============================================================================
    // BATHROOM SCALE on the east straight, a towel draped over its edge as the ramp
    // ============================================================================
    {
      const p = track.at(SCALE_S), ang = p.angle;
      const SH = 3.4, SL = 30, SW = 30, RL = 12;
      K.platform(p.x, p.z, SL / 2, SW / 2, ang, SH);
      const rp = track.at(SCALE_S - SL / 2 - RL / 2 + 0.3);
      K.ramp(rp.x, rp.z, ang, RL, 24, SH, 0);
      const g = new T.Group();
      // white body with rounded corners, glass top, chrome trim, display
      part(g, new K.RoundedBoxGeometry(SL, SH - 0.6, SW, 4, 1.2), 0xf6f6f3, mGloss, 0, (SH - 0.6) / 2, 0);
      const fc = TX.makeCanvas(512, 512), fg = fc.getContext('2d');
      const gr = fg.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0, '#dfe9ee'); gr.addColorStop(0.5, '#c9d8df'); gr.addColorStop(1, '#d8e4ea');
      fg.fillStyle = gr; fg.fillRect(0, 0, 512, 512);
      fg.fillStyle = 'rgba(255,255,255,0.35)'; fg.beginPath(); fg.moveTo(0, 120); fg.lineTo(120, 0); fg.lineTo(190, 0); fg.lineTo(0, 190); fg.fill();
      // two foot outlines, toes towards the display (+u)
      for (const sd of [-1, 1]) {
        fg.save(); fg.translate(270, 256 + sd * 78); fg.rotate(sd * 0.06);
        fg.fillStyle = 'rgba(120,140,150,0.55)';
        fg.beginPath(); fg.ellipse(0, 0, 120, 44, 0, 0, Math.PI * 2); fg.fill();
        fg.fillStyle = '#d3e0e6'; fg.beginPath(); fg.ellipse(-6, 0, 108, 34, 0, 0, Math.PI * 2); fg.fill();
        fg.fillStyle = 'rgba(120,140,150,0.55)';
        for (let k = 0; k < 5; k++) { const a = (k - 2) * 0.32 * sd; fg.beginPath(); fg.arc(132 + Math.cos(a) * 12 - k * 2, sd * (k - 2) * 15, 9 - Math.abs(k - (sd > 0 ? 0 : 4)) * 0.9, 0, Math.PI * 2); fg.fill(); }
        fg.restore();
      }
      const topM = new T.Mesh(new T.PlaneGeometry(SL - 1.2, SW - 1.2), K.phys({ map: TX.toTexture(fc, { wrap: false }), roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2 }));
      topM.rotation.x = -PI / 2; topM.rotation.z = -PI / 2; topM.position.y = SH - 0.05; topM.receiveShadow = true;
      g.add(topM); keep.push(topM);
      part(g, new K.RoundedBoxGeometry(SL - 0.2, 0.45, SW - 0.2, 3, 0.2), 0xb9c7cf, mGloss, 0, SH - 0.32, 0);
      part(g, new T.BoxGeometry(SL - 2, 0.12, 0.35), 0xffffff, chrome, 0, SH - 0.02, SW / 2 - 1.2);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, new T.CylinderGeometry(1.4, 1.6, 0.5, 14), 0x333333, mMatte, a * (SL / 2 - 3), 0.25, b * (SW / 2 - 3));
      g.position.set(p.x, 0, p.z); g.rotation.y = -ang;
      K.add(g);
      AO(p.x, p.z, SL / 2 + 2, SW / 2 + 2, 0.4, ang);
      // LCD display (canvas, redrawn when the reading changes)
      const dc = TX.makeCanvas(256, 96);
      const dt = TX.toTexture(dc, { wrap: false });
      const drawLCD = (txt) => {
        const g2 = dc.getContext('2d');
        g2.fillStyle = '#1d2a33'; g2.fillRect(0, 0, 256, 96);
        g2.fillStyle = '#9fe9ff'; g2.font = 'bold 64px "Courier New", monospace'; g2.textAlign = 'right'; g2.textBaseline = 'middle';
        g2.fillText(txt, 200, 52);
        g2.font = 'bold 26px Rubik, sans-serif'; g2.fillText('kg', 246, 60);
        dt.needsUpdate = true;
      };
      drawLCD('0.0');
      const lcd = new T.Mesh(new T.PlaneGeometry(9, 3.4), K.std({ map: dt, emissive: 0x9fe9ff, emissiveMap: dt, emissiveIntensity: 0.35, roughness: 0.2 }));
      lcd.rotation.x = -PI / 2; lcd.rotation.z = -PI / 2;
      lcd.position.set(SL / 2 - 4.2, SH + 0.03, 0);
      g.add(lcd); keep.push(lcd);
      A.scale = { x: p.x, z: p.z, ang, SL, SW, SH, drawLCD, last: '0.0' };
      // the towel: terry loops + woven stripes; draped from the floor up the ramp and over the scale's edge
      const tw = TX.paint(256, 256, (px, py, u, v, o) => {
        const loop = (Math.sin(px * 1.6) * Math.sin(py * 1.6)) * 0.5 + 0.5;
        const n = Math.random() * 0.12;
        const stripe = (v > 0.08 && v < 0.15) || (v > 0.19 && v < 0.23);
        const band = v > 0.0 && v < 0.05;
        const k = 0.8 + 0.2 * loop - n;
        if (stripe) { o[0] = 250 * k; o[1] = 246 * k; o[2] = 240 * k; } else if (band) { o[0] = 190 * k; o[1] = 82 * k; o[2] = 66 * k; } else { o[0] = 236 * k; o[1] = 128 * k; o[2] = 98 * k; }
      });
      const twH = TX.noiseField(256, { seed: 471, period: 64, oct: 2 });
      const towelTex = TX.toTexture(tw, { wrap: true });
      const towelN = TX.toTexture(TX.normalFromHeight(twH, 256, 256, 6), { srgb: false });
      const towelMat = K.std({ map: towelTex, normalMap: towelN, normalScale: V2(1.6), roughness: 0.97, side: T.DoubleSide });
      // grid in the ramp frame: a along the road (0 = floor end), b across
      const NA = 28, NB = 12, TW = 25, LA = RL + 9;
      const pos = [], uv = [], idx = [];
      const prof = (a) => {
        if (a < 0.6) return 0.25;
        if (a <= RL) return 0.25 + (SH + 0.15) * ss(0.4, RL, a) * 0.98;
        return SH + 0.42;
      };
      for (let i = 0; i <= NA; i++) {
        const a = -3 + (LA + 3) * (i / NA);
        for (let j = 0; j <= NB; j++) {
          const b = (j / NB - 0.5) * TW;
          const wr = Math.sin(a * 0.9 + b * 0.3) * 0.12 + Math.sin(b * 1.3) * 0.06 + 0.3 * Math.sin(b * 0.75 + a * 0.12) * (a < RL + 2 ? 1 : 0.35);
          const sag = a > RL ? 0 : -0.25 * Math.sin(PI * a / RL);
          pos.push(a, prof(a) + wr + sag, b);
          uv.push(j / NB, a / 26);
        }
      }
      for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) { const a = i * (NB + 1) + j, b = a + 1, c = a + NB + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const tg = new T.BufferGeometry();
      tg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); tg.setIndex(idx);
      tg.computeVertexNormals();
      for (const sd of [-1, 1]) {
        const hp = [];
        for (let i = 0; i <= NA; i++) { const a = -3 + (LA + 3) * (i / NA), b = sd * TW / 2; hp.push(new T.Vector3(a, prof(a) + Math.sin(a * 0.9 + b * 0.3) * 0.12 + 0.05, b)); }
        const hm = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hp), 40, 0.35, 8, false), towelMat);
        tg.userData.hems = (tg.userData.hems || []).concat([hm]);
      }
      const ts = place(SCALE_S - SL / 2 - RL, 0);
      const tm = K.mesh(tg, towelMat, ts.x, 0, ts.z, { ry: -ang });
      tm.rotation.y = -ang;
      for (const hm of tg.userData.hems) { tm.add(hm); hm.castShadow = true; hm.receiveShadow = true; }
      // the rest of the towel heaped beside the road (east side)
      const heapMat = K.std({ color: 0xe98466, normalMap: towelN, normalScale: V2(1.6), roughness: 0.97 });
      const heap = new T.Group();
      for (let i = 0; i < 6; i++) {
        const mm = new T.Mesh(new T.SphereGeometry(1, 20, 12), heapMat);
        mm.scale.set(r.range(5, 8), r.range(2.2, 4), r.range(4, 6.5)); mm.position.set(r.range(-4, 4), mm.scale.y * 0.55, r.range(-5, 5)); mm.rotation.y = r() * 3;
        heap.add(mm);
      }
      const hp = place(SCALE_S - SL / 2 - RL - 4, 15);
      heap.position.set(hp.x + 2, 0, hp.z); K.add(heap);
      AO(hp.x + 2, hp.z, 11, 10, 0.4);
      K.circle(hp.x + 2, hp.z, 7.5, 6);
      warnRoad('towel heap', hp.x + 2, hp.z, 7);
    }

    // ============================================================================
    // DRAIN in the floor (a hole) with a swirl, at the flood's southern edge
    // ============================================================================
    {
      const p = place(DRAIN_S, DRAIN_OFF);
      A.drain = { x: p.x, z: p.z, r: DRAIN_R, pull: 13 };
      K.hole(p.x, p.z, DRAIN_R);
      const gc = TX.paint(256, 256, (px, py, u, v, o) => {
        const dx = u - 0.5, dy = v - 0.5, rr = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx);
        const slot = rr > 0.22 && rr < 0.88 && (Math.sin(a * 14) > 0.25) && Math.abs(rr - 0.55) > 0.04;
        const hole = rr < 0.16 || slot;
        o[0] = o[1] = o[2] = hole ? 10 : 200 + Math.random() * 20;
        o[3] = rr > 0.99 ? 0 : 255;
      });
      const gt = TX.toTexture(gc, { wrap: false });
      K.mesh(new T.CylinderGeometry(DRAIN_R + 0.9, DRAIN_R + 1.1, 0.24, 40), chrome, p.x, 0.0, p.z, { cast: false });
      K.mesh(new T.CircleGeometry(DRAIN_R + 0.6, 40), K.std({ map: gt, metalness: 0.85, roughness: 0.25, transparent: true }), p.x, 0.13, p.z, { rx: -PI / 2, cast: false });
      const mat = new T.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: A.uTime },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `varying vec2 vP; uniform float uTime;
          void main(){
            float r = length(vP) / 11.0; float a = atan(vP.y, vP.x);
            float sp = a * 3.0 + log(r + 0.03) * 6.0 + uTime * 5.0;
            float arms = smoothstep(0.45, 1.0, sin(sp) * 0.5 + 0.5);
            float arms2 = smoothstep(0.7, 1.0, sin(sp * 2.0 + 1.3) * 0.5 + 0.5);
            float fade = 1.0 - smoothstep(0.4, 1.0, r);
            float inner = smoothstep(0.2, 0.36, r);
            gl_FragColor = vec4(vec3(0.97, 0.99, 1.0), (arms * 0.42 + arms2 * 0.25) * fade * inner);
          }`,
      });
      const vm = new T.Mesh(new T.CircleGeometry(11, 48), mat);
      vm.rotation.x = -PI / 2; vm.position.set(p.x, 0.36, p.z); vm.renderOrder = 3;
      K.group.add(vm); keep.push(vm);
      AO(p.x, p.z, DRAIN_R + 1.5, DRAIN_R + 1.5, 0.3);
    }

    // ============================================================================
    // FLOATING TOYS (pushable, bob on the water): duck flotilla, tug boat, foam islands, bath bomb
    // ============================================================================
    const addFloat = (mesh, x, z, rad, m, opts = {}) => {
      K.add(mesh);
      mesh.position.set(x, opts.baseY ?? 0.2, z); mesh.rotation.y = opts.ry ?? r() * 6.28;
      const d = K.physics.addDynamic({ x, z, r: rad, m, h: opts.h ?? 4, mesh, friction: opts.friction ?? 3.2, baseY: opts.baseY ?? 0.2, slide: opts.slide ?? true, spin: opts.spin ?? 0.04 });
      d.respawn = 5;
      A.floats.push({ d, mesh, ph: r() * 6.28, amp: opts.amp ?? 1, ball: !!opts.ball, home: [x, z], tether: opts.tether ?? 0.35 });
      keep.push(mesh);
      return d;
    };
    {
      const duck = (sc) => {
        const g = new T.Group();
        const Y = 0xffd21f, O = 0xff7a12;
        const b = part(g, new T.SphereGeometry(1, 28, 18), Y, mPlast, 0, 0.55, 0); b.scale.set(2.1, 1.35, 1.6);
        part(g, new T.ConeGeometry(0.8, 1.5, 14), Y, mPlast, -2.0, 1.35, 0, { rz: 0.95 });
        part(g, new T.SphereGeometry(1.15, 24, 16), Y, mPlast, 1.1, 2.35, 0);
        const bk = part(g, new T.SphereGeometry(0.6, 16, 10), O, mPlast, 2.15, 2.12, 0); bk.scale.set(1.35, 0.42, 0.95);
        for (const sz of [-0.55, 0.55]) {
          part(g, new T.SphereGeometry(0.2, 10, 8), 0x141414, mGloss, 1.86, 2.62, sz);
          part(g, new T.SphereGeometry(0.07, 6, 4), 0xffffff, mGloss, 1.98, 2.7, sz * 1.08);
        }
        for (const sz of [-1.45, 1.45]) { const w = part(g, new T.SphereGeometry(1, 16, 10), Y, mPlast, -0.3, 0.95, sz, { ry: sz > 0 ? 0.2 : -0.2 }); w.scale.set(1.0, 0.55, 0.3); }
        const mg = mergeGroup(g); mg.scale.setScalar(sc);
        return mg;
      };
      // mother duck leading four ducklings across the flood, plus two strays on the course
      const ducks = [[8, -57, 1.75], [17, -55.5, 1.0], [24, -54.5, 1.0], [31, -53.5, 0.95], [38, -52.5, 0.95]];
      ducks.forEach(([x, z, sc], i) => { warnRoad('duck', x, z, 2.2 * sc); addFloat(duck(sc), x, z, 2.1 * sc, 0.5 + sc * 0.7, { ry: PI + 0.08, h: 4 * sc, tether: 0.5 }); });
      for (const [s, off] of [[352, 4.2], [640, -4]]) { const q = place(s, off); addFloat(duck(1.05), q.x, q.z, 2.2, 1.2, { tether: 0.25 }); }
      // tug boat toy
      {
        const g = new T.Group();
        const hs = new T.Shape(); hs.moveTo(4.6, 0); hs.quadraticCurveTo(3.2, 2.3, -0.5, 2.3); hs.lineTo(-4.2, 2.1); hs.quadraticCurveTo(-4.8, 0, -4.2, -2.1); hs.lineTo(-0.5, -2.3); hs.quadraticCurveTo(3.2, -2.3, 4.6, 0);
        const hg = new T.ExtrudeGeometry(hs, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 2 }); hg.rotateX(-PI / 2);
        part(g, hg, 0xe23b2e, mPlast, 0, -0.3, 0);
        const dg = new T.ExtrudeGeometry(hs, { depth: 0.2, bevelEnabled: false }); dg.rotateX(-PI / 2); dg.scale(0.92, 1, 0.88);
        part(g, dg, 0xf6f2e8, mPlast, 0, 1.65, 0);
        part(g, new K.RoundedBoxGeometry(3.2, 2.2, 2.8, 2, 0.35), 0xffffff, mPlast, -0.6, 2.9, 0);
        part(g, new T.BoxGeometry(3.5, 0.3, 3.1), 0x2f6fe0, mPlast, -0.6, 4.1, 0);
        part(g, new T.CylinderGeometry(0.7, 0.8, 2.4, 14), 0xffc61a, mPlast, -2.6, 4.2, 0);
        part(g, new T.CylinderGeometry(0.72, 0.72, 0.5, 14), 0x1b1b1b, mPlast, -2.6, 5.4, 0);
        for (const sz of [-1, 1]) part(g, new T.TorusGeometry(0.55, 0.18, 8, 16), 0xff7a12, mPlast, 0.8, 1.2, sz * 2.25);
        for (let k = 0; k < 3; k++) part(g, new T.CircleGeometry(0.35, 12), 0x1d3a6a, mGloss, -1.4 + k * 0.85, 3.2, 1.42);
        addFloat(mergeGroup(g), -32, -48, 4.2, 1.6, { ry: 0.6, h: 5 });
        warnRoad('boat', -32, -48, 4.2);
      }
      // bubble-bath foam islands (light, they drift back)
      const foamMat = K.phys({ color: 0xffffff, roughness: 0.38, sheen: 1, sheenColor: new T.Color(0xdff2ff), clearcoat: 0.25, clearcoatRoughness: 0.4 });
      const foamIsland = (R) => {
        const g = new T.Group();
        for (let i = 0; i < 9; i++) {
          const a = r() * PI * 2, d = Math.sqrt(r()) * R * 0.75, rr = R * r.range(0.32, 0.55) * (1 - d / R * 0.4);
          const m = new T.Mesh(new T.SphereGeometry(1, 16, 10), foamMat);
          m.position.set(Math.cos(a) * d, rr * 0.35, Math.sin(a) * d); m.scale.set(rr, rr * 0.75, rr);
          g.add(m);
        }
        return mergeGroup(g);
      };
      for (const [s, off, R] of [[415, -5.5, 3.6], [690, 4.5, 3.2], [318, 2, 3.0]]) { const q = place(s, off); addFloat(foamIsland(R), q.x, q.z, R * 0.9, 0.35, { baseY: 0.05, friction: 2.2, h: 2.2, amp: 0.5, tether: 0.4 }); }
      for (const [x, z, R] of [[52, -62, 4.2], [-38, -48, 3.4], [-14, -60, 3.4], [76, -88, 3.0], [-55, -88, 3.6]]) { warnRoad('foam', x, z, R); addFloat(foamIsland(R), x, z, R * 0.9, 0.35, { baseY: 0.05, friction: 2.2, h: 2.2, amp: 0.5, tether: 0.4 }); }
      // fizzing bath bomb (rolls)
      {
        const bc = TX.paint(256, 128, (px, py, u, v, o) => { const n = Math.random(); const sp = n > 0.985; o[0] = sp ? 255 : 205 + n * 20; o[1] = sp ? 225 : 150 + n * 18; o[2] = sp ? 90 : 222 + n * 15; });
        const bomb = new T.Mesh(new T.SphereGeometry(3.0, 28, 18), K.std({ map: TX.toTexture(bc), roughness: 0.92 }));
        const x = -14, z = -44;
        warnRoad('bath bomb', x, z, 3);
        const d = addFloat(bomb, x, z, 3.0, 0.8, { baseY: 2.5, slide: false, friction: 3.5, ball: true, amp: 0.25, h: 5.5, tether: 0.8 });
        // a cloud of dye spreading in the water round it
        const dyc = TX.paint(128, 128, (px, py, u, v, o) => { const rr = Math.hypot(u - 0.5, v - 0.5) * 2; const a = Math.atan2(v - 0.5, u - 0.5); const w = 0.75 + 0.25 * Math.sin(a * 5 + rr * 9); o[0] = 196; o[1] = 92; o[2] = 214; o[3] = Math.max(0, (1 - rr / w)) * 150; });
        const dye = new T.Mesh(new T.CircleGeometry(9, 32), K.std({ map: TX.toTexture(dyc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.1 }));
        dye.rotation.x = -PI / 2; dye.position.set(x, 0.3, z); dye.renderOrder = 2;
        K.group.add(dye); keep.push(dye);
        A.bomb = { d, dye };
      }
    }

    // ---------------- clockwork frog swimming across the flood (moving hazard) ----------------
    {
      const p0 = track.at(FROG.s);
      const ax = p0.x - p0.nx * FROG.lat, az = p0.z - p0.nz * FROG.lat, bx = p0.x + p0.nx * FROG.lat, bz = p0.z + p0.nz * FROG.lat;
      const pose = frogPose(ax, az, bx, bz);
      K.mover({ type: 'circle', r: 3.0, h: 5 }, (t) => { const q = pose(t); return { x: q.x, z: q.z, angle: q.angle }; });
      const G = 0x3fae3a, LG = 0xb9e27a;
      const root = new T.Group();
      const body = new T.Group(); root.add(body);
      const bodyParts = new T.Group();
      const b = part(bodyParts, new T.SphereGeometry(1, 28, 18), G, mPlast, 0, 1.6, 0); b.scale.set(3.0, 1.55, 2.3);
      const bl = part(bodyParts, new T.SphereGeometry(1, 20, 12), LG, mPlast, 0.4, 1.15, 0); bl.scale.set(2.6, 1.0, 1.9);
      const hd = part(bodyParts, new T.SphereGeometry(1, 24, 16), G, mPlast, 2.4, 2.2, 0); hd.scale.set(1.5, 1.05, 1.8);
      for (const sz of [-1, 1]) {
        part(bodyParts, new T.SphereGeometry(0.75, 16, 12), G, mPlast, 2.5, 3.15, sz * 0.95);
        part(bodyParts, new T.SphereGeometry(0.55, 14, 10), 0xffffff, mGloss, 2.85, 3.3, sz * 0.98);
        part(bodyParts, new T.SphereGeometry(0.28, 10, 8), 0x111111, mGloss, 3.3, 3.35, sz * 1.0);
      }
      part(bodyParts, new T.TorusGeometry(0.9, 0.12, 6, 16, PI * 0.8), 0xd8322a, mGloss, 3.65, 2.0, 0, { rx: PI / 2, rz: -PI * 0.4 });
      body.add(mergeGroup(bodyParts));
      // wind-up key
      const key = new T.Group(); key.position.set(-1.0, 3.2, 0); body.add(key);
      const brass = K.metal(0xd2a84c, 0.28);
      const sh = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 1.1, 8), brass); sh.position.y = 0.4; key.add(sh);
      const bow = new T.Group(); bow.position.y = 1.1; key.add(bow);
      for (const sd of [-1, 1]) { const lp = new T.Mesh(new T.TorusGeometry(0.55, 0.16, 8, 18), brass); lp.position.z = sd * 0.65; bow.add(lp); }
      // legs (back legs kick, front paddle)
      const legs = [];
      for (const sz of [-1, 1]) {
        const back = new T.Group(); back.position.set(-2.2, 1.2, sz * 1.7); root.add(back);
        const th = new T.Mesh(vcol(new T.SphereGeometry(1, 14, 10), G), mPlast); th.scale.set(1.5, 0.6, 0.7); th.position.set(-1.0, 0, sz * 0.4); back.add(th);
        const ft = new T.Mesh(vcol(new T.SphereGeometry(1, 12, 8), LG), mPlast); ft.scale.set(1.2, 0.2, 0.9); ft.position.set(-2.4, -0.1, sz * 0.9); back.add(ft);
        const front = new T.Group(); front.position.set(1.6, 1.0, sz * 1.6); root.add(front);
        const fl = new T.Mesh(vcol(new T.SphereGeometry(1, 12, 8), LG), mPlast); fl.scale.set(0.7, 0.25, 0.9); fl.position.set(0.3, 0, sz * 0.5); front.add(fl);
        legs.push({ back, front, sz });
      }
      root.scale.setScalar(0.95);
      K.add(root); keep.push(root);
      A.frog = { pose, root, body, legs, bow, lastKick: 0 };
    }

    // ============================================================================
    // SPILLS: tipped-over bubble-bath bottle (slick on the hairpin exit), soap bars + soapy smear
    // ============================================================================
    const spillMat = K.phys({ color: 0xf2a6dc, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.82, sheen: 0.6, sheenColor: new T.Color(0xffffff), envMapIntensity: 1.4 });
    const bubMat = K.phys({ color: 0xffffff, roughness: 0.0, transparent: true, opacity: 0.35, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 640], depthWrite: false, clearcoat: 1, envMapIntensity: 1.8 });
    const bubbleGeo = new T.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2);
    const bubbles = [];
    {
      // the slick reaches into the outside of the hairpin exit
      const sp = place(772, -2.6);
      const spill = K.spill(sp.x, sp.z, 7.5, spillMat, { lump: 0.35, stretch: 1.6, angle: sp.angle + 0.5, y: 0.1, thick: 0.18 });
      K.surface('slick', { poly: spill.poly });
      A.slicks = [{ x: sp.x, z: sp.z, r: 9 }];
      for (let i = 0; i < 26; i++) { const a = r() * PI * 2, d = Math.sqrt(r()) * 7; bubbles.push({ x: sp.x + Math.cos(a) * d * 1.3, y: 0.12, z: sp.z + Math.sin(a) * d * 0.8, s: r() < 0.2 ? r.range(0.6, 1.0) : r.range(0.18, 0.45) }); }
      // the bottle lying on its side, neck towards the spill
      const bp = { x: sp.x + 21, z: sp.z + 12 };
      const dx = sp.x - bp.x, dz = sp.z - bp.z, ba = Math.atan2(dz, dx);
      const g = new T.Group();
      const prof = [[0, 0], [3.6, 0], [4.0, 0.5], [4.1, 13], [3.6, 16], [2.0, 18.4], [1.5, 19], [1.5, 20.6], [0, 20.6]];
      const lc = TX.makeCanvas(512, 256), lg = lc.getContext('2d');
      const grd = lg.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#ff9ad5'); grd.addColorStop(1, '#c86ce0');
      lg.fillStyle = grd; lg.fillRect(0, 0, 512, 256);
      lg.fillStyle = '#fff'; lg.font = '64px "Lilita One", Impact, sans-serif'; lg.textAlign = 'center';
      lg.lineWidth = 8; lg.strokeStyle = '#7a2d8c'; lg.strokeText('Bubbly', 256, 120); lg.fillText('Bubbly', 256, 120);
      lg.font = '600 28px Rubik, sans-serif'; lg.fillText('BUBBLE BATH  ·  berry splash', 256, 172);
      for (let i = 0; i < 14; i++) { lg.strokeStyle = 'rgba(255,255,255,0.75)'; lg.lineWidth = 3; lg.beginPath(); lg.arc(30 + i * 36, 30 + (i % 3) * 10, 7 + (i % 2) * 6, 0, 7); lg.stroke(); }
      const body = new T.Mesh(K.lathe(prof, 36), K.phys({ color: 0xd86fd0, roughness: 0.22, clearcoat: 0.8, transparent: true, opacity: 0.86 }));
      g.add(body);
      const lab = new T.Mesh(new T.CylinderGeometry(4.15, 4.15, 8.5, 36, 1, true), K.std({ map: TX.toTexture(lc, { wrap: true }), roughness: 0.5 }));
      lab.position.y = 7; g.add(lab);
      const holder = new T.Group(); holder.add(g);
      g.rotation.z = -PI / 2; g.position.y = 4.1;
      holder.position.set(bp.x, 0, bp.z); holder.rotation.y = -ba;
      K.add(holder);
      AO(bp.x + Math.cos(ba) * 10, bp.z + Math.sin(ba) * 10, 12, 5, 0.45, ba);
      K.capsule(bp.x + Math.cos(ba) * 1.5, bp.z + Math.sin(ba) * 1.5, bp.x + Math.cos(ba) * 18, bp.z + Math.sin(ba) * 18, 3.6, 8);
      warnRoad('bottle', bp.x + Math.cos(ba) * 10, bp.z + Math.sin(ba) * 10, 5);
      // its cap rolled away
      const cap = K.mesh(vcol(new T.CylinderGeometry(1.8, 1.8, 2.4, 20), 0x7a2dd0), mPlast, bp.x - 8, 1.8, bp.z + 10, { rz: PI / 2, ry: 0.7 });
      AO(bp.x - 8, bp.z + 10, 2.5, 2, 0.35);
      // a dribble trail from the neck to the puddle
      for (let i = 1; i < 4; i++) K.spill(bp.x + dx * (0.35 + i * 0.12) + r.range(-0.6, 0.6), bp.z + dz * (0.35 + i * 0.12) + r.range(-0.6, 0.6), r.range(0.9, 1.6), spillMat, { y: 0.08, thick: 0.12, n: 18 });
      void cap;
    }
    // soap dish, soap bars (they skid away when hit) and the soapy smear they left
    {
      const smearS = 852;
      const sp = place(smearS, 3.5);
      const smearMat = K.phys({ color: 0xf6fbff, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.55, sheen: 0.8, sheenColor: new T.Color(0xffffff) });
      const sm = K.spill(sp.x, sp.z, 6.2, smearMat, { lump: 0.45, stretch: 1.7, angle: sp.angle, y: 0.08, thick: 0.1 });
      K.surface('slick', { poly: sm.poly });
      A.slicks.push({ x: sp.x, z: sp.z, r: 8 });
      for (let i = 0; i < 18; i++) { const a = r() * PI * 2, d = Math.sqrt(r()) * 5.5; bubbles.push({ x: sp.x + Math.cos(a) * d * 1.4, y: 0.1, z: sp.z + Math.sin(a) * d * 0.8, s: r.range(0.15, 0.5) }); }
      const soapG = new K.RoundedBoxGeometry(8.0, 2.6, 5.2, 4, 1.2);
      const soap = (hex, x, z, ry) => {
        const m = new T.Mesh(soapG, K.phys({ color: hex, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.5, sheenColor: new T.Color(0xffffff) }));
        m.position.set(x, 1.3, z); m.rotation.y = ry;
        K.add(m); keep.push(m);
        const d = K.physics.addDynamic({ x, z, r: 3.2, m: 0.9, h: 2.6, mesh: m, slide: true, friction: 1.6, baseY: 1.3, spin: 0.12 });
        d.respawn = 6;
        return d;
      };
      const s1 = place(smearS - 3, -2.5); soap(0xa7e3c9, s1.x, s1.z, 0.4);
      const dp = place(smearS + 6, 15.5);
      warnRoad('soap dish', dp.x, dp.z, 6);
      // ceramic shell-shaped soap dish with the second bar in it
      const dish = new T.Group();
      const dprof = [[0, 0.2], [4.5, 0.2], [5.5, 0], [6.2, 0.3], [7.4, 1.6], [7.6, 1.9], [7.2, 1.9], [6.0, 0.9], [0, 0.8]];
      const dg = K.lathe(dprof, 40); dg.scale(1, 1, 0.72);
      part(dish, dg, 0xf3efe6, mGloss, 0, 0, 0);
      for (let k = 0; k < 7; k++) { const a = (k / 6 - 0.5) * 2.6; part(dish, new T.CylinderGeometry(0.25, 0.25, 6.2, 6), 0xe6dccb, mGloss, Math.sin(a) * 2.6, 0.9, Math.cos(a) * 1.4, { rz: PI / 2, ry: a + PI / 2 }); }
      dish.position.set(dp.x, 0, dp.z); dish.rotation.y = 0.3; K.add(dish);
      K.mesh(soapG, K.phys({ color: 0xffc3d6, roughness: 0.28, clearcoat: 0.6, sheen: 0.5, sheenColor: new T.Color(0xffffff) }), dp.x, 2.2, dp.z, { ry: 0.3, scale: 0.85 });
      AO(dp.x, dp.z, 8.5, 6.5, 0.4, 0.3);
      K.circle(dp.x, dp.z, 6.6, 3);
    }
    K.instances(bubbleGeo, bubMat, bubbles, { cast: false }).renderOrder = 3;

    // ============================================================================
    // PROPS
    // ============================================================================
    // ---- toilet roll standing in the south infield, its paper trailing across the tiles ----
    {
      const x = 4, z = 52;
      warnRoad('toilet roll', x, z, 6);
      const g = new T.Group();
      const paperC = TX.paint(128, 128, (px, py, u, v, o) => { const q = ((px % 16) < 1 || (py % 16) < 1) ? 0.93 : 1; const d = (Math.sin(px * 0.8) * Math.sin(py * 0.8)) * 0.02; o[0] = o[1] = 250 * (q + d); o[2] = 246 * (q + d); });
      const paperT = TX.toTexture(paperC);
      const paper = K.std({ map: paperT, roughness: 0.95 });
      const roll = new T.Mesh(K.lathe([[2.2, 0], [5.4, 0], [5.6, 0.3], [5.6, 9.7], [5.4, 10], [2.2, 10], [2.2, 0]], 48), paper);
      g.add(roll);
      part(g, new T.CylinderGeometry(2.25, 2.25, 9.9, 28, 1, true), 0xb48a58, mMatte, 0, 5, 0);
      g.position.set(x, 0, z); K.add(g);
      AO(x, z, 6.6, 6.6, 0.45);
      K.circle(x, z, 5.6, 10);
      // trailing sheet, gently wavy, lying on the floor
      const pts = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([x - 5.4 - t * 30, z + 2 + Math.sin(t * 5) * 3.5 + t * 4]); }
      const pos = [], uv = [], idx = [];
      for (let i = 0; i < pts.length; i++) {
        const [px, pz] = pts[i], [qx, qz] = pts[Math.min(pts.length - 1, i + 1)], [ox, oz] = pts[Math.max(0, i - 1)];
        let tx = qx - ox, tz = qz - oz; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
        const yy = 0.08 + (i < 3 ? (3 - i) * 0.9 : 0) + 0.05 * Math.sin(i * 1.7);
        pos.push(px - tz * 5, yy, pz + tx * 5, px + tz * 5, yy, pz - tx * 5);
        uv.push(0, i * 0.8 / 10, 1, i * 0.8 / 10);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
      const pm = new T.Mesh(tg, K.std({ map: paperT, roughness: 0.95, side: T.DoubleSide })); pm.receiveShadow = true; pm.castShadow = false;
      K.group.add(pm);
      warnRoad('paper', x - 30, z + 6, 5.5);
    }
    // ---- toothbrush, toothpaste tube and a squeezed blob ----
    {
      const x = 44, z = 50;
      const g = new T.Group();
      const hs = new T.Shape(); hs.moveTo(0, -0.55); hs.bezierCurveTo(5, -0.75, 10, -0.6, 13.5, -0.4); hs.lineTo(13.5, 0.4); hs.bezierCurveTo(10, 0.6, 5, 0.75, 0, 0.55); hs.quadraticCurveTo(-0.9, 0, 0, -0.55);
      const hg = new T.ExtrudeGeometry(hs, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 3 }); hg.rotateX(-PI / 2);
      part(g, hg, 0x23b5c8, mPlast, 0, 0.35, 0);
      part(g, new T.BoxGeometry(5, 0.2, 0.8), 0x8ae0ea, mPlast, 4, 1.0, 0);
      part(g, new K.RoundedBoxGeometry(3.4, 0.6, 1.3, 2, 0.25), 0x23b5c8, mPlast, 15.4, 0.6, 0);
      const br = [];
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) br.push([14.1 + i * 0.5, (j - 1) * 0.38, (i + j) % 3 === 0 ? 0x23b5c8 : 0xffffff]);
      for (const [bx, bz, c] of br) part(g, new T.CylinderGeometry(0.17, 0.17, 1.5, 6), c, mPlast, bx, 1.6, bz);
      g.position.set(x - 8, 0, z - 4); g.rotation.y = 0.35; K.add(g);
      AO(x - 1, z - 6, 9, 2.4, 0.35, -0.35);
      // toothpaste tube (squeezed, crimped end)
      const t = new T.Group();
      const tc = TX.makeCanvas(512, 256), tgc = tc.getContext('2d');
      tgc.fillStyle = '#f8f8f6'; tgc.fillRect(0, 0, 512, 256);
      tgc.fillStyle = '#2f6fe0'; tgc.fillRect(0, 0, 512, 70); tgc.fillRect(0, 196, 512, 60);
      tgc.fillStyle = '#e5352b'; tgc.font = '78px "Lilita One", Impact, sans-serif'; tgc.textAlign = 'center'; tgc.fillText('SPARKLE', 256, 150);
      tgc.fillStyle = '#2f6fe0'; tgc.font = '600 26px Rubik, sans-serif'; tgc.fillText('mint fresh toothpaste', 256, 186);
      const tubeG = new T.CylinderGeometry(1.9, 1.9, 13, 32, 8, true);
      const tp = tubeG.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const yv = tp.getY(i), f = (yv + 6.5) / 13; // 0 cap end .. 1 crimp end
        const flat = 0.25 + 0.75 * (1 - Math.pow(f, 1.8));
        tp.setX(i, tp.getX(i) * (1 + (1 - flat) * 0.7)); tp.setZ(i, tp.getZ(i) * flat);
      }
      tubeG.computeVertexNormals();
      const tube = new T.Mesh(tubeG, K.phys({ map: TX.toTexture(tc, { wrap: true }), roughness: 0.3, clearcoat: 0.6, side: T.DoubleSide }));
      tube.rotation.z = PI / 2; t.add(tube);
      const crimp = new T.Mesh(vcol(new T.BoxGeometry(0.8, 0.5, 5.4), 0xe8e8e4), mGloss); crimp.position.x = -6.9; t.add(crimp);
      const capm = new T.Mesh(vcol(new T.CylinderGeometry(1.1, 1.2, 1.8, 18), 0xffffff), mGloss); capm.rotation.z = PI / 2; capm.position.x = 7.4; t.add(capm);
      t.position.set(x + 6, 1.8, z + 5); t.rotation.y = -0.5;
      K.add(t);
      AO(x + 6, z + 5, 8.5, 3, 0.4, 0.5);
      K.capsule(x - 8, z - 4, x + 8, z - 9, 1.2, 1.6);
      K.capsule(x + 6 - 6.5, z + 5 - 3.2, x + 6 + 6.5, z + 5 + 3.2, 2.2, 4);
      // squeezed blob: striped swirl
      const blob = new T.Group();
      for (let i = 0; i < 9; i++) {
        const a = i * 0.9, rr = 1.3 - i * 0.09;
        part(blob, new T.SphereGeometry(rr, 14, 10), i % 2 ? 0x3fb6e8 : 0xffffff, mGloss, Math.cos(a) * 0.8 * (1 - i / 10), 0.45 + i * 0.18, Math.sin(a) * 0.8 * (1 - i / 10), { s: [1.3, 0.7, 1.0] });
      }
      blob.position.set(x + 16, 0, z + 1); K.add(blob);
      warnRoad('toothpaste', x + 6, z + 5, 7);
    }
    // ---- bath sponge (east infield) ----
    {
      const x = 102, z = -8;
      const nz = TX.noiseField(64, { seed: 481, period: 4, oct: 3 });
      const pz2 = TX.noiseField(256, { seed: 482, period: 40, oct: 2, gain: 0.35 });
      const poreC = TX.paint(256, 256, (px, py, u, v, o) => {
        const n = TX.sampleField(nz, 64, px * 0.5, py * 0.5);
        const n2 = TX.sampleField(pz2, 256, px, py);
        const hole = n2 < 0.36 + n * 0.08;
        const k = hole ? 0.62 : 0.94 + n * 0.08;
        o[0] = 247 * k; o[1] = 168 * k; o[2] = 150 * k;
      });
      const g = new K.RoundedBoxGeometry(13, 5, 8.5, 5, 2.1);
      const pp = g.attributes.position;
      for (let i = 0; i < pp.count; i++) { const vx = pp.getX(i), vy = pp.getY(i), vz = pp.getZ(i); const w = 1 - 0.08 * Math.cos(vx * 0.45) - 0.05 * Math.sin(vz * 0.7 + vx * 0.3); pp.setXYZ(i, vx, vy * w, vz * (1 - 0.06 * Math.cos(vx * 0.4))); }
      g.computeVertexNormals();
      K.mesh(g, K.std({ map: TX.toTexture(poreC), roughness: 0.95, bumpMap: TX.toTexture(poreC, { srgb: false }), bumpScale: 3 }), x, 2.4, z, { ry: 0.5 });
      AO(x, z, 8, 6, 0.45, 0.5);
      K.circle(x, z, 5.6, 5);
      warnRoad('sponge', x, z, 6.5);
    }
    // ---- loofah pouf with its cord (east infield north) ----
    {
      const x = 100, z = -36;
      const nc = TX.paint(256, 256, (px, py, u, v, o) => {
        const a = Math.abs(Math.sin(u * 64 + Math.sin(v * 9) * 2)), b = Math.abs(Math.sin(v * 64 + Math.sin(u * 7) * 2));
        const net = Math.max(1 - ss(0.0, 0.3, a), 1 - ss(0.0, 0.3, b));
        o[0] = 112; o[1] = 210; o[2] = 160; o[3] = net * 255;
      });
      const nt = TX.toTexture(nc);
      const netMat = K.std({ map: nt, alphaTest: 0.4, side: T.DoubleSide, roughness: 0.6 });
      const g = new T.Group();
      for (let i = 0; i < 4; i++) {
        const sg = new T.SphereGeometry(5.2 - i * 0.9, 24, 16);
        const p2 = sg.attributes.position;
        for (let k = 0; k < p2.count; k++) { const vx = p2.getX(k), vy = p2.getY(k), vz = p2.getZ(k); const w = 1 + 0.12 * Math.sin(vx * 1.7 + i) * Math.sin(vz * 1.9 + vy); p2.setXYZ(k, vx * w, vy * w * 0.85, vz * w); }
        sg.computeVertexNormals();
        const m = new T.Mesh(sg, netMat); m.rotation.set(i * 0.7, i * 1.3, i * 0.4); g.add(m);
      }
      g.position.set(x, 4.3, z); K.add(g);
      const cord = new T.Mesh(new T.TorusGeometry(2.6, 0.25, 8, 24), K.std({ color: 0x5fbf8e, roughness: 0.7 }));
      cord.position.set(x + 5.5, 0.25, z + 1.5); cord.rotation.x = PI / 2; cord.scale.set(1.4, 1, 1); K.add(cord);
      AO(x, z, 6.5, 6.5, 0.5);
      K.circle(x, z, 5.2, 8.5);
      warnRoad('loofah', x, z, 6);
    }
    // ---- stacking cups (toy) tipped in the south-east corner ----
    {
      const cols = [0xe5352b, 0xff8a1f, 0xffc61a, 0x24a84a, 0x2f6fe0];
      const spots = [[142, 80, 1], [131, 86, 1], [147, 68, 0], [136, 74, 0], [126, 82, 0]];
      cols.forEach((c, i) => {
        const R = 5.2 - i * 0.65;
        const g = K.lathe([[R * 0.82, 0], [R, R * 1.25], [R - 0.3, R * 1.25], [R * 0.82 - 0.3, 0.3], [0, 0.3]], 32);
        const [x, z, lying] = spots[i];
        K.mesh(vcol(g, c), mGloss, x, lying ? R * 0.9 : 0, z, lying ? { rz: PI / 2, ry: 0.4 + i * 0.9 } : {});
        AO(x, z, R + 1, R + 1, 0.35);
        K.circle(x, z, R, R * 1.25);
        warnRoad('cup', x, z, R);
      });
    }
    // ---- kids' slippers in the south-west bay ----
    {
      const slipper = (x, z, ry, flip) => {
        const g = new T.Group();
        const sole = new T.Shape();
        sole.moveTo(0, -2.6); sole.bezierCurveTo(5, -3.4, 10, -3.4, 12.5, -1.8); sole.quadraticCurveTo(14, 0, 12.5, 1.8); sole.bezierCurveTo(10, 3.4, 5, 3.4, 0, 2.6); sole.quadraticCurveTo(-1.5, 0, 0, -2.6);
        const sg = new T.ExtrudeGeometry(sole, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2 }); sg.rotateX(-PI / 2);
        part(g, sg, 0x6a5acd, mMatte, 0, 0, 0);
        const ins = new T.Shape(); ins.moveTo(0.6, -2.0); ins.bezierCurveTo(3, -2.6, 6, -2.6, 7, -1.6); ins.lineTo(7, 1.6); ins.bezierCurveTo(6, 2.6, 3, 2.6, 0.6, 2.0); ins.quadraticCurveTo(-0.4, 0, 0.6, -2.0);
        const ig = new T.ShapeGeometry(ins); ig.rotateX(-PI / 2);
        part(g, ig, 0xd9cdf7, mMatte, 0, 1.36, 0);
        const up = part(g, new T.SphereGeometry(1, 24, 14, 0, PI * 2, 0, PI / 2), 0xb3a6f6, mMatte, 9.0, 1.1, 0); up.scale.set(4.4, 3.2, 3.15);
        const col = part(g, new T.TorusGeometry(1, 0.55, 10, 28, PI), 0xffffff, mMatte, 5.0, 1.3, 0, { rx: -PI / 2, rz: PI / 2 }); col.scale.set(1.0, 3.1, 1.6);
        part(g, new T.IcosahedronGeometry(1.4, 2), 0xffffff, mMatte, 11.6, 3.7, 0);
        g.position.set(x, 0, z); g.rotation.y = ry + (flip ? 0.35 : 0);
        K.add(g);
        AO(x + Math.cos(-ry) * 6.5, z + Math.sin(-ry) * 6.5, 8.5, 4, 0.4, -ry);
        K.capsule(x, z, x + Math.cos(-ry) * 12, z + Math.sin(-ry) * 12, 3.2, 4.5);
      };
      slipper(-114, 44, 0.5, false);
      slipper(-108, 52, 0.25, true);
      warnRoad('slippers', -108, 47, 8);
    }
    // ---- shampoo bottle standing in the water at the bath panel ----
    {
      const x = 96, z = -88.5;
      const prof = [[0, 0], [3.0, 0], [3.4, 0.6], [3.4, 15], [2.6, 17.5], [1.4, 18.6], [1.4, 19.6], [0, 19.6]];
      const lc = TX.makeCanvas(512, 256), lg = lc.getContext('2d');
      lg.fillStyle = '#2c8f7e'; lg.fillRect(0, 0, 512, 256);
      lg.fillStyle = '#ffffff'; lg.font = '54px "Lilita One", Impact, sans-serif'; lg.textAlign = 'center'; lg.fillText('Kids', 256, 100);
      lg.font = '600 30px Rubik, sans-serif'; lg.fillText('no-tears shampoo', 256, 150); lg.fillText('apple + pear', 256, 190);
      const bottle = new T.Group();
      bottle.add(new T.Mesh(K.lathe(prof, 32), K.phys({ color: 0x8be0c8, roughness: 0.2, clearcoat: 0.8 })));
      const lab = new T.Mesh(new T.CylinderGeometry(3.45, 3.45, 8, 32, 1, true), K.std({ map: TX.toTexture(lc, { wrap: true }), roughness: 0.5 })); lab.position.y = 7.5; bottle.add(lab);
      const cap = new T.Mesh(new T.CylinderGeometry(1.8, 1.8, 2.6, 20), K.plastic(0xf6f6f2, 0.3)); cap.position.y = 20.6; bottle.add(cap);
      bottle.position.set(x, 0, z); bottle.rotation.y = -0.4;
      K.add(bottle);
      AO(x, z, 4.6, 4.6, 0.5);
      K.circle(x, z, 3.4, 22);
    }
    // ---- laundry basket in the corner beside the bath (wicker) ----
    {
      const x = -120, z = -128;
      const wc = TX.paint(256, 256, (px, py, u, v, o) => { const w = Math.sin(u * 80 + (Math.floor(v * 24) % 2) * PI) * 0.5 + 0.5; const k = 0.7 + 0.3 * w; o[0] = 205 * k; o[1] = 168 * k; o[2] = 118 * k; });
      const wt = TX.toTexture(wc); wt.repeat.set(3, 1);
      K.mesh(K.lathe([[19, 0], [21, 2], [23, 46], [23.6, 48], [22, 48], [21.5, 3], [0, 3]], 48), K.std({ map: wt, roughness: 0.85 }), x, 0, z);
      K.mesh(new K.RoundedBoxGeometry(30, 3, 20, 3, 1.2), K.std({ map: TX.toTexture(TX.paint(64, 64, (a, b, u, v, o) => { const k = 0.9 + Math.random() * 0.1; o[0] = 120 * k; o[1] = 170 * k; o[2] = 214 * k; })), roughness: 0.95 }), x + 3, 47.5, z + 4, { rz: 0.2, rx: 0.15 });
      AO(x, z, 25, 25, 0.5);
    }
    // ---- bath crayons lying where the kids swapped colours, and a few at the start line ----
    {
      const cg = (len) => {
        const g = K.lathe([[0, 0], [0.95, 0], [1.0, 0.2], [1.0, len - 1.6], [0.6, len - 0.4], [0.25, len], [0, len]], 16);
        g.rotateZ(-PI / 2);
        return g;
      };
      const put = (x, z, c, ry, len = 6.5) => { K.mesh(vcol(cg(len), c), mWax, x, 1.0, z, { ry }); AO(x + Math.cos(-ry) * len / 2, z + Math.sin(-ry) * len / 2, len / 2 + 0.8, 1.6, 0.35, -ry); };
      let n = 0;
      for (const ch of crayonChanges) {
        if (n > 9) break;
        const q = place(ch.s + 2, ch.side * (WIDTH / 2 + 3.2));
        if (!K.offRoad(q.x, q.z, 1.5) || inMat(q.x, q.z, 3) || maskAt(q.x, q.z) > 0.1) continue;
        put(q.x, q.z, ch.c, -q.angle + r.range(-0.8, 0.8), r.range(5, 7)); n++;
      }
      const sp = place(46, -12.5);
      put(sp.x, sp.z, 0x1d1d22, 1.2, 6.8); put(sp.x + 2.4, sp.z - 1.2, 0xff8a1f, 0.7, 5.6); put(sp.x - 1.5, sp.z - 3.5, 0x2f6fe0, 2.0, 4.8);
    }

    // ============================================================================
    // FINE SCATTER: water droplets, foam flecks, cotton buds, hair grips, bubbles
    // ============================================================================
    {
      const drops = [];
      for (let i = 0; i < 260; i++) {
        let x, z, ok = false;
        for (let k = 0; k < 8 && !ok; k++) {
          const p = floodPoly[Math.floor(r() * floodPoly.length)];
          x = p[0] + r.gauss() * 8; z = p[1] + r.gauss() * 8;
          ok = maskAt(x, z) < 0.1 && !inMat(x, z, 0.5) && z > TUB.zf + 0.8;
        }
        if (!ok) continue;
        const s = r() < 0.15 ? r.range(0.45, 0.8) : r.range(0.12, 0.38);
        drops.push({ x, y: 0.02, z, sx: s * r.range(1, 1.6), sy: s * 0.55, sz: s, ry: r() * 6 });
      }
      for (let i = 0; i < 170; i++) {
        const x = r.range(-150, 150), z = r.range(-90, 92);
        if (maskAt(x, z) > 0.05 || inMat(x, z, 1)) continue;
        const s = r() < 0.1 ? r.range(0.4, 0.7) : r.range(0.1, 0.32);
        drops.push({ x, y: 0.02, z, sx: s * r.range(1, 1.5), sy: s * 0.5, sz: s, ry: r() * 6 });
      }
      K.instances(new T.SphereGeometry(1, 10, 6, 0, PI * 2, 0, PI / 2), K.phys({ color: 0xffffff, roughness: 0.0, transmission: 0, transparent: true, opacity: 0.45, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false }), drops, { cast: false }).renderOrder = 2;
      const flecks = [];
      for (let i = 0; i < 160; i++) {
        const x = r.range(-70, 108), z = r.range(-94, -4);
        if (maskAt(x, z) < 0.5) continue;
        flecks.push({ x, y: 0.33, z, sx: r.range(0.2, 0.7), sy: 0.08, sz: r.range(0.2, 0.6), ry: r() * 6 });
      }
      K.instances(new T.SphereGeometry(1, 8, 5), K.std({ color: 0xffffff, roughness: 0.5, transparent: true, opacity: 0.85 }), flecks, { cast: false }).renderOrder = 3;
      // floating soap bubbles on the flood
      const fb = [];
      for (let i = 0; i < 70; i++) {
        const x = CASC.x + r.gauss() * 26, z = TUB.zf + 6 + Math.abs(r.gauss()) * 22;
        if (maskAt(x, z) < 0.5) continue;
        fb.push({ x, y: 0.33, z, s: r() < 0.2 ? r.range(0.6, 1.1) : r.range(0.2, 0.5) });
      }
      K.instances(bubbleGeo, bubMat, fb, { cast: false }).renderOrder = 4;
      // wet footprints: somebody climbed out over the mat and padded off across the floor
      {
        const fc = TX.makeCanvas(128, 256), fg = fc.getContext('2d');
        fg.fillStyle = '#fff';
        fg.beginPath(); fg.ellipse(66, 150, 38, 78, 0.05, 0, Math.PI * 2); fg.fill();
        fg.globalCompositeOperation = 'destination-out'; fg.beginPath(); fg.ellipse(30, 170, 20, 46, 0.1, 0, Math.PI * 2); fg.fill(); fg.globalCompositeOperation = 'source-over';
        [[88, 52, 15], [64, 42, 11], [44, 46, 10], [28, 56, 9], [16, 72, 8]].forEach(([x, y, rr]) => { fg.beginPath(); fg.arc(x, y, rr, 0, Math.PI * 2); fg.fill(); });
        const fm = K.phys({ color: 0x8aa6b4, map: TX.toTexture(fc, { wrap: false }), transparent: true, opacity: 0.32, roughness: 0.04, clearcoat: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        const geos = [];
        const path = [[-96, 6], [-82, 22], [-70, 36], [-56, 46], [-40, 54], [-24, 58]];
        for (let i = 0; i < path.length; i++) {
          const [x, z] = path[i], nx = path[Math.min(i + 1, path.length - 1)], pv = path[Math.max(i - 1, 0)];
          const a = Math.atan2(nx[1] - pv[1], nx[0] - pv[0]);
          const left = i % 2 === 0, off = left ? -3.2 : 3.2;
          const px = x - Math.sin(a) * off, pz = z + Math.cos(a) * off;
          const g = new T.PlaneGeometry(6.5, 13); g.rotateX(-PI / 2);
          if (left) { const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, 1 - uv.getX(k)); }
          g.rotateY(-a - PI / 2); g.translate(px, 0.06 + i * 0.001, pz);
          geos.push(g);
        }
        const fp = new T.Mesh(K.BufferGeometryUtils.mergeGeometries(geos, false), fm); fp.renderOrder = 1;
        K.group.add(fp); keep.push(fp);
      }
      // hair elastics
      const el = [];
      for (const [x, z, c] of [[-58, 12, 0xf0559d], [86, 74, 0x2f6fe0], [-142, 10, 0xffb000], [62, -2, 0x8a4fd0], [-122, 84, 0x24a84a], [146, -30, 0xe5352b]]) {
        if (!K.offRoad(x, z, 2)) continue;
        el.push({ x, y: 0.28, z, rx: PI / 2 + r.range(-0.1, 0.1), s: r.range(0.9, 1.2), color: c });
      }
      K.instances(new T.TorusGeometry(1.25, 0.28, 8, 20), K.plastic(0xffffff, 0.5), el, { colors: true });
      // cotton buds and hair grips dropped on the floor
      const bud = new T.Group();
      part(bud, new T.CylinderGeometry(0.22, 0.22, 7, 8), 0xf0f0f0, mMatte, 0, 0, 0, { rz: PI / 2 });
      for (const sx of [-3.6, 3.6]) { const h = part(bud, new T.SphereGeometry(0.55, 12, 8), 0xffffff, mMatte, sx, 0, 0); h.scale.set(1.5, 1, 1); }
      for (const [x, z, a] of [[18, 86, 0.4], [26, 89, 1.9], [106, 24, 0.9], [-140, -6, 2.4], [70, 86, 0.2]]) {
        const b = bud.clone(); b.position.set(x, 0.55, z); b.rotation.y = a; K.add(b);
        warnRoad('bud', x, z, 4);
      }
      for (const [x, z, a, c] of [[-46, 52, 0.8, 0x3a2a24], [88, 32, 2.2, 0xf0559d], [-140, 70, 1.4, 0x3a2a24]]) {
        const g = new T.Group();
        part(g, new T.BoxGeometry(5.5, 0.16, 0.35), c, mGloss, 2.75, 0.1, 0);
        part(g, new T.BoxGeometry(5.0, 0.16, 0.35), c, mGloss, 2.5, 0.42, 0.55, { ry: 0.08 });
        part(g, new T.TorusGeometry(0.4, 0.09, 6, 10, PI), c, mGloss, 0, 0.26, 0.28, { rx: PI / 2, rz: PI / 2 });
        g.position.set(x, 0, z); g.rotation.y = a; K.add(g);
      }
    }

    // ---------------- contact shadows: one instanced draw ----------------
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      mat.customProgramCacheKey = () => 'bath-ao';
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1; keep.push(im);
    }

    // ---------------- merge static meshes per material (fewer draw calls) ----------------
    {
      const BU = K.BufferGeometryUtils;
      K.group.updateMatrixWorld(true);
      const kept = new Set(keep);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (kept.has(p)) return true; return false; };
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.material.transparent || o.renderOrder) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 80) return;
        const cell = Math.floor((c.x + 300) / 100) + ':' + Math.floor((c.z + 300) / 100);
        const key = o.material.uuid + cell + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(o);
      });
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        const geos = [];
        for (const o of list) {
          const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
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
  },

  // fixed-rate forces: the cascade's outflow current, the drain's pull, floating toys drifting home
  tick(dt, time, game) {
    if (!A) return;
    const D = A.drain;
    for (const e of game.cars) {
      const c = e.car;
      if (c.state !== 'drive' || c.airborne || e.out) continue;
      // current flowing away from the bath panel where the overflow lands
      const dx = c.x - CASC.x;
      const fx = Math.exp(-((dx / 17) ** 2)), fz = Math.min(1, Math.max(0, (-52 - c.z) / 40));
      const k = fx * fz;
      if (k > 0.01) {
        c.z += 7.5 * k * dt; c.x += Math.sign(dx) * 1.5 * k * dt;
        c.vz += 22 * k * dt;
      }
      if (D) {
        const ddx = D.x - c.x, ddz = D.z - c.z, rr = Math.hypot(ddx, ddz);
        if (rr < D.pull && rr > 0.01) {
          const q = 1 - rr / D.pull;
          const vin = 9 * q * q + 1.5 * q;
          c.x += (ddx / rr) * vin * dt; c.z += (ddz / rr) * vin * dt;
          c.w += 1.2 * q * dt;
        }
      }
    }
    for (const f of A.floats) {
      const d = f.d;
      if (d.state !== 'live') continue;
      const dx = d.x - CASC.x, k = Math.exp(-((dx / 17) ** 2)) * Math.min(1, Math.max(0, (-52 - d.z) / 40));
      if (k > 0.01) d.vz += 4 * k * dt;
      // gently drift back towards where they were floating
      if (maskAt(d.x, d.z) > 0.2 || f.ball) { d.vx += (f.home[0] - d.x) * f.tether * dt; d.vz += (f.home[1] - d.z) * f.tether * dt; }
      if (D) {
        const ddx = D.x - d.x, ddz = D.z - d.z, rr = Math.hypot(ddx, ddz);
        if (rr < D.pull && rr > 0.01) { const q = 1 - rr / D.pull; d.vx += (ddx / rr) * 16 * q * q * dt; d.vz += (ddz / rr) * 16 * q * q * dt; }
      }
    }
  },

  animate(time, dt, game) {
    if (!A) return;
    A.uTime.value = time;
    // hovercraft ripples on the water
    const uc = A.uCars.value;
    for (let i = 0; i < 4; i++) {
      const e = game.cars[i];
      if (!e || e.out || e.car.state !== 'drive' || maskAt(e.car.x, e.car.z) < 0.2) { uc[i].w = 0; continue; }
      uc[i].set(e.car.x, e.car.z, Math.min(1, e.car.speed / 30), 1);
    }
    // floating toys bob
    for (const f of A.floats) {
      const m = f.mesh, d = f.d;
      if (d.state !== 'live') continue;
      const wet = maskAt(d.x, d.z) > 0.2;
      const b = Math.sin(time * 2.1 + f.ph);
      if (!f.ball) {
        if (wet) {
          m.position.y += b * 0.1 * f.amp;
          m.rotation.x = Math.sin(time * 1.7 + f.ph * 1.3) * 0.05 * f.amp;
          m.rotation.z = Math.cos(time * 1.9 + f.ph) * 0.06 * f.amp;
        } else { m.position.y -= 0.2; m.rotation.x = m.rotation.z = 0; }
      } else if (wet) m.position.y += b * 0.08;
    }
    // clockwork frog
    if (A.frog) {
      const F = A.frog, q = F.pose(time);
      F.root.position.set(q.x, 0.05 + Math.sin(time * 9) * 0.06, q.z);
      F.root.rotation.y = -q.angle;
      const kick = q.moving ? Math.sin(time * 11) : 0;
      for (const l of F.legs) {
        l.back.rotation.y = l.sz * (0.25 + kick * 0.45);
        l.front.rotation.y = -l.sz * (0.2 + kick * 0.35);
      }
      F.body.rotation.z = kick * 0.05;
      F.bow.rotation.y = -time * 4;
      if (game.particles && q.moving && dt > 0 && Math.random() < dt * 14) {
        const c = Math.cos(q.angle), s = Math.sin(q.angle);
        game.particles.emit(q.x - c * 3.5, 0.4, q.z - s * 3.5, { color: 0xf4fcff, size: 0.8, life: 0.6, spread: 3, up: 3, grav: 20, grow: 1.6, alpha: 0.7 });
      }
    }
    // bath bomb dye follows it; fizz
    if (A.bomb) {
      const d = A.bomb.d;
      A.bomb.dye.position.set(d.x, 0.3, d.z);
      A.bomb.dye.rotation.z = time * 0.2;
      A.bomb.dye.visible = d.state === 'live';
      if (game.particles && d.state === 'live' && dt > 0 && Math.random() < dt * 16) {
        const a = Math.random() * 6.28;
        game.particles.emit(d.x + Math.cos(a) * 3, 0.5, d.z + Math.sin(a) * 3, { color: Math.random() < 0.5 ? 0xf3c6ff : 0xffffff, size: 0.55, life: 0.8, spread: 1.5, up: 2.5, grav: -1, grow: 1.4, alpha: 0.8 });
      }
    }
    // scale reading
    if (A.scale) {
      const S = A.scale;
      let w = 0;
      for (const e of game.cars) {
        const c = e.car;
        if (c.state !== 'drive' || c.y < S.SH - 0.5) continue;
        const dx = c.x - S.x, dz = c.z - S.z, a = dx * Math.cos(S.ang) + dz * Math.sin(S.ang), b = -dx * Math.sin(S.ang) + dz * Math.cos(S.ang);
        if (Math.abs(a) < S.SL / 2 && Math.abs(b) < S.SW / 2) w += 0.04;
      }
      const txt = w > 0 ? w.toFixed(2) : '0.0';
      if (txt !== S.last) { S.last = txt; S.drawLCD(txt); }
    }
    if (!game.particles || dt <= 0 || dt > 0.2) return;
    // cascade splash and spray
    for (const em of A.emit) {
      if (!game.onScreen(em.x, 2, em.z, 0.2)) continue;
      if (Math.random() < dt * em.rate) game.particles.emit(em.x + (Math.random() - 0.5) * em.w, 0.6, em.z + Math.random() * 1.5, { color: 0xf4fcff, size: em.big ? 0.8 : 0.5, life: 0.5, spread: 5, up: em.big ? 9 : 5, grav: 45, grow: 1.3, alpha: 0.85, vz: 3 });
      if (em.big && Math.random() < dt * 5) game.particles.emit(em.x + (Math.random() - 0.5) * em.w * 0.8, 1.0, em.z + 1.5, { color: 0xffffff, size: 3.2, life: 1.3, spread: 2, up: 1.5, grav: -0.5, grow: 2.2, alpha: 0.22 });
    }
    // hovercraft blowing spray off the flood, suds off the slicks
    for (const e of game.cars) {
      const c = e.car;
      if (c.state !== 'drive' || c.airborne) continue;
      const sp = c.speed;
      if (sp > 6 && maskAt(c.x, c.z) > 0.25 && Math.random() < dt * (8 + sp * 0.9)) {
        const a = Math.random() * 6.28;
        game.particles.emit(c.x + Math.cos(a) * 2.3, 0.45, c.z + Math.sin(a) * 1.6, { color: 0xf2fbff, size: 0.55, life: 0.45, spread: 4, up: 7, grav: 40, grow: 1.2, alpha: 0.85, vx: Math.cos(a) * 7 - c.vx * 0.15, vz: Math.sin(a) * 7 - c.vz * 0.15 });
      }
    }
  },
};
