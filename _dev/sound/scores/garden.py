"""Garden Grand Prix: sunny acoustic folk in G, 116 bpm, 28 bars (verse, hook, half verse, bridge with a build).
Steel-string guitar carries the tune (an octave below the written line), a high nylon guitar strums like a ukulele,
acoustic bass, brush kit with rim and shaker. The bridge hands the tune to a nylon guitar over a picked arpeggio.
Final lap: a flute doubles the tune an octave above the guitar."""
import os, sys, re
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

def tr(text, n):
    """transpose note text by n semitones"""
    names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
    out = []
    for tok in text.split():
        p, d = tok.split(':')
        if p != 'r': p = '+'.join(names[(midi(q) + n) % 12] + str((midi(q) + n) // 12 - 1) for q in p.split('+'))
        out.append(f'{p}:{d}')
    return ' '.join(out)

S = Song('garden', 116, 28, seed=11)
VERSE_CH = ['G', 'D/F#', 'Em', 'C', 'G', 'D', 'C', 'D']
HOOK_CH = ['C', 'G', 'D', 'Em', 'C', 'G', 'Am7', 'D']
HALF_CH = ['G', 'D/F#', 'C', 'D']
BRIDGE_CH = ['Em', 'Bm', 'C', 'G', 'Em', 'Bm', 'Am7', 'D']
S.set_chart(VERSE_CH + HOOK_CH + HALF_CH + BRIDGE_CH)
SEC = lambda b: 'V' if b < 8 else 'H' if b < 16 else 'V2' if b < 20 else 'Bq' if b < 24 else 'Bb'
G_MAJ = {7, 9, 11, 0, 2, 4, 6}
S.scale = G_MAJ

kit = S.part('kit', 40, 9, vol=110, rev=25)              # brush kit
bass = S.part('bass', 32, 0, vol=108, rev=12)            # acoustic bass
uke = S.part('uke', 24, 1, vol=86, pan=84, rev=40)       # nylon guitar voiced high, strummed like a ukulele
lead = S.part('lead', 25, 2, vol=100, pan=52, rev=45, cho=20)   # steel-string lead
lead2 = S.part('lead2', 24, 3, vol=100, pan=60, rev=55)  # bridge tune on nylon
pick = S.part('pick', 25, 4, vol=80, pan=34, rev=50)     # picked arpeggio (bridge, hook)
strs = S.part('str', 48, 5, vol=72, rev=70)
flute = S.part('flute', 73, 6, final=True, vol=92, pan=70, rev=60)

VERSE = [
    'D5:0.5 G5:0.5 B5:1 A5:0.5 G5:0.5 D5:1',
    'F#5:0.5 A5:0.5 D6:1 C6:0.5 A5:0.5 F#5:1',
    'G5:0.5 E5:0.5 B4:1 E5:0.5 G5:0.5 B5:1',
    'A5:1.5 G5:0.5 E5:2',
    'D5:0.5 G5:0.5 B5:1 A5:0.5 G5:0.5 D5:1',
    'A5:0.5 F#5:0.5 D5:1 E5:0.5 F#5:0.5 A5:1',
    'G5:0.5 E5:0.5 C5:1 E5:0.5 G5:0.5 C6:1',
    'B5:1 A5:1 F#5:1 r:1',
]
HOOK = [
    'E5:1 G5:1 C6:1.5 B5:0.5',
    'B5:1 A5:0.5 G5:0.5 D5:2',
    'F#5:1 A5:1 D6:1.5 C6:0.5',
    'B5:2 r:1 B5:0.5 C6:0.5',
    'E6:1 D6:0.5 C6:0.5 G5:1 E5:1',
    'D5:1 G5:0.5 A5:0.5 B5:2',
    'C6:1 B5:0.5 A5:0.5 E5:1 G5:1',
    'F#5:2 A5:1 r:1',
]
HALF = VERSE[:2] + ['G5:0.5 E5:0.5 C5:1 E5:0.5 G5:0.5 C6:1', 'B5:1.5 A5:0.5 F#5:1 D5:1']
BRIDGE = [
    'B5:2 G5:1 E5:1',
    'F#5:2 D5:1 B4:1',
    'E5:1 G5:1 C6:2',
    'B5:3 r:1',
    'B5:1 C6:1 B5:1 G5:1',
    'A5:1 B5:1 F#5:1 D5:1',
    'E5:1 G5:1 A5:1 C6:1',
    'D6:1 C6:1 A5:1 F#5:0.5 A5:0.5',
]
acc = lambda b: 8 if b in (0, 2) else 0
for x in VERSE + HOOK + HALF + BRIDGE: assert abs(sum(float(t.split(':')[1]) for t in x.split()) - 4) < 1e-6, x
WRITTEN = [(0, VERSE), (8, HOOK), (16, HALF)]
for b0, tune in WRITTEN:
    S.melody(lead, b0, [tr(x, -12) for x in tune], 96, legato=0.9, accent=acc)
    S.melody(flute, b0, tune, 84, legato=0.9, accent=acc)
S.melody(lead2, 20, [tr(x, -12) for x in BRIDGE], 92, legato=0.95, accent=acc)
S.melody(flute, 24, BRIDGE[4:], 80, legato=0.95)  # flute sits out the quiet half of the bridge

# ukulele-style strums: busy in the verses, open in the hook, gone in the quiet bridge, back for the build
S.strum(uke, [(0, 'D', 1.0), (1, 'D', 0.7), (1.5, 'U', 0.55), (2.5, 'U', 0.6), (3, 'D', 0.8), (3.5, 'U', 0.55)], midi('A4'), 4, 70,
        spread=0.012, only=lambda b: SEC(b) in ('V', 'V2'))
S.strum(uke, [(0, 'D', 1.0), (1.5, 'U', 0.6), (2, 'D', 0.8), (3, 'D', 0.75), (3.5, 'U', 0.6)], midi('A4'), 4, 74,
        spread=0.012, only=lambda b: SEC(b) in ('H', 'Bb'))
S.arp(pick, midi('D4'), 0.5, 'updown', 4, 64, length=0.9, only=lambda b: SEC(b) in ('H', 'Bq'))
S.pad(strs, midi('G4'), 3, 56, only=lambda b: SEC(b) in ('H', 'Bq', 'Bb'), bass=midi('D3'))

# bass
S.bassline(bass, midi('E1'), 'root2', 96, only=lambda b: SEC(b) in ('V', 'V2'))
S.bassline(bass, midi('E1'), 'rootfifth', 98, only=lambda b: SEC(b) == 'H')
S.bassline(bass, midi('E1'), 'root', 88, only=lambda b: SEC(b) == 'Bq')
S.bassline(bass, midi('E1'), 'root8', 92, only=lambda b: SEC(b) == 'Bb' and b < 27)
for i, m in enumerate(['D2', 'D2', 'A2', 'D3', 'C3', 'B2', 'A2', 'F#2']):  # last bar walks down into G
    bass.add(27 * 4 + i * 0.5, 0.42, midi(m), 90 + i * 1.5)

# drums: brush kit, rim on 2 and 4, shaker 8ths
for b in range(28):
    s, t = SEC(b), b * 4
    if s in ('V', 'V2'):
        S.pattern(kit, b, 'x.......x.x.....', KICK, 96)
        S.pattern(kit, b, '....x.......x...', STICK, 82)
        S.pattern(kit, b, 'x.o.x.o.x.o.x.o.', MARACAS, 60)
    elif s == 'H':
        S.pattern(kit, b, 'x.....x.x.......', KICK, 100)
        S.pattern(kit, b, '....x.......x...', SNARE, 86)
        S.pattern(kit, b, 'xoxoxoxoxoxoxoxo', MARACAS, 58)
        S.pattern(kit, b, '....x.......x...', TAMB, 58)
    elif s == 'Bq':
        S.pattern(kit, b, 'x.......x.......', KICK, 84)
        S.pattern(kit, b, '............x...', STICK, 66)
        S.pattern(kit, b, 'x...x...x...x...', MARACAS, 48)
    else:
        S.pattern(kit, b, 'x...x...x...x...', KICK, 90 + (b - 24) * 3)
        S.pattern(kit, b, 'x.o.x.o.x.o.x.o.', MARACAS, 54 + (b - 24) * 4)
        if b < 27: S.pattern(kit, b, '....x.......x...', SNARE, 84)
        else: S.pattern(kit, b, '....x.......xoxx', SNARE, 82)
    if b in (0, 8): S.hit(kit, t, CRASH, 74)
    if b == 7: S.pattern(kit, b, '............x.xx', SNARE, 70)

S.check_key(G_MAJ)
GAIN = {'kit': -19, 'bass': -20, 'uke': -23.5, 'lead': -18.5, 'lead2': -19, 'pick': -25.5, 'str': -27, 'flute': -24}
# acoustic guitars are warm already: no top cut, a little less low-mid boxiness than the default bus
bus = lambda x: eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 800, 0.8, -2), 'highshelf', 6000, 0.7, 1.5)
print('loop', S.finish(GAIN, bus=bus))
