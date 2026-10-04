/* w207drive.js (wave207): project tasks are department tasks; the charitable activities; this year's goals (FY27).
   CAND=build/<file>.html node test/w207drive.js   (SHOTS=<dir> also saves the two screenshots)
   Fixture: test/w207fixture.js. The strategy_* calls are caught in the page (as in w205drive), Realtime is a fake channel,
   and dept_tasks and change_log writes land in the fixture (as in w206drive). Nothing reaches the database. */
const { launch, fresh } = require('./boot');
const { build, TARGETS, LINKS } = require('./w207fixture');
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } }

const INIT = (today) => `(function(){
  window.__W207_TODAY = ${JSON.stringify(today || '2026-10-04')};
  window.__w205calls = []; window.__w205rpc = {}; window.__w205ps = {};
  function apply(b) {
    var T = b._table; if (['dept_tasks', 'task_comments', 'task_assignees', 'change_log'].indexOf(T) < 0 || (b._op !== 'update' && b._op !== 'insert')) return;
    var rows = window.__WAFIX[T] = window.__WAFIX[T] || [];
    if (b._op === 'update') { var eq = b._eq || [], inn = b._in || []; rows.forEach(function (r) { if (eq.every(function (f) { return String(r[f[0]]) === String(f[1]); }) && inn.every(function (f) { return (f[1] || []).map(String).indexOf(String(r[f[0]])) >= 0; })) Object.assign(r, JSON.parse(JSON.stringify(b._payload))); }); }
    else { var arr = Array.isArray(b._payload) ? b._payload : [b._payload]; arr.forEach(function (x) { var mx = rows.reduce(function (m, r) { return Math.max(m, Number(r.id) || 0); }, 0); var row = Object.assign({ id: mx + 1, created_at: new Date().toISOString() }, x); rows.push(row); x.id = row.id; }); }
  }
  function patch(c){
    try { var P = Object.getPrototypeOf(c.from('dept_tasks')); if (!P.__w207) { P.__w207 = true; var orig0 = P._resolve; P._resolve = function () { try { apply(this); } catch (e) {} return orig0.call(this); }; } } catch (e) {}
    var orig = c.rpc.bind(c);
    c.rpc = function (fn, args) {
      window.__w205calls.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
      var h = window.__w205rpc[fn];
      if (h) { try { var r = h(args); return Promise.resolve(r && r.error ? r : { data: r, error: null }); } catch (e) { return Promise.resolve({ data: null, error: { message: String(e.message || e) } }); } }
      if (/^strategy_/.test(fn)) return Promise.resolve({ data: { ok: true }, error: null });
      return orig(fn, args);
    };
    c.channel = function (name, opts) {
      var ch = { name: name, opts: opts, handlers: [], tracked: [], subscribed: false };
      ch.on = function (type, filter, cb) { ch.handlers.push({ type: type, filter: filter, cb: cb }); return ch; };
      ch.subscribe = function (cb) { ch.subscribed = true; setTimeout(function(){ cb && cb('SUBSCRIBED'); }, 10); return ch; };
      ch.track = function () { return Promise.resolve('ok'); }; ch.untrack = function () { return Promise.resolve('ok'); };
      ch.presenceState = function () { return window.__w205ps; };
      ch.unsubscribe = function () { return Promise.resolve('ok'); };
      ch.fire = function (type, a, b) { ch.handlers.forEach(function (h) { if (h.type !== type) return; if (type === 'postgres_changes' && h.filter.table !== a) return; h.cb(b || {}); }); };
      window.__w205ch = ch; return ch;
    };
    c.removeChannel = function (ch) { ch.removed = true; return Promise.resolve('ok'); };
    return c;
  }
  var sb;
  Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return sb; }, set: function (v) {
    sb = v; var cc = v && v.createClient; if (!cc || cc.__w207) return;
    v.createClient = function () { return patch(cc.apply(this, arguments)); }; v.createClient.__w207 = true;
  } });
})();`;
const boot = (b, who, width, hash, today, fx) => fresh(b, { who, width: width || 1366, hash: hash || '#orggoals', fixture: fx || build(), init: INIT(today), wait: 4400 });
const calls = (f, fn) => f.ev(n => window.__w205calls.filter(c => !n || c.fn === n), fn);
const shot = async (f, name, opt) => { if (SHOTS) await f.page.screenshot(Object.assign({ path: SHOTS + '/' + name + '.png' }, opt || {})); };

