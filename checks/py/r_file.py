"""§0 and §6 — the delivered file, measured from out/video.mp4 itself (ffprobe + decoded packets/frames)."""
import re

import numpy as np

from common import FPS, Missing, metric, rule, verdict, ffprobe, run, video_frames


def _streams(ctx):
    return ctx.memo(('probe',), lambda: ffprobe(ctx.video(), '-show_streams', '-show_format', '-show_chapters'))


def _vs(ctx):
    return next(s for s in _streams(ctx)['streams'] if s['codec_type'] == 'video')


def _as(ctx):
    s = [s for s in _streams(ctx)['streams'] if s['codec_type'] == 'audio']
    if not s:
        raise Missing('audio stream in out/video.mp4')
    return s[0]


def _packets(ctx, sel):
    def get():
        out = run(['ffprobe', '-v', 'error', '-select_streams', sel, '-show_entries', 'packet=pts,dts,duration,size,flags', '-of', 'csv=p=0', ctx.video()]).stdout
        rows = [r.split(',') for r in out.strip().splitlines() if r]
        return rows
    return ctx.memo(('packets', sel), get)


@rule('F01', '§0, §6', 'ffprobe of the video stream: codec, profile, pixel format, frame size, display aspect',
      'h264 / High / yuv420p / 1920×1080 / 16:9 (square pixels)')
def f01_video_format(ctx):
    v = _vs(ctx)
    sar = v.get('sample_aspect_ratio', '1:1')
    ms = [metric('codec', v['codec_name'], '==', 'h264'), metric('profile', v.get('profile'), '==', 'High'),
          metric('pix_fmt', v['pix_fmt'], '==', 'yuv420p'), metric('size', f"{v['width']}x{v['height']}", '==', '1920x1080'),
          metric('square pixels', sar in ('1:1', 'N/A', '0:1'), '==', True)]
    return verdict('F01', ms)


@rule('F02', '§0, §6', 'r_frame_rate and avg_frame_rate from the stream header, and every packet duration (PTS step) in stream time base',
      'both rates exactly 30/1 and every PTS step = 1/30 s (constant frame rate)')
def f02_cfr(ctx):
    v = _vs(ctx)
    tb = [int(x) for x in v['time_base'].split('/')]
    pts = sorted(int(r[0]) for r in _packets(ctx, 'v:0') if r[0] not in ('N/A', ''))
    d = np.diff(pts)
    step = tb[1] / tb[0] / FPS
    bad = int(np.sum(np.abs(d - step) > 0.5))
    ms = [metric('r_frame_rate', v['r_frame_rate'], '==', '30/1'), metric('avg_frame_rate', v['avg_frame_rate'], '==', '30/1'),
          metric('PTS steps != 1/30 s', bad, '<=', 0)]
    return verdict('F02', ms, details=[{'stepsSeen': {str(k): int(c) for k, c in zip(*np.unique(d, return_counts=True))}}])


@rule('F03', '§6', 'video packet PTS sorted: a repeated PTS is a duplicated frame, a step of k>1 frame periods is k-1 dropped frames; '
      'frame count compared with duration × 30', 'dropped = 0, duplicated = 0, first PTS = 0, |frames − duration×30| ≤ 1')
def f03_pts(ctx):
    v = _vs(ctx)
    tb = [int(x) for x in v['time_base'].split('/')]
    step = tb[1] / tb[0] / FPS
    pts = sorted(int(r[0]) for r in _packets(ctx, 'v:0') if r[0] not in ('N/A', ''))
    d = np.diff(pts)
    dup = int(np.sum(d == 0))
    dropped = int(np.sum(np.maximum(0, np.round(d / step) - 1)))
    dur = float(_streams(ctx)['format']['duration'])
    ms = [metric('dropped frames', dropped, '<=', 0), metric('duplicated frames', dup, '<=', 0),
          metric('first PTS', pts[0] if pts else None, '==', 0), metric('|frames - duration*30|', abs(len(pts) - dur * FPS), '<=', 1)]
    return verdict('F03', ms)


@rule('F04', '§6', 'video bitrate = sum of video packet sizes × 8 / stream duration (measured, not the header value)', '≥ 16 Mbps')
def f04_bitrate(ctx):
    pk = _packets(ctx, 'v:0')
    size = sum(int(r[3]) for r in pk)
    dur = len(pk) / FPS
    mbps = size * 8 / dur / 1e6
    return verdict('F04', [metric('video Mbps', mbps, '>=', 16.0, 'Mbps')])


@rule('F05', '§6', 'stream colour tags (color_primaries, color_transfer, color_space, color_range) + decoded luma codes of 1 frame/10 s: '
      'share of Y samples outside 16–235', 'all tags bt709, range tv (limited); Y outside 16–235 ≤ 0.1% of samples')
