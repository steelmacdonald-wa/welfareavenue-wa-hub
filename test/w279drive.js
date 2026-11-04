/* w279drive.js: wave279 Task 7, the manager's role-pick pop-up and the plan's role steps. Offline against the candidate (CAND=<file>.html), with test/boot.js
   (stubbed Supabase, clock 25/09/26 16:00 Toronto) and test/w279fx.js (stand-ins for wa279_role_options and wa279_role_save; every network call is stubbed
   or blocked). Identities: Joy (boot.js's plain member) manages Lina, a marketing hire at day 22, and Omar at day 10; an admin opens Lina's checklist in
   the HR centre; Samson (boot.js's member) reads his own plan. Phone width 375. SHOTS=<dir> saves screenshots. */
const fs = require('fs');
const { chromium } = require('playwright');
const { fresh } = require('./boot');
const { fx279, lead279, INIT279, ONB } = require('./w279fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 700) : '')); } }
const shot = async (f, n, full) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png', fullPage: full !== false }); };
async function launch() {
  const args = ['--disable-gpu'];
  let last;
  for (const t of [{ args }, { channel: 'chrome', args }, { channel: 'msedge', args }]) { try { return await chromium.launch(t); } catch (e) { last = e; } }
  throw last;
}
const txtOf = (f, sel) => f.ev((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const textOf = (f, sel) => f.ev((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);   // headings are upper case on Home and a closed week hides its text from innerText
const has = (f, sel) => f.ev((s) => !!document.querySelector(s), sel);
const press = async (f, sel) => { await f.ev((s) => document.querySelector(s).click(), sel); await f.page.waitForTimeout(350); };
const hasScroll = (f) => f.ev(() => document.documentElement.scrollWidth > window.innerWidth + 1);
const consoleErrs = (f) => { const out = []; f.page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) out.push(m.text().slice(0, 240)); }); return out; };
const calls = (f, fn) => f.ev((n) => window.__W279.calls.filter((c) => !n || c.fn === n), fn);
const pick = (sec, id) => '#w279sheet input[data-w279pick="' + sec + '"][value="' + id + '"]';
const tick = async (f, sec, id) => { await f.page.click(pick(sec, id)); await f.page.waitForTimeout(120); };
const saveBtn = (sec) => '#w279sheet [data-w279save="' + sec + '"]';
const saveOff = (f, sec) => f.ev((s) => { const b = document.querySelector(s); return !b || b.disabled; }, saveBtn(sec));
const search = async (f, sec, q) => { await f.page.fill('#w279sheet input[data-w279q="' + sec + '"]', q); await f.page.waitForTimeout(150); };
const noDash = (t) => !/—/.test(t);

(async () => {
  const b = await launch();
  const allErrs = [], allCons = [];
  const go = async (o) => {
    const fx = fx279();
    const rpcs = Object.assign({ onboarding_lead_view: lead279() }, o.rpcs || {});
    const f = await fresh({ newContext: (x) => b.newContext(Object.assign({ timezoneId: 'America/Toronto' }, x)) }, Object.assign({ fixture: fx, rpcs, wait: 5000 }, o, { init: INIT279(o.fx279 || {}) }));
    f.cons = consoleErrs(f);
    return f;
  };
  const done = async (f) => { allErrs.push(...f.errs); allCons.push(...f.cons); await f.close(); };

  /* ---------- 1. Joy, Lina's manager, on Home ---------- */
  {
    const f = await go({ who: 'plain', hash: '#mypage' });
    await f.hash('#mypage', 1500);
    await f.page.waitForSelector('#w279home', { timeout: 6000 }).catch(() => {});
    let t = await textOf(f, '#w279home');
    ok('Home: the card "Pick Lina\'s role trainings" shows', /Pick Lina's role trainings/.test(t), t);
    ok('Home: no card for Omar (day 10)', !/Omar/.test(t), t);
    let c = await calls(f, 'wa279_role_options');
    ok('Home: wa279_role_options asked only for the hire at day 21 or later', c.length >= 1 && c.every((x) => x.args.p_onb === ONB.lina), c);
    ok('Home: the card copy has no em dash', noDash(t));
    await shot(f, 'w279-home-1366');

    await press(f, '#w279home [data-w279open="' + ONB.lina + '"]');
    await f.page.waitForSelector('#w279sheet .w279sec', { timeout: 4000 });
    t = await txtOf(f, '#w279sheet');
    ok('the pop-up: the title and the two headings', /Pick Lina's role trainings/.test(t) && /60 days: pick 2 or 3/.test(t) && /90 days: pick 5 or 6/.test(t), t.slice(0, 400));
    const order = await f.ev(() => [...document.querySelectorAll('#w279sheet .w279sec[data-w279sec="60 DAYS"] [data-w279part="list"] input')].map((i) => Number(i.value)));
    ok('the pop-up: recommended modules first, in the database\'s order', JSON.stringify(order) === JSON.stringify([9401, 9402, 9403, 9404, 9405, 9406, 9407]), order);
    const doneRow = await f.ev((s) => { const i = document.querySelector(s); return i ? { dis: i.disabled, off: i.closest('label').classList.contains('off'), txt: i.closest('label').innerText } : null; }, pick('60 DAYS', 9403));
    ok('the done module is greyed and cannot be picked', doneRow && doneRow.dis && doneRow.off && /finished it already/.test(doneRow.txt), doneRow);
    await f.page.click(pick('60 DAYS', 9403), { force: true }).catch(() => {});
    ok('clicking the done module picks nothing', !(await f.ev((s) => document.querySelector(s).checked, pick('60 DAYS', 9403))));
    ok('Save is off at 0', await saveOff(f, '60 DAYS'));
    await tick(f, '60 DAYS', 9401);
    ok('Save is off at 1', await saveOff(f, '60 DAYS'), await txtOf(f, '#w279sheet .w279sec[data-w279sec="60 DAYS"] .w279foot'));
    await tick(f, '60 DAYS', 9402);
    ok('Save is on at 2', !(await saveOff(f, '60 DAYS')));
    await tick(f, '60 DAYS', 9404);
    ok('Save is on at 3', !(await saveOff(f, '60 DAYS')));
    await tick(f, '60 DAYS', 9405);
    ok('Save is off at 4, and the count says so', await saveOff(f, '60 DAYS') && /4 picked\. That is too many: pick 2 or 3\./.test(await txtOf(f, '#w279sheet .w279sec[data-w279sec="60 DAYS"] .w279foot')));
    await tick(f, '60 DAYS', 9404); await tick(f, '60 DAYS', 9405);
    ok('a module picked for 60 days cannot be picked for 90 days', await f.ev((s) => document.querySelector(s).disabled, pick('90 DAYS', 9401)));

    /* the search over every active module */
    await search(f, '60 DAYS', 'photo');
    ok('search finds a module that is not recommended', await has(f, pick('60 DAYS', 9408)));
    await search(f, '60 DAYS', 'zebra');
    ok('search leaves planned modules out', !(await has(f, pick('60 DAYS', 9410))) && /No module matches that/.test(await txtOf(f, '#w279sheet .w279sec[data-w279sec="60 DAYS"] [data-w279part="res"]')));
    await search(f, '60 DAYS', 'photo');
    await tick(f, '60 DAYS', 9408);
    ok('a module ticked from the search stays in the list and counts', /3 picked\./.test(await txtOf(f, '#w279sheet .w279sec[data-w279sec="60 DAYS"] .w279foot')) && !(await saveOff(f, '60 DAYS')));

    /* the database's refusal shows as it is */
    await f.ev(() => { window.__W279.refuse = 'Only the manager, HR or an admin can pick role trainings'; });
    await press(f, saveBtn('60 DAYS'));
    await f.page.waitForTimeout(300);
    t = await txtOf(f, '#w279sheet .w279sec[data-w279sec="60 DAYS"] .w279err');
    ok('the refusal text shows as it is', t === 'Only the manager, HR or an admin can pick role trainings', t);

    await press(f, saveBtn('60 DAYS'));
    await f.page.waitForTimeout(300);
    c = await calls(f, 'wa279_role_save');
    ok('Save 60 days: one wa279_role_save for 60 DAYS with the three picks (the refused one counted too)', c.length === 2 && c[1].args.p_section === '60 DAYS' && c[1].args.p_onb === ONB.lina && JSON.stringify(c[1].args.p_training_ids) === JSON.stringify([9401, 9402, 9408]), c);
    ok('it says Saved', /Saved\./.test(await txtOf(f, '#w279sheet .w279sec[data-w279sec="60 DAYS"] .w279foot')));
    ok('Home still asks: 90 days is not picked', /Still to pick: 90 days/.test(await txtOf(f, '#w279home')), await txtOf(f, '#w279home'));

    for (const id of [9404, 9405, 9406, 9407]) await tick(f, '90 DAYS', id);
    ok('Save 90 days is off at 4', await saveOff(f, '90 DAYS'));
    await search(f, '90 DAYS', 'grant');
    await tick(f, '90 DAYS', 9409);
    ok('Save 90 days is on at 5', !(await saveOff(f, '90 DAYS')));
    await shot(f, 'w279-sheet-1366');
    await press(f, saveBtn('90 DAYS'));
    await f.page.waitForTimeout(300);
    c = await calls(f, 'wa279_role_save');
    ok('Save 90 days: one more call, for 90 DAYS only', c.length === 3 && c[2].args.p_section === '90 DAYS' && JSON.stringify(c[2].args.p_training_ids) === JSON.stringify([9404, 9405, 9406, 9407, 9409]), c.map((x) => x.args));
    ok('the pop-up copy has no em dash', noDash(await txtOf(f, '#w279sheet')));
    await press(f, '#w279sheet [data-w279x]');
    ok('Close takes the pop-up away', !(await has(f, '#w279sheet')));
    ok('Home: the card goes once both lists are picked', !(await has(f, '#w279home')));
    ok('Joy: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 2. Joy at phone width ---------- */
  {
    const f = await go({ who: 'plain', hash: '#mypage', width: 375 });
    await f.hash('#mypage', 1500);
    await f.page.waitForSelector('#w279home', { timeout: 6000 }).catch(() => {});
    ok('375: the card shows', /Pick Lina's role trainings/.test(await textOf(f, '#w279home')));
    ok('375: Home has no sideways scroll', !(await hasScroll(f)), await f.ev(() => document.documentElement.scrollWidth));
    await press(f, '#w279home [data-w279open="' + ONB.lina + '"]');
    await f.page.waitForSelector('#w279sheet .w279sec', { timeout: 4000 });
    await search(f, '60 DAYS', 'a');
    ok('375: the pop-up with search results has no sideways scroll', !(await hasScroll(f)) && await f.ev(() => { const p = document.querySelector('#w279sheet .w279pan'); return p.scrollWidth <= p.clientWidth + 1 && p.getBoundingClientRect().right <= innerWidth; }), await f.ev(() => [document.documentElement.scrollWidth, document.querySelector('#w279sheet .w279pan').scrollWidth]));
    await shot(f, 'w279-sheet-375', false);
    ok('375: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 3. an admin in the HR centre: the plan lists the picks; Role trainings opens the pop-up ---------- */
  {
    const picks = { [ONB.lina]: { '60 DAYS': [{ training_id: 9401, auto: true, picked_by: 'the Hub' }, { training_id: 9403, auto: false, picked_by: 'Joy Dumansi' }] } };
    const f = await go({ who: 'admin', hash: '#hrcentre/onboarding', fx279: { picks, by: 'Steel MacDonald' } });
    await f.hash('#hrcentre/onboarding', 1500);
    await f.page.waitForSelector('[data-w37open="' + ONB.lina + '"]', { timeout: 8000 }).catch(() => {});
    ok('HR centre: Lina\'s row has its checklist', await has(f, '[data-w37open="' + ONB.lina + '"]'));
    await press(f, '[data-w37open="' + ONB.lina + '"]');
    await f.page.waitForSelector('#w37modal .w279step', { timeout: 4000 }).catch(() => {});
    await f.page.waitForTimeout(400);
    const s60 = await f.ev(() => { const e = document.querySelector('#w37modal .w279step[data-w279sec="60 DAYS"]'); return e ? { txt: e.textContent, ticks: e.querySelectorAll('.w279tick').length, ok: e.querySelectorAll('li.ok').length } : null; });
    ok('the plan\'s 60-day role step lists the picks with a tick each', s60 && /Marketing basics: our voice/.test(s60.txt) && /Campaigns and storytelling: the brief/.test(s60.txt) && s60.ticks === 2 && s60.ok === 1, s60);
    ok('the plan says who picked: the Hub, and the manager by name', s60 && /Picked by the Hub/.test(s60.txt) && /Picked by Joy Dumansi/.test(s60.txt), s60);
    const s90 = await textOf(f, '#w37modal .w279step[data-w279sec="90 DAYS"]');
    ok('the 90-day role step with no picks: "Your manager picks these in week 3."', s90.trim() === 'Your manager picks these in week 3.', s90);
    ok('the role step does not offer to browse the avenues', !(await f.ev(() => [...document.querySelectorAll('#w37modal [data-w166t="wa279role60"] [data-w166open]')].some((b) => b.getAttribute('data-w166open') === 'a:'))));
    ok('HR: the checklist has a Role trainings button', /Role trainings/.test(await txtOf(f, '[data-w279hr]')));
    await press(f, '[data-w279hr] [data-w279open="' + ONB.lina + '"]');
    await f.page.waitForSelector('#w279sheet .w279sec', { timeout: 4000 }).catch(() => {});
    ok('HR: the button opens the same pop-up, over the checklist', /Pick Lina's role trainings/.test(await txtOf(f, '#w279sheet')) && await has(f, '#w37modal'));
    ok('HR: the saved picks come ticked', await f.ev((a) => a.every((s) => document.querySelector(s) && document.querySelector(s).checked), [pick('60 DAYS', 9401), pick('60 DAYS', 9403)]));
    await tick(f, '60 DAYS', 9402);
    await press(f, saveBtn('60 DAYS'));
    await f.page.waitForTimeout(300);
    const c = await calls(f, 'wa279_role_save');
    ok('HR saves 60 days: one call, the finished pick kept', c.length === 1 && JSON.stringify(c[0].args.p_training_ids) === JSON.stringify([9401, 9403, 9402]), c);
    await press(f, '#w279sheet [data-w279x]');
    const s60b = await textOf(f, '#w37modal .w279step[data-w279sec="60 DAYS"]');
    ok('after saving, the checklist behind shows the new picks, picked by the person who saved', /Marketing basics: the content calendar/.test(s60b) && /Picked by Steel MacDonald/.test(s60b), s60b);
    await shot(f, 'w279-hr-1366');
    ok('admin: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 4. Samson reads his own plan in the Academy ---------- */
  {
    const picks = { [ONB.sam]: { '60 DAYS': [{ training_id: 9405, auto: false, picked_by: 'Joy Dumansi' }, { training_id: 9406, auto: true, picked_by: 'the Hub' }] } };
    const f = await go({ who: 'member', hash: '#training/onboarding', fx279: { picks, canPick: false } });
    await f.page.waitForSelector('#w122sheet .w279step', { timeout: 8000 }).catch(() => {});
    await f.page.waitForTimeout(500);
    const s = await f.ev(() => { const e = document.querySelector('#w122sheet .w279step[data-w279sec="60 DAYS"]'); return e ? e.textContent : null; });
    ok('the hire\'s plan: the 60-day role step lists the picks and who picked them', s && /Marketing strategy: goals/.test(s) && /Picked by Joy Dumansi/.test(s) && /Picked by the Hub/.test(s), s);
    const s9 = await f.ev(() => { const e = document.querySelector('#w122sheet .w279step[data-w279sec="90 DAYS"]'); return e ? e.textContent.trim() : null; });
    ok('the hire\'s plan: 90 days says the manager picks them', s9 === 'Your manager picks these in week 3.', s9);
    const c = await calls(f);
    ok('the hire\'s plan never calls wa279_role_save, and asks for options for his own plan only', c.every((x) => x.fn === 'wa279_role_options' && x.args.p_onb === ONB.sam) && c.length >= 1, c);
    ok('Samson: no Home card (he manages nobody)', !(await has(f, '#w279home')));
    ok('Samson: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  ok('no page errors anywhere', allErrs.length === 0, allErrs);
  ok('no console errors anywhere', allCons.length === 0, allCons);
  console.log('\nw279drive: ' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
