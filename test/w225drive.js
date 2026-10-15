/* w225drive.js: wave225, the Content Studio. Steel (09/10/26): "Okay go ahead and build it entirely on th content calendar. Make it
   the most sophisticated content calendar possible. Consider making it an app in the hub." The fixture is test/fixture.json plus the
   Studio's tables. Uses test/boot.js (stubbed Supabase, clock fixed 2026-09-25 16:00 Toronto). Writes are recorded by wrapping db. */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }

const iso = (d, t) => new Date(d + 'T' + (t || '18:00') + ':00-04:00').toISOString();
function fx() {
  const f = loadFixture();
  (f.hub_access_profiles || []).forEach(p => { p.pages = p.pages || {}; p.pages.studio = ({ marketing: 'all', fundraising: 'all', executive: 'all', admin: 'all', board: 'none' })[p.key] || 'lead'; });
  const base = { format: 'single', media: [], results: {}, variants: {}, tags: [], first_comment: null, campaign: null, notes: null, caption: 'A caption', track_links: true, created_by: 'Steel MacDonald', updated_at: '2026-09-20T00:00:00Z' };
  f.content_posts = [
    Object.assign({}, base, { id: 1, title: 'Sunday serving recap', platforms: ['instagram', 'facebook'], scheduled_at: iso('2026-09-27', '18:00'), status: 'scheduled', approval_status: 'approved', owner: 'Joy Dumansi', tags: ['Kitchen'] }),
    Object.assign({}, base, { id: 2, title: 'Volunteer call for October', platforms: ['instagram', 'linkedin'], scheduled_at: iso('2026-09-29', '12:00'), status: 'draft', approval_status: 'pending', submitted_by: 'joy.dumansi@welfareavenue.com', submitted_at: '2026-09-25T15:00:00Z', approval_note: 'First one from me, please check the tone', owner: 'Joy Dumansi', variants: { linkedin: { caption: 'We are looking for volunteers in Montreal.' } } }),
    Object.assign({}, base, { id: 3, title: 'Thank you donors', platforms: ['facebook'], scheduled_at: iso('2026-09-30', '09:00'), status: 'draft', approval_status: 'changes', approval_note: 'Add the total raised', submitted_by: 'steel.macdonald@welfareavenue.com', owner: 'Steel MacDonald' }),
    Object.assign({}, base, { id: 4, title: 'Kitchen idea: behind the scenes', platforms: ['instagram'], scheduled_at: null, status: 'draft', approval_status: 'none', tags: ['Kitchen'] }),
    Object.assign({}, base, { id: 5, title: 'September recap', platforms: ['instagram', 'facebook'], scheduled_at: iso('2026-09-22', '18:00'), published_at: iso('2026-09-22', '18:01'), status: 'published', approval_status: 'approved', approved_at: '2026-09-21T12:00:00Z', tags: ['Recap'], results: { instagram: { id: 'ig5' }, facebook: { id: 'fb5' } } }),
    Object.assign({}, base, { id: 6, title: 'TikTok kitchen tour', platforms: ['tiktok'], scheduled_at: iso('2026-09-24', '17:00'), status: 'scheduled', approval_status: 'approved', owner: 'Steel MacDonald' })
  ];
  f.content_tags = [{ id: 1, name: 'Kitchen', color: '#2A8C7A' }, { id: 2, name: 'Recap', color: '#B4467A' }];
  f.content_snippets = [
    { id: 1, kind: 'template', name: 'Sunday serving', body: '', data: { platforms: ['instagram', 'facebook', 'threads'], caption: 'This Sunday we served {n} meals downtown.', first_comment: '#Montreal #WelfareAvenue', tags: ['Kitchen'] }, uses: 3, created_by: 'Steel MacDonald', updated_at: '2026-09-20T00:00:00Z' },
    { id: 2, kind: 'hashtags', name: 'Montreal', body: '#Montreal #MTL #WelfareAvenue #FoodSecurity', data: {}, uses: 5 },
    { id: 3, kind: 'reply', name: 'Thanks', body: 'Thank you {name}, that means a lot to the team.', data: {}, uses: 1 }
  ];
  f.content_slots = [
    { id: 1, platform: 'instagram', weekday: 0, at: '18:00:00' }, { id: 2, platform: 'facebook', weekday: 0, at: '18:00:00' },
    { id: 3, platform: 'instagram', weekday: 3, at: '18:00:00' }, { id: 4, platform: 'linkedin', weekday: 1, at: '12:00:00' }
  ];
  f.short_links = [
    { id: 1, code: 'vol26', url: 'https://welfareavenue.com/volunteer', label: 'Volunteer page', campaign: 'Fall recruiting', clicks: 40, active: true, created_at: '2026-09-01T00:00:00Z', post_id: 2, platform: 'instagram' },
    { id: 2, code: 'bio-donate', url: 'https://welfareavenue.com/donate', label: 'Donate', clicks: 12, active: true, created_at: '2026-09-02T00:00:00Z' },
    { id: 3, code: 'bio-volunteer', url: 'https://welfareavenue.com/volunteer', label: 'Volunteer with us', clicks: 9, active: true, created_at: '2026-09-03T00:00:00Z' },
    { id: 4, code: 'old1', url: 'https://welfareavenue.com/old', label: 'Old link', clicks: 2, active: false, created_at: '2026-06-03T00:00:00Z' }
  ];
  f.short_link_clicks = [];
  for (let i = 0; i < 30; i++) f.short_link_clicks.push({ id: i + 1, link_id: [1, 2, 3][i % 3], at: new Date(Date.parse('2026-09-25T12:00:00Z') - (i % 20) * 86400000).toISOString(), referrer_host: i % 2 ? 'instagram.com' : 'l.facebook.com', device: i % 4 ? 'phone' : 'computer', country: 'CA' });
  f.social_comments = [
    { id: 1, platform: 'instagram', external_id: 'c1', media_external_id: 'ig5', text: 'Love this! How can I volunteer?', author_handle: 'maria.mtl', commented_at: '2026-09-25T13:00:00Z', status: 'open', from_us: false, hidden: false, like_count: 2, permalink: 'https://instagram.com/p/x' },
    { id: 2, platform: 'facebook', external_id: 'c2', media_external_id: 'fb5', text: 'Great work everyone', author_name: 'Paul Tremblay', commented_at: '2026-09-24T13:00:00Z', status: 'open', from_us: false, hidden: false },
    { id: 3, platform: 'facebook', external_id: 'c3', parent_external_id: 'c2', media_external_id: 'fb5', text: 'Thank you Paul!', commented_at: '2026-09-24T15:00:00Z', status: 'resolved', from_us: true, replied_by: 'Joy' },
    { id: 4, platform: 'instagram', external_id: 'c4', media_external_id: 'ig5', text: 'spam spam', author_handle: 'bot', commented_at: '2026-09-23T13:00:00Z', status: 'resolved', from_us: false, hidden: true }
  ];
  f.social_posts = (f.social_posts || []).concat([
    { id: 900, platform: 'instagram', external_id: 'ig5', url: 'https://instagram.com/p/ig5', kind: 'carousel_album', caption: 'September recap: 1,200 meals', published_at: iso('2026-09-22', '18:01'), reach: 2400, views: 3000, likes: 180, comments: 14, shares: 9, saves: 22 },
    { id: 901, platform: 'facebook', external_id: 'fb5', url: 'https://facebook.com/fb5', kind: 'photo', caption: 'September recap: 1,200 meals', published_at: iso('2026-09-22', '18:02'), reach: 900, likes: 40, comments: 3, shares: 5 },
    { id: 902, platform: 'instagram', external_id: 'ig6', kind: 'image', caption: 'August night', published_at: iso('2026-08-20', '19:00'), reach: 1200, likes: 90, comments: 4, shares: 2, saves: 3 }
  ]);
  f.hub_settings = (f.hub_settings || []).concat([
    { key: 'content_studio', value: { goals: { instagram: 3, facebook: 2, linkedin: 1 }, hashtag_cap: 5, track_links: true, tz: 'America/Toronto' }, updated_at: '2026-09-20T00:00:00Z' },
    { key: 'link_page', value: { title: 'Welfare Avenue', bio: 'Youth-powered meals and community.', theme: 'green', order: ['bio-volunteer', 'bio-donate'], socials: { instagram: 'https://instagram.com/welfareavenue' } }, updated_at: '2026-09-20T00:00:00Z' },
    { key: 'studio_inbox_sync', value: { at: '2026-09-25T19:50:00Z', result: { instagram: { added: 1 }, threads: { error: 'not connected' } } }, updated_at: '2026-09-25T19:50:00Z' }
  ]);
  return f;
}
const CAP = { ok: true, token: true, accounts: [{ platform: 'facebook' }, { platform: 'instagram' }], granted: ['pages_manage_posts', 'instagram_content_publish', 'pages_show_list'], missing: ['instagram_manage_comments', 'pages_manage_engagement'], can: { instagram: true, facebook: true, threads: false, linkedin: true, tiktok: false, youtube: false }, mode: { instagram: 'direct', facebook: 'direct', threads: 'reminder', linkedin: 'make', tiktok: 'reminder', youtube: 'reminder' }, settings: {}, studio: {}, connections: {} };
const CONN = { ok: true, can_change: true, can_meta: true, redirect_uri: 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/social-connect', connections: { threads: { app_saved: true, app_id: '12345…' }, youtube: { app_saved: false }, tiktok: { app_saved: false }, linkedin: { app_saved: false }, make: { saved: true, secret: 'abc123def0', status: 'saved' }, meta: { token: true } } };
const INIT = `
  window.confirm = function () { window.__CONFIRMS = (window.__CONFIRMS || 0) + 1; return true; };
  window.print = function () { window.__PRINTED = document.body.classList.contains('w225print'); };
  try { localStorage.setItem('wa84tour', '1'); } catch (e) {}
  window.__CALLS = [];
  window.__WA_INVOKE = function (name, opts) {
    var b = (opts && opts.body) || {}; window.__CALLS.push([name, b]);
    if (name === 'social-publish' && b.action === 'capabilities') return { data: ${JSON.stringify(CAP)}, error: null };
    if (name === 'social-publish' && b.action === 'remind_test') return { data: { ok: true, plan: { to: 'joy.dumansi@welfareavenue.com', slack: ':calendar: *Time to post on LinkedIn:* Volunteer call' } }, error: null };
    if (name === 'social-connect' && b.action === 'status') return { data: window.__CONN || ${JSON.stringify(CONN)}, error: null };
    if (name === 'social-connect' && b.action === 'meta_token') return { data: { ok: true, granted: ['pages_manage_posts'], missing: ['read_insights'] }, error: null };
    if (name === 'social-connect' && b.action === 'make_test') return { data: { ok: true, status: 200 }, error: null };
    if (name === 'social-connect' && b.action === 'start') return { data: { ok: true, url: '#studio/connections' }, error: null };
    if (name === 'social-inbox' && b.action === 'sync') return { data: { ok: true, platforms: { instagram: { read: 3, added: 2 } } }, error: null };
    return { data: { ok: true }, error: null };
  };
  window.__REC = function () {
    if (window.__RECON || typeof db === 'undefined') return; window.__RECON = true; window.__W = [];
    var of = db.from.bind(db), orpc = db.rpc.bind(db);
    db.from = function (t) { var b = of(t); ['insert', 'update', 'delete', 'upsert'].forEach(function (m) { var o = b[m]; b[m] = function (p) { window.__W.push([t, m, p === undefined ? null : JSON.parse(JSON.stringify(p))]); return o.apply(b, arguments); }; }); return b; };
    db.rpc = function (n, a) { if (/^studio_|^wa225_click/.test(n)) window.__W.push(['rpc', n, a]); return orpc(n, a); };
  };`;
const RAIL = () => { const r = document.getElementById('w153rail'); if (!r) return null; return { shown: getComputedStyle(r).display !== 'none', heads: [...r.querySelectorAll('.w153sh')].map(x => x.textContent), items: [...r.querySelectorAll('.w153it')].map(a => a.querySelector('span').textContent + (a.querySelector('.w153n') ? '(' + a.querySelector('.w153n').textContent + ')' : '') + (a.classList.contains('on') ? '*' : '')), title: (r.querySelector('.w153ah b') || {}).textContent }; };
const HOST = () => { const h = document.getElementById('w225host'); return h ? h.innerText.replace(/\s+/g, ' ').trim() : null; };
const W = () => window.__W || [];
const click = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);

