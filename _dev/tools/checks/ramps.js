(async () => {
  const { WORLDS } = await import('/demos/tabletop-turbo/js/worlds/index.js');
  const g = __tt.game; const res = [];
  for (const def of WORLDS) {
    await g.loadWorld(def, {});
    const s = __tt.settings(); s.mode = 'race'; s.slots = [{ type: 'keys' }, { type: 'cpu' }, { type: 'off' }, { type: 'off' }];
    g.startMatch({ drivers: [{ type: 'keys', slot: 0, color: 0 }, { type: 'cpu', slot: 1, color: 1 }], mode: 'race', laps: 3 });
    g.simulate(3.6);
    const P = g.physics;
    P.ramps.forEach((r, k) => {
      const blockers = new Set();
      for (let a = -r.len / 2; a <= r.len / 2; a += 0.5) for (let b = -r.wid / 2 + 1.2; b <= r.wid / 2 - 1.2; b += 0.8) {
        const x = r.x + a * r.cos - b * r.sin, z = r.z + a * r.sin + b * r.cos;
        const h = r.height * (a + r.len / 2) / r.len + (r.base || 0);
        for (const c of P.colliders) if (c.h > h + 0.2 && P.circleVsCollider(x, z, 1.1, c)) blockers.add(`${c.type}@${(c.x ?? c.x1).toFixed(0)},${(c.z ?? c.z1).toFixed(0)} h${c.h}`);
      }
      const e = g.cars[0], c = e.car;
      const sx = r.x - r.cos * (r.len / 2 + 14), sz = r.z - r.sin * (r.len / 2 + 14);
      c.state = 'drive'; c.place(sx, sz, r.angle); c.vx = r.cos * 38; c.vz = r.sin * 38; c.airborne = false; c.y = g.physics.groundAt(sx, sz).g; c.groundY = c.y;
      const n = g.track.nearest(sx, sz); e.trackI = n.i; e.trackS = n.s; e.lastGoodS = n.s; e.offT = 0;
      __tt.input.down.add('ArrowUp');
      let maxY = 0, air = 0, minV = 99;
      for (let i = 0; i < 30; i++) { g.simulate(0.05); maxY = Math.max(maxY, c.y); if (c.airborne) air++; if (i > 3 && i < 14) minV = Math.min(minV, c.speed); }
      res.push(`${def.id} ramp${k} len${r.len.toFixed(1)} h${r.height.toFixed(1)} -> maxY=${maxY.toFixed(1)} airFrames=${air} minV=${minV.toFixed(0)} state=${c.state} blockers=[${[...blockers].join('; ')}]`);
    });
  }
  return res.join('\n');
})()
