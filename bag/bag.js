// Shared bag: a header button and a side sheet on every page (landing, /buy, 404, legal).
// Items live in localStorage['ws-bag'] as [{ color, fit, size, qty }], so the bag follows the visitor
// across pages and tabs. /buy adds to it through window.WSBag; every other page only shows it.
(() => {
  // Where "Checkout" goes once payments are connected (Shopify / Stripe Payment Link, etc.).
  // {items} is filled in as color-fit-size-qty, comma separated (black-over-M-1,white-over-M-1).
  // Empty = checkout not connected yet: the bag says so.
  const CHECKOUT_URL = '';
  const PRICE = 75;
  const KEY = 'ws-bag';

  const FIT = { reg: 'Regular', over: 'Oversized' };
  const SIZES = ['S', 'M', 'L', 'XL'];
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const money = n => `$${n}`;
  const valid = it => it && ['black', 'white'].includes(it.color) && FIT[it.fit] && SIZES.includes(it.size) && it.qty >= 1 && it.qty <= 9;
  const sameItem = (a, b) => a.color === b.color && a.fit === b.fit && a.size === b.size;
  const shirtImg = color => `/assets/brand/shirt_front_${color === 'white' ? 'w' : 'b'}.webp`;
  const onBuyPage = /^\/buy(\/|\/index\.html)?$/.test(location.pathname);
  const TEE = '<svg viewBox="0 0 120 110" aria-hidden="true"><path d="M44 6Q60 17 76 6L97 13L118 35L103 51L92 43V106H28V43L17 51L2 35L23 13Z"/></svg>';

  const read = () => { try { return (JSON.parse(localStorage.getItem(KEY)) || []).filter(valid); } catch (e) { return []; } };
  let bag = read();
  let lastAdded = null;
  let fresh = null, freshT;   // the item just added: it drops onto the rail
  let shownCount = null;      // to bump the badge when the count goes up
  // a hanger, drawn: hook, shoulders, bar (the empty bag and every item hang on one)
  const HANGER = '<svg class="wsb__hanger" viewBox="0 0 64 36" aria-hidden="true"><path d="M32 13V9.6c0-2.4 4.4-3 4.4-5.9a4.4 4.4 0 0 0-8.6-1.3"/><path d="M32 13 4.2 30.6c-1.8 1.1-1 2.9.9 2.9h53.8c1.9 0 2.7-1.8.9-2.9z"/></svg>';

  /* ---------- markup: header button + sheet ---------- */
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'circle lg wsb-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/></svg><i hidden>0</i>';
  const right = document.querySelector('.header .header__right');
  if (right) {
    // before the menu / back button, so the landing's mobile rule that hides the first circle (EN) still hides EN
    const anchor = right.querySelector('#menuBtn') || right.lastElementChild;
    right.insertBefore(btn, anchor);
  }

  const sheet = document.createElement('div');
  sheet.className = 'wsb';
  sheet.setAttribute('aria-hidden', 'true');
  sheet.setAttribute('data-lenis-prevent', '');   // the landing scrolls with Lenis: keep wheel and touch inside the sheet
  sheet.innerHTML = `
    <div class="wsb__scrim" data-close></div>
    <div class="wsb__panel" role="dialog" aria-modal="true" aria-labelledby="wsbTitle">
      <button type="button" class="wsb__x" data-close aria-label="Close">×</button>
      <p class="wsb__k">Your bag</p>
      <h2 class="wsb__h" id="wsbTitle">Packed and ready to go</h2>
      <div class="wsb__rail" aria-hidden="true"><i class="wsb__bar"></i><div class="wsb__hooks"></div></div>
      <ul class="wsb__list"></ul>
      <div class="wsb__up" hidden>
        <span class="wsb__dot"></span>
        <div><b class="wsb__upName">Add White too</b><span class="wsb__upOpts">Same fit and size</span></div>
        <button type="button" class="wsb__upAdd">+ $75</button>
      </div>
      <p class="wsb__total"><span>Total</span><b class="wsb__sum">$0</b></p>
      <p class="wsb__ship">Ships within 2 business days · free exchanges for 30 days</p>
      <a class="wsb__go" href="#"><span>Checkout · <span class="wsb__goSum">$0</span></span><span class="wsb__bead">${TEE}</span></a>
      <a class="wsb__go wsb__shop" href="/buy"><span>Shop the tee</span><span class="wsb__bead">${TEE}</span></a>
      <button type="button" class="wsb__more" data-close>Keep shopping</button>
      <p class="wsb__note" hidden>Checkout opens soon. Your bag is saved on this device.</p>
    </div>`;
  document.body.appendChild(sheet);
  const $ = s => sheet.querySelector(s);
  const hooks = $('.wsb__hooks');
  const list = $('.wsb__list'), up = $('.wsb__up'), go = $('.wsb__go:not(.wsb__shop)'), shop = $('.wsb__shop'), note = $('.wsb__note');

  // a toast of its own unless the page already has one (/buy does)
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('p');
    toast.className = 'wsb-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  let toastT;
  const say = msg => { toast.textContent = msg; toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 1800); };

  /* ---------- render ---------- */
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(bag)); } catch (e) {}
    render();
    dispatchEvent(new CustomEvent('ws-bag', { detail: { items: bag.slice() } }));
  }
  function render() {
    const total = bag.reduce((n, x) => n + x.qty * PRICE, 0), count = bag.reduce((n, x) => n + x.qty, 0);
    list.innerHTML = bag.map((x, i) => `
      <li class="wsb__item">
        <img src="${shirtImg(x.color)}" alt="">
        <div class="wsb__txt"><b>Wattashirt ${cap(x.color)}</b><span>${FIT[x.fit]} · Size ${x.size}</span>
          <span class="wsb__qty"><button type="button" data-i="${i}" data-d="-1" aria-label="One less">−</button><output>${x.qty}</output><button type="button" data-i="${i}" data-d="1" aria-label="One more">+</button></span></div>
        <div class="wsb__end"><b>${money(x.qty * PRICE)}</b><button type="button" class="wsb__rm" data-rm="${i}">Remove</button></div>
      </li>`).join('');
    // the rail: every line of the bag hangs there; an empty bag is one empty hanger, swinging
    hooks.innerHTML = bag.length
      ? bag.map((x, i) => `<figure class="wsb__hang${fresh && sameItem(x, fresh) ? ' is-new' : ''}" style="--i:${i}">${HANGER}<img src="${shirtImg(x.color)}" alt="">${x.qty > 1 ? `<b>×${x.qty}</b>` : ''}</figure>`).join('')
      : `<figure class="wsb__hang is-empty">${HANGER}</figure><p class="wsb__railNote">Nothing on the hanger yet.</p>`;
    $('.wsb__sum').textContent = money(total);
    $('.wsb__goSum').textContent = money(total);
    // empty bag: no total or checkout, one way to the product instead
    sheet.classList.toggle('is-empty', !bag.length);
    $('.wsb__h').textContent = bag.length ? 'Packed and ready to go' : 'Nothing in here yet';
    go.hidden = !bag.length;
    shop.hidden = !!bag.length;
    if (onBuyPage) shop.setAttribute('data-close', ''); // already on /buy: just close
    const badge = btn.querySelector('i');
    badge.hidden = !count; badge.textContent = count;
    if (shownCount !== null && count > shownCount) { btn.classList.remove('is-bump'); void btn.offsetWidth; btn.classList.add('is-bump'); }
    shownCount = count;
    btn.setAttribute('aria-label', count ? `Open bag, ${count} item${count === 1 ? '' : 's'}` : 'Open bag');
    // upsell: the other colour, same fit and size, if it isn't in the bag yet
    const ref = lastAdded || bag[bag.length - 1];
    const other = ref && { color: ref.color === 'black' ? 'white' : 'black', fit: ref.fit, size: ref.size };
    const show = other && !bag.some(x => x.color === other.color);
    up.hidden = !show;
    if (show) {
      Object.assign(up.dataset, other);
      $('.wsb__upName').textContent = `Add ${cap(other.color)} too`;
      $('.wsb__upOpts').textContent = `${FIT[other.fit]} · Size ${other.size}. One for each mode.`;
      $('.wsb__dot').style.background = other.color === 'white' ? '#f4f4f4' : '#000';
      $('.wsb__upAdd').textContent = `+ ${money(PRICE)}`;
    }
  }

  function add(item) {
    item = { color: item.color, fit: item.fit, size: item.size, qty: item.qty || 1 };
    if (!valid(item)) return false;
    const hit = bag.find(x => sameItem(x, item));
    if (hit) hit.qty = Math.min(9, hit.qty + item.qty); else bag.push(item);
    lastAdded = item;
    fresh = item; clearTimeout(freshT); freshT = setTimeout(() => { fresh = null; }, 1500);
    save();
    return true;
  }

  list.addEventListener('click', e => {
    const q = e.target.closest('[data-d]'), rm = e.target.closest('[data-rm]');
    if (q) { const it = bag[+q.dataset.i]; it.qty = Math.max(0, Math.min(9, it.qty + +q.dataset.d)); if (!it.qty) bag.splice(+q.dataset.i, 1); save(); }
    if (rm) { bag.splice(+rm.dataset.rm, 1); save(); }
  });
  $('.wsb__upAdd').addEventListener('click', () => {
    const item = { color: up.dataset.color, fit: up.dataset.fit, size: up.dataset.size, qty: 1 };
    if (add(item)) say(`${cap(item.color)} added`);
  });

  /* ---------- open / close ---------- */
  // the page under the sheet must not scroll (the landing would scrub its story behind it)
  const html = document.documentElement;
  function lock(on) {
    if (on) {
      const sb = innerWidth - html.clientWidth;
      html.style.setProperty('--wsb-sb', sb + 'px');
      html.classList.add('wsb-lock');
    } else html.classList.remove('wsb-lock');
  }
  let lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    note.hidden = true;
    render();
    lock(true);
    sheet.classList.add('is-open'); sheet.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    setTimeout(() => (bag.length ? go : shop).focus(), 300);
  }
  function close() {
    if (!sheet.classList.contains('is-open')) return;
    sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden', 'true');
    lock(false);
    btn.setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  btn.addEventListener('click', open);
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) { if (e.target.closest('.wsb__shop') && onBuyPage) e.preventDefault(); close(); } });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  /* ---------- checkout ---------- */
  if (!CHECKOUT_URL) { go.removeAttribute('href'); go.setAttribute('role', 'button'); go.tabIndex = 0; }
  go.addEventListener('click', e => {
    if (!bag.length) { e.preventDefault(); close(); return; }
    if (!CHECKOUT_URL) { e.preventDefault(); note.hidden = false; return; }
    go.href = CHECKOUT_URL.replace('{items}', encodeURIComponent(bag.map(x => `${x.color}-${x.fit}-${x.size}-${x.qty}`).join(',')));
  });
  go.addEventListener('keydown', e => { if (e.key === 'Enter' && !CHECKOUT_URL) go.click(); });

  // another tab changed the bag
  addEventListener('storage', e => { if (e.key === KEY) { bag = read(); render(); } });

  render();
  window.WSBag = { add, open, close, items: () => bag.slice(), say };
})();
