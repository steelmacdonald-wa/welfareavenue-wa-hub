/* wave117 screenshots: real fonts and bucket images allowed.
   Usage: node w117shots.js <candidate> <outdir> [role] [email] [name] [tag] [width] [gate]
   env ROUTES=comma list of hashes (person_first = first fixture person), FULL=1 for full-page shots */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , CAND, OUT, ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366", GATE = ""] = process.argv;
(async () => {
  const html = fs.readFileSync(CAND, "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  const identity = "window.__WA_TEST_ROLE = " + JSON.stringify(ROLE) + "; window.__WA_TEST_EMAIL = " + JSON.stringify(EMAIL) + "; window.__WA_TEST_NAME = " + JSON.stringify(NAME) + ";";
  await page.addInitScript(
    "(function(){ var FIXED = new Date(" + JSON.stringify(FIXED_TIME) + ").getTime(); var RealDate = Date;" +
    "function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }" +
    "FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;" +
    identity +
    "window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };" +
    "try { localStorage.setItem('wa84tour', '1'); } catch (e) {} })();"
  );
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    if (url.indexOf("fonts.g") >= 0 || url.indexOf("supabase.co/storage") >= 0) return route.continue();
    return route.abort();
  });
  if (GATE === "veil") {
    await page.addInitScript("(function(){var add=DOMTokenList.prototype.add;DOMTokenList.prototype.add=function(){var a=Array.prototype.slice.call(arguments);if(a.indexOf('wa-ready')>=0&&!window.__allowReady){a=a.filter(function(x){return x!=='wa-ready';});if(!a.length)return;}return add.apply(this,a);};})();");
    await page.goto("http://wahub.test/", { waitUntil: "commit" });
    await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, TAG + "_veil_a.png") });
    await page.waitForTimeout(3500); await page.screenshot({ path: path.join(OUT, TAG + "_veil_b.png") });
    await browser.close(); return;
  }
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  const shot = async (n, full) => page.screenshot({ path: path.join(OUT, TAG + "_" + n + ".png"), fullPage: !!full });
  if (GATE === "gate") { await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 }); await page.waitForTimeout(2000); await page.evaluate(() => { document.getElementById("gate").style.display = "flex"; }); await page.waitForTimeout(1200); await shot("0_gate"); await browser.close(); return; }
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 1200); };
  const routes = (process.env.ROUTES || "mypage,overview,team/opsmtl,team/opsmtl/tasks,projects,orggoals,goalmap,person_first,people,hubmail").split(",");
  for (const r of routes) {
    let h = r;
    if (r === "person_first") { const fix = JSON.parse(fixture); const tm = fix.team_members.slice().sort((a, b) => (a.id > b.id ? 1 : -1))[0]; h = "person/" + encodeURIComponent(tm.name || tm.email || tm.id); }
    if (r === "chat") { await page.evaluate(() => { const b = document.getElementById("waChatBtn"); if (b) b.click(); }); await page.waitForTimeout(1500); await shot("chat"); continue; }
    if (r === "chat_thinking") { await page.evaluate(() => { const i = document.getElementById("w38in") || document.getElementById("wacInput"); if (i) { i.value = "What is happening across Welfare Avenue this week?"; } const b = document.getElementById("w38send") || document.getElementById("wacSend"); if (b) b.click(); }); await page.waitForTimeout(700); await shot("chat_thinking"); await page.waitForTimeout(2500); await shot("chat_answer"); continue; }
    await go("#" + h, 1500);
    await shot(r.replace(/[\/#]/g, "_"), process.env.FULL === "1");
  }
  fs.writeFileSync(path.join(OUT, TAG + "_errors.json"), JSON.stringify(errs, null, 1));
  console.log("errors", errs.length); await browser.close();
})();
