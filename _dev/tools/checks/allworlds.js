(async () => {
  const { WORLDS } = await import('/demos/tabletop-turbo/js/worlds/index.js');
  const g = __tt.game; const res = [];
  for (const def of WORLDS) {
    await g.loadWorld(def, {});
    g.startMatch({ drivers: [0, 1, 2, 3].map(i => ({ type: 'cpu', slot: i, color: i })), mode: 'race', laps: 99, skill: 'normal', catchup: 'mild' });
    let resp = 0; const orig = g.respawn.bind(g); g.respawn = (e) => { resp++; return orig(e); };
    let back = 0;
    while (g.state === 'countdown') g.simulate(0.05);
    for (let i = 0; i < 120; i++) { g.simulate(0.5); g.cars.forEach(e => { if (e.car.fwdSpeed < -3) back++; }); }
    const laps = g.cars.map(e => (e.progress / g.track.length).toFixed(1));
    res.push(`${def.id}: respawns=${resp} laps=${laps.join(',')} backSamples=${back}`);
  }
  return res.join('\n');
})()
