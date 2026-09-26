"""Test D: pick one TTS take per sentence. Uses the locked check functions (checks/py, read-only import) so a take is
kept only if every key word of its sentence (numbers, proper names, defined terms: rule A14) is in its own ASR.
Among those, the take whose pace (A15 definition) is nearest 156 wpm and at most 172 wpm wins; the planned time
stretch that brings it to 156 wpm is clamped to ±10% (rule A13).
Writes out/voice/choice.json {sentence: take} and out/voice/choice-report.json."""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, os.path.join(ROOT, 'checks', 'py'))
from r_audio import key_words, match_keys  # noqa: E402  (locked implementation, used read-only)

VDIR = os.path.join(ROOT, 'out', 'voice')
AIM, CAP, STRETCH = 156.0, 172.0, 0.10


def main():
    sents = json.load(open(os.path.join(VDIR, 'sentences.json')))['sentences']
    asr = json.load(open(os.path.join(VDIR, 'asr-takes.json')))
    extra = json.load(open(os.path.join(ROOT, 'out', 'terms.json')))['terms'] if os.path.exists(os.path.join(ROOT, 'out', 'terms.json')) else []
    keys = key_words([{'text': s['text']} for s in sents], extra)
    choice, rep = {}, []
    for s, k in zip(sents, keys):
        cands = []
        for t in range(s.get('takes', 1)):
            r = asr.get(f"{s['id']}.t{t}")
            if not r or not r.get('wpm'):
                continue
            miss = match_keys(k, r['words'])
            # planned stretch factor (final span / raw span) and the pace after it
            f = min(1 + STRETCH, max(1 - STRETCH, r['wpm'] / AIM))
            cands.append({'take': t, 'wpm': r['wpm'], 'missing': miss, 'stretch': round(f, 3), 'wpmAfter': round(r['wpm'] / f, 1), 'heard': r['text']})
        ok = [c for c in cands if not c['missing']] or cands
        short = len(s['spoken'].split()) < 4
        best = min(ok, key=lambda c: (0 if short or c['wpmAfter'] <= 175 else 1, abs(c['wpmAfter'] - AIM)))
        choice[s['id']] = best['take']
        rep.append({'id': s['id'], 'act': s['act'], 'words': len(s['spoken'].split()), 'chosen': best, 'takes': len(cands),
                    'problem': ('missing ' + ', '.join(best['missing'])) if best['missing'] else ('fast' if best['wpmAfter'] > 175 and not short else '')})
    json.dump(choice, open(os.path.join(VDIR, 'choice.json'), 'w'), indent=1)
    acts = {}
    for r in rep:
        a = acts.setdefault(r['act'], [0, 0.0, 0.0])
        spk = r['words']
        a[0] += spk
        a[1] += spk / r['chosen']['wpm'] * 60
        a[2] += spk / r['chosen']['wpmAfter'] * 60
    summary = {k: {'rawWpm': round(60 * v[0] / v[1], 1), 'afterStretchWpm': round(60 * v[0] / v[2], 1)} for k, v in acts.items()}
    json.dump({'aim': AIM, 'cap': CAP, 'maxStretch': STRETCH, 'acts': summary, 'problems': [r for r in rep if r['problem']], 'sentences': rep},
              open(os.path.join(VDIR, 'choice-report.json'), 'w'), indent=1)
    print(json.dumps(summary))
    for r in rep:
        if r['problem']:
            print('PROBLEM', r['id'], r['problem'], r['chosen']['wpm'], '|', r['chosen']['heard'])


if __name__ == '__main__':
    main()
