/* w155drive.js: lists and campaigns (wave155). Fixture rows are made up for the test (no real people); mail-send and the
   list RPCs are stubbed on the page and every call is recorded.
   An admin opens the Lists tab: the saved list with its size, a new list built from groups (and inside, or between), the live
   count from crm_list_preview, saving (the insert carries the groups), the Contacts filters turned into conditions. Then the
   Campaigns tab: the campaign list with results, a new campaign (kinds, senders), the preview, a test to themselves, Send in
   test mode (held with the note), Send in live mode (the confirmation, then campaign_queue), a sent campaign's report with its
   recipients. The rail lists Lists and Campaigns. On a phone nothing overflows. usage: node test/w155drive.js */
const { launch, fresh, loadFixture } = require('./boot');
const fs = require('fs');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name) { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: true }); }
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['volunteer'], tags: [], source: 'django_website_export', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'wa150_backfill', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [] }, o || {});
}
const T = (key, name, kind, subject, sort) => ({ key, name, kind, subject, preheader: 'A line for the inbox', html_body: '<h1>' + name + '</h1><p>Hi {{first_name|there}},</p><a class="btn" href="https://welfareavenue.com">Go</a>', text_body: 'Hi', vars: [], active: true, sort, updated_by: 'wave154', updated_at: '2026-09-28T00:00:00Z' });
function fixture(extra) {
  const fx = loadFixture();
  fx.crm_contacts_v = [
    C(5001, 'Amara Okafor', { emails: ['amara.okafor@example.com'], primary_email: 'amara.okafor@example.com', kinds: ['volunteer', 'donor'], email_status: 'subscribed', email_consent: 'express', consent_source: 'the website form', consent_at: '2026-03-01T15:00:00Z', donation_total: 225, donation_count: 2, last_donation_at: '2026-08-30T15:00:00Z' }),
    C(5002, 'Élodie Gagnon', { emails: ['elodie.gagnon@example.com'], primary_email: 'elodie.gagnon@example.com', kinds: ['supporter'] }),
    C(5003, 'Priya Raman', { emails: ['priya.raman@example.com'], primary_email: 'priya.raman@example.com', kinds: ['donor'], email_consent: 'implied', implied_consent_until: '2027-12-01', consent_source: 'implied: gift on 2025-12-01 (registered charity, CASL s.10(13))', donation_total: 125, donation_count: 1, last_donation_at: '2025-12-01T15:00:00Z' }),
    C(5004, 'Marcus Bell', { emails: ['marcus.bell@example.com'], primary_email: 'marcus.bell@example.com', kinds: ['volunteer'], email_status: 'bounced' }),
    C(5005, 'Noor Haddad', { emails: ['noor.haddad@example.com'], primary_email: 'noor.haddad@example.com', kinds: ['supporter'], email_status: 'unsubscribed' }),
    C(5006, 'Sam Lee', { kinds: ['volunteer'] })
  ];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_donations = [];
  fx.crm_interactions = [
    { id: 901, contact_id: 5001, kind: 'email', direction: 'out', channel: 'email', subject: 'Thank you, Amara', body: 'Hi Amara, ...', occurred_at: '2026-09-20T15:00:00Z', source: 'resend', source_ref: 'send:10', meta: { send_id: 10, template: 'thank_you_gift', template_name: 'Thank you for a gift', kind: 'transactional', status: 'delivered', opens: 1 }, created_at: '2026-09-20T15:00:00Z', created_by: 'steel.macdonald@welfareavenue.com' },
    { id: 902, contact_id: 5001, kind: 'note', direction: 'internal', subject: null, body: 'Likes to be called Amara.', occurred_at: '2026-09-10T15:00:00Z', source: 'hub', source_ref: null, meta: null, created_at: '2026-09-10T15:00:00Z', created_by: 'steel.macdonald@welfareavenue.com' }
  ];
  fx.crm_email_templates = [T('test', 'A test message', 'test', 'A test from the Welfare Avenue Hub', 1), T('welcome_volunteer', 'Welcome, new volunteer', 'transactional', 'Welcome to Welfare Avenue, {{first_name|friend}}', 10),
    T('thank_you_gift', 'Thank you for a gift', 'transactional', 'Thank you, {{first_name|friend}}', 20), T('serving_reminder', 'Reminder before a serving', 'transactional', 'See you {{event_day|soon}}', 30), T('newsletter', 'Newsletter', 'newsletter', '{{subject|News from Welfare Avenue}}', 40)];
  fx.crm_email_sends = [
    { id: 10, contact_id: 5001, to_email: 'amara.okafor@example.com', template_key: 'thank_you_gift', kind: 'transactional', subject: 'Thank you, Amara', status: 'delivered', is_test: false, permission_basis: 'transactional: a confirmation, reminder or receipt, not a commercial message', error: null, sent_at: '2026-09-20T15:00:00Z', delivered_at: '2026-09-20T15:00:20Z', opened_at: '2026-09-20T16:00:00Z', clicked_at: null, bounced_at: null, created_at: '2026-09-20T15:00:00Z', created_by: 'steel.macdonald@welfareavenue.com', meta: {} },
    { id: 11, contact_id: 5002, to_email: 'elodie.gagnon@example.com', template_key: 'newsletter', kind: 'newsletter', subject: null, status: 'suppressed', is_test: false, permission_basis: 'no consent recorded', error: null, sent_at: null, delivered_at: null, opened_at: null, clicked_at: null, bounced_at: null, created_at: '2026-09-21T15:00:00Z', created_by: 'steel.macdonald@welfareavenue.com', meta: {} },
    { id: 12, contact_id: null, to_email: 'steel.macdonald@welfareavenue.com', template_key: 'test', kind: 'test', subject: 'A test from the Welfare Avenue Hub', status: 'sent', is_test: true, permission_basis: 'test recipient', error: null, sent_at: '2026-09-22T15:00:00Z', delivered_at: null, opened_at: null, clicked_at: null, bounced_at: null, created_at: '2026-09-22T15:00:00Z', created_by: 'steel.macdonald@welfareavenue.com', meta: {} }
  ];
  fx.app_config = (fx.app_config || []).concat([{ key: 'mail_mode', value: 'test' }, { key: 'mail_test_recipients', value: 'steelmacdonald@gmail.com, steel.macdonald@welfareavenue.com' }]);
  if (extra) extra(fx);
  return fx;
}

