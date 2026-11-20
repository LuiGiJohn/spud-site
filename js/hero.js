// Home hero: an unedited camera frame graded live in WebGL2, one SPUD node at a time.
// This is a small site-only shader written for the page, not SPUD's own pipeline: each node
// applies a simplified version of what that node does in the app.

const $ = (s, r = document) => r.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const NODES = [
  { name: 'Input Space', desc: 'Tell SPUD what the camera recorded: Rec.709, Apple Log, F-Log2 or RAW. This is the file as it came off the card.', space: true },
  { name: 'Base', desc: 'Exposure and contrast. Get the brightness right before anything else.' },
  { name: 'Balance', desc: 'White balance: temperature and tint, so neutral things read neutral.' },
  { name: 'Curves', desc: 'Shape the tone: a gentle S, lifted blacks, softer highlights.' },
  { name: 'Color', desc: 'Vibrance and saturation, plus an 8-band HSL mixer for each colour.' },
  { name: 'Skin', desc: 'No faces in this frame, so Skin has nothing to protect. On people it keeps skin natural under a strong look.',
    descFace: 'Finds skin tones and keeps them natural: the look still lands on the frame, but the face stays true.' },
  { name: 'Detail', desc: 'Sharpness and clarity bring out texture without halos.' },
  { name: 'Look', desc: 'Colour wheels and .cube LUTs set the mood. Built-in looks land here.' },
  { name: 'Effects', desc: 'Glow and vignette pull the eye into the frame.' },
  { name: 'Output Space', desc: 'Film texture as the last step: halation and grain, then out to the screen.', space: true },
];

// One frame per colour of the rainbow, plus one in monochrome. Each wears the built-in look that
// suits its scene, light and time of day, and every look group is used: Cinematic, Nature, Streets,
// Travel, Diary. The numbers translate each look's settings in SPUD into this page's simplified nodes.
// p0: exposure (stops), contrast, temperature, tint | p1: curve S, black lift, vibrance, saturation
// p2: detail, clarity, split-tone amount, fade | p3: vignette, glow, halation, grain | sh/hi: split-tone colours
// skin: how much the Skin node holds faces back from the look (0 when there are no people)
const FRAMES = [
  { id: 'red-panels', caption: 'Sydney, red panels · X-T5', look: 'Print Film', group: 'Cinematic',
    p0: [0.0, 1.16, 0.0, 0.0], p1: [0.25, 0.025, 0.04, 1.0], p2: [0.3, 0.15, 0.8, 0.0], p3: [0.25, 0.05, 0.35, 0.08],
    sh: [-0.03, 0.005, 0.03], hi: [0.03, 0.015, -0.02], skin: 0 },
  { id: 'fushimi-inari', caption: 'Fushimi Inari, Kyoto · X-M5', look: 'Golden Diary', group: 'Diary',
    p0: [-0.1, 1.12, 0.15, 0.05], p1: [0.22, 0.035, -0.06, 0.98], p2: [0.3, 0.2, 0.85, 0.03], p3: [0.12, 0.1, 0.12, 0.05],
    sh: [0.02, 0.01, -0.015], hi: [0.03, 0.015, -0.025], skin: 0 },
  { id: 'sydney-train', caption: 'Sydney train · X-T5', look: 'Clean Wanderer', group: 'Travel',
    p0: [-0.08, 1.14, 0.07, 0.02], p1: [0.2, 0.0, 0.22, 0.89], p2: [0.3, 0.08, 0.4, 0.0], p3: [0.08, 0.02, 0.0, 0.03],
    sh: [0.01, 0.005, -0.005], hi: [0.012, 0.006, -0.01], skin: 0 },
  { id: 'blue-mountains-stairs', caption: 'Blue Mountains rainforest · X-T5', look: 'Mist Forest', group: 'Nature',
    p0: [0.1, 1.22, -0.12, 0.036], p1: [0.28, 0.02, 0.18, 1.0], p2: [0.3, -0.04, 1.0, 0.02], p3: [0.08, 0.04, 0.06, 0.04],
    sh: [-0.045, 0.015, 0.035], hi: [-0.01, 0.0, 0.015], skin: 0 },
  { id: 'sydney-beach', caption: 'Sydney beach · X-T5', look: 'Teal Coast', group: 'Travel',
    p0: [-0.1, 1.18, -0.07, 0.0], p1: [0.3, 0.015, 0.1, 1.0], p2: [0.35, 0.25, 0.8, 0.0], p3: [0.18, 0.05, 0.14, 0.05],
    sh: [-0.03, 0.005, 0.025], hi: [0.035, 0.015, -0.025], skin: 0 },
  { id: 'darling-harbour', caption: 'Darling Harbour, blue hour · X-T5', look: 'Metro Night', group: 'Streets',
    p0: [-0.1, 1.12, 0.1, 0.03], p1: [0.22, 0.0, -0.05, 0.96], p2: [0.35, 0.15, 1.0, 0.02], p3: [0.16, 0.2, 0.25, 0.06],
    sh: [-0.02, 0.01, 0.01], hi: [0.04, 0.02, -0.03], skin: 0 },
  { id: 'misty-gums', caption: 'Blue Mountains mist · X-T5', look: 'Mono Contrast', group: 'Cinematic',
    p0: [0.0, 1.28, 0.0, 0.0], p1: [0.3, 0.0, 0.0, 0.0], p2: [0.35, 0.26, 0.0, 0.0], p3: [0.3, 0.0, 0.0, 0.1],
    sh: [0.0, 0.0, 0.0], hi: [0.0, 0.0, 0.0], skin: 0 },
];
const size = () => (innerWidth < 700 ? 900 : 1800);
const src = (f, w = size()) => `assets/plates/${f.id}-${w}.jpg`;

