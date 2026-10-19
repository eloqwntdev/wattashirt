/* Wattashirt — photoreal shirt driven by pre-rendered frame sequences.
 *
 * The shirt is not real-time 3D: every view is a frame cut from AI-generated
 * studio clips (keyframed on the Figma renders), with an alpha matte so DOM
 * layers can sit behind it (BLACK, the ring) and in front of it (UI, loupe).
 * Scroll scrubs the "story" sequence; the buy section switches to a 360° loop.
 */
(() => {
gsap.registerPlugin(ScrollTrigger);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0);

const isMobile = matchMedia('(max-width: 760px)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const smoothInv = y => { let a = 0, b = 1; for (let k = 0; k < 24; k++) { const m = (a + b) / 2; smooth(m) < y ? a = m : b = m; } return (a + b) / 2; };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const pad = n => String(n).padStart(4, '0');

/* ------------------------------------------------------------------ */
/* Smooth scroll + menu                                                */
/* ------------------------------------------------------------------ */
// lower lerp = longer glide; the stage also damps its own scroll progress (see frame())
const lenis = new Lenis({ lerp: 0.06, wheelMultiplier: 0.9, touchMultiplier: 1.2, smoothWheel: true });
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

// While the intro plays, the page must not move: whatever the visitor scrolls is swallowed,
// and they land on the hero when it ends.
const KEYS = new Set([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']);
// (a short grace after the intro also eats trackpad momentum that was already in flight)
let scrollUnlockAt = Infinity;
const swallow = e => { if (performance.now() < scrollUnlockAt) { e.preventDefault(); e.stopPropagation(); } };
addEventListener('wheel', swallow, { passive: false, capture: true });
addEventListener('touchmove', swallow, { passive: false, capture: true });
addEventListener('keydown', e => { if (KEYS.has(e.key)) swallow(e); }, { capture: true });
// a restored scroll position (reload half-way down) is undone until the intro has finished
const pinTop = () => { if (!started && scrollY) scrollTo(0, 0); };
addEventListener('scroll', pinTop);
addEventListener('load', pinTop);
addEventListener('pageshow', pinTop);
const pinTimer = setInterval(() => { pinTop(); if (started) clearInterval(pinTimer); }, 100); // restoration can land without a scroll event

const menu = document.getElementById('menu');
const menuBtn = document.getElementById('menuBtn');
// the burger's two bars fold into a cross while the menu is open
function setMenu(open) {
  menu.classList.toggle('is-open', open);
  menu.setAttribute('aria-hidden', String(!open));
  menuBtn.classList.toggle('is-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
const closeMenu = () => setMenu(false);
menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu(); });
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault();
  closeMenu();
  lenis.scrollTo(anchorTarget(id), { duration: id === '#packed' ? 2.6 : 1.8, offset: 0 });
}));
function anchorTarget(id) {
  // #packed: the end of the pack section, where the box is closed and "Buy now" is up
  const pk = document.getElementById('pack');
  return id === '#top' ? 0
    : id === '#buy' ? document.querySelector('.scene-mark--buy')
    : id === '#packed' ? pk.offsetTop + pk.offsetHeight - innerHeight
    : id;
}

/* ------------------------------------------------------------------ */
/* Frame sequences                                                     */
/* ------------------------------------------------------------------ */
const SEQ = 'assets/seq/';
const ASSET_V = 17; // bump when frames are re-cut, so browsers drop cached ones
const seqs = {}; // name -> { imgs, ready, count }

// Published build (claude.ai artifact, which holds ≤511 files): each sequence ships as a few JSON
// chunks of base64 webp frames. Chunk 0 holds every 6th frame, so scrubbing works early, as below.
const PACKS = window.WS_PACKS || null; // { 'black/story': chunkCount, ... } — set by build_artifact.py
function loadPacked(name, s, onEach) {
  const file = name.replace(/\//g, '_');
  let keysDone;
  s.keysLoaded = new Promise(res => { keysDone = res; });
  const chunk = k => fetch(`${SEQ}pack/${file}_${k}.json?v=${ASSET_V}`).then(r => r.json()).then(j => Promise.all(j.i.map((i, t) => new Promise(res => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { s.ready[i] = true; onEach && onEach(); res(); };
    im.onerror = () => { onEach && onEach(); res(); };
    im.src = 'data:image/webp;base64,' + j.d[t];
    s.imgs[i] = im;
  }))));
  return chunk(0).then(() => {
    keysDone();
    return Promise.all(Array.from({ length: PACKS[name] - 1 }, (_, k) => chunk(k + 1)));
  });
}

function loadSeq(name, count, onEach) {
  const s = seqs[name] = { imgs: new Array(count), ready: new Array(count).fill(false), count };
  if (PACKS && PACKS[name]) return loadPacked(name, s, onEach);
  // every 6th frame first, so scrubbing is usable before the sequence finishes
  const order = [...Array(count).keys()].sort((a, b) => (a % 6 ? 1 : 0) - (b % 6 ? 1 : 0));
  const one = i => new Promise(res => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { s.ready[i] = true; onEach && onEach(); res(); };
    im.onerror = () => { onEach && onEach(); res(); };
    im.src = `${SEQ}${name}/${pad(i)}.webp?v=${ASSET_V}`;
    s.imgs[i] = im;
  });
  const keys = order.filter(i => i % 6 === 0).length;
  let next = 0;
  const workers = Promise.all(Array.from({ length: 6 }, async () => { while (next < order.length) await one(order[next++]); }));
  s.keysLoaded = new Promise(res => { const chk = () => (s.ready.filter((r, i) => r && i % 6 === 0).length >= keys || next >= order.length) ? res() : setTimeout(chk, 50); chk(); });
  return workers;
}

