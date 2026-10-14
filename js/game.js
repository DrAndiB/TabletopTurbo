// Game state: loading a world, the race loop, head-to-head elimination, race mode, scoring.
import * as THREE from '../vendor/three.bundle.js';
import { Track } from './track.js';
import { PhysicsWorld, Car, VEHICLES } from './physics.js';
import { buildCar, syncCar } from './cars.js';
import { AIDriver } from './ai.js';
import { makeKit } from './kit.js';
import { SkidMarks, Particles } from './fx.js';
import { PLAYER_COLORS, clamp, damp, wrapAngle } from './util.js';

const STEP = 1 / 120;

export class Game {
  constructor(renderer, input, sound, hud) {
    this.R = renderer; this.input = input; this.sound = sound; this.hud = hud;
    this.state = 'idle'; // idle | countdown | race | roundEnd | matchEnd | paused | attract
    this.world = null;
    this.cars = [];
    this.time = 0;
    this.acc = 0;
    this.tmpV = new THREE.Vector3();
    this.camX = 0; this.camZ = 0; this.camW = 90;
    this.onMatchEnd = null;
    this.debug = { freeze: false };
  }

  // ---------- world loading ----------
  async loadWorld(def, settings = {}) {
    this.unloadWorld();
    this.def = def;
    const track = new Track(def.track.points, { width: def.track.width ?? 14 });
    this.track = track;
    const physics = new PhysicsWorld(track, {
      bounds: def.bounds, fallOffEdges: def.fallOffEdges ?? true, floorY: def.floorY ?? -70, offroad: def.offroad || null,
    });
    this.physics = physics;
    const kit = makeKit({ scene: this.R.scene, track, physics, quality: this.R.quality, seed: def.seed ?? 7 });
    this.kit = kit;
    this.R.setLighting(def.lighting || {});
    await def.build(kit, settings);
    this.skids = new SkidMarks(kit.group);
    if (def.skidColor) this.skids.setColor(def.skidColor);
    this.particles = new Particles(kit.group);
    this.updateParticleScale();
    this.world = def;
    this.startS = def.track.startS ?? 0;
    this.camX = track.x[0]; this.camZ = track.z[0];
  }

  unloadWorld() {
    for (const c of this.cars) { this.R.scene.remove(c.model.root); this.R.scene.remove(c.model.shadow); }
    this.cars = [];
    if (this.kit) this.kit.dispose();
    this.kit = null; this.world = null;
  }

  updateParticleScale() {
    if (!this.particles) return;
    const h = this.R.renderer.domElement.height;
    this.particles.setScale(h / (2 * Math.tan(THREE.MathUtils.degToRad(this.R.camera.fov) / 2)));
  }

  // ---------- match setup ----------
  // drivers: [{type:'keys'|'simple'|'pad'|'touch'|'cpu', slot, pad, color}]
  startMatch({ drivers, mode = 'h2h', pointsToWin = 5, laps = 3, skill = 'normal' }) {
    for (const c of this.cars) { this.R.scene.remove(c.model.root); this.R.scene.remove(c.model.shadow); }
    this.mode = mode;
    this.pointsToWin = pointsToWin;
    this.laps = laps;
    this.skill = skill;
    const vtype = this.def.vehicle || 'sports';
    this.cars = drivers.map((d, i) => {
      const spec = { ...VEHICLES[vtype] };
      const car = new Car(spec, i);
      const colorDef = PLAYER_COLORS[d.color];
      const model = buildCar(vtype, colorDef, d.color + 1);
      this.R.scene.add(model.root); this.R.scene.add(model.shadow);
      const ent = {
        car, model, driver: d, color: colorDef, colorIndex: d.color, human: d.type !== 'cpu',
        name: d.type === 'cpu' ? `CPU ${colorDef.name}` : `${colorDef.name}`,
        points: 0, out: false, finished: false, finishTime: 0, place: 0,
        trackI: 0, trackS: 0, lap: 0, progress: 0, lastGoodS: 0, offT: 0, respawnT: 0, lateral: 0,
        ai: d.type === 'cpu' ? new AIDriver(car, this.track, this.physics, skill, i + 1) : null,
        lapStart: 0, bestLap: Infinity,
      };
      car.ent = ent;
      return ent;
    });
    this.sound.createEngines(this.cars.length);
    this.round = 0;
    this.raceTime = 0;
    this.finishOrder = [];
    this.placeGrid(this.startS, null);
    this.snapCamera();
    this.beginCountdown(true);
  }

