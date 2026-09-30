/* w169drive.js: wave169, the master onboarding runs the Academy, and trainings are assigned to the organization.
   Steel (29/09/26): "the master onboarding in the hr center that controls the onboarding. I want to make that's synced to what
   people see on their Avenue Academy page. Also, I want HR to have the ability to assign trainings to the org through that same
   page in the hr center. Leaders should have that ability on the Avenue Academy page as well".
   The onboarding rows and the Academy come from the live database (scratchpad fx166.json, as in w166drive and w167drive), the
   journey from fx167.json, the roster and access from fx169.json (the live team, 30/09/26), the photos from fx_w168.json.
   Two people are onboarding (Alyx Denison and Zachee Leonel Ngue, as live). Uses test/boot.js (stubbed Supabase, clock fixed
   25/09/26); the database calls are caught by a spy (the stub never writes). CAND=<file> to test another build. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }

const LIVE = {}; JSON.parse(fs.readFileSync(SP + 'fx166.json', 'utf8')).forEach(r => { LIVE[r.k] = r.v; });
const X = JSON.parse(fs.readFileSync(SP + 'fx167.json', 'utf8'));
const ROSTER = JSON.parse(fs.readFileSync(SP + 'fx169.json', 'utf8'));
const PHOTOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fx_w168.json'), 'utf8')).wa_photos;
const DUE = { 'WEEK 1': 7, 'WEEK 2': 14, 'WEEK 3': 21, 'WEEK 4': 28, '60 DAYS': 60 };
function plus(d, n) { const x = new Date(String(d).slice(0, 10) + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
const TODAY = '2026-09-25';
const clone = o => JSON.parse(JSON.stringify(o));

function fx(extra) {
  const f = loadFixture();
  ['onboarding_template', 'onboardings', 'onboarding_steps', 'hr_setup_template', 'hr_setup_steps', 'academy_paths', 'trainings'].forEach(k => { f[k] = clone(LIVE[k]); });
  /* what wa167_journey did (as w167drive) */
  f.trainings.forEach(t => { if (t.path_group === 'Your first week') t.path_group = 'Your onboarding'; });
  f.academy_paths.forEach(p => { if (p.key === 'firstweek') { p.name = 'Your onboarding'; p.title = 'Your onboarding'; p.cert_title = 'Welcome to Welfare Avenue'; } });
  X.lessons.forEach((l, i) => f.trainings.push({ id: 990301 + i, category: 'Onboarding', title: l.title, description: l.body.summary, source: 'hub', path_group: 'Your onboarding', sort: l.sort, active: true, kind: 'lesson', key: l.key, minutes: l.minutes, body: l.body }));
  let sid = 995000;
  X.steps.forEach(s => {
    const tr = f.trainings.find(t => t.key === s.key);
    f.onboarding_template.push({ id: s.id, section: s.section, parent_id: null, name: s.name, description: s.description, sort: 1, priority: 'high', active: true, content_pending: false, clickup_url: null, academy_path: null, training_id: tr.id });
    f.onboardings.filter(x => x.status === 'active').forEach(x => f.onboarding_steps.push({ id: ++sid, onboarding_id: x.id, template_id: s.id, done: false, done_at: null, done_by: null, due_date: plus(x.started_at, DUE[s.section]) }));
  });
  f.onboarding_template.sort((a, b) => (a.sort - b.sort) || String(a.id).localeCompare(String(b.id)));
  f.app_config = (f.app_config || []).filter(r => r.key !== 'onboarding_journey').concat([{ key: 'onboarding_journey', value: JSON.stringify(X.journey) }]);
  /* the live roster and access (30/09/26) */
  f.team_members = ROSTER.map(m => ({ id: m.id, name: m.name, email: m.email, department: m.department, active: true, role: m.role }));
  f.hub_roles = ROSTER.filter(m => m.email && m.hub_role).map(m => ({ email: m.email, role: m.hub_role, profile: m.profile, tabs: null, note: m.name }));
  f.wa_photos = clone(PHOTOS);
  f.onboarding_help = [];
  f.training_progress = [];
  f.academy_assignments = [];
  if (extra) extra(f);
  return f;
}
const CAND = process.env.CAND || undefined;
/* the database calls: rpc and writes, with the answers the database would give */
async function spy(f, R) {
  await f.ev(R0 => {
    window.__rpc = []; window.__writes = [];
    const orpc = db.rpc.bind(db);
    db.rpc = function (fn, args) {
      window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(args === undefined ? null : args)) });
      if (R0 && Object.prototype.hasOwnProperty.call(R0, fn)) { const v = R0[fn]; return Promise.resolve(v && v.__error ? { data: null, error: { message: v.__error } } : { data: v, error: null }); }
      return orpc(fn, args);
    };
    const ofrom = db.from.bind(db);
    db.from = function (t) {
      const b = ofrom(t);
      ['insert', 'update', 'upsert', 'delete'].forEach(m => { const o = b[m] && b[m].bind(b); if (o) b[m] = function (row) { window.__writes.push({ t: t, m: m, row: JSON.parse(JSON.stringify(row === undefined ? null : row)) }); return o.apply(null, arguments); }; });
      return b;
    };
  }, R || {});
}
const rpcs = f => f.ev(() => window.__rpc || []);
const writes = f => f.ev(() => window.__writes || []);
async function click(f, sel, ms) { const n = await f.ev(s => { const el = document.querySelector(s); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; }, sel); await f.page.waitForTimeout(ms || 500); return n; }
async function view(f, v) { await f.ev(x => { const t = document.querySelector('#w46body .w47tab[data-w47v="' + x + '"]'); if (t) t.click(); }, v); await f.page.waitForTimeout(700); }
const SHOT = process.env.SHOTS ? SP + 'w169/' : null;   /* SHOTS=1 saves screenshots to the scratchpad */
async function shot(f, name, full) { if (SHOT) await f.page.screenshot({ path: SHOT + name + '.png', fullPage: !!full }); }
const visible = (f, sel) => f.ev(s => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }, sel);

