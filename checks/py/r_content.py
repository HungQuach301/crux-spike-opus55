"""§1 and §2 — content, data, claims, language, script structure."""
import csv
import datetime
import re
from urllib.parse import urlparse

import numpy as np

from common import (asr_join, Missing, canon, canon_matches, metric, numbers_in_text, rule, sha256_file, spoken_numbers, verdict, words)
from r_audio import asr_master, silent_spans, master

STOCK_W, BOND_W = 0.6, 0.4
FIRST_START, LAST_START, HORIZON = 1928, 1996, 30


def page(ctx):
    """Output of the page sampler (checks/page/sampler.js): text track, claims seen, page-rule results."""
    return ctx.json('out/checks/page.json')


def annual(ctx):
    rows = list(csv.DictReader(open(ctx.need('data/normalized/annual.csv'))))
    return {int(r['year']): (float(r['stocks']), float(r['bonds']), float(r['inflation'])) for r in rows}


def simulate(seq, initial, rate):
    """seq: list of (stocks, bonds, inflation) for years 1..30. Withdraw at the start of each year: year 1 = rate × initial,
    later years = previous withdrawal × (1 + previous year's inflation). Then the rest earns the 60/40 return (rebalanced yearly).
    Returns withdrawals, end-of-year nominal balances, end-of-year real balances (start-year dollars), depleted year index (1-based) or None."""
    B, W = float(initial), rate * initial
    ws, en, er, dep = [], [], [], None
    price = 1.0
    for k, (s, b, inf) in enumerate(seq):
        if k > 0:
            W *= 1 + seq[k - 1][2]
        take = min(W, B)
        if dep is None and B < W:
            dep = k + 1
        B = (B - take) * (1 + STOCK_W * s + BOND_W * b)
        price *= 1 + inf
        ws.append(take)
        en.append(B)
        er.append(B / price)
    return ws, en, er, dep


def close(a, b):
    return abs(a - b) <= max(0.5, 1e-6 * abs(b))


@rule('S01', '§1.2', 'independent re-computation of every path in out/model.json from data/normalized/annual.csv with the brief\'s model '
      '(60/40 S&P 500 TR / 10-y Treasury, yearly rebalance, start-of-year withdrawal, year 1 = 4% of initial, then × (1 + previous year\'s inflation), 30 years, no tax, no fee); '
      'compared value by value (withdrawals, end-of-year nominal and real balances, depletion year)',
      'model parameters exactly 0.60/0.40, 4%, 30 years; every value within max($0.50, 1e-6 relative); 0 mismatches')
def s01_model(ctx):
    m = ctx.json('out/model.json')
    data = annual(ctx)
    ms = [metric('weights', [m.get('weights', {}).get('stocks'), m.get('weights', {}).get('bonds')], '==', [0.6, 0.4]),
          metric('withdrawal rate', m.get('rate'), '==', 0.04), metric('horizon years', m.get('years'), '==', 30),
          metric('tax', m.get('tax', 0), '==', 0), metric('fees', m.get('fees', 0), '==', 0)]
    init = m['initial']
    bad, checked = [], 0

    def cmp(key, seq, p):
        nonlocal checked
        ws, en, er, dep = simulate(seq, init, 0.04)
        for name, mine in (('withdrawals', ws), ('endNominal', en), ('endReal', er)):
            theirs = p.get(name)
            if theirs is None:
                bad.append((key, name, 'missing'))
                continue
            for k, (a, b) in enumerate(zip(theirs, mine)):
                checked += 1
                if not close(a, b):
                    bad.append((key, name, k + 1, round(a, 2), round(b, 2)))
                    break
            if len(theirs) != len(mine):
                bad.append((key, name, 'length', len(theirs)))
        if p.get('depletedYear', None) != dep:
            bad.append((key, 'depletedYear', p.get('depletedYear'), dep))

    paths = m.get('paths', {})
    if '1966' in paths:
        cmp('1966', [data[y] for y in range(1966, 1996)], paths['1966'])
    else:
        bad.append(('1966', 'path missing'))
    if 'mirror' in paths:
        mir = paths['mirror']
        rev = set(mir.get('reverse', []))
        base = [data[y] for y in range(1966, 1996)]
        rr = base[::-1]
        seq = [(rr[k][0], rr[k][1], (rr[k] if 'inflation' in rev else base[k])[2]) for k in range(30)] if 'returns' in rev else None
        if seq is None:
            bad.append(('mirror', 'reverse must include "returns"'))
        else:
            cmp('mirror', seq, mir)
    else:
        bad.append(('mirror', 'path missing'))
    for y in range(FIRST_START, LAST_START + 1):
        p = m.get('starts', {}).get(str(y))
        if p is None:
            bad.append((y, 'start year missing'))
            continue
        cmp(str(y), [data[k] for k in range(y, y + HORIZON)], p)
    ms += [metric('values compared', checked, '>=', 1), metric('mismatches', len(bad), '<=', 0)]
    return verdict('S01', ms, details=bad[:20])


