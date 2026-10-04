/* w206drive.js (wave206): a project page opens its tasks in the team pages' task drawer.
   CAND=build/<file>.html node test/w206drive.js   (SHOT=<png> also saves the desktop screenshot of a task open on Brand Refresh)
   Fixture: test/w205fixture.js (mirrors live) plus two tasks on Brand Refresh (project 5): one done, one from another team. */
const { launch, fresh } = require('./boot');
const { build } = require('./w205fixture');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } }

function fx() {
  const f = build();
  f.dept_tasks.push({ id: 901, department: 'marketing', title: 'Choose the brand typefaces', owner: 'Ian Hartley', status: 'Done', done: true, flag: false, priority: false, project_id: 5, due_date: '2026-09-10', opened_at: '2026-08-20T12:00:00+00:00', closed_at: '2026-09-09T12:00:00+00:00', sort: 2 });
  f.dept_tasks.push({ id: 902, department: 'hr', title: 'Brief new staff on the refreshed brand', owner: '', status: 'Open', done: false, flag: false, priority: false, project_id: 5, due_date: null, opened_at: '2026-09-20T12:00:00+00:00', sort: 3 });
  f.task_comments = (f.task_comments || []).concat([{ id: 9901, task_id: 19, body: 'Draft pages are in the shared drive.', author: 'Ian Hartley', source: 'manual', created_at: '2026-09-24T14:00:00+00:00' }]);
  return f;
}

/* the stub acknowledges writes without applying them; here dept_tasks and task_comments writes land in the fixture, as in the database */
const INIT = `(function(){ var sb; Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return sb; }, set: function (v) { sb = v; var cc = v && v.createClient; if (!cc || cc.__w206) return;
  v.createClient = function () { var c = cc.apply(this, arguments); try { var P = Object.getPrototypeOf(c.from('dept_tasks')); if (!P.__w206) { P.__w206 = true; var orig = P._resolve; P._resolve = function () {
    var T = this._table; if ((T === 'dept_tasks' || T === 'task_comments' || T === 'task_assignees') && (this._op === 'update' || this._op === 'insert')) { var rows = window.__WAFIX[T] = window.__WAFIX[T] || [];
      if (this._op === 'update') { var eq = this._eq; rows.forEach(function (r) { if (eq.every(function (f) { return String(r[f[0]]) === String(f[1]); })) Object.assign(r, JSON.parse(JSON.stringify(this._payload))); }, this); }
      else { var arr = Array.isArray(this._payload) ? this._payload : [this._payload]; var self = this; arr.forEach(function (x) { var mx = rows.reduce(function (m, r) { return Math.max(m, Number(r.id) || 0); }, 0); var row = Object.assign({ id: mx + 1, created_at: new Date().toISOString() }, x); rows.push(row); x.id = row.id; }); } }
    return orig.call(this); }; } } catch (e) {} return c; }; v.createClient.__w206 = true; } }); })();`;
async function clickOpen(f, id, scope) { await f.ev(a => { var el = document.querySelector((a.s || '#projectpage') + ' [data-w206open="' + a.id + '"]'); if (el) el.scrollIntoView({ block: 'center' }); }, { id: String(id), s: scope }); await f.page.waitForTimeout(150); await f.page.click((scope || '#projectpage') + ' [data-w206open="' + id + '"]'); await f.page.waitForTimeout(900); }
const S = () => ({
  hash: location.hash,
  rows: document.querySelectorAll('#projectpage .w27-task').length,
  btns: document.querySelectorAll('#projectpage [data-w206open]').length,
  drawer: !!(document.getElementById('w116dr') && document.getElementById('w116dr').classList.contains('open')),
  head: ((document.querySelector('#w116dr .w116drh') || {}).textContent || ''),
  title: ((document.querySelector('#w116dr textarea.ttl') || {}).value || ''),
  w206: window.w206 ? window.w206.state() : null
});

