/* w191board.js: wave191l, the team board on a serving, offline against the candidate (CAND=build/<file>.html).
   Steel (01/10/26): "it tends to be a long list of servers, could you make that section shorter, and for long lists for one
   position just allow people to scroll instead". With 22 servers: the servers column stops (about four cards) and scrolls,
   its title stays on top while scrolling, "N more" shows at the bottom and goes at the end; short columns do not scroll;
   Add someone grows the column; the board is far shorter than the list; phone width; no page errors. */
const { launch, fresh } = require('./boot');
const fs = require('fs');
const fx191 = require('./w191fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }

function fixture() {
  const fx = fx191();
  const names = ['Van Ha Nguyen', 'Aman Sharma', 'Assyl Barada', 'Ali Sher', 'Jasleen Rivera', 'Navpreet Kaur', 'Lam Tung Ha', 'Fabienne Janvier', 'Manelle Boushaki', 'Rita Lopez', 'Omar Haddad', 'Chloe Martin',
    'Sami Benali', 'Ines Costa', 'Jonah Kim', 'Priya Nair', 'Leo Tremblay', 'Mia Roy', 'Noah Cote', 'Zara Ali', 'Ben Ortiz', 'Ada Novak'];
  const sts = ['Confirmed', 'Confirmed', 'Confirmed', 'TBD', 'Unavailable', 'Waiting For Response'];
  names.forEach((n, i) => fx.event_roster.push({ id: 9600 + i, event_id: 900, person_id: null, person_name: n, role: 'server', status: sts[i % sts.length], sort: 9600 + i, notes: i % 3 ? null : 'Might be available.', detail: { phone: '51455506' + String(10 + i) } }));
  return fx;
}
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0 } };
const col = (f, role) => f.ev(r => {
  const c = document.querySelector('#w119 .board .rc[data-w119role="' + r + '"]'); if (!c) return null;
  const h = c.querySelector(':scope > .h'); const m = c.querySelector(':scope > .w191more');
  return { cards: c.querySelectorAll(':scope > .pc').length, ch: c.clientHeight, sh: c.scrollHeight, st: c.scrollTop, top: Math.round(h.getBoundingClientRect().top - c.getBoundingClientRect().top),
    more: m ? m.textContent : null, moreShown: !!(m && getComputedStyle(m).display !== 'none'), ovf: getComputedStyle(c).overflowY };
}, role);

(async () => {
  const browser = await launch();
  try {
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS, width: 1440, wait: 5200 });
    await f.ev(() => { const t = document.getElementById('w191team'); if (t && !t.classList.contains('open')) t.querySelector('[data-w191team]').click(); });
    await f.page.waitForTimeout(500);
    let s = await col(f, 'server');
    ok('servers: 22+ cards in a column that stops and scrolls', s && s.cards >= 22 && s.ch <= 502 && s.sh > s.ch + 200 && s.ovf === 'auto', s);
    ok('servers: "N more" at the bottom', s && /^↓ \d+ more$/.test(s.more) && s.moreShown && Number(s.more.replace(/\D/g, '')) >= 15, s);
    const tl = await col(f, 'team_leader');
    ok('a short column does not scroll and has no hint', tl && tl.sh <= tl.ch + 6 && tl.more === null, tl);
    const board = await f.ev(() => Math.round(document.querySelector('#w119 .board').getBoundingClientRect().height));
    ok('the whole board is short (under 1,100 px for 22 servers)', board < 1100, board);
    if (SHOTS) { await f.ev(() => document.querySelector('#w119 .board').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(200); await (await f.page.$('#w191team')).screenshot({ path: SHOTS + '/board_top.png' }); }
    await f.ev(() => { const c = document.querySelector('#w119 .board .rc[data-w119role="server"]'); c.scrollTop = 400; c.dispatchEvent(new Event('scroll')); });
    await f.page.waitForTimeout(250);
    s = await col(f, 'server');
    ok('scrolling: the title stays on top of the column', s && s.st >= 390 && s.top >= -1 && s.top <= 1, s);
    await f.ev(() => { const c = document.querySelector('#w119 .board .rc[data-w119role="server"]'); c.scrollTop = c.scrollHeight; c.dispatchEvent(new Event('scroll')); });
    await f.page.waitForTimeout(250);
    s = await col(f, 'server');
    ok('at the end the hint goes', s && !s.moreShown, s);
    if (SHOTS) await (await f.page.$('#w119 .board')).screenshot({ path: SHOTS + '/board_scrolled.png' });
    await f.page.click('#w119 .board .rc[data-w119role="server"] [data-w119bench]'); await f.page.waitForTimeout(400);
    s = await col(f, 'server');
    ok('Add someone: the column grows to show the list', s && s.sh <= s.ch + 6 && s.ovf === 'visible', s);
    const errs = f.errs.slice(); await f.close();
    ok('no page errors', errs.length === 0, errs);

    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS, width: 390, wait: 5200 });
    await f.ev(() => { const t = document.getElementById('w191team'); if (t && !t.classList.contains('open')) t.querySelector('[data-w191team]').click(); });
    await f.page.waitForTimeout(500);
    s = await col(f, 'server');
    const over = await f.ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('phone: the servers column scrolls too, nothing scrolls sideways', s && s.sh > s.ch + 100 && s.ch <= 502 && over <= 1, { s, over });
    if (SHOTS) { await f.ev(() => document.querySelector('#w119 .board').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(200); await f.page.screenshot({ path: SHOTS + '/board_phone.png' }); }
    await f.close();
  } catch (e) { fail++; console.log('FAIL crashed :: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
