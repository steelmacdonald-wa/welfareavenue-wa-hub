// www2: full-page screenshots of the redesigned website (offline, the Hub mocked), for a visual check.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { attach, ORIGIN } = require('./www_serve.js');
const SUPA = 'https://zwnmulmnvopclzcvytce.supabase.co';
const OUTDIR = process.env.SHOTS || '/home/claude/shots';
const FORM = (slug) => ({ slug, title: slug === 'newsletter' ? 'Get the newsletter' : 'Sign up to serve', intro: '', lang: 'en', thank_you: 'Thanks',
  consent: { ask: true, required: slug === 'newsletter', label: 'Yes, email me news from Welfare Avenue.' },
  questions: slug === 'newsletter' ? [{ id: 'first_name', type: 'text', label: 'First name', required: true }, { id: 'email', type: 'email', label: 'Email', required: true }]
    : [{ id: 'first_name', type: 'text', label: 'First name', required: true }, { id: 'last_name', type: 'text', label: 'Last name', required: true }, { id: 'email', type: 'email', label: 'Email', required: true }, { id: 'phone', type: 'tel', label: 'Phone', required: true }, { id: 'role', type: 'choice', label: 'How would you like to help?', required: true, options: [{ v: 'serve', l: 'Serve' }, { v: 'cook', l: 'Cook' }, { v: 'drive', l: 'Drive' }, { v: 'photos', l: 'Take photos' }] }] });
(async () => {
  const pages = (process.argv[2] || '/,/volunteer/,/donate/,/events/,/about/,/press/,/contact/,/fr/').split(',');
  const widths = (process.argv[3] || '1440,390').split(',').map(Number);
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  for (const W of widths) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1 });
    await attach(ctx);
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'www', 'data', 'upcoming.json'), 'utf8'));
    await ctx.route(SUPA + '/rest/v1/rpc/www_upcoming**', r => r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(seed) }));
    await ctx.route(SUPA + '/functions/v1/form-submit**', async r => {
      const req = r.request(), cors = { 'access-control-allow-origin': ORIGIN, 'content-type': 'application/json' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
      const slug = new URL(req.url()).searchParams.get('slug');
      if (!['newsletter', 'volunteer'].includes(slug)) return r.fulfill({ status: 404, headers: cors, body: '{}' });
      return r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ form: FORM(slug), org: { name: 'Welfare Avenue', email: 'info@welfareavenue.com' }, token: 't' }) });
    });
    await ctx.route('https://www.linkedin.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>LinkedIn post</p>' }));
    const page = await ctx.newPage();
    for (const p of pages) {
      await page.goto(ORIGIN + p, { waitUntil: 'networkidle' });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 300)); });
      await page.waitForTimeout(500);
      const name = (p === '/' ? 'home' : p.replace(/\//g, '_').replace(/^_|_$/g, '')) + '-' + W + '.png';
      await page.screenshot({ path: path.join(OUTDIR, name), fullPage: true });
      console.log('shot', name);
    }
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
