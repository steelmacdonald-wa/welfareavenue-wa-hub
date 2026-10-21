/* wave120 drive: Marketing analytics page, the set-up drawer, CSV mapping, nav placement */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p120");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (/wave120|w120|socialstats/.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };
      try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
      window.__CALLS = [];
      var day = function (i) { return new RealDate(FIXED - i * 86400000).toISOString().slice(0, 10); };
      var ago = function (d) { return new RealDate(FIXED - d * 86400000).toISOString(); };
      function ser(base, amp, n, growth) { var out = []; for (var i = n - 1; i >= 0; i--) { out.push([day(i), Math.round(base + (growth || 0) * (n - i) + amp * Math.abs(Math.sin(i / 3)))]); } return out; }
      window.__WA_RPCS = { social_overview: {
        days: 30, from: day(29), to: day(0),
        accounts: [
          { id: 1, platform: 'facebook', external_id: '1001', handle: null, name: 'Welfare Avenue', url: 'https://facebook.com/welfareavenue', status: 'connected', last_sync_at: ago(0.2), last_error: null },
          { id: 2, platform: 'instagram', external_id: '1777', handle: 'welfareavenue', name: 'Welfare Avenue', url: 'https://instagram.com/welfareavenue/', status: 'connected', last_sync_at: ago(0.2), last_error: null },
          { id: 3, platform: 'tiktok', external_id: 'csv', handle: 'welfareavenue', name: 'welfareavenue', url: null, status: 'csv', last_sync_at: ago(4), last_error: null },
          { id: 4, platform: 'ga4', external_id: '4455', handle: null, name: 'Website (GA4 4455)', url: 'https://welfareavenue.com', status: 'error', last_sync_at: ago(1), last_error: 'GA4: caller does not have permission (add the service account as Viewer)' }
        ],
        totals: {
          instagram: { reach: { cur: 18400, prev: 15100 }, views: { cur: 52000, prev: 61000 }, engagement: { cur: 2100, prev: 1900 }, new_followers: { cur: 140, prev: 90 } },
          facebook: { reach: { cur: 6200, prev: 6100 }, views: { cur: 9800, prev: 7000 }, engagement: { cur: 410, prev: 500 } },
          tiktok: { views: { cur: 71000, prev: 0 }, likes: { cur: 3900, prev: 0 }, shares: { cur: 210, prev: 0 } },
          ga4: { sessions: { cur: 1250, prev: 1100 }, users: { cur: 980, prev: 900 }, pageviews: { cur: 3100, prev: 2800 }, sessions_social: { cur: 220, prev: 140 } }
        },
        followers: { instagram: { now: 3412, then: 3272, day: day(0) }, facebook: { now: 1189, then: 1190, day: day(0) }, tiktok: { now: 2050, then: null, day: day(4) } },
        series: {
          instagram: { followers: ser(3100, 20, 90, 3.5), reach: ser(400, 300, 90), views: ser(1500, 800, 90), engagement: ser(50, 40, 90), new_followers: ser(2, 6, 90) },
          facebook: { followers: ser(1190, 3, 90), reach: ser(180, 90, 90), views: ser(300, 120, 90), engagement: ser(10, 12, 90) },
          tiktok: { followers: ser(1800, 30, 40, 6), views: ser(1500, 2000, 40), likes: ser(90, 100, 40) },
          ga4: { sessions: ser(30, 25, 90), users: ser(25, 20, 90), pageviews: ser(80, 60, 90), sessions_social: ser(5, 8, 90) }
        },
        posts: [
          { id: 1, platform: 'instagram', external_id: 'a1', url: 'https://instagram.com/p/a1', kind: 'reels', caption: 'Sunday serving at Berri-UQAM: 220 warm meals and a lot of hugs. Thank you to every volunteer who showed up in the rain.', thumb_url: null, published_at: ago(3), reach: 9100, views: 24000, likes: 610, comments: 44, shares: 120, saves: 38, engagement: 812 },
          { id: 2, platform: 'facebook', external_id: 'b1', url: 'https://facebook.com/welfareavenue/posts/b1', kind: 'post', caption: 'Rally Paper registration is open. Teams of four, one Saturday, the whole city.', thumb_url: null, published_at: ago(6), reach: 3100, views: 4200, likes: 140, comments: 12, shares: 30, saves: null, engagement: 182 },
          { id: 3, platform: 'tiktok', external_id: 'https://www.tiktok.com/@welfareavenue/video/7', url: 'https://www.tiktok.com/@welfareavenue/video/7', kind: 'post', caption: 'POV: your first shift as a server', thumb_url: null, published_at: ago(10), reach: null, views: 41000, likes: 2900, comments: 88, shares: 150, saves: null, engagement: 3138 },
          { id: 4, platform: 'instagram', external_id: 'a2', url: 'https://instagram.com/p/a2', kind: 'post', caption: 'Meet Mary, who has coordinated our cooks for two years.', thumb_url: null, published_at: ago(14), reach: 2800, views: 3900, likes: 240, comments: 19, shares: 8, saves: 12, engagement: 279 },
          { id: 5, platform: 'ga4', external_id: '/volunteer', url: 'https://welfareavenue.com/volunteer', kind: 'page', caption: 'Volunteer with us', thumb_url: null, published_at: ago(1), reach: 410, views: 690, likes: 0, comments: 0, shares: 0, saves: null, engagement: 0 },
          { id: 6, platform: 'ga4', external_id: '/', url: 'https://welfareavenue.com/', kind: 'page', caption: 'Welfare Avenue', thumb_url: null, published_at: ago(1), reach: 800, views: 1300, likes: 0, comments: 0, shares: 0, saves: null, engagement: 0 }
        ],
        note: { id: 1, week_start: day(3), platform: null, body: 'Instagram reach rose by a fifth on the back of the Sunday serving reel, which drew most of the new followers. TikTok views came from one video about a first shift. Try a short volunteer story every Thursday.', model: 'moonshotai/kimi-k2.6', created_at: ago(2) }
      } };
      window.__WA_FN = function (name, body) {
        window.__CALLS.push({ name: name, body: body });
        if (name !== 'social-pull') return null;
        if (body.action === 'status') return { ok: true, accounts: window.__WA_RPCS.social_overview.accounts, meta_token: true, sa_email: 'wa-hub-drive@welfare-avenue-dashboard.iam.gserviceaccount.com' };
        if (body.action === 'probe') return { ok: true, meta: { ok: true, as: 'hub-analytics', pages: [ { id: '1001', name: 'Welfare Avenue', followers: 1189, picture: null, instagram: { id: '1777', username: 'welfareavenue', followers: 3412, media: 240 } }, { id: '1002', name: 'Rally Paper', followers: 300, picture: null, instagram: null } ] }, accounts: [] };
        if (body.action === 'connect_meta') return { ok: true, added: [ { id: 1, platform: 'facebook' }, { id: 2, platform: 'instagram' } ], results: [ { id: 1, rows: 60 }, { id: 2, rows: 120 } ] };
        if (body.action === 'connect_ga4') return { ok: true, account: { id: 4 }, result: { rows: 120 } };
        if (body.action === 'sync') return { ok: true, results: [ { id: 1, rows: 10 }, { id: 2, rows: 20 }, { id: 4, error: 'GA4: caller does not have permission' } ] };
        if (body.action === 'note') return { ok: true, note: { body: 'fresh note' } };
        if (body.action === 'import_csv') return { ok: true, account_id: 3, rows: body.rows.length, posts: body.posts.length };
        if (body.action === 'disconnect') return { ok: true };
        return { ok: true };
      };
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) {
      const patched = stub + "\n;(function(){ try { var mk = window.supabase && window.supabase.createClient; if (!mk) return; window.supabase.createClient = function () { var c = mk.apply(this, arguments); var orig = c.functions.invoke.bind(c.functions); c.functions.invoke = async function (name, opts) { var body = (opts && opts.body) || {}; var r = window.__WA_FN ? window.__WA_FN(name, body) : null; if (r) return { data: r, error: null }; return orig(name, opts); }; var rpc = c.rpc.bind(c); c.rpc = function (fn, args) { window.__CALLS.push({ name: 'rpc:' + fn, body: args }); return rpc(fn, args); }; return c; }; } catch (e) {} })();";
      return route.fulfill({ contentType: "application/javascript", body: patched });
    }
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2600);
  const out = { identity: TAG };
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 900); };
  const shot = async (n, full) => page.screenshot({ path: path.join(shots, TAG + "_" + n + ".png"), fullPage: !!full });
  const q = (sel) => page.evaluate(s => document.querySelectorAll(s).length, sel);
  const txt = (sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);

  /* 1. nav: the Analytics tab sits in the Marketing menu */
  out.nav_tab = await page.evaluate(() => { const b = document.querySelector('#tabBar .tab[data-tab="socialstats"]'); if (!b) return null; const row = b.closest('.w42d'); const own = row ? row.querySelector(':scope > .tab') : null; return { in_sub: !!b.closest('.w42sub'), team: own ? own.dataset.tab : null, text: b.textContent.trim(), display: b.style.display }; });
  /* 2. the team page pill */
  await go('#team/marketing', 2200);
  out.team_pill = await q('#team .w116seg a[data-w116go="#socialstats"]');
  /* 3. the page */
  await go('#socialstats', 2200);
  out.active = await page.evaluate(() => (document.querySelector('.panel.active') || {}).id);
  if (out.active !== 'socialstats') { out.debug = await page.evaluate(() => window.w120Debug ? window.w120Debug() : null); out.errors = errs; fs.writeFileSync(path.join(shots, TAG + '_result.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); await browser.close(); return; }
  out.rpc_calls = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'rpc:social_overview').map(c => JSON.stringify(c.body)));
  out.tiles = await page.evaluate(() => Array.from(document.querySelectorAll('#socialstats .tile')).map(t => (t.querySelector('.ph b') || {}).textContent + ' | ' + (t.querySelector('.st') || {}).textContent + ' | ' + ((t.querySelector('.big') || {}).textContent || '').replace(/\s+/g, ' ').trim()));
  out.tile_rows = await page.evaluate(() => Array.from(document.querySelectorAll('#socialstats .tile .row')).map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  out.sparks = await q('#socialstats .tile svg.sp');
  out.chart_lines = await q('#socialstats .chart polyline');
  out.chart_legend = await txt('#socialstats .chart .lg');
  out.note = await txt('#socialstats .note p');
  out.posts = await q('#socialstats .post');
  out.post_first = await txt('#socialstats .post .cap');
  out.post_nums = await txt('#socialstats .post .nums');
  out.pages = await page.evaluate(() => { const h = Array.from(document.querySelectorAll('#socialstats .cardy h4')).filter(x => /Most read/.test(x.textContent))[0]; return h ? h.nextElementSibling.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : null; });
  out.chips = await q('#socialstats .fchips span');
  out.setup_btn = await q('#socialstats [data-w120setup="toggle"]');
  await shot('page', true);
  /* 4. period + chart metric + filter */
  await page.evaluate(() => document.querySelector('#socialstats [data-w120days="7"]').click());
  await page.waitForTimeout(700);
  out.rpc_calls_after = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'rpc:social_overview').map(c => JSON.stringify(c.body)));
  out.days_on = await txt('#socialstats .w120ctl .w116seg a.on');
  await page.evaluate(() => document.querySelector('#socialstats [data-w120chart="views"]').click());
  await page.waitForTimeout(300);
  out.chart_on = await txt('#socialstats .chart .w116seg a.on');
  out.chart_lines_views = await q('#socialstats .chart polyline');
  await page.evaluate(() => document.querySelector('#socialstats [data-w120f="tiktok"]').click());
  await page.waitForTimeout(300);
  out.posts_tiktok = await q('#socialstats .post');
  await page.evaluate(() => document.querySelector('#socialstats [data-w120f=""]').click());
  await page.waitForTimeout(300);

  if (ROLE === 'staff' || ROLE === 'admin') {
    /* 5. sync + note */
    await page.evaluate(() => document.querySelector('#socialstats [data-w120sync="all"]').click());
    await page.waitForTimeout(900);
    out.sync_call = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'social-pull' && c.body.action === 'sync').length);
    await page.evaluate(() => document.querySelector('#socialstats [data-w120note]').click());
    await page.waitForTimeout(900);
    out.note_call = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'social-pull' && c.body.action === 'note').map(c => c.body.days));
    /* 6. set-up */
    await page.evaluate(() => document.querySelector('#socialstats [data-w120setup="toggle"]').click());
    await page.waitForTimeout(900);
    out.setup_cards = await q('#socialstats .setup .sc');
    out.setup_sa = await page.evaluate(() => { const c = document.querySelector('#socialstats .setup code'); return c ? c.textContent : null; });
    out.setup_acc_rows = await q('#socialstats .setup .acc');
    await page.evaluate(() => document.querySelector('#socialstats [data-w120probe]').click());
    await page.waitForTimeout(700);
    out.probe_pages = await page.evaluate(() => Array.from(document.querySelectorAll('#socialstats .setup .pg')).map(p => p.textContent.replace(/\s+/g, ' ').trim().slice(0, 90)));
    await shot('setup', true);
    await page.evaluate(() => document.querySelector('#socialstats [data-w120connect="1001"]').click());
    await page.waitForTimeout(900);
    out.connect_call = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'social-pull' && c.body.action === 'connect_meta').map(c => c.body.page_id));
    /* GA4 */
    await page.evaluate(() => document.querySelector('#socialstats [data-w120setup="toggle"]') && !document.querySelector('#socialstats .setup') && document.querySelector('#socialstats [data-w120setup="toggle"]').click());
    await page.waitForTimeout(600);
    await page.fill('#w120gaid', '4455');
    await page.fill('#w120gasite', 'https://welfareavenue.com');
    await page.evaluate(() => document.querySelector('#socialstats [data-w120ga]').click());
    await page.waitForTimeout(800);
    out.ga_call = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'social-pull' && c.body.action === 'connect_ga4').map(c => c.body.property_id + ' ' + c.body.site));
    /* 7. CSV: TikTok overview export */
    await page.evaluate(() => document.querySelector('#socialstats [data-w120setup="toggle"]') && !document.querySelector('#socialstats .setup') && document.querySelector('#socialstats [data-w120setup="toggle"]').click());
    await page.waitForTimeout(600);
    const csv = 'Date,Video Views,Profile Views,Likes,Comments,Shares\n2026-07-30,1200,40,90,4,12\n2026-07-31,"1,850",55,130,9,20\n2026-08-01,900,22,60,2,7\n';
    await page.setInputFiles('#socialstats input[data-w120csv="tiktok"]', { name: 'overview.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForTimeout(700);
    out.csv_map = await page.evaluate(() => Array.from(document.querySelectorAll('#socialstats [data-w120map]')).map(s => s.getAttribute('data-w120map') + '=' + (s.selectedOptions[0] ? s.selectedOptions[0].textContent : '')));
    await shot('csv', true);
    await page.evaluate(() => document.querySelector('#socialstats [data-w120import]').click());
    await page.waitForTimeout(900);
    out.csv_import = await page.evaluate(() => { const c = window.__CALLS.filter(c => c.name === 'social-pull' && c.body.action === 'import_csv')[0]; return c ? { platform: c.body.platform, rows: c.body.rows.length, sample: c.body.rows.slice(0, 3), handle: c.body.handle } : null; });
    /* posts CSV */
    await page.evaluate(() => document.querySelector('#socialstats [data-w120setup="toggle"]') && !document.querySelector('#socialstats .setup') && document.querySelector('#socialstats [data-w120setup="toggle"]').click());
    await page.waitForTimeout(600);
    await page.selectOption('#socialstats [data-w120csvkind="linkedin"]', 'posts');
    const csv2 = 'Post title,Post link,Created date,Impressions,Reactions,Comments,Reposts\n"Rally Paper, open",https://www.linkedin.com/feed/update/1,07/28/2026,2400,55,6,4\nBoard welcome,https://www.linkedin.com/feed/update/2,07/20/2026,900,20,1,0\n';
    await page.setInputFiles('#socialstats input[data-w120csv="linkedin"]', { name: 'content.csv', mimeType: 'text/csv', buffer: Buffer.from(csv2) });
    await page.waitForTimeout(700);
    out.csv2_map = await page.evaluate(() => Array.from(document.querySelectorAll('#socialstats [data-w120map]')).map(s => s.getAttribute('data-w120map') + '=' + (s.selectedOptions[0] ? s.selectedOptions[0].textContent : '')));
    await page.evaluate(() => document.querySelector('#socialstats [data-w120import]').click());
    await page.waitForTimeout(900);
    out.csv2_import = await page.evaluate(() => { const c = window.__CALLS.filter(c => c.name === 'social-pull' && c.body.action === 'import_csv')[1]; return c ? { platform: c.body.platform, posts: c.body.posts } : null; });
  }
  /* 8. narrow */
  await page.setViewportSize({ width: 420, height: 860 });
  await page.waitForTimeout(500);
  out.narrow_overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await shot('narrow', true);
  out.errors = errs;
  fs.writeFileSync(path.join(shots, TAG + "_result.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error("DRIVE FAILED", e); process.exit(1); });
