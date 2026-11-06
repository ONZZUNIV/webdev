const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const lib=process.env.CODEX_NODE_MODULES?createRequire(path.join(process.env.CODEX_NODE_MODULES,'connect-test.cjs')):require;
const {chromium}=lib('playwright'),sharp=lib('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/connect'),report={layout:[],motion:[],fallback:[],errors:[]};
function geometry(){return [...document.querySelectorAll('.hero,main section,main h1,main h2,main h3,main h4,main p,main a,main img,.connect-columns,.connect-divider,.connect-card,.footer-placeholder')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return[el.className,el.textContent,r.x,r.y+scrollY,r.width,r.height,s.font,s.margin,s.padding,s.color];});}
function state(){
 const section=document.querySelector('.connect'),banner=section.querySelector('.connect-banner>span'),r=document.createRange();r.selectNodeContents(banner);const ink=r.getBoundingClientRect();
 const box=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{rect:[r.x,r.y+scrollY,r.width,r.height],opacity:+s.opacity,transform:s.transform,animation:s.animationName,delay:s.animationDelay};};
 return{header:section.dataset.connectReveal||'done',covers:section.querySelectorAll('[data-connect-cover-line]').length,banner:box(banner),bannerInk:[ink.x,ink.y+scrollY,ink.width,ink.height],bannerClip:getComputedStyle(banner).clipPath,scroll:scrollY,overflow:document.documentElement.scrollWidth-innerWidth,cards:[...section.querySelectorAll('.connect-card')].map(card=>({state:card.dataset.connectCardReveal||'done',title:box(card.querySelector('h3')),copy:box(card.querySelector('p')),button:box(card.querySelector('a'))}))};
}
async function main(){
 fs.mkdirSync(out,{recursive:true});const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.ttf':'font/ttf'};
 // The approved white CONNECT replaces the historical blue reference.
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),reference={'/before.html':'index.html','/before.css':'styles.css','/before-connect.css':'connect.css'}[name];const file=reference?path.join(root,'evidence/connect-adoption/approved',reference):path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});if(name==='/before.html')res.end(fs.readFileSync(file,'utf8').replace('href="styles.css"','href="before.css"').replace('href="connect.css"','href="before-connect.css"'));else fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-lcd-text']});
 try{
  async function open(width,height=900,options={},init){const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,...options}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});await page.addInitScript(()=>{window.connectEvents=[];for(const type of['animationstart','animationend'])document.addEventListener(type,e=>{if(!e.target.closest('.connect'))return;const card=e.target.closest('.connect-card');window.connectEvents.push({type,name:e.animationName,part:card?(card.classList.contains('students')?'students':'partners')+'-'+(e.target.matches('h3')?'title':e.target.matches('p')?'copy':e.target.matches('.connect-button')?'button':'index'):e.target.matches('[data-connect-cover-line]')?'cover':e.target.matches('.connect-subtitle')?'subtitle':'banner',time:performance.now()});});});if(init)await page.addInitScript(init);return{context,page};}
  async function load(page,route='/'){await page.goto(url+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);}
  async function enter(page,selector,fraction=.65){await page.evaluate(({selector,fraction})=>{const r=document.querySelector(selector).getBoundingClientRect();scrollTo(0,r.top+scrollY-innerHeight*fraction);},{selector,fraction});}
  for(const width of[320,390,600,800,1024,1200,1440,1600,1920]){
   const {context,page}=await open(width,900,{reducedMotion:'reduce'}),captures=[];
   for(const route of['/before.html','/']){await load(page,route);captures.push({geometry:await page.evaluate(geometry),image:await page.locator('.connect').screenshot()});}
   const before=await sharp(captures[0].image).ensureAlpha().raw().toBuffer(),after=await sharp(captures[1].image).ensureAlpha().raw().toBuffer();
   let max=0,pixels=0;for(let i=0;i<before.length;i+=4){let changed=false;for(let c=0;c<4;c++){const d=Math.abs(before[i+c]-after[i+c]);max=Math.max(max,d);if(d)changed=true;}if(changed)pixels++;}
   fs.writeFileSync(path.join(out,`connect-${width}.png`),captures[1].image);
   const s=await page.evaluate(state),sameGeometry=JSON.stringify(captures[0].geometry)===JSON.stringify(captures[1].geometry),passed=sameGeometry&&!s.overflow&&before.length===after.length&&max<=1;
   report.layout.push({width,sameGeometry,pixels,max,passed});console.log(JSON.stringify({width,layout:passed,pixels,max}));await context.close();
  }
  for(const [width,height]of[[390,844],[800,900],[1440,900],[1920,1080]]){
   const {context,page}=await open(width,height);await load(page);const pending=await page.evaluate(state);
   await enter(page,'.connect-banner',.70);await page.waitForFunction(()=>document.querySelector('.connect').dataset.connectReveal==='playing');await page.waitForTimeout(220);const during=await page.evaluate(state);
   const covers=await page.locator('[data-connect-cover-line]').evaluateAll(lines=>lines.map(line=>({width:line.offsetWidth,height:line.offsetHeight,fontSize:parseFloat(getComputedStyle(line.parentElement).fontSize),parentWidth:line.parentElement.clientWidth,color:getComputedStyle(line,'::after').backgroundColor,delay:line.style.getPropertyValue('--connect-line-delay')})));
   await page.screenshot({path:path.join(out,`cover-${width}.png`)});
   await page.waitForFunction(()=>!document.querySelector('.connect').hasAttribute('data-connect-reveal'));const headerDone=await page.evaluate(state);
   await enter(page,'.students',.65);await page.waitForFunction(()=>document.querySelector('.students').dataset.connectCardReveal==='playing');await page.waitForTimeout(50);const cardsDuring=await page.evaluate(state);
   await page.screenshot({path:path.join(out,`cards-${width}.png`)});
   await page.waitForFunction(()=>!document.querySelector('.students').hasAttribute('data-connect-card-reveal'));
   const studentsDone=await page.evaluate(state);
   if(width<1000){await enter(page,'.partners',.65);await page.waitForFunction(()=>document.querySelector('.partners').dataset.connectCardReveal==='playing');}
   await page.waitForFunction(()=>document.querySelector('.connect').dataset.connectRevealed==='true');const done=await page.evaluate(state),events=await page.evaluate(()=>window.connectEvents);
   await page.evaluate(()=>scrollTo(0,0));await enter(page,'.students',.5);await page.waitForTimeout(200);const repeated=await page.evaluate(()=>window.connectEvents);
   const banner=events.find(e=>e.type==='animationstart'&&e.part==='banner'),cover=events.find(e=>e.type==='animationstart'&&e.part==='cover'&&e.name==='about-cover-sweep');
   const timings=['students','partners'].map(name=>{const title=events.filter(e=>e.type==='animationstart'&&e.part===name+'-title'),copy=events.find(e=>e.type==='animationstart'&&e.part===name+'-copy'),button=events.find(e=>e.type==='animationstart'&&e.part===name+'-button');return{name,title,copy,button,passed:title.length===1&&copy&&button&&Math.abs(title[0].time-copy.time)<2&&button.time-copy.time>=70};});
   const cardOrder=width>=1000?cardsDuring.cards.every(c=>c.state==='playing')&&Math.abs(timings[0].title[0].time-timings[1].title[0].time)<2:cardsDuring.cards[1].state==='pending'&&studentsDone.cards[1].state==='pending'&&timings[1].title[0].time>timings[0].button.time+300;
   const sameInk=JSON.stringify(pending.bannerInk)===JSON.stringify(during.bannerInk)&&JSON.stringify(pending.bannerInk)===JSON.stringify(headerDone.bannerInk);
   const passed=pending.header==='pending'&&pending.cards.every(c=>c.state==='pending')&&during.header==='playing'&&sameInk&&covers.length>0&&covers.every(c=>c.width<=c.parentWidth+2&&c.height<=c.fontSize+2&&c.color==='rgb(48, 53, 55)')&&banner&&cover&&cover.time-banner.time>=120&&cardsDuring.cards[0].copy.opacity>0&&cardsDuring.cards[0].copy.opacity<1&&cardsDuring.cards[0].button.delay==='0.1s'&&done.header==='done'&&done.covers===0&&done.cards.every(c=>c.state==='done'&&c.copy.opacity===1&&c.copy.transform==='none'&&c.button.opacity===1)&&!done.overflow&&cardOrder&&timings.every(t=>t.passed)&&events.length===repeated.length&&during.scroll===headerDone.scroll;
   report.motion.push({width,height,pending,during,covers,headerDone,cardsDuring,studentsDone,done,events,timings,sameInk,cardOrder,passed:!!passed});console.log(JSON.stringify({width,motion:!!passed,sameInk,cardOrder}));await context.close();
  }
  for(const kind of['no-js','reduced','no-io','fast-skip','mid-load','resize','no-events','motion-change','hidden','short']){
   const init=kind==='no-io'?()=>{delete window.IntersectionObserver;}:kind==='no-events'?()=>{const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,...rest){if(this instanceof Element&&this.matches('.connect')&&type==='animationend')return;return add.call(this,type,...rest);};}:undefined;
   const {context,page}=await open(1440,kind==='short'?400:900,kind==='no-js'?{javaScriptEnabled:false}:kind==='reduced'?{reducedMotion:'reduce'}:{},init);await load(page);
   if(['fast-skip','mid-load','short'].includes(kind)){await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));if(kind==='mid-load')await page.reload({waitUntil:'networkidle'});}
   else if(!['no-js','reduced','no-io'].includes(kind)){await enter(page,'.connect-banner',.3);await page.waitForFunction(()=>document.querySelector('.connect').dataset.connectReveal==='playing');if(kind==='resize')await page.setViewportSize({width:390,height:844});if(kind==='motion-change')await page.emulateMedia({reducedMotion:'reduce'});if(kind==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});}
   if(kind==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
   if(!['no-js','reduced','no-io'].includes(kind)){await page.waitForFunction(()=>!document.querySelector('.connect').hasAttribute('data-connect-reveal'));await enter(page,'.partners',.5);}
   await page.waitForFunction(()=>!document.querySelector('[data-connect-reveal],[data-connect-card-reveal]'));
   const cssReduced=kind!=='reduced'||await page.evaluate(()=>{const s=document.querySelector('.connect'),cards=[...s.querySelectorAll('.connect-card')];s.dataset.connectReveal='pending';cards.forEach(c=>c.dataset.connectCardReveal='pending');const visible=[s.querySelector('h2'),s.querySelector('.connect-subtitle'),...s.querySelectorAll('.connect-card>h3,.connect-card>p,.connect-button')].every(el=>getComputedStyle(el).opacity==='1'&&getComputedStyle(el).transform==='none');s.removeAttribute('data-connect-reveal');cards.forEach(c=>c.removeAttribute('data-connect-card-reveal'));return visible;});
   const s=await page.evaluate(state),passed=cssReduced&&s.header==='done'&&s.covers===0&&!s.overflow&&s.cards.every(c=>c.copy.opacity===1&&c.button.opacity===1&&c.copy.transform==='none');report.fallback.push({kind,...s,cssReduced,passed});console.log(JSON.stringify({kind,passed}));await context.close();
  }
  // News and Connect share the authorized restoration/lifecycle fix; the older
  // ABOUT, ACTIVITY and boundary scripts must still match their frozen sources.
  report.unchangedScripts=JSON.parse(fs.readFileSync(path.join(root,'evidence/before-connect-reveal/unchanged-scripts.json'),'utf8')).filter(r=>path.basename(r.Path)!=='news-reveal.js').every(r=>crypto.createHash('sha256').update(fs.readFileSync(r.Path)).digest('hex').toUpperCase()===r.Hash);
  report.passed=!report.errors.length&&report.unchangedScripts&&['layout','motion','fallback'].every(key=>report[key].every(r=>r.passed));fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,errors:report.errors}));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
