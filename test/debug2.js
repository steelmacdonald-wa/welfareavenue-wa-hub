const fs = require("fs");
const { chromium } = require("playwright");
(async () => {
  const html = fs.readFileSync(process.env.HOME + "/wa-hub/backup/full_v75.html", "utf8");
  const stub = fs.readFileSync("stub_supabase.js", "utf8");
  const fixture = fs.readFileSync("fixture.json", "utf8");
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext()).newPage();
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
  const out = await page.evaluate(() => {
    const res = {};
    res.registered = (window.WA_NAV.pages || []).map(p => p.id);
    const pg = window.WA_NAV.pages.find(p => p.id === "mypage");
    res.hasMypage = !!pg, res.hasOnShow = !!(pg && pg.onShow);
    if (pg && pg.onShow) {
      try { pg.onShow("mypage"); res.onShowRan = true; }
      catch (e) { res.onShowError = String(e && e.stack || e).slice(0, 400); }
    }
    res.mypageLen = document.getElementById("mypage").outerHTML.length;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
