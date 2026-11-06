// Decorative flow feedback. Observe the reel; never change scroll or its timing.
(() => {
  const stage = document.querySelector('.home-refined .activity-stage');
  const visual = stage?.querySelector('.refine-activity-visual');
  if (!visual || typeof MutationObserver !== 'function' || typeof matchMedia !== 'function') return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
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
    // Initial entry, restoration, and ordinary stacked layouts need no travel pulse.
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
