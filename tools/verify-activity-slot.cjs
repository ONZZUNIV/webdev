const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const lib=process.env.CODEX_NODE_MODULES?createRequire(path.join(process.env.CODEX_NODE_MODULES,'__verify-slot.cjs')):require;
const{chromium}=lib('playwright'),sharp=lib('sharp');
const partsOnly=process.argv.includes('--parts-only');
const viewportOnly=process.argv.includes('--viewport-only');
const out=path.join(root,partsOnly?'evidence/activity-item-parts-mobile':viewportOnly?'evidence/activity-viewport-debug':'evidence/activity-slot'),report={states:[],entryTiming:[],reload:[],replay:[],tryExit:[],mobileParts:[],fastEntry:[],fallback:[],layout:[],errors:[]};
function state(){
 function glyphTop(element){
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())&&!node.textContent.trim()){}
  const offset=node.textContent.search(/\S/),character=node.textContent[offset],range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+1);
  const box=range.getBoundingClientRect(),style=getComputedStyle(element),context=document.createElement('canvas').getContext('2d');
  context.font=[style.fontStyle,style.fontWeight,style.fontSize,style.fontFamily].join(' ');
  const m=context.measureText(character),ascent=m.fontBoundingBoxAscent??parseFloat(style.fontSize),descent=m.fontBoundingBoxDescent??0;
  return box.top+(box.height-ascent-descent)/2+ascent-m.actualBoundingBoxAscent;
 }
 const stage=document.querySelector('.activity-stage'),list=document.querySelector('.activity-list');
 return{slot:stage.hasAttribute('data-activity-slot'),visible:stage.hasAttribute('data-activity-slot-visible'),starting:stage.hasAttribute('data-activity-slot-starting'),origin:parseFloat(stage.style.getPropertyValue('--activity-slot-origin')),fit:parseFloat(stage.style.getPropertyValue('--activity-slot-fit')),stageHeight:stage.getBoundingClientRect().height,pageHeight:document.documentElement.scrollHeight,scroll:scrollY,progress:+stage.style.getPropertyValue('--activity-slot-progress'),index:stage.dataset.activitySlotIndex,listOpacity:+getComputedStyle(list).opacity,overflow:document.documentElement.scrollWidth-innerWidth,left:document.querySelector('.activity-heading').getBoundingClientRect().top,referenceInk:glyphTop(document.querySelector('.activity-tagline')),items:[...list.children].map(item=>{const r=item.getBoundingClientRect(),s=getComputedStyle(item);return{opacity:+s.opacity,parts:item.dataset.activityItemParts||'done',numberOpacity:+getComputedStyle(item.querySelector('.activity-number')).opacity,copyOpacity:+getComputedStyle(item.querySelector('.body-copy')).opacity,titlesHidden:[...item.querySelectorAll('h3,h4')].every(el=>getComputedStyle(el).opacity==='0'),center:(r.top+r.bottom)/2,top:r.top,bottom:r.bottom,titleInk:glyphTop(item.querySelector('h4')),numberInk:glyphTop(item.querySelector('.activity-number')),scale:+item.style.getPropertyValue('--slot-scale'),tilt:parseFloat(item.style.getPropertyValue('--slot-tilt')),transform:s.transform,position:s.position};})};
}
function geometry(){return [...document.querySelectorAll('main section,h1,h2,h3,h4,p,.activity-item')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return[el.className,el.textContent.replace(/\s+/g,''),r.x,r.y,r.width,r.height,s.font,s.margin,s.padding,s.color];});}
function readMetrics(){const s=document.querySelector('.activity-stage'),panel=document.querySelector('.activity-layout'),pin=parseFloat(getComputedStyle(panel).top),start=s.getBoundingClientRect().top+scrollY-pin+Math.min(140,Math.max(80,innerHeight*.1));return{start,natural:start,step:parseFloat(s.style.getPropertyValue('--activity-slot-step')),dwell:parseFloat(s.style.getPropertyValue('--activity-slot-dwell')),stage:s.getBoundingClientRect().top+scrollY,height:s.getBoundingClientRect().height,panelHeight:panel.getBoundingClientRect().height,pin,pageHeight:document.documentElement.scrollHeight};}
function outsideGeometry(delta={after:0,intro:0}){return [...document.querySelectorAll('.hero,.about,.about h1,.about p,.about .text-link,.news,.news h2,.news p,.connect,.connect h2,.connect p,.activity-heading,.activity-intro>h2,.activity-tagline,.activity-intro>.body-copy')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return[el.className,el.textContent.replace(/\s+/g,''),r.x,r.y-(el.closest('.news,.connect')?delta.after:el.closest('.activity-heading')?delta.intro:0),r.width,r.height,s.font,s.margin,s.padding,s.color];});}
async function main(){fs.mkdirSync(out,{recursive:true});const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=name==='/before.html'?path.join(root,'evidence/before-activity-slot/index.html'):name==='/before.css'?path.join(root,'evidence/before-activity-slot/styles.css'):name==='/before.js'?path.join(root,'evidence/before-activity-slot/activity-list-reveal.js'):path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});if(name==='/before.html')res.end(fs.readFileSync(file,'utf8').replace('href="styles.css"','href="before.css"').replace('src="activity-list-reveal.js"','src="before.js"'));else fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-lcd-text']});
try{
 async function open(width,height,options={},init){const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,...options});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.addInitScript(()=>{window.__articleEvents=[];window.__introEvents=[];for(const type of['animationstart','animationend'])document.addEventListener(type,e=>{if(e.target.closest('.activity-heading'))window.__introEvents.push({type,part:e.target.closest('h2')?'title':e.target.matches('.body-copy')?'copy':'other',name:e.animationName,time:performance.now()});const item=e.target.closest('.activity-item');if(!item)return;const part=e.target.matches('.activity-number')?'number':e.target.matches('.body-copy')?'copy':e.animationName==='about-cover-sweep'?'heading':'other';window.__articleEvents.push({type,index:[...item.parentElement.children].indexOf(item),part,name:e.animationName,time:performance.now()});});});if(init)await page.addInitScript(init);return{page,context};}
 async function load(page,route='/'){await page.goto(url+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);}
 async function scroll(page,y){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(80);}
 async function settledSnap(page){await page.waitForFunction(()=>{const s=document.querySelector('.activity-stage');return +s.style.getPropertyValue('--activity-slot-progress')===+s.dataset.activitySlotIndex;});}
 async function settledEntry(page){await page.waitForFunction(()=>{const s=document.querySelector('.activity-stage');return s.hasAttribute('data-activity-slot-visible')&&!s.hasAttribute('data-activity-slot-starting')&&getComputedStyle(document.querySelector('.activity-list')).opacity==='1';});await page.waitForTimeout(35);}
 for(const[width,height]of (partsOnly||viewportOnly?[]:[[1440,900],[1920,1080],[1280,800],[1200,800]])){
  const{page,context}=await open(width,height);await load(page,'/before.html');
  const beforeLayout=await page.evaluate(outsideGeometry),beforeHeight=await page.evaluate(()=>document.querySelector('.activity').getBoundingClientRect().height),beforeIntro=await page.evaluate(()=>document.querySelector('.activity-heading').getBoundingClientRect().top);
  await load(page);const addedHeight=await page.evaluate(()=>document.querySelector('.activity').getBoundingClientRect().height)-beforeHeight;
  const introDelta=await page.evaluate(()=>document.querySelector('.activity-heading').getBoundingClientRect().top)-beforeIntro;
  const outsideUnchanged=JSON.stringify(beforeLayout)===JSON.stringify(await page.evaluate(outsideGeometry,{after:addedHeight,intro:introDelta}));
  const metrics=await page.evaluate(readMetrics);
  await scroll(page,metrics.start-40);await page.waitForFunction(()=>!document.querySelector('.activity-heading').hasAttribute('data-activity-reveal'));const before=await page.evaluate(state);
  await scroll(page,Math.ceil(metrics.start));await settledEntry(page);
  metrics.naturalStart=metrics.start;
  metrics.start=await page.evaluate(()=>parseFloat(document.querySelector('.activity-stage').style.getPropertyValue('--activity-slot-origin')));
  metrics.height=await page.evaluate(()=>document.querySelector('.activity-stage').getBoundingClientRect().height);
  const checkpoints=[];
  for(const progress of[0,.5,1,1.5,2]){
   // Rounded page scroll positions approximate the exact fractional start.
   const turn=Math.floor(progress),fraction=progress-turn;
   const offset=turn*(metrics.dwell+metrics.step)+(fraction?metrics.dwell+fraction*metrics.step:metrics.dwell*.5);
   await scroll(page,Math.ceil(metrics.start+offset));await settledSnap(page);await page.waitForTimeout(progress===0?500:100);
   if(Number.isInteger(progress)&&progress>0){await page.screenshot({path:path.join(out,`${width}-cover-${progress}.png`)});await page.waitForFunction(index=>!document.querySelectorAll('.activity-item')[index].hasAttribute('data-activity-item-parts'),progress);}
   const s=await page.evaluate(state);await page.screenshot({path:path.join(out,`${width}-${progress}.png`)});
   let passed=s.slot&&s.visible&&s.overflow===0&&s.listOpacity===1&&s.progress===Math.ceil(progress);
   if(Number.isInteger(progress)){const a=s.items[progress];passed=passed&&Math.abs(a.titleInk-s.referenceInk)<1&&Math.abs(a.numberInk-s.referenceInk)<1&&Math.abs(a.scale-1)<.002&&Math.abs(a.tilt)<.03&&a.opacity>.998;
    passed=passed&&a.parts==='done'&&a.numberOpacity===1&&a.copyOpacity===1&&s.items.every((item,i)=>i>progress?item.parts==='pending'&&item.numberOpacity===0&&item.copyOpacity===0&&item.titlesHidden:true);
    passed=passed&&s.items.every((item,i)=>Math.abs(i-progress)===1?Math.abs(item.scale-.82)<.002&&item.opacity>.69&&item.opacity<.71:Math.abs(i-progress)===2?item.opacity===0:true);}
   checkpoints.push({progress,...s,passed});
  }
  const stopped=await page.evaluate(state);await page.waitForTimeout(450);const still=await page.evaluate(state);
  const fit=await page.evaluate(()=>+document.querySelector('.activity-stage').style.getPropertyValue('--activity-slot-fit'));
  const position=raw=>metrics.start+(raw===0?metrics.dwell*.5:Math.floor(raw)*(metrics.step+metrics.dwell)+metrics.dwell+(raw%1)*metrics.step)*fit;
  const snapChecks=[];
  for(const[raw,expected]of[[0,0],[.4,0],[.5,1],[.4,1],[.34,0],[.4,0],[.46,1],[1.5,2],[1.4,2],[1.34,1]]){
   await scroll(page,position(raw));const moving=await page.evaluate(state);
   await settledSnap(page);const settled=await page.evaluate(state);
   snapChecks.push({raw,expected,moving:moving.progress,settled:settled.progress,scroll:[moving.scroll,settled.scroll],passed:settled.progress===expected&&settled.scroll===moving.scroll&&Math.abs(settled.items[expected].titleInk-settled.referenceInk)<1});
  }
  await scroll(page,position(0));await settledSnap(page);await scroll(page,position(.4));
  await page.mouse.wheel(0,Math.ceil(metrics.step*.10*fit));await page.waitForTimeout(90);const wheelDuring=await page.evaluate(state);
  await settledSnap(page);const wheelAfter=await page.evaluate(state);
  const wheelSnap=wheelDuring.progress>0&&wheelDuring.progress<1&&wheelAfter.progress===1&&wheelAfter.scroll===wheelDuring.scroll;
  await page.screenshot({path:path.join(out,`${width}-snapped.png`)});
  await scroll(page,position(0));await settledSnap(page);await scroll(page,position(.5));const turning=await page.evaluate(state);
  await scroll(page,position(.3));const reversing=await page.evaluate(state);await settledSnap(page);const reversed=await page.evaluate(state);
  const interruptedTurn=turning.progress>0&&turning.progress<1&&reversing.progress>0&&reversing.progress<turning.progress&&reversed.progress===0&&reversed.scroll===reversing.scroll;
  const rests=[];
  for(let index=0;index<3;index++){
   await scroll(page,Math.ceil(metrics.start+index*(metrics.dwell+metrics.step)+metrics.dwell*.15));await settledSnap(page);const a=await page.evaluate(state);
   await scroll(page,Math.floor(metrics.start+index*(metrics.dwell+metrics.step)+metrics.dwell*.85));await settledSnap(page);const b=await page.evaluate(state);
   rests.push({index,scrollDistance:metrics.dwell*.70,titleGap:b.items[index].titleInk-b.referenceInk,numberGap:b.items[index].numberInk-b.referenceInk,passed:a.progress===index&&b.progress===index&&Math.abs(a.items[index].center-b.items[index].center)<.01&&Math.abs(b.items[index].titleInk-b.referenceInk)<1&&Math.abs(b.items[index].numberInk-b.referenceInk)<1});
  }
  await scroll(page,Math.ceil(metrics.start+metrics.dwell+metrics.step+metrics.dwell*.5));await settledSnap(page);const reverse=await page.evaluate(state);
  const end=metrics.stage+metrics.height-metrics.panelHeight-metrics.pin;
  await scroll(page,end-2);await settledSnap(page);const beforeEnd=await page.evaluate(state);
  await scroll(page,end+40);const afterEnd=await page.evaluate(state);
  const viewportPanel=await page.evaluate(()=>{const panel=document.querySelector('.activity-layout').getBoundingClientRect(),news=document.querySelector('.news').getBoundingClientRect();return{height:panel.height,viewport:innerHeight,bottom:panel.bottom,newsTop:news.top};});
  const releasesTogether=beforeEnd.progress===2&&afterEnd.progress===2&&Math.abs((beforeEnd.left-afterEnd.left)-40)<1&&Math.abs((beforeEnd.items[2].titleInk-afterEnd.items[2].titleInk)-40)<1&&Math.abs(afterEnd.items[2].titleInk-afterEnd.referenceInk)<1;
  await scroll(page,end-2);const reenter=await page.evaluate(state);
  const repins=Math.abs(reenter.left-beforeEnd.left)<1&&reenter.progress===2;
  await scroll(page,metrics.stage+metrics.height-metrics.panelHeight-metrics.pin+80);const release=await page.evaluate(()=>document.querySelector('.activity-layout').getBoundingClientRect().top);
  await scroll(page,await page.evaluate(()=>document.querySelector('.news').getBoundingClientRect().top+scrollY));const noLeak=await page.evaluate(()=>document.querySelector('.activity-list').getBoundingClientRect().bottom<0);
  const events=await page.evaluate(()=>window.__articleEvents);
  const sequences=[0,1,2].map(index=>{const starts=events.filter(e=>e.index===index&&e.type==='animationstart'),number=starts.filter(e=>e.part==='number'),head=starts.find(e=>e.part==='heading'),copy=starts.find(e=>e.part==='copy'),copyEnd=events.find(e=>e.index===index&&e.type==='animationend'&&e.part==='copy');return{index,number,head,copy,copyEnd,passed:number.length===1&&!!head&&!!copy&&!!copyEnd&&head.time-number[0].time>=70&&copy.time-head.time>=300};});
  const sequential=sequences.every(s=>s.passed)&&sequences.slice(1).every((s,i)=>s.number[0].time>=sequences[i].copyEnd.time);
  const panelFits=Math.abs(viewportPanel.height-height)<1&&Math.abs(viewportPanel.bottom-viewportPanel.newsTop)<1&&Math.abs(viewportPanel.newsTop-(height-40))<1;
  const item={width,height,metrics,addedHeight,outsideUnchanged,before,checkpoints,snapChecks,wheelSnap,interruptedTurn,rests,sequences,sequential,beforeEnd,afterEnd,viewportPanel,panelFits,releasesTogether,repins,stops:JSON.stringify(stopped)===JSON.stringify(still),reverses:Math.abs(reverse.items[1].titleInk-reverse.referenceInk)<1,releases:release<metrics.pin-60,noLeak};item.passed=panelFits&&sequential&&outsideUnchanged&&!before.visible&&checkpoints.every(s=>s.passed)&&snapChecks.every(s=>s.passed)&&wheelSnap&&interruptedTurn&&rests.every(s=>s.passed)&&item.stops&&item.reverses&&item.releases&&releasesTogether&&repins&&noLeak;report.states.push(item);console.log(JSON.stringify({width,passed:item.passed,wheelSnap,interruptedTurn,panelFits,sequential,outsideUnchanged,releasesTogether,repins}));await context.close();
 }
 for(const[width,height]of (viewportOnly?[]:[[390,844],[800,600]])){
  const{page,context}=await open(width,height);await load(page);
  const y=await page.evaluate(()=>document.querySelector('.activity-item').getBoundingClientRect().top+scrollY-innerHeight*.35);
  await scroll(page,y);
  try{await page.waitForFunction(()=>document.querySelector('.activity-item').dataset.activityItemParts==='playing',null,{timeout:3000});}
  catch{const s=await page.evaluate(state);console.log(JSON.stringify({width,missingPlay:s,events:await page.evaluate(()=>window.__articleEvents)}));report.mobileParts.push({width,passed:false,state:s});await context.close();continue;}
  await page.waitForTimeout(50);
  const during=await page.evaluate(state);
  await page.waitForTimeout(220);await page.screenshot({path:path.join(out,'parts-mobile-'+width+'.png')});
  await page.waitForFunction(()=>!document.querySelector('.activity-item').hasAttribute('data-activity-item-parts'));
  const after=await page.evaluate(state),events=await page.evaluate(()=>window.__articleEvents.filter(e=>e.index===0&&e.type==='animationstart'));
  const number=events.find(e=>e.part==='number'),head=events.find(e=>e.part==='heading'),copy=events.find(e=>e.part==='copy');
  const item={width,height,during,after,events,passed:!after.slot&&during.items[0].numberOpacity>0&&during.items[0].copyOpacity===0&&after.items[0].copyOpacity===1&&after.items[1].parts==='pending'&&!!number&&!!head&&!!copy&&number.time<head.time&&head.time<copy.time&&after.overflow===0};
  report.mobileParts.push(item);console.log(JSON.stringify({width,mobileParts:item.passed,during:during.items.map(i=>({parts:i.parts,number:i.numberOpacity,copy:i.copyOpacity})),after:after.items.map(i=>i.parts),events}));await context.close();
 }
 // Cross the old Meet Up threshold during the left animation, and continue
 // scrolling during the right opacity reveal. Learning must finish its entrance
 // before the next item. The fixed track must never retain that waiting distance.
 for(const[width,height]of (partsOnly||viewportOnly?[]:[[1440,900],[1920,1080]])){
  const{page,context}=await open(width,height);await load(page);
  const m=await page.evaluate(readMetrics);
  await scroll(page,m.natural+(m.step+m.dwell)*1.2);
  const duringLeft=await page.evaluate(state);
  await page.waitForFunction(()=>document.querySelector('.activity-stage').hasAttribute('data-activity-slot-starting'));
  const duringFade=await page.evaluate(state);
  const target=await page.evaluate(()=>scrollY)+m.dwell*.7;
  await scroll(page,target);await settledEntry(page);await settledSnap(page);const first=await page.evaluate(state);
  await page.screenshot({path:path.join(out,'fast-entry-'+width+'.png')});
  await scroll(page,first.origin+m.dwell*.8*first.fit);await settledSnap(page);const resting=await page.evaluate(state);
  const gates=[];
  for(const [raw,expected]of[[.3,0],[.46,1],[.34,0]]){
   const y=m.natural+m.dwell+raw*m.step;await scroll(page,y);await settledSnap(page);const s=await page.evaluate(state);
   gates.push({raw,expected,index:s.index,scroll:s.scroll,origin:s.origin,fit:s.fit,passed:+s.index===expected&&s.origin===m.natural&&s.fit===1&&Math.abs(s.scroll-Math.round(y))<1});
  }
  await scroll(page,first.origin+(2*(m.step+m.dwell)+m.dwell*.5)*first.fit);await settledSnap(page);const last=await page.evaluate(state);
  await scroll(page,m.natural-40);await scroll(page,first.origin+m.dwell*.5*first.fit);await settledSnap(page);const returned=await page.evaluate(state);
  const events=await page.evaluate(()=>window.__articleEvents),learningEnd=events.find(e=>e.index===0&&e.part==='copy'&&e.type==='animationend'),nextStart=events.find(e=>e.index===1&&e.part==='number'&&e.type==='animationstart');
  const item={width,height,duringLeft,duringFade,first,resting,gates,learningEnd,nextStart,last,returned,extraTrack:first.stageHeight-m.height};
  item.passed=!duringLeft.visible&&duringLeft.progress===0&&duringFade.progress===0&&!!learningEnd&&!!nextStart&&nextStart.time>=learningEnd.time&&first.progress===1&&first.listOpacity===1&&Math.abs(first.scroll-Math.round(target))<1&&first.origin===m.natural&&item.extraTrack===0&&first.pageHeight===m.pageHeight&&first.fit===1&&resting.progress===0&&gates.every(g=>g.passed)&&last.progress===2&&Math.abs(last.items[2].titleInk-last.referenceInk)<1&&returned.progress===0&&returned.origin===first.origin&&returned.stageHeight===m.height&&returned.pageHeight===m.pageHeight;
  report.fastEntry.push(item);console.log(JSON.stringify({width,fastEntry:item.passed,extraTrack:item.extraTrack,origin:first.origin,scroll:first.scroll}));await context.close();
 }
 for(const[width,height]of(partsOnly?[]:[[1440,900],[1920,1080]])){
  const{page,context}=await open(width,height);await load(page);const m=await page.evaluate(readMetrics);
  await scroll(page,Math.ceil(m.start));await page.waitForFunction(()=>document.querySelector('.activity-stage').hasAttribute('data-activity-slot-starting'));
  const leftStillPlaying=await page.evaluate(()=>document.querySelector('.activity-heading').dataset.activityReveal==='playing');
  await settledEntry(page);const first=await page.evaluate(state);await page.waitForFunction(()=>!document.querySelector('.activity-heading').hasAttribute('data-activity-reveal'));
  const incoming=[];
  for(const progress of[.5,1.5]){
    const turn=Math.floor(progress),offset=turn*(m.step+m.dwell)+m.dwell+m.step*.5;
    await scroll(page,first.origin+offset*first.fit);await page.waitForFunction(index=>document.querySelectorAll('.activity-item')[index].dataset.activityItemParts==='playing',turn+1);
    const s=await page.evaluate(state);incoming.push({progress:s.progress,index:turn+1,parts:s.items[turn+1].parts});
    await page.waitForFunction(index=>!document.querySelectorAll('.activity-item')[index].hasAttribute('data-activity-item-parts'),turn+1);
  }
  const events=await page.evaluate(()=>({intro:window.__introEvents,article:window.__articleEvents}));
  const titleEnd=events.intro.find(e=>e.type==='animationend'&&e.part==='title'&&e.name==='about-cover-sweep'),leftCopyEnd=events.intro.find(e=>e.type==='animationend'&&e.part==='copy');
  const numberStart=events.article.find(e=>e.type==='animationstart'&&e.index===0&&e.part==='number'),copyEnd=events.article.find(e=>e.type==='animationend'&&e.index===0&&e.part==='copy');
  const item={width,height,leftStillPlaying,titleEnd,leftCopyEnd,numberStart,copyEnd,incoming,passed:leftStillPlaying&&!!titleEnd&&!!leftCopyEnd&&!!numberStart&&!!copyEnd&&numberStart.time>=titleEnd.time&&copyEnd.time<leftCopyEnd.time&&incoming.every(s=>s.parts==='playing'&&s.progress<s.index)};
  report.entryTiming.push(item);console.log(JSON.stringify({entryTiming:width,passed:item.passed,earlierBy:leftCopyEnd?.time-numberStart?.time,incoming}));await context.close();
 }
 for(const late of(partsOnly?[]:[false,true])){
  const width=1440,height=900,{page,context}=await open(width,height);await load(page);const m=await page.evaluate(readMetrics);
  if(late)await scroll(page,m.start+(m.step+m.dwell)*1.1);
  else{await scroll(page,m.start-40);await page.waitForFunction(()=>!document.querySelector('.activity-heading').hasAttribute('data-activity-reveal'));await scroll(page,Math.ceil(m.start));}
  await settledEntry(page);const first=await page.evaluate(state);
  const target=first.origin+(m.step+m.dwell+m.dwell*.5)*first.fit;
  await scroll(page,target);await page.waitForFunction(()=>!document.querySelectorAll('.activity-item')[1].hasAttribute('data-activity-item-parts'));const before=await page.evaluate(state);
  await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await settledEntry(page);await page.waitForFunction(()=>!document.querySelectorAll('.activity-item')[1].hasAttribute('data-activity-item-parts'));const after=await page.evaluate(state);
  await page.screenshot({path:path.join(out,'reload-meetup-'+(late?'late':'normal')+'.png')});
  const events=await page.evaluate(()=>window.__articleEvents);
  const hysteresisReload=[];
  for(const [raw,expected]of[[.4,1],[.3,0],[.4,0]]){
   await scroll(page,after.origin+(m.dwell+raw*m.step)*after.fit);await settledSnap(page);const a=await page.evaluate(state);
   await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await settledEntry(page);await settledSnap(page);const b=await page.evaluate(state);
   hysteresisReload.push({raw,expected,before:a.progress,after:b.progress,passed:a.progress===expected&&b.progress===expected&&a.scroll===b.scroll&&a.pageHeight===b.pageHeight&&a.origin===b.origin});
  }
  await scroll(page,after.origin+m.dwell*.5*after.fit);await settledSnap(page);const learning=await page.evaluate(state);
  const currentReveal=events.filter(e=>e.type==='animationstart'&&e.part==='number'&&e.index===1).length===1&&!events.some(e=>e.index===0);
  const item={late,before,after,learning,events,currentReveal,hysteresisReload,passed:currentReveal&&hysteresisReload.every(s=>s.passed)&&Math.abs(before.progress-1)<.002&&Math.abs(after.progress-1)<.002&&Math.abs(before.scroll-after.scroll)<1&&Math.abs(before.origin-after.origin)<1&&Math.abs(before.fit-after.fit)<.00001&&before.pageHeight===after.pageHeight&&before.stageHeight===after.stageHeight&&!after.starting&&after.items[2].parts==='pending'&&learning.progress===0};
  report.reload.push(item);console.log(JSON.stringify({reloadMeetUp:!late?'normal':'late',passed:item.passed,before:before.progress,after:after.progress,fit:[before.fit,after.fit]}));await context.close();
 }
 for(const kind of(partsOnly?[]:['top-reload','resize-before-entry','grow-before-entry'])){
  const{page,context}=await open(1440,kind==='grow-before-entry'?500:900);await load(page);
  if(kind==='top-reload'){
    const old=await page.evaluate(readMetrics);await scroll(page,old.start-40);await page.waitForFunction(()=>!document.querySelector('.activity-heading').hasAttribute('data-activity-reveal'));await scroll(page,Math.ceil(old.start));await settledEntry(page);
    const first=await page.evaluate(state);
    for(const i of[1,2]){await scroll(page,first.origin+(i*(old.step+old.dwell)+old.dwell*.4)*first.fit);await page.waitForFunction(index=>!document.querySelectorAll('.activity-item')[index].hasAttribute('data-activity-item-parts'),i);}
    await scroll(page,0);await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(120);
  }else{
    if(kind==='resize-before-entry'){await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(100);}
    await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(150);
  }
  const pending=await page.evaluate(state),m=await page.evaluate(readMetrics);
  await scroll(page,m.start-40);await page.waitForFunction(()=>!document.querySelector('.activity-heading').hasAttribute('data-activity-reveal'));await scroll(page,Math.ceil(m.start));await page.waitForFunction(()=>document.querySelector('.activity-item').dataset.activityItemParts==='playing');const playing=await page.evaluate(state);
  await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'reveal-'+kind+'.png')});await settledEntry(page);const first=await page.evaluate(state);
  for(const i of[1,2]){await scroll(page,first.origin+(i*(m.step+m.dwell)+m.dwell*.4)*first.fit);await page.waitForFunction(index=>!document.querySelectorAll('.activity-item')[index].hasAttribute('data-activity-item-parts'),i);}
  const events=await page.evaluate(()=>window.__articleEvents),numbers=events.filter(e=>e.type==='animationstart'&&e.part==='number');
  const item={kind,pending,playing,events,passed:pending.items.every(i=>i.parts==='pending')&&playing.items[0].parts==='playing'&&playing.items[1].parts==='pending'&&[0,1,2].every(i=>numbers.filter(e=>e.index===i).length===1)};
  report.replay.push(item);console.log(JSON.stringify({revealRestored:kind,passed:item.passed,initial:pending.items.map(i=>i.parts),numbers:numbers.map(e=>e.index)}));await context.close();
 }
 for(const[width,height]of(partsOnly?[]:[[1440,900],[1920,1080]])){
  const{page,context}=await open(width,height);await load(page);const m=await page.evaluate(readMetrics);
  await scroll(page,m.start-40);await page.waitForFunction(()=>!document.querySelector('.activity-heading').hasAttribute('data-activity-reveal'));await scroll(page,Math.ceil(m.start));await settledEntry(page);const first=await page.evaluate(state);
  await scroll(page,first.origin+(m.step+m.dwell+m.dwell+m.step*.92)*first.fit);await page.waitForFunction(()=>document.querySelectorAll('.activity-item')[2].dataset.activityItemParts==='playing');const before=await page.evaluate(state);
  await scroll(page,m.stage+m.height-m.panelHeight-m.pin+30);const crossing=await page.evaluate(state);
  await page.waitForTimeout(100);const during=await page.evaluate(state);await page.screenshot({path:path.join(out,'try-exit-'+width+'.png')});
  await page.waitForFunction(()=>!document.querySelectorAll('.activity-item')[2].hasAttribute('data-activity-item-parts'));const after=await page.evaluate(state);
  const item={width,height,before,crossing,during,after,passed:before.items[2].parts==='playing'&&crossing.items[2].parts==='playing'&&during.items[2].parts==='playing'&&during.items[2].copyOpacity<1&&after.items[2].parts==='done'&&after.items[2].copyOpacity===1&&during.left<first.left-20&&after.stageHeight===first.stageHeight};
  report.tryExit.push(item);console.log(JSON.stringify({tryExit:width,passed:item.passed,parts:[before.items[2].parts,crossing.items[2].parts,during.items[2].parts,after.items[2].parts]}));await context.close();
 }
 for(const kind of(partsOnly||viewportOnly?[]:['no-js','reduced','no-io','fast-skip','mid-load','whole-skip','exit-during-reveal','no-animation-events','resize-small','resize-back','motion-change','short'])){
  const init=kind==='no-io'?()=>{delete window.IntersectionObserver;}:kind==='no-animation-events'?()=>{const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,...args){if(this instanceof Element&&this.matches('.activity-list')&&type==='animationend')return;return add.call(this,type,...args);};}:null;
  const{page,context}=await open(1440,kind==='short'?500:900,kind==='no-js'?{javaScriptEnabled:false}:kind==='reduced'?{reducedMotion:'reduce'}:{},init);await load(page);
  if(['fast-skip','mid-load','exit-during-reveal','no-animation-events'].includes(kind)){const m=await page.evaluate(readMetrics),y=m.start+2*(m.step+m.dwell)+m.dwell*.4;await scroll(page,y);if(kind==='mid-load')await page.reload({waitUntil:'networkidle'});if(kind==='exit-during-reveal'){await page.waitForFunction(()=>document.querySelector('.activity-stage').hasAttribute('data-activity-slot-starting'));await scroll(page,await page.evaluate(()=>document.querySelector('.news').getBoundingClientRect().top+scrollY+20));}await settledEntry(page);}
  if(kind==='whole-skip'){await scroll(page,await page.evaluate(()=>document.querySelector('.news').getBoundingClientRect().top+scrollY+20));await settledEntry(page);}
  if(['resize-small','resize-back'].includes(kind)){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);if(kind==='resize-back'){await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(150);}}
  if(kind==='motion-change')await page.emulateMedia({reducedMotion:'reduce'});
  if(kind==='short'){await scroll(page,await page.evaluate(()=>document.querySelector('.news').getBoundingClientRect().top+scrollY));await page.waitForTimeout(800);}
  const s=await page.evaluate(state);const ordinary=['no-js','reduced','no-io','resize-small','motion-change','short'].includes(kind);
  if(!ordinary&&kind!=='resize-back')await settledSnap(page);
  const expected=['fast-skip','mid-load','whole-skip','exit-during-reveal','no-animation-events'].includes(kind)?'2':'0';
  const passed=ordinary?!s.slot&&s.items.every(i=>i.position!=='absolute'&&i.opacity===1)&&s.overflow===0:s.slot&&s.overflow===0&&(kind==='resize-back'||s.visible&&s.index===expected&&!s.starting);report.fallback.push({kind,...s,passed});console.log(JSON.stringify({kind,passed}));await context.close();
 }
 // Existing mobile/tablet layout must be pixel-identical to the previous build.
 for(const width of(partsOnly||viewportOnly?[]:[320,390,600,800,1024])){const{page,context}=await open(width,900);const captures=[];for(const route of['/before.html','/']){await load(page,route);const height=await page.evaluate(()=>document.documentElement.scrollHeight);await page.setViewportSize({width,height});await page.waitForFunction(()=>!document.querySelector('[data-about-reveal],[data-activity-reveal],[data-activity-item-reveal]'));await scroll(page,0);captures.push({geometry:await page.evaluate(geometry),image:await page.screenshot()});}
 const a=await sharp(captures[0].image).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(captures[1].image).ensureAlpha().raw().toBuffer();let pixels=0,max=0;for(let i=0;i<a.data.length;i+=4){let d=false;for(let c=0;c<4;c++){const v=Math.abs(a.data[i+c]-b[i+c]);if(v)d=true;max=Math.max(max,v);}if(d)pixels++;}const item={width,sameLayout:JSON.stringify(captures[0].geometry)===JSON.stringify(captures[1].geometry),pixels,max};item.passed=item.sameLayout&&(max<=1||max<=16&&pixels/(a.info.width*a.info.height)<=.0001);report.layout.push(item);console.log(JSON.stringify(item));await context.close();}
 const hashes=JSON.parse(fs.readFileSync(path.join(root,'evidence/before-activity-slot/unchanged-scripts.json'),'utf8'));report.existingScriptsUnchanged=hashes.every(r=>crypto.createHash('sha256').update(fs.readFileSync(r.Path)).digest('hex').toUpperCase()===r.Hash);
 report.passed=report.existingScriptsUnchanged&&!report.errors.length&&report.states.every(s=>s.passed)&&report.entryTiming.every(s=>s.passed)&&report.reload.every(s=>s.passed)&&report.replay.every(s=>s.passed)&&report.tryExit.every(s=>s.passed)&&report.mobileParts.every(s=>s.passed)&&report.fastEntry.every(s=>s.passed)&&report.fallback.every(s=>s.passed)&&report.layout.every(s=>s.passed);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,errors:report.errors,unchanged:report.existingScriptsUnchanged}));if(!report.passed)process.exitCode=1;
}finally{await browser.close();await new Promise(r=>server.close(r));}}
main().catch(e=>{console.error(e);process.exitCode=1;});
