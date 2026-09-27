// Test D M2b lookdev: one physical world (render-d/look). The money of each retiree is liquid in a glass tank (level =
// real balance, the withdrawal is the stream that leaves it); the 30 years are a road of stones whose height is the year's
// real 60/40 return. Light tells the story: dawn in 1966, a cold storm in 1973-74, dusk after 1986.
// Rendering: three.js (WebGL2) into linear HDR targets; N subframes spread over a 180-degree shutter, each with a
// sub-pixel jitter, are averaged (motion blur + anti-aliasing); depth of field is gathered from the depth of the centre
// subframe; bloom + sun shafts + ACES + grade + dither in the final pass. Text is a 2D layer anchored to world points.
// Contract for checks: window.CHECKS {seek, freeze, objects, layer}; exporter: window.RENDER.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const D = window.DATA;
const W = 1920, H = 1080;
const C = { c1966: '#ffc857', cmirror: '#5a9ceb', text: '#f2f4f8', dim: '#b8c2d0', loss: '#e8766a', inflation: '#c98bd8' };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * u * (u * (6 * u - 15) + 10); };
// eased travel with a small settle (inertia): -1% wind-up, +2% overshoot that settles
const inertia = (u) => { u = clamp(u); const s = smooth(u); return s - (u < 0.25 ? 0.01 * Math.sin(Math.PI * u / 0.25) : 0) + (u > 0.65 ? 0.02 * Math.sin(Math.PI * (u - 0.65) / 0.35) : 0); };
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const mixV = (a, b, u) => a.map((x, i) => lerp(x, b[i], u));
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const cue = (k, d) => (k in D.cues ? D.cues[k] : d);
const sceneAt = (t) => D.scenes.find((s) => t >= s.start && t < s.start + s.dur) || D.scenes[D.scenes.length - 1];
const bal = (who, u) => { const a = D.balance[who]; const i = clamp(Math.floor(u), 0, a.length - 2); return Math.max(0, lerp(a[i], a[i + 1], clamp(u - i))); };
const BMAX = Math.max(...D.balance['1966'], ...D.balance.mirror) * 1.12;

// ---------------------------------------------------------------- renderer and targets
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, alpha: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const glCanvas = renderer.domElement; document.body.appendChild(glCanvas);
const textCanvas = document.createElement('canvas'); textCanvas.width = W; textCanvas.height = H; document.body.appendChild(textCanvas);
const tctx = textCanvas.getContext('2d');
const HF = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rtScene = new THREE.WebGLRenderTarget(W, H, { ...HF, depthTexture: new THREE.DepthTexture(W, H) });
const rtAcc = new THREE.WebGLRenderTarget(W, H, HF);
const rtDof = new THREE.WebGLRenderTarget(W, H, HF);
const rtQ1 = new THREE.WebGLRenderTarget(W / 4, H / 4, HF), rtQ2 = new THREE.WebGLRenderTarget(W / 4, H / 4, HF);
const rtRay = new THREE.WebGLRenderTarget(W / 2, H / 2, HF), rtRay2 = new THREE.WebGLRenderTarget(W / 2, H / 2, HF);
const rtHalf = new THREE.WebGLRenderTarget(W / 2, H / 2, { ...HF, depthTexture: new THREE.DepthTexture(W / 2, H / 2) });
const rtHalfAcc = new THREE.WebGLRenderTarget(W / 2, H / 2, HF), rtHalfC = new THREE.WebGLRenderTarget(W / 2, H / 2, HF);
const rtLdr = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
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
const fxaaMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, uniforms: { t: { value: null }, px: { value: new THREE.Vector2(1 / W, 1 / H) } },
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
  uniforms: { tCol: { value: null }, tDepth: { value: null }, near: { value: 0.1 }, far: { value: 3000 }, focus: { value: 5 }, K: { value: 0 }, maxR: { value: 22 }, px: { value: new THREE.Vector2(1 / W, 1 / H) } },
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
const occMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, uniforms: { tCol: { value: null }, tDepth: { value: null }, sun: { value: new THREE.Vector2() }, aspect: { value: W / H } },
  fragmentShader: `uniform sampler2D tCol, tDepth; uniform vec2 sun; uniform float aspect; varying vec2 vUv; void main(){
    float sky = step(0.99999, texture2D(tDepth, vUv).x); vec2 d = (vUv - sun) * vec2(aspect, 1.0);
    gl_FragColor = vec4(texture2D(tCol, vUv).rgb * sky * exp(-dot(d, d) * 6.0), 1.0); }` });
const rayMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, uniforms: { t: { value: null }, sun: { value: new THREE.Vector2() } },
  fragmentShader: `uniform sampler2D t; uniform vec2 sun; varying vec2 vUv; void main(){ vec2 dt = (vUv - sun) / 48.0 * 0.9; vec2 uv = vUv; vec3 s = vec3(0.0); float decay = 1.0;
    for (int i = 0; i < 48; i++) { uv -= dt; s += texture2D(t, uv).rgb * decay; decay *= 0.965; } gl_FragColor = vec4(s / 48.0, 1.0); }` });
const finalMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false,
  uniforms: { tCol: { value: null }, tBloom: { value: null }, tRay: { value: null }, exposure: { value: 1 }, bloom: { value: 0.06 }, ray: { value: 0 }, lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) },
    vig: { value: 0.18 }, seed: { value: 0 }, sat: { value: 1 } },
  fragmentShader: `uniform sampler2D tCol, tBloom, tRay; uniform float exposure, bloom, ray, vig, seed, sat; uniform vec3 lift, gain; varying vec2 vUv;
  vec3 aces(vec3 x){ return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){ vec3 c = texture2D(tCol, vUv).rgb + texture2D(tBloom, vUv).rgb * bloom + texture2D(tRay, vUv).rgb * ray;
    c *= exposure; c = aces(c); float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, sat);
    c = c * gain + lift * (1.0 - c);
    vec2 q = vUv - 0.5; c *= 1.0 - vig * smoothstep(0.25, 0.85, length(q * vec2(1.0, 0.8)) * 1.25);
    c = mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    float n = h(gl_FragCoord.xy + seed) + h(gl_FragCoord.xy * 1.37 + seed + 17.0) - 1.0; c += n / 255.0;
    gl_FragColor = vec4(c, 1.0); }` });

