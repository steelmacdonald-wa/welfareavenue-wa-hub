/* Wave92 walkthrough shots. Usage: node p7shots.js <candidate.html> <outdir> */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const FIXED_TIME = "2026-08-06T12:00:00-04:00";

async function boot(browser, html, stub, fixture, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){
        if (!(this instanceof FDate)) return new RealDate(FIXED).toString();
        switch (arguments.length) {
          case 0: return new RealDate(FIXED);
          case 1: return new RealDate(a);
          default: return new RealDate(a,b,c,d,e,f,g);
        }
      }
      FDate.now = function(){ return FIXED; };
      FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC;
      FDate.prototype = RealDate.prototype;
      window.Date = FDate;
      window.__WA_TEST_ROLE='staff';
      window.__WA_TEST_EMAIL='steel.macdonald@welfareavenue.com';
      window.__WA_TEST_NAME='Steel MacDonald';
      try { localStorage.setItem('wa84tour','1'); localStorage.setItem('wa75nudge','1'); localStorage.setItem('wa88seen','1'); } catch(e){}
      window.confirm=function(){return false;}; window.alert=function(){};
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) {
      return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    }
    if (url.indexOf("supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.getElementById("gate")?.style.display === "none", null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  return page;
}

async function main() {
  const [candidate, outdir] = process.argv.slice(2);
  const html = fs.readFileSync(candidate, "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

  const page = await boot(browser, html, stub, fixture, { width: 1440, height: 1000 });
  await page.evaluate(() => { location.hash = "#finances"; });
  await page.waitForTimeout(1400);

  // pills at top
  const head = await page.$("#finances .card");
  await page.screenshot({ path: path.join(outdir, "x_pills.png"), clip: { x: 80, y: 80, width: 1280, height: 400 } });
  console.log("pills");

  // forecast on -> charts
  await page.evaluate(() => { const b = document.querySelector('[data-w92fc]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  const charts = await page.$("#w90charts");
  if (charts) await charts.screenshot({ path: path.join(outdir, "x_forecast.png") });
  console.log("forecast");
  await page.evaluate(() => { const b = document.querySelector('[data-w92fc]'); if (b) b.click(); });
  await page.waitForTimeout(700);

  // drilldown: expand 5020 Purchases in "Where the money goes"
  await page.evaluate(() => {
    const boxes = document.querySelectorAll('#w90charts .w90box');
    for (const box of boxes) {
      const t = box.querySelector('.w90t');
      if (t && t.textContent.indexOf('Where the money goes') === 0) {
        const row = box.querySelector('.w90row .l');
        if (row) row.click();
        return;
      }
    }
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const boxes = document.querySelectorAll('#w90charts .w90box');
    for (const box of boxes) {
      const t = box.querySelector('.w90t');
      if (t && t.textContent.indexOf('Where the money goes') === 0) box.scrollIntoView({ block: 'center' });
    }
  });
  await page.waitForTimeout(300);
  const goes = await page.evaluateHandle(() => {
    const boxes = document.querySelectorAll('#w90charts .w90box');
    for (const box of boxes) {
      const t = box.querySelector('.w90t');
      if (t && t.textContent.indexOf('Where the money goes') === 0) return box;
    }
    return null;
  });
  const goesEl = goes.asElement();
  if (goesEl) await goesEl.screenshot({ path: path.join(outdir, "x_drill.png") });
  console.log("drilldown");

  // health panel
  const health = await page.$("#w92health");
  if (health) {
    await page.evaluate(() => { const g = document.getElementById('w92guide'); if (g) g.open = true; });
    await page.waitForTimeout(300);
    await health.screenshot({ path: path.join(outdir, "x_health.png") });
  }
  console.log("health");

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