def visible_texts(ctx, scene_filter=None):
    p = page(ctx)
    out = []
    for s in p['textTrack']:
        if scene_filter and not scene_filter(s['scene']):
            continue
        for it in s['items']:
            out.append((s['t'], s['scene'], it['text']))
    return out


def scene_acts(ctx):
    return {s['id']: s.get('act') for s in ctx.scenes()}


NO_TAX = re.compile(r'\bno (income )?tax(es)?\b|\bbefore tax(es)?\b|\btaxes? (are )?(not|ignored)', re.I)
NO_FEE = re.compile(r'\bno fees?\b|\bfees? (are )?(not|ignored)|\bwithout fees\b|\bno (fund )?costs?\b', re.I)


@rule('S02', '§1.2', 'visible on-screen text (page sampler text track, every 0.1 s): phrases for "no taxes" and "no fees" (regex NO_TAX / NO_FEE), '
      'looked for in the methodology card scenes (act "method") and in the rest of the video',
      'both phrases visible in the methodology card AND both visible outside it')
def s02_notax(ctx):
    acts = scene_acts(ctx)
    tx = visible_texts(ctx)
    inm = [x for x in tx if acts.get(x[1]) == 'method']
    out = [x for x in tx if acts.get(x[1]) != 'method']
    f = lambda xs, rx: any(rx.search(x[2]) for x in xs)
    return verdict('S02', [metric('no-tax in method card', f(inm, NO_TAX), '==', True), metric('no-fee in method card', f(inm, NO_FEE), '==', True),
                           metric('no-tax on screen elsewhere', f(out, NO_TAX), '==', True), metric('no-fee on screen elsewhere', f(out, NO_FEE), '==', True)])


@rule('S03', '§1.3', 'data/sources.json: per raw file path, url, sha256, downloaded (ISO date), terms {quote, url}; SHA-256 recomputed from the committed file; '
      'hosts of primary (Damodaran) and cross-check (FRED) sources',
      'every file present with matching SHA-256, valid date, http(s) URL, terms quote ≥ 20 chars and terms URL; a primary file on pages.stern.nyu.edu; a cross-check file on fred.stlouisfed.org')
def s03_provenance(ctx):
    src = ctx.json('data/sources.json')
    bad = []
    hosts = {'primary': set(), 'crosscheck': set()}
    for f in src.get('files', []):
        pid = f.get('path')
        if not pid or not ctx.has(pid):
            bad.append((pid, 'file missing'))
            continue
        if sha256_file(ctx.path(pid)) != f.get('sha256'):
            bad.append((pid, 'sha256 mismatch'))
        try:
            datetime.date.fromisoformat(str(f.get('downloaded'))[:10])
        except ValueError:
            bad.append((pid, 'bad date'))
        u = urlparse(f.get('url') or '')
        if u.scheme not in ('http', 'https') or not u.netloc:
            bad.append((pid, 'bad url'))
        t = f.get('terms') or {}
        if len(t.get('quote') or '') < 20 or urlparse(t.get('url') or '').scheme not in ('http', 'https'):
            bad.append((pid, 'terms quote/url missing'))
        hosts.setdefault(f.get('role'), set()).add(u.netloc)
    ms = [metric('files', len(src.get('files', [])), '>=', 2), metric('file problems', len(bad), '<=', 0),
          metric('primary on pages.stern.nyu.edu', any(h.endswith('stern.nyu.edu') for h in hosts.get('primary', ())), '==', True),
          metric('cross-check on fred.stlouisfed.org', any(h.endswith('stlouisfed.org') for h in hosts.get('crosscheck', ())), '==', True)]
    return verdict('S03', ms, details=bad)


