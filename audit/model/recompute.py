"""Independent recomputation of every act-2/act-3 narration number from data/raw/histretSP.xls (Damodaran, primary).
Model per BRIEF-D §1.2: 60/40 S&P 500 incl. dividends / 10-y T.Bond, annual rebalance, withdrawal at the start of year,
year 1 = 4% of $1,000,000, later years x (1 + previous year's inflation), 30 years, no tax, no fee.
Real = deflated by cumulative CPI inflation since the start of year 1 (start-year dollars)."""
import json, sys
import numpy as np, xlrd
RAW = sys.argv[1]
b = xlrd.open_workbook(RAW)
sh = b.sheet_by_name('Returns by year')
R = {}
for r in range(sh.nrows):
    try:
        y = int(float(sh.cell_value(r, 0)))
    except (ValueError, TypeError):
        continue
    if 1928 <= y <= 2025 and sh.cell_value(r, 1) != '':
        R[y] = [float(sh.cell_value(r, 1)), float(sh.cell_value(r, 4))]
si = b.sheet_by_name('Inflation Rate')
for r in range(si.nrows):
    try:
        y = int(float(si.cell_value(r, 0)))
    except (ValueError, TypeError):
        continue
    if y in R:
        R[y].append(float(si.cell_value(r, 2)))
assert all(len(v) == 3 for v in R.values()) and sorted(R) == list(range(1928, 2026))
port = lambda y: 0.6 * R[y][0] + 0.4 * R[y][1]
inf = lambda y: R[y][2]


def sim(rets, infl, init=1e6):
    """rets, infl: 30 yearly values. Returns per-year dicts."""
    B, W, P, out, dep = init, 0.04 * init, 1.0, [], None
    for k in range(30):
        if k:
            W *= 1 + infl[k - 1]
        start = B
        take = min(W, B)
        if B < W and dep is None:
            dep = k + 1
        B = (B - take) * (1 + rets[k])
        Pstart = P
        P *= 1 + infl[k]
        out.append(dict(k=k + 1, start=start, W=W, take=take, end=B, endReal=B / P, startReal=start / Pstart, P=P))
    return out, dep


def window(y0):
    ys = range(y0, y0 + 30)
    return [port(y) for y in ys], [inf(y) for y in ys]


r66, i66 = window(1966)
p66, d66 = sim(r66, i66)
pm, dm = sim(r66[::-1], i66)  # mirror: returns reversed, inflation in calendar order (D's declared choice)
pm2, _ = sim(r66[::-1], i66[::-1])  # alternative: inflation reversed too
geo = lambda xs: float(np.prod([1 + x for x in xs]) ** (1 / len(xs)) - 1)
rgeo = lambda rs, ins: float(np.prod([(1 + r) / (1 + i) for r, i in zip(rs, ins)]) ** (1 / len(rs)) - 1)
out = {}
out['ret1966 (loss)'] = -port(1966) * 100
out['ret1995m'] = port(1995) * 100
out['inf1969'] = inf(1969) * 100
for y in (1973, 1974):
    out[f'real stocks {y}'] = ((1 + R[y][0]) / (1 + inf(y)) - 1) * 100
    out[f'real bonds {y}'] = ((1 + R[y][1]) / (1 + inf(y)) - 1) * 100
