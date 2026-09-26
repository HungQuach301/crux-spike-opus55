"""§3 — rhythm: tension map, pattern breaks, breathing room, cut timing, shot lengths, cut verification in the picture."""
import numpy as np
from scipy import stats

from common import asr_join, FPS, SR, Missing, canon_matches, frame_rms_db, metric, numbers_in_text, rule, spoken_numbers, verdict, video_frames
from r_audio import VAD_DB, asr_master, cut_times, stem_audio


def _series(ctx, name, times, win):
    x = stem_audio(ctx, name)
    t, db = frame_rms_db(x, win=win)
    return np.interp(times, t, db)


def local_max(ts, ys, t, span=10.0):
    sel = (ts >= t - span) & (ts <= t + span)
    return sel.any() and np.interp(t, ts, ys) >= ys[sel].max() - 1e-9 - 0.05 * (ys.max() - ys.min())


@rule('R01', '§3.1', 'out/tension-map.json samples (t, cutRate, audioDensity, musicLevel, tension), peaks[], valleys[]; out/tension-map.png present. '
      'Declared curves vs measured: cut rate = cuts per 10 s window (out/transitions.json); music level = music-stem RMS dB (1 s); audio density = number of stems '
      '(voice, music, sfx, whoosh) above −45 dBFS per 1 s, 5 s moving mean. Peaks: local maximum of tension within ±10 s (5% of range slack); '
      'each act 1–3 has a peak within ±5 s of its climax (timeline acts[].climax); every peak is followed within 45 s by a declared valley that is ≥ 25% of the range lower',
      'Pearson r ≥ 0.8 (cut rate), ≥ 0.7 (music level), ≥ 0.6 (audio density); 0 false peaks; 3 acts with a climax peak; 0 peaks without valley')
def r01_tension(ctx):
    tm = ctx.json('out/tension-map.json')
    ctx.need('out/tension-map.png')
    S = tm['samples']
    ts = np.array([s['t'] for s in S], float)
    ten = np.array([s['tension'] for s in S], float)
    cuts = np.array(cut_times(ctx))
    cr = np.array([np.sum((cuts > t - 5) & (cuts <= t + 5)) for t in ts], float)
    ml = _series(ctx, 'music', ts, 1.0)
    act = np.zeros_like(ts)
    for n in ('voice', 'music', 'sfx', 'whoosh'):
        act += (_series(ctx, n, ts, 1.0) > -45).astype(float)
    k = max(1, int(round(5 / max(1e-3, np.median(np.diff(ts))))))
    dens = np.convolve(act, np.ones(k) / k, mode='same')
    r = lambda a, b: float(np.corrcoef(a, b)[0, 1]) if np.std(a) > 0 and np.std(b) > 0 else 0.0
    r_cut = r([s['cutRate'] for s in S], cr)
    r_mus = r([s['musicLevel'] for s in S], ml)
    r_den = r([s['audioDensity'] for s in S], dens)
    peaks = [p['t'] for p in tm.get('peaks', [])]
    valleys = [v['t'] for v in tm.get('valleys', [])]
    false_pk = [p for p in peaks if not local_max(ts, ten, p)]
    rng = ten.max() - ten.min()
    novalley = [p for p in peaks if not any(p < v <= p + 45 and np.interp(v, ts, ten) <= np.interp(p, ts, ten) - 0.25 * rng for v in valleys)]
    acts = {a['id']: a for a in ctx.acts()}
    climax = [a for a in ('act1', 'act2', 'act3') if acts.get(a, {}).get('climax') is not None and any(abs(p - acts[a]['climax']) <= 5 for p in peaks)]
    return verdict('R01', [metric('r cut rate', r_cut, '>=', 0.8), metric('r music level', r_mus, '>=', 0.7), metric('r audio density', r_den, '>=', 0.6),
                           metric('false peaks', len(false_pk), '<=', 0), metric('acts with climax peak', len(climax), '>=', 3),
                           metric('peaks without valley', len(novalley), '<=', 0)], details=[{'falsePeaks': false_pk, 'noValley': novalley}])


@rule('R02', '§3.2', 'change points = scene starts where the layout family (text before "/" in scenes[].layout) or the shot size (scenes[].shot / shot.size) changes, '
      'plus starts of audio-layer cues (out/cues.json cues[].t); gap between consecutive change points (0 and the end included)', 'longest gap ≤ 60 s')
