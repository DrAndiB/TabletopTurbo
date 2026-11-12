# Tabletop Turbo: roadmap and idea bank

## Version 1.8 (in progress, November 2026): playing alone on a phone

Andreas plays mostly alone, on a phone, mostly championships (12 November 2026). His two complaints: hazards that
come into view too late to avoid (worst in portrait), and computer drivers that are hard to beat on some tables and
far behind on others.
- **Done: solo camera** (`soloFocus`, `SOLO_CAM` in game.js). With one human driver the view frames the car and the
  road about a second ahead, compensates the camera's trailing lag, and widens by up to 1.5x upright (1.3x flat).
  Measured with a CPU at the wheel on four tables: the road 0.9 s ahead is on screen 95-100 % of the time (before:
  6-26 %). Head-to-head and shared-screen races are unchanged.
- **Done: Matched computer drivers** (`MATCH` in game.js, levels in records.js). A fourth setting for the rivals and
  the new default: drivers that corner like Hard ones, whose top-speed level per table moves after every race
  towards the player winning by 1 s (up to 4 levels of 1.5 % a race). A table never raced starts from the average of
  the others; during a race, drivers behind the player get up to 10 % more speed. Only with one human, in races and
  championships. First version (Normal drivers, 2 levels a race) was far too slow for Andreas: reworked the same day.
- **Done: hazard-aware computer drivers** (`aiDodge` in game.js, `aiHazards()` per world): they steer for the free
  side of a timed hazard or slow down to arrive after it. Listed so far on the Time Machine Cup tables only (T-rex,
  knights, catapult, cannon, tentacles, lasers, robot arms); on Robo Rumble they lap about 15 % faster for it.
- **Done: career stars** (records.js, main.js): best race result per table with one human and at least two rivals
  (3 won, 2 second, 1 third; at most 1 against Easy), shown on the table cards, as a total, and after a race.
- **Done: visual pass over the Time Machine Cup.** Dino Dash: stegosaurus the right way round, the brachiosaurus's
  neck sways and dips and its tail swishes, a pterodactyl rocking on its wire, the skeleton's skull and tail,
  raptors, boulders, footprints, reeds, lava. Castle Siege: windmill with turning sails, wheat fields, peg-doll
  people, a dragon beating its wings, seamless grass. Pirate Cove: a galleon with a deck and bow, reefs, a wreck, a
  sea serpent, rowing boats. Robo Rumble: dark roofs with roof lights, street lamps, an energy core, a giant robot,
  a radar dish.
