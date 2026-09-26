"""§5 — sound. Master measured from the audio track of out/video.mp4; mix rules from the delivered stems
(out/audio/stems/<name>.wav|flac, contract), cross-checked against declared cue/event files."""
import json
import os
import re

import numpy as np
from scipy import signal, stats

from common import (asr_join, FPS, SR, Missing, canon_matches, ebur128, frame_rms_db, load_audio, master, metric, numbers_in_text, rule,
                    spoken_numbers, stem, verdict, words, write_wav_tmp)

VAD_DB = -45.0  # voice stem RMS (100 ms) above this = voice active


def stem_path(ctx, name):
    for ext in ('wav', 'flac'):
        rel = f'out/audio/stems/{name}.{ext}'
        if ctx.has(rel):
            return rel
    raise Missing(f'out/audio/stems/{name}.wav|flac')


def stem_audio(ctx, name):
    return load_audio(ctx, stem_path(ctx, name))


def voice_active(ctx, win=0.1):
    v = stem_audio(ctx, 'voice')
    t, db = frame_rms_db(v, win=win)
    return t, db > VAD_DB


def _ebu(ctx):
    return ctx.memo(('ebu',), lambda: ebur128(ctx.video()))


@rule('A01', '§5.6', 'integrated loudness of the video\'s audio track, ITU-R BS.1770-4 (ffmpeg ebur128)', '−14 LUFS ± 1 (−15 … −13)')
def a01_lufs(ctx):
    return verdict('A01', [metric('integrated LUFS', _ebu(ctx)['I'], 'in', [-15.0, -13.0], 'LUFS')])


@rule('A02', '§5.6', 'true peak, 4× oversampled (ffmpeg ebur128 peak=true), max over both channels', '≤ −1.0 dBTP')
def a02_tp(ctx):
    return verdict('A02', [metric('true peak dBTP', _ebu(ctx)['TP'], '<=', -1.0, 'dBTP')])


@rule('A03', '§5.6', 'loudness range (EBU Tech 3342, ffmpeg ebur128)', '6 … 10 LU')
def a03_lra(ctx):
    return verdict('A03', [metric('LRA LU', _ebu(ctx)['LRA'], 'in', [6.0, 10.0], 'LU')])


@rule('A04', '§5.6', 'decoded audio samples (float) with |x| ≥ 0.999 (full scale), and runs of ≥ 2 consecutive such samples', '0 samples')
def a04_clip(ctx):
    x = master(ctx)
    hot = np.abs(x) >= 0.999
    n = int(hot.sum())
    return verdict('A04', [metric('samples at full scale', n, '<=', 0)])


def phase_correlation(x, sr=SR, win=0.1, floor_db=-50):
    w = int(win * sr)
    n = len(x) // w
    L = x[: n * w, 0].reshape(n, w)
    R = x[: n * w, 1].reshape(n, w)
    num = (L * R).sum(1)
    den = np.sqrt((L * L).sum(1) * (R * R).sum(1)) + 1e-20
    rms = 10 * np.log10(((L * L).sum(1) + (R * R).sum(1)) / (2 * w) + 1e-20)
    c = num / den
    return c[rms > floor_db]


@rule('A05', '§5.6, §6', 'stereo phase correlation r = ΣLR/√(ΣL²ΣR²) per 100 ms window, windows with RMS > −50 dBFS; mean over windows. '
      'Also share of windows with r < 0 (out-of-phase content)', 'mean r > 0.3; windows with r < 0 ≤ 5%')
def a05_phase(ctx):
    c = phase_correlation(master(ctx))
    return verdict('A05', [metric('mean phase correlation', float(c.mean()) if len(c) else None, '>', 0.3),
                           metric('windows r<0 (%)', 100 * float((c < 0).mean()) if len(c) else None, '<=', 5.0, '%')])


def band_db(x, lo, hi, sr=SR):
    sos = signal.butter(4, [lo, hi], btype='bandpass', fs=sr, output='sos')
    y = signal.sosfilt(sos, x)
    return 10 * np.log10(np.mean(y ** 2) + 1e-20)