def r02_breaks(ctx):
    sc = ctx.scenes()
    fam = lambda s: str(s.get('layout', '')).split('/')[0]
    size = lambda s: s['shot'].get('size') if isinstance(s.get('shot'), dict) else s.get('shot')
    pts = [0.0]
    for a, b in zip(sc, sc[1:]):
        if fam(a) != fam(b) or size(a) != size(b):
            pts.append(b['start'])
    pts += [c['t'] for c in ctx.json('out/cues.json')['cues']]
    pts.append(ctx.total())
    pts = sorted(pts)
    gaps = np.diff(pts)
    i = int(np.argmax(gaps))
    return verdict('R02', [metric('longest stretch without a break s', float(gaps[i]), '<=', 60.0, 's')], details=[{'from': pts[i], 'to': pts[i + 1]}])


def number_end(ws, want):
    """End index of the shortest ASR word run (≤ 6 words) that says the value `want`."""
    for L in range(1, 7):
        for i in range(len(ws) - L + 1):
            if canon_matches(want, spoken_numbers(asr_join(ws[i:i + L]))):
                return i + L - 1
    return None


@rule('R03', '§3.3', 'decisive claims (decisive=true); each narration sentence saying one: own-ASR word run that says the value; pause = next ASR word start − end of that run; '
      'confirmed on the voice stem (100 ms RMS ≤ −45 dBFS through the pause)', '≥ 1 decisive claim; every pause ≥ 1.0 s; 0 decisive numbers not found in ASR')
def r03_breath(ctx):
    dec = [c for c in ctx.claims() if c.get('decisive')]
    asr = asr_master(ctx)
    try:
        vt, vdb = frame_rms_db(stem_audio(ctx, 'voice'), win=0.1)
    except Missing:
        vt = None
    rows, notfound = [], []
    for c in dec:
        want = [x for x, _ in numbers_in_text(str(c['display']))]
        for s in ctx.sentences():
            if not any(canon_matches(w, [x for x, _ in numbers_in_text(s['text'])]) for w in want):
                continue
            ws = [w for w in asr if s['start'] - 1 <= w['start'] <= s['end'] + 1]
            j = next((number_end(ws, w) for w in want if number_end(ws, w) is not None), None)
            if j is None:
                notfound.append((c['claimId'], s.get('id')))
                continue
            end = ws[j]['end']
            nxt = next((w['start'] for w in asr if w['start'] > end + 0.02), ctx.total())
            gap = nxt - end
            if vt is not None:
                sel = (vt > end + 0.1) & (vt < end + min(gap, 1.0) - 0.05)
                if sel.any() and vdb[sel].max() > VAD_DB:
                    gap = min(gap, float(vt[sel][np.argmax(vdb[sel] > VAD_DB)] - end))
            rows.append((c['claimId'], s.get('id'), round(end, 2), round(gap, 2)))
    short = [r for r in rows if r[3] < 1.0]
    return verdict('R03', [metric('decisive claims', len(dec), '>=', 1), metric('shortest pause s', min((r[3] for r in rows), default=None), '>=', 1.0, 's'),
                           metric('pauses < 1.0 s', len(short), '<=', 0), metric('decisive numbers not heard', len(notfound), '<=', 0)],
                   details=[{'short': short[:10], 'notFound': notfound[:10]}])


def luma_diffs(ctx, times, scale=4):
    """Mean |ΔY| between consecutive frames around given times: dict t -> (diff at cut, median diff of ±10 frames)."""
    want = sorted({round((t + k / FPS) * FPS) / FPS for t in times for k in range(-11, 12)})
    fr = {round(t * FPS): y.astype(np.int16) for t, y in video_frames(ctx.video(), times=want, scale=scale)}
    out = {}
    for t in times:
        f = round(t * FPS)
        d = lambda i: float(np.mean(np.abs(fr[i] - fr[i - 1]))) if i in fr and i - 1 in fr else None
        at = d(f)
        around = [d(i) for i in range(f - 10, f + 11) if i != f and d(i) is not None]
        out[t] = (at, float(np.median(around)) if around else None, around)
    return out


@rule('R04', '§3.4', 'cuts from out/transitions.json; beats from out/tempo-map.json; a cut is on the beat if a beat is within ±1 frame; on action if the cut declares action=true '
      'and the picture moves into the cut (mean |ΔY| of the last 5 frames before the cut ≥ 1.5 × the outgoing shot\'s median)',
      '≥ 70% of cuts on a beat or on action')
