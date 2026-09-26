"""TTS for test C: one clip per scene from out/voice/script.json (spoken text, already normalized
by src/av/normalize.js). The environment proxy injects the OpenAI credential, so no key is read
or sent here. Clips are cached by a hash of (model, voice, instructions, text): re-running only
synthesizes changed scenes. Writes out/voice/<scene>.wav (24 kHz mono) + out/voice/tts-manifest.json.

The voice is provisional (not a casting decision)."""
import hashlib
import json
import os
import sys
import time

import requests

ROOT = os.path.join(os.path.dirname(__file__), '..')
VDIR = os.path.join(ROOT, 'out', 'voice')
URL = 'https://api.openai.com/v1/audio/speech'
MODEL = 'gpt-4o-mini-tts'
VOICE = os.environ.get('TTS_VOICE', 'cedar')
INSTRUCTIONS = (
    'Persona: a calm, precise, warm financial analyst explaining a calculation to one listener. '
    'Accent: General American. Pace: speak noticeably slower than normal conversation, about 140 words per minute, with a short breath after each comma and each number. '
    'Tone: neutral and factual; no excitement, no sales voice, no dramatic pauses. '
    'Read every number clearly and completely, exactly as written.'
)


def key(text):
    return hashlib.sha256(json.dumps([MODEL, VOICE, INSTRUCTIONS, text]).encode()).hexdigest()[:16]


def synth(text, out):
    body = {'model': MODEL, 'voice': VOICE, 'input': text, 'instructions': INSTRUCTIONS, 'response_format': 'wav'}
    for attempt in range(4):
        r = requests.post(URL, json=body, timeout=120)  # no Authorization header: the proxy adds it
        if r.status_code == 200:
            open(out, 'wb').write(r.content)
            return
        print('TTS HTTP', r.status_code, r.text[:300], file=sys.stderr)
        if r.status_code in (401, 403, 404, 400):
            raise SystemExit(f'TTS failed: HTTP {r.status_code}: {r.text[:500]}')
        time.sleep(2 ** (attempt + 1))
    raise SystemExit('TTS failed after retries')


def main():
    script = json.load(open(os.path.join(VDIR, 'script.json')))
    mpath = os.path.join(VDIR, 'tts-manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    calls = 0
    for s in script['scenes']:
        if not s['spoken']:
            manifest.pop(s['id'], None)
            continue
        k = key(s['spoken'])
        wav = os.path.join(VDIR, f"{s['id']}.wav")
        if manifest.get(s['id'], {}).get('key') == k and os.path.exists(wav):
            continue
        t0 = time.time()
        synth(s['spoken'], wav)
        calls += 1
        manifest[s['id']] = {'key': k, 'model': MODEL, 'voice': VOICE, 'chars': len(s['spoken']), 'seconds': round(time.time() - t0, 2)}
        print('tts', s['id'], manifest[s['id']]['seconds'], 's')
    manifest['_settings'] = {'model': MODEL, 'voice': VOICE, 'instructions': INSTRUCTIONS, 'endpoint': URL, 'auth': 'injected by the environment proxy; no key in code or logs'}
    json.dump(manifest, open(mpath, 'w'), indent=1)
    print('tts calls', calls)


if __name__ == '__main__':
    main()
