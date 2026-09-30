/* w175bdrive.js: wave175b, the Hub is staff-only: an account that is not on the team (a volunteer's Gmail) is signed out
   at once, its session removed, and the sign-in screen says why and where volunteers and donors sign in. */
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); } }
(async () => {
  const browser = await launch();
  try {
    const f = await fresh(browser, { who: 'board', hash: '#overview', rpcs: { get_my_role: 'none' }, init: 'try { if (!sessionStorage.getItem("t_once")) { sessionStorage.setItem("t_once", "1"); localStorage.setItem("sb-zwnmulmnvopclzcvytce-auth-token", "{}"); } } catch (e) {}', wait: 4000, gateOk: true });
    await f.page.waitForTimeout(2500);
    const st = await f.ev(() => ({ gate: getComputedStyle(document.getElementById('gate')).display, msg: document.getElementById('gateMsg').textContent, vis: getComputedStyle(document.getElementById('gateMsg')).display, out: sessionStorage.getItem('stub_signed_out'), tok: localStorage.getItem('sb-zwnmulmnvopclzcvytce-auth-token'), app: document.documentElement.classList.contains('wa-ready'), flag: sessionStorage.getItem('wa_gate_denied'), nav: performance.getEntriesByType('navigation')[0].type, html: document.getElementById('gate').innerHTML.slice(0, 300) }));
    ok('not on the team: signed out', st.out === '1', st);
    ok('not on the team: the session is gone from this browser', st.tok === null, st);
    ok('not on the team: the sign-in screen says why and where volunteers sign in', st.gate !== 'none' && /is not on the Welfare Avenue team, so it was signed out/.test(st.msg) && /Volunteers and donors sign in on welfareavenue\.com/.test(st.msg), st);
    await f.page.screenshot({ path: '/tmp/gate175.png' }); console.log(JSON.stringify(await f.ev(() => { const m = document.getElementById('gateMsg'); const out = []; for (let e = m; e; e = e.parentElement) out.push(e.tagName + '#' + e.id + '.' + e.className + ':' + getComputedStyle(e).display); return out; })));
    ok('not on the team: once only (no loop)', /Sign in with Google|Continue with Google|Google/i.test(await f.ev(() => document.getElementById('gate').innerText)));
    await f.close();
    const g = await fresh(browser, { who: 'admin', hash: '#overview', wait: 3500 });
    ok('staff: the Hub opens as before', await g.ev(() => getComputedStyle(document.getElementById('gate')).display === 'none'));
    await g.close();
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
