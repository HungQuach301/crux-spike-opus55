"""Test D M3 round 3 (H7b): how loop-like the music stem is. Per bar (4 beats of the edit's tempo map) a 12-bin chroma
vector (STFT magnitude folded to pitch classes, 55-2000 Hz) plus the bar's onset pattern (16 spectral-flux steps);
a 4-bar phrase = its 4 bars concatenated. Reported: cosine similarity of every phrase with the phrase just before it
(mean; share >= 0.90 and >= 0.95 = "the same phrase again"), the longest run of consecutive near-identical (>= 0.90) phrases, and the
passages where the old music repeated most (for the review clips).
  python3 audio/d_music_selfsim.py <music.flac> <tempo-map.json> [label]
"""
import json
import subprocess
import sys

import numpy as np
from scipy import signal

SR = 12000


def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def main():
    x = load(sys.argv[1])
    beats = json.load(open(sys.argv[2]))['beats']
    label = sys.argv[3] if len(sys.argv) > 3 else sys.argv[1]
    f, t, Z = signal.stft(x, SR, nperseg=2048, noverlap=1536)
    M = np.abs(Z)
    keep = (f >= 55) & (f <= 2000)
    pc = (np.round(12 * np.log2(f[keep] / 440.0)) % 12).astype(int)
    chroma = np.zeros((12, M.shape[1]))
    for k in range(12):
        chroma[k] = M[keep][pc == k].sum(0)
    flux = np.maximum(0, np.diff(M, axis=1, prepend=M[:, :1])).sum(0)
    bars = beats[::4]
    feats = []
    for i in range(len(bars) - 1):
        a, b = np.searchsorted(t, bars[i]), np.searchsorted(t, bars[i + 1])
        if b - a < 4:
            feats.append(None); continue
        c = chroma[:, a:b].mean(1)
        c = c / (np.linalg.norm(c) + 1e-12)
        fl = flux[a:b]
        on = np.array([fl[int(j * (b - a) / 16):int((j + 1) * (b - a) / 16) or 1].mean() for j in range(16)])
        on = on / (np.linalg.norm(on) + 1e-12)
        feats.append(np.concatenate([c, 0.7 * on]))
    ph = []
    for i in range(0, len(feats) - 3, 4):
        blk = feats[i:i + 4]
        if any(v is None for v in blk):
            ph.append(None); continue
        v = np.concatenate(blk)
        ph.append((bars[i], v / np.linalg.norm(v)))
    sims = []
    for i in range(1, len(ph)):
        if ph[i] is None or ph[i - 1] is None:
            continue
        sims.append((ph[i][0], float(ph[i][1] @ ph[i - 1][1])))
    s = np.array([v for _, v in sims])
    run, best, start, best_start = 0, 0, None, None
    for (t0, v) in sims:
        if v >= 0.90:
            run += 1
            if run == 1:
                start = t0
            if run > best:
                best, best_start = run, start
        else:
            run = 0
    # passages with the most repetition: 30 s windows ranked by mean phrase-to-phrase similarity
    win = []
    for (t0, _) in sims:
        vs = [v for (tt, v) in sims if t0 <= tt < t0 + 30]
        if len(vs) >= 3:
            win.append((round(t0, 2), round(float(np.mean(vs)), 4)))
    win.sort(key=lambda w: -w[1])
    top = []
    for w in win:
        if all(abs(w[0] - u[0]) > 60 for u in top):
            top.append(w)
        if len(top) == 3:
            break
    rep = {'label': label, 'phrases': len(ph), 'pairs': len(s), 'meanSimilarity': round(float(s.mean()), 4), 'medianSimilarity': round(float(np.median(s)), 4),
           'shareAtLeast0.90': round(float((s >= 0.90).mean()), 4), 'shareAtLeast0.95': round(float((s >= 0.95).mean()), 4), 'longestRunOfRepeats(>=0.90)': best, 'longestRunStarts': best_start and round(best_start, 2),
           'mostRepetitive30s': top}
    print(json.dumps(rep))


if __name__ == '__main__':
    main()
