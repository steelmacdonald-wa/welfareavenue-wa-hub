/* w225links.js (wave230): the public link pages (build/links/index.html) with the linkpage function (/lp) stubbed.
   /links/rally?s=ig on a phone: the page, every block type, the buttons through /l/ with the visit token, French, the video
   loads only on a tap, a bad social address dropped; the preview mode draws only what the Studio sends; a missing page falls back. */
const fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
let pass = 0, fail = 0; const out = [];
function ok(n, c, x) { if (c) { pass++; out.push('PASS ' + n); } else { fail++; out.push('FAIL ' + n + (x !== undefined ? ' :: ' + JSON.stringify(x).slice(0, 700) : '')); } }
const html = fs.readFileSync(path.join(__dirname, '../build/links/index.html'), 'utf8');
const T = 'eyJwIjoyfQ.abc123';
const CSP = (fs.readFileSync(path.join(__dirname, '../build/site/_headers'), 'utf8').match(/^\/links\/\*\n(?:  .*\n)*?  Content-Security-Policy: (.*)$/m) || [])[1];
const DATA = (lang) => ({ lang, t: T,
  page: { title: lang === 'fr' ? 'Rallye 2026' : 'Rally Paper 2026', bio: 'One day, one city.', theme: { preset: 'gold', shape: 'rounded' }, socials: { instagram: 'https://instagram.com/welfareavenue', facebook: 'javascript:alert(1)' } },
  blocks: [
    { id: 'h1', type: 'header', label: 'The event' },
    { id: 'r1', type: 'link', label: 'Get your ticket', icon: '🎟️', featured: true, code: 'lp-rally-ab12' },
    { id: 'r2', type: 'form', label: 'Volunteer', to: '/f/volunteer' },
    { id: 'r3', type: 'donate', label: 'Give instead', to: '/give?c=rally' },
    { id: 'r4', type: 'text', text: 'Teams of four, ten stops.' },
    { id: 'r5', type: 'youtube', video: 'dQw4w9WgXcQ', label: 'Last year' },
    { id: 'r6', type: 'impact', stats: [{ n: '1,000+', label: 'meals' }, { n: '40', label: 'teams' }] },
    { id: 'r7', type: 'instagram', count: 3 },
    { id: 'r8', type: 'events', count: 2 },
    { id: 'r9', type: 'socials' }
  ],
  instagram: [1, 2, 3, 4].map(i => ({ url: 'https://instagram.com/p/x' + i, img: 'https://scontent.cdninstagram.com/' + i + '.jpg', alt: 'Post ' + i })),
  events: [{ title: 'Rally Paper', at: '2026-10-17T14:00:00Z', where: 'Toronto', url: 'https://welfareavenue.com/events/rally' }] });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-CA' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const calls = [], csp = []; p.on('console', m => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
  await p.route('**/*', r => { const u = r.request().url();
    if (/^http:\/\/wahub\.test\/links/.test(u)) return r.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': CSP }, body: html });
    if (u === 'http://wahub.test/lp') { const body = JSON.parse(r.request().postData() || '{}'); calls.push(body); if (body.slug === 'gone') return r.fulfill({ status: 404, body: '{}' }); return r.fulfill({ contentType: 'application/json', body: JSON.stringify(DATA(body.lang === 'fr' ? 'fr' : 'en')) }); }
    return r.abort(); });

  await p.goto('http://wahub.test/links/rally?s=ig'); await p.waitForTimeout(900);
  ok('it asks /lp for the rally page from Instagram, with the time zone', calls[0] && calls[0].action === 'load' && calls[0].slug === 'rally' && calls[0].s === 'ig' && !!calls[0].tz && !calls[0].preview, calls[0]);
  let o = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, btn: [...document.querySelectorAll('a.b')].map(a => a.textContent.replace('›', '').trim() + '>' + a.getAttribute('href') + (a.classList.contains('feat') ? '+' : '')), hd: [...document.querySelectorAll('.hd')].map(x => x.textContent), ig: document.querySelectorAll('.ig a').length, ev: document.querySelectorAll('a.ev').length, stats: document.querySelectorAll('.stats > div').length, soc: [...document.querySelectorAll('.soc a')].map(a => a.getAttribute('aria-label')), yt: !!document.querySelector('button.yt'), ifr: document.querySelectorAll('iframe').length, bg: document.body.style.getPropertyValue('--bg'), r: document.body.style.getPropertyValue('--r'), sw: document.documentElement.scrollWidth, foot: document.getElementById('foot').textContent, title: document.title }));
  const tq = 't=' + encodeURIComponent(T);
  ok('the title, the gold theme with rounded buttons', o.h1 === 'Rally Paper 2026' && o.bg === '#DCA527' && o.r === '16px' && o.title === 'Rally Paper 2026', o);
  ok('the buttons go through /l/ with the visit token and the block: the ticket by its short link (featured), the form and the gift by to=', o.btn[0] === '🎟️Get your ticket>/l/lp-rally-ab12?' + tq + '&b=r1+' && o.btn[1] === 'Volunteer>/l/_?' + tq + '&b=r2&to=%2Ff%2Fvolunteer' && o.btn[2] === 'Give instead>/l/_?' + tq + '&b=r3&to=%2Fgive%3Fc%3Drally', o.btn);
  ok('content blocks: heading, three Instagram posts, one event, two numbers', o.hd.includes('The event') && o.hd.includes('Last year') && o.ig === 3 && o.ev === 1 && o.stats === 2, o);
  ok('socials: the https Instagram only (the javascript: address dropped)', o.soc.length === 1 && /Instagram/.test(o.soc[0]), o.soc);
  ok('the video is a picture until tapped (no YouTube frame on load)', o.yt && o.ifr === 0, o);
  ok('the footer says no cookies', /without cookies/.test(o.foot), o.foot);
  ok('a phone: fits the width', o.sw <= 390, o.sw);
  await p.screenshot({ path: __dirname + '/shots_w230_public.png', fullPage: true });
  await p.click('button.yt'); await p.waitForTimeout(200);
  const src = await p.evaluate(() => (document.querySelector('.yt iframe') || {}).src);
  ok('tapping the video loads it from youtube-nocookie', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1/.test(src || ''), src);
  const igh = await p.evaluate(() => document.querySelector('.ig a').getAttribute('href'));
  ok('an Instagram post is counted as its own button (r7-1) and goes to the post', igh === '/l/_?' + tq + '&b=r7-1&to=' + encodeURIComponent('https://instagram.com/p/x1'), igh);
  const fr = await p.evaluate(() => [...document.querySelectorAll('#langs a')].map(a => a.textContent + '>' + a.getAttribute('href')));
  ok('the EN and FR switch keeps the source', fr.join('|') === 'EN>?s=ig&lang=en|FR>?s=ig&lang=fr', fr);
  await p.goto('http://wahub.test/links/rally?s=ig&lang=fr'); await p.waitForTimeout(700);
  o = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, lang: document.documentElement.lang, foot: document.getElementById('foot').textContent }));
  ok('French: the French page and footer', calls.slice(-1)[0].lang === 'fr' && o.h1 === 'Rallye 2026' && o.lang === 'fr' && /sans témoins/.test(o.foot), o);

  /* a page that is not there */
  await p.goto('http://wahub.test/links/gone'); await p.waitForTimeout(700);
  const g = await p.evaluate(() => ({ t: document.getElementById('blocks').textContent, a: [...document.querySelectorAll('a.b')].map(a => a.getAttribute('href')) }));
  ok('a missing page says so and offers welfareavenue.com', /not available/.test(g.t) && g.a[0] === '/l/_?to=' + encodeURIComponent('https://welfareavenue.com/'), g);

  /* preview mode, inside the Studio */
  calls.length = 0;
  await p.goto('http://wahub.test/links/rally?preview=1&from=rally'); await p.waitForTimeout(600);
  const pv0 = await p.evaluate(() => document.querySelectorAll('a.b').length);
  await p.evaluate(() => window.postMessage({ type: 'wa230-preview', lang: 'en', page: { title: 'Draft title', theme: { preset: 'night' }, socials: {}, lang_toggle: false }, blocks: [{ id: 'x', type: 'link', label: 'Draft button', _off: 'Off' }] }, location.origin));
  await p.waitForTimeout(300);
  const pv = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, btn: [...document.querySelectorAll('a.b')].map(a => a.getAttribute('href') + (a.classList.contains('off') ? ' off' : '')), langs: document.getElementById('langs').innerHTML, ig: document.querySelectorAll('.ig a').length }));
  ok('preview: asks /lp in preview mode, draws nothing of its own, then the draft the Studio sends (buttons go nowhere, the off one faded, no language switch)', calls[0] && calls[0].preview === true && calls[0].slug === 'rally' && pv0 === 0 && pv.h1 === 'Draft title' && pv.btn.join() === '# off' && pv.langs === '', [calls[0], pv0, pv]);
  await p.evaluate(() => window.postMessage({ type: 'nope', page: { title: 'Bad' } }, '*')); await p.waitForTimeout(150);
  ok('preview: other messages are ignored', (await p.evaluate(() => document.querySelector('h1').textContent)) === 'Draft title');
  ok('served under the /links/* policy from _headers, nothing blocked', !!CSP && /frame-ancestors 'self'/.test(CSP) && csp.length === 0, [CSP, csp]);
  ok('no page errors', errs.length === 0, errs);
  await b.close();
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