// ---------------------------------------------------------------- textures (procedural, seeded)
function noiseTex(size, seed, fn, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d'); const im = x.createImageData(size, size); const r = rng(seed);
  const g = new Float32Array(64 * 64).map(() => r());
  const vn = (u, v, f) => { u = u * f; v = v * f; const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, s = (p, q) => g[((p % 64 + 64) % 64) * 64 + ((q % 64 + 64) % 64)];
    const A = s(i, j), B = s(i + 1, j), Cc = s(i, j + 1), Dd = s(i + 1, j + 1), sa = a * a * (3 - 2 * a), sb = b * b * (3 - 2 * b); return lerp(lerp(A, B, sa), lerp(Cc, Dd, sa), sb); };
  const fbm = (u, v) => { let s = 0, amp = 0.5, f = 4; for (let o = 0; o < 5; o++) { s += amp * vn(u, v, f); amp *= 0.5; f *= 2; } return s; };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const c = fn(fbm(i / size, j / size), r, i / size, j / size); const k = (j * size + i) * 4; im.data[k] = c[0]; im.data[k + 1] = c[1]; im.data[k + 2] = c[2]; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t;
}
const soilTex = noiseTex(512, 11, (n, r) => { const v = 38 + n * 50 + r() * 10; return [v * 1.05, v * 0.95, v * 0.85]; });
soilTex.repeat.set(60, 60);
const soilRough = noiseTex(512, 12, (n) => { const v = 150 + n * 100; return [v, v, v]; }, false); soilRough.repeat.set(60, 60);
const stoneTex = noiseTex(256, 21, (n, r) => { const v = 95 + n * 70 + r() * 12; return [v, v * 0.97, v * 0.92]; });
const stoneRough = noiseTex(256, 22, (n) => { const v = 120 + n * 110; return [v, v, v]; }, false);
const streamTex = noiseTex(128, 31, (n, r, u, v) => { const s = 180 + 75 * Math.sin(v * Math.PI * 16 + n * 6); return [s, s, s]; }, false);
function dotTex() { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); }

// ---------------------------------------------------------------- world
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x404850, 0.012);
const sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky);
const skyScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(4000); skyScene.add(sky2);
const pmrem = new THREE.PMREMGenerator(renderer);
// clouds: a dome of moving fbm noise lit from the sun side
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
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 }); scene.add(sun); scene.add(sun.target);
const rim = new THREE.DirectionalLight(0x9cc4ff, 0.5); scene.add(rim); scene.add(rim.target);
const hemi = new THREE.HemisphereLight(0x8090b0, 0x2a2018, 0.4); scene.add(hemi);
const flash = new THREE.PointLight(0xdfe8ff, 0, 0, 0); flash.position.set(-30, 60, -60); scene.add(flash);

// the road: 30 stones 1966..1995 along -z, 2.2 m apart; top height = 0.9 m + 2.6 m x real return
const PITCH = 2.2, BASE = 0.9, GAIN = 2.6;
const stoneTop = (i) => BASE + GAIN * D.years[i].real;
const stones = D.years.map((yr, i) => {
  const r = rng(100 + i); const m = new THREE.MeshStandardMaterial({ map: stoneTex, roughnessMap: stoneRough, roughness: 1, color: new THREE.Color().setHSL(0.08, 0.08, 0.5 + r() * 0.12) });
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(1.8, 4, 1.9, 2, 0.07), m); mesh.castShadow = mesh.receiveShadow = true;
  mesh.position.set((r() - 0.5) * 0.08, stoneTop(i) - 2, -i * PITCH); mesh.rotation.y = (r() - 0.5) * 0.03; mesh.userData = { id: 'stone-' + yr.y, data: true, year: yr.y }; scene.add(mesh); return mesh;
});
// kerb stones along the road (small, low) for scale and parallax
const kerbGeo = new RoundedBoxGeometry(0.5, 0.3, 0.6, 1, 0.05);
const kerbMat = new THREE.MeshLambertMaterial({ map: stoneTex, color: 0x8a8278 });
const kerbs = new THREE.InstancedMesh(kerbGeo, kerbMat, 140); { const r = rng(7); const m = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < 70; i++) for (const s of [-1, 1]) { m.makeRotationY((r() - 0.5) * 0.6); m.setPosition(s * (1.45 + r() * 0.5), 0.1 + r() * 0.05, 4 - i * 1.0 - r() * 0.4); kerbs.setMatrixAt(k++, m); } }
kerbs.castShadow = kerbs.receiveShadow = true; scene.add(kerbs);

