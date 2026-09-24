/* Finances-upgrade walkthrough shots. Usage: node p5shots.js <candidate.html> <outdir> */
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

  let page = await boot(browser, html, stub, fixture, { width: 1440, height: 1000 });
  await page.evaluate(() => { location.hash = "#finances"; });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outdir, "d_finances_full.png"), fullPage: true });
  // charts area only
  const el = await page.$("#w90charts");
  if (el) await el.screenshot({ path: path.join(outdir, "d_charts.png") });
  console.log("finances + charts");
  // import modal with guidance fold open
  await page.evaluate(() => { waFinImportModal(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const d = document.getElementById("w90guide"); if (d) d.open = true; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outdir, "x_import_modal.png"), fullPage: false });
  await page.evaluate(() => { try { closeModal(); } catch (e) {} });
  console.log("import modal");
  // add budget line modal
  await page.evaluate(() => {
    const b = document.querySelector('[data-w90bud]');
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const n = document.getElementById("w90bname");
    if (n) n.value = "7150 Insurance";
  });
  await page.screenshot({ path: path.join(outdir, "x_budget_line.png"), fullPage: false });
  await page.evaluate(() => { try { closeModal(); } catch (e) {} });
  console.log("budget line modal");
  await page.context().close();

  // mobile finances
  page = await boot(browser, html, stub, fixture, { width: 390, height: 844 });
  await page.evaluate(() => { location.hash = "#finances"; });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outdir, "m_finances.png"), fullPage: true });
  console.log("mobile");
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
