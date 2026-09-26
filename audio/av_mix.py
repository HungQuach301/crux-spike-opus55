"""Test C sound: test B's accepted sound design + a voice layer.

Music, the 8-SFX bank, ambience, their relative levels and the event-driven SFX placement are
test B's own functions (audio/generate.py), called unchanged on test C's timeline. New here:
  voice   TTS clips placed at their scene's voice start; 0 dB reference = -16 LUFS integrated
  duck    music is compressed under the voice (sidechain): DUCK_DB of gain reduction while the
          voice is active, 40 ms attack, 300 ms release
  voice bus  peak limiter at -6 dBTP (TTS transients), then back to -16 LUFS
  master  +gain to -14 LUFS integrated, 4x-oversampled true-peak limiter at -2.0 dBTP (AAC adds ~0.5 dB)
Writes out/audio/{voice,music,music-ducked,sfx,ambience,mix,master}.wav and placement.json."""
import json
import os
import sys

import numpy as np
import scipy.signal as sg
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(__file__))
import generate as G  # noqa: E402  test B's generator, unchanged
import loudness as LN  # noqa: E402

SR = G.SR
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'out', 'audio')
DUCK_DB = float(os.environ.get('DUCK_DB', '1.0'))
ATTACK, RELEASE = 0.04, 0.30
TARGET_LUFS, CEILING_DBTP = -14.0, -2.0
VOICE_PEAK = -6.0  # dBTP on the voice bus at its -16 LUFS reference


