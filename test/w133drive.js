/* w133drive.js <case> <width>: the org chart, interactive (wave133). Cases: admin (Steel, an editor), member (Samson on the HR profile), board (Tamara).
   Live-data fixture plus the seeded org_positions (scratchpad org_positions.json); the org_* functions are mocked in the page,
   change the fixture as the database would, and are recorded. Clock fixed at 2026-09-25 16:00 Toronto. */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , CASE = "admin", WIDTH = "1366"] = process.argv;
const W = Number(WIDTH), PHONE = W < 700;
const C = {
  admin: { email: "steel.macdonald@welfareavenue.com", name: "Steel MacDonald", role: "staff", patch: [] },
  member: { email: "samson.jules@welfareavenue.com", name: "Samson Jules", role: "staff", patch: [{ email: "samson.jules@welfareavenue.com", role: "member", profile: "hr" }] },
  board: { email: "consult.tamaraangeline@gmail.com", name: "Tamara Angeline", role: "board", patch: [] }
}[CASE];
const SP = "/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/";
const html = fs.readFileSync(process.env.CAND || path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
const fx = JSON.parse(fs.readFileSync(SP + "fixture_live.json", "utf8"));
C.patch.forEach(p => { const r = fx.hub_roles.filter(x => x.email === p.email)[0]; if (r) Object.assign(r, p, { tabs: null }); else fx.hub_roles.push(Object.assign({ tabs: null, note: null }, p)); });
fx.org_positions = JSON.parse(fs.readFileSync(SP + "org_positions.json", "utf8"));
/* one open position already on the chart */
fx.org_positions.push({ id: 60, member_id: null, title: 'Volunteer coordinator, Toronto', department: 'opsto', reports_to: 28, kind: 'staff', status: 'hiring', note: 'Recruiting now', sort: 500 });
const EDITOR = CASE === 'admin';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push("PASS " + name); } else { fail++; out.push("FAIL " + name + (extra !== undefined ? " :: " + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } }
const MOCK = `(function(){ window.__RPC = []; var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.rpc || db.rpc.__w) return; var orig = db.rpc.bind(db);
  function P(){ return window.__WAFIX.org_positions; } function byId(id){ return P().filter(function(p){ return String(p.id) === String(id); })[0]; }
  function under(node, root){ var cur = byId(node), seen = {}; while (cur && !seen[cur.id]) { if (String(cur.id) === String(root)) return true; seen[cur.id] = 1; cur = cur.reports_to == null ? null : byId(cur.reports_to); } return false; }
  var f = function(fn, a){ a = a || {}; window.__RPC.push({ fn: fn, args: JSON.parse(JSON.stringify(a)) }); var fail = (window.__FAIL || {})[fn]; if (fail) return Promise.resolve({ data: null, error: { message: fail } });
    if (fn === 'wa_org_editor') return Promise.resolve({ data: ${EDITOR ? 'true' : 'false'}, error: null });
    if (fn === 'org_move') { var p = byId(a.p_id); if (a.p_reports_to != null && under(a.p_reports_to, a.p_id)) return Promise.resolve({ data: null, error: { message: 'someone cannot report to a person who reports to them' } }); var was = p.reports_to; p.reports_to = a.p_reports_to; if (p.member_id == null && a.p_department) p.department = a.p_department; return Promise.resolve({ data: { id: p.id, reports_to: a.p_reports_to, was: was }, error: null }); }
    if (fn === 'org_set_reports') { var s = byId(a.p_id), n = 0, up = 0; (a.p_reports || []).forEach(function(id){ var k = byId(id); if (k && String(k.reports_to) !== String(s.id)) { k.reports_to = s.id; n++; } }); P().forEach(function(k){ if (String(k.reports_to) === String(s.id) && (a.p_reports || []).map(String).indexOf(String(k.id)) < 0) { k.reports_to = s.reports_to; up++; } }); return Promise.resolve({ data: { added: n, moved_up: up }, error: null }); }
    if (fn === 'org_add_opening') { var id = Math.max.apply(null, P().map(function(p){ return p.id; })) + 1; P().push({ id: id, member_id: null, title: a.p_title, department: a.p_department, reports_to: a.p_reports_to, kind: 'staff', status: a.p_status || 'open', note: a.p_note || null, sort: 500 }); return Promise.resolve({ data: { id: id }, error: null }); }
    if (fn === 'org_update') { var u = byId(a.p_id); u.title = a.p_title; if (u.member_id == null) { if (a.p_status) u.status = a.p_status; u.note = a.p_note; if (a.p_department) u.department = a.p_department; } return Promise.resolve({ data: { id: u.id }, error: null }); }
    if (fn === 'org_fill') { var o = byId(a.p_id), old = P().filter(function(p){ return String(p.member_id) === String(a.p_member_id); })[0]; if (old) { old.member_id = null; old.status = 'open'; } o.member_id = a.p_member_id; o.status = 'filled'; return Promise.resolve({ data: { id: o.id, left_open: old ? old.id : null }, error: null }); }
    if (fn === 'org_place') { var nid = Math.max.apply(null, P().map(function(p){ return p.id; })) + 1; var mm = window.__WAFIX.team_members.filter(function(m){ return String(m.id) === String(a.p_member_id); })[0]; P().push({ id: nid, member_id: a.p_member_id, title: (mm && mm.role) || 'Team member', department: mm && mm.department, reports_to: a.p_reports_to, kind: 'staff', status: 'filled', note: null, sort: 100 }); return Promise.resolve({ data: { id: nid }, error: null }); }
    if (fn === 'org_vacate') { var v = byId(a.p_id); v.member_id = null; v.status = 'open'; return Promise.resolve({ data: { id: v.id }, error: null }); }
    if (fn === 'org_remove') { var r = byId(a.p_id), m = 0; P().forEach(function(k){ if (String(k.reports_to) === String(r.id)) { k.reports_to = r.reports_to; m++; } }); window.__WAFIX.org_positions = P().filter(function(p){ return p !== r; }); return Promise.resolve({ data: { moved_up: m }, error: null }); }
    return orig(fn, a); }; f.__w = 1; db.rpc = f; }, 5); })();`;
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const errs = [];
  async function fresh(hash, wait) {
    const ctx = await browser.newContext({ viewport: { width: W, height: PHONE ? 844 : 900 }, isMobile: PHONE, hasTouch: PHONE });
    const page = await ctx.newPage();
    page.on("pageerror", e => errs.push((hash || '') + ' ' + String(e).slice(0, 200)));
    await page.addInitScript(`(function(){ var FIXED = new Date("2026-09-25T16:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(C.role)}; window.__WA_TEST_EMAIL = ${JSON.stringify(C.email)}; window.__WA_TEST_NAME = ${JSON.stringify(C.name)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa112done', '1'); localStorage.setItem('wa75nudge', '1'); localStorage.setItem('w118bSnooze', String(FIXED + 9e9)); } catch (e) {} })();`);
    await page.addInitScript("window.__WAFIX = " + JSON.stringify(fx) + "; window.__WA_RPCS = { wa_org_editor: " + (EDITOR ? "true" : "false") + " };");
    await page.addInitScript(MOCK);
    await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
    await page.goto("http://wahub.test/" + (hash || ''), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 25000 });
    await page.waitForTimeout(wait || 3800);
    await page.evaluate(() => { window.__T = []; const ot = window.toast; window.toast = function (m) { window.__T.push(m); try { return ot.apply(this, arguments); } catch (e) { /* fine */ } }; });
    return { page, ctx, ev: (f, a) => page.evaluate(f, a), hash: async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(1300); } };
  }
  const click = async (f, sel, wait) => { const el = await f.page.$(sel); if (!el) return false; await el.click(); await f.page.waitForTimeout(wait || 500); return true; };
  const shot = async (f, n) => { if (!process.env.SHOT) return; try { await f.page.screenshot({ path: '/tmp/w133_' + CASE + '_' + WIDTH + '_' + n + '.png', fullPage: !!process.env.FULL }); } catch (e) { /* fine */ } };
  const rpcs = (f, fn) => f.ev(n => window.__RPC.filter(c => !n || c.fn === n), fn);
  const fits = f => f.ev(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const seatOf = (f, name) => f.ev(n => { const m = DB_MEMBERS.filter(x => x.name === n)[0]; const p = m && window.__WAFIX.org_positions.filter(x => String(x.member_id) === String(m.id))[0]; return p ? p.id : null; }, name);

  if (CASE === 'admin' || CASE === 'member') {
    /* 1. the chart */
    { const f = await fresh('#orgchart');
      await f.page.waitForTimeout(600);
      if (process.env.DEBUG) console.log('DEBUG', JSON.stringify(await f.ev(() => ({ w: !!(db && db.rpc && db.rpc.__w), rpc: (window.__RPC || []).map(c => c.fn), can: window.w133 && window.w133.state().canEdit }))));
      await shot(f, 'chart');
      const s = await f.ev(() => ({
        active: (document.querySelector('.panel.active') || {}).id, old: !!(document.getElementById('ocBody') && document.getElementById('ocBody').closest('.card').offsetParent),
        mast: ((document.querySelector('#orgchart > .w118mast p') || {}).textContent || ''), stats: ((document.querySelector('#w133 .w133stats') || {}).textContent || ''),
        board: Array.from(document.querySelectorAll('#w133 .w133board .w133bchip b')).map(x => x.textContent),
        execs: Array.from(document.querySelectorAll('#w133 .w133exec .w133c b')).map(x => x.textContent),
        teams: Array.from(document.querySelectorAll('#w133 .w133team h3')).map(h => h.childNodes[0].textContent.trim()),
        mkt: Array.from(document.querySelectorAll('#w133 .w133team[data-team="marketing"] > .w133node > .w133c b')).map(x => x.textContent),
        ianKids: Array.from(document.querySelectorAll('#w133 .w133team[data-team="marketing"] .w133node[data-n="9"] > .w133kids > .w133node > .w133c b')).map(x => x.textContent),
        ianCnt: ((document.querySelector('#w133 .w133c[data-w133p="9"] .cnt') || {}).textContent || ''),
        cindy: ((document.querySelector('#w133 .w133c[data-w133p="16"]') || {}).innerText || '').replace(/\s+/g, ' '),
        open: ((document.querySelector('#w133 .w133c.open[data-w133p="60"]') || {}).innerText || '').replace(/\s+/g, ' '),
        openUnder: !!document.querySelector('#w133 .w133node[data-n="28"] .w133node[data-n="60"]'),
        tray: Array.from(document.querySelectorAll('#w133 .w133tray .w133bchip b')).map(x => x.textContent),
        arr: !!document.querySelector('#w133 [data-w133arr]'), add: !!document.querySelector('#w133 .w133bar [data-w133addteam]') }));
      ok("the new chart replaces the old roster card", s.active === 'orgchart' && !s.old, s);
      ok("the masthead says who reports to whom", /Who reports to whom/.test(s.mast), s.mast);
      ok("the numbers: people, open positions, not placed, teams", /38 people on the chart/.test(s.stats) && /1 open position/.test(s.stats) && /2 not placed yet/.test(s.stats) && /6 teams/.test(s.stats), s.stats);
      ok("the board band holds the directors, the co-EDs lead the executive row", s.board.join('|') === 'Kellian|Mohamed|Rima Naim|Tamara' && s.execs.join('|') === 'Steel|Suhaib', s);
      ok("six team columns in the menu's order", s.teams.join('|') === 'Operations Montreal|Program Development|Operations Toronto|Marketing, Branding & Web|Fundraising & Finances|Human Resources', s.teams);
      ok("a team's leads come first, with their people nested under them", s.mkt.join('|') === 'Ian|Kahkashan' && s.ianKids.length === 7 && s.ianKids.indexOf('Eduardo de Freitas') >= 0 && s.ianCnt === '7', s);
      ok("someone reporting to one executive says so", /Cindy/.test(s.cindy) && /reports to Suhaib/.test(s.cindy), s.cindy);
      ok("an open position shows as open, with its status and note, under its manager", /Open position/i.test(s.open) && /Volunteer coordinator, Toronto/.test(s.open) && /Hiring/i.test(s.open) && /Recruiting now/.test(s.open) && s.openUnder, s);
      ok("people not placed yet are listed", s.tray.join('|') === 'Info Test|Steel Test', s.tray);
      ok(EDITOR ? "an editor sees Rearrange and Open position" : "a member sees no editing", EDITOR ? (s.arr && s.add) : (!s.arr && !s.add), s);
      if (PHONE) ok("phone: the chart fits the screen", await fits(f));
      /* search, filter, open positions */
      await f.page.click('#w133q'); await f.page.keyboard.type('soraya', { delay: 25 }); await f.page.waitForTimeout(500);
      const q = await f.ev(() => ({ hits: Array.from(document.querySelectorAll('#w133 .w133c.hit b')).map(x => x.textContent), searching: document.getElementById('w133').classList.contains('searching'), focus: document.activeElement && document.activeElement.id }));
      ok("search highlights the person and keeps the focus", q.searching && q.hits.join('|') === 'Soraya' && q.focus === 'w133q', q);
      await f.page.fill('#w133q', ''); await f.page.dispatchEvent('#w133q', 'input'); await f.page.waitForTimeout(400);
      await click(f, '#w133 [data-w133team="opsto"]', 400);
      const tf = await f.ev(() => ({ teams: document.querySelectorAll('#w133 .w133team').length, board: !!document.querySelector('#w133 .w133board'), t: ((document.querySelector('#w133 .w133team h3') || {}).textContent || '') }));
      ok("a team chip shows one team", tf.teams === 1 && !tf.board && /Operations Toronto/.test(tf.t), tf);
      await f.page.click('#w133open'); await f.page.waitForTimeout(300);
      ok("the open positions can be hidden", await f.ev(() => !document.querySelector('#w133 .w133c.open') && !/open position/.test(document.querySelector('#w133 .w133stats').textContent) === false));
      await f.page.click('#w133open'); await click(f, '#w133 [data-w133team=""]', 400);
      /* a person's sheet */
      await click(f, '#w133 .w133c[data-w133p="21"]', 500);
      const sh = await f.ev(() => { const s = document.getElementById('w133sheet'); return { on: s && s.classList.contains('on'), h: (s.querySelector('h2') || {}).textContent, kk: (s.querySelector('.kk') || {}).textContent, mgr: s.querySelector('#w133mgr') ? s.querySelector('#w133mgr').value : ((s.querySelector('.sec .who b') || {}).textContent || ''), picks: s.querySelectorAll('#w133picks input').length, prof: !!s.querySelector('[data-w133go^="#person/"]') }; });
      ok("a person's sheet shows their reporting line" + (EDITOR ? ' with the editors’ controls' : ' read-only'), sh.on && sh.h === 'Eduardo de Freitas' && /Marketing/.test(sh.kk) && (EDITOR ? sh.mgr === '9' && sh.picks > 20 : sh.mgr === 'Ian' && sh.picks === 0) && sh.prof, sh);
      await shot(f, 'sheet');
      if (EDITOR) {
        /* choose direct reports: Eduardo gets Soraya and Alejandra */
        await f.page.fill('#w133pq', 'soraya'); await f.page.dispatchEvent('#w133pq', 'input'); await f.page.waitForTimeout(200);
        await f.page.check('#w133picks input[data-w133pick="6"]');
        await f.page.fill('#w133pq', 'alejandra'); await f.page.dispatchEvent('#w133pq', 'input'); await f.page.waitForTimeout(200);
        await f.page.check('#w133picks input[data-w133pick="23"]');
        await f.page.fill('#w133pq', ''); await f.page.dispatchEvent('#w133pq', 'input'); await f.page.waitForTimeout(200);
        const kept = await f.ev(() => ({ s: document.querySelector('#w133picks input[data-w133pick="6"]').checked, a: document.querySelector('#w133picks input[data-w133pick="23"]').checked }));
        await click(f, '#w133sheet [data-w133do="reports"]', 900);
        const sr = await rpcs(f, 'org_set_reports');
        ok("choose direct reports: the picks survive the search and are saved", sr.length === 1 && sr[0].args.p_id === 21 && JSON.stringify(sr[0].args.p_reports.sort((a, b) => a - b)) === JSON.stringify([6, 23]), { sr, kept });
        ok("and the chart nests them under Eduardo", await f.ev(() => !!document.querySelector('#w133 .w133node[data-n="21"] .w133node[data-n="6"]') && !!document.querySelector('#w133 .w133node[data-n="21"] .w133node[data-n="23"]')));
        /* reports to */
        await f.page.selectOption('#w133mgr', '24');
        await click(f, '#w133sheet [data-w133do="mgr"]', 900);
        const mv = await rpcs(f, 'org_move');
        ok("Reports to: Eduardo now reports to Kahkashan", mv.length === 1 && mv[0].args.p_id === 21 && mv[0].args.p_reports_to === 24, mv);
        ok("with an undo bar", await f.ev(() => /Eduardo de Freitas now reports to Kahkashan/.test((document.getElementById('w133snack') || {}).textContent || '')));
        await click(f, '#w133snack [data-w133sn="0"]', 900);
        const un = await rpcs(f, 'org_move');
        ok("Undo moves him back", un.length === 2 && un[1].args.p_id === 21 && un[1].args.p_reports_to === 9, un);
        /* the options never offer someone's own people */
        const opts = await f.ev(() => Array.from(document.querySelectorAll('#w133mgr option')).map(o => o.value));
        ok("Reports to never offers someone who reports to them", opts.indexOf('6') < 0 && opts.indexOf('23') < 0 && opts.indexOf('9') >= 0 && opts[0] === '', opts.slice(0, 6));
        /* the title */
        await f.page.fill('#w133title', 'Branding and design lead');
        await click(f, '#w133sheet [data-w133do="save"]', 800);
        const up = await rpcs(f, 'org_update');
        ok("retitle the seat (their role everywhere)", up.length === 1 && up[0].args.p_title === 'Branding and design lead' && await f.ev(() => DB_MEMBERS.filter(m => m.id === 20)[0].role === 'Branding and design lead'), up);
        /* add an open position under him */
        await click(f, '#w133sheet [data-w133addunder="21"]', 500);
        const nf = await f.ev(() => ({ h: (document.querySelector('#w133sheet h2') || {}).textContent, mgr: (document.getElementById('w133nmgr') || {}).value, team: (document.getElementById('w133nteam') || {}).value }));
        ok("Add an open position starts under him, on his team", nf.h === 'Add an open position' && nf.mgr === '21' && nf.team === 'marketing', nf);
        await click(f, '#w133sheet [data-w133do="create"]', 300);
        ok("a title is needed", await f.ev(() => /Give the position a title/.test((document.getElementById('w133err') || {}).textContent || '')));
        await f.page.fill('#w133ntitle', 'Junior designer'); await click(f, '#w133sheet [data-w133sts="on_hold"]', 100); await f.page.fill('#w133nnote', 'Once the brand refresh budget is set');
        await click(f, '#w133sheet [data-w133do="create"]', 900);
        const ao = await rpcs(f, 'org_add_opening');
        ok("it is added, on hold, with the note", ao.length === 1 && ao[0].args.p_reports_to === 21 && ao[0].args.p_title === 'Junior designer' && ao[0].args.p_status === 'on_hold' && ao[0].args.p_department === 'marketing' && /budget/.test(ao[0].args.p_note), ao);
        const nid = await f.ev(() => Math.max.apply(null, window.__WAFIX.org_positions.map(p => p.id)));
        ok("the sheet moves to the new position and the chart shows it", await f.ev(n => /Junior designer/.test((document.querySelector('#w133sheet h2') || {}).textContent || '') && !!document.querySelector('#w133 .w133node[data-n="21"] .w133c.open[data-w133p="' + n + '"]'), nid));
        /* fill it with someone not placed yet */
        await f.page.selectOption('#w133fill', '48');
        await click(f, '#w133sheet [data-w133do="fill"]', 900);
        const fl = await rpcs(f, 'org_fill');
        ok("fill it with someone not on the chart yet", fl.length === 1 && fl[0].args.p_id === nid && fl[0].args.p_member_id === 48, fl);
        ok("they leave the tray and appear in the seat", await f.ev(n => !Array.from(document.querySelectorAll('#w133 .w133tray b')).some(b => b.textContent === 'Steel Test') && !!document.querySelector('#w133 .w133c[data-w133p="' + n + '"][data-w133m="48"]'), nid));
        /* take someone off a seat, then remove the empty one */
        await f.ev(n => window.w133.open({ kind: 'seat', id: n }), nid); await f.page.waitForTimeout(300);
        await click(f, '#w133sheet [data-w133do="vacate"]', 900);
        ok("take someone off the seat (it stays open)", (await rpcs(f, 'org_vacate')).length === 1 && await f.ev(n => !!document.querySelector('#w133 .w133c.open[data-w133p="' + n + '"]'), nid));
        await click(f, '#w133sheet [data-w133do="remove"]', 900);
        ok("remove the empty position", (await rpcs(f, 'org_remove')).length === 1 && await f.ev(n => !document.querySelector('#w133 [data-w133p="' + n + '"]') && !document.querySelector('#w133sheet.on'), nid));
        /* place someone from the tray */
        await click(f, '#w133 .w133tray .w133bchip[data-w133m="47"]', 500);
        const pm = await f.ev(() => ({ h: (document.querySelector('#w133sheet h2') || {}).textContent, mgr: (document.getElementById('w133pmgr') || {}).value }));
        ok("someone not placed yet gets Place them, under their team's lead", pm.h === 'Info Test' && pm.mgr === '29', pm);
        await click(f, '#w133sheet [data-w133do="place"]', 900);
        const pl = await rpcs(f, 'org_place');
        ok("placed under Ahmed", pl.length === 1 && pl[0].args.p_member_id === 47 && pl[0].args.p_reports_to === 29, pl);
        await click(f, '#w133sheet .xb', 300);
        /* rearrange: drag and drop */
        if (!PHONE) {
          await click(f, '#w133 [data-w133arr]', 500);
          const ar = await f.ev(() => ({ arr: document.getElementById('w133').classList.contains('arr'), note: !!document.querySelector('#w133 .w133arr'), drag: document.querySelectorAll('#w133 .w133c[draggable="true"]').length, execDrag: !!document.querySelector('#w133 .w133exec .w133c[draggable="true"]') }));
          ok("Rearrange turns on dragging (not for the executive directors)", ar.arr && ar.note && ar.drag > 30 && !ar.execDrag, ar);
          await shot(f, 'arrange');
          await f.page.dragAndDrop('#w133 .w133c[data-w133p="13"]', '#w133 .w133c[data-w133p="24"]');
          await f.page.waitForTimeout(900);
          const dm = (await rpcs(f, 'org_move')).slice(-1)[0];
          ok("drag Patricia onto Kahkashan: she reports to Kahkashan", dm && dm.args.p_id === 13 && dm.args.p_reports_to === 24 && await f.ev(() => !!document.querySelector('#w133 .w133node[data-n="24"] .w133node[data-n="13"]')), dm);
          const before = (await rpcs(f, 'org_move')).length;
          await f.page.dragAndDrop('#w133 .w133c[data-w133p="9"]', '#w133 .w133c[data-w133p="4"]');
          await f.page.waitForTimeout(600);
          ok("a lead cannot be dropped onto one of their own people", (await rpcs(f, 'org_move')).length === before);
          await f.page.dragAndDrop('#w133 .w133c[data-w133p="21"]', '#w133 .w133team[data-team="marketing"] h3');
          await f.page.waitForTimeout(900);
          const hd = (await rpcs(f, 'org_move')).slice(-1)[0];
          ok("drag Eduardo onto the Marketing name: he becomes one of its leads", hd && hd.args.p_id === 21 && hd.args.p_reports_to === null && hd.args.p_department === 'marketing', hd);
          const b2 = (await rpcs(f, 'org_move')).length;
          await f.page.dragAndDrop('#w133 .w133c[data-w133p="21"]', '#w133 .w133team[data-team="hr"] h3');
          await f.page.waitForTimeout(700);
          ok("but not onto another team's name (that is a team change)", (await rpcs(f, 'org_move')).length === b2);
          await click(f, '#w133 [data-w133arr]', 400);
          ok("Done ends rearranging", await f.ev(() => !document.getElementById('w133').classList.contains('arr') && !document.querySelector('#w133 .w133c[draggable="true"]')));
        }
        /* an error from the database is shown */
        await f.ev(() => { window.__FAIL = { org_update: 'only executives and admins can change the chart' }; });
        await click(f, '#w133 .w133c[data-w133p="21"]', 400);
        await f.page.fill('#w133title', 'Anything'); await click(f, '#w133sheet [data-w133do="save"]', 600);
        ok("a refusal from the database is explained", await f.ev(() => /Only executives and admins can change the chart/.test((document.getElementById('w133err') || {}).textContent || '')));
        await f.ev(() => { window.__FAIL = {}; });
        if (PHONE) ok("phone: the sheet fits", await f.ev(() => { const p = document.querySelector('#w133sheet .pane'); return !!p && p.getBoundingClientRect().width <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
      } else {
        await click(f, '#w133sheet .xb', 300);
        await click(f, '#w133 .w133c.open[data-w133p="60"]', 400);
        const os = await f.ev(() => ({ t: (document.getElementById('w133sheet') || {}).innerText || '', ed: !!document.querySelector('#w133sheet [data-w133do]') }));
        ok("a member reads an open position, with Ask HR to recruit, and cannot edit", /Volunteer coordinator, Toronto/i.test(os.t) && /Recruiting now/.test(os.t) && /Ask HR to recruit/.test(os.t) && !os.ed, os);
      }
      await f.ctx.close();
    }
    /* 2. a person's page, and the deep link back */
    { const f = await fresh('#person/20');
      await f.page.waitForTimeout(900);
      const pl = await f.ev(() => ((document.querySelector('#personpage .w133pline') || {}).innerText || '').replace(/\s+/g, ' '));
      ok("a person's page says who they report to", /Reports to Ian/.test(pl) && /See on the org chart/.test(pl), pl);
      await click(f, '#personpage .w133pline [data-w133go^="#orgchart/"]', 1400);
      ok("See on the org chart opens the chart with their sheet", await f.ev(() => location.hash === '#orgchart/20' && (document.querySelector('.panel.active') || {}).id === 'orgchart' && /Eduardo/.test((document.querySelector('#w133sheet.on h2') || {}).textContent || '')));
      await f.hash('#person/17');
      const il = await f.ev(() => ((document.querySelector('#personpage .w133pline') || {}).innerText || '').replace(/\s+/g, ' '));
      ok("a lead's page lists their direct reports", /Reports to the executive directors/.test(il) && /7 direct reports/.test(il) && /and 2 more/.test(il), il);
      await f.ctx.close();
    }
    /* 3. the tour */
    { const f = await fresh('#orgchart');
      const t = await f.ev(() => { const T = (window.w122 && window.w122.tours && window.w122.tours.orgchart) || {}; return { n: (T.steps || []).length, s: (T.steps || []).map(x => x.s) }; });
      ok("the org chart tour walks the new chart", t.n === 7 && t.s.indexOf('#w133 .w133team') >= 0 && t.s.indexOf('#w133 [data-w133arr]') >= 0, t);
      await f.ctx.close();
    }
  }
  if (CASE === 'board') {
    const f = await fresh('#orgchart');
    const s = await f.ev(() => ({ active: (document.querySelector('.panel.active') || {}).id, chart: !!document.querySelector('#w133 .w133team'), editor: window.__RPC.filter(c => c.fn === 'wa_org_editor').length }));
    ok("a board viewer is not shown the chart", s.active !== 'orgchart' && !s.chart, s);
    await f.ctx.close();
  }
  ok("no page errors", errs.length === 0, errs);
  console.log(out.join("\n")); console.log(`\n${CASE} ${WIDTH}: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join("\n")); console.error(e); process.exit(2); });
