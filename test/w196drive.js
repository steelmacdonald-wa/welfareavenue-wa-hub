/* w196drive.js: wave196 (02/10/26). (1) The side menu folds away on a computer: Hide the menu, the left edge opens it
   over the page, moving away closes it, the Menu tab, Escape, the pin keeps it open, Ctrl + \\, remembered after a reload,
   inside an app too; phones untouched. (2) The CRM's automations: folders, dragging an automation (before another one or
   into a folder), More > Move up, Move to a new folder, Rename and Remove a folder, Duplicate; all saved with
   crm_automations_arrange. (3) The editor as a flow: the cards, the panel for the chosen card, + to add a step anywhere,
   dragging a step (paths that would point back are put right), Duplicate, Copy then Paste in another automation, Copy to,
   Unsaved changes and the leave guard, the save, the phone sheet. The fixture and stubs are w157drive's.
   usage: node test/w196drive.js */
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
const T = (key, name, kind, subject, sort) => ({ key, name, kind, subject, preheader: '', html_body: '<p>Hi {{first_name|there}}</p>', text_body: null, active: true, sort, updated_at: '2026-09-27T12:00:00Z', updated_by: null });
const WELCOME = [
  { id: 's1', type: 'send', email: 'template', template_key: 'welcome_volunteer', kind: 'transactional' },
  { id: 's2', type: 'task', department: 'opsmtl', title: 'Welcome {{full_name}} and book their first serving', note: 'Phone: {{phone|not given}}.', due_days: 3 },
  { id: 's3', type: 'wait', days: 2 },
  { id: 's4', type: 'send', email: 'write', kind: 'volunteer', subject: 'Welcome to our community', preheader: '', headline: 'Welcome to our community', body: '[Paste the words of Keela\'s email here]', cta_label: '', cta_url: '' },
  { id: 's5', type: 'wait_open', step: 's4', days: 3, yes: 'end', no: 'next' },
  { id: 's6', type: 'send', email: 'write', kind: 'volunteer', subject: 'Did you see our welcome?', preheader: '', headline: 'In case you missed it', body: 'Hi {{first_name|there}},\n\nA quick hello again.', cta_label: '', cta_url: '' }
];
function fixture() {
  const fx = loadFixture();
  fx.crm_contacts_v = [
    C(5001, 'Amara Okafor', { emails: ['amara.okafor@example.com'], primary_email: 'amara.okafor@example.com', kinds: ['donor'], email_status: 'subscribed', email_consent: 'express' }),
    C(5002, 'Élodie Gagnon', { emails: ['elodie.gagnon@example.com'], primary_email: 'elodie.gagnon@example.com', kinds: ['supporter'] }),
    C(5003, 'Steel MacDonald', { emails: ['steel.macdonald@welfareavenue.com'], primary_email: 'steel.macdonald@welfareavenue.com', kinds: ['staff'] })
  ];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_donations = []; fx.crm_interactions = [];
  fx.crm_email_templates = [T('test', 'A test message', 'test', 'A test', 1), T('welcome_volunteer', 'Welcome, new volunteer', 'transactional', 'Welcome to Welfare Avenue, {{first_name|friend}}', 10),
    T('thank_you_gift', 'Thank you for a gift', 'transactional', 'Thank you, {{first_name|friend}}', 20), T('serving_reminder', 'Reminder before a serving', 'transactional', 'See you {{event_day|soon}}', 30), T('newsletter', 'Newsletter', 'newsletter', '{{subject|News}}', 40)];
  fx.crm_email_sends = [];
  fx.crm_forms = [
    { id: 1, slug: 'volunteer', title: 'Volunteer with Welfare Avenue', intro: '', lang: 'en', kind: 'volunteer', status: 'draft', questions: [], consent: { ask: true }, thank_you: '', settings: {}, created_at: '2026-09-28T10:00:00Z' },
    { id: 3, slug: 'newsletter', title: 'Get the Welfare Avenue newsletter', intro: '', lang: 'en', kind: 'newsletter', status: 'published', questions: [], consent: { ask: true, required: true }, thank_you: '', settings: {}, created_at: '2026-09-28T10:00:00Z' }
  ];
  fx.crm_form_stats_v = [];
  fx.crm_automations = [
    { id: 1, name: 'Welcome new volunteers (Montreal)', description: 'Keela’s welcome series, rebuilt.', status: 'draft', trigger: { kind: 'form', form_id: 1 }, steps: WELCOME, settings: { reentry: false }, created_at: '2026-09-28T12:00:00Z', created_by: 'wave157', updated_at: '2026-09-28T12:00:00Z' },
    { id: 2, name: 'Thank donors for a gift', description: 'The thank-you for every gift.', status: 'on', trigger: { kind: 'gift', first_only: false, min_amount: null }, steps: [{ id: 's1', type: 'send', email: 'template', template_key: 'thank_you_gift', kind: 'transactional' }], settings: { reentry: true }, created_at: '2026-09-28T12:01:00Z', created_by: 'wave157', updated_at: '2026-09-28T12:01:00Z', turned_on_at: '2026-09-28T13:00:00Z', turned_on_by: 'steel.macdonald@welfareavenue.com' },
    { id: 3, name: 'Remind volunteers before a serving', description: '', status: 'paused', trigger: { kind: 'serving', days_before: 2, location: 'Montreal', include_unconfirmed: false }, steps: [{ id: 's1', type: 'send', email: 'template', template_key: 'serving_reminder', kind: 'transactional' }], settings: { reentry: true }, created_at: '2026-09-28T12:02:00Z', created_by: 'wave157', updated_at: '2026-09-28T12:02:00Z' }
  ];
  fx.crm_automation_stats_v = [
    { automation_id: 1, active: 0, done: 0, stopped: 0, errors: 0, tests: 1, last_started: null, emails_sent: 0 },
    { automation_id: 2, active: 1, done: 3, stopped: 0, errors: 1, tests: 1, last_started: '2026-09-28T14:00:00Z', emails_sent: 3 },
    { automation_id: 3, active: 0, done: 0, stopped: 0, errors: 0, tests: 0, last_started: null, emails_sent: 0 }
  ];
  fx.crm_automation_runs = [
    { id: 71, automation_id: 2, contact_id: 5001, status: 'active', step_id: 's1', next_at: '2026-09-28T14:01:00Z', is_test: false, error: null, started_at: '2026-09-28T14:00:00Z', finished_at: null,
      history: [{ at: '2026-09-28T14:00:00Z', type: 'start', note: 'Gave $50.00' }] },
    { id: 72, automation_id: 2, contact_id: 5002, status: 'done', step_id: null, next_at: '2026-09-27T14:00:00Z', is_test: false, error: null, started_at: '2026-09-27T14:00:00Z', finished_at: '2026-09-27T14:02:00Z',
      history: [{ at: '2026-09-27T14:00:00Z', type: 'start', note: 'Gave $20.00' }, { at: '2026-09-27T14:02:00Z', step: 's1', type: 'send', note: 'Sent "Thank you, Élodie"' }, { at: '2026-09-27T14:02:00Z', type: 'end', note: 'Finished' }] },
    { id: 73, automation_id: 2, contact_id: 5003, status: 'active', step_id: 's1', next_at: '2026-09-28T14:05:00Z', is_test: true, error: null, started_at: '2026-09-28T14:04:00Z', finished_at: null,
      history: [{ at: '2026-09-28T14:04:00Z', type: 'start', note: 'Test run started by steel.macdonald@welfareavenue.com' }] }
  ];
  const LBL = { opsmtl: 'Operations Montreal', opsto: 'Operations Toronto', progdev: 'Program Development', fundraising: 'Fundraising & Finances', hr: 'Human Resources', marketing: 'Marketing, Branding & Web', board: 'Board & Governance' };
  fx.dept_meta = (fx.dept_meta || []).map((d, i) => Object.assign({ label: LBL[d.department] || d.department, short_label: LBL[d.department] || d.department, sort: i + 1 }, d));
  if (!(fx.team_members || []).some(m => m.email === 'steel.macdonald@welfareavenue.com')) fx.team_members.push({ id: 991, name: 'Steel MacDonald', email: 'steel.macdonald@welfareavenue.com', department: 'board', role: 'Executive Director', active: true });
  return fx;
}
const STUB = `(function(){
  window.__calls = []; window.__ins = []; window.__rpc = []; window.__problems = ['Step 4: the email still has a [Paste ...] note: put the real words in.'];
  window.__mailStub = function (name, opts) {
    var b = (opts && opts.body) || {}; window.__calls.push(Object.assign({ fn: name }, JSON.parse(JSON.stringify(b))));
    var SET = { mail_mode: 'test', mail_from_name: 'Welfare Avenue', mail_from_email: 'info@welfareavenue.com', mail_reply_to: 'info@welfareavenue.com', mail_test_recipients: 'steelmacdonald@gmail.com, steel.macdonald@welfareavenue.com', mail_domain: 'welfareavenue.com' };
    if (b.action === 'settings') return Promise.resolve({ data: { settings: SET, key_present: true, domain: null, admin: true, me: 'steel.macdonald@welfareavenue.com', last30: {} }, error: null });
    if (b.action === 'preview') return Promise.resolve({ data: { subject: b.subject || 'Welcome to Welfare Avenue, Steel', preheader: b.preheader || '', html: '<!DOCTYPE html><html><body><h1>' + ((b.vars && b.vars.headline) || 'Saved email') + '</h1></body></html>', text: 'Hi', kind: b.kind, from: 'Welfare Avenue <info@welfareavenue.com>' }, error: null });
    return Promise.resolve({ data: { ok: true }, error: null });
  };
})();`;
const patch = f => f.ev(() => {
  db.functions.invoke = window.__mailStub;
  const rpc0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    if (fn === 'crm_automation_problems') return Promise.resolve({ data: window.__problems.slice(), error: null });
    if (fn === 'crm_automation_try') return Promise.resolve({ data: 501, error: null });
    if (fn === 'crm_automation_stop') return Promise.resolve({ data: true, error: null });
    return rpc0(fn, args);
  };
  const from0 = db.from.bind(db);
  db.from = function (t) {
    const q = from0(t); const ins = q.insert, up = q.update, del = q.delete;
    q.insert = function (p) { window.__ins.push({ t: t, op: 'insert', p: JSON.parse(JSON.stringify(p)) }); if (p && !Array.isArray(p) && t === 'crm_automations') p = Object.assign({ id: 900 + window.__ins.length }, p); return ins.call(this, p); };
    q.update = function (p) { window.__ins.push({ t: t, op: 'update', p: JSON.parse(JSON.stringify(p)) }); return up.call(this, p); };
    q.delete = function () { window.__ins.push({ t: t, op: 'delete' }); return del.call(this); };
    return q;
  };
  return true;
});
const text = (f, s) => f.ev(x => { const el = document.querySelector(x); return el ? el.innerText.replace(/\s+/g, ' ').trim() : null; }, s);
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);