def load_clip(path):
    sr, x = wavfile.read(path)
    x = x.astype(np.float64) / 32768 if x.dtype == np.int16 else x.astype(np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        from math import gcd
        g = gcd(SR, sr)
        x = sg.resample_poly(x, SR // g, sr // g)
    return x


def voice_layer(tl, N):
    v = np.zeros(N + SR * 2)
    placed = []
    for s in tl['scenes']:
        if not s['voice']:
            continue
        x = load_clip(os.path.join(ROOT, s['voice']['file']))
        st = G.stereo(x)
        cur = LN.integrated(st)
        x = x * 10 ** ((G.REF_LUFS - cur) / 20)  # each clip to the 0 dB reference
        a = int(round(s['voice']['start'] * SR))
        v[a:a + len(x)] += x
        placed.append({'scene': s['id'], 'start': s['voice']['start'], 'dur': round(len(x) / SR, 3), 'clipLUFS': round(cur, 2)})
    v = G.stereo(v[:N])
    cur = LN.integrated(v)
    v = v * 10 ** ((G.REF_LUFS - cur) / 20)
    # voice-bus peak control: TTS transients sit ~16 dB above its loudness; hold them at VOICE_PEAK
    v, vred = true_peak_limit(v, VOICE_PEAK, release=0.05, look=0.003)
    voice_layer.stats = dict(true_peak_limit.last)
    cur = LN.integrated(v)
    return v * 10 ** ((G.REF_LUFS - cur) / 20), placed, vred


def voice_activity(v, win=0.01, thr_db=-45.0):
    m = np.abs(v).mean(axis=1)
    w = int(win * SR)
    n = len(m) // w
    rms = np.sqrt((m[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-12)
    act = (20 * np.log10(rms) > thr_db).astype(float)
    # bridge gaps shorter than 250 ms (between words)
    gap = int(0.25 / win)
    i = 0
    while i < n:
        if act[i] == 0:
            j = i
            while j < n and act[j] == 0:
                j += 1
            if 0 < i and j < n and j - i <= gap:
                act[i:j] = 1
            i = j
        else:
            i += 1
    return np.repeat(act, w)[: len(v)] if n * w >= len(v) else np.concatenate([np.repeat(act, w), np.zeros(len(v) - n * w)])


def duck_gain(act):
    """Sidechain gain from voice activity: attack/release one-pole smoothing of the target."""
    a_att = np.exp(-1 / (ATTACK * SR)); a_rel = np.exp(-1 / (RELEASE * SR))
    target = act * DUCK_DB
    g = np.zeros_like(target)
    y = 0.0
    # vectorised enough: process in 1 ms steps
    step = SR // 1000
    out = np.zeros(len(target) // step + 1)
    aa, ar = a_att ** step, a_rel ** step
    for k in range(len(out)):
        tv = target[min(k * step, len(target) - 1)]
        c = aa if tv > y else ar
        y = c * y + (1 - c) * tv
        out[k] = y
    g = np.interp(np.arange(len(target)), np.arange(len(out)) * step, out)
    return 10 ** (-g / 20)


def true_peak_limit(x, ceiling_db=CEILING_DBTP, release=0.1, look=0.005):
    """Look-ahead limiter on the 4x-oversampled peak. Gain is computed in 1 ms blocks: instant
    attack (the look-ahead window already holds the peak), one-pole release."""
    from scipy.ndimage import minimum_filter1d
    ceil = 10 ** (ceiling_db / 20)
    up = sg.resample_poly(x, 4, 1, axis=0)
    pk = np.abs(up).max(axis=1)[: 4 * len(x)].reshape(-1, 4).max(axis=1)
    need = minimum_filter1d(np.minimum(1.0, ceil / np.maximum(pk, 1e-12)), size=2 * int(look * SR) + 1)
    step = SR // 1000
    nb = int(np.ceil(len(need) / step))
    blk = np.pad(need, (0, nb * step - len(need)), constant_values=1.0).reshape(nb, step).min(axis=1)
    ar = np.exp(-step / (release * SR))
    g = np.empty(nb)
    y = 1.0
    for i in range(nb):
        y = blk[i] if blk[i] < y else ar * y + (1 - ar) * blk[i]
        g[i] = y
    gs = np.minimum(np.repeat(g, step)[: len(x)], need)
    true_peak_limit.last = {'shareOver1dB': round(float((gs < 10 ** (-1 / 20)).mean()), 4), 'shareOver3dB': round(float((gs < 10 ** (-3 / 20)).mean()), 4)}
    return x * gs[:, None], float(20 * np.log10(gs.min()))


def main():
    tl = json.load(open(os.path.join(ROOT, 'out', 'timeline.json')))
    os.makedirs(OUT, exist_ok=True)
    total = tl['total']
    N = int(np.ceil(total * SR))
    # --- test B layers, unchanged functions
    sfx_bank = G.make_sfx(np.random.default_rng(G.SEEDS['sfx']))
    sfx = np.zeros((N + 2 * SR, 2))
    placed = []
    for e in tl['events']:
        buf = sfx_bank[e['type']]
        a = int(round(e['t'] * SR))
        sfx[a:a + len(buf)] += buf
        placed.append({'id': e['id'], 'type': e['type'], 't': e['t'], 'sample': a})
    sfx = sfx[:N]
    music = G.make_music(tl, np.random.default_rng(G.SEEDS['music']))
    amb = G.make_ambience(total, np.random.default_rng(G.SEEDS['ambience']))
    # --- new: voice + sidechain
    voice, vplaced, vred = voice_layer(tl, N)
    act = voice_activity(voice)
    dg = duck_gain(act)
    music_d = music * dg[:, None]
    mix = voice + music_d + sfx + amb
    # --- master
    gain_db = TARGET_LUFS - LN.integrated(mix)
    for _ in range(4):
        m, gr = true_peak_limit(mix * 10 ** (gain_db / 20))
        mstats = dict(true_peak_limit.last)
        err = TARGET_LUFS - LN.integrated(m)
        if abs(err) < 0.05:
            break
        gain_db += err
    master = m
    drng = np.random.default_rng(1)
    for name, x in (('voice', voice), ('music', music), ('music-ducked', music_d), ('sfx', sfx), ('ambience', amb), ('mix', mix), ('master', master)):
        wavfile.write(os.path.join(OUT, f'{name}.wav'), SR, G.to_pcm16(x, drng))
    np.save(os.path.join(OUT, 'voice-activity.npy'), act[:: SR // 100].astype(np.uint8))
    for k, v in sfx_bank.items():
        os.makedirs(os.path.join(OUT, 'sfx-bank'), exist_ok=True)
        wavfile.write(os.path.join(OUT, 'sfx-bank', f'{k}.wav'), SR, v.astype(np.float32))
    json.dump({'placed': placed, 'voice': vplaced, 'refLufs': G.REF_LUFS, 'sfxRel': G.SFX_REL, 'musicRel': G.MUSIC_REL, 'ambRel': G.AMB_REL, 'seeds': G.SEEDS,
               'duck': {'db': DUCK_DB, 'attackS': ATTACK, 'releaseS': RELEASE, 'activity': 'voice RMS > -45 dBFS in 10 ms windows, gaps < 250 ms bridged'},
               'voiceBus': {'peakLimitDBTP': VOICE_PEAK, 'maxReductionDB': round(vred, 2), **voice_layer.stats},
               'master': {'gainDB': round(gain_db, 2), 'limiterMaxReductionDB': round(gr, 2), 'limiterTime': mstats, 'ceilingDBTP': CEILING_DBTP, 'targetLUFS': TARGET_LUFS}},
              open(os.path.join(OUT, 'placement.json'), 'w'), indent=1)
    print('mix', round(LN.integrated(mix), 2), 'master', round(LN.integrated(master), 2), 'LUFS; TP', round(LN.true_peak_db(master), 2), 'dBTP; gain', round(gain_db, 2), 'limiter', round(gr, 2))


if __name__ == '__main__':
    main()
