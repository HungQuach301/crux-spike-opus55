"""Shared helpers for the test-D checks (Phiên K). Pure measurement: no rule reads render code.

Every rule is a function rule(ctx) -> Result. `ctx.root` is the project being judged; artifacts are
read only through ctx.art(path) so that a missing artifact becomes status MISSING (counted as a fail).
"""
import hashlib
import json
import math
import os
import re
import subprocess
import tempfile

import numpy as np

SR = 48000
FPS = 30


class Missing(Exception):
    """An artifact the contract requires is absent: the rule cannot prove the requirement."""


class Result(dict):
    def __init__(self, rid, status, metrics=None, details=None, note=None):
        super().__init__(id=rid, status=status, metrics=metrics or [], details=details or [], note=note)


def metric(name, value, op, threshold, unit=''):
    """op: '>=', '<=', '==', 'in' (threshold = [lo, hi]). `near` = within 5% of a threshold (brief §0)."""
    near = False
    if value is not None and isinstance(value, (int, float)) and not (isinstance(value, float) and math.isnan(value)):
        bounds = threshold if op == 'in' else [threshold] if op in ('>=', '<=', '>', '<') else []
        for b in bounds:
            if b is None or b == 0:  # a zero-tolerance count has no "just meets" band
                continue
            span = abs(b) * 0.05
            if abs(value - b) <= span:
                near = True
    if op == '>=':
        ok = value is not None and value >= threshold
    elif op == '>':
        ok = value is not None and value > threshold
    elif op == '<=':
        ok = value is not None and value <= threshold
    elif op == '<':
        ok = value is not None and value < threshold
    elif op == 'in':
        ok = value is not None and threshold[0] <= value <= threshold[1]
    elif op == '==':
        ok = value == threshold
    else:
        raise ValueError(op)
    v = round(value, 6) if isinstance(value, float) else value
    return {'name': name, 'value': v, 'op': op, 'threshold': threshold, 'unit': unit, 'pass': bool(ok), 'near': near}


def verdict(rid, metrics, details=None, note=None):
    ok = all(m['pass'] for m in metrics)
    return Result(rid, 'PASS' if ok else 'FAIL', metrics, details, note)


class Ctx:
    def __init__(self, root, cache=None):
        self.root = os.path.abspath(root)
        self.cache_dir = cache or os.path.join(self.root, 'out', 'checks', 'cache')
        os.makedirs(self.cache_dir, exist_ok=True)
        self._memo = {}

    def path(self, rel):
        return os.path.join(self.root, rel)

    def has(self, rel):
        return os.path.exists(self.path(rel))

    def need(self, rel):
        p = self.path(rel)
        if not os.path.exists(p):
            raise Missing(rel)
        return p

    def json(self, rel):
        key = ('json', rel)
        if key not in self._memo:
            with open(self.need(rel), encoding='utf-8') as f:
                self._memo[key] = json.load(f)
        return self._memo[key]

    def text(self, rel):
        with open(self.need(rel), encoding='utf-8') as f:
            return f.read()

    def memo(self, key, fn):
        if key not in self._memo:
            self._memo[key] = fn()
        return self._memo[key]

    # ---- contract views ---------------------------------------------------------------------
    def timeline(self):
        return self.json('out/timeline.json')

    def scenes(self):
        return self.timeline()['scenes']

    def acts(self):
        return self.timeline().get('acts') or []

    def sentences(self):
        return self.json('out/script.json')['sentences']

    def claims(self):
        return self.json('out/claims.json')['claims']

    def video(self):
        return self.need('out/video.mp4')

    def total(self):
        return float(self.timeline()['total'])


