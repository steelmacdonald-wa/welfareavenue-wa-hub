/* w258page: the volunteer confirm page (wave258): before Confirm, the role's guide and details and the 4-day box; a cook must
   choose a dish and pick-up or drop-off; Confirm saves the details then submits cancel_rule_ok; confirmed shows the rule; a
   late "I can't make it" asks once; French; the early page names the rule. Route interception, the database stubbed.
   node test/w258page.js */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const html = fs.readFileSync(path.join(__dirname, '../build/c/index.html'), 'utf8');
const GUIDE = { expect_en: ['Cook at home with the ingredients we deliver.', 'Pack the food in the containers.'], expect_fr: ['Cuisinez a la maison.'], links: [{ url: 'https://docs.google.com/document/x', when: 'before', label_en: 'Cooking guide' }] };
const RECIPES = [{ id: 1, name: 'Chickpea curry', url: 'https://docs.google.com/r1', taken: 1 }, { id: 2, name: 'Chili', url: 'https://docs.google.com/r2', taken: 0 }];
function get(o) {
  return Object.assign({ ok: true, first: 'Laura', role: 'cook', role_en: 'Cook', role_fr: 'Benevole en cuisine', state: 'open', date: '2026-11-01', event_date: '2026-11-01', location: 'Montreal',
    opens_on: '2026-10-22', confirm_days: 10, cancel_days: 4, cancel_by: '2026-10-28', late: false, needs: ['recipe', 'pickup'], rule_ok: false,
    details: {}, guide: GUIDE, recipes: RECIPES, cook_pickup: { areas: ['Plateau', 'Verdun'], dropoff_place: '1500 Rue Berri', dropoff_time: '12:00' },
    events: [], photo: null, times: { start: '11:45', end: '12:00' } }, o || {});
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const res = {}; let fails = 0;
  const ok = (n, c, g) => { res[n] = c ? 'ok' : 'FAIL ' + JSON.stringify(g); if (!c) fails++; };
  async function open(over, lang, submitReply) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
    const errs = [], details = [], submits = [];
    page.on('pageerror', e => errs.push(String(e)));
    if (lang) await page.addInitScript(l => { try { localStorage.setItem('wa_lang', l); } catch (e) {} }, lang);
    await page.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith('https://hub.test/c/')) return route.fulfill({ contentType: 'text/html', body: html });
      if (u.indexOf('/rpc/volunteer_confirm_get') >= 0) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(get(over)) });
      if (u.indexOf('/rpc/volunteer_confirm_details') >= 0) { details.push(JSON.parse(route.request().postData() || '{}')); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) }); }
      if (u.indexOf('/rpc/volunteer_confirm_submit') >= 0) {
        const b = JSON.parse(route.request().postData() || '{}'); submits.push(b);
        const rep = submitReply ? submitReply(b) : { ok: true, state: b.p.attending === 'yes' ? 'confirmed' : 'declined', late: false };
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(rep) });
      }
      if (u.indexOf('/rpc/') >= 0) return route.fulfill({ contentType: 'application/json', body: 'null' });
      return route.abort();
    });
    await page.goto('https://hub.test/c/abcdef1234567890');
    await page.waitForTimeout(1400);
    return { page, ctx, errs, details, submits };
  }
  const txt = p => p.evaluate(() => document.getElementById('app').innerText);

  /* a cook, the confirm window open */
  let o = await open();
  let t = await txt(o.page);
  ok('cook: guide before confirm', /Cook at home/.test(t) && /Cooking guide/.test(t) && t.indexOf('Cook at home') < t.indexOf('Confirm, I will be there'), t.slice(0, 800));
  ok('cook: rule box with the date', /tell Welfare Avenue at least 4 days before \(by Wednesday, October 28\)/.test(t) || /at least 4 days before \(by .*Oct.* 28/.test(t), t.slice(0, 1500));
  ok('cook: guide box', await o.page.evaluate(() => !!document.getElementById('guide4')), null);
  await o.page.click('#yes'); await o.page.waitForTimeout(300);
  t = await txt(o.page);
  ok('needs a dish first', /choose your dish first/i.test(t) && o.submits.length === 0, t.slice(-600));
  await o.page.check('input[name="dish"][value="2"]'); await o.page.waitForTimeout(200);
  await o.page.click('#yes'); await o.page.waitForTimeout(300);
  t = await txt(o.page);
  ok('needs pick-up or drop-off', /pick-up or drop-off first/i.test(t) && o.submits.length === 0, t.slice(-600));
  await o.page.check('input[name="food"][value="dropoff"]'); await o.page.waitForTimeout(200);
  await o.page.click('#yes'); await o.page.waitForTimeout(300);
  t = await txt(o.page);
  ok('needs the guide box', /read what your role involves/i.test(t) && o.submits.length === 0, t.slice(-600));
  await o.page.check('#guide4');
  await o.page.click('#yes'); await o.page.waitForTimeout(300);
  t = await txt(o.page);
  ok('needs the 4-day box', /tick the box first/i.test(t) && o.submits.length === 0, t.slice(-600));
  ok('dish kept after the errors', await o.page.evaluate(() => { const r = document.querySelector('input[name="dish"][value="2"]'); return !!(r && r.checked); }), null);
  await o.page.check('#rule4');
  await o.page.click('#yes'); await o.page.waitForTimeout(900);
  ok('details saved first', o.details.length === 1 && o.details[0].p.recipe_id === 2 && o.details[0].p.pickup === 'dropoff', o.details);
  ok('submit carries the rule', o.submits.length === 1 && o.submits[0].p.attending === 'yes' && o.submits[0].p.cancel_rule_ok === true && o.submits[0].p.guide_read === true && o.submits[0].p.via === 'link', o.submits);
  t = await txt(o.page);
  ok('confirmed: the rule shown', /confirmed/i.test(t) && /You agreed to tell us at least 4 days before/.test(t), t.slice(0, 600));
  ok('no errors (cook)', o.errs.length === 0, o.errs); await o.ctx.close();

  /* the server says the rule is missing (an old page): the message, no state change */
  o = await open({ role: 'server', role_en: 'Server', needs: [], recipes: null, cook_pickup: null, guide: { expect_en: [], links: [] } }, null, () => ({ ok: false, reason: 'rule' }));
  ok('server: no guide box without a guide', !(await o.page.evaluate(() => !!document.getElementById('guide4'))), null);
  await o.page.check('#rule4'); await o.page.click('#yes'); await o.page.waitForTimeout(800);
  t = await txt(o.page);
  ok('server refusal shown', /tick the box first/i.test(t) && !/You.re confirmed/.test(t), t.slice(-500));
  ok('server: donations saved with confirm', o.details.length === 1 && 'donations' in o.details[0].p, o.details);
  ok('no errors (server)', o.errs.length === 0, o.errs); await o.ctx.close();

  /* confirmed, under 4 days: asked once, then the team hears */
  o = await open({ state: 'confirmed', late: true, rule_ok: true, confirmed_at: '2026-10-22T14:00:00Z', details: { recipe_id: 2, pickup: 'dropoff' } }, null, () => ({ ok: true, state: 'declined', late: true }));
  await o.page.click('#cant'); await o.page.waitForTimeout(300);
  t = await txt(o.page);
  ok('late: asked to call', /less than 4 days before/i.test(t) && /438-808-7754/.test(t) && o.submits.length === 0, t.slice(-700));
  await o.page.click('#lateback'); await o.page.waitForTimeout(200);
  ok('late: keep my spot', !(await o.page.evaluate(() => !!document.getElementById('lateask'))) && o.submits.length === 0, null);
  await o.page.click('#cant'); await o.page.waitForTimeout(200); await o.page.click('#cant2'); await o.page.waitForTimeout(800);
  t = await txt(o.page);
  ok('late: declined with the call note', o.submits.length === 1 && o.submits[0].p.attending === 'no' && /call or text us right away/i.test(t), [o.submits, t.slice(0, 500)]);
  ok('no errors (late)', o.errs.length === 0, o.errs); await o.ctx.close();

  /* not late: no question */
  o = await open({ state: 'confirmed', late: false, rule_ok: true, details: { recipe_id: 2, pickup: 'dropoff' } });
  await o.page.click('#cant'); await o.page.waitForTimeout(800);
  ok('not late: straight to no', o.submits.length === 1 && o.submits[0].p.attending === 'no', o.submits); await o.ctx.close();

  /* early: the rule ahead */
  o = await open({ state: 'early' });
  t = await txt(o.page);
  ok('early: rule ahead', /When you confirm, you.ll agree to tell us at least 4 days before/.test(t), t.slice(0, 700)); await o.ctx.close();

  /* French */
  o = await open({}, 'fr');
  t = await txt(o.page);
  ok('fr: la case', /au moins 4 jours avant/.test(t) && /Avant de confirmer/i.test(t), t.slice(0, 1500));
  ok('no errors (fr)', o.errs.length === 0, o.errs); await o.ctx.close();

  /* a driver with no car on file must say it */
  o = await open({ role: 'driver', role_en: 'Driver', needs: ['car'], recipes: null, cook_pickup: null, guide: { expect_en: ['Drive the food.'], links: [] } });
  await o.page.check('#guide4'); await o.page.check('#rule4'); await o.page.click('#yes'); await o.page.waitForTimeout(300);
  t = await txt(o.page);
  ok('driver: car first', /about your car first/i.test(t) && o.submits.length === 0, t.slice(-500));
  await o.page.selectOption('#vehicle', { index: 1 }); await o.page.click('#yes'); await o.page.waitForTimeout(800);
  ok('driver: confirmed with the car', o.submits.length === 1 && o.details.length === 1 && !!o.details[0].p.vehicle, [o.details, o.submits]);
  ok('no errors (driver)', o.errs.length === 0, o.errs); await o.ctx.close();

  console.log(JSON.stringify(res, null, 1)); console.log(fails ? fails + ' FAILED' : 'all green');
  await browser.close(); process.exit(fails ? 1 : 0);
})();
