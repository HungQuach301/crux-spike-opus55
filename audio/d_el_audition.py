"""Test D M1b-1: blind voice audition on ElevenLabs.

4 General American library voices x 2 models (eleven_multilingual_v2, eleven_v3) read 7 script lines. Pace is set only
with voice_settings.speed (no time stretching): each version is first read at a calibration speed, then speed is set per
sentence from the measured pace (character timestamps) towards 155 wpm and the line is read again (at most 2 rounds).
Clips are trimmed to their speech span and joined with pauses <= 0.8 s, loudness-matched to -20 LUFS with a single gain (no limiter; keeps true peak below -1.5 dBTP). Pauses inside a clip longer
than 0.75 s are cut to 0.70 s (silence removed from the middle of the pause; speech is never stretched).

Outputs: out/voice-audition/V1.mp3 ... V8.mp3 (blind), key.json (decoding, not for the report), metrics.json.
The key is injected by the environment proxy (xi-api-key); nothing here reads, sends or prints a key.
Credits: the Character-Cost response header of every call is summed into metrics.json.
"""
import base64
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import time
import warnings

import numpy as np
import requests
from scipy.io import wavfile

warnings.filterwarnings('ignore', category=wavfile.WavFileWarning)
ROOT = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, os.path.join(ROOT, 'checks', 'py'))
sys.dont_write_bytecode = True
from r_audio import key_words, match_keys  # noqa: E402  locked implementation, read-only

ODIR = os.path.join(ROOT, 'out', 'voice-audition')
CACHE = os.path.join(ODIR, 'cache')
URL = 'https://api.elevenlabs.io/v1/text-to-speech/{}/with-timestamps?output_format=mp3_44100_128'
LINES = ['co-same.1', 'co-broke.1', 'co-question.1', 'a1-est.1', 'a1-start.1', 'a1-hook.1', 'a2-climax.1']
VOICES = {  # premade library voices, labels from GET /v1/voices (accent american, middle-aged, calm/informative)
    'Eric': 'cjVigY5qzO86Huf0OWal',     # smooth, trustworthy
    'River': 'SAz9YHcvj6GT2YYXdXww',    # relaxed, neutral, informative
    'Matilda': 'XrExE9yKIg1WjnnlVkGX',  # knowledgeable, professional
    'Bella': 'hpp4J3VqNfWAUOO0d1Us',    # professional, bright, warm
}
MODELS = ['eleven_multilingual_v2', 'eleven_v3']
AIM, LO, HI = 155.0, 150.0, 160.0
GAP, GAP_DECISIVE = 0.40, 0.70  # + 2 x 30 ms trim margins -> every pause <= 0.76 s
SEED = 20260926
cost = {'characters': 0, 'calls': 0}


def tts(voice_id, model, text, speed):
    body = {'text': text, 'model_id': model, 'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75, 'speed': round(speed, 3)}}
    if model == 'eleven_v3':  # v3 accepts stability in {0, 0.5, 1}; no style/boost tuning
        body['voice_settings'] = {'stability': 0.5, 'speed': round(speed, 3)}
    k = hashlib.sha256(json.dumps([voice_id, body]).encode()).hexdigest()[:16]
    p = os.path.join(CACHE, k + '.json')
    if os.path.exists(p):
        return json.load(open(p)), p
    for attempt in range(5):
        try:
            r = requests.post(URL.format(voice_id), json=body, timeout=180)
        except requests.RequestException as e:  # network error: stop and report verbatim
            raise SystemExit(f'ElevenLabs network error: {e}')
        if r.status_code == 200:
            cost['characters'] += int(r.headers.get('character-cost', 0) or 0)
            cost['calls'] += 1
            d = r.json()
            d['_speed'] = speed
            d['_characterCost'] = int(r.headers.get('character-cost', 0) or 0)
            json.dump(d, open(p, 'w'))
            return d, p
        if r.status_code in (401, 403):
            raise SystemExit(f'ElevenLabs HTTP {r.status_code}: {r.text[:500]}')
        if r.status_code == 422 and 'speed' in r.text and 'speed' in body['voice_settings']:
            raise SystemExit(f'ElevenLabs HTTP 422 (speed rejected): {r.text[:500]}')
        print('HTTP', r.status_code, r.text[:300], file=sys.stderr)
        time.sleep(2 ** (attempt + 1))
    raise SystemExit('ElevenLabs failed after retries')


def decode(d):
    with tempfile.TemporaryDirectory() as t:
        a, b = os.path.join(t, 'a.mp3'), os.path.join(t, 'b.wav')
        open(a, 'wb').write(base64.b64decode(d['audio_base64']))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a, '-ac', '1', '-ar', '44100', b], check=True)
        sr, x = wavfile.read(b)
    return sr, x.astype(np.float64) / 32768


