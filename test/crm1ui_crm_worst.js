/* crm1ui_crm_worst.js: the CRM page's worst-case regression drive (task 10b, scope B; built from the task 10a review's scratch drive).
   Dev only: the data goes in through the same window.__WAFIX boundary as every drive (test/boot.js), never through the page.
   Invented people only. It asserts the UI fixes: a do-not-contact person shows no way to reach them and reads the picker's words, the
   permission section says the one rule, setting do not contact asks first and clearing does not, focus stays put, a spam complaint cannot
   be changed from the permission form, amounts keep their cents and never run out of their box, the read-only gift is text, the Sends
   list stacks on a phone and says "Latest 300 of N", the form editor's words follow its language, and nothing scrolls sideways at 320.
   usage: WA_DATA=demo|worst|empty|one|huge|all [WIDTHS=1366,390,320] [WA_ZOOM=1] [WA_SHOTS=<folder>] node test/crm1ui_crm_worst.js */
const fs = require('fs'), path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
const SETS = (process.env.WA_DATA || 'worst') === 'all' ? ['demo', 'worst', 'empty', 'one', 'huge'] : (process.env.WA_DATA || 'worst').split(',');
const WIDTHS = (process.env.WIDTHS || '1366,390,320').split(',').map(Number);
const ZOOM = !!process.env.WA_ZOOM, SHOTS = process.env.WA_SHOTS || '';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }

/* ---------- the data ---------- */
const LONG = { name: 'Aleksandra Wiśniewska-Kowalczyk', email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com', job: 'Senior Program Officer, Community Food Security and Indigenous Partnerships',
  camp: 'Holiday appeal 2026: Montreal and Toronto donors who gave in 2024 or 2025 but not yet this year (second reminder)', waCamp: 'Rally Paper 2026: Spring Food Drive at the Marché Jean-Talon with the Plateau Mont-Royal volunteers',
  list: 'Everyone who volunteered at least once since 2020 at the Marché Jean-Talon or Atwater markets' };
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['supporter'], tags: [], source: 'keela', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'test', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [], job_title: null, do_not_contact: false, dnc_reason: null }, o || {});
}
const G = (id, contact_id, amount, date, o) => Object.assign({ id, contact_id, amount, currency: 'CAD', donated_at: date + 'T15:00:00Z', platform: 'hub', campaign: null, designation: null, recurring: false, receipt_number: null, receipt_issued_at: null, receipt_url: null,
  receipt_source: null, receipt_eligible: true, external_id: null, notes: null, kind: 'donation', method: 'cheque', advantage_amount: 0, advantage_desc: null, in_kind_desc: null, appraiser: null, tribute_kind: null, tribute_name: null, created_by: 'test@example.com', updated_by: null }, o || {});
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
/* each dataset: the contact with the flag (dnc), one without it (plain), one with a spam complaint (spam) */
function fixture(DATA) {
  const fx = loadFixture();
  const worst = DATA === 'worst' || DATA === 'huge', empty = DATA === 'empty', one = DATA === 'one', huge = DATA === 'huge';
  let cs;
  if (empty) cs = [C(6900, 'Nora Testempty'), C(6901, 'Pat Testplain', { emails: ['pat@example.org'], primary_email: 'pat@example.org' }), C(6902, 'Sam Testspam', { emails: ['sam@example.org'], primary_email: 'sam@example.org', email_status: 'complained' })];
  else if (one) cs = [C(6001, 'Una Testone', { emails: ['una.test@example.com'], primary_email: 'una.test@example.com', phones: ['514 555 0101'], kinds: ['donor'], job_title: 'Cook', do_not_contact: true, dnc_reason: 'deceased', email_status: 'unsubscribed', sms_opt_out: true, donation_total: 1, donation_count: 1 }),
    C(6004, 'Jo', { emails: ['jo@example.org'], primary_email: 'jo@example.org' }), C(6005, 'Al Testspam', { emails: ['al@example.org'], primary_email: 'al@example.org', email_status: 'complained' })];
  else if (worst) cs = [
    C(6001, LONG.name, { emails: [LONG.email, 'first.last+billing-notifications@example.com'], primary_email: LONG.email, kinds: ['donor', 'volunteer', 'partner'], job_title: LONG.job, do_not_contact: true, dnc_reason: 'other', email_status: 'unsubscribed', sms_opt_out: true,
      address: '4321 boulevard Saint-Joseph Est, appartement 1204', city: 'Montréal', province: 'QC', postal_code: 'H1X 2A9', donation_total: 12345.67, donation_count: 1284, language: 'fr', phones: ['514 555 0123'], email_consent: 'express', consent_source: 'the gala', consent_at: '2025-03-03T12:00:00Z' }),
    C(6002, 'Jo', { emails: ['a@b.co'], primary_email: 'a@b.co', do_not_contact: true, dnc_reason: 'asked', email_status: 'unsubscribed', sms_opt_out: true, job_title: 'Chef' }),
    C(6003, '🦊 Fox Liang', { emails: ['fox@example.org'], primary_email: 'fox@example.org', phones: ['416 555 0199'], do_not_contact: true, dnc_reason: 'deceased', email_status: 'unsubscribed', sms_opt_out: true }),
    C(6004, 'Đặng Thị Ngọc Hân', { emails: ['ngoc.han@example.org'], primary_email: 'ngoc.han@example.org', phones: ['438 555 0142'], kinds: ['volunteer'], email_consent: 'none' }),
    C(6005, 'Christopher Alexander Montgomery III', { emails: ['cam3@example.org'], primary_email: 'cam3@example.org', kinds: ['donor'], email_status: 'complained' })];
  else cs = [C(5001, 'Amara Testdonor', { emails: ['amara.test@example.com'], primary_email: 'amara.test@example.com', phones: ['514 555 0111'], kinds: ['donor'], address: '12 rue Test, Montreal QC H2X 1Y4', city: 'Montreal', province: 'QC', postal_code: 'H2X 1Y4', job_title: 'Chef', email_consent: 'implied', implied_consent_until: '2027-09-20' }),
    C(5002, 'Bea Testasked', { emails: ['bea.test@example.com'], primary_email: 'bea.test@example.com', phones: ['514 555 0122'], email_status: 'unsubscribed', sms_opt_out: true, do_not_contact: true, dnc_reason: 'asked' }),
    C(5003, 'Cal Testvolunteer', { emails: ['cal.test@example.com'], primary_email: 'cal.test@example.com', kinds: ['volunteer'], source: 'cabm', email_status: 'complained' })];
  fx.crm_contacts_v = cs; fx.crm_contacts = cs.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = [];
  fx.crm_chapters = [{ code: 'montreal', name_en: 'Montreal', active: true, sort: 1 }, { code: 'toronto', name_en: 'Toronto', active: true, sort: 2 }];
  fx.crm_contact_chapters = []; fx.crm_contact_private = [];
  if (empty) { fx.crm_donations = []; fx.crm_gift_receipts_v = []; fx.crm_receipts = []; }
  else if (one) { fx.crm_donations = [G(61, 6001, 1, '2026-09-20', { campaign: 'Sunday meals' })]; fx.crm_gift_receipts_v = [{ gift_id: 61, contact_id: 6001, amount: 1, advantage_amount: 0, eligible_amount: 1, tax_year: 2026, kind: 'donation', platform: 'hub', receipt_number: null, receipt_status: 'due', receipt_note: 'A receipt is due for $1.00' }]; fx.crm_receipts = []; }
  else if (worst) {
    fx.crm_donations = [G(61, 6001, 12345.67, '2026-09-20', { campaign: LONG.waCamp, designation: 'Where it is needed most (unrestricted), in memory of Seán O\'Brien-Ó Súilleabháin', notes: 'Cheque 004512 dropped at the Marché Jean-Talon stand by her assistant', tribute_kind: 'memory', tribute_name: 'Seán O\'Brien-Ó Súilleabháin' }),
      G(62, 6002, 0.5, '2026-09-10'), G(63, 6003, 1000000, '2026-08-10', { platform: 'keela', method: null })]
      .concat(huge ? range(1000, i => G(1000 + i, 6004, 25 + (i % 40), '2026-0' + (1 + (i % 8)) + '-1' + (i % 9), { campaign: i % 2 ? 'Sunday meals' : null })) : []);
    fx.crm_gift_receipts_v = [{ gift_id: 61, contact_id: 6001, amount: 12345.67, advantage_amount: 345.67, eligible_amount: 12000, tax_year: 2026, kind: 'donation', platform: 'hub', receipt_number: null, receipt_status: 'due', receipt_note: 'A receipt is due for $12,000.00' }];
    fx.crm_receipts = [];
  } else {
    fx.crm_donations = [G(61, 5001, 100, '2026-09-20', { campaign: 'Sunday meals' }), G(62, 5002, 40, '2026-09-10'), G(63, 5001, 156.75, '2026-08-10', { platform: 'keela', method: null })];
    fx.crm_gift_receipts_v = [{ gift_id: 61, contact_id: 5001, amount: 100, advantage_amount: 0, eligible_amount: 100, tax_year: 2026, kind: 'donation', platform: 'hub', receipt_number: null, receipt_status: 'due', receipt_note: 'A receipt is due for $100.00' }];
    fx.crm_receipts = [];
  }
  const camp = (id, name, o) => Object.assign({ id, name, subject: 'Subject ' + id, preview: '', kind: 'newsletter', status: 'sent', list_id: 1, template_key: 'newsletter', vars: {}, created_at: '2026-09-0' + (1 + (id % 9)) + 'T12:00:00Z', updated_at: '2026-09-10T12:00:00Z', sent_at: '2026-09-10T12:00:00Z', queued_at: null, created_by: 'test@example.com' }, o || {});
  fx.crm_lists = empty ? [] : [{ id: 1, name: worst ? LONG.list : 'Newsletter readers', description: null, kind: 'dynamic', filter: {}, contact_ids: [], created_at: '2026-09-01T12:00:00Z', updated_at: '2026-09-01T12:00:00Z' }];
  fx.crm_campaigns = empty ? [] : one ? [camp(1, 'September news')] : worst ? [camp(1, LONG.camp, { subject: 'Your gift last winter fed 1,284 families: will you help again before December 31? (Second reminder)', kind: 'fundraising' }),
      camp(2, 'Jo', { status: 'draft', sent_at: null, kind: 'volunteer' }), camp(3, '', { subject: '', status: 'draft', sent_at: null }), camp(4, 'Infolettre de novembre : bénévolat, Rallye Papier et la grande collecte des Fêtes')]
      .concat(huge ? range(1000, i => camp(100 + i, 'Weekly volunteer call-out ' + (i + 1), { created_at: '2025-0' + (1 + (i % 9)) + '-01T12:00:00Z' })) : [])
    : [camp(1, 'September news'), camp(2, 'Gala thank-you', { status: 'draft', sent_at: null, kind: 'fundraising' })];
  fx.crm_campaign_stats_v = (fx.crm_campaigns || []).map(c => ({ campaign_id: c.id, sent: worst ? 1284 : one ? 1 : 300, delivered: worst ? 1283 : 1, opened: one ? 1 : worst ? 1 : 120, clicked: one ? 0 : 12, bounced: 0, complained: 0, failed: 0 }));
  fx.wa_campaigns = empty ? [] : [{ id: 9, name: worst ? LONG.waCamp : 'Gala 2026', year: 2026, status: 'active' }];
  const fr = worst || huge;
  fx.crm_forms = empty ? [] : [{ id: 1, slug: 'benevoles-montreal', title: fr ? 'Inscription des bénévoles pour les repas du dimanche au Marché Jean-Talon' : 'Volunteer', status: 'published', kind: 'volunteer', lang: fr ? 'fr' : 'en',
    questions: [{ id: 'first_name', type: 'text', label: fr ? 'Prénom' : 'First name', required: true }, { id: 'email', type: 'email', label: fr ? 'Adresse courriel' : 'Email', required: true }],
    settings: { chapter: 'montreal', campaign_id: 9 }, consent: { ask: true, required: false, label: fr ? 'Envoyez-moi les nouvelles de Welfare Avenue par courriel. Je peux me désabonner en tout temps.' : 'Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time.',
      sms: { ask: true, label: fr ? 'Écrivez-moi par texto au sujet du bénévolat. Je peux répondre STOP en tout temps.' : 'Text me about volunteering. I can reply STOP at any time.' } }, created_at: '2026-09-28T12:00:00Z', updated_at: '2026-09-28T12:00:00Z' }];
  fx.crm_form_stats_v = []; fx.crm_fields = []; fx.crm_contact_fields = []; fx.crm_automation_runs = []; fx.crm_automations = [];
  fx.crm_import_runs = []; fx.crm_import_batches = [];
  fx.app_config = (fx.app_config || []).concat([{ key: 'mail_mode', value: 'test' }, { key: 'receipt_mode', value: 'on' }]);
  const W = { demo: [5002, 5001, 5003], worst: [6001, 6004, 6005], huge: [6001, 6004, 6005], one: [6001, 6004, 6005], empty: [6900, 6901, 6902] }[DATA];
  return { fx, dnc: W[0], plain: W[1], spam: W[2] };
}
const INVOKE = 'window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; if (name === "mail-send") return { data: { settings: { mail_mode: "test", mail_from_name: "Welfare Avenue", mail_from_email: "info@welfareavenue.com" }, admin: true, key_present: true, domain_id: "d1", last30: { sent: 0, tests: 0 } }, error: null }; if (name === "crm-import") return { data: b.action === "files" ? { files: [] } : {}, error: null }; return { data: null, error: null }; };';
const RPCS = (who) => ({ wa_org_editor: who === 'admin', crm_age_band: '18 or older', wa_my_caps: who === 'admin' ? { gifts_edit: true, import_admin: true, hr_private: true } : {},
  crm_receipt_config: { receipt_mode: 'on', receipt_auto_online: 'off', receipt_charity_name: 'Welfare Avenue', receipt_prefix: 'W283-', receipt_next_number: '2', receipt_signatory_name: 'Test Signatory', signature: false, missing: [], issued: 1, can_issue: who !== 'member', is_admin: who === 'admin' } });
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);
const spyRpc = f => f.ev(() => { window.__rpc = []; if (window.__rpcSpy) return; window.__rpcSpy = 1; const r0 = db.rpc.bind(db); db.rpc = function (fn, a) { window.__rpc.push({ fn, args: JSON.parse(JSON.stringify(a || {})) }); return r0(fn, a); }; });
const focusOf = f => f.ev(() => { const a = document.activeElement; if (!a || a === document.body) return 'body'; for (const at of a.attributes) if (/^data-w/.test(at.name)) return at.name; return a.tagName; });
/* nothing past the viewport, nothing spilling out of its box (text that overflows a visible box) */
function probe(f, root) {
  return f.ev((root) => {
    const R = document.querySelector(root) || document.body, iw = innerWidth, sw = document.documentElement.scrollWidth;
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const nm = e => (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase());
    const all = [...R.querySelectorAll('*')].filter(vis);
    const wide = all.filter(e => e.getBoundingClientRect().right > iw + 1 && !e.closest('.w152tabs')).map(e => nm(e) + '>' + Math.round(e.getBoundingClientRect().right));
    const spill = all.filter(e => { const cs = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 2 && cs.overflowX === 'visible' && cs.display !== 'inline' && e.tagName !== 'svg' && e.tagName !== 'SELECT' && !e.closest('.w152tabs'); }).map(e => nm(e) + ':' + e.scrollWidth + '/' + e.clientWidth);
    return { side: sw > iw + 1, wide: wide.slice(0, 5), spill: spill.slice(0, 5) };
  }, root);
}
async function fits(f, root, label) { const p = await probe(f, root); ok(label + ': nothing past the screen and nothing spills out of its box', !p.side && !p.wide.length && !p.spill.length, p); }
async function shot(f, name) { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await f.page.screenshot({ path: path.join(SHOTS, name + '.png') }); }
async function boot(browser, DATA, who, w, hash) {
  const X = fixture(DATA);
  const f = await fresh(browser, { who, width: ZOOM ? 683 : w, height: ZOOM ? 450 : undefined, hash: '#mypage', fixture: X.fx, rpcs: RPCS(who), init: INVOKE, wait: 3500 });
  await f.hash(hash, 2200); await f.page.mouse.move((ZOOM ? 683 : w) - 5, 300);
  return { f, X };
}

