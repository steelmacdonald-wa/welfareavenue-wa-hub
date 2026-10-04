/* w205drive.js (wave205): the Strategy app rebuilt; the organizational goals edited live.
   CAND=build/<file>.html node test/w205drive.js   (SHOTS=<dir> also saves screenshots)
   The fixture is test/w205fixture.js (the approved draft's goals on top of fixture.json). The page's calls to the strategy_*
   functions are caught and answered in the page (window.__w205rpc), and Realtime is a fake channel the test drives
   (presence sync, postgres_changes), so every check runs offline and nothing reaches the database. */
const { launch, fresh } = require('./boot');
const { build } = require('./w205fixture');
const fs = require('fs');
const SEED = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../build/data/wa205_seed.json'), 'utf8'));
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } }

/* the page side: catch the rpc calls and the realtime channel */
const INIT = `(function(){
  window.__w205calls = []; window.__w205rpc = {}; window.__w205ps = {};
  function patch(c){
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
      ch.track = function (m) { ch.tracked.push(m); return Promise.resolve('ok'); };
      ch.untrack = function () { return Promise.resolve('ok'); };
      ch.presenceState = function () { return window.__w205ps; };
      ch.unsubscribe = function () { ch.subscribed = false; return Promise.resolve('ok'); };
      ch.fire = function (type, a, b) { ch.handlers.forEach(function (h) { if (h.type !== type) return; if (type === 'postgres_changes' && h.filter.table !== a) return; if (type === 'presence' && h.filter.event !== a) return; h.cb(b || {}); }); };
      window.__w205ch = ch; window.__w205chans = (window.__w205chans || 0) + 1;
      return ch;
    };
    c.removeChannel = function (ch) { ch.removed = true; return Promise.resolve('ok'); };
    return c;
  }
  var sb;
  Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return sb; }, set: function (v) {
    sb = v; var cc = v && v.createClient; if (!cc || cc.__w205) return;
    v.createClient = function () { return patch(cc.apply(this, arguments)); }; v.createClient.__w205 = true;
  } });
})();`;

async function boot(browser, who, width, hash, fx) {
  return fresh(browser, { who, width: width || 1366, hash: hash || '#orggoals', fixture: fx || build(), init: INIT, wait: 4200 });
}
const calls = f => f.ev(() => window.__w205calls.slice());
const shot = async (f, name, full) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: !!full }); };

