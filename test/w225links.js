/* w225links.js: the public link-in-bio page (build/links/index.html) with studio_link_page stubbed. */
const fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
(async () => {
  const html = fs.readFileSync(path.join(__dirname, '../build/links/index.html'), 'utf8');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith('http://wahub.test/links')) return r.fulfill({ contentType: 'text/html', body: html });
    if (u.indexOf('studio_link_page') >= 0) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ title: 'Welfare Avenue', bio: 'Meals and community.', theme: 'cream', order: ['bio-volunteer', 'bio-donate'], socials: { instagram: 'https://instagram.com/welfareavenue', facebook: 'javascript:alert(1)' }, links: [{ code: 'bio-donate', label: 'Donate' }, { code: 'bio-volunteer', label: 'Volunteer with us' }] }) });
    return r.abort(); });
  await p.goto('http://wahub.test/links'); await p.waitForTimeout(800);
  const o = await p.evaluate(() => ({ btn: [...document.querySelectorAll('a.b')].map(a => a.textContent + '>' + a.getAttribute('href')), soc: [...document.querySelectorAll('.soc a')].map(a => a.getAttribute('href')), cls: document.body.className, sw: document.documentElement.scrollWidth }));
  await p.screenshot({ path: __dirname + '/shots_w225_links_public.png' });
  const good = o.btn.join('|') === 'Volunteer with us>/l/bio-volunteer|Donate>/l/bio-donate' && o.soc.length === 1 && o.cls === 'cream' && o.sw <= 390 && !errs.length;
  console.log(JSON.stringify(o), errs, good ? 'PASS' : 'FAIL'); await b.close(); process.exit(good ? 0 : 1);
})();
