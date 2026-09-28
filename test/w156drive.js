/* w156drive.js: the CRM's Forms tab (wave156). Fixture rows are made up for the test (no real people); every write is
   recorded on the page (the stub echoes it and never changes the fixture).
   An admin opens Forms: eight tabs, the rail's Forms item, the forms with their status, link and answers, the custom
   fields with their counts. The volunteer form's editor: the questions and where each saves, the preview with the planned
   serving dates, a new question saved to a new field (the field is made first, then the form points at it), putting it
   live (confirm, then the status update), the go-live check's message. The answers of the live newsletter form: spam and
   tests hidden until asked, an answer opened with what the Hub did. A new draft. A contact's page: More about them and
   the form's timeline entry. On a phone nothing overflows. usage: node test/w156drive.js */
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
const DAY = n => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };
const QV = [
  { id: 'first_name', type: 'text', label: 'First name', required: true, to: 'contact.first_name' },
  { id: 'last_name', type: 'text', label: 'Last name', required: true, to: 'contact.last_name' },
  { id: 'email', type: 'email', label: 'Email', required: true, to: 'contact.email' },
  { id: 'phone', type: 'phone', label: 'Phone', required: true, to: 'contact.phone', help: 'We text the week of a serving.' },
  { id: 'roles', type: 'multi', label: 'How would you like to help?', required: true, to: 'volunteer.roles', options: [{ v: 'server', l: 'Serving food' }, { v: 'cook', l: 'Cooking' }] },
  { id: 'dates', type: 'serving_dates', label: 'Which Sundays can you serve?', required: false, to: 'volunteer.dates' },
  { id: 'instagram', type: 'text', label: 'Instagram (optional)', required: false, to: 'field:instagram' },
  { id: 'comments', type: 'long_text', label: 'Anything else we should know?', required: false, to: 'note' }
];
function fixture() {
  const fx = loadFixture();
  fx.crm_contacts_v = [
    C(5001, 'Amara Okafor', { emails: ['amara.okafor@example.com'], primary_email: 'amara.okafor@example.com', kinds: ['volunteer'], email_status: 'subscribed', email_consent: 'express', consent_source: 'Hub form: Get the Welfare Avenue newsletter (27 Sep 2026)', consent_at: '2026-09-27T15:00:00Z', source: 'hub_form' }),
    C(5002, 'Élodie Gagnon', { emails: ['elodie.gagnon@example.com'], primary_email: 'elodie.gagnon@example.com', kinds: ['supporter'] })
  ];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_donations = [];
  fx.crm_interactions = [
    { id: 951, contact_id: 5001, kind: 'form', direction: 'in', channel: 'web', subject: 'Filled in "Get the Welfare Avenue newsletter"', body: 'First name: Amara\nEmail: amara.okafor@example.com\nEmail permission: Yes', occurred_at: '2026-09-27T15:00:00Z', source: 'hub_form', source_ref: 'form:12', meta: { form_id: 3, slug: 'newsletter', submission_id: 12, consent: true }, created_at: '2026-09-27T15:00:00Z', created_by: 'form:newsletter' }
  ];
  fx.crm_forms = [
    { id: 1, slug: 'volunteer', title: 'Volunteer with Welfare Avenue', intro: 'Welfare Avenue serves free meals in Montreal.', lang: 'en', kind: 'volunteer', status: 'draft', questions: QV, consent: { ask: true, required: false, label: 'Yes, Welfare Avenue can email me news. I can unsubscribe at any time.' }, thank_you: 'Thank you.', settings: { volunteer_record: true, serving_location: 'Montreal', city: 'Montreal', tags: [] }, created_at: '2026-09-28T10:00:00Z', created_by: 'wave156', updated_at: '2026-09-28T10:00:00Z', updated_by: 'wave156', published_at: null, published_by: null, closed_at: null },
    { id: 2, slug: 'toronto-volunteer', title: 'Volunteer in Toronto', intro: '', lang: 'en', kind: 'volunteer', status: 'draft', questions: QV.slice(0, 3), consent: { ask: true, required: false, label: 'Yes, email me.' }, thank_you: 'Thank you.', settings: { volunteer_record: false, city: 'Toronto', tags: ['toronto'] }, created_at: '2026-09-28T10:01:00Z', created_by: 'wave156', updated_at: '2026-09-28T10:01:00Z', updated_by: 'wave156', published_at: null, published_by: null, closed_at: null },
    { id: 3, slug: 'newsletter', title: 'Get the Welfare Avenue newsletter', intro: 'About once a month.', lang: 'en', kind: 'newsletter', status: 'published', questions: QV.slice(0, 3), consent: { ask: true, required: true, label: 'Yes, email me the newsletter.' }, thank_you: 'You are on the list.', settings: { tags: [] }, created_at: '2026-09-28T10:02:00Z', created_by: 'wave156', updated_at: '2026-09-28T10:02:00Z', updated_by: 'wave156', published_at: '2026-09-28T11:00:00Z', published_by: 'steel.macdonald@welfareavenue.com', closed_at: null }
  ];
  fx.crm_form_stats_v = [{ form_id: 1, submissions: 0, last_7_days: 0, last_at: null, spam: 0, errors: 0, tests: 0 }, { form_id: 2, submissions: 0, last_7_days: 0, last_at: null, spam: 0, errors: 0, tests: 0 }, { form_id: 3, submissions: 2, last_7_days: 2, last_at: '2026-09-28T12:00:00Z', spam: 1, errors: 1, tests: 1 }];
  fx.crm_fields = [
    { id: 11, key: 'instagram', label: 'Instagram', type: 'text', options: [], help: null, sort: 10, archived_at: null },
    { id: 12, key: 'photo_consent', label: 'Photos and videos on social media', type: 'yes_no', options: [], help: null, sort: 20, archived_at: null },
    { id: 13, key: 'rally_paper_team', label: 'Rally Paper team', type: 'choice', options: ['Quest', 'Logic & Trivia'], help: 'From Keela.', sort: 80, archived_at: null }
  ];
  fx.crm_contact_fields = [{ contact_id: 5001, field_id: 11, value: '@amara', source: 'form:volunteer', updated_at: '2026-09-28T10:00:00Z' }, { contact_id: 5001, field_id: 12, value: true, source: 'form:volunteer', updated_at: '2026-09-28T10:00:00Z' }, { contact_id: 5002, field_id: 13, value: 'Quest', source: 'keela', updated_at: '2026-09-28T10:00:00Z' }];
  fx.volunteer_events = (fx.volunteer_events || []).filter(e => e.status !== 'planned').concat([
    { id: 9101, code: 'T-1', event_date: DAY(6), status: 'planned', kind: 'service', location: 'Montreal', title: null },
    { id: 9102, code: 'T-2', event_date: DAY(20), status: 'planned', kind: 'service', location: 'Montreal', title: null },
    { id: 9103, code: 'T-3', event_date: DAY(8), status: 'planned', kind: 'service', location: 'Ottawa', title: null }]);
  fx.crm_form_submissions = [
    { id: 12, form_id: 3, contact_id: 5001, status: 'processed', is_test: false, display: [{ label: 'First name', value: 'Amara' }, { label: 'Email', value: 'amara.okafor@example.com' }, { label: 'Email permission', value: 'Yes' }], consent: { given: true }, result: { contact_id: 5001, created: true, consent: true }, error: null, created_at: '2026-09-28T12:00:00Z' },
    { id: 13, form_id: 3, contact_id: null, status: 'error', is_test: false, display: [{ label: 'First name', value: 'Jo' }, { label: 'Email', value: 'jo@example.com' }], consent: null, result: {}, error: 'an email address is needed', created_at: '2026-09-28T11:30:00Z' },
    { id: 14, form_id: 3, contact_id: null, status: 'spam', is_test: false, display: [], consent: null, result: {}, error: 'hidden field filled', created_at: '2026-09-28T11:00:00Z' },
    { id: 15, form_id: 3, contact_id: null, status: 'test', is_test: true, display: [{ label: 'Email', value: 'test@example.com' }], consent: null, result: {}, error: null, created_at: '2026-09-28T10:30:00Z' }
  ];
  return fx;
}
const patch = f => f.ev(() => {
  window.__ins = [];
  const from0 = db.from.bind(db);
  db.from = function (t) {
    const q = from0(t); const ins = q.insert, up = q.update, del = q.delete;
    q.insert = function (p) { window.__ins.push({ t: t, op: 'insert', p: JSON.parse(JSON.stringify(p)) }); if (p && !Array.isArray(p) && (t === 'crm_forms' || t === 'crm_fields')) p = Object.assign({ id: 900 + window.__ins.length }, p); return ins.call(this, p); };
    q.update = function (p) { window.__ins.push({ t: t, op: 'update', p: JSON.parse(JSON.stringify(p)) }); return up.call(this, p); };
    q.delete = function () { window.__ins.push({ t: t, op: 'delete' }); return del.call(this); };
    return q;
  };
  return true;
});
const text = (f, s) => f.ev(x => { const el = document.querySelector(x); return el ? el.innerText.replace(/\s+/g, ' ').trim() : null; }, s);
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f);
  await f.hash('#crm/forms', 2400);
  let b = await f.ev(() => ({ tabs: [...document.querySelectorAll('#crm .w152tabs button')].map(x => x.textContent.trim() + (x.classList.contains('on') ? '*' : '')),
    rows: [...document.querySelectorAll('#crm .w156row')].map(r => r.innerText.replace(/\s+/g, ' ')), copy: [...document.querySelectorAll('#crm .w156row [data-w152copy]')].map(x => x.getAttribute('data-w152copy')),
    fields: [...document.querySelectorAll('#crm .w156fr')].map(r => r.innerText.replace(/\s+/g, ' ')) }));
  ok('the CRM has eight tabs and #crm/forms marks Forms', b.tabs.length === 8 && b.tabs[7] === 'Forms*', b.tabs);
  ok('the forms list: two drafts and the live newsletter with its link and answers', b.rows.length === 3 && /Draft/.test(b.rows[0]) && /Live/.test(b.rows[2]) && /hub\.welfareavenue\.com\/f\/newsletter/.test(b.rows[2]) && /2 answers/.test(b.rows[2]) && /1 needs a look/.test(b.rows[2]), b.rows);
  ok('only the live form offers Copy the link, with the public address', b.copy.length === 1 && b.copy[0] === 'https://hub.welfareavenue.com/f/newsletter', b.copy);
  await f.page.waitForTimeout(400);
  b.fields = await f.ev(() => [...document.querySelectorAll('#crm .w156fr')].map(r => r.innerText.replace(/\s+/g, ' ')));
  ok('the custom fields card lists the fields, their kind, the forms using them and how many contacts have them', b.fields.length === 3 && /Instagram · Short answer · in Volunteer with Welfare Avenue/.test(b.fields[0]) && /1 contact/.test(b.fields[0]) && /Rally Paper team · One choice/.test(b.fields[2]), b.fields);
  const rail = await f.ev(() => [...document.querySelectorAll('#w153rail .w153it')].map(a => a.textContent.trim()));
  const nextUp = await f.ev(() => (document.querySelector('#w153rail .w153next') || {}).innerText || '');
  ok('the CRM rail lists Forms under Contacts', rail.join('|') === 'Contacts|Possible duplicates|Sources|Lists|Forms|Gifts|Email|Campaigns', rail);
  ok('only Reports is still to come', /Reports/.test(nextUp) && !/Forms/.test(nextUp), nextUp);
  await shot(f, 'forms_list');

  /* the editor */
  await click(f, '#crm [data-w156open="1"]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => ({ hash: location.hash, qs: document.querySelectorAll('#crm .w156q').length, tos: [...document.querySelectorAll('#crm .w156q [data-w156qk="to"]')].map(s => s.options[s.selectedIndex].text),
    dates: [...document.querySelectorAll('#crm .w156pv .w156pb')].map(x => x.textContent), vol: !!document.querySelector('#crm [data-w156set="volunteer_record"]:checked'), pub: !!document.querySelector('#crm [data-w156pub]') }));
  ok('Open shows the editor at #crm/forms/1 with the eight questions', b.hash === '#crm/forms/1' && b.qs === 8, b);
  ok('each question says where it saves (name, email, roles, sign-ups, a field, the note)', b.tos[0] === 'Their first name' && b.tos[2] === 'Their email' && b.tos[4] === 'Their volunteer roles' && b.tos[5] === 'A sign-up for each date (to confirm)' && b.tos[6] === 'Field: Instagram' && b.tos[7] === 'The note on their timeline', b.tos);
  ok('the preview lists the planned Montreal servings only, and the volunteer record box is ticked', b.dates.filter(d => /\d{4}$/.test(d)).length === 2 && b.vol && b.pub, b);
  await shot(f, 'form_editor');
  await setv(f, '#crm [data-w156k="title"]', 'Serve with Welfare Avenue');
  await click(f, '#crm [data-w156qadd]'); await f.page.waitForTimeout(300);
  await setv(f, '#crm [data-w156qi="8"] [data-w156qk="label"]', 'Your pronouns');
  await setv(f, '#crm [data-w156qi="8"] [data-w156qk="to"]', '__new'); await f.page.waitForTimeout(300);
  await click(f, '#crm [data-w156save]'); await f.page.waitForTimeout(1200);
  b = await f.ev(() => ({ ins: window.__ins.slice(), msg: (document.querySelector('#crm .w154msg') || {}).innerText }));
  const fieldIns = b.ins.filter(x => x.t === 'crm_fields' && x.op === 'insert')[0];
  const formUp = b.ins.filter(x => x.t === 'crm_forms' && x.op === 'update')[0];
  ok('a question saved to a new field makes the field first (key and label from the question)', fieldIns && fieldIns.p.key === 'your_pronouns' && fieldIns.p.label === 'Your pronouns' && fieldIns.p.type === 'text', fieldIns);
  ok('then the form is saved with the new title and the question pointing at the new field', formUp && formUp.p.title === 'Serve with Welfare Avenue' && formUp.p.questions.length === 9 && formUp.p.questions[8].to === 'field:your_pronouns' && formUp.p.questions[8].id === 'your_pronouns' && formUp.p.questions[4].options.length === 2, formUp && formUp.p.questions && formUp.p.questions[8]);
  ok('the save says so', /Saved/.test(b.msg || ''), b.msg);
  await click(f, '#crm [data-w156pub]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => (document.querySelector('#crm .w155cf') || {}).innerText || '');
  ok('Put it live asks first and names the public address', /Put “.+” live\?/.test(b) && /hub\.welfareavenue\.com\/f\/volunteer/.test(b), b);
  const before = await f.ev(() => window.__ins.length);
  await click(f, '#crm [data-w156pubok]'); await f.page.waitForTimeout(1400);
  b = await f.ev(() => ({ ins: window.__ins.slice(), msg: (document.querySelector('#crm .w154msg') || {}).innerText }));
  const st = b.ins.slice(before).filter(x => x.t === 'crm_forms' && x.op === 'update' && x.p.status)[0];
  ok('then the status goes to published and the page says where it lives', st && st.p.status === 'published' && /Live at hub\.welfareavenue\.com\/f\/volunteer/.test(b.msg || ''), { st, msg: b.msg });

  /* the go-live check from the database comes back in plain words */
  await f.ev(() => { const up0 = db.from; db.from = function (t) { const q = up0(t); if (t === 'crm_forms') { const u = q.update; q.update = function (p) { if (p && p.status === 'published') { return { eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'A form needs an email question before it can go live.' } }) }) }) }; } return u.call(this, p); }; } return q; }; });
  await click(f, '#crm [data-w156pub]'); await f.page.waitForTimeout(200); await click(f, '#crm [data-w156pubok]'); await f.page.waitForTimeout(1200);
  b = await text(f, '#crm .w152err');
  ok('a refused go-live shows the database’s reason', /A form needs an email question before it can go live/.test(b || ''), b);

  /* the answers of the live form */
  await f.hash('#crm/forms/3/answers', 1600);
  b = await f.ev(() => ({ rows: [...document.querySelectorAll('#crm .w156sub')].map(r => r.innerText.replace(/\s+/g, ' ')), btns: [...document.querySelectorAll('#crm [data-w156spam], #crm [data-w156tests]')].map(x => x.textContent) }));
  ok('the answers list hides spam and tests: an answer in the CRM and one that needs a look', b.rows.length === 2 && /Amara Okafor/.test(b.rows[0]) && /In the CRM/.test(b.rows[0]) && /jo@example\.com/.test(b.rows[1]) && /Needs a look/.test(b.rows[1]) && b.btns.length === 2, b);
  await click(f, '#crm [data-w156sub="12"]'); await f.page.waitForTimeout(300);
  b = await text(f, '#crm .w156sd');
  ok('opening an answer shows every line and what the Hub did', /First name Amara/i.test(b || '') && /The Hub: a new contact; email permission recorded/.test(b || ''), b);
  await click(f, '#crm [data-w156sub="13"]'); await f.page.waitForTimeout(300);
  b = await text(f, '#crm .w156sd');
  ok('an answer that failed says what went wrong', /What went wrong: an email address is needed/.test(b || ''), b);
  await click(f, '#crm [data-w156spam]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => document.querySelectorAll('#crm .w156sub').length);
  ok('Show spam adds the held answer', b === 3, b);
  await shot(f, 'form_answers');

  /* a new draft */
  await f.hash('#crm/forms', 1200);
  const n0 = await f.ev(() => window.__ins.length);
  await click(f, '#crm [data-w156new]'); await f.page.waitForTimeout(1500);
  b = await f.ev(() => window.__ins.slice());
  const nf = b.slice(n0).filter(x => x.t === 'crm_forms' && x.op === 'insert')[0];
  ok('New form makes a draft with a free address, name and email questions, and the permission question', nf && nf.p.status === 'draft' && nf.p.slug === 'new-form-4' && nf.p.questions.map(q => q.to).join(',') === 'contact.first_name,contact.last_name,contact.email' && nf.p.consent.ask === true, nf && nf.p);

  /* a contact's page */
  await f.hash('#crm/c/5001', 2200);
  b = await f.ev(() => ({ more: [...document.querySelectorAll('#w152sheet .w156more .w152kv')].map(x => x.innerText.replace(/\s+/g, ' ')), tl: [...document.querySelectorAll('#w152sheet .w152it')].map(x => x.innerText.replace(/\s+/g, ' ')) }));
  ok('a contact’s page shows More about them from the custom fields', b.more.length === 2 && /Instagram @amara/.test(b.more[0]) && /Photos and videos on social media Yes/.test(b.more[1]), b.more);
  ok('the form answer is on the timeline, from the form’s address', b.tl.some(x => /Filled in "Get the Welfare Avenue newsletter"/.test(x) && /hub\.welfareavenue\.com\/f\/newsletter/.test(x)), b.tl);
  await shot(f, 'contact_more');
  ok('no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* phone */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000, width: 390 });
  await patch(f);
  await f.hash('#crm/forms', 2400);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
  ok('phone: the forms list does not scroll sideways', b.sw <= b.w + 1, b);
  await shot(f, 'phone_forms');
  await f.hash('#crm/forms/1', 1600);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, q: document.querySelectorAll('#crm .w156q').length }));
  ok('phone: the editor does not scroll sideways', b.q === 8 && b.sw <= b.w + 1, b);
  await shot(f, 'phone_form_editor');
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH', e && e.stack || e); process.exit(1); });
