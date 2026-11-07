// 段階的な機能追加。準備に成功するまでは、すべての内容を表示する。
(() => {
  const about = document.querySelector('.about');
  const title = about?.querySelector('#about-title');
  const link = about?.querySelector('.text-link');
  if (!about || !title || !link || !('IntersectionObserver' in window) ||
      typeof window.matchMedia !== 'function') return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;

  let observer;
  let deadline;
  let fontDeadline;
  let started = false;
  let finished = false;
  let ready = false;
  let inView = false;
  let lineCount = 0;
  let layoutWidth = innerWidth;

  function clearLines() {
    title.querySelectorAll('[data-about-title-line]').forEach(line => line.remove());
  }

  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(deadline);
    window.clearTimeout(fontDeadline);
    observer?.disconnect();
    window.removeEventListener('scroll', revealIfPassed);
    window.removeEventListener('resize', refreshLines);
    window.removeEventListener('pagehide', suspend);
    window.removeEventListener('pageshow', resume);
    document.removeEventListener('visibilitychange', revealIfHidden);
    motion.removeEventListener?.('change', revealIfReduced);
    link.removeEventListener('animationend', revealIfEnded);
    link.removeEventListener('animationcancel', finish);
    about.removeAttribute('data-about-reveal');
    about.removeAttribute('data-about-title-ready');
    about.style.removeProperty('--about-body-delay');
    about.style.removeProperty('--about-link-delay');
    clearLines();
    about.dataset.aboutRevealed = 'true';
  };

  function measureLines() {
    clearLines();
    const context = document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Text measurement unavailable');
    const headingBox = title.getBoundingClientRect();
    const rows = [];
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node; (node = walker.nextNode());) {
      const style = getComputedStyle(node.parentElement);
      context.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
      let offset = 0;
      for (const character of node.textContent) {
        range.setStart(node, offset);
        offset += character.length;
        range.setEnd(node, offset);
        if (!character.trim()) continue;
        const box = range.getBoundingClientRect();
        if (!box.width || !box.height) continue;
        const metrics = context.measureText(character);
        const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize);
        const descent = metrics.fontBoundingBoxDescent ?? 0;
        const baseline = box.top + (box.height - ascent - descent) / 2 + ascent;
        // 見出し要素の幅や末尾の字間、行高の空白ではなく、文字の描画範囲を使う。
        const left = box.left - metrics.actualBoundingBoxLeft;
        const right = box.left + metrics.actualBoundingBoxRight;
        const top = baseline - metrics.actualBoundingBoxAscent;
        const bottom = baseline + metrics.actualBoundingBoxDescent;
        let row = rows.find(row => Math.abs(row.baseline - baseline) < 1);
        if (!row) {
          row = {baseline, left, right, top, bottom};
          rows.push(row);
        } else {
          row.left = Math.min(row.left, left);
          row.right = Math.max(row.right, right);
          row.top = Math.min(row.top, top);
          row.bottom = Math.max(row.bottom, bottom);
        }
      }
    }
    rows.sort((a, b) => a.baseline - b.baseline);
    const fragment = document.createDocumentFragment();
    rows.forEach((row, index) => {
      const line = document.createElement('span');
      line.dataset.aboutTitleLine = '';
      line.setAttribute('aria-hidden', 'true');
      // 各辺に0.5px加え、大きな帯にせず文字の縁の描画を覆う。
      Object.assign(line.style, {
        left: (row.left - headingBox.left - .5) + 'px',
        top: (row.top - headingBox.top - .5) + 'px',
        width: (row.right - row.left + 1) + 'px',
        height: (row.bottom - row.top + 1) + 'px',
      });
      line.style.setProperty('--about-line-delay', (100 + index * 140) + 'ms');
      fragment.append(line);
    });
    title.append(fragment);
    lineCount = rows.length;
    if (!lineCount) throw new Error('No heading lines');
    const stagger = (lineCount - 1) * 140;
    about.style.setProperty('--about-body-delay', (640 + stagger) + 'ms');
    about.style.setProperty('--about-link-delay', (840 + stagger) + 'ms');
    about.dataset.aboutTitleReady = 'true';
  }

  function refreshLines() {
    if (finished || !ready) return;
    // 高さだけの変更では文字の行分けは変わらないため、再生を継続する。
    if (layoutWidth === innerWidth) return;
    layoutWidth = innerWidth;
    // 幅の変更で文字が折り返した場合は、古いマスクを残さず通常表示にする。
    if (started) { finish(); return; }
    try { measureLines(); } catch { finish(); }
  }

  function revealIfPassed() {
    // 一度の移動で画面を通過すると、Intersection Observerが通知しない場合がある。
    if (!started && title.getBoundingClientRect().bottom <= 0) finish();
  }
  // 未表示の演出は離脱で消費せず、再生中だけ通常表示にして復帰時の隠れ残りを防ぐ。
  function suspend() { if (started) finish(); }
  function resume() { revealIfPassed(); if (inView) start(); }
  function revealIfHidden() { if (document.hidden) suspend(); else resume(); }
  function revealIfReduced(event) { if (event.matches) finish(); }
  function revealIfEnded(event) {
    if (event.target === link && event.animationName === 'about-copy-fade') finish();
  }

  const start = () => {
    if (started || finished || !ready) return;
    if (document.hidden) return;
    if (motion.matches) { finish(); return; }
    started = true;
    about.dataset.aboutReveal = 'playing';
    deadline = window.setTimeout(finish, 1500 + (lineCount - 1) * 140);
  };

  try {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        if (inView) start();
        else if (!started && entry.boundingClientRect.bottom <= 0) finish();
      }
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });

    window.addEventListener('scroll', revealIfPassed, { passive: true });
    window.addEventListener('resize', refreshLines, { passive: true });
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', revealIfHidden);
    motion.addEventListener?.('change', revealIfReduced);
    link.addEventListener('animationend', revealIfEnded);
    link.addEventListener('animationcancel', finish);
    observer.observe(title);
    about.dataset.aboutReveal = 'pending';
    revealIfPassed();
    revealIfHidden();
    if (finished) return;

    // 文字の計測前に指定フォントを待つが、無期限には待機しない。
    fontDeadline = window.setTimeout(finish, 2500);
    Promise.resolve(document.fonts?.ready).then(() => {
      if (finished) return;
      window.clearTimeout(fontDeadline);
      try {
        measureLines();
        ready = true;
        if (inView) start();
      } catch { finish(); }
    }, finish);
  } catch { finish(); }
})();
