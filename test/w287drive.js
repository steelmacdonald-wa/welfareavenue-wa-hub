/* w287drive.js: wave287, team overview, tasks and projects. Offline against the candidate (CAND=<file>.html), with test/boot.js (stubbed
   Supabase, clock Friday 25/09/26 16:00 Toronto) and test/w287fx.js (the data as wa287a_projects.sql leaves it). Widths 390, 768 and 1280,
   one run with the root font at 200%, one with reduced motion.
   Checks (design section 5): the sidebar's smart lists and project counts against the fixture (General first, sub-projects indented, other
   teams' projects, a cross-team task counted in the owning team's project); a project list shows only that project; the tick completes a
   task, the Undo brings it back and the row folds away; the drawer opens and closes (no Workstream field; the project shows General for a
   task with none); quick add files the task in the open project; Board, Calendar, Tree, bulk edit, filters, drag onto a sidebar project;
   the Fundraising boards, #grants, the Finance board; #team/<d>/tasks/<workstream> opens that project (else All; Grants goes to #grants);
   the Overview (the sentence, three tiles, Needs attention, project cards, the ids later waves inject into, the Team inbox third, the
   "Asked of" banner only off the Overview); no horizontal scroll; no "undefined", "NaN", "null" or "[object"; no console errors.
   SHOTS=<dir> saves a few screenshots. */
