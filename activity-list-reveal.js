(() => {
// 各項目内の初回表示。項目全体の変形はスロット側で管理する。
const articleReveal = (() => {
  const states = new Map(), deadlines = new Map(), callbacks = new Map();
  const all = [...document.querySelectorAll('.activity-item')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let layoutWidth = innerWidth;
  function finish(item) {
    const callback = callbacks.get(item);
    callbacks.delete(item); clearTimeout(deadlines.get(item)); deadlines.delete(item);
    states.set(item,'done');
    item.removeAttribute('data-activity-item-parts');
    item.removeAttribute('data-activity-item-titles-ready');
    item.removeAttribute('data-activity-item-measuring');
    item.querySelectorAll('[data-activity-item-cover]').forEach(line=>line.remove());
    item.style.removeProperty('--item-copy-delay');
    item.dataset.activityItemRevealed = 'true';
    callback?.();
  }
  function finishAll() { all.forEach(finish); }
  function finishPlaying() { all.filter(item=>states.get(item)==='playing').forEach(finish); }
  function prepare(item) {
    if (states.has(item)) return;
    if (motion.matches || !('IntersectionObserver' in window)) { finish(item); return; }
    states.set(item,'pending');
    item.dataset.activityItemParts = 'pending';
  }
  function cover(element) {
    const context=document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Text measurement unavailable');
    const origin=element.getBoundingClientRect(),style=getComputedStyle(element);
    context.font=[style.fontStyle,style.fontWeight,style.fontSize,style.fontFamily].join(' ');
    const range=document.createRange(),rows=[],walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
    for(let node;(node=walker.nextNode());){let offset=0;for(const character of node.textContent){
      range.setStart(node,offset);offset+=character.length;range.setEnd(node,offset);
      if(!character.trim())continue;
      const box=range.getBoundingClientRect(),m=context.measureText(character);
      if(!box.width||!box.height)continue;
      const ascent=m.fontBoundingBoxAscent??parseFloat(style.fontSize),descent=m.fontBoundingBoxDescent??0;
      const baseline=box.top+(box.height-ascent-descent)/2+ascent;
      const bounds={baseline,left:box.left-m.actualBoundingBoxLeft,right:box.left+m.actualBoundingBoxRight,
        top:baseline-m.actualBoundingBoxAscent,bottom:baseline+m.actualBoundingBoxDescent};
      const row=rows.find(row=>Math.abs(row.baseline-baseline)<1);
      if(!row)rows.push(bounds);else{row.left=Math.min(row.left,bounds.left);row.right=Math.max(row.right,bounds.right);row.top=Math.min(row.top,bounds.top);row.bottom=Math.max(row.bottom,bounds.bottom);}
    }}
    rows.sort((a,b)=>a.baseline-b.baseline);
    if(!rows.length)throw new Error('No heading lines');
    const fragment=document.createDocumentFragment();
    rows.forEach((row,index)=>{const line=document.createElement('span');line.dataset.activityItemCover='';line.setAttribute('aria-hidden','true');
      Object.assign(line.style,{left:(row.left-origin.left-.5)+'px',top:(row.top-origin.top-.5)+'px',width:(row.right-row.left+1)+'px',height:(row.bottom-row.top+1)+'px'});
      line.style.setProperty('--item-line-delay',(100+index*140)+'ms');fragment.append(line);
    });element.append(fragment);return rows.length;
  }
  function play(item,callback) {
    prepare(item);
    if(states.get(item)==='done'){callback?.();return 0;}
    if(callback)callbacks.set(item,callback);
    if(states.get(item)==='playing')return 830;
    try {
      item.dataset.activityItemMeasuring='';
      const lines=Math.max(...[...item.querySelectorAll('h3,h4')].map(cover));
      const delay=480+(lines-1)*140,end=delay+350;
      item.style.setProperty('--item-copy-delay',delay+'ms');
      item.dataset.activityItemTitlesReady='';
      item.removeAttribute('data-activity-item-measuring');
      states.set(item,'playing');item.dataset.activityItemParts='playing';
      deadlines.set(item,setTimeout(()=>finish(item),end+200));
      return end;
    } catch { finish(item);return 0; }
  }
  document.querySelector('.activity-list')?.addEventListener('animationend',event=>{
    const item=event.target.closest('.activity-item');
    if(item&&states.get(item)==='playing'&&event.target.matches('.activity-copy>.body-copy')&&event.animationName==='about-copy-fade')finish(item);
  });
  window.addEventListener('resize',()=>{
    // 高さだけの変更では、項目内の登場演出を完了扱いにしない。
    if (layoutWidth === innerWidth) return;
    layoutWidth = innerWidth;
    finishPlaying();
  },{passive:true});
  window.addEventListener('pagehide',finishPlaying);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finishPlaying();});
  motion.addEventListener?.('change',event=>{if(event.matches)finishAll();});
  return {prepareAll:()=>all.forEach(prepare),play,finish,finishAll,finishPlaying,state:item=>states.get(item)};
})();

// ページのスクロールで停止位置を選び、スロットだけを滑らかに移動する。
// 幅や高さが足りない画面では、
// 通常の一覧と既存の初回表示を使用する。
(() => {
  const heading = document.querySelector('.activity-heading');
  const list = document.querySelector('.activity-list');
  const stage = document.querySelector('.activity-stage');
  if (!heading || !list || !stage || typeof window.matchMedia !== 'function') return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const section = stage.closest('.activity');
  const items = [...list.querySelectorAll('.activity-item')];
  const tagline = heading.querySelector('.activity-tagline');
  const introTitle = heading.querySelector('.activity-intro>h2');
  let titleShown=!heading.hasAttribute('data-activity-reveal');
  const inkCache = new Map();
  function inkInset(element) {
    const style = getComputedStyle(element), character = element.textContent.trim()[0];
    const key = style.font + style.letterSpacing + character;
    if (inkCache.has(key)) return inkCache.get(key);
    // スロットの変形に影響されない、元の大きさの文字を計測する。
    const probe = document.createElement('span');
    Object.assign(probe.style, {position:'absolute',left:'0',top:'0',visibility:'hidden',
      display:'block',whiteSpace:'pre',font:style.font,letterSpacing:style.letterSpacing});
    probe.textContent = character;
    document.body.append(probe);
    try {
      const context = document.createElement('canvas').getContext('2d');
      context.font = [style.fontStyle,style.fontWeight,style.fontSize,style.fontFamily].join(' ');
      const metrics = context.measureText(character), range = document.createRange();
      range.selectNodeContents(probe);
      const box = range.getBoundingClientRect();
      const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize);
      const descent = metrics.fontBoundingBoxDescent ?? 0;
      const inset = box.top + (box.height-ascent-descent)/2 + ascent - metrics.actualBoundingBoxAscent - probe.getBoundingClientRect().top;
      inkCache.set(key,inset);
      return inset;
    } finally { probe.remove(); }
  }
  let frame, revealDeadline, entered = false, revealing = false;
  let snap = null;
  function selectSlot(raw, target) {
    // 進行時の境界は.45/1.45、逆方向は.35/1.35とし、ホイール操作の揺れを防ぐ。
    while (target < 2 && raw >= target + .45) target++;
    while (target > 0 && raw <= target - .65) target--;
    return target;
  }
  function snapToSlot(raw, now) {
    if (!snap) {
      const index = selectSlot(raw, restoredSlot ?? Math.min(2, Math.floor(raw + .55)));
      restoredSlot = null;
      snap = { target:index, value:index, from:index, started:now };
    }
    const elapsed = Math.min(1, (now - snap.started) / 400);
    snap.value = snap.from + (snap.target - snap.from) * (1 - (1 - elapsed) ** 3);
    const target = selectSlot(raw, snap.target);
    if (target !== snap.target) {
      snap.from = snap.value;
      snap.target = target;
      snap.started = now;
    }
    if (now - snap.started >= 400) snap.value = snap.target;
    return snap.value;
  }
  const restoreNavigation = ['reload','back_forward'].includes(performance.getEntriesByType('navigation')[0]?.type);
  let restoreReady=!restoreNavigation;
  let restoreFontsReady=false, restorePageShown=document.readyState==='complete', restoreFrame;
  const historyKey = 'circleActivityReel';
  let savedEntry;
  try { savedEntry=history.state?.[historyKey]; } catch {}
  // 旧形式は初回表示後にスクロールの基準を変更していたため、その時間情報を破棄する。
  // バージョン2では選択中の項目と初回表示の開始状態だけを保存する。
  if(savedEntry?.version!==2||typeof savedEntry.entered!=='boolean')savedEntry=null;
  let restoredSlot = restoreNavigation && Number.isInteger(savedEntry?.slotIndex) && savedEntry.slotIndex>=0 && savedEntry.slotIndex<=2 ? savedEntry.slotIndex : null;
  let lastSaved='';
  if(restoreNavigation){
    entered=savedEntry?.version===2 ? savedEntry.entered : true;
  }
  function readyToRestore() {
    if(!restoreFontsReady||!restorePageShown)return;
    cancelAnimationFrame(restoreFrame);
    // ブラウザの位置復元はload/pageshow後に行われるため、配置の確定を待つ。
    restoreFrame=requestAnimationFrame(()=>{restoreFrame=requestAnimationFrame(()=>{
      if(stage.hasAttribute('data-activity-slot')&&scrollY<startPosition()){
        entered=false;restoredSlot=null;
      }
      restoreReady=true;update();
    });});
  }
  function persistEntry() {
    if(revealing)return;
    const entry={version:2,entered,slotIndex:snap?.target??0};
    const serialized=JSON.stringify(entry);
    if(serialized===lastSaved)return;
    try {
      const state=history.state;
      if(state!==null&&(typeof state!=='object'||Array.isArray(state)))return;
      history.replaceState({...state,[historyKey]:entry},'');
      lastSaved=serialized;
    } catch {}
  }
  const set = (element, name, value) => {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  };
  function startPosition() {
    const pin = parseFloat(getComputedStyle(heading.parentElement).top);
    const lead = Math.min(140, Math.max(80, innerHeight * .10));
    return stage.getBoundingClientRect().top + scrollY - pin + lead;
  }
  function pinned() {
    const panel = heading.parentElement;
    return Math.abs(panel.getBoundingClientRect().top-parseFloat(getComputedStyle(panel).top)) < 1;
  }
  function stopReveal() {
    clearTimeout(revealDeadline);
    revealing = false;
    stage.removeAttribute('data-activity-slot-starting');
  }
  function completeReveal() {
    if (!revealing) return;
    stopReveal();
    schedule();
  }
  function render() {
    frame = 0;
    if (!stage.hasAttribute('data-activity-slot')||!restoreReady) return;
    const start = startPosition();
    const step = parseFloat(stage.style.getPropertyValue('--activity-slot-step'));
    const dwell = parseFloat(stage.style.getPropertyValue('--activity-slot-dwell'));
    if (!entered && (titleShown||!heading.hasAttribute('data-activity-reveal')) && scrollY >= start) {
      entered = true;
      // 一度に通過したセクションへ閲覧位置を引き戻さない。
      if (pinned()) {
        revealing = true;
        stage.dataset.activitySlotStarting = '';
        const duration=articleReveal.play(items[0],completeReveal);
        revealDeadline = setTimeout(completeReveal,duration+250);
      }
    }
    if (revealing && !pinned()) stopReveal();
    // 待機するのは初回の表示演出だけとする。ページ位置は元の固定区間に対応させ、
    // 待機によって位置のずれや区間の短縮を生じさせない。
    set(stage,'--activity-slot-origin',start+'px');
    set(stage,'--activity-slot-fit','1');
    const travelled = !entered || revealing ? 0 : Math.max(0,scrollY-start);
    const segment = Math.min(2, Math.floor(travelled / (dwell + step)));
    const rawProgress = segment === 2 ? 2 : segment +
      Math.max(0, Math.min(1, (travelled - segment * (dwell + step) - dwell) / step));
    const progress = snapToSlot(rawProgress, performance.now());
    set(stage, '--activity-slot-scroll-progress', String(rawProgress));
    if(entered&&!revealing){
      if(!pinned()){
        const panel=heading.parentElement;
        if(panel.getBoundingClientRect().top<parseFloat(getComputedStyle(panel).top)-1)
          items.forEach(item=>{if(articleReveal.state(item)!=='playing')articleReveal.finish(item);});
      }
      else {
        const active=snap.target;
        items.slice(0,active).forEach(articleReveal.finish);
        articleReveal.play(items[active]);
      }
    }
    persistEntry();
    stage.toggleAttribute('data-activity-slot-visible', entered);
    stage.dataset.activitySlotIndex = String(snap.target);
    set(stage, '--activity-slot-progress', String(progress));
    items.forEach((item, index) => {
      const distance = index - progress, magnitude = Math.abs(distance);
      const visible = magnitude <= 1 ? 1 : Math.max(0, 1 - (magnitude - 1) / .25);
      set(item, '--slot-offset', (distance * parseFloat(stage.style.getPropertyValue('--activity-slot-pitch')) +
        parseFloat(item.style.getPropertyValue('--slot-anchor-shift'))) + 'px');
      set(item, '--slot-scale', String(1 - Math.min(1, magnitude) * .18));
      set(item, '--slot-tilt', (-distance * 12) + 'deg');
      set(item, '--slot-opacity', String(visible * (1 - Math.min(1, magnitude) * .30)));
      item.style.zIndex = String(Math.round((3 - magnitude) * 10));
    });
    // スクロールが止まっても項目の切替は完了する。ページ自体は動かさない。
    if (progress !== snap.target) schedule();
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(render); }
  function titleEnded(event) {
    if(event.animationName==='about-cover-sweep'&&event.target===introTitle.querySelector('[data-activity-cover-line]:last-child')){
      titleShown=true;schedule();
    }
  }
  function update() {
    if (motion.matches) {
      snap = null;
      stopReveal();
      articleReveal.finishAll();
      heading.removeAttribute('data-activity-sticky');
      heading.style.removeProperty('--activity-heading-height');
      stage.removeAttribute('data-activity-panels-sticky');
      stage.removeAttribute('data-activity-slot');
      stage.removeAttribute('data-activity-slot-visible');
      section.removeAttribute('data-activity-viewport');
      items.forEach(item => { item.style.removeProperty('z-index'); });
      return;
    }
    const height = heading.getBoundingClientRect().height + 'px';
    if (heading.style.getPropertyValue('--activity-heading-height') !== height) {
      heading.style.setProperty('--activity-heading-height', height);
    }
    heading.dataset.activitySticky = '';
    // 子要素の高さには、スロット表示の拡大縮小や回転は含まれない。
    const cardHeight = Math.max(...items.map(item => Math.max(...[...item.querySelectorAll('.activity-name,.activity-copy')].map(el => parseFloat(getComputedStyle(el).height))) + 24));
    const pin = Math.min(96, Math.max(24, innerHeight * .07));
    const slot = 'IntersectionObserver' in window && innerWidth >= 1200 && innerHeight >= Math.max(600, cardHeight * 2.8 + pin * 2);
    const wasSlot=stage.hasAttribute('data-activity-slot');
    stage.toggleAttribute('data-activity-slot', slot);
    section.toggleAttribute('data-activity-viewport',slot);
    if (slot) {
      articleReveal.prepareAll();
      // フォント名が同じでも、読込完了によって実際の文字寸法は変わる。
      inkCache.clear();
      set(stage, '--activity-panel-inset', pin + 'px');
      set(stage, '--activity-slot-height', (innerHeight - pin * 2 - 2) + 'px');
      const reference = tagline.getBoundingClientRect().top - heading.getBoundingClientRect().top + inkInset(tagline);
      set(stage, '--activity-slot-anchor', reference + 'px');
      set(stage, '--activity-slot-bleed', pin + 'px');
      items.forEach(item => {
        const title = item.querySelector('h4'), number = item.querySelector('.activity-number');
        const titleInset = title.offsetTop + inkInset(title);
        set(item, '--slot-anchor-shift', (parseFloat(getComputedStyle(item).height)/2-titleInset) + 'px');
        set(item, '--slot-number-top', (titleInset-inkInset(number)) + 'px');
      });
      set(stage, '--activity-slot-pitch', (cardHeight * .91 + 32) + 'px');
      set(stage, '--activity-slot-step', Math.min(560, Math.max(240, innerHeight * .55)) + 'px');
      set(stage, '--activity-slot-dwell', Math.min(280, Math.max(160, innerHeight * .25)) + 'px');
    } else {
      snap = null;
      stopReveal();
      if(wasSlot)articleReveal.finishAll();
      stage.removeAttribute('data-activity-slot-visible');
      items.forEach(item => { item.style.removeProperty('z-index'); });
    }
    const contentHeight = Math.max(heading.getBoundingClientRect().height, list.getBoundingClientRect().height);
    const lead = Math.min(140, Math.max(80, innerHeight * .10));
    const step = slot ? parseFloat(stage.style.getPropertyValue('--activity-slot-step')) : Math.min(180, Math.max(80, innerHeight * .18));
    const hold = Math.min(240, Math.max(120, innerHeight * .20));
    set(stage, '--activity-panel-height', contentHeight + 'px');
    const rest = slot ? parseFloat(stage.style.getPropertyValue('--activity-slot-dwell')) * 3 : hold;
    const baseDistance = lead + step * 2 + rest;
    set(stage, '--activity-scroll-distance', baseDistance + 'px');
    stage.dataset.activityPanelsSticky = '';
    schedule();
  }
  try {
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(update);
      observer.observe(heading); observer.observe(list);
    }
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    introTitle.addEventListener('animationend',titleEnded);
    const headingObserver = new MutationObserver(schedule);
    headingObserver.observe(heading, { attributes: true, attributeFilter: ['data-activity-reveal'] });
    motion.addEventListener?.('change', update);
    if(restoreNavigation)window.addEventListener('pageshow',()=>{restorePageShown=true;readyToRestore();});
    Promise.resolve(document.fonts?.ready).then(()=>{
      if(restoreNavigation){restoreFontsReady=true;readyToRestore();}
      else update();
    });
    update();
  } catch {
    heading.removeAttribute('data-activity-sticky'); stage.removeAttribute('data-activity-panels-sticky');
    stage.removeAttribute('data-activity-slot'); stage.removeAttribute('data-activity-slot-visible');
    section.removeAttribute('data-activity-viewport');
  }
})();

