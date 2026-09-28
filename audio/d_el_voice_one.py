"""Test D M3 round 3: a new take for ONE sentence whose text changed (V8 Eric, eleven_v3), with the same choice rule as
audio/d_el_voice.py: (a) every key word heard, (b) 120-190 wpm, (c) nearest 156 wpm; up to 4 takes. The timeline is
kept: the clip must fit the sentence's existing slot (start fixed, end <= --max-end), so no other sentence moves.
Key: injected by the environment proxy (xi-api-key); never read, sent or printed here.

  python3 audio/d_el_voice_one.py a2-gains80.1 --max-end 358.46
Updates out/voice/{el-takes,takes,asr-takes,choice-report}.json for that sentence, out/voice/final/<sid>.flac and the
sentence end in out/script.json.
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy.io import wavfile

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(__file__))
import d_el_voice as V  # noqa: E402

ROOT = V.ROOT


def main():
    sid = sys.argv[1]
    max_end = float(sys.argv[sys.argv.index('--max-end') + 1])
    from faster_whisper import WhisperModel
    asr = WhisperModel('small.en', device='cpu', compute_type='int8')
    sents = json.load(open(os.path.join(V.VDIR, 'sentences.json')))['sentences']
    s = next(x for x in sents if x['id'] == sid)
    keys = dict(zip([x['id'] for x in sents], V.key_words([{'text': x['text']} for x in sents])))[sid]
    script = json.load(open(os.path.join(ROOT, 'out', 'script.json')))
    row = next(x for x in script['sentences'] if x['id'] == sid)
    if '--start' in sys.argv:  # the line may lead the cut slightly (J-cut) when the new text is longer
        row['start'] = float(sys.argv[sys.argv.index('--start') + 1])
    slot = max_end - row['start']
    recs_p = os.path.join(V.VDIR, 'el-takes.json')
    recs = json.load(open(recs_p))
    got = []
    for k in range(V.MAX_TAKES):
        name = f'{sid}.r3t{k}.{V.MAIN}'
        path = os.path.join(V.EDIR, name + '.mp3')
        meta = V.synth(s['spoken'], V.MAIN, k, path)
        sr, x = V.decode(path)
        a, b = V.speech_span(x, sr)
        with tempfile.NamedTemporaryFile(suffix='.wav') as tf:
            wavfile.write(tf.name, sr, (np.clip(x[int(a * sr):int(b * sr)], -1, 1) * 32767).astype(np.int16))
            segs, _ = asr.transcribe(tf.name, word_timestamps=True, language='en', beam_size=5, condition_on_previous_text=False)
            words = [{'w': w.word.strip(), 'start': round(float(w.start), 3), 'end': round(float(w.end), 3)} for g in segs for w in g.words]
        n = len([w for w in s['spoken'].replace('...', ' ').split() if any(c.isalnum() for c in w)])
        span = (words[-1]['end'] - words[0]['start']) if words else 0
        r = {'name': name, 'sid': sid, 'model': V.MAIN, 'take': k, 'seed': meta['seed'], 'file': os.path.relpath(path, ROOT), 'speech': [round(float(a), 3), round(float(b), 3)],
             'duration': round(len(x) / sr, 3), 'words': words, 'text': ' '.join(w['w'] for w in words), 'spokenWords': n, 'asrSpan': round(span, 3),
             'wpm': round(60 * n / span, 1) if span > 0 else None, 'missing': V.match_keys(keys, words), 'characterCost': meta['characterCost']}
        r['clip'] = round(float(b - a + 0.06), 3)
        r['fits'] = bool(r['clip'] <= slot)
        recs[name] = r
        got.append(r)
        print(f"take {k}: {r['wpm']} wpm, clip {r['clip']} s (slot {slot:.2f}), missing {r['missing']} | {r['text']}", flush=True)
        if not r['missing'] and V.LO <= r['wpm'] <= V.HI and r['fits'] and abs(r['wpm'] - V.AIM) <= 10:
            break
    json.dump(recs, open(recs_p, 'w'))
    ok = [r for r in got if not r['missing'] and V.LO <= r['wpm'] <= V.HI and r['fits']]
    if not ok:
        raise SystemExit('no take passes (a)+(b) and fits the slot')
    c = min(ok, key=lambda r: abs(r['wpm'] - V.AIM))
    # final clip: speech span +-30 ms, no stretching
    sr, x = V.decode(os.path.join(ROOT, c['file']))
    a, b = c['speech']
    seg = x[max(0, int((a - 0.03) * sr)): int((b + 0.03) * sr)]
    fp = os.path.join(V.FDIR, sid + '.flac')
    with tempfile.TemporaryDirectory() as t:
        w = os.path.join(t, 'a.wav')
        wavfile.write(w, sr, (np.clip(seg, -1, 1) * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, fp], check=True)
    tk = json.load(open(os.path.join(V.VDIR, 'takes.json')))
    for t_ in tk['takes']:
        if t_['id'] == sid:
            t_.update({'raw': c['file'], 'final': os.path.relpath(fp, ROOT), 'model': c['model'], 'take': c['take']})
    json.dump(tk, open(os.path.join(V.VDIR, 'takes.json'), 'w'), indent=1)
    at = json.load(open(os.path.join(V.VDIR, 'asr-takes.json')))
    at[f'{sid}.t0'] = {**c, 'speech': [round(a, 3), round(b, 3)]}
    json.dump(at, open(os.path.join(V.VDIR, 'asr-takes.json'), 'w'))
    rep = json.load(open(os.path.join(V.VDIR, 'choice-report.json')))
    for r_ in rep['sentences']:
        if r_['id'] == sid:
            r_.update({'words': c['spokenWords'], 'takes': len(got), 'problem': '',
                       'chosen': {'take': c['take'], 'model': c['model'], 'wpm': c['wpm'], 'wpmAfter': c['wpm'], 'stretch': 1.0, 'missing': c['missing'], 'heard': c['text'], 'round3': True}})
    json.dump(rep, open(os.path.join(V.VDIR, 'choice-report.json'), 'w'), indent=1)
    dur = len(seg) / sr
    row['text'], row['spoken'], row['end'] = s['text'], s['spoken'], round(row['start'] + dur, 3)
    json.dump(script, open(os.path.join(ROOT, 'out', 'script.json'), 'w'), indent=1)
    print(json.dumps({'chosen': c['name'], 'wpm': c['wpm'], 'clip': round(dur, 3), 'start': row['start'], 'end': row['end'], 'takes': len(got),
                      'characters': V.cost['characters'], 'calls': V.cost['calls']}))


if __name__ == '__main__':
    main()
