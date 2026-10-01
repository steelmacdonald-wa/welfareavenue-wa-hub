/* w191drive.js: wave191, the Volunteer Manager's flow, offline against the candidate (CAND=build/<file>.html).
   The serving page in six stages (the header, the stage bar, Next up, the cards placed in their stage, the steps flat and
   grouped, the Hub-done steps, done steps folded, the legacy controls gone, the proxies), This week on the calendar
   (servings by stage, overdue, no owner, mine, a step that opens its serving), the SOP (legend, stage chips, Hub badges,
   proposals), the titles, a phone, a board viewer. */
const { launch, fresh } = require('./boot');
const fs = require('fs');
const fx = require('./w191fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const INSTALL = () => {
  window.__W191 = { rpc: [], up: [] };
  const f0 = db.from.bind(db);
  db.from = function (t) { const b = f0(t); const u = b.update.bind(b); b.update = function (p) { window.__W191.up.push({ t: t, p: p }); return u(p); }; return b; };
  const r0 = db.rpc.bind(db);
  db.rpc = function (fn, args) { window.__W191.rpc.push({ fn: fn, args: args }); return r0(fn, args); };
};
const UNCLOSED = [{ id: 901, code: 'WA-26-89', date: '2026-09-20', title: null }];
const WEEK = { today: '2026-09-25', me: 'Steel', servings: [{ id: 900, code: 'WA-26-90', date: '2026-10-02', title: 'Sunday serving', format: null, status: 'planned', stage: 'confirm', days: 7, on_list: 5, confirmed: 2, target: 22, steps_total: 63, steps_done: 6, overdue: 9, unassigned: 3, hub_waiting: 29, next: { step_id: 5001, name: 'Location Specific Requirements', owner: 'Ahmed', due: '2026-09-18', stage: 'plan' } }],
  overdue: [{ step_id: 5001, event_id: 900, code: 'WA-26-90', date: '2026-10-02', name: 'Location Specific Requirements', owner: 'Ahmed', due: '2026-09-18', stage: 'plan' }, { step_id: 5023, event_id: 900, code: 'WA-26-90', date: '2026-10-02', name: 'Briefing Call with Team Leader', owner: 'Eleftherios Katsipis', due: '2026-09-18', stage: 'confirm' }],
  unassigned: [{ step_id: 5047, event_id: 900, code: 'WA-26-90', date: '2026-10-02', name: 'Review & Distribution', due: '2026-09-29', stage: 'prepare' }], mine: [] };
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0, unticked: 0 }, wa191_this_week: WEEK, wa191_this_week_unclosed: UNCLOSED, wa191_settle: 'cancelled', wa191_sop_proposal: { ok: true, action: 'approve', kind: 'reword' } };
const text = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const vis = (f, sel) => f.ev(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; }, sel);

