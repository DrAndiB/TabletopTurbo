"""Breakfast table: sunny strummed pop in D, 124 bpm, 32 bars (verse, chorus, verse, bridge), loops seamlessly.
Writes work/music/breakfast/{main,final}.wav (loop + 3 s tail) and a folded preview of the loop.
"""
import os, random, sys, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mus import Part, voicing, chord, midi, stems, comp, eq, db, loudness, wrap, SR

random.seed(7)
BPM = 124; BARS = 32; END = BARS * 4; TAIL = 3.0
BEAT = 60 / BPM; N_LOOP = round(END * BEAT * SR); N = N_LOOP + int(TAIL * SR)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'work', 'music', 'breakfast')

# ---------------------------------------------------------------- harmony (one chord per bar unless 'X Y')
A = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em7', 'A7']
B = ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D A7']
C = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em7', 'A7']
CHART = A + B + A + C
def chords_at(bar):
    xs = CHART[bar].split(); return [(bar * 4 + i * 4 / len(xs), 4 / len(xs), c) for i, c in enumerate(xs)]
ALLCH = [c for b in range(BARS) for c in chords_at(b)]
SEC = lambda bar: 'A1' if bar < 8 else 'B' if bar < 16 else 'A2' if bar < 24 else 'C'

# ---------------------------------------------------------------- parts
P = {
    'kit': Part('kit', 0, 9, vol=110, rev=25),
    'bass': Part('bass', 33, 0, vol=105, rev=10),
    'gtr': Part('gtr', 25, 1, vol=88, pan=44, rev=45, cho=30),
    'pno': Part('pno', 1, 2, vol=80, pan=84, rev=50),
    'str': Part('str', 48, 3, vol=72, rev=70),
    'glock': Part('glock', 9, 4, vol=88, pan=72, rev=60),
    'whistle': Part('whistle', 78, 5, vol=92, rev=60),
    'vibes': Part('vibes', 11, 6, vol=92, pan=58, rev=70),
    'pizz': Part('pizz', 45, 7, vol=80, pan=40, rev=45),
}
F = {  # final-lap layer
    'fkit': Part('fkit', 0, 9, vol=100, rev=20),
    'fglock': Part('fglock', 9, 4, vol=80, pan=84, rev=60),
    'fpizz': Part('fpizz', 45, 7, vol=78, pan=30, rev=45),
}

# ---------------------------------------------------------------- melodies
VERSE = [
    'r:0.5 A4:0.5 D5:0.5 F#5:0.5 A5:1 F#5:0.5 E5:0.5',
    'D5:1.5 B4:0.5 D5:1 F#5:1',
    'G5:0.5 F#5:0.5 E5:0.5 D5:0.5 B4:1 D5:1',
    'C#5:1.5 E5:0.5 A4:2',
    'r:0.5 A4:0.5 D5:0.5 F#5:0.5 A5:1 B5:0.5 A5:0.5',
    'F#5:1.5 D5:0.5 B4:1 D5:1',
    'G5:0.5 F#5:0.5 E5:0.5 D5:0.5 E5:1 G5:1',
    'E5:1.5 C#5:0.5 A4:1 r:1',
]
HOOK = [
    'B5:0.75 A5:0.75 G5:0.5 D5:1 G5:1',
    'C#6:0.75 B5:0.75 A5:0.5 E5:1 A5:1',
    'C#6:0.75 A5:0.75 F#5:0.5 C#5:1 F#5:1',
    'D6:1.5 C#6:0.5 B5:2',
    'B5:0.75 A5:0.75 G5:0.5 D5:1 G5:1',
    'C#6:0.75 B5:0.75 A5:0.5 E5:1 C#6:1',
    'D6:1.5 A5:0.5 F#5:1 A5:1',
    'D6:2 r:1 A5:0.5 C#6:0.5',
]
BRIDGE = [
    'F#5:1 D5:1 B4:2',
    'G5:1 D5:1 B4:2',
    'A5:1 F#5:1 D5:1 E5:1',
    'C#5:3 r:1',
    'F#5:1 D5:1 B4:1 D5:1',
    'G5:1 B5:1 A5:1 G5:1',
    'E5:1 G5:1 B5:1 D6:1',
    'C#6:1 B5:1 A5:1 G5:1',
]
acc = lambda b: 8 if b in (0, 2) else 0
for i, bar in enumerate(VERSE):
    P['glock'].seq(i * 4, bar, 84, legato=1.0, hum=0.3, accent=acc)
    P['glock'].seq((16 + i) * 4, bar, 84, legato=1.0, hum=0.3, accent=acc)
    P['pizz'].seq((16 + i) * 4, bar, 70, legato=0.5, hum=0.3)  # second verse: pizzicato doubles the tune
