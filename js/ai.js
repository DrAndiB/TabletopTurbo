// CPU drivers: follow a racing line, slow for corners, steer round obstacles and recover when stuck.
import { clamp, wrapAngle, rng } from './util.js';
import { DRIFT } from './physics.js';

export const SKILLS = {
  // drift: chance of sliding through a corner where a drift car can (Drift Cup)
  easy: { speed: 0.8, corner: 0.8, wobble: 0.35, mistakes: 0.06, drift: 0.35 },
  normal: { speed: 0.9, corner: 0.9, wobble: 0.15, mistakes: 0.03, drift: 0.75 },
  hard: { speed: 0.985, corner: 1.0, wobble: 0.04, mistakes: 0.008, drift: 0.95 },
};

export class AIDriver {
  constructor(car, track, physics, skillName = 'normal', seed = 1) {
    this.car = car; this.track = track; this.physics = physics;
    this.skill = SKILLS[skillName] || SKILLS.normal;
    this.r = rng(seed * 977 + 13);
    this.phase = this.r() * 100;
    this.personal = (this.r() - 0.5) * 0.6; // preferred side
    this.stuckT = 0; this.reverseT = 0; this.reverseSteer = 0;
    this.mistakeT = 0; this.mistakeSteer = 0;
    this.avoid = 0;
  }

  lineOffset(s) {
    const tr = this.track;
    // average curvature ahead -> move to the inside of the coming corner
    let k = 0;
    for (let d = 0; d <= 16; d += 4) k += tr.curv[tr.idx(s + d)];
    k /= 5;
    const half = tr.w[tr.idx(s)] / 2 - this.car.spec.r - 1.0;
    const wave = Math.sin(s / 37 + this.phase) * 0.25 + this.personal;
    return clamp(k * 70 + wave * half, -half, half);
  }

  blocked(x, z, rad) {
    const P = this.physics;
    for (const c of P.colliders) {
      if (c.h < 1.2 || (c.bb && (x + rad < c.bb[0] || x - rad > c.bb[2] || z + rad < c.bb[1] || z - rad > c.bb[3]))) continue;
      if (P.circleVsCollider(x, z, rad, c)) return true;
    }
    for (const d of P.dynamics) {
      if (d.state === 'live' && (x - d.x) ** 2 + (z - d.z) ** 2 < (rad + d.r) ** 2) return true;
    }
    for (const h of P.holes) if (h.open !== false && (h.hw != null ? P.inHole({ ...h, hw: h.hw + rad, hd: h.hd + rad }, x, z) : (x - h.x) ** 2 + (z - h.z) ** 2 < (rad + h.r) ** 2)) return true;
    return false;
  }

  hazard(x, z) {
    const k = this.physics.surfaceAt(x, z, 0, 99);
    return k === 'slick' || k === 'sticky' || k === 'water';
  }

  update(dt, cars, opts = {}) {
    const car = this.car, tr = this.track, sk = this.skill;
    if (car.state !== 'drive') { car.throttle = car.brake = car.steer = 0; return; }
    const speed = Math.max(0, car.fwdSpeed);
    const s = car.trackS ?? 0;

    // recovering from being stuck
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      car.throttle = 0; car.brake = 1; car.steer = this.reverseSteer;
      return;
    }

    const look = 6 + speed * 0.28;
    let off = this.lineOffset(s + look);
    // obstacle / hazard probing along the line ahead
    const half = tr.w[tr.idx(s + look)] / 2 - car.spec.r - 0.6;
    let shift = 0;
    for (let d = 5; d <= 22; d += 4.5) {
      const base = this.lineOffset(s + d) + this.avoid;
      const p = tr.place(s + d, base);
      if (this.blocked(p.x, p.z, car.spec.r + 0.8) || this.hazard(p.x, p.z)) {
        // pick the clearer side
        let best = null;
        for (const o of [3.5, -3.5, 6.5, -6.5, 9.5, -9.5]) {
          const q = tr.place(s + d, clamp(base + o, -half - 2, half + 2));
          if (!this.blocked(q.x, q.z, car.spec.r + 1.0) && !this.hazard(q.x, q.z)) { best = o; break; }
        }
        if (best !== null) { shift = best; break; }
      }
    }
    // overtaking: car right ahead, slower
    for (const o of cars) {
      if (o === car || o.state !== 'drive') continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const ahead = dx * Math.cos(car.angle) + dz * Math.sin(car.angle);
      const side = -dx * Math.sin(car.angle) + dz * Math.cos(car.angle);
      if (ahead > 0 && ahead < 9 && Math.abs(side) < 2.6 && o.fwdSpeed < speed - 2) {
        shift += side > 0 ? -2.6 : 2.6;
      }
    }
    this.avoid += (shift - this.avoid) * (1 - Math.exp(-(shift !== 0 ? 6 : 1.5) * dt));
    off = clamp(off + this.avoid, -half - 1.5, half + 1.5);

    const tgt = tr.place(s + look, off);
    const want = Math.atan2(tgt.z - car.z, tgt.x - car.x);
    let diff = wrapAngle(want - car.angle);
    let steer = clamp(diff * 2.6 - car.w * 0.12, -1, 1);

    // knocked loose by a crash: no mistakes, steer towards the line (which counters the slide),
    // keep a bit of throttle so the car doesn't stall, and don't count it as stuck
    if (car.stun > 0.06) {
      this.mistakeT = 0; this.stuckT = 0;
      car.steer = clamp(diff * 2.2, -1, 1);
      car.throttle = Math.abs(diff) > 1.3 ? 0.35 : 0.75;
      car.brake = 0;
      return;
    }

