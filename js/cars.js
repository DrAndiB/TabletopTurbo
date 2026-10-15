// Toy car models built from simple geometry: sports coupé, rally hatch, formula racer, 4x4 truck and Mars rover.
import * as THREE from '../vendor/three.bundle.js';
import { RoundedBoxGeometry, BufferGeometryUtils } from '../vendor/three.bundle.js';
import { blobShadowTexture, makeCanvas, toTexture } from './textures.js';

const shared = {};
function mats() {
  if (shared.tire) return shared;
  shared.tire = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.85, metalness: 0 });
  shared.rim = new THREE.MeshStandardMaterial({ color: 0xd9dce1, roughness: 0.22, metalness: 1 });
  shared.darkRim = new THREE.MeshStandardMaterial({ color: 0x3a3d43, roughness: 0.35, metalness: 0.9 });
  shared.glass = new THREE.MeshPhysicalMaterial({ color: 0x0d1620, roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 });
  shared.chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 1 });
  shared.black = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.55, metalness: 0.1 });
  shared.head = new THREE.MeshStandardMaterial({ color: 0xfffbea, emissive: 0xfff1c0, emissiveIntensity: 0.8, roughness: 0.2 });
  shared.tail = new THREE.MeshStandardMaterial({ color: 0xd01515, emissive: 0xff1a10, emissiveIntensity: 0.6, roughness: 0.3 });
  shared.white = new THREE.MeshPhysicalMaterial({ color: 0xf7f7f2, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  shared.shadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, alphaMap: blobShadowTexture(), depthWrite: false });
  shared.alu = new THREE.MeshStandardMaterial({ color: 0xc2c5ca, roughness: 0.42, metalness: 0.9 });
  shared.gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.28, metalness: 1 });
  shared.helmetVisor = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.05, metalness: 0.6, clearcoat: 1 });
  // soft rubber with a little sheen (hovercraft skirt, bumper-car ring), so the cushions catch the light
  shared.rubber = new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.62, metalness: 0 });
  // bumper-car pole spark: additive glow, shared by every car (toggled per car in syncCar)
  shared.spark = new THREE.SpriteMaterial({ map: sparkTexture(), color: 0xd6ecff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
  return shared;
}

function sparkTexture() {
  const c = makeCanvas(64);
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.18, 'rgba(255,250,220,0.95)');
  rg.addColorStop(0.45, 'rgba(140,200,255,0.35)'); rg.addColorStop(1, 'rgba(80,140,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  // a few jagged rays
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.3, r1 = 8, r2 = 20 + (i % 3) * 5;
    g.beginPath(); g.moveTo(32 + Math.cos(a) * r1, 32 + Math.sin(a) * r1);
    g.lineTo(32 + Math.cos(a + 0.25) * (r1 + r2) / 2, 32 + Math.sin(a + 0.25) * (r1 + r2) / 2);
    g.lineTo(32 + Math.cos(a) * r2, 32 + Math.sin(a) * r2); g.stroke();
  }
  return toTexture(c, { wrap: false });
}

const hexStr = (c) => '#' + c.toString(16).padStart(6, '0');
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Rounded rectangle in plan (x along the car, second coordinate across it): half-length a, half-width b,
// corner radius rc, centred on x = cx. Pass THREE.Path to get a hole outline instead of a shape.
function roundedRect(a, b, rc, cx = 0, Kind = THREE.Shape) {
  const p = new Kind();
  const sx = a - rc, sz = b - rc;
  p.moveTo(cx, -b);
  p.lineTo(cx + sx, -b); p.absarc(cx + sx, -sz, rc, -Math.PI / 2, 0, false);
  p.lineTo(cx + a, sz); p.absarc(cx + sx, sz, rc, 0, Math.PI / 2, false);
  p.lineTo(cx - sx, b); p.absarc(cx - sx, sz, rc, Math.PI / 2, Math.PI, false);
  p.lineTo(cx - a, -sz); p.absarc(cx - sx, -sz, rc, Math.PI, Math.PI * 1.5, false);
  p.lineTo(cx, -b);
  return p;
}

// Extrude a plan shape upwards: y runs from -bevel to depth + bevel (the caps keep the shape's outline,
// the sides bulge out by `bevel`).
function planExtrude(shape, depth, bevel, segs = 2, curveSegments = 5) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments });
  g.rotateX(-Math.PI / 2);
  return g;
}

// A fat tube swept round a rounded-rectangle path (hovercraft skirt, bumper-car ring, trims).
// rh/rv: the tube's horizontal/vertical radius, yc: height of its centre line. With segs > 0 the tube is
// pinched every 1/segs of the way round, so it reads as a ring of separate rubber cushions (hard creases).
function tubeRing(a, b, rc, { rh, rv, yc, radial = 10, n = 64, segs = 0, perSeg = 4, pinch = 0.86 }) {
  const N = segs > 0 ? segs * perSeg : n;
  const pts = roundedRect(a, b, rc).getSpacedPoints(N);
  const frame = (i) => {
    const p = pts[(i + N) % N], q = pts[(i + 1) % N], o = pts[(i - 1 + N) % N];
    const tx = q.x - o.x, tz = q.y - o.y, l = Math.hypot(tx, tz) || 1;
    return { x: p.x, z: p.y, nx: tz / l, nz: -tx / l };
  };
  const pos = [], idx = [];
  const ring = (f, k) => {
    const base = pos.length / 3;
    for (let j = 0; j < radial; j++) {
      const ph = (j / radial) * Math.PI * 2, h = Math.cos(ph) * rh * k, v = Math.sin(ph) * rv * k;
      pos.push(f.x + f.nx * h, yc + v, f.z + f.nz * h);
    }
    return base;
  };
  const strip = (r0, r1) => {
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      const A = r0 + j, B = r1 + j, C = r1 + j1, Dd = r0 + j1;
      idx.push(A, Dd, B, B, Dd, C);
    }
  };
  if (segs > 0) {
    for (let s = 0; s < segs; s++) {
      let prev = -1;
      for (let j = 0; j <= perSeg; j++) {
        const u = j / perSeg;
        const r = ring(frame(s * perSeg + j), pinch + (1 - pinch) * Math.pow(Math.sin(Math.PI * u), 0.4));
        if (prev >= 0) strip(prev, r);
        prev = r;
      }
    }
  } else {
    const first = ring(frame(0), 1);
    let prev = first;
    for (let i = 1; i < N; i++) { const r = ring(frame(i), 1); strip(prev, r); prev = r; }
    strip(prev, first);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Merge all direct mesh children of a group that share a material into one mesh (fewer draw calls).
export function mergeByMaterial(group, keep = () => false) {
  const buckets = new Map();
  group.updateMatrix();
  for (const ch of [...group.children]) {
    if (!ch.isMesh || keep(ch) || Array.isArray(ch.material)) continue;
    ch.updateMatrix();
    const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
    g.applyMatrix4(ch.matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!buckets.has(ch.material)) buckets.set(ch.material, []);
    buckets.get(ch.material).push({ g, ch });
  }
  for (const [mat, items] of buckets) {
    if (items.length < 2) continue;
    const merged = BufferGeometryUtils.mergeGeometries(items.map((i) => i.g), false);
    if (!merged) continue;
    for (const i of items) group.remove(i.ch);
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

function metallicMat(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.04 });
}

function bodyMat(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 });
}

