/* w191onb.js: wave191p, choose your servings in the onboarding, offline against the candidate (CAND=build/<file>.html).
   Week 3's lesson (a 'servings' block in the chapter "Why you volunteer") and Week 3's page in the onboarding journey carry the
   picker: the photos and "Required: four servings a year" in the lesson; how many servings this fiscal year of the four; the
   next servings (the ones they are on already say so and cannot be unticked; a partner shows); nothing chosen is caught before
   anything is sent; the servings, the role and the message go to wa191_onb_signup; "You are confirmed for …" names the operations
   lead; Choose more servings; a server error shows; not a team member says so; the journey's Week 3 has the picker; the phone
   width; no page errors. */
const { launch, fresh, loadFixture } = require('./boot');
const fs = require('fs');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }

const PH = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/photos/web/';
const LESSON = 990224;
function fixture(opts) {
  opts = opts || {};
  const fx = loadFixture();
  fx.trainings.push({ id: LESSON, category: 'Onboarding', title: 'Week 3: your team and your servings', description: 'The teams, your tasks and why every member volunteers four times a year.', source: 'hub', path_group: 'Your onboarding', sort: 3, active: true, kind: 'lesson', key: 'onb:week3', minutes: 8, xp: 20, resource_url: null, ext_id: null, duration_sec: null,
    body: { summary: 'Week 3', chapters: [
      { t: 'Your team', id: 'team', blocks: [{ type: 'lead', text: 'Our teams and what each one does.' }] },
      { t: 'Why you volunteer', id: 'serve', blocks: [
        { type: 'photos', items: [{ src: PH + '2024-07-summer-team-under-the-tent.jpg', fx: 0.5, fy: 0.52, alt: 'The team under the tent', cap: 'The team under the tent, summer 2024.' }, { src: PH + '2024-10-autumn-volunteers-plating.jpg', fx: 0.42, fy: 0.45, alt: 'Plating', cap: 'Plating together, autumn 2024.' }] },
        { type: 'lead', text: 'Every member volunteers at a serving **four times a year**, starting in your onboarding.' },
        { type: 'callout', tone: 'warn', t: 'Required: four servings a year', text: 'Volunteering is part of every role at Welfare Avenue, whatever your team.' },
        { type: 'cards', items: [{ t: 'Understand Welfare Avenue', d: 'You see who we serve.', icon: 'heart' }, { t: 'Do your role better', d: 'What you make lands at a serving.', icon: 'target' }, { t: 'Meet the community', d: 'Side by side for an afternoon.', icon: 'people' }] },
        { type: 'h', text: 'Choose your servings' },
        { type: 'servings' },
        { type: 'list', items: ['Arrive at 12:00 for the setup, dressed for the weather.'] }
      ] }
    ] } });
  if (opts.journey) {
    /* Steel's onboarding, three weeks in: weeks 1 and 2 done, Week 3 next */
    const o = fx.onboardings.find(x => x.id === 1); o.status = 'active'; o.started_at = '2026-09-08'; o.completed_at = null;
    const sec = {}; fx.onboarding_template.forEach(t => { sec[t.id] = t.section; });
    fx.onboarding_steps.forEach(s => { if (s.onboarding_id !== 1) return; const w = sec[s.template_id]; const d = w === 'WEEK 1' || w === 'WEEK 2'; s.done = d; s.done_at = d ? '2026-09-15T15:00:00Z' : null; s.done_by = d ? 'Steel' : null; });
  }
  return fx;
}
const SERV = { me: { name: 'Steel', department: 'board' }, ops: { name: 'Ahmed', title: 'Operations Lead, Montreal' }, year: { from: '2025-10-01', to: '2026-09-30', done: 1, target: 4 },
  servings: [
    { id: 900, code: 'WA-26-21', date: '2026-10-04', start: '12:00', title: 'Sunday serving', location: 'Place Émilie-Gamelin', partner: null, mine: null },
    { id: 901, code: 'WA-26-22', date: '2026-10-11', start: '12:00', title: 'Sunday serving', location: 'Place Émilie-Gamelin', partner: null, mine: { status: 'Confirmed', role: 'server', confirmed: true } },
    { id: 902, code: 'WA-26-23', date: '2026-10-18', start: '12:00', title: 'Sunday serving', location: 'Place Émilie-Gamelin', partner: 'Oberoi Financial Group', mine: null }
  ] };
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_staff: true, wa191_onb_servings: SERV, wa191_onb_signup: { ok: true, dates: 'Sunday, October 4; Sunday, October 18', ops: 'Ahmed', request: 77, step: true } };
const pick = f => f.ev(() => { const el = document.querySelector('#w122sheet .w191onb'); return el ? { on: el.classList.contains('on'), txt: el.innerText.replace(/\s+/g, ' ').trim(), rows: [...el.querySelectorAll('.sv')].map(l => ({ cls: l.className, dis: l.querySelector('input').disabled, ck: l.querySelector('input').checked, t: l.innerText.replace(/\s+/g, ' ').trim() })) } : null; });
const record = f => f.ev(() => { window.__calls = []; const r0 = db.rpc.bind(db); db.rpc = function (fn, a) { window.__calls.push({ fn: fn, a: JSON.parse(JSON.stringify(a || {})) }); if (window.__fail && window.__fail[fn]) return Promise.resolve({ data: null, error: { message: window.__fail[fn] } }); return r0(fn, a); }; });
const calls = (f, fn) => f.ev(fn => (window.__calls || []).filter(c => c.fn === fn), fn);

