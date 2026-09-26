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
  const WANT = {
    admin: { top: ['mypage', 'overview', 'calendar'], goals: ['orggoals', 'goals', 'projects', 'goalmap', 'brain', 'bank'], meetings: ['agendas', 'transcripts'], inbox: ['requests', 'hubmail'], people: ['orgchart', 'training'], resources: ['importantinfo', 'photos'] },
    member: { top: ['mypage', 'overview', 'calendar'] },
    leader: { top: ['mypage', 'overview', 'calendar'] },
    board: { top: ['overview', 'calendar'] }
  };
  for (const who of ['admin', 'member', 'leader', 'board']) {
    const f = await fresh(browser, { who });
    const m = await f.ev(MENU);
    ok(who + ': the layout holds and no Strategy or More group is left', m.ok && !m.old, m);
    ok(who + ': Home, the Executive dashboard and the Calendar lead the menu', WANT[who].top.every((id, i) => m.top[i] === id), m.top);
    if (who === 'admin') {
      ['goals', 'meetings', 'inbox', 'people', 'resources'].forEach(g => ok('admin: ' + g + ' holds its pages in order', m.groups[g] && JSON.stringify(m.groups[g].items) === JSON.stringify(WANT.admin[g]), m.groups[g]));
      ok('admin: the group names read as the layout says', m.groups.goals && m.groups.goals.label === 'Goals and projects' && m.groups.inbox.label === 'Requests and inbox' && m.groups.resources.label === 'Resources' && m.groups.admin.label === 'Admin', m.groups);
      const adm = (m.groups.admin || {}).items || [];
      ok('admin: Admin lists its sections, People and access first, then Activity', adm[0] === 'sec:people' && adm[1] === 'sec:security' && adm.indexOf('activity') === adm.length - 1 && adm.indexOf('adminpanel') < 0, adm);
      ok('admin: Departments keep the seven teams', m.groups.departments && ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board'].every(d => m.groups.departments.items.indexOf(d) >= 0), m.groups.departments);
      await f.page.click('#tabBar .w118sub a[data-w118sec="people"]'); await f.page.waitForTimeout(1500);
      const a = await f.ev(() => ({ hash: location.hash, active: (document.querySelector('.panel.active') || {}).id, on: (document.querySelector('#tabBar .w118sub a.on') || {}).textContent }));
      ok('admin: an Admin section opens its page and is marked', a.hash === '#adminpanel/people' && a.active === 'adminpanel' && a.on === 'People and access', a);
      /* the crumbs follow the menu */
      const crumbs = {};
      for (const [h, sel] of [['#orggoals', '#orggoals .crumb'], ['#projects', '#projects .crumb'], ['#bank', '#bank .crumb'], ['#requests', '#requests > .w118mast .crumb'], ['#hubmail', '#hubmail .crumb'], ['#photos', '#photos .crumb'], ['#activity', '#activity > .w118mast .crumb'], ['#overview', '#overview > .w118mast .crumb']]) {
        await f.hash(h, 1500); crumbs[h] = await f.ev(s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; }, sel);
      }
      ok('admin: page crumbs name the menu group', crumbs['#orggoals'] === 'Goals and projects' && crumbs['#projects'] === 'Goals and projects' && crumbs['#bank'] === 'Goals and projects' && crumbs['#requests'] === 'Requests and inbox' && crumbs['#hubmail'] === 'Requests and inbox' && crumbs['#photos'] === 'Resources' && crumbs['#activity'] === 'Admin' && crumbs['#overview'] === 'Home', crumbs);
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
    if (who === 'leader') ok('leader: Admin shows Activity only', m.groups.admin && JSON.stringify(m.groups.admin.items) === '["activity"]', m.groups.admin);
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
    ok('the check-in note says Don’t forget to check in', n && /Don’t forget to check in/.test(n.text) && !n.hasOld && /Check in/.test(n.text) && /Not now/.test(n.text), n);
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