(async () => {
  const browser = await launch();
  const FX = fx();
  const RP = { wa225_publisher: true, wa225_marketing: true, wa_org_editor: true };

  /* 1. an admin on a computer */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#studio', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RP, init: INIT, wait: 5000 });
    const p = f.page; await f.ev(() => window.__REC());
    let r = await f.ev(RAIL);
    ok('the app: Content Studio, four groups, Overview marked, Approvals counts 1, Comments counts 2', r && r.title === 'Content Studio' && r.heads.join('|') === 'Content|Toolkit|Results|Setup' && /Overview\*/.test(r.items[0]) && r.items.some(x => /^Approvals\(1\)/.test(x)) && r.items.some(x => /^Comments\(2\)/.test(x)), r);
    const ov = await f.ev(() => ({ kpis: [...document.querySelectorAll('#w225host .kpi')].map(k => k.innerText.replace(/\s+/g, ' ')), h1: (document.querySelector('#studio > .w118mast h1') || {}).textContent, has: document.body.classList.contains('w225has'), cc: (document.querySelector('#tabBar .tab[data-tab="contentcal"]') ? getComputedStyle(document.querySelector('#tabBar .tab[data-tab="contentcal"]')).display : 'missing'), order: window.WA_APP ? WA_APP.order.join(',') : '' }));
    ok('the Overview: six numbers (scheduled, approval 1, comments 2, goal, clicks, reach), the masthead', ov.kpis.length === 6 && /^1 waiting for approval/i.test(ov.kpis[1]) && /^2 comments to answer/i.test(ov.kpis[2]) && ov.h1 === 'Overview', ov);
    ok('the Hub menu leaves out the calendar for people with the app; the launcher puts the Studio after Fundraising', ov.has && ov.cc === 'none' && /fund,studio,hr/.test(ov.order), ov);
    let t = await f.ev(HOST);
    ok('the Overview lists the week ahead, the post waiting for approval, the goals and how each platform posts (LinkedIn via Make, TikTok by reminder)', /Sunday serving recap/.test(t) && /Volunteer call for October/.test(t) && /This week’s goals/i.test(t) && /Via Make/.test(t) && /Reminder/.test(t), t.slice(0, 600));
    ok('the Meta token warning names the missing permissions count', /missing 2 permissions/.test(t), t.slice(0, 2000));

    /* the queue */
    await f.hash('#studio/queue', 1500);
    r = await f.ev(RAIL); t = await f.ev(HOST);
    const qd = await f.ev(() => ({ slots: document.querySelectorAll('#w225host .slot').length, fills: document.querySelectorAll('#w225host [data-w225fill]').length, rows: document.querySelectorAll('#w225host .sched .pn').length, grid: document.querySelectorAll('#w225host .igg > div').length }));
    ok('Queue: marked in the rail, free slots with a Fill with an idea list, six platform rows, the Instagram grid', r.items.some(x => x === 'Queue and schedule*') && qd.slots >= 3 && qd.fills >= 1 && qd.rows === 6 && qd.grid >= 1, [r.items, qd]);
    await p.selectOption('#w225host [data-w225fill]', '4'); await p.waitForTimeout(500);
    let w = await f.ev(W);
    ok('filling a free slot with an idea dates the idea (scheduled_at at the slot)', w.some(x => x[0] === 'content_posts' && x[1] === 'update' && x[2].scheduled_at), w);
    await click(p, '#w225host [data-w225swd="2"]'); await click(p, '#w225host [data-w225swd="4"]');
    await p.selectOption('#w225spl', 'threads'); await p.fill('#w225sat', '19:30'); await click(p, '#w225host [data-w225slotadd]'); await p.waitForTimeout(500);
    w = await f.ev(W);
    const ins = w.filter(x => x[0] === 'content_slots' && x[1] === 'insert')[0];
    ok('adding a time: Threads on Wednesday and Friday at 19:30, two rows', ins && ins[2].length === 2 && ins[2].every(x => x.platform === 'threads' && x.at === '19:30') && ins[2].map(x => x.weekday).join() === '2,4', ins);
    await p.fill('#w225host [data-w225goal="threads"]', '2'); await click(p, '#w225host [data-w225goalsave]'); await p.waitForTimeout(400);
    w = await f.ev(W);
    const gs = w.filter(x => x[0] === 'rpc' && x[1] === 'studio_settings_save')[0];
    ok('saving the goals keeps the other settings and adds Threads 2', gs && gs[2].p_key === 'content_studio' && gs[2].p_value.goals.threads === 2 && gs[2].p_value.hashtag_cap === 5, gs);
    await click(p, '#w225host [data-w225sug]'); await p.waitForTimeout(300);
    t = await f.ev(HOST);
    ok('Suggest times answers honestly when there are not enough posts', /Hide the suggestions/.test(t), t.slice(-400));

    /* approvals */
    await f.hash('#studio/approvals', 1200);
    t = await f.ev(HOST);
    ok('Approvals: the waiting post with its note, the LinkedIn caption of its own, Approve and Send it back', /Volunteer call for October/.test(t) && /please check the tone/.test(t) && /looking for volunteers in Montreal/.test(t) && /Approve and schedule/.test(t) && /Send it back/.test(t), t.slice(0, 900));
    await click(p, '#w225host [data-w225dec^="changes|"]'); await p.waitForTimeout(300);
    const toastNote = await f.ev(() => (document.getElementById('toast') || {}).textContent || '');
    await p.fill('#w225host [data-w225apnote="2"]', 'Shorter, please'); await click(p, '#w225host [data-w225dec="approve|2"]'); await p.waitForTimeout(600);
    w = await f.ev(W);
    ok('sending back needs a note; Approve calls studio_decide', /note/.test(toastNote) && w.some(x => x[0] === 'rpc' && x[1] === 'studio_decide' && x[2].p_decision === 'approve' && x[2].p_id === 2 && x[2].p_note === 'Shorter, please'), [toastNote, w.filter(x => x[0] === 'rpc')]);
    await click(p, '#w225host [data-w225apr="changes"]'); await p.waitForTimeout(200); t = await f.ev(HOST);
    ok('the Sent back tab shows the donors post with the note', /Thank you donors/.test(t) && /Add the total raised/.test(t), t.slice(0, 500));

    /* comments */
    await f.hash('#studio/inbox', 1200);
    t = await f.ev(HOST);
    ok('Comments: the open ones grouped by post, our reply under Paul, the comment score, last check and the Threads error', /maria\.mtl/.test(t) && /Paul Tremblay/.test(t) && /Thank you Paul!/.test(t) && /comment score/i.test(t) && /Threads \(not connected\)/.test(t), t.slice(0, 900));
    await click(p, '#w225host [data-w225rp="1"]'); await p.waitForTimeout(200);
    await p.selectOption('#w225host [data-w225saved="1"]', '3'); await p.waitForTimeout(200);
    const rv = await f.ev(() => (document.querySelector('#w225host [data-w225rtext="1"]') || {}).value);
    ok('a saved reply fills the box with the handle', rv === 'Thank you @maria.mtl, that means a lot to the team.', rv);
    await click(p, '#w225host [data-w225send="1"]'); await p.waitForTimeout(500);
    let calls = await f.ev(() => window.__CALLS);
    ok('Send calls social-inbox reply with the text', calls.some(c => c[0] === 'social-inbox' && c[1].action === 'reply' && c[1].id === 1 && /maria/.test(c[1].text)), calls.slice(-3));
    await click(p, '#w225host [data-w225act="resolve|2"]'); await p.waitForTimeout(300);
    await click(p, '#w225host [data-w225sync]'); await p.waitForTimeout(500);
    calls = await f.ev(() => window.__CALLS);
    ok('Resolve and Check now go through social-inbox', calls.some(c => c[1].action === 'resolve' && c[1].id === 2) && calls.some(c => c[1].action === 'sync'), calls.slice(-4));
    const delBtn = await f.ev(() => !!document.querySelector('#w225host [data-w225act^="delete|"]'));
    ok('a publisher sees Delete', delBtn);

    /* library */
    await f.hash('#studio/library', 1200);
    r = await f.ev(RAIL); t = await f.ev(HOST);
    ok('Library: Templates first, the Sunday serving template with its platforms, the rail marks Library', /Templates/.test(t) && /Sunday serving/.test(t) && r.items.some(x => x === 'Library*'), [r.items, t.slice(0, 300)]);
    await click(p, '#w225host [data-w225luse="1"]'); await p.waitForTimeout(1500);
    const comp = await f.ev(() => { const d = document.getElementById('w121dr'); const c = document.getElementById('w121cap'); return { open: !!d && getComputedStyle(d).display !== 'none' && d.classList.length >= 0, cap: c ? c.value : null }; });
    ok('Use opens the composer with the template caption', comp.cap && /we served \{n\} meals/.test(comp.cap), comp);
    await f.ev(() => { var x = document.querySelector('#w121dr [data-w121close], #w121dr .x, #w121dr [aria-label="Close"]'); if (x) x.click(); });
    await f.hash('#studio/library/hashtags', 1200);
    await click(p, '#w225host [data-w225lnew="hashtags"]'); await p.waitForTimeout(200);
    await p.fill('#w225host [data-w225lf="name"]', 'Toronto'); await p.fill('#w225host [data-w225lf="body"]', '#Toronto #TO #a #b #c #d'); await p.waitForTimeout(400);
    t = await f.ev(HOST);
    ok('a hashtag group over five warns that Instagram keeps the first 5', /6 hashtags: Instagram keeps the first 5/.test(t), t.slice(0, 600));
    await click(p, '#w225host [data-w225lsave]'); await p.waitForTimeout(500);
    w = await f.ev(W);
    ok('Save writes the hashtag group', w.some(x => x[0] === 'content_snippets' && x[1] === 'insert' && x[2].kind === 'hashtags' && x[2].name === 'Toronto'), w.slice(-2));
    await f.hash('#studio/library/tags', 1200);
    t = await f.ev(HOST);
    ok('Tags: Kitchen counted on its posts', /Kitchen/.test(t) && /2 posts/.test(t), t.slice(0, 400));

    /* links */
    await f.hash('#studio/links', 1200);
    t = await f.ev(HOST);
    ok('Links: clicks in 30 days, the live links (the switched-off one hidden), the volunteer link with its post', /30\s*clicks, 30 days/i.test(t) && /Volunteer page/.test(t) && !/Old link/.test(t) && /From the post: Volunteer call/.test(t), t.slice(0, 900));
    await p.fill('#w225kurl', 'https://welfareavenue.com/events'); await p.fill('#w225klabel', 'Events'); await p.fill('#w225kcode', 'events26'); await click(p, '#w225host [data-w225kmake]'); await p.waitForTimeout(500);
    w = await f.ev(W);
    ok('Make it writes the short link with its ending', w.some(x => x[0] === 'short_links' && x[1] === 'insert' && x[2].code === 'events26' && x[2].url === 'https://welfareavenue.com/events'), w.slice(-2));
    await p.fill('#w225kurl', 'https://welfareavenue.com/x'); await p.fill('#w225kcode', 'bio-x'); await click(p, '#w225host [data-w225kmake]'); await p.waitForTimeout(300);
    const bt = await f.ev(() => (document.getElementById('toast') || {}).textContent || '');
    ok('bio- and lp- endings are kept for the link pages', /link pages/.test(bt), bt);
    await f.hash('#studio/links/bio', 1200);
    ok('the old link in bio address goes to Link pages', await f.ev(() => location.hash) === '#studio/pages', await f.ev(() => location.hash));

    /* report */
    await f.hash('#studio/report/2026-09', 1500);
    t = await f.ev(HOST);
    ok('Report for September: the title, posts out, reach, the best post, by platform', /Content report, September 2026/.test(t) && /posts out/i.test(t) && /September recap: 1,200 meals/.test(t) && /By platform/i.test(t), t.slice(0, 1200));
    await click(p, '#w225host [data-w225print]'); await p.waitForTimeout(300);
    const pr = await f.ev(() => window.__PRINTED);
    ok('Print sets the print class while printing', pr === true, pr);

    /* connections */
    await f.hash('#studio/connections?connected=threads', 1500);
    t = await f.ev(HOST);
    const cards = await f.ev(() => document.querySelectorAll('#w225host .cx > .card').length);
    ok('Connections: the Threads flash, seven cards, the redirect address, the Make filter code', /Threads is connected/.test(t) && cards === 7 && /functions\/v1\/social-connect/.test(t) && /abc123def0/.test(t), [cards, t.slice(0, 600)]);
    const hashNow = await f.ev(() => location.hash);
    ok('the flash clears the address', hashNow === '#studio/connections', hashNow);
    await p.fill('#w225cid-youtube', 'yt-client-1234.apps.googleusercontent.com'); await p.fill('#w225csec-youtube', 'GOCSPX-secret-value'); await click(p, '#w225host [data-w225cx="save_app|youtube"]'); await p.waitForTimeout(500);
    calls = await f.ev(() => window.__CALLS);
    const sa = calls.filter(c => c[1].action === 'save_app')[0];
    const cleared = await f.ev(() => ({ a: (document.getElementById('w225csec-youtube') || {}).value || '', b: (document.getElementById('w225cid-youtube') || {}).value || '' }));
    ok('Save the keys sends them to social-connect and empties the boxes', sa && sa[1].platform === 'youtube' && sa[1].secret === 'GOCSPX-secret-value' && cleared.a === '' && cleared.b === '', [sa, cleared]);
    await click(p, '#w225host [data-w225cx="make_test"]'); await p.waitForTimeout(500);
    calls = await f.ev(() => window.__CALLS);
    ok('a test post asks first, then sends confirm:true', calls.some(c => c[1].action === 'make_test' && c[1].confirm === true) && (await f.ev(() => window.__CONFIRMS)) >= 1, calls.slice(-2));
    await click(p, '#w225host [data-w225cx="remind_preview"]'); await p.waitForTimeout(500);
    t = await f.ev(HOST);
    ok('Preview a reminder shows who and the Slack text, sending nothing', /To: joy\.dumansi/.test(t) && /Time to post on LinkedIn/.test(t), t.slice(-500));
    await p.fill('#w225metatok', 'EAAB' + 'x'.repeat(60)); await click(p, '#w225host [data-w225cx="meta_save"]'); await p.waitForTimeout(600);
    const mt = await f.ev(() => (document.getElementById('w225metatok') || {}).value);
    ok('Replace the Meta token empties the box after saving', mt === '', mt);

    /* the composer (wave121, rebuilt by parts225): six platforms, the approval banner for a lead */
    await f.hash('#contentcal/2', 2200);
    const cm = await f.ev(() => { const d = document.getElementById('w121dr'); return d ? { pls: [...d.querySelectorAll('[data-w121pl]')].map(x => x.getAttribute('data-w121pl')), dec: [...d.querySelectorAll('[data-w225decide]')].map(x => x.getAttribute('data-w225decide')), saves: [...d.querySelectorAll('[data-w121save]')].map(x => x.getAttribute('data-w121save')) } : null; });
    ok('the composer: six platform toggles, Approve and Send back for a waiting post', cm && ['instagram', 'facebook', 'threads', 'linkedin', 'tiktok', 'youtube'].every(k => cm.pls.indexOf(k) >= 0) && cm.dec.indexOf('approve') >= 0 && cm.dec.indexOf('changes') >= 0, cm);
    await f.ev(() => { const x = document.querySelector('#w121dr [data-w121close]'); if (x) x.click(); }); await p.waitForTimeout(400);
    /* the calendar is in the app */
    await f.hash('#contentcal', 1800);
    r = await f.ev(RAIL);
    ok('the calendar opens inside the Studio (Calendar marked)', r && r.title === 'Content Studio' && r.items.some(x => x === 'Calendar*'), r);
    const tour = await f.ev(() => !!(window.w122 && w122.tours.contentstudio && w122.tours.contentstudio.steps.length >= 5) && /six|Threads/.test(JSON.stringify(w122.tours.contentcal.steps)));
    ok('the academy has a Content Studio tour and the calendar tour names the new platforms', tour);
    ok('no page errors (admin)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. a marketing member: no approving, no deleting */
  {
    const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#studio/approvals', fixture: JSON.parse(JSON.stringify(FX)), rpcs: { wa225_publisher: false, wa225_marketing: true }, init: INIT, wait: 5000 });
    let t = await f.ev(HOST);
    const d = await f.ev(() => ({ approve: !!document.querySelector('#w225host [data-w225dec]'), r: (document.getElementById('w153rail') || {}).innerText || '' }));
    ok('a member: Approvals explains sending for approval, no Approve buttons', /Scheduling a post sends it here/.test(t) && !d.approve, [t.slice(0, 300), d]);
    await f.hash('#studio/inbox', 1200);
    const del = await f.ev(() => ({ del: !!document.querySelector('#w225host [data-w225act^="delete|"]'), rp: !!document.querySelector('#w225host [data-w225rp]') }));
    ok('a member answers comments but does not delete them', !del.del && del.rp, del);
    await f.hash('#contentcal/new', 2200);
    const ms = await f.ev(() => [...document.querySelectorAll('#w121dr [data-w121save]')].map(x => x.getAttribute('data-w121save')));
    ok('a member\'s composer offers Send for approval, not Publish', ms.indexOf('submit') >= 0 && ms.indexOf('publish') < 0, ms);
    ok('no page errors (member)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. the board: no app */
  {
    const f = await fresh(browser, { who: 'board', width: 1366, hash: '#home', fixture: JSON.parse(JSON.stringify(FX)), rpcs: { wa225_publisher: false, wa225_marketing: false }, init: INIT, wait: 4500 });
    const b = await f.ev(() => ({ ok: window.WA_APP ? WA_APP.ok('studio') : null, has: document.body.classList.contains('w225has') }));
    ok('the board does not get the Studio', b.ok === false && !b.has, b);
    ok('no page errors (board)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 4. a phone */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#studio', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RP, init: INIT, wait: 5000 });
    const secs = ['#studio', '#studio/queue', '#studio/approvals', '#studio/inbox', '#studio/library', '#studio/pages', '#studio/links', '#studio/report', '#studio/connections'];
    const over = [];
    for (const s of secs) { await f.hash(s, 1100); const o = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth, host: !!document.getElementById('w225host') })); if (o.sw > o.w + 2 || !o.host) over.push([s, o]); }
    ok('a phone: every section fits the width', over.length === 0, over);
    await f.page.screenshot({ path: __dirname + '/shots_w225_phone.png' });
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  }
  /* 5. screenshots on a computer */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#studio', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RP, init: INIT, wait: 5000 });
    for (const s of ['', '/queue', '/inbox', '/report', '/connections']) { await f.hash('#studio' + s, 1300); await f.page.screenshot({ path: __dirname + '/shots_w225' + (s.replace(/\//g, '_') || '_overview') + '.png', fullPage: false }); }
    await f.close();
  }
  await browser.close();
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
