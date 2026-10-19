# Tabletop Turbo: developer notes

The project overview, controls and file layout are in the main `README.md`. This folder holds the
world-building guide (`WORLD_GUIDE.md`), the test tools (`tools/`) and the roadmap with the idea bank (`ROADMAP.md`).

## Where things live

- **This repository (DrAndiB/TabletopTurbo)** is the source of truth: all code, assets, history and tools.
- **The website (DrAndiB/DrAndiB.github.io)** serves a copy of the game at
  https://andreasbraun.lu/demos/tabletop-turbo/ from its `demos/tabletop-turbo/` folder. That copy has
  everything except `_dev/`, `app/`, `.github/`, `README.md` and `.gitignore`. See "Publishing" below.
- The game's history before it moved here (October 2026) came over with it, so `git log` shows every step.

## Run it locally

From the repository root: `python -m http.server 8123`, then open http://localhost:8123/.
Useful URL parameters: `?world=<id>`, `?quality=low|medium|high`, `?view=top`,
`?autostart=1&p=keys,cpu,cpu,cpu&mode=race`, `?cup=<id>`, `?test=1` (no render loop; used by the tools),
`?debug=1` (performance overlay, also F3 in game), `?fps=max` (no frame cap).

## Performance

- **Warm-up:** before every race (and the title background) `R.warmUp()` compiles every material in the
  scene, hidden ones included, uploads every texture and renders two frames, then waits for the GPU. After a
  world load this happens behind the loading card; a restart on the same table takes milliseconds. Materials a
  world creates later, inside `animate` or `tick`, are not covered: create them in `build()` and hide them.
- **Quality presets** (`QUALITY` in `render.js`): High is two-pass tilt-shift, 4096 shadows, pixel ratio up to 2.
  Medium uses a one-pass disk blur for the tilt-shift, 2048 shadows, pixel ratio up to 1.35. Low has no
  tilt-shift, 1024 shadows, pixel ratio 1, no MSAA. Worlds read `K.quality.tilt === false` to thin out props on Low.
- **Auto** starts on Medium (or Low, if this device needed it within the last week) and, while racing, lowers the
  render scale to 60 % in steps when frames take too long, then drops to Low. It probes back up with growing pauses
  between attempts. Picking Auto in the menu again re-tests the device. Fixed presets never change by themselves.
- **Frame cap** (menu "Frame rate", default 60 fps): on 120–240 Hz screens the loop renders every 2nd, 3rd or 4th
  refresh, so pacing stays even. "Max" renders every refresh. Physics always runs at a fixed 120 Hz step.
- **Overlay** (F3 or `?debug=1`): fps, frame time, refresh rate and cap, render size and scale, preset,
  draw calls and triangles for the whole frame (shadow, scene and post passes), shaders, textures, GPU name.
- **Built-in graphics hint:** on Windows, when the GPU name looks integrated (Intel, AMD APU) and a race ran
  slowly (or Auto had to cut resolution), a dismissible note on the next menu screen explains how to set the
  browser to High performance. Once dismissed it doesn't come back.

## Android app

`app/` holds the Android app (Capacitor), built on GitHub by `.github/workflows/android.yml`. See `app/README.md`.

## Adding a world

Read `WORLD_GUIDE.md` (units, camera, kit API, quality bar, performance budget). In short:
1. Create `js/worlds/<id>.js` exporting the world definition (track points, bounds, lighting, `build(K)`,
   optional `animate` and `tick`).
2. Register it in `js/worlds/index.js`: add it to `ALL` and to a cup in `CUPS` (cups are ordered by difficulty;
   a world in no cup shows up in a "More tables" row). List it in `IN_PROGRESS` while working on it: it stays out
   of the menu but loads with `?world=<id>`.
3. Add a thumbnail `img/<id>.jpg` (352×220).
4. Run the checks below, then remove it from `IN_PROGRESS`.

## Audio

Everything is synthesised with the Web Audio API. There are no audio files.

- `js/audio.js`: the `Sound` object. It owns the buses: master (the corner mute button) is fed by effects
  (engines, one-shots, cues and ambience; lobby setting "Effects") and by music (setting "Music"). Music runs
  through a duck that dips it by up to 3 dB under loud engines, and through a small mono reverb. This file also
  holds the engine and skid voice for each vehicle type (`VEH`, `SKID`), the crash and landing sounds, the jingles,
  `cue()` and the race lifecycle. Muted, or with the app in the background, the AudioContext is suspended, so
  nothing runs.
- `js/music.js`: one piece per world plus the menu theme (`PIECES`), a sequencer with look-ahead (`Player`) and
  the instruments. Plucked strings, bells, mallets, pianos and drums are rendered once per pitch into small buffers
  before the race (`MusicKit.prepare`). Leads and basses are persistent voices driven by automation. Melodies are
  generated from a seed, so they are original.
- `js/ambience.js`: the background of each world (`AMBIENT`: a quiet bed plus occasional events) and the cue
  sounds (`CUES`).

How `game.js` drives it:

| When | Call |
|---|---|
| `startMatch` | `createEngines(n, vehicleType)`, `prepareRace(worldId)` (compiles the piece and renders its notes behind the loading card) |
| every frame | `frame(game)`, then `updateEngine(...)` per car. These only set AudioParam targets and never create nodes. |
| GO | `raceGo(game)`: music and ambience start. Head-to-head rounds keep them going. |
| "Final lap!" | `finalLapReached()`: the piece adds its `layer: 'final'` parts and plays about 4 % faster |
| pause / resume | `setPaused(on)` |
| `endMatch` | `raceEnd()`: fades out |
| physics events | `bump(strength, pan, 'car' or 'bounce')`, `land(strength, pan)`, `crunch()`. These follow the vehicle type, and `spec.carBounce` gives the rubbery bumper-car boing. |

