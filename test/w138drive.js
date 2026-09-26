/* w138drive.js: @mentions (wave138).
   Typing @ in a task comment, a task description or a goal comment opens the roster picker (keys and mouse);
   choosing inserts @Name; the line under the field says who gets a Slack message and how; posting still posts;
   an email address opens nothing; names that are mentions are highlighted in comments; Settings, Connections
   has "Send @mentions as you" (slack-connect status, start, disconnect) with the latest mentions; Notifications
   can switch mention messages off; coming back from Slack (?slack=connected or error) opens Settings with a note
   and cleans the address.
   usage: node test/w138drive.js */
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }

const ME = 'steel.macdonald@welfareavenue.com';
const MOCK = (o) => `(function(){
  var fx = window.__WAFIX;
  fx.task_comments = (fx.task_comments || []).concat([{ id: 99001, task_id: 90001, body: 'Thanks @Joy, can you check the caption? cc joy@welfareavenue.com', author: 'Ian', source: 'manual', created_at: '2026-09-25T15:00:00Z' }]);
  fx.slack_links = ${JSON.stringify((o && o.links) || [])};
  fx.hub_mentions = ${JSON.stringify((o && o.mentions) || [])};
  window.__SLACK = ${JSON.stringify((o && o.slack) || { ok: true, connected: false, since: null, ready: true })};
  window.__INS = []; window.__FN = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.from || db.from.__w) return;
    var of = db.from.bind(db);
    var f = function (table) { var b = of(table); var oi = b.insert.bind(b); b.insert = function (p) { window.__INS.push({ table: table, p: JSON.parse(JSON.stringify(p)) }); return oi(p); }; return b; };
    f.__w = 1; db.from = f;
    var inv = db.functions.invoke.bind(db.functions);
    db.functions.invoke = function (name, opts) { var body = opts && opts.body; window.__FN.push({ name: name, body: body });
      if (name === 'slack-connect') {
        var a = body && body.action;
        if (a === 'status') return Promise.resolve({ data: window.__SLACK, error: null });
        if (a === 'start') return Promise.resolve({ data: { ok: true, url: 'https://slack.com/oauth/v2/authorize?client_id=x&user_scope=chat%3Awrite%2Cim%3Awrite' }, error: null });
        if (a === 'disconnect') { window.__SLACK = { ok: true, connected: false, since: null, ready: true }; return Promise.resolve({ data: { ok: true }, error: null }); }
      }
      return inv(name, opts); };
  }, 5); })();`;

