/* w241drive.js: wave241, approvals in the Content Studio. The composer's Canva link, partner organization and LinkedIn article;
   "Schedule for approval" for someone who cannot publish; the Approvers setting; the Approve / Send it back links from Slack
   (#studio/approvals?post=<id>&do=approve|back); Library > By partner. Uses test/boot.js. CAND=build/candidate.html node test/w241drive.js */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : '')); } }
const iso = (d, t) => new Date(d + 'T' + (t || '18:00') + ':00-04:00').toISOString();
function fx() {
  const f = loadFixture();
  (f.hub_access_profiles || []).forEach(p => { p.pages = p.pages || {}; p.pages.studio = ({ marketing: 'all', fundraising: 'all', executive: 'all', admin: 'all', board: 'none' })[p.key] || 'lead'; });
  const base = { format: 'single', media: [], results: {}, variants: {}, tags: [], first_comment: null, campaign: null, notes: null, caption: 'A caption for the post', track_links: true, created_by: 'Steel MacDonald', updated_at: '2026-09-20T00:00:00Z', created_at: '2026-09-20T00:00:00Z', live: {}, manual: {}, canva_url: null, partner_id: null };
  f.content_posts = [
    Object.assign({}, base, { id: 1, title: 'Sunday serving recap', platforms: ['instagram', 'facebook'], scheduled_at: iso('2026-09-27', '18:00'), status: 'scheduled', approval_status: 'approved', owner: 'Joy Dumansi', partner_id: 5, published_at: null }),
    Object.assign({}, base, { id: 2, title: 'Volunteer call for October', platforms: ['instagram', 'linkedin'], scheduled_at: iso('2026-09-29', '12:00'), status: 'draft', approval_status: 'pending', submitted_by: 'joy.dumansi@welfareavenue.com', submitted_at: '2026-09-24T12:00:00Z', canva_url: 'https://www.canva.com/design/DAF123/view', partner_id: 5 }),
    Object.assign({}, base, { id: 3, title: 'Thank you donors', platforms: ['facebook'], scheduled_at: iso('2026-09-30', '09:00'), status: 'draft', approval_status: 'changes', approval_note: 'Add the total raised', submitted_by: 'joy.dumansi@welfareavenue.com' }),
    Object.assign({}, base, { id: 5, title: 'Oberoi 2025 article', platforms: ['linkedin'], format: 'article', scheduled_at: iso('2025-06-30', '12:00'), published_at: iso('2025-06-30', '12:01'), status: 'posted', approval_status: 'approved', partner_id: 5, caption: 'Last summer with Oberoi Financial Group: a long read.' })
  ];
  f.content_tags = []; f.content_snippets = []; f.content_slots = []; f.short_links = []; f.short_link_clicks = []; f.social_comments = [];
  f.wa_partners = [{ id: 5, name: 'Oberoi Financial Group', category: 'sponsor', status: 'active' }, { id: 73, name: 'DESTA Black Community Network', category: 'partner', status: 'active' }];
  f.hub_settings = (f.hub_settings || []).concat([
    { key: 'content_studio', value: { goals: { instagram: 3 }, hashtag_cap: 5, track_links: true, tz: 'America/Toronto', approvers: ['ian.odhiambo@welfareavenue.com', 'kahkashan.ansary@welfareavenue.com'] }, updated_at: '2026-09-20T00:00:00Z' }
  ]);
  return f;
}
const CAP = { ok: true, token: true, accounts: [{ platform: 'facebook' }, { platform: 'instagram' }], granted: ['pages_manage_posts', 'instagram_content_publish'], missing: [], can: { facebook: true, instagram: true, linkedin: false }, mode: { facebook: 'direct', instagram: 'direct', linkedin: 'reminder' }, settings: {}, studio: {}, connections: {} };
const INIT = `
  window.confirm = function () { return true; };
  try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
  window.__CALLS = [];
  window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; window.__CALLS.push([name, b]); if (name === 'social-publish' && b.action === 'capabilities') return { data: ${JSON.stringify(CAP)}, error: null }; return { data: { ok: true }, error: null }; };
  window.__REC = function () {
    if (window.__RECON || typeof db === 'undefined') return; window.__RECON = true; window.__W = [];
    var of = db.from.bind(db), orpc = db.rpc.bind(db);
    db.from = function (t) { var b = of(t); ['insert', 'update', 'delete', 'upsert'].forEach(function (m) { var o = b[m]; b[m] = function (p) { window.__W.push([t, m, p === undefined ? null : JSON.parse(JSON.stringify(p))]); return o.call(b, p); }; }); return b; };
    db.rpc = function (n, a) { if (/^studio_|^wa241/.test(n)) window.__W.push(['rpc', n, a]); return orpc(n, a); };
  };`;
const HOST = () => { const h = document.getElementById('w225host'); return h ? h.innerText.replace(/\s+/g, ' ').trim() : null; };
const W = () => window.__W || [];

