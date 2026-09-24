const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
(async () => {
  const html = fs.readFileSync(process.env.HOME + "/wa-hub/backup/full_v75.html", "utf8");
  const stub = fs.readFileSync("stub_supabase.js", "utf8");
  const fixture = fs.readFileSync("fixture.json", "utf8");
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext()).newPage();
  page.on("pageerror", e => console.log("PAGEERROR:", String(e).slice(0, 300)));
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
  await page.waitForTimeout(1000);
  // What nav buttons exist, and what do their click handlers key on?
  const nav = await page.evaluate(() => Array.from(document.querySelectorAll(".tabs button, .tabs a, nav button")).map(b => ({t: (b.textContent||"").trim().slice(0,20), h: b.getAttribute("data-hash") || b.getAttribute("data-tab") || b.getAttribute("href") || "", w39: b.getAttribute("data-w39t")||"", cls: b.className.slice(0,30)})).slice(0, 40));
  console.log(JSON.stringify(nav, null, 0));
  // WA_NAV registry
  const reg = await page.evaluate(() => window.WA_NAV ? Object.keys(window.WA_NAV).join(",") : "none");
  console.log("WA_NAV keys:", reg);
  await page.evaluate(() => { location.hash = "#mypage"; });
  await page.waitForTimeout(800);
  console.log("mypage via hash:", await page.evaluate(() => document.getElementById("mypage").outerHTML.length));
  await browser.close();
})();
