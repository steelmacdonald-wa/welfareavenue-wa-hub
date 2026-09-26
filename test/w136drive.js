/* w136drive.js: content ideas from marketing meetings (wave136).
   The Content calendar shows where an idea came from, what it is for and what waits in the bank; an idea goes to the
   bank from its composer (bank_idea) with Undo (bank_undo); the bank page lists content ideas with Bring back now
   (bank_unbank 'idea'); the upload preview of a Marketing meeting lists its content ideas.
   usage: node test/w136drive.js */
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); } }

const DAY = n => { const d = new Date(Date.parse('2026-09-25T12:00:00-04:00') + n * 86400000); return d.toISOString().slice(0, 10); };
const IDEA = { id: 9001, title: 'Volunteer spotlight: Sunday cooks', platforms: ['instagram'], format: 'post', caption: null, notes: 'A 30 second reel on a Sunday cook.\n\nFrom the meeting "Marketing Meeting - August 12, 2026" (August 12), raised by Ian.', status: 'draft', scheduled_at: null, media: [], results: {}, live: {}, owner: null, campaign: 'Serving stories', source_transcript_id: 142, suggested_by: 'Ian', idea_for: DAY(45), banked_at: null, created_by: 'AI: Marketing Meeting - August 12, 2026' };
const BANKED = { id: 9002, title: 'Giving Tuesday donor series', platforms: ['instagram', 'facebook'], format: 'post', notes: 'Three posts thanking donors.', status: 'draft', scheduled_at: null, media: [], results: {}, live: {}, source_transcript_id: 142, suggested_by: null, idea_for: DAY(120), banked_at: '2026-09-25T10:00:00Z', bank_until: DAY(78), bank_note: 'For Giving Tuesday', banked_by: 'the meeting' };
const MOCK = `(function(){
  window.__WAFIX.content_posts = ${JSON.stringify([IDEA, BANKED])};
  var tx = window.__WAFIX.transcripts = window.__WAFIX.transcripts || [];
  if (!tx.some(function (t) { return t.id === 142; })) tx.push({ id: 142, title: 'Marketing Meeting - August 12, 2026', department: 'marketing', meeting_date: '2026-08-12', processed: true });
  window.__RPC = []; window.__FN = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.rpc || db.rpc.__w) return;
    var orig = db.rpc.bind(db), inv = db.functions.invoke.bind(db.functions);
    var f = function(fn, a){ a = a || {}; window.__RPC.push({ fn: fn, args: JSON.parse(JSON.stringify(a)) });
      if (fn === 'bank_idea') return Promise.resolve({ data: { until: a.p_until }, error: null });
      if (fn === 'bank_undo') return Promise.resolve({ data: { back: 1 }, error: null });
      if (fn === 'bank_unbank') return Promise.resolve({ data: { back: 1 }, error: null });
      if (fn === 'bank_list') return Promise.resolve({ data: { tasks: [], projects: [], ideas: [{ id: 9002, title: 'Giving Tuesday donor series', department: 'marketing', idea: 'Three posts thanking donors.', idea_for: '${DAY(120)}', suggested_by: null, campaign: 'Giving Tuesday', platforms: ['instagram','facebook'], source_transcript_id: 142, source: 'Marketing Meeting - August 12, 2026', source_date: '2026-08-12', bank_until: '${DAY(78)}', bank_note: 'For Giving Tuesday', banked_at: '2026-09-25T10:00:00Z', banked_by: 'the meeting' }], back: [], today: '2026-09-25', can_bank: true, leader: true }, error: null });
      return orig(fn, a); };
    f.__w = 1; db.rpc = f;
    db.functions.invoke = function (name, opts) { window.__FN.push({ name: name, body: opts && opts.body });
      if (name === 'transcript-preview') return Promise.resolve({ data: { ok: true, is_leadership: false, preview: { summary: 'A planning meeting.', new_updates: [], new_tasks: [], close_tasks: [], new_decisions: [], requests: [], goal_wins: [], mentions: [], content_ideas: [{ title: 'Volunteer spotlight reel', for_date: null }, { title: 'Ramadan iftar series', for_date: '2027-02-18' }] } }, error: null });
      return inv(name, opts); };
  }, 5); })();`;

