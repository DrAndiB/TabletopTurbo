#!/bin/sh
# Cut the seamless engine loops (work/loops/<type>.wav) from the raw recordings; build_assets.py engine encodes them.
# Each window starts at the steadiest stretch found by steady.py; --flat 0.3 levels out slow swell (it made the engine throb).
# usage (from _dev/sound): sh tools/engine_loops.sh      needs ffmpeg on PATH
set -e
python -E -P tools/make_loop.py raw/engine/669623.mp3 work/loops/sports_mid.wav --from 15.5 --to 20.5 --len 3.0 --f0lo 100 --f0hi 140 --mono --hp 25 --flat 0.3
while read t f a; do
  b=$(python -c "print($a+4.6)")
  python -E -P tools/make_loop.py raw/$f.mp3 work/loops/$t.wav --from $a --to $b --len 3.0 --mono --hp 25 --flat 0.3
done <<'END'
formula veh/481726 10.2
rally veh/141459 34.0
truck veh/487152 3.5
monster veh/213977 18.5
suv engine/748027 8.6
boat veh/637744 69.6
hover veh/162251 22.6
snowmobile veh/560870 2.3
rover veh/824119 36.1
bumper veh/846905 6.7
END
