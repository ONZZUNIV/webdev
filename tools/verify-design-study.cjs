const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.join(process.env.CODEX_NODE_MODULES,'study-test.cjs'))('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/design-study'),report={layout:[],motion:[],fallback:[],errors:[]};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.ttf':'font/ttf'};
function copy(){return [...document.querySelectorAll('section h1,section h2,section h3,section h4,.about-copy>p,.activity-intro>.body-copy,.activity-copy>.body-copy,.news-empty>p,.connect-card>.body-copy,.text-link,.connect-button')].map(el=>el.textContent.replace(/[↗→\s]/g,''));}
function audit(){
 const issue=[];for(const el of document.querySelectorAll('h1,h2,h3,h4,p,a')){const r=el.getBoundingClientRect();if(el.scrollWidth>el.clientWidth+1||r.left<-.5||r.right>innerWidth+.5)issue.push({text:el.textContent,width:r.width,scroll:el.scrollWidth,client:el.clientWidth,x:r.x});}
 const boxes=[...document.querySelectorAll('.connect-card')].map(el=>el.getBoundingClientRect().toJSON());
 const links=[...document.querySelectorAll('a[href^="#"]')].every(a=>document.getElementById(a.getAttribute('href').slice(1)));
 return{width:innerWidth,height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth-innerWidth,issue,boxes,links,background:getComputedStyle(document.querySelector('.connect')).backgroundColor,bodySizes:[...document.querySelectorAll('.body-copy,.about-copy>p')].map(el=>parseFloat(getComputedStyle(el).fontSize)),assets:[...document.images].every(i=>i.complete&&i.naturalWidth>0),disabled:document.querySelectorAll('a[aria-disabled="true"]').length};
}
async function main(){
 fs.mkdirSync(out,{recursive:true});const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/design-study.html':name));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-lcd-text']});
 try{
  async function open(width,height=900,options={},init){const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,...options}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});if(init)await page.addInitScript(init);return{context,page};}
  async function load(page,route='/design-study.html'){await page.goto(url+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);}
  for(const width of[320,390,600,800,900,1024,1280,1440,1600,1920]){
   const {page,context}=await open(width,900,{reducedMotion:'reduce'});await load(page,'/index.html');const original=await page.evaluate(copy);await load(page);const textSame=JSON.stringify(original)===JSON.stringify(await page.evaluate(copy));const data=await page.evaluate(audit);
   const fullHeight=Math.ceil(data.height);await page.setViewportSize({width,height:fullHeight});await page.screenshot({path:path.join(out,`home-${width}.png`)});await page.locator('.connect').screenshot({path:path.join(out,`connect-${width}.png`)});
   const passed=textSame&&!data.overflow&&!data.issue.length&&data.links&&data.assets&&data.disabled===3&&data.background==='rgb(255, 255, 255)'&&data.bodySizes.every(n=>n>=15)&&(width>=1000?Math.abs(data.boxes[0].y-data.boxes[1].y)<1:data.boxes[1].y>=data.boxes[0].bottom);
   report.layout.push({...data,textSame,passed});console.log(JSON.stringify({width,passed,issue:data.issue,textSame}));await context.close();
  }
  for(const [width,height]of[[390,844],[800,900],[1440,900],[1920,1080]]){
   const {page,context}=await open(width,height);await load(page);await page.locator('.study-header a[href="#connect"]').click();await page.waitForFunction(()=>document.querySelector('.connect').dataset.connectReveal==='playing');
   const mask=await page.locator('[data-connect-cover-line]').evaluateAll(lines=>lines.map(line=>({color:getComputedStyle(line,'::before').backgroundColor,width:line.offsetWidth,parent:line.parentElement.clientWidth})));
   await page.waitForFunction(()=>!document.querySelector('.connect').hasAttribute('data-connect-reveal'));await page.waitForFunction(()=>!document.querySelector('.students').hasAttribute('data-connect-card-reveal'));
   if(width<1000)await page.evaluate(()=>{const r=document.querySelector('.partners').getBoundingClientRect();scrollTo(0,r.top+scrollY-innerHeight*.5);});
   await page.waitForFunction(()=>document.querySelector('.connect').dataset.connectRevealed==='true');const data=await page.evaluate(audit);
   const passed=locationSafe(await page.url())&&mask.length>0&&mask.every(m=>m.color==='rgb(255, 255, 255)'&&m.width<=m.parent+2)&&!data.overflow&&!data.issue.length;
   report.motion.push({width,mask,...data,passed});console.log(JSON.stringify({width,motion:passed,issue:data.issue}));await context.close();
  }
  for(const kind of['no-js','no-io','reload','hidden']){
   const init=kind==='no-io'?()=>{delete window.IntersectionObserver;}:undefined;
   const {page,context}=await open(1440,900,kind==='no-js'?{javaScriptEnabled:false}:{},init);await load(page);
   if(kind==='hidden'){await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});}
   await page.evaluate(()=>{const r=document.querySelector('.connect').getBoundingClientRect();scrollTo(0,r.top+scrollY);});
   if(kind==='reload')await page.reload({waitUntil:'networkidle'});
   await page.waitForFunction(()=>!document.querySelector('[data-connect-reveal],[data-connect-card-reveal]'));const data=await page.evaluate(audit);const visible=await page.locator('.connect-card').evaluateAll(cards=>cards.every(c=>[...c.querySelectorAll('h3,p,a')].every(el=>getComputedStyle(el).opacity==='1')));
   report.fallback.push({kind,visible,passed:visible&&!data.overflow&&!data.issue.length});console.log(JSON.stringify(report.fallback.at(-1)));await context.close();
  }
  report.originalUnchanged=JSON.parse(fs.readFileSync(path.join(root,'evidence/before-design-study/original-files.json'),'utf8')).every(r=>crypto.createHash('sha256').update(fs.readFileSync(r.Path)).digest('hex').toUpperCase()===r.Hash);
  report.passed=report.originalUnchanged&&!report.errors.length&&['layout','motion','fallback'].every(k=>report[k].every(r=>r.passed));fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,originalUnchanged:report.originalUnchanged,errors:report.errors}));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
function locationSafe(url){return url.endsWith('#connect');}
main().catch(e=>{console.error(e);process.exitCode=1;});