/* ---------------- shader ---------------- */
const VS = `#version 300 es
in vec2 p; out vec2 v_uv;
void main(){ v_uv = p*0.5+0.5; v_uv.y = 1.0-v_uv.y; gl_Position = vec4(p,0.,1.); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D u_a, u_b; uniform float u_mix;
uniform float u_amt[10];
uniform vec4 u_p0, u_p1, u_p2, u_p3; uniform vec3 u_sh, u_hi; uniform float u_skin;
uniform float u_seed, u_px, u_wipe; uniform int u_wlo, u_whi;
float g_mask = 1.0;
in vec2 v_uv; out vec4 o;

vec3 toLin(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c){ c = max(c, 0.0); return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 blurAt(sampler2D t, vec2 uv, float lod){
  vec2 d = exp2(lod) / vec2(textureSize(t, 0)) * 1.5;
  vec3 s = textureLod(t, uv, lod).rgb * 0.36;
  s += textureLod(t, uv + vec2( d.x, 0.0), lod).rgb * 0.16;
  s += textureLod(t, uv + vec2(-d.x, 0.0), lod).rgb * 0.16;
  s += textureLod(t, uv + vec2(0.0,  d.y), lod).rgb * 0.16;
  s += textureLod(t, uv + vec2(0.0, -d.y), lod).rgb * 0.16;
  return s;
}
float hash(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }

float A(int i){ return u_amt[i] * ((i > u_wlo && i <= u_whi) ? g_mask : 1.0); }
vec3 grade(sampler2D t, vec2 uv){
  vec3 src = texture(t, uv).rgb;
  vec3 c = toLin(src);
  float a;
  // Base: exposure, then contrast around mid grey in log
  a = A(1);
  c *= exp2(u_p0.x * a);
  c = 0.18 * exp2(log2(max(c, 1e-5) / 0.18) * mix(1.0, u_p0.y, a));
  // Balance: temperature and tint as channel gains that keep brightness
  a = A(2);
  vec3 wb = vec3(1.0 + 0.2*u_p0.z, 1.0 - 0.15*u_p0.w, 1.0 - 0.2*u_p0.z); wb /= luma(wb);
  c *= mix(vec3(1.0), wb, a);
  vec3 d = clamp(toSrgb(c), 0.0, 1.2);
  // Curves: S-curve, lifted blacks, rolled-off highlights
  a = A(3);
  vec3 x = clamp(d, 0.0, 1.0);
  vec3 cv = mix(x, x*x*(3.0-2.0*x), u_p1.x);
  cv = u_p1.y + cv * (1.0 - u_p1.y - 0.05);
  d = mix(d, cv, a);
  // Color: saturation plus vibrance that favours muted colours
  a = A(4);
  float l = luma(d);
  float sat = max(max(d.r, d.g), d.b) - min(min(d.r, d.g), d.b);
  d = mix(d, l + (d - l) * (u_p1.w + u_p1.z * (1.0 - sat)), a);
  // Skin: find skin-coloured pixels (warm hue, moderate saturation) and remember them as they are now,
  // so the Look and Effects nodes below are partly held back there. Frames without people skip it.
  float sh = 0.0;
  if (u_skin > 0.0) {
    vec3 k = clamp(d, 0.0, 1.0);
    float ks = max(k.r, max(k.g, k.b)) - min(k.b, min(k.r, k.g));
    sh = step(k.b, k.g) * step(k.g, k.r) * smoothstep(0.08, 0.2, ks) * (1.0 - smoothstep(0.55, 0.75, ks / max(k.r, 1e-3)))
       * smoothstep(0.12, 0.25, k.r) * u_skin;
  }
  vec3 skinRef = d;
  // Detail: fine sharpening and midtone clarity from the source's blur differences
  a = A(6);
  float ls = luma(src);
  float b1 = luma(blurAt(t, uv, 1.0)), b4 = luma(blurAt(t, uv, 4.0));
  float mid = 1.0 - abs(2.0*l - 1.0);
  d += a * (u_p2.x * (ls - b1) * 1.2 + u_p2.y * (ls - b4) * mid * 0.8);
  // Look: split-tone shadows and highlights, then a slight fade
  a = A(7);
  l = luma(clamp(d, 0.0, 1.0));
  vec3 tone = u_sh * (1.0 - smoothstep(0.0, 0.55, l)) + u_hi * smoothstep(0.4, 1.0, l);
  d += a * tone * u_p2.z * 2.0;
  d = mix(d, u_p2.w + d * (1.0 - u_p2.w * 1.5), a);
  // Effects: glow on bright areas, vignette
  a = A(8);
  vec3 bl = blurAt(t, uv, 5.0);
  float hl = smoothstep(0.68, 1.0, luma(bl));
  d = 1.0 - (1.0 - clamp(d, 0.0, 1.0)) * (1.0 - a * u_p3.y * hl * bl);
  vec2 q = uv - 0.5; q.x *= 1.5;
  float v = smoothstep(0.95, 0.25, length(q));
  d *= mix(1.0, mix(1.0 - u_p3.x, 1.0, v), a);
  d = mix(d, skinRef + (d - skinRef) * 0.35, A(5) * sh);
  // Output Space: red-orange halation around highlights
  a = A(9);
  vec3 bh = blurAt(t, uv, 4.5);
  float h = smoothstep(0.8, 1.0, luma(bh));
  d += a * u_p3.z * h * vec3(1.0, 0.32, 0.1) * 0.55;
  return d;
}

void main(){
  vec2 uv = v_uv;
  float m = u_mix;
  float edge = 1.5 / float(textureSize(u_b, 0).x);
  g_mask = 1.0 - smoothstep(u_wipe - edge, u_wipe + edge, uv.x);
  // frame change: a short lens-bulge as the new frame comes in
  float w = sin(3.14159 * m);
  vec2 q = uv - 0.5;
  vec2 uvw = 0.5 + q * (1.0 - 0.06 * w * (1.0 - dot(q, q) * 2.0));
  vec3 col = m < 1.0 ? mix(grade(u_a, uvw), grade(u_b, uvw), smoothstep(0.0, 1.0, m)) : grade(u_b, uv);
  // Output Space: film grain, strongest in the midtones
  float l = luma(clamp(col, 0.0, 1.0));
  float n = hash(floor(gl_FragCoord.xy / u_px) + u_seed) - 0.5;
  col += A(9) * u_p3.w * n * (0.35 + 0.65 * (1.0 - abs(2.0*l - 1.0)));
  // the wipe line
  if (u_wipe > 0.0 && u_wipe < 1.0) {
    float d = abs(uv.x - u_wipe) * float(textureSize(u_b, 0).x) / max(u_px, 1.0);
    col = mix(col, vec3(0.91, 0.54, 0.62), (1.0 - smoothstep(1.0, 2.5, d)) * 0.95);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* ---------------- setup ---------------- */
const plate = $('[data-plate]');
const canvas = $('canvas', plate);
const fallback = $('[data-fallback]');
const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
let prog, U = {}, texA, texB;

function compile(type, s) {
  const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}
function initGL() {
  prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['u_a', 'u_b', 'u_mix', 'u_amt', 'u_p0', 'u_p1', 'u_p2', 'u_p3', 'u_sh', 'u_hi', 'u_skin', 'u_seed', 'u_px', 'u_wipe', 'u_wlo', 'u_whi']) U[n] = gl.getUniformLocation(prog, n);
  gl.uniform1i(U.u_a, 0); gl.uniform1i(U.u_b, 1);
  texA = gl.createTexture(); texB = gl.createTexture();
}
function upload(tex, img) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
const cache = new Map();
function loadImg(url) {
  if (!cache.has(url)) cache.set(url, new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = url; }));
  return cache.get(url);
}

/* ---------------- state ---------------- */
let frame = 0, node = reduce ? 9 : 0, before = false, mix = 1, mixT0 = 0;
let wipe = 2, wipeT0 = 0, wlo = -1, whi = -1; const WIPE_MS = 900;
const amt = new Float32Array(10).fill(0); amt[0] = 1;
if (reduce) amt.fill(1);
let glOK = false, visible = true, raf = 0, last = 0, fpsN = 0, fpsT = 0, lastSeed = -1, dirty = true;
// grain gets a new pattern every 42 ms (24 fps); once the grade settles, frames in between are skipped
// unless something asked for a redraw (dirty, set by kick)
const GRAIN_MS = 42;
const seedAt = (t) => (reduce ? 0 : Math.floor(t / GRAIN_MS) % 997);
const fpsEl = $('[data-fps]');

function target(i) { return i === 0 ? 1 : before ? 0 : i <= node ? 1 : 0; }
function settled() { for (let i = 0; i < 10; i++) if (Math.abs(amt[i] - target(i)) > 0.001) return false; return mix >= 1 && wipe >= 1; }
const grainLive = () => !reduce && amt[9] > 0.01;

function draw(t) {
  const f = FRAMES[frame];
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform1f(U.u_mix, mix);
  gl.uniform1fv(U.u_amt, amt);
  gl.uniform4fv(U.u_p0, f.p0); gl.uniform4fv(U.u_p1, f.p1); gl.uniform4fv(U.u_p2, f.p2); gl.uniform4fv(U.u_p3, f.p3);
  gl.uniform3fv(U.u_sh, f.sh); gl.uniform3fv(U.u_hi, f.hi); gl.uniform1f(U.u_skin, f.skin);
  gl.uniform1f(U.u_wipe, before ? 2 : wipe); gl.uniform1i(U.u_wlo, wlo); gl.uniform1i(U.u_whi, whi);
  lastSeed = seedAt(t);
  gl.uniform1f(U.u_seed, lastSeed);
  gl.uniform1f(U.u_px, Math.max(1, Math.round(canvas.width / canvas.clientWidth * 1.1)));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
function tick(t) {
  raf = 0;
  const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
  const k = before ? 1 : 1 - Math.exp(-dt * 7);
  for (let i = 0; i < 10; i++) amt[i] = (wipe < 1 && i > wlo && i <= whi && !before) ? 1 : amt[i] + (target(i) - amt[i]) * (reduce ? 1 : k);
  if (mix < 1) mix = reduce ? 1 : Math.min(1, (t - mixT0) / 650);
  if (wipe < 1) { const p = Math.min(1, (t - wipeT0) / WIPE_MS); wipe = p < 1 ? 1 - Math.pow(1 - p, 3) : 2; }
  if (dirty || !settled() || seedAt(t) !== lastSeed) { dirty = false; draw(t); fpsN++; }
  if (t - fpsT > 1000) { if (fpsEl) fpsEl.textContent = String(Math.round(fpsN * 1000 / (t - fpsT))); fpsN = 0; fpsT = t; }
  if (visible && !document.hidden && (!settled() || grainLive())) raf = requestAnimationFrame(tick);
  else { last = 0; if (fpsEl && settled()) fpsEl.textContent = 'idle'; }
}
function kick() { dirty = true; if (glOK && !raf) { fpsT = performance.now(); fpsN = 0; raf = requestAnimationFrame(tick); } if (!glOK) applyFallback(); }

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.min(1800, Math.round(canvas.clientWidth * dpr)), h = Math.round(w * 2 / 3);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; if (glOK) { last = 0; tick(performance.now()); } }
}

/* fallback without WebGL2: CSS filters stand in for the nodes */
function applyFallback() {
  const n = before ? 0 : node;
  fallback.src = src(FRAMES[frame], 900);
  fallback.style.filter = n === 0 ? 'none' : `contrast(${1 + Math.min(n, 3) * 0.05}) saturate(${1 + (n >= 4 ? 0.12 : 0)}) sepia(${n >= 7 ? 0.08 : 0})`;
}

/* ---------------- UI ---------------- */
const strip = $('[data-strip]'), countEl = $('[data-count]'), nameEl = $('[data-name]'), descEl = $('[data-desc]');
strip.innerHTML = NODES.map((n, i) => `<button type="button" role="tab" class="${n.space ? 'space' : ''}" data-i="${i}" aria-label="Grade up to ${n.name}"><i>${String(i + 1).padStart(2, '0')}</i>${n.name}</button>`).join('');
const btns = [...strip.children];

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:/#';
let scrambleId = 0;
function scramble(el, text) {
  if (reduce) { el.textContent = text; return; }
  const id = ++scrambleId, t0 = performance.now(), dur = 380;
  const step = (t) => {
    if (id !== scrambleId) return;
    const p = Math.min(1, (t - t0) / dur), keep = Math.floor(p * text.length);
    el.textContent = text.slice(0, keep) + [...text.slice(keep)].map((c) => (c === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    if (p < 1) requestAnimationFrame(step); else el.textContent = text;
  };
  requestAnimationFrame(step);
}

function setNode(i, user = true) {
  if (user) stopPlay();
  const prev = node;
  node = Math.max(0, Math.min(9, i));
  if (!reduce && node > prev && glOK) {
    wlo = wipe < 1 ? Math.min(wlo, prev) : prev; whi = node;
    for (let j = wlo + 1; j <= whi; j++) amt[j] = 1;
    wipe = 0; wipeT0 = performance.now();
  } else if (node < prev) { wipe = 2; }
  btns.forEach((b, j) => { b.classList.toggle('on', j <= node); b.classList.toggle('cur', j === node); b.setAttribute('aria-selected', j === node); });
  const b = btns[node]; strip.scrollTo({ left: b.offsetLeft - strip.clientWidth / 2 + b.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
  countEl.textContent = `Node ${String(node + 1).padStart(2, '0')} / 10`;
  scramble(nameEl, NODES[node].name);
  showDesc();
  kick();
}
function showDesc() { const n = NODES[node]; descEl.textContent = n.descFace && FRAMES[frame].skin ? n.descFace : n.desc; }
strip.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setNode(+b.dataset.i); });

/* frames */
const tiles = $('[data-tiles]'), framesEl = $('[data-frames]');
const thumb = (f, i) => `<button type="button" data-f="${i}" aria-label="Show ${f.caption}"><img src="${src(f, 900)}" alt="" loading="lazy" decoding="async"></button>`;
tiles.innerHTML = FRAMES.map(thumb).join('').replaceAll('<button type="button"', '<button type="button" class="tile"');
framesEl.innerHTML = FRAMES.map(thumb).join('');
const pick = (e) => { const b = e.target.closest('[data-f]'); if (b) setFrame(+b.dataset.f); };
tiles.addEventListener('click', pick); framesEl.addEventListener('click', pick);

async function setFrame(i, user = true) {
  i = (i + FRAMES.length) % FRAMES.length;
  const f = FRAMES[i];
  document.querySelectorAll('[data-f]').forEach((b) => b.setAttribute('aria-current', +b.dataset.f === i));
  $('[data-caption]').textContent = `${f.caption} · ${f.look} (${f.group})`;
  $('[data-frameno]').textContent = `Frame ${i + 1} / ${FRAMES.length}`;
  const first = !texB || !glOK;
  frame = i; showDesc();
  if (!glOK) { applyFallback(); if (user) play(); return; }
  const img = await loadImg(src(f));
  if (frame !== i) return;
  if (!first) { [texA, texB] = [texB, texA]; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA); }
  gl.activeTexture(gl.TEXTURE1); upload(texB, img);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, first ? texB : texA);
  mix = first ? 1 : 0; mixT0 = performance.now();
  if (user && !reduce) play(); else kick();
}

/* play the grade: Input Space to Output Space */
let playTimer = 0;
function stopPlay() { clearTimeout(playTimer); playTimer = 0; }
function play() {
  stopPlay();
  if (reduce) { setNode(9, false); return; }
  setNode(0, false);
  const next = () => { if (node < 9) { setNode(node + 1, false); playTimer = setTimeout(next, node === 9 ? 0 : 1250); } };
  playTimer = setTimeout(next, 900);
}
$('[data-play]').addEventListener('click', play);

/* before / after: hold the button or the \ key */
const baBtn = $('[data-before]');
const setBefore = (on) => { before = on; baBtn.setAttribute('aria-pressed', on); kick(); };
baBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); setBefore(true); });
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => baBtn.addEventListener(ev, () => before && setBefore(false)));
baBtn.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setBefore(true); } });
baBtn.addEventListener('keyup', () => setBefore(false));

const typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '') || document.querySelector('.palette.open');
document.addEventListener('keydown', (e) => {
  if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '\\' && !e.repeat) setBefore(true);
  const inHero = scrollY < innerHeight * 0.8;
  if (!inHero) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); setNode(node + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); setNode(node - 1); }
});
document.addEventListener('keyup', (e) => { if (e.key === '\\') setBefore(false); });

/* swipe on the plate steps nodes */
let sx = null, sy = null;
plate.addEventListener('pointerdown', (e) => { if (e.target === baBtn) return; sx = e.clientX; sy = e.clientY; });
plate.addEventListener('pointerup', (e) => {
  if (sx === null) return;
  const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
  if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) setNode(node + (dx < 0 ? 1 : -1));
});

/* tiles drift a little with the mouse */
if (!reduce && matchMedia('(pointer:fine)').matches) {
  addEventListener('mousemove', (e) => {
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    tiles.querySelectorAll('.tile').forEach((t, i) => { const d = 6 + (i % 3) * 4; t.style.setProperty('--px', `${-x * d}px`); t.style.setProperty('--py', `${-y * d}px`); });
  }, { passive: true });
}

/* palette entries */
window.dispatchEvent(new CustomEvent('palette:add', { detail: [
  { group: 'Grade', label: 'Play the grade', hint: 'Input → Output', run: () => { scrollTo({ top: 0 }); play(); } },
  ...NODES.map((n, i) => ({ group: 'Grade', label: `Grade up to ${n.name}`, hint: `node ${String(i + 1).padStart(2, '0')}`, run: () => { scrollTo({ top: 0 }); setNode(i); } })),
  ...FRAMES.map((f, i) => ({ group: 'Frames', label: f.caption, hint: `frame ${i + 1}`, run: () => { scrollTo({ top: 0 }); setFrame(i); } })),
] }));

/* ---------------- boot ---------------- */
try { if (!gl) throw new Error('no webgl2'); initGL(); glOK = true; }
catch (err) { plate.classList.add('nogl'); $('[data-badge]').textContent = 'Preview'; const g = $('[data-gl]'); if (g) g.textContent = 'none'; }
if (glOK) {
  new ResizeObserver(resize).observe(canvas);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glOK = false; plate.classList.add('nogl'); applyFallback(); });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }).observe(plate);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
}
resize();
setNode(node, false);
setFrame(0, false).then(() => { if (!reduce) play(); });
