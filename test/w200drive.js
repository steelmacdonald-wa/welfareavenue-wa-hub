/* w200drive.js: wave200, the team board on a serving and the Add people window, offline against the candidate (CAND=build/<file>.html).
   Steel (03/10/26), with screenshots of THE TEAM: "This is interface is really difficult to interact with, could you make it easier
   to work with? Also, all team members should be searchable as a volunteer. Also anyone for any position should be searchable for all
   positions."
   Checks: each column's count matches the team's pills; a card's Status and Role menus (the Role menu moves it); "+ Add", the empty
   column and a team pill open Add people for that role; the role chips switch; search spans every volunteer whatever their role,
   and every team member (by name, email, team); the tabs (Everyone, the role, Team members); adding a volunteer and a team member
   (a volunteer record is made for them first); the window stays open with Added and Undo; Enter adds the first match; Escape and
   Done close; people already on the serving say so; phone width; no page errors. SHOTS=<dir> saves screenshots. */
const { launch, fresh } = require('./boot');
const fs = require('fs');
const fx191 = require('./w191fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }

function fixture() {
  const fx = fx191();
  const ppl = [['Rita Lopez', ['server'], '5145550101', 'rita.lopez@example.com'], ['Omar Haddad', ['cook', 'server'], '5145550102', null], ['Chloe Martin', ['driver'], '5145550103', 'chloe@example.com'],
    ['Sami Benali', ['dishwasher'], '5145550104', null], ['Ines Costa', ['photographer'], null, 'ines.costa@example.com'], ['Jonah Kim', ['cook'], '5145550106', null],
    ['Priya Nair', [], '5145550107', null], ['Leo Tremblay', ['server'], '4385550108', 'leo.t@example.com'], ['Mia Roy', ['team_leader', 'server'], '5145550109', null]];
  ppl.forEach((x, i) => fx.volunteer_people.push({ id: 700 + i, full_name: x[0], roles: x[1], phones: x[2] ? [x[2]] : [], emails: x[3] ? [x[3]] : [], tags: i === 6 ? ['french'] : null, notes: null, needs_review: false, contact_id: 8700 + i, created_at: '2026-08-01T12:00:00Z' }));
  /* a team member who is already a volunteer (same email): shown once, as the volunteer, marked Team */
  const tm = (fx.team_members || []).filter(m => m.email)[0];
  if (tm) fx.volunteer_people.push({ id: 799, full_name: tm.name + ' Volunteer', roles: ['server'], phones: [], emails: [tm.email], tags: null, notes: null, needs_review: false, contact_id: 8799, created_at: '2026-08-01T12:00:00Z' });
  return fx;
}
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0 } };
/* the stub acknowledges writes without ids: give inserts an id (as the database does) and keep a log */
const INIT = `window.__W = []; (function wrap(){ var t = setInterval(function(){ try { if (typeof db === 'undefined' || !db || db.__w200) return; clearInterval(t); db.__w200 = true; var of = db.from.bind(db); var n = 90000;
  db.from = function (tb) { var b = of(tb); ['insert', 'update', 'delete'].forEach(function (op) { var f = b[op]; b[op] = function (p) { var pl = p; if (op === 'insert' && (tb === 'event_roster' || tb === 'volunteer_people')) { pl = Array.isArray(p) ? p.map(function (x) { return Object.assign({ id: ++n }, x); }) : Object.assign({ id: ++n }, p); } window.__W.push({ t: tb, op: op, p: pl }); return f.call(b, pl); }; }); var eq = b.eq; b.eq = function (c, v) { var last = window.__W[window.__W.length - 1]; if (last && last.t === tb && !last.eq) last.eq = [c, v]; return eq.call(b, c, v); }; return b; };
  } catch (e) {} }, 20); })();`;

