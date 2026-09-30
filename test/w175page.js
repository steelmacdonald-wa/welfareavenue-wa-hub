/* w175page.js: the volunteer account page (build/me/index.html, wave175), offline: signing in with Google (the PKCE code
   flow: the authorize redirect, the code exchanged with its verifier, the session kept), the account (servings, hours,
   the milestone, roles, upcoming servings with their links, open spots and signing up, the history and its surveys, the
   letter of hours), a personal link saved to the account, an email with no volunteer record, the hook switched off,
   signing out, French, names as text, the phone width. Screenshots with SHOTS=<dir>. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'build', 'me', 'index.html'), 'utf8');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }
const SB = 'https://zwnmulmnvopclzcvytce.supabase.co';
function me(over) {
  return Object.assign({ signed_in: true, hook: true, linked: true, email: 'jag@gmail.com', first: 'Jagjit', name: 'Jagjit <b>Singh</b>', lang: 'en', servings: 23, hours: 46, first_date: '2023-12-23', last_date: '2026-07-26',
    roles: [{ role: 'cook', role_en: 'Cook', role_fr: 'Cuisine', n: 21 }, { role: 'server', role_en: 'Server', role_fr: 'Service', n: 2 }],
    history: Array.from({ length: 8 }, (_, i) => ({ date: '2026-0' + (7 - Math.floor(i / 2)) + '-' + (10 + i), role: 'cook', role_en: 'Cook', role_fr: 'Cuisine', location: 'Montreal', token: i === 0 ? 'histtok0000000001' : null, survey: i === 0 ? 'open' : i === 1 ? 'answered' : null })),
    upcoming: [{ date: '2026-10-04', role: 'cook', role_en: 'Cook', role_fr: 'Cuisine', location: 'Montreal', token: 'uptok00000000001', state: 'waiting', times: { start: '10:45' } }],
    open: [{ event_id: 24, date: '2026-10-18', location: 'Montreal', start: '12:00', roles: [{ role: 'server', role_en: 'Server', role_fr: 'Service', left: 8 }, { role: 'photographer', role_en: 'Photographer', role_fr: 'Photographe', left: 1 }] }] }, over || {});
}
async function open(browser, url, handlers, opts, preset) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1100, height: 900 } }, opts || {}));
  const page = await ctx.newPage();
  const calls = [], errors = [], navs = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://hub.welfareavenue.com/me**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route(SB + '/storage/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route(SB + '/auth/v1/authorize**', r => { navs.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<p>google</p>' }); });
  await page.route(SB + '/auth/v1/token**', async r => {
    const req = r.request(); const body = JSON.parse(req.postData() || '{}'); calls.push({ url: req.url(), body });
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ access_token: 'AT-' + (body.auth_code || 'refresh'), refresh_token: 'RT1', expires_in: 3600, user: { email: 'jag@gmail.com' } }) });
  });
  await page.route(SB + '/auth/v1/logout**', async r => { calls.push({ url: r.request().url(), auth: r.request().headers().authorization }); await r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' }); });
  await page.route(SB + '/rest/v1/rpc/**', async r => {
    const req = r.request(); const fn = req.url().split('/').pop();
    const call = { fn, auth: req.headers().authorization, body: req.postData() ? JSON.parse(req.postData()) : null }; calls.push(call);
    const res = (handlers[fn] || (() => ({})))(call, calls);
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res) });
  });
  if (preset) { await page.goto('https://hub.welfareavenue.com/me/?boot=1'); await page.evaluate(p => { for (const k in p) localStorage.setItem(k, JSON.stringify(p[k])); }, preset); }
  await page.goto(url); await page.waitForTimeout(500);
  return { ctx, page, calls, errors, navs };
}
const text = p => p.evaluate(() => document.getElementById('app').innerText);
const SESS = { wa_vol_auth: { access_token: 'AT-saved', refresh_token: 'RT0', expires_at: Math.floor(Date.now() / 1000) + 3000, email: 'jag@gmail.com' } };

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. signed out, then the Google sign-in */
    let f = await open(browser, 'https://hub.welfareavenue.com/me/', { volunteer_me: () => ({ signed_in: false }) });
    let t = await text(f.page);
    ok('signed out: the invitation and the button', /Your volunteering, in one place/i.test(t) && /Sign in with Google/.test(t) && /never your password/.test(t), t);
    ok('signed out: no rpc with a user token', f.calls.every(c => !c.auth || /Bearer eyJ/.test(c.auth)));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/30-signin.png', fullPage: true });
    await f.page.click('#signin'); await f.page.waitForTimeout(600);
    const au = f.navs[0] ? new URL(f.navs[0]) : null;
    ok('sign-in: goes to Google through Supabase with PKCE and back to /me', au && au.searchParams.get('provider') === 'google' && au.searchParams.get('redirect_to') === 'https://hub.welfareavenue.com/me/' && au.searchParams.get('code_challenge_method') === 's256' && (au.searchParams.get('code_challenge') || '').length >= 43, f.navs[0]);
    const pk = await f.page.evaluate(() => JSON.parse(localStorage.getItem('wa_vol_pkce') || 'null')).catch(() => null);
    await f.ctx.close();

    /* 2. back from Google with a code: exchanged with the verifier, then the account */
    f = await open(browser, 'https://hub.welfareavenue.com/me/?code=abc123', { volunteer_me: () => me() }, null, { wa_vol_pkce: { v: 'verifier-xyz', link: null } });
    const ex = f.calls.filter(c => /grant_type=pkce/.test(c.url))[0];
    ok('code: exchanged with its verifier', ex && ex.body.auth_code === 'abc123' && ex.body.code_verifier === 'verifier-xyz', ex);
    const m1 = f.calls.filter(c => c.fn === 'volunteer_me')[0];
    ok('account: read with the user token', m1 && m1.auth === 'Bearer AT-abc123', m1);
    ok('code: removed from the address', await f.page.evaluate(() => location.pathname === '/me/' && location.search === ''));
    t = await text(f.page);
    ok('account: servings, hours, since', /23\s*servings/.test(t) && /46\s*hours/.test(t) && /since December 2023/.test(t), t.slice(0, 400));
    ok('account: the next milestone', /2 more to your 25th serving/.test(t));
    ok('account: roles', /Cook · 21/.test(t) && /Server · 2/.test(t));
    ok('account: upcoming with the link and the time', /Sunday, October 4/.test(t) && /Cook · 10:45 am · Montreal/.test(t) && /To confirm/.test(t) && await f.page.evaluate(() => !!document.querySelector('a[href="/c/uptok00000000001"]')));
    ok('account: open spots', /Open spots/i.test(t) && /Server\s*8 spots/.test(t) && /Photographer\s*1 spot/.test(t));
    ok('account: history, six then all', (await f.page.$$('#app .sec:nth-of-type(4) .list li')).length >= 0 && /Show all \(8\)/.test(t) && /Take the survey/.test(t) && /Survey answered/.test(t) && await f.page.evaluate(() => !!document.querySelector('a[href="/c/histtok0000000001#survey"]')));
    ok('account: the name is text', await f.page.evaluate(() => !document.querySelector('#ht b')));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/31-account.png', fullPage: true });
    await f.page.click('#all'); await f.page.waitForTimeout(150);
    ok('history: show all', !/Show all/.test(await text(f.page)));
    await f.ctx.close();

    /* 3. signing up for an open spot */
    let joined = false;
    f = await open(browser, 'https://hub.welfareavenue.com/me/', { volunteer_me: () => joined ? me({ open: [], upcoming: me().upcoming.concat([{ date: '2026-10-18', role: 'server', role_en: 'Server', location: 'Montreal', token: 'newtok0000000001', state: 'waiting' }]) }) : me(), volunteer_me_signup: () => { joined = true; return { ok: true, token: 'newtok0000000001' }; } }, null, SESS);
    await f.page.click('[data-join="24"][data-role="server"]'); await f.page.waitForTimeout(150);
    t = await text(f.page);
    ok('sign up: asks first', /Sign up as server on Sunday, October 18\?/.test(t) && !f.calls.some(c => c.fn === 'volunteer_me_signup'));
    await f.page.click('#joinyes'); await f.page.waitForTimeout(400);
    const su = f.calls.filter(c => c.fn === 'volunteer_me_signup')[0];
    ok('sign up: the event and the role, with the saved session', su && su.body.p_event === 24 && su.body.p_role === 'server' && su.auth === 'Bearer AT-saved', su);
    t = await text(f.page);
    ok('sign up: confirmed and listed', /You’re signed up as server on Sunday, October 18! We will text you to confirm 7 days before/.test(t) && /No open spots right now/.test(t) && await f.page.evaluate(() => !!document.querySelector('a[href="/c/newtok0000000001"]')));
    await f.ctx.close();
    f = await open(browser, 'https://hub.welfareavenue.com/me/', { volunteer_me: () => me(), volunteer_me_signup: () => ({ ok: false, reason: 'full' }) }, null, SESS);
    await f.page.click('[data-join="24"][data-role="photographer"]'); await f.page.click('#joinyes'); await f.page.waitForTimeout(400);
    ok('sign up: a spot just taken', /That spot was just taken/.test(await text(f.page)));
    await f.ctx.close();

    /* 4. the letter of hours */
    f = await open(browser, 'https://hub.welfareavenue.com/me/', { volunteer_me: () => me(), volunteer_me_letter: () => ({ ok: true, ref: 'WA-VH-89C29E', name: 'Jagjit Singh', servings: 23, hours: 46, first_date: '2023-12-23', last_date: '2026-07-26', issued: '2026-09-30', roles: me().roles }) }, null, SESS);
    await f.page.click('#letter'); await f.page.waitForTimeout(400);
    t = await text(f.page);
    ok('letter: the facts', /To whom it may concern/.test(t) && /This letter confirms that Jagjit Singh has volunteered with Welfare Avenue/.test(t) && /Between December 23, 2023 and July 26, 2026, Jagjit volunteered at 23 of our servings, for a total of about 46 hours, as cook and server\./.test(t), t);
    ok('letter: the reference and the charity number', /Reference WA-VH-89C29E/.test(t) && /713048502RR0001/.test(t) && await f.page.evaluate(() => !!document.querySelector('#letterdoc svg.lockup')));
    ok('letter: print and back', !!(await f.page.$('#print')) && !!(await f.page.$('#back')));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/32-letter.png', fullPage: true });
    await f.page.click('#back'); await f.page.waitForTimeout(150);
    ok('letter: back to the account', /Open spots/i.test(await text(f.page)));
    await f.ctx.close();

    /* 5. a personal link saved to the account; another volunteer's link refused */
    f = await open(browser, 'https://hub.welfareavenue.com/me/?link=abcdef1234567890ab', { volunteer_me: () => me(), volunteer_me_link: () => ({ ok: true }) }, null, SESS);
    const lk = f.calls.filter(c => c.fn === 'volunteer_me_link')[0];
    ok('link: sent before reading the account', lk && lk.body.p_token === 'abcdef1234567890ab' && f.calls.findIndex(c => c.fn === 'volunteer_me_link') < f.calls.findIndex(c => c.fn === 'volunteer_me'));
    ok('link: saved', /Saved to your account/.test(await text(f.page)) && await f.page.evaluate(() => location.pathname === '/me/' && location.search === ''));
    await f.ctx.close();
    f = await open(browser, 'https://hub.welfareavenue.com/me/?link=abcdef1234567890ab', { volunteer_me: () => me(), volunteer_me_link: () => ({ ok: false, reason: 'other' }) }, null, SESS);
    ok('link: another volunteer’s link', /belongs to another volunteer/.test(await text(f.page)));
    await f.ctx.close();
    f = await open(browser, 'https://hub.welfareavenue.com/me/?link=abcdef1234567890ab', { volunteer_me: () => ({ signed_in: false }) });
    ok('link, signed out: the invitation to save', /Sign in to save your volunteering/.test(await text(f.page)));
    await f.page.click('#signin'); await f.page.waitForTimeout(500);
    ok('link, signed out: kept through the sign-in', f.navs[0] && new URL(f.navs[0]).searchParams.get('redirect_to') === 'https://hub.welfareavenue.com/me/?link=abcdef1234567890ab');
    await f.ctx.close();

    /* 6. no volunteer record; the hook switched off */
    f = await open(browser, 'https://hub.welfareavenue.com/me/', { volunteer_me: () => ({ signed_in: true, hook: true, linked: false, email: 'new@gmail.com' }) }, null, SESS);
    t = await text(f.page);
    ok('not linked: says so with the email', /We couldn’t find your volunteer record/i.test(t) && /No volunteer record uses new@gmail\.com/.test(t) && /Use another Google account/.test(t));
    await f.ctx.close();
    f = await open(browser, 'https://hub.welfareavenue.com/me/', { volunteer_me: () => ({ signed_in: true, hook: false }) }, null, SESS);
    t = await text(f.page);
    ok('hook off: refuses and forgets the session', /Volunteer accounts aren’t open yet/i.test(t) && await f.page.evaluate(() => localStorage.getItem('wa_vol_auth') === null));
    await f.ctx.close();

    /* 7. signing out; French; an expired session is refreshed */
    f = await open(browser, 'https://hub.welfareavenue.com/me/', { volunteer_me: (c) => c.auth === 'Bearer AT-saved' || c.auth === 'Bearer AT-refresh' ? me() : { signed_in: false } }, null, SESS);
    await f.page.click('#out'); await f.page.waitForTimeout(400);
    ok('sign out: logout with the token, then signed out', f.calls.some(c => /logout/.test(c.url) && c.auth === 'Bearer AT-saved') && /Sign in with Google/.test(await text(f.page)) && await f.page.evaluate(() => localStorage.getItem('wa_vol_auth') === null));
    await f.ctx.close();
    f = await open(browser, 'https://hub.welfareavenue.com/me/', { volunteer_me: () => me({ lang: 'fr' }) }, null, { wa_vol_auth: { access_token: 'AT-old', refresh_token: 'RT0', expires_at: Math.floor(Date.now() / 1000) - 10 } });
    ok('expired: refreshed first', f.calls.some(c => /grant_type=refresh_token/.test(c.url) && c.body.refresh_token === 'RT0') && f.calls.filter(c => c.fn === 'volunteer_me')[0].auth === 'Bearer AT-refresh');
    t = await text(f.page);
    ok('French: follows the volunteer', /23\s*services/.test(t) && /46\s*heures/.test(t) && /Places libres/i.test(t) && /Encore 2 avant votre 25e service/.test(t), t.slice(0, 500));
    ok('no page errors', f.errors.length === 0, f.errors);
    await f.ctx.close();

    /* 8. the phone */
    f = await open(browser, 'https://hub.welfareavenue.com/me/', { volunteer_me: () => me() }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, SESS);
    ok('phone: no sideways scroll', await f.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/33-phone.png', fullPage: true });
    await f.ctx.close();
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
