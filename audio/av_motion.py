"""Test C: test B's motion + structure metrics (audio/motion_metrics.py), plus the new
"visible motion" measure: share of frames in which >= 0.5% of pixels change by more than 4 luma
levels (reported per scene and overall; no threshold set yet).

Motion + structure metrics from the encoded picture, checked against the genre limits.

A frame "moves" when the mean absolute luma difference to the previous frame (full 1920x1080,
8-bit) exceeds a threshold: 4x the encoder noise floor (95th percentile of the frame difference
when a keyframe is held still for 2 s and encoded with the same x264 settings), floored at 0.02.
Writes out/motion-metrics.json."""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'out')


def encoder_noise_floor(ff):
    """p95 frame difference of a truly static picture (each keyframe held 2 s) encoded with the
    same x264 settings as the segment: what 'no motion' looks like after compression."""
    import glob
    import tempfile
    W, H = 1920, 1080
    vals = []
    for png in sorted(glob.glob(os.path.join(OUT, 'keyframes', '*.png'))):
        tmp = os.path.join(tempfile.gettempdir(), 'still.mp4')
        subprocess.run([ff, '-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', '2', '-i', png, '-c:v', 'libx264', '-preset', 'medium',
                        '-crf', '16', '-pix_fmt', 'yuv420p', '-vf', 'scale=out_color_matrix=bt709', tmp], check=True)
        raw = subprocess.check_output([ff, '-loglevel', 'error', '-i', tmp, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
        fr = np.frombuffer(raw, np.uint8).reshape(-1, H * W).astype(np.int16)
        vals += list(np.abs(np.diff(fr, axis=0)).mean(axis=1))
    return float(np.percentile(vals, 95))


def main(video):
    ff = 'ffmpeg'
    tl = json.load(open(os.path.join(OUT, 'timeline.json')))
    txt = json.load(open(os.path.join(OUT, 'text-metrics.json')))
    W, H, FPS = 1920, 1080, 30
    p = subprocess.Popen([ff, '-loglevel', 'error', '-i', video, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], stdout=subprocess.PIPE)
    diffs, visible, prev = [], [], None
    while True:
        buf = p.stdout.read(W * H)
        if len(buf) < W * H:
            break
        fr = np.frombuffer(buf, np.uint8).astype(np.int16)
        if prev is None:
            diffs.append(0.0); visible.append(0.0)
        else:
            ad = np.abs(fr - prev)
            diffs.append(float(ad.mean())); visible.append(float((ad > 4).mean()))
        prev = fr
    p.wait()
    d = np.array(diffs)
    vis_share = np.array(visible)
    vis_move = vis_share >= 0.005
    n = len(d)
    t = np.arange(n) / FPS
    floor = encoder_noise_floor(ff)
    thr = max(0.02, 4 * floor)
    moves = d > thr
    moves[0] = moves[1] if n > 1 else False
    runs, cur, longest, longest_at = [], 0, 0, 0
    for i, m in enumerate(moves):
        cur = 0 if m else cur + 1
        if cur > longest:
            longest, longest_at = cur, i - cur + 1
    coverage = float(moves.mean())

    scenes = []
    by = {s['id']: s for s in txt['scenes']}
    for s in tl['scenes']:
        a, b = int(round(s['start'] * FPS)), int(round((s['start'] + s['dur']) * FPS))
        sm = moves[a:b]
        tw = by[s['id']]
        scenes.append({
            'id': s['id'], 'start': s['start'], 'duration': s['dur'], 'beats': s['beats'], 'section': s['section'],
            'shot': s['shot'], 'layout': s['layout'], 'cameraScale': (s['cam'] or {}).get('s'),
            'words': tw['words'], 'newWords': tw['newWords'], 'newWordsPerSec': tw['newWordsPerSec'],
            'motionCoverage': round(float(sm.mean()), 3),
            'visibleMotionShare': round(float(vis_move[a:b].mean()), 3),
            'pass': {'duration1.2to12s': 1.2 <= s['dur'] <= 12, 'words<=12': tw['words'] <= 12, 'newWordsPerSec<=1.5': tw['newWordsPerSec'] <= 1.5},
        })
    durs = np.array([s['dur'] for s in tl['scenes']])
    ratio = float(durs.std() / durs.mean())
    short = durs < 2
    run, max_run = 0, 0
    for x in short:
        run = run + 1 if x else 0
        max_run = max(max_run, run)
    target = {'wide': 0.20, 'medium': 0.40, 'close': 0.30, 'detail': 0.10}
    mix = {k: sum(1 for s in tl['scenes'] if s['shot'] == k) / len(tl['scenes']) for k in target}
    mix_time = {k: sum(s['dur'] for s in tl['scenes'] if s['shot'] == k) / tl['total'] for k in target}
    morphs = tl.get('morphs', [])
    out = {
        'definitions': {
            'movingFrame': f'mean |luma(t) - luma(t-1)| over all 1920x1080 pixels > {thr:.3f} (8-bit levels); threshold = max(0.02, 4 x p95 encoder noise floor), noise floor measured by encoding each keyframe as a 2 s still with the same x264 settings',
            'words': 'max over sampled frames (every 3rd) of words in text elements with opacity > 0.5; numbers count as words',
            'newWordsPerSec': 'words in text elements visible in the scene but not at the end of the previous scene, divided by scene duration',
            'shotSize': 'from virtual-camera scale: wide < 0.6 <= medium < 1.3 <= close < 2.4 <= detail',
        },
        'global': {
            'durationS': tl['total'], 'frames': n, 'threshold': round(thr, 4), 'noiseFloorP95': round(floor, 4),
            'motionCoverage': {'value': round(coverage, 3), 'limit': '>= 0.70', 'pass': coverage >= 0.70},
            'visibleMotion': {'value': round(float(vis_move.mean()), 3), 'definition': 'share of frames with >= 0.5% of pixels changing by more than 4 luma levels vs the previous frame', 'limit': 'none yet (reported only)'},
            'longestStaticRunS': {'value': round(longest / FPS, 2), 'atS': round(longest_at / FPS, 2), 'limit': '<= 8', 'pass': longest / FPS <= 8},
            'wordsPerSec': {'value': txt['wordsPerSec'], 'limit': '<= 1.5', 'pass': txt['wordsPerSec'] <= 1.5},
            'maxWordsInAnyScene': {'value': max(s['words'] for s in scenes), 'limit': '<= 12', 'pass': all(s['words'] <= 12 for s in scenes)},
            'maxNewWordsPerSecInAnyScene': {'value': max(s['newWordsPerSec'] for s in scenes), 'limit': '<= 1.5 (per scene, stricter than required)', 'pass': all(s['newWordsPerSec'] <= 1.5 for s in scenes)},
            'sceneDurations': {'min': float(durs.min()), 'max': float(durs.max()), 'limit': '1.2-12 s', 'pass': bool(durs.min() >= 1.2 and durs.max() <= 12)},
            'sceneLengthStdOverMean': {'value': round(ratio, 3), 'limit': '>= 0.4', 'pass': ratio >= 0.4},
            'maxConsecutiveScenesUnder2s': {'value': max_run, 'limit': '<= 3', 'pass': max_run <= 3},
            'shotMixByScene': {k: {'value': round(v, 3), 'target': target[k], 'pass': abs(v - target[k]) <= 0.08} for k, v in mix.items()},
            'shotMixByTime': {k: round(v, 3) for k, v in mix_time.items()},
            'morphTransitions': {'value': len(morphs), 'list': morphs, 'limit': '>= 3', 'pass': len(morphs) >= 3},
            'stillness': [{'start': w['start'], 'end': w['end'], 'durationS': round(w['end'] - w['start'], 2), 'measuredMovingFrames': int(moves[int(w['start'] * FPS) + 1:int(w['end'] * FPS)].sum())} for w in tl['still']],
        },
        'scenes': scenes,
    }
    json.dump(out, open(os.path.join(OUT, 'motion-metrics.json'), 'w'), indent=1)
    g = out['global']
    print(json.dumps({k: (v.get('value') if isinstance(v, dict) and 'value' in v else v) for k, v in g.items() if k not in ('stillness',)}, indent=0)[:1500])
    print('pass all:', all(v['pass'] for v in g.values() if isinstance(v, dict) and 'pass' in v) and all(x['pass'] for x in g['shotMixByScene'].values()))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT, '.video-only.mp4'))
