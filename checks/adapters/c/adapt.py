"""Build a test-D contract root from test C's artifacts, so the locked checks can be run on test C (evidence that the rules bite).

    python3 checks/adapters/c/adapt.py <C repo root> <new contract root>

Only translates what C actually delivered; nothing is invented. Artifacts C never produced (model, data, camera DOF, whoosh stem,
cue sheet, ad breaks, shot list, tension map, thumbnails sidecars, ...) are left absent and the rules that need them report MISSING.
Translations:
  timeline   C scenes -> scenes (act = C chapter), acts = C chapters in order
  script     C scene `display` split into sentences; times from C's aligned display words; `spoken` from out/voice/script.json
  claims     C claims (all derived from the brief's stated inputs: source = "brief inputs", not historical data); C's tick_*/axis_* claims are its axis labels -> role axis
  tokens     C's 9 colour tokens and its series map (render-av/rules.js)
  camera     C's 2-D camera (window.SEG.camera(t) = {x, y, s}) as pos [x, y, 0], horizontal field width = 1920 / s at focus distance 1
  cuts       C scene boundaries (type "move" when C starts the scene with a camera move, else "cut"); tempo map = C's beat grid
  stems      voice.flac, music-ducked.flac (music), sfx.flac, ambience.flac (room)
"""
import json
import math
import os
import re
import subprocess
import sys

C, ROOT = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
J = lambda p: json.load(open(os.path.join(C, p)))


def w(rel, obj):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(obj, open(p, 'w'), indent=1)


def link(rel, src):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if os.path.lexists(p):
        os.unlink(p)
    os.symlink(os.path.join(C, src), p)


tl = J('out/timeline.json')
vs = {s['id']: s for s in J('out/voice/script.json')['scenes']}

acts, scenes = [], []
for s in tl['scenes']:
    if not acts or acts[-1]['id'] != s['chapter']:
        acts.append({'id': s['chapter'], 'start': s['start'], 'end': s['start'] + s['dur']})
    acts[-1]['end'] = s['start'] + s['dur']
    scenes.append({'id': s['id'], 'act': s['chapter'], 'start': s['start'], 'dur': s['dur'], 'layout': s['layout'], 'shot': s['shot'],
                   'panels': s['panels'], 'chart': s['chart'], 'move': s['move']})
w('out/timeline.json', {'fps': 30, 'total': tl['total'], 'acts': acts, 'scenes': scenes})

sents = []
for s in tl['scenes']:
    disp = s.get('display')
    if not disp:
        continue
    parts = [p for p in re.split(r'(?<=[.!?])\s+', disp.strip()) if p]
    dw = s.get('displayWords') or []
    spoken = vs.get(s['id'], {}).get('spoken', '')
    sp_parts = [p for p in re.split(r'(?<=[.!?])\s+', spoken.strip()) if p]
    k = 0
    for i, p in enumerate(parts):
        n = len(p.split())
        ws = dw[k:k + n]
        k += n
        if not ws:
            continue
        sents.append({'id': f"{s['id']}.{i + 1}", 'scene': s['id'], 'text': p, 'spoken': sp_parts[i] if i < len(sp_parts) and len(sp_parts) == len(parts) else p,
                      'start': ws[0]['start'], 'end': ws[-1]['end']})
w('out/script.json', {'sentences': sents})

cl = J('claims.json')['claims']
w('out/claims.json', {'claims': [{'claimId': c['claimId'], 'value': c['value'], 'display': c['display'], 'formula': c['formula'], 'illustrative': bool(c.get('illustrative')),
                                  'source': None if c.get('illustrative') else {'id': 'brief inputs', 'note': 'C: every input stated in its brief'}, 'historical': False,
                                  **({'role': 'axis'} if c['claimId'].startswith(('tick_', 'axis_')) else {}),
                                  'shownIn': c.get('shownIn', []), 'spoken': [{'scene': x['scene'], 'spokenForm': x['spokenForm']} for x in c.get('spoken', [])]} for c in cl]})

TOK = {'bg': '#0E1116', 'surface': '#171B22', 'ink': '#F2F4F7', 'muted': '#9AA4B2', 'accent': '#4C8DFF', 'warn': '#F2B441', 'pos': '#3FBF7F', 'neg': '#E5484D', 'grid': '#2A303B'}
w('design/tokens.json', {'colors': TOK, 'series': {'A': TOK['warn'], 'B': TOK['accent'], 'lt': TOK['pos'], 'st': TOK['neg']},
                         'seriesOf': {'A': TOK['warn'], 'B': TOK['accent'], 'lt': TOK['pos'], 'st': TOK['neg'], 'neg': TOK['neg']}})
w('out/page.json', {'url': 'file://' + os.path.join(C, 'render-av', 'index.html'), 'shim': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'page-shim.js'),
                    'ready': "Promise.all(['400','600','700'].map((w) => document.fonts.load(w + ' 28px Inter')))"})

link('out/video.mp4', 'out/video.mp4')
link('out/captions.srt', 'out/captions.srt')
link('out/package/description.md', 'out/package/description.md')
link('out/render-log.json', 'out/render-log.json')
for name, src in (('voice', 'voice'), ('music', 'music-ducked'), ('sfx', 'sfx'), ('room', 'ambience')):
    link(f'out/audio/stems/{name}.flac', f'out/audio/{src}.flac')

# cuts and beat grid as C declared them
cuts = [{'t': s['start'], 'from': a['id'], 'to': s['id'], 'type': 'move' if s['move'] else 'cut'} for a, s in zip(tl['scenes'], tl['scenes'][1:])]
w('out/transitions.json', {'cuts': cuts})
w('out/tempo-map.json', {'bpm': tl['bpm'], 'beats': [round(i * tl['beat'], 4) for i in range(int(tl['total'] / tl['beat']) + 1)], 'accents': []})

# camera: sample C's own camera function for every frame
js = r"""
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(process.argv[2]);
  const fr = await p.evaluate((n) => { const out = []; for (let f = 0; f < n; f++) { const c = window.SEG.camera(f / 30); out.push([f / 30, c.x, c.y, c.s]); } return out; }, +process.argv[3]);
  console.log(JSON.stringify(fr)); await b.close();
})();
"""
jp = os.path.join(ROOT, '.camera-dump.js')
open(jp, 'w').write(js)
env = dict(os.environ, NODE_PATH=os.path.join(C, 'node_modules'))
out = subprocess.run(['node', jp, 'file://' + os.path.join(C, 'render-av', 'index.html'), str(round(tl['total'] * 30))], capture_output=True, text=True, check=True, env=env).stdout
os.unlink(jp)
fr = json.loads(out)
w('out/camera.json', {'fovAxis': 'horizontal', 'frames': [{'t': t, 'pos': [x, y, 0], 'target': [x, y, 0], 'focusDist': 1.0,
                                                          'fovDeg': math.degrees(2 * math.atan(1920 / s / 2))} for t, x, y, s in fr]})
print('contract root written:', ROOT)