// tanks: steel plinth, brass frame, glass, liquid body + rippling surface, spout and falling stream
const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.02, transparent: true, opacity: 0.12, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false });
const steelMat = new THREE.MeshStandardMaterial({ color: 0x8c9096, metalness: 1, roughness: 0.32, envMapIntensity: 1.2 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 1, roughness: 0.28, envMapIntensity: 1.3 });
const TW = 1.6, TH = 2.6, TB = 0.32; // inner width, glass height, plinth height
function makeTank(who, col) {
  const g = new THREE.Group(); g.userData = { id: 'tank-' + who, data: true, char: who };
  const pl = new THREE.Mesh(new RoundedBoxGeometry(TW + 0.5, TB, TW + 0.5, 2, 0.04), steelMat); pl.position.y = TB / 2; pl.castShadow = pl.receiveShadow = true; g.add(pl);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(TW, TH, TW), glassMat); gl.position.y = TB + TH / 2; gl.renderOrder = 3; g.add(gl);
  const e = 0.07;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(e, TH + e, e), brassMat); p.position.set(sx * TW / 2, TB + TH / 2, sz * TW / 2); p.castShadow = true; g.add(p); }
  for (const y of [TB, TB + TH]) for (const [w, d, x, z] of [[TW, e, 0, -TW / 2], [TW, e, 0, TW / 2], [e, TW, -TW / 2, 0], [e, TW, TW / 2, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w + e, e, d + e), brassMat); b.position.set(x, y, z); b.castShadow = true; g.add(b); }
  const c = new THREE.Color(col);
  const liqMat = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.55), roughness: 0.25, metalness: 0, transparent: true, opacity: 0.93, emissive: c, emissiveIntensity: 0.22, envMapIntensity: 0.4, depthWrite: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(TW - 0.04, 1, TW - 0.04), liqMat); body.castShadow = true; body.renderOrder = 1; g.add(body);
  const surfGeo = new THREE.PlaneGeometry(TW - 0.04, TW - 0.04, 24, 24); surfGeo.rotateX(-Math.PI / 2);
  const surfMat = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.6), roughness: 0.08, transparent: true, opacity: 0.95, emissive: c, emissiveIntensity: 0.22, envMapIntensity: 0.9 });
  const surf = new THREE.Mesh(surfGeo, surfMat); surf.renderOrder = 2; g.add(surf);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 16), brassMat); spout.rotation.x = Math.PI / 2; spout.position.set(0.35, TB + 0.16, TW / 2 + 0.18); g.add(spout);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.35, TB + 0.16, TW / 2 + 0.36), new THREE.Vector3(0.35, TB + 0.16, TW / 2 + 0.75), new THREE.Vector3(0.35, 0.02, TW / 2 + 0.9));
  const sm = new THREE.MeshStandardMaterial({ color: c, roughness: 0.05, transparent: true, opacity: 0.85, emissive: c, emissiveIntensity: 0.15, alphaMap: streamTex, envMapIntensity: 1.4 });
  const stream = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.032, 10, false), sm); g.add(stream);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshStandardMaterial({ color: c, roughness: 0.04, transparent: true, opacity: 0.55, envMapIntensity: 1.5 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0.35, 0.012, TW / 2 + 0.95); g.add(pool);
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 10, 8), sm, 12); g.add(drops);
  scene.add(g);
  return { g, body, surf, stream, pool, drops, curve, who, col };
}
const tanks = { '1966': makeTank('1966', C.c1966), mirror: makeTank('mirror', C.cmirror) };

// dust (sunlit motes) and rain
const DUST = 2600; const dustGeo = new THREE.BufferGeometry(); const dustBase = new Float32Array(DUST * 3); { const r = rng(5); for (let i = 0; i < DUST; i++) { dustBase[i * 3] = (r() - 0.5) * 24; dustBase[i * 3 + 1] = r() * 6; dustBase[i * 3 + 2] = (r() - 0.5) * 30; } }
dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.035, map: dotTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd8a8, opacity: 0.8 })); scene.add(dust);
const RAIN = 7000; const rainGeo = new THREE.BufferGeometry(); const rainBase = new Float32Array(RAIN * 4); { const r = rng(9); for (let i = 0; i < RAIN; i++) { rainBase[i * 4] = (r() - 0.5) * 36; rainBase[i * 4 + 1] = r() * 14; rainBase[i * 4 + 2] = (r() - 0.5) * 40; rainBase[i * 4 + 3] = 0.8 + r() * 0.4; } }
rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN * 6), 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xaebfd6, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(rain);

const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 3000);
const fovOf = (f) => 2 * Math.atan(12 / f) * 180 / Math.PI;

// ---------------------------------------------------------------- the story as states over time
// sun: elevation/azimuth in degrees (azimuth 0 = straight down the road, negative = left)
function sunDir(el, az) { const e = el * Math.PI / 180, a = az * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)); }
function sunColour(el) { const k = clamp((el + 1) / 25); return new THREE.Color().setRGB(1, lerp(0.42, 0.93, k), lerp(0.2, 0.84, k)); }
const A_POS = { '1966': [-2.4, 0, 3.2], mirror: [2.4, 0, 3.2] };
const B_POS = { '1966': [-2.3, 0, -15.2], mirror: [2.9, 0, -18.8] };
const T = (id) => D.scenes.find((s) => s.id === id);
const st = (id) => T(id).start, en = (id) => T(id).start + T(id).dur;

