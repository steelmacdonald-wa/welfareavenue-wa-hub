/* w154drive.js: the email foundation (wave154). Fixture rows are made up for the test (no real people); the mail-send
   function is stubbed on the page (db.functions.invoke) and every call is recorded.
   An admin opens the CRM's Email tab: the permission numbers, the sending card (domain waiting for its records, the DNS
   table with copy buttons, test mode, the webhook), the templates (preview in an iframe, a test to themselves), the send
   log with statuses, the rule. Then a contact's page: the permission line, Send an email from the Hub (a newsletter to
   someone without consent is held back, a confirmation is allowed, an express contact gets it sent), the status chip on
   the timeline, no button for a bouncing address. A member on the HR profile sees the tab without the admin buttons; a
   director sees nothing; on a phone the tab stacks. usage: node test/w154drive.js   (SHOTS=<dir> saves screenshots) */
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
/* the stubbed function: every call is recorded in window.__calls */
const STUB = `(function(){
  window.__calls = [];
  var SETTINGS = { mail_mode: 'test', mail_from_name: 'Welfare Avenue', mail_from_email: 'info@welfareavenue.com', mail_reply_to: 'info@welfareavenue.com', mail_test_recipients: 'steelmacdonald@gmail.com, steel.macdonald@welfareavenue.com', mail_postal_address: 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9', mail_charity_number: '713048502RR0001', mail_fundraising_exemption: 'off', mail_domain: 'welfareavenue.com' };
  var DOMAIN = { id: 'd1', name: 'welfareavenue.com', status: 'pending', region: 'us-east-1', records: [
    { record: 'DKIM', name: 'resend._domainkey', type: 'TXT', ttl: 'Auto', status: 'not_started', value: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC-test' },
    { record: 'SPF', name: 'send', type: 'MX', ttl: 'Auto', status: 'not_started', value: 'feedback-smtp.us-east-1.amazonses.com', priority: 10 },
    { record: 'SPF', name: 'send', type: 'TXT', ttl: 'Auto', status: 'not_started', value: 'v=spf1 include:amazonses.com ~all' } ] };
  window.__mailStub = function (name, opts) {
    var b = (opts && opts.body) || {}; window.__calls.push(Object.assign({ fn: name }, b));
    var admin = window.__mailAdmin !== false;
    var me = (window.__WA_TEST_EMAIL || '').toLowerCase();
    if (b.action === 'settings') return Promise.resolve({ data: { settings: SETTINGS, key_present: true, domain: DOMAIN, domain_id: 'd1', webhook_id: null, mail_secret_present: true, webhook_secret_present: false, last30: { sent: 1, tests: 2, bounced: 0, suppressed: 1, failed: 0 }, admin: admin, me: me }, error: null });
    if (b.action === 'preview') return Promise.resolve({ data: { subject: 'Preview of ' + b.template_key, preheader: 'A line for the inbox', html: '<!DOCTYPE html><html><body><h1>The Hub can send email</h1><p>' + b.template_key + '</p></body></html>', text: 'Hi', kind: 'test' }, error: null });
    if (b.action === 'test') return Promise.resolve({ data: { send_id: 13, resend_id: 're_test', status: 'sent', to: b.to, subject: 'A test from the Welfare Avenue Hub' }, error: null });
    if (b.action === 'send') return Promise.resolve({ data: { send_id: 14, resend_id: 're_send', status: 'sent', to: 'amara.okafor@example.com', basis: 'express consent (the website form)' }, error: null });
    if (b.action === 'domain_verify') { DOMAIN.status = 'verified'; DOMAIN.records.forEach(function (r) { r.status = 'verified'; }); return Promise.resolve({ data: { domain: DOMAIN }, error: null }); }
    if (b.action === 'set_settings') { Object.keys(b).forEach(function (k) { if (k in SETTINGS) SETTINGS[k] = b[k]; }); return Promise.resolve({ data: { ok: true, changed: 1, settings: SETTINGS }, error: null }); }
    return Promise.resolve({ data: { ok: true }, error: null });
  };
})();`;
const patch = f => f.ev(() => { db.functions.invoke = window.__mailStub; return true; });
const tabState = f => f.ev(() => ({ hash: location.hash, tabs: [...document.querySelectorAll('#crm .w152tabs button')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')), root: !!document.querySelector('#crm .w152root') }));
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const text = (f, s) => f.ev(x => { const el = document.querySelector(x); return el ? el.innerText.replace(/\s+/g, ' ').trim() : null; }, s);

(async () => {
  const browser = await launch();
  /* ---------------- an admin ---------------- */
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), init: STUB, wait: 4000 });
  await patch(f);
  await f.hash('#crm/email', 2600);
  let s = await tabState(f);
  ok('the CRM opens on the Email tab (five tabs, Email marked)', s.tabs.length === 5 && /Email\*/.test(s.tabs[4]) && s.root, s);
  const stats = await f.ev(() => [...document.querySelectorAll('#crm .w154stats .w152st')].map(b => b.querySelector('b').textContent + ' ' + b.querySelector('span').textContent));
  ok('the permission numbers: 1 express, 1 implied, 1 with no permission (confirmations only), 2 unsubscribed or bouncing', stats.length === 4 && /^1 said yes/.test(stats[0]) && /^1 gave or served/.test(stats[1]) && /^1 with an address/.test(stats[2]) && /^2 unsubscribed/.test(stats[3]), stats);
  const card = await text(f, '#crm .w154card');
  ok('the sending card: domain waiting for its records, from info@, test mode with the two recipients, webhook not connected, the last 30 days', /Sending from welfareavenue.com/i.test(card) && /Waiting for the records/.test(card) && /Welfare Avenue <info@welfareavenue.com>/.test(card) && /Test mode/.test(card) && /steelmacdonald@gmail.com/.test(card) && /Not connected/.test(card) && /1 email sent, 2 tests/.test(card), card);
  const dns = await f.ev(() => [...document.querySelectorAll('#crm .w154dr')].map(r => ({ type: r.children[0].querySelector('b').textContent, host: r.children[1].querySelector('code').textContent, copies: r.querySelectorAll('[data-w152copy]').length, status: r.children[3].textContent.trim() })));
  ok('the DNS table: three records to add (DKIM TXT at resend._domainkey, MX and TXT at send), each with copy buttons and a status', dns.length === 3 && dns[0].type === 'TXT' && dns[0].host === 'resend._domainkey' && dns[1].type === 'MX' && dns[1].host === 'send' && dns[2].host === 'send' && dns.every(d => d.copies === 2 && /Waiting/.test(d.status)), dns);
  const acts = await f.ev(() => [...document.querySelectorAll('#crm .w154acts button')].map(b => b.textContent.trim()));
  ok('an admin gets Check the domain, Connect the webhook, Change the settings and Refresh implied consent (no Set up: the domain exists)', acts.join('|') === 'Check the domain|Connect the webhook|Change the settings|Refresh implied consent', acts);
  await shot(f, 'email_tab');
  /* the domain check */
  await click(f, '[data-w154act="domain_verify"]'); await f.page.waitForTimeout(600);
  const after = await text(f, '#crm .w154card');
  ok('Check the domain asks the function and the card shows the domain verified', /Verified/.test(after) && /Domain welfareavenue.com: verified/.test(after) && (await f.ev(() => window.__calls.some(c => c.action === 'domain_verify'))), after.slice(0, 300));
  /* the settings form */
  await click(f, '[data-w154cfg]'); await f.page.waitForTimeout(200);
  const form = await f.ev(() => ({ form: !!document.querySelector('#crm .w154form'), mode: (document.querySelector('#crm .w154form [data-f="mail_mode"]') || {}).value, fields: [...document.querySelectorAll('#crm .w154form [data-f]')].map(e => e.getAttribute('data-f')) }));
  ok('Change the settings opens the form: from name and address, reply-to, the mode (test), test recipients, the fundraising exemption, the postal address', form.form && form.mode === 'test' && form.fields.join('|') === 'mail_from_name|mail_from_email|mail_reply_to|mail_mode|mail_test_recipients|mail_fundraising_exemption|mail_postal_address', form);
  await f.ev(() => { document.querySelector('#crm .w154form [data-f="mail_mode"]').value = 'live'; });
  await click(f, '[data-w154savecfg]'); await f.page.waitForTimeout(700);
  const saved = await f.ev(() => ({ call: window.__calls.filter(c => c.action === 'set_settings').pop(), card: document.querySelector('#crm .w154card').innerText.replace(/\s+/g, ' ') }));
  ok('saving sends the settings to the function and the card shows Live', saved.call && saved.call.mail_mode === 'live' && /Live/.test(saved.card) && /Settings saved/.test(saved.card), saved.call);
  /* templates */
  const tpls = await f.ev(() => [...document.querySelectorAll('#crm .w154tpl')].map(t => t.querySelector('b').textContent + ' [' + t.querySelector('.w154chip').textContent.trim() + ']'));
  ok('five templates with their kind: test, three confirmations, one newsletter', tpls.length === 5 && /A test message \[Test\]/.test(tpls[0]) && /Welcome, new volunteer \[Confirmation\]/.test(tpls[1]) && /Newsletter \[Newsletter\]/.test(tpls[4]), tpls);
  await click(f, '[data-w154prev="test"]'); await f.page.waitForTimeout(600);
  const prev = await f.ev(() => { const fr = document.querySelector('#crm .w154frame'); return { frame: !!fr, srcdoc: fr ? fr.getAttribute('srcdoc').slice(0, 120) : '', subject: (document.querySelector('#crm .w154pv .m') || {}).innerText, call: window.__calls.filter(c => c.action === 'preview').pop() }; });
  ok('Preview asks the function for the rendered email and shows it in a sandboxed iframe with its subject', prev.frame && /The Hub can send email/.test(prev.srcdoc) && /Preview of test/.test(prev.subject || '') && prev.call && prev.call.template_key === 'test', prev);
  await shot(f, 'email_preview');
  const testBtn = await f.ev(() => !!document.querySelector('[data-w154test="test"]'));
  ok('Send me a test is offered to an admin whose address is a test recipient', testBtn);
  await click(f, '[data-w154test="test"]'); await f.page.waitForTimeout(700);
  const tst = await f.ev(() => ({ call: window.__calls.filter(c => c.action === 'test').pop(), msg: (document.querySelector('#crm .w154msg') || {}).innerText }));
  ok('the test goes to the admin’s own address only and the card reports it', tst.call && tst.call.to === 'steel.macdonald@welfareavenue.com' && tst.call.template_key === 'test' && /Test sent to steel.macdonald@welfareavenue.com/.test(tst.msg || ''), tst);
  /* the send log and the rule */
  const log = await f.ev(() => [...document.querySelectorAll('#crm .w154sr')].map(r => ({ to: r.children[1].innerText.replace(/\s+/g, ' ').trim(), tpl: r.children[2].innerText.replace(/\s+/g, ' ').trim(), what: r.children[3].innerText.replace(/\s+/g, ' ').trim(), link: !!r.querySelector('a') })));
  ok('the send log, newest first: a test to the admin, a newsletter held back for no consent, a delivered thank-you to Amara (opened)', log.length === 3 && /test/.test(log[0].what) && !log[0].link && /Not sent/.test(log[1].what) && /no consent recorded/.test(log[1].what) && log[1].link && /Amara Okafor/.test(log[2].to) && log[2].link && /Delivered/.test(log[2].what) && /opened/.test(log[2].what), log);
  const rule = await text(f, '#crm .w154rule');
  ok('the rule is spelled out with the charity number and the two-year implied consent', /713048502RR0001/.test(rule) && /two years/.test(rule) && /unsubscribed/.test(rule), (rule || '').slice(0, 200));
  const tile = await click(f, '[data-w154perm="express"]'); await f.page.waitForTimeout(900);
  const filt = await f.ev(() => ({ hash: location.hash, perm: window.w152.state().ui.perm, rows: document.querySelectorAll('#crm .w152row').length }));
  ok('a permission number opens the contacts filtered to it (express: Amara alone)', tile && filt.hash === '#crm' && filt.perm === 'express' && filt.rows === 1, filt);
  /* a contact's page */
  await f.hash('#crm/c/5001', 1500);
  const sheet = await f.ev(() => ({ open: !!document.getElementById('w152sheet') && document.getElementById('w152sheet').style.display !== 'none', perm: (document.querySelector('#w152sheet .w154perm') || {}).innerText, btn: !!document.querySelector('#w152sheet [data-w154send="5001"]'),
    tl: [...document.querySelectorAll('#w152sheet .w152it')].map(li => li.querySelector('.t').innerText.replace(/\s+/g, ' ').trim() + ' / ' + ((li.querySelector('.by') || {}).innerText || '').replace(/\s+/g, ' ').trim()), del: document.querySelectorAll('#w152sheet [data-w152delint]').length }));
  ok('Amara’s page: newsletters yes (express consent), confirmations yes, Send an email from the Hub offered', sheet.open && /Newsletters and appeals: yes \(express consent\)/.test(sheet.perm || '') && /Confirmations and reminders: yes/.test(sheet.perm || '') && sheet.btn, sheet.perm);
  ok('the email the Hub sent shows on her timeline with its status (Delivered) and who sent it, and cannot be deleted like a note', sheet.tl.some(t => /Email to them: Thank you, Amara.*Delivered/.test(t) && /Sent from the Hub \(Thank you for a gift\) by steel/.test(t)) && sheet.del === 1, sheet.tl);
  await shot(f, 'contact_permission');
  await click(f, '#w152sheet [data-w154send="5001"]'); await f.page.waitForTimeout(900);
  const mf = await f.ev(() => ({ h2: (document.querySelector('#w152sheet h2') || {}).innerText, opts: [...document.querySelectorAll('#w152sheet [data-w154tplsel] option')].map(o => o.value), allowed: /Allowed/.test(document.getElementById('w152sheet').innerText), frame: !!document.querySelector('#w152sheet .w154frame'), go: document.querySelector('#w152sheet [data-w154go]') && !document.querySelector('#w152sheet [data-w154go]').disabled, call: window.__calls.filter(c => c.action === 'preview').pop() }));
  ok('Send an email: the templates in use (no test template), the first one previewed for her, Allowed, Send now ready', /Send an email/.test(mf.h2 || '') && mf.opts.join('|') === 'welcome_volunteer|thank_you_gift|serving_reminder|newsletter' && mf.allowed && mf.frame && mf.go && mf.call && mf.call.contact_id === 5001 && mf.call.template_key === 'welcome_volunteer', mf);
  await f.ev(() => { const s = document.querySelector('#w152sheet [data-w154tplsel]'); s.value = 'newsletter'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await f.page.waitForTimeout(700);
  const nl = await f.ev(() => ({ allowed: /Allowed: express consent/.test(document.getElementById('w152sheet').innerText), go: !document.querySelector('#w152sheet [data-w154go]').disabled }));
  ok('a newsletter to her is allowed on her express consent', nl.allowed && nl.go, nl);
  await click(f, '#w152sheet [data-w154go]'); await f.page.waitForTimeout(1200);
  const sent = await f.ev(() => ({ call: window.__calls.filter(c => c.action === 'send').pop(), sheet: window.w152.state().sheet }));
  ok('Send now calls the function for her and the newsletter, then returns to her page', sent.call && sent.call.contact_id === 5001 && sent.call.template_key === 'newsletter' && sent.sheet === 'c:5001', sent);
  /* no consent: a newsletter is held back, a confirmation is allowed */
  await f.hash('#crm/c/5002', 1200);
  await click(f, '#w152sheet [data-w154send="5002"]'); await f.page.waitForTimeout(700);
  await f.ev(() => { const s = document.querySelector('#w152sheet [data-w154tplsel]'); s.value = 'newsletter'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await f.page.waitForTimeout(700);
  const held = await f.ev(() => ({ held: /Held back/.test(document.getElementById('w152sheet').innerText), why: /no permission recorded/.test(document.getElementById('w152sheet').innerText), go: document.querySelector('#w152sheet [data-w154go]').disabled, live: !/test mode/.test(document.getElementById('w152sheet').innerText) }));
  ok('a newsletter to someone with no permission is held back and Send now is disabled', held.held && held.why && held.go, held);
  await f.ev(() => { const s = document.querySelector('#w152sheet [data-w154tplsel]'); s.value = 'welcome_volunteer'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await f.page.waitForTimeout(700);
  const conf = await f.ev(() => ({ allowed: /Allowed: a confirmation or reminder/.test(document.getElementById('w152sheet').innerText), go: !document.querySelector('#w152sheet [data-w154go]').disabled }));
  ok('a confirmation to the same person is allowed (not a commercial message)', conf.allowed && conf.go, conf);
  await f.hash('#crm/c/5004', 1200);
  const bounced = await f.ev(() => ({ btn: !!document.querySelector('#w152sheet [data-w154send="5004"]'), perm: (document.querySelector('#w152sheet .w154perm') || {}).innerText }));
  ok('a bouncing address gets no Send button and the line says no to everything', !bounced.btn && /Newsletters and appeals: no \(the address bounces\)/.test(bounced.perm || '') && /Confirmations and reminders: no/.test(bounced.perm || ''), bounced);
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- a member on the HR profile ---------------- */
  f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(), init: STUB + 'window.__mailAdmin = false;', wait: 4000 });
  await patch(f);
  await f.hash('#crm/email', 2600);
  const m = await f.ev(() => ({ tabs: document.querySelectorAll('#crm .w152tabs button').length, card: !!document.querySelector('#crm .w154card'), acts: [...document.querySelectorAll('#crm .w154acts button')].map(b => b.textContent.trim()), test: !!document.querySelector('[data-w154test]'), edit: !!document.querySelector('[data-w154edit]'), dns: document.querySelectorAll('#crm .w154dr').length }));
  ok('a member with the CRM sees the Email tab and the sending card, without the admin buttons, the edit buttons or Send me a test (not a test recipient)', m.tabs === 5 && m.card && m.acts.length === 0 && !m.test && !m.edit && m.dns === 3, m);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- a director ---------------- */
  f = await fresh(browser, { who: 'board', hash: '#crm/email', fixture: fixture(), init: STUB, wait: 4000 });
  const b = await f.ev(() => ({ root: (document.querySelector('#crm .w152root') || {}).innerText || '', tab: getComputedStyle(document.querySelector('[data-tab="crm"]') || document.body).display }));
  ok('a director gets nothing of the CRM', /for the Welfare Avenue team/.test(b.root) || b.root === '', b);
  ok('no page errors (board)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- a phone ---------------- */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(), init: STUB, wait: 4200 });
  await patch(f);
  await f.hash('#crm/email', 2800);
  const p = await f.ev(() => { const g = document.querySelector('#crm .w154grid'); const cols = g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0; const dns = document.querySelector('#crm .w154dr'); return { cols, dns: !!dns, wide: document.documentElement.scrollWidth <= window.innerWidth + 1, tab: /Email/.test((document.querySelector('#crm .w152tabs button.on') || {}).innerText || '') }; });
  ok('on a phone the Email tab stacks in one column, the DNS table is there and nothing overflows sideways', p.cols === 1 && p.dns && p.wide && p.tab, p);
  await shot(f, 'email_phone');
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  out.forEach(l => console.log(l));
  console.log('\nw154drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
