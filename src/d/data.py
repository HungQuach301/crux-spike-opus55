"""Test D data: normalize the committed raw files and write data/sources.json.

Primary: Damodaran (NYU Stern) histretSP.xls, sheet "Returns by year" (S&P 500 incl. dividends, US T.Bond 10-year)
and sheet "Inflation Rate" (CPI-U NSA, December over December, from FRED).
Cross-check: FRED CPIAUCNS monthly -> December-over-December inflation, computed here independently.
Second stock source: Shiller ie_data.xls (www.econ.yale.edu, reachable over http only; the file ends in 2023),
annual total return December to December from monthly prices with monthly dividends (D/12) reinvested -> stocks2.csv.

Writes data/normalized/annual.csv, data/normalized/fred_inflation.csv, data/sources.json.
"""
import csv
import hashlib
import json
import os

import numpy as np
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
    {'path': 'data/raw/shiller_ie_data.xls', 'role': 'crosscheck', 'url': 'http://www.econ.yale.edu/~shiller/data/ie_data.xls',
     'what': 'Robert J. Shiller, U.S. Stock Markets 1871-Present and CAPE Ratio (monthly S&P Composite price = average of daily closes, dividends); this copy ends in 2023',
     'terms': {'quote': 'The data and CAPE Ratio on this spreadsheet were developed by Robert J. Shiller using various public sources.  Neither Robert J. Shiller nor any affiliates or consultants, are registered investment advisers and do not guarantee the accuracy or completeness of the CAPE Ratio here, or any data or methodology either included therein or upon which it is based.',
               'status': 'No explicit licence or usage terms found on the data page or in the workbook; the quote is the workbook "Disclaimer" sheet. Used only as a cross-check, never shown on screen.',
               'url': 'http://www.econ.yale.edu/~shiller/data.htm', 'snapshot': 'data/terms/shiller-data.html'}},
]
DOWNLOADED_BY_PATH = {'data/raw/shiller_ie_data.xls': '2026-09-26'}


def shiller_tr():
    b = xlrd.open_workbook(os.path.join(RAW, 'shiller_ie_data.xls'))
    s = b.sheet_by_name('Data')
    assert s.row_values(7)[:3] == ['Date', 'P', 'D'], s.row_values(7)[:3]
    P, Dv = {}, {}
    for r in range(8, s.nrows):
        v = s.row_values(r)
        if isinstance(v[0], float) and isinstance(v[1], float):
            y = int(v[0]); m = int(round((v[0] - y) * 100))
            P[(y, m)] = v[1]
            if isinstance(v[2], float):
                Dv[(y, m)] = v[2]
    out = {}
    for y in range(FIRST, LAST + 1):
        try:
            g = 1.0
            for m in range(1, 13):
                prev = (y - 1, 12) if m == 1 else (y, m - 1)
                g *= (P[(y, m)] + Dv[(y, m)] / 12) / P[prev]
            out[y] = g - 1
        except KeyError:
            pass  # month missing in this copy of the file
    return out


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
    sh = shiller_tr()
    with open(os.path.join(NORM, 'stocks2.csv'), 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['year', 'stocks'])
        for y in sorted(sh):
            w.writerow([y, repr(sh[y])])
    sdiff = {y: abs(ret[y][0] - sh[y]) * 100 for y in sh}
    mism += [{'year': y, 'series': 'stocks', 'diff_pp': round(d, 3), 'damodaran': round(ret[y][0], 5), 'shiller': round(sh[y], 5),
              'note': 'Damodaran (year-end index level + dividends) vs Shiller (monthly-average prices, Dec to Dec, dividends reinvested monthly): outside tolerance; reported, not resolved'}
             for y, d in sorted(sdiff.items()) if d > TOL_STOCKS_PP]
    smissing = [y for y in range(FIRST, LAST + 1) if y not in sh]
    both = sorted(y for y in sh if y in ret)
    same_dir = sum((sh[y] > 0) == (ret[y][0] > 0) for y in both)
    g = lambda xs: np.prod([1 + x for x in xs]) ** (1 / len(xs)) - 1
    wins = [y for y in range(FIRST, LAST + 1) if all(k in sh for k in range(y, y + 30))]
    wdiff = {y: (g([ret[k][0] for k in range(y, y + 30)]) - g([sh[k] for k in range(y, y + 30)])) * 100 for y in wins}
    descriptive = {'yearsBoth': len(both), 'sameDirectionYears': same_dir, 'sameDirectionShare': round(same_dir / len(both), 3),
                   'windows30': [wins[0], wins[-1]], 'windowsCompared': len(wins),
                   'geomeanDiffPp': {'meanAbs': round(float(np.mean(np.abs(list(wdiff.values())))), 3), 'maxAbs': round(float(max(abs(v) for v in wdiff.values())), 3),
                                     'maxAbsStart': max(wdiff, key=lambda y: abs(wdiff[y])), 'start1966': round(wdiff[1966], 3)},
                   'note': 'Descriptive only: 30-year geometric means (Damodaran minus Shiller) of S&P total return for every window with data in both sources.'}
    internal = sorted(((y, round(abs(I[y] - I2[y]) * 100, 3)) for y in range(FIRST, LAST + 1) if y in I2 and abs(I[y] - I2[y]) * 100 > TOL_INFLATION_PP), key=lambda x: -x[1])
    src = {
        'files': [{**f, 'sha256': sha(f['path']), 'downloaded': DOWNLOADED_BY_PATH.get(f['path'], DOWNLOADED)} for f in FILES],
        'tolerance': {'inflation_pp': TOL_INFLATION_PP, 'stocks_pp': TOL_STOCKS_PP},
        'yearsUsed': [FIRST, LAST],
        'mismatches': mism,
        'crosscheck': {
            'inflation': {'method': 'FRED CPIAUCNS December(y) / December(y-1) - 1, vs Damodaran "Inflation Rate" sheet',
                          'maxDiffPp': round(max(diffs.values()), 4), 'maxDiffYear': max(diffs, key=diffs.get), 'yearsCompared': len(diffs)},
            'stocks': {'method': 'Shiller monthly S&P Composite: prod over Jan..Dec of (P_m + D_m/12) / P_(m-1), vs Damodaran S&P 500 incl. dividends',
                       'yearsCompared': len(sdiff), 'yearsOutsideTolerance': sum(d > TOL_STOCKS_PP for d in sdiff.values()),
                       'medianDiffPp': round(sorted(sdiff.values())[len(sdiff) // 2], 3), 'maxDiffPp': round(max(sdiff.values()), 3), 'maxDiffYear': max(sdiff, key=sdiff.get),
                       'yearsMissingInCrosscheck': smissing, 'descriptive': descriptive,
                       'decision': 'Owner decision 2026-09-26: S04 is accepted as failing (method difference + file ends 09/2023); no further domains are opened; the model keeps Damodaran.',
                       'why': 'Shiller prices are monthly averages of daily closes, Damodaran uses year-end levels: the two definitions differ by construction, so most years exceed 0.5 pp. '
                              'The copy reachable at www.econ.yale.edu (http) ends in September 2023; the maintained file is on shillerdata.com, which the egress proxy refuses (connection reset).'},
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
