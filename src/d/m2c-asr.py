"""Test D M2c: is every spoken number heard in the animatic mix (voice + music + physical sounds)?
faster-whisper small.en int8 (the checks' ASR) on the mixed audio, word timestamps; for each number cue of the
animatic, the words heard within +-1.5 s.   python3 src/d/m2c-asr.py out/m2c/animatic.mp4"""
import json, re, subprocess, sys, tempfile, os
from faster_whisper import WhisperModel
src = sys.argv[1]
data = json.loads(open('render-d/look/data-m2c.js').read().split('= ', 1)[1].rstrip(';\n'))
with tempfile.TemporaryDirectory() as d:
    w = os.path.join(d, 'a.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '16000', w], check=True)
    segs, _ = WhisperModel('small.en', device='cpu', compute_type='int8').transcribe(w, word_timestamps=True, language='en', beam_size=5, condition_on_previous_text=False)
    words = [(float(x.start), x.word.strip()) for s in segs for x in s.words]
out = []
for s in data['sentences']:
    for n in re.findall(r'\$?\d[\d,.]*%?', s['text']):
        n = n.rstrip('.,')
        t = s['start']
        near = ' '.join(wd for ts, wd in words if s['start'] - 0.5 <= ts <= s['end'] + 1.0)  # the sentence window (A14)
        digits = re.sub(r'[^0-9]', '', n)
        heard = digits in re.sub(r'[^0-9]', '', near) or (n.endswith('%') and digits.rstrip('0') in re.sub(r'[^0-9]', '', near))
        out.append({'sentence': s['id'], 'number': n, 't': t, 'heard': heard, 'asr': near})
json.dump(out, open('out/m2c/asr-numbers.json', 'w'), indent=1)
print(json.dumps([o for o in out if not o['heard']]), '| heard', sum(o['heard'] for o in out), 'of', len(out))
