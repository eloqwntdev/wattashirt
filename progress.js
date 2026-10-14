// Reading progress: a 2 px line along the top edge, the brand guide's, on every page (the guide has its own).
(() => {
  const bar = document.createElement('div');
  bar.className = 'ws-progress';
  bar.setAttribute('aria-hidden', 'true');
  Object.assign(bar.style, { position: 'fixed', left: '0', right: '0', top: '0', height: '2px', zIndex: '60', pointerEvents: 'none' });
  const line = document.createElement('i');
  Object.assign(line.style, { display: 'block', height: '100%', background: 'var(--fg, #fff)', transformOrigin: '0 50%', transform: 'scaleX(0)' });
  bar.appendChild(line);
  document.body.appendChild(bar);
  let raf = 0;
  const paint = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    line.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0})`;
  };
  const ask = () => { if (!raf) raf = requestAnimationFrame(paint); };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask);
  paint();
})();