const boardCounts = f => f.ev(() => {
  const out = {};
  document.querySelectorAll('#w119 .board .rc').forEach(c => { const r = c.getAttribute('data-w119role'); const n = c.querySelector(':scope > .h .n, :scope > .h .cnt'); out[r] = { head: n ? n.textContent.trim() : (c.querySelector(':scope > .h') || {}).textContent, cards: c.querySelectorAll(':scope > .pc:not(.gone)').length }; });
  const pills = {}; document.querySelectorAll('#w191team .w191line .pill').forEach(p => { const m = p.textContent.match(/^(.*?) (\d+)(?:\/(\d+))?$/); if (m) pills[m[1]] = m[2] + (m[3] ? '/' + m[3] : ''); });
  return { cols: out, pills };
});
const dlg = f => f.ev(() => {
  const d = document.getElementById('w200add'); if (!d) return null;
  const r = d.querySelector('.pan').getBoundingClientRect();
  return {
    role: (d.querySelector('.rchip.on') || {}).textContent, roleKey: (d.querySelector('.rchip.on') || { getAttribute: () => '' }).getAttribute('data-w200role'), q: d.querySelector('#w119bq').value, focus: document.activeElement && document.activeElement.id,
    rows: Array.prototype.map.call(d.querySelectorAll('.al .ar'), a => ({ name: a.querySelector('.who b').textContent, on: a.classList.contains('on'), onl: (a.querySelector('.onl') || {}).textContent || '', add: !!a.querySelector('[data-w200add]'), key: (a.querySelector('[data-w200add]') || { getAttribute: () => '' }).getAttribute('data-w200add'), meta: (a.querySelector('.meta') || {}).textContent || '' })),
    tab: (d.querySelector('.tab.on') || {}).textContent, cnt: (d.querySelector('.tabs .cnt') || {}).textContent, just: (d.querySelector('.just') || {}).textContent || '', foot: d.querySelector('.pf span').textContent,
    w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), vw: innerWidth, vh: innerHeight, lock: document.documentElement.classList.contains('w200lock')
  };
});
const type = async (f, s) => { await f.page.fill('#w119bq', ''); await f.page.type('#w119bq', s, { delay: 10 }); await f.page.waitForTimeout(150); };