// nearest loaded frame, so scrubbing never shows a hole while loading
function frameImg(name, f) {
  const s = seqs[name];
  if (!s) return null;
  const i = clamp(Math.round(f), 0, s.count - 1);
  for (let d = 0; d < s.count; d++) {
    if (s.ready[i - d]) return s.imgs[i - d];
    if (s.ready[i + d]) return s.imgs[i + d];
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Stage                                                               */
/* ------------------------------------------------------------------ */
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
let vw = innerWidth, vh = innerHeight, dpr = 1;

// Scenes are named on [data-scene] markers, in DOM order.
// Pose: x/y = frame centre (fractions of viewport), s = frame height (× base).
const SCENE_POSES = {
  hero:      { x: 0.5,  y: 1.02, s: 1.25 },
  about:     { x: 0.5,  y: 0.75, s: 1.30 },
  tech:      { x: 0.47, y: 0.60, s: 1.10 },
  features:  { x: 0.5,  y: 0.58, s: 1.08 },
  breeze:    { x: 0.52, y: 0.55, s: 1.00 },
  avatarIn:  { x: 0.5,  y: 0.52, s: 0.98 },
  avatarOut: { x: 0.5,  y: 0.52, s: 0.98 },
  back:      { x: 0.5,  y: 0.62, s: 1.15 },
  day:       { x: 0.5,  y: -0.7, s: 0.8 },   // shirt lifts out of frame while the photo strip runs
  reviews:   { x: 0.5,  y: -0.7, s: 0.8 },   // still out of frame; it comes down for the statement
  statement: { x: 0.5,  y: 0.13, s: 0.72 },
  buy:       { x: 0.5,  y: 0.46, s: 0.80 },
};
const MOBILE_SCENE_POSES = {
  hero: { x: 0.5, y: 0.86, s: 1.15 }, about: { x: 0.5, y: 0.6, s: 1.05 }, tech: { x: 0.5, y: 0.6, s: 0.95 },
  features: { x: 0.5, y: 0.58, s: 0.95 }, breeze: { x: 0.5, y: 0.6, s: 0.9 },
  avatarIn: { x: 0.5, y: 0.5, s: 1.0 }, avatarOut: { x: 0.5, y: 0.5, s: 1.0 },
  back: { x: 0.5, y: 0.5, s: 0.85 }, day: { x: 0.5, y: -0.7, s: 0.8 }, reviews: { x: 0.5, y: -0.7, s: 0.8 }, statement: { x: 0.5, y: 0.2, s: 0.75 }, buy: { x: 0.5, y: 0.42, s: 0.85 },
};
// story frame per scene: F 0 … side 60 … 3/4 120 … cotton … back 179 … cocoon 239 … avatar 299.
// avatar → back scrubs the cocoon clips in reverse: cotton wraps him and leave the shirt behind.
const SCENE_FRAMES = { hero: 0, about: 0, tech: 60, features: 120, breeze: 150, avatarIn: 299, avatarOut: 299, back: 179, day: 179, reviews: 179, statement: 179, buy: 179 };
const base = () => isMobile ? Math.min(vh, vw * 1.35) : vh;

const sections = [...document.querySelectorAll('[data-scene]')];
const names = sections.map(s => s.dataset.scene);
const IDX = Object.fromEntries(names.map((n, i) => [n, i]));
const poses = names.map(n => (isMobile ? MOBILE_SCENE_POSES : SCENE_POSES)[n]);
const STORY_ANCHORS = names.map(n => SCENE_FRAMES[n]);
let mids = [];
function measure() {
  const y = lenis ? lenis.scroll : scrollY;
  mids = sections.map(s => { const r = s.getBoundingClientRect(); return r.top + y + r.height / 2; });
}
function resize() {
  vw = innerWidth; vh = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  ctx.imageSmoothingQuality = 'high';
  measure();
}
function sceneProgress() {
  const c = lenis.scroll + vh / 2;
  if (c <= mids[0]) return 0;
  for (let i = 0; i < mids.length - 1; i++) {
    if (c < mids[i + 1]) return i + smooth(clamp((c - mids[i]) / (mids[i + 1] - mids[i])));
  }
  return mids.length - 1;
}
function poseAt(p) {
  const i = Math.min(poses.length - 2, Math.floor(p)), t = p - i;
  const a = poses[i], b = poses[i + 1];
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t) };
}
function storyFrame(p) {
  const i = Math.min(STORY_ANCHORS.length - 2, Math.floor(p)), t = p - i;
  return lerp(STORY_ANCHORS[i], STORY_ANCHORS[i + 1], t);
}

// phones: the 16:9 story frame is shorter than the screen, so its top and bottom edges show; flying cotton
// would end on a hard line there. Those frames go through a buffer that fades the top and bottom edges.
const featherCv = document.createElement('canvas'), featherCtx = featherCv.getContext('2d');
function drawFrame(img, pose, alpha = 1, feather = false) {
  if (!img || alpha <= 0) return;
  const S = pose.s * base();
  const Wd = S * img.width / img.height;
  const x = (pose.x * vw - Wd / 2) * dpr, y = (pose.y * vh - S / 2) * dpr, w = Wd * dpr, h = S * dpr;
  if (feather && isMobile) {
    if (featherCv.width !== canvas.width || featherCv.height !== canvas.height) { featherCv.width = canvas.width; featherCv.height = canvas.height; }
    featherCtx.globalCompositeOperation = 'source-over';
    featherCtx.clearRect(0, 0, featherCv.width, featherCv.height);
    featherCtx.drawImage(img, x, y, w, h);
    featherCtx.globalCompositeOperation = 'destination-in';
    const g = featherCtx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.12, '#000'); g.addColorStop(0.9, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    featherCtx.fillStyle = g; featherCtx.fillRect(0, 0, featherCv.width, featherCv.height);
    ctx.globalAlpha = alpha;
    ctx.drawImage(featherCv, 0, 0);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x, y, w, h);
  ctx.globalAlpha = 1;
}
// black frame underneath, white on top with t (the silhouettes line up closely)
function drawColored(kind, f, pose, a = 1) {
  const fe = kind === 'story';
  if (colorState.t < 1) drawFrame(frameImg(`black/${kind}`, f), pose, a, fe);
  // while a white sequence is still streaming, stay white: the turntable falls back to the white back view
  // never a black shirt on the white page: until the frame arrives, the nearest white view stands in
  const w = frameImg(`white/${kind}`, f) || (kind === 'turn' ? frameImg('white/story', 179) : frameImg('white/turn', 0));
  if (colorState.t > 0) drawFrame(w, pose, a * colorState.t, fe);
}

/* ------------------------------------------------------------------ */
/* 360° turntable                                                      */
/* ------------------------------------------------------------------ */
// loop clips cover unequal angles: F→S 90°, S→Q 45°, Q→B 45°, B→Q 45°, Q→S 45°, S→F 90°
const TURN_ANGLES = [0, 0.25, 0.375, 0.5, 0.625, 0.75, 1];
function angleToFrame(a) {
  const n = seqs['black/turn'] ? seqs['black/turn'].count : 240;
  const per = n / 6;
  a = ((a % 1) + 1) % 1;
  let k = 0;
  while (k < 5 && a >= TURN_ANGLES[k + 1]) k++;
  const t = (a - TURN_ANGLES[k]) / (TURN_ANGLES[k + 1] - TURN_ANGLES[k]);
  return Math.min(n - 1, (k + t) * per);
}
const turn = { angle: 0.5, target: 0.5, vel: 0, dragging: false, lastX: 0 }; // 0.5 = back view = last story frame
const handoff = { from: null }; // angle when the buy view started handing the shirt to the pack
const dragZone = document.getElementById('dragZone');
dragZone.addEventListener('pointerdown', e => { turn.dragging = true; turn.lastX = e.clientX; dragZone.setPointerCapture(e.pointerId); });
dragZone.addEventListener('pointermove', e => {
  if (!turn.dragging) return;
  const dx = e.clientX - turn.lastX; turn.lastX = e.clientX;
  turn.target -= dx / (vw * 0.9);
  turn.vel = -dx / (vw * 0.9);
});
['pointerup', 'pointercancel'].forEach(t => dragZone.addEventListener(t, () => { turn.dragging = false; }));
document.getElementById('spinL').addEventListener('click', () => { turn.target -= 0.125; turn.vel = 0; });
document.getElementById('spinR').addEventListener('click', () => { turn.target += 0.125; turn.vel = 0; });

