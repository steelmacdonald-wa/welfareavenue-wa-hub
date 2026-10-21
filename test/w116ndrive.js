/* wave116n/o/q drive: AI models card, editable Ask the Hub proposals, check in/out with a summary */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p116n");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (/wave116|w116|team route/.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
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
      var ago = function (d) { return new RealDate(FIXED - d * 86400000).toISOString(); };
      window.__WA_FN = function (name, body) {
        window.__CALLS.push({ name: name, body: body });
        if (name === 'llm') {
          if (body.action === 'routes') return { ok: true, jev: '~typesafe/jev-latest', routes: [
            { task: 'brain', label: 'Ask the Hub (Brain)', chain: ['anthropic/claude-sonnet-5', 'moonshotai/kimi-k2.6', 'openai/gpt-5-mini'], jev: false, mode: 'jev', notes: 'Jev picks per question.' },
            { task: 'mail_triage', label: 'Email filing', chain: ['anthropic/claude-haiku-4.5', 'openai/gpt-5-mini', 'google/gemini-3.8-flash'], jev: true, mode: 'chain', notes: 'Classifier; Jev double-checks.' },
            { task: 'decide', label: 'Jev decisions', chain: ['~typesafe/jev-latest'], jev: true, mode: 'chain', notes: 'Decisions API.' },
            { task: 'default', label: 'Anything unlabelled', chain: ['anthropic/claude-sonnet-5', 'openai/gpt-5'], jev: false, mode: 'jev', notes: '' } ],
            usage7: [ { task: 'brain', calls: 42, ok_calls: 41, avg_ms: 1800, cost: 0.61, last_at: ago(0.1), last_model: 'anthropic/claude-sonnet-5' }, { task: 'mail_triage', calls: 120, ok_calls: 120, avg_ms: 700, cost: 0.09, last_at: ago(0.5), last_model: 'anthropic/claude-haiku-4.5' } ],
            usage30: [ { task: 'brain', calls: 160, ok_calls: 158, avg_ms: 1700, cost: 2.4 }, { task: 'mail_triage', calls: 500, ok_calls: 500, avg_ms: 700, cost: 0.4 } ],
            recent: [ { created_at: ago(0.01), task: 'brain', caller: 'ask', requested_model: 'openai/gpt-5-mini', model: 'openai/gpt-5-mini', ok: true, ms: 600, cost: 0.0002, via: 'jev' }, { created_at: ago(0.02), task: 'brain', caller: 'ask', requested_model: '~typesafe/jev-latest', model: 'typesafe/jev-1.13', ok: true, ms: 0, cost: 0.00001, via: 'jev', error: 'picked openai/gpt-5-mini' }, { created_at: ago(0.3), task: 'mail_triage', caller: 'mail-pull', requested_model: 'anthropic/claude-haiku-4.5', model: null, ok: false, ms: 900, cost: null, error: 'anthropic/claude-haiku-4.5: 529 overloaded' } ] };
          if (body.action === 'models') return { ok: true, models: [ { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', in_per_m: 2, out_per_m: 10 }, { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', in_per_m: 1, out_per_m: 5 }, { id: 'openai/gpt-5-mini', name: 'GPT-5 mini', in_per_m: 0.25, out_per_m: 2 }, { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', in_per_m: 0.6, out_per_m: 2.5 }, { id: 'qwen/qwen3.8-flash', name: 'Qwen 3.8 Flash', in_per_m: 0.05, out_per_m: 0.4 } ] };
          if (body.action === 'test') return { ok: true, task: body.task, model: body.task === 'decide' ? 'typesafe/jev-1.13' : 'anthropic/claude-sonnet-5', ms: 1234, cost: 0.00007, reply: 'OK' };
          if (body.action === 'set_route') { window.__ROUTE_SAVED = body; return { ok: true, route: { task: body.task, chain: body.chain, mode: body.mode } }; }
          if (body.task === 'brain_suggest') return { content: [ { type: 'tool_use', name: 'suggest_edits', input: { owner: 'Amanda Zoldak', why_owner: 'leads the flyer work', due_date: '2026-08-14', project_id: null, title: 'Print 200 flyers for the open house', tips: ['Say how many flyers and which printer.'] } } ], _wa: { model: 'anthropic/claude-haiku-4.5' } };
        }
        if (name === 'checkin-post') {
          if (body.action === 'in') return { ok: true, posted: true };
          if (body.action === 'summarise') return { ok: true, bullets: ['Finished the board deck and sent it to Tamara', 'Met Amanda about the flyers; she prints Friday'], suggest: [ { id: 501, title: 'Finish the Q2 board deck', why: 'finished the board deck' } ], open_tasks: [ { id: 502, title: 'Recover the impact report comments', owner: 'Steel' } ] };
          if (body.action === 'out') { window.__OUT = body; return { ok: true, posted: true, closed: body.close_task_ids.length ? ['Finish the Q2 board deck'] : [], minutes: 245 }; }
        }
        if (name === 'ask' && body.execute) { window.__EXEC = body.execute; return { executed: { ok: true, detail: 'Added task #1 to Marketing: ' + (body.execute.input.title || '') } }; }
        return null;
      };
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) {
      const patched = stub + "\n;(function(){ try { var mk = window.supabase && window.supabase.createClient; if (!mk) return; window.supabase.createClient = function () { var c = mk.apply(this, arguments); var orig = c.functions.invoke.bind(c.functions); c.functions.invoke = async function (name, opts) { var body = (opts && opts.body) || {}; var r = window.__WA_FN ? window.__WA_FN(name, body) : null; if (r) return { data: r, error: null }; return orig(name, opts); }; return c; }; } catch (e) {} })();";
      return route.fulfill({ contentType: "application/javascript", body: patched });
    }
    if (url.indexOf("fonts.g") >= 0 || url.indexOf("supabase.co/storage") >= 0) return route.continue();
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2600);
  const out = { identity: TAG };
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 900); };
  const shot = async (n, full) => page.screenshot({ path: path.join(shots, TAG + "_" + n + ".png"), fullPage: !!full });

  /* 1. AI models card */
  await go('#adminpanel', 2600);
  out.aiCard = await page.evaluate(() => { const c = document.getElementById('w116ncard'); if (!c) return { present: false }; return { present: true, tiles: Array.from(c.querySelectorAll('.tile')).map(t => t.textContent.trim().replace(/\s+/g, ' ')), rows: Array.from(c.querySelectorAll('.r')).map(r => ({ task: r.getAttribute('data-task'), chips: Array.from(r.querySelectorAll('.chip')).map(x => x.textContent.trim()), use: r.querySelector('.use').textContent.trim().replace(/\s+/g, ' ') })), beforePeople: (function () { const p = document.getElementById('w113card'); return !!(p && c.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING); })() }; });
  await shot("1_aicard", true);
  if (out.aiCard.present) {
    await page.click('#w116ncard [data-w116n="test"][data-task="brain"]'); await page.waitForTimeout(600);
    out.aiTest = await page.evaluate(() => (document.querySelector('#w116ncard .r[data-task="brain"] .tres') || {}).textContent);
    await page.click('#w116ncard [data-w116n="edit"][data-task="brain"]'); await page.waitForTimeout(800);
    out.aiEdit = await page.evaluate(() => ({ open: getComputedStyle(document.getElementById('modalBack')).display !== 'none', chain: Array.from(document.querySelectorAll('#w116nchain .c .m b')).map(x => x.textContent), options: (document.getElementById('w116nadd') || {}).options ? document.getElementById('w116nadd').options.length : 0, mode: (document.querySelector('input[name="w116nmode"]:checked') || {}).value }));
    await page.selectOption('#w116nadd', 'qwen/qwen3.8-flash'); await page.click('#w116naddb'); await page.waitForTimeout(200);
    await page.click('[data-w116nc="rm"][data-i="0"]'); await page.waitForTimeout(200);
    await page.click('#w116nsave'); await page.waitForTimeout(900);
    out.aiSaved = await page.evaluate(() => ({ saved: window.__ROUTE_SAVED, modalClosed: getComputedStyle(document.getElementById('modalBack')).display === 'none' }));
    await page.click('#w116ncard [data-w116n="recent"]'); await page.waitForTimeout(300);
    out.aiRecent = await page.evaluate(() => Array.from(document.querySelectorAll('#w116ncard table.rc tbody tr')).map(r => r.textContent.trim().replace(/\s+/g, ' ').slice(0, 90)));
    await shot("2_aiedit_recent", true);
  }

  /* 2. check in, then out with a note */
  await go('#mypage', 1200);
  out.ckBefore = await page.evaluate(() => ({ btn: (document.getElementById('w116jck') || {}).textContent, handle: !!window.w116jCk }));
  await page.evaluate(() => { window.__CALLS = []; });
  await page.click('#w116jck'); await page.waitForTimeout(1200);
  out.ckIn = await page.evaluate(() => ({ btn: (document.getElementById('w116jck') || {}).textContent.trim(), calls: window.__CALLS.map(c => c.name + ':' + c.body.action), toast: (document.getElementById('toast') || {}).textContent, open: !!(window.w116jCk && window.w116jCk.open()) }));
  await page.click('#w116jck'); await page.waitForTimeout(700);
  out.ckSheet = await page.evaluate(() => ({ open: getComputedStyle(document.getElementById('modalBack')).display !== 'none', title: (document.querySelector('#modalBox h3') || {}).textContent, mic: !!document.getElementById('w116qmic'), hint: (document.getElementById('w116qhint') || {}).textContent }));
  await shot("3_checkout_sheet");
  await page.fill('#w116qtext', 'finished the board deck and sent it to Tamara, met Amanda about the flyers she prints friday');
  await page.click('#w116qsum'); await page.waitForTimeout(900);
  out.ckReview = await page.evaluate(() => ({ title: (document.querySelector('#modalBox h3') || {}).textContent, bullets: Array.from(document.querySelectorAll('[data-w116qb]')).map(i => i.value), suggested: Array.from(document.querySelectorAll('.w116qm .tk label.sug')).map(l => ({ text: l.textContent.trim().replace(/\s+/g, ' '), checked: l.querySelector('input').checked })), more: !!document.getElementById('w116qmore') }));
  await shot("4_checkout_review");
  await page.click('#w116qadd'); await page.waitForTimeout(200);
  await page.evaluate(() => { const ins = document.querySelectorAll('[data-w116qb]'); ins[ins.length - 1].value = 'Closed out the Netlify billing'; });
  await page.click('#w116qgo'); await page.waitForTimeout(1200);
  out.ckOut = await page.evaluate(() => ({ sent: window.__OUT, modalClosed: getComputedStyle(document.getElementById('modalBack')).display === 'none', toast: (document.getElementById('toast') || {}).textContent, btn: (document.getElementById('w116jck') || {}).textContent.trim() }));

  /* 3. Ask the Hub: an editable proposal */
  await page.evaluate(() => { try { document.getElementById('waChatBtn').click(); } catch (e) {} });
  await page.waitForTimeout(500);
  await page.evaluate(() => { WA27_PROJECTS = [{ id: 7, name: 'Open house 2026', department: 'marketing', status: 'active' }, { id: 8, name: 'Website refresh', department: 'marketing', status: 'active' }]; WA27_LOADED = true; wa38Card({ name: 'create_task', summary: 'Add a task to Marketing: print flyers for the open house', input: { department: 'marketing', title: 'print flyers for the open house', detail: 'Steel asked in chat', owner: null, due_date: null } }); });
  await page.waitForTimeout(1200);
  out.proposal = await page.evaluate(() => { const c = document.querySelector('.wac-card'); if (!c) return { present: false }; return { present: true, fields: Array.from(c.querySelectorAll('[data-f]')).map(f => f.getAttribute('data-f') + '=' + (f.type === 'checkbox' ? f.checked : f.value)), ownerOptions: Array.from(c.querySelector('[data-f="owner"]').options).map(o => o.text).slice(0, 6), projectOptions: Array.from(c.querySelector('[data-f="project_id"]').options).map(o => o.text), chips: Array.from(c.querySelectorAll('.w116osug .chip')).map(x => ({ t: x.textContent.trim().replace(/\s+/g, ' '), f: x.getAttribute('data-w116oc'), ai: x.classList.contains('ai') })), tips: Array.from(c.querySelectorAll('.w116osug .tip')).map(x => x.textContent), go: (c.querySelector('.go') || {}).textContent }; });
  await shot("5_proposal");
  /* apply the model's owner chip and a project chip, then confirm */
  await page.evaluate(() => { const c = document.querySelector('.wac-card'); const ai = c.querySelector('.w116osug .chip.ai[data-w116oc="owner"]'); if (ai) ai.click(); const pr = c.querySelector('.w116osug .chip[data-w116oc="project_id"]'); if (pr) pr.click(); const t = c.querySelector('[data-f="title"]'); t.value = 'Print 200 flyers for the open house'; c.querySelector('[data-f="priority"]').checked = true; });
  await page.waitForTimeout(200);
  await page.click('.wac-card .go'); await page.waitForTimeout(1200);
  out.confirmed = await page.evaluate(() => ({ exec: window.__EXEC, result: (document.querySelector('.wac-card .res') || {}).textContent, summary: (document.querySelector('.wac-card b') || {}).textContent }));
  await shot("6_confirmed");
  /* a request proposal renders its own fields */
  await page.evaluate(() => { wa38Card({ name: 'create_request', summary: 'File a request to HR: recruit a weekend coordinator', input: { department: 'hr', type_key: 'hiring-request', title: 'Recruit a weekend volunteer coordinator', details: 'Saturdays in Montreal', assignee: null } }); });
  await page.waitForTimeout(600);
  out.request = await page.evaluate(() => { const cs = document.querySelectorAll('.wac-card'); const c = cs[cs.length - 1]; return { fields: Array.from(c.querySelectorAll('[data-f]')).map(f => f.getAttribute('data-f')), typeOptions: Array.from(c.querySelector('[data-f="type_key"]').options).map(o => o.value).slice(0, 8) }; });
  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
