"""Test D data: normalize the committed raw files and write data/sources.json.

Primary: Damodaran (NYU Stern) histretSP.xls, sheet "Returns by year" (S&P 500 incl. dividends, US T.Bond 10-year)
and sheet "Inflation Rate" (CPI-U NSA, December over December, from FRED).
Cross-check: FRED CPIAUCNS monthly -> December-over-December inflation, computed here independently.
A second stock-return source was not reachable (see NOTES in sources.json); no stocks2.csv is written.

Writes data/normalized/annual.csv, data/normalized/fred_inflation.csv, data/sources.json.
"""
import csv
import hashlib
import json
import os

import xlrd

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
RAW = os.path.join(ROOT, 'data', 'raw')
NORM = os.path.join(ROOT, 'data', 'normalized')
FIRST, LAST = 1928, 2025
TOL_INFLATION_PP = 0.10
TOL_STOCKS_PP = 0.50

DOWNLOADED = '2026-09-26'
FILES = [
    {'path': 'data/raw/histretSP.xls', 'role': 'primary', 'url': 'https://pages.stern.nyu.edu/~adamodar/pc/datasets/histretSP.xls',
     'what': 'Damodaran, Historical Returns on Stocks, Bonds and Bills: 1928-2025 (data updated January 2026)',
     'terms': {'quote': 'I hope you find this data useful and there are no strings attached.',
               'also': 'I am not good at making rules and thus have very few related to the use of my data. I want the data to be widely used and to be a help, rather than a hindrance.',
               'url': 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datahistory.html', 'snapshot': 'data/terms/damodaran-datahistory.html'}},
    {'path': 'data/raw/histretSP.html', 'role': 'primary', 'url': 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html',
     'what': 'HTML view of the same table (kept for reference; not parsed)',
     'terms': {'quote': 'I hope you find this data useful and there are no strings attached.',
               'url': 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datahistory.html'}},
    {'path': 'data/raw/fred_CPIAUCNS.csv', 'role': 'crosscheck', 'url': 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS',
     'what': 'U.S. Bureau of Labor Statistics, CPI for All Urban Consumers: All Items in U.S. City Average [CPIAUCNS], monthly, NSA, retrieved from FRED',
     'terms': {'quote': 'Public Domain: Citation requested These series may be under copyright or in the public domain and may be used without permission, provided you do not engage in any prohibited use.',
               'status': 'Series page shows "Public Domain: Citation Requested"; citation used: "Source: BLS via FRED".',
               'url': 'https://fred.stlouisfed.org/legal/', 'snapshot': 'data/terms/fred-legal.html', 'series': 'data/terms/fred-CPIAUCNS.html'}},
]


def sha(p):
    return hashlib.sha256(open(os.path.join(ROOT, p), 'rb').read()).hexdigest()


def damodaran():
    b = xlrd.open_workbook(os.path.join(RAW, 'histretSP.xls'))
    s = b.sheet_by_name('Returns by year')
    hdr = s.row_values(19)
    assert hdr[0] == 'Year' and hdr[1].startswith('S&P 500 (includes dividends)') and hdr[4].startswith('US T. Bond'), hdr[:5]
    ret = {}
    for r in range(20, s.nrows):
        v = s.row_values(r)
        if isinstance(v[0], float) and FIRST <= v[0] <= LAST:
            ret[int(v[0])] = (float(v[1]), float(v[4]))
    inf = b.sheet_by_name('Inflation Rate')
    assert inf.row_values(10)[1] == 'CPIAUCNS'
    I = {int(v[0]): float(v[2]) for v in (inf.row_values(r) for r in range(11, inf.nrows)) if isinstance(v[0], float)}
    # the workbook's "Nominal vs Real Data" sheet carries a second inflation column that differs in some years; kept for the note
    nr = b.sheet_by_name('Nominal vs Real Data')
    I2 = {int(v[0]): float(v[4]) for v in (nr.row_values(r) for r in range(1, nr.nrows)) if isinstance(v[0], float)}
    return ret, I, I2


def fred_decdec():
    m = {}
    for row in csv.DictReader(open(os.path.join(RAW, 'fred_CPIAUCNS.csv'))):
        if row['CPIAUCNS']:
            m[row['observation_date']] = float(row['CPIAUCNS'])
    return {y: m[f'{y}-12-01'] / m[f'{y - 1}-12-01'] - 1 for y in range(FIRST, LAST + 1) if f'{y}-12-01' in m and f'{y - 1}-12-01' in m}


def main():
    ret, I, I2 = damodaran()
    fred = fred_decdec()
    os.makedirs(NORM, exist_ok=True)
    with open(os.path.join(NORM, 'annual.csv'), 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['year', 'stocks', 'bonds', 'inflation'])
        for y in range(FIRST, LAST + 1):
            w.writerow([y, repr(ret[y][0]), repr(ret[y][1]), repr(I[y])])
    with open(os.path.join(NORM, 'fred_inflation.csv'), 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['year', 'inflation'])
        for y in range(FIRST, LAST + 1):
            w.writerow([y, repr(fred[y])])
    diffs = {y: abs(I[y] - fred[y]) * 100 for y in range(FIRST, LAST + 1)}
    mism = [{'year': y, 'series': 'inflation', 'diff_pp': round(d, 4), 'note': 'Damodaran vs FRED Dec/Dec outside tolerance'} for y, d in diffs.items() if d > TOL_INFLATION_PP]
    internal = sorted(((y, round(abs(I[y] - I2[y]) * 100, 3)) for y in range(FIRST, LAST + 1) if y in I2 and abs(I[y] - I2[y]) * 100 > TOL_INFLATION_PP), key=lambda x: -x[1])
    src = {
        'files': [{**f, 'sha256': sha(f['path']), 'downloaded': DOWNLOADED} for f in FILES],
        'tolerance': {'inflation_pp': TOL_INFLATION_PP, 'stocks_pp': TOL_STOCKS_PP},
        'yearsUsed': [FIRST, LAST],
        'mismatches': mism,
        'crosscheck': {
            'inflation': {'method': 'FRED CPIAUCNS December(y) / December(y-1) - 1, vs Damodaran "Inflation Rate" sheet',
                          'maxDiffPp': round(max(diffs.values()), 4), 'maxDiffYear': max(diffs, key=diffs.get), 'yearsCompared': len(diffs)},
            'stocks': {'status': 'not run', 'reason': 'no independent annual S&P 500 total-return source reachable from this environment: '
                       'www.econ.yale.edu (Shiller ie_data.xls) answered 403 "Host not in allowlist"; shillerdata.com and www.slickcharts.com were refused at CONNECT by the egress proxy. '
                       'FRED carries the S&P 500 index for the last 10 years only (price, licensed), not total return back to 1928. Domains to allow if a second stock source is wanted: www.econ.yale.edu or shillerdata.com.'},
        },
        'notes': [
            'Inflation is taken from the workbook sheet "Inflation Rate" (CPI-U NSA, Dec/Dec, sourced by Damodaran from FRED). '
            'The workbook sheet "Nominal vs Real Data" has a different inflation column that differs from it by more than 0.10 pp in %d years (largest: %s); that sheet is not used.' % (len(internal), internal[:5]),
            'The 10-year Treasury return is Damodaran\'s: a par bond at the prior year-end yield repriced at the new yield with maturity kept at 10 years, plus coupon.',
        ],
    }
    json.dump(src, open(os.path.join(ROOT, 'data', 'sources.json'), 'w'), indent=1)
    print('annual rows', LAST - FIRST + 1, '| inflation max diff pp', src['crosscheck']['inflation'], '| mismatches', len(mism), '| internal', internal[:5])


if __name__ == '__main__':
    main()