- **Done: detail pass over the Time Machine Cup** (Andreas: "add more detail to the new tracks"). Shared builders
  in `_tm.js` for a painted ground (`groundCanvas`: a canvas over the whole mat with soft bands along the track,
  blobs, dots, labels, borders), sign boards, bunting, flat pictures and road decals. Dino Dash: a printed play mat
  (dirt shoulder, stream and pond, place names, compass), a bigger table with a picture book, a tub of dinosaurs, a
  cup, crayons, a drawing, a ruler and a magnifying glass, an ankylosaurus, two parasaurolophus, hatchlings, logs,
  mushrooms, flowers, grass, a glowing smoking volcano, dragonflies. Castle Siege: a painted board (farmland,
  lanes, cobbled courtyard, chequered frame), arrow slits, banners, torches, sentries, a stable, a smithy, a hay
  cart, a siege camp with a fire, sheep, an orchard, a scarecrow, flags that stir. Pirate Cove: painted water
  (channel, shallows and foam, reefs, the whirlpool's pit), grass, bushes, crabs and starfish on the islands, a crew
  of peg pirates, a campfire, a fort, rigging and a crow's nest, gulls, dolphins, beach things beside the tray. Robo
  Rumble: one painted and one glowing circuit-board canvas with the neon spilling off the road, a start gantry,
  lane dashes, warning stripes before the lasers and under the guards' arms, roof units and blinking beacons,
  drones, a monorail, neon adverts, searchlights, a workbench round the mat (kit box, mug, soldering iron,
  screwdrivers, gears, plans). Dino Dash and Robo Rumble now end at the table edge, not the mat edge. New thumbnails.
- **Still open:** medal times in time trial; warning markers for hazards outside the view; hazard lists for the
  older cups (doors, trains, trapdoors already have their own driver logic there).
- **Idea bank from the same brainstorm:** challenges per table, a daily race, unlockable paint jobs, named rivals,
  elimination and checkpoint modes, tilt or slider steering, a left-handed layout, haptics, resuming a championship,
  a 30 fps battery saver, cloud save.

## Version 1.7 (built November 2026): the Time Machine Cup

Andreas asked for "four more tracks, surprise me" (12 November 2026). Four toy sets from four ages, easy to expert,
every hazard telegraphed and periodic. The four worlds share their builders in `js/worlds/_tm.js` (toys merged from
vertex-coloured parts into one mesh each, the table, the road ribbon, edge markers, blasts).
- **Dino Dash** (4x4, easy): a prehistoric play set on a felt mat. A toy T-rex rears back, then tips forward and snaps
  at the lane beside it; a stegosaurus sweeps its tail across the inside of the road; a rib cage to drive through, a
  dirt hump, a tar pit, eggs to shove about, a brachiosaurus with its neck over the road.
- **Castle Siege** (rally, medium): a wooden-block castle. Jump the moat off the half-raised drawbridge (fall in and
  you restart with a run-up), through the gatehouse and the courtyard with its barrels; two jousting knights on
  wheels charge across the west road (a bell first); a catapult lobs wooden balls at two marks that glow first; mud.
- **Pirate Cove** (speedboats, hard): a paddling tray with islands. A whirlpool to ride or avoid, rapids in the
  narrows, a galleon firing at two foam marks, a kraken reaching four tentacles into the lanes in turn, flotsam.
- **Robo Rumble** (formula, expert): a tin-robot city on a circuit-board mat at night. Boost pads, two laser gates
  that close one half of the road and then the other (and throw you back), two guard robots slamming an arm across
  the inside lane (red eyes first), a conveyor belt against you, a ramp over sleeping service robots, coolant.
- Synthesised music and backgrounds; no new vehicles or cue sounds (snap, bell, clank and tick are reused).
- Not done yet, worth a review round: CPU drivers do not time the knights, the arms or the lasers (they take the
  hits); the worlds are plainer than the Pharaoh Cup tables (fewer fine props, simpler ground textures).

## Version 1.6 (built October 2026): the Pharaoh Cup

Andreas asked for "an egypt cup" (30 October 2026). Four tables from easy to expert, each with a new vehicle or a
signature hazard, every hazard telegraphed and periodic:
- **Giza Sandpit** (dune buggy, easy): a child's sandpit on a garden patio sculpted into the Giza plateau. Bucket
  pyramids, a sand sphinx, a packed-sand ramp that jumps the "Nile" trench (fall in and you restart with a run-up),
  a dune hump, a toy camel caravan crossing on a string with tin bells first, a mud patch, pushable moulds.
- **Nile Cruise** (speedboats, medium): a school diorama of the Nile at Aswan. The cataract's white water carries
  you through two or three lines between granite boulders, a gentle current against you on the way back, toy
  crocodiles whose eyes surface before they lunge into the outer lane, feluccas tacking across as traffic.
- **Pharaoh's Tomb** (4x4 trucks, hard): a museum cutaway of a pyramid's chambers, dark with torches and headlights.
  Up the Grand Gallery to the King's Chamber and down again; three stone doors drop in a green wave you can learn
  (lamps, dust and a grinding rumble first; queued cars wait), sand pours from cracked ceiling blocks.
- **Sandstorm Valley** (rally, expert): a sunset diorama of a valley of royal tombs. Up the temple terraces, a
  colonnade slalom, a cliff ledge, a jump across the wadi; every 21 s a sandstorm sweeps across from the east (a
  camp horn first) and its crosswind pushes you sideways, then leaves sand drifts on the road.
- **Dune buggy** (`buggy`): light, quick off the line and sure-footed in sand; it borrows the rally car's recorded
  engine.
- Synthesised music in the hijaz scale (oud, qanun, ney, darbuka rhythms) and backgrounds; new cue sounds: the
  crocodile's snap, the stone doors' grind, the storm's gusts, a camel's tin bell.

## Version 1.5 (built October 2026): the Mayhem Cup

Andreas asked for "a new challenging cup, 4 tracks, go crazy" (28 October 2026). The hardest cup in the game, each
table built round a moving floor, every hazard telegraphed and periodic:
- **Sushi Express** (formula): a conveyor-belt sushi counter. The road rides the belt with it (a boost) and against
  it (a headwind), plates ride the belt as traffic, an express delivery tray shoots across the loop.
- **Vinyl Frenzy** (hovercraft): a club DJ booth. Two spinning records (one slingshot, one against you), tone arms
  that swing in, mixer faders sliding across the road in a wave, speakers that shove cars on every kick (124 bpm,
  the music locked to it).
- **Opening Night** (rally): a set designer's theatre model during the show. A revolving stage carrying scenery
  through the road, a trap room with trapdoors in sequence, flying flats and a swinging sandbag, the orchestra pit.
- **Eruption!** (monster truck): a science-fair volcano erupting every 20 s. Foam surges flood two crossings (beat
  it or wait), lava bombs land on glowing target rings, boulders roll down across the terrace.
- Synthesised music and backgrounds for now (Vinyl Frenzy's is beat-locked).

## Version 1.4 (built October 2026): the Drift Cup

Moved up from the idea bank on 26 October 2026. Decided with Andreas: a drift boost (not a score mode), started by a
brake tap while steering (no extra key), only on the four new tables, with a new drift car.

- **Drift mechanics** (`DRIFT` in physics.js, CPU drifting in ai.js): a brake tap while steering kicks the tail out;
  hold the slide to charge sparks (blue, then orange); steer out of it for a boost. Hints for new players.
- **Drift car** (`drifter`): a wide rear-drive coupé with flared arches, a big wing and gold wheels.
- **Four tables, easy to expert:** Butter Slide (a baking worktop), Switchback Pass (an alpine pass diorama with
  three linked hairpins and a gorge), Ten-Pin Drift (real-size bowling lanes, gutters and pins, a rolling ball),
  Neon Rooftop (a night diorama of a car park and roofs, with a jump across an alley).
- Synthesised music and backgrounds for now; recorded versions can be rendered in the sound lab later.
- Also in this round: portrait play and the Screen setting in the Android app, the camera leading the car when the
  phone is upright, recorded music and backgrounds (engines back to the synthesised voices).

## Version 1.3 (built October 2026)

All ten items below are in 1.3.

Collected while playing the 1.2 web version and the first Android preview (October 2026). Each item has a short
note on the plan agreed so far. Items 1–9 are fixes and polish; item 10 is new content.

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
10. **Grand Duchy Cup: four Luxembourg-inspired tracks** as their own cup, a fifth cup alongside the other four, ordered
    easy to expert (moved up from the idea bank on 15 October 2026). Each one a different kind of tabletop scene of
    a real place; generic and original designs, no real logos.
    1. *Crémant Curves* (easy): a Moselle wine tasting. Vineyard terraces of stacked trays, a blue fabric runner as
       the river with a riverboat, crémant glasses and corks, grapes to push, a spilled-wine slick. 4x4 truck.
    2. *Fouer Frenzy* (medium): the Schueberfouer at night. Lit stalls (Gromperekichelcher, Fouerfësch), a Ferris
       wheel, a roller-coaster section for jumps, a run through a bumper-car rink (also the first battle arena later).
       New vehicle: **bumper cars** (decided): rubber bumper ring, pole up to a sparking ceiling grid, extra-bouncy
       collisions, an electric hum for the vehicle sound (item 7).
    3. *Grund Prix* (hard): a model-maker's diorama of Grund and Clausen. Cobbled road along the winding Alzette with
       bridges and a ford, a tunnel through the Bock casemates rock, a loop round Neimënster's cloister, weaving
       through the arches of the railway viaduct with a model train above, a hairpin climb past the Wenzel wall to the
       Rham plateau. A little tourist train as a moving hazard. Rally car.
    4. *Old Town Jigsaw* (expert): a half-finished jigsaw of the Ville Haute on a coffee table. Tight streets past the
       Knuedler market, the palace sentry box, the cathedral and the Gëlle Fra; the Chemin de la Corniche along the
       puzzle's edge (fall off); a jump between puzzle sections as the Adolphe Bridge; missing pieces are holes,
       loose pieces can be pushed. Formula racer.

## Idea bank (not for the next version)

- **More Luxembourg tracks** (spares from the Grand Duchy Cup brainstorm): Kirchberg (red bridge, tram,
  Pfaffenthal lift), Vianden (castle, chairlift), Mullerthal (sandstone gorges), Esch-Belval blast furnaces (could
  double as an industrial drift track).
- **Drift score mode.** Points for slide angle, speed and duration, with combos, as its own mode on the Drift Cup
  tables (the boost is in 1.4).
- **Battle mode on arena tracks.** Enclosed arenas instead of laps (a dinner plate, a frying pan, a chessboard).
  Possible rules: push everyone off (sumo), tag or hot potato, capture the flag; possibly power-ups.
