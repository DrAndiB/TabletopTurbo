# Tabletop Turbo — how to build a micro world

Tabletop Turbo is a browser racing game (three.js r186, ES modules, no build step) in the spirit of the
classic "tiny toy cars on household furniture" games. Up to four toy cars race on a shared screen; the
camera follows the leader and anyone who drops off the screen edge is out. The **worlds are the star**:
each must look like a believable miniature diorama photographed with a tilt-shift lens.

Game folder: `demos/tabletop-turbo/` in the website repo (DrAndiB/DrAndiB.github.io). Test tools: `_dev/tools/` (see `_dev/README.md`).
- `js/worlds/<id>.js` — one file per world (**the only file you edit**)
- `js/worlds/breakfast.js` — the finished reference world. Read it first; match or beat its quality.
- `js/kit.js` — helpers passed to `build(K)` (read it)
- `js/track.js`, `js/physics.js`, `js/textures.js`, `js/util.js` — read for API details
- Do **not** edit any shared file (engine, CSS, HTML, index.js, other worlds). If you truly need an
  engine change, work around it inside your world file and describe the request in your final report.

## Units and conventions
- 1 unit = 1 cm. Toy cars are ~4.4 long, ~2.2 wide, ~1.3 tall. y is up; the table top is y = 0.
- Screen: x to the right, **+z is towards the viewer (down the screen)**, −z is "north"/up the screen.
- Camera looks down at 62° from horizontal and shows roughly 88 × 50 units of table around the leader.
  Tall objects hide what is north of them, so keep tall props (> 15) away from the south side of the road
  or put them at the north edge of the table.