@rule('A06', '§5.6', 'mono fold-down (L+R)/2 played as dual mono: integrated loudness vs the stereo mix (BS.1770), and voice-band (300–3400 Hz) energy of the fold-down vs the mean of L and R',
      'mono loudness ≥ stereo − 3 LU; voice-band loss ≤ 3 dB')
def a06_mono(ctx):
    x = master(ctx)
    mono = x.mean(axis=1)
    p = write_wav_tmp(np.stack([mono, mono], axis=1))
    try:
        # the fold-down played as dual mono vs the stereo mix: equal for mono-compatible content, lower where L and R cancel
        mI = ebur128(p)['I']
    finally:
        os.unlink(p)
    sI = _ebu(ctx)['I']
    vb_mono = band_db(mono, 300, 3400)
    vb_st = 10 * np.log10((10 ** (band_db(x[:, 0], 300, 3400) / 10) + 10 ** (band_db(x[:, 1], 300, 3400) / 10)) / 2)
    return verdict('A06', [metric('mono − stereo LU', mI - sI, '>=', -3.0, 'LU'), metric('voice-band loss dB', vb_st - vb_mono, '<=', 3.0, 'dB')])


@rule('A07', '§5.5', 'stems voice and music; 100 ms windows where voice is active (voice RMS > −45 dBFS); '
      'level gap = 10·log10(mean voice power) − 10·log10(mean music power) over those windows', '18 … 22 dB')
def a07_music_under(ctx):
    v, m = stem_audio(ctx, 'voice'), stem_audio(ctx, 'music')
    n = min(len(v), len(m))
    w = int(0.1 * SR)
    k = n // w
    pv = (v[: k * w].mean(1) ** 2).reshape(k, w).mean(1)
    pm = (m[: k * w].mean(1) ** 2).reshape(k, w).mean(1)
    act = 10 * np.log10(pv + 1e-20) > VAD_DB
    gap = 10 * np.log10(pv[act].mean()) - 10 * np.log10(pm[act].mean() + 1e-20)
    return verdict('A07', [metric('voice − music dB', float(gap), 'in', [18.0, 22.0], 'dB')])


def _band_levels(x, t0, t1, bands, sr=SR):
    seg = x[int(t0 * sr): int(t1 * sr)]
    if len(seg) < 256:
        return None
    f, P = signal.welch(seg, fs=sr, nperseg=2048)
    return [10 * np.log10(P[(f >= lo) & (f < hi)].sum() + 1e-20) for lo, hi in bands]


def voice_onsets(act, t, pre=0.6, post=0.6, win=0.1):
    n_pre, n_post = int(round(pre / win)), int(round(post / win))
    out = []
    for i in range(n_pre, len(act) - n_post):
        if act[i] and not act[i - 1] and not act[i - n_pre:i].any() and act[i:i + n_post].all():
            out.append(float(t[i] - win / 2))
    return out


@rule('A08', '§5.5', 'music stem around each voice onset (≥ 0.6 s voice-free before, ≥ 0.6 s voice after): band levels (Welch PSD) in [t−0.6, t−0.1] vs [t+0.1, t+0.6]. '
      'presence drop = drop of 1–4 kHz; low drop = drop of 60–500 Hz. Medians over onsets',
      'median presence drop ≥ 6 dB AND median (presence drop − low drop) ≥ 3 dB (the dip is band-limited, not broadband); ≥ 3 onsets measured')
def a08_multiband(ctx):
    m = stem_audio(ctx, 'music').mean(1)
    t, act = voice_active(ctx)
    ons = voice_onsets(act, t)
    pres, rel = [], []
    for o in ons:
        a = _band_levels(m, o - 0.6, o - 0.1, [(1000, 4000), (60, 500)])
        b = _band_levels(m, o + 0.1, o + 0.6, [(1000, 4000), (60, 500)])
        if a is None or b is None or a[0] < -90:
            continue
        pres.append(a[0] - b[0])
        rel.append((a[0] - b[0]) - (a[1] - b[1]))
    ms = [metric('onsets measured', len(pres), '>=', 3), metric('median 1-4 kHz drop dB', float(np.median(pres)) if pres else None, '>=', 6.0, 'dB'),
          metric('median band-limited excess dB', float(np.median(rel)) if rel else None, '>=', 3.0, 'dB')]
    return verdict('A08', ms)


