/* w159drive.js: Leaving Keela, the checklist at the top of the CRM's Sources tab (wave159a). Fixture rows are made up for the
   test. Today (the stub's clock, 25 Sep 2026): the days left to give Keela notice from the next charge and the notice in
   app_config, and six steps read from the Hub (contacts and gifts from Keela, forms live of all, automations on and the drafts
   that still need Keela's words, the email mode, the receipt mode and what is missing, the donation form) with whose step is
   next. When everything is done the count says so. On a phone the steps stack. usage: node test/w159drive.js */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['supporter'], tags: [], source: 'keela', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'wa150_backfill', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [] }, o || {});
}
function fixture(done) {
  const fx = loadFixture();
  fx.crm_contacts_v = [C(5001, 'Amara Test'), C(5002, 'Bea Test'), C(5003, 'Cal Test', { source: 'hub' })];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = []; fx.crm_gift_receipts_v = [];
  fx.crm_donations = [
    { id: 1, contact_id: 5001, amount: 50, currency: 'CAD', donated_at: '2026-09-10T15:00:00Z', platform: 'keela', kind: 'donation' },
    { id: 2, contact_id: 5002, amount: 30, currency: 'CAD', donated_at: '2026-03-01T15:00:00Z', platform: 'keela', kind: 'donation' },
    { id: 3, contact_id: 5003, amount: 20, currency: 'CAD', donated_at: '2026-09-20T15:00:00Z', platform: 'hub', kind: 'donation' }
  ];
  fx.crm_forms = ['volunteer', 'toronto-volunteer', 'newsletter'].map((slug, i) => ({ id: i + 1, slug, title: slug, status: done ? 'live' : 'draft', questions: [], created_at: '2026-09-28T12:00:00Z' }));
  fx.crm_automations = [1, 2, 3, 4, 5].map(i => ({ id: i, name: 'Automation ' + i, status: done ? 'on' : 'draft', trigger: {}, steps: i <= 3 && !done ? [{ id: 's1', type: 'send', body: '[Paste the words of Keela’s email here]' }] : [{ id: 's1', type: 'send', body: 'Hello' }], settings: {}, created_at: '2026-09-28T12:00:00Z' }));
  fx.app_config = [
    { key: 'mail_mode', value: done ? 'live' : 'test' }, { key: 'receipt_mode', value: done ? 'on' : 'off' },
    { key: 'receipt_signatory_name', value: done ? 'Daniela Test' : '' }, { key: 'receipt_next_number', value: done ? '1' : '' },
    { key: 'keela_next_charge', value: '2026-12-19' }, { key: 'keela_notice_days', value: '7' }, { key: 'keela_quarterly_cost', value: '657' }, { key: 'keela_donation_form', value: done ? 'Zeffy' : '' }
  ];
  fx.crm_automation_runs = []; fx.crm_contact_fields = []; fx.crm_fields = [];
  return fx;
}
const card = f => f.ev(() => { const c = document.querySelector('#crm .w159k'); return c ? { head: c.querySelector('h3').innerText.replace(/\s+/g, ' '), when: (c.querySelector('.w159kd') || {}).innerText || '',
  rows: [...c.querySelectorAll('.w159kr')].map(r => r.innerText.replace(/\s+/g, ' ')) } : null; });

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(false), wait: 4000 });
  await f.hash('#crm/sources', 3000);
  let b = await card(f);
  ok('Leaving Keela sits at the top of Sources, with how many steps are done', b && /^Leaving Keela 0 of 6 done/i.test(b.head) && await f.ev(() => document.querySelector('#crm .w152grid2').firstElementChild.classList.contains('w159k')), b);
  ok('the date that matters: days left to give notice, from the next charge and the notice in the settings', b && /78 days to give notice/.test(b.when) && /Keela’s next charge is on 19 Dec 2026 \(\$657 a quarter\); cancelling needs 7 days’ notice, so by 12 Dec 2026\. The aim is every step below done by 5 Dec 2026\./.test(b.when), b && b.when);
  ok('contacts and gifts from Keela, with the latest gift and the final import to come', b && /Contacts and gifts In progress/.test(b.rows[0]) && /2 contacts and 2 gifts from Keela are in the Hub \(the latest gift from 10 Sep 2026\)/.test(b.rows[0]) && /Steel downloads; the assistant imports/.test(b.rows[0]), b && b.rows[0]);
  ok('forms: none live of three, Steel puts them live', b && /Forms To do/.test(b.rows[1]) && /0 forms are live of 3 in the Hub \(the others are drafts\)/.test(b.rows[1]) && /puts them live/.test(b.rows[1]), b && b.rows[1]);
  ok('automations: none on, three drafts still need Keela’s words', b && /Automations To do/.test(b.rows[2]) && /0 automations are on of 5; 3 drafts still need the words of Keela’s emails/.test(b.rows[2]), b && b.rows[2]);
  ok('email in test mode; receipts off with what is missing; donations waiting on the decision', b && /Email To do/.test(b.rows[3]) && /test mode/.test(b.rows[3]) && /Tax receipts Waiting on a decision/.test(b.rows[4]) && /missing: who signs and the numbering/.test(b.rows[4]) &&
    /Online donations Waiting on a decision/.test(b.rows[5]) && /Zeffy/.test(b.rows[5]), b && b.rows.slice(3));
  ok('the rest of Sources is still there', await f.ev(() => /Where they come from/i.test(document.querySelector('#crm .w152root').innerText) && /To tidy/i.test(document.querySelector('#crm .w152root').innerText)));
  ok('no page errors', f.errs.length === 0, f.errs);
  await f.close();

  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(true), wait: 4000 });
  await f.hash('#crm/sources', 3000);
  b = await card(f);
  ok('when the Hub has taken over, five of six are done (the final import stays)', b && /^Leaving Keela 5 of 6 done/i.test(b.head) && /Forms Done/.test(b.rows[1]) && /Automations Done/.test(b.rows[2]) && /Email Done/.test(b.rows[3]) && /Tax receipts Done/.test(b.rows[4]) &&
    /Online donations Done/.test(b.rows[5]) && /Donations go through Zeffy/.test(b.rows[5]) && /Contacts and gifts In progress/.test(b.rows[0]), b);
  ok('no page errors (done)', f.errs.length === 0, f.errs);
  await f.close();

  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(false), wait: 4000 });
  await f.hash('#crm/sources', 3000);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, cols: getComputedStyle(document.querySelector('#crm .w159ks')).gridTemplateColumns.split(' ').length }));
  ok('phone: the steps stack and nothing scrolls sideways', b.cols === 1 && b.sw <= b.w + 1, b);
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw159drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