- `track.at(s)` / `track.place(s, offset)`: s = arc length along the track; `offset` > 0 is the
  driver's right-hand side. `p.angle` = heading (atan2(tz, tx)). To align a mesh with the track use
  `mesh.rotation.y = -p.angle` (mesh's local +x then points along the track).
- Use the seeded RNG `K.r` (`K.r()`, `K.r.range(a,b)`, `K.r.pick(arr)`, `K.r.gauss()`) — never Math.random
  in build code, so a world looks the same every load.

## World definition (default export)
```js
export default {
  id: 'desk', name: 'Homework Hustle', blurb: 'One line for the menu card (~80 chars).',
  vehicle: 'formula',              // sports | formula | rally | truck  (already assigned, keep it)
  seed: 5,
  track: { points: [[x, z], [x, z, width?], ...], width: 14, startS: 40 },  // closed loop, driving order
  bounds: { minX, maxX, minZ, maxZ },  // playable surface; outside = fall off (or walls, see below)
  fallOffEdges: true,              // false = invisible walls at bounds (garden/pool use real walls too)
  floorY: -76,                     // where falling cars land (visual only)
  offCourse: 16,                   // how far beyond the road edge a car may roam before being reset
  offroad: { kind: 'slow', margin: 1 },   // optional: surface kind applied outside the road
  skidColor: 0x2a1c12,
  dust: { normal: {...}, slow: {color, size, life, up, grav, alpha, grow, rate} },  // optional particles per surface
  clackOnBump: false,              // true = car hitting a pushable object plays a hard 'clack'
  lighting: { sunDir: [x,y,z], sunColor, sunIntensity, hemiSky, hemiGround, hemiIntensity, envIntensity, exposure, background, fog? },
  async build(K, settings) { ... },
  animate(time, dt, game) { ... },  // optional per-frame animation (keep it cheap)
};
```

### Track rules
- Closed loop of 16–26 control points (centripetal Catmull-Rom). Length ~800–1100 units. Width 13–15.
- Mix long straights, fast sweepers, 1–2 tight turns or hairpins. Corners tighter than radius ~9 are
  frustrating. Never let the track cross itself or come within ~2× width of another part of itself.
- Keep the road ≥ 12 units from fall-off edges in most places; one or two spots near an edge are fun.
- `startS` should be on a straight. The start grid is 2×2 behind it.
- Props that block must stay off the road, except deliberate small obstacles (AI steers around
  colliders and hazards it can see).
- Check the layout with the top view (below) and iterate.

### Kit API (see js/kit.js)
- `K.mesh(geo, mat, x, y, z, {rx, ry, rz, scale, cast, receive})`, `K.add(object3d, {cast, receive})`
- `K.instances(geo, mat, [{x,y,z,rx,ry,rz,s|sx,sy,sz,color}], {colors:true, cast})` — use for anything repeated
- Materials: `K.std`, `K.phys`, `K.ceramic(color)`, `K.metal(color, rough)`, `K.plastic(color, rough)`,
  `K.glass(color, opacity)`, `K.liquid(color)`
- `K.lathe([[radius, y], ...], segs)`, `K.RoundedBoxGeometry`, `K.BufferGeometryUtils`
- Flat things on the table: `K.flatShape(poly, mat, y, {extrude, bevel})`, `K.spill(cx, cz, radius, mat, {lump, stretch, angle, y, thick})` → `{poly, mesh}`
- `K.contact(x, z, rx, rz, opacity, angle)` — soft dark blob under objects (ambient occlusion). Use it under every prop.
- `K.ribbon({mat, width, y, vScale, offset, widthFn})` — a strip following the track (road surface, edge lines, tape...). UV: u 0→1 across (left→right edge), v = distance / vScale.
- `K.track.edgePoints(side, spacing, extra)` — points along the road edges (side −1 left, +1 right).
- `K.offRoad(x, z, margin)` — true if a point is clear of the road.
- Textures (`K.TX`): `woodTextures`, `ginghamTextures`, `feltTextures`, `mottledTextures`, `brushedMetalTextures`, `paint(w, h, fn)`, `makeCanvas`, `toTexture(canvas, {repeat, srgb, wrap})`, `noiseField`, `normalFromHeight`, `labelTexture`. Canvas 2D drawing (text, shapes, gradients) is great for labels, paper, printed patterns. Fonts available to canvas: "Lilita One", "Rubik", Georgia, system fonts.
- Moving hazards: `K.mover(shape, fn)` adds a kinematic collider. `shape` = `{type: 'circle', r, h}`,
  `{type: 'box', hw, hd, h}` or `{type: 'capsule', r, h}`; `fn(t)` is a pure function of simulation time `t`
  (seconds) returning `{x, z, angle}` (circle/box) or `{x1, z1, x2, z2}` (capsule). The engine moves it every
  physics step and cars/pushable objects it hits get shoved with its surface velocity. Sync the visual in
  `animate(time, dt, game)` with the same `fn(game.time)`. Make movers telegraphed and fair (periodic, visible
  before they arrive, never parked on the racing line for long).
- `tick(dt, time, game)` (optional world function) runs at the fixed physics rate (120 Hz) during countdown/race:
  use it for force zones such as water currents, wind or a fan (e.g. `for (const e of game.cars) { const c = e.car; if (c.state === 'drive' && inside(c.x, c.z)) { c.vx += fx * dt; c.vz += fz * dt; } }`).
  Keep it cheap. (`animate` only runs when frames are rendered; `tick` also runs in test simulations.)
- World options: `gravity: 0.6` scales gravity (Mars); `wake: {color}` sets boat foam colour.
- Vehicles: `sports | formula | rally | truck | rover | boat | hover | snowmobile | monster | suv`.
  `hover` (hovercraft) ignores water/slow/sticky/rough penalties (slick still slides) and floats on a cushion;
  `monster` (monster truck) rides over colliders lower than 1.7 and climbs steps up to 1.8 (mark a collider
  `solid: true` to block it anyway); `snowmobile` steers on skis; `suv` is a heavy luxury SUV.
- Kickers: give any static or moving collider `kick: <speed>` (e.g. 45) and cars/pushables that touch it are fired
  away at least at that speed (pinball bumpers, slingshots, springs). Every collider counts contacts in
  `c.hits`, so `animate` can flash a light when it changes.
- Boats float at y = 0 (waterline), drift through
  turns, bob and bank, and leave a foam wake instead of skid marks.
- Physics: `K.circle(x, z, r, h)`, `K.box(x, z, halfW, halfD, angle, h)`, `K.capsule(x1, z1, x2, z2, r, h)` — `h` = height; a car in the air above `h` passes over.
  `K.surface(kind, {poly} | {x, z, r})` — kinds: `slick` (spins, e.g. milk/oil/ink), `sticky` (jam/glue/paint), `slow` (sand/sawdust/grass), `rough`, `water` (puddles).
  `K.hole(x, z, r)` — cars (and pushable objects) fall in and respawn.
  `K.ramp(x, z, angle, length, width, height, base)` — rises from 0 at its start to `height` at its end along `angle`; cars launch off the high end. Build a matching visual (ruler on a book, plank on a brick...).
  `K.platform(x, z, halfW, halfD, angle, height)` — flat raised area cars can drive on (reach it with a ramp).
  `K.physics.addDynamic({x, z, r, m, h, mesh, friction, baseY, slide})` — pushable round object. Mesh position is synced each frame; spheres roll visually, `slide: true` objects spin instead (cubes, coins).
- `K.group` is the world's root group; everything is disposed when the world unloads.

## Quality bar (most important)
- It must read instantly as a real place at toy scale: real objects at roughly real proportions
  (a mug is ~8–11 across, a pencil ~0.8 thick and 17 long, a pool ball 5.7). Up to ~1.3× real size is fine.
- Three levels of detail: big landmarks (2–4 per screen), medium props, and fine scatter (crumbs,
  shavings, petals, sawdust, chalk dust, screws...). Every screen-sized area should have something
  to look at, but the road must stay readable at speed.
- Materials: proper roughness/metalness/clearcoat, procedural normal maps for surfaces, printed labels
  drawn on canvas, no flat untextured large surfaces. Contact shadows under objects. Everything casts shadows.
- Road edges must be obvious at a glance, in a way that belongs to the world (cereal loops, chalk
  lines, masking tape, highlighter, pebbles...). A start/finish line at `startS`.
- 2–3 hazards (slick/sticky/slow/holes) and at least one special feature (ramp jump, pushable objects, platform...).
- Generic, original designs only: no real brand names, logos or characters. Made-up labels are fine.
- Below the table edges show a floor far below (y ≈ −76) so falling off looks right (see breakfast.js).

## Performance budget
- Aim for < 250 draw calls and < 450k triangles on screen including the shadow pass (the test script
  prints `calls` and `triangles` after each `sim`). Use `K.instances` for anything repeated more than a
  few times, keep lathe segments ≤ 64, sphere segments ≤ 32, textures ≤ 1024² (most 256–512²).
- World build should take < 2 s on a laptop (pixel loops over 1024² textures cost ~100 ms each).

## Testing (headless Chromium with software WebGL — slow, so render with quality=low)
Serve the repo root on http://localhost:8123 (`python3 -m http.server 8123` from the repo root). Tools:
`SP=demos/tabletop-turbo/_dev/tools` (`tt.py`, `shot.py`, `simcheck.js`, `trk.py`, `checks/*.js`); screenshots go to `$TT_OUT` (default `./out`).
Prefix every screenshot name with your world id so you don't overwrite other people's files.

1. Top-down overview of the whole world (layout check):
   `python3 $SP/shot.py "http://localhost:8123/demos/tabletop-turbo/?view=top&quality=low&world=<id>" $SP/<id>_top.png 12 1400 900`
   then look at the PNG with the Read tool.
2. Gameplay-camera views (what players see). `tt.py` loads the game in test mode and runs steps
   separated by `;;`: `sim:<seconds>` advances the simulation and renders, `shot:<name>` saves
   `$SP/<name>.png`, `js:<code>` evaluates JS. `__tt.game.camOverride = {x, z, w: 90}` pins the camera.
   `cd $SP && python3 tt.py "autostart=1&world=<id>&p=cpu,cpu,cpu,cpu&quality=low" "sim:4;;shot:<id>_a;;js:__tt.game.camOverride={x:0,z:0,w:90};;sim:0.1;;shot:<id>_b"`
   Use quality=medium for a final beauty check (slower).
3. AI/gameplay check: 4 CPU cars must lap cleanly with few resets:
   `cd $SP && python3 tt.py "autostart=1&world=<id>&p=cpu,cpu,cpu,cpu&quality=low" "js:$(cat simcheck.js | tr '\n' ' ')"`
   prints respawn count and progress every 5 s. Expect lap speeds of ~30–45 units/s and respawns < 5 per minute.
   Also check there are no `PAGEERROR` lines.

## Final report
Return: what you built (layout, landmarks, hazards, special features), screenshot file names, the
draw-call/triangle numbers, AI check results, and any engine requests or known issues.
