/* w293fx.js: invented data for the wave293 drives (test/w293drive.js, test/crm1ui_email_worst.js): a contact with email history (threads from
   Steel's mailbox, hub@ and info@), the Relationship card's rows, and crm_insights_overview's answer for the Insights tab, in five sets: demo,
   worst, empty, one, huge. No real people: names are invented, addresses at example.org, gmail ids gm293... The clock in test/boot.js is
   2026-09-25 16:00 Toronto. */
const { loadFixture } = require('./boot');

const LONG = {
  name: 'Aleksandra Wiśniewska-Kowalczyk', email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com',
  subj: 'Proposition de partenariat : collecte de denrées non périssables au Marché Jean-Talon pour les familles du Plateau-Mont-Royal, suivi de notre appel du 12 mars et calendrier',
  token: 'REF-2026-0004512-NORTHWIND-INDUSTRIES-HOLDINGS-COMMUNITY-FOOD-SECURITY-PARTNERSHIP',
  line: 'Asks whether Welfare Avenue could take 40 cases of canned food from the Jean-Talon drive and when a volunteer could pick them up before the',
  org: 'Fondation communautaire pour la sécurité alimentaire et les partenariats autochtones du Grand Montréal (FCSAPAGM)',
  open: 'They are waiting to hear whether the second pick-up in December can happen on a Saturday morning, and who will sign the receipt for the 40 cases; they also asked twice for the tax receipt for last year\'s gift, which nobody has answered yet, and want a photo for their newsletter.',
  summary: 'A long-standing partner foundation that has written since 2020, first about the spring food drive, then about volunteer groups from their staff and two corporate gifts. The tone is warm and practical. They prefer French, answer within a day, and usually copy their communications lead. The last exchanges were about a December pick-up at the Marché Jean-Talon and a photo for their newsletter; they also asked about a tax receipt for a gift last year, which still needs an answer from the finance team before the holidays.'
};
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['partner'], tags: ['email history'], source: 'email_history', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-09-20T14:00:00Z', updated_at: '2026-09-20T14:00:00Z',
    created_by: 'Email history', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [], job_title: null, do_not_contact: false, dnc_reason: null }, o || {});
}
let seq = 1;
function M(cid, box, thread, at, dir, subject, line, topic) {
  const id = 93000 + seq++;
  return { id, contact_id: cid, kind: 'email', direction: dir, channel: 'email', subject, body: line, occurred_at: at, source: 'gmail', source_ref: box + ':gm293' + id + ':k1',
    meta: { mailbox: box, thread, topic, run: 9201 }, created_at: at, created_by: 'Email history' };
}
function relv(cid, rows) {
  if (!rows.length) return [];
  const s = rows.map(r => r.occurred_at).sort();
  const yrs = {}; rows.forEach(r => { const y = r.occurred_at.slice(0, 4); yrs[y] = (yrs[y] || 0) + 1; });
  return [{ contact_id: cid, first_email_at: s[0], last_email_at: s[s.length - 1], emails_in: rows.filter(r => r.direction === 'in').length, emails_out: rows.filter(r => r.direction === 'out').length,
    threads: new Set(rows.map(r => r.meta.thread)).size, emails_by_year: yrs, mailboxes: [...new Set(rows.map(r => r.meta.mailbox))] }];
}
const ORG = (id, name, w, m, w12, m12, o) => Object.assign({ id, name, relationship: 'partner', status: 'active', category: 'partner', writers: w, emails: m, writers_12: w12, emails_12: m12, last_at: '2026-08-14T15:00:00Z' }, o || {});
const Q = (id, name, kind, at, was) => ({ contact_id: id, name, kind, last_at: at, last_was: was || 'timeline' });
const BY = (rows) => rows.map(([year, type, people]) => ({ year, type, people }));

