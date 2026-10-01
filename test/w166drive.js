/* w166drive.js: wave166, onboarding around the Hub and the Avenue Academy. Steel (29/09/26): "please consider embedding Loom
   videos in the Avenue Academy for trainings and for the onboarding as well (which I believe needs some revision giving the move
   away from ClickUp, the new Hub). In fact the onboarding could include members doing some of the Avenue Academy modules. Give
   the onboarding a whole revamp. I also believe that managers or leads that have people onboarding should have something on
   their home page to show the progress their member is making and where they need to come in to ensure they progress."
   The plan and the Academy data come from the live database after wa166_onboarding (scratchpad fx166.json); the member doing
   the plan is the test member (Samson), who has finished the Chrome video and the nine Hub modules. The leads' card is what
   onboarding_lead_view returned for Amanda (Alyx reports to her). Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }

const LIVE = {}; JSON.parse(fs.readFileSync(SP + 'fx166.json', 'utf8')).forEach(r => { LIVE[r.k] = r.v; });
const SQL = fs.readFileSync(path.join(__dirname, '../build/data/wa166_onboarding.sql'), 'utf8');
const TPL = SQL.split('$tpl$')[1];

function fx() {
  const f = loadFixture();
  ['onboarding_template', 'onboardings', 'onboarding_steps', 'hr_setup_template', 'hr_setup_steps', 'academy_paths', 'trainings'].forEach(k => { f[k] = JSON.parse(JSON.stringify(LIVE[k])); });
  /* the member doing the plan is the test member: onboarding 4 becomes Samson's (HR team) */
  const o = f.onboardings.find(x => x.id === 4); o.person_name = 'Samson'; o.member_id = 36;
  const key = k => f.trainings.find(t => t.key === k);
  const hub = f.trainings.filter(t => t.path_group === 'Using the Hub');
  f.training_progress = [key('onb:chrome')].concat(hub).map((t, i) => ({ id: 880000 + i, training_id: t.id, person_name: 'Samson', email: 'samson.jules@welfareavenue.com', status: 'done', done_at: '2026-09-24T15:00:00Z', pct: 100 }));
  f.onboarding_help = [];
  f.app_config = (f.app_config || []).filter(r => r.key !== 'onboarding_email_template').concat([{ key: 'onboarding_email_template', value: TPL }]);
  return f;
}
function leadView() {
  const v = JSON.parse(JSON.stringify(LIVE.lead_view_amanda));
  v.people[0].help = [{ id: 7, step: 'Download Slack', note: 'The invite never came', at: '2026-09-24T15:00:00Z' }];
  return v;
}

