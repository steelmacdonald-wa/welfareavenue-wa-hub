/* wave322: One box. Pages, actions and Ask the Hub in Search everything; Ctrl K; the keyboard in the list.
   node test/w322drive.js [shots dir]   (candidate: CAND or build/candidate.html; WA_CHROME; NODE_PATH with playwright) */
const fs = require('fs');
const path = require('path');
const { launch, fresh } = require('./boot');
const OUT = process.argv[2] || '/tmp/shots';
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) { /* there */ }

(async () => {
  const browser = await launch();
  const results = [];
  const check = (name, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (info ? ' (' + info + ')' : ''); results.push(l); console.log(l); };
  const src = fs.readFileSync(path.join(__dirname, '../build/parts322/322_v322.js'), 'utf8');
  check('the block is ASCII', !/[^\x00-\x7f]/.test(src));
  check('the page never says AI in this block', !/\bAI\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
  const pop = f => f.ev(() => {
    const p = document.getElementById('searchResults');
    return { open: p.style.display !== 'none', launcher: p.hasAttribute('data-w322l'),
      rows: [...p.querySelectorAll('.sr')].map(r => ({ type: (r.querySelector('.sr-type') || {}).textContent || '', text: r.textContent.trim(), kind: r.getAttribute('data-w322') || '', hash: r.getAttribute('data-hash') || '', role: r.getAttribute('role') || '', on: r.classList.contains('w322on'), off: r.getAttribute('aria-disabled') || '' })) };
  });
  const type = async (f, q) => { await f.page.fill('#globalSearch', q); await f.page.waitForTimeout(900); };
  const users = f => f.ev(() => document.querySelectorAll('#wacMsgs .wac-m.user').length);
  const chat = f => f.ev(() => { const p = document.getElementById('waChatPanel'); return !!(p && p.style.display === 'flex'); });

  /* ---- 1. an admin on a computer ---- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, wait: 5200 });
    check('admin: no page error', f.errs.length === 0, f.errs.slice(0, 2).join(' | '));
    check('admin: w322 is there and the search is wrapped once', await f.ev(() => !!(window.w322 && renderSearch.__w322)));
    check('admin: the key hint shows in the empty box', await f.ev(() => { const k = document.getElementById('w322k'); return !!k && getComputedStyle(k).display !== 'none' && /K$/.test(k.textContent); }));
    check('admin: the box has a name for screen readers', await f.ev(() => { const i = document.getElementById('globalSearch'); return i.getAttribute('role') === 'combobox' && !!i.getAttribute('aria-label') && i.getAttribute('aria-controls') === 'searchResults'; }));

    /* Ctrl K, the launcher, the keyboard */
    await f.page.keyboard.press('Control+k'); await f.page.waitForTimeout(300);
    check('admin: Ctrl K goes to the box', await f.ev(() => document.activeElement && document.activeElement.id === 'globalSearch'));
    let p = await pop(f);
    check('admin: an empty box lists what it can do', p.open && p.launcher && p.rows.length === 7 && p.rows[0].text.indexOf('File a request') >= 0, p.rows.map(r => r.text).join(' / '));
    check('admin: the key hint hides while typing', await f.ev(() => getComputedStyle(document.getElementById('w322k')).display === 'none'));
    await f.page.screenshot({ path: OUT + '/w322_launcher.png' });
    await f.page.keyboard.press('ArrowDown'); await f.page.keyboard.press('ArrowDown'); await f.page.waitForTimeout(100);
    p = await pop(f);
    check('admin: Down lights the second row', p.rows[1].on && !p.rows[0].on && await f.ev(() => { const i = document.getElementById('globalSearch'); const id = i.getAttribute('aria-activedescendant'); return !!id && !!document.getElementById(id); }));
    await f.page.keyboard.press('Enter'); await f.page.waitForTimeout(700);
    check('admin: Add a task opens Ask the Hub with the sentence started, not sent', await chat(f) && await f.ev(() => document.getElementById('w38in').value === 'Add a task for me: ') && (await users(f)) === 0);
    check('admin: the list closed', !(await pop(f)).open);
    await f.page.click('#w81close'); await f.page.waitForTimeout(300);

    /* a page comes first; Enter opens it */
    await type(f, 'calen');
    p = await pop(f);
    check('admin: a page comes first', p.open && p.rows[0].type === 'Page' && /Calendar/.test(p.rows[0].text) && p.rows[0].hash === '#calendar', JSON.stringify(p.rows.slice(0, 2)));
    check('admin: every row is an option', p.rows.every(r => r.role === 'option'));
    await f.page.screenshot({ path: OUT + '/w322_page.png' });
    await f.page.keyboard.press('Enter'); await f.page.waitForTimeout(700);
    check('admin: Enter opens the first row', await f.ev(() => location.hash === '#calendar' && document.getElementById('globalSearch').value === ''), await f.ev(() => location.hash));

    /* nothing found: the Ask row is the next step, and stays last when documents arrive a moment later */
    await f.page.fill('#globalSearch', 'zzqqxx'); await f.page.waitForTimeout(120);
    p = await pop(f);
    let last = p.rows[p.rows.length - 1] || {};
    check('admin: no match still has a next step', p.open && /^No matches/.test(p.rows[0].text) && p.rows[0].off === 'true' && last.kind === 'ask' && last.text.indexOf('zzqqxx') >= 0, p.rows.map(r => r.kind + ':' + r.text.slice(0, 30)).join(' / '));
    await f.page.waitForTimeout(1000);
    p = await pop(f); last = p.rows[p.rows.length - 1] || {};
    check('admin: one Ask row only, still last once late rows are in', p.rows.filter(r => r.kind === 'ask').length === 1 && last.kind === 'ask', p.rows.map(r => r.kind + ':' + r.text.slice(0, 20)).join(' / '));
    await f.page.screenshot({ path: OUT + '/w322_ask.png' });
    await f.page.keyboard.press('ArrowUp'); await f.page.waitForTimeout(100);
    p = await pop(f);
    check('admin: Up from the box lights the last row', (p.rows[p.rows.length - 1] || {}).on === true);
    await f.page.keyboard.press('Enter'); await f.page.waitForTimeout(900);
    check('admin: the Ask row sends the question', await chat(f) && (await users(f)) === 1, 'user messages ' + await users(f));
    await f.page.click('#w81close'); await f.page.waitForTimeout(300);

    /* "task ..." gets its own row; late rows land above the Ask rows */
    await type(f, 'task call the caterer about Sunday');
    p = await pop(f);
    const n = p.rows.length;
    check('admin: task ... offers Add a task, then Ask', n >= 2 && p.rows[n - 2].kind === 'act' && p.rows[n - 2].type === 'Add a task' && p.rows[n - 1].kind === 'ask', p.rows.slice(-2).map(r => r.kind + ':' + r.type).join(' / '));
    await f.ev(() => { const d = document.createElement('div'); d.className = 'sr'; d.setAttribute('data-w107', '1'); d.textContent = 'A late document'; document.getElementById('searchResults').appendChild(d); });
    await f.page.waitForTimeout(200);
    p = await pop(f);
    check('admin: a late row lands above the Ask rows', p.rows[p.rows.length - 1].kind === 'ask' && p.rows[p.rows.length - 2].kind === 'act' && p.rows.some(r => r.text === 'A late document'));
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(150);
    check('admin: Escape closes the list', !(await pop(f)).open);

    /* Ctrl K leaves editors and windows alone */
    const stay = await f.ev(async () => {
      const d = document.createElement('div'); d.contentEditable = 'true'; d.id = 'w322ed'; d.textContent = 'x'; document.body.appendChild(d); d.focus();
      d.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
      const a = document.activeElement && document.activeElement.id; d.remove();
      const m = document.createElement('div'); m.setAttribute('aria-modal', 'true'); m.style.cssText = 'position:fixed;left:10px;top:10px;width:300px;height:200px;background:#fff;z-index:99999'; document.body.appendChild(m);
      document.body.focus(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
      const b = document.activeElement && document.activeElement.id; m.remove();
      return { editor: a, modal: b };
    });
    check('admin: Ctrl K leaves an editor and an open window alone', stay.editor === 'w322ed' && stay.modal !== 'globalSearch', JSON.stringify(stay));

    /* inside the CRM, its contacts stay first (wave153): pages go under them */
    const crm = await f.ev(() => {
      const pop = document.getElementById('searchResults');
      pop.innerHTML = '<div class="sr" data-w153c="1">Contact one</div><div class="sr" data-w153c="2">Contact two</div><div class="sr" data-hash="#task/1">A task</div>';
      pop.style.display = 'block';
      w322.extend('calen');
      return [...pop.querySelectorAll('.sr')].map(r => r.hasAttribute('data-w153c') ? 'contact' : (r.getAttribute('data-w322') || 'other'));
    });
    check('admin: in the CRM, contacts stay first and pages follow', crm.slice(0, 3).join(',') === 'contact,contact,page', crm.join(','));
    await f.page.keyboard.press('Escape');

    /* access */
    const pg = await f.ev(() => ({ exec: w322.pages('exec').map(x => x.id), dash: w322.pages('dash').map(x => x.id), create: w322.pages('create').map(x => x.id), one: w322.pages('c').length }));
    check('admin: an admin finds the Executive dashboard', pg.exec.indexOf('overview') >= 0, pg.exec.join(','));
    check('admin: retired pages stay out', pg.dash.indexOf('dashboard') < 0 && pg.create.indexOf('create') < 0, pg.dash.join(',') + ' | ' + pg.create.join(','));
    check('admin: one letter finds nothing', pg.one === 0);
    check('admin: still no page error', f.errs.length === 0, f.errs.slice(0, 2).join(' | '));
    await f.close();
  }

  /* ---- 2. a team member: only their own pages ---- */
  {
    const f = await fresh(browser, { who: 'member', width: 1366, wait: 5200 });
    const pg = await f.ev(() => ({ al: wa40Allowed(), exec: w322.pages('exec').map(x => x.id), admin: w322.pages('admin').map(x => x.id), inbox: w322.pages('hub inbox').map(x => x.id), all: w322.pages('a').length, every: ['re', 'ca', 'pr', 'go', 'ma', 'fu', 'bo', 'ad', 'hu', 'co'].reduce((acc, q) => acc.concat(w322.pages(q).map(x => x.id)), []) }));
    check('member: no Executive dashboard, Admin or Hub inbox', pg.exec.length === 0 && pg.admin.indexOf('adminpanel') < 0 && pg.inbox.length === 0, JSON.stringify([pg.exec, pg.admin, pg.inbox]));
    check('member: every page found is on their access list', pg.every.length > 0 && pg.every.every(id => pg.al.indexOf(id) >= 0), pg.every.filter(id => pg.al.indexOf(id) < 0).join(','));
    await type(f, 'executive');
    const p = await pop(f);
    check('member: typing a page they cannot open shows no page row', p.rows.every(r => r.kind !== 'page'), p.rows.map(r => r.kind + ':' + r.text.slice(0, 24)).join(' / '));
    check('member: no page error', f.errs.length === 0, f.errs.slice(0, 2).join(' | '));
    await f.close();
  }

  /* ---- 3. a director (board view): pages only ---- */
  {
    const f = await fresh(browser, { who: 'board', width: 1366, wait: 5200 });
    const can = await f.ev(() => { const b = document.getElementById('waChatBtn'); return !!(b && getComputedStyle(b).display !== 'none') || !!document.querySelector('#w163bar [data-w163slot="ask"]'); });
    const has = await f.ev(() => { const i = document.getElementById('globalSearch'); const r = i ? i.getBoundingClientRect() : { width: 0 }; return r.width > 0; });
    if (has) {
      await type(f, 'calendar');
      const p = await pop(f);
      const al = await f.ev(() => wa40Allowed());
      check('director: page rows only from their own list', p.rows.filter(r => r.kind === 'page').every(r => al.indexOf(r.hash.slice(1)) >= 0), p.rows.map(r => r.kind + ':' + r.hash).join(' / '));
      check('director: Ask rows only when they have Ask the Hub', can || p.rows.every(r => r.kind !== 'ask' && r.kind !== 'act'));
      await f.page.fill('#globalSearch', ''); await f.page.waitForTimeout(200);
      check('director: the launcher only when they have Ask the Hub', can || (await f.ev(() => w322.launcher())) === false);
    } else check('director: no search box, nothing to do', true);
    check('director: no page error', f.errs.length === 0, f.errs.slice(0, 2).join(' | '));
    await f.close();
  }

  /* ---- 4. a team member on a phone ---- */
  {
    const f = await fresh(browser, { who: 'member', width: 390, wait: 5200 });
    check('phone: no key hint', await f.ev(() => { const k = document.getElementById('w322k'); return !k || getComputedStyle(k).display === 'none'; }));
    check('phone: no launcher', (await f.ev(() => w322.launcher())) === false);
    const vis = await f.ev(() => { const i = document.getElementById('globalSearch'); const r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (vis) {
      await type(f, 'reque');
      const p = await pop(f);
      check('phone: a page comes first', p.open && p.rows[0].kind === 'page' && /Requests/.test(p.rows[0].text), p.rows.slice(0, 2).map(r => r.kind + ':' + r.text.slice(0, 24)).join(' / '));
      await f.page.screenshot({ path: OUT + '/w322_phone.png' });
    }
    check('phone: nothing scrolls sideways', await f.ev(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    check('phone: no page error', f.errs.length === 0, f.errs.slice(0, 2).join(' | '));
    await f.close();
  }

  await browser.close();
  const bad = results.filter(l => l.indexOf('FAIL') === 0);
  console.log('\n' + (results.length - bad.length) + '/' + results.length + ' passed');
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
