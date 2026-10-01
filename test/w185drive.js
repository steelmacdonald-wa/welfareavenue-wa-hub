/* w185drive.js: receipts by email (wave185). Fixture rows are made up for the test (no real people); every RPC and function call
   is recorded on the page, and the stub never changes the fixture.
   Receipts off: the online-gift switch says receipts must be on first, no switch button. Receipts on, automatic off: the switch
   offers to email receipts for online gifts automatically; on calls the admin RPC and the page says so; off again. Each issued
   receipt says whether it was emailed and offers Email it (admins): the button calls mail-send with the receipt id, says where
   the email went (live), or that a test copy went to a test address (test mode), or why it was suppressed. A cancelled receipt
   has no Email it. A staff member who is not an admin sees the state without the buttons. usage: node test/w185drive.js */
const { launch, fresh, loadFixture } = require('./boot');
const fs = require('fs');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name) { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: true }); }
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['supporter'], tags: [], source: 'keela', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'wa150_backfill', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [] }, o || {});
}
const G = (id, contact_id, amount, date, o) => Object.assign({ id, contact_id, amount, currency: 'CAD', donated_at: date + 'T15:00:00Z', platform: 'hub', campaign: null, designation: null, recurring: false, receipt_number: null, receipt_issued_at: null, receipt_url: null,
  receipt_source: null, receipt_eligible: true, external_id: null, notes: null, kind: 'donation', method: 'cheque', advantage_amount: 0, advantage_desc: null, in_kind_desc: null, appraiser: null, tribute_kind: null, tribute_name: null, created_by: 'test', updated_by: null }, o || {});
const R = (gift_id, contact_id, amount, adv, status, note, o) => Object.assign({ gift_id, contact_id, amount, advantage_amount: adv, eligible_amount: Math.max(0, amount - adv), tax_year: 2026, kind: 'donation', platform: 'hub', receipt_number: null, receipt_status: status, receipt_note: note }, o || {});
function fixture() {
  const fx = loadFixture();
  fx.crm_contacts_v = [
    C(5001, 'Amara Okafor', { emails: ['amara.okafor@example.com'], primary_email: 'amara.okafor@example.com', kinds: ['donor'], address: '12 rue Test', city: 'Montreal', province: 'QC', postal_code: 'H2X 1Y4' }),
    C(5002, 'Élodie Gagnon', { emails: ['elodie.gagnon@example.com'], primary_email: 'elodie.gagnon@example.com', kinds: ['donor'], address: '4 av Exemple', city: 'Laval', province: 'QC' })
  ];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = [];
  fx.crm_donations = [
    G(62, 5001, 100, '2026-09-20'),
    G(66, 5001, 80, '2026-03-02', { receipt_number: 'TEST-0007', receipt_source: 'hub' }),
    G(67, 5002, 51.81, '2026-09-30', { receipt_number: 'TEST-0009', receipt_source: 'hub', platform: 'stripe', method: 'card' })
  ];
  fx.crm_gift_receipts_v = [
    R(62, 5001, 100, 0, 'due', 'A receipt is due for $100.00'), R(66, 5001, 80, 0, 'receipted', 'Receipt TEST-0007 (hub)', { receipt_number: 'TEST-0007' }),
    R(67, 5002, 51.81, 0, 'receipted', 'Receipt TEST-0009 (hub)', { receipt_number: 'TEST-0009', platform: 'stripe' })
  ];
  fx.crm_receipts = [
    { id: 403, serial: 'TEST-0009', contact_id: 5002, tax_year: 2026, kind: 'single', status: 'issued', gift_ids: [67], amount: 51.81, advantage_amount: 0, eligible_amount: 51.81, donor: { name: 'Élodie Gagnon', first_name: 'Élodie', address: '4 av Exemple, Laval QC', lang: 'fr' },
      issued_at: '2026-09-30T20:00:00Z', issued_by: 'donation page', replaces_id: null, replaced_by_id: null, cancelled_at: null, cancel_reason: null, pdf_path: '2026/TEST-0009.pdf', cancelled_pdf_path: null, emailed_at: '2026-09-30T20:00:30Z', email_send_id: 91 },
    { id: 401, serial: 'TEST-0007', contact_id: 5001, tax_year: 2026, kind: 'single', status: 'issued', gift_ids: [66], amount: 80, advantage_amount: 0, eligible_amount: 80, donor: { name: 'Amara Okafor', address: '12 rue Test, Montreal QC H2X 1Y4' },
      issued_at: '2026-09-21T15:00:00Z', issued_by: 'steel.macdonald@welfareavenue.com', replaces_id: 400, replaced_by_id: null, cancelled_at: null, cancel_reason: null, pdf_path: '2026/TEST-0007.pdf', cancelled_pdf_path: null, emailed_at: null, email_send_id: null },
    { id: 400, serial: 'TEST-0006', contact_id: 5001, tax_year: 2026, kind: 'single', status: 'cancelled', gift_ids: [66], amount: 80, advantage_amount: 0, eligible_amount: 80, donor: { name: 'Amara Okafor', address: 'an old address' },
      issued_at: '2026-09-20T15:00:00Z', issued_by: 'steel.macdonald@welfareavenue.com', replaces_id: null, replaced_by_id: 401, cancelled_at: '2026-09-21T15:00:00Z', cancel_reason: 'Replaced: Address corrected', pdf_path: '2026/TEST-0006.pdf', cancelled_pdf_path: '2026/TEST-0006-cancelled.pdf', emailed_at: null, email_send_id: null }
  ];
  fx.crm_automation_runs = []; fx.crm_automations = []; fx.crm_contact_fields = []; fx.crm_fields = [];
  return fx;
}
const BASE = { receipt_charity_name: 'Welfare Avenue / Avenue du Bien-Être', receipt_charity_address: '8200 av Bloomfield, Montréal QC H3N 2H9', receipt_location: 'Montréal, Québec', mail_charity_number: '713048502RR0001', issued: 2,
  receipt_prefix: 'TEST-', receipt_next_number: '10', receipt_signatory_name: 'Steel MacDonald', receipt_signatory_title: 'Founder', signature: true, missing: [] };