const rpcs = f => f.ev(() => window.__rpc.filter(x => x.fn === 'crm_automations_arrange').map(x => x.args.p_items));
const writes = f => f.ev(() => window.__ins.filter(x => x.t === 'crm_automations'));
function fx196() {
  const fx = fixture();
  fx.crm_automations.forEach((a, i) => { a.sort_order = (i + 1) * 10; a.folder = null; });
  return fx;
}
(async () => {
  const browser = await launch();
  try {
    /* ---------- 1. the side menu ---------- */
    let f = await fresh(browser, { who: 'admin', width: 1440, hash: '#mypage', fixture: fx196(), init: STUB, wait: 4000 });
    await patch(f);
    const navX = () => f.ev(() => { const n = document.querySelector('nav.wa-nav').getBoundingClientRect(); return { left: Math.round(n.left), right: Math.round(n.right), pad: getComputedStyle(document.body).paddingLeft, col: document.body.classList.contains('w196col'), peek: document.body.classList.contains('w196peek'), tab: (() => { const t = document.getElementById('w196tab'); return !!t && getComputedStyle(t).display !== 'none'; })() }; });
    let n = await navX();
    ok('menu: open by default, the page beside it', !n.col && n.left === 0 && n.pad === '236px', n);
    ok('menu: a Hide the menu button at its top', await f.ev(() => { const b = document.getElementById('w196pin'); return !!b && /Hide the menu/.test(b.getAttribute('aria-label')) && document.querySelector('nav.wa-nav').contains(b); }));
    await f.page.click('#w196pin'); await f.page.waitForTimeout(500);
    n = await navX();
    ok('Hide the menu: it folds away and the page takes the whole width', n.col && n.right <= 2 && n.pad === '0px' && n.tab, n);
    ok('the choice is kept on this computer', await f.ev(() => localStorage.getItem('wa196nav') === 'col'));
    ok('folded: the button becomes Keep the menu open', await f.ev(() => /Keep the menu open/.test(document.getElementById('w196pin').getAttribute('aria-label'))));
    await f.page.mouse.move(700, 400); await f.page.mouse.move(3, 400); await f.page.waitForTimeout(450);
    n = await navX();
    ok('the left edge opens it over the page', n.peek && n.left === 0 && n.pad === '0px', n);
    await f.page.mouse.move(120, 300); await f.page.waitForTimeout(700);
    ok('it stays while the mouse is on it', (await navX()).peek);
    await f.page.mouse.move(900, 400); await f.page.waitForTimeout(800);
    n = await navX();
    ok('moving away closes it again', !n.peek && n.right <= 2, n);
    await f.page.mouse.move(48, 29); await f.page.waitForTimeout(400);
    ok('the Menu tab opens it too (pointing at it is enough)', (await navX()).peek);
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(400);
    ok('Escape closes it', !(await navX()).peek);
    await f.page.mouse.move(3, 400); await f.page.waitForTimeout(400);
    await f.page.click('nav.wa-nav #tabBar .tab:not(.active)'); await f.page.waitForTimeout(400);
    await f.page.mouse.move(900, 400); await f.page.waitForTimeout(800);
    ok('choosing a page from it, then moving away, closes it', !(await navX()).peek);
    await f.page.reload({ waitUntil: 'domcontentloaded' }); await f.page.waitForTimeout(5000); await patch(f);
    ok('after a reload it is still folded away', (await navX()).col);
    await f.hash('#crm', 2500);
    n = await navX();
    ok('inside an app (the CRM) the same: folded, the rail with it', n.col && n.right <= 2 && await f.ev(() => document.body.classList.contains('w153app')), n);
    await f.page.mouse.move(3, 400); await f.page.waitForTimeout(450);
    ok('the edge opens the app’s rail', (await navX()).peek && await f.ev(() => { const r = document.getElementById('w153rail'); return !!r && r.getBoundingClientRect().left >= 0 && r.offsetParent !== null; }));
    await f.page.click('#w196pin'); await f.page.waitForTimeout(500);
    n = await navX();
    ok('the pin keeps it open for good', !n.col && n.left === 0 && n.pad === '236px' && await f.ev(() => localStorage.getItem('wa196nav') === 'open'), n);
    await f.page.keyboard.press('Control+Backslash'); await f.page.waitForTimeout(400);
    ok('Ctrl + \\ folds it away', (await navX()).col);
    await f.page.keyboard.press('Control+Backslash'); await f.page.waitForTimeout(400);
    ok('and back', !(await navX()).col);
    ok('no page errors (the menu)', f.errs.length === 0, f.errs);
    await f.close();
    f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx196(), init: STUB + ';try{localStorage.setItem("wa196nav","col")}catch(e){}', wait: 4000 });
    n = await navX();
    ok('phone: untouched (the drawer and the bottom bar), even when folded on the computer', !n.col && !(await f.ev(() => { const b = document.getElementById('w196pin'); return b && getComputedStyle(b).display !== 'none'; })) && !n.tab, n);
    await f.close();

    /* ---------- 2. the automations list ---------- */
    f = await fresh(browser, { who: 'admin', width: 1440, hash: '#mypage', fixture: fx196(), init: STUB, wait: 4000 });
    await patch(f);
    await f.hash('#crm/automations', 2500);
    const names = () => f.ev(() => [...document.querySelectorAll('#crm [data-w196g]')].map(g => (g.getAttribute('data-w196g') || '-') + ':' + [...g.querySelectorAll('[data-w196row]')].map(r => r.getAttribute('data-w196row')).join(',')));
    ok('list: every automation in order, a handle to drag, New folder', JSON.stringify(await names()) === JSON.stringify(['-:1,2,3']) && await f.ev(() => document.querySelectorAll('#crm [data-w196row] .w196grip').length === 3 && !!document.querySelector('#crm [data-w196nf]')), await names());
    await f.page.dragAndDrop('#crm [data-w196row="3"] .w196grip', '#crm [data-w196row="1"]', { targetPosition: { x: 40, y: 6 } }); await f.page.waitForTimeout(500);
    let r = await rpcs(f);
    ok('drag an automation above another: the new order is saved in one call', JSON.stringify(await names()) === JSON.stringify(['-:3,1,2']) && r.length === 1 && JSON.stringify(r[0].map(x => x.id)) === '[3,1,2]' && r[0].every(x => x.folder === null) && r[0][0].sort === 10, { names: await names(), r });
    await f.page.click('#crm [data-w196nf]'); await f.page.fill('#crm [data-w196nfin]', 'Volunteers'); await f.page.click('#crm [data-w196nfok]'); await f.page.waitForTimeout(300);
    ok('New folder: an empty folder to drag into', JSON.stringify(await names()) === JSON.stringify(['Volunteers:', '-:3,1,2']) && /Drag an automation here/.test(await text(f, '#crm [data-w196g="Volunteers"]')), await names());
    await f.page.dragAndDrop('#crm [data-w196row="1"] .w196grip', '#crm .w196zone[data-w196drop="Volunteers"]'); await f.page.waitForTimeout(500);
    r = await rpcs(f);
    ok('drag one into the folder: saved with its folder', JSON.stringify(await names()) === JSON.stringify(['Volunteers:1', '-:3,2']) && r.length === 2 && r[1].filter(x => x.id === 1)[0].folder === 'Volunteers', { names: await names(), last: r[1] });
    await f.page.click('#crm [data-w196rowmenu="3"]'); await f.page.waitForTimeout(200);
    ok('More: Move up, Move down, Move to a folder, Duplicate', /Move up/i.test(await text(f, '#crm .w196menu')) && /Move down/i.test(await text(f, '#crm .w196menu')) && /Move to a folder/i.test(await text(f, '#crm .w196menu')) && /Duplicate/i.test(await text(f, '#crm .w196menu')), await text(f, '#crm .w196menu'));
    await f.page.selectOption('#crm [data-w196tofolder="3"]', 'Volunteers'); await f.page.waitForTimeout(500);
    ok('Move to a folder from the menu', JSON.stringify(await names()) === JSON.stringify(['Volunteers:1,3', '-:2']), await names());
    await f.page.click('#crm [data-w196rowmenu="3"]'); await f.page.click('#crm [data-w196mv="-1"][data-w196id="3"]'); await f.page.waitForTimeout(500);
    ok('Move up', JSON.stringify(await names()) === JSON.stringify(['Volunteers:3,1', '-:2']), await names());
    await f.page.click('#crm [data-w196rowmenu="2"]'); await f.page.selectOption('#crm [data-w196tofolder="2"]', '__new'); await f.page.waitForTimeout(200);
    await f.page.fill('#crm [data-w196nfin]', 'Donors'); await f.page.keyboard.press('Enter'); await f.page.waitForTimeout(500);
    ok('Move to a new folder (named there and then)', JSON.stringify((await names()).sort()) === JSON.stringify(['-:', 'Donors:2', 'Volunteers:3,1'].sort()) || JSON.stringify(await names()) === JSON.stringify(['Volunteers:3,1', 'Donors:2']), await names());
    await f.page.click('#crm [data-w196rename="Donors"]'); await f.page.fill('#crm [data-w196renin]', 'Donors and gifts'); await f.page.click('#crm [data-w196renok]'); await f.page.waitForTimeout(500);
    r = await rpcs(f);
    ok('Rename a folder: its automations move with it', (await names()).indexOf('Donors and gifts:2') >= 0 && r[r.length - 1].filter(x => x.id === 2)[0].folder === 'Donors and gifts', await names());
    await f.page.click('#crm [data-w196fold="Volunteers"]'); await f.page.waitForTimeout(200);
    ok('a folder closes and opens', await f.ev(() => document.querySelectorAll('#crm [data-w196g="Volunteers"] [data-w196row]').length === 0) && /2 automations/.test(await text(f, '#crm [data-w196g="Volunteers"]')));
    await f.page.click('#crm [data-w196fold="Volunteers"]'); await f.page.waitForTimeout(200);
    await f.page.click('#crm [data-w196unfold="Donors and gifts"]'); await f.page.waitForTimeout(500);
    ok('Remove a folder: its automations stay, not in a folder', (await names()).some(x => /^-:.*2/.test(x)) && !(await names()).some(x => /^Donors/.test(x)), await names());
    await f.page.click('#crm [data-w196rowmenu="1"]'); await f.page.click('#crm [data-w196dupa="1"]'); await f.page.waitForTimeout(800);
    const w = await writes(f);
    ok('Duplicate: a draft copy with the same steps, in the same folder', w.some(x => x.op === 'insert' && x.p.name === 'Welcome new volunteers (Montreal) (copy)' && x.p.status === 'draft' && x.p.steps.length === 6 && x.p.folder === 'Volunteers'), w.filter(x => x.op === 'insert'));
    ok('no page errors (the list)', f.errs.length === 0, f.errs);
    await f.close();

    /* ---------- 3. the editor as a flow ---------- */
    f = await fresh(browser, { who: 'admin', width: 1440, hash: '#mypage', fixture: fx196(), init: STUB, wait: 4000 });
    await patch(f);
    await f.hash('#crm/automations/1', 2500);
    let b = await f.ev(() => ({ cards: document.querySelectorAll('#crm .w196card[data-w157si]').length, trig: (document.querySelector('#crm .w196card.trig') || {}).innerText || '', plus: document.querySelectorAll('#crm [data-w196ins]').length,
      paths: (document.querySelector('#crm .w196card[data-w157si="4"] .w196paths') || {}).innerText || '', fields: document.querySelectorAll('#crm [data-w157s]').length, outline: !!document.querySelector('#crm .w157ol') }));
    ok('the flow: the trigger, six step cards, a + before each and at the end, nothing open yet', b.cards === 6 && /Volunteer with Welfare Avenue/.test(b.trig) && b.plus === 7 && b.fields === 0 && b.outline, b);
    ok('wait until opened shows its two paths on the card', /Opened: end/.test(b.paths) && /Not opened: go on/.test(b.paths), b.paths);
    await f.page.click('#crm .w196card[data-w157si="2"]'); await f.page.waitForTimeout(300);
    b = await f.ev(() => ({ head: (document.querySelector('#crm .w196panel .w196ph') || {}).innerText || '', days: (document.querySelector('#crm .w196panel [data-w157si="2"] [data-w157s="days"]') || {}).value, sel: !!document.querySelector('#crm .w196card.sel[data-w157si="2"]') }));
    ok('click a card: the panel edits that step', /Step 3: Wait/i.test(b.head) && b.days === '2' && b.sel, b);
    await setv(f, '#crm .w196panel [data-w157s="days"]', '4');
    ok('editing: Unsaved changes, and the card says it at once', /Unsaved changes/.test(await text(f, '#crm .w196dirty')) && /Wait 4 days/.test(await text(f, '#crm .w196card[data-w157si="2"]')));
    await f.page.click('#crm [data-w196ins="1"]'); await f.page.waitForTimeout(200);
    ok('+ opens the list of steps to add there', /Add a step here/i.test(await text(f, '#crm .w196addm')) && await f.ev(() => document.querySelectorAll('#crm .w196addm [data-w157add]').length === 7));
    await f.page.click('#crm .w196addm [data-w157add="tag"]'); await f.page.waitForTimeout(300);
    b = await f.ev(() => ({ types: [...document.querySelectorAll('#crm .w196card[data-w157si]')].map(c => c.querySelector('.k').textContent.replace(/^\d+ · /, '').trim()), sel: (document.querySelector('#crm .w196card.sel') || {}).getAttribute && document.querySelector('#crm .w196card.sel').getAttribute('data-w157si') }));
    ok('the new step goes where the + was (step 2), open in the panel', b.types[1] === 'Add or remove tags' && b.types.length === 7 && b.sel === '1', b);
    await setv(f, '#crm .w196panel [data-w157s="_add"]', 'welcomed');
    /* drag wait until opened (now step 6) above the wait (step 4): it now comes before the email it watched */
    await f.page.dragAndDrop('#crm .w196card[data-w157si="5"] .w196grip', '#crm .w196card[data-w157si="3"]', { targetPosition: { x: 60, y: 6 } }); await f.page.waitForTimeout(400);
    b = await f.ev(() => ({ types: [...document.querySelectorAll('#crm .w196card[data-w157si]')].map(c => c.querySelector('.k').textContent.replace(/^\d+ · /, '').trim()), msg: (document.querySelector('#crm .w154msg') || {}).textContent || '' }));
    ok('drag a card: it moves there (wait until opened is now step 4)', b.types[3] === 'Wait until opened' && /Moved to step 4/.test(b.msg), b);
    ok('a wait that now comes before its email is put right, and says so', /Step 4 now watches the email at step 1/.test(b.msg), b.msg);
    await f.page.click('#crm .w196card[data-w157si="3"]'); await f.page.waitForTimeout(200);
    await f.page.click('#crm [data-w196copy="3"]'); await f.page.waitForTimeout(200);
    ok('Copy: kept for pasting anywhere', /copied/.test(await text(f, '#crm .w196ed .w154msg')) && await f.ev(() => JSON.parse(localStorage.getItem('wa196clip')).step.type === 'wait_open'));
    await f.page.click('#crm [data-w196dup="3"]'); await f.page.waitForTimeout(300);
    ok('Duplicate: the copy right after it', await f.ev(() => [...document.querySelectorAll('#crm .w196card[data-w157si]')].map(c => c.querySelector('.k').textContent).slice(3, 5).every(t => /Wait until opened/i.test(t))));
    await f.page.click('#crm [data-w157save]'); await f.page.waitForTimeout(800);
    const up = (await writes(f)).filter(x => x.op === 'update').pop();
    ok('Save: the steps in their new order, the tag cleaned, and All changes saved', up && up.p.steps.length === 8 && up.p.steps[3].type === 'wait_open' && up.p.steps[3].step === 's1' && up.p.steps.some(s => s.type === 'tag' && JSON.stringify(s.add) === '["welcomed"]') && !JSON.stringify(up.p.steps).includes('"_add"') && /All changes saved/.test(await text(f, '#crm .w196dirty')), up && up.p.steps.map(s => s.type));
    /* the copied step pasted into another automation */
    await f.page.click('#crm .w196back'); await f.page.waitForTimeout(600);
    await f.hash('#crm/automations/3', 2000);
    await f.page.click('#crm [data-w196ins="1"]'); await f.page.waitForTimeout(200);
    ok('in another automation, + offers Paste', /Paste: Wait until opened/.test(await text(f, '#crm .w196addm')) && /from Welcome new volunteers/.test(await text(f, '#crm .w196addm')));
    await f.page.click('#crm [data-w196paste="1"]'); await f.page.waitForTimeout(300);
    b = await f.ev(() => ({ n: document.querySelectorAll('#crm .w196card[data-w157si]').length, t: (document.querySelector('#crm .w196card[data-w157si="1"]') || {}).innerText || '' }));
    ok('Paste: the step lands there, its paths reset to go on', b.n === 2 && /Wait until opened/i.test(b.t) && /Opened: go on/.test(b.t), b);
    await f.page.click('#crm .w196back'); await f.page.waitForTimeout(400);
    ok('leaving with unsaved changes asks first', /changes that are not saved/.test(await text(f, '#crm .w196ed')) && /#crm\/automations\/3/.test(await f.ev(() => location.hash)));
    await f.page.click('#crm [data-w196leave]'); await f.page.waitForTimeout(600);
    ok('Leave without saving goes back and saves nothing', /#crm\/automations$/.test(await f.ev(() => location.hash)) && !(await writes(f)).some(x => x.op === 'update' && x.p.steps && x.p.steps.length === 2));
    /* Copy to another automation (saved there at once) */
    await f.hash('#crm/automations/1', 2000);
    await f.page.click('#crm .w196card[data-w157si="0"]'); await f.page.waitForTimeout(200);
    await f.page.selectOption('#crm [data-w196cto="0"]', '2'); await f.page.waitForTimeout(800);
    const cto = (await writes(f)).filter(x => x.op === 'update').pop();
    ok('Copy to: the step is added at the end of the other automation, and the page says it is on', cto && cto.p.steps.length === 2 && cto.p.steps[1].type === 'send' && cto.p.steps[1].id === 's2' && /which is on/.test(await text(f, '#crm .w154msg')), cto && cto.p);
    ok('no page errors (the editor)', f.errs.length === 0, f.errs);
    await f.close();

    /* ---------- the phone ---------- */
    f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx196(), init: STUB, wait: 4000 });
    await patch(f);
    await f.hash('#crm/automations/1', 2500);
    await f.ev(() => document.querySelector('#crm .w196card[data-w157si="3"]').click()); await f.page.waitForTimeout(400);
    b = await f.ev(() => { const p = document.querySelector('#crm .w196panel'); const r = p.getBoundingClientRect(); return { fixed: getComputedStyle(p).position, bottom: Math.round(innerHeight - r.bottom), sw: document.documentElement.scrollWidth, w: innerWidth }; });
    ok('phone: the panel is a sheet from the bottom, nothing scrolls sideways', b.fixed === 'fixed' && b.bottom >= 60 && b.sw <= b.w + 1, b);
    await f.hash('#crm/automations', 1500);
    ok('phone: the list does not scroll sideways', await f.ev(() => document.documentElement.scrollWidth <= innerWidth + 1));
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    if (SHOTS) await shot(f, 'w196-phone-list');
    await f.close();
  } finally { await browser.close(); }
  console.log(out.join('\n'));
  console.log('\nw196drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
