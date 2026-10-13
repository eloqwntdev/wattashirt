// Secondary pages: the table of contents lights up the section being read.
// (The theme class is set inline in <head>, before paint, from the landing's saved choice.)
const toc = document.querySelector('.toc');
if (toc && 'IntersectionObserver' in window) {
  const links = new Map([...toc.querySelectorAll('a')].map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove('is-on'));
      const a = links.get(e.target.id);
      if (a) a.classList.add('is-on');
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  links.forEach((a, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

// theme switch: same pill as the landing; the choice is shared with it through localStorage
const tt = document.getElementById('themeToggle');
function syncTheme() {
  const white = document.documentElement.classList.contains('is-white');
  tt.setAttribute('aria-pressed', String(white));
  tt.querySelector('span').textContent = white ? 'I Wanna Black' : 'I Wanna White';
  const buy = document.getElementById('menuBuy');
  if (buy) buy.textContent = white ? 'Get White' : 'Get Black';
}
if (tt) {
  syncTheme();
  tt.addEventListener('click', () => {
    const white = !document.documentElement.classList.contains('is-white');
    document.documentElement.classList.toggle('is-white', white);
    try { localStorage.setItem('ws-theme', white ? 'white' : 'black'); } catch (e) {}
    syncTheme();
  });
}

// menu: the landing's full-screen menu; its links go to the sections of the landing
const menuBtn = document.getElementById('menuBtn'), menu = document.getElementById('menu');
function setMenu(open) {
  menu.classList.toggle('is-open', open);
  menu.setAttribute('aria-hidden', String(!open));
  menuBtn.classList.toggle('is-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
if (menuBtn && menu) {
  menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
}

// 404 drum: a tap gives the drum a kick (about two and a half turns); taps add up, so tapping
// fast winds it up, then friction brings it to a stop. Fast spins blur and shake the machine.
const door = document.querySelector('.washer__door');
if (door) {
  const spin = door.querySelector('.washer__spin'), washer = door.closest('.washer');
  const pools = [...door.querySelectorAll('.washer__pool')], ring = door.querySelector('.washer__ring');
  // foam: bubbles born at speed, carried round by the drum, pushed out toward the wall, then gone
  const glass = door.querySelector('.washer__glass');
  const foamLayer = document.createElement('div');
  foamLayer.className = 'washer__foam';
  glass.appendChild(foamLayer);
  const bubbles = [];
  let spawnDebt = 0;
  function foam(dt, speed) {
    spawnDebt += speed * 90 * dt;                       // up to ~90 bubbles a second at full speed
    while (spawnDebt >= 1 && bubbles.length < 70) {
      spawnDebt -= 1;
      const el = document.createElement('i');
      const size = 3 + Math.random() * Math.random() * 14;
      el.style.width = el.style.height = size + 'px';
      el.style.transform = 'translate(-50%, -50%)';
      foamLayer.appendChild(el);
      bubbles.push({ el, a: Math.random() * 360, r: 0.12 + Math.random() * 0.3, life: 0, max: 0.6 + Math.random() * 1.1, size, spin: 0.55 + Math.random() * 0.4 });
    }
    if (spawnDebt > 1) spawnDebt = 1;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.life += dt;
      b.a += vel * b.spin * dt;                          // swirl with the drum, a little slower than it
      b.r = Math.min(0.46, b.r + dt * (0.08 + speed * 0.35)); // flung outward
      const k = b.life / b.max;
      const rad = b.a * Math.PI / 180;
      b.el.style.left = (50 + Math.cos(rad) * b.r * 100) + '%';
      b.el.style.top = (50 + Math.sin(rad) * b.r * 100) + '%';
      b.el.style.opacity = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85).toFixed(2);
      if (k >= 1) { b.el.remove(); bubbles.splice(i, 1); }
    }
  }
  // water: a damped spring on the surface tilt (it sloshes toward the spin, overshoots, settles)
  let tilt = 0, tiltV = 0, ringAngle = 0;
  const KICK = 1080, MAX = 4200, DRAG = 1.2;   // deg/s per tap, top speed, friction (1/s): one tap ≈ KICK/DRAG = 900deg
  let angle = 0, vel = 0, last = 0, running = false;
  // idle wash programme, like a real tumble cycle: ease up, roll ~3/4 turn, ease down, pause,
  // then the same the other way. progT = seconds into the programme, -1 = off
  const STEPS = [[+270, 2.2], [0, 0.8], [-270, 2.2], [0, 0.6]];    // [degrees, seconds]
  const PROG_LEN = STEPS.reduce((s, x) => s + x[1], 0);
  let progT = -1, progBase = 0;
  const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);            // sine in-out: no jerk at either end
  function progOffset(t) {                                         // drum angle (deg) at programme time t
    let off = 0;
    for (const [deg, dur] of STEPS) {
      if (t <= dur) return off + deg * ease(t / dur);
      off += deg; t -= dur;
    }
    return off;
  }
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (progT >= 0) {                            // programme drives the drum; vel is its speed
      const prev = progOffset(progT);
      progT += dt;
      const cur = progOffset(Math.min(progT, PROG_LEN));
      vel = (cur - prev) / Math.max(dt, 1e-3);
      angle = progBase + cur;
      if (progT >= PROG_LEN) { progT = -1; vel = 0; }
    } else {
      vel *= Math.exp(-DRAG * dt);
      if (Math.abs(vel) < 25) vel *= 0.85;      // settle softly instead of crawling forever
      angle = (angle + vel * dt) % 360;
    }
    const speed = Math.abs(vel) / MAX;
    spin.style.transform = `rotate(${angle}deg)`;
    spin.style.filter = speed > 0.25 ? `blur(${((speed - 0.25) * 2.4).toFixed(2)}px)` : '';
    const shake = speed > 0.45 ? (speed - 0.45) * 3.2 : 0;  // px
    door.style.translate = shake ? `${(Math.random() - .5) * shake}px ${(Math.random() - .5) * shake}px` : '';
    washer.classList.toggle('is-spinning', Math.abs(vel) > 40);
    // the surface leans in the turning direction, more with speed; the level drops as water climbs the wall
    const target = Math.max(-38, Math.min(38, vel * 0.014 + vel * 0.05 * Math.exp(-Math.abs(vel) / 400)));
    tiltV += ((target - tilt) * 26 - tiltV * 3.2) * dt;
    tilt += tiltV * dt;
    const fling = Math.max(0, Math.min(1, (speed - 0.3) / 0.45));
    // churn: each layer gets its own irregular wobble (sum of unrelated sines), so the surface breaks up
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
    else { running = false; vel = 0; tilt = 0; tiltV = 0; spin.style.filter = ''; door.style.translate = ''; washer.classList.remove('is-spinning'); pools.forEach(el => { el.style.transform = ''; }); ring.style.opacity = 0; }
  };
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
  let lastTouch = performance.now();
  const kick = () => {
    if (reduce()) return;
    lastTouch = performance.now();
    progT = -1;                                   // a tap takes over from the programme
    vel = Math.min(MAX, vel + KICK);
    run();
  };
  // idle hint: when nobody has touched it for a while, the drum gives a little jolt, like a
  // machine starting its programme; it says "this moves" without any words
  setInterval(() => {
    if (reduce() || document.hidden || Math.abs(vel) > 1 || progT >= 0) return;
    if (performance.now() - lastTouch < 4000) return;
    progBase = angle; progT = 0;
    run();
  }, 3000);

  // desktop: the pointer over the door becomes a glass "Spin" disc, like the "Drag" disc on the reviews
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const cur = document.createElement('div');
    cur.className = 'spin-cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<div class="spin-cursor__in"><svg viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 2.5v3h-3"/></svg><span>Spin</span></div>';
    document.body.appendChild(cur);
    let cx = 0, cy = 0, tx = 0, ty = 0, on = false, raf = 0;
    const follow = () => {
      cx += (tx - cx) * 0.25; cy += (ty - cy) * 0.25;
      cur.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      raf = (on || Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5) ? requestAnimationFrame(follow) : 0;
    };
    door.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      tx = cx = e.clientX; ty = cy = e.clientY; on = true;
      cur.classList.add('is-on');
      if (!raf) raf = requestAnimationFrame(follow);
    });
    door.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; });
    door.addEventListener('pointerleave', () => { on = false; cur.classList.remove('is-on', 'is-down'); });
    door.addEventListener('pointerdown', () => cur.classList.add('is-down'));
    addEventListener('pointerup', () => cur.classList.remove('is-down'));
  }
  door.addEventListener('click', kick);
  door.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kick(); } });
}
