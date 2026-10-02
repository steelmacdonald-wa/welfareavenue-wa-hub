/* w191inv.js: wave191n, the team leader's storage check on their page (build/c/index.html), offline.
   Steel (01/10/26): after the serving, back at the storage unit, "checking into to see what inventory looks like and that all
   is back in order"; chosen: a quick check on the leader's page. On the serving day after it starts the team leader sees the
   check above the survey: whether everything is back in its place (required), each item All back / Running low / Missing
   (grouped by category, a tap changes the row in place), a note, Save. It sends volunteer_inventory_submit with only the
   items that are not all back; then a thank-you with what to restock and Change my check (the states kept). A closed check
   says so. A test link previews it before the serving and saves nothing. Not for other roles. The booklet sends the team
   leader to it. French. The phone width. No page errors. Screenshots with SHOTS=<dir>. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'build', 'c', 'index.html'), 'utf8');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }

async function open(browser, tok, handler, opts, qs) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1100, height: 900 } }, opts || {}));
  const page = await ctx.newPage();
  const calls = []; const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://hub.welfareavenue.com/c/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://api.open-meteo.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/storage/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082', 'hex') }));
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/rpc/**', async r => {
    const req = r.request();
    const call = { fn: req.url().split('/rpc/')[1], body: req.postData() ? JSON.parse(req.postData()) : null };
    calls.push(call);
    const res = await handler(call, calls);
    await r.fulfill({ status: res.status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res.body) });
  });
  await page.goto('https://hub.welfareavenue.com/c/' + tok + (qs || ''));
  await page.waitForTimeout(600);
  return { ctx, page, calls, errors };
}
const TOK = 'abcdef1234567890ab';
const ITEMS = [{ id: 1, category: 'Hygiene & PPE', item: 'Gloves - Medium', unit: 'Box (100)' }, { id: 2, category: 'Hygiene & PPE', item: 'Gloves - Large', unit: 'Box (100)' },
  { id: 11, category: 'Consumables', item: 'Napkins (Extra)', unit: 'Pack' }, { id: 19, category: 'Station Setup & Logistics', item: 'Tent', unit: 'Each' }, { id: 20, category: 'Station Setup & Logistics', item: 'Tables', unit: 'Each' }];
const SQ = [{ key: 'overall', kind: 'choice', en: 'Overall, how was your experience?', fr: 'Dans l’ensemble?', required: true, options: [{ v: 'excellent', en: 'Excellent', fr: 'Excellente' }] }];
function base(role, over) {
  return Object.assign({ first: 'Melissa', name: 'Melissa Keza', role: role, role_en: role === 'team_leader' ? 'Team leader' : 'Server', role_fr: role, event_date: '2026-10-04', event_title: 'Sunday serving', location: 'Montreal', code: 'WA-26-21', lang: 'en',
    format: 'home_cooked', past: false, cancelled: false, state: 'confirmed', confirmed_at: '2026-09-28T14:00:00Z', opens_on: '2026-09-27', confirm_days: 7, start_time: '12:00',
    times: { start: '11:05', end: '14:58', at: 'storage', serve: '12:00' }, details: {}, recipes: [], events: [], photo: null,
    survey: { open: true, questions: SQ, submitted_at: null, answers: null },
    guide: { expect_en: ['Lead the team.'], expect_fr: ['Menez l’équipe.'], bring_en: '', bring_fr: '', arrive_en: '', arrive_fr: '', links: [] } }, over || {});
}
const INV = (over) => Object.assign({ open: true, preview: false, opens: '12:00', until: '2026-10-07', items: ITEMS, check: null }, over || {});
const handler = (spot, inv, submit) => (call) => {
  if (call.fn === 'volunteer_confirm_get') return { body: spot };
  if (call.fn === 'volunteer_inventory_get') return { body: inv };
  if (call.fn === 'volunteer_inventory_submit') return { body: submit || { ok: true, low: 1, missing: 1, in_place: true } };
  return { body: null };
};
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. the serving day, after it started: the check above the survey */
    let f = await open(browser, TOK, handler(base('team_leader'), INV()));
    let order = await f.page.evaluate(() => { const a = document.getElementById('inv'), b = document.getElementById('survey'); return { inv: !!a, sv: !!b, before: !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)) }; });
    ok('the check shows on the serving day, above the survey', order.inv && order.sv && order.before, order);
    ok('asked for it with the link only (not a preview)', f.calls.some(c => c.fn === 'volunteer_inventory_get' && c.body.p_token === TOK && !c.body.p_preview));
    let t = await f.page.evaluate(() => document.getElementById('inv').innerText);
    ok('the question, the categories, every item with its unit', /Is everything back in its place, and the unit locked\?/.test(t) && /HYGIENE & PPE|Hygiene & PPE/i.test(t) && /Station Setup & Logistics/i.test(t) && /Gloves - Large/.test(t) && /Box \(100\)/.test(t) && /Tent/.test(t), t.slice(0, 600));
    ok('every item starts at All back', await f.page.evaluate(() => Array.from(document.querySelectorAll('#inv [data-invrow]')).every(r => r.querySelector('button.on').getAttribute('data-st') === 'ok')));
    await f.page.click('#inv [data-inv="2"][data-st="low"]');
    await f.page.click('#inv [data-inv="19"][data-st="missing"]');
    const rows = await f.page.evaluate(() => ({ low: document.querySelector('[data-invrow="2"]').className, miss: document.querySelector('[data-invrow="19"]').className, pressed: document.querySelector('[data-inv="2"][data-st="low"]').getAttribute('aria-pressed') }));
    ok('a tap changes the row in place (running low, missing)', /low/.test(rows.low) && /missing/.test(rows.miss) && rows.pressed === 'true', rows);
    await f.page.fill('#invnote', 'One tent pole is bent.');
    await f.page.click('#invsend'); await f.page.waitForTimeout(200);
    t = await f.page.evaluate(() => document.getElementById('inv').innerText);
    ok('the place question is required', /Please say whether everything is back in its place/.test(t) && !f.calls.some(c => c.fn === 'volunteer_inventory_submit') && await f.page.evaluate(() => document.querySelector('#inv .svq').classList.contains('err')), t.slice(0, 300));
    ok('the taps and the note survive the error', await f.page.evaluate(() => /low/.test(document.querySelector('[data-invrow="2"]').className) && document.getElementById('invnote').value === 'One tent pole is bent.'));
    await f.page.check('#inv input[name="invin"][value="yes"]');
    await f.page.click('#invsend'); await f.page.waitForTimeout(300);
    const sub = f.calls.filter(c => c.fn === 'volunteer_inventory_submit');
    ok('saved: only the items not all back, the place answer, the note, the language', sub.length === 1 && JSON.stringify(sub[0].body.p.items) === JSON.stringify({ 2: 'low', 19: 'missing' }) && sub[0].body.p.in_place === true && sub[0].body.p.note === 'One tent pole is bent.' && sub[0].body.p.lang === 'en' && sub[0].body.p_token === TOK, sub);
    t = await f.page.evaluate(() => document.getElementById('inv').innerText);
    ok('thank you, with what to restock', /Thank you! The team sees your check in the Hub\./.test(t) && /Running low:\s*Gloves - Large/.test(t) && /Missing:\s*Tent/.test(t), t);
    if (SHOTS) await (await f.page.$('#inv')).screenshot({ path: SHOTS + '/inv-done.png' });
    await f.page.click('#invedit'); await f.page.waitForTimeout(150);
    ok('Change my check: the form with the answers kept', await f.page.evaluate(() => /low/.test(document.querySelector('[data-invrow="2"]').className) && /missing/.test(document.querySelector('[data-invrow="19"]').className) && document.querySelector('#inv input[name="invin"][value="yes"]').checked && document.getElementById('invnote').value === 'One tent pole is bent.'));
    ok('no page errors', f.errors.length === 0, f.errors);
    await f.page.click('[data-l="fr"]'); await f.page.waitForTimeout(150);
    t = await f.page.evaluate(() => document.getElementById('inv').innerText);
    ok('French', /Vérifiez l’entrepôt/i.test(t) && /Tout est-il à sa place/.test(t) && /Il en reste peu/.test(t) && /Manquant/.test(t) && /Enregistrer la vérification/.test(t), t.slice(0, 500));
    await f.ctx.close();

    /* 2. a check already saved shows as done; a closed check says so */
    f = await open(browser, TOK, handler(base('team_leader'), INV({ check: { in_place: false, items: [{ id: 11, state: 'low' }, { id: 1, state: 'ok' }], note: 'Lock sticks', low: 1, missing: 0, at: '2026-10-04T18:55:00Z', by: 'Melissa Keza' } }), { ok: false, reason: 'closed' }));
    t = await f.page.evaluate(() => document.getElementById('inv').innerText);
    ok('saved before: the thank-you, Napkins running low, not all in place', /Thank you!/.test(t) && /Running low:\s*Napkins \(Extra\)/.test(t) && /Not everything is back in its place yet/.test(t), t);
    await f.page.click('#invedit'); await f.page.waitForTimeout(150);
    await f.page.click('#invsend'); await f.page.waitForTimeout(300);
    t = await f.page.evaluate(() => document.getElementById('inv').innerText);
    ok('closed: says so', /The check for this serving is closed/.test(t), t.slice(-300));
    await f.ctx.close();

    /* 3. a test link before the serving: a preview that saves nothing */
    f = await open(browser, TOK, handler(base('team_leader', { survey: { open: false, questions: SQ } }), INV({ open: false, preview: true })), { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, '?test=1');
    ok('test link: asks for a preview', f.calls.some(c => c.fn === 'volunteer_inventory_get' && c.body.p_preview === true));
    t = await f.page.evaluate(() => (document.getElementById('inv') || {}).innerText || '');
    ok('test link: the preview note with the opening time', /Test preview: the check opens when the serving starts \(12:00 pm\)/.test(t), t.slice(0, 300));
    await f.page.check('#inv input[name="invin"][value="no"]'); await f.page.click('#inv [data-inv="20"][data-st="low"]');
    await f.page.click('#invsend'); await f.page.waitForTimeout(250);
    ok('test link: nothing saved, the thank-you shows', !f.calls.some(c => c.fn === 'volunteer_inventory_submit') && /Thank you!/.test(await f.page.evaluate(() => document.getElementById('inv').innerText)));
    await f.page.click('#invedit'); await f.page.waitForTimeout(150);
    ok('phone: the three choices fit, nothing scrolls sideways', await noScroll(f.page) && await f.page.evaluate(() => { const s = document.querySelector('#inv .seg'); const r = s.getBoundingClientRect(); return r.width > 250 && r.right <= window.innerWidth; }));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/inv-phone.png', fullPage: true });
    ok('no page errors (phone)', f.errors.length === 0, f.errors);
    await f.ctx.close();

    /* 4. a server: no check, not even asked */
    f = await open(browser, TOK, handler(base('server'), INV()));
    ok('a server: no check and no call', !(await f.page.evaluate(() => !!document.getElementById('inv'))) && !f.calls.some(c => c.fn === 'volunteer_inventory_get'));
    await f.ctx.close();

    /* 5. the booklet sends the team leader to the check */
    const AFTER = { leave: '13:45', end: '14:58', maps_url: 'https://www.google.com/maps/dir/?api=1&destination=888', stops: [{ k: 'serving', label: 'Place Émilie-Gamelin', address: '1500 Rue Berri', leave: '13:45' }, { k: 'storage', label: 'Storage unit', address: '888 Rue Saint-Antoine Ouest', arrive: '13:53', leave: '14:13', drive_min: 8 }] };
    const RUN = { kind: 'main', drivers: [1], names: ['Andres Villate'], with_tl: true, with_storage: true, start: '11:05', at: 'storage', drive_min: 8, total_min: 23, end: '14:13', maps_url: 'https://www.google.com/maps/dir/?api=1&destination=1500', stops: [{ k: 'storage', label: 'Storage unit', address: '888 Rue Saint-Antoine Ouest', arrive: '11:05', leave: '11:20', drive_min: 0 }, { k: 'serving', label: 'Place Émilie-Gamelin', address: '1500 Rue Berri', arrive: '11:28', drive_min: 8 }] };
    const itin = { kind: 'lead_driver', serve: '12:00', place: '1500 Rue Berri, Montréal, QC H2L 2C4', team: [], format: 'home_cooked', notes_en: [], notes_fr: [], pickups: [], dropoffs: [], storage_place: '888 Rue Saint-Antoine W', storage_access: 'Door 1', times: { start: '11:05', end: '14:13', at: 'storage', serve: '12:00', run: true }, run: RUN, after: AFTER };
    f = await open(browser, TOK, handler(base('team_leader', { itinerary: itin }), INV()), null, '?it=1');
    await f.page.waitForTimeout(300);
    ok('the booklet: Do the storage check', await f.page.evaluate(() => !!document.querySelector('#itv button[data-iv="inv"]')));
    await f.page.click('#itv button[data-iv="inv"]'); await f.page.waitForTimeout(400);
    ok('it opens the page at the check', await f.page.evaluate(() => !document.body.classList.contains('itv') && !!document.getElementById('inv') && Math.abs(document.getElementById('inv').getBoundingClientRect().top) < 120));
    ok('no page errors (booklet)', f.errors.length === 0, f.errors);
    await f.ctx.close();
  } catch (e) { fail++; console.log('FAIL exception ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
