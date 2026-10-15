# Tabletop Turbo: roadmap and idea bank

## Next version (1.3)

Collected while playing the 1.2 web version and the first Android preview (October 2026). Each item has a short
note on the plan agreed so far.

1. **Brake button for touch controls.** Today touch only brakes when both sides are held, so you can't steer and brake
   at once (hard with boats and hovercraft). A visible brake button by the right thumb that works together with
   steering, and reverses when held at a standstill.
2. **Close the remaining shortcuts.** Cuts shorter than `maxShortcut` (45 track units) are not caught, and a sharp
   hairpin can still be cut for a big gain, e.g. the hairpin on Watchmaker's Bench. Fix it per corner (tighter
   limit or an invisible barrier), then scan all 16 tracks for other corners where cutting pays off.
3. **Automatic reset for stuck cars.** Back on track after 6 s without forward progress (measured along the track,
   so pushing against a wall counts as stuck). The timer pauses while a world says the car is waiting at a closed
   crossing or gate. A "Stuck? Back on track in 3…" hint first. For CPUs too. Measured waits with CPU drivers
   (Oct 2026): train crossings 2.4–3.3 s, sluice gates 2.6 s; the longest real stops (4–5.2 s) were cars tangled
   on Homework Hustle, Reaction Rally and Watchmaker's Bench.
4. **More time for CPUs to finish.** The race now ends 1.5 s after the last human finishes. Keep it running up to
   ~8 s longer (or until every CPU is home) so they get real finish times; the rest are ranked by distance with a
   "+0.3 lap" gap. Tap or Enter skips. Optionally the camera turns to the cars coming up to the line.
5. **Mini map.** Small top-down track outline turned to match the camera, a dot per car in player colours (humans
   bigger, ghost as a hollow dot). Setting "Mini map: Auto / On / Off", M toggles in a race. Auto shows it in Race,
   Championship and Time trial with one human; off in head-to-head and with several humans. Bottom-left on
   keyboard, bottom-centre on touch.
6. **Turbo start for touch and Easy keys.** Auto-gas drivers can't do one today (`autoGas` skips them). During the
   countdown, a touch (or either steering key for Easy keys) counts as gas: last 0.3 s before GO = turbo,
   held since before the last beep = bogged launch. Hint "Tap at GO for a turbo start!" for touch players.
7. **Engine and skid sounds per vehicle type.** Today all ten vehicles share one synth and the tyre squeal.
   Sports: as now, smoother. Formula: high whine, more gears. Rally: raspy, gravel crunch. 4x4: low diesel chug.
   Monster truck: deep burble, heavy landings. SUV: quiet purr. Rover: electric whine, servo whirr, sand hiss.
   Speedboat: outboard buzz, spray hiss, splash landings. Hovercraft: fan whoosh, air hiss. Snowmobile: two-stroke
   rattle, snow crunch.
8. **Music and background sounds per track.** Races have no music today. One original, procedurally generated
   piece and an ambient layer per track (breakfast pop with kettle and birds, lounge jazz at the pool table,
   theremin on Mars, organ waltz in the dollhouse, harpsichord in time with the balance wheel on Watchmaker's
   Bench, and so on). Sounds as cues: train whistle before a crossing, sluice gates clank before they move, the
   escapement tick. A layer added on the final lap. Music ducks under the engines. Separate music and effects
   settings. Can ship in stages.
9. **New hovercraft model**, after Andreas's RC hovercraft: white deck with long sides and rounded ends, fat
   segmented black skirt, long low cabin with dark windows and a band in the player's colour, ribbed roof with a
   mast and the race number, twin ducted fans with stripes in the player's colour and a rudder behind each fan.
   Same footprint, so handling and collisions stay as they are.

## Idea bank (not for the next version)

- **Luxembourg-inspired tracks: a "Grand Duchy Cup" of four** (brainstorm, October 2026, nothing decided).
  Each one a different kind of tabletop scene of a real place; generic and original designs, no real logos.
  1. *Crémant Curves* (easy): a Moselle wine tasting. Vineyard terraces of stacked trays, a blue fabric runner as
     the river with a riverboat, crémant glasses and corks, grapes to push, a spilled-wine slick. 4x4 truck.
  2. *Fouer Frenzy* (medium): the Schueberfouer at night. Lit stalls (Gromperekichelcher, Fouerfësch), a Ferris
     wheel, a roller-coaster section for jumps, a run through a bumper-car rink (also the first battle arena later).
     Possibly a new vehicle: bumper cars.
  3. *Grund Prix* (hard): a model-maker's diorama of Grund and Clausen. Cobbled road along the winding Alzette with
     bridges and a ford, a tunnel through the Bock casemates rock, a loop round Neimënster's cloister, weaving
     through the arches of the railway viaduct with a model train above, a hairpin climb past the Wenzel wall to the
     Rham plateau. A little tourist train as a moving hazard. Rally car.
  4. *Old Town Jigsaw* (expert): a half-finished jigsaw of the Ville Haute on a coffee table. Tight streets past the
     Knuedler market, the palace sentry box, the cathedral and the Gëlle Fra; the Chemin de la Corniche along the
     puzzle's edge (fall off); a jump between puzzle sections as the Adolphe Bridge; missing pieces are holes,
     loose pieces can be pushed. Formula racer.
  Spares: Kirchberg (red bridge, tram, Pfaffenthal lift), Vianden (castle, chairlift), Mullerthal (sandstone gorges),
  Esch-Belval blast furnaces (could double as an industrial drift track).
- **Drift tracks.** Tracks built for sliding: slippery surfaces (polished floor, ice, a buttered tray), wide
  sweeping corners, maybe drift scoring for angle and duration as its own mode.
- **Battle mode on arena tracks.** Enclosed arenas instead of laps (a dinner plate, a frying pan, a chessboard).
  Possible rules: push everyone off (sumo), tag or hot potato, capture the flag; possibly power-ups.
