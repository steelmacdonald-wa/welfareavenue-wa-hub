const fs = require("fs");
const { chromium } = require("playwright");
(async () => {
  const html = fs.readFileSync(process.env.HOME + "/wa-hub/build/candidate.html", "utf8");
  const stub = fs.readFileSync("stub_supabase.js", "utf8");
  const fixture = fs.readFileSync("fixture.json", "utf8");
  const cyto = fs.readFileSync("cytoscape.min.js", "utf8");
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1050 } })).newPage();
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
  await page.waitForTimeout(1400);
  // Home with the notifications fold open
  await page.evaluate(() => { location.hash = "#mypage"; });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const d = document.getElementById("w89box"); if (d) { d.open = true; d.scrollIntoView({block:"center"}); } });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "shots_p4/notify_settings.png" });
  // Welcome kit modal with send button
  await page.evaluate(() => { location.hash = "#hrcentre"; });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const sel = document.querySelector('#hrcentre select');
    if (sel && sel.options.length > 1) { sel.value = sel.options[1].value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.querySelectorAll("#modalBox details").forEach((d,i) => { d.open = i === 2 || i === 0; }); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "shots_p4/welcome_kit.png" });
  await browser.close();
  console.log("done");
})().catch(e => { console.error(e); process.exit(1); });
