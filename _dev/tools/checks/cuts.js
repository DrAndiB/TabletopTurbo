/* Shortcut scanner. For every pair of road positions it looks for a straight line across the infield that gains
   track distance (centreline distance minus the cost of the cut line, off-road surfaces counted slower) while the
   engine would not catch it: no single jump of the nearest road point beyond maxShortcut, not more than 1.6 s past
   offCourse, under the off-road gain limit (CUT in game.js), and nothing in the way (colliders, raised decks or
   steps, open holes, the table edge or bounds walls).
   The best candidates are then driven for real: from 40 units before the corner the road is driven twice (the CPU
   driver, and flat out along the CPU line; the better time counts), then a scripted car takes the cut line from
   the same spot and moment (four tries, leaving the road at different points); the report gives the time gained.
   Query options: ids=watchmaker,desk (default: every world in the menu; ids not in the menu load via worldById),
   gain=15 (minimum distance gain), top=4 (candidates per world), confirm=0 (scan only), cut=0 (switch off the
   engine's off-road gain rule, CUT in game.js, to see what only the maxShortcut jump rule catches).
   Output per candidate: s from→to (relative to the start line), gain over the centreline/over the inside line,
   the biggest nearest-road jump, how far off the road it goes, the line in world x,z, then the test drive:
   road time, cut time and the difference, or "caught n/4" when every attempt was caught. tt.py prints the first
   4000 characters, so run a few worlds at a time.
   bash:       python tt.py "quality=low&ids=watchmaker" "js:$(cat checks/cuts.js | tr '\n' ' ')"
   PowerShell: python tt.py "quality=low&ids=watchmaker" ("js:" + ((Get-Content checks\cuts.js) -join ' '))
   An exploit is a candidate that is not caught and gains more than 0.3 s. Comments use block syntax because the
   script is joined into one line. */
