/* w279drive.js: wave279 Task 7, the manager's role-pick pop-up and the plan's role steps; Task 8 (sections 5 to 8), the policy reading timer on Home and in
   the Academy, the HR board's Academy trainings count and pace, and "Up to 90 days" on the manager's card. Offline against the candidate (CAND=<file>.html), with test/boot.js
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
    const fx = fx279(o.fxo);
    const rpcs = Object.assign({ onboarding_lead_view: lead279(o.lead) }, o.rpcs || {});
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
    const found = await f.ev((sel) => { const i = document.querySelector(sel); return i ? { dis: i.disabled, off: i.closest('label').classList.contains('off'), txt: i.closest('label').textContent } : null; }, pick('60 DAYS', 9411));
    ok('fix round 1: a module Lina finished that only the search finds is greyed and cannot be ticked', found && found.dis && found.off && /finished it already/.test(found.txt), found);
    await f.page.click(pick('60 DAYS', 9411), { force: true }).catch(() => {});
    ok('fix round 1: clicking it picks nothing', !(await f.ev((sel) => document.querySelector(sel).checked, pick('60 DAYS', 9411))));
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

  /* ---------- 3b. fix round 1: a list whose picks are all finished is read only in the pop-up ---------- */
  {
    const picks = { [ONB.lina]: { '60 DAYS': [{ training_id: 9401, auto: true, picked_by: 'the Hub' }], '90 DAYS': [{ training_id: 9411, auto: false, picked_by: 'Joy Dumansi' }] } };
    const f = await go({ who: 'admin', hash: '#hrcentre/onboarding', fx279: { picks } });
    await f.hash('#hrcentre/onboarding', 1500);
    await f.page.waitForSelector('[data-w37open="' + ONB.lina + '"]', { timeout: 8000 }).catch(() => {});
    await press(f, '[data-w37open="' + ONB.lina + '"]');
    await f.page.waitForSelector('[data-w279hr] [data-w279open]', { timeout: 4000 }).catch(() => {});
    await press(f, '[data-w279hr] [data-w279open="' + ONB.lina + '"]');
    await f.page.waitForSelector('#w279sheet .w279sec', { timeout: 4000 }).catch(() => {});
    const s = await f.ev(() => {
      const box = (k) => document.querySelector('#w279sheet .w279sec[data-w279sec="' + k + '"]');
      const one = (k) => { const b = box(k); const q = b.querySelector('.w279q'); return { badge: (b.querySelector('[data-w279part="state"]') || {}).textContent, save: !!b.querySelector('[data-w279save]'), search: !!q && getComputedStyle(q).display !== 'none', boxes: [...b.querySelectorAll('[data-w279part="list"] input')].map((i) => i.disabled), foot: b.querySelector('.w279foot').textContent }; };
      return { s60: one('60 DAYS'), s90: one('90 DAYS') };
    });
    ok('the done 90-day list says Done, with no Save and no search', s.s90.badge === 'Done' && !s.s90.save && !s.s90.search, s.s90);
    ok('every box in the done list is locked, and the foot says why', s.s90.boxes.length > 0 && s.s90.boxes.every(Boolean) && /It is finished, so this list can.t change now\./.test(s.s90.foot), s.s90);
    ok('the 60-day list, not all done, keeps its Save and search', s.s60.badge === '' && s.s60.save && s.s60.search && s.s60.boxes.some((x) => !x), s.s60);
    ok('the pop-up copy has no em dash (done list)', noDash(await textOf(f, '#w279sheet')));
    await shot(f, 'w279-done-1366');
    ok('done list: no console errors', f.cons.length === 0, f.cons);
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

  /* ---------- Task 8 helpers: the policy rows on Home and in the Academy ---------- */
  const FIXED = Date.parse('2026-09-25T20:00:00Z');   /* boot.js's clock */
  const UNLOCKED = { 'expense-policy': { opened_at: '2026-09-25T19:40:00Z', unlock_at: '2026-09-25T19:50:00Z' } };
  const signBtn = (f, sel) => f.ev((s) => { const b = document.querySelector(s); return b ? { dis: b.disabled, txt: b.textContent.trim() } : null; }, sel);
  const openLink = async (f, sel) => { await f.ev((s) => { const a = document.querySelector(s); a.addEventListener('click', (e) => e.preventDefault(), { once: true }); a.click(); }, sel); await f.page.waitForTimeout(500); };
  const clockAt = (f, min) => f.ev((t) => { Date.now = function () { return t; }; if (window.wa279Pol) window.wa279Pol.refresh(); }, FIXED + min * 60000);
  const toastTxt = (f) => f.ev(() => (document.getElementById('toast') || {}).textContent || '');
  const ticking = (f) => f.ev(() => !!(window.wa279Pol && window.wa279Pol.ticking()));

  /* ---------- 5. Home: Set up your Hub, the policies wait for the reading time ---------- */
  {
    const f = await go({ who: 'member', hash: '#mypage', fx279: { pol: { state: JSON.parse(JSON.stringify(UNLOCKED)) } } });
    await f.hash('#mypage', 1500);
    await f.page.waitForSelector('#w272setup [data-w272pol="sign"]', { timeout: 8000 }).catch(() => {});
    const H = (k) => '#w272setup [data-w272pol="sign"][data-key="' + k + '"]', O = (k) => '#w272setup [data-w272pol="open"][data-key="' + k + '"]';
    ok('Home: the two policies to sign show', await has(f, H('agency-handbook')) && await has(f, H('expense-policy')));
    ok('Home: wa279_policy_state is read once', (await calls(f, 'wa279_policy_state')).length === 1, await calls(f));
    let b = await signBtn(f, H('agency-handbook'));
    ok('Home: before Open, Sign is off', b && b.dis && b.txt === 'Sign', b);
    b = await signBtn(f, H('expense-policy'));
    ok('Home: a policy whose unlock_at is past can be signed at once', b && !b.dis && b.txt === 'Sign', b);
    await openLink(f, O('agency-handbook'));
    const oc = await calls(f, 'wa279_policy_open');
    ok('Home: Open calls wa279_policy_open with the key', oc.length === 1 && oc[0].args.p_key === 'agency-handbook', oc);
    b = await signBtn(f, H('agency-handbook'));
    ok('Home: after Open, Sign is off and says "Sign in 10 min"', b && b.dis && b.txt === 'Sign in 10 min', b);
    ok('Home: the countdown timer runs while the row shows', await ticking(f));
    await shot(f, 'w279-pol-home-1366');
    await clockAt(f, 6.5);
    b = await signBtn(f, H('agency-handbook'));
    ok('Home: 6 and a half minutes later it says "Sign in 4 min" (rounded up)', b && b.dis && b.txt === 'Sign in 4 min', b);
    await f.hash('#calendar', 900);
    ok('Home: away from Home, no timer is left running', !(await ticking(f)));
    await f.hash('#mypage', 1200);
    ok('Home: back on Home, the timer runs again', await ticking(f));
    await clockAt(f, 10);
    b = await signBtn(f, H('agency-handbook'));
    ok('Home: at unlock_at, Sign is on and says Sign', b && !b.dis && b.txt === 'Sign', b);
    ok('Home: nothing left to count, so the timer stops', !(await ticking(f)));
    await f.ev(() => { window.__W279.polRefuse = 'Read it for 3 more minutes first'; });
    await press(f, H('expense-policy'));
    await f.page.waitForTimeout(300);
    ok('Home: a refused sign-off shows the database\'s message as it is', (await toastTxt(f)) === 'Read it for 3 more minutes first', await toastTxt(f));
    ok('Home: after a refusal the opens are read again', (await calls(f, 'wa279_policy_state')).length === 2, await calls(f, 'wa279_policy_state'));
    b = await signBtn(f, H('expense-policy'));
    ok('Home: the refused policy stays, its Sign on again', b && !b.dis, b);
    await press(f, H('agency-handbook'));
    await f.page.waitForTimeout(300);
    const sg = await f.ev(() => window.__W279.signs.map((s) => s.policy_key));
    ok('Home: Sign records the sign-off', JSON.stringify(sg) === JSON.stringify(['expense-policy', 'agency-handbook']) && /Sign-off recorded/.test(await toastTxt(f)), sg);
    ok('Home: the policy copy has no em dash', noDash(await textOf(f, '#w272setup')));
    ok('Home policies: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 5b. Home at phone width, with the database silent (the old rule stands) ---------- */
  {
    const f = await go({ who: 'member', hash: '#mypage', width: 375 });
    await f.hash('#mypage', 1500);
    await f.page.waitForSelector('#w272setup [data-w272pol="sign"]', { timeout: 8000 }).catch(() => {});
    const H = '#w272setup [data-w272pol="sign"][data-key="agency-handbook"]';
    let b = await signBtn(f, H);
    ok('375, no answer from the database: Sign is off before Open', b && b.dis && b.txt === 'Sign', b);
    await openLink(f, '#w272setup [data-w272pol="open"][data-key="agency-handbook"]');
    b = await signBtn(f, H);
    ok('375, no answer from the database: Sign is on after Open, as before', b && !b.dis && b.txt === 'Sign', b);
    ok('375: Home has no sideways scroll', !(await hasScroll(f)));
    await done(f);
  }

  /* ---------- 5c. fix round 1: no timer runs away, and opens from another device show without a reload ---------- */
  {
    const PRIV = { key: 'privacy-policy', title: 'Privacy Policy', url: 'https://docs.google.com/document/d/z/edit', required: true, active: true, sort: 3 };
    const f = await go({ who: 'member', hash: '#mypage', fxo: { pols: [PRIV] }, fx279: { pol: { state: {} } } });
    await f.hash('#mypage', 1500);
    await f.page.waitForSelector('#w272setup [data-w272pol="sign"]', { timeout: 8000 }).catch(() => {});
    const H = (k) => '#w272setup [data-w272pol="sign"][data-key="' + k + '"]';
    /* count every timeout the page asks for from here on, and keep the 30 second intervals still running */
    await f.ev(() => {
      const T = window.__T279 = { to: 0, live: new Set() }, st = window.setTimeout, si = window.setInterval, ci = window.clearInterval;
      window.setTimeout = function () { T.to++; return st.apply(this, arguments); };
      window.setInterval = function (fn, ms) { const id = si.apply(this, arguments); if (ms === 30000) T.live.add(id); return id; };
      window.clearInterval = function (id) { T.live.delete(id); return ci.apply(this, arguments); };
    });
    const nState = async () => (await calls(f, 'wa279_policy_state')).length;
    const live = () => f.ev(() => window.__T279.live.size);
    let b = await signBtn(f, H('privacy-policy'));
    ok('fix round 1: three policies, no open anywhere yet, Sign is off', b && b.dis && b.txt === 'Sign', b);

    /* 1. a counting Sign on screen and nothing else happening: the page asks for almost no timers */
    await openLink(f, '#w272setup [data-w272pol="open"][data-key="agency-handbook"]');
    b = await signBtn(f, H('agency-handbook'));
    ok('fix round 1: after Open the handbook counts down', b && b.dis && b.txt === 'Sign in 10 min', b);
    await f.page.waitForTimeout(300);
    const to0 = await f.ev(() => window.__T279.to);
    await f.page.waitForTimeout(2000);
    const toN = (await f.ev(() => window.__T279.to)) - to0;
    ok('fix round 1: idle with a counting Sign, fewer than 3 timeouts in 2 seconds', toN < 3, toN);
    ok('fix round 1: one 30 second tick runs while it shows', (await live()) === 1 && await ticking(f), await live());
    await f.hash('#calendar', 900);
    ok('fix round 1: away from Home, the 30 second tick is cleared', (await live()) === 0 && !(await ticking(f)), await live());
    const to1 = await f.ev(() => window.__T279.to);
    await f.page.waitForTimeout(2000);
    const toM = (await f.ev(() => window.__T279.to)) - to1;
    ok('fix round 1: and nothing keeps scheduling after leaving', toM < 3, toM);
    await f.hash('#mypage', 1200);
    ok('fix round 1: back on Home, one tick again (not two)', (await live()) === 1, await live());

    /* 2. the expense policy is opened on a phone: a Sign with no open reads the opens again once they are over a minute old */
    const n0 = await nState();
    await f.ev((t) => { window.__W279.pol.state['expense-policy'] = { opened_at: t, unlock_at: t }; }, new Date(FIXED - 60000).toISOString());
    await f.ev(() => window.wa279Pol.refresh()); await f.page.waitForTimeout(200);
    ok('fix round 1: opens read under a minute ago are not read again', (await nState()) === n0 && (await signBtn(f, H('expense-policy'))).dis, await nState());
    await clockAt(f, 1.1); await f.page.waitForTimeout(300);
    b = await signBtn(f, H('expense-policy'));
    ok('fix round 1: over a minute old, they are read again and the other device\'s open shows', (await nState()) === n0 + 1 && b && !b.dis && b.txt === 'Sign', { n: await nState(), b });

    /* 3. the privacy policy is opened on the phone too; this tab comes back into view */
    await f.ev((t) => { window.__W279.pol.state['privacy-policy'] = { opened_at: t, unlock_at: new Date(Date.parse(t) + 600000).toISOString() }; }, new Date(FIXED - 300000).toISOString());
    const n1 = await nState();
    await f.ev(() => document.dispatchEvent(new Event('visibilitychange'))); await f.page.waitForTimeout(300);
    b = await signBtn(f, H('privacy-policy'));
    ok('fix round 1: back in view, the opens are read again and the button counts down', (await nState()) === n1 + 1 && b && b.dis && b.txt === 'Sign in 4 min', { n: await nState(), b });
    ok('fix round 1: still one 30 second tick', (await live()) === 1, await live());
    ok('fix round 1: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 6. the Academy: Onboarding, Policies to sign ---------- */
  {
    const f = await go({ who: 'member', hash: '#training', fx279: { pol: { state: JSON.parse(JSON.stringify(UNLOCKED)) } } });
    await f.hash('#training', 1500);
    const H = (k) => '#w122 [data-trk="policies"] [data-w122sign="' + k + '"]', O = (k) => '#w122 [data-trk="policies"] [data-w279polopen="' + k + '"]';
    await f.page.waitForSelector(H('agency-handbook'), { timeout: 8000 }).catch(() => {});
    let b = await signBtn(f, H('agency-handbook'));
    ok('Academy: before Open, "I have read it" is off', b && b.dis && b.txt === 'I have read it', b);
    b = await signBtn(f, H('expense-policy'));
    ok('Academy: a policy whose unlock_at is past can be signed at once', b && !b.dis && b.txt === 'I have read it', b);
    await openLink(f, O('agency-handbook'));
    ok('Academy: Open and read calls wa279_policy_open', (await calls(f, 'wa279_policy_open')).some((c) => c.args.p_key === 'agency-handbook'));
    b = await signBtn(f, H('agency-handbook'));
    ok('Academy: after Open, the button is off and says "Sign in 10 min"', b && b.dis && b.txt === 'Sign in 10 min', b);
    await shot(f, 'w279-pol-academy-1366');
    await clockAt(f, 10);
    b = await signBtn(f, H('agency-handbook'));
    ok('Academy: at unlock_at it is on again', b && !b.dis && b.txt === 'I have read it', b);
    await f.ev(() => { window.__W279.polRefuse = 'Read it for 2 more minutes first'; });
    await press(f, H('expense-policy'));
    await f.page.waitForTimeout(300);
    ok('Academy: a refused sign-off shows the database\'s message as it is', (await toastTxt(f)) === 'Read it for 2 more minutes first', await toastTxt(f));
    b = await signBtn(f, H('expense-policy'));
    ok('Academy: after a refusal the button is usable again', b && !b.dis, b);
    ok('Academy policies: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 7. the HR centre's onboarding board: Academy trainings d of t, and the 90-day pace ---------- */
  {
    const f = await go({ who: 'admin', hash: '#hrcentre/onboarding', fxo: { acad: true }, fx279: { pol: {} } });
    await f.hash('#hrcentre/onboarding', 1500);
    await f.page.waitForSelector('[data-w37open="' + ONB.lina + '"]', { timeout: 8000 }).catch(() => {});
    await f.page.waitForTimeout(600);
    const row = (id) => f.ev((i) => { const e = document.querySelector('[data-w37open="' + i + '"]'); const r = e && e.closest('.w46row'); return r ? r.textContent : null; }, id);
    const acad = (id) => textOf(f, '[data-w279acad="' + id + '"]');
    ok('HR board: Lina\'s row says "Academy trainings 2 of 5"', (await acad(ONB.lina)) === 'Academy trainings 2 of 5', await row(ONB.lina));
    ok('HR board: Omar (role steps with no picks yet, nothing else from the Academy) shows no count', (await acad(ONB.omar)) === '', await acad(ONB.omar));
    const q = await f.ev(() => window.__W279.froms.filter((t) => t === 'academy_assignments').length);
    ok('HR board: one query for every plan\'s picks', q === 1, q);
    const pr = await row(ONB.pace);
    ok('HR board: day 45 with 50% done is not behind pace (90 days)', !!pr && /50%/.test(pr) && /day 45/.test(pr) && !/behind pace/.test(pr), pr);
    ok('HR board: Pace Person counts "Academy trainings 2 of 2" (the policies step once, no picks)', (await acad(ONB.pace)) === 'Academy trainings 2 of 2', await acad(ONB.pace));
    await shot(f, 'w279-hrboard-1366');
    ok('HR board: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 8. the manager's card: a hire at day 70 is "Up to 90 days" ---------- */
  {
    const f = await go({ who: 'plain', hash: '#mypage', lead: { late: true } });
    await f.hash('#mypage', 1500);
    await f.page.waitForSelector('#w166lead .w166day', { timeout: 8000 }).catch(() => {});
    const days = await f.ev(() => [...document.querySelectorAll('#w166lead .w166day')].map((e) => e.textContent));
    ok('the manager\'s card: day 70 says "Up to 90 days"', days.some((t) => /Day 70/.test(t) && /Up to 90 days/.test(t)), days);
    ok('the manager\'s card: day 23 still says "Week 4 of 4"', days.some((t) => /Day 23/.test(t) && /Week 4 of 4/.test(t)), days);
    await done(f);
  }

  ok('no page errors anywhere', allErrs.length === 0, allErrs);
  ok('no console errors anywhere', allCons.length === 0, allCons);
  console.log('\nw279drive: ' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
