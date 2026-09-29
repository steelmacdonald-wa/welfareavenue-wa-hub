/* w167drive.js: wave167, the onboarding journey. Steel (29/09/26): "Make the onboarding interactive with our branding
   highlighted everywhere. Use photos and make it the best most educational onboarding possible."
   The plan and the Academy come from the live database (scratchpad fx166.json, as in w166drive) plus what wa167_journey adds
   (scratchpad fx167.json, written by build/data/wa167_journey.py): the four lessons, the steps that open the weeks and the
   journey's settings. The member doing the plan is the test member (Samson, HR), who finished the Chrome video and the nine Hub
   modules. Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). CAND=build/candidate167.html until it is the build. */
const fs = require('fs');
const { launch, fresh, loadFixture } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }

const LIVE = {}; JSON.parse(fs.readFileSync(SP + 'fx166.json', 'utf8')).forEach(r => { LIVE[r.k] = r.v; });
const X = JSON.parse(fs.readFileSync(SP + 'fx167.json', 'utf8'));
const DUE = { 'WEEK 1': 7, 'WEEK 2': 14, 'WEEK 3': 21, 'WEEK 4': 28, '60 DAYS': 60 };
function plus(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }

function fx() {
  const f = loadFixture();
  ['onboarding_template', 'onboardings', 'onboarding_steps', 'hr_setup_template', 'hr_setup_steps', 'academy_paths', 'trainings'].forEach(k => { f[k] = JSON.parse(JSON.stringify(LIVE[k])); });
  const o = f.onboardings.find(x => x.id === 4); o.person_name = 'Samson'; o.member_id = 36;
  /* what wa167_journey does */
  f.trainings.forEach(t => { if (t.path_group === 'Your first week') t.path_group = 'Your onboarding'; });
  f.academy_paths.forEach(p => { if (p.key === 'firstweek') { p.name = 'Your onboarding'; p.title = 'Your onboarding'; p.cert_title = 'Welcome to Welfare Avenue'; } });
  X.lessons.forEach((l, i) => f.trainings.push({ id: 990301 + i, category: 'Onboarding', title: l.title, description: l.body.summary, source: 'hub', path_group: 'Your onboarding', sort: l.sort, active: true, kind: 'lesson', key: l.key, minutes: l.minutes, body: l.body }));
  let sid = 995000;
  X.steps.forEach(s => {
    const tr = f.trainings.find(t => t.key === s.key);
    f.onboarding_template.push({ id: s.id, section: s.section, parent_id: null, name: s.name, description: s.description, sort: 1, priority: 'high', active: true, content_pending: false, clickup_url: null, academy_path: null, training_id: tr.id });
    f.onboardings.filter(x => x.status === 'active').forEach(x => f.onboarding_steps.push({ id: ++sid, onboarding_id: x.id, template_id: s.id, done: false, done_at: null, done_by: null, due_date: plus(x.started_at, DUE[s.section]) }));
  });
  f.onboarding_template.sort((a, b) => (a.sort - b.sort) || String(a.id).localeCompare(String(b.id)));
  f.app_config = (f.app_config || []).filter(r => r.key !== 'onboarding_journey').concat([{ key: 'onboarding_journey', value: JSON.stringify(X.journey) }]);
  /* the test member finished the Chrome video and the nine Hub modules */
  const key = k => f.trainings.find(t => t.key === k);
  const hub = f.trainings.filter(t => t.path_group === 'Using the Hub');
  f.training_progress = [key('onb:chrome')].concat(hub).map((t, i) => ({ id: 880000 + i, training_id: t.id, person_name: 'Samson', email: 'samson.jules@welfareavenue.com', status: 'done', done_at: '2026-09-24T15:00:00Z', pct: 100 }));
  f.onboarding_help = [];
  f.wa_history = [
    { id: 2, date_start: '2020-04-01', title: 'Welfare Avenue begins: an awareness video and the first GoFundMe', summary: 'Welfare Avenue began in April 2020 with 100 sandwiches and an awareness video.', highlight: true, visibility: 'everyone', status: 'ok' },
    { id: 68, date_start: '2023-10-18', title: 'Welfare Avenue becomes a registered charity', summary: 'The Canada Revenue Agency registered Welfare Avenue as a charity effective 18 October 2023.', highlight: true, visibility: 'everyone', status: 'ok' },
    { id: 999, date_start: '2025-01-01', title: 'A leaders-only moment', summary: 'Not for everyone.', highlight: true, visibility: 'leaders', status: 'ok' }
  ];
  return f;
}