async function goals(b) {
  /* ================= admin, desktop, 4 Oct 2026 (FY27 Q1) ================= */
  let f = await boot(b, 'admin');
  let r = await f.ev(() => {
    const yr = document.querySelector('#w205 [data-w207year]');
    return {
      first: (() => { const kids = Array.from(document.querySelectorAll('#w205 > *')).map(x => x.matches('[data-w207year]') ? 'year' : x.className); return kids.indexOf('year'); })(),
      h2: yr ? yr.querySelector('h2').textContent : '', sub: yr ? yr.querySelector('.sub').textContent : '',
      now: Array.from(document.querySelectorAll('#w205 .w207q.now b')).map(x => x.textContent),
      nextWhen: (document.querySelector('#w205 [data-w207next] .when') || {}).textContent || '',
      next: Array.from(document.querySelectorAll('#w205 [data-w207next] .w207it .tx')).map(x => x.textContent),
      late: (document.querySelector('#w205 [data-w207overdue]') || {}).className || '',
      rows: Array.from(document.querySelectorAll('#w205 .w207grid tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent)),
      thNow: (document.querySelector('#w205 .w207grid th.now') || {}).textContent || '',
      tdNow: document.querySelectorAll('#w205 .w207grid td.now').length,
      note: (document.querySelector('#w205 .w207year .note') || {}).textContent || '',
      cov: Array.from(document.querySelectorAll('#w205 .w207tile')).map(t => t.querySelector('.n').textContent + ':' + Array.from(t.querySelectorAll('.w205num')).map(n => n.textContent).join(',')),
      gaps: document.querySelectorAll('#w205 .w207tile.gap').length,
      covsum: (document.querySelector('#w205 .w207covsum') || {}).textContent || '',
      covh: (document.querySelector('#w205 [data-w207cov] h2') || {}).textContent || '',
      glanceHead: Array.from(document.querySelectorAll('#w205 [data-w205glance] th')).map(x => x.textContent),
      glance1: Array.from(document.querySelectorAll('#w205 [data-w205glance] tbody tr:first-child .w207mini i')).map(x => x.textContent),
      chips1: Array.from(document.querySelectorAll('[data-w207acts="101"] .w207chip')).map(c => c.querySelector('b').textContent + '|' + c.title),
      note4: (document.querySelector('[data-w205k="goal:104:activities_note"]') || {}).value,
      tgt1: (document.querySelector('[data-w205k^="target:"][data-w205k$=":body"]') || {}).value,
      cps1: Array.from(document.querySelectorAll('[data-w207yb="101"] .w207cp')).map(c => c.className + '|' + c.querySelector('textarea').value + '|' + c.querySelector('input.w207due').value),
      sel1: Array.from(document.querySelectorAll('[data-w207yb="101"] select.w207st')).map(s => s.disabled ? 'ro' : 'rw'),
      emdash: document.getElementById('w205').innerText.indexOf('—') >= 0
    };
  });
  ok(r.first >= 0 && r.first <= 4, 'admin: the This year view sits at the top of Goals (block ' + r.first + ')');
  ok(r.h2 === 'FY27 goals' && /This year.s goals: FY27 \(Oct 1, 2026 to Sep 30, 2027\)/.test(r.sub), 'admin: This year (FY27) with the plan\'s title: ' + r.sub);
  ok(JSON.stringify(r.now) === JSON.stringify(['Q1Now']), 'admin: the current quarter (Q1) is highlighted ' + JSON.stringify(r.now));
  ok(/Dec 31, 2026/.test(r.nextWhen) && /in 88 days/.test(r.nextWhen) && r.next.length === 5 && r.next[0] === TARGETS[0][3][0], 'admin: Due next is Dec 31, 2026 (in 88 days) with the five Q1 checkpoints: ' + r.nextWhen);
  ok(/ok/.test(r.late), 'admin: nothing overdue on Oct 4');
  ok(r.rows.length === 5 && r.rows.every((row, i) => row[1].indexOf(TARGETS[i][1]) >= 0 && row[2].indexOf(TARGETS[i][3][0]) >= 0 && row[5].indexOf(TARGETS[i][3][3]) >= 0 && row[6] === TARGETS[i][2]), 'admin: the FY27 table carries each goal\'s target, Q1 to Q4 and owners, in the plan\'s words');
  ok(/^Q1/.test(r.thNow) && r.tdNow === 5, 'admin: the Q1 column is highlighted (' + r.thNow + ')');
  ok(/0 of 20 checkpoints done/.test(r.note) && /fixed by outside dates/.test(r.note), 'admin: the count and the plan\'s note under the table');
  ok(r.covh === '8 activities' && r.cov.length === 8 && r.gaps === 0 && /All 8 covered/.test(r.covsum), 'admin: the 8 activities strip, every activity covered (' + r.covsum.trim() + ')');
  ok(r.cov[0] === '1:3,4' && r.cov[5] === '6:3,5' && r.cov[6] === '7:1,4' && r.cov[2] === '3:1', 'admin: each activity lists the goals the plan names (1: 3, 4; 6: 3, 5; 7: 1, 4)');
  ok(r.glanceHead.indexOf('Charitable activities') >= 0 && JSON.stringify(r.glance1) === '["3","4","7"]', 'admin: the at-a-glance table has the activities column (goal 1: 3, 4, 7)');
  ok(r.chips1.length === 3 && /^3\|3\. Address food insecurity with free, healthy meals: free, healthy meals$/.test(r.chips1[0]), 'admin: goal 1 shows its activities as chips, the reason on hover: ' + r.chips1[0]);
  ok(r.note4 === 'It funds all eight.', 'admin: goal 4 keeps the plan\'s note (It funds all eight.)');
  ok(r.tgt1 === TARGETS[0][1] && r.cps1.length === 4 && /now/.test(r.cps1[0]) && r.cps1[0].indexOf('|2026-12-31') > 0 && r.cps1[3].indexOf('|2027-09-30') > 0, 'admin: goal 1\'s card holds its FY27 target and Q1 to Q4 with their due dates, Q1 marked now');
  ok(r.sel1.every(x => x === 'rw'), 'admin: an admin edits the checkpoints');
  ok(!r.emdash, 'admin: no em dash on the page');
  await shot(f, 'w207-goals-fy27-activities', { clip: { x: 0, y: 0, width: 1366, height: 2700 }, fullPage: true });

  /* tap a chip: the reason; tap again: gone */
  await f.ev(() => document.querySelector('[data-w207acts="101"] .w207chip').scrollIntoView({ block: 'center' }));
  await f.page.click('[data-w207acts="101"] .w207chip'); await f.page.waitForTimeout(200);
  r = await f.ev(() => ({ tip: (document.querySelector('[data-w207acts="101"] .w207tip') || {}).textContent || '', exp: document.querySelector('[data-w207acts="101"] .w207chip').getAttribute('aria-expanded') }));
  ok(/Why this goal serves it: free, healthy meals/.test(r.tip) && r.exp === 'true', 'chip: a tap shows why the goal serves the activity');
  await f.page.click('[data-w207acts="101"] .w207chip'); await f.page.waitForTimeout(200);
  r = await f.ev(() => !!document.querySelector('[data-w207acts="101"] .w207tip'));
  ok(!r, 'chip: a second tap closes it');

  /* autosave on a checkpoint: status, words, due date; the target's owners */
  await f.ev(() => { const s = document.querySelector('[data-w207yb="101"] select.w207st'); s.value = 'on track'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await f.page.waitForTimeout(500);
  let cs = await calls(f, 'strategy_save');
  ok(cs.length === 1 && cs[0].args.p_entity === 'checkpoint' && cs[0].args.p_field === 'status' && cs[0].args.p_value === 'on track' && cs[0].args.p_old === 'not started', 'checkpoint: the status saves at once with the value the page started from');
  r = await f.ev(() => ({ cls: document.querySelector('[data-w207yb="101"] select.w207st').className, pill: (document.querySelector('#w205 .w207grid tbody tr:first-child td.now .w207pill') || {}).textContent }));
  ok(/s-onTrack/.test(r.cls) && r.pill === 'On track', 'checkpoint: the card and the This year table show On track');
  const k1 = await f.ev(() => document.querySelector('[data-w207yb="101"] .w207cp textarea').getAttribute('data-w205k'));
  await f.page.click('[data-w205k="' + k1 + '"]'); await f.page.keyboard.press('End'); await f.page.keyboard.type(', Montreal and Toronto', { delay: 10 });
  await f.page.waitForTimeout(1300);
  cs = await calls(f, 'strategy_save');
  ok(cs.length === 2 && cs[1].args.p_field === 'body' && cs[1].args.p_old === TARGETS[0][3][0] && cs[1].args.p_value === TARGETS[0][3][0] + ', Montreal and Toronto', 'checkpoint: its words autosave after the pause');
  const kd = k1.replace(':body', ':due_date');
  await f.ev(k => { const i = document.querySelector('[data-w205k="' + k + '"]'); i.value = '2026-12-15'; i.dispatchEvent(new Event('input', { bubbles: true })); }, kd);
  await f.page.waitForTimeout(1300);
  cs = await calls(f, 'strategy_save');
  ok(cs.length === 3 && cs[2].args.p_field === 'due_date' && cs[2].args.p_value === '2026-12-15' && cs[2].args.p_old === '2026-12-31', 'checkpoint: the due date saves');
  const ko = await f.ev(() => document.querySelector('[data-w207yb="101"] [data-w205k$=":owners"]').getAttribute('data-w205k'));
  await f.page.click('[data-w205k="' + ko + '"]'); await f.page.keyboard.press('End'); await f.page.keyboard.type(', Ian', { delay: 10 }); await f.page.keyboard.press('Enter');
  await f.page.waitForTimeout(500);
  cs = await calls(f, 'strategy_save');
  ok(cs.length === 4 && cs[3].args.p_entity === 'target' && cs[3].args.p_field === 'owners' && cs[3].args.p_value === 'Shima, Suhaib, Ian', 'target: who reports on it saves (Enter leaves the box)');
  r = await f.ev(() => (document.querySelector('#w205 .w207grid tbody tr:first-child td:last-child') || {}).textContent);
  ok(r === 'Shima, Suhaib, Ian', 'target: the This year table follows');

  /* someone else's save arrives live */
  await f.ev(() => { const c = window.w205.state().checkpoints.filter(x => x.goal_id === 103 && x.quarter === 1)[0]; window.__w205ch.fire('postgres_changes', 'goal_checkpoints', { eventType: 'UPDATE', new: Object.assign({}, c, { status: 'at risk', updated_by: 'ian.odhiambo@welfareavenue.com' }) }); });
  await f.page.waitForTimeout(300);
  r = await f.ev(() => ({ sel: document.querySelector('[data-w207yb="103"] select.w207st').value, pill: (document.querySelectorAll('#w205 .w207grid tbody tr')[2].querySelector('td.now .w207pill') || {}).textContent }));
  ok(r.sel === 'at risk' && r.pill === 'At risk', 'live: Ian\'s At risk on goal 3 lands in the card and the table');

  /* the activities: anchor goal 1 on activity 2, then take it off; the reason edits in place */
  await f.ev(() => { window.__w205rpc.strategy_activity_set = a => a.p_on ? { id: 599, goal_id: a.p_goal, activity_id: a.p_activity, reason: null, sort: 9, archived_at: null } : { id: 599, goal_id: a.p_goal, activity_id: a.p_activity, reason: null, sort: 9, archived_at: '2026-10-04T22:00:00Z' }; });
  await f.ev(() => document.querySelector('[data-w207manage="101"]').scrollIntoView({ block: 'center' }));
  await f.page.click('[data-w207manage="101"]'); await f.page.waitForTimeout(400);
  r = await f.ev(() => ({ open: document.getElementById('w205drawer').classList.contains('open'), boxes: document.querySelectorAll('#w205drawer [data-w207act]').length, on: Array.from(document.querySelectorAll('#w205drawer [data-w207act]:checked')).map(x => x.getAttribute('data-w207act')), reasons: document.querySelectorAll('#w205drawer textarea[data-w205k^="activity:"]').length }));
  ok(r.open && r.boxes === 8 && JSON.stringify(r.on) === '["3","4","7"]' && r.reasons === 3, 'activities: the sheet lists the 8, goal 1\'s three ticked, each with its reason');
  await f.page.click('#w205drawer [data-w207act="2"]'); await f.page.waitForTimeout(400);
  cs = await calls(f, 'strategy_activity_set');
  r = await f.ev(() => ({ chips: document.querySelectorAll('[data-w207acts="101"] .w207chip').length, cov: Array.from(document.querySelectorAll('#w205 .w207tile'))[1].textContent, hist: 0 }));
  ok(cs.length === 1 && cs[0].args.p_goal === 101 && cs[0].args.p_activity === 2 && cs[0].args.p_on === true && r.chips === 4 && /1/.test(r.cov), 'activities: ticking adds it (strategy_activity_set), the chips and the strip follow');
  const kr = 'activity:501:reason';
  await f.page.click('#w205drawer [data-w205k="' + kr + '"]'); await f.page.keyboard.press('End'); await f.page.keyboard.type(' at every service', { delay: 10 });
  await f.page.waitForTimeout(1300);
  cs = await calls(f, 'strategy_save');
  ok(cs.length === 5 && cs[4].args.p_entity === 'activity' && cs[4].args.p_field === 'reason' && cs[4].args.p_value === 'free, healthy meals at every service', 'activities: the reason autosaves from the sheet');
  await f.page.click('#w205drawer [data-w207act="2"]'); await f.page.waitForTimeout(400);
  cs = await calls(f, 'strategy_activity_set');
  r = await f.ev(() => document.querySelectorAll('[data-w207acts="101"] .w207chip').length);
  ok(cs.length === 2 && cs[1].args.p_on === false && r === 3, 'activities: unticking takes it off');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);

  /* comments on a checkpoint */
  await f.ev(() => { window.__w205rpc.strategy_checkpoint_comment_add = a => ({ id: 9800, goal_id: 101, checkpoint_id: a.p_checkpoint, parent_id: a.p_parent, body: a.p_body, author: 'Steel', author_email: 'steel.macdonald@welfareavenue.com', created_at: new Date().toISOString() }); });
  const cp1 = await f.ev(() => document.querySelector('[data-w207yb="101"] [data-w207cpcmts]').getAttribute('data-w207cpcmts'));
  await f.page.click('[data-w207cpcmts="' + cp1 + '"]'); await f.page.waitForTimeout(400);
  r = await f.ev(() => ({ sub: (document.querySelector('#w205drawer .acts small') || {}).textContent || '', ph: (document.querySelector('#w205drawer textarea[data-w205cmt="new"]') || {}).placeholder || '' }));
  ok(/^On FY27 Q1: Meal counts/.test(r.sub) && /checkpoint/.test(r.ph), 'comments: a checkpoint opens its own thread (' + r.sub.slice(0, 40) + ')');
  await f.ev(() => { document.querySelector('#w205drawer textarea[data-w205cmt="new"]').value = 'Logged at both Sunday services this week.'; });
  await f.page.click('#w205drawer [data-w205post]'); await f.page.waitForTimeout(500);
  cs = await calls(f, 'strategy_checkpoint_comment_add');
  r = await f.ev(c => ({ btn: (document.querySelector('[data-w207cpcmts="' + c + '"]') || {}).textContent || '', tag: (document.querySelector('#w205drawer .w205seg .on') || {}).textContent || '' }), cp1);
  ok(cs.length === 1 && String(cs[0].args.p_checkpoint) === cp1 && r.btn === '1' && /FY27 Q1/.test(r.tag), 'comments: posting goes through strategy_checkpoint_comment_add; the checkpoint counts 1');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);

  /* link a project to a checkpoint */
  const cp2 = await f.ev(() => document.querySelectorAll('[data-w207yb="102"] [data-w207cplink]')[2].getAttribute('data-w207cplink'));
  await f.ev(c => document.querySelector('[data-w207cplink="' + c + '"]').scrollIntoView({ block: 'center' }), cp2);
  await f.page.click('[data-w207cplink="' + cp2 + '"]'); await f.page.waitForTimeout(400);
  await f.page.click('#w205drawer [data-w205pickp="4"]'); await f.page.waitForTimeout(300);
  r = await f.ev(() => ({ cp: (document.querySelector('#w205drawer [data-w207pickc]:checked') || {}).getAttribute ? document.querySelector('#w205drawer [data-w207pickc]:checked').getAttribute('data-w207pickc') : '', n: document.querySelectorAll('#w205drawer [data-w207pickc]').length }));
  ok(r.cp === cp2 && r.n === 5, 'link: the sheet offers the goal\'s checkpoints, the one clicked already picked');
  await f.page.click('#w205drawer [data-w205dolink]'); await f.page.waitForTimeout(600);
  cs = await f.ev(() => window.__w205calls.filter(c => /strategy_link_/.test(c.fn)).map(c => c.fn + ':' + JSON.stringify(c.args)));
  r = await f.ev(c => Array.from(document.querySelectorAll('[data-w207cpft="' + c + '"] .w205pj')).map(x => x.textContent), cp2);
  ok(cs.length === 2 && /^strategy_link_project:.*"p_goal":102/.test(cs[0]) && cs[1] === 'strategy_link_checkpoint:{"p_project":4,"p_checkpoint":' + cp2 + '}' && r.indexOf('Beneficiary Feedback Project') >= 0, 'link: the project serves goal 2 and its Q3 checkpoint (strategy_link_checkpoint); its chip sits on the checkpoint');

  /* the history reads the new rows */
  await f.ev(() => { window.__WAFIX.goal_history.push({ id: 7101, goal_id: 101, entity: 'checkpoint', entity_id: 601, field: 'status', old_value: 'not started', new_value: 'on track', changed_by: 'shima.butera@welfareavenue.com', changed_by_name: 'Shima', changed_at: '2026-10-04T18:00:00+00:00' }, { id: 7102, goal_id: 101, entity: 'activity', entity_id: 501, field: 'reason', old_value: 'free, healthy meals', new_value: 'free meals', changed_by: 'shima.butera@welfareavenue.com', changed_by_name: 'Shima', changed_at: '2026-10-04T18:05:00+00:00' }, { id: 7103, goal_id: 101, entity: 'activity', entity_id: 512, field: 'added', new_value: '2. Relieve poverty by providing basic necessities', changed_by: 'shima.butera@welfareavenue.com', changed_by_name: 'Shima', changed_at: '2026-10-04T18:06:00+00:00' }); });
  await f.page.click('[data-w205hist="101"]'); await f.page.waitForTimeout(700);
  r = await f.ev(() => ({ t: (document.getElementById('w205drawer') || {}).innerText || '', rs: document.querySelectorAll('#w205drawer [data-w205restore]').length }));
  ok(/changed a checkpoint.s status/.test(r.t) && /FY27 Q1/.test(r.t) && /changed why it serves a charitable activity/.test(r.t) && /anchored the goal on a charitable activity/.test(r.t) && r.rs >= 3, 'history: checkpoint and activity changes read in words, with Restore');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
  ok(f.errs.length === 0, 'admin: no page errors' + (f.errs.length ? ' (' + f.errs.join(' | ') + ')' : ''));
  await f.close();

  /* ================= overdue: 15 Jan 2027 (Q2), nothing done ================= */
  f = await boot(b, 'admin', 1366, '#orggoals', '2027-01-15');
  r = await f.ev(() => ({
    now: Array.from(document.querySelectorAll('#w205 .w207q.now b')).map(x => x.textContent),
    late: Array.from(document.querySelectorAll('#w205 [data-w207overdue] .w207it')).length, lateCls: (document.querySelector('#w205 [data-w207overdue]') || {}).className,
    nextWhen: (document.querySelector('#w205 [data-w207next] .when') || {}).textContent || '',
    lateCells: document.querySelectorAll('#w205 .w207grid td.late').length,
    card: (document.querySelector('[data-w207yb="101"] .w207cp') || {}).className || '', cardTxt: (document.querySelector('[data-w207yb="101"] .w207cp .w207late') || {}).textContent || '',
    pill: (document.querySelector('#w205 .w207grid td.late .w207pill') || {}).textContent
  }));
  ok(JSON.stringify(r.now) === '["Q2Now"]' && /Mar 31, 2027/.test(r.nextWhen), 'overdue: on Jan 15, 2027 Q2 is current and Mar 31 is due next');
  ok(/late/.test(r.lateCls) && r.late === 5 && r.lateCells === 5 && r.pill === 'Overdue', 'overdue: the five Q1 checkpoints not done are flagged Overdue in the box and the table');
  ok(/late/.test(r.card) && r.cardTxt === 'Overdue', 'overdue: the goal card flags its Q1 checkpoint');
  await f.ev(() => { const c = window.w205.state().checkpoints.filter(x => x.goal_id === 101 && x.quarter === 1)[0]; window.__w205ch.fire('postgres_changes', 'goal_checkpoints', { eventType: 'UPDATE', new: Object.assign({}, c, { status: 'done', updated_by: 'shima.butera@welfareavenue.com' }) }); });
  await f.page.waitForTimeout(300);
  r = await f.ev(() => ({ late: document.querySelectorAll('#w205 [data-w207overdue] .w207it').length, card: document.querySelector('[data-w207yb="101"] .w207cp').className }));
  ok(r.late === 4 && !/late/.test(r.card) && /done/.test(r.card), 'overdue: once done it leaves the overdue list');
  await f.close();

  /* ================= leader (Shima: owner of 1, 2, 5) ================= */
  f = await boot(b, 'leader');
  r = await f.ev(() => ({ me: (window.USER || {}).email, g1: Array.from(document.querySelectorAll('[data-w207yb="101"] select.w207st')).every(s => !s.disabled), g3: Array.from(document.querySelectorAll('[data-w207yb="103"] select.w207st')).every(s => s.disabled), m1: !!document.querySelector('[data-w207manage="101"]'), m3: !!document.querySelector('[data-w207manage="103"]'), due3: document.querySelector('[data-w207yb="103"] input.w207due').readOnly, link: document.querySelectorAll('[data-w207cplink]').length }));
  ok(r.g1 && r.g3 && r.m1 && !r.m3 && r.due3, 'leader (' + r.me + '): edits the checkpoints and activities of the goals she owns, reads the others');
  ok(r.link === 20, 'leader: may link projects to any checkpoint (staff who comment)');
  ok(f.errs.length === 0, 'leader: no page errors' + (f.errs.length ? ' (' + f.errs.join(' | ') + ')' : ''));
  await f.close();

  /* ================= member (Samson) ================= */
  f = await boot(b, 'member');
  r = await f.ev(() => ({ year: !!document.querySelector('#w205 [data-w207year] .w207grid'), sel: Array.from(document.querySelectorAll('#w205 select.w207st')).every(s => s.disabled), ro: Array.from(document.querySelectorAll('#w205 [data-w205k^="checkpoint:"][data-w205k$=":body"]')).every(t => t.readOnly), manage: document.querySelectorAll('[data-w207manage]').length, cmt: document.querySelectorAll('[data-w207cpcmts]').length, link: document.querySelectorAll('[data-w207cplink]').length, cov: document.querySelectorAll('.w207tile').length }));
  ok(r.year && r.sel && r.ro && r.manage === 0 && r.cov === 8, 'member: reads This year and the activities; no editing');
  ok(r.cmt === 20 && r.link === 20, 'member: comments on checkpoints and links projects');
  ok(f.errs.length === 0, 'member: no page errors' + (f.errs.length ? ' (' + f.errs.join(' | ') + ')' : ''));
  await f.close();

  /* ================= board viewer ================= */
  f = await boot(b, 'board');
  r = await f.ev(() => ({ year: document.querySelectorAll('#w205 .w207grid tbody tr').length, cov: document.querySelectorAll('.w207tile').length, chips: document.querySelectorAll('.w207chip').length, sel: Array.from(document.querySelectorAll('#w205 select.w207st')).every(s => s.disabled), manage: document.querySelectorAll('[data-w207manage]').length, link: document.querySelectorAll('[data-w207cplink]').length, note: !!document.querySelector('[data-w205k="goal:104:activities_note"]'), noteTxt: Array.from(document.querySelectorAll('.w207note')).map(n => n.textContent).join('|') }));
  ok(r.year === 5 && r.cov === 8 && r.chips === 11, 'board: reads This year (5 goals), the 8 activities and the 11 chips');
  ok(r.sel && r.manage === 0 && r.link === 0 && !r.note && /It funds all eight\./.test(r.noteTxt), 'board: read only (no status, no linking, the note as text)');
  ok(f.errs.length === 0, 'board: no page errors' + (f.errs.length ? ' (' + f.errs.join(' | ') + ')' : ''));
  await f.close();

  /* ================= phone 390 ================= */
  f = await boot(b, 'admin', 390);
  r = await f.ev(() => ({ sw: document.scrollingElement.scrollWidth, vw: window.innerWidth, thead: getComputedStyle(document.querySelector('#w205 .w207grid thead')).display, yr: document.querySelector('#w205 [data-w207year]').getBoundingClientRect().width, cov: getComputedStyle(document.querySelector('.w207cov')).gridTemplateColumns.split(' ').length, cps: getComputedStyle(document.querySelector('.w207cps')).gridTemplateColumns.split(' ').length }));
  ok(r.sw <= r.vw + 1 && r.yr <= r.vw, 'phone: no sideways scroll on Goals (' + r.sw + '/' + r.vw + ')');
  ok(r.thead === 'none' && r.cov === 1 && r.cps === 1, 'phone: the FY27 table, the activities and the checkpoints stack');
  await f.ev(() => document.querySelector('[data-w207acts="101"] .w207chip').scrollIntoView({ block: 'center' }));
  await f.page.tap('[data-w207acts="101"] .w207chip'); await f.page.waitForTimeout(200);
  r = await f.ev(() => !!document.querySelector('[data-w207acts="101"] .w207tip'));
  ok(r, 'phone: a tap on a chip shows the reason');
  ok(f.errs.length === 0, 'phone: no page errors' + (f.errs.length ? ' (' + f.errs.join(' | ') + ')' : ''));
  await f.close();
}

async function project(b, who, width) {
  const tag = 'project ' + who + ' @' + width;
  const f = await boot(b, who, width, '#project/31');
  let r = await f.ev(() => ({ h2: (document.querySelector('#projectpage .card h2') || {}).textContent || '', from: (document.querySelector('#projectpage .w207from') || {}).textContent || '', sibs: Array.from(document.querySelectorAll('#projectpage .w207from .pj')).map(x => x.textContent), link: !!document.querySelector('#projectpage [data-w207link]'), rows: document.querySelectorAll('#projectpage .w27-task').length, prog: (document.querySelector('#w104') || {}).textContent || '' }));
  ok(/beneficiary feedback/i.test(r.h2) && /Made from the retired department goal/.test(r.from) && /started with no tasks/.test(r.from), tag + ': the empty project says it was made from a retired goal');
  ok(r.sibs.length === 2 && r.sibs.some(s => /Beneficiary Feedback Project 2 open/.test(s)) && r.sibs.some(s => /Survey Project/.test(s)), tag + ': it lists the team\'s projects on the same goal with their open tasks: ' + r.sibs.join(' / '));
  if (who === 'board') { ok(!r.link, tag + ': no Link existing tasks for a board viewer'); ok(f.errs.length === 0, tag + ': no page errors' + (f.errs.length ? ' (' + f.errs.join(' | ') + ')' : '')); await f.close(); return; }
  ok(r.link && r.rows === 0, tag + ': Link existing tasks is offered on the empty project');
  await f.page.click('#projectpage [data-w207link]'); await f.page.waitForTimeout(700);
  r = await f.ev(() => ({ open: !!document.getElementById('w207sheet'), items: Array.from(document.querySelectorAll('#w207list label')).map(l => l.textContent), team: (document.getElementById('w207team') || {}).value, w: document.getElementById('modalBox').getBoundingClientRect().width, vw: window.innerWidth, sw: document.scrollingElement.scrollWidth }));
  const t311 = r.items.find(x => /Enforce beneficiary data capture/.test(x)) || '', t622 = r.items.find(x => /softball/.test(x)) || '';
  ok(r.open && /moves from Beneficiary Feedback Project/.test(t311) && /no project yet/.test(t622) && r.items.every(x => !/#93/.test(x) || true), tag + ': the picker lists the team\'s open tasks not in the project, saying where each one sits');
  ok(r.items.length >= 4 && r.items.length <= 30, tag + ': only this team\'s tasks by default (' + r.items.length + ')');
  if (width < 700) ok(r.w <= r.vw + 1 && r.sw <= r.vw + 1, tag + ': the picker fits the phone (' + Math.round(r.w) + '/' + r.vw + ')');
  await f.page.fill('#w207q', 'softball'); await f.page.waitForTimeout(400);
  r = await f.ev(() => document.querySelectorAll('#w207list label').length);
  ok(r === 1, tag + ': search narrows the list');
  await f.ev(() => document.querySelector('#w207list input[data-w207pick="9622"]').click());
  await f.page.fill('#w207q', ''); await f.page.waitForTimeout(400);
  await f.ev(() => document.querySelector('#w207list input[data-w207pick="9311"]').click());
  r = await f.ev(() => ({ btn: document.querySelector('#w207sheet [data-w207do]').textContent, kept: document.querySelector('#w207list input[data-w207pick="9622"]').checked }));
  ok(r.btn === 'Link 2 tasks' && r.kept, tag + ': picks survive a search (' + r.btn + ')');
  await f.page.click('#w207sheet [data-w207do]'); await f.page.waitForTimeout(1500);
  r = await f.ev(() => ({ db: window.__WAFIX.dept_tasks.filter(t => t.project_id === 31).map(t => t.id).sort(), log: (window.__WAFIX.change_log || []).filter(c => c.field === 'project_id' && /project page/.test(c.new_value || '')).map(c => c.entity_id + ':' + c.old_value), rows: document.querySelectorAll('#projectpage .w27-task').length, sheet: !!document.getElementById('w207sheet') }));
  ok(JSON.stringify(r.db) === '[9311,9622]' && r.log.sort().join(',') === '9311:4,9622:null' && !r.sheet, tag + ': both tasks link to the project, each with a change_log line (from project 4, from none)');
  ok(r.rows === 2, tag + ': the project page repaints with its two tasks');
  /* the title opens the department drawer, with the bank */
  await f.ev(() => document.querySelector('#projectpage [data-w206open="9311"]').scrollIntoView({ block: 'center' }));
  await f.page.click('#projectpage [data-w206open="9311"]'); await f.page.waitForTimeout(1000);
  r = await f.ev(() => ({ open: document.getElementById('w116dr').classList.contains('open'), head: (document.querySelector('#w116dr .w116drh') || {}).textContent || '', txt: (document.getElementById('w116dr') || {}).innerText || '' }));
  ok(r.open && /#9311/.test(r.head) && /bank/i.test(r.txt), tag + ': the task opens in the team pages\' drawer, Move to the bank included');
  if (SHOTS && who === 'admin' && width >= 700) await shot(f, 'w207-task-sheet-from-project');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(500);
  /* ticking: toggleTask, Undo */
  await f.ev(() => document.querySelector('#projectpage input[data-w27t="9622"]').scrollIntoView({ block: 'center' }));
  await f.page.click('#projectpage input[data-w27t="9622"]'); await f.page.waitForTimeout(1200);
  r = await f.ev(() => { const row = document.querySelector('#projectpage input[data-w27t="9622"]').closest('.w27-task'); return { done: window.__WAFIX.dept_tasks.find(t => t.id === 9622).done, cls: row.className, undo: !!row.querySelector('[data-w207undo]'), log: (window.__WAFIX.change_log || []).filter(c => c.entity_type === 'dept_task' && c.entity_id === '9622' && c.field === 'done').length, oldLog: (window.__WAFIX.change_log || []).filter(c => c.entity_type === 'task' && c.entity_id === '9622').length, drawer: document.getElementById('w116dr').classList.contains('open') }; });
  ok(r.done === true && /done/.test(r.cls) && r.undo && !r.drawer, tag + ': ticking marks it done, with Undo on the row, and opens nothing');
  ok(r.log === 1 && r.oldLog === 0, tag + ': the tick went through toggleTask (its dept_task change_log line), not the old project-page save');
  await f.page.click('#projectpage [data-w207undo="9622"]'); await f.page.waitForTimeout(1300);
  r = await f.ev(() => ({ done: window.__WAFIX.dept_tasks.find(t => t.id === 9622).done, open: !!document.querySelector('#projectpage .w27-task:not(.done) input[data-w27t="9622"]'), st: window.w207p.state() }));
  ok(r.done === false && r.open && r.st.undos === 1, tag + ': Undo reopens it through toggleTask');
  if (who === 'admin' && width >= 700) {
    await f.page.click('#projectpage input[data-w27t="9311"]'); await f.page.waitForTimeout(11000);
    r = await f.ev(() => ({ inDone: !!document.querySelector('#projectpage details.completed input[data-w27t="9311"]'), undo: !!document.querySelector('#projectpage [data-w207undo]') }));
    ok(r.inDone && !r.undo, tag + ': ten seconds later the done task moves to Completed and Undo goes');
  }
  r = await f.ev(() => ({ menuAfter: window.w163 ? window.w163.state().after : 0 }));
  ok(r.menuAfter === 0, tag + ': the menu shows once');
  ok(f.errs.length === 0, tag + ': no page errors' + (f.errs.length ? ' (' + f.errs.join(' | ') + ')' : ''));
  await f.close();
}

(async () => {
  const b = await launch();
  const only = process.env.ONLY || '';
  if (!only || only === 'goals') { try { await goals(b); } catch (e) { fail++; console.log('FAIL goals threw: ' + String(e && e.stack || e).slice(0, 2000)); } }
  if (!only || only === 'project') {
    for (const [who, w] of [['admin', 1366], ['member', 1366], ['leader', 1366], ['admin', 390], ['board', 1366]]) { try { await project(b, who, w); } catch (e) { fail++; console.log('FAIL project ' + who + ' @' + w + ' threw: ' + String(e && e.stack || e).slice(0, 2000)); } }
  }
  await b.close();
  console.log('w207drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
