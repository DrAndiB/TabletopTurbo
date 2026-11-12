// World: Castle Siege (Time Machine Cup, table 2 of 4). A wooden-block knights' castle on a painted play board. The
// cobbled road jumps the moat off the half-raised drawbridge, runs through the gatehouse and the courtyard (barrels to
// shove about) and leaves by the east gate. Outside, a toy catapult lobs wooden balls at two marks on the east road
// (the mark glows before the ball lands), and on the west road two jousting knights on wheels charge across from the
// tilt yard every few seconds (a bell rings first). Mud waits on the north road.
import { tmTools, blast, fired, mod, ss, clamp } from './_tm.js';

const TRACK = [
  [-90, 72], [-50, 84], [-12, 80], [0, 58], [0, 30], [2, 4], [16, -14], [42, -16], [68, -6], [84, 18], [94, 40], [106, 54],
  [122, 52], [130, 32], [128, 4], [114, -30], [96, -62], [66, -84], [20, -90], [-30, -86], [-76, -78], [-108, -56],
  [-122, -20], [-120, 20], [-110, 52],
];
const W = 14, PI = Math.PI;
const WALL = { x0: -34, x1: 34, z0: -46, z1: 34, h: 8, t: 4 };
const MOAT = { x0: -44, x1: 44, z0: 38, z1: 46.5, y: -2.4 };
const JUMP = { z0: 57.5, len: 9, h: 2.7 }; // the drawbridge ramp: start, length (towards the north), height
const TILT = { z: 0, x0: -141, x1: -101, period: 4.5, phase: 2.5, run: 2.0, lane: 2.3 };
const CAT = { x: 104, z: 20, period: 6.5, phase: 3, fly: 1.15, R: 5.6 };
// where knight k (0 or 1) is at time t: they swap ends every period, each in its own lane
function knightAt(k, t, o) {
  const n = Math.floor((t - TILT.phase) / TILT.period), u = mod(t - TILT.phase, TILT.period);
  const e = ss(0, TILT.run, u), fwd = (mod(n, 2) === 0) === (k === 0);
  const f = fwd ? e : 1 - e;
  o.x = TILT.x0 + (TILT.x1 - TILT.x0) * f; o.z = TILT.z + (k ? TILT.lane : -TILT.lane); o.angle = 0; o.dir = fwd ? 1 : -1; o.moving = u < TILT.run;
  return o;
}
const catU = (t) => mod(t - CAT.phase, CAT.period);
const catShot = (t) => Math.floor((t - CAT.phase) / CAT.period);

let A = null;

