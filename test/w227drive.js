/* w227drive.js: wave227, someone to meet this week (the weekly introduction pop-up).
   wa227_my_intro is answered by window.__WA_RPCS; wa227_intro_act calls are recorded by wrapping db.rpc; window.open and
   the clipboard are recorded. Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). CAND=<file>; SHOTS=1 saves
   screenshots in test/shots_w227/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w227') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

const INTRO = {
  id: 41, week: '2026-09-21', source: 'weekly', status: 'new', can_share: true, from: null,
  note: 'Ian directs marketing across every platform. You could explore how the Donor Program shows up in our stories <b>this fall</b>.',
  hello: 'Hey Ian, I would love to chat about the Donor Program and our stories. Quick coffee sometime?',
  other: { id: 17, name: 'Ian Odhiambo', first: 'Ian', role: 'Director of Marketing', department: 'marketing', team: 'Marketing, Branding & Web', email: 'ian.odhiambo@welfareavenue.com', avatar_url: null, color: '#6F64AB', slack_id: 'U0A7DF871FS' },
  me: { id: 30, name: 'Alexis' }
};
const INIT = `window.__227acts = []; (function hook() { try { if (typeof db !== 'undefined' && db && db.rpc && !db.__227) { var orig = db.rpc.bind(db); db.rpc = function (fn, args) { if (fn === 'wa227_intro_act') { window.__227acts.push(args); return Promise.resolve({ data: { ok: true, shared: args.p_action === 'share' ? 99 : null }, error: null }); } return orig(fn, args); }; db.__227 = true; return; } } catch (e) {} setTimeout(hook, 50); })(); window.__227open = []; window.__227clip = []; window.open = function (u) { window.__227open.push(String(u)); return null; };
  try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: function (t) { window.__227clip.push(String(t)); return Promise.resolve(); } }, configurable: true }); } catch (e) {}`;
const WRAP = `window.__227acts = []; (function () { var orig = db.rpc.bind(db); db.rpc = function (fn, args) { if (fn === 'wa227_intro_act') { window.__227acts.push(args); return Promise.resolve({ data: { ok: true, shared: args.p_action === 'share' ? 99 : null }, error: null }); } return orig(fn, args); }; })();`;
const read = (p) => p.evaluate(() => {
  const b = document.getElementById('w227'); if (!b) return null;
  return { h: (b.querySelector('h2') || {}).textContent, small: (b.querySelector('.w227band small') || {}).textContent, name: (b.querySelector('.w227who b') || {}).textContent, sub: (b.querySelector('.w227who div > span') || {}).textContent,
    note: (b.querySelector('.w227note') || {}).textContent, noteHtml: (b.querySelector('.w227note') || {}).innerHTML, hello: (b.querySelector('.w227hello span') || {}).textContent,
    buttons: [...b.querySelectorAll('.w227acts button')].map(x => x.textContent.trim()), later: !!b.querySelector('.w227foot [data-w227="later"]'), modal: (b.querySelector('[role=dialog]') || { getAttribute: () => null }).getAttribute('aria-modal'), av: (b.querySelector('.w227av') || {}).textContent };
});

(async () => {
  const browser = await launch();
  /* an admin with this week's introduction */
  const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', wait: 1500, init: INIT, rpcs: { wa_org_editor: true, my_due_date_check: [], wa227_my_intro: INTRO } });
  const p = f.page;
  await p.waitForSelector('#w227', { timeout: 15000 }).catch(() => null);
  await p.waitForTimeout(500);
  let a = await read(p);
  ok('the pop-up opens once the Hub is ready', !!a, a);
  if (a) {
    ok('says who and why', a.h === 'Say hello to Ian' && /Someone to meet this week/.test(a.small) && a.name === 'Ian Odhiambo' && /Director of Marketing/.test(a.sub) && /Marketing, Branding/.test(a.sub), a);
    ok('the note and the hello, escaped', /Donor Program/.test(a.note) && /&lt;b&gt;/.test(a.noteHtml) && /Quick coffee/.test(a.hello), a.noteHtml);
    ok('three options and Maybe later', a.buttons.join('|') === 'Say hi on Slack|Book a 15-minute coffee chat|Tell Ian too' && a.later, a.buttons);
    ok('a modal dialog; initials when there is no photo', a.modal === 'true' && a.av === 'IO', a);
  }
  await shot(f, 'admin_open');
  let acts = await p.evaluate(() => window.__227acts.slice());
  ok('marked seen when shown', acts.some(x => x.p_id === 41 && x.p_action === 'seen'), acts);
  await p.click('#w227 [data-w227="share"]'); await p.waitForTimeout(500);
  a = await read(p);
  acts = await p.evaluate(() => window.__227acts.slice());
  ok('Tell Ian too: recorded, and the button says so', acts.some(x => x.p_action === 'share') && a.buttons.indexOf('Ian will see this too') >= 0, [acts, a && a.buttons]);
  await p.click('#w227 [data-w227="slack"]'); await p.waitForTimeout(500);
  const sl = await p.evaluate(() => ({ open: window.__227open.slice(), clip: window.__227clip.slice(), acts: window.__227acts.slice() }));
  a = await read(p);
  ok('Say hi on Slack: their Slack profile opens, the hello is copied', sl.open.some(u => u === 'https://welfareavenue.slack.com/team/U0A7DF871FS') && sl.clip[0] === INTRO.hello && sl.acts.some(x => x.p_action === 'slack'), sl);
  ok('the button says the hello is copied', a && a.buttons[0] === 'Hello copied: paste it in Slack', a && a.buttons);
  await p.click('#w227 [data-w227="coffee"]'); await p.waitForTimeout(400);
  const cal = await p.evaluate(() => window.__227open.slice(-1)[0]);
  const u = new URL(cal);
  ok('Book a coffee chat: a Google Calendar invite with Ian, 15 minutes, a weekday at 10', u.host === 'calendar.google.com' && u.searchParams.get('action') === 'TEMPLATE' && u.searchParams.get('add') === 'ian.odhiambo@welfareavenue.com' && /^Coffee chat: Alexis and Ian$/.test(u.searchParams.get('text')) && /^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/.test(u.searchParams.get('dates')), cal);
  const d = u.searchParams.get('dates').split('/');
  const t0 = Date.parse(d[0].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')), t1 = Date.parse(d[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
  ok('the slot is 15 minutes on a weekday', t1 - t0 === 15 * 60000 && [1, 2, 3, 4, 5].indexOf(new Date(t0).getDay()) >= 0, [t0, t1]);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  acts = await p.evaluate(() => window.__227acts.slice());
  ok('Esc closes it as Maybe later', !(await read(p)) && acts.some(x => x.p_action === 'later'), acts);
  ok('admin: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* someone shared an introduction: it comes from them, no Tell button; the profile link closes and opens the profile */
  const SH = Object.assign({}, INTRO, { id: 42, source: 'shared', can_share: false, from: 'Alexis Walter' });
  const g = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', wait: 1500, init: INIT, rpcs: { wa_org_editor: true, my_due_date_check: [], wa227_my_intro: SH } });
  await g.page.waitForSelector('#w227', { timeout: 15000 }).catch(() => null);
  a = await read(g.page);
  ok('shared: who would like to meet you, no Tell button', a && a.h === 'Alexis would like to meet you' && /An introduction for you/.test(a.small) && a.buttons.length === 2, a);
  await g.page.click('#w227 [data-w227="profile"]'); await g.page.waitForTimeout(800);
  const gp = await g.page.evaluate(() => ({ hash: location.hash, open: !!document.getElementById('w227'), acts: window.__227acts.slice() }));
  ok('See their profile: closes and opens #person/17', gp.hash === '#person/17' && !gp.open && gp.acts.some(x => x.p_action === 'profile'), gp);
  await g.close();

  /* nothing this week: nothing shows */
  const h = await fresh(browser, { who: 'plain', width: 1366, hash: '#mypage', wait: 1500, rpcs: { my_due_date_check: [], wa227_my_intro: null } });
  await h.page.waitForTimeout(6000);
  ok('no introduction: no pop-up', !(await read(h.page)));
  ok('member: no page errors', h.errs.length === 0, h.errs);
  await h.close();

  /* the due-date check comes first: the introduction waits until it is gone */
  const ROWS = [{ task_id: 701, title: 'Send the newsletter', department: 'marketing', owner: 'Steel', due_date: '2026-09-20', why: 'overdue', meeting_title: null, meeting_date: null, next_meeting: '2026-09-30', following_meeting: '2026-10-07', suggested: '2026-09-30' }];
  const k = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', wait: 1500, init: INIT, rpcs: { wa_org_editor: true, my_due_date_check: ROWS, wa227_my_intro: INTRO } });
  await k.page.waitForTimeout(7000);
  const both = await k.page.evaluate(() => ({ due: !!document.getElementById('w213pop'), intro: !!document.getElementById('w227') }));
  ok('with the due-date check open, the introduction waits', both.due && !both.intro, both);
  await k.page.evaluate(() => { const el = document.getElementById('w213pop'); if (el) el.remove(); });
  await k.page.waitForTimeout(3500);
  ok('then it shows', await k.page.evaluate(() => !!document.getElementById('w227')));
  await k.close();

  /* a phone */
  const m = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', wait: 1500, init: INIT, rpcs: { wa_org_editor: true, my_due_date_check: [], wa227_my_intro: INTRO } });
  await m.page.waitForSelector('#w227', { timeout: 15000 }).catch(() => null);
  await m.page.waitForTimeout(500);
  const ph = await m.page.evaluate(() => { const c = document.querySelector('#w227 .w227card'); const r = c.getBoundingClientRect(); const bs = [...document.querySelectorAll('#w227 .w227acts button')].map(b => b.getBoundingClientRect().width); return { w: r.width, right: r.right, iw: window.innerWidth, bs, sw: document.documentElement.scrollWidth }; });
  ok('phone: a bottom sheet, full-width buttons, no sideways scroll', ph.right <= ph.iw && ph.w >= ph.iw - 2 && ph.bs.every(x => x > 300) && ph.sw <= ph.iw, ph);
  await shot(m, 'phone');
  ok('phone: no page errors', m.errs.length === 0, m.errs);
  await m.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
