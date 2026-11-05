const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const lib=process.env.CODEX_NODE_MODULES?createRequire(path.join(process.env.CODEX_NODE_MODULES,'__overlap-verification.cjs')):require;
const {chromium}=lib('playwright');
const sharp=lib('sharp');
const out=path.join(root,'evidence/section-overlap');
const widths=process.argv[2]?process.argv[2].split(',').map(Number):[320,360,375,390,428,480,600,768,800,900,1024,1280,1440,1600,1920];
function snapshot(){
  return [...document.querySelectorAll('.hero, main section, h1, h2, h3, h4, .body-copy, .about-copy>p, .text-link, .connect-button')].map(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return {class:el.className,text:el.textContent,x:r.x,y:r.y+scrollY,width:r.width,height:r.height,font:s.font,margin:s.margin,padding:s.padding,color:s.color};
  });
}
function state(){
  const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height};};
  const a=box('.about'),b=box('.activity'),n=box('.news');
  const y=Math.min(innerHeight-5,Math.max(5,b.top+5));
  return {scrollY,about:a,activity:b,news:n,height:document.documentElement.scrollHeight,
    overflow:document.documentElement.scrollWidth-innerWidth,
    pinTop:parseFloat(getComputedStyle(document.querySelector('.about')).top),
    overlap:Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)),
    front:document.elementFromPoint(innerWidth/2,y)?.closest('section')?.className,
    opacity:getComputedStyle(document.querySelector('.activity')).opacity,
    animations:document.getAnimations().filter(animation=>!animation.effect?.target.closest('.about, .activity-heading')).length};
}
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf'};
  const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name==='/before.html'){
      res.writeHead(200,{'Content-Type':mime['.html']}).end(fs.readFileSync(path.join(root,'evidence/before-section-overlap/index.html'),'utf8').replace('href="styles.css"','href="before-styles.css"'));return;
    }
    const file=name==='/before-styles.css'?path.join(root,'evidence/before-section-overlap/styles.css'):path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const report={layout:[],scroll:[],fallback:[],errors:[]};let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-lcd-text']});
    async function open(width,height,options={}){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,...options});
      const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
      return {context,page};
    }
    async function load(page,route='/'){
      await page.goto(url+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
    }
    async function settle(page,y){
      await page.evaluate(y=>scrollTo(0,y),y);
      // JS-disabled pages cannot run a requestAnimationFrame callback.
      await page.waitForTimeout(50);
    }
    async function completeAbout(page){
      await page.evaluate(()=>scrollTo(0,document.querySelector('.about h1').getBoundingClientRect().top+scrollY-60));
      await page.waitForFunction(()=>!document.querySelector('.about').hasAttribute('data-about-reveal'));
      await settle(page,0);
    }
    for(const width of widths){
      const {context,page}=await open(width,900);
      const captures=[];
      for(const route of ['/before.html','/']){
        await load(page,route);
        // Isolate the original boundary effect from later authorized spacing/shadow changes.
        if(route==='/')await page.addStyleTag({content:'.about-activity-boundary{--about-extra-bottom-space:0px!important}.about-activity-boundary>.activity::before{content:none!important}'});
        const height=await page.evaluate(()=>document.documentElement.scrollHeight);await page.setViewportSize({width,height});
        await page.waitForFunction(()=>!document.querySelector('.about').hasAttribute('data-about-reveal'));await settle(page,0);
        await page.waitForFunction(()=>!document.querySelector('.activity-heading').hasAttribute('data-activity-reveal'));
        await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode().catch(()=>{}))));
        captures.push({geometry:await page.evaluate(snapshot),pixels:await page.screenshot({fullPage:true})});
      }
      const a=await sharp(captures[0].pixels).raw().toBuffer({resolveWithObject:true}),b=await sharp(captures[1].pixels).raw().toBuffer({resolveWithObject:true});
      const item={width,sameLayout:JSON.stringify(captures[0].geometry)===JSON.stringify(captures[1].geometry),samePixels:a.info.width===b.info.width&&a.info.height===b.info.height&&a.data.equals(b.data)};
      item.withinRenderTolerance=item.samePixels;
      if(!item.samePixels){
        fs.writeFileSync(path.join(out,'before-'+width+'.png'),captures[0].pixels);fs.writeFileSync(path.join(out,'after-'+width+'.png'),captures[1].pixels);
        let pixels=0,maxDifference=0;
        for(let i=0;i<a.data.length;i+=a.info.channels){let changed=false;for(let c=0;c<a.info.channels;c++){const delta=Math.abs(a.data[i+c]-b.data[i+c]);maxDifference=Math.max(maxDifference,delta);if(delta)changed=true;}if(changed)pixels++;}
        item.pixelDifference={pixels,maxDifference};
        // Allow only sparse, low-channel differences at SVG antialiased edges.
        item.withinRenderTolerance=a.info.width===b.info.width&&a.info.height===b.info.height&&maxDifference<=16&&pixels/(a.info.width*a.info.height)<=.0001;
      }
      report.layout.push(item);console.log(JSON.stringify(item));await context.close();
    }
    for(const [width,height]of [[320,568],[320,240],[390,844],[768,432],[800,600],[1440,900],[1920,600]]){
      const {context,page}=await open(width,height);
      await load(page);await completeAbout(page);
      const initial=await page.evaluate(state);
      const originalAbout=initial.about.top,originalActivity=initial.activity.top;
      const visibleHeight=Math.min(height,initial.about.height),pinStart=originalAbout-initial.pinTop;
      const samples=[];
      for(const progress of [0,.25,.5,.75,1,.5,0]){
        await settle(page,pinStart+visibleHeight*progress);
        const current=await page.evaluate(state);samples.push({progress,...current});
        if(progress===.5&&samples.length===3){
          await page.screenshot({path:path.join(out,'overlap-'+width+'x'+height+'.png')});
          await page.waitForTimeout(120);
          const paused=await page.evaluate(state);
          if(JSON.stringify(current)!==JSON.stringify(paused))throw Error('Scroll effect moves while paused');
        }
      }
      await settle(page,pinStart);
      const readable=await page.evaluate(()=>{
        const link=document.querySelector('.about .text-link'),r=link.getBoundingClientRect();
        return{visible:r.top>=0&&r.bottom<=innerHeight,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===link};
      });
      await settle(page,initial.news.top-100);const after=await page.evaluate(state);
      const reverseStable=Math.abs(samples[2].activity.top-samples[5].activity.top)<.1&&Math.abs(samples[2].about.top-samples[5].about.top)<.1;
      const passed=samples.every(s=>s.overflow===0&&s.opacity==='1'&&s.animations===0&&Math.abs(s.activity.top-(originalActivity-s.scrollY))<.1)&&
        samples[2].overlap>0&&samples[2].front==='activity'&&reverseStable&&readable.visible&&readable.hit&&after.about.bottom<=after.news.top+.1&&after.height===initial.height;
      const item={width,height,passed,readable,reverseStable,initial,samples,after};report.scroll.push(item);console.log(JSON.stringify({width,height,passed,readable}));
      await page.emulateMedia({reducedMotion:'reduce'});await settle(page,pinStart+visibleHeight/2);const reduced=await page.evaluate(state);
      report.fallback.push({width,kind:'motion-change',passed:Math.abs(reduced.about.top-(originalAbout-reduced.scrollY))<.1&&reduced.overlap===0});
      await context.close();
    }
    for(const [kind,options]of [['no-javascript',{javaScriptEnabled:false}],['reduced-motion',{reducedMotion:'reduce'}]]){
      const {context,page}=await open(320,568,options);await load(page);
      const initial=await page.evaluate(state);await settle(page,initial.about.top+initial.about.height/2);const current=await page.evaluate(state);
      report.fallback.push({kind,passed:Math.abs(current.about.top-(initial.about.top-current.scrollY))<.1&&current.overlap===0});await context.close();
    }
    report.passed=report.errors.length===0&&report.layout.every(r=>r.sameLayout&&r.withinRenderTolerance)&&report.scroll.every(r=>r.passed)&&report.fallback.every(r=>r.passed);
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:report.passed,failures:{layout:report.layout.filter(r=>!r.sameLayout||!r.withinRenderTolerance),scroll:report.scroll.filter(r=>!r.passed).map(r=>({width:r.width,height:r.height,readable:r.readable,reverseStable:r.reverseStable})),fallback:report.fallback.filter(r=>!r.passed)},errors:report.errors},null,2));
    if(!report.passed)process.exitCode=1;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