  placeGrid(s0, front) {
    const order = [...this.cars];
    if (front) { order.splice(order.indexOf(front), 1); order.unshift(front); }
    const tr = this.track;
    order.forEach((e, k) => {
      const row = Math.floor(k / 2), col = k % 2;
      const s = s0 - row * 7.5 - col * 2.5;
      const w = tr.at(s).w;
      const lat = (col === 0 ? -1 : 1) * Math.min(3.2, w / 2 - 2.2);
      const p = tr.place(s, lat);
      e.car.place(p.x, p.z, p.angle);
      e.out = false; e.offT = 0; e.respawnT = 0;
      const n = tr.nearest(p.x, p.z);
      e.trackI = n.i; e.trackS = n.s; e.lastGoodS = n.s;
      // keep lap counting continuous
      e.progress = e.lap * tr.length + n.s;
      e.car.trackS = n.s;
      e.car.ghost = 0;
      if (e.ai) { e.ai.stuckT = 0; e.ai.reverseT = 0; e.ai.avoid = 0; }
      this.skids?.break(e.car.index + 'l'); this.skids?.break(e.car.index + 'r');
    });
  }

  beginCountdown(full) {
    this.state = 'countdown';
    this.countT = full ? 3.2 : 1.8;
    this.countFull = full;
    this.lastBeep = null;
    this.roundTime = 0;
    this.hud.message(full ? '' : 'Ready…', null);
  }

  snapCamera() {
    const f = this.cameraFocus();
    this.camX = f.x; this.camZ = f.z; this.camW = f.w;
    this.R.placeCamera(this.camX, this.camZ, this.camW);
  }