const OFF = Object.assign({}, BASE, { receipt_mode: 'off', receipt_auto_online: 'off', is_admin: true });
const ON = Object.assign({}, BASE, { receipt_mode: 'on', receipt_auto_online: 'off', is_admin: true });
const ON_STAFF = Object.assign({}, ON, { is_admin: false });
const patch = (f, cfg, mail) => f.ev(([cfg0, mail0]) => {
  window.__cfg = cfg0; window.__mail = mail0; window.__rpc = []; window.__fn = []; window.__st = [];
  const rpc0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    if (fn === 'crm_receipt_config') return Promise.resolve({ data: Object.assign({}, window.__cfg), error: null });
    if (fn === 'crm_receipt_mode_set') { window.__cfg = Object.assign({}, window.__cfg, { receipt_mode: args.p_mode }); return Promise.resolve({ data: Object.assign({}, window.__cfg), error: null }); }
    if (fn === 'crm_receipt_auto_set') { window.__cfg = Object.assign({}, window.__cfg, { receipt_auto_online: args.p_on }); return Promise.resolve({ data: Object.assign({}, window.__cfg), error: null }); }
    return rpc0(fn, args);
  };
  db.functions.invoke = function (name, opts) {
    window.__fn.push({ name: name, body: JSON.parse(JSON.stringify((opts && opts.body) || {})) });
    const b = (opts && opts.body) || {};
    if (name === 'mail-send' && b.action === 'receipt') return Promise.resolve({ data: window.__mail, error: null });
    if (name === 'receipt-pdf' && b.action === 'render') return Promise.resolve({ data: { ok: true, path: '2026/TEST-X.pdf' }, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  db.storage.from = function (bucket) {
    return { createSignedUrl: function (path, s) { window.__st.push({ op: 'sign', bucket: bucket, path: path, s: s }); return Promise.resolve({ data: { signedUrl: 'https://stub.local/signed/' + bucket + '/' + path }, error: null }); } };
  };
  return true;
}, [cfg, mail || { status: 'sent', to: 'amara.okafor@example.com', send_id: 92, serial: 'TEST-0007', test_copy: false, marked: true }]);
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const view = f => f.ev(() => ({
  t: ((document.querySelector('#crm .w152root') || {}).innerText || '').replace(/\s+/g, ' '),
  auto: (document.querySelector('#crm .w185auto') || {}).innerText || '', autoState: (document.querySelector('#crm [data-w185auto-state]') || { getAttribute: () => null }).getAttribute('data-w185auto-state'),
  autoBtn: [...document.querySelectorAll('#crm [data-w185auto]')].map(b => b.getAttribute('data-w185auto')),
  sample: [...document.querySelectorAll('#crm [data-w185sample]')].map(b => b.getAttribute('data-w185sample')),
  mail: [...document.querySelectorAll('#crm [data-w185mail]')].map(b => b.getAttribute('data-w185mail') + ':' + b.innerText.trim()),
  mailed: [...document.querySelectorAll('#crm .w185mailed')].map(x => x.innerText.trim()),
  rows: [...document.querySelectorAll('#crm .w158brow')].map(r => r.innerText.replace(/\s+/g, ' ')),
  msg: (document.querySelector('#crm .w154msg') || {}).innerText || '', err: (document.querySelector('#crm .w152err') || {}).innerText || ''
}));

(async () => {
  const browser = await launch();
  /* receipts off: the switch waits */
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f, OFF);
  await f.hash('#crm/gifts/receipts', 2600);
  let b = await view(f);
  ok('receipts off: online gifts are receipted by hand, and the switch waits for receipts to be on', /Online gifts: receipts are issued by hand/.test(b.auto) && /Receipts from the Hub must be on first/.test(b.auto) && b.autoBtn.length === 0 && b.autoState === 'off', b.auto);
  ok('an admin can email themselves a sample receipt email, in English or in French', b.sample.join(',') === 'en,fr', b.sample);
  ok('each issued receipt says whether it was emailed; the cancelled one says nothing', b.mailed.length === 2 && /Emailed 30 Sep 2026/.test(b.mailed[0]) && b.mailed[1] === 'Not emailed' && !/Emailed|Not emailed/.test(b.rows[2]), b.mailed);
  ok('Email it on the issued receipts only (Email it again where it went already)', b.mail.length === 2 && /^403:.*Email it again$/.test(b.mail[0]) && /^401:.*Email it$/.test(b.mail[1]), b.mail);
  /* Email it: live */
  await click(f, '#crm [data-w185mail="401"]'); await f.page.waitForTimeout(700);
  b = await f.ev(() => ({ fn: window.__fn.filter(x => x.name === 'mail-send').slice(-1)[0], msg: (document.querySelector('#crm .w154msg') || {}).innerText || '' }));
  ok('Email it calls mail-send with the receipt, and says where the email went with the PDF attached', b.fn && b.fn.body.action === 'receipt' && b.fn.body.receipt_id === 401 && /Emailed to amara\.okafor@example\.com with the PDF attached/.test(b.msg), b);
  await shot(f, 'receipts_off_email');
  ok('no page errors (off)', f.errs.length === 0, f.errs);
  await f.close();

  /* receipts on: the switch, and a test-mode copy */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f, ON, { status: 'sent', to: 'steelmacdonald@gmail.com', donor_email: 'amara.okafor@example.com', send_id: 93, serial: 'TEST-0007', test_copy: true, marked: false });
  await f.hash('#crm/gifts/receipts', 2600);
  b = await view(f);
  ok('receipts on, automatic off: the switch offers to email receipts for online gifts automatically', /receipts are issued by hand/.test(b.auto) && /every gift the donation page takes is receipted with the next number/.test(b.auto) && b.autoBtn.length === 1 && b.autoBtn[0] === 'on', b);
  await click(f, '#crm [data-w185auto="on"]'); await f.page.waitForTimeout(700);
  b = await view(f);
  const rpc = await f.ev(() => window.__rpc.filter(x => x.fn === 'crm_receipt_auto_set').map(x => x.args));
  ok('on: the admin RPC is called with on, the page says so, and the switch now offers to stop', rpc.length === 1 && rpc[0].p_on === 'on' && b.autoState === 'on' && /gets its receipt issued and emailed by itself/.test(b.auto) && /Online gifts now get their receipt by email automatically/.test(b.msg) && b.autoBtn[0] === 'off', { rpc, auto: b.auto, msg: b.msg });
  await click(f, '#crm [data-w185auto="off"]'); await f.page.waitForTimeout(700);
  b = await view(f);
  ok('off again', b.autoState === 'off' && /receipted by hand again/.test(b.msg), b.msg);
  await f.ev(() => { const inv = db.functions.invoke; db.functions.invoke = function (name, opts) { const bd = (opts && opts.body) || {}; if (name === 'mail-send' && bd.action === 'receipt_sample') { window.__fn.push({ name, body: JSON.parse(JSON.stringify(bd)) }); return Promise.resolve({ data: { status: 'sent', to: 'steelmacdonald@gmail.com', sample: true, send_id: 94 }, error: null }); } return inv(name, opts); }; });
  await click(f, '#crm [data-w185sample="fr"]'); await f.page.waitForTimeout(700);
  b = await view(f);
  const sfn = await f.ev(() => window.__fn.filter(x => x.name === 'mail-send' && x.body.action === 'receipt_sample').slice(-1)[0]);
  ok('Email me a sample (French) calls mail-send and says where it went', sfn && sfn.body.lang === 'fr' && /A sample receipt email went to steelmacdonald@gmail\.com/.test(b.msg), { sfn, msg: b.msg });
  await click(f, '#crm [data-w185mail="401"]'); await f.page.waitForTimeout(700);
  b = await view(f);
  ok('test mode: the page says a copy went to the test address instead of the donor, and the receipt is not marked', /test mode: a copy went to steelmacdonald@gmail\.com instead of amara\.okafor@example\.com/.test(b.msg) && /not marked as emailed/.test(b.msg), b.msg);
  await shot(f, 'receipts_on_switch');
  ok('no page errors (on)', f.errs.length === 0, f.errs);
  await f.close();

  /* suppressed: the address does not work */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f, ON, { status: 'suppressed', basis: 'bounced', to: 'amara.okafor@example.com', serial: 'TEST-0007' });
  await f.hash('#crm/gifts/receipts', 2600);
  await click(f, '#crm [data-w185mail="401"]'); await f.page.waitForTimeout(700);
  b = await view(f);
  ok('a suppressed send says why and what to do', /Not emailed: bounced\. Download the PDF and send it another way\./.test(b.err), b.err);
  await f.close();

  /* a staff member who is not an admin */
  f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f, ON_STAFF);
  await f.hash('#crm/gifts/receipts', 2600);
  b = await view(f);
  ok('staff (not admin): the state shows, no switch button, no sample and no Email it', /Online gifts/.test(b.auto) && b.autoBtn.length === 0 && b.sample.length === 0 && b.mail.length === 0 && b.mailed.length === 2, { autoBtn: b.autoBtn, sample: b.sample, mail: b.mail, mailed: b.mailed });
  ok('no page errors (staff)', f.errs.length === 0, f.errs);
  await f.close();

  /* on a phone nothing overflows */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000, width: 390 });
  await patch(f, ON);
  await f.hash('#crm/gifts/receipts', 2600);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, auto: !!document.querySelector('#crm .w185auto') }));
  ok('phone: the switch shows and nothing scrolls sideways', b.auto && b.sw <= b.cw + 1, b);
  await shot(f, 'receipts_phone');
  await f.close();

  await browser.close();
  out.forEach(l => console.log(l));
  console.log('w185drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
