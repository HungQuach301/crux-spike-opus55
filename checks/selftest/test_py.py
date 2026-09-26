"""Self-test of every Python rule: for each rule a small fixture it MUST fail and one it MUST pass.

    python3 checks/selftest/test_py.py [--only F01,A07] [--keep]

Fixtures are synthetic (ffmpeg lavfi / numpy). Rules that listen to speech get a fixed transcript through the ASR cache
(out/checks/cache/asr-<video sha>.json): the rule logic is under test, not the speech recogniser. Frame rules are tested end-to-end in test_page.js;
here their Python verdicts are fed a page.json directly."""
import csv
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'py'))
import common  # noqa: E402
import run as runner  # noqa: E402,F401  (registers every rule)

SR = 48000
RULES = {fn.rid: fn for fn in common.RULES}


class F:
    def __init__(self, name):
        self.root = tempfile.mkdtemp(prefix=f'kpy-{name}-')

    def p(self, rel):
        p = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        return p

    def json(self, rel, obj):
        json.dump(obj, open(self.p(rel), 'w'))

    def text(self, rel, s):
        open(self.p(rel), 'w').write(s)

    def wav(self, rel, x, sr=SR):
        sf.write(self.p(rel), np.asarray(x, np.float32), sr, subtype='FLOAT')

    def ff(self, *args):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)

    def video(self, rel='out/video.mp4', size='320x180', rate=30, dur=1.0, src='testsrc2', vargs=None, audio=None, aargs=None, tags=True, extra_in=None):
        """lavfi video (+ optional numpy stereo audio muxed as AAC 320k 48k)."""
        args = ['-f', 'lavfi', '-i', f'{src}=size={size}:rate={rate}:duration={dur}']
        if audio is not None:
            ap = self.p('tmp/audio.wav')
            sf.write(ap, audio, SR, subtype='FLOAT')
            args += ['-i', ap]
        args += ['-map', '0:v']
        if audio is not None:
            args += ['-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2'] + (aargs or [])
        v = vargs if vargs is not None else ['-c:v', 'libx264', '-preset', 'ultrafast', '-profile:v', 'high', '-pix_fmt', 'yuv420p']
        if tags:
            v = v + ['-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']
        self.ff(*args, *v, '-shortest', self.p(rel))

    def raw_video(self, frames, rel='out/video.mp4', fps=30, crf='12', gray=True):
        """frames: iterable of uint8 arrays (h, w) luma or (h, w, 3) rgb."""
        frames = list(frames)
        h, w = frames[0].shape[:2]
        pix = 'gray' if frames[0].ndim == 2 else 'rgb24'
        p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', pix, '-s', f'{w}x{h}', '-r', str(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast',
                              '-crf', crf, '-pix_fmt', 'yuv420p', self.p(rel)], stdin=subprocess.PIPE)
        for fr in frames:
            p.stdin.write(np.ascontiguousarray(fr, np.uint8).tobytes())
        p.stdin.close()
        p.wait()

    def asr(self, words):
        h = common.sha256_file(self.p('out/video.mp4'))[:16]
        self.json(f'out/checks/cache/asr-{h}.json', words)

    def run(self, rid):
        return common.safe(RULES[rid], common.Ctx(self.root))

    def close(self):
        shutil.rmtree(self.root, ignore_errors=True)


# ---- signal helpers --------------------------------------------------------------------------------
rng = np.random.default_rng(7)


def noise(sec, lo=100, hi=6000):
    x = rng.standard_normal(int(sec * SR))
    sos = signal.butter(4, [lo, hi], btype='bandpass', fs=SR, output='sos')
    y = signal.sosfilt(sos, x)
    return y / np.sqrt(np.mean(y ** 2))


def db(x):
    return 10 ** (x / 20)


