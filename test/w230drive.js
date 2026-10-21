/* w230drive.js: wave230, the link pages in the Content Studio. Steel (09/10/26): "I'd like to create a linktree section of the
   studio with the ability to track insights on who clicking what link and make it similar to linktree pro but much better".
   The fixture is test/fixture.json plus link_pages, link_page_sources, link_page_events, short_links and crm_forms; the rpc
   wa230_conversions answers two sign-ups and a gift. The preview frame is served build/links/index.html with /lp stubbed.
   Uses test/boot.js (clock fixed 2026-09-25 16:00 Toronto). Writes are recorded by wrapping db. */
const fs = require('fs'), path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }

const NOW = new Date('2026-09-25T16:00:00-04:00').getTime();
const ago = (days, h) => new Date(NOW - days * 86400000 - (h || 0) * 3600000).toISOString();
const MAIN = { id: 1, slug: 'main', title: 'Welfare Avenue', title_fr: null, bio: 'Youth-powered meals and community.', bio_fr: 'Des repas et une communauté, portés par les jeunes.', avatar_url: null, theme: { preset: 'green', shape: 'pill' },
  socials: { instagram: 'https://instagram.com/welfareavenue', facebook: 'https://facebook.com/welfareavenue' }, settings: { lang: 'auto', fallback_url: 'https://welfareavenue.com/' }, status: 'live',
  blocks: [
    { id: 'b-vol', type: 'form', form: 'volunteer', form_fr: 'benevole', label: 'Volunteer with us', label_fr: 'Faire du bénévolat', icon: '🙌', featured: true, on: true },
    { id: 'b-news', type: 'form', form: 'newsletter', label: 'Join the newsletter', label_fr: 'Infolettre', icon: '💌', on: true, ab: { on: true, label: 'Get our news', started_at: ago(20) } },
    { id: 'b-site', type: 'link', label: 'Our website', url: 'https://welfareavenue.com/', code: 'lp-site', on: true },
    { id: 'b-ig', type: 'instagram', count: 6, on: true },
    { id: 'b-soc', type: 'socials', on: true }
  ], created_at: ago(5), updated_at: ago(1), published_at: ago(5) };
const RALLY = { id: 2, slug: 'rally', title: 'Rally Paper 2026', bio: '', theme: { preset: 'gold' }, socials: {}, settings: { lang: 'auto' }, status: 'draft',
  blocks: [{ id: 'r1', type: 'link', label: 'Tickets', url: 'https://welfareavenue.com/rally', code: 'lp-rally-ab12', on: true, start_at: '2026-10-01T12:00:00Z' }], created_at: ago(3), updated_at: ago(3) };

