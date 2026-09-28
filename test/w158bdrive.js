/* w158bdrive.js: official receipts, built with receipts off (wave158b). Fixture rows are made up for the test (no real people);
   every RPC, function call and storage call is recorded on the page, and the stub never changes the fixture.
   Receipts off: the state and what is missing in words, the switch disabled until everything is there, the signature upload
   for admins, no Issue while off, the receipts issued with their PDF and Cancel (Replace waits for on). A sample downloads as a
   PDF drawn by receipt-pdf. Ready: Turn receipts on asks first, then calls the admin RPC. On: Issue for a donor's due gifts of
   the tax year (the receipt, then its PDF), the year-end run (one receipt per donor), Replace and Cancel with the reason (the
   kept copies drawn again). A staff member who is not an admin sees the state without the admin controls. On a phone nothing
   overflows. usage: node test/w158bdrive.js */
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
    C(5001, 'Amara Okafor', { emails: ['amara.okafor@example.com'], kinds: ['donor'], address: '12 rue Test', city: 'Montreal', province: 'QC', postal_code: 'H2X 1Y4' }),
    C(5002, 'Élodie Gagnon', { emails: ['elodie.gagnon@example.com'], address: '4 av Exemple', city: 'Laval', province: 'QC' })
  ];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = [];
  fx.crm_donations = [
    G(62, 5001, 100, '2026-09-20'), G(65, 5001, 25, '2026-06-15'),
    G(63, 5002, 50, '2026-08-09', { kind: 'registration', method: 'card', advantage_amount: 30, advantage_desc: 'Playing in the tournament' }),
    G(66, 5001, 80, '2026-03-02', { receipt_number: 'TEST-0007', receipt_source: 'hub' })
  ];
  fx.crm_gift_receipts_v = [
    R(62, 5001, 100, 0, 'due', 'A receipt is due for $100.00'), R(65, 5001, 25, 0, 'due', 'A receipt is due for $25.00'),
    R(63, 5002, 50, 30, 'due', 'A receipt is due for $20.00', { kind: 'registration' }), R(66, 5001, 80, 0, 'receipted', 'Receipt TEST-0007 (hub)', { receipt_number: 'TEST-0007' })
  ];
  fx.crm_receipts = [
    { id: 401, serial: 'TEST-0007', contact_id: 5001, tax_year: 2026, kind: 'single', status: 'issued', gift_ids: [66], amount: 80, advantage_amount: 0, eligible_amount: 80, donor: { name: 'Amara Okafor', address: '12 rue Test, Montreal QC H2X 1Y4' },
      issued_at: '2026-09-21T15:00:00Z', issued_by: 'steel.macdonald@welfareavenue.com', replaces_id: 400, replaced_by_id: null, cancelled_at: null, cancel_reason: null, pdf_path: '2026/TEST-0007.pdf', cancelled_pdf_path: null },
    { id: 400, serial: 'TEST-0006', contact_id: 5001, tax_year: 2026, kind: 'single', status: 'cancelled', gift_ids: [66], amount: 80, advantage_amount: 0, eligible_amount: 80, donor: { name: 'Amara Okafor', address: 'an old address' },
      issued_at: '2026-09-20T15:00:00Z', issued_by: 'steel.macdonald@welfareavenue.com', replaces_id: null, replaced_by_id: 401, cancelled_at: '2026-09-21T15:00:00Z', cancel_reason: 'Replaced: Address corrected', pdf_path: '2026/TEST-0006.pdf', cancelled_pdf_path: '2026/TEST-0006-cancelled.pdf' }
  ];
  fx.crm_automation_runs = []; fx.crm_automations = []; fx.crm_contact_fields = []; fx.crm_fields = [];
  return fx;
}
const BASE = { receipt_charity_name: 'Welfare Avenue', receipt_charity_address: 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9', receipt_location: 'Montreal, Quebec', mail_charity_number: '713048502RR0001', issued: 1 };
const OFF = Object.assign({}, BASE, { receipt_mode: 'off', receipt_prefix: '', receipt_next_number: '', receipt_signatory_name: '', receipt_signatory_title: '', is_admin: true, signature: false, missing: ['the next number', 'who signs'] });
const READY = Object.assign({}, BASE, { receipt_mode: 'off', receipt_prefix: 'TEST-', receipt_next_number: '8', receipt_signatory_name: 'Daniela Test', receipt_signatory_title: 'Treasurer', is_admin: true, signature: true, missing: [] });
const ON = Object.assign({}, READY, { receipt_mode: 'on' });
const patch = (f, cfg) => f.ev(cfg0 => {
  window.__cfg = cfg0; window.__rpc = []; window.__fn = []; window.__st = []; window.__open = null; window.__dl = [];
  const rpc0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    if (fn === 'crm_receipt_config') return Promise.resolve({ data: Object.assign({}, window.__cfg), error: null });
    if (fn === 'crm_receipt_mode_set') { window.__cfg = Object.assign({}, window.__cfg, { receipt_mode: args.p_mode }); return Promise.resolve({ data: Object.assign({}, window.__cfg), error: null }); }
    if (fn === 'crm_receipt_issue') return Promise.resolve({ data: 500 + window.__rpc.length, error: null });
    if (fn === 'crm_receipt_replace') return Promise.resolve({ data: 777, error: null });
    if (fn === 'crm_receipt_cancel') return Promise.resolve({ data: null, error: null });
    if (fn === 'crm_receipt_sample') return Promise.resolve({ data: { sample: true, status: 'due', note: 'A receipt is due for $20.00', warnings: [], serial: 'TEST-0008', charity_name: 'Welfare Avenue', charity_address: 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9',
      charity_number: '713048502RR0001', location: 'Montreal, Quebec', gift_date: '9 August 2026', issued_date: '25 September 2026', donor_name: 'Élodie Gagnon', donor_address: '4 av Exemple, Laval QC', amount: 50, advantage_amount: 30,
      advantage_desc: 'Playing in the tournament', eligible_amount: 20, kind: 'registration', signatory_name: 'Daniela Test', signatory_title: 'Treasurer', cra: 'Canada Revenue Agency: canada.ca/charities-giving', mode: 'off' }, error: null });
    return rpc0(fn, args);
  };
  db.functions.invoke = function (name, opts) {
    window.__fn.push({ name: name, body: JSON.parse(JSON.stringify((opts && opts.body) || {})) });
    const b = (opts && opts.body) || {};
    if (name === 'receipt-pdf' && b.action === 'sample') return Promise.resolve({ data: { ok: true, filename: 'sample-receipt.pdf', pdf_b64: btoa('%PDF-1.7 made up') }, error: null });
    if (name === 'receipt-pdf' && b.action === 'render') return Promise.resolve({ data: { ok: true, path: '2026/TEST-X.pdf' }, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  db.storage.from = function (bucket) {
    return {
      createSignedUrl: function (path, s) { window.__st.push({ op: 'sign', bucket: bucket, path: path, s: s }); return Promise.resolve({ data: { signedUrl: 'https://stub.local/signed/' + bucket + '/' + path }, error: null }); },
      upload: function (path, blob, o) { window.__st.push({ op: 'upload', bucket: bucket, path: path, type: blob && blob.type, upsert: !!(o && o.upsert) }); return Promise.resolve({ data: { path: path }, error: null }); }
    };
  };
  window.open = function (u) { window.__open = u; return null; };
  const ce = document.createElement.bind(document);
  document.createElement = function (t) { const el = ce(t); if (String(t).toLowerCase() === 'a') { const c0 = el.click.bind(el); el.click = function () { if (el.download) { window.__dl.push(el.download); return; } return c0(); }; } return el; };
  return true;
}, cfg);
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);
const view = f => f.ev(() => ({ t: ((document.querySelector('#crm .w152root') || {}).innerText || '').replace(/\s+/g, ' '), ask: document.querySelector('#crm [data-w158bask]'), up: !!document.querySelector('#crm [data-w158bsig]'),
  issue: document.querySelectorAll('#crm [data-w158bissue]').length, run: !!document.querySelector('#crm [data-w158brun]'), rows: [...document.querySelectorAll('#crm .w158brow')].map(r => r.innerText.replace(/\s+/g, ' ')),
  replace: document.querySelectorAll('#crm [data-w158bdo="replace"]').length, cancel: document.querySelectorAll('#crm [data-w158bdo="cancel"]').length })).then(v => Object.assign(v, { askDisabled: v.ask ? undefined : null }));

(async () => {
  const browser = await launch();
  /* receipts off, settings incomplete */
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f, OFF);
  await f.hash('#crm/gifts/receipts', 2600);
  let b = await f.ev(() => ({ t: ((document.querySelector('#crm .w152root') || {}).innerText || '').replace(/\s+/g, ' '), ask: (document.querySelector('#crm [data-w158bask]') || {}).disabled,
    askTitle: (document.querySelector('#crm [data-w158bask]') || { getAttribute: () => '' }).getAttribute('title'), up: !!document.querySelector('#crm [data-w158bsig]'),
    issue: document.querySelectorAll('#crm [data-w158bissue]').length, run: !!document.querySelector('#crm [data-w158brun]') }));
  ok('receipts off: the state and what is missing, in words', /Receipts from the Hub are off\. Before an admin can turn them on: the next number, who signs and a signature image\./.test(b.t) && /No signature image yet/.test(b.t), b.t.slice(0, 900));
  ok('the switch waits for everything (disabled, with what is missing)', b.ask === true && /Missing: the next number, who signs, a signature image/.test(b.askTitle || ''), b);
  ok('an admin can upload the signature; nobody can issue while off', b.up && b.issue === 0 && !b.run && /Issuing waits until receipts from the Hub are on/.test(b.t), b);
  b = await f.ev(() => ({ rows: [...document.querySelectorAll('#crm .w158brow')].map(r => r.innerText.replace(/\s+/g, ' ')), replace: document.querySelectorAll('#crm [data-w158bdo="replace"]').length, cancel: document.querySelectorAll('#crm [data-w158bdo="cancel"]').length,
    pdf: document.querySelectorAll('#crm [data-w158bpdf]').length }));
  ok('the receipts issued: serial, donor, amount, status (replaced by), with the PDF and the cancelled copy', b.rows.length === 2 && /TEST-0007/.test(b.rows[0]) && /Amara Okafor/.test(b.rows[0]) && /\$80\.00/.test(b.rows[0]) && /Issued/.test(b.rows[0]) &&
    /TEST-0006/.test(b.rows[1]) && /Replaced by TEST-0007/.test(b.rows[1]) && /Address corrected/.test(b.rows[1]) && b.pdf === 3, b);
  ok('while off: Cancel stays possible, Replace waits', b.replace === 0 && b.cancel === 1, b);
  await click(f, '#crm [data-w158bpdf="401"]'); await f.page.waitForTimeout(400);
  b = await f.ev(() => ({ st: window.__st.slice(-1)[0], open: window.__open }));
  ok('PDF opens a short-lived link to the private copy', b.st && b.st.op === 'sign' && b.st.bucket === 'receipts' && b.st.path === '2026/TEST-0007.pdf' && b.st.s <= 300 && /signed\/receipts\/2026\/TEST-0007\.pdf$/.test(b.open || ''), b);
  await click(f, '#crm [data-w158bpdf="400"][data-which="cancelled"]'); await f.page.waitForTimeout(400);
  b = await f.ev(() => window.__st.slice(-1)[0].path);
  ok('the cancelled copy opens too', b === '2026/TEST-0006-cancelled.pdf', b);
  await shot(f, 'receipts_off');
  /* the sample as a PDF */
  await click(f, '#crm [data-w158sample="63"]'); await f.page.waitForTimeout(700);
  await click(f, '#w152sheet [data-w158bpdfsample]'); await f.page.waitForTimeout(700);
  b = await f.ev(() => ({ fn: window.__fn.filter(x => x.name === 'receipt-pdf').slice(-1)[0], dl: window.__dl.slice(-1)[0], say: (document.querySelector('#w152sheet [data-w158bsay]') || {}).textContent }));
  ok('Download the sample (PDF): receipt-pdf draws it for that gift, and it downloads, marked SAMPLE', b.fn && b.fn.body.action === 'sample' && b.fn.body.gift_id === 63 && b.dl === 'sample-receipt-gift-63.pdf' && /marked SAMPLE/.test(b.say || ''), b);
  await click(f, '#w152sheet [data-w152close]'); await f.page.waitForTimeout(300);
  ok('no page errors (off)', f.errs.length === 0, f.errs);
  await f.close();

  /* ready: turn receipts on */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f, READY);
  await f.hash('#crm/gifts/receipts', 2600);
  b = await f.ev(() => ({ t: (document.querySelector('#crm .w158bmode') || {}).innerText || '', ask: (document.querySelector('#crm [data-w158bask]') || {}).disabled, img: (document.querySelector('#crm .w158bsig img') || {}).getAttribute ? document.querySelector('#crm .w158bsig img').getAttribute('src') : '' }));
  ok('ready: says so, the switch is open, and the signature shows from a short-lived link', /Everything is ready/.test(b.t) && b.ask === false && /signed\/receipts\/settings\/signature\.png$/.test(b.img || ''), b);
  await click(f, '#crm [data-w158bask]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => ({ cf: (document.querySelector('#crm .w155cf') || {}).innerText || '', rpc: window.__rpc.filter(x => x.fn === 'crm_receipt_mode_set').length }));
  ok('Turn receipts on… asks first, with the next number, and changes nothing yet', /Turn receipts from the Hub on\?/.test(b.cf) && /TEST-0008/.test(b.cf) && /treasurer and Steel decide/.test(b.cf) && b.rpc === 0, b);
  await click(f, '#crm [data-w158bmode="on"]'); await f.page.waitForTimeout(700);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_receipt_mode_set').map(x => x.args), msg: (document.querySelector('#crm .w154msg') || {}).innerText || '', mode: (document.querySelector('#crm .w158bmode') || {}).innerText || '' }));
  ok('then the admin RPC turns them on, and the page says so', b.rpc.length === 1 && b.rpc[0].p_mode === 'on' && /Receipts from the Hub are on\./.test(b.msg) && /are on/.test(b.mode), b);
  ok('no page errors (ready)', f.errs.length === 0, f.errs);
  await f.close();

  /* on: issue, the year-end run, replace, cancel */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f, ON);
  await f.hash('#crm/gifts/receipts', 2600);
  b = await f.ev(() => ({ issue: [...document.querySelectorAll('#crm [data-w158bissue]')].map(x => x.getAttribute('data-w158bissue') + '/' + x.getAttribute('data-year')), run: (document.querySelector('#crm [data-w158brun]') || {}).textContent, replace: document.querySelectorAll('#crm [data-w158bdo="replace"]').length }));
  ok('on: Issue for each donor with due gifts, the year-end run, and Replace', b.issue.join(',') === '5001/2026,5002/2026' && /Issue one receipt per donor \(2\)/.test(b.run || '') && b.replace === 1, b);
  await click(f, '#crm [data-w158bissue="5001"]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_receipt_issue').map(x => x.args), fn: window.__fn.filter(x => x.name === 'receipt-pdf').map(x => x.body), msg: (document.querySelector('#crm .w154msg') || {}).innerText || '' }));
  ok('Issue: one receipt for the donor’s due gifts of the tax year, then its PDF', b.rpc.length === 1 && JSON.stringify(b.rpc[0].p_gift_ids.slice().sort()) === '[62,65]' && b.fn.length === 1 && b.fn[0].action === 'render' && typeof b.fn[0].receipt_id === 'number' && /Receipt issued and its PDF kept/.test(b.msg), b);
  await f.ev(() => { window.__rpc = []; window.__fn = []; return true; });
  await click(f, '#crm [data-w158brun]'); await f.page.waitForTimeout(1600);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_receipt_issue').map(x => x.args.p_gift_ids.slice().sort().join('+')), fn: window.__fn.filter(x => x.name === 'receipt-pdf').length, msg: (document.querySelector('#crm .w154msg') || {}).innerText || '' }));
  ok('the year-end run: one receipt per donor, each with its PDF', b.rpc.length === 2 && b.rpc.indexOf('62+65') >= 0 && b.rpc.indexOf('63') >= 0 && b.fn === 2 && /2 receipts issued for 2026/.test(b.msg), b);
  await f.ev(() => { window.__rpc = []; window.__fn = []; return true; });
  await click(f, '#crm [data-w158bdo="replace"][data-id="401"]'); await f.page.waitForTimeout(300);
  await click(f, '#crm [data-w158bgo="replace"]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => ({ err: (document.querySelector('#crm .w152err') || {}).innerText || '', rpc: window.__rpc.filter(x => x.fn === 'crm_receipt_replace').length }));
  ok('Replace asks why first', /Say why/.test(b.err) && b.rpc === 0, b);
  await click(f, '#crm [data-w158bdo="replace"][data-id="401"]'); await f.page.waitForTimeout(300);
  await setv(f, '#crm [data-w158breason="401"]', 'The donor moved');
  await click(f, '#crm [data-w158bgo="replace"]'); await f.page.waitForTimeout(1000);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_receipt_replace').map(x => x.args), fn: window.__fn.filter(x => x.name === 'receipt-pdf').map(x => x.body.receipt_id), msg: (document.querySelector('#crm .w154msg') || {}).innerText || '' }));
  ok('Replace: the RPC with the reason, then the cancelled copy and the replacement drawn', b.rpc.length === 1 && b.rpc[0].p_id === 401 && b.rpc[0].p_reason === 'The donor moved' && b.fn.join(',') === '401,777' && /Replaced: the original is kept, marked cancelled/.test(b.msg), b);
  await f.ev(() => { window.__rpc = []; window.__fn = []; return true; });
  await click(f, '#crm [data-w158bdo="cancel"][data-id="401"]'); await f.page.waitForTimeout(300);
  await setv(f, '#crm [data-w158breason="401"]', 'Issued in error');
  await click(f, '#crm [data-w158bgo="cancel"]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_receipt_cancel').map(x => x.args), fn: window.__fn.filter(x => x.name === 'receipt-pdf').map(x => x.body.receipt_id), msg: (document.querySelector('#crm .w154msg') || {}).innerText || '' }));
  ok('Cancel: the RPC with the reason, then the copy marked cancelled', b.rpc.length === 1 && b.rpc[0].p_id === 401 && b.rpc[0].p_reason === 'Issued in error' && b.fn.join(',') === '401' && /Cancelled: the receipt is kept, marked cancelled/.test(b.msg), b);
  await shot(f, 'receipts_on');
  /* the signature upload (a PNG made on the page) */
  b = await f.ev(async () => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 20; c.getContext('2d').fillRect(0, 0, 20, 10);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'sig.png', { type: 'image/png' });
    const inp = document.querySelector('#crm [data-w158bsig]'); if (!inp) return 'no input';
    const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
    return window.__st.filter(x => x.op === 'upload');
  });
  ok('the signature uploads as a PNG to the private bucket', Array.isArray(b) && b.length === 1 && b[0].bucket === 'receipts' && b[0].path === 'settings/signature.png' && b[0].type === 'image/png' && b[0].upsert === true, b);
  ok('no page errors (on)', f.errs.length === 0, f.errs);
  await f.close();

  /* a staff member who is not an admin */
  f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f, Object.assign({}, ON, { is_admin: false }));
  await f.hash('#crm/gifts/receipts', 2600);
  b = await f.ev(() => ({ t: ((document.querySelector('#crm .w152root') || {}).innerText || '').replace(/\s+/g, ' '), up: !!document.querySelector('#crm [data-w158bsig]'), sw: !!document.querySelector('#crm [data-w158bask], #crm [data-w158bmode]'),
    issue: document.querySelectorAll('#crm [data-w158bissue]').length, acts: document.querySelectorAll('#crm [data-w158bdo]').length, pdf: document.querySelectorAll('#crm [data-w158bpdf]').length }));
  ok('a staff member sees the state and the PDFs, without the admin controls', /Receipts from the Hub are on/.test(b.t) && !b.up && !b.sw && b.issue === 0 && b.acts === 0 && b.pdf === 3 && /An admin issues the receipts/.test(b.t), b);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  /* phone */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f, ON);
  await f.hash('#crm/gifts/receipts', 2600);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, rows: document.querySelectorAll('#crm .w158brow').length }));
  ok('phone: Receipts with the issued list does not scroll sideways', b.rows === 2 && b.sw <= b.w + 1, b);
  await shot(f, 'receipts_phone');
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw158bdrive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
