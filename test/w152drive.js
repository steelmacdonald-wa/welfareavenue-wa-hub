/* w152drive.js: the CRM (wave152). Fixture rows are made up for the test (no real people).
   A staff admin finds contacts (kinds, roles, activity, permission, search by name, accent or phone), opens one (details,
   what they did with us, email permission, tags, one timeline), logs a note, tags, edits (a volunteer's details go to their
   volunteer record too), records the email permission, links an organization, adds a contact (an email already in the CRM is
   caught), keeps one of two duplicates or marks them as different people, and reads the sources. A member on the HR profile
   sees the CRM while the page is undecided; a member whose profile says none, or whose own tab list leaves it out, does not;
   a director never sees it and loads nothing; at phone width nothing scrolls sideways.
   usage: node test/w152drive.js   (SHOTS=<dir> also saves screenshots) */
const { launch, fresh, loadFixture } = require('./boot');
const fs = require('fs');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: !!full }); }

function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['volunteer'], tags: [], source: 'django_website_export', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'wa150_backfill', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [] }, o || {});
}
function crmFixture(extra) {
  const fx = loadFixture();
  const rows = [
    C(5001, 'Amara Okafor', { emails: ['amara.okafor@example.com'], primary_email: 'amara.okafor@example.com', phones: ['514-555-0101'], volunteer_id: 9001, volunteer_roles: ['cook', 'server'], hub_servings: 5, last_serving_on: '2026-09-13',
      legacy_servings: 3, legacy_hours: 9, email_consent: 'express', consent_source: 'the website volunteer form', consent_at: '2025-05-01T12:00:00Z', tags: ['french speaker'], address: '12 Rue Example', city: 'Montreal', province: 'QC', language: 'fr', last_applied: '2025-04-20', volunteer_organization: 'Concordia' }),
    C(5002, 'Luc Tremblay', { phones: ['(438) 555-0102'], volunteer_id: 9002, volunteer_roles: ['driver'], volunteer_needs_review: true }),
    C(5003, 'Priya Raman', { kinds: ['donor'], source: 'hub', emails: ['priya.r@example.org'], primary_email: 'priya.r@example.org', donation_total: 350, donation_count: 3, last_donation_at: '2026-08-30T15:00:00Z', email_consent: 'implied', implied_consent_until: '2028-08-30' }),
    C(5004, 'Jordan Mensah', { kinds: ['partner'], source: 'hub', emails: ['jordan@sportira.example'], primary_email: 'jordan@sportira.example', phones: ['514 555 0104'], org_names: ['Sportira'] }),
    C(5005, 'Élodie Gagnon', { emails: ['elodie.gagnon@example.com'], primary_email: 'elodie.gagnon@example.com', volunteer_id: 9005, volunteer_roles: ['photographer'], hub_servings: 2, last_serving_on: '2026-06-14', email_status: 'unsubscribed', email_consent: 'express' }),
    C(5006, 'Samuel Osei', { kinds: ['staff', 'volunteer'], source: 'hub_roster', emails: ['samuel.osei@welfareavenue.example'], primary_email: 'samuel.osei@welfareavenue.example', volunteer_id: 9006, member_id: 18, volunteer_roles: ['team_leader'], hub_servings: 8, last_serving_on: '2026-09-13' }),
    C(5007, 'Nadia Haddad', { kinds: ['alumni'], source: 'hub_roster', emails: ['nadia.h@example.com'], primary_email: 'nadia.h@example.com', email_consent: 'implied', implied_consent_until: '2025-01-01' }),
    C(5008, 'Amara Okafor', { emails: ['amara.okafor@example.com'], primary_email: 'amara.okafor@example.com', phones: ['514 555 0101'], volunteer_id: 9008, volunteer_roles: ['server'], created_at: '2026-08-02T10:00:00Z', source: 'hub_volunteers' }),
    C(5009, 'Kevin Tremblay', { phones: ['(438) 555-0102'], volunteer_id: 9009, volunteer_roles: ['server'] })
  ];
  const FN = ['Alex', 'Sam', 'Maya', 'Omar', 'Chloé', 'Yusuf', 'Lina', 'Noah', 'Zara', 'Ethan'], LN = ['Martin', 'Roy', 'Côté', 'Bouchard', 'Singh', 'Nguyen', 'Diallo', 'Lee'];
  const RL = ['cook', 'server', 'driver', 'dishwasher', 'server', 'cook', 'photographer', 'server'];
  let n = 0;
  FN.forEach((a, i) => LN.forEach((b, j) => {
    n++;
    const served = (i * 3 + j) % 7;
    rows.push(C(6000 + n, a + ' ' + b, { emails: [(a + '.' + b).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@example.net'], phones: n % 3 ? ['514 555 ' + String(1000 + n)] : [],
      volunteer_id: 9100 + n, volunteer_roles: [RL[(i + j) % RL.length]], hub_servings: served, last_serving_on: served ? '2026-0' + (1 + (n % 8)) + '-1' + (n % 9) : null,
      created_at: n % 11 === 0 ? '2026-09-10T12:00:00Z' : '2026-07-27T14:00:00Z' }));
  }));
  /* more than one page of contacts (the API answers 1,000 a call) */
  for (let k = 0; k < 960; k++) rows.push(C(7000 + k, 'Page Two ' + k, { emails: ['page.two.' + k + '@example.net'], volunteer_id: 9500 + k, volunteer_roles: ['server'] }));
  rows[0].legacy_refs = { keela: { contact_id: 'k1', positions: ['Volunteer Server', 'Photographer'], try_out_date: '2025-05-04', availability: ['November 15th, 2026', 'November 29th, 2026'], email_marketing: { sent: 12, opened: 7, last_opened: '2026-09-01' } } };
  fx.crm_contacts_v = rows;
  fx.crm_duplicates_v = [
    { contact_id: 5001, duplicate_id: 5008, matched_on: 'email', value: 'amara.okafor@example.com' },
    { contact_id: 5001, duplicate_id: 5008, matched_on: 'phone', value: '514-555-0101' },
    { contact_id: 5002, duplicate_id: 5009, matched_on: 'phone', value: '(438) 555-0102' }
  ];
  fx.crm_interactions = [
    { id: 71, contact_id: 5001, kind: 'note', direction: 'internal', channel: null, subject: null, body: 'Prefers the Sunday morning shift.', occurred_at: '2026-08-20T15:00:00Z', source: 'hub', source_ref: null, meta: null, created_at: '2026-08-20T15:00:00Z', created_by: 'someone.else@welfareavenue.com' },
    { id: 72, contact_id: 5001, kind: 'email', direction: 'in', channel: 'email', subject: 'Can I bring a friend?', body: 'My roommate wants to volunteer too.', occurred_at: '2026-09-02T13:00:00Z', source: 'hub', source_ref: null, meta: null, created_at: '2026-09-02T13:00:00Z', created_by: 'steel.macdonald@welfareavenue.com' },
    { id: 73, contact_id: 5001, kind: 'website_message', direction: 'in', channel: 'website', subject: 'Volunteering question', body: 'Do you need cooks in October?', occurred_at: '2026-07-01T13:00:00Z', source: 'website', source_ref: 'contact-18', meta: null, created_at: '2026-07-01T13:00:00Z', created_by: 'crm_sync' },
    { id: 74, contact_id: 5001, kind: 'website_message', direction: 'in', channel: 'website', subject: 'Cook', body: 'Can I cook food 22 December', occurred_at: '2000-01-01T00:00:00Z', source: 'website', source_ref: 'contactform:279', meta: { undated: true, legacy_ids: [279, 280], times_submitted: 2 }, created_at: '2026-09-27T22:00:00Z', created_by: 'wa152_import' }
  ];
  fx.crm_donations = [
    { id: 81, contact_id: 5003, amount: 100, currency: 'CAD', donated_at: '2026-08-30T15:00:00Z', platform: 'zeffy', campaign: 'Back to school meals', designation: null, recurring: false, receipt_number: 'WA-2026-0042', receipt_issued_at: '2026-08-30T15:01:00Z', receipt_url: 'https://example.com/receipt', notes: null },
    { id: 82, contact_id: 5003, amount: 125, currency: 'CAD', donated_at: '2026-05-01T15:00:00Z', platform: 'zeffy', campaign: null, designation: null, recurring: false, receipt_number: null, receipt_issued_at: null, receipt_url: null, notes: null },
    { id: 83, contact_id: 5003, amount: 125, currency: 'CAD', donated_at: '2025-12-01T15:00:00Z', platform: 'zeffy', campaign: 'Winter drive', designation: null, recurring: false, receipt_number: null, receipt_issued_at: null, receipt_url: null, notes: null }
  ];
  fx.crm_volunteer_history = [
    { id: 91, contact_id: 5001, volunteer_id: 9001, source: 'django', legacy_assignment_id: 1, legacy_event_id: 10, legacy_volunteer_id: 100, event_at: '2025-03-02T16:00:00Z', event_title: 'Sunday serving', city: 'Montreal', location: 'Cabot Square', position: 'Cook', approved: true, confirmed: true, attended: true, hours: 3, withdrawn: false, waitlisted: false },
    { id: 92, contact_id: 5001, volunteer_id: 9001, source: 'django', legacy_assignment_id: 2, legacy_event_id: 11, legacy_volunteer_id: 100, event_at: '2025-04-06T16:00:00Z', event_title: 'Sunday serving', city: 'Montreal', location: 'Cabot Square', position: 'Server', approved: true, confirmed: false, attended: false, hours: null, withdrawn: true, waitlisted: false },
    { id: 93, contact_id: 5001, volunteer_id: 9001, source: 'django', legacy_assignment_id: 3, legacy_event_id: 12, legacy_volunteer_id: 100, event_at: '2024-11-10T17:00:00Z', event_title: 'OPEN TO EVERYONE', city: 'Montreal', location: 'Berri-UQAM', position: 'driver', approved: true, confirmed: true, attended: true, hours: 2, withdrawn: null, waitlisted: false, volunteer_event_id: 9104 }
  ];
  fx.volunteer_events = (fx.volunteer_events || []).concat([
    { id: 9101, code: 'T1', event_date: '2026-09-13', season: 'fall', location: 'Montreal', notes: null, status: 'completed', kind: 'service', title: 'Sunday serving', itinerary_url: null, planned_meals: 200, plan_note: null },
    { id: 9102, code: 'T2', event_date: '2026-10-04', season: 'fall', location: 'Montreal', notes: null, status: 'planned', kind: 'service', title: 'Sunday serving', itinerary_url: null, planned_meals: 200, plan_note: null },
    { id: 9103, code: 'T3', event_date: '2026-08-16', season: 'summer', location: 'Montreal', notes: null, status: 'completed', kind: 'service', title: 'Sunday serving', itinerary_url: null, planned_meals: 200, plan_note: null },
    { id: 9104, code: 'WA-24-20', event_date: '2024-11-10', season: 'Fall', location: 'Montreal', notes: 'From the old website (event 12) at Berri-UQAM', status: 'completed', kind: 'service', title: null, itinerary_url: null, planned_meals: null, plan_note: null }
  ]);
  fx.event_roster = (fx.event_roster || []).concat([
    { id: 99001, event_id: 9101, person_id: 9001, person_name: 'Amara Okafor', role: 'cook', status: 'Confirmed', notes: null, detail: null, sort: 1, confirm_token: null, confirm_status: null, confirmed_at: null, confirm: null, recipe_id: null },
    { id: 99002, event_id: 9102, person_id: 9001, person_name: 'Amara Okafor', role: 'server', status: 'Confirmed', notes: null, detail: null, sort: 1, confirm_token: null, confirm_status: null, confirmed_at: null, confirm: null, recipe_id: null },
    { id: 99003, event_id: 9103, person_id: 9001, person_name: 'Amara Okafor', role: 'cook', status: 'Unavailable', notes: null, detail: null, sort: 1, confirm_token: null, confirm_status: null, confirmed_at: null, confirm: null, recipe_id: null },
    { id: 99004, event_id: 9104, person_id: 9001, person_name: 'Amara Okafor', role: 'driver', status: 'Confirmed', notes: null, detail: { source: 'old website', legacy_assignment_id: 3, hours: 2 }, sort: 0, confirm_token: null, confirm_status: null, confirmed_at: '2024-11-10T17:00:00Z', confirm: null, recipe_id: null }
  ]);
  fx.wa_partners = [{ id: 11, key: 'p-11', name: 'Sportira', aka: [], status: 'active', visibility: 'everyone' }, { id: 12, key: 'p-12', name: 'Vanier College Student Association', aka: [], status: 'active', visibility: 'everyone' }];
  fx.crm_contact_orgs = [{ id: 1, contact_id: 5004, partner_id: 11, role_title: 'Events lead', is_primary: true, notes: null, created_at: '2026-09-01T12:00:00Z', created_by: 'steel.macdonald@welfareavenue.com' }];
  if (extra) extra(fx);
  return fx;
}
const MOCK = `(function(){
  window.__W = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.from || db.from.__w) return;
    var of = db.from.bind(db), orpc = db.rpc.bind(db);
    var f = function (table) { var b = of(table);
      ['update', 'insert', 'upsert'].forEach(function (op) { var o = b[op].bind(b); b[op] = function (p, x) { window.__W.push({ table: table, op: op, p: JSON.parse(JSON.stringify(p)) }); return o(p, x); }; });
      var od = b.delete.bind(b); b.delete = function () { window.__W.push({ table: table, op: 'delete' }); return od(); };
      return b; };
    f.__w = 1; db.from = f;
    db.rpc = function (fn, args) { window.__W.push({ rpc: fn, args: args }); return orpc(fn, args); };
  }, 5); })();`;
const W = f => f.ev(() => window.__W);
async function typeQ(f, v) { await f.ev(a => { const i = document.querySelector('[data-w152q]'); i.value = a; i.dispatchEvent(new Event('input', { bubbles: true })); }, v); await f.page.waitForTimeout(450); }
async function sel(f, attr, v) { await f.ev(a => { const s = document.querySelector('[' + a[0] + ']'); s.value = a[1]; s.dispatchEvent(new Event('change', { bubbles: true })); }, [attr, v]); await f.page.waitForTimeout(200); }
const names = f => f.ev(() => [...document.querySelectorAll('#crm .w152row .nm')].map(x => x.textContent));
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const sheet = f => f.ev(() => { const s = document.getElementById('w152sheet'); return s && s.style.display !== 'none' ? s.innerText : ''; });

(async () => {
  const browser = await launch();
  /* ---------------- an admin (Steel) ---------------- */
  let f = await fresh(browser, { who: 'admin', hash: '#crm', fixture: crmFixture(), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(500);
  const m = await f.ev(() => {
    const b = document.querySelector('#tabBar .tab[data-tab="crm"]');
    const g = b && b.closest('.tab-group'); const hdr = g && g.querySelector('.tab-group-h');
    return { btn: !!b, shown: !!b && b.style.display !== 'none', label: b && b.textContent.trim(), group: g && g.getAttribute('data-w42g'), hdr: hdr && hdr.textContent.trim(),
      order: g ? [...g.querySelectorAll('.tab')].map(x => x.getAttribute('data-tab')) : [], layoutOk: !!(window.w134 && window.w134.ok && window.w134.ok()) };
  });
  ok('wave163: the CRM button sits with the apps\' pages, which wave153 keeps out of the menu (the CRM opens from Apps)', m.label === 'CRM' && m.group === 'apps' && m.order.indexOf('crm') >= 0 && m.order.indexOf('partners') >= 0, m);
  ok('the menu layout still holds (w134.ok)', m.layoutOk, m);
  const a = await f.ev(() => ({
    active: document.getElementById('crm') && document.getElementById('crm').classList.contains('active'),
    crumb: (document.querySelector('#crm > .w118mast .crumb') || {}).textContent, h1: (document.querySelector('#crm > .w118mast h1') || {}).textContent,
    stats: [...document.querySelectorAll('#crm .w152st b')].map(b => b.textContent), statTxt: [...document.querySelectorAll('#crm .w152st span')].map(b => b.textContent),
    tabs: [...document.querySelectorAll('#crm .w152tabs button')].map(b => b.textContent.trim()), rows: document.querySelectorAll('#crm .w152row').length,
    more: ((document.querySelector('#crm [data-w152more]') || {}).textContent || '').trim(), count: (document.querySelector('#crm .w152count') || {}).textContent,
    chips: [...document.querySelectorAll('#crm [data-w152kind]')].map(b => b.textContent.trim())
  }));
  ok('#crm opens the CRM with its masthead (the crumb names Apps; in the app the app bar names it)', a.active && a.crumb === 'Apps' && a.h1 === 'CRM', a);
  ok('the numbers: contacts (more than one page), volunteers, who served, donors', a.stats.join('|') === '1,049|1,046|71|1' && /donors/.test(a.statTxt[3] || ''), a);
  ok('ten tabs, with the duplicate pairs counted (Gifts since wave153, Email since wave154, Lists and Campaigns since wave155, Forms since wave156, Automations since wave157, Reports since wave160)', a.tabs.length === 10 && /Forms/.test(a.tabs[7]) && /Automations/.test(a.tabs[8]) && /Reports/.test(a.tabs[9]) && /Lists/.test(a.tabs[5]) && /Campaigns/.test(a.tabs[6]) && /Possible duplicates\s*2/.test(a.tabs[1]) && /Sources/.test(a.tabs[2]) && /Gifts/.test(a.tabs[3]) && /Email/.test(a.tabs[4]), a.tabs);
  ok('the list shows 60 at a time, with Show more', a.rows === 60 && /Show 60 more/.test(a.more) && /1,049 contacts/.test(a.count), a);
  ok('a chip per kind that has people, with counts', a.chips.some(c => /^Volunteer\s*1046$/.test(c)) && a.chips.some(c => /^Donor\s*1$/.test(c)) && a.chips.some(c => /^Partner contact\s*1$/.test(c)) && a.chips.some(c => /^Staff\s*1$/.test(c)) && a.chips.some(c => /^Alumni\s*1$/.test(c)), a.chips);
  let nm = await names(f);
  ok('recently active first (Amara and Samuel served on 13 Sep)', nm.indexOf('Amara Okafor') >= 0 && nm.indexOf('Amara Okafor') < 2 && nm.indexOf('Samuel Osei') < 2, nm.slice(0, 5));
  await shot(f, 'crm_list');
  await click(f, '#crm [data-w152more]'); await f.page.waitForTimeout(200);
  ok('Show more shows more', (await f.ev(() => document.querySelectorAll('#crm .w152row').length)) === 120);
  await typeQ(f, 'okafor'); nm = await names(f);
  ok('search finds both Amara Okafors', nm.length === 2 && nm.every(x => x === 'Amara Okafor'), nm);
  await typeQ(f, 'elodie'); nm = await names(f);
  ok('search ignores accents (elodie finds Élodie)', nm.length === 1 && nm[0] === 'Élodie Gagnon', nm);
  await typeQ(f, '438 555'); nm = await names(f);
  ok('a phone number finds the people with it, whatever its format', nm.length === 2 && nm.indexOf('Luc Tremblay') >= 0 && nm.indexOf('Kevin Tremblay') >= 0, nm);
  await typeQ(f, 'sportira'); nm = await names(f);
  ok('an organization finds its contacts', nm.length === 1 && nm[0] === 'Jordan Mensah', nm);
  await typeQ(f, '');
  await click(f, '#crm [data-w152kind="donor"]'); await f.page.waitForTimeout(150); nm = await names(f);
  ok('the Donor chip shows the donors', nm.length === 1 && nm[0] === 'Priya Raman', nm);
  await click(f, '#crm [data-w152kind=""]'); await f.page.waitForTimeout(150);
  await sel(f, 'data-w152role', 'photographer');
  const ph = await f.ev(() => [...document.querySelectorAll('#crm .w152row')].map(r => r.querySelector('.rl').textContent));
  ok('a volunteer role narrows the list to it', ph.length > 1 && ph.every(t => /Photographer/.test(t)), ph);
  await sel(f, 'data-w152role', '');
  await sel(f, 'data-w152perm', 'unsub'); nm = await names(f);
  ok('the permission filter finds who unsubscribed', nm.length === 1 && nm[0] === 'Élodie Gagnon', nm);
  await sel(f, 'data-w152perm', 'unknown'); await typeQ(f, 'haddad'); nm = await names(f);
  const nmI = await (async () => { await sel(f, 'data-w152perm', 'implied'); const a = await names(f); await typeQ(f, 'raman'); return [a, await names(f)]; })();
  ok('an implied consent that ran out counts as not recorded, one that has not as implied', nm.join() === 'Nadia Haddad' && nmI[0].length === 0 && nmI[1].join() === 'Priya Raman', [nm, nmI]);
  await typeQ(f, ''); await sel(f, 'data-w152perm', '');
  await sel(f, 'data-w152act', 'review'); nm = await names(f);
  ok('Volunteer record needs a review finds the flagged one', nm.length === 1 && nm[0] === 'Luc Tremblay', nm);
  await sel(f, 'data-w152act', '');
  await sel(f, 'data-w152sort', 'name'); nm = await names(f);
  ok('sort by name', nm[0] === 'Alex Bouchard', nm.slice(0, 3));
  await sel(f, 'data-w152sort', 'recent');
  await click(f, '#crm [data-w152set="served"]'); await f.page.waitForTimeout(150);
  ok('a number narrows the list (who served)', (await f.ev(() => document.querySelectorAll('#crm .w152row').length)) === 60 && (await f.ev(() => /71 contacts match/.test(document.querySelector('#crm .w152count').textContent))));
  await click(f, '#crm [data-w152clear]'); await f.page.waitForTimeout(150);

  /* ---------- a contact's page ---------- */
  await click(f, '#crm [data-w152open="5001"]'); await f.page.waitForTimeout(700);
  let s = await sheet(f);
  const h = await f.ev(() => ({ hash: location.hash, perm: (document.querySelector('#w152sheet .w152hd .w152pm') || {}).textContent, links: [...document.querySelectorAll('#w152sheet .w152qa a')].map(a => a.getAttribute('href')),
    tl: [...document.querySelectorAll('#w152sheet .w152it .t')].map(t => t.childNodes[0].textContent), tld: [...document.querySelectorAll('#w152sheet .w152it .t .d')].map(t => t.textContent), by: [...document.querySelectorAll('#w152sheet .w152it .by span')].map(t => t.textContent) }));
  ok('a contact opens at #crm/c/<id>, with their name and email permission', h.hash === '#crm/c/5001' && /Amara Okafor/.test(s) && h.perm === 'Express consent', h);
  ok('Email, Call and Text buttons use their email and phone', h.links.join(' ') === 'mailto:amara.okafor@example.com tel:+15145550101 sms:+15145550101', h.links);
  ok('their details: emails, phone, address, language, school', /amara\.okafor@example\.com/.test(s) && /514-555-0101/.test(s) && /12 Rue Example · Montreal, QC/.test(s) && /French/.test(s) && /Concordia/.test(s), s.slice(0, 600));
  ok('what they did with us: roles, servings, the old website', /5 servings with us \(MTL volunteering\), the last on 13 Sep 2026/.test(s) && /3 servings on the old website, not yet in MTL volunteering \(9 hours\)/.test(s) && /Cook/.test(s), s.slice(0, 900));
  ok('what Keela knew shows in one line', /From Keela: chose Server and Photographer · try-out 4 May 2025 · available November 15th, 2026 and November 29th, 2026 · opened 7 of 12 newsletters, last on 1 Sep 2026/.test(s), s.slice(0, 1200));
  ok('the timeline mixes the roster, the old website, emails, notes and website messages, newest first',
    h.tl[0] === 'Confirmed as Server' && h.tl.indexOf('Served as Cook') > 0 && h.tl.indexOf('Email from them: Can I bring a friend?') > 0 && h.tl.indexOf('Note') > 0 && h.tl.indexOf('Message from the website: Volunteering question') > 0 && h.tl.indexOf('Withdrew') > 0 && h.tl.indexOf('Could not come (Cook)') > 0 && h.tl.indexOf('Withdrew') < h.tl.lastIndexOf('Served as Cook') && h.tl.lastIndexOf('Served as Cook') < h.tl.indexOf('Served as Driver'), h.tl);
  ok('a serving the old website recorded shows once, through the Hub roster, with its hours', h.tl.filter(t => t === 'Served as Driver').length === 1 && h.by.indexOf('The old website, now in MTL volunteering') >= 0 && /Serving · Montreal · 2 hours/.test(s), { tl: h.tl, by: h.by });
  ok('a message the old website kept without a date comes last, and says so', h.tl[h.tl.length - 1] === 'Message from the old website: Cook' && h.tld[h.tld.length - 1] === 'date not recorded' && h.by.indexOf('The old website (the form kept no date)') >= 0, { tl: h.tl, tld: h.tld });
  await shot(f, 'crm_contact');
  /* log a note */
  await f.ev(() => { const s = document.getElementById('w152sheet'); s.querySelector('[data-w152logk]').value = 'call'; s.querySelector('[data-w152logt]').value = 'Called to confirm the October serving.'; s.querySelector('[data-w152log]').click(); });
  await f.page.waitForTimeout(400);
  let w = await W(f);
  const li = w.filter(x => x.table === 'crm_interactions' && x.op === 'insert');
  ok('logging a call writes crm_interactions (kind, direction, who, source hub)', li.length === 1 && li[0].p.kind === 'call' && li[0].p.direction === 'out' && li[0].p.contact_id === 5001 && li[0].p.source === 'hub' && li[0].p.created_by === 'steel.macdonald@welfareavenue.com', li);
  s = await sheet(f);
  ok('the call shows at the top of the timeline, with a Delete for its author', /Called to confirm the October serving\./.test(s) && (await f.ev(() => document.querySelectorAll('#w152sheet [data-w152delint]').length)) >= 2, s.slice(0, 200));
  /* a tag */
  await f.ev(() => { const i = document.querySelector('#w152sheet [data-w152tagin]'); i.value = 'Backup Driver'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  await f.page.waitForTimeout(350);
  w = await W(f);
  const tg = w.filter(x => x.table === 'crm_contacts' && x.op === 'update' && x.p.tags);
  ok('Enter adds a tag (lower case) to crm_contacts', tg.length === 1 && JSON.stringify(tg[0].p.tags) === '["french speaker","backup driver"]', tg);
  ok('the tag shows on their page', /backup driver/.test(await sheet(f)));
  /* edit: a volunteer's details go to their volunteer record too */
  await click(f, '#w152sheet [data-w152edit="5001"]'); await f.page.waitForTimeout(250);
  const e0 = await f.ev(() => { const s = document.getElementById('w152sheet'); const v = n => (s.querySelector('[data-f="' + n + '"]') || {}).value; return { name: v('full_name'), emails: v('emails'), phones: v('phones'), note: !!s.querySelector('.w152form .note'), kinds: [...s.querySelectorAll('[data-fk]')].map(x => x.getAttribute('data-fk')) }; });
  ok('the edit form opens with their details, says the volunteer record follows, and offers the hand-set kinds only', e0.name === 'Amara Okafor' && e0.emails === 'amara.okafor@example.com' && e0.phones === '514-555-0101' && e0.note && e0.kinds.join(',') === 'donor,partner,supporter,board', e0);
  await f.ev(() => { const s = document.getElementById('w152sheet'); s.querySelector('[data-f="emails"]').value = 'amara.okafor@example.com, not an email'; s.querySelector('[data-w152save]').click(); });
  await f.page.waitForTimeout(250);
  ok('a wrong email is refused', /does not look like an email: not an email/.test((await f.ev(() => (document.querySelector('#w152sheet [data-w152err]') || {}).textContent)) || ''));
  await f.ev(() => { const s = document.getElementById('w152sheet'); s.querySelector('[data-f="emails"]').value = 'Amara.Okafor@example.com, amara@work.example'; s.querySelector('[data-f="phones"]').value = '514-555-0101, 514 555 0199'; s.querySelector('[data-fk="donor"]').checked = true; s.querySelector('[data-w152save]').click(); });
  await f.page.waitForTimeout(500);
  w = await W(f);
  const vu = w.filter(x => x.table === 'volunteer_people' && x.op === 'update'), cu = w.filter(x => x.table === 'crm_contacts' && x.op === 'update' && x.p.full_name);
  ok('saving updates their volunteer record (name, emails, phones, address)', vu.length === 1 && JSON.stringify(vu[0].p.emails) === '["amara.okafor@example.com","amara@work.example"]' && vu[0].p.phones.length === 2 && vu[0].p.address === '12 Rue Example', vu);
  ok('and the contact, keeping volunteer and adding donor', cu.length === 1 && cu[0].p.kinds.join(',') === 'volunteer,donor' && cu[0].p.first_name === 'Amara' && cu[0].p.language === 'fr' && cu[0].p.updated_by === 'steel.macdonald@welfareavenue.com', cu);
  s = await sheet(f);
  ok('back on their page with the new details and kinds', /amara@work\.example/.test(s) && /514 555 0199/.test(s) && (await f.ev(() => [...document.querySelectorAll('#w152sheet .w152hd .w152kd')].map(k => k.textContent).join(','))) === 'Volunteer,Donor', s.slice(0, 300));
  /* the email permission */
  await click(f, '#w152sheet [data-w152perm-edit="5001"]'); await f.page.waitForTimeout(250);
  await f.ev(() => { const s = document.getElementById('w152sheet'); s.querySelector('[data-f="email_consent"]').value = 'implied'; s.querySelector('[data-f="implied_consent_until"]').value = ''; s.querySelector('[data-w152savep]').click(); });
  await f.page.waitForTimeout(250);
  ok('implied consent needs its end date', /until when/.test((await f.ev(() => (document.querySelector('#w152sheet [data-w152err]') || {}).textContent)) || ''));
  await f.ev(() => { const s = document.getElementById('w152sheet'); s.querySelector('[data-f="implied_consent_until"]').value = '2028-09-13'; s.querySelector('[data-f="consent_source"]').value = 'volunteering'; s.querySelector('[data-w152savep]').click(); });
  await f.page.waitForTimeout(400);
  w = await W(f);
  const pu = w.filter(x => x.table === 'crm_contacts' && x.op === 'update' && 'email_consent' in x.p);
  const lg = w.filter(x => x.table === 'change_log' && x.p.field === 'email_permission');
  ok('the permission saves on the contact and in the audit trail', pu.length === 1 && pu[0].p.email_consent === 'implied' && pu[0].p.implied_consent_until === '2028-09-13' && pu[0].p.consent_source === 'volunteering' && lg.length === 1 && lg[0].p.entity_type === 'crm_contact' && /Express consent/.test(lg[0].p.old_value) && /Implied consent/.test(lg[0].p.new_value), { pu, lg });
  ok('their page shows the implied consent and when it runs out', /Implied consent/.test(await sheet(f)) && /Runs until 13 Sep 2028/.test(await sheet(f)));
  /* link an organization */
  await click(f, '#w152sheet [data-w152linkorg="5001"]'); await f.page.waitForTimeout(400);
  await f.ev(() => { const s = document.getElementById('w152sheet'); s.querySelector('[data-f="partner_id"]').value = '12'; s.querySelector('[data-f="role_title"]').value = 'Club president'; s.querySelector('[data-w152saveorg]').click(); });
  await f.page.waitForTimeout(400);
  w = await W(f);
  const oi = w.filter(x => x.table === 'crm_contact_orgs' && x.op === 'insert');
  ok('linking an organization writes crm_contact_orgs', oi.length === 1 && oi[0].p.partner_id === 12 && oi[0].p.role_title === 'Club president', oi);
  ok('the organization shows on their page and opens Partners', /Vanier College Student Association/.test(await sheet(f)) && (await f.ev(() => !!document.querySelector('#w152sheet [data-w152go="#partners/12"]'))));
  await click(f, '#w152sheet [data-w152close]'); await f.page.waitForTimeout(200);
  ok('closing puts the address back to #crm', (await f.ev(() => location.hash)) === '#crm');

  /* ---------- add a contact ---------- */
  await click(f, '#crm [data-w152add]'); await f.page.waitForTimeout(250);
  await f.ev(() => { const s = document.getElementById('w152sheet'); s.querySelector('[data-f="full_name"]').value = 'Priya R.'; s.querySelector('[data-f="emails"]').value = 'priya.r@example.org'; s.querySelector('[data-fk="donor"]').checked = true; s.querySelector('[data-w152save]').click(); });
  await f.page.waitForTimeout(300);
  let wn = await f.ev(() => ((document.querySelector('#w152sheet .w152warn') || {}).textContent || ''));
  ok('an email already in the CRM is caught before adding', /Already in the CRM\?/.test(wn) && /Priya Raman/.test(wn) && (await W(f)).filter(x => x.table === 'crm_contacts' && x.op === 'insert').length === 0, wn);
  await f.ev(() => { const s = document.getElementById('w152sheet'); s.querySelector('[data-fk="volunteer"]').checked = true; s.querySelector('[data-w152save]').click(); });
  await f.page.waitForTimeout(300);
  wn = await f.ev(() => ((document.querySelector('#w152sheet .w152warn') || {}).textContent || ''));
  ok('a volunteer with an email already in the CRM is stopped (a volunteer is added once)', /a volunteer is added once/.test(wn) && (await W(f)).filter(x => (x.table === 'crm_contacts' || x.table === 'volunteer_people') && x.op === 'insert').length === 0, wn);
  /* the warning was seen: the next press (as a donor, not a volunteer) adds them anyway */
  await f.ev(() => { const s = document.getElementById('w152sheet'); s.querySelector('[data-fk="volunteer"]').checked = false; s.querySelector('[data-f="perm"]').value = 'express'; s.querySelector('[data-f="perm_source"]').value = 'the gala sign-up sheet'; s.querySelector('[data-w152save]').click(); });
  await f.page.waitForTimeout(700);
  w = await W(f);
  const ci = w.filter(x => x.table === 'crm_contacts' && x.op === 'insert');
  ok('pressing Add again adds them anyway, with the permission and source hub', ci.length === 1 && ci[0].p.full_name === 'Priya R.' && ci[0].p.source === 'hub' && ci[0].p.email_consent === 'express' && ci[0].p.consent_source === 'the gala sign-up sheet' && ci[0].p.kinds.join(',') === 'donor', ci);
  ok('the new contact opens, and is in the list', /Priya R\./.test(await sheet(f)) && (await f.ev(() => window.w152.state().contacts.some(c => c.full_name === 'Priya R.'))));
  await click(f, '#w152sheet [data-w152close]'); await f.page.waitForTimeout(150);
  await click(f, '#crm [data-w152add]'); await f.page.waitForTimeout(250);
  await f.ev(() => { const s = document.getElementById('w152sheet'); s.querySelector('[data-f="full_name"]').value = 'Tariq New'; s.querySelector('[data-f="emails"]').value = 'tariq.new@example.com'; s.querySelector('[data-fk="volunteer"]').checked = true; s.querySelector('[data-w152save]').click(); });
  await f.page.waitForTimeout(600);
  w = await W(f);
  const vi = w.filter(x => x.table === 'volunteer_people' && x.op === 'insert');
  ok('a new volunteer gets a volunteer record first (MTL volunteering sees them)', vi.length === 1 && vi[0].p.full_name === 'Tariq New' && JSON.stringify(vi[0].p.emails) === '["tariq.new@example.com"]', vi);
  await click(f, '#w152sheet [data-w152close]'); await f.page.waitForTimeout(150);

  /* ---------- possible duplicates ---------- */
  await f.hash('#crm/dupes', 900);
  const d0 = await f.ev(() => ({ pairs: document.querySelectorAll('#crm .w152dp').length, why: [...document.querySelectorAll('#crm .w152dp .why')].map(x => x.textContent), tab: (document.querySelector('#crm .w152tabs button.on') || {}).textContent }));
  ok('Possible duplicates shows each pair once, saying what matched', d0.pairs === 2 && /Same email and phone/.test(d0.why[0]) && /Same phone/.test(d0.why[1]) && /Possible duplicates/.test(d0.tab), d0);
  await shot(f, 'crm_dupes');
  await click(f, '#crm [data-w152keep="5001"]'); await f.page.waitForTimeout(200);
  const cf = await f.ev(() => ((document.querySelector('#crm .w152cf') || {}).textContent || ''));
  ok('Keep this one asks first, and says both volunteer records become one', /Merge Amara Okafor into Amara Okafor\?/.test(cf) && /two volunteer records become one/.test(cf) && (await W(f)).filter(x => x.rpc === 'crm_merge_contacts').length === 0, cf);
  await click(f, '#crm [data-w152merge="5001"]'); await f.page.waitForTimeout(500);
  w = await W(f);
  const rp = w.filter(x => x.rpc === 'crm_merge_contacts');
  ok('Merge calls crm_merge_contacts(keep, drop)', rp.length === 1 && rp[0].args.p_keep === 5001 && rp[0].args.p_drop === 5008, rp);
  ok('the pair leaves the list and the copy leaves the CRM', (await f.ev(() => document.querySelectorAll('#crm .w152dp').length)) === 1 && (await f.ev(() => !window.w152.state().contacts.some(c => c.id === 5008))));
  await click(f, '#crm [data-w152notdup]'); await f.page.waitForTimeout(400);
  w = await W(f);
  const nd = w.filter(x => x.table === 'crm_dupe_dismissals');
  ok('Not the same person saves the pair in crm_dupe_dismissals (smaller id first)', nd.length === 1 && nd[0].p.a_id === 5002 && nd[0].p.b_id === 5009 && nd[0].p.dismissed_by === 'steel.macdonald@welfareavenue.com', nd);
  ok('with no pair left, the tab says so', /No possible duplicates right now/.test(await f.ev(() => document.querySelector('#crm .w152root').textContent)));

  /* ---------- sources ---------- */
  await f.hash('#crm/sources', 1200);
  const so = await f.ev(() => ({ cards: [...document.querySelectorAll('#crm .w152card h3')].map(x => x.textContent), txt: document.querySelector('#crm .w152root').innerText }));
  ok('Sources: Leaving Keela (wave159a), where they come from, what joins next, email permission, to tidy', so.cards.length === 5 && /Leaving Keela/.test(so.cards[0]) && /Where they come from/.test(so.cards[1]) && /What joins next/.test(so.cards[2]) && /Email permission/.test(so.cards[3]) && /To tidy/.test(so.cards[4]), so.cards);
  ok('the sources name the old website sign-ups and what is already in (history, messages, gifts)', /Old website sign-ups/.test(so.txt) && /Volunteer history from the old website[\s\S]*?3 in[\s\S]*?Messages from the website[\s\S]*?2 in[\s\S]*?Zeffy[\s\S]*?3 in/.test(so.txt), so.txt.slice(0, 900));
  await shot(f, 'crm_sources');
  /* a contact that is not in the CRM any more (merged; the database no longer returns it): the link says so */
  await f.ev(() => { window.__WAFIX.crm_contacts_v = window.__WAFIX.crm_contacts_v.filter(c => c.id !== 5008); return window.w152.load('contacts', true); });
  await f.hash('#crm/c/5008', 900);
  ok('a merged contact’s link opens the list and says so', !(await sheet(f)) && (await f.ev(() => location.hash)) === '#crm', await f.ev(() => location.hash));
  ok('the tour covers the page (tour:crm)', await f.ev(() => !!(window.w122 && w122.tours.crm && w122.tours.crm.steps.length >= 8 && w122.tours.crm.hash === '#crm')));
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- a member on the HR profile: the page follows its gate until decided ---------------- */
  f = await fresh(browser, { who: 'member', hash: '#crm', fixture: crmFixture(), wait: 5000 });
  const mb = await f.ev(() => { const b = document.querySelector('#tabBar .tab[data-tab="crm"]'); return { shown: !!b && b.style.display !== 'none', rows: document.querySelectorAll('#crm .w152row').length, active: document.getElementById('crm').classList.contains('active') }; });
  ok('a member (HR profile, CRM not decided yet) has the CRM', mb.shown && mb.active && mb.rows === 60, mb);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();
  /* the HR profile says none */
  f = await fresh(browser, { who: 'member', hash: '#crm', fixture: crmFixture(fx => (fx.hub_access_profiles || []).forEach(p => { p.pages = Object.assign({}, p.pages, { crm: p.key === 'hr' ? 'none' : 'all' }); })), wait: 5000 });
  const mn = await f.ev(() => { const b = document.querySelector('#tabBar .tab[data-tab="crm"]'); return { shown: !!b && b.style.display !== 'none', active: document.getElementById('crm') && document.getElementById('crm').classList.contains('active'), loaded: !!window.w152.state().contacts }; });
  ok('a member whose profile says none: no CRM in the menu, the link goes elsewhere, nothing loads', !mn.shown && !mn.active && !mn.loaded, mn);
  await f.close();
  /* a member with their own tab list that leaves the CRM out */
  f = await fresh(browser, { who: 'member', hash: '#crm', fixture: crmFixture(fx => { const r = (fx.hub_roles || []).filter(x => x.email === 'samson.jules@welfareavenue.com')[0]; if (r) { r.profile = null; } fx.__tabs = true; }),
    init: `(function(){ var t = setInterval(function(){ var F = window.__WAFIX; if (!F || !F.hub_roles) return; clearInterval(t); F.hub_roles.forEach(function (r) { if (r.email === 'samson.jules@welfareavenue.com') { r.profile = null; r.tabs = ['overview', 'training']; } }); }, 1); })();`, wait: 5000 });
  const mt = await f.ev(() => { const b = document.querySelector('#tabBar .tab[data-tab="crm"]'); return { shown: !!b && b.style.display !== 'none', active: document.getElementById('crm') && document.getElementById('crm').classList.contains('active'), loaded: !!window.w152.state().contacts, allowed: typeof wa40Allowed === 'function' ? wa40Allowed() : null }; });
  ok('a member with their own tab list without the CRM does not get it', !mt.shown && !mt.active && !mt.loaded, mt);
  await f.close();

  /* ---------------- a director ---------------- */
  f = await fresh(browser, { who: 'board', hash: '#crm', fixture: crmFixture(), wait: 5000 });
  const bd = await f.ev(() => { const b = document.querySelector('#tabBar .tab[data-tab="crm"]'); return { shown: !!b && b.style.display !== 'none', active: document.getElementById('crm') && document.getElementById('crm').classList.contains('active'), loaded: !!(window.w152 && window.w152.state().contacts) }; });
  ok('a director has no CRM, and nothing loads', !bd.shown && !bd.active && !bd.loaded, bd);
  ok('no page errors (board)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- phone width ---------------- */
  f = await fresh(browser, { who: 'admin', hash: '#crm', fixture: crmFixture(), width: 390, wait: 5000 });
  const p1 = await f.ev(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, rows: document.querySelectorAll('#crm .w152row').length, cols: getComputedStyle(document.querySelector('#crm .w152stats')).gridTemplateColumns.split(' ').length }));
  ok('on a phone the list fits the width (no sideways scroll), two numbers a row', p1.sw <= p1.iw && p1.rows === 60 && p1.cols === 2, p1);
  await shot(f, 'crm_phone_list');
  await click(f, '#crm [data-w152open="5001"]'); await f.page.waitForTimeout(700);
  const p2 = await f.ev(() => { const s = document.querySelector('#w152sheet .sh'); const r = s.getBoundingClientRect(); return { w: r.width, iw: innerWidth, sw: document.getElementById('w152sheet').scrollWidth, cols: getComputedStyle(document.querySelector('#w152sheet .w152cols')).gridTemplateColumns.split(' ').length }; });
  ok('on a phone a contact fills the screen in one column', p2.w <= p2.iw && p2.sw <= p2.iw && p2.cols === 1, p2);
  await shot(f, 'crm_phone_contact');
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw152drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
