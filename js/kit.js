// Helpers handed to world builders: materials, decals, instancing, contact shadows, colliders.
import * as THREE from '../vendor/three.bundle.js';
import { RoundedBoxGeometry, BufferGeometryUtils } from '../vendor/three.bundle.js';
import * as TX from './textures.js';
import { rng, blobOutline, TAU } from './util.js';

export function makeKit({ scene, track, physics, quality, seed = 7 }) {
  const group = new THREE.Group();
  scene.add(group);
  const r = rng(seed);
  const disposables = [];

  const kit = {
    THREE, TX, RoundedBoxGeometry, BufferGeometryUtils, group, track, physics, quality, r, rng, TAU, blobOutline,

    add(obj, { cast = true, receive = true, parent = group } = {}) {
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
      parent.add(obj);
      return obj;
    },

    mesh(geo, mat, x = 0, y = 0, z = 0, opts = {}) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (opts.ry) m.rotation.y = opts.ry;
      if (opts.rx) m.rotation.x = opts.rx;
      if (opts.rz) m.rotation.z = opts.rz;
      if (opts.scale) m.scale.setScalar(opts.scale);
      return kit.add(m, opts);
    },

    // --- material factories
    std(params) { return new THREE.MeshStandardMaterial(params); },
    phys(params) { return new THREE.MeshPhysicalMaterial(params); },
    ceramic(color = 0xf5f3ee, extra = {}) { return new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12, ...extra }); },
    metal(color = 0xd8dade, rough = 0.2, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 1, ...extra }); },
    plastic(color, rough = 0.35, extra = {}) { return new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3, ...extra }); },
    glass(color = 0xffffff, opacity = 0.22, extra = {}) {
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, metalness: 0, transparent: true, opacity, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6, ...extra });
    },
    liquid(color, extra = {}) { return new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, ...extra }); },

    // --- flat decals lying on the table: poly [[x,z]...], y height
    flatShape(poly, mat, y = 0.03, { cast = false, receive = true, extrude = 0, bevel = 0 } = {}) {
      const sh = new THREE.Shape();
      sh.moveTo(poly[0][0], -poly[0][1]);
      for (let i = 1; i < poly.length; i++) sh.lineTo(poly[i][0], -poly[i][1]);
      sh.closePath();
      let g;
      if (extrude > 0) {
        g = new THREE.ExtrudeGeometry(sh, { depth: extrude, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 12 });
      } else g = new THREE.ShapeGeometry(sh, 12);
      g.rotateX(-Math.PI / 2);
      // ShapeGeometry UVs are in shape units; map to world xz / 10 for tiling textures
      const uv = g.attributes.uv, pos = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 10, -pos.getZ(i) / 10);
      const m = new THREE.Mesh(g, mat);
      m.position.y = y;
      m.castShadow = cast; m.receiveShadow = receive;
      group.add(m);
      return m;
    },

    // Spill / puddle: glossy blob decal. Returns the polygon (useful for physics surfaces).
    spill(cx, cz, radius, mat, { lump = 0.35, stretch = 1, angle = 0, y = 0.05, thick = 0.12, n = 48 } = {}) {
      const poly = blobOutline(r, cx, cz, radius, lump, n, stretch, angle);
      const m = kit.flatShape(poly, mat, y - thick, { extrude: thick, bevel: Math.min(thick, 0.25) });
      m.receiveShadow = true;
      return { poly, mesh: m };
    },

    // Soft dark blob under an object = cheap ambient occlusion.
    contact(x, z, rx, rz = rx, opacity = 0.35, angle = 0, y = 0.035) {
      const m = new THREE.Mesh(kit._blobGeo || (kit._blobGeo = new THREE.PlaneGeometry(1, 1)),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = -angle;
      m.scale.set(rx * 2, rz * 2, 1);
      m.position.set(x, y, z);
      m.renderOrder = 1;
      group.add(m);
      return m;
    },

    // InstancedMesh from a list of {x,y,z,ry,rx,rz,s|sx,sy,sz,color}
    instances(geo, mat, list, { cast = true, receive = true, colors = false } = {}) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
      const col = new THREE.Color();
      list.forEach((t, i) => {
        e.set(t.rx || 0, t.ry || 0, t.rz || 0, t.order || 'YXZ');
        q.setFromEuler(e);
        p.set(t.x, t.y || 0, t.z);
        s.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
        m4.compose(p, q, s);
        im.setMatrixAt(i, m4);
        if (colors && t.color != null) im.setColorAt(i, col.set(t.color));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = cast; im.receiveShadow = receive;
      im.computeBoundingSphere();
      group.add(im);
      return im;
    },

    // Track surface ribbon (road paint, paper strip, chalk lines ...)
    ribbon({ mat, width = null, y = 0.03, vScale = 10, offset = 0, step = 2, widthFn = null, cast = false }) {
      const g = track.ribbonGeometry({ width, y, vScale, offset, step, widthFn });
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true; m.castShadow = cast;
      group.add(m);
      return m;
    },

    // Lathe from [[radius, height], ...]
    lathe(profile, segs = 48) {
      return new THREE.LatheGeometry(profile.map(([rr, h]) => new THREE.Vector2(rr, h)), segs);
    },

    // --- physics shortcuts
    circle(x, z, rad, h = 50, extra = {}) { return physics.addCollider({ type: 'circle', x, z, r: rad, h, ...extra }); },
    box(x, z, hw, hd, angle = 0, h = 50, extra = {}) { return physics.addCollider({ type: 'box', x, z, hw, hd, angle, h, ...extra }); },
    capsule(x1, z1, x2, z2, rad, h = 50, extra = {}) { return physics.addCollider({ type: 'capsule', x1, z1, x2, z2, r: rad, h, ...extra }); },
    surface(kind, shape) { return physics.addSurface({ kind, ...shape }); },
    hole(x, z, rad) { return physics.addHole({ x, z, r: rad }); },
    // rectangular hole; set `.open = false/true` from tick() for trapdoors
    trapdoor(x, z, hw, hd, angle = 0, open = false) { return physics.addHole({ x, z, hw, hd, angle, open }); },
    // turning disc that carries cars: angleFn(t) -> radians; h = deck height (0 = flush)
    spinner(x, z, r, angleFn, opts = {}) { return physics.addSpinner({ x, z, r, angleFn, ...opts }); },
    ramp(x, z, angle, len, wid, height, base = 0) { return physics.addRamp({ x, z, angle, len, wid, height, base }); },
    platform(x, z, hw, hd, angle, h) { return physics.addPlatform({ x, z, hw, hd, angle, h }); },
    // moving collider: shape {type:'circle'|'box'|'capsule', r|hw,hd, h}, fn(t) -> {x,z,angle} or {x1,z1,x2,z2}
    mover(shape, fn) { return physics.addMover({ h: 50, ...shape }, fn); },

    // Is a point clear of the road (for decoration placement)?
    offRoad(x, z, margin = 2) {
      const n = track.distTo(x, z);
      return n.dist > track.w[n.i] / 2 + margin;
    },

    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) {
            for (const k of ['map', 'normalMap', 'roughnessMap', 'alphaMap', 'metalnessMap', 'bumpMap', 'emissiveMap', 'clearcoatNormalMap']) {
              if (m[k] && m[k] !== TX.blobShadowTexture()) m[k].dispose();
            }
            m.dispose();
          }
        }
      });
      scene.remove(group);
      for (const d of disposables) d.dispose?.();
    },
  };
  return kit;
}
