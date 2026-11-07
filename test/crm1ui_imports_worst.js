/* crm1ui_imports_worst.js: the worst-case drive for the Import page (#crm/settings/imports) and the public form (build/f/index.html), CRM slice 1,
   task 10b scope A. Dev only, never shipped: the data goes in through the drives' own boundary (window.__WAFIX and window.__WA_INVOKE, test/boot.js),
   never through the page. Invented people only; the Keela export files are never opened.
   usage: WA_DATA=demo|worst|empty|one|huge [WA_SHOTS=<folder>] [WA_ZOOM=1] node test/crm1ui_imports_worst.js [imports|public|all] [1366,390,320]
   WA_ZOOM=1 draws 200% zoom (a 683 x 450 viewport at device scale 2, which is what browser zoom does to the layout). CAND is the Hub page
   (test/boot.js); WA_FORM overrides the public page (default build/f/index.html), so the same checks can be run against an older build.
   It asserts the task 10b fixes, at every width asked for:
   - nothing scrolls sideways or spills, with every list and table open; on phones 44 px targets and 16 px text in inputs;
   - the head is one run line (no CRM stats strip, no second title), the empty state sits in the head card, one primary button per screen;
   - each status word stays at the right of its title's first line; cards keep their own height;
   - the event words and keys tables scroll inside a 180 to 320 px region under a header that stays put; "Read as" never breaks;
   - select labels wrap and stack, never cut; organisation pairs read on two lines; no "owner 0"; no double brackets; the upload message is
     red only on a failure; a long file name keeps its start and its end; a styled file picker;
   - a repaint touches only the changed card, keeps keyboard focus and keeps open lists open; the confirmation focuses Cancel for a batch that is
     never undone and for Undo, Apply otherwise, says "This cannot be undone." on its own line, holds the page still and fades out; a busy button
     keeps focus and the result is read out; Purge asks with focus on Cancel and a red "Yes, purge";
   - the public form: an unticked required email box marks only itself, with its message right under it, in English and French. */
const fs = require('fs'), path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
const DATA = process.env.WA_DATA || 'demo';
const SHOTS = process.env.WA_SHOTS || '';
const ZOOM = !!process.env.WA_ZOOM;
const JOB = process.argv[2] || 'all';
const WIDTHS = (process.argv[3] || '1366,390,320').split(',').map(Number);
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
function note(s) { out.push('NOTE ' + s); }
const W = ms => new Promise(r => setTimeout(r, ms));

/* ---------- invented data ---------- */
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['supporter'], tags: [], source: 'keela', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'test', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [], job_title: null, do_not_contact: false, dnc_reason: null }, o || {});
}
const REP = (kind, counts, lists) => ({ kind, counts: Object.assign({ rows_read: 0, matched: 0, created: 0, updated: {}, kept_hub_value: {}, skipped: {} }, counts), lists: Object.assign({}, lists || {}), changes: 0 });
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
/* long but believable values (the label is the run input's maxlength, 120) */
const LONG = {
  name: 'Aleksandra Wiśniewska-Kowalczyk', email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com',
  org: 'Fondation communautaire du Grand Montréal pour la sécurité alimentaire et le développement social',
  file: '12/1730764800000-Keela-export-15-all-contacts-every-field-2026-11-04-final-v3-after-the-Wednesday-night-timeout.csv',
  runLabel: 'Keela export 15 all contacts every field 2026-11-04 final v3, second attempt after Wednesday night\'s timeout, Steel',
  event: 'Unsubscribed from all Welfare Avenue email communications through the Mailchimp preference centre (synced from Mailchimp)',
  waCamp: 'Rally Paper 2026: Spring Food Drive at the Marché Jean-Talon with the Plateau Mont-Royal volunteers',
  err: 'missing key "Custom Field: Date of birth (YYYY-MM-DD)" in imports/12/1730764800000-Keela-export-15-all-contacts-every-field-2026-11-04-final-v3.csv'
};
const WORDS = ['Email Unsubscribed', 'Email Subscribed', 'Hard Bounce', 'Soft Bounce', 'Spam Complaint', 'Profile updated', LONG.event, 'Opted in via form', 'Opted out via form', 'Imported',
  'Subscribed (Mailchimp)', 'Unsubscribed (Mailchimp)', 'Cleaned (Mailchimp)', 'Resubscribed', 'Text opt-in', 'Text opt-out (STOP)', 'Marked as spam by recipient', 'Bounce: mailbox full', 'Bounce: domain does not exist', 'Manual opt-out by staff',
  'Manual opt-in by staff', 'Double opt-in confirmed', 'Double opt-in expired', 'Consent renewed at the gala', 'Consent withdrawn by phone', 'Newsletter sign-up (website)', 'Newsletter sign-up (event tablet)', 'Unsubscribed from Toronto list', 'Subscribed to Toronto list', 'Changed email address',
  'Merged with duplicate', 'Archived', 'Restored', 'Bulk import 2021', 'Bulk import 2023', 'Désabonné (formulaire français)', 'Abonné (formulaire français)', 'Unknown event', 'API update', 'Zapier sync'];
const READ = ['unsubscribe', 'optin', 'bounce', 'bounce', 'complaint', 'other', 'unsubscribe', 'optin', 'unsubscribe', 'other'];
/* what the run line must say for each dataset */
const LINE = { demo: 'Run 7: 3 of 8 applied, 3 compared, 1 failed', worst: 'Run 12: 2 of 8 applied, 4 compared, 1 failed', huge: 'Run 12: 2 of 8 applied, 4 compared, 1 failed',
  one: 'Run 1: 2 of 8 applied, 1 compared, 1 undone', empty: 'No import run yet' };

