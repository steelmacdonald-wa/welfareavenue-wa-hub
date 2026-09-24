const fs = require("fs");
const { chromium } = require("playwright");
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data: blob: https://zwnmulmnvopclzcvytce.supabase.co; connect-src 'self' https://zwnmulmnvopclzcvytce.supabase.co wss://zwnmulmnvopclzcvytce.supabase.co https://www.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
(async () => {
  const html = fs.readFileSync(process.env.HOME + "/wa-hub/build/candidate.html", "utf8");
  const stub = fs.readFileSync("stub_supabase.js", "utf8");
  const fixture = fs.readFileSync("fixture.json", "utf8");
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext()).newPage();
  const viol = [];
  page.on("console", m => { if (/Content Security Policy|Refused to/i.test(m.text())) viol.push(m.text().slice(0, 220)); });
  await page.addInitScript("window.__WA_TEST_ROLE='staff';window.__WA_TEST_EMAIL='steel.macdonald@welfareavenue.com';window.__WA_TEST_NAME='Steel MacDonald';try{localStorage.setItem('wa84tour','1');localStorage.setItem('wa75nudge','1')}catch(e){}");
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", headers: { "Content-Security-Policy": CSP }, body: html });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    if (url.indexOf("fonts.googleapis.com") >= 0) return route.fulfill({ contentType: "text/css", body: "/* stub */" });
    return route.fulfill({ status: 200, contentType: "application/octet-stream", body: "" });
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.getElementById("gate")?.style.display === "none", null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  for (const h of ["mypage", "dept/marketing", "goals", "transcripts", "finances", "hrcentre", "volunteering"]) {
    await page.evaluate(x => { location.hash = "#" + x; }, h);
    await page.waitForTimeout(500);
  }
  console.log("boot + 7 pages under CSP. violations:", viol.length);
  viol.slice(0, 10).forEach(v => console.log(" -", v));
  await browser.close();
})();
