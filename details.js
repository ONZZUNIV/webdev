// 詳細ページ専用。初回の表示だけを補い、スクロール位置は変更しない。
(() => {
  const elements = [...document.querySelectorAll('[data-detail-reveal]')];
  if (!elements.length || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let observer;
  const pending = new Set(elements);
  const covers = new Map();

  function clearCover(heading) {
    const lines = covers.get(heading);
    if (!lines) return;
    lines.forEach(line => line.remove());
    covers.delete(heading);
  }

  function coverHeading(heading) {
    if (!heading.matches('.detail-section-heading h2, .detail-activity-name h2')) return;
    if (document.fonts?.status === 'loading') return;
    // 折り返し後の文字の範囲を測り、行ごとに帯を重ねる。
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const rows = [];
    for (let node; (node = walker.nextNode());) {
      const color = getComputedStyle(node.parentElement).color;
      let offset = 0;
      for (const character of node.textContent) {
        range.setStart(node, offset);
        offset += character.length;
        range.setEnd(node, offset);
        if (!character.trim()) continue;
        const box = range.getBoundingClientRect();
        if (!box.width || !box.height) continue;
        const row = rows.find(row => Math.abs(row.top - box.top) < 1);
        if (row) {
          row.left = Math.min(row.left, box.left);
          row.right = Math.max(row.right, box.right);
        } else rows.push({ top: box.top, left: box.left, right: box.right, height: box.height, color });
      }
    }
    if (!rows.length) return;
    const origin = heading.getBoundingClientRect();
    const lines = rows.sort((a, b) => a.top - b.top).map((row, index) => {
      const line = document.createElement('span');
      line.className = 'detail-cover-line';
      line.setAttribute('aria-hidden', 'true');
      Object.assign(line.style, {
        top: `${row.top - origin.top - .5}px`,
        left: `${row.left - origin.left - .5}px`,
        width: `${row.right - row.left + 1}px`,
        height: `${row.height + 1}px`,
        color: row.color,
      });
      line.style.setProperty('--detail-cover-delay', `${index * 100}ms`);
      return line;
    });
    lines.at(-1).addEventListener('animationend', event => {
      if (event.animationName === 'about-cover-sweep') clearCover(heading);
    });
    covers.set(heading, lines);
    heading.dataset.detailCover = '';
    heading.append(...lines);
  }

  function show(element) {
    try { coverHeading(element); } catch { clearCover(element); }
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
    let layoutWidth = innerWidth;
    window.addEventListener('resize', () => {
      if (layoutWidth === innerWidth) return;
      layoutWidth = innerWidth;
      // 横幅が変わったら、旧レイアウトで測った帯を取り除く。
      for (const heading of covers.keys()) clearCover(heading);
    }, { passive: true });
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener('change', event => {
      if (event.matches) {
        for (const heading of covers.keys()) clearCover(heading);
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
