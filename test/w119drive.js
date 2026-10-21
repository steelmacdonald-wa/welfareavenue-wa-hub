/* wave119 drive: the event command centre, the month grid, drag and drop, the bench; wave116w: Got it on a mention */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p119");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (/wave119|w119|wave116w|w116w/.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };
      try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
      window.__WRITES = [];
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  /* event 501 (the upcoming one in volunteer_event_summary) gets event 1's roster and steps */
  await page.addInitScript(`(function(){ var F = window.__WAFIX; (F.event_roster || []).forEach(function (r) { if (r.event_id === 1) r.event_id = 501; }); var n = 0; (F.sop_event_steps || []).forEach(function (s) { if (s.event_id === 1) { s.event_id = 501; n++; if (n <= 3) { s.done = true; } if (n === 4) { s.due_date = '2026-08-01'; s.owner = 'Ahmed'; } if (n === 5) { s.due_date = '2026-08-12'; } } }); (F.sop_event_extras || []).forEach(function (x) { if (x.event_id === 20) x.event_id = 501; }); })();`);
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) {
      const patched = stub + "\n;(function(){ try { var mk = window.supabase && window.supabase.createClient; if (!mk) return; window.supabase.createClient = function () { var c = mk.apply(this, arguments); var from = c.from.bind(c); c.from = function (t) { var b = from(t); var ins = b.insert.bind(b), upd = b.update.bind(b), del = b.delete.bind(b); b.insert = function (p) { window.__WRITES.push({ t: t, op: 'insert', p: p }); return ins(p); }; b.update = function (p) { window.__WRITES.push({ t: t, op: 'update', p: p }); return upd(p); }; b.delete = function () { window.__WRITES.push({ t: t, op: 'delete' }); return del(); }; return b; }; return c; }; } catch (e) {} })();";
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

  /* 1. Home: Got it on a mention (staff only sees them) */
  await go('#home', 2200);
  out.home_got_before = await q('[data-w65got]');
  if (out.home_got_before) {
    const first = await page.evaluate(() => { const a = document.querySelector('[data-w65got]'); return { id: a.getAttribute('data-w65got'), row: (a.closest('.w74men') || a.closest('.w65men') || a.parentNode).className }; });
    await page.evaluate(() => { document.querySelector('[data-w65got]').click(); });
    await page.waitForTimeout(700);
    out.home_got_after = await q('[data-w65got]');
    out.home_got_write = await page.evaluate(() => window.__WRITES.filter(w => w.t === 'mentions').map(w => w.op + ':' + JSON.stringify(w.p)));
    out.home_got_row_faded = await page.evaluate(() => { const rows = Array.from(document.querySelectorAll('.w74men.seen, .w65men.seen')); return rows.length; });
    out.home_got_first = first;
    await shot('home_gotit');
  }

  /* 2. Volunteering calendar: the month grid */
  await go('#volunteering', 2600);
  out.cal_grid = await q('#w119cal');
  out.cal_title = await txt('#w119cal .ch b');
  out.cal_days = await q('#w119cal .d');
  out.cal_events = await q('#w119cal .d .ev');
  out.cal_gaps = await q('#volunteering .vl-ev .w119gaps');
  out.cal_gap_text = await page.evaluate(() => Array.from(document.querySelectorAll('#volunteering .vl-ev .w119gaps')).map(e => e.textContent.trim()).slice(0, 3));
  await shot('calendar', true);
  if (!out.cal_grid) {
    out.vol_panel = await page.evaluate(() => { const v = document.getElementById('volunteering'); return v ? { display: getComputedStyle(v).display, cls: v.className, text: v.textContent.trim().slice(0, 200), active: document.querySelector('.panel.active') ? document.querySelector('.panel.active').id : null, hash: location.hash } : null; });
    out.errors = errs; fs.writeFileSync(path.join(shots, TAG + '_result.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); await browser.close(); return;
  }
  await page.evaluate(() => document.querySelector('#w119cal [data-w119cal="-1"]').click());
  await page.waitForTimeout(400);
  out.cal_prev_title = await txt('#w119cal .ch b');
  await page.evaluate(() => document.querySelector('#w119cal [data-w119cal="today"]').click());
  await page.waitForTimeout(400);
  out.cal_today_title = await txt('#w119cal .ch b');
  await page.evaluate(() => document.querySelector('#w119cal [data-w119cal="0"]').click());
  await page.waitForTimeout(400);
  out.cal_this_title = await txt('#w119cal .ch b');
  /* stable: no re-render loop */
  const k1 = await page.evaluate(() => { const c = document.getElementById('w119cal'); return c ? c.getAttribute('data-key') : null; });
  const same = await page.evaluate(() => { window.__calNode = document.getElementById('w119cal'); return true; });
  await page.waitForTimeout(1200);
  out.cal_stable = await page.evaluate(() => document.getElementById('w119cal') === window.__calNode);

  /* 3. The event page */
  await page.evaluate(() => { const ev = document.querySelector('#w119cal .ev[data-vlev="501"]'); if (ev) ev.click(); });
  await page.waitForTimeout(2600);
  out.ev_view = await page.evaluate(() => window.w119Debug ? window.w119Debug() : null);
  out.ev_mast = await q('#w119 .mast');
  out.ev_title = await txt('#w119 .mast h3');
  out.ev_cd = await txt('#w119 .mast .cd');
  out.ev_rings = await page.evaluate(() => Array.from(document.querySelectorAll('#w119 .ring')).map(r => r.querySelector('.v').textContent + ' ' + r.textContent.replace(r.querySelector('.v').textContent, '').trim()));
  out.ev_acts = await txt('#w119acts');
  out.ev_next = await page.evaluate(() => Array.from(document.querySelectorAll('#w119 .next .n')).map(n => n.querySelector('b').textContent + ' | ' + n.querySelector('span').textContent));
  out.ev_cols = await page.evaluate(() => Array.from(document.querySelectorAll('#w119 .board .rc')).map(c => c.getAttribute('data-w119role') + ':' + c.querySelectorAll('.pc').length + ':' + c.querySelector('.h .n').textContent));
  out.ev_cards = await q('#w119 .pc');
  out.ev_check_phases = await q('#w119check details.vl-phase');
  out.ev_rail = await page.evaluate(() => Array.from(document.querySelectorAll('#w119rail > *')).map(e => e.className + (e.id ? '#' + e.id : '')));
  out.ev_hidden_h3 = await q('#w119 h3.block.w119hide');
  out.ev_visible_old_roster = await page.evaluate(() => Array.from(document.querySelectorAll('#volunteering .vl-role')).filter(e => e.offsetParent !== null).length);
  out.ev_sum_in_rail = await q('#w119rail .w31sum');
  out.ev_cancel_in_acts = await q('#w119acts button');
  out.ev_top = await page.evaluate(() => { const t = document.querySelector('#w119 .top'); return t ? t.textContent.trim().slice(0, 80) : null; });
  await shot('event', true);

  if (ROLE === 'staff' || ROLE === 'admin') {
    /* 4. tick a "what's next" step */
    const nextBefore = out.ev_next.slice();
    const ringBefore = out.ev_rings[0];
    await page.evaluate(() => { const t = document.querySelector('#w119 [data-w119tick]'); if (t) t.click(); });
    await page.waitForTimeout(900);
    out.tick_write = await page.evaluate(() => window.__WRITES.filter(w => w.t === 'sop_event_steps').map(w => w.op + ':' + JSON.stringify(w.p)).slice(-1));
    out.tick_next_after = await page.evaluate(() => Array.from(document.querySelectorAll('#w119 .next .n')).map(n => n.querySelector('b').textContent));
    out.tick_ring_after = await txt('#w119 .ring .v');
    out.tick_state = await page.evaluate(() => ({ w119: !!document.getElementById('w119'), mast: !!document.querySelector('#w119 .mast'), rings: document.querySelectorAll('#w119 .ring').length, view: window.w119Debug ? window.w119Debug() : null, card: document.querySelector('#volunteering .card') ? document.querySelector('#volunteering .card').innerHTML.slice(0, 300) : null }));
    out.tick_changed = nextBefore[0] !== (out.tick_next_after[0] || '') + ' | ' && ringBefore !== out.tick_ring_after;

    /* 5. status on a card */
    const cardId = await page.evaluate(() => { const c = document.querySelector('#w119 .rc[data-w119role="server"] .pc'); return c ? c.getAttribute('data-w119card') : null; });
    out.card_id = cardId;
    if (!cardId) { out.errors = errs; fs.writeFileSync(path.join(shots, TAG + '_result.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); await browser.close(); return; }
    await page.selectOption('#w119 .pc[data-w119card="' + cardId + '"] select', 'Unavailable');
    await page.waitForTimeout(700);
    out.status_write = await page.evaluate(() => window.__WRITES.filter(w => w.t === 'event_roster').map(w => w.op + ':' + JSON.stringify(w.p)).slice(-1));
    out.status_class = await page.evaluate(id => { const c = document.querySelector('#w119 .pc[data-w119card="' + id + '"]'); return c ? c.className : null; }, cardId);
    out.status_header = await txt('#w119 .rc[data-w119role="server"] .h .n');

    /* 6. drag a server card onto the drivers column */
    const src = await page.locator('#w119 .pc[data-w119card="' + cardId + '"]').boundingBox();
    const dst = await page.locator('#w119 .rc[data-w119role="driver"]').boundingBox();
    await page.mouse.move(src.x + src.width / 2, src.y + 12);
    await page.mouse.down();
    await page.mouse.move(src.x + src.width / 2 + 10, src.y + 20, { steps: 5 });
    await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 20 });
    await page.waitForTimeout(200);
    await page.mouse.move(dst.x + dst.width / 2 + 2, dst.y + dst.height / 2 + 2, { steps: 3 });
    out.drag_over = await q('#w119 .rc.over');
    await page.mouse.up();
    await page.waitForTimeout(900);
    if (!(await page.evaluate(() => window.__WRITES.some(w => w.t === 'event_roster' && w.op === 'update' && w.p && w.p.role)))) {
      /* fall back to synthetic HTML5 drag events (Chromium supports constructing DataTransfer) */
      out.drag_mode = 'synthetic';
      await page.evaluate(id => {
        const card = document.querySelector('#w119 .pc[data-w119card="' + id + '"]');
        const col = document.querySelector('#w119 .rc[data-w119role="driver"]');
        const dt = new DataTransfer();
        card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
        col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
        col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        card.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
      }, cardId);
      await page.waitForTimeout(900);
    } else out.drag_mode = 'mouse';
    out.drag_write = await page.evaluate(() => window.__WRITES.filter(w => w.t === 'event_roster' && w.op === 'update' && w.p && w.p.role).map(w => JSON.stringify(w.p)).slice(-1));
    out.drag_now_in = await page.evaluate(id => { const c = document.querySelector('#w119 .pc[data-w119card="' + id + '"]'); return c ? c.closest('.rc').getAttribute('data-w119role') : null; }, cardId);
    out.drag_cols = await page.evaluate(() => Array.from(document.querySelectorAll('#w119 .board .rc')).map(c => c.getAttribute('data-w119role') + ':' + c.querySelectorAll('.pc').length));
    await shot('event_after_drag');

    /* 7. Add people (wave200: a window in place of the bench): add a cook */
    await page.evaluate(() => document.querySelector('#w119 [data-w119bench="cook"]').click());
    await page.waitForTimeout(1200);
    out.bench_open = await q('#w200add');
    out.bench_people = await q('#w200add .ar');
    out.bench_first = await page.evaluate(() => { const p = document.querySelector('#w200add .ar'); return p ? p.textContent.trim().slice(0, 60) : null; });
    await page.fill('#w119bq', 'ab');
    await page.waitForTimeout(400);
    out.bench_filtered = await q('#w200add .ar');
    out.bench_focus = await page.evaluate(() => document.activeElement && document.activeElement.id);
    await shot('event_bench');
    const addName = await page.evaluate(() => { const p = document.querySelector('#w200add .ar:not(.on) .who b'); return p ? p.textContent : null; });
    await page.evaluate(() => { const b = document.querySelector('#w200add .ar:not(.on) [data-w200add]'); if (b) b.click(); });
    await page.waitForTimeout(900);
    out.add_name = addName;
    out.add_write = await page.evaluate(() => window.__WRITES.filter(w => w.t === 'event_roster' && w.op === 'insert').map(w => JSON.stringify(w.p)).slice(-1));
    out.add_card = await page.evaluate(n => Array.from(document.querySelectorAll('#w119 .rc[data-w119role="cook"] .pc b')).some(b => b.textContent === n), addName);
    out.add_window_stays = await q('#w200add');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    out.add_bench_closed = await q('#w200add');
    out.add_cook_header = await txt('#w119 .rc[data-w119role="cook"] .h .n');
    out.add_mast_line = await txt('#w119acts');

    /* 7b. the Move menu on each card (wave200) */
    const mvId = await page.evaluate(() => { const c = document.querySelector('#w119 .rc[data-w119role="team_leader"] .pc'); return c ? c.getAttribute('data-w119card') : null; });
    out.mv_select = await q('#w119 select[data-w119mv="' + mvId + '"]');
    out.mv_options = await page.evaluate(id => Array.from(document.querySelectorAll('#w119 select[data-w119mv="' + id + '"] option')).map(o => o.value), mvId);
    await page.selectOption('#w119 select[data-w119mv="' + mvId + '"]', 'photographer');
    await page.waitForTimeout(800);
    out.mv_now_in = await page.evaluate(id => { const c = document.querySelector('#w119 .pc[data-w119card="' + id + '"]'); return c ? c.closest('.rc').getAttribute('data-w119role') : null; }, mvId);
    out.mv_write = await page.evaluate(() => window.__WRITES.filter(w => w.t === 'event_roster' && w.op === 'update' && w.p && w.p.role).map(w => JSON.stringify(w.p)).slice(-1));

    /* 8. remove a card */
    const before = await q('#w119 .pc');
    await page.evaluate(() => { const x = document.querySelector('#w119 .rc[data-w119role="dishwasher"] [data-w119rm]'); if (x) x.click(); });
    await page.waitForTimeout(800);
    out.rm_before = before; out.rm_after = await q('#w119 .pc');
    out.rm_write = await page.evaluate(() => window.__WRITES.filter(w => w.t === 'event_roster' && w.op === 'delete').length);
    await shot('event_final', true);

    /* 9. the old handlers still work: an owner input and a phase summary exist in the checklist */
    out.check_owner_inputs = await q('#w119check [data-vlowner], #w119check select[data-vlowner]');
    out.check_steps = await q('#w119check .vl-step');
  }

  /* 10. back to the calendar: nothing broken */
  await page.evaluate(() => { const b = document.querySelector('#volunteering .vl-back'); if (b) b.click(); });
  await page.waitForTimeout(1800);
  out.back_cal = await q('#w119cal');
  out.back_w119 = await q('#w119');

  /* 11. narrow viewport */
  await page.setViewportSize({ width: 420, height: 860 });
  await page.evaluate(() => { const ev = document.querySelector('#w119cal .ev[data-vlev="501"]'); if (ev) ev.click(); });
  await page.waitForTimeout(2200);
  out.narrow_overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await shot('event_narrow', true);

  out.errors = errs;
  fs.writeFileSync(path.join(shots, TAG + "_result.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error("DRIVE FAILED", e); process.exit(1); });