/* ------------------------------------------------------------------ */
/* Black / white                                                       */
/* ------------------------------------------------------------------ */
const colorState = { t: 0 };
const toggle = document.getElementById('colorToggle');
// the landing always opens black: record that, so a hop to Privacy / Terms / 404 opens in the theme on screen
try { localStorage.setItem('ws-theme', 'black'); } catch (e) {}
// the switch happens under a short veil in the new background colour: nothing ever shows a
// half-black, half-white shirt, and the page simply dips into the other theme
const veil = document.createElement('div');
veil.className = 'theme-veil';
document.body.appendChild(veil);
// timer + CSS transitions, so the flip never waits on animation frames
let veilTimer;
toggle.addEventListener('click', () => {
  const white = toggle.getAttribute('aria-pressed') !== 'true';
  toggle.setAttribute('aria-pressed', String(white));
  clearTimeout(veilTimer);
  veil.style.background = white ? '#eaeaea' : '#000';
  veil.style.transition = 'opacity .14s ease-in';
  veil.style.opacity = '1';
  veilTimer = setTimeout(() => {
    applyTheme(white);
    veil.style.transition = 'opacity .32s ease-out .04s';
    veil.style.opacity = '0';
  }, 150);
});
function applyTheme(white) {
  const label = toggle.querySelector('.pill__label');
  label.textContent = white ? label.dataset.white : label.dataset.black;
  document.body.classList.toggle('is-white', white);
  document.documentElement.classList.toggle('is-white', white); // flips the whole site to the light theme
  document.getElementById('buyColor').textContent = white ? 'White' : 'Black';
  document.getElementById('packColor').textContent = white ? 'White' : 'Black';
  document.querySelector('.hero__copy .cta span').textContent = white ? 'Get White Now' : 'Get Black Now';
  document.getElementById('menuBuy').textContent = white ? 'Get White' : 'Get Black';
  document.querySelector('.hero__tag').textContent = white ? 'Once you go white, it’s alright.' : 'Once you go black you never go back.';
  document.querySelector('#bigWord span').textContent = white ? 'White' : 'Black';
  document.querySelector('.day__title .sec-title__main').textContent = white ? 'A day in white' : 'A day in black';
  // photos that exist in both colours swap with the theme
  document.querySelectorAll('img[data-white]').forEach(im => { im.src = white ? im.dataset.white : im.dataset.black; });
  const [l1, l2] = document.querySelectorAll('.statement__line');
  l1.textContent = white ? 'Once you go white' : 'Once you go black';
  l2.textContent = white ? 'it’s alright.' : 'you never go back.';
  colorState.t = white ? 1 : 0; // instant, hidden by the veil
  try { localStorage.setItem('ws-theme', white ? 'white' : 'black'); } catch (e) {} // the Privacy / Terms / 404 pages open in the same theme
  dispatchEvent(new Event('themechange'));
}

/* ------------------------------------------------------------------ */
/* Hotspots — u/v are positions inside the square frame at that scene  */
/* ------------------------------------------------------------------ */
// every title is used once on the page; the breeze section owns "lightness", the tech cards own the fabric specs
// line icons, 24×24, drawn with currentColor strokes
const HS_ICONS = {
  collar: '<g transform="translate(0 3)"><path d="M3 9.5c3-3.2 6-4.7 9-4.7s6 1.5 9 4.7"/><path d="M7.4 7c1 3 2.6 4.6 4.6 4.6S15.6 10 16.6 7"/><path d="M9 7.8c.8 1.6 1.8 2.4 3 2.4s2.2-.8 3-2.4"/><path d="M3 9.5V13m18-3.5V13"/></g>',
  reshape: '<path d="M20 12a8 8 0 0 1-13.7 5.6"/><path d="M4 12a8 8 0 0 1 13.7-5.6"/><path d="M17.8 3v3.6h-3.6M6.2 21v-3.6h3.6"/><rect x="9" y="9" width="6" height="6" rx="1.2"/>',
  air: '<path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 13h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 17h7"/>',
  aero: '<path d="M21.5 12c-3 3.4-8 4.4-12.4 3.1C6.6 14.4 5.5 13.3 5.5 12s1.1-2.4 3.6-3.1C13.5 7.6 18.5 8.6 21.5 12Z"/><path d="M1.5 9h2.5M1 12h2.5M1.5 15h2.5"/>',
  longline: '<path d="M7 4 9.5 3Q12 5.5 14.5 3L17 4l2.5 3-2 1.5-1-1V18.5l-4.5 1.5-4.5-1.5V7.5l-1 1-2-1.5Z"/><path d="M12 11v5.5m-2-2 2 2 2-2"/>',
};
// every title is used once on the page; the breeze section owns "lightness", the tech cards own the fabric specs
const HOTSPOTS = [
  { scene: 'features', compact: true, u: 0.40, v: 0.20, side: 'left',  icon: 'collar',   title: 'Flat Collar', text: 'A double-stitched rib that keeps its round shape and never waves.' },
  { scene: 'features', compact: true, u: 0.61, v: 0.33, side: 'right', icon: 'reshape',  title: 'Anti-Deformation', text: 'Pre-shrunk and set, so the shirt keeps its form after many washes.' },
  { scene: 'features', compact: true, u: 0.42, v: 0.62, side: 'left',  icon: 'air',      title: 'Breathable Knit', text: 'Open jersey loops let air through, so it stays dry under load.' },
  { scene: 'back', compact: true, short: 260, u: 0.50, v: 0.13, side: 'left',  icon: 'aero',     title: 'Aerodynamic Fit', text: 'Cut to follow the shoulders and fall straight, with nothing to catch the wind.' },
  { scene: 'back', u: 0.62, v: 0.72, side: 'right', icon: 'longline', title: 'Longline Back', text: 'The back hem drops a little lower, so it stays put when you reach or bend.' },
];
const hsLayer = document.getElementById('hotspots');
HOTSPOTS.forEach(h => {
  const el = document.createElement('div');
  el.className = `hs hs--${h.side}${h.small ? ' hs--sm' : ''}`;
  let inner = `<button class="hs__dot" aria-label="${h.title || 'Detail'}"></button>`;
  if (h.title) {
    inner += `<svg class="hs__line" width="1" height="1"><path/></svg>
      <div class="hs__text"><h3><i class="hs__icon"><svg viewBox="0 0 24 24">${HS_ICONS[h.icon] || ''}</svg></i>${h.title}</h3><p>${h.text}</p></div>`;
  }
  el.innerHTML = inner;
  hsLayer.appendChild(el);
  h.el = el;
  h.path = el.querySelector('.hs__line path');
  h.text = h.text && el.querySelector('.hs__text');
});
// Labels never sit on the shirt: each side has a text column just outside the silhouette,
// and the leader line runs from the dot out to it (and on under the label).
// labels sit in the page grid's side columns (see --col-l / --col-r in style.css)
const HS_MAX = 260, HS_SHORT = 150; // HS_SHORT: dot-to-label run for compact hotspots
function updateHotspots(p, pose) {
  const S = pose.s * base();
  const gutter = vw <= 760 ? 16 : vw <= 1100 ? 32 : 60;
  for (const h of HOTSPOTS) {
    const si = IDX[h.scene];
    // phone: one hotspot at a time over a wider stretch (the section is taller there), so each
    // dot and its text get their own bit of scroll
    const win = isMobile ? 0.3 : 0.15;
    let on = Math.abs(p - si) < win;
    if (isMobile && h.text && on) {
      // split the window evenly in scroll distance (p eases, so equal steps of p would give the
      // middle hotspot most of the scroll)
      const group = HOTSPOTS.filter(o => o.scene === h.scene && o.text);
      const lo = mids[si] - (1 - smoothInv(1 - win)) * (mids[si] - mids[si - 1]);
      const hi = mids[si] + smoothInv(win) * (mids[si + 1] - mids[si]);
      const c = lenis.scroll + vh / 2;
      const slot = clamp(Math.floor((c - lo) / (hi - lo) * group.length), 0, group.length - 1);
      on = group[slot] === h;
    }
    const x = pose.x * vw + (h.u - 0.5) * S;
    const y = pose.y * vh + (h.v - 0.5) * S;
    h.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (h.text) {
      if (isMobile) {
        // wide enough for two lines; above the dot, or under it when the header would cover it
        const tw = Math.min(250, vw - 32), left = clamp(x - tw / 2, 16, vw - 16 - tw) - x;
        h.text.style.width = tw + 'px';
        const th = h.text.offsetHeight || 80;
        h.text.style.left = left + 'px';
        h.text.style.top = (y - 34 - th > 84 ? -(34 + th) : 34) + 'px';
      } else {
        const right = h.side === 'right';
        const cw = document.documentElement.clientWidth; // same box CSS % resolves against (no scrollbar)
        const sideW = Math.min(400, cw * 0.28), tw = Math.min(HS_MAX, sideW);
        // left labels start on the left column line, right labels on the right column line —
        // except Features (h.compact): short leaders, labels held close to the shirt, centred composition
        const tx = h.compact
          ? clamp(right ? x + (h.short || HS_SHORT) : x - (h.short || HS_SHORT) - tw, gutter, cw - gutter - tw)
          : right ? cw - gutter - sideW : gutter;
        h.text.style.width = tw + 'px';
        const far = (right ? tx + tw : tx) - x; // the leader runs from the dot to the far end of the label
        const k = right ? 1 : -1;
        h.path.setAttribute('d', `M0 0 L${28 * k} -31.6 Q${31.8 * k} -38 ${43 * k} -38 H${far}`);
        h.text.style.left = (tx - x) + 'px';
        h.text.style.top = '-84px';
      }
    }
    h.el.classList.toggle('is-on', on && started);
  }
}

