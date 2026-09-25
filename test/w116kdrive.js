/* wave116k drive: the profile page (#person/<id>) */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p116k");
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
      try { localStorage.setItem('wa84tour', '1'); } catch (e) {}
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.addInitScript(`
    (function(){
      var F = window.__WAFIX; var now = new Date(${JSON.stringify(FIXED_TIME)}).getTime(); var iso = function (ms) { return new Date(ms).toISOString(); };
      (F.team_members || []).forEach(function (m) {
        if (m.id === 37) { m.jd_url = 'https://docs.google.com/document/d/1TVSg05HIQo53fSCGnaer4J6fOQ_WQW7cWIoUk6nYaWM/edit'; m.jd_name = "Welfare Avenue's Executive Directors Job Description"; m.responsibilities = ['Strategic leadership: the strategic plan with the board', 'Board governance as President', 'Financial oversight with the Co-ED and the treasurer', 'Fundraising and resource development', 'External relations: primary spokesperson']; }
        if (m.id === 32) { m.responsibilities = ['Owns the annual fundraising event calendar', 'Leads Flag Football, the Holiday Gift Basket Drive and the Rally Paper', 'Manages event budgets']; m.jd_url = 'https://docs.google.com/document/d/1xqWGVamvgvirrog8xLhgytHUig134arUkAk1VXMQEL0/edit'; m.jd_name = 'Fundraising Event Manager'; }
      });
      (F.projects || []).forEach(function (p) { if (p.id === 13) p.leads = ['Eduardo Marquez', 'Steel']; if (p.id === 1) p.leads = ['Steel MacDonald']; if (p.id === 2) p.leads = ['Daniela']; });
      F.hub_checkins = [
        { id: 1, email: 'steel.macdonald@welfareavenue.com', name: 'Steel MacDonald', department: 'board', started_at: iso(now - 3 * 3600000), ended_at: iso(now - 3600000), minutes: 120, source: 'hub' },
        { id: 2, email: 'steel.macdonald@welfareavenue.com', name: 'Steel MacDonald', department: 'board', started_at: iso(now - 2 * 86400000), ended_at: iso(now - 2 * 86400000 + 90 * 60000), minutes: 90, source: 'hub' },
        { id: 3, email: 'steel.macdonald@welfareavenue.com', name: 'Steel MacDonald', department: 'board', started_at: iso(now - 20 * 86400000), ended_at: iso(now - 20 * 86400000 + 60 * 60000), minutes: 60, source: 'hub' }
      ];
      F.hub_connections = [];
    })();
  `);
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
  const shot = async (n, full) => page.screenshot({ path: path.join(shots, TAG + "_" + n + ".png"), fullPage: !!full });
  const read = () => page.evaluate(() => {
    const sec = document.querySelector('section#personpage:not([data-w116kdecoy])');
    if (!sec) return { missing: true, hash: location.hash, active: (document.querySelector('.panel.active') || {}).id };
    const q = s => sec.querySelector(s); const qa = s => Array.from(sec.querySelectorAll(s));
    const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
    return {
      active: (document.querySelector('.panel.active') || {}).id, decoys: document.querySelectorAll('[data-w116kdecoy]').length, personSections: document.querySelectorAll('#personpage').length,
      name: txt(q('.w116khead h2')), role: txt(q('.w116khead .role')), meta: txt(q('.w116khead .meta')), acts: qa('.w116khead .acts a').map(txt),
      kpis: qa('.w116kpi').map(txt), cards: qa('.w116card h3').map(txt),
      resp: qa('#w116krespslot #w116resp li').map(txt), jdLink: (q('#w116krespcard h3 a.lnk') || {}).href, jdInBlock: txt(q('#w116resp .jd')), editLink: !!q('#w116resp [data-w116r="edit"]'),
      projects: qa('.w116kpro .p .n').map(txt), openRows: qa('#w116kopenlist .t').length, doneRows: qa('#w116kdonelist .t').length, moreLinks: qa('[data-w116kmore]').map(txt),
      hours: txt(q('#w116khours')), meetings: qa('#w116kmeet .w116ev').length, training: txt(q('#w116ktrainh')), trainingRows: qa('#w116ktrainslot .w36prog-row').length, team: qa('.w116kteam a').map(txt).slice(0, 6), about: txt(q('#w116kabout')),
      oldLayoutLeft: !!q('.w33head')
    };
  });

  /* 1. my profile via the menu */
  await page.click('.wa-toolbar .pill.w115pill .w116jcaret'); await page.waitForTimeout(300);
  const mp = await page.$('#w115menu [data-w116j="profile"]');
  if (mp) { await mp.click(); await page.waitForTimeout(2500); }
  out.hash = await page.evaluate(() => location.hash);
  out.me = await read();
  await shot("1_my_profile", true);

  /* 2. show all open, task click routes to the team board */
  const more = await page.$('#personpage [data-w116kmore="w116kopenlist"]');
  if (more) { await more.click(); await page.waitForTimeout(300); out.afterMore = await page.evaluate(() => document.querySelectorAll('#w116kopenlist .t').length); }
  const firstTask = await page.$('#personpage #w116kopenlist .t');
  if (firstTask) { const tid = await firstTask.getAttribute('data-w116kt'); await firstTask.click(); await page.waitForTimeout(2000); out.taskClick = Object.assign({ tid }, await page.evaluate(() => ({ hash: location.hash, panel: (document.querySelector('.panel.active') || {}).id, drawer: !!(document.getElementById('w116dr') && document.getElementById('w116dr').classList.contains('open')) }))); await page.keyboard.press('Escape'); await page.waitForTimeout(200); }

  /* 3. someone else's profile: Amanda (27), then a person with nothing: Mohamed (40) */
  await go('#person/32', 2500);
  out.daniela = await read();
  await shot("2_daniela", true);
  /* project click */
  const pj = await page.$('#personpage .w116kpro .p .n');
  if (pj) { await pj.click(); await page.waitForTimeout(1200); out.projectClick = await page.evaluate(() => ({ hash: location.hash, panel: (document.querySelector('.panel.active') || {}).id })); }
  await go('#person/40', 2500);
  out.mohamed = await read();

  /* 4. edit responsibilities opens the wave116c editor */
  await go('#person/32', 2500);
  const ed = await page.$('#personpage [data-w116ka="resp"]');
  if (ed) { await ed.click(); await page.waitForTimeout(700); out.editor = await page.evaluate(() => ({ open: getComputedStyle(document.getElementById('modalBack')).display !== 'none', title: (document.querySelector('#modalBack h3') || {}).textContent, inputs: document.querySelectorAll('.w116ri').length, jdSelect: !!document.getElementById('w116jd') })); await page.fill('.w116ri >> nth=2', 'Harness responsibility'); await page.click('#w116rs'); await page.waitForTimeout(900); out.afterSave = await page.evaluate(() => ({ modalClosed: getComputedStyle(document.getElementById('modalBack')).display === 'none', resp: Array.from(document.querySelectorAll('#w116krespslot #w116resp li')).map(x => x.textContent), blockInSlot: !!document.querySelector('#w116krespslot #w116resp'), stray: document.querySelectorAll('#personpage #w116resp').length })); }

  /* 5. navigate away and back quickly: no decoys left, one section */
  await go('#person/37', 300); await go('#person/32', 300); await go('#person/37', 2600);
  out.raceCheck = await page.evaluate(() => ({ decoys: document.querySelectorAll('[data-w116kdecoy]').length, sections: document.querySelectorAll('#personpage').length, name: (document.querySelector('#personpage .w116khead h2') || {}).textContent }));
  /* 6. org chart still opens profiles (wave100 name clicks) */
  await go('#orgchart', 1500);
  out.orgLink = await page.evaluate(() => !!document.querySelector('[data-ocp], [data-w33pp]'));
  /* 7. Home unchanged */
  await go('#mypage', 1200);
  out.home = await page.evaluate(() => ({ panel: (document.querySelector('.panel.active') || {}).id, decoys: document.querySelectorAll('[data-w116kdecoy]').length }));
  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
