"""Test D table read: lay the chosen TTS take of every sentence end to end with the script's planned gaps
(scene lead/hold, 0.30 s between sentences of a scene, 0.45 s between scenes, >= 1.2 s after a decisive
sentence) and write out/tableread/tableread-<tag>.mp3 plus a timing sheet (out/tableread/tableread-<tag>.json)
with per-act pace (A15 definition: spoken words / sum of ASR spans), the fastest/slowest sentences and the
estimated running time.

    python3 audio/d_tableread.py <tag> [choice.json] [--stretch]
      choice: sentence -> take index (default 0); --stretch applies the planned per-sentence time stretch
      (out/voice/choice-report.json, rubberband, pitch and formants preserved, never beyond ±10%)
"""
import json
import os
import subprocess
import sys
import tempfile

import warnings

import numpy as np
from scipy.io import wavfile

warnings.filterwarnings('ignore', category=wavfile.WavFileWarning)

ROOT = os.path.join(os.path.dirname(__file__), '..')
VDIR = os.path.join(ROOT, 'out', 'voice')
ODIR = os.path.join(ROOT, 'out', 'tableread')
SR = 24000
GAP_SENT, GAP_SCENE, DECISIVE_HOLD, MARGIN = 0.30, 0.45, 1.2, 0.03


def stretch(seg, sr, f):
    """f = final duration / raw duration (rubberband tempo = 1/f)."""
    if abs(f - 1) < 0.005:
        return seg
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, 'a.wav'), os.path.join(d, 'b.wav')
        wavfile.write(a, sr, (np.clip(seg, -1, 1) * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a, '-af', f'rubberband=tempo={1 / f:.5f}:pitch=1:formant=preserved:transients=smooth', b], check=True)
        return wavfile.read(b)[1].astype(np.float64) / 32768


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v1'
    choice = json.load(open(sys.argv[2])) if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else {}
    do_stretch = '--stretch' in sys.argv
    plan_f = {r['id']: r['chosen']['stretch'] for r in json.load(open(os.path.join(VDIR, 'choice-report.json')))['sentences']} if do_stretch else {}
    sents = json.load(open(os.path.join(VDIR, 'sentences.json')))['sentences']
    asr = json.load(open(os.path.join(VDIR, 'asr-takes.json')))
    plan = json.loads(subprocess.check_output(['node', '-e', "const {ACTS}=require('./src/d/script');console.log(JSON.stringify(ACTS.map(a=>({id:a.id,scenes:a.scenes.map(s=>({id:s.id,lead:s.lead||0,hold:s.hold||0,n:s.lines.length}))}))))"], cwd=ROOT))
    by_scene = {}
    for s in sents:
        by_scene.setdefault(s['scene'], []).append(s)
    out, t, rows, acts = [], 0.0, [], {}
    for a in plan:
        for sc in a['scenes']:
            t += GAP_SCENE if t > 0 else 0
            t += sc['lead']
            if sc['n'] == 0:
                t += 0.4
            for k, s in enumerate(by_scene.get(sc['id'], [])):
                take = choice.get(s['id'], 0)
                rec = asr[f"{s['id']}.t{take}"]
                sr, x = wavfile.read(os.path.join(ROOT, 'out', 'voice', 'raw', f"{s['id']}.t{take}.wav"))
                x = x.astype(np.float64) / 32768
                a0, b0 = rec['speech']
                seg = x[max(0, int((a0 - MARGIN) * sr)): int((b0 + MARGIN) * sr)]
                f = plan_f.get(s['id'], 1.0)
                seg = stretch(seg, sr, f)
                if k:
                    t += GAP_SENT
                out.append((t, seg))
                dur = len(seg) / sr
                rows.append({'id': s['id'], 'act': a['id'], 'start': round(t, 2), 'dur': round(dur, 2), 'wpm': round(rec['wpm'] / f, 1), 'stretch': f, 'take': take, 'words': rec['spokenWords'], 'asrSpan': rec['asrSpan'],
                             'heard': rec['text']})
                acc = acts.setdefault(a['id'], [0, 0.0])
                acc[0] += rec['spokenWords']
                acc[1] += rec['asrSpan'] * f
                t += dur
                if s.get('decisive'):
                    t += max(0.0, DECISIVE_HOLD - GAP_SENT)
            t += sc['hold']
    total = t + 0.5
    y = np.zeros(int(total * SR) + SR)
    for t0, seg in out:
        i = int(t0 * SR)
        y[i: i + len(seg)] += seg
    os.makedirs(ODIR, exist_ok=True)
    wav = os.path.join(ODIR, f'tableread-{tag}.wav')
    wavfile.write(wav, SR, (np.clip(y, -1, 1) * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '64k', os.path.join(ODIR, f'tableread-{tag}.mp3')], check=True)
    os.unlink(wav)
    rates = {k: round(60 * n / s, 1) for k, (n, s) in acts.items()}  # after the planned stretch when --stretch
    fast = sorted([r for r in rows if r['wpm'] and r['words'] >= 4 and r['wpm'] > 175], key=lambda r: -r['wpm'])
    slow = sorted([r for r in rows if r['wpm'] and r['words'] >= 4 and r['wpm'] < 140], key=lambda r: r['wpm'])
    res = {'tag': tag, 'totalSeconds': round(total, 1), 'actWpm': rates, 'fastOver175': fast, 'slowUnder140': slow, 'sentences': rows,
           'gaps': {'sentence': GAP_SENT, 'scene': GAP_SCENE, 'decisiveHold': DECISIVE_HOLD}}
    json.dump(res, open(os.path.join(ODIR, f'tableread-{tag}.json'), 'w'), indent=1)
    print('total', res['totalSeconds'], 's | act wpm', rates, '| >175:', len(fast), '| <140:', len(slow))


if __name__ == '__main__':
    main()