(async () => {
  const { WORLDS, worldById } = await import(new URL('js/worlds/index.js', location.href).href);
  const { VEHICLES } = await import(new URL('js/physics.js', location.href).href);
  const { CUT } = await import(new URL('js/game.js', location.href).href);
  const Q = new URLSearchParams(location.search);
  const ids = (Q.get('ids') || '').split(',').filter(Boolean);
  const defs = ids.length ? ids.map((id) => { const d = worldById(id); return d && d.id === id ? d : null; }) : WORLDS;
  const MIN_GAIN = +(Q.get('gain') || 15), TOP = +(Q.get('top') || 4), CONFIRM = Q.get('confirm') !== '0', NOCUT = Q.get('cut') === '0';
  const TOPF = { normal: 1, slick: 1, sticky: 0.45, slow: 0.62, rough: 0.8, water: 0.7 };
  const g = __tt.game, out = [];
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  function scan(def) {
    const tr = g.track, P = g.physics, L = tr.length, limit = def.maxShortcut ?? 45, offC = def.offCourse ?? 14;
    const cutMax = CUT ? def.maxCutGain ?? CUT.gain : Infinity;
    const sp = VEHICLES[def.vehicle || 'sports'];
    const topOf = (k) => {
      let t = TOPF[k] ?? 1;
      if (k === 'slow' && sp.offroadGrip) t = Math.min(1, t + 0.2);
      if (sp.hover && (k === 'water' || k === 'slow' || k === 'sticky' || k === 'rough')) t = Math.max(t, 0.92);
      return t;
    };
    const STEP = 2, M = Math.floor(L / STEP), rad = sp.r * 0.9;
    const pts = [];
    for (let k = 0; k < M; k++) pts.push(tr.at(k * STEP));
    const inside = new Float64Array(M + 1);
    for (let k = 0; k < M; k++) { const p = pts[k]; inside[k + 1] = inside[k] + STEP * Math.max(0.35, 1 - Math.abs(p.curv) * (p.w / 2 - 1.5)); }
    const insideLen = (a, n) => { let s = 0; for (let j = 0; j < n; j++) { const k = (a + j) % M; s += inside[k + 1] - inside[k]; } return s; };
    const edge = (p, tx, tz) => { const side = Math.sign(p.nx * (tx - p.x) + p.nz * (tz - p.z)) || 1, o = side * (p.w / 2 - 1.5); return [p.x + p.nx * o, p.z + p.nz * o]; };
    const cands = [];
    for (let a = 0; a < M; a++) {
      const pa = pts[a];
      for (let n = 10; n <= Math.min(200, M / 2); n++) {
        const b = (a + n) % M, pb = pts[b], ds = n * STEP;
        const [ax, az] = edge(pa, pb.x, pb.z), [bx, bz] = edge(pb, pa.x, pa.z);
        const len = Math.hypot(bx - ax, bz - az);
        if (ds - len <= MIN_GAIN) continue;
        /* walk the line like a car at ~40 units/s, then 30 units on along the road, the way the engine tracks a car:
           nearest-point jumps, off-course time, surfaces; the tracked road point has to arrive where the car is */
        const steps = Math.max(2, Math.ceil(len / 0.5)), h = len / steps, run = 60;
        let hint = tr.nearest(ax, az).i, prevS = hint * tr.ds, maxJump = 0, offT = 0, maxOffT = 0, cost = 0, maxLat = 0, cutG = 0;
        let ok = true;
        for (let i = 1; i <= steps + run; i++) {
          let x, z;
          if (i <= steps) { x = ax + (bx - ax) * i / steps; z = az + (bz - az) * i / steps; }
          else { const q = tr.at(b * STEP + (i - steps) * 0.5); x = q.x; z = q.z; }
          const nn = tr.nearest(x, z, hint);
          let skip = nn.s - prevS; if (skip > L / 2) skip -= L; else if (skip < -L / 2) skip += L;
          maxJump = Math.max(maxJump, Math.abs(skip));
          if (Math.abs(skip) > limit) { ok = false; break; }
          prevS = nn.s; hint = nn.i;
          const w = tr.w[nn.i], lat = Math.abs(nn.lateral);
          const k = P.surfaceAt(x, z, nn.lateral, w);
          const dt = (i <= steps ? h : 0.5) / (40 * topOf(k));
          if (i <= steps) { maxLat = Math.max(maxLat, lat - w / 2); cost += h / topOf(k); }
          if (lat > w / 2 + offC) offT += dt; else offT = Math.max(0, offT - 2 * dt);
          maxOffT = Math.max(maxOffT, offT);
          if (offT > 1.6) { ok = false; break; }
          /* the engine's off-road gain rule (CUT in game.js) */
          if (CUT && lat > w / 2 + CUT.margin) cutG = Math.max(0, cutG + skip - (i <= steps ? h : 0.5) * (1 + CUT.slack));
          else if (CUT) cutG = Math.max(0, cutG - CUT.decay * dt);
          if (cutG > cutMax) { ok = false; break; }
        }
        if (ok && Math.abs(wrapS(prevS - (b * STEP + run * 0.5), L)) > 6) ok = false; /* still tracked on the old leg */
        if (!ok || maxLat < 1.5) continue; /* caught, or never leaves the road: a racing line, not a cut */
        const gain = ds - cost;
        if (gain <= MIN_GAIN) continue;
        cands.push({ a: a * STEP, b: b * STEP, ds, len, cost, gain, vsInside: insideLen(a, n) - cost, maxJump, maxLat, offT: maxOffT, ax, az, bx, bz });
      }
    }
    /* drop candidates whose line is blocked; cluster the rest per corner */
    cands.sort((p, q) => q.gain - p.gain);
    const picked = [];
    for (const c of cands) {
      if (picked.some((p) => Math.abs(wrapS(p.a - c.a, L)) < 30 && Math.abs(wrapS(p.b - c.b, L)) < 30)) continue;
      const why = blocked(c, sp, rad);
      if (why) { c.blocked = why; continue; }
      picked.push(c);
      if (picked.length >= TOP) break;
    }
    return picked;
  }
  function wrapS(d, L) { d %= L; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; }

  function travels(col) {
    if (col.travels == null) {
      const p = [0, 0.7, 1.9, 3.1, 5.3].map((t) => col.moverFn(t));
      col.travels = p.some((q) => (q.x ?? q.x1) !== (p[0].x ?? p[0].x1) || (q.z ?? q.z1) !== (p[0].z ?? p[0].z1) || (q.x2 ?? 0) !== (p[0].x2 ?? 0) || (q.z2 ?? 0) !== (p[0].z2 ?? 0) || q.h !== p[0].h);
    }
    return col.travels;
  }

  function blocked(c, sp, rad) {
    const P = g.physics, steps = Math.max(2, Math.ceil(c.len / 0.5));
    let y = P.groundAt(c.ax, c.az).g;
    for (let i = 0; i <= steps; i++) {
      const x = c.ax + (c.bx - c.ax) * i / steps, z = c.az + (c.bz - c.az) * i / steps;
      const gr = P.groundAt(x, z).g;
      if (gr > y + (sp.stepUp ?? 0.9)) return 'step';
      y = gr;
      if (P.fallOffEdges ? !P.insideBounds(x, z) : (P.bounds && !P.insideBounds(x, z))) return 'edge';
      for (const h of P.holes) if (h.open !== false && P.inHole(h, x, z, 0.4)) return 'hole';
      for (const col of P.colliders) {
        if (col.moverFn && travels(col)) continue; /* a mover that turns in place (a wheel) still blocks */
        if (y >= col.h - 0.2 || (sp.clearance && col.h <= sp.clearance && !col.solid)) continue;
        if (col.bb && (x + rad < col.bb[0] || x - rad > col.bb[2] || z + rad < col.bb[1] || z - rad > col.bb[3])) continue;
        if (P.circleVsCollider(x, z, rad, col)) return 'collider';
      }
      for (const s of P.spinners) if (s.h >= 0.9 && y < s.h - 0.6 && (x - s.x) ** 2 + (z - s.z) ** 2 < (s.r + rad) ** 2) return 'deck';
    }
    return null;
  }

  /* drive it: the CPU on the road vs a scripted car on the cut line, both from 40 units before the corner */
  function drive(c, mode, leave) {
    const tr = g.track, L = tr.length, e = g.cars[0], car = e.car, ai = e.ai;
    g.time = 1000; g.state = 'race'; g.raceTime = 10;
    e.lastGoodS = c.a - 40 + 3; e.progress = 5 * L + g.relS(c.a - 40);
    g.respawn(e);
    car.ghost = 0;
    const p = tr.at(c.a - 40); car.vx = p.tx * 30; car.vz = p.tz * 30; car.w = 0;
    const p0 = e.progress, goal = p0 + 40 + c.ds + 25;
    let phase = mode === 'road' ? 'ai' : mode === 'brave' ? 'brave' : 'in', resp = 0, t = 0;
    const cuts0 = e.cuts || 0;
    const base = ai.update.bind(ai);
    ai.update = (dt, cars, opts) => {
      if (phase === 'in' && e.progress >= p0 + 40 + leave) phase = 'cut';
      if (phase === 'brave' && e.progress > p0 + 40 + c.ds) phase = 'ai';
      if (phase === 'cut' || phase === 'brave') {
        let dx = c.bx - car.x, dz = c.bz - car.z;
        if (phase === 'brave') { const q = tr.place(car.trackS + 7 + car.speed * 0.25, ai.lineOffset(car.trackS + 7 + car.speed * 0.25)); dx = q.x - car.x; dz = q.z - car.z; }
        else if (Math.hypot(dx, dz) < 3.5) { phase = 'ai'; return base(dt, cars, opts); }
        const diff = wrap(Math.atan2(dz, dx) - car.angle);
        car.steer = Math.max(-1, Math.min(1, diff * 2.6 - car.w * 0.12));
        const fast = Math.abs(diff) > 0.7 && car.speed > 16;
        car.throttle = fast ? 0 : 1; car.brake = fast ? 0.8 : 0;
        return;
      }
      base(dt, cars, opts);
    };
    const orig = g.respawn.bind(g);
    g.respawn = (x) => { resp++; return orig(x); };
    while (t < 25 && e.progress < goal) { g.simulate(1 / 30); t += 1 / 30; }
    g.respawn = orig; ai.update = base;
    return { t, caught: (e.cuts || 0) - cuts0, resp, done: e.progress >= goal };
  }

  for (const def of defs) {
    if (!def) { out.push(`(unknown world id)`); continue; }
    await g.loadWorld(def, {});
    const keep = def.maxCutGain;
    if (NOCUT) def.maxCutGain = Infinity;
    g.startMatch({ drivers: [{ type: 'cpu', slot: 0, color: 0 }], mode: 'race', laps: 99, skill: 'hard', catchup: 'off' });
    while (g.state === 'countdown') g.simulate(0.05);
    const t0 = performance.now();
    const list = scan(def);
    const L = g.track.length;
    const lines = list.map((c) => {
      const f = (v) => v.toFixed(0);
      let s = ` ${Math.round(g.relS(c.a))}→${Math.round(g.relS(c.b))} gain ${f(c.gain)}/${f(c.vsInside)} jump ${f(c.maxJump)} off ${f(c.maxLat)} (${f(c.ax)},${f(c.az)})→(${f(c.bx)},${f(c.bz)})`;
      if (CONFIRM) {
        /* the road time: the better of the CPU driver and a brave one (flat out along the CPU line) */
        const road = [drive(c, 'road', 0), drive(c, 'brave', 0)].filter((r) => r.done && !r.caught && !r.resp).sort((p, q) => p.t - q.t)[0] || { t: 99 };
        let best = null, caught = 0;
        for (const lv of [-12, -6, 0, 6]) { const r = drive(c, 'cut', lv); if (r.caught || r.resp) caught++; if (r.done && !r.caught && !r.resp && (!best || r.t < best.t)) best = r; }
        if (best) {
          const dt = road.t - best.t;
          c.exploit = dt > 0.3;
          s += `: road ${road.t.toFixed(2)} cut ${best.t.toFixed(2)} ${dt >= 0 ? '+' : '-'}${Math.abs(dt).toFixed(2)} s${c.exploit ? ' EXPLOIT' : ''}`;
        } else s += `: caught ${caught}/4`;
      }
      return s;
    });
    const n = list.filter((c) => c.exploit).length;
    out.push(`${def.id} L=${Math.round(L)}: ${list.length} candidate${list.length === 1 ? '' : 's'}${CONFIRM ? `, ${n} exploit${n === 1 ? '' : 's'}` : ''} [${Math.round((performance.now() - t0) / 1000)} s]`);
    out.push(...lines);
    def.maxCutGain = keep;
  }
  return out.join('\n');
})()
