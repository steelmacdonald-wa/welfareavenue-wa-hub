/* w314drive.js: Manage ads in the Content Studio (Paid, #studio/ads). A marketing lead sees the token state, the campaigns
   with Pause / Turn on / Budget, and Boost a post (Launch asks twice); a non-lead sees none of it. Meta is stubbed:
   nothing leaves the page. Screenshots go to WA_SHOTS when it is set. */
const { launch, fresh } = require('./boot');
const SHOTS = process.env.WA_SHOTS;
let fails = 0, passes = 0;
function ok(c, m) { if (c) passes++; else { fails++; console.log('FAIL ' + m); } }
const wait = ms => new Promise(r => setTimeout(r, ms));
const INVOKE = `
  window.__CALLS = [];
  window.__WA_INVOKE = function (name, opts) {
    var b = (opts && opts.body) || {}; window.__CALLS.push([name, b]);
    if (name === 'social-ads') return { data: { ok: true, summary: { at: new Date().toISOString(), accounts: [{ id: 'act_352486075290612', name: 'Welfare Avenue', currency: 'CAD', lifetime_spend: 100, last30: { spend: 12, reach: 900, impressions: 1500, clicks: 30, results: 20, campaigns: [] } }] } }, error: null };
    if (name !== 'social-ads-manage') return { data: { ok: true }, error: null };
    if (b.action === 'check') return { data: { ok: true, who: 'Steel MacDonald', granted: ['ads_management', 'ads_read', 'read_insights'], can_manage: true, valid: true, expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
      accounts: [{ id: 'act_352486075290612', name: 'Welfare Avenue', currency: 'CAD', status: 1 }, { id: 'act_570313852513008', name: '570313852513008', currency: 'CAD', status: 1 }],
      limits: { max_daily: 50, max_total: 300, max_days: 30, notify: true }, places: [{ key: 'montreal', label: 'Montreal, 25 km' }, { key: 'canada', label: 'Canada' }], goals: [{ key: 'engagement', label: 'More people engage with the post' }, { key: 'reach', label: 'Reach' }] }, error: null };
    if (b.action === 'campaigns') return { data: { ok: true, campaigns: [
      { id: '120247247406890773', name: 'One Bag Challenge launch, a very long campaign name that should wrap nicely on a phone screen', account_id: 'act_352486075290612', currency: 'CAD', objective: 'OUTCOME_ENGAGEMENT', status: 'ACTIVE', effective_status: 'ACTIVE', daily: 10, lifetime: null, adsets: [], spend7: 42.5 },
      { id: '120247247406890999', name: 'Gift Basket Drive', account_id: 'act_352486075290612', currency: 'CAD', objective: 'LINK_CLICKS', status: 'PAUSED', effective_status: 'PAUSED', daily: null, lifetime: null, adsets: [{ id: '1', lifetime: 120 }], spend7: 0 }
    ] }, error: null };
    if (b.action === 'log') return { data: { ok: true, log: [{ at: new Date().toISOString(), by_name: 'Ian', action: 'pause', detail: { name: 'Old campaign' } }] }, error: null };
    if (b.action === 'status') return { data: { ok: true, id: b.id, name: 'One Bag', status: b.status }, error: null };
    if (b.action === 'budget') return { data: { ok: true, id: b.id, name: 'One Bag', after: b.daily || b.lifetime, kind: b.daily ? 'daily' : 'lifetime' }, error: null };
    if (b.action === 'boost') return { data: { ok: true, campaign_id: '9', most: (b.daily || 0) * 8 || b.total, status: b.launch }, error: null };
    return { data: { ok: true }, error: null };
  };`;
