/* w153drive.js: the apps (wave153). Fixture rows are made up for the test (no real people).
   An admin finds the 9-dot dock at the bottom of the menu, opens the launcher (the Hub, the CRM, the HR centre, Finance, the
   Admin centre), enters the CRM (the menu becomes the CRM's rail, the app bar names the app and the place, Search everything
   searches contacts first and finds one, the Gifts tab lists the gifts), goes back to the Hub (the page they left), opens the
   HR centre (its sections switch the page's tabs), leaves it by opening a page outside, opens Finance (the sections follow),
   the Admin centre, and the app survives a reload. A member on the HR profile gets the CRM and the HR centre only; a director
   gets no dock; on a phone the app bar's Menu opens the rail in the drawer.
   usage: node test/w153drive.js   (SHOTS=<dir> also saves screenshots) */
const { launch, fresh, loadFixture } = require('./boot');
const fs = require('fs');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name) { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + name + '.png' }); }

function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['volunteer'], tags: [], source: 'django_website_export', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'wa150_backfill', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [] }, o || {});
}
function fixture(extra) {
  const fx = loadFixture();
  fx.crm_contacts_v = [
    C(5001, 'Amara Okafor', { emails: ['amara.okafor@example.com'], primary_email: 'amara.okafor@example.com', phones: ['514-555-0101'], kinds: ['volunteer', 'donor'], donation_total: 225, donation_count: 2, last_donation_at: '2026-08-30T15:00:00Z' }),
    C(5002, 'Élodie Gagnon', { emails: ['elodie.gagnon@example.com'], primary_email: 'elodie.gagnon@example.com', kinds: ['supporter'] }),
    C(5003, 'Priya Raman', { emails: ['priya.raman@example.com'], primary_email: 'priya.raman@example.com', kinds: ['donor'], donation_total: 125, donation_count: 1, last_donation_at: '2025-12-01T15:00:00Z' })
  ];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_interactions = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = [];
  fx.crm_donations = [
    { id: 81, contact_id: 5001, amount: 100, currency: 'CAD', donated_at: '2026-08-30T15:00:00Z', platform: 'zeffy', campaign: 'Back to school meals', designation: null, recurring: false, receipt_number: 'WA-2026-0042', receipt_issued_at: '2026-08-30T15:01:00Z', receipt_url: 'https://example.com/receipt', receipt_source: 'zeffy', external_id: 'z-1', notes: null },
    { id: 82, contact_id: 5001, amount: 125, currency: 'CAD', donated_at: '2026-05-01T15:00:00Z', platform: 'keela', campaign: null, designation: null, recurring: false, receipt_number: null, receipt_issued_at: null, receipt_url: null, receipt_source: 'none', external_id: 'k-1', notes: null },
    { id: 83, contact_id: 5003, amount: 125, currency: 'CAD', donated_at: '2025-12-01T15:00:00Z', platform: 'keela', campaign: 'Winter drive', designation: null, recurring: true, receipt_number: 'K-77', receipt_issued_at: '2025-12-02T15:00:00Z', receipt_url: null, receipt_source: 'keela', external_id: 'k-2', notes: null }
  ];
  if (extra) extra(fx);
  return fx;
}
const rail = f => f.ev(() => [...document.querySelectorAll('#w153rail .w153it')].map(a => a.textContent.trim() + (a.classList.contains('on') ? '*' : '')));
const state = f => f.ev(() => ({ hash: location.hash, app: window.w153.current(), body: document.body.className, tabBar: getComputedStyle(document.getElementById('tabBar')).display, railShown: getComputedStyle(document.getElementById('w153rail')).display,
  dock: !!document.getElementById('w153dock') && getComputedStyle(document.getElementById('w153dock')).display !== 'none', bar: (document.getElementById('w153bar') || { innerText: '' }).innerText.replace(/\s+/g, ' ').trim(), ph: document.getElementById('globalSearch').placeholder,
  back: getComputedStyle(document.querySelector('#w153dock .w153back')).display }));
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);