// Video cards are tied to the shirt: a leader runs from the card's near top corner to a point
// on the fabric (u/v as for hotspots), and follows the shirt while the section is on screen.
const CARD_LINKS = [
  { card: document.querySelector('#tech .video-card'), scene: 'tech', u: 0.567, v: 0.20 },
  { card: document.querySelector('#back .video-card'), scene: 'back', u: 0.28, v: 0.23 }, // on the armhole seam: the card shows a seam
];
const linkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
linkSvg.setAttribute('class', 'card-links');
hsLayer.appendChild(linkSvg);
CARD_LINKS.forEach(l => {
  l.g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  l.g.innerHTML = '<path class="card-links__line"/><circle class="card-links__ring" r="9"/><circle class="card-links__dot" r="3.5"/>';
  linkSvg.appendChild(l.g);
  [l.path, l.ring, l.dot] = l.g.children;
});
function updateCardLinks(p, pose) {
  const S = pose.s * base();
  for (const l of CARD_LINKS) {
    const near = clamp(1 - Math.abs(p - IDX[l.scene]) / 0.35);
    const cardOp = parseFloat(getComputedStyle(l.card).opacity) || 0;
    const op = isMobile ? 0 : near * cardOp;
    l.g.style.opacity = op;
    if (op < 0.01) continue;
    const r = l.card.querySelector('.video-card__screen').getBoundingClientRect();
    const tx = pose.x * vw + (l.u - 0.5) * S, ty = pose.y * vh + (l.v - 0.5) * S;
    let d;
    if (tx > r.left - 40 && tx < r.right + 40 && ty < r.top) {
      // point sits above the card: leave from the top edge, rise, then slope onto the fabric
      const ax = clamp(tx + 60, r.left + 24, r.right - 24), ay = r.top;
      d = `M${ax} ${ay} V${ty + (ay - ty) * 0.45} L${tx} ${ty}`;
    } else {
      // point beside the card: horizontal run out of the near top corner, then one slope
      const leftOfCard = tx < r.left;
      const ax = leftOfCard ? r.left : r.right, ay = r.top + 18;
      d = `M${ax} ${ay} H${ax + (tx - ax) * 0.45} L${tx} ${ty}`;
    }
    l.path.setAttribute('d', d);
    l.ring.setAttribute('cx', tx); l.ring.setAttribute('cy', ty);
    l.dot.setAttribute('cx', tx); l.dot.setAttribute('cy', ty);
  }
}

/* ------------------------------------------------------------------ */
/* Magnifier loupe                                                     */
/* ------------------------------------------------------------------ */
const loupe = document.getElementById('loupe');
const lens = document.getElementById('loupeLens');
const pointer = { x: -1, y: -1, active: false };
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = e.pointerType === 'mouse'; });
document.addEventListener('pointerleave', () => { pointer.active = false; });
const loupePos = { x: 0, y: 0, init: false };
// resting spot on the shoulder (frame u/v), where the Figma design puts it
const LOUPE_REST = { u: 0.30, v: 0.22 };
function updateLoupe(p, pose, dt) {
  const on = Math.abs(p - IDX.about) < 0.3 && started; // only in About; the buy view keeps the shirt clear
  loupe.classList.toggle('is-on', on);
  if (!on) { loupePos.init = false; return; }
  const S = pose.s * base();
  const left = pose.x * vw - S * 0.3, right = pose.x * vw + S * 0.3;
  const top = pose.y * vh - S * 0.38, bottom = Math.min(vh - 80, pose.y * vh + S * 0.4);
  const over = pointer.active && pointer.x > left && pointer.x < right && pointer.y > top && pointer.y < bottom;
  const tx = over ? pointer.x : pose.x * vw + (LOUPE_REST.u - 0.5) * S;
  const ty = over ? pointer.y : pose.y * vh + (LOUPE_REST.v - 0.5) * S;
  if (!loupePos.init) { loupePos.x = tx; loupePos.y = ty; loupePos.init = true; }
  loupePos.x = damp(loupePos.x, tx, over ? 14 : 5, dt);
  loupePos.y = damp(loupePos.y, ty, over ? 14 : 5, dt);
  loupe.style.translate = `${loupePos.x}px ${loupePos.y}px`;
  // the texture pans faster than the lens moves, which reads as magnification
  lens.style.backgroundPosition = `${-loupePos.x * 3}px ${-loupePos.y * 3}px`;
}

/* ------------------------------------------------------------------ */
/* Configurator — AI avatar in the tee. He is never a still: every      */
/* option plays a clip. View scrubs a 180° turn (front → side → back),  */
/* mood scrubs an expression clip (deadpan → skeptical → amused).      */
/* Colour and fit cross-fade between                                    */
/* clips at the same frame, so he keeps moving through the switch.      */
/* ------------------------------------------------------------------ */
const cfg = { fit: 'over', view: 'front', mood: 'deadpan' };
// clip per colour+fit
const AV_CLIPS = {
  b_over: { turn: 'b_over_turn', mood: 'b_over_mood' },
  b_reg:  { turn: 'b_reg_turn',  mood: 'b_reg_mood' },
  w_over: { turn: 'w_over_turn', mood: 'w_over_mood' },
  w_reg:  { turn: 'w_reg_turn',  mood: 'w_reg_mood' },
};
const AV_N = 61, AV_FPS = 26;
const VIEW_F = { front: 0, side: 30, back: AV_N - 1 };
const MOOD_F = { deadpan: 0, skeptical: 24, amused: AV_N - 1 };
const avLoading = new Set();
function loadAvClip(name) {
  if (avLoading.has(name)) return;
  avLoading.add(name);
  loadSeq(`av/${name}`, AV_N);
}
function loadConfigurator() {
  // current colour first, everything else right after
  const c = document.body.classList.contains('is-white') ? 'w' : 'b';
  const keys = Object.keys(AV_CLIPS).sort((x, y) => (y[0] === c) - (x[0] === c));
  for (const k of keys) { loadAvClip(AV_CLIPS[k].turn); loadAvClip(AV_CLIPS[k].mood); }
}
// first frame stand-in until a clip has loaded
const avStill = {};
for (const k of Object.keys(AV_CLIPS)) { const im = new Image(); im.src = `assets/avatar/${k}_front.webp`; avStill[k] = im; }

