// Brand guidelines page (/brand). No libraries: theme switch, menu, section rail, scroll reveal and the
// interactive specimens. Theme is shared with the landing through localStorage['ws-theme'].
(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isWhite = () => root.classList.contains('is-white');

  /* ---------- theme: instant, a 150 ms veil in the new colour, setTimeout so it fires in hidden tabs ---------- */
  const toggle = $('#themeToggle'), veil = $('#veil');
  function syncTheme() {
    const white = isWhite();
    toggle.setAttribute('aria-pressed', String(white));
    $('.pill__label', toggle).textContent = white ? 'I Wanna Black' : 'I Wanna White';
    $$('img[data-black]').forEach(img => { const src = img.dataset[white ? 'white' : 'black']; if (img.getAttribute('src') !== src) img.src = src; });
    $$('.look-color').forEach(el => { el.textContent = white ? 'White' : 'Black'; });
    turn.reload();
  }
  function setTheme(white) {
    if (white === isWhite()) return;
    veil.style.setProperty('--veil', white ? '#eaeaea' : '#000');
    veil.classList.add('is-on');
    setTimeout(() => {
      root.classList.toggle('is-white', white);
      try { localStorage.setItem('ws-theme', white ? 'white' : 'black'); } catch (e) {}
      syncTheme();
      document.dispatchEvent(new CustomEvent('themechange', { detail: { white } }));
      setTimeout(() => veil.classList.remove('is-on'), 30);
    }, reduce ? 0 : 150);
  }
  toggle.addEventListener('click', () => setTheme(!isWhite()));
  $$('.demo-theme').forEach(b => b.addEventListener('click', () => setTheme(!isWhite())));

  /* ---------- menu ---------- */
  const menuBtn = $('#menuBtn'), menu = $('#menu');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    menuBtn.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* ---------- sections: rail, page number, progress, keyboard ---------- */
  const secs = $$('main > .sec'), rail = $$('.rail a'), pageNo = $('#pageNo'), bar = $('#progress');
  let current = 0;
  const pad = n => String(n).padStart(2, '0');
  function setCurrent(i) {
    if (i === current && rail[i].classList.contains('is-on')) return;
    current = i;
    rail.forEach((a, j) => a.classList.toggle('is-on', j === i));
    pageNo.textContent = `${pad(i + 1)} / ${pad(secs.length)}`;
  }
  function onScroll() {
    const mid = innerHeight * .45;
    let i = 0;
    secs.forEach((s, j) => { if (s.getBoundingClientRect().top <= mid) i = j; });
    setCurrent(i);
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
  addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { setMenu(false); return; }
    const dir = (e.key === 'ArrowDown' || e.key === 'PageDown') ? 1 : (e.key === 'ArrowUp' || e.key === 'PageUp') ? -1 : 0;
    if (!dir) return;
    const next = secs[Math.max(0, Math.min(secs.length - 1, current + dir))];
    if (!next) return;
    e.preventDefault();
    next.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------- scroll reveal ---------- */
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    io.unobserve(en.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .12 });
  $$('.rv').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 60}ms`; io.observe(el); });

  /* ---------- toast ---------- */
  const toast = $('#toast'); let toastT;
  function say(msg) {
    toast.textContent = msg; toast.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 1600);
  }

  /* ---------- cover: the shirt drifts with the pointer ---------- */
  const cover = $('#cover'), coverShirt = $('#coverShirt');
  if (!reduce && matchMedia('(pointer: fine)').matches) {
    cover.addEventListener('pointermove', e => {
      const r = cover.getBoundingClientRect();
      coverShirt.style.setProperty('--mx', `${((e.clientX - r.left) / r.width - .5) * -24}px`);
      coverShirt.style.setProperty('--my', `${((e.clientY - r.top) / r.height - .5) * -14}px`);
    });
    cover.addEventListener('pointerleave', () => { coverShirt.style.setProperty('--mx', '0px'); coverShirt.style.setProperty('--my', '0px'); });
  }

  /* ---------- brand idea: pillars open ---------- */
  $$('.pillar').forEach((p, i) => {
    if (i === 0) p.setAttribute('aria-expanded', 'true');
    p.addEventListener('click', () => p.setAttribute('aria-expanded', String(p.getAttribute('aria-expanded') !== 'true')));
  });

  /* ---------- product: hotspots, weight counter, loupe ---------- */
  const tip = $('#hsTip');
  $$('.hs').forEach(h => h.addEventListener('click', () => {
    const on = !h.classList.contains('is-on');
    $$('.hs').forEach(x => x.classList.remove('is-on'));
    h.classList.toggle('is-on', on);
    tip.textContent = on ? h.dataset.tip : '';
    tip.classList.toggle('is-on', on);
  }));
  const gsm = $('#gsm');
  new IntersectionObserver((en, obs) => {
    if (!en[0].isIntersecting) return;
    obs.disconnect();
    if (reduce) return;
    const to = +gsm.dataset.to, t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 1400); gsm.textContent = Math.round(to * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, { threshold: .5 }).observe(gsm);
  const loupe = $('#loupe');
  loupe.addEventListener('pointermove', e => {
    const r = loupe.getBoundingClientRect();
    loupe.style.setProperty('--ox', `${((e.clientX - r.left) / r.width) * 100}%`);
    loupe.style.setProperty('--oy', `${((e.clientY - r.top) / r.height) * 100}%`);
  });
  $$('.vcard__screen img').forEach(img => { img.style.transformOrigin = 'var(--ox, 50%) var(--oy, 50%)'; });

  /* ---------- wordmark: size slider with min-size flag, guides toggle ---------- */
  const wmBox = $('#wmBox'), wmSize = $('#wmSize'), wmOut = $('#wmSizeOut'), wmFlag = $('#wmFlag'), wmGuides = $('#wmGuides');
  function fitWm() {
    const v = +wmSize.value;
    const maxFit = Math.floor((wmBox.parentElement.clientWidth - 4) / (6.9 + 1.46)); // ~6.9em wide + clear space both sides
    const s = Math.min(v, maxFit);
    wmBox.style.setProperty('--s', `${s}px`);
    wmOut.textContent = `${v} px`;
    const bad = v < 18;
    wmFlag.textContent = bad ? 'Too small' : v < 24 ? 'Mobile only' : 'OK';
    wmFlag.classList.toggle('is-bad', bad);
  }
  wmSize.addEventListener('input', fitWm);
  addEventListener('resize', fitWm);
  fitWm();
  wmGuides.addEventListener('click', () => {
    const on = wmGuides.getAttribute('aria-pressed') !== 'true';
    wmGuides.setAttribute('aria-pressed', String(on));
    wmBox.classList.toggle('no-guides', !on);
  });

  /* ---------- colour: click to copy ---------- */
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const v = b.dataset.copy;
    try { await navigator.clipboard.writeText(v); } catch (e) {
      const t = document.createElement('textarea'); t.value = v; document.body.append(t); t.select();
      try { document.execCommand('copy'); } catch (_) {} t.remove();
    }
    $$('[data-copy]').forEach(x => x.classList.remove('copied'));
    b.classList.add('copied');
    say(`Copied ${v}`);
  }));

  /* ---------- type: weight switch and live tester ---------- */
  const aa = $('#aa');
  const scale = $('.scale'), typeSec = $('#type');
  $$('.weights button').forEach(b => b.addEventListener('click', () => {
    $$('.weights button').forEach(x => x.classList.toggle('is-on', x === b));
    typeSec.style.setProperty('--tw', b.dataset.w);   // Aa and every specimen in the scale switch at once
    scale.classList.add('has-w');
  }));
  const tester = $('#tester'), samples = $$('.scale [data-def]');
  const paintSamples = () => {
    const v = tester.value.trim();
    samples.forEach(p => { p.textContent = v || (isWhite() && p.dataset.defWhite) || p.dataset.def; });
  };
  tester.addEventListener('input', paintSamples);
  document.addEventListener('themechange', paintSamples);
  paintSamples();

  /* ---------- interface: segmented control and swatches drive "Your look" ---------- */
  const seg = $('#fitSeg'), lookV = $('#lookV');
  const look = { color: 'Black', fit: 'Oversized' };
  const paintLook = () => { lookV.textContent = `${look.color} · ${look.fit}`; };
  $$('button', seg).forEach((b, i) => b.addEventListener('click', () => {
    $$('button', seg).forEach(x => x.classList.toggle('is-on', x === b));
    seg.dataset.i = i; look.fit = b.dataset.v; paintLook();
  }));
  seg.dataset.i = 1;
  const pickColor = v => { $$('.sw').forEach(x => x.classList.toggle('is-on', x.dataset.v === v)); look.color = v; paintLook(); };
  $$('.sw').forEach(b => b.addEventListener('click', () => pickColor(b.dataset.v)));
  // the demo starts on the mode on screen: black in Black, white in White
  pickColor(isWhite() ? 'White' : 'Black');
  document.addEventListener('themechange', () => pickColor(isWhite() ? 'White' : 'Black'));

  /* ---------- 360° turntables: the landing's turn sequence, same angle map, drag, inertia and ‹ › steps ---------- */
  // loop clips cover unequal angles: F→S 90°, S→Q 45°, Q→B 45°, B→Q 45°, Q→S 45°, S→F 90° (main.js)
  const TURN_ANGLES = [0, 0.25, 0.375, 0.5, 0.625, 0.75, 1];
  const TURN_N = 240;
  function angleToFrame(a) {
    const per = TURN_N / 6;
    a = ((a % 1) + 1) % 1;
    let k = 0;
    while (k < 5 && a >= TURN_ANGLES[k + 1]) k++;
    const t = (a - TURN_ANGLES[k]) / (TURN_ANGLES[k + 1] - TURN_ANGLES[k]);
    return Math.min(TURN_N - 1, Math.round((k + t) * per));
  }
  const frameUrl = (i, white) => `/assets/seq/${white ? 'white' : 'black'}/turn/${String(i).padStart(4, '0')}.webp`;
  const frames = { b: null, w: null };            // shared cache, loaded once per theme
  function loadFrames() {
    const key = isWhite() ? 'w' : 'b';
    if (frames[key]) return;
    const list = frames[key] = new Array(TURN_N);
    // coarse pass first (every 8th frame) so dragging works at once, then fill the gaps
    const order = [];
    for (let step of [8, 4, 2, 1]) for (let i = 0; i < TURN_N; i += step) if (!order.includes(i)) order.push(i);
    order.forEach(i => { const im = new Image(); im.decoding = 'async'; im.onload = () => { list[i] = im.src; }; im.src = frameUrl(i, key === 'w'); });
  }
  function nearestLoaded(f) {
    const list = frames[isWhite() ? 'w' : 'b'];
    if (!list) return null;
    for (let d = 0; d < TURN_N / 2; d++) {
      if (list[(f + d) % TURN_N]) return list[(f + d) % TURN_N];
      if (list[(f - d + TURN_N) % TURN_N]) return list[(f - d + TURN_N) % TURN_N];
    }
    return null;
  }
  const turnables = $$('.turnable').map(box => {
    const img = $('.turnable__img', box), range = $('.turnable__range', box);
    const st = { angle: +box.dataset.start || 0, target: +box.dataset.start || 0, vel: 0, drag: false, lastX: 0, seen: false, touched: false, shown: '' };
    const w = () => box.clientWidth || innerWidth;
    box.addEventListener('pointerdown', e => {
      if (e.target.closest('button, input')) return;
      st.drag = true; st.touched = true; st.lastX = e.clientX; st.vel = 0;
      box.classList.add('is-drag'); box.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', e => {
      if (!st.drag) return;
      const dx = e.clientX - st.lastX; st.lastX = e.clientX;
      st.target -= dx / (w() * 0.9); st.vel = -dx / (w() * 0.9);
    });
    const end = () => { st.drag = false; box.classList.remove('is-drag'); };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
    $$('[data-spin]', box).forEach(b => b.addEventListener('click', () => { st.touched = true; st.target += 0.125 * +b.dataset.spin; st.vel = 0; }));
    if (range) range.addEventListener('input', () => { st.touched = true; st.target = st.angle = range.value / 1000; st.vel = 0; });
    new IntersectionObserver(en => { st.seen = en[0].isIntersecting; if (st.seen) loadFrames(); }, { rootMargin: '300px' }).observe(box);
    function paint() {
      const src = nearestLoaded(angleToFrame(st.angle));
      if (src && src !== st.shown) { img.src = src; st.shown = src; }
      if (range && !st.drag && document.activeElement !== range) range.value = Math.round((((st.angle % 1) + 1) % 1) * 1000);
    }
    return { st, paint, reset() { img.src = frameUrl(angleToFrame(st.angle), isWhite()); st.shown = img.src; } };
  });
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  let tLast = 0;
  function tick(t) {
    const dt = tLast ? Math.min(.05, (t - tLast) / 1000) : 0; tLast = t;
    turnables.forEach(({ st, paint }) => {
      if (!st.seen) return;
      if (!st.drag) {
        st.target += st.vel; st.vel *= 0.92;
        // untouched: a slow idle spin, like the landing's buy view
        if (!st.touched && !reduce && Math.abs(st.vel) < 0.0005) st.target += dt * 0.03;
      }
      st.angle = damp(st.angle, st.target, 7, dt);
      paint();
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const turn = { reload() { loadFrames(); turnables.forEach(t => t.reset()); } };

  /* ---------- voice: flip say / not ---------- */
  $$('.sayno').forEach(b => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));

  /* ---------- 404 washer: the 404 page's drum (pages.js). A tap kicks it ~2.5 turns, taps add up,
     friction stops it. Water sloshes on a damped spring, foam is flung to the wall, fast spins blur and shake. ---------- */
  (() => {
    const door = $('#door'); if (!door) return;
    const spin = $('.washer__spin', door), lost = door.closest('.lost'), glass = $('.washer__glass', door);
    const pools = $$('.washer__pool', door), ring = $('.washer__ring', door);
    const foamLayer = document.createElement('div'); foamLayer.className = 'washer__foam'; glass.appendChild(foamLayer);
    const bubbles = []; let spawnDebt = 0;
    const KICK = 1080, MAX = 4200, DRAG = 1.2;
    let angle = 0, vel = 0, last = 0, running = false, tilt = 0, tiltV = 0, ringAngle = 0;
    function foam(dt, speed) {
      spawnDebt += speed * 70 * dt;
      while (spawnDebt >= 1 && bubbles.length < 50) {
        spawnDebt -= 1;
        const el = document.createElement('i');
        const size = 2 + Math.random() * Math.random() * 9;
        el.style.width = el.style.height = size + 'px';
        el.style.transform = 'translate(-50%, -50%)';
        foamLayer.appendChild(el);
        bubbles.push({ el, a: Math.random() * 360, r: 0.12 + Math.random() * 0.3, life: 0, max: 0.6 + Math.random() * 1.1, spin: 0.55 + Math.random() * 0.4 });
      }
      if (spawnDebt > 1) spawnDebt = 1;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const bb = bubbles[i];
        bb.life += dt;
        bb.a += vel * bb.spin * dt;
        bb.r = Math.min(0.46, bb.r + dt * (0.08 + speed * 0.35));
        const k = bb.life / bb.max, rad = bb.a * Math.PI / 180;
        bb.el.style.left = (50 + Math.cos(rad) * bb.r * 100) + '%';
        bb.el.style.top = (50 + Math.sin(rad) * bb.r * 100) + '%';
        bb.el.style.opacity = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85).toFixed(2);
        if (k >= 1) { bb.el.remove(); bubbles.splice(i, 1); }
      }
    }
    // idle wash programme: ease up, roll ~3/4 turn, pause, roll back
    const STEPS = [[+270, 2.2], [0, 0.8], [-270, 2.2], [0, 0.6]];
    const PROG_LEN = STEPS.reduce((acc, x) => acc + x[1], 0);
    let progT = -1, progBase = 0;
    const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
    function progOffset(t) { let off = 0; for (const [deg, dur] of STEPS) { if (t <= dur) return off + deg * ease(t / dur); off += deg; t -= dur; } return off; }
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (progT >= 0) {
        const prev = progOffset(progT); progT += dt;
        const cur = progOffset(Math.min(progT, PROG_LEN));
        vel = (cur - prev) / Math.max(dt, 1e-3); angle = progBase + cur;
        if (progT >= PROG_LEN) { progT = -1; vel = 0; }
      } else {
        vel *= Math.exp(-DRAG * dt);
        if (Math.abs(vel) < 25) vel *= 0.85;
        angle = (angle + vel * dt) % 360;
      }
      const speed = Math.abs(vel) / MAX;
      spin.style.transform = `rotate(${angle}deg)`;
      spin.style.filter = speed > 0.25 ? `blur(${((speed - 0.25) * 2).toFixed(2)}px)` : '';
      const shake = speed > 0.45 ? (speed - 0.45) * 3.2 : 0;
      door.style.translate = shake ? `${(Math.random() - .5) * shake}px ${(Math.random() - .5) * shake}px` : '';
      lost.classList.toggle('is-spinning', Math.abs(vel) > 40);
      const target = Math.max(-38, Math.min(38, vel * 0.014 + vel * 0.05 * Math.exp(-Math.abs(vel) / 400)));
      tiltV += ((target - tilt) * 26 - tiltV * 3.2) * dt; tilt += tiltV * dt;
      const fling = Math.max(0, Math.min(1, (speed - 0.3) / 0.45));
      const t = now / 1000, churn = Math.min(1, speed * 1.6);
      pools.forEach((el, i) => {
        const ph = i * 2.1;
        const wob = churn * (9 * Math.sin(t * 6.3 + ph) + 5 * Math.sin(t * 10.7 + ph * 1.7) + 3 * Math.sin(t * 17.9 + ph * 0.6));
        const bob = churn * (4 * Math.sin(t * 8.1 + ph * 1.3) + 2 * Math.sin(t * 14.2 + ph));
        el.style.transform = `rotate(${(tilt + wob).toFixed(2)}deg) translateY(${(fling * 16 + bob).toFixed(1)}%)`;
      });
      foam(dt, speed);
      ringAngle = (ringAngle + vel * 0.9 * dt) % 360;
      ring.style.opacity = fling.toFixed(2);
      ring.style.transform = `rotate(${ringAngle}deg)`;
      const calm = Math.abs(vel) <= 1 && Math.abs(tilt) < 0.2 && Math.abs(tiltV) < 0.5 && !bubbles.length && progT < 0;
      if (!calm) requestAnimationFrame(frame);
      else { running = false; vel = 0; tilt = 0; tiltV = 0; spin.style.filter = ''; door.style.translate = ''; lost.classList.remove('is-spinning'); pools.forEach(el => { el.style.transform = ''; }); ring.style.opacity = 0; }
    }
    const run = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
    let lastTouch = performance.now();
    const kick = () => { if (reduce) return; lastTouch = performance.now(); progT = -1; vel = Math.min(MAX, vel + KICK); run(); };
    let visible = false;
    new IntersectionObserver(en => { visible = en[0].isIntersecting; }).observe(door);
    setInterval(() => {
      if (reduce || document.hidden || !visible || Math.abs(vel) > 1 || progT >= 0) return;
      if (performance.now() - lastTouch < 4000) return;
      progBase = angle; progT = 0; run();
    }, 3000);
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const cur = document.createElement('div');
      cur.className = 'spin-cursor'; cur.setAttribute('aria-hidden', 'true');
      cur.innerHTML = '<div class="spin-cursor__in"><svg viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 2.5v3h-3"/></svg><span>Spin</span></div>';
      document.body.appendChild(cur);
      let cx = 0, cy = 0, tx = 0, ty = 0, on = false, raf = 0;
      const follow = () => {
        cx += (tx - cx) * 0.25; cy += (ty - cy) * 0.25;
        cur.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
        raf = (on || Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5) ? requestAnimationFrame(follow) : 0;
      };
      door.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; tx = cx = e.clientX; ty = cy = e.clientY; on = true; cur.classList.add('is-on'); if (!raf) raf = requestAnimationFrame(follow); });
      door.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; });
      door.addEventListener('pointerleave', () => { on = false; cur.classList.remove('is-on', 'is-down'); });
      door.addEventListener('pointerdown', () => cur.classList.add('is-down'));
      addEventListener('pointerup', () => cur.classList.remove('is-down'));
    }
    door.addEventListener('click', kick);
    door.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kick(); } });
  })();

  syncTheme();
})();
