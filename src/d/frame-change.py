"""Test D: how much of the picture actually changes (M2b measure).

Decodes the video's luma at full resolution, removes grain with a spatial Gaussian blur (sigma 1.5 px, ffmpeg gblur),
and for every pair of consecutive frames counts the pixels whose luma changed by more than 4 codes. A frame "changes"
when that count is >= THRESH % of the frame (default 0.5 %). Reports the share of changed frames, the longest run of
unchanged frames, and the same numbers at 0.1 %.

    python3 src/d/frame-change.py video.mp4 [--from s] [--to s] [--json out.json]
"""
import json
import subprocess
import sys

import numpy as np

args = sys.argv[1:]
src = args[0]
opt = lambda k, d=None: args[args.index('--' + k) + 1] if '--' + k in args else d
W, H = 1920, 1080
cmd = ['ffmpeg', '-loglevel', 'error']
if opt('from'):
    cmd += ['-ss', opt('from')]
if opt('to'):
    cmd += ['-to', opt('to')]
cmd += ['-i', src, '-vf', 'extractplanes=y,gblur=sigma=1.5', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']
p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
prev = None
fr = []
while True:
    b = p.stdout.read(W * H)
    if len(b) < W * H:
        break
    y = np.frombuffer(b, np.uint8).astype(np.int16)
    if prev is not None:
        fr.append(float(np.count_nonzero(np.abs(y - prev) > 4)) / (W * H) * 100)
    prev = y
fr = np.array(fr)


def stats(th):
    ch = fr >= th
    run = best = 0
    for c in ch:
        run = 0 if c else run + 1
        best = max(best, run)
    return {'threshold%': th, 'framesChanged%': round(float(ch.mean() * 100), 1), 'longestStillRun_s': round(best / 30, 2)}


out = {'video': src, 'pairs': int(len(fr)), 'method': 'luma, gblur sigma 1.5 (grain removed), |dY| > 4 codes', 'at0.5': stats(0.5), 'at0.1': stats(0.1),
       'medianChangedPixels%': round(float(np.median(fr)), 3)}
print(json.dumps(out))
if opt('json'):
    json.dump(out, open(opt('json'), 'w'), indent=1)
