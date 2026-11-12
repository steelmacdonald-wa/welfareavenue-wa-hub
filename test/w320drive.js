/* wave320: Ask the Hub reaches out (The Hub suggests, the note, Help me finish this), muted text, touch areas.
   node test/w320drive.js [shots dir]   (candidate: CAND or build/candidate.html; WA_CHROME; NODE_PATH with playwright) */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
const OUT = process.argv[2] || '/tmp/shots';
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) { /* there */ }

function fixtureFor(email) {
  const fx = loadFixture();
  let m = (fx.team_members || []).filter(x => String(x.email || '').toLowerCase() === email)[0];
  if (!m) { m = { id: 9901, name: 'Joy Dumansi', email: email, department: 'marketing', role: 'Marketing coordinator', active: true }; fx.team_members = (fx.team_members || []).concat([m]); }
  const first = String(m.name).split(/\s+/)[0];
  fx.dept_tasks = (fx.dept_tasks || []).concat([
    { id: 9001, department: m.department || 'marketing', title: 'Send the partner thank-you notes', owner: first, done: false, due_date: '2026-09-20', sort: 1 },
    { id: 9002, department: m.department || 'marketing', title: 'A private matter', owner: first, done: false, due_date: '2026-09-10', confidential: true, sort: 2 },
    { id: 9003, department: m.department || 'marketing', title: 'Draft the October newsletter', owner: first, done: false, due_date: '2026-09-28', sort: 3 },
    { id: 9004, department: m.department || 'marketing', title: 'Not mine: belongs to someone whose name contains mine', owner: 'x' + first + 'na', done: false, due_date: '2026-09-01', sort: 4 }
  ]);
  fx.mentions = (fx.mentions || []).concat([
    { id: 9101, person: m.name, meeting_title: 'Team meeting', meeting_date: '2026-09-22', context: 'A follow-up was named.', seen: false },
    { id: 9102, person: m.name, meeting_title: 'Planning', meeting_date: '2026-09-23', context: 'Asked to review.', seen: false }
  ]);
  fx.dept_requests = (fx.dept_requests || []).concat([
    { id: 9201, type_key: 'other', department: m.department || 'marketing', title: 'Print the serving posters', status: 'requested', done: false, assignee: first, requested_by: 'Someone', created_at: '2026-09-21T12:00:00Z' }
  ]);
  return { fx, m, first };
}

