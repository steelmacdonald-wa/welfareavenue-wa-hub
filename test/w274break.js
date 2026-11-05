/* w274break.js: wave274, the Toronto Volunteers app, under worst-case data and stress on its motion (the break-ui method).
   The worst case comes in through the fixture (test/w274breakfx.js), never through the page: no toggle in the app.
   For admin at 1366 and 390 px (and plain, a member on the opsto profile, at 390 on the worst case):
   - worst: Events (40 upcoming, 80 past, the long hero), the event page (60 on a crew, 9 of 4, a target of 0, 8 organizations,
     the long kitchen), Volunteers (300 people, the hard names first), the sheets with long values;
   - empty (0 events, 0 volunteers), one (1 of everything), huge (1999 confirmed, 2000 meals);
   - motion: the first-draw stagger with 300 rows, filters and search typed fast (no replay of the stagger or the bars),
     a sheet opened and closed fast and reopened while closing (no jump, no stuck state, focus right), a menu opened near the
     bottom and right edges of a phone (on screen, growing from its button), the note at the foot several times in a row,
     and all of it again with reduced motion.
   Each screen: nothing scrolls sideways, no text spills out of its card, the numbers are the largest thing and on one line,
   no page errors. Screenshots go to $BREAK_SHOTS (default: the session scratchpad's break274 folder). */
const fs = require('fs');
const { launch, fresh } = require('./boot');
const BX = require('./w274breakfx');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 1200) : '')); } }
const SHOTS = process.env.BREAK_SHOTS || '/tmp/claude-0/-home-user/84a99a95-9e9a-5af9-9254-00335e8dcb61/scratchpad/break274';
fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (f, n, full) => { await f.page.screenshot({ path: SHOTS + '/' + n.replace(/[^a-z0-9.-]+/gi, '-') + '.png', fullPage: !!full }); };
const RPCS = (who) => ({ wa_org_editor: who === 'admin', is_wa_admin: who === 'admin', is_wa_leader: false, wa_is_hr: false, is_wa_staff: true });
const INIT = (who) => (who === 'plain' ? "window.__WAFIX.hub_roles.forEach(function (r) { if (r.email === 'joy.dumansi@welfareavenue.com') r.profile = 'opsto'; });" : '') +
  "try { localStorage.setItem('wa272.tip', JSON.stringify({ n: 2, at: Date.now() })); } catch (e) {}" +
  /* every transition that starts, with its from and to values, so the motion can be judged after the fact */
  "window.__TR = []; document.addEventListener('transitionrun', function (e) { try { var t = e.target, a = (t.getAnimations ? t.getAnimations() : []).filter(function (x) { return x.transitionProperty === e.propertyName; })[0], k = a && a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : [], tm = a && a.effect ? a.effect.getComputedTiming() : {}; " +
  "window.__TR.push({ at: performance.now(), id: t.id || '', cls: String(t.className && t.className.baseVal !== undefined ? t.className.baseVal : t.className || ''), tag: t.tagName, prop: e.propertyName, from: k[0] ? String(k[0][e.propertyName] || k[0].transform || '') : '', to: k[1] ? String(k[1][e.propertyName] || k[1].transform || '') : '', delay: tm.delay || 0, dur: tm.duration || 0 }); } catch (x) {} }, true);";

/* the answers to the two database functions (the SQL applied), and the writes applied to the fixture */
const INSTALL = () => {
  const FX = window.__WAFIX; let nextId = 990000;
  const r0 = db.rpc.bind(db);
  const good = (d) => Promise.resolve({ data: d, error: null });
  db.rpc = function (fn, args) {
    if (fn === 'wa274_next_code') return good('TO-26-900');
    if (fn === 'wa274_crew_add') {
      const c = (FX.crm_contacts || []).find(x => String(x.id) === String(args.p_contact));
      if (!c) return Promise.resolve({ data: null, error: { message: 'No such contact.' } });
      const ex = (FX.event_roster || []).find(r => String(r.event_id) === String(args.p_event) && String(r.person_id) === String(c.volunteer_id));
      if (ex) return good({ ok: true, roster_id: ex.id, person_id: c.volunteer_id, already: true });
      const row = { id: ++nextId, event_id: args.p_event, person_id: c.volunteer_id, person_name: c.full_name, role: args.p_role, status: 'TBD', confirm_status: null, confirmed_at: null, notes: null, sort: 99, detail: { source: 'toronto', contact_id: c.id } };
      FX.event_roster.push(row);
      return good({ ok: true, roster_id: row.id, person_id: c.volunteer_id, already: false });
    }
    return r0(fn, args);
  };
};

/* ---------- what is checked on every screen ---------- */
const CARDS = ['#toronto > .w118mast', '#toronto .w274hero', '#toronto .w274card', '#toronto .w274prow', '#toronto .w274eh', '#toronto .w274steps', '#toronto .w274box', '#toronto .w274col', '#toronto .w274pc',
  '#toronto .w274wr', '#toronto .w274md', '#toronto .w274row', '#toronto .w274empty', '#toronto .w274tools', '#w274pane', '#w274pane .w274pk', '#w274pane .w274evp', '#w274menu.on', '#w274snack.on'].join(',');