def f05_bt709(ctx):
    v = _vs(ctx)
    ms = [metric('color_primaries', v.get('color_primaries'), '==', 'bt709'), metric('color_transfer', v.get('color_transfer'), '==', 'bt709'),
          metric('color_space', v.get('color_space'), '==', 'bt709'), metric('color_range', v.get('color_range'), '==', 'tv')]
    n = out = 0
    for _, y in video_frames(ctx.video(), every=FPS * 10):
        n += y.size
        out += int(np.sum((y < 16) | (y > 235)))
    ms.append(metric('Y outside 16-235 (%)', 100 * out / max(1, n), '<=', 0.1, '%'))
    return verdict('F05', ms)


@rule('F06', '§6', 'ffprobe of the audio stream; bitrate = audio packet bytes × 8 / duration', 'AAC (LC), 48 kHz, 2 channels, measured ≥ 272 kbps (= 85% of the 320 kbps nominal: ffmpeg\'s native AAC at -b:a 320k measured 276 kbps on test C\'s master, so the measure allows its ABR undershoot but not a 256k or lower setting)')
def f06_audio_format(ctx):
    a = _as(ctx)
    pk = _packets(ctx, 'a:0')
    size = sum(int(r[3]) for r in pk)
    dur = float(a.get('duration') or _streams(ctx)['format']['duration'])
    kbps = size * 8 / dur / 1000
    ms = [metric('codec', a['codec_name'], '==', 'aac'), metric('sample_rate', int(a['sample_rate']), '==', 48000),
          metric('channels', int(a['channels']), '==', 2), metric('audio kbps', kbps, '>=', 272.0, 'kbps')]
    return verdict('F06', ms)


@rule('F07', '§0', 'container duration (ffprobe format.duration)', '≥ 600 s (10:00)')
def f07_duration(ctx):
    dur = float(_streams(ctx)['format']['duration'])
    return verdict('F07', [metric('duration s', dur, '>=', 600.0, 's')])


