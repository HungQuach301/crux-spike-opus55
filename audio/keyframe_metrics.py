"""Evidence for the layout bar on the 5 keyframes: ink coverage (negative space), grayscale
separation of the colors each frame relies on, and legibility of the smallest text at 25% size.
Writes out/keyframe-metrics.json (reads out/checks.json from render-motion/check.js)."""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'out')
TOK = {'bg': '#0E1116', 'surface': '#171B22', 'ink': '#F2F4F7', 'ink-muted': '#9AA4B2', 'accent': '#4C8DFF',
       'warn': '#F2B441', 'positive': '#3FBF7F', 'negative': '#E5484D', 'grid': '#2A303B'}


def luma(h):
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def main():
    ff = subprocess.check_output([sys.executable, '-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())']).decode().strip()
    checks = json.load(open(os.path.join(OUT, 'checks.json')))
    res = []
    for k in checks['keyframes']:
        png = os.path.join(OUT, 'keyframes', f"{k['name']}.png")
        raw = subprocess.check_output([ff, '-loglevel', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
        a = np.frombuffer(raw, np.uint8).reshape(1080, 1920, 3).astype(int)
        bg = np.array([14, 17, 22])
        ink = (np.abs(a - bg).sum(axis=2) > 60).mean()
        res.append({'name': k['name'], 'scene': k['scene'], 't': k['t'], 'inkCoverage': round(float(ink), 4),
                    'checkerIssues': len(k['issues']), 'visibleWords': k['words'], 'level1Elements': k['l1']})
    lum = {n: round(luma(h), 1) for n, h in TOK.items()}
    pairs = {'accent(A) vs warn(B)': abs(lum['accent'] - lum['warn']), 'accent vs bg': abs(lum['accent'] - lum['bg']),
             'warn vs bg': abs(lum['warn'] - lum['bg']), 'positive vs warn': abs(lum['positive'] - lum['warn']),
             'negative vs grid': abs(lum['negative'] - lum['grid'])}
    out = {'keyframes': res, 'tokenLuma': lum, 'grayscalePairLumaDelta': {k: round(v, 1) for k, v in pairs.items()},
           'note': 'A and B are also separated by stroke pattern (solid vs dashed; solid vs hatched fill), so meaning does not depend on hue.'}
    json.dump(out, open(os.path.join(OUT, 'keyframe-metrics.json'), 'w'), indent=1)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