const av = { turn: 0, mood: 0, fit: 0 }; // fit: 0 oversized … 1 regular (tweened)
let cfgVis = 0;
const cfgUI = document.querySelector('.cfg');
function setCfg(group, value) {
  if (group === 'color') {
    if ((value === 'white') !== (toggle.getAttribute('aria-pressed') === 'true')) toggle.click();
    return;
  }
  if (cfg[group] === value) return;
  cfg[group] = value;
  if (group === 'mood' && cfg.view !== 'front') cfg.view = 'front'; // he turns round to show you
  if (group === 'fit') gsap.to(av, { fit: value === 'reg' ? 1 : 0, duration: 0.7, ease: 'power2.inOut' });
  syncCfgChips();
}
// mood thumbnails follow the shirt colour
function updatePortrait() {
  const c = document.body.classList.contains('is-white') ? 'w' : 'b';
  document.querySelectorAll('.mood img').forEach(im => { im.src = `assets/avatar/${c}_mood_${im.dataset.mood}.webp?v=${ASSET_V}`; });
}
const CFG_NAMES = { black: 'Black', white: 'White', reg: 'Regular', over: 'Oversized', front: 'Front', side: 'Side', back: 'Back', deadpan: 'Deadpan', skeptical: 'Skeptical', amused: 'Amused' };
function syncCfgChips() {
  const white = document.body.classList.contains('is-white');
  const state = { ...cfg, color: white ? 'white' : 'black' };
  document.querySelectorAll('.cfg [data-cfg]').forEach(b => {
    const [g, v] = b.dataset.cfg.split(':');
    const on = state[g] === v;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  // segmented thumbs slide under the active option
  document.querySelectorAll('.cfg .seg').forEach(seg => {
    const on = seg.querySelector('button.is-on'), thumb = seg.querySelector('.seg__thumb');
    if (!on || !thumb || !on.offsetWidth) return;
    thumb.style.width = on.offsetWidth + 'px';
    thumb.style.transform = `translateX(${on.offsetLeft}px)`;
  });
  document.querySelectorAll('.cfg [data-val]').forEach(el => { el.textContent = CFG_NAMES[state[el.dataset.val]]; });
  const look = document.getElementById('cfgLook');
  if (look) look.textContent = ['color', 'fit', 'view', 'mood'].map(k => CFG_NAMES[state[k]]).join(' · ');
}
addEventListener('resize', syncCfgChips);
document.fonts && document.fonts.ready.then(syncCfgChips);
document.querySelectorAll('.cfg [data-cfg]').forEach(b => b.addEventListener('click', () => {
  const [g, v] = b.dataset.cfg.split(':');
  setCfg(g, v);
}));
addEventListener('themechange', () => { syncCfgChips(); updatePortrait(); });
// footer pill is a second switch for the same state
const footerToggle = document.querySelector('.footer__toggle');
footerToggle.addEventListener('click', () => toggle.click());
addEventListener('themechange', () => {
  footerToggle.setAttribute('aria-pressed', toggle.getAttribute('aria-pressed'));
  footerToggle.querySelector('.pill__label').textContent = toggle.querySelector('.pill__label').textContent;
});

const approach = (v, t, step) => v < t ? Math.min(t, v + step) : Math.max(t, v - step);
// One playhead per clip. The expression only plays while he faces us, so a turn first
// winds the face back to deadpan, and a mood picked from the side first turns him round.
function avTick(dt) {
  const step = AV_FPS * dt;
  const wantTurn = VIEW_F[cfg.view];
  const wantMood = cfg.view === 'front' ? MOOD_F[cfg.mood] : 0;
  if (wantTurn !== 0 || av.turn > 0) {
    if (av.mood > 0) av.mood = approach(av.mood, 0, step * 1.6);
    else av.turn = approach(av.turn, wantTurn, step);
  } else {
    av.mood = approach(av.mood, wantMood, step * 0.9);
  }
}
function avFrame(key) {
  const c = AV_CLIPS[key];
  if (av.mood > 0.01) { const m = frameImg(`av/${c.mood}`, av.mood); if (m) return m; }
  return frameImg(`av/${c.turn}`, av.turn) || avStill[key];
}

// the avatar layer is composed off-screen so its backdrop can be feathered into the page
const avCanvas = document.createElement('canvas');
const avCtx = avCanvas.getContext('2d');
const FACE_V = 0.09; // face centre, as a fraction of the 16:9 frame height
function drawConfigurator(p, pose, dt) {
  const hold = p >= IDX.avatarIn - 0.02 && p <= IDX.avatarOut + 0.02;
  cfgVis = damp(cfgVis, hold ? 1 : 0, 9, dt);
  if (hold) avTick(dt);
  if (cfgVis > 0.01) {
    if (avCanvas.width !== canvas.width || avCanvas.height !== canvas.height) { avCanvas.width = canvas.width; avCanvas.height = canvas.height; }
    // always full height: the mood plays on his face, the camera stays put
    const S = pose.s * base();
    const faceY = pose.y * vh + (FACE_V - 0.5) * S;
    const breathe = reduceMotion ? 0 : Math.sin(performance.now() / 1400) * 0.0025;
    const H = S * (1 + breathe), W = H * 16 / 9;
    const x0 = (pose.x * vw - W / 2) * dpr, y0 = (faceY - FACE_V * H) * dpr, w = W * dpr, h = H * dpr;
    avCtx.setTransform(1, 0, 0, 1, 0, 0);
    avCtx.clearRect(0, 0, avCanvas.width, avCanvas.height);
    const layers = [];
    for (const c of ['b', 'w']) {
      // the avatar swaps colour at once: a cross-fade of a black-backdrop clip into a light one reads as a grey slab
      const ca = (c === 'w') === document.body.classList.contains('is-white') ? 1 : 0;
      if (ca <= 0.001) continue;
      if (av.fit < 1) layers.push([`${c}_over`, ca * (1 - av.fit)]);
      if (av.fit > 0) layers.push([`${c}_reg`, ca * av.fit]);
    }
    // the dominant layer goes down opaque so the cross-fade never dips in density
    layers.sort((a, b) => b[1] - a[1]);
    let acc = 0;
    layers.forEach(([key, a]) => {
      acc += a;
      const img = avFrame(key);
      if (!img || !img.complete || !img.naturalWidth) return;
      avCtx.globalAlpha = a / acc;
      avCtx.drawImage(img, x0, y0, w, h);
    });
    avCtx.globalAlpha = 1;
    // feather the clip's backdrop into the page on every side
    avCtx.globalCompositeOperation = 'destination-in';
    let g = avCtx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(0.34, '#000'); g.addColorStop(0.66, '#000'); g.addColorStop(0.8, 'rgba(0,0,0,0)');
    avCtx.fillStyle = g; avCtx.fillRect(0, 0, avCanvas.width, avCanvas.height);
    g = avCtx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.03, '#000'); g.addColorStop(0.96, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    avCtx.fillStyle = g; avCtx.fillRect(0, 0, avCanvas.width, avCanvas.height);
    avCtx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = cfgVis;
    ctx.drawImage(avCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }
  const ui = clamp(1 - Math.max(IDX.avatarIn - p, p - IDX.avatarOut, 0) / 0.2);
  cfgUI.style.opacity = ui;
  cfgUI.style.pointerEvents = ui > 0.6 ? '' : 'none';
}
syncCfgChips();

/* ------------------------------------------------------------------ */
/* Pack: the unboxing played backwards. The shirt folds, sinks into    */
/* the box and the lid closes. It rides in with its section, then pins.*/
/* ------------------------------------------------------------------ */
const pack = document.getElementById('pack');
const packCopy = document.querySelector('.pack__copy');
// The turntable shirt and the last unboxing frame are the same front view at the same
// scale (both keyed on the Figma front render), so at PACK_START one replaces the other.
const PACK_START = isMobile ? { x: 0.5, y: 0.47, s: 0.85 } : { x: 0.5, y: 0.5, s: 0.82 };
const PACK_END = isMobile ? { x: 0.5, y: 0.36, s: 0.95 } : { x: 0.5, y: 0.4, s: 1.05 };
function lerpPose(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t) }; }
// 0 → 1 over the scroll between the buy view releasing and the pack stage pinning
function handoffProgress() { return clamp(finaleLift() / vh); }
function drawPack() {
  if (!seqs.intro) return;
  const r = pack.getBoundingClientRect();
  if (r.top > 0.5) { packCopy.style.opacity = 0; return; } // until pinned, the turntable shirt is on stage
  const f = clamp((lenis.scroll - pack.offsetTop) / Math.max(1, pack.offsetHeight - vh));
  const leave = Math.max(0, vh - r.bottom) / vh;           // goes up with the section towards the footer
  const t = smooth(clamp(f / 0.8));
  const pose = lerpPose(PACK_START, PACK_END, t);
  // light theme packs the white tee into a white box (its own clip, shot on the page's grey)
  const seq = document.body.classList.contains('is-white') && seqs.intro_w ? 'intro_w' : 'intro';
  drawFrame(frameImg(seq, (seqs[seq].count - 1) * (1 - t)), { ...pose, y: pose.y - leave });
  packCopy.style.opacity = smooth(clamp((f - 0.72) / 0.2));
}

/* ------------------------------------------------------------------ */
/* Backdrop + DOM choreography                                         */
/* ------------------------------------------------------------------ */
const bigWord = document.getElementById('bigWord');
gsap.fromTo(bigWord.firstElementChild, { xPercent: 30 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '#about', start: 'top bottom', end: 'bottom top', scrub: true } });
gsap.timeline({ scrollTrigger: { trigger: '#about', start: 'top 80%', end: 'bottom 20%', scrub: true } })
  .fromTo(bigWord, { opacity: 0 }, { opacity: 1, duration: 0.3 })
  .to(bigWord, { opacity: 1, duration: 0.4 })
  .to(bigWord, { opacity: 0, duration: 0.3 });