async function typeIn(f, sel, text) { await f.page.focus(sel); await f.page.keyboard.type(text, { delay: 15 }); await f.page.waitForTimeout(350); }
const pickState = f => f.ev(() => { const b = document.getElementById('w138pick'); return { on: !!(b && b.classList.contains('on')), names: b ? Array.from(b.querySelectorAll('.it b')).map(x => x.textContent) : [], active: b ? ((b.querySelector('.it.on b') || {}).textContent || '') : '', smalls: b ? Array.from(b.querySelectorAll('.it small')).map(x => x.textContent) : [] }; });
const hintOf = (f, sel) => f.ev(s => { const el = document.querySelector(s); const h = el && el.__w138hint; return h && document.body.contains(h) ? h.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);

(async () => {
  const browser = await launch();
  /* 1. the task drawer: comments and the description */
  {
    const f = await fresh(browser, { who: 'admin', hash: '#team/marketing/tasks', init: MOCK(), wait: 4500 });
    await f.ev(() => window.w116Board.open(90001));
    await f.page.waitForTimeout(1200);
    const a = await f.ev(() => { const cm = document.querySelectorAll('#w116cm .w116cmt .bd'); const hit = Array.from(cm).filter(b => /Thanks @Joy/.test(b.textContent))[0]; return { spans: hit ? Array.from(hit.querySelectorAll('.w138at')).map(s => s.textContent) : null, text: hit ? hit.textContent : null }; });
    ok('a comment that mentions Joy shows her name highlighted, and not the email address', a.spans && a.spans.length === 1 && a.spans[0] === '@Joy' && /joy@welfareavenue\.com/.test(a.text), a);

    await typeIn(f, '#w116cmtx', 'Can you check this @jo');
    let p = await pickState(f);
    ok('typing @jo opens the picker with Joy first', p.on && p.names[0] === 'Joy', p);
    await f.ev(() => { const t = document.getElementById('w116cmtx'); t.value = t.value.replace(/@jo$/, '@j'); t.setSelectionRange(t.value.length, t.value.length); t.dispatchEvent(new Event('input', { bubbles: true })); });
    await f.page.waitForTimeout(250);
    const pj = await pickState(f);
    ok('on a Marketing task, @j puts Joy (Marketing) before Jemeela', pj.on && pj.names[0] === 'Joy' && pj.names.indexOf('Jemeela') > 0, pj);
    await f.ev(() => { const t = document.getElementById('w116cmtx'); t.value = t.value + 'o'; t.setSelectionRange(t.value.length, t.value.length); t.dispatchEvent(new Event('input', { bubbles: true })); });
    await f.page.waitForTimeout(250);
    p = await pickState(f);
    await f.page.keyboard.press('ArrowDown'); await f.page.waitForTimeout(100);
    const p2 = await pickState(f);
    await f.page.keyboard.press('ArrowUp'); await f.page.waitForTimeout(100);
    const p3 = await pickState(f);
    ok('the arrow keys move through the list', p.names.length < 2 || (p2.active === p.names[1] && p3.active === p.names[0]), { p, p2, p3 });
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
    const esc = await f.ev(() => ({ pick: document.getElementById('w138pick').classList.contains('on'), drawer: document.getElementById('w116dr').classList.contains('open') }));
    ok('Escape closes the list and leaves the drawer open', !esc.pick && esc.drawer, esc);
    await f.page.keyboard.type('y', { delay: 15 }); await f.page.waitForTimeout(300);
    p = await pickState(f);
    await f.page.keyboard.press('Enter'); await f.page.waitForTimeout(400);
    const b = await f.ev(() => ({ v: document.getElementById('w116cmtx').value, ins: window.__INS.filter(x => x.table === 'task_comments').length }));
    ok('Enter puts @Joy in the comment and does not post it', p.on && b.v === 'Can you check this @Joy ' && b.ins === 0, { p, b });
    await f.page.waitForTimeout(500);
    const h1 = await hintOf(f, '#w116cmtx');
    ok('the line under the comment says Joy gets a Slack message from the Hub with my name', /^Joy gets a Slack message when you post it, from the Hub with your name\. To send it as you, connect Slack in Settings\.$/.test(h1 || ''), h1);
    const hostOk = await f.ev(() => { const el = document.getElementById('w116cmtx'); const h = el.__w138hint; return !!h && h.previousElementSibling === el.parentElement; });
    ok('the line sits under the comment row, not between the field and Post', hostOk);
    await f.page.keyboard.type('please', { delay: 10 });
    await f.ev(() => document.querySelector('#w116dr [data-dact="comment"]').click());
    await f.page.waitForTimeout(1600);
    const c = await f.ev(() => ({ ins: window.__INS.filter(x => x.table === 'task_comments').map(x => x.p), v: document.getElementById('w116cmtx') ? document.getElementById('w116cmtx').value : null }));
    const h2 = await hintOf(f, '#w116cmtx');
    ok('Post saves the comment with the mention as typed', c.ins.length === 1 && c.ins[0].body === 'Can you check this @Joy please' && c.ins[0].task_id === 90001, c);
    ok('once posted, the line goes away', h2 === null, h2);

    await typeIn(f, '#w116cmtx', 'write to joy@welf');
    p = await pickState(f);
    ok('an email address opens no picker', !p.on, p);
    await f.ev(() => { const t = document.getElementById('w116cmtx'); t.value = ''; });
    await typeIn(f, '#w116cmtx', 'ask @rob');
    p = await pickState(f);
    ok('someone with no email shows it in the list', p.on && p.names[0] === 'Robert' && /no email, so no Slack message/.test(p.smalls[0] || ''), p);
    await f.page.keyboard.press('Tab'); await f.page.waitForTimeout(600);
    const h3 = await hintOf(f, '#w116cmtx');
    ok('Tab chooses too, and the line says Robert gets no Slack message', /Robert has no email on the Hub, so no Slack message\./.test(h3 || '') && !/gets a Slack/.test(h3 || ''), h3);
    await f.ev(() => { const t = document.getElementById('w116cmtx'); t.value = ''; });
    await typeIn(f, '#w116cmtx', '@stee');
    p = await pickState(f);
    ok('I am not in my own list', p.names.indexOf('Steel') < 0, p);
    await f.page.keyboard.press('Escape');
    await f.ev(() => { const t = document.getElementById('w116cmtx'); t.value = ''; t.blur(); });

    /* the description (rich text, saves as you type) */
    await f.ev(() => { const ed = document.getElementById('w116ted'); ed.focus(); const s = window.getSelection(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); s.removeAllRanges(); s.addRange(r); });
    await f.page.keyboard.type(' Venue: @ma', { delay: 20 }); await f.page.waitForTimeout(350);
    p = await pickState(f);
    const box = await f.ev(() => { const b = document.getElementById('w138pick').getBoundingClientRect(), e = document.getElementById('w116ted').getBoundingClientRect(); return { bt: b.top, eb: e.bottom, et: e.top, bl: b.left, vw: innerWidth, br: b.right }; });
    ok('in the description, @ma opens the picker with Mary, next to the text', p.on && p.names[0] === 'Mary' && box.bt >= box.et && box.br <= box.vw, { p, box });
    await f.page.keyboard.press('Enter'); await f.page.waitForTimeout(300);
    await f.page.keyboard.type('can you book it?', { delay: 10 }); await f.page.waitForTimeout(700);
    const h4 = await hintOf(f, '#w116ted');
    await f.page.waitForTimeout(1500);
    const d = await f.ev(() => ({ text: document.getElementById('w116ted').innerText, saved: (DB_TASKS.find(x => x.id === 90001) || {}).description || '' }));
    ok('Enter puts @Mary in the description, and it saves with the mention', /@Mary\s+can you book it\?/.test(d.text) && /@Mary\s+can you book it\?/.test(d.saved), d);
    ok('the line under the description says Mary gets a Slack message once it saves', /^Mary gets a Slack message once it saves, from the Hub with your name\./.test(h4 || ''), h4);
    ok('the task drawer has no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  /* 2. goal comments, with the mouse */
  {
    const f = await fresh(browser, { who: 'admin', hash: '#goals', init: MOCK(), wait: 4500 });
    const opened = await f.ev(() => { const b = document.querySelector('[data-glcmt]'); if (b) b.click(); return !!b; });
    await f.page.waitForTimeout(500);
    const has = await f.ev(() => { const i = Array.from(document.querySelectorAll('input[data-glci]')).filter(x => x.offsetParent)[0]; if (i) i.setAttribute('data-w138t', '1'); return !!i; });
    ok('the goal comments open with their input', opened && has);
    if (has) {
      await typeIn(f, 'input[data-w138t]', 'Nice work @ed');
      const p = await pickState(f);
      ok('in a goal comment, @ed opens the picker with Eduardo de Freitas and Edison', p.on && p.names.indexOf('Edison') >= 0 && p.names.indexOf('Eduardo de Freitas') >= 0, p);
      const target = p.names.indexOf('Eduardo de Freitas');
      await f.ev(i => { const it = document.querySelectorAll('#w138pick .it')[i]; it.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); }, target);
      await f.page.waitForTimeout(400);
      const v = await f.ev(() => ({ v: document.querySelector('input[data-w138t]').value, focus: document.activeElement === document.querySelector('input[data-w138t]') }));
      ok('a click picks the full name and keeps the focus in the field', v.v === 'Nice work @Eduardo de Freitas ' && v.focus, v);
      await f.page.waitForTimeout(400);
      const h = await hintOf(f, 'input[data-w138t]');
      ok('the goal comment says Eduardo de Freitas gets a Slack message', /^Eduardo de Freitas gets a Slack message when you post it/.test(h || ''), h);
    }
    ok('the goals page has no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  /* 3. Settings: not connected, then Connect Slack */
  {
    const f = await fresh(browser, { who: 'admin', hash: '#mypage', init: MOCK(), wait: 4000 });
    const nav = []; f.page.on('request', r => { if (r.url().indexOf('slack.com/oauth') >= 0) nav.push(r.url()); });
    await f.ev(() => window.w116Settings('connections'));
    await f.page.waitForTimeout(900);
    const a = await f.ev(() => { const r = document.querySelector('#w138conn .w138row'); return { row: !!r, title: r ? r.querySelector('b').textContent : null, sub: r ? r.querySelector('.s').textContent : null, btn: r ? (r.querySelector('[data-w138c]') || {}).textContent : null, order: Array.from(document.querySelectorAll('.w116js .row b')).map(b => b.textContent).slice(0, 3), calls: window.__FN.filter(x => x.name === 'slack-connect').map(x => x.body.action) }; });
    ok('Settings, Connections has Send @mentions as you under Slack, with Connect Slack', a.row && a.title === 'Send @mentions as you' && a.btn === 'Connect Slack' && a.order[0] === 'Slack' && a.order[1] === 'Send @mentions as you', a);
    ok('it says what happens until you connect', /Connect your Slack account and it comes from you; until then, it comes from the Hub with your name\./.test(a.sub || '') && a.calls.indexOf('status') >= 0, a);
    await f.ev(() => document.querySelector('.w116js [data-jtab="notifications"]').click());
    await f.page.waitForTimeout(300);
    const n = await f.ev(() => { const c = document.querySelector('.w116js input[data-jev="comment_mention"]'); return { box: !!c, checked: c ? c.checked : null, label: c ? c.parentElement.textContent.trim() : null }; });
    ok('Notifications can switch off mention messages', n.box && n.checked === true && /Someone @mentions me in the Hub/.test(n.label || ''), n);
    await f.ev(() => document.querySelector('.w116js [data-jtab="connections"]').click());
    await f.page.waitForTimeout(400);
    await f.ev(() => document.querySelector('#w138conn [data-w138c="start"]').click());
    await f.page.waitForTimeout(900);
    /* the Slack address only comes from slack-connect's start answer (the page then leaves for Slack) */
    ok('Connect Slack asks slack-connect to start and goes to Slack’s page', nav.length === 1 && /user_scope=chat%3Awrite%2Cim%3Awrite/.test(nav[0]), nav);
    await f.close();
  }
  /* 4. Settings: connected, with the latest mentions; the hint says "from you"; Disconnect */
  {
    const MENTIONS = [
      { id: 7, created_at: '2026-09-25T14:00:00Z', from_email: ME, to_name: 'Joy', kind: 'task', ref_title: 'Caption for Nov 9', private: false, dm_status: 'sent', dm_via: 'user', dm_error: null },
      { id: 6, created_at: '2026-09-25T13:00:00Z', from_email: ME, to_name: 'Gamze', kind: 'goal', ref_title: 'Fall volunteers', private: false, dm_status: 'skipped', dm_via: null, dm_error: 'no Slack account found' },
      { id: 5, created_at: '2026-09-24T13:00:00Z', from_email: ME, to_name: 'Kellian', kind: 'committee', ref_title: 'Finance committee', private: true, dm_status: 'sent', dm_via: 'bot', dm_error: null }
    ];
    const f = await fresh(browser, { who: 'admin', hash: '#team/marketing/tasks', init: MOCK({ slack: { ok: true, connected: true, since: '2026-09-25T13:00:00Z', ready: true }, links: [{ email: ME, slack_user_id: 'U02308AHH9N', connected_at: '2026-09-25T13:00:00Z' }], mentions: MENTIONS }), wait: 4500 });
    await f.ev(() => window.w116Board.open(90001));
    await f.page.waitForTimeout(1000);
    await typeIn(f, '#w116cmtx', 'Over to @joy');
    await f.page.keyboard.press('Enter'); await f.page.waitForTimeout(700);
    const h = await hintOf(f, '#w116cmtx');
    ok('once connected, the line says the message comes from me', /^Joy gets a Slack message from you when you post it, with what you wrote and a link back here\.$/.test(h || ''), h);
    await f.ev(() => { document.getElementById('w116cmtx').value = ''; window.w116Board.closeDrawer(); });
    await f.ev(() => window.w116Settings('connections'));
    await f.page.waitForTimeout(900);
    const a = await f.ev(() => { const r = document.querySelector('#w138conn .w138row'); return { sub: r ? r.querySelector('.s').textContent : null, ok: r ? r.querySelector('.s').classList.contains('ok') : null, btn: r ? (r.querySelector('[data-w138c]') || {}).textContent : null, rec: Array.from(document.querySelectorAll('#w138conn .w138rec .r')).map(x => x.textContent.replace(/\s+/g, ' ').trim()) }; });
    ok('connected: On, with Disconnect', /^On\. People you @mention in the Hub get a Slack message from you/.test(a.sub || '') && /Connected Sep 25\./.test(a.sub || '') && a.ok && a.btn === 'Disconnect', a);
    ok('the latest mentions say what happened to each, and a committee note keeps its title out', a.rec.length === 3 && /^Joy, on a task: Caption for Nov 9 .*Sent as you$/.test(a.rec[0]) && /^Gamze, on a goal: Fall volunteers .*Not sent: no Slack account found$/.test(a.rec[1]) && /^Kellian, on a committee note · .*Sent from the Hub$/.test(a.rec[2]), a.rec);
    await f.ev(() => document.querySelector('#w138conn [data-w138c="disconnect"]').click());
    await f.page.waitForTimeout(900);
    const b = await f.ev(() => ({ calls: window.__FN.filter(x => x.name === 'slack-connect').map(x => x.body.action), btn: (document.querySelector('#w138conn [data-w138c]') || {}).textContent, toast: (document.getElementById('toast') || {}).textContent || '' }));
    ok('Disconnect asks slack-connect, then offers Connect Slack again', b.calls.indexOf('disconnect') >= 0 && b.btn === 'Connect Slack' && /Disconnected/.test(b.toast), b);
    ok('Settings has no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  /* 5. back from Slack */
  {
    const f = await fresh(browser, { who: 'admin', hash: '?slack=connected#mypage', init: MOCK({ slack: { ok: true, connected: true, since: '2026-09-26T13:00:00Z', ready: true } }), wait: 5000 });
    const a = await f.ev(() => ({ search: location.search, hash: location.hash, banner: (document.querySelector('#w138conn .w138banner') || {}).textContent || null, err: !!document.querySelector('#w138conn .w138banner.err'), btn: (document.querySelector('#w138conn [data-w138c]') || {}).textContent }));
    ok('back from Slack: the address is clean, Settings opens and says Slack is connected', a.search === '' && a.hash === '#mypage' && /^Slack is connected\./.test(a.banner || '') && !a.err && a.btn === 'Disconnect', a);
    await f.close();
    const g = await fresh(browser, { who: 'admin', hash: '?slack=error&why=' + encodeURIComponent('That Slack account is someone@gmail.com, not steel.macdonald@welfareavenue.com.') + '#mypage', init: MOCK(), wait: 5000 });
    const b = await g.ev(() => ({ search: location.search, banner: (document.querySelector('#w138conn .w138banner') || {}).textContent || null, err: !!document.querySelector('#w138conn .w138banner.err') }));
    ok('an error from Slack shows why', b.search === '' && b.err && /That Slack account is someone@gmail\.com/.test(b.banner || ''), b);
    ok('coming back from Slack has no page errors', f.errs.length === 0 && g.errs.length === 0, f.errs.concat(g.errs));
    await g.close();
  }
  /* 6. a member (HR profile) mentions too; a director has no Settings row but the picker works in board mode */
  {
    const f = await fresh(browser, { who: 'member', hash: '#team/hr/tasks', init: MOCK(), wait: 4500 });
    const tid = await f.ev(() => { const t = (DB_TASKS || []).filter(x => x.department === 'hr' && !x.done)[0]; if (t) window.w116Board.open(t.id); return t ? t.id : null; });
    await f.page.waitForTimeout(1000);
    if (tid) {
      await typeIn(f, '#w116cmtx', 'Hi @tu');
      const p = await pickState(f);
      ok('a member gets the picker too', p.on && p.names[0] === 'Tuna', p);
    } else ok('a member gets the picker too (an HR task to open)', false, 'no HR task in the fixture');
    ok('the member view has no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw138drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
