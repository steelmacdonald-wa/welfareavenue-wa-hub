/* wave115 drive: profile menu + photo (harness-style loader; storage + update stubbed by the harness stub) */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

/* a tiny 64x48 PNG (solid purple) as the "photo" */
function png() {
  const zlib = require("zlib");
  const w = 64, h = 48, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 0x6f; raw[o + 1] = 0x64; raw[o + 2] = 0xab; } }
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p115");
  fs.mkdirSync(shots, { recursive: true });
  fs.writeFileSync("/tmp/w115_photo.png", png());

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){};
      try { localStorage.setItem('wa84tour', '1'); } catch (e) {}
      window.__UPLOADS = [];
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    if (url.indexOf("fonts.g") >= 0 || url.indexOf("supabase.co/storage") >= 0) return route.continue();
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2000);

  /* record uploads through the stub */
  await page.evaluate(() => {
    const orig = db.storage.from;
    db.storage.from = function (bucket) {
      const o = orig.call(this, bucket);
      const up = o.upload;
      o.upload = function (p, blob, opts) { window.__UPLOADS.push({ bucket, path: p, size: blob && blob.size, type: blob && blob.type, opts }); return up.apply(this, arguments); };
      return o;
    };
  });

  const out = { identity: TAG, width: WIDTH };
  out.button = await page.evaluate(() => { const b = document.getElementById("w115btn"); return b ? { present: true, initials: b.textContent.trim(), img: !!b.querySelector("img") } : { present: false }; });
  out.debug = await page.evaluate(() => window.w115Debug ? window.w115Debug() : null);
  await page.click("#w115btn");
  await page.waitForTimeout(300);
  out.menu = await page.evaluate(() => { const m = document.getElementById("w115menu"); return { shown: m && m.style.display !== "none", text: m ? m.textContent.replace(/\s+/g, " ").trim() : null, signOutInside: !!(m && m.querySelector("#signOutBtn")) }; });
  await page.screenshot({ path: path.join(shots, TAG + "_1_menu.png") });

  const edit = await page.$('[data-w115act="edit"]');
  if (edit) {
    await edit.click();
    await page.waitForTimeout(300);
    out.modal = await page.evaluate(() => ({ open: !!document.querySelector(".w115edit"), name: (document.getElementById("w115n") || {}).value, role: (document.getElementById("w115rt") || {}).value }));
    await page.setInputFiles("#w115file", "/tmp/w115_photo.png");
    await page.waitForTimeout(800);
    out.preview = await page.evaluate(() => ({ img: !!document.querySelector("#w115prev img"), msg: (document.getElementById("w115msg") || {}).textContent }));
    await page.screenshot({ path: path.join(shots, TAG + "_2_edit_preview.png") });
    await page.fill("#w115rt", "Co-founder and chair");
    await page.click("#w115save");
    await page.waitForTimeout(1200);
    out.uploads = await page.evaluate(() => window.__UPLOADS);
    out.afterSave = await page.evaluate(() => ({
      modalClosed: !document.querySelector(".w115edit"),
      btnImg: !!document.querySelector("#w115btn img"),
      me: (window.w115Debug().me || {}),
      toast: (document.getElementById("toast") || {}).textContent
    }));
    await page.evaluate(() => { location.hash = "#mypage"; });
    await page.waitForTimeout(1200);
    out.home = await page.evaluate(() => ({ greetingAvatar: !!document.querySelector("#mypage .mp-head .w115av"), greetingImg: !!document.querySelector("#mypage .mp-head .w115av img"), teamAvatars: document.querySelectorAll("#mypage .w74mem summary .w115av").length }));
    await page.screenshot({ path: path.join(shots, TAG + "_3_home_after.png") });
    /* person page + people table */
    const myId = await page.evaluate(() => (window.w115Debug().me || {}).id);
    if (myId) {
      await page.evaluate(id => { location.hash = "#person/" + id; }, myId);
      await page.waitForTimeout(1500);
      out.person = await page.evaluate(() => ({ avatar: !!document.querySelector("#personpage .w33head .w115av"), img: !!document.querySelector("#personpage .w33head .w115av img") }));
    }
    await page.evaluate(() => { location.hash = "#adminpanel"; });
    await page.waitForTimeout(1800);
    out.people = await page.evaluate(() => ({ rowsWithAvatar: document.querySelectorAll("#w113tbl .w115av").length, rows: document.querySelectorAll("#w113tbl tr[data-w113row]").length }));
    await page.screenshot({ path: path.join(shots, TAG + "_4_people.png") });
  }
  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
