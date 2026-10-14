(() => {
  const g = __tt.game; const out = [];
  let resp = 0, falls = 0;
  const orig = g.respawn.bind(g); g.respawn = (e) => { resp++; return orig(e); };
  for (let i = 0; i < 90; i++) {
    g.simulate(1);
    if (i % 5 === 4) out.push({ t: g.time.toFixed(0), st: g.state, round: g.round, pts: g.cars.map(e => e.points).join(''), out: g.cars.map(e => e.out ? 1 : 0).join(''), s: g.cars.map(e => Math.round(e.progress)).join(',') , spd: g.cars.map(e=>e.car.speed.toFixed(0)).join(',')});
  }
  return { resp, out };
})()
