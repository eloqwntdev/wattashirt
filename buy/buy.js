// Buy page (/buy). Colour is the theme, like on the landing: picking White flips the page to the light studio.
// Options sync to the URL (?color=&fit=&size=), so a configured tee can be shared or linked from the landing.
(() => {
  // Where "Checkout" goes once payments are connected (Shopify / Stripe Payment Link, etc.).
  // {items} is filled in as color-fit-size-qty, comma separated (black-over-M-1,white-over-M-1).
  // Empty = checkout not connected yet: the bag says so.
  const CHECKOUT_URL = '';
  const PRICE = 75;

  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isWhite = () => root.classList.contains('is-white');
  const params = new URLSearchParams(location.search);

  const state = {
    color: isWhite() ? 'white' : 'black',
    fit: params.get('fit') === 'reg' ? 'reg' : 'over',
    size: ['S', 'M', 'L', 'XL'].includes((params.get('size') || '').toUpperCase()) ? params.get('size').toUpperCase() : null,
    qty: 1,
  };
  const FIT = { reg: 'Regular', over: 'Oversized' };
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const money = n => `$${n}`;

  /* ---------- toast ---------- */
  const toast = $('#toast'); let toastT;
  function say(msg) { toast.textContent = msg; toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 1800); }

  /* ---------- render everything that depends on the pick ---------- */
  function render() {
    const total = PRICE * state.qty;
    const label = `Buy now · ${money(total)}`;
    $('#colorName').textContent = cap(state.color);
    $('#colorVal').textContent = cap(state.color);
    $('#fitVal').textContent = FIT[state.fit];
    $('#sizeVal').textContent = state.size || 'Pick one';
    $('#price').textContent = money(total);
    $('#buyLabel').textContent = label;
    $('#qty').textContent = state.qty;
    $$('[data-bind="color"]').forEach(e => e.textContent = cap(state.color));
    $$('[data-bind="fit"]').forEach(e => e.textContent = FIT[state.fit]);
    $$('[data-bind="size"]').forEach(e => e.textContent = state.size ? `Size ${state.size}` : 'Pick a size');
    $$('[data-bind="qty"]').forEach(e => e.textContent = state.qty);
    $$('[data-bind="total"]').forEach(e => e.textContent = money(total));
    $$('[data-bind="label"]').forEach(e => e.textContent = state.size ? label : 'Choose size');
    $$('.sw').forEach(b => b.classList.toggle('is-on', b.dataset.color === state.color));
    $$('.sizes button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.size === state.size)));
    const seg = $('#fitSeg');
    seg.dataset.i = state.fit === 'reg' ? 0 : 1;
    $$('button', seg).forEach(b => b.classList.toggle('is-on', b.dataset.fit === state.fit));
    const c = state.color === 'white' ? 'w' : 'b';
    if (typeof stageRefresh === 'function') stageRefresh();
    $('#bothLabel').textContent = `Get both · ${money(PRICE * 2 * state.qty)}`;
    $('#recapImg').src = `/assets/brand/shirt_front_${c}.webp`;
    const pill = $('#themeToggle');
    pill.setAttribute('aria-pressed', String(isWhite()));
    $('.pill__label', pill).textContent = isWhite() ? 'I Wanna Black' : 'I Wanna White';
    // shareable URL
    const q = new URLSearchParams({ color: state.color, fit: state.fit });
    if (state.size) q.set('size', state.size);
    history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`);
    try { localStorage.setItem('ws-pick', JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- colour = theme, with the site's instant 150 ms veil ---------- */
  const veil = $('#veil');
  function setColor(color) {
    if (color === state.color) return;
    const white = color === 'white';
    veil.style.setProperty('--veil', white ? '#eaeaea' : '#000');
    veil.classList.add('is-on');
    setTimeout(() => {
      root.classList.toggle('is-white', white);
      state.color = color;
      try { localStorage.setItem('ws-theme', white ? 'white' : 'black'); } catch (e) {}
      turn.reset();
      render();
      setTimeout(() => veil.classList.remove('is-on'), 30);
    }, reduce ? 0 : 150);
  }
  $$('.sw').forEach(b => b.addEventListener('click', () => setColor(b.dataset.color)));
  $('#themeToggle').addEventListener('click', () => setColor(isWhite() ? 'black' : 'white'));

  /* ---------- fit, size, quantity ---------- */
  $$('#fitSeg button').forEach(b => b.addEventListener('click', () => { state.fit = b.dataset.fit; render(); stageRefresh(true); }));
  const sizeOpt = $('#sizeOpt');
  $$('.sizes button').forEach(b => b.addEventListener('click', () => { state.size = b.dataset.size; sizeOpt.classList.remove('is-missing'); render(); }));
  $('#qtyMinus').addEventListener('click', () => { state.qty = Math.max(1, state.qty - 1); render(); });
  $('#qtyPlus').addEventListener('click', () => { state.qty = Math.min(9, state.qty + 1); render(); });

  /* ---------- bag: several items, e.g. one black and one white ---------- */
  const SIZES = ['S', 'M', 'L', 'XL'];
  const valid = it => it && ['black', 'white'].includes(it.color) && FIT[it.fit] && SIZES.includes(it.size) && it.qty >= 1 && it.qty <= 9;
  let bag = [];
  try { bag = (JSON.parse(localStorage.getItem('ws-bag')) || []).filter(valid); } catch (e) {}
  const sameItem = (a, b) => a.color === b.color && a.fit === b.fit && a.size === b.size;
  function add(color, qty = state.qty) {
    const item = { color, fit: state.fit, size: state.size, qty };
    const hit = bag.find(x => sameItem(x, item));
    if (hit) hit.qty = Math.min(9, hit.qty + qty); else bag.push(item);
    lastAdded = item;
    renderBag();
  }
  let lastAdded = null;
  const shirtImg = color => `/assets/brand/shirt_front_${color === 'white' ? 'w' : 'b'}.webp`;
  function renderBag() {
    try { localStorage.setItem('ws-bag', JSON.stringify(bag)); } catch (e) {}
    const total = bag.reduce((n, x) => n + x.qty * PRICE, 0), count = bag.reduce((n, x) => n + x.qty, 0);
    $('#bagList').innerHTML = bag.map((x, i) => `
      <li class="bag__item">
        <img src="${shirtImg(x.color)}" alt="">
        <div class="bag__txt"><b>Wattashirt ${cap(x.color)}</b><span>${FIT[x.fit]} · Size ${x.size}</span>
          <span class="bag__qty"><button type="button" data-i="${i}" data-d="-1" aria-label="One less">−</button><output>${x.qty}</output><button type="button" data-i="${i}" data-d="1" aria-label="One more">+</button></span></div>
        <div class="bag__end"><b>${money(x.qty * PRICE)}</b><button type="button" class="bag__rm" data-rm="${i}">Remove</button></div>
      </li>`).join('') || '<li class="bag__empty">Your bag is empty.</li>';
    $('#bagTotal').textContent = money(total);
    $('#checkoutTotal').textContent = money(total);
    $('#checkoutBtn').classList.toggle('is-off', !bag.length);
    const bb = $('#bagBtn');
    bb.hidden = !count; $('#bagCount').textContent = count;
    bb.setAttribute('aria-label', `Open bag, ${count} item${count === 1 ? '' : 's'}`);
    // upsell: the other colour, same fit and size, if it isn't in the bag yet
    const ref = lastAdded || bag[bag.length - 1];
    const other = ref && { color: ref.color === 'black' ? 'white' : 'black', fit: ref.fit, size: ref.size };
    const show = other && !bag.some(x => x.color === other.color);
    const up = $('#upsell'); up.hidden = !show;
    if (show) {
      up.dataset.color = other.color; up.dataset.fit = other.fit; up.dataset.size = other.size;
      $('#upsellName').textContent = `Add ${cap(other.color)} too`;
      $('#upsellOpts').textContent = `${FIT[other.fit]} · Size ${other.size}. One for each mode.`;
      $('#upsellDot').style.background = other.color === 'white' ? '#f4f4f4' : '#000';
      $('#upsellAdd').textContent = `+ ${money(PRICE)}`;
    }
  }
  $('#bagList').addEventListener('click', e => {
    const q = e.target.closest('[data-d]'), rm = e.target.closest('[data-rm]');
    if (q) { const it = bag[+q.dataset.i]; it.qty = Math.max(0, Math.min(9, it.qty + +q.dataset.d)); if (!it.qty) bag.splice(+q.dataset.i, 1); renderBag(); }
    if (rm) { bag.splice(+rm.dataset.rm, 1); renderBag(); }
  });
  $('#upsellAdd').addEventListener('click', () => {
    const up = $('#upsell');
    const item = { color: up.dataset.color, fit: up.dataset.fit, size: up.dataset.size, qty: 1 };
    const hit = bag.find(x => sameItem(x, item));
    if (hit) hit.qty = Math.min(9, hit.qty + 1); else bag.push(item);
    lastAdded = item; renderBag(); say(`${cap(item.color)} added`);
  });

  /* ---------- buy: size first, then into the bag ---------- */
  function needSize() {
    sizeOpt.classList.remove('is-missing'); void sizeOpt.offsetWidth; sizeOpt.classList.add('is-missing');
    sizeOpt.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    say('Pick your size first');
  }
  function buy() { if (!state.size) { needSize(); return; } add(state.color); openSheet(); }
  $('#buyForm').addEventListener('submit', e => { e.preventDefault(); buy(); });
  $('#barBtn').addEventListener('click', buy);
  $('#recapBtn').addEventListener('click', buy);
  $('#bothBtn').addEventListener('click', () => {
    if (!state.size) { needSize(); return; }
    add('black'); add('white'); lastAdded = null; renderBag(); openSheet();
  });
  $('#bagBtn').addEventListener('click', openSheet);

  const sheet = $('#sheet'); let lastFocus = null;
  function openSheet() {
    lastFocus = document.activeElement;
    $('#sheetNote').hidden = true;
    sheet.classList.add('is-open'); sheet.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#checkoutBtn').focus(), 300);
  }
  function closeSheet() { sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden', 'true'); if (lastFocus) lastFocus.focus(); }
  $$('[data-close]', sheet).forEach(el => el.addEventListener('click', closeSheet));
  addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('is-open')) closeSheet(); });
  const go = $('#checkoutBtn');
  if (!CHECKOUT_URL) { go.removeAttribute('href'); go.setAttribute('role', 'button'); go.tabIndex = 0; }
  go.addEventListener('click', e => {
    if (!bag.length) { e.preventDefault(); closeSheet(); return; }
    if (!CHECKOUT_URL) { e.preventDefault(); $('#sheetNote').hidden = false; return; }
    go.href = CHECKOUT_URL.replace('{items}', encodeURIComponent(bag.map(x => `${x.color}-${x.fit}-${x.size}-${x.qty}`).join(',')));
  });
  renderBag();

  /* ---------- sticky bar: only while neither the main button nor the recap card is on screen ---------- */
  const bar = $('#bar');
  let mainOut = false, recapIn = false;
  function syncBar() {
    const on = mainOut && !recapIn;
    bar.classList.toggle('is-on', on);
    bar.setAttribute('aria-hidden', String(!on));
    $('#barBtn').tabIndex = on ? 0 : -1;
  }
  new IntersectionObserver(([en]) => { mainOut = !en.isIntersecting && en.boundingClientRect.top < 0; syncBar(); }).observe($('#buyBtn'));
  new IntersectionObserver(([en]) => { recapIn = en.isIntersecting; syncBar(); }, { threshold: .3 }).observe($('#recap'));

  /* ---------- the stage: one draggable view, two sequences ----------
     'tee'  = the bare tee, a full 360° (seq/{black|white}/turn, 240 frames; there is one cut per colour)
     'muse' = the muse wearing the chosen colour + fit (seq/av/{b|w}_{over|reg}_turn, 61 frames front → side → back);
              dragging plays it front → back → front, so it turns all the way like the tee.
     Picking a fit shows the muse, because only his clips differ between Regular and Oversized. */
  const stage = $('#stage'), img = $('.turnable__img', stage);
  let view = 'tee';
  const TURN_ANGLES = [0, 0.25, 0.375, 0.5, 0.625, 0.75, 1], TURN_N = 240, AV_N = 61;
  const wrap = a => ((a % 1) + 1) % 1;
  function teeFrame(a) {
    a = wrap(a); let k = 0;
    while (k < 5 && a >= TURN_ANGLES[k + 1]) k++;
    const t = (a - TURN_ANGLES[k]) / (TURN_ANGLES[k + 1] - TURN_ANGLES[k]);
    return Math.min(TURN_N - 1, Math.round((k + t) * TURN_N / 6));
  }
  const museFrame = a => { const u = wrap(a) * 2; return Math.round((u < 1 ? u : 2 - u) * (AV_N - 1)); }; // 0 front, .25 side, .5 back
  const pad4 = n => String(n).padStart(4, '0');
  const key = () => view === 'tee' ? `tee_${state.color}` : `av_${state.color === 'white' ? 'w' : 'b'}_${state.fit}`;
  const url = (k, i) => k.startsWith('tee_') ? `/assets/seq/${k.slice(4)}/turn/${pad4(i)}.webp` : `/assets/seq/av/${k.slice(3)}_turn/${pad4(i)}.webp?v=17`;
  const count = k => k.startsWith('tee_') ? TURN_N : AV_N;
  const cache = {};
  function load(k) {
    if (cache[k]) return;
    const n = count(k), list = cache[k] = new Array(n), order = [];
    for (const step of [8, 4, 2, 1]) for (let i = 0; i < n; i += step) if (!order.includes(i)) order.push(i);
    order.forEach(i => { const im = new Image(); im.decoding = 'async'; im.onload = () => { list[i] = im.src; }; im.src = url(k, i); });
  }
  function nearest(k, f) {
    const list = cache[k], n = count(k); if (!list) return null;
    for (let d = 0; d < n; d++) {
      const a = list[k.startsWith('tee_') ? (f + d) % n : Math.min(n - 1, f + d)], b = list[k.startsWith('tee_') ? (f - d + n) % n : Math.max(0, f - d)];
      if (a) return a; if (b) return b;
    }
    return null;
  }
  const frameOf = a => view === 'tee' ? teeFrame(a) : museFrame(a);
  const st = { angle: 0, target: 0, vel: 0, drag: false, lastX: 0, touched: false, shown: '' };
  function paintNow() {   // first frame of a new sequence: show it straight away, never the other colour or fit
    const k = key(); load(k);
    img.src = nearest(k, frameOf(st.angle)) || url(k, frameOf(st.angle));
    st.shown = img.src;
  }
  const VIEW_ANGLE = { front: 0, side: 0.25, back: 0.5 };
  function setView(v, angle) {
    view = v;
    stage.classList.toggle('is-muse', v === 'muse');
    if (angle !== undefined) { st.angle = st.target = angle; st.vel = 0; }
    paintNow();
    const on = v === 'tee' ? '360' : (Object.keys(VIEW_ANGLE).find(n => Math.abs(museFrame(st.target) - museFrame(VIEW_ANGLE[n])) < 6) || '');
    $$('.thumb-btn').forEach(x => x.classList.toggle('is-on', x.dataset.view === on));
  }
  $$('.thumb-btn').forEach(b => b.addEventListener('click', () => {
    st.touched = true;
    if (b.dataset.view === '360') setView('tee', 0);
    else setView('muse', VIEW_ANGLE[b.dataset.view]);
  }));
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    st.drag = true; st.touched = true; st.lastX = e.clientX; st.vel = 0;
    stage.classList.add('is-drag'); stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!st.drag) return;
    const dx = e.clientX - st.lastX; st.lastX = e.clientX;
    const w = stage.clientWidth * 0.9; st.target -= dx / w; st.vel = -dx / w;
  });
  const end = () => { st.drag = false; stage.classList.remove('is-drag'); if (view === 'muse') setView('muse'); };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  $$('[data-spin]', stage).forEach(b => b.addEventListener('click', () => { st.touched = true; st.target += 0.125 * +b.dataset.spin; st.vel = 0; if (view === 'muse') setView('muse'); }));
  const turn = { reset: paintNow };   // colour change
  function stageRefresh(fitChanged) {  // called by render(): thumbnails follow colour + fit
    $$('[data-av]').forEach(im => { im.src = `/assets/seq/av/${state.color === 'white' ? 'w' : 'b'}_${state.fit}_turn/${pad4(museFrame(VIEW_ANGLE[im.dataset.av]))}.webp?v=17`; });
    if (fitChanged) setView('muse', view === 'muse' ? undefined : 0);
  }
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  let tLast = 0;
  (function tick(t) {
    const dt = tLast ? Math.min(.05, (t - tLast) / 1000) : 0; tLast = t;
    if (!st.drag) { st.target += st.vel; st.vel *= 0.92; if (!st.touched && !reduce && view === 'tee') st.target += dt * 0.03; }
    st.angle = damp(st.angle, st.target, 7, dt);
    const src = nearest(key(), frameOf(st.angle));
    if (src && src !== st.shown) { img.src = src; st.shown = src; }
    requestAnimationFrame(tick);
  })(0);
  load(key());
  // warm the muse clips for both fits of this colour, so switching fit is instant
  setTimeout(() => ['over', 'reg'].forEach(f => load(`av_${state.color === 'white' ? 'w' : 'b'}_${f}`)), 1200);

  /* ---------- reveal ---------- */
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12 });
  $$('.rv').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 60}ms`; io.observe(el); });

  
  render();
})();
