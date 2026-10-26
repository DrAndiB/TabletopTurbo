"""Shared scaffolding for the world pieces: chord charts, common accompaniment figures, render + mix + encode.

A score script builds a Song, adds notes to its parts (mus.Part, see mus.py for the note text), then calls
song.finish(gains). That renders each part through FluidSynth as a stem, sets each stem to its target loudness,
runs the bus (glue compression, softened top), normalises main + final together and writes
work/music/<name>/{main,final,preview-*}.wav and, with --encode GAME_DIR, audio/music/<name>{,-final}.mp3.

Bars have `meter` beats (quarter notes); the loop is exactly bars * meter beats long, the tail rings past it.
"""
import os, random, subprocess, sys, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mus import Part, voicing, chord, midi, stems, comp, eq, db, loudness, wrap, SR

LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = os.environ.get('FFMPEG', 'ffmpeg')

# General MIDI drum notes
KICK, KICK2, STICK, SNARE, CLAP, ESNARE, HAT, PHAT, OHAT, CRASH, RIDE, RBELL, TAMB, SPLASH, COWBELL, CRASH2 = 36, 35, 37, 38, 39, 40, 42, 44, 46, 49, 51, 53, 54, 55, 56, 57
LTOM, MTOM, HTOM, LFTOM = 45, 47, 50, 41
BONGO_H, BONGO_L, CONGA_M, CONGA_H, CONGA_L, TIMB_H, TIMB_L, AGOGO_H, AGOGO_L, CABASA, MARACAS = 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70
WHISTLE_S, GUIRO_S, GUIRO_L, CLAVES, WOOD_H, WOOD_L, CUICA_M, CUICA_O, TRI_M, TRI_O, SHAKER, JINGLE, BELLTREE, CASTANETS = 71, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85