@rule('S04', '§1.3', 'data/normalized/annual.csv (primary) vs data/normalized/fred_inflation.csv (FRED CPI) and, if present, data/normalized/stocks2.csv; '
      'years used = 1928 … 2025 (every 30-year window 1928–1996); |primary − cross-check| per year in percentage points vs the tolerance declared in data/sources.json',
      'declared tolerance ≤ 0.5 pp (inflation) and ≤ 0.5 pp (stocks); every year outside tolerance is listed in sources.json "mismatches" (reported, not silently resolved); every used year present in both')
def s04_crosscheck(ctx):
    src = ctx.json('data/sources.json')
    tol = src.get('tolerance', {})
    prim = annual(ctx)
    used = range(FIRST_START, LAST_START + HORIZON)
    listed = {(int(m['year']), m['series']) for m in src.get('mismatches', [])}
    unreported, missing, over = [], [], 0

    def compare(rel, col, idx, series, t):
        nonlocal over
        rows = {int(r['year']): float(r[col]) for r in csv.DictReader(open(ctx.need(rel)))}
        for y in used:
            if y not in rows or y not in prim:
                missing.append((series, y))
                continue
            d = abs(rows[y] - prim[y][idx]) * 100
            if d > t:
                over += 1
                if (y, series) not in listed:
                    unreported.append((series, y, round(d, 3)))

    ti, ts = tol.get('inflation_pp'), tol.get('stocks_pp')
    compare('data/normalized/fred_inflation.csv', 'inflation', 2, 'inflation', ti if ti is not None else 0)
    if ctx.has('data/normalized/stocks2.csv'):
        compare('data/normalized/stocks2.csv', 'stocks', 0, 'stocks', ts if ts is not None else 0)
    ms = [metric('inflation tolerance pp', ti, '<=', 0.5, 'pp') if ti is not None else metric('inflation tolerance declared', False, '==', True),
          metric('stocks tolerance pp', ts, '<=', 0.5, 'pp') if ts is not None else metric('stocks tolerance declared', False, '==', True),
          metric('used years missing in a source', len(missing), '<=', 0), metric('out-of-tolerance years not reported', len(unreported), '<=', 0)]
    return verdict('S04', ms, details=[{'overTolerance': over, 'unreported': unreported[:15], 'missing': missing[:15]}])


def geo_mean(seq):
    g = np.prod([1 + STOCK_W * s + BOND_W * b for s, b, _ in seq]) ** (1 / len(seq)) - 1
    return float(g)


@rule('S05', '§1.4', 'geometric mean of the 60/40 yearly return, recomputed for 1966–1995 and for the mirror sequence (1995 → 1966); the displayed claims '
      '(claims with character "1966"/"mirror" and kind "geomean") compared with the recomputation; mirror claims flagged illustrative',
      '|G(1966) − G(mirror)| ≤ 0.01 pp; each displayed geomean claim within 0.005 pp of its recomputation; every mirror claim illustrative')
def s05_mirror(ctx):
    data = annual(ctx)
    base = [data[y] for y in range(1966, 1996)]
    g1, g2 = geo_mean(base), geo_mean(base[::-1])
    cl = ctx.claims()
    gm = [c for c in cl if c.get('kind') == 'geomean' and c.get('character') in ('1966', 'mirror')]
    off = [(c['claimId'], c['value']) for c in gm if abs(float(c['value']) - 100 * (g1 if c['character'] == '1966' else g2)) > 0.005]
    mir = [c['claimId'] for c in cl if c.get('character') == 'mirror' and not c.get('illustrative')]
    return verdict('S05', [metric('|G1966 - Gmirror| pp', abs(g1 - g2) * 100, '<=', 0.01, 'pp'), metric('geomean claims shown', len(gm), '>=', 2),
                           metric('geomean claims off', len(off), '<=', 0), metric('mirror claims not illustrative', len(mir), '<=', 0)],
                   details=[{'G1966 %': round(g1 * 100, 4), 'Gmirror %': round(g2 * 100, 4), 'off': off, 'notIllustrative': mir}])