for i, bar in enumerate(HOOK):
    P['whistle'].seq((8 + i) * 4, bar, 92, legato=0.9, hum=0.3, accent=acc)
    F['fglock'].seq((8 + i) * 4, bar, 76, legato=1.0, hum=0.3)
for i, bar in enumerate(BRIDGE):
    P['vibes'].seq((24 + i) * 4, bar, 80, legato=1.0, hum=0.3, accent=acc)

# a little answering figure on pizzicato in the first verse's gaps (bars 4 and 8 end on held notes) — final layer
for b in (3, 7, 19, 23):
    F['fpizz'].seq(b * 4 + 2, 'E5:0.5 F#5:0.5 G5:0.5 A5:0.5' if b in (3, 19) else 'A5:0.5 G5:0.5 E5:0.5 C#5:0.5', 68, legato=0.5)

# ---------------------------------------------------------------- bass: root/fifth/octave with an approach note
def pc_root(sym): return chord(sym)[0]
def bass_note(pc, lo=midi('A1')): return lo + (pc - lo) % 12
for k, (t, d, sym) in enumerate(ALLCH):
    bar = int(t // 4); s = SEC(bar); r = bass_note(pc_root(sym)); nxt = bass_note(pc_root(ALLCH[(k + 1) % len(ALLCH)][2]))
    fifth = r + 7 if r + 7 <= midi('E3') else r - 5
    B_ = P['bass']
    if s == 'C' and bar < 28:  # bridge: long notes, then pulsing eighths into the build
        B_.add(t, d * 0.95, r, 92); continue
    if s == 'C':
        for j in range(int(d * 2)): B_.add(t + j * 0.5, 0.4, r, 84 + (8 if j % 2 == 0 else 0))
        continue
    if d < 4:  # half-bar chords: root + fifth
        B_.add(t, 1.0, r, 98); B_.add(t + 1, 0.5, fifth, 84); B_.add(t + 1.5, 0.45, r + 12 if r + 12 <= midi('D3') else r, 80); continue
    app = next(nxt + k for k in (-1, 2, 1, -2) if (nxt + k) % 12 in (2, 4, 6, 7, 9, 11, 1))  # a step into the next root, in key
    for b_, dur, m, v in [(0, 0.9, r, 100), (1, 0.45, r, 82), (1.5, 0.45, fifth, 86), (2, 0.45, r + 12, 88), (2.5, 0.45, r, 80), (3, 0.45, fifth, 84), (3.5, 0.45, app, 78)]:
        B_.add(t + b_, dur, m, v + random.uniform(-4, 4))

# ---------------------------------------------------------------- guitar strums (down/up, 8th-note pattern)
STRUM = [(0, 'D', 1.0), (1, 'D', 0.8), (1.5, 'U', 0.6), (2.5, 'U', 0.65), (3, 'D', 0.85), (3.5, 'U', 0.6)]
for t, d, sym in ALLCH:
    bar = int(t // 4); s = SEC(bar)
    if s == 'C' and bar < 28: continue
    notes = voicing(sym, midi('D4'), 4) + [voicing(sym, midi('A3'), 1)[0]]
    notes = sorted(set(notes))
    for b_, dir_, v in STRUM:
        if b_ >= d: continue
        if s == 'C': v *= 0.7
        order = notes if dir_ == 'D' else notes[::-1]
        for j, m in enumerate(order):
            P['gtr'].add(t + b_ + j * 0.018 + random.uniform(0, 0.01), 0.42 if b_ + 0.5 < d else d - b_, m, 74 * v + random.uniform(-5, 5))

# ---------------------------------------------------------------- piano: off-beat stabs in the chorus and second verse
for t, d, sym in ALLCH:
    s = SEC(int(t // 4))
    if s not in ('B', 'A2'): continue
    v = 78 if s == 'B' else 62
    for b_ in (0.5, 1.5, 2.5, 3.5):
        if b_ < d:
            for m in voicing(sym, midi('A4'), 3): P['pno'].add(t + b_, 0.22, m, v + random.uniform(-4, 4))

# ---------------------------------------------------------------- strings: pads under chorus and bridge
for t, d, sym in ALLCH:
    s = SEC(int(t // 4))
    if s not in ('B', 'C'): continue
    for m in voicing(sym, midi('F#4'), 3) + [voicing(sym, midi('D3'), 1)[0]]: P['str'].add(t, d * 0.98, m, 58 if s == 'B' else 66)

# ---------------------------------------------------------------- drums
KICK, SNARE, STICK, CLAP, HAT, OHAT, PHAT, CRASH, TAMB, SHAKER, TRI = 36, 38, 37, 39, 42, 46, 44, 49, 54, 70, 81
K = P['kit']
def hit(part, beat, note, v): part.add(beat + random.uniform(-0.004, 0.004), 0.2, note, v + random.uniform(-5, 5))
for bar in range(BARS):
    t = bar * 4; s = SEC(bar)
    if s in ('A1', 'A2'):
        for b_ in (0, 2, 2.5): hit(K, t + b_, KICK, 100 if b_ == 0 else 88)
        for b_ in (1, 3): hit(K, t + b_, STICK if s == 'A1' else SNARE, 84 if s == 'A1' else 92)
        for j in range(8): hit(K, t + j * 0.5, OHAT if j == 7 else HAT, 58 if j % 2 == 0 else 42)
    elif s == 'B':
        for b_ in (0, 1.5, 2, 3.5 if bar % 2 else 99):
            if b_ < 4: hit(K, t + b_, KICK, 104 if b_ == 0 else 90)
        for b_ in (1, 3): hit(K, t + b_, SNARE, 100); hit(K, t + b_, CLAP, 84)
        for j in range(8): hit(K, t + j * 0.5, OHAT if j == 7 else HAT, 64 if j % 2 == 0 else 46)
    else:  # bridge: sparse, then the build
        if bar < 28:
            hit(K, t, KICK, 92); hit(K, t + 2, KICK, 80); hit(K, t + 3, CLAP, 66)
            if bar % 2: hit(K, t + 3.5, TRI, 60)
        else:
            for b_ in (0, 1, 2, 3): hit(K, t + b_, KICK, 86 + (bar - 28) * 4)
            for j in range(8): hit(K, t + j * 0.5, HAT, 54 + (bar - 28) * 6)
            if bar < 31: hit(K, t + 1, SNARE, 80); hit(K, t + 3, SNARE, 86)
            else:
                for j in range(16): hit(K, t + j * 0.25, SNARE, 50 + j * 4)  # snare roll into the loop
    if bar in (0, 8, 16): hit(K, t, CRASH, 96 if bar == 8 else 84)

# final layer: shaker 16ths and tambourine on 2 and 4 (not in the quiet half of the bridge)
FK = F['fkit']
for bar in range(BARS):
    if SEC(bar) == 'C' and bar < 28: continue
    t = bar * 4
    for j in range(16): hit(FK, t + j * 0.25, SHAKER, 64 if j % 4 == 0 else 50 if j % 2 == 0 else 40)
    for b_ in (1, 3): hit(FK, t + b_, TAMB, 72)

# ---------------------------------------------------------------- render and mix
def mix(parts, gains, tag):
    S = stems(list(parts.values()), BPM, END + TAIL / BEAT, os.path.join(OUT, 'stems-' + tag), N)
    # each stem to a target loudness while it plays (the meter's gate skips its silent sections)
    y = 0
    for k, v in S.items():
        l = loudness(v[:N_LOOP]); y = y + v * db(gains[k] - l)
        print(f'  stem {k:8} {l:6.1f} -> {gains[k]} LUFS')
    return y, S

GAIN = {'kit': -19, 'bass': -20, 'gtr': -23.5, 'pno': -25, 'str': -27, 'glock': -18.5, 'whistle': -19, 'vibes': -19, 'pizz': -26,
        'fkit': -26, 'fglock': -24, 'fpizz': -25}
main, S = mix(P, GAIN, 'main')
fin, SF = mix(F, GAIN, 'final')
# bus: gentle glue compression and a softer top, then both stems share one gain (the cut on top leaves room for skids and clinks) so they stay balanced
bus = lambda x: eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 3500, 1.0, -2.5), 'highshelf', 5000, 0.7, -3)
main, fin = bus(main), bus(fin)
g = db(-16 - loudness(wrap(main + fin, N_LOOP)))
main *= g; fin *= g
pk = max(np.abs(main + fin).max(), 1e-9)
if pk > 0.95: main *= 0.95 / pk; fin *= 0.95 / pk
os.makedirs(OUT, exist_ok=True)
sf.write(os.path.join(OUT, 'main.wav'), main, SR, subtype='PCM_16')
sf.write(os.path.join(OUT, 'final.wav'), fin, SR, subtype='PCM_16')
sf.write(os.path.join(OUT, 'preview-loop.wav'), np.concatenate([wrap(main, N_LOOP)] * 2), SR, subtype='PCM_16')
sf.write(os.path.join(OUT, 'preview-final.wav'), wrap(main + fin, N_LOOP), SR, subtype='PCM_16')
print(f'loop {N_LOOP / SR:.6f}s  main {loudness(wrap(main, N_LOOP)):.1f} LUFS  main+final {loudness(wrap(main + fin, N_LOOP)):.1f} LUFS')