class Song:
    def __init__(self, name, bpm, bars, meter=4, tail=3.0, seed=1):
        random.seed(seed)
        self.name, self.bpm, self.bars, self.meter, self.tail = name, bpm, bars, meter, tail
        self.beat = 60 / bpm
        self.end = bars * meter
        self.n_loop = round(self.end * self.beat * SR)
        self.n = self.n_loop + int(tail * SR)
        self.out = os.path.join(LAB, 'work', 'music', name)
        self.main, self.fin = {}, {}
        self.chart = []

    # ------------------------------------------------------------ parts
    def part(self, name, program, ch, final=False, **kw):
        P = Part(name, program, ch, **kw)
        (self.fin if final else self.main)[name] = P
        return P

    # ------------------------------------------------------------ harmony
    def set_chart(self, bars):
        """one string per bar: 'D', 'G A' (halves), 'C . D7' (C for two thirds); '.' holds the previous chord"""
        assert len(bars) == self.bars, (len(bars), self.bars)
        self.chart = bars
        self.chords = []  # (beat, dur, sym)
        for b, s in enumerate(bars):
            toks = s.split(); seg = self.meter / len(toks)
            for i, t in enumerate(toks):
                if t == '.': self.chords[-1] = (self.chords[-1][0], self.chords[-1][1] + seg, self.chords[-1][2])
                else: self.chords.append((b * self.meter + i * seg, seg, t))
        return self.chords

    def chord_at(self, beat):
        for t, d, s in self.chords:
            if t <= beat < t + d: return s
        return self.chords[-1][2]

    def bars_of(self, *ranges):
        """bar numbers in [a, b) ranges"""
        return [b for a, z in ranges for b in range(a, z)]

    # ------------------------------------------------------------ common figures
    @staticmethod
    def hit(part, beat, note, v, dur=0.2, jit=0.004):
        part.add(beat + random.uniform(-jit, jit), dur, note, v + random.uniform(-5, 5))

    def pattern(self, part, bar, pat, note, vel, sub=4, acc=None):
        """drum grid: 'x' hit, 'o' ghost (60 %), '.' rest; `sub` steps per beat"""
        t = bar * self.meter
        for i, c in enumerate(pat):
            if c == '.': continue
            v = vel if c == 'x' else vel * 0.6
            if acc and i % acc == 0: v += 8
            self.hit(part, t + i / sub, note, v)

    def bass_root(self, sym, lo):
        r = midi(sym.split('/')[1] + '0') % 12 if '/' in sym else chord(sym)[0]
        return lo + (r - lo) % 12

    def strum(self, part, beats, center, n=4, vel=72, spread=0.016, length=None, bass=None, updown=None, only=None):
        """chord strums at beat offsets within each chord span: beats = [(offset, 'D'|'U', vel_scale)]"""
        for t, d, sym in self.chords:
            if only and not only(int(t // self.meter)): continue
            notes = voicing(sym, center, n)
            if bass is not None: notes = sorted(set(notes + [voicing(sym, bass, 1)[0]]))
            for k, (b, dr, vs) in enumerate(beats):
                if b >= d: continue
                order = notes if dr == 'D' else notes[::-1]
                nxt = beats[k + 1][0] if k + 1 < len(beats) and beats[k + 1][0] < d else d
                L = length if length else (nxt - b) * 0.95
                for j, m in enumerate(order):
                    part.add(t + b + j * spread + random.uniform(0, spread * 0.6), L, m, vel * vs + random.uniform(-5, 5))

    def block(self, part, offs, center, n=3, vel=70, length=0.25, only=None, bass=None):
        """block chords at offsets within each chord span"""
        for t, d, sym in self.chords:
            if only and not only(int(t // self.meter)): continue
            notes = voicing(sym, center, n)
            if bass is not None: notes = sorted(set(notes + [voicing(sym, bass, 1)[0]]))
            for b in offs:
                if b < d:
                    for m in notes: part.add(t + b + random.uniform(0, 0.006), min(length, d - b), m, vel + random.uniform(-4, 4))

    def pad(self, part, center, n=3, vel=60, only=None, bass=None):
        for t, d, sym in self.chords:
            if only and not only(int(t // self.meter)): continue
            notes = voicing(sym, center, n)
            if bass is not None: notes = notes + [voicing(sym, bass, 1)[0]]
            for m in notes: part.add(t, d * 0.98, m, vel)

    def arp(self, part, center, step=0.5, shape='up', n=4, vel=70, length=None, only=None, span=1):
        """arpeggio through each chord's tones; shape up / down / updown / alberti"""
        for t, d, sym in self.chords:
            if only and not only(int(t // self.meter)): continue
            v = voicing(sym, center, n)
            if span > 1: v = v + [m + 12 for m in v]
            seq = {'up': v, 'down': v[::-1], 'updown': v + v[-2:0:-1], 'alberti': [v[0], v[-1], v[1], v[-1]] if len(v) >= 3 else v}[shape]
            k = 0; b = 0.0
            while b < d - 1e-6:
                part.add(t + b, length or step * 0.9, seq[k % len(seq)], vel + (6 if k % len(seq) == 0 else 0) + random.uniform(-4, 4))
                k += 1; b += step

    def bassline(self, part, lo, style='root8', vel=96, only=None):
        """styles: root (one per chord), root2 (halves), rootfifth, root8 (8ths w/ octave + approach), walk (quarters),
        waltz (root on 1), oompah (root 1, fifth 3), reggae, funk"""
        ch = self.chords
        for k, (t, d, sym) in enumerate(ch):
            bar = int(t // self.meter)
            if only and not only(bar): continue
            r = self.bass_root(sym, lo); nx = self.bass_root(ch[(k + 1) % len(ch)][2], lo)
            q = chord(sym.split('/')[0])
            third = r + q[1][1]; fifth = r + 7
            if '/' in sym:  # slash chord: the bass is not the root; its 'fifth' is the chord's root or fifth above it
                cr = q[0]; fifth = r + min((cr - r) % 12 or 12, (cr + 7 - r) % 12 or 12, key=lambda x: abs(x - 7)); third = r + ((cr + q[1][1] - r) % 12)
            # a step into the next root, in the key (scale set on the Song) where possible
            sc = getattr(self, 'scale', None)
            opts = [nx - 1, nx + 2, nx - 2, nx + 1] if random.random() < 0.5 else [nx + 2, nx - 1, nx - 2, nx + 1]
            app = next((a for a in opts if sc is None or a % 12 in sc), nx)
            if style == 'root':
                part.add(t, d * 0.95, r, vel)
            elif style == 'root2':
                for b in np.arange(0, d, 2): part.add(t + b, 1.9, r if b == 0 else (fifth if fifth - lo < 16 else r), vel - (0 if b == 0 else 8))
            elif style == 'rootfifth':
                for i, b in enumerate(np.arange(0, d, 1)): part.add(t + b, 0.9, [r, fifth, r + 12, fifth][i % 4] if d >= 4 else [r, fifth][i % 2], vel - (0 if i == 0 else 10))
            elif style == 'root8':
                seq = [r, r, fifth, r + 12, r, fifth, r, app] if d >= 4 else [r, r, fifth, r][: int(d * 2)]
                for i, m in enumerate(seq[: int(d * 2)]): part.add(t + i * 0.5, 0.42, m, vel - (0 if i == 0 else 12) + random.uniform(-4, 4))
            elif style == 'walk':
                scale_tones = [r, third, fifth, app] if d >= 4 else [r, app]
                for i, m in enumerate(scale_tones[: int(d)]): part.add(t + i, 0.9, m, vel - (0 if i == 0 else 8) + random.uniform(-4, 4))
            elif style == 'waltz':
                part.add(t, 0.95, r, vel)
                if d >= 3: pass
            elif style == 'oompah':
                part.add(t, 0.9, r, vel)
                if d >= 4: part.add(t + 2, 0.9, fifth - 12 if fifth - 12 >= lo else fifth, vel - 10)
                elif d >= 3: pass
            elif style == 'reggae':
                part.add(t, 1.4, r, vel); part.add(t + 1.5, 0.4, r, vel - 14)
                if d >= 4: part.add(t + 2.5, 0.9, fifth, vel - 8); part.add(t + 3.5, 0.4, app, vel - 14)
            elif style == 'funk':
                pat = [(0, r, 0.35), (0.75, r + 12, 0.2), (1.5, r, 0.3), (2, fifth, 0.3), (2.75, r + 10, 0.2), (3, r, 0.3), (3.5, app, 0.3)]
                for b, m, L in pat:
                    if b < d: part.add(t + b, L, m, vel - (0 if b == 0 else 12) + random.uniform(-5, 5))
            else: raise ValueError(style)

    def melody(self, part, start_bar, bars, vel=88, legato=0.92, hum=0.3, accent=None):
        """bars of note text (one string per bar) from start_bar"""
        for i, txt in enumerate(bars):
            if txt: part.seq((start_bar + i) * self.meter, txt, vel, legato=legato, hum=hum, accent=accent)

    @staticmethod
    def harmonize(src, dst, scale_pcs, steps=-2, vel=-10, lo=0):
        """copy src's notes into dst a diatonic interval away (steps scale degrees, -2 = a third below)"""
        sc = sorted(scale_pcs)
        for b, d, m, v in src.notes:
            pcs = [o * 12 + p for o in range(11) for p in sc]
            if m not in pcs: dst.add(b, d, m - 3 if steps < 0 else m + 4, v + vel); continue
            k = pcs.index(m) + steps
            if pcs[k] >= lo: dst.add(b, d, pcs[k], v + vel)

    # ------------------------------------------------------------ checks
    def check_key(self, allowed_pcs, parts=None, skip=()):
        """report notes outside the allowed pitch classes that aren't chord tones of the chord sounding then"""
        bad = []
        for P in list((parts or {**self.main, **self.fin}).values()):
            if P.ch == 9 or P.name in skip: continue
            for b, d, m, v in P.notes:
                sym = self.chord_at(b % self.end); root, iv = chord(sym.split('/')[0])
                if m % 12 not in allowed_pcs and m % 12 not in [(root + x) % 12 for x in iv]:
                    bad.append((P.name, round(b, 2), m, sym))
        for x in bad[:20]: print('  off-key?', x)
        print(f'  key check: {len(bad)} notes outside key/chord')
        return bad

    # ------------------------------------------------------------ render
    def _mix(self, parts, gains, tag):
        S = stems(list(parts.values()), self.bpm, self.end + self.tail / self.beat, os.path.join(self.out, 'stems-' + tag), self.n)
        y = 0
        for k, v in S.items():
            l = loudness(v[: self.n_loop])
            if not np.isfinite(l): continue
            y = y + v * db(gains[k] - l)
            print(f'  stem {k:9} {l:6.1f} -> {gains[k]} LUFS')
        return y if not isinstance(y, int) else np.zeros((self.n, 2))

    def finish(self, gains, bus=None, target=-16, encode=None):
        main = self._mix(self.main, gains, 'main')
        fin = self._mix(self.fin, gains, 'final') if self.fin else np.zeros_like(main)
        bus = bus or (lambda x: eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 3500, 1.0, -2.5), 'highshelf', 5000, 0.7, -3))
        main, fin = bus(main), bus(fin)
        g = db(target - loudness(wrap(main + fin, self.n_loop)))
        main *= g; fin *= g
        pk = max(np.abs(main + fin).max(), 1e-9)
        if pk > 0.95: main *= 0.95 / pk; fin *= 0.95 / pk
        os.makedirs(self.out, exist_ok=True)
        w = lambda f, x: sf.write(os.path.join(self.out, f), x, SR, subtype='PCM_16')
        w('main.wav', main); w('final.wav', fin)
        w('preview-loop.wav', np.concatenate([wrap(main, self.n_loop)] * 2)); w('preview-final.wav', wrap(main + fin, self.n_loop))
        print(f'{self.name}: loop {self.n_loop / SR:.6f}s  main {loudness(wrap(main, self.n_loop)):.1f} LUFS  '
              f'main+final {loudness(wrap(main + fin, self.n_loop)):.1f} LUFS  peak {20 * np.log10(pk):.1f}')
        enc = encode or (sys.argv[sys.argv.index('--encode') + 1] if '--encode' in sys.argv else None)
        if enc:
            d = os.path.join(enc, 'audio', 'music'); os.makedirs(d, exist_ok=True)
            for f, o, k in (('main.wav', self.name + '.mp3', 128), ('final.wav', self.name + '-final.mp3', 96)):
                if f == 'final.wav' and not self.fin: continue
                subprocess.run([FF, '-v', 'error', '-y', '-i', os.path.join(self.out, f), '-c:a', 'libmp3lame', '-b:a', f'{k}k', os.path.join(d, o)], check=True)
            print('  encoded ->', d)
        return round(self.n_loop / SR, 6)