(async () => {
  const browser = await launch();
  for (const lead of [true, false]) {
    for (const width of [1366, 390]) {
      const tag = (lead ? 'lead' : 'nonlead') + '@' + width;
      const f = await fresh(browser, { who: 'admin', width, hash: '#studio/ads', init: INVOKE, rpcs: { wa314_ads_lead: lead, wa225_marketing: true, wa225_publisher: true, wa_org_editor: true } });
      await f.hash('#studio/ads', 2500); await wait(1500);
      const s = await f.ev(() => {
        const box = document.querySelector('#w225host .w314');
        return { box: !!box, txt: box ? box.textContent : '', paid: (document.querySelector('#w225host') || {}).textContent || '', rows: box ? box.querySelectorAll('.cp').length : 0, sw: document.documentElement.scrollWidth, iw: innerWidth, calls: window.__CALLS.map(c => c[0] + ':' + (c[1].action || '')) };
      });
      ok(/Paid/.test(s.paid) || /spent/.test(s.paid), tag + ' Paid view drawn');
      ok(s.sw <= s.iw, tag + ' no sideways scroll ' + s.sw + '>' + s.iw);
      if (!lead) {
        ok(!s.box, tag + ' no Manage ads for a non-lead');
        ok(!s.calls.some(c => c.indexOf('social-ads-manage') === 0), tag + ' never calls social-ads-manage ' + JSON.stringify(s.calls));
        ok(/Read-only from Meta/.test(s.paid), tag + ' says read-only');
      } else {
        ok(s.box, tag + ' Manage ads shows');
        ok(/can manage ads/.test(s.txt) && /expires/.test(s.txt), tag + ' token line ' + s.txt.slice(0, 200));
        ok(s.rows === 2, tag + ' two campaigns, got ' + s.rows);
        ok(/Running/.test(s.txt) && /Paused/.test(s.txt), tag + ' status chips');
        ok(/\$120 in all/.test(s.txt), tag + ' ad set budget shown');
        ok(/Ian paused/.test(s.txt), tag + ' recent changes');
        if (SHOTS) await f.page.screenshot({ path: SHOTS + '/w314-' + tag + '-list.png', fullPage: false, clip: await f.ev(() => { const r = document.querySelector('#w225host .w314').getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 10), width: innerWidth, height: Math.min(900, r.height + 20) }; }) }).catch(() => {});
        /* pause */
        await f.ev(() => document.querySelector('[data-w314st^="120247247406890773|PAUSED"]').click()); await wait(600);
        ok(await f.ev(() => window.__CALLS.some(c => c[0] === 'social-ads-manage' && c[1].action === 'status' && c[1].status === 'PAUSED' && c[1].id === '120247247406890773')), tag + ' pause calls the function');
        /* budget */
        await f.ev(() => document.querySelector('[data-w314bed="120247247406890773"]').click()); await wait(200);
        await f.ev(() => { const i = document.querySelector('[data-w314bv="120247247406890773"]'); i.value = '15'; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[data-w314bsave^="120247247406890773"]').click(); }); await wait(600);
        ok(await f.ev(() => window.__CALLS.some(c => c[1].action === 'budget' && c[1].daily === 15)), tag + ' budget 15 a day sent');
        /* boost */
        await f.ev(() => document.querySelector('[data-w314boost]').click()); await wait(300);
        const fm = await f.ev(() => { const q = document.querySelector('#w225host .w314'); return { posts: q.querySelectorAll('[data-w314f="post"] option').length, sum: (q.querySelector('.sum') || {}).textContent || '', err: (q.querySelector('.card .err') || {}).textContent || '' }; });
        ok(fm.posts >= 1, tag + ' post picker has posts ' + fm.posts);
        ok(/up to \$80/.test(fm.sum), tag + ' summary says up to $80 (10 a day, 8 days) ' + fm.sum + fm.err);
        /* over the limit */
        await f.ev(() => { const i = document.querySelector('[data-w314f="amount"]'); i.value = '60'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(200);
        ok(await f.ev(() => /most a day/.test(document.querySelector('#w225host .w314').textContent) && document.querySelector('[data-w314go="active"]').hasAttribute('disabled')), tag + ' over the daily limit blocks launch');
        await f.ev(() => { const i = document.querySelector('[data-w314f="amount"]'); i.value = '10'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(200);
        if (SHOTS) await f.page.screenshot({ path: SHOTS + '/w314-' + tag + '-boost.png', clip: await f.ev(() => { const r = document.querySelector('#w225host .w314 .card').getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 10), width: innerWidth, height: Math.min(1000, r.height + 20) }; }) }).catch(() => {});
        /* launch asks twice */
        await f.ev(() => document.querySelector('[data-w314go="active"]').click()); await wait(200);
        const asked = await f.ev(() => ({ t: document.querySelector('[data-w314go="active"]').textContent, sent: window.__CALLS.some(c => c[1].action === 'boost') }));
        ok(/Yes, spend up to \$80/.test(asked.t) && !asked.sent, tag + ' first Launch only asks ' + JSON.stringify(asked));
        await f.ev(() => document.querySelector('[data-w314go="active"]').click()); await wait(700);
        const sent = await f.ev(() => window.__CALLS.filter(c => c[1].action === 'boost').map(c => c[1])[0]);
        ok(sent && sent.launch === 'active' && sent.daily === 10 && sent.account_id === 'act_352486075290612' && sent.social_post_id > 0 && sent.end > sent.start, tag + ' boost sent ' + JSON.stringify(sent));
        ok(await f.ev(() => /Boost launched/.test(document.querySelector('#w225host .w314').textContent) && !document.querySelector('[data-w314go]')), tag + ' form closes with a note');
      }
      ok(!f.errs.length, tag + ' no page errors ' + JSON.stringify(f.errs));
      await f.close();
    }
  }
  await browser.close();
  console.log('w314drive: ' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
