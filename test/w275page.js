/* w275page.js: the hire's side of the /o/<token> page (build/o/index.html), wave275 Task 3, offline.
   The onboard-link function is stubbed with page.route (a small state machine: no call reaches any real function); the page and the brand fonts
   are served from disk. Run: cd test && node w275page.js        Screenshots: test/shots_w275page/ (git-ignored), or SHOTS=<dir>.
   Covered: opening makes one GET and no POST; Accept with the hours line ("I confirm I can give at least N hours a week to Welfare Avenue"), which
   must be ticked first and is sent as hours_ok; an offer from before wave275 (no hours) keeps its Accept and its grid; the two proposed times with
   the manager in Toronto time, Yes or No each one POST under a double click; Yes then the closing page ("Your invites are on their way; <manager>
   will see you on <date>") with the rundown link; Yes on times that moved (stale): the sentence and the grid; No with availability asked: the grid
   with the 10-hour minimum, and Save shows the closing page ("<manager> will pick from your times"); No with availability already communicated:
   the closing page at once ("<manager> will be in touch with other times") and no grid; a second No: a person will be in touch; no proposal yet:
   "We are choosing your times now"; the rundown (?setup): every step, Done ticks that post setup_tick; French; 390 px; no "AI" and no em dash.
   wave278 Task 5: the twelve steps with their links (four Chrome downloads), the groups with their purposes, the drives, the weekly meeting, the
   Hub-set tick (no Done button), the QR of the install URL (the QR maker served from test/qrcode-generator-1.4.4.js at its cdnjs address) with the
   URL under it, the walkthrough video when set, the plain sentences when Task 3 has added nothing; the phone page (?install), EN and FR, 390 px. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGE_FILE = path.join(__dirname, '..', 'build', 'o', 'index.html');
const PAGE = fs.readFileSync(PAGE_FILE, 'utf8');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots_w275page');
fs.mkdirSync(SHOTS, { recursive: true });
const FN = 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/onboard-link';
const TOK = '12.ABCDEFGHIJKLMNOPQRST';
const NOW = '2026-10-28T09:00:00-04:00';   // Wednesday 28/10/26, 9 am in Toronto
const CALL = '2026-11-02T15:00:00Z', ONE = '2026-11-02T16:30:00Z';   // Monday 02/11/26, 10 am and 11:30 am in Toronto (UTC-5 from 01/11)
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }

/* Fixture only: the instant of a Toronto wall clock (UTC-4 until the night of 01/11/26, UTC-5 after). The page never does this. */
const utc = (date, minutes) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d, 0, minutes) + (date < '2026-11-01' ? 4 : 5) * 3600000; };
const stamp = ms => new Date(ms).toISOString().replace('.000Z', 'Z');
function gridWindow(minHours) {
  const out = { start: 8, end: 21, cellMin: 30, minHours, days: [], slots: [] };
  const now = Date.parse(NOW);
  for (let i = 0; i < 14; i++) {
    const date = new Date(Date.UTC(2026, 9, 28 + i)).toISOString().slice(0, 10);
    const cells = [];
    for (let min = 8 * 60; min + 30 <= 21 * 60; min += 30) { const at = utc(date, min); if (at > now) cells.push(stamp(at)); }
    if (!cells.length) continue;
    out.days.push({ date, open: cells[0], close: stamp(utc(date, 21 * 60)) });
    out.slots.push(...cells);
  }
  return out;
}
/* wave278 Task 5: the twelve steps, shaped as onboard-link's SETUP (links where the function has them) */
const KEYS = ['google', 'chrome', 'bookmarks', 'drive', 'groups', 'hub', 'slack', 'canva', 'academy', 'jd', 'weekly', 'phone'];
const CHROME = [['Mac', 'https://www.google.com/chrome/'], ['Windows', 'https://www.google.com/chrome/'], ['Android', 'https://play.google.com/store/apps/details?id=com.android.chrome'], ['iPhone', 'https://apps.apple.com/app/google-chrome/id535886823']];
const LINKS = {
  chrome: CHROME.map(([n, url]) => ({ label: { en: 'Chrome for ' + n, fr: 'Chrome pour ' + n }, url })),
  bookmarks: [['Gmail', 'https://mail.google.com/'], ['Google Calendar', 'https://calendar.google.com/'], ['The Hub', 'https://hub.welfareavenue.com/']].map(([n, url]) => ({ label: { en: n, fr: n }, url })),
  academy: [['The Avenue Academy', 'https://hub.welfareavenue.com/#training'], ['The Hub home page', 'https://hub.welfareavenue.com/']].map(([n, url]) => ({ label: { en: n, fr: n }, url })),
};
const STEPS = KEYS.map((key, i) => Object.assign({ key, title: { en: 'Step ' + (i + 1) + ' in English', fr: 'Étape ' + (i + 1) + ' en français' }, body: { en: 'What to do for ' + key + '.', fr: 'Quoi faire pour ' + key + '.' } }, LINKS[key] ? { links: LINKS[key] } : {}));
const HUB_URL = 'https://hub.welfareavenue.com/';
const INSTALL_URL = 'https://hub.welfareavenue.com/o/' + TOK + '?install';
const EXTRA = {
  address: 'amina.diallo@welfareavenue.com', drives: ['Org\'s Files', 'Operations'],
  groups: [{ address: 'org@welfareavenue.com', purpose: { en: 'everyone at Welfare Avenue', fr: 'toute l’équipe de Welfare Avenue' } }, { address: 'operations@welfareavenue.com', purpose: { en: 'your team’s list', fr: 'la liste de votre équipe' } }],
  weekly: { summary: 'Operations weekly', nextAt: '2026-11-03T18:00:00Z' },   // Tuesday 03/11/26, 1 pm in Toronto
  channelLink: 'https://join.slack.com/share/enQtChannel', slackJoin: 'https://join.slack.com/t/welfareavenue/shared_invite/zt-join',
  canva: 'https://www.canva.com/brand/join?token=abc', jd: 'https://docs.google.com/document/d/jd7', googleVideo: 'https://www.loom.com/share/chrome-login', video: null, installUrl: INSTALL_URL,
};
const QRLIB = fs.readFileSync(path.join(__dirname, 'qrcode-generator-1.4.4.js'), 'utf8');
const QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
const STALE = { en: 'Sorry, those times no longer work for your manager. Please mark when you are free below, and they will pick from your times.', fr: 'Désolés, ces heures ne conviennent plus à votre gestionnaire. Indiquez ci-dessous quand vous êtes disponible, et votre gestionnaire choisira parmi vos plages.' };
const ANSWERED = { en: 'Thank you. A person from Welfare Avenue will be in touch with you about the times.', fr: 'Merci. Une personne de Welfare Avenue communiquera avec vous au sujet des heures.' };
const HOURS_REQ = { en: 'Please tick the box to confirm you can give at least 6 hours a week to Welfare Avenue, then press Accept.', fr: 'Veuillez cocher la case pour confirmer que vous pouvez consacrer au moins 6 heures par semaine à Welfare Avenue, puis appuyer sur Accepter.' };