def r04_cut_timing(ctx):
    cuts = ctx.json('out/transitions.json')['cuts']
    beats = np.array(ctx.json('out/tempo-map.json').get('beats', []))
    fr = 1 / FPS + 1e-6
    on_beat = [c for c in cuts if len(beats) and np.min(np.abs(beats - c['t'])) <= fr]
    act = [c for c in cuts if c.get('action') and c not in on_beat]
    ok_act = []
    if act:
        want = sorted({round((c['t'] - k / FPS) * FPS) / FPS for c in act for k in range(0, 31)})
        fr_ = {round(t * FPS): y.astype(np.int16) for t, y in video_frames(ctx.video(), times=want, scale=4)}
        for c in act:
            f = round(c['t'] * FPS)
            ds = [float(np.mean(np.abs(fr_[i] - fr_[i - 1]))) for i in range(f - 29, f) if i in fr_ and i - 1 in fr_]
            if len(ds) >= 10 and np.mean(ds[-5:]) >= 1.5 * max(0.05, np.median(ds)):
                ok_act.append(c)
    share = 100 * (len(on_beat) + len(ok_act)) / len(cuts) if cuts else None
    return verdict('R04', [metric('cuts on beat/action (%)', share, '>=', 70.0, '%')], details=[{'cuts': len(cuts), 'onBeat': len(on_beat), 'onAction': len(ok_act), 'declaredAction': len(act)}])


@rule('R05', '§3.5', 'shot durations = scenes[].dur of out/timeline.json. Act 2 acceleration: act-2 scenes that start before the act-2 climax, split in three consecutive groups of equal count; group means',
      'every shot 1.2 … 12 s (act "outro" exempt from the 12 s cap: it holds the end screen); CV = std/mean ≥ 0.4; act-2 means non-increasing and last ≤ 0.8 × first (≥ 6 scenes)')
def r05_shots(ctx):
    sc = ctx.scenes()
    d = np.array([s['dur'] for s in sc], float)
    short = [(s['id'], s['dur']) for s in sc if s['dur'] < 1.2]
    long_ = [(s['id'], s['dur']) for s in sc if s['dur'] > 12 and s.get('act') != 'outro']
    cv = float(d.std() / d.mean())
    a2 = next((a for a in ctx.acts() if a['id'] == 'act2'), None)
    ms = [metric('shots < 1.2 s', len(short), '<=', 0), metric('shots > 12 s', len(long_), '<=', 0), metric('shot length CV', cv, '>=', 0.4)]
    groups = None
    if a2 and a2.get('climax') is not None:
        xs = [s['dur'] for s in sc if s.get('act') == 'act2' and s['start'] < a2['climax']]
        if len(xs) >= 6:
            g = np.array_split(np.array(xs), 3)
            groups = [float(x.mean()) for x in g]
    ms.append(metric('act-2 scenes before climax', len(xs) if a2 and a2.get('climax') is not None else 0, '>=', 6))
    if groups:
        ms += [metric('act-2 group means non-increasing', groups[0] >= groups[1] >= groups[2], '==', True),
               metric('act-2 last/first mean', groups[2] / groups[0], '<=', 0.8)]
    return verdict('R05', ms, details=[{'short': short, 'long': long_, 'act2Groups': groups}])


@rule('R06', '§3.4, §3.5, §4.6 (picture check)', 'every declared cut in out/transitions.json except dissolves: mean |ΔY| (luma, 1/4 scale) between the frame at the cut and the one before, '
      'vs the median of the ±10 surrounding frame pairs', '≥ 90% of cuts show a spike ≥ 3 × the surrounding median and ≥ 2 codes')
def r06_cut_visible(ctx):
    cuts = [c for c in ctx.json('out/transitions.json')['cuts'] if c.get('type') != 'dissolve']
    res = luma_diffs(ctx, [c['t'] for c in cuts])
    ok, bad = 0, []
    for c in cuts:
        at, med, _ = res[c['t']]
        if at is not None and med is not None and at >= max(2.0, 3 * med):
            ok += 1
        else:
            bad.append((c['t'], None if at is None else round(at, 2), None if med is None else round(med, 2)))
    return verdict('R06', [metric('cuts', len(cuts), '>=', 1), metric('cuts visible in picture (%)', 100 * ok / len(cuts) if cuts else None, '>=', 90.0, '%')], details=[{'notVisible': bad[:15]}])