export default {
  id: 'castle',
  name: 'Castle Siege',
  blurb: 'A wooden-block castle: jump the moat off the drawbridge, dodge the jousting knights and the catapult.',
  vehicle: 'rally',
  seed: 103,
  track: { points: TRACK, width: W, startS: 28 },
  noGrid(track) {
    const sj = track.nearest(0, JUMP.z0).s, sk = track.nearest(-121, TILT.z).s;
    return [[sj - 16, sj + 30], [sk - 10, sk + 10]];
  },
  bounds: { minX: -150, maxX: 150, minZ: -106, maxZ: 106 },
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1 },
  skidColor: 0x3a342c,
  dustColor: 0xc9c2b2,
  dust: {
    normal: { color: 0xcfc8b8, size: 0.9, life: 0.4, up: 1.4, grav: 3, alpha: 0.2, grow: 2, rate: 0.4 },
    slow: { color: 0x86b060, size: 0.8, life: 0.4, up: 3, grav: 14, alpha: 0.5, grow: 1.4, rate: 1.2 },
    sticky: { color: 0x5a4028, size: 0.7, life: 0.45, up: 4, grav: 40, alpha: 0.95, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.7, 0.95, 0.4], sunColor: 0xffe2b8, sunIntensity: 2.9,
    hemiSky: 0xcfe2ff, hemiGround: 0x7a8a52, hemiIntensity: 0.55,
    envIntensity: 0.45, exposure: 1.0, background: 0x2a2420, shadowRadius: 1.6,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const TM = tmTools(K);
    const { G, P, toy, wedge, table, road, startLine, edges, scatter, sAt, geoOf } = TM;
    A = { prevT: null, knights: [], fell: new Set(), sJ: sAt(0, JUMP.z0), spots: [], rings: [], L: track.length };
    const paint = K.plastic(0xffffff, 0.55, { vertexColors: true });
    const wood = K.std({ color: 0xffffff, roughness: 0.75, vertexColors: true });
    const plain = K.std({ color: 0xffffff, roughness: 0.8 });
    const WOODS = [0xe2c08a, 0xd6ae74, 0xecd0a0, 0xcf9f66];

    // ---------------- table, the painted board (cut round the moat), the moat ----------------
    table({ w: 306, d: 218, wood: [0x9a6a42, 0x5e3c22, 0xc09060], floorA: '#b9a88e', floorB: '#7d6a58', top: -3.3 });
    // the board's painted top: meadow, strips of farmland, lanes to the houses, a dirt shoulder along the road, the
    // cobbled courtyard, sand in the tilt yard, a chequered frame
    const BOARD = { x0: -150, z0: -106, w: 300, d: 212, seed: 57 };
    const print = TM.groundCanvas(BOARD, (g, C) => {
      const cw = g.canvas.width, ch = g.canvas.height, u = C.ppu;
      g.fillStyle = '#7db14d'; g.fillRect(0, 0, cw, ch);
      C.mottle(220, ['#74a847', '#86ba55', '#6d9f42', '#8fc25c'], 5, 15, 0.35);
      for (const [x, z, w, d, a, c1, c2] of [[-86, -52, 30, 20, -0.3, '#c9b458', '#b39c42'], [-62, 38, 26, 16, 0.15, '#9bbf4f', '#86a941'], [58, -64, 24, 15, -0.1, '#b98f58', '#a37c48'], [30, 97, 40, 9, 0, '#c9b458', '#b39c42'], [142, -8, 9, 44, 0, '#9bbf4f', '#86a941'], [-140, 84, 14, 26, 0.05, '#b98f58', '#a37c48'], [100, -96, 36, 9, 0.02, '#9bbf4f', '#86a941']]) {
        g.save(); g.translate(C.X(x), C.Z(z)); g.rotate(a); g.fillStyle = c1; g.fillRect(-w * u / 2, -d * u / 2, w * u, d * u);
        g.fillStyle = c2; for (let k = 0; k < d; k += 2) g.fillRect(-w * u / 2, (-d / 2 + k) * u, w * u, u * 0.9);
        g.strokeStyle = '#6d9f42'; g.lineWidth = u * 0.8; g.strokeRect(-w * u / 2, -d * u / 2, w * u, d * u); g.restore();
      }
      for (const [x, z] of [[66, -38], [84, -24], [60, 34], [-70, -46], [-56, -62], [-72, 52], [-50, 58], [-54, -20], [-96, -14], [-74, -6]]) { const n = track.at(track.nearest(x, z).s); C.line([[x, z], [(x + n.x) / 2 + 3, (z + n.z) / 2 - 2], [n.x, n.z]], 1.5, '#c2a56e', 0.85); }
      C.rect((TILT.x0 + TILT.x1) / 2, TILT.z, TILT.x1 - TILT.x0 + 8, 13, '#d8c08a', 0.9);
      C.blob(CAT.x, CAT.z, 14, '#a98f62', 0.6); C.blob(-54, -20, 9, '#b99a68', 0.5);
      C.band(W + 1, 5, '#b99a68', 0.75);
      // castle: a trodden apron round the walls, cobbles inside
      const cz = (WALL.z0 + WALL.z1) / 2, ww = WALL.x1 - WALL.x0, wd = WALL.z1 - WALL.z0;
      C.rect(0, cz, ww + 9, wd + 9, '#b9a67c', 0.65); C.rect(0, cz, ww, wd, '#cdb88c', 1);
      for (let x = WALL.x0 + 1; x < WALL.x1; x += 2.1) for (let z = WALL.z0 + 1; z < WALL.z1; z += 2.1) { g.fillStyle = ['#c0aa7e', '#dccaa2', '#b59f74', '#d3bf94'][Math.floor(C.rr() * 4)]; g.beginPath(); g.ellipse(C.X(x + C.rr() * 0.8), C.Z(z + C.rr() * 0.8), u * (0.7 + C.rr() * 0.3), u * (0.6 + C.rr() * 0.3), C.rr() * 3, 0, 7); g.fill(); }
      g.strokeStyle = '#5d8f3c'; g.lineWidth = u * 1.6; g.strokeRect(C.X(MOAT.x0 - 0.8), C.Z(MOAT.z0 - 0.8), (MOAT.x1 - MOAT.x0 + 1.6) * u, (MOAT.z1 - MOAT.z0 + 1.6) * u);
      for (let i = 0; i < 16; i++) C.dots(46, ['#ffffff', '#f2c230', '#e86aa0', '#d8423a', '#b48ad6'], 0.2, 0.42, 0.9, -146 + C.rr() * 292, -102 + C.rr() * 204, 6 + C.rr() * 6);
      C.dots(420, ['#ffffff', '#f2c230', '#e86aa0'], 0.16, 0.34, 0.8);
      const lab = (t, x, z, sz = 4, ang = 0) => C.text(t, x, z, sz, '#4a3a1e', { alpha: 0.72, ang, font: 'Georgia, "Times New Roman", serif', weight: 'italic bold' });
      lab('The Kingdom of Blocks', -34, 98.6, 4.6); lab('The Tilt Yard', -86, 30, 3.6); lab('Dragon Rock', 96, 98, 3.4); lab('Mill Lane', -56, -34, 3.2, 0.2);
      lab('The Orchard', 8, -78.5, 3.2); lab('Siege Camp', 109, -6, 3, -0.3); lab('The Moat', -62, 43, 3.2);
      C.border(0.8, 3, '#f3ead6', null, '#c8423a');
    });
    const grassT = TX.mottledTextures({ size: 512, a: 0x7fb24e, b: 0x6a9c40, seed: 17, period: 9, bump: 1.2 });
    grassT.normalMap.repeat.set(9, 6.5);
    const grass = K.std({ map: print.texture(), normalMap: grassT.normalMap, roughness: 1 });
    // the four slabs share the one painting: texture coordinates from the position on the board
    const slab = (x0, x1, z0, z1) => K.mesh(TM.groundUV(new T.BoxGeometry(x1 - x0, 3, z1 - z0), (x0 + x1) / 2, (z0 + z1) / 2, BOARD), grass, (x0 + x1) / 2, -1.5, (z0 + z1) / 2, { cast: false });
    slab(-150, 150, -106, MOAT.z0); slab(-150, 150, MOAT.z1, 106); slab(-150, MOAT.x0, MOAT.z0, MOAT.z1); slab(MOAT.x1, 150, MOAT.z0, MOAT.z1);
    K.mesh(new T.PlaneGeometry(MOAT.x1 - MOAT.x0, MOAT.z1 - MOAT.z0), K.phys({ color: 0x2f7fc0, roughness: 0.06, clearcoat: 1 }), 0, MOAT.y, (MOAT.z0 + MOAT.z1) / 2, { rx: -PI / 2, cast: false });
    K.mesh(new T.BoxGeometry(MOAT.x1 - MOAT.x0 + 2, 0.4, MOAT.z1 - MOAT.z0 + 2), K.std({ color: 0x1f4f80, roughness: 0.9 }), 0, -3.2, (MOAT.z0 + MOAT.z1) / 2, { cast: false });
    K.trapdoor(0, (MOAT.z0 + MOAT.z1) / 2, (MOAT.x1 - MOAT.x0) / 2, (MOAT.z1 - MOAT.z0) / 2 - 0.3, 0, true);
    // lily pads and a toy swan
    {
      const pads = [];
      for (let i = 0; i < 14; i++) { const x = r.range(MOAT.x0 + 3, MOAT.x1 - 3); if (Math.abs(x) > 12) pads.push({ x, y: MOAT.y + 0.06, z: r.range(MOAT.z0 + 1.5, MOAT.z1 - 1.5), s: r.range(0.7, 1.2), ry: r() * 6 }); }
      K.instances(G.cyl(1, 1, 0.08, 10), K.std({ color: 0x3f9a4a, roughness: 0.7 }), pads, { cast: false });
      toy([P(G.sph(1, 10), 0xffffff, 0, 0.6, 0, { sx: 1.7, sy: 0.9, sz: 1.1 }), P(G.cap(0.3, 1.4), 0xffffff, 1.3, 1.7, 0, { rz: -0.3 }), P(G.sph(0.42, 8), 0xffffff, 1.6, 2.6, 0), P(G.cone(0.2, 0.7, 5), 0xf59a23, 2.15, 2.5, 0, { rz: -PI / 2 })], paint, -26, MOAT.y, 42.5, 0.3);
    }
    // the courtyard's packed earth and the road
    road({ a: 0xb6b0a4, b: 0x8e887c, seed: 9, period: 22, bump: 3, cut: (x, z) => Math.abs(x) < 20 && z > MOAT.z0 - 0.2 && z < JUMP.z0 - JUMP.len + 0.6 });
    startLine(28, 0.08);
    // kerbs of little wooden blocks
    edges(G.box(1.7, 0.9, 0.9), plain, 2.5, 0.6, (p, side, i) => {
      if (p.z > MOAT.z0 - 1 && p.z < JUMP.z0 + 1 && Math.abs(p.x) < 20) return null; // not on the bridge or across the moat
      return { x: p.x, y: 0.45, z: p.z, ry: -p.angle + r.range(-0.12, 0.12), color: i % 7 === 3 ? r.pick([0xd8423a, 0x2f6fd0, 0xf2c230]) : r.pick(WOODS) };
    });

    // ---------------- the drawbridge: half raised, a ramp over the moat ----------------
    {
      const zc = JUMP.z0 - JUMP.len / 2;
      K.ramp(0, zc, -PI / 2, JUMP.len, W + 3, JUMP.h, 0);
      const parts = [P(wedge(JUMP.len, JUMP.h, 0.01, W + 3), 0xa87242, 0, 0.02, 0)];
      const sl = Math.atan2(JUMP.h, JUMP.len);
      for (let i = 0; i < 6; i++) { const a = -JUMP.len / 2 + 0.8 + i * 1.5; parts.push(P(G.box(0.25, 0.1, W + 3), 0x6d4526, a, 0.07 + (a + JUMP.len / 2) * JUMP.h / JUMP.len, 0, { rz: sl })); }
      toy(parts, wood, 0, 0, zc, -PI / 2);
      // side rails stop a car slipping off the side of the bridge into thin air
      for (const sx of [-1, 1]) K.box(sx * (W / 2 + 2.2), zc - 1, 0.5, JUMP.len / 2 + 2, 0, 5);
      // posts, and the chains up to the gatehouse
      const ch = [];
      for (const sx of [-1, 1]) {
        ch.push(P(G.cyl(0.7, 0.7, 5, 8), 0x7a5230, sx * (W / 2 + 2.2), 2.5, JUMP.z0 + 1), P(G.cyl(0.7, 0.7, 6.5, 8), 0x7a5230, sx * (W / 2 + 2.2), 3.25, JUMP.z0 - JUMP.len));
        ch.push(P(G.cyl(0.18, 0.18, 17.5, 5), 0x3a3a3a, sx * (W / 2 + 1.6), 9, (JUMP.z0 - JUMP.len + WALL.z1) / 2, { rx: PI / 2 - 0.52 }));
      }
      toy(ch, wood);
      // the far half of the bridge lies flat on the castle bank
      K.mesh(G.box(W + 3, 0.3, 4), K.std({ color: 0xa87242, roughness: 0.8 }), 0, 0.12, MOAT.z0 - 2.2, { cast: false });
    }

    // ---------------- the castle: curtain wall, towers, gatehouses, keep ----------------
    {
      const STONE = [0xe6d2a6, 0xdcc698, 0xefdcb4], parts = [];
      const wall = (xa, za, xb, zb) => {
        const len = Math.hypot(xb - xa, zb - za), ang = Math.atan2(zb - za, xb - xa), cx = (xa + xb) / 2, cz = (za + zb) / 2;
        parts.push(P(G.box(len, WALL.h, WALL.t), r.pick(STONE), cx, WALL.h / 2, cz, { ry: -ang }));
        const n = Math.max(1, Math.round(len / 4.2));
        for (let i = 0; i < n; i++) { const k = (i + 0.5) / n - 0.5; parts.push(P(G.box(len / n * 0.5, 1.6, WALL.t), r.pick(STONE), cx + Math.cos(ang) * len * k, WALL.h + 0.8, cz + Math.sin(ang) * len * k, { ry: -ang })); }
        K.box(cx, cz, len / 2, WALL.t / 2, ang, WALL.h + 2);
      };
      const { x0, x1, z0, z1 } = WALL, GS = 11, EG0 = -27, EG1 = -5;
      wall(x0, z0, x1, z0); wall(x0, z0, x0, z1);
      wall(x0, z1, -GS, z1); wall(GS, z1, x1, z1);
      wall(x1, z0, x1, EG0); wall(x1, EG1, x1, z1);
      const roofs = [0xc8423a, 0x2f62b8];
      const tower = (x, z, rad, h, roof, sq = false) => {
        parts.push(P(sq ? G.box(rad * 2, h, rad * 2) : G.cyl(rad, rad * 1.06, h, 16), r.pick(STONE), x, h / 2, z));
        parts.push(P(sq ? G.cone(rad * 1.6, rad * 1.5, 4) : G.cone(rad * 1.3, rad * 1.7, 16), roof, x, h + (sq ? rad * 0.75 : rad * 0.85), z, sq ? { ry: PI / 4 } : {}));
        const top = h + rad * (sq ? 1.5 : 1.7);
        parts.push(P(G.cyl(0.14, 0.14, 4, 5), 0x4a4a4a, x, top + 1.6, z), P(G.box(2.6, 1.5, 0.08), roof === roofs[0] ? 0xf2c230 : 0xd8423a, x + 1.4, top + 2.8, z));
        if (sq) K.box(x, z, rad, rad, 0, h + 5); else K.circle(x, z, rad * 1.06, h + 5);
        K.contact(x, z, rad * 1.5, rad * 1.5, 0.4);
      };
      tower(x0, z0, 5.5, 16, roofs[1]); tower(x1, z0, 5.5, 16, roofs[0]); tower(x0, z1, 5, 13, roofs[0]); tower(x1, z1, 5, 13, roofs[1]);
      // gatehouses: two square towers and a beam, the portcullis drawn up inside the south one
      tower(-GS - 1, z1, 3, 12, roofs[1], true); tower(GS + 1, z1, 3, 12, roofs[1], true);
      parts.push(P(G.box(GS * 2 - 4, 2, 2.4), STONE[0], 0, 10.5, z1), P(G.box(GS * 2 - 5, 2.4, 0.5), 0x3a3a3a, 0, 8.4, z1 + 1));
      for (let i = -3; i <= 3; i++) parts.push(P(G.cone(0.35, 1.2, 4), 0x3a3a3a, i * 2.4, 6.7, z1 + 1, { rz: PI }));
      tower(x1, EG0 - 1, 3, 11, roofs[0], true); tower(x1, EG1 + 1, 3, 11, roofs[0], true);
      parts.push(P(G.box(2.4, 2, EG1 - EG0 - 4), STONE[1], x1, 9.5, (EG0 + EG1) / 2));
      // the keep, with a banner
      const kx = -19, kz = -30;
      parts.push(P(G.box(13, 20, 13), STONE[2], kx, 10, kz), P(G.box(14.5, 1.5, 14.5), STONE[0], kx, 20.6, kz), P(G.cone(8, 7, 4), roofs[0], kx, 25, kz, { ry: PI / 4 }));
      for (const [dx, dz] of [[-6.2, -6.2], [6.2, -6.2], [-6.2, 6.2], [6.2, 6.2]]) parts.push(P(G.box(2.2, 2, 2.2), STONE[1], kx + dx, 22.3, kz + dz));
      parts.push(P(G.box(2.4, 4.2, 0.2), 0x3a2a20, kx, 2.1, kz + 6.55), P(G.box(3, 6, 0.15), 0x2f62b8, kx, 13, kz + 6.6), P(G.cyl(0.9, 0.9, 0.16, 12), 0xf2c230, kx, 14, kz + 6.7, { rx: PI / 2 }));
      for (const dx of [-3.4, 3.4]) parts.push(P(G.box(1.2, 2.4, 0.2), 0x2a2a30, kx + dx, 15, kz + 6.55));
      K.box(kx, kz, 6.5, 6.5, 0, 28); K.contact(kx, kz, 10, 10, 0.45);
      toy(parts, paint);
    }

    // ---------------- the courtyard: market stalls, a well, barrels to shove about, hay ----------------
    {
      const stall = (x, z, a, c) => {
        const p = [P(G.box(7, 2.4, 3.6), 0xcf9f66, 0, 1.2, 0)];
        for (let i = 0; i < 5; i++) p.push(P(G.box(1.5, 0.3, 5), i % 2 ? 0xfaf5ea : c, -3 + i * 1.5, 5.6, 0, { rx: 0.3 }));
        for (const sx of [-3.3, 3.3]) for (const sz of [-1.6, 1.6]) p.push(P(G.cyl(0.2, 0.2, 5.6, 5), 0x7a5230, sx, 2.8, sz));
        for (let i = 0; i < 5; i++) p.push(P(G.sph(0.5, 6), [0xd8423a, 0xf59a23, 0x6fc04b][i % 3], -2.4 + i * 1.2, 2.7, 0.3));
        toy(p, paint, x, 0, z, a); K.box(x, z, 3.6, 2, a, 6); K.contact(x, z, 5, 3.5, 0.4, a);
      };
      stall(-21, 16, PI / 2, 0xd8423a); stall(23, 20, PI / 2, 0x2f62b8);
      toy([P(G.cyl(2.6, 2.8, 2.4, 14), 0xbdb3a0, 0, 1.2, 0), P(G.cyl(2.1, 2.1, 0.2, 14), 0x2f7fc0, 0, 2.35, 0), P(G.cyl(0.25, 0.25, 6, 5), 0x7a5230, -2.3, 3, 0), P(G.cyl(0.25, 0.25, 6, 5), 0x7a5230, 2.3, 3, 0), P(G.cone(3.6, 2.2, 4), 0xc8423a, 0, 7, 0, { ry: PI / 4 })], paint, 21, 0, -35);
      K.circle(21, -35, 2.9, 8); K.contact(21, -35, 4.2, 4.2, 0.4);
      const barrelGeo = geoOf([P(G.cyl(1.3, 1.3, 2.8, 12), 0xb07a45, 0, 0, 0), P(G.cyl(1.36, 1.36, 0.3, 12), 0x4a4a4a, 0, 0.8, 0), P(G.cyl(1.36, 1.36, 0.3, 12), 0x4a4a4a, 0, -0.8, 0)]);
      for (const [x, z] of [[-10, 22], [11, 10], [-9, -4], [6, -24], [24, -6], [-12, 8]]) {
        const m = K.mesh(barrelGeo, wood, x, 1.4, z);
        K.physics.addDynamic({ x, z, r: 1.4, m: 0.5, h: 2.8, mesh: m, slide: true, friction: 14, baseY: 1.4 });
      }
      const hay = [];
      for (const [x, z, a] of [[-28, -8, 0.2], [-27, -3, -0.1], [28, 28, 0.3], [-4, -40, 1.5], [3, -40, 1.6], [28, -40, 0.4]]) { hay.push({ x, y: 1.1, z, ry: a }); K.box(x, z, 2, 1.3, -a, 2.4, { bounce: 0.6 }); }
      K.instances(G.rbox(4, 2.2, 2.6, 0.35), K.std({ color: 0xe6c35a, roughness: 1 }), hay);
    }

    // ---------------- the tilt yard on the west road: two jousting knights on wheels ----------------
    {
      const rail = [];
      for (let x = TILT.x0 - 2; x <= TILT.x1 + 2; x += 4) if (K.offRoad(x, TILT.z, 1.5)) rail.push(P(G.box(4, 0.4, 0.3), x % 8 ? 0xd8423a : 0xfaf5ea, x, 1.6, TILT.z), P(G.cyl(0.2, 0.2, 1.6, 5), 0x7a5230, x, 0.8, TILT.z));
      toy(rail, paint);
      const knight = (c1, c2) => geoOf([
        P(G.rbox(6.4, 0.5, 2.8, 0.2), 0x8a5a30, 0, 0.8, 0),
        ...[[-2.2, 1.5], [2.2, 1.5], [-2.2, -1.5], [2.2, -1.5]].map(([x, z]) => P(G.cyl(0.75, 0.75, 0.4, 10), 0x2a2a2a, x, 0.75, z, { rx: PI / 2 })),
        P(G.rbox(5.2, 2.4, 1.9, 0.7), 0xf2ede2, 0, 3.4, 0), P(G.box(4.2, 1.9, 2.2), c1, -0.2, 3.3, 0),
        ...[[-1.8, 0.6], [1.8, 0.6], [-1.8, -0.6], [1.8, -0.6]].map(([x, z]) => P(G.cyl(0.4, 0.4, 1.6, 6), 0xf2ede2, x, 1.8, z)),
        P(G.rbox(1.5, 2.6, 1.4, 0.5), 0xf2ede2, 3.1, 4.9, 0, { rz: -0.5 }), P(G.rbox(1.9, 1.3, 1.3, 0.4), 0xf2ede2, 4.0, 5.9, 0, { rz: -0.9 }),
        P(G.cone(0.6, 2.6, 6), 0xf2ede2, -3.2, 3.2, 0, { rz: 0.9 }),
        P(G.rbox(1.6, 2.4, 1.7, 0.4), 0xb9c0c8, 0, 5.6, 0), P(G.sph(0.85, 10), 0xb9c0c8, 0.1, 7.4, 0), P(G.cone(0.3, 1.6, 5), c1, -0.1, 8.5, 0),
        P(G.cyl(0.16, 0.3, 9, 6), c2, 2.4, 5.5, -1.25, { rz: -PI / 2 }), P(G.cyl(1.0, 1.0, 0.2, 10), c1, 0.5, 5.7, 1.05, { rx: PI / 2 }),
      ]);
      const cols = [[0xd8423a, 0xf2c230], [0x2f62b8, 0xfaf5ea]];
      for (let k = 0; k < 2; k++) {
        const m = K.add(new T.Mesh(knight(cols[k][0], cols[k][1]), paint));
        A.knights.push(m);
        const o = {};
        K.mover({ type: 'box', hw: 3.3, hd: 1.4, h: 8 }, (t) => knightAt(k, t, o));
      }
      // tents and a stand at the west end
      const tent = (x, z, c) => { toy([P(G.cone(5, 6.5, 8), c, 0, 3.25, 0), P(G.cone(5.05, 6.5, 8), 0xfaf5ea, 0, 3.2, 0, { sx: 1, sz: 0.38 }), P(G.cyl(0.12, 0.12, 2.4, 4), 0x4a4a4a, 0, 7.4, 0), P(G.box(1.6, 0.9, 0.06), c, 0.8, 8.1, 0)], paint, x, 0, z, r() * 6); K.circle(x, z, 4.6, 7); K.contact(x, z, 6, 6, 0.4); };
      tent(-96, -14, 0xd8423a); tent(-88, 12, 0x2f62b8); tent(-74, -6, 0xf2c230);
      // archery targets
      for (const [x, z] of [[-70, 22], [-62, 26]]) { toy([P(G.cyl(2.2, 2.2, 0.5, 14), 0xe6c35a, 0, 3, 0, { rx: PI / 2 - 0.25 }), P(G.cyl(1.5, 1.5, 0.56, 14), 0xd8423a, 0, 3, 0, { rx: PI / 2 - 0.25 }), P(G.cyl(0.7, 0.7, 0.62, 10), 0xfaf5ea, 0, 3, 0, { rx: PI / 2 - 0.25 }), P(G.cyl(0.2, 0.2, 3.4, 5), 0x7a5230, -1, 1.6, -1, { rz: 0.3 }), P(G.cyl(0.2, 0.2, 3.4, 5), 0x7a5230, 1, 1.6, -1, { rz: -0.3 })], paint, x, 0, z); K.circle(x, z, 2, 5); }
    }

    // ---------------- the catapult (east infield) and its two marks on the road ----------------
    {
      const frame = [
        P(G.box(9, 0.9, 1), 0x8a5a30, 0, 1.3, 2.4), P(G.box(9, 0.9, 1), 0x8a5a30, 0, 1.3, -2.4), P(G.box(1, 0.9, 5.8), 0x8a5a30, -3.6, 1.3, 0), P(G.box(1, 0.9, 5.8), 0x8a5a30, 3.6, 1.3, 0),
        ...[[-3, 2.9], [3, 2.9], [-3, -2.9], [3, -2.9]].map(([x, z]) => P(G.cyl(1.3, 1.3, 0.6, 12), 0x5e3c22, x, 1.3, z, { rx: PI / 2 })),
        P(G.box(0.8, 6, 0.8), 0x8a5a30, 0.6, 4.4, 2.2), P(G.box(0.8, 6, 0.8), 0x8a5a30, 0.6, 4.4, -2.2), P(G.cyl(0.35, 0.35, 5.6, 6), 0x3a3a3a, 0.6, 6.6, 0, { rx: PI / 2 }),
      ];
      const sA = sAt(129, 20), sB = sAt(121, -14);
      for (const [s, lat] of [[sA, 2.6], [sB, -2.6]]) { const q = track.place(s, lat); A.spots.push({ x: q.x, z: q.z }); }
      // computer drivers wait for the knights and steer round the mark the next ball is flying to
      const sK = sAt(-121, TILT.z);
      A.haz = [{ s: sK, lo: -99, hi: 99, busy: (t) => { const u = mod(t - TILT.phase, TILT.period); return u > 0.4 && u < 1.55; } },
        ...[[sA, 2.6], [sB, -2.6]].map(([s, lat], i) => ({ s, lo: lat - 5.4, hi: lat + 5.4, busy: (t) => { const u = catU(t); return mod(catShot(t), 2) === i && u > CAT.fly - 0.35 && u < CAT.fly + 0.15; } }))];
      const aim = Math.atan2((A.spots[0].z + A.spots[1].z) / 2 - CAT.z, (A.spots[0].x + A.spots[1].x) / 2 - CAT.x);
      toy(frame, wood, CAT.x, 0, CAT.z, aim);
      const arm = new T.Mesh(geoOf([P(G.box(10, 0.7, 0.9), 0xb07a45, -2.6, 0, 0), P(G.cyl(1.5, 1.1, 1, 10), 0x5e3c22, -7.4, 0.5, 0), P(G.box(2, 2, 2), 0x6a6a6a, 2.6, -0.9, 0)]), wood);
      const piv = new T.Group(); piv.position.set(CAT.x + Math.cos(aim) * 0.6, 6.6, CAT.z + Math.sin(aim) * 0.6); piv.rotation.y = -aim; piv.add(arm); K.add(piv);
      A.arm = arm; A.aim = aim;
      K.circle(CAT.x, CAT.z, 5.2, 8); K.contact(CAT.x, CAT.z, 7, 6, 0.45, aim);
      A.ball = K.mesh(G.sph(1.5, 12), K.std({ color: 0xcf9f66, roughness: 0.6 }), CAT.x, -5, CAT.z);
      // a pile of spare balls
      K.instances(G.sph(1.5, 10), K.std({ color: 0xcf9f66, roughness: 0.6 }), [[0, 0], [3, 0.4], [1.5, 2.6]].map(([x, z]) => ({ x: CAT.x - 12 + x, y: 1.5, z: CAT.z + 8 + z })).concat([{ x: CAT.x - 10.5, y: 3.9, z: CAT.z + 9 }]));
      K.circle(CAT.x - 10.5, CAT.z + 9, 3.4, 4);
      for (const sp of A.spots) {
        const mat = K.std({ color: 0xb8322a, emissive: 0xff5a2a, emissiveIntensity: 0, roughness: 0.9, transparent: true, opacity: 0.75 });
        const ring = K.mesh(new T.RingGeometry(CAT.R - 1.2, CAT.R - 0.4, 36), mat, sp.x, 0.1, sp.z, { rx: -PI / 2, cast: false });
        const dot = K.mesh(new T.CircleGeometry(1.2, 20), mat, sp.x, 0.1, sp.z, { rx: -PI / 2, cast: false });
        A.rings.push({ ring, dot, mat });
      }
    }

    // ---------------- the countryside: a windmill, wheat fields, peg-doll people, a dragon on its rock ----------------
    {
      // windmill (west), its sails turning
      const wx = -54, wz = -20;
      toy([P(G.cyl(3.2, 4.4, 13, 10), 0xf2e6c8, 0, 6.5, 0), P(G.cone(4, 4, 10), 0xc8423a, 0, 15, 0), P(G.box(1.6, 3, 0.3), 0x7a5230, 0, 1.5, 4.3), P(G.cyl(0.4, 0.4, 2.4, 6), 0x5e3c22, 0, 12, 4, { rx: PI / 2 })], paint, wx, 0, wz);
      K.circle(wx, wz, 4.4, 18); K.contact(wx, wz, 6.5, 6.5, 0.45);
      const sails = [];
      for (let i = 0; i < 4; i++) sails.push(P(G.box(0.5, 9, 0.2), 0x7a5230, Math.sin(i * PI / 2) * 4.5, Math.cos(i * PI / 2) * 4.5, 0, { rz: -i * PI / 2 }), P(G.box(2.4, 7, 0.1), 0xfaf5ea, Math.sin(i * PI / 2) * 5 + Math.cos(i * PI / 2) * 1.3, Math.cos(i * PI / 2) * 5 - Math.sin(i * PI / 2) * 1.3, 0, { rz: -i * PI / 2 }));
      A.sails = toy(sails, paint, wx, 12, wz + 5.3);
      // wheat fields, ploughed in stripes
      const fc = TX.makeCanvas(128), fg = fc.getContext('2d');
      for (let i = 0; i < 16; i++) { fg.fillStyle = i % 2 ? '#e2c04a' : '#cfa832'; fg.fillRect(0, i * 8, 128, 8); }
      const ft = TX.toTexture(fc, { repeat: [1, 2] }), fm = K.std({ map: ft, roughness: 1 });
      for (const [x, z, w, d, a] of [[42, 72, 34, 20, 0.08], [74, 90, 26, 14, -0.1], [-64, 96, 30, 12, 0.05], [118, -92, 30, 14, 0.3], [-136, -90, 18, 22, 0.1], [-76, -24, 16, 12, 0.2]]) {
        if (!K.offRoad(x, z, Math.max(w, d) * 0.55 + 2)) continue;
        K.mesh(new T.BoxGeometry(w, 0.9, d), fm, x, 0.45, z, { ry: a });
        K.surface('slow', { poly: [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([px, pz]) => [x + px * Math.cos(a) + pz * Math.sin(a), z - px * Math.sin(a) + pz * Math.cos(a)]) });
      }
      // peg-doll people: at the tilt yard, in the courtyard, in the village
      const peg = geoOf([P(G.cyl(0.55, 0.8, 2.2, 8), 0xffffff, 0, 1.1, 0), P(G.sph(0.62, 8), 0xf2c9a0, 0, 2.7, 0)]);
      const folk = [];
      const stand = (x, z) => { if (K.offRoad(x, z, 2.5)) folk.push({ x, y: 0, z, color: r.pick([0xd8423a, 0x2f62b8, 0xf2c230, 0x3f9a4a, 0x8a4fd8, 0xfaf5ea, 0x8a5a30]) }); };
      for (let i = 0; i < 9; i++) { stand(TILT.x1 + 4 + i * 2.2, TILT.z - 7 - (i % 2) * 2); stand(TILT.x1 + 5 + i * 2.2, TILT.z + 7 + (i % 2) * 2); }
      for (const [x, z] of [[-24, 22], [-18, 12], [20, 26], [26, 14], [-26, -14], [-10, -34], [10, -36], [26, -30], [-24, 2], [14, 24]]) folk.push({ x, y: 0.02, z, color: r.pick([0xd8423a, 0x2f62b8, 0xf2c230, 0x3f9a4a, 0x8a4fd8]) });
      for (let i = 0; i < 26; i++) stand(r.range(-140, 140), r.range(-100, 100));
      K.instances(peg, paint, folk.filter((f) => !(f.z > MOAT.z0 - 2 && f.z < MOAT.z1 + 2 && Math.abs(f.x) < 48)), { colors: true });
      // the dragon on its rock (south-east), wings beating
      const dx = 120, dz = 86, g1 = 0x3f9a4a, g2 = 0x2c7a3a;
      toy([P(G.ico(1), 0x8a8478, 0, 2.4, 0, { sx: 9, sy: 3.4, sz: 7 }), P(G.sph(1, 12), g1, 0, 7, 0, { sx: 4.6, sy: 2.6, sz: 2.6 }), P(G.cone(1.6, 8, 8), g1, -6.5, 6.4, 0, { rz: PI / 2 + 0.25 }), P(G.cap(1, 3), g1, 4.2, 9, 0, { rz: -0.7 }), P(G.rbox(3.4, 1.8, 2, 0.5), g1, 6.4, 10.6, 0), P(G.cone(0.35, 1.4, 5), 0xf2c230, 5.4, 12, 0.6), P(G.cone(0.35, 1.4, 5), 0xf2c230, 5.4, 12, -0.6), P(G.sph(0.25, 5), 0xd8423a, 7.2, 11.1, 0.8), P(G.sph(0.25, 5), 0xd8423a, 7.2, 11.1, -0.8),
        ...[-2, 0, 2].map((x) => P(G.cone(0.6, 1.5, 4), g2, x, 9.8, 0)), P(G.cap(0.7, 1.6), g2, 2, 4.6, 1.6), P(G.cap(0.7, 1.6), g2, 2, 4.6, -1.6), P(G.cap(0.7, 1.6), g2, -2.4, 4.6, 1.6), P(G.cap(0.7, 1.6), g2, -2.4, 4.6, -1.6)], paint, dx, 0, dz, -2.5);
      K.circle(dx, dz, 7.5, 12); K.contact(dx, dz, 10, 8, 0.4);
      A.wings = [1, -1].map((sg) => { const m = toy([P(G.cone(4, 9, 3), 0xd8423a, 0, 0, sg * 4.5, { rx: sg * PI / 2, sz: 0.1 })], paint, dx, 9, dz, -2.5); m.userData.sg = sg; return m; });
    }

    // ---------------- mud on the north road ----------------
    {
      const q = track.place(sAt(40, -88), -2.8);
      const sp = K.spill(q.x, q.z, 5.6, K.phys({ color: 0x5a4028, roughness: 0.15, clearcoat: 0.8 }), { lump: 0.4, stretch: 1.5, angle: q.angle, y: 0.12, thick: 0.2 });
      K.surface('sticky', { poly: sp.poly });
      // the pigs that made it
      const pig = geoOf([P(G.sph(1, 10), 0xf2a7a0, 0, 1.3, 0, { sx: 1.9, sy: 1.2, sz: 1.2 }), P(G.sph(0.8, 8), 0xf2a7a0, 1.8, 1.6, 0), P(G.cyl(0.35, 0.35, 0.3, 8), 0xe88a84, 2.6, 1.5, 0, { rz: PI / 2 }), ...[[-1, 0.6], [1, 0.6], [-1, -0.6], [1, -0.6]].map(([x, z]) => P(G.cyl(0.28, 0.28, 0.9, 5), 0xe88a84, x, 0.4, z))]);
      K.instances(pig, paint, [{ x: q.x + 2, y: 0, z: q.z - 13, ry: 0.6 }, { x: q.x - 5, y: 0, z: q.z - 15, ry: 2.2 }, { x: q.x + 8, y: 0, z: q.z + 13, ry: -1 }]);
    }

    // ---------------- the village and the woods ----------------
    {
      const house = (x, z, a, roof) => {
        toy([P(G.box(8, 5, 6), 0xf2e6c8, 0, 2.5, 0), P(G.cone(6.2, 4.2, 4), roof, 0, 7.1, 0, { ry: PI / 4, sz: 0.78 }), P(G.box(1.6, 2.8, 0.2), 0x7a5230, -1.5, 1.4, 3.05), P(G.box(1.5, 1.5, 0.2), 0x9fd0f0, 2, 3, 3.05), P(G.box(8.1, 0.4, 0.25), 0x7a5230, 0, 4.9, 3.05), P(G.box(1.3, 3, 1.3), 0xb86a4a, 2.4, 8, -1)], paint, x, 0, z, a);
        K.box(x, z, 4.2, 3.2, a, 9); K.contact(x, z, 6, 5, 0.4, a);
      };
      for (const [x, z, a, c] of [[66, -38, 0.2, 0xc8423a], [84, -24, -0.4, 0x8a5a30], [60, 34, 0.1, 0x2f62b8], [-70, -46, 0.3, 0xc8423a], [-56, -62, -0.2, 0x8a5a30], [-72, 52, 0.15, 0x2f62b8], [-50, 58, -0.3, 0xc8423a], [136, -84, 0.4, 0x8a5a30]]) if (K.offRoad(x, z, 7)) house(x, z, a, c);
      const tree = geoOf([P(G.cyl(0.5, 0.6, 2.6, 6), 0x8a5a30, 0, 1.3, 0), P(G.cone(2.6, 4.4, 8), 0x3f9a4a, 0, 4.4, 0), P(G.cone(2.0, 3.4, 8), 0x55b05a, 0, 6.6, 0), P(G.cyl(1.2, 1.2, 0.4, 8), 0xb07a45, 0, 0.2, 0)]);
      const ts = [];
      scatter(tree, paint, 46, [-146, 146, -102, 102], 5, (x, z) => {
        if ((x > WALL.x0 - 6 && x < WALL.x1 + 6 && z > WALL.z0 - 6 && z < 62) || !K.offRoad(x, z - 5, 2) || ts.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) return null;
        if (Math.abs(z - TILT.z) < 6 && x < TILT.x1 + 6) return null;
        if (Math.hypot(x - CAT.x, z - CAT.z) < 26) return null;
        const t = { x, y: 0, z, ry: r() * 6, s: r.range(0.85, 1.35) };
        ts.push(t); K.circle(x, z, 1.1, 6);
        return t;
      });
      // flowers and stones
      scatter(G.sph(0.4, 6), plain, 120, [-146, 146, -102, 102], 2, (x, z) => ((x > WALL.x0 && x < WALL.x1 && z > WALL.z0 && z < MOAT.z1) ? null : { x, y: 0.25, z, s: r.range(0.7, 1.3), sy: 0.6, color: r.pick([0xffffff, 0xf2c230, 0xe86aa0, 0xd8423a, 0x9a948a, 0xb5ab98]) }), { cast: false });
    }
    // ================= detail pass: the start, life on the walls and in the yard, the camp, sheep, an orchard =================
    {
      TM.signBoard(-28, 66, 'CASTLE SIEGE', { w: 28, h: 5.6, bg: '#2f62b8', fg: '#ffe9a8', edge: '#f2c230', post: 0x7a5230 });
      TM.bunting(29.5, [0xd8423a, 0xfaf5ea, 0x2f62b8, 0xf2c230], { post: 0x8a5a30, mat: paint });
      // where the knights cross: hoof-marked sand over the cobbles
      TM.decal(sAt(-121, TILT.z), 0, 10.5, W + 1, (g, w, h) => {
        g.fillStyle = 'rgba(216,192,138,0.85)'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(120,90,50,0.8)'; g.lineWidth = 2.5; const rr = K.rng(9);
        for (let i = 0; i < 46; i++) { const x = rr() * w, y = h * (0.12 + rr() * 0.76); g.beginPath(); g.arc(x, y, 3.4, 0.3, 2.84); g.stroke(); }
      }, { px: 256 });

      // arrow slits, tower windows, banners at the gate, torches
      const D = [], zs = WALL.z1 + WALL.t / 2 + 0.06;
      for (const x of [-29, -23, -17, 17, 23, 29]) D.push(P(G.box(0.5, 2.3, 0.14), 0x2a2a30, x, 4.6, zs), P(G.box(1.4, 0.4, 0.14), 0x2a2a30, x, 4.9, zs));
      for (const [x, z, rad] of [[WALL.x0, WALL.z1, 5], [WALL.x1, WALL.z1, 5], [WALL.x0, WALL.z0, 5.5], [WALL.x1, WALL.z0, 5.5]]) D.push(P(G.box(1, 2, 0.2), 0x2a2a30, x, 9, z + rad * 1.03), P(G.box(1, 2, 0.2), 0x2a2a30, x - rad * 0.6, 6.5, z + rad * 0.86, { ry: -0.62 }), P(G.box(1, 2, 0.2), 0x2a2a30, x + rad * 0.6, 6.5, z + rad * 0.86, { ry: 0.62 }));
      for (const sx of [-1, 1]) D.push(P(G.box(2.3, 5, 0.12), sx < 0 ? 0xc8423a : 0x2f62b8, sx * 12, 7.6, WALL.z1 + 3.1), P(G.cyl(0.75, 0.75, 0.14, 10), 0xf2c230, sx * 12, 8.4, WALL.z1 + 3.18, { rx: PI / 2 }), P(G.cone(1.15, 1.4, 3), sx < 0 ? 0xc8423a : 0x2f62b8, sx * 12, 4.5, WALL.z1 + 3.1, { rz: PI, sz: 0.1 }));
      toy(D, paint);
      A.torch = K.std({ color: 0xffb347, emissive: 0xff7a1f, emissiveIntensity: 2, roughness: 0.6 });
      const torches = [];
      for (const [x, z] of [[-8.4, WALL.z1 + 2.3], [8.4, WALL.z1 + 2.3], [WALL.x1 + 2.3, -25.4], [WALL.x1 + 2.3, -6.6], [-12, -23], [-26, -23]]) torches.push({ x, y: 6.3, z });
      K.instances(G.sph(0.5, 6), A.torch, torches, { cast: false });
      K.instances(G.cyl(0.14, 0.14, 1.4, 4), K.std({ color: 0x4a3a2a }), torches.map((t) => ({ x: t.x, y: 5.4, z: t.z })), { cast: false });
      // sentries on the wall walk
      const peg = geoOf([P(G.cyl(0.55, 0.8, 2.2, 8), 0xffffff, 0, 1.1, 0), P(G.sph(0.62, 8), 0xb9c0c8, 0, 2.7, 0), P(G.cyl(0.07, 0.07, 3.6, 4), 0x7a5230, 0.75, 1.8, 0)]);
      const sentries = [];
      for (const x of [-27, -19, 19, 27]) sentries.push({ x, y: WALL.h, z: WALL.z1 });
      for (const z of [-34, -14, 6, 22]) { sentries.push({ x: WALL.x0, y: WALL.h, z }); if (z > -4 || z < -28) sentries.push({ x: WALL.x1, y: WALL.h, z }); }
      for (const x of [-20, 0, 20]) sentries.push({ x, y: WALL.h, z: WALL.z0 });
      K.instances(peg, paint, sentries.map((t, i) => ({ ...t, color: i % 2 ? 0xd8423a : 0x2f62b8 })), { colors: true });

      // in the courtyard: a stable with two horses, the smithy with its fire, a hay cart
      const horse = (c) => [P(G.rbox(4.2, 2, 1.5, 0.6), c, 0, 3, 0), ...[[-1.5, 0.45], [1.5, 0.45], [-1.5, -0.45], [1.5, -0.45]].map(([x, z]) => P(G.cyl(0.3, 0.3, 2.2, 5), c, x, 1.1, z)), P(G.rbox(1.2, 2.4, 1.1, 0.4), c, 2.4, 4.3, 0, { rz: -0.5 }), P(G.rbox(1.7, 1, 1, 0.3), c, 3.3, 5.2, 0, { rz: -0.8 }), P(G.cone(0.4, 2, 5), 0x3a2a20, -2.5, 3, 0, { rz: 0.8 })];
      toy([P(G.box(11, 0.4, 6.4), 0x8a5a30, 0, 5.4, 0, { rx: 0.2 }), ...[[-5, 2.8], [5, 2.8], [-5, -2.8], [5, -2.8]].map(([x, z]) => P(G.cyl(0.3, 0.3, 5.4, 5), 0x7a5230, x, 2.7, z)), P(G.box(10, 2.2, 0.3), 0x9a6a3a, 0, 1.1, -2.9), P(G.rbox(4, 1, 1.4, 0.2), 0x7a5230, 0, 0.5, 2.2),
        ...horse(0x8a5a30).map((q) => q.translate(-2.6, 0, -0.4)), ...horse(0xf2ede2).map((q) => q.translate(2.6, 0, -0.4))], paint, 27, 0, 6, PI / 2);
      K.box(27, 6, 3.3, 5.6, 0, 6); K.contact(27, 6, 5, 7, 0.4);
      toy([P(G.box(5, 4, 4), 0x8f887b, 0, 2, 0), P(G.box(1.6, 5, 1.6), 0x77716a, -1.2, 6.2, -0.8), P(G.box(4.2, 0.6, 3), 0x3a3a3a, 5.2, 1.7, 0.4), P(G.box(1.2, 1.4, 1.6), 0x4a4a4a, 5.2, 0.7, 0.4), P(G.cyl(0.9, 1, 1.6, 8), 0x7a5230, 3.4, 0.8, -2.6)], paint, -27, 0, 26);
      A.forge = K.std({ color: 0xff8a2a, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 0.5 });
      K.mesh(G.box(2.6, 1.6, 0.2), A.forge, -27, 1.5, 28.1, { cast: false });
      K.box(-26, 26, 5, 2.6, 0, 6); K.contact(-26, 26, 6.5, 4, 0.4);
      toy([P(G.box(6, 0.5, 3.2), 0x8a5a30, 0, 1.8, 0), P(G.box(6, 1.6, 0.3), 0x9a6a3a, 0, 2.8, 1.6), P(G.box(6, 1.6, 0.3), 0x9a6a3a, 0, 2.8, -1.6), P(G.rbox(5.4, 2.6, 2.8, 0.9), 0xe6c35a, 0, 3.4, 0),
        ...[[-1.8, 1.9], [1.8, 1.9], [-1.8, -1.9], [1.8, -1.9]].map(([x, z]) => P(G.cyl(1.3, 1.3, 0.4, 12), 0x5e3c22, x, 1.3, z, { rx: PI / 2 })), P(G.box(4, 0.3, 0.3), 0x7a5230, 5, 1.6, 0.9, { rz: -0.15 }), P(G.box(4, 0.3, 0.3), 0x7a5230, 5, 1.6, -0.9, { rz: -0.15 })], paint, -15, 0, -17, 0.4);
      K.box(-15, -17, 3.4, 2.2, 0.4, 5); K.contact(-15, -17, 5, 3.4, 0.4, 0.4);

      // the siege camp by the catapult: tents, a rack of shields, the campfire
      for (const [x, z, c] of [[112, 4, 0x8a5a30], [101, 0, 0xc8423a]]) if (K.offRoad(x, z, 6)) { toy([P(G.cone(3.6, 4.6, 6), 0xe9dfc6, 0, 2.3, 0), P(G.cone(3.65, 4.6, 6), c, 0, 2.28, 0, { sx: 1, sz: 0.34 }), P(G.box(1.4, 2.2, 0.2), 0x3a2a20, 0, 1.1, 2.9)], paint, x, 0, z, r() * 0.6); K.circle(x, z, 3.2, 5); K.contact(x, z, 4.4, 4.4, 0.4); }
      if (K.offRoad(114, 34, 4.5)) {
        toy([...[0, 1, 2, 3, 4, 5].map((i) => P(G.ico(0.6), 0x8a8478, Math.cos(i * 1.047) * 1.7, 0.4, Math.sin(i * 1.047) * 1.7)), P(G.cyl(0.3, 0.3, 2.6, 5), 0x5e3c22, 0, 0.5, 0, { rz: PI / 2 }), P(G.cyl(0.3, 0.3, 2.6, 5), 0x5e3c22, 0, 0.5, 0, { rz: PI / 2, ry: 1.3 })], paint, 114, 0, 34);
        A.fire = K.mesh(G.cone(0.9, 2.4, 6), K.std({ color: 0xffb347, emissive: 0xff6a10, emissiveIntensity: 2.2, roughness: 0.6 }), 114, 1.6, 34, { cast: false });
        K.circle(114, 34, 2, 2);
      }
      if (K.offRoad(96, 10, 4)) { toy([P(G.box(6, 0.3, 0.3), 0x7a5230, 0, 2.6, 0), P(G.cyl(0.2, 0.2, 3, 4), 0x7a5230, -2.8, 1.5, 0), P(G.cyl(0.2, 0.2, 3, 4), 0x7a5230, 2.8, 1.5, 0), ...[-1.8, 0, 1.8].map((x, i) => P(G.cyl(1.05, 1.05, 0.2, 10), [0xd8423a, 0x2f62b8, 0xf2c230][i], x, 1.5, 0.25, { rx: PI / 2 - 0.2 }))], paint, 96, 0, 10, 0.4); K.box(96, 10, 3, 0.6, 0.4, 3); }

      // sheep in a fold (south-west), an orchard behind the castle, a scarecrow in the wheat
      {
        const fx = -128, fz = 92, posts = [];
        for (let i = 0; i < 16; i++) { const a = i * 0.3927; posts.push(P(G.cyl(0.28, 0.28, 2, 5), 0x8a5a30, fx + Math.cos(a) * 10, 1, fz + Math.sin(a) * 10)); }
        posts.push(P(G.tor(10, 0.16, PI * 2, 32), 0x9a6a3a, fx, 1.5, fz, { rx: PI / 2 }), P(G.tor(10, 0.16, PI * 2, 32), 0x9a6a3a, fx, 0.8, fz, { rx: PI / 2 }));
        toy(posts, paint);
        for (let i = 0; i < 16; i++) { const a = i * 0.3927; K.circle(fx + Math.cos(a) * 10, fz + Math.sin(a) * 10, 0.9, 2); }
        const sheep = geoOf([P(G.sph(1, 8), 0xfaf5ea, 0, 1.3, 0, { sx: 1.5, sy: 1.05, sz: 1.1 }), P(G.sph(0.5, 6), 0x2a2a2a, 1.5, 1.6, 0), ...[[-0.7, 0.4], [0.7, 0.4], [-0.7, -0.4], [0.7, -0.4]].map(([x, z]) => P(G.cyl(0.14, 0.14, 0.8, 4), 0x2a2a2a, x, 0.4, z))]);
        K.instances(sheep, paint, [0, 1, 2, 3, 4, 5, 6].map(() => { const a = r() * 6.28, q = r.range(1, 7.5); return { x: fx + Math.cos(a) * q, y: 0, z: fz + Math.sin(a) * q, ry: r() * 6, s: r.range(0.85, 1.1) }; }));
        const apple = geoOf([P(G.cyl(0.35, 0.45, 2.4, 6), 0x8a5a30, 0, 1.2, 0), P(G.sph(2.3, 9), 0x4fa84a, 0, 3.8, 0, { sy: 0.85 }), ...[[1.4, 4.4, 1], [-1.2, 3.6, 1.5], [0.4, 3.2, 2], [-0.6, 4.9, 0.9], [1.9, 3.4, -0.4], [-1.9, 4.2, 0.2]].map(([x, y, z]) => P(G.sph(0.32, 5), 0xd8423a, x, y, z))]);
        const orch = [];
        for (let i = 0; i < 7; i++) for (const z of [-72, -63]) { const x = -26 + i * 9 + (z === -63 ? 4 : 0); if (K.offRoad(x, z, 4) && K.offRoad(x, z - 3, 2)) { orch.push({ x, y: 0, z, ry: r() * 6, s: r.range(0.9, 1.1) }); K.circle(x, z, 0.9, 5); } }
        K.instances(apple, paint, orch);
        toy([P(G.cyl(0.2, 0.2, 5, 5), 0x7a5230, 0, 2.5, 0), P(G.cyl(0.18, 0.18, 4.4, 5), 0x7a5230, 0, 3.6, 0, { rz: PI / 2 }), P(G.rbox(1.6, 2, 0.8, 0.3), 0xc8423a, 0, 3.2, 0), P(G.sph(0.7, 8), 0xe6c35a, 0, 4.9, 0), P(G.cone(1.1, 1, 8), 0x5e3c22, 0, 5.7, 0)], paint, 42, 0.9, 72, 0.3);
      }
      // banners that stir in the wind
      A.flags = [];
      for (const [x, z, c] of [[-100, -11, 0xd8423a], [-100, 11, 0x2f62b8], [-40, 68, 0xf2c230], [WALL.x0 - 6, WALL.z1 + 4, 0xc8423a], [WALL.x1 + 6, WALL.z1 + 4, 0x2f62b8]]) {
        if (!K.offRoad(x, z, 2.5)) continue;
        K.mesh(G.cyl(0.2, 0.28, 11, 6), K.std({ color: 0x7a5230 }), x, 5.5, z); K.circle(x, z, 0.5, 8);
        A.flags.push(toy([P(G.box(4.4, 2.6, 0.08), c, 2.3, 0, 0), P(G.cyl(0.6, 0.6, 0.1, 8), 0xf2c230, 2.2, 0, 0.06, { rx: PI / 2 })], paint, x, 9.4, z, 0));
      }
    }

  },

  aiHazards() { return A ? A.haz : null; },

  tick(dt, time, game) {
    if (!A || !A.spots.length) return;
    // a car in the moat starts again with a run-up to the bridge
    for (const e of game.cars) {
      const c = e.car, k = c.index;
      if (c.state === 'falling' && c.fallKind === 'hole') {
        if (!A.fell.has(k)) { A.fell.add(k); if (game.sound && (game.state === 'race' || game.state === 'roundEnd')) game.sound.splash(30, game.panOf(c.x, c.z)); }
        const rel = mod(e.lastGoodS - A.sJ + 60, A.L) - 60;
        if (rel > -12 && rel < 34) e.lastGoodS = mod(A.sJ - 26, A.L);
      } else A.fell.delete(k);
    }
    // the knights' bell, the catapult's shot
    if (fired(A.prevT, time, TILT.period, TILT.phase - 1.0) && game.sound) game.sound.cue('bell', { x: -121, z: TILT.z, game });
    if (fired(A.prevT, time, CAT.period, CAT.phase) && game.sound) game.sound.cue('clank', { x: CAT.x, z: CAT.z, game });
    if (fired(A.prevT, time, CAT.period, CAT.phase + CAT.fly)) { const sp = A.spots[mod(catShot(time - CAT.fly * 0.5), 2)]; blast(game, sp.x, sp.z, CAT.R, 15, { shake: 0.3 }); }
    A.prevT = time;
  },

  animate(time) {
    if (!A || !A.arm) return;
    const o = {};
    A.knights.forEach((m, k) => { knightAt(k, time, o); m.position.set(o.x, 0, o.z); m.rotation.y = o.dir > 0 ? 0 : PI; });
    // catapult: the arm winds back, flies forward at the shot; the ball follows an arc to this shot's mark
    const u = catU(time), n = catShot(time), sp = A.spots[mod(n, 2)];
    A.arm.rotation.z = u < 0.18 ? 0.5 - 1.7 * (u / 0.18) : -1.2 + 1.7 * ss(1.6, CAT.period - 0.6, u);
    if (u < CAT.fly) {
      const k = u / CAT.fly, x0 = CAT.x, z0 = CAT.z;
      A.ball.position.set(x0 + (sp.x - x0) * k, 9 + 14 * 4 * k * (1 - k) - 7.5 * k, z0 + (sp.z - z0) * k);
    } else if (u < CAT.fly + 0.9) {
      const k = (u - CAT.fly) / 0.9, a = A.aim + 0.5;
      A.ball.position.set(sp.x + Math.cos(a) * 9 * k, 1.5 + 3 * 4 * k * (1 - k) * (1 - k), sp.z + Math.sin(a) * 9 * k);
    } else A.ball.position.y = -6;
    // the next mark warms up before the shot, the current one stays hot until the ball is down
    const warm = clamp((u - (CAT.period - 2.2)) / 1.8, 0, 1), nextI = mod(n + 1, 2);
    A.rings.forEach((R, i) => {
      const hot = i === mod(n, 2) && u < CAT.fly ? 1 : i === nextI ? warm * (0.6 + 0.4 * Math.sin(time * 14)) : 0;
      R.mat.emissiveIntensity = hot * 1.6; R.mat.opacity = 0.45 + 0.5 * hot;
      R.ring.scale.setScalar(1 + 0.08 * hot);
    });
    A.sails.rotation.z = time * 0.9;
    if (A.torch) {
      A.torch.emissiveIntensity = 1.8 + 0.6 * Math.sin(time * 13) + 0.4 * Math.sin(time * 7.3);
      A.forge.emissiveIntensity = 1.4 + 0.5 * Math.sin(time * 5.1);
      if (A.fire) { A.fire.scale.set(1 + 0.15 * Math.sin(time * 11), 1 + 0.25 * Math.sin(time * 8.3), 1 + 0.15 * Math.sin(time * 9.7)); A.fire.rotation.y = time * 3; }
      A.flags.forEach((m, i) => { m.rotation.y = 0.35 * Math.sin(time * 2.1 + i * 1.7) + 0.15 * Math.sin(time * 5.3 + i); });
    }
    for (const w of A.wings) w.rotation.x = w.userData.sg * (0.35 + 0.3 * Math.sin(time * 2.4));
  },
};
