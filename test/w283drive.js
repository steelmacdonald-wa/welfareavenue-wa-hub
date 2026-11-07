/* w283drive.js: the CRM page and gift rights (wave283, CRM slice 1 Phase 3). Fixture rows are made up for the test (no real people); the stub
   echoes writes and never changes the fixture, and a test can make one table's writes answer its own way (window.__WA_TABLE_RESULTS).
   - The CRM rail says Sends; the Sends page says Sends; the composer shows the first-contact count.
   - Gift controls follow gifts_edit (wa_my_caps): hidden for a member (a gift opens read-only, no save or delete), shown for a team lead,
     with Delete; a 0-row update or delete shows "Only team leads, admins and finance can change gifts." in the row.
   - Receipts follow can_issue, Email it too (final review M5, mail-send v7); a do-not-contact donor's receipt row says "Receipt not emailed: do not contact".
   - A contact: the do-not-contact banner and control (set with a reason; clearing asks and says it does not resubscribe), the job title,
     the age band, the postal code once; the edit form's job title and chapter toggles; the birth date only with hr_private.
   - Email settings: the fundraising switch is gone and the one rule is written out. Leaving Keela counts published forms. Sources name
     every source. Marketing's Your apps has the CRM. No page errors; at phone width nothing scrolls sideways.
   usage: node test/w283drive.js */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
const REFUSED = 'Only team leads, admins and finance can change gifts.';
const RULE = 'Newsletters, fundraising and volunteer emails go to everyone with a working address who has not unsubscribed. Receipts and confirmations go to any working address.';
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['supporter'], tags: [], source: 'keela', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'wa150_backfill', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [], job_title: null, do_not_contact: false, dnc_reason: null }, o || {});
}
const G = (id, contact_id, amount, date, o) => Object.assign({ id, contact_id, amount, currency: 'CAD', donated_at: date + 'T15:00:00Z', platform: 'hub', campaign: null, designation: null, recurring: false, receipt_number: null, receipt_issued_at: null, receipt_url: null,
  receipt_source: null, receipt_eligible: true, external_id: null, notes: null, kind: 'donation', method: 'cheque', advantage_amount: 0, advantage_desc: null, in_kind_desc: null, appraiser: null, tribute_kind: null, tribute_name: null, created_by: 'steel.macdonald@welfareavenue.com', updated_by: null }, o || {});
