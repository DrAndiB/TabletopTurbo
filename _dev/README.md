# Tabletop Turbo: developer notes

The project overview, controls and file layout are in the main `README.md`. This folder holds the
world-building guide (`WORLD_GUIDE.md`) and the test tools (`tools/`).

## Where things live

- **This repository (DrAndiB/TabletopTurbo)** is the source of truth: all code, assets, history and tools.
- **The website (DrAndiB/DrAndiB.github.io)** serves a copy of the game at
  https://andreasbraun.lu/demos/tabletop-turbo/ from its `demos/tabletop-turbo/` folder. That copy has
  everything except `_dev/`, `README.md` and `.gitignore`. See "Publishing" below.
- The game's history before it moved here (October 2026) came over with it, so `git log` shows every step.

## Run it locally

From the repository root: `python -m http.server 8123`, then open http://localhost:8123/.
Useful URL parameters: `?world=<id>`, `?quality=low|medium|high`, `?view=top`,
`?autostart=1&p=keys,cpu,cpu,cpu&mode=race`, `?cup=<id>`, `?test=1` (no render loop; used by the tools).

## Adding a world

Read `WORLD_GUIDE.md` (units, camera, kit API, quality bar, performance budget). In short:
1. Create `js/worlds/<id>.js` exporting the world definition (track points, bounds, lighting, `build(K)`,
   optional `animate` and `tick`).
2. Register it in `js/worlds/index.js`: add it to `ALL` and to a cup in `CUPS` (cups are ordered by difficulty;
   a world in no cup shows up in a "More tables" row). List it in `IN_PROGRESS` while working on it: it stays out
   of the menu but loads with `?world=<id>`.
3. Add a thumbnail `img/<id>.jpg` (352×220).
4. Run the checks below, then remove it from `IN_PROGRESS`.

## Test tools (`_dev/tools/`)

Requires Python with Playwright (`pip install playwright`, then `playwright install chromium`).
Start the local server, then run the tools from `_dev/tools/`. Set `TT_BASE` if the game is served
somewhere other than http://localhost:8123/.

- `tt.py "<query>" "<steps>"` drives the game in test mode (no render loop; the script advances the clock).
  Steps are separated by `;;`: `sim:<seconds>`, `shot:<name>` (saved to `$TT_OUT`, default `./out`),
  `js:<code>`. Example:
  `python tt.py "autostart=1&world=desk&p=cpu,cpu,cpu,cpu&quality=medium" "sim:5;;shot:desk_a"`
- JavaScript checks are passed as one `js:` step. In bash: `python tt.py "quality=low" "js:$(cat checks/allworlds.js | tr '\n' ' ')"`.
  In PowerShell: `python tt.py "quality=low" ("js:" + ((Get-Content checks\allworlds.js) -join ' '))`.
  - `simcheck.js`: 90 s head-to-head with four CPU cars (use with `autostart=1&world=<id>&p=cpu,cpu,cpu,cpu`).
  - `checks/allworlds.js`: 60 s race in every world: respawns, shortcut resets (`cuts`, must be 0 for CPUs), laps.
  - `checks/ramps.js`: drives straight at every ramp and reports whether it launches and what blocks it.
  - `checks/startcheck.js`: race starts in every world (no car may roll backwards at GO).
  - `checks/shortcut.js`: drives across the infield in a few worlds; every attempt must be caught.
  - `checks/h2h.js`, `checks/race.js`: full matches through to the results screen.
- Lint before every release. It catches undefined names in code paths the frame-less tests never reach:
  `npm i -D eslint@9 globals@15`, then `npx eslint -c _dev/tools/eslint.config.mjs js/*.js js/worlds/*.js`.
- `shot.py <url> <out.png> [wait] [w h]`: plain screenshot of any page (e.g. `?view=top`).
- `trk.py <points.json>`: checks a track layout (length, tightest radius, places where the track comes
  close to itself).

## Publishing to the website

1. Run the checks and the lint, commit and push here. Tag or branch the release (`release/vX.Y`).
2. Copy the game into the website repo, without the developer files. From this repository's root, with the
   website repo checked out next to it as `..\DrAndiB.github.io` (PowerShell):

   ```
   robocopy . ..\DrAndiB.github.io\demos\tabletop-turbo /MIR /XD .git _dev node_modules out /XF README.md .gitignore
   ```

   (`/MIR` also removes files that no longer exist here, so the copy matches exactly.)
3. Commit and push the website repo's `main`; GitHub Pages publishes within a few minutes.
