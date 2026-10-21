/* sweep43.js <case> <width> [clicks]: the read-only browser test (#43). Boots the build on a snapshot of live data
   (scratchpad fixture_live.json) plus the synthetic analytics, walks every page it can reach (breadth first over
   every #hash link and data-*go door), and records per page: page errors, console errors, blank pages, sideways
   scroll and what causes it, interactive elements covered by something else, clipped text, small tap targets on a
   phone, duplicate ids and doors that go nowhere. With clicks=1 it also presses every button once and records the
   ones that throw or do nothing. Nothing leaves the sandbox: every network call is stubbed or blocked.
   Output: /tmp/s43/<case>_<width>.json and screenshots /tmp/s43/<case>_<width>/<n>.png */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , CASE = "admin", WIDTH = "1366", CLICKS = "0"] = process.argv;
const C = {
  admin: { email: "steel.macdonald@welfareavenue.com", name: "Steel MacDonald", role: "staff" },
  member: { email: "amanda.zoldak@welfareavenue.com", name: "Amanda Zoldak", role: "staff" },
  board: { email: "consult.tamaraangeline@gmail.com", name: "Tamara Angeline", role: "board" },
  fresh: { email: "steel.macdonald@welfareavenue.com", name: "Steel MacDonald", role: "staff", fresh: true }
}[CASE];
const OUT = "/tmp/s43"; const TAG = CASE + "_" + WIDTH + (CLICKS === "1" ? "_clicks" : ""); fs.mkdirSync(OUT + "/" + TAG, { recursive: true });
const html = fs.readFileSync(process.env.BUILD || path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
const gen = fs.readFileSync(path.join(__dirname, "w129data.js"), "utf8");
const fx = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/fixture_live.json", "utf8"));
const SEEDS = ['overview', 'dashboard', 'opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board', 'needsme', 'activity', 'transcripts', 'importantinfo', 'requests', 'agendas', 'mypage', 'orgchart', 'goals', 'projects', 'goalmap', 'orggoals', 'create', 'volunteering', 'finances', 'training', 'adminpanel', 'brain', 'hubmail', 'photos', 'hrcentre', 'socialstats', 'contentcal', 'calendar', 'fundevents', 'governance', 'committees',
  'team/marketing', 'team/fundraising', 'team/opsmtl', 'team/opsto', 'team/progdev', 'team/hr', 'team/marketing/agenda', 'team/marketing/tasks', 'team/fundraising/tasks', 'volunteering/people'].map(x => '#' + x);
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: Number(WIDTH) < 700 ? 844 : 900 }, acceptDownloads: true, isMobile: Number(WIDTH) < 700, hasTouch: Number(WIDTH) < 700 });
  const page = await ctx.newPage();
  let errs = [], cons = [];
  page.on("pageerror", e => errs.push(String(e).slice(0, 240)));
  page.on("console", m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) cons.push(m.text().slice(0, 240)); });
  page.on("dialog", d => d.dismiss().catch(() => {}));
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-09-25T16:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(C.role)}; window.__WA_TEST_EMAIL = ${JSON.stringify(C.email)}; window.__WA_TEST_NAME = ${JSON.stringify(C.name)}; window.confirm = function(){ return false; }; window.prompt = function(){ return null; }; window.alert = function(){}; window.__OPENS = []; window.open = function(u){ window.__OPENS.push(String(u)); return null; }; ${C.fresh ? '' : "try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); localStorage.setItem('wa112done', '1'); } catch (e) {}"} })();`);
  await page.addInitScript("window.__WAFIX = " + JSON.stringify(fx) + ";");
  await page.addInitScript(gen);
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("chart.umd") >= 0 || url.indexOf("chart.js") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "chart.umd.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  const t0 = Date.now();
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 25000 });
  await page.waitForTimeout(3500);
  const boot = Date.now() - t0;
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { const rpc0 = db.rpc.bind(db); db.rpc = function (fn, args) { if (fn === 'social_range') return Promise.resolve({ data: window.__SR(args), error: null }); return rpc0(fn, args); }; });
  /* first run: what pops up, and what it covers */
  const first = await ev(() => {
    const out = [];
    document.querySelectorAll('body *').forEach(el => { const st = getComputedStyle(el); if ((st.position === 'fixed' || st.position === 'absolute') && st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.1) { const r = el.getBoundingClientRect(); const t = (el.innerText || '').trim().replace(/\s+/g, ' '); if (r.width > 120 && r.height > 50 && r.top < innerHeight && r.bottom > 0 && t.length > 10 && t.length < 400 && !el.closest('#gate')) { const par = el.parentElement && getComputedStyle(el.parentElement).position === 'fixed'; if (!par) out.push({ id: el.id, cls: String(el.className).slice(0, 60), text: t.slice(0, 120), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }); } } });
    return out.slice(0, 12);
  });
  await page.screenshot({ path: OUT + "/" + CASE + "_" + WIDTH + "/00_first.png" });
  /* then clear them, the way a user would, so the sweep sees the pages */
  await ev(() => { document.querySelectorAll('body *').forEach(el => { const t = el.textContent || ''; const st = getComputedStyle(el); if ((st.position === 'fixed' || st.position === 'absolute') && (/STARTING A SESSION|Meet Ask the Hub/i.test(t)) && t.length < 400) el.remove(); }); });

  const AUDIT = () => {
    const vw = innerWidth, vh = innerHeight, phone = vw < 700;
    const panel = document.querySelector('.panel.active');
    const vis = el => { if (!el || !el.isConnected) return false; const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
    const name = el => { if (!el) return ''; let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40); return s + (t ? ' "' + t + '"' : ''); };
    const pathOf = el => { const p = []; let e = el; for (let i = 0; e && e !== document.body && i < 4; i++, e = e.parentElement) p.unshift(e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '')); return p.join(' > '); };
    const out = { hash: location.hash, id: panel && panel.id, text: panel ? (panel.innerText || '').trim().length : 0, title: panel ? ((panel.querySelector('h1,h2') || {}).innerText || '').trim().slice(0, 60) : '' };
    out.scrollW = document.documentElement.scrollWidth; out.hOver = out.scrollW > vw + 1;
    if (out.hOver) {
      const offs = [];
      document.querySelectorAll('body *').forEach(el => { if (!vis(el)) return; const r = el.getBoundingClientRect(); if (r.right > vw + 1 && r.width < vw * 3) { let p = el.parentElement, clipped = false; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') { clipped = true; break; } p = p.parentElement; } if (!clipped) offs.push({ el: pathOf(el) + ' ' + name(el).slice(0, 50), over: Math.round(r.right - vw) }); } });
      offs.sort((a, b) => b.over - a.over); out.hOffenders = offs.slice(0, 4);
    }
    const ids = {}; document.querySelectorAll('[id]').forEach(el => { ids[el.id] = (ids[el.id] || 0) + 1; }); out.dupIds = Object.keys(ids).filter(k => ids[k] > 1 && k).slice(0, 8);
    if (!panel) return out;
    const inter = Array.from(panel.querySelectorAll('button, a, input, select, textarea, [role=button], [tabindex]:not([tabindex="-1"])')).filter(vis);
    out.nInter = inter.length;
    /* small tap targets (phone) */
    if (phone) { const small = inter.filter(el => { const r = el.getBoundingClientRect(); return (r.height < 26 || r.width < 26) && !el.closest('p') && el.tagName !== 'INPUT'; }); out.smallTaps = small.length; out.smallEx = small.slice(0, 5).map(el => { const r = el.getBoundingClientRect(); return name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }); }
    /* clipped text: one-line boxes cut off without an ellipsis */
    const clip = []; panel.querySelectorAll('*').forEach(el => { if (clip.length > 6 || !vis(el) || el.children.length) return; const st = getComputedStyle(el); if (el.scrollWidth > el.clientWidth + 3 && (st.overflow === 'hidden' || st.overflowX === 'hidden') && st.textOverflow !== 'ellipsis' && (el.innerText || '').trim().length > 2) clip.push(pathOf(el) + ' "' + (el.innerText || '').trim().slice(0, 40) + '"'); });
    out.clipped = clip;
    /* things with a pointer cursor and no way in by keyboard */
    const ptr = []; panel.querySelectorAll('div, span, li, td, h3, h4, img, svg').forEach(el => { if (ptr.length > 200) return; if (!vis(el)) return; const st = getComputedStyle(el); if (st.cursor === 'pointer' && !el.closest('button, a, [role=button], [tabindex], label, summary') && !(el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer')) ptr.push(el); });
    out.ptrNoKey = ptr.length;
    return out;
  };
  /* covered: walk the page a screen at a time, and ask what is really under each control */
  const COVER = () => new Promise(async res => {
    const panel = document.querySelector('.panel.active'); if (!panel) return res([]);
    const vis = el => { const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4; };
    const name = el => { if (!el) return ''; let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30); return s + (t ? ' "' + t + '"' : ''); };
    const top = el => { let e = el, last = el; while (e && e !== document.body) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') last = e; e = e.parentElement; } return last; };
    const hits = {}; const H = document.documentElement.scrollHeight; const vh = innerHeight;
    for (let y = 0; y < H; y += Math.round(vh * 0.8)) {
      window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
      Array.from(panel.querySelectorAll('button, a, input, select, [role=button]')).forEach(el => {
        if (!vis(el)) return; const r = el.getBoundingClientRect(); if (r.top < 0 || r.bottom > vh || r.left < 0 || r.right > innerWidth) return;
        const x = r.left + r.width / 2, yy = r.top + r.height / 2; const hit = document.elementFromPoint(x, yy);
        if (!hit || el === hit || el.contains(hit) || hit.contains(el)) return;
        const lab = hit.closest('label'); if (lab && lab.contains(el)) return;
        const cov = top(hit); if (!cov || panel.contains(cov) && getComputedStyle(cov).position !== 'fixed' && getComputedStyle(cov).position !== 'sticky') { const k = 'in-page ' + name(hit); hits[k] = hits[k] || []; if (hits[k].length < 3) hits[k].push(name(el)); return; }
        const k = name(cov); hits[k] = hits[k] || []; if (hits[k].length < 4) hits[k].push(name(el));
      });
    }
    window.scrollTo(0, 0);
    res(Object.keys(hits).map(k => ({ by: k, els: hits[k] })));
  });
  const LINKS = () => { const out = new Set(); document.querySelectorAll('a[href^="#"], [href^="#"]').forEach(el => { const h = el.getAttribute('href'); if (h && h.length > 1) out.add(h); }); document.querySelectorAll('*').forEach(el => { for (const a of el.attributes) { if (/^data-[a-z0-9]*go$/.test(a.name) && /^#[a-z]/.test(a.value)) out.add(a.value); } }); return Array.from(out); };

  const seen = new Set(), queue = SEEDS.slice(), pages = [];
  let n = 0;
  const norm = h => decodeURIComponent(h).replace(/\/$/, '');
  const skip = h => /^#(logout|signout)/.test(h) || /\.(pdf|png|jpg)$/.test(h);
  while (queue.length && n < 140) {
    const h = queue.shift(); const k = norm(h); if (seen.has(k) || skip(h)) continue; seen.add(k); n++;
    errs = []; cons = [];
    const t1 = Date.now();
    await ev(x => { location.hash = x; window.scrollTo(0, 0); }, h);
    await page.waitForTimeout(1300);
    const a = await ev(AUDIT);
    a.ms = Date.now() - t1; a.n = n; a.asked = h;
    a.cover = await ev(COVER);
    await page.screenshot({ path: OUT + "/" + TAG + "/" + String(n).padStart(3, '0') + ".png" }).catch(() => {});
    if (Number(WIDTH) < 700) await page.screenshot({ path: OUT + "/" + TAG + "/" + String(n).padStart(3, '0') + "_full.png", fullPage: true }).catch(() => {});
    else await page.screenshot({ path: OUT + "/" + TAG + "/" + String(n).padStart(3, '0') + "_full.png", fullPage: true }).catch(() => {});
    const links = await ev(LINKS);
    links.forEach(l => { if (!seen.has(norm(l)) && queue.indexOf(l) < 0 && !/^#(adm|a)\//.test('') ) queue.push(l); });
    /* clicks: every button once */
    if (CLICKS === "1" && n <= 50) {
      const res = { tried: 0, threw: [], nothing: [], navigated: [], opened: [] };
      const count = await ev(() => { const p = document.querySelector('.panel.active'); if (!p) return 0; window.__CL = Array.from(p.querySelectorAll('button, [role=button], a:not([href^="http"]), [data-w116go], .chip, summary')).filter(el => { const st = getComputedStyle(el); const r = el.getBoundingClientRect(); return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 2 && r.height > 2 && !el.disabled && !/sign out|log out|classic look|switch to|new look/i.test(el.innerText || ''); }).slice(0, 45); return window.__CL.length; });
      for (let i = 0; i < count; i++) {
        const before = await ev(() => ({ h: location.hash }));
        errs = [];
        let r;
        try { r = await ev(async i => {
          const el = window.__CL[i]; if (!el || !el.isConnected) return { gone: true };
          const label = (el.innerText || el.getAttribute('aria-label') || el.title || el.className || '').toString().trim().replace(/\s+/g, ' ').slice(0, 50);
          let muts = 0; const mo = new MutationObserver(m => { muts += m.length; }); mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
          const o0 = window.__OPENS.length, f0 = document.activeElement;
          try { el.scrollIntoView({ block: 'center' }); el.click(); } catch (e) { mo.disconnect(); return { label, threw: String(e).slice(0, 160) }; }
          await new Promise(r => setTimeout(r, 450)); mo.disconnect();
          return { label, muts, opened: window.__OPENS.slice(o0), focus: document.activeElement !== f0 };
        }, i); } catch (e) {
          /* the click reloaded the page: note it, bring the app back and carry on */
          res.threw.push({ label: 'control #' + i, err: ['reloaded the page: ' + String(e).slice(0, 80)] });
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 25000 }).catch(() => {});
          await page.waitForTimeout(2500);
          await ev(() => { const rpc0 = db.rpc.bind(db); db.rpc = function (fn, args) { if (fn === 'social_range') return Promise.resolve({ data: window.__SR(args), error: null }); return rpc0(fn, args); }; }).catch(() => {});
          await ev(x => { location.hash = x; }, h).catch(() => {}); await page.waitForTimeout(1200);
          await ev(() => { const p = document.querySelector('.panel.active'); window.__CL = p ? Array.from(p.querySelectorAll('button, [role=button], a:not([href^="http"]), [data-w116go], .chip, summary')).filter(el => { const st = getComputedStyle(el); const r = el.getBoundingClientRect(); return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 2 && r.height > 2 && !el.disabled && !/sign out|log out|classic look|switch to|new look/i.test(el.innerText || ''); }).slice(0, 45) : []; }).catch(() => {});
          continue;
        }
        if (r.gone) continue; res.tried++;
        await page.waitForTimeout(80);
        const after = await ev(() => location.hash);
        if (errs.length) res.threw.push({ label: r.label, err: errs.slice(0, 2) });
        if (r.threw) res.threw.push({ label: r.label, err: [r.threw] });
        if (r.opened && r.opened.length) res.opened.push({ label: r.label, url: r.opened[0].slice(0, 120) });
        if (after !== before.h) { res.navigated.push({ label: r.label, to: after }); await ev(x => { location.hash = x; }, h); await page.waitForTimeout(900); await ev(() => { const p = document.querySelector('.panel.active'); window.__CL = p ? Array.from(p.querySelectorAll('button, [role=button], a:not([href^="http"]), [data-w116go], .chip, summary')).filter(el => { const st = getComputedStyle(el); const r = el.getBoundingClientRect(); return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 2 && r.height > 2 && !el.disabled && !/sign out|log out|classic look|switch to|new look/i.test(el.innerText || ''); }).slice(0, 45) : []; }); continue; }
        if (!r.muts && !(r.opened && r.opened.length) && !r.focus) res.nothing.push(r.label);
        /* close whatever opened */
        await page.keyboard.press('Escape').catch(() => {});
        await ev(() => { const mb = document.getElementById('modalBack'); if (mb && mb.style.display !== 'none') { const c = mb.querySelector('[data-close], .close, #ddCancel, button.ghost'); if (c) c.click(); } });
      }
      a.clicks = res;
      await ev(x => { location.hash = x; }, h); await page.waitForTimeout(400);
    }
    a.errs = errs.slice(0, 4); a.cons = cons.slice(0, 4);
    pages.push(a);
    process.stdout.write('.');
  }
  fs.writeFileSync(OUT + "/" + TAG + ".json", JSON.stringify({ case: CASE, width: WIDTH, boot, first, pages, leftover: queue.slice(0, 40) }, null, 1));
  console.log("\n" + CASE + " " + WIDTH + ": " + pages.length + " pages, boot " + boot + " ms");
  await browser.close();
})().catch(e => { console.error("SWEEP FAILED", e); process.exit(2); });
