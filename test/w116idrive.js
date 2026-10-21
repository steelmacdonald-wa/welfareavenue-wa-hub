/* wave116i drive: classic page retired, Overview completeness, project alignment */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p116i");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (/wave116|w116|team route/.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };
      try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); localStorage.removeItem('wa116.projects'); } catch (e) {}
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    if (url.indexOf("fonts.g") >= 0 || url.indexOf("supabase.co/storage") >= 0) return route.continue();
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2600);
  const out = { identity: TAG };
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 900); };
  const shot = async (n) => page.screenshot({ path: path.join(shots, TAG + "_" + n + ".png"), fullPage: true });
  const active = () => page.evaluate(() => ({ panel: (document.querySelector('.panel.active') || {}).id, hash: location.hash }));

  /* redirects */
  await go("#dept/opsmtl", 1500); out.deptRedirect = await active();
  await go("#marketing", 1500); out.bareRedirect = await active();
  const firstTask = await page.evaluate(() => { const t = DB_TASKS.filter(x => !x.done && x.department === 'marketing')[0]; return t ? { id: t.id, title: t.title, dept: t.department } : null; });
  if (firstTask) {
    await go("#task/" + firstTask.id, 2200);
    out.taskRedirect = Object.assign(await active(), { drawerOpen: await page.evaluate(() => { const d = document.getElementById('w116dr'); return !!(d && d.classList.contains('open')); }), drawerTitle: await page.evaluate(() => (document.querySelector('#w116dr textarea.ttl') || {}).value), expected: firstTask.title });
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  out.classicHidden = await page.evaluate(() => ['opsmtl', 'marketing', 'fundraising'].map(id => getComputedStyle(document.getElementById(id)).display));

  /* overview completeness */
  await go("#team/opsmtl", 1800);
  out.overview = await page.evaluate(() => {
    const h = document.getElementById('w116host');
    const cards = Array.from(h.querySelectorAll('.w116card h3')).map(x => x.firstChild.textContent.trim());
    const prog = h.querySelector('.w116prog');
    return { cards, hasProgress: !!(prog && prog.querySelector('p.body')), priorities: prog ? prog.querySelectorAll('ol li').length : 0, pulse: prog ? (prog.querySelector('.pulse') || {}).textContent : null, rerun: !!h.querySelector('[data-w116act="rerun"]'), decisions: h.querySelectorAll('.w116dec .d').length, decLines: Array.from(h.querySelectorAll('.w116dec .d .m')).map(m => m.textContent.replace(/\s+/g, ' ').trim()).slice(0, 3), recBtn: !!h.querySelector('[data-w116act="rec"]'), addUpdate: !!h.querySelector('[data-w116act="addupd"]'), addTask: !!h.querySelector('[data-w116act="addtask"]'), addProject: !!h.querySelector('[data-w116act="addproj"]'), invite: !!h.querySelector('[data-w113deptinv]'), tools: Array.from(h.querySelectorAll('.w116tools a')).map(a => a.textContent.trim()), classicLinks: h.querySelectorAll('[data-w116go^="#dept/"]').length, foot: !!h.querySelector('.w116foot') };
  });
  await shot("1_overview");
  /* show all updates */
  const allBtn = await page.$('#w116host [data-w116act="allupd"]');
  if (allBtn) { await allBtn.click(); await page.waitForTimeout(400); out.allUpdates = await page.evaluate(() => ({ rows: document.querySelectorAll('#w116updcard .w116upd .u').length, label: (document.querySelector('#w116updcard h3 .lnk') || {}).textContent })); }
  /* add update modal opens */
  const addU = await page.$('#w116host [data-w116act="addupd"]');
  if (addU) { await addU.click(); await page.waitForTimeout(500); out.addUpdateModal = await page.evaluate(() => ({ open: getComputedStyle(document.getElementById('modalBack')).display !== 'none', title: (document.querySelector('#modalBack h3') || {}).textContent })); await page.fill('#w116ut', 'Harness update from the overview'); await page.click('#w116us'); await page.waitForTimeout(1200); out.addUpdateSaved = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, modalClosed: getComputedStyle(document.getElementById('modalBack')).display === 'none', overviewStill: !!document.querySelector('#w116host .w116prog') })); }
  const addT = await page.$('#w116host [data-w116act="addtask"]');
  if (addT) { await addT.click(); await page.waitForTimeout(500); out.addTaskModal = await page.evaluate(() => ({ open: getComputedStyle(document.getElementById('modalBack')).display !== 'none', title: (document.querySelector('#modalBack h3') || {}).textContent })); await page.evaluate(() => closeModal()); }
  /* fundraising overview: decisions + finance tool */
  await go("#team/fundraising", 1600);
  out.fundOverview = await page.evaluate(() => { const h = document.getElementById('w116host'); return { decisions: h.querySelectorAll('.w116dec .d').length, tools: Array.from(h.querySelectorAll('.w116tools a')).map(a => a.textContent.trim()), boards: Array.from(h.querySelectorAll('.w116bcard')).map(b => b.querySelector('.n').textContent + ':' + b.querySelector('.k').textContent.replace(/\s+/g, ' ').trim()) }; });

  /* project alignment: rename on the Projects page, check the team overview + board + goal page */
  await go("#projects", 1800);
  const pj = await page.evaluate(() => { const p = (window.w116Projects() || []).filter(x => x.department === 'marketing' && (x.status || 'active') === 'active')[0]; return p ? { id: p.id, name: p.name } : null; });
  out.projectPicked = pj;
  if (pj) {
    const editLink = await page.$('#projects .w116pc[data-pid="' + pj.id + '"] [data-pact="menu"]');
    if (editLink) {
      await editLink.click(); await page.waitForTimeout(500);
      await page.fill('#w116en', pj.name + ' (renamed)');
      await page.click('#w116es'); await page.waitForTimeout(800);
      out.renamed = await page.evaluate((id) => ({ store: (window.w116Projects().filter(x => Number(x.id) === Number(id))[0] || {}).name, legacy: (WA27_PROJECTS.filter(x => Number(x.id) === Number(id))[0] || {}).name, card: (document.querySelector('#projects .w116pc[data-pid="' + id + '"] .nm') || {}).textContent }), pj.id);
    }
    await go("#team/marketing", 1600);
    out.overviewSeesRename = await page.evaluate((name) => Array.from(document.querySelectorAll('#w116host .w116pro .p .n span')).some(s => s.textContent.indexOf(name + ' (renamed)') >= 0), pj.name);
    await go("#team/marketing/tasks", 1800);
    await page.evaluate(() => { const s = document.querySelector('#w116tasks select[data-act="group"]'); if (s) { s.value = 'project'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.waitForTimeout(600);
    out.boardSeesRename = await page.evaluate((name) => Array.from(document.querySelectorAll('#w116tasks .w116gh b')).map(b => b.textContent).filter(t => t.indexOf(name) >= 0), pj.name);
    await shot("2_board_by_project");
    /* drawer: team move field present */
    const row = await page.$('#w116tasks .w116r');
    if (row) { await row.click(); await page.waitForTimeout(600); out.drawerTeam = await page.evaluate(() => { const s = document.querySelector('#w116dr select[data-dfield="dept"]'); return s ? { options: s.options.length, value: s.value } : null; }); await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
    await go("#orggoals", 1500);
    out.goalsSeeRename = await page.evaluate((name) => Array.from(document.querySelectorAll('#orggoals .w116inv .row a.t')).map(a => a.textContent).filter(t => t.indexOf(name) >= 0), pj.name);
  }
  /* fundraising board membership by workstream (fixture has no workstream column: static ids still apply) */
  await go("#team/fundraising/grants", 1600);
  out.grantsProjects = await page.evaluate(() => (window.w116ProjectsFor('fundraising', WA_TEAMS.boards.fundraising[0]) || []).map(p => p.name));
  await go("#team/fundraising/events", 1600);
  out.eventsProjects = await page.evaluate(() => (window.w116ProjectsFor('fundraising', WA_TEAMS.boards.fundraising[1]) || []).map(p => p.name));
  /* new project modal shows the board field for fundraising */
  await go("#projects", 1500);
  const newBtn = await page.$('#projects [data-pact="new"]');
  if (newBtn) { await newBtn.click(); await page.waitForTimeout(400); await page.selectOption('#w116pt', 'fundraising'); await page.waitForTimeout(200); out.newProjectBoardField = await page.evaluate(() => ({ present: !!document.getElementById('w116pws'), options: Array.from(document.querySelectorAll('#w116pws option')).map(o => o.textContent) })); await page.click('#w116pc'); }

  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
