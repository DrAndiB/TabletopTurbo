(async () => {
  const { worldById } = await import('/demos/tabletop-turbo/js/worlds/index.js');
  const g = __tt.game; const res = [];
  for (const id of ['toybox', 'railway', 'garden', 'breakfast']) {
    await g.loadWorld(worldById(id), {});
    g.startMatch({ drivers: [{ type: 'keys', slot: 0, color: 0 }, { type: 'cpu', slot: 1, color: 1 }], mode: 'race', laps: 3 });
    g.simulate(3.6);
    const tr = g.track, L = tr.length;
    let best = null;
    for (let a = 0; a < L; a += 6) for (let b = a + 150; b < a + L - 150; b += 6) {
      const p = tr.at(a), q = tr.at(b % L); const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d > 25 && d < 70 && (!best || d < best.d)) best = { a, b: b % L, d };
    }
    if (!best) { res.push(id + ': no candidate'); continue; }
    const e = g.cars[0], c = e.car, p = tr.at(best.a), q = tr.at(best.b);
    const n0 = tr.nearest(p.x, p.z);
    c.place(p.x, p.z, Math.atan2(q.z - p.z, q.x - p.x)); e.trackI = n0.i; e.trackS = n0.s; e.lastGoodS = n0.s; e.offT = 0;
    const ang = c.angle; c.vx = Math.cos(ang) * 45; c.vz = Math.sin(ang) * 45;
    e.cuts = 0; const before = e.progress;
    __tt.input.down.add('ArrowUp');
    for (let i = 0; i < 40 && !e.cuts; i++) g.simulate(0.05);
    res.push(`${id}: tried s ${best.a}→${best.b} (gap ${best.d.toFixed(0)}) → cuts=${e.cuts}, now at s=${Math.round(e.trackS)} (progress ${Math.round(before)}→${Math.round(e.progress)})`);
  }
  return res.join('\n');
})()