/* the stub function: what onboard-link answers, and how each POST changes it */
function makeHire(over) {
  const S = Object.assign({ first: 'Amina', role: 'Event Coordinator', lang: 'en', answered: '', offerHours: 6, mode: 'propose', proposal: { call_at: CALL, one_on_one_at: ONE }, bookedTimes: null, answer: null, askAvailability: true, manager: 'Marc Dubois', ticks: {}, slotsSaved: [], minHours: 10, delay: 250, yesReply: null, noReply: null, secondNo: null }, over || {});
  const calls = [];
  const handler = async route => {
    const req = route.request();
    const cors = { 'Access-Control-Allow-Origin': 'https://hub.welfareavenue.com', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    const send = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
    const call = { method: req.method(), url: req.url(), body: req.postData() ? JSON.parse(req.postData()) : null };
    calls.push(call);
    if (req.method() === 'GET' && new URL(req.url()).searchParams.has('install')) {   // wave278: the phone page
      if (S.installStatus) return send(S.installStatus, S.installBody || { ok: false });
      return send(200, { ok: true, kind: 'offer', first: S.first, lang: S.lang, install: { hub: 'https://hub.welfareavenue.com/', slack: 'https://slack.com/download' } });
    }
    if (req.method() === 'GET') {
      const accepted = S.answered === 'accept';
      return send(200, {
        ok: true, kind: 'offer', first: S.first, role: S.role, lang: S.lang, answered: S.answered, closed: false, late: false, booked: !!S.bookedTimes, callBooked: !!S.bookedTimes,
        grid: gridWindow(S.minHours), slotsSaved: S.slotsSaved, offerHours: S.offerHours, hoursConfirmed: accepted && !!S.offerHours, mode: S.mode, hoursRequired: S.hoursRequired,
        proposal: S.proposal, bookedTimes: S.bookedTimes, answer: S.answer, askAvailability: S.askAvailability, manager: S.manager, secondNo: S.secondNo, lengths: { callMin: 60, oneMin: 30 }, managerFree: S.managerFree, managerHours: S.managerHours,
        setup: accepted ? Object.assign({ steps: STEPS, ticks: Object.fromEntries(STEPS.map(s => [s.key, !!S.ticks[s.key]])) }, EXTRA, S.extra || {}) : null,
      });
    }
    const b = call.body || {};
    if (b.a === 'accept') {
      await new Promise(r => setTimeout(r, S.delay));
      if (S.offerHours && S.hoursRequired !== false && b.hours_ok !== true) return send(400, { ok: false, error: 'hours_required', message: HOURS_REQ });
      const repeated = !!S.answered;
      S.answered = 'accept';
      return send(200, { ok: true, first: S.first, role: S.role, lang: S.lang, answer: 'accept', answered: 'accept', repeated, late: false });
    }
    if (b.a === 'yes') {
      await new Promise(r => setTimeout(r, S.delay));
      if (S.yesReply) { if (S.yesReply.body.stale) S.answer = 'no'; return send(S.yesReply.status, S.yesReply.body); }
      const repeated = S.answer === 'yes';
      S.answer = 'yes'; S.bookedTimes = S.proposal;
      return send(200, { ok: true, answer: 'yes', repeated, bookedTimes: S.bookedTimes });
    }
    if (b.a === 'no') {
      await new Promise(r => setTimeout(r, S.delay));
      if (S.noReply) { if (S.noReply.body.error === 'answered') S.secondNo = S.noReply.body.message; return send(S.noReply.status, S.noReply.body); }
      const repeated = S.answer === 'no';
      S.answer = 'no';
      return send(200, { ok: true, answer: 'no', repeated, askAvailability: S.askAvailability });
    }
    if (b.a === 'grid') {
      S.slotsSaved = (b.slots || []).slice().sort();
      return send(200, { ok: true, saved: S.slotsSaved.length, dropped: 0, slotsSaved: S.slotsSaved, closed: false });
    }
    if (b.a === 'setup_tick') {
      S.ticks[b.key] = !!b.done;
      return send(200, { ok: true, ticks: Object.fromEntries(STEPS.map(s => [s.key, !!S.ticks[s.key]])) });
    }
    return send(400, { ok: false });
  };
  return { S, calls, handler };
}

async function launch() {
  const args = ['--disable-gpu'];   // on this PC a headless Chrome with the GPU on hangs every screenshot
  const tries = [{ args }, { channel: 'chrome', args }, { channel: 'msedge', args }];
  let last;
  for (const t of tries) { try { return await chromium.launch(t); } catch (e) { last = e; } }
  throw last;
}
const FIXED = `(function(){ var FIXED = new Date(${JSON.stringify(NOW)}).getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; })();`;
async function open(browser, opts) {
  opts = opts || {};
  const phone = !!opts.phone;
  const ctx = await browser.newContext({ viewport: { width: phone ? 390 : 1366, height: phone ? 844 : 900 }, isMobile: phone, hasTouch: phone, timezoneId: 'Pacific/Auckland', locale: 'en-CA' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(FIXED);
  const fx = opts.fn || makeHire();
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(FN)) return fx.handler(route);
    if (url === QR_URL) { fx.qrLoads = (fx.qrLoads || 0) + 1; return route.fulfill({ contentType: 'application/javascript', body: QRLIB }); }   // wave278: the QR maker, from cdnjs as 225 loads it
    if (url.startsWith('https://hub.welfareavenue.com/o/')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE });
    if (url.indexOf('fonts.googleapis.com/css2') >= 0) return route.fulfill({ contentType: 'text/css', body: '' });
    if (url.startsWith('https://fonts.gstatic.com/s/')) { const fp = path.join(__dirname, 'fonts', url.split('/').pop()); if (fs.existsSync(fp)) return route.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(fp) }); }
    return route.abort();
  });
  await page.goto('https://hub.welfareavenue.com/o/' + TOK + (opts.qs || ''));
  await page.waitForTimeout(opts.wait || 500);
  return { ctx, page, fx, errors, gets: () => fx.calls.filter(c => c.method === 'GET'), posts: () => fx.calls.filter(c => c.method === 'POST') };
}
const text = p => p.evaluate(() => document.body.innerText);
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
const shot = async (p, name) => { await p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); };
const clean = s => !/\bAI\b/.test(s) && s.indexOf('—') < 0;
const allWords = p => p.evaluate(() => document.body.innerText + ' ' + Array.from(document.querySelectorAll('[aria-label],[title]')).map(e => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).join(' '));
const A29 = '2026-10-29T';
const run = n => { const a = []; for (let i = 0; i < n; i++) a.push(A29 + (12 + Math.floor(i / 2)) + ':' + (i % 2 ? '30' : '00') + ':00Z'); return a; };
const mark = (p, list) => p.evaluate(l => l.forEach(i => document.querySelector('[data-slot="' + i + '"]').click()), list);