function fixture155() {
  return fixture(fx => {
    fx.crm_lists = [{ id: 71, name: 'Volunteers who served this year', description: null, kind: 'dynamic', filter: { groups: [{ all: [{ f: 'kind', op: 'is', v: 'volunteer' }, { f: 'served', op: 'within', v: '365' }] }] }, member_ids: [], created_by: 'steel.macdonald@welfareavenue.com', created_at: '2026-09-27T20:00:00Z', updated_by: 'steel.macdonald@welfareavenue.com', updated_at: '2026-09-27T20:00:00Z' }];
    fx.crm_campaigns = [
      { id: 81, name: 'October call-out', list_id: 71, template_key: 'newsletter', kind: 'volunteer', subject: 'Sunday needs you', preheader: 'Servers wanted', vars: { headline: 'Join us Sunday', body_text: 'Hi {{first_name|there}},\n\nWe serve at noon.', body_html: '<p>Hi</p>', cta_label: 'Sign up', cta_url: 'https://welfareavenue.com' }, status: 'draft', audience: null, eligible: null, held: null, queued_at: null, sent_at: null, cancelled_at: null, from_name: null, from_email: null, reply_to: null, created_by: 'steel.macdonald@welfareavenue.com', created_at: '2026-09-27T21:00:00Z', updated_by: 'steel.macdonald@welfareavenue.com', updated_at: '2026-09-27T21:00:00Z' },
      { id: 80, name: 'September news', list_id: 71, template_key: 'newsletter', kind: 'newsletter', subject: 'What we did together', preheader: null, vars: {}, status: 'sent', audience: 3, eligible: 1, held: 2, queued_at: '2026-09-20T15:00:00Z', sent_at: '2026-09-20T15:02:00Z', cancelled_at: null, from_name: null, from_email: null, reply_to: null, created_by: 'steel.macdonald@welfareavenue.com', created_at: '2026-09-20T14:00:00Z', updated_by: 'steel.macdonald@welfareavenue.com', updated_at: '2026-09-20T15:00:00Z' }
    ];
    fx.crm_campaign_stats_v = [{ campaign_id: 80, total: 3, queued: 0, sent: 1, delivered: 1, opened: 1, clicked: 0, bounced: 0, complained: 0, failed: 0, suppressed: 2, cancelled: 0, unsubscribed: 0, first_sent_at: '2026-09-20T15:01:00Z', last_sent_at: '2026-09-20T15:01:00Z' }, { campaign_id: 81, total: 0, queued: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, failed: 0, suppressed: 0, cancelled: 0, unsubscribed: 0 }];
    fx.crm_email_sends = fx.crm_email_sends.map(r => Object.assign({ campaign_id: null }, r)).concat([
      { id: 30, contact_id: 5001, to_email: 'amara.okafor@example.com', template_key: 'newsletter', kind: 'newsletter', subject: 'What we did together', status: 'delivered', is_test: false, permission_basis: 'express consent', error: null, sent_at: '2026-09-20T15:01:00Z', delivered_at: '2026-09-20T15:01:20Z', opened_at: '2026-09-20T16:00:00Z', clicked_at: null, bounced_at: null, created_at: '2026-09-20T15:00:00Z', created_by: 'steel.macdonald@welfareavenue.com', meta: {}, campaign_id: 80 },
      { id: 31, contact_id: 5002, to_email: 'elodie.gagnon@example.com', template_key: 'newsletter', kind: 'newsletter', subject: null, status: 'suppressed', is_test: false, permission_basis: 'no consent recorded', error: null, sent_at: null, delivered_at: null, opened_at: null, clicked_at: null, bounced_at: null, created_at: '2026-09-20T15:00:00Z', created_by: 'steel.macdonald@welfareavenue.com', meta: {}, campaign_id: 80 }]);
  });
}
const STUB = `(function(){
  window.__calls = []; window.__ins = []; window.__rpc = [];
  window.__mode = 'test';
  window.__mailStub = function (name, opts) {
    var b = (opts && opts.body) || {}; window.__calls.push(Object.assign({ fn: name }, b));
    var SET = { mail_mode: window.__mode, mail_from_name: 'Welfare Avenue', mail_from_email: 'info@welfareavenue.com', mail_reply_to: 'info@welfareavenue.com', mail_test_recipients: 'steelmacdonald@gmail.com, steel.macdonald@welfareavenue.com', mail_daily_cap: '100', mail_campaign_daily_cap: '80', mail_domain: 'welfareavenue.com' };
    if (b.action === 'settings') return Promise.resolve({ data: { settings: SET, key_present: true, domain: null, admin: true, me: 'steel.macdonald@welfareavenue.com', last30: {} }, error: null });
    if (b.action === 'preview') return Promise.resolve({ data: { subject: b.subject || 'News', preheader: b.preheader || '', html: '<!DOCTYPE html><html><body><h1>' + ((b.vars && b.vars.headline) || '') + '</h1></body></html>', text: 'Hi', kind: b.kind, from: b.from_email ? (b.from_name || '') + ' <' + b.from_email + '>' : 'Welfare Avenue <info@welfareavenue.com>' }, error: null });
    if (b.action === 'campaign_test') return Promise.resolve({ data: { send_id: 90, status: 'sent', to: b.to }, error: null });
    if (b.action === 'campaign_check' || b.action === 'campaign_queue') {
      var sum = { audience: 3, eligible: 2, held: 1, duplicates: 0, why: { unsubscribed: 1 }, mode: window.__mode, per_day: 80, days: 1, usage: { room: 80 } };
      if (b.action === 'campaign_queue' && window.__mode !== 'live') return Promise.resolve({ data: null, error: { message: 'test mode', context: { json: function () { return Promise.resolve(Object.assign({ error: 'The Hub is in test mode' }, sum)); } } } });
      if (b.action === 'campaign_queue') return Promise.resolve({ data: Object.assign({ queued: 2, first: { sent: 2 } }, sum), error: null });
      return Promise.resolve({ data: sum, error: null });
    }
    if (b.action === 'campaign_cancel') return Promise.resolve({ data: { ok: true, cancelled: 0 }, error: null });
    return Promise.resolve({ data: { ok: true }, error: null });
  };
})();`;
const patch = f => f.ev(() => {
  db.functions.invoke = window.__mailStub;
  const rpc0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    if (fn === 'crm_list_sizes') return Promise.resolve({ data: [{ list_id: 71, members: 3 }], error: null });
    if (fn === 'crm_list_preview') {
      const gs = (args && args.p_filter && args.p_filter.groups) || [];
      const vol = JSON.stringify(gs).indexOf('"volunteer"') >= 0;
      return Promise.resolve({ data: vol ? [5001, 5004, 5006] : [5001, 5002, 5003, 5004, 5005, 5006], error: null });
    }
    return rpc0(fn, args);
  };
  const from0 = db.from.bind(db);
  db.from = function (t) { const q = from0(t); const ins = q.insert, up = q.update; q.insert = function (p) { window.__ins.push({ t: t, op: 'insert', p: JSON.parse(JSON.stringify(p)) }); if (p && !Array.isArray(p) && (t === 'crm_campaigns' || t === 'crm_lists')) p = Object.assign({ id: 900 + window.__ins.length }, p); return ins.call(this, p); }; q.update = function (p) { window.__ins.push({ t: t, op: 'update', p: JSON.parse(JSON.stringify(p)) }); return up.call(this, p); }; return q; };
  return true;
});
const text = (f, s) => f.ev(x => { const el = document.querySelector(x); return el ? el.innerText.replace(/\s+/g, ' ').trim() : null; }, s);
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture155(), init: STUB, wait: 4000 });
  await patch(f);
  await f.hash('#crm/lists', 2400);
  const tabs = await f.ev(() => [...document.querySelectorAll('#crm .w152tabs button')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')));
  ok('the CRM has seven tabs and #crm/lists marks Lists', tabs.length === 7 && tabs[5] === 'Lists*' && tabs[6] === 'Campaigns', tabs);
  const rows = await f.ev(() => [...document.querySelectorAll('#crm .w155row')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
  ok('the saved list shows its name, Live, its size from crm_list_sizes and its conditions in words', rows.length === 1 && /Volunteers who served this year/.test(rows[0]) && /Live/.test(rows[0]) && /3 people/.test(rows[0]) && /Contact type is Volunteer and Served at an event in the last 365 days/.test(rows[0]), rows);
  await shot(f, 'lists');
  /* a new list */
  await click(f, '[data-w155new]'); await f.page.waitForTimeout(700);
  let b = await f.ev(() => ({ conds: document.querySelectorAll('#crm .w155c').length, res: (document.querySelector('#crm [data-w155res]') || {}).innerText, rpc: window.__rpc.filter(r => r.fn === 'crm_list_preview').pop() }));
  ok('New list opens the builder with one condition (contact type is volunteer) and counts it live through crm_list_preview', b.conds === 1 && /3 people match/.test(b.res || '') && b.rpc && JSON.stringify(b.rpc.args.p_filter.groups) === JSON.stringify([{ all: [{ f: 'kind', op: 'is', v: 'volunteer' }] }]), b);
  ok('the count splits who can get a newsletter, a call-out, and who has no email', /1 can get a newsletter/.test(b.res || '') && /1 can get a volunteer call-out/.test(b.res || '') && /1 have no email/.test(b.res || ''), b.res);
  await click(f, '[data-w155and="0"]'); await f.page.waitForTimeout(200);
  await click(f, '[data-w155or]'); await f.page.waitForTimeout(200);
  await setv(f, '[data-w155cf="1.0"]', 'city'); await f.page.waitForTimeout(150);
  await setv(f, '[data-w155cv="1.0"]', 'Toronto'); await f.page.waitForTimeout(700);
  b = await f.ev(() => ({ groups: document.querySelectorAll('#crm .w155g').length, conds: document.querySelectorAll('#crm .w155c').length, or: !!document.querySelector('#crm .w155or'), last: window.__rpc.filter(r => r.fn === 'crm_list_preview').pop() }));
  ok('+ And adds a condition to the group, + Or adds a second group, and the count follows the conditions', b.groups === 2 && b.conds === 3 && b.or && b.last && b.last.args.p_filter.groups.length === 2 && b.last.args.p_filter.groups[1].all[0].f === 'city' && b.last.args.p_filter.groups[1].all[0].v === 'Toronto' && b.last.args.p_filter.groups[0].all[1].f === 'served', b);
  await shot(f, 'list_builder');
  await setv(f, '[data-w155f="name"]', 'Volunteers or Toronto');
  await click(f, '[data-w155save="dynamic"]'); await f.page.waitForTimeout(800);
  const ins = await f.ev(() => window.__ins.filter(x => x.t === 'crm_lists').pop());
  ok('Save as a live list inserts the name, kind dynamic and the groups', ins && ins.op === 'insert' && ins.p.name === 'Volunteers or Toronto' && ins.p.kind === 'dynamic' && ins.p.filter.groups.length === 2 && ins.p.created_by === 'steel.macdonald@welfareavenue.com', ins);
  await click(f, '[data-w155new]'); await f.page.waitForTimeout(500);
  await setv(f, '[data-w155f="name"]', 'Fixed volunteers');
  await click(f, '[data-w155save="static"]'); await f.page.waitForTimeout(800);
  const ins2 = await f.ev(() => window.__ins.filter(x => x.t === 'crm_lists').pop());
  ok('Save as a fixed list keeps the ids the conditions select today', ins2 && ins2.p.kind === 'static' && JSON.stringify(ins2.p.member_ids) === JSON.stringify([5001, 5004, 5006]), ins2);
  const g = await f.ev(() => { const u = window.w152.state().ui; u.kind = 'volunteer'; u.perm = 'express'; u.act = 'never'; u.q = 'amara'; return window.w155.groups(); });
  ok('the Contacts filters become conditions (type, never served, permission, search)', JSON.stringify(g) === JSON.stringify([{ all: [{ f: 'kind', op: 'is', v: 'volunteer' }, { f: 'kind', op: 'is', v: 'volunteer' }, { f: 'served', op: 'never' }, { f: 'perm', op: 'is', v: 'express' }, { f: 'search', op: 'contains', v: 'amara' }] }]), g);
  await f.ev(() => { const u = window.w152.state().ui; u.kind = ''; u.perm = ''; u.act = ''; u.q = ''; });
  /* campaigns */
  await f.hash('#crm/campaigns', 1800);
  const cl = await f.ev(() => [...document.querySelectorAll('#crm .w155cr')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
  ok('the Campaigns tab lists the draft and the sent campaign with its results', cl.length === 2 && /October call-out/.test(cl[0]) && /Draft/.test(cl[0]) && /not sent/.test(cl[0]) && /September news/.test(cl[1]) && /Sent/.test(cl[1]) && /1 sent · 100% opened · 0% clicked/.test(cl[1]), cl);
  await shot(f, 'campaigns');
  await click(f, '[data-w155cnew]'); await f.page.waitForTimeout(900);
  const ed = await f.ev(() => ({ kinds: [...document.querySelectorAll('#crm [data-w155k="kind"] option')].map(o => o.textContent), from: [...document.querySelectorAll('#crm [data-w155k="from"] option')].map(o => o.textContent), list: (document.querySelector('#crm [data-w155k="list_id"]') || {}).value, mode: (document.querySelector('#crm .w155mode') || {}).innerText, hash: location.hash }));
  ok('New campaign: three kinds (newsletter, appeal, volunteer call-out), senders (Welfare Avenue, me, someone else), the first list chosen, the test-mode line', ed.hash === '#crm/campaigns/new' && ed.kinds.join('|') === 'Newsletter|Fundraising appeal|Volunteer call-out' && /Welfare Avenue <info@welfareavenue.com>/.test(ed.from[0]) && /steel.macdonald@welfareavenue.com/.test(ed.from[1]) && /Someone else/.test(ed.from[2]) && ed.list === '71' && /Test mode/.test(ed.mode || ''), ed);
  await setv(f, '#crm [data-w155k="name"]', 'Test call-out');
  await setv(f, '#crm [data-w155k="kind"]', 'volunteer'); await f.page.waitForTimeout(200);
  await setv(f, '#crm [data-w155k="from"]', 'me'); await f.page.waitForTimeout(200);
  await setv(f, '#crm [data-w155k="subject"]', 'Sunday needs you, {{first_name|friend}}');
  await setv(f, '#crm [data-w155k="headline"]', 'Join us Sunday');
  await setv(f, '#crm [data-w155k="body"]', 'Hi {{first_name|there}},\n\nWe serve at noon.\nBring shoes.');
  await click(f, '[data-w155cprev]'); await f.page.waitForTimeout(800);
  const pv = await f.ev(() => ({ call: window.__calls.filter(c => c.action === 'preview').pop(), frame: !!document.querySelector('#crm .w154frame') }));
  ok('Preview sends the kind, the subject and the message (paragraphs, line breaks) and shows the email', pv.frame && pv.call && pv.call.kind === 'volunteer' && /Sunday needs you/.test(pv.call.subject) && pv.call.vars.body_html === '<p>Hi {{first_name|there}},</p><p>We serve at noon.<br>Bring shoes.</p>' && pv.call.from_email === 'steel.macdonald@welfareavenue.com', pv.call);
  await click(f, '[data-w155ctest]'); await f.page.waitForTimeout(1200);
  const tst = await f.ev(() => ({ ins: window.__ins.filter(x => x.t === 'crm_campaigns').pop(), call: window.__calls.filter(c => c.action === 'campaign_test').pop(), msg: (document.querySelector('#crm .w154msg') || {}).innerText }));
  ok('Send me a test saves the draft (kind volunteer, sender me, status draft) and sends the test to the caller', tst.ins && tst.ins.op === 'insert' && tst.ins.p.status === 'draft' && tst.ins.p.kind === 'volunteer' && tst.ins.p.from_email === 'steel.macdonald@welfareavenue.com' && tst.call && tst.call.to === 'steel.macdonald@welfareavenue.com' && /Test sent/.test(tst.msg || ''), tst);
  await click(f, '[data-w155csend]'); await f.page.waitForTimeout(1200);
  const tm = await f.ev(() => ({ chk: (document.querySelector('#crm .w155chk') || {}).innerText, go: !!document.querySelector('[data-w155cgo]') }));
  ok('Send… in test mode shows who would get it and why others are held, and offers no Send it', /2 people get it/.test(tm.chk || '') && /unsubscribed: 1/.test(tm.chk || '') && /test mode/.test(tm.chk || '') && !tm.go, tm);
  await shot(f, 'campaign_test_mode');
  await f.close();

  /* live mode from the start: Send asks, then queues */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture155(), init: STUB + 'window.__mode = "live";', wait: 4000 });
  await patch(f);
  await f.ev(() => { window.__mode = 'live'; });
  await f.hash('#crm/campaigns/81', 2000);
  const dr = await f.ev(() => ({ subject: (document.querySelector('#crm [data-w155k="subject"]') || {}).value, body: (document.querySelector('#crm [data-w155k="body"]') || {}).value, kind: (document.querySelector('#crm [data-w155k="kind"]') || {}).value }));
  ok('a draft opens in the editor with its words (subject, message, kind)', dr.subject === 'Sunday needs you' && /We serve at noon/.test(dr.body || '') && dr.kind === 'volunteer', dr);
  await click(f, '[data-w155csend]'); await f.page.waitForTimeout(1200);
  const cf = await f.ev(() => ({ chk: (document.querySelector('#crm .w155chk') || {}).innerText, go: !!document.querySelector('[data-w155cgo]') }));
  ok('in live mode Send… asks first: Send it to 2 people now?', /Send it to 2 people now/.test(cf.chk || '') && cf.go, cf);
  await click(f, '[data-w155cgo]'); await f.page.waitForTimeout(1200);
  const q = await f.ev(() => ({ call: window.__calls.filter(c => c.action === 'campaign_queue').pop(), hash: location.hash, msg: (document.querySelector('#crm .w154msg') || {}).innerText }));
  ok('Send it calls campaign_queue for the campaign and comes back to the list with the news', q.call && q.call.campaign_id === 81 && /Sending to 2 people/.test(q.msg || '') && /the first 2 went out/.test(q.msg || ''), q);
  /* a sent campaign's report */
  await f.hash('#crm/campaigns/80', 1600);
  const rp = await f.ev(() => ({ card: (document.querySelector('#crm .w154card') || {}).innerText.replace(/\s+/g, ' '), rows: [...document.querySelectorAll('#crm .w154sr')].map(r => r.innerText.replace(/\s+/g, ' ').trim()), stop: !!document.querySelector('[data-w155cstop]') }));
  ok('a sent campaign shows its report: 1 of 1 sent, opened 100%, held back by the rule 2, and its recipients with their status', /1 email sent of 1 person/.test(rp.card) && /opened \(100%\)/.test(rp.card) && /held back by the rule/.test(rp.card) && rp.rows.length === 2 && /Amara Okafor/.test(rp.rows[0]) && /Delivered/.test(rp.rows[0]) && /opened/.test(rp.rows[0]) && /Not sent/.test(rp.rows[1]) && /no consent recorded/.test(rp.rows[1]) && !rp.stop, rp);
  await shot(f, 'campaign_report');
  await click(f, '[data-w155cdup]'); await f.page.waitForTimeout(700);
  const dup = await f.ev(() => ({ name: (document.querySelector('#crm [data-w155k="name"]') || {}).value, hash: location.hash }));
  ok('Copy into a new draft opens the editor with the words of the sent campaign', dup.name === 'September news (copy)' && dup.hash === '#crm/campaigns/new', dup);
  /* the rail */
  const rail = await f.ev(() => [...document.querySelectorAll('#w153rail .w153it')].map(a => a.textContent.trim()));
  ok('the CRM rail lists Lists under Contacts and Campaigns under Email', rail.join('|') === 'Contacts|Possible duplicates|Sources|Lists|Gifts|Email|Campaigns', rail);
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* a phone */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture155(), init: STUB, wait: 4200 });
  await patch(f);
  await f.hash('#crm/lists', 2200);
  await click(f, '[data-w155new]'); await f.page.waitForTimeout(700);
  const ph1 = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  await shot(f, 'phone_lists');
  await f.hash('#crm/campaigns/new', 1800);
  const ph2 = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  await shot(f, 'phone_campaign');
  ok('on a phone the list builder and the campaign editor fit the screen', ph1.sw <= ph1.w + 1 && ph2.sw <= ph2.w + 1, [ph1, ph2]);
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