(async () => {
  const browser = await launch();
  const G = n => 100 + n;

  /* ================= admin (Steel), desktop ================= */
  let f = await boot(browser, 'admin');
  let r = await f.ev(() => ({
    rail: Array.from(document.querySelectorAll('#w153rail .w153it')).map(a => a.textContent.trim() + (a.classList.contains('on') ? '*' : '')),
    h1: (document.querySelector('#w205 h1') || {}).textContent,
    mission: (document.querySelector('#w205 .w205hero blockquote') || {}).textContent,
    badge: (document.querySelector('#w205 .w205badge') || {}).textContent,
    cards: Array.from(document.querySelectorAll('#w205 .w205goal')).map(c => c.querySelector('textarea[data-w205k$=":title"]').value),
    glance: document.querySelectorAll('#w205 [data-w205glance] tbody tr').length,
    glance29: Array.from(document.querySelectorAll('#w205 [data-w205glance] td.t29')).map(x => x.textContent),
    ms: document.querySelectorAll('#w205 .w205ms').length, paths: document.querySelectorAll('#w205 .w205paths li').length,
    years: Array.from(document.querySelectorAll('#w205g-101 .w205yr .yh b')).map(b => b.textContent),
    rw: document.querySelectorAll('#w205 textarea.w205ed:not([readonly])').length,
    approve: !!document.querySelector('#w205 [data-w205approve="approved"]'),
    road: Array.from(document.querySelectorAll('#w205 .w205ph .k')).map(x => x.textContent),
    gate: Array.from(document.querySelectorAll('#w205 .w205mk.gt li')).map(x => x.textContent),
    checkpoint: Array.from(document.querySelectorAll('#w205 .w205mk:not(.gt) li')).map(x => x.textContent),
    gateVisible: (() => { const g = document.querySelector('#w205 .w205mk.gt'); return !!(g && g.offsetParent); })(),
    lib: document.querySelectorAll('#w205 .w205lib .w205doc').length,
    unlinked: document.querySelectorAll('#w205 [data-w205unlinked] .it').length,
    owners1: Array.from(document.querySelectorAll('[data-w205owners="101"] .w205chip:not(.add)')).map(x => x.textContent),
    retiredTile: (document.querySelector('[data-w205go="#orggoals/retired"]') || {}).textContent || '',
    cache: (typeof GOALS_CACHE !== 'undefined') ? GOALS_CACHE.filter(g => g.retired_at).length : -1,
    emdash: document.getElementById('w205').innerText.indexOf('—') >= 0,
    live: window.w205.live()
  }));
  ok(JSON.stringify(r.rail) === JSON.stringify(['Goals*', 'Projects', 'Goal alignment', 'Strategy Library']), 'admin: the Strategy rail is Goals, Projects, Goal alignment, Strategy Library (no Department goals) ' + JSON.stringify(r.rail));
  ok(r.h1 === 'Goals', 'admin: the page title is Goals');
  ok((r.mission || '').indexOf('youth-powered non-profit dedicated to fighting food insecurity') >= 0, 'admin: the mission is at the top');
  ok((r.badge || '').indexOf('Draft for board approval (19 Oct 2026)') >= 0, 'admin: the goals are marked Draft for board approval (19 Oct 2026)');
  ok(JSON.stringify(r.cards) === JSON.stringify(SEED.goals.map(g => g.title)), 'admin: the five goals as cards, in order: ' + r.cards.join(' | '));
  ok(r.glance === 5 && JSON.stringify(r.glance29) === JSON.stringify(SEED.goals.map(g => g.target_fy29)), 'admin: at a glance has the five FY29 targets from the draft');
  ok(r.ms === 53 && r.paths === 20, 'admin: 53 milestones and 20 paths, as the draft has them (' + r.ms + ', ' + r.paths + ')');
  ok(JSON.stringify(r.years) === JSON.stringify(['FY27', 'FY28', 'FY29', 'FY31']), 'admin: milestones by year FY27, FY28, FY29, FY31');
  ok(r.rw > 100, 'admin: every field is editable (' + r.rw + ' fields)');
  ok(r.approve, 'admin: Mark approved by the board is offered to an admin');
  ok(r.road.length === 4 && r.road[0] === 'FY27 Stabilize' && r.checkpoint.length === 3 && r.gate.length === 4 && r.gateVisible, 'admin: the roadmap has 4 phases, the checkpoint (3) and the FY29 gate (4), visible');
  ok(r.lib === 6, 'admin: the pinned Strategy Library on the Goals page (6 shown)');
  ok(r.unlinked >= 1, 'admin: projects not linked to a goal yet are listed with Link (' + r.unlinked + ')');
  ok(r.owners1.length === 2 && /Shima/.test(r.owners1[0]) && /Lead/.test(r.owners1[0]) && /Suhaib/.test(r.owners1[1]) && /Toronto/.test(r.owners1[1]), 'admin: goal 1 owners are Shima (lead) and Suhaib (Toronto)');
  ok(/Retired goals \(\d+\)/.test(r.retiredTile), 'admin: Retired goals is one click away: ' + r.retiredTile.slice(0, 22));
  ok(r.cache === 0, 'admin: the older pages no longer see retired goals (GOALS_CACHE)');
  ok(!r.emdash, 'admin: no em dash on the page');
  ok(r.live.channel && r.live.live, 'admin: the page is live (a Realtime channel subscribed)');
  await shot(f, 'w205_admin_goals');

  /* click-to-edit with autosave: debounced, one call, the old value as the check */
  const why1 = SEED.goals[0].why;
  await f.page.click('[data-w205k="goal:101:why"]');
  await f.page.keyboard.press('Control+End');
  await f.page.keyboard.type(' Every service counts.', { delay: 15 });
  let mid = await f.ev(() => ({ calls: window.__w205calls.filter(c => c.fn === 'strategy_save').length, saved: document.querySelector('[data-w205saved="101"]').textContent }));
  ok(mid.calls === 0 && /Editing|Saving/.test(mid.saved), 'autosave: nothing is sent while typing; the card says ' + mid.saved);
  await f.page.waitForTimeout(1200);
  let cs = (await calls(f)).filter(c => c.fn === 'strategy_save');
  ok(cs.length === 1 && cs[0].args.p_entity === 'goal' && cs[0].args.p_id === 101 && cs[0].args.p_field === 'why' && cs[0].args.p_old === why1 && cs[0].args.p_value === why1 + ' Every service counts.', 'autosave: one save after the pause, with the value the page started from');
  let saved = await f.ev(() => document.querySelector('[data-w205saved="101"]').textContent);
  ok(saved === 'Saved', 'autosave: a quiet Saved');
  /* the next edit carries the new value as its check */
  await f.page.keyboard.type(' Twice.', { delay: 10 });
  await f.page.click('#w205 h1'); await f.page.waitForTimeout(400);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_save');
  ok(cs.length === 2 && cs[1].args.p_old === why1 + ' Every service counts.', 'autosave: leaving the box saves at once; the next check is the last saved value');

  /* someone else saved the same field first: their words and mine, nothing lost */
  await f.ev(() => { window.__w205rpc.strategy_save = function (a) { if (a.p_field === 'detail') return { ok: false, conflict: true, current: 'Ian’s version of the SMART statement.', by: 'Ian', at: '2026-10-04T15:00:00Z' }; return { ok: true, value: a.p_value }; }; });
  await f.page.click('[data-w205k="goal:101:detail"]'); await f.page.keyboard.press('Control+End'); await f.page.keyboard.type(' (mine)', { delay: 10 });
  await f.page.waitForTimeout(1200);
  r = await f.ev(() => ({ note: (document.querySelector('.w205conf[data-for="goal:101:detail"]') || {}).textContent || '', val: document.querySelector('[data-w205k="goal:101:detail"]').value }));
  ok(/Ian just changed this/.test(r.note) && /Ian’s version/.test(r.note), 'conflict: "Ian just changed this" with their version');
  ok(/\(mine\)$/.test(r.val), 'conflict: my words stay in the box');
  await shot(f, 'w205_conflict');
  await f.ev(() => { window.__w205rpc.strategy_save = function (a) { return { ok: true, value: a.p_value }; }; });
  await f.page.click('[data-w205keep="goal:101:detail"]'); await f.page.waitForTimeout(500);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_save' && c.args.p_field === 'detail');
  ok(cs.length === 2 && cs[1].args.p_old === 'Ian’s version of the SMART statement.' && /\(mine\)$/.test(cs[1].args.p_value), 'conflict: Keep mine saves over their version, checked against it');

  /* live: another person's save arrives without a refresh */
  await f.ev(() => { var g = window.w205.state().goals[2]; var row = Object.assign({}, g, { baseline: '13% (FY26), confirmed', updated_by: 'ian.odhiambo@welfareavenue.com', updated_at: new Date().toISOString() }); window.__w205ch.fire('postgres_changes', 'goals', { eventType: 'UPDATE', new: row }); });
  await f.page.waitForTimeout(200);
  r = await f.ev(() => ({ v: document.querySelector('[data-w205k="goal:103:baseline"]').value, fl: document.querySelector('[data-w205k="goal:103:baseline"]').classList.contains('flash'), gl: document.querySelector('[data-w205glance] tr[data-w205jump="103"]').textContent }));
  ok(r.v === '13% (FY26), confirmed' && r.fl, 'live: Ian’s save shows in the field at once, highlighted');
  ok(r.gl.indexOf('13% (FY26), confirmed') >= 0, 'live: at a glance follows');
  /* live while I am typing in that very field: a notice, my words kept */
  await f.page.click('[data-w205k="goal:103:why"]'); await f.page.keyboard.press('Control+End'); await f.page.keyboard.type(' Mine too.', { delay: 10 });
  await f.ev(() => { var g = window.w205.state().goals[2]; window.__w205ch.fire('postgres_changes', 'goals', { eventType: 'UPDATE', new: Object.assign({}, g, { why: 'Ian rewrote the why.', updated_by: 'ian.odhiambo@welfareavenue.com' }) }); });
  await f.page.waitForTimeout(150);
  r = await f.ev(() => ({ note: (document.querySelector('.w205conf[data-for="goal:103:why"]') || {}).textContent || '', val: document.querySelector('[data-w205k="goal:103:why"]').value }));
  ok(/Ian just changed this/.test(r.note) && /Mine too\.$/.test(r.val), 'live: a save to the field I am typing in shows as a notice; my words stay');
  await f.page.click('[data-w205theirs="goal:103:why"]'); await f.page.waitForTimeout(150);
  r = await f.ev(() => document.querySelector('[data-w205k="goal:103:why"]').value);
  ok(r === 'Ian rewrote the why.', 'live: Use theirs takes their words');
  /* live: a milestone status and a new path from someone else */
  await f.ev(() => { var m = window.w205.state().milestones.filter(x => x.goal_id === 102)[0]; window.__w205ch.fire('postgres_changes', 'goal_milestones', { eventType: 'UPDATE', new: Object.assign({}, m, { status: 'done', updated_by: 'shima.butera@welfareavenue.com' }) }); window.__w205ch.fire('postgres_changes', 'goal_paths', { eventType: 'INSERT', new: { id: 2999, goal_id: 102, sort: 9, body: 'A new path from Shima.', archived_at: null, updated_by: 'shima.butera@welfareavenue.com' } }); });
  await f.page.waitForTimeout(250);
  r = await f.ev(() => ({ done: document.querySelectorAll('#w205g-102 .w205ms.done').length, prog: document.querySelector('[data-w205prog="102"]').textContent, path: !!document.querySelector('[data-w205k="path:2999:body"]') }));
  ok(r.done === 1 && /1 of 6/.test(r.prog) && r.path, 'live: a milestone done and a new path arrive; progress moves (' + r.prog.slice(0, 40) + ')');

  /* presence: who is here and which goal they are in */
  await f.ev(() => { window.__w205ps = { 'ian.odhiambo@welfareavenue.com': [{ email: 'ian.odhiambo@welfareavenue.com', name: 'Ian', goal: '101', field: 'goal:101:detail', at: Date.now() }], 'shima.butera@welfareavenue.com': [{ email: 'shima.butera@welfareavenue.com', name: 'Shima', goal: '102', field: null, at: Date.now() }], 'steel.macdonald@welfareavenue.com': [{ email: 'steel.macdonald@welfareavenue.com', name: 'Steel', goal: null }] }; window.__w205ch.fire('presence', 'sync'); });
  await f.page.waitForTimeout(150);
  r = await f.ev(() => ({ top: document.querySelectorAll('#w205 [data-w205pres] .avs > span').length, g1: document.querySelectorAll('[data-w205gpres="101"] .avs > span').length, g2: document.querySelectorAll('[data-w205gpres="102"] .avs > span').length, who: (document.querySelector('[data-w205who="goal:101:detail"]') || {}).textContent || '', hidden: (document.querySelector('[data-w205who="goal:101:detail"]') || {}).hidden, other: document.querySelector('[data-w205k="goal:101:detail"]').classList.contains('other') }));
  ok(r.top === 2, 'presence: two other people here (not me)');
  ok(r.g1 === 1 && r.g2 === 1, 'presence: Ian shows on goal 1 and Shima on goal 2');
  ok(r.who === 'Ian editing' && r.hidden === false && r.other, 'presence: the SMART box says Ian is editing it');
  await shot(f, 'w205_presence');
  /* my own presence: focus moves into goal 4, the channel hears it */
  await f.page.click('[data-w205k="goal:104:measure"]'); await f.page.waitForTimeout(500);
  r = await f.ev(() => { var t = window.__w205ch.tracked; return t[t.length - 1] || {}; });
  ok(String(r.goal) === '104' && r.field === 'goal:104:measure' && r.email === 'steel.macdonald@welfareavenue.com', 'presence: my place (goal 4, the headline measure) is shared on the channel');

  /* comments: threaded, on the goal and on a milestone, with @mentions through wave138 */
  await f.page.click('[data-w205cmtsft="101"]'); await f.page.waitForTimeout(400);
  r = await f.ev(() => ({ open: document.getElementById('w205drawer').classList.contains('open'), threads: document.querySelectorAll('#w205drawer .w205th').length, replies: document.querySelectorAll('#w205drawer .w205replies .w205cm').length, tag: (document.querySelector('#w205drawer .w205ms-tag') || {}).textContent || '', mark: !!document.querySelector('#w205drawer .tx') }));
  ok(r.open && r.threads === 2 && r.replies === 1, 'comments: two threads on goal 1, one with a reply');
  ok(/FY27: 3,000 meals/.test(r.tag), 'comments: a thread on a milestone says which');
  await f.ev(() => { window.__w205rpc.strategy_comment_add = function (a) { return { id: 9100 + window.__w205calls.length, goal_id: a.p_goal, body: a.p_body, author: 'Steel', author_email: 'steel.macdonald@welfareavenue.com', parent_id: a.p_parent, milestone_id: a.p_milestone, created_at: new Date().toISOString() }; }; });
  await f.page.click('#w205drawer textarea[data-w205cmt="new"]');
  await f.page.keyboard.type('Let us confirm at the Q1 board meeting @Ia', { delay: 12 });
  await f.page.waitForTimeout(300);
  r = await f.ev(() => ({ isField: document.querySelector('#w205drawer textarea[data-w205cmt="new"]').matches('#w205drawer textarea[data-w205cmt]'), pick: window.w138Debug ? window.w138Debug().pick : null }));
  ok(r.isField && Array.isArray(r.pick) && r.pick.some(n => /^Ian/.test(n)), 'comments: @ opens the Hub’s mention picker (' + JSON.stringify(r.pick).slice(0, 60) + ')');
  await f.page.keyboard.press('Enter'); await f.page.keyboard.type(' please.', { delay: 10 });
  await f.page.keyboard.press('Control+Enter'); await f.page.waitForTimeout(400);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_comment_add');
  ok(cs.length === 1 && cs[0].args.p_goal === 101 && cs[0].args.p_parent === null && /@Ian/.test(cs[0].args.p_body), 'comments: Ctrl+Enter posts to goal 1 with the @mention in it');
  r = await f.ev(() => ({ threads: document.querySelectorAll('#w205drawer .w205th').length, btn: document.querySelector('[data-w205cmtsft="101"]').textContent }));
  ok(r.threads === 3 && /\(4\)/.test(r.btn), 'comments: the new thread shows and the count follows (' + r.btn.trim() + ')');
  await f.page.click('#w205drawer [data-w205replyto="9001"]'); await f.page.waitForTimeout(200);
  await f.page.keyboard.type('Agreed.', { delay: 10 }); await f.page.click('#w205drawer [data-w205sendreply="9001"]'); await f.page.waitForTimeout(300);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_comment_add');
  ok(cs.length === 2 && cs[1].args.p_parent === 9001, 'comments: a reply goes into the thread');
  /* someone else's comment arrives live */
  await f.ev(() => window.__w205ch.fire('postgres_changes', 'goal_comments', { eventType: 'INSERT', new: { id: 9500, goal_id: 101, body: 'Live from Suhaib.', author: 'Suhaib', author_email: 'suhaib.abdillahi@welfareavenue.com', parent_id: null, milestone_id: null, created_at: new Date().toISOString() } }));
  await f.page.waitForTimeout(200);
  r = await f.ev(() => document.getElementById('w205drawer').textContent.indexOf('Live from Suhaib.') >= 0);
  ok(r, 'comments: a comment from someone else appears without a refresh');
  await shot(f, 'w205_comments');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
  /* a milestone's own thread */
  await f.ev(() => { var b = document.querySelector('#w205g-101 .w205ms [data-w205cmts*=":"]'); b.click(); });
  await f.page.waitForTimeout(300);
  r = await f.ev(() => ({ on: (document.querySelector('#w205drawer .w205seg button.on') || {}).textContent || '', hint: (document.querySelector('#w205drawer .df small') || {}).textContent || '' }));
  ok(/^FY27/.test(r.on) && /On FY27/.test(r.hint), 'comments: a milestone’s bubble opens its own thread (' + r.on + ')');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);

  /* the history: who, when, what, and Restore */
  await f.page.click('[data-w205hist="101"]'); await f.page.waitForTimeout(500);
  r = await f.ev(() => ({ rows: document.querySelectorAll('#w205drawer .w205h').length, first: (document.querySelector('#w205drawer .w205h') || {}).textContent || '', restores: document.querySelectorAll('#w205drawer [data-w205restore]').length, ov: !!document.querySelector('#w205drawer .w205h .ov') }));
  ok(r.rows === 3 && /Shima/.test(r.first) && r.ov, 'history: every change with who and when, the old value struck through (' + r.rows + ' rows)');
  ok(r.restores === 3, 'history: Restore on each change an admin may undo');
  await shot(f, 'w205_history');
  await f.page.click('#w205drawer [data-w205restore="7001"]'); await f.page.waitForTimeout(500);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_restore');
  ok(cs.length === 1 && cs[0].args.p_history === 7001, 'history: Restore calls strategy_restore for that change');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);

  /* link a project to a goal and a milestone */
  await f.page.click('[data-w205projs="102"] [data-w205link]'); await f.page.waitForTimeout(300);
  await f.page.fill('#w205drawer [data-w205linkq]', 'General Ops Toronto'); await f.page.waitForTimeout(400);
  await f.page.click('#w205drawer [data-w205pickp]'); await f.page.waitForTimeout(250);
  r = await f.ev(() => ({ goals: document.querySelectorAll('#w205drawer [data-w205pickg]').length, chosen: (document.querySelector('#w205drawer [data-w205pickg]:checked') || {}).getAttribute && document.querySelector('#w205drawer [data-w205pickg]:checked').getAttribute('data-w205pickg'), ms: document.querySelectorAll('#w205drawer [data-w205pickm]').length }));
  ok(r.goals === 5 && r.chosen === '102' && r.ms === 8, 'link: pick the project, then the goal (goal 2 chosen) and one of its milestones (7 and the goal as a whole)');
  await f.ev(() => document.querySelectorAll('#w205drawer [data-w205pickm]')[2].click()); await f.page.waitForTimeout(200);
  await f.page.click('#w205drawer [data-w205dolink]'); await f.page.waitForTimeout(400);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_link_project');
  ok(cs.length === 1 && cs[0].args.p_project === 16 && cs[0].args.p_goal === 102 && cs[0].args.p_milestone > 1000, 'link: strategy_link_project with the project, goal 2 and the milestone');
  r = await f.ev(() => !!document.querySelector('#w205g-102 .w205ms [data-w205proj="16"]'));
  ok(r, 'link: the project shows under its milestone');

  /* owners, milestones, paths */
  await f.page.click('[data-w205addowner="102"]'); await f.page.waitForTimeout(300);
  await f.page.fill('#w205drawer [data-w205ownq]', 'Ian'); await f.page.waitForTimeout(400);
  await f.ev(() => { var l = document.querySelector('#w205drawer [data-w205ownon="17"]'); l && l.click(); }); await f.page.waitForTimeout(300);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_owner_set');
  ok(cs.length === 1 && cs[0].args.p_goal === 102 && cs[0].args.p_member === 17 && cs[0].args.p_on === true, 'owners: add Ian to goal 2 from the roster');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
  await f.ev(() => { window.__w205rpc.strategy_add = function (a) { return { id: 5555, goal_id: a.p_goal, fy: a.p_fy, sort: 9, body: '', status: 'not started', archived_at: null }; }; });
  await f.page.click('[data-w205addms="104:FY28"]'); await f.page.waitForTimeout(400);
  r = await f.ev(() => ({ el: !!document.querySelector('[data-w205k="milestone:5555:body"]'), focus: document.activeElement && document.activeElement.getAttribute('data-w205k') }));
  ok(r.el && r.focus === 'milestone:5555:body', 'milestones: Add a milestone opens an empty one, ready to type');
  await f.page.keyboard.type('Second flagship event has a lead', { delay: 8 }); await f.page.waitForTimeout(1100);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_save' && c.args.p_entity === 'milestone');
  ok(cs.length === 1 && cs[0].args.p_id === 5555 && cs[0].args.p_old === '', 'milestones: its text autosaves');
  await f.ev(() => { var s = document.querySelector('[data-w205k^="milestone:"][data-w205k$=":status"]'); s.value = 'done'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await f.page.waitForTimeout(300);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_save' && c.args.p_field === 'status');
  ok(cs.length === 1 && cs[0].args.p_value === 'done', 'milestones: a status change saves at once');
  await f.ev(() => document.querySelector('[data-w205rm^="path:"]').click()); await f.page.waitForTimeout(300);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_remove');
  ok(cs.length === 1 && cs[0].args.p_entity === 'path', 'paths: remove a path (Restore in the history brings it back)');

  /* approval (admins) */
  await f.ev(() => { window.confirm = function () { return true; }; });
  await f.page.click('[data-w205approve="approved"]'); await f.page.waitForTimeout(300);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_set_approval');
  ok(cs.length === 1 && cs[0].args.p_status === 'approved', 'approval: an admin marks the goals approved (strategy_set_approval)');

  /* the Strategy Library */
  await f.hash('#orggoals/library', 900);
  r = await f.ev(() => ({ h1: document.querySelector('#w205 h1').textContent, docs: document.querySelectorAll('#w205 .w205doc').length, shelves: Array.from(document.querySelectorAll('#w205 .w205shelf')).map(x => x.firstChild.textContent.trim()), rail: (document.querySelector('#w153rail .w153it.on') || {}).textContent, links: Array.from(document.querySelectorAll('#w205 .w205doc h4 a')).map(a => a.href), add: !!document.querySelector('[data-w205docadd]') }));
  ok(r.h1 === 'Strategy Library' && /Strategy Library/.test(r.rail), 'library: its own page, marked in the rail');
  ok(r.docs === 15 && JSON.stringify(r.shelves) === JSON.stringify(['Our plans', 'Consulting work', 'Sources']), 'library: 15 documents on three shelves');
  ok(r.links.indexOf('https://docs.google.com/spreadsheets/d/1a1QFjiiKBlXijbgg03JcJScBdtAV1g5kMyOR3aNPf4k') >= 0 && r.links.length === 14, 'library: the documents link to the draft’s addresses (14 links; the MCC blueprint has none)');
  ok(r.add, 'library: admins can add a document');
  await f.page.fill('#w205 [data-w205libq]', 'Toronto'); await f.page.waitForTimeout(500);
  r = await f.ev(() => ({ docs: document.querySelectorAll('#w205 .w205doc').length, focus: document.activeElement && document.activeElement.hasAttribute('data-w205libq') }));
  ok(r.docs >= 3 && r.docs < 15 && r.focus, 'library: search narrows it and keeps the cursor (' + r.docs + ')');
  await shot(f, 'w205_library');
  await f.page.fill('#w205 [data-w205libq]', ''); await f.page.waitForTimeout(400);
  await f.ev(() => { window.__w205rpc.strategy_doc_save = function (a) { var d = window.w205.state().docs.filter(x => x.id === a.p_id)[0]; return Object.assign({}, d, a.p_patch); }; });
  await f.page.click('#w205 [data-w205pin="5"]'); await f.page.waitForTimeout(400);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_doc_save');
  r = await f.ev(() => document.querySelectorAll('#w205 .w205doc.unpinned').length);
  ok(cs.length === 1 && cs[0].args.p_id === 5 && cs[0].args.p_patch.pinned === false && r === 1, 'library: an admin unpins a document');

  /* the retired goals, and #goals goes there */
  await f.hash('#goals', 1400);
  r = await f.ev(() => ({ hash: location.hash, h1: (document.querySelector('#w205 h1') || {}).textContent, items: document.querySelectorAll('#w205 .w205list .it').length, toProj: document.querySelectorAll('[data-w205toproj]').length, tags: document.querySelectorAll('#w205 .w205list .w205tag.g').length }));
  ok(r.hash === '#orggoals/retired' && r.h1 === 'Retired goals', '#goals (Department goals) opens Retired goals');
  ok(r.items >= 25 && r.toProj >= 20 && r.tags >= 20, 'retired: the retired goals are listed with the goal each served and Make it a project (' + r.items + ' goals)');
  await f.ev(() => { window.__w205rpc.strategy_retired_to_project = function (a) { return { ok: true, project_id: 77 }; }; });
  await f.page.click('[data-w205toproj]'); await f.page.waitForTimeout(500);
  cs = (await calls(f)).filter(c => c.fn === 'strategy_retired_to_project');
  ok(cs.length === 1, 'retired: Make it a project calls strategy_retired_to_project once');

  /* Projects: a retired goal reads as not linked; the goal line opens the same link sheet */
  await f.hash('#projects', 1600);
  r = await f.ev(() => { const c5 = document.querySelector('#projects .w116pc[data-pid="5"] .goal'), c1 = document.querySelector('#projects .w116pc[data-pid="1"] .goal'); return { c5: c5 ? c5.textContent : '', c1: c1 ? c1.textContent : '' }; });
  ok(/Not linked to a goal yet/.test(r.c5) && /Goal 4/.test(r.c1) && /Build money that lasts/.test(r.c1), 'projects: Brand Refresh (its goal retired) reads Not linked yet; Donor Program serves goal 4');
  await f.ev(() => document.querySelector('#projects .w116pc[data-pid="5"] .goal').click()); await f.page.waitForTimeout(600);
  r = await f.ev(() => { const st = window.w205.state().drawer; return { open: document.getElementById('w205drawer').classList.contains('open'), kind: st && st.kind, project: st && String(st.project) }; });
  ok(r.open && r.kind === 'link' && r.project === '5', 'projects: the goal line opens the link sheet for that project');
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);

  /* Goal alignment: goals to projects */
  await f.hash('#goalmap', 1600);
  r = await f.ev(() => ({ cols: Array.from(document.querySelectorAll('#w116maphost .w116mcol h4')).map(h => h.textContent), org: document.querySelectorAll('#w116maphost [data-mn^="O"]').length, dept: document.querySelectorAll('#w116maphost [data-mn^="G"]').length, edges: document.querySelectorAll('#w116maphost path.w116me').length, rail: (document.querySelector('#w153rail .w153it.on') || {}).textContent }));
  ok(JSON.stringify(r.cols) === JSON.stringify(['Projects', 'Organizational goals']) && r.org === 5 && r.dept === 0, 'goal alignment: projects to the five goals (no department goals column)');
  ok(r.edges >= 5 && /Goal alignment/.test(r.rail), 'goal alignment: the links are drawn (' + r.edges + ')');
  r = await f.ev(() => ({ menuAfter: window.w163 ? window.w163.state().after : 0, layout: window.w134 ? window.w134.ok() : true }));
  ok(r.menuAfter === 0 && r.layout, 'menu: shows once (w163 after 0) and the layout holds (w134.ok)');
  ok(f.errs.length === 0, 'admin: no page errors ' + JSON.stringify(f.errs).slice(0, 300));
  await f.close();

  /* ================= a member (Samson, HR): reads, comments, links; edits nothing ================= */
  f = await boot(browser, 'member');
  r = await f.ev(() => ({ rw: document.querySelectorAll('#w205 textarea.w205ed:not([readonly])').length, ro: document.querySelectorAll('#w205 textarea.w205ed[readonly]').length, note: (document.querySelector('#w205 .w205ro') || {}).textContent || '', addOwner: document.querySelectorAll('[data-w205addowner]').length, addMs: document.querySelectorAll('[data-w205addms]').length, link: document.querySelectorAll('[data-w205link]').length, approve: !!document.querySelector('[data-w205approve]'), sel: document.querySelectorAll('#w205 select[data-w205k]:not([disabled])').length }));
  ok(r.rw === 0 && r.ro > 100 && r.sel === 0, 'member: every field is read only (owners and admins edit)');
  ok(/owners and the admins edit it; you can comment and link projects/.test(r.note), 'member: the page says why');
  ok(r.addOwner === 0 && r.addMs === 0 && !r.approve, 'member: no owner, milestone or approval controls');
  ok(r.link >= 5, 'member: Link a project is there (departments own projects)');
  await f.page.click('[data-w205cmtsft="102"]'); await f.page.waitForTimeout(300);
  r = await f.ev(() => !!document.querySelector('#w205drawer textarea[data-w205cmt="new"]'));
  ok(r, 'member: can comment');
  await f.page.keyboard.press('Escape');
  ok(f.errs.length === 0, 'member: no page errors ' + JSON.stringify(f.errs).slice(0, 200));
  await f.close();

  /* ================= a leader (Shima): owner of goals 1, 2 and 5 ================= */
  f = await boot(browser, 'leader');
  r = await f.ev(() => ({ me: (typeof USER !== 'undefined' && USER) ? USER.email : '', can: [101, 102, 103, 104, 105].map(id => document.querySelectorAll('#w205g-' + id + ' textarea.w205ed:not([readonly])').length > 0), toProj: 0 }));
  ok(r.me === 'shima.butera@welfareavenue.com', 'leader: Shima (the first leader in the fixture)');
  ok(JSON.stringify(r.can) === JSON.stringify([true, true, false, false, true]), 'leader: Shima edits goals 1, 2 and 5 (hers) and reads 3 and 4 ' + JSON.stringify(r.can));
  await f.hash('#orggoals/retired', 900);
  r = await f.ev(() => document.querySelectorAll('[data-w205toproj]').length);
  ok(r >= 20, 'leader: Make it a project is offered to leaders');
  ok(f.errs.length === 0, 'leader: no page errors ' + JSON.stringify(f.errs).slice(0, 200));
  await f.close();

  /* ================= a board viewer (Tamara): reads only, from the Board group ================= */
  f = await boot(browser, 'board', 1366, '#overview');
  r = await f.ev(() => { var t = document.querySelector('#tabBar .tab[data-tab="orggoals"]'); var g = t && t.closest('.tab-group'); return { visible: !!(t && t.offsetParent), group: g ? g.getAttribute('data-w42g') : null }; });
  ok(r.visible && r.group === 'board', 'board: Goals is in the board’s menu, in the Board group');
  await f.hash('#orggoals', 1600);
  r = await f.ev(() => ({ active: (document.querySelector('.panel.active') || {}).id, cards: document.querySelectorAll('#w205 .w205goal').length, rw: document.querySelectorAll('#w205 textarea.w205ed:not([readonly])').length, link: document.querySelectorAll('[data-w205link],[data-w205linkp]').length, note: (document.querySelector('#w205 .w205ro') || {}).textContent || '', crumb: (document.querySelector('#w205 .crumb') || {}).textContent }));
  ok(r.active === 'orggoals' && r.cards === 5, 'board: the five goals open for the board');
  ok(r.rw === 0 && r.link === 0 && /board viewer/.test(r.note), 'board: read only, no links, and it says so');
  await f.page.click('[data-w205cmtsft="101"]'); await f.page.waitForTimeout(300);
  r = await f.ev(() => ({ box: !!document.querySelector('#w205drawer textarea[data-w205cmt]'), threads: document.querySelectorAll('#w205drawer .w205th').length }));
  ok(!r.box && r.threads === 2, 'board: reads the comments, cannot write one');
  await shot(f, 'w205_board');
  ok(f.errs.length === 0, 'board: no page errors ' + JSON.stringify(f.errs).slice(0, 200));
  await f.close();

  /* ================= phone, 390 px (admin) ================= */
  f = await boot(browser, 'admin', 390);
  r = await f.ev(() => ({ sw: document.documentElement.scrollWidth, cards: document.querySelectorAll('#w205 .w205goal').length, years: getComputedStyle(document.querySelector('#w205 .w205years')).gridTemplateColumns.split(' ').length, wideEls: Array.from(document.querySelectorAll('#w205 *')).filter(e => e.getBoundingClientRect().right > 392 && e.offsetParent).map(e => e.className).slice(0, 5) }));
  ok(r.sw <= 392 && r.cards === 5, 'phone: no sideways scroll at 390 px (' + r.sw + ') ' + JSON.stringify(r.wideEls));
  ok(r.years === 1, 'phone: the years stack');
  await shot(f, 'w205_phone');
  await f.page.click('[data-w205cmtsft="101"]'); await f.page.waitForTimeout(400);
  r = await f.ev(() => Math.round(document.getElementById('w205drawer').getBoundingClientRect().width));
  ok(r >= 388, 'phone: the comments open full width (' + r + ')');
  await shot(f, 'w205_phone_comments');
  ok(f.errs.length === 0, 'phone: no page errors ' + JSON.stringify(f.errs).slice(0, 200));
  await f.close();

  /* ================= French (wave198): typed content stays as written ================= */
  f = await fresh(browser, { who: 'admin', hash: '#orggoals', fixture: build(), init: INIT + ";try{localStorage.setItem('wa198lang','fr')}catch(e){}", wait: 4200 });
  r = await f.ev(() => ({ t1: (document.querySelector('[data-w205k="goal:101:title"]') || {}).value, skip: document.querySelectorAll('#w205 [data-w198skip]').length, lang: document.documentElement.lang }));
  ok(r.t1 === 'Feed more people, more reliably' && r.skip > 100, 'French: the goals stay as written (data-w198skip on typed content)');
  ok(f.errs.length === 0, 'French: no page errors ' + JSON.stringify(f.errs).slice(0, 200));
  await f.close();

  await browser.close();
  console.log('\nw205drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