function fixture() {
  const fx = loadFixture();
  fx.crm_contacts_v = [
    C(5001, 'Amara Testdonor', { emails: ['amara.test@example.com'], primary_email: 'amara.test@example.com', kinds: ['donor'], address: '12 rue Test, Montreal QC H2X 1Y4', city: 'Montreal', province: 'QC', postal_code: 'H2X 1Y4', job_title: 'Chef' }),
    C(5002, 'Bea Testasked', { emails: ['bea.test@example.com'], primary_email: 'bea.test@example.com', email_status: 'unsubscribed', sms_opt_out: true, do_not_contact: true, dnc_reason: 'asked', address: '5 av Test', postal_code: 'H3N 2H9' }),
    C(5003, 'Cal Testvolunteer', { emails: ['cal.test@example.com'], primary_email: 'cal.test@example.com', kinds: ['volunteer'], source: 'cabm' })
  ];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = [];
  fx.crm_donations = [G(61, 5001, 100, '2026-09-20', { campaign: 'Sunday meals' }), G(62, 5002, 40, '2026-09-10'), G(63, 5001, 156.75, '2026-08-10', { platform: 'keela', method: null })];
  fx.crm_gift_receipts_v = [
    { gift_id: 61, contact_id: 5001, amount: 100, advantage_amount: 0, eligible_amount: 100, tax_year: 2026, kind: 'donation', platform: 'hub', receipt_number: null, receipt_status: 'due', receipt_note: 'A receipt is due for $100.00' },
    { gift_id: 62, contact_id: 5002, amount: 40, advantage_amount: 0, eligible_amount: 40, tax_year: 2026, kind: 'donation', platform: 'hub', receipt_number: 'W283-0001', receipt_status: 'receipted', receipt_note: 'Receipt W283-0001' }
  ];
  fx.crm_receipts = [{ id: 71, serial: 'W283-0001', contact_id: 5002, tax_year: 2026, kind: 'single', status: 'issued', gift_ids: [62], amount: 40, advantage_amount: 0, eligible_amount: 40, donor: { name: 'Bea Testasked' }, issued_at: '2026-09-11T15:00:00Z', issued_by: 'test', pdf_path: '2026/W283-0001.pdf', emailed_at: null }];
  fx.crm_chapters = [{ code: 'montreal', name_en: 'Montreal', active: true, sort: 1 }, { code: 'toronto', name_en: 'Toronto', active: true, sort: 2 }];
  fx.crm_contact_chapters = [{ contact_id: 5001, chapter: 'toronto', source: 'evidence' }];
  fx.crm_contact_private = [{ contact_id: 5001, birth_date: '1990-04-02' }];
  fx.crm_forms = [{ id: 1, slug: 'volunteer', title: 'Volunteer', status: 'published', questions: [], created_at: '2026-09-28T12:00:00Z' },
                  { id: 2, slug: 'toronto', title: 'Toronto', status: 'published', questions: [], created_at: '2026-09-28T12:00:00Z' },
                  { id: 3, slug: 'old', title: 'Old', status: 'closed', questions: [], created_at: '2026-09-28T12:00:00Z' }];
  fx.crm_automation_runs = []; fx.crm_automations = []; fx.crm_contact_fields = []; fx.crm_fields = [];
  fx.app_config = (fx.app_config || []).concat([{ key: 'mail_mode', value: 'test' }, { key: 'receipt_mode', value: 'on' }]);
  return fx;
}
const CFG = (o) => Object.assign({ receipt_mode: 'on', receipt_auto_online: 'off', receipt_charity_name: 'Welfare Avenue', receipt_prefix: 'W283-', receipt_next_number: '2', receipt_signatory_name: 'Test Signatory', signature: false, missing: [], issued: 1 }, o);
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);
const recordRpc = f => f.ev(() => { window.__rpc = []; const r0 = db.rpc.bind(db); db.rpc = function (fn, a) { window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(a || {})) }); return r0(fn, a); }; return true; });
const text = (f, s) => f.ev(x => { const el = document.querySelector(x); return el ? el.innerText.replace(/\s+/g, ' ').trim() : null; }, s);
const RPCS = (who, caps, cfg) => Object.assign({ wa_org_editor: who === 'admin', crm_age_band: '18 or older', crm_receipt_config: CFG(cfg) }, caps ? { wa_my_caps: caps } : {});

