/* w222drive.js: wave222. The loading screen lifts once the Hub has started (never on a clock before that), the page
   appears whole, and the sign-in screen still shows at once.
   NODE_PATH=... CAND=build/candidate.html node test/w222drive.js */
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 600) : '')); } }
/* a signature of what the reader sees: the page's structure (its visible sections, cards and headings) and the menu; figures that arrive a moment later fill a card in place, and the same elements in another order, are not a change of version */
const WATCH = `window.__w222t = { lifted: null, sigs: [], moves: 0 };
  (function(){ function sig(){ var p = document.querySelector('.panel.active'); var b = document.getElementById('tabBar'); return (p ? p.id + ':' + [].map.call(p.querySelectorAll('section, .card, h2, h3, .mp-sec, [id]'), function (el) { try { if (!el.offsetWidth && !el.offsetHeight) return ''; } catch (e) {} return el.tagName + (el.id ? '#' + el.id : '') + (/^H[23]$/.test(el.tagName) ? ':' + (el.textContent || '').trim().slice(0, 40) : ''); }).filter(Boolean).sort().join(',').slice(0, 6000) : '') + '|' + (b ? [].map.call(b.querySelectorAll('.tab, .tab-group'), function (el) { return (el.getAttribute('data-tab') || el.getAttribute('data-w42g')) + (el.style.display === 'none' ? '-' : '+'); }).join(',') : ''); }
    var last = null; var iv = setInterval(function(){ var T = window.__w222t; var up = document.documentElement.classList.contains('wa-ready'); if (up && T.lifted === null) { T.lifted = performance.now(); last = sig(); return; } if (T.lifted !== null && performance.now() - T.lifted > 900) { var s = sig(); if (s !== last) { T.moves++; T.sigs.push(s.slice(0, 160)); last = s; } } }, 60); setTimeout(function(){ clearInterval(iv); }, 40000); })();`;
(async () => {
  const browser = await launch();

  /* 1. a normal load: the veil lifts after the start, not before, with no page errors */
  for (const [who, width, hash] of [['admin', 1366, '#mypage'], ['member', 390, '#hr'], ['board', 1366, '#governance']]) {
    const f = await fresh(browser, { who, width, hash, wait: 5000 });
    const s = await f.ev(() => ({ w222: window.w222 && window.w222.state(), ready: document.documentElement.classList.contains('wa-ready'), veil: !!document.getElementById('wa110veil'), menu: document.documentElement.classList.contains('w163nav') }));
    ok(who + ' ' + hash + ' at ' + width + ' px: the veil lifted after the Hub started (' + (s.w222 && s.w222.started) + ' then ' + (s.w222 && s.w222.lifted) + ' ms)', s.ready && !s.veil && s.menu && s.w222 && s.w222.why === 'started' && s.w222.started !== null && s.w222.lifted >= s.w222.started, s);
    ok(who + ': no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. a slow load (every request 250 to 750 ms, the start takes well past 9 s): the veil holds until the start, then the page does not change */
  for (const [who, width, hash] of [['admin', 1366, '#dashboard'], ['member', 390, '#mypage']]) {
    const f = await fresh(browser, { who, width, hash, wait: 24000, init: 'window.__WA_LAT = 500; ' + WATCH });
    const s = await f.ev(() => ({ w222: window.w222 && window.w222.state(), t: window.__w222t, ready: document.documentElement.classList.contains('wa-ready'), menu: window.w163 && window.w163.state() }));
    ok(who + ' slow ' + hash + ': the start took past 9 s and the veil waited for it (' + (s.w222 && s.w222.started) + ' then ' + (s.w222 && s.w222.lifted) + ' ms, ' + (s.w222 && s.w222.why) + ')', s.ready && s.w222 && s.w222.why === 'started' && s.w222.started > 9000 && s.w222.lifted >= s.w222.started, s.w222);
    ok(who + ' slow ' + hash + ': the page\'s structure and the menu did not change after the veil lifted', s.t && s.t.lifted !== null && s.t.moves === 0 && s.menu && s.menu.after === 0, s.t && { moves: s.t.moves, sigs: s.t.sigs, after: s.menu && s.menu.after });
    ok(who + ' slow: no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. signed out: the sign-in screen shows at once (wave175b), the veil does not hold it */
  {
    const f = await fresh(browser, { who: 'admin', gateOk: true, wait: 2500, init: 'try { sessionStorage.setItem("stub_signed_out", "1"); } catch (e) {}' });
    const s = await f.ev(() => ({ ready: document.documentElement.classList.contains('wa-ready'), gate: (document.getElementById('gate') || {}).style && document.getElementById('gate').style.display, w222: window.w222 && window.w222.state() }));
    ok('signed out: the sign-in screen shows within 2.5 s, the veil lifted', s.ready && s.gate === 'flex', s);
    await f.close();
  }

  await browser.close();
  console.log('\nw222drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
