"""Procedural sound design for the car-loan segment.

Reads out/timeline.json (the same timeline the picture is rendered from) and writes
out/audio/{music,sfx,ambience,mix}.wav plus the SFX placement list. Everything is synthesized
here from fixed seeds: original work, no samples.

Levels are set against a narration reference of 0 dB = -16 LUFS integrated (a common speech
target for online video):
  music bed  -20 dB  -> -36 LUFS integrated
  SFX        -9 to -14 dB per event (momentary max, 400 ms)
  ambience   -40 dB  -> -56 LUFS integrated
"""
import json
import os
import sys

import numpy as np
import scipy.signal as sg
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(__file__))
import loudness as LN  # noqa: E402

SR = 48000
REF_LUFS = -16.0
MUSIC_REL, AMB_REL = -20.0, -40.0
SFX_REL = {  # dB relative to reference, momentary max per event
    'appear': -12.0, 'count': -14.0, 'compare': -11.0, 'threshold-cross': -9.0,
    'reveal': -9.0, 'dismiss': -13.0, 'transition': -12.0, 'emphasis': -9.0,
}
SEEDS = {'music': 20260926, 'sfx': 8080, 'ambience': 404}
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'out', 'audio')


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def stereo(m, width=0.0):
    return np.stack([m * (1 - width), m * (1 + width)], axis=1)


def exp_env(n, tau, attack=0.003):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1)
    return a * np.exp(-t / tau)