(async () => {
  const browser = await launch();
  const FX = fx();
  const RP = { wa225_publisher: true, wa225_marketing: true, wa_org_editor: true, studio_decide: { id: 2, approval_status: 'approved' }, studio_settings_save: { ok: true } };

  /* 1. an approver (admin): the setting, the deep links, the card's Canva link */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#studio/approvals', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RP, init: INIT, wait: 5000 });
    const p = f.page; await f.ev(() => window.__REC());
    let t = await f.ev(HOST);
    ok('the Approvers box shows Ian and KK', /Approvers/.test(t) && (await f.ev(() => (document.querySelector('#w225host [data-w241approvers]') || {}).value)) === 'ian.odhiambo@welfareavenue.com, kahkashan.ansary@welfareavenue.com', t.slice(0, 300));
    ok('the waiting card has Open in Canva', await f.ev(() => !!document.querySelector('#w225host a[href="https://www.canva.com/design/DAF123/view"]')));
    await f.ev(() => { const i = document.querySelector('#w225host [data-w241approvers]'); i.value = 'ian.odhiambo@welfareavenue.com'; document.querySelector('#w225host [data-w241apsave]').click(); }); await p.waitForTimeout(700);
    const sv = await f.ev(() => (window.__W || []).filter(w => w[0] === 'rpc' && w[1] === 'studio_settings_save')[0]);
    ok('Save writes content_studio.approvers', sv && sv[2].p_key === 'content_studio' && JSON.stringify(sv[2].p_value.approvers) === '["ian.odhiambo@welfareavenue.com"]' && sv[2].p_value.hashtag_cap === 5, sv);
    /* the Approve link from Slack */
    await f.hash('#studio/approvals?post=2&do=approve', 2500);
    const dec = await f.ev(() => (window.__W || []).filter(w => w[0] === 'rpc' && w[1] === 'studio_decide')[0]);
    ok('#studio/approvals?post=2&do=approve approves the post at once', dec && dec[2].p_id === 2 && dec[2].p_decision === 'approve', dec);
    /* the Send it back link: the note gets the focus */
    await f.hash('#studio/approvals?post=2&do=back', 2500);
    const foc = await f.ev(() => { const a = document.activeElement; return a ? a.getAttribute('data-w225apnote') : null; });
    ok('#studio/approvals?post=2&do=back focuses the note', foc === '2', foc);
    const decs = await f.ev(() => (window.__W || []).filter(w => w[0] === 'rpc' && w[1] === 'studio_decide').length);
    ok('Send it back decides nothing without a note', decs === 1, decs);
    /* Library > By partner */
    await f.hash('#studio/library/partners', 2000);
    t = await f.ev(HOST);
    ok('By partner: the picker', /By partner/.test(t) && !!(await f.ev(() => document.querySelector('#w225host [data-w241partner]'))), t.slice(0, 200));
    await f.ev(() => { const s = document.querySelector('#w225host [data-w241partner]'); s.value = '5'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(1200);
    t = await f.ev(HOST);
    ok('Oberoi: the three posts, newest first, the article marked', /Sunday serving recap/.test(t) && /Volunteer call for October/.test(t) && /Oberoi 2025 article/.test(t) && /LinkedIn article/.test(t) && t.indexOf('Sunday serving recap') < t.indexOf('Oberoi 2025 article'), t.slice(0, 500));
    /* the composer: Canva, partner, article */
    await f.hash('#contentcal/2', 2200);
    const cm = await f.ev(() => ({ canva: (document.getElementById('w241canva') || {}).value, partner: (document.getElementById('w241partner') || {}).value, art: !!document.getElementById('w241art'), open: !!document.querySelector('#w121dr a[href="https://www.canva.com/design/DAF123/view"]') }));
    ok('the composer shows the Canva link, the partner and the LinkedIn article switch', cm.canva === 'https://www.canva.com/design/DAF123/view' && cm.partner === '5' && cm.art && cm.open, cm);
    await f.ev(() => { document.getElementById('w241art').checked = true; document.getElementById('w241art').dispatchEvent(new Event('change', { bubbles: true })); const c = document.getElementById('w241canva'); c.value = 'https://www.canva.com/design/NEW/view'; const s = document.getElementById('w241partner'); s.value = '73'; });
    await f.ev(() => { const b = document.querySelector('#w121dr [data-w121save="draft"]'); if (b) b.click(); }); await p.waitForTimeout(900);
    const up = await f.ev(() => (window.__W || []).filter(w => w[0] === 'content_posts' && w[1] === 'update').pop());
    ok('Save draft writes canva_url, partner_id and format article', up && up[2].canva_url === 'https://www.canva.com/design/NEW/view' && up[2].partner_id === 73 && up[2].format === 'article', up && up[2]);
    ok('no page errors (approver)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. a marketing member: Schedule for approval, no Approvers box */
  {
    const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#studio/approvals', fixture: JSON.parse(JSON.stringify(FX)), rpcs: { wa225_publisher: false, wa225_marketing: true, studio_submit: { id: 9, approval_status: 'pending' } }, init: INIT, wait: 5000 });
    const p = f.page; await f.ev(() => window.__REC());
    let t = await f.ev(HOST);
    ok('a member: the intro says scheduling sends it for approval; no Approvers box', /Scheduling a post sends it here/.test(t) && !/Approvers/.test(t), t.slice(0, 300));
    await f.hash('#studio/approvals?post=2&do=approve', 2000);
    ok('a member cannot approve from the link', (await f.ev(() => (window.__W || []).filter(w => w[0] === 'rpc' && w[1] === 'studio_decide').length)) === 0);
    await f.hash('#contentcal/new', 2200);
    await f.ev(() => { document.getElementById('w121date').value = '2026-10-20'; document.getElementById('w121time').value = '18:00'; document.getElementById('w121date').dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('w121cap').value = 'A new post about the serving'; document.getElementById('w121cap').dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(700);
    const btn = await f.ev(() => { const b = document.querySelector('#w121dr [data-w121save="submit"]'); return b ? b.textContent.trim() : null; });
    ok('with a date, the member\'s button reads Schedule for approval', btn === 'Schedule for approval', btn);
    ok('no page errors (member)', f.errs.length === 0, f.errs);
    await f.close();
  }
  console.log(out.join('\n'));
  console.log('w241drive: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
