/* churn probe: mutations per 3 s on each page, to catch repaint loops */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const FILE = process.argv[2] || "../build/candidate.html";
const HASHES = (process.argv[3] || "#mypage,#overview,#team/marketing,#team/fundraising/tasks,#volunteering,#volunteering/e/501,#volunteering/people,#socialstats,#hrcentre,#adminpanel,#dashboard,#transcripts,#requests,#goals,#projects").split(",");
(async () => {
  const html = fs.readFileSync(path.join(__dirname, FILE), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  await page.addInitScript(`(function(){ var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = 'staff'; window.__WA_TEST_EMAIL = 'steel.macdonald@welfareavenue.com'; window.__WA_TEST_NAME = 'Steel MacDonald'; window.confirm = function(){ return false; }; try { localStorage.setItem('wa84tour', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.addInitScript(`(function(){ var F = window.__WAFIX; (F.event_roster || []).forEach(function (r) { if (r.event_id === 1) r.event_id = 501; }); (F.sop_event_steps || []).forEach(function (s) { if (s.event_id === 1) s.event_id = 501; }); })();`);
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const out = [];
  for (const h of HASHES) {
    await page.evaluate(x => { location.hash = x; }, h);
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => new Promise(res => { const counts = {}; let n = 0; const mo = new MutationObserver(ms => { ms.forEach(m => { n++; const t = m.target; const k = (t.id ? '#' + t.id : '') + '.' + String(t.className || '').split(' ').slice(0, 2).join('.'); counts[k] = (counts[k] || 0) + 1; }); }); mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true }); setTimeout(() => { mo.disconnect(); res({ active: (document.querySelector('.panel.active') || {}).id, total: n, top: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4) }); }, 3000); }));
    out.push({ hash: h, ...r });
  }
  console.log(JSON.stringify({ file: FILE, pages: out, errors: errs }, null, 1));
  await browser.close();
})();