# ---- media --------------------------------------------------------------------------------------
def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def ffprobe(path, *args):
    out = run(['ffprobe', '-v', 'error', '-of', 'json', *args, path]).stdout
    return json.loads(out)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def decode_audio(path, sr=SR, channels=2):
    """Decode any audio/video file to float32 [n, ch] at sr via ffmpeg (no resampling if already sr)."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:a:0', '-f', 'f32le', '-ac', str(channels), '-ar', str(sr), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, channels)


def load_audio(ctx, rel, channels=2):
    key = ('audio', rel, channels)
    return ctx.memo(key, lambda: decode_audio(ctx.need(rel), channels=channels))


def master(ctx):
    return ctx.memo(('master',), lambda: decode_audio(ctx.video()))


def frame_rms_db(x, sr=SR, win=0.1, hop=None):
    """RMS in dBFS over windows (mono mix of channels if 2-D). Returns (times, dB)."""
    if x.ndim == 2:
        x = x.mean(axis=1) if x.shape[1] > 1 else x[:, 0]
    hop = hop or win
    w, h = int(win * sr), int(hop * sr)
    n = max(0, 1 + (len(x) - w) // h)
    if n == 0:
        return np.zeros(0), np.zeros(0)
    idx = np.arange(w)[None, :] + h * np.arange(n)[:, None]
    p = np.mean(x[idx] ** 2, axis=1)
    return (np.arange(n) * h + w / 2) / sr, 10 * np.log10(p + 1e-20)


def power_frames(x, sr=SR, win=0.1):
    if x.ndim == 2:
        x = x.mean(axis=1)
    w = int(win * sr)
    n = len(x) // w
    return np.mean(x[: n * w].reshape(n, w) ** 2, axis=1)


def ebur128(path):
    """Integrated loudness, LRA and true peak via ffmpeg's ebur128 (ITU-R BS.1770-4, 4x oversampled peak)."""
    p = subprocess.run(['ffmpeg', '-nostats', '-v', 'info', '-i', path, '-map', '0:a:0', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'],
                       capture_output=True, text=True)
    txt = p.stderr[p.stderr.rfind('Summary:'):]
    g = lambda k: float(re.search(k + r':\s+(-?[\d.inf]+)', txt).group(1))
    return {'I': g('I'), 'LRA': g('LRA'), 'TP': g('Peak')}


def write_wav_tmp(x, sr=SR):
    import soundfile as sf
    fd, p = tempfile.mkstemp(suffix='.wav')
    os.close(fd)
    sf.write(p, x, sr, subtype='FLOAT')
    return p


# ---- video frames -------------------------------------------------------------------------------
def video_frames(path, times=None, every=None, gray=True, scale=None, max_frames=None):
    """Yield (t, frame) decoded with PyAV. frame: uint8 luma plane [h,w] (limited-range codes as stored) if gray,
    else float RGB (BT.709, limited->full). times: sorted list of seconds to fetch (nearest frame)."""
    import av
    c = av.open(path)
    st = c.streams.video[0]
    st.thread_type = 'AUTO'
    want = None if times is None else sorted(times)
    wi = 0
    k = 0
    for fr in c.decode(st):
        t = float(fr.pts * st.time_base)
        if want is not None:
            while wi < len(want) and want[wi] < t - 0.5 / FPS:
                wi += 1
            if wi >= len(want):
                break
            if abs(want[wi] - t) > 0.5 / FPS:
                continue
            wi += 1
        elif every and (k % every):
            k += 1
            continue
        k += 1
        if gray:
            y = np.frombuffer(fr.planes[0], dtype=np.uint8)
            ls = fr.planes[0].line_size
            img = y.reshape(-1, ls)[: fr.height, : fr.width]
            if scale:
                img = img[::scale, ::scale]
            yield t, img.copy()
        else:
            yield t, fr.to_ndarray(format='rgb24')
        if max_frames and k >= max_frames:
            break
    c.close()


# ---- numbers and words --------------------------------------------------------------------------
UNITS = {'zero': 0, 'oh': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
         'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19}
TENS = {'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90}
SCALES = {'hundred': 100, 'thousand': 1000, 'million': 1e6, 'billion': 1e9}
NUMWORD = set(UNITS) | set(TENS) | set(SCALES) | {'point', 'and', 'a'}

NUM_RE = re.compile(r'(?<![\w.])([-−–]?\$?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(%|percent\b|pp\b)?(\s?(?:million|billion|thousand|k)\b)?', re.I)


def canon(v, unit):
    v = float(v)
    s = ('%.6f' % v).rstrip('0').rstrip('.')
    return f'{unit}:{s}'


def numbers_in_text(text):
    """Numbers written with digits: [(canon, span_text)]. Units: usd, pct, num. '$1.2 million' -> usd:1200000.
    A range '1928–1996' gives two numbers."""
    out = []
    for m in NUM_RE.finditer(text):
        sign, whole, frac, pct, mult = m.groups()
        v = float(whole.replace(',', '') + (frac or ''))
        if mult:
            mm = mult.strip().lower()
            v *= {'million': 1e6, 'billion': 1e9, 'thousand': 1e3, 'k': 1e3}[mm]
        if sign and sign.strip('$') in '-−–' and sign.strip('$'):
            # a leading dash counts as minus only when it is not a range separator ("1966–1995")
            st = m.start()
            if st > 0 and text[st - 1].isdigit():
                pass
            else:
                v = -v
        unit = 'usd' if '$' in (sign or '') else 'pct' if pct and pct.lower() != 'pp' else 'pp' if pct else 'num'
        out.append((canon(v, unit), m.group(0).strip()))
    return out


def _words_to_number(ws):
    """Parse a run of number words (already lower-case, hyphens split). Returns float or None.
    Handles 'nineteen sixty six' (year style), 'four point five', 'one hundred twenty three thousand'."""
    if not ws:
        return None
    if 'point' in ws:
        i = ws.index('point')
        a = _words_to_number(ws[:i]) if i else 0
        digs = [UNITS.get(w) for w in ws[i + 1:]]
        if a is None or not digs or any(d is None or d > 9 for d in digs):
            return None
        return float(f"{int(a)}.{''.join(str(d) for d in digs)}")
    # year style: two groups each < 100 without scale words ('nineteen sixty six', 'twenty twenty five')
    if not any(w in SCALES for w in ws):
        groups, cur = [], None
        for w in ws:
            if w in ('and', 'a'):
                continue
            if w in TENS:
                if cur is not None:
                    groups.append(cur)
                cur = TENS[w]
            elif w in UNITS:
                if cur is not None and cur % 10 == 0 and cur >= 20 and UNITS[w] < 10:
                    cur += UNITS[w]
                else:
                    if cur is not None:
                        groups.append(cur)
                    cur = UNITS[w]
            else:
                return None
        if cur is not None:
            groups.append(cur)
        if len(groups) == 1:
            return float(groups[0])
        if len(groups) == 2 and groups[0] >= 10:
            return float(groups[0] * 100 + groups[1])
        return None
    total, cur = 0.0, 0.0
    for w in ws:
        if w in ('and',):
            continue
        if w == 'a':
            cur = cur or 1
        elif w in UNITS:
            cur += UNITS[w]
        elif w in TENS:
            cur += TENS[w]
        elif w == 'hundred':
            cur = (cur or 1) * 100
        elif w in SCALES:
            total += (cur or 1) * SCALES[w]
            cur = 0
        else:
            return None
    return total + cur


def tokenize(text):
    return re.findall(r"[\w$%'.,\-−–&]+", text)


def asr_join(ws):
    """Join ASR word tokens into text. Whisper splits numbers into tokens such as "$25" ",000" or "5" ".2" "%":
    a token starting with , . % or following "$" or "-" is glued to the previous one."""
    out = ''
    for w in ws:
        tok = w['w'] if isinstance(w, dict) else w
        if out and (re.match(r'^[,.%]', tok) and not re.match(r'^\.\.\.', tok) or out.endswith(('$', '-'))):
            out += tok
        else:
            out += (' ' if out else '') + tok
    return out


def spoken_numbers(text):
    """Numbers in a transcript (ASR mixes digits and words): digits via numbers_in_text, then number-word runs.
    "minus"/"negative" before a number makes it negative."""
    text = re.sub(r'\b(minus|negative)\s+(?=[$\d])', '-', text, flags=re.I)
    out = [c for c, _ in numbers_in_text(text)]
    low = re.sub(r'[-–]', ' ', text.lower())
    toks = re.findall(r"[a-z]+|\$|%", low)
    i = 0
    while i < len(toks):
        if toks[i] in NUMWORD and toks[i] not in ('and', 'a', 'point'):
            j = i
            while j < len(toks) and toks[j] in NUMWORD:
                j += 1
            run_ = toks[i:j]
            while run_ and run_[-1] in ('and', 'a', 'point'):
                run_.pop()
            v = _words_to_number(run_)
            unit = 'num'
            if j < len(toks) and toks[j] in ('percent',):
                unit = 'pct'
            elif j < len(toks) and toks[j] in ('dollars', 'dollar'):
                unit = 'usd'
            elif j < len(toks) and toks[j] in ('percentage',):
                unit = 'pp'
            if v is not None:
                out.append(canon(v, unit))
            i = j
        else:
            i += 1
    return out


def canon_matches(want, have):
    """A key number is heard if the same value is heard with a compatible unit (ASR may drop '$')."""
    wu, wv = want.split(':')
    for h in have:
        hu, hv = h.split(':')
        if abs(float(hv) - float(wv)) <= 1e-9 * max(1, abs(float(wv))) and (hu == wu or 'num' in (hu, wu)):
            return True
    return False


def sentence_split(text):
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9“"$])', text.strip())
    return [p for p in parts if p]


def words(text):
    return re.findall(r"[A-Za-z0-9$%][A-Za-z0-9$%'’.,\-]*", text)


def stem(w):
    w = w.lower().strip(".,;:!?\"'’“”()").replace('’', "'")
    for suf in ("'s", 'ing', 'ed', 'es', 's'):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def safe(fn, ctx):
    """Run a rule: Missing -> MISSING result; exceptions -> ERROR (both count as not passed)."""
    rid = getattr(fn, 'rid', fn.__name__)
    try:
        r = fn(ctx)
    except Missing as e:
        return Result(rid, 'MISSING', note=f'artifact missing: {e}')
    except Exception as e:  # noqa: BLE001
        import traceback
        return Result(rid, 'ERROR', note=f'{type(e).__name__}: {e}', details=[traceback.format_exc()[-1500:]])
    return r


RULES = []


def rule(rid, section, measure, threshold, needs=()):
    """Register a rule with its brief section, measurement definition and threshold (text)."""
    def deco(fn):
        fn.rid = rid
        fn.meta = {'id': rid, 'section': section, 'measure': measure, 'threshold': threshold, 'needs': list(needs), 'engine': 'py'}
        RULES.append(fn)
        return fn
    return deco
