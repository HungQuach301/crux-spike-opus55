// Test D M2c: the world with a grammar (preprod/visual-grammar.md). Every object is a variable:
//   road of 30 stones = time (one stone per calendar year, 1966 near -> 1995 far; the year is carved on both faces);
//   stone height = that year's 60/40 return (road level = the rails = 0 %; a losing year sinks below the rails);
//   glass tank = the retiree's real balance (1966 dollars); the tank stands on the stone of the year it lives, the tap
//   pours the withdrawal at the start of the year, then the level moves with that stone's return and that year's
//   inflation, then the tank steps to the next stone (cause and effect in the same frame);
//   tap thickness = the withdrawal in dollars of the day (it widens with inflation);
//   the 1966 tank walks the left lane 1966 -> 1995, the mirror tank the right lane 1995 -> 1966;
//   the storm is a place: a cell of cloud, rain and fog over the 1973 and 1974 stones.
// Modes (?q=): final (1080p, N half-res subframes as a motion-blur residual, DOF, bloom, shafts, FXAA),
//              fast (load-reduced final: 1280x720 render upscaled to 1080p, camera-velocity motion blur, LOD for rain
//                    and dust, sun shafts only where a shot asks for them),
//              animatic (854x480, one pass, no rain, no blur, no post).
// ?stills=t1,t2,... maps video second k to story time t_k (a stills reel for the checks).
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const D = window.DATA;
const QS = new URLSearchParams(location.search);
const MODE = QS.get('q') || 'final';
const STILLS = QS.get('stills') ? QS.get('stills').split(',').map(Number) : null;
const OW = MODE === 'animatic' ? 854 : 1920, OH = MODE === 'animatic' ? 480 : 1080;
const RW = MODE === 'fast' ? 1280 : OW, RH = MODE === 'fast' ? 720 : OH;
const TS = OH / 1080; // text scale
const C = { c1966: '#ffc857', cmirror: '#5a9ceb', text: '#f2f4f8', dim: '#b8c2d0', loss: '#e8766a', inflation: '#c98bd8', badge: '#e9e2ff', badgeBg: 'rgba(43,36,64,0.92)' };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * u * (u * (6 * u - 15) + 10); };
const inertia = (u) => { u = clamp(u); const s = smooth(u); return s - (u < 0.25 ? 0.01 * Math.sin(Math.PI * u / 0.25) : 0) + (u > 0.65 ? 0.02 * Math.sin(Math.PI * (u - 0.65) / 0.35) : 0); };
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const mixV = (a, b, u) => a.map((x, i) => lerp(x, b[i], u));
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const cue = (k, d) => (k in D.cues ? D.cues[k] : d);
const shotAt = (t) => { let s = D.shots[0]; for (const x of D.shots) if (t >= x.start) s = x; return s; };
const sentence = (id) => D.sentences.find((s) => s.id === id);

// ---------------------------------------------------------------- the model as the world sees it
const PITCH = 2.2, ROAD = 1.0, GAIN = 4.5, NY = 30;
const stoneTop = (i) => ROAD + GAIN * D.years[i].nominal;
const zOf = (pos) => -pos * PITCH;                     // pos = stone index (float)
const WREAL = 40000;
// progress u (years lived, 0..30): standing on stone floor(u); tap in [0,0.15), return in [0.15,0.75), step in [0.75,1)
function life(who, u) {
  const bal = D.balance[who]; const i = clamp(Math.floor(u), 0, NY - 1); const f = clamp(u - i, 0, 1);
  const b0 = bal[i], after = Math.max(0, b0 - WREAL), b1 = bal[i + 1];
  let level;
  if (u >= NY) level = bal[NY]; else if (f < 0.15) level = lerp(b0, after, smooth(f / 0.15)); else if (f < 0.75) level = lerp(after, b1, smooth((f - 0.15) / 0.6)); else level = b1;
  const step = smooth((f - 0.75) / 0.25);
  const k = u >= NY ? NY - 1 : i;
  const stone = who === '1966' ? k : NY - 1 - k;
  const next = who === '1966' ? Math.min(NY - 1, k + 1) : Math.max(0, NY - 2 - k);
  const pos = u >= NY ? stone : lerp(stone, next, step);
  const topNow = lerp(stoneTop(stone), stoneTop(next), clamp((step - 0.3) / 0.4));
  const hop = Math.sin(Math.PI * step) * 0.35;
  const pouring = f < 0.2 && b0 > 1 ? 1 : 0;
  return { level, pos, y: topNow + hop, stone, year: 1966 + (who === '1966' ? stone : stone), wNominal: D.withdrawal[Math.min(k, NY - 1)] || D.withdrawal[0], pouring, empty: level < 1000, yearIndex: k };
}
const BMAX = Math.max(...D.balance['1966'], ...D.balance.mirror) * 1.12;

// ---------------------------------------------------------------- renderer and targets
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, alpha: true });
renderer.setPixelRatio(1); renderer.setSize(OW, OH, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = MODE === 'animatic' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const glCanvas = renderer.domElement; document.body.appendChild(glCanvas);
Object.assign(glCanvas.style, { width: OW + 'px', height: OH + 'px' });
const textCanvas = document.createElement('canvas'); textCanvas.width = OW; textCanvas.height = OH; document.body.appendChild(textCanvas);
Object.assign(textCanvas.style, { width: OW + 'px', height: OH + 'px' });
const tctx = textCanvas.getContext('2d');
const HF = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rtScene = new THREE.WebGLRenderTarget(RW, RH, { ...HF, depthTexture: new THREE.DepthTexture(RW, RH) });
const rtAcc = new THREE.WebGLRenderTarget(RW, RH, HF), rtDof = new THREE.WebGLRenderTarget(RW, RH, HF), rtMB = new THREE.WebGLRenderTarget(RW, RH, HF);
const rtQ1 = new THREE.WebGLRenderTarget(RW / 4, RH / 4, HF), rtQ2 = new THREE.WebGLRenderTarget(RW / 4, RH / 4, HF);
const rtRay = new THREE.WebGLRenderTarget(RW / 2, RH / 2, HF), rtRay2 = new THREE.WebGLRenderTarget(RW / 2, RH / 2, HF);
const rtHalf = new THREE.WebGLRenderTarget(RW / 2, RH / 2, { ...HF, depthTexture: new THREE.DepthTexture(RW / 2, RH / 2) });
const rtHalfAcc = new THREE.WebGLRenderTarget(RW / 2, RH / 2, HF), rtHalfC = new THREE.WebGLRenderTarget(RW / 2, RH / 2, HF);
const rtLdr = new THREE.WebGLRenderTarget(OW, OH, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); const quadScene = new THREE.Scene(); quadScene.add(quad);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function pass(mat, target, clear = true) { quad.material = mat; renderer.setRenderTarget(target); renderer.autoClear = clear; renderer.render(quadScene, quadCam); renderer.autoClear = true; }
const accMat = new THREE.ShaderMaterial({ vertexShader: VS, uniforms: { t: { value: null }, w: { value: 1 } }, depthTest: false, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  fragmentShader: 'uniform sampler2D t; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * w, 1.0); }' });
const resMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, uniforms: { tFull: { value: null }, tAcc: { value: null }, tC: { value: null } },
  fragmentShader: 'uniform sampler2D tFull, tAcc, tC; varying vec2 vUv; void main(){ gl_FragColor = vec4(max(texture2D(tFull, vUv).rgb + texture2D(tAcc, vUv).rgb - texture2D(tC, vUv).rgb, 0.0), 1.0); }' });
const copyMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, uniforms: { t: { value: null } }, fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.0); }' });
// camera-velocity motion blur (fast mode): reproject each pixel's world point with the cameras at the shutter's open and close
const mbMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false,
  uniforms: { tCol: { value: null }, tDepth: { value: null }, invVP: { value: new THREE.Matrix4() }, prevVP: { value: new THREE.Matrix4() }, nextVP: { value: new THREE.Matrix4() } },
  fragmentShader: `uniform sampler2D tCol, tDepth; uniform mat4 invVP, prevVP, nextVP; varying vec2 vUv;
  void main(){ float d = texture2D(tDepth, vUv).x; vec4 w = invVP * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); w /= w.w;
    vec4 a = prevVP * w; a /= a.w; vec4 b = nextVP * w; b /= b.w; vec2 ua = a.xy * 0.5 + 0.5, ub = b.xy * 0.5 + 0.5;
    vec3 s = vec3(0.0); for (int i = 0; i < 10; i++) s += texture2D(tCol, mix(ua, ub, (float(i) + 0.5) / 10.0)).rgb; gl_FragColor = vec4(s / 10.0, 1.0); }` });
const fxaaMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, uniforms: { t: { value: null }, px: { value: new THREE.Vector2(1 / OW, 1 / OH) } },
  fragmentShader: `uniform sampler2D t; uniform vec2 px; varying vec2 vUv; float L(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
  void main(){ vec3 cM = texture2D(t, vUv).rgb; float lM = L(cM); float lNW = L(texture2D(t, vUv + vec2(-1.0, -1.0) * px).rgb), lNE = L(texture2D(t, vUv + vec2(1.0, -1.0) * px).rgb),
    lSW = L(texture2D(t, vUv + vec2(-1.0, 1.0) * px).rgb), lSE = L(texture2D(t, vUv + vec2(1.0, 1.0) * px).rgb);
    float mn = min(lM, min(min(lNW, lNE), min(lSW, lSE))), mx = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE)); float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
    float rc = 1.0 / (min(abs(dir.x), abs(dir.y)) + red); dir = clamp(dir * rc, -8.0, 8.0) * px;
    vec3 a = 0.5 * (texture2D(t, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(t, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
    vec3 b = a * 0.5 + 0.25 * (texture2D(t, vUv - dir * 0.5).rgb + texture2D(t, vUv + dir * 0.5).rgb); float lB = L(b);
    gl_FragColor = vec4((lB < mn || lB > mx) ? a : b, 1.0); }` });
const dofMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, depthWrite: false,
  uniforms: { tCol: { value: null }, tDepth: { value: null }, near: { value: 0.1 }, far: { value: 3000 }, focus: { value: 5 }, K: { value: 0 }, maxR: { value: 22 }, px: { value: new THREE.Vector2(1 / RW, 1 / RH) } },
  fragmentShader: `uniform sampler2D tCol, tDepth; uniform float near, far, focus, K, maxR; uniform vec2 px; varying vec2 vUv;
  float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
  float coc(float z){ return clamp(K * abs(1.0 / focus - 1.0 / z), 0.0, maxR); }
  void main(){ float z0 = lin(texture2D(tDepth, vUv).x); float c0 = coc(z0); vec3 base = texture2D(tCol, vUv).rgb;
    if (c0 < 0.6) { gl_FragColor = vec4(base, 1.0); return; }
    vec3 acc = base; float wsum = 1.0;
    for (int i = 0; i < 28; i++) { float fi = float(i) + 0.5; float r = c0 * sqrt(fi / 28.0); float a = fi * 2.39996323;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * r * px; float zs = lin(texture2D(tDepth, uv).x); float cs = coc(zs);
      float w = zs < z0 ? clamp(cs - r + 1.0, 0.0, 1.0) : 1.0; acc += texture2D(tCol, uv).rgb * w; wsum += w; }
    gl_FragColor = vec4(acc / wsum, 1.0); }` });
const brightMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, uniforms: { t: { value: null }, th: { value: 1.0 } },
  fragmentShader: 'uniform sampler2D t; uniform float th; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = dot(c, vec3(0.2126,0.7152,0.0722)); gl_FragColor = vec4(c * clamp((l - th) / max(l, 1e-4), 0.0, 1.0), 1.0); }' });
const blurMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, uniforms: { t: { value: null }, d: { value: new THREE.Vector2() } },
  fragmentShader: `uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main(){ vec3 s = vec3(0.0); float ws = 0.0;
    for (int i = -6; i <= 6; i++) { float w = exp(-float(i*i) / 18.0); s += texture2D(t, vUv + d * float(i)).rgb * w; ws += w; } gl_FragColor = vec4(s / ws, 1.0); }` });
const occMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, uniforms: { tCol: { value: null }, tDepth: { value: null }, sun: { value: new THREE.Vector2() }, aspect: { value: RW / RH } },
  fragmentShader: `uniform sampler2D tCol, tDepth; uniform vec2 sun; uniform float aspect; varying vec2 vUv; void main(){
    float sky = step(0.99999, texture2D(tDepth, vUv).x); vec2 d = (vUv - sun) * vec2(aspect, 1.0);
    gl_FragColor = vec4(texture2D(tCol, vUv).rgb * sky * exp(-dot(d, d) * 6.0), 1.0); }` });
const rayMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, uniforms: { t: { value: null }, sun: { value: new THREE.Vector2() } },
  fragmentShader: `uniform sampler2D t; uniform vec2 sun; varying vec2 vUv; void main(){ vec2 dt = (vUv - sun) / 48.0 * 0.9; vec2 uv = vUv; vec3 s = vec3(0.0); float decay = 1.0;
    for (int i = 0; i < 48; i++) { uv -= dt; s += texture2D(t, uv).rgb * decay; decay *= 0.965; } gl_FragColor = vec4(s / 48.0, 1.0); }` });
// final: tone map + grade + vignette + dither (2 LSB triangular in dark areas, where banding shows), upscales in fast mode
const finalMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false,
  uniforms: { tCol: { value: null }, tBloom: { value: null }, tRay: { value: null }, exposure: { value: 1 }, bloom: { value: 0.06 }, ray: { value: 0 }, lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) },
    vig: { value: 0.16 }, seed: { value: 0 }, sat: { value: 1 }, px: { value: new THREE.Vector2(1 / RW, 1 / RH) }, sharpen: { value: 0 } },
  fragmentShader: `uniform sampler2D tCol, tBloom, tRay; uniform float exposure, bloom, ray, vig, seed, sat, sharpen; uniform vec3 lift, gain; uniform vec2 px; varying vec2 vUv;
  vec3 aces(vec3 x){ return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){ vec3 c0 = texture2D(tCol, vUv).rgb;
    if (sharpen > 0.0) { vec3 nb = (texture2D(tCol, vUv + vec2(px.x, 0.0)).rgb + texture2D(tCol, vUv - vec2(px.x, 0.0)).rgb + texture2D(tCol, vUv + vec2(0.0, px.y)).rgb + texture2D(tCol, vUv - vec2(0.0, px.y)).rgb) * 0.25; c0 = max(c0 + (c0 - nb) * sharpen, 0.0); }
    vec3 c = c0 + texture2D(tBloom, vUv).rgb * bloom + texture2D(tRay, vUv).rgb * ray;
    c *= exposure; c = aces(c); float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, sat);
    c = c * gain + lift * (1.0 - c);
    vec2 q = vUv - 0.5; c *= 1.0 - vig * smoothstep(0.25, 0.85, length(q * vec2(1.0, 0.8)) * 1.25);
    c = mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    float amp = mix(2.0, 1.0, smoothstep(0.15, 0.45, l));
    float n = h(gl_FragCoord.xy + seed) + h(gl_FragCoord.xy * 1.37 + seed + 17.0) - 1.0; c += n * amp / 255.0;
    gl_FragColor = vec4(c, 1.0); }` });

// ---------------------------------------------------------------- textures
function noiseTex(size, seed, fn, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d'); const im = x.createImageData(size, size); const r = rng(seed);
  const g = new Float32Array(64 * 64).map(() => r());
  const vn = (u, v, f) => { u = u * f; v = v * f; const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, s = (p, q) => g[((p % 64 + 64) % 64) * 64 + ((q % 64 + 64) % 64)];
    const A = s(i, j), B = s(i + 1, j), Cc = s(i, j + 1), Dd = s(i + 1, j + 1), sa = a * a * (3 - 2 * a), sb = b * b * (3 - 2 * b); return lerp(lerp(A, B, sa), lerp(Cc, Dd, sa), sb); };
  const fbm = (u, v) => { let s = 0, amp = 0.5, f = 4; for (let o = 0; o < 5; o++) { s += amp * vn(u, v, f); amp *= 0.5; f *= 2; } return s; };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const c = fn(fbm(i / size, j / size), r, i / size, j / size); const k = (j * size + i) * 4; im.data[k] = c[0]; im.data[k + 1] = c[1]; im.data[k + 2] = c[2]; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t;
}
const soilTex = noiseTex(512, 11, (n, r) => { const v = 34 + n * 40 + r() * 8; return [v * 1.04, v * 0.96, v * 0.88]; }); soilTex.repeat.set(60, 60);
const stoneTex = noiseTex(256, 21, (n, r) => { const v = 105 + n * 70 + r() * 12; return [v, v * 0.97, v * 0.92]; });
const stoneRough = noiseTex(256, 22, (n) => { const v = 120 + n * 110; return [v, v, v]; }, false);
const streamTex = noiseTex(128, 31, (n, r, u, v) => { const s = 180 + 75 * Math.sin(v * Math.PI * 16 + n * 6); return [s, s, s]; }, false);
function yearTex(y) { // carved year: dark recess with a light lower lip, on the stone colour (transparent elsewhere)
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const x = cv.getContext('2d');
  x.font = '700 150px Inter'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(255,248,235,0.55)'; x.fillText(String(y), 256, 100);
  x.fillStyle = 'rgba(20,18,16,0.92)'; x.fillText(String(y), 256, 96);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function dotTex() { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); }