# ---------------------------------------------------------------- SFX (one fixed sound per type)
def make_sfx(rng):
    def tone(freqs, amps, tau, length, attack=0.003, delays=None):
        n = int(length * SR)
        t = np.arange(n) / SR
        out = np.zeros(n)
        for i, (f, a) in enumerate(zip(freqs, amps)):
            d = int((delays[i] if delays else 0) * SR)
            e = exp_env(n - d, tau, attack)
            out[d:] += a * e * np.sin(2 * np.pi * f * t[: n - d])
        return out

    s = {}
    s['appear'] = tone([1318.5, 1977.8], [1.0, 0.3], 0.11, 0.55)
    s['count'] = tone([2400, 1200], [0.6, 0.5], 0.03, 0.22)
    s['compare'] = tone([659.3, 880.0], [1.0, 1.0], 0.12, 0.7, delays=[0, 0.12])
    # threshold-cross: short rising chirp into a two-partial chime
    n = int(1.1 * SR); t = np.arange(n) / SR
    chirp = sg.chirp(t[: int(0.22 * SR)], 500, 0.22, 1500, method='logarithmic') * np.hanning(int(0.44 * SR))[: int(0.22 * SR)]
    tc = np.zeros(n); tc[: len(chirp)] += 0.5 * chirp
    tc += tone([1500, 2250], [0.8, 0.35], 0.35, 1.1, delays=[0.2, 0.2])
    s['threshold-cross'] = tc
    s['reveal'] = tone([880, 1318.5, 1760, 2637], [0.7, 0.5, 0.4, 0.25], 0.5, 1.5, attack=0.01, delays=[0, 0.02, 0.04, 0.06])
    n = int(0.6 * SR); t = np.arange(n) / SR
    f = 700 * (0.5 ** (t / 0.3))
    s['dismiss'] = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_env(n, 0.16, 0.005)
    # transition: band-limited noise swell (a soft "air" move), 0.9 s
    n = int(0.9 * SR)
    noise = rng.standard_normal(n)
    lo = sg.sosfilt(sg.butter(2, [300, 900], 'bandpass', fs=SR, output='sos'), noise)
    hi = sg.sosfilt(sg.butter(2, [1200, 4000], 'bandpass', fs=SR, output='sos'), noise)
    x = np.linspace(0, 1, n)
    swell = np.sin(np.pi * np.clip(x / 0.9, 0, 1)) ** 1.5
    s['transition'] = (lo * (1 - x) + hi * x) * swell
    s['transition'][: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    em = tone([82.4], [1.0], 0.14, 1.6, attack=0.004) + tone([987.8, 1975.5], [0.45, 0.18], 0.6, 1.6, attack=0.006)
    s['emphasis'] = em
    out = {}
    for k, v in s.items():
        st = stereo(v)
        cur = LN.momentary_max(st)
        target = REF_LUFS + SFX_REL[k]
        out[k] = st * 10 ** ((target - cur) / 20)
    return out


# ---------------------------------------------------------------- music bed
CHORDS = {
    'Dm9': [50, 57, 60, 64, 65], 'Bbmaj7': [46, 53, 57, 62], 'Fmaj7': [41, 48, 57, 64], 'Csus2': [48, 55, 62],
    'Gm9': [43, 50, 53, 57, 58], 'Asus4': [45, 52, 62], 'Dsus2': [38, 50, 57, 64],
}
PROGRESSION = {  # one tonal identity (D minor / dorian); texture changes by section
    'setup': ['Dm9', 'Bbmaj7', 'Fmaj7', 'Csus2'],
    'sweep': ['Dm9', 'Gm9', 'Bbmaj7', 'Csus2'],
    'tension': ['Gm9', 'Asus4', 'Bbmaj7', 'Asus4'],
    'resolution': ['Bbmaj7', 'Dsus2'],
}
CUTOFF = {'setup': 1800, 'sweep': 2400, 'tension': 1100, 'resolution': 2000}


def pad_note(f, n, rng, detune_cents):
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for ch, sign in ((0, -1), (1, 1)):
        ff = f * 2 ** (sign * detune_cents / 1200)
        for h in range(1, 7):
            out[:, ch] += (1 / h ** 1.6) * np.sin(2 * np.pi * h * ff * t + rng.uniform(0, 2 * np.pi))
    return out


def make_music(tl, rng):
    total = tl['total']
    N = int(np.ceil(total * SR))
    pad = np.zeros((N + SR * 2, 2))
    sub = np.zeros_like(pad)
    pulse = np.zeros_like(pad)
    tex = np.zeros_like(pad)
    sections = {}
    for s in tl['scenes']:
        sections.setdefault(s['section'], []).append(s)
    beat = tl['beat']
    for sec, scenes in sections.items():
        prog = PROGRESSION[sec]
        sos = sg.butter(4, CUTOFF[sec], 'lowpass', fs=SR, output='sos')
        for j, s in enumerate(scenes):
            chord = CHORDS[prog[j % len(prog)]]
            a = int(s['start'] * SR)
            rel = 0.9
            n = int((s['dur'] + rel) * SR)
            env = np.ones(n)
            att = int(0.5 * SR)
            env[:att] = np.linspace(0, 1, att) ** 2
            r0 = int(s['dur'] * SR)
            env[r0:] = np.linspace(1, 0, n - r0) ** 2
            seg = sum(pad_note(midi(m), n, rng, 3.0) for m in chord) / len(chord)
            seg = sg.sosfilt(sos, seg, axis=0) * env[:, None]
            pad[a:a + n] += seg
            root = midi(min(chord) - 12)
            t = np.arange(n) / SR
            if sec in ('sweep', 'tension'):
                sub[a:a + n] += stereo(0.35 * np.sin(2 * np.pi * root * t) * env)
            if sec == 'sweep':  # soft 8th-note pulse on root and fifth: rhythm, not melody
                step = beat / 2
                k = 0
                while k * step < s['dur'] - 0.05:
                    p0 = a + int(k * step * SR)
                    note = midi(min(chord) + (12 if k % 2 == 0 else 19))
                    m = int(0.28 * SR)
                    tt = np.arange(m) / SR
                    pl = (np.sin(2 * np.pi * note * tt) + 0.3 * np.sin(4 * np.pi * note * tt)) * exp_env(m, 0.07, 0.004)
                    pulse[p0:p0 + m] += stereo(0.18 * pl, 0.1 if k % 2 else -0.1)
                    k += 1
            if sec == 'tension':  # filtered noise swell rising through each scene
                nn = rng.standard_normal(n)
                bp = sg.sosfilt(sg.butter(2, [250, 1000], 'bandpass', fs=SR, output='sos'), nn)
                ramp = np.clip(np.arange(n) / max(1, r0), 0, 1) ** 2 * env
                tex[a:a + n] += stereo(0.12 * bp * ramp, 0.05)
    lfo = 1 + 0.08 * np.sin(2 * np.pi * 0.1 * np.arange(len(pad)) / SR)
    music = (pad + sub + pulse + tex) * lfo[:, None]
    music = music[:N]
    # fade out over the last 1.5 s
    f = int(1.5 * SR)
    music[-f:] *= np.linspace(1, 0, f)[:, None] ** 2
    # intentional silences (music only), 15 ms ramps
    gain = np.ones(N)
    r = int(0.015 * SR)
    for w in tl['silences']:
        a, b = int(w['start'] * SR), int(w['end'] * SR)
        gain[a:b] = 0
        gain[max(0, a - r):a] = np.minimum(gain[max(0, a - r):a], np.linspace(1, 0, a - max(0, a - r)))
        gain[b:b + r] = np.minimum(gain[b:b + r], np.linspace(0, 1, len(gain[b:b + r])))
    music *= gain[:, None]
    cur = LN.integrated(music)
    return music * 10 ** ((REF_LUFS + MUSIC_REL - cur) / 20)


def make_ambience(total, rng):
    N = int(np.ceil(total * SR))
    w = rng.standard_normal((N, 2))
    w[:, 1] = 0.7 * w[:, 1] + 0.3 * w[:, 0]
    brown = np.cumsum(w, axis=0)
    brown = sg.sosfilt(sg.butter(2, 30, 'highpass', fs=SR, output='sos'), brown, axis=0)
    brown = sg.sosfilt(sg.butter(2, 500, 'lowpass', fs=SR, output='sos'), brown, axis=0)
    f = int(0.5 * SR)
    brown[:f] *= np.linspace(0, 1, f)[:, None]
    brown[-f:] *= np.linspace(1, 0, f)[:, None]
    cur = LN.integrated(brown)
    return brown * 10 ** ((REF_LUFS + AMB_REL - cur) / 20)


def to_pcm16(x, rng):
    """16-bit PCM with TPDF dither."""
    d = (rng.random(x.shape) - rng.random(x.shape)) / 32768
    return np.clip(np.round((x + d) * 32767), -32768, 32767).astype(np.int16)


def main():
    tl = json.load(open(os.path.join(ROOT, 'out', 'timeline.json')))
    os.makedirs(OUT, exist_ok=True)
    total = tl['total']
    N = int(np.ceil(total * SR))
    sfx_bank = make_sfx(np.random.default_rng(SEEDS['sfx']))
    sfx = np.zeros((N + 2 * SR, 2))
    placed = []
    for e in tl['events']:
        buf = sfx_bank[e['type']]
        a = int(round(e['t'] * SR))
        sfx[a:a + len(buf)] += buf
        placed.append({'id': e['id'], 'type': e['type'], 't': e['t'], 'sample': a})
    sfx = sfx[:N]
    music = make_music(tl, np.random.default_rng(SEEDS['music']))
    amb = make_ambience(total, np.random.default_rng(SEEDS['ambience']))
    mix = music + sfx + amb
    drng = np.random.default_rng(1)
    for name, x in (('music', music), ('sfx', sfx), ('ambience', amb), ('mix', mix)):
        wavfile.write(os.path.join(OUT, f'{name}.wav'), SR, to_pcm16(x, drng))
    for k, v in sfx_bank.items():
        os.makedirs(os.path.join(OUT, 'sfx-bank'), exist_ok=True)
        wavfile.write(os.path.join(OUT, 'sfx-bank', f'{k}.wav'), SR, v.astype(np.float32))
    json.dump({'placed': placed, 'refLufs': REF_LUFS, 'sfxRel': SFX_REL, 'musicRel': MUSIC_REL, 'ambRel': AMB_REL, 'seeds': SEEDS},
              open(os.path.join(OUT, 'placement.json'), 'w'), indent=1)
    print('wrote', OUT, 'events', len(placed))


if __name__ == '__main__':
    main()
