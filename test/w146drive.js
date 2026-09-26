/* w146drive.js: the monthly security check (wave146) in Admin, Security and audit trail.
   The check comes from the first live run (scratchpad security_fixture.json), plus an older one to compare with.
   usage: node test/w146drive.js */
const fs = require('fs');
const { launch, fresh, loadFixture } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const CHECK = JSON.parse(fs.readFileSync(SP + 'security_fixture.json', 'utf8'))[0].checks[0];
function fixture() {
  const fx = loadFixture();
  const older = JSON.parse(JSON.stringify(CHECK));
  older.id = 1; older.ran_at = '2026-09-01T16:00:00Z';
  older.summary = Object.assign({}, older.summary, { with_2sv: 5, without_2sv: 41, unused_60: 11, public_files: 790, high: 3 });
  fx.security_checks = [CHECK, older];
  return fx;
}
const MOCK = `(function(){ window.__INV = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.functions || db.functions.__w) return;
    db.functions.invoke = function (name, opts) { window.__INV.push({ name: name, body: opts && opts.body });
      return new Promise(function (res) { setTimeout(function () { res({ data: { ok: true, id: 3, summary: {} }, error: null }); }, 400); }); };
    db.functions.__w = 1; }, 5); })();`;

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#adminpanel/security', fixture: fixture(), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1800);
  let c = await f.ev(() => { const el = document.getElementById('w146sec'), card = document.getElementById('w86card'); if (!el) return null;
    const h2 = card && card.querySelector('h2');
    return { inCard: !!card && el.parentNode === card && !!h2 && h2.nextElementSibling === el, visible: el.offsetParent !== null, when: (el.querySelector('.when') || {}).textContent || '',
      tiles: [...el.querySelectorAll('.tile')].map(t => t.textContent), f: [...el.querySelectorAll('.f > button')].map(b => b.textContent), hist: el.querySelectorAll('.hist tbody tr').length, btn: !!el.querySelector('[data-w146run]') }; });
  ok('the check sits at the top of Security and audit trail', c && c.inCard && c.visible, c);
  ok('when it ran and what needs doing', c && /Last run/.test(c.when) && /to fix now/.test(c.when) && /Next on/.test(c.when), c && c.when);
  ok('six headline numbers', c && c.tiles.length === 6 && /8 of 46accounts with 2-step verification/.test(c.tiles[0]), c && c.tiles);
  ok('against the check before', c && /\+3/.test(c.tiles[0]) && /-2/.test(c.tiles[1]), c && c.tiles.slice(0, 3));
  ok('the findings, most urgent first', c && c.f.length === 12 && /^Fix now/.test(c.f[0]) && /^Fix now/.test(c.f[1]) && /^Plan it/.test(c.f[2]), c && c.f.slice(0, 4));
  ok('the earlier check listed', c && c.hist === 1, c && c.hist);
  await f.ev(() => document.querySelectorAll('#w146sec .f > button')[0].click());
  await f.page.waitForTimeout(200);
  const o = await f.ev(() => { const x = document.querySelectorAll('#w146sec .f')[0]; return { open: x.classList.contains('open'), fix: (x.querySelector('.fix') || {}).textContent || '', items: x.querySelectorAll('li').length, link: !!x.querySelector('a.out[href*="admin.google.com"]') }; });
  ok('a finding opens to what to do and who', o.open && /What to do/.test(o.fix) && o.items > 0 && o.link, o);
  await f.ev(() => document.querySelector('[data-w146run]').click());
  await f.page.waitForTimeout(120);
  const busy = await f.ev(() => { const b = document.querySelector('[data-w146run]'); return b ? { dis: b.disabled, t: b.textContent } : null; });
  ok('Run the check now waits while it runs', busy && busy.dis && /Checking/.test(busy.t), busy);
  await f.page.waitForTimeout(900);
  const inv = await f.ev(() => window.__INV.filter(x => x.name === 'security-check'));
  ok('it asks security-check to run', inv.length === 1 && inv[0].body.action === 'run', inv);
  const tour = await f.ev(() => { const T = window.w122 && w122.tours; if (!T) return null; for (const k in T) { const s = (T[k].steps || []).map(x => x.s); const i = s.indexOf('#w146sec'); if (i > 0) return s[i - 1]; } return null; });
  ok('the admin tour has a step after Security and audit', tour === '#w86card', tour);
  await f.hash('#adminpanel/people', 1200);
  const hidden = await f.ev(() => { const el = document.getElementById('w146sec'); return !el || el.offsetParent === null; });
  ok('other admin sections do not show it', hidden, hidden);
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  f = await fresh(browser, { who: 'member', hash: '#adminpanel/security', fixture: fixture(), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1500);
  const m = await f.ev(() => !!document.getElementById('w146sec'));
  ok('a member never gets the check', m === false, m);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw146drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
