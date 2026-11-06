const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.join(process.env.CODEX_NODE_MODULES,'entry-test.cjs'))('playwright');
const root=path.resolve(__dirname,'..'),testWidth=Number(process.env.ENTRY_TEST_WIDTH)||1440,testHeight=testWidth>=1920?1080:900,out=path.join(root,'evidence/downstream-entry-'+testWidth);
async function main(){
 fs.mkdirSync(out,{recursive:true});const report={cases:[],errors:[]};
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true}),url='http://127.0.0.1:'+server.address().port;
 try{
  for(const kind of(process.argv.length>2?process.argv.slice(2):['normal','reload','hidden','pagehide','resize','font-stall'])){
   const context=await browser.newContext({viewport:{width:testWidth,height:testHeight}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
   await page.addInitScript(()=>{
    window.downstreamEvents=[];
    function snapshot(reason){const n=document.querySelector('.news-label'),c=document.querySelector('.connect'),a=document.querySelector('.activity-stage');if(!n||!c)return;const nr=n.querySelector('span').getBoundingClientRect(),cr=c.querySelector('.connect-banner').getBoundingClientRect();window.downstreamEvents.push({reason,time:performance.now(),scroll:scrollY,hidden:document.hidden,news:n.dataset.newsReveal||'done',connect:c.dataset.connectReveal||'done',cards:[...c.querySelectorAll('.connect-card')].map(e=>e.dataset.connectCardReveal||'done'),newsTop:nr.top,connectTop:cr.top,stageHeight:a.getBoundingClientRect().height,slot:a.hasAttribute('data-activity-slot'),height:document.documentElement.scrollHeight});}
    window.captureDownstream=snapshot;
    for(const type of['animationstart','animationend'])document.addEventListener(type,e=>{const section=e.target.closest('.news,.connect');if(section)snapshot(type+':'+(section.classList.contains('news')?'news':'connect')+':'+e.target.className+':'+e.animationName);});
    document.addEventListener('DOMContentLoaded',()=>snapshot('DOMContentLoaded'));
    window.addEventListener('pageshow',()=>snapshot('pageshow'));
   });
   if(kind==='font-stall')await page.addInitScript(()=>{Object.defineProperty(document.fonts,'ready',{value:new Promise(()=>{}),configurable:true});});
   await page.goto(url,{waitUntil:'networkidle'});if(kind!=='font-stall')await page.evaluate(()=>document.fonts.ready);
   const metrics=await page.evaluate(()=>{const s=document.querySelector('.activity-stage');return{start:s.getBoundingClientRect().top+scrollY+Math.min(140,Math.max(80,innerHeight*.1)),step:parseFloat(s.style.getPropertyValue('--activity-slot-step')),dwell:parseFloat(s.style.getPropertyValue('--activity-slot-dwell'))};});
   await page.evaluate(m=>scrollTo(0,m.start+m.step+m.dwell+100),metrics);await page.waitForTimeout(2200);
   await page.evaluate(()=>captureDownstream('activity-before'));
   if(kind==='reload'){await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);}
   if(kind==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
   if(kind==='pagehide')await page.evaluate(()=>{dispatchEvent(new Event('pagehide'));dispatchEvent(new Event('pageshow'));});
   if(kind==='resize'){await page.setViewportSize({width:testWidth-160,height:testHeight});await page.setViewportSize({width:testWidth,height:testHeight});}
   await page.waitForTimeout(1000);await page.evaluate(()=>captureDownstream('activity-after'));
   const beforeEntry=await page.evaluate(()=>downstreamEvents),last=beforeEntry.at(-1),early=beforeEntry.filter(e=>e.reason.startsWith('animationstart'));
   await page.evaluate(()=>{const r=document.querySelector('.news-label>span').getBoundingClientRect();scrollTo(0,r.top+scrollY-innerHeight*.65);});await page.waitForTimeout(1150);
   await page.evaluate(()=>{const r=document.querySelector('.connect-banner').getBoundingClientRect();scrollTo(0,r.top+scrollY-innerHeight*.65);});await page.waitForTimeout(1250);
   const events=await page.evaluate(()=>downstreamEvents),newsStarts=events.filter(e=>e.reason==='animationstart:news::about-label-reveal'),connectStarts=events.filter(e=>e.reason==='animationstart:connect::connect-banner-reveal');
   const passed=last.news==='pending'&&last.connect==='pending'&&last.cards.every(s=>s==='pending')&&!early.length&&newsStarts.length===2&&connectStarts.length===1;
   report.cases.push({kind,beforeEntry,events,early,newsStarts:newsStarts.length,connectStarts:connectStarts.length,passed});console.log(JSON.stringify({kind,pending:[last.news,last.connect,...last.cards],early:early.length,newsStarts:newsStarts.length,connectStarts:connectStarts.length,passed}));await context.close();
  }
  // CONNECT markup was subsequently replaced by the approved white design.
  report.unchangedFiles=JSON.parse(fs.readFileSync(path.join(root,'evidence/before-downstream-entry-fix/unchanged-files.json'),'utf8')).filter(r=>path.basename(r.Path)!=='index.html').every(r=>crypto.createHash('sha256').update(fs.readFileSync(r.Path)).digest('hex').toUpperCase()===r.Hash);
  report.width=testWidth;report.height=testHeight;report.passed=report.unchangedFiles&&!report.errors.length&&report.cases.every(c=>c.passed);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