@rule('S06', '§1.4, §1.7', 'page sampler: objects with a `year` attribute visible (opacity > 0.5, on frame) in act-3 frames; union over act 3',
      'every start year 1928 … 1996 shown (69 of 69), including years where order did no harm')
def s06_allyears(ctx):
    p = page(ctx)
    acts = scene_acts(ctx)
    shown = set()
    for s in p.get('yearsTrack', []):
        if acts.get(s['scene']) == 'act3':
            shown |= set(int(y) for y in s['years'])
    want = set(range(FIRST_START, LAST_START + 1))
    return verdict('S06', [metric('start years shown in act 3', len(want & shown), '>=', len(want))], details=[{'missing': sorted(want - shown)[:30]}])


def claim_canons(c):
    got = [x for x, _ in numbers_in_text(str(c.get('display', '')))]
    return got


@rule('S07', '§1.5', 'claims registry out/claims.json vs what is shown and said. On screen: every number in visible text (page sampler) must sit inside a '
      'claim span (data-claim). Narration: every number in out/script.json text must equal (value+unit) the display of a claim listed for that sentence\'s scene. '
      'Every claim: formula; source or illustrative; historical (source) claims carry dataYear',
      '0 orphan numbers on screen; 0 unregistered numbers in narration; 0 claims without formula; 0 unsourced non-illustrative claims; 0 sourced claims without dataYear')
def s07_claims(ctx):
    cl = ctx.claims()
    p = page(ctx)
    orphans = p.get('orphanNumbers', [])
    by_scene = {}
    for c in cl:
        for sc in c.get('shownIn', []) + [s.get('scene') for s in c.get('spoken', [])]:
            by_scene.setdefault(sc, []).extend(claim_canons(c))
    unreg = []
    for s in ctx.sentences():
        have = by_scene.get(s['scene'], [])
        for cn, span in numbers_in_text(s['text']):
            if not canon_matches(cn, have):
                unreg.append((s.get('id'), span))
    nof = [c['claimId'] for c in cl if not (c.get('formula') or '').strip()]
    unsrc = [c['claimId'] for c in cl if not c.get('source') and not c.get('illustrative')]
    noyear = [c['claimId'] for c in cl if c.get('source') and c.get('historical', True) and not (c.get('dataYear') or c.get('dataYears'))]
    ms = [metric('orphan numbers on screen', len(orphans), '<=', 0), metric('unregistered numbers in narration', len(unreg), '<=', 0),
          metric('claims without formula', len(nof), '<=', 0), metric('unsourced non-illustrative claims', len(unsrc), '<=', 0),
          metric('sourced claims without dataYear', len(noyear), '<=', 0)]
    return verdict('S07', ms, details=[{'orphans': orphans[:10], 'unregistered': unreg[:10], 'noFormula': nof[:10], 'unsourced': unsrc[:10], 'noYear': noyear[:10]}])


@rule('S08', '§1.5 (C rule 9, upgraded)', 'page sampler, every 0.1 s and every frame in ±0.5 s around each first appearance: frames where an illustrative claim span is visible '
      '(opacity > 0.5, on frame) but no ILLUSTRATIVE badge is visible; and badge lag = first frame the claim is visible − first frame a badge is visible in that scene',
      '0 frames without badge; badge never later than the number (lag ≤ 0 frames)')
def s08_badge(ctx):
    r = page(ctx)['rules'].get('S08')
    if r is None:
        raise Missing('page rule S08 in out/checks/page.json')
    return verdict('S08', [metric('frames without badge', r['framesWithout'], '<=', 0), metric('max badge lag frames', r['maxLagFrames'], '<=', 0)],
                   details=r.get('examples', [])[:10])


BASIS = {'real': re.compile(r"\breal\b|inflation[- ]adjusted|today'?s dollars|\b(19|20)\d\d dollars\b|after inflation", re.I),
         'nominal': re.compile(r'\bnominal\b|before inflation|dollars of the day|then-year', re.I)}


