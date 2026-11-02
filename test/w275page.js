/* w275page.js: the hire's side of the /o/<token> page (build/o/index.html), wave275 Task 3, offline.
   The onboard-link function is stubbed with page.route (a small state machine: no call reaches any real function); the page and the brand fonts
   are served from disk. Run: cd test && node w275page.js        Screenshots: test/shots_w275page/ (git-ignored), or SHOTS=<dir>.
   Covered: opening makes one GET and no POST; Accept with the hours line ("I confirm I can give at least N hours a week to Welfare Avenue"), which
   must be ticked first and is sent as hours_ok; an offer from before wave275 (no hours) keeps its Accept and its grid; the two proposed times with
   the manager in Toronto time, Yes or No each one POST under a double click; Yes then the closing page ("Your invites are on their way; <manager>
   will see you on <date>") with the rundown link; Yes on times that moved (stale): the sentence and the grid; No with availability asked: the grid
   with the 10-hour minimum, and Save shows the closing page ("<manager> will pick from your times"); No with availability already communicated:
   the closing page at once ("<manager> will be in touch with other times") and no grid; a second No: a person will be in touch; no proposal yet:
   "We are choosing your times now"; the rundown (?setup): every step, Done ticks that post setup_tick; French; 390 px; no "AI" and no em dash. */
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
const STEPS = ['profile', 'bookmarks', 'hub', 'slack', 'academy', 'loom', 'canva', 'drives', 'weekly'].map((key, i) => ({ key, title: { en: 'Step ' + (i + 1) + ' in English', fr: 'Étape ' + (i + 1) + ' en français' }, body: { en: 'What to do for ' + key + '.', fr: 'Quoi faire pour ' + key + '.' } }));
const STALE = { en: 'Sorry, those times no longer work for your manager. Please mark when you are free below, and they will pick from your times.', fr: 'Désolés, ces heures ne conviennent plus à votre gestionnaire. Indiquez ci-dessous quand vous êtes disponible, et votre gestionnaire choisira parmi vos plages.' };
const ANSWERED = { en: 'Thank you. A person from Welfare Avenue will be in touch with you about the times.', fr: 'Merci. Une personne de Welfare Avenue communiquera avec vous au sujet des heures.' };
const HOURS_REQ = { en: 'Please tick the box to confirm you can give at least 6 hours a week to Welfare Avenue, then press Accept.', fr: 'Veuillez cocher la case pour confirmer que vous pouvez consacrer au moins 6 heures par semaine à Welfare Avenue, puis appuyer sur Accepter.' };