// camera keys per shot: [t0, t1, from {p, l, f}, to {p, l, f}]; focus: world point or distance keys
function shotState(t) {
  const sc = sceneAt(t); const id = sc.id; const L = t - sc.start; const S = {};
  S.scene = id; S.tank = { '1966': A_POS['1966'], mirror: A_POS.mirror }; S.u = { '1966': 0, mirror: 0 };
  S.labels = []; S.sinks = {}; S.rain = 0; S.lightning = 0; S.dust = 1; S.subframes = 4;
  const cam = (t0, t1, a, b) => { const u = inertia((t - t0) / (t1 - t0)); return { p: mixV(a.p, b.p, u), l: mixV(a.l, b.l, u), f: lerp(a.f, b.f, u) }; };
  const dawn = (el, az) => Object.assign(S, { sun: { el, az, i: 3.2 }, cover: 0.32, dark: 0, fog: [0.62, 0.52, 0.48, 0.010], hemi: [0x7d8fb0, 0x2c2218, 0.45], rimI: 0.35, exposure: 0.55, lift: [0.012, 0.010, 0.016], gain: [1.02, 1.0, 0.96], sat: 1.0, rays: 0.9 }, { fog: [0.62, 0.52, 0.48, 0.0065], exposure: 0.85 });
  const dusk = (el, az) => Object.assign(S, { sun: { el, az, i: 2.6 }, cover: 0.45, dark: 0, fog: [0.48, 0.34, 0.36, 0.012], hemi: [0x5a6a9a, 0x24181a, 0.35], rimI: 0.55, exposure: 0.62, lift: [0.014, 0.008, 0.02], gain: [1.03, 0.98, 0.97], sat: 1.02, rays: 1.0 });
  const storm = () => Object.assign(S, { sun: { el: 58, az: -35, i: 0.55 }, cover: 0.97, dark: 0.75, fog: [0.16, 0.19, 0.23, 0.045], hemi: [0x7d8fa8, 0x2a2c30, 0.75], rimI: 0.35, exposure: 1.3, lift: [0.006, 0.010, 0.016], gain: [0.95, 0.99, 1.05], sat: 0.95, rays: 0, rain: 1, dust: 0.15, subframes: 6, wet: 1 });
  if (id === 'co-lines' || id === 'co-same') {
    // dawn: a crane down from above the road to the two full tanks; the sun comes up behind them
    dawn(lerp(1.2, 4.2, clamp(t / 7.5)), -24);
    Object.assign(S, cam(0.2, 7.3, { p: [2.2, 9.5, 24], l: [0, 1.0, -8], f: 24 }, { p: [0.3, 1.75, 10.8], l: [0, 1.5, 0], f: 32 }));
    S.focus = 8.6; S.K = 60;
  } else if (id === 'co-broke') {
    // 25 years in 2.3 s: the sun arcs over the road and sets, the 1966 tank drains, the mirror tank climbs
    const t0 = st('co-broke') + 0.25, t1 = cue('co-broke.1|1991', 10.07);
    const k = clamp((t - t0) / (t1 - t0)); const ku = smooth(k);
    S.u = { '1966': 25.62 * ku, mirror: 25.62 * ku };
    const el = k < 1 ? 4 + 38 * Math.sin(Math.PI * Math.min(1, ku * 1.04)) : -0.4 - 1.2 * clamp((t - t1) / 2);
    (k < 0.8 ? dawn : dusk)(Math.max(el, -1.6), lerp(-60, 62, ku));
    Object.assign(S, cam(st('co-broke') + 0.2, t1 + 0.6, { p: [0.3, 2.3, 13.8], l: [0, 1.55, 2.5], f: 38 }, { p: [-1.0, 1.95, 10.6], l: [-0.9, 1.65, 3.0], f: 45 }));
    S.focus = 7.7; S.K = 70; S.subframes = 8;
    if (t >= t1 - 0.05) S.labels.push({ id: 'cb-1991', text: '1991', world: [0.0, 2.75, 3.2], dx: 0, dy: 0, size: 76, weight: 700, color: C.c1966, level: 1, t0: t1 - 0.05, claims: [{ id: 'y1991', text: '1991' }], char: '1966', emph: true });
  } else if (id === 'co-question') {
    // dusk close-up: the dry 1966 tank in front, the full mirror tank behind; focus racks across on "decided"
    dusk(-0.8, 58); S.u = { '1966': 25.62, mirror: 25.62 };
    Object.assign(S, cam(st('co-question'), en('co-question'), { p: [-5.6, 1.5, 8.9], l: [0.4, 1.45, 2.9], f: 50 }, { p: [-5.35, 1.47, 8.5], l: [0.6, 1.45, 2.9], f: 50 }));
    const rc = cue('co-question.1|decided', 13.62); const u = smooth((t - (rc - 0.35)) / 0.8);
    const cq = V(S.p); S.focus = lerp(cq.distanceTo(V([-2.4, 1.4, 3.2])), cq.distanceTo(V([2.4, 1.4, 3.2])), u); S.K = 170; S.rackTurn = rc;
  } else if (id === 'ident') {
    dusk(-1.5, 40); S.u = { '1966': 25.62, mirror: 25.62 };
    Object.assign(S, cam(st('ident'), en('ident') + 0.4, { p: [0.0, 3.6, 1.2], l: [0, 0.9, -22], f: 30 }, { p: [0.0, 6.4, 0.2], l: [0, 0.4, -26], f: 30 }));
    S.focus = 16; S.K = 40;
    S.labels.push({ id: 'id-title', text: 'Same average, different fate', screen: [960, 330], size: 72, weight: 700, color: C.text, level: 1, t0: st('ident') + 0.15, fade: 0.5 });
  } else {
    storm(); S.tank = B_POS;
    if (id === 'a2-7374') {
      // walking down the road into the storm; 1973 and 1974 are the low stones ahead
      S.u = { '1966': lerp(7, 8, clamp((t - st(id) - 0.3) / (T(id).dur - 0.6))), mirror: 0 };
      S.u.mirror = S.u['1966'];
      Object.assign(S, cam(st(id), en(id) + 0.5, { p: [0.15, 2.05, -3.2], l: [0.0, 0.8, -20], f: 28 }, { p: [0.05, 1.85, -8.4], l: [0.0, 0.7, -21], f: 28 }));
      S.focus = 9.5; S.K = 45; S.sinks[1974] = 0;
      const c73 = cue('a2-7374.1|1973', 20.67), c74 = cue('a2-7374.1|1974', 21.95);
      if (t >= c73 - 0.05) S.labels.push({ id: 'b1-1973', text: '1973', world: [0, stoneTop(7) + 1.1, -7 * PITCH], size: 48, weight: 600, color: C.text, level: 2, t0: c73 - 0.05, claims: [{ id: 'y1973', text: '1973' }], year: 1973 });
      if (t >= c74 - 0.05) S.labels.push({ id: 'b1-1974', text: '1974', world: [0, BASE + 1.1, -8 * PITCH], size: 48, weight: 600, color: C.text, level: 2, t0: c74 - 0.05, claims: [{ id: 'y1974', text: '1974' }], year: 1974 });
    } else if (id === 'a2-1974inf') {
      // low at the 1974 stone: the loss sinks it, then rising prices sink it further (its real return)
      S.u = { '1966': lerp(8, 9, clamp((t - st(id) - 0.3) / (T(id).dur - 0.6))), mirror: 0 }; S.u.mirror = S.u['1966'];
      Object.assign(S, cam(st(id), en(id) + 0.6, { p: [-6.6, 1.05, -16.9], l: [0.0, 0.75, -17.9], f: 28 }, { p: [-5.9, 0.98, -17.3], l: [0.0, 0.7, -17.9], f: 28 }));
      const cl = cue('a2-1974inf.1|14.7%', 26.39), ci = cue('a2-1974inf.1|12.3%', 29.79);
      const nomTop = BASE + GAIN * D.years[8].nominal;
      S.sinks[1974] = lerp(0, nomTop - BASE, smooth((t - cl + 0.1) / 0.9)) + lerp(0, stoneTop(8) - nomTop, smooth((t - ci + 0.1) / 0.9));
      S.focus = 6.2; S.K = 60; S.tank = { '1966': [-3.9, 0, -13.4], mirror: [4.4, 0, -21.2] }; // continuity cheat for the profile shot S.lightning = Math.max(0, 1 - Math.abs(t - cl - 0.02) / 0.09) + 0.5 * Math.max(0, 1 - Math.abs(t - cl - 0.22) / 0.07);
      S.rain = t > ci ? lerp(1, 1.8, smooth((t - ci) / 1.2)) : 1;
      if (t >= cl - 0.05) S.labels.push({ id: 'b2-loss', text: 'lost 14.7%', world: [0.0, 1.95, -17.6], size: 52, weight: 700, color: C.loss, level: 1, t0: cl - 0.05, claims: [{ id: 'loss1974', text: '14.7%' }], emph: true });
      if (t >= ci - 0.05) S.labels.push({ id: 'b2-infl', text: 'prices rose 12.3%', world: [0.0, 2.4, -17.6], size: 40, weight: 600, color: C.inflation, level: 2, t0: ci - 0.05, claims: [{ id: 'inf1974', text: '12.3%' }] });
    } else {
      // both tanks in the storm at the end of 1974: rack from the mirror (far) to the 1966 tank (near) on "retiree"
      S.u = { '1966': 9, mirror: 9 };
      Object.assign(S, cam(st(id), en(id) + 0.5, { p: [-0.1, 1.75, -8.4], l: [0.2, 1.3, -17.2], f: 40 }, { p: [-0.6, 1.68, -9.7], l: [-1.0, 1.3, -16.0], f: 40 }));
      const rc = cue('a2-bal74.1|retiree', 34.97); const u = smooth((t - (rc - 0.4)) / 0.8);
      const cp = V(S.p); S.focus = lerp(cp.distanceTo(V([2.9, 1.3, -18.8])), cp.distanceTo(V([-2.3, 1.3, -15.2])), u); S.K = 110; S.rackTurn = rc;
      S.sinks[1974] = stoneTop(8) - BASE;
      const cb = cue('a2-bal74.1|$461,000', 38.03);
      if (t >= cb - 0.05) {
        S.labels.push({ id: 'b3-bal', text: '$461,000', world: [-2.3, 3.55, -15.2], size: 64, weight: 700, color: C.c1966, level: 1, t0: cb - 0.05, claims: [{ id: 'bal74', text: '$461,000' }], char: '1966', emph: true });
        S.labels.push({ id: 'b3-basis', text: 'in 1966 dollars', world: [-2.3, 3.55, -15.2], dy: 50, size: 34, weight: 600, color: C.dim, level: 3, t0: cb - 0.05 });
      }
    }
  }
  if (S.sinks[1974] === undefined && D.scenes.indexOf(sc) < 5) S.sinks[1974] = stoneTop(8) - BASE;
  return S;
}

