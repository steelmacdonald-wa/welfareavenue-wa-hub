/* w209drive.js: wave209, applicants in: Add an applicant (Applications), Move to the Volunteer Manager, Applicants received.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). Database functions are answered and recorded by a wrapper on db.rpc.
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w209/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w209') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

function fixture() {
  const FX = loadFixture();
  const now = '2026-09-20T12:00:00Z';
  FX.hub_positions = [
    { id: 35, title: 'Operations Manager', dept: 'opsmtl', folder_id: 'F35', resumes_id: 'R35', stage: 'interviewing', gone: false },
    { id: 33, title: 'Volunteer Cook', dept: 'opsmtl', folder_id: 'F33', resumes_id: 'R33', stage: 'posted', gone: false },
    { id: 5, title: 'Kitchen Coordinator', dept: 'opsto', folder_id: 'F5', resumes_id: 'R5', stage: 'offer', gone: false }
  ];
  FX.hub_position_files = []; FX.hub_position_people = []; FX.hub_candidate_grades = []; FX.hub_candidate_calls = []; FX.hub_candidate_interviews = [];
  const cs = (FX.hub_candidates || []).slice(0, 5);
  cs.push({ id: 9201, name: 'Sophie Cook', role: 'Cuisiniers Bénévoles (Kitchen Volunteer)', position_id: 33, status: 'new', source: 'email', created_at: now });
  cs.push({ id: 9202, name: 'Kim Coordinator', role: 'Kitchen Coordinator', position_id: 5, status: 'new', source: 'email', created_at: now });
  FX.hub_candidates = cs;
  FX.volunteer_applications = [
    { id: 1, person_id: 501, contact_id: 7001, name: 'Niloofar Bakhshaee', email: 'nili@example.com', phone: '(438) 995-1855', roles: ['cook'], role_text: 'Cuisinier·ère·s', source: 'cabm', applied_at: '2026-09-24T21:18:03Z', message: 'I am bilingual. '.repeat(30), cv_url: 'https://cdn.ca.yapla.com/x/documents/cv.pdf', language: 'en', status: 'received' },
    { id: 2, person_id: 502, contact_id: 7002, name: 'Dan Driver', email: 'dan@example.com', phone: null, roles: ['driver'], role_text: 'Chauffeurs', source: 'fcabq', applied_at: '2026-09-20T12:00:00Z', message: null, cv_path: 'cabm/x/cv.pdf', language: 'fr', status: 'contacted', handled_by: 'Shima', handled_at: '2026-09-22T12:00:00Z', status_note: 'Left a voicemail' },
    { id: 3, person_id: 503, contact_id: 7003, name: 'Wendy Welcomed', email: 'w@example.com', roles: ['server', 'photographer'], source: 'manual', applied_at: '2026-08-01T12:00:00Z', status: 'welcomed', handled_by: 'Ahmed', handled_at: '2026-08-05T12:00:00Z' }
  ];
  return FX;
}
const WRAP = () => { if (db.__w209) return; window.__RPC = []; var orig = db.rpc.bind(db); db.rpc = function (fn, args) { window.__RPC.push({ fn: fn, args: args });
  if (fn === 'wa209_intake') return Promise.resolve({ data: (args.p.position_id === '33' || /cook/i.test(args.p.role || '')) ? { ok: true, to: 'volunteers', application_id: 99 } : { ok: true, to: 'applications', candidate_id: 9301 }, error: null });
  if (fn === 'wa209_volunteer_apply') return Promise.resolve({ data: { ok: true, to: 'volunteers', application_id: 98, person_id: 600 }, error: null });
  if (fn === 'wa209_move_to_volunteers') return Promise.resolve({ data: { ok: true, to: 'volunteers', application_id: 97, moved_candidate: args.p_id }, error: null });
  if (fn === 'wa209_vol_app_status') return Promise.resolve({ data: { ok: true }, error: null });
  return orig(fn, args); }; db.__w209 = true; };
const INIT = `window.__INV = []; window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; window.__INV.push({ name: name, body: b });
  if (name === 'recruit-actions' && b.action === 'cv_check') return { data: /folders/.test(b.url) ? { ok: false, reason: 'folder', error: 'That link is a folder.' } : { ok: true, id: 'D1', name: 'Ada CV.pdf' }, error: null };
  if (name === 'recruit-actions' && b.action === 'file_cv') return { data: { ok: true, filed: true, copied: true, where: 'Operations Manager > Resumes' }, error: null };
  return { data: null, error: null }; };`;

(async () => {
  const browser = await launch();
  const FX = fixture();
  let f = await fresh(browser, { who: 'admin', width: 1440, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(1800); await f.ev(WRAP);
  await f.ev(() => { try { w197.paintBoard(); } catch (e) { /* fine */ } }); await f.page.waitForTimeout(300);
  ok('Applications: w209 is loaded and the bar has Add an applicant', await f.ev(() => !!window.w209 && !!document.querySelector('#w197apps [data-w209a="add"]')));
  await f.page.click('#w197apps [data-w209a="add"]'); await f.page.waitForTimeout(300);
  ok('Add: the form opens with the positions by department', await f.ev(() => { var s = document.getElementById('w209add'); return s && s.classList.contains('open') && Array.from(s.querySelectorAll('#w209pos optgroup')).length >= 2; }));
  await shot(f, 'add_form');
  await f.page.fill('#w209r', 'Volunteer cook'); await f.page.waitForTimeout(150);
  ok('Add: a volunteer role is said as it is typed', await f.ev(() => /Cook<\/b> is a volunteer role/.test(document.getElementById('w209hint').innerHTML)));
  await f.page.fill('#w209r', 'Kitchen Coordinator'); await f.page.waitForTimeout(150);
  ok('Add: a coordinator is not a volunteer role', await f.ev(() => document.getElementById('w209hint').textContent === ''));
  await f.page.fill('#w209r', '');
  await f.page.click('#w209add [data-w209a="save"]'); await f.page.waitForTimeout(200);
  ok('Add: a name is required', await f.ev(() => /Their name, please/.test(document.getElementById('w209add').textContent) && !window.__RPC.some(r => r.fn === 'wa209_intake')));
  await f.page.fill('#w209n', 'Ada Lovelace'); await f.page.fill('#w209e', 'ada@example.com'); await f.page.selectOption('#w209pos', '35'); await f.page.selectOption('#w209s', 'linkedin');
  await f.page.fill('#w209m', 'Strong operations background'); await f.page.fill('#w209l', 'https://linkedin.com/in/ada');
  ok('Add (w211): the Resumes folder of the chosen position is offered', await f.ev(() => /folders\/R35/.test(document.querySelector('#w209cvhelp').innerHTML) && /Copy link/.test(document.querySelector('#w209cvhelp').textContent)));
  await f.page.click('#w209add [data-w209a="save"]'); await f.page.waitForTimeout(300);
  ok('Add (w211): the CV link is required and the guidance opens', await f.ev(() => /link to their CV in Google Drive/.test(document.getElementById('w209add').textContent) && document.getElementById('w209cvhelp').open && !window.__RPC.some(r => r.fn === 'wa209_intake')));
  await f.page.fill('#w209cv', 'https://example.com/cv.pdf'); await f.page.click('#w209add [data-w209a="save"]'); await f.page.waitForTimeout(300);
  ok('Add (w211): a link that is not Google Drive is refused', await f.ev(() => /not a Google Drive link/.test(document.getElementById('w209add').textContent)));
  await f.page.fill('#w209cv', 'https://drive.google.com/drive/folders/XYZ'); await f.page.click('#w209add [data-w209a="save"]'); await f.page.waitForTimeout(500);
  ok('Add (w211): the Hub checks the link (a folder is refused)', await f.ev(() => /That link is a folder/.test(document.getElementById('w209add').textContent) && !window.__RPC.some(r => r.fn === 'wa209_intake')));
  await f.page.fill('#w209cv', 'https://drive.google.com/file/d/D1/view');
  await f.page.click('#w209add [data-w209a="save"]'); await f.page.waitForTimeout(800);
  const add = await f.ev(() => ({ r: window.__RPC.filter(r => r.fn === 'wa209_intake').pop(), open: document.getElementById('w209add').classList.contains('open') }));
  ok('Add: saved through wa209_intake with the position, source, message and link', add.r && add.r.args.p.name === 'Ada Lovelace' && add.r.args.p.position_id === '35' && add.r.args.p.source === 'linkedin' && add.r.args.p.links[0] === 'https://drive.google.com/file/d/D1/view' && add.r.args.p.links[1] === 'https://linkedin.com/in/ada' && /2026-09-25/.test(add.r.args.p.applied_at) && !add.open, add);
  ok('Add (w211): the CV is filed into the position\'s Resumes folder', await f.ev(() => window.__INV.some(x => x.body.action === 'file_cv' && x.body.id === 9301 && /D1/.test(x.body.url))));
  /* a volunteer-role card moves */
  await f.ev(() => { var s = document.getElementById('w197sheet'); if (s) s.classList.remove('open'); });
  await f.ev(() => w197.openSheet(9201)); await f.page.waitForTimeout(500);
  ok('Card: a volunteer role offers Move to the Volunteer Manager', await f.ev(() => !!document.querySelector('#w197sheet [data-w209move="9201"]') && /Cook is a volunteer role/.test(document.getElementById('w197sheet').textContent)));
  await shot(f, 'card_move');
  await f.page.click('#w197sheet [data-w209move="9201"]'); await f.page.waitForTimeout(500);
  ok('Card: moving calls wa209_move_to_volunteers and the card leaves the board', await f.ev(() => window.__RPC.some(r => r.fn === 'wa209_move_to_volunteers' && r.args.p_id === 9201) && !document.querySelector('#w197board [data-w197c="9201"]') && !w197.state().cands.some(c => c.id === 9201)));
  await f.ev(() => w197.openSheet(9202)); await f.page.waitForTimeout(400);
  ok('Card: a Kitchen Coordinator stays in Applications', await f.ev(() => !document.querySelector('#w197sheet [data-w209move]')));
  ok('Applications: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* the Volunteer Manager */
  f = await fresh(browser, { who: 'admin', width: 1440, hash: '#volunteering/applicants', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2500); await f.ev(WRAP);
  const v = await f.ev(() => ({ host: !!document.getElementById('w209v'), h1: (document.querySelector('#volunteering .w118mast h1') || {}).textContent, cards: Array.from(document.querySelectorAll('#w209v .w209app b')).map(b => b.textContent), tabs: Array.from(document.querySelectorAll('#w209v [data-w209tab]')).map(b => b.textContent), chip: (document.querySelector('[data-vl="applicants"]') || {}).textContent, rail: !!document.querySelector('a[href="#volunteering/applicants"], [data-h="#volunteering/applicants"]') || JSON.stringify(window.WA_APP && WA_APP.apps.volunteer.groups()).indexOf('#volunteering/applicants') >= 0 }));
  ok('Applicants received: the page draws with its title', v.host && v.h1 === 'Applicants received', v);
  ok('Applicants received: To handle shows received then contacted, not the welcomed', v.cards.join('|') === 'Niloofar Bakhshaee|Dan Driver', v.cards);
  ok('Applicants received: the tabs count', /To handle 2/.test(v.tabs[0]) && /Welcomed 1/.test(v.tabs[1]) && /All 3/.test(v.tabs[3]), v.tabs);
  ok('Applicants received: the chip and the rail item', /Applicants/.test(v.chip || '') && v.rail, v);
  const c1 = await f.ev(() => { var c = document.querySelector('#w209v [data-w209id="1"]'); return { t: c.textContent, cv: !!c.querySelector('a[href*="yapla"]'), crm: !!c.querySelector('a[href="#crm/c/7001"]'), more: !!c.querySelector('[data-w209more="1"]') }; });
  ok('Applicants received: a card shows the role, when, where, contact, CV and the CRM', /Cook/.test(c1.t) && /Applied today \(Sep 24, 2026\)/.test(c1.t) && /CABM/.test(c1.t) && /nili@example.com/.test(c1.t) && c1.cv && c1.crm, c1);
  ok('Applicants received: the contacted one says who and the note', await f.ev(() => /Contacted by Shima/.test(document.querySelector('#w209v [data-w209id="2"]').textContent) && /Left a voicemail/.test(document.querySelector('#w209v [data-w209id="2"]').textContent)));
  await shot(f, 'applicants', true);
  await f.page.click('#w209v [data-w209more="1"]'); await f.page.waitForTimeout(200);
  ok('Applicants received: More shows the whole message', await f.ev(() => (document.querySelector('#w209v [data-w209id="1"] .w209msg').textContent.match(/bilingual/g) || []).length === 30));
  await f.page.fill('#w209q', 'dan'); await f.page.waitForTimeout(200);
  ok('Applicants received: search', await f.ev(() => Array.from(document.querySelectorAll('#w209v .w209app b')).map(b => b.textContent).join('|') === 'Dan Driver'));
  await f.page.fill('#w209q', ''); await f.page.waitForTimeout(150);
  await f.page.selectOption('#w209role', 'cook'); await f.page.waitForTimeout(150);
  ok('Applicants received: role filter', await f.ev(() => Array.from(document.querySelectorAll('#w209v .w209app b')).map(b => b.textContent).join('|') === 'Niloofar Bakhshaee'));
  await f.page.selectOption('#w209role', ''); await f.page.waitForTimeout(150);
  await f.page.fill('#w209v [data-w209note="1"]', 'Called, starts on the 4th');
  await f.page.click('#w209v [data-w209st="1"][data-s="welcomed"]'); await f.page.waitForTimeout(500);
  ok('Applicants received: Welcome saves the status with the note and leaves To handle', await f.ev(() => window.__RPC.some(r => r.fn === 'wa209_vol_app_status' && r.args.p_id === 1 && r.args.p_status === 'welcomed' && r.args.p_note === 'Called, starts on the 4th') && !document.querySelector('#w209v [data-w209id="1"]')));
  await f.page.click('#w209v [data-w209tab="welcomed"]'); await f.page.waitForTimeout(200);
  ok('Applicants received: Welcomed lists both', await f.ev(() => document.querySelectorAll('#w209v .w209app').length === 2));
  await f.page.click('#w209v [data-w209tab="open"]'); await f.page.waitForTimeout(200);
  /* add a volunteer by hand */
  await f.page.click('#w209v [data-w209a="add"]'); await f.page.waitForTimeout(300);
  ok('Add (volunteers): the form has the roles to tick', await f.ev(() => document.querySelectorAll('#w209add [data-w209role]').length === 8));
  await f.page.fill('#w209n', 'Rui Driver'); await f.page.fill('#w209p', '514 555 0101'); await f.page.check('#w209add [data-w209role="driver"]'); await f.page.selectOption('#w209s', 'event');
  await f.page.click('#w209add [data-w209a="save"]'); await f.page.waitForTimeout(600);
  ok('Add (volunteers): saved through wa209_volunteer_apply with the roles and source', await f.ev(() => { var r = window.__RPC.filter(x => x.fn === 'wa209_volunteer_apply').pop(); return r && r.args.p.name === 'Rui Driver' && r.args.p.roles.join() === 'driver' && r.args.p.source === 'event' && /^hub:/.test(r.args.p.source_ref); }));
  /* In Volunteers */
  await f.page.click('#w209v [data-w209vol="2"]'); await f.page.waitForTimeout(800);
  ok('In Volunteers opens the directory searched for them', await f.ev(() => location.hash === '#volunteering/people' && window.WA26_Q === 'Dan Driver'));
  ok('Volunteer Manager: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* a phone */
  f = await fresh(browser, { who: 'admin', width: 390, height: 844, hash: '#volunteering/applicants', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2500);
  ok('Phone: nothing wider than the screen', await f.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  await f.ev(() => w209.openForm('applications')); await f.page.waitForTimeout(300);
  ok('Phone: the form fits', await f.ev(() => { var p = document.querySelector('#w209add .pn'); return p && p.getBoundingClientRect().width <= window.innerWidth + 1 && p.scrollWidth <= p.clientWidth + 2; }));
  await shot(f, 'phone');
  ok('Phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* a member who is not staff does not see the page */
  f = await fresh(browser, { who: 'board', width: 1366, hash: '#volunteering/applicants', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2000);
  ok('Board viewer: no Applicants received', await f.ev(() => !document.getElementById('w209v')));
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw209drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(2); });
