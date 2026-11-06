const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.join(process.env.CODEX_NODE_MODULES, 'adoption-test.cjs'))('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence/refinement-adoption');
const report = { layout: [], about: [], fallback: [], errors: [] };
function text() {
  return [...document.querySelectorAll('h1,h2,h3,h4,.about-copy>p,.activity-intro>.body-copy,.activity-copy>.body-copy,.news-empty>p,.connect-card>.body-copy,.text-link,.connect-button')].map(e => e.textContent.replace(/\s+/g, ''));
}
function audit() {
  const issues = [];
  for (const e of document.querySelectorAll('h1,h2,h3,h4,p,a,.refine-flow-labels>span')) {
    const r = e.getBoundingClientRect();
    if (r.width && r.height && (e.scrollWidth > e.clientWidth + 1 || r.left < -.5 || r.right > innerWidth + .5)) issues.push(e.textContent);
  }
  return {
    overflow: document.documentElement.scrollWidth - innerWidth, issues,
    images: [...document.images].every(e => e.complete && e.naturalWidth > 0),
    decorative: [...document.querySelectorAll('.refine-about-mark,.refine-connect-mark,.refine-activity-visual,.refine-activity-surface')].every(e => e.getAttribute('aria-hidden') === 'true'),
    comparisonLink: !!document.querySelector('a[href="index.html"]'),
    backToTop: !!document.querySelector('.connect-footer a[href="#top"]'),
    whiteConnect: getComputedStyle(document.querySelector('.connect')).backgroundColor === 'rgb(255, 255, 255)'
  };
}
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
  const server = http.createServer((req, res) => {
    let route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (route === '/before-adoption.html') route = '/evidence/before-refinement-adoption/index.html';
    const file = path.resolve(root, '.' + route);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-lcd-text'] });
  async function open(width, opts = {}, init) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, ...opts });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url()); });
    if (init) await page.addInitScript(init);
    return { page, context };
  }
  async function load(page, route = '/index.html') {
    await page.goto(url + route, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
  }
  try {
    for (const width of [320, 390, 600, 800, 900, 1024, 1200, 1280, 1440, 1600, 1920]) {
      const { page, context } = await open(width, { reducedMotion: 'reduce' });
      await load(page, '/before-adoption.html');
      const beforeText = await page.evaluate(text);
      const hero = await page.locator('.hero').screenshot();
      await load(page, '/refinement-study.html');
      // The comparison-only footer link is intentionally excluded from adoption.
      await page.evaluate(() => {
        document.querySelector('.connect-footer a[href="index.html"]').remove();
        const footer = document.querySelector('.connect-footer');
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = 'normal';
      });
      const expected = {};
      for (const name of ['about', 'activity', 'news', 'connect']) expected[name] = await page.locator('.' + name).screenshot();
      await load(page);
      const data = await page.evaluate(audit);
      const textSame = JSON.stringify(beforeText) === JSON.stringify(await page.evaluate(text));
      const heroSame = hero.equals(await page.locator('.hero').screenshot());
      const sections = {};
      for (const name of ['about', 'activity', 'news', 'connect']) {
        const screenshot = await page.locator('.' + name).screenshot({ path: path.join(out, `${name}-${width}.png`) });
        sections[name] = screenshot.equals(expected[name]);
      }
      const passed = textSame && heroSame && Object.values(sections).every(Boolean) && !data.overflow && !data.issues.length && data.images && data.decorative && !data.comparisonLink && data.backToTop && data.whiteConnect;
      report.layout.push({ width, ...data, textSame, heroSame, sections, passed });
      console.log(JSON.stringify({ width, passed, sections }));
      await context.close();
    }
    for (const width of [390, 800, 1440]) {
      const { page, context } = await open(width);
      await load(page);
      await page.evaluate(() => { const r = document.querySelector('.about-copy h1').getBoundingClientRect(); scrollTo(0, r.top + scrollY - innerHeight * .45); });
      await page.waitForFunction(() => document.querySelector('.about').dataset.aboutReveal === 'playing');
      const data = await page.evaluate(() => ({
        covers: [...document.querySelectorAll('[data-about-title-line]')].map(e => getComputedStyle(e, '::after').backgroundColor),
        colors: [...document.querySelectorAll('.about .heading-line')].map(e => getComputedStyle(e).color)
      }));
      await page.waitForFunction(() => !document.querySelector('.about').hasAttribute('data-about-reveal'));
      report.about.push({ width, ...data, passed: data.covers.length === 2 && JSON.stringify(data.covers) === JSON.stringify(data.colors) });
      await context.close();
    }
    for (const kind of ['no-js', 'no-io', 'reduced', 'short']) {
      const { page, context } = await open(1440, kind === 'no-js' ? { javaScriptEnabled: false } : kind === 'reduced' ? { reducedMotion: 'reduce' } : {}, kind === 'no-io' ? () => { delete window.IntersectionObserver; } : undefined);
      if (kind === 'short') await page.setViewportSize({ width: 1440, height: 600 });
      await load(page);
      await page.evaluate(() => { const r = document.querySelector('.connect').getBoundingClientRect(); scrollTo(0, r.top + scrollY); });
      await page.waitForFunction(() => !document.querySelector('[data-connect-reveal],[data-connect-card-reveal]'));
      const data = await page.evaluate(audit);
      const hidden = await page.locator('.refine-activity-visual').evaluate(e => getComputedStyle(e).display === 'none');
      report.fallback.push({ kind, ...data, passed: !data.overflow && !data.issues.length && data.images && (kind !== 'short' || hidden) });
      await context.close();
    }
    report.unchangedControllersAndProposal = JSON.parse(fs.readFileSync(path.join(root, 'evidence/before-refinement-adoption/files.json'), 'utf8').replace(/^\uFEFF/, '')).filter(r => path.basename(r.Path) !== 'index.html').every(r => crypto.createHash('sha256').update(fs.readFileSync(r.Path)).digest('hex').toUpperCase() === r.Hash);
    report.passed = report.unchangedControllersAndProposal && !report.errors.length && ['layout', 'about', 'fallback'].every(k => report[k].every(r => r.passed));
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, unchangedControllersAndProposal: report.unchangedControllersAndProposal, errors: report.errors }));
    if (!report.passed) process.exitCode = 1;
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
