// ACTIVITY左側の導入専用。ABOUTと青幕のスクロール演出は独立している。
(() => {
  const section = document.querySelector('.activity');
  const heading = section?.querySelector('.activity-heading');
  const title = heading?.querySelector('.activity-intro > h2');
  const caption = heading?.querySelector('.activity-tagline');
  const body = heading?.querySelector('.activity-intro > .body-copy');
  const aboutText = [...document.querySelectorAll('.about-copy > h1, .about-copy > p')];
  if (!section || !heading || !title || !caption || !body || !('IntersectionObserver' in window) ||
      typeof window.matchMedia !== 'function') return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;

  let observer, layoutObserver, frame, deadline, fontDeadline;
  let ready = false, started = false, finished = false, sequenceEnd = 1240;
  const clearLines = () => heading.querySelectorAll('[data-activity-cover-line]').forEach(line => line.remove());
  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    clearTimeout(deadline);
    clearTimeout(fontDeadline);
    observer?.disconnect();
    layoutObserver?.disconnect();
    window.removeEventListener('scroll', scheduleCheck);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', finish);
    document.removeEventListener('visibilitychange', hidden);
    motion.removeEventListener?.('change', reduced);
    body.removeEventListener('animationend', ended);
    body.removeEventListener('animationcancel', finish);
    heading.removeAttribute('data-activity-reveal');
    heading.removeAttribute('data-activity-title-ready');
    heading.style.removeProperty('--activity-copy-delay');
    heading.style.removeProperty('--activity-body-delay');
    clearLines();
    heading.dataset.activityRevealed = 'true';
  }

  function measureCover(element,delay) {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Text measurement unavailable');
    const origin = element.getBoundingClientRect(), style = getComputedStyle(element);
    context.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
    const range = document.createRange(), rows = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
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
        const bounds = {baseline, left:box.left-metrics.actualBoundingBoxLeft, right:box.left+metrics.actualBoundingBoxRight,
          top:baseline-metrics.actualBoundingBoxAscent, bottom:baseline+metrics.actualBoundingBoxDescent};
        const row = rows.find(row => Math.abs(row.baseline-baseline) < 1);
        if (!row) rows.push(bounds);
        else {
          row.left=Math.min(row.left,bounds.left); row.right=Math.max(row.right,bounds.right);
          row.top=Math.min(row.top,bounds.top); row.bottom=Math.max(row.bottom,bounds.bottom);
        }
      }
    }
    rows.sort((a,b)=>a.baseline-b.baseline);
    const fragment=document.createDocumentFragment();
    rows.forEach((row,index)=>{
      const line=document.createElement('span');
      line.dataset.activityCoverLine=''; line.setAttribute('aria-hidden','true');
      Object.assign(line.style,{left:(row.left-origin.left-.5)+'px',top:(row.top-origin.top-.5)+'px',
        width:(row.right-row.left+1)+'px',height:(row.bottom-row.top+1)+'px'});
      line.style.setProperty('--activity-line-delay',(delay+index*140)+'ms');
      fragment.append(line);
    });
    element.append(fragment);
    if (!rows.length) throw new Error('No text lines');
    return rows.length;
  }
  function measureLines() {
    clearLines();
    const titleLines=measureCover(title,100);
    heading.style.setProperty('--activity-title-end',(700+(titleLines-1)*140)+'ms');
    const captionStart=640+(titleLines-1)*140;
    const captionLines=measureCover(caption,captionStart);
    const bodyStart=captionStart+540+(captionLines-1)*140;
    heading.style.setProperty('--activity-body-delay',bodyStart+'ms');
    sequenceEnd=bodyStart+400;
    heading.dataset.activityTitleReady='true';
  }

  function start() {
    if (finished || started || !ready) return;
    started=true;
    heading.dataset.activityReveal='playing';
    deadline=setTimeout(finish,sequenceEnd+310);
  }
  function check() {
    frame=0;
    if (finished) return;
    const viewport=window.innerHeight, box=section.getBoundingClientRect(), text=title.getBoundingClientRect();
    // 導入を飛び越えた場合は、Intersection Observerの通知がなくても表示する。
    if (text.bottom<=0 || document.documentElement.scrollHeight<=viewport+1) { finish(); return; }
    if (started || !ready) return;
    const visible=Math.max(0,Math.min(viewport,text.bottom)-Math.max(0,text.top));
    const rects=aboutText.map(el=>el.getBoundingClientRect());
    const textCovered=rects.every(rect=>{
      const top=Math.max(0,rect.top),bottom=Math.min(viewport,rect.bottom);
      return bottom<=top || box.top<=top+(bottom-top)*.15;
    });
    // 85%は画面端に対する開始位置であり、縦長セクション全体の表示割合ではない。
    if (box.top<=viewport*.15 && textCovered && visible>=text.height*.5) start();
  }
  function scheduleCheck() {
    if (!finished && !frame) frame=requestAnimationFrame(check);
  }
  function resize() {
    if (finished) return;
    if (started) { finish(); return; }
    try { if (ready) measureLines(); scheduleCheck(); } catch { finish(); }
  }
  function hidden() { if (document.hidden) finish(); }
  function reduced(event) { if (event.matches) finish(); }
  function ended(event) {
    if (event.target===body && event.animationName==='about-copy-fade-up') finish();
  }

  try {
    observer=new IntersectionObserver(scheduleCheck,{threshold:[0,.5,1]});
    observer.observe(title);
    if ('ResizeObserver' in window) {
      layoutObserver=new ResizeObserver(scheduleCheck);
      layoutObserver.observe(section.closest('.about-activity-boundary')||section);
    }
    window.addEventListener('scroll',scheduleCheck,{passive:true});
    window.addEventListener('resize',resize,{passive:true});
    window.addEventListener('pagehide',finish);
    document.addEventListener('visibilitychange',hidden);
    motion.addEventListener?.('change',reduced);
    body.addEventListener('animationend',ended);
    body.addEventListener('animationcancel',finish);
    heading.dataset.activityReveal='pending';
    hidden();
    if (finished) return;
    fontDeadline=setTimeout(finish,2500);
    Promise.resolve(document.fonts?.ready).then(()=>{
      if (finished) return;
      clearTimeout(fontDeadline);
      try { measureLines(); ready=true; scheduleCheck(); } catch { finish(); }
    },finish);
    scheduleCheck();
  } catch { finish(); }
})();
