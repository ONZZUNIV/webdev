// Development-only layout verification; ABOUT's local reveal script is allowed.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const runtimeRequire = process.env.CODEX_NODE_MODULES
  ? createRequire(path.join(process.env.CODEX_NODE_MODULES, '__verification.cjs'))
  : require;
const { chromium } = runtimeRequire('playwright');
const sharp = runtimeRequire('sharp');
const mobileMode = process.argv.includes('--mobile');
const desktopWidths = [800, 900, 1024, 1280, 1440, 1600, 1920];
const widths = mobileMode ? [320, 360, 375, 390, 428, 480, 600, 768, ...desktopWidths] : desktopWidths;
const out = path.join(root, mobileMode ? 'evidence/mobile' : 'evidence/responsive');
const inventorySelector = 'h1,h2,h3,h4,.activity-tagline,.body-copy,.about-copy>p,.news-item>p,.connect-subtitle,.connect-banner,.text-link,.connect-button,.news-date,.event-badge>span,.activity-number,.section-label>span,.scroll-mark>span';
const inventory = selector => [...document.querySelectorAll(selector)].map(el => el.textContent.replace(/\s+/g,'')).sort();

async function main() {
  fs.mkdirSync(out,{recursive:true});
  const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png'};
  const server = http.createServer((req,res) => {
    let urlPath;
    try { urlPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
    catch { res.writeHead(400).end(); return; }
    const file=path.resolve(root,'.'+(urlPath==='/'?'/index.html':urlPath));
    if (!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-lcd-text']});
    const baselinePage=await browser.newPage();
    await baselinePage.setContent(fs.readFileSync(path.join(root,'evidence/baseline/index.html'),'utf8'));
    const beforeText=await baselinePage.evaluate(inventory,inventorySelector);
    await baselinePage.close();
    const reports=[];
    for (const width of widths) {
      const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1,isMobile:mobileMode&&width<800,hasTouch:mobileMode&&width<800});
      const errors=[];
      page.on('pageerror',err=>errors.push(err.message));
      page.on('requestfailed',req=>errors.push(req.url()));
      page.on('response',res=>{if(res.status()>=400)errors.push(res.status()+' '+res.url());});
      await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      const height=await page.evaluate(()=>Math.ceil(document.documentElement.scrollHeight));
      // Keep all SVGs in the paint viewport, avoiding offscreen SVG capture artifacts.
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>!document.querySelector('.about').hasAttribute('data-about-reveal'));
      await page.waitForFunction(()=>!document.querySelector('.activity-heading').hasAttribute('data-activity-reveal'));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const screenshot='home-'+width+'.png';
      await page.screenshot({path:path.join(out,screenshot),fullPage:true});
      const report=await page.evaluate(() => {
        const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
        const box = (selector) => [...document.querySelectorAll(selector)].map(el=>({selector,text:el.textContent,...rect(el),fontSize:parseFloat(getComputedStyle(el).fontSize)}));
        const overflow=[];
        for(const el of document.querySelectorAll('h1,h2,h3,h4,p,a,.activity-name,.news-date,.connect-card')) {
          if(el.scrollWidth>el.clientWidth+1)overflow.push({text:el.textContent,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth});
        }
        const chunks=[];
        const walker=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_TEXT);
        for(let n; n=walker.nextNode();) {
          if(!n.textContent.trim())continue;
          const owner=n.parentElement.closest('h1,h2,h3,h4,p,a,.activity-number,.news-date,.event-badge,.section-label,.scroll-mark')||n.parentElement;
          const range=document.createRange();range.selectNodeContents(n);
          for(const r of range.getClientRects()) if(r.width&&r.height)chunks.push({owner,text:n.textContent,x:r.x,y:r.y,width:r.width,height:r.height});
        }
        const overlaps=[];
        for(let i=0;i<chunks.length;i++)for(let j=i+1;j<chunks.length;j++){
          const a=chunks[i],b=chunks[j];
          if(a.owner===b.owner)continue;
          const dx=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
          const dy=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
          if(dx>1.5&&dy>1.5)overlaps.push({a:a.text,b:b.text,dx,dy});
        }
        const outsideText=chunks.filter(c=>c.x<-.5||c.x+c.width>innerWidth+.5).map(({owner,...c})=>c);
        const assets=[...document.images].map(el=>({src:el.getAttribute('src'),loaded:el.complete&&el.naturalWidth>0,...rect(el)}));
        const clippedText=[];
        for(const el of document.querySelectorAll('h1,h2,h3,h4,p,a')) {
          const section=el.closest('section');
          if(!section)continue;
          const a=el.getBoundingClientRect(),b=section.getBoundingClientRect();
          if(a.y<b.y-1||a.bottom>b.bottom+1)clippedText.push({text:el.textContent,...rect(el),section:section.className});
        }
        return {
          width:innerWidth,height:document.documentElement.scrollHeight,
          horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
          canvas:rect(document.querySelector('.home')),
          sections:box('main section'),
          body:box('.body-copy,.about-copy>p'),
          titles:box('h1,h2,h3,h4'),
          layouts:['.about','.activity-layout','.activity-item','.news-item','.connect-columns'].map(selector=>({selector,columns:getComputedStyle(document.querySelector(selector)).gridTemplateColumns,...rect(document.querySelector(selector))})),
          scripts:[...document.scripts].map(s=>s.getAttribute('src')),assets,overflow,overlaps,outsideText,clippedText
        };
      });
      report.textUnchanged=JSON.stringify(beforeText)===JSON.stringify(await page.evaluate(inventory,inventorySelector));
      report.errors=errors;report.screenshot=screenshot;
      report.passed=report.horizontalOverflow===0&&JSON.stringify(report.scripts)===JSON.stringify(['about-reveal.js','section-overlap.js','activity-reveal.js'])&&report.textUnchanged&&
        !errors.length&&!report.overflow.length&&!report.overlaps.length&&!report.outsideText.length&&!report.clippedText.length&&
        report.assets.length===19&&report.assets.every(a=>a.loaded)&&report.body.every(b=>b.fontSize>=15);
      reports.push(report);
      console.log(JSON.stringify({width,height:report.height,passed:report.passed,horizontalOverflow:report.horizontalOverflow,textUnchanged:report.textUnchanged,overflow:report.overflow,overlaps:report.overlaps,outsideText:report.outsideText,clippedText:report.clippedText,errors}));
      await page.close();
    }

    // Probe intermediate widths and both sides of each breakpoint, plus wider desktops.
    const sweepWidths=[...new Set([...(mobileMode?Array.from({length:201},(_,i)=>320+i*8):Array.from({length:141},(_,i)=>800+i*8)),...(mobileMode?[479,480,599,600,799,800]:[]),999,1000,1099,1100,1199,1200,2560,3840])].sort((a,b)=>a-b);
    const sweep=[];
    const sweepPage=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
    await sweepPage.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
    await sweepPage.evaluate(()=>document.fonts.ready);
    for(const width of sweepWidths){
      await sweepPage.setViewportSize({width,height:1000});
      const sample=await sweepPage.evaluate(()=>{
        const issues=[];
        const nodes=[...document.querySelectorAll('h1,h2,h3,h4,p,a,.activity-name,.news-date,.connect-card')];
        for(const el of nodes){
          const r=el.getBoundingClientRect();
          if(el.scrollWidth>el.clientWidth+1||r.x<-.5||r.right>innerWidth+.5)issues.push(el.textContent);
        }
        return{width:innerWidth,horizontalOverflow:document.documentElement.scrollWidth-innerWidth,issues};
      });
      sweep.push(sample);
    }
    await sweepPage.close();
    const sweepFailures=sweep.filter(r=>r.horizontalOverflow||r.issues.length);
    console.log(JSON.stringify({additionalWidths:sweep.length,sweepFailures}));

    const baseline=await sharp(path.join(root,'evidence/baseline/home-1440.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const current=await sharp(path.join(out,'home-1440.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const commonHeight=Math.min(baseline.info.height,current.info.height),width=1440;
    let changed=0,error=0;
    const diff=Buffer.alloc(width*commonHeight*4);
    for(let i=0;i<diff.length;i+=4){
      let differs=false;
      for(let c=0;c<3;c++){
        const delta=Math.abs(baseline.data[i+c]-current.data[i+c]);error+=delta;
        if(delta>16)differs=true;
        diff[i+c]=255-Math.min(255,delta*3);
      }
      diff[i+3]=255;if(differs)changed++;
    }
    const comparison={
      width,beforeHeight:baseline.info.height,afterHeight:current.info.height,
      commonHeight,changedPixelPercentage:changed/(width*commonHeight)*100,
      meanAbsoluteChannelDifference:error/(width*commonHeight*3),
      note:'Pixel statistics include flat backgrounds; they are not a design fidelity score.'
    };
    await sharp(diff,{raw:{width,height:commonHeight,channels:4}}).png().toFile(path.join(out,'before-after-difference-1440.png'));
    const desktopRegression=[];
    if(mobileMode){
      for(const width of desktopWidths){
        const before=await sharp(path.join(root,'evidence/before-mobile/home-'+width+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
        const after=await sharp(path.join(out,'home-'+width+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
        desktopRegression.push({width,identicalDimensions:before.info.width===after.info.width&&before.info.height===after.info.height,identicalPixels:before.data.equals(after.data)});
      }
      console.log(JSON.stringify({desktopRegression}));
    }
    const report={widths,reports,sweep,comparison,desktopRegression};
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
    // Contact sheets are only for review; all originals retain the requested width.
    const panels=[];
    const sheetReports=mobileMode?reports.filter(r=>r.width<800):reports;
    for(const r of sheetReports) {
      const image=await sharp(path.join(out,r.screenshot)).resize({width:320}).png().toBuffer();
      const meta=await sharp(image).metadata();panels.push({input:image,left:panels.length*336,top:32,height:meta.height});
    }
    const sheetWidth=sheetReports.length*336;
    const labels=Buffer.from('<svg width="'+sheetWidth+'" height="32">'+sheetReports.map((r,i)=>'<text x="'+(i*336+8)+'" y="23" font-family="sans-serif" font-size="18">'+r.width+'px</text>').join('')+'</svg>');
    await sharp({create:{width:sheetWidth,height:Math.max(...panels.map(p=>p.height))+32,channels:4,background:'#eeeeee'}})
      .composite([{input:labels,left:0,top:0},...panels.map(({height,...p})=>p)]).png().toFile(path.join(out,'contact-sheet.png'));
    // These historical captures include the now-hidden Scroll indicator.
    // Preserve the comparison as information; intentional removal changes pixels/heights.
    const allPassed=reports.every(r=>r.passed)&&!sweepFailures.length;
    console.log(JSON.stringify({comparison,allPassed},null,2));
    if(!allPassed)process.exitCode=1;
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(err=>{console.error(err);process.exitCode=1;});