function events() {
  const ev = []; let id = 1;
  const srcs = ['ig', 'ig', 'ig', 'tt', 'direct', 'fb', 'poster'];
  const cities = [['Toronto', 'Ontario', 'CA'], ['Montreal', 'Quebec', 'CA'], ['Mississauga', 'Ontario', 'CA'], [null, 'Eastern Canada', 'CA'], ['Paris', 'Île-de-France', 'FR']];
  for (let i = 0; i < 240; i++) {
    const d = i % 28, h = (i * 7) % 24, src = srcs[i % srcs.length], c = cities[i % cities.length], vis = 'v' + (i % 90);
    const variant = JSON.stringify({ 'b-news': i % 2 ? 'b' : 'a' });
    ev.push({ id: id++, page_id: 1, at: ago(d, h), kind: 'view', block_id: null, variant, src, src_detail: null, visitor: vis, repeat_visit: i >= 90, lang: i % 4 === 0 ? 'fr' : 'en', device: i % 5 === 0 ? 'computer' : 'phone', os: i % 3 ? 'iOS' : 'Android', browser: src === 'ig' ? 'Instagram app' : 'Safari', country: c[2], region: c[1], city: c[0] });
    if (i % 3 === 0) ev.push({ id: id++, page_id: 1, at: ago(d, h - 0.05), kind: 'click', block_id: 'b-vol', variant: null, src, visitor: vis, repeat_visit: false, lang: 'en', device: 'phone', os: 'iOS', browser: 'Safari', country: 'CA', region: c[1], city: c[0] });
    if (i % 5 === 0) ev.push({ id: id++, page_id: 1, at: ago(d, h - 0.05), kind: 'click', block_id: 'b-news', variant: i % 2 ? 'b' : 'a', src, visitor: vis, repeat_visit: false, lang: 'en', device: 'phone', os: 'iOS', browser: 'Safari', country: 'CA', region: c[1], city: c[0] });
    if (i % 11 === 0) ev.push({ id: id++, page_id: 1, at: ago(d, h - 0.05), kind: 'click', block_id: 'b-ig-3', variant: null, src, visitor: vis, repeat_visit: false, lang: 'en', device: 'phone', os: 'iOS', browser: 'Safari', country: 'CA', region: c[1], city: c[0] });
  }
  for (let i = 0; i < 12; i++) ev.push({ id: id++, page_id: 2, at: ago(i, 2), kind: 'view', variant: null, src: 'qr', visitor: 'r' + i, repeat_visit: false, lang: 'en', device: 'phone', os: 'Android', browser: 'Chrome', country: 'CA', region: 'Ontario', city: 'Toronto' });
  return ev;
}
const CONV = [
  { kind: 'form', page_id: 1, block_id: 'b-vol', src: 'ig', at: ago(2), clicked_at: ago(2, 0.3), contact_id: 51, contact_name: 'Amira Haddad', title: 'Volunteer with Welfare Avenue', completed: true },
  { kind: 'form', page_id: 1, block_id: 'b-news', src: 'tt', at: ago(6), clicked_at: ago(6, 0.1), contact_id: 52, contact_name: 'Jonah Pereira', title: 'Newsletter', completed: true },
  { kind: 'donation', page_id: 1, block_id: 'b-don', src: 'ig', at: ago(9), clicked_at: ago(9, 0.2), contact_id: null, contact_name: null, ref: 'monthly', completed: true }
];
function fx() {
  const f = loadFixture();
  (f.hub_access_profiles || []).forEach(p => { p.pages = p.pages || {}; p.pages.studio = ({ marketing: 'all', fundraising: 'all', executive: 'all', admin: 'all', board: 'none' })[p.key] || 'lead'; });
  f.link_pages = [MAIN, RALLY];
  f.link_page_sources = [
    { id: 1, page_id: null, code: 'ig', label: 'Instagram bio', kind: 'platform', active: true }, { id: 2, page_id: null, code: 'tt', label: 'TikTok bio', kind: 'platform', active: true },
    { id: 3, page_id: null, code: 'fb', label: 'Facebook page', kind: 'platform', active: true }, { id: 4, page_id: 1, code: 'poster', label: 'Poster at the kitchen', kind: 'qr', active: true },
    { id: 5, page_id: 2, code: 'qr', label: 'Rally flyers', kind: 'qr', active: true }];
  f.link_page_events = events();
  f.short_links = (f.short_links || []).concat([{ id: 91, code: 'lp-site', url: 'https://welfareavenue.com/', label: 'Our website (link page main)', clicks: 4, active: true, created_at: ago(5) }]);
  f.crm_forms = (f.crm_forms || []).filter(x => !['volunteer', 'newsletter', 'benevole'].includes(x.slug)).concat([
    { id: 801, slug: 'volunteer', title: 'Volunteer with Welfare Avenue', kind: 'volunteer', lang: 'en', status: 'published' }, { id: 802, slug: 'benevole', title: 'Bénévolat', kind: 'volunteer', lang: 'fr', status: 'published' },
    { id: 803, slug: 'newsletter', title: 'Newsletter', kind: 'newsletter', lang: 'en', status: 'published' }]);
  return f;
}
const LINKS_HTML = fs.readFileSync(path.join(__dirname, '../build/links/index.html'), 'utf8');
const QRLIB = fs.readFileSync(path.join(__dirname, 'qrcode-generator-1.4.4.js'), 'utf8');
const LIVE = { page: { title: 'Welfare Avenue', bio: 'Live', theme: { preset: 'green' }, socials: {} }, lang: 'en', blocks: [], instagram: [1, 2, 3, 4, 5, 6].map(i => ({ url: 'https://instagram.com/p/x' + i, img: 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/x/' + i + '.jpg', alt: 'Post ' + i })), events: [], t: '' };
const beforeGoto = async page => {
  page.__lp = [];
  await page.route(/^http:\/\/wahub\.test\/links(\/|\?|$)/, r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: LINKS_HTML }));
  await page.route('http://wahub.test/lp', r => { page.__lp.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ contentType: 'application/json', body: JSON.stringify(LIVE) }); });
  await page.route('**/qrcode-generator/**', r => r.fulfill({ contentType: 'application/javascript', body: QRLIB }));
};
const INIT = `
  window.confirm = function () { window.__CONFIRMS = (window.__CONFIRMS || 0) + 1; return true; };
  try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
  window.__WA_INVOKE = function () { return { data: { ok: true, can: {}, mode: {}, accounts: [] }, error: null }; };
  window.__REC = function () {
    if (window.__RECON || typeof db === 'undefined') return; window.__RECON = true; window.__W = [];
    var of = db.from.bind(db);
    db.from = function (t) { var b = of(t); ['insert', 'update', 'delete', 'upsert'].forEach(function (m) { var o = b[m]; b[m] = function (p) { window.__W.push([t, m, p === undefined ? null : JSON.parse(JSON.stringify(p))]); return o.apply(b, arguments); }; }); return b; };
  };`;