function importRows() {
  const runs = [], batches = [], files = {}, keys = {};
  if (DATA === 'empty') return { runs, batches, files, keys };
  if (DATA === 'demo') {
    runs.push({ id: 7, label: 'Test Keela run', created_by: 'test@example.com', created_at: '2026-08-10T12:00:00Z', last_applied_at: '2026-08-20T12:00:00Z', purged_at: null },
      { id: 6, label: 'Test older run', created_by: 'test@example.com', created_at: '2026-08-01T12:00:00Z', last_applied_at: null, purged_at: '2026-08-05T12:00:00Z' });
    files[7] = [{ id: 11, run_id: 7, name: '7/1700000000000-test-contacts.json', kind: 'keela_contacts_json', rows: 14, staged_through: 14 }];
    keys[11] = [{ key: 'Contact Id', filled: 14 }, { key: 'Primary Email', filled: 12 }, { key: 'Subscription History', filled: 8 }, { key: 'Subscription History[].date', filled: 8 }];
    batches.push(
      { id: 71, run_id: 7, kind: 'optouts', status: 'applied', report: REP('optouts', { rows_read: 1510, matched: 8, updated: { email_status: 8, consent_source: 8 }, skipped: { 'latest event is not an opt-out': 1502 }, undated_events: 2, undated_optouts_honoured: 1 },
        { event_words: [{ words: 'Email Unsubscribed', read_as: 'unsubscribe', count: 7 }, { words: 'Profile updated', read_as: 'other', count: 1 }], unrecognised_event_types: ['Profile updated'] }), error: null },
      { id: 72, run_id: 7, kind: 'legacy_fields', status: 'compared', report: REP('legacy_fields', { rows_read: 1468, matched: 1468, updated: { crm_contact_fields: 600, owner_member_id: 0 }, skipped: { 'assignee not mapped': 125 } }, { assignees_unmapped: ['Test Keela User'], positions_unmapped: ['Juggler'] }), error: null },
      { id: 73, run_id: 7, kind: 'people', status: 'applied', report: REP('people', { rows_read: 1510, matched: 1457, created: 31, updated: { city: 40, phones: 12 }, kept_hub_value: { city: 3 } }, { keela_ids_skipped: [{ keela_id: 'KT007', reason: 'no email or phone' }] }), error: null },
      { id: 74, run_id: 7, kind: 'fields', status: 'failed', report: null, error: 'missing key Birth Date' },
      { id: 75, run_id: 7, kind: 'orgs', status: 'compared', report: REP('orgs', { rows_read: 63, matched: 20, created: 30 }, { org_pairs: [{ keela_company_id: 'KC05', keela_name: 'Test Foundation of Montreal', partner_id: 4002, partner_name: 'Test Foundation' }] }), error: null },
      { id: 76, run_id: 7, kind: 'consent', status: 'applied', report: REP('consent', { rows_read: 1510, matched: 1400, updated: { crm_consent_events: 2900 } }), error: null },
      { id: 77, run_id: 7, kind: 'participation', status: 'compared', report: REP('participation', { rows_read: 1510, matched: 1100 }, { campaigns_to_create: ['Test Gala 2026'] }), error: null });
    return { runs, batches, files, keys };
  }
  if (DATA === 'one') {
    runs.push({ id: 1, label: 'First run', created_by: 'test@example.com', created_at: '2026-09-24T12:00:00Z', last_applied_at: '2026-09-24T13:00:00Z', purged_at: null });
    files[1] = [{ id: 1, run_id: 1, name: '1/1700000000000-one.json', kind: 'keela_contacts_json', rows: 1, staged_through: 1 }];
    keys[1] = [{ key: 'Contact Id', filled: 1 }];
    batches.push(
      { id: 1, run_id: 1, kind: 'optouts', status: 'applied', report: REP('optouts', { rows_read: 1, matched: 1, updated: { email_status: 1 }, undated_events: 1, undated_optouts_honoured: 1 }, { event_words: [{ words: 'Email Unsubscribed', read_as: 'unsubscribe', count: 1 }] }), error: null },
      { id: 2, run_id: 1, kind: 'people', status: 'applied', report: REP('people', { rows_read: 1, matched: 1, created: 1, updated: { city: 1 }, kept_hub_value: { city: 1 }, skipped: { 'no email or phone': 1 } }, { keela_ids_skipped: [{ keela_id: 'KT001', reason: 'no email or phone' }] }), error: null },
      { id: 3, run_id: 1, kind: 'consent', status: 'compared', report: REP('consent', { rows_read: 1, matched: 0 }), error: null },
      { id: 4, run_id: 1, kind: 'orgs', status: 'undone', report: { kind: 'orgs', undo: { restored: 1, removed: 1, kept: 1, review: 1 }, counts: {}, lists: {} }, error: null });
    return { runs, batches, files, keys };
  }
  /* worst and huge */
  const huge = DATA === 'huge';
  runs.push({ id: 12, label: LONG.runLabel, created_by: LONG.email, created_at: '2026-08-10T12:00:00Z', last_applied_at: '2026-08-26T12:00:00Z', purged_at: null });
  range(huge ? 49 : 3, i => runs.push({ id: 11 - i, label: i % 2 ? 'Keela test' : null, created_by: 'test@example.com', created_at: '2026-07-0' + (1 + (i % 9)) + 'T12:00:00Z', last_applied_at: null, purged_at: i % 3 ? null : '2026-07-15T12:00:00Z' }));
  files[12] = [{ id: 21, run_id: 12, name: LONG.file, kind: 'keela_contacts_json', rows: 1284, staged_through: 1284 },
    { id: 22, run_id: 12, name: '12/1730764900000-IMG_20250914_183022_responses_export_final_final.json', kind: 'keela_responses_json', rows: 4213, staged_through: 2500 },
    { id: 23, run_id: 12, name: '12/1730765000000-transactions.csv', kind: 'keela_transactions_csv', rows: null, staged_through: null }];
  const KEYS = ['Contact Id', 'Primary Email', 'Subscription History', 'Subscription History[].date', 'Custom Field: What languages do you speak at home? (select all that apply)', 'Custom Field: Date of birth (YYYY-MM-DD)', 'Company Name', 'Job Title', 'Tags', 'Assignee'];
  keys[21] = range(huge ? 1000 : 60, i => ({ key: i < KEYS.length ? KEYS[i] : 'Custom Field ' + (i + 1) + (i % 7 === 0 ? ': How did you hear about Welfare Avenue and the Sunday meals?' : ''), filled: i === 0 ? 1284 : i % 5 === 0 ? 0 : i % 3 === 0 ? 1 : 1284 - i * 7 }));
  const words = WORDS.map((w, i) => ({ words: w, read_as: READ[i % READ.length], count: i === 0 ? 1284 : i % 4 === 0 ? 1 : 3 + i * 11 }));
  const many = n => range(n, i => ({ keela_id: 'KT' + String(100000 + i), reason: i % 3 ? 'no email or phone' : 'a phone-only match with ' + LONG.name }));
  batches.push(
    { id: 121, run_id: 12, kind: 'optouts', status: 'applied', report: REP('optouts', { rows_read: 1284, matched: 1, updated: { email_status: 1, consent_source: 1 }, skipped: { 'latest event is not an opt-out': 1283 }, undated_events: 1, undated_optouts_honoured: 1, unrecognised_events: 1 },
      { event_words: words, unrecognised_event_types: WORDS.slice(30) }), error: null },
    { id: 122, run_id: 12, kind: 'legacy_fields', status: 'compared', report: REP('legacy_fields', { rows_read: 1284, matched: 1284, updated: { crm_contact_fields: 1284, owner_member_id: 0, full_name: 1, postal_code: 12, job_title: 3, legacy_refs: 1 }, skipped: { 'assignee not mapped': 125 } },
      { assignees_unmapped: [LONG.name, 'Jo', 'Đặng Thị Ngọc Hân', '🦊 Fox Liang', 'Christopher Alexander Montgomery III'], positions_unmapped: ['Juggler', 'Kitchen lead (Sundays, Marché Jean-Talon)'] }), error: null },
    { id: 123, run_id: 12, kind: 'people', status: 'applied', report: REP('people', { rows_read: 1284, matched: 1, created: 0, updated: { city: 1284, phones: 1 }, kept_hub_value: { city: 1 } }, { keela_ids_skipped: many(huge ? 1284 : 240), phone_only: many(huge ? 1000 : 12) }), error: null },
    { id: 124, run_id: 12, kind: 'fields', status: 'failed', report: null, error: LONG.err },
    { id: 125, run_id: 12, kind: 'orgs', status: 'compared', report: REP('orgs', { rows_read: 63, matched: 0, created: 1 }, { org_pairs: [{ keela_company_id: 'KC05', keela_name: LONG.org, partner_id: 4002, partner_name: 'Community Foundation of Greater Montreal' }, { keela_company_id: 'KC06', keela_name: 'IGA', partner_id: 4003, partner_name: 'IGA Extra Famille Duchemin' }] }), error: null },
    { id: 126, run_id: 12, kind: 'consent', status: 'compared', report: REP('consent', { rows_read: 1, matched: 0, updated: { crm_consent_events: 1 } }), error: null },
    { id: 127, run_id: 12, kind: 'participation', status: 'compared', report: REP('participation', { rows_read: 1284, matched: 1284 }, { campaigns_to_create: [LONG.waCamp, 'Gala', 'Sunday meals 2019–2020 (archived)'] }), error: null });
  return { runs, batches, files, keys };
}
function fixture() {
  const fx = loadFixture();
  const cs = DATA === 'empty' ? [C(6900, 'Nora Testempty')] : [C(6001, LONG.name, { emails: [LONG.email], primary_email: LONG.email, kinds: ['donor', 'volunteer'] }), C(6002, 'Jo', { emails: ['a@b.co'], primary_email: 'a@b.co' })];
  fx.crm_contacts_v = cs; fx.crm_contacts = cs.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = []; fx.crm_donations = [];
  const im = importRows();
  fx.crm_import_runs = im.runs; fx.crm_import_batches = im.batches;
  fx.app_config = (fx.app_config || []).concat([{ key: 'keela_keys', value: '{}' }, { key: 'keela_assignee_map', value: '{}' }, { key: 'keela_org_pairs_ok', value: '[]' }, { key: 'keela_campaign_types', value: '{}' }]);
  return { fx, files: im.files, keys: im.keys };
}
/* crm-import answered in the page; window.__slow holds Compare, Apply and Undo back so the busy state can be seen */
function invoke(files, keys) {
  return `window.__calls = []; window.__WA_INVOKE = function (name, opts) {
  var b = (opts && opts.body) || {}; window.__calls.push({ name: name, body: JSON.parse(JSON.stringify(b)) });
  var F = ${JSON.stringify(files)}, K = ${JSON.stringify(keys)};
  if (name !== 'crm-import') return { data: null, error: null };
  if (b.action === 'files') return { data: { files: F[b.run_id] || [] }, error: null };
  if (b.action === 'keys') return { data: { keys: K[b.file_id] || [] }, error: null };
  if (b.action === 'apply' || b.action === 'undo' || b.action === 'compare') return new Promise(function (res) { setTimeout(function () { res({ data: { report: {} }, error: null }); }, window.__slow || 0); });
  return { data: {}, error: null };
};`;
}
const RPCS = { wa_org_editor: true, crm_age_band: null, wa_my_caps: { gifts_edit: true, import_admin: true, hr_private: true } };
const tag = (w, st) => DATA + '-' + (ZOOM ? 'zoom200' : String(w)) + (st ? '-' + st : '');
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

