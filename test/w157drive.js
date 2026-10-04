/* w157drive.js: the CRM's Automations tab (wave157). Fixture rows are made up for the test (no real people); every write
   and RPC is recorded on the page (the stub echoes it and never changes the fixture), and mail-send is stubbed.
   An admin opens Automations: nine tabs, the rail's Automations item, the automations with their trigger in words, status
   and counts, the test-mode notice. The Montreal welcome's editor: the trigger (its form), the steps, the plain-words
   outline, the paths of a wait-until-opened step (only later steps, the next one or the end). A tag step is added and
   saved (the steps are cleaned: arrays, numbers, no helper keys). Turn on shows what is not ready (from the database's
   check), then, once ready, asks first and turns it on. Try it on me starts a test run. A written email previews with
   sample details. The trigger becomes a serving reminder. The people in the gift thank-you: runs, their next step, the
   history, Stop. A new draft. On a phone nothing overflows. usage: node test/w157drive.js */
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

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), init: STUB, wait: 4000 });
  await patch(f);
  await f.hash('#crm/automations', 2600);
  let b = await f.ev(() => ({ tabs: [...document.querySelectorAll('#crm .w152tabs button')].map(x => x.textContent.trim() + (x.classList.contains('on') ? '*' : '')),
    rows: [...document.querySelectorAll('#crm .w156row')].map(r => r.innerText.replace(/\s+/g, ' ')), note: (document.querySelector('#crm .w155cf.test') || {}).innerText || '' }));
  ok('the CRM has eleven tabs (Reports since wave160, Studio since wave202) and #crm/automations marks Automations', b.tabs.length === 11 && b.tabs[9] === 'Automations*', b.tabs);
  ok('the list: each automation with its trigger in words and its status', b.rows.length === 3 && /When someone fills in “Volunteer with Welfare Avenue”/.test(b.rows[0]) && /Draft/i.test(b.rows[0]) &&
    /When a gift is recorded/.test(b.rows[1]) && /On/.test(b.rows[1]) && /2 days before a Montreal serving they are confirmed for/.test(b.rows[2]) && /Paused/i.test(b.rows[2]), b.rows);
  ok('the counts: in it now, finished, emails sent, and the one that needs a look', /1 person in it now/.test(b.rows[1]) && /3 finished/.test(b.rows[1]) && /3 emails sent/.test(b.rows[1]) && /1 needs a look/.test(b.rows[1]) && /6 steps · 3 emails/.test(b.rows[0]), b.rows);
  ok('the test-mode notice says emails only reach the test addresses', /test mode/i.test(b.note) && /test addresses/.test(b.note), b.note);
  const rail = await f.ev(() => [...document.querySelectorAll('#w153rail .w153it')].map(a => a.textContent.trim()));
  ok('the CRM rail lists Automations under Email, after Campaigns', rail.join('|') === 'Contacts|Partners|Possible duplicates|Sources|Lists|Forms|Gifts|Email|Studio|Campaigns|Automations|Reports', rail);   /* wave163: Partners */
  await shot(f, 'autos_list');

  /* the editor */
  await click(f, '#crm [data-w157open="1"]'); await f.page.waitForTimeout(900);
  /* wave196: the editor is a flow of cards; a step's fields are in the panel once its card is chosen */
  const pick = async k => { await click(f, '#crm [data-w196sel="' + k + '"]'); await f.page.waitForTimeout(250); };
  b = await f.ev(() => ({ hash: location.hash, steps: document.querySelectorAll('#crm .w196card[data-w157si]').length,
    outline: [(document.querySelector('#crm .w157tr') || {}).textContent || ''].concat([...document.querySelectorAll('#crm .w157ol li')].map(x => x.textContent)), on: !!document.querySelector('#crm [data-w157on]') }));
  await pick('t'); Object.assign(b, await f.ev(() => ({ kind: (document.querySelector('#crm [data-w157t="kind"]') || {}).value, form: (document.querySelector('#crm [data-w157t="form_id"]') || {}).value })));
  await pick('0'); Object.assign(b, await f.ev(() => ({ email1: (document.querySelector('#crm [data-w157si="0"] [data-w157s="_email"]') || {}).value })));
  await pick('1'); Object.assign(b, await f.ev(() => ({ dept: (document.querySelector('#crm [data-w157si="1"] [data-w157s="department"]') || {}).value })));
  await pick('4'); Object.assign(b, await f.ev(() => ({ yes: [...((document.querySelector('#crm [data-w157si="4"] [data-w157s="yes"]') || {}).options || [])].map(o => o.value), yesVal: (document.querySelector('#crm [data-w157si="4"] [data-w157s="yes"]') || {}).value,
    watch: (document.querySelector('#crm [data-w157si="4"] [data-w157s="step"]') || {}).value })));
  ok('Open shows the editor at #crm/automations/1 with its six steps and its form', b.hash === '#crm/automations/1' && b.steps === 6 && b.kind === 'form' && b.form === '1' && b.email1 === 'tpl:welcome_volunteer' && b.dept === 'opsmtl' && b.on, b);
  ok('the outline says it in plain words, from the trigger to each step', b.outline.length === 7 && /Volunteer with Welfare Avenue/.test(b.outline[0]) && /Email: Welcome, new volunteer/.test(b.outline[1]) && /A task for Operations Montreal/.test(b.outline[2]) && /Wait 2 days/.test(b.outline[3]) && /If opened: end\. If not: go on/.test(b.outline[5]), b.outline);
  ok('wait until opened watches an earlier email, and its paths only go forward or end', b.watch === 's4' && b.yesVal === 'end' && JSON.stringify(b.yes) === '["next","end"]', b);
  await shot(f, 'auto_editor');
  await click(f, '#crm [data-w196ins="6"]'); await f.page.waitForTimeout(200);
  await click(f, '#crm [data-w157add="tag"]'); await f.page.waitForTimeout(300);
  await setv(f, '#crm [data-w157si="6"] [data-w157s="_add"]', 'welcomed, Rally 2026');
  await pick('2');
  await setv(f, '#crm [data-w157si="2"] [data-w157s="days"]', '4');
  await click(f, '#crm [data-w157save]'); await f.page.waitForTimeout(1300);
  b = await f.ev(() => ({ ins: window.__ins.slice(), msg: (document.querySelector('#crm .w154msg') || {}).innerText }));
  const up1 = b.ins.filter(x => x.t === 'crm_automations' && x.op === 'update')[0];
  ok('a tag step is added and the save cleans the steps (arrays, numbers, no helper keys)', up1 && up1.p.steps.length === 7 && JSON.stringify(up1.p.steps[6].add) === '["welcomed","Rally 2026"]' && up1.p.steps[6].id === 's7' &&
    up1.p.steps[2].days === 4 && !JSON.stringify(up1.p.steps).includes('"_') && up1.p.steps[0].subject === undefined && up1.p.trigger.form_id === 1 && up1.p.name === 'Welcome new volunteers (Montreal)', up1 && up1.p);
  ok('the save says so', /Saved/.test(b.msg || ''), b.msg);

  /* turning on: the database's check first (the stub never changes the fixture, so the reloaded row has the six fixture steps) */
  await click(f, '#crm [data-w157on]'); await f.page.waitForTimeout(1400);
  b = await f.ev(() => ({ cf: (document.querySelector('#crm .w155cf') || {}).innerText || '', rpc: window.__rpc.filter(x => x.fn === 'crm_automation_problems'), status: window.__ins.filter(x => x.t === 'crm_automations' && x.p && x.p.status) }));
  ok('Turn on shows what is not ready, from the database check, and changes nothing', /Not ready to turn on yet/.test(b.cf) && /\[Paste/.test(b.cf) && b.rpc.length === 1 && b.rpc[0].args.p_steps.length >= 6 && b.rpc[0].args.p_steps[0].id === 's1' && b.rpc[0].args.p_trigger.kind === 'form' && b.status.length === 0, { cf: b.cf, rpcs: b.rpc.length, steps: b.rpc[0] && b.rpc[0].args.p_steps.length, status: b.status });
  await f.ev(() => { window.__problems = []; });
  await click(f, '#crm [data-w157no]'); await f.page.waitForTimeout(200);
  await click(f, '#crm [data-w157on]'); await f.page.waitForTimeout(1400);
  b = await f.ev(() => (document.querySelector('#crm .w155cf') || {}).innerText || '');
  ok('once ready, it asks first: who starts it, the hours, test mode', /Turn on “Welcome new volunteers \(Montreal\)”\?/.test(b) && /when someone fills in “Volunteer with Welfare Avenue”/.test(b) && /8 am and 8 pm/.test(b) && /test mode/.test(b), b);
  await click(f, '#crm [data-w157onok]'); await f.page.waitForTimeout(1300);
  b = await f.ev(() => ({ st: window.__ins.filter(x => x.t === 'crm_automations' && x.p && x.p.status), msg: (document.querySelector('#crm .w154msg') || {}).innerText }));
  ok('then the status goes to on and the page says who starts it', b.st.length === 1 && b.st[0].p.status === 'on' && /^On: when someone fills in/.test(b.msg || ''), b);

  /* try it on me, the preview */
  await click(f, '#crm [data-w157try]'); await f.page.waitForTimeout(1500);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_automation_try'), msg: (document.querySelector('#crm .w154msg') || {}).innerText }));
  ok('Try it on me starts a test run on the caller and says what happens', b.rpc.length === 1 && b.rpc[0].args.p_automation_id === 1 && /A test run started on your own contact/.test(b.msg || '') && /steel\.macdonald@welfareavenue\.com/.test(b.msg || ''), b);
  await pick('3');
  await click(f, '#crm [data-w157pv="3"]'); await f.page.waitForTimeout(1000);
  b = await f.ev(() => ({ pv: window.__calls.filter(x => x.action === 'preview').slice(-1)[0], frame: !!document.querySelector('#crm .w154frame'), side: (document.querySelector('#crm .w154pv') || {}).innerText || '' }));
  ok('Preview renders a written email through mail-send with sample details', b.pv && b.pv.template_key === 'newsletter' && b.pv.kind === 'volunteer' && b.pv.vars.headline === 'Welcome to our community' && /<p>/.test(b.pv.vars.body_html) && b.pv.vars.amount === '$25.00' && b.pv.contact_id === 5003 && b.frame && /sample details/.test(b.side), b);
  await shot(f, 'auto_preview');
  await click(f, '#crm [data-w157pvclose]'); await f.page.waitForTimeout(300);
  await pick('t');
  await setv(f, '#crm [data-w157t="kind"]', 'serving'); await f.page.waitForTimeout(400);
  b = await f.ev(() => ({ days: (document.querySelector('#crm [data-w157t="days_before"]') || {}).value, loc: (document.querySelector('#crm [data-w157t="location"]') || {}).value, first: ((document.querySelector('#crm .w196card.trig') || {}).textContent || '') }));
  ok('the trigger becomes a serving reminder: days before, the place, in words', b.days === '2' && b.loc === 'Montreal' && /2 days before a Montreal serving they are confirmed for/.test(b.first), b);
  ok('no page errors', f.errs.length === 0, f.errs);

  /* the people in the gift thank-you */
  await f.hash('#crm/automations/2/people', 1600);
  b = await f.ev(() => ({ rows: [...document.querySelectorAll('#crm .w156sub')].map(r => r.innerText.replace(/\s+/g, ' ')) }));
  const rowOf = n => b.rows.filter(r => r.indexOf(n) >= 0)[0] || '';
  ok('People lists each run: the person, the next step, the status, test runs marked', b.rows.length === 3 && /Next: Email: Thank you for a gift/.test(rowOf('Amara Okafor')) && /In it now/i.test(rowOf('Amara Okafor')) && /Test run/i.test(rowOf('Steel MacDonald')) && /Finished/i.test(rowOf('Élodie Gagnon')) && !/Next:/.test(rowOf('Élodie Gagnon')), b.rows);
  await click(f, '#crm [data-w157run="72"]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => [...document.querySelectorAll('#crm .w157hist li')].map(x => x.textContent));
  ok('a run opens on its history, step by step', b.length === 3 && /Gave \$20\.00/.test(b[0]) && /Sent "Thank you, Élodie"/.test(b[1]) && /Finished/.test(b[2]), b);
  await click(f, '#crm [data-w157run="71"]'); await f.page.waitForTimeout(300);
  await click(f, '#crm [data-w157stop="71"]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => window.__rpc.filter(x => x.fn === 'crm_automation_stop'));
  ok('Stop it for them stops that run', b.length === 1 && b[0].args.p_run_id === 71, b);
  await shot(f, 'auto_people');

  /* a contact's page lists the automations they are in */
  await f.hash('#crm/c/5001', 1800);
  b = await f.ev(() => { const secs = [...document.querySelectorAll('.w152sec')].filter(x => /Automations/.test((x.querySelector('h4') || {}).textContent || '')); return secs.length ? secs[0].innerText.replace(/\s+/g, ' ') : ''; });
  ok('a contact’s page lists the automations they are in, with where they are', /Thank donors for a gift/.test(b) && /In it now/i.test(b) && /Next: Email: Thank you for a gift/.test(b), b);
  await f.hash('#crm/automations', 900);

  /* a new draft */
  await f.hash('#crm/automations', 900);
  await click(f, '#crm [data-w157new]'); await f.page.waitForTimeout(1300);
  b = await f.ev(() => window.__ins.filter(x => x.t === 'crm_automations' && x.op === 'insert').slice(-1)[0]);
  ok('New automation makes a draft that starts from a form', b && b.p.status === 'draft' && b.p.name === 'New automation' && b.p.trigger.kind === 'form' && Array.isArray(b.p.steps) && b.p.steps.length === 0, b);
  ok('no page errors (after the people and the draft)', f.errs.length === 0, f.errs);
  await f.close();

  /* phone */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(), init: STUB, wait: 4000 });
  await patch(f);
  await f.hash('#crm/automations', 2400);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, rows: document.querySelectorAll('#crm .w156row').length }));
  ok('phone: the automations list does not scroll sideways', b.rows === 3 && b.sw <= b.w + 1, b);
  await shot(f, 'phone_autos');
  await f.hash('#crm/automations/1', 1400);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, steps: document.querySelectorAll('#crm .w157step').length }));
  ok('phone: the editor does not scroll sideways', b.steps === 6 && b.sw <= b.w + 1, b);
  await shot(f, 'phone_auto_editor');
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw157drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
