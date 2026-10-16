// Preview the Holiday Gift Basket Drive pages before deploy: the new/changed files from /root/wa-www/out, everything else
// fetched from the live welfareavenue.com; optionally the Hub's give page and embed.js from the repo build (HUBLOCAL=1).
// Usage: node preview.js <shotdir> [mode]   mode: pre (local overlay) | live (the real site, nothing intercepted)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SHOTS = process.argv[2] || '/tmp/shots';
const MODE = process.argv[3] || 'pre';
const OUT = '/root/wa-www/out', REPO = '/root/wa-www/repo';
const SITE = 'https://welfareavenue.com';
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.xml': 'application/xml' };
function liveHeaders() {
  const txt = fs.readFileSync('/root/wa-www/live/_headers', 'utf8'); const h = {}; let on = false;
  txt.split('\n').forEach(l => { if (/^\/\*/.test(l)) { on = true; return; } if (!/^\s/.test(l)) { on = false; return; } if (on) { const i = l.indexOf(':'); h[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); } });
  return h;
}
function hubCsp() {
  const txt = fs.readFileSync(REPO + '/build/site/_headers', 'utf8'); const m = txt.match(/\n\/give\/\*\n\s+Content-Security-Policy: ([^\n]+)/); return m ? m[1] : '';
}
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  const results = [];
  for (const [lang, p] of [['en', '/gift-basket-drive/'], ['fr', '/fr/paniers-cadeaux/']]) {
    for (const [wname, width, height] of [['desktop', 1366, 900], ['phone', 390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ignoreHTTPSErrors: false });
      if (MODE === 'pre') {
        const H = liveHeaders();
        await ctx.route(SITE + '/**', async route => {
          const u = new URL(route.request().url()); let f = path.join(OUT, decodeURIComponent(u.pathname)); if (u.pathname.endsWith('/')) f = path.join(f, 'index.html');
          if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', ...H }, body: fs.readFileSync(f) });
          const r = await route.fetch(); return route.fulfill({ response: r });
        });
        await ctx.route('https://hub.welfareavenue.com/give/**', async route => {
          const u = new URL(route.request().url());
          if (u.pathname === '/give/embed.js') return route.fulfill({ status: 200, headers: { 'content-type': TYPES['.js'], 'access-control-allow-origin': '*' }, body: fs.readFileSync(REPO + '/build/give/embed.js') });
          if (u.pathname === '/give/' || u.pathname === '/give' || u.pathname.startsWith('/give/thanks')) return route.fulfill({ status: 200, headers: { 'content-type': TYPES['.html'], 'content-security-policy': hubCsp() }, body: fs.readFileSync(REPO + '/build/give/index.html') });
          const r = await route.fetch(); return route.fulfill({ response: r });
        });
      }
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      page.on('pageerror', e => errs.push('pageerror ' + e.message));
      page.on('requestfailed', r => { const u = r.url(); if (!/google-analytics|doubleclick/.test(u)) errs.push('failed ' + u + ' ' + (r.failure() || {}).errorText); });
      await page.goto(SITE + p + (MODE === 'live' ? '?v=' + Date.now() : ''), { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('[data-campaign]') && document.querySelector('[data-campaign]').getAttribute('data-loaded') === '1', null, { timeout: 15000 }).catch(() => errs.push('progress did not load'));
      const info = await page.evaluate(() => ({
        title: document.title, lang: document.documentElement.lang, h1: document.querySelectorAll('h1').length,
        raised: (document.querySelector('[data-dr="raised"]') || {}).textContent, people: (document.querySelector('[data-dr="people"]') || {}).textContent,
        barHidden: (document.querySelector('[data-dr="bar"]') || {}).hidden,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        langLink: (document.querySelector('a.lang') || {}).getAttribute && document.querySelector('a.lang').getAttribute('href'),
        donate: [...document.querySelectorAll('[data-wa-campaign]')].length, nav: !!document.querySelector('header.top nav'), foot: !!document.querySelector('footer.foot'),
        brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map(i => i.src)
      }));
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
      await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
      info.brokenAll = await page.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src));
      await page.screenshot({ path: `${SHOTS}/${lang}-${wname}-full.png`, fullPage: true });
      // the donate popup, from the progress card's button
      await page.click('.drp-card [data-wa-donate]');
      const frameEl = await page.waitForSelector('.wa-dn-box iframe', { timeout: 10000 }).catch(() => null);
      let pop = {};
      if (frameEl) {
        pop.src = await frameEl.getAttribute('src');
        const fr = await frameEl.contentFrame();
        await fr.waitForSelector('#give', { timeout: 15000 }).catch(() => errs.push('give form did not render'));
        pop.h1 = await fr.$eval('h1', e => e.textContent).catch(() => null);
        pop.lock = await fr.$eval('.lockdes b', e => e.textContent).catch(() => null);
        pop.freq = await fr.$('[data-freq]') ? 'shown' : 'hidden';
        pop.select = await fr.$('#des') ? 'select shown' : 'no select';
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SHOTS}/${lang}-${wname}-popup.png` });
        await page.keyboard.press('Escape');
      } else errs.push('popup did not open');
      results.push({ lang, wname, info, pop, errs });
      await ctx.close();
    }
  }
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})();
