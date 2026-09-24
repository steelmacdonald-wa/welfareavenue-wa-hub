const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
(async () => {
  const html = fs.readFileSync(process.env.HOME + "/wa-hub/build/candidate.html", "utf8");
  const stub = fs.readFileSync("stub_supabase.js", "utf8");
  const fixture = fs.readFileSync("fixture.json", "utf8");
  const cyto = fs.readFileSync("cytoscape.min.js", "utf8");
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  page.on("pageerror", e => console.log("PAGEERROR:", String(e).slice(0, 250)));
  await page.addInitScript("window.__WA_TEST_ROLE='staff';window.__WA_TEST_EMAIL='steel.macdonald@welfareavenue.com';window.__WA_TEST_NAME='Steel MacDonald';try{localStorage.setItem('wa84tour','1');localStorage.setItem('wa75nudge','1');localStorage.setItem('wa88seen','1')}catch(e){}");
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: cyto });
    if (url.indexOf("supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    return route.abort();
  });
  await page.goto("http://wahub.test/");
  await page.waitForFunction(() => document.getElementById("gate")?.style.display === "none");
  await page.waitForTimeout(1200);
  // nav to brain
  await page.evaluate(() => { location.hash = "#brain"; });
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({
    active: document.querySelector(".panel.active")?.id,
    hasCanvas: !!document.querySelector("#w87cy canvas"),
    personOpts: document.getElementById("w87person")?.options.length,
    goalOpts: document.getElementById("w87goal")?.options.length
  }));
  console.log("brain month:", JSON.stringify(st));
  console.log("nodes/edges (month):", await page.evaluate(() => window.cytoscape && document.querySelector("#w87cy canvas") ? (() => { const c = window.__wa87cy || null; return "n/a"; })() : "n/a"));
  // count via cy? W87 is IIFE-private; count DOM canvas exists is enough; use mode switch
  await page.click('[data-w87mode="all"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "shots_p3/brain_all.png" });
  await page.click('[data-w87mode="month"]');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: "shots_p3/brain_month.png" });
  // focus a person
  await page.selectOption("#w87person", { index: 1 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: "shots_p3/brain_focus_person.png" });
  // time-lapse mid-run
  await page.click('[data-w87mode="lapse"]');
  await page.waitForTimeout(3200);
  await page.screenshot({ path: "shots_p3/brain_lapse.png" });
  // how work happens
  await page.evaluate(() => { try { closeModal(); } catch (e) {} window.w88Show(false); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "shots_p3/how_1.png" });
  for (let k = 0; k < 4; k++) { await page.click("#w88back [data-n]"); await page.waitForTimeout(500); }
  await page.screenshot({ path: "shots_p3/how_5.png" });
  await browser.close();
  console.log("done");
})().catch(e => { console.error(e); process.exit(1); });
