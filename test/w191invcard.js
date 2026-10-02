/* w191invcard.js: wave191n, the storage check in the Hub, offline against the candidate (CAND=build/<file>.html).
   Wrap up on a serving shows the team leader's check (who and when, everything back in its place or not, how many running low
   and missing, what to restock with the unit and the category, their note, Open the Inventory, their check as a test link);
   before it is in, what to expect; the Inventory view shows the last check above the table; no page errors. */
const { launch, fresh } = require('./boot');
const fs = require('fs');
const fx191 = require('./w191fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0 }, wa191_run_get: { plan: null, stale: null } };
const CHECK = { event_id: 900, roster_id: 9006, by_name: 'Sam Handmade', in_place: false, low: 1, missing: 1, note: 'The lock sticks a little.', lang: 'en', submitted_at: '2026-10-02T18:40:00Z', updated_at: '2026-10-02T18:55:00Z',
  items: [{ id: 1, item: 'Gloves - Medium', unit: 'Box (100)', category: 'Hygiene & PPE', state: 'ok' }, { id: 2, item: 'Gloves - Large', unit: 'Box (100)', category: 'Hygiene & PPE', state: 'low' }, { id: 19, item: 'Tent', unit: 'Each', category: 'Station Setup & Logistics', state: 'missing' }] };
const openWrap = f => f.ev(() => { const s = document.querySelector('#w119 .w191stage[data-stage="wrap_up"]'); if (s && !s.classList.contains('open')) s.querySelector(':scope > .h').click(); });
const txt = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);

(async () => {
  const browser = await launch();
  try {
    /* 1. the check is in */
    const fx = fx191(); fx.volunteer_inventory_checks = [CHECK];
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx, rpcs: RPCS, width: 1440, wait: 5200 });
    await openWrap(f); await f.page.waitForTimeout(500);
    const where = await f.ev(() => { const c = document.getElementById('w191inv'); return c ? c.closest('.w191stage').getAttribute('data-stage') : null; });
    ok('the storage check sits in Wrap up', where === 'wrap_up', where);
    let t = await txt(f, '#w191inv');
    ok('who and when', /Sam Handmade checked the storage unit · Oct 2/.test(t), t.slice(0, 300));
    ok('not everything back in its place; 1 running low, 1 missing', /Not everything back in its place/.test(t) && /1 running low/.test(t) && /1 missing/.test(t), t);
    ok('what to restock: missing first, with unit and category', /To restock/i.test(t) && /Missing\s*Tent Each · Station Setup & Logistics/i.test(t) && /Running low\s*Gloves - Large Box \(100\) · Hygiene & PPE/i.test(t) && t.indexOf('Tent') < t.indexOf('Gloves - Large'), t);
    ok('their note', /The lock sticks a little\./.test(t));
    ok('their check as a test link', await f.ev(() => { const a = Array.from(document.querySelectorAll('#w191inv a')).filter(x => /test link/.test(x.textContent))[0]; return !!a && /\/c\/tok9006[^?]*\?test=1#inv$/.test(a.href); }));
    if (SHOTS) { await f.ev(() => document.getElementById('w191inv').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(200); await (await f.page.$('#w191inv')).screenshot({ path: SHOTS + '/inv_card.png' }); }
    await f.page.click('#w191inv [data-w191go="inventory"]'); await f.page.waitForTimeout(2500);
    ok('Open the Inventory goes to the Inventory', await f.ev(() => location.hash === '#volunteering/inventory'));
    t = await txt(f, '#w191invlast');
    ok('the Inventory shows the last check above the table', /Last storage check/i.test(t) && /Sam Handmade/.test(t) && /1 running low, 1 missing, not everything back in its place/.test(t) && await f.ev(() => { const b = document.getElementById('w191invlast'), w = document.querySelector('#volunteering .vl-tblwrap'); return !!(b && w && (b.compareDocumentPosition(w) & Node.DOCUMENT_POSITION_FOLLOWING)); }), t);
    ok('no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* 2. not in yet (the serving is ahead): what to expect */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx191(), rpcs: RPCS, width: 390, wait: 5200 });
    await openWrap(f); await f.page.waitForTimeout(500);
    t = await txt(f, '#w191inv');
    ok('before: what to expect, the test link, the Inventory', /After the serving the team leader checks the storage unit on their page/.test(t) && /The team leader’s check \(test link\)/.test(t) && /Open the Inventory/.test(t), t);
    const over = await f.ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('phone: nothing scrolls sideways', over <= 1, over);
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  } catch (e) { fail++; console.log('FAIL crashed :: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
