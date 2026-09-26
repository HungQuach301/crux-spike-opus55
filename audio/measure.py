"""Measures the generated audio against the brief and writes out/audio-metrics.json and
out/music-ledger.json. Sync is measured, not assumed: each SFX onset is located in sfx.wav by
matched filtering against its fixed buffer and compared with the frame where the renderer's
DOM first showed the matching visual event (out/visual-events.json)."""
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


def load(name):
    sr, x = wavfile.read(os.path.join(A, name))
    assert sr == SR
    return x.astype(np.float64) / 32768 if x.dtype == np.int16 else x.astype(np.float64)


def rms_db(x, win):
    m = x.mean(axis=1)
    n = len(m) // win
    r = np.sqrt((m[: n * win].reshape(n, win) ** 2).mean(axis=1))
    return 20 * np.log10(np.maximum(r, 1e-12))


def ffmpeg_ebur128(path):
    ff = subprocess.check_output([sys.executable, '-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())']).decode().strip()
    p = subprocess.run([ff, '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    tail = p.stderr[p.stderr.rfind('Summary:'):]
    def grab(key):
        for line in tail.splitlines():
            if line.strip().startswith(key):
                return float(line.split(':')[1].split()[0])
        return None
    return {'integratedLUFS': grab('I:'), 'truePeakDBFS': grab('Peak:')}


def main():
    tl = json.load(open(os.path.join(ROOT, 'out', 'timeline.json')))
    pl = json.load(open(os.path.join(A, 'placement.json')))
    vis = {v['id']: v for v in json.load(open(os.path.join(ROOT, 'out', 'visual-events.json')))}
    ref = pl['refLufs']
    music, sfx, amb, mix = load('music.wav'), load('sfx.wav'), load('ambience.wav'), load('mix.wav')
    total = tl['total']

    # ---- loudness
    mixI, mixTP = LN.integrated(mix), LN.true_peak_db(mix)
    ff = ffmpeg_ebur128(os.path.join(A, 'mix.wav'))
    music_nz = music[np.abs(music).max(axis=1) > 0]
    layers = {
        'music': {'integratedLUFS': round(LN.integrated(music), 2), 'relToRefDB': round(LN.integrated(music) - ref, 2), 'target': '-18 to -22 dB'},
        'ambience': {'integratedLUFS': round(LN.integrated(amb), 2), 'relToRefDB': round(LN.integrated(amb) - ref, 2), 'target': 'about -40 dB'},
    }
    bank = {k: load(os.path.join('sfx-bank', f'{k}.wav')) for k in pl['sfxRel']}
    per_type = {}
    for k, b in bank.items():
        m = LN.momentary_max(b) - ref
        per_type[k] = round(m, 2)
    sfx_vals = list(per_type.values())
    layers['sfx'] = {'perTypeMomentaryMaxRelDB': per_type, 'minRelDB': round(min(sfx_vals), 2), 'maxRelDB': round(max(sfx_vals), 2), 'target': '-8 to -14 dB',
                     'integratedLUFS_whileActive': None}
    layers['music']['pass'] = -22 <= layers['music']['relToRefDB'] <= -18
    layers['ambience']['pass'] = -43 <= layers['ambience']['relToRefDB'] <= -37
    layers['sfx']['pass'] = all(-14 <= v <= -8 for v in sfx_vals)

    # ---- SFX density: 50 ms windows where the SFX layer is above the room tone
    win = int(0.05 * SR)
    amb_db = float(np.median(rms_db(amb, win)))
    s_db = rms_db(sfx, win)
    active = s_db > amb_db
    density = float(active.mean())
    layers['sfx']['integratedLUFS_whileActive'] = round(LN.integrated(sfx[: len(active) * win].reshape(len(active), win, 2)[active].reshape(-1, 2)), 2)

    # ---- sync: matched filter per event (+-150 ms search) vs the rendered visual onset
    sm = sfx.mean(axis=1)
    offsets = []
    counts = {}
    for p in pl['placed']:
        counts[p['type']] = counts.get(p['type'], 0) + 1
        b = bank[p['type']].mean(axis=1)[: int(0.25 * SR)]
        c0 = int(round(p['t'] * SR))
        lo, hi = max(0, c0 - int(0.15 * SR)), min(len(sm) - len(b), c0 + int(0.15 * SR))
        seg = sm[lo:hi + len(b)]
        corr = np.correlate(seg, b, mode='valid')
        audio_t = (lo + int(np.argmax(corr))) / SR
        v = vis.get(p['id'])
        vt = v['visualT'] if v else None
        offsets.append({'id': p['id'], 'type': p['type'], 'timelineT': p['t'], 'audioOnsetT': round(audio_t, 4), 'visualT': vt,
                        'offsetMs': None if vt is None else round((audio_t - vt) * 1000, 1)})
    known = [o for o in offsets if o['offsetMs'] is not None]
    abs_off = [abs(o['offsetMs']) for o in known]

    # ---- silences: music runs below -80 dBFS for >= 250 ms, inside the programme
    w10 = int(0.01 * SR)
    mdb = rms_db(music, w10)
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
    decisive = []
    for r in runs:
        nxt = [e for e in tl['events'] if e['type'] in ('emphasis', 'threshold-cross', 'reveal') and abs(e['t'] - r['end']) < 0.06]
        decisive.append({**r, 'followedBy': nxt[0]['id'] if nxt else None})

    # ---- music texture per section (shows variation with one tonal identity)
    tex = {}
    for sec in ('setup', 'sweep', 'tension', 'resolution'):
        sc = [s for s in tl['scenes'] if s['section'] == sec]
        a, b = int(sc[0]['start'] * SR), int((sc[-1]['start'] + sc[-1]['dur']) * SR)
        x = music[a:b].mean(axis=1)
        spec = np.abs(np.fft.rfft(x[: min(len(x), SR * 8)]))
        freqs = np.fft.rfftfreq(min(len(x), SR * 8), 1 / SR)
        tex[sec] = {'rmsDBFS': round(float(20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)), 1),
                    'spectralCentroidHz': round(float((spec * freqs).sum() / spec.sum()), 0)}

    metrics = {
        'reference': {'narrationRefLUFS': ref, 'note': '0 dB reference = -16 LUFS integrated, where a narration track would sit. No loudness target is imposed on the mix; values are reported only.'},
        'finalMix': {'integratedLUFS': round(mixI, 2), 'truePeakDBTP': round(mixTP, 2), 'ffmpegEbur128': ff},
        'layers': layers,
        'sfxCountPerType': counts,
        'sfxTypesUsed': sorted(counts), 'sfxTypesExactly8': sorted(counts) == sorted(pl['sfxRel']),
        'sfxDensity': {'percent': round(density * 100, 1), 'definition': f'share of 50 ms windows where the SFX layer RMS exceeds the median room-tone RMS ({amb_db:.1f} dBFS)', 'target': '30-40%', 'pass': 0.30 <= density <= 0.40},
        'sync': {'maxAbsOffsetMs': round(max(abs_off), 1), 'meanAbsOffsetMs': round(float(np.mean(abs_off)), 1), 'meanSignedOffsetMs': round(float(np.mean([o['offsetMs'] for o in known])), 1),
                 'eventsMeasured': len(known), 'eventsTotal': len(offsets), 'limitMs': 60, 'pass': max(abs_off) <= 60 and len(known) == len(offsets),
                 'method': 'audio onset: argmax of cross-correlation between sfx.wav and the fixed buffer of that type within +-150 ms; visual onset: first rendered frame whose DOM shows the event (data-ev probe with opacity > 0.02).',
                 'events': offsets},
        'silences': {'count': len(decisive), 'max': 3, 'events': decisive, 'pass': 1 <= len(decisive) <= 3 and all(300 <= d['durationMs'] <= 500 for d in decisive)},
        'music': {'bpm': tl['bpm'], 'beatSeconds': tl['beat'], 'phraseBeatsPerScene': [s['beats'] for s in tl['scenes']], 'textureBySection': tex,
                  'note': 'Tempo and phrase lengths derive from the scene timeline: every scene is a whole number of beats, chords change on cuts.'},
        'format': {'sampleRate': SR, 'channels': 2},
    }
    json.dump(metrics, open(os.path.join(ROOT, 'out', 'audio-metrics.json'), 'w'), indent=1)

    gen = 'audio/generate.py'
    ledger = [
        {'assetId': 'music-bed', 'origin': 'generated-in-repo', 'generatorFile': gen, 'function': 'make_music', 'seed': pl['seeds']['music'], 'license': 'original work', 'usedIn': ['out/audio/music.wav', 'out/segment.mp4']},
        {'assetId': 'ambience-room-tone', 'origin': 'generated-in-repo', 'generatorFile': gen, 'function': 'make_ambience', 'seed': pl['seeds']['ambience'], 'license': 'original work', 'usedIn': ['out/audio/ambience.wav', 'out/segment.mp4']},
    ]
    for k in sorted(pl['sfxRel']):
        ledger.append({'assetId': f'sfx-{k}', 'origin': 'generated-in-repo', 'generatorFile': gen, 'function': 'make_sfx', 'seed': pl['seeds']['sfx'], 'license': 'original work',
                       'usedIn': ['out/audio/sfx.wav', 'out/segment.mp4'], 'occurrences': counts.get(k, 0)})
    json.dump(ledger, open(os.path.join(ROOT, 'out', 'music-ledger.json'), 'w'), indent=1)
    print(json.dumps({k: metrics[k] for k in ('finalMix', 'sfxCountPerType', 'sfxDensity', 'silences')}, indent=1)[:2500])
    print('layers', json.dumps({k: {kk: vv for kk, vv in v.items() if kk != 'perTypeMomentaryMaxRelDB'} for k, v in layers.items()}))
    print('sync', {k: v for k, v in metrics['sync'].items() if k not in ('events', 'method')})
    print('texture', tex)


if __name__ == '__main__':
    main()