def pace(d, spoken):
    """wpm from the character timestamps: spoken words / (end of last non-space char - start of first)."""
    al = d.get('normalized_alignment') or d['alignment']
    ch, st, en = al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']
    idx = [i for i, c in enumerate(ch) if c.strip()]
    span = en[idx[-1]] - st[idx[0]]
    return 60 * len(spoken.split()) / span, span, st[idx[0]], en[idx[-1]]


def speech_span(x, sr, thr=-45.0, win=0.02):
    w = int(win * sr)
    n = len(x) // w
    db = 20 * np.log10(np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-12))
    on = np.where(db > thr)[0]
    return on[0] * win, (on[-1] + 1) * win


def silences(x, sr, thr=-45.0, win=0.02):
    w = int(win * sr)
    n = len(x) // w
    db = 20 * np.log10(np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-12))
    runs, cur = [], 0
    for q in db < thr:
        cur = cur + 1 if q else 0
        if cur == 1:
            runs.append(1)
        elif cur > 1:
            runs[-1] += 1
    return [r * win for r in runs]


def cap_pauses(x, sr, longest=0.75, keep=0.70, thr=-45.0, win=0.01):
    """Cut silent runs longer than `longest` s down to `keep` s (from the middle). Returns (audio, number cut)."""
    w = int(win * sr)
    n = len(x) // w
    db = 20 * np.log10(np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-12))
    quiet = db < thr
    out, i, cut, last = [], 0, 0, 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            if (j - i) * win > longest:
                mid, half = (i + j) // 2, int(keep / win / 2)
                out.append(x[last * w:(mid - half) * w])
                last = mid + half
                cut += 1
            i = j
        else:
            i += 1
    out.append(x[last * w:])
    return np.concatenate(out), cut


def lufs(path):
    o = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    i = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', o)[-1])
    tp = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', o)[-1])
    return i, tp