out['loss1974'] = -port(1974) * 100
out['inf1974'] = inf(1974) * 100
out['bal74 (1966 path endReal 1974)'] = p66[8]['endReal']
out['bal74m (mirror endReal 1974)'] = pm[8]['endReal']
out['bal74m if inflation also reversed'] = pm2[8]['endReal']
out['ret1975'] = port(1975) * 100
out['ret1976'] = port(1976) * 100
out['inf1979'] = inf(1979) * 100
out['wd1981 nominal'] = p66[15]['W']
out['wd1981 real'] = p66[15]['W'] / p66[14]['P']
out['ret1982'] = port(1982) * 100
out['share1982 (W/start balance)'] = p66[16]['W'] / p66[16]['start'] * 100
gains = [1966 + x['k'] - 1 for x in p66 if r66[x['k'] - 1] > 0.10 and x['endReal'] < x['startReal']]
gains_before_dep = [y for y in gains if y < 1966 + d66 - 1]
out['gainsFell years (>10% gain, endReal < startReal)'] = gains
out['gainsFell count'] = len(gains)
out['gainsFell count, only years with money left after the withdrawal'] = len([1966 + x['k'] - 1 for x in p66 if r66[x['k'] - 1] > 0.10 and x['endReal'] < x['startReal'] and x['start'] > x['W']])
out['gainsFell years where end nominal also fell'] = [1966 + x['k'] - 1 for x in p66 if r66[x['k'] - 1] > 0.10 and x['end'] < x['start']]
gaps = [pm[k]['endReal'] - p66[k]['endReal'] for k in range(30)]
out['gap peak year'] = 1966 + int(np.argmax(gaps))
out['gap86'] = max(gaps)
out['years49'] = max(gaps) / 40000
out['depletion year 1966 path'] = 1966 + d66 - 1
out['last91 (payout in depletion year)'] = p66[d66 - 1]['take']
out['full withdrawal 1991'] = p66[d66 - 1]['W']
out['empty years'] = 30 - d66
out['mirror endNominal'] = pm[29]['end']
out['mirror endReal'] = pm[29]['endReal']
out['g1966'] = geo(r66) * 100
out['gmirror'] = geo(r66[::-1]) * 100
starts = {}
for y0 in range(1928, 1997):
    rs, ins = window(y0)
    p, d = sim(rs, ins)
    starts[y0] = dict(dep=d, endReal=p[29]['endReal'], rg=rgeo(rs, ins), dec=rgeo(rs[:10], ins[:10]))
out['n start years'] = len(starts)
out['lasted 30 (no depletion)'] = sum(1 for v in starts.values() if v['dep'] is None)
out['depleted start years'] = [y for y, v in starts.items() if v['dep']]
out['end1982 real'] = starts[1982]['endReal']
out['less than start (endReal<1e6)'] = sum(1 for v in starts.values() if v['endReal'] < 1e6)
out['rg1966'] = starts[1966]['rg'] * 100
low = [y for y, v in starts.items() if v['rg'] < starts[1966]['rg'] and v['dep'] is None]
out['lower real avg than 1966 and never ran out'] = [len(low), low]
out['rg1969'] = starts[1969]['rg'] * 100
out['rg1928'] = starts[1928]['rg'] * 100
out['end1928 real'] = starts[1928]['endReal']
out['dep1969'] = starts[1969]['dep']
out['1929 never ran out'] = starts[1929]['dep'] is None
out['dec1929 (real geo 1929-38)'] = starts[1929]['dec'] * 100
out['depleted: first-decade real geo'] = {y: round(starts[y]['dec'] * 100, 2) for y in out['depleted start years']}
out['dec1966'] = starts[1966]['dec'] * 100
out['decm (mirror returns 1995..1986, inflation 1966..1975)'] = rgeo(r66[::-1][:10], i66[:10]) * 100
from scipy.stats import spearmanr
er = [v['endReal'] for v in starts.values()]
out['spearman endReal~30y real return'] = spearmanr(er, [v['rg'] for v in starts.values()]).statistic
out['spearman endReal~first-decade real return'] = spearmanr(er, [v['dec'] for v in starts.values()]).statistic
out['years of data'] = len(R)
out['1929 path: any year withdrawals shrank (deflation)'] = [1929 + k for k in range(30) if window(1929)[1][k] < 0][:6]
print(json.dumps(out, indent=1, default=float))
json.dump({'out': out, 'annual': R}, open(sys.argv[2], 'w'), indent=1, default=float)