// 活動項目は時間差ではなく、スクロール位置の境界に応じて表示する。
(() => {
  const list = document.querySelector('.activity-list');
  const heading = document.querySelector('.activity-heading');
  const title = heading?.querySelector('h2');
  const items = [...(list?.querySelectorAll('.activity-item') || [])];
  if (list?.closest('[data-activity-slot]')) return;
  if (!title || !items.length || !('IntersectionObserver' in window) ||
      typeof window.matchMedia !== 'function') return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;

  let frame, observer, headingObserver, layoutObserver, stopped = false;
  const deadlines = new Map();
  const pending = () => items.filter(item => item.dataset.activityItemReveal === 'pending');
  function show(item) {
    clearTimeout(deadlines.get(item));
    deadlines.delete(item);
    item.removeAttribute('data-activity-item-reveal');
    articleReveal.finish(item);
  }
  function finish() {
    if (stopped) return;
    const transferToSlot=!!list.closest('[data-activity-slot]');
    stopped = true;
    items.forEach(item=>{
      clearTimeout(deadlines.get(item));deadlines.delete(item);
      item.removeAttribute('data-activity-item-reveal');
      if(!transferToSlot)articleReveal.finish(item);
    });
    cancelAnimationFrame(frame);
    observer?.disconnect(); headingObserver?.disconnect(); layoutObserver?.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', suspend);
    window.removeEventListener('pageshow', schedule);
    document.removeEventListener('visibilitychange', hidden);
    motion.removeEventListener?.('change', reduced);
  }
  function reveal(item) {
    item.dataset.activityItemReveal = 'playing';
    const duration=articleReveal.play(item,()=>{show(item);settle();});
    deadlines.set(item, setTimeout(() => { show(item); settle(); }, duration+250));
  }
  function settle() {
    if (!items.some(item => item.hasAttribute('data-activity-item-reveal'))) finish();
  }
  function check() {
    frame = 0;
    if (stopped || document.hidden) return;
    if (list.closest('[data-activity-slot]')) { finish(); return; }
    const viewport = innerHeight;
    const maxScroll = document.documentElement.scrollHeight - viewport;
    if (maxScroll <= 1) { finish(); return; }
    const box = title.getBoundingClientRect();
    const desktop = matchMedia('(min-width: 1200px)').matches;
    // 見出しをほぼ通過すると、下方向の操作では導入の50%表示条件に再び達しないため、
    // その間も通常の活動一覧を閲覧できるようにする。
    const titlePastHalf = box.top < 0 && box.bottom < box.height * .5;
    const leftReady = !desktop || !heading.hasAttribute('data-activity-reveal') || titlePastHalf || box.bottom <= 0;
    // 固定表示された見出しの画面上の位置は動かないため、元のグリッド位置を基準にする。
    // 固定後の座標から表示開始の境界を求めない。
    const headingBox = heading.getBoundingClientRect();
    const layoutBox = heading.closest('.activity-stage').getBoundingClientRect();
    const layoutTop = layoutBox.top + scrollY;
    const pinTop = parseFloat(getComputedStyle(heading).top);
    const anchor = layoutTop + box.top - headingBox.top;
    const lead = Math.min(140, Math.max(80, viewport * .10));
    const firstGate = anchor - (Number.isFinite(pinTop) ? pinTop : viewport * .07) + lead;
    const step = Math.min(180, Math.max(80, viewport * .18));
    const eligible = [];
    pending().forEach(item => {
      const rect = item.getBoundingClientRect();
      if (rect.bottom <= 0) { show(item); return; }
      const index = items.indexOf(item);
      // 1カラムは各項目自身が画面高85%に入るのを待ち、導入の再生には依存させない。
      const entry = rect.top + scrollY - viewport * (desktop ? .82 : .85);
      const gate = Math.min(maxScroll, desktop ? Math.max(firstGate + index * step, entry) : entry);
      if (leftReady && scrollY >= gate && rect.top < viewport) {
        eligible.push(item);
      }
    });
    // 一度の移動で複数の境界を越えた場合、通過済みの内容はすぐ読める状態にし、
    // 最後に越えた項目だけに登場演出を適用する。
    eligible.forEach((item, index) => index < eligible.length - 1 ? show(item) : reveal(item));
    settle();
  }
  function schedule() { if (!stopped && !frame) frame = requestAnimationFrame(check); }
  function resize() {
    // アドレスバーの開閉などで高さが変わっても、画面外の未表示項目は完了にしない。
    if (list.closest('[data-activity-slot]')) { finish(); return; }
    schedule();
  }
  function suspend() { articleReveal.finishPlaying(); }
  function hidden() { if (document.hidden) suspend(); else schedule(); }
  function reduced(event) { if (event.matches) finish(); }

  try {
    articleReveal.prepareAll();
    items.forEach(item => { item.dataset.activityItemReveal = 'pending'; });
    observer = new IntersectionObserver(schedule, { threshold: [0, .18, 1] });
    items.forEach(item => observer.observe(item));
    headingObserver = new MutationObserver(schedule);
    headingObserver.observe(heading, { attributes: true, attributeFilter: ['data-activity-reveal'] });
    if ('ResizeObserver' in window) {
      layoutObserver = new ResizeObserver(schedule);
      layoutObserver.observe(document.querySelector('.about-activity-boundary') || list);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', schedule);
    document.addEventListener('visibilitychange', hidden);
    motion.addEventListener?.('change', reduced);
    document.fonts?.ready.then(schedule, finish);
    hidden(); schedule();
  } catch { finish(); }
})();
})();
