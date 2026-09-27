"""Test D M2 sound: music (generated), sound design, voice, mix and master for the M2 contract root.

    python3 audio/d_m2_audio.py out/m2/root

Reads (root/out): timeline.json, script.json, camera.json, tempo-map.json, sfx-events.json, voice/takes.json.
Writes root/out/audio/stems/{voice,music,sfx,whoosh,room}.flac (48 kHz stereo, same time base, at mix level),
root/out/audio/master.wav, root/../audio-report.json and out/music-ledger-d.json (licence ledger).

Music: every sound is synthesised here (numpy); seed fixed; no samples, no loops (each bar re-voices the chord and
re-rolls velocities). Layers: pad (detuned saws, low-pass with envelope), a plucked pulse on every beat of the tempo
map (so the music follows the edit), the two leitmotifs (1966: rising D-F-A-C figure, electric-piano timbre, left of
centre; mirror: its retrograde C-A-F-D, bell timbre, right of centre, from the moment the mirror retiree appears),
accent hits on the declared accents (cuts), and ONE reverb space (a 1.8 s synthetic hall) for all music.
Voice: high-pass, de-esser, gentle compression. Mix: music ducked in the 1-4 kHz band under the voice (multiband).
Master: -14 LUFS integrated, true peak <= -1 dBTP.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
RNG = np.random.default_rng(20260926)
ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'out/m2/root')
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
J = lambda p: json.load(open(os.path.join(ROOT, p)))
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
hz = lambda midi: 440.0 * 2 ** ((midi - 69) / 12)


def db(x):
    return 20 * np.log10(np.maximum(x, 1e-12))


def pan_gains(p):
    p = np.clip(p, -1, 1)
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    return signal.lfilter([1 - a], [1, -a], x)


def band(x, lo, hi, order=4):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfiltfilt(sos, x)


def split3(x):
    lo = signal.sosfiltfilt(signal.butter(4, 1000, 'low', fs=SR, output='sos'), x)
    mid = signal.sosfiltfilt(signal.butter(4, [1000, 4000], 'band', fs=SR, output='sos'), x)
    hi = x - lo - mid
    return lo, mid, hi


def reverb_ir(rt60=1.8, seed=7):
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    env = np.exp(-6.9 * t / rt60)
    r = np.random.default_rng(seed)
    L = r.standard_normal(n) * env
    R = 0.8 * L + 0.6 * r.standard_normal(n) * env  # correlated room: keeps the mix mono-safe
    L[: int(0.012 * SR)] = 0
    R[: int(0.017 * SR)] = 0
    lp = signal.butter(2, 6000, 'low', fs=SR, output='sos')
    L, R = signal.sosfilt(lp, L), signal.sosfilt(lp, R)
    return L / np.sqrt(np.sum(L ** 2)), R / np.sqrt(np.sum(R ** 2))


def add(buf, i0, sig, gl=1.0, gr=1.0):
    i0 = int(i0)
    if i0 >= buf.shape[0] or i0 + len(sig) <= 0:
        return
    s0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(len(sig) - s0, buf.shape[0] - i0)
    buf[i0:i0 + n, 0] += sig[s0:s0 + n] * gl
    buf[i0:i0 + n, 1] += sig[s0:s0 + n] * gr


# ---------------------------------------------------------------- instruments
def pluck(f, dur=0.45, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(4 * np.pi * f * t) + 0.2 * np.sin(6 * np.pi * f * t))
    env = np.minimum(1, t / 0.003) * np.exp(-t / 0.12)
    return onepole_lp(x * env, 2400) * vel


def epiano(f, dur=1.4, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = 1.6 * np.exp(-t / 0.35) * np.sin(2 * np.pi * f * 1.0 * t)
    x = np.sin(2 * np.pi * f * t + mod)
    env = np.minimum(1, t / 0.006) * np.exp(-t / 0.7)
    return x * env * vel


def bell(f, dur=1.8, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = 2.4 * np.exp(-t / 0.6) * np.sin(2 * np.pi * f * 3.5 * t)
    x = np.sin(2 * np.pi * f * t + mod)
    env = np.minimum(1, t / 0.004) * np.exp(-t / 0.9)
    return x * env * vel


def pad(freqs, dur, vel=1.0, bright=900):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.004, 0.0, 0.005):
            ph = RNG.uniform(0, 1)
            x += 2 * ((f * (1 + det) * t + ph) % 1.0) - 1
    x /= 3 * len(freqs)
    cutoff = bright * (0.6 + 0.4 * np.minimum(1, t / (0.5 * dur)))
    y = np.zeros(n)
    a_prev = 0.0
    step = 256
    for i in range(0, n, step):  # time-varying one-pole low-pass
        a = np.exp(-2 * np.pi * cutoff[i] / SR)
        seg = signal.lfilter([1 - a], [1, -a], x[i:i + step], zi=[a_prev * 1.0])[0]
        y[i:i + step] = seg
        a_prev = seg[-1] if len(seg) else a_prev
    env = np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.4)
    return y * env * vel


def boom(vel=1.0):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    f = 55 * (1 + 1.5 * np.exp(-t / 0.05))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35)
    click = RNG.standard_normal(n) * np.exp(-t / 0.008) * 0.3
    return (x + onepole_lp(click, 3000)) * vel


CHORDS = {  # per key: progression of (root pitch class, quality)
    'D minor': [('D', 'm'), ('Bb', ''), ('F', ''), ('C', '')],
    'F major': [('F', ''), ('C', ''), ('D', 'm'), ('Bb', '')],
    'Bb major': [('Bb', ''), ('F', ''), ('G', 'm'), ('Eb', '')],
    'A minor': [('A', 'm'), ('F', ''), ('C', ''), ('G', '')],
    'C major': [('C', ''), ('G', ''), ('A', 'm'), ('F', '')],
}


def chord_notes(root, q, base=48):
    r = base + NOTE[root]
    return [r, r + (3 if q == 'm' else 4), r + 7, r + 12 + (3 if q == 'm' else 4)]


def physical(N, spec):
    """Beds (wind, rain, water trickle) and events (drip, thunder, stone grind) of the lookdev world, all synthesised."""
    out = np.zeros((N, 2), np.float32)
    t = np.arange(N) / SR
    from scipy.ndimage import uniform_filter1d as uf
    def curve(pts):
        pts = sorted(pts)
        return np.interp(t, [p[0] for p in pts], [p[1] for p in pts])
    for b in spec['beds']:
        lv = curve(b['level']) if isinstance(b['level'], list) else np.full(N, b['level'])
        on = ((t >= b['t0']) & (t < b['t1'])).astype(float)
        on = uf(on, int(0.3 * SR))
        if b['kind'] == 'wind':
            for ch in range(2):
                nz = RNG.standard_normal(N)
                gust = uf(RNG.standard_normal(N), int(1.3 * SR))
                gust = 0.55 + 0.45 * np.tanh(gust / (gust.std() + 1e-9))
                x = band(nz, 180, 900) * 0.7 + band(nz, 900, 2600) * 0.25 * gust
                out[:, ch] += x * gust * lv * on
        elif b['kind'] == 'rain':
            for ch in range(2):
                hiss = band(RNG.standard_normal(N), 1800, 9000) * 0.5
                drops = (RNG.random(N) < 900 / SR).astype(float) * RNG.uniform(0.3, 1.0, N)
                drops = signal.lfilter([1], [1, -0.93], drops)
                drops = band(drops, 1200, 7000) * 1.6
                rumble = band(RNG.standard_normal(N), 40, 260) * 0.8
                out[:, ch] += (hiss + drops + rumble) * lv * on
        elif b['kind'] == 'water':
            x = np.zeros(N)
            n = int(0.03 * SR)
            tt = np.arange(n) / SR
            idx = np.nonzero(RNG.random(N) < 38 / SR)[0]
            for i in idx:
                f0 = RNG.uniform(700, 2200)
                bub = np.sin(2 * np.pi * (f0 * tt + 0.5 * f0 * 3 * tt ** 2 / 0.03)) * np.exp(-tt / 0.008) * RNG.uniform(0.3, 1)
                add1 = min(n, N - i)
                x[i:i + add1] += bub[:add1]
            x += band(RNG.standard_normal(N), 700, 3500) * 0.35 * (0.7 + 0.3 * np.sin(2 * np.pi * t * 3.1))
            gl, gr = pan_gains(b.get('pan', 0))
            out[:, 0] += x * lv * on * gl
            out[:, 1] += x * lv * on * gr
    for e in spec['events']:
        i0 = int(e['t'] * SR)
        gl, gr = pan_gains(e.get('pan', 0))
        if e['kind'] == 'drip':
            n = int(0.12 * SR); tt = np.arange(n) / SR
            x = np.sin(2 * np.pi * (1100 * tt + 9000 * tt ** 2)) * np.exp(-tt / 0.012) + band(RNG.standard_normal(n), 2000, 8000) * np.exp(-tt / 0.006) * 0.4
        elif e['kind'] == 'thunder':
            n = int(4.5 * SR); tt = np.arange(n) / SR
            crack = band(RNG.standard_normal(n), 300, 6000) * np.exp(-tt / 0.08)
            roll = band(RNG.standard_normal(n), 25, 320) * np.exp(-tt / 1.4) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * tt * 1.7)))
            x = crack * 0.9 + roll * 2.6
        elif e['kind'] == 'stone':
            n = int(e.get('dur', 0.9) * SR); tt = np.arange(n) / SR
            grit = (RNG.random(n) < 300 / SR).astype(float) * RNG.uniform(0.2, 1, n)
            grit = band(signal.lfilter([1], [1, -0.8], grit), 120, 2200)
            x = (band(RNG.standard_normal(n), 50, 500) * 0.8 + grit * 1.4) * np.sin(np.pi * tt / tt[-1]) ** 0.5
            x = np.concatenate([x, boom(0.8)[:int(0.6 * SR)] * 0.9])
        else:
            continue
        m = min(len(x), N - i0)
        if m > 0:
            out[i0:i0 + m, 0] += x[:m] * e['level'] * gl
            out[i0:i0 + m, 1] += x[:m] * e['level'] * gr
    return out


def main():
    tl, sc = J('out/timeline.json'), J('out/script.json')
    total = tl['total']
    N = int(round(total * SR))
    tempo = J('out/tempo-map.json')
    beats = [b for b in tempo['beats'] if b < total - 0.05]
    accents = tempo.get('accents', [])
    cp = os.path.join(ROOT, 'out', 'cues.json')
    cues = json.load(open(cp if os.path.exists(cp) else os.path.join(REPO, 'out', 'cues.json')))['cues']
    sil = J('out/silences.json')['silences']
    first_mirror = next((s['start'] for s in tl['scenes'] if s['id'] in ('a1-mirror-in', 'a2-7374')), total)

    # ---------------------------------------------------------------- music
    dry = np.zeros((N, 2), np.float32)
    key_at = lambda t: next((c['key'] for c in reversed([c for c in cues if c['layer'] == 'music']) if c['t'] <= t), 'D minor')
    # chords per bar (4 beats)
    bars = beats[::4]
    for bi, b0 in enumerate(bars):
        b1 = bars[bi + 1] if bi + 1 < len(bars) else min(total, b0 + 2.6)
        key = key_at(b0)
        root, q = CHORDS[key][bi % 4]
        notes = chord_notes(root, q)
        inv = RNG.integers(0, 3)
        notes = sorted([n + (12 if k < inv else 0) for k, n in enumerate(notes)])  # re-voiced every bar
        vel = 0.20 * RNG.uniform(0.85, 1.1)
        p = pad([hz(n) for n in notes], b1 - b0 + 0.6, vel, bright=700 if 'minor' in key else 1100)
        add(dry, b0 * SR, p, 0.9, 0.9)
        # bass
        bn = int(0.8 * SR * (b1 - b0))
        tt = np.arange(bn) / SR
        bass = np.sin(2 * np.pi * hz(36 + NOTE[root]) * tt) * np.minimum(1, tt / 0.02) * np.exp(-tt / 1.2) * 0.22
        add(dry, b0 * SR, bass, 1, 1)
    # pulse on every beat (onsets follow the edit's tempo map); downbeats louder
    for i, b in enumerate(beats):
        key = key_at(b)
        root, q = CHORDS[key][(i // 4) % 4]
        f = hz(60 + NOTE[root] + (7 if i % 2 else 0))
        v = (0.5 if i % 4 == 0 else 0.32) * RNG.uniform(0.85, 1.1)
        gl, gr = pan_gains(-0.15 if i % 2 else 0.15)
        add(dry, b * SR, pluck(f, 0.4, v), gl, gr)
    # leitmotifs on the first beat of every second bar
    m66 = [0, 3, 7, 10]  # D F A C relative to D (62)
    for bi in range(0, len(bars), 2):
        b0 = bars[bi]
        if bi * 4 + 4 >= len(beats):
            break
        key = key_at(b0)
        shift = 0 if 'D' in key else (3 if key.startswith('F') else 0)
        gl, gr = pan_gains(-0.3)
        for k, iv in enumerate(m66):
            add(dry, beats[bi * 4 + k] * SR, epiano(hz(62 + shift + iv), 1.2, 0.30 * RNG.uniform(0.85, 1.05)), gl, gr)
        if b0 >= first_mirror and bi * 4 + 8 < len(beats):  # mirror answers with the retrograde a bar later
            gl, gr = pan_gains(0.3)
            for k, iv in enumerate(reversed(m66)):
                add(dry, beats[bi * 4 + 4 + k] * SR, bell(hz(74 + shift + iv), 1.6, 0.18 * RNG.uniform(0.85, 1.05)), gl, gr)
    # accents: a low hit on each declared accent (all are cuts)
    for a in accents:
        add(dry, a * SR, boom(0.55), 1, 1)
    # air: a soft band-limited (1.2-3.8 kHz) noise pad, slow swells, left/right slightly different
    air = np.zeros((N, 2), np.float32)
    for ch in range(2):
        nz = band(RNG.standard_normal(N), 1200, 3800)
        sw = 0.6 + 0.4 * np.sin(2 * np.pi * np.arange(N) / SR / 7.3 + ch)
        air[:, ch] = nz * sw * 0.035
    dry += air
    # tension: the music builds over the 20 s before each act climax (+6 dB), drops to a valley after it (-5 dB at +8 s)
    # and recovers by +25 s (acts[].climax of the timeline; none in a segment without climaxes)
    env_db = np.zeros(N)
    tt_ = np.arange(N) / SR
    for a_ in tl['acts']:
        c_ = a_.get('climax')
        if c_ is None:
            continue
        up = np.clip((tt_ - (c_ - 20)) / 20, 0, 1) * (tt_ <= c_)
        down = (tt_ > c_) * np.interp(tt_, [c_, c_ + 8, c_ + 25], [6, -5, 0])
        env_db += 6 * up ** 2 + down
    dry *= 10 ** (env_db / 20)[:, None]
    # one reverb space
    irL, irR = reverb_ir()
    wetL = signal.oaconvolve(dry[:, 0], irL)[:N]  # overlap-add: memory stays small for a full-length film
    wetR = signal.oaconvolve(dry[:, 1], irR)[:N]
    music = (dry + 0.22 * np.stack([wetL, wetR], 1)).astype(np.float32)
    del wetL, wetR, air

    # ---------------------------------------------------------------- voice
    takes = {t['id']: t for t in json.load(open(os.path.join(ROOT, 'out', 'voice', 'takes.json')))['takes']}
    EL = json.load(open(os.path.join(ROOT, 'out', 'voice', 'el-takes.json')))
    cl = json.load(open(os.path.join(ROOT, 'out', 'claims.json')))['claims']
    DECISIVE = {sp['sentence'] for c in cl if c.get('decisive') for sp in c.get('spoken', [])}
    vbuf = np.zeros(N)
    for s in sc['sentences']:
        f = os.path.join(REPO, takes[s['id']]['final'])
        with tempfile.TemporaryDirectory() as d:
            w = os.path.join(d, 'a.wav')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f, '-ac', '1', '-ar', str(SR),
                            '-af', 'highpass=f=70,deesser=i=0.4:m=0.5:f=0.5,acompressor=threshold=0.1:ratio=2.5:attack=8:release=150:makeup=1.5', w], check=True)
            x = wavfile.read(w)[1].astype(np.float64) / 32768
        if s['id'] in DECISIVE:
            # cut the breath/decay after the last word (take ASR end + 250 ms, 40 ms fade: the ASR ends a final word early): the decisive pause starts clean
            el = EL.get(os.path.basename(takes[s['id']]['raw'])[:-4])
            if el and el.get('words'):
                e = int((0.03 + el['words'][-1]['end'] + 0.25) * SR)
                f = int(0.04 * SR)
                if e < len(x):
                    x = x.copy()
                    x[e:e + f] *= np.linspace(1, 0, len(x[e:e + f]))
                    x[e + f:] = 0
        i0 = int(round(s['start'] * SR))
        n = min(len(x), N - i0)
        vbuf[i0:i0 + n] += x[:n]
    # performance dynamics by section (the reading gets closer/quieter in the cold open and fuller at the reveals)
    starts = {s_['id']: s_['start'] for s_ in tl['scenes']}
    # section dynamics of the reading (dB): close and quiet in the cold open, fuller at the reveals and climaxes, pulled
    # back for the reflective and technical passages (this is what gives the film its loudness range)
    SECT = [x for x in [('co-lines', -9.0), ('a1-est', -4.0), ('a1-mirror-in', -1.5), ('a1-avg1966', 2.0), ('a1-geo', -3.0), ('a2-est', -3.0), ('a2-7374', -2.0),
                        ('a2-1982', 0.0), ('a2-climb', 1.5), ('a2-climax', 3.0), ('a2-years', 0.0), ('a2-rest', -4.0), ('a2-payoff', -1.0), ('a3-est', -3.0),
                        ('a3-four', 0.5), ('a3-decade', 2.5), ('a3-answer', 1.0), ('a3-nuance', -2.0), ('a3-limits', -5.0), ('method', -8.0), ('outro', -6.0)] if x[0] in starts]
    gv = np.zeros(N)
    for k, (sid, g_) in enumerate(SECT):
        i0 = int(starts[sid] * SR)
        i1 = int(starts[SECT[k + 1][0]] * SR) if k + 1 < len(SECT) else N
        gv[i0:i1] = g_
    from scipy.ndimage import uniform_filter1d as _uf
    gv = _uf(gv, int(0.5 * SR))
    vbuf = vbuf * 10 ** (gv / 20)
    # voice peak control (soft clip of rare plosive peaks, 4 ms look-ahead gain)
    from scipy.ndimage import minimum_filter1d as _minf, uniform_filter1d as _unif
    vc = np.sqrt(np.mean(vbuf[np.abs(vbuf) > 1e-4] ** 2)) * 10 ** (12 / 20)  # ceiling: 12 dB over the speech RMS
    gpk = np.minimum(1, vc / np.maximum(np.abs(vbuf), 1e-9))
    gpk = np.minimum(_unif(_minf(gpk, int(0.004 * SR)), int(0.002 * SR)), _minf(gpk, int(0.004 * SR)))
    vbuf = vbuf * gpk
    voice = np.stack([vbuf, vbuf], 1).astype(np.float32)

    # voice activity (100 ms RMS > -45 dBFS) -> multiband ducking of the music (1-4 kHz only)
    hop = int(0.01 * SR)
    from scipy.ndimage import uniform_filter1d as _uf2
    vr = np.sqrt(np.maximum(_uf2(vbuf ** 2, int(0.1 * SR)), 0))
    act = (db(vr) > -45).astype(float)
    # smooth: attack 40 ms, release 350 ms
    g = np.zeros(N)
    a_att, a_rel = np.exp(-1 / (0.04 * SR)), np.exp(-1 / (0.35 * SR))
    cur = 0.0
    step = hop
    for i in range(0, N, step):
        target = act[i]
        a = a_att if target > cur else a_rel
        cur = target + (cur - target) * a ** step
        g[i:i + step] = cur
    duck_mid = 10 ** (-12 * g / 20)  # -12 dB in 1-4 kHz under voice
    duck_all = np.ones(N)  # the dip is band-limited: low and high bands keep their level
    mus = np.zeros_like(music)
    for ch in range(2):
        lo, mid, hi = split3(music[:, ch])
        mus[:, ch] = (lo + mid * duck_mid + hi) * duck_all

    # ---------------------------------------------------------------- sound design
    sfx = np.zeros((N, 2), np.float32)
    events = J('out/sfx-events.json')['events']
    for e in events:
        n = int(0.16 * SR)
        t = np.arange(n) / SR
        blip = np.sin(2 * np.pi * (880 + 300 * RNG.uniform()) * t) * np.exp(-t / 0.05)
        noise = band(RNG.standard_normal(n), 1500, 6000) * np.exp(-t / 0.03)
        x = (0.5 * blip + 0.6 * noise) * (0.09 if e.get('kind') != 'impact' else 0.14)
        if e.get('kind') == 'impact':
            x = x + boom(0.9)[:n] * 0.16
        gl, gr = pan_gains((e['x'] - 960) / 960)
        add(sfx, e['t'] * SR, x, gl, gr)
        if e.get('riser'):
            rn = int(e['riser'] * SR)
            rt = np.arange(rn) / SR
            rs = band(RNG.standard_normal(rn), 400, 5000) * (rt / rt[-1]) ** 2 * 0.05
            add(sfx, e['t'] * SR - rn, rs, 0.8, 0.8)
    # whoosh per camera move, level from the peak speed (frame widths per second at the focus plane)
    cam = J('out/camera.json')
    fr = cam['frames']
    ct = np.array([f['t'] for f in fr])
    pos = np.array([f['pos'] for f in fr], float)
    tgt = np.array([f['target'] for f in fr], float)
    fov = np.array([f['fovDeg'] for f in fr], float)
    fd = np.array([f['focusDist'] for f in fr], float)
    width = 2 * fd * np.tan(np.radians(fov) / 2) * 16 / 9
    dt = np.gradient(ct)
    sp = np.maximum(np.linalg.norm(np.gradient(pos, axis=0), axis=1), np.linalg.norm(np.gradient(tgt, axis=0), axis=1)) / dt / width
    cut_frames = {int(round(s['start'] * 30)) for s in tl['scenes']}
    for c in cut_frames:  # the jump at a cut is not a move
        for k in (c - 1, c, c + 1):
            if 0 <= k < len(sp):
                sp[k] = 0
    whoosh = np.zeros((N, 2), np.float32)
    on = sp > 0.05
    moves = []
    i = 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and on[j]:
                j += 1
            if ct[j - 1] - ct[i] >= 0.3:
                moves.append((i, j))
            i = j
        else:
            i += 1
    wrows = []
    for a, b in moves:
        pk = float(sp[a:b].max())
        t0, t1 = ct[a] - 0.15, ct[b - 1] + 0.25
        n = int((t1 - t0) * SR)
        tt = t0 + np.arange(n) / SR
        envs = np.interp(tt, ct, sp) / pk
        nz = RNG.standard_normal(n)
        lvl = 10 ** ((-26 + 10 * np.log10(pk / 0.3)) / 20)  # monotonic in peak speed
        w = band(nz, 250, 4500) * envs ** 1.5 * lvl * 3.0
        dx = pos[b - 1, 0] - pos[a, 0]
        gl, gr = pan_gains(np.clip(dx / 1500, -0.5, 0.5))
        add(whoosh, t0 * SR, w, gl, gr)
        wrows.append({'t': round(float(ct[a]), 2), 'peakSpeed': round(pk, 3)})
    # room tone: quiet pink noise, one space
    wn = RNG.standard_normal(N)
    pink = signal.lfilter([0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400], wn)
    pink = onepole_lp(pink, 3000)
    pink = pink / np.sqrt(np.mean(pink ** 2)) * 10 ** (-60 / 20)
    room = np.stack([pink, np.roll(pink, 480) * 0.9 + 0.1 * pink], 1).astype(np.float32)
    # physical sound of the world (lookdev): water, wind, rain, stone, thunder, drips; gated by the silences below
    _ph = J('out/physical.json') if os.path.exists(os.path.join(ROOT, 'out', 'physical.json')) else None
    amb = physical(N, _ph) if _ph and (_ph.get('beds') or _ph.get('events')) else None

    # intentional silences: everything but the room tone out (30 ms fades)
    gate = np.ones(N)
    for s in sil:
        i0, i1 = int(s['t'] * SR), int((s['t'] + s['dur']) * SR)
        f = int(0.03 * SR)
        gate[i0:i1] = 0
        gate[max(0, i0 - f):i0] = np.minimum(gate[max(0, i0 - f):i0], np.linspace(1, 0, i0 - max(0, i0 - f)))
        gate[i1:i1 + f] = np.minimum(gate[i1:i1 + f], np.linspace(0, 1, len(gate[i1:i1 + f])))
    for arr in (mus, sfx, whoosh):
        arr *= gate[:, None]
    if amb is not None:
        # physical sounds sit under the voice: -10 dB while the voice is active, and -18 dB within +-0.5 s of every
        # spoken number (so the decisive words stay intelligible to the ASR and to the viewer)
        dph = 10 ** (-10 * g / 20)
        for tn in J('out/physical.json').get('numbers', []):
            i0, i1 = int(max(0, tn - 0.5) * SR), int(min(N / SR, tn + 1.6) * SR)
            dph[i0:i1] = np.minimum(dph[i0:i1], 10 ** (-18 / 20))
        from scipy.ndimage import uniform_filter1d as _ufd
        dph = _ufd(dph, int(0.05 * SR))
        sfx += amb * (gate * dph)[:, None]

    # every spoken number keeps the air to itself: music, whoosh and sound effects dip -24 dB from 0.5 s before it
    # starts to 1.6 s after (a spoken year like "nineteen ninety-one" lasts ~1 s) (only when the root lists the
    # numbers: out/physical.json)
    pj = os.path.join(ROOT, 'out', 'physical.json')
    if os.path.exists(pj):
        dn = np.ones(N)
        for tn in json.load(open(pj)).get('numbers', []):
            dn[int(max(0, tn - 0.5) * SR):int(min(N / SR, tn + 1.6) * SR)] = 10 ** (-24 / 20)
        from scipy.ndimage import uniform_filter1d as _ufn
        dn = _ufn(dn, int(0.05 * SR))
        for arr in (mus, sfx):  # whooshes keep their level: they follow the camera speed (A10)
            arr *= dn[:, None]
    # ---------------------------------------------------------------- levels
    # voice-active windows: music 20 dB under the voice (mean power)
    vt = act > 0
    pv = np.mean(vbuf[vt] ** 2)
    pm = np.mean(mus[vt].mean(1) ** 2)
    mus *= np.sqrt(pv / pm) * 10 ** (-20 / 20)
    stems = {'voice': voice, 'music': mus, 'sfx': sfx, 'whoosh': whoosh, 'room': room}
    mix = sum(stems.values())
    # master: loudness to -14 LUFS (measured like the check: ffmpeg ebur128), then a true-peak limiter
    def ebu(x):
        with tempfile.TemporaryDirectory() as d:
            w = os.path.join(d, 'm.wav')
            wavfile.write(w, SR, np.clip(x, -1, 1).astype(np.float32))
            o = subprocess.run(['ffmpeg', '-nostats', '-i', w, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
        return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', o)[-1]), float(re.findall(r'LRA:\s+(-?[\d.]+) LU', o)[-1]), float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', o)[-1])
    I0, _, _ = ebu(mix)
    gain = 10 ** ((-14.0 - I0) / 20)
    mix *= gain
    for k in stems:
        stems[k] = stems[k] * gain
    # look-ahead true-peak limiter (4x oversampled detection), ceiling -1.3 dBTP
    ceil = 10 ** (-1.3 / 20)
    # 4x oversampled peak per sample, in chunks (a full-length 4x buffer does not fit the memory of a 12-minute film)
    pk = np.zeros(N)
    CH, OV = SR * 20, 256
    for i0 in range(0, N, CH):
        a0, a1 = max(0, i0 - OV), min(N, i0 + CH + OV)
        up = signal.resample_poly(mix[a0:a1], 4, 1, axis=0)
        p_ = np.abs(up).max(1).reshape(-1, 4).max(1)
        pk[i0:min(N, i0 + CH)] = p_[i0 - a0:i0 - a0 + min(CH, N - i0)]
    need = np.minimum(1, ceil / np.maximum(pk, 1e-9))
    la = int(0.003 * SR)
    need = np.minimum.accumulate(np.concatenate([need[la:], np.ones(la)])[::-1])[::-1] if False else need
    gmin = signal.minimum_filter1d(need, 2 * la + 1) if hasattr(signal, 'minimum_filter1d') else None
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    gmin = minimum_filter1d(need, 2 * la + 1)
    gsm = uniform_filter1d(gmin, la)
    gsm = np.minimum(gsm, gmin)
    master = mix * gsm[:, None]
    I1, LRA, TP = ebu(master)
    os.makedirs(os.path.join(ROOT, 'out', 'audio', 'stems'), exist_ok=True)
    for k, v in stems.items():
        p = os.path.join(ROOT, 'out', 'audio', 'stems', k + '.flac')
        with tempfile.TemporaryDirectory() as d:
            w = os.path.join(d, 'a.wav')
            wavfile.write(w, SR, np.clip(v * gsm[:, None], -1, 1).astype(np.float32))
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, '-sample_fmt', 's32', p], check=True)
    wavfile.write(os.path.join(ROOT, 'out', 'audio', 'master.wav'), SR, np.clip(master, -1, 1).astype(np.float32))
    # voice / music gap as the check measures it (100 ms windows, voice RMS > -45 dBFS)
    rep = {'integratedLUFS': I1, 'LRA': LRA, 'truePeakDbfs': TP, 'limiterMinGainDb': round(float(db(gsm.min())), 2), 'moves': wrows, 'accents': len(accents), 'beats': len(beats),
           'silences': sil, 'events': len(events)}
    json.dump(rep, open(os.path.join(ROOT, '..', 'audio-report.json'), 'w'), indent=1)
    ledger = {'assets': [{'name': 'music (pad, pulse, leitmotifs, accents, reverb)', 'origin': 'synthesised in audio/d_m2_audio.py', 'seed': 20260926, 'licence': 'original work of this project; no samples or third-party audio'},
                         {'name': 'sfx, risers, impacts, whooshes, room tone', 'origin': 'synthesised in audio/d_m2_audio.py', 'seed': 20260926, 'licence': 'original work of this project'},
                         {'name': 'physical sounds of the lookdev world: water, wind, rain, stone, thunder, drips', 'origin': 'synthesised in audio/d_m2_audio.py (physical)', 'seed': 20260926, 'licence': 'original work of this project'},
                         {'name': 'voice', 'origin': 'ElevenLabs text-to-speech, voice Eric (premade), eleven_v3 / eleven_multilingual_v2', 'licence': 'ElevenLabs output under the account\'s plan; provisional voice (not decision #158)'}]}
    json.dump(ledger, open(os.path.join(REPO, 'out', 'music-ledger-d.json'), 'w'), indent=1)
    print(json.dumps({k: v for k, v in rep.items() if k not in ('moves', 'silences')}))


if __name__ == '__main__':
    main()
