"""Frame rules evaluated by the page sampler (checks/page/sampler.js) — here they get their verdicts from out/checks/page.json."""
from common import asr_join, Missing, canon_matches, metric, numbers_in_text, rule, spoken_numbers, verdict
from r_audio import asr_master


def pr(ctx, rid):
    p = ctx.json('out/checks/page.json')
    if rid not in p['rules']:
        raise Missing(f'page rule {rid} in out/checks/page.json')
    return p['rules'][rid]


def frames_rule(rid, section, measure):
    def fn(ctx):
        r = pr(ctx, rid)
        return verdict(rid, [metric('frames flagged', r['framesFlagged'], '<=', 0)], details=[{'scenes': r['scenes'][:10], 'examples': r['examples']}])
    fn.__name__ = 'page_' + rid
    return rule(rid, section, measure, '0 flagged frames')(fn)


frames_rule('C01', '§4.7 (C rule scene-leak)', 'every 0.1 s outside the camera move at scene start: shapes of a panel not listed in scenes[].panels, not background, opacity > 0.05, ≥ 16 px² on frame')
frames_rule('C02', '§4.7 (C rule bg-over-data)', 'every 0.1 s: a background object (role bg) painted after (above) the first data shape and overlapping a data shape')
frames_rule('C03', '§4.7 (C rule unlabelled-curve)', 'settled frames, every 0.1 s: a visible curve (≥ 80 px diagonal, opacity > 0.1) without its bound label within 240 px, or any text within 60 px if unbound')
frames_rule('C04', '§4.7 (C rule axis-anchors: "nhãn trục có neo")', 'settled frames, every 0.1 s: a line series (role series, or ≥ 10 vertices in a series colour, ≥ 120 px) without an axis of its chart and ≥ 2 numeric anchors')
frames_rule('C05', '§4.7 (C rule grey-emphasis: "hiểu được ở thang xám")', 'every 0.1 s: a level-1/emphasis text below 7:1 against the bg token in grey, or a 48 px+ non-emphasis text brighter in grey than it')
frames_rule('C06', '§4.7 (C rule number-colour)', 'every 0.1 s: a number in a series colour whose colour differs from its series (data-series map) or from the nearest mark within 150 px')
frames_rule('C07', '§4.7 (C rule bar-proportion: "tỷ lệ cột đúng")', 'settled frames: a bar cropped along its value axis without an axis break, or bars of one chart (data-value, full) with scales differing > 3%')
frames_rule('C15', '§4.7, §4.4 ("chỉ dùng token")', 'every 0.1 s: a colour on a visible object (text runs, text background, shape fill/stroke; gradients excepted) that is not in design/tokens.json colors')


@rule('C10', '§4.7 (C rule level1)', 'chart scenes of ≥ 2 s: share of samples (0.1 s) with exactly one visible level-1 text; max simultaneous', '≥ 50% of samples with exactly one, never two')
def c10(ctx):
    r = pr(ctx, 'C10')
    return verdict('C10', [metric('scenes failing', len(r['failing']), '<=', 0)], details=r['failing'][:10])


@rule('C12', '§4.7 (C rule split-view)', 'camera frozen at t, page at t + 0.1 s; union box of changed objects (a growing object counts only its new strip); outside camera moves',
      'no run ≥ 1.0 s where the changes span > 60% of frame width or height')
def c12(ctx):
    r = pr(ctx, 'C12')
    return verdict('C12', [metric('split-view runs', len(r['violations']), '<=', 0)], details=r['violations'][:10])


@rule('C14', '§4.7 ("đọc được ở cỡ 25%")', 'settled frames every 0.2 s, texts with opacity ≥ 0.95: smallest font run in px; on the delivered video frame downscaled 4× (box average), '
      'WCAG contrast between the 95th and 5th luminance percentile inside the text box', 'every text ≥ 28 px (cap height ≥ 5 px at 25%) and ≥ 3:1 at 25%; 0 violations')
def c14(ctx):
    r = pr(ctx, 'C14')
    return verdict('C14', [metric('text samples not legible at 25%', r['violations'], '<=', 0)], details=r['examples'])


@rule('V02', '§4.2', 'settled frames every 0.1 s: centre of each visible level-1 text vs the four thirds intersections (±96 px x, ±54 px y), or the vertical centre line (±48 px) '
      'when the scene declares composition "center"', '≥ 90% of level-1 samples placed')
def v02(ctx):
    r = pr(ctx, 'V02')
    share = 100 * r['ok'] / r['samples'] if r['samples'] else None
    return verdict('V02', [metric('level-1 samples', r['samples'], '>=', 1), metric('level-1 placed (%)', share, '>=', 90.0, '%')], details=r['examples'])


@rule('V03', '§4.2', 'settled frames every 0.2 s: ink bounding box of each visible text from the page\'s text layer (alpha > 64, badges included)', 'all text ink inside x 96–1824, y 54–1026 (90% safe area); 0 violations')
def v03(ctx):
    r = pr(ctx, 'V03')
    return verdict('V03', [metric('text outside safe area', r['violations'], '<=', 0)], details=r['examples'])