async function contact(browser, D, w) {
  const tag = D + ' ' + (ZOOM ? 'zoom200' : w);
  let { f, X } = await boot(browser, D, 'admin', w, '#crm');
  await f.hash('#crm/c/' + X.dnc, 1800);
  let b = await f.ev(() => { const s = document.getElementById('w152sheet'); const ban = s.querySelector('.w283dnc'), qa = s.querySelector('.w152qa'), sec = s.querySelector('.w152cols');
    return { reach: s.querySelectorAll('a[href^="mailto:"].w152btn,a[href^="tel:"],a[href^="sms:"],[data-w154send],.w152qa [data-w152copy]').length, banner: ban ? ban.innerText.replace(/\s+/g, ' ').trim() : null,
      gap: ban && sec ? Math.round(sec.getBoundingClientRect().right - ban.getBoundingClientRect().right) : null, perm: (s.querySelector('.w154perm') || {}).innerText || '', chip: (s.querySelector('.w152hd .w152pm') || {}).textContent || '' }; });
  const words = { 'worst': 'Do not contact: other', 'huge': 'Do not contact: other', 'one': 'Do not contact: deceased', 'demo': 'Do not contact: they asked' }[D];
  if (words) {
    ok(tag + ': a do-not-contact person has no Email, Call, Text, Copy or Send', b.reach === 0, b);
    ok(tag + ': the banner reads the picker\'s words and says no email, calls or texts', b.banner && b.banner.indexOf(words) === 0 && /No email, calls or texts\./.test(b.banner), b.banner);
    ok(tag + ': the banner runs the full width of the page (no 40px gap)', b.gap !== null && Math.abs(b.gap) <= 1, b.gap);
    ok(tag + ': the permission section says the one rule, do not contact first', /Newsletters, fundraising and volunteer emails: no \(do not contact\)/.test(b.perm) && /Receipts and confirmations: no \(do not contact/.test(b.perm), b.perm);
    ok(tag + ': no consent chip in the header (it is history now)', b.chip === '', b.chip);
  }
  await fits(f, '#w152sheet', tag + ' contact');
  await shot(f, 'contact-' + D + '-' + (ZOOM ? 'zoom200' : w));
  if (w < 700 && !ZOOM) {
    const small = await f.ev(() => [...document.querySelectorAll('#w152sheet .w152qa .w152btn,#w152sheet .w152sec h4 .w152mini,#w152sheet [data-w283dncclear]')].filter(e => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44).map(e => e.innerText.trim() + ':' + Math.round(e.getBoundingClientRect().height)));
    ok(tag + ': phone targets are 44px (quick actions, Edit, Change, Clear)', small.length === 0, small);
  }
  if (words) {
    /* clearing goes through at once, with a note, and the focus stays in the section */
    await spyRpc(f);
    await f.ev(() => { const b = document.querySelector('#w152sheet [data-w283dncclear]'); b.focus(); b.click(); }); await f.page.waitForTimeout(500);
    b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_set_do_not_contact'), banner: !!document.querySelector('#w152sheet .w283dnc'), note: (document.querySelector('#w152sheet [data-w283note]') || {}).textContent || '', confirm: !!document.querySelector('#w152sheet [data-w283cf]') }));
    ok(tag + ': Clear do not contact goes through without a question, and says Cleared', b.rpc.length === 1 && b.rpc[0].args.p_reason === null && !b.banner && !b.confirm && /^Cleared\. This did not resubscribe them\.$/.test(b.note), b);
    ok(tag + ': after clearing, the focus is on the reason picker (not lost)', (await focusOf(f)) === 'data-w283dncr');
  }
  /* setting it: the button waits for a reason, then asks, with Cancel focused; Yes sets it and the focus lands on Clear */
  await f.hash('#crm/c/' + X.plain, 1600);
  /* positive control: a contact who is not do not contact does show the ways to reach them, so the zero-reach checks above cannot pass by accident */
  const pc = X.fx.crm_contacts_v.filter(c => c.id === X.plain)[0];
  b = await f.ev(() => { const s = document.getElementById('w152sheet'); const n = q => s.querySelectorAll(q).length;
    return { mail: n('.w152qa a[href^="mailto:"]'), tel: n('.w152qa a[href^="tel:"]'), sms: n('.w152qa a[href^="sms:"]'), send: n('.w152qa [data-w154send]'), copy: n('.w152qa [data-w152copy]'), banner: n('.w283dnc') }; });
  const hasPhone = pc.phones.length > 0 && !pc.sms_opt_out;
  ok(tag + ': positive control: a contact who is not do not contact shows Email, Copy and Send' + (hasPhone ? ', Call and Text' : ''), b.mail === 1 && b.copy === 1 && b.send === 1 && b.banner === 0 && (!hasPhone || (b.tel === 1 && b.sms === 1)), b);
  b = await f.ev(() => ({ dis: (document.querySelector('#w152sheet [data-w283dnc]') || {}).disabled, desc: (document.querySelector('#w152sheet [data-w283dncr]') || { getAttribute: () => '' }).getAttribute('aria-describedby') }));
  ok(tag + ': Do not contact is disabled until a reason is picked, and the picker is described', b.dis === true && /w283dnch-/.test(b.desc || ''), b);
  await f.ev(() => { const s = document.querySelector('#w152sheet [data-w283dncr]'); s.focus(); s.value = 'asked'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  b = await f.ev(() => ({ dis: document.querySelector('#w152sheet [data-w283dnc]').disabled, focus: document.activeElement && document.activeElement.hasAttribute('data-w283dncr') }));
  ok(tag + ': picking a reason enables it in place, the focus stays on the picker', b.dis === false && b.focus, b);
  await spyRpc(f);
  await click(f, '#w152sheet [data-w283dnc]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => ({ cf: (document.querySelector('#w152sheet [data-w283cf]') || {}).innerText || '', rpc: window.__rpc.length }));
  ok(tag + ': setting it asks first, in Steel\'s words, and nothing is saved yet', /This unsubscribes them from everything\. Clearing it later will not resubscribe them\./.test(b.cf) && b.rpc === 0, b);
  ok(tag + ': the question focuses Cancel', (await focusOf(f)) === 'data-w283dncno');
  if (D === 'worst') await shot(f, 'contact-' + D + '-' + w + '-dncset');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(250);
  b = await f.ev(() => ({ open: document.getElementById('w152sheet').style.display !== 'none', cf: !!document.querySelector('#w152sheet [data-w283cf]') }));
  ok(tag + ': Escape steps out of the question, not out of the contact', b.open && !b.cf, b);
  await click(f, '#w152sheet [data-w283dnc]'); await f.page.waitForTimeout(250);
  await click(f, '#w152sheet [data-w283dncyes]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_set_do_not_contact'), banner: (document.querySelector('#w152sheet .w283dnc') || {}).innerText || '' }));
  ok(tag + ': Yes sets it (asked) and the banner says so', b.rpc.length === 1 && b.rpc[0].args.p_reason === 'asked' && /Do not contact: they asked/.test(b.banner), b);
  ok(tag + ': after setting, the focus is on Clear do not contact', (await focusOf(f)) === 'data-w283dncclear');
  /* a spam complaint: the box is disabled, and a Save with it ticked leaves complained */
  await f.hash('#crm/c/' + X.spam, 1600);
  await click(f, '#w152sheet [data-w152perm-edit="' + X.spam + '"]'); await f.page.waitForTimeout(400);
  b = await f.ev(async (id) => { const u = document.querySelector('#w152sheet [data-f="unsub"]'); const rows = []; const f0 = db.from;
    db.from = function (t) { const q = f0.apply(db, arguments); if (t === 'crm_contacts') { const u0 = q.update; q.update = function (p) { rows.push(JSON.parse(JSON.stringify(p))); return u0.call(this, p); }; } return q; };
    const st = { box: u.checked, dis: u.disabled, line: (document.querySelector('#w152sheet [data-w283spam]') || {}).textContent || '' };
    try { await window.w152.savePerm(String(id)); } finally { db.from = f0; }
    st.rows = rows; st.after = window.w152.state().contacts.filter(c => String(c.id) === String(id))[0].email_status; return st; }, X.spam);
  ok(tag + ': a spam complaint: "They unsubscribed" is ticked, disabled and says why', b.box && b.dis && /spam complaint cannot be cleared here/.test(b.line), b);
  ok(tag + ': a Save with the box ticked never touches the complaint', b.rows.length === 1 && !('email_status' in b.rows[0]) && b.after === 'complained', b);
  /* the edit form: job title capped, the chapter sentence */
  await f.hash('#crm/c/' + X.dnc, 1400);
  await click(f, '#w152sheet [data-w152edit="' + X.dnc + '"]'); await f.page.waitForTimeout(700);
  b = await f.ev(() => ({ max: (document.querySelector('#w152sheet [data-f="job_title"]') || { getAttribute: () => null }).getAttribute('maxlength'), ch: (document.querySelector('#w152sheet [data-w283chs]') || {}).innerText || '',
    font: getComputedStyle(document.querySelector('#w152sheet [data-f="full_name"]')).fontSize }));
  ok(tag + ': job title is capped at 120 and the chapters say "No chapter: counted as Montreal."', b.max === '120' && /No chapter: counted as Montreal\./.test(b.ch), b);
  if (w < 700 && !ZOOM) ok(tag + ': the edit form\'s fields are 16px on a phone', b.font === '16px', b.font);
  await fits(f, '#w152sheet', tag + ' edit form');
  ok(tag + ': contact: no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

async function gifts(browser, D, w) {
  const tag = D + ' ' + (ZOOM ? 'zoom200' : w);
  const { f } = await boot(browser, D, 'member', w, '#crm/gifts');
  const rows = await f.ev(() => [...document.querySelectorAll('#crm .w158row .amt b')].slice(0, 5).map(b => b.textContent));
  if (rows.length) ok(tag + ': gift amounts keep two decimals in the list', rows.every(r => /\.\d\d$/.test(r)), rows);
  if (D === 'worst') {
    const al = await f.ev(() => { const r = document.querySelector('#crm .w158row .amt'); return r ? getComputedStyle(r).textAlign + ' ' + getComputedStyle(r).fontVariantNumeric : ''; });
    ok(tag + ': amounts are right-aligned in tabular figures', /right/.test(al) && /tabular-nums/.test(al), al);
  }
  await fits(f, '#crm', tag + ' gifts');
  await shot(f, 'gifts-' + D + '-' + (ZOOM ? 'zoom200' : w));
  if (rows.length) {
    await click(f, '#crm .w158row'); await f.page.waitForTimeout(500);
    const g = await f.ev(() => { const s = document.getElementById('w152sheet'); const n = s.querySelector('[data-w283ro]'), kv = s.querySelector('[data-w158read]');
      return { inputs: s.querySelectorAll('input,select,textarea').length, noteTop: n && kv ? n.getBoundingClientRect().top < kv.getBoundingClientRect().top : false, save: !!s.querySelector('[data-w158save],[data-w158del]'), text: kv ? kv.innerText : '' }; });
    ok(tag + ': a member reads a gift as text: no field, the note on top, no save or delete', g.inputs === 0 && g.noteTop && !g.save && /Amount/.test(g.text), g);
    await fits(f, '#w152sheet', tag + ' read-only gift');
    if (D === 'worst') await shot(f, 'gifts-' + D + '-' + (ZOOM ? 'zoom200' : w) + '-gift');
    await click(f, '#w152sheet [data-w152close]'); await f.page.waitForTimeout(300);
  }
  await f.hash('#crm/gifts/receipts', 2200);
  const t = await f.ev(() => [...document.querySelectorAll('#crm .w158due .w152st b')].map(b => ({ t: b.textContent, cut: b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > b.parentElement.getBoundingClientRect().right + 1 })));
  ok(tag + ': the receipts-due tiles hold their amounts', t.length === 3 && t.every(x => !x.cut), t);
  await fits(f, '#crm', tag + ' receipts');
  if (D === 'worst') await shot(f, 'gifts-' + D + '-' + (ZOOM ? 'zoom200' : w) + '-receipts');
  ok(tag + ': gifts: no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

async function sends(browser, D, w) {
  const tag = D + ' ' + (ZOOM ? 'zoom200' : w);
  const { f } = await boot(browser, D, 'admin', w, '#crm/campaigns');
  const b = await f.ev(() => ({ head: (document.querySelector('#crm .w154card h3 .m') || {}).textContent || '', rows: [...document.querySelectorAll('#crm .w155cr')].slice(0, 4).map(r => r.innerText.replace(/\s+/g, ' ')),
    results: [...document.querySelectorAll('#crm .w155cr .w155n')].slice(0, 3).map(x => x.getBoundingClientRect().height > 0), more: !!document.querySelector('#crm [data-w155cmore]') }));
  if (D === 'huge') ok(tag + ': the Sends list says Latest 300 of 1,004 and offers Show more', b.head === 'Latest 300 of 1,004' && b.more, b);
  if (D === 'worst') {
    ok(tag + ': an unnamed Send reads "Untitled Send"', b.rows.some(r => /Untitled Send/.test(r)), b.rows);
    ok(tag + ': 1 open of 1,284 reads <1%, not 0%', b.rows.some(r => /<1% opened · <1% clicked/.test(r)), b.rows);
  }
  if (b.results.length) ok(tag + ': each Send shows its results at this width', b.results.every(Boolean), b.results);
  await fits(f, '#crm', tag + ' sends');
  await shot(f, 'sends-' + D + '-' + (ZOOM ? 'zoom200' : w));
  if (D === 'worst' || D === 'demo') {
    await f.hash('#crm/campaigns/new', 2000);
    const lines = [];
    for (const n of [1, 214]) lines.push(await f.ev((n) => { const L = window.w155.lc(); L.check = { audience: n + 10, eligible: n + 9, held: 1, why: { unsubscribed: 1 }, first_contacts: n, mode: 'test' }; window.w152.paint(); return (document.querySelector('#crm [data-w283first]') || {}).textContent || ''; }, n));
    ok(tag + ': the first-contact line says what happens, in the singular and the plural', lines[0] === '1 person would get their first email from Welfare Avenue in this Send' && lines[1] === '214 people would get their first email from Welfare Avenue in this Send', lines);
    await fits(f, '#crm', tag + ' composer');
  }
  ok(tag + ': sends: no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

async function forms(browser, D, w) {
  if (D === 'empty') return;
  const tag = D + ' ' + (ZOOM ? 'zoom200' : w);
  const { f } = await boot(browser, D, 'admin', w, '#crm/forms/1');
  await f.page.waitForTimeout(600);
  let b = await f.ev(() => ({ h4: [...document.querySelectorAll('#crm .w156h4')].map(h => h.textContent), lang: (document.querySelector('#crm [data-w156k="lang"]') || {}).value }));
  ok(tag + ': the form editor\'s heading is "Permission to contact"', b.h4.indexOf('Permission to contact') >= 0 && b.h4.indexOf('Email permission') < 0, b.h4);
  const lang0 = b.lang;
  await f.ev(() => { const s = document.querySelector('#crm [data-w288set="chapter"]'); s.focus(); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }); await f.page.waitForTimeout(300);
  b = await f.ev(() => { const s = document.querySelector('#crm [data-w288set="chapter"]'); const p = s && s.closest('.w155two') && s.closest('.w155two').nextElementSibling; return { help: p ? p.textContent : '', focus: !!(document.activeElement && document.activeElement.getAttribute('data-w288set') === 'chapter') }; });
  ok(tag + ': no chapter says "No chapter: counted as Montreal." and the focus stays on the picker', b.help === 'No chapter: counted as Montreal.' && b.focus, b);
  /* the language switch: the text box's words at the other default follow; the email box's own words stay, with a warning */
  const to = lang0 === 'fr' ? 'en' : 'fr';
  await f.ev((to) => { const s = document.querySelector('#crm [data-w156k="lang"]'); s.value = to; s.dispatchEvent(new Event('change', { bubbles: true })); }, to); await f.page.waitForTimeout(300);
  b = await f.ev(() => ({ sms: (document.querySelector('#crm [data-w288sms="label"]') || {}).value, email: (document.querySelector('#crm [data-w156c="label"]') || {}).value, warn: [...document.querySelectorAll('#crm [data-w156langwarn]')].map(x => x.getAttribute('data-w156langwarn') + ':' + x.textContent), focus: !!(document.activeElement && document.activeElement.getAttribute('data-w156k') === 'lang') }));
  if (to === 'en') ok(tag + ': switching to English swaps the text box\'s French words and warns about the email box\'s own French words', b.sms === 'Text me about volunteering. I can reply STOP at any time.' && b.warn.length === 1 && /^email:These words were written for the French form/.test(b.warn[0]) && b.focus, b);
  else ok(tag + ': switching to French swaps both default wordings to French', /^Oui, Welfare Avenue peut m’envoyer/.test(b.email || '') && /^Écrivez-moi par texto/.test(b.sms || '') && b.warn.length === 0 && b.focus, b);
  await fits(f, '#crm', tag + ' form editor');
  if (D === 'worst') await shot(f, 'forms-' + D + '-' + (ZOOM ? 'zoom200' : w));
  ok(tag + ': forms: no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

async function email(browser, D, w) {
  const tag = D + ' ' + (ZOOM ? 'zoom200' : w);
  const { f } = await boot(browser, D, 'admin', w, '#crm/email');
  await f.ev(() => { const m = window.w152.mail; m.st = { settings: { mail_mode: 'test', mail_from_name: 'Welfare Avenue', mail_from_email: 'info@welfareavenue.com' }, admin: true, key_present: true, domain_id: 'd1', last30: { sent: 0, tests: 0 } }; m.err = ''; m.busy = ''; window.w152.paint(); });
  const b = await f.ev(() => ({ why: (document.querySelector('#crm [data-w154refwhy]') || {}).textContent || '', tile: [...document.querySelectorAll('#crm .w154stats .w152st span')].map(s => s.textContent).join(' | '), measure: getComputedStyle(document.querySelector('#crm .w154rule p')).maxWidth }));
  ok(tag + ': Refresh implied consent says why it stays', b.why === 'Refresh implied consent keeps the reason on each record up to date. It doesn’t change who gets email.', b.why);
  ok(tag + ': the permission numbers no longer say "confirmations only", and the rule has a 70ch measure', !/confirmations only/.test(b.tile) && b.measure !== 'none', b);
  await fits(f, '#crm', tag + ' email settings');
  ok(tag + ': email: no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

async function launcher(browser, D, w) {
  const tag = D + ' ' + (ZOOM ? 'zoom200' : w);
  const { f } = await boot(browser, D, 'admin', w, '#crm/settings/imports');
  const b = await f.ev(() => ({ stats: !!document.querySelector('#crm .w152stats'), root: !!document.getElementById('w284root') }));
  ok(tag + ': the Import page has no CRM stats strip', b.root && !b.stats, b);
  await f.hash('#crm', 1600);
  const s = await f.ev(() => [...document.querySelectorAll('#crm .w152st')].map(x => x.innerText.replace(/\s+/g, ' ')));
  ok(tag + ': the CRM tiles say "1 volunteer", never "1 volunteers"', !s.some(x => /^1 (volunteers|donors|contacts|have)/.test(x)), s);
  ok(tag + ': launcher: no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

(async () => {
  const browser = await launch();
  if (ZOOM) { const nc = browser.newContext.bind(browser); browser.newContext = o => nc(Object.assign({}, o, { isMobile: false, hasTouch: false, deviceScaleFactor: 2 })); }
  const jobs = (process.env.JOBS || 'contact,gifts,sends,forms,email,launcher').split(',');
  const J = { contact, gifts, sends, forms, email, launcher };
  for (const D of SETS) for (const w of (ZOOM ? [683] : WIDTHS)) for (const j of jobs) {
    try { await J[j](browser, D, w); } catch (e) { fail++; out.push('FAIL ' + D + ' ' + w + ' ' + j + ' crashed: ' + String(e && e.stack || e).slice(0, 400)); }
  }
  await browser.close();
  console.log(out.join('\n'));
  console.log('\ncrm1ui_crm_worst: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