def silent_spans(x, thr=-40.0, win=0.05, hop=0.01):
    t, db = frame_rms_db(x, win=win, hop=hop)
    q = db <= thr
    spans, s = [], None
    for i, v in enumerate(q):
        if v and s is None:
            s = i
        if (not v or i == len(q) - 1) and s is not None:
            e = i if not v else i + 1
            spans.append((float(t[s] - win / 2), float(t[e - 1] + win / 2)))
            s = None
    return spans


@rule('A09', '§5.3', 'master: spans where RMS (50 ms window, 10 ms hop) stays ≤ −40 dBFS; intentional silence = such a span lasting 0.8–1.5 s (the first and last 2 s of the video excluded)',
      '≥ 3 spans of 0.8–1.5 s')
def a09_silences(ctx):
    x = master(ctx)
    dur = len(x) / SR
    sp = [(a, b) for a, b in silent_spans(x) if a > 2 and b < dur - 2]
    ok = [(round(a, 2), round(b - a, 2)) for a, b in sp if 0.8 <= b - a <= 1.5]
    return verdict('A09', [metric('silences 0.8-1.5 s', len(ok), '>=', 3)], details=[{'spans': ok[:10], 'otherSpans': [(round(a, 2), round(b - a, 2)) for a, b in sp if not 0.8 <= b - a <= 1.5][:10]}])


# ---- camera-driven sound ------------------------------------------------------------------------
def camera_speed(ctx):
    cam = ctx.json('out/camera.json')
    fr = cam['frames']
    t = np.array([f['t'] for f in fr])
    pos = np.array([f['pos'] for f in fr], float)
    tgt = np.array([f.get('target', f['pos']) for f in fr], float)
    fov = np.array([f.get('fovDeg', 40.0) for f in fr], float)
    fd = np.array([f.get('focusDist', 1.0) for f in fr], float)
    width = 2 * fd * np.tan(np.radians(fov) / 2) * (16 / 9) if cam.get('fovAxis', 'vertical') == 'vertical' else 2 * fd * np.tan(np.radians(fov) / 2)
    dt = np.gradient(t)
    sp = np.maximum(np.linalg.norm(np.gradient(pos, axis=0), axis=1), np.linalg.norm(np.gradient(tgt, axis=0), axis=1)) / dt / width
    return t, sp, pos, tgt, width


def camera_moves(t, sp, thr=0.05, gap=0.2, min_dur=0.3):
    on = sp > thr
    moves, s = [], None
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        if (not v or i == len(on) - 1) and s is not None:
            moves.append([s, i if not v else i + 1])
            s = None
    merged = []
    for m in moves:
        if merged and t[m[0]] - t[merged[-1][1] - 1] < gap:
            merged[-1][1] = m[1]
        else:
            merged.append(m)
    return [(a, b) for a, b in merged if t[b - 1] - t[a] >= min_dur]


@rule('A10', '§5.3', 'camera moves from out/camera.json (speed in frame-widths/s at the focus plane > 0.05, gaps < 0.2 s merged, ≥ 0.3 s); '
      'per move: peak speed vs peak whoosh-stem RMS (50 ms) in [start − 0.3 s, end + 0.3 s]',
      'Spearman ρ(peak speed, whoosh dB) ≥ 0.6 over ≥ 5 moves; every move with peak ≥ 0.3 fw/s has a whoosh ≥ −45 dBFS')
def a10_whoosh(ctx):
    t, sp, *_ = camera_speed(ctx)
    wh = stem_audio(ctx, 'whoosh')
    wt, wdb = frame_rms_db(wh, win=0.05, hop=0.01)
    rows = []
    for a, b in camera_moves(t, sp):
        s0, s1 = t[a] - 0.3, t[b - 1] + 0.3
        sel = (wt >= s0) & (wt <= s1)
        rows.append((float(sp[a:b].max()), float(wdb[sel].max()) if sel.any() else -120.0, round(float(t[a]), 2)))
    if len(rows) < 5:
        return verdict('A10', [metric('camera moves', len(rows), '>=', 5)])
    rho = stats.spearmanr([r[0] for r in rows], [r[1] for r in rows]).statistic
    silent = [r for r in rows if r[0] >= 0.3 and r[1] < -45]
    return verdict('A10', [metric('camera moves', len(rows), '>=', 5), metric('Spearman speed~whoosh', float(rho), '>=', 0.6),
                           metric('fast moves without whoosh', len(silent), '<=', 0)], details=[{'moves': rows[:40]}])


