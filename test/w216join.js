// wave216: Join our team on welfareavenue.com, offline. The website build (build/www/out) served the Netlify way (www_serve.js),
// the Hub mocked: rpc wa216_open_positions, form-submit (the join form as form-submit v6 serves it, the upload link, the answers)
// and the storage upload. Then the Hub's own form page (build/f/index.html) with the same form. Nothing reaches the database.
// Run: node test/w216join.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { attach, ORIGIN, OUT } = require('./www_serve.js');
const SUPA = 'https://zwnmulmnvopclzcvytce.supabase.co';
let pass = 0, fail = 0;
function ok(c, m, x) { if (c) pass++; else { fail++; console.log('FAIL ' + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); } }
const JD = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/jobs/hr-technician-6.pdf?v=1';
const POS = [{ id: 15, title: 'Co-Director of Marketing', dept: 'marketing', stage: 'interviewing', leadership: true }, { id: 6, title: 'HR Technician', dept: 'hr', stage: 'posted', jd_url: JD }, { id: 31, title: 'Logistics Manager', dept: 'opsmtl', stage: 'posted', leadership: true }];
const LEAD = 'For leadership roles, we typically look for people willing to grow with us and stay at least a year.';
function form(lang) {
  const fr = lang === 'fr';
  return { slug: fr ? 'rejoindre' : 'join', title: fr ? 'Rejoindre l’équipe de Welfare Avenue' : 'Join the Welfare Avenue team', intro: 'Intro', lang, kind: 'application', thank_you: fr ? 'Merci pour votre candidature.' : 'Thank you for applying.',
    consent: { ask: false },
    questions: [{ id: 'first_name', type: 'text', label: fr ? 'Prénom' : 'First name', required: true, fill: 'first_name' }, { id: 'last_name', type: 'text', label: 'Last name', required: true },
      { id: 'email', type: 'email', label: 'Email', required: true }, { id: 'phone', type: 'phone', label: 'Phone', required: true },
      { id: 'position', type: 'choice', label: 'Which role?', required: true, lead_note: LEAD, options: POS.map(p => ({ v: 'p:' + p.id, l: p.title, ...(p.jd_url ? { u: p.jd_url } : {}), ...(p.leadership ? { lead: true } : {}) })).concat([{ v: 'general', l: fr ? 'Je ne sais pas encore : une candidature générale' : 'Not sure yet: a general application' }]) },
      { id: 'cv', type: 'file', label: fr ? 'Votre CV' : 'Your CV', help: 'PDF', required: true, accept: '.pdf,.doc,.docx,.odt,.rtf,.png,.jpg,.jpeg', max_mb: 10 },
      { id: 'why', type: 'long_text', label: 'Why?', required: true }, { id: 'links', type: 'text', label: 'Links', required: false }] };
}
const ORG = { name: 'Welfare Avenue', email: 'info@welfareavenue.com', address: 'Welfare Avenue, Montreal', charity: '713048502RR0001' };
const TMP = path.join(__dirname, 'tmp216'); fs.mkdirSync(TMP, { recursive: true });
const CV = path.join(TMP, 'Jordan CV.pdf'); fs.writeFileSync(CV, '%PDF-1.4\n% a made-up CV for the test\n%%EOF\n');
const BAD = path.join(TMP, 'notes.txt'); fs.writeFileSync(BAD, 'not a CV');

