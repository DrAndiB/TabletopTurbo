// World 5: a well-used garage workbench on a sunny afternoon. A sandpaper road taped down with masking
// and hazard tape, a plank jump over spilt screws, an oil slick, spilt paint, a sawdust heap, a hole-saw
// hole to fall through, a bench vise and a pegboard wall full of tools.

const TRACK = [
  [-25, 75], [-70, 76], [-110, 74], [-138, 63], [-150, 35], [-151, -20], [-148, -55], [-138, -76], [-120, -82],
  [-108, -68], [-109, -45], [-100, -26], [-84, -21], [-70, -30], [-66, -50], [-58, -70], [-38, -80], [20, -81],
  [80, -81], [118, -78], [140, -64], [148, -35], [149, 0], [146, 35], [132, 62], [110, 73], [92, 64], [86, 38],
  [76, 14], [56, 4], [22, 4], [4, 14], [-4, 36], [-8, 58],
];

const BOUNDS = { minX: -172, maxX: 170, minZ: -102, maxZ: 98 };
const SUN = [-0.7, 0.62, 0.35];
const PAINT = 0x1d9a96; // spilt paint colour (teal)

let A = null; // per-frame animation state

// Random-orbit sander left running: it rests and buzzes beside the east straight, then 'walks' across the road
// (s ~690) to the bench edge and back. Pure function of time; a fine vibration rides on top of the path.
const SAND = { wx: 129, ex: 160.4, z: -6, r: 5.2, rest: 3.2, cross: 2.5 };
function sanderPose(t) {
  const P = 2 * (SAND.rest + SAND.cross), u = ((t % P) + P) % P;
  const ease = (f) => f * f * f * (f * (f * 6 - 15) + 10);
  let f, moving = false;
  if (u < SAND.rest) f = 0;
  else if (u < SAND.rest + SAND.cross) { f = ease((u - SAND.rest) / SAND.cross); moving = true; }
  else if (u < 2 * SAND.rest + SAND.cross) f = 1;
  else { f = 1 - ease((u - 2 * SAND.rest - SAND.cross) / SAND.cross); moving = true; }
  // wander in small loops while it rests (less at the bench edge), plus the orbit buzz
  const w = 1 - f * 0.6;
  return {
    x: SAND.wx + (SAND.ex - SAND.wx) * f + Math.cos(t * 1.9) * 0.9 * w + Math.sin(t * 53) * 0.08,
    z: SAND.z + Math.sin(t * 1.4) * 1.3 + Math.cos(t * 59) * 0.08,
    angle: 1.35 + Math.sin(t * 0.45) * 0.5, moving,
  };
}

