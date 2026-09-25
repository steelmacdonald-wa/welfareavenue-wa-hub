const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
(async () => {
  const html = fs.readFileSync("/root/wa-hub/build/candidate.html", "utf8");
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext()).newPage();
  await page.setContent('<html><body></body></html>');
  // pull the evidence code straight out of the segment and run it standalone
  const seg = fs.readFileSync("/root/wa-hub/build/src/120_wave120.seg", "utf8");
  const start = seg.indexOf("  /* ---------- insights (wave120b)"); const end = seg.indexOf("  window.w120Evidence = evidence;");
  const code = seg.slice(start, end);
  const res = await page.evaluate(([code]) => {
    var S = { data: null, days: 90 }; var P = { instagram: { label: 'Instagram' }, facebook: { label: 'Facebook' } };
    function num(v) { return String(Math.round(v)); } function niceDay(x) { return x; }
    eval(code);
    var FIXED = new Date("2026-08-06T12:00:00-04:00").getTime(); var posts = [];
    for (var i = 0; i < 28; i++) { var dd = 2 + i * 3; var ds = new Date(FIXED - dd * 86400000).toISOString().slice(0, 10); var hour = i % 2 ? 19 : 9; var t = new Date(ds + 'T' + String(hour).padStart(2, '0') + ':00:00-04:00'); var reel = i % 3 === 0; var wd = new Date(ds + 'T12:00:00-04:00').getUTCDay(); var reach = 700 + (hour === 19 ? 900 : 0) + (reel ? 1300 : 0) + (wd === 4 ? 800 : 0) + (i * 37 % 150); posts.push({ platform: i % 4 === 3 ? 'facebook' : 'instagram', kind: reel ? 'reels' : 'image', caption: i % 2 ? 'short' : 'x'.repeat(300), published_at: t.toISOString(), reach: reach }); }
    var rows = indexed(posts);
    return { rows: rows.slice(0, 6).map(r => [r.platform, r.wd, r.h, r.tod, Math.round(r.idx * 100) / 100]), time: compare(rows, function (r) { return r.tod; }, TOD.map(function (t) { return t[0]; })), cap: compare(rows, function (r) { return r.len < 80 ? 'Short' : 'Long'; }) };
  }, [code]);
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