The menu theme plays on the title and lobby screens (`startMusic`/`stopMusic` from `showScreen`).

**A new world** gets its sound in three places:
1. Add a piece under the world's id in `PIECES` (`music.js`). Give it a key, `bpm`, `meter`, chord charts for two
   or three `sections` (one string per bar), a `form` (aim for a 30–60 s loop) and `parts` (melody, bass, comp,
   drums, double, counter; mark one `layer: 'final'` for the last lap). Changing a part's `seed` gives a new tune.
   A world without a piece borrows Breakfast Rush's.
2. Add an entry under the world's id in `AMBIENT` (`ambience.js`): `bed` layers and `ev` events with their gaps
   in seconds.
3. Optionally add cues. In the world's `tick` or `animate`, call `game.sound.cue(name, { x, z, game })` once when
   something is about to happen. Keep the previous value in the world's state and fire on the transition, as
   `gingerbread.js` (whistle), `watertable.js` (clank), `toybox.js` (toot) and `watchmaker.js` (tick) do. Cues
   are panned and get quieter away from the middle of the view, but never go silent. They only play while racing.
   For new cue sounds, add them to `CUES`.

Then run `audio_render.py worlds --only <id>` and set the piece's `level` so its music RMS lands near the others
(about −31.5 dBFS). Listen to the WAV and look at `worlds.png`.

**A new vehicle type:** add a `VEH` entry (oscillators, gears or electric or CVT, firing pulses, filter, extras)
and pick or add a `SKID` layer in `audio.js`. If it needs its own landing or crash, add a branch to `land`,
`bump` and `crunch`. Run `audio_render.py engines --only <type>` and adjust `vol` until the full-throttle RMS is
about −27.5 dBFS (the SUV is quieter on purpose). Check `engines.png` against the other types.

**Mix targets** (one car at full throttle, offline render): engines −26 to −28 dBFS RMS. Race music is about
about −35.5 dBFS ±2 dB, roughly 8 dB below one engine before the duck (lowered in October 2026: the music was
too present). The menu theme (a softened version of the original chiptune) is at about −34.5 dBFS. Keep sustained leads (fiddle, theremin, oboe,
accordion, organ) dark and with little vibrato, and melodies mostly below A5, or they turn whiny. Ambience is
−39 to −55 dBFS. Peaks are at −6 dBFS or below.

**Performance:** each car's voice is about 15 nodes, built once per race. Music adds 2 nodes per note, about
40 nodes per second, with roughly 30–55 sources playing at once in a 4-car race. Note buffers for one world are
kept in memory and dropped when another world loads. The music and ambience timer runs only while something plays.

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
  - `checks/cuts.js`: shortcut scanner. Finds straight lines across the infield that gain more than 15 units of
    track while slipping under the engine's catch (no nearest-road jump beyond `maxShortcut`, not too long past
    `offCourse`, under the off-road gain limit `CUT` in game.js, nothing in the way), then drives the best ones for real and prints the time gained; `EXPLOIT`
    marks a cut that isn't caught and gains more than 0.3 s. Every world in the menu by default; pass world ids
    (in the menu or not) in the query: `python tt.py "quality=low&ids=moselle,fouer" "js:$(cat checks/cuts.js | tr '\n' ' ')"`.
    Options: `gain=15`, `top=4` (candidates per world), `confirm=0` (scan only, no test drives).
  - `checks/h2h.js`, `checks/race.js`: full matches through to the results screen.
- Stuck cars: a car with less than 3 units of progress along the track in 6 s is put back on the road (CPUs too).
  A world whose cars legitimately wait (a closed level crossing, a gate) sets `e.holdT = <seconds>` from `tick`
  for every car queuing there; the stuck timer pauses while it is above zero (the engine counts it down). See
  gingerbread, railway, toybox and watertable. `game.stuckResets` counts the resets in a race.
- Lint before every release. It catches undefined names in code paths the frame-less tests never reach:
  `npm i -D eslint@9 globals@15`, then `npx eslint -c _dev/tools/eslint.config.mjs js/*.js js/worlds/*.js`.
- `shot.py <url> <out.png> [wait] [w h]`: plain screenshot of any page (e.g. `?view=top`).
- `audio_render.py [engines] [worlds] [menu] [--only id,...]`: renders the audio offline in headless Chromium
  (OfflineAudioContext). It writes WAVs, `levels.json` and spectrograms (`engines.png`, `worlds.png`) to
  `out/audio/` and flags clipping, NaN and silence. Each vehicle gets an acceleration sweep with a slide and
  one-shots. Each world gets 20 s of music + ambience, with the final-lap layer switching on at 10 s.
- `audio_live.py [world] [seconds]`: a real race with sound (4 CPUs, the game clock paced to real time). It counts
  the nodes created (by type and per 5 s), the sources playing, any nodes created inside `updateEngine` (must be
  0), the cues played and page errors. It then checks pause, mute (the context suspends) and the way back to the
  menu.
- `trk.py <points.json>`: checks a track layout (length, tightest radius, places where the track comes
  close to itself).

## Publishing to the website

1. Run the checks and the lint, commit and push here. Tag or branch the release (`release/vX.Y`).
2. Copy the game into the website repo, without the developer files. From this repository's root, with the
   website repo checked out next to it as `..\DrAndiB.github.io` (PowerShell):

   ```
   robocopy . ..\DrAndiB.github.io\demos\tabletop-turbo /MIR /XD .git .github _dev app node_modules out /XF README.md .gitignore
   ```

   (`/MIR` also removes files that no longer exist here, so the copy matches exactly.)
3. Commit and push the website repo's `main`; GitHub Pages publishes within a few minutes.