function numberDecal(num, color) {
  const c = makeCanvas(128);
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf3'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.lineWidth = 7; g.strokeStyle = '#1a1a1a'; g.stroke();
  g.fillStyle = '#1a1a1a';
  g.font = '900 86px "Lilita One", "Rubik", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(num), 64, 70);
  const t = toTexture(c, { wrap: false });
  return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
}

// Extrude a side profile (x along length, y up) across the width (z).
function profileExtrude(points, width, bevel = 0.12, segs = 3) {
  const sh = new THREE.Shape();
  sh.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) sh.lineTo(points[i][0], points[i][1]);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 6 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

function smoothProfile(pts, iterations = 2) {
  // Chaikin corner cutting for softer silhouettes
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}

function makeWheel(r, w, rimMat, M) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22, 1), M.tire);
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  // sidewall bulge (torus) for a softer toy-tyre look
  const bulge = new THREE.Mesh(new THREE.TorusGeometry(r * 0.86, w * 0.18, 8, 22), M.tire);
  bulge.position.z = w * 0.32; g.add(bulge);
  const bulge2 = bulge.clone(); bulge2.position.z = -w * 0.32; g.add(bulge2);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, w * 1.02, 16), rimMat);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  // spokes so the spin is visible
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 0.95, r * 0.14, w * 1.06), M.darkRim);
    sp.rotation.z = (i / 5) * Math.PI;
    g.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 1.1, 10), M.chrome);
  hub.rotation.x = Math.PI / 2; g.add(hub);
  mergeByMaterial(g);
  return g;
}

// Rover wheel: machined aluminium drum with chevron grousers and a dark hub.
function makeRoverWheel(r, w, M) {
  const g = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.94, w, 20, 1, true), M.alu);
  drum.rotation.x = Math.PI / 2; g.add(drum);
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 20), M.darkRim);
    face.position.z = s * w * 0.42; face.rotation.y = s < 0 ? Math.PI : 0; g.add(face);
  }
  // grousers: thin ridges around the tread, alternately angled (chevrons)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const gr = new THREE.Mesh(new THREE.BoxGeometry(r * 0.12, r * 0.12, w * 1.02), M.alu);
    gr.position.set(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94, 0);
    gr.rotation.z = a; gr.rotation.x = (i % 2 ? 0.35 : -0.35);
    g.add(gr);
  }
  // spokes on the outer face so the spin reads
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.7, r * 0.13, 0.06), M.alu);
    sp.rotation.z = (i / 3) * Math.PI; sp.position.z = w * 0.45; g.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w * 1.1, 10), M.alu);
  hub.rotation.x = Math.PI / 2; g.add(hub);
  mergeByMaterial(g); // two draw calls per wheel: aluminium and the dark faces
  return g;
}

// Monster-truck tyre: fat, deeply lugged, with a coloured rim.
function makeMonsterWheel(r, w, rimMat, M) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, w, 24, 1), M.tire);
  tire.rotation.x = Math.PI / 2; g.add(tire);
  for (const s of [-1, 1]) {
    const bulge = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, w * 0.2, 8, 24), M.tire);
    bulge.position.z = s * w * 0.36; g.add(bulge);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const lug = new THREE.Mesh(new THREE.BoxGeometry(r * 0.2, r * 0.16, w * 0.46), M.tire);
    lug.position.set(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93, (i % 2 ? 1 : -1) * w * 0.25);
    lug.rotation.z = a; g.add(lug);
  }
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w * 1.04, 16), rimMat);
  rim.rotation.x = Math.PI / 2; g.add(rim);
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 0.85, r * 0.1, w * 1.08), M.darkRim);
    sp.rotation.z = (i / 6) * Math.PI; g.add(sp);
  }
  mergeByMaterial(g);
  return g;
}

// Hovercraft roof: longitudinal ribbing, a rim in the player's colour and the race number, as one decal.
// The canvas is the roof seen from above with the bow at the top.
function hoverRoofDecal(num, colorDef) {
  const W = 128, H = 196;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  for (let x = 17; x < W - 14; x += 8) {
    g.fillStyle = 'rgba(40,45,55,0.16)'; g.fillRect(x, 10, 2, H - 20);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x + 2, 10, 1.5, H - 20);
  }
  g.strokeStyle = hexStr(colorDef.body); g.lineWidth = 15;
  g.beginPath(); g.roundRect(7.5, 7.5, W - 15, H - 15, 10); g.stroke();
  g.fillStyle = '#fbfaf3'; g.beginPath(); g.arc(W / 2, H / 2 + 6, 40, 0, Math.PI * 2); g.fill();
  g.lineWidth = 5; g.strokeStyle = '#1a1a1a'; g.stroke();
  g.fillStyle = '#1a1a1a';
  g.font = '900 58px "Lilita One", "Rubik", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(num), W / 2, H / 2 + 10);
  const t = toTexture(c, { wrap: false });
  return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
}

