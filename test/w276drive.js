/* w276drive.js: wave276 team availability, offline against the candidate (CAND=build/<file>.html), with test/boot.js (stubbed Supabase,
   clock 25/09/26 16:00 Toronto) and test/w276fx.js (three made-up opsmtl members; the wa_avail_* RPCs answered and recorded in
   window.__REC.calls, db.functions.invoke recorded in window.__REC.invokes).
   Checks: the Home pop-up for a member (opens, the hour count, the under-minimum note, Save with 20 slots), never over another window
   (#w177pop), Ask me later (the snooze); the Agenda panel for a leader (placement, three best slots, "1 of 3 up to date since Tue 15 Sep"
   and the names on tap, "Times are Toronto time.", Propose then confirm sends meet_propose), a switch to #team/hr/agenda (the HR heading,
   wa_avail_team asked for hr, "1 of 2 entered" with no ask); a member on the Agenda sees no Propose and no Ask the team; a 375 px phone
   (the sheet sits on the bottom edge, no sideways scroll). A scenario whose pop-up or panel did not open records a FAIL and skips the
   steps that need it; anything thrown prints FAIL and exits non-zero.
   On Windows set WA_CHROME to Playwright's Chromium (boot.js defaults to a Linux path). SHOTS=<dir> saves screenshots. */
const { launch, fresh, WHO } = require('./boot');
const { fx276, replies276, INIT276, WHO276 } = require('./w276fx');
Object.assign(WHO, WHO276);
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
const SHOTS = process.env.SHOTS || ''; if (SHOTS) require('fs').mkdirSync(SHOTS, { recursive: true });
const shot = async (f, n) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png' }); };

const calls = (f, fn) => f.ev(n => window.__REC.calls.filter(c => c.fn === n), fn);
const invokes = f => f.ev(() => window.__REC.invokes);
const visible = (f, sel) => f.ev(s => { const e = document.querySelector(s); if (!e) return false; const c = getComputedStyle(e); return !e.hidden && c.display !== 'none' && c.visibility !== 'hidden' && e.getBoundingClientRect().width > 0; }, sel);
const cell = (di, min) => '#w276pop button.w276c[data-di="' + di + '"][data-min="' + min + '"]';
async function paint(f, di, mins) { for (const m of mins) await f.page.click(cell(di, m)); await f.page.waitForTimeout(150); }
const open = (who, hash, o) => fresh(o.browser, Object.assign({ who: who, hash: hash, fixture: fx276(), init: INIT276(replies276(o)), wait: o.wait || 1 }, o.width ? { width: o.width } : {}));
/* another window on Home: a visible #w177pop. wave177's own paint() removes a #w177pop it has nothing to show in (no meeting in this
   fixture), so the stand-in puts itself back whenever it is removed, as a real meeting pop-up would stay up until answered. */
const W177 = `document.addEventListener('DOMContentLoaded', function () {
  function put() { if (document.getElementById('w177pop')) return; var d = document.createElement('div'); d.id = 'w177pop'; d.setAttribute('role', 'dialog'); d.textContent = 'Another window'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:200px;height:80px;background:#fff;z-index:5;'; document.body.appendChild(d); window.__W177N = (window.__W177N || 0) + 1; }
  put(); window.__W177OBS = new MutationObserver(put); window.__W177OBS.observe(document.body, { childList: true });
});`;
const errsAll = [];