/* page-side helpers, installed once per page */
async function helpers(f) {
  await f.ev(() => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const nm = e => (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase());
    window.__t = {
      focus() { const a = document.activeElement; if (!a || a === document.body) return 'body'; return (a.getAttribute('data-w284act') ? 'act=' + a.getAttribute('data-w284act') + ' ' : '') + ((a.innerText || a.value || a.getAttribute('aria-label') || a.tagName) + '').trim().replace(/\s+/g, ' ').slice(0, 40); },
      overflow(sel) {
        const R = document.querySelector(sel) || document.body, iw = innerWidth, sw = document.documentElement.scrollWidth;
        const all = [...R.querySelectorAll('*')].filter(vis).filter(e => !e.closest('.w284vh'));
        const wide = all.filter(e => e.getBoundingClientRect().right > iw + 1).map(e => nm(e) + '>' + Math.round(e.getBoundingClientRect().right));
        const spill = all.filter(e => { const cs = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 2 && cs.overflowX === 'visible' && cs.display !== 'inline' && e.tagName !== 'svg' && e.tagName !== 'SELECT'; })
          .map(e => nm(e) + ':' + e.scrollWidth + '/' + e.clientWidth + ':' + (e.innerText || '').trim().slice(0, 30));
        return { iw, sw, wide: wide.slice(0, 6), spill: spill.slice(0, 6), n: wide.length + spill.length };
      },
      small(sel) {   /* phones: targets under 44 px, inputs under 16 px */
        const R = document.querySelector(sel) || document.body;
        const t = [...R.querySelectorAll('button,select,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),summary,textarea,label.w284pick')].filter(vis).filter(e => !e.closest('.w284vh'))
          .filter(e => e.getBoundingClientRect().height < 43.5).map(e => ((e.innerText || e.value || e.tagName) + '').trim().replace(/\s+/g, ' ').slice(0, 22) + ':' + Math.round(e.getBoundingClientRect().height));
        const s = [...R.querySelectorAll('select,textarea,input[type=text],input[type=email],input[type=tel],input:not([type])')].filter(vis).filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).map(e => nm(e) + ':' + getComputedStyle(e).fontSize);
        return { targets: t.slice(0, 8), inputs: s.slice(0, 6) };
      }
    };
  });
}

