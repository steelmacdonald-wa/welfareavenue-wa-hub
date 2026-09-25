/* wave119b drive: the Volunteers cards, duplicates and merge, plan the roster (with Jev odds), the recap */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p119b");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (/wave119|w119/.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };
      try { localStorage.setItem('wa84tour', '1'); } catch (e) {}
      window.__CALLS = []; window.__WRITES = [];
      window.__WA_RPCS = {
        volunteer_history: [
          { person_id: 1, events: 6, confirmed: 5, unavailable: 1, waiting: 0, last_event: '2026-07-12', last_confirmed: '2026-07-12', roles: ['server'] },
          { person_id: 2, events: 4, confirmed: 1, unavailable: 3, waiting: 0, last_event: '2026-02-08', last_confirmed: '2026-01-11', roles: ['cook'] },
          { person_id: 3, events: 2, confirmed: 2, unavailable: 0, waiting: 0, last_event: '2026-06-28', last_confirmed: '2026-06-28', roles: ['photographer'] },
          { person_id: 5, events: 8, confirmed: 8, unavailable: 0, waiting: 0, last_event: '2026-07-26', last_confirmed: '2026-07-26', roles: ['team_leader', 'server'] },
          { person_id: 6, events: 1, confirmed: 0, unavailable: 0, waiting: 1, last_event: '2026-03-08', last_confirmed: null, roles: ['dishwasher'] }
        ],
        volunteer_merge: { ok: true, moved: 3, keep: 1 }
      };
      window.__WA_FN = function (name, body) {
        window.__CALLS.push({ name: name, body: body });
        if (name === 'llm') {
          if (body.questions) return { answers: { confirm: { choice: 'yes', probabilities: { yes: 0.71, no: 0.29 } } } };
          if (body.tools && body.tools[0] && body.tools[0].name === 'recap') return { content: [ { type: 'tool_use', name: 'recap', input: { text: '*Food distribution · 2026-09-15 · Berri-UQAM*\\n• 220 meals planned\\n• Servers: 9 confirmed\\n• 3 of 30 checklist steps done\\n• Thank you to everyone.' } } ] };
        }
        if (name === 'checkin-post') {
          if (body.action === 'channels') return { ok: true, channels: [ { id: 'C1', name: 'general', member: true }, { id: 'C2', name: 'operations-mtl', member: true }, { id: 'C3', name: 'photography', member: false } ] };
          if (body.action === 'say') return { ok: true, ts: '1.2', channel: 'C2' };
        }
        return null;
      };
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.addInitScript(`(function(){ var F = window.__WAFIX; (F.event_roster || []).forEach(function (r) { if (r.event_id === 1) r.event_id = 501; }); var n = 0; (F.sop_event_steps || []).forEach(function (s) { if (s.event_id === 1) { s.event_id = 501; n++; if (n <= 3) s.done = true; } }); var P = F.volunteer_people || []; if (P.length > 3) { P[1].phones = (P[0].phones || []).slice(); P[3].full_name = P[2].full_name; P[3].roles = ['photographer']; } if (P[4]) P[4].roles = ['team_leader']; if (P[5]) P[5].roles = ['dishwasher']; })();`);
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) {
      const patched = stub + "\n;(function(){ try { var mk = window.supabase && window.supabase.createClient; if (!mk) return; window.supabase.createClient = function () { var c = mk.apply(this, arguments); var orig = c.functions.invoke.bind(c.functions); c.functions.invoke = async function (name, opts) { var body = (opts && opts.body) || {}; var r = window.__WA_FN ? window.__WA_FN(name, body) : null; if (r) return { data: r, error: null }; return orig(name, opts); }; var rpc = c.rpc.bind(c); c.rpc = function (fn, args) { window.__CALLS.push({ name: 'rpc:' + fn, body: args }); return rpc(fn, args); }; var from = c.from.bind(c); c.from = function (t) { var b = from(t); var ins = b.insert.bind(b); b.insert = function (p) { window.__WRITES.push({ t: t, op: 'insert', p: p }); return ins(p); }; return b; }; return c; }; } catch (e) {} })();";
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

  /* 1. Volunteers page */
  await go('#volunteering/people', 2600);
  out.grid = await q('#w119b');
  if (!out.grid) { out.errors = errs; console.log(JSON.stringify(out, null, 2)); await browser.close(); return; }
  out.cards = await q('#w119b .pc');
  out.stats = await txt('#w119b .stats');
  out.first = await page.evaluate(() => { const c = document.querySelector('#w119b .pc'); return { name: c.querySelector('.nm b').textContent, badges: Array.from(c.querySelectorAll('.bd')).map(b => b.textContent), rl: c.querySelector('.rl').textContent, ct: Array.from(c.querySelectorAll('.ct a')).map(a => a.getAttribute('href').slice(0, 12)) }; });
  out.badge_counts = await page.evaluate(() => { const m = {}; document.querySelectorAll('#w119b .bd').forEach(b => { const k = b.className.replace('bd ', ''); m[k] = (m[k] || 0) + 1; }); return m; });
  out.dups = await q('#w119b .pc.dup');
  out.dup_chip = await txt('#w119b [data-w119bdup]');
  out.dup_text = await page.evaluate(() => { const d = document.querySelector('#w119b .dupbox'); return d ? d.textContent.replace(/\s+/g, ' ').trim().slice(0, 140) : null; });
  await shot('people', true);
  /* sort by name */
  await page.selectOption('#w119b [data-w119bsort]', 'name');
  await page.waitForTimeout(400);
  out.sorted_names = await page.evaluate(() => Array.from(document.querySelectorAll('#w119b .pc .nm b')).slice(0, 3).map(b => b.textContent));
  /* search */
  await page.fill('#w26q', 'abhi');
  await page.waitForTimeout(300);
  out.search_visible = await page.evaluate(() => Array.from(document.querySelectorAll('#w119b .pc')).filter(c => c.style.display !== 'none').length);
  await page.fill('#w26q', '');
  await page.waitForTimeout(300);
  /* role chip */
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll('#volunteering [data-vlrole]')).find(x => x.getAttribute('data-vlrole') === 'cook'); if (c) c.click(); });
  await page.waitForTimeout(600);
  out.chip_cards = await q('#w119b .pc');
  out.chip_on = await txt('#volunteering .fchip.on');
  await page.evaluate(() => { const c = document.querySelector('#volunteering [data-vlrole=""]'); if (c) c.click(); });
  await page.waitForTimeout(600);
  /* duplicates only + merge */
  out.dup_chip_present = await q('#w119b [data-w119bdup]');
  if (out.dup_chip_present) { await page.evaluate(() => document.querySelector('#w119b [data-w119bdup]').click()); await page.waitForTimeout(400); }
  out.dup_only_cards = await q('#w119b .pc');
  if (ROLE === 'staff') {
    out.merge_btns = await q('#w119b [data-w119bmerge]');
    await page.evaluate(() => { const b = document.querySelector('#w119b [data-w119bmerge]'); if (b) b.click(); });
    await page.waitForTimeout(900);
    out.merge_call = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'rpc:volunteer_merge').map(c => JSON.stringify(c.body)));
  }
  await shot('people_dups', true);

  /* 2. the event page: plan the roster and recap */
  await go('#volunteering/e/501', 3000);
  out.ev_buttons = await page.evaluate(() => Array.from(document.querySelectorAll('#w119acts button')).map(b => b.textContent.trim()));
  out.ev_try = await page.evaluate(() => { try { window.w119bDecorate(); return 'ok ' + document.querySelectorAll('[data-w119bplan]').length; } catch (e) { return 'ERR ' + e.message; } });
  out.ev_state = await page.evaluate(() => ({ w119: !!document.getElementById('w119'), acts: !!document.getElementById('w119acts'), dbg: window.w119Debug ? window.w119Debug() : null, dbg2: window.w119bDebug ? window.w119bDebug() : null }));
  if (ROLE === 'staff' && (await q('[data-w119bplan]'))) {
    await page.evaluate(() => document.querySelector('[data-w119bplan]').click());
    await page.waitForTimeout(1800);
    out.plan_roles = await page.evaluate(() => Array.from(document.querySelectorAll('#w119bplanbox h4')).map(h => h.textContent.replace(/\s+/g, ' ').trim()));
    out.plan_cands = await q('#w119bplanbox .cand');
    out.plan_checked = await q('#w119bplanbox [data-w119bpick]:checked');
    out.plan_first = await page.evaluate(() => { const c = document.querySelector('#w119bplanbox .cand'); return c ? c.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null; });
    out.jev_calls = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'llm' && c.body.questions).length);
    out.jev_shown = await q('#w119bplanbox .jev');
    await shot('plan');
    await page.evaluate(() => document.getElementById('w119bplango').click());
    await page.waitForTimeout(1200);
    out.plan_inserts = await page.evaluate(() => window.__WRITES.filter(w => w.t === 'event_roster').map(w => w.p.person_name + ':' + w.p.role + ':' + w.p.status));
    out.plan_modal_closed = await page.evaluate(() => { const m = document.getElementById('modalBack'); return !m || m.style.display === 'none'; });
    /* recap */
    await page.evaluate(() => document.querySelector('[data-w119brecap]').click());
    await page.waitForTimeout(1500);
    out.recap_text = await page.evaluate(() => (document.getElementById('w119brt') || {}).value);
    out.recap_channels = await page.evaluate(() => Array.from(document.querySelectorAll('#w119bch option')).map(o => o.textContent));
    out.recap_draft_call = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'llm' && c.body.tools).length);
    await shot('recap');
    await page.evaluate(() => document.getElementById('w119bpost').click());
    await page.waitForTimeout(800);
    out.recap_post = await page.evaluate(() => window.__CALLS.filter(c => c.name === 'checkin-post' && c.body.action === 'say').map(c => c.body.channel + ' | ' + c.body.text.slice(0, 40)));
    out.recap_closed = await page.evaluate(() => { const m = document.getElementById('modalBack'); return !m || m.style.display === 'none'; });
  }
  out.errors = errs;
  fs.writeFileSync(path.join(shots, TAG + "_result.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error("DRIVE FAILED", e); process.exit(1); });
