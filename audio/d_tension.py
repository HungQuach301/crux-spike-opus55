"""Test D: tension map of a contract root measured on its own edit and stems (replaces the planned curves once the
sound exists). Per second: cut rate = cuts in the 10 s window around t (out/transitions.json); music level = music-stem
RMS dB over 1 s; audio density = stems (voice, music, sfx, whoosh) above -45 dBFS in that second, 5 s moving mean;
tension = 5 s moving mean of 0.4 x cut rate/4 + 0.4 x (music dB + 50)/30 + 0.2 x density/4 (each clipped to 0..1).
Peaks: the tension maximum within +-5 s of each act climax (timeline acts[].climax); valleys: the minimum in the 45 s
after each peak. Also redraws the PNG.

    python3 audio/d_tension.py out/m2/root
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy.io import wavfile

ROOT = os.path.abspath(sys.argv[1])
J = lambda p: json.load(open(os.path.join(ROOT, p)))


def load(name):
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'a.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(ROOT, 'out', 'audio', 'stems', name + '.flac'), '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', w], check=True)
        return wavfile.read(w)[1].astype(np.float64)


def main():
    tl = J('out/timeline.json')
    cuts = np.array([c['t'] for c in J('out/transitions.json')['cuts']])
    T = int(tl['total'])
    st = {k: load(k) for k in ('voice', 'music', 'sfx', 'whoosh')}
    sr = 48000
    rms = lambda x, a, b: 20 * np.log10(np.sqrt(np.mean(x[int(a * sr):int(b * sr)] ** 2) + 1e-12))
    raw = []
    for t in range(T + 1):
        cr = int(np.sum((cuts > t - 5) & (cuts <= t + 5)))
        ml = rms(st['music'], max(0, t - 0.5), t + 0.5)
        dens = sum(rms(st[k], t, t + 1) > -45 for k in st)
        raw.append((t, cr, ml, dens))
    dens5 = np.convolve([r[3] for r in raw], np.ones(5) / 5, 'same')
    comp = np.array([0.4 * min(1, r[1] / 4) + 0.4 * np.clip((r[2] + 50) / 30, 0, 1) + 0.2 * d / 4 for r, d in zip(raw, dens5)])
    ten = np.convolve(comp, np.ones(5) / 5, 'same')
    samples = [{'t': r[0], 'cutRate': r[1], 'audioDensity': round(float(d), 2), 'musicLevel': round(float(r[2]), 1), 'tension': round(float(x), 3)} for r, d, x in zip(raw, dens5, ten)]
    peaks, valleys = [], []
    for a in tl['acts']:
        if a.get('climax') is None:
            continue
        w = [s for s in samples if abs(s['t'] - a['climax']) <= 5]
        p = max(w, key=lambda s: s['tension'])
        peaks.append({'t': p['t'], 'act': a['id']})
        v = [s for s in samples if p['t'] + 2 < s['t'] <= p['t'] + 45]
        if v:
            valleys.append({'t': min(v, key=lambda s: s['tension'])['t']})
    out = {'note': 'measured on the delivered edit and stems (audio/d_tension.py)', 'samples': samples, 'peaks': peaks, 'valleys': valleys}
    json.dump(out, open(os.path.join(ROOT, 'out', 'tension-map.json'), 'w'), indent=1)
    # PNG via ffmpeg-free SVG -> Chromium would be heavier; draw with numpy into a PPM and convert
    W, H = 1600, 400
    img = np.full((H, W, 3), (11, 15, 23), np.uint8)
    def plot(vals, lo, hi, col):
        xs = np.linspace(0, W - 1, len(vals)).astype(int)
        ys = (H - 20 - (np.clip((np.array(vals) - lo) / (hi - lo), 0, 1) * (H - 40))).astype(int)
        for i in range(1, len(xs)):
            n = max(abs(xs[i] - xs[i - 1]), abs(ys[i] - ys[i - 1]), 1)
            for k in range(n + 1):
                x = xs[i - 1] + (xs[i] - xs[i - 1]) * k // n
                y = ys[i - 1] + (ys[i] - ys[i - 1]) * k // n
                img[max(0, y - 1):y + 2, max(0, x - 1):x + 2] = col
    plot([s['cutRate'] for s in samples], 0, 6, (255, 200, 87))
    plot([s['musicLevel'] for s in samples], -70, -20, (90, 156, 235))
    plot([s['audioDensity'] for s in samples], 0, 4, (201, 139, 216))
    plot([s['tension'] for s in samples], 0, 1, (242, 244, 248))
    for p in peaks:
        x = int(p['t'] / T * (W - 1))
        img[:, max(0, x - 1):x + 2] = (232, 118, 106)
    for v in valleys:
        x = int(v['t'] / T * (W - 1))
        img[:, max(0, x - 1):x + 2] = (108, 196, 154)
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'a.ppm')
        with open(p, 'wb') as f:
            f.write(b'P6 %d %d 255\n' % (W, H) + img.tobytes())
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', p, os.path.join(ROOT, 'out', 'tension-map.png')], check=True)
    print('peaks', peaks, 'valleys', valleys)


if __name__ == '__main__':
    main()
