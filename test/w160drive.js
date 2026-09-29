/* w160drive.js: the CRM's Reports tab (wave160). The report is made up for the test (no real people or figures); the stub
   answers crm_report with it, records every RPC and write, and never changes the fixture.
   An admin opens Reports: ten tabs and the rail's Reports item, the fiscal year so far with the headline numbers against the
   same point last year, the year in a few lines for the board (and Copy the summary), gifts by month with both years, where
   the money came from (kinds, campaigns, the platform and method), gift sizes and the largest donors, donor retention with
   who gave last year and not yet this year (Show all, Make a list of them as a fixed list of the people in the CRM),
   volunteering by month, roles, the most servings, the application funnel, the hours and meals notes, email permission
   today from the contacts, the notes on counting, Print. Another year from the picker (the address and the RPC follow); a
   year the database refuses shows the reason and Try again. A staff member sees it too; on a phone nothing overflows.
   usage: node test/w160drive.js */
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
function fixture() {
  const fx = loadFixture();
  const people = [
    C(5001, 'Amara Test', { emails: ['amara@example.com'], email_consent: 'express', email_status: 'subscribed', kinds: ['donor', 'volunteer'] }),
    C(5002, 'Bea Test', { emails: ['bea@example.com'], email_consent: 'implied', implied_consent_until: '2026-11-01' }),
    C(5003, 'Cal Test', { emails: ['cal@example.com'], email_consent: 'implied', implied_consent_until: '2027-06-01' }),
    C(5004, 'Dee Test', { emails: ['dee@example.com'], email_consent: 'express', email_status: 'unsubscribed' }),
    C(5005, 'Eli Test', { emails: ['eli@example.com'], email_status: 'bounced' }),
    C(5006, 'Fay Test', { emails: ['fay@example.com'] }),
    C(5007, 'Gus Test', {})
  ];
  for (let i = 11; i <= 19; i++) people.push(C(5000 + i, 'Lapsed Donor ' + i, { kinds: ['donor'] }));
  fx.crm_contacts_v = people;
  fx.crm_contacts = people.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = []; fx.crm_donations = []; fx.crm_gift_receipts_v = [];
  fx.crm_lists = []; fx.crm_automation_runs = []; fx.crm_automations = []; fx.crm_contact_fields = []; fx.crm_fields = [];
  return fx;
}
const MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const gm = (vals, prev) => MONTHS.map((m, i) => ({ month: m, total: vals[i], count: vals[i] ? 1 : 0, prev_total: prev[i], prev_count: prev[i] ? 1 : 0 }));
const vm = (vals, prev) => MONTHS.map((m, i) => ({ month: m, servings: vals[i], events: vals[i] ? 1 : 0, people: vals[i] ? Math.ceil(vals[i] / 2) : 0, prev_servings: prev[i] }));
const LAPSED = [];
for (let i = 11; i <= 20; i++) LAPSED.push({ contact_id: 5000 + i, name: 'Lapsed Donor ' + i, prev_total: 200 - i, last_day: '2025-0' + (i % 9 + 1) + '-15', gifts_ever: 2, total_ever: 300 });
const REPORT = {
  fy: 2025, label: '2025-26', prev_label: '2024-25', from: '2025-10-01', to: '2026-09-30', through: '2026-09-25', in_progress: true, today: '2026-09-25', years: [2025, 2024, 2023], at: '2026-09-25T13:00:00Z',
  gifts: { total: 1250.5, count: 12, donors: 9, average: 104.21, median: 80, largest: 400, prev: { total: 900, count: 14, donors: 12 }, prev_to_date: { through: '2025-09-25', total: 850, count: 13, donors: 12 },
    by_month: gm([0, 0, 100, 0, 0, 50, 0, 0, 200, 400, 500.5, 0], [0, 100, 300, 0, 0, 0, 0, 0, 0, 0, 200, 300]),
    by_kind: [{ kind: 'donation', count: 10, total: 1050.5 }, { kind: 'registration', count: 2, total: 200 }],
    by_campaign: [{ campaign: 'Spring appeal', count: 6, total: 700, donors: 5 }, { campaign: null, count: 6, total: 550.5, donors: 4 }],
    by_source: [{ platform: 'keela', method: '', count: 8, total: 850.5 }, { platform: 'hub', method: 'cheque', count: 4, total: 400 }],
    bands: [{ band: 'Under $50', min: 0, count: 3, total: 90 }, { band: '$50 to $99', min: 50, count: 4, total: 260.5 }, { band: '$100 to $249', min: 100, count: 4, total: 500 },
      { band: '$250 to $499', min: 250, count: 1, total: 400 }, { band: '$500 to $999', min: 500, count: 0, total: 0 }, { band: '$1,000 and more', min: 1000, count: 0, total: 0 }],
    receipts: { receipted: 8, due: 3, no: 1 } },
  donors: { this_year: 9, last_year: 12, new: 6, retained: 2, recaptured: 1, lapsed: 10, retention_rate: 16.7, lapsed_list: LAPSED,
    top: [{ contact_id: 5001, name: 'Amara Test', count: 3, total: 400 }, { contact_id: 5003, name: 'Cal Test', count: 2, total: 250 }, { contact_id: 5099, name: 'Gone Person', count: 1, total: 100 }] },
  volunteers: { servings: 60, people: 25, events: 5, events_by_kind: { service: 5 }, new: 15, retained: 6, prev: { servings: 80, people: 30, events: 6 },
    prev_to_date: { through: '2025-09-25', servings: 80, people: 30, events: 6 }, by_month: vm([0, 0, 0, 10, 12, 8, 10, 12, 8, 0, 0, 0], [20, 15, 25, 12, 8, 0, 0, 0, 0, 0, 0, 0]),
    by_role: [{ role: 'server', servings: 30, people: 15 }, { role: 'cook', servings: 20, people: 8 }, { role: 'team_leader', servings: 10, people: 2 }],
    top: [{ contact_id: 5001, name: 'Amara Test', servings: 5 }, { contact_id: null, name: 'Walk-in Person', servings: 3 }],
    hours: { recorded: 0, servings_with_hours: 0, last_recorded: '2025-02-09' }, meals: { served: 0, events: 0, last_recorded: '2025-01-19' },
    applied: { applied: 10, served1: 4, served2: 2, served3: 1 } },
  email: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, campaigns: 0, from_campaigns: 0, from_automations: 0 }, forms: []
};
const REPORT24 = JSON.parse(JSON.stringify(REPORT));
Object.assign(REPORT24, { fy: 2024, label: '2024-25', prev_label: '2023-24', from: '2024-10-01', to: '2025-09-30', through: '2025-09-30', in_progress: false });
REPORT24.gifts.total = 900; REPORT24.gifts.count = 14; REPORT24.gifts.donors = 12; REPORT24.gifts.prev = { total: 600, count: 5, donors: 5 };
REPORT24.email = { sent: 40, delivered: 38, opened: 20, clicked: 5, bounced: 2, unsubscribed: 1, campaigns: 2, from_campaigns: 30, from_automations: 10 };
REPORT24.forms = [{ form_id: 1, title: 'Volunteer with Welfare Avenue', slug: 'volunteer', answers: 7 }];
const patch = f => f.ev(([r25, r24]) => {
  window.__ins = []; window.__rpc = []; window.__clip = null;
  try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__clip = t; return Promise.resolve(); } }, configurable: true }); } catch (e) { /* fine */ }
  const rpc0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    if (fn === 'crm_report') {
      const y = args && args.p_fy;
      if (y == null || y === 2025) return Promise.resolve({ data: JSON.parse(JSON.stringify(r25)), error: null });
      if (y === 2024) return Promise.resolve({ data: JSON.parse(JSON.stringify(r24)), error: null });
      return Promise.resolve({ data: null, error: { message: 'No report for that year.' } });
    }
    return rpc0(fn, args);
  };
  const from0 = db.from.bind(db);
  db.from = function (t) {
    const q = from0(t); const ins = q.insert;
    q.insert = function (p) { window.__ins.push({ t: t, op: 'insert', p: JSON.parse(JSON.stringify(p)) }); if (p && !Array.isArray(p) && t === 'crm_lists') p = Object.assign({ id: 700 + window.__ins.length }, p); return ins.call(this, p); };
    return q;
  };
  return true;
}, [REPORT, REPORT24]);
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);
const txt = f => f.ev(() => (document.querySelector('#crm .w160rep') || {}).innerText || '');
const card = (f, h) => f.ev(x => { const c = [...document.querySelectorAll('#crm .w160rep .w154card')].filter(s => (s.querySelector('h3') || {}).textContent && s.querySelector('h3').textContent.trim().indexOf(x) === 0)[0]; return c ? c.innerText.replace(/\s+/g, ' ') : ''; }, h);

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f);
  await f.hash('#crm/reports', 2600);
  let b = await f.ev(() => ({ tabs: [...document.querySelectorAll('#crm .w152tabs button')].map(x => x.textContent.trim() + (x.classList.contains('on') ? '*' : '')),
    rail: [...document.querySelectorAll('#w153rail .w153it')].map(a => a.textContent.trim() + (a.classList.contains('on') ? '*' : '')), next: /Next in the CRM/i.test((document.getElementById('w153rail') || {}).innerText || ''),
    rpc: window.__rpc.filter(x => x.fn === 'crm_report') }));
  ok('the CRM has ten tabs and #crm/reports marks Reports', b.tabs.length === 10 && b.tabs[9] === 'Reports*', b.tabs);
  ok('the rail lists Reports as its own group (no longer “next”)', b.rail.join('|') === 'Contacts|Partners|Possible duplicates|Sources|Lists|Forms|Gifts|Email|Campaigns|Automations|Reports*' && !b.next, b);   /* wave163: Partners */
  ok('the report is asked for once, for this year (no year given)', b.rpc.length === 1 && b.rpc[0].args.p_fy === null, b.rpc);
  let t = await txt(f);
  ok('the title says the year is still running, to the day', /Fiscal year 2025-26\s*so far, to 25 Sep 2026/i.test(t), t.slice(0, 300));
  b = await f.ev(() => [...document.querySelectorAll('#crm .w160stats .w152st')].map(x => x.innerText.replace(/\s+/g, ' ')));
  ok('the headline numbers, each against the same point last year', b.length === 4 && /\$1,250\.50 raised in 12 gifts \(2024-25 at this point: \$850\)/.test(b[0]) && /9 donors, 6 new \(2024-25 at this point: 12\)/.test(b[1]) &&
    /25 volunteers served, 15 for the first time \(2024-25 at this point: 30\)/.test(b[2]) && /60 servings at 5 events \(2024-25 at this point: 80\)/.test(b[3]), b);
  b = await f.ev(() => [...document.querySelectorAll('#crm .w160sum p')].map(p => p.textContent));
  ok('the year in a few lines: the gifts against the same point last year', b[0] === 'In 2025-26 (1 Oct 2025 to 25 Sep 2026), 9 people gave $1,250.50 in 12 gifts (at the same point in 2024-25: $850 from 12 people).', b[0]);
  ok('the donors in one sentence: first-time, retained with the rate, came back, not yet this year', b[1] === '6 people gave for the first time, 2 of the 12 donors of 2024-25 gave again (17% retention), 1 person came back after a year or more without giving and 10 who gave in 2024-25 have not given yet in 2025-26.', b[1]);
  ok('the volunteers: served, first time, came back', b[2] === '25 volunteers served 60 times at 5 events (at the same point in 2024-25: 30 volunteers, 80 servings). 15 people served for the first time and 6 of the 30 volunteers of 2024-25 came back (20%).', b[2]);
  ok('the applications, and nothing about emails or forms when none went out', b[3] === '10 people applied to volunteer, and 4 of them have served since.' && b.length === 4, b);
  await click(f, '#crm [data-w160copy]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => window.__clip);
  ok('Copy the summary puts the year and the lines on the clipboard', typeof b === 'string' && /^Fiscal year 2025-26, to 25 Sep 2026\n\nIn 2025-26/.test(b) && /applied to volunteer/.test(b), b);

  b = await f.ev(() => { const ch = document.querySelectorAll('#crm .w160ch')[0]; return { cols: ch ? ch.querySelectorAll('.w160col').length : 0, cur: ch ? ch.querySelectorAll('i.c').length : 0, prev: ch ? ch.querySelectorAll('i.p').length : 0,
    aug: ch ? ch.querySelectorAll('.w160col')[10].getAttribute('title') : '', h: ch ? ch.querySelectorAll('.w160col')[10].querySelector('i.c').style.height : '', labels: [...document.querySelectorAll('#crm .w160ml')[0].children].map(x => x.textContent).join(' '),
    aria: ch ? ch.getAttribute('aria-label') : '' }; });
  ok('gifts by month: twelve months with both years, the tallest month full height, Oct to Sep', b.cols === 12 && b.cur === 12 && b.prev === 12 && b.h === '100%' && /Aug 2026: \$500\.50 \(the year before: \$200\)/.test(b.aug) && b.labels === 'Oct Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep' && /Aug \$500\.50/.test(b.aria), b);
  let c = await card(f, 'Gifts by month');
  ok('the best month is named', /The best month: Aug 2026 \(\$500\.50, 1 gift\)/.test(c) && /\$1,250\.50 in 2025-26, \$900 in 2024-25/.test(c), c);
  c = await card(f, 'Where it came from');
  ok('where it came from: kinds, campaigns (and gifts with none), the platform with the method, the receipts', /Donation · 10 gifts\s*\$1,050\.50/.test(c) && /Registration · 2 gifts\s*\$200/.test(c) && /Spring appeal · 6 gifts, 5 donors\s*\$700/.test(c) &&
    /No campaign · 6 gifts, 4 donors/.test(c) && /Keela · 8 gifts/.test(c) && /The Hub \(Cheque\) · 4 gifts\s*\$400/.test(c) && /8 gifts receipted, 3 gifts receipt due and 1 gift no receipt/.test(c) && !/Keela’s gifts came in as donations/.test(c), c);
  c = await card(f, 'Gift sizes');
  ok('gift sizes with the average, middle and largest, and the largest donors (someone gone from the CRM without a link)', /average \$104\.21, middle \$80, largest \$400/.test(c) && /\$250 to \$499 · \$400\s*1 gift/.test(c) && /Amara Test · 3 gifts\s*\$400/.test(c) && /Gone Person/.test(c), c);
  b = await f.ev(() => [...document.querySelectorAll('#crm .w160rep a[href^="#crm/c/"]')].map(a => a.getAttribute('href') + ' ' + a.textContent));
  ok('names open their contact page', b.indexOf('#crm/c/5001 Amara Test') >= 0 && b.indexOf('#crm/c/5003 Cal Test') >= 0 && !b.some(x => /Gone Person|5099/.test(x)), b);

  c = await card(f, 'Donors');
  ok('donors: the four boxes and the retention rate', /6 gave for the first time/.test(c) && /2 gave again after 2024-25/.test(c) && /1 came back after a gap/.test(c) && /10 gave in 2024-25, not yet in 2025-26/.test(c) && /Donor retention: 17% of the 12 donors of 2024-25 gave again in 2025-26 so far\./.test(c), c);
  b = await f.ev(() => ({ rows: document.querySelectorAll('#crm .w160lap .w160r').length, first: (document.querySelector('#crm .w160lap .w160r') || {}).innerText, more: (document.querySelector('#crm [data-w160lapsed]') || {}).textContent }));
  ok('who gave last year and not yet this year: the first 8, with the last gift, and Show all 10', b.rows === 8 && /Lapsed Donor 11/.test(b.first) && /last gave 15 Mar 2025, 2 gifts in all/.test(b.first.replace(/\s+/g, ' ')) && /\$189/.test(b.first) && b.more === 'Show all 10', b);
  await click(f, '#crm [data-w160lapsed]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => ({ rows: document.querySelectorAll('#crm .w160lap .w160r').length, last: [...document.querySelectorAll('#crm .w160lap .w160r')].pop().innerText, more: !!document.querySelector('#crm [data-w160lapsed]') }));
  ok('Show all lists the ten (one no longer in the CRM, without a link)', b.rows === 10 && /Lapsed Donor 20/.test(b.last) && !b.more, b);
  await click(f, '#crm [data-w160list]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => ({ ins: window.__ins.filter(x => x.t === 'crm_lists'), msg: (document.querySelector('#crm .w160rep .w154msg') || {}).innerText || '', link: !!document.querySelector('#crm .w160rep .w154msg a[href="#crm/lists"]') }));
  const li = b.ins[0] && b.ins[0].p;
  ok('Make a list of them saves a fixed list of the nine still in the CRM', b.ins.length === 1 && li.kind === 'static' && li.name === 'Gave in 2024-25, not yet in 2025-26' && li.member_ids.length === 9 && li.member_ids.indexOf(5020) < 0 && li.member_ids[0] === 5011 &&
    /made in Reports/.test(li.description) && li.created_by === li.updated_by && Array.isArray(li.filter.groups), li);
  ok('and says so, with a link to Lists', /saved as a fixed list of 9 people/.test(b.msg) && b.link, b);

  c = await card(f, 'Volunteering by month');
  ok('volunteering by month against the year before', /60 servings in 2025-26, 80 servings in 2024-25/.test(c), c);
  c = await card(f, 'Volunteers');
  ok('volunteers: served, first time, came back, retention; roles in words; the most servings (a walk-in without a link)', /25 served in 2025-26/.test(c) && /15 for the first time/.test(c) && /6 of 30 from 2024-25 came back/.test(c) && /20% volunteer retention/.test(c) &&
    /Server · 15 people\s*30 servings/.test(c) && /Team leader · 2 people\s*10 servings/.test(c) && /Amara Test\s*5 servings/.test(c) && /Walk-in Person\s*3 servings/.test(c), c);
  c = await card(f, 'From applying to serving');
  ok('from applying to serving, and the hours and meals in words', /Applied in 2025-26\s*10/.test(c) && /Served at least once since\s*4/.test(c) && /Three times or more\s*1/.test(c) &&
    /Hours are not recorded for servings in the Hub; the old website recorded them until 9 Feb 2025\./.test(c) && /Meals served are not recorded since 19 Jan 2025 \(the old website\)\./.test(c), c);
  c = await card(f, 'Email');
  ok('email permission today from the contacts: newsletter reach, express, implied, ending within 90 days', /3 can get a newsletter/.test(c) && /1 said yes \(express\)/.test(c) && /2 implied: gave or served/.test(c) && /1 implied ends within 90 days/.test(c) &&
    /1 person has unsubscribed, 1 address bounces, 1 person has no permission on file \(confirmations only\), and 10 contacts have no email address\./.test(c) && /No email has gone out from the Hub in 2025-26/.test(c) && /No form answer yet/.test(c), c);
  b = await f.ev(() => window.w160.perm());
  ok('the permission rule is the CRM’s own (permKey)', b.reach === 3 && b.express === 1 && b.implied === 2 && b.ending === 1 && b.unsub === 1 && b.bounced === 1 && b.none === 1 && b.noemail === 10 && b.total === 16, b);
  c = await card(f, 'How it is counted');
  ok('how it is counted', /1 October to 30 September; 2025-26 began on 1 Oct 2025/.test(c) && /at the same date \(25 Sep 2025\)/.test(c) && /Possible duplicates/.test(c), c);
  b = await f.ev(() => ({ print: !!document.querySelector('#crm [data-w160print]'), css: /@media print\{body \*\{visibility:hidden !important;\}\.w160rep/.test((document.getElementById('w160css') || {}).textContent || ''),
    tour: ((window.w122 && window.w122.tours && window.w122.tours.crm && window.w122.tours.crm.steps) || []).some(s => s.t === 'Reports' && /#crm\/reports/.test(s.s || '')) }));
  ok('Print prints the report alone, and the CRM tour has a Reports step', b.print && b.css && b.tour, b);
  await shot(f, 'reports_2025');

  /* another year */
  await setv(f, '#crm [data-w160fy]', '2024'); await f.page.waitForTimeout(1400);
  b = await f.ev(() => ({ hash: location.hash, rpc: window.__rpc.filter(x => x.fn === 'crm_report').map(x => x.args.p_fy), shown: (document.querySelector('#crm .w160rep') || {}).getAttribute && document.querySelector('#crm .w160rep').getAttribute('data-w160fyshown'),
    title: (document.querySelector('#crm .w160title') || {}).innerText, first: (document.querySelector('#crm .w160sum p') || {}).textContent, sel: (document.querySelector('#crm [data-w160fy]') || {}).value }));
  ok('another year from the picker: the address and the RPC follow', b.hash === '#crm/reports/2024' && b.rpc.length === 2 && b.rpc[0] === null && b.rpc[1] === 2024, b);
  ok('a finished year: no “so far”, compared with the whole year before', b.shown === '2024' && b.sel === '2024' && /^Fiscal year 2024-25$/i.test((b.title || '').trim()) &&
    b.first === 'In 2024-25 (1 Oct 2024 to 30 Sep 2025), 12 people gave $900 in 14 gifts (in 2023-24: $600 from 5 people).', b);
  b = await f.ev(() => [...document.querySelectorAll('#crm .w160sum p')].map(p => p.textContent));
  ok('the emails and form answers of the year join the lines when there are some', b.some(s => s === 'The Hub sent 40 emails (2 campaigns); 20 were opened.') && b.some(s => s === 'The CRM’s forms were answered 7 times.'), b);
  c = await card(f, 'Email');
  ok('the emails of the year: sent, delivered, opened with the rate, from campaigns and automations; the form answers', /Emails sent\s*40/.test(c) && /Opened · 50%\s*20/.test(c) && /30 emails from 2 campaigns, 10 emails from automations/.test(c) && /Volunteer with Welfare Avenue\s*7 answers/.test(c), c);
  await f.hash('#crm/reports', 1200);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_report').length, shown: document.querySelector('#crm .w160rep').getAttribute('data-w160fyshown') }));
  ok('back to this year without asking again (kept for the visit)', b.rpc === 2 && b.shown === '2025', b);
  await f.hash('#crm/reports/2023', 1200);
  b = await f.ev(() => ({ t: (document.querySelector('#crm .w152root') || {}).innerText || '', retry: !!document.querySelector('#crm [data-w160reload]') }));
  ok('a year the database refuses says why, with Try again and This year', /The report could not be made \(No report for that year\.\)/.test(b.t) && b.retry && /This year/.test(b.t), b.t.slice(0, 400));
  await click(f, '#crm [data-w160reload]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => window.__rpc.filter(x => x.fn === 'crm_report').map(x => x.args.p_fy));
  ok('Try again asks again', b.filter(x => x === 2023).length === 2, b);
  ok('no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* a staff member with the CRM */
  f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f);
  await f.hash('#crm/reports', 2600);
  b = await f.ev(() => ({ title: (document.querySelector('#crm .w160title') || {}).innerText || '', list: !!document.querySelector('#crm [data-w160list]'), tabs: document.querySelectorAll('#crm .w152tabs button').length }));
  ok('a staff member with the CRM sees the report and can make the list', /Fiscal year 2025-26/i.test(b.title) && b.list && b.tabs === 10, b);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  /* phone */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f);
  await f.hash('#crm/reports', 2600);
  b = await f.ev(() => { const r = document.querySelector('#crm .w160ret'); return { sw: document.documentElement.scrollWidth, w: innerWidth, cols: r ? getComputedStyle(r).gridTemplateColumns.split(' ').length : 0,
    grid: getComputedStyle(document.querySelector('#crm .w160grid')).gridTemplateColumns.split(' ').length, ch: document.querySelector('#crm .w160ch').scrollWidth <= document.querySelector('#crm .w160ch').clientWidth + 1 }; });
  ok('phone: one column, the boxes two by two, the charts fit, nothing scrolls sideways', b.sw <= b.w + 1 && b.cols === 2 && b.grid === 1 && b.ch, b);
  await shot(f, 'reports_phone');
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw160drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
