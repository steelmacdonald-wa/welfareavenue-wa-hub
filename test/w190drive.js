/* w190drive.js: wave190, the reading pass. Steel (30/09/26): "Can you revist some of the trainings and onboarding to ensure
   everything is please to read and that it's well branded".
   The Avenue Academy and the master onboarding come from test/fx_w190.json (the live rows of 01/10/26 with the words of
   wa190_reading_pass) laid over test/fixture.json. Checks: the brand's faces in the Academy (Space Grotesk to read, Barlow
   Condensed for titles, the gold rule under a chapter), the reading layout (## headings, numbered steps with their points,
   callouts, numbering that carries on after a paragraph, older text still drawn), the onboarding steps (the to-do as a gold box,
   the italic line as a note, in the plan and in the HR centre), no old address or ClickUp in what a new person reads, phones.
   SHOTS=<dir> saves screenshots. CAND=<file> tests another build (the live one, for the before pictures).
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS || '';
const X = JSON.parse(fs.readFileSync(path.join(__dirname, 'fx_w190.json'), 'utf8'));

function fx() {
  const f = loadFixture(path.join(__dirname, 'fixture.json'));
  f.trainings = JSON.parse(JSON.stringify(X.trainings));
  f.onboarding_template = JSON.parse(JSON.stringify(X.onboarding_template));
  f.academy_paths = JSON.parse(JSON.stringify(X.academy_paths));
  f.app_config = (f.app_config || []).filter(r => !X.app_config.some(x => x.key === r.key)).concat(JSON.parse(JSON.stringify(X.app_config)));
  /* nobody has started anything here, so every reading opens fresh */
  f.training_progress = [];
  return f;
}
async function shot(p, name) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, name + '.png') }); } }
async function openT(f, id) { await f.hash('#training/t/' + id, 1500); }

