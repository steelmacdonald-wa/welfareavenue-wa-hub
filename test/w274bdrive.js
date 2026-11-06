/* w274bdrive.js: wave274b, the anticipated spend on the shared calendar, offline against the candidate (CAND=build/<file>.html).
   For admin and plain (a member on the opsto profile) at 1366 and 390 px: the Calendar's October with a Toronto event ($750),
   two Montreal servings ($500 and $125.50) and a cancelled Toronto event ($300, left out): the month's total with the cities,
   the tag on the item where it fits (none on a phone), the item's sheet, the agenda line, the layer off, a month with none.
   Then the Toronto app: New event with a spend (two bad values refused in words beside the field, then $1,250.50 written),
   Plan's row (Not set, then $250 in place after Edit, then changed, then cleared, each through the audit trail), and the
   Calendar again (the changed total, November's new event). Then the fallback before wa274b_budget.sql: every select or
   write naming budget answers 42703; Toronto loads, the field is gone, Plan says why, nothing sends budget, the Calendar
   asks once and still shows every event. No sideways scroll, no page errors.
   Screenshots go to $WA_SHOTS (or $SHOTS) when set. */
const { launch, fresh } = require('./boot');
const fx274 = require('./w274fx');
const { EV } = fx274;
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
const SHOTS = process.env.WA_SHOTS || process.env.SHOTS || ''; if (SHOTS) require('fs').mkdirSync(SHOTS, { recursive: true });
const shot = async (f, n) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png' }); };
const RPCS = (who) => ({ wa_org_editor: who === 'admin', is_wa_admin: who === 'admin', is_wa_leader: false, wa_is_hr: false, is_wa_staff: true });
const INIT = (who) => (who === 'plain' ? "window.__WAFIX.hub_roles.forEach(function (r) { if (r.email === 'joy.dumansi@welfareavenue.com') r.profile = 'opsto'; });" : '') +
  "try { localStorage.setItem('wa272.tip', JSON.stringify({ n: 2, at: Date.now() })); } catch (e) {}";

/* the events with a spend: TO-26-2 (4 Oct, Toronto) $750, WA-26-40 (4 Oct, Montreal) $500, WA-26-22 (18 Oct, Montreal, the base
   fixture) $125.50, TO-26-9 (18 Oct, Toronto, cancelled) $300; every other event has none */
const MTL2 = 24, CANC = 2744;
function fixture() {
  const fx = fx274();
  fx.volunteer_events.forEach(e => { e.budget = e.id === EV.next ? 750 : e.id === EV.mtl ? 500 : e.id === MTL2 ? 125.5 : null; });
  fx.volunteer_events.push({ id: CANC, code: 'TO-26-9', event_date: '2026-10-18', start_time: '10:00:00', title: 'Free meal event', location: 'Toronto', kind: 'meal', status: 'cancelled', notes: null, plan_note: null, season: 'Fall',
    planned_meals: 30, kitchen_place: 'Ralph Thornton Community Centre', kitchen_contact: null, kitchen_shift: null, whatsapp_url: null, spot_counts: null, created_at: '2026-08-01T12:00:00Z', itinerary_url: null, budget: 300 });
  return fx;
}

/* records every select, write and rpc; answers wa274_next_code and wa274_crew_add the way the SQL does; writes are applied to
   the fixture (ids for inserts), so a reload reads what was saved. o.nobudget: the database without volunteer_events.budget
   (a select or write that names it answers 42703, as PostgREST does) */