export default {
  id: 'workshop',
  name: 'Workbench Rally',
  blurb: 'Sunlit workbench: sandpaper road, plank jump, oil slick, wet paint, a hole to dodge.',
  vehicle: 'rally',
  seed: 5,
  track: { points: TRACK, width: 14, startS: 45 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  skidColor: 0x0d0b0a,
  clackOnBump: true,
  dust: {
    normal: null,
    slow: { color: 0xe6c690, size: 0.8, life: 0.7, up: 5, grav: 16, alpha: 0.95, grow: 1.4, rate: 2.2 },
    sticky: { color: PAINT, size: 0.7, life: 0.45, up: 2, grav: 22, alpha: 0.95, grow: 1, rate: 1.4 },
    slick: { color: 0x1a120a, size: 0.6, life: 0.45, up: 3, grav: 25, alpha: 0.95, grow: 1, rate: 1.6 },
    rough: { color: 0xb8bcc2, size: 0.45, life: 0.35, up: 6, grav: 40, alpha: 0.9, grow: 1, rate: 1.2 },
  },
  lighting: {
    sunDir: SUN, sunColor: 0xffd29a, sunIntensity: 3.5,
    hemiSky: 0xa9bbd8, hemiGround: 0x5a4430, hemiIntensity: 0.5,
    envIntensity: 0.34, exposure: 1.0, background: 0x1b1611, shadowRadius: 2.5,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const PI = Math.PI, L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = { motes: null, t: 0 };
    const keep = []; // objects that must not be merged (moving)
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`workshop: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };
    const B = BOUNDS, BW = B.maxX - B.minX, BD = B.maxZ - B.minZ;
    const rot = (x, z, a) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
    // local (along, side) offsets around a point with heading a -> world
    const local = (cx, cz, a, along, side) => [cx + Math.cos(a) * along - Math.sin(a) * side, cz + Math.sin(a) * along + Math.cos(a) * side];

    // ---------------------------------------------------------------- helpers
    // Contact shadows collected into one instanced mesh (opacity rides in the y scale).
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.03) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    const flushAO = () => {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1;
    };

    // Partial strip along the track between s0 and s1 (u across 0..1, v along 0..1), optional profile y(u).
    const strip = (s0, s1, off, width, y, { segU = 1, prof = null, step = 0.5 } = {}) => {
      const rows = Math.max(2, Math.ceil((s1 - s0) / step));
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= rows; i++) {
        const s = s0 + (s1 - s0) * i / rows;
        const p = track.at(s);
        for (let j = 0; j <= segU; j++) {
          const u = j / segU, o = off + (u - 0.5) * width;
          pos.push(p.x + p.nx * o, y + (prof ? prof(u) : 0), p.z + p.nz * o);
          uv.push(u, i / rows);
        }
      }
      for (let i = 0; i < rows; i++) for (let j = 0; j < segU; j++) {
        const a = i * (segU + 1) + j, b = a + 1, c = a + segU + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const n = g.attributes.normal;
      for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
      return g;
    };

    // ---------------------------------------------------------------- decal atlas (bench scars, pencil, stains)
    const CELL = 256, AT = 4;
    const atlas = TX.makeCanvas(CELL * AT);
    {
      const ag = atlas.getContext('2d');
      const rr = K.rng(404);
      const blobPath = (g, cx, cy, rad, lump, n = 28) => {
        g.beginPath();
        const ph = rr() * 6.28;
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * 6.283;
          const k = 1 + lump * (Math.sin(a * 3 + ph) * 0.5 + Math.sin(a * 5 + ph * 2) * 0.3 + (rr() - 0.5) * 0.4);
          const x = cx + Math.cos(a) * rad * k, y = cy + Math.sin(a) * rad * k;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.closePath();
      };
      const hand = (g, text, x, y, size, color, jit = 0.07) => {
        g.save(); g.fillStyle = color; g.font = `${size}px "Rubik", Arial, sans-serif`;
        let cx = x;
        for (const ch of text) {
          const w = g.measureText(ch).width;
          g.save(); g.translate(cx, y + (rr() - 0.5) * size * 0.1); g.rotate((rr() - 0.5) * jit * 2); g.fillText(ch, 0, 0); g.restore();
          cx += w * (0.92 + rr() * 0.12);
        }
        g.restore();
      };
      const cells = [
        // 0 coffee ring
        (g) => {
          g.strokeStyle = 'rgba(92,52,22,0.6)'; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 100, 0.3, 5.8); g.stroke();
          g.strokeStyle = 'rgba(92,52,22,0.25)'; g.lineWidth = 18; g.beginPath(); g.arc(128, 128, 90, 2.0, 4.6); g.stroke();
          g.strokeStyle = 'rgba(70,38,14,0.5)'; g.lineWidth = 2.5; g.beginPath(); g.arc(128, 128, 104, 0.5, 5.5); g.stroke();
        },
        // 1 soft blob (white, tintable)
        (g) => {
          for (let i = 0; i < 7; i++) {
            const gr = g.createRadialGradient(128, 128, 0, 128, 128, 120);
            gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; blobPath(g, 128 + (rr() - 0.5) * 30, 128 + (rr() - 0.5) * 30, 70 + rr() * 40, 0.35); g.fill();
          }
        },
        // 2 paint splat (white, tintable)
        (g) => {
          g.fillStyle = 'rgba(255,255,255,0.95)';
          blobPath(g, 128, 128, 58, 0.45, 40); g.fill();
          for (let i = 0; i < 14; i++) { const a = rr() * 6.28, d = 70 + rr() * 45; g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 2 + rr() * 9, 0, 6.28); g.fill(); }
          for (let i = 0; i < 5; i++) { const a = rr() * 6.28; g.lineWidth = 5 + rr() * 6; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(128 + Math.cos(a) * 50, 128 + Math.sin(a) * 50); g.lineTo(128 + Math.cos(a) * (80 + rr() * 30), 128 + Math.sin(a) * (80 + rr() * 30)); g.stroke(); }
        },
        // 3 drilled hole with torn fibres
        (g) => {
          for (let i = 0; i < 40; i++) { const a = rr() * 6.28, l = 40 + rr() * 50; g.strokeStyle = `rgba(250,225,180,${0.3 + rr() * 0.4})`; g.lineWidth = 2 + rr() * 3; g.beginPath(); g.moveTo(128 + Math.cos(a) * 36, 128 + Math.sin(a) * 36); g.lineTo(128 + Math.cos(a) * l, 128 + Math.sin(a) * l); g.stroke(); }
          const gr = g.createRadialGradient(128, 128, 10, 128, 128, 44); gr.addColorStop(0, 'rgba(8,5,3,1)'); gr.addColorStop(0.75, 'rgba(30,18,8,1)'); gr.addColorStop(1, 'rgba(120,80,40,0.6)');
          g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 44, 0, 6.28); g.fill();
        },
        // 4 pencil dimension scribble
        (g) => {
          const c = 'rgba(55,55,62,0.85)';
          hand(g, '47 3/8', 26, 108, 54, c); hand(g, '× 2', 150, 176, 46, c);
          g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(20, 128); g.lineTo(236, 124); g.moveTo(20, 112); g.lineTo(20, 144); g.moveTo(236, 108); g.lineTo(236, 140); g.stroke();
        },
        // 5 pencil arrow + CUT
        (g) => {
          const c = 'rgba(55,55,62,0.85)';
          g.strokeStyle = c; g.lineWidth = 4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(30, 160); g.lineTo(200, 150); g.lineTo(178, 132); g.moveTo(200, 150); g.lineTo(180, 170); g.stroke();
          hand(g, 'CUT', 60, 120, 60, c);
          g.beginPath(); g.moveTo(228, 40); g.lineTo(226, 230); g.stroke();
        },
        // 6 saw kerf scored into the bench
        (g) => {
          g.fillStyle = 'rgba(248,226,182,0.65)'; g.fillRect(20, 112, 216, 32);
          g.fillStyle = 'rgba(30,18,8,0.95)'; g.fillRect(14, 124, 228, 8);
          for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(240,215,170,${0.4 + rr() * 0.5})`; g.fillRect(14 + rr() * 228, 106 + rr() * 44, 2 + rr() * 3, 2 + rr() * 3); }
        },
        // 7 scorch mark
        (g) => {
          for (let i = 0; i < 4; i++) {
            const gr = g.createRadialGradient(128, 128, 0, 128, 128, 100 - i * 18);
            gr.addColorStop(0, 'rgba(25,12,4,0.55)'); gr.addColorStop(0.5, 'rgba(70,35,10,0.35)'); gr.addColorStop(1, 'rgba(90,50,20,0)');
            g.fillStyle = gr; blobPath(g, 128 + (rr() - 0.5) * 20, 128 + (rr() - 0.5) * 20, 90 - i * 15, 0.3); g.fill();
          }
        },
        // 8 dried glue drip (amber)
        (g) => {
          g.fillStyle = 'rgba(214,160,60,0.55)'; blobPath(g, 128, 128, 70, 0.4, 36); g.fill();
          g.fillStyle = 'rgba(240,200,110,0.6)'; blobPath(g, 118, 118, 30, 0.3); g.fill();
          g.strokeStyle = 'rgba(150,100,30,0.5)'; g.lineWidth = 3; blobPath(g, 128, 128, 72, 0.4, 36); g.stroke();
        },
        // 9 hammer dents
        (g) => {
          for (let i = 0; i < 6; i++) {
            const x = 50 + rr() * 156, y = 50 + rr() * 156, rad = 16 + rr() * 14;
            g.strokeStyle = 'rgba(60,35,15,0.55)'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, rad, 3.6, 5.8); g.stroke();
            g.fillStyle = 'rgba(70,40,15,0.18)'; g.beginPath(); g.arc(x, y, rad, 0, 6.28); g.fill();
          }
        },
        // 10 pencil sketch: a box with dimensions
        (g) => {
          const c = 'rgba(55,55,62,0.8)';
          g.strokeStyle = c; g.lineWidth = 3;
          g.beginPath(); g.moveTo(50, 90); g.lineTo(170, 90); g.lineTo(200, 60); g.lineTo(80, 60); g.closePath(); g.moveTo(50, 90); g.lineTo(50, 190); g.lineTo(170, 190); g.lineTo(170, 90); g.moveTo(170, 190); g.lineTo(200, 160); g.lineTo(200, 60); g.stroke();
          hand(g, '30', 95, 224, 34, c); hand(g, '18', 206, 132, 30, c); hand(g, 'shelf?', 70, 40, 30, c);
        },
        // 11 chalk smear (white, tintable)
        (g) => {
          for (let i = 0; i < 700; i++) { const a = rr() * 6.28, d = Math.pow(rr(), 0.6) * 110; g.fillStyle = `rgba(255,255,255,${rr() * 0.35})`; g.fillRect(128 + Math.cos(a) * d * 1.1, 128 + Math.sin(a) * d * 0.35, 2 + rr() * 4, 1.5 + rr() * 2); }
        },
        // 12 old screw holes + countersinks
        (g) => {
          for (const [x, y] of [[70, 128], [186, 128]]) {
            g.fillStyle = 'rgba(80,50,22,0.45)'; g.beginPath(); g.arc(x, y, 30, 0, 6.28); g.fill();
            const gr = g.createRadialGradient(x, y, 2, x, y, 18); gr.addColorStop(0, 'rgba(10,6,3,1)'); gr.addColorStop(1, 'rgba(40,24,10,0.9)');
            g.fillStyle = gr; g.beginPath(); g.arc(x, y, 16, 0, 6.28); g.fill();
          }
        },
        // 13 pencil tally / cut list
        (g) => {
          const c = 'rgba(55,55,62,0.85)';
          hand(g, '2×4 @ 36"', 18, 70, 36, c); hand(g, '|||| ||', 30, 130, 44, c); hand(g, '— 6 —', 40, 200, 40, c);
        },
        // 14 spray-painted grid box (white, tintable)
        (g) => {
          g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 16; g.strokeRect(24, 24, 208, 208);
          for (let i = 0; i < 900; i++) { const a = rr() * 6.28; const t = rr(); const x = 24 + (rr() < 0.5 ? (rr() < 0.5 ? 0 : 208) : t * 208), y = 24 + (rr() < 0.5 ? (rr() < 0.5 ? 0 : 208) : t * 208); const d = 10 + rr() * 16; g.fillStyle = `rgba(255,255,255,${rr() * 0.4})`; g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 2, 2); }
        },
        // 15 marker outline of a claw hammer (shadow board)
        (g) => {
          g.strokeStyle = 'rgba(20,20,22,0.9)'; g.lineWidth = 6; g.lineJoin = 'round';
          g.beginPath(); g.moveTo(112, 250); g.lineTo(144, 250); g.lineTo(140, 70); g.lineTo(196, 62); g.quadraticCurveTo(214, 40, 236, 50); g.quadraticCurveTo(210, 18, 150, 30); g.lineTo(72, 30); g.lineTo(60, 22); g.lineTo(48, 26); g.lineTo(48, 60); g.lineTo(60, 64); g.lineTo(72, 56); g.lineTo(116, 70); g.closePath(); g.stroke();
        },
      ];
      cells.forEach((fn, i) => { ag.save(); ag.translate((i % AT) * CELL, Math.floor(i / AT) * CELL); ag.beginPath(); ag.rect(0, 0, CELL, CELL); ag.clip(); fn(ag); ag.restore(); });
    }
    const atlasTex = TX.toTexture(atlas, { wrap: false });
    const decals = [];
    const decal = (cell, x, z, w, h, ang = 0, { y = 0.02, color = 0xffffff, alpha = 1 } = {}) => decals.push({ cell, x, y, z, w, h, ang, color, alpha });
    const wallDecal = (cell, x, y, z, w, h, { color = 0xffffff, alpha = 1, ang = 0 } = {}) => decals.push({ cell, x, y, z, w, h, ang, color, alpha, wall: true });
    const flushDecals = () => {
      const pos = [], uv = [], col = [], nrm = [], idx = [];
      const c = new T.Color();
      decals.forEach((d, k) => {
        const u0 = (d.cell % AT) / AT, vT = 1 - Math.floor(d.cell / AT) / AT, du = 1 / AT;
        const ca = Math.cos(d.ang), sa = Math.sin(d.ang);
        for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
          const ax = lx * d.w, az = lz * d.h;
          if (d.wall) { pos.push(d.x + ax * ca - az * sa, d.y - (ax * sa + az * ca), d.z); nrm.push(0, 0, 1); }
          else { pos.push(d.x + ax * ca - az * sa, d.y, d.z + ax * sa + az * ca); nrm.push(0, 1, 0); }
          uv.push(u0 + (lx + 0.5) * du, vT - (lz + 0.5) * du);
          c.set(d.color); col.push(c.r, c.g, c.b, d.alpha);
        }
        const b = k * 4; idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
      });
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new T.Float32BufferAttribute(col, 4));
      g.setIndex(idx);
      const m = new T.Mesh(g, K.std({ map: atlasTex, transparent: true, depthWrite: false, vertexColors: true, roughness: 0.8, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.receiveShadow = true; m.renderOrder = 1;
      K.group.add(m);
    };

    // ---------------------------------------------------------------- shared materials
    // Metals get the room environment as their own envMap so they can reflect more strongly than the
    // scene-wide environment intensity (which is kept low so the bench itself doesn't look washed out).
    const ENV = K.group.parent ? K.group.parent.environment : null;
    const shiny = (m, k) => { if (ENV) { m.envMap = ENV; m.envMapIntensity = k; } return m; };
    const chrome = shiny(K.metal(0xc6cbd2, 0.07), 1.0);
    const steel = shiny(K.metal(0xb4b9c0, 0.32), 1.1);
    const darkSteel = K.metal(0x55595f, 0.4);
    const brass = shiny(K.metal(0xc9a24a, 0.3), 1.2);
    const blackRubber = K.std({ color: 0x1c1c1e, roughness: 0.75 });
    const brushed = TX.brushedMetalTextures({ size: 256, seed: 17 });
    const sawSteel = K.metal(0xd2d6dc, 0.25, { roughnessMap: brushed.roughnessMap, normalMap: brushed.normalMap, normalScale: V2(0.3) });
    const pine = TX.woodTextures({ size: 512, seed: 61, planks: 1, base: 0xd2a468, dark: 0xa06c36, light: 0xe8c890, ringFreq: 11, gap: 0, roughBase: 0.72, grainContrast: 1.5, poreContrast: 1.3 });
    for (const t of Object.values(pine)) { t.rotation = PI / 2; t.center.set(0.5, 0.5); }
    const pineMat = K.std({ map: pine.map, normalMap: pine.normalMap, roughnessMap: pine.roughnessMap, normalScale: V2(0.5) });
    const endGrain = (() => {
      const c = TX.paint(128, 128, (x, y, u, v, o) => {
        const d = Math.hypot(u - 0.1, v + 0.35) * 26;
        const ring = 0.5 + 0.5 * Math.sin(d * 6.283);
        const hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; const k = 0.78 + ring * 0.12 + (hn - Math.floor(hn)) * 0.06;
        o[0] = 205 * k; o[1] = 160 * k; o[2] = 105 * k;
      });
      return K.std({ map: TX.toTexture(c), roughness: 0.85 });
    })();

    // corrugated kraft cardboard
    const kraft = (() => {
      const c = TX.paint(256, 256, (x, y, u, v, o) => {
        const hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, n = hn - Math.floor(hn);
        const k = 0.95 + Math.sin(x * 0.52) * 0.02 + (n - 0.5) * 0.07 + Math.sin(x * 0.03 + y * 0.011) * 0.03;
        o[0] = 200 * k; o[1] = 152 * k; o[2] = 98 * k;
      });
      const g = c.getContext('2d'), rr = K.rng(12);
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rr() < 0.5 ? '90,60,30' : '235,210,170'},${0.12 + rr() * 0.2})`; g.fillRect(rr() * 256, rr() * 256, 1, 1 + rr() * 5); }
      return TX.toTexture(c);
    })();

    // ---------------------------------------------------------------- the workbench
    // butcher block: 12 glued strips of maple/beech per 46-unit tile, straight edge grain, butt joints
    const BB = (() => {
      // 12 glued strips of mixed beech / maple / oak per tile, straight edge grain, a few butt joints,
      // then years of wear: scratches, gouges, dents and oily patches (also written into the height field)
      const S = 1024, NS = 16, sw = S / NS, HS = 512;
      const rr = K.rng(808);
      const tones = [[186, 142, 94], [176, 132, 87], [196, 155, 106], [168, 124, 81], [182, 138, 90], [200, 160, 112], [162, 119, 78], [190, 148, 98], [178, 140, 98]];
      const mid = [182, 140, 94];
      const tone = () => { const t = tones[Math.floor(rr() * tones.length)], k = 0.95 + rr() * 0.07; return [0, 1, 2].map((c) => (mid[c] + (t[c] - mid[c]) * 0.65) * k * (c === 2 ? 0.95 + rr() * 0.06 : 1)); };
      const strips = [];
      for (let i = 0; i < NS; i++) {
        const nj = rr() < 0.5 ? 0 : rr() < 0.8 ? 1 : 2;
        const joints = [];
        for (let k = 0; k < nj; k++) joints.push(60 + rr() * (S - 120));
        joints.sort((a, b) => a - b);
        strips.push({
          joints, cols: [tone(), tone(), tone()],
          f: [0.55 + rr() * 0.5, 1.3 + rr() * 0.9, 2.9 + rr() * 1.6], ph: [rr() * 6.28, rr() * 6.28, rr() * 6.28],
          wn: 1 + Math.floor(rr() * 3), wa: 1 + rr() * 3, wp: rr() * 6.28,
          tn: [1 + Math.floor(rr() * 2), 2 + Math.floor(rr() * 3)], tp: [rr() * 6.28, rr() * 6.28], ta: [rr() * 0.08, rr() * 0.06],
          streak: rr() < 0.5 ? [rr() * sw, rr() * S, 80 + rr() * 220] : null,
          knot: rr() < 0.3 ? [10 + rr() * (sw - 20), rr() * S] : null,
        });
      }
      const h = new Float32Array(HS * HS);
      const TAU = 6.2832;
      const c = TX.paint(S, S, (x, y, u, v, o) => {
        const i = Math.floor(x / sw), st = strips[i], lx = x - i * sw, fu = lx / sw;
        const yy = y / S;
        const wav = Math.sin(yy * TAU * st.wn + st.wp) * st.wa;
        const gx = (lx + wav) * 0.25;
        // edge grain: a few superimposed line families, sharpened
        const g1 = Math.sin(gx * st.f[0] * TAU / 4 + st.ph[0]), g2 = Math.sin(gx * st.f[1] * TAU / 4 + st.ph[1]), g3 = Math.sin(gx * st.f[2] * TAU / 4 + st.ph[2]);
        let line = Math.max(0, g1 - 0.84) * 5 + Math.max(0, g2 - 0.88) * 4.5 + Math.max(0, g3 - 0.93) * 3.5;
        const hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, n = hn - Math.floor(hn);
        // long streaky fibres along the strip
        const fib = Math.sin(lx * 2.7 + Math.sin(y * 0.021 + i) * 1.5) * Math.sin(y * 0.009 + lx * 0.4 + i * 3) * 0.035;
        const pore = n > 0.985 ? 0.25 : 0;
        const tone = 1 + Math.sin(yy * TAU * st.tn[0] + st.tp[0]) * st.ta[0] + Math.sin(yy * TAU * st.tn[1] + st.tp[1]) * st.ta[1] + (n - 0.5) * 0.06 + fib;
        let seg = 0;
        for (const j of st.joints) if (y > j) seg++;
        const col = st.cols[seg];
        let k = tone * (1 - Math.min(0.32, line * 0.3) - pore);
        let hh = 0.6 - line * 0.25 - pore;
        // straight butt joint between two lengths of board
        for (const j of st.joints) { const d = Math.abs(y - j); if (d < 1) { k *= 0.7; hh = 0.2; } else if (d < 2.5) k *= 0.94; }
        if (st.streak) { const [sx, sy, sl] = st.streak; const dy = ((y - sy) % S + S) % S; if (dy < sl && Math.abs(lx - sx - dy * 0.02) < 2) k *= 0.8; }
        if (st.knot) { const dx = lx - st.knot[0], dy = y - st.knot[1]; const d = dx * dx / 16 + dy * dy / 64; if (d < 1) { k *= 0.5 + 0.45 * d; hh -= 0.2; } }
        // glue lines
        if (fu < 0.012 || fu > 0.988) { k *= 0.68; hh = 0.15; } else if (fu < 0.03 || fu > 0.97) k *= 0.93;
        o[0] = Math.min(255, col[0] * k); o[1] = Math.min(255, col[1] * k); o[2] = Math.min(255, col[2] * k);
        if (!(x & 1) && !(y & 1)) h[(y >> 1) * HS + (x >> 1)] = hh;
      });
      // wear, drawn on top of the wood and cut into the height field
      const g = c.getContext('2d');
      g.lineCap = 'round';
      const cut = (x0, y0, x1, y1, depth, wid = 1) => {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let t = 0; t <= n; t++) {
          const x = x0 + (x1 - x0) * t / n, y = y0 + (y1 - y0) * t / n;
          for (let w = -wid + 1; w < wid; w++) {
            const xi = (((Math.round(x / 2) + w) % HS) + HS) % HS, yi = ((Math.round(y / 2) % HS) + HS) % HS;
            h[yi * HS + xi] = Math.min(h[yi * HS + xi], 0.6 - depth);
          }
        }
      };
      const stroke = (x0, y0, x1, y1, col, w) => {
        g.strokeStyle = col; g.lineWidth = w;
        for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.moveTo(x0 + ox, y0 + oy); g.lineTo(x1 + ox, y1 + oy); g.stroke(); }
      };
      // fine scratches, mostly fresh (light) with some dirty ones
      for (let i = 0; i < 300; i++) {
        const x = rr() * S, y = rr() * S, a = rr() < 0.35 ? (rr() - 0.5) * 0.5 : rr() * PI, l = 8 + rr() * rr() * 120;
        const x1 = x + Math.cos(a) * l, y1 = y + Math.sin(a) * l;
        const light = rr() < 0.65;
        stroke(x, y, x1, y1, light ? `rgba(255,236,200,${0.12 + rr() * 0.22})` : `rgba(55,32,14,${0.12 + rr() * 0.22})`, 0.6 + rr() * 1.1);
        cut(x, y, x1, y1, 0.12 + rr() * 0.15);
      }
      // a few deep gouges and chisel slips
      for (let i = 0; i < 12; i++) {
        const x = rr() * S, y = rr() * S, a = rr() * PI, l = 14 + rr() * 50;
        const x1 = x + Math.cos(a) * l, y1 = y + Math.sin(a) * l;
        stroke(x, y, x1, y1, 'rgba(250,226,186,0.45)', 4.5);
        stroke(x, y, x1, y1, 'rgba(70,40,16,0.55)', 1.8);
        cut(x, y, x1, y1, 0.45, 2);
      }
      // dents (hammer misses) and small burns
      for (let i = 0; i < 40; i++) {
        const x = rr() * S, y = rr() * S, rad = 2 + rr() * 6;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(60,34,14,0.35)'); gr.addColorStop(1, 'rgba(60,34,14,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.28); g.fill();
        const cx = Math.round(x / 2), cy = Math.round(y / 2), rh = Math.ceil(rad / 2);
        for (let dy = -rh; dy <= rh; dy++) for (let dx = -rh; dx <= rh; dx++) {
          const d = Math.hypot(dx, dy) / rh; if (d > 1) continue;
          const xi = ((cx + dx) % HS + HS) % HS, yi = ((cy + dy) % HS + HS) % HS;
          h[yi * HS + xi] -= (1 - d * d) * 0.35;
        }
      }
      const map = TX.toTexture(c);
      const normalMap = TX.toTexture(TX.normalFromHeight(h, HS, HS, 1.6), { srgb: false });
      // roughness: oily, hand-polished patches vs dry raw wood
      const nf = TX.noiseField(128, { seed: 23, period: 3, oct: 4 });
      const rc = TX.paint(128, 128, (x, y, u, v, o) => { const t = nf[y * 128 + x]; o[0] = o[1] = o[2] = 255 * Math.min(0.85, Math.max(0.32, 0.92 - t * 0.75)); });
      const roughnessMap = TX.toTexture(rc, { srgb: false });
      return { map, normalMap, roughnessMap };
    })();
    const HOLE = (() => { const p = track.place(931, -13.2); return { x: p.x, z: p.z, r: 4.6 }; })();
    // Flat bench surface as a grid of small quads with a round hole (HOLE): the cells around the hole are
    // replaced by a fan between the block's boundary vertices and the circle, so there are no T-junctions.
    const BENCH_TOP = (x0, x1, z0, z1, hr, uvFn) => {
      const cs = 8, nx = Math.ceil((x1 - x0) / cs), nz = Math.ceil((z1 - z0) / cs);
      const gx = (i) => Math.min(x1, x0 + i * cs), gz = (j) => Math.min(z1, z0 + j * cs);
      const bi = Math.floor((HOLE.x - x0) / cs) - 1, bj = Math.floor((HOLE.z - z0) / cs) - 1;
      const P = [];
      const tri = (a, b, c) => {
        // keep every triangle facing up
        const cr = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        if (cr >= 0) P.push(a, b, c); else P.push(a, c, b);
      };
      const v = (x, z) => [x, 0, z];
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (i >= bi && i < bi + 3 && j >= bj && j < bj + 3) continue;
        const a = v(gx(i), gz(j)), b = v(gx(i + 1), gz(j)), c = v(gx(i + 1), gz(j + 1)), d = v(gx(i), gz(j + 1));
        tri(a, b, c); tri(a, c, d);
      }
      // boundary of the 3x3 block, walked once around
      const O = [];
      for (let k = 0; k < 3; k++) O.push(v(gx(bi + k), gz(bj)));
      for (let k = 0; k < 3; k++) O.push(v(gx(bi + 3), gz(bj + k)));
      for (let k = 0; k < 3; k++) O.push(v(gx(bi + 3 - k), gz(bj + 3)));
      for (let k = 0; k < 3; k++) O.push(v(gx(bi), gz(bj + 3 - k)));
      const ang = O.map((o) => Math.atan2(o[2] - HOLE.z, o[0] - HOLE.x));
      const ring = (a) => v(HOLE.x + Math.cos(a) * hr, HOLE.z + Math.sin(a) * hr);
      for (let k = 0; k < O.length; k++) {
        const a0 = ang[k];
        let a1 = ang[(k + 1) % O.length];
        while (a1 - a0 > PI) a1 -= 2 * PI;
        while (a1 - a0 < -PI) a1 += 2 * PI;
        const I = [0, 1, 2, 3].map((t) => ring(a0 + (a1 - a0) * t / 3));
        const A = O[k], Bv = O[(k + 1) % O.length];
        tri(A, I[0], I[1]); tri(A, I[1], Bv); tri(Bv, I[1], I[2]); tri(Bv, I[2], I[3]);
      }
      const pos = new Float32Array(P.length * 3), nrm = new Float32Array(P.length * 3), uv = new Float32Array(P.length * 2);
      P.forEach((p, k) => { pos.set(p, k * 3); nrm.set([0, 1, 0], k * 3); uv.set(uvFn(p[0], p[2]), k * 2); });
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.BufferAttribute(nrm, 3));
      geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
      return geo;
    };
    {
      const TILE = 46;
      const benchMat = K.std({ map: BB.map, normalMap: BB.normalMap, normalScale: V2(0.7), roughnessMap: BB.roughnessMap, roughness: 1 });
      const bev = 0.6;
      const sh = new T.Shape();
      sh.moveTo(B.minX + bev, -(B.minZ + bev)); sh.lineTo(B.maxX - bev, -(B.minZ + bev)); sh.lineTo(B.maxX - bev, -(B.maxZ - bev)); sh.lineTo(B.minX + bev, -(B.maxZ - bev)); sh.closePath();
      const hp = new T.Path(); hp.absarc(HOLE.x, -HOLE.z, HOLE.r + bev, 0, PI * 2, true); sh.holes.push(hp);
      const g = new T.ExtrudeGeometry(sh, { depth: 6.5, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 40 });
      g.rotateX(-PI / 2); g.translate(0, -(6.5 + bev), 0);
      g.computeVertexNormals();
      const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
        if (ny > 0.6) uv.setXY(i, z / TILE, x / TILE);
        else if (nz >= nx) uv.setXY(i, 0.01 + (y / TILE) * 0.5, x / TILE);
        else uv.setXY(i, z / TILE, y / TILE * 3);
      }
      // The flat top is rebuilt as a finely subdivided grid: one huge cap triangle spanning the whole bench
      // gives imprecise depth after clipping, and the thin road/tape ribbons 0.03 above it then flicker away.
      {
        const keepIdx = [];
        for (let t = 0; t < pos.count; t += 3) {
          let cap = true;
          for (let k = 0; k < 3; k++) if (pos.getY(t + k) < -0.001 || nrm.getY(t + k) < 0.99) cap = false;
          if (!cap) keepIdx.push(t, t + 1, t + 2);
        }
        const body = new T.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) {
          const src = g.attributes[name], it = src.itemSize, arr = new Float32Array(keepIdx.length * it);
          keepIdx.forEach((v, k) => { for (let c = 0; c < it; c++) arr[k * it + c] = src.array[v * it + c]; });
          body.setAttribute(name, new T.BufferAttribute(arr, it));
        }
        g.dispose();
        const bodyM = new T.Mesh(body, benchMat);
        bodyM.receiveShadow = true; bodyM.castShadow = true;
        K.group.add(bodyM);
      }
      const topM = new T.Mesh(BENCH_TOP(B.minX + bev, B.maxX - bev, B.minZ + bev, B.maxZ - bev, HOLE.r + bev, (x, z) => [z / TILE, x / TILE]), benchMat);
      topM.receiveShadow = true; topM.castShadow = true;
      K.group.add(topM);
      // under-frame: apron, legs, lower shelf
      const frameMat = K.std({ map: pine.map, color: 0xb8936a, roughness: 0.7 });
      const mx = (B.minX + B.maxX) / 2, mz = (B.minZ + B.maxZ) / 2;
      for (const z of [B.minZ + 6, B.maxZ - 6]) K.mesh(new T.BoxGeometry(BW - 12, 9, 2.5), frameMat, mx, -12, z, { cast: false });
      for (const x of [B.minX + 6, B.maxX - 6]) K.mesh(new T.BoxGeometry(2.5, 9, BD - 12), frameMat, x, -12, mz, { cast: false });
      for (const [x, z] of [[B.minX + 10, B.minZ + 10], [B.maxX - 10, B.minZ + 10], [B.minX + 10, B.maxZ - 10], [B.maxX - 10, B.maxZ - 10]]) K.mesh(new T.BoxGeometry(9, 62, 9), frameMat, x, -46, z, { cast: false });
      K.mesh(new T.BoxGeometry(BW - 16, 2, BD - 20), frameMat, (B.minX + B.maxX) / 2, -62, (B.minZ + B.maxZ) / 2, { cast: false });
    }

    // grime overlay: broad stains, patina and dust painted at bench scale (hole cut out)
    {
      const W = 1024, H = 600, sx = W / BW, sz = H / BD;
      const c = TX.makeCanvas(W, H);
      const g = c.getContext('2d');
      const px = (x) => (x - B.minX) * sx, pz = (z) => (z - B.minZ) * sz;
      const rr = K.rng(99);
      const soft = (x, z, rad, col, a, squash = 1) => {
        const gr = g.createRadialGradient(px(x), pz(z), 0, px(x), pz(z), rad * sx);
        gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.55, `rgba(${col},${a * 0.75})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.save(); g.translate(px(x), pz(z)); g.scale(1, squash); g.translate(-px(x), -pz(z));
        g.fillStyle = gr; g.beginPath(); g.arc(px(x), pz(z), rad * sx, 0, 6.28); g.fill(); g.restore();
      };
      // patina: darker where hands and tools work, near the vise and the north half
      for (let i = 0; i < 120; i++) soft(B.minX + rr() * BW, B.minZ + rr() * BD, 8 + rr() * 30, rr() < 0.8 ? '70,42,18' : '40,32,26', 0.08 + rr() * 0.12, 0.5 + rr() * 0.7);
      for (let i = 0; i < 40; i++) soft(B.minX + rr() * BW, B.minZ + rr() * BD, 6 + rr() * 16, '255,236,200', 0.06 + rr() * 0.08, 0.6 + rr() * 0.6);
      soft(-88, -76, 40, '50,30,12', 0.28); soft(-60, -90, 50, '60,36,14', 0.18); soft(70, -92, 70, '60,36,14', 0.12);
      // dust settled along the wall
      const dg = g.createLinearGradient(0, 0, 0, pz(B.minZ + 14));
      dg.addColorStop(0, 'rgba(236,214,170,0.55)'); dg.addColorStop(1, 'rgba(236,214,170,0)');
      g.fillStyle = dg; g.fillRect(0, 0, W, pz(B.minZ + 14));
      // oil stains
      for (const [x, z, rad] of [[-80, -66, 9], [-96, -88, 6], [118, -56, 10], [128, -48, 5], [-160, 88, 7], [150, 84, 6], [-30, 40, 6], [60, -30, 7], [100, 40, 5], [-140, -88, 6]]) soft(x, z, rad, '22,14,6', 0.7, 0.7);
      // paint drips and splats near the paint cans (teal and old white / red)
      for (let i = 0; i < 30; i++) {
        const x = -125 + rr() * 30, z = -18 + rr() * 34;
        g.fillStyle = rr() < 0.6 ? 'rgba(29,154,150,0.85)' : rr() < 0.5 ? 'rgba(240,238,228,0.8)' : 'rgba(176,44,36,0.8)';
        g.beginPath(); g.arc(px(x), pz(z), (0.3 + rr() * 1.1) * sx, 0, 6.28); g.fill();
      }
      for (let i = 0; i < 26; i++) {
        const x = B.minX + rr() * BW, z = B.minZ + rr() * BD;
        g.fillStyle = rr() < 0.5 ? 'rgba(240,238,228,0.7)' : rr() < 0.5 ? 'rgba(35,95,165,0.7)' : 'rgba(205,160,40,0.7)';
        g.beginPath(); g.arc(px(x), pz(z), (0.25 + rr() * 0.7) * sx, 0, 6.28); g.fill();
      }
      // long pencil lines (layout lines from old jobs) and chalk lines
      g.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const x = B.minX + rr() * BW, z = B.minZ + rr() * BD, a = rr() < 0.6 ? (rr() < 0.5 ? 0 : PI / 2) : rr() * PI, l = 20 + rr() * 60;
        g.strokeStyle = `rgba(60,60,68,${0.35 + rr() * 0.3})`; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px(x), pz(z)); g.lineTo(px(x + Math.cos(a) * l), pz(z + Math.sin(a) * l)); g.stroke();
      }
      for (const [x0, z0, x1, z1] of [[-170, 52, 40, 64], [60, -96, 168, -40]]) {
        g.strokeStyle = 'rgba(70,120,210,0.35)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(px(x0), pz(z0)); g.lineTo(px(x1), pz(z1)); g.stroke();
      }
      // saw kerfs scored into the south edge, burns and dents along the front
      for (let i = 0; i < 22; i++) {
        const x = B.minX + 6 + rr() * (BW - 12), l = 3 + rr() * 9;
        g.strokeStyle = 'rgba(30,18,8,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px(x), H); g.lineTo(px(x + (rr() - 0.5) * 3), H - l * sz); g.stroke();
      }
      // drilled holes, scattered
      for (let i = 0; i < 70; i++) {
        const x = B.minX + 4 + rr() * (BW - 8), z = B.minZ + 4 + rr() * (BD - 8);
        g.fillStyle = 'rgba(20,12,5,0.75)'; g.beginPath(); g.arc(px(x), pz(z), (0.18 + rr() * 0.35) * sx, 0, 6.28); g.fill();
      }
      const ov = TX.toTexture(c, { wrap: false });
      const og = BENCH_TOP(B.minX + 0.6, B.maxX - 0.6, B.minZ + 0.6, B.maxZ - 0.6, HOLE.r + 0.6, (x, z) => [(x - B.minX) / BW, 1 - (z - B.minZ) / BD]);
      const m = new T.Mesh(og, K.std({ map: ov, transparent: true, depthWrite: false, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      m.position.y = 0.006; m.receiveShadow = true; m.renderOrder = 0;
      K.group.add(m);
    }

    // ---------------------------------------------------------------- garage floor far below
    {
      // sealed concrete: cloudy trowel marks with fine aggregate
      const cc = TX.mottledTextures({ size: 512, a: 0x908c85, b: 0x7b7770, c: 0x9d988f, seed: 71, period: 4, speck: 0.05, bump: 0.6, pebbles: 700, pebbleColor: 0x8c8780 });
      for (const t of Object.values(cc)) t.repeat.set(1800 / 90, 1800 / 90);
      K.mesh(new T.PlaneGeometry(1800, 1800, 30, 30), K.std({ map: cc.map, normalMap: cc.normalMap, roughness: 0.92, color: 0xd8d4cc }), 0, -76, 0, { rx: -PI / 2, cast: false });
      const jg = [];
      for (let i = -3; i <= 3; i++) {
        jg.push(new T.PlaneGeometry(1.2, 1800, 1, 30).rotateX(-PI / 2).translate(i * 150 + 40, 0, 0));
        jg.push(new T.PlaneGeometry(1800, 1.2, 30, 1).rotateX(-PI / 2).translate(0, 0, i * 150 + 20));
      }
      K.mesh(K.BufferGeometryUtils.mergeGeometries(jg), new T.MeshBasicMaterial({ color: 0x2c2a27, transparent: true, opacity: 0.55, depthWrite: false }), 0, -75.95, 0, { cast: false });
      // big oil stain where the car usually stands, east of the bench
      const oc = TX.makeCanvas(256);
      const og = oc.getContext('2d');
      const rr = K.rng(5);
      for (let i = 0; i < 9; i++) { const gr = og.createRadialGradient(128, 128, 0, 128, 128, 120); gr.addColorStop(0, 'rgba(15,10,5,0.28)'); gr.addColorStop(1, 'rgba(15,10,5,0)'); og.fillStyle = gr; og.beginPath(); og.ellipse(128 + (rr() - 0.5) * 60, 128 + (rr() - 0.5) * 60, 60 + rr() * 60, 40 + rr() * 40, rr() * 3, 0, 6.28); og.fill(); }
      const om = K.std({ map: TX.toTexture(oc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.25 });
      K.mesh(new T.PlaneGeometry(110, 90), om, 250, -75.9, 30, { rx: -PI / 2, cast: false });
      K.mesh(new T.PlaneGeometry(50, 40), om, -230, -75.9, -40, { rx: -PI / 2, cast: false });
      // things on the floor: a bucket, a shop vac, lumber offcuts, a cardboard box
      const bucket = K.lathe([[0.001, 0], [13, 0], [13.4, 0.6], [15.4, 36], [16.2, 36.6], [15.9, 37], [14.9, 36.2], [12.9, 1.4], [0.001, 1.2]], 40);
      K.mesh(bucket, K.plastic(0xe9e6df, 0.5), -262, -76, 52, { cast: false });
      K.mesh(new T.CylinderGeometry(15, 15, 0.5, 40), K.std({ color: 0x8a7f70, roughness: 0.9 }), -262, -50, 52, { cast: false });
      const vac = K.lathe([[0.001, 0], [17, 0], [18, 2], [18, 30], [17, 32], [14, 34], [0.001, 34]], 40);
      K.mesh(vac, K.plastic(0xe0b22a, 0.4), -270, -76, -50, { cast: false });
      K.mesh(new T.CylinderGeometry(12, 13, 10, 32), K.plastic(0x2a2a2c, 0.5), -270, -37, -50, { cast: false });
      K.mesh(new T.TorusGeometry(14, 2.2, 10, 32, PI * 1.5), K.plastic(0x2a2a2c, 0.5), -238, -73, -30, { rx: -PI / 2, cast: false });
      // offcuts and sawdust that fell off the bench
      for (const [x, z, a, l] of [[-196, 20, 0.4, 26], [-205, -12, 1.9, 14], [193, 30, -0.3, 22], [205, 55, 1.2, 12], [-60, 140, 0.2, 30], [40, 150, -0.6, 18]]) K.mesh(new T.BoxGeometry(l, 1.9, 8.9), pineMat, x, -75, z, { ry: a, cast: false });
      const dc = TX.makeCanvas(128); const dg = dc.getContext('2d'); const dr = K.rng(15);
      for (let i = 0; i < 900; i++) { const a = dr() * 6.28, d = Math.pow(dr(), 0.7) * 60; dg.fillStyle = `rgba(${dr() < 0.5 ? '232,204,150' : '205,170,115'},${0.25 + dr() * 0.5})`; dg.fillRect(64 + Math.cos(a) * d, 64 + Math.sin(a) * d * 0.8, 1 + dr() * 2, 1 + dr() * 2); }
      const dustM = K.std({ map: TX.toTexture(dc, { wrap: false }), transparent: true, depthWrite: false, roughness: 1 });
      for (const [x, z, sz] of [[-195, 5, 34], [196, 40, 30], [-20, 135, 40]]) K.mesh(new T.PlaneGeometry(sz, sz), dustM, x, -75.92, z, { rx: -PI / 2, cast: false });
      for (let i = 0; i < 5; i++) K.mesh(new T.BoxGeometry(90 + i * 7, 3.8, 8.9), pineMat, 225 + i * 2, -74.1 + (i >= 3 ? 3.8 : 0), -80 + (i % 3) * 9.4, { ry: 0.02 * i, cast: false });
      const cardboard = K.std({ map: kraft, color: 0xd8c8b0, roughness: 0.9 });
      K.mesh(new T.BoxGeometry(40, 30, 32), cardboard, 215, -61, 110, { ry: 0.3, cast: false });
      // the bench's shadow on the floor
      const shm = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      shm.rotation.x = -PI / 2; shm.scale.set(BW * 1.35, BD * 1.5, 1); shm.position.set(60, -75.85, -20); shm.material.opacity = 0.28;
      K.group.add(shm);
    }

    // ---------------------------------------------------------------- the north wall: blockwork + pegboard
    const WALLZ = B.minZ - 0.6;
    {
      // painted concrete blocks (pixel loop: no canvas read-back)
      const bh = new Float32Array(512 * 256);
      const c = TX.paint(512, 256, (x, y, u, v, o) => {
        const row = Math.floor(y / 128), ly = y % 128, lx = (x + row * 128) % 256;
        const hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, n = hn - Math.floor(hn);
        const mortar = ly < 5 || lx < 5;
        const k = mortar ? 0.62 : 0.93 + n * 0.07 + Math.sin(x * 0.05 + y * 0.03) * 0.02;
        o[0] = 217 * k; o[1] = 212 * k; o[2] = 199 * k;
        bh[y * 512 + x] = mortar ? 0 : 0.6 + n * 0.15;
      });
      const mapT = TX.toTexture(c, { repeat: [900 / 80, 230 / 40] });
      const nT = TX.toTexture(TX.normalFromHeight(bh, 512, 256, 3), { srgb: false, repeat: [900 / 80, 230 / 40] });
      K.mesh(new T.PlaneGeometry(900, 230), K.std({ map: mapT, normalMap: nT, roughness: 0.9 }), 0, 39, WALLZ - 2, { cast: false });
      // pegboard: brown hardboard with a 2.54 grid of holes (4 x 4 per tile)
      const S = 256, rep = 10.16, cellPx = S / 4;
      const ph = new Float32Array(S * S);
      const pc = TX.paint(S, S, (x, y, u, v, o) => {
        const dx = (x % cellPx) - cellPx / 2 + 0.5, dy = (y % cellPx) - cellPx / 2 + 0.5, d = Math.hypot(dx, dy);
        const hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, n = hn - Math.floor(hn);
        let k = 0.92 + n * 0.1, hh = 0.6;
        if (d < 7.5) { k = 0.12 + d * 0.01; hh = 0; } else if (d < 10) { k *= 0.75 + (d - 7.5) * 0.1; hh = 0.3 + (d - 7.5) * 0.12; }
        o[0] = 150 * k; o[1] = 116 * k; o[2] = 80 * k;
        ph[y * S + x] = hh;
      });
      const pW = 334, pH = 76;
      const pm = TX.toTexture(pc, { repeat: [pW / rep, pH / rep] });
      const pn = TX.toTexture(TX.normalFromHeight(ph, S, S, 2.5), { srgb: false, repeat: [pW / rep, pH / rep] });
      K.mesh(new T.BoxGeometry(pW, pH, 0.6), K.std({ map: pm, normalMap: pn, roughness: 0.8 }), (B.minX + B.maxX) / 2, 2 + pH / 2, WALLZ - 0.3, { cast: false });
      // a cleat along the bench / wall joint
      K.mesh(new T.BoxGeometry(BW, 2.6, 2.2), pineMat, (B.minX + B.maxX) / 2, 1.3, B.minZ + 1.1, { cast: false });
      K.box(0, B.minZ - 1, 400, 3.2, 0, 120);
      // shelf higher up with jars
      K.mesh(new T.BoxGeometry(150, 1.8, 16), pineMat, -10, 52, WALLZ + 8, { cast: true });
      for (const x of [-70, 50]) K.mesh(new T.BoxGeometry(1.2, 10, 12), darkSteel, x, 46, WALLZ + 6);
    }

    // ---------------------------------------------------------------- tool builders
    const wrenchGeo = (() => {
      // combination wrench, 20 long along +y: ring end at the top, open end at the bottom
      const s = new T.Shape();
      s.moveTo(-0.9, -7); s.lineTo(-0.7, 7); s.absarc(0, 8.4, 1.9, PI + 0.6, -0.6 + 2 * PI, false); s.lineTo(0.9, -7);
      s.lineTo(1.6, -8.2); s.lineTo(1.0, -10.2); s.lineTo(0.45, -9.2); s.lineTo(-0.45, -9.2); s.lineTo(-1.0, -10.2); s.lineTo(-1.6, -8.2); s.closePath();
      const ring = new T.Path(); ring.absarc(0, 8.4, 1.0, 0, PI * 2, true); s.holes.push(ring);
      const g = new T.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1, curveSegments: 16 });
      g.translate(0, 0, -0.22);
      return g;
    })();
    const makeHammer = () => {
      // lying flat: handle along +x (0..30), head across z at x≈-1, thickness along y
      const g = new T.Group();
      const hp = [[0.001, 0], [1.25, 0], [1.45, 0.6], [1.35, 3], [1.15, 14], [1.25, 24], [1.5, 28.5], [1.45, 30], [0.001, 30]];
      const handle = new T.Mesh(K.lathe(hp, 16).rotateZ(-PI / 2), K.std({ map: pine.map, color: 0xe8c08a, roughness: 0.45 }));
      handle.position.x = 0.5; g.add(handle);
      const grip = new T.Mesh(new T.CylinderGeometry(1.55, 1.42, 11, 16).rotateZ(PI / 2), K.std({ color: 0x1b1b1d, roughness: 0.7 }));
      grip.position.x = 24; g.add(grip);
      const prof = new T.Shape();
      prof.moveTo(-1.6, -2.2); prof.lineTo(1.6, -2.2); prof.lineTo(1.6, 2.0);
      prof.quadraticCurveTo(1.4, 5.5, 3.6, 8.2); prof.lineTo(2.7, 8.6); prof.quadraticCurveTo(-0.6, 6, -1.6, 2.4); prof.closePath();
      const hg = new T.ExtrudeGeometry(prof, { depth: 2.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2, curveSegments: 10 });
      hg.translate(0, 0, -1.3); hg.rotateX(PI / 2);
      const head = new T.Mesh(hg, K.metal(0x8f949b, 0.3)); g.add(head);
      const face = new T.Mesh(new T.CylinderGeometry(1.55, 1.7, 5.2, 20), K.metal(0xc5c9ce, 0.2));
      face.rotation.x = PI / 2; face.position.z = -4.6; g.add(face);
      return g;
    };
    const makeScrewdriver = (col, len = 12, phillips = false) => {
      // along +x, handle 0..10, shaft 10..10+len
      const g = new T.Group();
      const hp = [[0.001, 0], [1.1, 0], [1.35, 0.5], [1.4, 3], [1.3, 7], [1.0, 9.3], [0.7, 10], [0.001, 10]];
      g.add(new T.Mesh(K.lathe(hp, 14).rotateZ(-PI / 2), K.plastic(col, 0.3)));
      const band = new T.Mesh(new T.CylinderGeometry(1.43, 1.43, 2.4, 14).rotateZ(PI / 2), K.std({ color: 0x1d1d1f, roughness: 0.7 }));
      band.position.x = 4.2; g.add(band);
      const sh = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, len, 10).rotateZ(PI / 2), chrome); sh.position.x = 10 + len / 2; g.add(sh);
      const tip = new T.Mesh(phillips ? new T.ConeGeometry(0.34, 1.2, 4).rotateZ(-PI / 2) : new T.BoxGeometry(1.2, 0.16, 0.7), chrome); tip.position.x = 10 + len + 0.5; g.add(tip);
      return g;
    };
    const lyingScrewdriver = (x, z, ang, col, len, ph) => {
      const g = makeScrewdriver(col, len, ph);
      g.position.set(x, 1.38, z); g.rotation.order = 'YXZ'; g.rotation.y = -ang; g.rotation.x = r() * 3;
      const h = new T.Group(); h.add(g); K.add(h);
      AO(x + Math.cos(ang) * 8, z + Math.sin(ang) * 8, 10, 1.6, 0.4, ang);
      K.capsule(x, z, x + Math.cos(ang) * 10, z + Math.sin(ang) * 10, 1.4, 2.8);
    };

    // ---------------------------------------------------------------- pegboard tools (only the lower part is usually in view)
    {
      const hookMat = K.metal(0x9aa0a8, 0.3);
      const hooks = [];
      const hook = (x, y) => hooks.push({ x, y, z: WALLZ + 1.4, rx: PI / 2 + 0.25 });
      // combination wrenches, sorted by size
      const wr = [];
      for (let i = 0; i < 9; i++) {
        const s = 0.62 + i * 0.07, x = -40 + i * 4.6, top = 28;
        wr.push({ x, y: top - 8.4 * s, z: WALLZ + 0.9, s, rz: 0 });
        hook(x, top + 1.6);
      }
      K.instances(wrenchGeo, chrome, wr);
      // the shadow-board outline where the hammer used to hang (it is on the bench now)
      wallDecal(15, 16, 18, WALLZ + 0.05, 30, 30, { alpha: 0.9 });
      hook(14, 30); hook(22, 30);
      // a second hammer still hanging
      const hm = makeHammer();
      hm.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0, -1, 0), new T.Vector3(0, 0, 1), new T.Vector3(-1, 0, 0)));
      hm.position.set(-62, 44, WALLZ + 2);
      K.add(hm); hook(-62, 45.5);
      // screwdriver rack
      K.mesh(new T.BoxGeometry(34, 1.6, 6), pineMat, -92, 24, WALLZ + 3);
      const cols = [0xd63a2c, 0x2f6fd6, 0xf2b81c, 0x2a9a4a, 0xd63a2c, 0x2f6fd6];
      cols.forEach((c, i) => {
        const sd = makeScrewdriver(c, 9 + (i % 3) * 3, i % 2 === 1);
        sd.rotation.z = -PI / 2; sd.position.set(-106 + i * 5.6, 35, WALLZ + 3);
        K.add(sd);
      });
      // pliers
      for (const [x, col] of [[44, 0xc8302a], [52, 0x2b62c4]]) {
        const g = new T.Group();
        for (const s of [-1, 1]) {
          const arm = new T.Mesh(new T.BoxGeometry(0.9, 13, 0.6), K.plastic(col, 0.4)); arm.position.set(s * 1.4, -5, 0); arm.rotation.z = s * 0.12; g.add(arm);
          const jaw = new T.Mesh(new T.BoxGeometry(0.9, 5, 0.7), darkSteel); jaw.position.set(s * 0.4, 3.5, 0); jaw.rotation.z = -s * 0.08; g.add(jaw);
        }
        const piv = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 1, 12).rotateX(PI / 2), steel); piv.position.y = 1; g.add(piv);
        g.position.set(x, 20, WALLZ + 1.2); K.add(g); hook(x, 28);
      }
      // extension cord coil
      for (let i = 0; i < 4; i++) K.mesh(new T.TorusGeometry(7 + i * 0.25, 0.55, 8, 40), K.plastic(0xff7a1a, 0.4), 78 + i * 0.6, 22 - i * 0.4, WALLZ + 1.2 + i * 0.9, { rz: i * 0.2 });
      hook(78, 30);
      // speed square
      const sq = new T.Shape(); sq.moveTo(0, 0); sq.lineTo(17.5, 0); sq.lineTo(0, 17.5); sq.closePath();
      const sh = new T.Path(); sh.moveTo(3, 3); sh.lineTo(10, 3); sh.lineTo(3, 10); sh.closePath(); sq.holes.push(sh);
      K.mesh(new T.ExtrudeGeometry(sq, { depth: 0.6, bevelEnabled: false }), K.metal(0x8f969e, 0.35), 98, 8, WALLZ + 0.8, { rz: 0.2 });
      hook(100, 25);
      // ear defenders
      {
        const g = new T.Group();
        const cup = new T.SphereGeometry(3.4, 20, 14); cup.scale(1, 1.25, 0.7);
        for (const s of [-1, 1]) { const m = new T.Mesh(cup, K.plastic(0xd8352a, 0.35)); m.position.set(s * 6.5, 0, 1.6); g.add(m); }
        const band = new T.Mesh(new T.TorusGeometry(7, 0.7, 8, 24, PI), K.plastic(0x222224, 0.4)); band.position.y = 1; g.add(band);
        g.position.set(-135, 20, WALLZ + 1); K.add(g); hook(-135, 29);
      }
      // clipboard with a hand-drawn plan of this very track
      {
        const c = TX.makeCanvas(256, 340);
        const g = c.getContext('2d');
        g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, 256, 340);
        g.fillStyle = '#222'; g.font = '700 22px Rubik, sans-serif'; g.fillText('RALLY TRACK v3', 22, 44);
        g.strokeStyle = 'rgba(40,40,46,0.85)'; g.lineWidth = 4; g.lineJoin = 'round';
        g.beginPath(); TRACK.forEach(([x, z], i) => { const X = 128 + x * 0.68, Y = 190 + z * 0.68; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.stroke();
        g.font = 'italic 18px Georgia, serif'; g.fillStyle = 'rgba(30,50,140,0.9)'; g.fillText('jump!', 140, 120); g.fillText('oil →', 175, 150); g.fillText('mind the hole', 40, 300);
        const cm = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.85 });
        K.mesh(new T.BoxGeometry(23, 32, 0.4), K.std({ color: 0x8a6a42, roughness: 0.6 }), 128, 24, WALLZ + 0.6, { rz: 0.04 });
        K.mesh(new T.PlaneGeometry(21, 28), cm, 128, 23.2, WALLZ + 0.85, { rz: 0.04 });
        K.mesh(new K.RoundedBoxGeometry(9, 2.5, 1.2, 2, 0.4), chrome, 128.6, 38.5, WALLZ + 1.1, { rz: 0.04 });
        hook(129, 41);
      }
      // a coil of wire, a hand saw outline and paint brushes
      K.mesh(new T.TorusGeometry(4.5, 1.2, 8, 24), K.metal(0xb87333, 0.35), -10, 16, WALLZ + 1.4); hook(-10, 21);
      for (let i = 0; i < 3; i++) {
        const bx = -152 + i * 6;
        K.mesh(new T.BoxGeometry(1.2, 10, 0.8), pineMat, bx, 26, WALLZ + 1.2);
        K.mesh(new T.BoxGeometry(3.2 + i, 2.2, 1.0), steel, bx, 20, WALLZ + 1.2);
        K.mesh(new T.BoxGeometry(3.0 + i, 5, 1.2), K.std({ color: 0x3a2c22, roughness: 0.9 }), bx, 16.5, WALLZ + 1.2);
        hook(bx, 31.5);
      }
      const hg = new T.CylinderGeometry(0.22, 0.22, 3.2, 6); hg.translate(0, 1.6, 0);
      K.instances(hg, hookMat, hooks);
      // jars of screws on the shelf (lids screwed to the shelf underside in real garages, here simply standing)
      const jarMat = K.glass(0xf2f5f0, 0.25);
      const lids = [], fills = [];
      const jarG = K.lathe([[0.001, 0], [4, 0], [4.3, 0.5], [4.3, 9], [3.6, 10], [3.6, 11], [0.001, 11]], 24), jars = [];
      for (let i = 0; i < 6; i++) jars.push(jarG.clone().translate(-70 + i * 11, 52.9, WALLZ + 8));
      K.mesh(K.BufferGeometryUtils.mergeGeometries(jars), jarMat, 0, 0, 0, { cast: false });
      for (let i = 0; i < 6; i++) {
        const x = -70 + i * 11, z = WALLZ + 8;
        fills.push({ x, y: 52.9 + 2.5 + i % 3, z, sx: 3.9, sy: 5 + (i % 3) * 2, sz: 3.9, color: [0xa8acb2, 0xc9a24a, 0x6f7276][i % 3] });
        lids.push({ x, y: 52.9 + 11.2, z, color: [0x9a9ea5, 0xb89a50, 0x6f7276][i % 3] });
      }
      K.instances(new T.CylinderGeometry(1, 1, 1, 16), K.std({ color: 0xffffff, roughness: 0.5, metalness: 0.6 }), fills, { colors: true, cast: false });
      K.instances(new T.CylinderGeometry(3.9, 3.9, 1.3, 20), K.metal(0xffffff, 0.35), lids, { colors: true });
    }

    // ---------------------------------------------------------------- road: sandpaper strip taped down
    {
      const W = 256, H = 1024;
      const rr = K.rng(77);
      const h = new Float32Array(W * H);
      const c = TX.paint(W, H, (x, y, u, v, o) => {
        const sheet = y < 512 ? 0 : 1;
        const n = rr();
        let k = (sheet ? 66 : 60) + (n - 0.5) * 20;
        let hh = n * 0.4;
        if (n > 0.94) { k += 70 * (n - 0.94) / 0.06; hh = 1; } else if (n < 0.05) { k -= 24; hh = 0; }
        const sy = y % 512;
        if (sy < 4) { k *= 0.45; hh = 0.1; } else if (sy < 7) { k += 30; hh = 1; }
        const wear = Math.exp(-Math.pow((u - 0.5) / 0.22, 2)) * 6;
        o[0] = k + wear; o[1] = k * 0.98 + wear; o[2] = k * 0.96 + wear;
        h[y * W + x] = hh;
      });
      // a few scuffs and tyre polish
      const g = c.getContext('2d');
      for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(${rr() < 0.5 ? '15,14,13' : '140,136,130'},${rr() * 0.18})`; g.lineWidth = 2 + rr() * 8; const x = 30 + rr() * 196, y = rr() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rr() - 0.5) * 30, y + 40 + rr() * 140); g.stroke(); }
      const map = TX.toTexture(c), nmap = TX.toTexture(TX.normalFromHeight(h, W, H, 1.6), { srgb: false });
      const roadMat = K.std({ map, normalMap: nmap, normalScale: V2(0.9), roughness: 0.96, color: 0xf2f2f4 });
      const vS = L / Math.round(L / 56);
      K.ribbon({ mat: roadMat, width: 14.6, y: 0.03, vScale: vS });
      A.roadMat = roadMat;
    }

    // which edge samples get hazard tape (outside of tight corners) or the tape-measure blade
    const N = track.N, ds = track.ds;
    const hazard = { '-1': new Uint8Array(N), '1': new Uint8Array(N) };
    {
      const win = Math.round(8 / ds);
      const ks = new Float32Array(N);
      for (let i = 0; i < N; i++) { let k = 0; for (let j = -win; j <= win; j++) k += track.curv[(i + j + N) % N]; ks[i] = k / (2 * win + 1); }
      for (const side of [-1, 1]) {
        const arr = hazard[side];
        for (let i = 0; i < N; i++) arr[i] = side * ks[i] < -1 / 34 ? 1 : 0;
        // extend runs a little and drop tiny ones
        const ext = Math.round(5 / ds), out = new Uint8Array(N);
        for (let i = 0; i < N; i++) if (arr[i]) for (let j = -ext; j <= ext; j++) out[(i + j + N) % N] = 1;
        let i = 0;
        while (i < N) {
          if (!out[i]) { i++; continue; }
          let j = i; while (j < N && out[j]) j++;
          if ((j - i) * ds < 14) for (let k = i; k < j; k++) out[k] = 0;
          i = j;
        }
        hazard[side] = out;
      }
    }
    const BLADE = { s0: 9, s1: 86, off: -8.3 };
    const isBlade = (side, s) => side < 0 && s > BLADE.s0 - 1 && s < BLADE.s1 + 1;
    const isHaz = (side, s) => hazard[side][track.idx(s)] === 1;

    // masking tape + hazard tape along both edges
    {
      // masking tape: two torn pieces per tile, crepe texture
      const W = 64, H = 1024;
      const rr = K.rng(9);
      const c = TX.paint(W, H, (x, y, u, v, o) => {
        const crepe = Math.sin(y * 1.9 + Math.sin(x * 0.3) * 0.8) * 0.5 + 0.5;
        const n = rr();
        let k = 0.9 + crepe * 0.05 + n * 0.05;
        if (x < 2 || x > W - 3) k *= 0.86;
        const sy = y % 512;
        if (sy < 22) k *= 0.93; // overlap of the next piece
        o[0] = 236 * k; o[1] = 222 * k; o[2] = 184 * k; o[3] = 255;
      });
      const g = c.getContext('2d');
      // torn ends (slightly darker zigzag line)
      for (const y0 of [0, 512]) { g.strokeStyle = 'rgba(150,130,90,0.7)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, y0 + 20 + (rr() - 0.5) * 6); g.stroke(); }
      // pencil ticks and a few numbers written on the tape
      g.strokeStyle = 'rgba(60,60,70,0.75)'; g.fillStyle = 'rgba(60,60,70,0.75)'; g.lineWidth = 2;
      for (let y = 60; y < H; y += 64 + rr() * 60) { g.beginPath(); g.moveTo(10, y); g.lineTo(44 + rr() * 10, y + (rr() - 0.5) * 3); g.stroke(); }
      g.font = '22px Rubik, sans-serif';
      for (const [y, t] of [[300, '24'], [780, '36½'], [930, 'ok']]) { g.save(); g.translate(40, y); g.rotate(PI / 2); g.fillText(t, 0, 0); g.restore(); }
      const tapeMat = K.std({ map: TX.toTexture(c), roughness: 0.82, color: 0xffffff });
      const both = (make) => { const ms = [-1, 1].map(make); const g = K.BufferGeometryUtils.mergeGeometries(ms.map((m) => m.geometry)); K.group.remove(ms[1]); ms[1].geometry.dispose(); ms[0].geometry.dispose(); ms[0].geometry = g; return ms[0]; };
      both((side) => K.ribbon({ mat: tapeMat, width: 2.4, offset: side * 7.05, y: 0.055, vScale: 80, widthFn: (w, s) => (isBlade(side, s) || isHaz(side, s) ? 0 : 2.4) }));
      // hazard tape
      const hc = TX.makeCanvas(64, 256);
      const hg = hc.getContext('2d');
      hg.fillStyle = '#f3c51a'; hg.fillRect(0, 0, 64, 256);
      hg.fillStyle = '#18181a';
      const per = 256 / 6;
      for (let k = -3; k < 10; k++) { hg.beginPath(); const y0 = k * per; hg.moveTo(0, y0); hg.lineTo(64, y0 + 64); hg.lineTo(64, y0 + 64 + per / 2); hg.lineTo(0, y0 + per / 2); hg.closePath(); hg.fill(); }
      for (let i = 0; i < 120; i++) { hg.fillStyle = `rgba(255,255,255,${rr() * 0.18})`; hg.fillRect(rr() * 64, rr() * 256, 1 + rr() * 6, 1); }
      hg.fillStyle = 'rgba(0,0,0,0.25)'; hg.fillRect(0, 0, 2, 256); hg.fillRect(62, 0, 2, 256);
      const hazMat = K.phys({ map: TX.toTexture(hc), roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.35 });
      both((side) => K.ribbon({ mat: hazMat, width: 2.5, offset: side * 7.05, y: 0.06, vScale: 9.6, widthFn: (w, s) => (isHaz(side, s) && !isBlade(side, s) ? 2.5 : 0) }));
      // blue chalk centre line on the two long straights
      const cc = TX.makeCanvas(32, 512);
      const cg = cc.getContext('2d');
      for (let i = 0; i < 2600; i++) {
        const y = rr() * 512, x = 16 + rr() * rr() * 14 * (rr() < 0.5 ? -1 : 1);
        if (Math.sin(y * 0.035) < -0.82) continue; // breaks where the line didn't snap clean
        cg.fillStyle = `rgba(80,140,235,${0.25 + rr() * 0.6})`; cg.fillRect(x, y, 1.5 + rr() * 2, 1.5 + rr() * 3);
      }
      const chalkMat = K.std({ map: TX.toTexture(cc), transparent: true, depthWrite: false, roughness: 0.95 });
      const onChalk = (s) => (s > 440 && s < 586) || (s > 150 && s < 228) || (s > 655 && s < 712);
      K.ribbon({ mat: chalkMat, width: 0.9, y: 0.05, vScale: 20, widthFn: (w, s) => (onChalk(s) ? 0.9 : 0) }).renderOrder = 1;
    }

    // start / finish: a checker sprayed through a stencil onto a strip of tape
    {
      const s0 = 45;
      const c = TX.makeCanvas(512, 128);
      const g = c.getContext('2d');
      const rr = K.rng(3);
      g.fillStyle = '#ece0bf'; g.fillRect(0, 0, 512, 128);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(150,130,90,${rr() * 0.12})`; g.fillRect(rr() * 512, rr() * 128, 1, 3 + rr() * 6); }
      for (let y = 0; y < 2; y++) for (let x = 0; x < 9; x++) {
        if ((x + y) % 2) continue;
        const px = 4 + x * 56, py = 8 + y * 56;
        g.fillStyle = 'rgba(18,18,20,0.95)'; g.fillRect(px, py, 56, 56);
        for (let k = 0; k < 120; k++) { g.fillStyle = `rgba(18,18,20,${rr() * 0.5})`; g.fillRect(px - 4 + rr() * 64, py - 4 + rr() * 64, 1.5, 1.5); }
      }
      g.clearRect(0, 0, 3, 128); g.clearRect(509, 0, 3, 128);
      const m = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.85, transparent: true });
      const p = track.at(s0);
      const mesh = K.mesh(new T.PlaneGeometry(15.4, 3.85), m, p.x, 0.075, p.z, { cast: false });
      mesh.rotation.order = 'YXZ'; mesh.rotation.y = -p.angle + PI / 2; mesh.rotation.x = -PI / 2;
      // spray-painted grid boxes behind the line
      for (let row = 0; row < 2; row++) for (const side of [-1, 1]) {
        const q = track.place(s0 - 7 - row * 7, side * 3.3);
        decal(14, q.x, q.z, 5.4, 3.6, q.angle, { y: 0.07, color: 0xf6f6f0, alpha: 0.85 });
      }
    }

    // ---------------------------------------------------------------- tape measure: the blade is the left road edge on the start straight
    {
      const len = BLADE.s1 - BLADE.s0;
      const W = 64, H = 2048;
      const c = TX.makeCanvas(W, H);
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#f7d64a'); gr.addColorStop(0.5, '#efc21c'); gr.addColorStop(1, '#f7d64a');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const pxu = H / len; // pixels per unit along
      g.fillStyle = '#141414';
      for (let mm = 0; mm <= len * 10; mm++) {
        const y = mm * pxu / 10;
        const l = mm % 10 === 0 ? 20 : mm % 5 === 0 ? 13 : 8;
        g.fillRect(W - l, y - 0.6, l, 1.2);
      }
      for (let inch = 0; inch <= len / 2.54; inch++) { const y = inch * 2.54 * pxu; g.fillRect(0, y - 0.6, 14, 1.2); for (const f of [0.25, 0.5, 0.75]) g.fillRect(0, y + f * 2.54 * pxu - 0.5, f === 0.5 ? 9 : 5, 1); }
      g.font = '700 17px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let cm = 1; cm < len; cm++) {
        g.save(); g.translate(W * 0.55, cm * pxu); g.rotate(PI / 2);
        g.fillStyle = cm % 10 === 0 ? '#c41e1e' : '#141414';
        g.fillText(String(cm), 0, 0); g.restore();
      }
      const bladeMat = K.phys({ map: TX.toTexture(c, { wrap: false }), roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, side: T.DoubleSide });
      // v=1 at s1 (hook end, 0 cm) -> flip so numbers count up from the hook
      const geo = strip(BLADE.s0, BLADE.s1, BLADE.off, 2.5, 0.07, { segU: 5, prof: (u) => Math.pow(2 * u - 1, 2) * 0.32 });
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i));
      const bm = new T.Mesh(geo, bladeMat); bm.receiveShadow = true; bm.castShadow = true; K.group.add(bm);
      // the hook at the end
      const hp = track.place(BLADE.s1, BLADE.off);
      const hookG = new T.Group();
      hookG.add(new T.Mesh(new T.BoxGeometry(0.5, 0.18, 2.7), brass));
      const lip = new T.Mesh(new T.BoxGeometry(0.15, 1.3, 2.7), brass); lip.position.set(0.25, 0.55, 0); hookG.add(lip);
      hookG.position.set(hp.x, 0.2, hp.z); hookG.rotation.y = -hp.angle; K.add(hookG);
      // the case
      const cp = track.place(BLADE.s0 - 3.6, BLADE.off - 1.3);
      const ang = cp.angle;
      const cg = new T.Group();
      const shell = new T.Mesh(new K.RoundedBoxGeometry(7.6, 7.4, 4.0, 4, 1.4), K.plastic(0xf2c21b, 0.35)); shell.position.y = 3.7; cg.add(shell);
      for (const s of [-1, 1]) { const side = new T.Mesh(new T.CylinderGeometry(3.1, 3.1, 0.5, 28).rotateX(PI / 2), blackRubber); side.position.set(0.3, 3.9, s * 2.05); cg.add(side); }
      const lock = new T.Mesh(new K.RoundedBoxGeometry(2.4, 0.9, 1.4, 2, 0.3), blackRubber); lock.position.set(-1.2, 7.5, 0); cg.add(lock);
      const clip = new T.Mesh(new T.BoxGeometry(5, 5.6, 0.25), steel); clip.position.set(0.6, 4, -2.25); cg.add(clip);
      const lc = TX.makeCanvas(128, 128); const lg = lc.getContext('2d');
      lg.fillStyle = '#18181a'; lg.beginPath(); lg.arc(64, 64, 62, 0, 6.28); lg.fill();
      lg.fillStyle = '#f2c21b'; lg.font = '700 26px "Lilita One", sans-serif'; lg.textAlign = 'center'; lg.fillText('5m', 64, 60); lg.font = '600 15px Rubik, sans-serif'; lg.fillText('TRUE-LINE', 64, 86);
      const lab = new T.Mesh(new T.CircleGeometry(2.9, 28), K.std({ map: TX.toTexture(lc, { wrap: false }), roughness: 0.5 })); lab.position.set(0.3, 3.9, 2.32); cg.add(lab);
      cg.position.set(cp.x, 0, cp.z); cg.rotation.y = -ang + PI; // blade comes out of the case's -x side towards the hook
      K.add(cg);
      K.box(cp.x, cp.z, 3.9, 2.3, ang, 7.4);
      AO(cp.x, cp.z, 5, 3.4, 0.5, ang);
    }

    // ---------------------------------------------------------------- the jump: a 1x8 board on a 2x4, over spilt screws
    const screwGeo = (() => {
      const shaft = new T.CylinderGeometry(0.12, 0.2, 3.8, 6); shaft.translate(0, -1.9, 0);
      const tip = new T.ConeGeometry(0.12, 0.6, 6); tip.rotateX(PI); tip.translate(0, -4.1, 0);
      const head = new T.CylinderGeometry(0.4, 0.2, 0.32, 10); head.translate(0, 0.16, 0);
      const g = K.BufferGeometryUtils.mergeGeometries([shaft.toNonIndexed(), tip.toNonIndexed(), head.toNonIndexed()]);
      g.rotateZ(PI / 2); g.translate(-2, 0.22, 0);
      return g;
    })();
    const screws = [], nails = [];
    {
      const sR = 518, len = 22, hgt = 5.6, wid = 16.4;
      const p = track.place(sR, 0);
      const ang = p.angle;
      K.ramp(p.x, p.z, ang, len, wid, hgt, 0);
      const slope = Math.atan2(hgt, len);
      const Lb = Math.hypot(len, hgt) + 0.4;
      const grp = new T.Group();
      const board = new T.Mesh(new K.RoundedBoxGeometry(Lb, 1.9, wid + 0.6, 2, 0.25), pineMat);
      board.position.y = -0.95; grp.add(board);
      // pencil marks and nail heads on the board
      grp.position.set(p.x, hgt / 2, p.z);
      grp.rotation.order = 'YZX'; grp.rotation.y = -ang; grp.rotation.z = slope;
      K.add(grp);
      const nh = [];
      for (const [a, b] of [[Lb / 2 - 2.5, -6], [Lb / 2 - 2.5, 6], [Lb / 2 - 2.5, 0], [-Lb / 2 + 1.8, -5], [-Lb / 2 + 1.8, 5]]) {
        const lx = a * Math.cos(slope), ly = hgt / 2 + a * Math.sin(slope) + 0.02;
        const [wx, wz] = local(p.x, p.z, ang, lx, b);
        nh.push({ x: wx, y: ly, z: wz, rz: 0 });
      }
      K.instances(new T.CylinderGeometry(0.32, 0.32, 0.08, 10), darkSteel, nh, { cast: false });
      // 2x4 lying flat under the high end
      const bAlong = len / 2 + 4.45 - 0.3;
      const [bx, bz] = local(p.x, p.z, ang, bAlong, 0);
      const twoFour = new T.Mesh(new K.RoundedBoxGeometry(8.9, 3.8, 19, 2, 0.3), pineMat);
      twoFour.position.set(bx, 1.9, bz); twoFour.rotation.y = -ang; K.add(twoFour);
      for (const s of [-1, 1]) { const [ex, ez] = local(bx, bz, ang, 0, s * 9.52); const e = K.mesh(new T.PlaneGeometry(8.6, 3.5), endGrain, ex, 1.9, ez, { ry: -ang + (s > 0 ? 0 : PI) }); e.castShadow = false; }
      K.platform(bx, bz, 4.45, 9.5, ang, 3.8);
      AO(p.x, p.z, len / 2 + 2, wid / 2 + 1, 0.3, ang);
      AO(bx, bz, 5.5, 10.5, 0.5, ang);
      // spilt screws beyond: rough surface, the cardboard box lies on its side at the roadside
      const s1 = sR + len / 2 + 9.5;
      const bp = track.place(s1 + 12, 16.5);
      const ba = bp.angle + PI / 2 + 0.35;
      const box = new T.Group();
      // printed kraft carton: label on the outside faces, plain corrugated kraft inside
      const boxC = TX.makeCanvas(512, 256); const bg = boxC.getContext('2d');
      bg.drawImage(kraft.image, 0, 0, 512, 256);
      bg.fillStyle = '#1f3f7a'; bg.fillRect(0, 0, 512, 62); bg.fillRect(0, 236, 512, 20);
      bg.fillStyle = '#f4f1e8'; bg.font = '700 44px "Lilita One", Rubik, sans-serif'; bg.fillText('WOOD SCREWS', 22, 47);
      bg.fillStyle = '#1f3f7a'; bg.font = '700 70px Rubik, sans-serif'; bg.fillText('4.0 × 40', 22, 140);
      bg.font = '600 26px Rubik, sans-serif'; bg.fillText('200 pcs · zinc · countersunk', 22, 190); bg.fillText('PZ2', 22, 224);
      // screw drawing
      bg.save(); bg.translate(400, 150); bg.rotate(-0.5); bg.fillStyle = '#1f3f7a';
      bg.fillRect(-70, -7, 120, 14); bg.beginPath(); bg.moveTo(50, -7); bg.lineTo(80, 0); bg.lineTo(50, 7); bg.fill();
      bg.fillRect(-84, -20, 14, 40); bg.strokeStyle = '#c4975f'; bg.lineWidth = 3;
      for (let x = -60; x < 60; x += 11) { bg.beginPath(); bg.moveTo(x, -7); bg.lineTo(x + 7, 7); bg.stroke(); }
      bg.restore();
      // scuffs and a torn corner
      for (let i = 0; i < 40; i++) { bg.fillStyle = `rgba(235,215,180,${r() * 0.35})`; bg.fillRect(r() * 512, r() * 256, 2 + r() * 20, 1 + r() * 2); }
      const boxSide = K.std({ map: TX.toTexture(boxC, { wrap: false }), roughness: 0.88 });
      const card = K.std({ map: kraft, color: 0xe8d8c4, roughness: 0.92, side: T.DoubleSide });
      // box lying on its side, open end facing the road: local +x towards the road
      const bW = 10, bH = 6, bL = 9;
      const outside = (face) => { const arr = [card, card, card, card, card, card]; arr[face] = boxSide; return arr; };
      const bot = new T.Mesh(new T.BoxGeometry(bL, bH, 0.2), outside(5)); bot.position.set(0, bH / 2, -bW / 2); box.add(bot);
      const topP = new T.Mesh(new T.BoxGeometry(bL, bH, 0.2), outside(4)); topP.position.set(0, bH / 2, bW / 2); box.add(topP);
      const fl = new T.Mesh(new T.BoxGeometry(bL, 0.2, bW), card); fl.position.set(0, 0.1, 0); box.add(fl);
      const ceil = new T.Mesh(new T.BoxGeometry(bL, 0.2, bW), outside(2)); ceil.position.set(0, bH - 0.1, 0); box.add(ceil);
      const back = new T.Mesh(new T.BoxGeometry(0.2, bH, bW), card); back.position.set(-bL / 2, bH / 2, 0); box.add(back);
      const flap = new T.Mesh(new T.BoxGeometry(5, 0.15, bW), card); flap.position.set(bL / 2 + 2.4, 0.08, 0); box.add(flap);
      box.position.set(bp.x, 0, bp.z); box.rotation.y = -ba; K.add(box);
      K.box(bp.x, bp.z, bL / 2, bW / 2, ba, bH);
      AO(bp.x, bp.z, 6.5, 6.5, 0.5, ba);
      // the spill: screws on the road and around the box
      const spill = [];
      for (let i = 0; i < 46; i++) {
        const s = s1 + r() * 14, o = -6 + r() * 15;
        const q = track.place(s, o);
        screws.push({ x: q.x, z: q.z, ry: r() * 6.28 });
        if (i < 18) spill.push([q.x, q.z]);
      }
      for (let i = 0; i < 24; i++) { const a = r() * 6.28, d = 3 + r() * 7; const [x, z] = local(bp.x, bp.z, ba, 6 + Math.abs(Math.cos(a)) * d, Math.sin(a) * d * 0.8); screws.push({ x, z, ry: r() * 6.28 }); }
      const q0 = track.place(s1, -7.2), q1 = track.place(s1, 7.6), q2 = track.place(s1 + 14, 7.6), q3 = track.place(s1 + 14, -7.2);
      K.surface('rough', { poly: [[q0.x, q0.z], [q1.x, q1.z], [q2.x, q2.z], [q3.x, q3.z]] });
    }

    // ---------------------------------------------------------------- the bench vise in the north pocket
    {
      const VX = -87, VZ = -79;
      // hammertone enamel: fine dimpled paint, chipped to bare iron on the edges
      const tone = TX.mottledTextures({ size: 256, a: 0x2f62a6, b: 0x2a5898, seed: 44, period: 24, bump: 0.6, speck: 0.04 });
      for (const t of [tone.map, tone.normalMap]) t.repeat.set(2, 2);
      const vMat = K.phys({ map: tone.map, normalMap: tone.normalMap, normalScale: V2(0.12), roughness: 0.42, metalness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
      const jawTex = (() => { const c = TX.paint(64, 64, (x, y, u, v, o) => { const k = ((x + y) % 8 < 2 || (x - y + 64) % 8 < 2) ? 0.55 : 1; o[0] = o[1] = o[2] = 200 * k; }); return TX.toTexture(c, { repeat: [3, 1] }); })();
      const jawMat = K.metal(0x9aa0a6, 0.4, { map: jawTex });
      const g = new T.Group();
      // swivel base
      g.add(new T.Mesh(K.lathe([[0.001, 0], [8, 0], [8.2, 0.6], [7.8, 1.6], [6.5, 2.2], [0.001, 2.2]], 40), vMat));
      const bolts = [];
      for (let i = 0; i < 3; i++) { const a = i * 2.09 + 0.5; bolts.push({ x: Math.cos(a) * 6.8, y: 1.5, z: Math.sin(a) * 6.8 }); }
      for (const b of bolts) { const m = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 0.9, 6), darkSteel); m.position.set(b.x, b.y, b.z); g.add(m); }
      // fixed body + rear jaw + anvil
      const body = new T.Mesh(new K.RoundedBoxGeometry(10, 7, 16, 3, 1.2), vMat); body.position.set(0, 5.5, -2); g.add(body);
      const rearJaw = new T.Mesh(new K.RoundedBoxGeometry(14, 7.5, 5.2, 3, 1), vMat); rearJaw.position.set(0, 12.6, -7.8); g.add(rearJaw);
      const anvil = new T.Mesh(new K.RoundedBoxGeometry(9, 2.6, 7, 3, 0.6), K.metal(0x5d6066, 0.35)); anvil.position.set(0, 14.6, -13.5); g.add(anvil);
      const neck = new T.Mesh(new K.RoundedBoxGeometry(7, 6, 6, 3, 1), vMat); neck.position.set(0, 11.5, -12.5); g.add(neck);
      // moving jaw on its slide
      const gap = 3.9;
      const frontJaw = new T.Mesh(new K.RoundedBoxGeometry(14, 7.5, 5.2, 3, 1), vMat); frontJaw.position.set(0, 12.6, -7.8 + 5.2 + gap); g.add(frontJaw);
      const slide = new T.Mesh(new K.RoundedBoxGeometry(8, 5.5, 18, 3, 1), vMat); slide.position.set(0, 7.2, 4.5); g.add(slide);
      for (const z of [-7.8 + 2.65, -7.8 + 2.55 + gap]) { const jp = new T.Mesh(new T.BoxGeometry(13, 3.2, 0.5), jawMat); jp.position.set(0, 14.4, z); g.add(jp); }
      // screw, boss, handle
      const scr = new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 6, 16).rotateX(PI / 2), steel); scr.position.set(0, 7.2, 15.5); g.add(scr);
      const boss = new T.Mesh(new T.CylinderGeometry(2.1, 2.1, 2.6, 20).rotateX(PI / 2), vMat); boss.position.set(0, 7.2, 17.6); g.add(boss);
      const bar = new T.Mesh(new T.CylinderGeometry(0.65, 0.65, 23, 14), chrome); bar.rotation.z = PI / 2 - 0.35; bar.position.set(0, 7.2, 18); g.add(bar);
      for (const s of [-1, 1]) { const ball = new T.Mesh(new T.SphereGeometry(1.25, 16, 10), chrome); ball.position.set(s * 11.5 * Math.cos(0.35), 7.2 - s * 11.5 * Math.sin(0.35), 18); g.add(ball); }
      // a block of wood clamped upright, with a saw cut started
      const wb = new T.Mesh(new K.RoundedBoxGeometry(11, 12, gap - 0.1, 2, 0.2), pineMat); wb.position.set(1, 15, -7.8 + 2.6 + gap / 2); g.add(wb);
      const kerf = new T.Mesh(new T.BoxGeometry(0.25, 3, gap + 0.02), K.std({ color: 0x2a1a0c, roughness: 1 })); kerf.position.set(-1.5, 19.6, -7.8 + 2.6 + gap / 2); g.add(kerf);
      const top = new T.Mesh(new T.PlaneGeometry(10.6, gap - 0.3), endGrain); top.rotation.x = -PI / 2; top.position.set(1, 21.02, -7.8 + 2.6 + gap / 2); g.add(top);
      g.position.set(VX, 0, VZ); g.rotation.y = 0.12;
      K.add(g);
      K.box(VX, VZ - 4, 7.5, 12, -0.12, 20);
      K.circle(VX, VZ, 8.2, 2.2);
      K.capsule(VX - 10.5, VZ + 19, VX + 10.5, VZ + 17, 1.3, 11);
      AO(VX, VZ - 2, 10, 16, 0.55, -0.12);
      AO(VX, VZ + 17, 12, 3, 0.3);
      // metal filings and a file under the vise
      const fil = [];
      for (let i = 0; i < 260; i++) { const a = r() * 6.28, d = Math.pow(r(), 0.6) * 14; fil.push({ x: VX + Math.cos(a) * d * 1.2, y: 0.06, z: VZ + 8 + Math.sin(a) * d * 0.8, ry: r() * 6.28, s: r.range(0.05, 0.12), sx: r.range(0.15, 0.5), color: r() < 0.7 ? 0x5a5e64 : 0xb7bcc2 }); }
      K.instances(new T.BoxGeometry(1, 1, 1), K.metal(0xffffff, 0.35), fil, { colors: true, cast: false });
      {
        const fg = new T.Group();
        const fileTex = (() => { const c = TX.paint(64, 16, (x, y, u, v, o) => { const k = (x + y * 2) % 4 < 2 ? 0.6 : 1; o[0] = o[1] = o[2] = 170 * k; }); return TX.toTexture(c, { repeat: [6, 1] }); })();
        const blade = new T.Mesh(new T.BoxGeometry(18, 0.5, 1.9), K.metal(0x8a8f96, 0.5, { map: fileTex })); blade.position.x = 9; fg.add(blade);
        const tang = new T.Mesh(new T.CylinderGeometry(1.1, 0.9, 10, 12).rotateZ(PI / 2), K.std({ color: 0x7a3a1c, roughness: 0.5 })); tang.position.x = -5; tang.position.y = 0.85; fg.add(tang);
        fg.position.set(VX - 3, 0.3, VZ + 27); fg.rotation.y = 0.5; K.add(fg);
        AO(VX + 1, VZ + 25, 14, 2, 0.35, -0.5);
      }
      for (let i = 0; i < 3; i++) { decal(1, VX + r.range(-12, 12), VZ + r.range(5, 20), r.range(5, 9), r.range(4, 7), r() * 3, { color: 0x1a120a, alpha: 0.7 }); }
    }

    // ---------------------------------------------------------------- tipped paint can + teal spill (sticky) on the west straight
    {
      const sP = 196;
      const sp = track.place(sP, 1.5);
      const canMat = K.metal(0xd4d7db, 0.3);
      const paintMat = shiny(K.phys({ color: PAINT, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }), 0.9);
      const labelTex = (col, title) => {
        const c = TX.makeCanvas(512, 160);
        const g = c.getContext('2d');
        g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, 512, 160);
        g.fillStyle = col; g.fillRect(0, 0, 512, 40); g.fillRect(0, 140, 512, 20);
        g.fillStyle = '#fff'; g.font = '700 28px "Lilita One", sans-serif'; g.fillText('SUNNY COAT', 14, 31); g.fillText('SUNNY COAT', 270, 31);
        g.fillStyle = '#2a2a2a'; g.font = '700 30px Rubik, sans-serif'; g.fillText(title, 18, 86); g.fillText(title, 274, 86);
        g.font = '18px Rubik, sans-serif'; g.fillText('satin · interior / exterior', 18, 118); g.fillText('2.5 L', 430, 118);
        g.fillStyle = col; g.beginPath(); g.arc(470, 80, 22, 0, 6.28); g.fill();
        return TX.toTexture(c, { wrap: true });
      };
      // the tipped can, mouth towards the road
      const cp = track.place(sP + 2, 25);
      const ang = Math.atan2(sp.z - cp.z, sp.x - cp.x);
      const can = new T.Group();
      const body = new T.Mesh(K.lathe([[0.001, 0], [6.9, 0], [7.1, 0.4], [7.1, 15.2], [6.8, 15.6], [6.5, 15.6], [6.5, 15.2], [0.001, 15.2]], 40), canMat);
      can.add(body);
      const lab = new T.Mesh(new T.CylinderGeometry(7.12, 7.12, 10, 40, 1, true), K.std({ map: labelTex('#1d9a96', 'LAGOON'), roughness: 0.55 })); lab.position.y = 7.6; can.add(lab);
      const inside = new T.Mesh(new T.CircleGeometry(6.5, 32), paintMat); inside.rotation.x = -PI / 2; inside.position.y = 15.0; can.add(inside);
      const handle = new T.Mesh(new T.TorusGeometry(7.3, 0.18, 6, 32, PI), steel); handle.rotation.y = PI / 2; handle.position.y = 12; can.add(handle);
      can.rotation.z = -PI / 2; can.position.y = 7.1;
      const holder = new T.Group(); holder.add(can); holder.position.set(cp.x, 0, cp.z); holder.rotation.y = -ang;
      K.add(holder);
      K.box(cp.x + Math.cos(ang) * 7.8, cp.z + Math.sin(ang) * 7.8, 7.8, 7.1, ang, 14.2);
      AO(cp.x + Math.cos(ang) * 7.5, cp.z + Math.sin(ang) * 7.5, 9, 7, 0.5, ang);
      warnRoad('paint can', cp.x + Math.cos(ang) * 15.5, cp.z + Math.sin(ang) * 15.5, 0);
      // the spill: from the can mouth across the road
      const mx = cp.x + Math.cos(ang) * 16.5, mz = cp.z + Math.sin(ang) * 16.5;
      const big = K.spill(sp.x, sp.z, 6.6, paintMat, { lump: 0.3, stretch: 1.45, angle: sp.angle, y: 0.22, thick: 0.2 });
      K.surface('sticky', { poly: big.poly });
      big.mesh.castShadow = false;
      K.spill((mx + sp.x) / 2, (mz + sp.z) / 2, 4.2, paintMat, { lump: 0.25, stretch: 1.9, angle: ang, y: 0.2, thick: 0.18 });
      K.spill(mx - Math.cos(ang) * 1.5, mz - Math.sin(ang) * 1.5, 3.2, paintMat, { lump: 0.2, y: 0.19, thick: 0.17 });
      // drips & tyre tracks of paint further down the road
      for (let i = 0; i < 9; i++) { const q = track.place(sP - 12 - i * 3.2, r.range(-4, 5)); decal(2, q.x, q.z, r.range(0.8, 1.8), r.range(0.8, 1.8), r() * 6, { y: 0.07, color: PAINT, alpha: 0.95 }); }
      for (let i = 0; i < 6; i++) { const q = track.place(sP - 10 - i * 4.5, -1.5 + Math.sin(i) * 0.6); decal(1, q.x, q.z, 3.2, 0.9, q.angle, { y: 0.068, color: PAINT, alpha: 0.75 }); }
      // the lid, upside down with paint, and a stir stick
      const lp = [-125, -32];
      K.mesh(new T.CylinderGeometry(7.3, 7.3, 0.6, 36), canMat, lp[0], 0.3, lp[1]);
      K.mesh(new T.CircleGeometry(6.4, 30), paintMat, lp[0], 0.62, lp[1], { rx: -PI / 2, cast: false });
      AO(lp[0], lp[1], 8, 8, 0.4);
      K.circle(lp[0], lp[1], 7.3, 0.6);
      const stick = new T.Group();
      const st = new T.Mesh(new T.BoxGeometry(30, 0.5, 2.6), pineMat); stick.add(st);
      const dip = new T.Mesh(new T.BoxGeometry(11, 0.62, 2.7), paintMat); dip.position.x = -9.6; stick.add(dip);
      stick.position.set(cp.x + 6, 0.3, cp.z + 20); stick.rotation.y = 1.2; K.add(stick);
      AO(cp.x + 6, cp.z + 20, 15, 1.8, 0.35, -1.2);
      // a second, unopened can standing behind, with a screwdriver to lever the lid
      const c2 = [-110, 10];
      const can2 = new T.Group();
      can2.add(new T.Mesh(K.lathe([[0.001, 0], [7.9, 0], [8.1, 0.4], [8.1, 17.8], [7.6, 18.3], [7.6, 18.6], [0.001, 18.6]], 44), canMat));
      const lab2 = new T.Mesh(new T.CylinderGeometry(8.13, 8.13, 12, 44, 1, true), K.std({ map: labelTex('#c23a2c', 'BARN RED'), roughness: 0.55 })); lab2.position.y = 8.6; can2.add(lab2);
      for (let i = 0; i < 5; i++) { const a = -0.5 + i * 0.22; const d = new T.Mesh(new T.CapsuleGeometry(0.28, 2 + (i % 3) * 1.6, 3, 6), K.phys({ color: 0xc23a2c, roughness: 0.2, clearcoat: 1 })); d.position.set(Math.cos(a) * 8.15, 17 - 1 - (i % 3) * 0.8, Math.sin(a) * 8.15); can2.add(d); }
      const rimDrip = new T.Mesh(new T.TorusGeometry(7.85, 0.35, 6, 40, 1.4), K.phys({ color: 0xc23a2c, roughness: 0.2, clearcoat: 1 })); rimDrip.rotation.x = PI / 2; rimDrip.position.y = 18.3; rimDrip.rotation.z = -0.6; can2.add(rimDrip);
      const lidRim = new T.Mesh(new T.TorusGeometry(7.15, 0.32, 8, 44), canMat); lidRim.rotation.x = PI / 2; lidRim.position.y = 18.6; can2.add(lidRim);
      const groove = new T.Mesh(new T.TorusGeometry(6.4, 0.22, 6, 44), darkSteel); groove.rotation.x = PI / 2; groove.position.y = 18.62; can2.add(groove);
      can2.position.set(c2[0], 0, c2[1]); can2.rotation.y = 0.8; K.add(can2);
      K.circle(c2[0], c2[1], 8.2, 18.6);
      AO(c2[0], c2[1], 9.5, 9.5, 0.55);
      decal(0, c2[0] + 13, c2[1] + 5, 17, 17, 0.4, { color: 0xc23a2c, alpha: 0.45 });
      lyingScrewdriver(c2[0] - 6, c2[1] + 12, -0.5, 0xf2b81c, 11, false);
      // paint brush with wet bristles
      const br = new T.Group();
      const bh = new T.Mesh(new K.RoundedBoxGeometry(12, 1.4, 2.6, 2, 0.5), K.std({ map: pine.map, color: 0xd09a5a, roughness: 0.45 })); bh.position.x = -6; br.add(bh);
      const fer = new T.Mesh(new K.RoundedBoxGeometry(3, 1.8, 5, 2, 0.3), steel); fer.position.x = 1.5; br.add(fer);
      const bri = new T.Mesh(new K.RoundedBoxGeometry(5, 1.4, 5, 2, 0.4), K.std({ color: 0x3a2a1c, roughness: 0.9 })); bri.position.x = 5.3; br.add(bri);
      const wet = new T.Mesh(new K.RoundedBoxGeometry(2.6, 1.5, 5.1, 2, 0.4), paintMat); wet.position.x = 6.6; br.add(wet);
      br.position.set(-128, 0.9, -47); br.rotation.y = 2.4; K.add(br);
      AO(-128, -47, 11, 3, 0.35, -2.4);
      decal(2, -132, -42, 3, 3, 1, { color: PAINT, alpha: 0.9 });
    }

    // ---------------------------------------------------------------- the coffee mug (west infield) + rings
    {
      const cx = -121, cz = 36;
      const prof = [[0.001, 0], [3.9, 0], [4.3, 0.3], [4.5, 1], [4.5, 9.6], [4.3, 9.95], [4.05, 9.95], [3.95, 9.6], [3.95, 1.1], [0.001, 1.0]];
      const g = K.lathe(prof, 48);
      const col = new Float32Array(g.attributes.position.count * 3);
      const pos = g.attributes.position;
      const outC = new T.Color(0x2b4a6e), inC = new T.Color(0xf2ece0);
      for (let i = 0; i < pos.count; i++) { const rr2 = Math.hypot(pos.getX(i), pos.getZ(i)), y = pos.getY(i); const c = (rr2 < 4.1 && y > 1.0) || y > 9.8 ? inC : outC; col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      const mugMat = K.ceramic(0xffffff, { vertexColors: true, roughness: 0.22 });
      K.mesh(g, mugMat, cx, 0, cz);
      const lc = TX.makeCanvas(512, 128); const lg = lc.getContext('2d');
      lg.fillStyle = '#2b4a6e'; lg.fillRect(0, 0, 512, 128);
      lg.fillStyle = '#f2ece0'; lg.font = '40px "Lilita One", sans-serif'; lg.textAlign = 'center';
      lg.fillText('MEASURE TWICE', 256, 56); lg.font = '28px Rubik, sans-serif'; lg.fillText('cut once · drink coffee', 256, 98);
      K.mesh(new T.CylinderGeometry(4.52, 4.52, 5, 48, 1, true, -PI * 0.15, PI), K.ceramic(0xffffff, { map: TX.toTexture(lc, { wrap: false }), roughness: 0.22 }), cx, 5.6, cz);
      K.mesh(new T.TorusGeometry(2.5, 0.65, 12, 24, PI * 1.2), mugMat, cx + 4.6, 5.3, cz, { rz: -PI * 0.6 });
      K.mesh(new T.CircleGeometry(3.95, 36), K.liquid(0x2a160a, { roughness: 0.04 }), cx, 8.3, cz, { rx: -PI / 2 });
      K.mesh(new T.RingGeometry(3.3, 3.95, 36), K.liquid(0x7a4a28, { roughness: 0.2 }), cx, 8.31, cz, { rx: -PI / 2 });
      K.circle(cx, cz, 4.6, 10); K.circle(cx + 6.5, cz, 1.5, 8);
      AO(cx, cz, 5.6, 5.6, 0.55);
      decal(0, cx + 10, cz - 9, 10, 10, 0.3); decal(0, cx - 7, cz + 11, 10, 10, 2.1, { alpha: 0.7 }); decal(0, cx + 3, cz + 15, 9.6, 9.6, 4, { alpha: 0.5 });
    }

    // ---------------------------------------------------------------- claw hammer lying in the west infield + nails
    {
      const hx = -100, hz = 30, ha = -0.25;
      const h = makeHammer();
      h.position.set(hx, 1.45, hz); h.rotation.y = -ha;
      K.add(h);
      const [ex, ez] = local(hx, hz, ha, 30, 0);
      K.capsule(hx, hz, ex, ez, 1.6, 3);
      K.capsule(...local(hx, hz, ha, 0, -6), ...local(hx, hz, ha, 0, 6), 1.9, 3);
      AO((hx + ex) / 2, (hz + ez) / 2, 16, 2.2, 0.4, ha);
      AO(hx, hz, 2.6, 7.5, 0.45, ha);
      for (let i = 0; i < 16; i++) nails.push({ x: hx + r.range(-10, 22), z: hz + r.range(-14, 4), ry: r() * 6.28 });
      decal(9, hx + 12, hz - 8, 12, 12, 0.5, { alpha: 0.8 });
    }

    // ---------------------------------------------------------------- wood offcut stack (west infield)
    const offcut = (x, y, z, ry, len, w = 8.9, h = 3.8, rz = 0) => {
      const g = new T.Group();
      const b = new T.Mesh(new K.RoundedBoxGeometry(len, h, w, 2, 0.3), pineMat); g.add(b);
      for (const s of [-1, 1]) { const e = new T.Mesh(new T.PlaneGeometry(w - 0.4, h - 0.4), endGrain); e.rotation.y = s * PI / 2; e.position.x = s * (len / 2 + 0.01); g.add(e); }
      g.position.set(x, y + h / 2, z); g.rotation.y = -ry; g.rotation.z = rz;
      return K.add(g);
    };
    {
      const cx = -52, cz = 34;
      offcut(cx, 0, cz, 0.1, 30); offcut(cx + 1, 0, cz + 10, 0.05, 26);
      offcut(cx + 2, 3.8, cz + 5, 1.5, 22);
      offcut(cx - 3, 7.6, cz + 4, 0.2, 18, 8.9, 3.8);
      K.box(cx, cz + 5, 16, 10, 0.08, 11.4);
      AO(cx, cz + 5, 18, 12, 0.5, 0.08);
      // a fresh plank leaning against it? no: a short plank lying alone
      offcut(cx - 22, 0, cz - 20, -0.6, 40, 14, 1.9);
      K.capsule(...local(cx - 22, cz - 20, -0.6, -20, 0), ...local(cx - 22, cz - 20, -0.6, 20, 0), 7, 1.9);
      AO(cx - 22, cz - 20, 21, 7.5, 0.4, -0.6);
      decal(4, cx - 22, cz - 20, 10, 10, -0.6, { y: 1.93, alpha: 0.9 });
    }

    // ---------------------------------------------------------------- spirit level (west infield, along the start straight)
    {
      const cx = -100, cz = 54, ang = 0.03;
      const c = TX.makeCanvas(1024, 128);
      const g = c.getContext('2d');
      // milled aluminium with a red printed band
      const al = g.createLinearGradient(0, 0, 0, 128); al.addColorStop(0, '#d9dde1'); al.addColorStop(0.5, '#c4c9ce'); al.addColorStop(1, '#d4d8dc');
      g.fillStyle = al; g.fillRect(0, 0, 1024, 128);
      const lr = K.rng(21); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${lr() < 0.5 ? '255,255,255' : '90,95,100'},0.12)`; g.fillRect(0, lr() * 128, 1024, 1); }
      g.fillStyle = '#c4281e'; g.fillRect(200, 30, 300, 68); g.fillRect(572, 30, 250, 68);
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 0, 1024, 8); g.fillRect(0, 120, 1024, 8);
      for (const vx of [140, 512, 884]) {
        g.fillStyle = '#20262a'; g.fillRect(vx - 60, 26, 120, 76);
        const gr = g.createLinearGradient(0, 40, 0, 88); gr.addColorStop(0, '#d8f26a'); gr.addColorStop(1, '#8ccf2a');
        g.fillStyle = gr; g.beginPath(); g.roundRect(vx - 50, 44, 100, 40, 20); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(vx + 8, 60, 14, 9, 0, 0, 6.28); g.fill();
        g.fillStyle = '#20262a'; g.fillRect(vx - 22, 44, 3, 40); g.fillRect(vx + 19, 44, 3, 40);
      }
      g.fillStyle = '#f4f1e8'; g.font = '700 34px Rubik, sans-serif'; g.fillText('PRO-LEVEL', 262, 77); g.fillText('600 mm', 640, 77);
      const top = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.38, metalness: 0.45 });
      const side = K.std({ color: 0xbfc4c9, roughness: 0.35, metalness: 0.6 });
      const lv = new T.Mesh(new T.BoxGeometry(60, 2.4, 6), [side, side, top, side, side, side]);
      lv.position.set(cx, 1.2, cz); lv.rotation.y = -ang; K.add(lv);
      for (const s of [-1, 1]) K.mesh(new K.RoundedBoxGeometry(2.2, 2.6, 6.2, 2, 0.5), blackRubber, cx + s * 30 * Math.cos(ang), 1.3, cz + s * 30 * Math.sin(ang), { ry: -ang });
      K.box(cx, cz, 31, 3.1, ang, 2.6);
      AO(cx, cz, 32, 4, 0.45, ang);
      warnRoad('level', cx, cz + 3, 0);
    }

    // ---------------------------------------------------------------- socket set (north-centre infield)
    {
      const cx = -18, cz = -38, ang = 0.08;
      const g = new T.Group();
      const shellMat = K.plastic(0x1e2125, 0.45);
      const base = new T.Mesh(new K.RoundedBoxGeometry(34, 4, 19, 3, 1.2), shellMat); base.position.y = 2; g.add(base);
      const tray = new T.Mesh(new T.BoxGeometry(32, 0.4, 17), K.plastic(0xc8302a, 0.5)); tray.position.y = 4.0; g.add(tray);
      // lid opened flat behind (north), inside facing up
      const lid = new T.Mesh(new K.RoundedBoxGeometry(34, 2.2, 19, 3, 1.0), shellMat); lid.position.set(0, 1.1, -19.4); g.add(lid);
      const lidIn = new T.Mesh(new T.BoxGeometry(32, 0.3, 17), K.plastic(0xc8302a, 0.5)); lidIn.position.set(0, 2.25, -19.4); g.add(lidIn);
      const lc = TX.makeCanvas(512, 128); const lg = lc.getContext('2d');
      lg.fillStyle = '#f4f1e8'; lg.fillRect(0, 0, 512, 128); lg.fillStyle = '#c8302a'; lg.fillRect(0, 0, 512, 30);
      lg.fillStyle = '#fff'; lg.font = '700 22px Rubik, sans-serif'; lg.fillText('DRIVE-RIGHT  ·  40 PC SOCKET SET', 16, 23);
      lg.fillStyle = '#222'; lg.font = '700 40px Rubik, sans-serif'; lg.fillText('1/4"  &  1/2"  DR', 20, 84); lg.font = '20px Rubik, sans-serif'; lg.fillText('chrome vanadium · metric', 20, 114);
      const sticker = new T.Mesh(new T.PlaneGeometry(16, 4), K.std({ map: TX.toTexture(lc, { wrap: false }), roughness: 0.5 })); sticker.rotation.x = -PI / 2; sticker.position.set(-6, 2.42, -16); g.add(sticker);
      // ratchet + extension in the lid
      const ratchet = new T.Group();
      const rh = new T.Mesh(new K.RoundedBoxGeometry(15, 1.0, 1.9, 2, 0.4), chrome); rh.position.x = 7.5; ratchet.add(rh);
      const rhead = new T.Mesh(new T.CylinderGeometry(1.9, 1.9, 1.5, 24), chrome); ratchet.add(rhead);
      const rgrip = new T.Mesh(new K.RoundedBoxGeometry(8, 1.4, 2.2, 2, 0.6), blackRubber); rgrip.position.x = 11; ratchet.add(rgrip);
      ratchet.position.set(-4, 3.2, -21); ratchet.rotation.y = 0.1; g.add(ratchet);
      const ext = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 12, 10).rotateZ(PI / 2), chrome); ext.position.set(4, 2.9, -14.5); g.add(ext);
      g.position.set(cx, 0, cz); g.rotation.y = -ang; K.add(g);
      // sockets standing in two rows (instanced, in world space)
      const socks = [], holes = [];
      for (let row = 0; row < 2; row++) for (let i = 0; i < 10; i++) {
        if (row === 1 && (i === 3 || i === 7)) continue; // two missing: they are on the bench
        const rad = 0.75 + i * 0.075 + row * 0.25, hh = 2.6 + i * 0.1 + row * 1.2;
        const [x, z] = local(cx, cz, ang, -14 + i * 3.1, -3.5 + row * 6.5);
        socks.push({ x, y: 4.1, z, sx: rad, sy: hh, sz: rad });
        holes.push({ x, y: 4.12 + hh, z, s: rad * 0.72, ry: r() });
      }
      const sockG = new T.CylinderGeometry(1, 1, 1, 18); sockG.translate(0, 0.5, 0);
      K.instances(sockG, chrome, socks);
      const hexG = new T.CircleGeometry(1, 6); hexG.rotateX(-PI / 2);
      K.instances(hexG, K.std({ color: 0x15161a, roughness: 0.6 }), holes, { cast: false });
      K.box(cx, cz - 9.7, 17.3, 19.3, ang, 4.2);
      AO(cx, cz - 9.7, 19, 21, 0.45, ang);
      // loose sockets on the bench
      for (const [x, z, rad] of [[cx + 22, cz + 6, 1.3], [cx + 26, cz - 3, 1.05]]) {
        K.mesh(new T.CylinderGeometry(rad, rad, rad * 2.6, 18).rotateZ(PI / 2), chrome, x, rad, z, { ry: r() * 3 });
        AO(x, z, rad * 2, rad * 1.4, 0.45);
      }
      // screwdrivers beside it
      lyingScrewdriver(cx - 10, cz + 18, 0.15, 0xd63a2c, 13, true);
      lyingScrewdriver(cx + 4, cz + 15, -0.3, 0x2f6fd6, 10, false);
      // a combination wrench lying flat
      K.mesh(wrenchGeo, chrome, cx + 22, 0.35, cz + 15, { rx: -PI / 2, rz: 1.2, scale: 0.95 });
      AO(cx + 22, cz + 15, 10, 2, 0.35, 1.2 - PI / 2);
    }

    // ---------------------------------------------------------------- cordless drill lying on its side (north-centre infield)
    {
      const cx = 62, cz = -45, ang = 0.35;
      const teal = K.plastic(0x13827a, 0.38);
      const g = new T.Group();
      // upright local frame: chuck towards -x, handle down -y; then laid on its +z side
      const body = new T.Mesh(new T.CapsuleGeometry(3.6, 12, 6, 20).rotateZ(PI / 2), teal); body.position.set(1, 0, 0); g.add(body);
      const rear = new T.Mesh(new T.CylinderGeometry(3.2, 3.2, 1.2, 24).rotateZ(PI / 2), blackRubber); rear.position.set(8.6, 0, 0); g.add(rear);
      const collar = new T.Mesh(new T.CylinderGeometry(2.8, 3.3, 2.4, 24).rotateZ(PI / 2), blackRubber); collar.position.set(-6.8, 0, 0); g.add(collar);
      const chuck = new T.Mesh(K.lathe([[0.6, 0], [2.3, 0], [2.4, 3.2], [1.5, 5.2], [0.6, 5.4]], 20).rotateZ(PI / 2), K.std({ color: 0x232325, roughness: 0.5, metalness: 0.4 })); chuck.position.set(-8, 0, 0); g.add(chuck);
      const bitTex = (() => { const c = TX.paint(16, 64, (x, y, u, v, o) => { const k = (y + x * 2) % 12 < 5 ? 0.45 : 1; o[0] = o[1] = o[2] = 190 * k; }); return TX.toTexture(c, { repeat: [1, 3] }); })();
      const bit = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 9, 10).rotateZ(PI / 2), K.metal(0xc0c4ca, 0.25, { map: bitTex })); bit.position.set(-17.5, 0, 0); g.add(bit);
      const handle = new T.Mesh(new K.RoundedBoxGeometry(4.2, 12, 4.6, 3, 1.4), blackRubber); handle.position.set(2.2, -7.5, 0); handle.rotation.z = -0.12; g.add(handle);
      const trig = new T.Mesh(new K.RoundedBoxGeometry(1.2, 2.8, 1.8, 2, 0.4), K.plastic(0x13827a, 0.3)); trig.position.set(-0.6, -4.6, 0); g.add(trig);
      const batt = new T.Mesh(new K.RoundedBoxGeometry(10, 5, 7.6, 3, 1.2), blackRubber); batt.position.set(3.5, -15.5, 0); g.add(batt);
      const bstripe = new T.Mesh(new T.BoxGeometry(10.1, 1.2, 7.7), teal); bstripe.position.set(3.5, -14.2, 0); g.add(bstripe);
      const lc = TX.makeCanvas(256, 64); const lg = lc.getContext('2d');
      lg.fillStyle = '#13827a'; lg.fillRect(0, 0, 256, 64); lg.fillStyle = '#fff'; lg.font = '700 34px "Lilita One", sans-serif'; lg.fillText('TORQ-X  18V', 20, 46);
      const lab = new T.Mesh(new T.PlaneGeometry(9, 2.2), K.std({ map: TX.toTexture(lc, { wrap: false }), roughness: 0.4 })); lab.position.set(1.4, 0, 3.62); g.add(lab);
      g.rotation.x = -PI / 2; // lay it on its -z side: handle points to +z (south)
      g.position.y = 3.85;
      const holder = new T.Group(); holder.add(g); holder.position.set(cx, 0, cz); holder.rotation.y = -ang; K.add(holder);
      const p0 = local(cx, cz, ang, -20, 0), p1 = local(cx, cz, ang, 9, 0);
      K.capsule(p0[0], p0[1], p1[0], p1[1], 3.4, 7.5);
      const ph = local(cx, cz, ang, 3, 12);
      K.capsule(...local(cx, cz, ang, 2, 2), ph[0], ph[1], 3.8, 7.5);
      AO(...local(cx, cz, ang, -4, 0), 14, 4.5, 0.5, ang);
      AO(ph[0], ph[1], 6, 6, 0.5, ang);
      // spare battery and a bit case
      K.mesh(new K.RoundedBoxGeometry(10, 5, 7.6, 3, 1.2), blackRubber, cx + 24, 2.5, cz - 8, { ry: 0.9 });
      K.circle(cx + 24, cz - 8, 5.5, 5);
      AO(cx + 24, cz - 8, 7, 6, 0.5, -0.9);
      const bc = new T.Group();
      bc.add(new T.Mesh(new K.RoundedBoxGeometry(13, 2.2, 7, 2, 0.6), K.plastic(0x2a2d31, 0.4)));
      const bits = [];
      for (let i = 0; i < 10; i++) bits.push({ x: -5.4 + i * 1.2, y: 1.3, z: 0, rx: PI / 2, sy: 1 });
      const bitsG = new T.CylinderGeometry(0.28, 0.28, 5, 6);
      const bm = new T.InstancedMesh(bitsG, K.metal(0xc9a24a, 0.3), bits.length);
      const m4 = new T.Matrix4();
      bits.forEach((b, i) => { m4.makeRotationX(PI / 2); m4.setPosition(b.x, b.y, b.z); bm.setMatrixAt(i, m4); });
      bc.add(bm);
      bc.position.set(cx - 12, 1.1, cz + 20); bc.rotation.y = -0.2; K.add(bc);
      K.box(cx - 12, cz + 20, 6.5, 3.5, 0.2, 2.2);
      AO(cx - 12, cz + 20, 8, 4.5, 0.45, 0.2);
    }

    // ---------------------------------------------------------------- oil can tipped over + oil slick at the north-east corner
    {
      const sO = 612;
      const oilMat = (K.phys({ color: 0x3a2208, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.9, iridescence: 0.7, iridescenceIOR: 1.35, iridescenceThicknessRange: [200, 600] }));
      const sp = track.place(sO, 3.6);
      const spill = K.spill(sp.x, sp.z, 6.2, oilMat, { lump: 0.32, stretch: 1.5, angle: sp.angle + 0.3, y: 0.12, thick: 0.08 });
      K.surface('slick', { poly: spill.poly });
      spill.mesh.castShadow = false;
      {
        // dark soaked rim and a thin-film rainbow sheen on top
        let mx = 0, mz = 0; for (const [x, z] of spill.poly) { mx += x; mz += z; } mx /= spill.poly.length; mz /= spill.poly.length;
        const grow = (d) => spill.poly.map(([x, z]) => { const dx = x - mx, dz = z - mz, l = Math.hypot(dx, dz) || 1; return [x + dx / l * d, z + dz / l * d]; });
        const rimM = K.flatShape(grow(1.8), new T.MeshBasicMaterial({ color: 0x24140a, transparent: true, opacity: 0.32, depthWrite: false }), 0.075);
        K.flatShape(grow(0.7), new T.MeshBasicMaterial({ color: 0x1c1006, transparent: true, opacity: 0.35, depthWrite: false }), 0.08).renderOrder = 1;
        rimM.renderOrder = 1;
        const fc = TX.makeCanvas(256); const fg = fc.getContext('2d');
        for (let i = 0; i < 26; i++) {
          const cx = 128 + (r() - 0.5) * 120, cz = 128 + (r() - 0.5) * 120, rad = 20 + r() * 70;
          for (let k = 0; k < 6; k++) { fg.strokeStyle = `hsla(${(k * 60 + r() * 40) % 360},70%,65%,${0.05 + r() * 0.06})`; fg.lineWidth = 2 + r() * 4; fg.beginPath(); fg.ellipse(cx, cz, rad + k * 5, (rad + k * 5) * (0.5 + r() * 0.4), r() * 3, 0, 6.28); fg.stroke(); }
        }
        const film = K.flatShape(grow(-0.6), new T.MeshBasicMaterial({ map: TX.toTexture(fc, { repeat: [0.08, 0.08] }), transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending }), 0.215);
        film.renderOrder = 2;
      }
      const cp = track.place(sO + 6, 27);
      const ang = Math.atan2(sp.z - cp.z, sp.x - cp.x);
      const can = new T.Group();
      const body = new T.Mesh(K.lathe([[0.001, 0], [5.0, 0], [5.2, 0.3], [5.2, 5.2], [4.9, 5.8], [2.6, 7.9], [1.3, 9.0], [1.0, 9.8], [0.001, 9.8]], 32), K.phys({ color: 0xb3241c, roughness: 0.3, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
      can.add(body);
      const band = new T.Mesh(new T.TorusGeometry(5.3, 0.3, 6, 32), brass); band.rotation.x = PI / 2; band.position.y = 0.3; can.add(band);
      { const oc = TX.makeCanvas(256, 32); const og = oc.getContext('2d'); og.fillStyle = '#f2e6c8'; og.fillRect(0, 0, 256, 32); og.fillStyle = '#7a1410'; og.font = '700 15px Rubik, sans-serif'; og.fillText('MACHINE OIL · SAE 20  ·  MACHINE OIL · SAE 20', 4, 21);
        const lab = new T.Mesh(new T.CylinderGeometry(5.24, 5.24, 3.2, 32, 1, true), K.std({ map: TX.toTexture(oc, { wrap: false }), roughness: 0.5 })); lab.position.y = 2.6; can.add(lab); }
      const spout = new T.Mesh(new T.CylinderGeometry(0.22, 0.5, 11, 10), brass); spout.position.set(0, 15.2, 0); can.add(spout);
      const pump = new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 1.2, 14), brass); pump.position.set(-2.6, 7.2, 0); pump.rotation.z = 0.8; can.add(pump);
      const canBot = new T.Mesh(new T.CircleGeometry(5.0, 32), steel); canBot.rotation.x = PI / 2; canBot.position.y = -0.03; can.add(canBot);
      can.rotation.z = -PI / 2; can.position.y = 5.2;
      const holder = new T.Group(); holder.add(can); holder.position.set(cp.x, 0, cp.z); holder.rotation.y = -ang; K.add(holder);
      K.capsule(cp.x, cp.z, cp.x + Math.cos(ang) * 7, cp.z + Math.sin(ang) * 7, 5.2, 10.4);
      AO(cp.x + Math.cos(ang) * 3.5, cp.z + Math.sin(ang) * 3.5, 6, 5, 0.5, ang);
      warnRoad('oil can spout', cp.x + Math.cos(ang) * 20, cp.z + Math.sin(ang) * 20, 0);
      // trail of oil from the spout to the slick
      const tip = [cp.x + Math.cos(ang) * 20, cp.z + Math.sin(ang) * 20];
      for (let i = 0; i < 4; i++) { const t = i / 4; K.spill(tip[0] + (sp.x - tip[0]) * t * 0.8, tip[1] + (sp.z - tip[1]) * t * 0.8, 1.2 + t * 1.5, oilMat, { y: 0.1, thick: 0.06, n: 18 }).mesh.castShadow = false; }
      // a red shop rag
      const rg = new T.PlaneGeometry(18, 16, 36, 32);
      rg.rotateX(-PI / 2);
      const p = rg.attributes.position;
      const ridges = []; for (let i = 0; i < 7; i++) ridges.push([r() * 6.28, r.range(0.25, 0.7), r() * 6.28, r.range(0.5, 1.6)]);
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), z = p.getZ(i);
        let h = 0.25;
        for (const [a, f, ph, amp] of ridges) h += Math.pow(Math.max(0, Math.sin((x * Math.cos(a) + z * Math.sin(a)) * f + ph)), 1.6) * amp * 1.1;
        const d = Math.hypot(x / 9, z / 8);
        h *= Math.max(0.15, 1.15 - d * 0.75);
        // gathered towards the middle: pull vertices in where the cloth bunches up
        const pull = 0.25 * Math.max(0, 1 - d);
        p.setXYZ(i, x * (1 - pull), h, z * (1 - pull));
      }
      rg.computeVertexNormals();
      const ragC = TX.makeCanvas(256);
      const rgc = ragC.getContext('2d');
      rgc.fillStyle = '#b8302a'; rgc.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 3) { rgc.fillStyle = 'rgba(80,10,8,0.18)'; rgc.fillRect(0, y, 256, 1); }
      for (let x = 0; x < 256; x += 3) { rgc.fillStyle = 'rgba(255,200,190,0.08)'; rgc.fillRect(x, 0, 1, 256); }
      for (let i = 0; i < 9; i++) { const gr = rgc.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, 'rgba(25,12,5,0.55)'); gr.addColorStop(1, 'rgba(25,12,5,0)'); rgc.save(); rgc.translate(r() * 256, r() * 256); rgc.scale(1 + r(), 0.6 + r() * 0.6); rgc.fillStyle = gr; rgc.beginPath(); rgc.arc(0, 0, 30, 0, 6.28); rgc.fill(); rgc.restore(); }
      // frayed, irregular outline in alpha
      const ac = TX.makeCanvas(128); const agc = ac.getContext('2d');
      agc.fillStyle = '#000'; agc.fillRect(0, 0, 128, 128); agc.fillStyle = '#fff'; agc.beginPath();
      for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.283; const rad = 52 + Math.sin(a * 3 + 1) * 6 + Math.sin(a * 7) * 3 + r() * 3; const x = 64 + Math.cos(a) * rad * 1.08, y = 64 + Math.sin(a) * rad; if (i) agc.lineTo(x, y); else agc.moveTo(x, y); }
      agc.fill();
      K.mesh(rg, K.std({ map: TX.toTexture(ragC), alphaMap: TX.toTexture(ac, { wrap: false, srgb: false }), alphaTest: 0.5, roughness: 0.95, side: T.DoubleSide }), cp.x + 6, 0, cp.z + 12, { ry: 0.7 });
      AO(cp.x + 6, cp.z + 12, 9, 8, 0.35, -0.7);
      K.circle(cp.x + 6, cp.z + 12, 6.5, 1.8);
      // old oil stains around
      for (let i = 0; i < 4; i++) decal(1, cp.x + r.range(-6, 12), cp.z + r.range(-4, 10), r.range(4, 9), r.range(3, 7), r() * 3, { color: 0x140c04, alpha: 0.75 });
    }

    // ---------------------------------------------------------------- hand saw + cut board + sawdust heap (slow) on the inner straight
    {
      const sS = 895;
      const hp = track.place(sS, 2.5);
      // board on the south side with a fresh cut, the sawn-off piece beside it
      const bp = track.place(sS + 2, 17);
      offcut(bp.x - 8, 0, bp.z, 0.05, 30, 8.9, 3.8);
      offcut(bp.x + 14, 0, bp.z + 2, -0.15, 9, 8.9, 3.8);
      K.box(bp.x - 8, bp.z, 15, 4.5, 0.05, 3.8); K.box(bp.x + 14, bp.z + 2, 4.5, 4.5, -0.15, 3.8);
      AO(bp.x - 8, bp.z, 16.5, 5.5, 0.45, 0.05); AO(bp.x + 14, bp.z + 2, 5.5, 5.5, 0.45, -0.15);
      decal(5, bp.x - 2, bp.z, 8, 8, 0.05 + PI / 2, { y: 3.83, alpha: 0.9 });
      // the sawdust heap: a soft mound across the road
      const heapTex = TX.mottledTextures({ size: 256, a: 0xead0a0, b: 0xd6b07a, c: 0xf6e4c0, seed: 88, period: 16, speck: 0.45, bump: 4 });
      const heapMat = K.std({ map: heapTex.map, normalMap: heapTex.normalMap, normalScale: V2(1.1), roughness: 1, vertexColors: true });
      // a lumpy mound of sawdust: shaded darker where it thins out at the base
      const segs = 56, rings = 14, pos = [], uv = [], idx = [], vc = [];
      const lo = new T.Color(0xb48a55), hi = new T.Color(0xffffff), cc = new T.Color();
      for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) {
        const t = i / rings, a = (j / segs) * PI * 2;
        const edge = 1 + 0.18 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 7) + 0.05 * Math.sin(a * 13 + 2);
        const lump = 1 + 0.14 * Math.sin(a * 5 + t * 9) + 0.08 * Math.sin(a * 11 - t * 13);
        const rad = t * 7.4 * edge, hh = 1.45 * Math.pow(1 - t * t, 1.5) * lump + 0.04;
        pos.push(Math.cos(a) * rad * 1.35, hh, Math.sin(a) * rad); uv.push(Math.cos(a) * rad / 3.5, Math.sin(a) * rad / 3.5);
        cc.copy(lo).lerp(hi, Math.min(1, 0.35 + hh / 1.2)); vc.push(cc.r, cc.g, cc.b);
      }
      for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const dome = new T.BufferGeometry();
      dome.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); dome.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); dome.setAttribute('color', new T.Float32BufferAttribute(vc, 3)); dome.setIndex(idx); dome.computeVertexNormals();
      K.mesh(dome, heapMat, hp.x, 0, hp.z, { ry: -hp.angle, cast: true });
      K.surface('slow', { x: hp.x, z: hp.z, r: 7.6 });
      // dusting around the heap and along the tyre tracks
      decal(11, hp.x, hp.z, 26, 18, hp.angle, { y: 0.07, color: 0xf0d8a8, alpha: 0.9 });
      for (let i = 0; i < 5; i++) { const q = track.place(sS - 9 - i * 6, r.range(-3, 3)); decal(11, q.x, q.z, 8, 3, q.angle, { y: 0.068, color: 0xf0d8a8, alpha: 0.65 }); }
      A.heap = hp;
      // the hand saw lying in the south bay
      const sx = 68, sz = 78, sa = PI + 0.26;
      const blade = new T.Shape();
      blade.moveTo(0, 0);
      const teeth = 120;
      for (let i = 0; i <= teeth; i++) { const x = i * 50 / teeth; blade.lineTo(x, (i % 2 ? 0.35 : 0) - (x / 50) * 0); }
      blade.lineTo(50, 0.35); blade.lineTo(50.6, 4.2); blade.quadraticCurveTo(25, 6.2, 0, 11.5); blade.closePath();
      const bgeo = new T.ExtrudeGeometry(blade, { depth: 0.12, bevelEnabled: false });
      bgeo.rotateX(-PI / 2);
      const bu = bgeo.attributes.uv, bpz = bgeo.attributes.position;
      for (let i = 0; i < bu.count; i++) bu.setXY(i, bpz.getX(i) / 50, -bpz.getZ(i) / 12);
      const etch = TX.makeCanvas(512, 128); const eg = etch.getContext('2d');
      eg.fillStyle = '#ffffff'; eg.fillRect(0, 0, 512, 128);
      eg.fillStyle = 'rgba(40,40,46,0.55)'; eg.font = 'italic 700 26px Georgia, serif'; eg.fillText('Fine Cut', 40, 70); eg.font = '16px Rubik, sans-serif'; eg.fillText('550 mm · 8 TPI · hardpoint', 40, 94);
      const sawMat = K.metal(0xd8dce2, 0.24, { map: TX.toTexture(etch, { wrap: false }), roughnessMap: brushed.roughnessMap });
      const saw = new T.Group();
      const bm = new T.Mesh(bgeo, sawMat); bm.position.y = 0.06; saw.add(bm);
      const hs = new T.Shape();
      hs.moveTo(-1, 0); hs.lineTo(3, 0); hs.lineTo(3, 12); hs.quadraticCurveTo(-4, 14, -10, 11); hs.quadraticCurveTo(-13, 6, -10, 1); hs.closePath();
      const hole = new T.Path(); hole.moveTo(-1.5, 3); hole.lineTo(-1.5, 9.5); hole.quadraticCurveTo(-6, 10.5, -8, 8.5); hole.quadraticCurveTo(-9, 5, -7.5, 3); hole.closePath(); hs.holes.push(hole);
      const hgeo = new T.ExtrudeGeometry(hs, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 2, curveSegments: 10 });
      hgeo.rotateX(-PI / 2);
      const hdl = new T.Mesh(hgeo, K.std({ map: pine.map, color: 0xb8743a, roughness: 0.35 })); hdl.position.y = 0.06; saw.add(hdl);
      for (const [x, z] of [[1.5, -2.5], [1.5, -9], [-1, -6]]) { const m = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.2, 12), brass); m.position.set(x, 2.95, z); saw.add(m); }
      saw.position.set(sx, 0, sz); saw.rotation.y = -sa;
      K.add(saw);
      K.capsule(...local(sx, sz, sa, -9, -7), ...local(sx, sz, sa, 1, -7), 6, 3);
      AO(...local(sx, sz, sa, 25, -4.5), 27, 6.5, 0.3, sa);
      AO(...local(sx, sz, sa, -5, -7), 9, 8.5, 0.45, sa);
      // carpenter's pencil
      const pg = new T.Group();
      const pb = new T.Mesh(new K.RoundedBoxGeometry(16, 0.75, 1.3, 2, 0.2), K.phys({ color: 0xd8401c, roughness: 0.35, clearcoat: 0.6 })); pg.add(pb);
      const pw = new T.Mesh(new T.BoxGeometry(2.2, 0.7, 1.25), K.std({ color: 0xe6c592, roughness: 0.8 })); pw.position.x = 9; pg.add(pw);
      const pl = new T.Mesh(new T.BoxGeometry(1.0, 0.25, 0.4), K.std({ color: 0x2a2a2e, roughness: 0.5 })); pl.position.x = 10.5; pg.add(pl);
      pg.position.set(sx - 30, 0.38, sz + 10); pg.rotation.y = 0.9; K.add(pg);
      AO(sx - 30, sz + 10, 9, 1.2, 0.4, -0.9);
      decal(13, sx - 34, sz - 4, 12, 12, 0.2, { alpha: 0.9 });
      decal(10, sx - 18, sz + 14, 12, 12, -0.1, { alpha: 0.85 });
      // sawdust specks and chips around the cut
      A.sawdustSpots = [[bp.x + 4, bp.z + 2, 9], [sx - 20, sz - 6, 14]];
    }

    // ---------------------------------------------------------------- the hole-saw hole (fall through!)
    {
      K.hole(HOLE.x, HOLE.z, HOLE.r);
      // pale freshly cut rim, burnt ring and sawdust
      decal(7, HOLE.x, HOLE.z, 13, 13, 0, { y: 0.03, alpha: 0.55 });
      K.mesh(new T.RingGeometry(HOLE.r, HOLE.r + 0.7, 48), K.std({ color: 0xead2a4, roughness: 0.9, transparent: true, opacity: 0.85, depthWrite: false }), HOLE.x, 0.04, HOLE.z, { rx: -PI / 2, cast: false });
      // dark inside so it reads as a deep hole
      K.mesh(new T.CylinderGeometry(HOLE.r - 0.05, HOLE.r - 0.05, 7.6, 40, 1, true), K.std({ color: 0x2b1a0c, roughness: 1, side: T.BackSide }), HOLE.x, -3.8, HOLE.z, { cast: false });
      // the slug that came out of it, lying beside
      const sp = [HOLE.x + 13, HOLE.z + 9];
      const st = BB.map.clone(); st.repeat.set(0.2, 0.2); st.needsUpdate = true;
      const slugTop = K.std({ map: st, roughness: 0.6 });
      const slug = new T.Mesh(new T.CylinderGeometry(HOLE.r - 0.3, HOLE.r - 0.3, 6.8, 36), [endGrain, slugTop, slugTop]);
      slug.rotation.z = PI / 2; slug.position.set(sp[0], HOLE.r - 0.3, sp[1]); slug.rotation.y = 0.6; K.add(slug);
      K.circle(sp[0], sp[1], 4.6, 8.6);
      AO(sp[0], sp[1], 5, 5, 0.5);
      // the hole saw itself
      const hsx = HOLE.x - 2, hsz = HOLE.z + 16;
      const cup = new T.Group();
      cup.add(new T.Mesh(K.lathe([[0.6, 0], [4.6, 0], [4.7, 0.3], [4.7, 4.4], [4.4, 4.4], [4.4, 0.6], [0.6, 0.6]], 36), K.metal(0x3a3d42, 0.4)));
      const tg = []; for (let i = 0; i < 26; i++) { const a = i / 26 * PI * 2; tg.push({ x: Math.cos(a) * 4.55, y: 4.7, z: Math.sin(a) * 4.55, ry: -a }); }
      const teethM = new T.InstancedMesh(new T.ConeGeometry(0.32, 0.8, 4), K.metal(0xd8b24a, 0.3), tg.length);
      const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), one = new T.Vector3(1, 1, 1);
      tg.forEach((t, i) => { e.set(0, t.ry, 0); q.setFromEuler(e); m4.compose(new T.Vector3(t.x, t.y, t.z), q, one); teethM.setMatrixAt(i, m4); });
      cup.add(teethM);
      const arbor = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 7, 6), steel); arbor.position.y = -3.5; cup.add(arbor);
      const pilot = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 8, 8), K.metal(0x2a2a2e, 0.3)); pilot.position.y = 3; cup.add(pilot);
      cup.rotation.x = PI / 2; cup.position.set(hsx, 4.7, hsz); cup.rotation.z = 0.4;
      K.add(cup);
      K.circle(hsx, hsz, 5, 9.4);
      AO(hsx, hsz, 6, 6, 0.5);
      warnRoad('hole', HOLE.x, HOLE.z, HOLE.r - 0.2);
    }

    // ---------------------------------------------------------------- SE pocket: block plane + curly shavings, glue bottle, sanding block
    const shavingGeo = (() => {
      // a thin ribbon of wood wound into a loose helix lying on its side (reads as a curl from above)
      const segA = 34, segW = 2, pos = [], idx = [], col = [];
      const turns = 1.35, len = 2.6, wid = 0.75;
      const c1 = new T.Color(0xf3ddb0), c2 = new T.Color(0xc99a62);
      for (let i = 0; i <= segA; i++) {
        const t = i / segA, th = t * turns * PI * 2, R = 1.15 - t * 0.55;
        for (let j = 0; j <= segW; j++) {
          const w = (j / segW - 0.5) * wid;
          pos.push(t * len + w * 0.35, R + R * Math.cos(th) * 0.9, R * Math.sin(th) + w);
          const c = j === 1 ? c1 : c2; col.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < segA; i++) for (let j = 0; j < segW; j++) { const a = i * (segW + 1) + j, b = a + segW + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      g.translate(-len / 2, 0, 0);
      return g;
    })();
    const shavings = [];
    {
      const cx = 114, cz = 28;
      // block plane
      const g = new T.Group();
      const bodyM = K.metal(0x2d3440, 0.35);
      const sole = new T.Mesh(new K.RoundedBoxGeometry(16, 2.4, 5.2, 2, 0.4), bodyM); sole.position.y = 1.2; g.add(sole);
      for (const s of [-1, 1]) { const w = new T.Mesh(new T.BoxGeometry(14, 2.4, 0.4), bodyM); w.position.set(0, 3, s * 2.4); g.add(w); }
      const cap = new T.Mesh(new K.RoundedBoxGeometry(8, 1.2, 4.4, 2, 0.4), chrome); cap.position.set(1, 4.2, 0); cap.rotation.z = -0.35; g.add(cap);
      const knob = new T.Mesh(new T.SphereGeometry(1.6, 16, 12), K.std({ color: 0x7a3a1c, roughness: 0.4 })); knob.position.set(-5.5, 4.6, 0); knob.scale.y = 0.8; g.add(knob);
      const wheel = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 0.6, 16).rotateX(PI / 2), brass); wheel.position.set(5.6, 4, 0); g.add(wheel);
      g.position.set(cx, 0, cz); g.rotation.y = 0.6; K.add(g);
      K.box(cx, cz, 8, 2.8, -0.6, 4.5);
      AO(cx, cz, 9, 3.5, 0.55, -0.6);
      for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = 3 + Math.pow(r(), 0.7) * 12; shavings.push({ x: cx - 4 + Math.cos(a) * d * 1.3, y: 0, z: cz + 6 + Math.sin(a) * d * 0.8, ry: r() * 6.28, s: r.range(0.8, 1.5) }); }
      // the plank being planed
      offcut(cx - 4, 0, cz - 17, 0.6, 34, 9.5, 1.9);
      K.capsule(...local(cx - 4, cz - 17, 0.6, -17, 0), ...local(cx - 4, cz - 17, 0.6, 17, 0), 4.7, 1.9);
      AO(cx - 4, cz - 17, 18, 5.5, 0.4, 0.6);
      // wood glue bottle
      const gx = cx - 2, gz = cz + 22;
      const gb = new T.Group();
      gb.add(new T.Mesh(K.lathe([[0.001, 0], [3, 0], [3.2, 0.4], [3.2, 10], [2.4, 11.6], [1.2, 12.2], [0.001, 12.2]], 28), K.plastic(0xf4d24a, 0.35)));
      const gcap = new T.Mesh(K.lathe([[1.3, 0], [1.3, 1.6], [0.8, 3], [0.25, 4.2], [0.001, 4.2]], 18), K.plastic(0xe86a24, 0.3)); gcap.position.y = 12.1; gb.add(gcap);
      const glc = TX.makeCanvas(256, 96); const glg = glc.getContext('2d');
      glg.fillStyle = '#f4d24a'; glg.fillRect(0, 0, 256, 96); glg.fillStyle = '#7a3a12'; glg.fillRect(0, 0, 256, 18); glg.fillRect(0, 80, 256, 16);
      glg.fillStyle = '#5a2a0a'; glg.font = '700 30px "Lilita One", sans-serif'; glg.textAlign = 'center'; glg.fillText('WOOD GLUE', 128, 60);
      const gl = new T.Mesh(new T.CylinderGeometry(3.22, 3.22, 5.5, 28, 1, true), K.std({ map: TX.toTexture(glc, { wrap: false }), roughness: 0.4 })); gl.position.y = 5; gb.add(gl);
      gb.position.set(gx, 0, gz); K.add(gb);
      K.circle(gx, gz, 3.3, 12);
      AO(gx, gz, 4, 4, 0.55);
      decal(8, gx + 5, gz - 4, 6, 6, 0.4);
      // sanding block with sandpaper
      const sb = new T.Group();
      sb.add(new T.Mesh(new K.RoundedBoxGeometry(11, 3.6, 7, 2, 0.6), K.std({ roughness: 0.95, map: TX.mottledTextures({ size: 128, a: 0xc49a6a, b: 0xae845a, seed: 3, period: 8, speck: 0.25 }).map })));
      const paper = new T.Mesh(new T.BoxGeometry(11.6, 0.25, 7.4), A.roadMat); paper.position.y = -1.85; sb.add(paper);
      sb.position.set(cx + 14, 2.05, cz - 4); sb.rotation.y = -0.3; K.add(sb);
      K.box(cx + 14, cz - 4, 5.6, 3.6, 0.3, 4);
      AO(cx + 14, cz - 4, 7, 4.5, 0.5, 0.3);
      // torn sandpaper offcuts
      const scrapMat = K.std({ map: A.roadMat.map, normalMap: A.roadMat.normalMap, color: 0xf0b888, roughness: 0.95, side: T.DoubleSide });
      for (const [x, z, a] of [[cx - 12, cz + 19, 0.4]]) {
        // a torn quarter sheet: jagged edges
        const sh = new T.Shape(); const pts = [];
        for (let i = 0; i <= 8; i++) pts.push([-3.5 + i * 7 / 8, -2.5 + (i % 2 ? 0.25 : 0) * (i < 8 ? 1 : 0)]);
        for (let i = 1; i <= 6; i++) pts.push([3.5 - (i % 2 ? 0.3 : 0), -2.5 + i * 5 / 6]);
        for (let i = 1; i <= 8; i++) pts.push([3.5 - i * 7 / 8, 2.5 - (i % 2 ? 0.3 : 0.05)]);
        pts.forEach(([px, py], k) => (k ? sh.lineTo(px, py) : sh.moveTo(px, py)));
        const sg = new T.ShapeGeometry(sh); const su = sg.attributes.uv, sp = sg.attributes.position; for (let k = 0; k < su.count; k++) su.setXY(k, sp.getX(k) / 14, sp.getY(k) / 14);
        const m = K.mesh(sg, scrapMat, x, 0.05, z, { rx: -PI / 2, cast: false }); m.rotation.z = a;
      }
    }

    // ---------------------------------------------------------------- F-clamp near the jump, C-clamp on the front edge
    {
      const fx = 6, fz = -60, fa = 0.25;
      const g = new T.Group();
      const red = K.metal(0xb52a22, 0.45, { metalness: 0.4 });
      const bar = new T.Mesh(new T.BoxGeometry(32, 0.6, 1.8), steel); bar.position.set(14, 0.3, 0); g.add(bar);
      const j1 = new T.Mesh(new K.RoundedBoxGeometry(2.4, 1.8, 10, 2, 0.4), red); j1.position.set(0, 0.9, 4.2); g.add(j1);
      const j2 = new T.Mesh(new K.RoundedBoxGeometry(3, 2, 10, 2, 0.4), red); j2.position.set(19, 1, 4.2); g.add(j2);
      const scr = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 9, 10).rotateZ(PI / 2), steel); scr.position.set(20, 1, 8.2); g.add(scr);
      const hdl = new T.Mesh(new T.CylinderGeometry(1.3, 1.1, 8, 14).rotateZ(PI / 2), K.std({ map: pine.map, color: 0xb87c42, roughness: 0.45 })); hdl.position.set(27, 1.3, 8.2); g.add(hdl);
      const pad = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 0.6, 14).rotateZ(PI / 2), darkSteel); pad.position.set(15.5, 1, 8.2); g.add(pad);
      g.position.set(fx, 0, fz); g.rotation.y = -fa; K.add(g);
      K.capsule(...local(fx, fz, fa, 0, 0), ...local(fx, fz, fa, 31, 0), 1.2, 2);
      K.capsule(...local(fx, fz, fa, 19, 4), ...local(fx, fz, fa, 31, 8), 1.6, 2.6);
      AO(...local(fx, fz, fa, 15, 3), 17, 6, 0.35, fa);
      // C-clamp holding a board to the front edge (west of the start line)
      const cx = -128, cz = B.maxZ - 5;
      offcut(cx, 0, cz - 2, 0.04, 34, 12, 1.9);
      const cg = new T.Group();
      const cs = new T.Shape();
      cs.moveTo(-1.6, 3.5); cs.lineTo(1.6, 3.5); cs.lineTo(1.6, -2); cs.quadraticCurveTo(1.6, -9, -3, -9.5); cs.lineTo(-5, -9.5); cs.lineTo(-5, -12); cs.lineTo(-3, -12); cs.quadraticCurveTo(4.5, -11.5, 4.5, -2); cs.lineTo(4.5, 5.5); cs.lineTo(-1.6, 5.5); cs.closePath();
      const cgeo = new T.ExtrudeGeometry(cs, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2, curveSegments: 10 });
      cgeo.translate(0, 0, -0.8);
      const cm = new T.Mesh(cgeo, K.metal(0xd5641e, 0.45, { metalness: 0.4 }));
      cg.add(cm);
      const cscr = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 7, 10), steel); cscr.position.set(-4, -9, 0); cg.add(cscr);
      const tbar = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 7, 8).rotateZ(PI / 2), steel); tbar.position.set(-4, -13, 0); cg.add(tbar);
      cg.rotation.y = -PI / 2; cg.position.set(cx + 6, 1.9 - 3.5, B.maxZ - 1.4);
      K.add(cg);
      K.circle(cx + 6, B.maxZ - 2, 2.6, 6);
      AO(cx, cz - 2, 18, 7, 0.4, 0.04);
    }

    // ---------------------------------------------------------------- retro radio at the north-east corner of the bench
    {
      const cx = 150, cz = -94;
      const g = new T.Group();
      const bodyM = K.plastic(0xd9cfb6, 0.4);
      const body = new T.Mesh(new K.RoundedBoxGeometry(28, 15, 9, 3, 2), bodyM); body.position.y = 7.5; g.add(body);
      const fc = TX.makeCanvas(512, 256); const fg = fc.getContext('2d');
      fg.fillStyle = '#d9cfb6'; fg.fillRect(0, 0, 512, 256);
      fg.fillStyle = '#8a2b22'; fg.beginPath(); fg.roundRect(18, 18, 220, 220, 28); fg.fill();
      fg.fillStyle = '#3a1410'; for (let y = 32; y < 228; y += 13) for (let x = 32; x < 228; x += 13) { fg.beginPath(); fg.arc(x + ((y / 13) % 2) * 6, y, 4, 0, 6.28); fg.fill(); }
      fg.fillStyle = '#f3ead2'; fg.fillRect(262, 34, 230, 70); fg.strokeStyle = '#6a5a40'; fg.lineWidth = 3; fg.strokeRect(262, 34, 230, 70);
      fg.fillStyle = '#3a3226'; fg.font = '15px Rubik, sans-serif';
      ['88', '92', '96', '100', '104', '108'].forEach((t, i) => { fg.fillText(t, 270 + i * 37, 92); fg.fillRect(278 + i * 37, 44, 2, 22); });
      fg.fillStyle = '#c4281e'; fg.fillRect(360, 40, 3, 60);
      fg.fillStyle = '#6a5a40'; fg.font = 'italic 700 30px Georgia, serif'; fg.fillText('Shopmate', 300, 150); fg.font = '16px Rubik, sans-serif'; fg.fillText('FM · AM · weatherproof', 290, 178);
      const face = new T.Mesh(new T.PlaneGeometry(26, 13), K.std({ map: TX.toTexture(fc, { wrap: false }), roughness: 0.45 })); face.position.set(0, 7.5, 4.52); g.add(face);
      for (const x of [5, 10]) { const k = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 1.6, 18).rotateX(PI / 2), K.plastic(0x2a2a2c, 0.4)); k.position.set(x, 2.6, 5); g.add(k); }
      const hdl = new T.Mesh(new T.TorusGeometry(9, 0.8, 8, 24, PI), K.plastic(0x2a2a2c, 0.45)); hdl.position.set(0, 15, 0); g.add(hdl);
      const ant = new T.Mesh(new T.CylinderGeometry(0.18, 0.3, 34, 8), chrome); ant.position.set(-10, 30, -2); ant.rotation.z = 0.35; ant.rotation.x = -0.2; g.add(ant);
      g.position.set(cx, 0, cz); g.rotation.y = -0.08; K.add(g);
      K.box(cx, cz, 14.5, 5, 0.08, 15);
      AO(cx, cz, 16, 6.5, 0.55, 0.08);
      // a plug strip and orange cord along the wall
      K.mesh(new K.RoundedBoxGeometry(26, 2.6, 5, 2, 0.8), K.plastic(0xf2f0ea, 0.4), 102, 1.3, -97.5, { ry: 0.02 });
      const pc = new T.CatmullRomCurve3([new T.Vector3(90, 0.6, -97), new T.Vector3(70, 0.6, -98.5), new T.Vector3(40, 0.6, -97.4), new T.Vector3(20, 0.6, -98.8), new T.Vector3(0, 0.6, -99.3), new T.Vector3(-20, 6, -100.6), new T.Vector3(-30, 30, -100.6)]);
      K.mesh(new T.TubeGeometry(pc, 80, 0.55, 8), K.plastic(0xff7a1a, 0.4), 0, 0, 0);
      AO(102, -97.5, 14, 3.5, 0.45);
    }

    // ---------------------------------------------------------------- pushable bits: tape roll, big nuts, washers, a spray-can cap
    {
      const nutGeo = (() => {
        const s = new T.Shape();
        for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + PI / 6; const x = Math.cos(a) * 1.85, y = Math.sin(a) * 1.85; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
        s.closePath();
        const h = new T.Path(); h.absarc(0, 0, 0.95, 0, PI * 2, true); s.holes.push(h);
        const g = new T.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1, curveSegments: 16 });
        g.rotateX(-PI / 2); g.translate(0, -0.75, 0);
        return g;
      })();
      const washerGeo = K.lathe([[1.0, 0], [2.3, 0], [2.4, 0.15], [2.3, 0.32], [1.0, 0.32]], 28); washerGeo.translate(0, -0.16, 0);
      const zinc = K.metal(0xc9ccd0, 0.3);
      const dyn = (geo, mat, s, off, opts) => {
        const p = typeof s === 'number' ? track.place(s, off) : { x: s[0], z: s[1] };
        const m = geo.isObject3D ? geo : new T.Mesh(geo, mat);
        m.position.set(p.x, opts.baseY, p.z); m.rotation.y = r() * 6;
        K.add(m);
        keep.push(m);
        K.physics.addDynamic({ x: p.x, z: p.z, ...opts, mesh: m });
        return m;
      };
      for (const [s, o] of [[455, 3], [470, -3.5], [326, 2], [852, -2.5], [148, 3]]) dyn(nutGeo, zinc, s, o, { r: 1.9, m: 0.5, h: 1.6, slide: true, friction: 16, baseY: 0.8 });
      for (const [s, o] of [[160, -3], [705, 2.5], [742, -3], [987, 2]]) dyn(washerGeo, zinc, s, o, { r: 2.4, m: 0.3, h: 0.4, slide: true, friction: 20, baseY: 0.18 });
      // roll of masking tape
      const roll = new T.Group();
      roll.add(new T.Mesh(K.lathe([[3.7, 0], [5.4, 0], [5.4, 3.4], [3.7, 3.4]], 40), K.std({ color: 0xe8d9b0, roughness: 0.8 })));
      roll.add(new T.Mesh(K.lathe([[3.45, 0], [3.75, 0], [3.75, 3.4], [3.45, 3.4]], 32), K.std({ color: 0x9a7a52, roughness: 0.9, side: T.DoubleSide })));
      roll.children.forEach((c) => (c.position.y = -1.7));
      dyn(roll, null, 676, -2.5, { r: 5.4, m: 1.4, h: 3.4, slide: true, friction: 12, baseY: 1.7 });
      // spray can cap
      const capG = K.lathe([[0.001, 0], [3.1, 0], [3.2, 3.6], [2.9, 3.8], [0.001, 3.8]], 28); capG.translate(0, -1.9, 0);
      dyn(capG, K.plastic(0xd8352a, 0.3), 768, 2.5, { r: 3.2, m: 0.4, h: 3.8, slide: true, friction: 14, baseY: 1.9 });
      // where the cap came from: a spray can lying beside the road
      const sc = track.place(782, 15);
      const spr = new T.Group();
      spr.add(new T.Mesh(K.lathe([[0.001, 0], [3.1, 0], [3.2, 0.5], [3.2, 15], [2.4, 17], [1.0, 17.6], [0.001, 17.6]], 28), K.metal(0xd8352a, 0.3)));
      const nz = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 1, 12), K.plastic(0xf2f2f2, 0.4)); nz.position.y = 18; spr.add(nz);
      const slc = TX.makeCanvas(256, 128); const slg = slc.getContext('2d');
      slg.fillStyle = '#d8352a'; slg.fillRect(0, 0, 256, 128); slg.fillStyle = '#fff'; slg.font = '700 34px "Lilita One", sans-serif'; slg.fillText('QUICK', 16, 50); slg.fillText('PRIMER', 16, 92);
      const sl = new T.Mesh(new T.CylinderGeometry(3.22, 3.22, 9, 28, 1, true), K.std({ map: TX.toTexture(slc, { wrap: false }), roughness: 0.35, metalness: 0.4 })); sl.position.y = 7; spr.add(sl);
      spr.rotation.z = PI / 2; spr.position.y = 3.2;
      const hsp = new T.Group(); hsp.add(spr); hsp.position.set(sc.x, 0, sc.z); hsp.rotation.y = -sc.angle + 0.5; K.add(hsp);
      const sa = sc.angle - 0.5 + PI;
      K.capsule(sc.x, sc.z, sc.x + Math.cos(sa) * 17, sc.z + Math.sin(sa) * 17, 3.3, 6.4);
      AO(sc.x + Math.cos(sa) * 8.5, sc.z + Math.sin(sa) * 8.5, 9.5, 3.6, 0.5, sa);
      decal(2, sc.x - 3, sc.z + 3, 5, 5, 0.3, { color: 0xb8302a, alpha: 0.6 });
    }


    // ---------------------------------------------------------------- more bench clutter: glasses, knife, tape rolls, pliers, a cut list
    {
      // safety glasses, folded, lying lens-up
      {
        const cx = 26, cz = -22, ang = 0.3;
        const g = new T.Group();
        const shield = new T.Shape();
        shield.moveTo(-7.5, -1.6); shield.quadraticCurveTo(-7.8, 2.4, -4.5, 2.6); shield.lineTo(4.5, 2.6); shield.quadraticCurveTo(7.8, 2.4, 7.5, -1.6);
        shield.quadraticCurveTo(6.5, -3.4, 3.2, -3.0); shield.quadraticCurveTo(1.2, -2.8, 0.8, -1.2); shield.quadraticCurveTo(0, -0.4, -0.8, -1.2);
        shield.quadraticCurveTo(-1.2, -2.8, -3.2, -3.0); shield.quadraticCurveTo(-6.5, -3.4, -7.5, -1.6);
        const lg = new T.ExtrudeGeometry(shield, { depth: 0.2, bevelEnabled: false, curveSegments: 10 }); lg.rotateX(-PI / 2);
        const lens = new T.Mesh(lg, K.glass(0xd8e8f8, 0.35)); lens.position.y = 1.5; lens.rotation.x = 0.12; g.add(lens);
        const brow = new T.Mesh(new K.RoundedBoxGeometry(15.4, 0.7, 1.0, 2, 0.3), K.plastic(0xf2c21b, 0.35)); brow.position.set(0, 1.75, -2.3); g.add(brow);
        for (const s2 of [-1, 1]) { const arm = new T.Mesh(new K.RoundedBoxGeometry(12.5, 0.5, 0.7, 2, 0.2), K.plastic(0xf2c21b, 0.35)); arm.position.set(s2 * 0.9, 0.6 + (s2 > 0 ? 0.55 : 0), -1.6 + s2 * 0.6); arm.rotation.y = s2 * 0.05; g.add(arm); }
        g.position.set(cx, 0, cz); g.rotation.y = -ang; K.add(g);
        AO(cx, cz - 0.5, 8.5, 3.5, 0.35, ang);
        K.box(cx, cz, 7.7, 3, ang, 2.2);
      }
      // utility knife on the front edge
      {
        const cx = -62, cz = 90, ang = 0.2;
        const g = new T.Group();
        const body = new T.Mesh(new K.RoundedBoxGeometry(15, 1.8, 2.6, 2, 0.6), K.plastic(0xf2c21b, 0.35)); body.position.y = 0.9; g.add(body);
        const grip = new T.Mesh(new K.RoundedBoxGeometry(8, 1.9, 2.7, 2, 0.6), blackRubber); grip.position.set(-2.5, 0.9, 0); g.add(grip);
        const bl = new T.Shape(); bl.moveTo(0, 0); bl.lineTo(3, 0); bl.lineTo(2.1, 1.3); bl.lineTo(0, 1.3); bl.closePath();
        const blade = new T.Mesh(new T.ExtrudeGeometry(bl, { depth: 0.08, bevelEnabled: false }), K.metal(0xdfe3e8, 0.15)); blade.rotation.x = -PI / 2; blade.position.set(7.4, 1.0, 0.6); g.add(blade);
        g.position.set(cx, 0, cz); g.rotation.y = -ang; K.add(g);
        AO(cx, cz, 9, 2, 0.45, ang);
        K.box(cx, cz, 8, 1.4, ang, 1.9);
      }
      // rolls of tape lying flat: duct tape and electrical tape
      const roll = (x, z, ro, ri, h, col, coreCol) => {
        K.mesh(K.lathe([[ri + 0.25, 0], [ro, 0], [ro, h], [ri + 0.25, h]], 36), K.std({ color: col, roughness: 0.45, metalness: col === 0xb8bcc2 ? 0.5 : 0 }), x, 0, z);
        K.mesh(K.lathe([[ri, 0], [ri + 0.28, 0], [ri + 0.28, h], [ri, h]], 28), K.std({ color: coreCol, roughness: 0.9, side: T.DoubleSide }), x, 0, z);
        AO(x, z, ro + 1, ro + 1, 0.5);
        K.circle(x, z, ro, h);
      };
      roll(6, 88, 5.6, 3.8, 4.8, 0xb8bcc2, 0x9a7a52);
      roll(116, -90, 2.6, 1.6, 1.9, 0x18181a, 0xd8d0c0);
      roll(122, -88.5, 2.6, 1.6, 1.9, 0xc8302a, 0xd8d0c0);
      roll(-162, 92, 2.6, 1.6, 1.9, 0x2f6fd6, 0xd8d0c0);
      // slip-joint pliers by the vise
      {
        const cx = -58, cz = -95, ang = -0.15;
        const g = new T.Group();
        for (const s2 of [-1, 1]) {
          const arm = new T.Mesh(new K.RoundedBoxGeometry(12, 0.9, 1.4, 2, 0.4), K.plastic(0xc8302a, 0.4)); arm.position.set(-5, 0.6, s2 * 1.1); arm.rotation.y = s2 * 0.1; g.add(arm);
          const jaw = new T.Mesh(new K.RoundedBoxGeometry(5, 0.8, 1.1, 2, 0.3), darkSteel); jaw.position.set(3.4, 0.6, s2 * 0.35); jaw.rotation.y = -s2 * 0.08; g.add(jaw);
        }
        const piv = new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 1.3, 12), steel); piv.position.set(0.6, 0.65, 0); g.add(piv);
        g.position.set(cx, 0, cz); g.rotation.y = -ang; K.add(g);
        AO(cx - 2, cz, 9, 2.6, 0.45, ang);
        K.box(cx - 2, cz, 8.5, 2, ang, 1.3);
      }
      // a cut list on a sheet of paper, with the pencil stub on it
      {
        const cx = 98, cz = -18, ang = -0.18;
        const c = TX.makeCanvas(512, 724); const g = c.getContext('2d');
        g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, 512, 724);
        g.strokeStyle = 'rgba(110,150,210,0.45)'; g.lineWidth = 1.5;
        for (let y = 80; y < 724; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
        const pen = 'rgba(50,50,58,0.88)';
        g.fillStyle = pen; g.font = '700 38px Rubik, sans-serif'; g.fillText('CUT LIST', 30, 60);
        g.font = '30px Rubik, sans-serif';
        ['2 × side   600 × 300', '2 × shelf  560 × 280', '1 × top    620 × 320', '1 × back   600 × 560', '8 × dowel  Ø8 × 30', 'glue + 24 screws'].forEach((t, i) => g.fillText(t, 34, 140 + i * 60));
        g.strokeStyle = pen; g.lineWidth = 3; g.strokeRect(300, 520, 150, 150); g.beginPath(); g.moveTo(300, 595); g.lineTo(450, 595); g.stroke();
        g.fillText('600', 340, 700);
        g.strokeStyle = 'rgba(200,40,40,0.8)'; g.lineWidth = 4; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(14, 128 + i * 60); g.lineTo(24, 140 + i * 60); g.lineTo(40, 112 + i * 60); g.stroke(); }
        K.mesh(new T.PlaneGeometry(21, 29.7), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.9 }), cx, 0.05, cz, { rx: -PI / 2, cast: false }).rotation.z = ang;
        AO(cx, cz, 11.5, 15.5, 0.14, -ang);
        const pg = new T.Group();
        pg.add(new T.Mesh(new K.RoundedBoxGeometry(9, 0.75, 1.3, 2, 0.2), K.phys({ color: 0xd8401c, roughness: 0.35, clearcoat: 0.6 })));
        const pw = new T.Mesh(new T.BoxGeometry(2.2, 0.7, 1.25), K.std({ color: 0xe6c592, roughness: 0.8 })); pw.position.x = 5.6; pg.add(pw);
        pg.position.set(cx + 3, 0.45, cz + 6); pg.rotation.y = 1.1; K.add(pg);
        warnRoad('cut list', cx, cz, 16);
      }
    }

    // ---------------------------------------------------------------- NW corner: a jar of mixed screws and a bench brush
    {
      const jx = -160, jz = -91;
      const jarG = K.lathe([[0.001, 0], [4.6, 0], [4.9, 0.5], [4.9, 10.2], [4.2, 11.2], [4.0, 11.4], [4.0, 12.6], [3.7, 12.6], [3.7, 11.5], [4.5, 10.4], [4.5, 0.6], [0.001, 0.5]], 40);
      K.mesh(jarG, K.glass(0xeef4ee, 0.22), jx, 0, jz, { cast: false });
      const mix = TX.mottledTextures({ size: 128, a: 0x8c9096, b: 0x5d6168, c: 0xc6a560, seed: 9, period: 32, speck: 0.9, bump: 6 });
      K.mesh(new T.CylinderGeometry(4.35, 4.35, 7.2, 32), K.std({ map: mix.map, normalMap: mix.normalMap, metalness: 0.75, roughness: 0.4 }), jx, 4.2, jz);
      const tops = [];
      for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 3.4; tops.push({ x: jx + Math.cos(a) * d, y: 7.9, z: jz + Math.sin(a) * d, ry: r() * 6.28, rx: r.range(-0.5, 0.5), rz: r.range(-0.3, 0.3) }); }
      K.instances(screwGeo, K.metal(0xc9a24a, 0.3), tops, { cast: false });
      // the lid lies beside it
      K.mesh(new T.CylinderGeometry(4.3, 4.3, 1.4, 32), K.metal(0xc8302a, 0.4, { metalness: 0.5 }), jx + 9.5, 0.7, jz + 2.5);
      AO(jx, jz, 6, 6, 0.5); AO(jx + 9.5, jz + 2.5, 5, 5, 0.45);
      K.circle(jx, jz, 4.9, 12.6); K.circle(jx + 9.5, jz + 2.5, 4.3, 1.4);
      // bench brush lying along the wall
      const bx = -128, bz = -97.2, ba = 0.03;
      const g = new T.Group();
      const back = new T.Mesh(new K.RoundedBoxGeometry(22, 2.2, 3.6, 2, 0.8), K.std({ map: pine.map, color: 0x8a5a34, roughness: 0.4 })); back.position.y = 3.1; g.add(back);
      const hdl = new T.Mesh(new T.CylinderGeometry(1.2, 1.4, 9, 14).rotateZ(PI / 2), K.std({ map: pine.map, color: 0x8a5a34, roughness: 0.4 })); hdl.position.set(-15, 2.8, 0); g.add(hdl);
      const bristle = new T.Mesh(new K.RoundedBoxGeometry(22.5, 2.3, 5.2, 2, 0.9), K.std({ color: 0x3a3028, roughness: 1 })); bristle.position.y = 1.15; g.add(bristle);
      g.position.set(bx, 0, bz); g.rotation.y = -ba; K.add(g);
      AO(bx - 4, bz, 15, 3.4, 0.5, ba);
      K.box(bx - 4, bz, 15, 2.2, ba, 4.2);
    }

    // ---------------------------------------------------------------- road-edge accents: washers & screws along fast outer edges
    {
      const wl = [];
      for (const [a, b] of [[92, 150], [712, 760]]) for (const p of track.edgePoints(-1, 3.3, 3.4, a, b)) { const j = r.range(-0.5, 0.9); wl.push({ x: p.x - Math.sin(p.angle) * -j, y: 0.05 + r() * 0.05, z: p.z + Math.cos(p.angle) * -j, ry: r() * 6, rx: r.range(-0.06, 0.06), s: r.range(0.6, 0.78) }); }
      K.instances(K.lathe([[1.0, 0], [2.3, 0], [2.4, 0.15], [2.3, 0.32], [1.0, 0.32]], 20), K.metal(0xc9ccd0, 0.3), wl);
    }

    // ---------------------------------------------------------------- fine scatter: screws, nails, nuts, sawdust, shavings
    {
      // general screws & nails around props
      const cluster = (list, cx, cz, n, spread) => { for (let i = 0; i < n; i++) { const x = cx + r.gauss() * spread, z = cz + r.gauss() * spread; if (K.offRoad(x, z, 1.5) && x > B.minX + 2 && x < B.maxX - 2 && z > B.minZ + 3 && z < B.maxZ - 2) list.push({ x, z, ry: r() * 6.28 }); } };
      cluster(screws, -40, -12, 10, 6); cluster(screws, 95, -30, 8, 5); cluster(screws, -150, 88, 6, 4); cluster(screws, 30, 88, 6, 6); cluster(screws, -165, -60, 5, 3);
      cluster(nails, 128, 12, 10, 5); cluster(nails, -28, 58, 8, 6); cluster(nails, 160, -60, 6, 3);
      const sl = screws.map((p) => ({ x: p.x, y: 0, z: p.z, ry: p.ry, rx: r.range(-0.4, 0.4) }));
      K.instances(screwGeo, K.metal(0xc8ccd2, 0.28), sl);
      const nailGeo = (() => { const s = new T.CylinderGeometry(0.12, 0.12, 5, 6); s.translate(0, -2.5, 0); const h = new T.CylinderGeometry(0.34, 0.34, 0.12, 10); const g = K.BufferGeometryUtils.mergeGeometries([s.toNonIndexed(), h.toNonIndexed()]); g.rotateZ(PI / 2); g.translate(-2.4, 0.16, 0); return g; })();
      K.instances(nailGeo, K.metal(0x8e9298, 0.35), nails.map((p) => ({ x: p.x, y: 0, z: p.z, ry: p.ry })));
      // sawdust specks (bright, tiny), concentrated where wood was worked
      const dust = [];
      const spots = [...(A.sawdustSpots || []), [-50, 38, 14], [110, 32, 14], [-87, -62, 10], [HOLE.x, HOLE.z, 9], [0, -96, 60], [-120, -96, 40]];
      const hp = A.heap;
      for (const [cx, cz, sp] of spots) for (let i = 0; i < 120; i++) {
        const x = cx + r.gauss() * sp * 0.6, z = cz + r.gauss() * sp * 0.35;
        if ((x - HOLE.x) ** 2 + (z - HOLE.z) ** 2 < (HOLE.r + 0.6) ** 2) continue;
        if (!K.offRoad(x, z, -0.5) && Math.hypot(x - hp.x, z - hp.z) > 12) continue;
        if (x < B.minX + 1 || x > B.maxX - 1 || z < B.minZ + 2.5 || z > B.maxZ - 1) continue;
        const s = r.range(0.06, 0.16);
        dust.push({ x, y: 0.04, z, ry: r() * 6, s, sx: s * r.range(1, 3), sy: s * 0.5, color: r.pick([0xf2dcb0, 0xe8c995, 0xd9b27a]) });
      }
      for (let i = 0; i < 260; i++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * 9;
        const x = hp.x + Math.cos(a) * d * 1.3, z = hp.z + Math.sin(a) * d;
        const s = r.range(0.07, 0.18);
        dust.push({ x, y: 0.05 + Math.max(0, 1.35 - d * 0.19), z, ry: r() * 6, s, sx: s * r.range(1, 3), sy: s * 0.5, color: r.pick([0xf2dcb0, 0xe8c995, 0xd9b27a]) });
      }
      for (let i = 0; i < 1400; i++) {
        const x = r.range(B.minX + 1, B.maxX - 1), z = r.range(B.minZ + 2.5, B.maxZ - 1);
        if (!K.offRoad(x, z, 0.8) || (x - HOLE.x) ** 2 + (z - HOLE.z) ** 2 < (HOLE.r + 0.6) ** 2) continue;
        const s = r.range(0.04, 0.11);
        dust.push({ x, y: 0.03, z, ry: r() * 6, s, sx: s * r.range(1, 4), sy: s * 0.5, color: r.pick([0xf2dcb0, 0xe8c995, 0xcfc6b8, 0x8a7a66]) });
      }
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 1 }), dust, { colors: true, cast: false });
      // curly shavings: near the plane, the cut board and the heap
      for (let i = 0; i < 30; i++) { const a = r() * 6.28, d = 2 + r() * 8; shavings.push({ x: hp.x + Math.cos(a) * d * 1.4, y: Math.max(0, 1.3 - d * 0.18), z: hp.z + Math.sin(a) * d, ry: r() * 6.28, s: r.range(0.22, 0.4) }); }
      for (let i = 0; i < 18; i++) { const x = -60 + r.gauss() * 12, z = 30 + r.gauss() * 8; if (K.offRoad(x, z, 1)) shavings.push({ x, y: 0, z, ry: r() * 6.28, s: r.range(0.35, 0.7) }); }
      K.instances(shavingGeo, K.std({ vertexColors: true, roughness: 0.75, side: T.DoubleSide }), shavings.map((p) => ({ ...p, rx: r.range(-0.3, 0.3) })));
      // loose nuts and bolts
      const nb = [];
      for (const [x, z] of [[-100, 22], [-30, -66], [100, -20], [70, 80], [-160, 40], [160, 20], [-10, 90], [130, -88]]) for (let i = 0; i < 3; i++) { const px = x + r.range(-4, 4), pz = z + r.range(-4, 4); if (K.offRoad(px, pz, 1.5)) nb.push({ x: px, y: 0.45, z: pz, ry: r() * 6, s: r.range(0.45, 0.7) }); }
      const smallNut = new T.CylinderGeometry(1.85, 1.85, 1.5, 6);
      K.instances(smallNut, K.metal(0xa8acb2, 0.3), nb);
    }

    // ---------------------------------------------------------------- bench scars: pencil marks, holes, rings, dents, stains (decals)
    {
      const tryPut = (cell, n, w0, w1, opts = {}, zone = null) => {
        for (let k = 0, placed = 0; k < n * 6 && placed < n; k++) {
          const x = zone ? zone[0] + r.gauss() * zone[2] : r.range(B.minX + 6, B.maxX - 6);
          const z = zone ? zone[1] + r.gauss() * zone[3] : r.range(B.minZ + 6, B.maxZ - 4);
          const w = r.range(w0, w1);
          if (!K.offRoad(x, z, w * 0.6 + 1)) continue;
          if (Math.hypot(x - HOLE.x, z - HOLE.z) < HOLE.r + w) continue;
          decal(cell, x, z, w, opts.h ? w * opts.h : w, r() * 6.28, opts);
          placed++;
        }
      };
      tryPut(3, 34, 1.2, 2.2);            // drilled holes
      tryPut(12, 12, 3.5, 5, { h: 0.5 });  // screw hole pairs
      tryPut(0, 10, 8, 10.5, { alpha: 0.6 }); // rings
      tryPut(9, 14, 6, 10, { alpha: 0.8 });
      tryPut(7, 7, 4, 8, { alpha: 0.75 });
      tryPut(8, 10, 2, 5);
      tryPut(4, 9, 8, 11, { alpha: 0.9 });
      tryPut(5, 6, 8, 11, { alpha: 0.9 });
      tryPut(13, 6, 9, 12, { alpha: 0.9 });
      tryPut(10, 3, 10, 13, { alpha: 0.85 });
      tryPut(6, 16, 6, 12, { h: 0.6 });
      tryPut(2, 18, 1, 3, { color: 0xf2f0e8, alpha: 0.9 });
      tryPut(2, 10, 1, 2.5, { color: 0x2f62a8, alpha: 0.9 });
      tryPut(2, 6, 0.8, 2, { color: PAINT, alpha: 0.9 });
      tryPut(1, 18, 6, 14, { color: 0x24160a, alpha: 0.55 });
      tryPut(1, 14, 8, 16, { color: 0x6a3e1a, alpha: 0.5 });
      tryPut(1, 26, 10, 24, { color: 0x3a2412, alpha: 0.35 });
      // pencil marks on the masking tape near corners
      for (const s of [120, 262, 355, 625, 785, 935]) { const side = track.at(s).curv > 0 ? -1 : 1; const q = track.place(s, side * 7.05); if (!isHaz(side, s)) decal(4, q.x, q.z, 2.6, 2.6, q.angle + PI / 2, { y: 0.07, alpha: 0.9 }); }
      // a blue chalk smear where the line was snapped
      decal(11, 20, -70, 30, 8, 0.02, { color: 0x4f8ce0, alpha: 0.6 });
    }

    // ---------------------------------------------------------------- the window: invisible stencil in the sun's path casts mullion shadows
    {
      const D = new T.Vector3(...SUN).normalize();
      const H = 118, ox = D.x / D.y * H, oz = D.z / D.y * H, k = D.z / D.x;
      const sh = new T.Shape();
      sh.moveTo(-1400, -1400); sh.lineTo(1400, -1400); sh.lineTo(1400, 1400); sh.lineTo(-1400, 1400); sh.closePath();
      const xs = [[-700, -62], [-59.6, 12], [14.4, 86], [88.4, 126]], cs = [[-900, -58], [-56, 6], [8, 70], [72, 900]];
      for (const [x0, x1] of xs) for (const [c0, c1] of cs) {
        const hp = new T.Path();
        // in shape space y = -z
        hp.moveTo(x0, -(c0 + k * x0)); hp.lineTo(x0, -(c1 + k * x0)); hp.lineTo(x1, -(c1 + k * x1)); hp.lineTo(x1, -(c0 + k * x1)); hp.closePath();
        sh.holes.push(hp);
      }
      const g = new T.ShapeGeometry(sh, 1);
      g.rotateX(-PI / 2);
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: T.DoubleSide }));
      m.position.set(ox, H, oz);
      m.castShadow = true; m.receiveShadow = false;
      keep.push(m);
      K.group.add(m);
    }

    // ---------------------------------------------------------------- dust motes drifting in the sunlight
    {
      const n = K.quality && K.quality.tilt === false ? 260 : 420;
      const pos = new Float32Array(n * 3), base = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const x = r.range(B.minX, B.maxX), z = r.range(B.minZ, B.maxZ), y = r.range(4, 46);
        base.set([x, y, z, r() * 100], i * 4);
        pos.set([x, y, z], i * 3);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
      g.boundingSphere = new T.Sphere(new T.Vector3(0, 20, 0), 400);
      const sc = TX.makeCanvas(64); const sg = sc.getContext('2d');
      const gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,240,210,0.6)'); gr.addColorStop(1, 'rgba(255,230,190,0)');
      sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
      const mat = new T.PointsMaterial({ size: 0.7, map: TX.toTexture(sc, { wrap: false }), color: 0xffe2b0, transparent: true, opacity: 0.75, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true });
      const pts = new T.Points(g, mat);
      pts.frustumCulled = false; pts.renderOrder = 3;
      K.group.add(pts);
      A.motes = { g, base, n };
    }

    flushDecals();
    flushAO();

    // ---------------------------------------------------------------- moving hazard: a cordless random-orbit sander left running, walking across the east straight
    {
      const R = SAND.r;
      const body = K.phys({ color: 0xe8661c, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 });
      const rubber = K.std({ color: 0x1d1e20, roughness: 0.7 });
      const greyP = K.plastic(0x3a3d42, 0.45);
      const root = new T.Group();
      const shake = new T.Group(); root.add(shake);
      // sanding disc (grit printed, dust-extraction holes) on a black pad
      const dc = TX.makeCanvas(256), dg = dc.getContext('2d');
      dg.fillStyle = '#b8743a'; dg.beginPath(); dg.arc(128, 128, 128, 0, PI * 2); dg.fill();
      const nr = K.rng(77);
      for (let i = 0; i < 2600; i++) { dg.fillStyle = `rgba(${nr() < 0.5 ? '255,220,170' : '70,35,10'},${0.25 + nr() * 0.3})`; dg.fillRect(nr() * 256, nr() * 256, 2, 2); }
      dg.fillStyle = '#2a1a10'; for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; dg.beginPath(); dg.arc(128 + Math.cos(a) * 78, 128 + Math.sin(a) * 78, 9, 0, PI * 2); dg.fill(); }
      dg.beginPath(); dg.arc(128, 128, 12, 0, PI * 2); dg.fill();
      const discMat = K.std({ map: TX.toTexture(dc, { wrap: false }), roughness: 0.95 });
      const pad = new T.Mesh(new T.CylinderGeometry(R, R, 0.5, 40), [rubber, discMat, rubber]); pad.position.y = 0.6; shake.add(pad);
      const padTop = new T.Mesh(new T.CylinderGeometry(R - 0.25, R, 0.6, 40), rubber); padTop.position.y = 1.15; shake.add(padTop);
      // housing: a squat mushroom with a black skirt and a rubber palm grip
      const hous = new T.Mesh(K.lathe([[R - 0.6, 0], [R - 0.4, 0.9], [R - 1.0, 2.2], [3.6, 3.4], [3.2, 4.6], [3.4, 5.4], [3.1, 6.2], [2.2, 6.9], [0.001, 7.1]], 40), body);
      hous.position.y = 1.4; shake.add(hous);
      const skirt = new T.Mesh(new T.CylinderGeometry(R - 0.45, R - 0.35, 0.7, 40), greyP); skirt.position.y = 1.75; shake.add(skirt);
      const grip = new T.Mesh(new T.SphereGeometry(3.25, 28, 14, 0, PI * 2, 0, PI / 2), rubber); grip.scale.y = 0.55; grip.position.y = 7.0; shake.add(grip);
      // speed dial + power switch
      const dial = new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 0.5, 16), greyP); dial.position.set(2.7, 6.1, 1.2); dial.rotation.z = -0.5; shake.add(dial);
      const sw = new T.Mesh(new K.RoundedBoxGeometry(1.6, 0.7, 1.0, 2, 0.25), K.plastic(0xd8d8d0, 0.4)); sw.position.set(-1.0, 6.85, 2.2); sw.rotation.x = -0.4; shake.add(sw);
      // label band
      const lc = TX.makeCanvas(512, 64), lg = lc.getContext('2d');
      lg.fillStyle = '#1d1e20'; lg.fillRect(0, 0, 512, 64);
      lg.fillStyle = '#f4f1ea'; lg.font = '700 34px Rubik, sans-serif'; lg.fillText('ORBIT 125', 22, 45); lg.fillText('ORBIT 125', 278, 45);
      lg.fillStyle = '#e8661c'; lg.fillRect(214, 22, 40, 20); lg.fillRect(470, 22, 40, 20);
      const band = new T.Mesh(new T.CylinderGeometry(3.42, 3.62, 1.1, 40, 1, true), K.std({ map: TX.toTexture(lc), roughness: 0.5 })); band.position.y = 1.4 + 3.75; shake.add(band);
      // battery pack at the back (cordless) and the dust port with a cloth bag
      const batt = new T.Mesh(new K.RoundedBoxGeometry(5.0, 2.6, 3.6, 3, 0.5), greyP); batt.position.set(-5.6, 2.2, 0); shake.add(batt);
      const battTop = new T.Mesh(new K.RoundedBoxGeometry(3.6, 0.4, 3.0, 2, 0.15), body); battTop.position.set(-5.8, 3.55, 0); shake.add(battTop);
      const port = new T.Mesh(new T.CylinderGeometry(0.9, 1.0, 3.2, 16), greyP); port.rotation.z = PI / 2 - 0.25; port.position.set(-3.8, 2.4, -3.4); port.rotation.y = 0.5; shake.add(port);
      const bag = new T.Mesh(new T.SphereGeometry(1, 20, 14), K.std({ color: 0x55626e, roughness: 0.95 })); bag.scale.set(2.8, 1.5, 1.8); bag.position.set(-7.0, 1.9, -4.6); bag.rotation.y = 0.5; shake.add(bag);
      K.add(root); keep.push(root);
      const shadow = K.contact(SAND.wx, SAND.z, R + 1.6, R + 1.2, 0.5); keep.push(shadow);
      K.mover({ type: 'circle', r: R + 0.15, h: 8 }, (t) => { const q = sanderPose(t); return { x: q.x, z: q.z, angle: q.angle }; });
      A.sander = { root, shake, shadow, buzz: 0, dust: 0 };
    }

    // ---------------------------------------------------------------- merge static meshes (fewer draw calls)
    // Untextured materials are grouped into a few classes; their colours are baked into vertex colours.
    {
      const BU = K.BufferGeometryUtils;
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const classMats = {
        metalS: shiny(K.std({ vertexColors: true, metalness: 1, roughness: 0.1 }), 1.1),
        metalR: shiny(K.std({ vertexColors: true, metalness: 1, roughness: 0.36 }), 0.8),
        gloss: shiny(K.phys({ vertexColors: true, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08 }), 0.8),
        plastic: K.phys({ vertexColors: true, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
        satin: K.std({ vertexColors: true, roughness: 0.45 }),
        matte: K.std({ vertexColors: true, roughness: 0.82 }),
      };
      const plain = (m) => !m.map && !m.normalMap && !m.roughnessMap && !m.alphaMap && !m.bumpMap && !m.metalnessMap && !m.transparent && m.side !== T.BackSide && !(m.iridescence > 0) && (m.isMeshStandardMaterial);
      const classOf = (m) => {
        if (m.metalness >= 0.5) return m.roughness < 0.26 ? 'metalS' : 'metalR';
        if (m.isMeshPhysicalMaterial && m.clearcoat >= 0.6) return 'gloss';
        if (m.isMeshPhysicalMaterial && m.clearcoat > 0) return 'plastic';
        return m.roughness < 0.6 ? 'satin' : 'matte';
      };
      const buckets = new Map();
      const col = new T.Color();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        const m = o.material;
        // flat labels and wrap-around label sleeves don't need to cast shadows
        if (m.map && ((o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.openEnded) || o.geometry.type === 'PlaneGeometry' || o.geometry.type === 'CircleGeometry')) o.castShadow = false;
        if (m.transparent || o.renderOrder) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 80) return;
        const cell = Math.floor((c.x + 200) / 175) + ':' + Math.floor((c.z + 200) / 175) + ':' + (c.y < -20 ? 'f' : 'b');
        const cls = plain(m) ? classOf(m) + (m.side === T.DoubleSide ? 'D' : '') : null;
        const key = (cls || m.uuid) + cell + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, { cls, list: [] });
        buckets.get(key).list.push(o);
      });
      for (const { cls, list } of buckets.values()) {
        if (list.length < 2 && !cls) continue;
        const geos = [];
        for (const o of list) {
          let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          if (!g.attributes.normal) g.computeVertexNormals();
          if (cls) {
            // bake the material colour (x existing vertex colours) into a colour attribute
            col.copy(o.material.color);
            const n = g.attributes.position.count, ca = new Float32Array(n * 3), src = o.material.vertexColors ? g.attributes.color : null;
            for (let i = 0; i < n; i++) { ca[i * 3] = col.r * (src ? src.getX(i) : 1); ca[i * 3 + 1] = col.g * (src ? src.getY(i) : 1); ca[i * 3 + 2] = col.b * (src ? src.getZ(i) : 1); }
            for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
            g.setAttribute('color', new T.BufferAttribute(ca, 3));
          } else {
            for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
            if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          }
          geos.push(g);
        }
        if (!cls) {
          const hasCol = geos.some((g) => g.attributes.color);
          if (hasCol !== geos.every((g) => g.attributes.color)) continue;
        }
        const merged = BU.mergeGeometries(geos, false);
        if (!merged) continue;
        let mat = list[0].material;
        if (cls) {
          const base = cls.replace('D', '');
          mat = classMats[cls] || (classMats[cls] = classMats[base].clone());
          if (cls.endsWith('D')) mat.side = T.DoubleSide;
        }
        const m = new T.Mesh(merged, mat);
        m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
        for (const o of list) o.parent.remove(o);
        K.group.add(m);
      }
    }
  },

  animate(time, dt, game) {
    if (!A) return;
    if (A.sander) {
      const S = A.sander, q = sanderPose(time);
      S.root.position.set(q.x, 0, q.z); S.root.rotation.y = -q.angle;
      S.shake.position.set(Math.sin(time * 97) * 0.06, Math.abs(Math.sin(time * 83)) * 0.05, Math.cos(time * 89) * 0.06);
      S.shake.rotation.set(Math.sin(time * 71) * 0.012, 0, Math.cos(time * 67) * 0.012);
      S.shadow.position.set(q.x, 0.035, q.z);
      if (game && game.particles && dt > 0.001 && game.onScreen(q.x, 2, q.z, 0.2)) {
        // fine dust squeezed out round the pad, a puff from the bag now and then
        S.dust += dt * (q.moving ? 34 : 18);
        while (S.dust > 1) {
          S.dust--;
          const a = Math.random() * Math.PI * 2;
          game.particles.emit(q.x + Math.cos(a) * SAND.r, 0.6, q.z + Math.sin(a) * SAND.r, { vx: Math.cos(a) * 7, vz: Math.sin(a) * 7, spread: 3, up: 1.5, grav: 4, color: 0xe7c99a, size: 0.55, life: 0.6, alpha: 0.8, grow: 1.6 });
        }
        if (Math.random() < dt * 3) game.particles.emit(q.x, 1.5, q.z, { spread: 6, up: 2, grav: -0.5, color: 0xeedcbc, size: 2.4, life: 1.1, alpha: 0.18, grow: 2.2 });
        S.buzz -= dt;
        if (S.buzz <= 0 && game.sound.ctx && (game.state === 'race' || game.state === 'roundEnd')) {
          S.buzz = 0.3;
          const pan = game.panOf(q.x, q.z);
          game.sound.noiseBurst(0.34, { freq: q.moving ? 1150 : 900, q: 5, vol: 0.06, type: 'bandpass', pan });
          game.sound.tone(q.moving ? 128 : 112, 0.32, { type: 'sawtooth', vol: 0.018 });
        }
      }
    }
    if (!A.motes) return;
    const { g, base, n } = A.motes;
    const p = g.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const ph = base[i * 4 + 3];
      p[i * 3] = base[i * 4] + Math.sin(time * 0.13 + ph) * 3 + Math.sin(time * 0.05 + ph * 0.3) * 4;
      p[i * 3 + 1] = base[i * 4 + 1] + Math.sin(time * 0.21 + ph * 1.7) * 2.2;
      p[i * 3 + 2] = base[i * 4 + 2] + Math.cos(time * 0.17 + ph * 0.6) * 2.5;
    }
    g.attributes.position.needsUpdate = true;
  },
};
