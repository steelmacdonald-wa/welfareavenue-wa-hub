/* w129drive.js [case] [width]: Analytics depth. Cases: admin (Steel), mktlead (Kahkashan, Marketing lead), board (Tamara, a board viewer).
   The page runs on a synthetic social_range() (w129data.js) with FIXED = 2026-09-25. */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , CASE = "admin", WIDTH = "1366"] = process.argv;
const C = {
  admin: { email: "steel.macdonald@welfareavenue.com", name: "Steel MacDonald", role: "staff", staff: true, patch: [] },
  mktlead: { email: "kahkashan.ansary@welfareavenue.com", name: "Kahkashan Ansary", role: "staff", staff: true, patch: [{ email: "kahkashan.ansary@welfareavenue.com", role: "leader", profile: "marketing" }] },
  board: { email: "consult.tamaraangeline@gmail.com", name: "Tamara Angeline", role: "board", staff: false, patch: [] }
}[CASE];
const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
const gen = fs.readFileSync(path.join(__dirname, "w129data.js"), "utf8");
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8"));
C.patch.forEach(p => { const r = fx.hub_roles.filter(x => x.email === p.email)[0]; if (r) Object.assign(r, p, { tabs: null }); else fx.hub_roles.push(Object.assign({ tabs: null, note: null }, p)); });
/* a month of LinkedIn new followers, and some daily rows for the CSV */
fx.social_daily = [];
for (let i = 0; i < 30; i++) { const d = new Date(Date.UTC(2026, 7, 25 + i)).toISOString().slice(0, 10); fx.social_daily.push({ platform: "linkedin", day: d, metric: "new_followers", value: 2 }); fx.social_daily.push({ platform: "instagram", day: d, metric: "reach", value: 800 + i }); }
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push("PASS " + name); } else { fail++; out.push("FAIL " + name + (extra ? " :: " + String(extra).slice(0, 500) : "")); } }
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-09-25T12:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(C.role)}; window.__WA_TEST_EMAIL = ${JSON.stringify(C.email)}; window.__WA_TEST_NAME = ${JSON.stringify(C.name)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); localStorage.setItem('wa112done', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + JSON.stringify(fx) + ";");
  await page.addInitScript(gen);
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  /* the RPC and the edge function, answered by the synthetic data */
  await ev(() => {
    window.__CALLS = []; window.__BF = 0;
    const rpc0 = db.rpc.bind(db);
    db.rpc = function (fn, args) { if (fn === 'social_range') { window.__CALLS.push(['rpc', args]); return Promise.resolve({ data: window.__SR(args), error: null }); } return rpc0(fn, args); };
    db.functions.invoke = function (name, opts) {
      const b = (opts && opts.body) || {}; window.__CALLS.push(['fn', name, b]);
      if (name !== 'social-pull') return Promise.resolve({ data: { ok: true }, error: null });
      if (b.action === 'backfill') { window.__BF++; const done = window.__BF >= 3; if (done) { const a = window.__SR.accounts.filter(x => x.id === b.account_id)[0]; if (a) a.meta.history.totals_done = true; } return new Promise(r => setTimeout(() => r({ data: { ok: true, done: done, daily_from: '2024-09-26', totals_from: ['2025-03-01', '2024-11-01', '2024-09-26'][Math.min(2, window.__BF - 1)], posts: 0 }, error: null }), 250)); }
      if (b.action === 'probe') return Promise.resolve({ data: { ok: true, whatsapp: { ok: false, has_permission: true, wabas: [], next: 'share it' } }, error: null });
      if (b.action === 'import_csv') return Promise.resolve({ data: { ok: true, rows: (b.rows || []).length }, error: null });
      return Promise.resolve({ data: { ok: true }, error: null });
    };
  });
  await page.evaluate(() => { document.querySelectorAll('body *').forEach(el => { const t = el.textContent || ''; const st = getComputedStyle(el); if ((st.position === 'fixed' || st.position === 'absolute') && (/STARTING A SESSION|Meet Ask the Hub/i.test(t)) && t.length < 400) el.remove(); }); });
  const settle = async () => { await page.waitForFunction(() => { const d = window.w120 && w120.data(); return !!(d && d.accounts); }, null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(250); };
  const click = async sel => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(350); return true; };
  const shot = async n => { try { await page.screenshot({ path: "/tmp/w129_" + CASE + "_" + WIDTH + "_" + n + ".png", fullPage: !!process.env.FULL }); } catch (e) { /* fine */ } };
  await ev(() => { location.hash = '#socialstats'; });
  await page.waitForTimeout(900); await settle();
  const open = await ev(() => { const p = document.querySelector('.panel.active'); return p && p.id; });
  ok("the analytics page opens", open === 'socialstats', open);
  if (open !== 'socialstats') { console.log(out.join("\n")); console.log(`\n${CASE} ${WIDTH}: ${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0); }
  /* ranges */
  const r0 = await ev(() => ({ chips: Array.from(document.querySelectorAll('#socialstats [data-w120range]')).map(a => a.textContent), on: (document.querySelector('#socialstats [data-w120range].on') || {}).textContent, call: window.__CALLS.filter(c => c[0] === 'rpc').slice(-1)[0], label: w120.label(), last: document.querySelector('#socialstats .w120wrap').lastElementChild.id }));
  ok("eight ranges, 30 days by default", r0.chips.join('|') === '7 days|30 days|90 days|6 months|1 year|2 years|All time|Custom' && r0.on === '30 days', JSON.stringify(r0));
  ok("30 days asks social_range for Aug 27 to Sep 25", r0.call && r0.call[1].p_from === '2026-08-27' && r0.call[1].p_to === '2026-09-25', JSON.stringify(r0.call));
  ok("the new block sits at the end of the page", r0.last === 'w129', r0.last);
  const b0 = await ev(() => ({ tbl: !!document.querySelector('#w129 .w129tbl'), aud: !!document.querySelector('#w129 .w129aud'), cov: !!document.querySelector('#w129 .w129cov'), rows: document.querySelectorAll('#w129 .w129tbl tbody tr').length, n: w129.rows().length, sub: (document.querySelector('#w129 .cardy h4 .sub') || {}).textContent }));
  ok("every post, who follows us, how far back", b0.tbl && b0.aud && b0.cov, JSON.stringify(b0));
  ok("the table lists the posts of the range", b0.n > 0 && b0.rows === Math.min(25, b0.n) && b0.sub === 'the last 30 days', JSON.stringify(b0));
  await shot('30');
  const tickCheck = () => ev(() => { const svg = document.querySelector('#socialstats .cardy.chart svg'); if (!svg) return null; const ts = Array.from(svg.querySelectorAll('text')).filter(t => t.getAttribute('y') === '214'); const xs = ts.map(t => Number(t.getAttribute('x'))); let gap = 1e9; for (let i = 1; i < xs.length; i++) gap = Math.min(gap, xs[i] - xs[i - 1]); return { n: ts.length, gap: gap, labels: ts.map(t => t.textContent), title: svg.parentNode.querySelector('h4').firstChild.textContent, dashed: svg.querySelectorAll('polyline[stroke-dasharray]').length, lg: (svg.parentNode.querySelector('.lg') || {}).textContent, firstX: Math.min.apply(null, Array.from(svg.querySelectorAll('polyline')).map(p => Number(p.getAttribute('points').split(' ')[0].split(',')[0]))) }; });
  const t30 = await tickCheck();
  ok("30 days: by day, ticks do not collide", t30 && t30.title === 'By day' && t30.n >= 4 && t30.n <= 9 && t30.gap >= 40 && t30.dashed === 0, JSON.stringify(t30));
  await click('#socialstats [data-w120range="365"]'); await settle();
  const t365 = await tickCheck();
  ok("1 year: by week, monthly ticks, part weeks dashed", t365 && t365.title === 'By week' && t365.n >= 4 && t365.n <= 9 && t365.gap >= 40 && t365.dashed > 0 && /Dashed: a week/.test(t365.lg), JSON.stringify(t365));
  await click('#socialstats [data-w120range="730"]'); await settle();
  const t730 = await tickCheck();
  ok("2 years: by month, quarter ticks with years", t730 && t730.title === 'By month' && t730.n >= 4 && t730.n <= 10 && t730.gap >= 40 && t730.labels.every(l => /^[A-Z][a-z]{2} 20\d\d$/.test(l)), JSON.stringify(t730));
  await shot('730');
  await click('#socialstats [data-w120range="all"]'); await settle();
  const tall = await tickCheck(); const lall = await ev(() => ({ label: w120.label(), d: w120.data().from, days: w120.data().days, sub: (document.querySelector('#w129 .cardy h4 .sub') || {}).textContent, posts: w129.rows().length, what: (Array.from(document.querySelectorAll('#socialstats .cardy h4')).filter(h => /What worked/.test(h.textContent))[0] || {}).textContent }));
  ok("all time: from the first post, labelled with the year", lall.d === '2020-09-25' && /^all time \(since Sep 25, 2020\)$/.test(lall.label) && lall.sub === lall.label && lall.posts > 500, JSON.stringify(lall));
  ok("all time: the chart starts where the numbers start, not in 2020", tall && tall.firstX < 60 && !tall.labels.some(l => /2020|2021|2022|2023/.test(l)), JSON.stringify(tall));
  ok("what worked follows the range", /posts from all time/.test(lall.what || ''), lall.what);
  /* custom */
  await click('#socialstats [data-w120range="custom"]');
  const c0 = await ev(() => ({ cf: (document.getElementById('w120cf') || {}).value, ct: (document.getElementById('w120ct') || {}).value, key: w120.data()._key }));
  ok("custom shows two dates, filled in, without reloading", c0.cf === '2020-09-25' && c0.ct === '2026-09-25' && /^all\|/.test(c0.key), JSON.stringify(c0));
  await ev(() => { document.getElementById('w120cf').value = '2025-03-31'; document.getElementById('w120ct').value = '2025-01-01'; });
  await click('#socialstats [data-w120apply]'); await settle();
  const c1 = await ev(() => ({ d: w120.data().from, t: w120.data().to, b: w120.data().bucket, label: w120.label(), on: (document.querySelector('#socialstats [data-w120range].on') || {}).textContent }));
  ok("custom: dates in either order, by day, labelled with years", c1.d === '2025-01-01' && c1.t === '2025-03-31' && c1.b === 'day' && c1.label === 'Jan 1, 2025 to Mar 31, 2025' && c1.on === 'Custom', JSON.stringify(c1));
  await click('#socialstats [data-w120range="730"]'); await settle();
  /* the table */
  await click('#w129 [data-w129plat="instagram"]');
  const e1 = await ev(() => { const r = w129.rows(); return { n: r.length, ig: r.every(p => p.platform === 'instagram'), on: (document.querySelector('#w129 [data-w129plat].on') || {}).textContent }; });
  ok("platform chip filters", e1.n > 0 && e1.ig && e1.on === 'Instagram', JSON.stringify(e1));
  await page.selectOption('#w129 [data-w129kind]', 'reel'); await page.waitForTimeout(300);
  const e2 = await ev(() => { const r = w129.rows(); return { n: r.length, reels: r.every(p => /reel/.test(p.kind)), opts: Array.from(document.querySelectorAll('#w129 [data-w129kind] option')).map(o => o.textContent) }; });
  ok("type filter", e2.n > 0 && e2.reels && e2.opts.indexOf('Reels') > 0, JSON.stringify(e2));
  await page.selectOption('#w129 [data-w129kind]', ''); await page.waitForTimeout(300);
  await click('#w129 [data-w129plat=""]');
  await page.click('#w129 [data-w129q]'); await page.keyboard.type('volunteer', { delay: 30 }); await page.waitForTimeout(600);
  const e3 = await ev(() => { const r = w129.rows(); const a = document.activeElement; return { n: r.length, all: r.every(p => /volunteer/i.test(p.caption || '')), focus: !!(a && a.matches && a.matches('#w129 [data-w129q]')), val: a && a.value }; });
  ok("search the captions, and typing keeps the focus", e3.n > 0 && e3.all && e3.focus && e3.val === 'volunteer', JSON.stringify(e3));
  await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await page.waitForTimeout(500);
  const PHONE = Number(WIDTH) < 700;
  if (!PHONE) {
    await click('#w129 th[data-w129sort="reach"]');
    const s1 = await ev(() => { const r = w129.rows().map(p => p.reach).filter(v => v != null); let desc = true; for (let i = 1; i < r.length; i++) if (r[i] > r[i - 1]) desc = false; return { desc, first: r[0], th: document.querySelector('#w129 th.on').textContent }; });
    ok("sort by reach, highest first", s1.desc && /Reach ↓/.test(s1.th), JSON.stringify(s1));
    await click('#w129 th[data-w129sort="reach"]');
    const s2 = await ev(() => { const r = w129.rows(); const v = r.map(p => p.reach); const nn = v.filter(x => x != null); let asc = true; for (let i = 1; i < nn.length; i++) if (nn[i] < nn[i - 1]) asc = false; return { asc, nullsLast: v.indexOf(null) < 0 || v.slice(v.indexOf(null)).every(x => x == null) }; });
    ok("again: lowest first, blanks last", s2.asc && s2.nullsLast, JSON.stringify(s2));
    await click('#w129 th[data-w129sort="rate"]');
    const s3 = await ev(() => ({ th: document.querySelector('#w129 th.on').textContent, cell: (document.querySelector('#w129 tbody tr td.rt') || {}).textContent }));
    ok("sort by engagement rate", /Rate ↓/.test(s3.th) && /%$/.test(s3.cell), JSON.stringify(s3));
    ok("the sort menu stays out of the way on a wide screen", await ev(() => getComputedStyle(document.querySelector('#w129 [data-w129ss]')).display === 'none'));
  } else {
    const ph = await ev(() => { const tr = document.querySelector('#w129 tbody tr'); const vis = el => getComputedStyle(el).display !== 'none'; return { thead: vis(document.querySelector('#w129 thead')), k: Array.from(tr.querySelectorAll('td')).filter(vis).map(td => td.getAttribute('data-l') || 'post'), menu: vis(document.querySelector('#w129 [data-w129ss]')), wide: document.querySelector('#w129 .w129wrap').scrollWidth <= document.querySelector('#w129 .w129wrap').clientWidth + 1 }; });
    ok("phone: each post is a card with reach, views, engaged and rate, no sideways table", !ph.thead && ph.k.join(',') === 'post,Reach,Views,Engaged,Rate' && ph.menu && ph.wide, JSON.stringify(ph));
    await page.selectOption('#w129 [data-w129ss]', 'reach|-1'); await page.waitForTimeout(300);
    const s1 = await ev(() => { const r = w129.rows().map(p => p.reach).filter(v => v != null); let desc = true; for (let i = 1; i < r.length; i++) if (r[i] > r[i - 1]) desc = false; return { desc, sel: document.querySelector('#w129 [data-w129ss]').value }; });
    ok("phone: the sort menu sorts", s1.desc && s1.sel === 'reach|-1', JSON.stringify(s1));
    await page.selectOption('#w129 [data-w129ss]', 'rate|-1'); await page.waitForTimeout(300);
  }
  const m0 = await ev(() => document.querySelectorAll('#w129 tbody tr').length);
  await click('#w129 [data-w129more]');
  const m1 = await ev(() => document.querySelectorAll('#w129 tbody tr').length);
  ok("show more adds 50", m0 === 25 && m1 === 75, m0 + ' -> ' + m1);
  /* downloads */
  const dl = async sel => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 6000 }).catch(() => null), page.click(sel)]); if (!d) return null; const p = await d.path(); return { name: d.suggestedFilename(), text: fs.readFileSync(p, 'utf8') }; };
  const f1 = await dl('#w129 [data-w129csvp]');
  const nrows = await ev(() => w129.rows().length);
  ok("download these posts: a CSV with every matching post", f1 && /^welfare-avenue-posts-2024-09-26-to-2026-09-25\.csv$/.test(f1.name) && /^﻿?platform,published,type,caption,link,reach/.test(f1.text) && f1.text.trim().split('\n').length === nrows + 1, f1 ? f1.name + ' ' + f1.text.split('\n').length + ' vs ' + nrows : 'no download');
  const f2 = await dl('#w129 [data-w129csvd]');
  ok("download the daily numbers", f2 && /^welfare-avenue-analytics-daily-2024-09-26-to-2026-09-25\.csv$/.test(f2.name) && /^﻿?platform,day,metric,value/.test(f2.text) && f2.text.trim().split('\n').length > 10, f2 ? f2.name + ' ' + f2.text.slice(0, 120) : 'no download');
  /* the audience */
  const a1 = await ev(() => { const bs = Array.from(document.querySelectorAll('#w129 .w129aud .b')); const byT = t => bs.filter(b => b.querySelector('h5').textContent.indexOf(t) >= 0)[0]; const rows = b => b ? Array.from(b.querySelectorAll('.row')).map(r => [r.querySelector('span').textContent, r.querySelector('b').textContent]) : null; return { n: bs.length, age: rows(byT('by age')), country: rows(byT('Top countries')), city: rows(byT('Top cities')), size: rows(byT('by company size')), seg: document.querySelectorAll('#w129 [data-w129aud]').length }; });
  ok("instagram ages in order, countries by name", a1.age && a1.age[0][0] === '13-17' && a1.age[1][0] === '18-24' && a1.country && a1.country[0][0] === 'Canada' && a1.country[1][0] === 'United States', JSON.stringify([a1.age, a1.country]).slice(0, 300));
  ok("cities as a share of all followers", a1.city && a1.city[0][0] === 'Montreal, Quebec' && Number(a1.city[0][1].replace('%', '')) < 70, JSON.stringify(a1.city));
  ok("linkedin company size in size order", a1.size && a1.size[0][0] === '1' && a1.size[1][0] === '2-10', JSON.stringify(a1.size));
  await click('#w129 [data-w129aud="visitors"]');
  const a2 = await ev(() => ({ t: Array.from(document.querySelectorAll('#w129 .w129aud h5')).map(h => h.textContent).filter(t => /LinkedIn|visitors|Followers by industry/.test(t) || /Page visitors/.test(t)), on: (document.querySelector('#w129 [data-w129aud].on') || {}).textContent }));
  ok("linkedin visitors", a2.on === 'LinkedIn visitors' && a2.t.some(t => /Page visitors by industry/.test(t)), JSON.stringify(a2));
  /* how far back */
  const v1 = await ev(() => { const rs = Array.from(document.querySelectorAll('#w129 .w129cov .r')); return rs.map(r => ({ p: r.querySelector('b').textContent, st: (r.querySelector('.st') || {}).textContent, back: !!r.querySelector('[data-w129back]'), li: !!r.querySelector('[data-w129li]'), wa: !!r.querySelector('[data-w129wa]') })); });
  const row = p => v1.filter(r => r.p.indexOf(p) === 0)[0] || {};
  ok("six platforms listed", v1.length === 6, JSON.stringify(v1.map(r => r.p)));
  ok("instagram partly loaded, facebook and the website complete, linkedin from the export, tiktok not connected", row('Instagram').st === 'Partly loaded' && row('Facebook').st === 'All the history' && row('Website').st === 'All the history' && row('LinkedIn').st === 'From the export' && row('TikTok').st === 'Not connected', JSON.stringify(v1));
  ok(C.staff ? "staff get the buttons" : "board members read, no buttons", C.staff ? (row('Instagram').back && row('LinkedIn').li && row('WhatsApp').wa && !row('Facebook').back) : (!v1.some(r => r.back || r.li || r.wa)), JSON.stringify(v1));
  if (C.staff) {
    await click('#w129 [data-w129back="4"]');
    await page.waitForTimeout(150);
    const p1 = await ev(() => ({ bar: !!document.querySelector('#w129 .w129bar i'), st: (Array.from(document.querySelectorAll('#w129 .w129cov .r')).filter(r => /Instagram/.test(r.textContent))[0].querySelector('.st') || {}).textContent, dis: document.querySelectorAll('#w129 [data-w129all][disabled], #w129 [data-w129back][disabled]').length }));
    ok("load more history: progress while it runs", p1.bar && p1.st === 'Loading…', JSON.stringify(p1));
    await page.waitForTimeout(1600);
    const p2 = await ev(() => ({ calls: window.__CALLS.filter(c => c[0] === 'fn' && c[2].action === 'backfill').length, st: (Array.from(document.querySelectorAll('#w129 .w129cov .r')).filter(r => /Instagram/.test(r.textContent))[0].querySelector('.st') || {}).textContent, toast: document.body.textContent.indexOf('The history is loaded') >= 0 }));
    ok("it steps until done, then shows all the history", p2.calls === 3 && p2.st === 'All the history', JSON.stringify(p2));
    await click('#w129 [data-w129wa]');
    const w1 = await ev(() => (Array.from(document.querySelectorAll('#w129 .w129cov .r')).filter(r => /WhatsApp/.test(r.textContent))[0].querySelector('.m') || {}).textContent);
    ok("whatsapp check explains the next step", /Assign people/.test(w1) && /system user/.test(w1), w1);
    await page.fill('#w129li', '2000'); await click('#w129 [data-w129li]'); await page.waitForTimeout(400);
    const l1 = await ev(() => { const c = window.__CALLS.filter(x => x[0] === 'fn' && x[2].action === 'import_csv').slice(-1)[0]; return c ? { plat: c[2].platform, n: c[2].rows.length, first: c[2].rows[0], second: c[2].rows[1], last: c[2].rows[c[2].rows.length - 1] } : null; });
    ok("linkedin total: today, then the year rebuilt from the new followers", l1 && l1.plat === 'linkedin' && l1.first.day === '2026-09-25' && l1.first.value === 2000 && l1.second.day === '2026-09-23' && l1.second.value === 2000 && l1.last.value === 2000 - 2 * 29, JSON.stringify(l1));
  }
  /* no flicker: wave120 repaints, the block is back before the browser draws */
  const f0 = await ev(async () => { const a = document.querySelector('#socialstats [data-w120chart="views"]'); a.click(); await Promise.resolve(); await Promise.resolve(); return !!document.querySelector('#socialstats .w120wrap > #w129') && document.querySelectorAll('#w129 .cardy').length >= 3; });
  ok("wave120 repaints do not blank the block", f0);
  /* the tour */
  const tr = await ev(() => { const t = window.w122 && w122.tours && w122.tours.socialstats; return t ? { s: t.steps.map(x => x.s), win: t.steps.filter(x => x.s === '#socialstats .w120ctl')[0].p, chart: t.steps.filter(x => x.s === '#socialstats .cardy.chart')[0].t } : null; });
  ok("the tour covers the new sections", tr && tr.s.indexOf('#w129 .w129tbl') > 0 && tr.s.indexOf('#w129 .w129aud') > 0 && tr.s.indexOf('#w129 .w129cov') > 0 && /all time/.test(tr.win) && tr.chart === 'Over time', JSON.stringify(tr));
  /* the page tour with the numbers in: every step finds its section */
  if (CASE === 'admin' && Number(WIDTH) >= 1000) {
    await ev(() => { location.hash = '#training'; }); await page.waitForTimeout(900);
    await ev(() => w122.startTour('socialstats'));
    const rows = []; let last = -2, same = 0;
    for (let j = 0; j < 80; j++) {
      await page.waitForTimeout(350);
      const st = await ev(() => { const s = w122.state().T; if (!s) return null; const hole = document.querySelector('.w122tp .hole'); return { i: s.i, n: s.steps.length, busy: s.busy, el: !!(s.el && s.el.isConnected) && hole && !hole.classList.contains('none'), t: (document.querySelector('.w122tp .pop h4') || {}).textContent }; });
      if (!st) break; if (st.busy) continue;
      if (st.i === last) { if (++same > 8) { rows.push({ i: st.i, t: st.t, stuck: true }); break; } continue; }
      same = 0; last = st.i; rows.push(st);
      await ev(() => { const b = document.querySelector('.w122tp [data-w122tnext]'); if (b) b.click(); });
    }
    await page.waitForTimeout(700); await ev(() => { const c = document.getElementById('w122cel'); if (c) c.remove(); });
    const n = await ev(() => w122.tours.socialstats.steps.length), shown = rows.filter(r => r.el).map(r => r.t);
    ok("the tour highlights every section once the numbers are in", shown.length >= n - 1 && shown.indexOf('Every post') >= 0 && shown.indexOf('Who follows us') >= 0 && shown.indexOf('How far back') >= 0 && !rows.some(r => r.stuck), JSON.stringify({ n, shown }));
    await ev(() => { location.hash = '#socialstats'; }); await page.waitForTimeout(900); await settle();
  }
  /* churn: nothing repaints on its own while the page sits there */
  const churn = await ev(() => new Promise(res => { let n = 0; const mo = new MutationObserver(m => { n += m.length; }); mo.observe(document.getElementById('socialstats'), { childList: true, subtree: true, attributes: true, characterData: true }); setTimeout(() => { mo.disconnect(); res(n); }, 3000); }));
  ok("no repaint loop while idle", churn < 6, churn);
  await shot('end');
  if (Number(WIDTH) < 800) ok("phone: no sideways scroll", await ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await ev(() => document.documentElement.scrollWidth + ' > ' + window.innerWidth));
  ok("no page errors", errs.length === 0, errs.join(' | '));
  console.log(out.join("\n")); console.log(`\n${CASE} ${WIDTH}: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