// ---------------------------------------------------------------- world
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x404850, 0.008);
const sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky);
const skyScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(4000); skyScene.add(sky2);
const pmrem = new THREE.PMREMGenerator(renderer);
const cloudMat = new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
  uniforms: { haze: { value: new THREE.Color() }, time: { value: 0 }, cover: { value: 0.3 }, sunDir: { value: new THREE.Vector3(0, 0.1, -1) }, sunCol: { value: new THREE.Color(1, 0.7, 0.5) }, base: { value: new THREE.Color(0.1, 0.1, 0.12) }, dark: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float time, cover, dark; uniform vec3 sunDir, sunCol, base, haze; varying vec3 vP;
  float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hs(i), hs(i + vec2(1, 0)), u.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 3.1; a *= 0.5; } return s; }
  void main(){ vec3 d = normalize(vP - cameraPosition); if (d.y < -0.02) discard; vec2 uv = d.xz / (d.y + 0.12) * 1.3 + vec2(time * 0.018, time * 0.006);
    float n = fbm(uv); float den = smoothstep(1.0 - cover - 0.15, 1.0 - cover + 0.35, n);
    float toward = pow(max(dot(d, normalize(sunDir)), 0.0), 6.0); float edge = fbm(uv + normalize(sunDir.xz) * 0.08);
    vec3 lit = mix(base, sunCol, clamp(0.35 + 0.65 * toward - (edge - n) * 2.0, 0.0, 1.0) * (1.0 - dark));
    float hz = 1.0 - smoothstep(0.0, 0.07, d.y); float a = den * smoothstep(-0.02, 0.12, d.y);
    gl_FragColor = vec4(mix(lit, haze, hz * (1.0 - a)), max(a, hz)); }` });
const clouds = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), cloudMat); scene.add(clouds);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ map: soilTex, color: 0xffffff }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; sun.shadow.mapSize.set(MODE === 'animatic' ? 1024 : 2048, MODE === 'animatic' ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 }); scene.add(sun); scene.add(sun.target);
const rim = new THREE.DirectionalLight(0x9cc4ff, 0.5); scene.add(rim); scene.add(rim.target);
const hemi = new THREE.HemisphereLight(0x8090b0, 0x2a2018, 0.4); scene.add(hemi);
const flash = new THREE.PointLight(0xdfe8ff, 0, 0, 0); flash.position.set(-20, 40, -16); scene.add(flash);

// road: 30 stones, two lanes wide, year carved on both faces; rails at road level = 0 %
const stones = D.years.map((yr, i) => {
  const r = rng(100 + i);
  const m = new THREE.MeshStandardMaterial({ map: stoneTex, roughnessMap: stoneRough, roughness: 1, color: new THREE.Color().setHSL(0.08, 0.06, 0.52 + r() * 0.1) });
  const g = new THREE.Group(); g.userData = { id: 'stone-' + yr.y, data: true, year: yr.y };
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(3.6, 6, 1.95, 2, 0.06), m); mesh.castShadow = mesh.receiveShadow = true; mesh.position.y = -3; g.add(mesh);
  const tex = yearTex(yr.y); const cm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.49), cm); p.position.set(0, -0.36, s * 0.978); if (s < 0) p.rotation.y = Math.PI; g.add(p);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), cm); q.position.set(s * 1.803, -0.34, 0); q.rotation.y = s * Math.PI / 2; g.add(q); }
  g.position.set(0, stoneTop(i), zOf(i)); scene.add(g); return g;
});
const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.35 });
for (const x of [-1.95, 1.95]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, NY * PITCH + 4), railMat); rl.position.set(x, ROAD, zOf((NY - 1) / 2)); rl.castShadow = true; scene.add(rl);
  for (let i = -1; i <= NY; i++) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, ROAD, 0.05), railMat); post.position.set(x, ROAD / 2, zOf(i + 0.5)); scene.add(post); } }

// tanks
const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.02, transparent: true, opacity: 0.07, envMapIntensity: 1.0, side: THREE.DoubleSide, depthWrite: false });
const steelMat = new THREE.MeshStandardMaterial({ color: 0x7c8086, metalness: 1, roughness: 0.34 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 1, roughness: 0.28 });
const TW = 1.25, TH = 2.1, TB = 0.22;
function makeTank(who, col, lane, dashed) {
  const g = new THREE.Group(); g.userData = { id: 'tank-' + who, data: true, char: who };
  const pl = new THREE.Mesh(new RoundedBoxGeometry(TW + 0.35, TB, TW + 0.35, 2, 0.04), steelMat); pl.position.y = TB / 2; pl.castShadow = pl.receiveShadow = true; g.add(pl);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(TW, TH, TW), glassMat); gl.position.y = TB + TH / 2; gl.renderOrder = 3; g.add(gl);
  const e = 0.06;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(e, TH + e, e), brassMat); p.position.set(sx * TW / 2, TB + TH / 2, sz * TW / 2); p.castShadow = true; g.add(p); }
  for (const y of [TB, TB + TH]) for (const [w, d, x, z] of [[TW, e, 0, -TW / 2], [TW, e, 0, TW / 2], [e, TW, -TW / 2, 0], [e, TW, TW / 2, 0]]) {
    if (dashed && y > TB) { for (let k = 0; k < 4; k++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(w > d ? w / 7 : e + 0.02, e + 0.02, d > w ? d / 7 : e + 0.02), brassMat); const o = (k - 1.5) * (Math.max(w, d) / 3.6); seg.position.set(x + (w > d ? o : 0), y, z + (d > w ? o : 0)); g.add(seg); } }
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(w + e, e, d + e), brassMat); b.position.set(x, y, z); b.castShadow = true; g.add(b); } }
  const c = new THREE.Color(col);
  const liqMat = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(who === '1966' ? 0.9 : 0.5), roughness: 0.3, transparent: true, opacity: 0.97, emissive: c, emissiveIntensity: who === '1966' ? 0.45 : 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(TW - 0.04, 1, TW - 0.04), liqMat); body.castShadow = true; body.renderOrder = 1; g.add(body);
  const surfGeo = new THREE.PlaneGeometry(TW - 0.04, TW - 0.04, 16, 16); surfGeo.rotateX(-Math.PI / 2);
  const surf = new THREE.Mesh(surfGeo, new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(who === '1966' ? 0.95 : 0.55), roughness: 0.1, transparent: true, opacity: 0.98, emissive: c, emissiveIntensity: who === '1966' ? 0.5 : 0.22 })); surf.renderOrder = 2; g.add(surf);
  const side = lane < 0 ? -1 : 1; // the tap faces outward, over the edge of the road
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 16), brassMat); spout.rotation.z = Math.PI / 2; spout.position.set(side * (TW / 2 + 0.17), TB + 0.14, 0.3); g.add(spout);
  const sm = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.8), roughness: 0.05, transparent: true, opacity: 0.9, emissive: c, emissiveIntensity: 0.3, alphaMap: streamTex });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), sm); g.add(stream);
  scene.add(g);
  return { g, body, surf, stream, side, lane, who, col };
}
const tanks = { '1966': makeTank('1966', C.c1966, -0.9, false), mirror: makeTank('mirror', C.cmirror, 0.9, true) };

// the storm cell over the 1973-74 stones: dark cloud mass, local rain and fog
const STORM_Z = (zOf(7) + zOf(8)) / 2;
const stormGroup = new THREE.Group(); scene.add(stormGroup);
{ const r = rng(77); const m = new THREE.MeshLambertMaterial({ color: 0x4a5058, transparent: true, opacity: 0.55, depthWrite: false });
  for (let k = 0; k < 26; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1.4 + r() * 2.0, 20, 14), m); s.position.set((r() - 0.5) * 11, 8.5 + r() * 2.5, STORM_Z + (r() - 0.5) * 6); s.scale.y = 0.45; stormGroup.add(s); } }
const DUST = MODE === 'fast' ? 900 : MODE === 'animatic' ? 0 : 2200;
const dustGeo = new THREE.BufferGeometry(); const dustBase = new Float32Array(Math.max(1, DUST) * 3); { const r = rng(5); for (let i = 0; i < DUST; i++) { dustBase[i * 3] = (r() - 0.5) * 24; dustBase[i * 3 + 1] = r() * 6; dustBase[i * 3 + 2] = (r() - 0.5) * 30; } }
dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, DUST) * 3), 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.03, map: dotTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd8a8, opacity: 0.6 })); scene.add(dust);
const RAIN = MODE === 'fast' ? 2600 : MODE === 'animatic' ? 0 : 6000;
const rainGeo = new THREE.BufferGeometry(); const rainBase = new Float32Array(Math.max(1, RAIN) * 4); { const r = rng(9); for (let i = 0; i < RAIN; i++) { rainBase[i * 4] = (r() - 0.5) * 16; rainBase[i * 4 + 1] = r() * 11; rainBase[i * 4 + 2] = (r() - 0.5) * 7.5; rainBase[i * 4 + 3] = 0.8 + r() * 0.4; } }
rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, RAIN) * 6), 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xaebfd6, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(rain);
const camera = new THREE.PerspectiveCamera(40, RW / RH, 0.1, 3000);
const fovOf = (f) => 2 * Math.atan(12 / f) * 180 / Math.PI;

// ---------------------------------------------------------------- lighting states
function sunDir(el, az) { const e = el * Math.PI / 180, a = az * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)); }
function sunColour(el) { const k = clamp((el + 1) / 25); return new THREE.Color().setRGB(1, lerp(0.42, 0.93, k), lerp(0.2, 0.84, k)); }
const LIGHT = {
  dawn: (el = 3, az = -22) => ({ sun: { el, az, i: 3.2 }, cover: 0.3, dark: 0, fog: [0.62, 0.52, 0.48, 0.0055], hemi: [0x7d8fb0, 0x2c2218, 0.5], rimI: 0.35, exposure: 0.85, lift: [0.012, 0.010, 0.016], gain: [1.02, 1.0, 0.96], sat: 1.0, rays: 0.8 }),
  day: (el = 16, az = -35) => ({ sun: { el, az, i: 3.4 }, cover: 0.35, dark: 0, fog: [0.62, 0.66, 0.72, 0.004], hemi: [0x9fb0cc, 0x3a2e22, 0.55], rimI: 0.3, exposure: 0.62, lift: [0.008, 0.008, 0.012], gain: [1.0, 1.0, 1.0], sat: 1.0, rays: 0 }),
  dusk: (el = -0.8, az = 40) => ({ sun: { el, az, i: 2.6 }, cover: 0.45, dark: 0, fog: [0.48, 0.34, 0.36, 0.009], hemi: [0x5a6a9a, 0x24181a, 0.4], rimI: 0.55, exposure: 0.7, lift: [0.014, 0.008, 0.02], gain: [1.03, 0.98, 0.97], sat: 1.02, rays: 0.9 }),
  storm: () => ({ sun: { el: 58, az: -35, i: 0.6 }, cover: 0.97, dark: 0.75, fog: [0.17, 0.2, 0.24, 0.035], hemi: [0x7d8fa8, 0x2a2c30, 0.8], rimI: 0.35, exposure: 1.3, lift: [0.006, 0.010, 0.016], gain: [0.97, 0.99, 1.03], sat: 1.0, rays: 0, rain: 1, wet: 1 }),
};

// ---------------------------------------------------------------- the edit: one entry per shot (camera, light, lives, labels)
const LBL = (o) => ({ weight: 700, size: 46, color: C.text, level: 2, plate: true, ...o });
function shotState(t) {
  const sh = shotAt(t); const id = sh.id; const L = t - sh.start; const T0 = sh.start, T1 = sh.start + sh.dur;
  const S = { shot: id, u: { '1966': 0, mirror: 0 }, labels: [], lightning: 0, dust: 1, rain: 0, tapOpen: 1, tapScale: null, focusOn: null, K: 50, subframes: 4 };
  const cam = (a, b, t0 = T0, t1 = T1) => { const u = inertia((t - t0) / Math.max(0.1, t1 - t0)); return { p: mixV(a.p, b.p, u), l: mixV(a.l, b.l, u), f: lerp(a.f, b.f, u) }; };
  const tankTop = (who) => { const lf = life(who, S.u[who]); return [tanks[who].lane, lf.y + TB + TH + 0.55, zOf(lf.pos)]; };
  const at = (k, d) => cue(k, d);
  const on = (k, d, o) => { const c = at(k, d); if (t >= c - 0.05) S.labels.push({ t0: c - 0.05, ...o }); };
  switch (id) {
    case 'co-lines': case 'co-same': {
      Object.assign(S, LIBRARY.dawn(lerp(1.2, 4, clamp(t / 7.5))));
      Object.assign(S, cam({ p: [6, 14, 13], l: [0, 1, -26], f: 26 }, { p: [-3.2, 3.8, 7.6], l: [-0.9, 1.8, -1], f: 30 }, 0.2, 7.3));
      S.focusOn = [-0.9, 1.8, 0]; S.K = 40; S.tapOpen = 0; break; }
    case 'co-broke': {
      const t0 = T0 + 0.25, t1 = at('co-broke.1|1991', 10.07); const k = smooth((t - t0) / (t1 - t0));
      S.u = { '1966': 25.62 * k, mirror: 25.62 * k };
      const el = t < t1 ? 4 + 38 * Math.sin(Math.PI * Math.min(1, k * 1.04)) : -0.6;
      Object.assign(S, (t < t1 && k < 0.8 ? LIBRARY.dawn : LIBRARY.dusk)(Math.max(el, -1.2), lerp(-60, 62, k)));
      const z66 = zOf(life('1966', S.u['1966']).pos);
      S.p = [10.5, 8.2, z66 + 9]; S.l = [-0.6, 1.2, z66 - 3]; S.f = 30; S.focusOn = [-0.9, 1.5, z66]; S.K = 30; S.subframes = 8;
      on('co-broke.1|1991', 10.07, LBL({ id: 'cb-1991', text: '1991', world: tankTop('1966'), size: 72, color: C.c1966, level: 1, claims: [{ id: 'y1991', text: '1991' }], char: '1966', emph: true }));
      break; }
    case 'co-question': {
      S.u = { '1966': 25.62, mirror: 25.62 }; Object.assign(S, LIBRARY.dusk(-0.8, 58));
      const z66 = zOf(life('1966', 25.62).pos), zm = zOf(life('mirror', 25.62).pos);
      Object.assign(S, cam({ p: [-3.8, 2.6, z66 - 4.5], l: [0.4, 1.9, z66 + 12], f: 50 }, { p: [-3.6, 2.55, z66 - 4.1], l: [0.5, 1.9, z66 + 12], f: 50 }));
      const rc = at('co-question.1|decided', 13.62); const u = smooth((t - (rc - 0.35)) / 0.8); const cp = V(S.p);
      S.focus = lerp(cp.distanceTo(V([-0.9, 1.8, z66])), cp.distanceTo(V([0.9, 1.8, zm])), u); S.K = 120; S.rackTurn = rc; break; }
    case 'ident': {
      S.u = { '1966': 25.62, mirror: 25.62 }; Object.assign(S, LIBRARY.dusk(-1.4, 40));
      Object.assign(S, cam({ p: [0, 9, 10], l: [0, 0.5, -26], f: 28 }, { p: [0, 12, 8], l: [0, 0.3, -30], f: 28 }, T0, T1 + 0.4)); S.focusOn = [0, 1, -20]; S.K = 25;
      S.labels.push(LBL({ id: 'id-title', text: 'Same average, different fate', screen: [960, 300], size: 72, level: 1, t0: T0 + 0.15, fade: 0.5 })); break; }
    // ------------------------------------------------ act 1: teach the world, one object per line
    case 'a1-est.1': Object.assign(S, LIBRARY.day(8, -30)); Object.assign(S, cam({ p: [5, 13, 15], l: [0, 1, -12], f: 26 }, { p: [2.6, 5, 9.5], l: [-0.6, 1.5, -6], f: 28 })); S.focusOn = [-0.9, 1.8, 0]; S.K = 30; S.tapOpen = 0; break;
    case 'a1-start.1': case 'a1-start.2': {
      Object.assign(S, LIBRARY.day(9, -30)); S.tapOpen = 0;
      const a = { p: [-4.2, 2.7, 5.4], l: [-0.9, 2.0, 0], f: 40 }, b = { p: [-3.6, 2.6, 4.6], l: [-0.9, 2.0, 0], f: 40 };
      Object.assign(S, id === 'a1-start.1' ? cam(a, b) : cam(b, { p: [-3.3, 2.55, 4.1], l: [-0.9, 2.0, 0], f: 40 }));
      S.focusOn = [-0.9, 1.8, 0]; S.K = 55;
      const c1 = at('a1-start.1|$1', sentence('a1-start.1').start + 2);
      if (t >= c1 - 0.05) { S.labels.push(LBL({ id: 'st-1m', group: 'st', row: 1, text: '$1 million', world: tankTop('1966'), size: 56, color: C.c1966, level: 1, t0: c1 - 0.05, claims: [{ id: 'initial', text: '$1 million' }], char: '1966', emph: true }));
        S.labels.push(LBL({ id: 'st-basis', group: 'st', row: 2, text: 'in 1966 dollars', world: tankTop('1966'), dy: 62, size: 34, weight: 600, color: C.dim, level: 3, t0: c1 - 0.05 }));
        S.labels.push(LBL({ id: 'st-badge', group: 'st', row: 0, text: 'ILLUSTRATIVE', world: tankTop('1966'), dy: -64, size: 28, weight: 700, color: C.badge, bg: C.badgeBg, role: 'badge', level: 3, t0: c1 - 0.25 })); }
      if (id === 'a1-start.2') S.labels.push(LBL({ id: 'teach-tank', text: 'water = balance, in 1966 dollars', world: [-0.9, 1.1, 0], dx: -330, size: 36, weight: 600, level: 2, t0: sentence('a1-start.2').start + 0.2 }));
      break; }
    case 'a1-rule.1': case 'a1-rule.2': {
      Object.assign(S, LIBRARY.day(10, -30)); Object.assign(S, cam({ p: [-5.4, 1.9, 3.2], l: [-1.7, 1.2, 0], f: 40 }, { p: [-5.0, 1.85, 2.8], l: [-1.7, 1.2, 0], f: 40 }));
      S.focusOn = [-1.7, 1.2, 0]; S.K = 55; const open = at('a1-rule.1|withdraws', sentence('a1-rule.1').start + 2); S.tapOpen = smooth((t - open) / 0.6);
      if (id === 'a1-rule.2') { const c = at('a1-rule.2|$40', sentence('a1-rule.2').start + 0.6);
        if (t >= c - 0.05) { S.labels.push(LBL({ id: 'ru-40k', group: 'ru', row: 1, text: '$40,000', world: [-2.6, 2.1, 0.3], size: 52, color: C.c1966, level: 1, t0: c - 0.05, claims: [{ id: 'wd1', text: '$40,000' }], char: '1966', emph: true }));
          S.labels.push(LBL({ id: 'ru-basis', group: 'ru', row: 2, text: 'in 1966 dollars', world: [-2.6, 2.1, 0.3], dy: 58, size: 34, weight: 600, color: C.dim, level: 3, t0: c - 0.05 }));
          S.labels.push(LBL({ id: 'ru-badge', group: 'ru', row: 0, text: 'ILLUSTRATIVE', world: [-2.6, 2.1, 0.3], dy: -60, size: 28, weight: 700, color: C.badge, bg: C.badgeBg, role: 'badge', level: 3, t0: c - 0.25 })); } }
      break; }
    case 'a1-raise.1': case 'a1-raise.2': {
      Object.assign(S, LIBRARY.day(11, -30)); Object.assign(S, cam({ p: [-5.0, 1.85, 2.8], l: [-1.7, 1.1, 0], f: 40 }, { p: [-4.6, 1.8, 2.3], l: [-1.7, 1.1, 0], f: 40 }));
      S.focusOn = [-1.7, 1.1, 0]; S.K = 55;
      // a preview of the years ahead: the tap follows the 1966 retiree's real withdrawals in dollars of the day, 1966-1971
      const s1 = sentence('a1-raise.1'); S.tapScale = D.withdrawal[Math.min(5, Math.floor(clamp((t - s1.start) / (s1.end - s1.start)) * 6))] / D.withdrawal[0];
      if (id === 'a1-raise.2') S.labels.push(LBL({ id: 'teach-tap', text: 'tap = withdrawal (dollars of the day)', world: [-2.6, 2.0, 0.3], size: 36, weight: 600, level: 2, t0: sentence('a1-raise.2').start + 0.2 }));
      break; }
    case 'a1-horizon.1': {
      Object.assign(S, LIBRARY.day(12, -30)); Object.assign(S, cam({ p: [-1.6, 5.5, 8.5], l: [0, 0.4, -24], f: 28 }, { p: [-1.2, 9.5, 11], l: [0, 0.2, -30], f: 28 })); S.focusOn = [0, 1, -12]; S.K = 20;
      on('a1-horizon.1|1966', sentence('a1-horizon.1').start + 3, LBL({ id: 'hz-1966', text: '1966', world: [0, stoneTop(0) + 0.9, zOf(0) + 0.6], dx: 150, size: 44, level: 2, claims: [{ id: 'y1966', text: '1966' }], year: 1966 }));
      on('a1-horizon.1|1995', sentence('a1-horizon.1').start + 4, LBL({ id: 'hz-1995', text: '1995', world: [0, stoneTop(29) + 2.6, zOf(29)], size: 44, level: 2, claims: [{ id: 'y1995', text: '1995' }], year: 1995 }));
      break; }
    case 'a1-horizon.2': case 'a1-horizon.3': {
      Object.assign(S, LIBRARY.day(20, 75)); Object.assign(S, cam({ p: [10.5, 3.6, zOf(2)], l: [0, 0.9, zOf(2)], f: 32 }, { p: [10.0, 3.5, zOf(2.2)], l: [0, 0.9, zOf(2.2)], f: 32 }));
      S.focusOn = [0, 1, zOf(2)]; S.K = 30;
      if (id === 'a1-horizon.2') S.labels.push(LBL({ id: 'teach-stone', text: 'each stone = one year’s return', world: [0, 3.4, zOf(2)], size: 40, weight: 600, level: 2, t0: sentence('a1-horizon.2').start + 0.2 }),
        LBL({ id: 'teach-rail', text: 'rail = 0 %', world: [1.95, ROAD, zOf(4.6)], dy: 48, size: 34, weight: 600, color: C.dim, level: 3, t0: at('a1-horizon.2|losing', sentence('a1-horizon.2').start + 3) }));
      if (id === 'a1-horizon.3') { const s = sentence('a1-horizon.3'); S.u['1966'] = 2 * smooth((t - s.start - 0.4) / (s.end - s.start + 0.2)); }
      break; }
    case 'a1-mirror-in.1': case 'a1-mirror-rule.1': {
      Object.assign(S, LIBRARY.day(14, 30)); S.u['1966'] = 2;
      Object.assign(S, cam({ p: [4.4, 4.2, zOf(24.8)], l: [0.9, 2.9, zOf(29)], f: 40 }, { p: [4.0, 4.0, zOf(25.3)], l: [0.9, 2.9, zOf(29)], f: 40 }, id === 'a1-mirror-in.1' ? T0 : T0 - 3, T1));
      S.focusOn = [0.9, 1.8, zOf(29)]; S.K = 50;
      S.labels.push(LBL({ id: 'mi-name', group: 'mi', row: 1, text: 'mirror retiree', world: tankTop('mirror'), size: 44, color: C.cmirror, level: 2, char: 'mirror', t0: sentence('a1-mirror-in.1').start + 0.3 }));
      S.labels.push(LBL({ id: 'mi-badge', group: 'mi', row: 0, text: 'ILLUSTRATIVE', world: tankTop('mirror'), dy: -58, size: 28, weight: 700, color: C.badge, bg: C.badgeBg, role: 'badge', level: 3, t0: sentence('a1-mirror-in.1').start + 0.3 }));
      break; }
    case 'a1-mirror-rule.2': {
      Object.assign(S, LIBRARY.day(14, 30)); S.u['1966'] = 2;
      Object.assign(S, cam({ p: [4, 9, zOf(33)], l: [0, 0.3, zOf(12)], f: 28 }, { p: [4.4, 10, zOf(34)], l: [0, 0.3, zOf(10)], f: 28 })); S.focusOn = [0, 1, zOf(20)]; S.K = 15;
      on('a1-mirror-rule.2|1995', sentence('a1-mirror-rule.2').start + 1.5, LBL({ id: 'mr-1995', text: '1995 first', world: tankTop('mirror'), size: 44, color: C.cmirror, level: 2, claims: [{ id: 'y1995', text: '1995' }], year: 1995, char: 'mirror' }));
      on('a1-mirror-rule.2|1966', sentence('a1-mirror-rule.2').start + 4, LBL({ id: 'mr-1966', text: '1966 last', world: [0, stoneTop(0) + 2.2, zOf(0)], size: 44, level: 2, claims: [{ id: 'y1966', text: '1966' }], year: 1966 }));
      break; }
    case 'a1-mirror-rule.3': {
      Object.assign(S, LIBRARY.day(14, 30)); S.u['1966'] = 2; const s = sentence('a1-mirror-rule.3'); S.u.mirror = 2 * smooth((t - s.start - 0.2) / (s.end - s.start + 0.4));
      Object.assign(S, LIBRARY.day(20, -75)); Object.assign(S, cam({ p: [-10.5, 3.8, zOf(27.8)], l: [0, 1.3, zOf(27.8)], f: 32 }, { p: [-10.0, 3.7, zOf(27.4)], l: [0, 1.3, zOf(27.4)], f: 32 })); S.focusOn = [0.9, 1.5, zOf(28)]; S.K = 30;
      break; }
    // ------------------------------------------------ act 2: the storm is a place on the road
    case 'a2-7374.1': {
      Object.assign(S, LIBRARY.storm()); const s = sentence('a2-7374.1'); S.u['1966'] = lerp(7, 7.9, clamp((t - s.start) / (s.end - s.start + 0.6))); S.u.mirror = S.u['1966'];
      Object.assign(S, cam({ p: [-6.4, 2.6, zOf(5.6)], l: [-0.9, 1.1, zOf(7.6)], f: 30 }, { p: [-6.0, 2.4, zOf(6.2)], l: [-0.9, 1.1, zOf(7.8)], f: 30 })); S.focusOn = [-0.9, 1.5, zOf(7)]; S.K = 35; S.subframes = 6;
      on('a2-7374.1|1973', s.start + 3.5, LBL({ id: 'b1-1973', text: '1973', world: [0, stoneTop(7) + 2.9, zOf(7)], size: 44, level: 2, claims: [{ id: 'y1973', text: '1973' }], year: 1973 }));
      on('a2-7374.1|1974', s.start + 4.7, LBL({ id: 'b1-1974', text: '1974', world: [0, stoneTop(8) + 2.9, zOf(8)], size: 44, level: 2, claims: [{ id: 'y1974', text: '1974' }], year: 1974 }));
      break; }
    case 'a2-1974inf.1': {
      Object.assign(S, LIBRARY.storm()); const s = sentence('a2-1974inf.1'); S.u['1966'] = lerp(7.95, 8.72, clamp((t - s.start) / (s.end - s.start))); S.u.mirror = S.u['1966'];
      Object.assign(S, cam({ p: [-7.4, 1.9, zOf(8)], l: [0, 1.2, zOf(8)], f: 32 }, { p: [-6.9, 1.9, zOf(8)], l: [0, 1.2, zOf(8)], f: 32 })); S.focusOn = [-0.9, 1.5, zOf(8)]; S.K = 30; S.subframes = 6;
      const cl = at('a2-1974inf.1|14', s.start + 2.9), ci = at('a2-1974inf.1|12', s.start + 6.4);
      S.lightning = Math.max(0, 1 - Math.abs(t - cl - 0.02) / 0.09) + 0.5 * Math.max(0, 1 - Math.abs(t - cl - 0.22) / 0.07);
      S.rain = t > ci ? lerp(1, 1.8, smooth((t - ci) / 1.2)) : 1;
      S.tapScale = (D.withdrawal[8] / D.withdrawal[0]) * (t > ci ? lerp(1, 1.123, smooth((t - ci) / 0.8)) : 1);
      if (t >= cl - 0.05) S.labels.push(LBL({ id: 'b2-loss', text: 'lost 14.7%', world: tankTop('1966'), size: 52, color: C.loss, level: 1, t0: cl - 0.05, claims: [{ id: 'loss1974', text: '14.7%' }], emph: true }));
      if (t >= ci - 0.05) S.labels.push(LBL({ id: 'b2-infl', text: 'prices rose 12.3%', world: [-2.2, TB + 1.4 + stoneTop(8), zOf(8)], dx: -150, size: 40, weight: 600, color: C.inflation, level: 2, t0: ci - 0.05, claims: [{ id: 'inf1974', text: '12.3%' }] }));
      break; }
    case 'a2-bal74.1': {
      Object.assign(S, LIBRARY.storm()); S.u = { '1966': 8.74, mirror: 8.74 };
      Object.assign(S, cam({ p: [-5.2, 3.0, zOf(6.4)], l: [-0.9, 2.1, zOf(8)], f: 40 }, { p: [-4.6, 2.9, zOf(6.7)], l: [-0.9, 2.1, zOf(8)], f: 40 })); S.focusOn = [-0.9, 1.8, zOf(8)]; S.K = 55; S.subframes = 6;
      const s = sentence('a2-bal74.1'); const cb = at('a2-bal74.1|$461', s.start + 6.3);
      if (t >= cb - 0.05) { S.labels.push(LBL({ id: 'b3-bal', group: 'b3', row: 0, text: '$461,000', world: tankTop('1966'), size: 60, color: C.c1966, level: 1, t0: cb - 0.05, claims: [{ id: 'bal74', text: '$461,000' }], char: '1966', emph: true }));
        S.labels.push(LBL({ id: 'b3-basis', group: 'b3', row: 1, text: 'in 1966 dollars', world: tankTop('1966'), dy: 64, size: 34, weight: 600, color: C.dim, level: 3, t0: cb - 0.05 })); }
      break; }
    case 'a2-bal74m.1': {
      Object.assign(S, LIBRARY.day(20, 40)); S.u = { '1966': 8.74, mirror: 8.74 }; const zm = zOf(life('mirror', 8.74).pos);
      Object.assign(S, cam({ p: [5.2, 3.0, zm - 3.4], l: [0.9, 2.1, zm], f: 40 }, { p: [4.6, 2.9, zm - 3.0], l: [0.9, 2.1, zm], f: 40 })); S.focusOn = [0.9, 1.8, zm]; S.K = 55;
      const s = sentence('a2-bal74m.1'); const cb = at('a2-bal74m.1|$1', s.start + 4.5);
      if (t >= cb - 0.25) S.labels.push(LBL({ id: 'b4-badge', group: 'b4', row: 0, text: 'ILLUSTRATIVE', world: tankTop('mirror'), dy: -66, size: 28, weight: 700, color: C.badge, bg: C.badgeBg, role: 'badge', level: 3, t0: cb - 0.25 }));
      if (t >= cb - 0.05) { S.labels.push(LBL({ id: 'b4-bal', group: 'b4', row: 1, text: '$1.27 million', world: tankTop('mirror'), size: 60, color: C.cmirror, level: 1, t0: cb - 0.05, claims: [{ id: 'bal74m', text: '$1.27 million' }], char: 'mirror', emph: true }));
        S.labels.push(LBL({ id: 'b4-basis', group: 'b4', row: 2, text: 'in 1966 dollars', world: tankTop('mirror'), dy: 64, size: 34, weight: 600, color: C.dim, level: 3, t0: cb - 0.05 })); }
      break; }
    default: Object.assign(S, LIBRARY.day()); Object.assign(S, { p: [4, 4, 8], l: [0, 1, -6], f: 30, focusOn: [0, 1, 0] });
  }
  if (!S.p) Object.assign(S, { p: [4, 4, 8], l: [0, 1, -6], f: 30 });
  if (S.focus === undefined) S.focus = S.focusOn ? V(S.p).distanceTo(V(S.focusOn)) : 10;
  return S;
}
const LIBRARY = LIGHT;

// ---------------------------------------------------------------- apply a state at time t
let envKey = '', lastShadowKey = '', envTex = null;
const REFLECT = [glassMat, brassMat, steelMat, railMat];
function apply(t, S) {
  const sd = sunDir(S.sun.el, S.sun.az); const col = sunColour(S.sun.el); const horizon = clamp((S.sun.el + 1.5) / 3);
  sun.color.copy(S.rain ? new THREE.Color(0.75, 0.82, 0.95) : col); sun.intensity = S.sun.i * horizon;
  const target = V(S.l);
  sun.position.copy(target).addScaledVector(sd, 80); sun.target.position.copy(target); sun.target.updateMatrixWorld();
  rim.position.copy(target).addScaledVector(new THREE.Vector3(-sd.x, 0.4, -sd.z).normalize(), 50); rim.target.position.copy(target); rim.target.updateMatrixWorld(); rim.intensity = S.rimI;
  hemi.color.setHex(S.hemi[0]); hemi.groundColor.setHex(S.hemi[1]); hemi.intensity = S.hemi[2] + 1.8 * S.lightning; flash.intensity = 6000 * S.lightning;
  for (const s of [sky, sky2]) { const u = s.material.uniforms; u.sunPosition.value.copy(sd); u.turbidity.value = S.rain ? 18 : 4.5; u.rayleigh.value = S.rain ? 0.4 : 2.2; u.mieCoefficient.value = S.rain ? 0.02 : 0.006; u.mieDirectionalG.value = 0.86; }
  clouds.visible = MODE !== 'animatic';
  cloudMat.uniforms.time.value = t; cloudMat.uniforms.cover.value = S.cover; cloudMat.uniforms.sunDir.value.copy(sd); cloudMat.uniforms.dark.value = S.dark;
  cloudMat.uniforms.sunCol.value.copy(S.rain ? new THREE.Color(0.32, 0.36, 0.42) : col).multiplyScalar(S.rain ? 1 + 2.5 * S.lightning : 1.4 * horizon + 0.15);
  cloudMat.uniforms.base.value.setRGB(S.fog[0] * 0.55, S.fog[1] * 0.55, S.fog[2] * 0.6); cloudMat.uniforms.haze.value.setRGB(S.fog[0], S.fog[1], S.fog[2]);
  scene.fog.color.setRGB(S.fog[0] * (1 + 1.5 * S.lightning), S.fog[1] * (1 + 1.5 * S.lightning), S.fog[2] * (1 + 1.6 * S.lightning)); scene.fog.density = S.fog[3];
  const ek = [Math.round(S.sun.el * 2), Math.round(S.sun.az / 3), S.rain ? 1 : 0].join('|');
  if (ek !== envKey) { envKey = ek; if (envTex) envTex.dispose(); envTex = pmrem.fromScene(skyScene, 0.02).texture; for (const m of REFLECT) { m.envMap = envTex; m.needsUpdate = true; } }
  ground.material.color.setScalar(S.wet ? 0.6 : 1);
  // lives
  for (const who of ['1966', 'mirror']) {
    const tk = tanks[who]; const lf = life(who, S.u[who]);
    tk.g.position.set(tk.lane, lf.y, zOf(lf.pos));
    const lvl = clamp(lf.level / BMAX) * (TH - 0.08);
    tk.body.visible = lvl > 0.004; tk.body.scale.y = Math.max(lvl, 0.001); tk.body.position.y = TB + lvl / 2;
    const pa = tk.surf.geometry.attributes.position; const amp = (S.rain ? 0.016 : 0.006) * (lvl > 0.01 ? 1 : 0);
    for (let k = 0; k < pa.count; k++) { const x = pa.getX(k), z = pa.getZ(k); pa.setY(k, amp * (Math.sin(x * 7 + t * 2.1) + Math.sin(z * 9 - t * 1.7) + 0.6 * Math.sin((x + z) * 13 + t * 3.3))); }
    pa.needsUpdate = true; tk.surf.geometry.computeVertexNormals(); tk.surf.position.y = TB + lvl; tk.surf.visible = lvl > 0.004;
    // tap: thickness from the withdrawal in dollars of the day; it pours while there is money
    const scale = (S.tapScale && who === '1966') ? S.tapScale : lf.wNominal / D.withdrawal[0];
    const r = 0.03 * Math.sqrt(scale) * (S.tapOpen ?? 1);
    const flowing = !lf.empty && r > 0.003;
    const fall = lf.y + TB + 0.14; // from the spout to the ground beside the road
    tk.stream.visible = flowing; tk.stream.scale.set(r, fall, r); tk.stream.position.set(tk.side * (TW / 2 + 0.36), TB + 0.14 - fall / 2, 0.3);
    tk.stream.material.alphaMap.offset.y = -t * 2.2;
  }
  // dust and rain (rain only inside the storm cell)
  const cp = V(S.p);
  if (DUST) { const dp = dust.geometry.attributes.position; dust.visible = !S.rain; dust.material.color.copy(col);
    for (let i = 0; i < DUST; i++) { dp.setXYZ(i, cp.x + dustBase[i * 3] + 0.25 * Math.sin(t * 0.3 + i), 0.2 + ((dustBase[i * 3 + 1] + 0.08 * Math.sin(t * 0.4 + i * 1.7) + t * 0.03) % 6), cp.z - 4 + dustBase[i * 3 + 2]); }
    dp.needsUpdate = true; } else dust.visible = false;
  rain.visible = RAIN > 0; if (RAIN) { const rp = rain.geometry.attributes.position; const nR = Math.floor(RAIN * clamp((S.rain || 1) / 1.8)); const wind = 0.18 + 0.12 * ((S.rain || 1) - 1);
    for (let i = 0; i < RAIN; i++) { const sp = rainBase[i * 4 + 3] * 9; let y = (rainBase[i * 4 + 1] - t * sp) % 11; if (y < 0) y += 11;
      const x = rainBase[i * 4] + wind * y, z = STORM_Z + rainBase[i * 4 + 2];
      if (i >= nR) { rp.setXYZ(i * 2, 0, -100, 0); rp.setXYZ(i * 2 + 1, 0, -100, 0); continue; }
      rp.setXYZ(i * 2, x, y, z); rp.setXYZ(i * 2 + 1, x + wind * 0.45, y + 0.45, z); }
    rp.needsUpdate = true; rain.material.opacity = 0.3 + 0.9 * S.lightning; }
  camera.position.copy(cp); camera.fov = fovOf(S.f); camera.updateProjectionMatrix(); camera.lookAt(V(S.l)); camera.updateMatrixWorld();
  return ek + '|' + JSON.stringify(S.u) + '|' + S.l.map((x) => Math.round(x)).join(',');
}

// ---------------------------------------------------------------- frame
let frozen = null, cur = { t: -1, S: null, objs: [] };
const FPS = 30;
const storyT = (t) => (STILLS ? STILLS[clamp(Math.floor(t), 0, STILLS.length - 1)] : t);
function stateFor(t) { const S = shotState(storyT(t)); if (frozen !== null && shotAt(storyT(frozen)).id === S.shot) { const F = shotState(storyT(frozen)); S.p = F.p; S.l = F.l; S.f = F.f; } return S; }
function sceneRender(target) { renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 1); renderer.render(scene, camera); }
function post(S, colTex, depthTex) {
  let src = colTex;
  if (MODE !== 'animatic') {
    dofMat.uniforms.tCol.value = src; dofMat.uniforms.tDepth.value = depthTex; dofMat.uniforms.near.value = camera.near; dofMat.uniforms.far.value = camera.far;
    dofMat.uniforms.focus.value = S.focus; dofMat.uniforms.K.value = S.K * (RW / 1920); pass(dofMat, rtDof); src = rtDof.texture;
    brightMat.uniforms.t.value = src; brightMat.uniforms.th.value = 1.1; pass(brightMat, rtQ1);
    for (let i = 0; i < 2; i++) { blurMat.uniforms.t.value = rtQ1.texture; blurMat.uniforms.d.value.set(4 / RW, 0); pass(blurMat, rtQ2); blurMat.uniforms.t.value = rtQ2.texture; blurMat.uniforms.d.value.set(0, 4 / RH); pass(blurMat, rtQ1); }
    const sp = sunDir(S.sun.el, S.sun.az).multiplyScalar(1000).add(camera.position).project(camera);
    const sunUv = new THREE.Vector2(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5); const onScreen = sp.z < 1 && Math.abs(sp.x) < 1.6 && Math.abs(sp.y) < 1.6 && S.sun.el > -1;
    if (onScreen && S.rays > 0) { occMat.uniforms.tCol.value = colTex; occMat.uniforms.tDepth.value = depthTex; occMat.uniforms.sun.value.copy(sunUv); pass(occMat, rtRay);
      rayMat.uniforms.t.value = rtRay.texture; rayMat.uniforms.sun.value.copy(sunUv); pass(rayMat, rtRay2); }
    else { renderer.setRenderTarget(rtRay2); renderer.setClearColor(0x000000, 1); renderer.clear(); }
  } else { for (const r of [rtQ1, rtRay2]) { renderer.setRenderTarget(r); renderer.setClearColor(0x000000, 1); renderer.clear(); } }
  const f = finalMat.uniforms; f.tCol.value = src; f.tBloom.value = rtQ1.texture; f.tRay.value = rtRay2.texture; f.exposure.value = S.exposure * (1 + 0.6 * S.lightning);
  f.ray.value = (S.rays || 0) * 0.5; f.lift.value.set(...S.lift); f.gain.value.set(...S.gain); f.sat.value = S.sat; f.seed.value = (Math.round(cur.t * FPS) % 97) * 1.31; f.sharpen.value = MODE === 'fast' ? 0.35 : 0;
  if (MODE === 'animatic') pass(finalMat, null); else { pass(finalMat, rtLdr); fxaaMat.uniforms.t.value = rtLdr.texture; pass(fxaaMat, null); }
}
function renderFrame(t) {
  cur.t = t;
  const S0 = stateFor(t);
  if (MODE === 'final') {
    const N = S0.subframes || 4;
    renderer.setRenderTarget(rtHalfAcc); renderer.setClearColor(0x000000, 0); renderer.clear();
    for (let k = 0; k < N; k++) { const ts = t + ((k + 0.5) / N - 0.5) * (0.5 / FPS); const S = stateFor(ts); const sk = apply(ts, S);
      if (k === 0 && (sk !== lastShadowKey)) { renderer.shadowMap.needsUpdate = true; lastShadowKey = sk; }
      sceneRender(rtHalf); accMat.uniforms.t.value = rtHalf.texture; accMat.uniforms.w.value = 1 / N; pass(accMat, rtHalfAcc, false); }
    const S = stateFor(t); apply(t, S); sceneRender(rtHalf); copyMat.uniforms.t.value = rtHalf.texture; pass(copyMat, rtHalfC); sceneRender(rtScene);
    resMat.uniforms.tFull.value = rtScene.texture; resMat.uniforms.tAcc.value = rtHalfAcc.texture; resMat.uniforms.tC.value = rtHalfC.texture; pass(resMat, rtAcc);
    post(S, rtAcc.texture, rtScene.depthTexture); cur = { t, S, objs: objectsFor(t, S), rendered: N };
  } else if (MODE === 'fast') {
    // cameras at the shutter's open and close (180 degrees) for the velocity blur
    const h = 0.25 / FPS; const Sa = stateFor(t - h); apply(t - h, Sa); const prevVP = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
    const Sb = stateFor(t + h); apply(t + h, Sb); const nextVP = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
    const S = stateFor(t); const sk = apply(t, S); if (sk !== lastShadowKey) { renderer.shadowMap.needsUpdate = true; lastShadowKey = sk; }
    sceneRender(rtScene);
    const vp = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
    Object.assign(mbMat.uniforms, {}); mbMat.uniforms.tCol.value = rtScene.texture; mbMat.uniforms.tDepth.value = rtScene.depthTexture;
    mbMat.uniforms.invVP.value.copy(vp).invert(); mbMat.uniforms.prevVP.value.copy(prevVP); mbMat.uniforms.nextVP.value.copy(nextVP); pass(mbMat, rtMB);
    post(S, rtMB.texture, rtScene.depthTexture); cur = { t, S, objs: objectsFor(t, S), rendered: 1 };
  } else {
    const S = stateFor(t); const sk = apply(t, S); if (sk !== lastShadowKey) { renderer.shadowMap.needsUpdate = true; lastShadowKey = sk; }
    sceneRender(rtScene); post(S, rtScene.texture, rtScene.depthTexture); cur = { t, S, objs: objectsFor(t, S), rendered: 1 };
  }
  drawText(cur.objs, true);
  return cur.rendered;
}

// ---------------------------------------------------------------- labels: dark plates, attached, pushed clear of tanks and stones
const PAD = 0.32;
function projBox(obj) {
  const box3 = new THREE.Box3().setFromObject(obj); const xs = [], ys = [];
  for (const cx of [box3.min.x, box3.max.x]) for (const cy of [box3.min.y, box3.max.y]) for (const cz of [box3.min.z, box3.max.z]) {
    const p = new THREE.Vector3(cx, cy, cz).applyMatrix4(camera.matrixWorldInverse); if (p.z > -0.1) return null; p.applyMatrix4(camera.projectionMatrix); xs.push((p.x * 0.5 + 0.5) * OW); ys.push((-p.y * 0.5 + 0.5) * OH); }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
function objectsFor(t, S) {
  const objs = [{ id: 'bg', kind: 'shape', tag: 'rect', role: 'bg', fill: '#000000', stroke: null, opacity: 1, box: [0, 0, OW, OH], key: 'bg', sig: 'bg' }];
  const data = [];
  for (const who of ['1966', 'mirror']) { const b = projBox(tanks[who].g); if (b && b[2] > 0 && b[0] < OW && b[3] > 0 && b[1] < OH) { data.push(b); objs.push({ id: 'tank-' + who, kind: 'shape', tag: 'mesh', role: 'data', char: who, shape: who === '1966' ? 'tank-solid' : 'tank-dashed', fill: who === '1966' ? C.c1966 : C.cmirror, stroke: null, opacity: 1, box: b, key: 'tank-' + who, sig: 'tank-' + who + '|' + b.map((v) => v.toFixed(0)).join(',') }); } }
  stones.forEach((m) => { const b = projBox(m.children[0]); if (b && b[2] > 0 && b[0] < OW && b[3] > 0 && b[1] < OH) { const vis = [b[0], Math.max(b[1], 0), b[2], Math.min(b[3], OH)]; data.push(vis); objs.push({ id: m.userData.id, kind: 'shape', tag: 'mesh', role: 'data', year: m.userData.year, fill: '#8a8278', stroke: null, opacity: 1, box: vis, key: m.userData.id, sig: m.userData.id + '|' + b.map((v) => v.toFixed(0)).join(',') }); } });
  const placed = [];
  // labels with the same group form one stack (badge, value, basis from top to bottom) anchored above its object
  const groups = []; const seenG = {};
  for (const L0 of S.labels) { const a = clamp((t - L0.t0) / (L0.fade || 0.25)); if (a <= 0) continue; const L = { ...L0, size: L0.size * TS, _a: a };
    const g = L.group || L.id; if (!(g in seenG)) { seenG[g] = groups.length; groups.push([]); } groups[seenG[g]].push(L); }
  for (const G of groups) {
    G.sort((p, q) => (p.row ?? 1) - (q.row ?? 1));
    const m = G.map((L) => { tctx.font = `${L.weight} ${L.size}px Inter`; const w = tctx.measureText(L.text).width; const pad = L.size * PAD; return { L, w, pad, h: L.size * 1.02 + pad * 1.4 }; });
    const H = m.reduce((s, r) => s + r.h, 0) + 6 * TS * (m.length - 1); const Wd = Math.max(...m.map((r) => r.w + 2 * r.pad));
    const L1 = G[0]; let x, yb; // yb = bottom of the stack
    if (L1.screen) { x = L1.screen[0] * TS; yb = L1.screen[1] * TS + m[0].h / 2; } else { const p = V(L1.world).project(camera); x = (p.x * 0.5 + 0.5) * OW + (L1.dx || 0) * TS; yb = (-p.y * 0.5 + 0.5) * OH + (L1.dy || 0) * TS; }
    const boxAt = (x, yb) => [x - Wd / 2, yb - H, x + Wd / 2, yb];
    let box = boxAt(x, yb), tries = 0;
    const blocked = (bx) => data.some((d) => hit(bx, d)) || placed.some((p) => hit(bx, p));
    while (!L1.screen && blocked(box) && tries < 80) { yb -= 8 * TS; if (yb - H < 60 * TS) { yb = (-V(L1.world).project(camera).y * 0.5 + 0.5) * OH; x += (x < OW / 2 ? -1 : 1) * 80 * TS; } box = boxAt(x, yb); tries++; }
    x = clamp(x, 100 * TS + Wd / 2, OW - 100 * TS - Wd / 2); yb = clamp(yb, 60 * TS + H, OH - 60 * TS); box = boxAt(x, yb); placed.push(box);
    let yTop = yb - H;
    for (const r of m) {
      const L = r.L; const y = yTop + r.pad * 0.7 + L.size * 0.8; const x0 = x - r.w / 2; const pbox = [x - r.w / 2 - r.pad, yTop, x + r.w / 2 + r.pad, yTop + r.h]; yTop += r.h + 6 * TS;
      tctx.font = `${L.weight} ${L.size}px Inter`;
      const claims = (L.claims || []).map((c) => { const i = L.text.indexOf(c.text); const cx0 = x0 + tctx.measureText(L.text.slice(0, i)).width; const cw = tctx.measureText(c.text).width;
        return { id: c.id, text: c.text, box: [cx0, y - L.size * 0.74, cx0 + cw, y + L.size * 0.2], opacity: L._a, color: L.color, series: null, roll: false }; });
      objs.push({ id: L.id, kind: 'text', tid: L.id, role: L.role || 'label', text: L.text, box: [x0, y - L.size * 0.74, x0 + r.w, y + L.size * 0.2], opacity: L._a, level: L.level ?? null, emph: !!L.emph, series: null, anchor: null, chart: null, year: L.year ?? null, char: L.char || null,
        runs: [{ color: L.color, size: L.size }], color: L.color, fontPx: L.size, background: L.plate ? (L.bg ? '#2b2440' : '#0b0f17') : null, parent: null, claims, key: L.id,
        sig: L.id + '|' + L.text + '|' + pbox.map((v) => v.toFixed(0)).join(',') + '|' + L._a.toFixed(2), _L: L, _p: { x0, y, box: pbox } });
    }
  }
  return objs;
}
let textOnly = null;
function drawText(objs, plates) {
  tctx.clearRect(0, 0, OW, OH);
  for (const o of objs) { if (o.kind !== 'text') continue; if (textOnly && !textOnly.has(o.id)) continue; const L = o._L, P = o._p;
    tctx.globalAlpha = o.opacity;
    if (plates && L.plate) { const [a, b, c, d] = P.box; const r = 10 * TS; tctx.fillStyle = L.bg || 'rgba(11,15,23,0.8)'; tctx.beginPath(); tctx.roundRect(a, b, c - a, d - b, r); tctx.fill(); }
    tctx.font = `${L.weight} ${L.size}px Inter`; tctx.textBaseline = 'alphabetic'; tctx.textAlign = 'left'; tctx.fillStyle = L.color; tctx.fillText(L.text, P.x0, P.y); }
  tctx.globalAlpha = 1;
}
const flatMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
function drawGraphics(ids) {
  const keep = new Set(); const show = (o) => { keep.add(o); o.traverse((c) => keep.add(c)); };
  for (const m of stones) if (!ids || ids.has(m.userData.id)) show(m.children[0]);
  for (const who of ['1966', 'mirror']) if (!ids || ids.has('tank-' + who)) show(tanks[who].g);
  const vis = new Map(); scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isLineSegments) { vis.set(o, o.visible); if (!keep.has(o)) o.visible = false; } });
  const fog = scene.fog; scene.fog = null; scene.overrideMaterial = flatMat;
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
  scene.overrideMaterial = null; scene.fog = fog; for (const [o, v] of vis) o.visible = v;
}
function b64(u8) { let s = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
const comp = document.createElement('canvas'); comp.width = OW; comp.height = OH; const cctx = comp.getContext('2d', { willReadFrequently: true });
window.CHECKS = {
  seek: (t) => { const S = stateFor(t); apply(storyT(t), S); cur = { t, S, objs: objectsFor(t, S) }; drawText(cur.objs, true); glCanvas.style.visibility = 'visible'; return 1; },
  freeze: (t) => { frozen = t; },
  objects: () => cur.objs.map(({ _L, _p, ...o }) => o),
  layer: (name, ids) => {
    const set = ids && ids.length ? new Set(ids) : null;
    if (!name || name === 'all') { textOnly = null; drawText(cur.objs, true); glCanvas.style.visibility = 'visible'; textCanvas.style.visibility = 'visible'; return; }
    if (name === 'text') { textOnly = null; drawText(cur.objs, true); glCanvas.style.visibility = 'hidden'; textCanvas.style.visibility = 'visible'; return; }
    if (name === 'glyph') { textOnly = null; drawText(cur.objs, false); glCanvas.style.visibility = 'hidden'; textCanvas.style.visibility = 'visible'; return; }
    if (name === 'graphics') { glCanvas.style.visibility = 'visible'; textCanvas.style.visibility = 'hidden'; drawGraphics(null); return; }
    if (name === 'notext') { textCanvas.style.visibility = 'hidden'; glCanvas.style.visibility = 'visible'; return; }
    if (name === 'only') { const isText = cur.objs.some((o) => o.kind === 'text' && set && set.has(o.id));
      if (isText) { textOnly = set; drawText(cur.objs, true); glCanvas.style.visibility = 'hidden'; textCanvas.style.visibility = 'visible'; textOnly = null; }
      else { textCanvas.style.visibility = 'hidden'; glCanvas.style.visibility = 'visible'; drawGraphics(set); } }
  },
};
window.RENDER = {
  frameB64: (t) => { const n = renderFrame(t); cctx.clearRect(0, 0, OW, OH); cctx.drawImage(glCanvas, 0, 0); cctx.drawImage(textCanvas, 0, 0);
    return { b64: b64(new Uint8Array(cctx.getImageData(0, 0, OW, OH).data.buffer)), rendered: n }; },
  texts: () => cur.objs.filter((o) => o.kind === 'text' && o.opacity > 0.5).map((o) => [o.tid, (o.box[0] + o.box[2]) / 2, o.level, o.role, o.claims.length]),
  camera: (t) => { const S = stateFor(t); return { t, pos: S.p, target: S.l, fovDeg: +fovOf(S.f).toFixed(3), focusDist: +S.focus.toFixed(3), coc: +clamp(S.K * Math.abs(1 / S.focus - 1 / 60), 0, 22).toFixed(3) }; },
  total: STILLS ? STILLS.length : D.total, size: [OW, OH], mode: MODE,
};
window.READY = true;