@rule('A11', '§5.3', 'out/sfx-events.json (t, x in screen px of the sounding object); pan measured in the sfx stem over [t, t + 0.15 s]: (E_R − E_L)/(E_R + E_L); '
      'events with stem RMS > −50 dBFS', 'Pearson r(pan, (x − 960)/960) ≥ 0.7 over ≥ 8 events')
def a11_pan(ctx):
    ev = ctx.json('out/sfx-events.json')['events']
    s = stem_audio(ctx, 'sfx')
    xs, ps = [], []
    for e in ev:
        if e.get('x') is None:
            continue
        seg = s[int(e['t'] * SR): int((e['t'] + 0.15) * SR)]
        if len(seg) < 100:
            continue
        el, er = float((seg[:, 0] ** 2).sum()), float((seg[:, 1] ** 2).sum())
        if 10 * np.log10((el + er) / (2 * len(seg)) + 1e-20) < -50:
            continue
        xs.append((e['x'] - 960) / 960)
        ps.append((er - el) / (er + el))
    r = float(np.corrcoef(xs, ps)[0, 1]) if len(xs) >= 3 and np.std(xs) > 0 and np.std(ps) > 0 else None
    return verdict('A11', [metric('events measured', len(xs), '>=', 8), metric('Pearson pan~x', r, '>=', 0.7)])


# ---- music timing -------------------------------------------------------------------------------
def onsets(x, sr=SR, hop=0.005):
    """Spectral-flux onsets (half-wave rectified log-magnitude flux, adaptive median threshold)."""
    if x.ndim == 2:
        x = x.mean(1)
    h = int(hop * sr)
    f, tt, Z = signal.stft(x, fs=sr, nperseg=2048, noverlap=2048 - h, boundary=None)
    mag = np.log1p(1000 * np.abs(Z))
    flux = np.maximum(0, np.diff(mag, axis=1)).sum(0)
    tt = tt[1:]
    med = signal.medfilt(flux, 101)
    thr = med + 0.5 * np.std(flux)
    pk, _ = signal.find_peaks(flux, height=thr, distance=int(0.05 / hop))
    return tt[pk]


def cut_times(ctx):
    if ctx.has('out/transitions.json'):
        return sorted(c['t'] for c in ctx.json('out/transitions.json')['cuts'])
    return sorted(s['start'] for s in ctx.scenes()[1:])


@rule('A12', '§5.2', 'out/tempo-map.json: accents[] and beats[]; cuts from out/transitions.json. Music onsets detected in the music stem (spectral flux). '
      'An accent "lands" when a cut is within ±1 frame (±33.3 ms); it is "real" when a music onset is within ±1 frame',
      '≥ 5 accents; 100% of accents land on a cut; ≥ 90% of accents are real; ≥ 70% of beats while music is audible have an onset within ±50 ms')
def a12_accents(ctx):
    tm = ctx.json('out/tempo-map.json')
    acc, beats = tm.get('accents', []), tm.get('beats', [])
    cuts = np.array(cut_times(ctx))
    m = stem_audio(ctx, 'music')
    on = onsets(m)
    fr = 1 / FPS + 1e-6
    land = [a for a in acc if len(cuts) and np.min(np.abs(cuts - a)) <= fr]
    real = [a for a in acc if len(on) and np.min(np.abs(on - a)) <= fr]
    t, db = frame_rms_db(m, win=0.1)
    aud = [b for b in beats if db[min(len(db) - 1, int(b / 0.1))] > -50]
    hit = [b for b in aud if len(on) and np.min(np.abs(on - b)) <= 0.05]
    pct = lambda a, b: 100 * len(a) / len(b) if b else None
    return verdict('A12', [metric('accents', len(acc), '>=', 5), metric('accents on a cut (%)', pct(land, acc), '>=', 100.0, '%'),
                           metric('accents confirmed by onset (%)', pct(real, acc), '>=', 90.0, '%'),
                           metric('beats confirmed by onset (%)', pct(hit, aud), '>=', 70.0, '%')],
                   details=[{'missedAccents': [round(a, 3) for a in acc if a not in land][:10]}])


