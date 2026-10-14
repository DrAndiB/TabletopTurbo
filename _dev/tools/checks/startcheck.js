(async () => {
  const { WORLDS } = await import('/demos/tabletop-turbo/js/worlds/index.js');
  const g = __tt.game; const res = [];
  for (const def of WORLDS) {
    await g.loadWorld(def, {});
    g.startMatch({ drivers: [0, 1, 2, 3].map(i => ({ type: 'cpu', slot: i, color: i })), mode: 'race', laps: 3, skill: 'normal', catchup: 'mild' });
    let minF = [9, 9, 9, 9], back = [0, 0, 0, 0];
    while (g.state === 'countdown') g.simulate(0.05);
    for (let i = 0; i < 40; i++) { g.simulate(0.05); g.cars.forEach((e, k) => { const f = e.car.fwdSpeed; minF[k] = Math.min(minF[k], f); if (f < -0.5) back[k]++; }); }
    res.push(`${def.id}: minFwd=${minF.map(v => v.toFixed(1)).join(',')} backFrames=${back.join(',')} prog=${g.cars.map(e => Math.round(e.progress)).join(',')} lap=${g.cars.map(e => e.lap).join(',')}`);
  }
  return res.join('\n');
})()