(async () => {
  const browser = await launch();
  const FX = fx();
  const cand = process.env.CAND || undefined;

  /* 1. the journey, as the member doing the plan */
  {
    const f = await fresh(browser, { who: 'member', width: 1366, hash: '#training/onboarding', fixture: JSON.parse(JSON.stringify(FX)), wait: 5200, candidate: cand });
    const p = f.page;
    await p.waitForTimeout(1200);
    const j = await f.ev(() => {
      const sh = document.querySelector('#w122sheet .sh'); if (!sh) return null;
      const q = s => sh.querySelector(s), qa = s => [...sh.querySelectorAll(s)];
      const hero = q('.w167hero');
      const weeks = qa('.onbwrap details.w37week').map(d => ({ on: d.classList.contains('w167on'), shown: getComputedStyle(d).display !== 'none', sum: getComputedStyle(d.querySelector('summary')).display }));
      const lessonRow = q('.onbwrap [data-w166t="wa167w1"]');
      return {
        mode: sh.classList.contains('w167'),
        heroBg: hero && hero.style.backgroundImage, logo: !!(hero && hero.querySelector('img.lg[src*="brand/logo-lockup-cream"]')), doodle: !!(hero && hero.querySelector('img[src*="doodle-star-gold"]')),
        h1: hero && hero.querySelector('h1').textContent, ey: hero && hero.querySelector('.ey').textContent, line: hero && hero.querySelector('p').textContent,
        tag: hero && (hero.querySelector('.tag') || {}).textContent, ring: hero && hero.querySelector('.rg').textContent,
        cta: hero && [...hero.querySelectorAll('.cta button')].map(b => b.textContent + '|' + (b.getAttribute('data-w166open') || b.getAttribute('data-w167go') || b.getAttribute('data-w167person') || '')),
        stops: qa('.w167stop').map(s => ({ t: s.querySelector('b').textContent, on: s.classList.contains('on'), cur: s.classList.contains('cur'), e: !!s.querySelector('img.e'), pic: s.querySelector('.pic').style.backgroundImage, n: s.querySelector('.n').textContent })),
        ban: (q('.w167ban h2') || {}).textContent, banBg: (q('.w167ban') || { style: {} }).style.backgroundImage, k: (q('.w167ban .k') || {}).textContent,
        learn: qa('.w167learn .ob li').map(x => x.textContent), why: (q('.w167learn .wy p') || {}).textContent,
        feat: q('.w167feat') ? { t: q('.w167feat .tx b').textContent, b: q('.w167feat button').textContent, go: q('.w167feat button').getAttribute('data-w166open') } : null,
        weeks, lessonHidden: lessonRow ? getComputedStyle(lessonRow).display === 'none' : null,
        help: !!q('.w167steps #w166help'), ppl: qa('.w167pc').map(x => x.querySelector('em').textContent + ' ' + x.querySelector('b').textContent), team: qa('.w167team button span:last-child').map(x => x.textContent),
        nums: qa('.w167num .g b').map(x => x.textContent), dyk: (q('.w167dyk .tx b') || {}).textContent, dykYr: (q('.w167dyk .yr') || {}).textContent,
        intro: getComputedStyle(q('.main .wrap > .prose') || document.body).display, head: (q('.hd .kk span:last-child') || {}).textContent
      };
    });
    ok('the plan opens as the journey', j && j.mode, j);
    ok('the welcome: a real photo, the logo, a doodle, the person’s first name and their day', j && /content-images\/photos\/web\/2024-07-summer-team-under-the-tent\.jpg/.test(j.heroBg) && j.logo && j.doodle && /Welcome, Samson/.test(j.h1) && /day 1/i.test(j.ey), j && { bg: j.heroBg, h1: j.h1, ey: j.ey });
    ok('with the brand line and how far they are (3 of 45 steps)', j && /Service is solidarity, not charity/.test(j.tag) && /3 of 45 steps/.test(j.ring) && /7%/.test(j.ring), j && { tag: j.tag, ring: j.ring });
    ok('the first thing to do opens the week 1 lesson (Start here), and the lead is one click away', j && /^Start here: Welcome to Welfare Avenue\|t:990301$/.test(j.cta[0]) && /^Your lead: Valex\|/.test(j.cta[1] || ''), j && j.cta);
    ok('the avenue: five stops with their photos, titles and counts', j && j.stops.map(s => s.t).join('|') === 'Get set up|Who we are|Your team|Look back|Grow' && j.stops.every(s => /photos\/web\//.test(s.pic)) && j.stops[0].n === '2 of 22', j && j.stops);
    ok('the E that moves stands at the week they are in (week 1), which is open', j && j.stops[0].cur && j.stops[0].e && j.stops[0].on && j.stops.filter(s => s.e).length === 1, j && j.stops);
    ok('the week: its photo, due date, what they will learn and why it matters', j && j.ban === 'Get set up' && /2024-10-autumn-volunteers-plating/.test(j.banBg) && /Week 1 · due Oct 2/.test(j.k) && j.learn.length === 3 && /Why/.test('Why') && /tools/.test(j.why), j && { ban: j.ban, k: j.k, learn: j.learn, why: j.why });
    ok('the week opens with its lesson (Start here), which opens it in the Academy', j && j.feat && j.feat.t === 'Welcome to Welfare Avenue' && j.feat.b === 'Start the lesson' && j.feat.go === 't:990301', j && j.feat);
    ok('only that week’s steps show, without their own heading, and the lesson is not listed twice', j && j.weeks.filter(w => w.shown).length === 1 && j.weeks[0].on && j.weeks[0].shown && j.weeks[0].sum === 'none' && j.lessonHidden === true, j && { weeks: j.weeks, lesson: j.lessonHidden });
    ok('Ask for help sits under the steps', j && j.help, j);
    ok('your people: your lead and our co-executive directors, and your team', j && /Your lead Valex/.test(j.ppl[0] || '') && j.ppl.some(x => /Co-executive director Steel/.test(x)) && j.ppl.some(x => /Co-executive director Suhaib/.test(x)) && j.team.indexOf('Tuna') >= 0 && j.team.indexOf('Valex') < 0 && j.team.indexOf('Samson') < 0, j && { ppl: j.ppl, team: j.team });
    ok('Welfare Avenue in numbers', j && j.nums.join('|') === '2020|20,000+|700+|3,000+|3', j && j.nums);
    ok('Did you know? shows a moment from our story (open ones only)', j && j.dyk && !/leaders-only/.test(j.dyk) && /^(2020|2023)$/.test(j.dykYr), j && { dyk: j.dyk, yr: j.dykYr });
    ok('the old intro paragraph gives way to the journey; the header still counts the steps', j && j.intro === 'none' && j.head === '3 of 45 steps', j && { intro: j.intro, head: j.head });

    /* choosing a stop */
    const w2 = await f.ev(async () => {
      document.querySelector('#w122sheet .w167stop[data-w167wk="WEEK 2"]').click(); await new Promise(r => setTimeout(r, 300));
      const sh = document.querySelector('#w122sheet .sh');
      const shown = [...sh.querySelectorAll('.onbwrap details.w37week')].filter(d => getComputedStyle(d).display !== 'none').map(d => d.querySelector('summary').firstChild.textContent.trim());
      return { ban: sh.querySelector('.w167ban h2').textContent, on: [...sh.querySelectorAll('.w167stop.on b')].map(b => b.textContent), shown, feat: sh.querySelector('.w167feat .tx b').textContent, cur: [...sh.querySelectorAll('.w167stop.cur b')].map(b => b.textContent) };
    });
    ok('choosing Who we are shows week 2 (its banner, its lesson, its steps); the E stays where they are', w2 && w2.ban === 'Who we are' && w2.on.join() === 'Who we are' && w2.shown.join() === 'WEEK 2' && w2.feat === 'Who we are' && w2.cur.join() === 'Get set up', w2);

    /* Continue: back to the week of the next step, the step shown */
    const cont = await f.ev(async () => {
      window.w167.select('WEEK 3');
      /* the next step, once the lesson is done, is an ordinary one: pretend the lesson is passed */
      const t = window.w122.A.byKey['onb:w1']; window.w122.A.prog.push({ training_id: t.id, person_name: 'Samson', status: 'done', done_at: '2026-09-25T15:00:00Z' });
      window.w167.refresh(); await new Promise(r => setTimeout(r, 200));
      const b = document.querySelector('#w122sheet .w167hero [data-w167go="next"]'); const label = b ? b.textContent : null;
      if (b) b.click(); await new Promise(r => setTimeout(r, 900));
      const sh = document.querySelector('#w122sheet .sh');
      const flash = sh.querySelector('.w37step.w167flash');
      return { label, on: [...sh.querySelectorAll('.w167stop.on b')].map(x => x.textContent), flash: flash ? flash.getAttribute('data-w166t') : null, feat: sh.querySelector('.w167feat .tx span').textContent };
    });
    ok('once the week 1 lesson is passed, its card says so, and Continue names the next step', cont && /^Continue: The Hub$/.test(cont.label) && /passed its knowledge check/.test(cont.feat), cont);
    ok('Continue opens the week of the next step and shows the step', cont && cont.on.join() === 'Get set up' && cont.flash === 'wa166hub', cont);

    /* a week finished: the celebration */
    const cel = await f.ev(async () => {
      const ids = {}; (WA37.tmpl || []).forEach(t => { if (t.section === 'WEEK 1') ids[t.id] = 1; });
      WA37.steps.forEach(s => { if (String(s.onboarding_id) === '4' && ids[s.template_id]) s.done = true; });
      window.w167.refresh(); await new Promise(r => setTimeout(r, 300));
      const c = document.querySelector('#w122sheet .w167cel');
      const r = c ? { h: c.querySelector('h3').textContent, p: c.querySelector('p').textContent, next: (c.querySelector('[data-w167wk]') || {}).textContent, canvas: !!c.querySelector('canvas'), e: !!c.querySelector('img.e') } : null;
      if (c) { c.querySelector('[data-w167wk]').click(); await new Promise(r2 => setTimeout(r2, 300)); }
      const sh = document.querySelector('#w122sheet .sh');
      return { r, gone: !sh.querySelector('.w167cel'), on: [...sh.querySelectorAll('.w167stop.on b')].map(x => x.textContent), done: [...sh.querySelectorAll('.w167stop.done b')].map(x => x.textContent), cur: [...sh.querySelectorAll('.w167stop.cur b')].map(x => x.textContent) };
    });
    ok('finishing week 1 celebrates it (confetti, the E, what is next)', cel && cel.r && cel.r.h === 'Week 1 done!' && /Every step of Get set up is done/.test(cel.r.p) && /Next stop: Who we are/.test(cel.r.next) && cel.r.canvas && cel.r.e, cel);
    ok('Next stop closes it and opens week 2; week 1 shows done and the E moves on', cel && cel.gone && cel.on.join() === 'Who we are' && cel.done.indexOf('Get set up') >= 0 && cel.cur.join() === 'Who we are', cel);
    const again = await f.ev(async () => { window.w167.refresh(); await new Promise(r => setTimeout(r, 200)); return !!document.querySelector('#w122sheet .w167cel'); });
    ok('a week is celebrated once', again === false, again);

    /* the lesson: photos, our numbers, a knowledge check; the journey stays out of it */
    const les = await f.ev(async () => {
      location.hash = '#training/t/990302'; await new Promise(r => setTimeout(r, 900));
      const sh = document.querySelector('#w122sheet .sh');
      const imgs = [...sh.querySelectorAll('figure.w167ph img')].map(i => i.getAttribute('src'));
      const rail = [...sh.querySelectorAll('.rail .ri')].map(x => x.textContent.replace(/^\d+/, '').trim());
      return { mode: sh.classList.contains('w167'), title: (sh.querySelector('.hd h2') || {}).textContent, imgs, cap: (sh.querySelector('figure.w167ph figcaption') || {}).textContent, rail };
    });
    ok('the week 2 lesson opens with its photo and caption', les && les.title === 'Week 2: Who we are' && les.imgs.length >= 1 && /content-images\/photos\/web\/2022-02-winter-volunteer-group-b\.jpg$/.test(les.imgs[0]) && /winter crew/.test(les.cap), les);
    ok('its chapters and its knowledge check', les && les.rail.join('|') === 'Our mission|Our story|A Sunday serving|How we speak|Knowledge check', les && les.rail);
    ok('the journey stays out of a lesson', les && les.mode === false, les);
    const story = await f.ev(async () => {
      document.querySelector('#w122sheet [data-w122ch="1"]').click(); await new Promise(r => setTimeout(r, 300));
      const sh = document.querySelector('#w122sheet .sh');
      return { stages: sh.querySelectorAll('.stages .g').length, pair: sh.querySelectorAll('.w167phs figure.w167ph').length };
    });
    ok('Our story: the moments on a line and two photos side by side', story && story.stages === 11 && story.pair === 2, story);
    ok('no page errors (the journey)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. on a phone */
  {
    const f = await fresh(browser, { who: 'member', width: 390, hash: '#training/onboarding', fixture: JSON.parse(JSON.stringify(FX)), wait: 5200, candidate: cand });
    await f.page.waitForTimeout(1200);
    const r = await f.ev(() => {
      const sh = document.querySelector('#w122sheet .sh'); if (!sh) return null;
      const road = sh.querySelector('.w167road'), hero = sh.querySelector('.w167hero').getBoundingClientRect();
      return { mode: sh.classList.contains('w167'), vw: window.innerWidth, heroR: hero.right, roadScroll: road.scrollWidth > road.clientWidth, sw: document.documentElement.scrollWidth, mainSW: sh.querySelector('.main').scrollWidth, mainCW: sh.querySelector('.main').clientWidth };
    });
    ok('on a phone the journey fits the screen; the avenue scrolls sideways on its own', r && r.mode && r.heroR <= r.vw + 1 && r.sw <= r.vw + 1 && r.mainSW <= r.mainCW + 1 && r.roadScroll, r);
    await f.page.screenshot({ path: SP + 'w167_phone.png' });
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. someone with no plan sees the Academy's own message, untouched */
  {
    const f = await fresh(browser, { who: 'leader', width: 1366, hash: '#training/onboarding', fixture: JSON.parse(JSON.stringify(FX)), wait: 5000, candidate: cand });
    const r = await f.ev(() => { const sh = document.querySelector('#w122sheet .sh'); return sh ? { mode: sh.classList.contains('w167'), txt: sh.textContent.slice(0, 200) } : null; });
    ok('no plan, no journey: the Academy says HR has not assigned one', r && !r.mode && /has not assigned your onboarding plan/.test(r.txt), r);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
