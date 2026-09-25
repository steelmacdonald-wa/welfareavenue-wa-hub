/* wave116t drive: subtasks, descriptions, attachments, the tree view */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p116t");
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
      try { localStorage.setItem('wa84tour', '1'); } catch (e) {}
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
        if (name === 'hub-connect' && body.action === 'drive_meta') return { ok: true, id: 'x', name: 'Q2 July 22nd - Board Agenda', mime: 'application/vnd.google-apps.document', icon: null, url: body.url, size: null };
        if (name === 'ask' && body.execute) { window.__EXEC = body.execute; return { executed: { ok: true, detail: 'Added task #1 to Marketing: ' + (body.execute.input.title || '') } }; }
        return null;
      };
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.addInitScript(`(function(){ var T = window.__WAFIX.dept_tasks || []; var mk = T.filter(function (t) { return t.department === 'fundraising' && !t.done; }); if (mk.length > 1) { mk[1].parent_task_id = mk[0].id; mk[0].description = 'Print run for the open house.\\n\\n- 200 flyers\\n- **A5**, matte\\n- Link: https://example.com/brief'; } window.__WAFIX.task_files = [ { id: 1, task_id: mk[0] ? mk[0].id : 0, name: 'brief.pdf', path: '1/brief.pdf', mime: 'application/pdf', size: 12000, by: 'Steel MacDonald', created_at: new Date().toISOString() } ]; window.__T0 = mk[0] ? mk[0].id : null; window.__T1 = mk[1] ? mk[1].id : null; })();`);
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


  /* 1. team page, open a task */
  await go('#team/fundraising/tasks', 3000);
  out.board = await page.evaluate(() => ({ rows: document.querySelectorAll('.w116r[data-tid]').length, tree: !!document.querySelector('[data-w116tview]'), childRows: document.querySelectorAll('.w116r.w116tchild').length, subsTags: Array.from(document.querySelectorAll('.w116tag.subs')).map(x => x.textContent), subTags: Array.from(document.querySelectorAll('.w116tag.sub')).map(x => x.textContent).slice(0, 2) }));
  await page.evaluate(() => { window.w116Board.open(window.__T0); });
  await page.waitForTimeout(900);
  out.drawer = await page.evaluate(() => { const dr = document.getElementById('w116dr'); if (!dr) return { open: false, t0: window.__T0, boardApi: !!window.w116Board }; return { open: dr && dr.classList.contains('open'), crumb: (dr.querySelector('.w116tcrumb') || {}).textContent, sections: Array.from(dr.querySelectorAll('.w116drs')).map(x => x.textContent.trim()), previewHtml: (dr.querySelector('.w116tpv') || {}).innerHTML, subs: Array.from(dr.querySelectorAll('.w116tsub .s')).map(x => ({ t: x.querySelector('.t').textContent, done: x.classList.contains('done') })), files: Array.from(dr.querySelectorAll('.w116tfiles .f')).map(x => x.querySelector('.n').textContent), drop: !!dr.querySelector('.w116tfiles .drop') }; });
  await shot("1_drawer", false);
  /* edit the description in place: select a word, bold it, add a list line, autosave */
  await page.evaluate(() => { const ed = document.getElementById('w116ted'); ed.focus(); const sel = window.getSelection(); const r = document.createRange(); const tn = ed.querySelector('p').firstChild; r.setStart(tn, 0); r.setEnd(tn, 5); sel.removeAllRanges(); sel.addRange(r); });
  await page.click('#w116dr [data-w116tf="bold"]'); await page.waitForTimeout(150);
  await page.evaluate(() => { const ed = document.getElementById('w116ted'); const sel = window.getSelection(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); ed.focus(); });
  await page.keyboard.press('Enter'); await page.keyboard.type('- '); await page.keyboard.type('bring the banner'); await page.waitForTimeout(1500);
  out.edited = await page.evaluate(() => ({ html: document.getElementById('w116ted').innerHTML.slice(0, 260), saved: (function(){ const t = DB_TASKS.find(x => x.id === window.__T0); return t && t.description; })(), status: (document.getElementById('w116tdst') || {}).textContent, toolbarBold: !!document.querySelector('#w116dr [data-w116tf="bold"]') }));
  /* attach a Google Drive link */
  await page.fill('#w116tlink', 'https://docs.google.com/document/d/1AJOSwwl1WLJCa14vVs_qfdcJyXv3R4EjEXYiuzkUqcg/edit');
  await page.click('#w116dr [data-w116tlinkadd]'); await page.waitForTimeout(700);
  out.driveLink = await page.evaluate(() => ({ chips: Array.from(document.querySelectorAll('#w116dr .w116tfiles .f')).map(f => ({ name: f.querySelector('.n').textContent, link: f.classList.contains('lnk'), kind: (f.querySelector('.g') || {}).className })), calls: window.__CALLS.filter(c => c.name === 'hub-connect').map(c => c.body.action) }));
  /* add a subtask */
  await page.fill('#w116tsa', 'Order the paper'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  out.subAdded = await page.evaluate(() => ({ subs: Array.from(document.querySelectorAll('#w116dr .w116tsub .s .t')).map(x => x.textContent), inDb: DB_TASKS.filter(t => String(t.parent_task_id) === String(window.__T0)).map(t => t.title) }));
  await shot("2_drawer_edited", false);
  /* open the subtask: crumb shows the parent */
  const subLink = await page.$('#w116dr .w116tsub .s .t');
  if (subLink) { await subLink.click(); await page.waitForTimeout(700); out.subCrumb = await page.evaluate(() => (document.querySelector('#w116dr .w116tcrumb') || {}).textContent); }
  await page.evaluate(() => window.w116Board.closeDrawer()); await page.waitForTimeout(300);
  /* tree view */
  await page.click('[data-w116tview]'); await page.waitForTimeout(500);
  out.tree = await page.evaluate(() => { const t = document.querySelector('.w116tree'); if (!t) return { present: false }; return { present: true, team: (t.querySelector('.n.team .lb') || {}).textContent, projects: Array.from(t.querySelectorAll('.n.project .lb')).map(x => x.textContent).slice(0, 6), tasks: t.querySelectorAll('.n.task').length, nested: t.querySelectorAll('.ch .ch .n.task').length, listHidden: Array.from(document.querySelectorAll('.w116b > [data-w116thid]')).length > 0 }; });
  await shot("3_tree", true);
  const tg = await page.$('.w116tree .n.project [data-w116ttg]');
  if (tg) { await tg.click(); await page.waitForTimeout(200); out.collapsed = await page.evaluate(() => !!document.querySelector('.w116tree .ch.closed')); }
  await page.click('.w116tb .w116seg a[data-act="view"][data-v="list"]'); await page.waitForTimeout(500);
  out.backToList = await page.evaluate(() => ({ tree: !!document.querySelector('.w116tree'), rows: document.querySelectorAll('.w116r[data-tid]').length }));
  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