// ---------------------------------------------------------------- apply a state at time t (one subframe)
let envKey = '', lastShadowKey = '', envTex = null;
const REFLECT = [];
scene.traverse((o) => { if (o.material && o.material.isMeshStandardMaterial && !o.material.map && !REFLECT.includes(o.material)) { o.material.userData.envI = o.material.envMapIntensity; REFLECT.push(o.material); } });
function apply(t, S, camOverride) {
  // light
  const sd = sunDir(S.sun.el, S.sun.az); const col = sunColour(S.sun.el);
  const horizon = clamp((S.sun.el + 1.5) / 3);
  sun.color.copy(S.rain ? new THREE.Color(0.75, 0.82, 0.95) : col); sun.intensity = S.sun.i * horizon;
  const c = camOverride || S; const target = V(c.l);
  sun.position.copy(target).addScaledVector(sd, 80); sun.target.position.copy(target); sun.target.updateMatrixWorld();
  rim.position.copy(target).addScaledVector(new THREE.Vector3(-sd.x, 0.4, -sd.z).normalize(), 50); rim.target.position.copy(target); rim.target.updateMatrixWorld(); rim.intensity = S.rimI;
  hemi.color.setHex(S.hemi[0]); hemi.groundColor.setHex(S.hemi[1]); hemi.intensity = S.hemi[2] + 1.8 * S.lightning;
  flash.intensity = 9000 * S.lightning;
  for (const s of [sky, sky2]) { const u = s.material.uniforms; u.sunPosition.value.copy(sd); u.turbidity.value = S.rain ? 18 : 4.5; u.rayleigh.value = S.rain ? 0.4 : 2.2; u.mieCoefficient.value = S.rain ? 0.02 : 0.006; u.mieDirectionalG.value = 0.86; }
  cloudMat.uniforms.time.value = t; cloudMat.uniforms.cover.value = S.cover; cloudMat.uniforms.sunDir.value.copy(sd); cloudMat.uniforms.dark.value = S.dark;
  cloudMat.uniforms.sunCol.value.copy(S.rain ? new THREE.Color(0.32, 0.36, 0.42) : col).multiplyScalar(S.rain ? 1 + 2.5 * S.lightning : 1.4 * horizon + 0.15);
  cloudMat.uniforms.base.value.setRGB(S.fog[0] * 0.55, S.fog[1] * 0.55, S.fog[2] * 0.6);
  cloudMat.uniforms.haze.value.setRGB(S.fog[0], S.fog[1], S.fog[2]);
  scene.fog.color.setRGB(S.fog[0] * (1 + 1.5 * S.lightning), S.fog[1] * (1 + 1.5 * S.lightning), S.fog[2] * (1 + 1.6 * S.lightning)); scene.fog.density = S.fog[3];
  // environment (reflections) from the sky, rebuilt when the light changes
  const ek = [Math.round(S.sun.el * 2), Math.round(S.sun.az / 3), S.rain ? 1 : 0].join('|');
  if (ek !== envKey) { envKey = ek; if (envTex) envTex.dispose(); envTex = pmrem.fromScene(skyScene, 0.02).texture; for (const m of REFLECT) { m.envMap = envTex; m.needsUpdate = false; } }
  for (const m of REFLECT) m.envMapIntensity = (m.userData.envI || 1) * (S.rain ? 0.5 : 1);
  ground.material.color.setScalar(S.wet ? 0.55 : 1);
  for (const m of stones) m.material.roughness = S.wet ? 0.55 : 1;
  // stones
  stones.forEach((m, i) => { const y = D.years[i].y; const top = y in S.sinks ? BASE + S.sinks[y] : stoneTop(i); m.position.y = top - 2; });
  // tanks
  for (const who of ['1966', 'mirror']) {
    const tk = tanks[who]; tk.g.position.set(...S.tank[who]);
    const b = bal(who, S.u[who]); const lvl = clamp(b / BMAX) * (TH - 0.1);
    tk.body.visible = lvl > 0.004; tk.body.scale.y = Math.max(lvl, 0.001); tk.body.position.y = TB + lvl / 2;
    const pa = tk.surf.geometry.attributes.position; const amp = (S.rain ? 0.018 : 0.006) * (lvl > 0.01 ? 1 : 0);
    for (let k = 0; k < pa.count; k++) { const x = pa.getX(k), z = pa.getZ(k); pa.setY(k, amp * (Math.sin(x * 7 + t * 2.1) + Math.sin(z * 9 - t * 1.7) + 0.6 * Math.sin((x + z) * 13 + t * 3.3))); }
    pa.needsUpdate = true; tk.surf.geometry.computeVertexNormals(); tk.surf.position.y = TB + lvl; tk.surf.visible = lvl > 0.004;
    const flowing = b > 1000; tk.stream.visible = flowing; tk.stream.material.alphaMap.offset.y = -t * 2.2; tk.pool.visible = true;
    tk.pool.material.opacity = flowing ? 0.55 : 0.3;
    const m = new THREE.Matrix4(); const r = rng(who === '1966' ? 3 : 4);
    for (let k = 0; k < 12; k++) { const ph = r(); const u = ((t * (flowing ? 1.6 : 0.5) + ph) % 1); const show = flowing || (lvl <= 0.004 && k < 1 && u < 0.6 && S.u[who] < 26.5);
      const pnt = tk.curve.getPoint(clamp(flowing ? u : 0.3 + u)); m.makeScale(show ? 1 : 0, show ? 1.4 : 0, show ? 1 : 0); m.setPosition(pnt.x + (r() - 0.5) * 0.03, pnt.y, pnt.z); tk.drops.setMatrixAt(k, m); }
    tk.drops.instanceMatrix.needsUpdate = true;
  }
  // dust and rain around the camera
  const cp = V(c.p);
  const dp = dust.geometry.attributes.position; dust.visible = S.dust > 0.01; dust.material.opacity = 0.7 * S.dust * (0.3 + horizon); dust.material.color.copy(col);
  for (let i = 0; i < DUST; i++) { const bx = dustBase[i * 3], by = dustBase[i * 3 + 1], bz = dustBase[i * 3 + 2];
    dp.setXYZ(i, cp.x + bx + 0.25 * Math.sin(t * 0.3 + i) + t * 0.05, 0.2 + ((by + 0.08 * Math.sin(t * 0.4 + i * 1.7) + t * 0.03) % 6), cp.z - 4 + bz + 0.25 * Math.cos(t * 0.25 + i * 0.7)); }
  dp.needsUpdate = true;
  rain.visible = S.rain > 0; const rp = rain.geometry.attributes.position; const nR = Math.floor(RAIN * clamp(S.rain / 1.8)); const wind = 0.18 + 0.12 * (S.rain - 1);
  for (let i = 0; i < RAIN; i++) { const sp = rainBase[i * 4 + 3] * 9; let y = (rainBase[i * 4 + 1] - t * sp) % 14; if (y < 0) y += 14;
    const x = cp.x + rainBase[i * 4] + wind * y, z = cp.z - 10 + rainBase[i * 4 + 2];
    if (i >= nR) { rp.setXYZ(i * 2, 0, -100, 0); rp.setXYZ(i * 2 + 1, 0, -100, 0); continue; }
    rp.setXYZ(i * 2, x, y, z); rp.setXYZ(i * 2 + 1, x + wind * 0.45, y + 0.45, z); }
  rp.needsUpdate = true; rain.material.opacity = 0.26 + 0.9 * S.lightning;
  // camera
  camera.position.copy(cp); camera.fov = fovOf(c.f); camera.updateProjectionMatrix(); camera.lookAt(V(c.l)); camera.updateMatrixWorld();
  const sk = ek + '|' + [c.l.map((x) => Math.round(x)).join(',')].join() + '|' + Object.values(S.sinks).join() + JSON.stringify(S.u) + JSON.stringify(S.tank);
  return sk;
}

