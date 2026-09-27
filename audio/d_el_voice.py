"""Test D M1b-2: the whole script with the V8 voice (ElevenLabs, Eric, eleven_v3), one clip per sentence.

Per sentence, up to 4 takes (eleven_v3, `seed` = take index). A take is judged on its own faster-whisper ASR:
  (a) every key word heard (the locked A14 functions key_words/match_keys, read-only import),
  (b) pace 120-190 wpm (spoken words / ASR span, the A15 definition),
  (c) nearest 156 wpm.
Takes are generated while no take passes (a)+(b) within +-10 wpm of 156. If 4 eleven_v3 takes still fail, Eric on eleven_multilingual_v2
is tried for that sentence (up to 2 takes) and the sentence is listed. After the per-sentence choice, act means are
pulled into 150-160 wpm by swapping between already generated passing takes (no new audio, no time stretching).

No time stretching anywhere: the final clip is the raw take trimmed to its speech span (A13 stretch = 1).
Key: injected by the environment proxy (xi-api-key); never read, sent or printed here. Credits: Character-Cost header.

Writes out/voice/el/<sid>.t<k>.<model>.mp3 (+ .json alignment), out/voice/final/<sid>.flac, out/voice/el-takes.json,
out/voice/choice-report.json (schema used by src/d/timeline.js, stretch = 1), out/voice/takes.json (contract).
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import warnings
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import requests
from scipy.io import wavfile

warnings.filterwarnings('ignore', category=wavfile.WavFileWarning)
sys.dont_write_bytecode = True
ROOT = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, os.path.join(ROOT, 'checks', 'py'))
from r_audio import key_words, match_keys  # noqa: E402  (locked implementation, read-only)

VDIR = os.path.join(ROOT, 'out', 'voice')
EDIR, FDIR = os.path.join(VDIR, 'el'), os.path.join(VDIR, 'final')
VOICE_ID = 'cjVigY5qzO86Huf0OWal'  # Eric (premade library voice), V8 of the blind audition
MAIN, FALLBACK = 'eleven_v3', 'eleven_multilingual_v2'
URL = 'https://api.elevenlabs.io/v1/text-to-speech/{}/with-timestamps?output_format=mp3_44100_128'
AIM, LO, HI, ACT_LO, ACT_HI = 156.0, 120.0, 190.0, 153.0, 159.0  # act target inside 150-160 with margin: the check (A15) measured act 1 ~9 wpm under this measure in M2
MAX_TAKES, MAX_FALLBACK = 4, 4
cost = {'characters': 0, 'calls': 0}


def synth(text, model, take, path, speed=None):
    if os.path.exists(path) and os.path.exists(path[:-4] + '.json'):
        return json.load(open(path[:-4] + '.json'))
    body = {'text': text, 'model_id': model, 'seed': 1000 + take,
            'voice_settings': {'stability': 0.5, 'speed': 0.9} if model == MAIN else {'stability': 0.5, 'similarity_boost': 0.75, 'speed': round(speed or 0.95, 3)}}
    for attempt in range(6):
        try:
            r = requests.post(URL.format(VOICE_ID), json=body, timeout=180)
        except requests.RequestException as e:
            raise SystemExit(f'ElevenLabs network error: {e}')
        if r.status_code == 200:
            c = int(r.headers.get('character-cost', 0) or 0)
            cost['characters'] += c
            cost['calls'] += 1
            d = r.json()
            open(path, 'wb').write(base64.b64decode(d['audio_base64']))
            meta = {'model': model, 'take': take, 'seed': body['seed'], 'voice_settings': body['voice_settings'], 'characterCost': c,
                    'alignment': d.get('normalized_alignment') or d.get('alignment')}
            json.dump(meta, open(path[:-4] + '.json', 'w'))
            return meta
        if r.status_code in (401, 403):
            raise SystemExit(f'ElevenLabs HTTP {r.status_code}: {r.text[:500]}')
        print('HTTP', r.status_code, r.text[:200], file=sys.stderr, flush=True)
        time.sleep(3 * (attempt + 1))
    raise SystemExit('ElevenLabs failed after retries')


def decode(path):
    with tempfile.TemporaryDirectory() as t:
        b = os.path.join(t, 'b.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', '48000', b], check=True)
        sr, x = wavfile.read(b)
    return sr, x.astype(np.float64) / 32768


def speech_span(x, sr, thr=-45.0, win=0.02):
    w = int(win * sr)
    n = len(x) // w
    db = 20 * np.log10(np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-12))
    on = np.where(db > thr)[0]
    return (on[0] * win, (on[-1] + 1) * win) if len(on) else (0.0, len(x) / sr)


def main():
    from faster_whisper import WhisperModel
    asr = WhisperModel('small.en', device='cpu', compute_type='int8')
    os.makedirs(EDIR, exist_ok=True)
    os.makedirs(FDIR, exist_ok=True)
    sents = json.load(open(os.path.join(VDIR, 'sentences.json')))['sentences']
    keys = dict(zip([s['id'] for s in sents], key_words([{'text': s['text']} for s in sents])))
    rec_p = os.path.join(VDIR, 'el-takes.json')
    recs = json.load(open(rec_p)) if os.path.exists(rec_p) else {}

    def evaluate(s, model, take, speed=None):
        name = f"{s['id']}.t{take}.{model}"
        path = os.path.join(EDIR, name + '.mp3')
        meta = synth(s['spoken'], model, take, path, speed)
        if name in recs and recs[name].get('seed') == meta['seed'] and 'wpm' in recs[name]:
            return recs[name]
        sr, x = decode(path)
        a, b = speech_span(x, sr)
        with tempfile.NamedTemporaryFile(suffix='.wav') as tf:
            wavfile.write(tf.name, sr, (np.clip(x[int(a * sr):int(b * sr)], -1, 1) * 32767).astype(np.int16))
            segs, _ = asr.transcribe(tf.name, word_timestamps=True, language='en', beam_size=5, condition_on_previous_text=False)
            words = [{'w': w.word.strip(), 'start': round(float(w.start), 3), 'end': round(float(w.end), 3)} for g in segs for w in g.words]
        n = len([w for w in s['spoken'].replace('...', ' ').split() if any(c.isalnum() for c in w)])
        span = (words[-1]['end'] - words[0]['start']) if words else 0
        r = {'name': name, 'sid': s['id'], 'model': model, 'take': take, 'seed': meta['seed'], 'file': os.path.relpath(path, ROOT), 'speech': [round(a, 3), round(b, 3)],
             'duration': round(len(x) / sr, 3), 'words': words, 'text': ' '.join(w['w'] for w in words), 'spokenWords': n, 'asrSpan': round(span, 3),
             'wpm': round(60 * n / span, 1) if span > 0 else None, 'missing': match_keys(keys[s['id']], words), 'characterCost': meta['characterCost']}
        recs[name] = r
        return r

    ok = lambda r: not r['missing'] and r['wpm'] is not None and LO <= r['wpm'] <= HI
    # rounds: generate take k for every sentence that has no passing take yet (parallel synthesis, serial ASR)
    for k in range(MAX_TAKES):
        # keep drawing takes while no take is both passing and within +-10 wpm of the aim (max 4 takes)
        good = lambda r: ok(r) and abs(r['wpm'] - AIM) <= 10
        todo = [s for s in sents if not any(good(r) for r in recs.values() if r['sid'] == s['id'] and r['model'] == MAIN)]
        todo = [s for s in todo if not os.path.exists(os.path.join(EDIR, f"{s['id']}.t{k}.{MAIN}.mp3"))] + \
               [s for s in todo if os.path.exists(os.path.join(EDIR, f"{s['id']}.t{k}.{MAIN}.mp3"))]
        if not todo:
            break
        with ThreadPoolExecutor(3) as ex:
            list(ex.map(lambda s: synth(s['spoken'], MAIN, k, os.path.join(EDIR, f"{s['id']}.t{k}.{MAIN}.mp3")), todo))
        for s in todo:
            r = evaluate(s, MAIN, k)
            print(f"round {k} {s['id']}: {r['wpm']} wpm, missing {r['missing']} | {r['text'][:90]}", flush=True)
        json.dump(recs, open(rec_p, 'w'))
    # act means: while an act is outside its range, draw further eleven_v3 takes (up to MAX_TAKES) for the sentences of
    # that act whose best take is on the wrong side of the aim, so the swap below has something to swap to
    def best(sid):
        c = [r for r in recs.values() if r['sid'] == sid and r['model'] == MAIN and not r['missing'] and r['wpm'] and LO <= r['wpm'] <= HI]
        return min(c, key=lambda r: abs(r['wpm'] - AIM)) if c else None
    for k in range(MAX_TAKES):
        acc = {}
        for s in sents:
            r = best(s['id'])
            if r:
                a_ = acc.setdefault(s['act'], [0, 0.0]); a_[0] += r['spokenWords']; a_[1] += r['asrSpan']
        rates = {a_: 60 * n / d for a_, (n, d) in acc.items() if d}
        todo = []
        for s in sents:
            v = rates.get(s['act'])
            if v is None or ACT_LO <= v <= ACT_HI or os.path.exists(os.path.join(EDIR, f"{s['id']}.t{k}.{MAIN}.mp3")):
                continue
            r = best(s['id'])
            if r and ((v < ACT_LO and r['wpm'] < AIM) or (v > ACT_HI and r['wpm'] > AIM)):
                todo.append(s)
        if not todo:
            continue
        with ThreadPoolExecutor(3) as ex:
            list(ex.map(lambda s: synth(s['spoken'], MAIN, k, os.path.join(EDIR, f"{s['id']}.t{k}.{MAIN}.mp3")), todo))
        for s in todo:
            r = evaluate(s, MAIN, k)
            print(f"act round {k} {s['id']}: {r['wpm']} wpm, missing {r['missing']}", flush=True)
        json.dump(recs, open(rec_p, 'w'))
    fallback = []
    for s in sents:
        if any(ok(r) for r in recs.values() if r['sid'] == s['id']):
            continue
        fallback.append(s['id'])
        # eleven_multilingual_v2 follows voice_settings.speed (blind audition: response ~1.0): takes 0-1 at 0.95,
        # then takes 2-3 at a speed scaled from the pace measured so far (0.7-1.2, the API range)
        for k in range(MAX_FALLBACK):
            sp = None
            if k >= 2:
                prev = [r for r in recs.values() if r['sid'] == s['id'] and r['model'] == FALLBACK and r.get('wpm')]
                best = min(prev, key=lambda r: abs(r['wpm'] - AIM))
                sp = min(1.2, max(0.7, best.get('speed', 0.95) * AIM / best['wpm']))
            r = evaluate(s, FALLBACK, k, sp)
            r['speed'] = sp or 0.95
            print(f"fallback {s['id']} t{k} speed {r['speed']:.2f}: {r['wpm']} wpm, missing {r['missing']}", flush=True)
            if ok(r):
                break
    json.dump(recs, open(rec_p, 'w'))

    # choice: (a) key words, (b) 120-190 wpm, (c) nearest 156
    def rank(r):
        return (1 if r['missing'] else 0, 0 if (r['wpm'] and LO <= r['wpm'] <= HI) else 1, abs((r['wpm'] or 0) - AIM))
    cands = {s['id']: sorted([r for r in recs.values() if r['sid'] == s['id']], key=rank) for s in sents}
    choice = {sid: c[0] for sid, c in cands.items()}

    def act_rates():
        acc = {}
        for s in sents:
            r = choice[s['id']]
            a = acc.setdefault(s['act'], [0, 0.0])
            a[0] += r['spokenWords']
            a[1] += r['asrSpan']
        return {k: 60 * n / d for k, (n, d) in acc.items()}
    # pull act means into 150-160 by swapping among passing takes (greedy)
    for _ in range(200):
        rates = act_rates()
        bad = {a: v for a, v in rates.items() if not ACT_LO <= v <= ACT_HI}
        if not bad:
            break
        a, v = next(iter(bad.items()))
        want_slower = v > ACT_HI
        best = None
        for s in sents:
            if s['act'] != a:
                continue
            cur = choice[s['id']]
            for r in cands[s['id']]:
                if r is cur or r['missing'] or not (LO <= r['wpm'] <= HI):
                    continue
                gain = (r['asrSpan'] - cur['asrSpan']) if want_slower else (cur['asrSpan'] - r['asrSpan'])
                if gain > 0 and (best is None or gain > best[0]):
                    best = (gain, s['id'], r)
        if not best:
            break
        choice[best[1]] = best[2]

    # final clips (trim to speech span +30 ms, no stretching) and contract takes.json
    takes, rows = [], []
    for s in sents:
        r = choice[s['id']]
        sr, x = decode(os.path.join(ROOT, r['file']))
        a, b = r['speech']
        seg = x[max(0, int((a - 0.03) * sr)): int((b + 0.03) * sr)]
        fp = os.path.join(FDIR, s['id'] + '.flac')
        with tempfile.TemporaryDirectory() as t:
            w = os.path.join(t, 'a.wav')
            wavfile.write(w, sr, (np.clip(seg, -1, 1) * 32767).astype(np.int16))
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, fp], check=True)
        takes.append({'id': s['id'], 'raw': r['file'], 'final': os.path.relpath(fp, ROOT), 'model': r['model'], 'take': r['take']})
        rows.append({'id': s['id'], 'act': s['act'], 'words': r['spokenWords'], 'chosen': {'take': r['take'], 'model': r['model'], 'wpm': r['wpm'], 'wpmAfter': r['wpm'], 'stretch': 1.0,
                     'missing': r['missing'], 'heard': r['text']}, 'takes': len(cands[s['id']]),
                     'problem': ('missing ' + ', '.join(r['missing'])) if r['missing'] else ('outside 120-190' if not LO <= r['wpm'] <= HI else '')})
    json.dump({'takes': takes, 'voice': {'provider': 'ElevenLabs', 'voiceId': VOICE_ID, 'name': 'Eric', 'model': MAIN, 'fallback': FALLBACK,
                                         'note': 'provisional voice for test D, not decision #158; no time stretching (final = raw trimmed)'}},
              open(os.path.join(VDIR, 'takes.json'), 'w'), indent=1)
    # schema read by src/d/timeline.js and audio/d_tableread.py
    json.dump({n: {**r, 'speech': [round(r['speech'][0], 3), round(r['speech'][1], 3)]} for n, r in
               ((f"{s['id']}.t0", choice[s['id']]) for s in sents)}, open(os.path.join(VDIR, 'asr-takes.json'), 'w'))
    rates = act_rates()
    rep = {'aim': AIM, 'sentenceRange': [LO, HI], 'actRange': [ACT_LO, ACT_HI], 'acts': {k: {'rawWpm': round(v, 1), 'afterStretchWpm': round(v, 1)} for k, v in rates.items()},
           'fallbackSentences': fallback, 'problems': [r for r in rows if r['problem']], 'sentences': rows}
    json.dump(rep, open(os.path.join(VDIR, 'choice-report.json'), 'w'), indent=1)
    json.dump({s['id']: 0 for s in sents}, open(os.path.join(VDIR, 'choice.json'), 'w'))
    spent = sum(r.get('characterCost', 0) for r in recs.values())
    json.dump({'thisRun': cost, 'allTakesCharacterCost': spent, 'takesGenerated': len(recs)}, open(os.path.join(VDIR, 'el-credits.json'), 'w'), indent=1)
    print('acts', {k: round(v, 1) for k, v in rates.items()}, '| fallback', fallback, '| problems', len(rep['problems']), '| credits (all takes)', spent)


if __name__ == '__main__':
    main()
