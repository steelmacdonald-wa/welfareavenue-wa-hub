/* w164drive.js: wave164, Finance on its own. Steel: "It's a little repetitive here and still shows fundraising and finance
   being togther. these should be seperate", and the finance emails to #accounting-finance. The fixture is the live-data one
   with what wa164_finance_own does to the data: the Hub inbox's money emails and their tasks under finance, reimbursements
   and purchase orders sent to Finance, Finance's channel. Uses test/boot.js (stubbed Supabase, clock fixed). */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }

function fx() {
  const f = loadFixture();
  const mk = (id, title, flag) => ({ id, department: 'finance', subsection: 'Bills and receipts', title, owner: '', status: 'Open', done: false, flag: !!flag, priority: false, sort: 999, due_date: null, project_id: null, visibility: null, board_only: false, confidential: false, updated_by: 'Hub inbox', opened_at: '2026-09-25T14:00:00Z', updated_at: '2026-09-25T14:00:00Z' });
  f.dept_tasks.push(mk(990001, 'Payment problem: Atlassian ($1,806.89)', true), mk(990002, 'Receipt: Quo ($19)'), mk(990003, 'Receipt: Netlify, Inc. ($9)'));
  /* a money task still on a team's board (it shows in the Overview's fold) and a grant task (it does not) */
  f.dept_tasks.push({ id: 990010, department: 'opsmtl', subsection: null, title: 'Send the kitchen receipts from Sunday', owner: 'Ahmed', status: 'Open', done: false, flag: false, priority: false, sort: 999, due_date: null, project_id: null, visibility: null, board_only: false, confidential: false });
  f.dept_tasks.push({ id: 990011, department: 'fundraising', subsection: 'Grants', title: 'Call the Trillium grant officer about the donor list', owner: 'Cindy', status: 'Open', done: false, flag: false, priority: false, sort: 999, due_date: null, project_id: null, visibility: null, board_only: false, confidential: false });
  (f.dept_tasks || []).forEach(t => { if (t.department === 'fundraising' && t.subsection === 'Finance') { t.department = 'finance'; t.subsection = 'Bills and receipts'; } });
  (f.hub_mail || []).forEach(m => { if (m.kind === 'invoice') { m.department = 'finance'; if (m.filed) m.filed.department = 'finance'; m.notify = { department: 'finance', decision: 'notify', by: 'setting', channel: 'accounting-finance' }; } });
  (f.request_types || []).forEach(t => { if (t.key === 'reimbursement' || t.key === 'purchase-order') t.department = 'finance'; });
  const r0 = (f.dept_requests || [])[0] || {};
  f.dept_requests.push(Object.assign({}, r0, { id: 990050, done: false, title: 'Reimburse the Sunday groceries ($84.20)', status: 'pending approval', details: 'Groceries for the Sept 21 serving.', assignee: null, type_key: 'reimbursement', created_at: '2026-09-24T15:00:00Z', department: 'finance', requested_by: 'Samson Jules', requested_email: 'samson.jules@welfareavenue.com', slack: null, source: 'form', priority: 'normal', needed_by: null }));
  (f.hub_settings || []).forEach(s => { if (s.key === 'team_inbox') { s.value.channels.finance = ['accounting-finance']; s.value.email_mode = { finance: 'always' }; } });
  (f.dept_meta || []).forEach(m => { if (m.department === 'fundraising') { m.label = 'Fundraising'; m.short_label = 'Fundraising'; } });
  (f.hub_access_profiles || []).forEach(p => { if (p.key === 'fundraising') p.label = 'Fundraising'; });
  return f;
}
const MAST = () => { const m = document.querySelector('#finances > .w118mast'); if (!m) return null; const c = m.querySelector('.crumb'); return { h1: (m.querySelector('h1') || {}).textContent, p: (m.querySelector(':scope > p') || {}).textContent, crumb: c ? c.textContent : null, crumbShown: c ? getComputedStyle(c).display !== 'none' : false }; };
const RAIL = () => { const r = document.getElementById('w153rail'); if (!r) return null; return { heads: [...r.querySelectorAll('.w153sh')].map(x => x.textContent), items: [...r.querySelectorAll('.w153it')].map(a => a.querySelector('span').textContent + (a.querySelector('.w153n') ? '(' + a.querySelector('.w153n').textContent + ')' : '') + (a.classList.contains('on') ? '*' : '')), title: (r.querySelector('.w153ah b') || {}).textContent, tile: r.querySelector('.w153ah .w153ai') ? getComputedStyle(r.querySelector('.w153ah .w153ai')).backgroundColor : null }; };