/* { fx, overview, ids: { who: contact with history, plain: contact without }, steelRows } */
function fixture(DATA, who) {
  seq = 1;
  const fx = loadFixture();
  const P = 7001, N = 7002;   /* the contact with email history; one with none */
  let person, mail = [], rel = [], overview, others = [];
  if (DATA === 'empty') {
    person = C(P, 'Nora Testempty', { emails: ['nora@example.org'], primary_email: 'nora@example.org', kinds: ['supporter'], tags: [], source: 'manual' });
    overview = { allowed: true, by_type_year: [], orgs: [], orgs_total: 0, quiet: [], quiet_total: 0, quiet_months: 12, admin: who === 'admin', steel_open: false, as_of: '2026-09-25T20:00:00Z' };
  } else if (DATA === 'one') {
    person = C(P, 'Jo', { emails: ['jo@example.org'], primary_email: 'jo@example.org' });
    mail = [M(P, 'hub', 'th1', '2021-03-12T15:00:00Z', 'in', 'Hello', 'Introduces herself.', 'other')];
    rel = [{ contact_id: P, rel_type: 'partner', rel_conf: 1, topics: ['other'], open_item: null, summary: 'One email, 12 Mar 2021: Introduces herself.', from_steel: false, stale: false, model: 'none', cost: 0, generated_at: '2026-09-20T15:00:00Z', generated_by: 'Email history' }];
    overview = { allowed: true, by_type_year: BY([[2021, 'partner', 1]]), orgs: [ORG(81, 'Test Org', 1, 1, 1, 1)], orgs_total: 1, quiet: [Q(7101, 'Una Testone', 'donor', '2024-03-14T15:00:00Z', 'gift')], quiet_total: 1, quiet_months: 12, admin: who === 'admin', steel_open: false, as_of: '2026-09-25T20:00:00Z' };
  } else if (DATA === 'worst' || DATA === 'huge') {
    const huge = DATA === 'huge';
    person = C(P, LONG.name, { emails: [LONG.email], primary_email: LONG.email, kinds: ['partner', 'donor', 'volunteer'], language: 'fr', job_title: 'Senior Program Officer, Community Food Security and Indigenous Partnerships' });
    mail = [
      M(P, 'steel', 'thL', '2026-03-12T15:00:00Z', 'in', LONG.subj, LONG.line, 'partnership'),
      M(P, 'steel', 'thL', '2026-03-13T15:00:00Z', 'out', LONG.subj, 'Says yes to the 40 cases and offers a Saturday pick-up.', 'partnership'),
      M(P, 'info', 'thL', '2026-04-02T15:00:00Z', 'in', 'Re: ' + LONG.token, LONG.line, 'donation'),
      M(P, 'hub', 'thT', '2025-12-30T15:00:00Z', 'in', LONG.token, '', 'program'),
      M(P, 'hub', 'thT', '2026-01-04T15:00:00Z', 'out', LONG.token, 'Confirms the receipt is on its way.', 'donation'),
      M(P, 'info', 'thE', '2024-06-01T15:00:00Z', 'in', '🎉 Merci! Thank you for the volunteers 🙏', 'Thanks the volunteers for the drive.', 'volunteering'),
      M(P, 'hub', 'thN', '2023-02-01T15:00:00Z', 'in', '', 'Sends the annual report.', null)
    ].concat(range(40, i => M(P, 'hub', 'th40', '2022-0' + (1 + (i % 9)) + '-' + String(10 + (i % 18)).padStart(2, '0') + 'T15:00:00Z', i % 2 ? 'out' : 'in', 'Weekly volunteer group from our staff', 'Line ' + (i + 1) + ': who is coming this week.', i % 3 ? 'volunteering' : 'event')));
    if (huge) mail = mail.concat(range(1000, i => M(P, i % 5 ? 'hub' : 'info', 'thH' + (i % 320), '2021-' + String(1 + (i % 12)).padStart(2, '0') + '-' + String(1 + (i % 27)).padStart(2, '0') + 'T15:00:00Z', i % 2 ? 'in' : 'out', 'Thread ' + (i % 320) + ' about the weekly meals', 'Line ' + i + '.', ['donation', 'partnership', 'volunteering', 'event', 'media', 'supplier', 'government', 'program'][i % 8])));
    rel = [{ contact_id: P, rel_type: 'vendor', rel_conf: 0.42, topics: ['donation', 'partnership', 'volunteering', 'event', 'media', 'supplier', 'government', 'program', 'other'], open_item: LONG.open, summary: LONG.summary, from_steel: true, stale: true, model: 'haiku', cost: 0.0102, generated_at: '2026-09-21T15:00:00Z', generated_by: 'Email history' }];
    const types = ['partner', 'donor', 'volunteer', 'supporter', 'government', 'media', 'vendor', 'other', 'none'];
    const by = []; for (let y = 2020; y <= 2026; y++) types.forEach((t, i) => { const n = huge ? 120 + ((y * 7 + i * 13) % 300) : (i < 3 ? 1 + ((y + i) % 4) : (y === 2023 && i === 8 ? 1 : 0)); if (n) by.push([y, t, n]); });
    overview = { allowed: true, by_type_year: BY(by),
      orgs: [ORG(81, LONG.org, huge ? 1284 : 14, huge ? 12840 : 213, 3, 27, { status: 'prospect', relationship: 'donor organisation' }), ORG(82, 'Jo', 1, 1, 0, 0, { status: 'past', relationship: 'collaborator', last_at: '2020-05-01T15:00:00Z' }),
        ORG(83, 'Banque alimentaire 🥫 du Plateau', 4, 1000000, 4, 2, { status: 'declined', relationship: 'supplier' })].concat(huge ? range(22, i => ORG(100 + i, 'Organisation de test numéro ' + (i + 1), 25 - i, 300 - i, 3, 12)) : []),
      orgs_total: huge ? 600 : 3,
      quiet: [Q(7101, LONG.name, 'donor', '2025-09-24T15:00:00Z', 'gift'), Q(7102, 'Jo', 'volunteer', '2020-04-01T15:00:00Z'), Q(7103, '🦊 Fox Liang', 'partner', '2024-01-01T15:00:00Z'), Q(7104, 'Christopher Alexander Montgomery III', 'supporter', '2023-06-01T15:00:00Z')]
        .concat(huge ? range(96, i => Q(7200 + i, 'Test Quiet Person ' + (i + 1), ['donor', 'partner', 'supporter', 'volunteer'][i % 4], '2023-0' + (1 + (i % 9)) + '-01T15:00:00Z')) : []),
      quiet_total: huge ? 1284 : 4, quiet_months: huge ? 18 : 12, admin: who === 'admin', steel_open: false, as_of: '2026-09-25T20:05:00Z' };
    others = range(4, i => C(7101 + i, ['Test Quiet A', 'Jo', '🦊 Fox Liang', 'Christopher Alexander Montgomery III'][i], { kinds: ['donor'] }));
  } else {
    person = C(P, 'Amara Testpartner', { emails: ['amara.test@example.org'], primary_email: 'amara.test@example.org', job_title: 'Director' });
    mail = [
      M(P, 'hub', 'thA', '2021-03-12T15:00:00Z', 'in', 'Food drive partnership', 'Asks whether Welfare Avenue would partner on a spring food drive.', 'partnership'),
      M(P, 'info', 'thA', '2021-03-15T15:00:00Z', 'out', 'Food drive partnership', 'Says yes and offers a call next week.', 'partnership'),
      M(P, 'hub', 'thA', '2021-04-02T15:00:00Z', 'in', 'Food drive partnership', 'Confirms the date and the number of volunteers.', 'event'),
      M(P, 'steel', 'thS', '2026-08-14T15:00:00Z', 'in', 'Board introduction', 'Offers to introduce Steel to their board chair.', 'partnership')
    ];
    rel = [{ contact_id: P, rel_type: 'partner', rel_conf: 0.86, topics: ['partnership', 'event'], open_item: 'They are waiting for a date for the board introduction.', summary: 'A partner since the 2021 spring food drive. Friendly and quick to answer; they now offer an introduction to their board chair.', from_steel: true, stale: false, model: 'haiku', cost: 0.0094, generated_at: '2026-09-20T15:00:00Z', generated_by: 'Email history' }];
    overview = { allowed: true, by_type_year: BY([[2020, 'partner', 3], [2020, 'donor', 2], [2021, 'partner', 5], [2021, 'volunteer', 4], [2021, 'none', 2], [2022, 'supporter', 3], [2023, 'partner', 2], [2024, 'media', 1], [2025, 'donor', 4], [2026, 'partner', 6], [2026, 'government', 1]]),
      orgs: [ORG(81, 'Test Food Bank', 5, 42, 2, 6), ORG(82, 'Test School Board', 3, 12, 0, 0, { status: 'past', relationship: 'collaborator', last_at: '2023-05-01T15:00:00Z' })], orgs_total: 2,
      quiet: [Q(7101, 'Bea Testdonor', 'donor', '2025-02-14T15:00:00Z', 'gift'), Q(7102, 'Cal Testvolunteer', 'volunteer', '2024-11-02T15:00:00Z')], quiet_total: 2, quiet_months: 12, admin: who === 'admin', steel_open: false, as_of: '2026-09-25T20:00:00Z' };
    others = [C(7101, 'Bea Testdonor', { kinds: ['donor'] }), C(7102, 'Cal Testvolunteer', { kinds: ['volunteer'] })];
  }
  /* a member reads what row security leaves them: no line from Steel's mailbox, no summary marked from_steel (wave292's policies) */
  const steelRows = mail.filter(r => r.meta.mailbox === 'steel').length;
  if (who !== 'admin') { mail = mail.filter(r => r.meta.mailbox !== 'steel'); rel = rel.filter(r => !r.from_steel); }
  const plain = C(N, 'Pat Testplain', { emails: ['pat@example.org'], primary_email: 'pat@example.org', kinds: ['supporter'], tags: [], source: 'manual' });
  const cs = [person, plain].concat(others);
  fx.crm_contacts_v = cs; fx.crm_contacts = cs.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_contact_chapters = []; fx.crm_contact_private = [];
  fx.crm_chapters = [{ code: 'montreal', name_en: 'Montreal', active: true, sort: 1 }];
  fx.crm_interactions = mail.concat(DATA === 'empty' ? [] : [{ id: 92001, contact_id: P, kind: 'note', direction: 'internal', channel: null, subject: null, body: 'Met at the gala; wants a tour of the kitchen.', occurred_at: '2026-09-01T15:00:00Z', source: 'hub', source_ref: null, meta: {}, created_at: '2026-09-01T15:00:00Z', created_by: 'steel.macdonald@welfareavenue.com' }]);
  fx.crm_donations = DATA === 'empty' ? [] : [{ id: 61, contact_id: P, amount: DATA === 'worst' || DATA === 'huge' ? 12345.67 : 100, currency: 'CAD', donated_at: '2025-12-01T15:00:00Z', platform: 'hub', campaign: 'Holiday appeal', designation: null, recurring: false, receipt_number: null, receipt_issued_at: null, receipt_url: null, notes: null }];
  fx.crm_email_relationship = rel;
  fx.crm_email_relationship_v = relv(P, mail);
  fx.crm_fields = []; fx.crm_contact_fields = []; fx.crm_automation_runs = []; fx.crm_automations = []; fx.crm_import_runs = []; fx.crm_import_batches = [];
  fx.app_config = (fx.app_config || []).filter(x => !/^mail_history_(type_unsure|steel_open)$/.test(x.key)).concat([{ key: 'mail_history_type_unsure', value: '0.5' }, { key: 'mail_history_steel_open', value: 'false' }, { key: 'mail_mode', value: 'test' }]);
  return { fx, overview, ids: { who: P, plain: N }, steelRows, mailCount: mail.length };
}
/* mail-history insight answered and recorded (window.__inv); window.__INSIGHT_ERR makes it refuse with the function's words */
const INVOKE = 'window.__inv = []; window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; window.__inv.push({ name: name, body: b });' +
  ' if (name === "mail-history" && b.action === "insight") { if (window.__INSIGHT_ERR) return { data: null, error: { message: "Edge Function returned a non-2xx status code", context: { json: function () { return Promise.resolve({ error: window.__INSIGHT_ERR }); } } } }; return { data: { ok: true, saved: true, model: "haiku", cost: 0.009 }, error: null }; }' +
  ' if (name === "mail-send") return { data: { settings: { mail_mode: "test" }, admin: true }, error: null }; return { data: null, error: null }; };';

module.exports = { fixture, INVOKE, LONG };
