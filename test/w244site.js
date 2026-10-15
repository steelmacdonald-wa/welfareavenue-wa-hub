/* w244site: welfareavenue.com's volunteer sign-up (wave244): at most 2 roles, what each role involves under it (drivers bring
   their own car), the "I have read" box required, no dishwasher or "not sure" on the pages or the form, the role cards'
   "Apply for this role" stops at 2. Pages served from the www tree by route interception; form-submit answered with the live
   form definitions saved in test/ (form_volunteer.json, form_benevole.json).
   node test/w244site.js (WWW=<tree> to test another copy) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const WWW = process.env.WWW || path.join(__dirname, '../build/www/live'), FORMS = __dirname;
const TYPES = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml' };
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const res = {}; let fails = 0;
  const ok = (n, c, g) => { res[n] = c ? 'ok' : 'FAIL ' + JSON.stringify(g); if (!c) fails++; };
  async function open(p, slug, width) {
    const ctx = await browser.newContext({ viewport: { width: width || 1280, height: 900 } }); const page = await ctx.newPage();
    const errs = [], posts = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'www.test') {
        let f = path.join(WWW, decodeURIComponent(u.pathname)); if (u.pathname.endsWith('/')) f = path.join(f, 'index.html');
        if (fs.existsSync(f)) return route.fulfill({ contentType: TYPES[f.split('.').pop()] || 'application/octet-stream', body: fs.readFileSync(f) });
        return route.fulfill({ status: 404, body: '' });
      }
      if (u.pathname.endsWith('/functions/v1/form-submit')) {
        if (route.request().method() === 'POST') { posts.push(JSON.parse(route.request().postData() || '{}')); return route.fulfill({ contentType: 'application/json', body: '{"ok":true,"thank_you":"Thanks"}' }); }
        const s = u.searchParams.get('slug'); const fp = path.join(FORMS, 'form_' + s + '.json');
        if (fs.existsSync(fp)) return route.fulfill({ contentType: 'application/json', body: fs.readFileSync(fp) });
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
      }
      return route.abort();
    });
    await page.goto('https://www.test' + p); await page.waitForTimeout(1500);
    return { page, ctx, errs, posts };
  }
  for (const [p, slug, fr] of [['/volunteer/', 'volunteer', false], ['/fr/benevolat/', 'benevole', true]]) {
    const L = fr ? 'fr ' : '';
    const o = await open(p, slug);
    const page = o.page;
    const pageText = await page.evaluate(() => document.body.innerText);
    ok(L + 'page: no dishwasher card', !/dishwash|vaisselle/i.test(pageText) && !(await page.$('#role-dishes')), null);
    ok(L + 'page: no not-sure card', !(await page.$('#role-not-sure')), null);
    await page.click('.waf-open'); await page.waitForTimeout(500);
    const roles = await page.evaluate(() => Array.from(document.querySelectorAll('input[name="roles"]')).map(b => ({ v: b.value, d: (b.closest('label') || b.parentNode).querySelector('small.cd') ? (b.closest('label') || b.parentNode).querySelector('small.cd').textContent : '' })));
    ok(L + 'form: six roles, no dishwasher', roles.length === 6 && !roles.some(r => r.v === 'dishwasher'), roles.map(r => r.v));
    ok(L + 'form: every role says what it involves', roles.every(r => r.d.length > 30), roles);
    ok(L + 'form: driver brings own car', /own car|propre voiture/.test((roles.find(r => r.v === 'driver') || {}).d || ''), roles.find(r => r.v === 'driver'));
    ok(L + 'form: max on the fieldset', await page.evaluate(() => { const f = document.querySelector('input[name="roles"]').closest('fieldset'); return f && f.getAttribute('data-max') === '2'; }), null);
    ok(L + 'form: read box there', await page.evaluate(() => !!document.querySelector('input[name="roles_read"]')), null);
    /* pick two: the rest switch off */
    await page.check('input[name="roles"][value="server"]'); await page.check('input[name="roles"][value="driver"]');
    const st = await page.evaluate(() => Array.from(document.querySelectorAll('input[name="roles"]')).map(b => b.value + ':' + (b.checked ? 'on' : b.disabled ? 'off' : 'free')));
    ok(L + 'two picked: others off', st.filter(s => s.endsWith(':off')).length === 4 && st.filter(s => s.endsWith(':on')).length === 2, st);
    await page.uncheck('input[name="roles"][value="driver"]');
    const st2 = await page.evaluate(() => Array.from(document.querySelectorAll('input[name="roles"]')).filter(b => b.disabled).length);
    ok(L + 'one picked: all free again', st2 === 0, st2);
    await page.check('input[name="roles"][value="driver"]');
    /* fill the rest, leave the read box: not sent */
    await page.fill('input[name="first_name"]', 'Testa'); await page.fill('input[name="last_name"]', 'Two');
    await page.fill('input[name="email"]', 'testa@example.com'); await page.fill('input[name="phone"]', '514-555-0144');
    await page.waitForTimeout(3200);
    await page.click('.waf button[type="submit"], .waf-dialog button[type="submit"]'); await page.waitForTimeout(600);
    const err = await page.evaluate(() => { const b = document.querySelector('input[name="roles_read"]'); const q = b && (b.closest('fieldset') || b.closest('.q')); return q ? q.innerText : ''; });
    ok(L + 'read box required', o.posts.length === 0 && /answer|répondre|tick|cocher/i.test(err), { posts: o.posts.length, err });
    await page.check('input[name="roles_read"]');
    await page.click('.waf button[type="submit"], .waf-dialog button[type="submit"]'); await page.waitForTimeout(800);
    ok(L + 'sent with two roles and the box', o.posts.length === 1 && JSON.stringify(o.posts[0].answers.roles) === '["server","driver"]' && JSON.stringify(o.posts[0].answers.roles_read) === '["yes"]', o.posts);
    ok(L + 'no page errors', o.errs.length === 0, o.errs);
    await o.ctx.close();
  }
  /* "Apply for this role" on the cards stops at two */
  {
    const o = await open('/volunteer/', 'volunteer', 390); const page = o.page;
    const clickRole = async (r) => { await page.evaluate(x => { const b = document.querySelector('[data-role="' + x + '"]'); b.click(); }, r); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await page.waitForTimeout(300); };
    await clickRole('server'); await clickRole('cook'); await clickRole('driver');
    const on = await page.evaluate(() => Array.from(document.querySelectorAll('input[name="roles"]:checked')).map(b => b.value));
    ok('cards: third role not ticked', JSON.stringify(on) === '["server","cook"]', on);
    ok('cards: no page errors (390 px)', o.errs.length === 0, o.errs);
    await o.ctx.close();
  }
  /* the events pages: no Dishwashers in "Who do we need?" */
  for (const p of ['/events/', '/fr/evenements/']) {
    const o = await open(p, null);
    const t = await o.page.evaluate(() => document.body.innerText);
    ok(p + ' no dishwashers', !/dishwasher|vaisselle/i.test(t), null);
    await o.ctx.close();
  }
  console.log(JSON.stringify(res, null, 1)); console.log(fails ? fails + ' FAILED' : 'all green');
  await browser.close(); process.exit(fails ? 1 : 0);
})();
