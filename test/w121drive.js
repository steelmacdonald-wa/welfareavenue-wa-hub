/* wave121 drive: the content calendar (views, drag and drop, undo, composer, media, AI, plan/publish, mark posted, settings) and wave120b insights */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", PUB = "plan", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p121");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (/wave12|w121|w120|contentcal|socialstats/.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };
      try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
      window.__CALLS = []; window.__WRITES = [];
      var PUB = ${JSON.stringify(PUB)};
      function dayIso(n, hhmm) { var d = new RealDate(FIXED + n * 86400000); var ds = d.toISOString().slice(0, 10); return new RealDate(ds + 'T' + hhmm + ':00').toISOString(); }
      var ago = function (dd) { return new RealDate(FIXED - dd * 86400000).toISOString(); };
      /* 90 days of posts for the insights: Thursday evenings and reels do best */
      var posts = [];
      for (var i = 0; i < 28; i++) {
        var dd = 2 + i * 3; var base = new RealDate(FIXED - dd * 86400000); var ds = base.toISOString().slice(0, 10);
        var hour = i % 2 ? 19 : 9; var t = new RealDate(ds + 'T' + String(hour).padStart(2, '0') + ':00:00-04:00');
        var reel = i % 3 === 0; var wd = new RealDate(ds + 'T12:00:00-04:00').getUTCDay();
        var reach = 700 + (hour === 19 ? 900 : 0) + (reel ? 1300 : 0) + (wd === 4 ? 800 : 0) + (i * 37 % 150);
        posts.push({ id: 100 + i, platform: i % 4 === 3 ? 'facebook' : 'instagram', external_id: 'p' + i, url: 'https://www.instagram.com/p/p' + i + '/', kind: reel ? 'reels' : (i % 5 === 1 ? 'carousel_album' : 'image'), caption: i % 2 ? 'Thursday kitchen night with the team #mtl #food' : 'A longer caption about the Sunday serving, the volunteers, the kitchen and the neighbours who came by for a warm meal and a conversation. Volunteer with us, link in bio. #mtl #community #food #volunteer', published_at: t.toISOString(), reach: reach, views: reach * 2, likes: Math.round(reach / 12), comments: 5, shares: 3, saves: 4, engagement: Math.round(reach / 12) + 12 });
      }
      function ser(base, amp, n, growth) { var out = []; for (var k = n - 1; k >= 0; k--) { out.push([new RealDate(FIXED - k * 86400000).toISOString().slice(0, 10), Math.round(base + (growth || 0) * (n - k) + amp * Math.abs(Math.sin(k / 3)))]); } return out; }
      var accounts = [ { id: 1, platform: 'facebook', external_id: '1001', name: 'Welfare Avenue', status: 'connected', last_sync_at: ago(0.2) }, { id: 2, platform: 'instagram', external_id: '1777', handle: 'welfareavenue', name: 'Welfare Avenue', status: 'connected', last_sync_at: ago(0.2) } ];
      window.__WA_RPCS = {
        social_overview: { days: 90, from: ago(89).slice(0, 10), to: ago(0).slice(0, 10), accounts: accounts,
          totals: { instagram: { reach: { cur: 52000, prev: 44000 }, views: { cur: 99000, prev: 91000 }, engagement: { cur: 4100, prev: 3900 } }, facebook: { reach: { cur: 9000, prev: 11000 }, engagement: { cur: 500, prev: 640 } }, ga4: { sessions: { cur: 3800, prev: 3300 }, sessions_social: { cur: 700, prev: 450 }, users: { cur: 3000, prev: 2700 } } },
          followers: { instagram: { now: 3412, then: 3150 }, facebook: { now: 1189, then: 1195 } },
          series: { instagram: { reach: ser(400, 300, 90), followers: ser(3150, 10, 90, 3) }, facebook: { reach: ser(120, 80, 90), followers: ser(1195, 3, 90) } },
          posts: [ { id: 900, platform: 'ga4', external_id: '/volunteer', url: 'https://welfareavenue.com/volunteer', kind: 'page', caption: 'Volunteer with us', published_at: ago(1), views: 900, reach: 500 } ],
          posts_all: posts,
          note: null,
          insights: { id: 5, week_start: ago(3).slice(0, 10), body: 'Lean into reels on Thursday evenings and keep captions short.', created_at: ago(2), model: 'moonshotai/kimi-k2.6', data: { days: 90, recommendations: [ { title: 'Post reels on Thursday evenings', why: 'Thursday posts do 1.9x a typical post and reels 1.7x.', action: 'Plan next Thursday 19:00 reel from the Sunday serving.', confidence: 'high', evidence: 'weekday' }, { title: 'Keep captions short', why: 'Short captions do 1.4x.', action: 'Cut the next two captions under 80 characters.', confidence: 'medium', evidence: 'caption' }, { title: 'Send social to the volunteer page', why: 'Social brings 18% of website visits.', action: 'Add the volunteer link in bio this week.', confidence: 'medium', evidence: 'website' } ] } }
        }
      };
      window.__WAFIX_EXTRA = {
        content_posts: [
          { id: 11, title: 'Sunday serving recap', platforms: ['facebook', 'instagram'], format: 'carousel', caption: 'Two hundred warm meals at Berri-UQAM today, and six new volunteers in the kitchen.', link_url: null, media: [ { url: 'https://stub.local/a.jpg', kind: 'image', w: 1080, h: 1350 } ], scheduled_at: dayIso(2, '19:00'), status: 'scheduled', results: {}, live: {}, owner: 'Amanda Zoldak', campaign: 'Sunday servings', created_at: ago(3), updated_at: ago(1) },
          { id: 12, title: 'Volunteer call', platforms: ['instagram'], caption: 'We need servers for Sunday.', media: [], scheduled_at: dayIso(5, '12:00'), status: 'draft', results: {}, live: {}, created_at: ago(3), updated_at: ago(1) },
          { id: 13, title: 'Rally Paper teams', platforms: ['facebook'], caption: 'Rally Paper registration is open: teams of four, one Saturday.', media: [], scheduled_at: dayIso(-1, '18:00'), status: 'scheduled', results: {}, live: {}, created_at: ago(6), updated_at: ago(2) },
          { id: 14, title: 'Kitchen reel', platforms: ['instagram'], caption: 'POV: your first shift in the kitchen', media: [ { url: 'https://stub.local/v.mp4', kind: 'video', w: 1080, h: 1920, dur: 22 } ], scheduled_at: dayIso(-3, '19:00'), status: 'published', published_at: dayIso(-3, '19:00'), results: { instagram: { id: 'm1', url: 'https://www.instagram.com/p/m1/' } }, live: { instagram: { external_id: 'm1', url: 'https://www.instagram.com/p/m1/', reach: 4200, likes: 310, comments: 18, matched: 'id', published_at: dayIso(-3, '19:00') } }, created_at: ago(8), updated_at: ago(2) },
          { id: 15, title: 'Board welcome', platforms: ['facebook'], caption: 'Welcome to our new board members, Tamara and Jules.', media: [], scheduled_at: dayIso(-4, '10:00'), status: 'posted', published_at: dayIso(-4, '10:00'), results: { facebook: { manual: true, url: null } }, live: {}, created_at: ago(8), updated_at: ago(4) },
          { id: 16, title: 'Donor thank-you', platforms: ['facebook', 'instagram'], caption: 'Thank you to everyone who gave this month.', media: [ { url: 'https://stub.local/b.jpg', kind: 'image', w: 1000, h: 1500 } ], scheduled_at: dayIso(-2, '12:00'), status: 'failed', results: { facebook: { id: '1001_77', url: 'https://www.facebook.com/1001_77' } }, live: {}, error: 'Instagram: The aspect ratio is not supported (code 36003)', created_at: ago(5), updated_at: ago(2) },
          { id: 17, title: 'Gift basket drive idea', platforms: ['instagram'], caption: '', media: [], scheduled_at: null, status: 'draft', results: {}, live: {}, created_at: ago(1), updated_at: ago(1) }
        ]
      };
      window.__WA_FN = function (name, body) {
        window.__CALLS.push({ name: name, body: body });
        if (name === 'social-publish') {
          if (body.action === 'capabilities') return PUB === 'publish' ? { ok: true, token: true, can: { instagram: true, facebook: true }, granted: ['pages_manage_posts', 'instagram_content_publish'], missing: [], accounts: accounts, settings: { slack_confirm: false } } : { ok: true, token: false, can: { instagram: false, facebook: false }, granted: [], missing: [], accounts: accounts, settings: {} };
          if (body.action === 'publish') return { ok: true, id: body.post_id, status: 'published', results: { instagram: { id: 'm9', url: 'https://www.instagram.com/p/m9/' }, facebook: { id: '1001_9', url: 'https://www.facebook.com/1001_9' } }, errors: [] };
          if (body.action === 'settings') return { ok: true, settings: body.value };
          if (body.action === 'confirm') return { ok: true, updated: 0 };
        }
        if (name === 'checkin-post' && body.action === 'channels') return { ok: true, channels: [ { id: 'C1', name: 'general', member: true }, { id: 'C2', name: 'social-media', member: true } ] };
        if (name === 'social-pull' && body.action === 'insights') return { ok: true, insights: { id: 6 } };
        if (name === 'llm' && body.caller === 'content-calendar') return { content: [ { type: 'tool_use', name: 'captions', input: { options: [ { caption: 'Two hundred warm meals and six new faces in the kitchen. Thank you, Montreal.', note: 'warm, short' }, { caption: 'Sunday at Berri-UQAM: meals, music and neighbours.', note: 'scene first' }, { caption: 'Come serve with us next Sunday. Link in bio.', note: 'the ask' } ], hashtags: ['#MTL', '#Montreal', '#WelfareAvenue', 'community'] } } ] };
        return null;
      };
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + "; window.__WAFIX.content_posts = window.__WAFIX_EXTRA.content_posts;");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) {
      const patched = stub + "\n;(function(){ try { var mk = window.supabase && window.supabase.createClient; if (!mk) return; window.supabase.createClient = function () { var c = mk.apply(this, arguments); var orig = c.functions.invoke.bind(c.functions); c.functions.invoke = async function (name, opts) { var body = (opts && opts.body) || {}; var r = window.__WA_FN ? window.__WA_FN(name, body) : null; if (r) return { data: r, error: null }; return orig(name, opts); }; var rpc = c.rpc.bind(c); c.rpc = function (fn, args) { window.__CALLS.push({ name: 'rpc:' + fn, body: args }); return rpc(fn, args); }; var from = c.from.bind(c); c.from = function (t) { var b = from(t); var ins = b.insert.bind(b), upd = b.update.bind(b), del = b.delete.bind(b); b.insert = function (p) { window.__WRITES.push({ t: t, op: 'insert', p: p }); return ins(p); }; b.update = function (p) { window.__WRITES.push({ t: t, op: 'update', p: p }); return upd(p); }; b.delete = function () { window.__WRITES.push({ t: t, op: 'delete' }); return del(); }; return b; }; var st = c.storage.from.bind(c.storage); c.storage.from = function (bk) { var s = st(bk); var up = s.upload; s.upload = function (p, blob, o) { window.__WRITES.push({ t: 'storage:' + bk, op: 'upload', p: { path: p, type: o && o.contentType, size: blob && blob.size } }); return up.apply(s, arguments); }; return s; }; return c; }; } catch (e) {} })();";
      return route.fulfill({ contentType: "application/javascript", body: patched });
    }
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2600);
  const out = { identity: TAG, mode: PUB };
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 900); };
  const shot = async (n, full) => page.screenshot({ path: path.join(shots, TAG + "_" + PUB + "_" + n + ".png"), fullPage: !!full });
  const q = (sel) => page.evaluate(s => document.querySelectorAll(s).length, sel);
  const txt = (sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  const writes = (t, op) => page.evaluate(([t, op]) => window.__WRITES.filter(w => w.t === t && (!op || w.op === op)).map(w => w.p), [t, op]);
  const dnd = async (fromSel, toSel) => page.evaluate(([a, b]) => { const s = document.querySelector(a), d = document.querySelector(b); if (!s || !d) return 'missing ' + (!s ? a : b); const dt = new DataTransfer(); s.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt })); d.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); d.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); s.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt })); return 'ok'; }, [fromSel, toSel]);

  /* 1. nav */
  out.nav = await page.evaluate(() => { const b = document.querySelector('#tabBar .tab[data-tab="contentcal"]'); const a = document.querySelector('#tabBar .tab[data-tab="socialstats"]'); return b ? { in_sub: !!b.closest('.w42sub'), text: b.textContent.trim(), before_analytics: !!(a && b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) } : null; });
  await go('#team/marketing', 2000);
  out.pill = await page.evaluate(() => Array.from(document.querySelectorAll('#team .w116seg a')).map(a => a.textContent.trim()));

  /* 2. the analytics insights */
  await go('#socialstats', 2400);
  out.ins_recs = await q('#socialstats .rec');
  out.ins_ev = await page.evaluate(() => Array.from(document.querySelectorAll('#socialstats .ev')).map(e => e.getAttribute('data-w120ev') + ': ' + e.querySelector('b').textContent));
  out.ins_sum = await txt('#socialstats .ins .sum');
  out.ins_detail = await page.evaluate(() => Array.from(document.querySelectorAll('#socialstats .ev')).slice(0, 4).map(e => e.querySelector('p').textContent));
  out.best_slot = await page.evaluate(() => window.w120BestSlot ? window.w120BestSlot(window.w120Data()) : null);
  await shot('insights', true);
  if (ROLE === 'staff') {
    await page.evaluate(() => document.querySelector('#socialstats [data-w120plan="0"]').click());
    await page.waitForTimeout(1800);
    out.plan_hash = await page.evaluate(() => location.hash);
    out.plan_prefill = await page.evaluate(() => ({ title: (document.getElementById('w121title') || {}).value, notes: (document.getElementById('w121notes') || {}).value, date: (document.getElementById('w121date') || {}).value, time: (document.getElementById('w121time') || {}).value }));
    await page.evaluate(() => { const x = document.querySelector('#w121dr [data-w121close]'); if (x) x.click(); });
    await page.waitForTimeout(400);
  }

  /* 3. the calendar */
  await go('#contentcal', 2200);
  out.active = await page.evaluate(() => (document.querySelector('.panel.active') || {}).id);
  out.dbg = await page.evaluate(() => window.w121Debug ? window.w121Debug() : null);
  out.cap = await txt('#contentcal .cap');
  out.glance = await page.evaluate(() => Array.from(document.querySelectorAll('#contentcal .glance > div')).map(d => d.textContent.replace(/\s+/g, ' ').trim()));
  out.month_chips = await page.evaluate(() => Array.from(document.querySelectorAll('#contentcal .mg .ch')).map(c => c.getAttribute('data-w121card') + ':' + c.className.replace('ch ', '') + ':' + c.getAttribute('draggable')));
  out.best_days = await q('#contentcal .d.best');
  out.tray = await page.evaluate(() => Array.from(document.querySelectorAll('#contentcal .tray .tr b')).map(b => b.textContent));
  await shot('month', true);
  if (ROLE === 'staff') {
    /* drag a scheduled post two days later */
    const target = await page.evaluate(() => { const c = document.querySelector('#contentcal .mg .ch[data-w121card="11"]'); const d = c.closest('[data-w121day]').getAttribute('data-w121day'); const n = new Date(d + 'T12:00:00'); const t = new Date(n.getTime() + 2 * 86400000); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); });
    out.dnd = await dnd('#contentcal .mg .ch[data-w121card="11"]', '#contentcal [data-w121day="' + target + '"]');
    await page.waitForTimeout(600);
    out.move_write = (await writes('content_posts', 'update')).slice(-1);
    out.moved_to = await page.evaluate(() => { const c = document.querySelector('#contentcal .mg .ch[data-w121card="11"]'); return c ? c.closest('[data-w121day]').getAttribute('data-w121day') + ' ' + c.querySelector('.tm').textContent : null; });
    out.target = target;
    out.undo_bar = await txt('#contentcal .undo span');
    await page.evaluate(() => document.querySelector('#contentcal [data-w121undo]').click());
    await page.waitForTimeout(500);
    out.after_undo = await page.evaluate(() => { const c = document.querySelector('#contentcal .mg .ch[data-w121card="11"]'); return c ? c.closest('[data-w121day]').getAttribute('data-w121day') + ' ' + c.querySelector('.tm').textContent : null; });
    /* an idea onto a day */
    out.idea_dnd = await dnd('#contentcal .tray [data-w121card="17"]', '#contentcal [data-w121day="' + target + '"]');
    await page.waitForTimeout(600);
    out.idea_write = (await writes('content_posts', 'update')).slice(-1);
    out.idea_on_day = await q('#contentcal [data-w121day="' + target + '"] [data-w121card="17"]');
    /* published posts are not draggable; a past day refuses the drop */
    out.published_draggable = await page.evaluate(() => { const c = document.querySelector('#contentcal .mg .ch[data-w121card="14"]'); return c ? c.getAttribute('draggable') : 'missing'; });
  }

  /* 4. filters and views */
  await page.evaluate(() => document.querySelector('#contentcal [data-w121jump="attn"]').click());
  await page.waitForTimeout(500);
  out.attn_list = await page.evaluate(() => Array.from(document.querySelectorAll('#contentcal .lg h4')).map(h => h.textContent.replace(/\s+/g, ' ').trim()).concat(Array.from(document.querySelectorAll('#contentcal .lr')).map(r => r.querySelector('b').textContent + ' | ' + r.querySelector('.pill').textContent + ' | ' + ((r.querySelector('.cf') || {}).textContent || ''))));
  await shot('list_attn', true);
  await page.evaluate(() => document.querySelector('#contentcal [data-w121fst=""]').click());
  await page.evaluate(() => document.querySelector('#contentcal [data-w121view="week"]').click());
  await page.waitForTimeout(400);
  out.week_cols = await q('#contentcal .wg .wc');
  out.week_cards = await q('#contentcal .wg .wk');
  await shot('week', true);
  await page.evaluate(() => document.querySelector('#contentcal [data-w121view="month"]').click());
  await page.fill('#w121q', 'rally');
  await page.waitForTimeout(500);
  out.search_chips = await q('#contentcal .mg .ch');
  await page.fill('#w121q', '');
  await page.waitForTimeout(400);

  /* 5. the composer: new post on a day */
  if (ROLE === 'staff') {
    const day = await page.evaluate(() => { const b = document.querySelector('#contentcal .d:not(.past):not(.out) [data-w121new]'); return b ? b.getAttribute('data-w121new') : null; });
    await page.evaluate(d => document.querySelector('#contentcal [data-w121new="' + d + '"]').click(), day);
    await page.waitForTimeout(700);
    out.new_open = await q('#w121dr .pn');
    out.new_date = await page.evaluate(() => [(document.getElementById('w121date') || {}).value, (document.getElementById('w121time') || {}).value]);
    out.new_day = day;
    out.val_empty = await page.evaluate(() => Array.from(document.querySelectorAll('#w121dr .val div')).map(d => d.className + ':' + d.textContent));
    await page.setInputFiles('#w121file', [path.join(__dirname, 'fx_2x3.png'), path.join(__dirname, 'fx_1x1.png')]);
    await page.waitForTimeout(2500);
    out.thumbs = await page.evaluate(() => Array.from(document.querySelectorAll('#w121dr .th .rt')).map(r => r.textContent + (r.classList.contains('bad') ? '!' : '')));
    out.uploads = (await writes('storage:content-images', 'upload')).map(u => u.path.replace(/\/[^/]+$/, '/..') + ' ' + u.type);
    out.val_ratio = await page.evaluate(() => Array.from(document.querySelectorAll('#w121dr .val div')).map(d => d.className + ':' + d.textContent));
    await page.evaluate(() => document.querySelector('#w121dr [data-w121crop="0"][data-r="0.8"]').click());
    await page.waitForTimeout(1500);
    out.thumbs_after_crop = await page.evaluate(() => Array.from(document.querySelectorAll('#w121dr .th .rt')).map(r => r.textContent + (r.classList.contains('bad') ? '!' : '')));
    out.val_after_crop = await page.evaluate(() => Array.from(document.querySelectorAll('#w121dr .val div')).map(d => d.className + ':' + d.textContent));
    await page.fill('#w121title', 'Test post from the drive');
    await page.fill('#w121cap', 'Sunday at Berri-UQAM');
    await page.evaluate(() => document.querySelector('#w121dr [data-w121ai="write"]').click());
    await page.waitForTimeout(900);
    out.ai_opts = await q('#w121dr .aio [data-w121aipick]');
    out.ai_call = await page.evaluate(() => { const c = window.__CALLS.filter(c => c.name === 'llm' && c.body.caller === 'content-calendar').slice(-1)[0]; return c ? { task: c.body.task, has_system: !!c.body.system, tool: c.body.tools[0].name } : null; });
    await page.evaluate(() => document.querySelector('#w121dr [data-w121aipick="0"]').click());
    await page.waitForTimeout(300);
    out.caption_after_pick = await page.evaluate(() => document.getElementById('w121cap').value);
    await page.evaluate(() => document.querySelector('#w121dr [data-w121ai="hashtags"]').click());
    await page.waitForTimeout(700);
    await page.evaluate(() => { const t = document.querySelector('#w121dr [data-w121tag]'); if (t) t.click(); });
    await page.waitForTimeout(200);
    out.caption_after_tag = await page.evaluate(() => document.getElementById('w121cap').value);
    out.preview_ig = await page.evaluate(() => ({ media: !!document.querySelector('#w121dr .mock .mm img'), dots: document.querySelectorAll('#w121dr .mock .dots i').length, handle: (document.querySelector('#w121dr .mock .mh b') || {}).textContent }));
    await page.evaluate(() => { const t = document.querySelector('#w121dr [data-w121tab="facebook"]'); if (t) t.click(); });
    await page.waitForTimeout(300);
    out.preview_fb = await page.evaluate(() => ({ grid: document.querySelectorAll('#w121dr .mock .fbg img').length, name: (document.querySelector('#w121dr .mock .mh b') || {}).textContent }));
    out.footer = await page.evaluate(() => Array.from(document.querySelectorAll('#w121dr footer button')).map(b => b.textContent + (b.disabled ? '(disabled)' : '')));
    await shot('composer', false);
    const mode = PUB === 'publish' ? 'publish' : 'schedule';
    await page.evaluate(m => document.querySelector('#w121dr [data-w121save="' + m + '"]').click(), mode);
    await page.waitForTimeout(1500);
    out.save_insert = (await writes('content_posts', 'insert')).slice(-1).map(p => ({ title: p.title, status: p.status, platforms: p.platforms, media: (p.media || []).map(m => m.kind + ' ' + m.w + 'x' + m.h), scheduled: p.scheduled_at, caption: p.caption }));
    out.publish_call = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'social-publish' && c.body.action === 'publish').map(c => c.body.post_id));
    out.drawer_after = await q('#w121dr .pn');
    out.drawer_status = await txt('#w121dr header .pill');
    await page.evaluate(() => { const x = document.querySelector('#w121dr [data-w121close]'); if (x) x.click(); });
    await page.waitForTimeout(400);

    /* 6. a live post opens read-only with its confirmation */
    await page.evaluate(() => document.querySelector('#contentcal [data-w121open="14"]').click());
    await page.waitForTimeout(600);
    out.live_ro = await page.evaluate(() => ({ disabled: document.getElementById('w121cap').disabled, res: (document.querySelector('#w121dr .res') || {}).textContent.replace(/\s+/g, ' ').trim().slice(0, 200), hash: location.hash }));
    await page.evaluate(() => document.querySelector('#w121dr [data-w121close]').click());
    await page.waitForTimeout(300);
    /* 7. the due post: mark as posted */
    await page.evaluate(() => { location.hash = '#contentcal/13'; });
    await page.waitForTimeout(1200);
    out.due_open = await page.evaluate(() => ({ title: (document.getElementById('w121title') || {}).value, pill: (document.querySelector('#w121dr header .pill') || {}).textContent }));
    await page.evaluate(() => document.querySelector('#w121dr [data-w121man="1"]').click());
    await page.waitForTimeout(300);
    await page.fill('#w121dr [data-w121manurl="facebook"]', 'https://www.facebook.com/welfareavenue/posts/123');
    await page.evaluate(() => document.querySelector('#w121dr [data-w121mandone]').click());
    await page.waitForTimeout(900);
    out.posted_write = (await writes('content_posts', 'update')).slice(-1).map(p => ({ status: p.status, results: p.results, published_at: !!p.published_at }));
    out.confirm_call = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'social-publish' && c.body.action === 'confirm').length);
    /* 8. settings */
    await page.evaluate(() => document.querySelector('#contentcal [data-w121set]').click());
    await page.waitForTimeout(700);
    out.settings_channels = await page.evaluate(() => Array.from(document.querySelectorAll('#w121chan option')).map(o => o.textContent));
    await page.evaluate(() => { document.getElementById('w121slack').checked = true; document.getElementById('w121chan').value = 'social-media'; document.querySelector('#contentcal [data-w121saveset]').click(); });
    await page.waitForTimeout(600);
    out.settings_call = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'social-publish' && c.body.action === 'settings').map(c => JSON.stringify(c.body.value)));
    /* 9. partly published: open and retry */
    await page.evaluate(() => { location.hash = '#contentcal/16'; });
    await page.waitForTimeout(1200);
    out.partial = await page.evaluate(() => ({ pill: (document.querySelector('#w121dr header .pill') || {}).textContent, res: (document.querySelector('#w121dr .res') || {}).textContent.replace(/\s+/g, ' ').trim().slice(0, 220), footer: Array.from(document.querySelectorAll('#w121dr footer button')).map(b => b.textContent) }));
    await page.evaluate(() => { const x = document.querySelector('#w121dr [data-w121close]'); if (x) x.click(); });
    await page.waitForTimeout(300);
  }
  /* 10. narrow */
  await page.setViewportSize({ width: 390, height: 860 });
  await go('#mypage', 600); await go('#contentcal', 1200);
  out.narrow_overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await shot('narrow', true);
  if (ROLE === 'staff') {
    await page.evaluate(() => { location.hash = '#contentcal/11'; });
    await page.waitForTimeout(900);
    out.narrow_drawer = await page.evaluate(() => { const p = document.querySelector('#w121dr .pn'); return p ? { w: p.getBoundingClientRect().width, vw: window.innerWidth } : null; });
    await shot('narrow_drawer', false);
  }
  out.errors = errs;
  fs.writeFileSync(path.join(shots, TAG + "_" + PUB + "_result.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error("DRIVE FAILED", e); process.exit(1); });