(async () => {
  const browser = await launch();
  try {
    /* ---------- 1. a member on Home, due for opsmtl: the pop-up, the count, the note, Save ---------- */
    let f = await open('sam', '#mypage', { browser, due: true });
    let up = true;
    try { await f.page.waitForSelector('#w276pop', { state: 'visible', timeout: 3000 }); } catch (e) { up = false; }
    ok('member: #w276pop visible within 3 s on Home', up, await f.ev(() => ({ hash: location.hash, ready: document.documentElement.classList.contains('wa-ready'), rec: window.__REC.calls.map(c => c.fn).filter(n => /avail/.test(n)) })));
    if (!up) ok('member: the pop-up steps (skipped: the pop-up did not open)', false);
    else {
      await shot(f, 'pop');
      const lead = await f.ev(() => (document.getElementById('w276lead') || {}).textContent || '');
      ok('member: the lead says "Times are Toronto time."', /Times are Toronto time\./.test(lead) && !/\u2014/.test(lead), lead);
      const mins8 = [480, 510, 540, 570, 600, 630, 660, 690];
      await paint(f, 0, mins8);
      let hrs = await f.ev(() => (document.getElementById('w276hours') || {}).textContent);
      ok('member: 8 cells -> "4 hours selected"', hrs === '4 hours selected', hrs);
      const note = await f.ev(() => (document.getElementById('w276note') || {}).textContent || '');
      ok('member: the note shows under the minimum and asks for at least 10 hours', (await visible(f, '#w276note')) && /at least 10 hours/.test(note), note);
      await paint(f, 1, [480, 510, 540, 570, 600, 630, 660, 690, 720, 750, 780, 810]);
      hrs = await f.ev(() => (document.getElementById('w276hours') || {}).textContent);
      ok('member: 12 more cells -> the note hidden (10 hours)', !(await visible(f, '#w276note')) && hrs === '10 hours selected', hrs);
      await f.page.click('#w276save'); await f.page.waitForTimeout(600);
      const sv = await calls(f, 'wa_avail_save');
      ok('member: Save sends wa_avail_save with 20 slots for opsmtl', sv.length === 1 && (sv[0].args.p_slots || []).length === 20 && sv[0].args.p_dept === 'opsmtl', sv);
      ok('member: the pop-up is gone after Save', !(await f.ev(() => !!document.getElementById('w276pop'))));
    }
    errsAll.push(...f.errs); await f.close();

    /* ---------- 2. due, but another window (#w177pop) is open: no pop-up ---------- */
    f = await fresh(browser, { who: 'sam', hash: '#mypage', fixture: fx276(), init: INIT276(replies276({ due: true })) + '\n' + W177, wait: 1 });
    await f.page.waitForTimeout(6000);
    const blocked = await f.ev(() => ({ pop: !!document.getElementById('w276pop'), w177: !!document.getElementById('w177pop'), ready: document.documentElement.classList.contains('wa-ready'), home: location.hash }));
    ok('member: with #w177pop open the pop-up does not open', blocked.w177 && blocked.ready && /^#mypage/.test(blocked.home) && !blocked.pop, blocked);
    await f.ev(() => { window.__W177OBS.disconnect(); const p = document.getElementById('w177pop'); if (p) p.remove(); });
    let later = true;
    try { await f.page.waitForSelector('#w276pop', { state: 'visible', timeout: 7000 }); } catch (e) { later = false; }
    ok('member: once that window closes, the pop-up opens on a later look', later);
    errsAll.push(...f.errs); await f.close();

    /* ---------- 3. Ask me later: the snooze ---------- */
    f = await open('sam', '#mypage', { browser, due: true });
    let up3 = true;
    try { await f.page.waitForSelector('#w276pop', { state: 'visible', timeout: 3000 }); } catch (e) { up3 = false; }
    if (!up3) ok('member: Ask me later (skipped: the pop-up did not open)', false);
    else {
      await f.page.click('#w276later'); await f.page.waitForTimeout(500);
      const sn = await calls(f, 'wa_avail_snooze');
      ok('member: Ask me later calls wa_avail_snooze for opsmtl and closes the pop-up', sn.length === 1 && sn[0].args.p_dept === 'opsmtl' && !(await f.ev(() => !!document.getElementById('w276pop'))), sn);
    }
    errsAll.push(...f.errs); await f.close();

    /* ---------- 4. a leader on the opsmtl Agenda ---------- */
    f = await open('ruth', '#team/opsmtl/agenda', { browser, manage: true, wait: 3800 });
    await f.page.waitForSelector('#w276panel #w276best', { timeout: 5000 }).catch(() => {});
    const pn = await f.ev(() => {
      const p = document.getElementById('w276panel'), h = document.getElementById('w116agHost');
      return { has: !!p, before: !!p && !!h && p.nextElementSibling === h, dept: p && p.getAttribute('data-dept'), best: document.querySelectorAll('#w276best li').length, st: ((p && p.querySelector('.st')) || {}).textContent || '', propose: document.querySelectorAll('[data-w276best]').length, ask: !!document.getElementById('w276ask'), help: ((p && p.querySelector('.map .help')) || {}).textContent || '' };
    });
    ok('leader: #w276panel sits right before #w116agHost, for opsmtl', pn.has && pn.before && pn.dept === 'opsmtl', pn);
    ok('leader: #w276best lists 3 slots', pn.best === 3, pn);
    ok('leader: status reads "1 of 3 up to date since Tue 15 Sep, 2 outstanding" (saved since the latest ask)', pn.st.trim() === '1 of 3 up to date since Tue 15 Sep, 2 outstanding', pn.st);
    ok('leader: the panel help says "Times are Toronto time."', /Times are Toronto time\./.test(pn.help), pn.help);
    ok('leader: Propose on each slot and Ask the team', pn.propose === 3 && pn.ask, pn);
    await shot(f, 'agenda-leader');
    if (await f.ev(() => !!document.getElementById('w276st'))) {
      await f.page.click('#w276st'); await f.page.waitForTimeout(150);
      const miss = await f.ev(() => { const m = document.getElementById('w276miss'); return { shown: !!m && !m.hidden, text: (m && m.textContent) || '' }; });
      ok('leader: the names on tap follow the same rule (Lina saved before the ask, Sam never)', miss.shown && miss.text === 'Not up to date since Tue 15 Sep: Lina Park, Sam Lee', miss);
    } else ok('leader: the names on tap (skipped: no status button)', false);
    if (pn.propose < 1) ok('leader: Propose and confirm (skipped: no Propose button)', false);
    else {
      await f.page.click('[data-w276best="0"]'); await f.page.waitForTimeout(300);
      const dlg = await visible(f, '#w276prop');
      ok('leader: Propose opens the confirm dialog', dlg);
      if (dlg) {
        await f.page.click('#w276psend'); await f.page.waitForTimeout(500);
        const inv = await invokes(f);
        const mp = inv.filter(c => c.name === 'notify' && c.body.event === 'meet_propose');
        ok('leader: confirm sends notify meet_propose for opsmtl', mp.length === 1 && mp[0].body.dept === 'opsmtl' && /^Monday 10:00 a\.m\. to 12:00 p\.m\.$/.test(mp[0].body.slot_label || '') && !(await f.ev(() => !!document.getElementById('w276prop'))), inv);
      }
    }

    /* ---------- 5. the same leader moves to the HR Agenda without a reload ---------- */
    await f.hash('#team/hr/agenda', 2500);
    const hr = await f.ev(() => { const p = document.getElementById('w276panel'); return { dept: p && p.getAttribute('data-dept'), k: ((p && p.querySelector('h3 .k')) || {}).textContent || '', st: ((p && p.querySelector('.st')) || {}).textContent || '', before: !!p && p.nextElementSibling === document.getElementById('w116agHost'), hash: location.hash }; });
    const th = await calls(f, 'wa_avail_team');
    ok('leader: #team/hr/agenda shows the HR heading', hr.dept === 'hr' && hr.k === 'Human Resources' && hr.before, hr);
    ok('leader: wa_avail_team was asked for hr', th.some(c => c.args.p_dept === 'hr'), th.map(c => c.args.p_dept));
    ok('leader: with no ask, the HR status reads "1 of 2 entered, 1 outstanding"', hr.st.trim() === '1 of 2 entered, 1 outstanding', hr.st);
    errsAll.push(...f.errs); await f.close();

    /* ---------- 6. a member on the Agenda: no manager buttons ---------- */
    f = await open('sam', '#team/opsmtl/agenda', { browser, manage: false, wait: 3800 });
    await f.page.waitForSelector('#w276panel #w276best', { timeout: 5000 }).catch(() => {});
    const mb = await f.ev(() => ({ panel: !!document.getElementById('w276panel'), best: document.querySelectorAll('#w276best li').length, propose: document.querySelectorAll('#w276panel [data-w276best]').length, ask: !!document.getElementById('w276ask'), mine: !!document.getElementById('w276mine'), words: Array.from(document.querySelectorAll('#w276panel button')).map(b => b.textContent) }));
    ok('member: the panel and its slots, but no Propose and no Ask the team', mb.panel && mb.best === 3 && mb.propose === 0 && !mb.ask && mb.mine && !mb.words.some(w => /Propose|Ask the team/.test(w)), mb);
    errsAll.push(...f.errs); await f.close();

    /* ---------- 7. a phone, 375 px ---------- */
    f = await open('sam', '#mypage', { browser, due: true, width: 375 });
    let pup = true;
    try { await f.page.waitForSelector('#w276pop', { state: 'visible', timeout: 3000 }); } catch (e) { pup = false; }
    await f.page.waitForTimeout(400);
    const ph = await f.ev(() => ({ bottom: document.getElementById('w276pop') && document.getElementById('w276pop').getBoundingClientRect().bottom, vh: window.innerHeight, sw: document.documentElement.scrollWidth }));
    ok('phone: the pop-up opens', pup, ph);
    ok('phone: #w276pop sits on the bottom edge', pup && ph.bottom >= ph.vh - 2, ph);
    ok('phone: no sideways scroll (scrollWidth <= 375)', ph.sw <= 375, ph);
    await shot(f, 'phone');
    errsAll.push(...f.errs); await f.close();

    ok('no page errors', errsAll.length === 0, errsAll);
  } finally { await browser.close(); }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('FAIL the drive stopped: ' + ((e && e.stack) || e));
  console.log(pass + ' passed, ' + (fail + 1) + ' failed');
  process.exit(1);
});