// ---------------------------------------------------------------- frame = N jittered subframes over a 180-degree shutter
let frozen = null, cur = { t: -1, S: null, objs: [] };
const FPS = 30;
function stateFor(t) { const S = shotState(t); if (frozen !== null && sceneAt(frozen).id === S.scene) { const F = shotState(frozen); S.p = F.p; S.l = F.l; S.f = F.f; } return S; }
function renderFrame(t) {
  // motion blur = sharp full-resolution centre pass + (average of N subframes - centre subframe), both at half resolution:
  // the residual carries only what moved during the 180-degree shutter
  const S0 = stateFor(t); const N = S0.subframes || 4; const mid = Math.floor(N / 2);
  renderer.setRenderTarget(rtHalfAcc); renderer.setClearColor(0x000000, 0); renderer.clear();
  for (let k = 0; k < N; k++) {
    const ts = t + ((k + 0.5) / N - 0.5) * (0.5 / FPS);
    const S = stateFor(ts); const sk = apply(ts, S);
    if (k === 0 && (sk !== lastShadowKey || S.scene === 'co-broke')) { renderer.shadowMap.needsUpdate = true; lastShadowKey = sk; }
    renderer.setRenderTarget(rtHalf); renderer.setClearColor(0x000000, 1); renderer.render(scene, camera);
    accMat.uniforms.t.value = rtHalf.texture; accMat.uniforms.w.value = 1 / N; pass(accMat, rtHalfAcc, false);
  }
  { const S = stateFor(t); apply(t, S); renderer.setRenderTarget(rtHalf); renderer.render(scene, camera); copyMat.uniforms.t.value = rtHalf.texture; pass(copyMat, rtHalfC);
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera); }
  resMat.uniforms.tFull.value = rtScene.texture; resMat.uniforms.tAcc.value = rtHalfAcc.texture; resMat.uniforms.tC.value = rtHalfC.texture; pass(resMat, rtAcc);
  camera.clearViewOffset();
  // depth of field from the centre subframe's depth
  const S = stateFor(t); apply(t, S);
  Object.assign(dofMat.uniforms, {}); dofMat.uniforms.tCol.value = rtAcc.texture; dofMat.uniforms.tDepth.value = rtScene.depthTexture;
  dofMat.uniforms.near.value = camera.near; dofMat.uniforms.far.value = camera.far; dofMat.uniforms.focus.value = S.focus; dofMat.uniforms.K.value = S.K * (camera.fov < 20 ? 1 : 1);
  pass(dofMat, rtDof);
  // bloom (quarter res)
  brightMat.uniforms.t.value = rtDof.texture; brightMat.uniforms.th.value = 1.1; pass(brightMat, rtQ1);
  for (let i = 0; i < 2; i++) { blurMat.uniforms.t.value = rtQ1.texture; blurMat.uniforms.d.value.set(4 / W, 0); pass(blurMat, rtQ2); blurMat.uniforms.t.value = rtQ2.texture; blurMat.uniforms.d.value.set(0, 4 / H); pass(blurMat, rtQ1); }
  // sun shafts through the dust (half res), only when the sun is in or near the frame and above the horizon
  const sp = sunDir(S.sun.el, S.sun.az).multiplyScalar(1000).add(camera.position).project(camera);
  const sunUv = new THREE.Vector2(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5); const onScreen = sp.z < 1 && Math.abs(sp.x) < 1.6 && Math.abs(sp.y) < 1.6 && S.sun.el > -1;
  if (onScreen && S.rays > 0) { occMat.uniforms.tCol.value = rtAcc.texture; occMat.uniforms.tDepth.value = rtScene.depthTexture; occMat.uniforms.sun.value.copy(sunUv); pass(occMat, rtRay);
    rayMat.uniforms.t.value = rtRay.texture; rayMat.uniforms.sun.value.copy(sunUv); pass(rayMat, rtRay2); }
  else { renderer.setRenderTarget(rtRay2); renderer.setClearColor(0x000000, 1); renderer.clear(); }
  const f = finalMat.uniforms; f.tCol.value = rtDof.texture; f.tBloom.value = rtQ1.texture; f.tRay.value = rtRay2.texture; f.exposure.value = S.exposure * (1 + 0.6 * S.lightning);
  f.ray.value = (S.rays || 0) * 0.55; f.lift.value.set(...S.lift); f.gain.value.set(...S.gain); f.sat.value = S.sat; f.seed.value = (Math.round(t * FPS) % 97) * 1.31;
  pass(finalMat, rtLdr); fxaaMat.uniforms.t.value = rtLdr.texture; pass(fxaaMat, null);
  cur = { t, S, objs: objectsFor(t, S), rendered: N };
  drawText(cur.objs);
  return N;
}

