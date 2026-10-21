/* w134drive.js: the audit release (wave134). Menu layout for four identities, the Ask the Hub E, the check-in note,
   Important info passwords by request, the Executive dashboard's Coming up, page crumbs, esc() quoting and the public
   confirmation page. Uses test/boot.js (live-data fixture, stubbed Supabase, clock fixed at 2026-09-25 16:00 Toronto). */
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }
const MENU = () => { const vis = el => !!(el && (el.offsetParent || el.getClientRects().length)) && getComputedStyle(el).display !== 'none';
  const bar = document.getElementById('tabBar'); const res = { top: [], groups: {} };
  Array.from(bar.children).forEach(el => {
    if (el.classList.contains('tab')) { if (vis(el)) res.top.push(el.getAttribute('data-tab')); return; }
    if (!el.classList.contains('tab-group') || !vis(el)) return;
    const h = el.querySelector(':scope > .tab-group-h');
    res.groups[el.getAttribute('data-w42g')] = { label: h ? h.textContent.replace(/▼/g, '').trim() : '', items: Array.from(el.querySelectorAll('.tab, .w118sub a')).filter(vis).map(x => x.getAttribute('data-tab') || ('sec:' + x.getAttribute('data-w118sec'))) };
  });
  res.ok = !!(window.w134 && window.w134.ok()); res.old = !!bar.querySelector(':scope > .tab-group[data-w42g="strategy"], :scope > .tab-group[data-w42g="more"]');
  return res; };
/* the info_* functions as the database runs them, on the fixture */
const INFO_MOCK = `(function(){ window.__RPC = []; var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.rpc || db.rpc.__w) return; var orig = db.rpc.bind(db);
  function A(){ return (window.__WAFIX.info_link_access = window.__WAFIX.info_link_access || []); }
  var f = function(fn, a){ a = a || {}; window.__RPC.push({ fn: fn, args: JSON.parse(JSON.stringify(a)) });
    var me = String(window.__WA_TEST_EMAIL || '').toLowerCase();
    if (fn === 'info_secret') { var ok = window.__ADMIN || A().some(function(x){ return String(x.link_id) === String(a.p_link_id) && x.email === me && x.status === 'granted'; }); return Promise.resolve(ok ? { data: { id: a.p_link_id, username: 'u', secret: 'TEST-SECRET' }, error: null } : { data: null, error: { message: 'Request access to see this password' } }); }
    if (fn === 'info_request') { var r = A().filter(function(x){ return String(x.link_id) === String(a.p_link_id) && x.email === me; })[0]; if (r) { r.status = 'requested'; r.note = a.p_note; } else A().push({ id: 900 + A().length, link_id: a.p_link_id, email: me, status: 'requested', note: a.p_note, requested_at: new Date().toISOString() }); return Promise.resolve({ data: 'requested', error: null }); }
    if (fn === 'info_decide') { var d = A().filter(function(x){ return String(x.id) === String(a.p_access_id); })[0]; if (d) d.status = a.p_status; return Promise.resolve({ data: a.p_status, error: null }); }
    if (fn === 'info_grant') { A().push({ id: 950 + A().length, link_id: a.p_link_id, email: a.p_email, status: 'granted', requested_at: new Date().toISOString(), decided_by: me }); return Promise.resolve({ data: 'granted', error: null }); }
    return orig(fn, a); }; f.__w = 1; db.rpc = f; }, 5); })();`;

