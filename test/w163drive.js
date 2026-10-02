/* w163drive.js: wave163. The menu shows once, whole (no change after it shows, on a slow load too), and the phone menu
   (Home, Calendar, Ask, My team, Menu; the sheet with Find a page, the apps and every section; the app's own menu inside
   an app; Ask the Hub full screen with the bar put away). Uses test/boot.js (live-data fixture, stubbed Supabase, clock
   fixed at 2026-09-25 16:00 Toronto). The layout itself is w134drive; Partners' types are w140drive. */
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }
const BAR = () => { const b = document.getElementById('w163bar'); if (!b) return null;
  return { shown: getComputedStyle(b).display !== 'none', slots: [...b.querySelectorAll('button')].map(x => x.getAttribute('data-w163slot') + ':' + x.textContent.trim() + (x.classList.contains('on') ? '*' : '')) }; };
const SHEET = () => { const s = document.getElementById('w163sheet'); if (!s) return null;
  return { on: s.classList.contains('on'), title: (s.querySelector('.hd h2') || {}).textContent, secs: [...s.querySelectorAll('.sh')].map(x => x.textContent), apps: [...s.querySelectorAll('.app')].map(a => a.textContent.trim() + (a.classList.contains('on') ? '*' : '')),
    rows: [...s.querySelectorAll('.it')].map(r => (r.querySelector('.lb') || r).childNodes[0].textContent.trim() + (r.classList.contains('on') ? '*' : '') + (r.querySelector('.mine') ? '(mine)' : '')), chips: [...s.querySelectorAll('.chip')].map(c => c.textContent), back: !!s.querySelector('.back') }; };

