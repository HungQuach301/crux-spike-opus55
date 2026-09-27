import json, subprocess, re, os, sys
import numpy as np
from PIL import Image
D = json.load(open('declared.json'))
V = '/home/user/aw/video.mp4'
def frame(t):
    p = f'master-{t:.3f}.png'
    if not os.path.exists(p):
        # frame n shown at n/30: seek to the frame's own timestamp (accurate seek decodes to it)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.4f}', '-i', V, '-frames:v', '1', p], check=True)
    return p
def norm(s):
    return re.sub(r'[^0-9a-z$%.,−-]', '', s.lower().replace('−', '-').replace('–', '-'))
def ocr(img, box, pad=8):
    l, t, r, b = box
    c = img.crop((max(0, l - pad), max(0, t - pad), min(1920, r + pad), min(1080, b + pad))).convert('L')
    c = c.resize((c.width * 3, c.height * 3), Image.LANCZOS)
    a = np.asarray(c).astype(float)
    if a.mean() < 128: a = 255 - a
    Image.fromarray(a.astype(np.uint8)).save('/tmp/claude-0/crop.png')
    for psm in ('7', '6'):
        o = subprocess.run(['tesseract', '/tmp/claude-0/crop.png', '-', '--psm', psm], capture_output=True, text=True).stdout.strip()
        if o: return o
    return ''
def psnr(a, b):
    a = np.asarray(a.convert('L'), float); b = np.asarray(b.convert('L'), float)
    m = np.mean((a - b) ** 2); return 10 * np.log10(255 ** 2 / m)
rows = []
for s in D:
    t = s['t']; m = Image.open(frame(t)); pg = Image.open(f'page-{t:.3f}.png')
    ps = psnr(m, pg)
    for x in s['texts']:
        if not x['text'].strip(): continue
        got = ocr(m, x['box'])
        want = norm(x['text']); g = norm(got)
        nums_w = re.findall(r'\d[\d,.]*', x['text']); nums_g = re.findall(r'\d[\d,.]*', got)
        num_ok = all(n.rstrip('.,') in [q.rstrip('.,') for q in nums_g] for n in nums_w)
        # fuzzy text match (character-level similarity)
        import difflib
        sim = difflib.SequenceMatcher(None, want, g).ratio()
        rows.append({'t': round(t, 3), 'tid': x['tid'], 'role': x['role'], 'declared': x['text'], 'ocr': got.replace('\n', ' '), 'sim': round(sim, 2), 'numbersOk': num_ok, 'hasNumber': bool(nums_w), 'psnrFrame': round(ps, 1)})
json.dump(rows, open('ocr.json', 'w'), indent=1)
n = len(rows); good = [r for r in rows if r['sim'] >= 0.8]
nn = [r for r in rows if r['hasNumber']]; nok = [r for r in nn if r['numbersOk']]
print('texts', n, 'sim>=0.8', len(good), 'with numbers', len(nn), 'numbers read back', len(nok))
print('psnr per time', sorted({(r['t'], r['psnrFrame']) for r in rows}))
for r in rows:
    if r['sim'] < 0.8 or (r['hasNumber'] and not r['numbersOk']): print(r)