@rule('S09', '§1.5', 'claims whose display contains "$" must declare basis nominal|real. Screen (page sampler): whenever a $ claim is visible, a visible text in the same '
      'text block or within 300 px carries its basis word (BASIS regex). Narration: the sentence with the $ number, or the one before it in the same scene, carries the basis word',
      '0 money claims without basis; 0 frames missing the on-screen basis; 0 narration sentences missing it')
def s09_basis(ctx):
    cl = ctx.claims()
    money = [c for c in cl if '$' in str(c.get('display', ''))]
    nob = [c['claimId'] for c in money if c.get('basis') not in ('nominal', 'real')]
    r = page(ctx)['rules'].get('S09', {'framesMissing': None})
    sents = ctx.sentences()
    miss = []
    basis_of = {}
    for c in money:
        for cn in claim_canons(c):
            basis_of.setdefault(cn, set()).add(c.get('basis'))
    for i, s in enumerate(sents):
        for cn, span in numbers_in_text(s['text']):
            if not cn.startswith('usd:'):
                continue
            bs = basis_of.get(cn, {None})
            prev = sents[i - 1]['text'] if i and sents[i - 1]['scene'] == s['scene'] else ''
            if not any(b and (BASIS[b].search(s['text']) or BASIS[b].search(prev)) for b in bs):
                miss.append((s.get('id'), span))
    return verdict('S09', [metric('money claims without basis', len(nob), '<=', 0), metric('frames missing basis on screen', r.get('framesMissing'), '<=', 0),
                           metric('narration $ without basis', len(miss), '<=', 0)], details=[{'noBasis': nob[:10], 'narration': miss[:10], 'screen': r.get('examples', [])[:5]}])


ADVICE = [r"\byou (should|must|need to|ought to|have to|'d better)\b", r'\b(we|i) (recommend|suggest|advise)\b', r'\b(should|must) (you|retirees|investors|everyone)\b',
          r'^(consider|make sure|don\'t|do not|avoid|invest|buy|sell|choose|pick|keep|start|stop|never|always|talk to|plan)\b',
          r'\b(the right|a safe|the safe) (withdrawal )?(rate|amount)\b', r'\bsafe withdrawal rate\b']
FORECAST = [r'\b(will|is going to|are going to)\b[^.]{0,40}\b(rise|fall|crash|return|grow|drop|outperform|underperform|recover|beat)\b',
            r'\b(next|coming) (year|decade|few years|ten years|30 years)\b', r'\bthe market will\b', r'\b(we|i) (expect|predict|forecast)\b',
            r'\bfuture returns (will|are likely)\b']
FOUR = [r'\b4(\.0)?%[^.]{0,30}\b(is|was) (safe|right|enough|the rule|recommended)\b', r'\b4(\.0)?% rule\b', r'\bfour percent rule\b']
WE_BAD = [r'\bwe (all|should|need|must|retire|save|invest|spend|can\'t afford|want to retire)\b', r'\bour (retirement|savings|portfolio|money|future|nest egg)\b',
          r'\blet\'?s (retire|invest|save)\b', r'\bus (retirees|investors|savers)\b']


@rule('S10', '§1.6', 'every narration sentence (out/script.json text) and every visible on-screen text, lower-cased, against locked regex lists: ADVICE, FORECAST, FOUR (4% as a recommendation), '
      'WE_BAD ("we/our/us" used for the viewer); required phrases "US only" and "history, not a forecast" (narration or screen)',
      '0 matches of ADVICE, FORECAST, FOUR, WE_BAD; both required phrases present')