/* ---------- the Import page ---------- */
async function bootImports(browser, w) {
  const X = fixture();
  const f = await fresh(browser, { who: 'admin', width: ZOOM ? 683 : w, height: ZOOM ? 450 : undefined, hash: '#mypage', fixture: X.fx, rpcs: RPCS, init: invoke(X.files, X.keys), wait: 3500 });
  await f.hash('#crm/settings/imports', 2400);
  await f.page.mouse.move((ZOOM ? 683 : w) - 5, 300);   /* the pointer off the rail */
  await f.page.waitForTimeout(500);
  await helpers(f);
  return f;
}
async function imports(browser, w) {
  const vw = ZOOM ? 683 : w, phone = vw < 700, at = ' (' + DATA + ', ' + (ZOOM ? 'zoom 200%' : w) + ')', R = '#w284root';
  const f = await bootImports(browser, w);
  let b;
  /* the head */
  b = await f.ev(() => {
    const st = document.querySelector('.w152stats'), root = document.getElementById('w284root');
    return { line: (root.querySelector('.w284runline') || {}).textContent || '', strip: st ? getComputedStyle(st).display : 'none', titles: [...root.querySelectorAll('h2')].map(h => h.textContent.trim()),
      empty: root.querySelectorAll('.w284empty').length, cards: root.querySelectorAll('[data-w284card]').length, ask: /Name the run, then Start a new run\./.test(root.querySelector('.w284head').innerText),
      pri: [...root.querySelectorAll('.w284btn')].filter(x => { const r = x.getBoundingClientRect(); return r.width > 0 && !/\b(soft|ghost|danger)\b/.test(x.className); }).map(x => x.textContent.trim()) };
  });
  ok('the head is one run line, with no CRM stats strip and no second "Imports" title' + at, b.line === LINE[DATA] && b.strip === 'none' && b.titles.length === 1 && b.titles.indexOf('Imports') < 0, b);
  if (DATA === 'empty') ok('no run yet: the head card says so and "Name the run, then Start a new run.", with no separate empty box' + at, b.ask && b.empty === 0 && b.cards === 0, b);
  ok('one primary button on the screen' + at, b.pri.length <= 1, b.pri);
  await shot(f, 'imports-' + tag(w, 'view'));
  if (DATA === 'empty') { ok('no page errors' + at, f.errs.length === 0, f.errs); await f.close(); return; }

  /* every list and table open: nothing sideways at this width */
  await f.ev(() => { const k = document.querySelector('#w284root [data-w284keys]'); if (k && k.getAttribute('aria-expanded') !== 'true') k.click(); });
  await W(500);
  await f.ev(() => document.querySelectorAll('#w284root details').forEach(d => { d.open = true; }));
  await W(300);
  b = await f.ev(R => window.__t.overflow(R), R);
  ok('nothing scrolls sideways or spills, every list and the keys open' + at, b.sw <= b.iw + 1 && b.n === 0, b);
  if (phone) { b = await f.ev(R => window.__t.small(R), R); ok('phone: 44 px targets and 16 px inputs' + at, b.targets.length === 0 && b.inputs.length === 0, b); }

  /* status words, card heights */
  b = await f.ev(() => [...document.querySelectorAll('#w284root [data-w284card]')].map(c => {
    const h = c.querySelector('h3').getBoundingClientRect(), s = c.querySelector('.w284st').getBoundingClientRect(), cs = getComputedStyle(c);
    return { k: c.getAttribute('data-w284card'), top: Math.round(s.top - h.top), right: Math.round(c.getBoundingClientRect().right - parseFloat(cs.paddingRight) - s.right), h: Math.round(c.getBoundingClientRect().height) };
  }));
  ok('each status word sits at the right of its title\'s first line' + at, b.every(x => x.top >= 0 && x.top <= 12 && Math.abs(x.right) <= 1), b);
  b = await f.ev(() => getComputedStyle(document.querySelector('#w284root .w284cards')).alignItems);
  ok('cards keep their own height (align-items start)' + at, b === 'start', b);

  /* the sentence, the lists, the pairs */
  b = await f.ev(() => ({ sums: [...document.querySelectorAll('#w284root .w284sum')].map(p => p.textContent), labels: [...document.querySelectorAll('#w284root .w284ls>b')].map(x => x.textContent) }));
  ok('no field listed with 0 changes ("owner 0")' + at, !b.sums.some(s => /\bowner 0\b| 0\)/.test(s)), b.sums);
  ok('no double brackets in the list labels' + at, !b.labels.some(s => /\)\s*\(/.test(s)), b.labels);
  b = await f.ev(() => [...document.querySelectorAll('#w284root .w284pair')].map(p => { const s = [...p.children]; return { lines: s.map(x => x.textContent), stacked: s.length === 2 && s[1].getBoundingClientRect().top >= s[0].getBoundingClientRect().bottom - 1, bold: !!(s[0] && s[0].querySelector('b')) }; }));
  if (b.length) ok('organisation pairs read on two lines, "Keela: X" (bold) over "Partners: Y"' + at, b.every(x => x.stacked && x.bold && /^Keela: /.test(x.lines[0]) && /^Partners: /.test(x.lines[1])), b);

  /* the tables: a 180 to 320 px region, a header that stays put, "Read as" that never breaks */
  b = await f.ev(() => [...document.querySelectorAll('#w284root .w284scroll')].map(s => {
    const t = s.querySelector('table'), r = s.getBoundingClientRect();
    const tall = t.getBoundingClientRect().height > r.height + 1;
    s.scrollTop = 120; const th = s.querySelector('thead th').getBoundingClientRect().top - s.getBoundingClientRect().top; s.scrollTop = 0;
    return { key: s.getAttribute('data-w284keep'), h: Math.round(r.height), tall, sticky: Math.round(th), region: s.getAttribute('role') === 'region' && s.tabIndex === 0 && !!s.getAttribute('aria-labelledby') };
  }));
  if (b.length) ok('long tables scroll inside a 180 to 320 px region under a sticky header' + at, b.every(x => x.region && x.h <= 321 && (!x.tall || (x.h >= 179 && Math.abs(x.sticky) <= 1.5))), b);
  /* "Read as": the kind ("opt-out") and what it does ("(unsubscribed)") are each nowrap and on one line; a narrow card may put the second under
     the first, never a word cut in two. The words wrap with break-word. */
  b = await f.ev(() => [...document.querySelectorAll('#w284root .w284words')].map(t => ({
    ra: [...t.querySelectorAll('td.w284ra span')].filter(sp => sp.getClientRects().length).map(sp => { const r = document.createRange(); r.selectNodeContents(sp); const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; return { t: sp.textContent, lines, ws: getComputedStyle(sp).whiteSpace }; }),
    words: [...t.querySelectorAll('tbody td:first-child')].slice(0, 3).map(td => getComputedStyle(td).overflowWrap) })));
  if (b.length) ok('"Read as" never breaks inside a word (each part nowrap, on one line) and the words wrap with break-word' + at, b.every(t => t.ra.length && t.ra.every(x => x.lines === 1 && x.ws === 'nowrap') && t.words.every(x => x === 'break-word')), b.map(t => ({ n: t.ra.length, bad: t.ra.filter(x => x.lines !== 1 || x.ws !== 'nowrap').slice(0, 4), words: t.words })));

  /* the selects: wrap and stack, never cut */
  b = await f.ev(() => [...document.querySelectorAll('#w284root .w284ctl .w284row')].map(row => {
    const sp = row.querySelector('span'), se = row.querySelector('select'); const a = sp.getBoundingClientRect(), z = se.getBoundingClientRect();
    return { name: sp.textContent.slice(0, 24), cut: sp.scrollWidth > sp.clientWidth + 1, selW: Math.round(z.width), selNeeds: se.scrollWidth, stacked: z.top >= a.bottom - 1, overlap: !(z.left >= a.right - 1 || z.top >= a.bottom - 1) };
  }));
  if (b.length) ok('select labels wrap and the select stacks under them in a narrow card, never cut or overlapping' + at, b.every(x => !x.cut && !x.overlap && x.selW >= 150), b);

  /* the files: the picker, long names, the upload message colour */
  b = await f.ev(() => {
    const root = document.getElementById('w284root'), inp = root.querySelector('input[type=file]'), pick = root.querySelector('label.w284pick');
    const names = [...root.querySelectorAll('.w284fh b')].map(x => ({ t: x.textContent, title: x.getAttribute('title') || '' }));
    const S = window.w284.state(); S.upMsg = 'Uploading Keela export not final errors.json…'; S.upErr = false; window.w284.paint();
    const okCls = (root.querySelector('.w284upw p') || {}).className;
    S.upMsg = 'The file could not be uploaded (offline).'; S.upErr = true; window.w284.paint();
    const badP = root.querySelector('.w284upw p'), bad = badP ? badP.className + '/' + badP.getAttribute('role') : '';
    S.upMsg = ''; S.upErr = false; window.w284.paint();
    return { native: inp ? inp.getBoundingClientRect().width > 2 : false, pick: pick ? pick.textContent.trim() : '', names, okCls, bad };
  });
  ok('a styled file picker (a soft button around a hidden input)' + at, !b.native && /Choose a file/.test(b.pick), b);
  ok('the upload message is red only when something failed, never from its words' + at, b.okCls === 'w284note' && b.bad === 'w284err/alert', b);
  if (DATA === 'worst' || DATA === 'huge') ok('a long file name keeps its start and its end (…v3-after-the-Wednesday-night-timeout.csv), the whole name in its title' + at,
    b.names.some(x => /…/.test(x.t) && /^Keela-export-15/.test(x.t) && /timeout\.csv$/.test(x.t) && x.title === 'Keela-export-15-all-contacts-every-field-2026-11-04-final-v3-after-the-Wednesday-night-timeout.csv'), b.names);
  await shot(f, 'imports-' + tag(w, 'open'), true);

  /* a repaint touches only the changed card, keeps focus, keeps open lists open */
  const pairSel = DATA === 'demo' ? '[data-w284pair="KC05|4002"]' : DATA === 'one' ? null : '[data-w284pair="KC05|4002"]';
  if (pairSel) {
    await f.ev(() => document.querySelectorAll('#w284root [data-w284card]').forEach(c => { c.__probe = 1; }));
    const open0 = await f.ev(() => [...document.querySelectorAll('#w284root details')].filter(d => d.open).length);
    await f.page.focus('#w284root ' + pairSel); await f.page.keyboard.press('Space'); await W(400);
    b = await f.ev((s) => ({ focus: document.activeElement && document.activeElement.matches && document.activeElement.matches('#w284root ' + s), checked: document.querySelector('#w284root ' + s).checked,
      redrawn: [...document.querySelectorAll('#w284root [data-w284card]')].filter(c => !c.__probe).map(c => c.getAttribute('data-w284card')),
      open: [...document.querySelectorAll('#w284root details')].filter(d => d.open).length, fade: (document.querySelector('#w284root [data-w284card="orgs"]') || {}).className }), pairSel);
    ok('ticking a pair with the keyboard redraws only its card, keeps focus on the box and every open list open' + at, b.focus && b.checked && JSON.stringify(b.redrawn) === '["orgs"]' && b.open === open0, Object.assign({ open0 }, b));
    await f.ev(() => window.w284.paint());
    b = await f.ev(() => ({ redrawn: [...document.querySelectorAll('#w284root [data-w284card]')].filter(c => !c.__probe).map(c => c.getAttribute('data-w284card')), open: [...document.querySelectorAll('#w284root details')].filter(d => d.open).length }));
    ok('a repaint with nothing changed redraws nothing and closes nothing' + at, JSON.stringify(b.redrawn) === '["orgs"]' && b.open === open0, b);
  }
  b = await f.ev(() => { const k = document.querySelector('#w284root [data-w284keys]'); if (!k) return null; document.querySelectorAll('#w284root [data-w284card]').forEach(c => { c.__probe2 = 1; }); k.focus(); return k.getAttribute('data-w284keys'); });
  if (b) {
    await f.page.keyboard.press('Enter'); await W(400);
    const k = b; b = await f.ev((k) => ({ focus: window.__t.focus(), same: document.activeElement.getAttribute('data-w284keys') === k, redrawn: [...document.querySelectorAll('#w284root [data-w284card]')].filter(c => !c.__probe2).length }), k);
    ok('Keys from the keyboard keeps focus on the file\'s button and redraws no card' + at, b.same && b.redrawn === 0, b);
    await f.page.keyboard.press('Enter'); await W(300);   /* the keys open again for what follows */
  }
  b = await f.ev(() => { const s = document.querySelector('#w284root [data-w284assign]'); if (!s) return null; s.focus(); return s.getAttribute('data-w284assign'); });
  if (b) {
    const who = b;
    await f.page.keyboard.press('ArrowDown'); await W(300);
    b = await f.ev((who) => { const a = document.activeElement; return { same: a && a.getAttribute('data-w284assign') === who, value: a && a.value }; }, who);
    if (b.same && !b.value) { /* a closed select did not step on this platform: choose the option as a keyboard user would, with the select focused */
      await f.ev(() => { const s = document.activeElement; s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); }); await W(300);
      b = await f.ev((who) => { const a = document.activeElement; return { same: a && a.getAttribute('data-w284assign') === who, value: a && a.value, stepped: 'by value' }; }, who);
    }
    ok('choosing an assignee keeps focus on that select (its card redraws around it)' + at, b.same && !!b.value, b);
  }

  /* the confirmation */
  const neverK = await f.ev(() => { const x = document.querySelector('#w284root [data-w284apply="consent"],#w284root [data-w284apply="optouts"]'); return x ? x.getAttribute('data-w284apply') : null; });
  if (neverK) {
    await f.ev(k => { document.activeElement.blur(); document.querySelector('#w284root [data-w284apply="' + k + '"]').click(); }, neverK); await W(400);
    b = await f.ev(() => { const box = document.querySelector('#w284pop [role=dialog]'), pd = document.getElementById('w284pd'), pw = document.getElementById('w284pw');
      return { focus: window.__t.focus(), desc: box.getAttribute('aria-describedby'), warn: pw ? pw.textContent : '', apart: !!(pd && pw && !pd.contains(pw) && pw.className === 'w284warn' && /^(If applied|Applied|Read)/.test(pd.textContent)),
        aboveButtons: pw ? pw.getBoundingClientRect().bottom <= box.querySelector('.w284acts').getBoundingClientRect().top + 1 : false }; });
    ok('a never-undone batch\'s confirmation focuses Cancel and says "This cannot be undone." on its own line above the buttons' + at, b.focus === 'Cancel' && b.desc === 'w284pd w284pw' && b.warn === 'This cannot be undone.' && b.apart && b.aboveButtons, b);
    await shot(f, 'imports-' + tag(w, 'pop'));
    const y0 = await f.ev(() => scrollY);
    await f.page.mouse.move(vw / 2, 60); await f.page.mouse.wheel(0, 600); await W(300);
    b = await f.ev(() => ({ y: scrollY, lock: getComputedStyle(document.documentElement).overflow }));
    ok('the page behind the confirmation holds still' + at, b.y === y0 && b.lock === 'hidden', Object.assign({ y0 }, b));
    await f.page.keyboard.press('Enter'); await W(60);
    b = await f.ev(() => ({ out: !!document.getElementById('w284pop-out'), pop: !!document.getElementById('w284pop'), applied: window.__calls.filter(c => c.body.action === 'apply').length, focus: window.__t.focus() }));
    await W(350);
    const gone = await f.ev(() => !document.getElementById('w284pop-out') && getComputedStyle(document.documentElement).overflow !== 'hidden');
    ok('Enter there cancels: nothing applied, a short fade out, focus back on the card\'s Apply' + at, b.applied === 0 && !b.pop && b.out && gone && b.focus === 'act=' + neverK + ' Apply', Object.assign({ gone }, b));
  } else note('no never-undone batch to apply in ' + DATA);
  const undoK = await f.ev(() => { const x = document.querySelector('#w284root [data-w284undo]'); return x ? x.getAttribute('data-w284undo') : null; });
  if (undoK) {
    await f.ev(k => document.querySelector('#w284root [data-w284undo="' + k + '"]').click(), undoK); await W(400);
    b = await f.ev(() => window.__t.focus());
    ok('Undo\'s confirmation focuses Cancel' + at, b === 'Cancel', b);
    await f.page.keyboard.press('Escape'); await W(350);
  }
  const applyK = await f.ev(() => { const x = [...document.querySelectorAll('#w284root [data-w284apply]')].find(e => !/^(consent|optouts)$/.test(e.getAttribute('data-w284apply'))); return x ? x.getAttribute('data-w284apply') : null; });
  if (applyK) {
    await f.ev(k => { window.__slow = 1500; const x = document.querySelector('#w284root [data-w284apply="' + k + '"]'); x.focus(); x.click(); }, applyK); await W(400);
    b = await f.ev(() => { const rc = document.querySelector('#w284pop [role=dialog]').getBoundingClientRect(); return { focus: window.__t.focus(), dx: Math.round(rc.left + rc.width / 2 - innerWidth / 2), dy: Math.round(rc.top + rc.height / 2 - innerHeight / 2), note: (document.getElementById('w284pw') || {}).className }; });
    ok('an undoable Apply\'s confirmation focuses Apply and stays centred' + at, b.focus === 'Apply' && Math.abs(b.dx) <= 2 && Math.abs(b.dy) <= 2 && b.note === 'w284note', b);
    await f.page.keyboard.press('Enter'); await W(250);
    b = await f.ev(k => { const a = document.activeElement; return { focus: window.__t.focus(), busy: a.getAttribute('aria-busy'), dis: a.getAttribute('aria-disabled'), calls: window.__calls.filter(c => c.body.action === 'apply').length }; }, applyK);
    ok('while it applies, the button stays in place, says "Applying…" and keeps focus' + at, b.focus === 'act=' + applyK + ' Applying…' && b.busy === 'true' && b.dis === 'true' && b.calls === 1, b);
    await shot(f, 'imports-' + tag(w, 'busy'));
    await W(1800);
    b = await f.ev(k => ({ focus: window.__t.focus(), live: (document.querySelector('#w284root .w284live') || {}).textContent || '' }), applyK);
    ok('when it is done, focus is on the card\'s action again and the result is read out' + at, b.focus.indexOf('act=' + applyK + ' ') === 0 && /^Batch \d, /.test(b.live), b);
    await f.ev(() => { window.__slow = 0; });
  }

  /* purge asks with focus on Cancel, and "Yes, purge" is red */
  b = await f.ev(() => { const p = document.querySelector('#w284root [data-w284purge]'); if (!p) return null; p.click(); return 1; });
  if (b) {
    await W(300);
    b = await f.ev(() => ({ focus: window.__t.focus(), yes: (document.querySelector('#w284root [data-w284purgeyes]') || {}).className || '', purged: window.__calls.some(c => c.body.action === 'purge') }));
    ok('Purge asks inside its row with focus on Cancel, and "Yes, purge" is the red danger button' + at, b.focus === 'Cancel' && /\bdanger\b/.test(b.yes) && !b.purged, b);
    await f.ev(() => document.querySelector('#w284root .w284purge').scrollIntoView({ block: 'center' }));
    await shot(f, 'imports-' + tag(w, 'purge'));
    await f.page.keyboard.press('Enter'); await W(300);
    b = await f.ev(() => window.__t.focus());
    ok('Cancel puts focus back on "Purge this run"' + at, b === 'Purge this run', b);
  }

  /* reduced motion keeps the fade on a redrawn card */
  if (pairSel) {
    await f.page.emulateMedia({ reducedMotion: 'reduce' });
    await f.ev(s => { const c = document.querySelector('#w284root ' + s); c.click(); }, pairSel); await W(40);
    b = await f.ev(() => { const c = document.querySelector('#w284root [data-w284card="orgs"]'); return { cls: c.className, anim: getComputedStyle(c).animationName }; });
    ok('reduced motion keeps the 140 ms fade on a redrawn card (opacity, no movement)' + at, /w284fade/.test(b.cls) && b.anim === 'w284fade', b);
    await f.page.emulateMedia({ reducedMotion: 'no-preference' });
  }

  /* huge: a capped table keeps the page short and a repaint quick */
  if (DATA === 'huge') {
    b = await f.ev(() => {
      const S = window.w284.state(), t0 = performance.now();
      for (let i = 0; i < 5; i++) { S.stage[22] = 'Staged ' + (2500 + i) + ' of 4,213 rows…'; window.w284.paint(); document.body.offsetHeight; }
      S.stage[22] = ''; window.w284.paint();
      return { ms: Math.round((performance.now() - t0) / 5), rows: document.querySelectorAll('#w284root .w284keys tbody tr').length, h: document.documentElement.scrollHeight };
    });
    note('huge: one staging step repaints in ' + b.ms + ' ms with ' + b.rows + ' table rows open; the page is ' + b.h + ' px tall');
    ok('huge: 1,000 keys and 40 event words stay inside their regions (the page is not tens of thousands of px tall)' + at, b.h < 12000, b);
  }
  ok('no page errors' + at, f.errs.length === 0, f.errs);
  await f.close();
}

