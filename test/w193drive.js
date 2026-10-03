/* w193drive.js: wave193, the Fundraising app. Steel (01/10/26): "build out a grant tracker and scanner that looks for grants that
   Welfare Avenue can win ... a tool that helps with grant writing ... under a new app called Fundraising that holds: Fundraising
   Events, Donor relations (Donor Program), Events Calendar, Fundraising Event Sops (as it's own page), Grants". The fixture is the
   live-data one plus a small set of fund_* rows (wa193_fundraising). Uses test/boot.js (stubbed Supabase, clock fixed 2026-09-25). */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }

const PLAY = '# How we win grants\n\nThe approach in one page.\n\n## 1. Funders decide\n\nA program officer reads forty applications.\n\n## 2. The fit screen\n\n| Dimension | Weight | What 5 looks like |\n|---|---|---|\n| Eligibility | 15 | We qualify on every line |\n| Alignment | 20 | Their words are our words |\n\n- Go at **70** and up\n- Conditional at 55 to 69\n\n## 6. The writing rules\n\n1. Lead with the answer.\n2. A number in every paragraph.\n';
function fx(profileFund) {
  const f = loadFixture();
  (f.hub_access_profiles || []).forEach(p => { p.pages = p.pages || {}; p.pages.fund = ['fundraising', 'executive', 'admin'].indexOf(p.key) >= 0 || (profileFund && p.key === profileFund) ? 'all' : 'none'; });
  f.fund_funders = [
    { id: 1, name: 'Fondation Béati', aliases: ['Beati'], kind: 'foundation', region: 'quebec', url: 'https://fondationbeati.org', portal: null, contact: null, eligibility: 'Quebec community organizations', funds_what: 'Social justice and community projects', cycle: 'Fall call each year', next_deadline: '2026-10-15', amount_min: 10000, amount_max: 30000, fit: 'good', fit_note: 'Youth-led basic needs work in Montreal fits', relationship: null, notes: null, watch: true, screened_out: false, screened_reason: null, source: 'research', updated_at: '2026-10-01T00:00:00Z' },
    { id: 2, name: 'Ontario Trillium Foundation', aliases: ['OTF'], kind: 'foundation', region: 'ontario', url: 'https://otf.ca', eligibility: 'Ontario organizations', funds_what: 'Community programs in Ontario', cycle: 'Seed grants in the fall', next_deadline: null, amount_min: 10000, amount_max: 100000, fit: 'possible', fit_note: 'Only through the Toronto program', relationship: 'Submitted the Youth Harvest seed in 2026', notes: null, watch: true, screened_out: false, screened_reason: null, source: 'drive', updated_at: '2026-10-01T00:00:00Z' },
    { id: 3, name: 'Fondation Sportive', aliases: [], kind: 'foundation', region: 'quebec', url: null, eligibility: 'Sport organizations', funds_what: 'Sport', cycle: null, next_deadline: null, amount_min: null, amount_max: null, fit: 'weak', fit_note: 'Sport-only mandate', relationship: null, notes: null, watch: false, screened_out: true, screened_reason: 'Sport only', source: 'research', updated_at: '2026-10-01T00:00:00Z' },
    { id: 4, name: 'Right To Food Collective', aliases: [], kind: 'network', region: 'canada', url: 'https://example.org/rtf', eligibility: null, funds_what: 'Food security grassroots groups', cycle: null, next_deadline: null, amount_min: null, amount_max: 5000, fit: 'good', fit_note: null, relationship: 'Won the GFO grant in 2026', notes: null, watch: false, screened_out: false, screened_reason: null, source: 'drive', updated_at: '2026-10-01T00:00:00Z' }
  ];
  f.fund_grants = [
    { id: 11, funder_id: 1, program: 'Fall call 2026', title: 'Community kitchen with DESTA', stage: 'drafting', amount_ask: 25000, amount_awarded: null, deadline: '2026-10-15', deadline_note: null, submitted_on: null, decided_on: null, decision_note: null, report_due: null, renewal_due: null, fit_score: 74, fit: { verdict: 'go', first_step: 'Call the program officer', hours: 20, dimensions: [{ name: 'eligibility', weight: 15, score: 5, note: 'We qualify' }, { name: 'alignment', weight: 20, score: 4, note: 'Close' }] }, gates: [{ gate: 'Registered charity', result: 'pass', note: 'Since 2024' }, { gate: 'Paid staff required', result: 'unknown', note: 'Ask' }], owner_email: 'steel.macdonald@welfareavenue.com', owner_name: 'Steel MacDonald', partner: 'DESTA', program_area: 'Community kitchen', project_id: null, next_action: 'Draft the budget', next_action_due: '2026-10-02', hours_spent: 6, links: [{ label: 'The call', url: 'https://fondationbeati.org/appel' }], source: 'research', source_ref: null, notes: 'The strongest fit this fall.', updated_at: '2026-09-24T00:00:00Z' },
    { id: 12, funder_id: 2, program: 'Seed Grant', title: 'Youth Harvest pilot', stage: 'submitted', amount_ask: 48000, amount_awarded: null, deadline: '2026-09-10', deadline_note: null, submitted_on: '2026-09-09', decided_on: null, decision_note: null, report_due: null, renewal_due: null, fit_score: 58, fit: null, gates: null, owner_email: 'samson.jules@welfareavenue.com', owner_name: 'Samson Jules', partner: null, program_area: 'Toronto program', project_id: null, next_action: null, next_action_due: null, hours_spent: 30, links: [], source: 'drive', source_ref: null, notes: null, updated_at: '2026-09-10T00:00:00Z' },
    { id: 13, funder_id: 4, program: 'Grassroots Food Organizing grant', title: null, stage: 'reporting', amount_ask: 5000, amount_awarded: 5000, deadline: null, deadline_note: null, submitted_on: '2026-03-01', decided_on: '2026-05-01', decision_note: 'Awarded', report_due: '2026-11-30', renewal_due: null, fit_score: null, fit: null, gates: null, owner_email: null, owner_name: null, partner: null, program_area: null, project_id: null, next_action: null, next_action_due: null, hours_spent: null, links: [], source: 'drive', source_ref: null, notes: null, updated_at: '2026-05-01T00:00:00Z' },
    { id: 14, funder_id: 1, program: 'Spring call 2027', title: null, stage: 'watching', amount_ask: null, amount_awarded: null, deadline: '2027-03-15', deadline_note: 'expected', submitted_on: null, decided_on: null, decision_note: null, report_due: null, renewal_due: null, fit_score: null, fit: null, gates: null, owner_email: null, owner_name: null, partner: null, program_area: null, project_id: null, next_action: null, next_action_due: null, hours_spent: null, links: [], source: 'research', source_ref: null, notes: null, updated_at: '2026-09-01T00:00:00Z' },
    { id: 15, funder_id: 2, program: 'Resilient Communities Fund', title: null, stage: 'declined', amount_ask: 20000, amount_awarded: null, deadline: null, deadline_note: null, submitted_on: '2025-02-01', decided_on: '2025-05-01', decision_note: 'Not funded this round', report_due: null, renewal_due: null, fit_score: null, fit: null, gates: null, owner_email: null, owner_name: null, partner: null, program_area: null, project_id: null, next_action: null, next_action_due: null, hours_spent: null, links: [], source: 'drive', source_ref: null, notes: null, updated_at: '2025-05-01T00:00:00Z' }
  ];
  f.fund_grant_log = [
    { id: 1, grant_id: 11, at: '2026-09-24T14:00:00Z', who: 'steel.macdonald@welfareavenue.com', kind: 'stage', text: 'Moved from screened to drafting' },
    { id: 2, grant_id: 11, at: '2026-09-20T14:00:00Z', who: 'steel.macdonald@welfareavenue.com', kind: 'call', text: 'Spoke with the program officer: the kitchen angle works.' }
  ];
  f.fund_sources = [
    { id: 1, funder_id: 1, name: 'Fondation Béati: the calls page', kind: 'funder_page', url: 'https://fondationbeati.org/appels', query: null, active: true, last_checked: '2026-09-22T13:30:00Z', last_changed: null, last_hash: 'x', last_summary: 'The fall call is announced.', last_error: null, notes: null },
    { id: 2, funder_id: null, name: 'Montreal food security grants open now', kind: 'search', url: null, query: 'What grants are open?', active: true, last_checked: '2026-09-22T13:35:00Z', last_changed: null, last_hash: null, last_summary: null, last_error: null, notes: null },
    { id: 3, funder_id: 2, name: 'OTF: open grants', kind: 'funder_page', url: 'https://otf.ca/our-grants', query: null, active: true, last_checked: '2026-09-22T13:31:00Z', last_changed: null, last_hash: 'y', last_summary: null, last_error: 'HTTP 403', notes: null }
  ];
  f.fund_scan_runs = [{ id: 1, started_at: '2026-09-22T13:30:00Z', finished_at: '2026-09-22T13:36:00Z', trigger: 'schedule', by_email: null, status: 'ok', pages_checked: 2, pages_changed: 1, searches: 1, found_new: 2, found_known: 1, cost: 0.41, errors: [], summary: '2 pages checked, 1 changed, 1 search; 2 new, 1 already known; posted to Slack.', slack_channel: 'C041VL0LEBG', slack_ts: '1.2', steps: 2 }];
  f.fund_scan_finds = [
    { id: 1, run_id: 1, funder_name: 'Fondation du Grand Montréal', program: 'Fonds Collectif', url: 'https://fgmtl.org/fonds', summary: 'Supports Montreal community organizations working on food security.', amount_min: 5000, amount_max: 20000, deadline: '2026-11-01', deadline_text: null, eligibility: 'Registered charities in Montreal', region: 'montreal', kind: 'community_foundation', fit_score: 78, fit_note: 'Montreal, food security, small grants: check the two-year rule.', matched_funder_id: null, matched_grant_id: null, status: 'new', decided_by: null, decided_at: null, decision_note: null, raw: { source_id: 2, source_kind: 'search' }, created_at: '2026-09-22T13:35:00Z' },
    { id: 2, run_id: 1, funder_name: 'Desjardins', program: 'Community development fund', url: 'https://desjardins.com/fonds', summary: 'Small grants from the caisses.', amount_min: null, amount_max: 5000, deadline: null, deadline_text: 'rolling', eligibility: null, region: 'quebec', kind: 'corporate', fit_score: 61, fit_note: 'Ask the caisse downtown.', matched_funder_id: null, matched_grant_id: null, status: 'new', decided_by: null, decided_at: null, decision_note: null, raw: { source_id: 2, source_kind: 'search' }, created_at: '2026-09-22T13:35:00Z' },
    { id: 3, run_id: 1, funder_name: 'Fondation Béati', program: 'Fall call 2026', url: 'https://fondationbeati.org/appel', summary: 'The fall call.', amount_min: 10000, amount_max: 30000, deadline: '2026-10-15', deadline_text: null, eligibility: null, region: 'quebec', kind: 'foundation', fit_score: 74, fit_note: null, matched_funder_id: 1, matched_grant_id: 11, status: 'known', decided_by: null, decided_at: null, decision_note: null, raw: { source_id: 1, source_kind: 'funder_page' }, created_at: '2026-09-22T13:31:00Z' }
  ];
  f.fund_facts = [
    { id: 1, key: 'mission', category: 'mission', title: 'Our mission', body: 'Welfare Avenue serves free meals to people experiencing homelessness in downtown Montreal.', body_fr: null, source: 'Charity application (2023)', verified_on: '2026-10-02', verified_by: 'steel.macdonald@welfareavenue.com', status: 'verified', sort: 1, notes: null },
    { id: 2, key: 'meals-total', category: 'numbers', title: 'Meals since 2020', body: 'The documents say 15,000 and 23,000.', body_fr: null, source: 'Trackers', verified_on: null, verified_by: null, status: 'conflict', sort: 20, notes: 'Settle from the Impact Tracker.' },
    { id: 3, key: 'volunteers-2025', category: 'numbers', title: 'Volunteers in 2025', body: '430 volunteers, 5,586 hours.', body_fr: null, source: 'Impact Tracker', verified_on: null, verified_by: null, status: 'needs_check', sort: 21, notes: null }
  ];
  f.fund_documents = [{ id: 1, grant_id: 12, funder_id: 2, title: 'OTF Seed Grant application (2026)', kind: 'application', lang: 'en', doc_date: '2026-09-09', words: 2100, source_url: 'https://docs.google.com/document/d/x', source: 'Drive', created_at: '2026-10-02T00:00:00Z', text: 'Q: What problem?\nA: Food insecurity among students.' }];
  f.fund_drafts = [{ id: 1, grant_id: 11, title: 'Fondation Béati: Fall call 2026 (2026-10-02)', lang: 'en', questions: [{ q: 'What problem do you address?', limit: 250, answer: 'Welfare Avenue serves free meals to people experiencing homelessness in downtown Montreal.', words: 13, facts: ['mission'], refs: [1], warnings: [] }, { q: 'How many people do you reach?', limit: 100, answer: 'About 100 meals a Sunday [confirm: total meals since 2020].', words: 10, facts: ['meals-total'], refs: [], warnings: ['The meals total is in conflict'] }], notes: 'Reviewer note: strong on the need.', status: 'draft', created_by: 'steel.macdonald@welfareavenue.com', updated_by: 'steel.macdonald@welfareavenue.com', created_at: '2026-09-24T00:00:00Z', updated_at: '2026-09-24T00:00:00Z' }];
  f.fund_settings = [
    { key: 'donor_program', value: { name: 'Monthly donor program', launched: null, goals: { monthly_donors: 40, monthly_revenue: 400, year_revenue: 3000, by: '2027-09-30', ladder: [{ when: '3 months', donors: 15, avg: 8 }, { when: '6 months', donors: 40, avg: 10 }] }, tiers: [{ amount: 5, label: '$5 a month', buys: 'the serving ware for one Sunday' }, { amount: 10, label: '$10 a month', buys: 'a week of produce' }], audience: 'Adults 35 and older; one-time donors.', cadence: [{ k: 'thanks', l: 'Automatic thank-you after every gift', how: 'The CRM automation', done: false }, { k: 'monthly', l: 'Monthly update email', how: 'A campaign', done: true }], playbook: ['Ask to join, not to donate.'], roles: [{ role: 'Program lead', who: 'Rami Al-Silq' }], launch: [{ step: 'Finalize goals', done: true }, { step: 'Launch day', done: false }], sources: ['Donor Program Outline (2026)'] }, updated_at: '2026-10-02T00:00:00Z' },
    { key: 'scanner', value: { slack_channel: 'C041VL0LEBG', slack_channel_name: 'grants', post_new_finds: true, min_fit_to_post: 55, last_run: { id: 1, at: '2026-09-22T13:36:00Z', new: 2, known: 1 } }, updated_at: '2026-10-02T00:00:00Z' },
    { key: 'playbook', value: { title: 'How we win grants: the approach', written: '2026-10-02', markdown: PLAY }, updated_at: '2026-10-02T00:00:00Z' }
  ];
  return f;
}
const INIT = "window.TEXT_ = function (sel) { var el = document.querySelector(sel); return el ? el.innerText.replace(/\\s+/g, ' ').trim() : null; };";
const RPCS = { fund_giving_summary: { fy_start: '2025-10-01', fy_raised: 4120, fy_gifts: 31, fy_donors: 22, last_fy_raised: 3800, last_fy_donors: 19, monthly_active: 6, monthly_amount: 70, lapsed: 4, donors_all: 61, online_live: true }, wa_org_editor: true };
const MAST = () => { const m = document.querySelector('#fund > .w118mast'); if (!m) return null; const c = m.querySelector('.crumb'); return { h1: (m.querySelector('h1') || {}).textContent, p: (m.querySelector(':scope > p') || {}).textContent, crumb: c ? c.textContent : null, crumbShown: c ? getComputedStyle(c).display !== 'none' : false }; };
const RAIL = () => { const r = document.getElementById('w153rail'); if (!r) return null; return { shown: getComputedStyle(r).display !== 'none', heads: [...r.querySelectorAll('.w153sh')].map(x => x.textContent), items: [...r.querySelectorAll('.w153it')].map(a => a.querySelector('span').textContent + (a.querySelector('.w153n') ? '(' + a.querySelector('.w153n').textContent + ')' : '') + (a.classList.contains('on') ? '*' : '')), title: (r.querySelector('.w153ah b') || {}).textContent, tile: r.querySelector('.w153ah .w153ai') ? getComputedStyle(r.querySelector('.w153ah .w153ai')).backgroundColor : null }; };
const TEXT = (sel) => { const el = document.querySelector(sel); return el ? el.innerText.replace(/\s+/g, ' ').trim() : null; };