(async () => {
  const browser = await launch();
  try {
    /* ---------- the serving page ---------- */
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx(), rpcs: RPCS, width: 1440, wait: 5200 });
    await f.ev(INSTALL);
    const st = await f.ev(() => ({ w191: !!document.querySelector('#w119.w191'), head: !!document.getElementById('w191head'), h3: ((document.querySelector('#w191head h3') || {}).textContent || ''), bar: document.querySelectorAll('#w191head .w191bar .st').length, now: ((document.querySelector('#w191head .w191bar .st.now') || {}).textContent || ''), mastHidden: getComputedStyle(document.querySelector('#w119 > .mast')).display === 'none', nextOldHidden: getComputedStyle(document.querySelector('#w119 > .next')).display === 'none', topHidden: getComputedStyle(document.querySelector('#w119 > .top')).display === 'none', title: ((document.querySelector('#volunteering .w118mast h1') || {}).textContent || '') }));
    ok('serving: the flow header with the date and six stages', st.w191 && st.head && /October 2/.test(st.h3) && st.bar === 6, st);
    ok('serving: Confirm is the stage now (7 days out)', /Confirm/i.test(st.now) && /Now/.test(st.now), st.now);
    ok('serving: the old masthead, What’s next and the top line are retired', st.mastHidden && st.nextOldHidden && st.topHidden, st);
    ok('title: the page is called Serving inside the app', /^Serving$/.test(st.title.trim()), st.title);
    const nx = await text(f, '#w191next');
    ok('next up: the format, the roster, the confirmations and a step for a person', /Set the format/.test(nx) && /Fill the roster/.test(nx) && /3 still to confirm/.test(nx) && /Location Specific Requirements/.test(nx) && /Ahmed/.test(nx), nx.slice(0, 400));
    const placed = await f.ev(() => {
      const inStage = (sel, k) => { const e = document.querySelector(sel); return !!e && !!e.closest('.w191stage[data-stage="' + k + '"]'); };
      return { texts: inStage('#w171card', 'confirm'), itin: inStage('#w174card', 'prepare'), blk: inStage('#w182blk', 'prepare'), survey: inStage('#w174survey', 'wrap_up'), plan: inStage('.w31sum', 'plan'), board: !!document.querySelector('#w191team #w119 .board, #w191team .board'), extra: /Also for this serving/.test((document.getElementById('w191extra') || {}).textContent || ''), open: Array.from(document.querySelectorAll('.w191stage.open')).map(x => x.getAttribute('data-stage')) };
    });
    ok('stages: every card sits in its stage (texts, itinerary, survey, plan), the roster in The team, the extras below', placed.texts && placed.itin && placed.blk && placed.survey && placed.plan && placed.board && placed.extra, placed);
    ok('stages: only the current stage is open', placed.open.filter(k => k).length === 1 && placed.open.filter(k => k)[0] === 'confirm', placed.open);
    const team = await f.ev(() => { const t = document.getElementById('w191team'); return { open: !!t && t.classList.contains('open'), head: t ? t.querySelector(':scope > .h').textContent : '', pills: t ? t.querySelector('.w191own').textContent : '', partner: ((document.querySelector('#w119 [data-w119card="9007"] .flag') || {}).textContent || '') }; });
    ok('the team: its own open section with confirmed of listed, what it needs and the short roles', team.open && /The team/.test(team.head) && /3 confirmed of 6 on the list/.test(team.head) && /needs 18/.test(team.head) && /short/.test(team.head) && /Team leaders 1\/1/.test(team.pills) && !/Community talkers/.test(team.pills), team);
    ok('the team: a partner organization is labelled as one', /Partner organization/.test(team.partner), team.partner);
    const steps = await f.ev(() => {
      const row = id => document.querySelector('#w119 .vl-step[data-vlstep="' + id + '"]');
      const stageOf = id => { const r = row(id); return r ? (r.closest('.w191stage') || {}).getAttribute('data-stage') : null; };
      const r6 = row(5006);
      return { excel: stageOf(5006), excelHub: !!(r6 && r6.getAttribute('data-w191hub')), excelNote: r6 ? (r6.querySelector('.w191hubnote') || {}).textContent : '', excelFolded: !!(r6 && r6.closest('.w191donebox')), callCooks: stageOf(5007), ingredients: stageOf(5009), reimburse: stageOf(5057), parentHidden: !!(row(5002) && row(5002).getAttribute('data-w191parent')) && getComputedStyle(row(5002)).display === 'none', sec: document.querySelectorAll('#w119 .w191steps .vl-sec').length, grp: ((document.querySelector('.w191stage[data-stage="confirm"] .w191grp') || {}).textContent || ''), cm: ((document.querySelector('.vl-step[data-vlstep="5007"] .w191cm') || {}).textContent || ''), metaHidden: getComputedStyle(document.querySelector('.vl-step[data-vlstep="5007"] .vl-meta')).display === 'none', done: ((document.querySelector('.w191stage[data-stage="confirm"] .w191donebox > summary') || {}).textContent || '') };
    });
    ok('steps: each step sits in its stage (the Excel sheet in Confirm, the ingredients in Prepare, the reimbursement in Wrap up)', steps.excel === 'confirm' && steps.callCooks === 'confirm' && steps.ingredients === 'prepare' && steps.reimburse === 'wrap_up', steps);
    ok('steps: a Hub-done step says so and sits among the done', steps.excelHub && /Ticked by the Hub/.test(steps.excelNote) && steps.excelFolded && /3 done/.test(steps.done), steps);
    ok('steps: containers hidden, no phase sections, a kicker names the parent', steps.parentHidden && steps.sec === 0 && /Volunteer Cooks|FINDING/i.test(steps.grp), steps);
    ok('steps: the quiet line carries the owner and the due date, the controls wait for a tap', /Mary/.test(steps.cm) && /due/.test(steps.cm) && steps.metaHidden, steps);
    await f.page.click('.vl-step[data-vlstep="5007"] .w191cm'); await f.page.waitForTimeout(200);
    ok('steps: a tap opens the owner and due controls', await f.ev(() => getComputedStyle(document.querySelector('.vl-step[data-vlstep="5007"] .vl-meta')).display !== 'none'));
    const legacy = await f.ev(() => { const q = s => document.querySelector(s); const hid = e => !e || getComputedStyle(e).display === 'none' || !e.getBoundingClientRect().height; return { canva: hid(q('#w119 .w31sum input[placeholder*="Canva"]')), build: hid(q('#w119 .w31sum [data-w33it]')), quo: hid(q('#w119 .w31sum [data-w33qr]')), roleSel: hid(q('#w119 .w191steps .w59sel')) }; });
    ok('retired: the Canva link, Build the itinerary, Check Quo replies and the bulk role select are off the page', legacy.canva && legacy.build && legacy.quo && legacy.roleSel, legacy);
    /* a tick from Next up saves the step as a person's tick */
    await f.ev(() => { window.__W191.up = []; });
    const tickId = await f.ev(() => { const b = document.querySelector('#w191next [data-w191tick]'); return b ? b.getAttribute('data-w191tick') : null; });
    if (tickId) { await f.page.click('#w191next [data-w191tick]'); await f.page.waitForTimeout(900); }
    const tk = await f.ev(id => ({ up: window.__W191.up.filter(u => u.t === 'sop_event_steps'), checked: !!(document.querySelector('#w119 input[data-vlchk="' + id + '"]') || {}).checked }), tickId);
    ok('next up: ticking a step saves it as done by a person (done_source manual)', !!tickId && tk.checked && tk.up.length === 1 && tk.up[0].p.done === true && tk.up[0].p.done_source === 'manual', tk);
    /* the stage bar and the header */
    await f.page.click('#w191head .w191bar .st[data-w191stage="prepare"]'); await f.page.waitForTimeout(300);
    ok('stage bar: a stage opens from the bar', await f.ev(() => document.querySelector('.w191stage[data-stage="prepare"]').classList.contains('open')));
    await f.page.click('.w191stage[data-stage="prepare"] > .h'); await f.page.waitForTimeout(200);
    ok('stage: its header folds it again', await f.ev(() => !document.querySelector('.w191stage[data-stage="prepare"]').classList.contains('open')));
    await f.page.click('#w191head [data-w191go="menu"]'); await f.page.waitForTimeout(200);
    const menu = await text(f, '#w191head .menu');
    ok('header: More lists the roster, the texts, the itineraries, the format, the date, the recap, closing and cancelling', /Plan the roster/.test(menu) && /Text to confirm/.test(menu) && /Send itineraries/.test(menu) && /Set the format/.test(menu) && /Change the date/.test(menu) && /Recap/.test(menu) && /Close this serving/.test(menu) && /Cancel this serving/.test(menu), menu);
    await f.page.click('#w191head [data-w191go="fmt"]'); await f.page.waitForTimeout(500);
    const modal = await text(f, '#modalBox');
    ok('header: Set the format opens wave171\u2019s format window', /how the food is made/i.test(modal) && /home-cooked/i.test(modal), modal.slice(0, 200));
    await f.ev(() => { try { closeModal(); } catch (e) { /* fine */ } });
    await f.ev(() => { window.__W191.up = []; window.__W191.rpc = []; });
    await f.page.click('.w191stage[data-stage="wrap_up"] > .h'); await f.page.waitForTimeout(200);
    await f.page.click('.w191stage[data-stage="wrap_up"] [data-w191go="close"]'); await f.page.waitForTimeout(700);
    const cl = await f.ev(() => ({ rpc: window.__W191.rpc.filter(r => r.fn === 'wa191_settle'), head: (document.getElementById('w191head') || {}).textContent || '', wrap: (document.querySelector('.w191stage[data-stage="wrap_up"] .w191own') || {}).textContent || '' }));
    ok('wrap up: Close this serving settles it as completed (database) and the page says Done', cl.rpc.length === 1 && cl.rpc[0].args.p_status === 'completed' && /Done/.test(cl.head) && /Reopen/.test(cl.wrap), cl);
    ok('serving: no page errors', f.errs.length === 0, f.errs);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/w191_serving.png', fullPage: true });
    await f.close();

    /* ---------- the calendar: This week ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering', fixture: fx(), rpcs: RPCS, width: 1440, wait: 5000 });
    const wk = await f.ev(() => { const w = document.getElementById('w191week'); const card = document.querySelector('#volunteering .card'); const kids = Array.from(card.children).map(e => e.id || e.className.split(' ')[0]); return { has: !!w, text: w ? w.innerText : '', heroHidden: getComputedStyle(document.querySelector('#volunteering .vl-hero')).display === 'none', order: kids.indexOf('w191week') >= 0 && kids.indexOf('w191week') < kids.indexOf('w119cal'), add: kids.indexOf('w106add') === kids.indexOf('w191week') + 1, title: (document.querySelector('#volunteering .w118mast h1') || {}).textContent }; });
    ok('this week: the serving by stage with its next step, overdue, no owner, mine', wk.has && /CONFIRM|Confirm/.test(wk.text) && /2 confirmed of 5/.test(wk.text) && /Next for a person/.test(wk.text) && /Overdue/i.test(wk.text) && /Briefing Call/.test(wk.text) && /No owner yet/i.test(wk.text) && /Review & Distribution/.test(wk.text) && /Mine this week/i.test(wk.text), wk.text.slice(0, 500));
    ok('this week: it opens the calendar, the old hero gives way, Add an event follows it', wk.heroHidden && wk.order && wk.add, wk);
    ok('title: the calendar is called Servings', /^Servings$/.test((wk.title || '').trim()), wk.title);
    ok('this week: a past serving the Hub cannot settle asks Did it happen?', /Did it happen\?/i.test(wk.text) && /September 20/.test(wk.text) && /It happened/.test(wk.text) && /Cancelled/.test(wk.text), wk.text.slice(0, 300));
    await f.ev(INSTALL);
    await f.page.click('#w191week [data-w191settle="cancelled"]'); await f.page.waitForTimeout(700);
    const st2 = await f.ev(() => window.__W191.rpc.filter(r => r.fn === 'wa191_settle'));
    ok('this week: Cancelled settles it in the database', st2.length === 1 && st2[0].args.p_event === 901 && st2[0].args.p_status === 'cancelled', st2);
    await f.page.click('#w191week [data-w191step="5023"]'); await f.page.waitForTimeout(4500);
    const foc = await f.ev(() => ({ hash: location.hash, open: Array.from(document.querySelectorAll('.w191stage.open')).map(x => x.getAttribute('data-stage')), row: !!document.querySelector('#w119 .vl-step[data-vlstep="5023"]') }));
    ok('this week: an overdue step opens its serving on its stage', foc.hash === '#volunteering/e/900' && foc.row && foc.open.indexOf('confirm') >= 0, foc);
    ok('calendar: no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* ---------- the SOP ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/sop', fixture: fx(), rpcs: RPCS, width: 1440, wait: 5000 });
    await f.ev(INSTALL);
    const sop = await f.ev(() => { const lg = document.getElementById('w191legend'); const step = s => document.querySelector('#volunteering .vl-step[data-vlstep="tmpl-' + s + '"]'); const a = step('86e04vjam'), b = step('86e04w1m1'), c = step('86e04vjrb'); return { legend: lg ? lg.innerText : '', intro: (document.getElementById('w191sopintro') || {}).textContent || '', chipA: a ? (a.querySelector('.w191stg') || {}).textContent : null, hubA: !!(a && a.querySelector('.w191hub')), propB: b ? (b.querySelector('.w191prop') || {}).textContent : null, propC: c ? (c.querySelector('.w191prop') || {}).textContent : null, title: (document.querySelector('#volunteering .w118mast h1') || {}).textContent, clickup: /ClickUp import/.test(document.querySelector('#volunteering .card').innerText) }; });
    ok('sop: the six-stage legend and the intro', /1\. Plan/i.test(sop.legend) && /6\. Wrap up/i.test(sop.legend) && /by the Hub/.test(sop.legend) && /six stages/.test(sop.intro) && !sop.clickup, sop.legend.slice(0, 300));
    ok('sop: a step carries its stage chip and the Hub badge', /Confirm/i.test(sop.chipA || '') && sop.hubA, sop);
    ok('sop: the Hub’s proposals: new wording and a retirement, with approve and keep', /suggests new wording/i.test(sop.propB || '') && /phone number for every cook/.test(sop.propB || '') && /Use this wording/.test(sop.propB || '') && /retiring/i.test(sop.propC || '') && /Retire it/.test(sop.propC || ''), { b: (sop.propB || '').slice(0, 200), c: (sop.propC || '').slice(0, 200) });
    ok('title: The SOP', /^The SOP$/.test((sop.title || '').trim()), sop.title);
    await f.ev(() => { document.querySelectorAll('#volunteering details.vl-phase').forEach(d => { d.open = true; }); });
    await f.page.click('.vl-step[data-vlstep="tmpl-86e04w1m1"] [data-w191prop-act="approve"]'); await f.page.waitForTimeout(900);
    const ap = await f.ev(() => window.__W191.rpc.filter(r => r.fn === 'wa191_sop_proposal'));
    ok('sop: approving calls the database (approve, this step)', ap.length === 1 && ap[0].args.p_id === '86e04w1m1' && ap[0].args.p_action === 'approve', ap);
    ok('sop: no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* ---------- a phone ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx(), rpcs: RPCS, width: 390, wait: 5200 });
    const ph = await f.ev(() => ({ w191: !!document.querySelector('#w119.w191'), scroll: document.documentElement.scrollWidth <= window.innerWidth + 1, bar: getComputedStyle(document.querySelector('#w191head .w191bar')).overflowX, open: document.querySelectorAll('.w191stage.open[data-stage]').length, teamFolded: !document.getElementById('w191team').classList.contains('open'), intro: getComputedStyle(document.querySelector('#volunteering > .card > p.read')).display, height: document.documentElement.scrollHeight }));
    ok('phone: the flow page, no sideways scroll, the stage bar scrolls, one stage open, The team folded, the intro gone', ph.w191 && ph.scroll && ph.bar === 'auto' && ph.open === 1 && ph.teamFolded && ph.intro === 'none', ph);
    ok('phone: the serving page is under 5,000px with the current stage open (6,200 before)', ph.height < 5000, ph.height);
    ok('phone: no page errors', f.errs.length === 0, f.errs);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/w191_phone.png', fullPage: true });
    await f.close();

    /* ---------- a board viewer never sees the Volunteer Manager ---------- */
    f = await fresh(browser, { who: 'board', hash: '#volunteering/e/900', fixture: fx(), rpcs: { is_wa_staff: false, is_wa_admin: false, is_wa_leader: false }, width: 1366, wait: 3500 });
    ok('board viewer: no flow page', !(await f.ev(() => !!document.getElementById('w191head'))));
    await f.close();
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