const INSTALL = (o) => {
  const FX = window.__WAFIX; let nextId = 880000;
  window.__REC = { writes: [], calls: [], selects: [], refused: [] };
  const r0 = db.rpc.bind(db), f0 = db.from.bind(db);
  const good = (d) => Promise.resolve({ data: d, error: null });
  const NOCOL = { code: '42703', message: 'column volunteer_events.budget does not exist' };
  db.rpc = function (fn, args) {
    window.__REC.calls.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    if (fn === 'wa274_next_code') return good('TO-26-4');
    return r0(fn, args);
  };
  db.from = function (table) {
    const b = f0(table); let rec = null, bad = false;
    const names = (p) => table === 'volunteer_events' && (Array.isArray(p) ? p : [p]).some(x => x && typeof x === 'object' && 'budget' in x);
    const sel0 = b.select.bind(b);
    b.select = function (cols, opts) {
      const c = String(cols == null ? '*' : cols);
      window.__REC.selects.push({ table: table, cols: c, after: rec ? rec.op : null });
      if (o.nobudget && table === 'volunteer_events' && /\bbudget\b/.test(c)) { bad = true; window.__REC.refused.push({ table: table, cols: c }); }
      return sel0(cols, opts);
    };
    ['insert', 'update', 'upsert', 'delete'].forEach(function (op) {
      const orig = b[op].bind(b);
      b[op] = function (payload) {
        rec = { table: table, op: op, payload: payload === undefined ? null : JSON.parse(JSON.stringify(payload)), eq: [] };
        window.__REC.writes.push(rec);
        if (o.nobudget && names(payload)) { bad = true; rec.refused = true; return orig(payload); }
        if (op === 'insert' || op === 'upsert') (Array.isArray(payload) ? payload : [payload]).forEach(function (p) { if (p && p.id == null) p.id = ++nextId; rec.ids = (rec.ids || []).concat([p.id]); (FX[table] = FX[table] || []).push(JSON.parse(JSON.stringify(p))); });
        return orig(payload);
      };
    });
    const eq0 = b.eq.bind(b); b.eq = function (c, v) { if (rec) rec.eq.push([c, v]); return eq0(c, v); };
    const then0 = b.then.bind(b);
    b.then = function (a, c) {
      if (bad) return Promise.resolve({ data: null, error: NOCOL }).then(a, c);
      if (rec && !rec.applied && (rec.op === 'update' || rec.op === 'delete')) {
        rec.applied = true;
        const match = r => rec.eq.every(e => String(r[e[0]]) === String(e[1]));
        if (rec.op === 'update') (FX[table] || []).filter(match).forEach(r => Object.assign(r, JSON.parse(JSON.stringify(rec.payload))));
        else FX[table] = (FX[table] || []).filter(r => !match(r));
      }
      return then0(a, c);
    };
    return b;
  };
};
const writes = (f, table, op) => f.ev(o => window.__REC.writes.filter(w => w.table === o.t && (!o.op || w.op === o.op)), { t: table, op: op || null });
const flat = (f) => f.ev(() => { const w = Math.min(window.innerWidth, screen.width); return document.documentElement.scrollWidth <= w + 1 && window.innerWidth <= screen.width + 1; });   /* a phone viewport zooms out when something overflows */
const tap = (f, sel) => f.ev(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const txt = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
const sheet = (f) => f.ev(() => { const s = document.getElementById('w274sheet'); return { open: !!s && s.classList.contains('open'), title: (document.getElementById('w274sht') || {}).textContent || '', err: ((document.querySelector('#w274pane [data-w274err="sheet"]') || {}).textContent || '').trim(), spendErr: ((document.querySelector('#w274pane [data-w274err="budget"]') || {}).textContent || '').trim(), text: ((document.getElementById('w274pane') || {}).innerText || '') }; });
const newBtn = (f) => f.ev(() => { const p = document.querySelector('#toronto > .w118mast .w197pact[data-w197proxy="newevent"]'); if (p && p.offsetParent !== null) return '#toronto > .w118mast .w197pact[data-w197proxy="newevent"]'; const b = document.querySelector('#w153bar [data-w153act="newevent"]'); return b && b.offsetParent !== null ? '#w153bar [data-w153act="newevent"]' : null; });
const spendDd = (f) => f.ev(() => { const d = document.querySelector('#w274root [data-w274part="plan"] [data-w274spend]'), dt = d && d.previousElementSibling; return d ? { dt: dt ? dt.textContent : '', dd: d.textContent, muted: !!d.querySelector('.none') } : null; });
const calLine = (f) => txt(f, '#w124cal .w124spend');
const calMonth = async (f, ym, view) => { await f.hash('#calendar/' + ym + '/' + (view || 'month'), 1500); };
const item = (f, id) => f.ev(i => { const p = document.querySelector('#w124cal .w124ev[data-w124it="' + i + '"]'); if (!p) return null; const t = p.querySelector('.w124amt'); return { tag: t ? t.textContent : null, shown: !!t && getComputedStyle(t).display !== 'none', tip: p.getAttribute('title'), w: p.getBoundingClientRect().width }; }, id);
const itemSheet = async (f, id) => { await f.ev(i => document.querySelector('#w124cal [data-w124it="' + i + '"]').click(), id); await f.page.waitForTimeout(350); const t = await f.ev(() => { const s = document.getElementById('w124sheet'); return s && s.classList.contains('on') ? s.querySelector('.pane').innerText.replace(/\s+/g, ' ') : null; }); return t; };
const at = (f, sel) => f.ev(s => { const e = document.querySelector(s); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -16); } }, sel);
const closeCal = async (f) => { await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(250); };