def programme(sec=40, block=2.0, levels=(-20, -28), corr=0.9):
    """Stereo programme of alternating loud/quiet blocks; channels share most of the signal (phase correlation ≈ corr)."""
    base = noise(sec)
    side = noise(sec)
    k = int(block * SR)
    env = np.concatenate([np.full(k, db(levels[(i // k) % len(levels)])) for i in range(0, len(base), k)])[: len(base)]
    a = np.sqrt((1 + corr) / 2)
    b = np.sqrt((1 - corr) / 2)
    L = (a * base + b * side) * env
    R = (a * base - b * side) * env
    return np.stack([L, R], 1)


def tone_bursts(sec, times, dur=0.08, freq=880, level=-12):
    x = np.zeros(int(sec * SR))
    t = np.arange(int(dur * SR)) / SR
    burst = np.sin(2 * np.pi * freq * t) * np.exp(-t * 30) * db(level)
    for s in times:
        i = int(s * SR)
        x[i:i + len(burst)] += burst[: len(x) - i]
    return x


def to_lufs(F, x, target):
    """Scale a stereo signal to an integrated loudness target (two passes through ffmpeg's ebur128)."""
    for _ in range(2):
        p = F.p('tmp/l.wav')
        sf.write(p, x, SR, subtype='FLOAT')
        I = common.ebur128(p)['I']
        x = x * db(target - I)
    return x


# ---- fixtures ----------------------------------------------------------------------------------------
T = {}


def case(rid):
    def deco(fn):
        T[rid] = fn
        return fn
    return deco


V_HIGH = ['-c:v', 'libx264', '-preset', 'ultrafast', '-profile:v', 'high', '-pix_fmt', 'yuv420p']


@case('F01')
def _(f, bad):
    f.video(size='1920x1080', vargs=['-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main' if bad else 'high', '-pix_fmt', 'yuv420p'])


@case('F02')
def _(f, bad):
    f.video(rate=25 if bad else 30)


@case('F03')
def _(f, bad):
    v = V_HIGH + (['-fps_mode', 'passthrough'] if bad else [])
    if bad:
        f.ff('-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=1', '-vf', "select='not(eq(n\\,10))'", *v, '-video_track_timescale', '15360', f.p('out/video.mp4'))
    else:
        f.video()


@case('F04')
def _(f, bad):
    br = '2M' if bad else '20M'
    f.video(size='1920x1080', dur=2, src='testsrc2', tags=False, vargs=['-c:v', 'libx264', '-preset', 'ultrafast', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', br,
                                                                        '-minrate', br, '-maxrate', br, '-bufsize', br, '-x264-params', 'nal-hrd=cbr'])


@case('F05')
def _(f, bad):
    f.video(tags=not bad)


@case('F06')
def _(f, bad):
    x = rng.uniform(-0.3, 0.3, (6 * SR, 2))
    f.video(dur=6, audio=x, aargs=['-ar', '44100'] if bad else None)


@case('F07')
def _(f, bad):
    f.video(size='64x36', dur=5 if bad else 600, src='color')


def gradient_frames(bad, n=4):
    h, w = 1080, 1920
    ramp = np.linspace(20, 44, w)[None, :].repeat(h, 0)
    out = []
    for k in range(n):
        if bad:
            y = np.round(ramp)
        else:
            y = np.round(ramp + rng.uniform(-1.5, 1.5, (h, w)))  # grain / dither breaks the bands
        out.append(np.clip(y, 0, 255).astype(np.uint8))
    return out


@case('F08')
def _(f, bad):
    # rgb grey ramp encoded to limited-range luma: 20–44 full-range ≈ 33–54 in Y codes, a dark gradient
    fr = [np.repeat(g[:, :, None], 3, 2) for g in gradient_frames(bad, 90)]
    f.raw_video(fr, crf='4')


SCRIPT = [{'id': 's1', 'scene': 'a', 'text': 'Two retirees start in 1966.', 'start': 0.5, 'end': 2.5},
          {'id': 's2', 'scene': 'a', 'text': 'Same average, different fate.', 'start': 3.0, 'end': 5.0}]


@case('F09')
def _(f, bad):
    f.json('out/script.json', {'sentences': SCRIPT})
    if bad:
        f.text('out/captions.srt', '1\n00:00:00,500 --> 00:00:02,500\nTwo retirees start in 1966 and this line is far too long\n\n2\n00:00:03,000 --> 00:00:03,400\nSame average, different fate.\n')
    else:
        f.text('out/captions.srt', '1\n00:00:00,500 --> 00:00:02,500\nTwo retirees start in 1966.\n\n2\n00:00:03,000 --> 00:00:05,000\nSame average, different fate.\n')


@case('F10')
def _(f, bad):
    f.video(size='64x36', dur=40, src='color')
    f.text('out/package/description.md', ('0:05' if bad else '0:00') + ' Cold open\n0:12 Two retirees\n0:25 Every start year\n')


# master audio rules -------------------------------------------------------------------------------------
def master_fixture(f, x):
    f.video(size='64x36', dur=len(x) / SR, src='color', audio=x)


@case('A01')
def _(f, bad):
    x = to_lufs(f, programme(30), -20 if bad else -14)
    master_fixture(f, np.clip(x, -0.85, 0.85))


@case('A02')
def _(f, bad):
    x = to_lufs(f, programme(30), -16)
    if bad:
        x[SR * 10:SR * 10 + 400] = 0.99 * np.sin(np.linspace(0, 40 * np.pi, 400))[:, None]
    master_fixture(f, np.clip(x, -0.99, 0.99))


@case('A03')
def _(f, bad):
    x = to_lufs(f, programme(60, block=6.0, levels=(-20, -20) if bad else (-18, -26)), -16)
    master_fixture(f, x)


@case('A04')
def _(f, bad):
    x = to_lufs(f, programme(20), -14)
    if bad:
        x = np.clip(x * 4, -1.0, 1.0)
    master_fixture(f, np.clip(x, -1, 1) if bad else np.clip(x, -0.8, 0.8))


@case('A05')
def _(f, bad):
    x = programme(20, corr=-0.6 if bad else 0.8) * 0.1
    master_fixture(f, x)


@case('A06')
def _(f, bad):
    x = programme(20, corr=0.95) * 0.1
    if bad:
        x[:, 1] = -x[:, 1]
    master_fixture(f, x)


# stems -----------------------------------------------------------------------------------------------
def voice_like(sec, spans, level=-20):
    x = np.zeros(int(sec * SR))
    for a, b in spans:
        i, j = int(a * SR), int(b * SR)
        x[i:j] = noise((j - i + 1) / SR, 200, 4000)[: j - i] * db(level)
    return x


VSPANS = [(2, 5), (7, 10), (12, 15), (17, 20)]


@case('A07')
def _(f, bad):
    v = voice_like(22, VSPANS)
    m = noise(22) * db(-26 if bad else -40)
    f.wav('out/audio/stems/voice.wav', np.stack([v, v], 1))
    f.wav('out/audio/stems/music.wav', np.stack([m, m], 1))


@case('A08')
def _(f, bad):
    v = voice_like(22, VSPANS)
    m = noise(22, 40, 12000) * db(-30)
    act = np.zeros(len(m))
    for a, b in VSPANS:
        act[int(a * SR):int(b * SR)] = 1
    if bad:
        m = m * np.where(act > 0, db(-10), 1.0)  # broadband duck: no band-limited dip
    else:
        sos = signal.butter(4, [1000, 4000], btype='bandpass', fs=SR, output='sos')
        band = signal.sosfiltfilt(sos, m)  # zero-phase, so subtracting it carves the band
        m = m - band * act * (1 - db(-12))  # carve 1–4 kHz by ≈ 12 dB while voice is on
    f.wav('out/audio/stems/voice.wav', np.stack([v, v], 1))
    f.wav('out/audio/stems/music.wav', np.stack([m, m], 1))


@case('A09')
def _(f, bad):
    x = programme(20, levels=(-20,)) * 1.0
    for s in (5, 10, 15):
        x[int(s * SR):int((s + (0.3 if bad else 1.0)) * SR)] = 0
    master_fixture(f, x * 0.5)


def cam_frames(dur, moves, fps=30):
    """moves: (t0, t1, dx) smoothstep lateral moves; returns camera.json frames (fovAxis horizontal, width 1 unit at focus 1)."""
    fr = []
    x = 0.0
    for k in range(int(dur * fps)):
        t = k / fps
        x = 0.0
        for t0, t1, dx in moves:
            u = min(1, max(0, (t - t0) / (t1 - t0)))
            x += dx * u * u * (3 - 2 * u)
        fr.append({'t': t, 'pos': [x, 0, 0], 'target': [x, 0, 0], 'focusDist': 1.0, 'fovDeg': 2 * np.degrees(np.arctan(0.5))})
    return fr


MOVES = [(1, 2, 0.3), (4, 5, 1.2), (7, 8, 0.6), (10, 11, 2.0), (13, 14, 0.9), (16, 17, 1.6)]


@case('A10')
def _(f, bad):
    f.json('out/camera.json', {'fovAxis': 'horizontal', 'frames': cam_frames(19, MOVES)})
    wh = np.zeros(19 * SR)
    for t0, t1, dx in MOVES:
        lvl = -40 + 10 * dx if not bad else -10 - 10 * dx
        seg = noise(t1 - t0 + 0.2, 300, 8000) * db(lvl) * np.hanning(int((t1 - t0 + 0.2) * SR))
        i = int((t0 - 0.1) * SR)
        wh[i:i + len(seg)] += seg
    f.wav('out/audio/stems/whoosh.wav', np.stack([wh, wh], 1))


@case('A11')
def _(f, bad):
    ev, L, R = [], np.zeros(12 * SR), np.zeros(12 * SR)
    for k, x in enumerate([100, 400, 700, 960, 1200, 1500, 1800, 300, 1650, 900]):
        t = 0.5 + k
        pan = (x - 960) / 960 * (-1 if bad else 1)
        b = tone_bursts(12, [t])
        L += b * np.sqrt((1 - pan) / 2)
        R += b * np.sqrt((1 + pan) / 2)
        ev.append({'t': t, 'x': x})
    f.json('out/sfx-events.json', {'events': ev})
    f.wav('out/audio/stems/sfx.wav', np.stack([L, R], 1))


@case('A12')
def _(f, bad):
    beats = [0.5 + 0.5 * k for k in range(36)]
    acc = [2.5, 5.0, 7.5, 10.0, 12.5, 15.0]
    cuts = [a + (0.2 if bad else 0.0) for a in acc]
    m = tone_bursts(19, beats, freq=220, level=-20) + tone_bursts(19, acc, freq=110, level=-8) + noise(19) * db(-60)
    f.wav('out/audio/stems/music.wav', np.stack([m, m], 1))
    f.json('out/tempo-map.json', {'bpm': 120, 'beats': beats, 'accents': acc})
    f.json('out/transitions.json', {'cuts': [{'t': c} for c in cuts]})


@case('A13')
def _(f, bad):
    raw = voice_like(3.2, [(0.1, 3.1)])
    st = 1.2 if bad else 1.05
    fin = voice_like(3.2 * st, [(0.1, 0.1 + 3.0 * st)])
    f.wav('out/voice/s1.raw.wav', raw)
    f.wav('out/voice/s1.final.wav', fin)
    f.json('out/voice/takes.json', {'takes': [{'id': 's1', 'raw': 'out/voice/s1.raw.wav', 'final': 'out/voice/s1.final.wav'}]})


def asr_words(text, start, rate_wpm=155):
    ws, t = [], start
    d = 60 / rate_wpm
    for w in text.split():
        ws.append({'w': w, 'start': round(t, 3), 'end': round(t + d * 0.9, 3)})
        t += d
    return ws


KEY_SENT = [{'id': 's1', 'scene': 'a', 'text': 'Damodaran data starts in 1928.', 'spoken': 'Damodaran data starts in nineteen twenty-eight.', 'start': 1.0, 'end': 3.0},
            {'id': 's2', 'scene': 'a', 'text': 'The real balance falls by $120,000.', 'spoken': 'The real balance falls by one hundred twenty thousand dollars.', 'start': 4.0, 'end': 6.5}]


@case('A14')
def _(f, bad):
    f.video(size='64x36', dur=8, src='color')
    f.json('out/script.json', {'sentences': KEY_SENT})
    f.json('out/timeline.json', {'total': 8, 'scenes': [{'id': 'a', 'act': 'act1', 'start': 0, 'dur': 8}]})
    heard2 = 'The real balance falls by $12,000.' if bad else 'The real balance falls by $120,000.'
    f.asr(asr_words('Damodaran data starts in 1928.', 1.0) + asr_words(heard2, 4.0))


@case('A15')
def _(f, bad):
    f.video(size='64x36', dur=30, src='color')
    txt = 'We ran each thirty year window through the same simple withdrawal rule and kept every result on screen'
    sents = []
    words = []
    t = 0.5
    for k in range(6):
        ws = asr_words(txt, t, rate_wpm=190 if bad else 155)
        words += ws
        sents.append({'id': f's{k}', 'scene': 'a', 'text': txt + '.', 'start': ws[0]['start'], 'end': ws[-1]['end']})
        t = ws[-1]['end'] + 0.6
    f.json('out/script.json', {'sentences': sents})
    f.json('out/timeline.json', {'total': 30, 'scenes': [{'id': 'a', 'act': 'act1', 'start': 0, 'dur': 30}]})
    f.asr(words)


# ---- model and data ---------------------------------------------------------------------------------
YEARS = list(range(1928, 2026))


def data_fixture(f):
    r = np.random.default_rng(1)
    rows = [{'year': y, 'stocks': round(float(r.normal(0.1, 0.18)), 6), 'bonds': round(float(r.normal(0.05, 0.07)), 6), 'inflation': round(float(r.normal(0.03, 0.025)), 6)} for y in YEARS]
    with open(f.p('data/normalized/annual.csv'), 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=['year', 'stocks', 'bonds', 'inflation'])
        w.writeheader()
        w.writerows(rows)
    return {x['year']: x for x in rows}


def model_path(seq, init=1_000_000.0):
    """Independent re-implementation for the fixture (not the rule's code)."""
    bal, w, out_w, out_n, out_r, idx = init, 0.04 * init, [], [], [], 1.0
    dep = None
    for k, (s, b, i) in enumerate(seq):
        if k:
            w = w * (1 + seq[k - 1][2])
        if bal < w and dep is None:
            dep = k + 1
        take = w if bal >= w else bal
        bal = (bal - take) * (1 + 0.6 * s + 0.4 * b)
        idx = idx * (1 + i)
        out_w.append(take)
        out_n.append(bal)
        out_r.append(bal / idx)
    return {'withdrawals': out_w, 'endNominal': out_n, 'endReal': out_r, 'depletedYear': dep}


@case('S01')
def _(f, bad):
    d = data_fixture(f)
    tup = lambda y: (d[y]['stocks'], d[y]['bonds'], d[y]['inflation'])
    base = [tup(y) for y in range(1966, 1996)]
    starts = {str(y): model_path([tup(k) for k in range(y, y + 30)]) for y in range(1928, 1997)}
    p66 = model_path(base)
    mir = model_path(base[::-1])
    if bad:
        p66['endNominal'][12] *= 1.01
    f.json('out/model.json', {'initial': 1_000_000, 'rate': 0.04, 'years': 30, 'weights': {'stocks': 0.6, 'bonds': 0.4}, 'tax': 0, 'fees': 0,
                              'paths': {'1966': p66, 'mirror': {**mir, 'reverse': ['returns', 'inflation']}}, 'starts': starts})


def timeline_acts(f, total=100):
    acts = [{'id': 'method', 'start': 50, 'end': 100}, {'id': 'act1', 'start': 0, 'end': 50}]
    f.json('out/timeline.json', {'total': total, 'acts': acts, 'scenes': [{'id': 'a', 'act': 'act1', 'start': 0, 'dur': 50}, {'id': 'm', 'act': 'method', 'start': 50, 'dur': 50}]})


@case('S02')
def _(f, bad):
    timeline_acts(f)
    tt = [{'t': 60, 'scene': 'm', 'items': [{'text': 'No taxes. No fees.'}]}]
    if not bad:
        tt.append({'t': 10, 'scene': 'a', 'items': [{'text': 'Model: no taxes, no fees'}]})
    f.json('out/checks/page.json', {'rules': {}, 'textTrack': tt})


@case('S03')
def _(f, bad):
    f.text('data/raw/histretSP.html', 'damodaran data')
    f.text('data/raw/CPIAUCNS.csv', 'fred data')
    sha = lambda p: common.sha256_file(f.p(p))
    q = {'quote': 'This data may be used freely with attribution to the source page.', 'url': 'https://example.org/terms'}
    f.json('data/sources.json', {'files': [
        {'path': 'data/raw/histretSP.html', 'role': 'primary', 'url': 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html', 'sha256': sha('data/raw/histretSP.html'), 'downloaded': '2026-09-26', 'terms': q},
        {'path': 'data/raw/CPIAUCNS.csv', 'role': 'crosscheck', 'url': 'https://fred.stlouisfed.org/series/CPIAUCNS', 'sha256': '0' * 64 if bad else sha('data/raw/CPIAUCNS.csv'), 'downloaded': '2026-09-26', 'terms': q}]})


@case('S04')
def _(f, bad):
    d = data_fixture(f)
    with open(f.p('data/normalized/fred_inflation.csv'), 'w') as fh:
        fh.write('year,inflation\n')
        for y in YEARS:
            v = d[y]['inflation'] + (0.012 if bad and y == 1974 else 0.001)
            fh.write(f'{y},{v}\n')
    f.json('data/sources.json', {'files': [], 'tolerance': {'inflation_pp': 0.3, 'stocks_pp': 0.3}, 'mismatches': []})


@case('S05')
def _(f, bad):
    d = data_fixture(f)
    seq = [(d[y]['stocks'], d[y]['bonds']) for y in range(1966, 1996)]
    g = (np.prod([1 + 0.6 * s + 0.4 * b for s, b in seq]) ** (1 / 30) - 1) * 100
    f.json('out/claims.json', {'claims': [{'claimId': 'g66', 'kind': 'geomean', 'character': '1966', 'value': round(g, 4), 'display': f'{g:.2f}%'},
                                          {'claimId': 'gm', 'kind': 'geomean', 'character': 'mirror', 'value': round(g, 4), 'display': f'{g:.2f}%', 'illustrative': not bad}]})


@case('S06')
def _(f, bad):
    timeline_acts(f)
    f.json('out/timeline.json', {'total': 100, 'acts': [{'id': 'act3', 'start': 0, 'end': 100}], 'scenes': [{'id': 'm3', 'act': 'act3', 'start': 0, 'dur': 100}]})
    years = [y for y in range(1928, 1997) if not (bad and y == 1975)]
    f.json('out/checks/page.json', {'rules': {}, 'yearsTrack': [{'t': 5, 'scene': 'm3', 'years': years}]})


BASE_CLAIMS = [{'claimId': 'y66', 'value': 1966, 'display': '1966', 'formula': 'first year', 'source': {'id': 'damodaran'}, 'dataYear': 1966, 'shownIn': ['a']},
               {'claimId': 'bal', 'value': 120000, 'display': '$120,000', 'formula': 'end balance 1966 path', 'source': {'id': 'damodaran'}, 'dataYear': '1966-1995', 'shownIn': ['a'], 'basis': 'real'}]


@case('S07')
def _(f, bad):
    f.json('out/claims.json', {'claims': BASE_CLAIMS})
    f.json('out/checks/page.json', {'rules': {}, 'orphanNumbers': []})
    f.json('out/script.json', {'sentences': [{'id': 's1', 'scene': 'a', 'text': 'In 1966 the real balance ends at $120,000.' if not bad else 'In 1966 the balance ends at $130,000.', 'start': 0, 'end': 2}]})


@case('S08')
def _(f, bad):
    f.json('out/checks/page.json', {'rules': {'S08': {'framesWithout': 3 if bad else 0, 'maxLagFrames': 0, 'examples': []}}})


@case('S09')
def _(f, bad):
    f.json('out/claims.json', {'claims': BASE_CLAIMS})
    f.json('out/checks/page.json', {'rules': {'S09': {'framesMissing': 0, 'examples': []}}})
    f.json('out/script.json', {'sentences': [{'id': 's1', 'scene': 'a', 'text': 'It ends at $120,000.' if bad else 'In real terms, it ends at $120,000.', 'start': 0, 'end': 2}]})


@case('S10')
def _(f, bad):
    s = ['We ran every start year from 1928.', 'This is history, not a forecast.', 'The rules here are US only.']
    if bad:
        s.append('You should keep your withdrawals at 4%.')
    f.json('out/script.json', {'sentences': [{'id': f's{i}', 'scene': 'a', 'text': x, 'start': i, 'end': i + 1} for i, x in enumerate(s)]})


@case('S11')
def _(f, bad):
    f.video(size='64x36', dur=40, src='color')
    scenes = [{'id': x, 'act': a, 'start': s, 'dur': 10} for x, a, s in (('a', 'act1', 0), ('b', 'act2', 10), ('c', 'act3', 20), ('d', 'act3', 30))]
    f.json('out/timeline.json', {'total': 40, 'scenes': scenes})
    f.json('out/claims.json', {'claims': [{'claimId': 'g', 'display': '5.6%', 'value': 5.6, 'core': True,
                                           'callbacks': [{'scene': 'a', 'meaning': 'the shared average'}, {'scene': 'b', 'meaning': 'what the average hides'}, {'scene': 'c', 'meaning': 'why the average cannot decide'}]}]})
    seen = ['a', 'b'] if bad else ['a', 'b', 'c']
    f.json('out/checks/page.json', {'rules': {}, 'claimScenes': {'g': seen}})
    f.json('out/script.json', {'sentences': []})
    f.asr([])


@case('S12')
def _(f, bad):
    f.json('out/timeline.json', {'total': 80, 'scenes': [{'id': 'a', 'start': 0, 'dur': 40}, {'id': 'b', 'start': 40, 'dur': 30}, {'id': 'c', 'start': 70, 'dur': 10}]})
    cl = [{'claimId': f'c{i}', 'display': str(10 + i)} for i in range(5)]
    first = {'c0': 1, 'c1': 20, 'c2': 41, 'c3': 60, 'c4': 75} if not bad else {'c0': 1, 'c1': 2, 'c2': 3, 'c3': 60, 'c4': 75}
    f.json('out/claims.json', {'claims': cl})
    f.json('out/script.json', {'sentences': []})
    f.json('out/checks/page.json', {'rules': {}, 'claimFirst': first, 'claimRoles': {}})


@case('S13')
def _(f, bad):
    s = ['One two three four five six.'] * 8 if bad else ['Short.', 'This one is a little longer than that.', 'Tiny.', 'And this sentence keeps going for quite a while longer than the others do.', 'Then two.', 'A middle sized one here.']
    f.json('out/script.json', {'sentences': [{'id': f's{i}', 'scene': 'a', 'text': x, 'start': i, 'end': i + 1} for i, x in enumerate(s)]})


@case('S14')
def _(f, bad):
    x = programme(40, levels=(-20,)) * 0.5
    x[int(20 * SR):int(21.3 * SR)] = 0
    master_fixture(f, x)
    f.json('out/timeline.json', {'total': 40, 'acts': [{'id': 'act1', 'start': 0, 'end': 20.5}, {'id': 'act2', 'start': 20.5, 'end': 30}, {'id': 'act3', 'start': 30, 'end': 40}], 'scenes': []})
    f.json('out/adbreaks.json', {'breaks': [20.6, 30.0] if bad else [20.6, 21.0]})


ORDER_ACTS = [('cold-open', 14), ('ident', 3), ('act1', 150), ('act2', 200), ('act3', 180), ('method', 40), ('outro', 25)]


@case('S15')
def _(f, bad):
    acts, t = [], 0.0
    for a, d in ORDER_ACTS:
        d = 20 if bad and a == 'cold-open' else d
        acts.append({'id': a, 'start': t, 'end': t + d})
        t += d
    f.json('out/timeline.json', {'total': t, 'acts': acts, 'scenes': [{'id': a['id'], 'act': a['id'], 'start': a['start'], 'dur': a['end'] - a['start']} for a in acts]})


# ---- rhythm ------------------------------------------------------------------------------------------
@case('R01')
def _(f, bad):
    dur = 90
    cuts = sorted([2 + 3 * k for k in range(8)] + [30 + 1.5 * k for k in range(14)] + [60 + 4 * k for k in range(7)])
    f.json('out/transitions.json', {'cuts': [{'t': c} for c in cuts]})
    lvl = np.concatenate([np.linspace(-40, -20, 30 * SR), np.linspace(-20, -45, 20 * SR), np.linspace(-45, -25, 40 * SR)])
    m = noise(dur) * db(lvl)
    for n, x in (('music', m), ('voice', voice_like(dur, [(5, 25), (40, 70)])), ('sfx', tone_bursts(dur, list(range(30, 50)))), ('whoosh', np.zeros(dur * SR))):
        f.wav(f'out/audio/stems/{n}.wav', np.stack([x, x], 1))
    f.json('out/timeline.json', {'total': dur, 'acts': [{'id': 'act1', 'start': 0, 'end': 30, 'climax': 28}, {'id': 'act2', 'start': 30, 'end': 60, 'climax': 48},
                                                        {'id': 'act3', 'start': 60, 'end': 90, 'climax': 87}], 'scenes': []})
    ctx = common.Ctx(f.root)
    import r_rhythm
    ts = np.arange(0, dur, 1.0)
    ml = r_rhythm._series(ctx, 'music', ts, 1.0)
    cr = np.array([np.sum((np.array(cuts) > t - 5) & (np.array(cuts) <= t + 5)) for t in ts], float)
    act = sum((r_rhythm._series(ctx, n, ts, 1.0) > -45).astype(float) for n in ('voice', 'music', 'sfx', 'whoosh'))
    dens = np.convolve(act, np.ones(5) / 5, mode='same')
    tension = (cr / cr.max() + (ml + 60) / 40) / 2
    tension = np.where((ts > 26) & (ts < 30), tension + 0.6, tension)
    tension = np.where((ts > 46) & (ts < 50), tension + 0.6, tension)
    tension = np.where((ts > 85) & (ts < 88), tension + 0.6, tension)
    samples = [{'t': float(t), 'cutRate': float(c if not bad else -c), 'musicLevel': float(m_), 'audioDensity': float(d_), 'tension': float(te)}
               for t, c, m_, d_, te in zip(ts, cr, ml, dens, tension)]
    f.json('out/tension-map.json', {'samples': samples, 'peaks': [{'t': 28}, {'t': 48}, {'t': 87}], 'valleys': [{'t': 52}, {'t': 33}, {'t': 89}]})
    f.text('out/tension-map.png', 'png')


@case('R02')
def _(f, bad):
    sc = [{'id': 'a', 'start': 0, 'dur': 50, 'layout': 'line/one', 'shot': 'medium'}, {'id': 'b', 'start': 50, 'dur': 30, 'layout': 'bars/two', 'shot': 'wide'},
          {'id': 'c', 'start': 80, 'dur': 40, 'layout': 'bars/three', 'shot': 'wide'}]
    f.json('out/timeline.json', {'total': 120, 'scenes': sc})
    f.json('out/cues.json', {'cues': [] if bad else [{'t': 100}]})


@case('R03')
def _(f, bad):
    f.video(size='64x36', dur=8, src='color')
    f.json('out/timeline.json', {'total': 8, 'scenes': [{'id': 'a', 'start': 0, 'dur': 8}]})
    f.json('out/claims.json', {'claims': [{'claimId': 'd', 'display': '$0', 'decisive': True}]})
    f.json('out/script.json', {'sentences': [{'id': 's1', 'scene': 'a', 'text': 'By 1990 the balance was $0.', 'start': 1, 'end': 3}]})
    w = asr_words('By 1990 the balance was $0.', 1.0)
    f.asr(w + asr_words('It never recovered.', w[-1]['end'] + (0.4 if bad else 1.3)))


@case('R04')
def _(f, bad):
    beats = [0.5 * k for k in range(40)]
    cuts = [1.0, 2.5, 4.0, 5.5, 7.0, 8.5, 10.0, 11.5, 13.0, 14.5]
    if bad:
        cuts = [c + (0.2 if i % 2 else 0) for i, c in enumerate(cuts)]
    f.json('out/tempo-map.json', {'beats': beats})
    f.json('out/transitions.json', {'cuts': [{'t': c} for c in cuts]})
    f.video(size='64x36', dur=16, src='color')


@case('R05')
def _(f, bad):
    d = [2, 6, 3, 9, 4, 1.5, 8, 7, 6, 5, 3.5, 2.5, 2, 1.6, 10, 3]
    if bad:
        d[4] = 15
    sc, t = [], 0.0
    for i, x in enumerate(d):
        sc.append({'id': f's{i}', 'act': 'act2' if 5 <= i <= 13 else 'act1', 'start': t, 'dur': x})
        t += x
    a2s = sc[5]['start']
    f.json('out/timeline.json', {'total': t, 'acts': [{'id': 'act2', 'start': a2s, 'end': sc[13]['start'] + d[13], 'climax': sc[13]['start'] + d[13] - 0.1}], 'scenes': sc})


def cut_video(f, cuts, dur=6, fps=30, rel='out/video.mp4'):
    frames = []
    k = 0
    for i in range(int(dur * fps)):
        t = i / fps
        k = sum(1 for c in cuts if c <= t + 1e-9)
        img = np.full((180, 320, 3), 30, np.uint8)
        x = 40 + (k * 70) % 240
        img[60:120, x:x + 40] = [240, 180, 60] if k % 2 else [80, 140, 255]
        frames.append(img)
    f.raw_video(frames, rel=rel)


@case('R06')
def _(f, bad):
    real = [1.0, 2.0, 3.0, 4.0, 5.0]
    cut_video(f, real)
    decl = real if not bad else [1.0, 1.5, 2.5, 3.5, 4.5]
    f.json('out/transitions.json', {'cuts': [{'t': c, 'type': 'cut'} for c in decl]})


# ---- visual ------------------------------------------------------------------------------------------
@case('V01')
def _(f, bad):
    f.json('out/timeline.json', {'total': 10, 'scenes': [{'id': 'a', 'start': 0, 'dur': 5}, {'id': 'b', 'start': 5, 'dur': 5}]})
    shots = [{'id': 'a1', 'scene': 'a', 'size': 'wide', 'angle': 'eye level', 'focalMm': 35, 'move': 'dolly in', 'moveReason': 'we close in on the shared average'},
             {'id': 'b1', 'scene': 'b', 'size': 'close', 'angle': 'low', 'focalMm': 40 if bad else 85, 'move': 'static', 'moveReason': 'hold still for the number'}]
    f.json('preprod/shotlist.json', {'shots': shots})
    f.text('preprod/storyboard.md', 'x')
    f.text('preprod/color-script.json', '{}')


def move_video(f, cam, blur_sub=1, dur=None, size=(640, 360)):
    """Render a stripe pattern that slides with the camera x (1 unit = frame width). blur_sub>1 averages sub-frames (motion blur)."""
    w, h = size
    xs = np.arange(w)
    frames = []
    ts = [c['t'] for c in cam]
    px = np.array([c['pos'][0] for c in cam])
    for i, t in enumerate(ts):
        acc = np.zeros((h, w))
        for s in range(blur_sub):
            tt = t + (s / blur_sub - 0.5) / 30 if blur_sub > 1 else t
            off = np.interp(tt, ts, px) * w
            row = ((((xs + off) // 24) % 2) * 160 + 40).astype(float)
            acc += row[None, :]
        img = (acc / blur_sub).astype(np.uint8)
        img[:, :] = np.maximum(img, 0)
        img[h // 3: h // 3 + 8, :] = 220  # horizontal detail (unaffected by horizontal blur)
        img[2 * h // 3: 2 * h // 3 + 8, :] = 220
        frames.append(img)
    f.raw_video(frames)


def eased_moves(dur, moves, anticipation=0.02, overshoot=0.03, fps=30):
    fr = []
    for k in range(int(dur * fps)):
        t = k / fps
        x = 0.0
        for t0, t1, dx in moves:
            if t < t0 - 0.3:
                continue
            if t < t0:
                x += -anticipation * dx * np.sin(np.pi * (t - t0 + 0.3) / 0.3)
            elif t < t1:
                u = (t - t0) / (t1 - t0)
                e = u * u * (3 - 2 * u)
                x += dx * (e + overshoot * np.sin(np.pi * u) ** 2 * u)
            elif t < t1 + 0.4:
                v = (t - t1) / 0.4
                x += dx * (1 + overshoot * 0.6 * (1 - v) * np.cos(np.pi * v / 2))
            else:
                x += dx
        fr.append({'t': t, 'pos': [x, 0, 0], 'target': [x, 0, 0], 'focusDist': 1.0, 'fovDeg': 2 * np.degrees(np.arctan(0.5))})
    return fr


def linear_moves(dur, moves, fps=30):
    fr = []
    for k in range(int(dur * fps)):
        t = k / fps
        x = sum(dx * min(1, max(0, (t - t0) / (t1 - t0))) for t0, t1, dx in moves)
        fr.append({'t': t, 'pos': [x, 0, 0], 'target': [x, 0, 0], 'focusDist': 1.0, 'fovDeg': 2 * np.degrees(np.arctan(0.5))})
    return fr


VMOVES = [(1, 2.2, 0.4), (3.5, 4.8, -0.5), (6, 7.2, 0.6), (8.5, 9.7, -0.4), (11, 12.3, 0.5), (13.5, 14.7, -0.6)]


@case('V05')
def _(f, bad):
    cam = linear_moves(16, VMOVES) if bad else eased_moves(16, VMOVES)
    f.json('out/camera.json', {'fovAxis': 'horizontal', 'frames': cam})
    move_video(f, cam)


@case('V06')
def _(f, bad):
    fr = []
    racks = [3, 7, 11]
    for k in range(15 * 30):
        t = k / 30
        fd = 2.0
        if not bad:
            for r in racks:
                if t >= r:
                    fd = 2.0 * (1.6 if racks.index(r) % 2 == 0 else 1.0)
            fd = fd if fd != 2.0 or t < racks[0] else fd
        fr.append({'t': t, 'pos': [0, 0, 0], 'focusDist': fd, 'coc': 4.0, 'fovDeg': 40})
    f.json('out/camera.json', {'frames': fr})
    f.json('out/timeline.json', {'total': 15, 'scenes': [], 'turns': [{'t': r, 'what': f'turn {i}'} for i, r in enumerate(racks)]})


@case('V07')
def _(f, bad):
    moves = [(1, 1.8, 1.0), (4, 4.8, -1.0)]
    cam = linear_moves(7, moves)
    f.json('out/camera.json', {'fovAxis': 'horizontal', 'frames': cam})
    f.json('out/render-log.json', {'subframes': 1 if bad else 8})
    move_video(f, cam, blur_sub=1 if bad else 8)


@case('V09')
def _(f, bad):
    c = ('#E5484D', '#3FBF7F') if bad else ('#F2B441', '#4C8DFF')
    f.json('out/checks/page.json', {'rules': {}, 'characters': {'1966': {'mainColour': c[0]}, 'mirror': {'mainColour': c[1]}}})


def match_video(f, cuts, dissolve_at=None, dur=8, fps=30):
    frames = []
    for i in range(int(dur * fps)):
        t = i / fps
        k = sum(1 for c in cuts if c <= t + 1e-9)
        img = np.full((180, 320), 25, np.uint8)
        # a bright disc that stays in place across cuts (geometric match) on a changing background texture
        img[:, :] = 25 + (k * 11) % 50
        yy, xx = np.mgrid[:180, :320]
        img[(yy - 90) ** 2 + (xx - 160) ** 2 < 30 ** 2] = 235
        img[10:30, 10 + (k * 37) % 260: 40 + (k * 37) % 260] = 120
        frames.append(img.astype(float))
    if dissolve_at is not None:
        f0 = int(dissolve_at * fps)
        A, B = frames[f0 - 8], frames[f0 + 8]
        B = 255 - B
        for j in range(f0 - 8, f0 + 9):
            a = (j - (f0 - 8)) / 16
            frames[j] = (1 - a) * A + a * B
        for j in range(f0 + 9, min(len(frames), f0 + 30)):
            frames[j] = B
    f.raw_video([np.clip(x, 0, 255).astype(np.uint8) for x in frames])


@case('V10')
def _(f, bad):
    cuts = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
    match_video(f, cuts, dissolve_at=7.0 if bad else None)
    scenes = [f's{i}' for i in range(7)]
    cl = [{'t': c, 'from': scenes[i], 'to': scenes[i + 1], 'type': 'cut', 'match': 'geometric', 'audio': 'j' if i < 4 else None} for i, c in enumerate(cuts)]
    if bad:
        cl.append({'t': 7.0, 'from': 's6', 'to': 's7', 'type': 'cut'})
    f.json('out/transitions.json', {'cuts': cl})
    sents = [{'id': f'x{i}', 'scene': scenes[i + 1], 'text': 'Next part begins here.', 'start': c - 0.5, 'end': c + 0.6} for i, c in enumerate(cuts)]
    f.json('out/script.json', {'sentences': sents})
    f.asr([w for s in sents for w in asr_words(s['text'], s['start'])])


@case('C11')
def _(f, bad):
    lay = ['line/a', 'bars/b', 'line/a', 'map/c', 'line/a' if bad else 'bars/d']
    f.json('out/timeline.json', {'total': 100, 'scenes': [{'id': f's{i}', 'start': 15 * i, 'dur': 15, 'layout': l} for i, l in enumerate(lay)]})


def page_rule_case(rid, good, bad_):
    def fn(f, bad):
        f.json('out/checks/page.json', {'rules': {rid: bad_ if bad else good}})
    T[rid] = fn


for rid in ('C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C15'):
    page_rule_case(rid, {'framesFlagged': 0, 'scenes': [], 'examples': []}, {'framesFlagged': 2, 'scenes': ['a (2)'], 'examples': []})
page_rule_case('C10', {'failing': []}, {'failing': ['a (one l1 in 20%, max 2)']})
page_rule_case('C12', {'violations': []}, {'violations': [{'scene': 'a', 'start': 1, 'durationS': 1.2}]})
page_rule_case('C14', {'violations': 0, 'examples': []}, {'violations': 3, 'examples': []})
page_rule_case('V02', {'samples': 10, 'ok': 10, 'examples': []}, {'samples': 10, 'ok': 5, 'examples': []})
page_rule_case('V03', {'violations': 0, 'examples': []}, {'violations': 1, 'examples': []})
page_rule_case('V08', {'violations': 0, 'worst': {'cr': 8}, 'examples': []}, {'violations': 1, 'worst': {'cr': 2.1}, 'examples': []})
page_rule_case('V11', {'violations': 0, 'byRole': {}, 'transientDuringMoves': 0, 'examples': []}, {'violations': 1, 'byRole': {'badge': 1}, 'transientDuringMoves': 0, 'examples': []})
CH = lambda a, b: {'1966': {'mainColour': '#f2b441', 'colourShare': a, 'mainShape': 'circle', 'shapeShare': 1}, 'mirror': {'mainColour': '#4c8dff', 'colourShare': 1, 'mainShape': b, 'shapeShare': 1}}
page_rule_case('V04', {'characters': CH(1, 'square'), 'sideSamples': 5, 'sideSigns': [-1], 'timeOrderViolations': []},
               {'characters': CH(0.8, 'circle'), 'sideSamples': 5, 'sideSigns': [-1, 1], 'timeOrderViolations': []})


@case('C13')
def _(f, bad):
    f.video(size='64x36', dur=6, src='color')
    f.json('out/claims.json', {'claims': [{'claimId': 'y', 'display': '1966'}]})
    f.json('out/script.json', {'sentences': [{'id': 's1', 'scene': 'a', 'text': 'It starts in 1966.', 'start': 1.0, 'end': 3.0}]})
    w = asr_words('It starts in 1966.', 1.0)
    onset = w[3]['start']
    f.asr(w)
    f.json('out/checks/page.json', {'rules': {}, 'claimFinal': {'y|a': onset + (0.4 if bad else 0.1)}})


def thumb(f, n, colours, bad_font=False):
    img = np.zeros((720, 1280, 3), np.uint8)
    img[:] = colours[0]
    for x in range(120, 1160, 60):  # bars stand in for heavy lettering on the background
        img[270:450, x:x + 30] = colours[1]
    img[600:680, 100:1180] = colours[2]
    raw = f.p(f'tmp/t{n}.rgb')
    img.tofile(raw)
    f.ff('-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1280x720', '-i', raw, f.p(f'out/package/thumb-{n}.png'))
    f.json(f'out/package/thumb-{n}.json', {'texts': [{'text': 'SAME AVERAGE', 'box': [100, 250, 1080, 220], 'fontPx': 60 if bad_font else 160}]})


@case('P01')
def _(f, bad):
    f.json('design/tokens.json', {'colors': {'bg': '#0E1116', 'ink': '#F2F4F7', 'warn': '#F2B441'}})
    for n in (1, 2, 3):
        cols = [(14, 17, 22), (242, 244, 247), (242, 180, 65)] if not bad else [(14, 17, 22), (200, 30, 200), (242, 180, 65)]
        thumb(f, n, cols)


def main():
    only = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
    rows = []
    missing = [r for r in RULES if r not in T]
    for rid in sorted(T, key=lambda r: runner.key(RULES[r])):
        if only and rid not in only:
            continue
        for bad, want in ((True, 'FAIL'), (False, 'PASS')):
            f = F(rid + ('-bad' if bad else '-good'))
            try:
                T[rid](f, bad)
                r = f.run(rid)
            except Exception as e:  # fixture error
                r = {'status': 'FIXTURE-ERROR', 'note': repr(e), 'metrics': []}
            ok = r['status'] == want
            rows.append({'rule': rid, 'fixture': 'must fail' if bad else 'must pass', 'want': want, 'got': r['status'], 'ok': ok,
                         'metrics': [m for m in r.get('metrics', []) if not m['pass']] if want == 'FAIL' else [m for m in r.get('metrics', []) if not m['pass']]})
            print(f"{'ok  ' if ok else 'FAIL'} {rid} {'bad ' if bad else 'good'} want {want} got {r['status']}" + ('' if ok else f"  {r.get('note') or ''} {[(m['name'], m['value']) for m in r.get('metrics', []) if not m['pass']]}"), flush=True)
            if '--keep' not in sys.argv:
                f.close()
            else:
                print('   kept', f.root)
    bad = [r for r in rows if not r['ok']]
    out = os.environ.get('K_SELFTEST_OUT', tempfile.gettempdir())
    json.dump(rows, open(os.path.join(out, 'selftest-py.json'), 'w'), indent=1, default=str)
    print(f'python self-test: {len(rows) - len(bad)}/{len(rows)} as expected; rules without a python fixture: {sorted(missing)}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
