# Tabletop Turbo

Tabletop multiplayer racing game for the browser: tiny toy vehicles racing across household furniture,
up to four players on one keyboard, plus gamepads and computer drivers.

**Play it:** https://andreasbraun.lu/demos/tabletop-turbo/

- **16 miniature worlds in four cups**, from easy to expert:
  - Crumb Cup: Breakfast Rush, Garden Grand Prix, Gingerbread Village, Toy Box Mayhem
  - Doodle Cup: Homework Hustle, Bath Time Overflow, Corner Pocket, Splash Lagoon Regatta
  - Turbo Cup: Workbench Rally, Quarterly Review, Mars Rover Run, Branch Line Bash
  - Chaos Cup: Pinball Wizard, Reaction Rally, Haunted Dollhouse, Watchmaker's Bench
- **Ten vehicle types:** sports cars, formula racers, rally cars, 4x4 trucks, Mars rovers, speedboats,
  hovercraft, snowmobiles, monster trucks and luxury SUVs.
- **Modes:** head-to-head (the screen follows the leader; drop off its edge and you're out), lap races,
  cup championships with gold/silver/bronze trophies, and time trial against your own ghost car.
- **Arcade touches:** adjustable catch-up, slipstream, crashes that shove and spin, turbo starts,
  moving hazards in every world, and no extreme shortcuts.

## Controls

| Player | Gas | Brake / reverse | Steer |
|---|---|---|---|
| Red | ↑ | ↓ | ← → |
| Blue | W | S | A D |
| Yellow | I | K | J L |
| Green | Numpad 8 | Numpad 5 | Numpad 4 6 |

Keys can be changed in the menu ("Keys…"). "Easy keys" gives a driver automatic gas, so they only steer
with two keys, which helps when three or four people share one keyboard. Gamepads work without setup
(press A in the lobby to take a seat). On a phone, one player can race with touch steering.
Esc or P pauses, F toggles fullscreen.

## Run it locally

No build step and no dependencies: the browser loads the ES modules directly. Serve the repository root
with any static web server, for example (PowerShell or any shell):

```
python -m http.server 8123
```

then open http://localhost:8123/. Useful URL parameters: `?world=<id>`, `?quality=low|medium|high`,
`?view=top` (top-down overview of a world), `?autostart=1&p=keys,cpu,cpu,cpu&mode=race`.

## Project layout

```
index.html          menus, HUD and screens
css/game.css        all styling
js/main.js          boot, lobby, settings, cups and championship flow, main loop
js/game.js          race logic: modes, laps, elimination, catch-up, slipstream, turbo start,
                    shortcut detection, time trial and ghost, camera, particles
js/physics.js       arcade physics: vehicles, surfaces, colliders, movers, kickers, spinners,
                    ramps, platforms, holes and trapdoors
js/ai.js            CPU drivers
js/cars.js          vehicle models
js/render.js        three.js renderer, lighting, tilt-shift "miniature" effect, camera shake
js/kit.js           helpers for world builders
js/textures.js      procedural textures
js/track.js         spline track and road ribbons
js/input.js         keyboard (4 players), gamepads, touch
js/audio.js         synthesised sound (no audio files)
js/hud.js, js/fx.js, js/records.js (best laps, ghosts, trophies), js/util.js
js/worlds/*.js      one file per world; js/worlds/index.js holds the cups and the menu order
img/                menu thumbnails and social preview images
vendor/             three.js r186 bundle
fonts/              Lilita One and Rubik
_dev/               developer notes, the world-building guide and test tools
```

## Developing

- `_dev/README.md`: architecture notes, adding a world, test tools, publishing to the website.
- `_dev/WORLD_GUIDE.md`: how to build a world (units, camera, kit API, quality bar, performance budget).
- `_dev/tools/`: headless test driver and automated checks (AI laps, ramps, race starts, shortcuts).

## Credits and licences

- [three.js](https://threejs.org/) r186, MIT licence (`vendor/LICENSE-three.txt`).
- Fonts [Lilita One](https://fonts.google.com/specimen/Lilita+One) and [Rubik](https://fonts.google.com/specimen/Rubik),
  SIL Open Font License (`fonts/LICENSE-*.txt`).
- Everything else (code, worlds, textures, sounds) is procedural and original to this project.
  No licence has been chosen for the project itself yet.
