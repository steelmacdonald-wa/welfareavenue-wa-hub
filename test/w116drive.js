/* wave116 drive: team pages, boards, scoped agenda, calendar on Home (harness-style loader) */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p116");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (/wave116|team route|w116/.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };
      try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
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
  await page.waitForTimeout(2200);
  const out = { identity: TAG };
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 900); };
  const shot = async (n) => page.screenshot({ path: path.join(shots, TAG + "_" + n + ".png") });

  out.nav = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#tabBar .tab-group[data-w42g="departments"] .w42d'));
    return rows.map(r => ({ id: r.querySelector('.tab').dataset.tab, label: r.querySelector('.tab').textContent.trim(), hidden: r.querySelector('.tab').style.display === 'none', links: Array.from(r.querySelectorAll('.w42sub a, .w42sub .tab')).map(a => a.textContent.trim() + (a.classList.contains('tab') ? (a.style.display === 'none' ? ' [tab hidden]' : ' [tab]') : '')) }));
  });
  out.groups = await page.evaluate(() => Array.from(document.querySelectorAll('#tabBar .tab-group')).map(g => ({ g: g.dataset.w42g || g.dataset.w73g || (g.querySelector('.tab-group-h') || {}).textContent, tabs: Array.from(g.querySelectorAll(':scope > .tab-group-p > .tab, :scope > .tab-group-p > .w42d > .tab')).map(t => t.dataset.tab + (t.style.display === 'none' ? '(hidden)' : '')) })));
  await go("#finances", 900);
  out.finOpen = await page.evaluate(() => ({ panel: (document.querySelector('.panel.active') || {}).id, rowOpen: !!document.querySelector('#tabBar .w42d.w116open'), activeInSub: !!document.querySelector('#tabBar .w42sub .tab.active') }));
  await shot("0_finances_nav");
  await go("#hrcentre", 900);
  out.hrOpen = await page.evaluate(() => ({ panel: (document.querySelector('.panel.active') || {}).id, rowOpen: (document.querySelector('#tabBar .w42d.w116open .tab') || {}).dataset && document.querySelector('#tabBar .w42d.w116open .tab').dataset.tab }));
  out.agendasTabHidden = await page.evaluate(() => { const b = document.querySelector('#tabBar .tab[data-tab="agendas"]'); return b ? b.style.display === 'none' : null; });
  out.labels = await page.evaluate(() => ({ order: DEPT_ORDER.slice(), opsmtl: DEPT_LABEL.opsmtl, fund: DEPT_LABEL.fundraising, pd: DEPT_LABEL.progdev, sections: Object.keys(SECTIONS), pdSubs: (SECTIONS.progdev.subsections || []).map(s => s.title), opsSubs: (SECTIONS.opsmtl.subsections || []).map(s => s.title), fundSubs: (SECTIONS.fundraising.subsections || []).map(s => s.title), txkey: [txDeptKey('Program Development'), txDeptKey('Ops & Program Dev - Montreal'), txDeptKey('Operations Montreal'), txDeptKey('Fundraising & Finances')] }));

  /* home: upcoming meetings */
  await go("#mypage", 1500);
  out.home = await page.evaluate(() => { const s = document.getElementById('w116home'); return s ? { present: true, rows: s.querySelectorAll('.w116ev').length, rsvp: Array.from(s.querySelectorAll('.w116rsvp')).map(x => x.textContent.trim()), text: s.textContent.replace(/\s+/g, ' ').slice(0, 220), first: !!(s.parentElement && s.parentElement.firstElementChild === s) } : { present: false }; });
  await shot("1_home");

  /* team overview */
  await go("#team/opsmtl", 1600);
  out.opsOverview = await page.evaluate(() => {
    const h = document.getElementById('w116host');
    if (!h || !h.querySelector('.w116top')) return { activePanel: (document.querySelector('.panel.active') || {}).id, hash: location.hash, bounced: true };
    return { activePanel: (document.querySelector('.panel.active') || {}).id, title: (h.querySelector('.w116top h2') || {}).textContent, seg: Array.from(h.querySelectorAll('.w116seg a')).map(a => a.textContent.trim()), kpis: Array.from(h.querySelectorAll('.w116kpi')).map(k => k.textContent.replace(/\s+/g, ' ').trim()), cards: Array.from(h.querySelectorAll('.w116card h3')).map(x => x.firstChild.textContent.trim()), updates: h.querySelectorAll('.w116upd li').length, mentions: h.querySelectorAll('.w116men .m').length, events: h.querySelectorAll('#w116meet .w116ev').length, team: h.querySelectorAll('.w116team .r').length, activeTab: (document.querySelector('#tabBar .tab.active') || {}).dataset && document.querySelector('#tabBar .tab.active').dataset.tab, subOn: (document.querySelector('#tabBar .w42sub a.on') || {}).textContent };
  });
  await shot("2_ops_overview");
  if (out.opsOverview.bounced) {
    await go("#mypage", 800);
    out.boardHome = await page.evaluate(() => ({ home: !!document.getElementById('w116home'), agendasTab: !!document.querySelector('#tabBar .tab[data-tab="agendas"]') }));
    await go("#dept/progdev", 800);
    out.classicPd = await page.evaluate(() => ({ activePanel: (document.querySelector('.panel.active') || {}).id }));
    out.errors = errs; console.log(JSON.stringify(out, null, 2)); await browser.close(); return;
  }
  await go("#team/progdev", 1400);
  out.pdOverview = await page.evaluate(() => { const h = document.getElementById('w116host'); return { title: (h.querySelector('.w116top h2') || {}).textContent, kpis: Array.from(h.querySelectorAll('.w116kpi')).map(k => k.textContent.replace(/\s+/g, ' ').trim()), team: Array.from(h.querySelectorAll('.w116team .r b')).map(x => x.textContent), events: h.querySelectorAll('#w116meet .w116ev').length }; });
  await shot("3_pd_overview");

  /* scoped agenda */
  await go("#team/opsmtl/agenda", 1400);
  out.agenda = await page.evaluate(() => { const host = document.getElementById('w116agHost'); const card = host && host.querySelector('.ag-page-card'); return { mounted: !!card, deptSel: (document.getElementById('agNewDept') || {}).value, deptHidden: (document.getElementById('agNewDept') || {}).style && document.getElementById('agNewDept').style.display === 'none', filter: (document.getElementById('agFilterDept') || {}).value, count: (document.getElementById('agCount') || {}).textContent, body: (document.getElementById('agPageBody') || {}).textContent.replace(/\s+/g, ' ').slice(0, 120) }; });
  await shot("4_ops_agenda");
  await go("#agendas", 1200);
  out.masterAgenda = await page.evaluate(() => ({ activePanel: (document.querySelector('.panel.active') || {}).id, cardHome: !!document.querySelector('#agendas > .ag-page-card'), filter: (document.getElementById('agFilterDept') || {}).value, filterShown: document.getElementById('agFilterDept') && document.getElementById('agFilterDept').style.display !== 'none' }));

  /* tasks */
  await go("#team/opsmtl/tasks", 1500);
  out.tasks = await page.evaluate(() => { const s = document.getElementById('w116tasks'); return { groups: Array.from(s.querySelectorAll('.w116g .w116gh b')).map(x => x.textContent), rows: s.querySelectorAll('.w116r').length, toolbar: s.querySelectorAll('.w116tb select').length, note: (s.querySelector('.w116note') || {}).textContent }; });
  await shot("5_ops_tasks");
  const firstRow = await page.$('#w116tasks .w116r');
  if (firstRow) {
    await firstRow.click();
    await page.waitForTimeout(700);
    out.drawer = await page.evaluate(() => { const d = document.getElementById('w116dr'); return { open: d && d.classList.contains('open'), title: (d.querySelector('textarea.ttl') || {}).value, fields: d.querySelectorAll('[data-dfield]').length, comments: (document.getElementById('w116cm') || {}).textContent.replace(/\s+/g, ' ').slice(0, 80) }; });
    await shot("6_drawer");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    out.drawerClosed = await page.evaluate(() => !document.getElementById('w116dr').classList.contains('open'));
  }
  /* quick add */
  const add = await page.$('#w116tasks .w116gh .add');
  if (add) {
    await add.click(); await page.waitForTimeout(200);
    await page.keyboard.type("Harness task from quick add");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    out.quickAdd = await page.evaluate(() => ({ found: Array.from(document.querySelectorAll('#w116tasks .w116r .ttl')).some(x => x.textContent === 'Harness task from quick add'), toast: (document.getElementById('toast') || {}).textContent }));
  }
  /* views */
  await page.click('#w116tasks .w116seg a[data-v="board"]'); await page.waitForTimeout(600);
  out.board = await page.evaluate(() => ({ cols: Array.from(document.querySelectorAll('#w116tasks .w116kc')).map(c => c.querySelector('.w116kch').textContent.trim()), cards: document.querySelectorAll('#w116tasks .w116kd').length }));
  await shot("7_ops_board");
  await page.click('#w116tasks .w116seg a[data-v="cal"]'); await page.waitForTimeout(600);
  out.cal = await page.evaluate(() => ({ month: (document.querySelector('#w116tasks .w116calh b') || {}).textContent, pills: document.querySelectorAll('#w116tasks .w116cp').length }));
  await shot("8_ops_calendar");
  await page.click('#w116tasks .w116seg a[data-v="list"]'); await page.waitForTimeout(400);

  /* fundraising & finances */
  await go("#team/fundraising", 1500);
  out.fund = await page.evaluate(() => { const h = document.getElementById('w116host'); return { title: (h.querySelector('.w116top h2') || {}).textContent, boards: Array.from(h.querySelectorAll('.w116bcard .n')).map(x => x.textContent), seg: Array.from(h.querySelectorAll('.w116seg a')).map(a => a.textContent.trim()) }; });
  await shot("9_fund_overview");
  await go("#team/fundraising/grants", 1400);
  out.grants = await page.evaluate(() => { const s = document.getElementById('w116tasks'); return { title: (document.querySelector('#w116host .w116top h2') || {}).textContent, groups: Array.from(s.querySelectorAll('.w116g .w116gh b')).map(x => x.textContent), rows: s.querySelectorAll('.w116r').length, tags: Array.from(s.querySelectorAll('.w116r .w116tag')).map(x => x.textContent).slice(0, 6) }; });
  await shot("10_grants");
  const gRow = await page.$('#w116tasks .w116r');
  if (gRow) {
    await gRow.click(); await page.waitForTimeout(800);
    out.drawer = await page.evaluate(() => { const d = document.getElementById('w116dr'); return { open: d && d.classList.contains('open'), title: (d.querySelector('textarea.ttl') || {}).value, fields: d.querySelectorAll('[data-dfield]').length, status: (d.querySelector('select[data-dfield="status"]') || {}).value, comments: (document.getElementById('w116cm') || {}).textContent.replace(/\s+/g, ' ').slice(0, 60), acts: (document.getElementById('w116acts') || {}).textContent.replace(/\s+/g, ' ').slice(0, 60) }; });
    await shot("10b_drawer");
    await page.selectOption('#w116dr select[data-dfield="status"]', 'In progress'); await page.waitForTimeout(600);
    out.drawerStatus = await page.evaluate(() => ({ pill: (document.querySelector('#w116dr .w116st') || {}).textContent, toast: (document.getElementById('toast') || {}).textContent, rowPill: Array.from(document.querySelectorAll('#w116tasks .w116r .w116st')).map(x => x.textContent) }));
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    out.drawerClosed = await page.evaluate(() => !document.getElementById('w116dr').classList.contains('open'));
    /* bulk select */
    await page.click('#w116tasks .w116r input[data-act="sel"]'); await page.waitForTimeout(300);
    out.bulk = await page.evaluate(() => ({ bar: !!document.querySelector('#w116tasks .w116bulk'), text: (document.querySelector('#w116tasks .w116bulk b') || {}).textContent }));
    await page.selectOption('#w116tasks select[data-bulk="status"]', 'Waiting'); await page.waitForTimeout(700);
    out.bulkDone = await page.evaluate(() => ({ bar: !!document.querySelector('#w116tasks .w116bulk'), pills: Array.from(document.querySelectorAll('#w116tasks .w116r .w116st')).map(x => x.textContent), toast: (document.getElementById('toast') || {}).textContent }));
  }
  await go("#team/fundraising/finance", 1400);
  out.finance = await page.evaluate(() => { const h = document.getElementById('w116host'); return { title: (h.querySelector('.w116top h2') || {}).textContent, toolLink: !!h.querySelector('[data-w116go="#finances"]'), rows: h.querySelectorAll('.w116r').length }; });
  await shot("11_finance");
  await go("#team/fundraising/tasks", 1200);
  out.fundAll = await page.evaluate(() => { const s = document.getElementById('w116tasks'); return { groups: Array.from(s.querySelectorAll('.w116g .w116gh b')).map(x => x.textContent), groupSel: (s.querySelector('select[data-act="group"]') || {}).value }; });

  /* profile: responsibilities + JD */
  const shimaId = await page.evaluate(() => (DB_MEMBERS.filter(m => m.name === 'Shima')[0] || {}).id);
  const ahmedId = await page.evaluate(() => (DB_MEMBERS.filter(m => m.name === 'Ahmed')[0] || {}).id);
  if (shimaId) {
    await go("#person/" + shimaId, 1800);
    out.profile = await page.evaluate(() => { const r = document.getElementById('w116resp'); return r ? { present: true, items: Array.from(r.querySelectorAll('li')).map(x => x.textContent), jd: (r.querySelector('.jd a') || {}).textContent, edit: !!r.querySelector('[data-w116r]'), afterStats: !!(r.previousElementSibling && r.previousElementSibling.id === 'w33stats') } : { present: false }; });
    await shot("14_profile");
  }
  if (ahmedId) {
    await go("#person/" + ahmedId, 1800);
    const editBtn = await page.$('#w116resp [data-w116r]');
    if (editBtn) {
      await editBtn.click(); await page.waitForTimeout(700);
      out.profileEditor = await page.evaluate(() => ({ open: !!document.getElementById('w116jd'), jdOptions: Array.from(document.querySelectorAll('#w116jd option')).map(o => o.textContent).slice(0, 4) }));
      await page.selectOption('#w116jd', { index: 1 });
      await page.click('#w116pull'); await page.waitForTimeout(700);
      out.profilePull = await page.evaluate(() => Array.from(document.querySelectorAll('.w116ri')).map(i => i.value));
      await shot("15_profile_editor");
      await page.click('#w116rs'); await page.waitForTimeout(700);
      out.profileSaved = await page.evaluate(() => { const r = document.getElementById('w116resp'); return { items: Array.from(r.querySelectorAll('li')).map(x => x.textContent).length, jd: (r.querySelector('.jd a') || {}).textContent, toast: (document.getElementById('toast') || {}).textContent }; });
    }
  }
  /* chevron toggles a menu without navigating; hover does nothing */
  await go("#mypage", 800);
  out.menuBefore = await page.evaluate(() => Array.from(document.querySelectorAll('#tabBar .w42d')).map(r => r.querySelector('.tab').dataset.tab + ':' + (r.classList.contains('w116open') ? 'open' : 'closed')));
  await page.hover('#tabBar .tab[data-tab="hr"]'); await page.waitForTimeout(300);
  out.hoverOpens = await page.evaluate(() => { const r = document.querySelector('#tabBar .tab[data-tab="hr"]').closest('.w42d'); return getComputedStyle(r.querySelector('.w42sub')).display; });
  await page.click('#tabBar [data-w116chev="hr"]'); await page.waitForTimeout(300);
  out.chevOpens = await page.evaluate(() => { const r = document.querySelector('#tabBar .tab[data-tab="hr"]').closest('.w42d'); return { open: r.classList.contains('w116open'), display: getComputedStyle(r.querySelector('.w42sub')).display, hash: location.hash }; });
  await page.click('#tabBar .tab[data-tab="marketing"]'); await page.waitForTimeout(1200);
  out.clickTeam = await page.evaluate(() => ({ hash: location.hash, open: Array.from(document.querySelectorAll('#tabBar .w42d.w116open .tab')).map(t => t.dataset.tab) }));
  await shot("16_menu_click");

  /* strategy section + executive decisions page; Needs me hidden */
  out.strategy = await page.evaluate(() => { const g = document.querySelector('#tabBar .tab-group[data-w42g="strategy"]'); return g ? { header: g.querySelector('.tab-group-h').textContent.trim(), tabs: Array.from(g.querySelectorAll('.tab')).map(t => t.textContent.trim() + (t.style.display === 'none' ? '(hidden)' : '')) } : null; });
  out.needsMe = await page.evaluate(() => { const b = document.getElementById('needsMeBtn'); return b ? getComputedStyle(b).display : 'absent'; });
  await go("#decisions", 1200);
  out.dashboard = await page.evaluate(() => ({ panel: (document.querySelector('.panel.active') || {}).id, folders: !!document.getElementById('w111folds'), stats: !!document.getElementById('w35stats'), decisions: document.querySelectorAll('#overview #decisionList li[data-decision]').length, activeTab: (document.querySelector('#tabBar .tab.active') || {}).dataset && document.querySelector('#tabBar .tab.active').dataset.tab, topTabs: Array.from(document.querySelectorAll('#tabBar > .tab')).map(t => t.dataset.tab + (t.style.display === 'none' ? '(hidden)' : '')) }));
  await shot("17_exec_dashboard");
  await go("#goals", 1500);
  out.goals = await page.evaluate(() => ({ heading: (document.querySelector('#goals .card h2') || {}).textContent, tab: (document.querySelector('#tabBar .tab[data-tab="goals"]') || {}).textContent, tabs: Array.from(document.querySelectorAll('#w68tabs .w68tab')).map(t => t.textContent + (getComputedStyle(t).display === 'none' ? '(hidden)' : '') + (t.classList.contains('on') ? '*' : '')), projInGoals: !!document.querySelector('#goals #w68projview') }));
  await go("#projects", 1800);
  out.projects = await page.evaluate(() => ({ panel: (document.querySelector('.panel.active') || {}).id, groups: Array.from(document.querySelectorAll('#projects .w116pg .gh b')).map(x => x.textContent), cards: document.querySelectorAll('#projects .w116pc').length, sums: Array.from(document.querySelectorAll('#projects .sum .k')).map(k => k.textContent.replace(/\s+/g, ' ').trim()), noLead: document.querySelectorAll('#projects .w116pc .f.none').length, subs: document.querySelectorAll('#projects .w116pc .subs a').length, activeTab: (document.querySelector('#tabBar .tab.active') || {}).dataset && document.querySelector('#tabBar .tab.active').dataset.tab }));
  await shot("18_projects");
  /* set a lead inline on the first card */
  const leadF = await page.$('#projects .w116pc .f[data-pact="lead"]');
  if (leadF) {
    await leadF.click(); await page.waitForTimeout(300);
    await page.evaluate(() => { const s = document.querySelector('#projects .w116pc select.inl'); if (s) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.waitForTimeout(700);
    out.leadSet = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, firstLead: (document.querySelector('#projects .w116pc .f[data-pact="lead"] .t span') || {}).textContent }));
  }
  await page.click('#projects .w116seg a[data-v="list"]'); await page.waitForTimeout(500);
  out.projectsList = await page.evaluate(() => ({ rows: document.querySelectorAll('#projects .w116pl tbody tr').length }));
  await shot("19_projects_list");
  await page.click('#projects .w116seg a[data-v="cards"]'); await page.waitForTimeout(400);
  await go("#goals", 1200);
  out.goalsAgain = await page.evaluate(() => ({ deptViewShown: getComputedStyle(document.getElementById('w68deptview')).display !== 'none', projTabHidden: getComputedStyle(document.querySelector('#w68tabs [data-w68v="proj"]')).display === 'none' }));

  /* classic page still works, volunteering redirect */
  await go("#dept/progdev", 1000);
  out.classicPd = await page.evaluate(() => ({ activePanel: (document.querySelector('.panel.active') || {}).id, h2: (document.querySelector('#progdev h2') || {}).textContent }));
  await go("#team/opsmtl/volunteering", 900);
  out.volRedirect = await page.evaluate(() => ({ hash: location.hash, activePanel: (document.querySelector('.panel.active') || {}).id }));

  /* phone width smoke */
  await page.setViewportSize({ width: 390, height: 844 });
  await go("#team/opsmtl", 1400);
  await shot("12_ops_overview_phone");
  await go("#team/opsmtl/tasks", 1200);
  await shot("13_ops_tasks_phone");

  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