const fs = require('fs');
const { chromium } = require('playwright');
const { fresh } = require('./boot');
const { fx287, EXPECT } = require('./w287fx');
const SHOTS = process.env.SHOTS || '';
const ONLY = process.env.ONLY || '';   /* ONLY=13 runs sections 1 and 3 */
const run = (n) => !ONLY || ONLY.indexOf(String(n)) >= 0;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 900) : '')); } }
const BAD = /\bundefined\b|\bNaN\b|\bnull\b|\[object/;
const hasScroll = (f) => f.ev(() => document.documentElement.scrollWidth > window.innerWidth + 1);
const consoleErrs = (f) => { const out = []; f.page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) out.push(m.text().slice(0, 240)); }); return out; };
const click = async (f, sel, ms) => { await f.ev((s) => { const e = document.querySelector(s); if (!e) throw new Error('no ' + s); e.click(); }, sel); await f.page.waitForTimeout(ms || 450); };
const shot = async (f, n) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png', timeout: 120000, animations: 'disabled' }); };
const state = (f) => f.ev(() => window.w116Board.state());
const shownRows = (f) => f.ev(() => [].map.call(document.querySelectorAll('#w116tasks .w287groups .w116r[data-tid]'), (r) => r.getAttribute('data-tid')));
const sideCounts = (f) => f.ev(() => {
  const o = { smart: {}, proj: {}, order: [], depth: {}, other: [] };
  document.querySelectorAll('#w116tasks .w287sl').forEach((b) => { o.smart[b.getAttribute('data-l')] = Number(b.querySelector('.n').textContent); });
  let inOther = false;
  document.querySelectorAll('#w116tasks .w287pl > *').forEach((el) => {
    if (el.classList.contains('w287ph') && el.classList.contains('q')) inOther = true;
    if (!el.classList.contains('w287pr') || !el.getAttribute('data-pid')) return;
    const id = Number(el.getAttribute('data-pid')); const n = el.querySelector('.n'); o.proj[id] = n && /\d/.test(n.textContent) ? Number(n.textContent) : null;
    o.order.push(id); o.depth[id] = (el.className.match(/\bd(\d)\b/) || [0, 0])[1] * 1; if (inOther) o.other.push(id);
  });
  return o;
});
const ADMIN = { name: 'Steel', id: 37 };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.WA_CHROME, args: ['--disable-gpu'] });
  const allErrs = [], allCons = [];
  const go = async (o) => {
    o = o || {};
    const fx = o.fx || fx287();
    const f = await fresh({ newContext: (x) => b.newContext(Object.assign({ timezoneId: 'America/Toronto' }, o.ctx || {}, x)) }, Object.assign({ who: 'admin', hash: '#team/marketing/tasks', fixture: fx, wait: 5000 }, o));
    f.cons = consoleErrs(f); f.fx = fx;
    return f;
  };
  const done = async (f) => { allErrs.push(...f.errs); allCons.push(...f.cons); await f.close(); };
  const toTasks = async (f, d) => { await f.hash('#team/' + d + '/tasks', 2400); await f.page.waitForSelector('#w116tasks .w287', { timeout: 10000 }).catch(() => {}); };
  const list = async (f, l) => { await click(f, '#w116tasks .w287side [data-l="' + l + '"]', 500); };

  /* ---------- 1. Marketing's task page at 1280: the sidebar, lists, the tick, the drawer, quick add ---------- */
  if (run(1)) {
    const f = await go({ width: 1280, height: 1200 });
    await toTasks(f, 'marketing');
    await f.ev(() => { try { localStorage.clear(); } catch (e) { /* fine */ } });
    await toTasks(f, 'marketing');
    ok('the task page draws the sidebar and the main list', await f.ev(() => !!document.querySelector('#w116tasks .w287side') && !!document.querySelector('#w116tasks .w287main .w116b')));
    const exp = EXPECT(f.fx, 'marketing', ADMIN.name, ADMIN.id);
    const sc = await sideCounts(f);
    ['today', 'scheduled', 'all', 'flagged', 'mine', 'completed'].forEach((k) => ok('sidebar ' + k + ' count is ' + exp[k], sc.smart[k] === exp[k], { page: sc.smart[k], expected: exp[k] }));
    ok('General Marketing (is_general) comes first', sc.order[0] === 19, sc.order);
    const own = [19, 27, 5, 6, 15, 7];
    own.forEach((id) => ok('project ' + id + ' shows ' + (exp.projects[id] || 0) + ' open', (sc.proj[id] || 0) === (exp.projects[id] || 0), { page: sc.proj[id], expected: exp.projects[id] }));
    ok('the task with no project counts in General Marketing', exp.projects[19] >= 2 && sc.proj[19] === exp.projects[19]);
    ok('Other teams’ projects lists the Gift Basket Drive with Marketing’s one task', sc.other.indexOf(13) >= 0 && sc.proj[13] === 1, sc);
    ok('the All list is chosen and titled', (await f.ev(() => document.querySelector('#w116tasks .w287lhead h3').innerText)).replace(/\s+/g, ' ').trim().toUpperCase().indexOf('ALL') === 0);
    ok('the All list groups by project, General first', await f.ev(() => { const g = document.querySelectorAll('#w116tasks .w287groups .w116g'); return g.length > 2 && g[0].getAttribute('data-g') === 'p19'; }));
    ok('no workstream grouping is offered', await f.ev(() => !document.querySelector('#w116tasks select[data-act="group"] option[value="workstream"]') && !!document.querySelector('#w116tasks select[data-act="group"] option[value="project"]')));
    const t0 = await f.ev(() => document.querySelector('#w116tasks').innerText);
    ok('no undefined, NaN, null or [object on the task page', !BAD.test(t0), (t0.match(BAD) || [])[0]);
    ok('rows have a round tick edged in the project colour', await f.ev(() => { const r = document.querySelector('#w116tasks .w116r[data-tid="5001"] .w116done'); if (!r) return false; const cs = getComputedStyle(r); return cs.borderRadius === '50%' && cs.borderTopStyle === 'solid' && parseFloat(cs.borderTopWidth) >= 1 && r.closest('.w116r').style.getPropertyValue('--pc').trim() === window.w116ProjColor(window.w116ProjOf(DB_TASKS.find((t) => t.id === 5001))); }));
    ok('a row shows one line of facts: owner, due chip ("2 days overdue"), comments, subtasks', await f.ev(() => { const r = document.querySelector('#w116tasks .w116r[data-tid="5001"]'); const t = r ? r.innerText : ''; return /2 days overdue/.test(t) && !!r.querySelector('.w287cm') && /subtasks/.test(t); }));
    ok('the due chip says Today and Tomorrow', await f.ev(() => /Today/.test(document.querySelector('#w116tasks .w116r[data-tid="5002"]').innerText) && /Tomorrow/.test(document.querySelector('#w116tasks .w116r[data-tid="5003"]').innerText)));
    await shot(f, 'w287-marketing-all-1280');

    /* Today, Flagged, Mine, Completed */
    await list(f, 'today');
    let ids = (await shownRows(f)).map(Number);
    ok('Today shows overdue and due today only (' + ids.length + ')', ids.length === exp.today && ids.every((id) => { const t = f.fx.dept_tasks.find((x) => x.id === id); return t && t.due_date && t.due_date <= '2026-09-25' && !t.done; }), ids);
    await list(f, 'flagged');
    ids = (await shownRows(f)).map(Number);
    ok('Flagged shows the executive flag only', ids.length === exp.flagged && ids.indexOf(5003) >= 0, ids);
    await list(f, 'mine');
    ids = (await shownRows(f)).map(Number);
    ok('Mine shows Steel’s tasks', ids.length === exp.mine && ids.indexOf(5007) >= 0, ids);
    await list(f, 'completed');
    ids = (await shownRows(f)).map(Number);
    ok('Completed shows the done tasks, with no quick add', ids.length === exp.completed && ids.every((id) => f.fx.dept_tasks.find((t) => t.id === id).done) && !(await f.ev(() => !!document.querySelector('#w116tasks .w287add'))), ids);

    /* a project list shows only that project, grouped by due window */
    await list(f, 'p27');
    ids = (await shownRows(f)).map(Number);
    const eff = await f.ev((xs) => xs.map((id) => { const t = DB_TASKS.find((x) => String(x.id) === String(id)); const p = window.w116ProjOf(t); return p ? Number(p.id) : 0; }), ids);
    ok('the Content list shows only Content (' + ids.length + ' rows)', ids.length === (exp.projects[27] || 0) && eff.every((x) => x === 27), { ids, eff });
    ok('a project list groups by due window', await f.ev(() => [].every.call(document.querySelectorAll('#w116tasks .w287groups .w116g'), (g) => /^d\d$/.test(g.getAttribute('data-g')))));
    ok('the list title is the project, with its open count', await f.ev(() => /CONTENT/i.test(document.querySelector('#w116tasks .w287lhead h3').innerText) && /\b4\b/.test(document.querySelector('#w116tasks .w287lc').textContent)));
    ok('the project list links to the project page', await f.ev(() => !!document.querySelector('#w116tasks .w287lsub a[data-w116go="#project/27"]')));
    /* quick add files the task in the open project and stays open for the next */
    await click(f, '#w116tasks .w287new', 400);
    ok('New task opens a quick add line in the list', await f.ev(() => { const q = document.querySelector('#w116tasks .w116qa:not([style*="none"]) input'); return !!q && document.activeElement === q; }));
    await f.page.keyboard.type('Draft the November newsletter'); await f.page.keyboard.press('Enter'); await f.page.waitForTimeout(800);
    const added = await f.ev(() => DB_TASKS.filter((t) => t.title === 'Draft the November newsletter').map((t) => ({ p: t.project_id, d: t.department, ws: t.subsection, due: t.due_date })));
    ok('quick add files the task in Content, Marketing, with no workstream and no date', added.length === 1 && added[0].p === 27 && added[0].d === 'marketing' && added[0].ws === null && !added[0].due, added);
    ok('the new task shows in the Content list', (await shownRows(f)).length === ids.length + 1);
    ok('the quick add stays open for the next task', await f.ev(() => { const q = document.querySelector('#w116tasks .w116qa:not([style*="none"]) input'); return !!q && document.activeElement === q; }));
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(250);
    ok('Escape closes the quick add', await f.ev(() => !document.querySelector('#w116tasks .w116qa:not([style*="none"])')));

    /* the tick, the Undo, the fold */
    await list(f, 'all');
    await click(f, '#w116tasks .w116r[data-tid="5007"] .w116done', 350);
    let tk = await f.ev(() => ({ done: DB_TASKS.find((t) => t.id === 5007).done, row: !!document.querySelector('#w116tasks .w116r[data-tid="5007"].w287tk'), snack: (document.querySelector('#w287snack.on') || {}).innerText || '', aria: (document.querySelector('#w116tasks .w116r[data-tid="5007"] .w116done') || { getAttribute: () => '' }).getAttribute('aria-checked') }));
    ok('the tick saves the task as done and fills the circle', tk.done === true && tk.row && tk.aria === 'true', tk);
    ok('an Undo shows', /Done: Check the brand colours/.test(tk.snack) && /Undo/.test(tk.snack), tk.snack);
    await f.page.waitForTimeout(1900);
    ok('the row folds away after a moment', await f.ev(() => !document.querySelector('#w116tasks .w116r[data-tid="5007"]')));
    await click(f, '#w287snack [data-w287sn="undo"]', 700);
    tk = await f.ev(() => ({ done: DB_TASKS.find((t) => t.id === 5007).done, status: DB_TASKS.find((t) => t.id === 5007).status, row: !!document.querySelector('#w116tasks .w116r[data-tid="5007"]') }));
    ok('Undo brings the task back, open', tk.done === false && tk.status === 'Open' && tk.row, tk);
    ok('the tick is a keyboard control', await f.ev(() => { const e = document.querySelector('#w116tasks .w116r[data-tid="5007"] .w116done'); return e.getAttribute('role') === 'checkbox' && e.tabIndex === 0; }));

    /* the drawer */
    await click(f, '#w116tasks .w116r[data-tid="5011"] .ttl', 500);
    let dr = await f.ev(() => { const d = document.getElementById('w116dr'); const labels = [].map.call(d.querySelectorAll('.w116f > label'), (l) => l.textContent.trim()); const sel = d.querySelector('select[data-dfield="project"]'); return { open: d.classList.contains('open'), labels, project: sel ? sel.value : null, tr: getComputedStyle(d).transitionTimingFunction, dur: getComputedStyle(d).transitionDuration }; });
    ok('the drawer opens', dr.open, dr);
    ok('the drawer has no Workstream field', dr.labels.indexOf('Workstream') < 0 && dr.labels.indexOf('Project') >= 0, dr.labels);
    ok('a task with no project shows General Marketing in the drawer', dr.project === '19', dr.project);
    ok('the drawer slides on the iOS curve, 280ms in', /0\.32, 0\.72, 0, 1/.test(dr.tr) && /0\.28s/.test(dr.dur), dr);
    await f.page.waitForTimeout(400);
    ok('the drawer is in place once open', await f.ev(() => { const r = document.getElementById('w116dr').getBoundingClientRect(); return Math.abs(r.right - window.innerWidth) < 2; }));
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(80);
    dr = await f.ev(() => { const d = document.getElementById('w116dr'); return { open: d.classList.contains('open'), dur: getComputedStyle(d).transitionDuration, bk: getComputedStyle(document.getElementById('w116drb')).pointerEvents }; });
    ok('Escape closes the drawer, 200ms out, the backdrop lets clicks through', !dr.open && /0\.2s/.test(dr.dur) && dr.bk === 'none', dr);
    await f.page.waitForTimeout(350);
    ok('the closed drawer is hidden', await f.ev(() => getComputedStyle(document.getElementById('w116dr')).visibility === 'hidden'));

    /* Board, Calendar, Tree, filters, bulk */
    await click(f, '#w116tasks [data-act="view"][data-v="board"]', 500);
    ok('Board view: five status columns', await f.ev(() => document.querySelectorAll('#w116tasks .w116kb .w116kc').length === 5 && document.querySelectorAll('#w116tasks .w116kd').length > 3));
    await click(f, '#w116tasks [data-act="view"][data-v="cal"]', 500);
    ok('Calendar view draws the month', await f.ev(() => document.querySelectorAll('#w116tasks .w116cal .w116cd').length === 42 && document.querySelectorAll('#w116tasks .w116cp').length > 2));
    await click(f, '#w116tasks [data-act="view"][data-v="list"]', 500);
    await f.page.waitForTimeout(300);
    const tv = await f.ev(() => !!document.querySelector('#w116tasks [data-w116tview]'));
    if (tv) { await click(f, '#w116tasks [data-w116tview]', 600); }
    ok('Tree view (wave116t) still opens, without workstream rows', tv && await f.ev(() => !!document.querySelector('#w116tasks .w116tree') && !document.querySelector('#w116tasks .w116tree .n.ws')));
    if (tv) await click(f, '#w116tasks [data-w116tview]', 500);
    ok('the list is back after the Tree', await f.ev(() => !document.querySelector('#w116tasks .w116tree') && !!document.querySelector('#w116tasks .w287groups')));
    await click(f, '#w116tasks [data-act="fbtn"]', 400);
    ok('Filters opens the filter row', await f.ev(() => getComputedStyle(document.querySelector('#w116tasks .w116tb .flt')).display === 'flex'));
    await f.page.selectOption('#w116tasks select[data-act="due"]', 'overdue'); await f.page.waitForTimeout(500);
    ok('a filter shows as a chip and narrows the list', await f.ev(() => /Overdue/.test((document.querySelector('#w116tasks .w287chips') || {}).innerText || '')) && (await shownRows(f)).length === 3, await shownRows(f));
    await click(f, '#w116tasks .w287chip[data-k="due"]', 400);
    ok('removing the chip clears the filter', await f.ev(() => !document.querySelector('#w116tasks .w287chips')) && (await shownRows(f)).length === (await sideCounts(f)).smart.all);
    await click(f, '#w116tasks .w116r[data-tid="5002"] input[data-act="sel"]', 250);
    await click(f, '#w116tasks .w116r[data-tid="5004"] input[data-act="sel"]', 250);
    ok('bulk select shows the bulk bar', await f.ev(() => /2 selected/.test((document.querySelector('#w116tasks .w116bulk') || {}).innerText || '')));
    await f.page.selectOption('#w116tasks .w116bulk select[data-bulk="status"]', 'Waiting'); await f.page.waitForTimeout(700);
    ok('bulk edit sets the status of both', await f.ev(() => ['5002', '5004'].every((id) => DB_TASKS.find((t) => String(t.id) === id).status === 'Waiting')));
    /* drag a task onto a project in the sidebar */
    await f.ev(() => { const src = document.querySelector('#w116tasks .w116r[data-tid="5005"]'), dst = document.querySelector('#w116tasks .w287pr[data-pid="5"] .nm'); const dt = new DataTransfer();
      src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); });
    await f.page.waitForTimeout(700);
    ok('dragging a task onto a sidebar project moves it there', await f.ev(() => DB_TASKS.find((t) => t.id === 5005).project_id === 5));
    /* old workstream links */
    await f.hash('#team/marketing/tasks/Website', 2600);
    let st = await state(f);
    ok('#team/marketing/tasks/Website opens Website Redesign', st && st.list === 'p6', st && st.list);
    ok('the address drops the workstream', await f.ev(() => location.hash === '#team/marketing/tasks'));
    await f.hash('#team/marketing/tasks/Somewhere%20else', 2600);
    st = await state(f);
    ok('an unknown workstream opens All', st && st.list === 'all', st && st.list);
    await f.hash('#team/marketing/tasks/Content', 2600);
    ok('#team/marketing/tasks/Content opens the new Content project', ((await state(f)) || {}).list === 'p27');
    ok('no horizontal scroll at 1280', !(await hasScroll(f)));
    /* a renamed project shows its new name in the sidebar, the list title and the Overview's card (w116idrive read the retired markup) */
    await f.ev(() => { const p = window.w116Projects().find((x) => x.id === 6); p.name = 'Website Redesign (renamed)'; window.w116Board.list('p6'); });
    ok('a renamed project shows in the sidebar and the list title', await f.ev(() => /\(renamed\)/.test(document.querySelector('#w116tasks .w287pr[data-pid="6"]').textContent) && /RENAMED/i.test(document.querySelector('#w116tasks .w287lhead h3').textContent)));
    await f.hash('#team/marketing', 2600);
    ok('a renamed project shows on the Overview’s card', await f.ev(() => [].some.call(document.querySelectorAll('#w287proj .w287pc .nm'), (n) => /Website Redesign \(renamed\)/.test(n.textContent))));
    await f.hash('#team/marketing/tasks', 2600);
    await f.page.waitForSelector('#w258req', { timeout: 5000 }).catch(() => {});   /* wave258 places it from its own observer */
    ok('the "Asked of" banner stays on Tasks', await f.ev(() => !!document.getElementById('w258req')) || await f.ev(() => !(window.w123 && window.w123.items && window.w123.items('marketing', 'open').some((x) => x.k === 'r'))));
    await done(f);
  }

  /* ---------- 2. Fundraising: cross-team counts, sub-projects, the boards, #grants, Finance ---------- */
  if (run(2)) {
    const f = await go({ width: 1280, height: 1200, hash: '#team/fundraising/tasks' });
    await toTasks(f, 'fundraising');
    const sc = await sideCounts(f);
    ok('Fundraising: General Fundraising first', sc.order[0] === 20, sc.order);
    const gb = f.fx.dept_tasks.filter((t) => !t.done && Number(t.project_id) === 13 && !(t.department === 'fundraising' && t.subsection === 'Grants')).length;   /* wave258 keeps grants off the Fundraising team page */
    ok('Fundraising: the Gift Basket Drive counts Marketing’s task too (' + gb + ')', sc.proj[13] === gb && f.fx.dept_tasks.some((t) => !t.done && t.project_id === 13 && t.department === 'marketing'), { page: sc.proj[13], gb });
    ok('Fundraising: sub-projects sit indented under Fundraising Events', [11, 12, 13].every((id) => sc.depth[id] === 1) && sc.order.indexOf(2) < sc.order.indexOf(11), sc);
    ok('Fundraising: Grants Program points to its own page', await f.ev(() => { const r = document.querySelector('#w116tasks .w287pr[data-pid="23"]'); return !!r && r.getAttribute('data-w116go') === '#grants'; }));
    ok('Fundraising: the All list ends with wave258’s Grants pointer', await f.ev(() => !!document.querySelector('#w116tasks .w258ptr a[data-w116go="#grants"]')));
    ok('Fundraising: the grants task stays off the team page (wave258)', await f.ev(() => !document.querySelector('#w116tasks .w116r[data-tid="5206"]')));
    ok('Fundraising: the Sub-team grouping is still offered', await f.ev(() => !!document.querySelector('#w116tasks select[data-act="group"] option[value="board"]')));
    await click(f, '#w116tasks .w287pr[data-pid="13"]', 600);
    const rows = (await shownRows(f)).map(Number);
    ok('Fundraising: the Gift Basket list shows Marketing’s task with a team tag', rows.indexOf(5006) >= 0 && await f.ev(() => /Marketing/.test(document.querySelector('#w116tasks .w116r[data-tid="5006"] .w287team').textContent)), rows);
    await f.ev(() => { document.querySelector('#w116tasks select[data-act="group"]').value = 'board'; document.querySelector('#w116tasks select[data-act="group"]').dispatchEvent(new Event('change', { bubbles: true })); });
    await f.page.waitForTimeout(500);
    ok('Fundraising: grouping by sub-team still works', await f.ev(() => !!document.querySelector('#w116tasks .w116g[data-g="bevents"]')));
    await f.hash('#team/fundraising/events', 2600);
    ok('the Event fundraising board renders with its projects', await f.ev(() => !!document.querySelector('#w116tasks .w287') && [2, 11, 12, 13].every((id) => !!document.querySelector('#w116tasks .w287pr[data-pid="' + id + '"]'))));
    ok('the Event fundraising board lists its tasks', (await f.ev(() => { window.w116Board.list('all'); return document.querySelectorAll('#w116tasks .w116r[data-tid]').length; })) >= 5);
    await f.hash('#team/fundraising/tasks/Grants', 2600);
    ok('#team/fundraising/tasks/Grants goes to the Grants page', await f.ev(() => location.hash === '#grants'));
    await f.hash('#grants', 3000);
    ok('#grants renders its board', await f.ev(() => { const s = document.getElementById('grants'); return !!s && s.classList.contains('active') && /Grants/.test(s.innerText) && !!s.querySelector('.w116b'); }));
    ok('#grants shows the grants task', await f.ev(() => { window.w116Board.list('all'); return !!document.querySelector('#grants .w116r[data-tid="5206"]'); }));
    /* the Finance app's board (wave164 renders w116Board with dept finance; the fixture's admin has no Finance page, so the call is made here) */
    ok('the Finance board shows General Finance first and Bills and receipts', await f.ev(() => { const slot = document.createElement('div'); slot.id = 'w287fin'; document.getElementById('grants').appendChild(slot); window.w116Board.render(slot, { dept: 'finance', board: null, ws: null }); const ids = [].map.call(slot.querySelectorAll('.w287pr[data-pid]'), (r) => r.getAttribute('data-pid')); const ok = ids[0] === '24' && ids.indexOf('25') > 0 && slot.querySelectorAll('.w116r[data-tid]').length === 2; slot.remove(); return ok; }));
    await done(f);
  }

  /* ---------- 3. The Overview at 1280 ---------- */
  if (run(3)) {
    const f = await go({ width: 1280, height: 1400, hash: '#team/marketing' });
    await f.hash('#team/opsmtl', 1500); await f.hash('#team/marketing', 2800);
    await f.page.waitForSelector('#w116host .w287now', { timeout: 10000 }).catch(() => {});
    await f.page.waitForTimeout(800);
    const ids = await f.ev(() => ({ kpis: !!document.querySelector('#w116host .w116kpis'), grid: !!document.querySelector('#w116host .w116grid'), cols: document.querySelectorAll('#w116host .w116grid > .w116col').length, meet: !!document.getElementById('w116meet'), upd: !!document.getElementById('w116updcard'), inbox: !!document.getElementById('w123tcard'), req: !!document.getElementById('w258req') }));
    ok('the Overview keeps .w116kpis, .w116grid, two .w116col, #w116meet and #w116updcard', ids.kpis && ids.grid && ids.cols === 2 && ids.meet && ids.upd, ids);
    ok('the Team inbox card (wave123) lands on the Overview', ids.inbox, ids);
    ok('the "Asked of" banner is not on the Overview', !ids.req, ids);
    const order = await f.ev(() => ['w287need', 'w287proj', 'w123tcard', 'w116updcard'].map((id) => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().top) : null; }));
    ok('left column reads Needs attention, Projects, Team inbox, Updates', order.every((x) => x !== null) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3], order);
    const exp = EXPECT(f.fx, 'marketing', ADMIN.name, ADMIN.id);
    const now = await f.ev(() => ({ sent: document.querySelector('#w116host .w287sent').textContent, tiles: [].map.call(document.querySelectorAll('#w116host .w287tiles .w116kpi'), (k) => ({ q: k.getAttribute('data-w116q'), t: k.innerText.replace(/\s+/g, ' ').trim(), warn: k.classList.contains('warn') })) }));
    ok('Now: one sentence', /overdue/.test(now.sent) && /due this week/.test(now.sent) && /\.$/.test(now.sent), now.sent);
    ok('Now: three tiles, Open ' + exp.all + ', Overdue in red', now.tiles.length === 3 && now.tiles[0].t === exp.all + ' Open' && now.tiles[1].q === 'overdue' && now.tiles[1].warn && now.tiles[2].q === 'week', now.tiles);
    const need = await f.ev(() => [].map.call(document.querySelectorAll('#w287need .w116r[data-tid]'), (r) => r.getAttribute('data-tid')));
    const due7 = f.fx.dept_tasks.filter((t) => t.department === 'marketing' && !t.done && t.due_date && t.due_date <= '2026-10-02').length;
    ok('Needs attention lists up to six overdue or due within seven days (' + need.length + ')', need.length === Math.min(6, due7), { need, due7 });
    ok('Needs attention starts with the most overdue', need[0] === String(f.fx.dept_tasks.filter((t) => t.department === 'marketing' && !t.done && t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))[0].id), need);
    const cards = await f.ev(() => [].map.call(document.querySelectorAll('#w287proj .w287pc'), (c) => ({ cls: c.className, t: c.innerText.replace(/\s+/g, ' ').trim().slice(0, 80), q: c.getAttribute('data-w116q') })));
    ok('Projects: General’s card first and quieter, a ring on each, New project for staff', /\bgen\b/.test(cards[0].cls) && /General Marketing/.test(cards[0].t) && /\bnew\b/.test(cards[cards.length - 1].cls) && await f.ev(() => document.querySelectorAll('#w287proj .w287ring').length >= 6), cards);
    ok('Projects: a card says n open, m overdue and the next task due', cards.some((c) => /open, \d+ overdue/.test(c.t)), cards);
    const t0 = await f.ev(() => document.getElementById('w116host').innerText);
    ok('no undefined, NaN, null or [object on the Overview', !BAD.test(t0), (t0.match(BAD) || [])[0]);
    ok('the tabs carry a sliding thumb under the current tab', await f.ev(() => { const s = document.querySelector('#w116host > .w287tabs'); const th = s && s.querySelector('.w287thumb'), on = s && s.querySelector('a.on'); return !!th && s.classList.contains('w287th') && Math.abs(th.getBoundingClientRect().width - on.getBoundingClientRect().width) < 1.5 && Math.abs(th.getBoundingClientRect().left - on.getBoundingClientRect().left) < 1.5; }));
    ok('the read is clamped to two lines with More', await f.ev(() => { const p = document.querySelector('#w116host .w287read'); const m = document.querySelector('#w116host [data-w287more]'); return !!p && !!m && !m.hidden && p.clientHeight < p.scrollHeight; }));
    await click(f, '#w116host [data-w287more]', 200);
    ok('More opens the whole read', await f.ev(() => { const p = document.querySelector('#w116host .w287read'); return p.classList.contains('open') && p.clientHeight >= p.scrollHeight - 1; }));
    await shot(f, 'w287-marketing-overview-1280');
    /* a tick on the Overview */
    const first = need[1];
    await click(f, '#w287need .w116r[data-tid="' + first + '"] .w116done', 400);
    ok('a tick on Needs attention completes the task', await f.ev((id) => DB_TASKS.find((t) => String(t.id) === id).done === true && /Undo/.test((document.querySelector('#w287snack.on') || {}).innerText || ''), first));
    await f.page.waitForTimeout(2200);
    ok('the row leaves the Overview after the fold', await f.ev((id) => !document.querySelector('#w287need .w116r[data-tid="' + id + '"]'), first));
    await click(f, '#w287snack [data-w287sn="undo"]', 1200);
    ok('Undo brings it back on the Overview', await f.ev((id) => DB_TASKS.find((t) => String(t.id) === id).done === false && !!document.querySelector('#w287need .w116r[data-tid="' + id + '"]'), first));
    await click(f, '#w287need .w116r[data-tid="' + need[0] + '"] .ttl', 500);
    ok('a row on the Overview opens the drawer', await f.ev(() => document.getElementById('w116dr').classList.contains('open')));
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
    /* the tiles and cards open the matching list */
    await click(f, '#w116host .w287tiles .w116kpi[data-w116q="overdue"]', 2600);
    let st = await state(f);
    ok('the Overdue tile opens Today with the Overdue filter', /#team\/marketing\/tasks$/.test(await f.ev(() => location.hash)) && st && st.list === 'today' && st.due === 'overdue', st);
    await f.hash('#team/marketing', 2600);
    await click(f, '#w287proj .w287pc[data-w116q="project:27"]', 2600);
    st = await state(f);
    ok('a project card opens that project’s list', st && st.list === 'p27', st);
    ok('the "Asked of" banner is back on Tasks', await f.ev(() => !!document.getElementById('w258req')));
    await f.hash('#team/marketing/agenda', 2600);
    ok('the "Asked of" banner is on Agenda', await f.ev(() => !!document.getElementById('w258req')));
    await f.hash('#team/marketing', 2600);
    await click(f, '#w287need .lnk[data-w116q="today"]', 2600);
    ok('See all opens the Today list', ((await state(f)) || {}).list === 'today');
    await f.hash('#team/fundraising', 2800);
    ok('the Fundraising Overview’s Open tile leaves grants out (wave258)', await f.ev(() => { const k = document.querySelector('#w116host .w287tiles .w116kpi[data-w116q="all"] b'); return !!k && Number(k.textContent) === window.w116TasksFor('fundraising', null, null).filter((t) => !t.done).length; }));
    ok('the Fundraising Overview’s Grants card points to #grants', await f.ev(() => [].some.call(document.querySelectorAll('#w287proj .w287pc'), (c) => c.getAttribute('data-w116go') === '#grants')));
    await f.hash('#team/opsto', 2600);
    ok('an Overview with nothing due says so quietly', await f.ev(() => { const z = document.querySelectorAll('#w116host .w287tiles .w116kpi.zero'); return z.length >= 1 && [].every.call(z, (k) => !k.querySelector('b') && /Nothing|No open/.test(k.innerText)); }));
    await done(f);
  }

  /* ---------- 4. Widths 390 and 768, and 1280 at a 200% root font ---------- */
  if (run(4)) for (const w of [390, 768, 1280]) {
    const f = await go({ width: w, height: w < 700 ? 900 : 1000, hash: '#team/marketing' });
    if (w === 1280) { await f.ev(() => { document.documentElement.style.fontSize = '200%'; }); await f.page.waitForTimeout(400); }
    const tag = w === 1280 ? '1280 at 200% root font' : String(w);
    for (const d of ['marketing', 'opsmtl', 'fundraising']) {
      await f.hash('#team/' + d, 2600);
      ok(tag + ' ' + d + ' Overview: no horizontal scroll', !(await hasScroll(f)), await f.ev(() => [document.documentElement.scrollWidth, window.innerWidth]));
      const t = await f.ev(() => document.getElementById('w116host').innerText);
      ok(tag + ' ' + d + ' Overview: no bad words', !BAD.test(t), (t.match(BAD) || [])[0]);
      ok(tag + ' ' + d + ' Overview: the Needs attention rows keep their titles readable', await f.ev(() => [].every.call(document.querySelectorAll('#w287need .w116r .ttl'), (e) => e.getBoundingClientRect().width > 120)));
      await toTasks(f, d);
      ok(tag + ' ' + d + ' Tasks: no horizontal scroll', !(await hasScroll(f)), await f.ev(() => [document.documentElement.scrollWidth, window.innerWidth]));
      const t2 = await f.ev(() => document.getElementById('w116tasks').innerText);
      ok(tag + ' ' + d + ' Tasks: no bad words', !BAD.test(t2), (t2.match(BAD) || [])[0]);
      ok(tag + ' ' + d + ' Tasks: rows keep their titles readable', await f.ev(() => [].every.call(document.querySelectorAll('#w116tasks .w116r .ttl'), (e) => e.getBoundingClientRect().width > 120)));
    }
    if (w < 900) {
      await toTasks(f, 'marketing');
      const side = await f.ev(() => { const s = document.querySelector('#w116tasks .w287side'); const cs = getComputedStyle(s); return { d: cs.display, ox: cs.overflowX, pos: cs.position, h: s.getBoundingClientRect().height, chips: s.querySelectorAll('.w287sl,.w287pr').length }; });
      ok(tag + ': the sidebar is a sticky row of chips', side.d === 'flex' && side.ox === 'auto' && side.pos === 'sticky' && side.h < 70 && side.chips > 8, side);
      await click(f, '#w116tasks .w287side .w287pr[data-pid="5"]', 600);
      ok(tag + ': a chip opens its project and stays in view', await f.ev(() => { const s = document.querySelector('#w116tasks .w287side'), on = s.querySelector('.on'); const a = s.getBoundingClientRect(), b = on.getBoundingClientRect(); return window.w116Board.state().list === 'p5' && b.left >= a.left - 1 && b.right <= a.right + 1; }));
      ok(tag + ': no horizontal scroll with a project open', !(await hasScroll(f)));
      if (w === 390) { await f.hash('#team/marketing', 2400); await shot(f, 'w287-marketing-overview-390'); }
    }
    await done(f);
  }

  /* ---------- 5. Reduced motion: slides become short fades ---------- */
  if (run(5)) {
    const f = await go({ width: 1280, height: 1000, ctx: { reducedMotion: 'reduce' } });
    await toTasks(f, 'marketing');
    await click(f, '#w116tasks .w116r[data-tid="5002"] .ttl', 400);
    const cs = await f.ev(() => { const d = document.getElementById('w116dr'); const c = getComputedStyle(d); return { tp: c.transitionProperty, tf: c.transform, op: c.opacity }; });
    ok('reduced motion: the drawer fades instead of sliding', /opacity/.test(cs.tp) && !/transform/.test(cs.tp) && (cs.tf === 'none') && cs.op === '1', cs);
    await done(f);
  }

  ok('no page errors', allErrs.length === 0, allErrs);
  ok('no console errors', allCons.length === 0, allCons);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