/* the stub function: what onboard-link answers, and how each POST changes it */
function makeHire(over) {
  const S = Object.assign({ first: 'Amina', role: 'Event Coordinator', lang: 'en', answered: '', offerHours: 6, mode: 'propose', proposal: { call_at: CALL, one_on_one_at: ONE }, bookedTimes: null, answer: null, askAvailability: true, manager: 'Marc Dubois', ticks: {}, slotsSaved: [], minHours: 10, delay: 250, yesReply: null, noReply: null }, over || {});
  const calls = [];
  const handler = async route => {
    const req = route.request();
    const cors = { 'Access-Control-Allow-Origin': 'https://hub.welfareavenue.com', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    const send = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
    const call = { method: req.method(), url: req.url(), body: req.postData() ? JSON.parse(req.postData()) : null };
    calls.push(call);
    if (req.method() === 'GET') {
      const accepted = S.answered === 'accept';
      return send(200, {
        ok: true, kind: 'offer', first: S.first, role: S.role, lang: S.lang, answered: S.answered, closed: false, late: false, booked: !!S.bookedTimes, callBooked: !!S.bookedTimes,
        grid: gridWindow(S.minHours), slotsSaved: S.slotsSaved, offerHours: S.offerHours, hoursConfirmed: accepted && !!S.offerHours, mode: S.mode,
        proposal: S.proposal, bookedTimes: S.bookedTimes, answer: S.answer, askAvailability: S.askAvailability, manager: S.manager, lengths: { callMin: 60, oneMin: 30 },
        setup: accepted ? { steps: STEPS, ticks: Object.fromEntries(STEPS.map(s => [s.key, !!S.ticks[s.key]])) } : null,
      });
    }
    const b = call.body || {};
    if (b.a === 'accept') {
      await new Promise(r => setTimeout(r, S.delay));
      if (S.offerHours && b.hours_ok !== true) return send(400, { ok: false, error: 'hours_required', message: HOURS_REQ });
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
      if (S.noReply) return send(S.noReply.status, S.noReply.body);
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
    await f.ctx.close();

    /* 8. no proposal yet */
    f = await open(browser, { fn: makeHire({ answered: 'accept', proposal: null }) });
    t = await text(f.page);
    ok('waiting: we are choosing your times, and no buttons, grid or rundown link', /We are choosing your times now; you will get an email within two days\./.test(t) && (await f.page.locator('[data-act="yes"], [data-slot], #setuplink').count()) === 0, t.slice(0, 400));
    await f.ctx.close();

    /* 9. the rundown */
    f = await open(browser, { qs: '?setup', fn: makeHire({ answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE }, ticks: { profile: true } }) });
    t = await text(f.page);
    ok('rundown: every step in order', STEPS.every((s, i) => t.indexOf(s.title.en) >= 0 && (i === 0 || t.indexOf(STEPS[i - 1].title.en) < t.indexOf(s.title.en))), t.slice(0, 800));
    ok('rundown: the saved tick shows, and the count', (await f.page.locator('[data-tick="profile"]').getAttribute('aria-pressed')) === 'true' && /1 of 9 done/.test(t), t.slice(0, 400));
    ok('rundown: opening posts nothing', f.posts().length === 0);
    await f.page.locator('[data-tick="hub"]').click();
    await f.page.waitForFunction(() => document.querySelector('[data-tick="hub"]').getAttribute('aria-pressed') === 'true', null, { timeout: 4000 });
    let ticks = f.posts().filter(c => c.body.a === 'setup_tick');
    ok('rundown: Done posts setup_tick {key, done: true}', ticks.length === 1 && ticks[0].body.key === 'hub' && ticks[0].body.done === true, ticks.map(c => c.body));
    ok('rundown: the count follows', /2 of 9 done/.test(await text(f.page)));
    await f.page.locator('[data-tick="profile"]').click();
    await f.page.waitForFunction(() => document.querySelector('[data-tick="profile"]').getAttribute('aria-pressed') === 'false', null, { timeout: 4000 });
    ticks = f.posts().filter(c => c.body.a === 'setup_tick');
    ok('rundown: a second press undoes it (done: false)', ticks.length === 2 && ticks[1].body.key === 'profile' && ticks[1].body.done === false, ticks.map(c => c.body));
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
    ok('French: the rundown', /Étape 1 en français/.test(t) && /0 sur 9 terminées/.test(t), t.slice(0, 400));
    await f.ctx.close();
    f = await open(browser, { qs: '?l=fr', fn: makeHire({ answered: 'accept', proposal: null }) });
    ok('French: waiting', /Nous choisissons vos heures en ce moment; vous recevrez un courriel d.ici deux jours\./.test(await text(f.page)));
    await f.ctx.close();

    /* 11. the phone at 390 px, and the Hub words on every view, in both languages */
    const views = [
      ['ask', {}, ''], ['times', { answered: 'accept' }, ''], ['closing', { answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE } }, ''],
      ['touch', { answered: 'accept', answer: 'no', askAvailability: false }, ''], ['waiting', { answered: 'accept', proposal: null }, ''], ['rundown', { answered: 'accept', answer: 'yes', bookedTimes: { call_at: CALL, one_on_one_at: ONE } }, '?setup'],
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