    if (car.spec.drift && this.driftDrive(dt, speed, s, tgt)) return;

    // occasional small mistakes
    this.mistakeT -= dt;
    if (this.mistakeT <= 0 && this.r() < sk.mistakes * dt * 10) { this.mistakeT = 0.25 + this.r() * 0.35; this.mistakeSteer = this.r() < 0.5 ? -1 : 1; }
    if (this.mistakeT > 0) steer = clamp(steer + this.mistakeSteer * 0.7, -1, 1);
    steer += Math.sin(performance.now() / 300 + this.phase) * sk.wobble * 0.15;

    // target speed from the tightest curve ahead
    let kmax = 0;
    const span = 8 + speed * 0.9;
    for (let d = 0; d <= span; d += 2) kmax = Math.max(kmax, Math.abs(tr.curv[tr.idx(s + d)]));
    const sp = car.spec;
    // speedMul: straight-line pace (catch-up, slipstream, turbo); paceMul < 1 also eases off in corners
    const pace = Math.min(1, opts.paceMul ?? 1);
    const vCurve = kmax > 1e-4 ? pace * Math.min(Math.sqrt((sp.latGrip * 0.82 * sk.corner) / kmax), (sp.turnRate * 0.78 * sk.corner) / kmax) : 999;
    let vTarget = Math.min(sp.maxSpeed * sk.speed * (opts.speedMul ?? 1), vCurve);
    if (Math.abs(diff) > 0.9) vTarget = Math.min(vTarget, 14);
    if (car.surface === 'slick') vTarget = Math.min(vTarget, 22);

    car.steer = clamp(steer, -1, 1);
    if (speed > vTarget + 3) { car.throttle = 0; car.brake = clamp((speed - vTarget) / 10, 0.3, 1); }
    else if (speed > vTarget) { car.throttle = 0.2; car.brake = 0; }
    else { car.throttle = 1; car.brake = 0; }

    // stuck detection
    this.stuckCheck(dt, speed, diff);
  }

  stuckCheck(dt, speed, diff) {
    const car = this.car;
    if (car.throttle > 0.5 && speed < 2.5) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
    if (this.stuckT > 0.9) {
      this.stuckT = 0; this.reverseT = 0.75 + this.r() * 0.3;
      this.reverseSteer = diff > 0 ? -1 : 1;
    }
  }

  // Drift cars: slide through the bigger corners (a brake tap while steering), steer the slide so its path
  // reaches the racing line, steer out when the corner is over (that fires the boost). Returns true when it
  // drove the car this step.
  driftDrive(dt, speed, s, tgt) {
    const car = this.car, tr = this.track, sp = car.spec, d = car.drift;
    this.driftCool = Math.max(0, (this.driftCool || 0) - dt);
    car.noDriftTap = true; // braking for a corner is not a drift unless decided below
    if (d) {
      const th = Math.atan2(car.vz, car.vx), v = Math.hypot(car.vx, car.vz);
      const dx = tgt.x - car.x, dz = tgt.z - car.z, L = Math.max(4, Math.hypot(dx, dz));
      // pure pursuit on the path (not the body, which points into the corner): the turn rate that reaches tgt
      const want = (2 * v * Math.sin(wrapAngle(Math.atan2(dz, dx) - th))) / L;
      const g = Math.min(1, v / 9) * (1 - 0.32 * Math.min(1, v / sp.maxSpeed));
      const q = (want * d.dir) / Math.max(0.1, sp.turnRate * g); // share of the grip turn rate, into the slide
      // the corner is over when the road ahead has stopped turning our way and the slide points down it
      let ahead = 0;
      for (let x = 2; x <= 14; x += 2) ahead += tr.curv[tr.idx(s + x)] * 2 * d.dir;
      const align = Math.abs(wrapAngle(tr.at(s + 8).angle - th));
      // ...or when the slide turns far tighter than the line wants, or has run off the inside of the road
      const p = tr.at(s), lat = (car.x - p.x) * p.nx + (car.z - p.z) * p.nz;
      const inside = lat * d.dir > tr.w[tr.idx(s)] / 2 - 0.5;
      if (d.t > 0.35 && ahead < 0.1 && (align < 0.2 || q < 0.1)) car.steer = -d.dir; // steer out (boost)
      else if (d.t > 0.2 && (q < -0.1 || inside)) car.steer = -d.dir;
      else car.steer = d.dir * clamp((q - DRIFT.turn[0]) / DRIFT.turn[1], -0.28, 1);
      car.throttle = 1;
      car.brake = q > DRIFT.turn[0] + DRIFT.turn[1] + 0.2 && v > 24 ? 0.5 : 0; // too fast for the corner: scrub speed
      this.stuckT = 0;
      return true;
    }
    // start a slide at the entry of a corner that turns far enough
    if (this.driftCool > 0 || speed < 26 || car.stun > 0 || car.airborne) return false;
    let turn = 0, near = 0;
    for (let x = 4; x <= 34; x += 2) { const k = tr.curv[tr.idx(s + x)] * 2; turn += k; if (x <= 12) near += k; }
    if (Math.abs(turn) < 0.75 || Math.abs(near) < 0.12 || Math.sign(near) !== Math.sign(turn)) return false;
    if (car.brakePrev > 0.3) { car.brake = 0; car.throttle = 0.6; car.steer = Math.sign(turn); return true; } // let go first
    this.driftCool = 1.2;
    if (this.r() > this.skill.drift) return false;
    car.steer = Math.sign(turn); car.throttle = 1; car.brake = 1; car.noDriftTap = false; // the tap (the next step lets go)
    return true;
  }
}