// these two are centred with left:50% + translate(-50%); GSAP owns their transform, so it gets the
// centring as xPercent (a percentage). Otherwise GSAP bakes the CSS translate into pixels at first
// render, and if the viewport was still settling then (fonts, iframe resize), the block sits off-centre.
gsap.set(['.hero__copy', '.scroll-hint'], { x: 0, xPercent: -50 }); // x: 0 drops the px value GSAP read from the CSS translate
gsap.to('.hero__copy', { yPercent: -60, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom 30%', scrub: true } });
gsap.to('.scroll-hint', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: '20% top', scrub: true } });
gsap.from(['#about .side-copy', '#about .loupe-hint'], { opacity: 0, y: 40, stagger: 0.1, scrollTrigger: { trigger: '#about', start: 'top 60%', end: 'top 10%', scrub: true } });
gsap.from('.breeze__copy', { opacity: 0, y: 60, scrollTrigger: { trigger: '#breeze', start: 'top 70%', end: 'top 20%', scrub: true } });
document.querySelectorAll('[data-depth]').forEach(el => {
  const d = +el.dataset.depth;
  gsap.fromTo(el, { y: 260 * d + 60, opacity: 0 }, { y: -260 * d, opacity: 1, ease: 'none', scrollTrigger: { trigger: el.closest('.sec'), start: 'top 85%', end: 'bottom top', scrub: true } });
});
document.querySelectorAll('.sec-title').forEach(el => {
  // side content rises along its column line rather than sliding in sideways
  gsap.from(el.children, { opacity: 0, y: 50, stagger: 0.12, scrollTrigger: { trigger: el.closest('.sec'), start: 'top 70%', end: 'top 25%', scrub: true } });
});
gsap.from('#tech .side-copy', { opacity: 0, y: 40, scrollTrigger: { trigger: '#tech', start: 'top 40%', end: 'top 0%', scrub: true } });

// A day in black: while the section is pinned, the strip slides from the left column line
// until its last card meets the right gutter.
const dayTrack = document.querySelector('.day__track');
gsap.to(dayTrack, {
  x: () => -Math.max(0, dayTrack.scrollWidth - (document.documentElement.clientWidth - 2 * parseFloat(getComputedStyle(dayTrack).paddingLeft || 0))),
  ease: 'none',
  scrollTrigger: { trigger: '#day', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
});
gsap.from('.day__card', { opacity: 0, y: 60, stagger: 0.08, scrollTrigger: { trigger: '#day', start: 'top 80%', end: 'top 10%', scrub: true } });

// Reviews slider. One animated scroll position (rev.v) drives the track for mouse drag,
// momentum, arrows and settling on a card, so it all moves with the same easing. Touch and
// trackpads scroll natively (CSS snap only on coarse pointers) and the value just follows.
const revTrack = document.getElementById('revTrack');
const revCards = [...revTrack.children];
const revNum = document.getElementById('revNum');
const revPrev = document.getElementById('revPrev'), revNext = document.getElementById('revNext');
const revStep = () => revCards[1].offsetLeft - revCards[0].offsetLeft;
const revMax = () => revTrack.scrollWidth - revTrack.clientWidth;
const rev = { v: 0 };
const revApply = () => { revTrack.scrollLeft = rev.v; };
const revFollow = gsap.quickTo(rev, 'v', { duration: 0.5, ease: 'power3', onUpdate: revApply }); // drag: eases after the hand
function revGo(v, duration = 0.9) {
  gsap.killTweensOf(rev);
  gsap.to(rev, { v: clamp(v, 0, revMax()), duration, ease: 'power3.out', onUpdate: revApply });
}
const revSnap = v => clamp(Math.round(v / revStep()) * revStep(), 0, revMax());
function revSync() {
  if (!gsap.isTweening(rev) && !revDrag) rev.v = revTrack.scrollLeft; // native swipe / trackpad
  const i = Math.round(revTrack.scrollLeft / revStep());
  revNum.textContent = String(Math.min(revCards.length, i + 1)).padStart(2, '0');
  revPrev.disabled = revTrack.scrollLeft < 4;
  revNext.disabled = revTrack.scrollLeft > revMax() - 4;
}
revPrev.addEventListener('click', () => revGo(revSnap(rev.v) - revStep()));
revNext.addEventListener('click', () => revGo(revSnap(rev.v) + revStep()));
revTrack.addEventListener('scroll', revSync, { passive: true });
revTrack.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { e.preventDefault(); revNext.click(); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); revPrev.click(); }
});
let revDrag = null;
revTrack.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  gsap.killTweensOf(rev);
  rev.v = revTrack.scrollLeft;
  revDrag = { x: e.clientX, start: rev.v, lx: e.clientX, lt: performance.now(), vel: 0 };
  revTrack.classList.add('is-dragging');
  e.preventDefault();
});
addEventListener('pointermove', e => {
  if (!revDrag) return;
  const now = performance.now(), dt = Math.max(1, now - revDrag.lt);
  revDrag.vel = revDrag.vel * 0.6 + ((e.clientX - revDrag.lx) / dt) * 0.4; // px per ms, smoothed
  revDrag.lx = e.clientX; revDrag.lt = now;
  // a little resistance past either end
  let v = revDrag.start - (e.clientX - revDrag.x);
  if (v < 0) v *= 0.35; else if (v > revMax()) v = revMax() + (v - revMax()) * 0.35;
  revFollow(v);
});
addEventListener('pointerup', () => {
  if (!revDrag) return;
  const fling = -revDrag.vel * 260; // momentum: carry on in the throw direction
  revDrag = null;
  revTrack.classList.remove('is-dragging');
  revGo(revSnap(rev.v + fling), 1.0);
});
addEventListener('resize', () => { rev.v = revTrack.scrollLeft; revSync(); });
revSync();