(async () => {
  const browser = await launch();

  /* ---------------- a member (no capabilities) ---------------- */
  let f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(), rpcs: RPCS('member', null, { can_issue: false, is_admin: false }), wait: 4000 });
  await f.hash('#crm', 2600);
  let b = await f.ev(() => ({ caps: window.w152 && window.w152.caps && window.w152.caps(), can: window.w152 && window.w152.can && window.w152.can('gifts_edit'),
    rail: [...document.querySelectorAll('#w153rail [data-w153go]')].map(a => a.innerText.replace(/\s+/g, ' ').trim()) }));
  ok('member: the capabilities load first, and a member has none (wa_my_caps {})', b.caps && typeof b.caps === 'object' && Object.keys(b.caps).length === 0 && b.can === false, b);
  ok('the CRM rail says Sends, not Campaigns', b.rail.indexOf('Sends') >= 0 && b.rail.indexOf('Campaigns') < 0, b.rail);
  await f.hash('#crm/gifts', 2000);
  b = await f.ev(() => ({ rec: !!document.querySelector('#crm [data-w158new="1"]'), rcpt: !!document.querySelector('#crm [data-w152go="#crm/gifts/receipts"]') }));
  ok('member: the Gifts tab has no Record a gift (Receipts stays)', !b.rec && b.rcpt, b);
  await click(f, '#crm [data-w158open="61"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => { const s = document.getElementById('w152sheet'); return { open: !!s && s.style.display !== 'none', save: !!s.querySelector('[data-w158save]'), del: !!s.querySelector('[data-w158del]'),
    enabled: [...s.querySelectorAll('.w152form input,.w152form select,.w152form textarea')].filter(x => !x.disabled).length, note: (s.querySelector('[data-w283ro]') || {}).textContent || '' }; });
  ok('member: a gift opens read-only, with no save or delete control', b.open && !b.save && !b.del && b.enabled === 0 && b.note.indexOf(REFUSED) === 0, b);
  await click(f, '#w152sheet [data-w152close]'); await f.page.waitForTimeout(300);
  await f.hash('#crm/c/5001', 2000);
  b = await f.ev(() => ({ rec: !!document.querySelector('#w152sheet [data-w158new]'), details: (document.querySelector('#w152sheet .w152kv') || {}).innerText || '' }));
  ok('member: a contact has no Record a gift', !b.rec, b);
  ok('the contact details show the job title and the age band (crm_age_band), never a date', /Job title\s*Chef/.test(b.details) && /Age\s*18 or older/.test(b.details) && !/1990/.test(b.details), b.details);
  ok('the postal code is left out when the address already holds it', (b.details.match(/H2X 1Y4/g) || []).length === 1, b.details);
  await click(f, '#w152sheet [data-w152edit="5001"]'); await f.page.waitForTimeout(600);
  b = await f.ev(() => ({ job: (document.querySelector('#w152sheet [data-f="job_title"]') || {}).value, chs: [...document.querySelectorAll('#w152sheet [data-w283ch]')].map(x => x.getAttribute('data-w283ch') + ':' + x.checked),
    birth: !!document.querySelector('#w152sheet [data-f="birth_date"]') }));
  ok('member: the edit form has the job title and one toggle per active chapter (Toronto on)', b.job === 'Chef' && b.chs.join(',') === 'montreal:false,toronto:true', b);
  ok('member: the birth date field is hidden without hr_private', b.birth === false, b);
  ok('member: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- a team lead (gifts_edit) ---------------- */
  f = await fresh(browser, { who: 'leader', hash: '#mypage', fixture: fixture(), rpcs: RPCS('leader', null, { can_issue: true, is_admin: false }), wait: 4000 });
  await f.hash('#crm/gifts', 2600);
  b = await f.ev(() => ({ can: window.w152.can('gifts_edit'), hr: window.w152.can('hr_private'), rec: !!document.querySelector('#crm [data-w158new="1"]') }));
  ok('team lead: gifts_edit (and not hr_private), and the Gifts tab offers Record a gift', b.can === true && b.hr === false && b.rec, b);
  await click(f, '#crm [data-w158open="61"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ save: !!document.querySelector('#w152sheet [data-w158save]'), del: !!document.querySelector('#w152sheet [data-w158del]') }));
  ok('team lead: a Hub gift opens with Save and Delete (the delete policy is gifts_edit)', b.save && b.del, b);
  /* the database answers the update with 0 rows (row security): the message shows in the row */
  await f.ev(() => { window.__WA_TABLE_RESULTS = { 'crm_donations:update': { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } } }; });
  await click(f, '#w152sheet [data-w158save]'); await f.page.waitForTimeout(500);
  b = await text(f, '#w152sheet [data-w152err]');
  ok('a 0-row update shows "Only team leads, admins and finance can change gifts." in the row', b === REFUSED, b);
  await f.ev(() => { window.__WA_TABLE_RESULTS = { 'crm_donations:update': { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } } }; });
  await click(f, '#w152sheet [data-w158save]'); await f.page.waitForTimeout(500);
  ok('a refused write (42501) shows the same message', (await text(f, '#w152sheet [data-w152err]')) === REFUSED);
  await f.ev(() => { window.__WA_TABLE_RESULTS = { 'crm_donations:delete': { data: [], error: null } }; });
  await click(f, '#w152sheet [data-w158del]'); await f.page.waitForTimeout(200); await click(f, '#w152sheet [data-w158del]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ err: (document.querySelector('#w152sheet [data-w152err]') || {}).textContent, open: document.getElementById('w152sheet').style.display !== 'none' }));
  ok('a 0-row delete shows the same message and keeps the gift open', b.err === REFUSED && b.open, b);
  await f.ev(() => { window.__WA_TABLE_RESULTS = {}; });
  await click(f, '#w152sheet [data-w152close]'); await f.page.waitForTimeout(300);
  /* receipts: Issue, Replace, Cancel and Email it follow can_issue (final review M5: mail-send v7 allows gifts_edit) */
  await f.hash('#crm/gifts/receipts', 2400);
  b = await f.ev(() => ({ issue: !!document.querySelector('#crm [data-w158bissue]'), run: !!document.querySelector('#crm [data-w158brun]'), replace: !!document.querySelector('#crm [data-w158bdo="replace"]'),
    cancel: !!document.querySelector('#crm [data-w158bdo="cancel"]'), mail: !!document.querySelector('#crm [data-w185mail]'), mode: !!document.querySelector('#crm [data-w158bmode],#crm [data-w158bask]'),
    save: !!document.querySelector('#crm [data-w158cfgsave]'), words: (document.querySelector('#crm .w158bmode') || {}).innerText || '' }));
  ok('team lead (can_issue): Issue, the year-end run, Replace and Cancel', b.issue && b.run && b.replace && b.cancel, b);
  ok('team lead (can_issue): Email it is there (final review M5)', b.mail, b);
  ok('team lead (not admin): no receipts switch, no settings save', !b.mode && !b.save, b);
  ok('the receipts line names who issues them', /Team leads, admins and finance issue, replace and cancel them/.test(b.words), b.words);
  ok('team lead: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- the admin (all three capabilities) ---------------- */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), rpcs: RPCS('admin', null, { can_issue: true, is_admin: true }), wait: 4000,
    init: 'window.__WA_INVOKE = function (name, opts) { (window.__inv = window.__inv || []).push({ name: name, body: opts && opts.body }); if (name === "mail-send" && opts && opts.body && opts.body.action === "receipt") return { data: { status: "suppressed", basis: "do not contact", serial: "W283-0001" }, error: null }; if (name === "mail-send") return { data: { settings: { mail_mode: "test", mail_from_name: "Welfare Avenue", mail_from_email: "info@welfareavenue.com" }, admin: true, key_present: true, domain_id: "d1", last30: { sent: 0, tests: 0 } }, error: null }; return { data: {}, error: null }; };' });
  await f.hash('#crm/gifts/receipts', 2600);
  b = await f.ev(() => ({ caps: window.w152.caps(), mail: !!document.querySelector('#crm [data-w185mail="71"]') }));
  ok('admin: wa_my_caps gives all three', b.caps && b.caps.gifts_edit === true && b.caps.import_admin === true && b.caps.hr_private === true, b.caps);
  ok('admin: Email it is there', b.mail, b);
  await click(f, '#crm [data-w185mail="71"]'); await f.page.waitForTimeout(700);
  b = await f.ev(() => { const r = document.querySelector('#crm [data-w185mail="71"]'); const row = r && r.closest('.w158brow'); return { row: row ? row.innerText.replace(/\s+/g, ' ') : '', err: (document.querySelector('#crm .w152err') || {}).textContent || '' }; });
  ok('mail-send answers do not contact: the row says "Receipt not emailed: do not contact"', /Receipt not emailed: do not contact/.test(b.row), b);
  /* the do-not-contact banner, and the control */
  await recordRpc(f);
  await f.hash('#crm/c/5002', 2000);
  b = await f.ev(() => ({ banner: (document.querySelector('#w152sheet .w283dnc') || {}).innerText || '', ask: !!document.querySelector('#w152sheet [data-w283dncclear]') }));
  ok('a do-not-contact contact shows "Do not contact: they asked" under their name (the picker\'s words, task 10b), with a way to clear it', /Do not contact: they asked/.test(b.banner) && b.ask, b);
  /* final review I1: while do not contact is on, the Email permission form shows the email and text boxes disabled, says why, and has no Save */
  await click(f, '#w152sheet [data-w152perm-edit="5002"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => { const q = (s) => document.querySelector('#w152sheet ' + s) || {}; return { unsub: [q('[data-f="unsub"]').disabled, q('[data-f="unsub"]').checked], sms: [q('[data-f="sms_opt_out"]').disabled, q('[data-f="sms_opt_out"]').checked],
    perm: q('[data-f="email_consent"]').disabled, line: (q('[data-w281dnc]').textContent || ''), save: !!document.querySelector('#w152sheet [data-w152savep]') }; });
  ok('do not contact: the email and text boxes show (ticked) but disabled, with "Do not contact is on. Clear it first to change these."',
    b.unsub[0] === true && b.unsub[1] === true && b.sms[0] === true && b.sms[1] === true && b.line === 'Do not contact is on. Clear it first to change these.', b);
  ok('do not contact: the rest of the form is read-only too, and there is no Save', b.perm === true && !b.save, b);
  b = await f.ev(async () => { let n = 0; const f0 = db.from; db.from = function (t) { if (t === 'crm_contacts') n++; return f0.apply(db, arguments); };
    try { await window.w152.savePerm('5002'); } finally { db.from = f0; }
    return { err: (document.querySelector('#w152sheet [data-w152err]') || {}).textContent || '', calls: n }; });
  ok('a save forced anyway writes nothing and says why', b.err === 'Do not contact is on. Clear it first to change these.' && b.calls === 0, b);
  await click(f, '#w152sheet [data-w152back="5002"]'); await f.page.waitForTimeout(400);
  /* task 10b (Steel's decision 3): clearing goes through at once, with a short note; it never resubscribes */
  await click(f, '#w152sheet [data-w283dncclear]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ rpc: (window.__rpc || []).filter(x => x.fn === 'crm_set_do_not_contact'), banner: !!document.querySelector('#w152sheet .w283dnc'), perm: window.w152.state().contacts.filter(c => c.id === 5002)[0].email_status,
    note: (document.querySelector('#w152sheet [data-w283note]') || {}).textContent || '' }));
  ok('clearing calls crm_set_do_not_contact with no reason at once, the banner goes, they stay unsubscribed, and a note says so', b.rpc.length === 1 && b.rpc[0].args.p_contact === 5002 && b.rpc[0].args.p_reason === null && !b.banner && b.perm === 'unsubscribed' && b.note === 'Cleared. This did not resubscribe them.', b);
  await f.hash('#crm/c/5003', 2000);
  ok('setting it: Do not contact waits for a reason (disabled until one is picked)', (await f.ev(() => document.querySelector('#w152sheet [data-w283dnc]').disabled)) === true);
  await setv(f, '#w152sheet [data-w283dncr]', 'deceased');
  await click(f, '#w152sheet [data-w283dnc]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => ({ cf: (document.querySelector('#w152sheet [data-w283cf]') || {}).innerText || '', rpc: (window.__rpc || []).filter(x => x.fn === 'crm_set_do_not_contact').length }));
  ok('setting it asks first ("This unsubscribes them from everything. Clearing it later will not resubscribe them.") and saves nothing yet', /Set do not contact for Cal Testvolunteer\?/.test(b.cf) && /This unsubscribes them from everything\. Clearing it later will not resubscribe them\./.test(b.cf) && b.rpc === 1, b);
  await click(f, '#w152sheet [data-w283dncyes]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ rpc: (window.__rpc || []).filter(x => x.fn === 'crm_set_do_not_contact'), banner: (document.querySelector('#w152sheet .w283dnc') || {}).innerText || '',
    writes: (window.__WAFIX.crm_contacts || []).length }));
  ok('Yes calls crm_set_do_not_contact (deceased) and shows the banner', b.rpc.length === 2 && b.rpc[1].args.p_contact === 5003 && b.rpc[1].args.p_reason === 'deceased' && /Do not contact: deceased/.test(b.banner), b);
  /* the edit form: the birth date with hr_private, read from crm_contact_private */
  await f.hash('#crm/c/5001', 2000);
  await click(f, '#w152sheet [data-w152edit="5001"]'); await f.page.waitForTimeout(700);
  b = await f.ev(() => ({ birth: (document.querySelector('#w152sheet [data-f="birth_date"]') || {}).value, dis: (document.querySelector('#w152sheet [data-f="birth_date"]') || {}).disabled }));
  ok('admin (hr_private): the edit form has the birth date', b.birth === '1990-04-02' && b.dis === false, b);
  /* the edit form writes chapters through crm_contact_chapters (source hand) and the job title on the contact */
  await f.ev(() => { window.__w = []; const f0 = db.from.bind(db); db.from = function (t) { const q = f0(t), i0 = q.insert, u0 = q.update, d0 = q.delete, s0 = q.upsert;
    q.insert = function (p) { window.__w.push({ t: t, op: 'insert', p: JSON.parse(JSON.stringify(p)) }); return i0.call(this, p); };
    q.update = function (p) { window.__w.push({ t: t, op: 'update', p: JSON.parse(JSON.stringify(p)) }); return u0.call(this, p); };
    q.upsert = function (p) { window.__w.push({ t: t, op: 'upsert', p: JSON.parse(JSON.stringify(p)) }); return s0.call(this, p); };
    q.delete = function () { window.__w.push({ t: t, op: 'delete' }); return d0.call(this); }; return q; }; });
  await setv(f, '#w152sheet [data-f="job_title"]', 'Head chef');
  await f.ev(() => { document.querySelector('#w152sheet [data-w283ch="montreal"]').checked = true; document.querySelector('#w152sheet [data-w283ch="toronto"]').checked = false; });
  await setv(f, '#w152sheet [data-f="birth_date"]', '1990-04-03');
  await click(f, '#w152sheet [data-w152save="5001"]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => window.__w);
  const up = b.filter(x => x.t === 'crm_contacts' && x.op === 'update')[0] || {};
  ok('saving: the job title goes on the contact, never do_not_contact', up.p && up.p.job_title === 'Head chef' && !('do_not_contact' in up.p), up);
  ok('saving: Montreal added (source hand) and Toronto removed in crm_contact_chapters', b.some(x => x.t === 'crm_contact_chapters' && x.op === 'insert' && x.p.chapter === 'montreal' && x.p.source === 'hand' && x.p.contact_id === 5001) &&
    b.some(x => x.t === 'crm_contact_chapters' && x.op === 'delete'), b);
  ok('saving: the birth date goes to crm_contact_private, and the audit line never carries the date', b.some(x => x.t === 'crm_contact_private' && x.op === 'upsert' && x.p.birth_date === '1990-04-03') &&
    !b.some(x => x.t === 'change_log' && JSON.stringify(x.p).indexOf('1990') >= 0), b.filter(x => x.t === 'change_log' || x.t === 'crm_contact_private'));
  /* email settings: no fundraising switch; the one rule */
  await f.hash('#crm/email', 2600);
  await f.ev(() => { const m = window.w152.mail; m.st = { settings: { mail_mode: 'test', mail_from_name: 'Welfare Avenue', mail_from_email: 'info@welfareavenue.com' }, admin: true, key_present: true, domain_id: 'd1', last30: { sent: 0, tests: 0 } }; m.err = ''; m.busy = ''; window.w152.paint(); });
  b = await f.ev(() => ({ rule: (document.querySelector('#crm .w154rule') || {}).innerText || '' }));
  ok('the email rule card says the one rule', b.rule.indexOf(RULE) >= 0 && !/express consent/i.test(b.rule), b.rule);
  await click(f, '#crm [data-w154cfg]'); await f.page.waitForTimeout(400);
  b = await f.ev(() => ({ form: [...document.querySelectorAll('#crm [data-f]')].map(x => x.getAttribute('data-f')) }));
  ok('Change the settings has no fundraising switch', b.form.length > 0 && b.form.indexOf('mail_fundraising_exemption') < 0, b.form);
  /* Sends: the composer's kind help and the first-contact count */
  await f.hash('#crm/campaigns/new', 2600);
  b = await f.ev(() => { const L = window.w155.lc(); L.check = { audience: 300, eligible: 290, held: 10, why: { unsubscribed: 10 }, first_contacts: 214, mode: 'test' }; window.w152.paint();
    return { first: (document.querySelector('#crm [data-w283first]') || {}).textContent || '', head: (document.querySelector('#crm .w154card h3') || {}).innerText || '', kind: [...document.querySelectorAll('#crm .w155lb .m')].map(x => x.textContent) }; });
  ok('the composer says New Send and the kind help line is the rule', /New Send/i.test(b.head) && b.kind.indexOf(RULE) >= 0, b);
  ok('the composer shows the first-contact count, saying what happens (task 10b, Steel\'s decision 6)', b.first === '214 people would get their first email from Welfare Avenue in this Send', b.first);
  await f.ev(() => { window.w155.lc().check = { audience: 5, eligible: 5, first_contacts: 0, mode: 'test' }; window.w152.paint(); });
  ok('and nothing when there are none', !(await f.ev(() => !!document.querySelector('#crm [data-w283first]'))));
  /* Sources and Leaving Keela */
  await f.hash('#crm/sources', 3000);
  b = await f.ev(() => ({ keela: [...document.querySelectorAll('#crm .w159kr')].map(r => r.innerText.replace(/\s+/g, ' ')), src: (document.querySelector('#crm .w152grid2') || {}).innerText || '' }));
  ok('Leaving Keela counts published forms (2 of 3)', /2 forms are live of 3 in the Hub/.test(b.keela[1] || ''), b.keela[1]);
  ok('Sources names CABM, and the gifts row says Keela', /CABM/.test(b.src) && /Gifts and tax receipts from Keela/.test(b.src) && /Sends follow one rule/.test(b.src), b.src.slice(0, 600));
  ok('admin: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- Marketing's Your apps has the CRM ---------------- */
  f = await fresh(browser, { who: 'plain', hash: '#mypage', fixture: fixture(), wait: 4000 });
  b = await f.ev(() => { if (window.w153 && window.w153.pop) window.w153.pop(); const t = document.querySelector('#w153pop .w153tiles'); return t ? [...t.querySelectorAll('[data-w153app]')].map(x => x.getAttribute('data-w153app')) : null; });
  ok('a Marketing member: Your apps has the Studio and the CRM', b && b.indexOf('studio') >= 0 && b.indexOf('crm') >= 0, b);
  ok('marketing: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- final review M4: unticking "They unsubscribed" clears an unsubscribe, never a spam complaint ---------------- */
  {
    const fx = fixture(); fx.crm_contacts_v[2].email_status = 'complained'; fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
    f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fx, rpcs: RPCS('admin', null, { can_issue: true, is_admin: true }), wait: 4000 });
  }
  await f.hash('#crm/c/5003', 2000);
  await click(f, '#w152sheet [data-w152perm-edit="5003"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ box: (document.querySelector('#w152sheet [data-f="unsub"]') || {}).checked, dis: (document.querySelector('#w152sheet [data-f="unsub"]') || {}).disabled, line: (document.querySelector('#w152sheet [data-w283spam]') || {}).textContent || '' }));
  ok('a spam complaint: the box is ticked and disabled (task 10b), with a line that says why it stays', b.box === true && b.dis === true && b.line === 'They marked one of our emails as spam, so this stays ticked: a spam complaint cannot be cleared here.', b);
  /* final review M4 re-check: a Save with the box ticked (as drawn) must not turn complained into unsubscribed */
  b = await f.ev(async () => { const rows = []; const f0 = db.from; db.from = function (t) { const q = f0.apply(db, arguments); if (t === 'crm_contacts') { const u0 = q.update; q.update = function (p) { rows.push(JSON.parse(JSON.stringify(p))); return u0.call(this, p); }; } return q; };
    const box = document.querySelector('#w152sheet [data-f="unsub"]'); const ticked = box.checked;
    try { await window.w152.savePerm('5003'); } finally { db.from = f0; }
    return { ticked, rows, st: window.w152.state().contacts.filter(c => c.id === 5003)[0].email_status }; });
  ok('a Save with the box ticked leaves complained as it is (no email_status written)', b.ticked === true && b.rows.length === 1 && !('email_status' in b.rows[0]) && b.st === 'complained', b);
  await click(f, '#w152sheet [data-w152perm-edit="5003"]'); await f.page.waitForTimeout(400);
  b = await f.ev(async () => { const rows = []; const f0 = db.from; db.from = function (t) { const q = f0.apply(db, arguments); if (t === 'crm_contacts') { const u0 = q.update; q.update = function (p) { rows.push(JSON.parse(JSON.stringify(p))); return u0.call(this, p); }; } return q; };
    document.querySelector('#w152sheet [data-f="unsub"]').checked = false;
    try { await window.w152.savePerm('5003'); } finally { db.from = f0; }
    return { rows, st: window.w152.state().contacts.filter(c => c.id === 5003)[0].email_status }; });
  ok('unticking it and saving leaves complained as it is (the update has no email_status)', b.rows.length === 1 && !('email_status' in b.rows[0]) && b.st === 'complained', b);
  ok('spam complaint: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- phone width ---------------- */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(), rpcs: RPCS('admin', null, { can_issue: true, is_admin: true }), wait: 4000 });
  await f.hash('#crm/c/5002', 2600);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, banner: !!document.querySelector('#w152sheet .w283dnc'), sh: (document.querySelector('#w152sheet .sh') || {}).scrollWidth, shw: (document.querySelector('#w152sheet .sh') || {}).clientWidth }));
  ok('phone: the contact with the banner does not scroll sideways', b.banner && b.sw <= b.w + 1 && b.sh <= b.shw + 1, b);
  ok('phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw283drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