(async () => {
  const browser = await launch();
  /* ---------------- an admin ---------------- */
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await f.page.waitForTimeout(800);
  let s = await state(f);
  ok('the dock sits at the bottom of the menu, outside an app (the menu shows, no rail)', s.dock && !s.app && s.tabBar !== 'none' && s.railShown === 'none' && s.back === 'none', s);
  const menu = await f.ev(() => { const vis = id => { const t = document.querySelector('#tabBar .tab[data-tab="' + id + '"]'); return t ? getComputedStyle(t).display : 'absent'; };
    return { crm: vis('crm'), hrcentre: vis('hrcentre'), finances: vis('finances'), orgchart: vis('orgchart'), training: vis('training'), fundevents: vis('fundevents'), admin: getComputedStyle(document.querySelector('#tabBar .tab-group[data-w42g="admin"]')).display, allowedCrm: window.w153.allowed('crm'), allowedAdmin: window.w153.allowed('adminpanel') }; });
  ok('the Hub\'s menu no longer shows the apps\' pages (CRM, HR centre, Finances, the Admin group) while the rest stays', menu.crm === 'none' && menu.hrcentre === 'none' && menu.finances === 'none' && menu.admin === 'none' && menu.orgchart !== 'none' && menu.training !== 'none' && menu.fundevents !== 'none', menu);
  ok('the hidden buttons still carry the access rule (the launcher reads it)', menu.allowedCrm && menu.allowedAdmin, menu);
  const dockPos = await f.ev(() => { const n = document.querySelector('nav.wa-nav').getBoundingClientRect(), d = document.getElementById('w153dock').getBoundingClientRect(); return { navBottom: n.bottom, dockBottom: d.bottom, dockTop: d.top, navScroll: document.querySelector('nav.wa-nav').scrollHeight }; });
  ok('it stays in view at the foot of the menu even though the menu is taller than the screen', Math.abs(dockPos.dockBottom - dockPos.navBottom) < 2 && dockPos.navScroll > 900, dockPos);
  await click(f, '[data-w153grid]'); await f.page.waitForTimeout(250);
  const pop = await f.ev(() => ({ open: document.getElementById('w153pop').classList.contains('open'), tiles: [...document.querySelectorAll('#w153pop .w153tile')].map(t => t.querySelector('b').textContent + (t.classList.contains('on') ? '*' : '')), expanded: document.querySelector('[data-w153grid]').getAttribute('aria-expanded') }));
  ok('the 9 dots open the launcher: the Hub (current), the CRM, the HR centre, Finance, the Admin centre', pop.open && pop.expanded === 'true' && pop.tiles.join('|') === 'Hub*|CRM|HR centre|Finance|Admin centre', pop);
  await shot(f, 'apps_launcher');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(150);
  ok('Escape closes it', await f.ev(() => !document.getElementById('w153pop').classList.contains('open')));
  await click(f, '[data-w153grid]'); await f.page.waitForTimeout(200);
  await click(f, '[data-w153app="crm"]'); await f.page.waitForTimeout(1500);
  s = await state(f);
  ok('the CRM opens as an app: #crm, the menu gives way to the CRM rail, Back to the Hub in the dock', s.hash === '#crm' && s.app === 'crm' && /w153app/.test(s.body) && s.tabBar === 'none' && s.railShown !== 'none' && s.back !== 'none', s);
  let r = await rail(f);
  ok('the rail: Contacts (current), Possible duplicates, Sources, Gifts, Email (wave154), and what comes next', r.join('|') === 'Contacts*|Possible duplicates|Sources|Gifts|Email' && await f.ev(() => /Next in the CRM/i.test(document.getElementById('w153rail').innerText) && /Lists/.test(document.getElementById('w153rail').innerText) && /Forms/.test(document.getElementById('w153rail').innerText)), r);
  ok('the app bar names the app and the place, with Add a contact', /^CRM Contacts/.test(s.bar) && /Add a contact/.test(s.bar), s.bar);
  ok('Search everything becomes the contact search', /Search contacts/.test(s.ph), s.ph);
  ok('the CRM page keeps its own tab strip out of the way on a wide screen (the rail has it)', await f.ev(() => getComputedStyle(document.querySelector('#crm .w152tabs')).display === 'none'));
  await shot(f, 'apps_crm');
  /* search for a contact */
  await f.ev(() => { const i = document.getElementById('globalSearch'); i.value = 'elodie'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await f.page.waitForTimeout(900);
  const sr = await f.ev(() => [...document.querySelectorAll('#searchResults .sr')].map(x => x.textContent.trim().slice(0, 60)));
  ok('typing a name finds the contact first (accent ignored)', sr.length && /^Supporter\s*Élodie Gagnon/.test(sr[0]), sr);
  await click(f, '#searchResults [data-w153c]'); await f.page.waitForTimeout(900);
  s = await state(f);
  ok('and opens their page inside the CRM', s.hash === '#crm/c/5002' && s.app === 'crm' && /^CRM Contacts/.test(s.bar), s);
  /* the rail moves with the address */
  await f.hash('#crm/dupes'); await f.page.waitForTimeout(600);
  r = await rail(f);
  ok('#crm/dupes marks Possible duplicates in the rail and the app bar', r.indexOf('Possible duplicates*') >= 0 && r.indexOf('Contacts*') < 0 && /^CRM Possible duplicates/.test((await state(f)).bar), r);
  /* gifts */
  await click(f, '#w153rail [data-w153go="#crm/gifts"]'); await f.page.waitForTimeout(1500);
  const g = await f.ev(() => ({ hash: location.hash, txt: document.querySelector('#crm .w152root').innerText.replace(/\s+/g, ' '), rows: [...document.querySelectorAll('#crm .w153gifts .w152row')].map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 120)) }));
  ok('Gifts: every gift newest first, the totals, the donors, the receipts', g.hash === '#crm/gifts' && g.rows.length === 3 && /^30 Aug 2026 Amara Okafor/.test(g.rows[0]) && /\$100/.test(g.rows[0]) && /Receipt WA-2026-0042/.test(g.rows[0]) && /\$350 given, all time \(3 gifts\)/.test(g.txt) && /2 donors/.test(g.txt) && /2 with a tax receipt/.test(g.txt) && /monthly/.test(g.rows[2]), g);
  ok('this fiscal year (1 Oct 2025 to 30 Sep 2026) counts all three gifts', /\$350 this fiscal year \(to 30 Sep 2026, 3 gifts\)/.test(g.txt), g.txt.slice(0, 400));
  await f.ev(() => { const i = document.querySelector('[data-w152gq]'); i.value = 'winter'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await f.page.waitForTimeout(400);
  const g2 = await f.ev(() => ({ rows: [...document.querySelectorAll('#crm .w153gifts .w152row')].map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 80)), count: document.querySelector('#crm .w152count').innerText }));
  ok('a search narrows the gifts (a campaign) with the total of what matches', g2.rows.length === 1 && /Priya Raman/.test(g2.rows[0]) && /1 gift matches \(\$125\)/.test(g2.count), g2);
  await f.ev(() => { const s2 = document.querySelector('[data-w152gyear]'); s2.value = '2026'; s2.dispatchEvent(new Event('change', { bubbles: true })); }); await f.page.waitForTimeout(300);
  ok('the fiscal year filter keeps the December 2025 gift (FY 2026 starts 1 Oct 2025)', await f.ev(() => document.querySelectorAll('#crm .w153gifts .w152row').length === 1));
  await click(f, '[data-w152gclear]'); await f.page.waitForTimeout(300);
  ok('Clear the filters brings the three back', await f.ev(() => document.querySelectorAll('#crm .w153gifts .w152row').length === 3));
  await shot(f, 'apps_gifts');
  /* add a contact from the app bar */
  await click(f, '[data-w153act="add"]'); await f.page.waitForTimeout(1200);
  ok('Add a contact in the app bar opens the CRM\'s add form', await f.ev(() => location.hash === '#crm' && !!document.querySelector('#w152sheet [data-w152save]')), await f.ev(() => location.hash));
  await f.ev(() => window.w152.close(true)); await f.page.waitForTimeout(300);
  /* back to the Hub */
  await click(f, '[data-w153back]'); await f.page.waitForTimeout(900);
  s = await state(f);
  ok('Back to the Hub returns to the page left behind (Home), the menu is back', s.hash === '#mypage' && !s.app && s.tabBar !== 'none' && s.railShown === 'none' && /Search everything/.test(s.ph), s);
  await f.hash('#calendar'); await f.page.waitForTimeout(700);
  /* the HR centre */
  await f.ev(() => window.w153.open('hr')); await f.page.waitForTimeout(2600);
  s = await state(f); r = await rail(f);
  ok('the HR centre opens where the page lands (People) with its own sections in the rail, nothing from the Hub', s.app === 'hr' && /^#hrcentre/.test(s.hash) && r.join('|') === 'People*|Onboarding|Training|Recruitment|Commitment|Policies|Discipline' && /^HR CENTRE People/.test(s.bar), { s, r });
  await click(f, '#w153rail [data-w153sec="policies"]'); await f.page.waitForTimeout(2600);
  const hr = await f.ev(() => ({ hash: location.hash, on: (document.querySelector('#hrcentre .w47tab.on') || {}).textContent, rail: [...document.querySelectorAll('#w153rail .w153it.on')].map(a => a.textContent.trim()) }));
  ok('Policies in the rail switches the page\'s tab and the rail follows', hr.hash === '#hrcentre/policies' && hr.on === 'Policies' && hr.rail.join() === 'Policies', hr);
  await click(f, '#hrcentre .w47tab[data-w47v="training"]'); await f.page.waitForTimeout(2600);
  ok('a tab clicked on the page moves the rail too', (await rail(f)).indexOf('Training*') >= 0, await rail(f));
  await shot(f, 'apps_hr');
  await click(f, '[data-w153back]'); await f.page.waitForTimeout(1200);
  s = await state(f);
  ok('Back to the Hub from the HR centre returns to the Hub page left behind (the Calendar)', s.hash === '#calendar' && !s.app && s.tabBar !== 'none', s);
  await f.hash('#hrcentre/policies'); await f.page.waitForTimeout(2600);
  s = await state(f);
  ok('a link straight to an HR centre address opens the HR centre app on its own', s.app === 'hr' && s.railShown !== 'none' && (await rail(f)).indexOf('Policies*') >= 0, s);
  await f.hash('#orgchart'); await f.page.waitForTimeout(1600);
  s = await state(f);
  ok('a Hub page (the Org chart) leaves the app: the menu is back, no rail', s.hash === '#orgchart' && !s.app && s.tabBar !== 'none' && s.railShown === 'none', s);
  /* Finance */
  await f.ev(() => window.w153.open('finance')); await f.page.waitForTimeout(1500);
  r = await rail(f); s = await state(f);
  ok('Finance holds the finances pages only: Overview (current), Trends, Money map, Budget, Transactions', s.app === 'finance' && s.hash === '#finances' && r.join('|') === 'Overview*|Trends|Money map|Budget|Transactions', { s, r });
  await click(f, '#w153rail [data-w153sec="budget"]'); await f.page.waitForTimeout(900);
  const fin = await f.ev(() => ({ on: (document.querySelector('#finances .w94tab.on') || {}).textContent, rail: [...document.querySelectorAll('#w153rail .w153it.on')].map(a => a.textContent.trim()), bar: document.getElementById('w153bar').innerText.replace(/\s+/g, ' ') }));
  ok('Budget in the rail opens the Budget section', fin.on === 'Budget' && fin.rail.join() === 'Budget' && /Finance Budget/i.test(fin.bar), fin);
  await shot(f, 'apps_finance');
  /* the Admin centre */
  await f.ev(() => window.w153.open('admin')); await f.page.waitForTimeout(1500);
  r = await rail(f); s = await state(f);
  ok('the Admin centre: the Admin sections and Activity', s.app === 'admin' && s.hash === '#adminpanel/people' && r[0] === 'People and access*' && r.indexOf('Access profiles') > 0 && r.indexOf('Security and audit trail') > 0 && r[r.length - 1] === 'Activity', { s, r });
  await click(f, '#w153rail [data-w153go="#adminpanel/security"]'); await f.page.waitForTimeout(900);
  ok('a section opens at its address and the rail follows', (await state(f)).hash === '#adminpanel/security' && (await rail(f)).indexOf('Security and audit trail*') >= 0);
  await shot(f, 'apps_admin');
  /* the app survives a reload */
  await f.page.reload(); await f.page.waitForTimeout(5000);
  s = await state(f);
  ok('after a reload the Admin centre is still open on the same page', s.app === 'admin' && s.hash === '#adminpanel/security' && s.railShown !== 'none', s);
  /* the tour */
  ok('the tour is registered and available (tour:apps)', await f.ev(() => !!(window.w122 && window.w122.tours && window.w122.tours.apps && window.w122.tours.apps.avail())));
  const errs = f.errs || [];
  ok('no page errors (admin)', errs.length === 0, errs);
  await f.close();

  /* ---------------- a member on the HR profile ---------------- */
  f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(fx => (fx.hub_access_profiles || []).forEach(p => { p.pages = Object.assign({}, p.pages, { crm: 'all' }); })), wait: 4000 });
  await f.page.waitForTimeout(800);
  const m = await f.ev(() => ({ dock: getComputedStyle(document.getElementById('w153dock')).display !== 'none', apps: ['hub', 'crm', 'hr', 'finance', 'admin'].filter(a => window.w153.ok(a)), fin: window.w153.allowed('finances'), adm: window.w153.allowed('adminpanel') }));
  ok('a member on the HR profile: the dock, with the Hub, the CRM and the HR centre (no Finance, no Admin centre)', m.dock && m.apps.join() === 'hub,crm,hr' && !m.fin && !m.adm, m);
  await f.ev(() => window.w153.open('hr')); await f.page.waitForTimeout(2600);
  r = await rail(f);
  ok('their HR centre shows its notice (admins and leaders), so the rail is the page alone, nothing from the Hub', r.join('|') === 'HR centre*', r);
  ok('no page errors (member)', (f.errs || []).length === 0, f.errs);
  await f.close();

  /* ---------------- a director (the board view) ---------------- */
  f = await fresh(browser, { who: 'board', hash: '#governance', fixture: fixture(), wait: 4000 });
  await f.page.waitForTimeout(800);
  const b = await f.ev(() => ({ dock: document.getElementById('w153dock') ? getComputedStyle(document.getElementById('w153dock')).display : 'absent', apps: ['crm', 'hr', 'finance', 'admin'].filter(a => window.w153.ok(a)), app: window.w153.current() }));
  ok('a director gets no dock and no app', b.dock !== 'flex' && b.apps.length === 0 && !b.app, b);
  ok('no page errors (board)', (f.errs || []).length === 0, f.errs);
  await f.close();

  /* ---------------- a phone ---------------- */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#crm', fixture: fixture(), wait: 4000 });
  await f.page.waitForTimeout(1000);
  s = await state(f);
  const ph = await f.ev(() => ({ menuBtn: getComputedStyle(document.querySelector('#w153bar .w153menu')).display, drawer: document.body.classList.contains('wa-mob-open'), wide: document.documentElement.scrollWidth <= innerWidth + 1, tabs: getComputedStyle(document.querySelector('#crm .w152tabs')).display }));
  ok('on a phone the CRM opens as an app with Menu in the app bar and its tab strip kept', s.app === 'crm' && ph.menuBtn !== 'none' && !ph.drawer && ph.wide && ph.tabs !== 'none', { s, ph });
  await click(f, '[data-w153menu]'); await f.page.waitForTimeout(500);
  const ph2 = await f.ev(() => ({ drawer: document.body.classList.contains('wa-mob-open'), rail: getComputedStyle(document.getElementById('w153rail')).display, items: [...document.querySelectorAll('#w153rail .w153it')].length, dockIn: document.getElementById('w153dock').getBoundingClientRect().bottom <= innerHeight + 1 }));
  ok('Menu opens the drawer with the CRM rail and the dock at its foot', ph2.drawer && ph2.rail !== 'none' && ph2.items === 5 && ph2.dockIn, ph2);
  await shot(f, 'apps_phone_rail');
  await click(f, '#w153rail [data-w153go="#crm/sources"]'); await f.page.waitForTimeout(800);
  ok('a rail item closes the drawer and opens the page', await f.ev(() => !document.body.classList.contains('wa-mob-open') && location.hash === '#crm/sources'));
  await click(f, '[data-w153menu]'); await f.page.waitForTimeout(300);
  await click(f, '[data-w153grid]'); await f.page.waitForTimeout(300);
  const ph3 = await f.ev(() => { const p = document.getElementById('w153pop').getBoundingClientRect(); return { open: document.getElementById('w153pop').classList.contains('open'), fits: p.left >= 0 && p.right <= innerWidth + 1 && p.top >= 0 }; });
  ok('the launcher fits the phone screen', ph3.open && ph3.fits, ph3);
  await shot(f, 'apps_phone_launcher');
  ok('no page errors (phone)', (f.errs || []).length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw153drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
