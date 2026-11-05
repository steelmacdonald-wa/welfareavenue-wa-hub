/* w274drive.js: wave274, the Toronto Volunteers app, offline against the candidate (CAND=build/<file>.html).
   For admin and plain (a member on the opsto profile) at 1366 and 390 px: the launcher (Your apps for opsto); Events (the next
   event as the hero, the upcoming card, the folded past); New event (kind meal, location Toronto, a TO- code); the event page
   (four sections, the right stage); a recipient added; a status changed; Called; Copy; the WhatsApp link; people added
   (wa274_crew_add and its arguments); Take off the crew with Undo, then for real; Mark completed; Volunteers (Students, school,
   area, day; links to #crm/c/<id>); Montreal's Volunteer Manager without the Toronto events; reduced motion; no page errors,
   no sideways scroll. Then: the same adds before the SQL is applied (the fallbacks), and a board viewer (no Toronto app).
   Screenshots go to $WA_SHOTS (or $SHOTS) when set. */
const { launch, fresh } = require('./boot');
const fx274 = require('./w274fx');
const { EV, C } = fx274;
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
const SHOTS = process.env.WA_SHOTS || process.env.SHOTS || ''; if (SHOTS) require('fs').mkdirSync(SHOTS, { recursive: true });
const shot = async (f, n) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png' }); };
const EMAIL = { admin: 'steel.macdonald@welfareavenue.com', plain: 'joy.dumansi@welfareavenue.com' };
const RPCS = (who) => ({ wa_org_editor: who === 'admin', is_wa_admin: who === 'admin', is_wa_leader: false, wa_is_hr: false, is_wa_staff: who !== 'board' });
/* plain is a member on a team profile: here the Toronto team's (boot.js gives Joy the marketing one) */
const INIT = (who) => (who === 'plain' ? "window.__WAFIX.hub_roles.forEach(function (r) { if (r.email === 'joy.dumansi@welfareavenue.com') r.profile = 'opsto'; });" : '') +
  /* wave272's corner note (add the Hub as an app) counts as already seen twice, so it does not sit in the screenshots */
  "try { localStorage.setItem('wa272.tip', JSON.stringify({ n: 2, at: Date.now() })); } catch (e) {}";

/* records every write and rpc; with o.rpc it answers wa274_next_code and wa274_crew_add the way the SQL does; writes are applied
   to the fixture (ids for inserts), so a reload reads what was saved */
const INSTALL = (o) => {
  const FX = window.__WAFIX; let nextId = 880000;
  window.__REC = { writes: [], calls: [] };
  const r0 = db.rpc.bind(db), f0 = db.from.bind(db);
  const good = (d) => Promise.resolve({ data: d, error: null });
  db.rpc = function (fn, args) {
    window.__REC.calls.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    if (/^wa274_/.test(fn) && !o.rpc) return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + fn + ' in the schema cache' } });
    if (fn === 'wa274_next_code') return good('TO-26-4');
    if (fn === 'wa274_crew_add') {
      const c = (FX.crm_contacts || []).find(x => String(x.id) === String(args.p_contact));
      if (!c) return Promise.resolve({ data: null, error: { message: 'No such contact.' } });
      let vid = c.volunteer_id; if (vid == null) { vid = ++nextId; c.volunteer_id = vid; }
      const ex = (FX.event_roster || []).find(r => String(r.event_id) === String(args.p_event) && String(r.person_id) === String(vid));
      if (ex) return good({ ok: true, roster_id: ex.id, person_id: vid, already: true });
      const row = { id: ++nextId, event_id: args.p_event, person_id: vid, person_name: c.full_name, role: args.p_role, status: 'TBD', confirm_status: null, confirmed_at: null, notes: null, sort: 99, detail: { source: 'toronto', contact_id: c.id } };
      FX.event_roster.push(row);
      return good({ ok: true, roster_id: row.id, person_id: vid, already: false });
    }
    return r0(fn, args);
  };
  db.from = function (table) {
    const b = f0(table); let rec = null;
    ['insert', 'update', 'upsert', 'delete'].forEach(function (op) {
      const orig = b[op].bind(b);
      b[op] = function (payload) {
        rec = { table: table, op: op, payload: payload === undefined ? null : JSON.parse(JSON.stringify(payload)), eq: [] };
        window.__REC.writes.push(rec);
        if (op === 'insert' || op === 'upsert') (Array.isArray(payload) ? payload : [payload]).forEach(function (p) { if (p && p.id == null) p.id = ++nextId; rec.ids = (rec.ids || []).concat([p.id]); (FX[table] = FX[table] || []).push(JSON.parse(JSON.stringify(p))); });
        return orig(payload);
      };
    });
    const eq0 = b.eq.bind(b); b.eq = function (c, v) { if (rec) rec.eq.push([c, v]); return eq0(c, v); };
    const then0 = b.then.bind(b);
    b.then = function (a, c) {
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
const calls = (f, fn) => f.ev(n => window.__REC.calls.filter(c => c.fn === n), fn);
const flat = (f) => f.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const tap = (f, sel) => f.ev(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const txt = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText : null; }, sel);
const rail = (f) => f.ev(() => Array.from(document.querySelectorAll('#w153rail .w153it')).map(a => a.innerText.trim().split('\n')[0] + (a.classList.contains('on') ? '*' : '')));
const mast = (f) => f.ev(() => { const m = document.querySelector('#toronto > .w118mast'); return m ? { h1: m.querySelector('h1').textContent, p: (m.querySelector(':scope > p') || {}).textContent, back: !!m.querySelector('.w274back'), n: document.querySelectorAll('#toronto h1').length } : null; });
const sheet = (f) => f.ev(() => { const s = document.getElementById('w274sheet'); return { open: !!s && s.classList.contains('open'), title: (document.getElementById('w274sht') || {}).textContent || '', err: ((document.querySelector('#w274pane [data-w274err="sheet"]') || {}).textContent || '').trim(), focus: document.activeElement ? (document.activeElement.id || document.activeElement.getAttribute('data-w274x') || document.activeElement.className) : null }; });
const at = (f, sel) => f.ev(s => { const e = document.querySelector(s); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -16); } }, sel);
const newBtn = (f) => f.ev(() => { const p = document.querySelector('#toronto > .w118mast .w197pact[data-w197proxy="newevent"]'); if (p && p.offsetParent !== null) return '#toronto > .w118mast .w197pact[data-w197proxy="newevent"]'; const b = document.querySelector('#w153bar [data-w153act="newevent"]'); return b && b.offsetParent !== null ? '#w153bar [data-w153act="newevent"]' : null; });

