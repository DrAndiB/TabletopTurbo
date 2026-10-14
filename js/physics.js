// Arcade car physics on a flat tabletop with ramps, hazards, pushable objects and drops.
import { clamp, wrapAngle, pointInPoly, segDist } from './util.js';

export const GRAVITY = 120;
export const LAUNCH = 2.4; // exaggerated toy-car jumps

export const VEHICLES = {
  sports: { maxSpeed: 47, accel: 64, brake: 120, reverseMax: 17, turnRate: 3.35, latGrip: 150, drag: 0.22, rolling: 6, len: 4.4, wid: 2.2, r: 1.12, axle: 1.08, mass: 1 },
  formula: { maxSpeed: 51, accel: 70, brake: 135, reverseMax: 17, turnRate: 3.25, latGrip: 170, drag: 0.22, rolling: 6, len: 4.6, wid: 2.1, r: 1.05, axle: 1.2, mass: 0.95 },
  truck: { maxSpeed: 43, accel: 60, brake: 110, reverseMax: 18, turnRate: 3.2, latGrip: 135, drag: 0.2, rolling: 5, len: 4.4, wid: 2.6, r: 1.3, axle: 1.0, mass: 1.25, offroadGrip: 1.0 },
  rally: { maxSpeed: 46, accel: 66, brake: 120, reverseMax: 17, turnRate: 3.4, latGrip: 140, drag: 0.22, rolling: 6, len: 4.3, wid: 2.25, r: 1.14, axle: 1.05, mass: 1.05 },
};

const SURFACES = {
  normal: { grip: 1, drag: 0, accel: 1, top: 1 },
  slick: { grip: 0.16, drag: 0, accel: 0.55, top: 1, spin: 1 },
  sticky: { grip: 1.3, drag: 3.2, accel: 0.75, top: 0.45 },
  slow: { grip: 0.85, drag: 1.6, accel: 0.8, top: 0.62 },
  rough: { grip: 0.9, drag: 0.8, accel: 0.9, top: 0.8 },
  water: { grip: 0.35, drag: 1.4, accel: 0.7, top: 0.7, spin: 0.4 },
};

export class Car {
  constructor(spec, index) {
    this.spec = spec;
    this.index = index;
    this.x = 0; this.z = 0; this.angle = 0;
    this.vx = 0; this.vz = 0; this.w = 0;
    this.y = 0; this.vy = 0; this.airborne = false;
    this.throttle = 0; this.brake = 0; this.steer = 0;
    this.steerVis = 0; // smoothed front wheel angle for rendering
    this.wheelSpin = 0;
    this.slip = 0; // lateral slip speed (for skid marks/sound)
    this.surface = 'normal';
    this.state = 'drive'; // drive | falling | out | hidden
    this.fallT = 0; this.fallKind = null; this.fallVX = 0; this.fallVZ = 0;
    this.tumble = 0; this.tumbleAxis = 0;
    this.groundSlope = 0;
    this.hitImpulse = 0; // last collision strength (sound)
    this.lastRamp = null;
    this.ghost = 0; // seconds of no car-car collisions (after respawn)
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwdSpeed() { return this.vx * Math.cos(this.angle) + this.vz * Math.sin(this.angle); }
  circles() {
    const c = Math.cos(this.angle), s = Math.sin(this.angle), a = this.spec.axle;
    return [[this.x + c * a, this.z + s * a], [this.x - c * a, this.z - s * a]];
  }
  place(x, z, angle) {
    this.x = x; this.z = z; this.angle = angle;
    this.vx = this.vz = this.w = 0; this.y = 0; this.vy = 0; this.airborne = false;
    this.state = 'drive'; this.tumble = 0; this.fallT = 0; this.slip = 0;
  }
}

export class PhysicsWorld {
  constructor(track, opts = {}) {
    this.track = track;
    this.colliders = []; // static: circle | box | capsule  (+ h height)
    this.dynamics = []; // pushable round objects
    this.surfaces = [];
    this.holes = [];
    this.ramps = [];
    this.platforms = [];
    this.bounds = opts.bounds || null; // {minX,maxX,minZ,maxZ}
    this.fallOffEdges = opts.fallOffEdges ?? true;
    this.floorY = opts.floorY ?? -70;
    this.offroad = opts.offroad || null; // {kind, margin}
    this.events = []; // {type, car, x, z, strength}
  }

