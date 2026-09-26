'use strict';
// Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced — what Chromium screenshots produce) and binary-mask helpers.
const zlib = require('zlib');

function decodePNG(buf) {
  let p = 8, w, h, ct, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0) throw new Error('png: only 8-bit non-interlaced'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : ct === 4 ? 2 : null;
  if (!ch) throw new Error('png: colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (ch === 4) { out[o] = cur[x * 4]; out[o + 1] = cur[x * 4 + 1]; out[o + 2] = cur[x * 4 + 2]; out[o + 3] = cur[x * 4 + 3]; }
      else if (ch === 3) { out[o] = cur[x * 3]; out[o + 1] = cur[x * 3 + 1]; out[o + 2] = cur[x * 3 + 2]; out[o + 3] = 255; }
      else if (ch === 2) { out[o] = out[o + 1] = out[o + 2] = cur[x * 2]; out[o + 3] = cur[x * 2 + 1]; }
      else { out[o] = out[o + 1] = out[o + 2] = cur[x]; out[o + 3] = 255; }
    }
    [prev, cur] = [cur, prev];
  }
  return { w, h, data: out };
}

// alpha > thr -> 1
function alphaMask(img, thr = 64) {
  const m = new Uint8Array(img.w * img.h);
  for (let i = 0; i < m.length; i++) m[i] = img.data[i * 4 + 3] > thr ? 1 : 0;
  return { w: img.w, h: img.h, m };
}

// square dilation by r (separable max)
function dilate(M, r) {
  const { w, h, m } = M, tmp = new Uint8Array(m.length), out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    for (let x = 0; x < w; x++) { if (m[y * w + x]) last = x; tmp[y * w + x] = x - last <= r ? 1 : 0; }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) { if (m[y * w + x]) last = x; if (last - x <= r) tmp[y * w + x] = 1; }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) { if (tmp[y * w + x]) last = y; out[y * w + x] = y - last <= r ? 1 : 0; }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) last = y; if (last - y <= r) out[y * w + x] = 1; }
  }
  return { w, h, m: out };
}
function erode(M, r) {
  const inv = { w: M.w, h: M.h, m: M.m.map((v) => 1 - v) };
  const d = dilate(inv, r);
  return { w: M.w, h: M.h, m: d.m.map((v) => 1 - v) };
}

// count of pixels set in both a and b inside box [l,t,r,b]
function overlapIn(a, b, box) {
  const [l, t, r, bb] = clampBox(box, a.w, a.h);
  let n = 0;
  for (let y = t; y < bb; y++) for (let x = l; x < r; x++) { const i = y * a.w + x; if (a.m[i] && b.m[i]) n++; }
  return n;
}
function countIn(a, box) {
  const [l, t, r, bb] = clampBox(box, a.w, a.h);
  let n = 0;
  for (let y = t; y < bb; y++) for (let x = l; x < r; x++) if (a.m[y * a.w + x]) n++;
  return n;
}
function clampBox(box, w, h) { return [Math.max(0, Math.floor(box[0])), Math.max(0, Math.floor(box[1])), Math.min(w, Math.ceil(box[2])), Math.min(h, Math.ceil(box[3]))]; }

// ink bounding box inside a box
function inkBox(M, box) {
  const [l, t, r, b] = clampBox(box, M.w, M.h);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = t; y < b; y++) for (let x = l; x < r; x++) if (M.m[y * M.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const relLum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function median(xs) { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; }

// median colour of rgb frame (Buffer w*h*3) at mask pixels inside box
function medianColour(rgb, w, M, box) {
  const [l, t, r, b] = clampBox(box, w, M.h);
  const R = [], G = [], Bl = [];
  for (let y = t; y < b; y++) for (let x = l; x < r; x++) { const i = y * w + x; if (M.m[i]) { R.push(rgb[i * 3]); G.push(rgb[i * 3 + 1]); Bl.push(rgb[i * 3 + 2]); } }
  return R.length ? [median(R), median(G), median(Bl)] : null;
}

module.exports = { decodePNG, alphaMask, dilate, erode, overlapIn, countIn, inkBox, relLum, medianColour, clampBox, median };