(async () => {
  const browser = await launch();
  /* 1. the Content calendar */
  {
    const f = await fresh(browser, { who: 'admin', hash: '#contentcal', init: MOCK, wait: 4500 });
    const a = await f.ev(() => {
      const tray = document.querySelector('#contentcal .tray');
      const it = tray && tray.querySelector('[data-w121card="9001"]');
      const gl = Array.from(document.querySelectorAll('#contentcal .glance > div')).map(d => d.textContent.replace(/\s+/g, ' ').trim());
      const bnk = tray && tray.querySelector('a.bnk');
      return { tray: !!tray, hasIdea: !!it, line: it ? (it.querySelector('em') || {}).textContent : null, banked: !!(tray && tray.querySelector('[data-w121card="9002"]')),
        glance: gl.filter(x => /ideas without a date/.test(x))[0] || null, bnk: bnk ? bnk.textContent + ' ' + bnk.getAttribute('href') : null, note: tray ? tray.querySelector('p').textContent : '' };
    });
    ok('the tray shows the idea with where it came from and what it is for', a.hasIdea && /From Marketing Meeting - August 12, 2026/.test(a.line || '') && /^For /.test(a.line || ''), a);
    ok('an idea in the bank is not in the tray, and the tray says what waits in the bank', !a.banked && a.bnk === '1 idea waits in the bank #bank/marketing' && /Ideas from marketing meetings land here too/.test(a.note), a);
    ok('the week at a glance counts the one in the bank', /1 more in the bank/.test(a.glance || ''), a.glance);
    await f.ev(() => { document.querySelector('#contentcal .tray [data-w121card="9001"]').click(); });
    await f.page.waitForTimeout(500);
    const b = await f.ev(() => { const s = document.querySelector('#w121dr .w136src'); const l = s && s.querySelector('a[data-w136tx]'); const btn = document.querySelector('#w121dr footer [data-w136bank]'); return { src: s ? s.textContent.replace(/\s+/g, ' ').trim() : null, link: l ? l.getAttribute('href') : null, btn: !!btn }; });
    ok('the composer says where the idea came from, with Open the meeting', /From the meeting Marketing Meeting - August 12, 2026/.test(b.src || '') && /raised by Ian/.test(b.src || '') && b.link === '#tx/142', b);
    ok('an undated idea offers Put in the bank', b.btn, b);
    await f.ev(() => document.querySelector('#w121dr footer [data-w136bank]').click());
    await f.page.waitForTimeout(300);
    const c = await f.ev(() => { const p = document.querySelector('#w121dr .w136bank'); const u = document.getElementById('w136until'); const n = document.getElementById('w136note'); return { panel: !!p, until: u ? u.value : null, note: n ? n.value : null }; });
    ok('the bank panel opens six weeks before the date the idea is for, with the reason filled in', c.panel && c.until === DAY(3) && c.note === 'For Nov 9: Serving stories', c);
    await f.ev(() => { const u = document.getElementById('w136until'); u.value = '2026-12-01'; u.dispatchEvent(new Event('input', { bubbles: true })); const n = document.getElementById('w136note'); n.value = 'After the gala'; n.dispatchEvent(new Event('input', { bubbles: true })); });
    await f.ev(() => document.querySelector('#w121dr [data-w136bankgo]').click());
    await f.page.waitForTimeout(700);
    const d = await f.ev(() => ({ rpc: window.__RPC.filter(x => x.fn === 'bank_idea'), drawer: !!document.querySelector('#w121dr .pn'), inTray: !!document.querySelector('#contentcal .tray [data-w121card="9001"]'), undo: (document.querySelector('#contentcal .undo') || {}).textContent || '', bnk: (document.querySelector('#contentcal .tray a.bnk') || {}).textContent || '' }));
    ok('Put it in the bank calls bank_idea with the day and the reason, and the idea leaves the calendar', d.rpc.length === 1 && d.rpc[0].args.p_id === 9001 && d.rpc[0].args.p_until === '2026-12-01' && d.rpc[0].args.p_note === 'After the gala' && !d.drawer && !d.inTray, d);
    ok('an Undo follows, and the tray now counts two in the bank', /In the bank until Dec 1/.test(d.undo) && /2 ideas wait in the bank/.test(d.bnk), d);
    await f.ev(() => { const a = document.querySelector('#contentcal .undo a[data-w121undo]'); if (a) a.click(); });
    await f.page.waitForTimeout(600);
    const e = await f.ev(() => window.__RPC.filter(x => x.fn === 'bank_undo').map(x => x.args));
    ok('Undo calls bank_undo for the idea', e.length === 1 && e[0].p_kind === 'idea' && e[0].p_id === 9001, e);
    ok('the Content calendar has no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  /* 2. the bank page */
  {
    const BL = { tasks: [], projects: [], ideas: [{ id: 9002, title: 'Giving Tuesday donor series', department: 'marketing', idea: 'Three posts thanking donors.', idea_for: DAY(120), suggested_by: null, campaign: 'Giving Tuesday', platforms: ['instagram', 'facebook'], source_transcript_id: 142, source: 'Marketing Meeting - August 12, 2026', source_date: '2026-08-12', bank_until: DAY(78), bank_note: 'For Giving Tuesday', banked_at: '2026-09-25T10:00:00Z', banked_by: 'the meeting' }], back: [], today: '2026-09-25', can_bank: true, leader: true };
    const f = await fresh(browser, { who: 'admin', hash: '#bank', init: MOCK, wait: 4500, rpcs: { wa_org_editor: true, bank_list: BL } });
    const a = await f.ev(() => {
      const it = document.querySelector('#w132 [data-w132it="idea:9002"]');
      const st = (document.querySelector('#w132 .w132top .w132st.gold') || {}).textContent || '';
      return { it: !!it, kd: it ? (it.querySelector('.kd') || {}).textContent : null, meta: it ? (it.querySelector('.m') || {}).textContent : null, stat: st, how: (document.querySelector('#w132 details.w132how') || {}).textContent || '' };
    });
    ok('the bank page lists the content idea with its tag, what it is for and the meeting', a.it && a.kd === 'Content idea' && /content idea/.test(a.meta || '') && /from Marketing Meeting/.test(a.meta || ''), a);
    ok('the count says one content idea, and How the bank works explains ideas', /1 content idea/.test(a.stat) && /Content ideas wait here too/.test(a.how), a);
    await f.ev(() => { const b = document.querySelector('#w132 [data-w132back="idea:9002"]'); if (b) b.click(); });
    await f.page.waitForTimeout(700);
    const b = await f.ev(() => window.__RPC.filter(x => x.fn === 'bank_unbank').map(x => x.args));
    ok('Bring back now calls bank_unbank for the idea', b.length === 1 && b[0].p_kind === 'idea' && b[0].p_id === 9002, b);
    ok('the bank page has no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  /* 3. the upload preview of a Marketing meeting */
  {
    const f = await fresh(browser, { who: 'admin', hash: '#transcripts', init: MOCK, wait: 4000 });
    await f.ev(() => {
      const sel = document.getElementById('txDept'); if (sel) sel.value = 'marketing';
      const t = document.getElementById('txTitle'); if (t) t.value = 'Marketing Meeting - October 1';
      const b = document.getElementById('txBody'); if (b) b.value = 'Ian: we should do a volunteer spotlight reel. Joy: and a Ramadan iftar series in February. '.repeat(3);
      document.getElementById('txSave').click();
    });
    await f.page.waitForTimeout(900);
    const a = await f.ev(() => { const secs = Array.from(document.querySelectorAll('.w65sec h4')).map(h => h.textContent); const all = document.querySelector('.w65wrap'); return { secs, text: all ? all.textContent : '', fn: window.__FN.map(x => x.name) }; });
    ok('the preview lists the content ideas, and says the far one waits in the bank', a.secs.indexOf('Content ideas for the calendar (2)') >= 0 && /Ramadan iftar series.*for 2027-02-18, waits in the bank/.test(a.text), a);
    ok('the upload preview has no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  await browser.close();
  out.forEach(l => console.log(l));
  console.log('w136 ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