def active_span(x, thr=-45.0):
    t, db = frame_rms_db(x, win=0.02, hop=0.005)
    on = np.flatnonzero(db > thr)
    return float(t[on[-1]] - t[on[0]] + 0.02) if len(on) else 0.0


@rule('A13', '§5.4', 'out/voice/takes.json: for each take, the raw TTS file and the final (stretched) file; stretch = active speech span of final / of raw '
      '(span between first and last 20 ms window above −45 dBFS)', 'every |stretch − 1| ≤ 0.10')
def a13_stretch(ctx):
    takes = ctx.json('out/voice/takes.json')['takes']
    bad, worst = [], 0.0
    for tk in takes:
        r = active_span(load_audio(ctx, tk['raw'], channels=1))
        f = active_span(load_audio(ctx, tk['final'], channels=1))
        st = f / r if r else float('inf')
        worst = max(worst, abs(st - 1))
        if abs(st - 1) > 0.10:
            bad.append((tk.get('id'), round(st, 3)))
    return verdict('A13', [metric('takes', len(takes), '>=', 1), metric('max |stretch-1|', worst, '<=', 0.10)], details=[{'over': bad}])


# ---- ASR ----------------------------------------------------------------------------------------
def asr_master(ctx):
    """faster-whisper small.en (CPU, int8, word timestamps) on the audio track of the video — the mix a viewer hears.
    Cached by the video's SHA-256 in out/checks/cache."""
    def get():
        from common import sha256_file
        h = sha256_file(ctx.video())[:16]
        cp = os.path.join(ctx.cache_dir, f'asr-{h}.json')
        if os.path.exists(cp):
            return json.load(open(cp))
        from faster_whisper import WhisperModel
        x = master(ctx).mean(1)
        p = write_wav_tmp(x)
        try:
            mdl = WhisperModel('small.en', device='cpu', compute_type='int8')
            segs, _ = mdl.transcribe(p, word_timestamps=True, beam_size=5, language='en', condition_on_previous_text=False, vad_filter=False)
            ws = [{'w': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3)} for s in segs for w in (s.words or [])]
        finally:
            os.unlink(p)
        json.dump(ws, open(cp, 'w'))
        return ws
    return ctx.memo(('asr',), get)


# Terms the brief defines (locked list). A term is key wherever the script uses it. D may add terms in out/terms.json, never remove.
DEFINED_TERMS = ['average', 'geometric', 'arithmetic', 'real', 'nominal', 'inflation', 'inflation-adjusted', 'withdrawal', 'withdraw', 'rebalanced',
                 'rebalance', 'sequence', 'order', 'portfolio', 'stocks', 'bonds', 'dividends', 'treasury', 'retiree', 'mirror', 'illustrative',
                 'forecast', 'history', 'balance', 'depleted', 'taxes', 'fees']
PROPER_ALWAYS = ['S&P', 'Damodaran', 'NYU', 'Stern', 'FRED', 'Treasury', 'US', 'U.S.', 'America', 'American', 'CPI']


def key_words(sentences, extra_terms=()):
    """Key words of each sentence: every number (digits in `text`), every proper name, every defined term.
    Proper names: a capitalised word not at sentence start anywhere in the script makes that word a name everywhere;
    plus PROPER_ALWAYS. 'I' excluded."""
    names = set(PROPER_ALWAYS)
    for s in sentences:
        ws = words(s['text'])
        for w in ws[1:]:
            c = w.strip(".,;:!?\"'’“”()")
            if c and c[0].isupper() and c not in ('I',) and not c.isdigit():
                names.add(c)
    terms = {stem(t) for t in list(DEFINED_TERMS) + list(extra_terms)}
    out = []
    for s in sentences:
        keys = []
        for c, span in numbers_in_text(s['text']):
            keys.append({'kind': 'number', 'want': c, 'text': span})
        for w in words(s['text']):
            c = w.strip(".,;:!?\"'’“”()")
            if not c or any(ch.isdigit() for ch in c):
                continue
            if c in names or c.rstrip("'s") in names:
                keys.append({'kind': 'name', 'want': stem(c), 'text': c})
            elif stem(c) in terms:
                keys.append({'kind': 'term', 'want': stem(c), 'text': c})
        out.append(keys)
    return out