// Drag badge: rests in the middle of the cards; while the mouse is anywhere in the section it
// follows the pointer (lagging a touch), and drifts back to the middle when the mouse leaves.
// It lives inside the section, so it scrolls with the page.
const revDragEl = document.querySelector('.rev__drag'), revSec = document.getElementById('reviews');
const dragX = gsap.quickTo(revDragEl, 'x', { duration: 0.6, ease: 'power3' });
const dragY = gsap.quickTo(revDragEl, 'y', { duration: 0.6, ease: 'power3' });
let revIn = false;
function revRest() {
  const s = revSec.getBoundingClientRect(), t = revTrack.getBoundingClientRect();
  return { x: s.width / 2, y: t.top - s.top + t.height * (isMobile ? 0.32 : 0.5) };
}
function revToRest(instant) {
  const r = revRest();
  if (instant) gsap.set(revDragEl, r); else { dragX(r.x); dragY(r.y); }
}
revToRest(true);
addEventListener('resize', () => revToRest(true));
document.fonts && document.fonts.ready.then(() => revToRest(true));
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const s = revSec.getBoundingClientRect();
  const inside = e.clientY >= s.top && e.clientY <= s.bottom;
  if (inside || revDrag) { dragX(e.clientX - s.left); dragY(e.clientY - s.top); }
  else if (revIn) revToRest();
  revIn = inside;
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { if (revIn) { revIn = false; revToRest(); } });
revTrack.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') revDragEl.classList.add('is-down'); });
addEventListener('pointerup', () => revDragEl.classList.remove('is-down'));
addEventListener('pointercancel', () => revDragEl.classList.remove('is-down'));

// Finale: one pinned stage. The statement and the buy UI never move — they only cross-fade
// while the shirt (the one thing in motion) descends from the top into the ring.
const finale = document.getElementById('buy');
const statementEl = document.querySelector('.statement');
const finaleUI = document.querySelector('.finale__ui');
const ring = document.getElementById('ring');
function finaleProgress() {
  return clamp((lenis.scroll - finale.offsetTop) / Math.max(1, finale.offsetHeight - vh));
}
// px the finale stage has scrolled up after its pin released — ring and shirt follow it
function finaleLift() {
  return Math.max(0, lenis.scroll - (finale.offsetTop + finale.offsetHeight - vh));
}
function updateFinale() {
  const f = finaleProgress();
  ring.style.translate = `0 ${-finaleLift()}px`;
  statementEl.style.opacity = 1 - smooth(clamp((f - 0.12) / 0.22));
  // fades out as the shirt is handed to the pack, so the 360° pill never crosses it
  const ui = smooth(clamp((f - 0.3) / 0.3)) * (1 - smooth(clamp(handoffProgress() * 2.5)));
  finaleUI.style.opacity = ui;
  finaleUI.style.pointerEvents = ui > 0.5 ? '' : 'none';
  ring.style.opacity = 0.9 * ui;
}

document.querySelectorAll('.video-card').forEach(card => {
  const play = card.querySelector('.play'); // photo cards have no play button
  if (play) play.addEventListener('click', () => card.classList.toggle('is-playing'));
});

/* ------------------------------------------------------------------ */
/* Preloader → unboxing intro → hero                                   */
/* ------------------------------------------------------------------ */
const loaderEl = document.getElementById('loader');
const numL = document.getElementById('loaderNumL');
const numR = document.getElementById('loaderNumR');
const heroTitle = document.querySelector('.hero__title');
gsap.set(heroTitle, { clipPath: 'inset(0 0 100% 0)', yPercent: 40, letterSpacing: '0.12em' });
gsap.set(['.hero__tag', '.sec--hero .cta', '.scroll-hint', '.header'], { opacity: 0, y: 20 });

// vector shirt in the preloader folds once — sleeves in, sides in, hem up — then the box intro starts
const foldTl = gsap.timeline({ defaults: { duration: 0.45, ease: 'power2.inOut' } })
  .to('.fold__l', { rotateY: 180 }, 0.15)
  .to('.fold__r', { rotateY: -180 }, 0.4)
  .to(['.fold__l', '.fold__r'], { opacity: 0, duration: 0.01 }, 0.86)
  .to('.fold__cb', { rotateX: 180 }, 0.9)
  .to('.fold', { scale: 0.9, opacity: 0, duration: 0.3, ease: 'power2.in' }, 1.35);
const foldDone = new Promise(res => foldTl.eventCallback('onComplete', res));

let started = false;
const intro = { playing: false, frame: 0, blend: 1, descending: false }; // blend 1 = intro framing, 0 = section pose
const INTRO_FPS = 20;

function setCounter(v) {
  const n = String(Math.floor(v)).padStart(3, '0');
  numL.textContent = n; numR.textContent = n;
}
function playIntro() {
  if (started) return; // skipped before the frames were ready
  const n = seqs.intro ? seqs.intro.count : 0;
  if (!n || reduceMotion || arrivalHash) return enterHero(true);
  loaderEl.classList.add('is-playing');
  intro.playing = true;
  const dur = n / INTRO_FPS;
  gsap.to(intro, { frame: n - 1, duration: dur, ease: 'none', onComplete: () => enterHero(false) });
  // the sink starts while the last unfolding frames still play, so there's no stop-then-go at the hand-over
  gsap.delayedCall(Math.max(0, dur - DESCENT_LEAD), startDescent);
}
const DESCENT_LEAD = 0.7; // s of overlap between the unfolding and the sink
function startDescent(duration = 3.4) {
  if (intro.descending) return;
  intro.descending = true;
  gsap.fromTo(intro, { blend: 1 }, { blend: 0, duration, ease: 'sine.inOut' });
}
function enterHero(skipped) {
  if (started) return;
  started = true;
  if (arrivalHash) setTimeout(() => lenis.scrollTo(anchorTarget(arrivalHash), { immediate: true, force: true }), 1000);
  gsap.killTweensOf(intro, 'frame'); // the sink (blend) may already be running
  intro.playing = false;
  loaderEl.classList.add('is-done');
  foldTl.progress(1); // completes (and resolves foldDone) so boot keeps loading after a skip
  document.body.classList.remove('is-loading');
  document.documentElement.classList.remove('is-loading');
  scrollUnlockAt = performance.now() + 900;
  scrollTo(0, 0);
  lenis.scrollTo(0, { immediate: true, force: true });
  lenis.start();
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    // the unfolded shirt sinks to its hero spot: long and even, no snap at either end
    .add(() => startDescent(skipped ? 1.6 : 3.4), 0)
    .to(heroTitle, { clipPath: 'inset(0 0 0% 0)', yPercent: 0, letterSpacing: '-0.01em', duration: 2 }, skipped ? 0.4 : 1.1)
    .to('.hero__tag', { opacity: 1, y: 0, duration: 1.4 }, skipped ? 0.8 : 1.6)
    .to('.sec--hero .cta', { opacity: 1, y: 0, duration: 1.4 }, skipped ? 0.9 : 1.8)
    .to(['.header', '.scroll-hint'], { opacity: 1, y: 0, duration: 1.4 }, skipped ? 1.0 : 2.0);
}
document.getElementById('skipIntro').addEventListener('click', () => enterHero(true));
// arriving from the menu of another page (index.html#tech): skip the intro and go to that section
const arrivalHash = /^#[\w-]+$/.test(location.hash) && (location.hash === '#buy' || location.hash === '#packed' || document.querySelector(location.hash)) ? location.hash : null;

