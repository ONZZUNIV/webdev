const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const lib=process.env.CODEX_NODE_MODULES?createRequire(path.join(process.env.CODEX_NODE_MODULES,'__activity-verification.cjs')):require;
const {chromium}=lib('playwright'),sharp=lib('sharp');
const out=path.join(root,'evidence/activity-reveal');
function status(){
  const heading=document.querySelector('.activity-heading'),section=document.querySelector('.activity');
  const title=heading.querySelector('h2'),r=title.getBoundingClientRect(),s=section.getBoundingClientRect();
  const text=[...document.querySelectorAll('.about-copy>h1,.about-copy>p')].map(el=>el.getBoundingClientRect());
  const top=Math.max(0,Math.min(...text.map(r=>r.top))),bottom=Math.min(innerHeight,Math.max(...text.map(r=>r.bottom)));
  const titleTop=Math.max(0,text[0].top),titleBottom=Math.min(innerHeight,text[0].bottom);
  return{state:heading.dataset.activityReveal||null,finished:heading.dataset.activityRevealed==='true',
    coverage:1-s.top/innerHeight,aboutCovered:bottom<=top?1:Math.max(0,Math.min(1,(bottom-Math.max(top,s.top))/(bottom-top))),
    aboutTitleCovered:titleBottom<=titleTop?1:Math.max(0,Math.min(1,(titleBottom-Math.max(titleTop,s.top))/(titleBottom-titleTop))),
    titleVisible:Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top))/r.height,
    taglineOpacity:getComputedStyle(heading.querySelector('.activity-tagline')).opacity,
    bodyOpacity:getComputedStyle(heading.querySelector('.body-copy')).opacity,
    listOpacity:getComputedStyle(document.querySelector('.activity-list')).opacity,
    listAnimations:document.querySelector('.activity-list').getAnimations({subtree:true}).length,
    masks:heading.querySelectorAll('[data-activity-cover-line]').length,
    overflow:document.documentElement.scrollWidth-innerWidth};
}
function layout(normalizeAddedSpace=false){
  const boundary=document.querySelector('.about-activity-boundary'),about=document.querySelector('.about');
  const sticky=about.getBoundingClientRect().top-boundary.getBoundingClientRect().top;
  return [...document.querySelectorAll('.hero,main section,h1,h2,h3,h4,p,.section-label,.text-link,.activity-list')].map(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el),isAbout=about.contains(el)||el===about;
    const motion=el.matches('.activity-intro>p,.about-copy>p')&&s.transform!=='none'?new DOMMatrixReadOnly(s.transform).m42:0;
    // Remove visual transforms, then quantize to the browser's layout grid.
    const afterAbout=!!el.closest('.activity,.news,.connect');
    const flowY=Math.round((r.y+scrollY-(isAbout?sticky:0)-motion-(normalizeAddedSpace&&afterAbout?100:0))*64)/64;
    const h=r.height-(normalizeAddedSpace&&el===about?100:0);
    const padding=[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map((value,index)=>Math.round((parseFloat(value)-(normalizeAddedSpace&&el===about&&index===2?100:0))*1000)/1000);
    const grid=value=>Math.round(value*64)/64;
    return{class:el.className,text:el.textContent,x:grid(r.x),y:flowY,w:grid(r.width),h:grid(h),font:s.font,padding,margin:s.margin,color:s.color};
  });
}
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf'};
  const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name==='/before.html'){res.writeHead(200,{'Content-Type':mime['.html']}).end(fs.readFileSync(path.join(root,'evidence/before-activity-reveal/index.html'),'utf8').replace('href="styles.css"','href="before-styles.css"'));return;}
    const file=name==='/before-styles.css'?path.join(root,'evidence/before-activity-reveal/styles.css'):path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const report={layout:[],timing:[],fallback:[],errors:[]};let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-lcd-text']});
    async function open(width=1440,height=900,options={},init){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<800,hasTouch:width<800,...options});
      const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
      await page.addInitScript(()=>{window.__activityStarts=[];document.addEventListener('animationstart',e=>{if(e.target.closest('.activity-heading'))window.__activityStarts.push({name:e.animationName,time:performance.now(),target:e.target.className,pseudo:e.pseudoElement});});});
      if(init)await page.addInitScript(init);
      return{context,page};
    }
    async function load(page,route='/'){await page.goto(url+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);}
    async function scroll(page,y){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(40);}
    async function complete(page){await page.waitForFunction(()=>!document.querySelector('.activity-heading').hasAttribute('data-activity-reveal'));}

    for(const width of [320,360,375,390,428,480,600,768,800,900,1024,1280,1440,1600,1920]){
      const {context,page}=await open(width,900),captures=[];
      for(const route of ['/before.html','/']){
        await load(page,route);const height=await page.evaluate(()=>document.documentElement.scrollHeight);await page.setViewportSize({width,height});
        await page.waitForFunction(()=>!document.querySelector('.about').hasAttribute('data-about-reveal'));await complete(page);await scroll(page,0);
        await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
        captures.push({geometry:await page.evaluate(layout,route==='/'),image:await page.screenshot({fullPage:true}),
          activityTop:await page.evaluate(()=>document.querySelector('.activity').getBoundingClientRect().top+scrollY),
          gap:await page.evaluate(()=>document.querySelector('.activity').getBoundingClientRect().top-document.querySelector('.about .text-link').getBoundingClientRect().bottom)});
      }
      const a=await sharp(captures[0].image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const actualMeta=await sharp(captures[1].image).metadata(),cut=Math.floor(captures[0].activityTop)-12;
      // Remove only the requested extra 100px of blank ABOUT padding for comparison.
      const top=await sharp(captures[1].image).extract({left:0,top:0,width,height:cut}).png().toBuffer();
      const bottom=await sharp(captures[1].image).extract({left:0,top:cut+100,width,height:actualMeta.height-cut-100}).png().toBuffer();
      const b=await sharp({create:{width,height:actualMeta.height-100,channels:4,background:'#fdfdfd'}}).composite([{input:top,left:0,top:0},{input:bottom,left:0,top:cut}]).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const shadowTop=Math.floor(captures[0].activityTop)-13,shadowBottom=Math.floor(captures[0].activityTop)+1;
      let changed=0,max=0;for(let i=0;i<a.data.length;i+=4){const y=Math.floor(i/4/width);if(y>=shadowTop&&y<=shadowBottom)continue;let diff=false;for(let c=0;c<4;c++){const d=Math.abs(a.data[i+c]-b.data[i+c]);max=Math.max(max,d);if(d)diff=true;}if(diff)changed++;}
      const item={width,sameLayoutOutsideAddedPadding:JSON.stringify(captures[0].geometry)===JSON.stringify(captures[1].geometry),addedGap:captures[1].gap-captures[0].gap,
        addedPageHeight:actualMeta.height-a.info.height,samePixelsOutsideAllowedChanges:changed===0,
        changedPixels:changed,maxChannelDifference:max,withinRenderTolerance:a.info.width===b.info.width&&a.info.height===b.info.height&&max<=16&&changed/(a.info.width*a.info.height)<=.0001};
      report.layout.push(item);console.log(JSON.stringify(item));await context.close();
    }
    for(const [width,height]of [[390,844],[800,600],[1440,900],[320,240],[1920,600]]){
      const {context,page}=await open(width,height);await load(page);
      const before=await page.evaluate(layout);
      const start=await page.evaluate(()=>document.querySelector('.activity').getBoundingClientRect().top+scrollY);
      const stages=[];
      for(const coverage of [.25,.5,.8]){await scroll(page,start-height*(1-coverage));stages.push(await page.evaluate(status));}
      let trigger;
      for(let coverage=.85;coverage<=1.001;coverage+=.005){await scroll(page,start-height*(1-coverage));const s=await page.evaluate(status);if(s.state==='playing'){trigger=s;break;}}
      if(!trigger)throw Error('No trigger at '+width);
      const during=await page.evaluate(layout);
      await page.waitForTimeout(250);
      const animations=await page.evaluate(()=>document.querySelector('.activity-heading').getAnimations({subtree:true}).map(a=>({name:a.animationName,...a.effect.getTiming()})));
      await page.screenshot({path:path.join(out,'during-'+width+'.png')});
      await page.waitForTimeout(650);
      await page.screenshot({path:path.join(out,'caption-'+width+'.png')});
      await complete(page);
      const count=await page.evaluate(()=>window.__activityStarts.length);
      await scroll(page,0);await scroll(page,start-height*.15);await page.waitForTimeout(120);
      const after=await page.evaluate(status),sameLayout=JSON.stringify(before)===JSON.stringify(await page.evaluate(layout));
      const item={width,height,stages,trigger,animations,events:await page.evaluate(()=>window.__activityStarts),sameLayoutDuring:JSON.stringify(before)===JSON.stringify(during),sameLayoutAfter:sameLayout,
        once:count===await page.evaluate(()=>window.__activityStarts.length),final:after};
      if(!item.sameLayoutDuring)item.duringDifferences=before.map((value,index)=>({before:value,during:during[index]})).filter(pair=>JSON.stringify(pair.before)!==JSON.stringify(pair.during));
      item.passed=stages.every(s=>s.state==='pending')&&trigger.coverage>=.849&&trigger.aboutCovered>=.849&&trigger.aboutTitleCovered>=.849&&trigger.titleVisible>=.5&&item.sameLayoutDuring&&sameLayout&&item.once&&after.bodyOpacity==='1'&&after.taglineOpacity==='1'&&after.listAnimations===0&&after.listOpacity==='1'&&after.overflow===0;
      report.timing.push(item);console.log(JSON.stringify({width,trigger,passed:item.passed}));await context.close();
    }
    for(const kind of ['no-js','reduced','no-io','fast-skip','exit-mid','motion-change','resize-playing','watchdog']){
      const init=kind==='no-io'?()=>{delete window.IntersectionObserver;}:kind==='watchdog'?()=>{
        const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,...args){if(this instanceof Element&&this.matches('.activity-intro>.body-copy')&&['animationend','animationcancel'].includes(type))return;return add.call(this,type,...args);};
      }:undefined;
      const {context,page}=await open(390,844,kind==='no-js'?{javaScriptEnabled:false}:kind==='reduced'?{reducedMotion:'reduce'}:{},init);await load(page);
      if(kind==='fast-skip')await scroll(page,await page.evaluate(()=>document.documentElement.scrollHeight));
      else if(['exit-mid','motion-change','resize-playing','watchdog'].includes(kind)){
        const y=await page.evaluate(()=>document.querySelector('.activity').getBoundingClientRect().top+scrollY-30);await scroll(page,y);
        await page.waitForFunction(()=>document.querySelector('.activity-heading').dataset.activityReveal==='playing');
        if(kind==='exit-mid')await scroll(page,await page.evaluate(()=>document.documentElement.scrollHeight));
        else if(kind==='motion-change')await page.emulateMedia({reducedMotion:'reduce'});
        else if(kind==='resize-playing')await page.setViewportSize({width:800,height:600});
        else await page.waitForTimeout(1700);
      }
      await complete(page);const s=await page.evaluate(status);report.fallback.push({kind,...s,passed:s.state===null&&s.bodyOpacity==='1'&&s.taglineOpacity==='1'&&s.listAnimations===0&&s.overflow===0});await context.close();
    }
    const hashes=JSON.parse(fs.readFileSync(path.join(root,'evidence/before-activity-reveal/unchanged-scripts.json'),'utf8'));
    const crypto=require('node:crypto');report.existingScriptsUnchanged=hashes.every(item=>crypto.createHash('sha256').update(fs.readFileSync(item.Path)).digest('hex').toUpperCase()===item.Hash);
    report.passed=!report.errors.length&&report.existingScriptsUnchanged&&report.layout.every(r=>r.sameLayoutOutsideAddedPadding&&Math.abs(r.addedGap-100)<.02&&r.addedPageHeight===100&&r.withinRenderTolerance)&&report.timing.every(r=>r.passed)&&report.fallback.every(r=>r.passed);
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,existingScriptsUnchanged:report.existingScriptsUnchanged,failedTiming:report.timing.filter(r=>!r.passed),fallback:report.fallback,errors:report.errors},null,2));
    if(!report.passed)process.exitCode=1;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
