// Reveal the News label, then fade in the empty-state text without moving it.
(() => {
  const label = document.querySelector('.news-label');
  const text = label?.querySelector('span'), rule = label?.querySelector('img');
  const copy = label?.closest('.news')?.querySelector('.news-empty > .body-copy');
  if (!text || !rule || !('IntersectionObserver' in window) ||
      typeof window.matchMedia !== 'function') return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  const endTarget = copy || rule;
  let observer, frame, deadline, viewportFrame, fontDeadline;
  let started = false, finished = false, viewportReady = false, fontsReady = false;
  let pageShown = document.readyState === 'complete';
  function settleViewport() {
    if (finished || !pageShown || !fontsReady || document.hidden) return;
    cancelAnimationFrame(viewportFrame);
    // Native restoration and ACTIVITY's layout settle after pageshow/font load.
    viewportFrame = requestAnimationFrame(()=>{viewportFrame=requestAnimationFrame(()=>{
      viewportReady = true; schedule();
    });});
  }
  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame); cancelAnimationFrame(viewportFrame); clearTimeout(deadline); clearTimeout(fontDeadline);
    observer?.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', suspend);
    window.removeEventListener('pageshow', shown);
    document.removeEventListener('visibilitychange', hidden);
    motion.removeEventListener?.('change', reduced);
    endTarget.removeEventListener('animationend', ended);
    endTarget.removeEventListener('animationcancel', finish);
    label.removeAttribute('data-news-reveal');
    label.dataset.newsRevealed = 'true';
  }
  function check() {
    frame = 0;
    if (finished || !viewportReady || document.hidden) return;
    const box = text.getBoundingClientRect();
    if (box.bottom <= 0 || document.documentElement.scrollHeight <= innerHeight + 1) { finish(); return; }
    if (!started && box.top <= innerHeight * .85 && box.bottom > 0) {
      started = true;
      label.dataset.newsReveal = 'playing';
      deadline = setTimeout(finish, 1050);
    }
  }
  function schedule() { if (!finished && !frame) frame = requestAnimationFrame(check); }
  function resize() { if (started) finish(); else schedule(); }
  function suspend() {
    viewportReady = false; cancelAnimationFrame(viewportFrame);
    // Unseen content keeps its entrance; only an already-playing one completes.
    if (started) finish();
  }
  function shown() { pageShown = true; settleViewport(); }
  function hidden() { if (document.hidden) suspend(); else settleViewport(); }
  function reduced(event) { if (event.matches) finish(); }
  function ended(event) { if (event.target === endTarget && event.animationName === (copy ? 'about-copy-fade' : 'about-label-reveal')) finish(); }
  try {
    observer = new IntersectionObserver(schedule, { threshold: [0, .5, 1] });
    observer.observe(text);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', shown);
    document.addEventListener('visibilitychange', hidden);
    motion.addEventListener?.('change', reduced);
    endTarget.addEventListener('animationend', ended);
    endTarget.addEventListener('animationcancel', finish);
    label.dataset.newsReveal = 'pending';
    hidden();
    fontDeadline = setTimeout(()=>{fontsReady=true;pageShown=true;settleViewport();},2500);
    Promise.resolve(document.fonts?.ready).then(()=>{clearTimeout(fontDeadline);fontsReady=true;settleViewport();},finish);
  } catch { finish(); }
})();
