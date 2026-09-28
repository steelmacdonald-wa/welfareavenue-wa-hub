/* w161drive.js: Online giving in the CRM (wave161). Fixture rows are made up for the test. The Gifts tab has an Online giving
   button; #crm/gifts/online shows the donation page (off, with a preview link and what Stripe has set up), Put it live asks
   first and calls crm_donate_mode_set, the settings save as admin-only app_config rows (and a bad amount is refused before
   saving), the year's online gifts and fees, the monthly gifts with their states, and (admins) what Stripe told the Hub. A
   member sees it all read-only, without the switch or the events. In the gifts list a refund shows; a Stripe gift's sheet says
   where it came from, its fee and net, and links to Stripe. Leaving Keela's donation step follows the page. On a phone
   nothing scrolls sideways. usage: node test/w161drive.js */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [full_name.toLowerCase().replace(/\s+/g, '.') + '@example.org'], phones: [], primary_email: null,
    address: null, city: null, province: null, postal_code: null, country: null, language: null, kinds: ['donor'], tags: [], source: 'hub_donation', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-09-20T14:00:00Z', updated_at: '2026-09-20T14:00:00Z',
    created_by: 'donation page', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [] }, o || {});
}
function G(id, cid, amount, day, o) {
  return Object.assign({ id, contact_id: cid, amount, currency: 'CAD', donated_at: day + 'T15:00:00Z', platform: 'stripe', campaign: null, designation: 'Where it is needed most', recurring: false, receipt_number: null,
    receipt_issued_at: null, receipt_url: null, receipt_source: null, receipt_eligible: true, external_id: 'pi_' + id, notes: 'Online gift through the Hub’s donation page.', kind: 'donation', method: null,
    advantage_amount: 0, advantage_desc: null, in_kind_desc: null, appraiser: null, tribute_kind: null, tribute_name: null, created_by: 'donation page', updated_by: 'donation page',
    fee: 1.8, net_amount: 50.01, refunded_amount: 0, refunded_at: null, plan_id: null }, o || {});
}
const SETTINGS = {
  donate_mode: 'off', donate_title: 'Give to Welfare Avenue', donate_intro: 'Every gift keeps our student volunteers serving.', donate_amounts_once: '25,50,100,250', donate_amounts_monthly: '10,20,35,50',
  donate_min: '5', donate_max: '10000', donate_designations: 'Where it is needed most', donate_fee_cover: 'on', donate_fee_percent: '2.9', donate_fee_fixed: '0.30',
  donate_consent_label: 'Yes, send me news by email.', donate_thanks: 'Thank you.', donate_receipt_note: 'Registered charity ({charity}).', donate_monthly_note: 'Write to {email}.',
  donate_product: 'prod_TEST', donate_webhook: 'we_TEST'
};
function fixture(extra) {
  const fx = loadFixture();
  fx.crm_contacts_v = [C(6001, 'Amara Test'), C(6002, 'Bea Test'), C(6003, 'Cal Test'), C(6004, 'Dee Test')];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = []; fx.crm_forms = []; fx.crm_automations = []; fx.crm_automation_runs = []; fx.crm_contact_fields = []; fx.crm_fields = []; fx.crm_receipts = [];
  fx.crm_donations = [
    G(901, 6001, 51.81, '2026-09-20', { notes: 'Online gift through the Hub’s donation page; includes $1.81 to help cover the card fee.' }),
    G(902, 6002, 31.81, '2026-09-21', { refunded_amount: 20, refunded_at: '2026-09-22T15:00:00Z', fee: 1.8, net_amount: 30.01 }),
    G(903, 6003, 0, '2026-09-22', { refunded_amount: 25, refunded_at: '2026-09-23T15:00:00Z', fee: null, net_amount: null }),
    G(904, 6004, 20, '2026-09-23', { external_id: 'in_904', recurring: true, plan_id: 71, fee: 0.88, net_amount: 19.12, designation: 'Toronto' }),
    G(905, 6004, 20, '2026-08-23', { external_id: 'in_905', recurring: true, plan_id: 71, fee: 0.88, net_amount: 19.12, designation: 'Toronto' }),
    { id: 906, contact_id: 6001, amount: 100, currency: 'CAD', donated_at: '2026-03-01T15:00:00Z', platform: 'keela', kind: 'donation', receipt_number: 'KEE-2026-01', receipt_eligible: true, advantage_amount: 0 }
  ];
  fx.crm_gift_receipts_v = fx.crm_donations.map(g => ({ gift_id: g.id, contact_id: g.contact_id, amount: g.amount, advantage_amount: 0, eligible_amount: g.amount, tax_year: 2026, kind: 'donation', platform: g.platform,
    receipt_number: g.receipt_number || null, receipt_status: g.receipt_number ? 'receipted' : g.amount > 0 ? 'due' : 'no', receipt_note: g.receipt_number ? 'Receipt ' + g.receipt_number : g.amount > 0 ? 'A receipt is due' : 'Refunded in full' }));
  fx.crm_gift_plans = [
    { id: 71, external_id: 'sub_71', contact_id: 6004, amount: 20, currency: 'CAD', status: 'active', designation: 'Toronto', tribute_kind: 'memory', tribute_name: 'Nan Test', started_at: '2026-08-23T15:00:00Z',
      next_payment_at: '2026-10-23T15:00:00Z', last_paid_at: '2026-09-23T15:00:00Z', last_failed_at: null, ends_at: null, cancelled_at: null, cancel_reason: null },
    { id: 72, external_id: 'sub_72', contact_id: 6002, amount: 35, currency: 'CAD', status: 'past_due', designation: null, started_at: '2026-07-01T15:00:00Z', next_payment_at: '2026-10-01T15:00:00Z', last_paid_at: '2026-08-01T15:00:00Z',
      last_failed_at: '2026-09-01T15:00:00Z', ends_at: null, cancelled_at: null, cancel_reason: null },
    { id: 73, external_id: 'sub_73', contact_id: 6003, amount: 10, currency: 'CAD', status: 'active', designation: null, started_at: '2026-06-01T15:00:00Z', next_payment_at: '2026-10-01T15:00:00Z', last_paid_at: '2026-09-01T15:00:00Z',
      last_failed_at: null, ends_at: '2026-10-01T15:00:00Z', cancelled_at: null, cancel_reason: 'cancellation_requested' },
    { id: 74, external_id: 'sub_74', contact_id: 6001, amount: 50, currency: 'CAD', status: 'cancelled', designation: null, started_at: '2026-01-01T15:00:00Z', next_payment_at: null, last_paid_at: '2026-06-01T15:00:00Z',
      last_failed_at: null, ends_at: null, cancelled_at: '2026-06-15T15:00:00Z', cancel_reason: 'cancellation_requested: too_expensive' }
  ];
  fx.crm_stripe_events = [
    { id: 'evt_2', type: 'charge.refunded', status: 'done', received_at: '2026-09-22T15:00:05Z', attempts: 1, result: { gift_id: 902, refunded: 20, kept: 31.81 }, error: null },
    { id: 'evt_1', type: 'checkout.session.completed', status: 'ignored', received_at: '2026-09-21T15:00:05Z', attempts: 1, result: { ignored: 'Not from the Hub’s donation page' }, error: null },
    { id: 'evt_0', type: 'invoice.paid', status: 'error', received_at: '2026-09-20T15:00:05Z', attempts: 3, result: null, error: 'something broke' }
  ];
  fx.crm_donate_attempts = [{ id: 1, created_at: '2026-09-20T14:59:00Z', status: 'session', frequency: 'once', amount_cents: 5181 }, { id: 2, created_at: '2026-09-21T14:59:00Z', status: 'session', frequency: 'monthly', amount_cents: 2000 },
    { id: 3, created_at: '2026-09-21T15:59:00Z', status: 'spam', frequency: null, amount_cents: null }];
  const s = Object.assign({}, SETTINGS, extra || {});
  fx.app_config = Object.keys(s).map(k => ({ key: k, value: s[k] })).concat([{ key: 'mail_mode', value: 'test' }, { key: 'receipt_mode', value: 'off' }, { key: 'keela_next_charge', value: '2026-12-19' },
    { key: 'keela_notice_days', value: '7' }, { key: 'keela_quarterly_cost', value: '657' }, { key: 'keela_donation_form', value: '' }, { key: 'mail_charity_number', value: '713048502RR0001' }]);
  return fx;
}
const patch = f => f.ev(() => {
  window.__rpc = []; window.__up = [];
  const rpc0 = db.rpc.bind(db), from0 = db.from.bind(db);
  db.rpc = function (fn, args) {
    window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    if (fn === 'crm_donate_mode_set') return Promise.resolve({ data: { mode: args.p_mode, was: 'off' }, error: null });
    return rpc0(fn, args);
  };
  db.from = function (t) {
    const b = from0(t);
    if (t === 'app_config') { const up = b.upsert.bind(b); b.upsert = function (rows, opts) { window.__up.push({ rows: JSON.parse(JSON.stringify(rows)), opts: opts || {} }); return up(rows, opts); }; }
    return b;
  };
});
const view = f => f.ev(() => {
  const root = document.querySelector('#crm .w161'); if (!root) return null;
  const card = root.querySelector('.w161card');
  return { head: card.querySelector('h3').innerText.replace(/\s+/g, ' '), p: card.querySelector('.w161p').innerText, ready: [...card.querySelectorAll('.w161ready li')].map(l => l.className + ': ' + l.innerText),
    preview: (card.querySelector('.w161p a') || {}).href || '', ask: !!root.querySelector('[data-w161ask]'), askOff: !!(root.querySelector('[data-w161ask]') || {}).disabled,
    stats: [...root.querySelectorAll('.w161stats .w152st')].map(s => s.innerText.replace(/\s+/g, ' ')),
    plans: [...root.querySelectorAll('.w161prow')].map(r => r.innerText.replace(/\s+/g, ' ')), planHead: root.querySelector('.w161plans h3').innerText.replace(/\s+/g, ' '),
    sets: [...root.querySelectorAll('[data-w161set]')].map(e => [e.getAttribute('data-w161set'), e.disabled]), save: !!root.querySelector('[data-w161save]'),
    events: [...root.querySelectorAll('.w161ev')].map(r => r.innerText.replace(/\s+/g, ' ')), note: (card.querySelector('p.m') || {}).innerText || '' };
});

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await f.hash('#crm/gifts', 3000);
  let b = await f.ev(() => ({ btn: !!document.querySelector('#crm [data-w152go="#crm/gifts/online"]'), rows: [...document.querySelectorAll('#crm .w153gifts .w158row')].map(r => r.innerText.replace(/\s+/g, ' ')) }));
  ok('Gifts has an Online giving button', b.btn, b);
  ok('a part refund and a full refund show on the gift rows', b.rows.some(r => /\$31\.81/.test(r) && /Part refunded/.test(r)) && b.rows.some(r => /\$0\b/.test(r) && /Refunded/.test(r) && !/Part refunded/.test(r)), b.rows);
  await f.ev(() => { const r = document.querySelector('#crm [data-w158open="901"]'); r.click(); });
  await f.page.waitForTimeout(600);
  b = await f.ev(() => { const s = document.querySelector('.w152sheet, .w152sh, [data-w158gift]'); const box = document.querySelector('[data-w158gift="901"]'); const sheet = box ? box.closest('.w152sheet, .w152panel, aside, div') : null;
    const sub = [...document.querySelectorAll('.sub')].map(x => x.innerText).join(' | '); const a = [...document.querySelectorAll('.sub a')].map(x => x.href);
    return { sub, a, disabled: box ? box.querySelector('[data-f="amount"]').disabled : null }; });
  ok('a Stripe gift says where it came from, the fee and the net, and links to the payment in Stripe',
    /An online gift through the Hub’s donation page, paid on Stripe/.test(b.sub) && /Stripe kept \$1\.80, \$50\.01 reached Welfare Avenue/.test(b.sub) && b.a.some(h => h === 'https://dashboard.stripe.com/payments/pi_901') && b.disabled === true, b);
  await f.ev(() => { const c = document.querySelector('[data-w152close]'); if (c) c.click(); });

  await patch(f);
  await f.hash('#crm/gifts/online', 3000);
  let v = await view(f);
  ok('the page card: off, with a preview link, Stripe set up, and what comes after going live', v && /The donation page Off/i.test(v.head) && v.preview === 'https://hub.welfareavenue.com/give?preview=1' &&
    /^ok: .*Stripe account is connected/.test(v.ready[0]) && /^todo: .*point the website’s Donate buttons at hub\.welfareavenue\.com\/give/.test(v.ready[1]) && v.ask && !v.askOff, v);
  ok('this year online: total, fees, monthly total and checkouts started (admin)', v && /\$123\.62 given online this fiscal year \(4 gifts\)/.test(v.stats[0]) && /\$5\.36 kept by Stripe in fees/.test(v.stats[1]) &&
    /\$65 a month from 3 monthly gifts/.test(v.stats[2]) && /^2 checkouts started this year/.test(v.stats[3]), v && v.stats);
  ok('monthly gifts: states, notes, where it goes and what it has given', v && v.plans.length === 4 && /Monthly gifts 3 going of 4/i.test(v.planHead) &&
    /Dee Test .*\$20\.00 a month In memory of Nan Test Active Next 23 Oct 2026 Toronto Since 23 Aug 2026 \$40 2 payments, the last 23 Sep 2026/.test(v.plans[0]) &&
    /Payment failed Failed 1 Sep 2026; Stripe tries again/.test(v.plans[1]) && /Ending 1 Oct 2026/.test(v.plans[2]) && /Stopped Stopped 15 Jun 2026 \(they asked: too expensive\)/.test(v.plans[3]), v && v.plans);
  ok('the settings: twelve fields, editable by an admin, with Save', v && v.sets.length === 12 && v.sets.every(s => s[1] === false) && v.save, v && v.sets);
  ok('what Stripe told the Hub: recorded, not the page’s, an error with its tries', v && v.events.length === 3 && /A refund Recorded/.test(v.events[0]) && /A checkout finished Not the page’s Not from the Hub’s donation page/.test(v.events[1]) &&
    /A monthly payment \(3 tries\) Error: Stripe sends it again something broke/.test(v.events[2]), v && v.events);

  await f.ev(() => document.querySelector('#crm [data-w161ask]').click());
  await f.page.waitForTimeout(300);
  b = await f.ev(() => ({ cf: (document.querySelector('#crm .w161 .w155cf') || {}).innerText || '', rpc: window.__rpc.filter(x => x.fn === 'crm_donate_mode_set').length }));
  ok('Put it live asks first and calls nothing yet', /Put the donation page live\?/.test(b.cf) && /paid into Welfare Avenue’s Stripe account/.test(b.cf) && b.rpc === 0, b);
  await f.ev(() => document.querySelector('#crm [data-w161mode="live"]').click());
  await f.page.waitForTimeout(600);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_donate_mode_set'), msg: (document.querySelector('#crm .w161 .w154msg') || {}).innerText || '' }));
  ok('confirmed: crm_donate_mode_set live, and the page says so', b.rpc.length === 1 && b.rpc[0].args.p_mode === 'live' && /The donation page is live\./.test(b.msg), b);

  await f.ev(() => { const put = (k, v) => { const el = document.querySelector('#crm [data-w161set="' + k + '"]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    put('donate_title', 'Give today'); put('donate_amounts_once', '20; 40'); });
  await f.ev(() => document.querySelector('#crm [data-w161save]').click());
  await f.page.waitForTimeout(400);
  b = await f.ev(() => ({ up: window.__up.length, err: (document.querySelector('#crm .w161 .w154msg.err') || {}).innerText || '' }));
  ok('a bad amount list is refused before anything is saved', b.up === 0 && /up to six numbers in dollars/.test(b.err), b);
  b = await f.ev(() => document.querySelector('#crm [data-w161set="donate_title"]').value);
  ok('what the admin typed survives the refusal (the title is still theirs)', b === 'Give today', b);
  await f.ev(() => { const a = document.querySelector('#crm [data-w161set="donate_amounts_once"]'); a.value = '20,  40 , 80'; a.dispatchEvent(new Event('input', { bubbles: true })); });
  await f.ev(() => document.querySelector('#crm [data-w161save]').click());
  await f.page.waitForTimeout(600);
  b = await f.ev(() => ({ up: window.__up, msg: (document.querySelector('#crm .w161 .w154msg') || {}).innerText || '' }));
  const rows = b.up.length ? b.up[0].rows : [];
  const get = k => (rows.filter(r => r.key === k)[0] || {}).value;
  ok('Save writes the twelve settings (tidied), on the key, and says so', b.up.length === 1 && rows.length === 12 && get('donate_title') === 'Give today' && get('donate_amounts_once') === '20, 40, 80' &&
    b.up[0].opts.onConflict === 'key' && !rows.some(r => r.key === 'donate_mode') && /Saved/.test(b.msg), b);
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await f.hash('#crm/gifts/online', 3000);
  v = await view(f);
  ok('a member reads it all but cannot switch it, save or see Stripe’s events', v && !v.ask && /An admin puts the page live or takes it down/.test(v.note) && v.sets.every(s => s[1] === true) && !v.save && v.events.length === 0 && v.stats.length === 3, v);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture({ donate_mode: 'live' }), wait: 4000 });
  await f.hash('#crm/sources', 3000);
  b = await f.ev(() => [...document.querySelectorAll('#crm .w159kr')].map(r => r.innerText.replace(/\s+/g, ' '))[5]);
  ok('Leaving Keela: online donations done once the page is live', /Online donations Done/.test(b) && /The Hub’s donation page is live/.test(b), b);
  await f.hash('#crm/gifts/online', 3000);
  v = await view(f);
  ok('live: the chip, the address, and Take it down', v && /The donation page Live/i.test(v.head) && /Live at hub\.welfareavenue\.com\/give/.test(v.p) && await f.ev(() => !!document.querySelector('#crm [data-w161mode="off"]')), v);
  await f.close();

  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture({ donate_webhook: 'we_TEST' }), wait: 4000 });
  await f.hash('#crm/sources', 3000);
  b = await f.ev(() => [...document.querySelectorAll('#crm .w159kr')].map(r => r.innerText.replace(/\s+/g, ' '))[5]);
  ok('Leaving Keela: in progress while the page is built and off, with Steel’s next step', /Online donations In progress/.test(b) && /built \(Stripe/.test(b) && /puts it live in Gifts, Online giving/.test(b), b);
  await f.close();

  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(), wait: 4000 });
  await f.hash('#crm/gifts/online', 3000);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, cols: getComputedStyle(document.querySelector('#crm .w161grid')).gridTemplateColumns.split(' ').length }));
  ok('phone: the settings stack and nothing scrolls sideways', b.cols === 1 && b.sw <= b.w + 1, b);
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw161drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
