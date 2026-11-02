/* w272drive.js: the new Home. For each identity on a computer and a phone: nothing the old Home held is gone, the new parts
   draw, nothing throws. Screenshots go to WA_SHOTS when it is set. */
const fs = require('fs'), path = require('path');
const { launch, fresh } = require('./boot');
const SHOTS = process.env.WA_SHOTS;
let fails = 0, passes = 0;
function ok(c, m) { if (c) passes++; else { fails++; console.log('FAIL ' + m); } }
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await launch();
  for (const who of (process.env.WA_WHO || 'admin,leader,plain,member').split(',')) {
    for (const width of [1366, 390]) {
      const f = await fresh(browser, { who, width, hash: '#mypage' });
      const tag = who + '@' + width;
      await wait(3500);
      const s = await f.ev(() => {
        const q = x => document.querySelector(x), vis = e => !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none';
        const h3 = [...document.querySelectorAll('#mpBody .mp-sec > h3')].map(h => h.textContent.trim());
        return {
          cls: q('#mypage').className, head: vis(q('#mpBody .mp-head')), sum: (q('#w272sum') || {}).textContent, chips: q('#mpBody .mp-chips') ? q('#mpBody .mp-chips').children.length : 0,
          next: vis(q('#w272next')), nextT: q('#w272next h3') ? q('#w272next h3').textContent : '', apps: q('#w272apps') ? q('#w272apps').querySelectorAll('button').length : 0, h3,
          online: !!q('#mpBody .mp-online'), feed: !!q('#w192feed'), hours: !!q('#mpHours'), bar: vis(q('#w262homebar')), sw: document.documentElement.scrollWidth, iw: innerWidth,
          later: q('#w272laterbtn') ? q('#w272laterbtn').textContent : '', tourOk: !!(window.w122 && window.w122.tours), bodyOverflow: q('#mpBody').scrollWidth - q('#mpBody').clientWidth, setup: !!q('#w272setup'), w: window.w272 && window.w272.state()
        };
      });
      ok(/w272/.test(s.cls), tag + ' page class');
      ok(s.head && s.sum && s.chips >= 1, tag + ' greeting, sentence, chips ' + JSON.stringify([s.head, s.sum, s.chips]));
      ok(s.next, tag + ' up next');
      ok(['My tasks', 'Mentions'].every(t => s.h3.some(x => x.indexOf(t) === 0)), tag + ' old sections ' + JSON.stringify(s.h3));
      /* Time commitments shows for people with a team or their own hours, as it does on the live page */
      const hoursExpected = who === 'admin' || who === 'leader';
      ok(s.online && s.feed !== undefined && (!hoursExpected || s.hours), tag + ' waiting cards still drawn ' + JSON.stringify([s.online, s.hours]));
      ok(s.bar, tag + ' show everything');
      ok(s.sw <= s.iw, tag + ' no sideways scroll ' + s.sw + ' > ' + s.iw);
      ok(s.bodyOverflow <= 1, tag + ' body overflow ' + s.bodyOverflow);
      /* Steel, 02/11/26: Mentions is always there, with or without any mentions, and Got it and the chip still work */
      const men = await f.ev(async () => {
        const box = document.getElementById('w65menbox'), vis = e => !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none';
        const inFocus = vis(box);
        document.querySelector('[data-w262home]').click(); await new Promise(r => setTimeout(r, 200));
        const inAll = vis(document.getElementById('w65menbox'));
        document.querySelector('[data-w262home]').click(); await new Promise(r => setTimeout(r, 200));
        return { inFocus, inAll, title: box && box.querySelector('h3') ? box.querySelector('h3').textContent : '', text: box ? box.textContent.length : 0, got: box ? box.querySelectorAll('[data-w65got]').length : 0, chip: document.querySelectorAll('#mpBody [data-w74men]').length, unseen: box ? box.querySelectorAll('.w74men:not(.seen)').length : 0 };
      });
      ok(men.inFocus && men.inAll && /^Mentions/.test(men.title) && men.text > 12, tag + ' mentions always visible ' + JSON.stringify(men));
      ok(men.got === men.unseen, tag + ' Got it on each new mention ' + JSON.stringify(men));
      /* Show everything still reveals what wave262 hid */
      const all = await f.ev(async () => {
        document.querySelector('[data-w262home]').click(); await new Promise(r => setTimeout(r, 300));
        const vis = e => !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none';
        const r = { online: vis(document.querySelector('#mpBody .mp-online')), hours: vis(document.getElementById('mpHours')), sw: !!document.getElementById('w114switch') };
        document.querySelector('[data-w262home]').click(); return r;
      });
      ok(all.online && (!hoursExpected || all.hours) && all.sw, tag + ' show everything reveals ' + JSON.stringify(all));
      /* Do this later moves on; Later opens */
      const lt = await f.ev(async () => {
        const b = document.getElementById('w272laterbtn'); if (!b) return null;
        const before = [...document.querySelectorAll('#mpBody [data-w109]')].filter(x => x.getBoundingClientRect().width > 0).length;
        b.click(); await new Promise(r => setTimeout(r, 100));
        const after = [...document.querySelectorAll('#mpBody [data-w109]')].filter(x => x.getBoundingClientRect().width > 0).length;
        b.click(); return { before, after };
      });
      if (lt) ok(lt.after >= lt.before, tag + ' later opens ' + JSON.stringify(lt));
      if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, tag.replace('@', '_') + '.png') });
      /* Up next: Do this later moves on, Mark as done offers Undo, Undo puts it back */
      const un = await f.ev(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)), title = () => (document.querySelector('#w272next h3') || {}).textContent;
        if (!document.querySelector('[data-w272do="done"]')) return null;
        const first = title(), out = { first };
        const later = document.querySelector('[data-w272do="later"]');
        if (later) { later.click(); await w(50); out.movedOn = title() !== first; }
        const t2 = title(); document.querySelector('[data-w272do="done"]').click(); await w(1200);
        const toastEl = document.getElementById('w272toast'); out.toast = !!toastEl && toastEl.classList.contains('on'); out.gone = title() !== t2;
        if (toastEl) toastEl.querySelector('button').click(); await w(1200); out.back = title() === t2 || [...document.querySelectorAll('#mpBody [data-w109]')].some(r => r.textContent.indexOf(t2) >= 0);
        try { localStorage.removeItem('wa272.skip'); } catch (e) { /* fine */ }
        return out;
      });
      if (un) ok(un.toast && un.gone && un.back && (un.movedOn !== false), tag + ' up next, done, undo ' + JSON.stringify(un));
      /* the small note: never over another window, Not now closes it, and it does not come back within 14 days */
      const tip = await f.ev(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)); localStorage.removeItem('wa272.tip'); window.w272.closeTip();
        window.w272.setupOpen(); window.w272.tryTip(); const blocked = !document.getElementById('w272tip'); window.w272.closeHow();
        window.w272.tryTip(); const shown = !!document.getElementById('w272tip');
        const modal = shown && document.getElementById('w272tip').getAttribute('aria-modal');
        if (shown) document.querySelector('[data-w272tip]').click(); await w(300);
        const closed = !document.getElementById('w272tip'); window.w272.tryTip(); return { blocked, shown, modal, closed, again: !!document.getElementById('w272tip') };
      });
      ok(tip.blocked && tip.shown && !tip.modal && tip.closed && !tip.again, tag + ' the small note ' + JSON.stringify(tip));
      /* the how-to window, each tab */
      const how = await f.ev(async () => {
        window.w272.setupOpen(); await new Promise(r => setTimeout(r, 200));
        const out = { back: !!document.getElementById('w272back'), tabs: document.querySelectorAll('#w272sheet .seg button').length, step: 0 };
        document.querySelector('[data-w272tab="iphone"]').click(); out.steps = document.querySelectorAll('#w272how .foot [data-hw]').length;
        document.querySelector('[data-w272tab="computer"]').click(); out.comp = /Add to Dock/.test(document.getElementById('w272how').textContent);
        document.querySelector('#w272sheet .x').click(); out.closed = !document.getElementById('w272back'); return out;
      });
      ok(how.back && how.tabs === 3 && how.steps === 6 && how.comp && how.closed, tag + ' how-to ' + JSON.stringify(how));
      ok(!(f.errs || []).length, tag + ' page errors ' + JSON.stringify((f.errs || []).slice(0, 3)));
      console.log(tag, s.sum, '| next:', s.nextT.slice(0, 40), '| apps', s.apps, '| later', s.later, '| setup', s.setup, JSON.stringify(s.w));
      await f.close();
    }
  }
  /* a director: Home is their landing page and their Board pages stand in for apps */
  for (const width of [1366, 390]) {
    /* the board profile lists Home (hub_access_profiles, wave272) */
    const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'));
    (fx.hub_access_profiles || []).forEach(p => { if (p.key === 'board') { if (Array.isArray(p.pages)) p.pages.push('mypage'); else p.pages = Object.assign({}, p.pages, { mypage: 'all' }); } });
    const f = await fresh(browser, { who: 'board', width, hash: '', fixture: fx });
    await wait(3500);
    const d = await f.ev(() => {
      const q = x => document.querySelector(x), vis = e => !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none';
      return { hash: location.hash, active: (q('.tab.active') || {}).textContent, onHome: q('#mypage') && q('#mypage').classList.contains('active'), head: vis(q('#mpBody .mp-head')), h2: (q('#mpBody .mp-head h2') || {}).textContent, board: q('#w272apps') ? q('#w272apps').textContent : '', tab: vis(q('#tabBar .tab[data-tab="mypage"]')), meet: !!q('#w116home'), read: !!q('#mpBody p.read'), off: !!q('#w105my') && vis(q('#w105my')), staffCards: [...document.querySelectorAll('#mpBody > *')].map(e => e.id || e.className), sw: document.documentElement.scrollWidth, iw: innerWidth };
    });
    const tag = 'board@' + width;
    ok(d.onHome && d.head, tag + ' lands on Home ' + JSON.stringify(d));
    ok(!d.read, tag + ' no staff-only line');
    ok(/Board/.test(d.board), tag + ' board pages ' + d.board);
    ok(!d.off, tag + ' no time-off card');
    ok(d.sw <= d.iw, tag + ' no sideways scroll');
    ok(!(f.errs || []).length, tag + ' page errors ' + JSON.stringify((f.errs || []).slice(0, 3)));
    console.log(tag, JSON.stringify({ h: d.hash, h2: d.h2, tab: d.tab, meet: d.meet, cards: d.staffCards }));
    if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, 'board_' + width + '.png') });
    await f.close();
  }
  await browser.close();
  console.log(fails ? fails + ' failed, ' + passes + ' passed' : 'all ' + passes + ' passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
