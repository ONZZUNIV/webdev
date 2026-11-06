// Independent one-time entrances; page scrolling and all other sections stay native.
(() => {
  const section = document.querySelector('.connect');
  const banner = section?.querySelector('.connect-banner > span');
  const title = section?.querySelector(':scope > h2');
  const subtitle = section?.querySelector('.connect-subtitle');
  const cards = [...(section?.querySelectorAll('.connect-card') || [])];
  if (!banner || !title || !subtitle || !cards.length || !('IntersectionObserver' in window) ||
      typeof window.matchMedia !== 'function') return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  let observer, frame, fontDeadline, headerDeadline, cardsDeadline, viewportFrame;
  let viewportReady = false, pageShown = document.readyState === 'complete';
  let ready = false, headerStarted = false, headerDone = false, stopped = false;
  let headerStart = 0, headerEnd = 830, cardDelay = 520;
  const states = new Map(cards.map(card => [card, 'pending'])), deadlines = new Map();
  const clearLines = () => title.querySelectorAll('[data-connect-cover-line]').forEach(line => line.remove());
  function settleViewport() {
    if (stopped || !pageShown || !ready || document.hidden) return;
    cancelAnimationFrame(viewportFrame);
    viewportFrame = requestAnimationFrame(()=>{viewportFrame=requestAnimationFrame(()=>{
      viewportReady = true; schedule();
    });});
  }
  function cleanup() {
    if (stopped || !headerDone || [...states.values()].some(state => state !== 'done')) return;
    stopped = true;
    cancelAnimationFrame(frame); cancelAnimationFrame(viewportFrame); clearTimeout(fontDeadline); clearTimeout(cardsDeadline);
    observer?.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', suspend);
    window.removeEventListener('pageshow', shown);
    document.removeEventListener('visibilitychange', hidden);
    motion.removeEventListener?.('change', reduced);
    section.removeEventListener('animationend', ended);
    section.dataset.connectRevealed = 'true';
  }
  function finishHeader() {
    if (headerDone) return;
    headerDone = true;
    clearTimeout(headerDeadline); clearTimeout(cardsDeadline); clearTimeout(fontDeadline);
    section.removeAttribute('data-connect-reveal');
    section.removeAttribute('data-connect-title-ready');
    clearLines(); cleanup(); schedule();
  }
  function finishCard(card) {
    clearTimeout(deadlines.get(card)); deadlines.delete(card);
    states.set(card, 'done');
    card.removeAttribute('data-connect-card-reveal');
    card.dataset.connectCardRevealed = 'true';
    cleanup();
  }
  function finishAll() { finishHeader(); cards.forEach(finishCard); }
  function measureLines() {
    clearLines();
    const context = document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Text measurement unavailable');
    const origin = title.getBoundingClientRect(), style = getComputedStyle(title);
    context.font = [style.fontStyle,style.fontWeight,style.fontSize,style.fontFamily].join(' ');
    const rows = [], range = document.createRange(), walker = document.createTreeWalker(title,NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
      let offset = 0;
      for (const character of node.textContent) {
        range.setStart(node,offset); offset += character.length; range.setEnd(node,offset);
        if (!character.trim()) continue;
        const box = range.getBoundingClientRect(), m = context.measureText(character);
        if (!box.width || !box.height) continue;
        const ascent = m.fontBoundingBoxAscent ?? parseFloat(style.fontSize), descent = m.fontBoundingBoxDescent ?? 0;
        const baseline = box.top + (box.height-ascent-descent)/2 + ascent;
        const bounds = {baseline,left:box.left-m.actualBoundingBoxLeft,right:box.left+m.actualBoundingBoxRight,top:baseline-m.actualBoundingBoxAscent,bottom:baseline+m.actualBoundingBoxDescent};
        const row = rows.find(row => Math.abs(row.baseline-baseline)<1);
        if (!row) rows.push(bounds);
        else { row.left=Math.min(row.left,bounds.left); row.right=Math.max(row.right,bounds.right); row.top=Math.min(row.top,bounds.top); row.bottom=Math.max(row.bottom,bounds.bottom); }
      }
    }
    rows.sort((a,b)=>a.baseline-b.baseline);
    if (!rows.length) throw new Error('No heading lines');
    rows.forEach((row,index)=>{
      const line = document.createElement('span');
      line.dataset.connectCoverLine = ''; line.setAttribute('aria-hidden','true');
      Object.assign(line.style,{left:(row.left-origin.left-.5)+'px',top:(row.top-origin.top-.5)+'px',width:(row.right-row.left+1)+'px',height:(row.bottom-row.top+1)+'px'});
      line.style.setProperty('--connect-line-delay',(160+index*140)+'ms'); title.append(line);
    });
    headerEnd = Math.max(830,760+(rows.length-1)*140);
    cardDelay = 520+(rows.length-1)*140;
    section.dataset.connectTitleReady = '';
  }
  function startHeader() {
    headerStarted = true; headerStart = performance.now();
    section.dataset.connectReveal = 'playing';
    headerDeadline = setTimeout(finishHeader,headerEnd+200);
    cardsDeadline = setTimeout(schedule,cardDelay);
  }
  function startCard(card) {
    states.set(card,'playing'); card.dataset.connectCardReveal = 'playing';
    deadlines.set(card,setTimeout(()=>finishCard(card),650));
  }
  function check() {
    frame = 0;
    if (stopped || !viewportReady || document.hidden) return;
    const maxScroll = document.documentElement.scrollHeight-innerHeight;
    if (maxScroll <= 1) { finishAll(); return; }
    const atEnd = scrollY >= maxScroll-1;
    if (!headerDone) {
      const box = banner.getBoundingClientRect();
      if (box.bottom <= 0) finishHeader();
      else if (ready && !headerStarted && box.top < innerHeight && (box.top <= innerHeight*.85 || atEnd)) startHeader();
    }
    const cardsReady = headerDone || headerStarted && performance.now()-headerStart >= cardDelay;
    cards.forEach(card=>{
      if (states.get(card) !== 'pending') return;
      const box = card.getBoundingClientRect();
      if (box.bottom <= 0) finishCard(card);
      else if (cardsReady && box.top < innerHeight && (box.top <= innerHeight*.85 || atEnd)) startCard(card);
    });
  }
  function schedule() { if (!stopped && !frame) frame = requestAnimationFrame(check); }
  function resize() {
    if (!headerDone) {
      if (headerStarted) finishHeader();
      else if (ready) { try { measureLines(); } catch { finishHeader(); } }
    }
    cards.filter(card=>states.get(card)==='playing').forEach(finishCard);
    schedule();
  }
  function suspend() {
    viewportReady = false; cancelAnimationFrame(viewportFrame);
    if (headerStarted) finishHeader();
    cards.filter(card=>states.get(card)==='playing').forEach(finishCard);
  }
  function shown() { pageShown=true;settleViewport(); }
  function hidden() { if (document.hidden) suspend(); else settleViewport(); }
  function reduced(event) { if (event.matches) finishAll(); }
  function ended(event) {
    const card = event.target.closest('.connect-card');
    if (card && event.target.matches('.connect-button') && event.animationName==='about-copy-fade') finishCard(card);
    else if (!card && headerStarted && performance.now()-headerStart >= headerEnd-30) finishHeader();
  }
  try {
    observer = new IntersectionObserver(schedule,{threshold:[0,.5,1]});
    [banner,...cards].forEach(element=>observer.observe(element));
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',resize,{passive:true});
    window.addEventListener('pagehide',suspend);
    window.addEventListener('pageshow',shown);
    document.addEventListener('visibilitychange',hidden);
    motion.addEventListener?.('change',reduced);
    section.addEventListener('animationend',ended);
    section.dataset.connectReveal = 'pending';
    cards.forEach(card=>{card.dataset.connectCardReveal='pending';});
    hidden();
    if (stopped) return;
    const prepareHeader = () => {
      if (stopped || headerDone || headerStarted) return;
      clearTimeout(fontDeadline);
      try { measureLines(); ready=true; settleViewport(); } catch { finishAll(); }
    };
    // A slow font promise may use current glyphs, but must not consume unseen entries.
    fontDeadline = setTimeout(prepareHeader,2500);
    Promise.resolve(document.fonts?.ready).then(prepareHeader,finishAll);
    schedule();
  } catch { finishAll(); }
})();
