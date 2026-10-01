/* w192drive.js: wave192, The Loop (I'm in, close the loop). Steel (01/10/26): the check-in and check-out repositioned so
   work is shared to keep everyone in the loop, without anyone feeling tracked.
   Checks: the button (#w192go) over wave116j's hidden pill; I'm in posts nothing; the wrap-up sheet (the draft from the
   person's records, + add a line, take a line out, Add to the note, the suggested task ticked, other tasks, who sees it
   with the real channels, Close the loop, Close without a note, words typed but not folded in, the empty note); no old
   check-in action is ever called; In the loop on Home (loop_feed, day labels, never a clock time); the person page (a
   plain member sees no one else's hours, HR does, your own says Your hours and Your loop); the walkthrough (the page tour
   "loop" opens the sheet in preview, nothing is read or written, the preview closes with the tour); the chrome tour's
   step; wave118b's notes under the new button in The Loop's words, and a close "as of" a time opening the sheet; a phone;
   a board viewer sees no button; no page errors.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file> tests another build. */
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }

const STEEL = 'steel.macdonald@welfareavenue.com';
const OPEN = { id: 901, email: STEEL, name: 'Steel', department: 'board', started_at: '2026-09-25T18:25:00Z', ended_at: null, minutes: null, source: 'hub' };
const FEED = [
  { id: 1, email: 'ahmedfakhir@welfareavenue.com', name: 'Ahmed', department: 'opsmtl', day: '2026-09-25', bullets: ['Booked the kitchen for Sunday', 'Sent the volunteer reminder'], closed: 2, closed_titles: ['Book the kitchen for Sunday'], share_to: 'team' },
  { id: 2, email: 'ian.odhiambo@welfareavenue.com', name: 'Ian', department: 'marketing', day: '2026-09-25', bullets: ['Drafted the gift basket post'], closed: 0, closed_titles: [], share_to: 'everyone' },
  { id: 3, email: 'shima.butera@welfareavenue.com', name: 'Shima', department: 'progdev', day: '2026-09-24', bullets: ['Program development meeting', 'Emails and comms'], closed: 0, closed_titles: [], share_to: 'hub' },
  { id: 4, email: 'valex.sanon@welfareavenue.com', name: 'Valex', department: 'hr', day: '2026-09-24', bullets: ['One-on-ones'], closed: 1, closed_titles: [], share_to: 'team' },
  { id: 5, email: 'tate.weinstein@welfareavenue.com', name: 'Tate', department: 'opsto', day: '2026-09-22', bullets: ['Called the shelter back about Sunday'], closed: 0, closed_titles: [], share_to: 'team' },
  { id: 6, email: 'kahkashan.ansary@welfareavenue.com', name: 'Kahkashan', department: 'marketing', day: '2026-09-21', bullets: ['Google Ad Grant plan'], closed: 0, closed_titles: [], share_to: 'everyone' },
  { id: 7, email: 'natasha.sharp@welfareavenue.com', name: 'Natasha', department: 'hr', day: '2026-09-20', bullets: ['Onboarding calls'], closed: 0, closed_titles: [], share_to: 'team' }
];
function fx(open) {
  const f = loadFixture(path.join(__dirname, 'fixture.json'));
  f.team_members = (f.team_members || []).concat([
    { id: 90, name: 'Joy Dumansi', email: 'joy.dumansi@welfareavenue.com', department: 'marketing', role: 'Content creator', active: true },
    { id: 91, name: 'Samson Jules', email: 'samson.jules@welfareavenue.com', department: 'hr', role: 'HR coordinator', active: true }
  ]);
  f.hub_checkins = open ? [Object.assign({}, OPEN)] : [];
  f.hub_checkins.push({ id: 700, email: 'ahmedfakhir@welfareavenue.com', name: 'Ahmed', department: 'opsmtl', started_at: '2026-09-24T22:00:00Z', ended_at: '2026-09-25T00:10:00Z', minutes: 130, source: 'hub', summary: { bullets: ['Booked the kitchen'] }, share_to: 'team' });
  f.trainings = (f.trainings || []).concat([{ id: 1300, key: 'tour:loop', kind: 'tour', title: 'Page tour: The Loop', category: 'Hub tours', path_group: 'Hub page tours', minutes: 1, active: true, sort: 2, description: 'I’m in, close the loop: what moved, who sees it, and what never goes in the post.' }]);
  f.app_config = (f.app_config || []).filter(r => r.key !== 'loop_channel').concat([{ key: 'loop_channel', value: 'the-loop' }]);
  return f;
}
const RPCS = { loop_feed: FEED, loop_in_now: [{ email: 'ahmedfakhir@welfareavenue.com' }], wa_org_editor: true };
/* the edge function, stubbed: records each call and answers like checkin-post v13 */
async function stubFn(f) {
  await f.ev(() => {
    window.__calls = [];
    const OPEN_TASKS = [{ id: 501, title: 'Confirm the drivers for Sunday', owner: 'Steel' }, { id: 502, title: 'Order the flyers', owner: 'Ian' }];
    db.functions.invoke = function (name, opts) {
      const b = (opts && opts.body) || {}; window.__calls.push({ name, body: JSON.parse(JSON.stringify(b)) });
      let data = { ok: true };
      if (name === 'checkin-post') {
        if (b.action === 'draft') data = { ok: true, bullets: ['Closed: Book the kitchen for Sunday', 'Joined: Operations Montreal meeting'], items: 3, hidden: 1, minutes: 95, open_tasks: OPEN_TASKS, department: 'board', team: 'Board', team_channel: 'board-of-directors', everyone_channel: 'check-in-out-wa' };
        if (b.action === 'tidy') data = { ok: true, bullets: (b.bullets || []).concat(['Met Amanda about the flyers; she prints Friday']), suggest: [{ id: 501, title: 'Confirm the drivers for Sunday', why: 'the drivers are confirmed' }], open_tasks: OPEN_TASKS };
        if (b.action === 'close') data = { ok: true, posted: b.share_to !== 'hub' && !b.skipped, error: null, channel: b.share_to === 'team' ? 'board-of-directors' : 'check-in-out-wa', share_to: b.skipped ? 'hub' : b.share_to, closed: [], closed_ids: b.close_task_ids || [], minutes: 95 };
        if (b.action === 'start') data = { ok: true, posted: false };
      }
      return new Promise(r => setTimeout(() => r({ data, error: null }), 60));
    };
  });
}
const calls = f => f.ev(() => (window.__calls || []).map(c => ({ name: c.name, action: c.body && c.body.action, body: c.body })));
const sheetOpen = f => f.ev(() => !!document.getElementById('w192sheet') && getComputedStyle(document.getElementById('modalBack')).display !== 'none');
const toastText = f => f.ev(() => { const t = document.getElementById('toast') || document.querySelector('.toast'); return t ? t.textContent : ''; });