(async () => {
  const browser = await launch();

  /* 1. the menu shows once, whole: desktop, three identities */
  for (const who of ['admin', 'member', 'board']) {
    const f = await fresh(browser, { who, wait: 4500 });
    const g = await f.ev(() => ({ ready: document.documentElement.classList.contains('w163nav'), st: window.w163.state(), op: getComputedStyle(document.getElementById('tabBar')).opacity, vis: getComputedStyle(document.getElementById('tabBar')).visibility, lay: window.w134.ok(), dir: document.documentElement.classList.contains('w163dir') }));
    ok(who + ': the menu shows once the Hub has started, laid out, and nothing in it moves after', g.ready && /started/.test(g.st.why) && g.st.after === 0 && g.op === '1' && g.vis === 'visible' && g.lay, g);
    ok(who + ': directors are marked as such (they keep Partners in their menu), nobody else', g.dir === (who === 'board'), g);
    const d = await f.ev(() => ({ bar: getComputedStyle(document.getElementById('w163bar') || document.body).display }));
    ok(who + ': no phone bar on a desktop', d.bar === 'none', d);
    await f.close();
  }

  /* 2. a slow load: every request takes 250 to 750 ms; the menu is out of sight until it is whole, then never changes */
  {
    const init = `window.__WA_LAT = 500; window.__menuMoves = 0; window.__menuShown = null;
      (function(){ var last = ''; function sig(){ var b = document.getElementById('tabBar'); if (!b) return ''; return [].map.call(b.querySelectorAll('.tab, .tab-group'), function (el) { return (el.getAttribute('data-tab') || el.getAttribute('data-w42g')) + (el.style.display === 'none' ? '-' : '+'); }).join(','); }
        var iv = setInterval(function(){ var s = sig(); var shown = document.documentElement.classList.contains('w163nav'); if (shown && window.__menuShown === null) window.__menuShown = s; if (shown && s !== last && last) window.__menuMoves++; last = s; }, 30); setTimeout(function(){ clearInterval(iv); }, 30000); })();`;
    const f = await fresh(browser, { who: 'admin', wait: 16000, init });
    const s = await f.ev(() => ({ moves: window.__menuMoves, shown: !!window.__menuShown, st: window.w163.state(), ready: document.documentElement.classList.contains('wa-ready') }));
    ok('a slow load: the menu shows once and does not change after (' + (s.st && s.st.at) + ' ms)', s.shown && s.moves === 0 && s.st.after === 0 && s.ready, s);
    await f.close();
  }

  /* 3. the phone bar and the sheet, as an admin (Steel's team is the board) */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, height: 844, wait: 5000 });
    const p = f.page;
    let b = await f.ev(BAR);
    ok('phone: the bar reads Home, Calendar, Ask, My team, Menu, with Home lit', b && b.shown && b.slots.join('|') === 'home:Home*|cal:Calendar|ask:Ask|team:My team|menu:Menu', b);
    const old = await f.ev(() => getComputedStyle(document.getElementById('w114bar')).display);
    ok('phone: the old bar is put away', old === 'none', old);
    await p.click('#w163bar [data-w163slot="menu"]'); await p.waitForTimeout(450);
    let s = await f.ev(SHEET);
    ok('Menu opens the sheet: the apps (and the Website link, 01/10/26), then the top pages and Departments, Other Tools and Organization, the page you are on lit', s.on && s.title === 'Menu' && s.apps.join('|') === 'Hub*|Strategy|Volunteer Manager|CRM|HR centre|Finance|Admin centre|Website' && s.secs.join('|') === 'Apps|Departments|Other Tools|Organization' && s.rows.slice(0, 5).join('|') === 'Home*|Avenue Academy|Executive dashboard|Calendar|The Brain', s);
    ok('the sheet: every team with its own pages as chips, yours marked; Other Tools and Organization in the menu\'s order', s.rows.indexOf('Board & Governance(mine)') >= 0 && s.chips.indexOf('MTL volunteering') < 0 /* wave176: an app now */ && s.chips.indexOf('Content calendar') >= 0 && s.rows.join('|').indexOf('Important info|The Task Bank|Agendas|Document finder|Transcript archive|Photo library|Requests|Org chart|Our story|Hub inbox') >= 0, s);
    /* 01/10/26: the Website tile after the apps: a real link in its own list item, opening a new tab and closing the sheet */
    const wt = await f.ev(() => { const a = document.querySelector('#w163sheet [data-w163ext="website"]'); if (!a) return null; const r = a.querySelector('.t').getBoundingClientRect();
      return { tag: a.tagName, href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), aria: a.getAttribute('aria-label'), li: a.parentElement.getAttribute('role'), size: [Math.round(r.width), Math.round(r.height)], icon: getComputedStyle(a.querySelector('.t')).color, deco: getComputedStyle(a).textDecorationLine }; });
    ok('phone: the Website tile is a link to welfareavenue.com in its own list item, sized like the apps, said to open in a new tab', !!wt && wt.tag === 'A' && wt.href === 'https://welfareavenue.com/' && wt.target === '_blank' && /noopener/.test(wt.rel) && /new tab/.test(wt.aria) && wt.li === 'listitem' && wt.size[0] === 52 && wt.size[1] === 52 && wt.icon === 'rgb(16, 63, 57)' && wt.deco === 'none', wt);
    await f.ctx.route('https://welfareavenue.com/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Welfare Avenue (test)</title><p>test</p>' }));
    const hb = await f.ev(() => location.hash);
    const [wtab] = await Promise.all([f.ctx.waitForEvent('page', { timeout: 10000 }), p.click('#w163sheet [data-w163ext="website"]')]);
    await wtab.waitForLoadState('domcontentloaded').catch(() => {});
    await p.waitForTimeout(400);
    const ha = await f.ev(() => ({ hash: location.hash, on: document.getElementById('w163sheet').classList.contains('on') }));
    ok('phone: tapping it opens welfareavenue.com in a new tab and closes the sheet; the Hub stays on the same page', wtab.url() === 'https://welfareavenue.com/' && !ha.on && ha.hash === hb, { url: wtab.url(), ha, hb });
    await wtab.close();
    await p.click('#w163bar [data-w163slot="menu"]'); await p.waitForTimeout(450);
    const lay = await f.ev(() => { const s = document.getElementById('w163sheet'); const r = s.getBoundingClientRect(); const x = s.querySelector('.x').getBoundingClientRect(); return { full: Math.round(r.top) === 0 && Math.round(r.height) === window.innerHeight, x: [Math.round(x.width), Math.round(x.height)], bar: getComputedStyle(document.getElementById('w163bar')).display, lock: document.body.classList.contains('w163sheet') }; });
    ok('the sheet fills the screen, its close button is a 42 px target, the bar steps aside and the page does not scroll behind', lay.full && lay.x[0] >= 40 && lay.bar === 'none' && lay.lock, lay);
    await p.fill('#w163sheet [data-w163q]', 'goal'); await p.waitForTimeout(250);
    s = await f.ev(SHEET);
    ok('Find a page finds the apps\' pages too (Organizational goals and Department goals are in Strategy)', s.rows.indexOf('Organizational goals') >= 0 && s.rows.indexOf('Department goals') >= 0 && s.rows.indexOf('Goal alignment') >= 0, s.rows);
    await p.fill('#w163sheet [data-w163q]', 'task bank'); await p.waitForTimeout(250);
    s = await f.ev(SHEET);
    ok('Find a page: The Task Bank by its name', s.rows.length === 1 && s.rows[0] === 'The Task Bank', s.rows);
    await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
    let h = await f.ev(() => ({ hash: location.hash, active: (document.querySelector('.panel.active') || {}).id, on: document.getElementById('w163sheet').classList.contains('on') }));
    ok('Enter opens the first result and closes the sheet', h.hash === '#bank' && h.active === 'bank' && !h.on, h);
    b = await f.ev(BAR);
    ok('on a page that is not in the bar, Menu is lit', b.slots[4] === 'menu:Menu*' && b.slots.filter(x => /\*$/.test(x)).length === 1, b);
    await p.click('#w163bar [data-w163slot="team"]'); await p.waitForTimeout(1500);
    h = await f.ev(() => ({ hash: location.hash, active: (document.querySelector('.panel.active') || {}).id }));
    b = await f.ev(BAR);
    ok('My team opens your team\'s page and lights up', /^#(board|governance|team\/board)/.test(h.hash) && b.slots[3] === 'team:My team*', { h, b });
    await p.click('#w163bar [data-w163slot="cal"]'); await p.waitForTimeout(1500);
    b = await f.ev(BAR);
    ok('Calendar opens the Calendar and lights up', (await f.ev(() => location.hash)) === '#calendar' && b.slots[1] === 'cal:Calendar*', b);
    /* a chip opens that team page's own page */
    await p.click('#w163bar [data-w163slot="menu"]'); await p.waitForTimeout(400);
    await f.ev(() => { const c = [...document.querySelectorAll('#w163sheet .chip')].filter(x => x.textContent === 'Content calendar')[0]; if (c) c.click(); }); await p.waitForTimeout(1500);
    h = await f.ev(() => ({ hash: location.hash, active: (document.querySelector('.panel.active') || {}).id }));
    ok('a chip opens the team\'s own page (Content calendar)', h.active === 'contentcal', h);
    /* inside an app the sheet is the app's menu */
    await f.hash('#crm', 2500);
    await p.click('#w163bar [data-w163slot="menu"]'); await p.waitForTimeout(450);
    s = await f.ev(SHEET);
    ok('inside the CRM the sheet is the CRM\'s menu (Partners after Contacts), with Back to the Hub', s.title === 'CRM' && s.back && s.apps.indexOf('CRM*') >= 0 && s.rows.slice(0, 2).join('|') === 'Contacts*|Partners', s);
    await f.ev(() => { const r = [...document.querySelectorAll('#w163sheet .it')].filter(x => /Partners/.test(x.textContent))[0]; if (r) r.click(); }); await p.waitForTimeout(1800);
    h = await f.ev(() => ({ hash: location.hash, active: (document.querySelector('.panel.active') || {}).id, app: document.body.classList.contains('w153crm') }));
    ok('Partners opens inside the CRM', h.hash === '#partners' && h.active === 'partners' && h.app, h);
    const mb = await f.ev(() => { const m = document.querySelector('#w153bar .w153menu'); return m ? getComputedStyle(m).display : 'none'; });
    ok('the app bar\'s own Menu button is gone on a phone (the bar\'s Menu does it)', mb === 'none', mb);
    await p.click('#w163bar [data-w163slot="menu"]'); await p.waitForTimeout(400);
    await p.click('#w163sheet [data-w163back]'); await p.waitForTimeout(1500);
    h = await f.ev(() => ({ hash: location.hash, app: document.body.classList.contains('w153app') }));
    ok('Back to the Hub leaves the app', !h.app, h);
    /* an app tile opens the app */
    await p.click('#w163bar [data-w163slot="menu"]'); await p.waitForTimeout(400);
    await p.click('#w163sheet [data-w163app="strategy"]'); await p.waitForTimeout(1800);
    h = await f.ev(() => ({ hash: location.hash, app: document.body.classList.contains('w153strategy') }));
    ok('the Strategy tile opens the Strategy app on Organizational goals', h.hash === '#orggoals' && h.app, h);
    /* Esc and the close button */
    await p.click('#w163bar [data-w163slot="menu"]'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(350);
    const e1 = await f.ev(() => document.getElementById('w163sheet').classList.contains('on'));
    await p.click('#w163bar [data-w163slot="menu"]'); await p.waitForTimeout(300); await p.click('#w163sheet [data-w163close]'); await p.waitForTimeout(350);
    const e2 = await f.ev(() => document.getElementById('w163sheet').classList.contains('on'));
    ok('Esc and the close button close the sheet', !e1 && !e2, { e1, e2 });
    /* Ask the Hub: full screen, the bar steps aside so its message box can be reached */
    await p.click('#w163bar [data-w163slot="ask"]'); await p.waitForTimeout(900);
    const c = await f.ev(() => { const i = document.getElementById('w38in'); const r = i ? i.getBoundingClientRect() : null; const top = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null; return { bar: getComputedStyle(document.getElementById('w163bar')).display, box: !!r && r.height > 20, reach: !!top && (top === i || i.contains(top)) }; });
    ok('Ask opens Ask the Hub and the bar steps aside, so its message box can be tapped', c.bar === 'none' && c.box && c.reach, c);
    await f.ev(() => { const p = document.getElementById('waChatPanel'); p.style.display = 'none'; }); await p.waitForTimeout(300);
    const c2 = await f.ev(() => getComputedStyle(document.getElementById('w163bar')).display);
    ok('the bar comes back when Ask the Hub closes', c2 === 'grid', c2);
    ok('no page errors (admin, phone)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 4. a member on the HR profile, a small phone */
  {
    const f = await fresh(browser, { who: 'member', width: 360, height: 800, wait: 5000 });
    const p = f.page;
    await p.click('#w163bar [data-w163slot="team"]'); await p.waitForTimeout(1500);
    const h = await f.ev(() => location.hash);
    const b = await f.ev(BAR);
    ok('member: My team opens Human Resources and lights up', h === '#team/hr' && b.slots[3] === 'team:My team*', { h, b });
    await p.click('#w163bar [data-w163slot="menu"]'); await p.waitForTimeout(400);
    const s = await f.ev(SHEET);
    ok('member: only the apps they can open (then the Website link), and no Hub inbox', s.apps.join('|') === 'Hub*|Strategy|Volunteer Manager|CRM|HR centre|Website' && s.rows.indexOf('Hub inbox') < 0 && s.rows.indexOf('Human Resources*(mine)') >= 0, s);
    const fit = await f.ev(() => { const s = document.getElementById('w163sheet'); return s.scrollWidth <= window.innerWidth + 1 && document.getElementById('w163bar').scrollWidth <= window.innerWidth + 1; });
    ok('member: the sheet and the bar fit a 360 px screen', fit, fit);
    ok('no page errors (member, phone)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 5. a director: no Home, no apps; Dashboard, Calendar, Board, Menu */
  {
    const f = await fresh(browser, { who: 'board', width: 375, height: 667, hash: '#overview', wait: 5000 });
    const p = f.page;
    const b = await f.ev(BAR);
    ok('director: the bar reads Dashboard, Calendar, Board, Menu (no Home, and Ask only where the chat is)', b && /^home:Dashboard\*\|cal:Calendar\|(ask:Ask\|)?team:Board\|menu:Menu$/.test(b.slots.join('|')), b);
    await p.click('#w163bar [data-w163slot="menu"]'); await p.waitForTimeout(400);
    const s = await f.ev(SHEET);
    ok('director: no apps in the sheet; the Board section with the Board overview marked as theirs', s.apps.length === 0 && s.secs.indexOf('Board') >= 0 && s.rows.indexOf('Board overview(mine)') >= 0, s);
    ok('no page errors (director, phone)', f.errs.length === 0, f.errs);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw163drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
