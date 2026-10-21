/* w123shots.js [role email name width] : screenshots of the wave123 Requests views and the team inbox card */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", WIDTH = "1366", ONLY = ""] = process.argv;
const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8"), fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } })).newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-08-06T12:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); localStorage.setItem('wa112done', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { document.querySelectorAll('.w112pop, #w117tip, .w84tour, [id^="w117"]').forEach(x => { try { x.remove(); } catch (e) {} }); });
  const shots = [["new", "#requests"], ["team_pick", "#requests/new/marketing"], ["form", "#requests/new/marketing/design-request"], ["general", "#requests/new/progdev/other"], ["mine", "#requests/mine"], ["inbox", "#requests/team/marketing"], ["sheet_req", "#requests/r/6"], ["sheet_mail", "#requests/m/6"], ["all", "#requests/all"], ["settings", "#requests/settings"], ["teampage", "#team/marketing"]].filter(s => !ONLY || ONLY.split(",").includes(s[0]));
  for (const [name, hash] of shots) {
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForTimeout(1600);
    const full = !/^sheet/.test(name);
    await page.screenshot({ path: path.join(__dirname, "shots_p123", ROLE + "_" + WIDTH + "_" + name + ".png"), fullPage: full });
    if (/^sheet/.test(name)) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
  }
  console.log("errs", JSON.stringify(errs.slice(0, 8)));
  await browser.close();
})();
