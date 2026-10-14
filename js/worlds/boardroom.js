// World: the executive boardroom at golden hour, Q3 review. A glossy walnut table with a brass inlay, the
// city glowing through floor-to-ceiling windows on the north side, mullion shadows raking across the lacquer.
// Luxury SUVs race on a trail of sticky notes (highlighter edges, paper clips), jump off a bound report onto a
// closed laptop, dodge a buzzing phone, a spinning speakerphone, a presenter's laser dot, coffee and condensation.

import * as THREE from '../../vendor/three.bundle.js';

const TRACK = [
  [-100, 68], [-40, 70], [10, 66], [50, 58], [86, 62], [120, 52], [144, 26], [148, -8], [134, -38], [108, -54],
  [76, -60], [46, -76], [16, -60], [4, -34], [0, -4], [-10, 22], [-30, 32], [-50, 20], [-56, -8], [-62, -40],
  [-84, -60], [-118, -62], [-144, -42], [-154, -6], [-146, 32], [-128, 58],
];

// table top outline: rounded rectangle
const TB = { x0: -176, x1: 172, z0: -98, z1: 94, r: 50 };
function roundRect(x0, z0, x1, z1, rr, n = 12) {
  const out = [];
  const cs = [[x1 - rr, z1 - rr, 0], [x0 + rr, z1 - rr, Math.PI / 2], [x0 + rr, z0 + rr, Math.PI], [x1 - rr, z0 + rr, Math.PI * 1.5]];
  for (const [cx, cz, a0] of cs) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; out.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
  return out;
}
const BOUNDS = { minX: TB.x0, maxX: TB.x1, minZ: TB.z0, maxZ: TB.z1, poly: roundRect(TB.x0, TB.z0, TB.x1, TB.z1, TB.r, 10) };
const START_S = 40;
const WIN_Z = -122; // window wall
const JUMP = { lap: 506, len: 36, rampLen: 14, rampH: 4.2, lapH: 2.0, wid: 25 }; // closed laptop centre (s), ramp before it
const SPK = { x: -29, z: 12, R: 15, w: 0.62 }; // speakerphone
const PHONE = { s: 800, P: 12.5, off0: -13.6, off1: -4.6, hw: 9.2, hd: 4.5 };
const LASER = { s0: 112, s1: 236, r: 2.4 };
const HOLE = { x: 136.2, z: -2, r: 3.3 };

let A = null; // runtime state

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// phone on vibrate: rests beside the west straight, rings, inches into the road, then shuffles back
function phonePose(t, B) {
  const P = PHONE.P, u = (((t + 2.1) % P) + P) % P;
  const N = 7; // buzz steps per walk
  const step = (q) => { const k = Math.min(N - 1, Math.floor(q * N)), fr = q * N - k; return (k + ss(0, 1, fr)) / N; };
  let f = 0, lit = 0, buzz = 0;
  if (u < 3) { f = 0; lit = 0; }
  else if (u < 4) { lit = ss(3, 3.25, u); buzz = 1; }
  else if (u < 7.2) { f = step((u - 4) / 3.2); lit = 1; buzz = 1; }
  else if (u < 8.6) { f = 1; lit = 1; buzz = 1; }
  else if (u < 11.4) { f = 1 - step((u - 8.6) / 2.8); lit = 1; buzz = 1; }
  else { f = 0; lit = 1 - ss(11.4, 12.4, u); }
  const jit = buzz ? 0.14 * Math.sin(t * 77) : 0;
  const off = lerp(PHONE.off0, PHONE.off1, f) + jit;
  const along = 2.4 * Math.sin(f * Math.PI) + (buzz ? 0.1 * Math.sin(t * 61) : 0);
  const angle = B.angle + 0.24 * Math.sin(f * Math.PI) + (buzz ? 0.035 * Math.sin(t * 53) : 0);
  return { x: B.x + B.nx * off + B.tx * along, z: B.z + B.nz * off + B.tz * along, angle, lit, buzz, f };
}
function laserS(t) {
  const m = (LASER.s0 + LASER.s1) / 2, h = (LASER.s1 - LASER.s0) / 2;
  return m + h * (0.64 * Math.sin(t * 0.27) + 0.36 * Math.sin(t * 0.61 + 1.3));
}
function laserPos(t, track) {
  const s = laserS(t);
  const lat = 4.6 * Math.sin(t * 0.83 + 0.4) + 1.6 * Math.sin(t * 2.1) + 0.22 * Math.sin(t * 13.7) + 0.15 * Math.sin(t * 21.3);
  return track.place(s, lat);
}

