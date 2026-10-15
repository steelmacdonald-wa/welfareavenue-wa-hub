/* w244f: the Hub's own form page (hub.welfareavenue.com/f/volunteer, build/f) for wave244: what each role involves, at most
   2 roles (the rest switch off), the read box required. form-submit answered from test/form_volunteer.json.
   node test/w244f.js */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const html = fs.readFileSync(path.join(__dirname, '../build/f/index.html'), 'utf8');
const FORM = process.env.FORM || path.join(__dirname, 'form_volunteer.json');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const res = {}; let fails = 0;
  const ok = (n, c, g) => { res[n] = c ? 'ok' : 'FAIL ' + JSON.stringify(g); if (!c) fails++; };
  for (const W of [1280, 390]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 900 } }); const page = await ctx.newPage();
    const errs = [], posts = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'hub.test') return route.fulfill({ contentType: 'text/html', body: html });
      if (u.pathname.endsWith('/functions/v1/form-submit')) {
        if (route.request().method() === 'POST') { posts.push(JSON.parse(route.request().postData() || '{}')); return route.fulfill({ contentType: 'application/json', body: '{"ok":true,"thank_you":"Thanks"}' }); }
        return route.fulfill({ contentType: 'application/json', body: fs.readFileSync(FORM) });
      }
      return route.abort();
    });
    await page.goto('https://hub.test/f/volunteer'); await page.waitForTimeout(1500);
    const tag = W + ': ';
    const roles = await page.evaluate(() => Array.from(document.querySelectorAll('input[name="roles"]')).map(b => ({ v: b.value, d: (b.closest('label').querySelector('small.cd') || {}).textContent || '' })));
    ok(tag + 'six roles with what they involve', roles.length === 6 && roles.every(r => r.d.length > 30) && !roles.some(r => r.v === 'dishwasher'), roles);
    ok(tag + 'driver: own car', /own car/.test(roles.find(r => r.v === 'driver').d), null);
    await page.check('input[name="roles"][value="cook"]'); await page.check('input[name="roles"][value="driver"]');
    const off = await page.evaluate(() => Array.from(document.querySelectorAll('input[name="roles"]')).filter(b => b.disabled).length);
    ok(tag + 'two picked: four off', off === 4, off);
    await page.uncheck('input[name="roles"][value="cook"]');
    ok(tag + 'one picked: all free', await page.evaluate(() => !document.querySelector('input[name="roles"]:disabled')), null);
    await page.check('input[name="roles"][value="cook"]');
    await page.fill('input[name="first_name"]', 'Testa'); await page.fill('input[name="last_name"]', 'Two'); await page.fill('input[name="email"]', 'testa@example.com'); await page.fill('input[name="phone"]', '514-555-0144');
    await page.waitForTimeout(3200);
    await page.click('#waf button[type="submit"]'); await page.waitForTimeout(600);
    ok(tag + 'read box required', posts.length === 0 && /answer this question/.test(await page.evaluate(() => (document.querySelector('[data-q="roles_read"]') || {}).innerText || '')), posts.length);
    await page.check('input[name="roles_read"]'); await page.click('#waf button[type="submit"]'); await page.waitForTimeout(800);
    ok(tag + 'sent', posts.length === 1 && JSON.stringify(posts[0].answers.roles) === '["cook","driver"]' && JSON.stringify(posts[0].answers.roles_read) === '["yes"]', posts);
    ok(tag + 'no page errors', errs.length === 0, errs);
    if (W === 390) await page.screenshot({ path: '/tmp/claude-0/f390.png', fullPage: false });
    await ctx.close();
  }
  console.log(JSON.stringify(res, null, 1)); console.log(fails ? fails + ' FAILED' : 'all green');
  await browser.close(); process.exit(fails ? 1 : 0);
})();