def s10_identity(ctx):
    texts = [('narration', s.get('id'), s['text']) for s in ctx.sentences()]
    if ctx.has('out/checks/page.json'):
        seen = set()
        for t, sc, tx in visible_texts(ctx):
            if tx not in seen:
                seen.add(tx)
                texts.append(('screen', sc, tx))
    hits = {'advice': [], 'forecast': [], 'four': [], 'we': []}
    for src, sid, tx in texts:
        low = tx.lower().replace('’', "'")
        low_nf = re.sub(r"(not|n't|never|isn't|is not) a forecast", '', low)
        for k, pats in (('advice', ADVICE), ('forecast', FORECAST), ('four', FOUR), ('we', WE_BAD)):
            for p in pats:
                if re.search(p, low_nf if k == 'forecast' else low, re.M):
                    hits[k].append((src, sid, tx[:90]))
                    break
    alltext = ' '.join(t[2] for t in texts)
    us = bool(re.search(r'\bU\.?S\.? only\b', alltext, re.I))
    hist = bool(re.search(r'history,? not a forecast', alltext, re.I))
    ms = [metric('advice sentences', len(hits['advice']), '<=', 0), metric('forecast sentences', len(hits['forecast']), '<=', 0),
          metric('4% as recommendation', len(hits['four']), '<=', 0), metric('"we" for the viewer', len(hits['we']), '<=', 0),
          metric('"US only" stated', us, '==', True), metric('"history, not a forecast" stated', hist, '==', True)]
    return verdict('S10', ms, details=[{k: v[:5] for k, v in hits.items()}])


@rule('S11', '§2.4', 'claims with core=true. Appearances = distinct scenes where the claim is visible (page sampler) or spoken (heard by own ASR in that scene\'s narration window). '
      'Declared callbacks[] each need scene + distinct non-empty meaning, and must be real appearances',
      '≥ 1 core claim; each core claim appears in ≥ 3 distinct scenes spanning ≥ 2 acts; ≥ 3 declared callbacks with distinct meanings, all verified')
def s11_callback(ctx):
    core = [c for c in ctx.claims() if c.get('core')]
    p = page(ctx)
    seen = p.get('claimScenes', {})
    asr = asr_master(ctx)
    acts = scene_acts(ctx)
    ms = [metric('core claims', len(core), '>=', 1)]
    det = []
    for c in core:
        scenes = set(seen.get(c['claimId'], []))
        want = claim_canons(c)
        for s in ctx.sentences():
            if any(canon_matches(w, [x for x, _ in numbers_in_text(s['text'])]) for w in want):
                heard = spoken_numbers(asr_join([w for w in asr if s['start'] - 1 <= w['start'] <= s['end'] + 1]))
                if any(canon_matches(w, heard) for w in want):
                    scenes.add(s['scene'])
        cb = c.get('callbacks', [])
        meanings = [x.get('meaning', '').strip().lower() for x in cb]
        verified = [x for x in cb if x.get('scene') in scenes]
        ms += [metric(f'{c["claimId"]} scenes', len(scenes), '>=', 3), metric(f'{c["claimId"]} acts', len({acts.get(s) for s in scenes}), '>=', 2),
               metric(f'{c["claimId"]} callbacks w/ distinct meaning', len({m for m in meanings if m}), '>=', 3),
               metric(f'{c["claimId"]} callbacks unverified', len(cb) - len(verified), '<=', 0)]
        det.append({'claim': c['claimId'], 'scenes': sorted(scenes)})
    return verdict('S11', ms, details=det)


def first_appearance(ctx):
    """claimId -> first time shown (page sampler) or said (sentence start of the first narration sentence carrying its value)."""
    p = page(ctx)
    first = {k: v for k, v in p.get('claimFirst', {}).items()}
    for c in ctx.claims():
        want = claim_canons(c)
        for s in ctx.sentences():
            if any(canon_matches(w, [x for x, _ in numbers_in_text(s['text'])]) for w in want):
                first[c['claimId']] = min(first.get(c['claimId'], 1e9), s['start'])
                break
    return first


@rule('S12', '§2.5', 'new number = first appearance (screen or narration) of a claim; axis-role claims (role "axis", only ever shown as axis labels/anchors per the page sampler) excluded. '
      'Scene of a new number = scene containing its first-appearance time',
      'new numbers ≤ duration / 8 s; no scene with > 2 new numbers; 0 claims marked axis but shown outside axis labels')