// Hovercraft after a classic RC model: white stadium-shaped hull on a fat, segmented rubber skirt, a long
// low cabin with a band of windows in the player's colour, ribbed roof with mast, twin ducted fans with
// striped shrouds, and a rudder behind each fan. Returns the two propellers (spun in syncCar).
function buildHover(add, tilt, body, M, colorDef, num, wheels) {
  const D = 0.68; // deck top
  const box = (w, h, d, mat, x, y, z) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); return m; };
  // skirt: a ring of fat rubber cushions; the deck slab sits on top of it
  add(new THREE.Mesh(tubeRing(1.88, 0.95, 0.85, { rh: 0.27, rv: 0.3, yc: 0.3, segs: 24, radial: 10 }), M.rubber));
  const deck = add(new THREE.Mesh(planExtrude(roundedRect(1.9, 0.97, 0.84), 0.1, 0.04), M.white));
  deck.position.y = D - 0.14;

  // cabin: a core in the player's colour (raked windscreen front), white lower walls and a white roof slab;
  // the colour shows as a band round the windows and as the windscreen surround
  add(new THREE.Mesh(profileExtrude([[-0.88, D - 0.02], [1.36, D - 0.02], [1.4, 0.96], [1.08, 1.4], [-0.88, 1.4]], 1.3, 0.05, 2), body));
  const wall = add(new THREE.Mesh(new RoundedBoxGeometry(2.07, 0.3, 1.34, 1, 0.03), M.white));
  wall.position.set(0.085, D + 0.15, 0);
  const roof = add(new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.07, 1.38, 1, 0.03), M.white));
  roof.position.set(0.085, 1.47, 0);
  const dec = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.0), hoverRoofDecal(num, colorDef));
  dec.rotation.x = -Math.PI / 2; dec.rotation.z = -Math.PI / 2;
  dec.position.set(0.085, 1.508, 0);
  tilt.add(dec);
  // a row of dark windows down each side
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) box(0.25, 0.25, 0.016, M.glass, -0.7 + i * 0.31, 1.205, s * 0.657);
  // three-pane raked windscreen
  const nx = 0.809, ny = 0.588, rake = Math.atan2(0.32, 0.44);
  for (const z of [-0.41, 0, 0.41]) {
    const p = box(0.016, 0.4, 0.36, M.glass, 1.24 + nx * 0.058, 1.18 + ny * 0.058, z);
    p.rotation.z = rake;
  }
  // small mast with a yard and a radar bar at the front of the roof
  box(0.22, 0.1, 0.16, M.white, 0.78, 1.555, -0.32);
  const mast = add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.55, 6), M.white));
  mast.position.set(0.78, 1.85, -0.32);
  box(0.03, 0.03, 0.34, M.white, 0.78, 1.98, -0.32);
  box(0.06, 0.04, 0.26, M.darkRim, 0.78, 2.12, -0.32);

  // deck details: side intake grilles (white frame, dark inset, slats), bollards and hatches
  const grille = (x, z, len, wid) => {
    box(len, 0.06, wid, M.white, x, D + 0.03, z);
    box(len - 0.08, 0.012, wid - 0.07, M.darkRim, x, D + 0.066, z);
    const n = Math.round(len / 0.08);
    for (let i = 0; i < n; i++) box(0.025, 0.03, wid - 0.07, M.white, x - (len - 0.12) / 2 + (i * (len - 0.12)) / (n - 1), D + 0.072, z);
  };
  for (const s of [-1, 1]) {
    grille(0.62, s * 0.83, 0.56, 0.24);
    grille(-0.28, s * 0.83, 0.56, 0.24);
    grille(1.62, s * 0.62, 0.3, 0.22);
  }
  for (const [x, z] of [[1.82, 0.3], [1.1, 0.9], [0.17, 0.92], [-0.78, 0.92], [-1.12, 0.74]]) {
    for (const s of [-1, 1]) {
      const b = add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 6), M.rubber));
      b.position.set(x, D + 0.05, s * z);
    }
  }
  const hatch = (x, z, w, d) => { box(w + 0.05, 0.03, d + 0.05, M.darkRim, x, D + 0.015, z); box(w, 0.05, d, M.white, x, D + 0.03, z); };
  hatch(1.66, 0, 0.26, 0.4);
  hatch(-1.12, -0.3, 0.2, 0.2); hatch(-1.12, 0.3, 0.2, 0.2);

  // twin ducted fans at the stern on a white base
  const Fx = -1.55, Fy = 1.36, Ro = 0.5, Ri = 0.41, h = 0.2;
  const base = add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.12, 1.6, 1, 0.04), M.white));
  base.position.set(Fx, D + 0.06, 0);
  // duct cross-section, revolved: outer wall, front lip, inner wall, rear lip
  const prof = [[Ro, -h], [Ro, h], [Ro - 0.025, h + 0.03], [Ri + 0.025, h + 0.03], [Ri, h], [Ri, -h], [Ri + 0.025, -h - 0.03], [Ro - 0.025, -h - 0.03], [Ro, -h]].map(([r, y]) => new THREE.Vector2(r, y));
  const ductGeo = new THREE.LatheGeometry(prof, 24);
  ductGeo.rotateZ(-Math.PI / 2);
  const stripeGeo = (w) => { const g = new THREE.CylinderGeometry(Ro + 0.006, Ro + 0.006, w, 24, 1, true); g.rotateZ(-Math.PI / 2); return g; };
  const fans = [];
  for (const s of [-1, 1]) {
    const z = s * 0.52;
    const duct = add(new THREE.Mesh(ductGeo, M.white)); duct.position.set(Fx, Fy, z);
    const st1 = add(new THREE.Mesh(stripeGeo(0.1), body)); st1.position.set(Fx + 0.09, Fy, z);
    const st2 = add(new THREE.Mesh(stripeGeo(0.05), body)); st2.position.set(Fx - 0.03, Fy, z);
    box(0.24, 0.14, 0.14, M.white, Fx, Fy - Ro - 0.04, z); // pylon
    // motor and stator cross behind the propeller
    const hub = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10), M.darkRim));
    hub.rotation.z = Math.PI / 2; hub.position.set(Fx - 0.07, Fy, z);
    box(0.03, Ri * 2, 0.035, M.darkRim, Fx - 0.12, Fy, z);
    box(0.03, 0.035, Ri * 2, M.darkRim, Fx - 0.12, Fy, z);
    // propeller: three pitched blades and a spinner cap (one mesh, spun in syncCar)
    const fan = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const g = new THREE.BoxGeometry(0.03, 0.33, 0.13);
      g.translate(0, 0.215, 0); g.rotateY(0.55); g.rotateX((i / 3) * Math.PI * 2);
      fan.add(new THREE.Mesh(g, M.darkRim));
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6), M.darkRim); cap.position.x = 0.03; fan.add(cap);
    mergeByMaterial(fan);
    fan.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    fan.position.set(Fx + 0.07, Fy, z);
    tilt.add(fan); fans.push(fan);
    // rudder behind the duct: trailing edge swings to the side the craft turns to
    const pivot = new THREE.Group(); pivot.position.set(Fx - h - 0.045, Fy, z);
    const rg = new THREE.BoxGeometry(0.24, 0.86, 0.03); rg.translate(-0.12, 0, 0);
    const rud = new THREE.Mesh(rg, M.white); rud.castShadow = true; rud.receiveShadow = true;
    pivot.add(rud); tilt.add(pivot);
    wheels.push({ pivot, spinner: new THREE.Object3D(), front: true, r: 1, noSpin: true, gain: -0.6 });
  }
  return fans;
}