(async () => {
  // ---------- the build ----------
  const en = fs.readFileSync(path.join(OUT, 'join', 'index.html'), 'utf8'), fr = fs.readFileSync(path.join(OUT, 'fr', 'rejoindre', 'index.html'), 'utf8');
  ok(/data-wa-form="join"/.test(en) && /data-wa-form="rejoindre,join"/.test(fr), 'the join page carries the CRM form (French falls back to English)');
  ok(/data-open-roles/.test(en) && /id="roles"/.test(en) && /id="apply"/.test(en), 'the open roles and the form have their anchors');
  ok(!/—/.test(en + fr) && !/\sstyle="/i.test(en + fr) && !/\son[a-z]+="/i.test(en + fr), 'no em dash, inline style or handler');
  ok(/href="\/fr\/rejoindre\/"/.test(en) && /href="\/join\/"/.test(fr), 'each language links the other');
  const vol = fs.readFileSync(path.join(OUT, 'volunteer', 'index.html'), 'utf8'), home = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  ok(/id="team"[\s\S]*href="\/join\/"/.test(vol), 'the volunteer page points to Join our team');
  ok(/href="\/join\/">Join our team/.test(home), 'the footer links Join our team');
  ok(/\/careers\s+\/join\/\s+301/.test(fs.readFileSync(path.join(OUT, '_redirects'), 'utf8')), '/careers redirects to /join/');
  ok(/between 4 and 8 hours a week, flexible around your work and school schedule/.test(en) && /entre 4 et 8 heures par semaine/.test(fr), 'hours read between 4 and 8 a week, flexible (EN and FR)');
  ok(!/grow with us|grandir avec nous/.test(en + fr), 'no leadership note in the page itself: only the form shows it');
  ok(/<loc>https:\/\/welfareavenue\.com\/join\/<\/loc>/.test(fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8')), 'the sitemap lists /join/');

  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  async function context(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: opts.width || 1280, height: 900 } });
    await attach(ctx);
    const calls = [];
    const J = (route, status, body, origin) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': origin || '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' }, body: JSON.stringify(body) });
    await ctx.route(SUPA + '/rest/v1/rpc/site_account_config**', r => J(r, 200, { mode: 'off' }));
    await ctx.route(SUPA + '/rest/v1/rpc/www_upcoming**', r => J(r, 200, { servings: [], events: [] }));
    await ctx.route(SUPA + '/rest/v1/rpc/wa216_open_positions**', r => { calls.push('roles'); return opts.noRoles ? J(r, 200, []) : J(r, 200, POS); });
    await ctx.route(SUPA + '/functions/v1/form-submit**', async route => {
      const req = route.request(), origin = req.headers().origin || ORIGIN;
      if (req.method() === 'OPTIONS') return J(route, 204, {}, origin);
      if (req.method() === 'GET') { const slug = new URL(req.url()).searchParams.get('slug'); calls.push('get:' + slug); if (slug === 'rejoindre' && !opts.frLive) return J(route, 404, { error: 'not_found' }, origin); return J(route, 200, { form: form(slug === 'rejoindre' ? 'fr' : 'en'), org: ORG, token: 'tok' }, origin); }
      const b = JSON.parse(req.postData() || '{}');
      if (b.action === 'upload') { calls.push('upload:' + b.qid + ':' + b.name + ':' + b.size); return J(route, 200, { ok: true, upload_id: '11111111-2222-3333-4444-555555555555', url: SUPA + '/storage/v1/object/upload/sign/hub-mail/applications/web/x.pdf?token=t', mime: 'application/pdf' }, origin); }
      calls.push('post:' + JSON.stringify(b.answers));
      return J(route, 200, { ok: true, thank_you: 'Thank you for applying.' }, origin);
    });
    await ctx.route(SUPA + '/storage/v1/object/upload/sign/**', async route => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'PUT, OPTIONS', 'access-control-allow-headers': '*' } });
      calls.push('put:' + req.method() + ':' + (req.headers()['content-type'] || '') + ':' + ((req.postDataBuffer() || Buffer.alloc(0)).length));
      return J(route, opts.putFail ? 500 : 200, { Key: 'hub-mail/applications/web/x.pdf' });
    });
    const page = await ctx.newPage(); const errors = [], csp = [];
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
    return { ctx, page, calls, errors, csp };
  }

  // ---------- English: roles, pick, validation, upload, send ----------
  let c = await context();
  await c.page.goto(ORIGIN + '/join/'); await c.page.waitForSelector('.open-roles li', { timeout: 8000 }).catch(() => {});
  ok(await c.page.$$eval('.open-roles li', l => l.length) === 3, 'three open roles listed live');
  ok(/Human resources/.test(await c.page.textContent('.open-roles')), 'roles show their department');
  await c.page.waitForSelector('#apply form', { timeout: 8000 }).catch(() => console.log('DEBUG', c.calls, c.errors, c.csp));
  ok(await c.page.$$eval('#apply input[name="position"]', l => l.length) === 4, 'the form offers the three roles and a general application');
  ok(await c.page.$eval('.open-roles', b => [...b.querySelectorAll('a[target="_blank"]')].map(a => a.href + '|' + a.textContent).join()) === JD + '|Read the job description', 'roles list: the HR Technician JD link, none for roles without one');
  ok(await c.page.$eval('#apply', b => [...b.querySelectorAll('a.jdlink')].map(a => a.href).join()) === JD, 'form: the JD link sits on its option');
  ok(await c.page.$eval('#apply [data-waf-lead]', n => n.hidden), 'leadership note hidden before a role is picked');
  await c.page.check('#apply input[name="position"][value="p:31"]'); await c.page.waitForTimeout(100);
  ok(await c.page.$eval('#apply [data-waf-lead]', n => !n.hidden && /stay at least a year/.test(n.textContent)), 'leadership note shows when a leadership role is picked');
  await c.page.check('#apply input[name="position"][value="general"]'); await c.page.waitForTimeout(100);
  ok(await c.page.$eval('#apply [data-waf-lead]', n => n.hidden), 'leadership note hides again for a general application');
  await c.page.click('.open-roles [data-pick="p:6"]'); await c.page.waitForTimeout(300);
  ok(await c.page.$eval('#apply input[name="position"][value="p:6"]', i => i.checked), '"Apply for this role" picks it in the form');
  await c.page.fill('#apply input[name="first_name"]', 'Jordan'); await c.page.fill('#apply input[name="last_name"]', 'Test');
  await c.page.fill('#apply input[name="email"]', 'jordan@example.com'); await c.page.fill('#apply input[name="phone"]', '514 555 0100');
  await c.page.fill('#apply textarea[name="why"]', 'I cook for my family every Sunday.');
  await c.page.click('#apply .waf-send'); await c.page.waitForTimeout(300);
  ok(/Please answer this question/.test(await c.page.textContent('#apply [data-q="cv"]')), 'no CV: the CV question asks for one');
  ok(await c.page.$eval('#apply input[name="position"][value="p:6"]', i => i.checked) && (await c.page.inputValue('#apply input[name="first_name"]')) === 'Jordan', 'answers kept after the error');
  await c.page.setInputFiles('#apply input[name="cv"]', BAD); await c.page.click('#apply .waf-send'); await c.page.waitForTimeout(300);
  ok(/PDF, Word document or photo/.test(await c.page.textContent('#apply [data-q="cv"]')), 'a .txt file is refused before upload');
  ok(!c.calls.some(x => x.startsWith('upload:')), 'nothing uploaded for a refused file');
  await c.page.setInputFiles('#apply input[name="cv"]', CV); await c.page.waitForTimeout(200);
  ok(/Attached: Jordan CV\.pdf/.test(await c.page.textContent('#apply [data-q="cv"]')), 'the chosen file is named under the field');
  await c.page.click('#apply .waf-send'); await c.page.waitForSelector('#apply .waf-done', { timeout: 8000 }).catch(() => {});
  ok(c.calls.some(x => /^upload:cv:Jordan CV\.pdf:\d+$/.test(x)), 'an upload link was asked for the CV', c.calls);
  ok(c.calls.some(x => /^put:PUT:application\/pdf:\d+$/.test(x) && !/:0$/.test(x)), 'the CV was PUT to storage with its type', c.calls);
  const post = c.calls.filter(x => x.startsWith('post:'))[0] || ''; const ans = post ? JSON.parse(post.slice(5)) : {};
  ok(ans.cv === '11111111-2222-3333-4444-555555555555' && ans.position === 'p:6' && ans.email === 'jordan@example.com', 'the answers carry the upload id and the role', ans);
  ok(/Thank you for applying/.test(await c.page.textContent('#apply')), 'the thank-you shows');
  ok(!c.errors.length && !c.csp.length, 'no page errors or CSP blocks', c.errors.concat(c.csp));
  await c.ctx.close();

  // ---------- an upload that fails, then works ----------
  c = await context({ putFail: true });
  await c.page.goto(ORIGIN + '/join/'); await c.page.waitForSelector('#apply form', { timeout: 8000 });
  await c.page.fill('#apply input[name="first_name"]', 'A'); await c.page.fill('#apply input[name="last_name"]', 'B'); await c.page.fill('#apply input[name="email"]', 'a@example.com');
  await c.page.fill('#apply input[name="phone"]', '514 555 0100'); await c.page.check('#apply input[name="position"][value="general"]'); await c.page.fill('#apply textarea[name="why"]', 'Why not');
  await c.page.setInputFiles('#apply input[name="cv"]', CV); await c.page.click('#apply .waf-send'); await c.page.waitForTimeout(800);
  ok(/could not be uploaded/.test(await c.page.textContent('#apply')), 'a failed upload says so and keeps the form');
  ok(!c.calls.some(x => x.startsWith('post:')), 'no answers sent without the CV');
  ok(/Attached: Jordan CV\.pdf/.test(await c.page.textContent('#apply [data-q="cv"]')), 'the file stays chosen to try again');
  await c.ctx.close();

  // ---------- French, no open roles, phone width ----------
  c = await context({ noRoles: true, width: 360 });
  await c.page.goto(ORIGIN + '/fr/rejoindre/'); await c.page.waitForSelector('#apply form', { timeout: 8000 }).catch(() => {});
  ok(c.calls.includes('get:rejoindre') && c.calls.includes('get:join'), 'French asks for rejoindre, then falls back to join');
  ok(/Aucun poste n’est ouvert/.test(await c.page.textContent('#roles')), 'no open roles: the page invites a general application (French)');
  ok(await c.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 360 px');
  ok(!c.errors.length && !c.csp.length, 'French: no page errors or CSP blocks', c.errors.concat(c.csp));
  await c.ctx.close();

  // ---------- the Hub's own form page (hub.welfareavenue.com/f/join) ----------
  const fpage = fs.readFileSync(path.join(__dirname, '..', 'build', 'f', 'index.html'), 'utf8');
  c = await context();
  await c.ctx.route('https://hub.welfareavenue.com/f/join', r => r.fulfill({ status: 200, contentType: 'text/html', body: fpage }));
  await c.page.goto('https://hub.welfareavenue.com/f/join'); await c.page.waitForSelector('#waf', { timeout: 8000 });
  ok(/Join our team/.test(await c.page.textContent('#ey')), 'the Hub page says Join our team above the title');
  await c.page.fill('#q_first_name', 'Sam'); await c.page.fill('#q_last_name', 'Test'); await c.page.fill('#q_email', 'sam@example.com'); await c.page.fill('#q_phone', '514 555 0101');
  ok(await c.page.$eval('[data-waf-lead]', n => n.hidden), 'Hub page: leadership note hidden at first');
  ok(await c.page.$$eval('a.jdlink', l => l.map(a => a.href).join()) === JD, 'Hub page: the JD link on its option');
  await c.page.check('input[name="position"][value="p:6"]'); await c.page.waitForTimeout(100);
  ok(await c.page.$eval('[data-waf-lead]', n => n.hidden), 'Hub page: no note for HR Technician');
  await c.page.check('input[name="position"][value="p:15"]'); await c.page.waitForTimeout(100);
  ok(await c.page.$eval('[data-waf-lead]', n => !n.hidden), 'Hub page: note shows for Co-Director of Marketing'); await c.page.fill('#q_why', 'Marketing is my thing.');
  await c.page.click('#send'); await c.page.waitForTimeout(300);
  ok(/Please answer this question/.test(await c.page.textContent('[data-q="cv"]')), 'Hub page: the CV is required');
  await c.page.setInputFiles('#q_cv', CV); await c.page.click('#send'); await c.page.waitForSelector('.done', { timeout: 8000 }).catch(() => {});
  const post2 = c.calls.filter(x => x.startsWith('post:'))[0] || ''; const ans2 = post2 ? JSON.parse(post2.slice(5)) : {};
  ok(ans2.cv === '11111111-2222-3333-4444-555555555555' && ans2.position === 'p:15', 'Hub page: uploaded, then sent with the upload id', ans2);
  ok(c.calls.some(x => x.startsWith('put:PUT')), 'Hub page: the CV was PUT to storage');
  ok(!c.errors.length, 'Hub page: no page errors', c.errors);
  await c.ctx.close();

  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('\nw216join: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