export default {
  id: 'boardroom',
  name: 'Quarterly Review',
  blurb: 'Luxury SUVs on a sticky-note trail across a glossy boardroom table at golden hour.',
  vehicle: 'suv',
  seed: 42,
  track: { points: TRACK, width: 14, startS: START_S },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  skidColor: 0x2a2018,
  dustColor: 0xe8d8c0,
  clackOnBump: true,
  dust: {
    normal: null,
    sticky: { color: 0x5a3216, size: 0.7, life: 0.45, up: 1.2, grav: 12, alpha: 0.9, grow: 1 },
    slick: { color: 0xdff0ff, size: 0.6, life: 0.5, up: 3, grav: 25, alpha: 0.85, grow: 1, rate: 2 },
    rough: { color: 0xd9dde3, size: 0.45, life: 0.35, up: 3, grav: 30, alpha: 1, grow: 1, rate: 1.5 },
  },
  lighting: {
    sunDir: [-0.55, 0.45, -0.7], sunColor: 0xffc27e, sunIntensity: 3.4,
    hemiSky: 0xd9d2cc, hemiGround: 0x3a2418, hemiIntensity: 0.62,
    envIntensity: 0.4, exposure: 1.05, background: 0x120c09, shadowRadius: 2.6,
    fog: { color: 0x1b130d, near: 170, far: 560 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const PI = Math.PI, TAU = PI * 2, L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const t0 = performance.now();
    A = { track, keep: [], dazzle: [], lastBuzz: -1 };
    const keep = A.keep;
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`boardroom: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };
    const wrapS = (s) => ((s % L) + L) % L;
    const inS = (s, a, b) => { s = wrapS(s); a = wrapS(a); b = wrapS(b); return a <= b ? s >= a && s <= b : s >= a || s <= b; };
    const local = (cx, cz, a, along, side) => [cx + Math.cos(a) * along - Math.sin(a) * side, cz + Math.sin(a) * along + Math.cos(a) * side];
    const canvas = (w, h, fn) => { const c = TX.makeCanvas(w, h); fn(c.getContext('2d'), w, h); return c; };
    const tex = (c, o = {}) => TX.toTexture(c, { wrap: false, ...o });

    // ============================================================================ batched contact shadows
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.05) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const flushAO = () => {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x080402, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1;
    };

    // ============================================================================ the room's reflection: a custom cube map
    // (ceiling with downlights and a long linear pendant, golden windows to the north, panelled walls)
    const ENV = (() => {
      const S = 256;
      const wall = (g, lit) => {
        const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#1a120c'); gr.addColorStop(0.6, '#2a1b12'); gr.addColorStop(1, '#120b07');
        g.fillStyle = gr; g.fillRect(0, 0, S, S);
        for (let x = 0; x < S; x += 32) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 2, S); }
        if (lit) { const lg = g.createLinearGradient(0, 0, S, 0); lg.addColorStop(0, 'rgba(255,170,90,0.0)'); lg.addColorStop(1, 'rgba(255,170,90,0.35)'); g.fillStyle = lg; g.fillRect(0, 0, S, S); }
      };
      const px = canvas(S, S, (g) => { wall(g, false); g.fillStyle = '#0c1830'; g.fillRect(60, 70, 136, 80); g.fillStyle = '#5d8fe0'; g.fillRect(66, 76, 124, 68); g.fillStyle = '#e8f0ff'; g.fillRect(80, 92, 60, 6); });
      const nx = canvas(S, S, (g) => { wall(g, true); g.fillStyle = '#3a2a1c'; g.fillRect(70, 60, 116, 90); g.fillStyle = '#b0703a'; g.fillRect(78, 68, 100, 74); });
      const py = canvas(S, S, (g) => {
        g.fillStyle = '#17110d'; g.fillRect(0, 0, S, S);
        // golden glow from the windows along the north edge (top of this face)
        const gw = g.createLinearGradient(0, 0, 0, 90); gw.addColorStop(0, 'rgba(255,190,110,0.95)'); gw.addColorStop(0.35, 'rgba(255,150,80,0.35)'); gw.addColorStop(1, 'rgba(255,150,80,0)');
        g.fillStyle = gw; g.fillRect(0, 0, S, 90);
        // ceiling coffers
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3;
        for (let x = 0; x <= S; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
        for (let y = 0; y <= S; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
        // long linear pendant above the table (along x)
        g.fillStyle = '#fff6e6'; g.fillRect(30, 124, 196, 8);
        const pg = g.createLinearGradient(0, 108, 0, 148); pg.addColorStop(0, 'rgba(255,240,220,0)'); pg.addColorStop(0.5, 'rgba(255,240,220,0.5)'); pg.addColorStop(1, 'rgba(255,240,220,0)');
        g.fillStyle = pg; g.fillRect(24, 108, 208, 40);
        // cool downlights
        for (let y = 32; y < S; y += 64) for (let x = 32; x < S; x += 64) {
          if (y > 100 && y < 160) continue;
          const rg = g.createRadialGradient(x, y, 0, x, y, 14); rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.3, 'rgba(225,235,255,0.9)'); rg.addColorStop(1, 'rgba(200,215,255,0)');
          g.fillStyle = rg; g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fill();
        }
      });
      const ny = canvas(S, S, (g) => { g.fillStyle = '#1c1d22'; g.fillRect(0, 0, S, S); });
      const pz = canvas(S, S, (g) => { wall(g, false); g.fillStyle = '#0b0705'; g.fillRect(100, 90, 56, 166); });
      const nz = canvas(S, S, (g) => {
        const sky = g.createLinearGradient(0, 0, 0, S); sky.addColorStop(0, '#8a5a4a'); sky.addColorStop(0.35, '#f0a060'); sky.addColorStop(0.55, '#ffd28a'); sky.addColorStop(0.6, '#e08048'); sky.addColorStop(1, '#40261a');
        g.fillStyle = sky; g.fillRect(0, 0, S, S);
        const rr = K.rng(9);
        for (let i = 0; i < 40; i++) { const w = 6 + rr() * 16, h = 20 + rr() * 90, x = rr() * S; g.fillStyle = `rgba(${40 + rr() * 30},${28 + rr() * 20},${30 + rr() * 20},0.95)`; g.fillRect(x, 150 - h * 0.5, w, h + 120); }
        for (let x = 0; x < S; x += 52) { g.fillStyle = '#0e0a08'; g.fillRect(x, 0, 5, S); }
      });
      const ct = new T.CubeTexture([px, nx, py, ny, pz, nz]);
      ct.colorSpace = T.SRGBColorSpace; ct.needsUpdate = true;
      return ct;
    })();
    const shiny = (m, k = 1) => { m.envMap = ENV; m.envMapIntensity = k; return m; };

    // ============================================================================ shared materials
    const white = shiny(K.ceramic(0xf7f5f0), 0.9);
    const chrome = shiny(K.metal(0xe6e8ec, 0.12), 1.2);
    const steel = shiny(K.metal(0xc9ccd2, 0.3), 1);
    const brass = shiny(K.metal(0xd9b264, 0.24), 1.2);
    const gold = shiny(K.metal(0xe6bf6a, 0.2), 1.2);
    const blackGloss = shiny(K.phys({ color: 0x111114, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 }), 0.9);
    const blackMatte = K.std({ color: 0x1b1b1e, roughness: 0.6 });
    const graphite = K.phys({ color: 0x2a2c31, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 });
    const glassMat = shiny(K.glass(0xffffff, 0.16, { envMapIntensity: 1.8 }), 1.8);
    const waterMat = shiny(K.phys({ color: 0xcfe6f2, roughness: 0.03, transparent: true, opacity: 0.38, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false }), 1.6);
    const paperMat = K.std({ color: 0xf3efe6, roughness: 0.92 });

    // ============================================================================ carpet, table shadow, chairs, window wall
    {
      // charcoal carpet with a faint diamond pattern
      const cc = TX.paint(256, 256, (x, y, u, v, o) => {
        const d = (Math.abs(((u * 4) % 1) - 0.5) + Math.abs(((v * 4) % 1) - 0.5));
        const line = Math.abs(d - 0.5) < 0.03 ? 1 : 0;
        const n = Math.random() * 14;
        o[0] = 40 + n + line * 14; o[1] = 40 + n + line * 12; o[2] = 46 + n + line * 10;
      });
      const ct = TX.toTexture(cc, { repeat: [28, 28] });
      K.mesh(new T.PlaneGeometry(1600, 1600), K.std({ map: ct, roughness: 1, color: 0x5c5a60 }), 0, -76, 0, { rx: -PI / 2, cast: false, receive: false });
      // the table's soft shadow on the carpet, and a warm sunlit patch near the window
      const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.62, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      sh.rotation.x = -PI / 2; sh.scale.set(560, 380, 1); sh.position.set(30, -75.9, 30); K.group.add(sh);
      const sun = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xffa050, transparent: true, opacity: 0.22, alphaMap: TX.blobShadowTexture(), depthWrite: false, blending: T.AdditiveBlending }));
      sun.rotation.x = -PI / 2; sun.scale.set(700, 60, 1); sun.position.set(-40, -75.85, WIN_Z + 20); K.group.add(sun);
    }

    // leather chairs pushed in around the south side and the ends (the window side is kept clear)
    {
      const leatherT = TX.mottledTextures({ size: 256, a: 0x4a2716, b: 0x3a1d10, seed: 23, period: 32, speck: 0.25, bump: 2.2 });
      const leather = K.phys({ map: leatherT.map, normalMap: leatherT.normalMap, normalScale: V2(0.7), roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new T.Color(0x8a5a3a) });
      const parts = { l: [], c: [], b: [] };
      const P = (g, k, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); parts[k].push(g.index ? g.toNonIndexed() : g); };
      P(new K.RoundedBoxGeometry(52, 10, 50, 3, 4), 'l', 0, 45, 1);
      P(new K.RoundedBoxGeometry(50, 50, 10, 3, 4.5), 'l', 0, 77, -24, -0.14);
      P(new K.RoundedBoxGeometry(46, 6, 3, 2, 1.4), 'c', 0, 99, -27.5, -0.14);
      for (const sx of [-1, 1]) {
        P(new K.RoundedBoxGeometry(5, 3, 36, 2, 1.3), 'b', sx * 28, 63, -2);
        P(new T.CylinderGeometry(1.1, 1.1, 14, 12), 'c', sx * 28, 55, -14, 0.2);
      }
      P(new T.CylinderGeometry(2.6, 2.6, 30, 16), 'c', 0, 24, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const leg = new T.BoxGeometry(30, 2.5, 4); leg.translate(15, 0, 0); leg.rotateY(a); leg.translate(0, 7, 0); parts.c.push(leg.toNonIndexed());
        P(new T.SphereGeometry(3, 12, 8), 'b', Math.cos(a) * 29, 3, -Math.sin(a) * 29);
      }
      const mg = (k) => { const g = K.BufferGeometryUtils.mergeGeometries(parts[k].map((g) => { for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n); if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; })); return g; };
      const south = [], ends = [];
      for (const x of [-138, -78, -18, 42, 102]) south.push({ x: x + r.range(-4, 4), y: -76, z: TB.z1 + 24 + r.range(0, 6), ry: PI + r.range(-0.15, 0.15) });
      ends.push({ x: TB.x1 + 26, y: -76, z: -4, ry: -PI / 2 + 0.1 });
      ends.push({ x: TB.x0 - 30, y: -76, z: 2, ry: PI / 2 - 0.06, s: 1.12 });
      const vc = (g, hex) => { const c = new T.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
      const metalG = K.BufferGeometryUtils.mergeGeometries([vc(mg('c'), 0xe6e8ec), vc(mg('b'), 0x1a1a1c)]);
      const metalM = shiny(K.std({ vertexColors: true, metalness: 1, roughness: 0.18 }), 1.1);
      for (const list of [south, ends]) {
        K.instances(mg('l'), leather, list, { cast: false });
        K.instances(metalG, metalM, list, { cast: false });
      }
    }

    // floor-to-ceiling windows: a painted golden-hour city (seen from high up), bronze mullions that cast
    // long shadows across the table
    {
      const W = 2048, H = 1024;
      const c = canvas(W, H, (g) => {
        const rr = K.rng(77);
        const sky = g.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#3d3a66'); sky.addColorStop(0.18, '#a8607a'); sky.addColorStop(0.32, '#f28c50'); sky.addColorStop(0.4, '#ffc97a'); sky.addColorStop(0.43, '#ffe2a8');
        sky.addColorStop(0.47, '#d88a5a'); sky.addColorStop(1, '#3a2a2a');
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        // sun near the horizon
        const sx = 380, sy = 420;
        const halo = g.createRadialGradient(sx, sy, 0, sx, sy, 300); halo.addColorStop(0, 'rgba(255,250,220,1)'); halo.addColorStop(0.08, 'rgba(255,230,160,0.95)'); halo.addColorStop(0.3, 'rgba(255,170,90,0.35)'); halo.addColorStop(1, 'rgba(255,140,80,0)');
        g.fillStyle = halo; g.fillRect(0, 0, W, H);
        // distant towers (hazy), mid towers, near towers with lit windows; seen from high up, horizon at ~43%
        const towers = (n, y0, hMin, hMax, wMin, wMax, col, winA, haze) => {
          for (let i = 0; i < n; i++) {
            const w = wMin + rr() * (wMax - wMin), h = hMin + rr() * (hMax - hMin), x = rr() * W;
            const top = y0 - h;
            g.fillStyle = col; g.fillRect(x, top, w, H - top);
            if (rr() < 0.3) { g.fillRect(x + w * 0.3, top - h * 0.12, w * 0.4, h * 0.12); }
            // sunlit west faces
            const lg = g.createLinearGradient(x, 0, x + w, 0); lg.addColorStop(0, `rgba(255,170,90,${0.35 * haze})`); lg.addColorStop(0.5, 'rgba(255,170,90,0)');
            g.fillStyle = lg; g.fillRect(x, top, w, H - top);
            if (winA > 0) {
              for (let yy = top + 6; yy < H; yy += 9) for (let xx = x + 3; xx < x + w - 4; xx += 7) {
                if (rr() < 0.42) { g.fillStyle = rr() < 0.7 ? `rgba(255,200,120,${winA * (0.4 + rr() * 0.6)})` : `rgba(200,220,255,${winA * 0.6})`; g.fillRect(xx, yy, 4, 5); }
              }
            }
          }
        };
        towers(70, 445, 10, 90, 14, 46, '#8a5a5a', 0.15, 0.5);
        const hz = g.createLinearGradient(0, 380, 0, 470); hz.addColorStop(0, 'rgba(255,190,120,0)'); hz.addColorStop(1, 'rgba(255,190,120,0.35)');
        g.fillStyle = hz; g.fillRect(0, 380, W, 90);
        towers(50, 520, 40, 180, 26, 70, '#5a3a3e', 0.5, 0.8);
        towers(26, 700, 120, 420, 50, 120, '#3a262a', 0.85, 1);
        // streets far below with car light trails
        for (let i = 0; i < 16; i++) {
          const y = 760 + rr() * 260;
          g.strokeStyle = `rgba(255,${150 + rr() * 80},90,0.55)`; g.lineWidth = 1.5 + rr() * 2;
          g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + (rr() - 0.5) * 60, W * 0.7, y + (rr() - 0.5) * 60, W, y + (rr() - 0.5) * 40); g.stroke();
        }
        // faint reflection of the room on the glass
        g.fillStyle = 'rgba(255,230,200,0.04)'; g.fillRect(0, 0, W, H);
      });
      const bt = tex(c);
      const back = new T.Mesh(new T.PlaneGeometry(1000, 330), new T.MeshBasicMaterial({ map: bt, fog: false }));
      back.position.set(-40, -76 + 165, WIN_Z - 2);
      K.group.add(back);
      // mullions, sill and a ceiling bulkhead edge
      const bronze = K.std({ color: 0x2a2018, roughness: 0.45, metalness: 0.6 });
      const geos = [];
      for (let x = -520; x <= 440; x += 72) geos.push(new T.BoxGeometry(5, 330, 4).translate(x, -76 + 165, WIN_Z));
      geos.push(new T.BoxGeometry(1000, 6, 10).translate(-40, -73, WIN_Z + 2));
      K.mesh(K.BufferGeometryUtils.mergeGeometries(geos), bronze, 0, 0, 0, { cast: true, receive: false });
    }

    // ============================================================================ the boardroom table
    {
      const sh = new T.Shape();
      const poly = roundRect(TB.x0, TB.z0, TB.x1, TB.z1, TB.r, 16);
      sh.moveTo(poly[0][0], -poly[0][1]);
      for (let i = 1; i < poly.length; i++) sh.lineTo(poly[i][0], -poly[i][1]);
      sh.closePath();
      const D = 4.2, BV = 0.9;
      const g = new T.ExtrudeGeometry(sh, { depth: D, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 4, curveSegments: 4 });
      g.rotateX(-PI / 2);
      g.translate(0, -(D + BV), 0);
      // planks run along x: v = x, u = z
      const uv = g.attributes.uv, pos = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getZ(i) + 100) / 96 + pos.getY(i) * 0.002, pos.getX(i) / 88);
      const wal = TX.woodTextures({ size: 1024, seed: 44, planks: 2, base: 0x5c3620, dark: 0x26130a, light: 0x8a5a36, ringFreq: 9, gap: 0.0016, gapColor: 0x120804, roughBase: 0.3, lacquer: 0.8, varyPlanks: 0.08, figure: 1.3 });
      const tableMat = shiny(K.phys({
        map: wal.map, normalMap: wal.normalMap, normalScale: V2(0.18), roughness: 0.32, roughnessMap: wal.roughnessMap,
        clearcoat: 1, clearcoatRoughness: 0.045, color: 0xffffff,
      }), 1.05);
      const top = K.mesh(g, tableMat, 0, 0, 0, { cast: false });
      top.receiveShadow = true;
      // brass inlay line around the top
      const ring = new T.Shape();
      const o = roundRect(TB.x0 + 7, TB.z0 + 7, TB.x1 - 7, TB.z1 - 7, TB.r - 7, 16), i2 = roundRect(TB.x0 + 7.7, TB.z0 + 7.7, TB.x1 - 7.7, TB.z1 - 7.7, TB.r - 7.7, 16);
      ring.moveTo(o[0][0], -o[0][1]); for (let i = 1; i < o.length; i++) ring.lineTo(o[i][0], -o[i][1]); ring.closePath();
      const hole = new T.Path(); hole.moveTo(i2[0][0], -i2[0][1]); for (let i = 1; i < i2.length; i++) hole.lineTo(i2[i][0], -i2[i][1]); hole.closePath();
      ring.holes.push(hole);
      const rg = new T.ShapeGeometry(ring, 4); rg.rotateX(-PI / 2);
      K.mesh(rg, brass, 0, 0.012, 0, { cast: false });
    }

    // ============================================================================ the road: a trail of sticky notes
    const skipNotes = (s) => Math.abs(((s - START_S + L / 2) % L + L) % L - L / 2) < 12 || inS(s, JUMP.lap - JUMP.len / 2 - JUMP.rampLen - 1, JUMP.lap + JUMP.len / 2 - 1);
    {
      const NOTE_COL = ['#fbe36e', '#f9b2cf', '#a9e6c6', '#a9d4f5', '#ffc68a'];
      const INK = { blue: '#1d3a8f', black: '#1c1c22', red: '#c0262d', green: '#13704a' };
      const notes = [
        ['synergy?', 'marker', 'black', 'wave'], ['align!', 'pen', 'blue', 'arrow'], ['KPI ↑', 'marker', 'red', 'chart'], ['circle back', 'pen', 'blue', 'circle'],
        ['TBD', 'marker', 'black', 'box'], ['ROI??', 'marker', 'red', 'under'], ['deep dive', 'pen', 'green', 'arrow'], ['Q3 ✓', 'pen', 'blue', 'list'],
        ['think BIG', 'marker', 'black', 'stars'], ['quick win', 'pen', 'red', 'smile'], ['per my last email', 'pen', 'black', 'none'], ['move the needle', 'pen', 'blue', 'gauge'],
        ['pivot?', 'marker', 'blue', 'arrow'], ['EOD!!', 'marker', 'red', 'under'], ['win-win :)', 'pen', 'green', 'none'], ['take it offline', 'pen', 'black', 'cross'],
      ];
      const S = 256;
      const atlas = canvas(1024, 1024, (g) => {
        const rr = K.rng(5);
        notes.forEach(([txt, kind, ink, deco], k) => {
          const cx = (k % 4) * S, cy = Math.floor(k / 4) * S;
          const col = NOTE_COL[(k * 3 + Math.floor(k / 4)) % NOTE_COL.length];
          g.save(); g.translate(cx, cy);
          g.fillStyle = col; g.fillRect(0, 0, S, S);
          // sticky strip (slightly darker) and paper tone
          const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(0,0,0,0.07)'); gr.addColorStop(0.16, 'rgba(0,0,0,0.07)'); gr.addColorStop(0.17, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.10)');
          g.fillStyle = gr; g.fillRect(0, 0, S, S);
          for (let i = 0; i < 260; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)'; g.fillRect(rr() * S, rr() * S, 1 + rr() * 2, 1); }
          g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2);
          // handwriting: per-character jitter
          const c = INK[ink];
          const size = kind === 'marker' ? (txt.length > 8 ? 46 : 64) : (txt.length > 12 ? 30 : txt.length > 8 ? 38 : 46);
          const font = kind === 'marker' ? `${size}px "Lilita One", Impact, sans-serif` : `italic 700 ${size}px Georgia, serif`;
          g.font = font; g.fillStyle = c; g.textBaseline = 'middle';
          const words = txt.length > 12 ? txt.split(' ').reduce((a, w) => { const l = a[a.length - 1]; if (l && (l + ' ' + w).length <= 10) a[a.length - 1] = l + ' ' + w; else a.push(w); return a; }, []) : [txt];
          const lineH = size * 1.05;
          const y0 = S * 0.52 - ((words.length - 1) * lineH) / 2;
          const tilt = (rr() - 0.5) * 0.18;
          g.save(); g.translate(S / 2, 0); g.rotate(tilt);
          words.forEach((wline, li) => {
            const wdt = g.measureText(wline).width;
            let x = -wdt / 2;
            for (const ch of wline) {
              const cw = g.measureText(ch).width;
              g.save(); g.translate(x + cw / 2, y0 + li * lineH + (rr() - 0.5) * 4); g.rotate((rr() - 0.5) * 0.12);
              g.fillText(ch, -cw / 2, 0); g.restore();
              x += cw * (0.96 + rr() * 0.06);
            }
          });
          g.restore();
          g.strokeStyle = c; g.lineWidth = kind === 'marker' ? 6 : 3.5; g.lineCap = 'round'; g.lineJoin = 'round';
          const yb = y0 + (words.length - 1) * lineH + size * 0.62;
          if (deco === 'wave' || deco === 'under') {
            g.beginPath(); for (let x = 50; x <= 206; x += 6) { const y = yb + (deco === 'wave' ? Math.sin(x * 0.12) * 5 : (x - 50) * 0.03); x === 50 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
            if (deco === 'under') { g.beginPath(); g.moveTo(60, yb + 10); g.lineTo(196, yb + 12); g.stroke(); }
          } else if (deco === 'arrow') {
            g.beginPath(); g.moveTo(70, yb + 6); g.quadraticCurveTo(128, yb + 22, 186, yb + 4); g.stroke();
            g.beginPath(); g.moveTo(172, yb - 6); g.lineTo(188, yb + 4); g.lineTo(172, yb + 16); g.stroke();
          } else if (deco === 'chart') {
            g.beginPath(); g.moveTo(60, 230); g.lineTo(60, 170); g.moveTo(60, 230); g.lineTo(200, 230); g.stroke();
            g.beginPath(); g.moveTo(66, 222); g.lineTo(100, 208); g.lineTo(130, 214); g.lineTo(160, 190); g.lineTo(196, 172); g.stroke();
          } else if (deco === 'circle') {
            g.beginPath(); g.ellipse(128, S * 0.52, 110, 52, -0.05, 0.2, TAU + 0.5); g.stroke();
          } else if (deco === 'box') {
            g.strokeRect(46, 82, 164, 100);
          } else if (deco === 'list') {
            for (let i = 0; i < 3; i++) { g.strokeRect(48, 168 + i * 26 - 8, 14, 14); g.beginPath(); g.moveTo(72, 168 + i * 26); g.lineTo(150 + rr() * 50, 168 + i * 26); g.stroke(); }
          } else if (deco === 'stars') {
            for (const [x, y] of [[40, 70], [214, 74], [200, 200]]) { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * PI * 0.8; g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); } g.closePath(); g.stroke(); }
          } else if (deco === 'smile') {
            g.beginPath(); g.arc(128, 200, 22, 0.3, PI - 0.3); g.stroke(); g.fillStyle = c; g.fillRect(116, 182, 4, 6); g.fillRect(136, 182, 4, 6);
          } else if (deco === 'gauge') {
            g.beginPath(); g.arc(128, 222, 40, PI, TAU); g.stroke(); g.beginPath(); g.moveTo(128, 222); g.lineTo(156, 194); g.stroke();
          } else if (deco === 'cross') {
            g.beginPath(); g.moveTo(40, 120); g.lineTo(216, 150); g.stroke();
          }
          g.restore();
        });
      });
      const atlasT = TX.toTexture(atlas, { wrap: false });
      const noteMat = K.std({ map: atlasT, roughness: 0.82, side: T.DoubleSide });
      const NS = 13.8, SEG = 6;
      const pos = [], uvs = [], idx = [], spos = [], sidx = [], suv = [];
      let s = START_S + 12, i = 0, guard = 0, lastCell = -1;
      const perm = [...Array(16).keys()];
      while (s < START_S + L - 12 && guard++ < 400) {
        const p = track.at(s);
        const sp = 10.4 / (1 + Math.min(1.2, Math.abs(p.curv) * 7));
        if (!skipNotes(s)) {
          const lat = r.range(-0.35, 0.35);
          const q = track.place(s, lat);
          let ry = -p.angle + r.range(-0.07, 0.07);
          ry -= Math.round(ry / (PI / 2)) * (PI / 2);
          const ca = Math.cos(ry), sa = Math.sin(ry);
          if (i % 16 === 0) { for (let k = 15; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [perm[k], perm[j]] = [perm[j], perm[k]]; } if (perm[0] === lastCell) [perm[0], perm[8]] = [perm[8], perm[0]]; }
          const cell = perm[i % 16]; lastCell = cell;
          const cu = cell % 4, cv = Math.floor(cell / 4);
          const y0 = 0.05 + (i % 90) * 0.003;
          // the edge facing back along the trail lies on top of the previous note: curl a corner of it
          const bx = -p.tx, bz = -p.tz; // world backward
          const la = bx * ca - bz * sa, lb = bx * sa + bz * ca; // backward in note-local (a, b)
          const ea = Math.abs(la) > Math.abs(lb) ? Math.sign(la) : 0, eb = ea ? 0 : Math.sign(lb);
          const side = r() < 0.5 ? 1 : -1, curl = r.range(0.22, 0.42);
          const base = pos.length / 3;
          for (let iy = 0; iy <= SEG; iy++) for (let ix = 0; ix <= SEG; ix++) {
            const ua = ix / SEG - 0.5, ub = iy / SEG - 0.5;
            const a = ua * NS, b = ub * NS;
            const edge = ea ? ua * ea : ub * eb, along = ea ? ub * side : ua * side; // 0.5 at the back edge / chosen corner
            const k = Math.max(0, edge + along - 0.62) / 0.38;
            const lift = curl * k * k;
            pos.push(q.x + a * ca + b * sa, y0 + lift, q.z - a * sa + b * ca);
            uvs.push((cu + ix / SEG) / 4, 1 - (cv + iy / SEG) / 4);
          }
          for (let iy = 0; iy < SEG; iy++) for (let ix = 0; ix < SEG; ix++) {
            const a0 = base + iy * (SEG + 1) + ix, b0 = a0 + SEG + 1;
            idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
          }
          // soft drop shadow (towards the south-east, away from the sun)
          const sb = spos.length / 3, E = NS * 0.58;
          for (const [a, b, u, v] of [[-E, -E, 0, 0], [E, -E, 1, 0], [E, E, 1, 1], [-E, E, 0, 1]]) { spos.push(q.x + a * ca + b * sa + 0.45, 0.03, q.z - a * sa + b * ca + 0.55); suv.push(u, v); }
          sidx.push(sb, sb + 3, sb + 1, sb + 1, sb + 3, sb + 2);
          i++;
        }
        s += sp * r.range(0.92, 1.06);
      }
      const ng = new T.BufferGeometry();
      ng.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      ng.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      ng.setIndex(idx); ng.computeVertexNormals();
      const nm = K.mesh(ng, noteMat, 0, 0, 0, { cast: true });
      keep.push(nm);
      const blur = canvas(64, 64, (g) => { g.filter = 'blur(5px)'; g.fillStyle = '#fff'; g.fillRect(12, 12, 40, 40); });
      const sg = new T.BufferGeometry();
      sg.setAttribute('position', new T.Float32BufferAttribute(spos, 3));
      sg.setAttribute('uv', new T.Float32BufferAttribute(suv, 2));
      sg.setAttribute('normal', new T.Float32BufferAttribute(new Array(spos.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
      sg.setIndex(sidx);
      const sm = new T.Mesh(sg, new T.MeshBasicMaterial({ color: 0x050302, transparent: true, opacity: 0.5, alphaMap: tex(blur, { srgb: false }), depthWrite: false }));
      sm.renderOrder = 1; K.group.add(sm);
      A.noteCount = i;

      // highlighter strokes along both edges (on the notes)
      const hl = canvas(64, 1024, (g) => {
        const rr = K.rng(12);
        g.clearRect(0, 0, 64, 1024);
        for (let k = 0; k < 3; k++) {
          g.fillStyle = `rgba(255,255,255,${0.45 + k * 0.12})`;
          const x0 = 6 + rr() * 6, x1 = 52 + rr() * 6;
          g.fillRect(x0, 0, x1 - x0, 1024);
        }
        for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(8 + rr() * 48, rr() * 1024, 1.5, 30 + rr() * 200); }
      });
      const hlT = TX.toTexture(hl, { srgb: false });
      const hlMat = new T.MeshBasicMaterial({ color: 0xff5a1f, alphaMap: hlT, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      hlMat.color.convertSRGBToLinear();
      const hw = (w, s2) => (skipNotes(s2) && !(Math.abs(((s2 - START_S + L / 2) % L + L) % L - L / 2) < 12) ? 0 : 1.45);
      const hg = K.BufferGeometryUtils.mergeGeometries([-1, 1].map((sd) => track.ribbonGeometry({ width: 1.45, offset: sd * 6.15, y: 0.42, vScale: 90, step: 2, widthFn: hw })));
      const hm = new T.Mesh(hg, hlMat); hm.renderOrder = 2; hm.receiveShadow = true; K.group.add(hm);

      // paper clips clipped over the note edges
      const clipC = canvas(256, 64, (g) => {
        g.lineCap = 'round'; g.lineJoin = 'round';
        const path = () => { g.beginPath(); g.moveTo(40, 40); g.lineTo(226, 40); g.arc(226, 28, 12, PI / 2, -PI / 2, true); g.lineTo(22, 16); g.arc(22, 32, 16, -PI / 2, PI / 2, true); g.lineTo(200, 48); g.arc(200, 36, 12, PI / 2, -PI / 2, true); g.lineTo(60, 24); g.stroke(); };
        g.strokeStyle = '#7a7d82'; g.lineWidth = 7; path();
        g.strokeStyle = '#ffffff'; g.lineWidth = 3; path();
      });
      const clipMat = shiny(K.std({ map: tex(clipC), alphaTest: 0.35, metalness: 0.9, roughness: 0.25, side: T.DoubleSide }), 1.3);
      const cg = new T.PlaneGeometry(4.4, 1.1); cg.rotateX(-PI / 2);
      const clips = [];
      const cols = [0xffffff, 0xffffff, 0xffd47a, 0xffffff, 0xff8a7a, 0x9ac4ff];
      for (const sd of [-1, 1]) {
        for (const p of track.edgePoints(sd, 7.5, 0.25, sd < 0 ? 0 : 3.75)) {
          if (skipNotes(p.s)) continue;
          clips.push({ x: p.x, y: 0.5, z: p.z, ry: -p.angle + PI / 2 + r.range(-0.12, 0.12), color: r.pick(cols) });
        }
      }
      K.instances(cg, clipMat, clips, { colors: true, cast: false });
    }

    // ============================================================================ start / finish: the printed agenda + chequered tape
    {
      const p = track.at(START_S);
      const c = canvas(512, 720, (g) => {
        g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 512, 720);
        g.fillStyle = '#1d2a44'; g.fillRect(0, 0, 512, 92);
        g.fillStyle = '#e8c36a'; g.fillRect(0, 92, 512, 6);
        g.fillStyle = '#ffffff'; g.font = '700 40px Georgia, serif'; g.textAlign = 'left';
        g.fillText('Q3 REVIEW', 36, 58);
        g.font = '20px Rubik, Arial, sans-serif'; g.fillStyle = '#c9d4ea'; g.fillText('AGENDA · Boardroom 42 · 17:30', 36, 82);
        g.fillStyle = '#1d2a44'; g.font = '700 30px Georgia, serif';
        g.fillText('Item 1 — Start your engines', 36, 152);
        g.font = '22px Rubik, Arial, sans-serif'; g.fillStyle = '#333a48';
        const items = ['2.  Synergy alignment (quick)', '3.  KPI deep dive', '4.  Laptop jump — Legal to advise', '5.  Coffee (strictly)', '6.  Circle back on item 2', '7.  AOB · Who parked on the agenda?'];
        items.forEach((t, i) => g.fillText(t, 36, 470 + i * 36));
        g.fillStyle = '#9aa2b0'; g.font = '16px Rubik, Arial, sans-serif'; g.fillText('CONFIDENTIAL — do not leave on the table', 36, 700);
        g.strokeStyle = 'rgba(29,42,68,0.25)'; g.lineWidth = 2; g.strokeRect(14, 14, 484, 692);
      });
      const pageMat = K.std({ map: tex(c), roughness: 0.85 });
      const page = K.mesh(new T.PlaneGeometry(27, 38), pageMat, p.x + 1.5, 0.12, p.z - 2, { rx: -PI / 2, cast: false });
      page.rotation.z = 0.04;
      AO(p.x + 1.5, p.z - 2, 15, 20, 0.25);
      // chequered washi tape across the road
      const tc = canvas(512, 64, (g) => {
        for (let y = 0; y < 4; y++) for (let x = 0; x < 32; x++) { g.fillStyle = (x + y) % 2 ? '#151515' : '#f6f2e8'; g.fillRect(x * 16, y * 16, 16, 16); }
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 0, 512, 64);
      });
      const tape = K.mesh(new T.PlaneGeometry(19, 3.4, 1, 1), K.std({ map: tex(tc), roughness: 0.6, transparent: true, opacity: 0.97 }), p.x, 0.5, p.z, { cast: false });
      tape.rotation.order = 'YXZ'; tape.rotation.y = -p.angle + PI / 2; tape.rotation.x = -PI / 2;
      tape.renderOrder = 3;
    }

    // ============================================================================ prop helpers
    const cupGeo = {
      saucer: K.lathe([[0.01, 0], [5.5, 0], [6, 0.25], [8.6, 0.85], [9.1, 1.25], [8.85, 1.4], [6.2, 0.8], [3.6, 0.62], [0.01, 0.6]], 48),
      cup: K.lathe([[2.4, 0.6], [3.0, 0.62], [3.4, 1.0], [4.5, 3.2], [5.15, 6.4], [5.25, 7.1], [4.9, 7.15], [4.8, 6.4], [4.15, 3.4], [2.9, 1.55], [0.01, 1.4]], 40),
      handle: (() => { const g = new T.TorusGeometry(1.6, 0.42, 10, 20, PI * 1.25); g.rotateZ(-PI * 0.62); return g; })(),
      espresso: K.lathe([[1.8, 0.4], [2.3, 0.42], [2.6, 0.9], [3.3, 3.5], [3.35, 4.6], [3.05, 4.6], [3.0, 3.6], [2.4, 1.2], [0.01, 1.1]], 36),
    };
    const latte = (() => {
      const c = canvas(256, 256, (g) => {
        const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, '#c48a52'); gr.addColorStop(0.75, '#9a5f30'); gr.addColorStop(0.95, '#6a3a1a'); gr.addColorStop(1, '#4a2410');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        // rosetta
        g.fillStyle = '#f6ead6';
        g.beginPath(); g.ellipse(128, 160, 34, 40, 0, 0, TAU); g.fill();
        for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(128, 128 - i * 15, 46 - i * 6, 10, 0, 0, TAU); g.fill(); g.fillStyle = i % 2 ? '#f6ead6' : '#efdcc0'; }
        g.strokeStyle = '#f6ead6'; g.lineWidth = 4; g.beginPath(); g.moveTo(128, 205); g.lineTo(128, 40); g.stroke();
        g.fillStyle = 'rgba(255,240,220,0.25)'; g.beginPath(); g.arc(128, 128, 100, 0, TAU); g.fill();
      });
      return K.phys({ map: tex(c), roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2 });
    })();
    const coffeeDark = K.liquid(0x2a1408, { roughness: 0.05 });
    const coffeeCup = (x, z, ry = 0, { espresso = false } = {}) => {
      const g = new T.Group();
      g.add(new T.Mesh(cupGeo.saucer, white));
      if (espresso) {
        const c = new T.Mesh(cupGeo.espresso, white); c.position.y = 0.6; g.add(c);
        const s = new T.Mesh(new T.CircleGeometry(3.0, 28), coffeeDark); s.rotation.x = -PI / 2; s.position.y = 4.3; g.add(s);
        const h = new T.Mesh(cupGeo.handle, white); h.scale.setScalar(0.62); h.position.set(3.5, 3.4, 0); g.add(h);
      } else {
        const c = new T.Mesh(cupGeo.cup, white); c.position.y = 0.6; g.add(c);
        const s = new T.Mesh(new T.CircleGeometry(4.85, 36), latte); s.rotation.x = -PI / 2; s.rotation.z = r() * 6; s.position.y = 7.0; g.add(s);
        const h = new T.Mesh(cupGeo.handle, white); h.position.set(5.7, 4.8, 0); g.add(h);
      }
      // teaspoon on the saucer
      const sp = new T.Group();
      const bowl = new T.Mesh(new T.SphereGeometry(1, 14, 8), chrome); bowl.scale.set(1.5, 0.3, 0.95); sp.add(bowl);
      const stem = new T.Mesh(new K.RoundedBoxGeometry(7, 0.25, 0.55, 1, 0.1), chrome); stem.position.x = -4.6; sp.add(stem);
      sp.position.set(-1, 1.25, 6.2); sp.rotation.y = 0.15; g.add(sp);
      g.position.set(x, 0, z); g.rotation.y = ry;
      K.add(g);
      AO(x, z, 10, 10, 0.5);
      K.circle(x, z, 8.6, 1.5);
      K.circle(x, z, espresso ? 3.4 : 5.4, espresso ? 5 : 7.6);
      return g;
    };
    // coffee ring stains (instanced decal)
    const rings = [];
    const ringMat = (() => {
      const c = canvas(256, 256, (g) => {
        g.strokeStyle = 'rgba(70,35,12,0.65)'; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 104, 0.4, 5.9); g.stroke();
        g.strokeStyle = 'rgba(70,35,12,0.3)'; g.lineWidth = 16; g.beginPath(); g.arc(128, 128, 96, 0.2, 2.8); g.stroke();
        g.strokeStyle = 'rgba(70,35,12,0.4)'; g.lineWidth = 4; g.beginPath(); g.arc(150, 120, 100, 3.6, 5.4); g.stroke();
      });
      return new T.MeshStandardMaterial({ map: tex(c), transparent: true, depthWrite: false, roughness: 0.6 });
    })();
    const ring = (x, z, s = 1) => rings.push({ x, y: 0.03, z, ry: r() * 6, sx: 12 * s, sy: 1, sz: 12 * s });

    const glassTumbler = (x, z, fill = 0.6) => {
      const prof = [[3.6, 0], [3.9, 0.15], [4.0, 0.6], [4.4, 11], [4.5, 11.3], [4.25, 11.3], [4.15, 11], [3.75, 1.4], [0.01, 1.2]];
      const gl = K.mesh(K.lathe(prof, 40), glassMat, x, 0, z, { cast: false });
      keep.push(gl);
      const wh = 1.3 + fill * 9;
      const w = K.mesh(new T.CylinderGeometry(3.7 + fill * 0.45, 3.72, wh - 1.3, 32), waterMat, x, 1.3 + (wh - 1.3) / 2, z, { cast: false });
      keep.push(w);
      // ice cube and lemon slice
      const ice = K.mesh(new K.RoundedBoxGeometry(2.4, 2.2, 2.4, 2, 0.5), K.phys({ color: 0xffffff, roughness: 0.08, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, depthWrite: false }), x + 0.8, wh - 0.6, z - 0.5, { ry: 0.6, rz: 0.3, cast: false });
      keep.push(ice);
      // condensation droplets
      const drops = [];
      for (let i = 0; i < 70; i++) { const a = r() * TAU, h = 0.8 + r() * (wh - 1.2), rad = 3.95 + h * 0.04; drops.push({ x: x + Math.cos(a) * rad, y: h, z: z + Math.sin(a) * rad, s: r.range(0.06, 0.16) }); }
      A.drops = (A.drops || []).concat(drops);
      AO(x, z, 5.5, 5.5, 0.35);
      K.circle(x, z, 4.3, 11);
      // condensation ring on the lacquer
      const wr = K.mesh(new T.RingGeometry(3.7, 4.25, 40), waterMat, x, 0.02, z, { rx: -PI / 2, cast: false });
      keep.push(wr);
    };

    // tent name card: atlas of names, both faces printed
    const NAMES = ['CEO', 'CFO', 'Head of AI', 'COO', 'Chief Synergy Officer', 'Intern', 'Legal', 'Board Observer'];
    const nameMat = (() => {
      const c = canvas(1024, 1024, (g) => {
        NAMES.forEach((n, k) => {
          const x = (k % 2) * 512, y = Math.floor(k / 2) * 256;
          g.fillStyle = '#fbfaf6'; g.fillRect(x, y, 512, 256);
          g.fillStyle = '#1d2a44'; g.fillRect(x, y + 216, 512, 14);
          g.fillStyle = '#c9a24a'; g.fillRect(x, y + 230, 512, 5);
          g.fillStyle = '#1d2a44'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = `700 ${n.length > 14 ? 50 : n.length > 8 ? 70 : 96}px Georgia, serif`;
          g.fillText(n, x + 256, y + 110);
          g.font = '26px Rubik, Arial, sans-serif'; g.fillStyle = '#6a7284'; g.fillText('SYNERGY PARTNERS', x + 256, y + 180);
        });
      });
      return K.std({ map: tex(c), roughness: 0.7 });
    })();
    const nameCard = (x, z, ry, k) => {
      const W = 22, Hh = 8.5, lean = 0.32;
      const g = new T.Group();
      for (const sd of [-1, 1]) {
        const geo = new T.PlaneGeometry(W, Hh);
        const uv = geo.attributes.uv;
        const cu = (k % 2) * 0.5, cv = Math.floor(k / 2) * 0.25;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, cu + uv.getX(i) * 0.5, 1 - cv - (1 - uv.getY(i)) * 0.25);
        const m = new T.Mesh(geo, nameMat);
        m.position.set(0, Hh / 2 * Math.cos(lean), sd * Hh / 2 * Math.sin(lean));
        m.rotation.x = -sd * lean; if (sd < 0) m.rotation.y = PI;
        g.add(m);
        const back = new T.Mesh(new T.PlaneGeometry(W, Hh), paperMat); back.position.copy(m.position); back.rotation.x = -sd * lean; back.rotation.y = sd < 0 ? 0 : PI; back.position.z -= sd * 0.02; g.add(back);
      }
      g.position.set(x, 0, z); g.rotation.y = ry;
      K.add(g);
      AO(x, z, 12, 4, 0.35, -ry);
      K.box(x, z, W / 2, 2.4, -ry, 8);
    };

    // fountain pen
    const resin = shiny(K.phys({ color: 0x0d0d10, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }), 1);
    const burgundy = shiny(K.phys({ color: 0x4a0e18, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }), 1);
    const pen = (x, z, ry, body = resin) => {
      const g = new T.Group();
      const b = new T.Mesh(K.lathe([[0.01, 0], [0.45, 0.2], [0.72, 1.5], [0.75, 8], [0.7, 9.5], [0.01, 9.6]], 18), body); b.rotation.z = -PI / 2; g.add(b);
      const cap = new T.Mesh(K.lathe([[0.01, 0], [0.62, 0.15], [0.8, 0.8], [0.8, 6.4], [0.5, 6.9], [0.01, 7.0]], 18), body); cap.rotation.z = PI / 2; cap.position.x = 0; g.add(cap);
      const band = new T.Mesh(new T.CylinderGeometry(0.82, 0.82, 0.5, 18), gold); band.rotation.z = PI / 2; band.position.x = -0.6; g.add(band);
      const clip = new T.Mesh(new K.RoundedBoxGeometry(5, 0.25, 0.4, 1, 0.1), gold); clip.position.set(-3.6, 0.85, 0); g.add(clip);
      const nib = new T.Mesh(new T.ConeGeometry(0.45, 2.2, 12), gold); nib.rotation.z = -PI / 2; nib.position.x = 10.3; g.add(nib);
      g.position.set(x, 0.8, z); g.rotation.y = ry;
      K.add(g);
      AO(x + Math.cos(-ry) * 2, z + Math.sin(-ry) * 2, 9.5, 1.2, 0.35, -ry);
    };

    // ============================================================================ ramp: a bound report leaning on a glasses case, onto a closed laptop
    {
      const P = track.at(JUMP.lap), ang = P.angle;
      const dx = Math.cos(ang), dz = Math.sin(ang);
      K.platform(P.x, P.z, JUMP.len / 2, JUMP.wid / 2, ang, JUMP.lapH);
      const rx = P.x - dx * (JUMP.len / 2 + JUMP.rampLen / 2), rz = P.z - dz * (JUMP.len / 2 + JUMP.rampLen / 2);
      K.ramp(rx, rz, ang, JUMP.rampLen, 26, JUMP.rampH, 0);
      // closed laptop: space-grey aluminium with stickers
      const alu = TX.brushedMetalTextures({ size: 256, seed: 7 });
      const lapC = canvas(1024, 720, (g) => {
        g.fillStyle = '#b9bcc3'; g.fillRect(0, 0, 1024, 720);
        // subtle logo-free emboss
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 6; g.beginPath(); g.arc(512, 360, 46, 0, TAU); g.stroke();
        const sticker = (x, y, rot, bg, fg, txt, w = 300, h = 110, round = 20, font = '700 54px "Lilita One", Impact') => {
          g.save(); g.translate(x, y); g.rotate(rot);
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.roundRect(-w / 2 + 4, -h / 2 + 6, w, h, round); g.fill();
          g.fillStyle = bg; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, round); g.fill();
          g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 4);
          g.restore();
        };
        sticker(230, 150, -0.2, '#f6d24a', '#1d2a44', 'AI FIRST');
        sticker(800, 560, 0.15, '#1d2a44', '#ffffff', 'I ♥ KPIs', 280, 110);
        sticker(760, 170, 0.08, '#e8443a', '#ffffff', 'ASK ME ABOUT SYNERGY', 420, 70, 35, '700 34px Rubik, Arial');
        sticker(250, 560, -0.1, '#2fae5a', '#ffffff', 'Q3 ✓', 180, 180, 90);
      });
      const lapTop = shiny(K.std({ map: tex(lapC), roughness: 0.38, metalness: 0.45, roughnessMap: alu.roughnessMap }), 0.8);
      lapTop.map.center.set(0.5, 0.5); lapTop.map.rotation = PI / 2;
      const lapSide = shiny(K.std({ color: 0xb9bcc3, roughness: 0.32, metalness: 0.7, normalMap: alu.normalMap }), 0.9);
      const lg = new K.RoundedBoxGeometry(JUMP.len, JUMP.lapH, JUMP.wid, 3, 0.7);
      const lap = K.mesh(lg, [lapSide, lapSide, lapTop, lapSide, lapSide, lapSide], P.x, JUMP.lapH / 2, P.z, { ry: -ang });
      // dark seam and rubber feet line
      K.mesh(new T.BoxGeometry(JUMP.len - 0.9, 0.16, JUMP.wid + 0.08), blackMatte, P.x, JUMP.lapH * 0.42, P.z, { ry: -ang, cast: false });
      AO(P.x, P.z, JUMP.len / 2 + 2.5, JUMP.wid / 2 + 2.5, 0.5, ang);
      // a sticky note stuck on the laptop lid, continuing the trail
      // the report ramp
      const repC = canvas(512, 720, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, 720); gr.addColorStop(0, '#1c2b4a'); gr.addColorStop(1, '#13203a');
        g.fillStyle = gr; g.fillRect(0, 0, 512, 720);
        g.strokeStyle = '#d9b264'; g.lineWidth = 6; g.strokeRect(30, 30, 452, 660);
        g.fillStyle = '#e6c27a'; g.textAlign = 'center'; g.font = '700 70px Georgia, serif';
        g.fillText('STRATEGY', 256, 300); g.fillText('2027', 256, 380);
        g.font = '24px Rubik, Arial'; g.fillText('Bold. Agile. Slightly late.', 256, 450);
        g.fillStyle = '#e8443a'; g.font = '700 26px Rubik, Arial'; g.fillText('CONFIDENTIAL', 256, 640);
      });
      const cover = K.std({ map: tex(repC), roughness: 0.45 });
      const pages = K.std({ color: 0xf2ece0, roughness: 0.9 });
      const rlen = Math.hypot(JUMP.rampLen, JUMP.rampH) + 0.4;
      const rep = new T.Group();
      const body = new T.Mesh(new T.BoxGeometry(rlen, 1.6, 27), [pages, pages, cover, pages, pages, pages]);
      body.position.y = -0.8; body.rotation.y = 0;
      // cover texture: rotate so the title reads along the ramp
      rep.add(body);
      rep.position.set(rx, JUMP.rampH / 2, rz);
      rep.rotation.order = 'YZX'; rep.rotation.y = -ang; rep.rotation.z = Math.atan2(JUMP.rampH, JUMP.rampLen);
      K.add(rep);
      const tex2 = body.material[2].map; tex2.center.set(0.5, 0.5); tex2.rotation = PI / 2;
      // glasses case under the top end
      const gx = rx + dx * (JUMP.rampLen / 2 - 3.4), gz = rz + dz * (JUMP.rampLen / 2 - 3.4);
      const gc = K.mesh(new K.RoundedBoxGeometry(6, 2.6, 17, 3, 1.2), K.phys({ color: 0x5a1e14, roughness: 0.4, clearcoat: 0.6 }), gx, 1.3, gz, { ry: -ang });
      AO(rx, rz, JUMP.rampLen / 2 + 1, 14, 0.42, ang);
      A.lapTop = { x: P.x, z: P.z, ang };
    }

    // ============================================================================ open laptop on the north side: the Q3 slides
    {
      const cx = 98, cz = -82, ang = 0.06;
      const g = new T.Group();
      const bodyM = shiny(K.std({ color: 0x9a9da4, roughness: 0.32, metalness: 0.85 }), 0.9);
      const base = new T.Mesh(new K.RoundedBoxGeometry(36, 1.4, 25, 3, 0.6), bodyM); base.position.y = 0.7; g.add(base);
      const kb = canvas(512, 360, (gg) => {
        gg.fillStyle = '#8f9299'; gg.fillRect(0, 0, 512, 360);
        gg.fillStyle = '#1a1b1e'; gg.fillRect(40, 20, 432, 180);
        gg.fillStyle = '#2c2e33';
        for (let row = 0; row < 6; row++) for (let k = 0; k < 14; k++) gg.fillRect(46 + k * 30.5, 26 + row * 29, 26, 24);
        gg.fillStyle = '#9da0a7'; gg.fillRect(160, 220, 192, 120);
        gg.strokeStyle = 'rgba(0,0,0,0.2)'; gg.lineWidth = 2; gg.strokeRect(160, 220, 192, 120);
      });
      const deck = new T.Mesh(new T.PlaneGeometry(34.5, 23.5), K.std({ map: tex(kb), roughness: 0.55, metalness: 0.3 }));
      deck.rotation.x = -PI / 2; deck.rotation.z = PI; deck.position.set(0, 1.42, 0); g.add(deck);
      // lid with the slide deck (3 slides stacked in one texture, flipped through in animate)
      const lid = new T.Group(); lid.position.set(0, 1.3, -12.2); lid.rotation.x = -0.32; g.add(lid);
      const lidB = new T.Mesh(new K.RoundedBoxGeometry(36, 24, 0.6, 3, 0.25), bodyM); lidB.position.set(0, 12, -0.3); lid.add(lidB);
      const slides = canvas(512, 1024, (gg) => {
        const slide = (y0, title, fn) => {
          gg.save(); gg.translate(0, y0);
          gg.fillStyle = '#f8f7f3'; gg.fillRect(0, 0, 512, 320);
          gg.fillStyle = '#1d2a44'; gg.fillRect(0, 0, 512, 52);
          gg.fillStyle = '#ffffff'; gg.font = '700 30px Georgia, serif'; gg.textAlign = 'left'; gg.fillText(title, 20, 36);
          fn(); gg.restore();
        };
        slide(0, 'Q3 Revenue', () => {
          const h = [60, 85, 110, 150, 205];
          h.forEach((v, i) => { gg.fillStyle = i === 4 ? '#e8a33a' : '#3a6fd8'; gg.fillRect(60 + i * 86, 290 - v, 56, v); });
          gg.strokeStyle = '#e8443a'; gg.lineWidth = 5; gg.beginPath(); gg.moveTo(80, 220); gg.lineTo(420, 70); gg.stroke();
          gg.fillStyle = '#e8443a'; gg.beginPath(); gg.moveTo(430, 64); gg.lineTo(404, 66); gg.lineTo(418, 88); gg.fill();
          gg.fillStyle = '#1d2a44'; gg.font = '700 26px Rubik, Arial'; gg.fillText('+412%*', 330, 120);
          gg.font = '14px Rubik, Arial'; gg.fillStyle = '#6a7284'; gg.fillText('*projected, optimistic', 330, 140);
        });
        slide(340, 'Synergy Matrix', () => {
          gg.strokeStyle = '#1d2a44'; gg.lineWidth = 3; gg.strokeRect(70, 80, 370, 210); gg.beginPath(); gg.moveTo(255, 80); gg.lineTo(255, 290); gg.moveTo(70, 185); gg.lineTo(440, 185); gg.stroke();
          const lab = [['Quick wins', 90, 130], ['Big bets', 280, 130], ['Meetings', 90, 240], ['More meetings', 270, 240]];
          gg.font = '700 24px Rubik, Arial'; gg.fillStyle = '#3a6fd8'; lab.forEach(([t, x, y]) => gg.fillText(t, x, y));
          gg.fillStyle = '#e8a33a'; gg.beginPath(); gg.arc(390, 110, 12, 0, TAU); gg.fill();
        });
        slide(680, 'Next Steps', () => {
          gg.fillStyle = '#1d2a44'; gg.font = '26px Rubik, Arial';
          ['• Align on alignment', '• Circle back', '• Win the race', '• Lunch'].forEach((t, i) => gg.fillText(t, 50, 110 + i * 46));
        });
      });
      const st = tex(slides); st.repeat.set(1, 320 / 1024); st.offset.set(0, 1 - 320 / 1024);
      const screen = new T.Mesh(new T.PlaneGeometry(33, 20.6), K.std({ color: 0x000000, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 1.25, roughness: 0.2 }));
      screen.position.set(0, 12.6, 0.02); lid.add(screen);
      const bez = new T.Mesh(new T.PlaneGeometry(35, 23.2), blackGloss); bez.position.set(0, 12.2, 0.01); lid.add(bez);
      g.position.set(cx, 0, cz); g.rotation.y = ang;
      K.add(g);
      keep.push(screen);
      A.slides = { tex: st, k: 0 };
      AO(cx, cz, 20, 14, 0.5, -ang);
      K.box(cx, cz, 18, 12.5, -ang, 2);
      K.box(cx, cz - 12.5, 18, 2, -ang, 24);
      // the screen's glow spilling onto the table
      const glow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x9ab8ff, transparent: true, opacity: 0.12, alphaMap: TX.blobShadowTexture(), depthWrite: false, blending: T.AdditiveBlending }));
      glow.rotation.x = -PI / 2; glow.scale.set(34, 9, 1); glow.position.set(cx, 0.05, cz + 15.5); K.group.add(glow);
      // presentation clicker beside it
      const ck = new T.Group();
      const cb = new T.Mesh(new K.RoundedBoxGeometry(10, 1.4, 3, 3, 0.6), graphite); cb.position.y = 0.7; ck.add(cb);
      for (const [bx, col] of [[1.5, 0x3a3c42], [-1.4, 0x3a3c42]]) { const b = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 0.3, 14), K.plastic(col)); b.position.set(bx, 1.45, 0); ck.add(b); }
      const lz = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 0.3, 10), K.std({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 2 })); lz.rotation.z = PI / 2; lz.position.set(5.05, 0.8, 0); ck.add(lz);
      ck.position.set(cx - 30, 0, cz + 4); ck.rotation.y = 0.4; K.add(ck);
      AO(cx - 30, cz + 4, 6, 2.5, 0.4, -0.4);
    }

    // ============================================================================ the spinning conference speakerphone in the U
    {
      const { x: cx, z: cz, R } = SPK;
      const arm = (a) => [Math.cos(a), Math.sin(a)];
      const sh = new T.Shape();
      const pts = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        const [c1, s1] = arm(a), [c2, s2] = arm(a + PI / 3);
        pts.push([c1 * (R - 3.2), s1 * (R - 3.2), a]);
        pts.push([c2 * 7.5, s2 * 7.5, null]);
      }
      // arms with rounded tips (shape coords: x, -z)
      for (let i = 0; i < 6; i++) {
        const [x, z, a] = pts[i];
        if (a != null) {
          if (i === 0) sh.moveTo(x + Math.cos(a - PI / 2) * 3.2, -(z + Math.sin(a - PI / 2) * 3.2));
          else sh.lineTo(x + Math.cos(a - PI / 2) * 3.2, -(z + Math.sin(a - PI / 2) * 3.2));
          for (let k = 1; k <= 8; k++) { const b = a - PI / 2 + (k / 8) * PI; sh.lineTo(x + Math.cos(b) * 3.2, -(z + Math.sin(b) * 3.2)); }
        } else sh.lineTo(x, -z);
      }
      sh.closePath();
      const g = new T.ExtrudeGeometry(sh, { depth: 3.4, bevelEnabled: true, bevelThickness: 1.1, bevelSize: 1.1, bevelSegments: 4, curveSegments: 6 });
      g.rotateX(-PI / 2); g.translate(0, 1.1, 0);
      const grp = new T.Group();
      const body = new T.Mesh(g, graphite); grp.add(body);
      // grille on top
      const gc = canvas(512, 512, (gg) => {
        gg.fillStyle = '#26282d'; gg.fillRect(0, 0, 512, 512);
        gg.fillStyle = '#121316';
        for (let y = 8; y < 512; y += 12) for (let x = 8 + ((y / 12) % 2) * 6; x < 512; x += 12) { gg.beginPath(); gg.arc(x, y, 3.2, 0, TAU); gg.fill(); }
      });
      const gt = tex(gc);
      const top = new T.Mesh(new T.ShapeGeometry(sh, 6), K.std({ map: gt, roughness: 0.6 }));
      top.rotation.x = -PI / 2; top.position.y = 5.62;
      const tuv = top.geometry.attributes.uv, tpos = top.geometry.attributes.position;
      for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tpos.getX(i) / (2 * R) + 0.5, tpos.getY(i) / (2 * R) + 0.5);
      grp.add(top);
      // centre display + LED ring
      const disp = new T.Mesh(new T.CylinderGeometry(5.6, 6, 0.8, 40), blackGloss); disp.position.y = 6.0; grp.add(disp);
      const ledMat = K.std({ color: 0x062a14, emissive: 0x2cff7a, emissiveIntensity: 1.6, roughness: 0.3 });
      const led = new T.Mesh(new T.TorusGeometry(4.8, 0.32, 8, 48), ledMat); led.rotation.x = -PI / 2; led.position.y = 6.45; grp.add(led);
      const lcd = canvas(256, 128, (gg) => { gg.fillStyle = '#0a1a12'; gg.fillRect(0, 0, 256, 128); gg.fillStyle = '#7dffb0'; gg.font = '700 40px Rubik, Arial'; gg.textAlign = 'center'; gg.fillText('ON MUTE?', 128, 60); gg.font = '24px Rubik, Arial'; gg.fillText('03:17:42', 128, 100); });
      const lcdM = new T.Mesh(new T.PlaneGeometry(6.4, 3.2), K.std({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex(lcd), emissiveIntensity: 0.9 }));
      lcdM.rotation.x = -PI / 2; lcdM.position.y = 6.42; grp.add(lcdM);
      // tip LEDs (mic arms)
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; const t = new T.Mesh(new T.SphereGeometry(0.55, 10, 8), ledMat); t.position.set(Math.cos(a) * (R - 3.4), 5.7, Math.sin(a) * (R - 3.4)); grp.add(t); }
      grp.position.set(cx, 0, cz);
      K.add(grp);
      keep.push(grp);
      // cable to a floor box
      const cab = new T.CatmullRomCurve3([new T.Vector3(cx, 0.6, cz), new T.Vector3(cx - 8, 0.5, cz - 10), new T.Vector3(cx - 4, 0.5, cz - 26), new T.Vector3(cx + 2, 0.5, cz - 36)]);
      K.mesh(new T.TubeGeometry(cab, 32, 0.45, 6), blackMatte, 0, 0, 0);
      AO(cx, cz, R + 2, R + 2, 0.45);
      A.spk = { grp, led: ledMat, hits: [] };
      K.circle(cx, cz, 7.5, 6.5);
      for (let i = 0; i < 3; i++) {
        const mv = K.mover({ type: 'capsule', r: 3.2, h: 6 }, (t) => {
          const a = t * SPK.w + (i / 3) * TAU;
          return { x1: cx + Math.cos(a) * 5, z1: cz + Math.sin(a) * 5, x2: cx + Math.cos(a) * (R - 3.2), z2: cz + Math.sin(a) * (R - 3.2) };
        });
        mv.kick = 18; mv.bounce = 0.4;
        A.spk.hits.push(mv);
      }
    }

    // ============================================================================ the phone on vibrate (west straight)
    {
      const B = track.at(PHONE.s);
      A.phoneBase = B;
      K.mover({ type: 'box', hw: PHONE.hw, hd: PHONE.hd, h: 1.4 }, (t) => { const q = phonePose(t, B); return { x: q.x, z: q.z, angle: q.angle }; });
      const g = new T.Group();
      const body = new T.Mesh(new K.RoundedBoxGeometry(PHONE.hw * 2, 1.0, PHONE.hd * 2, 4, 0.45), shiny(K.phys({ color: 0x23262c, roughness: 0.25, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.05 }), 1));
      body.position.y = 0.5; g.add(body);
      const scr = canvas(512, 256, (gg) => {
        const gr = gg.createLinearGradient(0, 0, 512, 256); gr.addColorStop(0, '#1a3a7a'); gr.addColorStop(1, '#3a1a5a');
        gg.fillStyle = gr; gg.fillRect(0, 0, 512, 256);
        gg.fillStyle = '#ffffff'; gg.textAlign = 'center';
        gg.font = '22px Rubik, Arial'; gg.fillText('incoming call…', 256, 52);
        gg.font = '700 52px Rubik, Arial'; gg.fillText('The Board', 256, 116);
        gg.fillStyle = '#e8443a'; gg.beginPath(); gg.arc(140, 190, 32, 0, TAU); gg.fill();
        gg.fillStyle = '#2fae5a'; gg.beginPath(); gg.arc(372, 190, 32, 0, TAU); gg.fill();
        gg.fillStyle = '#fff'; gg.font = '18px Rubik, Arial'; gg.fillText('Decline', 140, 245); gg.fillText('Accept', 372, 245);
      });
      const scrMat = K.std({ color: 0x050608, emissive: 0xffffff, emissiveMap: tex(scr), emissiveIntensity: 0, roughness: 0.1, metalness: 0.2 });
      const sm = new T.Mesh(new T.PlaneGeometry(PHONE.hw * 2 - 1.2, PHONE.hd * 2 - 1.0), scrMat);
      sm.rotation.x = -PI / 2; sm.position.y = 1.02; g.add(sm);
      const shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      shadow.rotation.x = -PI / 2; shadow.scale.set(PHONE.hw * 2 + 3, PHONE.hd * 2 + 3, 1); shadow.position.y = 0.04; shadow.renderOrder = 1; g.add(shadow);
      K.add(g);
      shadow.castShadow = false;
      keep.push(g);
      A.phone = { g, scrMat, B, lastStep: -1 };
    }

    // ============================================================================ laser pointer dot (presenter off to the east)
    {
      const dotTex = canvas(128, 128, (g) => {
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,90,80,1)'); gr.addColorStop(0.35, 'rgba(255,20,20,0.45)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      });
      const dm = new T.MeshBasicMaterial({ map: tex(dotTex), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false });
      const dot = new T.Mesh(new T.PlaneGeometry(1, 1), dm); dot.rotation.x = -PI / 2; dot.scale.set(5.5, 5.5, 1); dot.renderOrder = 5;
      K.group.add(dot);
      const beamMat = new T.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.16, depthWrite: false, blending: T.AdditiveBlending, fog: false });
      const beam = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 1, 6, 1, true), beamMat); beam.renderOrder = 5;
      K.group.add(beam);
      A.laser = { dot, beam, src: new T.Vector3(250, 95, 70), x: 0, z: 0 };
      keep.push(dot, beam);
    }

    // ============================================================================ hazards
    // coffee spill (sticky) on the up-leg of the U, with a toppled espresso cup
    {
      const q = track.place(624, -4.4);
      const mat = shiny(K.liquid(0x3a1c0a, { roughness: 0.06 }), 1.2);
      const sp = K.spill(q.x, q.z, 5.4, mat, { lump: 0.4, stretch: 1.45, angle: q.angle + 0.1, y: 0.1, thick: 0.18 });
      K.surface('sticky', { poly: sp.poly });
      const c = track.place(612, -14);
      const cup = new T.Group();
      const cm = new T.Mesh(cupGeo.espresso, white); cup.add(cm);
      const hm = new T.Mesh(cupGeo.handle, white); hm.scale.setScalar(0.62); hm.position.set(3.5, 3.4, 0); cup.add(hm);
      cup.rotation.order = 'YXZ'; cup.position.set(c.x, 3.2, c.z); cup.rotation.y = -q.angle - 0.8; cup.rotation.x = PI / 2 - 0.12;
      K.add(cup);
      K.circle(c.x, c.z, 3.6, 6);
      AO(c.x, c.z, 4.5, 4, 0.45);
      // trail of drips from the cup to the spill
      for (let k = 1; k < 4; k++) K.spill(lerp(c.x, q.x, k / 4) + r.range(-1, 1), lerp(c.z, q.z, k / 4) + r.range(-1, 1), r.range(0.7, 1.4), mat, { y: 0.06, thick: 0.1, n: 18 });
      const saucer = new T.Mesh(cupGeo.saucer, white); saucer.scale.setScalar(0.72); saucer.position.set(c.x - 6, 0, c.z - 7); K.add(saucer);
      AO(c.x - 6, c.z - 7, 7, 7, 0.4);
      // a sugar sachet
      ring(c.x - 6, c.z + 6, 0.8);
    }
    // condensation puddle (slick) by a sweating water glass on the north straight
    {
      const q = track.place(378, -3);
      const sp = K.spill(q.x, q.z, 6.6, waterMat, { lump: 0.38, stretch: 1.5, angle: q.angle, y: 0.1, thick: 0.12 });
      keep.push(sp.mesh);
      K.surface('slick', { poly: sp.poly });
      // tiny bright droplets around it
      const gq = track.place(378, -15);
      glassTumbler(gq.x, gq.z, 0.55);
      for (let k = 0; k < 5; k++) { const d = track.place(378 + r.range(-10, 10), r.range(-8, 6)); keep.push(K.spill(d.x, d.z, r.range(0.4, 0.9), waterMat, { y: 0.06, thick: 0.08, n: 14 }).mesh); }
    }
    // spilled paper clips (rough) on the NW corner, from a tipped-over box
    {
      const q = track.place(706, 0);
      const poly = [];
      for (let k = 0; k < 20; k++) { const a = (k / 20) * TAU; const rr = 9.5 * (1 + 0.18 * Math.sin(a * 3 + 1)); poly.push([q.x + Math.cos(a) * rr * 1.25, q.z + Math.sin(a) * rr]); }
      K.surface('rough', { poly });
      const bx = track.place(712, 15);
      const boxC = canvas(256, 128, (g) => { g.fillStyle = '#2f6fe0'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#fff'; g.font = '700 34px Rubik, Arial'; g.textAlign = 'center'; g.fillText('CLIPS', 128, 58); g.font = '18px Rubik, Arial'; g.fillText('100 pcs · No. 3', 128, 92); });
      const bm = K.std({ map: tex(boxC), roughness: 0.6 });
      const side = K.std({ color: 0x2a62cc, roughness: 0.6 });
      const box = K.mesh(new T.BoxGeometry(9, 3.4, 5.6), [side, side, bm, side, side, side], bx.x, 2.8, bx.z, { ry: -q.angle + 0.6, rz: 0.0 });
      box.rotation.order = 'YXZ'; box.rotation.x = 0; box.rotation.z = PI / 2 - 0.05; box.position.y = 2.8;
      AO(bx.x, bx.z, 6, 5, 0.4);
      K.circle(bx.x, bx.z, 4.6, 6);
      const clipC = canvas(128, 32, (g) => { g.strokeStyle = '#ddd'; g.lineWidth = 3; g.beginPath(); g.moveTo(20, 20); g.lineTo(113, 20); g.arc(113, 14, 6, PI / 2, -PI / 2, true); g.lineTo(11, 8); g.arc(11, 16, 8, -PI / 2, PI / 2, true); g.lineTo(100, 24); g.arc(100, 18, 6, PI / 2, -PI / 2, true); g.lineTo(30, 12); g.stroke(); });
      const cm = shiny(K.std({ map: tex(clipC), alphaTest: 0.35, metalness: 0.95, roughness: 0.22, side: T.DoubleSide }), 1.4);
      const cg = new T.PlaneGeometry(4.2, 1.05); cg.rotateX(-PI / 2);
      const list = [];
      for (let k = 0; k < 90; k++) {
        const t = Math.pow(r(), 0.7);
        const x = lerp(bx.x, q.x, t) + r.gauss() * (2 + t * 6), z = lerp(bx.z, q.z, t) + r.gauss() * (2 + t * 6);
        list.push({ x, y: 0.12 + r() * 0.15, z, ry: r() * TAU, rx: r.range(-0.15, 0.15), rz: r.range(-0.15, 0.15), color: r() < 0.2 ? 0xffd47a : 0xffffff });
      }
      K.instances(cg, cm, list, { colors: true, cast: false });
    }
    // cable grommet: a hole at the apex of the east hairpin
    {
      K.hole(HOLE.x, HOLE.z, HOLE.r);
      K.mesh(new T.TorusGeometry(HOLE.r + 0.35, 0.45, 10, 40), steel, HOLE.x, 0.05, HOLE.z, { rx: PI / 2, cast: false });
      const hm = K.mesh(new T.CircleGeometry(HOLE.r, 32), new T.MeshBasicMaterial({ color: 0x000000 }), HOLE.x, 0.03, HOLE.z, { rx: -PI / 2, cast: false });
      // brush bristles
      const br = [];
      for (let k = 0; k < 60; k++) { const a = r() * TAU, d = r.range(0.8, HOLE.r); br.push({ x: HOLE.x + Math.cos(a) * d, y: -0.4, z: HOLE.z + Math.sin(a) * d, s: 0.12, sy: 3, ry: a }); }
      K.instances(new T.CylinderGeometry(0.4, 0.4, 0.4, 4), K.std({ color: 0x111111, roughness: 0.9 }), br, { cast: false });
      void hm;
      // a cable snaking out of it
      const cab = new T.CatmullRomCurve3([new T.Vector3(HOLE.x - 1, -1, HOLE.z + 1), new T.Vector3(HOLE.x - 2.5, 0.5, HOLE.z + 2), new T.Vector3(HOLE.x - 10, 0.5, HOLE.z + 8), new T.Vector3(HOLE.x - 24, 0.5, HOLE.z + 6)]);
      K.mesh(new T.TubeGeometry(cab, 24, 0.45, 6), K.std({ color: 0xf2f2f2, roughness: 0.5 }), 0, 0, 0);
    }

    // ============================================================================ landmarks and props
    // water carafe with two glasses in the east infield
    {
      const cx = 112, cz = 8;
      const prof = [[4.8, 0], [5.6, 0.3], [6.4, 1.2], [6.6, 10], [5.6, 16], [3.0, 21], [2.7, 25], [3.1, 26.4], [2.9, 26.6], [2.5, 25.2], [2.6, 21], [5.2, 16], [6.2, 10], [6.0, 1.4], [0.01, 1.2]];
      K.mesh(K.lathe(prof, 48), glassMat, cx, 0, cz, { cast: false }).renderOrder = 2;
      const w = K.mesh(K.lathe([[0.01, 1.3], [5.95, 1.3], [6.15, 10], [5.4, 15], [0.01, 15]], 40), waterMat, cx, 0, cz, { cast: false });
      keep.push(w);
      // lemon slices
      const lem = K.std({ color: 0xf2d34a, roughness: 0.4, emissive: 0x403000 });
      for (let k = 0; k < 3; k++) K.mesh(new T.CylinderGeometry(2.0, 2.0, 0.3, 20), lem, cx + r.range(-2, 2), 4 + k * 3, cz + r.range(-2, 2), { rx: r.range(-1, 1), rz: r.range(-1, 1), cast: false });
      AO(cx, cz, 8.5, 8.5, 0.45);
      K.circle(cx, cz, 6.6, 26);
      // the carafe's caustic: a bright warm patch in its shadow direction
      const caus = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.22, alphaMap: TX.blobShadowTexture(), depthWrite: false, blending: T.AdditiveBlending }));
      caus.rotation.x = -PI / 2; caus.rotation.z = -0.9; caus.scale.set(16, 7, 1); caus.position.set(cx + 10, 0.04, cz + 12); K.group.add(caus);
      glassTumbler(cx - 14, cz + 8, 0.7);
      glassTumbler(cx + 4, cz + 17, 0.35);
      ring(cx - 2, cz + 24, 0.9);
    }
    // bowl of mints (glass) south of the U, pushable mints on the hairpin
    {
      const cx = -28, cz = 50;
      K.mesh(K.lathe([[3.5, 0], [4.2, 0.3], [6.5, 2], [8.2, 4.6], [8.4, 4.9], [8.0, 4.9], [6.2, 2.4], [0.01, 1.2]], 40), glassMat, cx, 0, cz, { cast: false }).renderOrder = 2;
      const mintC = canvas(128, 128, (g) => {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 8; i++) { g.fillStyle = '#d8202a'; g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 64, (i / 8) * TAU, (i / 8) * TAU + 0.32); g.closePath(); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(64, 64, 14, 0, TAU); g.fill();
      });
      const mintMat = K.phys({ map: tex(mintC), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 });
      const mintGeo = new T.CylinderGeometry(1.25, 1.25, 0.7, 24);
      const ml = [];
      for (let k = 0; k < 26; k++) { const a = r() * TAU, d = Math.sqrt(r()) * 5.6; ml.push({ x: cx + Math.cos(a) * d, y: 1.6 + r() * 2.6, z: cz + Math.sin(a) * d, rx: r.range(-0.8, 0.8), rz: r.range(-0.8, 0.8), ry: r() * 6 }); }
      K.instances(mintGeo, mintMat, ml);
      AO(cx, cz, 9, 9, 0.4);
      K.circle(cx, cz, 8.4, 5);
      for (const [s, off] of [[566, 2.5], [576, -3], [150, 3], [438, 2]]) {
        const q = track.place(s, off);
        const m = K.mesh(mintGeo, mintMat, q.x, 0.35, q.z, { ry: r() * 6, cast: false });
        K.physics.addDynamic({ x: q.x, z: q.z, r: 1.3, m: 0.25, h: 0.7, mesh: m, slide: true, friction: 14, baseY: 0.35 });
        keep.push(m);
      }
      for (const [x, z] of [[-17, 47]]) { const m = K.mesh(mintGeo, mintMat, x, 0.35, z, { ry: r() * 6, cast: false }); K.physics.addDynamic({ x, z, r: 1.3, m: 0.25, h: 0.7, mesh: m, slide: true, friction: 14, baseY: 0.35 }); keep.push(m); }
    }
    // stress ball: a little globe "GLOBAL STRATEGY" (pushable, rolls)
    {
      const gc = canvas(512, 256, (g) => {
        g.fillStyle = '#2a6fc9'; g.fillRect(0, 0, 512, 256);
        const rr = K.rng(3);
        g.fillStyle = '#4fbf6a';
        for (let i = 0; i < 9; i++) { const x = rr() * 512, y = 50 + rr() * 156; g.beginPath(); for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, d = 20 + rr() * 30; g.lineTo(x + Math.cos(a) * d * 1.4, y + Math.sin(a) * d); } g.fill(); }
        g.fillStyle = '#ffffff'; g.font = '700 30px Rubik, Arial'; g.textAlign = 'center'; g.fillText('GLOBAL STRATEGY', 256, 136);
      });
      const gm = K.phys({ map: tex(gc, { wrap: true }), roughness: 0.55, clearcoat: 0.3 });
      for (const [s, off] of [[332, 3.5], [858, -3]]) {
        const q = track.place(s, off);
        const m = K.mesh(new T.SphereGeometry(3.0, 32, 20), gm, q.x, 3.0, q.z);
        K.physics.addDynamic({ x: q.x, z: q.z, r: 3.0, m: 1.2, h: 6, mesh: m, friction: 4, baseY: 3.0 });
        keep.push(m);
      }
    }
    // tablet with a dashboard (east infield)
    {
      const cx = 70, cz = -14, ang = -0.35;
      const dc = canvas(512, 360, (g) => {
        g.fillStyle = '#0f1724'; g.fillRect(0, 0, 512, 360);
        g.fillStyle = '#e8eef8'; g.font = '700 24px Rubik, Arial'; g.fillText('Executive Dashboard', 20, 36);
        const tile = (x, y, w, h, t, v, col) => { g.fillStyle = '#1b2638'; g.fillRect(x, y, w, h); g.fillStyle = '#8aa0c0'; g.font = '14px Rubik, Arial'; g.fillText(t, x + 10, y + 22); g.fillStyle = col; g.font = '700 34px Rubik, Arial'; g.fillText(v, x + 10, y + 62); };
        tile(20, 56, 150, 80, 'Synergy index', '97%', '#4fdc8a'); tile(182, 56, 150, 80, 'Meetings / day', '11', '#ffb84a'); tile(344, 56, 150, 80, 'Coffee', 'CRITICAL', '#ff6a5a');
        g.fillStyle = '#1b2638'; g.fillRect(20, 150, 474, 190);
        g.strokeStyle = '#4f8cff'; g.lineWidth = 4; g.beginPath(); for (let i = 0; i <= 20; i++) { const x = 40 + i * 22, y = 310 - i * 7 - Math.sin(i * 0.9) * 18; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
        g.strokeStyle = '#4fdc8a'; g.beginPath(); for (let i = 0; i <= 20; i++) { const x = 40 + i * 22, y = 300 - Math.pow(i, 1.6) * 3.5; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      });
      const g = new T.Group();
      const b = new T.Mesh(new K.RoundedBoxGeometry(26, 0.8, 18.5, 3, 0.35), shiny(K.std({ color: 0x2a2c30, metalness: 0.8, roughness: 0.3 }), 1)); b.position.y = 0.4; g.add(b);
      const sc = new T.Mesh(new T.PlaneGeometry(24.4, 17), K.std({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex(dc), emissiveIntensity: 0.95, roughness: 0.08, metalness: 0.1 }));
      sc.rotation.x = -PI / 2; sc.position.y = 0.82; g.add(sc);
      g.position.set(cx, 0, cz); g.rotation.y = ang; K.add(g);
      AO(cx, cz, 14.5, 10.5, 0.45, -ang);
      K.box(cx, cz, 13, 9.3, -ang, 1.2);
      pen(cx + 2, cz + 15, 0.3, burgundy);
    }
    // stack of bound reports + binders near the north edge
    {
      const covers = [['#4a1018', 'Q3 REVIEW', 'CONFIDENTIAL'], ['#1c2b4a', 'SYNERGY', 'PARTNERS · Annual Report'], ['#24352a', 'BLUE SKY', 'Thinking, vol. II'], ['#2a2a2e', 'KPI', 'Handbook (abridged)']];
      const mats = covers.map(([bg, t1, t2]) => K.std({
        roughness: 0.5, map: tex(canvas(512, 360, (g) => {
          g.fillStyle = bg; g.fillRect(0, 0, 512, 360); g.strokeStyle = '#d9b264'; g.lineWidth = 4; g.strokeRect(20, 20, 472, 320);
          g.fillStyle = '#e6c27a'; g.textAlign = 'center'; g.font = '700 58px Georgia, serif'; g.fillText(t1, 256, 170); g.font = '24px Rubik, Arial'; g.fillText(t2, 256, 220);
        })),
      }));
      const pagesM = K.std({ color: 0xf0ead8, roughness: 0.9 });
      const stack = (cx, cz, n, ang0) => {
        let y = 0;
        for (let k = 0; k < n; k++) {
          const h = r.range(1.2, 2.2);
          const m = K.mesh(new T.BoxGeometry(30, h, 21), [pagesM, pagesM, k === n - 1 ? mats[(k + n + cx | 0) & 3] : pagesM, pagesM, pagesM, pagesM], cx + r.range(-1, 1), y + h / 2, cz + r.range(-1, 1), { ry: ang0 + r.range(-0.12, 0.12) });
          y += h;
        }
        AO(cx, cz, 18, 13, 0.5, -ang0);
        K.box(cx, cz, 15.5, 11, -ang0, y);
        return y;
      };
      const y1 = stack(-36, -84, 4, 0.08);
      pen(-36, -84, 0.5);
      void y1;
      stack(150, 60, 2, -0.5);
      // upright binders at the north-west edge, spines facing the room
      const spines = canvas(512, 512, (g) => {
        const labs = ['Q1', 'Q2', 'Q3', 'Q4', 'LEGAL', 'KPIs'];
        labs.forEach((t, k) => {
          const x = k * 85;
          g.fillStyle = ['#1c2b4a', '#4a1018', '#24352a', '#1c2b4a', '#2a2a2e', '#7a5a1a'][k]; g.fillRect(x, 0, 85, 512);
          g.fillStyle = '#f4efe2'; g.fillRect(x + 12, 60, 61, 150);
          g.fillStyle = '#1c1c22'; g.font = '700 34px Rubik, Arial'; g.textAlign = 'center'; g.fillText(t, x + 42, 150);
          g.fillStyle = '#c9ccd2'; g.beginPath(); g.arc(x + 42, 400, 18, 0, TAU); g.fill();
          g.fillStyle = '#111'; g.beginPath(); g.ellipse(x + 42, 400, 8, 14, 0, 0, TAU); g.fill();
        });
      });
      const spineMat = K.std({ map: tex(spines), roughness: 0.55 });
      const coverM = K.std({ color: 0x23252a, roughness: 0.6 });
      for (let k = 0; k < 6; k++) {
        const x = -150 + k * 8.4, z = -86;
        const geo = new T.BoxGeometry(8, 30, 24);
        const uv = geo.attributes.uv;
        // +z face (index 4) gets its slice of the spine atlas
        for (let i = 16; i < 20; i++) uv.setXY(i, (k + uv.getX(i)) * 85 / 512, uv.getY(i));
        const m = K.mesh(geo, [coverM, coverM, coverM, coverM, spineMat, coverM], x, 15, z, { ry: r.range(-0.03, 0.03) });
        void m;
      }
      AO(-129, -86, 28, 14, 0.5);
      K.box(-129, -86, 25.5, 12, 0, 30);
    }
    // orchid in a white pot at the north edge (tall)
    {
      const cx = -8, cz = -86;
      K.mesh(K.lathe([[0.01, 0], [5.0, 0], [5.6, 0.6], [6.4, 10], [6.6, 11.4], [6.0, 11.4], [5.8, 10.5], [0.01, 10.2]], 40), white, cx, 0, cz);
      K.mesh(new T.CircleGeometry(5.9, 30), K.std({ color: 0x4a5a2a, roughness: 1 }), cx, 10.6, cz, { rx: -PI / 2, cast: false });
      const leafM = K.phys({ color: 0x2f5a22, roughness: 0.35, clearcoat: 0.6, side: T.DoubleSide });
      for (let k = 0; k < 4; k++) {
        const a = k * 1.7 + 0.3;
        const lf = K.mesh(new T.SphereGeometry(1, 16, 8), leafM, cx + Math.cos(a) * 5, 11.6, cz + Math.sin(a) * 5, { ry: -a });
        lf.scale.set(7, 0.5, 2.6); lf.rotation.z = 0.25;
      }
      const stemM = K.std({ color: 0x4a6a2a, roughness: 0.6 });
      const petal = K.phys({ color: 0xfbf7fb, roughness: 0.45, sheen: 1, sheenColor: new T.Color(0xffe8ff), side: T.DoubleSide });
      const lip = K.std({ color: 0xc23a8a, roughness: 0.5 });
      const flowers = [], lips = [];
      for (const [dx, h, lean] of [[-1, 40, 0.5], [1.2, 34, -0.4]]) {
        const pts = [];
        for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new T.Vector3(cx + dx + Math.sin(t * 1.6) * lean * 14 * t, 11 + t * h, cz + t * 3)); }
        const curve = new T.CatmullRomCurve3(pts);
        K.mesh(new T.TubeGeometry(curve, 24, 0.35, 6), stemM, 0, 0, 0);
        for (let f = 0; f < 5; f++) {
          const p = curve.getPoint(0.55 + f * 0.1);
          flowers.push({ x: p.x + lean * 2 * f, y: p.y - f * 1.6, z: p.z + 2.5, rx: -0.9, ry: r.range(-0.3, 0.3), s: 1 });
          lips.push({ x: p.x + lean * 2 * f, y: p.y - f * 1.6 - 0.2, z: p.z + 3.0, s: 0.7 });
        }
      }
      const fparts = [];
      const colr = (g, hex) => { const c = new T.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + PI / 2, big = i === 1 || i === 4;
        const pg2 = new T.SphereGeometry(1, 12, 6); pg2.scale(big ? 2.1 : 1.6, 0.18, big ? 1.7 : 0.8); pg2.translate(big ? 1.7 : 1.9, 0, 0); pg2.rotateY(-a);
        fparts.push(colr(pg2.toNonIndexed(), 0xfbf6fb));
      }
      const lp = new T.SphereGeometry(0.9, 10, 8); lp.scale(1, 0.8, 1.3); lp.translate(0, 0.35, 0.9); fparts.push(colr(lp.toNonIndexed(), 0xc0307a));
      const col2 = new T.SphereGeometry(0.4, 8, 6); col2.translate(0, 0.5, 0); fparts.push(colr(col2.toNonIndexed(), 0xf2d34a));
      const fg = K.BufferGeometryUtils.mergeGeometries(fparts.map((g) => { g.deleteAttribute('uv'); return g; }));
      K.instances(fg, K.phys({ vertexColors: true, roughness: 0.45, sheen: 1, sheenColor: new T.Color(0xffe8ff) }), flowers);
      void petal; void lip; void lips;
      AO(cx, cz, 9, 9, 0.5);
      K.circle(cx, cz, 6.6, 40);
    }
    // thermos jug at the north edge
    {
      const cx = -62, cz = -88;
      const tm = shiny(K.metal(0xd4d7dc, 0.18), 1.2);
      K.mesh(K.lathe([[0.01, 0], [6.2, 0], [6.6, 1], [6.6, 20], [5.8, 23], [4.0, 25.4], [0.01, 25.4]], 48), tm, cx, 0, cz);
      K.mesh(new T.CylinderGeometry(3.6, 4.2, 4, 32), blackGloss, cx, 27, cz);
      K.mesh(new T.BoxGeometry(5, 2, 2.4), blackGloss, cx + 5.6, 25.4, cz, { rz: -0.4 });
      const hd = new T.TorusGeometry(5.5, 0.9, 10, 24, PI);
      K.mesh(hd, blackGloss, cx - 6.6, 14, cz, { rz: PI / 2, ry: 0 });
      AO(cx, cz, 9, 9, 0.5);
      K.circle(cx, cz, 6.8, 30);
      coffeeCup(-80, -84, 0.5, { espresso: true });
    }
    // succulent centrepiece in a concrete bowl (west infield)
    {
      const cx = -104, cz = 4;
      const con = TX.mottledTextures({ size: 256, a: 0x9a9890, b: 0x7a7870, seed: 51, period: 24, speck: 0.4, bump: 2.5 });
      K.mesh(K.lathe([[0.01, 0], [9, 0], [12, 1.5], [14, 6], [14.2, 7.2], [13.2, 7.2], [11.5, 3.5], [0.01, 3]], 48), K.std({ map: con.map, normalMap: con.normalMap, roughness: 0.9 }), cx, 0, cz);
      K.mesh(new T.CircleGeometry(13.2, 40), K.std({ color: 0x3a2a1c, roughness: 1 }), cx, 6.2, cz, { rx: -PI / 2, cast: false });
      const peb = [];
      for (let k = 0; k < 160; k++) { const a = r() * TAU, d = Math.sqrt(r()) * 12.5; peb.push({ x: cx + Math.cos(a) * d, y: 6.25, z: cz + Math.sin(a) * d, sx: r.range(0.35, 0.7), sy: 0.22, sz: r.range(0.3, 0.6), ry: r() * 6, color: r.pick([0xf2efe8, 0xe0dcd2, 0xcfcac0, 0x9a948a]) }); }
      K.instances(new T.IcosahedronGeometry(1, 1), K.std({ roughness: 0.6 }), peb, { colors: true, cast: false });
      const leaves = [];
      const rosettes = [[cx - 5, cz - 3, 1.1, 0x7fa88a], [cx + 4, cz - 4, 0.9, 0x9ab8a0], [cx + 2, cz + 5, 1.2, 0x6a9a7a], [cx - 6, cz + 5, 0.8, 0xa8a0b8], [cx + 8, cz + 2, 0.7, 0x8ab090]];
      for (const [x, z, s, col] of rosettes) {
        for (let ringK = 0; ringK < 3; ringK++) {
          const n = 7 - ringK, rad = (3.2 - ringK) * s, tilt = 0.9 - ringK * 0.32;
          for (let i = 0; i < n; i++) { const a = (i / n) * TAU + ringK * 0.4; leaves.push({ x: x + Math.cos(a) * rad * 0.6, y: 6.6 + ringK * 0.8 * s, z: z + Math.sin(a) * rad * 0.6, ry: -a, rz: tilt, sx: 2.4 * s, sy: 0.7 * s, sz: 1.5 * s, color: col }); }
        }
      }
      const leafG = K.lathe([[0.01, -1.1], [0.55, -0.7], [0.62, 0.1], [0.38, 0.8], [0.01, 1.25]], 10); leafG.rotateZ(-PI / 2); leafG.translate(1.0, 0, 0);
      K.instances(leafG, K.phys({ roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3 }), leaves, { colors: true });
      AO(cx, cz, 16, 16, 0.5);
      K.circle(cx, cz, 14.2, 8);
    }
    // muffin on a plate with crumbs (east infield)
    {
      const cx = 74, cz = 26;
      K.mesh(K.lathe([[0.01, 0], [7, 0], [7.4, 0.3], [10, 0.9], [10.4, 1.2], [10.1, 1.3], [7.4, 0.65], [0.01, 0.6]], 48), white, cx, 0, cz);
      const paperC = canvas(256, 64, (g) => { for (let x = 0; x < 256; x += 8) { g.fillStyle = x % 16 ? '#c9a06a' : '#e2bd85'; g.fillRect(x, 0, 8, 64); } });
      K.mesh(K.lathe([[3.4, 0.6], [4.4, 5], [4.5, 5.2], [0.01, 5.2]], 36), K.std({ map: tex(paperC, { wrap: true }), roughness: 0.8 }), cx, 0, cz);
      const mt = TX.mottledTextures({ size: 256, a: 0x8a4a1c, b: 0x5a2c10, c: 0xb8743a, seed: 13, period: 16, speck: 0.4, bump: 5 });
      const top = K.mesh(new T.SphereGeometry(5.4, 32, 20), K.std({ map: mt.map, normalMap: mt.normalMap, normalScale: V2(1.5), roughness: 0.8 }), cx, 5.2, cz);
      top.scale.set(1, 0.62, 1);
      const choc = [];
      for (let k = 0; k < 14; k++) { const a = r() * TAU, d = r() * 4.2; choc.push({ x: cx + Math.cos(a) * d, y: 5.2 + Math.sqrt(1 - (d / 5.4) ** 2) * 3.3, z: cz + Math.sin(a) * d, s: 0.5, ry: r() * 6 }); }
      K.instances(new T.ConeGeometry(0.7, 0.8, 6), K.std({ color: 0x2a140a, roughness: 0.4 }), choc);
      const crumbs = [];
      for (let k = 0; k < 60; k++) { const a = r() * TAU, d = 5 + r() * 9; crumbs.push({ x: cx + Math.cos(a) * d, y: d < 9.5 ? 1.1 : 0.15, z: cz + Math.sin(a) * d, s: r.range(0.15, 0.4), rx: r() * 6, ry: r() * 6, color: r.pick([0x8a4a1c, 0xb8743a, 0x6a3a14]) }); }
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ roughness: 0.9 }), crumbs, { colors: true, cast: false });
      AO(cx, cz, 12, 12, 0.45);
      K.circle(cx, cz, 10.2, 9);
      // a dessert fork
      const fk = K.mesh(new K.RoundedBoxGeometry(12, 0.25, 1.1, 1, 0.1), chrome, cx - 1, 1.5, cz - 8.2, { ry: 0.1 });
      void fk;
    }
    // coffee cups around the table + rings and stray items
    coffeeCup(-112, 84, 0.3);
    coffeeCup(26, 84, 2.1);
    coffeeCup(-124, -30, 1.1);
    coffeeCup(40, -40, 4.0, { espresso: true });
    coffeeCup(128, -66, 0.8);
    ring(-96, 86, 1); ring(10, 82, 0.9); ring(-130, -14, 1.1); ring(52, -30, 0.8); ring(100, 34, 1); ring(-70, 36, 0.9); ring(-10, -70, 1);
    pen(-66, 84, 0.12);
    pen(116, 84, -0.2, burgundy);
    pen(-128, 14, 1.3);
    // name cards (tent cards) facing the camera where the seats are
    nameCard(-142, 86, 0.0, 1);
    nameCard(70, 86, 0.0, 2);
    nameCard(-40, 86, 0.02, 4);
    nameCard(148, 86, -0.08, 5);
    nameCard(TB.x0 + 9, 4, PI / 2, 0);
    nameCard(TB.x1 - 8, 4, -PI / 2, 3);
    nameCard(-80, -2, 0.05, 6);
    nameCard(48, 10, -0.1, 7);
    // leather portfolio with a legal pad (west infield)
    {
      const cx = -104, cz = 36, ang = 0.2;
      const lt = TX.mottledTextures({ size: 256, a: 0x3a1e12, b: 0x2a140b, seed: 31, period: 32, speck: 0.3, bump: 2 });
      K.mesh(new K.RoundedBoxGeometry(32, 0.9, 24, 2, 0.4), K.phys({ map: lt.map, normalMap: lt.normalMap, roughness: 0.5, clearcoat: 0.4 }), cx, 0.45, cz, { ry: ang });
      const pad = canvas(360, 512, (g) => {
        g.fillStyle = '#fbf0a0'; g.fillRect(0, 0, 360, 512);
        g.strokeStyle = 'rgba(80,120,200,0.5)'; g.lineWidth = 2; for (let y = 70; y < 512; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(360, y); g.stroke(); }
        g.strokeStyle = 'rgba(220,60,60,0.6)'; g.beginPath(); g.moveTo(52, 0); g.lineTo(52, 512); g.stroke();
        g.fillStyle = '#1d3a8f'; g.font = 'italic 700 24px Georgia, serif';
        ['Q3 race — notes', '- SUVs: heavy!', '- avoid coffee', '- laser = bad', '- phone: The Board?!', '- ask Legal re: jump', '  → circle back'].forEach((t, i) => g.fillText(t, 62, 62 + i * 26));
      });
      K.mesh(new T.PlaneGeometry(14, 20), K.std({ map: tex(pad), roughness: 0.9 }), cx + 6.5, 0.95, cz, { rx: -PI / 2, ry: 0, cast: false }).rotation.z = ang;
      AO(cx, cz, 18, 14, 0.4, -ang);
      K.box(cx, cz, 16, 12, -ang, 1.2);
      pen(cx - 6, cz + 2, -1.3);
    }

    // fine scatter: sugar sachets, staples, business cards, dust
    {
      const sach = [];
      for (const [x, z] of [[-118, 92], [-104, 79], [32, 78], [16, 90], [-130, -42], [118, -60]]) sach.push({ x, y: 0.25, z, ry: r() * 6, color: r.pick([0xf2ede0, 0x8a5a2a, 0x6a8a3a]) });
      const sg = new K.RoundedBoxGeometry(4, 0.5, 2.4, 1, 0.2);
      for (const q of sach) K.mesh(sg, K.std({ color: q.color, roughness: 0.8 }), q.x, q.y, q.z, { ry: q.ry, cast: false });
      const cards = [];
      for (const [x, z, a] of [[-58, 88, 0.3], [-52, 89, 0.5], [92, 88, -0.2], [-138, -86, 0.6], [54, 40, 1.2]]) cards.push({ x, y: 0.15, z, ry: a });
      const bc = canvas(256, 150, (g) => { g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 256, 150); g.fillStyle = '#1d2a44'; g.font = '700 26px Georgia, serif'; g.fillText('Alex Morgan', 20, 60); g.font = '16px Rubik, Arial'; g.fillStyle = '#6a7284'; g.fillText('VP of Alignment', 20, 86); g.fillText('Synergy Partners', 20, 126); g.fillStyle = '#c9a24a'; g.fillRect(0, 140, 256, 10); });
      K.instances(new K.RoundedBoxGeometry(8.5, 0.15, 5.5, 1, 0.05), K.std({ map: tex(bc), roughness: 0.7 }), cards, { cast: false });
      // dust specks on the lacquer
      const dust = [];
      for (let k = 0; k < 500; k++) {
        const x = r.range(TB.x0 + 4, TB.x1 - 4), z = r.range(TB.z0 + 4, TB.z1 - 4);
        if (!K.offRoad(x, z, 1)) continue;
        dust.push({ x, y: 0.03, z, s: r.range(0.04, 0.1), ry: r() * 6 });
      }
      K.instances(new T.PlaneGeometry(1, 1).rotateX(-PI / 2), new T.MeshBasicMaterial({ color: 0xb8a890, transparent: true, opacity: 0.5 }), dust, { cast: false, receive: false });
    }

    // condensation droplets for all glasses (one instanced mesh)
    if (A.drops && A.drops.length) {
      const dm = K.instances(new T.SphereGeometry(1, 8, 6), shiny(K.phys({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.7, clearcoat: 1 }), 2), A.drops, { cast: false });
      keep.push(dm);
    }
    if (rings.length) {
      const pg = new T.PlaneGeometry(1, 1); pg.rotateX(-PI / 2);
      const im = K.instances(pg, ringMat, rings, { cast: false });
      im.renderOrder = 1;
    }
    flushAO();

    // ============================================================================ merge static meshes (fewer draw calls)
    {
      const BU = K.BufferGeometryUtils;
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const classMats = {
        metalS: shiny(K.std({ vertexColors: true, metalness: 1, roughness: 0.14 }), 1.2),
        metalR: shiny(K.std({ vertexColors: true, metalness: 1, roughness: 0.34 }), 1.0),
        gloss: shiny(K.phys({ vertexColors: true, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.06 }), 0.9),
        plastic: K.phys({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
        satin: K.std({ vertexColors: true, roughness: 0.45 }),
        matte: K.std({ vertexColors: true, roughness: 0.85 }),
      };
      const plain = (m) => !m.map && !m.normalMap && !m.roughnessMap && !m.alphaMap && !m.emissiveMap && !m.transparent && (m.emissive ? m.emissive.getHex() === 0 : true) && m.side !== T.BackSide && m.isMeshStandardMaterial && !m.sheen;
      const classOf = (m) => {
        if (m.metalness >= 0.5) return m.roughness < 0.26 ? 'metalS' : 'metalR';
        if (m.isMeshPhysicalMaterial && m.clearcoat >= 0.6) return 'gloss';
        if (m.isMeshPhysicalMaterial && m.clearcoat > 0) return 'plastic';
        return m.roughness < 0.6 ? 'satin' : 'matte';
      };
      const items = [], owners = [];
      const slice = (g, start, count) => {
        const out = new T.BufferGeometry();
        for (const k of Object.keys(g.attributes)) { const at = g.attributes[k], n = at.itemSize; out.setAttribute(k, new T.BufferAttribute(at.array.slice(start * n, (start + count) * n), n)); }
        return out;
      };
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || isKept(o)) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (o.renderOrder || mats.some((m) => m.transparent || m.isMeshBasicMaterial)) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 60 || c.y < -20) return;
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        if (!g.attributes.normal) g.computeVertexNormals();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        const cell = (c.x < 0 ? 'w' : 'e') + (c.z < 0 ? 'n' : 's');
        if (Array.isArray(o.material)) {
          const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
          for (const gr of groups) {
            const cnt = Math.min(gr.count, g.attributes.position.count - gr.start);
            if (cnt > 0) items.push({ g: slice(g, gr.start, cnt), mat: o.material[gr.materialIndex], cast: o.castShadow, rec: o.receiveShadow, cell });
          }
        } else items.push({ g, mat: o.material, cast: o.castShadow, rec: o.receiveShadow, cell });
        owners.push(o);
      });
      for (const o of owners) o.parent.remove(o);
      const buckets = new Map();
      for (const it of items) {
        const m = it.mat;
        const cls = plain(m) ? classOf(m) + (m.side === T.DoubleSide ? 'D' : '') : null;
        const key = (cls || m.uuid) + '|' + it.cell + (it.cast ? 'c' : '') + (it.rec ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, { cls, list: [] });
        buckets.get(key).list.push(it);
      }
      const col = new T.Color();
      for (const { cls, list } of buckets.values()) {
        const geos = list.map((it) => {
          const g = it.g;
          if (cls) {
            col.copy(it.mat.color);
            const n = g.attributes.position.count, ca = new Float32Array(n * 3), src = it.mat.vertexColors ? g.attributes.color : null;
            for (let i = 0; i < n; i++) { ca[i * 3] = col.r * (src ? src.getX(i) : 1); ca[i * 3 + 1] = col.g * (src ? src.getY(i) : 1); ca[i * 3 + 2] = col.b * (src ? src.getZ(i) : 1); }
            for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
            g.setAttribute('color', new T.BufferAttribute(ca, 3));
          } else if (g.attributes.color && !it.mat.vertexColors) g.deleteAttribute('color');
          return g;
        });
        let merged = geos.length > 1 ? BU.mergeGeometries(geos, false) : geos[0];
        if (!merged) { console.warn('boardroom: merge failed', list[0].mat.type); continue; }
        let mat = list[0].mat;
        if (cls) {
          const base = cls.replace('D', '');
          mat = classMats[cls] || (classMats[cls] = classMats[base].clone());
          if (cls.endsWith('D')) mat.side = T.DoubleSide;
        }
        const m = new T.Mesh(merged, mat);
        m.castShadow = list[0].cast; m.receiveShadow = list[0].rec;
        K.group.add(m);
      }
    }
    A.buildMs = performance.now() - t0;
  },

  // fixed-rate: the laser dot dazzles cars it crosses
  tick(dt, time, game) {
    if (!A || !A.track) return;
    const L = laserPos(time, A.track);
    A.laser.x = L.x; A.laser.z = L.z;
    for (const e of game.cars) {
      const c = e.car;
      if (c.state !== 'drive' || c.airborne) continue;
      const dx = c.x - L.x, dz = c.z - L.z;
      if (dx * dx + dz * dz > LASER.r * LASER.r) continue;
      if (time - (c._dazzleT ?? -99) < 1.6) continue;
      c._dazzleT = time;
      const side = (dx * -Math.sin(c.angle) + dz * Math.cos(c.angle)) >= 0 ? 1 : -1;
      c.stun = Math.max(c.stun, 0.42);
      c.w += side * 2.4;
      c.vx *= 0.93; c.vz *= 0.93;
      if (A.dazzle.length < 8) A.dazzle.push(c);
    }
  },

  animate(time, dt, game) {
    if (!A) return;
    const live = game && (game.state === 'race' || game.state === 'countdown' || game.state === 'roundEnd');
    // speakerphone
    if (A.spk) {
      A.spk.grp.rotation.y = -time * SPK.w;
      const hit = A.spk.hits.reduce((a, m) => a + (m.hits || 0), 0);
      if (hit !== A.spk.lastHits) { A.spk.flash = 1; A.spk.lastHits = hit; }
      A.spk.flash = Math.max(0, (A.spk.flash || 0) - dt * 3);
      A.spk.led.emissiveIntensity = 1.2 + 0.5 * Math.sin(time * 3) + A.spk.flash * 3;
      A.spk.led.emissive.setHex(A.spk.flash > 0.05 ? 0xff5030 : 0x2cff7a);
    }
    // phone
    if (A.phone) {
      const P = A.phone, q = phonePose(time, P.B);
      P.g.position.set(q.x, 0, q.z);
      P.g.rotation.y = -q.angle;
      P.scrMat.emissiveIntensity = q.lit * (0.75 + (q.buzz ? 0.2 * Math.sin(time * 18) : 0));
      if (q.buzz && game && game.particles && dt > 0.0005 && game.onScreen(q.x, 1, q.z, 0.1)) {
        if (Math.random() < dt * 14) {
          const a = Math.random() * (Math.PI * 2);
          game.particles.emit(q.x + Math.cos(a) * 10, 1.0, q.z + Math.sin(a) * 6, { color: 0xbfd8ff, size: 0.9, life: 0.25, spread: 1, up: 2, grav: 0, grow: 2.2, alpha: 0.6, vx: Math.cos(a) * 6, vz: Math.sin(a) * 6 });
        }
        const step = Math.floor(time * 3.2);
        if (step !== P.lastStep) { P.lastStep = step; if (live && game.sound.ctx) game.sound.tone(150, 0.16, { type: 'sawtooth', vol: 0.035 }); }
      }
    }
    // laser dot + beam
    if (A.laser && A.track) {
      const L = laserPos(time, A.track), Z = A.laser;
      Z.dot.position.set(L.x, 0.62, L.z);
      const fl = 1 + 0.08 * Math.sin(time * 40);
      Z.dot.scale.set(5.2 * fl, 5.2 * fl, 1);
      const a = Z.src, bx = L.x - a.x, by = 0.62 - a.y, bz = L.z - a.z, len = Math.hypot(bx, by, bz);
      Z.beam.position.set((a.x + L.x) / 2, (a.y + 0.62) / 2, (a.z + L.z) / 2);
      Z.beam.scale.set(1, len, 1);
      Z.beam.quaternion.setFromUnitVectors(UP, TMP.set(bx / len, by / len, bz / len));
      if (game && game.particles && A.dazzle.length) {
        for (const c of A.dazzle) {
          game.particles.emit(c.x, 1.6, c.z, { color: 0xff3a2a, n: 8, size: 1.1, life: 0.35, spread: 9, up: 4, grav: 6, grow: 1.4, alpha: 0.9 });
          game.particles.emit(c.x, 2.0, c.z, { color: 0xffffff, n: 3, size: 2.2, life: 0.18, spread: 2, up: 1, grav: 0, grow: 2.5, alpha: 0.8 });
          if (live && game.sound.ctx) game.sound.tone(1800, 0.12, { type: 'triangle', vol: 0.05, slideTo: 600 });
        }
        A.dazzle.length = 0;
      }
    }
    // the open laptop flips through the slides
    if (A.slides) {
      const k = Math.floor(time / 4.5) % 3;
      if (k !== A.slides.k) { A.slides.k = k; A.slides.tex.offset.y = 1 - (k + 1) * (340 / 1024) + (340 - 320) / 1024; }
    }
  },
};

const UP = new THREE.Vector3(0, 1, 0);
const TMP = new THREE.Vector3();