  // ---------- per-frame ----------
  update(dtReal) {
    if (!this.world) return;
    if (this.state === 'paused') { this.R.render(); return; }
    const dt = Math.min(dtReal, 0.05);
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 8) {
      this.fixedStep(STEP);
      this.acc -= STEP; steps++;
    }
    if (steps === 8) this.acc = 0;
    this.particles.update(dt);
    this.updateCamera(dt);
    this.updateVisuals(dt);
    this.updateAudio();
    this.hud.update(this);
    if (this.world.animate) this.world.animate(this.time, dt, this);
    this.R.render();
  }

  // Advance the simulation without rendering (used by automated tests).
  simulate(seconds) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) {
      this.fixedStep(STEP);
      if (i % 4 === 0) { this.particles.update(STEP * 4); this.updateCamera(STEP * 4); this.updateVisuals(STEP * 4); }
    }
    this.hud.update(this);
  }

  fixedStep(dt) {
    this.time += dt;
    const P = this.physics;
    const racing = this.state === 'race' || this.state === 'roundEnd' || this.state === 'attract';
    if (this.state === 'countdown') {
      const before = this.countT;
      this.countT -= dt;
      const n = Math.ceil(this.countT);
      if (this.countFull) {
        if (n !== this.lastBeep && n >= 1 && n <= 3) { this.lastBeep = n; this.sound.beep(false); this.hud.message(String(n), 'count'); }
      }
      if (before > 0 && this.countT <= 0) {
        this.state = 'race';
        this.sound.beep(true);
        this.hud.message('GO!', 'go');
        setTimeout(() => { if (this.state === 'race') this.hud.message('', null); }, 700);
      }
    }
    if (racing) { this.raceTime += dt; this.roundTime += dt; }

    // controls
    const allCars = this.cars.map((x) => x.car);
    for (const e of this.cars) {
      const c = e.car;
      if (e.finished && this.mode === 'race') {
        // cool-down lap: finished cars keep rolling on autopilot instead of parking on the racing line
        if (!e.cooldown) e.cooldown = e.ai || new AIDriver(c, this.track, this.physics, 'easy', 90 + e.colorIndex);
        e.cooldown.update(dt, allCars, { speedMul: 0.7 });
      } else if (e.ai) {
        e.ai.update(dt, allCars, { speedMul: this.aiSpeedMul(e) });
      } else {
        const ctl = this.input.read(e.driver);
        c.throttle = ctl.throttle; c.brake = ctl.brake; c.steer = ctl.steer;
      }
      if (!racing) { c.revs = c.throttle; c.throttle = 0; c.brake = 0; c.steer = 0; }
    }
    for (const e of this.cars) {
      if (e.out) continue;
      const c = e.car;
      if (!racing && c.state === 'drive') { c.vx = c.vz = c.w = 0; continue; } // held on the grid
      P.stepCar(c, dt, { lateral: e.lateral, trackW: this.track.w[e.trackI], speedMul: 1 });
    }
    P.collideCars(this.cars.filter((e) => !e.out).map((e) => e.car));
    P.stepDynamics(dt, this.cars.filter((e) => !e.out).map((e) => e.car));

    // track progress, off-course and respawn
    const tr = this.track;
    for (const e of this.cars) {
      if (e.out) continue;
      const c = e.car;
      if (c.state === 'drive') {
        const n = tr.nearest(c.x, c.z, e.trackI);
        let ds = n.s - e.trackS;
        if (ds < -tr.length / 2) { ds += tr.length; e.lap++; this.onLap(e); }
        else if (ds > tr.length / 2) { ds -= tr.length; e.lap--; }
        e.trackI = n.i; e.trackS = n.s; e.lateral = n.lateral;
        e.progress = e.lap * tr.length + n.s;
        c.trackS = n.s;
        const w = tr.w[n.i];
        const limit = w / 2 + (this.def.offCourse ?? 14);
        if (Math.abs(n.lateral) < w / 2 + 1 && !c.airborne) e.lastGoodS = n.s;
        if (Math.abs(n.lateral) > limit) e.offT += dt; else e.offT = Math.max(0, e.offT - dt * 2);
        if (e.offT > 1.6 && racing) { this.particles.emit(c.x, c.y + 1, c.z, { color: 0xffffff, n: 14, size: 2.2, life: 0.6, spread: 8, up: 4, grav: 0, grow: 2.5, alpha: 0.7 }); this.respawn(e); }
        c.groundY = c.y;
      } else if (c.state === 'falling') {
        e.respawnT += dt;
        if (e.respawnT > (c.fallKind === 'hole' ? 0.9 : 1.25)) this.respawn(e);
      }
    }

    // events -> sound + particles
    for (const ev of P.events) this.handleEvent(ev);
    P.events.length = 0;

    if (this.state === 'race') {
      if (this.mode === 'h2h') this.checkElimination(dt);
      else this.checkRace(dt);
    }
    if (this.state === 'roundEnd') {
      this.roundEndT -= dt;
      if (this.roundEndT <= 0) this.nextRound();
    }
  }

  aiSpeedMul(e) {
    if (this.mode !== 'h2h') return 1;
    // gentle catch-up: a leading CPU eases off slightly when humans are still in
    const humansIn = this.cars.some((x) => x.human && !x.out);
    if (!humansIn) return 1;
    const lead = this.leader();
    if (lead === e) return 0.95;
    return 1;
  }

  onLap(e) {
    if (this.mode !== 'race') return;
    const lapTime = this.raceTime - e.lapStart;
    if (e.lap > 0 && lapTime < e.bestLap) e.bestLap = lapTime;
    e.lapStart = this.raceTime;
    if (e.lap >= this.laps && !e.finished) {
      e.finished = true; e.finishTime = this.raceTime;
      this.finishOrder.push(e);
      e.place = this.finishOrder.length;
      if (e.human) { this.sound.roundWin(); this.hud.flash(`${e.name} finishes ${ordinal(e.place)}!`, e.color.hex); }
    } else if (e.human && e.lap > 0 && e.lap === this.laps - 1) {
      this.hud.flash('Final lap!', e.color.hex);
    }
  }

  respawn(e) {
    const c = e.car, tr = this.track;
    let s = e.lastGoodS - 3;
    // find a free spot (not on top of another car)
    let lat = 0;
    for (const tryLat of [0, -3.5, 3.5, -6, 6]) {
      const p = tr.place(s, tryLat);
      if (!this.cars.some((o) => o !== e && !o.out && o.car.state === 'drive' && Math.hypot(o.car.x - p.x, o.car.z - p.z) < 4.5)) { lat = tryLat; break; }
    }
    const p = tr.place(s, lat);
    c.place(p.x, p.z, p.angle);
    c.ghost = 1.2;
    e.offT = 0; e.respawnT = 0;
    const n = tr.nearest(p.x, p.z, e.trackI);
    let ds = n.s - e.trackS;
    if (ds < -tr.length / 2) e.lap++; else if (ds > tr.length / 2) e.lap--;
    e.trackI = n.i; e.trackS = n.s; c.trackS = n.s;
    this.skids.break(c.index + 'l'); this.skids.break(c.index + 'r');
    this.particles.emit(p.x, 1, p.z, { color: 0xffffff, n: 10, size: 2, life: 0.5, spread: 6, up: 3, grav: 0, grow: 2.5, alpha: 0.6 });
  }

  handleEvent(ev) {
    const S = this.sound;
    const pan = ev.car ? this.panOf(ev.car.x, ev.car.z) : (ev.x != null ? this.panOf(ev.x, ev.z) : 0);
    const onScreen = ev.car ? this.onScreen(ev.car.x, ev.car.y, ev.car.z, 0.2) : true;
    if (!onScreen) return;
    switch (ev.type) {
      case 'hit': S.bump(ev.strength, pan); this.sparks(ev.car, ev.strength); break;
      case 'bump': S.bump(ev.strength * 0.8, pan); if (ev.obj && this.def.clackOnBump) S.clack(ev.strength, pan); break;
      case 'clack': S.clack(ev.strength, pan); break;
      case 'land': S.thud(ev.strength); this.particles.emit(ev.car.x, 0.3, ev.car.z, { color: this.def.dustColor ?? 0xe8e0d0, n: 8, size: 1.4, life: 0.5, spread: 10, up: 2, grav: 4, grow: 1.6, alpha: 0.5 }); break;
      case 'jump': S.jump(); break;
      case 'fall': if (ev.kind === 'hole') S.plop(); else S.fall(); break;
      case 'pocket': S.plop(); break;
    }
  }

  sparks(car, strength) {
    if (strength < 12) return;
    this.particles.emit(car.x, car.y + 0.8, car.z, { color: 0xfff2c0, n: Math.min(10, strength / 3 | 0), size: 0.5, life: 0.25, spread: 25, up: 8, grav: 60, alpha: 1 });
  }

  // ---------- head-to-head ----------
  aliveCars() { return this.cars.filter((e) => !e.out); }
  leader(list = this.aliveCars()) {
    let best = null;
    for (const e of list) if (!best || e.progress > best.progress) best = e;
    return best;
  }

  onScreen(x, y, z, margin = 0) {
    const p = this.R.project(x, y, z, this.tmpV);
    return p.z < 1 && Math.abs(p.x) <= 1 + margin && Math.abs(p.y) <= 1 + margin;
  }

  checkElimination() {
    const alive = this.aliveCars();
    for (const e of alive) {
      const c = e.car;
      // only judged while driving or falling on screen; a respawned car off screen is out too
      const off = !this.onScreen(c.x, Math.max(0, c.y), c.z, 0.04);
      if (off && c.state !== 'hidden') {
        e.out = true; c.state = 'out';
        this.sound.out();
        this.hud.flash(`${e.name} is out!`, e.color.hex);
      }
    }
    let still = this.aliveCars();
    // every human is out but several CPU cars remain: give the round to the leading CPU after a short moment
    const hasHumans = this.cars.some((e) => e.human);
    if (hasHumans && still.length > 1 && !still.some((e) => e.human)) {
      this.cpuOnlyT = (this.cpuOnlyT || 0) + STEP;
      if (this.cpuOnlyT > 2.2) still = [this.leader(still)];
    } else this.cpuOnlyT = 0;
    if (still.length <= 1) {
      this.cpuOnlyT = 0;
      const w = still[0] || null;
      this.state = 'roundEnd';
      this.roundEndT = 2.6;
      this.roundWinner = w;
      if (w) {
        w.points++;
        this.sound.roundWin();
        this.hud.message(`${w.name} wins the round`, 'round', w.color.hex);
      } else {
        this.hud.message('Nobody survived!', 'round');
      }
      this.lastRoundS = w ? w.trackS : (this.leader(this.cars)?.trackS ?? this.startS);
    }
  }

  nextRound() {
    const champ = this.cars.find((e) => e.points >= this.pointsToWin);
    if (champ) return this.endMatch(champ);
    this.round++;
    for (const e of this.cars) { e.out = false; e.car.state = 'drive'; }
    // everybody restarts where the round was won, on the same lap count
    const s0 = this.lastRoundS + 4;
    const lap = this.roundWinner ? this.roundWinner.lap : 0;
    for (const e of this.cars) e.lap = lap;
    this.placeGrid(s0, this.roundWinner);
    this.snapCamera();
    this.hud.message('', null);
    this.beginCountdown(false);
  }

  // ---------- race ----------
  checkRace() {
    const humans = this.cars.filter((e) => e.human);
    const done = humans.length ? humans.every((e) => e.finished) : this.cars.every((e) => e.finished);
    // humans that fall too far behind the shared screen get pulled forward
    if (humans.length > 1) {
      for (const e of humans) {
        if (e.finished || e.car.state !== 'drive') continue;
        if (!this.onScreen(e.car.x, e.car.y, e.car.z, 0.02)) {
          const lead = this.leader(humans.filter((h) => !h.finished)) || e;
          e.lastGoodS = lead.trackS - 10;
          e.lap = lead.lap - (lead.trackS - 10 < 0 ? 1 : 0);
          this.respawn(e);
          this.raceTime += 0; // no time penalty beyond the lost ground
        }
      }
    }
    if (done && !this.raceDoneT) this.raceDoneT = 1.5;
    if (this.raceDoneT) {
      this.raceDoneT -= STEP;
      if (this.raceDoneT <= 0) {
        this.raceDoneT = 0;
        // rank the rest by progress
        const rest = this.cars.filter((e) => !e.finished).sort((a, b) => b.progress - a.progress);
        for (const e of rest) { this.finishOrder.push(e); e.place = this.finishOrder.length; }
        this.endMatch(this.finishOrder[0]);
      }
    }
  }

  endMatch(winner) {
    this.state = 'matchEnd';
    this.sound.silenceEngines();
    this.sound.matchWin();
    const standings = this.mode === 'h2h'
      ? [...this.cars].sort((a, b) => b.points - a.points)
      : [...this.finishOrder];
    this.hud.message('', null);
    if (this.onMatchEnd) this.onMatchEnd({ winner, standings, mode: this.mode });
  }

  // ---------- camera ----------
  cameraFocus() {
    if (this.camOverride) return this.camOverride;
    const tr = this.track;
    const baseW = this.R.camera.aspect < 1 ? 70 : 88;
    if (this.mode === 'h2h' || this.state === 'attract') {
      const L = this.leader() || this.cars[0];
      if (!L) return { x: tr.x[0], z: tr.z[0], w: baseW };
      const c = L.car;
      const ahead = tr.at(L.trackS + 13);
      // look toward where the leader is heading on the track
      let x = c.x * 0.55 + ahead.x * 0.45, z = c.z * 0.55 + ahead.z * 0.45;
      let w = baseW;
      // after a long round the view slowly closes in to force a result
      if (this.state === 'race' && this.roundTime > 40) w = baseW - Math.min(32, (this.roundTime - 40) * 1.1);
      return { x, z, w };
    }
    // race: frame the human drivers
    const humans = this.cars.filter((e) => e.human && !e.finished);
    const list = humans.length ? humans : this.cars.filter((e) => e.human);
    const focus = list.length ? list : [this.leader(this.cars)];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, sx = 0, sz = 0;
    for (const e of focus) {
      const a = tr.at(e.trackS + 10);
      const fx = e.car.x * 0.6 + a.x * 0.4, fz = e.car.z * 0.6 + a.z * 0.4;
      minX = Math.min(minX, fx); maxX = Math.max(maxX, fx); minZ = Math.min(minZ, fz); maxZ = Math.max(maxZ, fz);
      sx += fx; sz += fz;
    }
    const spread = Math.max(maxX - minX, (maxZ - minZ) * this.R.camera.aspect);
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, w: clamp(spread * 1.25 + 20, baseW * 0.9, 150) };
  }

  updateCamera(dt) {
    const f = this.cameraFocus();
    const rate = this.camOverride ? 1000 : this.state === 'countdown' ? 6 : 3.2;
    this.camX = damp(this.camX, f.x, rate, dt);
    this.camZ = damp(this.camZ, f.z, rate, dt);
    this.camW = damp(this.camW, f.w, 2, dt);
    this.R.placeCamera(this.camX, this.camZ, this.camW);
  }

  // ---------- visuals & audio ----------
  updateVisuals(dt) {
    // pushable objects: rolling balls and sliding cubes
    for (const d of this.physics.dynamics) {
      const m = d.mesh;
      if (!m) continue;
      m.visible = d.state !== 'sunk';
      if (d.pop) { d.pop = Math.max(0, d.pop - dt * 3); m.scale.setScalar(1 - d.pop * 0.9); } else if (m.scale.x !== 1 && !d.keepScale) m.scale.setScalar(1);
      m.position.set(d.x, (d.baseY ?? d.r) + (d.y || 0), d.z);
      const sp = Math.hypot(d.vx, d.vz);
      if (sp > 0.01) {
        if (d.slide) m.rotation.y += (d.spin ?? 0.08) * sp * dt * (d.spinDir || (d.spinDir = Math.random() < 0.5 ? -1 : 1));
        else {
          // roll around the axis perpendicular to motion
          const ang = (sp * dt) / d.r;
          this._axis = this._axis || new THREE.Vector3();
          this._q = this._q || new THREE.Quaternion();
          this._axis.set(d.vz / sp, 0, -d.vx / sp);
          this._q.setFromAxisAngle(this._axis, ang);
          m.quaternion.premultiply(this._q);
        }
      }
    }
    for (const e of this.cars) {
      const c = e.car, m = e.model;
      syncCar(m, c, this.time);
      // ghost blink after respawn
      if (c.ghost > 0 && c.state === 'drive') m.root.visible = Math.floor(this.time * 14) % 2 === 0;
      if (c.state !== 'drive' || c.airborne) { this.skids.break(c.index + 'l'); this.skids.break(c.index + 'r'); continue; }
      const sp = c.speed;
      // skid marks from the rear wheels when sliding or braking hard
      const skid = clamp((c.slip - 8) / 20, 0, 1) + (c.brake > 0.5 && sp > 20 ? 0.35 : 0) + (c.surface === 'slick' ? 0.1 : 0);
      const cs = Math.cos(c.angle), sn = Math.sin(c.angle);
      const bx = c.x - cs * c.spec.axle * 1.1, bz = c.z - sn * c.spec.axle * 1.1;
      const wz = c.spec.wid * 0.45;
      if (skid > 0.05 && c.surface !== 'water') {
        this.skids.add(c.index + 'l', bx - sn * wz, c.y, bz + cs * wz, 0.45, skid);
        this.skids.add(c.index + 'r', bx + sn * wz, c.y, bz - cs * wz, 0.45, skid);
      } else { this.skids.break(c.index + 'l'); this.skids.break(c.index + 'r'); }
      // surface particles
      const dust = this.def.dust?.[c.surface] ?? (c.surface === 'normal' ? this.def.dust?.normal : null);
      if (dust && sp > 12 && Math.random() < dt * (sp / 6) * (dust.rate ?? 1)) {
        this.particles.emit(bx, 0.4, bz, { color: dust.color, size: dust.size ?? 1.2, life: dust.life ?? 0.6, spread: 4, up: dust.up ?? 2, grav: dust.grav ?? 3, grow: dust.grow ?? 1.8, alpha: dust.alpha ?? 0.5, vx: -c.vx * 0.15, vz: -c.vz * 0.15 });
      }
      if (skid > 0.4 && Math.random() < dt * 20 && this.def.smoke !== false) {
        this.particles.emit(bx, 0.4, bz, { color: 0xdddddd, size: 1.4, life: 0.5, spread: 3, up: 1.5, grav: -1, grow: 2.2, alpha: 0.28 });
      }
    }
  }

  panOf(x, z) {
    const p = this.R.project(x, 0, z, this.tmpV);
    return clamp(p.x, -1, 1);
  }

  updateAudio() {
    const S = this.sound;
    if (!S.ctx) return;
    this.cars.forEach((e, i) => {
      const c = e.car;
      const vis = !e.out && c.state === 'drive';
      const vol = vis ? (e.human ? 1 : 0.55) * (this.onScreen(c.x, c.y, c.z, 0.3) ? 1 : 0.3) : 0;
      S.updateEngine(i, Math.abs(c.fwdSpeed) / c.spec.maxSpeed, this.state === 'countdown' ? (e.human ? this.input.read(e.driver).throttle : 0.3) : c.throttle, c.airborne ? 0 : c.slip, this.panOf(c.x, c.z), vol);
    });
  }

  pause(on) {
    if (on && (this.state === 'race' || this.state === 'countdown' || this.state === 'roundEnd')) {
      this.prevState = this.state; this.state = 'paused'; this.sound.silenceEngines();
      return true;
    }
    if (!on && this.state === 'paused') { this.state = this.prevState; this.acc = 0; return true; }
    return false;
  }

  // Attract mode: CPU cars racing behind the menu.
  startAttract() {
    this.startMatch({ drivers: [0, 1, 2, 3].map((i) => ({ type: 'cpu', color: i })), mode: 'h2h', pointsToWin: 99, skill: 'hard' });
    this.state = 'attract';
    this.sound.silenceEngines();
    this.hud.message('', null);
  }
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