async function boot() {
  const m = await fetch(SEQ + 'manifest.json?v=' + ASSET_V).then(r => r.json());

  // phase 1 (counted by the preloader): unboxing + black story frames
  const total = m.intro + Math.ceil(m.story / 6);
  let done = 0, shown = 0, lastT = performance.now();
  const tick = () => { done++; };
  const raf = now => {
    // the counter runs with the fold, never ahead of what has actually loaded
    shown = Math.min(100, done / total * 100, foldTl.progress() * 100);
    lastT = now;
    setCounter(shown);
    if (!intro.playing && !started) requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  const story = loadSeq('black/story', m.story, tick);
  await Promise.all([loadSeq('intro', m.intro, tick), seqs['black/story'].keysLoaded, foldDone]);
  // decode the hand-over frames up front: a first-time decode of a 1440p frame mid-animation is the 'hitch'
  // (capped: a background tab may never settle decode(), and the intro must not wait on it)
  await Promise.race([
    Promise.all([seqs.intro.imgs[m.intro - 1], seqs['black/story'].imgs[0]]
      .filter(Boolean).map(im => (im.decode ? im.decode().catch(() => {}) : null))),
    new Promise(res => setTimeout(res, 500)),
  ]);
  setCounter(100);
  playIntro();
  loadConfigurator(); // avatar clips are light, don't make them wait behind the shirt sequences
  await story;

  // phase 2: the rest streams in the background (white jumps the queue once it is asked for)
  manifest = m;
  if (document.body.classList.contains('is-white')) loadWhite();
  await loadSeq('black/turn', m.turn);
  await loadWhite();
}
let manifest = null, whiteLoading = null;
function loadWhite() {
  if (!manifest) return Promise.resolve();
  return whiteLoading || (whiteLoading = Promise.all([
    loadSeq('white/story', manifest.story), loadSeq('white/turn', manifest.turn),
    manifest.intro_w ? loadSeq('intro_w', manifest.intro_w) : null,
  ]));
}
// start fetching on the click itself; the theme flips a beat later under the veil
toggle.addEventListener('click', () => { if (toggle.getAttribute('aria-pressed') === 'true') loadWhite(); });

/* ------------------------------------------------------------------ */
/* Render loop                                                         */
/* ------------------------------------------------------------------ */
const INTRO_POSE = { x: 0.5, y: 0.5, s: 1.0 };
let last = performance.now();
let pSmooth = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!started && scrollY) scrollTo(0, 0); // browsers restore the old scroll position late, after load

  if (intro.playing) {
    // unboxing frames are full 16:9 shots; their height = base(), the same scale the story frames start at
    const img = frameImg('intro', intro.frame);
    if (img && intro.blend < 1) {
      // sink already under way: same framing as the story frames, so the pose carries straight over
      const hero = poseAt(sceneProgress()), b = smooth(intro.blend);
      drawFrame(img, { x: lerp(hero.x, INTRO_POSE.x, b), y: lerp(hero.y, INTRO_POSE.y, b), s: lerp(hero.s, INTRO_POSE.s, b) });
    } else if (img) {
      const H = base(), W = H * img.width / img.height;
      ctx.drawImage(img, (vw / 2 - W / 2) * dpr, (vh / 2 - H / 2) * dpr, W * dpr, H * dpr);
    }
  } else if (seqs['black/story']) {
    // the shirt trails the scroll a little, so frame scrubbing never steps
    const raw = sceneProgress();
    pSmooth = Math.abs(raw - pSmooth) > 3 ? raw : damp(pSmooth, raw, 6, dt);
    const p = pSmooth;
    let pose = poseAt(p);
    const hand = handoffProgress();
    if (intro.blend > 0) {
      const b = smooth(intro.blend);
      pose = { x: lerp(pose.x, INTRO_POSE.x, b), y: lerp(pose.y, INTRO_POSE.y, b), s: lerp(pose.s, INTRO_POSE.s, b) };
    }

    if (!turn.dragging) {
      turn.target += turn.vel; turn.vel *= 0.92;
      if (p > IDX.buy - 0.05 && !reduceMotion && Math.abs(turn.vel) < 0.0005) turn.target += dt * 0.02; // slow idle spin
    }
    turn.angle = damp(turn.angle, turn.target, 7, dt);

    // Leaving the buy view: whatever angle the visitor left it at, the shirt turns to its
    // front (driven by scroll, so it is always facing us at the swap) and lowers to PACK_START.
    if (hand > 0) {
      if (handoff.from === null) handoff.from = turn.angle;
      const front = Math.round(handoff.from); // angle 0 (mod 1) = front view
      turn.angle = turn.target = lerp(handoff.from, front, smooth(clamp(hand / 0.75)));
      turn.vel = 0;
      pose = lerpPose(pose, PACK_START, smooth(hand));
    } else if (handoff.from !== null) {
      handoff.from = null;
    }

    if (p < IDX.statement + 0.5) {
      // outside the buy view the turntable eases back to the back view, ready for the hand-over
      if (!turn.dragging) turn.target = damp(turn.target, Math.round(turn.target - 0.5) + 0.5, 3, dt);
    }
    // under the avatar the story frame fades out, or it would ghost behind him
    if (p <= IDX.statement || !seqs['black/turn']) drawColored('story', storyFrame(Math.min(p, IDX.statement)), pose, 1 - smooth(clamp(cfgVis)));
    else if (hand < 1) drawColored('turn', angleToFrame(turn.angle), pose); // then the pack render takes over
    drawConfigurator(p, pose, dt);
    updateHotspots(p, pose);
    updateCardLinks(p, pose);
    updateLoupe(hand > 0 ? -1 : p, pose, dt);
    updateFinale();
    drawPack();
  }
  requestAnimationFrame(frame);
}

addEventListener('resize', () => { resize(); ScrollTrigger.refresh(); });
// late layout changes (web font swap, images) shift section heights: re-measure the scroll map once they land
document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
addEventListener('load', () => ScrollTrigger.refresh());
ScrollTrigger.addEventListener('refresh', measure);
resize();
requestAnimationFrame(frame);
boot().catch(err => { console.error(err); enterHero(true); });
})();