(async () => {
  const browser = await launch();
  const cand = process.env.CAND || undefined;

  /* 1. the button and I'm in (not in yet) */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(false), rpcs: RPCS, candidate: cand });
    await stubFn(f);
    const b = await f.ev(() => { const g = document.getElementById('w192go'), o = document.getElementById('w116jck'); return { has: !!g, text: g && g.textContent.trim(), cls: g && g.className, oldShown: !!o && getComputedStyle(o).display !== 'none', before: g && g.nextElementSibling && g.nextElementSibling.classList.contains('w115pill') }; });
    ok('the header shows I’m in (the old Check in pill is hidden)', b.has && b.text === 'I’m in' && b.cls === '' && !b.oldShown, b);
    ok('the button sits right before the profile bubble', b.before, b);
    await f.page.click('#w192go'); await f.page.waitForTimeout(700);
    const s = await f.ev(() => ({ open: !!(window.w116jCk && w116jCk.open()), text: document.getElementById('w192go').textContent.trim(), cls: document.getElementById('w192go').className }));
    ok('I’m in starts a session and the button turns into Close the loop', s.open && /^Close the loop/.test(s.text) && s.cls === 'in', s);
    const c1 = await calls(f);
    ok('starting posts nothing: no old "in" action, and no Slack post asked for', !c1.some(c => c.action === 'in'), c1);
    ok('the toast says you’re in', /You’re in/.test(await toastText(f)), await toastText(f));
    await f.page.click('#w192go'); await f.page.waitForTimeout(900);
    ok('Close the loop opens the wrap-up sheet', await sheetOpen(f));
    ok('the sheet asks the Hub for a draft', (await calls(f)).some(c => c.action === 'draft'));
    ok('no page errors (the button and I’m in)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. the sheet, end to end (an open session) */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(true), rpcs: RPCS, candidate: cand });
    await stubFn(f);
    const b0 = await f.ev(() => document.getElementById('w192go').textContent.trim());
    ok('an open session shows Close the loop with the person’s own time', /^Close the loop\s*·\s*1h 35m$/.test(b0), b0);
    await f.page.click('#w192go'); await f.page.waitForTimeout(900);
    const s0 = await f.ev(() => {
      const sh = document.getElementById('w192sheet');
      return {
        title: sh.querySelector('h3').textContent, hrs: sh.querySelector('.hrs').textContent, sub: sh.querySelector('.m-sub').textContent,
        lines: [...sh.querySelectorAll('[data-w192b]')].map(i => i.value), hidden: (sh.querySelector('#w192draftbox .quiet') || {}).textContent || '',
        share: [...sh.querySelectorAll('.share label')].map(l => ({ t: l.textContent.trim(), on: l.classList.contains('on') })),
        quiet: [...sh.querySelectorAll('#w192sharebox .quiet')].map(x => x.textContent).join(' '), font: getComputedStyle(sh.querySelector('h3')).fontFamily
      };
    });
    ok('the sheet title is Close the loop in Barlow Condensed', /^Close the loop/.test(s0.title) && /Barlow Condensed/.test(s0.font), s0);
    ok('the minutes show to the person only ("for your eyes only")', s0.hrs === '1h 35m' && /for your eyes only/.test(s0.sub), s0);
    ok('the draft lines from the person’s records are editable', s0.lines.length === 2 && s0.lines[0] === 'Closed: Book the kitchen for Sunday', s0.lines);
    ok('private work is counted, not listed', /1 private item is left out/.test(s0.hidden), s0.hidden);
    ok('who sees it: My team (#board-of-directors, chosen), Everyone (the Loop channel), Just the Hub', s0.share.length === 3 && /My team.*#board-of-directors/.test(s0.share[0].t) && s0.share[0].on && /Everyone.*#check-in-out-wa/.test(s0.share[1].t) && /Just the Hub/.test(s0.share[2].t), s0.share);
    ok('the sheet says no clock time and no hours go in the post', /No clock time and no hours in the post/.test(s0.quiet), s0.quiet);
    /* + add a line, then take one out */
    await f.page.click('#w192add'); await f.page.waitForTimeout(200);
    await f.page.keyboard.type('Called the shelter back about Sunday');
    let lines = await f.ev(() => [...document.querySelectorAll('[data-w192b]')].map(i => i.value));
    ok('+ add a line adds a line and puts the cursor in it', lines.length === 3 && lines[2] === 'Called the shelter back about Sunday', lines);
    await f.page.click('[data-w192rm="1"]'); await f.page.waitForTimeout(200);
    lines = await f.ev(() => [...document.querySelectorAll('[data-w192b]')].map(i => i.value));
    ok('a line comes out with its ×, and the others keep their words', lines.length === 2 && lines[0] === 'Closed: Book the kitchen for Sunday' && lines[1] === 'Called the shelter back about Sunday', lines);
    /* Add to the note */
    await f.page.click('#w192tidy'); await f.page.waitForTimeout(250);
    ok('Add to the note with nothing typed asks for words first', /Say or type a line first/.test(await f.ev(() => document.getElementById('w192ok').textContent)) && !(await calls(f)).some(c => c.action === 'tidy'));
    await f.page.fill('#w192say', 'met Amanda about the flyers, she prints Friday');
    await f.page.click('#w192tidy'); await f.page.waitForTimeout(700);
    const t = (await calls(f)).filter(c => c.action === 'tidy').pop();
    ok('Add to the note sends what was typed and the lines on the sheet', t && t.body.text === 'met Amanda about the flyers, she prints Friday' && JSON.stringify(t.body.bullets) === JSON.stringify(lines), t);
    const s1 = await f.ev(() => ({ lines: [...document.querySelectorAll('[data-w192b]')].map(i => i.value), say: document.getElementById('w192say').value, sug: [...document.querySelectorAll('#w192sug [data-w192t]')].map(i => ({ id: i.getAttribute('data-w192t'), on: i.checked })), more: !!document.getElementById('w192more') }));
    ok('the note now holds the folded-in line, and the box is empty again', s1.lines.length === 3 && /Amanda/.test(s1.lines[2]) && s1.say === '', s1);
    ok('the task the words show finished is suggested and ticked', s1.sug.length === 1 && s1.sug[0].id === '501' && s1.sug[0].on, s1.sug);
    await f.page.click('#w192more'); await f.page.waitForTimeout(200);
    ok('Close other tasks too lists the rest of the open tasks', await f.ev(() => { const o = document.getElementById('w192oth'); return !!o && o.style.display !== 'none' && /Order the flyers/.test(o.textContent); }));
    /* who sees it: Everyone */
    await f.page.click('#w192sharebox .share label:nth-child(2)'); await f.page.waitForTimeout(200);
    ok('choosing Everyone moves the choice', await f.ev(() => { const l = [...document.querySelectorAll('#w192sharebox .share label')]; return l[1].classList.contains('on') && !l[0].classList.contains('on') && w192.state().share === 'everyone'; }));
    await f.page.click('#w192close'); await f.page.waitForTimeout(900);
    const cl = (await calls(f)).filter(c => c.action === 'close').pop();
    ok('Close the loop sends the note, the ticked task and the choice', cl && cl.body.share_to === 'everyone' && cl.body.bullets.length === 3 && JSON.stringify(cl.body.close_task_ids) === '[501]' && cl.body.checkin_id === 901 && !cl.body.skipped, cl);
    const s2 = await f.ev(() => ({ sheet: !!document.getElementById('w192sheet') && getComputedStyle(document.getElementById('modalBack')).display !== 'none', open: !!w116jCk.open(), text: document.getElementById('w192go').textContent.trim() }));
    ok('the sheet closes and the button is back to I’m in', !s2.sheet && !s2.open && s2.text === 'I’m in', s2);
    ok('the toast says where it went and that one task closed', /shared in #check-in-out-wa/.test(await toastText(f)) && /1 task closed/.test(await toastText(f)), await toastText(f));
    const all = await calls(f);
    ok('the old check-in actions (in, summarise, out) are never called', !all.some(c => ['in', 'summarise', 'out'].indexOf(c.action) >= 0), all.map(c => c.action));
    ok('no page errors (the sheet)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. Close without a note; words typed but not folded in; an empty note */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(true), rpcs: RPCS, candidate: cand });
    await stubFn(f);
    await f.page.click('#w192go'); await f.page.waitForTimeout(900);
    await f.page.click('[data-w192rm="0"]'); await f.page.waitForTimeout(150);
    await f.page.click('[data-w192rm="0"]'); await f.page.waitForTimeout(150);
    await f.page.click('#w192close'); await f.page.waitForTimeout(300);
    ok('an empty note asks for a line or Close without a note, and sends nothing', /Add a line, or close without a note/.test(await f.ev(() => document.getElementById('w192ok').textContent)) && !(await calls(f)).some(c => c.action === 'close'));
    await f.page.fill('#w192say', 'Sorted the storage unit');
    await f.page.click('#w192close'); await f.page.waitForTimeout(900);
    const cl = (await calls(f)).filter(c => c.action === 'close').pop();
    ok('words typed but not folded in still go as a line (to my team by default)', cl && JSON.stringify(cl.body.bullets) === '["Sorted the storage unit"]' && cl.body.share_to === 'team', cl);
    await f.close();
    const g = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(true), rpcs: RPCS, candidate: cand });
    await stubFn(g);
    await g.page.click('#w192go'); await g.page.waitForTimeout(900);
    await g.page.click('#w192skip'); await g.page.waitForTimeout(900);
    const sk = (await calls(g)).filter(c => c.action === 'close').pop();
    ok('Close without a note ends the session and shares nothing', sk && sk.body.skipped === true && sk.body.share_to === 'hub' && sk.body.bullets.length === 0 && !(await g.ev(() => !!w116jCk.open())), sk);
    ok('its toast says no note was shared', /no note shared/.test(await toastText(g)), await toastText(g));
    ok('no page errors (closing paths)', f.errs.length === 0 && g.errs.length === 0, f.errs.concat(g.errs));
    await g.close();
  }

  /* 4. Home: In the loop */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(false), rpcs: RPCS, candidate: cand });
    await f.page.waitForTimeout(800);
    const h = await f.ev(() => {
      const s = document.getElementById('w192feed'); if (!s) return null;
      return { h3: s.querySelector('h3').textContent, sub: s.querySelector('.w192sub').textContent, n: s.querySelectorAll('.w192e').length, more: (document.getElementById('w192feedmore') || {}).textContent || '',
        days: [...s.querySelectorAll('.w192e .d')].map(d => d.textContent), first: s.querySelector('.w192e').textContent, pill: !!s.querySelector('.w192e .pl'), text: s.textContent,
        after: s.previousElementSibling && s.previousElementSibling.id };
    });
    ok('Home has In the loop, right after your meetings', h && h.h3 === 'In the loop' && h.after === 'w116home', h);
    ok('it shows five notes and offers the rest', h && h.n === 5 && /Show all 7 from this week/.test(h.more), h);
    ok('each note has the name, the team and the day (Today, Yesterday, a weekday)', h && /Ahmed/.test(h.first) && h.pill && h.days[0] === 'Today' && h.days[2] === 'Yesterday' && /^Tue,? Sep 22$/.test(h.days[4]), h && h.days);
    ok('closed tasks show by count and open title', h && /Closed 2 tasks: Book the kitchen for Sunday/.test(h.first), h && h.first);
    ok('no clock time anywhere in the feed', h && !/\b\d{1,2}:\d{2}\b|\b[AP]M\b|a\.m\.|p\.m\./.test(h.text), h && h.text);
    ok('the feed says times and hours stay with each person', h && /Times and hours stay with each person/.test(h.sub), h && h.sub);
    await f.page.click('#w192feedmore'); await f.page.waitForTimeout(300);
    ok('Show all lists all seven', (await f.ev(() => document.querySelectorAll('#w192feed .w192e').length)) === 7);
    ok('no page errors (Home)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 5. the person page: hours are the person's and HR's; everyone sees what moved */
  {
    const p = await fresh(browser, { who: 'plain', width: 1366, hash: '#person/1', fixture: fx(false), rpcs: RPCS, candidate: cand, wait: 4800 });
    await p.page.waitForTimeout(1200);
    const a = await p.ev(() => ({ hours: !!document.getElementById('w116khours'), kpi: /on the Hub this month|on the hub this month/.test((document.querySelector('.w116kpis') || {}).textContent || ''), their: (document.querySelector('#w192their h3') || {}).textContent || '', items: document.querySelectorAll('#w192their li').length, name: (document.querySelector('.w116khead h2') || {}).textContent || '' }));
    ok('a plain member on Ahmed’s page sees no hours (no card, no tile)', a.name && !a.hours && !a.kpi, a);
    ok('they see Their loop, what moved', a.their === 'Their loop' && a.items > 0, a);
    ok('no page errors (a plain member)', p.errs.length === 0, p.errs);
    await p.close();
    const h = await fresh(browser, { who: 'member', width: 1366, hash: '#person/1', fixture: fx(false), rpcs: RPCS, candidate: cand, wait: 4800 });
    await h.page.waitForTimeout(1200);
    const b = await h.ev(() => { const c = document.getElementById('w116khours'); return { hours: !!c, title: c && c.querySelector('h3').textContent, note: c && c.textContent, kpi: /on the Hub this month/.test((document.querySelector('.w116kpis') || {}).textContent || '') }; });
    ok('HR sees Ahmed’s hours, with a note that teammates never do', b.hours && /^Hours on the Hub/.test(b.title) && /Teammates see what moved, never the hours/.test(b.note) && b.kpi, b);
    ok('no page errors (HR)', h.errs.length === 0, h.errs);
    await h.close();
    const s = await fresh(browser, { who: 'admin', width: 1366, hash: '#person/37', fixture: fx(false), rpcs: RPCS, candidate: cand, wait: 4800 });
    await stubFn(s);
    await s.page.waitForTimeout(1200);
    const c = await s.ev(() => { const k = document.getElementById('w116khours'); return { title: k && k.querySelector('h3').childNodes[0].textContent, link: k && (k.querySelector('[data-w116ka="ck"]') || {}).textContent, empty: k && (k.querySelector('p.empty') || {}).textContent, their: (document.querySelector('#w192their h3') || {}).textContent || '' }; });
    ok('your own page says Your hours, with I’m in', c.title === 'Your hours' && c.link === 'I’m in', c);
    ok('its empty state says the hours are for you and HR, never the post', /for you and HR, never the post/.test(c.empty || ''), c.empty);
    ok('your own page has Your loop', c.their === 'Your loop', c.their);
    await s.page.click('#w116khours [data-w116ka="ck"]'); await s.page.waitForTimeout(900);
    ok('I’m in on your page starts a session (through The Loop, nothing posted)', await s.ev(() => !!w116jCk.open() && document.getElementById('w192go').className === 'in') && !(await calls(s)).some(x => x.action === 'in'));
    ok('no page errors (your own page)', s.errs.length === 0, s.errs);
    await s.close();
  }

  /* 6. the walkthrough (the page tour "loop") and the chrome tour's step */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(false), rpcs: RPCS, candidate: cand });
    await stubFn(f);
    const chrome = await f.ev(() => (window.w122.tours.chrome.steps || []).filter(s => /w192go/.test(s.s || '')).map(s => ({ s: s.s, t: s.t, p: s.p }))[0]);
    ok('the chrome tour’s step is The Loop, on #w192go', chrome && chrome.t === 'The Loop' && /I’m in/.test(chrome.p) && /hours are yours and HR’s/.test(chrome.p), chrome);
    await f.hash('#training', 1800);
    const tile = await f.ev(() => [...document.querySelectorAll('[data-w122tour]')].map(b => ({ k: b.getAttribute('data-w122tour'), t: b.textContent })).filter(x => x.k === 'loop')[0]);
    ok('the Academy lists the walkthrough under Page tours', tile && /The Loop/.test(tile.t), tile);
    await f.page.click('[data-w122tour="loop"]'); await f.page.waitForTimeout(400);
    const intro = await f.ev(() => { const st = document.querySelector('[data-w122starttour="loop"]'); return !!st; });
    if (intro) { await f.page.click('[data-w122starttour="loop"]'); }
    await f.page.waitForTimeout(2600);
    const seen = [];
    for (let i = 0; i < 12; i++) {
      const st = await f.ev(() => { const L = document.querySelector('.w122tp'); if (!L) return null; const pop = L.querySelector('.pop'); return { t: (pop.querySelector('h4') || {}).textContent, hole: L.querySelector('.hole').className, sheet: !!document.getElementById('w192sheet') && getComputedStyle(document.getElementById('modalBack')).display !== 'none', pv: !!document.querySelector('#w192sheet .pv'), next: (pop.querySelector('[data-w122tnext]') || {}).textContent }; });
      if (!st) break;
      seen.push(st);
      if (st.next === 'Finish') { await f.page.click('.w122tp [data-w122tnext]'); await f.page.waitForTimeout(1500); break; }
      await f.page.click('.w122tp [data-w122tnext]'); await f.page.waitForTimeout(1900);
    }
    const titles = seen.map(s => s.t);
    ok('the walkthrough runs every step in order', JSON.stringify(titles) === JSON.stringify(['The Loop', 'I’m in', 'What moved', 'Add what the Hub could not see', 'Tick what is finished', 'Who sees it', 'Close the loop', 'Your hours are yours']), titles);
    ok('each part it points at is highlighted (not a centred card)', seen.slice(1, 7).every(s => s.hole === 'hole'), seen.map(s => s.hole));
    ok('it opens the sheet in preview from What moved on, marked Walkthrough', seen.slice(2, 7).every(s => s.sheet && s.pv) && !seen[1].sheet, seen.map(s => [s.sheet, s.pv]));
    const after = await f.ev(() => ({ layer: !!document.querySelector('.w122tp'), sheet: !!document.getElementById('w192sheet') && getComputedStyle(document.getElementById('modalBack')).display !== 'none', open: !!w116jCk.open(), preview: w192.state().preview }));
    ok('finishing the tour closes the preview', !after.layer && !after.sheet && !after.preview, after);
    ok('the walkthrough starts no session and calls nothing', !after.open && (await calls(f)).length === 0, await calls(f));
    ok('no page errors (the walkthrough)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 7. wave118b: the notes under the new button, in The Loop's words */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(false), rpcs: RPCS, candidate: cand });
    await stubFn(f);
    await f.ev(() => { localStorage.removeItem('w118bSnooze'); localStorage.removeItem('w118bSeen'); window.__wa118b.decide('open'); });
    await f.page.waitForTimeout(300);
    const n = await f.ev(() => { const x = document.getElementById('w118ck'), g = document.getElementById('w192go'); if (!x) return null; const a = x.getBoundingClientRect(), b = g.getBoundingClientRect(); return { text: x.textContent, below: a.top >= b.bottom, near: Math.abs(a.left - b.left) < 40 || Math.abs(a.right - b.right) < 40 }; });
    ok('the nudge sits under I’m in and asks "Starting some work?"', n && /Starting some work\?/.test(n.text) && /I’m in/.test(n.text) && n.below && n.near, n);
    await f.page.click('#w118ck [data-w118b="in"]'); await f.page.waitForTimeout(800);
    ok('its I’m in starts a session', await f.ev(() => !!w116jCk.open() && !document.getElementById('w118ck')));
    await f.close();
    const g = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(true), rpcs: RPCS, candidate: cand });
    await stubFn(g);
    await g.ev(() => { localStorage.setItem('w118bHid', String(Date.now() - 30 * 60000)); window.__wa118b.decide('back'); });
    await g.page.waitForTimeout(300);
    const back = await g.ev(() => (document.getElementById('w118ck') || {}).textContent || '');
    ok('back after a while: "Close as of" a time, never "check out"', /Welcome back/.test(back) && /Close as of/.test(back) && !/[Cc]heck(ed)? ?out|checked in/.test(back), back);
    /* the stub acknowledges writes without applying them: end the row as the database would, so wave116j's reload finds it closed */
    await g.ev(() => { (window.__WAFIX.hub_checkins || []).forEach(r => { if (r.id === 901) r.ended_at = new Date(Date.now() - 30 * 60000).toISOString(); }); });
    await g.page.click('#w118ck [data-w118b="asof"]'); await g.page.waitForTimeout(1200);
    const as = await g.ev(() => ({ sheet: !!document.getElementById('w192sheet'), row: w192.state().row, open: !!w116jCk.open() }));
    ok('closing as of that time opens the wrap-up sheet for that session (nothing posted)', as.sheet && as.row && as.row.id === 901 && !!as.row.ended_at && !as.open && !(await calls(g)).some(c => c.action === 'out'), as);
    ok('the draft is asked for that session', (await calls(g)).some(c => c.action === 'draft' && c.body.checkin_id === 901));
    await g.ev(() => { closeModal(); });
    await g.close();
    const h = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(true), rpcs: RPCS, candidate: cand });
    await h.ev(() => { w116jCk.open().started_at = new Date(Date.now() - 4 * 3600000).toISOString(); localStorage.setItem('w118bAsked', '0'); window.__wa118b.decide('tick'); });
    await h.page.waitForTimeout(300);
    const lg = await h.ev(() => (document.getElementById('w118ck') || {}).textContent || '');
    ok('a long session asks "Still in?" and says only you see the time', /Still in\?/.test(lg) && /only you see this/.test(lg) && !/logged properly/.test(lg), lg);
    ok('no page errors (the notes)', f.errs.length === 0 && g.errs.length === 0 && h.errs.length === 0, f.errs.concat(g.errs, h.errs));
    await h.close();
  }

  /* 8. a phone, and a board viewer */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx(true), rpcs: RPCS, candidate: cand });
    await stubFn(f);
    const b = await f.ev(() => { const g = document.getElementById('w192go'); const r = g.getBoundingClientRect(); return { vis: r.width > 0 && r.right <= innerWidth + 1, t: getComputedStyle(g.querySelector('.t')).display }; });
    ok('on a phone the button shows, without the time', b.vis && b.t === 'none', b);
    await f.page.click('#w192go'); await f.page.waitForTimeout(900);
    const s = await f.ev(() => { const box = document.getElementById('modalBox') || document.getElementById('w192sheet'); const r = box.getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, w: innerWidth, l: r.left, r: r.right }; });
    ok('the sheet fits a phone (no sideways scroll)', s.sw <= s.w + 1 && s.l >= -1 && s.r <= s.w + 1, s);
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
    const v = await fresh(browser, { who: 'board', width: 1366, hash: '#mypage', fixture: fx(false), rpcs: RPCS, candidate: cand });
    ok('a board viewer has no Loop button', !(await v.ev(() => !!document.getElementById('w192go'))));
    ok('no page errors (board)', v.errs.length === 0, v.errs);
    await v.close();
  }

  /* 9. the reading and the Week 1 lesson, as they are in the database (test/fx_w192.json, the live rows of 01/10/26 after the
        release words), laid over the Academy of test/fx_w190.json */
  {
    const fs = require('fs');
    const X = JSON.parse(fs.readFileSync(path.join(__dirname, 'fx_w190.json'), 'utf8'));
    const L = JSON.parse(fs.readFileSync(path.join(__dirname, 'fx_w192.json'), 'utf8'));
    const f0 = fx(false);
    const ids = L.trainings.map(t => t.id);
    f0.trainings = X.trainings.filter(t => ids.indexOf(t.id) < 0 && t.key !== 'tour:loop').concat(L.trainings);
    f0.onboarding_template = X.onboarding_template.filter(o => o.id !== '86e1cj9gn').concat(L.onboarding_template);
    f0.academy_paths = X.academy_paths;
    f0.training_progress = [];
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#training', fixture: f0, rpcs: RPCS, candidate: cand, wait: 5200 });
    await f.hash('#training/t/216', 1600);
    const r = await f.ev(() => {
      const sh = document.querySelector('#w122sheet .sh'); if (!sh) return null; const pr = sh.querySelector('.prose');
      const ol = pr && pr.querySelector('ol.w190ol');
      return { title: (sh.querySelector('.hd h2') || {}).textContent, h3: [...pr.querySelectorAll('h3')].map(x => x.textContent), steps: ol ? ol.children.length : 0,
        calls: [...pr.querySelectorAll('.callout b')].map(x => x.textContent.trim()), raw: pr.innerHTML.indexOf('**') >= 0 || /(^|\n)\s*##\s/.test(pr.innerText),
        old: /Check in|Check out|check-in-out-wa|Loom/.test(sh.textContent), video: !!sh.querySelector('iframe'), tour: !!sh.querySelector('[data-w122starttour="loop"]'),
        see: /See it for yourself/.test(sh.textContent) };
    });
    ok('the reading is The Loop, with its four headings', r && /^The Loop: I'm in, close the loop/.test(r.title) && JSON.stringify(r.h3.slice(0, 4)) === JSON.stringify(['Two buttons, one habit', 'Why we do it', 'What it is not', 'How to close the loop']), r);
    ok('its six steps are numbered', r && r.steps === 6, r && r.steps);
    ok('Tip, Good to know, Try it and Done when are callouts', r && ['Tip', 'Good to know', 'Try it', 'Done when'].every(k => r.calls.some(c => c.indexOf(k) === 0)), r && r.calls);
    ok('no raw markdown, no Loom video, no old words', r && !r.raw && !r.video && !r.old, r);
    ok('the walkthrough card sits under the reading (See it for yourself)', r && r.tour && r.see, r);
    await f.page.click('[data-w122starttour="loop"]'); await f.page.waitForTimeout(3200);
    const t1 = await f.ev(() => { const L2 = document.querySelector('.w122tp'); return L2 ? (L2.querySelector('.pop h4') || {}).textContent : null; });
    ok('the card starts the walkthrough', t1 === 'The Loop', t1);
    await f.ev(() => { const x = document.querySelector('.w122tp [data-w122tx]'); if (x) x.click(); });
    await f.page.waitForTimeout(600);
    await f.hash('#training/t/222', 1600);
    const w1 = await f.ev(async () => {
      const b = [...document.querySelectorAll('#w122sheet [data-w122ch]')].filter(x => /work together/i.test(x.textContent))[0];
      if (b) { b.click(); await new Promise(r2 => setTimeout(r2, 500)); }
      const pr = document.querySelector('#w122sheet .prose') || {}; const t = pr.textContent || '';
      return { found: !!b, loop: /The Loop/.test(t) && /Close the loop/.test(t), never: /never your hours/.test(t), old: /Check in and out|#check-in-out-wa/.test(t) };
    });
    ok('the Week 1 lesson’s habits chapter has The Loop card, never the old words', w1 && w1.found && w1.loop && w1.never && !w1.old, w1);
    ok('no page errors (the live rows)', f.errs.length === 0, f.errs);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