def match_keys(keys, asr_words):
    text = asr_join(asr_words)
    nums = spoken_numbers(text)
    stems = {stem(x) for x in text.split()} | {stem(p) for x in text.split() for p in x.split('-')}
    # ASR often writes 'U.S.'/'US', 'S&P' as 'S and P'
    low = text.lower()
    missing = []
    for k in keys:
        if k['kind'] == 'number':
            ok = canon_matches(k['want'], nums)
        elif k['want'] in ('s&p',):
            ok = 's&p' in low or 's and p' in low
        elif k['want'] in ('us', 'u.s.'):
            ok = bool(re.search(r'\bu\.?s\b', low)) or 'united states' in low
        else:
            ok = k['want'] in stems
        if not ok:
            missing.append(k['text'])
    return missing


@rule('A14', '§5.4', 'own ASR (faster-whisper small.en, int8, word timestamps) of the video\'s mixed audio. Key words per script sentence (out/script.json): '
      'every number, every proper name, every defined term (locked list DEFINED_TERMS + out/terms.json). A key word is heard if the ASR has it '
      '(numbers compared as values; names/terms by stem) among words starting within the sentence window [start − 1.5 s, end + 1.5 s]',
      '0 key words missing (no percentage threshold)')
def a14_keywords(ctx):
    sents = ctx.sentences()
    extra = ctx.json('out/terms.json').get('terms', []) if ctx.has('out/terms.json') else []
    keys = key_words(sents, extra)
    asr = asr_master(ctx)
    total = sum(len(k) for k in keys)
    miss = []
    for s, k in zip(sents, keys):
        if not k:
            continue
        win = [w for w in asr if s['start'] - 1.5 <= w['start'] <= s['end'] + 1.5]
        m = match_keys(k, win)
        if m:
            miss.append({'sentence': s.get('id'), 't': s['start'], 'missing': m, 'heard': asr_join(win)[:200]})
    nmiss = sum(len(m['missing']) for m in miss)
    return verdict('A14', [metric('key words', total, '>=', 1), metric('key words missing', nmiss, '<=', 0)], details=miss[:30])


@rule('A15', '§5.4', 'own ASR words inside each sentence window; sentence rate = words of `spoken` / (last ASR word end − first ASR word start) × 60; '
      'act rate = Σ words / Σ sentence spans of the act (sentences of < 4 words are left out of the per-sentence cap)',
      'every act 150 … 160 wpm; no sentence > 175 wpm')
def a15_wpm(ctx):
    asr = asr_master(ctx)
    scene_act = {s['id']: s.get('act') for s in ctx.scenes()}
    per_act, fast = {}, []
    for s in ctx.sentences():
        ws = [w for w in asr if s['start'] - 0.3 <= w['start'] <= s['end'] + 0.3]
        n = len(words(s.get('spoken') or s['text']))
        if not ws or n == 0:
            continue
        span = ws[-1]['end'] - ws[0]['start']
        if span <= 0:
            continue
        a = scene_act.get(s['scene'], '?')
        per_act.setdefault(a, [0, 0.0])
        per_act[a][0] += n
        per_act[a][1] += span
        wpm = 60 * n / span
        if n >= 4 and wpm > 175:
            fast.append((s.get('id'), round(wpm)))
    rates = {a: 60 * n / d for a, (n, d) in per_act.items() if d > 0}
    ms = [metric(f'wpm act {a}', r, 'in', [150.0, 160.0], 'wpm') for a, r in rates.items()]
    ms.append(metric('sentences > 175 wpm', len(fast), '<=', 0))
    return verdict('A15', ms, details=[{'fast': fast[:15]}])
