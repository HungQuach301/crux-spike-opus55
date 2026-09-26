"""Test C sound measurements -> out/audio-metrics.json + out/music-ledger.json.

Test B's measures on the same terms (layer levels vs the 0 dB = -16 LUFS reference, SFX
momentary max per type, SFX density, SFX-to-picture sync, music silences), plus:
  - voice level; music-below-voice in voice windows (400 ms blocks where the voice is active)
  - per-chapter voice and music loudness
  - final master loudness and true peak, measured on the encoded file (AAC) with our BS.1770
    meter and ffmpeg ebur128."""
import json
import os
import subprocess
import sys

import numpy as np
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(__file__))
import loudness as LN  # noqa: E402

SR = 48000
ROOT = os.path.join(os.path.dirname(__file__), '..')
A = os.path.join(ROOT, 'out', 'audio')
FF = 'ffmpeg'


def load(name):
    sr, x = wavfile.read(os.path.join(A, name))
    assert sr == SR
    return x.astype(np.float64) / 32768 if x.dtype == np.int16 else x.astype(np.float64)


def rms_db(x, win):
    m = x.mean(axis=1)
    n = len(m) // win
    r = np.sqrt((m[: n * win].reshape(n, win) ** 2).mean(axis=1))
    return 20 * np.log10(np.maximum(r, 1e-12))


