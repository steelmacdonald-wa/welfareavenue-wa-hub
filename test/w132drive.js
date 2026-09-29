/* w132drive.js <case> <width>: the bank (wave132). Cases: admin (Steel), member (Samson on the HR profile), board (Tamara, a board viewer).
   Live-data fixture (scratchpad fixture_live.json) plus a few tasks with subtasks, clock fixed at 2026-09-25 16:00 Toronto.
   bank_list() and every bank write are mocked in the page and recorded. */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , CASE = "admin", WIDTH = "1366"] = process.argv;
const W = Number(WIDTH), PHONE = W < 700;
const C = {
  admin: { email: "steel.macdonald@welfareavenue.com", name: "Steel MacDonald", role: "staff", patch: [] },
  member: { email: "samson.jules@welfareavenue.com", name: "Samson Jules", role: "staff", patch: [{ email: "samson.jules@welfareavenue.com", role: "member", profile: "hr" }] },
  board: { email: "consult.tamaraangeline@gmail.com", name: "Tamara Angeline", role: "board", patch: [] }
}[CASE];
const html = fs.readFileSync(process.env.CAND || path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
const fx = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/fixture_live.json", "utf8"));
C.patch.forEach(p => { const r = fx.hub_roles.filter(x => x.email === p.email)[0]; if (r) Object.assign(r, p, { tabs: null }); else fx.hub_roles.push(Object.assign({ tabs: null, note: null }, p)); });
/* the pages know the bank page (as the migration set it) */
(fx.hub_access_profiles || []).forEach(p => { if (p.pages && !('bank' in p.pages)) p.pages.bank = p.key === 'board' ? 'none' : 'all'; });
/* a task with subtasks, a finished one, and one back from the bank two days ago */
fx.dept_tasks.push(
  { id: 96001, department: 'marketing', title: 'Launch the podcast pilot', done: false, due_date: '2026-10-10', project_id: 5, owner: 'Ian Odhiambo', status: 'Open', visibility: null, board_only: false, confidential: false, sort: 1, opened_at: '2026-09-01T12:00:00Z' },
  { id: 96002, department: 'marketing', title: 'Record the first episode', done: false, parent_task_id: 96001, project_id: 5, owner: 'Ian Odhiambo', status: 'Open', visibility: null, board_only: false, confidential: false, sort: 2 },
  { id: 96003, department: 'marketing', title: 'Pick the podcast name', done: true, parent_task_id: 96001, project_id: 5, owner: 'Ian Odhiambo', status: 'Done', visibility: null, board_only: false, confidential: false, sort: 3 },
  { id: 96004, department: 'marketing', title: 'Old finished thing', done: true, owner: 'Ian Odhiambo', status: 'Done', visibility: null, board_only: false, confidential: false, sort: 4 },
  { id: 96005, department: 'hr', title: 'Refresh the volunteer handbook', done: false, owner: 'Samson Jules', status: 'Open', visibility: null, board_only: false, confidential: false, sort: 1 }
);
fx.dept_tasks.forEach(t => { if (t.id === 90002) { t.resurfaced_at = '2026-09-23T10:05:00Z'; t.title = 'Update the media kit'; } });
/* project 7 is in the bank: the web app no longer reads it */
fx.projects = (fx.projects || []).filter(p => p.id !== 7);
const BANK = {
  tasks: [
    { id: 95001, title: 'Plan the spring volunteer drive', department: 'opsmtl', owner: 'Ahmed', project_id: null, project: null, parent_task_id: null, parent: null, bank_until: '2027-01-04', bank_note: 'After the holiday season', banked_at: '2026-09-20T15:00:00Z', banked_by: 'Steel MacDonald', bank_due: '2026-10-15', priority: false, description: 'Recruit **40** volunteers for March and April.\n- Schools\n- Mosques', subtasks: 2 },
    { id: 95002, title: 'Refresh the donor thank-you video', department: 'marketing', owner: 'Ian Odhiambo', project_id: 5, project: 'Brand Refresh', parent_task_id: null, parent: null, bank_until: '2026-12-28', bank_note: null, banked_at: '2026-09-22T23:10:00Z', banked_by: 'AI: Marketing sync (Sep 22)', bank_due: null, priority: false, description: '', subtasks: 0 },
    { id: 95003, title: 'Apply to the Trillium seed grant', department: 'fundraising', owner: 'Amanda', project_id: 23, project: 'Grants Program', parent_task_id: null, parent: null, bank_until: '2027-03-01', bank_note: 'Next intake opens in March', banked_at: '2026-09-10T15:00:00Z', banked_by: 'Amanda', bank_due: null, priority: true, description: '', subtasks: 0 },
    { id: 95004, title: 'Book the board retreat venue', department: 'hr', owner: 'Valex', project_id: null, project: null, parent_task_id: null, parent: null, bank_until: '2026-10-20', bank_note: 'Once the dates are set', banked_at: '2026-08-20T15:00:00Z', banked_by: 'Valex', bank_due: null, priority: false, description: '', subtasks: 0 }
  ],
  projects: [
    { id: 7, name: 'WA Intro Video', department: 'marketing', parent_id: null, parent: null, description: 'A two minute film about the Sunday servings.', leads: ['Ian'], bank_until: '2027-02-01', bank_note: 'Once the brand refresh is done', banked_at: '2026-09-15T15:00:00Z', banked_by: 'Steel MacDonald', lead: CASE === 'admin', subprojects: 0, tasks: 3, task_titles: ['Write the script', 'Storyboard', 'Book the crew'] }
  ],
  back: [
    { kind: 'task', id: 90002, title: 'Update the media kit', department: 'marketing', at: '2026-09-23T10:05:00Z', owner: 'Ian Odhiambo', project_id: null },
    { kind: 'project', id: 6, title: 'Website Redesign', department: 'marketing', at: '2026-09-18T10:05:00Z', owner: null, project_id: 6 }
  ],
  today: '2026-09-25', can_bank: CASE !== 'board', leader: CASE === 'admin'
};
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push("PASS " + name); } else { fail++; out.push("FAIL " + name + (extra !== undefined ? " :: " + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } }
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const errs = [];
  async function fresh(hash, wait) {
    const ctx = await browser.newContext({ viewport: { width: W, height: PHONE ? 844 : 900 }, isMobile: PHONE, hasTouch: PHONE });
    const page = await ctx.newPage();
    page.on("pageerror", e => errs.push((hash || '') + ' ' + String(e).slice(0, 200)));
    await page.addInitScript(`(function(){ var FIXED = new Date("2026-09-25T16:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(C.role)}; window.__WA_TEST_EMAIL = ${JSON.stringify(C.email)}; window.__WA_TEST_NAME = ${JSON.stringify(C.name)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa112done', '1'); localStorage.setItem('wa75nudge', '1'); localStorage.setItem('w118bSnooze', String(FIXED + 9e9)); } catch (e) {} })();`);
    await page.addInitScript("window.__WAFIX = " + JSON.stringify(fx) + "; window.__BANK = " + JSON.stringify(BANK) + "; window.__WA_RPCS = { bank_list: window.__BANK };");
    /* every bank call is recorded; writes answer like the database does */
    await page.addInitScript(`(function(){ window.__RPC = []; var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.rpc || db.rpc.__w) return; var orig = db.rpc.bind(db); var f = function(fn, args){ window.__RPC.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) }); var fail = (window.__FAIL || {})[fn]; if (fail) return Promise.resolve({ data: null, error: { message: fail } });
      if (fn === 'bank_list') return Promise.resolve({ data: JSON.parse(JSON.stringify(window.__BANK)), error: null });
      if (fn === 'bank_task') return Promise.resolve({ data: { banked: args.p_id === 96001 ? 2 : 1, until: args.p_until }, error: null });
      if (fn === 'bank_project') return Promise.resolve({ data: { projects: 1, tasks: 11, until: args.p_until }, error: null });
      if (fn === 'bank_add_task') return Promise.resolve({ data: { id: 97001, until: args.p_until }, error: null });
      if (fn === 'bank_unbank') return Promise.resolve({ data: { back: 3 }, error: null });
      if (fn === 'bank_redate') return Promise.resolve({ data: { until: args.p_until }, error: null });
      if (fn === 'bank_undo') return Promise.resolve({ data: { back: 2 }, error: null });
      return orig(fn, args); }; f.__w = 1; db.rpc = f; }, 5); })();`);
    await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
    await page.goto("http://wahub.test/" + (hash || ''), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 25000 });
    await page.waitForTimeout(wait || 3800);
    await page.evaluate(() => {
      window.__T = []; window.__F = [];
      const ot = window.toast; window.toast = function (m) { window.__T.push(m); try { return ot.apply(this, arguments); } catch (e) { /* fine */ } };
      const oi = db.functions.invoke.bind(db.functions); db.functions.invoke = function (name, opts) { window.__F.push({ name, body: JSON.parse(JSON.stringify((opts && opts.body) || {})) }); if (name === 'ask') return Promise.resolve({ data: { executed: { ok: true, detail: 'In the bank until 2027-03-25: Launch the podcast pilot.' } }, error: null }); return oi(name, opts); };
    });
    return { page, ctx, ev: (f, a) => page.evaluate(f, a), hash: async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(1300); } };
  }
  const click = async (f, sel, wait) => { const el = await f.page.$(sel); if (!el) return false; await el.click(); await f.page.waitForTimeout(wait || 500); return true; };
  const shot = async (f, n) => { if (!process.env.SHOT) return; try { await f.page.screenshot({ path: '/tmp/w132_' + CASE + '_' + WIDTH + '_' + n + '.png', fullPage: !!process.env.FULL }); } catch (e) { /* fine */ } };
  const rpcs = (f, fn) => f.ev(n => window.__RPC.filter(c => !n || c.fn === n), fn);
  const fits = f => f.ev(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const vis = 'const vis = el => !!(el && el.offsetParent !== null && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden");';

  if (CASE === 'admin' || CASE === 'member') {
    /* 1. the menu and the page */
    { const f = await fresh('#bank');
      await shot(f, 'top');
      const s = await f.ev(new Function(vis + `
        const tab = document.querySelector('#tabBar .tab[data-tab="bank"]'); const host = tab && tab.closest('.tab-group');
        const strat = Array.from(document.querySelectorAll('#tabBar .tab-group[data-w42g="tools"] .tab')).map(t => t.getAttribute('data-tab'));
        return { tab: !!tab, label: tab && tab.textContent.trim(), group: host && host.getAttribute('data-w42g'), strat, active: (document.querySelector('.panel.active') || {}).id,
          mast: (document.querySelector('#bank > .w118mast h1') || {}).textContent, crumb: (document.querySelector('#bank > .w118mast .crumb') || {}).textContent,
          stats: Array.from(document.querySelectorAll('#w132 .w132st')).map(x => x.innerText.replace(/\\s+/g, ' ').trim()), add: vis(document.querySelector('#w132 [data-w132new]')),
          how: !!document.querySelector('#w132 details.w132how'), back: Array.from(document.querySelectorAll('#w132back .w132brow .t')).map(x => x.textContent),
          chips: Array.from(document.querySelectorAll('#w132 .w132chip')).map(x => x.textContent.replace(/\\s+/g, ' ').trim()),
          groups: Array.from(document.querySelectorAll('#w132 .w132grp h3')).map(h => h.firstChild.textContent.trim()),
          items: Array.from(document.querySelectorAll('#w132 .w132it .tt')).map(x => x.textContent), title: document.title };`));
      /* wave163: The Task Bank (Steel: "previously The bank") sits second in Other Tools, after Important info */
      ok("The Task Bank sits second in Other Tools", s.tab && s.label === 'The Task Bank' && s.group === 'tools' && s.strat[0] === 'importantinfo' && s.strat[1] === 'bank', s);
      ok("the page opens with its masthead", s.active === 'bank' && s.mast === 'The Task Bank' && s.crumb === 'Other Tools', s);
      ok("the tab title says The Task Bank", /The Task Bank/.test(s.title), s.title);
      ok("three numbers: in the bank, coming back in 30 days, back lately", s.stats.length === 3 && /^5 in the bank \(4 tasks, 1 project\)/.test(s.stats[0]) && /^1 coming back in the next 30 days/.test(s.stats[1]) && /^2 back in the last two weeks/.test(s.stats[2]), s.stats);
      ok("Put something in the bank, and how it works", s.add && s.how, s);
      ok("back from the bank lists what came back", s.back.join('|') === 'Update the media kit|Website Redesign', s.back);
      ok("a chip for every team with something in it", s.chips[0] === 'All teams 5' && s.chips.some(c => /Marketing 2/.test(c)) && s.chips.some(c => /HR 1/.test(c)) && s.chips.length === 5, s.chips);
      ok("grouped by the month it comes back, soonest first", JSON.stringify(s.groups) === JSON.stringify(['Coming back next month (October)', 'Coming back in December 2026', 'Coming back in January 2027', 'Coming back in February 2027', 'Coming back in March 2027']), s.groups);
      ok("items in date order", s.items.join('|') === 'Book the board retreat venue|Refresh the donor thank-you video|Plan the spring volunteer drive|WA Intro Video|Apply to the Trillium seed grant', s.items);
      const it = await f.ev(() => { const el = document.querySelector('#w132 [data-w132it="task:95001"]'); const pj = document.querySelector('#w132 [data-w132it="project:7"]'); const ai = document.querySelector('#w132 [data-w132it="task:95002"]'); return { t: el && el.innerText.replace(/\s+/g, ' '), p: pj && pj.innerText.replace(/\s+/g, ' '), ai: ai && ai.innerText.replace(/\s+/g, ' '), acts: el ? el.querySelectorAll('[data-w132back],[data-w132date]').length : -1, pacts: pj ? pj.querySelectorAll('[data-w132back],[data-w132date]').length : -1 }; });
      ok("a task says its team, owner, subtasks, why, who and when", /Ops Montreal/.test(it.t) && /Ahmed/.test(it.t) && /with 2 subtasks/.test(it.t) && /After the holiday season/.test(it.t) && /Put here by Steel MacDonald/.test(it.t) && /Jan 4, 2027/.test(it.t) && /in about 3 months/.test(it.t) && /its due date \(Oct 15\) comes back with it/.test(it.t), it.t);
      ok("a project says its tasks and lead", /Project/i.test(it.p) && /3 open tasks/.test(it.p) && /led by Ian/.test(it.p) && /Once the brand refresh is done/.test(it.p), it.p);
      ok("what the AI banked says so, and no reason reads as such", /Put here by AI: Marketing sync/.test(it.ai) && /No reason given/.test(it.ai), it.ai);
      ok("bring back and new date on each item" + (CASE === 'member' ? ' (a member: tasks only)' : ''), it.acts === 2 && it.pacts === (CASE === 'admin' ? 2 : 0), it);
      await click(f, '#w132 [data-w132more="task:95001"]', 300);
      const more = await f.ev(() => (document.querySelector('#w132 [data-w132it="task:95001"] .more') || {}).innerHTML || '');
      ok("opening an item shows its description", /<strong>40<\/strong>/.test(more) && /<li>Schools<\/li>/.test(more), more);
      await click(f, '#w132 [data-w132more="project:7"]', 300);
      const pm = await f.ev(() => (document.querySelector('#w132 [data-w132it="project:7"] .more') || {}).innerText || '');
      ok("a project shows the tasks waiting with it", /Write the script/.test(pm) && /Book the crew/.test(pm), pm);
      if (PHONE) ok("phone: the page fits the screen", await fits(f));
      await shot(f, 'page');
      /* team filter and search */
      await click(f, '#w132 [data-w132team="marketing"]', 400);
      const tf = await f.ev(() => ({ hash: location.hash, items: Array.from(document.querySelectorAll('#w132 .w132it .tt')).map(x => x.textContent), back: document.querySelectorAll('#w132back .w132brow').length, on: (document.querySelector('#w132 .w132chip.on') || {}).textContent }));
      ok("a team chip shows that team's bank", tf.hash === '#bank/marketing' && tf.items.join('|') === 'Refresh the donor thank-you video|WA Intro Video' && tf.back === 2 && /Marketing/.test(tf.on || ''), tf);
      await click(f, '#w132 [data-w132team=""]', 300);
      await f.page.click('#w132q'); await f.page.keyboard.type('trillium', { delay: 20 }); await f.page.waitForTimeout(300);
      const sq = await f.ev(() => ({ items: Array.from(document.querySelectorAll('#w132 .w132it .tt')).map(x => x.textContent), focus: document.activeElement && document.activeElement.id, v: (document.getElementById('w132q') || {}).value }));
      ok("search finds it and keeps the focus", sq.items.join('|') === 'Apply to the Trillium seed grant' && sq.focus === 'w132q' && sq.v === 'trillium', sq);
      await f.page.fill('#w132q', 'nothing like this'); await f.page.dispatchEvent('#w132q', 'input'); await f.page.waitForTimeout(250);
      ok("no match says so", await f.ev(() => /Nothing in the bank matches/.test((document.getElementById('w132list') || {}).innerText || '')));
      await f.page.fill('#w132q', ''); await f.page.dispatchEvent('#w132q', 'input'); await f.page.waitForTimeout(250);
      /* a new date */
      await click(f, '#w132 [data-w132date="task:95004"]', 400);
      const ds = await f.ev(() => ({ on: document.getElementById('w132sheet') && document.getElementById('w132sheet').classList.contains('on'), h: (document.querySelector('#w132sheet h2') || {}).textContent, sub: (document.querySelector('#w132sheet .sub') || {}).textContent, day: (document.getElementById('w132day') || {}).value, ex: (document.querySelector('#w132sheet .ex') || {}).textContent }));
      ok("New date opens with the current date", ds.on && ds.h === 'A new date' && ds.sub === 'Book the board retreat venue' && ds.day === '2026-10-20' && /October 20, 2026/.test(ds.ex), ds);
      await f.page.fill('#w132day', '2027-01-11'); await f.page.dispatchEvent('#w132day', 'input'); await f.page.waitForTimeout(150);
      await click(f, '#w132sheet [data-w132go]', 700);
      const rd = await rpcs(f, 'bank_redate');
      ok("saving the date calls bank_redate", rd.length === 1 && rd[0].args.p_kind === 'task' && rd[0].args.p_id === 95004 && rd[0].args.p_until === '2027-01-11', rd);
      ok("and the sheet closes with a note", await f.ev(() => !document.querySelector('#w132sheet.on') && window.__T.some(t => /Comes back on January 11, 2027/.test(t))));
      /* bring back now */
      const nLoad = await f.ev(() => window.__RPC.filter(c => c.fn === 'bank_list').length);
      await click(f, '#w132 [data-w132back="task:95003"]', 900);
      const bb = await rpcs(f, 'bank_unbank');
      ok("Bring back now calls bank_unbank and reloads the bank", bb.length === 1 && bb[0].args.p_kind === 'task' && bb[0].args.p_id === 95003 && /brought back/.test(bb[0].args.p_why) && (await f.ev(() => window.__RPC.filter(c => c.fn === 'bank_list').length)) > nLoad, bb);
      ok("and says where it went", await f.ev(() => window.__T.some(t => /Apply to the Trillium seed grant.*back on the Fundraising & Finances board/.test(t))));
      /* put something new in */
      await click(f, '#w132 [data-w132new]', 400);
      const ns = await f.ev(() => ({ h: (document.querySelector('#w132sheet h2') || {}).textContent, team: (document.getElementById('w132nteam') || {}).value, picks: Array.from(document.querySelectorAll('#w132sheet [data-w132pick]')).map(b => b.innerText.replace(/\s+/g, ' ').trim()), on: (document.querySelector('#w132sheet .opt.on') || {}).getAttribute && document.querySelector('#w132sheet .opt.on').getAttribute('data-w132pick'), focus: document.activeElement && document.activeElement.id }));
      await shot(f, 'newsheet');
      ok("Put something in the bank asks what, which team and project, when and why", ns.h === 'Put something in the bank' && ns.team === (CASE === 'admin' ? 'board' : 'hr') && ns.picks.length === 3 && ns.picks[0] === 'In 3 months December 25' && ns.picks[1] === 'In 6 months March 25, 2027' && /Pick a day/.test(ns.picks[2]) && ns.on === '3m' && ns.focus === 'w132ntitle', ns);
      await click(f, '#w132sheet [data-w132go]', 300);
      ok("a title is needed", await f.ev(() => /Say what can wait/.test((document.getElementById('w132err') || {}).textContent || '')));
      await f.page.fill('#w132ntitle', 'Plan the 2027 gala'); await f.page.selectOption('#w132nteam', 'fundraising'); await f.page.waitForTimeout(200);
      const po = await f.ev(() => ({ t: (document.getElementById('w132ntitle') || {}).value, opts: Array.from(document.querySelectorAll('#w132nproj option')).map(o => o.textContent) }));
      ok("the project list follows the team (no general lists)", po.t === 'Plan the 2027 gala' && po.opts.indexOf('Grants Program') > 0 && po.opts.indexOf('General Fundraising') < 0, po);
      await f.page.selectOption('#w132nproj', '2');
      await click(f, '#w132sheet [data-w132pick="custom"]', 200);
      await f.page.fill('#w132day', '2026-11-02'); await f.page.dispatchEvent('#w132day', 'input'); await f.page.waitForTimeout(150);
      ok("a date under two months gets a gentle note", await f.ev(() => /three months or more/.test((document.getElementById('w132soft') || {}).textContent || '')));
      await click(f, '#w132sheet [data-w132pick="6m"]', 200);
      await f.page.fill('#w132why', 'After this year\'s events wrap up');
      await click(f, '#w132sheet [data-w132go]', 700);
      const ad = await rpcs(f, 'bank_add_task');
      ok("it goes straight to the bank with bank_add_task", ad.length === 1 && ad[0].args.p_department === 'fundraising' && ad[0].args.p_title === 'Plan the 2027 gala' && ad[0].args.p_until === '2027-03-25' && ad[0].args.p_project_id === 2 && /events wrap up/.test(ad[0].args.p_note) && ad[0].args.p_owner.split(' ')[0] === C.name.split(' ')[0], ad);
      ok("with a note that it is in", await f.ev(() => { const s = document.getElementById('w132snack'); return !!s && s.classList.contains('on') && /Plan the 2027 gala.*March 25, 2027/.test(s.textContent); }));
      if (PHONE) { await click(f, '#w132 [data-w132new]', 400); const ph = await f.ev(() => { const p = document.querySelector('#w132sheet .pane'); const r = p.getBoundingClientRect(); return { w: r.width, b: Math.round(r.bottom), h: innerHeight, fit: document.documentElement.scrollWidth <= innerWidth + 1 }; }); ok("phone: the sheet rises from the bottom", ph.w >= W - 1 && Math.abs(ph.b - ph.h) <= 2 && ph.fit, ph); await click(f, '#w132sheet .xb', 200); }
      ok("Escape and the cross close the sheet", await (async () => { await click(f, '#w132 [data-w132new]', 300); await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200); return f.ev(() => !document.querySelector('#w132sheet.on')); })());
      await f.ctx.close();
    }

    /* 2. the task drawer: Move to the bank, then Undo */
    { const f = await fresh('#team/marketing/tasks');
      await f.ev(() => window.w116Board.open(96001)); await f.page.waitForTimeout(500);
      const d = await f.ev(() => { const ft = document.querySelector('#w116dr .w116drf'); const b = ft && ft.querySelector('[data-w132bank]'); return { b: !!b, txt: b && b.textContent.trim(), order: ft ? Array.from(ft.children).map(x => x.textContent.trim()) : [] }; });
      await shot(f, 'drawer');
      ok("the task drawer offers Move to the bank, before Delete", d.b && d.txt === 'Move to the bank' && d.order.indexOf('Move to the bank') === d.order.indexOf('Delete') - 1, d);
      await click(f, '#w116dr [data-w132bank]', 400);
      const s = await f.ev(() => ({ h: (document.querySelector('#w132sheet h2') || {}).textContent, sub: (document.querySelector('#w132sheet .sub') || {}).textContent, ex: (document.querySelector('#w132sheet .ex') || {}).textContent, focus: document.activeElement && document.activeElement.id, z: getComputedStyle(document.getElementById('w132sheet')).zIndex }));
      await shot(f, 'tasksheet');
      ok("the sheet names the task and its open subtask, above the drawer", s.h === 'Move to the bank' && s.sub === 'Launch the podcast pilot' && /with its 1 open subtask/.test(s.ex) && /Marketing board/.test(s.ex) && /due date/.test(s.ex) && s.focus === 'w132why' && Number(s.z) > 120, s);
      await click(f, '#w132sheet [data-w132pick="6m"]', 200);
      await f.page.fill('#w132why', 'After the podcast grant decision');
      await click(f, '#w132sheet [data-w132go]', 900);
      const bt = await rpcs(f, 'bank_task');
      ok("it calls bank_task with the date and why", bt.length === 1 && bt[0].args.p_id === 96001 && bt[0].args.p_until === '2027-03-25' && bt[0].args.p_note === 'After the podcast grant decision', bt);
      const after = await f.ev(() => ({ gone: !DB_TASKS.some(t => t.id === 96001 || t.id === 96002), keptDone: DB_TASKS.some(t => t.id === 96003), drawer: document.getElementById('w116dr').classList.contains('open'), row: !!document.querySelector('#team .w116r[data-tid="96001"]'), snack: (document.getElementById('w132snack') || {}).textContent || '' }));
      ok("the task and its open subtask leave the board and the drawer closes", after.gone && after.keptDone && !after.drawer && !after.row, after);
      await shot(f, 'undo');
      ok("an undo bar says when it comes back", /In the bank until March 25, 2027, with 1 subtask\. It comes back on its own\./.test(after.snack) && /Undo/.test(after.snack), after.snack);
      await click(f, '#w132snack [data-w132sn="0"]', 900);
      const un = await rpcs(f, 'bank_undo');
      const back = await f.ev(() => ({ back: DB_TASKS.some(t => t.id === 96001) && DB_TASKS.some(t => t.id === 96002), row: !!document.querySelector('#team .w116r[data-tid="96001"]'), toast: window.__T.slice(-2) }));
      ok("Undo puts it back where it was", un.length === 1 && un[0].args.p_kind === 'task' && un[0].args.p_id === 96001 && back.back && back.toast.indexOf('Back where it was') >= 0, { un, back });
      /* a finished task has no button; the date shortcuts */
      await f.ev(() => window.w116Board.open(96004)); await f.page.waitForTimeout(400);
      ok("a finished task has no Move to the bank", await f.ev(() => !document.querySelector('#w116dr [data-w132bank]')));
      await f.ev(() => window.w116Board.closeDrawer());
      /* the board tag */
      await f.ev(() => { try { window.w116Board.refresh(); } catch (e) { } });
      await f.page.waitForTimeout(300);
      const tag = await f.ev(() => { const r = document.querySelector('#team .w116r[data-tid="90002"]'); return r ? Array.from(r.querySelectorAll('.w116tag')).map(x => x.textContent) : null; });
      ok("a task that came back two days ago says so on the board", tag && tag.indexOf('back from the bank') >= 0, tag);
      if (PHONE) ok("phone: the board fits", await fits(f));
      await f.ctx.close();
    }

    /* 3. a team page: In the bank */
    { const f = await fresh('#team/marketing');
      await f.page.waitForTimeout(600);
      const c = await f.ev(() => { const el = document.getElementById('w132tcard'); const cols = document.querySelectorAll('#w116host .w116grid > .w116col'); return { el: !!el, last: el && cols.length && el.parentNode === cols[cols.length - 1], txt: el && el.innerText.replace(/\s+/g, ' '), rows: el ? Array.from(el.querySelectorAll('.w132trow')).map(r => r.innerText.replace(/\s+/g, ' ')) : [] }; });
      await f.ev(() => { const el = document.getElementById('w132tcard'); if (el) el.scrollIntoView({ block: 'center' }); }); await shot(f, 'teamcard');
      ok("the team page has an In the bank card at the foot of the second column", c.el && c.last, c);
      ok("it counts the team's bank and what came back", /2 items waiting \(1 project\)/.test(c.txt) && /2 back in the last two weeks/.test(c.txt) && c.rows.length === 4 && /Update the media kit back Sep 23/.test(c.rows[0]) && /Refresh the donor thank-you video Dec 28/.test(c.rows[2]) && /Project: WA Intro Video Feb 1, 2027/.test(c.rows[3]), c);
      await click(f, '#w132tcard [data-w132goto]', 900);
      ok("open the bank goes to the team's bank", await f.ev(() => location.hash === '#bank/marketing' && (document.querySelector('.panel.active') || {}).id === 'bank' && /Marketing/.test((document.querySelector('#w132 .w132chip.on') || {}).textContent || '')));
      await f.hash('#team/opsto');
      ok("a team with nothing in the bank has no card", await f.ev(() => !document.getElementById('w132tcard')));
      await f.ctx.close();
    }

    /* 4. a project page */
    { const f = await fresh('#project/5');
      await f.page.waitForTimeout(800);
      const pb = await f.ev(() => { const b = document.querySelector('#projectpage .w132pbar'); return { b: !!b, txt: b && b.innerText.replace(/\s+/g, ' ') }; });
      await shot(f, 'project');
      if (CASE === 'admin') {
        ok("a leader sees Move the project to the bank on its page", pb.b && /Move the project to the bank/.test(pb.txt), pb);
        await click(f, '#projectpage [data-w132bankproj]', 400);
        const s = await f.ev(() => ({ h: (document.querySelector('#w132sheet h2') || {}).textContent, sub: (document.querySelector('#w132sheet .sub') || {}).textContent, ex: (document.querySelector('#w132sheet .ex') || {}).textContent }));
        ok("the sheet says the project and its tasks go together", s.h === 'Move the project to the bank' && s.sub === 'Brand Refresh' && /open task/.test(s.ex) && /come back together/.test(s.ex), s);
        await f.page.fill('#w132why', 'After the gala');
        await click(f, '#w132sheet [data-w132go]', 1600);
        const bp = await rpcs(f, 'bank_project');
        ok("it calls bank_project and opens the bank", bp.length === 1 && bp[0].args.p_id === 5 && bp[0].args.p_until === '2026-12-25' && bp[0].args.p_note === 'After the gala' && (await f.ev(() => location.hash)) === '#bank', bp);
        ok("with an undo bar", await f.ev(() => /Brand Refresh is in the bank until December 25, 2026 with 11 open tasks/.test((document.getElementById('w132snack') || {}).textContent || '')));
        await f.hash('#project/19');
        ok("a team's general list cannot be banked", await f.ev(() => !document.querySelector('#projectpage .w132pbar')));
      } else {
        ok("a member who does not lead the project does not see it", !pb.b, pb);
      }
      await f.ctx.close();
    }

    /* 5. Ask the Hub: a bank card with its own editor */
    { const f = await fresh('#mypage');
      await f.ev(() => { try { document.getElementById('waChatBtn').click(); } catch (e) { } });
      await f.page.waitForTimeout(400);
      await f.ev(() => wa38Card({ name: 'bank_task', input: { task_id: 96001, title: 'Launch the podcast pilot', bank_until: '2027-01-04', reason: 'After the grant decision' }, summary: 'Move to the bank: Launch the podcast pilot (back 2027-01-04)' }));
      await f.page.waitForTimeout(400);
      const c = await f.ev(() => { const card = document.querySelector('.wac-card:last-of-type'); return { b: card && card.querySelector('b').textContent, date: card && (card.querySelector('[data-f="bank_until"]') || {}).value, why: card && (card.querySelector('[data-f="reason"]') || {}).value, chips: card ? Array.from(card.querySelectorAll('.w116osug [data-w116oc]')).map(x => x.textContent) : [] }; });
      ok("an Ask the Hub bank card has the date, why and 3 or 6 months", /Move to the bank: Launch the podcast pilot/.test(c.b || '') && c.date === '2027-01-04' && c.why === 'After the grant decision' && c.chips.length === 2 && /In 3 months/.test(c.chips[0]), c);
      await f.ev(() => { const card = document.querySelector('.wac-card:last-of-type'); card.querySelector('[data-w116oc="bank_until"]:last-of-type').click(); });
      await f.ev(() => { const card = document.querySelector('.wac-card:last-of-type'); card.querySelector('.go').click(); });
      await f.page.waitForTimeout(900);
      const ex = await f.ev(() => window.__F.filter(x => x.name === 'ask').map(x => x.body));
      ok("confirming sends bank_task with the edited date", ex.length === 1 && ex[0].execute.name === 'bank_task' && ex[0].execute.input.task_id === 96001 && ex[0].execute.input.bank_until === '2027-03-25' && ex[0].execute.input.reason === 'After the grant decision', ex);
      await f.ctx.close();
    }

    /* 6. the tour, and the access profiles know the page */
    { const f = await fresh('#bank');
      const t = await f.ev(() => { const W = window.w122 || {}; const b = W.tours && W.tours.bank; const p = W.tours && W.tours.project; return { bank: !!b, n: b ? b.steps.length : 0, hash: b && b.hash, proj: !!(p && p.steps.some(s => s.s === '#projectpage .w132pbar')) }; });
      ok("a page tour for the bank, and a step on the project tour", t.bank && t.n === 6 && t.hash === '#bank' && t.proj, t);
      if (CASE === 'admin') {
        await f.hash('#adminpanel/access');
        await click(f, '#w131card [data-w131prof="marketing"]', 700);
        const a = await f.ev(() => { const txt = (document.getElementById('w131sheet') || {}).innerText || ''; const i = txt.indexOf('The Task Bank'); return { has: i >= 0, near: i >= 0 ? txt.slice(Math.max(0, i - 120), i + 40).replace(/\s+/g, ' ') : txt.slice(0, 300) }; });
        ok("a profile lists The Task Bank in Other Tools", a.has && /OTHER TOOLS|Other Tools/.test(a.near), a);
      }
      await f.ctx.close();
    }
    if (CASE === 'member') {
      const f = await fresh('#team/hr/tasks');
      await f.ev(() => window.w116Board.open(96005)); await f.page.waitForTimeout(400);
      ok("a member can move a task to the bank", await f.ev(() => !!document.querySelector('#w116dr [data-w132bank]')));
      await f.ctx.close();
    }
  }

  if (CASE === 'board') {
    const f = await fresh('#bank');
    const s = await f.ev(() => ({ tab: !!document.querySelector('#tabBar .tab[data-tab="bank"]') && document.querySelector('#tabBar .tab[data-tab="bank"]').style.display !== 'none', active: (document.querySelector('.panel.active') || {}).id, list: window.__RPC.filter(c => c.fn === 'bank_list').length }));
    ok("a board viewer has no bank in the menu and is not shown the page", !s.tab && s.active !== 'bank', s);
    await f.hash('#team/marketing');
    ok("and no bank card on a team page", await f.ev(() => !document.getElementById('w132tcard')));
    await f.ctx.close();
  }

  ok("no page errors", errs.length === 0, errs);
  console.log(out.join("\n")); console.log(`\n${CASE} ${WIDTH}: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