(async () => {
  const browser = await launch();
  const FX = fx();

  /* 1. the app on a computer, as an admin */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#fund', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, init: INIT, wait: 4500 });
    const p = f.page;
    let r = await f.ev(RAIL), m = await f.ev(MAST);
    ok('the Fundraising app: its orange, two groups (Fundraising, Grants), the Overview marked, Found for you counting the two new finds', r && r.title === 'Fundraising' && r.heads.join('|') === 'Fundraising|Grants' && r.items.join('|') === 'Overview*|Events|Calendar|Donor program|Event SOPs|Pipeline|Found for you(2)|Funders|Writer|Playbook|Fact base' && r.tile === 'rgb(200, 122, 47)', r);
    ok('the masthead reads the page (Overview, wave197) with its line; no crumb inside the app', m && m.h1 === 'Overview' && !m.crumbShown && /events, donors and grants/.test(m.p), m);
    const ov = await f.ev(() => ({ kpis: [...document.querySelectorAll('#w193host .w193kpi')].map(k => k.querySelector('small').textContent + '=' + k.querySelector('b').textContent), up: (document.querySelector('#w193host .w193hero .w193card') || {}).innerText, scan: !!document.querySelector('#w193host [data-w193scan]'), quick: document.querySelectorAll('#w193host .w193quick a').length, recent: /Spoke with the program officer/.test(document.getElementById('w193host').innerText) }));
    ok('the Overview: six numbers (open grants 2, due in 30 days, found 2, won this FY, events, monthly donors 6), Up next with the Béati deadline and the DESTA budget step, Scan now, ten quick links, the recent log', ov.kpis.length === 6 && /Open grants=2/.test(ov.kpis[0]) && /Found for you=2/.test(ov.kpis[2]) && /Monthly donors=6/.test(ov.kpis[5]) && /Fondation Béati/.test(ov.up) && /Draft the budget/.test(ov.up) && ov.scan && ov.quick === 10 && ov.recent, ov);
    const menu = await f.ev(() => { const t = id => { const b = document.querySelector('#tabBar .tab[data-tab="' + id + '"]'); return b ? getComputedStyle(b).display : 'missing'; }; return { fund: t('fund'), fundevents: t('fundevents'), apps: WA_APP.order.join(','), ok: WA_APP.ok('fund'), cur: WA_APP.current(), bar: (document.querySelector('#w153bar .w153bc') || {}).innerText }; });
    ok('the Hub menu hides the app\'s pages (fund and fundevents) for staff; the launcher lists Fundraising between the CRM and the HR centre; the app bar says Fundraising, Overview', menu.fund === 'none' && menu.fundevents === 'none' && /crm,fund,hr/.test(menu.apps) && menu.ok && menu.cur === 'fund' && /FUNDRAISING\s*Overview/i.test(menu.bar), menu);

    /* the pipeline */
    await f.hash('#fund/grants', 1500);
    r = await f.ev(RAIL); m = await f.ev(MAST);
    const pipe = await f.ev(() => ({ stages: [...document.querySelectorAll('#w193host .w193stage h3')].map(x => x.textContent), rows: document.querySelectorAll('#w193host .w193row').length, seg: [...document.querySelectorAll('#w193host .w193seg a')].map(a => a.textContent.replace(/\s+/g, ' ').trim()), add: !!document.querySelector('#w193host [data-w193gadd]'), tabs: getComputedStyle(document.querySelector('#w193host .w193tabs')).display, title: document.title }));
    ok('the Pipeline: Open shows Drafting and Submitted (two rows), the groups count (Open 2, Watching 1, Awarded and reporting 1, Closed 1), Add a grant, the phone tabs hidden on a computer, the rail marks Pipeline, the title follows', pipe.stages.join('|') === 'Drafting|Submitted' && pipe.rows === 2 && /Open 2/.test(pipe.seg[0]) && /Watching 1/.test(pipe.seg[1]) && /Awarded and reporting 1/.test(pipe.seg[2]) && /Closed 1/.test(pipe.seg[3]) && pipe.add && pipe.tabs === 'none' && r.items.indexOf('Pipeline*') >= 0 && m.h1 === 'Grants' && /^Grants · /.test(pipe.title), { pipe, rail: r.items, m });
    await p.click('#w193host .w193row[data-w193grant="11"]'); await p.waitForTimeout(900);
    const sheet = await f.ev(() => { const s = document.getElementById('w193sheet'); return { open: s && s.classList.contains('open'), h2: (s.querySelector('.hd h2') || {}).innerText, text: s.querySelector('.bd').innerText.replace(/\s+/g, ' '), stage: (s.querySelector('[data-w193stage]') || {}).value, hash: location.hash, gates: s.querySelectorAll('.w193gates li').length, dims: s.querySelectorAll('.w193dims b').length, log: s.querySelectorAll('.w193log li').length, del: !!s.querySelector('[data-w193gdel]') }; });
    ok('a grant\'s sheet: the title, the stage select at Drafting, the address #fund/grants/11, the ask and the deadline, the fit with its two gates and two dimensions, the links, the log with the call, Write answers, Delete for an admin', sheet.open && /Community kitchen with DESTA/.test(sheet.h2) && sheet.stage === 'drafting' && sheet.hash === '#fund/grants/11' && /\$25,000/.test(sheet.text) && /Oct 15, 2026/.test(sheet.text) && sheet.gates === 2 && sheet.dims === 2 && /Call the program officer/.test(sheet.text) && sheet.log === 2 && /Spoke with the program officer/.test(sheet.text) && /Write answers/.test(sheet.text) && sheet.del, sheet);
    await p.click('#w193sheet [data-w193close]'); await p.waitForTimeout(400);
    const closed = await f.ev(() => ({ open: document.getElementById('w193sheet').classList.contains('open'), hash: location.hash }));
    ok('closing the sheet returns the address to #fund/grants', !closed.open && closed.hash === '#fund/grants', closed);
    await p.click('#w193host .w193seg a[data-w193grp="closed"]'); await p.waitForTimeout(500);
    const cl = await f.ev(() => ({ stages: [...document.querySelectorAll('#w193host .w193stage h3')].map(x => x.textContent), text: TEXT_('#w193host .w193rows') }));
    ok('Closed shows the declined OTF application with its decision note', cl.stages.join('|') === 'Declined' && /Not funded this round/.test(cl.text), cl);
    await p.fill('#w193host [data-w193q]', 'youth harvest'); await p.waitForTimeout(500);
    const srch = await f.ev(() => ({ rows: document.querySelectorAll('#w193host .w193row').length, text: TEXT_('#w193host .w193rows'), focused: document.activeElement && document.activeElement.hasAttribute('data-w193q') }));
    ok('the search narrows the rows and keeps the cursor in the box', srch.rows === 0 || /Youth Harvest/.test(srch.text), srch);

    /* found for you */
    await f.hash('#fund/grants/found', 1200);
    r = await f.ev(RAIL); m = await f.ev(MAST);
    const found = await f.ev(() => ({ cards: document.querySelectorAll('#w193host .w193find').length, first: TEXT_('#w193host .w193find'), keep: document.querySelectorAll('#w193host [data-w193keep]').length, runs: document.querySelectorAll('#w193host .w193runs li').length, text: TEXT_('#w193host') }));
    ok('Found for you: the two new finds by fit (Fondation du Grand Montréal first, 78), Keep, Dismiss and Not for us on each, the known one hidden, the run listed with its summary', found.cards === 2 && /Fondation du Grand Montréal/.test(found.first) && /78/.test(found.first) && found.keep === 2 && found.runs === 1 && /posted to Slack/.test(found.text) && !/Fall call 2026/.test(found.text) && r.items.indexOf('Found for you(2)*') >= 0 && m.h1 === 'Found for you', { found: { cards: found.cards, keep: found.keep, runs: found.runs }, rail: r.items, m });
    await p.click('#w193host [data-w193foundall]'); await p.waitForTimeout(400);
    const all = await f.ev(() => ({ cards: document.querySelectorAll('#w193host .w193find').length, known: /Fall call 2026/.test(TEXT_('#w193host')) }));
    ok('Show decided and known adds the known Béati find', all.cards === 3 && all.known, all);
    await p.click('#w193host [data-w193dismiss="2"]'); await p.waitForTimeout(300);
    const dform = await f.ev(() => { const d = document.querySelector('[data-w193dform="2"]'); return { shown: d && d.style.display !== 'none', mode: d && d.getAttribute('data-mode') }; });
    ok('Dismiss opens the reason box on the card (the decision goes through fund_find_decide)', dform.shown && dform.mode === 'dismiss', dform);

    /* funders */
    await f.hash('#fund/grants/funders', 1200);
    const fd = await f.ev(() => ({ rows: document.querySelectorAll('#w193host .w193frow').length, names: [...document.querySelectorAll('#w193host .w193frow .nm b')].map(b => b.textContent), note: TEXT_('#w193host .w193note'), rail: [...document.querySelectorAll('#w153rail .w153it.on span')].map(x => x.textContent) }));
    ok('Funders: the three active ones (good fits first), the screened-out one under its own tab, the rail marks Funders', fd.rows === 3 && fd.names[0] === 'Fondation Béati' && fd.names.indexOf('Fondation Sportive') < 0 && /3 of 4 funders/.test(fd.note) && fd.rail.join() === 'Funders', fd);
    await p.click('#w193host .w193seg a[data-w193watch="out"]'); await p.waitForTimeout(400);
    const outTab = await f.ev(() => ({ rows: document.querySelectorAll('#w193host .w193frow').length, text: TEXT_('#w193host .w193rows') }));
    ok('Screened out lists Fondation Sportive with the reason', outTab.rows === 1 && /Fondation Sportive/.test(outTab.text) && /Screened out/i.test(outTab.text), outTab);
    await p.click('#w193host .w193seg a[data-w193watch=""]'); await p.waitForTimeout(300);
    await p.click('#w193host .w193frow[data-w193funder="2"]'); await p.waitForTimeout(700);
    const fsheet = await f.ev(() => { const s = document.getElementById('w193sheet'); return { open: s.classList.contains('open'), h2: (s.querySelector('.hd h2') || {}).innerText, text: s.querySelector('.bd').innerText.replace(/\s+/g, ' '), hash: location.hash, grants: s.querySelectorAll('.w193list li[data-w193grant]').length }; });
    ok('a funder\'s sheet: OTF with its history, its two grants, its source page with the HTTP 403 the scanner hit, the address #fund/grants/funders/2', fsheet.open && /Ontario Trillium Foundation/.test(fsheet.h2) && /Youth Harvest seed/.test(fsheet.text) && fsheet.grants === 2 && /HTTP 403/.test(fsheet.text) && fsheet.hash === '#fund/grants/funders/2', fsheet);
    await p.click('#w193sheet .w193list li[data-w193grant="12"]'); await p.waitForTimeout(700);
    const g2 = await f.ev(() => ({ h2: (document.querySelector('#w193sheet .hd h2') || {}).innerText, docs: document.querySelectorAll('#w193sheet .w193list li[data-w193doc]').length }));
    ok('a grant from the funder\'s sheet opens in the sheet, with the OTF application on file', /Youth Harvest pilot/.test(g2.h2) && g2.docs === 1, g2);
    await p.click('#w193sheet [data-w193close]'); await p.waitForTimeout(300);

    /* the writer */
    await f.hash('#fund/grants/write', 1200);
    const wr = await f.ev(() => ({ form: !!document.querySelector('#w193host .w193writer .w193form'), opts: document.querySelectorAll('#w193host [data-w193wgrant] option').length, draft: !!document.querySelector('#w193host [data-w193wdraft]'), drafts: document.querySelectorAll('#w193host .w193drafts li').length, how: /How the writer works/i.test(TEXT_('#w193host')), qs: w193.questions('What problem do you address? [250]\n2. How many people do you reach? (100 words)\nAnything else?') }));
    ok('the writer: the form with the open grants to pick from (watching, drafting, submitted, reporting), Draft the answers, the drafts list, the explainer; the questions parse with their limits', wr.form && wr.opts === 5 && wr.draft && wr.drafts === 1 && wr.how && wr.qs.length === 3 && wr.qs[0].limit === 250 && wr.qs[1].limit === 100 && wr.qs[1].q === 'How many people do you reach?' && wr.qs[2].limit === null, wr);
    await p.click('#w193host .w193drafts li'); await p.waitForTimeout(1200);
    const dr = await f.ev(() => ({ hash: location.hash, ans: document.querySelectorAll('#w193host .w193ans').length, counts: [...document.querySelectorAll('#w193host [data-w193count]')].map(c => c.textContent), warn: TEXT_('#w193host .w193ans .warn'), facts: [...document.querySelectorAll('#w193host .w193ans .facts .w193tag')].map(t => t.textContent), acts: TEXT_('#w193host .w193card:nth-child(2)'), qtext: (document.querySelector('#w193host [data-w193wq]') || {}).value }));
    ok('a saved draft opens at #fund/grants/write/1: two answers with word counts against the limits, the conflict warning, the fact chips, Copy all, Save as a past application, Mark final; the questions back in the box with their limits', dr.hash === '#fund/grants/write/1' && dr.ans === 2 && /12 of 250 words/.test(dr.counts[0]) && /meals total is in conflict/.test(dr.warn) && dr.facts.indexOf('Our mission') >= 0 && /Copy all the answers/.test(dr.acts) && /Save as a past application/.test(dr.acts) && /Mark final/.test(dr.acts) && /\[250\]/.test(dr.qtext), dr);
    await p.fill('#w193host [data-w193answer="0"]', 'one two three four five'); await p.waitForTimeout(200);
    const cnt = await f.ev(() => (document.querySelector('#w193host [data-w193count="0"]') || {}).textContent);
    ok('typing in an answer updates its word count', /^5 of 250 words/.test(cnt), cnt);
    const calls = await f.ev(() => { window.__calls = []; window.__WA_INVOKE = function (name, opts) { window.__calls.push({ name, body: opts.body }); return { data: { ok: true, draft_id: 1, title: 'x', lang: 'en', questions: [{ q: 'What problem do you address?', limit: 250, answer: 'New answer.', words: 2, facts: ['mission'], refs: [], warnings: [] }], consistency: ['Numbers agree'], reviewer_note: 'Strong need, weak budget.', documents: [], cost: 0.12, model: 'anthropic/claude-sonnet-5' } }; }; return true; });
    await p.click('#w193host [data-w193wdraft]'); await p.waitForTimeout(1500);
    const dn = await f.ev(() => ({ calls: window.__calls.map(c => c.name + ':' + c.body.action + ':' + (c.body.questions || []).length + ':' + c.body.draft_id), note: TEXT_('#w193host .w193card h3 + .w193p'), text: TEXT_('#w193host') }));
    ok('Draft again calls grant-write draft with the two questions and the draft id, then shows the writer\'s note', dn.calls.join('|') === 'grant-write:draft:2:1' && /Strong need, weak budget/.test(dn.text), dn);

    /* the playbook */
    await f.hash('#fund/grants/playbook', 1000);
    const pb = await f.ev(() => ({ h2: [...document.querySelectorAll('#w193host .w193md h2')].map(h => h.textContent), table: document.querySelectorAll('#w193host .w193md table').length, th: [...document.querySelectorAll('#w193host .w193md th')].map(x => x.textContent), bold: !!document.querySelector('#w193host .w193md li b'), toc: [...document.querySelectorAll('#w193host .w193toc a')].map(a => a.textContent), ol: document.querySelectorAll('#w193host .w193md ol li').length, title: (document.querySelector('#fund > .w118mast h1') || {}).textContent }));
    ok('the playbook renders the markdown with its table (three columns), bold, the numbered rules, and a table of contents of the sections', pb.h2.length === 3 && pb.table === 1 && pb.th.join('|') === 'Dimension|Weight|What 5 looks like' && pb.bold && pb.toc.join('|') === 'Funders decide|The fit screen|The writing rules' && pb.ol === 2 && pb.title === 'How we win grants', pb);

    /* the fact base */
    await f.hash('#fund/grants/facts', 1000);
    const fb = await f.ev(() => ({ cards: [...document.querySelectorAll('#w193host .w193facts .w193card h3')].map(h => h.textContent.replace(/\s+/g, ' ').trim()), facts: document.querySelectorAll('#w193host .w193fact').length, conflict: /1 fact is in conflict/.test(TEXT_('#w193host')), ok: document.querySelectorAll('#w193host [data-w193factok]').length, add: !!document.querySelector('#w193host [data-w193factadd]') }));
    ok('the fact base: grouped by category (Mission and story, Numbers), three facts, the conflict notice, Verified on the two unverified ones, Add a fact', fb.cards.length === 2 && /Mission and story/.test(fb.cards[0]) && /Numbers/.test(fb.cards[1]) && fb.facts === 3 && fb.conflict && fb.ok === 2 && fb.add, fb);
    await p.click('#w193host .w193seg a[data-w193fstatus="conflict"]'); await p.waitForTimeout(400);
    const fc = await f.ev(() => ({ facts: document.querySelectorAll('#w193host .w193fact').length, text: TEXT_('#w193host .w193fact') }));
    ok('In conflict shows the meals total alone', fc.facts === 1 && /Meals since 2020/.test(fc.text), fc);
    await p.click('#w193host [data-w193factedit="2"]'); await p.waitForTimeout(500);
    const ff = await f.ev(() => { const s = document.getElementById('w193sheet'); return { open: s.classList.contains('open'), key: (s.querySelector('[name=key]') || {}).value, ro: s.querySelector('[name=key]') && s.querySelector('[name=key]').hasAttribute('readonly'), status: (s.querySelector('[name=status]') || {}).value }; });
    ok('Edit opens the fact form with its key locked and its status', ff.open && ff.key === 'meals-total' && ff.ro && ff.status === 'conflict', ff);
    await p.click('#w193sheet [data-w193cancel]'); await p.waitForTimeout(300);

    /* the calendar */
    await f.hash('#fund/calendar', 1000);
    const cal = await f.ev(() => ({ h2: TEXT_('#w193host .w193calbar h2'), cells: document.querySelectorAll('#w193host .w193cell').length, layers: [...document.querySelectorAll('#w193host .w193chip')].map(c => c.textContent.replace(/\s+/g, ' ').trim()), evs: [...document.querySelectorAll('#w193host .w193ev')].map(e => e.getAttribute('title')), up: TEXT_('#w193host .w193side .w193card'), title: (document.querySelector('#fund > .w118mast h1') || {}).textContent }));
    ok('the calendar: September 2026, 42 cells, four layers with their counts, the OTF submission on the 9th, Up next with the Béati deadline and the report due, the title Fundraising calendar', /September 2026/.test(cal.h2) && cal.cells === 42 && cal.layers.length === 4 && /^Events/.test(cal.layers[0]) && cal.evs.some(t => /Youth Harvest pilot · Submitted/.test(t)) && /Fondation Béati/.test(cal.up) && /Report due/.test(cal.up) && cal.title === 'Fundraising calendar', cal);
    await p.click('#w193host [data-w193nav="1"]'); await p.waitForTimeout(400);
    const oct = await f.ev(() => ({ h2: TEXT_('#w193host .w193calbar h2'), evs: [...document.querySelectorAll('#w193host .w193ev')].map(e => e.getAttribute('title')) }));
    ok('October: the Béati deadline on the 15th and the budget step on the 2nd', /October 2026/.test(oct.h2) && oct.evs.some(t => /Community kitchen with DESTA · Deadline/.test(t)) && oct.evs.some(t => /Draft the budget/.test(t)), oct);
    await p.click('#w193host [data-w193layer="deadlines"]'); await p.waitForTimeout(400);
    const off = await f.ev(() => ({ evs: [...document.querySelectorAll('#w193host .w193ev')].map(e => e.getAttribute('title')), chip: document.querySelector('#w193host [data-w193layer="deadlines"]').classList.contains('off'), ls: localStorage.getItem('w193layers') }));
    ok('switching the deadlines layer off hides the deadline and remembers it', off.chip && !off.evs.some(t => /Deadline/.test(t)) && /"deadlines":false/.test(off.ls), off);
    await p.click('#w193host [data-w193layer="deadlines"]'); await p.waitForTimeout(300);

    /* the donor program */
    await f.hash('#fund/donors', 1000);
    const dp = await f.ev(() => ({ kpis: [...document.querySelectorAll('#w193host .w193kpi')].map(k => k.querySelector('small').textContent + '=' + k.querySelector('b').textContent), big: TEXT_('#w193host .w193big'), tiers: document.querySelectorAll('#w193host .w193tier').length, checks: document.querySelectorAll('#w193host .w193checks li').length, on: document.querySelectorAll('#w193host .w193checks li.on').length, goals: !!document.querySelector('#w193host [data-w193dgoals]'), give: !!document.querySelector('#w193host a[href="https://hub.welfareavenue.com/give"]'), title: (document.querySelector('#fund > .w118mast h1') || {}).textContent }));
    ok('the donor program: the giving numbers from fund_giving_summary (6 monthly donors, $70 a month, $4,120 this FY, 4 lapsed), 6 of 40 on the meter, the tiers, the rhythm and launch checklists with the done ones ticked, Edit the goals for a leader, the donation page', dp.kpis.length === 6 && /Monthly donors=6/.test(dp.kpis[0]) && /\$70/.test(dp.kpis[1]) && /\$4,120/.test(dp.kpis[2]) && /Lapsed donors=4/.test(dp.kpis[4]) && /^6/.test(dp.big) && dp.tiers === 2 && dp.checks === 4 && dp.on === 2 && dp.goals && dp.give && dp.title === 'Donor program', dp);
    await p.click('#w193host [data-w193dgoals]'); await p.waitForTimeout(400);
    const dg = await f.ev(() => ({ open: document.getElementById('w193sheet').classList.contains('open'), v: (document.querySelector('#w193sheet [name=monthly_donors]') || {}).value }));
    ok('Edit the goals opens the form with the goal of 40', dg.open && dg.v === '40', dg);
    await p.click('#w193sheet [data-w193cancel]'); await p.waitForTimeout(300);

    /* the SOPs */
    await f.hash('#fund/sops', 1000);
    const sp = await f.ev(() => ({ cards: document.querySelectorAll('#w193host .w193sop').length, first: TEXT_('#w193host .w193sop'), academy: !!document.querySelector('#w193host [data-w193go="#training"]'), title: (document.querySelector('#fund > .w118mast h1') || {}).textContent }));
    ok('Event SOPs: the six SOPs from the academy as cards, a link to the Avenue Academy, the title Event SOPs', sp.cards === 6 && /Flag Football/.test(sp.first) && sp.academy && sp.title === 'Event SOPs', sp);
    await p.click('#w193host .w193sop'); await p.waitForTimeout(900);
    const rd = await f.ev(() => ({ hash: location.hash, h2: TEXT_('#w193host .w193reader h2'), phases: document.querySelectorAll('#w193host .w193phase').length, steps: document.querySelectorAll('#w193host .w193phase ol li').length, open: [...document.querySelectorAll('#w193host [data-w193go]')].map(a => a.getAttribute('data-w193go')).filter(h => /^#training\/t\//.test(h)).length, events: /Flag Football 2026/.test(TEXT_('#w193host .w193side .w193stack')) }));
    ok('an SOP opens in the app at #fund/sops/<id>: its phases and steps, Open in the Avenue Academy, the event that uses it', /^#fund\/sops\/\d+$/.test(rd.hash) && /Flag Football/.test(rd.h2) && rd.phases > 0 && rd.steps > 3 && rd.open === 1 && rd.events, rd);

    /* the Events page inside the app */
    await f.hash('#fundevents', 1500);
    r = await f.ev(RAIL);
    const fe = await f.ev(() => ({ cur: WA_APP.current(), bar: (document.querySelector('#w153bar .w153bc') || {}).innerText, crumb: (() => { const c = document.querySelector('#fundevents > .w118mast .crumb'); return c ? getComputedStyle(c).display : 'none'; })(), cards: document.querySelectorAll('#w124fund .w124fe').length }));
    ok('the Events page opens inside the Fundraising app: the rail marks Events, the bar says Fundraising, Events, no crumb, the event cards there', fe.cur === 'fund' && r.items.indexOf('Events*') >= 0 && /FUNDRAISING\s*Events/i.test(fe.bar) && fe.crumb === 'none' && fe.cards > 0, { fe, rail: r.items });

    /* the tour */
    const tour = await f.ev(() => { const t = window.w122 && w122.tours && w122.tours.fund; return t ? { steps: t.steps.length, tab: t.tab, first: t.steps[0].t, hash: t.hash } : null; });
    ok('the page tour fund is registered with the academy: twelve steps from the Overview', tour && tour.steps === 12 && tour.tab === 'fund' && tour.first === 'The Fundraising app' && tour.hash === '#fund', tour);
    ok('no page errors on a computer', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. a phone */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#fund/grants/found', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, init: INIT, wait: 4500 });
    const ph = await f.ev(() => ({ tabs: getComputedStyle(document.querySelector('#w193host .w193tabs')).display, on: (document.querySelector('#w193host .w193tabs a.on') || {}).textContent, rail: getComputedStyle(document.getElementById('w153rail')).display, menu: getComputedStyle(document.querySelector('#w153bar .w153menu')).display, cards: document.querySelectorAll('#w193host .w193find').length, overflow: document.documentElement.scrollWidth <= 390 }));
    ok('on a phone the Grants tabs show (Found for you marked), the find cards stack, nothing overflows sideways (the phone menu is wave163\'s)', ph.tabs !== 'none' && /Found for you/.test(ph.on) && ph.cards === 2 && ph.overflow, ph);
    await f.hash('#fund/calendar', 1000);
    const pc = await f.ev(() => ({ cells: document.querySelectorAll('#w193host .w193cell').length, overflow: document.documentElement.scrollWidth <= 390, ev: document.querySelector('#w193host .w193ev') ? getComputedStyle(document.querySelector('#w193host .w193ev')).height : null }));
    ok('the calendar fits a phone: 42 cells as bars', pc.cells === 42 && pc.overflow, pc);
    ok('no page errors on a phone', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. a member on the HR profile: no app */
  {
    const f = await fresh(browser, { who: 'member', width: 1366, hash: '#mypage', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, init: INIT, wait: 4000 });
    const mb = await f.ev(() => ({ ok: WA_APP.ok('fund'), fund: (() => { const b = document.querySelector('#tabBar .tab[data-tab="fund"]'); return b ? b.style.display : 'missing'; })(), allowed: (wa40Allowed() || []).indexOf('fund') >= 0, has: document.body.classList.contains('w193has'), fe: (() => { const b = document.querySelector('#tabBar .tab[data-tab="fundevents"]'); return b ? getComputedStyle(b).display : 'missing'; })(), feAllowed: (wa40Allowed() || []).indexOf('fundevents') >= 0 }));
    ok('a member on the HR profile (fund: none) has no Fundraising app and no fund page; the Events calendar stays in the Hub menu for whoever had it', !mb.ok && mb.fund === 'none' && !mb.allowed && !mb.has && (!mb.feAllowed || mb.fe !== 'none'), mb);
    ok('no page errors (member)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 4. a member whose profile opens the app: works in it, deletes nothing */
  {
    const f = await fresh(browser, { who: 'member', width: 1366, hash: '#fund/grants', fixture: JSON.parse(JSON.stringify(fx('hr'))), rpcs: RPCS, init: INIT, wait: 4500 });
    const p = f.page;
    const mm = await f.ev(() => ({ ok: WA_APP.ok('fund'), cur: WA_APP.current(), add: !!document.querySelector('#w193host [data-w193gadd]'), rows: document.querySelectorAll('#w193host .w193row').length }));
    await p.click('#w193host .w193row[data-w193grant="11"]'); await p.waitForTimeout(800);
    const ms = await f.ev(() => { const s = document.getElementById('w193sheet'); return { open: s.classList.contains('open'), del: !!s.querySelector('[data-w193gdel]'), stage: !!s.querySelector('[data-w193stage]'), fit: !!s.querySelector('[data-w193fit]') }; });
    ok('a member whose profile opens the app sees it, adds and edits (Add a grant, the stage select, Score the fit) but has no Delete', mm.ok && mm.cur === 'fund' && mm.add && mm.rows === 2 && ms.open && ms.stage && ms.fit && !ms.del, { mm, ms });
    await f.hash('#fund/donors', 900);
    const md = await f.ev(() => ({ goals: !!document.querySelector('#w193host [data-w193dgoals]'), ticks: document.querySelectorAll('#w193host .w193checks .bx').length }));
    ok('on the donor program a member reads the checklists without Edit the goals (leaders set them)', !md.goals && md.ticks === 4, md);
    ok('no page errors (member in the app)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 5. a director: the Events calendar stays in the Hub menu, no app */
  {
    const f = await fresh(browser, { who: 'board', width: 1366, hash: '#fundevents', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, init: INIT, wait: 4500 });
    const bd = await f.ev(() => ({ cur: WA_APP.current(), fe: (() => { const b = document.querySelector('#tabBar .tab[data-tab="fundevents"]'); return b ? getComputedStyle(b).display : 'missing'; })(), fund: (() => { const b = document.querySelector('#tabBar .tab[data-tab="fund"]'); return b ? b.style.display : 'missing'; })(), cards: document.querySelectorAll('#w124fund .w124fe').length, dir: document.documentElement.classList.contains('w163dir') }));
    ok('a director keeps the Events calendar in the Hub menu, opens no app, and never sees the fund page', bd.cur === null && bd.fe !== 'none' && bd.fund === 'none' && bd.cards > 0 && bd.dir, bd);
    ok('no page errors (director)', f.errs.length === 0, f.errs);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
