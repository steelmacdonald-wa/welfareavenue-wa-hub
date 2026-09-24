const fs = require("fs");
const { chromium } = require("playwright");
(async () => {
  const html = fs.readFileSync(process.env.HOME + "/wa-hub/backup/full_v75.html", "utf8");
  const stub = fs.readFileSync("stub_supabase.js", "utf8");
  const fixture = fs.readFileSync("fixture.json", "utf8");
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext()).newPage();
  page.on("pageerror", e => console.log("PAGEERROR:", String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" && !m.text().includes("ERR_FAILED")) console.log("CONSOLE:", m.text().slice(0, 200)); });
  await page.addInitScript("window.__WA_TEST_ROLE='admin';window.__WA_TEST_EMAIL='steel.macdonald@welfareavenue.com';window.__WA_TEST_NAME='Steel MacDonald';");
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html", body: html });
    if (url.includes("supabase")) return route.fulfill({ contentType: "application/javascript", body: stub });
    return route.abort();
  });
  await page.goto("http://wahub.test/");
  await page.waitForFunction(() => document.getElementById("gate")?.style.display === "none");
  await page.waitForTimeout(1200);
  const probe = await page.evaluate(() => {
    const r = {};
    r.isStaffType = typeof isStaff;
    try { r.isStaff = isStaff(); } catch (e) { r.isStaff = "ERR " + e; }
    r.renderMyPageType = typeof renderMyPage;
    try { renderMyPage(); r.renderRan = true; } catch (e) { r.renderErr = String(e.stack || e).slice(0, 500); }
    r.len = document.getElementById("mypage").outerHTML.length;
    return r;
  });
  console.log(JSON.stringify(probe, null, 1));
  await page.evaluate(() => { location.hash = "#mypage"; });
  await page.waitForTimeout(900);
  console.log("after hash:", await page.evaluate(() => ({
    hash: location.hash,
    active: document.querySelector(".panel.active")?.id,
    len: document.getElementById("mypage").outerHTML.length
  })));
  await browser.close();
})();