/* ---------- the public form ---------- */
async function publicForm(browser, w, lang) {
  const fr = lang === 'fr', vw = ZOOM ? 683 : w, at = ' (' + lang + ', ' + (ZOOM ? 'zoom 200%' : w) + ')';
  const consent = { ask: true, required: true, label: fr ? 'Envoyez-moi les nouvelles de Welfare Avenue par courriel. Je peux me désabonner en tout temps.' : 'Send me Welfare Avenue news by email. I can unsubscribe at any time.',
    sms: { ask: true, label: fr ? 'Écrivez-moi par texto au sujet du bénévolat. Je peux répondre STOP en tout temps.' : 'Text me about volunteering. I can reply STOP at any time.' } };
  const X = fixture();
  const f = await fresh(browser, { html: fs.readFileSync(process.env.WA_FORM || path.join(__dirname, '../build/f/index.html'), 'utf8'), width: vw, height: ZOOM ? 450 : undefined, hash: '?form=benevoles', gateOk: true, wait: 1500, fixture: X.fx, beforeGoto: async (pg) => {
    await pg.route('**/functions/v1/form-submit**', route => {
      const r = route.request(), H = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
      if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
      if (r.method() === 'GET') return route.fulfill({ status: 200, headers: H, body: JSON.stringify({ token: '1.x', org: { name: 'Welfare Avenue', address: '1234 rue Test, Montréal QC H2X 1Y4', email: 'info@example.org' },
        form: { slug: 'benevoles', title: fr ? 'Inscription des bénévoles pour les repas du dimanche au Marché Jean-Talon' : 'Volunteer for the Sunday meals at the Marché Jean-Talon', intro: '', lang, kind: 'volunteer', thank_you: 'Merci.', cover: null,
          questions: [{ id: 'first_name', type: 'text', label: fr ? 'Prénom (tel qu’il apparaît sur votre pièce d’identité)' : 'First name (as it appears on your ID)', required: true }, { id: 'email', type: 'email', label: fr ? 'Adresse courriel où nous pouvons vous joindre' : 'Email address where we can reach you', required: true }], consent } }) });
      return route.fulfill({ status: 200, headers: H, body: JSON.stringify({ ok: true, thank_you: 'Merci.' }) });
    });
  } });
  await f.page.waitForSelector('#waf', { timeout: 8000 }).catch(() => {});
  await helpers(f);
  await f.ev(() => { const b = document.querySelector('#send'); if (b) b.click(); }); await W(500);
  await f.ev(() => { const c = document.querySelector('.consent'); if (c) c.scrollIntoView({ block: 'center' }); }); await W(200);
  const b = await f.ev(() => {
    const em = document.querySelector('[data-q="_consent"]'), sms = document.querySelector('[data-q="_consent_sms"]'), err = document.getElementById('q__consent_e'), box = document.getElementById('q__consent');
    const smsChoice = sms && sms.querySelector('.choice'), emChoice = em && em.querySelector('.choice');
    return { bad: [...document.querySelectorAll('.consent .bad')].map(x => x.getAttribute('data-q')), emRed: emChoice ? getComputedStyle(emChoice).borderTopColor : '', smsRed: smsChoice ? getComputedStyle(smsChoice).borderTopColor : '',
      errIn: !!(err && em && em.contains(err)), errAbove: !!(err && smsChoice && err.getBoundingClientRect().bottom <= smsChoice.getBoundingClientRect().top + 1), desc: box && box.getAttribute('aria-describedby'), msg: err ? err.textContent : '',
      boxes: [...document.querySelectorAll('.consent .choice input')].map(i => i.name), lang: document.documentElement.lang };
  });
  const MSG = fr ? 'Veuillez cocher la case pour vous inscrire.' : 'Please tick the box to sign up.';
  ok('an unticked required email box marks only itself; the text box stays as it was' + at, JSON.stringify(b.bad) === '["_consent"]' && b.emRed === 'rgb(179, 64, 47)' && b.smsRed !== b.emRed, b);
  ok('the message sits right under the email box, above the text box, and the box points to it' + at, b.errIn && b.errAbove && b.desc === 'q__consent_e' && b.msg === MSG && b.lang === lang && JSON.stringify(b.boxes) === '["_consent","_consent_sms"]', b);
  const o = await f.ev(() => window.__t.overflow('body'));
  ok('nothing scrolls sideways' + at, o.sw <= o.iw + 1 && o.wide.length === 0, o);
  await shot(f, 'public-' + tag(w, lang + '-error'));
  ok('no page errors' + at, f.errs.length === 0, f.errs);
  await f.close();
}

(async () => {
  const browser = await launch();
  if (ZOOM) { const nc = browser.newContext.bind(browser); browser.newContext = o => nc(Object.assign({}, o, { isMobile: false, hasTouch: false, deviceScaleFactor: 2 })); }
  const widths = ZOOM ? [683] : WIDTHS;
  for (const w of widths) {
    if (JOB === 'imports' || JOB === 'all') await imports(browser, w);
    if (JOB === 'public' || JOB === 'all') for (const lang of ['en', 'fr']) await publicForm(browser, w, lang);
  }
  await browser.close();
  console.log(out.join('\n'));
  console.log('\ncrm1ui_imports_worst (' + DATA + (ZOOM ? ', zoom 200%' : '') + '): ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
