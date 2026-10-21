/* wave116f/g drive: Strategy pages (Organizational goals, Department goals, Goal alignment) and the Executive dashboard */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p116f");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (/wave116|w116|goal/i.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };
      try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); localStorage.removeItem('wa116.deptgoals'); } catch (e) {}
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + "; window.__WAFIX.user_state = [{email: " + JSON.stringify(EMAIL) + ", last_seen_at: '2026-08-05T00:00:00+00:00'}];");
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
  const txt = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  /* menu */
  out.strategy = await page.evaluate(() => { const g = document.querySelector('#tabBar .tab-group[data-w42g="strategy"]'); return g ? { header: g.querySelector('.tab-group-h').textContent.trim(), tabs: Array.from(g.querySelectorAll('.tab')).map(t => t.dataset.tab + '=' + t.textContent.trim() + (t.style.display === 'none' ? '(hidden)' : '')), ok: window.w116StrategyOk ? window.w116StrategyOk() : null } : null; });

  /* executive dashboard */
  await go("#overview", 1800);
  out.exec = await page.evaluate(() => {
    const p = document.getElementById('overview');
    const h2 = Array.from(p.querySelectorAll('h2')).map(h => h.textContent.trim());
    const news = document.getElementById('w116news');
    const kpi = document.getElementById('w116kpi');
    return {
      panel: (document.querySelector('.panel.active') || {}).id,
      h2s: h2,
      intro: (p.querySelector('p.read[data-w116g]') || {}).textContent,
      legend: Array.from(p.querySelectorAll('.w116exl span')).map(s => s.textContent.trim()),
      chips: Array.from(p.querySelectorAll('#decFilters [data-fown]')).map(b => b.textContent.trim()),
      decides: Array.from(p.querySelectorAll('#decisionList li .ci-meta')).map(m => (m.textContent.match(/decides: [^·]+/) || [''])[0].trim()),
      whatsNewHidden: (function () { const w = document.getElementById('whatsNew'); return w ? getComputedStyle(w).display === 'none' : 'absent'; })(),
      kpiWrap: !!kpi, stripInWrap: !!(kpi && kpi.querySelector('#w35stats')), newsAfterStrip: !!(news && news.previousElementSibling && news.previousElementSibling.id === 'w35stats'),
      foldsAfterKpi: (function () { const f = document.getElementById('w111folds'); return f ? (f.previousElementSibling || {}).id : 'absent'; })(),
      news: news ? { head: txt(news.querySelector('.hd').textContent), items: Array.from(news.querySelectorAll('.w116an')).map(a => txt(a.querySelector('small').textContent) + ' | ' + txt(a.querySelector('.t').textContent) + (a.querySelector('.new') ? ' [new]' : '') + (a.classList.contains('pin') ? ' [pin]' : '')), post: !!news.querySelector('[data-anpost]') } : null,
      clickup: p.textContent.indexOf('ClickUp') >= 0
    };
    function txt(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  });
  await shot("1_exec_dashboard");
  /* owner filter chip */
  const chip = await page.$('#decFilters [data-fown="Suhaib"]');
  if (chip) { await chip.click(); await page.waitForTimeout(500); out.execFilterSuhaib = await page.evaluate(() => Array.from(document.querySelectorAll('#decisionList li .ci-meta')).map(m => (m.textContent.match(/decides: [^·]+/) || [''])[0].trim())); await page.click('#decFilters [data-fown=""]'); await page.waitForTimeout(300); }
  /* decisions waiting folder shows the same names */
  if (await page.$('#w111folds [data-w111f="aging"]')) { await page.click('#w111folds [data-w111f="aging"]'); await page.waitForTimeout(600); out.aging = await page.evaluate(() => Array.from(document.querySelectorAll('#w111body tr[data-w111dec]')).slice(0, 5).map(tr => { const tds = tr.querySelectorAll('td'); return tds[tds.length - 2].textContent.trim(); })); await shot("1b_aging"); await page.click('#w111folds [data-w111f="aging"]'); await page.waitForTimeout(300); }
  /* delivery numbers has no ClickUp card */
  if (await page.$('#w111folds [data-w111f="numbers"]')) { await page.click('#w111folds [data-w111f="numbers"]'); await page.waitForTimeout(900); out.numbers = await page.evaluate(() => ({ h2s: Array.from(document.querySelectorAll('#w111body h2')).map(h => h.textContent.trim().slice(0, 40)), clickup: (document.getElementById('w111body') || {}).textContent.indexOf('ClickUp') >= 0 })); await page.click('#w111folds [data-w111f="numbers"]'); await page.waitForTimeout(300); }
  /* add-decision modal: owner options */
  const addBtn = await page.$('#addDecisionBtn');
  if (addBtn && ROLE !== 'board') {
    await addBtn.click(); await page.waitForTimeout(500);
    out.decisionModal = await page.evaluate(() => ({ owners: Array.from(document.querySelectorAll('#dmOwner option')).map(o => o.value + ':' + (o.selected ? '*' : '')), areas: Array.from(document.querySelectorAll('#dmArea option')).map(o => o.value), label: (document.getElementById('dmOwner').previousElementSibling || {}).textContent }));
    await page.selectOption('#dmArea', 'Program Development'); await page.waitForTimeout(200);
    out.decisionModalArea = await page.evaluate(() => document.getElementById('dmOwner').value);
    await shot("1c_decision_modal");
    await page.click('#dmCancel'); await page.waitForTimeout(300);
  }
  /* post an announcement (admin/leader) */
  const post = await page.$('#w116news [data-anpost]');
  if (post) {
    await post.click(); await page.waitForTimeout(500);
    out.postModal = await page.evaluate(() => ({ kinds: Array.from(document.querySelectorAll('#w116ak option')).map(o => o.value), teams: document.querySelectorAll('#w116ad option').length }));
    await page.fill('#w116at', 'Harness announcement');
    await page.click('#w116as'); await page.waitForTimeout(800);
    out.posted = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, modalOpen: !!document.getElementById('w116as') }));
  }

  if (ROLE === 'board') {
    await go("#orggoals", 1200);
    out.boardOrg = await page.evaluate(() => ({ panel: (document.querySelector('.panel.active') || {}).id, hash: location.hash }));
    out.errors = errs; console.log(JSON.stringify(out, null, 2)); await browser.close(); return;
  }

  /* organizational goals */
  await go("#orggoals", 2000);
  out.org = await page.evaluate(() => {
    const p = document.getElementById('orggoals'); if (!p) return null;
    const cards = Array.from(p.querySelectorAll('.w116og'));
    return {
      panel: (document.querySelector('.panel.active') || {}).id, activeTab: (document.querySelector('#tabBar .tab.active') || {}).dataset && document.querySelector('#tabBar .tab.active').dataset.tab,
      title: (p.querySelector('.w116ptop h2') || {}).textContent, sums: Array.from(p.querySelectorAll('.sum .k')).map(k => k.textContent.replace(/\s+/g, ' ').trim()),
      cards: cards.map(c => ({ title: c.querySelector('h3').textContent.slice(0, 50), status: (c.querySelector('.w116gs') || {}).textContent, owner: (c.querySelector('.tag') || {}).textContent.replace(/\s+/g, ' ').trim(), progress: (c.querySelector('.w116gp span') || {}).textContent, smart: Array.from(c.querySelectorAll('.w116smart .s')).map(s => s.querySelector('b').textContent + ':' + (s.querySelector('.t').classList.contains('miss') ? 'MISSING' : s.querySelector('.t').textContent.slice(0, 28))), win: (c.querySelector('.w116win .t') || {}).textContent.slice(0, 40), inv: Array.from(c.querySelectorAll('.w116inv .c h4')).map(h => h.textContent.replace(/\s+/g, ' ').trim()), teams: Array.from(c.querySelectorAll('.w116inv .c:first-child .row .t')).map(x => x.textContent), kids: Array.from(c.querySelectorAll('.w116inv .c:nth-child(2) .row .t')).map(x => x.textContent.slice(0, 30)), projects: Array.from(c.querySelectorAll('.w116inv .c:nth-child(3) .row .t')).map(x => x.textContent.slice(0, 30)), tasks: c.querySelectorAll('.w116inv .c:nth-child(4) .row').length, foot: Array.from(c.querySelectorAll('.ft a')).map(a => a.textContent.trim()) }))
    };
  });
  await shot("2_org_goals");
  /* inline status change on the first org card */
  const st = await page.$('#orggoals .w116og .w116gs[data-gact="status"]');
  if (st) {
    await st.click(); await page.waitForTimeout(300);
    await page.evaluate(() => { const s = document.querySelector('#orggoals .w116og select.inl'); if (s) { s.value = 'at risk'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.waitForTimeout(700);
    out.orgStatus = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, pill: (document.querySelector('#orggoals .w116og .w116gs') || {}).textContent, sums: Array.from(document.querySelectorAll('#orggoals .sum .k')).map(k => k.textContent.replace(/\s+/g, ' ').trim()).slice(0, 3) }));
  }
  /* editor */
  const edit = await page.$('#orggoals .w116og .ft a[data-gact="edit"]');
  if (edit) {
    await edit.click(); await page.waitForTimeout(600);
    out.orgEditor = await page.evaluate(() => ({ open: !!document.querySelector('.w116gm'), fields: Array.from(document.querySelectorAll('.w116gm [data-gf]')).map(x => x.getAttribute('data-gf')), projectBoxes: document.querySelectorAll('.w116gm [data-gpk]').length, checked: document.querySelectorAll('.w116gm [data-gpk]:checked').length, deptDisabled: (document.querySelector('.w116gm [data-gf="department"]') || {}).disabled, title: (document.querySelector('.w116gm [data-gf="title"]') || {}).value.slice(0, 30) }));
    await shot("3_org_editor");
    await page.fill('.w116gm [data-gf="approach"]', 'Harness approach text');
    await page.click('#w116gsv'); await page.waitForTimeout(900);
    out.orgSaved = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, modalClosed: !document.querySelector('.w116gm'), approach: Array.from(document.querySelectorAll('#orggoals .w116og')).map(c => (Array.from(c.querySelectorAll('.w116smart .s')).filter(s => s.querySelector('b').textContent === 'Achievable')[0] || { querySelector: () => ({ textContent: '' }) }).querySelector('.t').textContent.slice(0, 30)) }));
  }
  /* new org goal modal opens and cancels */
  const neworg = await page.$('#orggoals [data-gact="neworg"]');
  if (neworg) { await neworg.click(); await page.waitForTimeout(400); out.newOrg = await page.evaluate(() => ({ h3: (document.querySelector('.w116gm h3') || {}).textContent, dept: (document.querySelector('.w116gm [data-gf="department"]') || {}).value, quarter: (document.querySelector('.w116gm [data-gf="quarter"]') || {}).value, rollup: !!document.querySelector('.w116gm [data-gf="parent_goal_id"]') })); await page.click('#w116gcx'); await page.waitForTimeout(300); }
  /* comments toggle */
  const cm = await page.$('#orggoals .w116og [data-glcmt]');
  if (cm) { await cm.click(); await page.waitForTimeout(300); out.orgComments = await page.evaluate(() => ({ open: !!document.querySelector('#orggoals .gl-cmts.open'), input: !!document.querySelector('#orggoals .gl-cmts.open [data-glci]') })); }

  /* department goals */
  await go("#goals", 2000);
  out.dept = await page.evaluate(() => {
    const p = document.getElementById('goals'); const b = document.getElementById('glBody');
    return {
      panel: (document.querySelector('.panel.active') || {}).id, heading: (p.querySelector('.card h2') || {}).textContent.trim(), intro: (p.querySelector('.card p.read') || {}).textContent.slice(0, 60),
      tab: (document.querySelector('#tabBar .tab[data-tab="goals"]') || {}).textContent, w68tabs: !!document.getElementById('w68tabs'), how: !!document.getElementById('w34how'),
      sums: Array.from(b.querySelectorAll('.sum .k')).map(k => k.textContent.replace(/\s+/g, ' ').trim()),
      chips: Array.from(b.querySelectorAll('.chips .chip')).map(c => c.textContent.replace(/\s+/g, ' ').trim() + (c.classList.contains('on') ? '*' : '')),
      quarters: Array.from(b.querySelectorAll('.w116seg a')).map(a => a.textContent.trim() + (a.classList.contains('on') ? '*' : '')),
      groups: Array.from(b.querySelectorAll('.w116gg')).map(g => g.querySelector('.gh b').textContent + ' (' + g.querySelector('.gh .n').textContent + ')' + (g.querySelector('.w116sug') ? ' +sug' : '')),
      cards: b.querySelectorAll('.w116gc').length, firstCard: (function () { const c = b.querySelector('.w116gc'); return c ? { title: c.querySelector('.nm').textContent.slice(0, 40), status: c.querySelector('.w116gs').textContent, tags: Array.from(c.querySelectorAll('.tags span')).map(s => s.textContent.trim()), progress: (c.querySelector('.w116gp span') || {}).textContent, foot: Array.from(c.querySelectorAll('.ft a')).map(a => a.textContent.trim()) } : null; })()
    };
  });
  await shot("4_dept_goals");
  /* all quarters, then open a card */
  await page.click('#glBody .w116seg a[data-v="__all"]'); await page.waitForTimeout(500);
  out.deptAll = await page.evaluate(() => ({ cards: document.querySelectorAll('#glBody .w116gc').length, groups: Array.from(document.querySelectorAll('#glBody .w116gg')).map(g => g.querySelector('.gh b').textContent + ' (' + g.querySelector('.gh .n').textContent + ')') }));
  const first = await page.$('#glBody .w116gc .nm');
  if (first) {
    await first.click(); await page.waitForTimeout(500);
    out.deptOpen = await page.evaluate(() => { const c = document.querySelector('#glBody .w116gc.open'); return c ? { title: c.querySelector('.nm').textContent.slice(0, 40), smart: c.querySelectorAll('.w116smart .s').length, inv: Array.from(c.querySelectorAll('.w116inv .c h4')).map(h => h.textContent.replace(/\s+/g, ' ').trim()), taskBoxes: c.querySelectorAll('.w116inv input[data-gltgl]').length, foot: Array.from(c.querySelectorAll('.ft a')).map(a => a.textContent.trim()) } : null; });
    await shot("5_dept_goal_open");
    /* tick a task box through the wave16 handler */
    const box = await page.$('#glBody .w116gc.open input[data-gltgl]:not(:checked)');
    if (box) { await box.click(); await page.waitForTimeout(800); out.deptTaskTick = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, stillOpen: !!document.querySelector('#glBody .w116gc.open') })); }
  }
  /* team chip filter + status filter + search */
  await page.click('#glBody .chip[data-team="hr"]'); await page.waitForTimeout(500);
  out.deptHr = await page.evaluate(() => ({ groups: Array.from(document.querySelectorAll('#glBody .w116gg')).map(g => g.querySelector('.gh b').textContent), cards: document.querySelectorAll('#glBody .w116gc').length }));
  await page.click('#glBody .chip[data-team=""]'); await page.waitForTimeout(400);
  await page.selectOption('#glBody select[data-gact="statusf"]', 'risk'); await page.waitForTimeout(500);
  out.deptRisk = await page.evaluate(() => ({ cards: document.querySelectorAll('#glBody .w116gc').length, statuses: Array.from(document.querySelectorAll('#glBody .w116gc .w116gs')).map(s => s.textContent) }));
  await page.selectOption('#glBody select[data-gact="statusf"]', 'active'); await page.waitForTimeout(400);
  await page.fill('#glBody input[data-gact="q"]', 'onboarding'); await page.waitForTimeout(600);
  out.deptSearch = await page.evaluate(() => ({ cards: document.querySelectorAll('#glBody .w116gc').length, titles: Array.from(document.querySelectorAll('#glBody .w116gc .nm')).map(x => x.textContent.slice(0, 40)), focused: document.activeElement && document.activeElement.getAttribute('data-gact') }));
  await page.fill('#glBody input[data-gact="q"]', ''); await page.waitForTimeout(500);
  /* new dept goal modal from a group */
  const addG = await page.$('#glBody .w116gg .gh .add[data-gact="newdept"]');
  if (addG) { await addG.click(); await page.waitForTimeout(500); out.newDept = await page.evaluate(() => ({ h3: (document.querySelector('.w116gm h3') || {}).textContent, dept: (document.querySelector('.w116gm [data-gf="department"]') || {}).value, quarter: (document.querySelector('.w116gm [data-gf="quarter"]') || {}).value, rollupOpts: document.querySelectorAll('.w116gm [data-gf="parent_goal_id"] option').length })); await shot("6_dept_editor"); await page.fill('.w116gm [data-gf="title"]', 'Harness goal'); await page.click('#w116gsv'); await page.waitForTimeout(900); out.newDeptSaved = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, found: Array.from(document.querySelectorAll('#glBody .w116gc .nm')).some(x => x.textContent === 'Harness goal') })); }

  /* goal alignment map */
  await go("#goalmap", 2000);
  await page.mouse.move(5, 5); await page.waitForTimeout(200);
  out.map = await page.evaluate(() => {
    const p = document.getElementById('goalmap'); if (!p) return null;
    const svg = p.querySelector('.w116map svg');
    return { panel: (document.querySelector('.panel.active') || {}).id, activeTab: (document.querySelector('#tabBar .tab.active') || {}).dataset && document.querySelector('#tabBar .tab.active').dataset.tab, title: (p.querySelector('.w116ptop h2') || {}).textContent, sums: Array.from(p.querySelectorAll('.sum .k')).map(k => k.textContent.replace(/\s+/g, ' ').trim()), cols: Array.from(p.querySelectorAll('.w116mcol')).map(c => c.querySelector('h4').textContent + ':' + c.querySelectorAll('.w116mn').length + ' (orphans ' + c.querySelectorAll('.w116mn.orph').length + ')'), paths: svg ? svg.querySelectorAll('path').length : -1, svgH: svg ? svg.style.height : null, links: p.querySelectorAll('.w116mn .lk').length, legend: (p.querySelector('.w116mleg') || {}).textContent.replace(/\s+/g, ' ').trim().slice(0, 80) };
  });
  await shot("7_map");
  /* hover + click focus */
  const nodeO = await page.$('#goalmap .w116mn[data-mn^="O"]');
  if (nodeO) {
    await nodeO.hover(); await page.waitForTimeout(300);
    out.mapHover = await page.evaluate(() => ({ hl: document.querySelectorAll('#goalmap .w116mn.hl').length, dim: document.querySelectorAll('#goalmap .w116mn.dim').length, hlPaths: document.querySelectorAll('#goalmap path.hl').length }));
    await nodeO.click(); await page.waitForTimeout(500);
    out.mapFocus = await page.evaluate(() => ({ hl: document.querySelectorAll('#goalmap .w116mn.hl').length, clear: !!document.querySelector('#goalmap [data-gact="mapclear"]') }));
    await shot("8_map_focus");
    await page.click('#goalmap [data-gact="mapclear"]'); await page.waitForTimeout(400);
    out.mapCleared = await page.evaluate(() => ({ hl: document.querySelectorAll('#goalmap .w116mn.hl').length }));
  }
  /* team filter */
  await page.click('#goalmap .chip[data-team="marketing"]'); await page.waitForTimeout(500);
  out.mapMarketing = await page.evaluate(() => ({ cols: Array.from(document.querySelectorAll('#goalmap .w116mcol')).map(c => c.querySelectorAll('.w116mn').length), paths: document.querySelectorAll('#goalmap path').length }));
  await page.click('#goalmap .chip[data-team=""]'); await page.waitForTimeout(400);
  /* link an orphan project from the map */
  const lk = await page.$('#goalmap .w116mn .lk[data-gact="linkproj"]');
  if (lk) { await lk.click(); await page.waitForTimeout(500); out.mapLink = await page.evaluate(() => ({ h3: (document.querySelector('.w116gm h3') || {}).textContent, groups: document.querySelectorAll('#w116lg optgroup').length, opts: document.querySelectorAll('#w116lg option').length })); await page.selectOption('#w116lg', { index: 1 }); await page.click('#w116ls'); await page.waitForTimeout(800); out.mapLinked = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, paths: document.querySelectorAll('#goalmap path').length })); }
  /* roll up an orphan dept goal */
  const ru = await page.$('#goalmap .w116mn .lk[data-gact="rollup"]');
  if (ru) { await ru.click(); await page.waitForTimeout(500); out.mapRollup = await page.evaluate(() => ({ h3: (document.querySelector('.w116gm h3') || {}).textContent.slice(0, 30), opts: document.querySelectorAll('#w116rg option').length })); await page.selectOption('#w116rg', { index: 1 }); await page.click('#w116rs'); await page.waitForTimeout(800); out.mapRolled = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent })); }

  /* cross links: org card -> map focus; sums -> pages */
  await go("#orggoals", 1200);
  const mapLink = await page.$('#orggoals .w116og .ft a[data-gact="map"]');
  if (mapLink) { await mapLink.click(); await page.waitForTimeout(1200); out.orgToMap = await page.evaluate(() => ({ hash: location.hash, hl: document.querySelectorAll('#goalmap .w116mn.hl').length, panel: (document.querySelector('.panel.active') || {}).id })); }

  /* projects page still fine, old goals hash */
  await go("#projects", 1500);
  out.projects = await page.evaluate(() => ({ panel: (document.querySelector('.panel.active') || {}).id, cards: document.querySelectorAll('#projects .w116pc').length }));

  /* phone width */
  await page.setViewportSize({ width: 390, height: 844 });
  await go("#orggoals", 1500); await shot("9_org_phone");
  await go("#goals", 1500); await shot("10_dept_phone");
  await go("#overview", 1500); await shot("11_exec_phone");

  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