(async () => {
  const browser = await launch();
  const FX = fx();

  /* 1. the member's plan in the Avenue Academy */
  {
    const f = await fresh(browser, { who: 'member', width: 1366, hash: '#training/onboarding', fixture: JSON.parse(JSON.stringify(FX)), wait: 5000 });
    const p = f.page;
    await p.waitForTimeout(900);
    const s = await f.ev(() => {
      const sh = document.querySelector('#w122sheet .sh'); if (!sh) return null;
      const txt = sh.textContent;
      const step = id => { const el = sh.querySelector('[data-w166t="' + id + '"]'); if (!el) return null; const c = el.querySelector('input[type=checkbox]'); return { cls: el.className, checked: c && c.checked, disabled: c && c.disabled, title: c && c.title, chip: (el.querySelector('.w166acad') || {}).textContent || null, go: (el.querySelector('.w166go') || {}).textContent || null, go2: (el.querySelector('.w166go') || { getAttribute: () => null }).getAttribute('data-w166open'), text: el.textContent.slice(0, 700) }; };
      return {
        wrap: !!sh.querySelector('.onbwrap[data-w166]'), clickup: /ClickUp/.test(txt), keela: /Keela/.test(txt), intro: (sh.querySelector('.main .prose p') || {}).textContent,
        head: (sh.querySelector('.hd .kk span:last-child') || {}).textContent, foot: (sh.querySelector('.ft .st') || {}).textContent, bar: (sh.querySelector(':scope > .pr > i') || { style: {} }).style.width,
        hub: step('wa166hub'), usehub: step('wa166usehub'), chrome: step('86e1cj9gp'), work: step('wa166work'), team: step('wa166team'), any: step('86e1cj9j0'), meet: step('86e1cj9gr'), slack2: step('wa166slack2'),
        weeks: [...sh.querySelectorAll('details.w37week > summary')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
        firstOpen: [...sh.querySelectorAll('details.w37week')].map(d => d.open),
        help: !!sh.querySelector('[data-w166help]'), play: [...sh.querySelectorAll('.w166play')].map(b => b.getAttribute('data-w166loom'))
      };
    });
    ok('the plan opens in the Academy and wave166 decorates it', s && s.wrap, s);
    ok('no ClickUp and no Keela anywhere in the plan', s && !s.clickup && !s.keela, s && { clickup: s.clickup, keela: s.keela });
    ok('the plan starts with the Hub (week 1)', s && s.hub && /The Hub/.test(s.hub.text), s && s.hub);
    ok('an avenue step finished in the Academy shows done, ticked and locked, with its avenue (Using the Hub, 9 of 9)', s && s.usehub && s.usehub.checked && s.usehub.disabled && /done/.test(s.usehub.cls) && /Using the Hub/.test(s.usehub.chip) && /9 of 9/.test(s.usehub.chip) && s.usehub.title === 'Done in the Avenue Academy', s && s.usehub);
    ok('a module step finished in the Academy (the Chrome video) shows done with the module and Open it again', s && s.chrome && s.chrome.checked && s.chrome.disabled && /Avenue Academy module/.test(s.chrome.chip) && s.chrome.go === 'Open it again' && /done in the Avenue Academy/.test(s.chrome.text), s && s.chrome);
    ok('Your work in the Hub (Hub module 2) is done too: it is one of the nine', s && s.work && s.work.checked, s && s.work);
    ok('a module step not done yet can be opened from the plan (Setting up a Google Meet) and is not locked', s && s.meet && !s.meet.checked && !s.meet.disabled && s.meet.go === 'Open it' && s.meet.go2 === 't:115', s && s.meet);
    ok('the team avenue step, nothing started: Your team’s Learning Avenues, Browse the avenues', s && s.team && /Your team.s Learning Avenues/.test(s.team.chip) && s.team.go === 'Browse the avenues' && s.team.go2 === 'a:', s && s.team);
    ok('the 60-day avenue step is Pick a Learning Avenue, nothing started: Browse the avenues', s && s.any && /Pick a Learning Avenue/.test(s.any.text) && s.any.go === 'Browse the avenues', s && s.any);
    ok('Slack part 2 is its own step with its Academy module', s && s.slack2 && /Understanding Slack, part 2/.test(s.slack2.text) && /Avenue Academy module/.test(s.slack2.chip), s && s.slack2);
    ok('the header counts the steps done in the Academy: 3 of 41 steps', s && s.head === '3 of 41 steps' && s.foot === '3 of 41 done' && s.bar === '7%', s && { head: s.head, foot: s.foot, bar: s.bar });
    ok('the intro says Academy steps tick themselves and the videos play inside the Hub', s && /tick themselves/.test(s.intro) && /inside the Hub/.test(s.intro), s && s.intro);
    ok('week 1 is open (it is not finished), and the weeks list 5 sections', s && s.weeks.length === 5 && s.firstOpen[0] === true, s && { weeks: s.weeks, open: s.firstOpen });
    ok('a Loom link in a step gets Watch here (the When2Meet video in Setting up a meeting)', s && s.play.indexOf('500d4af7547742a89458dfaf3e3194be') >= 0, s && s.play);

    /* Watch here plays the video in place, and hides it again */
    const vid = await f.ev(async () => {
      const b = document.querySelector('#w122sheet .w166play[data-w166loom="500d4af7547742a89458dfaf3e3194be"]'); if (!b) return null;
      b.click(); await new Promise(r => setTimeout(r, 150));
      const w = document.querySelector('#w122sheet .w166vidwrap[data-id="500d4af7547742a89458dfaf3e3194be"] iframe');
      const r = { src: w && w.getAttribute('src'), label: b.textContent, exp: b.getAttribute('aria-expanded') };
      b.click(); await new Promise(r2 => setTimeout(r2, 150));
      r.after = !!document.querySelector('#w122sheet .w166vidwrap'); r.label2 = b.textContent;
      return r;
    });
    ok('Watch here opens the Loom embed under the step (loaded only when asked)', vid && /^https:\/\/www\.loom\.com\/embed\/500d4af7547742a89458dfaf3e3194be\?/.test(vid.src) && vid.label === 'Hide the video' && vid.exp === 'true', vid);
    ok('Hide the video closes it again', vid && !vid.after && /Watch here/.test(vid.label2), vid);

    /* Ask for help from the plan: the form opens here (the sheet sits above modals) and inserts onboarding_help */
    const help = await f.ev(async () => {
      const calls = [];
      const of = db.from.bind(db);
      db.from = function (t) { const b = of(t); if (t === 'onboarding_help') { const ins = b.insert.bind(b); b.insert = function (x) { calls.push(x); return ins(x); }; } return b; };
      const btn = document.querySelector('[data-w166help]'); btn.click(); await new Promise(r => setTimeout(r, 60));
      const form = document.querySelector('.w166hform'); const on = form.classList.contains('on');
      const opts = [...document.querySelectorAll('#w166hs option')].map(o => o.textContent);
      document.getElementById('w166hs').value = 'Download Slack';
      document.getElementById('w166hn').value = 'The invite never came';
      document.querySelector('[data-w166hsend]').click(); await new Promise(r => setTimeout(r, 200));
      db.from = of;
      return { on, n: opts.length, first: opts[0], last: opts[opts.length - 1], hasDone: opts.indexOf('Using the Hub (Avenue Academy)') >= 0, calls, box: (document.getElementById('w166help') || {}).textContent };
    });
    ok('Stuck on a step? opens the form in the plan with the steps still to do (not the ones done) and Something else', help && help.on && help.n === 39 && help.last === 'Something else' && !help.hasDone, help);
    ok('Send it asks for help for this onboarding, as this person, with the step and the note', help && help.calls.length === 1 && help.calls[0].onboarding_id === 4 && help.calls[0].person_name === 'Samson' && help.calls[0].step_name === 'Download Slack' && help.calls[0].note === 'The invite never came', help);
    ok('and says HR and the lead see it in the Hub', help && /Sent/.test(help.box) && /HR and your lead see it in the Hub/.test(help.box), help && help.box);

    /* finishing a module brings the plan up to date: the celebration triggers a fresh read of the plan */
    const fin = await f.ev(async () => {
      let n = 0; const orig = wa37Load; wa37Load = async function (force) { if (force) n++; return orig.apply(this, arguments); };
      const t = window.w122.A.byKey['onb:slack1'];
      await window.w122.complete(t); await new Promise(r => setTimeout(r, 700));
      const cel = !!document.getElementById('w122cel');
      wa37Load = orig;
      return { n, cel };
    });
    ok('finishing a module (the celebration) reads the plan again, so the Academy ticks show without a reload', fin && fin.cel && fin.n >= 1, fin);

    /* opening a module from the plan goes to the module */
    const go = await f.ev(async () => {
      try { var c = document.getElementById('w122cel'); if (c) c.remove(); } catch (e) { /* fine */ }
      location.hash = '#training/onboarding'; await new Promise(r => setTimeout(r, 700));
      const b = document.querySelector('#w122sheet [data-w166t="86e1cj9gr"] .w166go'); if (!b) return null;
      b.click(); await new Promise(r => setTimeout(r, 400));
      return location.hash;
    });
    ok('Open it from the plan opens the Academy module (#training/t/115)', go === '#training/t/115', go);
    ok('no page errors (the member)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. the leads' card on Home */
  {
    const f = await fresh(browser, { who: 'leader', width: 1366, hash: '#mypage', fixture: JSON.parse(JSON.stringify(FX)), wait: 5000, rpcs: { onboarding_lead_view: leadView(), onboarding_lead_tick: { ok: true }, onboarding_help_resolve: { ok: true } } });
    const p = f.page;
    await p.waitForTimeout(900);
    const c = await f.ev(() => {
      const el = document.getElementById('w166lead'); if (!el) return null;
      const body = document.getElementById('mpBody');
      const kids = [...body.children].map(k => k.id || k.className);
      return {
        h3: (el.querySelector('h3') || {}).textContent, name: (el.querySelector('.w166who b') || {}).textContent, sub: (el.querySelector('.w166who span') || {}).textContent,
        day: (el.querySelector('.w166day') || {}).textContent, sum: (el.querySelector('.w166sum') || {}).textContent,
        wks: [...el.querySelectorAll('.w166wk')].map(x => x.textContent), you: [...el.querySelectorAll('.w166ls')].map(x => x.textContent),
        ticks: [...el.querySelectorAll('[data-w166tick]')].map(x => x.getAttribute('data-w166tick')), notes: [...el.querySelectorAll('.w166you .w166note')].map(x => x.textContent),
        ask: (el.querySelector('.w166ask') || {}).textContent, av: [...el.querySelectorAll('.w166av2 span')].map(x => x.textContent),
        plan: !!el.querySelector('details.w166plan'), pos: kids.indexOf('w166lead'), w112: kids.indexOf('w112wrap'), kids: kids.slice(0, 8)
      };
    });
    ok('Home shows the lead their new person’s onboarding', c && /Your new person.s onboarding/.test(c.h3) && c.name === 'Alyx Denison', c);
    ok('with their title, team and why they are here (reports to you)', c && /Event Coordinator/.test(c.sub) && /Fundraising/.test(c.sub) && /reports to you/.test(c.sub), c && c.sub);
    ok('the day and week of their onboarding, and how far they are (0 of 41, next: The Hub)', c && /Day 5/.test(c.day) && /Week 1 of 4/.test(c.day) && /0 of 41 steps/.test(c.sum) && /next: The Hub/.test(c.sum), c && { day: c.day, sum: c.sum });
    ok('each week of their plan with its count', c && c.wks.join('|') === 'Week 1 0/21|Week 2 0/5|Week 3 0/4|Week 4 0/6|60 days 0/5', c && c.wks);
    ok('Where you come in: the lead’s moments due within the week, with their dates (introduce them, first tasks)', c && c.you.length === 2 && /Introduce them at your team.s meeting/.test(c.you[0]) && /by Oct 2/.test(c.you[0]) && /first tasks/.test(c.you[1]), c && c.you);
    ok('and the later moments summed up (4 more, starting Oct 9)', c && c.notes.some(n => /Later: 4 more of yours, starting Oct 9/.test(n)), c && c.notes);
    ok('their help request shows with Dealt with', c && /Asked for help on Download Slack/.test(c.ask) && /The invite never came/.test(c.ask) && /Dealt with/.test(c.ask), c && c.ask);
    ok('the avenues: the three everyone does, and their team’s (not started)', c && c.av.join('|') === 'Using the Hub 0/9|Welfare Avenue foundations 0/3|Our brand 0/3|Team avenue: not started', c && c.av);
    ok('the card sits right after Get started (or near the top of Home)', c && c.pos >= 0 && (c.w112 < 0 || c.pos === c.w112 + 1), c && c.kids);

    const act = await f.ev(async () => {
      const calls = [];
      const orpc = db.rpc.bind(db);
      db.rpc = function (fn, args) { calls.push([fn, args]); return orpc(fn, args); };
      const cb = document.querySelector('#w166lead [data-w166tick]'); cb.click(); await new Promise(r => setTimeout(r, 300));
      const rb = document.querySelector('#w166lead [data-w166resolve]'); rb.click(); await new Promise(r => setTimeout(r, 300));
      const d = document.querySelector('#w166lead details.w166plan'); d.open = true; await new Promise(r => setTimeout(r, 100));
      const secs = [...d.querySelectorAll('.w166sec > b')].map(x => x.textContent);
      const first = (d.querySelector('.w166st') || {}).textContent;
      const acad = d.querySelectorAll('.w166st em').length;
      db.rpc = orpc;
      return { calls: calls.filter(c => c[0] !== 'get_my_role'), secs, first, acad };
    });
    ok('ticking a moment saves it for that step (onboarding_lead_tick), then reads the card again', act && act.calls.some(c => c[0] === 'onboarding_lead_tick' && c[1].p_step === 125 && c[1].p_done === true) && act.calls.filter(c => c[0] === 'onboarding_lead_view').length >= 1, act && act.calls);
    ok('Dealt with closes the help request (onboarding_help_resolve)', act && act.calls.some(c => c[0] === 'onboarding_help_resolve' && c[1].p_id === 7), act && act.calls);
    ok('See their plan opens the whole plan by week, Academy steps marked', act && act.secs.join('|') === 'Week 1|Week 2|Week 3|Week 4|60 days' && /The Hub/.test(act.first) && act.acad >= 10, act);

    const tours = await f.ev(() => {
      const hs = window.w122.tours.home.steps, i = hs.findIndex(x => x.s === '#w166lead'), j = hs.findIndex(x => x.s === '#w112wrap');
      const a = window.w122.tours.academy.steps.find(x => x.s === '#w122 .w122onb');
      return { i, j, opt: i >= 0 && hs[i].opt, a: a && a.p };
    });
    ok('the Home tour has a stop for the card, after Get started, optional', tours && tours.i === tours.j + 1 && tours.opt === 1, tours);
    ok('the Academy tour says Academy steps tick themselves', tours && /tick themselves/.test(tours.a), tours && tours.a);
    ok('no page errors (the lead)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. a member with nobody to onboard sees no card */
  {
    const f = await fresh(browser, { who: 'member', width: 1366, hash: '#mypage', fixture: JSON.parse(JSON.stringify(FX)), wait: 4500, rpcs: { onboarding_lead_view: { people: [] } } });
    const n = await f.ev(() => !!document.getElementById('w166lead'));
    ok('no card on Home when the person is onboarding nobody', n === false, n);
    await f.close();
  }

  /* 4. the card on a phone */
  {
    const f = await fresh(browser, { who: 'leader', width: 390, hash: '#mypage', fixture: JSON.parse(JSON.stringify(FX)), wait: 5000, rpcs: { onboarding_lead_view: leadView() } });
    const r = await f.ev(() => { const el = document.getElementById('w166lead'); if (!el) return null; const b = el.getBoundingClientRect(); return { w: b.width, right: b.right, vw: window.innerWidth, sw: document.documentElement.scrollWidth }; });
    ok('on a phone the card fits the screen (no sideways scroll)', r && r.right <= r.vw + 1 && r.sw <= r.vw + 1, r);
    await f.page.screenshot({ path: SP + 'w166_phone.png', fullPage: false });
    await f.close();
  }

  /* 5. HR: the welcome kit, the onboarding email and the help request's promise */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre/onboarding', fixture: JSON.parse(JSON.stringify(FX)), wait: 5000 });
    const k = await f.ev(async () => {
      if (typeof wa46Kit !== 'function') { /* the kit opens from the assign flow; call it the way the board does */ }
      const btn = document.querySelector('[data-w46kit]');
      if (btn) btn.click(); else if (typeof window.wa46Kit === 'function') window.wa46Kit('Test Person');
      await new Promise(r => setTimeout(r, 500));
      const box = document.getElementById('modalBox'); if (!box) return null;
      const txt = box.textContent;
      const go = document.getElementById('w108go'); if (go) { document.getElementById('w108title').value = 'Event Coordinator'; go.click(); await new Promise(r => setTimeout(r, 500)); }
      const html = window.__w108html || '', plain = (document.getElementById('w46em') || {}).value || '';
      return { kit: !!btn || typeof window.wa46Kit === 'function', keela: /Keela|ClickUp/.test(txt), lead: /Their lead.s moments/.test(txt) && /Check in at two weeks/.test(txt), acct: /share the first password with them one to one/.test(txt),
        html: { video: html.indexOf('loom.com/share/522090b198054eb4aab13e0365efadf6') >= 0, hub: html.indexOf('hub.welfareavenue.com') >= 0, old: /Keela|ClickUp|welfare-avenue-google-setup|Temporary password/.test(html) },
        plain: { video: plain.indexOf('522090b198054eb4aab13e0365efadf6') >= 0, hub: plain.indexOf('hub.welfareavenue.com') >= 0, old: /Keela|ClickUp|welfare-avenue-google-setup|password \(please change after first login\): Welfare Avenue/.test(plain), n: plain.length } };
    });
    ok('the Welcome kit opens', k && k.kit, k);
    ok('the Welcome kit has no Keela or ClickUp, shares the first password one to one, and lists the lead’s moments', k && !k.keela && k.lead && k.acct, k);
    ok('the branded email: the real setup video, the Hub, no Keela, ClickUp or fixed password', k && k.html.video && k.html.hub && !k.html.old, k && k.html);
    ok('the plain email (the template): the real setup video, the Hub, no Keela, ClickUp or fixed password', k && k.plain.n > 200 && k.plain.video && k.plain.hub && !k.plain.old, k && k.plain);
    const h = await f.ev(async () => {
      try { if (typeof closeModal === 'function') closeModal(); } catch (e) { /* fine */ }
      if (typeof wa39HelpModal !== 'function') return null;
      wa39HelpModal(4); await new Promise(r => setTimeout(r, 200));
      const sub = document.querySelector('#modalBox .m-sub'); const t = sub ? sub.textContent : '';
      return { slack: /Slack/.test(t), hub: /see it in the Hub/.test(t), btn: (document.getElementById('w39hgo') || {}).textContent };
    });
    ok('the older help form promises the Hub, not Slack', h && h.hub && !h.slack && h.btn === 'Send it', h);
    ok('no page errors (HR)', f.errs.length === 0, f.errs);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
