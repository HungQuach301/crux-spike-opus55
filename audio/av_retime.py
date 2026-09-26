"""Sentence-level pacing for test C's voice, independent of the TTS provider.

The TTS reads short sentences fast (180-300 wpm) and pauses between them, and pace instructions
barely move it. So each clip is cut into sentences (aligned faster-whisper word times from
out/voice/pace-raw.json, snapped to the nearest silence), every sentence faster than TARGET_WPM
is time-stretched to TARGET_WPM (ffmpeg rubberband, pitch and formants preserved; slower
sentences are left alone), and sentences are re-joined with a fixed PAUSE. Writes
out/voice/<scene>.final.wav and out/voice/retime.json."""
import hashlib
import json
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile

ROOT = os.path.join(os.path.dirname(__file__), '..')
VDIR = os.path.join(ROOT, 'out', 'voice')
TARGET_WPM = float(os.environ.get('TARGET_WPM', '165'))
PAUSE = float(os.environ.get('PAUSE', '0.26'))
MIN_TEMPO = 0.75  # never slow a sentence by more than 25% (stretch artefacts)
EDGE = 0.03  # s kept around each sentence


def energy_db(x, sr, win=0.01):
    w = int(win * sr)
    n = len(x) // w
    r = np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-12)
    return 20 * np.log10(r), w


def snap(db, w, sr, t, direction, thr=-42.0, reach=0.15):
    """Move a boundary to the nearest quiet 10 ms window within `reach` s (start: backwards, end: forwards)."""
    i = int(t * sr / w)
    rng = range(i, max(-1, i - int(reach / 0.01)), -1) if direction < 0 else range(i, min(len(db), i + int(reach / 0.01)))
    for k in rng:
        if db[k] < thr:
            return k * w / sr if direction < 0 else (k + 1) * w / sr
    return t


def stretch(y, sr, tempo):
    if abs(tempo - 1) < 0.01:
        return y
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, 'a.wav'), os.path.join(d, 'b.wav')
        wavfile.write(a, sr, (np.clip(y, -1, 1) * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a, '-af', f'rubberband=tempo={tempo:.5f}:pitch=1:formant=preserved:transients=smooth', b], check=True)
        _, z = wavfile.read(b)
        return z.astype(np.float64) / 32768


CH_LO, CH_HI, CH_AIM = 151.0, 159.0, 155.0


def main():
    """Retime every clip; then, per chapter, adjust the stretch target and the pause until the
    chapter reads at 151-159 wpm (words / clip time)."""
    chapter_of = {s['id']: s['chapter'] for s in json.load(open(os.path.join(VDIR, 'script.json')))['scenes']}
    params = {}
    for it in range(5):
        out = run(params)
        stats = {}
        for sc, v in out.items():
            c = chapter_of[sc]
            st = stats.setdefault(c, [0, 0.0])
            st[0] += sum(x['words'] for x in v['sentences']); st[1] += v['seconds']
        done = True
        for c, (words, secs) in stats.items():
            wpm = words / secs * 60
            tgt, pause = params.get(c, (TARGET_WPM, PAUSE))
            if wpm > CH_HI:
                params[c] = (max(140.0, tgt * CH_AIM / wpm), min(0.45, pause + 0.04)); done = False
            elif wpm < CH_LO:
                params[c] = (min(172.0, tgt * CH_AIM / wpm), max(0.12, pause - 0.05)); done = False
        print('round', it + 1, {c: round(w / s * 60, 1) for c, (w, s) in stats.items()})
        if done:
            break
    json.dump(out, open(os.path.join(VDIR, 'retime.json'), 'w'), indent=1)
    stretched = [s for v in out.values() for s in v['sentences'] if s['tempo'] < 1]
    print('retimed', len(out), 'clips;', len(stretched), 'sentences slowed; min tempo', min([s['tempo'] for s in stretched] or [1]), 'chapter params', params)


def run(params):
    chapter_of = {s['id']: s['chapter'] for s in json.load(open(os.path.join(VDIR, 'script.json')))['scenes']}
    pace = json.load(open(os.path.join(VDIR, 'pace-raw.json')))
    by = {}
    for s in pace['sentences']:
        by.setdefault(s['scene'], []).append(s)
    out = {}
    for scene, sents in by.items():
        target, pause = params.get(chapter_of[scene], (TARGET_WPM, PAUSE))
        sr, x = wavfile.read(os.path.join(VDIR, f'{scene}.trim.wav'))
        x = x.astype(np.float64) / 32768
        db, w = energy_db(x, sr)
        parts, info = [], []
        # sentence boundaries: the TTS pauses between sentences, so each boundary is the longest
        # quiet run (>= 80 ms below -42 dB) near whisper's estimate; whisper times are only a hint
        quiet = db < -42.0
        runs, k = [], 0
        while k < len(quiet):
            if quiet[k]:
                j = k
                while j < len(quiet) and quiet[j]:
                    j += 1
                if j - k >= 8:
                    runs.append((k * w / sr, j * w / sr))
                k = j
            else:
                k += 1
        cuts = []
        for i in range(len(sents) - 1):
            h = (sents[i]['end'] + sents[i + 1]['start']) / 2
            cand = [r for r in runs if abs((r[0] + r[1]) / 2 - h) <= 0.9 and (not cuts or r[0] > cuts[-1][1])]
            r = max(cand, key=lambda r: r[1] - r[0]) if cand else (h, h)
            cuts.append(r)
        bounds = []
        for i in range(len(sents)):
            a = 0.0 if i == 0 else max(0.0, cuts[i - 1][1] - EDGE)
            b = len(x) / sr if i == len(sents) - 1 else min(len(x) / sr, cuts[i][0] + EDGE)
            bounds.append([a, b])
        for s, (a, b) in zip(sents, bounds):
            y = x[int(a * sr): int(b * sr)]
            # speech length from the audio itself (whisper boundaries can collapse on short
            # sentences): first to last loud 10 ms window inside the sentence
            seg_db, sw = energy_db(y, sr)
            loud = np.where(seg_db > -42.0)[0]
            speech = max(0.2, (loud[-1] - loud[0] + 1) * sw / sr) if len(loud) else len(y) / sr
            wpm = s['words'] / speech * 60
            tempo = max(MIN_TEMPO, min(1.0, target / wpm))
            z = stretch(y, sr, tempo)
            zdb, zw = energy_db(z, sr)
            zl = np.where(zdb > -42.0)[0]
            zspeech = max(0.2, (zl[-1] - zl[0] + 1) * zw / sr) if len(zl) else len(z) / sr
            start = sum(len(q) for q in parts) / sr + pause * len(parts)
            parts.append(z)
            info.append({'text': s['text'], 'words': s['words'], 'wpmBefore': round(wpm, 1), 'tempo': round(tempo, 4), 'start': round(start, 3), 'seconds': round(len(z) / sr, 3),
                         'speechS': round(zspeech, 3), 'wpmAfter': round(s['words'] / zspeech * 60, 1)})
        gap = np.zeros(int(pause * sr))
        joined = np.concatenate([p for q in [[parts[0]]] + [[gap, p] for p in parts[1:]] for p in q])
        wavfile.write(os.path.join(VDIR, f'{scene}.final.wav'), sr, (np.clip(joined, -1, 1) * 32767).astype(np.int16))
        key = hashlib.sha256(json.dumps([target, pause, info]).encode()).hexdigest()[:16]
        out[scene] = {'key': key, 'targetWpm': round(target, 2), 'pauseS': round(pause, 3), 'sentences': info, 'seconds': round(len(joined) / sr, 3)}
    return out


if __name__ == '__main__':
    main()