// Fairground dodgem: a wide glossy tub in the player's colour with an open cockpit, padded rim and chrome
// trim on a thick rubber ring, dashboard dome with bulbs, a raised rounded back carrying the number, a
// driver at a little steering wheel, and the tall current-collector pole with a contact shoe that sparks.
// Returns {pole, poleLean, spark} for syncCar.
function buildBumper(add, tilt, body, dark, M, colorDef, num, wheels) {
  const paint = new THREE.MeshPhysicalMaterial({ color: colorDef.body, roughness: 0.16, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 });
  // rubber ring round the base, following the tub's plan
  add(new THREE.Mesh(tubeRing(1.76, 1.07, 0.8, { rh: 0.25, rv: 0.22, yc: 0.31, radial: 10, n: 56 }), M.rubber));
  // tub with the cockpit opening
  const tubShape = roundedRect(1.78, 1.08, 0.78);
  tubShape.holes.push(roundedRect(0.88, 0.84, 0.36, 0.02, THREE.Path));
  const tub = add(new THREE.Mesh(planExtrude(tubShape, 0.55, 0.14, 3, 6), paint));
  tub.position.y = 0.36; // caps at 0.22 and 1.05, sides bulge out between 0.36 and 0.91
  // chrome strip round the side, padded rubber rim round the cockpit, floor and bench seat
  add(new THREE.Mesh(tubeRing(1.93, 1.23, 0.93, { rh: 0.04, rv: 0.045, yc: 0.72, radial: 6, n: 52 }), M.chrome));
  add(new THREE.Mesh(tubeRing(0.9, 0.86, 0.37, { rh: 0.08, rv: 0.07, yc: 1.04, radial: 6, n: 40 }), M.rubber));
  const floor = add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 1.6), M.black));
  floor.position.set(0.02, 0.6, 0);
  const seat = add(new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.22, 1.36, 2, 0.07), M.black));
  seat.position.set(-0.36, 0.74, 0);
  const back = add(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.66, 1.36, 2, 0.06), M.black));
  back.position.set(-0.56, 1.0, 0); back.rotation.z = 0.2;
  // dashboard dome over the front of the cockpit, with three bulbs
  const domeGeo = new THREE.SphereGeometry(1, 18, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = add(new THREE.Mesh(domeGeo, paint));
  dome.scale.set(0.68, 0.36, 0.92); dome.position.set(1.18, 1.0, 0);
  for (const az of [-0.55, 0, 0.55]) {
    const el = 0.42;
    const b = add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 4), M.head));
    b.position.set(1.18 + 0.68 * Math.cos(el) * Math.cos(az), 1.0 + 0.36 * Math.sin(el), 0.92 * Math.cos(el) * Math.sin(az));
  }
  // raised back: rounded in plan like the tub, then shaped so it isn't a can: narrower towards the top, the
  // front (seat-back) face raked back and the rear rolled over (shifts that keep the top flat for the number)
  const cx = -1.36, ca = 0.55, cy = 1.02, cTop = 0.62 + 0.22;
  const cg = planExtrude(roundedRect(ca, 0.95, 0.45, cx), 0.62, 0.22, 4, 8);
  cg.deleteAttribute('normal'); cg.deleteAttribute('uv');
  const cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
    const t = clamp01((y + 0.22) / (cTop + 0.22));
    const front = clamp01((x - cx) / ca), rear = clamp01((cx - x) / ca);
    cp.setXYZ(i, x - 0.16 * t * front + 0.22 * t * t * rear, y, z * (1 - 0.16 * t * t));
  }
  const cowlGeo = BufferGeometryUtils.mergeVertices(cg);
  cowlGeo.computeVertexNormals();
  const cowl = add(new THREE.Mesh(cowlGeo, paint));
  cowl.position.y = cy; // flat top at 1.86
  const dec = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), numberDecal(num, colorDef));
  dec.rotation.x = -Math.PI / 2; dec.rotation.z = -Math.PI / 2;
  dec.position.set(-1.29, cy + cTop + 0.005, 0);
  tilt.add(dec);
  // where the pole comes out of the rolled-over rear edge
  let poleY = 0;
  for (let i = 0; i < cp.count; i++) if (Math.abs(cp.getZ(i)) < 0.2 && Math.abs(cp.getX(i) + 1.72) < 0.08) poleY = Math.max(poleY, cp.getY(i));
  poleY += cy;
  for (const s of [-1, 1]) {
    const tl = add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 4), M.tail));
    tl.position.set(-2.1, 1.16, s * 0.42);
  }
  // driver: jacket in the darker shade, white helmet with the visor facing forward, arms to the wheel
  const torso = add(new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.6, 0.64, 2, 0.16), dark));
  torso.position.set(-0.32, 1.12, 0); torso.rotation.z = 0.18;
  const helmet = add(new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), M.white));
  helmet.position.set(-0.26, 1.62, 0);
  const visor = add(new THREE.Mesh(new THREE.SphereGeometry(0.275, 16, 8, Math.PI - 0.85, 1.7, 1.05, 0.65), M.helmetVisor));
  visor.position.copy(helmet.position);
  for (const s of [-1, 1]) {
    const arm = add(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.13, 0.13, 1, 0.05), dark));
    arm.position.set(0.04, 1.27, s * 0.25); arm.rotation.z = -0.12; arm.rotation.y = s * 0.12;
  }
  // steering column and wheel (the wheel turns with the steering, round the column)
  const col = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.52, 6), M.chrome));
  const tiltCol = Math.atan2(0.27, 0.32);
  col.position.set(0.5, 1.1, 0); col.rotation.z = tiltCol;
  const colGroup = new THREE.Group();
  colGroup.position.set(0.34, 1.29, 0); colGroup.rotation.z = tiltCol;
  const sw = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.032, 6, 16), M.black); rim.rotation.x = Math.PI / 2; sw.add(rim);
  sw.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.05), M.black));
  sw.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.2).translate(0, 0, 0.1), M.black));
  mergeByMaterial(sw);
  sw.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  colGroup.add(sw); tilt.add(colGroup);
  wheels.push({ pivot: sw, spinner: new THREE.Object3D(), front: true, r: 1, noSpin: true, gain: 1.6 });

  // current-collector pole: rubber boot on the back, chrome pole leaning back, contact shoe on top
  const boot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.4, 10), M.rubber));
  boot.position.set(-1.72, poleY + 0.1, 0);
  const collar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), body));
  collar.position.set(-1.72, poleY - 0.04, 0);
  const pole = new THREE.Group();
  pole.position.set(-1.72, poleY + 0.05, 0);
  const L = 5.2;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, L, 6).translate(0, L / 2, 0), M.chrome); pole.add(rod);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.06).translate(-0.12, L, 0), M.chrome); pole.add(arm);
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.2).translate(-0.12, L + 0.06, 0), M.chrome); pole.add(shoe);
  mergeByMaterial(pole);
  pole.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  const spark = new THREE.Sprite(M.spark);
  spark.position.set(-0.12, L + 0.16, 0); spark.visible = false; spark.renderOrder = 5;
  pole.add(spark);
  const poleLean = 0.1;
  pole.rotation.z = poleLean;
  tilt.add(pole);
  return { pole, poleLean, spark };
}

