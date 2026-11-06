// 詳細ページ専用。初回の表示だけを補い、スクロール位置は変更しない。
(() => {
  const elements = [...document.querySelectorAll('[data-detail-reveal]')];
  if (!elements.length || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let observer;
  const pending = new Set(elements);
  function show(element) {
    element.dataset.detailState = 'visible';
    pending.delete(element);
    observer?.unobserve(element);
  }
  function checkPassed() {
    for (const element of pending) {
      // 高速スクロールや途中表示でも、通過済みの内容を隠したままにしない。
      if (element.getBoundingClientRect().bottom <= 0) {
        element.removeAttribute('data-detail-state');
        pending.delete(element);
        observer?.unobserve(element);
      }
    }
  }
  try {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) show(entry.target); });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0 });
    elements.forEach(element => { element.dataset.detailState = 'pending'; observer.observe(element); });
    window.addEventListener('scroll', checkPassed, { passive: true });
    window.addEventListener('pageshow', checkPassed);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener('change', event => {
      if (event.matches) {
        elements.forEach(element => element.removeAttribute('data-detail-state'));
        pending.clear(); observer.disconnect();
      }
    });
    checkPassed();
  } catch {
    elements.forEach(element => element.removeAttribute('data-detail-state'));
    observer?.disconnect();
  }
})();