// ---------------------------------------------------------------- text layer (anchored to world points, drawn sharp)
function labelBox(L) {
  let x, y;
  if (L.screen) [x, y] = L.screen; else { const p = V(L.world).project(camera); x = (p.x * 0.5 + 0.5) * W + (L.dx || 0); y = (-p.y * 0.5 + 0.5) * H + (L.dy || 0); }
  tctx.font = `${L.weight} ${L.size}px Inter`; const w = tctx.measureText(L.text).width;
  const x0 = x - w / 2; return { x, y, x0, w, box: [x0, y - L.size * 0.74, x0 + w, y + L.size * 0.2] };
}
function objectsFor(t, S) {
  const objs = [{ id: 'bg', kind: 'shape', tag: 'rect', role: 'bg', fill: '#000000', stroke: null, opacity: 1, box: [0, 0, W, H], key: 'bg', sig: 'bg' }];
  // data objects: projected bounding boxes of the tanks and the stones on screen
  const box3 = new THREE.Box3();
  const proj = (obj) => { box3.setFromObject(obj); const xs = [], ys = []; for (const cx of [box3.min.x, box3.max.x]) for (const cy of [box3.min.y, box3.max.y]) for (const cz of [box3.min.z, box3.max.z]) {
    const p = new THREE.Vector3(cx, cy, cz).applyMatrix4(camera.matrixWorldInverse); if (p.z > -0.1) return null; p.applyMatrix4(camera.projectionMatrix); xs.push((p.x * 0.5 + 0.5) * W); ys.push((-p.y * 0.5 + 0.5) * H); }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  for (const who of ['1966', 'mirror']) { const b = proj(tanks[who].g); if (b) objs.push({ id: 'tank-' + who, kind: 'shape', tag: 'mesh', role: 'data', char: who, shape: 'tank', fill: who === '1966' ? C.c1966 : C.cmirror, stroke: null, opacity: 1, box: b, key: 'tank-' + who, sig: 'tank-' + who + '|' + bal(who, S.u[who]).toFixed(0) + '|' + b.map((v) => v.toFixed(0)).join(',') }); }
  stones.forEach((m) => { const b = proj(m); if (b && b[2] > 0 && b[0] < W && b[3] > 0 && b[1] < H) objs.push({ id: m.userData.id, kind: 'shape', tag: 'mesh', role: 'data', year: m.userData.year, fill: '#8a8278', stroke: null, opacity: 1, box: b, key: m.userData.id, sig: m.userData.id + '|' + b.map((v) => v.toFixed(0)).join(',') }); });
  for (const L of S.labels) {
    const a = clamp((t - L.t0) / (L.fade || 0.25)); if (a <= 0) continue;
    const lb = labelBox(L);
    const claims = (L.claims || []).map((c) => { const i = L.text.indexOf(c.text); tctx.font = `${L.weight} ${L.size}px Inter`; const x0 = lb.x0 + tctx.measureText(L.text.slice(0, i)).width; const w = tctx.measureText(c.text).width;
      return { id: c.id, text: c.text, box: [x0, lb.box[1], x0 + w, lb.box[3]], opacity: a, color: L.color, series: null, roll: false }; });
    objs.push({ id: L.id, kind: 'text', tid: L.id, role: L.role || 'label', text: L.text, box: lb.box, opacity: a, level: L.level ?? null, emph: !!L.emph, series: null, anchor: null, chart: null, year: L.year ?? null, char: L.char || null,
      runs: [{ color: L.color, size: L.size }], color: L.color, fontPx: L.size, background: null, parent: null, claims, key: L.id, sig: L.id + '|' + L.text + '|' + lb.box.map((v) => v.toFixed(0)).join(',') + '|' + a.toFixed(2), _L: L, _lb: lb });
  }
  return objs;
}
let textOnly = null;
function drawText(objs) {
  tctx.clearRect(0, 0, W, H);
  for (const o of objs) { if (o.kind !== 'text') continue; if (textOnly && !textOnly.has(o.id)) continue; const L = o._L, lb = o._lb;
    tctx.globalAlpha = o.opacity; tctx.font = `${L.weight} ${L.size}px Inter`; tctx.textBaseline = 'alphabetic'; tctx.textAlign = 'left';
    tctx.shadowColor = 'rgba(0,0,0,0.75)'; tctx.shadowBlur = L.size * 0.35; tctx.fillStyle = L.color; tctx.fillText(L.text, lb.x0, lb.y);
    tctx.shadowBlur = 0; tctx.fillText(L.text, lb.x0, lb.y); }
  tctx.globalAlpha = 1;
}
// graphics mask: data meshes only, flat, on a transparent background
const flatMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
function drawGraphics(ids) {
  const keep = new Set(); const show = (o) => { keep.add(o); o.traverse((c) => keep.add(c)); };
  for (const m of stones) if (!ids || ids.has(m.userData.id)) show(m);
  for (const who of ['1966', 'mirror']) if (!ids || ids.has('tank-' + who)) show(tanks[who].g);
  const vis = new Map(); scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isLineSegments || o.isInstancedMesh) { vis.set(o, o.visible); if (!keep.has(o)) o.visible = false; } });
  const bg = scene.background, fog = scene.fog; scene.fog = null; scene.overrideMaterial = flatMat;
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
  scene.overrideMaterial = null; scene.fog = fog; scene.background = bg; for (const [o, v] of vis) o.visible = v;
}
function b64(u8) { let s = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
const comp = document.createElement('canvas'); comp.width = W; comp.height = H; const cctx = comp.getContext('2d', { willReadFrequently: true });

window.CHECKS = {
  seek: (t) => { const S = stateFor(t); apply(t, S); cur = { t, S, objs: objectsFor(t, S), dirty: true }; drawText(cur.objs); glCanvas.style.visibility = 'visible'; return 1; },
  freeze: (t) => { frozen = t; },
  objects: () => cur.objs.map(({ _L, _lb, ...o }) => o),
  layer: (name, ids) => {
    const set = ids && ids.length ? new Set(ids) : null;
    if (!name || name === 'all') { textOnly = null; drawText(cur.objs); glCanvas.style.visibility = 'visible'; textCanvas.style.visibility = 'visible'; return; } // restores the layers; the checks never read pixels in this mode (the video frame is decoded instead)
    if (name === 'text' || name === 'glyph') { textOnly = null; drawText(cur.objs); glCanvas.style.visibility = 'hidden'; textCanvas.style.visibility = 'visible'; return; }
    if (name === 'graphics') { glCanvas.style.visibility = 'visible'; textCanvas.style.visibility = 'hidden'; drawGraphics(null); cur.dirty = true; return; }
    if (name === 'notext') { textCanvas.style.visibility = 'hidden'; glCanvas.style.visibility = 'visible'; if (cur.dirty) { renderFrame(cur.t); cur.dirty = false; textCanvas.style.visibility = 'hidden'; } return; }
    if (name === 'only') { const isText = cur.objs.some((o) => o.kind === 'text' && set && set.has(o.id));
      if (isText) { textOnly = set; drawText(cur.objs); glCanvas.style.visibility = 'hidden'; textCanvas.style.visibility = 'visible'; textOnly = null; }
      else { textCanvas.style.visibility = 'hidden'; glCanvas.style.visibility = 'visible'; drawGraphics(set); cur.dirty = true; } }
  },
};
window.RENDER = {
  frameB64: (t) => { const n = renderFrame(t); cctx.clearRect(0, 0, W, H); cctx.drawImage(glCanvas, 0, 0); cctx.drawImage(textCanvas, 0, 0);
    return { b64: b64(new Uint8Array(cctx.getImageData(0, 0, W, H).data.buffer)), rendered: n }; },
  texts: () => cur.objs.filter((o) => o.kind === 'text' && o.opacity > 0.5).map((o) => [o.tid, (o.box[0] + o.box[2]) / 2, o.level, o.role, o.claims.length]),
  camera: (t) => { const S = stateFor(t); apply(t, S); return { t, pos: S.p, target: S.l, fovDeg: +fovOf(S.f).toFixed(3), focusDist: +S.focus.toFixed(3), coc: +clamp(S.K * Math.abs(1 / S.focus - 1 / 60), 0, 22).toFixed(3) }; },
  scenes: D.scenes, total: D.total,
};
window.READY = true;
window.__W = { renderer, scene, sky, clouds, dust, rain, kerbs, stones, tanks, camera, renderFrame, stateFor, apply, rtScene };
