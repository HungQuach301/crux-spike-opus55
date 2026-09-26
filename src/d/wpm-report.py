"""Test D: voice wpm report (per act, per sentence) from out/voice/choice-report.json + sentences.json.
Writes out/voice/wpm-report.md. Reasons for sentences outside 150-160 come from the line's direction (the performance
asked for) plus measured facts (words, pause marks, model, takes)."""
import json
cr = json.load(open('out/voice/choice-report.json'))
S = json.load(open('out/voice/sentences.json'))
S = S[list(S)[0]] if isinstance(S, dict) else S
S = {s['id']: s for s in S}
L = ['# Voice wpm report (ElevenLabs Eric, provisional, not decision #158)', '',
     'No time stretching. Act target 150-160 wpm, every sentence 120-190 wpm, aim 156.', '', '## Per act', '',
     '| act | wpm | in 150-160 |', '|---|---|---|']
for a, v in cr['acts'].items():
    L.append(f"| {a} | {v['rawWpm']} | {'yes' if 150 <= v['rawWpm'] <= 160 else 'NO'} |")
L += ['', '## Per sentence', '', '| id | act | words | wpm | model | take | takes tried | missed key words | note |', '|---|---|---|---|---|---|---|---|---|']
out, multi = [], []
for s in cr['sentences']:
    c = s['chosen']; w = c['wpm']; d = S.get(s['id'], {})
    note = ''
    if not 150 <= w <= 160:
        why = []
        if s['words'] <= 4:
            why.append(f"{s['words']}-word line: too short to pace; best-ranked of {s['takes']} takes")
        elif w > 160:
            why.append('direction asks one flowing phrase' if 'flowing' in d.get('direction', '').lower() or 'no pauses' in d.get('direction', '').lower() else 'read faster than aim; nearest-to-156 take within range')
        else:
            why.append('deliberate pause marks (decisive/stress line)' if '...' in d.get('spoken', '') else 'slower delivery per direction')
        note = '; '.join(why) + ' — direction: "' + d.get('direction', '')[:90] + '"'
        out.append(s['id'])
    if c['model'] != 'eleven_v3':
        multi.append(s['id'])
    L.append(f"| {s['id']} | {s['act']} | {s['words']} | {w} | {c['model'].replace('eleven_', '')} | {c['take']} | {s['takes']} | {', '.join(c['missing']) or '-'} | {note} |")
L += ['', f'Outside 150-160: {len(out)} of {len(cr["sentences"])}. Outside 120-190: ' + ', '.join(f"{p['id']} {p['chosen']['wpm']}" for p in cr['problems']),
      '', f'eleven_multilingual_v2 fallback ({len(multi)}): ' + ', '.join(multi),
      '', 'Missed key words: ' + (', '.join(s['id'] for s in cr['sentences'] if s['chosen']['missing']) or 'none')]
open('out/voice/wpm-report.md', 'w').write('\n'.join(L) + '\n')
print(len(out), len(multi), multi)