(async () => {
  const browser = await launch();
  try {
    /* 1. the lesson, on a laptop */
    let f = await fresh(browser, { who: 'admin', hash: '#training/t/' + LESSON, fixture: fixture(), rpcs: RPCS, width: 1366, wait: 4200 });
    await record(f);
    ok('the lesson opens on its first chapter: no picker yet', await f.ev(() => !!document.querySelector('#w122sheet.on .sh') && !document.querySelector('#w122sheet .w191onb')));
    await f.page.click('#w122sheet [data-w122ch="1"]'); await f.page.waitForTimeout(900);
    const les = await f.ev(() => { const m = document.querySelector('#w122sheet .main'); return { title: (m.querySelector('.cht') || {}).textContent, photos: m.querySelectorAll('.w167phs figure.w167ph img').length, req: !!m.querySelector('.callout.warn') && /Required: four servings a year/.test(m.querySelector('.callout.warn').textContent), cards: m.querySelectorAll('.cards .c').length, h: [...m.querySelectorAll('h3')].map(h => h.textContent) }; });
    ok('the chapter: Why you volunteer, the photos, required four times a year, why', les.title === 'Why you volunteer' && les.photos === 2 && les.req && les.cards === 3 && les.h.indexOf('Choose your servings') >= 0, les);
    let p = await pick(f);
    ok('the picker fills in', p && p.on && p.rows.length === 3, p);
    ok('this year: 1 of 4, October to September', p && /Your servings this year/.test(p.txt) && /October 2025 to September 2026/.test(p.txt) && /1 of 4/.test(p.txt), p && p.txt.slice(0, 200));
    ok('the servings: the date, the time, the place, a partner', p && /Sunday, October 4/.test(p.rows[0].t) && /12:00 pm · Place Émilie-Gamelin · Sunday serving/.test(p.rows[0].t) && /with Oberoi Financial Group/.test(p.rows[2].t), p && p.rows);
    ok('one they are on already: says so, ticked, cannot be unticked', p && /mine/.test(p.rows[1].cls) && p.rows[1].dis && p.rows[1].ck && /You are on it/i.test(p.rows[1].t), p && p.rows[1]);
    ok('asked once', (await calls(f, 'wa191_onb_servings')).length <= 1);
    ok('the roles: serve, take photos, welcome people; serve first', await f.ev(() => { const r = [...document.querySelectorAll('#w122sheet .w191onb input[name="w191onbrole"]')]; return r.map(x => x.value).join(',') === 'server,photographer,community_talker' && r[0].checked; }));
    ok('the message is for the operations lead', p && /A message for Ahmed \(Operations Lead, Montreal, optional\)/.test(p.txt));
    await f.page.click('#w122sheet .w191onb [data-w191onb="go"]'); await f.page.waitForTimeout(300);
    ok('nothing chosen: says so, nothing sent', /Choose at least one serving/.test((await pick(f)).txt) && (await calls(f, 'wa191_onb_signup')).length === 0);
    await f.page.check('#w122sheet .w191onb input[data-w191onbev="900"]'); await f.page.check('#w122sheet .w191onb input[data-w191onbev="902"]');
    await f.page.click('#w122sheet .w191onb .roles label:nth-child(2)'); await f.page.waitForTimeout(100);
    await f.page.fill('#w122sheet .w191onb textarea', 'Hi Ahmed, happy to help with photos.');
    p = await pick(f);
    ok('chosen: the servings light up, the error goes', p && /\bon\b/.test(p.rows[0].cls) && /\bon\b/.test(p.rows[2].cls) && !/Choose at least one serving/.test(p.txt), p && p.rows.map(r => r.cls));
    if (SHOTS) { await f.ev(() => document.querySelector('#w122sheet .w191onb').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(200); await (await f.page.$('#w122sheet .w191onb')).screenshot({ path: SHOTS + '/onb_lesson_picker.png' }); }
    await f.page.click('#w122sheet .w191onb [data-w191onb="go"]'); await f.page.waitForTimeout(700);
    const s1 = await calls(f, 'wa191_onb_signup');
    ok('Confirm sends the servings, the role and the message', s1.length === 1 && JSON.stringify(s1[0].a.p_events) === '[900,902]' && s1[0].a.p_role === 'photographer' && s1[0].a.p_message === 'Hi Ahmed, happy to help with photos.', s1);
    p = await pick(f);
    ok('confirmed: the dates, the operations lead has the message, the step is done', p && /You are confirmed for Sunday, October 4; Sunday, October 18\./.test(p.txt) && /Ahmed has your message in the Operations Montreal inbox/.test(p.txt) && /Mandatory volunteering is done/.test(p.txt), p && p.txt.slice(0, 400));
    ok('the servings are asked again after confirming', (await calls(f, 'wa191_onb_servings')).length >= 1);
    if (SHOTS) await (await f.page.$('#w122sheet .w191onb')).screenshot({ path: SHOTS + '/onb_lesson_done.png' });
    await f.page.click('#w122sheet .w191onb [data-w191onb="more"]'); await f.page.waitForTimeout(300);
    p = await pick(f);
    ok('Choose more servings: the list again, nothing chosen, the message cleared', p && p.rows.length === 3 && !p.rows[0].ck && !p.rows[2].ck && await f.ev(() => document.querySelector('#w122sheet .w191onb textarea').value === ''), p && p.rows);
    /* a server error shows, and nothing is lost */
    await f.ev(() => { window.__fail = { wa191_onb_signup: 'ERROR:  Those servings are not open any more. Pick another one.' }; });
    await f.page.check('#w122sheet .w191onb input[data-w191onbev="900"]');
    await f.page.click('#w122sheet .w191onb [data-w191onb="go"]'); await f.page.waitForTimeout(500);
    p = await pick(f);
    ok('a server error: says what happened, the choice is kept', p && /Those servings are not open any more\. Pick another one\./.test(p.txt) && !/ERROR/.test(p.txt) && p.rows[0].ck && /Confirm my servings/.test(p.txt), p && p.txt.slice(-300));
    /* no onboarding step to tick (someone outside an onboarding): the box does not mention it */
    await f.ev(() => { window.__fail = {}; window.__WA_RPCS.wa191_onb_signup = { ok: true, dates: 'Sunday, October 4', ops: 'Ahmed', request: 78, step: false }; });
    await f.page.click('#w122sheet .w191onb [data-w191onb="go"]'); await f.page.waitForTimeout(600);
    p = await pick(f);
    ok('no step to tick: the box does not mention one', p && /You are confirmed for Sunday, October 4\./.test(p.txt) && /Ahmed has your message in the Operations Montreal inbox\./.test(p.txt) && !/Mandatory volunteering/.test(p.txt), p && p.txt.slice(0, 300));
    ok('no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* 2. not a team member */
    f = await fresh(browser, { who: 'admin', hash: '#training/t/' + LESSON, fixture: fixture(), rpcs: RPCS, width: 1366, wait: 4200 });
    await record(f); await f.ev(() => { window.__fail = { wa191_onb_servings: 'Team members only' }; });
    await f.page.click('#w122sheet [data-w122ch="1"]'); await f.page.waitForTimeout(800);
    p = await pick(f);
    ok('not a team member: says so, no list', p && /Choosing servings here is for team members/.test(p.txt) && p.rows.length === 0, p);
    await f.close();

    /* 3. the phone */
    f = await fresh(browser, { who: 'admin', hash: '#training/t/' + LESSON, fixture: fixture(), rpcs: RPCS, width: 390, wait: 4200 });
    await f.page.click('#w122sheet .chfoot [data-w122ch="1"]');   /* the phone has no chapter rail: Next */ await f.page.waitForTimeout(900);
    const ph = await f.ev(() => { const el = document.querySelector('#w122sheet .w191onb'); const r = el.getBoundingClientRect(); const m = document.querySelector('#w122sheet .main'); return { w: r.width, right: r.right, vw: window.innerWidth, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, mover: m ? m.scrollWidth - m.clientWidth : 0, rows: el.querySelectorAll('.sv').length }; });
    ok('phone: the picker fits, nothing scrolls sideways', ph.rows === 3 && ph.right <= ph.vw + 1 && ph.over <= 1 && ph.mover <= 1, ph);
    if (SHOTS) await (await f.page.$('#w122sheet .w191onb')).screenshot({ path: SHOTS + '/onb_phone.png' });
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();

    /* 4. the journey: Week 3's page */
    f = await fresh(browser, { who: 'admin', hash: '#training/onboarding', fixture: fixture({ journey: true }), rpcs: RPCS, width: 1366, wait: 5200 });
    await f.page.waitForTimeout(1200);
    const jw = await f.ev(() => { const sh = document.querySelector('#w122sheet .sh.w167'); if (!sh) return { journey: false }; const w = sh.querySelector('.w191onbw'); const on = sh.querySelector('.w167stop.on'); return { journey: true, wk: on && on.getAttribute('data-w167wk'), box: !!w, h: w && w.querySelector('h3').textContent, p: w && w.querySelector('p').textContent, filled: !!(w && w.querySelector('.w191onb.on .sv')), rows: w ? w.querySelectorAll('.sv').length : 0, why: (sh.querySelector('.w167learn .wy p') || {}).textContent || '', learn: [...sh.querySelectorAll('.w167learn .ob li')].map(x => x.textContent) }; });
    ok('the journey opens on Week 3', jw.journey && jw.wk === 'WEEK 3', jw);
    ok('Week 3: Choose your servings, four times a year, the picker filled', jw.box && /Choose your servings/.test(jw.h) && /four times a year/.test(jw.p) && jw.filled && jw.rows === 3, jw);
    ok('Week 3: why it matters says four times a year; the goals say choose your servings', /four times a year/.test(jw.why) && jw.learn.some(x => /Choose your first servings/.test(x)), { why: jw.why, learn: jw.learn });
    if (SHOTS) { await f.ev(() => document.querySelector('.w191onbw').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(250); await (await f.page.$('.w191onbw')).screenshot({ path: SHOTS + '/onb_journey_week3.png' }); }
    await f.page.click('#w122sheet .w167stop[data-w167wk="WEEK 2"]'); await f.page.waitForTimeout(500);
    ok('another week: no picker', await f.ev(() => !document.querySelector('#w122sheet .w191onbw')));
    await f.page.click('#w122sheet .w167stop[data-w167wk="WEEK 3"]'); await f.page.waitForTimeout(700);
    ok('back to Week 3: the picker again', await f.ev(() => !!document.querySelector('#w122sheet .w191onbw .w191onb.on .sv')));
    ok('no page errors (journey)', f.errs.length === 0, f.errs);
    await f.close();
  } catch (e) { fail++; console.log('FAIL crashed :: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
