/* w232drive.js: wave232 offline against the candidate (CAND=build/<file>.html).
   A serving's own spot counts (the header's menu, the editor, the save, the roster counting against them), the Fundraising
   overview without the sub-team cards (Marketing keeps its own), Your photos in the profile menu (two slots), the mileage
   on a reimbursement (km x rate fills Total amount and Items and prices), and no page errors. */
const { launch, fresh } = require('./boot');
const fx = require('./w191fx');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0, unticked: 0 } };
const INSTALL = () => {
  window.__W232 = { up: [], rpc: [] };
  const f0 = db.from.bind(db);
  db.from = function (t) { const b = f0(t); const u = b.update.bind(b); b.update = function (p) { window.__W232.up.push({ t: t, p: p }); return u(p); }; return b; };
  const r0 = db.rpc.bind(db);
  db.rpc = function (fn, args) { window.__W232.rpc.push({ fn: fn, args: args }); return r0(fn, args); };
};

(async () => {
  const browser = await launch();
  try {
    /* ---------- a serving's own spot counts ---------- */
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx(), rpcs: RPCS, width: 1440, wait: 5200 });
    await f.ev(INSTALL);
    const m = await f.ev(() => !!document.querySelector('#w191head [data-w191go="spots"]'));
    ok('spots: the serving menu has Spot counts', m);
    await f.ev(() => { const b = document.querySelector('#w191head [data-w191go="spots"]'); if (b) b.click(); });
    await f.page.waitForTimeout(500);
    const ed = await f.ev(() => ({ inputs: document.querySelectorAll('[data-w232sp]').length, cook: (document.querySelector('[data-w232sp="cook"]') || {}).value, h: (document.querySelector('.w232spots h3') || {}).textContent || '' }));
    ok('spots: the editor lists the eight roles with their current counts', ed.inputs === 8 && Number(ed.cook) > 0 && /Spot counts/.test(ed.h), ed);
    await f.ev(() => { const i = document.querySelector('[data-w232sp="cook"]'); i.value = '1'; const s = document.querySelector('[data-w232sp="server"]'); s.value = '5'; document.getElementById('w232spsave').click(); });
    await f.page.waitForTimeout(900);
    const up = await f.ev(() => window.__W232.up.filter(u => u.t === 'volunteer_events' && 'spot_counts' in u.p));
    ok('spots: Save writes only the roles that differ from the usual', up.length === 1 && up[0].p.spot_counts && up[0].p.spot_counts.cook === 1 && up[0].p.spot_counts.server === 5 && Object.keys(up[0].p.spot_counts).length === 2, up);
    const tg = await f.ev(() => typeof window.WA191TARGETS === 'function' ? window.WA191TARGETS(900, { cook: 4, server: 8, driver: 2 }) : null);
    ok('spots: the shared target function counts against the serving’s own numbers', tg && tg.cook === 1 && tg.server === 5 && tg.driver === 2, tg);
    await f.ev(() => { const b = document.querySelector('#w191head [data-w191go="spots"]'); if (b) b.click(); });
    await f.page.waitForTimeout(400);
    const own = await f.ev(() => ({ cook: (document.querySelector('[data-w232sp="cook"]') || {}).value, cls: (document.querySelector('[data-w232sp="cook"]') || {}).className }));
    ok('spots: reopening shows the saved count, marked as this serving’s own', own.cook === '1' && /own/.test(own.cls), own);
    await f.ev(() => document.getElementById('w232spreset').click());
    await f.page.waitForTimeout(700);
    const rs = await f.ev(() => window.__W232.up.filter(u => u.t === 'volunteer_events' && 'spot_counts' in u.p).pop());
    ok('spots: Use the usual counts clears them', rs && rs.p.spot_counts === null, rs);
    ok('spots: no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* ---------- the Fundraising overview ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#team/fundraising', rpcs: RPCS, width: 1366, wait: 4500 });
    const fr = await f.ev(() => ({ cards: document.querySelectorAll('.w116bcard').length, page: !!document.querySelector('.w116grid') }));
    ok('fundraising: the overview has no sub-team cards', fr.page && fr.cards === 0, fr);
    await f.ev(() => { location.hash = '#team/marketing'; });
    await f.page.waitForTimeout(2500);
    const mk = await f.ev(() => ({ cards: document.querySelectorAll('.w116bcard').length, page: !!document.querySelector('.w116grid') }));
    ok('marketing: its overview is unchanged (the page draws)', mk.page, mk);

    /* ---------- Your photos ---------- */
    await f.ev(() => { const b = document.getElementById('w115btn'); if (b) b.click(); });
    await f.page.waitForTimeout(400);
    const item = await f.ev(() => !!document.querySelector('#w115menu [data-w232photos]'));
    ok('photos: the profile menu has Your photos', item);
    await f.ev(() => { const b = document.querySelector('#w115menu [data-w232photos]'); if (b) b.click(); });
    await f.page.waitForTimeout(900);
    const ph = await f.ev(() => ({ slots: Array.from(document.querySelectorAll('.w232ph [data-w232slot]')).map(s => s.getAttribute('data-w232slot')), txt: (document.querySelector('.w232ph') || {}).textContent || '' }));
    ok('photos: two slots, the Hub photo and the website photo', ph.slots.join() === 'hub,website' && /welfareavenue\.com/.test(ph.txt), ph);
    await f.ev(() => { const c = document.querySelector('[data-w232cx]'); if (c) c.click(); });

    /* ---------- the mileage on a reimbursement ---------- */
    await f.ev(() => { location.hash = '#requests/new/finance/reimbursement'; });
    await f.page.waitForTimeout(2000);
    const box = await f.ev(() => !!document.querySelector('form[data-w123form="reimbursement"] .w232mile'));
    ok('mileage: the reimbursement form has the mileage helper', box);
    await f.ev(() => {
      const b = document.querySelector('.w232mile'); b.open = true;
      b.querySelector('[data-w232m="from"]').value = 'The storage unit';
      b.querySelector('[data-w232m="to"]').value = 'Place Emilie-Gamelin';
      const km = b.querySelector('[data-w232m="km"]'); km.value = '10'; km.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await f.page.waitForTimeout(700);
    const mi = await f.ev(() => { const fm = document.querySelector('form[data-w123form="reimbursement"]'); return { amt: (fm.querySelector('input[type=number]:not([data-w232m])') || {}).value, items: (fm.querySelector('textarea') || {}).value, sum: (fm.querySelector('[data-w232m="sum"]') || {}).textContent }; });
    ok('mileage: 10 km round trip at $0.73 fills $14.60', mi.amt === '14.60' && /20 km x \$0\.73 = \$14\.60/.test(mi.sum), mi);
    ok('mileage: the line goes into Items and prices', /^Mileage: The storage unit to Place Emilie-Gamelin, 20 km \(round trip\) x \$0\.73 = \$14\.60/.test(mi.items || ''), mi);
    ok('pages: no page errors', f.errs.length === 0, f.errs);
    await f.close();
  } catch (e) { fail++; console.log('FAIL crashed :: ' + String(e && e.stack || e).slice(0, 800)); }
  await browser.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
