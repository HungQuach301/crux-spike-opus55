"""Test D: word timings and reading pace of every TTS take (faster-whisper small.en, int8, word timestamps).
For each take: speech span = first to last 20 ms window above -45 dBFS (the same span definition as check A13);
wpm = spoken words / ASR span (first word start to last word end, as check A15 measures it).
Writes out/voice/asr-takes.json (cached by the TTS key)."""
import json
import os
import time

import warnings

import numpy as np
from scipy.io import wavfile

warnings.filterwarnings('ignore', category=wavfile.WavFileWarning)

ROOT = os.path.join(os.path.dirname(__file__), '..')
VDIR = os.path.join(ROOT, 'out', 'voice')


def load(p):
    sr, x = wavfile.read(p)
    x = x.astype(np.float64) / 32768 if x.dtype == np.int16 else x.astype(np.float64)
    return sr, (x.mean(axis=1) if x.ndim > 1 else x)


def speech_span(x, sr, thr=-45.0, win=0.02):
    w = int(win * sr)
    n = len(x) // w
    db = 20 * np.log10(np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-12))
    on = np.where(db > thr)[0]
    return (on[0] * win, (on[-1] + 1) * win) if len(on) else (0.0, 0.0)


def main():
    from faster_whisper import WhisperModel
    t0 = time.time()
    model = WhisperModel('small.en', device='cpu', compute_type='int8')
    sents = {s['id']: s for s in json.load(open(os.path.join(VDIR, 'sentences.json')))['sentences']}
    man = json.load(open(os.path.join(VDIR, 'tts-manifest.json')))
    out_p = os.path.join(VDIR, 'asr-takes.json')
    prev = json.load(open(out_p)) if os.path.exists(out_p) else {}
    out = {}
    for name, rec in man.items():
        if name.startswith('_'):
            continue
        sid = name.rsplit('.t', 1)[0]
        if sid not in sents:
            continue
        if prev.get(name, {}).get('key') == rec['key']:
            out[name] = prev[name]
            continue
        same = next((v for v in prev.values() if v.get('key') == rec['key']), None)
        if same:  # identical audio under another sentence id
            out[name] = {**same, 'sid': sid}
            continue
        p = os.path.join(ROOT, rec['file'])
        sr, x = load(p)
        a, b = speech_span(x, sr)
        segs, _ = model.transcribe(p, word_timestamps=True, language='en', beam_size=5, condition_on_previous_text=False)
        words = [{'w': w.word.strip(), 'start': round(float(w.start), 3), 'end': round(float(w.end), 3), 'p': round(float(w.probability), 3)} for s in segs for w in s.words]
        n = len(sents[sid]['spoken'].split())
        span = (words[-1]['end'] - words[0]['start']) if words else 0
        out[name] = {'key': rec['key'], 'sid': sid, 'duration': round(len(x) / sr, 3), 'speech': [round(a, 3), round(b, 3)], 'words': words,
                     'text': ' '.join(w['w'] for w in words), 'spokenWords': n, 'asrSpan': round(span, 3), 'wpm': round(60 * n / span, 1) if span > 0 else None}
        print(name, out[name]['wpm'], '|', out[name]['text'], flush=True)
    json.dump(out, open(out_p, 'w'), indent=1)
    print('asr seconds', round(time.time() - t0, 1))


if __name__ == '__main__':
    main()
