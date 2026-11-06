// Development-only checks for ABOUT's progressive enhancement and visual geometry.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
const runtimeRequire = process.env.CODEX_NODE_MODULES
  ? createRequire(path.join(process.env.CODEX_NODE_MODULES, '__about-verification.cjs')) : require;
const {chromium} = runtimeRequire('playwright');
const sharp = runtimeRequire('sharp');
const out = path.join(root, 'evidence/about-animation');
const widths = [320,360,375,390,428,480,600,768,800,900,1024,1280,1440,1600,1920];

function geometry() {
  const boundary=document.querySelector('.about-activity-boundary');
  const about=document.querySelector('.about');
  // Boundary sticky intentionally moves ABOUT visually, not its flow position.
  const stickyOffset=boundary?about.getBoundingClientRect().top-boundary.getBoundingClientRect().top:0;
  return [...document.querySelectorAll('.hero, main section, .about *')].filter(el=>!el.hasAttribute('data-about-title-line')).map(el => {
    const r=el.getBoundingClientRect(),css=getComputedStyle(el);
    // The body intentionally moves visually by 12px; compare its flow position.
    const bodyOffset=el.matches('.about-copy > p')&&css.transform!=='none'?new DOMMatrixReadOnly(css.transform).m42:0;
    const sectionOffset=el===about||about.contains(el)?stickyOffset:0;
    return {tag:el.tagName,class:el.className,x:r.x,y:r.y+scrollY-bodyOffset-sectionOffset,width:r.width,height:r.height,
      font:css.font,letterSpacing:css.letterSpacing,margin:css.margin,padding:css.padding};
  });
}
function visibility() {
  const about=document.querySelector('.about'),title=about.querySelector('h1');
  return {state:about.dataset.aboutReveal||null,finished:about.dataset.aboutRevealed==='true',
    labelClip:getComputedStyle(about.querySelector('.about-label>span')).clipPath,
    bodyOpacity:getComputedStyle(about.querySelector('.about-copy>p')).opacity,
    linkOpacity:getComputedStyle(about.querySelector('.text-link')).opacity,
    mask:getComputedStyle(title.querySelector('[data-about-title-line]')||title,'::before').content,
    outsideAnimations:document.getAnimations().filter(a=>!a.effect?.target.closest('.about')).length,
    horizontalOverflow:document.documentElement.scrollWidth-innerWidth};
}
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.ttf':'font/ttf','.svg':'image/svg+xml'};
  const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name==='/activity-list-reveal.js'){res.writeHead(200,{'Content-Type':mime['.js']}).end('');return;}
    let file;
    if(name==='/before.html') {
      const html=fs.readFileSync(path.join(root,'evidence/before-about-animation/index.html'),'utf8').replace('href="styles.css"','href="before-styles.css"');
      res.writeHead(200,{'Content-Type':mime['.html']}).end(html);return;
    }
    if(name==='/before-styles.css') file=path.join(root,'evidence/before-about-animation/styles.css');
    else file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
    if(path.extname(file)==='.css'){
      // Serve the isolated baseline without a JS-driven style-loader promise.
      const neutral='.activity-stage{min-height:0!important}.about-activity-boundary{--about-extra-bottom-space:0px!important}.about-activity-boundary>.activity::before{content:none!important}';
      res.writeHead(200,{'Content-Type':mime['.css']}).end(fs.readFileSync(file,'utf8')+'\n'+neutral);return;
    }
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const report={layout:[],scenarios:{},errors:[]};
  let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-lcd-text']});
    async function open(width=1440,options={},init){
      // Keep the heading below the initial viewport for the scroll-trigger checks.
      const context=await browser.newContext({viewport:{width,height:width<800?240:Math.min(900,width/2)},deviceScaleFactor:1,...options});
      const page=await context.newPage();
      page.on('pageerror',e=>report.errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
      if(init)await page.addInitScript(init);
      return {context,page};
    }
    async function load(page,route='/'){
      await page.goto(url+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
    }
    async function fullViewport(page,width){
      const height=await page.evaluate(()=>document.documentElement.scrollHeight);
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>!document.querySelector('.about').hasAttribute('data-about-reveal'));
      await page.waitForFunction(()=>!document.querySelector('.activity-heading').hasAttribute('data-activity-reveal'));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    }
    async function reveal(page){
      await page.evaluate(()=>scrollTo(0,document.querySelector('.about h1').getBoundingClientRect().top+scrollY-60));
      await page.waitForFunction(()=>document.querySelector('.about').dataset.aboutReveal==='playing');
    }
    async function ended(page){await page.waitForFunction(()=>!document.querySelector('.about').hasAttribute('data-about-reveal'));}

    for(const width of widths){
      const {context,page}=await open(width);
      await load(page,'/before.html');await fullViewport(page,width);
      const beforeGeometry=await page.evaluate(geometry),before=await page.screenshot({fullPage:true});
      await load(page);await fullViewport(page,width);
      const afterGeometry=await page.evaluate(geometry),after=await page.screenshot({fullPage:true});
      const a=await sharp(before).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const b=await sharp(after).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const samePixels=a.info.width===b.info.width&&a.info.height===b.info.height&&a.data.equals(b.data);
      let changedPixels=0,maxChannelDifference=0;
      if(!samePixels)for(let i=0;i<a.data.length;i+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(a.data[i+c]-b.data[i+c]);maxChannelDifference=Math.max(maxChannelDifference,delta);if(delta)changed=true;}if(changed)changedPixels++;}
      const withinRenderTolerance=samePixels||(a.info.width===b.info.width&&a.info.height===b.info.height&&maxChannelDifference<=16&&changedPixels/(a.info.width*a.info.height)<=.0001);
      const item={width,sameGeometry:JSON.stringify(beforeGeometry)===JSON.stringify(afterGeometry),samePixels,withinRenderTolerance,changedPixels,maxChannelDifference,visibility:await page.evaluate(visibility)};
      report.layout.push(item);console.log(JSON.stringify(item));
      if([320,1440,1920].includes(width)){
        fs.writeFileSync(path.join(out,'before-'+width+'.png'),before);fs.writeFileSync(path.join(out,'after-'+width+'.png'),after);
      }
      await context.close();
    }

    for(const width of [320,800,1440]){
      const {context,page}=await open(width,{},()=>{
        window.__aboutAnimationStarts=[];
        document.addEventListener('animationstart',e=>window.__aboutAnimationStarts.push({name:e.animationName,scope:!!e.target.closest('.about')}));
      });
      await load(page);
      const before=await page.evaluate(geometry),pending=await page.evaluate(visibility);
      await page.evaluate(()=>{
        window.__aboutShifts=[];
        new PerformanceObserver(list=>window.__aboutShifts.push(...list.getEntries().map(e=>e.value))).observe({type:'layout-shift',buffered:false});
      });
      await reveal(page);
      const during=await page.evaluate(geometry);
      await page.waitForTimeout(250);
      const cover=await page.evaluate(()=>{
        const title=document.querySelector('.about h1');
        const lines=[...title.querySelectorAll('[data-about-title-line]')].map(line=>{
          const box=line.getBoundingClientRect(),pseudo=getComputedStyle(line,'::after');
          return {width:box.width,height:box.height,content:pseudo.content,background:pseudo.backgroundColor,delay:getComputedStyle(line).getPropertyValue('--about-line-delay')};
        });
        return {lines,headingWidth:title.getBoundingClientRect().width,fontSize:parseFloat(getComputedStyle(title).fontSize),color:getComputedStyle(title).color,active:document.getAnimations().map(a=>({name:a.animationName,duration:a.effect.getTiming().duration,delay:a.effect.getTiming().delay}))};
      });
      await page.screenshot({path:path.join(out,'during-'+width+'.png')});
      await ended(page);
      const firstCount=await page.evaluate(()=>window.__aboutAnimationStarts.length);
      await page.evaluate(()=>scrollTo(0,0));
      await page.evaluate(()=>scrollTo(0,document.querySelector('.about h1').getBoundingClientRect().top+scrollY-60));
      await page.waitForTimeout(150);
      report.scenarios['once-'+width]={pending,cover,firstCount,secondCount:await page.evaluate(()=>window.__aboutAnimationStarts.length),
        sameGeometryDuring:JSON.stringify(before)===JSON.stringify(during),sameGeometryAfter:JSON.stringify(before)===JSON.stringify(await page.evaluate(geometry)),
        shifts:await page.evaluate(()=>window.__aboutShifts),allAnimationEventsScoped:await page.evaluate(()=>window.__aboutAnimationStarts.every(e=>e.scope)),final:await page.evaluate(visibility)};
      await context.close();
    }

    for(const [name,options,init]of [
      ['no-javascript',{javaScriptEnabled:false}],
      ['reduced-motion',{reducedMotion:'reduce'}],
      ['missing-observer',{},()=>{delete window.IntersectionObserver;}],
      ['observer-error',{},()=>{window.IntersectionObserver=class{constructor(){throw Error('simulated observer failure');}};}]
    ]){
      const {context,page}=await open(320,options,init);await load(page);
      report.scenarios[name]=await page.evaluate(visibility);await context.close();
    }
    for(const name of ['skip-past','leave-mid-animation','motion-change','pagehide','watchdog','resize-pending','resize-playing']){
      const init=name==='watchdog'?()=>{
        const original=EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener=function(type,...args){
          if(this instanceof Element&&this.matches('.about .text-link')&&['animationend','animationcancel'].includes(type))return;
          return original.call(this,type,...args);
        };
      }:undefined;
      const {context,page}=await open(1440,{},init);await load(page);
      if(name!=='skip-past'&&name!=='resize-pending')await reveal(page);
      if(name==='motion-change')await page.emulateMedia({reducedMotion:'reduce'});
      else if(name==='pagehide')await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
      else if(name==='watchdog')await page.waitForTimeout(1550);
      else if(name==='resize-pending'){
        await page.setViewportSize({width:800,height:400});
        await page.waitForFunction(()=>document.querySelectorAll('[data-about-title-line]').length===1);
        await reveal(page);
      }
      else if(name==='resize-playing')await page.setViewportSize({width:320,height:240});
      else await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
      await ended(page);report.scenarios[name]=await page.evaluate(visibility);await context.close();
    }

    const isVisible=v=>!v.state&&v.bodyOpacity==='1'&&v.linkOpacity==='1'&&v.mask==='none'&&v.outsideAnimations===0&&v.horizontalOverflow===0;
    report.passed=report.errors.length===0&&report.layout.every(r=>r.sameGeometry&&r.withinRenderTolerance&&isVisible(r.visibility))&&
      Object.entries(report.scenarios).every(([name,s])=>name.startsWith('once-')?
        s.pending.state==='pending'&&s.firstCount===s.cover.lines.length*2+4&&s.firstCount===s.secondCount&&s.sameGeometryDuring&&s.sameGeometryAfter&&
        s.cover.lines.length>0&&s.cover.lines.every((line,i)=>line.background===s.cover.color&&line.width<=s.cover.headingWidth&&line.height<=s.cover.fontSize*1.2&&parseFloat(line.delay)===100+i*140)&&
        s.shifts.every(value=>value===0)&&s.allAnimationEventsScoped&&isVisible(s.final):isVisible(s));
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:report.passed,scenarios:report.scenarios,errors:report.errors},null,2));
    if(!report.passed)process.exitCode=1;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