export function buildCar(type, colorDef, num) {
  const M = mats();
  const body = bodyMat(colorDef.body);
  const dark = bodyMat(colorDef.dark);
  const root = new THREE.Group(); // positioned & yawed
  const tilt = new THREE.Group(); // pitch/roll/tumble
  root.add(tilt);
  const wheels = []; // {pivot, spinner, front}
  const add = (mesh, parent = tilt) => { mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };

  let wheelR = 0.5, wheelW = 0.45, wx = 1.35, wz = 1.02, wy = 0.5;
  let fans = null; // hovercraft propellers
  const extra = {}; // bumper car: pole and spark

  if (type === 'sports' || type === 'rally') {
    const rally = type === 'rally';
    const lower = rally
      ? [[-2.05, 0.32], [1.95, 0.32], [2.15, 0.5], [2.12, 0.74], [0.95, 0.9], [-1.95, 0.94], [-2.15, 0.86], [-2.15, 0.42]]
      : [[-2.15, 0.3], [2.05, 0.3], [2.24, 0.48], [2.16, 0.68], [0.8, 0.84], [-1.85, 0.9], [-2.22, 0.86], [-2.24, 0.42]];
    add(new THREE.Mesh(profileExtrude(smoothProfile(lower, 2), 2.18, 0.16), body));
    const cabin = rally
      ? [[0.95, 0.82], [0.25, 1.33], [-1.65, 1.36], [-1.98, 0.9]]
      : [[0.85, 0.78], [0.0, 1.22], [-0.95, 1.24], [-1.85, 0.86]];
    add(new THREE.Mesh(profileExtrude(smoothProfile(cabin, 1), 1.62, 0.1, 2), M.glass));
    // roof
    const roofLen = rally ? 1.75 : 0.98, roofX = rally ? -0.72 : -0.47, roofY = rally ? 1.36 : 1.24;
    const roof = add(new THREE.Mesh(new RoundedBoxGeometry(roofLen, 0.1, 1.5, 2, 0.04), body));
    roof.position.set(roofX, roofY, 0);
    const dec = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), numberDecal(num, colorDef));
    dec.rotation.x = -Math.PI / 2; dec.rotation.z = -Math.PI / 2;
    dec.position.set(roofX, roofY + 0.055, 0);
    tilt.add(dec);
    // stripes over the hood
    if (!rally) {
      for (const sz of [-0.28, 0.28]) {
        const st = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.18), M.white));
        st.position.set(1.48, 0.785, sz); st.rotation.z = -0.105;
      }
      // spoiler
      const wing = add(new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.07, 2.0, 2, 0.03), dark));
      wing.position.set(-1.98, 1.18, 0);
      for (const sz of [-0.6, 0.6]) { const p = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.08), M.black)); p.position.set(-1.95, 1.0, sz); }
    } else {
      // roof scoop, light pod, mud flaps
      const scoop = add(new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.14, 0.5, 2, 0.05), dark));
      scoop.position.set(0.05, 1.42, 0);
      const pod = add(new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.2, 1.2, 2, 0.05), M.black));
      pod.position.set(1.6, 0.95, 0);
      for (const sz of [-0.38, 0, 0.38]) { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 14), M.head)); l.rotation.z = Math.PI / 2; l.position.set(1.72, 0.95, sz); }
      const wing = add(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.06, 1.7, 2, 0.02), dark));
      wing.position.set(-1.92, 1.36, 0);
      for (const sz of [-1.0, 1.0]) { const f = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.45), M.black)); f.position.set(-1.0, 0.42, sz * 1.05); }
    }
    // lights
    for (const sz of [-0.68, 0.68]) {
      const h = add(new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.13, 0.42, 2, 0.04), M.head));
      h.position.set(rally ? 2.12 : 2.17, 0.6, sz);
      const t = add(new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.12, 0.45, 2, 0.04), M.tail));
      t.position.set(rally ? -2.14 : -2.22, 0.7, sz);
    }
    // bumpers / grille
    const grille = add(new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.16, 1.0, 2, 0.04), M.black));
    grille.position.set(rally ? 2.12 : 2.2, 0.42, 0);
    wheelR = rally ? 0.52 : 0.5; wheelW = 0.46; wx = rally ? 1.3 : 1.36; wz = 1.0; wy = wheelR;
  } else if (type === 'formula') {
    // plan-view fuselage, extruded upwards
    const plan = [[2.3, 0], [2.0, 0.17], [1.0, 0.3], [0.35, 0.42], [0.1, 0.68], [-1.2, 0.72], [-1.75, 0.45], [-2.05, 0.38], [-2.05, -0.38], [-1.75, -0.45], [-1.2, -0.72], [0.1, -0.68], [0.35, -0.42], [1.0, -0.3], [2.0, -0.17]];
    const sh = new THREE.Shape();
    const sp = smoothProfile(plan, 2);
    sh.moveTo(sp[0][0], sp[0][1]);
    for (const p of sp.slice(1)) sh.lineTo(p[0], p[1]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 3 });
    g.rotateX(-Math.PI / 2);
    const fus = add(new THREE.Mesh(g, body));
    fus.position.y = 0.36;
    // engine cover / airbox
    const cover = add(new THREE.Mesh(profileExtrude(smoothProfile([[0.2, 0.75], [-0.25, 1.28], [-0.7, 1.28], [-1.85, 0.82], [-1.85, 0.7]], 1), 0.62, 0.12), body));
    cover.position.y = 0;
    // cockpit + helmet
    const cockpit = add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 18), M.black));
    cockpit.position.set(0.55, 0.78, 0);
    const helmet = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), M.white));
    helmet.position.set(0.5, 1.02, 0);
    const visor = add(new THREE.Mesh(new THREE.SphereGeometry(0.305, 20, 10, -0.9, 1.8, 1.0, 0.7), M.helmetVisor));
    visor.position.copy(helmet.position);
    const stripe = add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), dark));
    stripe.position.copy(helmet.position); stripe.rotation.y = Math.PI / 2;
    // wings
    const fw = add(new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.07, 2.5, 2, 0.03), dark));
    fw.position.set(2.05, 0.3, 0);
    for (const sz of [-1.25, 1.25]) { const ep = add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 0.06), M.black)); ep.position.set(2.05, 0.4, sz); }
    const rw = add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.08, 2.1, 2, 0.03), dark));
    rw.position.set(-1.95, 1.4, 0);
    for (const sz of [-1.05, 1.05]) { const ep = add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.06), M.black)); ep.position.set(-1.95, 1.18, sz); }
    const dec = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), numberDecal(num, colorDef));
    dec.rotation.x = -Math.PI / 2; dec.rotation.z = -Math.PI / 2;
    dec.position.set(1.35, 0.87, 0);
    tilt.add(dec);
    wheelR = 0.55; wheelW = 0.6; wx = 1.45; wz = 1.15; wy = 0.55;
    // rear wheels a touch bigger
  } else if (type === 'truck') {
    const chassis = add(new THREE.Mesh(new RoundedBoxGeometry(4.0, 0.5, 2.0, 3, 0.15), dark));
    chassis.position.y = 0.95;
    const cab = add(new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.95, 1.95, 3, 0.22), body));
    cab.position.set(0.55, 1.6, 0);
    const hood = add(new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.55, 1.95, 3, 0.18), body));
    hood.position.set(1.55, 1.38, 0);
    const glassF = add(new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.55, 1.7, 2, 0.04), M.glass));
    glassF.position.set(1.47, 1.82, 0); glassF.rotation.z = -0.3;
    for (const sz of [-0.99, 0.99]) { const gs = add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.04), M.glass)); gs.position.set(0.55, 1.8, sz); }
    const bed = add(new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.6, 2.0, 2, 0.1), body));
    bed.position.set(-1.25, 1.42, 0);
    const bedIn = add(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 1.7), M.black));
    bedIn.position.set(-1.25, 1.7, 0);
    // roll bar and lights
    const bar = add(new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 8, 20, Math.PI), M.chrome));
    bar.position.set(-0.6, 1.72, 0); bar.rotation.y = Math.PI / 2; bar.scale.set(1, 0.6, 1);
    for (const sz of [-0.5, -0.17, 0.17, 0.5]) { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), M.head)); l.rotation.z = Math.PI / 2; l.position.set(-0.6, 2.25, sz); }
    const bull = add(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.35, 1.8, 2, 0.06), M.chrome));
    bull.position.set(2.1, 1.05, 0);
    for (const sz of [-0.68, 0.68]) { const h = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14), M.head)); h.rotation.z = Math.PI / 2; h.position.set(2.08, 1.4, sz); }
    const dec = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), numberDecal(num, colorDef));
    dec.rotation.x = -Math.PI / 2; dec.rotation.z = -Math.PI / 2;
    dec.position.set(0.5, 2.08, 0);
    tilt.add(dec);
    wheelR = 0.78; wheelW = 0.62; wx = 1.38; wz = 1.18; wy = 0.78;
  } else if (type === 'rover') {
    // a toy Mars rover in the player's colour: warm box body, white deck, camera mast, antenna,
    // power unit at the back and rocker-bogie legs on six wheels
    const box = add(new THREE.Mesh(new RoundedBoxGeometry(2.7, 0.62, 1.62, 3, 0.14), M.white));
    box.position.set(0.05, 1.18, 0);
    const deck = add(new THREE.Mesh(new RoundedBoxGeometry(3.05, 0.1, 2.02, 2, 0.04), body));
    deck.position.set(-0.05, 1.53, 0);
    const trim = add(new THREE.Mesh(new RoundedBoxGeometry(2.75, 0.12, 1.66, 2, 0.05), dark));
    for (const sz of [-0.62, 0.62]) { const st = add(new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.03, 0.16), M.white)); st.position.set(-0.05, 1.59, sz); }
    trim.position.set(0.05, 0.85, 0);
    // mast with a camera head ("eyes")
    const mast = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.05, 10), M.alu));
    mast.position.set(1.05, 2.05, 0.5);
    const head = add(new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.3, 0.72, 2, 0.06), M.white));
    head.position.set(1.12, 2.66, 0.5);
    for (const sz of [0.32, 0.68]) {
      const eye = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), M.black));
      eye.rotation.z = Math.PI / 2; eye.position.set(1.35, 2.68, sz);
      const lens = add(new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), M.darkRim));
      lens.rotation.y = Math.PI / 2; lens.position.set(1.405, 2.68, sz);
    }
    // high-gain dish antenna
    const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), M.alu));
    post.position.set(-0.3, 1.75, -0.55);
    const dish = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 20), M.white));
    dish.position.set(-0.3, 1.98, -0.55); dish.rotation.set(0.5, 0, 0.35);
    // whip antenna
    const whip = add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), M.black));
    whip.position.set(-0.9, 1.98, 0.62);
    // power unit at the rear: finned cylinder tilted back
    const rtg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12), M.darkRim));
    rtg.position.set(-1.72, 1.45, 0); rtg.rotation.z = 0.95;
    for (let i = 0; i < 4; i++) {
      const fin = add(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.04), M.darkRim));
      fin.position.set(-1.72, 1.45, 0); fin.rotation.set((i / 4) * Math.PI, 0, 0.95);
    }
    // folded robot arm at the front with a gold turret
    const arm = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.3), M.alu));
    arm.position.set(1.52, 1.05, 0);
    const turret = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), M.gold));
    turret.position.set(1.55, 1.0, -0.62);
    // rocker-bogie legs: beams from the body pivots down to the wheel hubs
    const beam = (x1, y1, x2, y2, z) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const b = add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.12), M.alu));
      b.position.set((x1 + x2) / 2, (y1 + y2) / 2, z); b.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    };
    for (const s of [-1, 1]) {
      const z = s * 1.04;
      beam(1.5, 0.52, 0.35, 1.05, z); beam(0.35, 1.05, -0.75, 0.78, z);
      beam(-0.75, 0.78, 0.0, 0.52, z); beam(-0.75, 0.78, -1.45, 0.52, z);
      const piv = add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 10), M.gold));
      piv.rotation.x = Math.PI / 2; piv.position.set(0.35, 1.05, z);
    }
    const dec = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), numberDecal(num, colorDef));
    dec.rotation.x = -Math.PI / 2; dec.rotation.z = -Math.PI / 2;
    dec.position.set(-0.55, 1.59, 0.25);
    tilt.add(dec);
    wheelR = 0.5; wheelW = 0.42; wx = 1.5; wz = 1.22; wy = 0.5;
  } else if (type === 'boat') {
    // toy speedboat: white hull with a pointed bow, deck in the player's colour, windscreen,
    // two seats and an outboard motor; it floats with its waterline at y = 0
    const planShape = (pts, depth, bevel) => {
      const sh = new THREE.Shape();
      const sp2 = smoothProfile(pts, 2);
      sh.moveTo(sp2[0][0], sp2[0][1]);
      for (const p of sp2.slice(1)) sh.lineTo(p[0], p[1]);
      const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
      g.rotateX(-Math.PI / 2);
      return g;
    };
    const hullPlan = [[2.55, 0], [2.1, 0.55], [1.2, 0.98], [-0.6, 1.05], [-2.15, 0.98], [-2.25, 0], [-2.15, -0.98], [-0.6, -1.05], [1.2, -0.98], [2.1, -0.55]];
    const hull = add(new THREE.Mesh(planShape(hullPlan, 0.62, 0.16), M.white));
    hull.position.y = -0.38;
    // painted boot stripe at the waterline
    const boot = add(new THREE.Mesh(planShape(hullPlan.map(([x, z]) => [x * 1.005, z * 1.02]), 0.1, 0.05), dark));
    boot.position.y = -0.02;
    const deck = add(new THREE.Mesh(planShape(hullPlan.map(([x, z]) => [x * 0.97, z * 0.93]), 0.14, 0.08), body));
    deck.position.y = 0.3;
    // cockpit well and seats
    const well = add(new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.12, 1.3, 2, 0.1), M.black));
    well.position.set(-0.75, 0.5, 0);
    for (const sz of [-0.33, 0.33]) {
      const seat = add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.42, 0.5, 2, 0.12), M.white));
      seat.position.set(-0.85, 0.72, sz);
    }
    const wind = add(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.42, 1.6, 2, 0.03), M.glass));
    wind.position.set(0.15, 0.72, 0); wind.rotation.z = -0.55;
    // bow rails and a little flag mast
    for (const sz of [-0.7, 0.7]) {
      const rail = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 6), M.chrome));
      rail.rotation.z = Math.PI / 2; rail.position.set(1.35, 0.62, sz * 0.82); rail.rotation.y = sz > 0 ? 0.32 : -0.32;
    }
    // outboard motor: cowl in the dark colour, leg into the water
    const cowl = add(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.55, 3, 0.16), dark));
    cowl.position.set(-2.45, 0.68, 0);
    const leg = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.16), M.black));
    leg.position.set(-2.5, 0.05, 0);
    const dec = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), numberDecal(num, colorDef));
    dec.rotation.x = -Math.PI / 2; dec.rotation.z = -Math.PI / 2;
    dec.position.set(1.15, 0.555, 0);
    tilt.add(dec);
  } else if (type === 'hover') {
    fans = buildHover(add, tilt, body, M, colorDef, num, wheels);
  } else if (type === 'bumper') {
    Object.assign(extra, buildBumper(add, tilt, body, dark, M, colorDef, num, wheels));
  } else if (type === 'snowmobile') {
    // snowmobile: coloured cowl, windscreen, rider, seat, rubber track and two steering skis
    const cowl = add(new THREE.Mesh(profileExtrude(smoothProfile([[2.15, 0.5], [1.6, 0.42], [-0.1, 0.48], [-0.25, 0.8], [0.15, 1.12], [0.95, 1.05], [1.85, 0.78]], 2), 1.35, 0.14), body));
    const wind = add(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.5, 1.1, 2, 0.03), M.glass));
    wind.position.set(0.3, 1.32, 0); wind.rotation.z = -0.5;
    const tunnel = add(new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.38, 1.15, 2, 0.1), dark));
    tunnel.position.set(-1.05, 0.72, 0);
    const seat = add(new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.3, 0.75, 2, 0.12), M.black));
    seat.position.set(-0.95, 1.02, 0);
    const track = add(new THREE.Mesh(new RoundedBoxGeometry(2.35, 0.5, 0.95, 3, 0.22), M.tire));
    track.position.set(-1.05, 0.32, 0);
    for (let i = 0; i < 9; i++) {
      const lug = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.98), M.darkRim));
      lug.position.set(-2.05 + i * 0.25, 0.58, 0);
    }
    const bar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), M.chrome));
    bar.rotation.x = Math.PI / 2; bar.position.set(0.05, 1.42, 0);
    // rider: jacket in the dark colour, white helmet with visor
    const torso = add(new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.72, 0.68, 2, 0.2), dark));
    torso.position.set(-0.55, 1.5, 0); torso.rotation.z = -0.25;
    const helmet = add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), M.white));
    helmet.position.set(-0.4, 2.05, 0);
    const visor = add(new THREE.Mesh(new THREE.SphereGeometry(0.325, 20, 10, -0.9, 1.8, 1.0, 0.7), M.helmetVisor));
    visor.position.copy(helmet.position);
    const dec = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), numberDecal(num, colorDef));
    dec.rotation.x = -Math.PI / 2; dec.rotation.z = -Math.PI / 2;
    dec.position.set(-1.75, 0.925, 0);
    tilt.add(dec);
    // skis steer like front wheels (they don't spin)
    for (const sz of [-0.78, 0.78]) {
      const pivot = new THREE.Group();
      pivot.position.set(1.25, 0.1, sz);
      const ski = new THREE.Group();
      const plank = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.08, 0.34, 2, 0.03), M.black);
      const tip = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.08, 0.34, 2, 0.03), M.black);
      tip.position.set(1.15, 0.14, 0); tip.rotation.z = 0.55;
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8), M.chrome);
      strut.position.set(0, 0.3, 0);
      ski.add(plank, tip, strut);
      ski.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      pivot.add(ski); tilt.add(pivot);
      wheels.push({ pivot, spinner: ski, front: true, r: 1, noSpin: true });
    }
  } else if (type === 'monster') {
    // monster truck: pickup body in the player's colour high on a chassis with springs, roll bar and lights
    const frame = add(new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.32, 1.3, 2, 0.08), M.black));
    frame.position.y = 1.15;
    for (const sx of [-1.45, 1.45]) {
      const axle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.5, 10), M.darkRim));
      axle.rotation.x = Math.PI / 2; axle.position.set(sx, 1.0, 0);
      for (const sz of [-0.55, 0.55]) {
        const spring = add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 10), dark));
        spring.position.set(sx, 1.35, sz);
      }
    }
    const lower = [[-2.2, 1.55], [2.15, 1.55], [2.3, 1.75], [2.25, 2.1], [0.9, 2.2], [-2.2, 2.25], [-2.3, 2.1], [-2.3, 1.7]];
    add(new THREE.Mesh(profileExtrude(smoothProfile(lower, 2), 2.3, 0.16), body));
    const cab = add(new THREE.Mesh(profileExtrude(smoothProfile([[0.9, 2.15], [0.35, 2.85], [-0.75, 2.88], [-0.95, 2.18]], 1), 2.05, 0.12, 2), M.glass));
    const roof = add(new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.1, 1.95, 2, 0.04), body));
    roof.position.set(-0.22, 2.9, 0);
    const bed = add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 1.95), M.black));
    bed.position.set(-1.6, 2.27, 0);
    const bar = add(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 8, 20, Math.PI), M.chrome));
    bar.position.set(-1.1, 2.27, 0); bar.rotation.y = Math.PI / 2; bar.scale.set(1, 0.7, 1);
    for (const sz of [-0.45, -0.15, 0.15, 0.45]) {
      const l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), M.head));
      l.rotation.z = Math.PI / 2; l.position.set(0.25, 2.97, sz);
    }
    for (const sz of [-0.75, 0.75]) {
      const h = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14), M.head));
      h.rotation.z = Math.PI / 2; h.position.set(2.3, 1.9, sz);
    }
    const flame = add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.5), M.white));
    flame.position.set(1.35, 2.2, 0); flame.rotation.z = -0.07;
    const dec = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), numberDecal(num, colorDef));
    dec.rotation.x = -Math.PI / 2; dec.rotation.z = -Math.PI / 2;
    dec.position.set(-0.22, 2.96, 0);
    tilt.add(dec);
    wheelR = 1.0; wheelW = 0.9; wx = 1.45; wz = 1.38; wy = 1.0;
  } else if (type === 'suv') {
    // luxury SUV: metallic paint, tinted glass, chrome grille and trim, roof rails, big polished rims
    const paint = metallicMat(colorDef.body);
    const lower = [[-2.25, 0.42], [2.12, 0.42], [2.32, 0.7], [2.3, 1.12], [1.25, 1.3], [-2.2, 1.36], [-2.34, 1.18], [-2.34, 0.58]];
    add(new THREE.Mesh(profileExtrude(smoothProfile(lower, 2), 2.24, 0.16), paint));
    add(new THREE.Mesh(profileExtrude(smoothProfile([[1.2, 1.28], [0.5, 1.92], [-1.9, 1.96], [-2.2, 1.34]], 1), 1.98, 0.1, 2), M.glass));
    const roof = add(new THREE.Mesh(new RoundedBoxGeometry(2.35, 0.1, 1.9, 2, 0.04), paint));
    roof.position.set(-0.72, 1.98, 0);
    const sun = add(new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.04, 1.0, 2, 0.02), M.glass));
    sun.position.set(-0.3, 2.04, 0);
    for (const sz of [-0.82, 0.82]) {
      const rail = add(new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.08, 0.08, 2, 0.03), M.chrome));
      rail.position.set(-0.75, 2.1, sz);
      const trim = add(new THREE.Mesh(new RoundedBoxGeometry(3.3, 0.05, 0.04, 1, 0.02), M.chrome));
      trim.position.set(-0.45, 1.3, sz * 1.21);
    }
    const grille = add(new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.48, 1.25, 2, 0.06), M.chrome));
    grille.position.set(2.3, 0.86, 0);
    for (let i = 0; i < 4; i++) {
      const slat = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 1.1), M.black));
      slat.position.set(2.32, 0.7 + i * 0.1, 0);
    }
    for (const sz of [-0.82, 0.82]) {
      const h = add(new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.09, 0.42, 2, 0.03), M.head));
      h.position.set(2.27, 1.06, sz);
      const t = add(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.1, 0.5, 2, 0.03), M.tail));
      t.position.set(-2.33, 1.08, sz * 0.95);
    }
    for (const sx of [1.35, -1.35]) for (const sz of [-1.12, 1.12]) {
      const arch = add(new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.34, 0.06, 2, 0.03), M.black));
      arch.position.set(sx, 0.62, sz);
    }
    const dec = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), numberDecal(num, colorDef));
    dec.rotation.x = -Math.PI / 2; dec.rotation.z = -Math.PI / 2;
    dec.position.set(-1.3, 2.055, 0);
    tilt.add(dec);
    wheelR = 0.6; wheelW = 0.5; wx = 1.38; wz = 1.08; wy = 0.6;
  }

  // wheels
  const rimMat = type === 'truck' ? M.darkRim : type === 'monster' ? dark : type === 'suv' ? M.chrome : M.rim;
  const axles = type === 'rover' ? [[wx, true], [0.0, false], [-1.45, false]] : (type === 'boat' || type === 'hover' || type === 'snowmobile' || type === 'bumper') ? [] : [[wx, true], [-wx, false]];
  for (const [sx, front] of axles) {
    for (const sz of [-wz, wz]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx, wy, sz);
      const r = type === 'formula' && !front ? wheelR * 1.12 : wheelR;
      const w = type === 'rover' ? makeRoverWheel(r, wheelW, M) : type === 'monster' ? makeMonsterWheel(r, wheelW, rimMat, M) : makeWheel(r, wheelW, rimMat, M);
      if (type === 'formula' && !front) pivot.position.y = r;
      w.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
      pivot.add(w);
      tilt.add(pivot);
      wheels.push({ pivot, spinner: w, front, r });
    }
  }

  // static body parts: merge per material (decals stay separate because of polygon offset)
  mergeByMaterial(tilt, (m) => m.material.polygonOffset);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.shadow.clone());
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(6.2, 3.9, 1);
  shadow.renderOrder = 1;

  if (type === 'hover') shadow.scale.set(5.4, 3.4, 1);
  if (type === 'bumper') shadow.scale.set(5.2, 3.6, 1);
  if (type === 'boat') shadow.scale.set(5.6, 3.0, 1);
  if (type === 'monster') shadow.scale.set(6.6, 4.8, 1);
  if (type === 'suv') shadow.scale.set(6.4, 4.0, 1);
  return { root, tilt, wheels, shadow, body, boat: type === 'boat', hover: type === 'hover', monster: type === 'monster', fans, fan: fans ? fans[0] : null, ...extra };
}