/* an assignment list as academy_assignments_list returns it */
const LIST = [
  { id: 11, training_id: null, path_key: 'hub', audience: 'everyone', teams: [], people: [], include_new: true, due_date: '2026-10-09', note: 'We all run on the Hub now.', assigned_by: 'Tuna', created_at: '2026-09-20T14:00:00Z', active: true, ended_at: null, ended_by: null, title: 'Using the Hub', modules: 9,
    people_state: [{ name: 'Ahmed', department: 'opsmtl', done: 9, total: 9, started: false, due: null }, { name: 'Joy', department: 'marketing', done: 3, total: 9, started: true, due: '2026-10-09' }, { name: 'Karan', department: 'opsto', done: 0, total: 9, started: false, due: '2026-10-09' }] },
  { id: 12, training_id: 212, path_key: null, audience: 'team', teams: ['opsmtl'], people: [], include_new: true, due_date: '2026-09-20', note: null, assigned_by: 'Valex', created_at: '2026-09-10T14:00:00Z', active: true, ended_at: null, ended_by: null, title: 'Download Chrome', modules: 1,
    people_state: [{ name: 'Mary', department: 'opsmtl', done: 0, total: 1, started: false, due: '2026-09-20' }, { name: 'Ahmed', department: 'opsmtl', done: 1, total: 1, started: false, due: null }] },
  { id: 9, training_id: null, path_key: 'branding', audience: 'people', teams: [], people: ['joy.dumansi@welfareavenue.com'], include_new: false, due_date: null, note: null, assigned_by: 'Steel', created_at: '2026-09-01T14:00:00Z', active: false, ended_at: '2026-09-15T14:00:00Z', ended_by: 'Steel', title: 'Our brand', modules: 3,
    people_state: [{ name: 'Joy', department: 'marketing', done: 1, total: 3, started: true, due: null }] }
];