# ---- banding ------------------------------------------------------------------------------------
def banding_score(y, dark_max=80, min_run=12, win=240, blk=16):
    """Banding on dark gradients in one luma plane (uint8 codes).

    Dark gradient area: 240×240 tiles whose mean Y ≤ dark_max (≈ 25% brightness in limited range) and whose 16×16-block
    means fit a plane with residual RMS ≤ 1 code while the plane spans 2–40 codes (a smooth gradient: not flat fill, not an edge or pattern).
    In those tiles a band edge is the end of a run of ≥ min_run identical codes along a row or column that steps by exactly
    1–2 codes. Score = share of dark-gradient pixels lying in such runs. Grain or dither breaks the runs; a quantised
    gradient leaves wide flat steps."""
    h, w = y.shape
    yf = y.astype(np.int16)
    band_px = area = 0
    for ty in range(0, h - win + 1, win):
        for tx in range(0, w - win + 1, win):
            t = yf[ty:ty + win, tx:tx + win]
            if t.mean() > dark_max:
                continue
            s = t.reshape(win // blk, blk, win // blk, blk).mean(axis=(1, 3))
            # a smooth gradient: block means fit a plane closely and the plane spans ≥ 2 codes
            gy, gx = np.mgrid[: s.shape[0], : s.shape[1]]
            A = np.stack([gx.ravel(), gy.ravel(), np.ones(gx.size)], 1)
            coef, *_ = np.linalg.lstsq(A, s.ravel(), rcond=None)
            fit = A @ coef
            span = fit.max() - fit.min()
            if span < 2 or span > 40 or np.sqrt(np.mean((s.ravel() - fit) ** 2)) > 1.0:
                continue
            area += t.size
            for arr in (t, t.T):
                d = np.diff(arr, axis=1)
                nzr, nzc = np.nonzero(d)
                for r in range(arr.shape[0]):
                    cols = nzc[nzr == r]
                    edges = np.concatenate(([-1], cols))
                    L = np.diff(edges)  # run length ending at each change
                    step = np.abs(d[r, cols])
                    good = (L >= min_run) & (step >= 1) & (step <= 2)
                    band_px += L[good].sum() / 2  # counted in both directions
    return (band_px / area if area else 0.0), area


@rule('F08', '§4.4', 'decoded luma of 1 frame/2 s; banding score per frame (banding_score: 240 px tiles, mean Y ≤ 80, 16-px block means fitting a plane that spans 2–40 codes with residual ≤ 1 code; share of their pixels in flat runs ≥ 12 px ending in a 1–2 code step)',
      'worst frame ≤ 5% (frames with < 1% dark-gradient area are skipped)')
def f08_banding(ctx):
    worst, worst_t, n = 0.0, None, 0
    per = []
    for t, y in video_frames(ctx.video(), every=FPS * 2):
        sc, area = banding_score(y)
        if area < 0.01 * y.size:
            continue
        n += 1
        per.append((round(t, 1), round(sc * 100, 2)))
        if sc > worst:
            worst, worst_t = sc, t
    per.sort(key=lambda x: -x[1])
    return verdict('F08', [metric('worst banding (%)', worst * 100, '<=', 5.0, '%')], details=[{'framesJudged': n, 'worst': per[:5]}])


# ---- subtitles ----------------------------------------------------------------------------------
def parse_srt(text):
    blocks = re.split(r'\n\s*\n', text.strip().replace('\r', ''))
    out = []
    tt = lambda s: sum(float(x) * m for x, m in zip(s.replace(',', '.').split(':'), (3600, 60, 1)))
    for b in blocks:
        ls = b.strip().split('\n')
        if len(ls) < 2:
            continue
        m = re.match(r'(\S+)\s*-->\s*(\S+)', ls[1])
        if not m:
            continue
        out.append({'start': tt(m.group(1)), 'end': tt(m.group(2)), 'lines': ls[2:]})
    return out


def norm_words(s):
    return re.sub(r'\s+', ' ', s.replace('’', "'").replace('—', '-').strip())


@rule('F09', '§6', 'out/captions.srt parsed; joined subtitle text vs joined narration text of out/script.json (whitespace-normalised, exact characters otherwise); '
      'per cue: characters per line, lines, duration; cues must not overlap',
      'text identical (100%); every line ≤ 42 chars; ≤ 2 lines; 1.0 ≤ duration ≤ 7.0 s; 0 overlaps')
def f09_srt(ctx):
    cues = parse_srt(ctx.text('out/captions.srt'))
    script = norm_words(' '.join(s['text'] for s in ctx.sentences()))
    subs = norm_words(' '.join(' '.join(c['lines']) for c in cues))
    long_lines = [l for c in cues for l in c['lines'] if len(l) > 42]
    many = [c for c in cues if len(c['lines']) > 2]
    bad_dur = [(round(c['start'], 2), round(c['end'] - c['start'], 2)) for c in cues if not (1.0 - 1e-6 <= c['end'] - c['start'] <= 7.0 + 1e-6)]
    overl = [round(b['start'], 2) for a, b in zip(cues, cues[1:]) if b['start'] < a['end'] - 1e-6]
    # first difference, for the report
    diff = None
    if subs != script:
        i = next((k for k in range(min(len(subs), len(script))) if subs[k] != script[k]), min(len(subs), len(script)))
        diff = {'at': i, 'subs': subs[max(0, i - 30): i + 30], 'script': script[max(0, i - 30): i + 30]}
    ms = [metric('text identical to script', subs == script, '==', True), metric('lines > 42 chars', len(long_lines), '<=', 0),
          metric('cues > 2 lines', len(many), '<=', 0), metric('cues outside 1-7 s', len(bad_dur), '<=', 0), metric('overlapping cues', len(overl), '<=', 0)]
    return verdict('F09', ms, details=[{'firstDiff': diff, 'longLines': long_lines[:5], 'badDurations': bad_dur[:8], 'overlaps': overl[:5], 'cues': len(cues)}])


def parse_chapters_desc(text):
    out = []
    for m in re.finditer(r'^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)$', text, re.M):
        h, mi, s, title = m.groups()
        out.append({'start': int(h or 0) * 3600 + int(mi) * 60 + int(s), 'title': title.strip()})
    return out


@rule('F10', '§6', 'chapters from out/package/description.md (lines "m:ss Title") and, if present, the MP4 chapter atoms; '
      'chapter length = next start − start (last: to end of video)', '≥ 3 chapters; first at 0:00; each ≥ 10 s; MP4 chapters (if any) equal the description\'s')
def f10_chapters(ctx):
    ch = parse_chapters_desc(ctx.text('out/package/description.md'))
    dur = float(_streams(ctx)['format']['duration'])
    lens = [b['start'] - a['start'] for a, b in zip(ch, ch[1:])] + ([dur - ch[-1]['start']] if ch else [])
    mp4 = [{'start': round(float(c['start_time'])), 'title': c.get('tags', {}).get('title')} for c in _streams(ctx).get('chapters', [])]
    same = (not mp4) or [c['start'] for c in mp4] == [c['start'] for c in ch]
    ms = [metric('chapters', len(ch), '>=', 3), metric('first chapter start s', ch[0]['start'] if ch else None, '==', 0),
          metric('shortest chapter s', min(lens) if lens else 0, '>=', 10.0, 's'), metric('mp4 chapters agree', same, '==', True)]
    return verdict('F10', ms, details=[{'chapters': ch, 'mp4': mp4}])
