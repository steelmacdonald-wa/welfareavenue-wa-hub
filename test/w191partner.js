/* w191partner.js: wave191o, a serving with a partner organization, offline against the candidate (CAND=build/<file>.html).
   With a collaboration (volunteer_event_partners): the header says who with; Plan shows the card (who, how many, the food and
   the kitchen, what they cover, what we bring with our team leader and community lead always ours, the route and how many
   signed up by name, the coordinator, the note, Copy the form link, See the form); the counts include their people (the
   roles they cover are not short; signed-up people count once); Plan the roster's targets follow (WA191TARGETS); the editor
   comes filled in, shows the kitchen address only for a kitchen, and saves through wa191_partner_save with the choices;
   without one, Plan offers "With a partner?" and the More menu too; the phone width; no page errors. */
const { launch, fresh } = require('./boot');
const fs = require('fs');
const fx191 = require('./w191fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
const TOKP = 'abcdef0123456789abcdef01';
const PART = { event_id: 900, active: true, partner_id: 5, partner_name: 'Oberoi Financial Group', food: 'desta_kitchen', kitchen_place: '1950 Rue Saint-Antoine Ouest, Montréal', route: 'everyone',
  coordinator_name: 'Jane Coord', coordinator_email: 'jane@example.com', coordinator_phone: '(514) 555-0199', headcount: 12, covers: { server: 8, cook: 4 }, signup_token: TOKP, signup_open: true, note: 'They bring aprons.' };
function fixture(withPartner) {
  const fx = fx191();
  if (withPartner) {
    fx.volunteer_event_partners = [PART];
    fx.event_roster.push({ id: 9101, event_id: 900, person_id: 4101, person_name: 'Priya Oberoi', role: 'server', status: 'Confirmed', confirm_status: 'confirmed', sort: 950, detail: { source: 'partner form', partner_id: 5, partner_name: 'Oberoi Financial Group' }, confirm_token: 'tok9101abcdefghijk', confirm: null, recipe_id: null });
  }
  fx.wa_partners = [{ id: 5, name: 'Oberoi Financial Group', category: 'sponsor', status: 'active' }, { id: 73, name: 'DESTA Black Community Network', category: 'partner', status: 'active' }, { id: 58, name: 'Old Brewery Mission', category: 'partner', status: 'active' }];
  return fx;
}
const SAVED = Object.assign({}, PART, { food: 'they_bring', covers: { server: 6 }, ok: true });
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0 }, wa191_run_get: { plan: null, stale: null }, wa191_partner_save: SAVED };
const txt = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);
const openStage = (f, k) => f.ev(k => { const s = document.querySelector('#w119 .w191stage[data-stage="' + k + '"]'); if (s && !s.classList.contains('open')) s.querySelector(':scope > .h').click(); }, k);