@rule('V04', '§4.3', 'objects with char "1966"/"mirror" every 0.1 s: horizontal order when both are visible (|Δx| ≥ 20 px), share of the main colour and main shape of each; '
      'year axis labels (role axis-label with year) ordered left → right',
      'one side only for the whole video (≥ 1 sample); each character\'s main colour ≥ 95% and main shape ≥ 95% of its observations; colours differ; shapes differ; 0 time-order violations')
def v04(ctx):
    r = pr(ctx, 'V04')
    ch = r['characters']
    both = '1966' in ch and 'mirror' in ch
    ms = [metric('both characters seen', both, '==', True), metric('side samples', r['sideSamples'], '>=', 1), metric('sides used', len(r['sideSigns']), '<=', 1)]
    if both:
        ms += [metric('1966 colour share', ch['1966']['colourShare'], '>=', 0.95), metric('mirror colour share', ch['mirror']['colourShare'], '>=', 0.95),
               metric('1966 shape share', ch['1966']['shapeShare'], '>=', 0.95), metric('mirror shape share', ch['mirror']['shapeShare'], '>=', 0.95),
               metric('colours differ', ch['1966']['mainColour'] != ch['mirror']['mainColour'], '==', True),
               metric('shapes differ', ch['1966']['mainShape'] != ch['mirror']['mainShape'], '==', True)]
    ms.append(metric('time-order violations', len(r['timeOrderViolations']), '<=', 0))
    return verdict('V04', ms, details=[ch, r['timeOrderViolations'][:5]])


@rule('V08', '§4.4', 'settled frames every 0.2 s, texts with opacity ≥ 0.95, on the delivered video frame: text colour = median of glyph-core pixels (glyph mask eroded 1 px), background = median of the ring '
      '1–4 px around the ink (inside the badge for badge text); WCAG contrast', '≥ 4.5:1 for every text sample')
def v08(ctx):
    r = pr(ctx, 'V08')
    worst = r['worst']['cr'] if r.get('worst') else None
    return verdict('V08', [metric('worst text contrast', worst, '>=', 4.5), metric('samples below 4.5:1', r['violations'], '<=', 0)], details=[r.get('worst'), *r['examples']])


@rule('V11', '§4.7 (C rule text-line-collision, upgraded to pixels)', 'settled frames every 0.2 s: text ink from the page\'s text layer (glyphs, badges with their pill, axis labels; alpha > 64) '
      'dilated by 2 px vs ink of the graphics layer (lines, axes, series, bars, marks, stroked outlines; neutral cards and backgrounds excluded); and text vs text (each text rendered alone)',
      '< 4 overlapping pixels for every text in every sample; 0 violations')
def v11(ctx):
    r = pr(ctx, 'V11')
    return verdict('V11', [metric('text collisions', r['violations'], '<=', 0)], details=[{'byRole': r['byRole'], 'transientDuringMoves': r['transientDuringMoves']}, *r['examples']])


def number_run(ws, want):
    """Shortest run of ASR words (≤ 6) that says the value `want`: (first index, last index)."""
    for L in range(1, 7):
        for i in range(len(ws) - L + 1):
            if canon_matches(want, spoken_numbers(asr_join(ws[i:i + L]))):
                return i, i + L - 1
    return None


@rule('C13', '§4.7 ("đồng bộ số–lời ±250 ms theo giá trị cuối")', 'for each narration sentence saying a number that is shown in the same scene: onset = start of the own-ASR word run saying the value; '
      'screen = first frame (frame-accurate) the claim span shows its final display text in that scene (page sampler claimFinal); when several claims of the scene carry the value, the one closest to the onset', '|screen − onset| ≤ 250 ms for every pair; 0 spoken numbers missing from ASR')
def c13(ctx):
    p = ctx.json('out/checks/page.json')
    final = p['claimFinal']
    asr = asr_master(ctx)
    rows, notheard = [], []
    claims = {c['claimId']: c for c in ctx.claims()}
    for s in ctx.sentences():
        nums = [c for c, _ in numbers_in_text(s['text'])]
        if not nums:
            continue
        ws = [w for w in asr if s['start'] - 1 <= w['start'] <= s['end'] + 1]
        for n in dict.fromkeys(nums):
            # claims shown in this scene that carry the spoken value; the voice refers to the one closest in time
            cands = []
            for k, t in final.items():
                cid, sc = k.split('|')
                c = claims.get(cid)
                if sc != s['scene'] or not c:
                    continue
                if any(canon_matches(n, [w]) for w, _ in numbers_in_text(str(c['display']))):
                    cands.append((cid, t))
            if not cands:
                continue
            run = number_run(ws, n)
            if not run:
                notheard.append((cands[0][0], s.get('id')))
                continue
            onset = ws[run[0]]['start']
            cid, t = min(cands, key=lambda x: abs(x[1] - onset))
            rows.append((cid, s['scene'], round(1000 * (t - onset))))
    worst = max((abs(r[2]) for r in rows), default=None)
    bad = [r for r in rows if abs(r[2]) > 250]
    return verdict('C13', [metric('pairs', len(rows), '>=', 1), metric('worst |offset| ms', worst, '<=', 250.0, 'ms'), metric('pairs > 250 ms', len(bad), '<=', 0),
                           metric('spoken numbers not in ASR', len(notheard), '<=', 0)], details=[{'over': bad[:10], 'notHeard': notheard[:10]}])