async function run(browser, who, width) {
  const tag = who + '@' + width, phone = width < 900;
  const f = await fresh(browser, { who: who, width: width, hash: '#mypage', fixture: fx274(), rpcs: RPCS(who), init: INIT(who), wait: 5200 });
  await f.ev(INSTALL, { rpc: true });
  let wide = true; const flatHere = async () => { if (!(await flat(f))) wide = false; };

  /* ---------- the launcher ---------- */
  const L = await f.ev(() => { const Y = window.WA_APP.yours(); return { ok: window.WA_APP.ok('toronto'), yours: Y.yours, all: Y.all, home: !!document.querySelector('#w272apps [data-w272app="toronto"]'), tab: (wa40Allowed() || []).indexOf('toronto') >= 0 }; });
  ok(tag + ': Toronto Volunteers is one of the apps' + (who === 'plain' ? ', first under Your apps (opsto)' : '') + ', and on Home', L.ok && L.tab && L.yours.indexOf('toronto') >= 0 && (who !== 'plain' || (!L.all && L.yours[0] === 'toronto')) && L.home, L);
  if (!phone) {
    await tap(f, '#w153dock .w153grid'); await f.page.waitForTimeout(400);
    const pop = await f.ev(() => { const p = document.getElementById('w153pop'), hs = Array.from(p.querySelectorAll('.w153ph')).map(h => h.textContent), groups = Array.from(p.querySelectorAll('.w153tiles')).map(g => Array.from(g.querySelectorAll('.w153tile b')).map(b => b.textContent)); return { open: p.classList.contains('open'), hs, groups }; });
    ok(tag + ': the 9 dots list Toronto Volunteers' + (who === 'plain' ? ' under Your apps' : ' after the Volunteer Manager'), pop.open && (who === 'plain' ? pop.hs[0] === 'Your apps' && pop.groups[0].indexOf('Toronto Volunteers') >= 0 : pop.groups[0].indexOf('Toronto Volunteers') === pop.groups[0].indexOf('Volunteer Manager') + 1), pop);
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  }

  /* ---------- Events ---------- */
  await f.hash('#toronto', 2600);
  let m = await mast(f), r = await rail(f);
  ok(tag + ': #toronto opens the app (Events lit), titled Toronto events, one h1', (await f.ev(() => window.WA_APP.current())) === 'toronto' && r.join('|') === 'Events*|Volunteers' && m && m.h1 === 'Toronto events' && /Cook together, then bring the meals/.test(m.p) && m.n === 1, [r, m]);
  const hero = await f.ev(() => { const h = document.querySelector('#toronto .w274hero'); if (!h) return null; return { id: h.getAttribute('data-w274ev'), t: h.innerText, bars: h.querySelectorAll('.w274br').length, fills: Array.from(h.querySelectorAll('.w274bar i')).every(i => { const m = /scaleX\(([\d.]+)\)/.exec(i.style.transform); return !!m && Math.abs(Number(m[1]) - Number(i.getAttribute('data-x'))) < 0.001; }) }; });
  ok(tag + ': the hero is the next event: the date, in 9 days, the kitchen and its time, who the meals go to, 3 of 9 confirmed, a bar per crew, the stage',
    hero && hero.id === String(EV.next) && /Sun 4 Oct/.test(hero.t) && /In 9 days, at 10:00/.test(hero.t) && /Ralph Thornton Community Centre, 10:00 to 14:00/.test(hero.t) && /Meals for: Eva’s Initiatives for Homeless Youth \(40\)/.test(hero.t) && /3\s+of 9 confirmed/.test(hero.t) && hero.bars === 4 && /Crew/.test(hero.t) && hero.fills, hero);
  const up = await f.ev(() => Array.from(document.querySelectorAll('#toronto .w274grid .w274card')).map(c => [c.getAttribute('data-w274ev'), c.innerText.replace(/\s+/g, ' ')]));
  ok(tag + ': upcoming: one compact card for TO-26-3 (in 40 days, Plan)', up.length === 1 && up[0][0] === String(EV.later) && /Wed 4 Nov/.test(up[0][1]) && /In 40 days/.test(up[0][1]) && /Plan/.test(up[0][1]) && /0 of 10 confirmed/.test(up[0][1]), up);
  const past0 = await f.ev(() => { const b = document.querySelector('[data-w274past]'); const l = document.getElementById('w274pastl'); return b ? { t: b.textContent, ex: b.getAttribute('aria-expanded'), hidden: !!l && l.hidden } : null; });
  ok(tag + ': past events folded under "Past events (1)"', past0 && past0.t === 'Past events (1)' && past0.ex === 'false' && past0.hidden, past0);
  await shot(f, 'events-' + tag); await flatHere();
  await tap(f, '[data-w274past]'); await f.page.waitForTimeout(250);
  const past1 = await f.ev(() => Array.from(document.querySelectorAll('#w274pastl .w274prow')).map(a => a.innerText.replace(/\s+/g, ' ')));
  ok(tag + ': unfolded, the past event with its meals delivered (25 + 15)', past1.length === 1 && /Sun 23 Aug/.test(past1[0]) && /40 meals delivered/.test(past1[0]), past1);
  await at(f, '#w274hpast'); await shot(f, 'events-past-' + tag); await flatHere();

  /* ---------- New event ---------- */
  await f.ev(() => window.scrollTo(0, 0));
  const nb = await newBtn(f);
  ok(tag + ': New event is the page’s primary action (' + (phone ? 'the app bar' : 'the masthead') + ')', !!nb && (phone ? /w153bar/.test(nb) : /w118mast/.test(nb)) && (phone || (await f.ev(s => getComputedStyle(document.querySelector(s)).backgroundColor, nb)) === 'rgb(111, 100, 171)'), nb);
  await f.page.click(nb); await f.page.waitForTimeout(500);
  let s = await sheet(f);
  ok(tag + ': New event opens the sheet, the date first', s.open && s.title === 'New event' && s.focus === 'w274fd', s);
  await shot(f, 'newevent-' + tag);
  await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(300);
  s = await sheet(f);
  ok(tag + ': no date: said in words, nothing saved', s.open && s.err === 'Pick a date for the event.' && (await writes(f, 'volunteer_events', 'insert')).length === 0 && (await f.ev(() => document.getElementById('w274fd').getAttribute('aria-invalid'))) === 'true', s);
  await f.page.fill('#w274fd', '2026-11-22'); await f.page.fill('#w274fk', 'Ralph Thornton Community Centre'); await f.page.fill('#w274fs', '10:00 to 14:00'); await f.page.fill('#w274fm', '60');
  await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(1600);
  const ins = await writes(f, 'volunteer_events', 'insert'), nc = await calls(f, 'wa274_next_code');
  const p0 = ins[0] && ins[0].payload;
  ok(tag + ': Create inserts a Toronto event: kind meal, location Toronto, the TO- code from wa274_next_code', ins.length === 1 && p0.kind === 'meal' && p0.location === 'Toronto' && p0.code === 'TO-26-4' && p0.event_date === '2026-11-22' && p0.status === 'planned' && p0.start_time === '10:00' && p0.planned_meals === 60 && p0.title === 'Free meal event' && nc.length === 1 && nc[0].args.p_date === '2026-11-22', [ins, nc]);
  const newId = ins[0] && ins[0].ids && ins[0].ids[0];
  m = await mast(f); s = await sheet(f);
  ok(tag + ': Create opens the new event’s page (Plan, 58 days out)', (await f.ev(() => location.hash)) === '#toronto/e/' + newId && !s.open && m.h1 === 'Free meal event' && m.back && (await f.ev(() => (document.querySelector('.w274steps [aria-current="step"]') || {}).textContent)) === 'Plan', [await f.ev(() => location.hash), m, s]);

  /* ---------- the event page ---------- */
  await f.hash('#toronto/e/' + EV.next, 2600);
  const pg = await f.ev(() => ({ secs: Array.from(document.querySelectorAll('#w274root section.w274sec')).map(x => x.getAttribute('data-w274part')), cur: (document.querySelector('.w274steps [aria-current="step"]') || {}).textContent, curSec: (document.querySelector('#w274root .w274sec.cur') || {}).id, h2: Array.from(document.querySelectorAll('#w274root .w274sec h2')).map(h => h.textContent) }));
  ok(tag + ': the event page draws Plan, Crew, Confirm and Wrap up, and marks Crew (9 days out)', pg.secs.join(',') === 'plan,crew,confirm,wrap' && pg.cur === 'Crew' && pg.curSec === 'w274s-crew' && pg.h2.join(',') === 'Plan,Crew,Confirm,Wrap up', pg);
  const plan = await txt(f, '[data-w274part="plan"]');
  ok(tag + ': Plan: the kitchen card, who the meals go to with the dietary chips, 40 of 50 placed', /Ralph Thornton Community Centre/.test(plan) && /The front desk, ask for the kitchen lead/.test(plan) && /Halal/.test(plan) && /Nut-free/.test(plan) && /3 vegetarian/.test(plan) && /1 vegan/.test(plan) && /Drop-off: 12:30 at the side door/.test(plan) && /40 of 50 planned meals placed/.test(plan), plan);
  await f.ev(() => window.scrollTo(0, 0)); await shot(f, 'event-' + tag); await flatHere();
  for (const [id, want] of [[EV.later, 'Plan'], [EV.past, 'Wrap up']]) {
    await f.hash('#toronto/e/' + id, 1800);
    const st = await f.ev(() => ({ cur: (document.querySelector('.w274steps [aria-current="step"]') || {}).textContent, done: (document.querySelector('#w274root .w274done') || {}).textContent || '' }));
    ok(tag + ': TO-26-' + (id === EV.later ? '3 (40 days out) is in Plan' : '1 (completed) is in Wrap up, with its summary'), st.cur === want && (id !== EV.past || /40 meals delivered to 2 organizations\. 3 people came\./.test(st.done)), st);
  }
  await f.hash('#toronto/e/' + EV.next, 2200);

  /* who the meals go to: add one, not named publicly */
  await tap(f, '[data-w274rec="new"]'); await f.page.waitForTimeout(450);
  s = await sheet(f);
  ok(tag + ': Add an organization opens its sheet', s.open && s.title === 'Add an organization' && s.focus === 'w274rn', s);
  await f.page.fill('#w274rn', 'Fred Victor'); await f.page.fill('#w274rm', '10');
  await f.ev(() => { document.getElementById('w274rh').checked = true; document.getElementById('w274rp').checked = true; });
  await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(900);
  const ri = await writes(f, 'volunteer_event_recipients', 'insert');
  const rp = ri[0] && ri[0].payload;
  ok(tag + ': the organization is inserted with its meals, halal and not named publicly', ri.length === 1 && rp.event_id === EV.next && rp.name === 'Fred Victor' && rp.meals === 10 && rp.dietary && rp.dietary.halal === true && rp.private === true, ri);
  const plan2 = await txt(f, '[data-w274part="plan"]');
  ok(tag + ': Plan shows it with the lock, and 50 of 50 placed', /Fred Victor/.test(plan2) && /Not named publicly/.test(plan2) && /50 of 50 planned meals placed/.test(plan2) && !(await sheet(f)).open, plan2);

  /* a status changed through the person's menu */
  await at(f, '#w274s-crew');
  await tap(f, '[data-w274pm="27407"]'); await f.page.waitForTimeout(300);
  const menu = await f.ev(() => { const mm = document.getElementById('w274menu'); return { on: mm.classList.contains('on'), items: Array.from(mm.querySelectorAll('.w274mi')).map(b => b.textContent + (b.getAttribute('aria-checked') === 'true' ? '*' : '')), crm: (mm.querySelector('[data-w274mk="crm"]') || {}).getAttribute ? mm.querySelector('[data-w274mk="crm"]').getAttribute('href') : null }; });
  ok(tag + ': the person menu: Confirmed, Can’t come, Waiting (marked), Open in the CRM, Take off the crew', menu.on && menu.items.join('|') === 'Confirmed|Can’t come|Waiting*|Open in the CRM|Take off the crew' && menu.crm === '#crm/c/' + C.mei, menu);
  await shot(f, 'event-menu-' + tag);
  await tap(f, '#w274menu [data-w274mk="yes"]'); await f.page.waitForTimeout(700);
  let ru = (await writes(f, 'event_roster', 'update')).filter(w => w.eq.some(e => e[0] === 'id' && String(e[1]) === '27407'));
  ok(tag + ': Confirmed writes status Confirmed, confirm_status confirmed, confirmed_at', ru.length === 1 && ru[0].payload.status === 'Confirmed' && ru[0].payload.confirm_status === 'confirmed' && /^\d{4}-\d\d-\d\dT/.test(ru[0].payload.confirmed_at || ''), ru);
  const chip = await f.ev(() => Array.from(document.querySelectorAll('[data-w274chip="27407"] .w274chip')).map(c => c.textContent));
  ok(tag + ': the chip crossfades to Confirmed, and Confirm counts 4', chip.join('|') === 'Confirmed' && /4 confirmed/.test(await txt(f, '[data-w274cnts]')), [chip, await txt(f, '[data-w274cnts]')]);
  await shot(f, 'event-crew-' + tag); await flatHere();

  /* Confirm: Called, Copy, WhatsApp */
  await at(f, '#w274s-confirm');
  await tap(f, '[data-w274call="27409"]'); await f.page.waitForTimeout(600);
  ru = (await writes(f, 'event_roster', 'update')).filter(w => w.eq.some(e => e[0] === 'id' && String(e[1]) === '27409'));
  ok(tag + ': Called writes detail.called_at and called_by (the signed-in email), keeping the rest of detail', ru.length === 1 && /^\d{4}-/.test(ru[0].payload.detail.called_at || '') && ru[0].payload.detail.called_by === EMAIL[who] && ru[0].payload.detail.contact_id === C.lucia && (await f.ev(() => document.querySelector('[data-w274call="27409"]').getAttribute('aria-pressed'))) === 'true', ru);
  await tap(f, '[data-w274scope="wait"]'); await tap(f, '[data-w274copy="email"]'); await f.page.waitForTimeout(300);
  let cp = await f.ev(() => window.w274.state().lastCopy);
  ok(tag + ': Copy emails, only those waiting: Lucia and Noah', cp === 'lucia@example.com, noah@example.com', cp);
  await tap(f, '[data-w274scope="all"]'); await tap(f, '[data-w274copy="phone"]'); await f.page.waitForTimeout(300);
  cp = await f.ev(() => window.w274.state().lastCopy);
  ok(tag + ': Copy phone numbers, all the crew: six numbers', (cp || '').split(', ').length === 6 && /416-555-0001/.test(cp), cp);
  await tap(f, '[data-w274wa="edit"]'); await f.page.waitForTimeout(200);
  await f.page.fill('#w274wa', 'https://example.com/group'); await tap(f, '[data-w274wa="save"]'); await f.page.waitForTimeout(300);
  ok(tag + ': a link that is not WhatsApp’s is refused in words', /isn’t a WhatsApp group link/.test(await txt(f, '#w274wae')) && (await writes(f, 'volunteer_events', 'update')).length === 0, await txt(f, '#w274wae'));
  await f.page.fill('#w274wa', 'https://chat.whatsapp.com/AbCdEf123'); await tap(f, '[data-w274wa="save"]'); await f.page.waitForTimeout(600);
  const wu = await writes(f, 'volunteer_events', 'update');
  ok(tag + ': the WhatsApp group link is saved, and Open the group shows', wu.length === 1 && wu[0].payload.whatsapp_url === 'https://chat.whatsapp.com/AbCdEf123' && wu[0].eq[0][1] === EV.next && (await f.ev(() => !!document.querySelector('#w274s-confirm a[href="https://chat.whatsapp.com/AbCdEf123"]'))), wu);
  await shot(f, 'event-confirm-' + tag); await flatHere();

  /* Add people: the pool in a sheet, Students, the serving crew, two people */
  await at(f, '#w274s-crew');
  await tap(f, '[data-w274addp=""]'); await f.page.waitForTimeout(600);
  s = await sheet(f);
  ok(tag + ': Add people opens the picker with the search first', s.open && s.title === 'Add people to the crew' && s.focus === 'w274qk', s);
  await tap(f, 'label[for="w274roserver"]'); await tap(f, '[data-w274kind="students"][data-w274fs="k"]'); await f.page.waitForTimeout(250);
  const pk = await f.ev(() => Array.from(document.querySelectorAll('#w274pkl .w274pk')).map(l => l.querySelector('.w274pn').textContent + (l.classList.contains('dis') ? '(on)' : '')));
  ok(tag + ': the picker filters by Students (those already on the event shown, not pickable)', pk.join('|') === 'Ava Example|Jordan Example(on)|Kiran Example|Mei Example(on)', pk);
  await tap(f, '#w274pk' + C.ava); await tap(f, '#w274pk' + C.kiran); await f.page.waitForTimeout(150);
  ok(tag + ': the button says what it will do', (await txt(f, '#w274pkgo')) === 'Add 2 people to the serving crew', await txt(f, '#w274pkgo'));
  await shot(f, 'event-picker-' + tag);
  await tap(f, '#w274pkgo'); await f.page.waitForTimeout(1200);
  const ca = await calls(f, 'wa274_crew_add');
  ok(tag + ': each person goes through wa274_crew_add (event, contact, role)', ca.length === 2 && ca[0].args.p_event === EV.next && ca[0].args.p_contact === C.ava && ca[0].args.p_role === 'server' && ca[1].args.p_contact === C.kiran && ca[1].args.p_role === 'server', ca);
  const sv = await txt(f, '.w274col[data-w274role="server"]');
  ok(tag + ': both join the serving crew (Ava as a student), the sheet closes', !(await sheet(f)).open && /Ava Example/.test(sv) && /Kiran Example/.test(sv) && /TMU/.test(sv) && /4 of 3/.test(sv), sv);

  /* Take off the crew: Undo, then for real after 5 seconds */
  await tap(f, '[data-w274pm="27410"]'); await f.page.waitForTimeout(250); await tap(f, '#w274menu [data-w274mk="off"]'); await f.page.waitForTimeout(450);
  const sn = await f.ev(() => { const x = document.getElementById('w274snack'); return { on: x.classList.contains('on'), t: x.innerText }; });
  ok(tag + ': Take off the crew: the card goes, the note offers Undo', !(await f.ev(() => !!document.querySelector('[data-w274r="27410"]'))) && sn.on && /Theo Example is off the serving crew/.test(sn.t) && /Undo/.test(sn.t), sn);
  await tap(f, '#w274snack button'); await f.page.waitForTimeout(400);
  ok(tag + ': Undo puts Theo back, nothing deleted', (await f.ev(() => !!document.querySelector('[data-w274r="27410"]'))) && (await writes(f, 'event_roster', 'delete')).length === 0, await writes(f, 'event_roster', 'delete'));
  await tap(f, '[data-w274pm="27410"]'); await f.page.waitForTimeout(250); await tap(f, '#w274menu [data-w274mk="off"]'); await f.page.waitForTimeout(5600);
  const del = await writes(f, 'event_roster', 'delete');
  ok(tag + ': without Undo, the row is deleted after 5 seconds', del.length === 1 && String(del[0].eq[0][1]) === '27410' && !(await f.ev(() => !!document.querySelector('[data-w274r="27410"]'))), del);

  /* Wrap up: Mark this event completed (it is in 9 days: one more step) */
  await at(f, '#w274s-wrap');
  await shot(f, 'event-wrap-' + tag); await flatHere();
  await tap(f, '[data-w274done="ask"]'); await f.page.waitForTimeout(250);
  ok(tag + ': Mark completed asks first for an event still to come', /in 9 days\. Mark it completed now\?/.test(await txt(f, '[data-w274part="wrap"]')) && (await writes(f, 'volunteer_events', 'update')).length === 1, await txt(f, '[data-w274part="wrap"] .w274cfm'));
  await tap(f, '[data-w274done="yes"]'); await f.page.waitForTimeout(900);
  const cu = (await writes(f, 'volunteer_events', 'update')).filter(w => w.payload.status);
  const fin = await f.ev(() => ({ cur: (document.querySelector('.w274steps [aria-current="step"]') || {}).textContent, done: (document.querySelector('#w274root .w274done') || {}).textContent || '', chip: (document.querySelector('.w274ehl .w274chip') || {}).textContent }));
  ok(tag + ': completed: status completed is saved, the stage moves to Wrap up, the summary shows', cu.length === 1 && cu[0].payload.status === 'completed' && cu[0].eq[0][1] === EV.next && fin.cur === 'Wrap up' && /^Completed\./.test(fin.done) && fin.chip === 'Completed', [cu, fin]);
  await f.ev(() => window.scrollTo(0, 0)); await shot(f, 'event-completed-' + tag);

  /* ---------- Volunteers ---------- */
  await f.hash('#toronto/people', 2400);
  m = await mast(f); r = await rail(f);
  const names = () => f.ev(() => Array.from(document.querySelectorAll('#w274rows .w274row .w274pn')).map(x => x.textContent).sort());
  let nm = await names();
  ok(tag + ': Volunteers: Volunteers lit, the title with the count, the Toronto pool only (tags, a GTA city, a crew place; not merged, not Montreal)', r.join('|') === 'Events|Volunteers*' && m.h1 === 'Toronto volunteers 11' && nm.length === 11 && nm.indexOf('Noah Example') >= 0 && nm.indexOf('Zoe Example') >= 0 && nm.indexOf('Ethan Example') < 0 && nm.indexOf('Marc Example') < 0 && nm.indexOf('Lea Example') < 0, [r, m, nm]);
  const links = await f.ev(() => Array.from(document.querySelectorAll('#w274rows .w274row')).every(x => { const a = x.querySelector('a[href^="#crm/c/"]'); return a && a.getAttribute('href') === '#crm/c/' + x.getAttribute('data-w274cid'); }));
  ok(tag + ': every row opens its contact in the CRM (#crm/c/<id>)', links, null);
  await f.ev(() => window.scrollTo(0, 0)); await shot(f, 'people-' + tag); await flatHere();
  await tap(f, '[data-w274kind="students"][data-w274fs="p"]'); await f.page.waitForTimeout(200);
  nm = await names();
  ok(tag + ': Students', nm.join('|') === 'Ava Example|Jordan Example|Kiran Example|Mei Example', nm);
  await f.page.selectOption('select[data-w274fsel="school"][data-w274fs="p"]', '9001'); await f.page.waitForTimeout(200);
  nm = await names();
  ok(tag + ': Students at TMU', nm.join('|') === 'Jordan Example|Kiran Example' && /2 of 11 people/.test(await txt(f, '#w274pcount')), [nm, await txt(f, '#w274pcount')]);
  await tap(f, '[data-w274kind="all"][data-w274fs="p"]'); await f.page.selectOption('select[data-w274fsel="school"][data-w274fs="p"]', ''); await f.page.selectOption('select[data-w274fsel="area"][data-w274fs="p"]', 'Downtown Toronto'); await f.page.waitForTimeout(200);
  nm = await names();
  ok(tag + ': the area Downtown Toronto', nm.join('|') === 'Jordan Example|Priya Example|Rosa Example', nm);
  await f.page.selectOption('select[data-w274fsel="area"][data-w274fs="p"]', ''); await tap(f, '[data-w274day="6"][data-w274fs="p"]'); await f.page.waitForTimeout(200);
  nm = await names();
  ok(tag + ': the day Sun (lists, a sentence, Sun and Weekends all read)', nm.join('|') === 'Ava Example|Jordan Example|Kiran Example|Lucia Example|Mei Example|Priya Example|Zoe Example', nm);
  await f.page.fill('#w274qp', 'zzzz'); await f.page.waitForTimeout(400);
  const none = await txt(f, '#w274rows');
  ok(tag + ': an empty result says what to clear', /No one matches “zzzz” and Sun\./.test(none) && (await f.ev(() => !!document.querySelector('[data-w274clear="f"]') && !!document.querySelector('[data-w274clear="q"]'))), none);
  await tap(f, '[data-w274clear="f"]'); await f.page.waitForTimeout(150); await tap(f, '[data-w274clear="q"]'); await f.page.waitForTimeout(250);
  ok(tag + ': cleared, everyone is back', (await names()).length === 11 && (await f.ev(() => document.getElementById('w274qp').value)) === '', await names());
  await tap(f, '[data-w274to="' + C.zoe + '"]'); await f.page.waitForTimeout(450);
  s = await sheet(f);
  const te = await f.ev(() => Array.from(document.querySelectorAll('#w274pane .w274evp')).map(l => l.querySelector('.w274pn').textContent + (l.classList.contains('dis') ? '(on)' : '')));
  ok(tag + ': Add to an event: the upcoming Toronto events (the new one too) and a crew', s.open && s.title === 'Add Zoe Example to an event' && te.length === 2 && /Wed 4 Nov/.test(te[0]) && /Sun 22 Nov/.test(te[1]), [s, te]);
  await shot(f, 'people-toevent-' + tag);
  await tap(f, '#w274tego'); await f.page.waitForTimeout(900);
  const ca2 = (await calls(f, 'wa274_crew_add')).slice(2);
  ok(tag + ': Add to the crew calls wa274_crew_add for TO-26-3, the kitchen crew', ca2.length === 1 && ca2[0].args.p_event === EV.later && ca2[0].args.p_contact === C.zoe && ca2[0].args.p_role === 'cook' && !(await sheet(f)).open, ca2);

  /* ---------- Montreal does not see Toronto ---------- */
  await f.hash('#volunteering', 3200);
  const mtl = await f.ev(() => ({ evs: (typeof WA_VOL_EVENTS !== 'undefined' ? WA_VOL_EVENTS : []).map(e => e.id + ':' + e.kind + ':' + e.location), text: (document.getElementById('volunteering') || {}).innerText || '' }));
  ok(tag + ': #volunteering (Montreal) leaves the Toronto events out, keeps its own (WA-26-40 on the same day)', mtl.evs.length > 0 && !mtl.evs.some(x => /:meal:|Toronto/.test(x)) && mtl.evs.indexOf(EV.mtl + ':service:Montreal') >= 0 && !/TO-26-|Student cook night/.test(mtl.text), mtl.evs);

  /* ---------- reduced motion: sheets still open and close ---------- */
  await f.page.emulateMedia({ reducedMotion: 'reduce' });
  await f.hash('#toronto', 2000);
  const nb2 = await newBtn(f);
  await f.page.click(nb2); await f.page.waitForTimeout(450);
  const rm = await f.ev(() => { const p = document.getElementById('w274pane'), cs = getComputedStyle(p); return { open: document.getElementById('w274sheet').classList.contains('open'), tr: cs.transform, op: cs.opacity }; });
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(450);
  const rm2 = await f.ev(() => ({ open: document.getElementById('w274sheet').classList.contains('open'), vis: getComputedStyle(document.getElementById('w274sheet')).visibility, back: document.activeElement && (document.activeElement.getAttribute('data-w197proxy') || document.activeElement.getAttribute('data-w153act')) }));
  ok(tag + ': reduced motion: the sheet fades in without moving, Escape closes it, focus goes back to New event', rm.open && rm.tr === 'none' && rm.op === '1' && !rm2.open && rm2.vis === 'hidden' && rm2.back === 'newevent', [rm, rm2]);
  await f.page.emulateMedia({ reducedMotion: 'no-preference' });

  ok(tag + ': nothing scrolls sideways on any screen', wide, null);
  ok(tag + ': no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

/* before wa274_toronto.sql is applied: the code from the events, a person with a volunteer record straight onto the crew,
   a person without one said plainly */
async function fallbacks(browser) {
  const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#toronto/e/' + EV.next, fixture: fx274(), rpcs: RPCS('admin'), wait: 5200 });
  await f.ev(INSTALL, { rpc: false });
  await f.page.click('[data-w274addp="cook"]'); await f.page.waitForTimeout(600);
  await tap(f, '#w274pk' + C.ava); await tap(f, '#w274pk' + C.zoe); await tap(f, '#w274pkgo'); await f.page.waitForTimeout(1200);
  const ins = await writes(f, 'event_roster', 'insert'), s = await sheet(f);
  ok('before the SQL: Zoe (a volunteer record) goes straight onto the crew', ins.length === 1 && ins[0].payload.event_id === EV.next && ins[0].payload.person_id === 27110 && ins[0].payload.person_name === 'Zoe Example' && ins[0].payload.role === 'cook' && ins[0].payload.status === 'TBD' && ins[0].payload.detail.source === 'toronto' && ins[0].payload.detail.contact_id === C.zoe, ins);
  ok('before the SQL: Ava (no volunteer record) is said plainly, in the sheet', s.open && /Ava Example needs the wave274 database update first/.test(s.err) && /Zoe Example/.test(await txt(f, '.w274col[data-w274role="cook"]')), s);
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
  ok('Escape closes the sheet and focus returns to the button that opened it', !(await sheet(f)).open && (await f.ev(() => document.activeElement && document.activeElement.getAttribute('data-w274addp'))) === 'cook', await f.ev(() => document.activeElement && document.activeElement.outerHTML.slice(0, 120)));
  await f.ev(() => window.w274.newEvent()); await f.page.waitForTimeout(400);
  await f.page.fill('#w274fd', '2027-01-17'); await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(1400);
  const ev = await writes(f, 'volunteer_events', 'insert');
  ok('before the SQL: the code is worked out from the Toronto events (TO-27-1 for a 2027 date)', ev.length === 1 && ev[0].payload.code === 'TO-27-1' && ev[0].payload.kind === 'meal', ev);
  /* the recipients table missing: one quiet line, nothing else breaks */
  await f.ev(() => { window.w274.state().recOk = false; window.w274.paint(); });
  await f.hash('#toronto/e/' + EV.next, 1500);
  ok('without the recipients table: one quiet line in Plan', /Who the meals go to opens once the Toronto database update is applied/.test(await txt(f, '[data-w274part="plan"]')) && !(await f.ev(() => !!document.querySelector('[data-w274rec="new"]'))), await txt(f, '[data-w274part="plan"]'));
  ok('no page errors (before the SQL)', f.errs.length === 0, f.errs);
  await f.close();
}
/* the other edits, on a phone: Edit, the kitchen, the targets, removing an organization, meals delivered, Didn't come, Cancel */
async function edits(browser) {
  const f = await fresh(browser, { who: 'admin', width: 390, hash: '#toronto/e/' + EV.next, fixture: fx274(), rpcs: RPCS('admin'), init: INIT('admin'), wait: 5200 });
  await f.ev(INSTALL, { rpc: true });
  const evUpd = async () => (await writes(f, 'volunteer_events', 'update')).map(w => w.payload);
  await tap(f, '[data-w274edit]'); await f.page.waitForTimeout(450);
  ok('edits: Edit opens the same sheet, filled in', (await sheet(f)).title === 'Edit the event' && (await f.ev(() => document.getElementById('w274fd').value)) === '2026-10-04' && (await f.ev(() => document.getElementById('w274fm').value)) === '50', await sheet(f));
  await f.page.fill('#w274fti', 'Free meal event at Ralph Thornton'); await f.page.fill('#w274fm', '55'); await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(700);
  let u = await evUpd();
  const logs = (await writes(f, 'change_log', 'insert')).map(w => w.payload);
  ok('edits: Save writes only what changed, and the audit trail has both fields', u.length === 1 && JSON.stringify(Object.keys(u[0]).sort()) === '["planned_meals","title"]' && u[0].planned_meals === 55 && logs.some(l => l.entity_type === 'volunteer_event' && l.field === 'title' && l.old_value === 'Free meal event') && logs.some(l => l.field === 'planned_meals' && l.old_value === '50' && l.new_value === '55') && (await mast(f)).h1 === 'Free meal event at Ralph Thornton', [u, logs]);
  await tap(f, '[data-w274kit]'); await f.page.waitForTimeout(450);
  await f.page.fill('#w274kc', 'Kitchen lead at the front desk'); await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(600);
  u = await evUpd();
  ok('edits: the kitchen sheet saves the contact', u.length === 2 && JSON.stringify(u[1]) === JSON.stringify({ kitchen_contact: 'Kitchen lead at the front desk' }) && /Kitchen lead at the front desk/.test(await txt(f, '[data-w274part="plan"]')), u);
  await tap(f, '[data-w274tg]'); await f.page.waitForTimeout(450);
  ok('edits: the targets sheet starts from spot_counts and the defaults', (await f.ev(() => ['team_leader', 'cook', 'server', 'driver', 'photographer'].map(k => document.getElementById('w274t' + k).value).join(','))) === '1,4,3,1,0', null);
  await f.page.fill('#w274tphotographer', '1'); await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(600);
  u = await evUpd();
  ok('edits: the targets go to spot_counts, and Photos shows once it needs someone', u.length === 3 && u[2].spot_counts && u[2].spot_counts.photographer === 1 && u[2].spot_counts.server === 3 && (await f.ev(() => !!document.querySelector('.w274col[data-w274role="photographer"]'))), u[2]);
  await tap(f, '[data-w274recx="27501"]'); await f.page.waitForTimeout(250);
  ok('edits: Remove asks in place, Keep leaves it', /Remove Eva\u2019s Initiatives for Homeless Youth from this event\?/.test(await txt(f, '[data-w274part="plan"]')), await txt(f, '[data-w274part="plan"] .w274cfm'));
  await tap(f, '[data-w274recn="27501"]'); await f.page.waitForTimeout(200);
  await tap(f, '[data-w274recx="27501"]'); await f.page.waitForTimeout(200); await tap(f, '[data-w274recy="27501"]'); await f.page.waitForTimeout(600);
  const rd = await writes(f, 'volunteer_event_recipients', 'delete');
  ok('edits: Remove deletes the organization', rd.length === 1 && String(rd[0].eq[0][1]) === '27501' && /No organization yet/.test(await txt(f, '[data-w274part="plan"]')), rd);
  /* back with one: meals delivered */
  await tap(f, '[data-w274rec="new"]'); await f.page.waitForTimeout(400); await f.page.fill('#w274rn', 'St. Felix Centre'); await f.page.fill('#w274rm', '30'); await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(700);
  const rid = (await writes(f, 'volunteer_event_recipients', 'insert'))[0].ids[0];
  await f.page.fill('[data-w274md="' + rid + '"]', '28'); await tap(f, '[data-w274mdsave]'); await f.page.waitForTimeout(600);
  const md = (await writes(f, 'volunteer_event_recipients', 'update'));
  ok('edits: Save meals delivered writes meals_delivered', md.length === 1 && md[0].payload.meals_delivered === 28 && String(md[0].eq[0][1]) === String(rid) && /28 meals delivered in all/.test(await txt(f, '[data-w274part="wrap"]')), md);
  await tap(f, '[data-w274came="27405"][data-v="no"]'); await f.page.waitForTimeout(600);
  const dc = (await writes(f, 'event_roster', 'update')).filter(w => String(w.eq[0][1]) === '27405');
  ok('edits: Didn\u2019t come sets Unavailable and declined, the crew chip follows', dc.length === 1 && dc[0].payload.status === 'Unavailable' && dc[0].payload.confirm_status === 'declined' && (await f.ev(() => document.querySelector('[data-w274chip="27405"]').textContent)) === 'Can\u2019t come', dc);
  await tap(f, '[data-w274more]'); await f.page.waitForTimeout(250); await tap(f, '#w274menu [data-w274mk="cancel"]'); await f.page.waitForTimeout(450);
  ok('edits: Cancel this event asks first, Keep the event is the safe default', (await sheet(f)).title === 'Cancel this event?' && (await f.ev(() => document.activeElement && document.activeElement.getAttribute('data-w274keep'))) === '1', await sheet(f));
  await tap(f, '#w274f [type="submit"]'); await f.page.waitForTimeout(700);
  u = await evUpd();
  ok('edits: Cancel the event writes status cancelled; the page says so and Add people goes', u[u.length - 1].status === 'cancelled' && /This event was cancelled/.test(await txt(f, '#w274root')) && !(await f.ev(() => !!document.querySelector('[data-w274addp]'))), u[u.length - 1]);
  ok('edits: nothing sideways, no page errors', (await flat(f)) && f.errs.length === 0, f.errs);
  await f.close();
}
async function board(browser) {
  const f = await fresh(browser, { who: 'board', width: 1366, hash: '#mypage', fixture: fx274(), rpcs: RPCS('board'), wait: 5200 });
  const b = await f.ev(() => ({ tab: (wa40Allowed() || []).indexOf('toronto'), app: window.WA_APP ? window.WA_APP.ok('toronto') : false }));
  ok('a board viewer gets no Toronto Volunteers', b.tab < 0 && !b.app, b);
  ok('no page errors (board)', f.errs.length === 0, f.errs);
  await f.close();
}

(async () => {
  const browser = await launch();
  try {
    for (const who of ['admin', 'plain']) for (const width of [1366, 390]) await run(browser, who, width);
    await fallbacks(browser);
    await edits(browser);
    await board(browser);
  } finally { await browser.close(); }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