async function run(browser, who, width) {
  const tag = who + '@' + width, phone = width < 900;
  const f = await fresh(browser, { who: who, width: width, hash: '#mypage', fixture: fixture(), rpcs: RPCS(who), init: INIT(who), wait: 5200 });
  await f.ev(INSTALL, {});
  let wide = true; const flatHere = async () => { if (!(await flat(f))) wide = false; };

  /* ---------- the Calendar: October ---------- */
  await calMonth(f, '2026-10');
  const OCT = 'Anticipated spend this month: $1,375.50 on 3 events (Toronto $750, Montreal $625.50)';
  ok(tag + ': October: one quiet line with the month’s anticipated spend and the two cities (the cancelled $300 left out)', (await calLine(f)) === OCT && (await f.ev(() => document.querySelectorAll('#w124cal .w124spend').length)) === 1 && (await f.ev(() => w124.state().budgetOk)) === true, await calLine(f));
  const place = await f.ev(() => { const l = document.querySelector('#w124cal .w124layers'), s = document.querySelector('#w124cal .w124spend'); return !!l && !!s && l.nextElementSibling === s; });
  ok(tag + ': the line sits under the layers (the legend)', place, null);
  const it = await item(f, 'v' + EV.next), itM = await item(f, 'v' + EV.mtl);
  ok(tag + ': the Toronto event and the Montreal serving carry their spend in the tooltip' + (phone ? ', and no tag on a phone (the pills are bars)' : ', and a short tag after the title ($750, $500)'),
    it && itM && /anticipated spend \$750$/.test(it.tip) && /anticipated spend \$500$/.test(itM.tip) && (phone ? !it.shown && !itM.shown : it.shown && it.tag === '$750' && itM.shown && itM.tag === '$500'), [it, itM]);
  const cells = await f.ev(() => { const g = document.querySelector('#w124cal .w124grid'), c = Array.from(g.querySelectorAll('.w124cell')).map(x => Math.round(x.getBoundingClientRect().width)); return { min: Math.min.apply(null, c), max: Math.max.apply(null, c), ev: Array.from(g.querySelectorAll('.w124ev')).every(e => e.getBoundingClientRect().right <= e.parentNode.getBoundingClientRect().right + 0.5) }; });
  ok(tag + ': every cell keeps its width and every pill stays inside its cell', cells.max - cells.min <= 1 && cells.ev, cells);
  await f.ev(() => window.scrollTo(0, 0)); await shot(f, 'cal-month-' + tag); await flatHere();
  let st = await itemSheet(f, 'v' + EV.next);
  ok(tag + ': the Toronto event’s sheet has its own line: Anticipated spend $750', !!st && /Anticipated spend \$750/.test(st) && /Toronto/.test(st), st);
  await shot(f, 'cal-sheet-toronto-' + tag); await flatHere();
  await closeCal(f);
  st = await itemSheet(f, 'v' + EV.mtl);
  ok(tag + ': a Montreal serving with a spend shows it in its sheet too', !!st && /Anticipated spend \$500/.test(st) && /Montreal/.test(st), st);
  await shot(f, 'cal-sheet-montreal-' + tag);
  await closeCal(f);
  st = await itemSheet(f, 'v23');
  ok(tag + ': a serving with no spend has no such line', !!st && !/Anticipated spend/.test(st), st);
  await closeCal(f);
  /* the agenda */
  await tap(f, '#w124cal [data-w124view="agenda"]'); await f.page.waitForTimeout(500);
  const ag = await f.ev(() => { const o = {}; document.querySelectorAll('#w124cal .w124ag .w124row[data-w124it^="v"]').forEach(r => { o[r.getAttribute('data-w124it')] = ((r.querySelector('.mm') || {}).textContent || ''); }); return o; });
  ok(tag + ': the agenda says it on each event’s line ("Toronto · Anticipated spend $750", $500, $125.50; the cancelled one says so), not on the others',
    ag['v' + EV.next] === 'Toronto · Anticipated spend $750' && ag['v' + EV.mtl] === 'Montreal · Anticipated spend $500' && ag['v' + MTL2] === 'Montreal · Anticipated spend $125.50' && ag['v' + CANC] === 'Toronto · Cancelled · Anticipated spend $300' && ag.v23 === 'Montreal' && (await calLine(f)) === OCT, [ag, await calLine(f)]);
  await at(f, '#w124d2026-10-04'); await shot(f, 'cal-agenda-' + tag); await flatHere();
  await tap(f, '#w124cal [data-w124view="month"]'); await f.page.waitForTimeout(500);
  /* the layer off: no line */
  await tap(f, '#w124cal [data-w124layer="vol"]'); await f.page.waitForTimeout(250);
  const offL = await f.ev(() => !!document.querySelector('#w124cal .w124spend'));
  await tap(f, '#w124cal [data-w124layer="vol"]'); await f.page.waitForTimeout(250);
  ok(tag + ': with the Volunteering layer off, no line; on again, it is back', !offL && (await calLine(f)) === OCT, offL);
  /* a month with no spend */
  await calMonth(f, '2026-11');
  ok(tag + ': November (no event with a spend yet): nothing shows', (await f.ev(() => !document.querySelector('#w124cal .w124spend'))) && (await f.ev(() => document.querySelectorAll('#w124cal .w124ev[data-w124it^="v"]').length)) > 0, await calLine(f));

  /* ---------- Toronto: New event with a spend ---------- */
  await f.hash('#toronto', 2600);
  const nb = await newBtn(f);
  await f.page.click(nb); await f.page.waitForTimeout(500);
  const fld = await f.ev(() => {
    const i = document.getElementById('w274fb'); if (!i) return null;
    const ids = Array.from(document.querySelectorAll('#w274pane input, #w274pane textarea')).map(x => x.id);
    const lab = document.querySelector('#w274pane label[for="w274fb"]'), cur = i.parentNode.querySelector('span');
    const vh = lab && lab.querySelector('.w274vh');
    return { type: i.type, mode: i.getAttribute('inputmode'), label: lab ? lab.textContent : '', vh: vh ? vh.textContent + ':' + Math.round(vh.getBoundingClientRect().width) : '', cur: cur ? cur.textContent + ':' + cur.getAttribute('aria-hidden') : '', hint: (document.getElementById('w274fbh') || {}).textContent, desc: i.getAttribute('aria-describedby'), after: ids.indexOf('w274fb') === ids.indexOf('w274fm') + 1, value: i.value,
      pad: parseFloat(getComputedStyle(i).paddingLeft), curR: cur ? cur.getBoundingClientRect().right - i.getBoundingClientRect().left : 0 };
  });
  ok(tag + ': New event: Anticipated spend after Meals planned, a text field (decimal keyboard), the $ before it (decorative), the label says "in dollars", the hint',
    fld && fld.type === 'text' && fld.mode === 'decimal' && fld.label === 'Anticipated spend, in dollars (optional)' && fld.vh === ', in dollars:1' && fld.cur === '$:true' && fld.hint === 'Groceries and supplies you expect to pay for. It shows on the Hub calendar.' && fld.desc === 'w274fbe w274fbh' && fld.after && fld.value === '' && fld.curR < fld.pad, fld);
  await f.page.fill('#w274fd', '2026-11-22'); await f.page.fill('#w274fk', 'Ralph Thornton Community Centre');
  await f.page.fill('#w274fb', '12 dollars'); await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(300);
  let s = await sheet(f);
  const inv = () => f.ev(() => document.getElementById('w274fb').getAttribute('aria-invalid'));
  ok(tag + ': "12 dollars" is refused in words beside the field, nothing saved', s.open && s.spendErr === 'Anticipated spend is an amount in dollars, like 250 or 1,250.50.' && s.err === '' && (await inv()) === 'true' && (await writes(f, 'volunteer_events', 'insert')).length === 0 &&
    (await f.ev(() => { const e = document.getElementById('w274fbe'), i = document.getElementById('w274fb'); return e.offsetParent !== null && e.previousElementSibling === i.parentNode && e.getAttribute('aria-live') === 'polite'; })), s);
  await shot(f, 'newevent-refused-' + tag);
  await f.page.fill('#w274fb', '150000'); await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(300);
  s = await sheet(f);
  ok(tag + ': over 100,000 is refused in words too', s.open && s.spendErr === 'Anticipated spend can be up to $100,000.' && (await writes(f, 'volunteer_events', 'insert')).length === 0, s);
  await f.page.fill('#w274fb', '$1,250.50'); await shot(f, 'newevent-' + tag); await flatHere();
  await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(1600);
  const ins = await writes(f, 'volunteer_events', 'insert'), p0 = ins[0] && ins[0].payload, newId = ins[0] && ins[0].ids && ins[0].ids[0];
  ok(tag + ': Create writes the spend ($1,250.50 is 1250.5) with the Toronto event', ins.length === 1 && p0.budget === 1250.5 && p0.kind === 'meal' && p0.location === 'Toronto' && p0.event_date === '2026-11-22', ins);
  let sd = await spendDd(f);
  ok(tag + ': the new event’s Plan shows Anticipated spend $1,250.50', (await f.ev(() => location.hash)) === '#toronto/e/' + newId && sd && sd.dt === 'Anticipated spend' && sd.dd === '$1,250.50' && !sd.muted, sd);

  /* ---------- Toronto: Plan and Edit (TO-26-3 has none) ---------- */
  await f.hash('#toronto/e/' + EV.later, 2000);
  sd = await spendDd(f);
  ok(tag + ': Plan: the kitchen’s list says Anticipated spend Not set, in the muted style', sd && sd.dt === 'Anticipated spend' && sd.dd === 'Not set' && sd.muted, sd);
  const dlOk = await f.ev(() => { const dl = document.querySelector('#w274root [data-w274part="plan"] .w274dl'); return Array.from(dl.children).every(x => x.getBoundingClientRect().right <= dl.getBoundingClientRect().right + 0.5 && x.scrollWidth <= x.clientWidth + 1); });
  ok(tag + ': the list keeps every label and value inside the kitchen box', dlOk, null);
  await at(f, '#w274s-plan'); await shot(f, 'plan-notset-' + tag); await flatHere();
  const edit = async (v, name) => {
    await tap(f, '[data-w274edit]'); await f.page.waitForTimeout(450);
    const was = await f.ev(() => (document.getElementById('w274fb') || {}).value);
    await f.page.fill('#w274fb', v); if (name) await shot(f, name);
    await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(700);
    return was;
  };
  await f.ev(() => { const c = document.querySelector('#w274root [data-w274part="crew"]'); if (c) c.__w274b = 1; });
  let was = await edit('250');
  let u = (await writes(f, 'volunteer_events', 'update')).map(w => w.payload);
  const logs = () => f.ev(() => window.__REC.writes.filter(w => w.table === 'change_log').map(w => w.payload).filter(p => p.field === 'budget'));
  let lg = await logs();
  sd = await spendDd(f);
  ok(tag + ': Edit: 250 writes only the spend, through the audit trail', was === '' && u.length === 1 && JSON.stringify(u[0]) === JSON.stringify({ budget: 250 }) && lg.length === 1 && lg[0].entity_type === 'volunteer_event' && lg[0].entity_id === String(EV.later) && lg[0].old_value === null && lg[0].new_value === '250', [u, lg]);
  ok(tag + ': Plan shows $250, repainted in place (the rest of the page untouched), the sheet closed', sd && sd.dd === '$250' && !sd.muted && (await f.ev(() => (document.querySelector('#w274root [data-w274part="crew"]') || {}).__w274b === 1)) && !(await sheet(f)).open, sd);
  await shot(f, 'plan-set-' + tag);
  was = await edit('300.5', 'edit-' + tag);
  u = (await writes(f, 'volunteer_events', 'update')).map(w => w.payload); lg = await logs(); sd = await spendDd(f);
  ok(tag + ': Edit changes it: the field had 250, 300.5 is written, Plan says $300.50', was === '250' && u.length === 2 && JSON.stringify(u[1]) === JSON.stringify({ budget: 300.5 }) && lg.length === 2 && lg[1].old_value === '250' && lg[1].new_value === '300.5' && sd.dd === '$300.50', [was, u, lg, sd]);
  was = await edit('');
  u = (await writes(f, 'volunteer_events', 'update')).map(w => w.payload); lg = await logs(); sd = await spendDd(f);
  ok(tag + ': Edit clears it: empty writes null, Plan says Not set again', was === '300.50' && u.length === 3 && JSON.stringify(u[2]) === JSON.stringify({ budget: null }) && lg.length === 3 && lg[2].new_value === null && sd.dd === 'Not set' && sd.muted, [was, u, lg, sd]);
  /* an Edit of something else keeps the spend as it is (TO-26-2's $750 goes to $800 in the same save as nothing else) */
  await f.hash('#toronto/e/' + EV.next, 2000);
  was = await edit('800');
  u = (await writes(f, 'volunteer_events', 'update')).map(w => w.payload);
  ok(tag + ': TO-26-2: the field shows its $750 as 750, and 800 is written', was === '750' && JSON.stringify(u[3]) === JSON.stringify({ budget: 800 }) && (await spendDd(f)).dd === '$800', [was, u[3]]);
  await tap(f, '[data-w274edit]'); await f.page.waitForTimeout(450); await f.page.fill('#w274fm', '52'); await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(700);
  u = (await writes(f, 'volunteer_events', 'update')).map(w => w.payload);
  ok(tag + ': an Edit of the meals alone sends no budget', JSON.stringify(u[4]) === JSON.stringify({ planned_meals: 52 }) && (await spendDd(f)).dd === '$800', u[4]);

  /* ---------- the Calendar again: what Toronto saved ---------- */
  await calMonth(f, '2026-10');
  ok(tag + ': back on the Calendar, October follows: $1,425.50 (Toronto $800, Montreal $625.50)', (await calLine(f)) === 'Anticipated spend this month: $1,425.50 on 3 events (Toronto $800, Montreal $625.50)', await calLine(f));
  await calMonth(f, '2026-11');
  const nov = await item(f, 'v' + newId);
  ok(tag + ': November: the new event, one city, so no cities named: "Anticipated spend this month: $1,250.50 on 1 event"' + (phone ? '' : ', its tag $1.3K'),
    (await calLine(f)) === 'Anticipated spend this month: $1,250.50 on 1 event' && nov && /anticipated spend \$1,250\.50$/.test(nov.tip) && (phone ? !nov.shown : nov.shown && nov.tag === '$1.3K'), [await calLine(f), nov]);
  await f.ev(() => window.scrollTo(0, 0)); await shot(f, 'cal-november-' + tag); await flatHere();
  await calMonth(f, '2026-11', 'agenda');
  ok(tag + ': November’s agenda: the new event’s line', (await txt(f, '#w124cal .w124ag .w124row[data-w124it="v' + newId + '"] .mm')) === 'Toronto · Anticipated spend $1,250.50', await txt(f, '#w124cal .w124ag .w124row[data-w124it="v' + newId + '"]'));
  await f.ev(() => { try { localStorage.setItem('w124view', 'month'); } catch (e) {} });

  ok(tag + ': nothing scrolls sideways on any screen', wide, null);
  ok(tag + ': no page errors', f.errs.length === 0, f.errs);
  await f.close();
}
/* before wa274b_budget.sql: volunteer_events has no budget column */
async function fallback(browser, who, width) {
  const tag = 'without the column, ' + who + '@' + width, phone = width < 900;
  const fx = fixture(); fx.volunteer_events.forEach(e => { delete e.budget; });   /* the stub answers every field it has, whatever is asked: a table without the column has none */
  const f = await fresh(browser, { who: who, width: width, hash: '#mypage', fixture: fx, rpcs: RPCS(who), init: INIT(who), wait: 5200 });
  await f.ev(INSTALL, { nobudget: true });
  let wide = true; const flatHere = async () => { if (!(await flat(f))) wide = false; };
  await f.hash('#toronto', 2600);
  const t = await f.ev(() => { const S = window.w274.state(); return { ok: S.budgetOk, err: S.evErr, n: S.events.length, hero: (document.querySelector('#toronto .w274hero') || {}).getAttribute ? document.querySelector('#toronto .w274hero').getAttribute('data-w274ev') : null }; });
  ok(tag + ': Toronto loads its events (asked again without the budget)', t.ok === false && t.err === null && t.n === 4 && t.hero === String(EV.next), t);
  await f.page.click(await newBtn(f)); await f.page.waitForTimeout(500);
  let s = await sheet(f);
  ok(tag + ': New event has no Anticipated spend field and says nothing about it', s.open && s.title === 'New event' && !(await f.ev(() => !!document.getElementById('w274fb'))) && !/Anticipated spend|Hub calendar|in dollars/.test(s.text), s.text);
  await f.page.fill('#w274fd', '2026-12-06'); await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(1600);
  const ins = await writes(f, 'volunteer_events', 'insert');
  ok(tag + ': Create works and sends no budget', ins.length === 1 && !('budget' in ins[0].payload) && !ins[0].refused && /^#toronto\/e\//.test(await f.ev(() => location.hash)), ins);
  await f.hash('#toronto/e/' + EV.next, 2000);
  const sd = await spendDd(f);
  ok(tag + ': Plan says why: "Opens once the Toronto database update is applied."', sd && sd.dt === 'Anticipated spend' && sd.dd === 'Opens once the Toronto database update is applied.' && sd.muted, sd);
  await at(f, '#w274s-plan'); await shot(f, 'fallback-plan-' + who + '@' + width); await flatHere();
  await tap(f, '[data-w274edit]'); await f.page.waitForTimeout(450);
  s = await sheet(f);
  const noField = !(await f.ev(() => !!document.getElementById('w274fb'))) && !/Anticipated spend/.test(s.text);
  await f.page.fill('#w274fm', '45'); await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(700);
  const up = await writes(f, 'volunteer_events', 'update');
  ok(tag + ': Edit has no field either, and its save sends no budget', noField && up.length === 1 && JSON.stringify(up[0].payload) === JSON.stringify({ planned_meals: 45 }) && !(await sheet(f)).open, [noField, up]);
  ok(tag + ': nothing sent budget in a write (the database refused nothing written)', (await f.ev(() => window.__REC.writes.filter(w => w.table === 'volunteer_events' && (w.refused || JSON.stringify(w.payload || {}).indexOf('"budget"') >= 0)).length)) === 0, await writes(f, 'volunteer_events'));
  /* the Calendar */
  await calMonth(f, '2026-10');
  const cal = await f.ev(() => ({ ok: w124.state().budgetOk, line: !!document.querySelector('#w124cal .w124spend'), tags: document.querySelectorAll('#w124cal .w124amt').length, vol: w124.state().vol.filter(v => v.event_date >= '2026-10-01' && v.event_date < '2026-11-01').map(v => v.id).sort() }));
  const want = [23, MTL2, EV.next, CANC, EV.mtl].map(String).sort();
  ok(tag + ': the Calendar still shows every event (October’s five), with no line and no tags', cal.ok === false && !cal.line && cal.tags === 0 && JSON.stringify(cal.vol.map(String).sort()) === JSON.stringify(want), cal);
  await f.ev(() => window.scrollTo(0, 0)); await shot(f, 'fallback-cal-' + who + '@' + width); await flatHere();
  await calMonth(f, '2026-10', 'agenda');
  const rows = await f.ev(() => Array.from(document.querySelectorAll('#w124cal .w124ag .w124row[data-w124it^="v"]')).map(r => r.getAttribute('data-w124it').slice(1)).sort());
  ok(tag + ': October’s agenda lists all five', JSON.stringify(rows) === JSON.stringify(want), rows);
  await calMonth(f, '2026-12', 'month'); await calMonth(f, '2026-11', 'month');
  const asked = await f.ev(() => window.__REC.selects.filter(x => x.table === 'volunteer_events' && /^id, code, event_date/.test(x.cols)));
  ok(tag + ': the Calendar asked for the budget once, then never again in this page load (' + asked.length + ' reads)', asked.length >= 3 && asked.filter(x => /budget/.test(x.cols)).length === 1 && /budget/.test(asked[0].cols), asked);
  ok(tag + ': nothing scrolls sideways', wide, null);
  ok(tag + ': no page errors', f.errs.length === 0, f.errs);
  await f.ev(() => { try { localStorage.setItem('w124view', 'month'); } catch (e) {} });
  await f.close();
}

(async () => {
  const browser = await launch();
  try {
    for (const who of ['admin', 'plain']) for (const width of [1366, 390]) await run(browser, who, width);
    await fallback(browser, 'admin', 1366);
    await fallback(browser, 'plain', 390);
  } finally { await browser.close(); }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
