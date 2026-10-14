/* w235page: the volunteer confirm page for a Community lead (wave235): the briefing heading, the briefing before confirming,
   "I have read my briefing" saved through volunteer_confirm_details. Served by route interception, the database stubbed.
   node test/w235page.js */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const html = fs.readFileSync(path.join(__dirname, '../build/c/index.html'), 'utf8');
const GUIDE = { expect_en: ['You are the team\'s link with the community.', 'Welcome people in the line.'], expect_fr: ['Vous etes le lien.'], bring_en: 'Your phone', arrive_en: '15 minutes before', links: [{ url: 'https://docs.google.com/forms/x', when: 'after', label_en: 'Beneficiary form' }] };
function get(state, role, details) {
  return { ok: true, first: 'Brianna', role: role, role_en: role === 'community_debrief' ? 'Community lead' : 'Server', state: state, date: '2026-11-15', event_date: '2026-11-15', location: 'Place Emilie-Gamelin',
    opens_on: '2026-11-09', details: details || {}, guide: GUIDE, events: [], photo: null, times: { start: '11:45', end: '14:15' } };
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const res = {}; let fails = 0;
  const ok = (n, c, g) => { res[n] = c ? 'ok' : 'FAIL ' + JSON.stringify(g); if (!c) fails++; };
  async function open(state, role, details, lang) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
    const errs = [], sent = [];
    page.on('pageerror', e => errs.push(String(e)));
    if (lang) await page.addInitScript(l => { try { localStorage.setItem('wa_lang', l); } catch (e) {} }, lang);
    await page.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith('https://hub.test/c/')) return route.fulfill({ contentType: 'text/html', body: html });
      if (u.indexOf('/rpc/volunteer_confirm_get') >= 0) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(get(state, role, details)) });
      if (u.indexOf('/rpc/volunteer_confirm_details') >= 0) { sent.push(JSON.parse(route.request().postData() || '{}')); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) }); }
      if (u.indexOf('/rpc/') >= 0) return route.fulfill({ contentType: 'application/json', body: 'null' });
      return route.abort();
    });
    await page.goto('https://hub.test/c/abcdef1234567890');
    await page.waitForTimeout(1500);
    return { page, ctx, errs, sent };
  }
  /* the confirm window (pending): the briefing shows before confirming */
  let o = await open('pending', 'community_debrief');
  let t = await o.page.evaluate(() => document.getElementById('app').innerText);
  ok('pending: briefing heading', /Your Community lead briefing/i.test(t), t.slice(0, 400));
  ok('pending: briefing steps', /link with the community/.test(t) && /Welcome people in the line/.test(t), t.slice(0, 600));
  ok('pending: beneficiary form link', /Beneficiary form/.test(t), null);
  ok('pending: read box', await o.page.evaluate(() => !!document.getElementById('briefed') && !document.getElementById('briefed').checked), null);
  await o.page.check('#briefed'); await o.page.click('#save'); await o.page.waitForTimeout(800);
  ok('save sends briefed', o.sent.length === 1 && o.sent[0].p && o.sent[0].p.briefed === true, o.sent);
  ok('stays ticked', await o.page.evaluate(() => document.getElementById('briefed').checked), null);
  ok('no errors (pending)', o.errs.length === 0, o.errs); await o.ctx.close();
  /* signed up early, already read */
  o = await open('early', 'community_debrief', { briefed_at: '2026-10-14T16:00:00Z' });
  t = await o.page.evaluate(() => document.getElementById('app').innerText);
  ok('early: read shown', /Briefing read/.test(t) && await o.page.evaluate(() => document.getElementById('briefed').checked), t.slice(0, 500));
  ok('no errors (early)', o.errs.length === 0, o.errs); await o.ctx.close();
  /* French */
  o = await open('confirmed', 'community_debrief', {}, 'fr');
  t = await o.page.evaluate(() => document.getElementById('app').innerText);
  ok('fr: consignes', /Vos consignes de responsable communautaire/i.test(t) && /J.ai lu mes consignes/.test(t), t.slice(0, 500));
  await o.ctx.close();
  /* a server: unchanged */
  o = await open('pending', 'server');
  t = await o.page.evaluate(() => document.getElementById('app').innerText);
  ok('server: no briefing box', !/briefing/i.test(t) && !(await o.page.evaluate(() => !!document.getElementById('briefed'))), t.slice(0, 400));
  ok('no errors (server)', o.errs.length === 0, o.errs); await o.ctx.close();
  console.log(JSON.stringify(res, null, 1)); console.log(fails ? fails + ' FAILED' : 'all green');
  await browser.close(); process.exit(fails ? 1 : 0);
})();