  addCollider(c) {
    c.h = c.h ?? 50;
    if (c.type === 'circle') c.bb = [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r];
    else if (c.type === 'box') {
      const ca = Math.abs(Math.cos(c.angle || 0)), sa = Math.abs(Math.sin(c.angle || 0));
      const ex = c.hw * ca + c.hd * sa, ez = c.hw * sa + c.hd * ca;
      c.bb = [c.x - ex, c.z - ez, c.x + ex, c.z + ez];
      c.cos = Math.cos(c.angle || 0); c.sin = Math.sin(c.angle || 0);
    } else if (c.type === 'capsule') {
      c.bb = [Math.min(c.x1, c.x2) - c.r, Math.min(c.z1, c.z2) - c.r, Math.max(c.x1, c.x2) + c.r, Math.max(c.z1, c.z2) + c.r];
    }
    this.colliders.push(c);
    return c;
  }
  addDynamic(d) {
    Object.assign(d, { vx: 0, vz: 0, home: [d.x, d.z], state: 'live', t: 0, rolled: 0 });
    d.m = d.m ?? 2.5; d.h = d.h ?? d.r * 2;
    this.dynamics.push(d);
    return d;
  }
  addSurface(s) {
    // {kind, circle:{x,z,r}} or {kind, poly:[[x,z]...]}
    if (s.poly) {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const [x, z] of s.poly) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); }
      s.bb = [a, b, c, d];
    } else s.bb = [s.x - s.r, s.z - s.r, s.x + s.r, s.z + s.r];
    this.surfaces.push(s);
    return s;
  }
  addHole(h) { this.holes.push(h); return h; }
  // Ramp: rises from 0 at its start to `height` at its end along `angle`. Rect centred at x,z.
  addRamp(r) {
    r.cos = Math.cos(r.angle); r.sin = Math.sin(r.angle);
    this.ramps.push(r);
    return r;
  }
  // Flat raised area you can drive on (e.g. a book). Its sides block cars lower than its top.
  addPlatform(p) {
    p.cos = Math.cos(p.angle || 0); p.sin = Math.sin(p.angle || 0);
    this.platforms.push(p);
    return p;
  }

  surfaceAt(x, z, carTrackLateral = 0, w = 14) {
    for (let i = this.surfaces.length - 1; i >= 0; i--) {
      const s = this.surfaces[i];
      if (x < s.bb[0] || x > s.bb[2] || z < s.bb[1] || z > s.bb[3]) continue;
      if (s.poly ? pointInPoly(x, z, s.poly) : (x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r) return s.kind;
    }
    if (this.offroad && Math.abs(carTrackLateral) > w / 2 + (this.offroad.margin ?? 1)) return this.offroad.kind;
    return 'normal';
  }

  // Ground height under (x,z) and ramp slope information.
  groundAt(x, z) {
    let g = 0, ramp = null, slope = 0;
    for (const r of this.ramps) {
      const dx = x - r.x, dz = z - r.z;
      const a = dx * r.cos + dz * r.sin, b = -dx * r.sin + dz * r.cos;
      if (Math.abs(a) <= r.len / 2 && Math.abs(b) <= r.wid / 2) {
        const h = r.height * (a + r.len / 2) / r.len + (r.base || 0);
        if (h > g) { g = h; ramp = r; slope = r.height / r.len; }
      }
    }
    for (const p of this.platforms) {
      const dx = x - p.x, dz = z - p.z;
      const a = dx * p.cos + dz * p.sin, b = -dx * p.sin + dz * p.cos;
      if (Math.abs(a) <= p.hw && Math.abs(b) <= p.hd && p.h > g) { g = p.h; ramp = null; slope = 0; }
    }
    return { g, ramp, slope };
  }

  insideBounds(x, z) {
    const b = this.bounds;
    if (!b) return true;
    if (b.poly) return pointInPoly(x, z, b.poly);
    return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  }

  // ---- collision primitives: return {nx, nz, pen} pushing the circle out, or null
  circleVsCollider(px, pz, r, c) {
    if (c.type === 'circle') {
      const dx = px - c.x, dz = pz - c.z;
      const d = Math.hypot(dx, dz), R = r + c.r;
      if (d >= R) return null;
      if (d < 1e-6) return { nx: 1, nz: 0, pen: R };
      return { nx: dx / d, nz: dz / d, pen: R - d };
    }
    if (c.type === 'capsule') {
      const q = segDist(px, pz, c.x1, c.z1, c.x2, c.z2);
      const R = r + c.r;
      if (q.d >= R) return null;
      const dx = px - q.cx, dz = pz - q.cz, d = q.d || 1e-6;
      return { nx: dx / d, nz: dz / d, pen: R - q.d };
    }
    if (c.type === 'box') {
      const dx = px - c.x, dz = pz - c.z;
      const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
      const cx = clamp(lx, -c.hw, c.hw), cz = clamp(lz, -c.hd, c.hd);
      let ox = lx - cx, oz = lz - cz;
      let d = Math.hypot(ox, oz);
      let nlx, nlz, pen;
      if (d > 1e-6) {
        if (d >= r) return null;
        nlx = ox / d; nlz = oz / d; pen = r - d;
      } else {
        // centre inside the box: push out along the smallest axis
        const px1 = c.hw - Math.abs(lx), pz1 = c.hd - Math.abs(lz);
        if (px1 < pz1) { nlx = Math.sign(lx) || 1; nlz = 0; pen = px1 + r; }
        else { nlx = 0; nlz = Math.sign(lz) || 1; pen = pz1 + r; }
      }
      return { nx: nlx * c.cos - nlz * c.sin, nz: nlx * c.sin + nlz * c.cos, pen };
    }
    return null;
  }

  // Platform sides act as walls for cars below their top.
  platformAsBox(p) {
    return { type: 'box', x: p.x, z: p.z, hw: p.hw, hd: p.hd, cos: p.cos, sin: p.sin, h: p.h };
  }

  stepCar(car, dt, ctx) {
    const sp = car.spec;
    if (car.state === 'falling') {
      car.fallT += dt;
      car.vy -= GRAVITY * dt;
      car.y += car.vy * dt;
      car.x += car.fallVX * dt; car.z += car.fallVZ * dt;
      car.fallVX *= Math.exp(-0.6 * dt); car.fallVZ *= Math.exp(-0.6 * dt);
      car.tumble += dt * (car.fallKind === 'hole' ? 2 : 7);
      if (car.fallKind === 'hole') { car.fallVX *= Math.exp(-6 * dt); car.fallVZ *= Math.exp(-6 * dt); }
      if (car.y < this.floorY) { car.y = this.floorY; car.fallVX = car.fallVZ = 0; }
      return;
    }
    if (car.state !== 'drive') return;
    car.ghost = Math.max(0, car.ghost - dt);

    const c = Math.cos(car.angle), s = Math.sin(car.angle);
    let vLong = car.vx * c + car.vz * s;
    let vLat = -car.vx * s + car.vz * c;

    const lateral = ctx?.lateral ?? 0, tw = ctx?.trackW ?? 14;
    const kind = car.airborne ? 'normal' : this.surfaceAt(car.x, car.z, lateral, tw);
    car.surface = kind;
    let S = SURFACES[kind] || SURFACES.normal;
    if (kind === 'slow' && sp.offroadGrip) S = { ...S, drag: S.drag * 0.45, top: Math.min(1, S.top + 0.2), accel: 0.95 };
    const top = sp.maxSpeed * S.top * (ctx?.speedMul ?? 1);

    if (!car.airborne) {
      // engine & brakes
      const thr = car.throttle, brk = car.brake;
      if (thr > 0) {
        if (vLong < -1 && brk === 0) vLong += sp.brake * thr * dt; // throttle while rolling back = brake
        else {
          const room = Math.max(0, 1 - vLong / top);
          vLong += sp.accel * S.accel * thr * (0.35 + 0.65 * room) * dt * (vLong > top ? 0 : 1);
        }
      }
      if (brk > 0) {
        if (vLong > 1) vLong -= sp.brake * brk * dt;
        else vLong = Math.max(-sp.reverseMax, vLong - sp.accel * 0.6 * brk * dt);
      }
      // rolling resistance and drag
      const roll = sp.rolling + S.drag * Math.abs(vLong) * 0.9;
      if (thr === 0 || vLong > top) {
        const dec = (roll + (vLong > top ? (vLong - top) * 2.5 : 0)) * dt;
        vLong = Math.abs(vLong) <= dec ? 0 : vLong - Math.sign(vLong) * dec;
      } else {
        vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong), S.drag * Math.abs(vLong) * dt);
      }
      vLong -= vLong * sp.drag * 0.02 * dt;

      // steering: yaw rate builds with speed, eases off near top speed
      const av = Math.abs(vLong);
      const g = Math.min(1, av / 9) * (1 - 0.32 * Math.min(1, av / sp.maxSpeed));
      const dir = vLong >= -0.5 ? 1 : -1;
      const targetW = car.steer * sp.turnRate * g * dir * (S.spin ? 1.15 : 1);
      // yaw follows target, faster with good grip; collisions can add spin which decays
      const follow = 14 * Math.min(1.2, S.grip + 0.25);
      car.w += (targetW - car.w) * (1 - Math.exp(-follow * dt));

      // lateral grip (friction-limited: high lateral speeds slide)
      const maxLat = sp.latGrip * S.grip * dt;
      const before = vLat;
      vLat = Math.abs(vLat) <= maxLat ? 0 : vLat - Math.sign(vLat) * maxLat;
      car.slip = Math.abs(before);
    } else {
      car.w *= Math.exp(-1.5 * dt);
      car.slip = 0;
    }

    // velocity stays in world space; the heading turns and grip pulls the velocity round next step
    car.vx = c * vLong - s * vLat;
    car.vz = s * vLong + c * vLat;
    car.angle = wrapAngle(car.angle + car.w * dt);
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    car.wheelSpin += vLong * dt / 0.55;
    car.steerVis += (car.steer - car.steerVis) * (1 - Math.exp(-12 * dt));

    // vertical: ramps, platforms, drops
    const gr = this.groundAt(car.x, car.z);
    if (car.airborne) {
      car.vy -= GRAVITY * dt;
      car.y += car.vy * dt;
      if (car.y <= gr.g) {
        const impact = -car.vy;
        car.y = gr.g; car.vy = 0; car.airborne = false;
        if (impact > 25) this.events.push({ type: 'land', car, strength: impact });
      }
    } else if (gr.g > car.y + 0.9) {
      // the side of a ramp or step: too high to climb, bounce back
      car.x -= car.vx * dt * 1.5; car.z -= car.vz * dt * 1.5;
      car.vx *= -0.3; car.vz *= -0.3;
      this.events.push({ type: 'hit', car, strength: 8 });
    } else {
      if (gr.g < car.y - 0.35) {
        // drove off something: keep upward speed from ramp slope
        car.airborne = true;
        const along = car.lastRamp ? (car.vx * car.lastRamp.cos + car.vz * car.lastRamp.sin) : 0;
        car.vy = car.lastRamp ? Math.max(0, along * car.groundSlope * LAUNCH) : 0;
        if (car.vy > 8) this.events.push({ type: 'jump', car, strength: car.vy });
      } else {
        car.y = gr.g;
      }
      car.lastRamp = gr.ramp; car.groundSlope = gr.slope;
    }

    // static collisions (two circles per car)
    car.hitImpulse = 0;
    const hits = this.collideCarStatic(car);
    if (hits > 0 && hits > 6) this.events.push({ type: 'hit', car, strength: hits });

    // falling off the table or into a hole
    if (!car.airborne || car.y < 0.5) {
      for (const h of this.holes) {
        if ((car.x - h.x) ** 2 + (car.z - h.z) ** 2 < (h.r - 0.4) ** 2) { this.startFall(car, 'hole', h); return; }
      }
    }
    if (this.fallOffEdges && !this.insideBounds(car.x, car.z) && car.y < 1) this.startFall(car, 'edge');
  }

  startFall(car, kind, hole) {
    car.state = 'falling';
    car.fallKind = kind;
    car.fallT = 0;
    car.fallVX = car.vx * 0.8; car.fallVZ = car.vz * 0.8;
    car.vy = kind === 'hole' ? -10 : 8;
    car.tumbleAxis = Math.random() * Math.PI * 2;
    if (kind === 'hole' && hole) { car.fallVX = (hole.x - car.x) * 3; car.fallVZ = (hole.z - car.z) * 3; }
    this.events.push({ type: 'fall', car, kind });
  }

  collideCarStatic(car) {
    let total = 0;
    const sp = car.spec;
    for (let pass = 0; pass < 2; pass++) {
      const circ = car.circles();
      for (let k = 0; k < 2; k++) {
        const [px, pz] = circ[k];
        const r = sp.r;
        const test = (c) => {
          if (car.y >= c.h - 0.2) return;
          if (c.bb && (px + r < c.bb[0] || px - r > c.bb[2] || pz + r < c.bb[1] || pz - r > c.bb[3])) return;
          const hit = this.circleVsCollider(px, pz, r, c);
          if (!hit) return;
          total += this.resolveCarHit(car, hit, px, pz, c.bounce ?? 0.35);
        };
        for (const c of this.colliders) test(c);
        for (const p of this.platforms) {
          if (car.y >= p.h - 0.4) continue;
          // driving up a ramp onto the platform is allowed: only block when not on a ramp leading up
          const gr = this.groundAt(px, pz);
          if (gr.g >= p.h - 0.6) continue;
          const b = this.platformAsBox(p);
          const hit = this.circleVsCollider(px, pz, r, b);
          if (hit) total += this.resolveCarHit(car, hit, px, pz, 0.3);
        }
        // walls at the bounds if the world doesn't let cars fall off
        if (!this.fallOffEdges && this.bounds && !this.bounds.poly) {
          const b = this.bounds;
          if (px - r < b.minX) total += this.resolveCarHit(car, { nx: 1, nz: 0, pen: b.minX - (px - r) }, px, pz, 0.4);
          if (px + r > b.maxX) total += this.resolveCarHit(car, { nx: -1, nz: 0, pen: px + r - b.maxX }, px, pz, 0.4);
          if (pz - r < b.minZ) total += this.resolveCarHit(car, { nx: 0, nz: 1, pen: b.minZ - (pz - r) }, px, pz, 0.4);
          if (pz + r > b.maxZ) total += this.resolveCarHit(car, { nx: 0, nz: -1, pen: pz + r - b.maxZ }, px, pz, 0.4);
        }
      }
    }
    return total;
  }

  resolveCarHit(car, hit, px, pz, e) {
    car.x += hit.nx * hit.pen;
    car.z += hit.nz * hit.pen;
    const vn = car.vx * hit.nx + car.vz * hit.nz;
    if (vn >= 0) return 0;
    const j = -(1 + e) * vn;
    car.vx += hit.nx * j;
    car.vz += hit.nz * j;
    // tangential scrub
    const tx = -hit.nz, tz = hit.nx;
    const vt = car.vx * tx + car.vz * tz;
    car.vx -= tx * vt * 0.12; car.vz -= tz * vt * 0.12;
    // spin from off-centre impact
    const rx = px - car.x, rz = pz - car.z;
    const torque = rx * hit.nz * j - rz * hit.nx * j;
    car.w += torque * 0.09;
    car.hitImpulse = Math.max(car.hitImpulse, j);
    return j;
  }

  collideCars(cars) {
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      if (a.state !== 'drive' || a.ghost > 0) continue;
      for (let j = i + 1; j < cars.length; j++) {
        const b = cars[j];
        if (b.state !== 'drive' || b.ghost > 0) continue;
        if (Math.abs(a.y - b.y) > 1.6) continue;
        if (Math.abs(a.x - b.x) > 8 || Math.abs(a.z - b.z) > 8) continue;
        const ca = a.circles(), cb = b.circles();
        for (const p of ca) for (const q of cb) {
          const dx = p[0] - q[0], dz = p[1] - q[1];
          const R = a.spec.r + b.spec.r;
          const d2 = dx * dx + dz * dz;
          if (d2 >= R * R) continue;
          const d = Math.sqrt(d2) || 1e-4;
          const nx = dx / d, nz = dz / d, pen = R - d;
          const ma = a.spec.mass, mb = b.spec.mass, tot = ma + mb;
          a.x += nx * pen * (mb / tot); a.z += nz * pen * (mb / tot);
          b.x -= nx * pen * (ma / tot); b.z -= nz * pen * (ma / tot);
          const rvx = a.vx - b.vx, rvz = a.vz - b.vz;
          const vn = rvx * nx + rvz * nz;
          if (vn >= 0) continue;
          const e = 0.55;
          const jimp = -(1 + e) * vn / (1 / ma + 1 / mb);
          a.vx += nx * jimp / ma; a.vz += nz * jimp / ma;
          b.vx -= nx * jimp / mb; b.vz -= nz * jimp / mb;
          // spin
          const rax = p[0] - a.x, raz = p[1] - a.z, rbx = q[0] - b.x, rbz = q[1] - b.z;
          a.w += (rax * nz - raz * nx) * jimp * 0.06;
          b.w -= (rbx * nz - rbz * nx) * jimp * 0.06;
          if (jimp > 6) this.events.push({ type: 'bump', car: a, other: b, strength: jimp, x: (p[0] + q[0]) / 2, z: (p[1] + q[1]) / 2 });
        }
      }
    }
  }

  stepDynamics(dt, cars) {
    const D = this.dynamics;
    for (const d of D) {
      if (d.state === 'sunk') {
        d.t += dt;
        if (d.t > (d.respawn ?? 6)) {
          // put it back home if nothing is there
          let free = true;
          for (const car of cars) if (Math.hypot(car.x - d.home[0], car.z - d.home[1]) < d.r + 3) free = false;
          if (free) { d.x = d.home[0]; d.z = d.home[1]; d.vx = d.vz = 0; d.state = 'live'; d.y = 0; d.t = 0; d.pop = 1; }
        }
        continue;
      }
      if (d.state === 'falling') {
        d.t += dt;
        d.vy = (d.vy ?? 0) - GRAVITY * dt;
        d.y = (d.y ?? 0) + d.vy * dt;
        d.x += d.vx * dt; d.z += d.vz * dt;
        d.vx *= Math.exp(-8 * dt); d.vz *= Math.exp(-8 * dt);
        if (d.y < -d.r * 3) { d.state = 'sunk'; d.t = 0; }
        continue;
      }
      // rolling friction
      const sp = Math.hypot(d.vx, d.vz);
      if (sp > 0) {
        const dec = (d.friction ?? 9) * dt;
        const k = sp <= dec ? 0 : (sp - dec) / sp;
        d.vx *= k; d.vz *= k;
      }
      d.x += d.vx * dt; d.z += d.vz * dt;
      d.rolled = Math.hypot(d.vx, d.vz) * dt;
      d.dirx = d.vx; d.dirz = d.vz;
      // static
      for (const c of this.colliders) {
        if (c.bb && (d.x + d.r < c.bb[0] || d.x - d.r > c.bb[2] || d.z + d.r < c.bb[1] || d.z - d.r > c.bb[3])) continue;
        const hit = this.circleVsCollider(d.x, d.z, d.r, c);
        if (!hit) continue;
        d.x += hit.nx * hit.pen; d.z += hit.nz * hit.pen;
        const vn = d.vx * hit.nx + d.vz * hit.nz;
        if (vn < 0) { const e = c.bounce ?? 0.6; d.vx -= (1 + e) * vn * hit.nx; d.vz -= (1 + e) * vn * hit.nz; if (-vn > 10) this.events.push({ type: 'clack', strength: -vn, x: d.x, z: d.z }); }
      }
      for (const h of this.holes) {
        if ((d.x - h.x) ** 2 + (d.z - h.z) ** 2 < (h.r * 0.85) ** 2) {
          d.state = 'falling'; d.t = 0; d.vy = 0; d.y = 0;
          d.vx = (h.x - d.x) * 4; d.vz = (h.z - d.z) * 4;
          this.events.push({ type: 'pocket', x: d.x, z: d.z, strength: 10 });
        }
      }
    }
    // dynamic vs dynamic
    for (let i = 0; i < D.length; i++) {
      const a = D[i]; if (a.state !== 'live') continue;
      for (let j = i + 1; j < D.length; j++) {
        const b = D[j]; if (b.state !== 'live') continue;
        const dx = a.x - b.x, dz = a.z - b.z, R = a.r + b.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1e-4, nx = dx / d, nz = dz / d, pen = R - d;
        const tot = a.m + b.m;
        a.x += nx * pen * b.m / tot; a.z += nz * pen * b.m / tot;
        b.x -= nx * pen * a.m / tot; b.z -= nz * pen * a.m / tot;
        const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (vn >= 0) continue;
        const jj = -(1 + 0.92) * vn / (1 / a.m + 1 / b.m);
        a.vx += nx * jj / a.m; a.vz += nz * jj / a.m;
        b.vx -= nx * jj / b.m; b.vz -= nz * jj / b.m;
        if (-vn > 6) this.events.push({ type: 'clack', strength: -vn, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
      }
    }
    // cars vs dynamic
    for (const car of cars) {
      if (car.state !== 'drive' || car.y > 2) continue;
      for (const d of D) {
        if (d.state !== 'live') continue;
        if (Math.abs(car.x - d.x) > d.r + 6 || Math.abs(car.z - d.z) > d.r + 6) continue;
        for (const p of car.circles()) {
          const dx = p[0] - d.x, dz = p[1] - d.z, R = car.spec.r + d.r;
          const d2 = dx * dx + dz * dz;
          if (d2 >= R * R) continue;
          const dd = Math.sqrt(d2) || 1e-4, nx = dx / dd, nz = dz / dd, pen = R - dd;
          const ma = car.spec.mass, mb = d.m, tot = ma + mb;
          car.x += nx * pen * mb / tot; car.z += nz * pen * mb / tot;
          d.x -= nx * pen * ma / tot; d.z -= nz * pen * ma / tot;
          const vn = (car.vx - d.vx) * nx + (car.vz - d.vz) * nz;
          if (vn >= 0) continue;
          const jj = -(1 + 0.5) * vn / (1 / ma + 1 / mb);
          car.vx += nx * jj / ma; car.vz += nz * jj / ma;
          d.vx -= nx * jj / mb; d.vz -= nz * jj / mb;
          const rx = p[0] - car.x, rz = p[1] - car.z;
          car.w += (rx * nz - rz * nx) * jj * 0.05;
          if (jj > 5) this.events.push({ type: 'bump', car, strength: jj, x: d.x, z: d.z, obj: true });
        }
      }
    }
  }
}