def main():
    os.makedirs(CACHE, exist_ok=True)
    sents = {s['id']: s for s in json.load(open(os.path.join(ROOT, 'out', 'voice', 'sentences.json')))['sentences']}
    lines = [sents[i] for i in LINES]
    keys = dict(zip(LINES, key_words([{'text': s['text']} for s in lines])))
    from faster_whisper import WhisperModel
    asr = WhisperModel('small.en', device='cpu', compute_type='int8')
    versions = [(v, m) for v in VOICES for m in MODELS]
    rnd = random.Random(SEED)
    order = versions[:]
    rnd.shuffle(order)
    labels = {f'V{i + 1}': vm for i, vm in enumerate(order)}
    metrics, key = {}, {}
    for lab, (vname, model) in labels.items():
        rows, clips = [], []
        for s in lines:
            speed, hist = 1.0, []
            for rnd_i in range(3):  # calibration read + up to 2 speed corrections
                d, cpath = tts(VOICES[vname], model, s['spoken'], speed)
                wpm, span, a0, b0 = pace(d, s['spoken'])
                hist.append({'speed': round(speed, 3), 'wpm': round(wpm, 1)})
                if LO <= wpm <= HI or len(s['spoken'].split()) < 4:
                    break
                speed = max(0.7, min(1.2, speed * AIM / wpm))
                if hist and abs(speed - hist[-1]['speed']) < 0.005:
                    break
            sr, x = decode(d)
            a, b = speech_span(x, sr)
            seg = x[max(0, int((a - 0.03) * sr)): int((b + 0.03) * sr)]
            seg, ncut = cap_pauses(seg, sr)
            # own ASR of the clip: key words (numbers, names, defined terms) as check A14 matches them
            with tempfile.NamedTemporaryFile(suffix='.wav') as tf:
                wavfile.write(tf.name, sr, (np.clip(seg, -1, 1) * 32767).astype(np.int16))
                segs, _ = asr.transcribe(tf.name, word_timestamps=True, language='en', beam_size=5, condition_on_previous_text=False)
                words = [{'w': w.word.strip(), 'start': w.start, 'end': w.end} for g in segs for w in g.words]
            miss = match_keys(keys[s['id']], words)
            rows.append({'line': s['id'], 'words': len(s['spoken'].split()), 'speed': round(speed, 3), 'wpm': round(wpm, 1), 'speechSeconds': round(span, 2),
                         'keyWords': len(keys[s['id']]), 'keyMissing': miss, 'pausesCut': ncut, 'heard': ' '.join(w['w'] for w in words), 'rounds': hist})
            clips.append((seg, s.get('decisive')))
        # join: pauses <= 0.8 s (0.8 after a decisive line), no other gaps
        parts = []
        for k, (seg, dec) in enumerate(clips):
            parts.append(seg)
            if k + 1 < len(clips):
                parts.append(np.zeros(int((GAP_DECISIVE if dec else GAP) * sr)))
        y = np.concatenate(parts)
        with tempfile.TemporaryDirectory() as t:
            raw = os.path.join(t, 'raw.wav')
            wavfile.write(raw, sr, (np.clip(y, -1, 1) * 32767).astype(np.int16))
            l_raw, _ = lufs(raw)
            gain = 10 ** ((-20.0 - l_raw) / 20)
            wavfile.write(raw, sr, (np.clip(y * gain, -1, 1) * 32767).astype(np.int16))
            out = os.path.join(ODIR, f'{lab}.mp3')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-c:a', 'libmp3lame', '-b:a', '160k', out], check=True)
        l_out, tp = lufs(out)
        sil = silences(y * gain, sr)
        w = [r['wpm'] for r in rows if r['words'] >= 4]
        allw = sum(r['words'] for r in rows) / sum(r['speechSeconds'] for r in rows) * 60
        # speed responsiveness: over the correction rounds, relative pace change per relative speed change (1 = pace follows speed)
        resp = [np.log(r['rounds'][-1]['wpm'] / r['rounds'][0]['wpm']) / np.log(r['rounds'][-1]['speed'] / r['rounds'][0]['speed'])
                for r in rows if len(r['rounds']) > 1 and abs(np.log(r['rounds'][-1]['speed'] / r['rounds'][0]['speed'])) > 0.05]
        metrics[lab] = {'speedResponse': round(float(np.median(resp)), 2) if resp else None, 'sentencesInRange150to160': sum(LO <= r['wpm'] <= HI for r in rows if r['words'] >= 4),
                        'overallWpm': round(allw, 1), 'wpmMean': round(float(np.mean(w)), 1), 'wpmStd': round(float(np.std(w)), 1),
                        'wpmMin': min(w), 'wpmMax': max(w), 'keyWords': sum(r['keyWords'] for r in rows), 'keyWordsMissing': sum(len(r['keyMissing']) for r in rows),
                        'lufsRaw': round(l_raw, 1), 'lufsFile': round(l_out, 1), 'truePeakDbfs': round(tp, 1), 'longestSilenceS': round(max(sil) if sil else 0, 2),
                        'durationS': round(len(y) / sr, 1), 'sentences': rows}
        key[lab] = {'voice': vname, 'voiceId': VOICES[vname], 'model': model}
        print(lab, {k: v for k, v in metrics[lab].items() if k != 'sentences'}, flush=True)
    json.dump({'lines': LINES, 'aimWpm': AIM, 'method': __doc__, 'credits': cost, 'versions': metrics}, open(os.path.join(ODIR, 'metrics.json'), 'w'), indent=1)
    json.dump({'seed': SEED, 'key': key}, open(os.path.join(ODIR, 'key.json'), 'w'), indent=1)
    print('credits (Character-Cost sum, new calls only):', cost)


if __name__ == '__main__':
    main()