(async () => {
  const browser = await launch();
  try {
    ok('page: no em dash and no "AI" in the source', clean(PAGE));

    /* 1. Accept with the hours line */
    let f = await open(browser);
    let t = await text(f.page);
    ok('open: one GET and no POST', f.gets().length === 1 && f.posts().length === 0, f.fx.calls.map(c => c.method));
    ok('hours: the line names the hours', /I confirm I can give at least 6 hours a week to Welfare Avenue/.test(t), t.slice(0, 500));
    ok('hours: Accept is disabled until the box is ticked', await f.page.locator('[data-act="accept"]').isDisabled() && !(await f.page.locator('#hours').isChecked()));
    ok('hours: Decline does not need it', await f.page.locator('[data-act="decline"]').isEnabled());
    await shot(f.page, 'w275-accept-hours');
    await f.page.locator('#hours').check();
    ok('hours: ticking enables Accept', await f.page.locator('[data-act="accept"]').isEnabled());
    await f.page.locator('[data-act="accept"]').dblclick();
    await f.page.waitForSelector('[data-act="yes"]', { timeout: 5000 });
    const acc = f.posts().filter(c => c.body.a === 'accept');
    ok('accept: one POST under a double click, with hours_ok true', acc.length === 1 && acc[0].body.hours_ok === true && acc[0].body.t === TOK, f.posts());
    t = await text(f.page);
    ok('times: both times, the manager and Toronto time', /Your onboarding call/.test(t) && /Mon, Nov 2/.test(t) && /10\sa\.m\./.test(t) && /11:30\sa\.m\./.test(t) && /Your 1-on-1 with Marc Dubois/.test(t) && /Toronto time/.test(t), t.slice(0, 700));
    ok('times: Yes and No, and no grid', (await f.page.locator('[data-act="yes"]').count()) === 1 && (await f.page.locator('[data-act="no"]').count()) === 1 && (await f.page.locator('[data-slot]').count()) === 0);
    ok('times: the call runs 10 to 11, and a clock never breaks across lines', /10 a\.m\. to 11 a\.m\./.test(t) && /12 p\.m\./.test(t), t.slice(0, 700));
    ok('times: the rundown link waits for the closing page', (await f.page.locator('#setuplink').count()) === 0);
    ok('times: no page errors', f.errors.length === 0, f.errors);
    await shot(f.page, 'w275-times-desktop');

    /* 2. Yes under a double click, then the closing page */
    await f.page.locator('[data-act="yes"]').dblclick();
    await f.page.waitForSelector('#closing', { timeout: 5000 });
    ok('yes: exactly one POST', f.posts().filter(c => c.body.a === 'yes').length === 1, f.posts().map(c => c.body.a));
    t = await text(f.page);
    ok('closing: Thank you, the invites, the manager and the date', /Thank you, Amina\./.test(t) && /Your invites are on their way; Marc Dubois will see you on Monday, November 2\./.test(t), t.slice(0, 600));
    const href = await f.page.locator('#setuplink').getAttribute('href');
    ok('closing: the rundown link (?setup), a plain GET link', /^\/o\/12\.ABCDEFGHIJKLMNOPQRST\?setup/.test(href || ''), href);
    await shot(f.page, 'w275-closing-booked');
    await f.ctx.close();

    /* a reload after the Yes opens on the closing page */
    f = await open(browser, { fn: makeHire({ answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE } }) });
    ok('reload after yes: the closing page, no buttons to answer again', (await f.page.locator('#closing').count()) === 1 && (await f.page.locator('[data-act="yes"]').count()) === 0 && f.posts().length === 0);
    await f.ctx.close();

    /* 3. an offer from before wave275: no hours line, its grid after Accept */
    f = await open(browser, { fn: makeHire({ offerHours: null, mode: 'grid', proposal: null, minHours: 0 }) });
    ok('old offer: no hours line, Accept enabled', (await f.page.locator('#hours').count()) === 0 && await f.page.locator('[data-act="accept"]').isEnabled());
    await f.page.locator('[data-act="accept"]').click();
    await f.page.waitForSelector('[data-slot]', { timeout: 5000 });
    const old = f.posts().filter(c => c.body.a === 'accept');
    ok('old offer: Accept posts no hours_ok, and the wave271 grid follows', old.length === 1 && old[0].body.hours_ok === undefined, old);
    await f.ctx.close();

    /* 3b. wave275b (03/11/26, Steel): onboard_require_hours off, so the function says hoursRequired: false. The line stays as an optional box; Accept
       is enabled without it and posts hours_ok as ticked or not */
    f = await open(browser, { fn: makeHire({ hoursRequired: false }) });
    t = await text(f.page);
    ok('optional hours: the line is still there, EN', /I confirm I can give at least 6 hours a week to Welfare Avenue/.test(t) && (await f.page.locator('#hours').count()) === 1, t.slice(0, 500));
    ok('optional hours: Accept is enabled without the box, and no sentence says to tick it', await f.page.locator('[data-act="accept"]').isEnabled() && !(await f.page.locator('#hours').isChecked()) && !/Tick the box above to accept/.test(t) && (await f.page.locator('#hoursneed:not(.hide)').count()) === 0);
    await shot(f.page, 'w275b-accept-optional');
    await f.page.locator('[data-act="accept"]').dblclick();
    await f.page.waitForSelector('[data-act="yes"]', { timeout: 5000 });
    let opt = f.posts().filter(c => c.body.a === 'accept');
    ok('optional hours: one POST under a double click, hours_ok false (not ticked), and the times follow', opt.length === 1 && opt[0].body.hours_ok === false, opt);
    await f.ctx.close();
    f = await open(browser, { fn: makeHire({ hoursRequired: false }) });
    await f.page.locator('#hours').check();
    await f.page.locator('[data-act="accept"]').click();
    await f.page.waitForSelector('[data-act="yes"]', { timeout: 5000 });
    opt = f.posts().filter(c => c.body.a === 'accept');
    ok('optional hours: ticked, hours_ok true', opt.length === 1 && opt[0].body.hours_ok === true, opt);
    await f.ctx.close();
    f = await open(browser, { qs: '?l=fr', fn: makeHire({ hoursRequired: false }) });
    t = await text(f.page);
    ok('optional hours (French): the line, Accept enabled', /Je confirme pouvoir consacrer au moins 6 heures par semaine à Welfare Avenue/.test(t) && await f.page.locator('[data-act="accept"]').isEnabled() && !/Cochez la case ci-dessus pour accepter/.test(t), t.slice(0, 400));
    await f.ctx.close();
    /* hoursRequired: true, or missing (a function from before wave275b): the box is required as before */
    f = await open(browser, { fn: makeHire({ hoursRequired: true }) });
    ok('required hours (hoursRequired true): Accept waits for the box', await f.page.locator('[data-act="accept"]').isDisabled() && /Tick the box above to accept/.test(await text(f.page)));
    await f.ctx.close();

    /* 4. No, with availability asked: the grid with the 10-hour minimum, Save shows the closing page */
    f = await open(browser, { fn: makeHire({ answered: 'accept' }) });
    await f.page.locator('[data-act="no"]').dblclick();
    await f.page.waitForSelector('[data-slot]', { timeout: 5000 });
    ok('no: exactly one POST', f.posts().filter(c => c.body.a === 'no').length === 1, f.posts().map(c => c.body.a));
    t = await text(f.page);
    ok('no: the grid asks for times for Marc Dubois to pick from', /Marc Dubois/.test(t) && /Toronto/.test(t), t.slice(0, 500));
    ok('no: the 10-hour minimum', (await f.page.locator('#count').innerText()).trim() === '0 of 10 hours marked' && await f.page.locator('#save').isDisabled());
    await mark(f.page, run(20));
    ok('no: 20 cells enable Save', await f.page.locator('#save').isEnabled());
    await shot(f.page, 'w275-no-grid');
    await f.page.locator('#save').click();
    await f.page.waitForSelector('#closing', { timeout: 5000 });
    const g = f.posts().filter(c => c.body.a === 'grid');
    ok('no: Save posts the 20 instants', g.length === 1 && g[0].body.slots.length === 20, g.map(c => c.body.slots.length));
    t = await text(f.page);
    ok('no: then the closing page, the manager picks', /Marc Dubois will pick from your times, and you will get calendar invites\./.test(t) && (await f.page.locator('[data-slot]').count()) === 0, t.slice(0, 500));
    ok('no: the rundown link is there too', (await f.page.locator('#setuplink').count()) === 1);
    await shot(f.page, 'w275-closing-picked');
    await f.ctx.close();
    /* the same, reloaded later: the closing page, with a way back to the grid */
    f = await open(browser, { fn: makeHire({ answered: 'accept', answer: 'no', slotsSaved: run(20) }) });
    ok('no reloaded: the closing page', /will pick from your times/.test(await text(f.page)));
    await f.page.locator('#regrid').click();
    ok('no reloaded: Change my times opens the grid with the saved cells', (await f.page.locator('[data-slot][aria-pressed="true"]').count()) === 20);
    await f.ctx.close();

    /* 4b. whole-branch I3: the No grid greys the cells where the manager is not free (managerFree from the function); those cells cannot be picked */
    const FREE = gridWindow(10).slots.filter(iso => { const p = new Date(iso); const h = (p.getUTCHours() + 24 - (iso < '2026-11-01T06:00:00Z' ? 4 : 5)) % 24; const wd = new Date(Date.parse(iso) - (iso < '2026-11-01T06:00:00Z' ? 4 : 5) * 3600000).getUTCDay(); return wd >= 1 && wd <= 5 && h >= 9 && h < 17; });
    f = await open(browser, { fn: makeHire({ answered: 'accept', managerFree: FREE }) });
    await f.page.locator('[data-act="no"]').click();
    await f.page.waitForSelector('.cell', { timeout: 5000 });
    const free29 = A29 + '13:00:00Z', busy29 = A29 + '12:00:00Z';   // Thursday 29 Oct: 9 am (free), 8 am (not free)
    ok('greys: a free cell can be picked', (await f.page.locator('[data-slot="' + free29 + '"]').count()) === 1);
    const grey = f.page.locator('.cell.mbusy[data-mbusy="' + busy29 + '"]');
    ok('greys: a cell where the manager is not free is greyed, with no slot to pick', (await grey.count()) === 1 && (await f.page.locator('[data-slot="' + busy29 + '"]').count()) === 0 && (await grey.getAttribute('aria-disabled')) === 'true', await f.page.locator('[data-di="1"]').count());
    ok('greys: its label says Marc Dubois is not free', /Marc Dubois is not free/.test(await grey.getAttribute('aria-label') || ''), await grey.getAttribute('aria-label'));
    await grey.click({ force: true });
    ok('greys: pressing it picks nothing', (await f.page.locator('#count').innerText()).trim() === '0 of 10 hours marked');
    t = await text(f.page);
    ok('greys: the legend in English', /Greyed times: Marc Dubois is not free then\./.test(t), t.slice(0, 700));
    ok('greys: a weekend day is all greyed', (await f.page.locator('[data-d="2026-10-31"] [data-slot]').count()) === 0 && (await f.page.locator('[data-d="2026-10-31"] .cell.mbusy').count()) > 0);
    await mark(f.page, FREE.slice(0, 20));
    ok('greys: 20 free cells still enable Save (the 10-hour minimum stays)', await f.page.locator('#save').isEnabled());
    await shot(f.page, 'w275-no-grid-greys');
    await f.page.locator('#swap').click();
    await f.page.waitForTimeout(200);
    t = await text(f.page);
    ok('greys: the legend in French', /Plages grisées: Marc Dubois n.est pas disponible à ces heures\./.test(t), t.slice(0, 700));
    ok('greys: the French label', /Marc Dubois n.est pas disponible/.test(await f.page.locator('.cell.mbusy').first().getAttribute('aria-label') || ''));
    ok('greys: no page errors', f.errors.length === 0, f.errors);
    await f.ctx.close();
    /* wave275b: onboard_manager_hours off (managerHours: false): the mask greys only hub@ meetings, and the legend and labels say so */
    const MEET = [A29 + '14:00:00Z', A29 + '14:30:00Z'];   // Thursday 29 Oct, 10 to 11 am: a hub@ meeting Marc is invited to
    f = await open(browser, { fn: makeHire({ answered: 'accept', managerHours: false, managerFree: gridWindow(10).slots.filter(iso => MEET.indexOf(iso) < 0) }) });
    await f.page.locator('[data-act="no"]').click();
    await f.page.waitForSelector('.cell', { timeout: 5000 });
    t = await text(f.page);
    ok('hours off: the legend names the hub@ meeting', /Greyed times: Marc Dubois has a hub@ meeting then\./.test(t) && !/is not free then/.test(t), t.slice(0, 700));
    ok('hours off: the meeting\'s cells are greyed with that label; 8 am and the weekend can be picked', /Marc Dubois has a hub@ meeting/.test(await f.page.locator('.cell.mbusy[data-mbusy="' + MEET[0] + '"]').getAttribute('aria-label') || '') && (await f.page.locator('[data-slot="' + busy29 + '"]').count()) === 1 && (await f.page.locator('[data-d="2026-10-31"] [data-slot]').count()) > 0);
    await f.page.locator('#swap').click();
    await f.page.waitForTimeout(200);
    ok('hours off: the legend in French', /Plages grisées: Marc Dubois a une rencontre hub@ à ces heures\./.test(await text(f.page)));
    await f.ctx.close();
    /* saved times that fall where the manager is not free are not kept as picked */
    f = await open(browser, { fn: makeHire({ answered: 'accept', answer: 'no', managerFree: FREE, slotsSaved: [free29, busy29] }) });
    await f.page.locator('#regrid').click();
    ok('greys: a saved time on a greyed cell is not counted', (await f.page.locator('[data-slot][aria-pressed="true"]').count()) === 1 && (await f.page.locator('#count').innerText()).trim() === '0.5 of 10 hours marked', await f.page.locator('#count').innerText());
    await f.ctx.close();
    /* no mask (the function could not read the manager's week): no greys and no legend */
    f = await open(browser, { fn: makeHire({ answered: 'accept', managerFree: null }) });
    await f.page.locator('[data-act="no"]').click();
    await f.page.waitForSelector('[data-slot]', { timeout: 5000 });
    ok('no mask: no greyed cell, no legend', (await f.page.locator('.cell.mbusy').count()) === 0 && !/Greyed times/.test(await text(f.page)));
    await f.ctx.close();

    /* 5. No, with availability already communicated: the closing page at once, no grid */
    f = await open(browser, { fn: makeHire({ answered: 'accept', askAvailability: false }) });
    await f.page.locator('[data-act="no"]').click();
    await f.page.waitForSelector('#closing', { timeout: 5000 });
    t = await text(f.page);
    ok('no, already communicated: Marc Dubois will be in touch, and no grid', /Marc Dubois will be in touch with other times\./.test(t) && (await f.page.locator('[data-slot]').count()) === 0, t.slice(0, 500));
    await f.ctx.close();

    /* 6. Yes on times that moved: the sentence and the grid */
    f = await open(browser, { fn: makeHire({ answered: 'accept', yesReply: { status: 409, body: { ok: false, stale: true, error: 'stale', message: STALE, askAvailability: true, which: 'call' } } }) });
    await f.page.locator('[data-act="yes"]').click();
    await f.page.waitForSelector('[data-slot]', { timeout: 5000 });
    t = await text(f.page);
    ok('stale: the plain sentence, then the grid', t.indexOf(STALE.en) >= 0 && (await f.page.locator('[data-slot]').count()) > 300, t.slice(0, 600));
    ok('stale: no Yes button left', (await f.page.locator('[data-act="yes"]').count()) === 0);
    await shot(f.page, 'w275-stale-grid');
    await f.ctx.close();

    /* 7. a second No: a person will be in touch */
    f = await open(browser, { fn: makeHire({ answered: 'accept', noReply: { status: 409, body: { ok: false, error: 'answered', message: ANSWERED } } }) });
    await f.page.locator('[data-act="no"]').click();
    await f.page.waitForSelector('#closing', { timeout: 5000 });
    t = await text(f.page);
    ok('second no: a person will be in touch, no grid', t.indexOf(ANSWERED.en) >= 0 && (await f.page.locator('[data-slot]').count()) === 0, t.slice(0, 500));
    await f.page.reload();
    await f.page.waitForSelector('#closing', { timeout: 5000 });
    t = await text(f.page);
    ok('second no, reloaded: still a person will be in touch, and no Yes or No to press again', t.indexOf(ANSWERED.en) >= 0 && (await f.page.locator('[data-act="yes"], [data-act="no"], [data-slot]').count()) === 0, t.slice(0, 500));
    await f.page.locator('#swap').click();
    await f.page.waitForTimeout(200);
    ok('second no: the sentence follows the language toggle', (await text(f.page)).indexOf(ANSWERED.fr) >= 0);
    await f.ctx.close();
    f = await open(browser, { qs: '?l=fr', fn: makeHire({ answered: 'accept', secondNo: ANSWERED }) });
    t = await text(f.page);
    ok('second no on open, in French: a person will be in touch, no buttons', t.indexOf(ANSWERED.fr) >= 0 && (await f.page.locator('[data-act="yes"], [data-act="no"]').count()) === 0 && f.posts().length === 0, t.slice(0, 400));
    await f.ctx.close();

    /* 8. no proposal yet */
    f = await open(browser, { fn: makeHire({ answered: 'accept', proposal: null }) });
    t = await text(f.page);
    ok('waiting: we are choosing your times, and no buttons, grid or rundown link', /We are choosing your times now; you will get an email within two days\./.test(t) && (await f.page.locator('[data-act="yes"], [data-slot], #setuplink').count()) === 0, t.slice(0, 400));
    await f.ctx.close();

    /* 9. the rundown */
    f = await open(browser, { qs: '?setup', fn: makeHire({ answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE }, ticks: { chrome: true } }) });
    t = await text(f.page);
    ok('rundown: every step in order', STEPS.every((s, i) => t.indexOf(s.title.en) >= 0 && (i === 0 || t.indexOf(STEPS[i - 1].title.en) < t.indexOf(s.title.en))), t.slice(0, 800));
    ok('rundown: the saved tick shows, and the count', (await f.page.locator('[data-tick="chrome"]').getAttribute('aria-pressed')) === 'true' && /1 of 12 done/.test(t), t.slice(0, 400));
    ok('rundown: opening posts nothing', f.posts().length === 0);
    await f.page.locator('[data-tick="slack"]').click();
    await f.page.waitForFunction(() => document.querySelector('[data-tick="slack"]').getAttribute('aria-pressed') === 'true', null, { timeout: 4000 });
    let ticks = f.posts().filter(c => c.body.a === 'setup_tick');
    ok('rundown: Done posts setup_tick {key, done: true}', ticks.length === 1 && ticks[0].body.key === 'slack' && ticks[0].body.done === true, ticks.map(c => c.body));
    ok('rundown: the count follows', /2 of 12 done/.test(await text(f.page)));
    await f.page.locator('[data-tick="chrome"]').click();
    await f.page.waitForFunction(() => document.querySelector('[data-tick="chrome"]').getAttribute('aria-pressed') === 'false', null, { timeout: 4000 });
    ticks = f.posts().filter(c => c.body.a === 'setup_tick');
    ok('rundown: a second press undoes it (done: false)', ticks.length === 2 && ticks[1].body.key === 'chrome' && ticks[1].body.done === false, ticks.map(c => c.body));
    ok('rundown: no page errors', f.errors.length === 0, f.errors);
    await shot(f.page, 'w275-rundown-desktop');
    await f.ctx.close();

    /* 10. French */
    f = await open(browser, { qs: '?l=fr', fn: makeHire({ lang: 'en' }) });
    t = await text(f.page);
    ok('French: the hours line', /Je confirme pouvoir consacrer au moins 6 heures par semaine à Welfare Avenue/.test(t), t.slice(0, 400));
    await f.page.locator('#hours').check();
    await f.page.locator('[data-act="accept"]').click();
    await f.page.waitForSelector('[data-act="yes"]', { timeout: 5000 });
    t = await text(f.page);
    ok('French: the times and the buttons', /Votre appel d.accueil/.test(t) && /Votre rencontre individuelle avec Marc Dubois/.test(t) && /Oui, les deux me conviennent/.test(t) && /Non, proposer d.autres heures/.test(t) && /heure de Toronto/i.test(t), t.slice(0, 700));
    await f.page.locator('[data-act="yes"]').click();
    await f.page.waitForSelector('#closing', { timeout: 5000 });
    t = await text(f.page);
    ok('French: the closing page', /Merci, Amina\./.test(t) && /Vos invitations sont en route; Marc Dubois vous verra le lundi 2 novembre\./.test(t), t.slice(0, 500));
    await f.ctx.close();
    f = await open(browser, { qs: '?setup&l=fr', fn: makeHire({ answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE } }) });
    t = await text(f.page);
    ok('French: the rundown', /Étape 1 en français/.test(t) && /0 sur 12 terminées/.test(t), t.slice(0, 400));
    await f.ctx.close();
    f = await open(browser, { qs: '?l=fr', fn: makeHire({ answered: 'accept', proposal: null }) });
    ok('French: waiting', /Nous choisissons vos heures en ce moment; vous recevrez un courriel d.ici deux jours\./.test(await text(f.page)));
    await f.ctx.close();

    /* 12. wave278 Task 5: the twelve-step page, its lists and links, the Hub-set tick, the QR of the install page */
    f = await open(browser, { qs: '?setup', wait: 900, fn: makeHire({ answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE }, ticks: { hub: true } }) });
    t = await text(f.page);
    ok('w278: the twelve steps in order', STEPS.every((s, i) => t.indexOf(s.title.en) >= 0 && (i === 0 || t.indexOf(STEPS[i - 1].title.en) < t.indexOf(s.title.en))) && (await f.page.locator('.rstep').count()) === 12, t.slice(0, 900));
    ok('w278: the count is of twelve, the Hub-set tick counted', /1 of 12 done/.test(t), t.slice(0, 400));
    ok('w278: the hub step has no Done button, it shows the Hub ticked it', (await f.page.locator('[data-tick="hub"]').count()) === 0 && (await f.page.locator('[data-auto="hub"]').count()) === 1 && /Done/.test(await f.page.locator('[data-auto="hub"]').innerText()), await f.page.locator('[data-step="hub"]').innerText());
    ok('w278: every other step has its Done button', (await f.page.locator('[data-tick]').count()) === 11);
    const chromeHrefs = await f.page.locator('[data-step="chrome"] a.slink').evaluateAll(a => a.map(x => x.getAttribute('href')));
    ok('w278: the Chrome step shows four download links', chromeHrefs.length === 4 && CHROME.every(([, u], i) => chromeHrefs[i] === u) && /Chrome for Mac/.test(t) && /Chrome for iPhone/.test(t), chromeHrefs);
    ok('w278: the Chrome login video when set', (await f.page.locator('[data-step="chrome"] a[href="https://www.loom.com/share/chrome-login"]').count()) === 1);
    ok('w278: the google step names the new address, never a password', /amina\.diallo@welfareavenue\.com/.test(await f.page.locator('[data-step="google"]').innerText()) && !/password:/i.test(t));
    ok('w278: the bookmarks', (await f.page.locator('[data-step="bookmarks"] a.slink').count()) === 3);
    const glines = await f.page.locator('[data-step="groups"] .glist li').allInnerTexts();
    ok('w278: the groups step, one line per group with its purpose', glines.length === 2 && /org@welfareavenue\.com/.test(glines[0]) && /everyone at Welfare Avenue/.test(glines[0]) && /operations@welfareavenue\.com/.test(glines[1]) && /your team.s list/.test(glines[1]), glines);
    const dlines = await f.page.locator('[data-step="drive"] .glist li').allInnerTexts();
    ok('w278: the drive step lists the shared drives by name', dlines.length === 2 && dlines[0] === 'Org\'s Files' && dlines[1] === 'Operations', dlines);
    const wk = await f.page.locator('[data-step="weekly"]').innerText();
    ok('w278: the weekly meeting by name and its next time, in Toronto time', /Operations weekly/.test(wk) && /Tuesday, November 3/.test(wk) && /1(:00)?\sp\.m\./.test(wk), wk);
    ok('w278: Slack: the workspace link and the onboarding channel', (await f.page.locator('[data-step="slack"] a[href="https://join.slack.com/t/welfareavenue/shared_invite/zt-join"]').count()) === 1 && (await f.page.locator('[data-step="slack"] a[href="https://join.slack.com/share/enQtChannel"]').count()) === 1);
    ok('w278: Canva and the job description links', (await f.page.locator('[data-step="canva"] a[href="https://www.canva.com/brand/join?token=abc"]').count()) === 1 && (await f.page.locator('[data-step="jd"] a[href="https://docs.google.com/document/d/jd7"]').count()) === 1);
    ok('w278: the Academy and Home links', (await f.page.locator('[data-step="academy"] a[href="https://hub.welfareavenue.com/#training"]').count()) === 1 && (await f.page.locator('[data-step="academy"] a[href="https://hub.welfareavenue.com/"]').count()) === 1);
    await f.page.waitForFunction(() => { const i = document.getElementById('qrimg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }).catch(() => {});
    const qr = await f.page.evaluate(() => { const i = document.getElementById('qrimg'); return i ? { src: i.getAttribute('src').slice(0, 40), w: i.naturalWidth, alt: i.getAttribute('alt') } : null; });
    ok('w278: the phone step draws a QR image', !!qr && /^data:image\/svg\+xml/.test(qr.src) && qr.w > 0 && !!qr.alt, qr);
    ok('w278: the QR maker came from cdnjs, once', f.fx.qrLoads === 1, f.fx.qrLoads);
    ok('w278: the install URL is printed under the QR', (await f.page.locator('[data-step="phone"]').innerText()).indexOf(INSTALL_URL) >= 0);
    /* wave278 t5b: a second QR opens the Hub itself */
    await f.page.waitForFunction(() => { const i = document.getElementById('qrimg2'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }).catch(() => {});
    const qrs = await f.page.evaluate(() => Array.from(document.querySelectorAll('[data-step="phone"] .qr img')).map(i => ({ id: i.id, w: i.naturalWidth, alt: i.getAttribute('alt'), src: i.getAttribute('src').slice(0, 26) })));
    ok('w278 t5b: two QR images in the phone step', qrs.length === 2 && qrs.every(q => q.w > 0 && /^data:image\/svg\+xml/.test(q.src)) && qrs[0].alt.indexOf(INSTALL_URL) >= 0 && qrs[1].alt.indexOf(HUB_URL) >= 0, qrs);
    const qpos = await f.page.evaluate(() => Array.from(document.querySelectorAll('[data-step="phone"] .qr img')).map(i => { const r = i.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
    ok('w278 t5b: on a wide screen the two codes sit on one row', qpos.length === 2 && qpos[0][1] === qpos[1][1] && qpos[1][0] > qpos[0][0], qpos);
    ok('w278 t5b: the two labels (English) sit above the codes', await f.page.evaluate(() => { const l = Array.from(document.querySelectorAll('[data-step="phone"] .qrlabel')); const im = Array.from(document.querySelectorAll('[data-step="phone"] .qr img')); return l.length === 2 && im.length === 2 && l[0].textContent === 'Steps to install' && l[1].textContent === 'Open the Hub' && l.every((e, i) => e.getBoundingClientRect().bottom <= im[i].getBoundingClientRect().top); }));
    const phoneHrefs = await f.page.locator('[data-step="phone"] .qrurl a').evaluateAll(as => as.map(a => [a.getAttribute('href'), a.textContent]));
    ok('w278 t5b: both addresses are printed under their codes as links', phoneHrefs.length === 2 && phoneHrefs[0][0] === INSTALL_URL && phoneHrefs[0][1] === INSTALL_URL && phoneHrefs[1][0] === HUB_URL && phoneHrefs[1][1] === HUB_URL, phoneHrefs);
    const enp = await f.page.locator('[data-step="phone"]').innerText();
    ok('w278 t5b: the step sentence names both codes, plain words', enp.indexOf('Scan the first code with your phone\u2019s camera for the steps to add the Hub to your home screen and get the Slack app; scan the second to open the Hub itself.') >= 0 && clean(enp), enp);
    ok('w278: no walkthrough video while none is set', (await f.page.locator('#video').count()) === 0);
    ok('w278: opening posts nothing', f.posts().length === 0);
    ok('w278: no page errors', f.errors.length === 0, f.errors);
    await shot(f.page, 'w278-setup-desktop');
    await f.ctx.close();

    /* nothing from Task 3 yet: the plain sentences instead of the lists; the walkthrough video when Steel has recorded it */
    f = await open(browser, { qs: '?setup', fn: makeHire({ answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE }, extra: { drives: [], groups: [], weekly: null, canva: null, jd: null, googleVideo: null, address: null, channelLink: null, video: 'https://www.loom.com/share/walkthrough' } }) });
    t = await text(f.page);
    ok('w278 empty: HR will share your Drives', /HR will share your Drives with you/.test(await f.page.locator('[data-step="drive"]').innerText()));
    ok('w278 empty: HR will add your groups', /HR will add you to your groups/.test(await f.page.locator('[data-step="groups"]').innerText()));
    ok('w278 empty: no meeting yet', /HR will add you to your team.s weekly meeting/.test(await f.page.locator('[data-step="weekly"]').innerText()));
    ok('w278 empty: HR will send the Canva link', /HR will send you the Canva link/.test(await f.page.locator('[data-step="canva"]').innerText()));
    ok('w278 empty: HR will share the job description', /HR will share your job description/.test(await f.page.locator('[data-step="jd"]').innerText()));
    ok('w278 empty: the hub step not ticked yet says it ticks itself', /ticks itself/i.test(await f.page.locator('[data-auto="hub"]').innerText()));
    ok('w278 video: the walkthrough at the top', (await f.page.locator('#video a[href="https://www.loom.com/share/walkthrough"]').count()) === 1 && t.indexOf('walkthrough') < t.indexOf(STEPS[0].title.en), t.slice(0, 300));
    ok('w278 empty: no page errors', f.errors.length === 0, f.errors);
    await f.ctx.close();

    /* French, at 390 px */
    f = await open(browser, { phone: true, qs: '?setup&l=fr', wait: 900, fn: makeHire({ answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE } }) });
    t = await text(f.page);
    ok('w278 French: the twelve steps and the count', STEPS.every(s => t.indexOf(s.title.fr) >= 0) && /0 sur 12 terminées/.test(t), t.slice(0, 600));
    ok('w278 French: the groups and their purposes', /toute l.équipe de Welfare Avenue/.test(t) && /la liste de votre équipe/.test(t));
    ok('w278 French: Chrome pour Mac, the meeting in French', /Chrome pour Mac/.test(t) && /mardi 3 novembre/.test(await f.page.locator('[data-step="weekly"]').innerText()), await f.page.locator('[data-step="weekly"]').innerText());
    await f.page.waitForFunction(() => document.querySelectorAll('[data-step="phone"] .qr img').length === 2, null, { timeout: 5000 }).catch(() => {});
    const frp = await f.page.locator('[data-step="phone"]').innerText();
    ok('w278 t5b French: the two labels, the two addresses and the sentence', /Les étapes pour installer/.test(frp) && /Ouvrir le Hub/.test(frp) && frp.indexOf(INSTALL_URL) >= 0 && frp.indexOf(HUB_URL) >= 0 && /Scannez le premier code avec l.appareil photo de votre téléphone pour voir les étapes qui ajoutent le Hub à votre écran d.accueil et installent l.application Slack; scannez le second pour ouvrir le Hub lui-même\./.test(frp) && clean(frp), frp);
    ok('w278 French: the hub step ticks itself', /se coche/.test(await f.page.locator('[data-auto="hub"]').innerText()));
    ok('w278 French at 390 px: no sideways scroll, Hub words, no errors', await noScroll(f.page) && clean(await allWords(f.page)) && f.errors.length === 0, f.errors);
    await shot(f.page, 'w278-setup-phone-fr');
    await f.ctx.close();
    f = await open(browser, { phone: true, qs: '?setup', wait: 900, fn: makeHire({ answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE } }) });
    await f.page.waitForFunction(() => document.querySelectorAll('[data-step="phone"] .qr img').length === 2, null, { timeout: 5000 }).catch(() => {});
    ok('w278 at 390 px: the twelve steps, both QR codes, no sideways scroll', (await f.page.locator('.rstep').count()) === 12 && (await f.page.locator('#qrimg').count()) === 1 && (await f.page.locator('#qrimg2').count()) === 1 && await noScroll(f.page) && f.errors.length === 0, f.errors);
    const qp = await f.page.evaluate(() => Array.from(document.querySelectorAll('[data-step="phone"] .qr img')).map(i => { const r = i.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right)]; }));
    ok('w278 t5b at 390 px: the codes are stacked, inside the screen', qp.length === 2 && qp[1][1] > qp[0][1] && qp.every(q => q[0] >= 0 && q[2] <= 390), qp);
    await shot(f.page, 'w278-setup-phone');
    await f.ctx.close();

    /* the phone page (?install): sign in first, Safari, Chrome, Slack, Open the Hub; one GET with install, nothing posted */
    for (const l of ['', 'fr']) {
      f = await open(browser, { phone: true, qs: '?install' + (l ? '&l=fr' : ''), fn: makeHire({ answered: 'accept' }) });
      t = await text(f.page);
      const fr = !!l;
      const first = fr ? /Connectez-vous d.abord au Hub dans Safari ou Chrome sur votre téléphone, puis ajoutez-le à l.écran d.accueil; si l.application installée vous demande de vous connecter de nouveau, faites-le une fois\./ : /Sign in to the Hub in Safari or Chrome on your phone first, then add it to the home screen; if the installed app asks you to sign in again, do so once\./;
      const m1 = t.match(first), end1 = m1 ? m1.index + m1[0].length : 0;
      const iSafari = t.indexOf('Safari', end1), iChrome = t.indexOf('Chrome', iSafari), iSlack = t.indexOf('Slack', iChrome);
      ok('w278 install' + (fr ? ' (French)' : '') + ': the sign-in sentence first', first.test(t) && t.search(first) < iSafari, t.slice(0, 500));
      ok('w278 install' + (fr ? ' (French)' : '') + ': the Safari steps, then the Chrome steps, then Slack', iSafari > 0 && iChrome > iSafari && iSlack > iChrome && (fr ? /Partager/.test(t) && /Sur l.écran d.accueil/.test(t) && /Installer l.application/.test(t) : /Share/.test(t) && /Add to Home Screen/.test(t) && /Add to Home screen/.test(t) && /Install app/.test(t)), t);
      ok('w278 install' + (fr ? ' (French)' : '') + ': the Slack app link and Open the Hub, in that order', (await f.page.locator('a[href="https://slack.com/download"]').count()) === 1 && (await f.page.locator('a.btn[href="https://hub.welfareavenue.com/"]').count()) === 1 && await f.page.evaluate(() => { const a = document.querySelector('a[href="https://slack.com/download"]'), b = document.querySelector('a.btn[href="https://hub.welfareavenue.com/"]'); return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); }));
      ok('w278 install' + (fr ? ' (French)' : '') + ': one GET with install, no POST, no QR maker', f.gets().length === 1 && /[?&]install/.test(f.gets()[0].url) && f.posts().length === 0 && !f.fx.qrLoads, f.fx.calls.map(c => c.url));
      ok('w278 install' + (fr ? ' (French)' : '') + ' at 390 px: no sideways scroll, Hub words, no errors', await noScroll(f.page) && clean(await allWords(f.page)) && f.errors.length === 0, f.errors);
      await shot(f.page, 'w278-install-phone' + (fr ? '-fr' : ''));
      await f.ctx.close();
    }
    /* a link the function refuses says so; a function that cannot be reached still gives the fixed steps and links */
    f = await open(browser, { phone: true, qs: '?install', fn: makeHire({ answered: 'accept', installStatus: 404, installBody: { ok: false, error: 'bad_link', message: { en: 'This link does not work.', fr: 'Ce lien ne fonctionne pas.' } } }) });
    ok('w278 install: a bad link says so', /This link does not work/.test(await text(f.page)) && (await f.page.locator('a[href="https://slack.com/download"]').count()) === 0);
    await f.ctx.close();
    f = await open(browser, { phone: true, qs: '?install', fn: makeHire({ answered: 'accept', installStatus: 503, installBody: { ok: false, error: 'unavailable' } }) });
    ok('w278 install: the server down still shows the steps and the two links', /Add to Home Screen/.test(await text(f.page)) && (await f.page.locator('a[href="https://slack.com/download"]').count()) === 1 && (await f.page.locator('a.btn[href="https://hub.welfareavenue.com/"]').count()) === 1);
    await f.ctx.close();

    /* 11. the phone at 390 px, and the Hub words on every view, in both languages */
    const views = [
      ['ask', {}, ''], ['times', { answered: 'accept' }, ''], ['closing', { answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE } }, ''],
      ['touch', { answered: 'accept', answer: 'no', askAvailability: false }, ''], ['waiting', { answered: 'accept', proposal: null }, ''], ['rundown', { answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE } }, '?setup'], ['install', { answered: 'accept' }, '?install'],
    ];
    for (const [name, over, qs] of views) {
      for (const l of ['', 'fr']) {
        const q = l ? (qs ? qs + '&l=fr' : '?l=fr') : qs;
        f = await open(browser, { phone: true, qs: q, fn: makeHire(over) });
        ok('phone ' + name + (l ? ' (French)' : '') + ': no sideways scroll, Hub words', await noScroll(f.page) && clean(await allWords(f.page)) && f.errors.length === 0, f.errors);
        if (!l) await shot(f.page, 'w275-phone-' + name);
        await f.ctx.close();
      }
    }
  } catch (e) { fail++; console.log('FAIL exception ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