const flat = (f) => f.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/* text (and buttons, fields, chips) that runs out of its card: each text line's box, against the card's box */
const spill = (f) => f.ev((sel) => {
  const out = [], vis = el => !!el && (el.offsetParent !== null || getComputedStyle(el).position === 'fixed') && getComputedStyle(el).visibility !== 'hidden';
  document.querySelectorAll(sel).forEach(card => {
    if (!vis(card)) return;
    const R = card.getBoundingClientRect(); if (!R.width) return;
    const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (!n.textContent.trim()) continue;
      const p = n.parentElement; if (!p || p.closest('.w274vh, option, datalist') || !vis(p)) continue;
      if (getComputedStyle(p).textOverflow === 'ellipsis') continue;   /* cut on purpose (with a title) */
      const rg = document.createRange(); rg.selectNodeContents(n);
      Array.from(rg.getClientRects()).forEach(r => { if (!r.width) return; const over = Math.max(r.right - R.right, R.left - r.left); if (over > 1.5) out.push({ card: (card.id ? '#' + card.id + ' ' : '') + String(card.className).split(' ')[0], el: String(p.className || p.tagName).slice(0, 30), t: n.textContent.trim().slice(0, 36), over: Math.round(over) }); });
    }
    card.querySelectorAll('button, a.w274btn, input, select, textarea, .w274chip, .w274bar').forEach(el => {
      if (!vis(el) || el.closest('.w274vh')) return; const r = el.getBoundingClientRect(); if (!r.width) return;
      const over = Math.max(r.right - R.right, R.left - r.left); if (over > 1.5) out.push({ card: String(card.className).split(' ')[0] || card.id, el: el.tagName + '.' + String(el.className).split(' ')[0], t: (el.textContent || el.value || '').trim().slice(0, 36), over: Math.round(over) });
    });
  });
  return out.slice(0, 10);
}, CARDS);
/* the numbers: bigger than the words around them, on one line, not clipped */
const numbers = (f) => f.ev(() => {
  const fz = el => parseFloat(getComputedStyle(el).fontSize), out = [];
  const one = el => { const rs = el.getClientRects(); return rs.length === 1 && rs[0].height < fz(el) * 1.7; };
  const look = (scopeSel, numSel, wordSel) => document.querySelectorAll(scopeSel).forEach(sc => {
    if (sc.offsetParent === null && getComputedStyle(sc).position !== 'fixed') return;
    const n = sc.querySelector(numSel); if (!n) return;
    const words = Array.from(sc.querySelectorAll(wordSel)).filter(x => x.offsetParent !== null && x.textContent.trim());
    const max = words.length ? Math.max.apply(null, words.map(fz)) : 0;
    if (!(fz(n) > max) || !one(n)) out.push({ scope: scopeSel, n: n.textContent.trim(), size: fz(n), words: max, oneLine: one(n) });
  });
  look('#toronto .w274hero', '.w274conf b', 'h3, .w274meta, .w274rel, .w274br, .w274leg');
  look('#toronto .w274card', '.w274cf b', 'h3, .w274meta, .w274rel, .w274br');
  look('#toronto .w274col', '.w274cn', 'h3, .w274pn');
  look('#toronto .w274rc', '.w274ml b', 'h4, .w274meta');
  look('#toronto [data-w274part="confirm"]', '.w274cnts b', '.w274lead, .w274pn, h3');
  document.querySelectorAll('#toronto .w274br .n, #toronto .w274cn, #toronto .w274ml, #toronto .w274conf b, #toronto .w274cf b').forEach(el => { if (el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline') out.push({ clipped: el.textContent.trim() }); });
  return out.slice(0, 8);
});
async function screen(f, tag, name, o) {
  o = o || {};
  await f.page.waitForTimeout(o.wait || 120);
  const fl = await flat(f), sp = await spill(f), nu = o.numbers === false ? [] : await numbers(f);
  ok(tag + ': ' + name + ': nothing scrolls sideways', fl, await f.ev(() => [document.documentElement.scrollWidth, window.innerWidth]));
  ok(tag + ': ' + name + ': no text spills out of its card', !sp.length, sp);
  if (o.numbers !== false) ok(tag + ': ' + name + ': the numbers are the largest thing, on one line', !nu.length, nu);
  if (o.shot !== false) await shot(f, name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + tag.replace('@', '-'), o.full);
}
const tap = (f, sel) => f.ev(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const at = (f, sel, off) => f.ev(o => { const e = document.querySelector(o.s); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -(o.off || 16)); } return !!e; }, { s: sel, off: off });
const trClear = (f) => f.ev(() => { window.__TR = []; });
const trGet = (f) => f.ev(() => window.__TR.slice());
const sheetState = (f) => f.ev(() => { const s = document.getElementById('w274sheet'), p = document.getElementById('w274pane'); return s ? { open: s.classList.contains('open'), vis: getComputedStyle(s).visibility, hidden: s.getAttribute('aria-hidden'), tf: getComputedStyle(p).transform, op: getComputedStyle(p).opacity, focus: document.activeElement ? (document.activeElement.id || document.activeElement.getAttribute('data-w274edit') && 'edit' || document.activeElement.className) : null, inPane: p.contains(document.activeElement) } : null; });
const pointer = (f) => f.ev(() => { document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });

/* ---------- the worst case ---------- */
async function worst(browser, who, width) {
  const tag = 'worst ' + who + '@' + width, phone = width < 900;
  const f = await fresh(browser, { who, width, hash: '#toronto', fixture: BX.worst(), rpcs: RPCS(who), init: INIT(who), wait: 5200 });
  await f.ev(INSTALL);
  await f.page.waitForTimeout(600);

  /* Events: 40 upcoming (the hero is today), 80 past */
  const evs = await f.ev(() => ({ hero: (document.querySelector('#toronto .w274hero') || {}).innerText || '', cards: document.querySelectorAll('#toronto .w274grid .w274card').length, past: (document.querySelector('[data-w274past]') || {}).textContent }));
  ok(tag + ': Events: the hero is today, then 39 cards, and Past events (80)', /Today, at 09:30/.test(evs.hero) && evs.cards === 39 && evs.past === 'Past events (80)', evs);
  await screen(f, tag, 'events hero');
  await at(f, '#w274hup'); await screen(f, tag, 'events upcoming');
  await at(f, '#toronto .w274card.off', 120); await screen(f, tag, 'events cancelled card');
  await at(f, '#toronto .w274grid .w274card:last-child', 120); await screen(f, tag, 'events 400 days');
  await tap(f, '[data-w274past]'); await at(f, '#w274hpast'); await screen(f, tag, 'events past', { numbers: false });

  /* the stagger on a first draw of 40 cards, and with 300 people rows; filters and search typed fast after it */
  const stag = async (hash, rowSel, label) => {
    await trClear(f);
    const r = await f.ev(async (o) => {
      window.scrollTo(0, 0);
      const t0 = performance.now();
      location.hash = o.hash;
      await new Promise(res => { const tick = () => (document.querySelectorAll(o.sel).length > 5 ? res() : requestAnimationFrame(tick)); tick(); });
      const rows = Array.from(document.querySelectorAll(o.sel)), t1 = performance.now();
      const vis = () => rows.filter(x => x.getBoundingClientRect().top < innerHeight && x.getBoundingClientRect().bottom > 0);
      const below = rows.filter(x => x.getBoundingClientRect().top >= innerHeight);
      const seen = (list) => list.filter(x => parseFloat(getComputedStyle(x).opacity) < 0.99).length;
      const a0 = seen(vis()), b0 = seen(below);
      await new Promise(res => setTimeout(res, 330)); const a330 = seen(vis());
      await new Promise(res => setTimeout(res, 300)); const a630 = seen(rows);
      return { n: rows.length, onScreen: vis().length, wait: Math.round(t1 - t0), hidden0: a0, belowHidden: b0, below: below.length, hidden330: a330, hidden630: a630 };
    }, { hash, sel: rowSel });
    const tr = (await trGet(f)).filter(x => new RegExp(rowSel.split(' ').pop().replace('.', '')).test(x.cls));
    const late = tr.length ? Math.max.apply(null, tr.map(x => x.delay)) : 0, end = tr.length ? Math.max.apply(null, tr.map(x => x.delay + x.dur)) : 0;
    ok(tag + ': ' + label + ': the first draw rises, the last row starting within 300 ms and settled by about 560 ms (' + r.n + ' rows, ' + tr.length / 2 + ' moving)', tr.length > 0 && late <= 300 && end <= 600, { late, end, r });
    ok(tag + ': ' + label + ': rows below the fold are there at once (none invisible when scrolled to)', r.belowHidden === 0 && r.hidden630 === 0, r);
    return r;
  };
  await stag('#toronto/people', '#w274rows .w274row', 'Volunteers, 300 people');
  const pc = await f.ev(() => ({ count: (document.querySelector('#toronto > .w118mast .w274cnt') || {}).textContent, rows: document.querySelectorAll('#w274rows .w274row').length, first: Array.from(document.querySelectorAll('#w274rows .w274row .w274pn')).slice(0, 14).map(x => x.textContent) }));
  ok(tag + ': Volunteers: 300 people, the hard ones first', pc.count === '300' && pc.rows === 300 && pc.first[0] === 'Aleksandra Wiśniewska-Kowalczyk', pc);
  ok(tag + ': Volunteers: a person with no name shows their email instead of "No name"', pc.first.indexOf('No name') < 0 && pc.first.some(x => /^no\.name\.given/.test(x)), pc.first);
  await screen(f, tag, 'people top', { numbers: false });
  await f.ev(() => window.scrollTo(0, 420)); await screen(f, tag, 'people hard rows', { numbers: false });

  /* filters and search, fast: the list follows, nothing rises again */
  await f.ev(() => window.scrollTo(0, 0));
  await trClear(f);
  await f.page.focus('#w274qp');
  await f.page.keyboard.type('ale', { delay: 25 }); await f.page.keyboard.press('Backspace'); await f.page.keyboard.press('Backspace'); await f.page.keyboard.type('mara', { delay: 20 });
  await f.page.waitForTimeout(200);
  const q1 = await f.ev(() => document.querySelectorAll('#w274rows .w274row').length);
  for (const k of ['students', 'general', 'all', 'students', 'all']) { await pointer(f); await tap(f, '[data-w274kind="' + k + '"][data-w274fs="p"]'); await f.page.waitForTimeout(30); }
  for (const d of [0, 6, 0, 6]) { await tap(f, '[data-w274day="' + d + '"][data-w274fs="p"]'); await f.page.waitForTimeout(30); }
  await f.page.fill('#w274qp', ''); await f.page.waitForTimeout(300);
  let tr = await trGet(f);
  const replay = tr.filter(x => /w274row|w274st/.test(x.cls) || /w274bar/.test(x.cls));
  ok(tag + ': search typed fast and filters tapped fast: the list follows, nothing rises again (' + q1 + ' rows for "amara")', !replay.length && q1 >= 1, replay.slice(0, 4));
  ok(tag + ': the search keeps its focus while the list follows', (await f.ev(() => document.activeElement && document.activeElement.id)) === 'w274qp');
  await screen(f, tag, 'people after fast filters', { numbers: false, shot: false });

  /* the note at the foot, several times in a row (Copy email on three rows, fast) */
  await f.ev(() => window.scrollTo(0, 0));
  const sn = await f.ev(async () => {
    const bs = Array.from(document.querySelectorAll('[data-w274cpe]')).slice(0, 3);
    for (const b of bs) { b.click(); await new Promise(r => setTimeout(r, 60)); }
    await new Promise(r => setTimeout(r, 350));
    const s = document.getElementById('w274snack'), r = s.getBoundingClientRect(), t = s.querySelector('span');
    return { n: document.querySelectorAll('#w274snack').length, on: s.classList.contains('on'), text: s.innerText, left: r.left, right: r.right, top: r.top, bottom: r.bottom, h: r.height, iw: innerWidth, ih: innerHeight, spill: t.scrollWidth > t.clientWidth + 1 };
  });
  ok(tag + ': the note at the foot, three times in a row: one note, the latest words, on screen, nothing spilling', sn.n === 1 && sn.on && /fox@example\.com|j@example\.com|bartholomew/.test(sn.text) && sn.left >= 8 && sn.right <= sn.iw - 8 && sn.bottom <= sn.ih && !sn.spill, sn);
  await shot(f, 'snack-email-' + tag.replace(/[ @]/g, '-'));
  const sn2 = await f.ev(async () => { document.querySelector('[data-w274cpe]').click(); await new Promise(r => setTimeout(r, 350)); const s = document.getElementById('w274snack'), r = s.getBoundingClientRect(); return { text: s.innerText, left: r.left, right: r.right, iw: innerWidth, h: r.height }; });
  ok(tag + ': the longest email in the note wraps inside it, on screen', sn2.left >= 8 && sn2.right <= sn2.iw - 8 && /aleksandra/.test(sn2.text), sn2);
  await shot(f, 'snack-long-email-' + tag.replace(/[ @]/g, '-'));
  const sn3 = await f.ev(async () => { await new Promise(r => setTimeout(r, 3300)); const s = document.getElementById('w274snack'); const a = s.classList.contains('on'); document.querySelectorAll('[data-w274cpe]')[2].click(); await new Promise(r => setTimeout(r, 300)); return { hiding: !a, back: s.classList.contains('on') && getComputedStyle(s).visibility === 'visible' && parseFloat(getComputedStyle(s).opacity) > 0.9 }; });
  ok(tag + ': the note goes after its time, and comes back at once when asked again while it fades', sn3.hiding && sn3.back, sn3);

  /* Add to an event: the long event list in the sheet */
  await pointer(f); await tap(f, '[data-w274to]'); await f.page.waitForTimeout(450);
  await screen(f, tag, 'sheet add to an event', { numbers: false });
  await tap(f, '#w274pane [data-w274x]'); await f.page.waitForTimeout(350);

  /* the event page: 60 on the kitchen crew, 9 of 4, a lead on a target of 0, 8 organizations */
  await f.hash('#toronto/e/' + BX.W.hero, 2400);
  const ep = await f.ev(() => ({ h1: document.querySelector('#toronto > .w118mast h1').textContent, cur: (document.querySelector('.w274steps [aria-current="step"]') || {}).textContent, cols: Array.from(document.querySelectorAll('#w274root .w274col')).map(c => c.getAttribute('data-w274role') + ':' + c.querySelector('.w274cn').textContent + ':' + c.querySelectorAll('.w274pc').length), recs: document.querySelectorAll('#w274root .w274rc').length }));
  ok(tag + ': the event page: the long title, Confirm (today), the crews with 60 and 9 of 4, 8 organizations', ep.h1 === BX.LONG_TITLE && ep.cur === 'Confirm' && ep.recs === 8 && ep.cols.some(c => /^cook:56 of 4:60$/.test(c)) && ep.cols.some(c => /^server:9 of 4:9$/.test(c)), ep);
  const bars = await f.ev(() => Array.from(document.querySelectorAll('#w274root .w274bar')).map(b => { const t = b.getBoundingClientRect(); return Array.from(b.querySelectorAll('i')).every(i => { const r = i.getBoundingClientRect(); return r.right <= t.right + 0.5 && r.left >= t.left - 0.5; }); }).every(Boolean));
  ok(tag + ': the bars of a crew over its target (9 of 4, 56 of 4) stay inside their track', bars);
  await screen(f, tag, 'event head');
  await at(f, '#w274s-plan'); await screen(f, tag, 'event plan');
  await at(f, '[data-w274rid="2747001"] .w274diet', 120); await screen(f, tag, 'event plan dietary');
  await at(f, '#w274s-crew'); await screen(f, tag, 'event crew');
  const colH = await f.ev(() => Array.from(document.querySelectorAll('#w274root .w274col')).map(c => Math.round(c.getBoundingClientRect().height)));
  ok(tag + ': a crew of 60 does not stretch the short crews beside it', phone || Math.min.apply(null, colH) < 900, colH);
  await at(f, '#w274s-confirm'); await screen(f, tag, 'event confirm');
  await at(f, '#w274s-wrap'); await screen(f, tag, 'event wrap');

  /* the sheets with the long values in them */
  await f.ev(() => window.scrollTo(0, 0));
  await pointer(f); await tap(f, '[data-w274rec="2747001"]'); await f.page.waitForTimeout(450);
  await screen(f, tag, 'sheet the long organization', { numbers: false });
  await tap(f, '#w274pane [data-w274x]'); await f.page.waitForTimeout(350);
  await pointer(f); await tap(f, '[data-w274addp="cook"]'); await f.page.waitForTimeout(700);
  const pk = await f.ev(() => ({ c: (document.getElementById('w274pkc') || {}).textContent, n: document.querySelectorAll('#w274pkl .w274pk').length }));
  ok(tag + ': Add people with 300 in the pool: 150 shown, and it says so', pk.n === 150 && /^Showing 150 of 300/.test(pk.c), pk);
  await screen(f, tag, 'sheet add people', { numbers: false });
  /* add twelve at once: the note at the foot says it in one line or two */
  await f.ev(() => { Array.from(document.querySelectorAll('#w274pkl input[data-w274pick]:not([disabled])')).slice(0, 12).forEach(i => { i.click(); }); });
  await f.page.waitForTimeout(100);
  await tap(f, '#w274pkgo'); await f.page.waitForTimeout(1200);
  const many = await f.ev(() => { const s = document.getElementById('w274snack'), r = s.getBoundingClientRect(); return { on: s.classList.contains('on'), text: s.innerText, h: r.height, left: r.left, right: r.right, iw: innerWidth }; });
  ok(tag + ': adding 12 people at once: the note says how many, on screen, in two lines at most', many.on && many.h <= 70 && many.left >= 8 && many.right <= many.iw - 8 && /12 people/.test(many.text), many);
  await shot(f, 'snack-added-12-' + tag.replace(/[ @]/g, '-'));
  await f.page.waitForTimeout(3400);

  /* a sheet opened and closed fast, reopened while it closes: no jump, nothing stuck, focus right */
  await f.ev(() => window.scrollTo(0, 0));
  await pointer(f);
  const fast = await f.ev(async (ph) => {
    const pane = document.getElementById('w274pane'), frames = [];
    const prog = () => { const m = new DOMMatrixReadOnly(getComputedStyle(pane).transform); const size = ph ? pane.getBoundingClientRect().height || 1 : pane.offsetWidth || 1; const off = ph ? m.m42 : m.m41; return 1 - Math.min(1, Math.abs(off) / size); };
    let run = true; const loop = () => { frames.push([performance.now(), prog()]); if (run) requestAnimationFrame(loop); }; loop();
    const edit = () => document.querySelector('[data-w274edit]').click(), close = () => document.querySelector('#w274sheet .w274bd').click(), x = () => document.querySelector('#w274pane [data-w274x]').click();
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    edit(); await wait(140); close(); await wait(70); edit(); await wait(60); x(); await wait(40); edit(); await wait(30); close(); await wait(25); edit(); await wait(520);
    run = false;
    let jump = 0; for (let i = 1; i < frames.length; i++) jump = Math.max(jump, Math.abs(frames[i][1] - frames[i - 1][1]));
    return { jump: Math.round(jump * 100) / 100, end: Math.round(frames[frames.length - 1][1] * 100) / 100, frames: frames.length };
  }, phone);
  let ss = await sheetState(f);
  ok(tag + ': a sheet opened, closed and reopened while closing, five times fast: no jump (largest step ' + fast.jump + ' of the way per frame), open at the end', fast.jump <= 0.3 && fast.end >= 0.99 && ss.open && ss.vis === 'visible' && ss.hidden === null, [fast, ss]);
  ok(tag + ': ...and focus is in the sheet (' + (phone ? 'the sheet itself on a touch screen' : 'the date') + ')', ss.inPane && ss.focus === (phone ? 'w274pane' : 'w274fd'), ss);
  await screen(f, tag, 'sheet edit the event', { numbers: false });
  await tap(f, '#w274sheet .w274bd'); await f.page.waitForTimeout(400);
  ss = await sheetState(f);
  ok(tag + ': ...and closed, nothing stuck: hidden, and focus back on Edit', !ss.open && ss.vis === 'hidden' && ss.hidden === 'true' && ss.focus === 'edit', ss);
  /* with the keyboard: Enter and Escape, fast, nothing moves, focus goes back */
  await f.page.focus('[data-w274edit]'); await trClear(f);
  for (let i = 0; i < 3; i++) { await f.page.keyboard.press('Enter'); await f.page.waitForTimeout(40); await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(40); }
  await f.page.waitForTimeout(300);
  ss = await sheetState(f); tr = (await trGet(f)).filter(x => x.id === 'w274pane' || /w274bd/.test(x.cls));
  ok(tag + ': Enter and Escape three times fast: nothing moves, the sheet is closed, focus on Edit', !tr.length && !ss.open && ss.vis === 'hidden' && ss.focus === 'edit', [tr.slice(0, 3), ss]);

  /* a menu near the bottom and the right edge of the screen */
  const mb = await f.ev(() => {
    const bar = Array.from(document.querySelectorAll('body *')).filter(e => { const s = getComputedStyle(e); if (s.position !== 'fixed' || s.visibility === 'hidden' || e.closest('#w274sheet, #w274menu, #w274snack')) return false; const r = e.getBoundingClientRect(); return r.width > innerWidth * 0.6 && r.bottom >= innerHeight - 2 && r.height < 160 && r.height > 20; }).map(e => e.getBoundingClientRect().top);
    return bar.length ? Math.min.apply(null, bar) : innerHeight;
  });
  const btnSel = '[data-w274r="' + (BX.CB ? '' : '') + '"]';
  const trig = await f.ev((barTop) => {
    const bs = Array.from(document.querySelectorAll('#w274root .w274col[data-w274role="cook"] [data-w274pm]')); const b = bs[30];
    const r0 = b.getBoundingClientRect(); window.scrollBy(0, r0.bottom - (barTop - 6));
    const r = b.getBoundingClientRect(); b.setAttribute('data-test-trig', '1'); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, barTop, ih: innerHeight, iw: innerWidth };
  }, mb);
  await f.page.waitForTimeout(150); await trClear(f);
  if (phone) await f.page.tap('[data-test-trig="1"]'); else await f.page.click('[data-test-trig="1"]');
  await f.page.waitForTimeout(260);
  const mn = await f.ev(() => { const m = document.getElementById('w274menu'), r = m.getBoundingClientRect(), o = getComputedStyle(m).transformOrigin.split(' ').map(parseFloat), t = document.querySelector('[data-test-trig="1"]').getBoundingClientRect(); return { on: m.classList.contains('on'), up: m.classList.contains('up'), left: r.left, right: r.right, top: r.top, bottom: r.bottom, ox: r.left + o[0], oy: r.top + o[1], tx: (t.left + t.right) / 2, ttop: t.top, tbottom: t.bottom, iw: innerWidth, ih: innerHeight }; });
  tr = (await trGet(f)).filter(x => x.id === 'w274menu' && x.prop === 'transform');
  ok(tag + ': a menu opened from a button near the bottom right: on screen, above its button', mn.on && mn.up && mn.left >= 0 && mn.right <= mn.iw && mn.top >= 0 && mn.bottom <= mn.ih && mn.bottom <= mn.ttop + 1, mn);
  ok(tag + ': ...and it grows from its button (the origin at the button, scaling up from .96)', Math.abs(mn.ox - mn.tx) <= 24 && Math.abs(mn.oy - mn.ttop) <= 10 && tr.length === 1 && /0\.96/.test(tr[0].from), [mn, tr]);
  await shot(f, 'menu-bottom-right-' + tag.replace(/[ @]/g, '-'));
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  ok(tag + ': ...Escape closes it and focus goes back to its button', await f.ev(() => !document.getElementById('w274menu').classList.contains('on') && document.activeElement && document.activeElement.getAttribute('data-test-trig') === '1'));
  /* More, at the top right */
  await f.ev(() => window.scrollTo(0, 0)); await f.page.waitForTimeout(100);
  if (phone) await f.page.tap('[data-w274more]'); else await f.page.click('[data-w274more]');
  await f.page.waitForTimeout(260);
  const mm = await f.ev(() => { const m = document.getElementById('w274menu'), r = m.getBoundingClientRect(), o = getComputedStyle(m).transformOrigin.split(' ').map(parseFloat), t = document.querySelector('[data-w274more]').getBoundingClientRect(); return { on: m.classList.contains('on'), up: m.classList.contains('up'), left: r.left, right: r.right, top: r.top, ox: r.left + o[0], oy: r.top + o[1], tx: (t.left + t.right) / 2, tbottom: t.bottom, iw: innerWidth }; });
  ok(tag + ': More opens below its button, on screen, growing from it', mm.on && !mm.up && mm.left >= 0 && mm.right <= mm.iw && mm.top >= mm.tbottom - 1 && Math.abs(mm.ox - mm.tx) <= 24 && Math.abs(mm.oy - mm.top) <= 2, mm);
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(150);

  /* statuses changed and Called toggled fast: the chips crossfade, the bars move from where they are (never from empty) */
  await at(f, '#w274s-crew'); await trClear(f);
  for (let i = 0; i < 3; i++) {
    await f.ev(async (i) => { const b = document.querySelectorAll('#w274root .w274col[data-w274role="cook"] [data-w274pm]')[3 + i]; document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await new Promise(r => setTimeout(r, 60)); const it = document.querySelector('#w274menu [data-w274mk="no"]'); it.click(); }, i);
    await f.page.waitForTimeout(90);
  }
  await at(f, '#w274s-confirm');
  for (let i = 0; i < 4; i++) { await f.ev(() => { const b = document.querySelector('[data-w274call]'); if (b) b.click(); }); await f.page.waitForTimeout(50); }
  await f.page.waitForTimeout(500);
  tr = await trGet(f);
  const fromZero = tr.filter(x => /^(c|w)$/.test(x.cls) && x.prop === 'transform' && /matrix\(0,|scaleX\(0\)/.test(x.from));
  const rose = tr.filter(x => /w274st/.test(x.cls));
  const long = tr.filter(x => x.dur > 300 && x.id !== 'w274pane' && !/w274bd/.test(x.cls));
  ok(tag + ': statuses and Called changed fast: no bar refills from empty, nothing rises, nothing over 300 ms', !fromZero.length && !rose.length && !long.length, { fromZero: fromZero.slice(0, 3), rose: rose.length, long: long.slice(0, 3) });
  ok(tag + ': no page errors (worst case)', !f.errs.length, f.errs);

  /* reduced motion, all of it again */
  await f.page.emulateMedia({ reducedMotion: 'reduce' });
  await f.hash('#toronto', 1500);
  await trClear(f);
  await f.ev(async () => { location.hash = '#toronto/people'; await new Promise(r => setTimeout(r, 1400)); });
  tr = await trGet(f);
  const rmRows = tr.filter(x => /w274row/.test(x.cls));
  ok(tag + ' reduced: the first draw of 300 rows fades without moving or waiting', !rmRows.some(x => x.prop === 'transform') && rmRows.every(x => x.delay === 0) && (await f.ev(() => Array.from(document.querySelectorAll('#w274rows .w274row')).every(r => getComputedStyle(r).opacity === '1'))), rmRows.slice(0, 3));
  await trClear(f);
  await f.ev(async () => { const bs = Array.from(document.querySelectorAll('[data-w274cpe]')); for (const b of bs.slice(0, 3)) { b.click(); await new Promise(r => setTimeout(r, 60)); } await new Promise(r => setTimeout(r, 300)); });
  await f.ev(() => { document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.querySelector('[data-w274to]').click(); });
  await f.page.waitForTimeout(140); await tap(f, '#w274sheet .w274bd'); await f.page.waitForTimeout(60);
  await f.ev(() => document.querySelector('[data-w274to]').click()); await f.page.waitForTimeout(450);
  ss = await sheetState(f);
  ok(tag + ' reduced: a sheet reopened while closing ends open and in place, focus in it', ss.open && ss.vis === 'visible' && parseFloat(ss.op) > 0.99 && (ss.tf === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(ss.tf)) && ss.inPane, ss);
  await tap(f, '#w274sheet .w274bd'); await f.page.waitForTimeout(350);
  await f.hash('#toronto/e/' + BX.W.hero, 2000);
  await f.ev(() => { const b = document.querySelectorAll('#w274root [data-w274pm]')[10]; b.scrollIntoView({ block: 'center' }); });
  await f.page.waitForTimeout(150);
  await f.ev(() => { document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.querySelectorAll('#w274root [data-w274pm]')[10].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
  await f.page.waitForTimeout(250); await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(150);
  tr = await trGet(f);
  const moved = tr.filter(x => x.prop === 'transform' && !/w274(btn|ib|card|hero|prow|add|tog|fold|pk|evp|mi)/.test(x.cls) && x.tag !== 'BUTTON' && x.tag !== 'LABEL');
  ok(tag + ' reduced: the note, the sheet, the menu and the bars never move (opacity only)', !moved.length, moved.slice(0, 4));
  ok(tag + ' reduced: no page errors', !f.errs.length, f.errs);
  await f.page.emulateMedia({ reducedMotion: 'no-preference' });
  await f.close();
}

/* ---------- plain (the opsto profile) at 390 on the worst case: the screens hold for a team member too ---------- */
async function plainPhone(browser) {
  const tag = 'worst plain@390';
  const f = await fresh(browser, { who: 'plain', width: 390, hash: '#toronto', fixture: BX.worst(), rpcs: RPCS('plain'), init: INIT('plain'), wait: 5200 });
  await f.ev(INSTALL); await f.page.waitForTimeout(500);
  ok(tag + ': the app opens for a member on the Toronto team', !!(await f.ev(() => document.querySelector('#toronto .w274hero'))));
  await screen(f, tag, 'events hero');
  await f.hash('#toronto/people', 2600); await screen(f, tag, 'people top', { numbers: false });
  await f.hash('#toronto/e/' + BX.W.hero, 2400); await at(f, '#w274s-crew'); await screen(f, tag, 'event crew');
  ok(tag + ': no page errors', !f.errs.length, f.errs);
  await f.close();
}

/* ---------- 0 of everything, 1 of everything, and the huge numbers ---------- */
async function empty(browser, width) {
  const tag = 'empty admin@' + width;
  const f = await fresh(browser, { who: 'admin', width, hash: '#toronto', fixture: BX.empty(), rpcs: RPCS('admin'), init: INIT('admin'), wait: 5200 });
  await f.ev(INSTALL); await f.page.waitForTimeout(400);
  const e = await f.ev(() => ({ t: (document.querySelector('#w274root .w274empty') || {}).innerText || '', h: Array.from(document.querySelectorAll('#w274root h2')).map(h => h.textContent) }));
  ok(tag + ': Events: "No Toronto events yet." with New event', /No Toronto events yet\./.test(e.t) && /New event/.test(e.t), e);
  await screen(f, tag, 'events', { numbers: false });
  await f.hash('#toronto/people', 2600);
  const p = await f.ev(() => ({ t: (document.querySelector('#w274root .w274empty') || {}).innerText || '', cnt: (document.querySelector('#toronto > .w118mast .w274cnt') || {}).textContent || null, tools: !!document.querySelector('#w274root [data-w274tools="p"]') }));
  ok(tag + ': Volunteers: says the CRM has no Toronto volunteers yet', /No Toronto volunteers in the CRM yet\./.test(p.t), p);
  await screen(f, tag, 'people', { numbers: false });
  await f.hash('#toronto/e/123456', 1600);
  ok(tag + ': an event that is not there says so, with the way back', /isn’t here/.test(await f.ev(() => document.querySelector('#toronto > .w118mast h1').textContent)));
  ok(tag + ': no page errors', !f.errs.length, f.errs);
  await f.close();
}
async function one(browser, width) {
  const tag = 'one admin@' + width;
  const f = await fresh(browser, { who: 'admin', width, hash: '#toronto', fixture: BX.one(), rpcs: RPCS('admin'), init: INIT('admin'), wait: 5200 });
  await f.ev(INSTALL); await f.page.waitForTimeout(400);
  const h = await f.ev(() => ({ t: (document.querySelector('#toronto .w274hero') || {}).innerText || '', up: !!document.querySelector('#w274hup'), past: !!document.querySelector('#w274hpast') }));
  ok(tag + ': one event: the hero only, with its year (Sat 30 Oct 2027), in 400 days, 1 of 1 confirmed', /Sat 30 Oct 2027/.test(h.t) && /In 400 days/.test(h.t) && /1\s+of 1 confirmed/.test(h.t) && /Sistering \(1\)/.test(h.t) && !h.up && !h.past, h);
  await screen(f, tag, 'events');
  await f.hash('#toronto/e/' + BX.O.ev, 2400);
  const plan = await f.ev(() => (document.querySelector('[data-w274part="plan"]') || {}).innerText || '');
  ok(tag + ': one organization with 1 meal says "1 meal", not "1 meals"', /\b1\s*meal\b/.test(plan) && !/\b1\s*meals\b/.test(plan), plan.slice(0, 400));
  await screen(f, tag, 'event');
  await f.hash('#toronto/people', 2600);
  ok(tag + ': one volunteer: "1 person"', /1 person/.test(await f.ev(() => (document.getElementById('w274pcount') || {}).textContent || '')) || (await f.ev(() => (document.querySelector('#toronto > .w118mast .w274cnt') || {}).textContent)) === '1');
  await screen(f, tag, 'people', { numbers: false });
  ok(tag + ': no page errors', !f.errs.length, f.errs);
  await f.close();
}
async function huge(browser, width) {
  const tag = 'huge admin@' + width;
  const f = await fresh(browser, { who: 'admin', width, hash: '#toronto', fixture: BX.huge(), rpcs: RPCS('admin'), init: INIT('admin'), wait: 5200 });
  await f.ev(INSTALL); await f.page.waitForTimeout(400);
  const h = await f.ev(() => (document.querySelector('#toronto .w274hero') || {}).innerText || '');
  ok(tag + ': 1999 confirmed of 2000, with thousands separators', /1,999\s+of 2,000 confirmed/.test(h) && /1,200 of 1,200/.test(h) && /Fred Victor \(2,000\)/.test(h), h);
  await screen(f, tag, 'events');
  await tap(f, '[data-w274past]'); await at(f, '#w274hpast');
  ok(tag + ': 2000 meals delivered reads 2,000', /2,000 meals delivered/.test(await f.ev(() => (document.querySelector('#w274pastl') || {}).innerText || '')));
  const t0 = Date.now();
  await f.hash('#toronto/e/' + BX.H.ev, 300);
  await f.page.waitForFunction(() => document.querySelectorAll('#w274root .w274pc').length > 1000, null, { timeout: 20000 });
  const ms = Date.now() - t0;
  ok(tag + ': the event page with 1999 people draws in under 4 seconds (' + ms + ' ms)', ms < 4000, ms);
  await screen(f, tag, 'event head');
  await at(f, '#w274s-confirm'); await screen(f, tag, 'event confirm');
  ok(tag + ': no page errors', !f.errs.length, f.errs);
  await f.close();
}

(async () => {
  const browser = await launch();
  const only = process.env.ONLY || '';
  const run = async (name, fn) => { if (only && only.split(',').indexOf(name) < 0) return; try { await fn(); } catch (e) { fail++; console.log('FAIL ' + name + ' crashed :: ' + String(e && e.stack || e).slice(0, 600)); } };
  for (const w of [1366, 390]) await run('worst' + w, () => worst(browser, 'admin', w));
  await run('plain390', () => plainPhone(browser));
  for (const w of [1366, 390]) { await run('empty' + w, () => empty(browser, w)); await run('one' + w, () => one(browser, w)); await run('huge' + w, () => huge(browser, w)); }
  await browser.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