def ebur128(path):
    p = subprocess.run([FF, '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    tail = p.stderr[p.stderr.rfind('Summary:'):]
    def grab(key):
        for line in tail.splitlines():
            if line.strip().startswith(key):
                return float(line.split(':')[1].split()[0])
        return None
    return {'integratedLUFS': grab('I:'), 'truePeakDBFS': grab('Peak:'), 'LRA': grab('LRA:')}


def decode(path):
    raw = subprocess.check_output([FF, '-loglevel', 'error', '-i', path, '-vn', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'])
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def block_lufs(x, starts, win):
    y = LN.kweight(x) ** 2
    c = np.cumsum(np.vstack([np.zeros((1, 2)), y]), axis=0)
    ms = ((c[starts + win] - c[starts]) / win).sum(axis=1)
    return ms


def main():
    tl = json.load(open(os.path.join(ROOT, 'out', 'timeline.json')))
    pl = json.load(open(os.path.join(A, 'placement.json')))
    vis = {v['id']: v for v in json.load(open(os.path.join(ROOT, 'out', 'visual-events.json')))}
    ref = pl['refLufs']
    voice, music, music_d, sfx, amb, master = (load(f'{n}.wav') for n in ('voice', 'music', 'music-ducked', 'sfx', 'ambience', 'master'))
    total = tl['total']

    layers = {
        'voice': {'integratedLUFS': round(LN.integrated(voice), 2), 'relToRefDB': round(LN.integrated(voice) - ref, 2), 'target': '0 dB (-16 LUFS)'},
        'music': {'integratedLUFS': round(LN.integrated(music), 2), 'relToRefDB': round(LN.integrated(music) - ref, 2), 'target': '-18 to -22 dB (test B level, before ducking)'},
        'musicDucked': {'integratedLUFS': round(LN.integrated(music_d), 2), 'relToRefDB': round(LN.integrated(music_d) - ref, 2)},
        'ambience': {'integratedLUFS': round(LN.integrated(amb), 2), 'relToRefDB': round(LN.integrated(amb) - ref, 2), 'target': 'about -40 dB'},
    }
    layers['voice']['pass'] = abs(layers['voice']['relToRefDB']) <= 0.5
    layers['music']['pass'] = -22 <= layers['music']['relToRefDB'] <= -18
    layers['ambience']['pass'] = -43 <= layers['ambience']['relToRefDB'] <= -37
    bank = {k: load(os.path.join('sfx-bank', f'{k}.wav')) for k in pl['sfxRel']}
    per_type = {k: round(LN.momentary_max(b) - ref, 2) for k, b in bank.items()}
    layers['sfx'] = {'perTypeMomentaryMaxRelDB': per_type, 'minRelDB': min(per_type.values()), 'maxRelDB': max(per_type.values()), 'target': '-8 to -14 dB',
                     'pass': all(-14 <= v <= -8 for v in per_type.values())}

    # ---- music below voice while the voice is active (400 ms blocks, 100 ms hop)
    win, hop = int(0.4 * SR), int(0.1 * SR)
    starts = np.arange(0, len(voice) - win, hop)
    act = np.load(os.path.join(A, 'voice-activity.npy')).astype(float)  # 10 ms resolution
    act_b = np.array([act[s // 480: (s + win) // 480].mean() if (s + win) // 480 <= len(act) else 0 for s in starts])
    vms, mms = block_lufs(voice, starts, win), block_lufs(music_d, starts, win)
    sel = (act_b >= 0.8) & (mms > 0)
    vL, mL = LN.lufs_from_ms(vms), LN.lufs_from_ms(mms)
    diff_int = float(LN.lufs_from_ms(vms[sel].mean()) - LN.lufs_from_ms(mms[sel].mean()))
    per_block = (vL - mL)[sel]
    duck = {'definition': '400 ms blocks (100 ms hop) where the voice is active in >= 80% of the block and music is not silent; difference of energy-mean loudness voice - music (ducked)',
            'blocks': int(sel.sum()), 'voiceMinusMusicDB': round(diff_int, 2), 'target': '18-22 dB', 'pass': 18 <= diff_int <= 22,
            'perBlock': {'p10': round(float(np.percentile(per_block, 10)), 1), 'median': round(float(np.median(per_block)), 1), 'p90': round(float(np.percentile(per_block, 90)), 1),
                         'shareIn18to22': round(float(((per_block >= 18) & (per_block <= 22)).mean()), 3)},
            'duckDB': pl['duck']['db']}

    # ---- per chapter
    chapters = []
    for ch in dict.fromkeys(s['chapter'] for s in tl['scenes']):
        sc = [s for s in tl['scenes'] if s['chapter'] == ch]
        a, b = int(sc[0]['start'] * SR), int((sc[-1]['start'] + sc[-1]['dur']) * SR)
        inb = (starts >= a) & (starts + win <= b) & sel
        row = {'chapter': ch, 'start': sc[0]['start'], 'end': round(sc[-1]['start'] + sc[-1]['dur'], 3)}
        vseg = voice[a:b]
        vi = LN.integrated(vseg) if np.abs(vseg).max() > 0 else None
        row['voiceLUFS'] = round(vi, 2) if vi is not None and np.isfinite(vi) else None
        row['musicLUFS'] = round(LN.integrated(music_d[a:b]), 2)
        row['masterLUFS'] = round(LN.integrated(master[a:b]), 2)
        row['voiceMinusMusicInVoiceWindowsDB'] = round(float(LN.lufs_from_ms(vms[inb].mean()) - LN.lufs_from_ms(mms[inb].mean())), 2) if inb.any() else None
        chapters.append(row)

    # ---- SFX density (test B definition)
    w50 = int(0.05 * SR)
    amb_db = float(np.median(rms_db(amb, w50)))
    active = rms_db(sfx, w50) > amb_db
    density = float(active.mean())

    # ---- SFX sync vs the rendered visual onset (test B method)
    sm = sfx.mean(axis=1)
    offsets, counts = [], {}
    for p in pl['placed']:
        counts[p['type']] = counts.get(p['type'], 0) + 1
        b = bank[p['type']].mean(axis=1)[: int(0.25 * SR)]
        c0 = int(round(p['t'] * SR))
        lo, hi = max(0, c0 - int(0.15 * SR)), min(len(sm) - len(b), c0 + int(0.15 * SR))
        corr = np.correlate(sm[lo:hi + len(b)], b, mode='valid')
        audio_t = (lo + int(np.argmax(corr))) / SR
        v = vis.get(p['id'])
        vt = v['visualT'] if v else None
        offsets.append({'id': p['id'], 'type': p['type'], 'timelineT': p['t'], 'audioOnsetT': round(audio_t, 4), 'visualT': vt, 'offsetMs': None if vt is None else round((audio_t - vt) * 1000, 1)})
    known = [o for o in offsets if o['offsetMs'] is not None]
    abs_off = [abs(o['offsetMs']) for o in known] or [0]

    # ---- music silences (test B definition)
    mdb = rms_db(music, int(0.01 * SR))
    quiet = mdb < -80
    runs, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) * 0.01 >= 0.25 and i * 0.01 > 0.5 and j * 0.01 < total - 1.6:
                runs.append({'start': round(i * 0.01, 2), 'end': round(j * 0.01, 2), 'durationMs': round((j - i) * 10)})
            i = j
        else:
            i += 1
    for r in runs:
        nxt = [e for e in tl['events'] if e['type'] in ('emphasis', 'threshold-cross', 'reveal') and abs(e['t'] - r['end']) < 0.06]
        r['followedBy'] = nxt[0]['id'] if nxt else None

    # ---- final master, as encoded
    mp4 = os.path.join(ROOT, 'out', 'video.mp4')
    enc = None
    if os.path.exists(mp4):
        x = decode(mp4)
        enc = {'file': 'out/video.mp4', 'ownMeter': {'integratedLUFS': round(LN.integrated(x), 2), 'truePeakDBTP': round(LN.true_peak_db(x), 2)}, 'ffmpegEbur128': ebur128(mp4)}
        I, TP = enc['ownMeter']['integratedLUFS'], enc['ownMeter']['truePeakDBTP']
        enc['pass'] = {'integrated -14 ±1': -15 <= I <= -13, 'truePeak <= -1 dBTP': TP <= -1.0 and (enc['ffmpegEbur128']['truePeakDBFS'] or 0) <= -1.0}

    metrics = {
        'reference': {'narrationRefLUFS': ref, 'note': '0 dB = -16 LUFS integrated = the voice layer. The master is then raised to -14 LUFS.'},
        'master': {'wav': {'integratedLUFS': round(LN.integrated(master), 2), 'truePeakDBTP': round(LN.true_peak_db(master), 2)}, 'encoded': enc, 'settings': pl['master']},
        'layers': layers,
        'musicUnderVoice': duck,
        'chapters': chapters,
        'sfxCountPerType': counts, 'sfxTypesExactly8': sorted(counts) == sorted(pl['sfxRel']), 'sfxEvents': len(pl['placed']), 'sfxEventsPerSecond': round(len(pl['placed']) / total, 3),
        'sfxDensity': {'percent': round(density * 100, 1), 'definition': f'share of 50 ms windows where the SFX layer RMS exceeds the median room-tone RMS ({amb_db:.1f} dBFS)', 'target': '30-40%', 'pass': 0.30 <= density <= 0.40},
        'sync': {'maxAbsOffsetMs': round(max(abs_off), 1), 'meanAbsOffsetMs': round(float(np.mean(abs_off)), 1), 'eventsMeasured': len(known), 'eventsTotal': len(offsets), 'limitMs': 60,
                 'pass': max(abs_off) <= 60 and len(known) == len(offsets), 'unmeasured': [o['id'] for o in offsets if o['offsetMs'] is None], 'events': offsets},
        'silences': {'count': len(runs), 'max': 3, 'events': runs, 'pass': len(runs) <= 3 and all(300 <= r['durationMs'] <= 500 for r in runs)},
        'format': {'sampleRate': SR, 'channels': 2},
    }
    json.dump(metrics, open(os.path.join(ROOT, 'out', 'audio-metrics.json'), 'w'), indent=1)
    gen = 'audio/generate.py'
    ledger = [
        {'assetId': 'voice', 'origin': 'OpenAI gpt-4o-mini-tts (provisional voice)', 'generatorFile': 'audio/av_tts.py', 'settings': 'out/voice/tts-manifest.json', 'usedIn': ['out/audio/voice.wav', 'out/video.mp4']},
        {'assetId': 'music-bed', 'origin': 'generated-in-repo (test B generator, unchanged)', 'generatorFile': gen, 'function': 'make_music', 'seed': pl['seeds']['music'], 'license': 'original work', 'usedIn': ['out/audio/music.wav', 'out/video.mp4']},
        {'assetId': 'ambience-room-tone', 'origin': 'generated-in-repo (test B generator, unchanged)', 'generatorFile': gen, 'function': 'make_ambience', 'seed': pl['seeds']['ambience'], 'license': 'original work', 'usedIn': ['out/audio/ambience.wav', 'out/video.mp4']},
    ] + [{'assetId': f'sfx-{k}', 'origin': 'generated-in-repo (test B generator, unchanged)', 'generatorFile': gen, 'function': 'make_sfx', 'seed': pl['seeds']['sfx'], 'license': 'original work', 'occurrences': counts.get(k, 0)} for k in sorted(pl['sfxRel'])]
    json.dump(ledger, open(os.path.join(ROOT, 'out', 'music-ledger.json'), 'w'), indent=1)
    print(json.dumps({'master': metrics['master'], 'musicUnderVoice': {k: v for k, v in duck.items() if k != 'definition'}, 'density': metrics['sfxDensity']['percent'],
                      'sync': {k: v for k, v in metrics['sync'].items() if k in ('maxAbsOffsetMs', 'meanAbsOffsetMs', 'eventsMeasured', 'eventsTotal', 'unmeasured')},
                      'silences': metrics['silences'], 'counts': counts, 'chapters': chapters, 'layers': {k: v.get('relToRefDB') for k, v in layers.items()}}, indent=1))


if __name__ == '__main__':
    main()
