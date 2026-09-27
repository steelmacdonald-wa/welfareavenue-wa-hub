/* w149drive.js: wave149. The loading screen (milestones, shout-outs, lessons, learnings and fun facts in turn; the news
   banner moved to Home in wave151, see w151drive), its cache after sign-in, Admin > Loading screen, Meet attendance in the HR centre only, the hover
   numbers on the Analytics graphs, and the post photo fallback. usage: node test/w149drive.js */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
const NOW = Date.parse('2026-09-25T19:00:00Z');
const CACHE = { v: 2, at: NOW, week: '2026-09-21', day: '2026-09-25',
  lines: [
    { k: 'milestone', t: 'M1 One year ago this week, Team Welfare Avenue placed third at Rally Paper Montreal.' },
    { k: 'milestone', t: 'M2 In 2023, the Canada Revenue Agency registered Welfare Avenue as a charity.' },
    { k: 'lesson', t: 'L1 Confirm drivers by Wednesday, then call again the day before and the morning of.' },
    { k: 'lesson', t: 'L2 Give every volunteer a job and a briefing on arrival.' },
    { k: 'learning', t: 'E1 Volunteers asked to arrive 15 minutes early, so setup is done before the doors open.' },
    { k: 'learning', t: 'E2 Reels and video do about three times better than photos.' }],
  shouts: ['S1 Ian closed 52 tasks this week.', 'S2 Welcome Zachee, who joined Program Development.'],
  news: ['Next serving: Sunday 4 October in Montreal, 7 volunteers signed up', 'Welcome Zachee Leonel Ngue, who joined Program Development', 'Coming up: One Bag Challenge, on 1 November'] };
const LABEL = { M: 'Milestone', L: 'Lesson learned', E: 'Learning', S: 'Shout-out' };
const SESSION = { 'sb-zwnmulmnvopclzcvytce-auth-token': { access_token: 'x' } };
function veilInit(store, reduced, noSession) {
  store = Object.assign({}, noSession ? {} : SESSION, store);
  return `(function(){
    try { ${Object.keys(store).map(k => 'localStorage.setItem(' + JSON.stringify(k) + ', ' + JSON.stringify(JSON.stringify(store[k])) + ');').join(' ')} } catch (e) {}
    ${reduced ? "var _mm = window.matchMedia; window.matchMedia = function (q) { if (/prefers-reduced-motion/.test(q)) return { matches: true, media: q, addListener: function(){}, removeListener: function(){}, addEventListener: function(){}, removeEventListener: function(){} }; return _mm.call(window, q); };" : ''}
    window.__seen = []; window.__allowReady = false;
    var _rm = Element.prototype.remove; Element.prototype.remove = function () { if (this.id === 'wa110veil' && !window.__allowReady) return; return _rm.apply(this, arguments); };
    var _add = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function () { if (this === document.documentElement.classList && Array.prototype.indexOf.call(arguments, 'wa-ready') >= 0 && !window.__allowReady) { window.__blocked = (window.__blocked || 0) + 1; return; } return _add.apply(this, arguments); };
    document.addEventListener('DOMContentLoaded', function () {
      var ov = document.querySelector('#wa110veil .w117ov'), f = document.getElementById('w117fact');
      function rec() { if (!ov || !f) return; var cur = ov.textContent + '|' + f.textContent; if (window.__seen[window.__seen.length - 1] !== cur) window.__seen.push(cur); }
      rec(); if (f) new MutationObserver(rec).observe(f, { childList: true, characterData: true, subtree: true });
    });
  })();`;
}
const veil = f => f.ev(() => {
  const v = document.getElementById('wa110veil'), bar = v && v.querySelector('.w149news');
  return { seen: window.__seen.slice(), cls: v ? v.className : null, bar: bar ? { rm: bar.classList.contains('rm'), label: (bar.querySelector('.lb') || {}).textContent, items: [...bar.querySelectorAll('.it')].map(x => x.textContent), on: [...bar.querySelectorAll('.it.on')].map(x => x.textContent), go: !!bar.querySelector('.run.go'), dur: (bar.querySelector('.run') || { style: {} }).style.animationDuration } : null };
});
function kindOk(entry) { const [lab, text] = entry.split('|'); const m = /^([MLES])\d /.exec(text); if (m) return lab === LABEL[m[1]]; return lab === 'Did you know'; }