(async () => {
  const browser = await launch();
  try {
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture(true), rpcs: RPCS, width: 1440, wait: 5600 });
    await openStage(f, 'plan'); await f.page.waitForTimeout(600);
    ok('the header says who with', /With Oberoi Financial Group/.test(await txt(f, '#w191head .meta')));
    const where = await f.ev(() => { const c = document.getElementById('w191partner'); return c ? c.closest('.w191stage').getAttribute('data-stage') : null; });
    ok('the collaboration card sits in Plan', where === 'plan', where);
    let t = await txt(f, '#w191partner');
    ok('who and how many', /Oberoi Financial Group 12 people/.test(t), t.slice(0, 200));
    ok('the food and the kitchen', /They cook with us in DESTA’s kitchen · 1950 Rue Saint-Antoine Ouest/.test(t), t);
    ok('they cover 8 servers, 4 cooks', /They cover 8 servers, 4 cooks/.test(t), t);
    ok('we bring: our team leader and community lead always, and the rest', /We bring [^]*team leader/.test(t) && /community lead/.test(t) && /\(our team leader and community lead, always\)/.test(t) && !/We bring[^(]*cook/.test(t) && !/We bring[^(]*server/.test(t) && /2 drivers/.test(t), t);
    ok('their people: the form, 1 signed up, the coordinator', /Everyone signs up with the form · 1 signed up so far/.test(t) && /Jane Coord · jane@example\.com · \(514\) 555-0199/.test(t), t);
    ok('the note', /They bring aprons\./.test(t));
    ok('the form link: copy and see', await f.ev(t => !!document.querySelector('#w191partner [data-w191pcopy="https://hub.welfareavenue.com/c/' + t + '"]') && !!document.querySelector('#w191partner a[href="https://hub.welfareavenue.com/c/' + t + '?test=1"]'), TOKP));
    const rec = await txt(f, '.w191stage[data-stage="recruit"] .w191own');
    ok('Recruit: what they cover, and the gap without servers or cooks', /Oberoi Financial Group covers 8 servers, 4 cooks/.test(rec) && /short: [^·]*driver/.test(rec) && !/short: [^·]*server/.test(rec) && !/short: [^·]*cook/.test(rec), rec);
    const T = await f.ev(() => window.WA191TARGETS(900, { team_leader: 2, cook: 4, driver: 2, server: 8, community_debrief: 1, photographer: 1 }));
    ok('Plan the roster: targets follow (servers 8 less 7 promised, no cooks, team leader and community lead ours)', T && T.server === 1 && T.cook === 0 && T.driver === 2 && T.team_leader === 2 && T.community_debrief === 1, T);
    if (SHOTS) { await f.ev(() => document.getElementById('w191partner').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(200); await (await f.page.$('#w191partner')).screenshot({ path: SHOTS + '/partner_card.png' }); }
    /* the editor */
    await f.page.click('#w191partner [data-w191go="partner"]'); await f.page.waitForTimeout(800);
    const ed = await f.ev(() => { const m = document.querySelector('.w191pm'); if (!m) return null; return { sel: m.querySelector('#w191pp').value, food: (m.querySelector('input[name="w191pf"]:checked') || {}).value, kitchenShown: m.querySelector('#w191pkw').style.display !== 'none', kitchen: m.querySelector('#w191pk').value, route: (m.querySelector('input[name="w191pr"]:checked') || {}).value, server: m.querySelector('[data-w191pc="server"]').value, cook: m.querySelector('[data-w191pc="cook"]').value, head: m.querySelector('#w191ph').value, open: m.querySelector('#w191pso') && m.querySelector('#w191pso').checked, txt: m.innerText }; });
    ok('the editor comes filled in', ed && ed.sel === '5' && ed.food === 'desta_kitchen' && ed.kitchenShown && /1950 Rue Saint-Antoine/.test(ed.kitchen) && ed.route === 'everyone' && ed.server === '8' && ed.cook === '4' && ed.head === '12' && ed.open === true, ed);
    ok('the editor: our team leader and community lead are always ours', /Our team leader and community lead are always ours/.test(ed.txt));
    await f.page.check('.w191pm input[name="w191pf"][value="they_bring"]'); await f.page.waitForTimeout(100);
    ok('they bring the food: no kitchen address', await f.ev(() => document.getElementById('w191pkw').style.display === 'none'));
    await f.page.fill('.w191pm [data-w191pc="server"]', '6'); await f.page.fill('.w191pm [data-w191pc="cook"]', '');
    await f.ev(() => { window.__calls = []; const r0 = db.rpc.bind(db); db.rpc = function (fn, a) { window.__calls.push({ fn: fn, a: JSON.parse(JSON.stringify(a || {})) }); return r0(fn, a); }; });
    await f.page.click('.w191pm [data-w191psave]'); await f.page.waitForTimeout(900);
    const sv = await f.ev(() => window.__calls.filter(c => c.fn === 'wa191_partner_save'));
    ok('Save sends the choices', sv.length === 1 && sv[0].a.p_event === 900 && sv[0].a.p.partner_id === 5 && sv[0].a.p.food === 'they_bring' && sv[0].a.p.route === 'everyone' && JSON.stringify(sv[0].a.p.covers) === JSON.stringify({ server: 6 }) && sv[0].a.p.headcount === 12 && sv[0].a.p.signup_open === true, sv);
    t = await txt(f, '#w191partner');
    ok('after saving, the card follows', /They bring the food/.test(t) && /They cover 6 servers/.test(t), t.slice(0, 400));
    ok('no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* no collaboration: Plan offers it, and the More menu */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture(false), rpcs: RPCS, width: 390, wait: 5600 });
    await openStage(f, 'plan'); await f.page.waitForTimeout(500);
    ok('no collaboration: no card, "With a partner?" in Plan and the menu', await f.ev(() => !document.getElementById('w191partner') && !!document.querySelector('.w191stage[data-stage="plan"] .w191own [data-w191go="partner"]') && !!document.querySelector('#w191head .menu [data-w191go="partner"]')));
    await f.page.click('.w191stage[data-stage="plan"] .w191own [data-w191go="partner"]'); await f.page.waitForTimeout(800);
    const ed2 = await f.ev(() => { const m = document.querySelector('.w191pm'); return m ? { sel: m.querySelector('#w191pp').value, food: (m.querySelector('input[name="w191pf"]:checked') || {}).value, route: (m.querySelector('input[name="w191pr"]:checked') || {}).value, opts: m.querySelectorAll('#w191pp option').length, end: !!m.querySelector('[data-w191pend]') } : null; });
    ok('a new collaboration: our cooks, a coordinator, the partners list, nothing to end', ed2 && ed2.sel === '' && ed2.food === 'ours' && ed2.route === 'coordinator' && ed2.opts === 5 && !ed2.end, ed2);
    await f.page.selectOption('#w191pp', 'other'); await f.page.waitForTimeout(100);
    ok('another organization: type its name', await f.ev(() => document.getElementById('w191pn').style.display !== 'none'));
    const over = await f.ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('phone: nothing scrolls sideways', over <= 1, over);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/partner_editor_phone.png' });
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  } catch (e) { fail++; console.log('FAIL crashed :: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
