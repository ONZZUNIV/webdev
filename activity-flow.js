// 装飾図の表示制御。スロットを監視し、スクロール位置や時間配分は変更しない。
(() => {
  const stage = document.querySelector('.home-refined .activity-stage');
  const visual = stage?.querySelector('.refine-activity-visual');
  if (!visual || typeof MutationObserver !== 'function' || typeof matchMedia !== 'function') return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  const heading = stage.querySelector('.activity-heading');
  const copy = stage.querySelector('.activity-intro > .body-copy');
  const link = stage.querySelector('.activity-detail-link');
  const labels = visual.querySelector('figcaption');
  let fitFrame = 0;
  function fit() {
    fitFrame = 0;
    // 高さが固定されたスロットだけ図を収める。通常表示では内容に応じて高さを伸ばす。
    if (!stage.hasAttribute('data-activity-slot')) {
      visual.removeAttribute('data-flow-fit');
      visual.removeAttribute('data-flow-hidden');
      visual.style.removeProperty('--flow-fit-width');
      return;
    }
    const panel = stage.querySelector('.activity-layout');
    const panelStyle = getComputedStyle(panel);
    const room = panel.clientHeight - parseFloat(panelStyle.paddingTop) - parseFloat(panelStyle.paddingBottom);
    // 詳細リンクも含めて残りの高さを計測し、図だけを必要に応じて縮める。
    const base = (link || copy).getBoundingClientRect().bottom - heading.getBoundingClientRect().top;
    const available = room - base - 16 - labels.getBoundingClientRect().height - 4;
    const width = Math.min(440, copy.parentElement.clientWidth, Math.floor(available * 480 / 140));
    const naturalFits = room - base - 32 - labels.getBoundingClientRect().height - 4 >= width * 140 / 480;
    // 3つの図が読める下限を240pxとする。この値は見た目に基づく調整値。
    visual.toggleAttribute('data-flow-hidden', width < 240);
    visual.toggleAttribute('data-flow-fit', width < 440 || !naturalFits);
    const value = Math.max(0, width) + 'px';
    if (visual.style.getPropertyValue('--flow-fit-width') !== value) visual.style.setProperty('--flow-fit-width', value);
  }
  function scheduleFit() { if (!fitFrame) fitFrame = requestAnimationFrame(fit); }
  const fitObserver = new MutationObserver(scheduleFit);
  fitObserver.observe(stage, { attributes: true, attributeFilter: ['data-activity-slot'] });
  if (typeof ResizeObserver === 'function') {
    const sizeObserver = new ResizeObserver(scheduleFit);
    sizeObserver.observe(heading);
    sizeObserver.observe(copy);
  }
  window.addEventListener('resize', scheduleFit, { passive: true });
  document.fonts?.ready.then(scheduleFit);
  scheduleFit();
  function index() {
    const raw = stage.dataset.activitySlotIndex;
    if (!stage.hasAttribute('data-activity-slot') || raw === undefined) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 && value <= 2 ? value : null;
  }
  let previous = index();
  function stop() {
    for (const animation of animations) animation.cancel();
    animations.clear();
    visual.removeAttribute('data-flow-animating');
  }
  function run(element, frames, options) {
    if (!element || typeof element.animate !== 'function') return;
    const animation = element.animate(frames, options);
    animations.add(animation);
    animation.onfinish = () => {
      animations.delete(animation);
      animation.cancel();
      if (!animations.size) visual.removeAttribute('data-flow-animating');
    };
    animation.oncancel = () => animations.delete(animation);
  }
  function check() {
    const next = index();
    if (next === previous) return;
    const from = previous;
    previous = next;
    stop();
    // 初回表示・位置復元・通常の縦並びでは、矢印を流さない。
    if (from === null || next === null || motion.matches || document.hidden || visual.getBoundingClientRect().height === 0) return;
    const direction = next > from ? 1 : -1;
    visual.dataset.flowDirection = direction > 0 ? 'forward' : 'backward';
    visual.dataset.flowAnimating = '';
    let order = 0;
    for (let current = from; current !== next; current += direction) {
      const edge = Math.min(current, current + direction);
      const guide = visual.querySelector('.flow-guide-' + edge);
      const start = direction > 0 ? '.22' : '-1';
      const end = direction > 0 ? '-1' : '.22';
      const delay = order++ * 80;
      run(guide?.querySelector('.flow-trace'), [
        { opacity: 0, strokeDashoffset: start, offset: 0 },
        { opacity: .95, offset: .16 },
        { opacity: .95, offset: .82 },
        { opacity: 0, strokeDashoffset: end, offset: 1 }
      ], { duration: 420, delay, easing: 'linear' });
      run(guide?.querySelector(direction > 0 ? '.flow-arrival-forward' : '.flow-arrival-backward'), [
        { opacity: 0 }, { opacity: .9, offset: .45 }, { opacity: 0 }
      ], { duration: 220, delay: delay + 250, easing: 'ease-out' });
    }
    if (!animations.size) visual.removeAttribute('data-flow-animating');
  }
  const observer = new MutationObserver(check);
  observer.observe(stage, { attributes: true, attributeFilter: ['data-activity-slot-index', 'data-activity-slot'] });
  const reset = () => { stop(); previous = index(); };
  motion.addEventListener?.('change', reset);
  window.addEventListener('resize', reset, { passive: true });
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
})();
