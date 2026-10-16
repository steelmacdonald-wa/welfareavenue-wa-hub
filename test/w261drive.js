/* w261drive.js: wave261 in the Hub (16/10/26). Uses test/boot.js (stubbed Supabase, clock 25/09/26); fixture rows are made up.
   1. The CRM's Forms tab: the form groups as chips (All and the five groups with their counts) and sections; a chip shows
      one group; the editor's Group select; saving sends the group and keeps a multi's max and its options' descriptions
      (the volunteer roles' limit of 2); a new form takes the chosen group.
   2. Gifts collected on the drive's event (the Fundraising events page, the wave124 sheet): the count toward 6,000, the
      pledge that waits, Add gifts (the payload to wa261_gift_save), the number check, Confirm, Mark received, Edit,
      Remove with its confirm; an event without a campaign has no box; someone refused by wa261_gifts sees no box; phone.
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w261/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 500) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w261') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, sel) { if (!SHOTS) return; if (sel) { const l = f.page.locator(sel).first(); if (await l.count()) return l.screenshot({ path: path.join(SHOTS, name + '.png') }); } await f.page.screenshot({ path: path.join(SHOTS, name + '.png') }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ROLES = { id: 'roles', type: 'multi', label: 'How would you like to help?', required: true, to: 'volunteer.roles', max: 2,
  options: [{ v: 'server', l: 'Serving food', d: 'Set up, serve and pack up. About 2 hours.' }, { v: 'cook', l: 'Cooking (at home)', d: 'Cook one dish at home.' }] };
const Q = [{ id: 'first_name', type: 'text', label: 'First name', required: true, to: 'contact.first_name' }, { id: 'email', type: 'email', label: 'Email', required: true, to: 'contact.email' }];
function fx() {
  const x = loadFixture();
  const F = (id, slug, title, kind, purpose, extra) => Object.assign({ id, slug, title, intro: '', lang: /^(paniers|benevole|groupe|nous|infolettre)/.test(slug) ? 'fr' : 'en', kind, status: 'published', questions: Q, consent: { ask: true, required: false, label: 'Yes, email me.' }, thank_you: 'Thanks', settings: { tags: [] }, cover_photo_id: null, purpose }, extra || {});
  x.crm_forms = [
    F(1, 'volunteer', 'Volunteer with Welfare Avenue', 'volunteer', 'volunteers', { questions: Q.concat([ROLES]), settings: { tags: [], volunteer_record: true } }),
    F(3, 'newsletter', 'Get the Welfare Avenue newsletter', 'newsletter', 'other'),
    F(4, 'contact', 'Write to us', 'general', undefined),
    F(10, 'group', 'Volunteer with your group', 'volunteer', 'groups'),
    F(12, 'gift-drive-give', 'Donate gifts and essentials', 'general', 'gifts', { settings: { tags: ['gift-basket-drive'], campaign: 'gift-basket-drive', gift_pledge: true, request: { type: 'gift-drive' } } }),
    F(13, 'paniers-donner', 'Donner des cadeaux et des articles', 'general', 'gifts', { settings: { tags: ['gift-basket-drive'], campaign: 'gift-basket-drive', gift_pledge: true, request: { type: 'gift-drive' } } }),
    F(14, 'gift-drive-volunteer', 'Volunteer with the drive', 'volunteer', 'volunteers', { settings: { tags: ['gift-basket-drive'], campaign: 'gift-basket-drive', volunteer_record: true, request: { type: 'gift-drive' } } }),
    F(16, 'gift-drive-sponsor', 'Companies and sponsors', 'general', 'sponsors', { settings: { tags: [], campaign: 'gift-basket-drive', request: { type: 'gift-drive' } } }),
    F(18, 'gift-drive-group', 'Schools and groups', 'volunteer', 'groups', { settings: { tags: [], campaign: 'gift-basket-drive' } })
  ];
  x.crm_form_stats_v = x.crm_forms.map(f => ({ form_id: f.id, submissions: 0, last_7_days: 0, last_at: null, spam: 0, errors: 0, tests: 0 }));
  x.crm_fields = []; x.crm_contact_fields = []; x.crm_form_submissions = [];
  x.app_config = (x.app_config || []).filter(c => c.key !== 'donate_campaigns').concat([{ key: 'donate_campaigns', value: JSON.stringify({ 'gift-basket-drive': { name: 'Holiday Gift Basket Drive 2026', gift_goal: 6000, goal: null, fund_event_id: 4 } }) }]);
  return x;
}
/* a stateful wa261 backend in the page: rows, the counting rule, every call recorded */
const GIFTS = `window.__g = { rows: [
    { id: 1, slug: 'gift-basket-drive', quantity: 616, what: 'Books', given_by: null, received_on: '2026-10-15', status: 'received', confirmed_at: null, note: 'First donation of the drive, reported by Amanda at the 15/10/26 meeting; confirm with Amanda' },
    { id: 2, slug: 'gift-basket-drive', quantity: 40, what: 'Toys (brand new), Books', given_by: 'Acme', received_on: null, status: 'pledged', confirmed_at: null, note: 'Pledged on the website form.' } ], calls: [], next: 3, refuse: false };
  (function () {
    var r0 = db.rpc.bind(db);
    function view() { var g = window.__g, c = 0, w = 0, n = 0; g.rows.forEach(function (x) { if (x.status === 'received' || x.confirmed_at) c += x.quantity; else { w += x.quantity; n++; } });
      return { slug: 'gift-basket-drive', name: 'Holiday Gift Basket Drive 2026', gift_goal: 6000, counted: c, waiting: w, waiting_n: n, rows: JSON.parse(JSON.stringify(g.rows)) }; }
    db.rpc = function (fn, args) {
      var g = window.__g;
      if (fn === 'wa261_gifts') { g.calls.push({ fn: fn, args: args }); return Promise.resolve(g.refuse ? { data: null, error: { message: 'Only people who can open the Fundraising app see the gift count.' } } : { data: view(), error: null }); }
      if (fn === 'wa261_gift_save') {
        var p = args.p; g.calls.push({ fn: fn, p: p });
        if (p.action === 'add') { var q = Number(p.quantity); if (!(q > 0)) return Promise.resolve({ data: null, error: { message: 'How many gifts? A whole number above 0.' } }); g.rows.unshift({ id: g.next++, slug: p.slug, quantity: q, what: p.what, given_by: p.given_by, received_on: p.received_on, status: p.status, confirmed_at: p.status === 'pledged' && p.confirmed ? '2026-09-25T20:00:00Z' : null, note: p.note }); }
        var row = g.rows.filter(function (x) { return String(x.id) === String(p.id); })[0];
        if (p.action === 'confirm' && row) row.confirmed_at = '2026-09-25T20:00:00Z';
        if (p.action === 'receive' && row) { row.status = 'received'; row.received_on = p.received_on; }
        if (p.action === 'edit' && row) { row.quantity = Number(p.quantity); row.what = p.what; row.status = p.status; }
        if (p.action === 'remove') g.rows = g.rows.filter(function (x) { return String(x.id) !== String(p.id); });
        return Promise.resolve({ data: {}, error: null });
      }
      return r0(fn, args);
    };
  })();`;
