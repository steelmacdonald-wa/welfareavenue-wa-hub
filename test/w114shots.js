/* wave114 skin screenshots: key pages at desktop and phone widths (harness-style loader) */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", CAND = "../build/candidate.html", OUT = "shots_p114"] = process.argv;
const PAGES = ["mypage", "overview", "opsmtl", "requests", "orgchart", "hrcentre", "finances", "adminpanel", "importantinfo", "goals"];

(async () => {
  const html = fs.readFileSync(path.join(__dirname, CAND), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, OUT);
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const errs = [];
  async function run(width, height, suffix) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
    await page.addInitScript(`
      (function(){
        var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
        var RealDate = Date;
        function FDate(a,b,c,d,e,f,g){
          if (!(this instanceof FDate)) return new RealDate(FIXED).toString();
          switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); }
        }
        FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
        window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
        window.confirm = function(){ return true; }; window.alert = function(){};
        try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
      })();
    `);
    await page.addInitScript("window.__WAFIX = " + fixture + ";");
    await page.route("**/*", route => {
      const url = route.request().url();
      if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
      if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
      if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
      if (url.indexOf("fonts.googleapis.com") >= 0 || url.indexOf("fonts.gstatic.com") >= 0 || url.indexOf("supabase.co/storage") >= 0) return route.continue();
      return route.abort();
    });
    await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
    await page.waitForTimeout(2200);
    for (const p of PAGES) {
      await page.evaluate(id => { location.hash = "#" + (id === "opsmtl" ? "dept/opsmtl" : id); }, p);
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(shots, TAG + "_" + p + suffix + ".png"), fullPage: false });
    }
    if (suffix === "_phone") {
      await page.evaluate(() => { location.hash = "#mypage"; });
      await page.waitForTimeout(600);
      await page.click('#w114bar button[data-w114grp="more"]');
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(shots, TAG + "_drawer_phone.png") });
    }
    /* gate view: force it visible for a look */
    await page.evaluate(() => { const g = document.getElementById("gate"); if (g) g.style.display = "flex"; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, TAG + "_gate" + suffix + ".png") });
    await ctx.close();
  }
  await run(1366, 900, "");
  await run(390, 844, "_phone");
  console.log(JSON.stringify({ errors: errs }, null, 2));
  await browser.close();
})();
