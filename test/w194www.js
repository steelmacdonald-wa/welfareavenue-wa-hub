// wave194 and wave195 (02/10/26): the account page on welfareavenue.com and the forms that fill in, offline. Serves
// build/www/out the way Netlify will (test/www_serve.js, the real CSP) with the Hub mocked: the accounts switch, Supabase
// Auth (a code, a link from the email, Google's ID token, refresh, sign-out), Google's sign-in script (a stand-in), the
// site-account function (codes, files, uploads), storage's signed upload, the account_* and volunteer_me* functions and
// form-submit. Nothing reaches the live database.
// Run: NODE_PATH=/home/claude/.npm-global/lib/node_modules node test/w194www.js
const { chromium } = require('playwright');
const crypto = require('crypto');
const { attach, ORIGIN } = require('./www_serve.js');
const SUPA = 'https://zwnmulmnvopclzcvytce.supabase.co';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('FAIL ' + m); } }
const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const NOW = () => Math.floor(Date.now() / 1000);
function session(o = {}) {
  const exp = NOW() + (o.ttl == null ? 3600 : o.ttl), email = o.email || 'alex@example.org';
  const claims = { sub: 'u-1', email, role: o.team ? 'authenticated' : 'anon', exp, n: o.n || 1, ...(o.team ? {} : { wa_volunteer: true }) };
  return { access_token: b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u(claims) + '.sig', token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-' + (o.n || 1), user: { id: 'u-1', email } };
}
const stored = s => ({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, email: s.user.email });
const ME = { signed_in: true, hook: true, linked: true, email: 'alex@example.org', google: false, since: '2026-10-02',
  contact: { first_name: 'Alex', last_name: 'Tremblay', full_name: 'Alex Tremblay', pronouns: 'they/them', emails: ['alex@example.org'], phone: '514-555-0100', address: '123 Rue Test',
    city: 'Montreal', province: 'QC', postal_code: 'H2X 1Y4', country: 'Canada', language: 'en' },
  newsletter: { status: 'unsubscribed', consent: 'none', on: false, blocked: false, since: null }, volunteer: true,
  gifts: [{ id: 11, date: '2026-09-20', amount: 50, currency: 'CAD', campaign: 'Fall appeal', recurring: false, kind: 'online', refunded: false, receipt: { id: 5, serial: 'WA-2026-0005', issued: '2026-09-21', pdf: true }, receipt_number: null },
    { id: 10, date: '2025-12-10', amount: 20, currency: 'CAD', campaign: null, recurring: true, kind: 'online', refunded: false, receipt: null, receipt_number: '2025-77' }],
  gift_totals: { count: 2, total: 70, since: '2025-12-10' }, receipts: [{ id: 5, serial: 'WA-2026-0005', year: 2026, kind: 'single', eligible: 50, issued: '2026-09-21', pdf: true }], receipt_mode: 'on' };
const VOL = { signed_in: true, hook: true, linked: true, email: 'alex@example.org', first: 'Alex', name: 'Alex Tremblay', lang: 'en', servings: 7, hours: 14, first_date: '2025-03-02', last_date: '2026-09-14',
  roles: [{ role: 'server', role_en: 'Server', role_fr: 'Service', n: 5 }, { role: 'cook', role_en: 'Cook', role_fr: 'Cuisine', n: 2 }],
  history: [{ date: '2026-09-14', role: 'server', role_en: 'Server', role_fr: 'Service', location: 'Montreal', token: 'tokH1', survey: 'open' },
    { date: '2026-08-31', role: 'cook', role_en: 'Cook', role_fr: 'Cuisine', location: 'Montreal', token: null, survey: 'answered' }],
  upcoming: [{ date: '2031-05-04', role: 'server', role_en: 'Server', role_fr: 'Service', location: 'Montreal', token: 'tokU1', times: { start: '11:30' }, state: 'confirmed' }],
  open: [{ event_id: 77, date: '2031-05-18', location: 'Montreal', start: '12:00', roles: [{ role: 'cook', role_en: 'Cook', role_fr: 'Cuisine', left: 2 }, { role: 'server', role_en: 'Server', role_fr: 'Service', left: 1 }] }] };
const SO = { ok: true, volunteer: true, servings: 7, hours: 14, first: '2025-03-02', last: '2026-09-14', max_open: 3, requests: [
  { id: 3, kind: 'hours', status: 'signed', for_org: 'Dawson College', purpose: 'Community service', requested: '2026-09-20', signed: '2026-09-22', reference: 'WA-VS-ABC123', signer: 'Steel MacDonald', hours: 14, servings: 7, letter: true },
  { id: 4, kind: 'recognition', status: 'requested', for_org: null, requested: '2026-10-01' },
  { id: 2, kind: 'form', status: 'declined', requested: '2026-09-01', declined: '2026-09-03', decline_reason: 'The form is for another charity.' }] };
const LETTER = { ok: true, name: 'Alex Tremblay', issued: '2026-10-02', first_date: '2025-03-02', last_date: '2026-09-14', servings: 7, hours: 14, roles: [{ role: 'server', role_en: 'Server', role_fr: 'Service' }], ref: 'WA-VH-XYZ789' };
const FORM = { slug: 'volunteer', title: 'Volunteer with us', intro: '', lang: 'en', thank_you: 'Thank you for signing up.', consent: { ask: false },
  questions: [{ id: 'first_name', type: 'text', label: 'First name', required: true, fill: 'first_name' }, { id: 'last_name', type: 'text', label: 'Last name', required: true, fill: 'last_name' },
    { id: 'email', type: 'email', label: 'Email', required: true, fill: 'email' }, { id: 'phone', type: 'phone', label: 'Phone', required: true, fill: 'phone' },
    { id: 'comments', type: 'long_text', label: 'Anything else?', required: false }] };
const NEWS = { slug: 'newsletter', title: 'Newsletter', intro: '', lang: 'en', thank_you: 'You are on the list.', consent: { ask: true, required: true, label: 'Yes, email me.' },
  questions: [{ id: 'first_name', type: 'text', label: 'First name', required: true, fill: 'first_name' }, { id: 'email', type: 'email', label: 'Email', required: true, fill: 'email' },
    { id: 'language', type: 'choice', label: 'Language', required: false, fill: 'language', options: [{ v: 'en', l: 'English' }, { v: 'fr', l: 'Français' }] }] };
const ORG = { name: 'Welfare Avenue', email: 'info@welfareavenue.com', address: 'Welfare Avenue, Montreal', charity: '713048502RR0001' };
const GSI_STUB = 'window.google={accounts:{id:{initialize:function(c){window.__gsi=c;},renderButton:function(el,o){window.__gsiOpts=o;var b=document.createElement("button");' +
  'b.type="button";b.id="gsi-stub";b.textContent="Continue with Google";b.addEventListener("click",function(){window.__gsi.callback({credential:"fake.id.token"});});el.appendChild(b);}}}};';

(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  async function context(o = {}) {
    const ctx = await browser.newContext({ viewport: { width: o.width || 1280, height: 900 }, locale: o.locale || 'en-CA', acceptDownloads: true });
    await attach(ctx);
    const calls = [], cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' };
    const J = (route, status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const pre = route => route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: cors }).then(() => true) : Promise.resolve(false);
    const st = { me: o.me || ME, vol: o.vol || VOL, so: o.so || SO };
    await ctx.route(SUPA + '/rest/v1/rpc/**', async route => {
      if (await pre(route)) return;
      const fn = new URL(route.request().url()).pathname.split('/').pop(), body = JSON.parse(route.request().postData() || '{}'), auth = route.request().headers()['authorization'] || '';
      calls.push({ fn, body, auth });
      const h = (o.rpc || {})[fn];
      if (h) { const r = typeof h === 'function' ? h(body, auth) : h; return J(route, r.__status || 200, r.__body !== undefined ? r.__body : r); }
      const D = {
        site_account_config: { mode: o.mode || 'on', google_client_id: o.gcid === undefined ? 'test-client.apps.googleusercontent.com' : o.gcid, receipts: true },
        www_upcoming: { servings: [], events: [] }, account_me: st.me, volunteer_me: st.vol, account_signoffs: st.so,
        account_update: { ok: true, changed: ['phone'] }, account_newsletter: { ok: true, on: body.p_on }, volunteer_me_signup: { ok: true },
        volunteer_me_letter: LETTER, volunteer_me_link: { ok: true }, account_signoff_request: { ok: true, id: 9 }, account_signoff_cancel: { ok: true },
        account_prefill: { signed_in: true, hook: true, linked: true, name: 'Alex', fill: { email: 'alex@example.org', first_name: 'Alex', last_name: 'Tremblay', phone: '514-555-0100', language: 'fr' } }
      };
      return J(route, 200, D[fn] === undefined ? {} : D[fn]);
    });
    await ctx.route(SUPA + '/auth/v1/**', async route => {
      if (await pre(route)) return;
      const u = new URL(route.request().url()), p = u.pathname.replace('/auth/v1/', ''), body = JSON.parse(route.request().postData() || '{}');
      calls.push({ auth: p + u.search, body, bearer: route.request().headers()['authorization'] || '' });
      if (p === 'verify') {
        if (body.type === 'email' && body.email && body.token === '123456') return J(route, 200, session());
        if (body.token_hash === 'goodhash' && body.type === (o.linkType || 'email')) return J(route, 200, session());
        return J(route, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      if (p === 'token' && u.searchParams.get('grant_type') === 'id_token') return J(route, 200, session({ team: !!o.googleTeam }));
      if (p === 'token' && u.searchParams.get('grant_type') === 'refresh_token') return body.refresh_token === 'r-1' ? J(route, 200, session({ n: 2 })) : J(route, 400, { error: 'invalid_grant' });
      if (p === 'logout') return route.fulfill({ status: 204, headers: cors });
      return J(route, 404, {});
    });
    await ctx.route(SUPA + '/functions/v1/site-account**', async route => {
      if (await pre(route)) return;
      const req = route.request();
      if (req.method() === 'GET') { calls.push({ site: 'token' }); return J(route, 200, { token: NOW() + '.abcdef' }); }
      const body = JSON.parse(req.postData() || '{}'); calls.push({ site: body.action, body, auth: req.headers()['authorization'] || '' });
      if (body.action === 'code') return o.code ? J(route, o.code.status, o.code.body) : J(route, 200, { ok: true });
      if (body.action === 'file') return J(route, 200, { url: 'https://files.test/' + body.kind + '-' + body.id + '.pdf', name: 'x.pdf' });
      if (body.action === 'upload') return J(route, 200, { path: 'requests/u-1/abc.pdf', url: SUPA + '/storage/v1/object/upload/sign/signoffs/requests/u-1/abc.pdf?token=up', token: 'up' });
      return J(route, 400, { error: 'action' });
    });
    await ctx.route(SUPA + '/storage/v1/object/upload/sign/**', async route => {
      if (await pre(route)) return;
      calls.push({ storage: route.request().method(), ct: route.request().headers()['content-type'] || '', size: (route.request().postDataBuffer() || Buffer.alloc(0)).length });
      return J(route, 200, { Key: 'signoffs/requests/u-1/abc.pdf' });
    });
    await ctx.route('https://files.test/**', route => { calls.push({ file: route.request().url() }); return route.fulfill({ status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="x.pdf"' }, body: '%PDF-1.4\n%%EOF' }); });
    await ctx.route('https://accounts.google.com/gsi/client', route => { calls.push({ gsi: true }); return route.fulfill({ status: 200, contentType: 'application/javascript', body: GSI_STUB }); });
    await ctx.route(SUPA + '/functions/v1/form-submit**', async route => {
      if (await pre(route)) return;
      const req = route.request();
      if (req.method() === 'GET') { const slug = new URL(req.url()).searchParams.get('slug'); calls.push({ formGet: slug }); const f = slug === 'volunteer' ? FORM : slug === 'newsletter' ? NEWS : null;
        return f ? J(route, 200, { form: f, org: ORG, token: 'tok-' + slug }) : J(route, 404, { error: 'not_found' }); }
      const body = JSON.parse(req.postData() || '{}'); calls.push({ formPost: body, auth: req.headers()['authorization'] || '' });
      return J(route, 200, { ok: true, thank_you: 'Thank you for signing up.', ...(o.saved ? { saved: true } : {}) });
    });
    await ctx.route('https://hub.welfareavenue.com/give/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await ctx.route(SUPA + '/storage/v1/object/public/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex') }));
    const page = await ctx.newPage(); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/status of (403|404|400)/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror ' + e.message));
    await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    if (o.session) {
      await page.goto(ORIGIN + '/privacy/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(s => { localStorage.setItem('wa_site_auth', JSON.stringify(s)); localStorage.removeItem('wa_site_cfg'); }, stored(o.session));
    }
    return { ctx, page, errors, calls, st };
  }
  const has = (calls, pred) => calls.some(pred);
  const SHOTS = process.env.SHOTS || '';
  const shot = async (page, name, full) => { if (SHOTS) await page.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: !!full }); };
  const text = async (page, sel) => (await page.textContent(sel)) || '';
  const tok = s => s.access_token;

  // ---------- accounts off: coming soon, nothing to sign in with ----------
  {
    const { ctx, page, calls, errors } = await context({ mode: 'off' });
    await page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' });
    ok(/Accounts are coming soon/.test(await text(page, '#acct')), 'off: the account page says accounts are coming soon');
    await shot(page, '01-soon');
    ok(!(await page.$('#f-code')) && !has(calls, c => c.gsi), 'off: no sign-in form and no Google script');
    await page.goto(ORIGIN + '/fr/compte/', { waitUntil: 'networkidle' });
    ok(/Les comptes arrivent bientôt/.test(await text(page, '#acct')), 'off: French too');
    await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
    ok(await page.$$eval('[data-acct-link]', ls => ls.every(l => l.hidden)), 'off: the "My account" links stay hidden');
    ok(!errors.length && !(await page.evaluate(() => window.__csp.length)), 'off: no errors, no CSP violation ' + errors.join(' | '));
    await ctx.close();
  }

  // ---------- signing in with a code by email ----------
  {
    const { ctx, page, calls, errors } = await context({});
    await page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' });
    ok(/Sign in to your account/.test(await text(page, '#acct')) && await page.isVisible('#gsi-stub'), 'on: the sign-in view with Google\'s button');
    await shot(page, '02-signin');
    const g = await page.evaluate(() => ({ cid: window.__gsi && window.__gsi.client_id, nonce: window.__gsi && window.__gsi.nonce, ux: window.__gsi && window.__gsi.ux_mode, loc: window.__gsiOpts && window.__gsiOpts.locale }));
    ok(g.cid === 'test-client.apps.googleusercontent.com' && /^[0-9a-f]{64}$/.test(g.nonce || '') && g.ux === 'popup' && g.loc === 'en', 'Google: initialized with our client, a hashed nonce, the popup and English ' + JSON.stringify(g));
    ok(has(calls, c => c.site === 'token'), 'code: the form asks for its token first');
    await page.fill('#a-email', 'not-an-email'); await page.click('#f-code button[type=submit]');
    ok(/valid email/.test(await text(page, '#acct')) && (await page.getAttribute('#a-email', 'aria-invalid')) === 'true', 'code: a bad address is marked');
    await page.fill('#a-email', 'Alex@Example.org'); await page.click('#f-code button[type=submit]');
    await page.waitForSelector('#f-otp', { timeout: 8000 });
    const sent = calls.find(c => c.site === 'code');
    ok(sent && sent.body.email === 'alex@example.org' && sent.body.lang === 'en' && /^\d+\.abcdef$/.test(sent.body.token) && sent.body.hp === '' && sent.body.next === '', 'code: posts the address, language, token and the empty hidden field ' + JSON.stringify(sent && sent.body));
    ok(/Check your email/.test(await text(page, '#acct')) && /alex@example\.org/.test(await text(page, '#acct b')), 'code: "check your email" with the address');
    await shot(page, '03-code');
    ok(await page.$eval('[data-act="resend"]', b => b.disabled && /\(\d+\)/.test(b.textContent)), 'code: "send a new code" waits 30 seconds');
    await page.fill('#a-code', '000000'); await page.click('#f-otp button[type=submit]');
    await page.waitForSelector('#a-code-e');
    ok(/did not work/.test(await text(page, '#a-code-e')) && has(calls, c => c.auth === 'verify' && c.body.type === 'email' && c.body.email === 'alex@example.org' && c.body.token === '000000'), 'code: a wrong code says so');
    await page.fill('#a-code', '123 456'); await page.click('#f-otp button[type=submit]');
    await page.waitForSelector('.acct-head');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('wa_site_auth') || 'null'));
    ok(saved && saved.refresh_token === 'r-1' && saved.email === 'alex@example.org', 'code: the sign-in is kept in this browser');
    const me = calls.find(c => c.fn === 'account_me');
    ok(me && me.auth === 'Bearer ' + saved.access_token && me.body.p_lang === 'en', 'profile: account_me with the person\'s own sign-in');
    ok(/Hi Alex/.test(await text(page, '.acct-head h2')) && /Signed in as alex@example\.org/.test(await text(page, '.acct-head')), 'profile: greeting and the sign-in');
    await page.waitForSelector('#a-vol .stats'); await page.waitForSelector('#a-letters .acct-list');
    const secs = await page.$$eval('.acct-sec h2', hs => hs.map(h => h.textContent));
    ok(JSON.stringify(secs) === JSON.stringify(['Your details', 'Your volunteering', 'Letters and sign-offs', 'Gifts and receipts', 'Email preferences', 'Something not right?']), 'profile: the sections ' + JSON.stringify(secs));
    ok(/Alex Tremblay/.test(await text(page, '#a-details')) && /they\/them/.test(await text(page, '#a-details')) && /H2X 1Y4/.test(await text(page, '#a-details')), 'details: shown');
    await shot(page, '04-profile', true);
    ok(!errors.length && !(await page.evaluate(() => window.__csp.length)), 'code sign-in: no errors, no CSP violation ' + errors.join(' | ') + (await page.evaluate(() => window.__csp.join(' | '))));

    // your details
    await page.click('[data-act="edit"]');
    ok((await page.inputValue('#d-first_name')) === 'Alex' && (await page.inputValue('#d-postal_code')) === 'H2X 1Y4' && (await page.inputValue('#d-language')) === 'en', 'details: the form starts from the record');
    await shot(page, '05-details-edit');
    await page.fill('#d-phone', '438-555-0199'); await page.click('#f-details button[type=submit]');
    await page.waitForSelector('#a-details .waf-banner');
    const upd = calls.find(c => c.fn === 'account_update');
    ok(upd && upd.body.p.phone === '438-555-0199' && upd.body.p.first_name === 'Alex' && upd.body.p.language === 'en' && upd.auth === 'Bearer ' + saved.access_token, 'details: account_update with every field');
    ok(/Saved/.test(await text(page, '#a-details .waf-banner')) && !(await page.$('#f-details')) && calls.filter(c => c.fn === 'account_me').length === 2, 'details: saved, back to the list, the record read again');

    // email preferences
    ok(/do not get our newsletter/.test(await text(page, '#a-emails')), 'emails: newsletter off');
    await page.click('[data-act="news"]'); await page.waitForSelector('#a-emails .waf-banner');
    ok(has(calls, c => c.fn === 'account_newsletter' && c.body.p_on === true) && /on the list/.test(await text(page, '#a-emails')) && /Stop the newsletter/.test(await text(page, '#a-emails button')), 'emails: turned on (account_newsletter true)');

    // volunteering
    ok(await page.$eval('#a-vol .stats', d => /7/.test(d.textContent) && /14/.test(d.textContent) && /2025/.test(d.textContent)), 'volunteering: servings, hours, since');
    ok(await page.$eval('#a-vol progress', p => p.value > 0 && p.max === 100), 'volunteering: the milestone bar (no inline style)');
    ok(await page.$$eval('#a-vol a', as => as.some(a => a.href === 'https://hub.welfareavenue.com/c/tokU1') && as.some(a => a.href === 'https://hub.welfareavenue.com/c/tokH1#survey')), 'volunteering: the serving and survey links go to the Hub');
    await page.click('[data-act="join"][data-role="cook"]');
    ok(/Sign up as cook/.test(await text(page, '#a-vol .ask')), 'open spots: asks first');
    await page.click('[data-act="join-yes"]'); await page.waitForSelector('#a-vol .waf-banner');
    ok(has(calls, c => c.fn === 'volunteer_me_signup' && c.body.p_event === 77 && c.body.p_role === 'cook') && /signed up as cook/.test(await text(page, '#a-vol .waf-banner')), 'open spots: signed up');

    // letters and sign-offs
    const lt = await text(page, '#a-letters');
    ok(/Signed /.test(lt) && /WA-VS-ABC123/.test(lt) && /Steel MacDonald/.test(lt) && /Waiting to be signed/.test(lt) && /another charity/.test(lt), 'letters: signed, waiting and declined with our note');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="dl-signoff"][data-id="3"]')]);
    ok(dl && has(calls, c => c.site === 'file' && c.body.kind === 'signoff' && c.body.id === 3 && c.auth === 'Bearer ' + saved.access_token), 'letters: a signed letter downloads through a short link');
    await page.click('[data-act="cancel-ask"][data-id="4"]');
    ok(/Cancel this request\?/.test(await text(page, '#a-letters')), 'letters: cancelling asks first');
    await page.click('[data-act="cancel-yes"]'); await page.waitForSelector('#a-letters .waf-banner');
    ok(has(calls, c => c.fn === 'account_signoff_cancel' && c.body.p_id === 4) && /cancelled/.test(await text(page, '#a-letters .waf-banner')), 'letters: cancelled');
    await page.click('[data-act="ask"]');
    ok(await page.isVisible('#f-req') && (await page.$$('#f-req input[name="kind"]')).length === 3 && await page.isVisible('#r-from'), 'request: the form, hours by default with dates');
    await page.fill('#r-from', '2026-09-01'); await page.fill('#r-to', '2026-01-01'); await page.click('#f-req button[type=submit]');
    ok(/first date is after/.test(await text(page, '#f-req')), 'request: dates the wrong way round are caught');
    await page.check('#f-req input[value="form"]');
    ok(await page.isVisible('#r-file') && await page.isVisible('#r-from'), 'request: a form adds the file and keeps the dates');
    await page.fill('#r-from', ''); await page.fill('#r-to', '');
    await page.fill('#r-for_org', 'Dawson College'); await page.click('#f-req button[type=submit]');
    ok(/add your form/.test(await text(page, '#f-req')), 'request: a form needs its file');
    await page.setInputFiles('#r-file', { name: 'school.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n%%EOF') });
    ok(!(await page.$('#f-req .err')) && (await page.inputValue('#r-for_org')) === 'Dawson College', 'request: choosing a file clears its note, the answers stay');
    if (SHOTS) { await page.$eval('#a-letters', el => el.scrollIntoView()); await page.locator('#a-letters').screenshot({ path: SHOTS + '/06-request.png' }); }
    await page.click('#f-req button[type=submit]'); await page.waitForSelector('#a-letters .waf-banner');
    const upl = calls.find(c => c.site === 'upload'), put = calls.find(c => c.storage), rq = calls.find(c => c.fn === 'account_signoff_request');
    ok(upl && upl.body.type === 'application/pdf' && upl.body.bytes > 10 && upl.auth === 'Bearer ' + saved.access_token, 'request: asks for a signed upload address with its own sign-in');
    ok(put && put.storage === 'PUT' && /multipart\/form-data/.test(put.ct), 'request: the file goes straight to storage');
    ok(rq && rq.body.p.kind === 'form' && rq.body.p.form_path === 'requests/u-1/abc.pdf' && rq.body.p.form_name === 'school.pdf' && rq.body.p.for_org === 'Dawson College' && rq.body.p.lang === 'en' && rq.body.p.period_from === '', 'request: account_signoff_request with the upload ' + JSON.stringify(rq && rq.body));
    ok(/Request sent/.test(await text(page, '#a-letters .waf-banner')) && !(await page.$('#f-req')), 'request: sent, the form closes');

    // the hours summary
    await page.click('[data-act="summary"]'); await page.waitForSelector('#letterdoc');
    await shot(page, '07-summary');
    ok(/This letter confirms that Alex Tremblay/.test(await text(page, '#letterdoc')) && /WA-VH-XYZ789/.test(await text(page, '#letterdoc')) && /7 of our servings/.test(await text(page, '#letterdoc')), 'summary: the printable letter');
    await page.click('[data-act="back"]'); await page.waitForSelector('.acct-head');
    ok(await page.isVisible('#a-letters'), 'summary: back to the account');

    // gifts and receipts
    await page.waitForSelector('#a-gifts .acct-list');
    const gt = await text(page, '#a-gifts');
    ok(/2 gifts, \$70\.00 in all/.test(gt) && /Fall appeal/.test(gt) && /Monthly/.test(gt) && /Receipt no\. 2025-77/.test(gt) && /Tax year 2026/.test(gt), 'gifts: totals, gifts, the monthly one, receipts');
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="dl-receipt"][data-id="5"]')]);
    ok(dl2 && has(calls, c => c.site === 'file' && c.body.kind === 'receipt' && c.body.id === 5), 'gifts: an official receipt downloads');
    ok(await page.$eval('#a-gifts a[data-wa-donate]', a => a.href === 'https://hub.welfareavenue.com/give'), 'gifts: "make a gift" opens the donation page');

    // a phone
    await page.setViewportSize({ width: 390, height: 800 });
    ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'profile at 390: no sideways scroll');
    await shot(page, '08-phone', true);
    await page.setViewportSize({ width: 320, height: 800 });
    ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 320, 'profile at 320: no sideways scroll');
    await page.setViewportSize({ width: 1280, height: 900 });

    // signing out
    await page.click('.acct-head [data-act="out"]'); await page.waitForSelector('#f-code');
    ok(has(calls, c => c.auth === 'logout?scope=local' && c.bearer === 'Bearer ' + saved.access_token) && !(await page.evaluate(() => localStorage.getItem('wa_site_auth'))), 'sign out: this session only, and gone from the browser');
    ok(!errors.length && !(await page.evaluate(() => window.__csp.length)), 'profile: no errors, no CSP violation ' + errors.join(' | '));
    await ctx.close();
  }

  // ---------- the button in the email ----------
  {
    const { ctx, page, calls } = await context({});
    await page.goto(ORIGIN + '/account/?t=goodhash&k=magiclink', { waitUntil: 'networkidle' });
    await page.waitForSelector('.acct-head');
    ok(has(calls, c => c.auth === 'verify' && c.body.token_hash === 'goodhash' && c.body.type === 'email') && !/t=/.test(page.url()), 'link: verified by its token hash, the address cleaned');
    await ctx.close();
    const c2 = await context({ linkType: 'magiclink' });
    await c2.page.goto(ORIGIN + '/account/?t=goodhash&k=magiclink', { waitUntil: 'networkidle' });
    await c2.page.waitForSelector('.acct-head');
    ok(c2.calls.filter(c => c.auth === 'verify').map(c => c.body.type).join() === 'email,magiclink', 'link: falls back to the type the link was made with');
    await c2.ctx.close();
    const c3 = await context({});
    await c3.page.goto(ORIGIN + '/account/?t=badhash&k=signup', { waitUntil: 'networkidle' });
    await c3.page.waitForSelector('#f-code');
    ok(/expired or was already used/.test(await text(c3.page, '#acct')) && c3.calls.filter(c => c.auth === 'verify').length === 2, 'link: an old link says so and offers a new code');
    await c3.ctx.close();
  }

  // ---------- Google ----------
  {
    const { ctx, page, calls } = await context({});
    await page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' });
    const hashed = await page.evaluate(() => window.__gsi.nonce);
    await page.click('#gsi-stub'); await page.waitForSelector('.acct-head');
    const it = calls.find(c => c.auth === 'token?grant_type=id_token');
    ok(it && it.body.provider === 'google' && it.body.id_token === 'fake.id.token' && crypto.createHash('sha256').update(it.body.nonce).digest('hex') === hashed, 'Google: the ID token to Supabase with the raw nonce');
    await ctx.close();
    const c2 = await context({ googleTeam: true });
    await c2.page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' });
    await c2.page.click('#gsi-stub'); await c2.page.waitForSelector('.acct-one');
    await shot(c2.page, '09-team');
    ok(/This is a team account/.test(await text(c2.page, '#acct')) && c2.calls.some(c => c.auth === 'logout?scope=local') && !(await c2.page.evaluate(() => localStorage.getItem('wa_site_auth'))), 'Google: a team account is signed out here at once');
    ok(!c2.calls.some(c => c.fn === 'account_me'), 'Google: a team account reads nothing');
    await c2.ctx.close();
    const c3 = await context({ gcid: '' });
    await c3.page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' });
    ok(!(await c3.page.$('#gsi')) && !c3.calls.some(c => c.gsi) && await c3.page.isVisible('#f-code'), 'Google: no client yet, so only the code by email');
    await c3.ctx.close();
  }

  // ---------- coming back to a form after signing in, and the forms that fill in ----------
  {
    const { ctx, page, calls } = await context({ saved: true });
    await page.goto(ORIGIN + '/account/?next=%2Fvolunteer%2F%23apply', { waitUntil: 'networkidle' });
    await page.fill('#a-email', 'alex@example.org'); await page.click('#f-code button[type=submit]');
    await page.waitForSelector('#f-otp', { timeout: 8000 });
    ok(calls.find(c => c.site === 'code').body.next === '/volunteer/', 'next: the email\'s link comes back to the page');
    await page.fill('#a-code', '123456'); await page.click('#f-otp button[type=submit]');
    await page.waitForURL(ORIGIN + '/volunteer/#apply');
    ok(true, 'next: back on the volunteer page after signing in');
    await page.waitForSelector('[data-wa-form="volunteer"] form');
    const v = await page.evaluate(() => ({ f: document.querySelector('[data-wa-form="volunteer"] input[name="first_name"]').value, l: document.querySelector('[data-wa-form="volunteer"] input[name="last_name"]').value,
      e: document.querySelector('[data-wa-form="volunteer"] input[name="email"]').value, p: document.querySelector('[data-wa-form="volunteer"] input[name="phone"]').value,
      line: (document.querySelector('[data-wa-form="volunteer"] .waf-acct') || {}).textContent || '' }));
    ok(v.f === 'Alex' && v.l === 'Tremblay' && v.e === 'alex@example.org' && v.p === '514-555-0100', 'forms: filled in from the profile ' + JSON.stringify(v));
    ok(/Signed in as Alex/.test(v.line) && /saved to your profile/.test(v.line), 'forms: the line says so');
    if (SHOTS) await page.locator('[data-wa-form="volunteer"]').screenshot({ path: SHOTS + '/10-form-filled.png' });
    const pf = calls.find(c => c.fn === 'account_prefill');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('wa_site_auth')));
    ok(pf && pf.auth === 'Bearer ' + s.access_token, 'forms: account_prefill with the person\'s own sign-in');
    await page.fill('[data-wa-form="volunteer"] input[name="phone"]', '438-555-0199');
    await page.click('[data-wa-form="volunteer"] .waf-send'); await page.waitForSelector('[data-wa-form="volunteer"] .waf-done');
    const fp = calls.find(c => c.formPost);
    ok(fp && fp.auth === 'Bearer ' + s.access_token && fp.formPost.answers.phone === '438-555-0199', 'forms: the answers go with the person\'s own sign-in');
    ok(/profile is updated too/.test(await text(page, '[data-wa-form="volunteer"]')), 'forms: the thank-you says the profile was updated');
    await ctx.close();
  }
  {
    // the newsletter's language question fills in; "Not you?" signs out and empties the form
    const sess = session();
    const { ctx, page, calls } = await context({ session: sess });
    await page.goto(ORIGIN + '/contact/', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-wa-form*="newsletter"] form');
    ok(await page.$eval('[data-wa-form*="newsletter"] input[name="language"][value="fr"]', i => i.checked), 'forms: a choice fills in too (the language)');
    await page.click('[data-wa-form*="newsletter"] [data-waf-out]');
    await page.waitForFunction(() => !document.querySelector('[data-wa-form*="newsletter"] [data-waf-out]'));
    ok(calls.some(c => c.auth === 'logout?scope=local') && (await page.inputValue('[data-wa-form*="newsletter"] input[name="first_name"]')) === '' &&
       /Have an account\?/.test(await text(page, '[data-wa-form*="newsletter"] .waf-acct')), '"Not you?": signed out, the form empty, the offer to sign in instead');
    ok((await page.getAttribute('[data-wa-form*="newsletter"] .waf-acct a', 'href')) === '/account/?next=%2Fcontact%2F%23newsletter', 'forms: the offer comes back to the same form');
    ok(await page.$eval('[data-wa-form*="newsletter"] .waf-privacy a', a => a.getAttribute('href') === '/privacy/'), 'forms: the privacy line links the notice');
    await ctx.close();
  }
  {
    const { ctx, page, calls } = await context({ mode: 'test' });
    await page.goto(ORIGIN + '/contact/', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-wa-form*="newsletter"] form');
    ok(!(await page.$('[data-wa-form*="newsletter"] .waf-acct')) && !calls.some(c => c.fn === 'account_prefill'), 'forms: in test mode nobody signed in sees no offer');
    await ctx.close();
    const c2 = await context({ mode: 'off', session: session() });
    await c2.page.goto(ORIGIN + '/contact/', { waitUntil: 'networkidle' });
    await c2.page.waitForSelector('[data-wa-form*="newsletter"] form');
    ok(!c2.calls.some(c => c.fn === 'account_prefill') && (await c2.page.inputValue('[data-wa-form*="newsletter"] input[name="first_name"]')) === '', 'forms: with accounts off nothing fills in');
    const fpost = c2.page.click('[data-wa-form*="newsletter"] .waf-send');
    await fpost;
    await c2.ctx.close();
    const c3 = await context({ mode: 'on' });
    await c3.page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
    ok(await c3.page.$$eval('[data-acct-link]', ls => ls.length === 2 && ls.every(l => !l.hidden)), 'on: the "My account" links show');
    await c3.ctx.close();
  }

  // ---------- a session that ran out is renewed; the hook off; a record taken; someone who is not a volunteer ----------
  {
    const { ctx, page, calls } = await context({ session: session({ ttl: -10 }) });
    await page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.acct-head');
    const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem('wa_site_auth')));
    ok(calls.some(c => c.auth === 'token?grant_type=refresh_token' && c.body.refresh_token === 'r-1') && s2.refresh_token === 'r-2' && calls.find(c => c.fn === 'account_me').auth === 'Bearer ' + s2.access_token, 'refresh: an old sign-in is renewed before reading');
    await ctx.close();
    const c2 = await context({ session: session(), rpc: { account_me: { signed_in: true, hook: false } } });
    await c2.page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' }); await c2.page.waitForSelector('.acct-one');
    ok(/Accounts are not open yet/.test(await text(c2.page, '#acct')) && c2.calls.some(c => c.auth === 'logout?scope=local'), 'hook off: says so and signs out');
    await c2.ctx.close();
    const c3 = await context({ session: session(), rpc: { account_me: { signed_in: true, hook: true, linked: false, reason: 'taken', email: 'alex@example.org' } } });
    await c3.page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' }); await c3.page.waitForSelector('.acct-one');
    ok(/already connected to another sign-in/.test(await text(c3.page, '#acct')) && await c3.page.$('#acct a[href="mailto:info@welfareavenue.com"]'), 'taken: says so, with our email');
    await c3.ctx.close();
    const c4 = await context({ session: session(), me: { ...ME, volunteer: false, gifts: [], gift_totals: { count: 0, total: 0, since: null }, receipts: [] } });
    await c4.page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' }); await c4.page.waitForSelector('.acct-head');
    ok(!(await c4.page.$('#a-letters')) && /Volunteer with us/.test(await text(c4.page, '#a-vol')) && !c4.calls.some(c => c.fn === 'volunteer_me' || c.fn === 'account_signoffs'), 'not a volunteer: the way to volunteer, no letters');
    ok(/No gifts on your record yet/.test(await text(c4.page, '#a-gifts')) && /once they are issued/.test(await text(c4.page, '#a-gifts')), 'no gifts: says so');
    await c4.ctx.close();
    const c5 = await context({ session: session(), so: { ...SO, requests: [1, 2, 3].map(i => ({ id: i, kind: 'hours', status: 'requested', requested: '2026-10-01' })) } });
    await c5.page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' }); await c5.page.waitForSelector('#a-letters .acct-list');
    ok(/You have 3 requests waiting/.test(await text(c5.page, '#a-letters')) && !(await c5.page.$('[data-act="ask"]')), 'letters: three waiting, no new request');
    await c5.ctx.close();
    const c6 = await context({ session: session(), so: { ...SO, servings: 0, requests: [] } });
    await c6.page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' }); await c6.page.waitForSelector('#a-letters p');
    ok(/after your first serving/.test(await text(c6.page, '#a-letters')) && !(await c6.page.$('[data-act="summary"]')), 'letters: none before a first serving');
    await c6.ctx.close();
    const c7 = await context({ session: session(), rpc: { account_update: { ok: false, reason: 'invalid', errors: { phone: 'phone' } } } });
    await c7.page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' }); await c7.page.waitForSelector('.acct-head');
    await c7.page.click('[data-act="edit"]'); await c7.page.fill('#d-phone', '12'); await c7.page.click('#f-details button[type=submit]');
    await c7.page.waitForSelector('#d-phone-e');
    ok(/phone number we can reach/.test(await text(c7.page, '#d-phone-e')) && (await c7.page.inputValue('#d-phone')) === '12', 'details: a refused value is marked and kept');
    await c7.ctx.close();
    const c8 = await context({ code: { status: 403, body: { error: 'team' } } });
    await c8.page.goto(ORIGIN + '/account/', { waitUntil: 'networkidle' });
    await c8.page.fill('#a-email', 'someone@welfareavenue.com'); await c8.page.click('#f-code button[type=submit]');
    await c8.page.waitForSelector('#acct .waf-banner', { timeout: 8000 });
    ok(/team signs in at hub\.welfareavenue\.com/.test(await text(c8.page, '#acct .waf-banner')), 'code: a team address is sent to the Hub');
    await c8.ctx.close();
  }

  // ---------- in French ----------
  {
    const { ctx, page, errors } = await context({ session: session(), locale: 'fr-CA' });
    await page.goto(ORIGIN + '/fr/compte/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#a-letters .acct-list'); await page.waitForSelector('#a-gifts .acct-list');
    const fr = await text(page, '#acct');
    await shot(page, '11-fr', true);
    ok(/Bonjour Alex/.test(fr) && /Vos coordonnées/.test(fr) && /Votre bénévolat/.test(fr) && /Lettres et attestations/.test(fr) && /Dons et reçus/.test(fr) && /Préférences de courriel/.test(fr), 'French: the profile');
    ok(/Signée le/.test(fr) && /Télécharger le PDF/.test(fr) && /Refusé le/.test(fr) && /50,00\s\$/.test(fr), 'French: letters (signée, refusé for a form) and money');
    await page.click('.acct-head [data-act="out"]'); await page.waitForSelector('#f-code');
    ok(/Connectez-vous à votre compte/.test(await text(page, '#acct')) && await page.evaluate(() => window.__gsiOpts && window.__gsiOpts.locale === 'fr'), 'French: the sign-in, Google\'s button in French');
    ok(!errors.length && !(await page.evaluate(() => window.__csp.length)), 'French: no errors, no CSP violation ' + errors.join(' | '));
    await ctx.close();
  }

  // ---------- the privacy notice ----------
  {
    const { ctx, page } = await context({ mode: 'off' });
    await page.goto(ORIGIN + '/privacy/', { waitUntil: 'networkidle' });
    const p = await page.evaluate(() => ({ h2: Array.from(document.querySelectorAll('.doc h2')).map(h => h.textContent), mail: !!document.querySelector('.doc a[href="mailto:info@welfareavenue.com"]'),
      sms: !!document.querySelector('.doc a[href="sms:+14388087754"]'), foot: (document.querySelector('.foot .legal a') || {}).getAttribute('href') }));
    await shot(page, '12-privacy', true);
    ok(p.h2.length === 7 && p.h2[0] === 'What we keep' && p.mail && p.sms && p.foot === '/privacy/', 'privacy: seven sections, our email and text line, linked from the footer ' + JSON.stringify(p));
    await page.goto(ORIGIN + '/fr/confidentialite/', { waitUntil: 'networkidle' });
    ok((await page.$$eval('.doc h2', hs => hs.length)) === 7 && /Ce que nous conservons/.test(await text(page, '.doc')) && (await page.getAttribute('.foot .legal a', 'href')) === '/fr/confidentialite/', 'privacy: French');
    await ctx.close();
  }

  await browser.close();
  console.log('w194www: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
