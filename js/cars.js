// Toy car models built from simple geometry: sports coupé, rally hatch, formula racer and 4x4 truck.
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
  shared.helmetVisor = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.05, metalness: 0.6, clearcoat: 1 });
  return shared;
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
  }

  // wheels
  const rimMat = type === 'truck' ? M.darkRim : M.rim;
  for (const [sx, front] of [[wx, true], [-wx, false]]) {
    for (const sz of [-wz, wz]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx, wy, sz);
      const r = type === 'formula' && !front ? wheelR * 1.12 : wheelR;
      const w = makeWheel(r, wheelW, rimMat, M);
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

  return { root, tilt, wheels, shadow, body };
}

// Apply physics state to a car model.
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
  if (car.state === 'falling') {
    tilt.rotation.x = Math.sin(car.tumbleAxis) * car.tumble;
    tilt.rotation.z = Math.cos(car.tumbleAxis) * car.tumble;
  }
  for (const wh of wheels) {
    wh.spinner.rotation.z = -car.wheelSpin * (0.5 / wh.r);
    if (wh.front) wh.pivot.rotation.y = -car.steerVis * 0.45;
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
