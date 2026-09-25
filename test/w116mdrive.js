/* wave116j drive: the header (one profile bubble, who is active, check in/out, Settings) */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p116m");
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
  /* presence and check-ins: three people seen just now, one of them checked in; some closed sessions this week */
  await page.addInitScript(`
    (function(){
      var F = window.__WAFIX; var now = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var iso = function (ms) { return new Date(ms).toISOString(); };
      var us = F.user_state || []; var seen = ['ian.odhiambo@welfareavenue.com','suhaib.abdillahi@welfareavenue.com','shima.butera@welfareavenue.com'];
      us.forEach(function (u) { if (seen.indexOf(u.email) >= 0) u.last_seen_at = iso(now - 120000); });
      us.push({ email: ${JSON.stringify(EMAIL.toLowerCase())}, last_seen_at: iso(now - 1000), updated_at: iso(now - 1000) });
      F.user_state = us;
      F.hub_checkins = [
        { id: 1, email: 'ian.odhiambo@welfareavenue.com', name: 'Ian Odhiambo', department: 'marketing', started_at: iso(now - 90 * 60000), ended_at: null, minutes: null, source: 'hub' },
        { id: 2, email: 'ian.odhiambo@welfareavenue.com', name: 'Ian Odhiambo', department: 'marketing', started_at: iso(now - 26 * 3600000), ended_at: iso(now - 24 * 3600000), minutes: 120, source: 'hub' },
        { id: 3, email: 'shima.butera@welfareavenue.com', name: 'Shima Butera', department: 'opsmtl', started_at: iso(now - 8 * 86400000), ended_at: iso(now - 8 * 86400000 + 3 * 3600000), minutes: 180, source: 'hub' },
        { id: 4, email: 'suhaib.abdillahi@welfareavenue.com', name: 'Suhaib Abdillahi', department: 'fundraising', started_at: iso(now - 3 * 3600000), ended_at: iso(now - 3600000), minutes: 120, source: 'hub' }
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
  await page.waitForTimeout(3000);
  const out = { identity: TAG };
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 900); };
  const shot = async (n) => page.screenshot({ path: path.join(shots, TAG + "_" + n + ".png") });
  const where = () => page.evaluate(() => ({ hash: location.hash, panel: (document.querySelector('.panel.active') || {}).id, newLayout: !!document.querySelector('section#personpage:not([data-w116kdecoy]) .w116khead'), name: (document.querySelector('section#personpage:not([data-w116kdecoy]) .w116khead h2') || {}).textContent, ocModal: (function () { const m = document.getElementById('ocModal'); return m ? getComputedStyle(m).display : 'none'; })() }));

  /* 1. org chart */
  await go('#orgchart', 1800);
  const oc = await page.$('#orgchart [data-ocp]');
  out.orgPerson = oc ? await oc.getAttribute('data-ocp') : null;
  if (oc) { await oc.click(); await page.waitForTimeout(2500); out.fromOrgChart = await where(); }
  /* 2. task board avatar */
  await go('#team/fundraising/tasks', 2000);
  const avRow = await page.$('#w116tasks .w116r .w116av[title]');
  out.boardAvatar = avRow ? await avRow.getAttribute('title') : null;
  if (avRow) { await avRow.click(); await page.waitForTimeout(2500); out.fromBoard = await where(); }
  /* 3. header presence bubble */
  const pres = await page.$('#w116jpres .w116av[title]');
  out.presenceAvatar = pres ? await pres.getAttribute('title') : null;
  if (pres) { await go('#mypage', 800); const p2 = await page.$('#w116jpres .w116av[title]'); await p2.click(); await page.waitForTimeout(2500); out.fromPresence = await where(); }
  /* 4. Home presence line names */
  await go('#mypage', 1500);
  out.homeLine = await page.evaluate(() => ({ names: Array.from(document.querySelectorAll('#mypage .mp-online .w116pname')).map(x => x.textContent), text: (document.querySelector('#mypage .mp-online') || {}).textContent }));
  const hn = await page.$('#mypage .mp-online .w116pname');
  if (hn) { await hn.click(); await page.waitForTimeout(2500); out.fromHome = await where(); }
  /* 5. People and access name */
  await go('#adminpanel', 2500);
  const pa = await page.$('#w113tbl td:nth-child(2) b');
  out.paName = pa ? await pa.textContent() : null;
  if (pa) { await pa.click(); await page.waitForTimeout(2500); out.fromPeople = await where(); }
  /* 6. the task drawer: owner link + assignee chip */
  const tid = await page.evaluate(() => { const t = DB_TASKS.filter(x => !x.done && x.owner && x.department === 'fundraising')[0]; return t ? t.id : null; });
  if (tid) {
    await go('#task/' + tid, 2500);
    out.drawer = await page.evaluate(() => ({ open: !!(document.getElementById('w116dr') && document.getElementById('w116dr').classList.contains('open')), owner: (document.querySelector('#w116dr select[data-dfield="owner"]') || {}).value, link: (document.querySelector('#w116dr .w116mlnk') || {}).textContent, chips: document.querySelectorAll('#w116dr .w116chip').length }));
    await shot('1_drawer');
    const lnk = await page.$('#w116dr .w116mlnk');
    if (lnk) { await lnk.click(); await page.waitForTimeout(2500); out.fromDrawerOwner = await where(); }
  }
  /* 7. executive dashboard owner names */
  await go('#overview', 2000);
  out.execNames = await page.evaluate(() => Array.from(document.querySelectorAll('#overview b.w116pname')).map(x => x.textContent).slice(0, 5));
  const ex = await page.$('#overview b.w116pname');
  if (ex) { await ex.click(); await page.waitForTimeout(2500); out.fromExec = await where(); }
  /* 8. the identity button still opens the menu, not a profile */
  await page.click('#w115btn'); await page.waitForTimeout(400);
  out.identityBtn = await page.evaluate(() => ({ menuOpen: document.getElementById('w115menu').style.display !== 'none', hash: location.hash }));
  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