(async () => {
  const browser = await launch();
  const FX = fx();

  /* 1. the Finance app on a computer, as an admin */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#finances', fixture: JSON.parse(JSON.stringify(FX)), wait: 4500 });
    const p = f.page;
    await p.evaluate(() => { try { localStorage.setItem('wa94.sec', 'overview'); } catch (e) {} ; var t = document.querySelector('#finances .w94tab[data-w94tab="overview"]'); if (t) t.click(); });
    await p.waitForTimeout(600);
    let r = await f.ev(RAIL), m = await f.ev(MAST);
    ok('the Finance app: its own gold, no group heading repeating its name, Tasks after the Overview', r && r.title === 'Finance' && r.heads.length === 0 && r.items.join('|') === 'Overview*|Tasks|Trends|Money map|Budget|Transactions' && r.tile === 'rgb(185, 133, 27)', r);
    ok('the page does not say Fundraising: no crumb inside the app, the title is Finance with a line about the year', m && m.h1 === 'Finance' && !m.crumbShown && !/fundrais/i.test(m.h1 + ' ' + m.p + ' ' + m.crumb) && /year so far/.test(m.p), m);
    const nav = await f.ev(() => ({ tabs: document.getElementById('w94nav') ? getComputedStyle(document.getElementById('w94nav')).display : 'missing', n: document.querySelectorAll('#finances .w94tab').length }));
    ok('on a computer the page\'s own tab strip is gone (the rail is the menu); the six sections are still there behind it', nav.tabs === 'none' && nav.n === 6, nav);
    const bar = await f.ev(() => ({ t: (document.querySelector('#w153bar .w153bc') || {}).innerText, tileBefore: getComputedStyle(document.querySelector('#w153bar .w153ai'), '::before').content }));
    ok('the app bar reads Finance, then where you are, and its icon tile carries no arrow', /FINANCE\s*Overview/i.test(bar.t) && (bar.tileBefore === 'none' || bar.tileBefore === 'normal'), bar);
    const inbox = await f.ev(() => { const c = document.getElementById('w164inbox'); return c ? { text: c.innerText.replace(/\s+/g, ' ').slice(0, 600), links: [...c.querySelectorAll('[data-w123go]')].map(a => a.getAttribute('data-w123go')), afterKpis: !!(c.previousElementSibling && c.previousElementSibling.classList.contains('fin-kpis')) } : null; });
    ok('the Overview shows Finance\'s team inbox after the numbers: the reimbursement request and the money emails, posting to #accounting-finance', inbox && inbox.afterKpis && /Team inbox/i.test(inbox.text) && /Reimburse the Sunday groceries/.test(inbox.text) && /accounting-finance/.test(inbox.text) && inbox.links.indexOf('#requests/team/finance') >= 0, inbox);
    const fold = await f.ev(() => { const d = document.getElementById('w93tasks'); return d ? d.textContent.replace(/\s+/g, ' ').slice(0, 900) : null; });
    ok('the fold lists the money work on other teams\' boards: the kitchen receipts yes, a grant task no, Finance\'s own tasks no', fold && /Money work on other teams/.test(fold) && /kitchen receipts/.test(fold) && !/Trillium/.test(fold) && !/Atlassian/.test(fold), fold);

    /* the rail's Trends: the title follows */
    await p.click('#w153rail .w153it[data-w153sec="trends"]'); await p.waitForTimeout(900);
    m = await f.ev(MAST); r = await f.ev(RAIL);
    const t2 = await f.ev(() => ({ title: document.title, on: (document.querySelector('#finances .w94tab.on') || {}).textContent }));
    ok('Trends from the rail: the rail marks it, the title and its line follow, the tab title too', m.h1 === 'Trends' && /month by month/.test(m.p) && r.items.indexOf('Trends*') >= 0 && t2.on === 'Trends' && /^Trends · Finance/.test(t2.title), { m, r, t2 });

    /* Tasks: Finance's own board */
    await p.click('#w153rail .w153it[data-w153sec="tasks"]'); await p.waitForTimeout(1200);
    const tk = await f.ev(() => { const b = document.getElementById('w164board'); return { h1: document.querySelector('#finances > .w118mast h1').textContent, board: !!(b && b.querySelector('.w116tb')), text: b ? b.innerText.replace(/\s+/g, ' ') : '', groups: b ? [...b.querySelectorAll('.w116gh b')].map(x => x.textContent) : [] }; });
    ok('Tasks: Finance\'s own board with the Hub inbox\'s money tasks, grouped under Bills and receipts', tk.h1 === 'Tasks' && tk.board && /Payment problem: Atlassian/.test(tk.text) && /Receipt: Quo/.test(tk.text) && tk.groups.indexOf('Bills and receipts') >= 0 && !/Trillium/.test(tk.text), tk);
    /* a task added here is Finance's */
    const add = await f.ev(async () => { const n0 = DB_TASKS.length; const inp = document.querySelector('#w164board .w116qa input, #w164board input[data-qa], #w164board .w116add input'); return { n0, hasQuickAdd: !!inp }; });
    ok('the board can take a new task (quick add is there)', add.hasQuickAdd, add);

    /* a link to Finance's old team page opens Tasks in the app */
    await f.hash('#team/finance', 1600);
    const tl = await f.ev(() => ({ hash: location.hash, app: window.WA_APP && window.WA_APP.current(), on: (document.querySelector('#finances .w94tab.on') || {}).getAttribute && document.querySelector('#finances .w94tab.on').getAttribute('data-w94tab') }));
    ok('#team/finance opens the Finance app on Tasks (Finance has no team page)', tl.hash === '#finances/tasks' && tl.app === 'finance' && tl.on === 'tasks', tl);
    ok('no page errors in the Finance app', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. Fundraising is Fundraising: the team page and the menu */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#team/fundraising', fixture: JSON.parse(JSON.stringify(FX)), wait: 4500 });
    const fr = await f.ev(() => { const h = document.getElementById('w116host'); return { text: h ? h.innerText.replace(/\s+/g, ' ') : '', boards: [...document.querySelectorAll('#w116host .w116bcard .n')].map(x => x.textContent), tools: [...document.querySelectorAll('#w116host .w116tools a')].map(a => a.textContent.trim()) }; });
    ok('the Fundraising page: Grants, Event fundraising and Donor relations, no Finance board and no Finances tool', fr.boards.join('|') === 'Grants|Event fundraising|Donor relations' && !fr.tools.some(t => /financ/i.test(t)), fr);
    ok('the Fundraising page never says Fundraising & Finances', !/Fundraising (&|and) Financ/i.test(fr.text), fr.text.slice(0, 300));
    const menu = await f.ev(() => ({ label: ((document.querySelector('#tabBar .tab[data-tab="fundraising"]') || {}).textContent || '').trim(), any: /Fundraising (&|and) Financ/i.test(document.getElementById('tabBar').textContent) }));
    ok('the menu calls the team Fundraising', menu.label === 'Fundraising' && !menu.any, menu);
    const sub = await f.ev(() => [...document.querySelectorAll('#w116host .w116crumb, #w116host .w116ph, #w116host h2')].map(x => x.textContent).join(' | '));
    ok('the Fundraising header names the team Fundraising', /Fundraising/.test(sub) && !/Financ/.test(sub), sub);
    const tx = await f.ev(() => ({ up: [...document.querySelectorAll('#txDept option')].map(o => o.value + '=' + o.textContent), arch: [...document.querySelectorAll('#txFilter option')].map(o => o.textContent) }));
    ok('Add a transcript offers Fundraising and Finance separately; the archive filters them separately', tx.up.indexOf('fundraising=Fundraising') >= 0 && tx.up.indexOf('Finance=Finance (budgets, statements, the books)') >= 0 && tx.arch.indexOf('Fundraising') >= 0 && tx.arch.indexOf('Finance') >= 0, tx);
    const keys = await f.ev(() => ({ fin: typeof txDeptKey === 'function' ? txDeptKey('Finance') : null, old: txDeptKey('Finance (Fundraising & Finances)'), fr: txDeptKey('Fundraising'), lab: DEPT_LABEL.finance, col: DEPT_COLOR.finance }));
    ok('a meeting tagged Finance is Finance\'s (the old tag too); Fundraising stays Fundraising', keys.fin === 'finance' && keys.old === 'finance' && keys.fr === 'fundraising' && keys.lab === 'Finance', keys);
    ok('no page errors on the Fundraising page', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. Requests: Finance receives reimbursements and purchase orders */
  {
    const f = await fresh(browser, { who: 'member', width: 1366, hash: '#requests/new', fixture: JSON.parse(JSON.stringify(FX)), wait: 4500 });
    const p = f.page;
    const tiles = await f.ev(() => [...document.querySelectorAll('#w123 .w123team')].map(b => b.querySelector('b').textContent + ': ' + (b.querySelector('.s') || {}).textContent));
    ok('New request: Finance is a team of its own (reimbursements, purchase approvals, invoices), Fundraising keeps grants, donors and events', tiles.some(t => /^Finance: Reimbursements/.test(t)) && tiles.some(t => /^Fundraising: Grant information, donors/.test(t)), tiles);
    await p.click('#w123 .w123team[data-w123team="finance"]'); await p.waitForTimeout(700);
    const types = await f.ev(() => ({ hash: location.hash, types: [...document.querySelectorAll('#w123 .w123type b')].map(b => b.textContent), side: (document.querySelector('#w123') || {}).innerText.replace(/\s+/g, ' ').slice(0, 1500) }));
    ok('Finance\'s requests: the reimbursement and the purchase order, posting to #accounting-finance', types.hash === '#requests/new/finance' && types.types.indexOf('Reimbursement request') >= 0 && types.types.indexOf('Purchase order request') >= 0 && /accounting-finance/.test(types.side), types);
    await f.hash('#requests/new/fundraising', 900);
    const ft = await f.ev(() => [...document.querySelectorAll('#w123 .w123type b')].map(b => b.textContent));
    ok('Fundraising\'s requests no longer include reimbursements or purchase orders', ft.indexOf('Reimbursement request') < 0 && ft.indexOf('Purchase order request') < 0 && ft.indexOf('Grant information request') >= 0, ft);
    ok('a member without Finance access cannot open Finance\'s team inbox (Finance\'s inbox follows the Finance app\'s access)', await f.ev(() => window.w123 && window.w123.state && true) && !(await f.ev(() => { try { return (typeof wa40Allowed === 'function' ? wa40Allowed() : []).indexOf('finances') >= 0; } catch (e) { return true; } })), 'member finances access');
    ok('no page errors on Requests', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 4. the HR centre: the same de-duplication (the counts move into the rail) */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre', fixture: JSON.parse(JSON.stringify(FX)), wait: 5000 });
    const hr = await f.ev(() => { const r = document.getElementById('w153rail'); const t = document.querySelector('#hrcentre .w47tabs'); return { heads: [...r.querySelectorAll('.w153sh')].map(x => x.textContent), items: [...r.querySelectorAll('.w153it')].map(a => a.querySelector('span').textContent + (a.querySelector('.w153n') ? '(' + a.querySelector('.w153n').textContent + ')' : '')), tabs: t ? getComputedStyle(t).display : 'missing', crumb: (function () { const c = document.querySelector('#hrcentre > .w118mast .crumb'); return c ? getComputedStyle(c).display : 'none'; })() }; });
    ok('the HR centre: no heading repeating its name, the People count in the rail, its tab strip gone on a computer, no crumb', hr.heads.length === 0 && hr.items.some(x => /^People\(\d+\)$/.test(x)) && hr.tabs === 'none' && hr.crumb === 'none', hr);
    await f.page.click('#w153rail .w153it[data-w153sec="onboarding"]'); await f.page.waitForTimeout(900);
    const on = await f.ev(() => ({ tab: (document.querySelector('#hrcentre .w47tab.on') || {}).getAttribute && document.querySelector('#hrcentre .w47tab.on').getAttribute('data-w47v'), rail: (document.querySelector('#w153rail .w153it.on span') || {}).textContent }));
    ok('the rail still switches the HR centre\'s sections', on.tab === 'onboarding' && on.rail === 'Onboarding', on);
    ok('no page errors in the HR centre', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 5. a phone keeps the tabs; the sheet shows Finance's menu without a heading repeating its name */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, height: 844, hash: '#finances', fixture: JSON.parse(JSON.stringify(FX)), wait: 5000 });
    const ph = await f.ev(() => ({ tabs: document.getElementById('w94nav') ? getComputedStyle(document.getElementById('w94nav')).display : 'missing', n: document.querySelectorAll('#w94nav .w94tab').length }));
    ok('phone: the Finance page keeps its tabs (the rail is not on screen)', ph.tabs !== 'none' && ph.n === 6, ph);
    await f.page.click('#w163bar [data-w163slot="menu"]'); await f.page.waitForTimeout(500);
    const s = await f.ev(() => { const s = document.getElementById('w163sheet'); return { title: (s.querySelector('.hd h2') || {}).textContent, secs: [...s.querySelectorAll('.sh')].map(x => x.textContent), rows: [...s.querySelectorAll('.it .lb')].map(x => x.childNodes[0].textContent.trim()), tile: (function () { const a = [...s.querySelectorAll('.app')].filter(x => /Finance/.test(x.textContent))[0]; return a ? getComputedStyle(a.querySelector('.t')).backgroundColor : null; })() }; });
    ok('phone: Menu in Finance is Finance\'s menu (Overview, Tasks, Trends...), no FINANCE heading under the title, the gold tile', s.title === 'Finance' && s.secs.indexOf('Finance') < 0 && s.rows.slice(0, 3).join('|') === 'Overview|Tasks|Trends' && s.tile === 'rgb(185, 133, 27)', s);
    ok('no page errors on the phone', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 6. the Hub inbox page: money emails are Finance's */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hubmail', fixture: JSON.parse(JSON.stringify(FX)), wait: 4500 });
    const hm = await f.ev(() => { const h = document.getElementById('hubmail'); return h ? h.innerText.replace(/\s+/g, ' ') : ''; });
    ok('the Hub inbox says money emails go to Finance and #accounting-finance, never to Fundraising', /money emails to Finance/.test(hm) && /accounting-finance/.test(hm) && /never to Fundraising/.test(hm), hm.slice(0, 800));
    ok('no page errors on the Hub inbox', f.errs.length === 0, f.errs);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
