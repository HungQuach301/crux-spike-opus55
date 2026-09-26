"""Run every machine rule of BRIEF-D.md on a project root and write <root>/out/checks/report.json and report.md.

    python3 checks/py/run.py <root> [--only F01,A01] [--list]

Status: PASS | FAIL | MISSING (a contract artifact is absent: counts as not passed) | ERROR (rule crashed: counts as not passed).
`near` lists every metric within 5% of its threshold (brief §0: report metrics that only just meet a threshold)."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402
import r_file, r_audio, r_content, r_rhythm, r_visual, r_page  # noqa: E402,F401

ORDER = ['F', 'A', 'S', 'R', 'V', 'C', 'P']


def key(fn):
    rid = fn.rid
    return (ORDER.index(rid[0]), int(rid[1:]))


def registry():
    return [fn.meta for fn in sorted(common.RULES, key=key)]


def main():
    args = sys.argv[1:]
    if '--list' in args:
        print(json.dumps(registry(), indent=1, ensure_ascii=False))
        return
    root = args[0]
    only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
    ctx = common.Ctx(root)
    res = []
    for fn in sorted(common.RULES, key=key):
        if only and fn.rid not in only:
            continue
        t0 = time.time()
        r = common.safe(fn, ctx)
        r['section'] = fn.meta['section']
        r['threshold'] = fn.meta['threshold']
        r['seconds'] = round(time.time() - t0, 1)
        res.append(r)
        print(f"{r['id']:4} {r['status']:7} {r['seconds']:6}s  " + '; '.join(f"{m['name']}={m['value']}" for m in r['metrics'] if not m['pass'])[:200] + (('  ' + r['note']) if r.get('note') else ''), flush=True)
    near = [{'rule': r['id'], **m} for r in res for m in r['metrics'] if m.get('near')]
    counts = {s: sum(1 for r in res if r['status'] == s) for s in ('PASS', 'FAIL', 'MISSING', 'ERROR')}
    lock = open(os.path.join(os.path.dirname(__file__), '..', 'LOCK')).read().strip() if os.path.exists(os.path.join(os.path.dirname(__file__), '..', 'LOCK')) else None
    out = {'root': ctx.root, 'lock': lock, 'counts': counts, 'near': near, 'results': res}
    os.makedirs(ctx.path('out/checks'), exist_ok=True)
    name = 'report' if not only else 'report-partial'
    json.dump(out, open(ctx.path(f'out/checks/{name}.json'), 'w'), indent=1, ensure_ascii=False, default=str)
    with open(ctx.path(f'out/checks/{name}.md'), 'w') as f:
        f.write(f"# checks/ report\n\nroot: `{ctx.root}`  \nlock: `{lock}`  \n{counts}\n\n| rule | § | status | failing metrics |\n|---|---|---|---|\n")
        for r in res:
            bad = '; '.join(f"{m['name']} = {m['value']} (need {m['op']} {m['threshold']})" for m in r['metrics'] if not m['pass'])
            f.write(f"| {r['id']} | {r['section']} | {r['status']} | {bad or r.get('note') or ''} |\n")
        if near:
            f.write('\n## Metrics within 5% of a threshold\n\n' + '\n'.join(f"- {n['rule']} {n['name']} = {n['value']} (threshold {n['op']} {n['threshold']})" for n in near) + '\n')
    print(json.dumps(counts))


if __name__ == '__main__':
    main()
