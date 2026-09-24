const fs = require("fs"); const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
(async () => {
  const html = fs.readFileSync(process.argv[2], "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await ctx.newPage();
  await page.addInitScript(`(function(){var FIXED=new Date(${JSON.stringify(FIXED_TIME)}).getTime();var R=Date;function F(a,b,c,d,e,f,g){if(!(this instanceof F))return new R(FIXED).toString();switch(arguments.length){case 0:return new R(FIXED);case 1:return new R(a);default:return new R(a,b,c,d,e,f,g);}}F.now=function(){return FIXED;};F.parse=R.parse;F.UTC=R.UTC;F.prototype=R.prototype;window.Date=F;window.__WA_TEST_ROLE='staff';window.__WA_TEST_EMAIL='steel.macdonald@welfareavenue.com';window.__WA_TEST_NAME='Steel MacDonald';try{localStorage.setItem('wa84tour','1');localStorage.setItem('wa75nudge','1');localStorage.setItem('wa88seen','1');}catch(e){}window.confirm=function(){return false;};window.alert=function(){};})();`);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("chart") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "chart.umd.min.js"), "utf8") });
    if (url.indexOf("supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.getElementById("gate")?.style.display === "none", null, { timeout: 20000 });
  await page.waitForTimeout(1600);
  await page.evaluate(() => { location.hash = "#dept/marketing"; });
  await page.waitForTimeout(1600);
  const ws = await page.$("#marketing .subsection");
  if (ws) {
    const box = await ws.boundingBox();
    await page.evaluate(y => window.scrollTo(0, y - 220), box.y);
    await page.waitForTimeout(300);
    await page.screenshot({ path: "shots_p12/x_list.png", fullPage: false });
  }
  const seg = await page.$$(".wa21-seg button");
  for (const b of seg) { if ((await b.textContent()).trim() === "Board") { await b.click(); break; } }
  await page.waitForTimeout(900);
  const bd = await page.$(".wa21-board");
  if (bd) {
    const box = await bd.boundingBox();
    await page.evaluate(y => window.scrollTo(0, y - 200), box.y);
    await page.waitForTimeout(300);
    await page.screenshot({ path: "shots_p12/x_board.png", fullPage: false });
    console.log("board ok");
  } else console.log("no board found");
  await browser.close();
})();
