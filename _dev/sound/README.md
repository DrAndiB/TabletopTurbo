# Sound lab

How the recorded sound in `audio/` was made: original music composed in Python as MIDI and rendered with
FluidSynth, and CC0 recordings from Freesound cut into engine loops, background beds and one-shots.
The finished files and their numbers (loop lengths, cut points, levels) live in `audio/` and `js/samples.js`;
this folder is only needed to change or remake them. The credits are in `audio/CREDITS.md`.

## Setup (Windows, as used)

- Python 3 with `pip install --user numpy scipy soundfile pyloudnorm mido playwright`
- ffmpeg on PATH (or `FFMPEG=...`), e.g. `winget install Gyan.FFmpeg`
- FluidSynth 2.6.1 and the GeneralUser GS 2.0.3 SoundFont. `tools/mus.py` looks in `~\tools\fluidsynth\...` and
  `~\tools\soundfonts\GeneralUser-GS.sf2`; set `FLUIDSYNTH` and `SF2` to use other places.
- Headless Edge for `render.py` and `test_game.py` (Playwright). On Windows it needs `--use-angle=d3d11` for WebGL.

Run the scripts from this folder with `python -E -P`.

## Music

- `scores/<world>.py` is one piece per table, `scores/menu.py` the menu theme; `tools/compose_breakfast.py` is the
  Breakfast piece (the pilot). They build on `tools/song.py` (chord charts, accompaniment figures, key check,
  stem mix) and `tools/mus.py` (MIDI writing, FluidSynth render).
- `python -E -P scores/garden.py` renders to `work/music/garden/` (main loop, final-lap layer, previews);
  add `--encode ../..` to write `audio/music/garden.mp3` and `garden-final.mp3` into the game.
- If the loop length changes, update the `song('<world>', <loop>)` entry in `js/samples.js` (the script prints it).
- Level check: all pieces sit at about -34 LUFS in game, like Breakfast. `tools/render.py` renders the game's own
  audio offline and prints loudness; `tools/bands.py` compares tonal balance against a reference.

## Recordings

- `raw/<group>/<id>.json` holds title, author, URL and licence of every recording used (all CC0). The audio is not in
  the repository. Fetch it again with
  `python -I tools/fs_search.py --get ID,ID,... --to raw/<group>` (slow: Freesound rate-limits).
- Engines: `sh tools/engine_loops.sh` cuts the loops, `python -E -P tools/build_assets.py ../.. engine` levels and
  encodes them. Check new loops for slow level swell with `tools/steady.py` (that is what made the first one throb).
- Backgrounds: `tools/amb.py` holds each table's beds and one-shots (source, start, length, level).
  `python -E -P tools/amb.py ../.. all` writes `audio/amb/` and `work/amb.json`; `python -E -P tools/amb_js.py ../..`
  writes them into `js/samples.js` (it only fills one-line `{ music: song(...) }` entries, so edit existing entries by hand).
- `python -E -P tools/credits.py ../..` regenerates `audio/CREDITS.md` and refuses anything not CC0.

## Testing

`python -E -P tools/test_game.py "" grund out.png` plays a race on a table in headless Edge and reports which audio
files were fetched and which buffers started. Both test scripts serve the repository root (or `TT_ROOT`).
