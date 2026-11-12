/* =====================================================================
   WA v320 Ask the Hub reaches out (12/11/26)
   =====================================================================
   Steel (12/11/26): "I want ask the hub to engage individuals more often to have them ask questions, submit requests,
   and do other really cool actions within the hub - it should be agentic, support it on progression to completing
   tasks". His choices the same night: it may start the conversation inside the Hub (Slack DMs and email come in a
   later wave, on his yes to the words and the people); actions stay confirm-first (wave38's cards); the running cost
   stays near today's. So everything here is worked out on the page from what the Hub already holds, and a model is
   called only when the person taps something that asks a question.

   - The Hub suggests (#w320box): when Ask the Hub opens on an empty thread, up to three cards about the person's own
     work (tasks past their date, mentions not read, requests waiting on them, tasks due this week, their team page
     still locked, tasks with no date), each with one tap, then "I can also": four tiles that say what Ask the Hub
     does beside answering (file a request, add a task, find a page, find a document). Try asking (wave81) stays under it.
   - Help me finish this: on a card and in the task drawer (#w116dr, beside Mark done). It asks Ask the Hub for the
     next three steps, where to go, and follow-ups to confirm. Never offered on a confidential, board-only, restricted
     or banked task: their titles are not put into a question.
   - The note (#w320peek): once a day per device at most, one line beside the Ask button, never over a window, a tour
     or wave272's install note. Not today hides it for the day; Stop these notes turns the notes off (wa320.off) and
     the box in the chat offers to turn them back on.
   - A dot on the Ask button (and on the phone bar's Ask) while there is something to look at today.
   - The starter prompts (wave81) send on one tap.
   - The Ask button says its name for six seconds on a person's first three visits (wave134's hover state).
   - Motion: the note grows from the button, 200 ms ease-out, and leaves in 140 ms; the cards rise 6 px with a 40 ms
     stagger, once, on open; a confirmed card's answer fades in with a drawn tick. Nothing moves under reduced motion;
     hover only where a pointer hovers; buttons press to .97.
   - Phones: a 44 px touch area for the small controls on Home (I'm in, How this page works, the Get started links
     and ticks, the announcements' links, Got it).
   - Whose task it is (patch320.py, in waTasksOf, wave109 and wave54): the owner must hold the person's first name as a
     whole word, as wa237_due_check already asks; "Ian" used to match "Brianna" too (4 open tasks on 12/11/26).
   Reads: DB_TASKS and DB_ASSIGN, mentions (own, not seen), dept_requests (open, assigned to the person),
   w260.lockedFor. Writes nothing to the database. Storage on this device: wa320.off, wa320.peek, wa320.seen,
   wa320.visits. window.w320 = { suggest, paint, peek, coach, mine, blocked, state }. ASCII only.
   ===================================================================== */