// Apply physics state to a car model.
// Free a car model's own GPU resources (geometries, per-car materials, the number decal) when it leaves the
// scene. Shared materials (mats()) and the textures they use stay alive for the next race.
export function disposeCar(model) {
  if (!model) return;
  const keepMat = new Set(Object.values(shared));
  const keepTex = new Set();
  for (const m of keepMat) for (const k of ['map', 'alphaMap']) if (m && m[k]) keepTex.add(m[k]);
  const seen = new Set();
  const drop = (o) => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) {
      if (keepMat.has(m) || seen.has(m)) continue;
      seen.add(m);
      for (const k of ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap']) {
        const t = m[k];
        if (t && t.isTexture && !keepTex.has(t) && !seen.has(t)) { seen.add(t); t.dispose(); }
      }
      m.dispose();
    }
  };
  model.root.traverse(drop);
  if (model.shadow) drop(model.shadow);
}

export function syncCar(model, car, t) {
  const { root, tilt, wheels, shadow } = model;
  root.position.set(car.x, car.y, car.z);
  root.rotation.y = -car.angle;
  // lean into turns and pitch under accel/brake, nose follows ramps
  const lean = Math.max(-0.12, Math.min(0.12, -car.w * Math.abs(car.fwdSpeed) * 0.0011));
  let pitch = car.airborne ? Math.max(-0.35, Math.min(0.35, car.vy * 0.008)) : car.groundSlope * Math.sign(car.fwdSpeed || 1) * (car.lastRamp ? 1 : 0);
  if (car.lastRamp && !car.airborne) {
    const along = Math.cos(car.angle) * car.lastRamp.cos + Math.sin(car.angle) * car.lastRamp.sin;
    pitch = Math.atan(car.groundSlope) * along;
  }
  tilt.rotation.set(lean, 0, pitch);
  if (model.boat && car.state === 'drive') {
    const sp = Math.abs(car.fwdSpeed);
    const ph = t * 5.2 + car.index * 1.7;
    tilt.rotation.x = Math.max(-0.22, Math.min(0.22, car.w * sp * 0.0022)) + Math.sin(ph) * 0.035; // bank into the turn
    tilt.rotation.z = (car.airborne ? pitch : Math.min(0.12, sp * 0.0026)) + Math.sin(ph * 0.8) * 0.03; // bow lifts with speed
    tilt.position.y = car.airborne ? 0 : Math.sin(ph * 1.3) * 0.08;
  }
  if (car.state === 'falling') {
    tilt.rotation.x = Math.sin(car.tumbleAxis) * car.tumble;
    tilt.rotation.z = Math.cos(car.tumbleAxis) * car.tumble;
  }
  if (model.hover && car.state === 'drive') {
    const ph = t * 6 + car.index * 1.3;
    tilt.position.y = car.airborne ? 0.1 : 0.12 + Math.sin(ph) * 0.05; // floats on its air cushion
    tilt.rotation.x = Math.max(-0.14, Math.min(0.14, -car.w * Math.abs(car.fwdSpeed) * 0.0016)) + Math.sin(ph * 0.7) * 0.02; // leans out of turns
  }
  if (model.fans) { const a = t * (14 + Math.abs(car.throttle) * 30); for (const f of model.fans) f.rotation.x = a; }
  if (model.pole) {
    // bumper car: the springy pole sways with the car and wobbles after a bump; the contact shoe sparks while moving
    const wob = car.state === 'drive' ? Math.sin(t * 21 + car.index * 1.7) * Math.min(0.5, car.stun) : 0;
    tilt.rotation.x += wob * 0.12;
    model.pole.rotation.x = -tilt.rotation.x * 0.6 + wob * 0.25;
    model.pole.rotation.z = model.poleLean - Math.max(-0.06, Math.min(0.06, car.throttle * Math.min(1, car.speed / 30) * 0.05)) + wob * 0.1;
    const k = car.state === 'drive' ? Math.min(1, car.speed / 18) + Math.min(1, car.stun * 3) : 0;
    const sp = model.spark;
    sp.visible = k > 0.15 && Math.random() < 0.3 + 0.45 * Math.min(1, k);
    if (sp.visible) { const s = 0.9 + Math.random() * 0.8 * Math.min(1.5, k); sp.scale.set(s, s, 1); }
  }
  if (model.monster && car.state === 'drive' && !car.airborne) {
    const sp = Math.min(1, car.speed / 40);
    tilt.position.y = Math.sin(t * 11 + car.index * 2.1) * 0.06 * sp;
    tilt.rotation.x *= 1.8; // soft suspension: more body roll
  }
  for (const wh of wheels) {
    if (!wh.noSpin) wh.spinner.rotation.z = -car.wheelSpin * (0.5 / wh.r);
    if (wh.front) wh.pivot.rotation.y = -car.steerVis * (wh.gain ?? 0.45);
  }
  const groundY = car.groundY ?? 0;
  shadow.position.set(car.x, groundY + 0.04, car.z);
  shadow.rotation.z = -car.angle;
  const hgt = Math.max(0, car.y - groundY);
  const k = Math.max(0, 1 - hgt / 25);
  shadow.material.opacity = 0.45 * k;
  shadow.visible = car.state !== 'hidden' && car.state !== 'out' && k > 0.02 && !(car.state === 'falling' && car.y < groundY - 1);
  root.visible = car.state !== 'hidden' && car.state !== 'out';
}
