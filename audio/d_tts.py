"""Test D TTS: one clip per script sentence (out/voice/sentences.json from src/d/prepare.js), with a per-sentence
performance direction appended to the base persona. The environment proxy injects the OpenAI credential: no key is
read or sent here. Clips are cached by hash(model, voice, instructions, text, take). Writes out/voice/raw/<sid>.t<take>.wav
(24 kHz mono) and out/voice/tts-manifest.json. The voice is provisional (not a casting decision, #158).

    python3 audio/d_tts.py            # synthesize missing clips (4 in parallel)
"""
import hashlib
import json
import os
import warnings
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import shutil

import requests

ROOT = os.path.join(os.path.dirname(__file__), '..')
VDIR = os.path.join(ROOT, 'out', 'voice')
RAW = os.path.join(VDIR, 'raw')
URL = 'https://api.openai.com/v1/audio/speech'
MODEL = 'gpt-4o-mini-tts'
VOICE = os.environ.get('TTS_VOICE', 'cedar')
BASE = (
    'Persona: a calm, precise, warm American data analyst narrating a documentary about two retirees. '
    'Accent: General American. Pace: unhurried, about 150 words per minute, the same on short lines and on numbers; '
    'no rushing at the end of a sentence. Read every number completely, exactly as written. '
    'No sales voice, no exaggerated drama. '
)


def instructions(direction):
    return BASE + ('Direction for this line: ' + direction if direction else '')


def direction_for(s, take):
    # takes after the first carry a pace hint when the first take read too fast or too slow
    return s.get('direction', '') + (' ' + s['paceHint'] if take > 0 and s.get('paceHint') else '')


def key(text, direction, take):
    return hashlib.sha256(json.dumps([MODEL, VOICE, instructions(direction), text, take]).encode()).hexdigest()[:16]


def synth(text, direction, out):
    body = {'model': MODEL, 'voice': VOICE, 'input': text, 'instructions': instructions(direction), 'response_format': 'wav'}
    for attempt in range(5):
        try:
            r = requests.post(URL, json=body, timeout=120)  # no Authorization header: the proxy adds it
        except requests.RequestException as e:
            print('TTS error', e, file=sys.stderr)
            time.sleep(2 ** (attempt + 1))
            continue
        if r.status_code == 200:
            open(out, 'wb').write(r.content)
            return
        print('TTS HTTP', r.status_code, r.text[:200], file=sys.stderr)
        if r.status_code in (400, 401, 403, 404):
            raise SystemExit(f'TTS failed: HTTP {r.status_code}')
        time.sleep(2 ** (attempt + 1))
    raise SystemExit('TTS failed after retries')


def main():
    os.makedirs(RAW, exist_ok=True)
    sents = json.load(open(os.path.join(VDIR, 'sentences.json')))['sentences']
    mpath = os.path.join(VDIR, 'tts-manifest.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    todo = []
    by_key = {rec['key']: rec for name, rec in man.items() if not name.startswith('_') and os.path.exists(os.path.join(ROOT, rec['file']))}
    for s in sents:
        for take in range(s.get('takes', 1)):
            k = key(s['spoken'], direction_for(s, take), take)
            wav = os.path.join(RAW, f"{s['id']}.t{take}.wav")
            if man.get(f"{s['id']}.t{take}", {}).get('key') == k and os.path.exists(wav):
                continue
            if k in by_key:  # same text, direction and take under another sentence id: reuse the audio
                shutil.copyfile(os.path.join(ROOT, by_key[k]['file']), wav)
                man[f"{s['id']}.t{take}"] = {**by_key[k], 'file': os.path.relpath(wav, ROOT)}
                continue
            todo.append((s, take, k, wav))

    def run(job):
        s, take, k, wav = job
        t0 = time.time()
        synth(s['spoken'], direction_for(s, take), wav)
        return f"{s['id']}.t{take}", {'key': k, 'take': take, 'chars': len(s['spoken']), 'seconds': round(time.time() - t0, 2), 'file': os.path.relpath(wav, ROOT)}

    with ThreadPoolExecutor(4) as ex:
        for name, rec in ex.map(run, todo):
            man[name] = rec
            print('tts', name, rec['seconds'], 's', flush=True)
    man['_settings'] = {'model': MODEL, 'voice': VOICE, 'base_instructions': BASE, 'endpoint': URL, 'auth': 'injected by the environment proxy; no key in code or logs',
                        'note': 'provisional voice, not a casting decision (#158)'}
    json.dump(man, open(mpath, 'w'), indent=1)
    print('tts calls', len(todo))


if __name__ == '__main__':
    main()