(function () {
  if (window.__wa320) return; window.__wa320 = true;
  var GREEN = '#103F39', GOLD = '#DCA527', CREAM = '#FFFAF2', INK = '#1F201E', MUTED = '#585B57';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif", HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var OUT = 'cubic-bezier(.23,1,.32,1)';
  var S = { at: 0, list: null, busy: null, tries: 0, peekTimer: null, hideTimer: null };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* private window */ } }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function today() { return iso(new Date()); }
  function plus(n) { var d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
  function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...' : s; }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function phone() { try { return matchMedia('(max-width: 900px)').matches; } catch (e) { return false; } }
  function off() { return lsGet('wa320.off') === '1'; }
  function lower(s) { return String(s || '').toLowerCase().trim(); }
  function me() {
    try { if (typeof WA_ME !== 'undefined' && WA_ME && WA_ME.name) return WA_ME; } catch (e) { /* fine */ }
    try {
      var em = lower(typeof USER !== 'undefined' && USER && USER.email);
      return (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).filter(function (m) { return em && lower(m.email) === em; })[0] || null;
    } catch (e2) { return null; }
  }
  function firstName(m) { return String((m && m.name) || '').trim().split(/\s+/)[0] || ''; }
  function teamLabel(d) { try { return (window.WA_TEAMS && WA_TEAMS.labels && WA_TEAMS.labels[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || ''; } catch (e) { return ''; } }
  function client() { try { return typeof db !== 'undefined' ? db : null; } catch (e) { return null; } }

  /* ---------- what is the person's own ---------- */
  function hiddenTask(t) { return !!(t.confidential || t.board_only || t.banked_at || (t.visibility && t.visibility !== 'department')); }
  function mine() {
    var m = me(); if (!m) return [];
    var ft = lower(firstName(m)), full = lower(m.name), asg = {};
    try { (typeof DB_ASSIGN !== 'undefined' ? DB_ASSIGN : []).forEach(function (a) { if (String(a.member_id) === String(m.id)) asg[String(a.task_id)] = 1; }); } catch (e) { /* fine */ }
    var all = []; try { all = typeof DB_TASKS !== 'undefined' ? DB_TASKS : []; } catch (e2) { all = []; }
    return all.filter(function (t) {
      if (t.done || t.banked_at) return false;
      if (asg[String(t.id)]) return true;
      var o = lower(t.owner); if (!o || !ft) return false;
      return o === full || o.split(/[^a-z0-9\u00c0-\u024f-]+/).indexOf(ft) >= 0;   /* a whole word, so Ian is not Brianna */
    });
  }
  function byDue(a, b) { return String(a.due_date || '9999') < String(b.due_date || '9999') ? -1 : 1; }
  async function countMentions(m) {
    var c = client(); if (!c || !m) return 0;
    try { var r = await c.from('mentions').select('id,seen').eq('person', m.name).eq('seen', false).limit(60); return ((r && r.data) || []).filter(function (x) { return !x.seen; }).length; } catch (e) { return 0; }
  }
  async function waitingOnMe(m) {
    var c = client(); if (!c || !m) return [];
    try {
      var r = await c.from('dept_requests').select('id,title,assignee,done,needed_by').eq('done', false).limit(400);
      var ft = lower(firstName(m)), full = lower(m.name);
      return ((r && r.data) || []).filter(function (x) { var a = lower(x.assignee); return !x.done && a && (a === full || a.split(/\s+/)[0] === ft); });
    } catch (e) { return []; }
  }
  function lockedTeam(m) {
    try { var d = m && m.department; if (!d || !window.w260 || !w260.lockedFor) return ''; return w260.lockedFor(d) ? d : ''; } catch (e) { return ''; }
  }

  /* ---------- the suggestions ---------- */
  function n1(n, one, many) { return n === 1 ? one : many.replace('N', String(n)); }
  /* my open tasks as one short string: when it changes (a task ticked, a date moved in the due-date check), the cards are stale */
  function sig() { try { return today() + '/' + mine().map(function (t) { return t.id + ':' + (t.due_date || ''); }).join('|'); } catch (e) { return ''; } }
  async function suggest(force) {
    var sg = sig();
    if (!force && S.list && S.sig === sg && Date.now() - S.at < 120000) return S.list;
    if (S.busy) return S.busy;
    S.busy = (async function () {
      var m = me(), out = [];
      if (!m) { S.list = []; S.sig = sg; S.at = Date.now(); return S.list; }
      var tasks = mine(), t0 = today(), week = plus(7);
      var late = tasks.filter(function (t) { return t.due_date && t.due_date < t0; }).sort(byDue);
      var soon = tasks.filter(function (t) { return t.due_date && t.due_date >= t0 && t.due_date <= week; }).sort(byDue);
      var undated = tasks.filter(function (t) { return !t.due_date; });
      /* the two counts that need the database are kept two minutes; the task cards are worked out fresh each time */
      if (force || !S.net || Date.now() - S.netAt > 120000) { S.net = await Promise.all([countMentions(m), waitingOnMe(m)]); S.netAt = Date.now(); }
      var pair = S.net;
      var men = pair[0], reqs = pair[1], lock = lockedTeam(m);
      var open1 = function (list) { return list.filter(function (t) { return !hiddenTask(t); })[0] || null; };
      if (late.length) {
        var lt = open1(late);
        out.push({ k: 'late', n: late.length, say: n1(late.length, '1 task past its date', 'N tasks past their date'),
          t: n1(late.length, '1 task is past its date', 'N tasks are past their date'),
          d: lt ? 'Oldest: ' + clip(lt.title, 64) : 'Open them and set a date that holds.', user: !!lt,
          a: (lt ? [{ l: 'Help me finish', act: 'coach', id: lt.id, pri: 1 }] : []).concat([{ l: 'See my tasks', act: 'tasks', pri: lt ? 0 : 1 }]) });
      }
      if (men) out.push({ k: 'men', n: men, say: n1(men, '1 mention to read', 'N mentions to read'),
        t: n1(men, 'You were mentioned in a meeting', 'You were mentioned N times'), d: 'Read what was said, then tick Got it.',
        a: [{ l: 'Read them', act: 'mentions', pri: 1 }] });
      if (reqs.length) out.push({ k: 'req', n: reqs.length, say: n1(reqs.length, '1 request waiting on you', 'N requests waiting on you'),
        t: n1(reqs.length, '1 request is waiting on you', 'N requests are waiting on you'), d: 'First: ' + clip(reqs[0].title, 64), user: true,
        a: [{ l: 'Open them', act: 'go', h: '#requests', pri: 1 }] });
      if (!late.length && soon.length) {
        var st = open1(soon);
        out.push({ k: 'soon', n: soon.length, say: n1(soon.length, '1 task due in the next 7 days', 'N tasks due in the next 7 days'),
          t: n1(soon.length, '1 task is due in the next 7 days', 'N tasks are due in the next 7 days'),
          d: st ? 'Next: ' + clip(st.title, 64) : 'A head start today makes the week lighter.', user: !!st,
          a: (st ? [{ l: 'Help me start', act: 'coach', id: st.id, pri: 1 }] : []).concat([{ l: 'See my tasks', act: 'tasks', pri: st ? 0 : 1 }]) });
      }
      if (lock) out.push({ k: 'lock', n: 1, say: 'your team page to unlock',
        t: 'Your team page is one short tour away', d: 'Take the tour once and ' + (teamLabel(lock) || 'your team page') + ' opens for good.',
        a: [{ l: 'Take the tour', act: 'go', h: '#team/' + lock, pri: 1 }] });
      if (undated.length > 1 && out.length < 3) out.push({ k: 'undated', n: undated.length, say: 'N tasks with no date'.replace('N', String(undated.length)),
        t: 'N of your tasks have no date'.replace('N', String(undated.length)), d: 'A date keeps them from slipping.',
        a: [{ l: 'See my tasks', act: 'tasks', pri: 1 }] });
      S.real = out.length;
      if (!out.length) out.push({ k: 'clear', n: 0, say: '', t: 'You are all caught up', d: 'Want to see what your team is working on this week?',
        a: [{ l: 'Ask the Hub', act: 'ask', q: 'What is my team working on this week?', pri: 1 }] });
      S.list = out.slice(0, 3); S.sig = sg; S.at = Date.now();
      return S.list;
    })();
    try { return await S.busy; } finally { S.busy = null; }
  }

  /* ---------- asking, going ---------- */
  function panelEl() { return document.getElementById('waChatPanel'); }
  function panelOpen() { var p = panelEl(); return !!(p && p.style.display === 'flex'); }
  function threadEmpty() { var m = document.getElementById('wacMsgs'); return !m || m.querySelectorAll('.wac-m').length <= 1; }
  function openPanel() {
    if (panelOpen()) return;
    if (typeof window.w75Open === 'function') { try { window.w75Open(); return; } catch (e) { /* fall through */ } }
    var b = document.getElementById('waChatBtn'); if (b) b.click();
  }
  function closePanel() { var x = document.getElementById('w81close'); if (x && panelOpen()) x.click(); }
  function ask(q, send) {
    openPanel();
    setTimeout(function () {
      var inp = document.getElementById('w38in') || document.getElementById('wacInput'); if (!inp) return;
      inp.value = q; try { inp.focus(); } catch (e) { /* fine */ }
      if (send) { var b = document.getElementById('w38send') || document.getElementById('wacSend'); if (b) b.click(); unbox(); }
      else { try { inp.setSelectionRange(q.length, q.length); } catch (e2) { /* fine */ } }
    }, 80);
  }
  function taskOf(id) { try { return (typeof DB_TASKS !== 'undefined' ? DB_TASKS : []).filter(function (t) { return String(t.id) === String(id); })[0] || null; } catch (e) { return null; } }
  function coach(id) {
    var t = taskOf(id); if (!t || hiddenTask(t) || t.done) return false;
    var bits = []; var tl = teamLabel(t.department); if (tl) bits.push(tl); if (t.due_date) bits.push('due ' + t.due_date);
    ask('Help me finish my task "' + clip(t.title, 160) + '"' + (bits.length ? ' (' + bits.join(', ') + ')' : '') + '. Give me the next three steps, tell me which page, document or person in the Hub can help, and offer any follow-up task or request for me to confirm.', true);
    return true;
  }
  function go(h, sel) {
    closePanel();
    try { if (location.hash !== h) location.hash = h; } catch (e) { /* fine */ }
    if (sel) setTimeout(function () { try { var el = document.querySelector(sel); if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (e2) { /* fine */ } }, 700);
  }
  function run(a) {
    if (!a) return;
    if (a.act === 'coach') { if (!coach(a.id)) go('#mypage', '.w272lt, #mpBody'); }
    else if (a.act === 'tasks') go('#mypage', '.w272lt, #mpBody');
    else if (a.act === 'mentions') go('#mypage', '#w65menbox, .w74men');
    else if (a.act === 'go') go(a.h);
    else if (a.act === 'ask') ask(a.q, true);
    else if (a.act === 'fill') ask(a.q, false);
  }

  /* ---------- the box in the chat ---------- */
  var TILES = [
    { l: 'File a request', act: 'fill', q: 'Put in a request to ' },
    { l: 'Add a task', act: 'fill', q: 'Add a task for me: ' },
    { l: 'Find a page', act: 'fill', q: 'Where do I find ' },
    { l: 'Find a document', act: 'fill', q: 'Find the document about ' }
  ];
  var ACTS = {};
  function unbox() { var b = document.getElementById('w320box'); if (b) b.remove(); }
  function boxHtml(list) {
    ACTS = {}; var n = 0;
    var btn = function (a) { n += 1; ACTS['a' + n] = a; return '<button type="button" class="' + (a.pri ? 'pri' : 'sec') + '" data-w320a="a' + n + '">' + E(a.l) + '</button>'; };
    var cards = list.map(function (s, i) {
      return '<div class="w320card" style="--i:' + i + '"><div class="w320tx"><b>' + E(s.t) + '</b><span' + (s.user ? ' data-w198skip=""' : '') + '>' + E(s.d) + '</span></div><div class="w320acts">' + s.a.map(btn).join('') + '</div></div>';
    }).join('');
    var tiles = TILES.map(function (t) { n += 1; ACTS['a' + n] = t; return '<button type="button" data-w320a="a' + n + '">' + E(t.l) + '</button>'; }).join('');
    var sw = off() ? '<p class="w320off">Daily notes are off. <button type="button" data-w320on="1">Turn them on</button></p>' : '';
    return '<div class="w320h">The Hub suggests</div>' + cards + '<div class="w320h two">I can also</div><div class="w320tiles">' + tiles + '</div>' + sw;
  }
  async function paint() {
    var p = panelEl(); if (!p || !panelOpen()) return;
    if (!threadEmpty()) { unbox(); return; }
    var m = me(); if (!m) return;
    var list; try { list = await suggest(); } catch (e) { list = []; }
    if (!panelOpen() || !threadEmpty()) { unbox(); return; }
    var box = document.getElementById('w320box'), fresh = !box;
    if (!box) { box = document.createElement('div'); box.id = 'w320box'; }
    box.className = fresh && !reduced() ? 'in' : '';
    box.innerHTML = boxHtml(list || []);
    var before = p.querySelector('.w81chips') || p.querySelector('.wac-in:not([style*="none"])') || null;
    if (box.parentNode !== p || box.nextSibling !== before) p.insertBefore(box, before);
    lsSet('wa320.seen', today()); mark();
  }

  /* ---------- the dot and the note ---------- */
  function mark() {
    var on = !!(S.real && lsGet('wa320.seen') !== today() && !off());
    try { document.body.classList.toggle('w320has', on); } catch (e) { /* fine */ }
  }
  function blocked() {
    try {
      var g = document.getElementById('gate'); if (g && g.style.display !== 'none') return true;
      if (panelOpen() || document.body.classList.contains('wa-mob-open')) return true;
      var ae = document.activeElement;   /* the person is typing somewhere: the note waits */
      if (ae && ae !== document.body && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName || ''))) return true;
      var tip = document.getElementById('w272tip'); if (tip && tip.classList.contains('on')) return true;
      try { var st = window.w122 && w122.state && w122.state(); if (st && st.T) return true; } catch (e0) { /* fine */ }
      var sels = ['#w213pop', '#w177pop', '#w84back', '#w262new', '#w227pop', '#w272sheet', '#w163sheet', '#w260lock', '#w116dr.open', '[role="dialog"]', '[aria-modal="true"]'];
      for (var i = 0; i < sels.length; i++) {
        var els = document.querySelectorAll(sels[i]);
        for (var j = 0; j < els.length; j++) { var el = els[j]; if (el.id === 'w320peek') continue; var r = el.getBoundingClientRect(); var cs = getComputedStyle(el); if (r.width > 40 && r.height > 40 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05) return true; }
      }
    } catch (e) { return true; }
    return false;
  }
  function hidePeek(why) {
    var el = document.getElementById('w320peek'); if (!el) return;
    clearTimeout(S.hideTimer);
    el.classList.remove('on');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduced() ? 0 : 160);
    if (why === 'stop') lsSet('wa320.off', '1');
    mark();
  }
  async function peek(force) {
    if (!force) { if (off() || lsGet('wa320.peek') === today()) return false; }
    if (document.getElementById('w320peek')) return false;
    var m = me(); if (!m) return false;
    var list; try { list = await suggest(); } catch (e) { return false; }
    mark();
    var real = (list || []).filter(function (s) { return s.k !== 'clear'; });
    if (!real.length) return false;
    if (blocked()) return false;
    var total = real.length, says = real.slice(0, 2).map(function (s) { return s.say; });
    var line = 'Hi ' + E(firstName(m)) + ', ' + E(says.join(' and ')) + '.' + (total > 2 ? ' And one more thing.' : '');
    var el = document.createElement('div'); el.id = 'w320peek'; el.setAttribute('role', 'status');
    el.innerHTML = '<p>' + line + '</p><div class="row"><button type="button" class="go" data-w320peek="show">Show me</button><button type="button" class="later" data-w320peek="later">Not today</button></div><button type="button" class="stop" data-w320peek="stop">Stop these notes</button>';
    document.body.appendChild(el);
    try {   /* never on top of something else, never under it */
      var r = el.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && !el.contains(top)) { var z = top.closest ? top.closest('[role="dialog"],[aria-modal="true"],.modal,#w272tip') : null; if (z) { el.parentNode.removeChild(el); return false; } }
    } catch (e3) { /* fine */ }
    lsSet('wa320.peek', today());
    void el.offsetWidth; el.classList.add('on');
    var arm = function () { clearTimeout(S.hideTimer); S.hideTimer = setTimeout(function () { hidePeek('time'); }, 14000); };
    arm(); el.addEventListener('pointerenter', function () { clearTimeout(S.hideTimer); }); el.addEventListener('pointerleave', arm);
    return true;
  }
  function tryPeek() {
    S.tries += 1;
    peek().then(function (ok) { if (!ok && S.tries < 3 && !off() && lsGet('wa320.peek') !== today()) S.peekTimer = setTimeout(tryPeek, S.tries === 1 ? 14000 : 30000); }).catch(function () { /* fine */ });
  }

  /* ---------- the task drawer: Help me finish this ---------- */
  function drawerTaskId() { try { var h = document.querySelector('#w116dr .w116drh'); var m = h && h.textContent.match(/#(\d+)/); return m ? Number(m[1]) : null; } catch (e) { return null; } }
  function drawerButton() {
    try {
      var dr = document.getElementById('w116dr'); if (!dr) return;
      var foot = dr.querySelector('.w116drf'); if (!foot || foot.querySelector('[data-w320help]')) return;
      var t = taskOf(drawerTaskId()); if (!t || t.done || hiddenTask(t)) return;
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-w320help', '1'); b.textContent = 'Help me finish this';
      b.title = 'Ask the Hub for the next steps, where to go and what to line up';
      var first = foot.querySelector('button'); if (first && first.nextSibling) foot.insertBefore(b, first.nextSibling); else foot.appendChild(b);
    } catch (e) { /* cosmetic */ }
  }
  function watchDrawer() {
    var dr = document.getElementById('w116dr');
    if (dr && !dr.__w320) { dr.__w320 = true; try { new MutationObserver(function () { drawerButton(); }).observe(dr, { childList: true }); } catch (e) { /* fine */ } drawerButton(); }
  }

  /* ---------- clicks ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var a = t.closest('[data-w320a]');
    if (a) { e.preventDefault(); run(ACTS[a.getAttribute('data-w320a')]); return; }
    var pk = t.closest('[data-w320peek]');
    if (pk) { var k = pk.getAttribute('data-w320peek'); hidePeek(k); if (k === 'show') { openPanel(); setTimeout(paint, 90); } return; }
    if (t.closest('[data-w320on]')) { lsDel('wa320.off'); paint(); return; }
    var hb = t.closest('[data-w320help]');
    if (hb) { var id = drawerTaskId(); var x = document.querySelector('#w116dr [data-dact="close"]'); if (x) x.click(); setTimeout(function () { coach(id); }, 60); return; }
    if (t.closest('#waChatBtn') || t.closest('#w163bar [data-w163slot="ask"]') || t.closest('[data-w114ask]')) { hidePeek('open'); setTimeout(paint, 90); return; }
    var chip = t.closest('#waChatPanel .w81chip');
    if (chip) { setTimeout(function () { var b = document.getElementById('w38send') || document.getElementById('wacSend'); var inp = document.getElementById('w38in') || document.getElementById('wacInput'); if (b && inp && inp.value) { b.click(); unbox(); } }, 0); return; }
    if (t.closest('#w38send') || t.closest('#wacSend')) { setTimeout(function () { if (!threadEmpty()) unbox(); }, 60); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { hidePeek('later'); return; }
    if (e.key === 'Enter' && e.target && (e.target.id === 'w38in' || e.target.id === 'wacInput')) setTimeout(function () { if (!threadEmpty()) unbox(); }, 60);
  });

  /* ---------- styles ---------- */
  var css = ''
    + '#w320box{flex:0 1 auto;max-height:54vh;overflow-y:auto;padding:4px 12px 6px;font-family:' + BODY + ';-webkit-overflow-scrolling:touch;}'
    + '#w320box .w320h{font:600 11px/1.2 ' + BODY + ';letter-spacing:.08em;text-transform:uppercase;color:' + MUTED + ';margin:6px 2px 6px;}'
    + '#w320box .w320h.two{margin-top:12px;}'
    + '#w320box .w320card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;background:' + CREAM + ';border-radius:14px;box-shadow:inset 0 0 0 1px rgba(16,63,57,.12);padding:10px 10px 10px 12px;margin:0 0 6px;}'
    + '#w320box .w320card b{display:block;font:600 14px/1.3 ' + BODY + ';color:' + GREEN + ';}'
    + '#w320box .w320card span{display:block;font-size:12.5px;line-height:1.35;color:' + MUTED + ';margin-top:2px;overflow-wrap:anywhere;}'
    + '#w320box .w320acts{display:flex;flex-direction:column;align-items:stretch;gap:2px;}'
    + '#w320box .w320acts button{border:0;font-family:' + BODY + ';cursor:pointer;transition:transform 120ms ' + OUT + ';white-space:nowrap;}'
    + '#w320box .w320acts .pri{min-height:36px;padding:0 13px;border-radius:11px;background:' + GREEN + ';color:' + CREAM + ';font-weight:600;font-size:13px;line-height:1;}'
    + '#w320box .w320acts .sec{min-height:26px;padding:0 4px;background:none;color:' + GREEN + ';font-weight:500;font-size:12.5px;line-height:1;text-decoration:underline;text-underline-offset:2px;}'
    + '#w320box .w320tiles{display:grid;grid-template-columns:1fr 1fr;gap:6px;}'
    + '#w320box .w320tiles button{min-height:38px;padding:6px 10px;text-align:left;border:0;border-radius:11px;background:rgba(16,63,57,.05);color:' + GREEN + ';font:500 13px/1.25 ' + BODY + ';cursor:pointer;transition:transform 120ms ' + OUT + ',background 120ms ease;}'
    + '#w320box button:active,#w320peek button:active{transform:scale(.97);}'
    + '#w320box button:focus-visible,#w320peek button:focus-visible,#w116dr [data-w320help]:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
    + '#w320box .w320off{font-size:12.5px;color:' + MUTED + ';margin:9px 2px 0;}'
    + '#w320box .w320off button{border:0;background:none;padding:0;color:' + GREEN + ';font:600 12.5px/1.2 ' + BODY + ';text-decoration:underline;cursor:pointer;}'
    + '@media (hover:hover) and (pointer:fine){#w320box .w320tiles button:hover{background:rgba(16,63,57,.1);}#w320box .w320acts .pri:hover{background:#0c332e;}#w320peek .later:hover{background:rgba(255,250,242,.2);}}'
    + '#w320box.in .w320card{animation:w320rise 200ms ' + OUT + ' both;animation-delay:calc(var(--i) * 40ms);}'
    + '@keyframes w320rise{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}'
    /* the note beside the Ask button */
    + '#w320peek{position:fixed;z-index:61;right:22px;bottom:88px;width:292px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:14px 16px 10px;border-radius:18px 18px 6px 18px;background:' + GREEN + ';color:' + CREAM + ';font-family:' + BODY + ';box-shadow:0 12px 34px rgba(16,24,22,.26);opacity:0;transform:scale(.96);transform-origin:100% 100%;transition:opacity 140ms ease,transform 140ms ' + OUT + ';}'
    + '#w320peek.on{opacity:1;transform:none;transition:opacity 200ms ease,transform 200ms ' + OUT + ';}'
    + '#w320peek p{margin:0 0 11px;font-size:14.5px;line-height:1.4;}'
    + '#w320peek .row{display:flex;gap:8px;}'
    + '#w320peek .go{min-height:38px;padding:0 16px;border:0;border-radius:11px;background:' + GOLD + ';color:' + GREEN + ';font:600 15px/1 ' + HEAD + ';letter-spacing:.04em;text-transform:uppercase;cursor:pointer;transition:transform 120ms ' + OUT + ';}'
    + '#w320peek .later{min-height:38px;padding:0 13px;border:0;border-radius:11px;background:rgba(255,250,242,.12);color:' + CREAM + ';font:500 13.5px/1 ' + BODY + ';cursor:pointer;transition:transform 120ms ' + OUT + ',background 120ms ease;}'
    + '#w320peek .stop{display:block;margin:8px 0 0;padding:6px 0;border:0;background:none;color:rgba(255,250,242,.78);font:500 12px/1.2 ' + BODY + ';text-decoration:underline;cursor:pointer;}'
    + '@media (max-width:900px){#w320peek{right:12px;left:12px;width:auto;bottom:calc(78px + env(safe-area-inset-bottom));border-radius:18px;transform-origin:50% 100%;}}'
    /* the dot */
    + 'body.w320has #waChatBtn::after,body.w320has #w163bar button[data-w163slot="ask"] .pill::after{content:"";position:absolute;width:11px;height:11px;border-radius:50%;background:#B3402F;box-shadow:0 0 0 2px ' + CREAM + ';}'
    + 'body.w320has #waChatBtn::after{top:2px;right:2px;}'
    + '#w163bar button[data-w163slot="ask"] .pill{position:relative;}body.w320has #w163bar button[data-w163slot="ask"] .pill::after{top:-3px;right:6px;}'
    /* the Ask button says its name on the first visits (wave134's hover state) */
    + 'html body #waChatBtn.w134fab.w320hello{padding:0 20px !important;}'
    + '#waChatBtn.w134fab.w320hello .w134a{max-width:90px;opacity:1;}#waChatBtn.w134fab.w320hello .w134b{max-width:70px;opacity:1;}'
    /* the task drawer */
    + '#w116dr .w116drf [data-w320help]{background:' + GOLD + ';color:' + GREEN + ';border-color:' + GOLD + ';font-weight:600;}'
    /* a confirmed card: the answer arrives with a drawn tick */
    + '.wac-card.decided .res:not(.err){display:flex;align-items:center;gap:7px;animation:w320res 160ms ' + OUT + ' both;}'
    + '.wac-card.decided .res:not(.err)::before{content:"";flex:none;width:9px;height:5px;margin:0 2px 3px 3px;border-left:2px solid ' + GREEN + ';border-bottom:2px solid ' + GREEN + ';transform:rotate(-45deg);transform-origin:50% 50%;animation:w320tick 200ms ' + OUT + ' 60ms both;}'
    + '@keyframes w320res{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}'
    + '@keyframes w320tick{from{opacity:0;transform:rotate(-45deg) scale(.6);}to{opacity:1;transform:rotate(-45deg) scale(1);}}'
    /* phones: a 44 px touch area for the small controls on Home */
    + '@media (pointer:coarse){#w192go,.w43help,.w180btn.sm,.w180lnk,#w112card .w112links a,.w65got{position:relative;}'
    + '#w192go::after,.w43help::after,.w180btn.sm::after,.w180lnk::after,#w112card .w112links a::after,.w65got::after{content:"";position:absolute;left:-4px;right:-4px;top:50%;height:44px;transform:translateY(-50%);}'
    + '#w112card .w112step input[type=checkbox]{width:28px;height:28px;margin:8px 10px 8px 0;flex:none;}}'
    + '@media (prefers-reduced-motion: reduce){#w320box.in .w320card,.wac-card.decided .res:not(.err),.wac-card.decided .res:not(.err)::before{animation:none;}#w320peek,#w320peek.on{transition:opacity 120ms ease;transform:none;}#w320box button,#w320peek button{transition:none;}}';
  if (!document.getElementById('wa320css')) { var st = document.createElement('style'); st.id = 'wa320css'; st.textContent = css; (document.head || document.documentElement).appendChild(st); }

  /* ---------- start ---------- */
  function hello() {
    var b = document.getElementById('waChatBtn'); if (!b) return;
    try { b.title = 'Ask the Hub anything, or have it file a request or add a task'; if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', 'Ask the Hub'); } catch (e) { /* fine */ }
    var n = Number(lsGet('wa320.visits') || 0);
    if (n < 3 && !phone() && b.classList.contains('w134fab')) {
      lsSet('wa320.visits', String(n + 1));
      setTimeout(function () { b.classList.add('w320hello'); setTimeout(function () { b.classList.remove('w320hello'); }, 6000); }, 2500);
    }
  }
  function boot() {
    try { hello(); } catch (e) { /* fine */ }
    try { watchDrawer(); new MutationObserver(function () { watchDrawer(); }).observe(document.body, { childList: true }); } catch (e2) { /* fine */ }
    if (typeof window.w75Open === 'function' && !window.w75Open.__w320) {
      var o75 = window.w75Open;
      window.w75Open = function () { var r = o75.apply(this, arguments); try { setTimeout(paint, 90); } catch (e3) { /* fine */ } return r; };
      window.w75Open.__w320 = true;
    }
    setTimeout(function () { suggest().then(mark).catch(function () { /* fine */ }); }, 3500);
    S.peekTimer = setTimeout(tryPeek, 8000);
  }
  if (typeof startApp === 'function') {
    var __sa320 = startApp;
    startApp = async function () {
      var r = await __sa320.apply(this, arguments);
      try { boot(); } catch (e) { console.warn('wave320 boot', e); }
      return r;
    };
  }
  window.w320 = { suggest: suggest, paint: paint, peek: peek, coach: coach, mine: mine, blocked: blocked, state: function () { return S; } };
})();

