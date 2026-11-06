const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {chromium}=process.env.CODEX_NODE_MODULES?createRequire(path.join(process.env.CODEX_NODE_MODULES,'news-test.cjs'))('playwright'):require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/news'),report={layout:[],motion:[],fallback:[],errors:[]};
function geometry(){return [...document.querySelectorAll('.hero,main section:not(.news),.about *,.activity *,.connect *')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return[el.className,el.textContent,r.x,r.y+scrollY,r.width,r.height,s.font,s.margin,s.padding,s.color];});}
function newsState(){const label=document.querySelector('.news-label'),rect=label.querySelector('span').getBoundingClientRect();return{reveal:label.dataset.newsReveal||'done',clip:getComputedStyle(label.querySelector('span')).clipPath,ruleClip:getComputedStyle(label.querySelector('img')).clipPath,overflow:document.documentElement.scrollWidth-innerWidth,rect:[rect.x,rect.y,rect.width,rect.height],messages:[...document.querySelectorAll('.news-empty p')].map(p=>{const r=p.getBoundingClientRect(),s=getComputedStyle(p);return{text:p.textContent,opacity:s.opacity,animation:s.animationName,transform:s.transform,rect:[r.x,r.y,r.width,r.height]};})};}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.ttf':'font/ttf','.svg':'image/svg+xml'};
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),before=name==='/before.html',css=name==='/before.css';const file=before||css?path.join(root,'evidence/before-news-empty',before?'index.html':'styles.css'):path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});if(before)res.end(fs.readFileSync(file,'utf8').replace('href="styles.css"','href="before.css"'));else fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-lcd-text']});
 try{
  async function open(width,height=900,options={},init){const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,...options}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});if(init)await page.addInitScript(init);return{context,page};}
  async function load(page,route='/'){await page.goto(url+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);}
  async function enter(page){await page.evaluate(()=>{const r=document.querySelector('.news-label>span').getBoundingClientRect();scrollTo(0,r.top+scrollY-innerHeight*.7);});}
  for(const width of[320,390,600,800,1024,1200,1440,1600,1920]){
   const {context,page}=await open(width,900,{reducedMotion:'reduce'});await load(page,'/before.html');const before=await page.evaluate(geometry),oldHeight=await page.locator('.news').evaluate(el=>el.getBoundingClientRect().height);
   await load(page);const newHeight=await page.locator('.news').evaluate(el=>el.getBoundingClientRect().height),delta=newHeight-oldHeight;
   const after=await page.evaluate(geometry);after.forEach(row=>{if(row[0]==='connect'||row[3]>=before.find(r=>r[0]==='connect')[3]+delta-.1)row[3]-=delta;});
   const details=await page.evaluate(()=>{const news=document.querySelector('.news'),ps=[...news.querySelectorAll('p')],rects=ps.map(p=>p.getBoundingClientRect());return{empty:ps.map(p=>p.textContent),fake:!!news.querySelector('.news-date,.event-badge,a'),readable:ps.every(p=>p.scrollWidth<=p.clientWidth+1),overlap:rects[0].bottom>rects[1].top,overflow:document.documentElement.scrollWidth-innerWidth,assets:[...news.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),news:news.getBoundingClientRect().toJSON()};});
   await page.locator('.news').screenshot({path:path.join(out,`news-${width}.png`)});
   const unchanged=JSON.stringify(before)===JSON.stringify(after),passed=unchanged&&!details.fake&&details.readable&&!details.overlap&&!details.overflow&&details.assets&&details.empty[0]==='現在、掲載はありません。';
   report.layout.push({width,delta,unchanged,...details,passed});console.log(JSON.stringify({width,layout:passed,unchanged}));await context.close();
  }
  for(const width of[390,800,1440,1920]){
   const {context,page}=await open(width);await page.addInitScript(()=>{window.newsEvents=[];for(const type of['animationstart','animationend'])document.addEventListener(type,e=>{if(e.target.parentElement?.matches('.news-label')||e.target.matches('.news-empty>p'))window.newsEvents.push({type,part:e.target.matches('.news-empty-title')?'title':e.target.matches('.news-empty>.body-copy')?'copy':e.target.tagName,time:performance.now(),name:e.animationName});});});await load(page);const pending=await page.evaluate(newsState);
   await enter(page);await page.waitForFunction(()=>document.querySelector('.news-label').dataset.newsReveal==='playing');const during=await page.evaluate(newsState),settings=await page.locator('.news-label').evaluate(el=>[...el.children].map(el=>{const s=getComputedStyle(el);return{duration:s.animationDuration,delay:s.animationDelay,easing:s.animationTimingFunction};}));
   await page.waitForTimeout(500);const fading=await page.evaluate(newsState);
   await page.waitForFunction(()=>!document.querySelector('.news-label').hasAttribute('data-news-reveal'));const done=await page.evaluate(newsState);const events=await page.evaluate(()=>window.newsEvents);
   await page.evaluate(()=>scrollTo(0,0));await enter(page);await page.waitForTimeout(150);const repeated=await page.evaluate(()=>window.newsEvents);
   const textEnd=events.find(e=>e.type==='animationend'&&e.part==='SPAN'),lineStart=events.find(e=>e.type==='animationstart'&&e.part==='IMG'),copyStart=events.find(e=>e.type==='animationstart'&&e.part==='copy');
   const fadePassed=pending.messages.every(p=>p.opacity==='0')&&during.messages.every(p=>p.opacity==='0'&&p.animation==='about-copy-fade')&&fading.messages.every(p=>+p.opacity>0&&+p.opacity<1&&p.transform==='none')&&done.messages.every((p,i)=>p.opacity==='1'&&JSON.stringify(p.rect)===JSON.stringify(during.messages[i].rect));
   const passed=fadePassed&&pending.reveal==='pending'&&during.reveal==='playing'&&done.reveal==='done'&&done.clip==='none'&&done.ruleClip==='none'&&JSON.stringify(during.rect)===JSON.stringify(done.rect)&&events.length===8&&repeated.length===8&&textEnd&&lineStart&&copyStart&&copyStart.time>=textEnd.time-1&&lineStart.time>=textEnd.time-1&&settings[0].duration==='0.35s'&&settings[1].delay==='0.35s';
   report.motion.push({width,pending,during,fading,done,events,settings,fadePassed,passed:!!passed});console.log(JSON.stringify({width,motion:!!passed,fadePassed}));await context.close();
  }
  for(const kind of['no-js','reduced','no-io','fast-skip','resize','no-events','motion-change']){
   const init=kind==='no-io'?()=>{delete window.IntersectionObserver;}:kind==='no-events'?()=>{const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,...rest){if(this instanceof Element&&this.matches('.news-label>img,.news-empty>.body-copy')&&type.startsWith('animation'))return;return add.call(this,type,...rest);};}:undefined;
   const {context,page}=await open(1440,900,kind==='no-js'?{javaScriptEnabled:false}:kind==='reduced'?{reducedMotion:'reduce'}:{},init);await load(page);
   if(kind==='fast-skip')await page.evaluate(()=>scrollTo(0,document.querySelector('.connect').getBoundingClientRect().top+scrollY));
   if(['resize','no-events','motion-change'].includes(kind)){await enter(page);await page.waitForFunction(()=>document.querySelector('.news-label').dataset.newsReveal==='playing');if(kind==='resize')await page.setViewportSize({width:390,height:844});if(kind==='motion-change')await page.emulateMedia({reducedMotion:'reduce'});}
   await page.waitForFunction(()=>!document.querySelector('.news-label').hasAttribute('data-news-reveal'));const s=await page.evaluate(newsState),passed=s.clip==='none'&&s.ruleClip==='none'&&!s.overflow&&s.messages.every(p=>p.opacity==='1');report.fallback.push({kind,...s,passed});console.log(JSON.stringify({kind,passed}));await context.close();
  }
  report.unchangedScripts=JSON.parse(fs.readFileSync(path.join(root,'evidence/before-news-empty/unchanged-scripts.json'),'utf8')).every(r=>crypto.createHash('sha256').update(fs.readFileSync(r.Path)).digest('hex').toUpperCase()===r.Hash);
  report.passed=!report.errors.length&&report.unchangedScripts&&['layout','motion','fallback'].every(key=>report[key].every(r=>r.passed));fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,errors:report.errors}));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
