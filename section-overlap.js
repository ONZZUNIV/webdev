// スクロール演出はCSSで行う。JavaScriptは画面幅に応じたABOUTの高さだけを渡す。
(() => {
  const boundary = document.querySelector('.about-activity-boundary');
  const about = boundary?.querySelector('.about');
  if (!boundary || !about || typeof window.matchMedia !== 'function') return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => {
    if (motion.matches) {
      boundary.removeAttribute('data-overlap-ready');
      boundary.style.removeProperty('--about-block-size');
      return;
    }
    const height = about.getBoundingClientRect().height;
    if (!height) return;
    const value = height + 'px';
    if (boundary.style.getPropertyValue('--about-block-size') !== value) {
      boundary.style.setProperty('--about-block-size', value);
    }
    boundary.dataset.overlapReady = '';
  };

  try {
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(about);
    else window.addEventListener('resize', update, { passive: true });
    motion.addEventListener?.('change', update);
    document.fonts?.ready.then(update);
    update();
  } catch {
    boundary.removeAttribute('data-overlap-ready');
  }
})();