def s12_density(ctx):
    first = first_appearance(ctx)
    cl = {c['claimId']: c for c in ctx.claims()}
    p = page(ctx)
    misuse = [k for k, roles in p.get('claimRoles', {}).items() if cl.get(k, {}).get('role') == 'axis' and any(r not in ('axis-label', 'anchor') for r in roles)]
    news = [(t, k) for k, t in first.items() if k in cl and cl[k].get('role') != 'axis' and t < 1e9]
    scenes = ctx.scenes()
    per = {}
    for t, k in news:
        sc = next((s['id'] for s in scenes if s['start'] <= t < s['start'] + s['dur']), scenes[-1]['id'])
        per.setdefault(sc, []).append(k)
    worst = max((len(v) for v in per.values()), default=0)
    total = ctx.total()
    return verdict('S12', [metric('new numbers', len(news), '<=', total / 8), metric('max new numbers in a scene', worst, '<=', 2),
                           metric('axis claims shown outside axes', len(misuse), '<=', 0)],
                   details=[{'limit': round(total / 8, 1), 'crowded': {k: v for k, v in per.items() if len(v) > 2}}])


@rule('S13', '§2.6', 'sentence length = words in each out/script.json sentence text; coefficient of variation = population std / mean', 'CV ≥ 0.35')
def s13_sentence_cv(ctx):
    n = np.array([len(words(s['text'])) for s in ctx.sentences()], float)
    cv = float(n.std() / n.mean()) if len(n) else None
    return verdict('S13', [metric('sentence length CV', cv, '>=', 0.35)], details=[{'sentences': len(n), 'mean': round(float(n.mean()), 1) if len(n) else None}])


@rule('S14', '§2.8', 'out/adbreaks.json times; act boundaries from out/timeline.json acts; natural silence = span where the master RMS (50 ms/10 ms) stays ≤ −40 dBFS',
      '2 … 3 breaks; each within ±1.0 s of a boundary between two acts (not inside cold open/ident); each inside a silence ≥ 1.0 s')
def s14_adbreaks(ctx):
    br = ctx.json('out/adbreaks.json')['breaks']
    br = [b['t'] if isinstance(b, dict) else b for b in br]
    acts = ctx.acts()
    bounds = [a['start'] for a in acts if a['id'] not in ('cold-open', 'ident', 'act1')]
    sp = silent_spans(master(ctx))
    bad_b = [b for b in br if not bounds or min(abs(b - x) for x in bounds) > 1.0]
    bad_s = [b for b in br if not any(a <= b <= e and e - a >= 1.0 for a, e in sp)]
    return verdict('S14', [metric('ad breaks', len(br), 'in', [2, 3]), metric('breaks off an act boundary', len(bad_b), '<=', 0),
                           metric('breaks without ≥1 s silence', len(bad_s), '<=', 0)], details=[{'breaks': br, 'boundaries': bounds}])


ORDER = ['cold-open', 'ident', 'act1', 'act2', 'act3', 'method', 'outro']


@rule('S15', '§0, §2.1', 'out/timeline.json acts[] (id, start, end) and scenes[].act; acts contiguous and in the brief\'s order',
      'order cold-open, ident, act1, act2, act3, method, outro; cold open ≤ 15 s; ident ≤ 3 s; outro ≥ 20 s; timeline total ≥ 600 s; every scene inside its act')
def s15_structure(ctx):
    acts = ctx.acts()
    ids = [a['id'] for a in acts]
    d = {a['id']: a['end'] - a['start'] for a in acts}
    gaps = [(a['id'], b['id']) for a, b in zip(acts, acts[1:]) if abs(a['end'] - b['start']) > 1e-3]
    by = {a['id']: a for a in acts}
    outside = [s['id'] for s in ctx.scenes() if s.get('act') not in by or s['start'] < by[s['act']]['start'] - 1e-3 or s['start'] + s['dur'] > by[s['act']]['end'] + 1e-3]
    ms = [metric('act order', ids, '==', ORDER), metric('cold open s', d.get('cold-open'), '<=', 15.0, 's'), metric('ident s', d.get('ident'), '<=', 3.0, 's'),
          metric('outro s', d.get('outro'), '>=', 20.0, 's'), metric('total s', ctx.total(), '>=', 600.0, 's'), metric('act gaps', len(gaps), '<=', 0),
          metric('scenes outside their act', len(outside), '<=', 0)]
    return verdict('S15', ms, details=[{'gaps': gaps, 'outside': outside[:10]}])
