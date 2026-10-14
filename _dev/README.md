# Tabletop Turbo: developer notes

A tabletop toy-car racer for the browser: up to four players on one keyboard, gamepads, CPU drivers,
13 miniature worlds. Live at https://andreasbraun.lu/demos/tabletop-turbo/.

This `_dev/` folder is kept in the repository but is **not published** on the website (GitHub Pages
skips folders that start with an underscore).

## Layout of the game folder

```
demos/tabletop-turbo/
  index.html          menus, HUD and screens (plain HTML)
  css/game.css        all styling
  js/main.js          boot, lobby, settings, championship flow, main loop
  js/game.js          race logic: modes, laps, head-to-head elimination, catch-up, slipstream, turbo start,
                      time trial and ghost, camera, particles, audio hooks
  js/physics.js       arcade physics: vehicles, surfaces, colliders, movers, kickers, ramps, platforms, holes
  js/ai.js            CPU drivers
  js/cars.js          vehicle models (sports, formula, rally, truck, rover, boat, hover, snowmobile, monster, suv)
  js/render.js        three.js renderer, lighting rig, tilt-shift "miniature" post effect, camera shake
  js/kit.js           helpers handed to world builders
  js/textures.js      procedural textures (wood, cloth, noise, labels…)
  js/track.js         spline track, road ribbons, nearest-point queries
  js/input.js         keyboard (4 players), gamepads, touch
  js/audio.js         synthesised sound (no audio files)
  js/hud.js, js/fx.js, js/records.js (best laps + ghosts in localStorage), js/util.js
  js/worlds/*.js      one file per world; js/worlds/index.js is the registry and menu order
  img/                menu thumbnails (352×220) and social preview images
  vendor/             three.js r186 bundle (MIT)
  fonts/              Lilita One and Rubik (OFL)
  _dev/               this folder: WORLD_GUIDE.md and test tools
```

No build step: the browser loads the ES modules directly.

## Run it locally

From the repository root (PowerShell or any shell):

```
python -m http.server 8123
```

then open http://localhost:8123/demos/tabletop-turbo/.
Useful URL parameters: `?world=<id>` (load a world), `?quality=low|medium|high`,
`?view=top` (top-down overview of a world), `?autostart=1&p=keys,cpu,cpu,cpu&mode=race`.

## Adding a world

Read `WORLD_GUIDE.md` (units, camera, kit API, quality bar, performance budget). In short:
1. Create `js/worlds/<id>.js` exporting the world definition (track points, bounds, lighting, `build(K)`,
   optional `animate` and `tick`).
2. Register it in `js/worlds/index.js` (add it to `IN_PROGRESS` while working on it: it stays out of the
   menu but loads with `?world=<id>`).
3. Add a thumbnail `img/<id>.jpg` (352×220).
4. Run the checks below, then remove it from `IN_PROGRESS`.

## Test tools (`_dev/tools/`)

Requires Python with Playwright (`pip install playwright`, then `playwright install chromium`).
Run from `_dev/tools/` with the local server running.

- `tt.py "<query>" "<steps>"` drives the game in test mode (no render loop; the script advances the clock).
  Steps are separated by `;;`: `sim:<seconds>`, `shot:<name>` (saved to `$TT_OUT`, default `./out`),
  `js:<code>`. Example:
  `python tt.py "autostart=1&world=desk&p=cpu,cpu,cpu,cpu&quality=medium" "sim:5;;shot:desk_a"`
- `simcheck.js`: 90 s head-to-head with four CPU cars, reports respawns and progress:
  `python tt.py "autostart=1&world=<id>&p=cpu,cpu,cpu,cpu&quality=low" "js:$(cat simcheck.js | tr '\n' ' ')"`
- `checks/allworlds.js`: 60 s race in every world (respawns, laps, cars rolling backwards).
- `checks/ramps.js`: drives straight at every ramp in every world and reports whether it launches and what blocks it.
- `checks/startcheck.js`: race starts in every world (no car should roll backwards at GO).
- `checks/h2h.js`, `checks/race.js`: full matches through to the results screen.
  The checks run with `python tt.py "quality=low" "js:$(cat checks/<file> | tr '\n' ' ')"`
  (on Windows, paste the file contents instead of the `$(...)` part, or use WSL).
- `shot.py <url> <out.png> [wait] [w h]`: plain screenshot of any page (e.g. `?view=top`).
- `trk.py <points.json>`: checks a track layout (length, tightest radius, places where the track comes
  close to itself).

## Publishing

The website is served by GitHub Pages from the `main` branch of DrAndiB/DrAndiB.github.io.
Pushing to `main` publishes within a few minutes. Restore points are kept as branches named `release/tabletop-turbo-vX.Y`.