(async () => {
  const browser = await launch();
  const cand = process.env.CAND || undefined;

  /* 1. the Avenue Academy and its reader, as Steel */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#training', fixture: fx(), wait: 5200, candidate: cand });
    const p = f.page;
    await p.waitForTimeout(800);
    const home = await f.ev(() => {
      const w = document.getElementById('w122'); if (!w) return null;
      const cs = el => el ? getComputedStyle(el) : null;
      const h1 = w.querySelector('.w122hero h1'), h2 = w.querySelector('.w122sech h2'), body = cs(w);
      return { body: body && body.fontFamily, h1: h1 && cs(h1).fontFamily, h1up: h1 && cs(h1).textTransform, h2: h2 && cs(h2).fontFamily, h2col: h2 && cs(h2).color };
    });
    ok('the Academy reads in Space Grotesk', home && /Space Grotesk/.test(home.body), home);
    ok('its titles are Barlow Condensed in capitals (the hero and the sections, the sections in the green)', home && /Barlow Condensed/.test(home.h1) && home.h1up === 'uppercase' && /Barlow Condensed/.test(home.h2) && home.h2col === 'rgb(16, 63, 57)', home);
    await shot(p, '01_academy_home');

    await openT(f, 39);
    const m1 = await f.ev(() => {
      const sh = document.querySelector('#w122sheet .sh'); if (!sh) return null;
      const pr = sh.querySelector('.prose'), h2 = sh.querySelector('.hd h2');
      return {
        title: h2 && h2.textContent, h2font: h2 && getComputedStyle(h2).fontFamily,
        h3: [...pr.querySelectorAll('h3')].map(x => x.textContent), h3font: pr.querySelector('h3') && getComputedStyle(pr.querySelector('h3')).fontFamily,
        lead: !!pr.querySelector('p.lead'), uls: pr.querySelectorAll('ul').length, li: pr.querySelectorAll('li').length,
        calls: [...pr.querySelectorAll('.callout b')].map(x => x.textContent), raw: /(^|\n)\s*#{2}\s/.test(pr.innerText) || pr.innerHTML.indexOf('**') >= 0,
        apps: /Volunteer Manager/.test(pr.textContent), text: pr.textContent.length
      };
    });
    ok('Hub module 1 opens with a lead, five headings (and See it for yourself) and its lists', m1 && m1.lead && m1.h3.length === 6 && m1.uls >= 2 && m1.li >= 10, m1);
    ok('its headings are the brand title face, and no ## or ** shows', m1 && /Barlow Condensed/.test(m1.h3font) && /Barlow Condensed/.test(m1.h2font) && !m1.raw, m1);
    ok('its callouts: Good to know, Try it, Done when', m1 && m1.calls.join('|') === 'Good to know|Try it|Done when', m1 && m1.calls);
    ok('the apps include the Volunteer Manager (wave176)', m1 && m1.apps, m1);
    await shot(p, '02_module1_top');
    await f.ev(() => { const m = document.querySelector('#w122sheet .main'); if (m) m.scrollTop = 900; });
    await p.waitForTimeout(300);
    await shot(p, '03_module1_lower');

    /* numbered steps with their points (the imported SOP), numbering that carries on after a paragraph */
    await openT(f, 148);
    const sop = await f.ev(() => {
      const pr = document.querySelector('#w122sheet .prose'); if (!pr) return null;
      const ol = pr.querySelector('ol.w190ol');
      const li = ol ? [...ol.children] : [];
      const b = li[0] ? getComputedStyle(li[0], '::before') : null;
      return { items: li.length, sub: li.filter(x => x.querySelector('ul')).length, num: b && b.content, numBg: b && b.backgroundColor, calls: [...pr.querySelectorAll('.callout b')].map(x => x.textContent) };
    });
    ok('the partners SOP: eight numbered steps, each with its points', sop && sop.items === 8 && sop.sub === 8, sop);
    ok('the step numbers are green circles (CSS counters)', sop && sop.num && sop.num !== 'none' && sop.numBg === 'rgb(16, 63, 57)', sop);
    ok('its Watch out and Tip callouts', sop && sop.calls.indexOf('Watch out') >= 0 && sop.calls.indexOf('Tip') >= 0, sop && sop.calls);
    await shot(p, '04_sop_steps');
    await openT(f, 113);
    const ns = await f.ev(() => { const pr = document.querySelector('#w122sheet .prose'); const ol = pr && pr.querySelector('ol.w190ol'); return ol ? { items: ol.children.length, nested: ol.querySelectorAll('li ul li').length, bold: !!ol.querySelector('li > b') } : null; });
    ok('setting up a new person: six numbered steps, the first with its three points', ns && ns.items === 6 && ns.nested === 3 && ns.bold, ns);

    /* older text still draws: a Keela reading from Slack (a heading that is a link, lists) */
    await openT(f, 151);
    const keela = await f.ev(() => { const pr = document.querySelector('#w122sheet .prose'); if (!pr) return null; const hs = [...pr.querySelectorAll('h3, h4')].filter(x => x.querySelector('a')); return { heads: hs.length, h4link: hs.length >= 2, uls: pr.querySelectorAll('ul').length, raw: pr.textContent.indexOf('**') >= 0 || pr.textContent.indexOf('](http') >= 0 }; });
    ok('an older reading from Slack: its bold link lines are headings that keep their link, its lists are lists', keela && keela.h4link && keela.uls >= 2 && !keela.raw, keela);

    /* a lesson: the chapter title in the brand face with the gold rule */
    const w1 = X.trainings.find(t => t.key === 'onb:w1');
    await openT(f, w1.id);
    const les = await f.ev(() => {
      const c = document.querySelector('#w122sheet .cht'); if (!c) return null;
      const a = getComputedStyle(c, '::after');
      return { font: getComputedStyle(c).fontFamily, up: getComputedStyle(c).textTransform, rule: a.backgroundColor, w: a.width };
    });
    ok('a lesson chapter: Barlow Condensed in capitals, with the gold rule under it', les && /Barlow Condensed/.test(les.font) && les.up === 'uppercase' && les.rule === 'rgb(220, 165, 39)' && les.w === '56px', les);
    await shot(p, '05_lesson_chapter');
    const tools = await f.ev(async () => {
      const b = [...document.querySelectorAll('#w122sheet [data-w122ch]')].filter(x => /Your tools|tools/i.test(x.textContent))[0];
      if (b) { b.click(); await new Promise(r => setTimeout(r, 400)); }
      const t = (document.querySelector('#w122sheet .prose') || {}).textContent || '';
      return { netlify: t.indexOf('netlify') >= 0, hub: t.indexOf('hub.welfareavenue.com') >= 0 };
    });
    ok('the week 1 lesson names the Hub at hub.welfareavenue.com', tools && tools.hub && !tools.netlify, tools);
    const quiz = X.trainings.find(t => t.key === 'onb:w1').body.quiz.questions[0];
    ok('its first question no longer offers ClickUp', quiz.a.indexOf('In ClickUp') < 0 && !/ClickUp/.test(quiz.why), quiz);

    /* the onboarding a new person sees (the HR preview of the master) */
    await f.hash('#training', 900);
    await f.ev(() => { if (window.w169 && w169.preview) w169.preview('w169sample'); });
    await p.waitForTimeout(2500);
    const plan = await f.ev(() => {
      const sh = document.querySelector('#w122sheet .sh'); if (!sh) return null;
      const all = sh.textContent;
      const st = id => sh.querySelector('[data-w166t="' + id + '"]');
      const hub = st('wa166hub'), chrome = st('86e1cj9gp'), slack = st('86e1cj9hc');
      const ds = hub && hub.querySelector('.ds');
      return {
        weekOn: !!sh.querySelector('details.w37week.w167on'),
        hubDo: !!(hub && hub.querySelector('.w190do')), hubDoText: hub && (hub.querySelector('.w190do') || {}).textContent,
        chromeNote: !!(chrome && chrome.querySelector('p.w190tk')), slackDo: !!(slack && slack.querySelector('.w190do')),
        dsFont: ds && getComputedStyle(ds).fontSize, dsColor: ds && getComputedStyle(ds).color,
        boxes: sh.querySelectorAll('.w190do').length, notes: sh.querySelectorAll('p.w190tk').length,
        netlify: all.indexOf('netlify') >= 0, clickup: /ClickUp|Keela/.test(all), raw: all.indexOf('**') >= 0
      };
    });
    ok('the new person\'s plan opens on week 1', plan && plan.weekOn, plan);
    ok('a step\'s to-do is a gold box (The Hub: sign in and bookmark it)', plan && plan.hubDo && /To complete this step/i.test(plan.hubDoText) && /bookmark/.test(plan.hubDoText), plan);
    ok('how a step ticks itself is a quiet note (Download Chrome)', plan && plan.chromeNote, plan);
    ok('the step text is larger and darker (13.5px)', plan && plan.dsFont === '13.5px' && plan.dsColor !== 'rgb(121, 119, 115)', plan);
    ok('week 1 shows no old address, no ClickUp or Keela, no stray **', plan && !plan.netlify && !plan.clickup && !plan.raw, plan);
    await shot(p, '06_plan_week1');
    await f.ev(() => { const m = document.querySelector('#w122sheet .main'); const s = m && m.querySelector('[data-w166t="86e1cj9h6"]'); if (s) s.scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(400);
    await shot(p, '07_plan_week1_lower');
    ok('no page errors (Academy, readings, lesson, plan)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. the HR centre's master still lists every step (it shows names only; the words show in the plan and its preview) */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre/onboarding', fixture: fx(), wait: 5200, candidate: cand });
    const p = f.page;
    await p.waitForTimeout(1500);
    const m = await f.ev(() => { const hc = document.getElementById('hrcentre'); if (!hc) return null; hc.querySelectorAll('details.w46wk').forEach(d => { d.open = true; }); return { weeks: hc.querySelectorAll('details.w46wk').length, steps: hc.querySelectorAll('.w46st').length }; });
    ok('the HR centre\'s master onboarding lists the five weeks and the 45 steps', m && m.weeks === 5 && m.steps === 45, m);
    await shot(p, '08_hr_master');
    ok('no page errors (HR centre)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. phones */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#training', fixture: fx(), wait: 5200, candidate: cand });
    const p = f.page;
    await openT(f, 39);
    const ph = await f.ev(() => { const sh = document.querySelector('#w122sheet .sh'); const main = sh && sh.querySelector('.main'); return sh ? { w: sh.scrollWidth, vw: innerWidth, mainW: main.scrollWidth, mainCW: main.clientWidth, h2: getComputedStyle(sh.querySelector('.hd h2')).fontSize } : null; });
    ok('a reading on a phone: no sideways scroll', ph && ph.w <= ph.vw && ph.mainW <= ph.mainCW + 1, ph);
    await shot(p, '09_phone_module1');
    await f.ev(() => { const m = document.querySelector('#w122sheet .main'); if (m) m.scrollTop = 700; });
    await p.waitForTimeout(300);
    await shot(p, '10_phone_module1_lower');
    const w1 = X.trainings.find(t => t.key === 'onb:w1');
    await openT(f, w1.id);
    await shot(p, '11_phone_lesson');
    await openT(f, 148);
    const ph2 = await f.ev(() => { const main = document.querySelector('#w122sheet .main'); return main ? { mainW: main.scrollWidth, mainCW: main.clientWidth } : null; });
    ok('numbered steps on a phone: no sideways scroll', ph2 && ph2.mainW <= ph2.mainCW + 1, ph2);
    await shot(p, '12_phone_sop');
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw190drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