const RAIL = () => { const r = document.getElementById('w153rail'); return r ? [...r.querySelectorAll('.w153it')].map(a => a.querySelector('span').textContent + (a.classList.contains('on') ? '*' : '')) : null; };
const HOST = () => { const h = document.getElementById('w225host'); return h ? h.innerText.replace(/\s+/g, ' ').trim() : null; };
const W = () => window.__W || [];
const click = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
const toast = () => (document.getElementById('toast') || {}).textContent || '';
const frame = () => { const f = document.getElementById('w230prev'); if (!f || !f.contentDocument) return null; const d = f.contentDocument; return { btns: [...d.querySelectorAll('a.b')].map(a => a.querySelector('.tx').firstChild.textContent + (a.querySelector('.tag') ? '[' + a.querySelector('.tag').textContent + ']' : '') + (a.classList.contains('feat') ? '+' : '') + (a.classList.contains('off') ? '(off)' : '')), h1: (d.querySelector('h1') || {}).textContent, bg: d.body.style.getPropertyValue('--bg'), ig: d.querySelectorAll('.ig a').length, mark: f.contentWindow.__mark || 0 }; };

process.on("unhandledRejection", e => { console.log(out.join("\n")); console.log("CRASH", e.message.split("\n")[0]); process.exit(1); });
(async () => {
  const browser = await launch();
  const FX = fx();
  const RP = { wa225_publisher: true, wa225_marketing: true, wa_org_editor: true, wa230_conversions: CONV };

  /* 1. an admin on a computer */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#studio/pages', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RP, init: INIT, wait: 5000, beforeGoto });
    const p = f.page; await f.ev(() => window.__REC());
    let r = await f.ev(RAIL), t = await f.ev(HOST);
    ok('the rail: Link pages (marked) and Short links in the Toolkit', r && r.includes('Link pages*') && r.includes('Short links'), r);
    ok('the pages: the link in bio (live) and the rally page (draft) with their addresses and 30-day numbers', /Welfare Avenue Live Link in bio/.test(t) && /hub\.welfareavenue\.com\/links\b/.test(t) && /Rally Paper 2026 Draft/.test(t) && /hub\.welfareavenue\.com\/links\/rally/.test(t) && /240 views/.test(t) && /3 sign-ups and gifts/.test(t), t.slice(0, 900));

    /* a new page */
    await p.fill('#w230nt', 'Toronto Kitchen'); await p.selectOption('#w230ntpl', 'city'); await click(p, '#w225host [data-w230new]'); await p.waitForTimeout(600);
    let w = await f.ev(W);
    const np = w.filter(x => x[0] === 'link_pages' && x[1] === 'insert')[0];
    ok('Make it: a draft at /links/toronto-kitchen with the city blocks and the bio page’s look', np && np[2].slug === 'toronto-kitchen' && np[2].status === 'draft' && np[2].blocks.length === 4 && np[2].blocks[0].type === 'form' && np[2].blocks[0].featured && np[2].theme.preset === 'green' && np[2].socials.instagram, np);
    await p.fill('#w230nt', 'Clash'); await p.fill('#w230ns', 'rally'); await click(p, '#w225host [data-w230new]'); await p.waitForTimeout(300);
    ok('a taken address is refused', /taken/.test(await f.ev(toast)), await f.ev(toast));

    /* the editor */
    await f.hash('#studio/pages/edit/1', 2200);
    t = await f.ev(HOST);
    ok('the editor: the five blocks in order, the featured and A/B badges, clicks on each', /The page/i.test(t) && /Volunteer with us Sign-up form · \d+ clicks in 30 days Featured/.test(t) && /Join the newsletter Sign-up form · \d+ clicks in 30 days A\/B/.test(t) && /Our website Link/.test(t) && /Instagram posts/.test(t) && /Social icons/.test(t), t.slice(0, 1400));
    let fr = await f.ev(frame);
    ok('the preview draws the draft: the title, the featured volunteer button, the links, the Instagram grid from the live data', fr && fr.h1 === 'Welfare Avenue' && fr.btns[0] === 'Volunteer with us+' && fr.btns.join('|').indexOf('Our website') > 0 && fr.ig === 6, fr);
    const lpCalls = await p.evaluate(() => 0); /* placeholder for symmetry */
    ok('the preview asks /lp in preview mode for the bio page', p.__lp.some(x => x.preview === true && x.slug === 'main' && x.action === 'load'), p.__lp);
    await f.ev(() => { document.getElementById('w230prev').contentWindow.__mark = 7; });
    await click(p, '#w225host [data-w230open="b-site"]'); await p.waitForTimeout(300);
    await p.fill('#w225host [data-w230b="2|label"]', 'Visit our website'); await p.waitForTimeout(400);
    fr = await f.ev(frame);
    ok('typing a label updates the preview at once, and opening a block keeps the same frame (no reload)', fr.btns.indexOf('Visit our website') >= 0 && fr.mark === 7, fr);
    await click(p, '#w225host [data-w230t="preset|cream"]'); await p.waitForTimeout(400);
    fr = await f.ev(frame);
    ok('a theme click repaints the preview in cream, still the same frame', /#FFFAF2/i.test(fr.bg) && fr.mark === 7, fr);
    await click(p, '#w225host [data-w230pl="fr"]'); await p.waitForTimeout(400);
    fr = await f.ev(frame);
    ok('the French preview: the French labels', fr.btns[0] === 'Faire du bénévolat+' && fr.btns[1] === 'Infolettre', fr);
    await click(p, '#w225host [data-w230pl="en"]'); await click(p, '#w225host [data-w230pb="1"]'); await p.waitForTimeout(400);
    fr = await f.ev(frame);
    ok('preview B shows the A/B test’s other text', fr.btns[1] === 'Get our news', fr);
    await click(p, '#w225host [data-w230pb="0"]');
    await click(p, '#w225host [data-w230open="b-news"]'); await p.waitForTimeout(300);
    t = await f.ev(HOST);
    ok('the A/B result: views and clicks for A and B with a verdict', /A Join the newsletter \d+ \d+ [\d.]+%/.test(t) && /B Get our news \d+ \d+ [\d.]+%/.test(t) && /(sure|Too early|No difference)/.test(t), t.slice(t.indexOf('A/B test'), t.indexOf('A/B test') + 400));
    /* change the link, schedule it, add a link, save */
    await p.fill('#w225host [data-w230b="2|url"]', 'https://welfareavenue.com/about'); await p.waitForTimeout(150);
    await click(p, '#w225host [data-w230addb="link"]'); await p.waitForTimeout(300);
    await p.fill('#w225host [data-w230b="5|label"]', 'Give monthly'); await p.fill('#w225host [data-w230b="5|url"]', 'welfareavenue'); await p.waitForTimeout(150);
    await click(p, '#w225host [data-w230save]'); await p.waitForTimeout(400);
    ok('a link without https:// is refused', /needs a full address/.test(await f.ev(toast)), await f.ev(toast));
    await p.fill('#w225host [data-w230b="5|url"]', 'https://welfareavenue.com/give'); await p.fill('#w225host [data-w230b="5|end_at"]', '2026-12-31T23:59'); await p.waitForTimeout(200);
    await click(p, '#w225host [data-w230save]'); await p.waitForTimeout(900);
    w = await f.ev(W);
    const su = w.filter(x => x[0] === 'short_links' && x[1] === 'update')[0], si = w.filter(x => x[0] === 'short_links' && x[1] === 'insert').slice(-1)[0], lu = w.filter(x => x[0] === 'link_pages' && x[1] === 'update').slice(-1)[0];
    ok('Save: the website link’s short link moves to /about', su && su[2].url === 'https://welfareavenue.com/about' && su[2].active === true, su);
    ok('Save: the new button gets its own lp-main- short link', si && /^lp-main-[a-z0-9]{4}$/i.test(si[2].code) && si[2].url === 'https://welfareavenue.com/give', si);
    ok('Save: the page keeps six blocks, the cream theme, the new label, the end date and the short link code', lu && lu[2].blocks.length === 6 && lu[2].theme.preset === 'cream' && lu[2].blocks[2].label === 'Visit our website' && lu[2].blocks[5].code === (si && si[2].code) && /^2027-01-01T0[34]:59|^2027-01-01T04:59/.test(lu[2].blocks[5].end_at || '') && !lu[2].status, lu && lu[2].blocks.map(b => [b.id, b.label, b.end_at, b.code]));
    ok('the bio page has no publish button (it is always live)', !(await f.ev(() => !!document.querySelector('#w225host [data-w230pub]'))));

    /* the rally draft: publish */
    await f.hash('#studio/pages/edit/2', 1600);
    fr = await f.ev(frame);
    ok('a scheduled button shows faded with its start date in the preview', fr && fr.btns[0] === 'Tickets[From Oct 1](off)', fr);
    await click(p, '#w225host [data-w230pub="live"]'); await p.waitForTimeout(800);
    w = await f.ev(W);
    const pub = w.filter(x => x[0] === 'link_pages' && x[1] === 'update').slice(-1)[0];
    ok('Save and publish sets the rally page live', pub && pub[2].status === 'live', pub);
    ok('the toast gives the live address', /live at hub\.welfareavenue\.com\/links\/rally/.test(await f.ev(toast)), await f.ev(toast));

    /* insights */
    await f.hash('#studio/pages/insights', 1600);
    t = await f.ev(HOST);
    const ins = await f.ev(() => ({ kpis: [...document.querySelectorAll('#w225host .kpi')].map(k => k.innerText.replace(/\s+/g, ' ')), heat: document.querySelectorAll('#w225host .w230heat i').length, bars: document.querySelectorAll('#w225host .w230chart rect').length, fun: [...document.querySelectorAll('#w225host .w230fun b')].map(b => b.textContent) }));
    ok('Insights: views, people, clicks, click rate and sign-ups for every page', /^252 views/i.test(ins.kpis[0]) && /^1\d\d people/i.test(ins.kpis[1]) && /clicks/i.test(ins.kpis[2]) && /click rate/i.test(ins.kpis[3]) && /^2 sign-ups.*1 gift started, 1 made/i.test(ins.kpis[4]), ins.kpis);
    ok('the day chart (30 bars), the 7 x 24 heatmap, the funnel from views to sign-ups', ins.bars === 30 && ins.heat === 168 && ins.fun.length === 4 && ins.fun[0] === '252' && ins.fun[3] === '3', ins);
    ok('the buttons: Volunteer with us on top, an Instagram post named, sign-ups credited', /Volunteer with us Welfare Avenue 80 30 32% 1 Join the newsletter/.test(t) && /Instagram posts · post 3/.test(t), t.slice(500, 2600));
    ok('where they came from: the Instagram bio first, the kitchen poster named, QR scans', /Where they came from Source Views People Clicks Click rate Sign-ups Instagram bio 1\d\d/i.test(t) && /Poster at the kitchen/.test(t) && /Rally flyers/.test(t), '');
    ok('what it says: the top source, the most-clicked button, the peak time, phones', /Instagram bio brings/.test(t) && /gets [\d.]+% of all clicks/.test(t) && /Visits peak on/.test(t) && /visit on a phone/.test(t), t.slice(0, 900));
    ok('places and devices: Toronto, Ontario; Montreal; Canada named; Phone; Instagram app; French', /Toronto, Ontario/.test(t) && /Montreal, Quebec/.test(t) && /Canada 81%/.test(t) && /Phone 81%/.test(t) && /Instagram app/.test(t) && /French/.test(t), t.slice(t.search(/WHERE THEY ARE/i), t.search(/WHERE THEY ARE/i) + 900));
    await p.selectOption('#w225host [data-w230pg]', '2'); await p.waitForTimeout(400);
    let k2 = await f.ev(() => (document.querySelector('#w225host .kpi') || {}).innerText);
    ok('one page at a time: the rally page has 12 views', /^12\s*views/i.test(String(k2).replace(/\s+/g, ' ')), k2);
    await click(p, '#w225host [data-w230days="7"]'); await p.waitForTimeout(300);
    k2 = await f.ev(() => (document.querySelector('#w225host .kpi') || {}).innerText);
    ok('7 days: 7 views on the rally page', /^7\s*views/i.test(String(k2).replace(/\s+/g, ' ')), k2);
    await p.selectOption('#w225host [data-w230pg]', 'all'); await click(p, '#w225host [data-w230days="30"]'); await p.waitForTimeout(300);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), click(p, '#w225host [data-w230csv]')]);
    let csv = ''; if (dl) { const fp = await dl.path(); csv = fs.readFileSync(fp, 'utf8'); }
    ok('Export: a CSV of every view and click, with the button names and no network hashes', dl && /^when,page,kind,button/.test(csv) && csv.split('\n').length > 300 && /Volunteer with us/.test(csv) && !/ipm|visitor/.test(csv.split('\n')[0]), csv.slice(0, 300));

    /* people */
    await f.hash('#studio/pages/people', 1300);
    t = await f.ev(HOST);
    const pl = await f.ev(() => [...document.querySelectorAll('#w225host a[href^="#crm/c/"]')].map(a => a.getAttribute('href') + ' ' + a.textContent));
    ok('People: the two who signed up named with their CRM records, the gift anonymous, the minutes after the click', pl.join('|') === '#crm/c/51 Amira Haddad|#crm/c/52 Jonah Pereira' && /A donor/.test(t) && /Gave \(monthly\)/.test(t) && /18 min after the click/.test(t), [pl, t.slice(0, 600)]);

    /* sources and QR */
    await f.hash('#studio/pages/sources', 1300);
    t = await f.ev(HOST);
    ok('Sources: an address per source on the bio page (?s=ig), the kitchen poster QR, the rally flyers not on this page', /hub\.welfareavenue\.com\/links\?s=ig/.test(t) && /Poster at the kitchen QR code/.test(t) && !/Rally flyers/.test(t), t.slice(0, 900));
    const [qd] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), click(p, '#w225host [data-w230qr="poster|svg"]')]);
    await p.waitForTimeout(300);
    let svg = ''; if (qd) svg = fs.readFileSync(await qd.path(), 'utf8');
    ok('the QR code: an SVG in our green with the W badge, named for the page and source, shown on the page', qd && qd.suggestedFilename() === 'qr-links-poster.svg' && /fill="#103F39"/.test(svg) && />W<\/text>/.test(svg) && await f.ev(() => !!document.querySelector('#w230qrbox svg')), [qd && qd.suggestedFilename(), svg.slice(0, 200)]);
    const [qp] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), click(p, '#w225host [data-w230qr="ig|png"]')]);
    ok('the QR code as a 1200px PNG', qp && qp.suggestedFilename() === 'qr-links-ig.png' && fs.statSync(await qp.path()).size > 2000, qp && qp.suggestedFilename());
    await p.fill('#w230sl', 'Mosque noticeboard'); await p.selectOption('#w230sk', 'qr'); await click(p, '#w225host [data-w230sadd]'); await p.waitForTimeout(500);
    w = await f.ev(W);
    const sa = w.filter(x => x[0] === 'link_page_sources' && x[1] === 'insert')[0];
    ok('Add a source: a code from its name', sa && sa[2].code === 'mosque-noticeboard' && sa[2].kind === 'qr' && sa[2].label === 'Mosque noticeboard', sa);

    /* the old link in bio address and the Short links page */
    await f.hash('#studio/links/bio', 1300);
    ok('#studio/links/bio goes to Link pages', await f.ev(() => location.hash) === '#studio/pages');
    await f.hash('#studio/links', 1300);
    t = await f.ev(HOST);
    ok('Short links leaves out the lp- links and points to Link pages', !/lp-site/.test(t) && /live in Link pages/.test(t), t.slice(0, 500));
    ok('no page errors (admin)', f.errs.length === 0, f.errs);
    await f.page.screenshot({ path: __dirname + '/shots_w230_links.png' });
    const wide = []; for (const s of ['', '/edit/1', '/insights', '/sources', '/people']) { await f.hash('#studio/pages' + s, 1500); const o = await f.ev(() => { const W = window.innerWidth, bad = [...document.querySelectorAll('#w225host *')].filter(e => e.getBoundingClientRect().right > W + 1).slice(0, 3).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)); return { sw: document.documentElement.scrollWidth, W, bad }; }); if (o.sw > o.W + 1 || o.bad.length) wide.push([s, o]); await f.page.screenshot({ path: __dirname + '/shots_w230' + (s.replace(/\//g, '_') || '_pages') + '.png', fullPage: true }); }
    ok('a computer: every view fits the width', wide.length === 0, wide);
    await f.close();
  }

  /* 2. a staff member outside marketing: read only */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#studio/pages', fixture: JSON.parse(JSON.stringify(FX)), rpcs: { wa225_publisher: false, wa225_marketing: false, wa_org_editor: false, wa230_conversions: CONV }, init: INIT, wait: 5000, beforeGoto });
    const t = await f.ev(HOST);
    const ed = await f.ev(() => ({ edit: document.querySelectorAll('#w225host [data-w225go^="#studio/pages/edit"]').length, add: !!document.getElementById('w230nt') }));
    ok('read only: the pages and their insights, no Edit and no New page', /Welfare Avenue/.test(t) && ed.edit === 0 && !ed.add, ed);
    await f.hash('#studio/pages/edit/1', 1300);
    ok('read only: the editor says who changes the pages', /marketing team and admins change the link pages/.test(await f.ev(HOST)), await f.ev(HOST));
    ok('no page errors (read only)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. a phone */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#studio/pages', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RP, init: INIT, wait: 5000, beforeGoto });
    const over = [];
    for (const s of ['#studio/pages', '#studio/pages/edit/1', '#studio/pages/insights', '#studio/pages/sources', '#studio/pages/people']) { await f.hash(s, 1500); const o = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth })); if (o.sw > o.w + 2) over.push([s, o]); if (s.endsWith('insights')) await f.page.screenshot({ path: __dirname + '/shots_w230_phone_insights.png', fullPage: true }); }
    ok('a phone: every link pages view fits the width', over.length === 0, over);
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  }
  await browser.close();
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