(async () => {
  const browser = await launch();
  const results = [];
  const check = (name, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (info ? ' (' + info + ')' : ''); results.push(l); console.log(l); };
  const noAscii = fs.readFileSync(path.join(__dirname, '../build/parts320/320_v320.js'), 'utf8');
  check('the block is ASCII and has no dashes', !/[^\x00-\x7f]/.test(noAscii));
  check('the page never says AI in this block', !/\bAI\b/.test(noAscii.replace(/\/\*[\s\S]*?\*\//g, '')));

  /* ---- 1. an admin on a computer ---- */
  {
    const { fx, first } = fixtureFor('steel.macdonald@welfareavenue.com');
    const f = await fresh(browser, { who: 'admin', width: 1366, fixture: fx, wait: 5200 });
    check('admin: starts with no page error', f.errs.length === 0, f.errs.slice(0, 2).join(' | '));
    check('admin: w320 is there', await f.ev(() => !!(window.w320 && w320.suggest)));
    check('admin: the old grey is gone', await f.ev(() => document.documentElement.outerHTML.indexOf('#797773') < 0));
    check('admin: the Ask button names itself', await f.ev(() => /Ask the Hub anything/.test(document.getElementById('waChatBtn').title)));
    const list = await f.ev(() => w320.suggest(true));
    const kinds = list.map(x => x.k).join(',');
    check('admin: suggestions are the person\'s own', /late/.test(kinds) && /men/.test(kinds) && /req/.test(kinds), kinds);
    const late = list.filter(x => x.k === 'late')[0] || {};
    check('admin: two tasks late (the name-inside-a-name task is not theirs)', late.n === 2, 'n=' + late.n);
    check('admin: a confidential title is never shown', JSON.stringify(list).indexOf('private matter') < 0);
    check('admin: Help me finish points at the open task', (late.a || []).some(a => a.act === 'coach' && a.id === 9001));
    check('admin: at most three cards', list.length <= 3, String(list.length));
    check('admin: Home counts a task only for a whole-word owner', await f.ev(() => { const mine = waTasksOf('Steel').map(t => t.id); return mine.indexOf(9001) >= 0 && mine.indexOf(9004) < 0; }));
    /* the note */
    check('admin: nothing blocks the note on a quiet Home', await f.ev(() => w320.blocked() === false));
    const shown = await f.ev(() => w320.peek(true));
    await f.page.waitForTimeout(400);
    check('admin: the note shows', shown && await f.ev(() => { const p = document.getElementById('w320peek'); return !!p && p.classList.contains('on') && /Hi /.test(p.textContent) && /past/.test(p.textContent); }));
    await f.page.screenshot({ path: OUT + '/w320_note.png' });
    check('admin: the note sits clear of the Ask button', await f.ev(() => { const a = document.getElementById('w320peek').getBoundingClientRect(), b = document.getElementById('waChatBtn').getBoundingClientRect(); return a.bottom <= b.top + 1; }));
    await f.page.click('[data-w320peek="later"]'); await f.page.waitForTimeout(350);
    check('admin: Not today takes it away', await f.ev(() => !document.getElementById('w320peek')));
    check('admin: the dot is on until the chat is opened', await f.ev(() => document.body.classList.contains('w320has')));
    /* the box in the chat */
    await f.page.click('#waChatBtn'); await f.page.waitForTimeout(700);
    const box = await f.ev(() => { const b = document.getElementById('w320box'); if (!b) return null; const chips = document.querySelector('#waChatPanel .w81chips'); return { cards: b.querySelectorAll('.w320card').length, tiles: b.querySelectorAll('.w320tiles button').length, beforeChips: !!(chips && (b.compareDocumentPosition(chips) & 4)), text: b.textContent, h: b.getBoundingClientRect().height, inView: b.getBoundingClientRect().top >= 0 }; });
    check('admin: The Hub suggests is in the chat', !!box && box.cards === 3 && box.tiles === 4, JSON.stringify(box && { c: box.cards, t: box.tiles, h: Math.round(box.h) }));
    check('admin: it sits above Try asking, which is still there', !!box && box.beforeChips);
    check('admin: the dot is gone once seen', await f.ev(() => !document.body.classList.contains('w320has')));
    await f.page.screenshot({ path: OUT + '/w320_chat.png' });
    /* a tile fills the box and does not send */
    await f.page.click('#w320box .w320tiles button:nth-child(3)'); await f.page.waitForTimeout(300);
    check('admin: Find a page fills the question and waits', await f.ev(() => document.getElementById('w38in').value === 'Where do I find ' && document.querySelectorAll('#wacMsgs .wac-m.user').length === 0));
    /* Help me finish one sends a question */
    await f.page.click('#w320box .w320acts .pri'); await f.page.waitForTimeout(900);
    const sent = await f.ev(() => { const u = document.querySelectorAll('#wacMsgs .wac-m.user'); return u.length ? u[u.length - 1].textContent : ''; });
    check('admin: Help me finish asks about the open task', /Help me finish my task "Send the partner thank-you notes"/.test(sent), sent.slice(0, 80));
    check('admin: the box leaves once a thread starts', await f.ev(() => !document.getElementById('w320box')));
    /* the task drawer */
    await f.ev(() => { const x = document.getElementById('w81close'); if (x) x.click(); });
    await f.ev(() => window.w116Board.open(9001)); await f.page.waitForTimeout(700);
    check('admin: the task drawer offers Help me finish this', await f.ev(() => { const b = document.querySelector('#w116dr [data-w320help]'); return !!b && b.offsetParent !== null; }));
    await f.page.screenshot({ path: OUT + '/w320_drawer.png' });
    await f.ev(() => window.w116Board.open(9002)); await f.page.waitForTimeout(600);
    check('admin: not on a confidential task', await f.ev(() => !document.querySelector('#w116dr [data-w320help]')));
    /* stop the notes */
    await f.ev(() => { const x = document.querySelector('#w116dr [data-dact="close"]'); if (x) x.click(); });
    await f.page.waitForTimeout(300);
    await f.ev(() => w320.peek(true)); await f.page.waitForTimeout(300);
    await f.page.click('[data-w320peek="stop"]'); await f.page.waitForTimeout(300);
    check('admin: Stop these notes is remembered', await f.ev(() => localStorage.getItem('wa320.off') === '1'));
    check('admin: a stopped note does not come back by itself', await f.ev(() => w320.peek()) === false);
    check('admin: still no page error', f.errs.length === 0, f.errs.slice(0, 2).join(' | '));
    await f.close();
  }

  /* ---- 1b. the cards follow the tasks: once the due-date check has moved the dates, no late card ---- */
  {
    const { fx } = fixtureFor('steel.macdonald@welfareavenue.com');
    const f = await fresh(browser, { who: 'admin', width: 1366, fixture: fx, wait: 5200 });
    const a = await f.ev(() => w320.suggest());
    const b = await f.ev(() => { DB_TASKS.forEach(t => { if (t.id === 9001 || t.id === 9002) t.due_date = '2026-09-27'; }); return w320.suggest(); });
    check('the cards follow the tasks: a late card first', a.some(x => x.k === 'late'), a.map(x => x.k).join(','));
    check('the cards follow the tasks: dates moved, so no late card', !b.some(x => x.k === 'late'), b.map(x => x.k).join(','));
    const c = await f.ev(() => { DB_TASKS.forEach(t => { if (t.id === 9001) t.done = true; }); return w320.mine().map(t => t.id); });
    check('the cards follow the tasks: a ticked task leaves the list', c.indexOf(9001) < 0 && c.indexOf(9003) >= 0, c.join(','));
    await f.close();
  }

  /* ---- 2. a starter prompt sends on one tap; the note waits for a window to close ---- */
  {
    const { fx } = fixtureFor('steel.macdonald@welfareavenue.com');
    const f = await fresh(browser, { who: 'admin', width: 1366, fixture: fx, wait: 5200 });
    await f.page.click('#waChatBtn'); await f.page.waitForTimeout(700);
    await f.page.click('#waChatPanel .w81chip'); await f.page.waitForTimeout(700);
    check('starter prompt: one tap sends it', await f.ev(() => document.querySelectorAll('#wacMsgs .wac-m.user').length === 1));
    check('the chat open blocks the note', await f.ev(() => w320.blocked() === true));
    await f.page.click('#w81close'); await f.page.waitForTimeout(400);
    check('with the chat closed, nothing blocks it', await f.ev(() => w320.blocked() === false));
    await f.page.focus('#globalSearch');
    check('typing in a field blocks the note', await f.ev(() => w320.blocked() === true));
    await f.ev(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
    check('and nothing blocks it once the field is left', await f.ev(() => w320.blocked() === false));
    /* the due-date check (wave213) is a window nobody can skip: the note waits behind it, and does not show over it */
    const gate = await f.ev(async () => {
      const el = document.createElement('div'); el.id = 'w213pop';
      el.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4)';
      el.innerHTML = '<div class="dlg" role="dialog" aria-modal="true" style="width:600px;height:400px;background:#fff">due dates</div>';
      document.body.appendChild(el);
      const blocked = w320.blocked(); const shown = await w320.peek(true); const there = !!document.getElementById('w320peek');
      el.remove();
      return { blocked, shown, there, after: w320.blocked() };
    });
    check('the due-date check blocks the note, and the note does not show over it', gate.blocked === true && gate.shown === false && gate.there === false && gate.after === false, JSON.stringify(gate));
    await f.close();
  }

  /* ---- 3. a team member on a phone ---- */
  {
    const { fx } = fixtureFor('joy.dumansi@welfareavenue.com');
    const f = await fresh(browser, { who: 'plain', width: 390, fixture: fx, wait: 5200 });
    check('phone: no page error', f.errs.length === 0, f.errs.slice(0, 2).join(' | '));
    const list = await f.ev(() => w320.suggest(true));
    check('phone: suggestions for a member', list.length >= 1 && list[0].k !== 'clear', list.map(x => x.k).join(','));
    await f.ev(() => w320.peek(true)); await f.page.waitForTimeout(400);
    const geo = await f.ev(() => { const p = document.getElementById('w320peek'), b = document.getElementById('w163bar'); if (!p || !b) return null; const a = p.getBoundingClientRect(), c = b.getBoundingClientRect(); return { above: a.bottom <= c.top + 1, inside: a.left >= 0 && a.right <= innerWidth, w: Math.round(a.width) }; });
    check('phone: the note sits above the bar and inside the screen', !!geo && geo.above && geo.inside, JSON.stringify(geo));
    await f.page.screenshot({ path: OUT + '/w320_phone_note.png' });
    await f.page.click('[data-w320peek="show"]'); await f.page.waitForTimeout(800);
    check('phone: Show me opens the chat with the cards', await f.ev(() => { const b = document.getElementById('w320box'); return !!b && b.querySelectorAll('.w320card').length >= 1; }));
    check('phone: nothing scrolls sideways', await f.ev(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await f.page.screenshot({ path: OUT + '/w320_phone_chat.png' });
    const hit = await f.ev(() => { const e = document.querySelector('#w112card .w112links a'); if (!e) return 'none'; const a = getComputedStyle(e, '::after'); return a.content !== 'none' ? parseFloat(a.height) : 0; });
    check('phone: the small links have a 44 px touch area', hit === 'none' || hit >= 44, String(hit));
    await f.close();
  }

  /* ---- 4. a director: nothing new, no error ---- */
  {
    const f = await fresh(browser, { who: 'board', width: 1366, wait: 5200 });
    check('director: no page error', f.errs.length === 0, f.errs.slice(0, 2).join(' | '));
    check('director: no note', await f.ev(() => w320.peek(true)) === false || await f.ev(() => !!document.getElementById('w320peek')) === false);
    await f.close();
  }

  /* ---- 5. reduced motion ---- */
  {
    const { fx } = fixtureFor('steel.macdonald@welfareavenue.com');
    const f = await fresh(browser, { who: 'admin', width: 1366, fixture: fx, wait: 5200, beforeGoto: async page => { await page.emulateMedia({ reducedMotion: 'reduce' }); } });
    await f.page.click('#waChatBtn'); await f.page.waitForTimeout(700);
    check('reduced motion: the cards do not animate', await f.ev(() => { const c = document.querySelector('#w320box .w320card'); return !!c && getComputedStyle(c).animationName === 'none'; }));
    await f.close();
  }

  await browser.close();
  const fails = results.filter(r => r.indexOf('FAIL') === 0);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FAIL (crash)', e); process.exit(1); });