(async () => {
  const browser = await launch();

  /* ---------- 1. the HR centre as an admin: the master says what people see, the cards, the Training view ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre/onboarding', fixture: fx(), wait: 5200, candidate: CAND, rpcs: { academy_assignments_list: LIST, wa_org_editor: true } });
    await f.page.waitForTimeout(1500);
    const j = await f.ev(() => {
      const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
      const wk = qa('#w46master details.w46wk').map(d => { const s = d.querySelector('summary'); return { name: String(s.childNodes[0].textContent).trim(), tt: (s.querySelector('.w169tt') || {}).textContent || null, see: (d.querySelector(':scope > .w169see') || {}).textContent || null, photo: !!(d.querySelector(':scope > .w169see .ph:not(.none)')) }; });
      const chips = qa('#w46master .w169chip').map(c => c.textContent);
      const card = q('#w169cardO'), master = qa('#w46body .w46sec').filter(s => /^Master onboarding/.test((s.querySelector('h3') || {}).textContent || ''))[0];
      return { wk, chips, bar: !!q('#w46body .w169bar [data-w169preview="w169sample"]'), journeys: qa('#w46body [data-w169preview]:not([data-w169preview="w169sample"])').map(a => a.getAttribute('data-w169preview')),
        card: card ? { h3: card.querySelector('h3').textContent, afterMaster: !!master && master.nextElementSibling === card, shown: card.style.display !== 'none', items: card.querySelectorAll('.w169a').length, txt: card.textContent } : null,
        trainingsShownHere: qa('#w46body .w46sec').filter(s => /^Trainings across the team$/.test((s.querySelector('h3') || {}).textContent || '')).map(s => s.style.display) };
    });
    ok('1.1 no page errors', f.errs.length === 0, f.errs);
    ok('1.2 every week of the master says what people see', j.wk.length >= 5 && j.wk.every(w => w.see && /What people see in the Academy/.test(w.see)), j.wk);
    const w1 = j.wk.find(w => w.name === 'WEEK 1') || {};
    ok('1.3 week 1 carries the journey\'s title and photo', w1.tt === 'Get set up' && /Get set up/.test(w1.see || '') && w1.photo && /Set up your Welfare Avenue accounts/.test(w1.see || ''), w1);
    ok('1.4 week 1 names the lesson that opens it', /Opens with:/.test(w1.see || ''), w1.see);
    ok('1.5 Academy steps say where they are done', j.chips.some(c => /^Academy: Using the Hub$/.test(c)) && j.chips.some(c => /^Academy: their team’s Learning Avenue$/.test(c)) && j.chips.some(c => /^Opens the week$/.test(c)), j.chips);
    ok('1.6 Preview what a new person sees, and Journey for each person onboarding', j.bar && j.journeys.length === 2 && j.journeys.indexOf('4') >= 0 && j.journeys.indexOf('5') >= 0, j);
    ok('1.7 the assign card sits after the master, in the Onboarding view', j.card && j.card.h3 === 'Assign trainings to the organization' && j.card.afterMaster && j.card.shown && j.card.items === 2 && /See every assignment \(2\)/.test(j.card.txt), j.card);
    if (SHOT) { await f.ev(() => { const d = document.querySelector('#w46master details.w46wk'); if (d) d.open = true; const m = document.getElementById('w46master'); if (m) m.parentElement.scrollIntoView(); }); await f.page.waitForTimeout(300); await shot(f, 's1_master'); await f.ev(() => document.getElementById('w169cardO').scrollIntoView()); await f.page.waitForTimeout(300); await shot(f, 's1_cardO'); }
    ok('1.8 the Trainings section left the Onboarding view', j.trainingsShownHere.length === 1 && j.trainingsShownHere[0] === 'none', j.trainingsShownHere);
    /* the Training view */
    await view(f, 'training');
    const t = await f.ev(() => {
      const qa = s => [...document.querySelectorAll(s)];
      const secs = qa('#w46body > .w46sec').filter(s => s.style.display !== 'none').map(s => (s.querySelector('h3') || {}).textContent);
      const card = document.getElementById('w169cardT');
      return { secs, items: card ? [...card.querySelectorAll('.w169a')].map(a => ({ off: a.classList.contains('off'), txt: a.textContent })) : null, bulk: (document.querySelector('[data-w57bulk]') || {}).textContent };
    });
    ok('1.9 the Training view shows the assignments first, then Trainings', t.secs[0] === 'Trainings assigned to the organization' && t.secs.indexOf('Trainings across the team') === 1, t.secs);
    ok('1.10 every assignment, with how far people are', t.items && t.items.length === 3 && /Using the Hub/.test(t.items[0].txt) && /1 of 3 people done/.test(t.items[0].txt) && /Everyone, new people too/.test(t.items[0].txt) && /We all run on the Hub now/.test(t.items[0].txt), t.items);
    ok('1.11 a late assignment says who is late', t.items && /Download Chrome/.test(t.items[1].txt) && /1 person late/.test(t.items[1].txt) && /Operations|opsmtl|Montreal/i.test(t.items[1].txt), t.items && t.items[1]);
    ok('1.12 a stopped one is shown faded, without Stop', t.items && t.items[2].off && /Stopped/.test(t.items[2].txt) && !/Stop$/.test(t.items[2].txt), t.items && t.items[2]);
    ok('1.13 the bulk pill now assigns to the organization', t.bulk === 'Assign trainings (everyone, teams or people)', t.bulk);
    /* See who */
    await click(f, '#w169cardT [data-w169who="11"]');
    const who = await f.ev(() => [...document.querySelectorAll('#w169cardT [data-w169aid="11"] .w169who > div')].map(d => d.textContent));
    if (SHOT) { await f.ev(() => document.getElementById('w169cardT').scrollIntoView()); await f.page.waitForTimeout(300); await shot(f, 's1_cardT'); }
    ok('1.14 See who lists each person and where they are', who.length === 3 && /Ahmed.*Done/.test(who[0]) && /Joy.*3 of 9/.test(who[1]) && /Karan.*Not started/.test(who[2]), who);
    /* Stop asks first, then stops */
    await spy(f, { academy_assign_end: { removed: 1, kept: 1 }, academy_assignments_list: LIST });
    await click(f, '#w169cardT [data-w169stopask="12"]');
    const sure = await f.ev(() => (document.querySelector('#w169cardT [data-w169aid="12"] .sure') || {}).textContent || '');
    ok('1.15 Stop asks before it stops', /Stop it\?/.test(sure) && (await rpcs(f)).filter(r => r.fn === 'academy_assign_end').length === 0, sure);
    await click(f, '#w169cardT [data-w169stop="12"]', 900);
    const r1 = await rpcs(f), toast1 = await f.ev(() => (document.getElementById('toast') || {}).textContent || '');
    ok('1.16 Yes, stop it ends the assignment', r1.some(r => r.fn === 'academy_assign_end' && r.args && r.args.p_id === 12) && /Stopped: 1 person had not started, 1 keep what they started/.test(toast1), { r1, toast1 });
    await f.close();
  }


  /* ---------- 2. what people see, edited from the master (the week editor) ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre/onboarding', fixture: fx(), wait: 5200, candidate: CAND, rpcs: { academy_assignments_list: [], wa_org_editor: true } });
    await f.page.waitForTimeout(1200);
    const saved = { title: 'Get connected', lesson: 'wa167w1', learn: ['Set up your accounts', 'Meet your team on Slack'], why: 'So your team can reach you.', photo: PHOTOS[0].path_web, fx: 0.5, fy: 0.5, alt: 'x' };
    await spy(f, { onboarding_journey_save: saved, academy_assignments_list: [] });
    await click(f, '#w46master [data-w169week="WEEK 1"]', 900);
    const m = await f.ev(() => {
      const b = document.getElementById('modalBox'); if (!b || document.getElementById('modalBack').style.display === 'none') return null;
      return { h3: b.querySelector('h3').textContent, title: (b.querySelector('#w169wt') || {}).value, learn: [...b.querySelectorAll('[data-w169learn]')].map(i => i.value), why: (b.querySelector('#w169wy') || {}).value,
        lesson: (b.querySelector('#w169wl') || {}).value, lessons: [...b.querySelectorAll('#w169wl option')].map(o => o.textContent), pics: b.querySelectorAll('[data-w169pic]').length, prev: (b.querySelector('#w169wprev') || {}).textContent };
    });
    ok('2.1 Edit what people see opens the week as the Academy shows it', m && m.h3 === 'What people see: Week 1' && m.title === 'Get set up' && m.learn.length === 3 && /Set up your Welfare Avenue accounts/.test(m.learn[0]) && /Everything at Welfare Avenue/.test(m.why) && m.lesson === 'wa167w1', m);
    ok('2.2 the lesson list is this week\'s Academy steps, the photos the ready ones', m && m.lessons[0] === 'None' && m.lessons.some(x => /Welcome to Welfare Avenue/.test(x)) && m.pics === PHOTOS.filter(p => p.usage === 'ready' && p.path_web && p.orientation !== 'portrait').length && m.pics > 0, m && { lessons: m.lessons, pics: m.pics });
    await shot(f, 's2_week');
    await f.page.fill('#w169wt', 'Get connected');
    await f.page.fill('[data-w169learn="1"]', 'Meet your team on Slack');
    await f.page.waitForTimeout(200);
    await click(f, '#modalBox [data-w169pic]:not(.on)', 300);
    const pv = await f.ev(() => ({ prev: document.getElementById('w169wprev').textContent, on: document.querySelectorAll('#modalBox [data-w169pic].on').length }));
    ok('2.3 the preview follows the typing and the photo', /Get connected/.test(pv.prev) && /Meet your team on Slack/.test(pv.prev) && pv.on === 1, pv);
    await click(f, '#w169wsave', 1000);
    const r = await rpcs(f), sv = r.filter(x => x.fn === 'onboarding_journey_save')[0];
    ok('2.4 Save sends the week to onboarding_journey_save', sv && sv.args.p_section === 'WEEK 1' && sv.args.p_week.title === 'Get connected' && sv.args.p_week.learn.indexOf('Meet your team on Slack') >= 0 && sv.args.p_week.lesson === 'wa167w1' && !!sv.args.p_week.photo_id, sv);
    const after = await f.ev(() => ({ closed: document.getElementById('modalBack').style.display === 'none', toast: (document.getElementById('toast') || {}).textContent, tt: ([...document.querySelectorAll('#w46master details.w46wk > summary')].filter(s => String(s.childNodes[0].textContent).trim() === 'WEEK 1')[0].querySelector('.w169tt') || {}).textContent, j: window.w167 ? w167.cfg().weeks['WEEK 1'].title : null }));
    ok('2.5 saved: the master and the journey show it at once', after.closed && /people see it in the Academy now/.test(after.toast) && after.tt === 'Get connected' && after.j === 'Get connected', after);
    /* a save the database refuses keeps the form open with the reason */
    await spy(f, { onboarding_journey_save: { __error: 'Pick a photo marked ready in the Photo library' } });
    await click(f, '#w46master [data-w169week="WEEK 2"]', 900);
    await click(f, '#w169wsave', 800);
    const bad = await f.ev(() => ({ open: document.getElementById('modalBack').style.display !== 'none', err: (document.getElementById('w169werr') || {}).textContent }));
    ok('2.6 a refused save says why and keeps the form', bad.open && /It did not save: Pick a photo marked ready/.test(bad.err), bad);
    await f.ev(() => closeModal());
    /* a step's editor: where it is done in the Academy */
    await spy(f, {});
    await f.ev(() => { const d = [...document.querySelectorAll('#w46master details.w46wk')]; d.forEach(x => { x.open = true; }); });
    await click(f, '#w46master [data-w37e="wa166usehub"]', 900);
    const st = await f.ev(() => { const s = document.getElementById('w169ac'); return s ? { v: s.value, n: s.options.length, groups: [...s.querySelectorAll('optgroup')].map(g => g.label).slice(0, 3) } : null; });
    ok('2.7 a step\'s editor says where it is done in the Academy', st && st.v === 'p:hub' && st.n > 50 && st.groups[0] === 'A Learning Avenue', st);
    await f.ev(() => { const s = document.getElementById('w169ac'); s.value = 't:212'; });
    await click(f, '#w44es', 900);
    const w = (await writes(f)).filter(x => x.t === 'onboarding_template' && x.m === 'update')[0];
    ok('2.8 saving it links the step to the module (and unlinks the avenue)', w && w.row.training_id === 212 && w.row.academy_path === null && w.row.name === 'Using the Hub (Avenue Academy)', w);
    await click(f, '#w46master [data-w37add="WEEK 3"]', 900);
    await f.page.fill('#w44an', 'Read the volunteer handbook');
    await f.ev(() => { const s = document.getElementById('w169ac'); s.value = 'p:ops'; });
    await click(f, '#w44as2', 900);
    const ins = (await writes(f)).filter(x => x.t === 'onboarding_template' && x.m === 'insert')[0];
    ok('2.9 a new step can be an Academy step from the start', ins && ins.row.section === 'WEEK 3' && ins.row.academy_path === 'ops' && ins.row.training_id === null && ins.row.name === 'Read the volunteer handbook', ins);
    ok('2.10 no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 3. assigning from the HR centre ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre/onboarding', fixture: fx(), wait: 5200, candidate: CAND, rpcs: { academy_assignments_list: LIST, wa_org_editor: true } });
    await f.page.waitForTimeout(1200);
    await spy(f, { academy_assign: { id: 21, people: 13, rows: 40 }, academy_assignments_list: LIST });
    await click(f, '#w169cardO [data-w169assign]', 1500);
    const a = await f.ev(() => {
      const b = document.getElementById('modalBox');
      return { h3: (b.querySelector('h3') || {}).textContent, groups: [...b.querySelectorAll('.w169what .gh')].map(g => g.textContent), items: b.querySelectorAll('[data-w169pick]').length, tours: b.querySelectorAll('[data-w169pick="p:tours"]').length,
        aud: (b.querySelector('[data-w169aud].on') || {}).textContent, who: (b.querySelector('#w169awho') || {}).textContent, sum: (b.querySelector('#w169asum') || {}).textContent };
    });
    ok('3.1 the form lists the Learning Avenues, then the modules by avenue', a.h3 === 'Assign a training' && a.groups[0] === 'Learning Avenues' && a.groups.length > 5 && a.items > 60 && a.tours === 0, a);
    ok('3.2 everyone is the whole team without the board', a.aud === 'Everyone' && /The whole team: 30 people with a sign-in/.test(a.who), a.who);
    await f.page.fill('#w169aq', 'slack');
    await f.page.waitForTimeout(250);
    const found = await f.ev(() => [...document.querySelectorAll('#modalBox [data-w169pick]')].map(b => b.getAttribute('data-w169pick')));
    ok('3.3 the search narrows the list', found.length >= 3 && found.length < 15 && found.indexOf('t:213') >= 0, found);
    await click(f, '#modalBox [data-w169pick="t:213"]', 200);
    await f.page.fill('#w169aq', '');
    await f.page.waitForTimeout(250);
    await click(f, '#modalBox [data-w169pick="p:hub"]', 200);
    await click(f, '#modalBox [data-w169aud="team"]', 300);
    await click(f, '#modalBox [data-w169team="opsmtl"]', 150);
    await click(f, '#modalBox [data-w169team="marketing"]', 150);
    await click(f, '#modalBox [data-w169due="' + plus(TODAY, 14) + '"]', 300);
    await f.page.fill('#w169anote', 'We all run on the Hub now.');
    const s1 = await f.ev(() => ({ tags: [...document.querySelectorAll('#modalBox .w169tag')].map(t => t.textContent.replace('×', '').trim()), sum: document.getElementById('w169asum').textContent, due: document.getElementById('w169adue').value, nw: document.getElementById('w169anew').checked }));
    ok('3.4 two trainings, two teams, a due date: the summary says it plainly', s1.tags.length === 2 && /Understanding Slack, part 1/.test(s1.tags[0]) && s1.tags[1] === 'Using the Hub' && /^2 trainings \(10 modules\) to 13 people, due Oct 9\./.test(s1.sum) && /People who join these teams later get it too/.test(s1.sum) && s1.due === '2026-10-09' && s1.nw, s1);
    await shot(f, 's3_assign');
    await click(f, '#w169ago', 1500);
    const r = (await rpcs(f)).filter(x => x.fn === 'academy_assign');
    ok('3.5 Assign sends one assignment per training, with the teams, the due date and the note', r.length === 2 && r[0].args.p.training_id === 213 && r[1].args.p.path_key === 'hub' && r.every(x => x.args.p.audience === 'team' && x.args.p.teams.join() === 'opsmtl,marketing' && x.args.p.due_date === '2026-10-09' && x.args.p.note === 'We all run on the Hub now.' && x.args.p.include_new === true), r);
    const done = await f.ev(() => ({ closed: document.getElementById('modalBack').style.display === 'none', toast: (document.getElementById('toast') || {}).textContent }));
    const relist = (await rpcs(f)).filter(x => x.fn === 'academy_assignments_list').length;
    ok('3.6 then the form closes, says so and the list reloads', done.closed && /Assigned 2 trainings to 13 people/.test(done.toast) && relist >= 1, { done, relist });
    /* nothing picked */
    await spy(f, { academy_assign: { id: 22, people: 2, rows: 2 } });
    await click(f, '#w169cardO [data-w169assign]', 1200);
    await click(f, '#w169ago', 300);
    const e1 = await f.ev(() => (document.getElementById('w169aerr') || {}).textContent);
    ok('3.7 Assign with nothing picked says what is missing', /Pick what to assign/.test(e1) && (await rpcs(f)).filter(x => x.fn === 'academy_assign').length === 0, e1);
    /* people: new people never, and the emails */
    await click(f, '#modalBox [data-w169pick="t:212"]', 200);
    await click(f, '#modalBox [data-w169aud="people"]', 300);
    const pp = await f.ev(() => ({ nw: !!document.getElementById('w169anew'), ppl: document.querySelectorAll('#modalBox [data-w169person]').length }));
    await f.page.fill('#w169apq', 'joy');
    await f.page.waitForTimeout(200);
    await click(f, '#modalBox [data-w169person="joy.dumansi@welfareavenue.com"]', 150);
    await f.page.fill('#w169apq', 'karan');
    await f.page.waitForTimeout(200);
    await click(f, '#modalBox [data-w169person="karan.singh@welfareavenue.com"]', 150);
    const sm = await f.ev(() => document.getElementById('w169asum').textContent);
    await click(f, '#w169ago', 1200);
    const r2 = (await rpcs(f)).filter(x => x.fn === 'academy_assign');
    ok('3.8 for people: no "join later", the picked emails, include_new false', !pp.nw && pp.ppl === 30 && /Getting started with Chrome and your Google account \(1 module\) to 2 people\./.test(sm) && r2.length === 1 && r2[0].args.p.audience === 'people' && r2[0].args.p.people.join() === 'joy.dumansi@welfareavenue.com,karan.singh@welfareavenue.com' && r2[0].args.p.include_new === false && r2[0].args.p.due_date === null, { pp, sm, r2 });
    /* a refusal keeps what did not go */
    await spy(f, { academy_assign: { __error: 'The due date has passed' } });
    await click(f, '#w169cardO [data-w169assign]', 1200);
    await click(f, '#modalBox [data-w169pick="t:212"]', 200);
    await click(f, '#w169ago', 800);
    const e2 = await f.ev(() => ({ err: (document.getElementById('w169aerr') || {}).textContent, open: document.getElementById('modalBack').style.display !== 'none', tags: document.querySelectorAll('#modalBox .w169tag').length }));
    ok('3.9 a refusal keeps the form open, with the reason and the picks', e2.open && /It did not go: The due date has passed/.test(e2.err) && e2.tags === 1, e2);
    await f.ev(() => closeModal());
    ok('3.10 no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 4. who can: HR's own profile yes, a team member no ---------- */
  {
    const f = await fresh(browser, { who: 'member', width: 1366, hash: '#hrcentre/onboarding', fixture: fx(), wait: 5200, candidate: CAND, rpcs: { academy_assignments_list: LIST } });
    await f.page.waitForTimeout(1500);
    const h = await f.ev(() => ({ notice: /for the HR team, and for admins and leaders/.test((document.getElementById('hrcentre') || {}).textContent || ''), board: !!document.querySelector('#w46body [data-w46assign]'), bar: !!document.querySelector('#w46body .w169bar'), card: !!document.getElementById('w169cardO'), see: document.querySelectorAll('#w46master .w169see').length, can: window.w169 && w169.can() }));
    ok('4.1 HR (its own access profile) gets the HR centre, the master and the assign card', !h.notice && h.board && h.bar && h.card && h.see >= 5 && h.can === true, h);
    await f.hash('#training', 2500);
    const ac = await f.ev(() => ({ top: !!document.querySelector('#w122 .w122top [data-w169assign]') }));
    ok('4.2 HR sees Assign a training in the Avenue Academy', ac.top, ac);
    ok('4.3 no page errors (HR)', f.errs.length === 0, f.errs);
    await f.close();
  }
  {
    const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#hrcentre/onboarding', fixture: fx(), wait: 5200, candidate: CAND, rpcs: { academy_assignments_list: LIST } });
    await f.page.waitForTimeout(1200);
    const h = await f.ev(() => ({ can: window.w169 && w169.can(), bar: !!document.querySelector('.w169bar'), card: !!document.getElementById('w169cardO'), master: !!document.getElementById('w46master') }));
    ok('4.4 a team member gets none of it in the HR centre', h.can === false && !h.bar && !h.card && !h.master, h);
    await f.hash('#training/t/213', 2500);
    const m = await f.ev(() => ({ top: !!document.querySelector('#w122 .w122top [data-w169assign]'), sheet: !!document.querySelector('#w122sheet .sh .hd'), assign: !!document.querySelector('#w122sheet [data-w169assign], #w122sheet [data-w122assign]') }));
    ok('4.5 nor in the Academy (no Assign on a module)', !m.top && m.sheet && !m.assign, m);
    ok('4.6 no page errors (team member)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 5. the preview: a new person on day one, and someone on the board ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre/onboarding', fixture: fx(), wait: 5200, candidate: CAND, rpcs: { academy_assignments_list: [], wa_org_editor: true } });
    await f.page.waitForTimeout(1200);
    await click(f, '#w46body .w169bar [data-w169preview="w169sample"]', 3500);
    const p = await f.ev(() => {
      const sh = document.querySelector('#w122sheet .sh'); if (!sh) return { hash: location.hash };
      const q = s => sh.querySelector(s);
      return { hash: location.hash, banner: (q('.w169pv') || {}).textContent, hero: (q('.w167hero h1') || {}).textContent, ey: (q('.w167hero .ey') || {}).textContent, weeks: sh.querySelectorAll('.w167road .stops > *').length,
        boxes: sh.querySelectorAll('.onbwrap input[data-w37chk]').length, enabled: sh.querySelectorAll('.onbwrap input[data-w37chk]:not([disabled])').length, help: !!document.getElementById('w166help'), cls: document.body.classList.contains('w169pvon'),
        view: !!window.__w169view, due: (sh.querySelector('.onbwrap .w44due') || {}).textContent, wk: (q('.w167wh') || {}).textContent };
    });
    ok('5.1 Preview opens the journey in the Academy, with its banner', p.hash === '#training/onboarding' && /Preview · what a new person sees on their first day/.test(p.banner || '') && p.cls && p.view, p);
    ok('5.2 a new person on day one: welcomed as a friend, every step still to do, due by the master\'s weeks', p.hero === 'Welcome, friend' && /day 1\b/i.test(p.ey || '') && p.boxes > 30 && /due 2026-10-02/.test(p.due || '') && p.weeks >= 5, p);
    ok('5.3 read only: nothing can be ticked, no help form', p.enabled === 0 && !p.help, p);
    await shot(f, 's5_preview');
    await click(f, '#w122sheet [data-w169pvx]', 2500);
    const b = await f.ev(() => ({ hash: location.hash, view: !!window.__w169view, cls: document.body.classList.contains('w169pvon'), sheet: !!document.querySelector('#w122sheet.on'), master: !!document.getElementById('w46master') }));
    ok('5.4 Back to the master onboarding ends the preview', b.hash === '#hrcentre/onboarding' && !b.view && !b.cls && !b.sheet && b.master, b);
    /* someone on the board */
    await click(f, '#w46body [data-w169preview="4"]', 3500);
    const q2 = await f.ev(() => { const sh = document.querySelector('#w122sheet .sh'); return { banner: (sh.querySelector('.w169pv') || {}).textContent, hero: (sh.querySelector('.w167hero h1') || {}).textContent, enabled: sh.querySelectorAll('.onbwrap input[data-w37chk]:not([disabled])').length }; });
    ok('5.5 Journey shows one person\'s onboarding as they see it, read only', /what Alyx sees in the Avenue Academy today/.test(q2.banner || '') && q2.hero === 'Welcome, Alyx' && q2.enabled === 0, q2);
    await click(f, '#w122sheet [data-w122x]', 2500);
    const c2 = await f.ev(() => ({ hash: location.hash, view: !!window.__w169view }));
    ok('5.6 closing the plan goes back to the HR centre', c2.hash === '#hrcentre/onboarding' && !c2.view, c2);
    /* my own plan is mine again */
    await f.hash('#training/onboarding', 2500);
    const own = await f.ev(() => ({ banner: !!document.querySelector('#w122sheet .w169pv'), h2: (document.querySelector('#w122sheet .sh .hd h2') || {}).textContent }));
    ok('5.7 after a preview, the plan sheet is the viewer\'s own again', !own.banner, own);
    ok('5.8 no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 6. Assigned to you, in the Avenue Academy ---------- */
  const MINE = f0 => {
    f0.academy_assignments = [
      { id: 11, training_id: null, path_key: 'hub', audience: 'everyone', teams: [], people: [], member_ids: [], include_new: true, due_date: '2026-10-09', due_days: 14, note: 'We all run on the Hub now.', assigned_by: 'Tuna', assigned_by_email: 'tuna.kaynak@welfareavenue.com', created_at: '2026-09-20T14:00:00Z', active: true, ended_at: null, ended_by: null },
      { id: 13, training_id: 213, path_key: null, audience: 'people', teams: [], people: ['joy.dumansi@welfareavenue.com'], member_ids: [22], include_new: false, due_date: '2026-09-20', due_days: 5, note: null, assigned_by: 'Valex', assigned_by_email: 'valex.sanon@welfareavenue.com', created_at: '2026-09-15T14:00:00Z', active: true, ended_at: null, ended_by: null }
    ];
    const hub = f0.trainings.filter(t => t.path_group === 'Using the Hub' && t.active !== false && t.kind !== 'tour').sort((a, b) => (a.sort || 0) - (b.sort || 0));
    let id = 770000;
    hub.forEach((t, i) => f0.training_progress.push(i < 3 ? { id: ++id, training_id: t.id, person_name: 'Joy', email: 'joy.dumansi@welfareavenue.com', status: 'done', done_at: '2026-09-18T15:00:00Z', pct: 100 }
      : { id: ++id, training_id: t.id, person_name: 'Joy', email: 'joy.dumansi@welfareavenue.com', status: i === 3 ? 'started' : 'assigned', started_at: i === 3 ? '2026-09-24T15:00:00Z' : null, pct: i === 3 ? 40 : 0, assigned_by: 'Tuna', note: 'We all run on the Hub now.', assignment_id: 11, due_date: '2026-10-09' }));
    f0.training_progress.push({ id: ++id, training_id: 213, person_name: 'Joy', email: 'joy.dumansi@welfareavenue.com', status: 'assigned', assigned_by: 'Valex', assignment_id: 13, due_date: '2026-09-20', pct: 0 });
    f0.training_progress.push({ id: ++id, training_id: 94, person_name: 'Joy', email: 'joy.dumansi@welfareavenue.com', status: 'assigned', assigned_by: 'Ahmed', pct: 0 });
  };
  {
    const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#training', fixture: fx(MINE), wait: 5200, candidate: CAND });
    await f.page.waitForTimeout(2000);
    const m = await f.ev(() => {
      const sec = document.getElementById('w169mine'); if (!sec) return null;
      const order = [...document.querySelectorAll('#w122 > section, #w122 > div')].map(x => x.id || x.getAttribute('data-sec') || x.className).slice(0, 5);
      return { order, sub: (sec.querySelector('.sub') || {}).textContent, cards: [...sec.querySelectorAll('.w169m')].map(a => ({ href: a.getAttribute('href'), cls: a.className, k: (a.querySelector('.k') || {}).textContent, b: (a.querySelector('b') || {}).textContent, due: (a.querySelector('.due') || {}).textContent, why: (a.querySelector('.why') || {}).textContent || null, by: (a.querySelector('.by') || {}).textContent || null, go: (a.querySelector('.go') || {}).textContent, pb: !!a.querySelector('.pb') })),
        next: [...document.querySelectorAll('#w122 [data-sec="next"] [data-w122open], #w122 [data-sec="next"] [data-w122t]')].map(x => x.getAttribute('data-w122open') || x.getAttribute('data-w122t')), nextSub: (document.querySelector('#w122 [data-sec="next"] .sub') || {}).textContent };
    });
    ok('6.1 Assigned to you sits under the onboarding, above the hero', m && m.order.indexOf('w169mine') >= 0 && m.order.indexOf('w169mine') < m.order.findIndex(x => /hero/.test(x)), m && m.order);
    ok('6.2 three cards: the late one first, then the avenue, then the one assigned by hand', m && m.cards.length === 3 && m.cards[0].b === 'Understanding Slack, part 1' && /late/.test(m.cards[0].cls) && m.cards[1].b === 'Using the Hub' && m.cards[2].href === '#training/t/94', m && m.cards);
    const c0 = m && m.cards[0], c1 = m && m.cards[1], c2 = m && m.cards[2];
    ok('6.3 the late card: due date, who asked', c0 && /^Late: it was due Sep 20/.test(c0.due) && c0.by === 'From Valex' && !c0.why && c0.href === '#training/t/213' && c0.go === 'Start', c0);
    ok('6.4 the avenue card: how far, the due date, why and who', c1 && /Learning Avenue · 3 of 9 done/.test(c1.k) && /^Due Oct 9/.test(c1.due) && c1.why === '“We all run on the Hub now.”' && c1.by === 'From Tuna' && c1.pb && c1.href === '#training/p/hub' && /^Continue: /.test(c1.go), c1);
    ok('6.5 the one assigned by hand: no due date, from its person', c2 && /No due date/.test(c2.due) && c2.by === 'From Ahmed', c2);
    ok('6.6 the header counts what is left', m && m.sub === '3 to do, 1 late, from the people you work with.', m && m.sub);
    ok('6.7 Up next no longer repeats them', m && m.nextSub === 'What you started, and what is recommended for you.' && m.next.indexOf('213') < 0 && m.next.indexOf('94') < 0, m && { next: m.next, sub: m.nextSub });
    if (SHOT) { await f.ev(() => document.getElementById('w169mine').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(300); await shot(f, 's6_mine'); }
    await click(f, '#w169mine .w169m[href="#training/t/213"]', 2000);
    const op = await f.ev(() => ({ hash: location.hash, title: (document.querySelector('#w122sheet .sh .hd h2') || {}).textContent }));
    ok('6.8 a card opens its training', op.hash === '#training/t/213' && op.title === 'Understanding Slack, part 1', op);
    ok('6.9 no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 7. leaders assign from the Academy: on a module, on a Learning Avenue ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#training', fixture: fx(), wait: 5200, candidate: CAND });
    await f.page.waitForTimeout(1200);
    await f.hash('#training/t/213', 1800);   /* opened from the page, as people do (a deep link at sign-in draws the module before the access is known) */
    await spy(f, { academy_assign: { id: 30, people: 30, rows: 30 } });
    const b = await f.ev(() => !!document.querySelector('#w122sheet [data-w169assign="t:213"]'));
    ok('7.1 a module has Assign', b);
    await click(f, '#w122sheet [data-w169assign="t:213"]', 1500);
    const m = await f.ev(() => {
      const back = document.getElementById('modalBack'), box = document.getElementById('modalBox'), r = box.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + 30);
      return { shown: back.style.display !== 'none', top: back.classList.contains('w169top'), onTop: !!(at && box.contains(at)), tags: [...box.querySelectorAll('.w169tag')].map(t => t.textContent.replace('×', '').trim()), sheet: document.getElementById('w122sheet').classList.contains('on') };
    });
    ok('7.2 the form opens over the module, with the module picked', m.shown && m.top && m.onTop && m.tags.join() === 'Understanding Slack, part 1' && m.sheet, m);
    await click(f, '#w169ago', 1200);
    const r = (await rpcs(f)).filter(x => x.fn === 'academy_assign');
    const aft = await f.ev(() => ({ top: document.getElementById('modalBack').classList.contains('w169top'), closed: document.getElementById('modalBack').style.display === 'none', sheet: document.getElementById('w122sheet').classList.contains('on') }));
    ok('7.3 assigned to everyone from the module, and the module is still open', r.length === 1 && r[0].args.p.training_id === 213 && r[0].args.p.audience === 'everyone' && aft.closed && !aft.top && aft.sheet, { r, aft });
    await f.hash('#training/p/hub', 2000);
    const p = await f.ev(() => !!document.querySelector('#w122sheet [data-w169assign="p:hub"]'));
    ok('7.4 a Learning Avenue has Assign', p);
    await click(f, '#w122sheet [data-w169assign="p:hub"]', 1500);
    const t2 = await f.ev(() => [...document.querySelectorAll('#modalBox .w169tag')].map(t => t.textContent.replace('×', '').trim()));
    ok('7.5 with the avenue picked', t2.join() === 'Using the Hub', t2);
    await click(f, '#w169ax', 400);
    await f.hash('#training', 2000);
    const top = await f.ev(() => ({ top: !!document.querySelector('#w122 .w122top [data-w169assign=""]') }));
    ok('7.6 Assign a training at the top of the Academy', top.top, top);
    ok('7.7 no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 8. on a phone ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#hrcentre/onboarding', fixture: fx(), wait: 5200, candidate: CAND, rpcs: { academy_assignments_list: LIST, wa_org_editor: true } });
    await f.page.waitForTimeout(1500);
    const w = await f.ev(() => ({ sw: document.scrollingElement.scrollWidth, card: (document.getElementById('w169cardO') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width, see: document.querySelectorAll('#w46master .w169see').length }));
    ok('8.1 the HR centre fits a phone', w.sw <= 392 && w.card > 200 && w.card <= 390 && w.see >= 5, w);
    await click(f, '#w169cardO [data-w169assign]', 1500);
    const mw = await f.ev(() => { const r = document.getElementById('modalBox').getBoundingClientRect(); return { w: r.width, l: r.left, sw: document.scrollingElement.scrollWidth, seg: document.querySelector('#modalBox .w169seg').getBoundingClientRect().right }; });
    ok('8.2 the assign form fits a phone', mw.w <= 390 && mw.l >= 0 && mw.seg <= 390 && mw.sw <= 392, mw);
    await shot(f, 's8_phone_assign');
    const bt = await f.ev(async () => {
      const bar = document.getElementById('w163bar'), box = document.getElementById('modalBox'); box.scrollTop = box.scrollHeight;
      await new Promise(r => setTimeout(r, 200));
      const go = document.getElementById('w169ago'), r = go.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { bar: bar ? getComputedStyle(bar).display : 'none', reach: at === go || (at && go.contains(at)), bottom: Math.round(r.bottom), vh: innerHeight };
    });
    ok('8.2b with the form open the phone bar steps aside, and Assign can be reached', bt.bar === 'none' && bt.reach && bt.bottom <= bt.vh, bt);
    await f.ev(() => closeModal()); await f.page.waitForTimeout(200);
    const back = await f.ev(() => { const bar = document.getElementById('w163bar'); return bar ? getComputedStyle(bar).display : 'none'; });
    ok('8.2c and comes back when it closes', back === 'grid', back);
    await f.close();
  }
  {
    const f = await fresh(browser, { who: 'plain', width: 390, hash: '#training', fixture: fx(MINE), wait: 5200, candidate: CAND });
    await f.page.waitForTimeout(1800);
    const w = await f.ev(() => ({ sw: document.scrollingElement.scrollWidth, cards: [...document.querySelectorAll('#w169mine .w169m')].map(a => Math.round(a.getBoundingClientRect().right)) }));
    ok('8.3 Assigned to you fits a phone', w.sw <= 392 && w.cards.length === 3 && w.cards.every(x => x <= 390), w);
    if (SHOT) { await f.ev(() => document.getElementById('w169mine').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(300); await shot(f, 's8_phone_mine'); }
    ok('8.4 no page errors on phones', f.errs.length === 0, f.errs);
    await f.close();
  }

  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
