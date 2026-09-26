"""Word timings for test C. For each TTS clip: trim leading/trailing silence (energy, -45 dBFS in
10 ms windows, 30 ms margin), then run faster-whisper small.en locally with word timestamps on the
trimmed clip. Writes out/voice/<scene>.trim.wav and out/voice/asr.json (times relative to the
trimmed clip)."""
import json
import os
import time

import numpy as np
from scipy.io import wavfile

ROOT = os.path.join(os.path.dirname(__file__), '..')
VDIR = os.path.join(ROOT, 'out', 'voice')


def trim(x, sr, thr_db=-45.0, margin=0.03):
    w = int(0.01 * sr)
    n = len(x) // w
    rms = np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    on = np.where(db > thr_db)[0]
    a = max(0, on[0] * w - int(margin * sr))
    b = min(len(x), (on[-1] + 1) * w + int(margin * sr))
    return a, b


STAGE = os.environ.get('ASR_STAGE', 'raw')  # raw: trim the TTS clip -> asr-raw.json; final: retimed clip -> asr.json


def main():
    from faster_whisper import WhisperModel
    t0 = time.time()
    model = WhisperModel('small.en', device='cpu', compute_type='int8')
    script = json.load(open(os.path.join(VDIR, 'script.json')))
    prev_path = os.path.join(VDIR, 'asr-raw.json' if STAGE == 'raw' else 'asr.json')
    prev = json.load(open(prev_path))['scenes'] if os.path.exists(prev_path) else {}
    man = json.load(open(os.path.join(VDIR, 'tts-manifest.json')))
    out = {}
    for s in script['scenes']:
        if not s['spoken']:
            continue
        # reuse the previous transcript when the clip is unchanged (same TTS key)
        src_key = man.get(s['id'], {}).get('key') if STAGE == 'raw' else json.load(open(os.path.join(VDIR, 'retime.json')))[s['id']]['key']
        if s['id'] in prev and prev[s['id']].get('ttsKey') == src_key:
            out[s['id']] = prev[s['id']]
            continue
        sr, x = wavfile.read(os.path.join(VDIR, f"{s['id']}.wav" if STAGE == 'raw' else f"{s['id']}.final.wav"))
        x = x.astype(np.float64) / 32768 if x.dtype == np.int16 else x.astype(np.float64)
        if x.ndim > 1:
            x = x.mean(axis=1)
        if STAGE == 'raw':
            a, b = trim(x, sr)
            y = x[a:b]
            tw = os.path.join(VDIR, f"{s['id']}.trim.wav")
            wavfile.write(tw, sr, (np.clip(y, -1, 1) * 32767).astype(np.int16))
        else:
            a, b, y = 0, len(x), x
            tw = os.path.join(VDIR, f"{s['id']}.final.wav")
        segs, info = model.transcribe(tw, word_timestamps=True, language='en', beam_size=5, condition_on_previous_text=False)
        words = []
        text = []
        for seg in segs:
            text.append(seg.text.strip())
            for w in seg.words:
                words.append({'w': w.word.strip(), 'raw': w.word, 'start': round(float(w.start), 3), 'end': round(float(w.end), 3), 'p': round(float(w.probability), 3)})
        out[s['id']] = {'ttsKey': src_key, 'sr': sr, 'trimStart': round(a / sr, 3), 'trimEnd': round(b / sr, 3), 'duration': round(len(y) / sr, 3), 'text': ' '.join(text), 'words': words}
        print(s['id'], out[s['id']]['duration'], 's |', out[s['id']]['text'])
    json.dump({'model': 'faster-whisper small.en (int8, CPU, beam 5)', 'stage': STAGE, 'seconds': round(time.time() - t0, 1), 'scenes': out},
              open(os.path.join(VDIR, 'asr-raw.json' if STAGE == 'raw' else 'asr.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
