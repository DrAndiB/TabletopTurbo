/* Drift check: for each drift world (ids=..., default the Drift Cup), a 60 s race with four hard CPU drift cars,
   then the same with sliding switched off (they still brake for corners). Reports progress after 60 s, laps,
   respawns, stuck resets, shortcut resets, the share of time spent sliding, slides started / charged / boosted and
   the median slide length. Drifting should be a little faster than grip driving, never slower by much, and
   respawns should stay rare. */
(async () => {
  const q = new URLSearchParams(location.search);
  const ids = (q.get('ids') || 'butter,pass,bowling,rooftop').split(',');
  const out = [];
  for (const id of ids) {
    for (const mode of ['drift', 'grip']) {
      const s = __tt.settings(); s.world = id; s.mode = 'race'; s.laps = 8; s.catchup = 'off'; s.skill = 'hard';
      s.slots = [{ type: 'cpu' }, { type: 'cpu' }, { type: 'cpu' }, { type: 'cpu' }];
      await __tt.start();
      const g = __tt.game;
      if (mode === 'grip') g.cars.forEach((e) => { e.ai.skill = { ...e.ai.skill, drift: 0 }; });
      const ev = {}; let resp = 0; const durs = [];
      const oh = g.handleEvent.bind(g);
      g.handleEvent = (x) => { if (x.type.startsWith('drift')) { const k = x.type + (x.level || ''); ev[k] = (ev[k] || 0) + 1; if (x.type === 'driftStart') x.car._d0 = g.time; } return oh(x); };
      const or = g.respawn.bind(g); g.respawn = (e, ...a) => { resp++; return or(e, ...a); };
      while (g.state !== 'race') g.simulate(0.25);
      let dT = 0, n = 0;
      for (let i = 0; i < 600; i++) {
        g.simulate(0.1);
        for (const e of g.cars) { n++; if (e.car.drift) dT++; if (e.car._d0 && !e.car.drift) { durs.push(g.time - e.car._d0); e.car._d0 = 0; } }
      }
      durs.sort((a, b) => a - b);
      const cuts = g.cars.map((e) => e.cuts || 0).join('');
      const prog = g.cars.map((e) => Math.round(e.progress));
      out.push(`${id} ${mode}: progress ${prog.join(',')} (mean ${Math.round(prog.reduce((a, b) => a + b, 0) / prog.length)}) laps ${g.cars.map((e) => e.lap).join(',')} respawns ${resp} stuck ${g.stuckResets} cuts ${cuts} sliding ${(100 * dT / n).toFixed(0)}% ` +
        (mode === 'drift' ? `slides ${ev.driftStart || 0} blue ${ev.driftLevel1 || 0} orange ${ev.driftLevel2 || 0} boosts ${(ev.driftBoost1 || 0) + (ev.driftBoost2 || 0)} median ${durs.length ? durs[durs.length >> 1].toFixed(1) : '-'} s` : ''));
    }
  }
  return out.join('\n');
})()