async function run(b, who, width) {
  const tag = who + ' @' + width;
  const f = await fresh(b, { who, width, hash: '#project/5', fixture: fx(), init: INIT, wait: 4200 });
  let r = await f.ev(() => ({ s: (function () { return { hash: location.hash, rows: document.querySelectorAll('#projectpage .w27-task').length, btns: document.querySelectorAll('#projectpage [data-w206open]').length, h2: ((document.querySelector('#projectpage .card h2') || {}).textContent || '') }; })(),
    app: (document.documentElement.getAttribute('data-w153app') || (document.querySelector('[data-w153app].on,.w153rail [aria-current]') || {}).textContent || document.body.className) }));
  ok(r.s.rows >= 2 && r.s.btns === r.s.rows && /Brand Refresh/.test(r.s.h2), tag + ': every task title on Brand Refresh is a button (' + r.s.btns + ' of ' + r.s.rows + ')');
  const inStrategy = await f.ev(() => { var el = document.querySelector('.w153rail, #w153rail, [data-w153rail]'); var txt = el ? el.textContent : ''; return /Strategy Library|Goal alignment/.test(txt) || /strategy/i.test(document.documentElement.className + ' ' + (document.documentElement.dataset.app || '')); });
  r = await f.ev(() => ({ goal: ((document.querySelector('#projectpage .w27-goal') || {}).textContent || ''), ng: !!document.querySelector('#projectpage .w206ng') }));
  ok(!/archived|Elevate Online/.test(r.goal) && r.ng, tag + ': no retired goal on the project page; "Not linked to one of the five goals yet" instead');
  if (width >= 700) ok(inStrategy, tag + ': the project page opens inside the Strategy app');

  /* open task 19 (open list) */
  await clickOpen(f, 19);
  r = await f.ev(S);
  ok(r.drawer && /#19/.test(r.head) && r.title === 'Finish brand guideline book', tag + ': clicking a title opens the team pages\' task drawer on that task');
  r = await f.ev(() => ({ cm: ((document.getElementById('w116cm') || {}).textContent || ''), acts: !!document.getElementById('w116acts'), desc: !!document.querySelector('#w116dr .w116tdw, #w116dr .w116tdesc'), due: !!document.querySelector('#w116dr input[data-dfield="due"]'), owner: !!document.querySelector('#w116dr select[data-dfield="owner"]'), addas: !!document.querySelector('#w116dr select[data-dfield="addas"]'), foot: Array.from(document.querySelectorAll('#w116dr .w116drf button')).map(b => b.textContent).join('|'), only: document.querySelectorAll('#w116dr').length, w: (document.getElementById('w116dr') || {}).getBoundingClientRect ? document.getElementById('w116dr').getBoundingClientRect().width : 0, sw: document.scrollingElement.scrollWidth, vw: window.innerWidth }));
  ok(/Draft pages are in the shared drive/.test(r.cm) && r.acts && r.due && r.owner && r.addas, tag + ': the same drawer: owner, assignees, due date, comments, activity');
  ok(r.desc, tag + ': wave116t\'s description (notes) is in it');
  ok(/Mark done/.test(r.foot) && /Department page/.test(r.foot) && r.only === 1, tag + ': one drawer, its own footer (Mark done, Department page)');
  if (width < 700) ok(r.w <= r.vw + 1 && r.sw <= r.vw + 1, tag + ': the drawer fills the phone width, no sideways scroll (' + Math.round(r.w) + '/' + r.vw + ')');

  /* edit: due date and title, then the project page repaints in place */
  await f.ev(() => { var i = document.querySelector('#w116dr input[data-dfield="due"]'); i.value = '2026-10-30'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await f.page.waitForTimeout(1600);
  await f.ev(() => { var t = document.querySelector('#w116dr textarea.ttl'); t.value = 'Finish the brand guideline book'; t.dispatchEvent(new Event('change', { bubbles: true })); });
  await f.page.waitForTimeout(1600);
  r = await f.ev(() => { var row = document.querySelector('#projectpage [data-w206open="19"]'); row = row && row.closest('.w27-task'); return { txt: row ? row.textContent : '', hash: location.hash, rep: window.w206.state().repaints, on: row ? row.classList.contains('w206on') : false, db: (window.__WAFIX.dept_tasks.find(t => t.id === 19) || {}) }; });
  ok(/due 2026-10-30/.test(r.txt) && /Finish the brand guideline book/.test(r.txt) && r.hash === '#project/5', tag + ': after editing in the drawer the project page shows the new due date and title, still on #project/5');
  ok(r.db.due_date === '2026-10-30' && r.db.title === 'Finish the brand guideline book', tag + ': saved through the drawer\'s own writes');
  ok(r.rep >= 1 && r.on, tag + ': repainted in place, the open task marked');
  await f.page.waitForTimeout(400);
  r = await f.ev(() => { var t = document.querySelector('#projectpage [data-w206open="19"]'); var row = t && t.closest('.w27-task'); return { pill: !!(row && row.querySelector('.w52row')), last: !!(row && row.querySelector('.w51last')), staff: typeof isStaff === 'function' && isStaff() }; });
  ok(!r.staff || (r.pill && r.last), tag + ': the row keeps its due pill and latest comment after the repaint');

  /* a comment from the drawer */
  await f.ev(() => { document.getElementById('w116cmtx').value = 'Checked from the project page'; document.querySelector('#w116dr [data-dact="comment"]').click(); });
  await f.page.waitForTimeout(900);
  r = await f.ev(() => ({ n: (window.__WAFIX.task_comments || []).filter(c => c.task_id === 19 && /project page/.test(c.body)).length, cm: (document.getElementById('w116cm') || {}).textContent || '' }));
  ok(r.n === 1 && /Checked from the project page/.test(r.cm), tag + ': a comment posts from the drawer');

  /* Esc closes; the page stays */
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(700);
  r = await f.ev(S);
  ok(!r.drawer && r.hash === '#project/5' && r.rows >= 2, tag + ': Esc closes the drawer and leaves the project page in place');

  /* the checkbox is unchanged: it ticks, it does not open the drawer */
  const before = r.w206.opened;
  await f.ev(() => document.querySelector('#projectpage .w27-task input[data-w27t="902"]').scrollIntoView({ block: 'center' }));
  await f.page.click('#projectpage .w27-task input[data-w27t="902"]'); await f.page.waitForTimeout(1300);
  r = await f.ev(() => ({ d: !!(document.getElementById('w116dr') || {}).classList && document.getElementById('w116dr').classList.contains('open'), done: (window.__WAFIX.dept_tasks.find(t => t.id === 902) || {}).done, inDone: !!document.querySelector('#projectpage details.completed [data-w206open="902"]') || !!document.querySelector('#projectpage .w27-task.done [data-w206open="902"]'), opened: window.w206.state().opened }));
  ok(r.done === true && r.inDone && !r.d && r.opened === before, tag + ': ticking the checkbox closes the task (since wave207 through toggleTask, with Undo) and opens nothing');
  await f.page.waitForTimeout(10500);

  /* completed list: open a done task */
  await f.ev(() => { var d = document.querySelector('#projectpage details.completed'); if (d) d.open = true; });
  await clickOpen(f, 901, '#projectpage details.completed');
  r = await f.ev(S);
  const foot = await f.ev(() => Array.from(document.querySelectorAll('#w116dr .w116drf button')).map(b => b.textContent).join('|'));
  ok(r.drawer && /#901/.test(r.head) && /Reopen/.test(foot), tag + ': a completed task opens too (Reopen in the drawer)');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(500);

  /* keyboard */
  await f.ev(() => document.querySelector('#projectpage [data-w206open="19"]').focus());
  await f.page.keyboard.press('Enter'); await f.page.waitForTimeout(900);
  r = await f.ev(S);
  ok(r.drawer && /#19/.test(r.head), tag + ': Enter on a focused title opens it');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(500);

  /* a task added with the quick add opens (read into DB_TASKS first) */
  const canAdd = await f.ev(() => !!document.getElementById('w27nt'));
  if (canAdd) {
    await f.ev(() => { document.getElementById('w27nt').value = 'Print the new letterhead'; document.getElementById('w27ntgo').click(); });
    await f.page.waitForTimeout(1500);
    const nid = await f.ev(() => { var t = (window.__WAFIX.dept_tasks || []).filter(x => x.title === 'Print the new letterhead')[0]; return t ? t.id : null; });
    if (nid != null) {
      await clickOpen(f, nid);
      r = await f.ev(S);
      ok(r.drawer && r.title === 'Print the new letterhead', tag + ': a task just added on the project page opens');
      await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(500);
    } else ok(false, tag + ': quick add saved a task');
  }

  /* other routes: from Projects and from the team page */
  await f.hash('#projects', 1500); await f.hash('#project/5', 1500);
  await clickOpen(f, 19);
  r = await f.ev(S);
  ok(r.drawer && /#19/.test(r.head), tag + ': opens after arriving from Projects');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(400);
  await f.hash('#team/marketing', 1500); await f.hash('#project/5', 1500);
  await clickOpen(f, 19);
  r = await f.ev(S);
  ok(r.drawer && /#19/.test(r.head), tag + ': opens after arriving from the team page');
  if (process.env.SHOT && who === 'admin' && width >= 700) await f.page.screenshot({ path: process.env.SHOT });
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(400);
  /* the team page's own drawer still works after this */
  await f.hash('#team/marketing/tasks', 2000);
  const teamOpen = await f.ev(async () => { var row = document.querySelector('#w116tasks .w116r[data-tid]'); if (!row) return 'norow'; row.querySelector('.ttl').click(); await new Promise(r => setTimeout(r, 700)); return document.getElementById('w116dr').classList.contains('open'); });
  ok(teamOpen === true, tag + ': the team page still opens its tasks the same way');
  r = await f.ev(() => ({ menuAfter: window.w163 ? window.w163.state().after : 0 }));
  ok(r.menuAfter === 0, tag + ': the menu shows once');
  ok(f.errs.length === 0, tag + ': no page errors' + (f.errs.length ? ' (' + f.errs.join(' | ') + ')' : ''));
  await f.close();
}

(async () => {
  const b = await launch();
  for (const who of (process.env.WHO ? process.env.WHO.split(',') : ['admin', 'member', 'leader'])) for (const w of (process.env.W ? process.env.W.split(',').map(Number) : [1366, 390])) { try { await run(b, who, w); } catch (e) { fail++; console.log('FAIL ' + who + ' @' + w + ' threw: ' + String(e).slice(0, 2500)); } }
  /* board viewers: the page still draws without errors */
  try {
    const f = await fresh(b, { who: 'board', width: 1366, hash: '#project/5', fixture: fx(), init: INIT, wait: 4200 });
    const r = await f.ev(() => ({ rows: document.querySelectorAll('#projectpage .w27-task').length, btns: document.querySelectorAll('#projectpage [data-w206open]').length }));
    ok(r.btns === r.rows, 'board: the project page draws (' + r.rows + ' tasks), titles open as for staff');
    ok(f.errs.length === 0, 'board: no page errors' + (f.errs.length ? ' (' + f.errs.join(' | ') + ')' : ''));
    await f.close();
  } catch (e) { fail++; console.log('FAIL board threw: ' + String(e).slice(0, 300)); }
  await b.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