const RECORD = `window.__ins = []; (function () { var f0 = db.from.bind(db); db.from = function (t) { var b = f0(t); if (t === 'crm_forms') { var u = b.update.bind(b), i = b.insert.bind(b);
  b.update = function (p) { window.__ins.push({ op: 'update', p: JSON.parse(JSON.stringify(p)) }); return u(p); }; b.insert = function (p) { window.__ins.push({ op: 'insert', p: JSON.parse(JSON.stringify(p)) }); return i(Object.assign({ id: 990 }, p)); }; } return b; }; })();`;

(async () => {
  const browser = await launch();
  /* ---------- 1. the CRM's form groups ---------- */
  let f = await fresh(browser, { who: 'admin', width: 1366, hash: '#crm/forms', fixture: fx(), wait: 5000 });
  await sleep(2500);
  await f.ev(RECORD);
  const chips = await f.ev(() => Array.from(document.querySelectorAll('#crm [data-w261grp]')).map(b => ({ k: b.getAttribute('data-w261grp'), t: b.textContent.replace(/\s+/g, ' ').trim(), on: b.classList.contains('on') })));
  ok('six chips: All and the five groups with their counts', chips.length === 6 && chips[0].t === 'All 9' && chips.some(c => c.t === 'Volunteers 2') && chips.some(c => c.t === 'Gifts and in-kind donations 2') && chips.some(c => c.t === 'Sponsors and partners 1') && chips.some(c => c.t === 'Schools and groups 2') && chips.some(c => c.t === 'Other 2') && chips[0].on, chips);
  const secs = await f.ev(() => Array.from(document.querySelectorAll('#crm [data-w261sec]')).map(s => ({ k: s.getAttribute('data-w261sec'), n: s.querySelectorAll('.w156row').length })));
  ok('sections in order, each form once (a form with no group under Other)', JSON.stringify(secs) === JSON.stringify([{ k: 'volunteers', n: 2 }, { k: 'gifts', n: 2 }, { k: 'sponsors', n: 1 }, { k: 'groups', n: 2 }, { k: 'other', n: 2 }]), secs);
  ok('a drive form says its language and campaign', await f.ev(() => /French · Holiday Gift Basket Drive/.test((document.querySelector('#crm [data-w261sec="gifts"]') || {}).innerText || '')));
  ok('the buttons are all still there (Open, Answers, Copy the link, New form)', await f.ev(() => document.querySelectorAll('#crm [data-w156open]').length >= 9 && document.querySelectorAll('#crm [data-w156answers]').length === 9 && document.querySelectorAll('#crm [data-w152copy]').length === 9 && !!document.querySelector('#crm [data-w156new]')));
  await shot(f, 'crm_forms_groups', '#crm .w154card');
  await f.page.click('#crm [data-w261grp="gifts"]'); await sleep(300);
  const one = await f.ev(() => ({ secs: Array.from(document.querySelectorAll('#crm [data-w261sec]')).map(s => s.getAttribute('data-w261sec')), on: (document.querySelector('#crm [data-w261grp].on') || {}).getAttribute ? document.querySelector('#crm [data-w261grp].on').getAttribute('data-w261grp') : '', pressed: document.querySelector('#crm [data-w261grp="gifts"]').getAttribute('aria-pressed') }));
  ok('a chip shows that group only', JSON.stringify(one.secs) === '["gifts"]' && one.on === 'gifts' && one.pressed === 'true', one);
  await shot(f, 'crm_forms_gifts_chip', '#crm .w154card');
  /* a new form while Gifts is chosen takes that group */
  await f.page.click('#crm [data-w156new]'); await sleep(600);
  const nf = await f.ev(() => (window.__ins || []).filter(x => x.op === 'insert')[0]);
  ok('a new form takes the chosen group', nf && nf.p.purpose === 'gifts' && nf.p.status === 'draft', nf);
  await f.hash('#crm/forms/1'); await sleep(900);
  const ed = await f.ev(() => { const s = document.querySelector('#crm select[data-w156k="purpose"]'); return s ? { v: s.value, opts: Array.from(s.options).map(o => o.textContent) } : null; });
  ok('the editor has a Group select set to the form\'s group', ed && ed.v === 'volunteers' && ed.opts.length === 5 && ed.opts[1] === 'Gifts and in-kind donations', ed);
  await f.page.selectOption('#crm select[data-w156k="purpose"]', 'other'); await sleep(200);
  await f.page.click('#crm [data-w156save]'); await sleep(900);
  const up = await f.ev(() => (window.__ins || []).filter(x => x.op === 'update').pop());
  const roles = up && (up.p.questions || []).filter(q => q.id === 'roles')[0];
  ok('Save sends the group', up && up.p.purpose === 'other', up && up.p.purpose);
  ok('Save keeps the roles\' limit of 2 and the options\' descriptions', roles && roles.max === 2 && roles.options.length === 2 && roles.options[0].d === 'Set up, serve and pack up. About 2 hours.' && roles.options[0].l === 'Serving food', roles);
  await f.hash('#crm/forms/12'); await sleep(900);
  ok('a drive form\'s editor names its campaign', await f.ev(() => /Holiday Gift Basket Drive: each answer is a Request for Fundraising, and a pledge in Gifts collected/.test((document.querySelector('#crm .w261camp') || {}).textContent || '')));
  ok('no page errors (CRM)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- 2. Gifts collected on the drive's event ---------- */
  f = await fresh(browser, { who: 'admin', width: 1366, hash: '#fundevents', fixture: fx(), wait: 5000 });
  await sleep(2500); await f.ev(GIFTS);
  await f.page.click('[data-w124fund="4"]'); await sleep(900);
  const b0 = await f.ev(() => { const b = document.querySelector('#w124sheet .w261g'); return b ? { hidden: b.hidden, t: b.innerText, rows: b.querySelectorAll('.w261r').length, wait: b.querySelectorAll('.w261r.wait').length, bar: (b.querySelector('.w261bar') || {}).getAttribute ? b.querySelector('.w261bar').getAttribute('aria-valuenow') : null } : null; });
  ok('the drive\'s event shows Gifts collected: 616 of 6,000', b0 && !b0.hidden && /Gifts collected/i.test(b0.t) && /616\s*of 6,000/.test(b0.t) && b0.bar === '616', b0);
  ok('the pledge from the form waits for a Confirm (and is not counted)', b0 && b0.rows === 2 && b0.wait === 1 && /One pledge waits for a Confirm \(40 items\)/.test(b0.t), b0 && b0.t);
  ok('the seed says what it is', b0 && /616\s*Books/.test(b0.t) && /Received 15 Oct 2026/.test(b0.t) && /confirm with Amanda/.test(b0.t), b0 && b0.t);
  await shot(f, 'fund_gifts_box', '#w124sheet .w261g');
  /* Add gifts: the number check, then a received batch */
  await f.page.click('#w124sheet [data-w261do="add"]'); await sleep(200);
  ok('Add gifts opens the form with the quantity focused', await f.ev(() => document.activeElement && document.activeElement.name === 'quantity' && !!document.querySelector('#w124sheet .w261f')));
  await f.page.click('#w124sheet .w261f button[type="submit"]'); await sleep(200);
  ok('a quantity is required', await f.ev(() => /whole number above 0/.test((document.querySelector('#w124sheet .w261err') || {}).textContent || '') && !window.__g.calls.some(c => c.fn === 'wa261_gift_save')));
  await f.page.fill('#w124sheet .w261f input[name="quantity"]', '120'); await f.page.fill('#w124sheet .w261f input[name="what"]', 'Hygiene kits'); await f.page.fill('#w124sheet .w261f input[name="given_by"]', 'Concordia club');
  await shot(f, 'fund_gifts_add', '#w124sheet .w261g');
  await f.page.click('#w124sheet .w261f button[type="submit"]'); await sleep(500);
  const add = await f.ev(() => window.__g.calls.filter(c => c.fn === 'wa261_gift_save').pop());
  ok('Add sends the batch to wa261_gift_save', add && add.p.action === 'add' && add.p.slug === 'gift-basket-drive' && add.p.quantity === '120' && add.p.what === 'Hygiene kits' && add.p.given_by === 'Concordia club' && add.p.status === 'received' && add.p.received_on === '2026-09-25', add);
  ok('the count goes to 736 and says so', await f.ev(() => /736\s*of 6,000/.test(document.querySelector('#w124sheet .w261g').innerText) && /Added: 120 more on the website/.test(document.querySelector('#w124sheet .w261ok').textContent)));
  /* a pledge not yet confirmed */
  await f.page.click('#w124sheet [data-w261do="add"]'); await sleep(200);
  await f.page.fill('#w124sheet .w261f input[name="quantity"]', '30'); await f.page.selectOption('#w124sheet .w261f select[name="status"]', 'pledged'); await sleep(100);
  ok('Pledged shows the confirmed box, ticked', await f.ev(() => { const c = document.querySelector('#w124sheet [data-w261conf]'); return c && !c.hidden && c.querySelector('input').checked; }));
  await f.page.uncheck('#w124sheet .w261f input[name="confirmed"]');
  await f.page.click('#w124sheet .w261f button[type="submit"]'); await sleep(500);
  ok('an unconfirmed pledge is saved waiting, not counted', await f.ev(() => { const c = window.__g.calls.filter(x => x.fn === 'wa261_gift_save').pop(); return c.p.status === 'pledged' && c.p.confirmed === false && /736\s*of 6,000/.test(document.querySelector('#w124sheet .w261g').innerText) && /2 pledges wait/.test(document.querySelector('#w124sheet .w261g').innerText); }));
  /* Confirm the website's pledge */
  await f.page.click('#w124sheet [data-w261row="2"] [data-w261do="confirm"]'); await sleep(500);
  ok('Confirm counts the pledge (776)', await f.ev(() => window.__g.calls.some(c => c.fn === 'wa261_gift_save' && c.p.action === 'confirm' && String(c.p.id) === '2') && /776\s*of 6,000/.test(document.querySelector('#w124sheet .w261g').innerText)));
  await f.page.click('#w124sheet [data-w261row="2"] [data-w261do="receive"]'); await sleep(500);
  ok('Mark received', await f.ev(() => window.__g.calls.some(c => c.p && c.p.action === 'receive' && String(c.p.id) === '2') && /Received 25 Sep 2026/.test(document.querySelector('#w124sheet [data-w261row="2"]').innerText)));
  /* Edit */
  await f.page.click('#w124sheet [data-w261row="1"] [data-w261do="edit"]'); await sleep(200);
  ok('Edit fills the form with the batch', await f.ev(() => { const fm = document.querySelector('#w124sheet [data-w261row="1"] .w261f'); return fm && fm.quantity.value === '616' && fm.what.value === 'Books' && fm.status.value === 'received'; }));
  await f.page.fill('#w124sheet [data-w261row="1"] .w261f input[name="quantity"]', '620');
  await f.page.click('#w124sheet [data-w261row="1"] .w261f button[type="submit"]'); await sleep(500);
  ok('Edit saves (780)', await f.ev(() => { const c = window.__g.calls.filter(x => x.fn === 'wa261_gift_save').pop(); return c.p.action === 'edit' && String(c.p.id) === '1' && c.p.quantity === '620' && /780\s*of 6,000/.test(document.querySelector('#w124sheet .w261g').innerText); }));
  /* Remove asks first */
  const nb = await f.ev(() => window.__g.calls.length);
  await f.page.click('#w124sheet [data-w261row="1"] [data-w261do="remove"]'); await sleep(200);
  ok('Remove asks first and sends nothing yet', await f.ev((n) => /Remove this batch of 620\?/.test(document.querySelector('#w124sheet [data-w261row="1"] .w261cf').textContent) && window.__g.calls.length === n, nb));
  await shot(f, 'fund_gifts_remove', '#w124sheet .w261g');
  await f.page.click('#w124sheet [data-w261do="keep"]'); await sleep(200);
  ok('Keep it leaves it', await f.ev(() => !document.querySelector('#w124sheet .w261cf') && !!document.querySelector('#w124sheet [data-w261row="1"]')));
  await f.page.click('#w124sheet [data-w261row="1"] [data-w261do="remove"]'); await sleep(150);
  await f.page.click('#w124sheet [data-w261do="removeok"]'); await sleep(500);
  ok('Remove it removes the batch', await f.ev(() => window.__g.calls.some(c => c.p && c.p.action === 'remove' && String(c.p.id) === '1') && !document.querySelector('#w124sheet [data-w261row="1"]')));
  ok('the event sheet keeps its own actions (Edit, Record the result, Project board, SOP)', await f.ev(() => !!document.querySelector('#w124sheet [data-w124fedit="4"]') && !!document.querySelector('#w124sheet [data-w124fdone="4"]')));
  /* another event: no box */
  await f.page.click('#w124sheet .x[data-w124close]'); await sleep(300);
  await f.page.click('[data-w124fund="2"]'); await sleep(700);
  ok('an event without a campaign has no box', await f.ev(() => !!document.querySelector('#w124sheet .pane h2') && !document.querySelector('#w124sheet .w261g')));
  ok('no page errors (Fundraising)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- refused by the database: no box ---------- */
  f = await fresh(browser, { who: 'plain', width: 1366, hash: '#fundevents', fixture: fx(), wait: 5000 });
  await sleep(2500); await f.ev(GIFTS); await f.ev(() => { window.__g.refuse = true; });
  const card = await f.ev(() => !!document.querySelector('[data-w124fund="4"]'));
  if (card) { await f.page.click('[data-w124fund="4"]'); await sleep(800); }
  ok('someone wa261_gifts refuses sees no Gifts collected box', !card || await f.ev(() => !document.querySelector('#w124sheet .w261g')));
  await f.close();

  /* ---------- phone ---------- */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#fundevents', fixture: fx(), wait: 5000 });
  await sleep(2500); await f.ev(GIFTS);
  await f.page.click('[data-w124fund="4"]'); await sleep(900);
  await f.page.click('#w124sheet [data-w261do="add"]'); await sleep(200);
  const ph = await f.ev(() => { const b = document.querySelector('#w124sheet .w261g'); const r = b.getBoundingClientRect(); const pane = document.querySelector('#w124sheet .pane'); return { w: r.width, right: r.right, vw: innerWidth, sx: pane.scrollWidth - pane.clientWidth }; });
  ok('phone: the box and its form fit', ph.right <= ph.vw && ph.sx <= 1, ph);
  await shot(f, 'phone_fund_gifts', '#w124sheet .pane');
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