(async () => {
  const browser = await launch();
  try {
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS, width: 1440, wait: 5200, init: INIT });
    await f.ev(() => { const t = document.getElementById('w191team'); if (t && !t.classList.contains('open')) t.querySelector('[data-w191team]').click(); });
    await f.page.waitForTimeout(500);
    if (SHOTS) { await f.ev(() => document.querySelector('#w191team').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(200); await (await f.page.$('#w191team')).screenshot({ path: SHOTS + '/board.png' }); }

    /* 1. the counts on the board match the team's pills */
    let bc = await boardCounts(f);
    const lab = await f.ev(() => { const o = {}; document.querySelectorAll('#w119 .board .rc').forEach(c => { o[c.getAttribute('data-w119role')] = (c.querySelector(':scope > .h b, :scope > .h h5, :scope > .h span') || {}).textContent; }); return o; });
    const heads = await f.ev(() => Array.prototype.map.call(document.querySelectorAll('#w119 .board .rc'), c => ({ role: c.getAttribute('data-w119role'), text: c.querySelector(':scope > .h').textContent.replace(/\s+/g, ' ').trim() })));
    const pillsOk = heads.every(h => { const label = Object.keys(bc.pills).filter(k => h.text.indexOf(k) === 0)[0]; return !label || h.text.indexOf(bc.pills[label]) >= 0; });
    ok('board: each column counts the same as its team pill', pillsOk && Object.keys(bc.pills).length >= 4, { heads, pills: bc.pills });
    const tlHead = heads.filter(h => h.role === 'team_leader')[0];
    ok('board: team leaders 1/1 (was 0/2 against a 1/1 pill)', tlHead && /1\/1/.test(tlHead.text), tlHead);
    const sub = await f.ev(() => (document.querySelector('#w119 .board .rc[data-w119role="server"] .sub') || {}).textContent || '');
    ok('board: a column says how many are confirmed and how many more are needed', /confirmed/.test(sub) && /more needed|full/i.test(sub), sub);

    /* 2. a card: Status and Role menus, readable status names */
    const card = await f.ev(() => { const c = document.querySelector('#w119 .board .rc[data-w119role="server"] .pc'); if (!c) return null; const st = c.querySelector('select[data-vlrstat]'), ro = c.querySelector('select[data-w119mv]'); const r = c.getBoundingClientRect();
      return { name: (c.querySelector('b, .nm') || {}).textContent, st: st && st.options[st.selectedIndex].text, stv: st && st.value, roles: ro && Array.prototype.map.call(ro.options, o => o.value), rolev: ro && ro.value, rolet: ro && ro.options[ro.selectedIndex].text, roW: ro && Math.round(ro.getBoundingClientRect().width), w: Math.round(r.width), stW: st && Math.round(st.getBoundingClientRect().width), clip: st && st.scrollWidth > st.clientWidth + 2 }; });
    ok('card: has a Status menu and a Move menu (to every other role)', card && card.st && card.rolet === 'Move' && card.rolev === '' && card.roles.indexOf('cook') >= 0 && card.roles.indexOf('server') < 0, card);
    ok('card: a column wide enough to read (cards 220px or more)', card && card.w >= 220, card);
    ok('card: the status reads in full ("Waiting", not "Waiting For Resp"), in a menu 120px or wider', card && card.st === 'Waiting' && card.stv === 'Waiting For Response' && card.stW >= 120, card);
    const clipped = await f.ev(() => { const cv = document.createElement('canvas').getContext('2d'); return Array.prototype.map.call(document.querySelectorAll('#w119 .board .pc .sel2 select'), s => { const cs = getComputedStyle(s); cv.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; const t = s.options[s.selectedIndex].text; return { t, need: Math.ceil(cv.measureText(t).width), room: s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) }; }).filter(x => x.need > x.room); });
    ok('card: no status or Move menu cuts its words off', clipped.length === 0, clipped);
    const eriana = await f.ev(() => { const s = Array.prototype.filter.call(document.querySelectorAll('#w119 .board .pc'), c => /Eriana/.test(c.textContent))[0]; return s ? s.querySelector('select[data-w119mv]').getAttribute('data-w119mv') : null; });
    await f.page.selectOption('#w119 .board select[data-w119mv="' + eriana + '"]', 'cook'); await f.page.waitForTimeout(400);
    const moved = await f.ev(id => { const c = document.querySelector('#w119 .board .rc[data-w119role="cook"]'); return { inCook: !!(c && /Eriana/.test(c.textContent)), w: window.__W.filter(w => w.t === 'event_roster' && w.op === 'update').map(w => w.p) }; }, eriana);
    ok('card: the Role menu moves the person to that column (one update)', moved.inCook && moved.w.some(p => p.role === 'cook'), moved);

    /* 3. "+ Add" opens Add people for that role */
    await f.page.click('#w119 .board .rc[data-w119role="server"] .h [data-w119bench]'); await f.page.waitForTimeout(500);
    let d = await dlg(f);
    ok('add: "+ Add" on Servers opens the window for servers, search focused', d && /Servers/.test(d.role) && d.focus === 'w119bq' && d.lock, d && { role: d.role, focus: d.focus });
    ok('add: a roomy window in the middle of a computer screen', d && d.w >= 560 && d.w <= 760 && Math.abs(d.x + d.w / 2 - d.vw / 2) < 4, d && { w: d.w, x: d.x });
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/add_open.png' });
    const names = d.rows.map(r => r.name);
    ok('add: everyone is listed, whatever their role (cooks, drivers, no role yet)', ['Omar Haddad', 'Chloe Martin', 'Sami Benali', 'Priya Nair'].every(n => names.indexOf(n) >= 0), names.slice(0, 30));
    ok('add: team members are listed too', d.rows.some(r => /Team/.test(r.meta)) && d.rows.some(r => /^m\d+$/.test(r.key)), d.rows.filter(r => /Team/.test(r.meta)).slice(0, 4));
    const firstOn = d.rows.findIndex(r => r.on), lastFree = d.rows.map(r => r.on).lastIndexOf(false);
    ok('add: servers come first, people already on the serving at the end', d.rows[0] && /Server/.test(d.rows[0].meta) && (firstOn < 0 || firstOn > lastFree), d.rows.slice(0, 5));
    const onRow = d.rows.filter(r => r.on)[0];
    ok('add: someone already on this serving says so, with no Add', !onRow || (/On this serving/.test(onRow.onl) && !onRow.add), onRow);

    /* 4. search across every role and the team */
    await type(f, 'chloe'); d = await dlg(f);
    ok('search: a driver is found from the servers window', d.rows.length === 1 && d.rows[0].name === 'Chloe Martin', d.rows);
    await type(f, '0104'); d = await dlg(f);
    ok('search: by phone digits', d.rows.some(r => r.name === 'Sami Benali'), d.rows);
    await type(f, 'photographer'); d = await dlg(f);
    ok('search: by role name', d.rows.some(r => r.name === 'Ines Costa'), d.rows);
    await type(f, 'french'); d = await dlg(f);
    ok('search: by tag', d.rows.some(r => r.name === 'Priya Nair'), d.rows);
    const tmOnly = await f.ev(() => { const m = (DB_MEMBERS || []).filter(x => x.active !== false && x.email && !(WA_VOL_PEOPLE || []).some(p => (p.emails || []).map(e => e.toLowerCase()).indexOf(x.email.toLowerCase()) >= 0 || (p.full_name || '').toLowerCase().indexOf(x.name.toLowerCase()) >= 0))[0]; return m && { name: m.name, email: m.email, id: m.id, dept: m.department }; });
    await type(f, tmOnly.name); d = await dlg(f);
    ok('search: a team member by name', d.rows.some(r => r.key === 'm' + tmOnly.id && /Team/.test(r.meta)), { tmOnly, rows: d.rows });
    const ahmed = await f.ev(() => { const p = (WA_VOL_PEOPLE || []).filter(x => !(x.emails || []).length && (DB_MEMBERS || []).some(m => m.name.toLowerCase() === (x.full_name || '').toLowerCase()))[0]; return p ? { id: p.id, name: p.full_name } : null; });
    if (ahmed) { await type(f, ahmed.name); d = await dlg(f); ok('search: a volunteer with no email and a team member of the same name shows once, marked Team', d.rows.filter(r => r.name === ahmed.name).length === 1 && /Team/.test(d.rows.filter(r => r.name === ahmed.name)[0].meta), d.rows); }
    await type(f, tmOnly.email.split('@')[0]); d = await dlg(f);
    ok('search: a team member by email', d.rows.some(r => r.key === 'm' + tmOnly.id), d.rows);
    const dup = await f.ev(() => { const p = (WA_VOL_PEOPLE || []).filter(x => x.id === 799)[0]; return p ? p.emails[0] : null; });
    if (dup) { await type(f, dup.split('@')[0]); d = await dlg(f); ok('search: a team member who is also a volunteer shows once, as the volunteer, marked Team', d.rows.length === 1 && d.rows[0].key === '799' && /Team/.test(d.rows[0].meta), d.rows); }

    /* 5. tabs */
    await type(f, ''); await f.page.click('#w200add [data-w200tab="role"]'); await f.page.waitForTimeout(200); d = await dlg(f);
    ok('tabs: the role tab keeps people listed as servers only', d.rows.length > 0 && d.rows.every(r => /Server/.test(r.meta)) && /Servers/.test(d.tab), d.rows.map(r => r.name + ':' + r.meta));
    await f.page.click('#w200add [data-w200tab="team"]'); await f.page.waitForTimeout(200); d = await dlg(f);
    ok('tabs: Team members keeps the team only', d.rows.length >= 10 && d.rows.every(r => /Team/.test(r.meta)), d.rows.slice(0, 3));
    await f.page.click('#w200add [data-w200tab="all"]'); await f.page.waitForTimeout(200);

    /* 6. role chips switch the role */
    await f.page.click('#w200add [data-w200role="cook"]'); await f.page.waitForTimeout(200); d = await dlg(f);
    ok('chips: Cooks makes it Add as cook, cooks first', /Cooks/.test(d.role) && d.rows[0] && /Cook/.test(d.rows[0].meta), { role: d.role, first: d.rows[0] });
    await f.page.click('#w200add [data-w200role="server"]'); await f.page.waitForTimeout(200);

    /* 7. add a volunteer whose role is not server: stays open, shows Added, board grows */
    await type(f, 'chloe'); await f.page.click('#w200add [data-w200add="702"]'); await f.page.waitForTimeout(500); d = await dlg(f);
    let w = await f.ev(() => window.__W.filter(x => x.t === 'event_roster' && x.op === 'insert').map(x => x.p));
    ok('add: Chloe (a driver) added as a server, one roster row', w.length === 1 && w[0].person_id === 702 && w[0].role === 'server' && w[0].event_id === 900, w);
    ok('add: the window stays open, search cleared and focused, Added shows her with Undo', d && d.q === '' && d.focus === 'w119bq' && /Chloe Martin/.test(d.just) && /Undo/.test(d.just), d && { q: d.q, focus: d.focus, just: d.just });
    const chloeRow = d.rows.filter(r => r.name === 'Chloe Martin')[0];
    ok('add: she now reads On this serving: Server', chloeRow && chloeRow.on && /Server/.test(chloeRow.onl), chloeRow);
    bc = await boardCounts(f);
    const sv = await f.ev(() => /Chloe Martin/.test((document.querySelector('#w119 .board .rc[data-w119role="server"]') || {}).textContent || ''));
    ok('add: the board behind shows her in Servers', sv);
    const pillSv = await f.ev(() => (Array.prototype.filter.call(document.querySelectorAll('#w191team .w191line .pill'), p => /^Servers/.test(p.textContent))[0] || {}).textContent);
    ok('add: the team pill counts her', /Servers 2/.test(pillSv || ''), pillSv);

    /* 8. Undo */
    await f.page.click('#w200add [data-w200undo]'); await f.page.waitForTimeout(400); d = await dlg(f);
    w = await f.ev(() => window.__W.filter(x => x.t === 'event_roster' && x.op === 'delete'));
    ok('undo: deletes that row and she is free again', w.length === 1 && d.rows.some(r => r.name === 'Chloe Martin' && !r.on) && !/Chloe/.test(d.just), { w, just: d.just });

    /* 9. add a team member: their volunteer record first, then the roster */
    await type(f, tmOnly.name); d = await dlg(f);
    await f.page.click('#w200add [data-w200add="m' + tmOnly.id + '"]'); await f.page.waitForTimeout(600);
    w = await f.ev(() => window.__W.filter(x => x.op === 'insert').map(x => ({ t: x.t, p: x.p })));
    const vp = w.filter(x => x.t === 'volunteer_people')[0], er = w.filter(x => x.t === 'event_roster').slice(-1)[0];
    ok('team member: a volunteer record is made with their name and email', vp && vp.p.full_name === tmOnly.name && vp.p.emails[0] === tmOnly.email, vp);
    ok('team member: then added to the serving under that record', er && vp && er.p.person_id === vp.p.id && er.p.person_name === tmOnly.name, er);
    d = await dlg(f);
    const tmRows = d.rows.filter(r => r.name === tmOnly.name);
    await type(f, tmOnly.name); d = await dlg(f);
    ok('team member: now listed once, as a volunteer on this serving', d.rows.filter(r => r.name === tmOnly.name).length === 1 && d.rows.filter(r => r.name === tmOnly.name)[0].on, d.rows);

    /* 10. Enter adds the first match that is free */
    await type(f, 'sami'); d = await dlg(f);
    ok('enter: the footer says who Enter adds', /Enter adds Sami Benali/.test(d.foot), d.foot);
    await f.page.press('#w119bq', 'Enter'); await f.page.waitForTimeout(500);
    w = await f.ev(() => window.__W.filter(x => x.t === 'event_roster' && x.op === 'insert').map(x => x.p.person_name));
    ok('enter: adds Sami', w.indexOf('Sami Benali') >= 0, w);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/add_after.png' });

    /* 11. Escape closes; Done closes */
    await f.page.press('#w119bq', 'Escape'); await f.page.waitForTimeout(200);
    ok('escape: closes the window and unlocks the page', !(await dlg(f)) && !(await f.ev(() => document.documentElement.classList.contains('w200lock'))));
    await f.page.click('#w119 .board .rc[data-w119role="cook"] .h [data-w119bench]'); await f.page.waitForTimeout(300);
    d = await dlg(f); ok('reopen: a fresh window (no old Added, no old search)', d && d.just === '' && d.q === '' && /Cooks/.test(d.role), d && { just: d.just, q: d.q });
    await f.page.click('#w200add .done'); await f.page.waitForTimeout(200);
    ok('done: closes', !(await dlg(f)));

    /* 12. the empty column and the team pills open it too */
    const emptyRole = await f.ev(() => { const b = document.querySelector('#w119 .board button.empty[data-w119bench]'); return b ? b.getAttribute('data-w119bench') : null; });
    if (emptyRole) { await f.page.click('#w119 .board button.empty[data-w119bench="' + emptyRole + '"]'); await f.page.waitForTimeout(300); d = await dlg(f); ok('empty column: its button opens Add people for that role', d && d.roleKey === emptyRole, { emptyRole, role: d && d.role }); await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200); }
    const pillBtn = await f.ev(() => { const b = document.querySelector('#w191team .w191line button.pill[data-w119bench="driver"]'); return !!b; });
    ok('team pills are buttons for staff', pillBtn);
    await f.page.click('#w191team .w191line button.pill[data-w119bench="driver"]'); await f.page.waitForTimeout(300); d = await dlg(f);
    ok('team pill: Drivers opens Add people as driver', d && /Drivers/.test(d.role), d && d.role);
    await f.page.click('#w200add', { position: { x: 5, y: 5 } }); await f.page.waitForTimeout(200);
    ok('backdrop: a click outside the window closes it', !(await dlg(f)));
    ok('no page errors (computer)', f.errs.length === 0, f.errs);
    await f.close();

    /* 13. phone */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS, width: 390, wait: 5200, init: INIT });
    await f.ev(() => { const t = document.getElementById('w191team'); if (t && !t.classList.contains('open')) t.querySelector('[data-w191team]').click(); });
    await f.page.waitForTimeout(400);
    const pw = await f.ev(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
    ok('phone: no sideways scroll', pw.sw <= pw.vw + 1, pw);
    if (SHOTS) { await f.ev(() => document.querySelector('#w119 .board').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(200); await f.page.screenshot({ path: SHOTS + '/phone_board.png' }); }
    await f.ev(() => document.querySelector('#w119 .board .rc[data-w119role="server"] .h [data-w119bench]').scrollIntoView({ block: 'center' }));
    await f.page.tap('#w119 .board .rc[data-w119role="server"] .h [data-w119bench]'); await f.page.waitForTimeout(500);
    d = await dlg(f);
    ok('phone: Add people fills the screen', d && d.w >= 386 && d.h >= 700, d && { w: d.w, h: d.h });
    const chipsP = await f.ev(() => { const rc = document.querySelector('#w200add .rchips'), on = rc.querySelector('.rchip.on'); const a = rc.getBoundingClientRect(), b = on.getBoundingClientRect(); return { rcH: Math.round(a.height), chipH: Math.round(b.height), inView: b.left >= a.left - 1 && b.right <= a.right + 1 }; });
    ok('phone: the role chips are not squashed and the chosen one is in view', chipsP.rcH >= chipsP.chipH && chipsP.inView, chipsP);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/phone_add.png' });
    await f.page.tap('#w200add .done'); await f.page.waitForTimeout(200);
    ok('phone: Done closes', !(await dlg(f)));
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();

  } catch (e) { fail++; console.log('FAIL exception ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