(async () => {
  const browser = await launch();
  let f, v;

  /* ---------- 1. the loading screen with this week's cache ---------- */
  const fxS = loadFixture();
  fxS.hub_shoutouts = [
    { id: 901, text: 'Ian closed 52 tasks this week, moving us forward on flyers.', active: true, kind: 'auto', expires_at: '2026-10-05T00:00:00Z', created_at: '2026-09-25T10:00:00Z' },
    { id: 902, text: 'Steel closed 30 tasks this week, including delegation decisions.', active: true, kind: 'auto', expires_at: '2026-10-05T00:00:00Z', created_at: '2026-09-25T09:00:00Z' },
    { id: 903, text: 'A staff-posted thank-you that stays in the HR centre.', active: true, kind: 'staff', expires_at: '2026-10-05T00:00:00Z', created_at: '2026-09-25T08:00:00Z' }];
  const RPC_REEL = { week: '2026-09-21', day: '2026-09-25', lines: [{ k: 'lesson', t: 'RPC lesson: bring racks for clothing and set a limit of two or three items each.' }, { k: 'milestone', t: 'RPC milestone: first Toronto serving in 2024.' }], news: [{ t: 'RPC news: Welcome to the new volunteers', link: null }] };
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fxS, init: veilInit({ wa149reel: CACHE }), rpcs: { wa_org_editor: true, hub_reel_current: RPC_REEL }, wait: 1200 });
  await f.page.waitForFunction(() => window.__seen.length >= 3, null, { timeout: 22000 }).catch(() => {});
  v = await veil(f);
  ok('the loading screen shows a labelled line from this week', v.seen.length >= 1 && v.seen.every(kindOk), v.seen);
  ok('the first three lines are three different kinds (one of each before any repeats)', v.seen.length >= 3 && new Set(v.seen.slice(0, 3).map(s => s.split('|')[0])).size === 3, v.seen);
  ok('the loading screen has no news banner (it moved to Home), even with news in an older cache', !v.bar && !/w149n/.test(v.cls || ''), [v.bar, v.cls]);
  await f.ev(() => { window.__allowReady = true; document.documentElement.classList.add('wa-ready'); setTimeout(function () { var v = document.getElementById('wa110veil'); if (v) v.remove(); }, 450); });
  await f.page.waitForTimeout(600);
  const gone = await f.ev(() => { const el = document.getElementById('wa110veil'); return el ? getComputedStyle(el).opacity : 'removed'; });
  ok('once the Hub is ready the loading screen fades', gone === 'removed' || Number(gone) < 0.5, gone);
  await f.page.waitForTimeout(5500);
  const cache = await f.ev(() => { try { return JSON.parse(localStorage.getItem('wa149reel')); } catch (e) { return null; } });
  ok('after sign-in the cache holds this week’s lines and no news any more', cache && cache.v === 3 && cache.lines.some(x => /^RPC lesson/.test(x.t)) && cache.news === undefined && cache.day === undefined && cache.at > NOW, cache);
  ok('the Hub\u2019s own shout-outs are cached, without one about delegation or one staff posted', cache && cache.shouts.some(t => /Ian closed 52/.test(t)) && !cache.shouts.some(t => /delegation|staff-posted/i.test(t)), cache && cache.shouts);
  await f.ev(() => window.w149.clear());
  const cleared = await f.ev(() => [localStorage.getItem('wa149reel'), localStorage.getItem('wa116s')]);
  ok('signing out clears the loading screen cache (both kinds)', cleared[0] === null && cleared[1] === null, cleared);
  ok('no page errors (loading screen)', f.errs.length === 0, f.errs);
  await f.close();

  /* reduced motion: the lines still rotate, and there is no banner */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', init: veilInit({ wa149reel: CACHE }, true), wait: 600 });
  v = await veil(f);
  ok('with reduced motion the loading screen shows its lines and no banner', !v.bar && v.seen.length >= 1 && v.seen.every(kindOk), v);
  await f.close();

  /* the older shout-out cache is no longer read (it was not filtered), and it is removed */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', init: veilInit({ wa116s: { at: NOW, lines: ['S1 A shout-out from the older cache.', 'S2 Another one.'] } }), wait: 600 });
  v = await veil(f);
  const old116 = await f.ev(() => localStorage.getItem('wa116s'));
  ok('the older cache is not shown and is removed', !v.bar && v.seen.length >= 1 && v.seen.every(s => s.split('|')[0] === 'Did you know') && old116 === null, [v, old116]);
  await f.close();

  /* no sign-in kept in this browser: fun facts only, whatever is cached */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', init: veilInit({ wa149reel: CACHE }, false, true), wait: 600 });
  v = await veil(f);
  ok('without a sign-in in this browser the cache is not shown', !v.bar && v.seen.length >= 1 && v.seen.every(s => s.split('|')[0] === 'Did you know'), v);
  await f.close();

  /* an older day in the cache does not matter any more: the week's lines show, and there is no banner */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', init: veilInit({ wa149reel: Object.assign({}, CACHE, { day: '2026-09-20' }) }), wait: 600 });
  v = await veil(f);
  ok('an older day in the cache: the week\u2019s lines show, no banner', !v.bar && v.seen.length >= 1 && v.seen.every(kindOk), v);
  await f.close();

  /* a cache older than two weeks is ignored: fun facts only */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', init: veilInit({ wa149reel: Object.assign({}, CACHE, { at: NOW - 20 * 86400000 }) }), wait: 600 });
  v = await veil(f);
  ok('a cache older than two weeks is not shown', !v.bar && v.seen.length >= 1 && v.seen.every(s => s.split('|')[0] === 'Did you know'), v);
  await f.close();

  /* ---------- 2. Admin > Loading screen ---------- */
  const ADMIN = { week: '2026-09-21', day: '2026-09-25', today: '2026-09-25', built_at: '2026-09-25T10:21:00Z', news_at: '2026-09-25T10:21:00Z',
    lines: [{ id: 11, kind: 'milestone', text: 'One year ago this week, Team Welfare Avenue placed third at Rally Paper Montreal.', source: 'wa_history', hidden: false }, { id: 12, kind: 'lesson', text: 'Confirm drivers by Wednesday.', source: 'wa_lessons', hidden: false }, { id: 13, kind: 'lesson', text: 'A lesson an admin took off.', source: 'wa_lessons', hidden: true, hidden_by: 'suhaib.abdillahi@welfareavenue.com' }, { id: 14, kind: 'learning', text: 'Reels and video do about three times better.', source: 'social_notes', hidden: false }],
    news: [{ id: 21, text: 'Next serving: Sunday 4 October in Montreal, 7 volunteers signed up', source: 'volunteer_events', hidden: false }],
    updates: [{ id: 31, text: 'Holiday drive sign-ups open on 1 November', link: '#fundevents', until: '2026-10-09', hidden: false, by: 'steel.macdonald@welfareavenue.com', at: '2026-09-25T12:00:00Z', live: true }] };
  const MOCK = `(function(){ window.__RPC = []; window.__INV = [];
    var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.rpc || db.__w149) return;
      var r0 = db.rpc.bind(db);
      db.rpc = function (fn, args) { if (/^hub_(reel_hide|news_add)$/.test(fn)) { window.__RPC.push([fn, args]); return Promise.resolve({ data: fn === 'hub_news_add' ? 99 : null, error: null }); } return r0(fn, args); };
      db.functions.invoke = function (name, opts) { window.__INV.push({ name: name, body: opts && opts.body }); return new Promise(function (res) { setTimeout(function () { res({ data: { ok: true, reel: { lines: 15 }, news: { news: 3 } }, error: null }); }, 300); }); };
      db.__w149 = 1; }, 5); })();`;
  f = await fresh(browser, { who: 'admin', hash: '#adminpanel/loading', init: MOCK, rpcs: { wa_org_editor: true, hub_reel_admin: ADMIN, hub_reel_current: { lines: [], news: [] } }, wait: 4500 });
  const adm = await f.ev(() => { const c = document.getElementById('w149card'); const nav = document.querySelector('#adminpanel nav.w118adm a[data-w118sec="loading"]');
    return c ? { shown: getComputedStyle(c).display !== 'none', nav: !!nav, navOn: nav && nav.classList.contains('on'), cols: [...c.querySelectorAll('.col h4')].map(h => h.textContent), off: [...c.querySelectorAll('.col li.off span')].map(s => s.textContent), news: [...c.querySelectorAll('.news li span')].map(s => s.textContent), mast: (document.querySelector('#adminpanel .w118mast') || {}).textContent || '', top: (c.querySelector('.top p') || {}).textContent || '' } : { nav: !!nav }; });
  ok('Admin has a Loading screen and news section with its card', adm.shown && adm.nav && adm.navOn && /Loading screen and news/.test(adm.mast) && /top of Home/.test(adm.top || ''), adm);
  ok('this week’s lines by kind, with what was taken off struck through', adm.cols && adm.cols.join('|') === 'Milestones 1|Lessons learned 1|Learnings 1' && adm.off.length === 1 && /taken off by suhaib/.test(adm.off[0]), adm);
  ok('the news banner lists the live update first, then the day’s news', adm.news && /^Holiday drive sign-ups/.test(adm.news[0]) && /^Next serving/.test(adm.news[1] || ''), adm.news);
  await f.ev(() => document.querySelector('#w149card .col li:not(.off) [data-w149hide]').click());
  await f.page.waitForTimeout(500);
  await f.ev(() => document.querySelector('#w149card li.off [data-w149hide]').click());
  await f.page.waitForTimeout(500);
  let rpc = await f.ev(() => window.__RPC);
  ok('Take off and Put back ask the database, with the line’s id', rpc.length === 2 && rpc[0][0] === 'hub_reel_hide' && rpc[0][1].p_id === 11 && rpc[0][1].p_hidden === true && rpc[1][1].p_id === 13 && rpc[1][1].p_hidden === false, rpc);
  await f.page.fill('#w149t', 'Holiday drive sign-ups open on 1 November');
  await f.page.fill('#w149l', '#fundevents');
  await f.ev(() => document.querySelector('#w149card [data-w149add]').click());
  await f.page.waitForTimeout(600);
  rpc = await f.ev(() => window.__RPC);
  const addCall = rpc.filter(x => x[0] === 'hub_news_add')[0];
  ok('Add puts an update on the news banner', addCall && addCall[1].p_text === 'Holiday drive sign-ups open on 1 November' && addCall[1].p_link === '#fundevents' && addCall[1].p_until === null, rpc);
  await f.ev(() => document.querySelector('#w149card [data-w149rebuild]').click());
  await f.page.waitForTimeout(150);
  const busy = await f.ev(() => { const b = document.querySelector('#w149card [data-w149rebuild]'); return b ? { d: b.disabled, t: b.textContent } : null; });
  await f.page.waitForTimeout(700);
  const inv = await f.ev(() => window.__INV.filter(x => x.name === 'hub-reel'));
  ok('Rebuild now rebuilds the week and the news', busy && busy.d && /Rebuilding/.test(busy.t) && inv.length === 1 && inv[0].body.action === 'build' && inv[0].body.force === true, [busy, inv]);
  const tour = await f.ev(() => { const s = (window.w122 && w122.tours && w122.tours.adminpanel && w122.tours.adminpanel.steps) || []; const st = s.filter(x => x.s === '#w149card')[0]; const nav = s.filter(x => x.s === '#adminpanel nav.w118adm')[0]; return { has: !!st, hash: st && st.hash, nav: nav && nav.p }; });
  ok('the Admin tour has a stop for the loading screen and news', tour.has && tour.hash === '#adminpanel/loading', tour);
  await f.hash('#adminpanel/security', 900);
  const hid = await f.ev(() => { const c = document.getElementById('w149card'); return c ? getComputedStyle(c).display : 'none'; });
  ok('the card is hidden on the other Admin sections', hid === 'none', hid);
  ok('no page errors (Admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- 3. Meet attendance: the HR centre only ---------- */
  const MEET = JSON.parse(fs.readFileSync(SP + 'meet_fixture.json', 'utf8'))[0];
  const fxM = loadFixture(); fxM.meet_meetings = MEET.meetings.slice(); fxM.meet_attendance = MEET.attendance.slice();
  fxM.meet_sync_state = [{ id: 1, last_run_at: '2026-09-25T18:47:00Z', last_ok: true, note: 'synced', days: 8, meetings_n: fxM.meet_meetings.length, rows_n: fxM.meet_attendance.length }];
  f = await fresh(browser, { who: 'admin', hash: '#team/marketing', fixture: fxM, wait: 4500 });
  const onTeam = await f.ev(() => ({ card: !!document.getElementById('w144team'), meet: !!document.getElementById('w116meet') }));
  ok('a team page no longer shows Meeting attendance (even to an admin)', !onTeam.card, onTeam);
  await f.hash('#governance', 2200);
  const onBoard = await f.ev(() => ({ gov: !!document.getElementById('w126gov'), att: document.querySelectorAll('#w126gov .w144att, #w126gov .w144b').length }));
  ok('the Board overview no longer shows attendance', onBoard.att === 0, onBoard);
  await f.hash('#hrcentre', 2500);
  let hr = await f.ev(() => { const el = document.getElementById('w144hr'); return el ? { rows: el.querySelectorAll('[data-w144team]').length, board: /Board meetings/.test(el.textContent), det: !!el.querySelector('.w144teamdet'), go: el.querySelectorAll('[data-w144go^="#team/"]').length } : null; });
  ok('the HR centre card is there for an admin, with the board meetings', hr && hr.rows >= 5 && hr.board && !hr.det && hr.go === 0, hr);
  await f.ev(() => { const a = [...document.querySelectorAll('#w144hr [data-w144team]')].filter(x => x.closest('tr') && !/No team meeting/.test(x.closest('tr').textContent))[0]; a.click(); });
  await f.page.waitForTimeout(500);
  hr = await f.ev(() => { const el = document.getElementById('w144hr'), d = el.querySelector('.w144teamdet'); return d ? { strip: d.querySelectorAll('.w144strip .col').length, head: (d.querySelector('.w144sub') || {}).textContent, on: !!el.querySelector('tr.on'), who: d.querySelectorAll('.w144ppl .r').length } : null; });
  ok('clicking a team shows its last eight meetings and who came, in the HR centre', hr && hr.strip >= 1 && hr.on && /the last eight meetings/.test(hr.head || '') && hr.who > 0, hr);
  await f.ev(() => { const b = document.querySelector('#w144hr .w144teamdet .w144strip .col:not(.on)'); if (b) b.click(); });
  await f.page.waitForTimeout(400);
  const stillOpen = await f.ev(() => !!document.querySelector('#w144hr .w144teamdet'));
  ok('picking another meeting keeps the team open in the HR centre', stillOpen, stillOpen);
  await f.ev(() => document.querySelector('#w144hr .w144teamdet [data-w144team]').click());
  await f.page.waitForTimeout(400);
  hr = await f.ev(() => !!document.querySelector('#w144hr .w144teamdet'));
  ok('Close folds the team away', hr === false, hr);
  const tours = await f.ev(() => { const T = window.w122 && w122.tours || {}; const tm = (T.team && T.team.steps || []).map(s => s.s); const h = (T.hrcentre && T.hrcentre.steps || []).filter(s => s.s === '#w144hr')[0]; return { team: tm.indexOf('#w144team') >= 0, hr: h && h.p }; });
  ok('the team tour has no attendance stop; the HR centre stop mentions the board meetings', !tours.team && /board meetings/.test(tours.hr || ''), tours);
  ok('no page errors (attendance)', f.errs.length === 0, f.errs);
  await f.close();
  f = await fresh(browser, { who: 'member', hash: '#hrcentre', fixture: fxM, rpcs: { wa_org_editor: false }, wait: 4500 });
  const mem = await f.ev(() => ({ hr: !!document.getElementById('hrcentre'), card: !!document.getElementById('w144hr') }));
  ok('HR staff who are not admins or executives do not see the attendance card', !mem.card, mem);
  await f.close();

  /* ---------- 4. the Analytics graphs: hover for the numbers; the post photos ---------- */
  const SR = fs.readFileSync(path.join(__dirname, 'w129data.js'), 'utf8');
  const SRMOCK = SR + `\n(function(){ var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.rpc || db.__sr149) return;
      var r0 = db.rpc.bind(db);
      db.rpc = function (fn, args) { if (fn === 'social_range') { var d = window.__SR(args); (d.posts || []).slice(0, 3).forEach(function (p) { p.thumb_url = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/social/instagram/' + p.external_id + '.jpg'; }); return Promise.resolve({ data: d, error: null }); } return r0(fn, args); };
      db.__sr149 = 1; }, 5); })();`;
  f = await fresh(browser, { who: 'admin', hash: '#socialstats', init: SRMOCK, wait: 3000 });
  await f.ev(() => window.w120 && w120.reload());
  await f.page.waitForFunction(() => !!document.querySelector('#socialstats svg[data-w149h="main"]'), null, { timeout: 12000 }).catch(() => {});
  await f.page.waitForTimeout(600);
  const box = await f.ev(() => { const s = document.querySelector('#socialstats svg[data-w149h="main"]'); if (!s) return null; s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  ok('the main graph is a hover target', !!box && box.w > 100, box);
  const tipNow = () => f.ev(() => { const t = document.getElementById('w149tip'), g = document.getElementById('w149guide'); return t && t.style.display === 'block' ? { head: (t.querySelector('b') || {}).textContent, rows: [...t.querySelectorAll('.r')].map(r => r.textContent), guide: g && g.style.display === 'block', dots: [...document.querySelectorAll('.w149dot')].filter(d => d.style.display === 'block').length } : null; });
  if (box) {
    await f.page.mouse.move(box.x + box.w * 0.6, box.y + box.h / 2);
    await f.page.waitForTimeout(150);
    const t1 = await tipNow();
    ok('hovering the graph shows the date, each platform’s number and the total', t1 && t1.head && t1.rows.length >= 3 && t1.rows.some(r => /^All platforms/.test(r)) && t1.rows.some(r => /Instagram/.test(r)) && t1.guide && t1.dots >= 2, t1);
    await f.page.mouse.move(box.x + box.w * 0.15, box.y + box.h / 2);
    await f.page.waitForTimeout(150);
    const t2 = await tipNow();
    ok('moving across changes the day', t2 && t1 && t2.head !== t1.head, [t1 && t1.head, t2 && t2.head]);
    await f.page.mouse.move(box.x + box.w / 2, Math.max(2, box.y - 120));
    await f.page.waitForTimeout(150);
    ok('moving off the graph hides the numbers', (await tipNow()) === null);
    await f.ev(() => document.querySelector('#socialstats svg[data-w149h="main"]').focus());
    await f.page.waitForTimeout(120);
    const k1 = await tipNow();
    await f.page.keyboard.press('ArrowLeft'); await f.page.waitForTimeout(120);
    const k2 = await tipNow();
    ok('with the keyboard: focus shows the latest numbers and the arrows move', k1 && k2 && k1.head !== k2.head, [k1 && k1.head, k2 && k2.head]);
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(100);
    ok('Escape hides them', (await tipNow()) === null);
  }
  const sp = await f.ev(() => { const s = document.querySelector('#socialstats svg.sp[data-w149h^="tile:"]'); if (!s) return null; s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, k: s.getAttribute('data-w149h') }; });
  if (sp) { await f.page.mouse.move(sp.x + sp.w * 0.5, sp.y + sp.h / 2); await f.page.waitForTimeout(150); }
  const t3 = await tipNow();
  ok('a platform tile’s line shows its number on hover', sp && t3 && t3.rows.length === 1 && /\d/.test(t3.rows[0]), [sp, t3]);
  const bar = await f.ev(() => { const b = document.querySelector('#socialstats [data-w149tip]'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: b.getAttribute('data-w149tip') }; });
  if (bar) { await f.page.mouse.move(bar.x, bar.y); await f.page.waitForTimeout(150); }
  const t4 = await f.ev(() => { const t = document.getElementById('w149tip'); return t && t.style.display === 'block' ? t.textContent : null; });
  ok('a bar shows what it stands for on hover', bar && t4 === bar.t && /\d/.test(t4), [bar, t4]);
  await f.ev(() => { const p = document.querySelector('#socialstats .posts'); if (p) p.scrollIntoView({ block: 'center' }); document.querySelectorAll('#socialstats .post .th img').forEach(function (i) { i.loading = 'eager'; }); });
  await f.page.waitForTimeout(1200);
  const photos = await f.ev(() => ({ broken: [...document.querySelectorAll('#socialstats .post .th img')].filter(i => /content-images\/social\//.test(i.src)).length, loaded: [...document.querySelectorAll('#socialstats .post .th img')].filter(i => i.complete && i.naturalWidth > 0).length, big: [...document.querySelectorAll('#socialstats .post .th .big')].map(x => x.textContent) }));
  ok('a post photo that cannot load shows the platform mark instead of a broken image; photos that load stay', photos.broken === 0 && photos.big.length >= 3 && photos.big.every(x => x.length > 0) && photos.loaded >= 1, photos);
  ok('no page errors (Analytics)', f.errs.length === 0, f.errs);
  await f.close();

  /* on a phone: a tap on the graph shows the numbers */
  f = await fresh(browser, { who: 'admin', hash: '#socialstats', init: SRMOCK, width: 390, wait: 3000 });
  await f.ev(() => window.w120 && w120.reload());
  await f.page.waitForFunction(() => !!document.querySelector('#socialstats svg[data-w149h="main"]'), null, { timeout: 12000 }).catch(() => {});
  const pb = await f.ev(() => { const s = document.querySelector('#socialstats svg[data-w149h="main"]'); if (!s) return null; s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height / 2 }; });
  await f.page.waitForTimeout(400);
  if (pb) { await f.page.touchscreen.tap(pb.x, pb.y); await f.page.waitForTimeout(250); }
  const t5 = await tipNow();
  ok('on a phone, a tap on the graph shows the numbers', t5 && t5.rows.length >= 2, t5);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw149drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