(async () => {
  const browser = await launch();
  /* 1. the menu, for each identity */
  /* wave163: Avenue Academy under Home, The Brain after the Calendar, then Departments, Other Tools and Organization;
     the goal pages are the Strategy app and Partners is in the CRM (wave153 keeps them out of the menu) */
  const WANT = {
    /* 09/10/26: Team Requests sits above the Calendar; wave260 (16/10/26): the Executive dashboard is for the admins and
       app_config dashboard_people (the fixture's leader is Shima, who is named there), so members and directors do not have it */
    /* wave262 (21/10/26): The Brain moved into More (first in Other Tools); the tests open More (wa262.more) to see its groups */
    admin: { top: ['mypage', 'training', 'overview', 'requests', 'calendar'], tools: ['brain', 'importantinfo', 'bank', 'agendas', 'documents', 'transcripts', 'photos'], org: ['orgchart', 'ourstory', 'hubmail'] },
    member: { top: ['mypage', 'training', 'requests', 'calendar'] },
    leader: { top: ['mypage', 'training', 'overview', 'requests', 'calendar'] },
    board: { top: ['calendar'] }
  };
  for (const who of ['admin', 'member', 'leader', 'board']) {
    const f = await fresh(browser, { who, init: "try { localStorage.setItem('wa262.more', '1'); } catch (e) {}" });
    const m = await f.ev(MENU);
    ok(who + ': the layout holds and no Strategy or More group is left', m.ok && !m.old, m);
    ok(who + ': ' + (who === 'board' ? 'the Calendar leads' : (who === 'member' ? 'Home, Avenue Academy, Team Requests and the Calendar lead' : 'Home, Avenue Academy, the Executive dashboard, Team Requests and the Calendar lead')) + ' the menu', WANT[who].top.every((id, i) => m.top[i] === id), m.top);
    if (who === 'admin') {
      ['tools', 'org'].forEach(g => ok('admin: ' + g + ' holds its pages in order', m.groups[g] && JSON.stringify(m.groups[g].items) === JSON.stringify(WANT.admin[g]), m.groups[g]));
      ok('admin: the group names read as the layout says (Other Tools, Organization; no Goals and projects, Meetings, Requests and inbox, People or Resources)', m.groups.tools && m.groups.tools.label === 'Other Tools' && m.groups.org && m.groups.org.label === 'Organization' && !['goals', 'meetings', 'inbox', 'people', 'resources', 'apps'].some(g => m.groups[g]), m.groups);
      /* wave153: the Admin sections live in the Admin centre app; the group stays in the DOM (access and routing) but leaves the menu */
      const adm = await f.ev(() => ({ shown: !!document.querySelector('#tabBar .tab-group[data-w42g="admin"]') && getComputedStyle(document.querySelector('#tabBar .tab-group[data-w42g="admin"]')).display !== 'none', app: window.w153 ? window.w153.items('admin').map(g => g.items.map(i => i.h)).flat() : [] }));
      ok('admin: Admin\'s sections are out of the menu and in the Admin centre app, People and access first, then Activity last', !m.groups.admin && !adm.shown && adm.app[0] === '#adminpanel/people' && adm.app[adm.app.length - 1] === '#activity', adm);
      ok('admin: Departments keep the seven teams', m.groups.departments && ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board'].every(d => m.groups.departments.items.indexOf(d) >= 0), m.groups.departments);
      /* wave153: the section opens from the Admin centre app's rail (the menu's own link is hidden) */
      await f.ev(() => window.w153.open('admin')); await f.page.waitForTimeout(1500);
      const a = await f.ev(() => ({ hash: location.hash, active: (document.querySelector('.panel.active') || {}).id, on: (document.querySelector('#tabBar .w118sub a.on') || {}).textContent, rail: (document.querySelector('#w153rail .w153it.on') || {}).textContent }));
      ok('admin: an Admin section opens its page and is marked (in the app rail and the hidden menu link)', a.hash === '#adminpanel/people' && a.active === 'adminpanel' && a.on === 'People and access' && /People and access/.test(a.rail || ''), a);
      await f.ev(() => window.w153.close()); await f.page.waitForTimeout(800);
      /* the crumbs follow the menu */
      const crumbs = {};
      for (const [h, sel] of [['#orggoals', '#orggoals .crumb'], ['#projects', '#projects .crumb'], ['#bank', '#bank .crumb'], ['#requests', '#requests > .w118mast .crumb'], ['#hubmail', '#hubmail .crumb'], ['#photos', '#photos .crumb'], ['#activity', '#activity > .w118mast .crumb'], ['#overview', '#overview > .w118mast .crumb']]) {
        await f.hash(h, 1500); crumbs[h] = await f.ev(s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; }, sel);
      }
      ok('admin: page crumbs name the menu group', crumbs['#orggoals'] === 'Strategy' && crumbs['#projects'] === 'Strategy' && crumbs['#bank'] === 'Other Tools' && crumbs['#requests'] === 'Home' && crumbs['#hubmail'] === 'Organization' && crumbs['#photos'] === 'Other Tools' && crumbs['#activity'] === 'Admin' && crumbs['#overview'] === 'Home', crumbs);
      /* the Executive dashboard: Coming up does not repeat the brief's Next up */
      await f.hash('#overview', 2500);
      /* the same event on the same day in both lists would be a repeat (a later serving with the same name is not) */
      const d = await f.ev(() => { const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
        const nx = Array.from(document.querySelectorAll('.w128brief .nx .it')).map(el => ({ day: txt(el.querySelector('.dt')), t: txt(el.querySelector('.w')).replace(/^(Board|Fundraising|Serving)/, '').trim() }));
        const cu = Array.from(document.querySelectorAll('.w128next .w128n')).map(el => ({ day: txt(el.querySelector('.dt')), t: txt(el.querySelector('.tx')) }));
        return { nx, cu }; });
      const dup = d.nx.filter(n => d.cu.some(c => c.day === n.day && n.t && c.t.indexOf(n.t) >= 0));
      ok('the dashboard: Coming up leaves out what Next up shows', d.nx.length > 0 && dup.length === 0, d);
      /* esc() quotes attribute values */
      const e = await f.ev(() => ({ a: esc('a"b\'c<d>&'), b: escapeHtml('x"y') }));
      ok('esc() and escapeHtml() escape quotes', e.a === 'a&quot;b&#39;c&lt;d&gt;&amp;' && e.b === 'x&quot;y', e);
    }
    if (who === 'member') ok('member: no Admin group', !m.groups.admin, m.groups);
    if (who === 'leader') { const la = await f.ev(() => ({ ok: window.w153.ok('admin'), items: window.w153.items('admin').map(g => g.items.map(i => i.h)).flat() })); ok('leader: no Admin group in the menu; the Admin centre app offers Activity only (wave153)', !m.groups.admin && la.ok && JSON.stringify(la.items) === '["#activity"]', { admin: m.groups.admin, la }); }
    if (who === 'board') ok('board: a Board group with Board overview and Committees', m.groups.board && m.groups.board.items.indexOf('governance') >= 0 && m.groups.board.items.indexOf('committees') >= 0, m.groups.board);
    ok(who + ': no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. Ask the Hub: the brand E is the E of THE */
  { const f = await fresh(browser, { who: 'admin' });
    await f.page.mouse.move(5, 5); await f.page.waitForTimeout(600);
    const rest = await f.ev(() => { const b = document.getElementById('waChatBtn'); const w = s => Math.round((b.querySelector(s) || { getBoundingClientRect: () => ({ width: -1 }) }).getBoundingClientRect().width); return { w: Math.round(b.getBoundingClientRect().width), a: w('.w134a'), b: w('.w134b'), e: !!b.querySelector('.w134w .w134e svg.w117ei'), lbl: b.getAttribute('aria-label'), old: getComputedStyle(b.querySelector('.w130lbl')).display }; });
    ok('Ask the Hub at rest: the E alone, the words closed', rest.w <= 60 && rest.a === 0 && rest.b === 0 && rest.e && rest.lbl === 'Ask the Hub' && rest.old === 'none', rest);
    await f.page.hover('#waChatBtn'); await f.page.waitForTimeout(700);
    const hov = await f.ev(() => { const b = document.getElementById('waChatBtn'); const r = s => b.querySelector(s).getBoundingClientRect(); const a = r('.w134a'), e = r('.w134e'), z = r('.w134b'); return { w: Math.round(b.getBoundingClientRect().width), order: a.right <= e.left + 1 && e.right <= z.left + 1, a: Math.round(a.width), b: Math.round(z.width), text: b.querySelector('.w134a').textContent + '[E]' + b.querySelector('.w134b').textContent }; });
    ok('Ask the Hub on hover: ASK TH, the E, HUB in that order', hov.w > 120 && hov.a > 30 && hov.b > 20 && hov.order && hov.text === 'Ask th[E]Hub', hov);
    await f.close(); }

  /* 3. the check-in note */
  { const f = await fresh(browser, { who: 'admin', init: "try { localStorage.removeItem('w118bSnooze'); localStorage.removeItem('w118bSeen'); } catch (e) {}", wait: 4500 });
    const n = await f.ev(() => { const el = document.getElementById('w118ck'); return el ? { text: el.textContent.replace(/\s+/g, ' ').trim(), hasOld: /hours count/i.test(el.textContent) } : null; });
    /* wave192: the note speaks The Loop (Starting some work? I'm in) */
    ok('the note under the Loop button asks Starting some work? with I’m in', n && /Starting some work\?/.test(n.text) && !n.hasOld && /I’m in/.test(n.text) && /Not now/.test(n.text), n);
    await f.close(); }

  /* 4. Important info: the list for everyone, passwords by request */
  const pwId = await (async () => { const f = await fresh(browser, { who: 'admin' }); const id = await f.ev(() => ((window.__WAFIX.info_links || []).filter(r => r.kind === 'password')[0] || {}).id); await f.close(); return id; })();
  { const f = await fresh(browser, { who: 'member', init: INFO_MOCK + "window.__ADMIN = false;" });
    await f.hash('#importantinfo', 2500);
    const s1 = await f.ev(id => { const row = document.querySelector('#infoBody [data-w134row="' + id + '"]'); return { row: !!row, ask: !!(row && row.querySelector('[data-w134ask]')), show: !!(row && row.querySelector('[data-w134show]')), note: (document.querySelector('#infoBody .pw-note') || {}).textContent || '', secretInDom: document.getElementById('infoBody').innerHTML.indexOf('TEST-SECRET') >= 0, links: document.querySelectorAll('#infoBody .info-row').length }; }, pwId);
    ok('member: sees the whole list, the login with Request access and no Show', s1.row && s1.ask && !s1.show && s1.links > 5 && /Request access/.test(s1.note) && !s1.secretInDom, s1);
    await f.page.click('#infoBody [data-w134ask="' + pwId + '"]'); await f.page.waitForTimeout(300);
    await f.page.fill('#w134why', 'For the Canva posts'); await f.page.click('#infoBody [data-w134send]'); await f.page.waitForTimeout(900);
    const s2 = await f.ev(id => ({ rpc: window.__RPC.filter(c => c.fn === 'info_request').map(c => c.args), chip: ((document.querySelector('#infoBody [data-w134row="' + id + '"] .w134chip') || {}).textContent || '') }), pwId);
    ok('member: Request access sends the request with the reason and shows it waiting', s2.rpc.length === 1 && s2.rpc[0].p_note === 'For the Canva posts' && /waiting for an admin/.test(s2.chip), s2);
    await f.close(); }
  { const f = await fresh(browser, { who: 'admin', init: INFO_MOCK + "window.__ADMIN = true; window.__WAFIX_SEED = 1;" });
    await f.ev(id => { window.__WAFIX.info_link_access = [{ id: 7001, link_id: id, email: 'samson.jules@welfareavenue.com', status: 'requested', note: 'For the Canva posts', requested_at: new Date(Date.now() - 86400000).toISOString() }]; }, pwId);
    await f.hash('#importantinfo', 2500);
    const s3 = await f.ev(() => ({ req: ((document.querySelector('#infoBody .w134req') || {}).textContent || '').replace(/\s+/g, ' '), badge: ((document.querySelector('#tabBar .tab[data-tab="importantinfo"] .w134n') || {}).textContent || '') }));
    ok('admin: the request waits on the page, with its reason, and the menu counts it', /1 request to see a password/.test(s3.req) && /asked for/.test(s3.req) && /For the Canva posts/.test(s3.req) && s3.badge === '1', s3);
    await f.page.click('#infoBody [data-w134decide="7001"][data-s="granted"]'); await f.page.waitForTimeout(900);
    const s4 = await f.ev(() => ({ rpc: window.__RPC.filter(c => c.fn === 'info_decide').map(c => c.args), req: !!document.querySelector('#infoBody .w134req'), badge: !!document.querySelector('#tabBar .tab[data-tab="importantinfo"] .w134n') }));
    ok('admin: Grant decides it and clears the request and the count', s4.rpc.length === 1 && s4.rpc[0].p_status === 'granted' && !s4.req && !s4.badge, s4);
    await f.page.click('#infoBody [data-w134show="' + pwId + '"]'); await f.page.waitForTimeout(700);
    const s5 = await f.ev(id => ({ shown: ((document.querySelector('#infoBody [data-sec="' + id + '"]') || {}).textContent || ''), rpc: window.__RPC.filter(c => c.fn === 'info_secret').length, who: ((document.querySelector('#infoBody [data-w134who="' + id + '"]') || {}).textContent || '') }), pwId);
    ok('admin: Show asks the database for the password and shows it; who can see it is counted', s5.shown === 'TEST-SECRET' && s5.rpc === 1 && /1 person can see it/.test(s5.who), s5);
    ok('admin: no page errors on Important info', f.errs.length === 0, f.errs);
    await f.close(); }

  /* 5. the public confirmation page loads (it waited for window.db, which never exists) */
  { const f = await fresh(browser, { who: 'admin', hash: '#confirm/test-token', rpcs: { wa_org_editor: true, volunteer_confirm_get: { name: 'Test Volunteer', role: 'server', event_title: 'Sunday serving', event_date: '2026-10-04' } }, wait: 3500 });
    const c = await f.ev(() => { const b = document.getElementById('wa31body'); return b ? b.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : null; });
    ok('the confirmation page no longer ends on Could not load', c !== null && !/Could not load/.test(c), c);
    await f.close(); }

  await browser.close();
  out.forEach(l => console.log(l));
  console.log('w134 ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
