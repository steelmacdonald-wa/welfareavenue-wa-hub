
  /* ---------- helpers ---------- */
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function boardMode() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function staffUser() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function mine() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE) || null; } catch (e) { return null; } }
  function allowedList() { try { return (typeof wa40Allowed === 'function' && wa40Allowed()) || []; } catch (e) { return []; } }
  function knownTabs() { try { return (typeof WA40_TABS !== 'undefined' && WA40_TABS) || []; } catch (e) { return []; } }
  function rootOf(h) { var s = String(h || ''); try { s = decodeURIComponent(s); } catch (e) { /* keep */ } return s.replace(/^#/, '').split('/')[0]; }
  function activeId() { var a = document.querySelector('.panel.active'); return a ? a.id : ''; }
  var SVG = {
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    key: '<circle cx="8" cy="15" r="3.6"/><path d="M10.6 12.4 19 4M16 7l2.5 2.5M14 9l2 2"/>'
  };
  function svg(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (SVG[n] || '') + '</svg>'; }

  /* ---------- 6. the pages the board view opens, and the notice ---------- */
  /* roots that are the Executive dashboard itself */
  var OV = ['', 'overview', 'decisions', 'decision'];
  var TEAM_LABEL = (window.WA_TEAMS && window.WA_TEAMS.labels) || {};
  var LABEL = {
    dashboard: ['Delivery numbers', 1], needsme: ['Needs me', 1], 'needs-me': ['Needs me', 1], activity: ['Activity', 1],
    transcripts: ['The transcript archive', 1], tx: ['Transcripts', 0], requests: ['Requests', 0], agendas: ['Agendas', 0],
    mypage: ['My page', 1], orgchart: ['The org chart', 1], goals: ['Department goals', 0], projects: ['Projects', 0],
    project: ['Project pages', 0], goalmap: ['Goal alignment', 1], orggoals: ['Organizational goals', 0], create: ['The Create studio', 1],
    volunteering: ['Volunteering', 1], finances: ['Finances', 0], training: ['The training academy', 1], adminpanel: ['Admin', 1],
    brain: ['The Brain', 1], hubmail: ['The Hub inbox', 1], hrcentre: ['The HR centre', 1], team: ['Team pages', 0], dept: ['Team pages', 0],
    person: ['People pages', 0], personpage: ['People pages', 0], task: ['Tasks', 0], importantinfo: ['Important info', 1]
  };
  /* the pages a director can open, in menu order */
  var BOARD_PAGES = [['governance', 'Board overview'], ['committees', 'Committees'], ['overview', 'Executive dashboard'], ['calendar', 'Calendar'], ['fundevents', 'Events calendar'], ['socialstats', 'Marketing analytics'], ['contentcal', 'Content calendar'], ['photos', 'Photo library']];
  function labelOf(root) {
    if (LABEL[root]) return LABEL[root];
    if (TEAM_LABEL[root]) return [TEAM_LABEL[root], 1];
    var tab = document.querySelector('nav .tab[data-tab="' + String(root).replace(/"/g, '') + '"]');
    var t = tab ? String(tab.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return t ? [t, 1] : ['That page', 1];
  }
  function sentence(root, rest) { var l = labelOf(root); return l[0] + (l[1] ? ' is ' : ' are ') + rest; }
  function itThem(root) { return labelOf(root)[1] ? 'it' : 'them'; }
  function boardOk(root) {
    if (OV.indexOf(root) >= 0) return true;
    if (/[=&]/.test(root)) return true;
    return allowedList().indexOf(root) >= 0 || root === 'importantinfo';
  }
  /* staff: a menu page their access profile leaves out */
  function staffDenied(root) {
    if (!root || OV.indexOf(root) >= 0 || /[=&]/.test(root)) return false;
    if (['needsme', 'needs-me', 'personpage', 'projectpage', 'volunteering', 'importantinfo', 'person', 'project', 'task', 'tx', 'team', 'dept'].indexOf(root) >= 0) return false;
    if (knownTabs().indexOf(root) < 0) return false;
    return !!mine() && allowedList().indexOf(root) < 0;
  }
  var DENY = { req: rootOf(location.hash), t: null, closed: null };
  function hideDeny() { var el = document.getElementById('w130deny'); if (el && el.parentNode) el.parentNode.removeChild(el); }
  function showDeny(root, kind) {
    var panel = document.getElementById('overview'); if (!panel) return;
    var el = document.getElementById('w130deny');
    if (!el) { el = document.createElement('div'); el.id = 'w130deny'; el.className = 'w130deny'; el.setAttribute('role', 'status'); }
    var mast = panel.querySelector(':scope > .w118mast');
    if (mast) { if (mast.nextElementSibling !== el) mast.insertAdjacentElement('afterend', el); }
    else if (panel.firstElementChild !== el) panel.insertBefore(el, panel.firstChild);
    var html;
    if (kind === 'board') {
      var al = allowedList();
      var pages = BOARD_PAGES.filter(function (p) { return p[0] !== 'overview' && al.indexOf(p[0]) >= 0; });
      html = '<span class="ic">' + svg('lock') + '</span><div><b>' + E(sentence(root, 'for staff accounts')) + '</b>'
        + '<p>The board view does not open ' + itThem(root) + ', so you are on the Executive dashboard. The board view opens these pages:</p>'
        + '<div class="lk">' + pages.map(function (p) { return '<a href="#' + p[0] + '">' + E(p[1]) + '</a>'; }).join('') + '</div></div>';
    } else {
      var m = mine(), prof = m && m.profile ? String(m.profile) : '';
      html = '<span class="ic">' + svg('key') + '</span><div><b>' + E(sentence(root, 'not in your access profile')) + '</b>'
        + '<p>' + (prof ? 'Your profile (' + E(prof.replace(/^lead:/, '').replace(/^team:/, '')) + ') opens the pages in your menu. ' : 'Your access opens the pages in your menu. ')
        + 'Ask an admin to add it, or send a request from My page.</p>'
        + (allowedList().indexOf('mypage') >= 0 ? '<div class="lk"><a href="#mypage">My page</a></div>' : '') + '</div>';
    }
    el.innerHTML = html + '<button type="button" class="x" data-w130x aria-label="Close">&times;</button>';
    /* the address matches the page the viewer is on */
    try { if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#overview'); } catch (e) { /* fine */ }
  }
  function denyCheck() {
    clearTimeout(DENY.t);
    DENY.t = setTimeout(function () {
      try {
        var gate = document.getElementById('gate'); if (gate && gate.style.display !== 'none') return;
        if (activeId() !== 'overview') { hideDeny(); return; }
        var root = DENY.req;
        if (DENY.closed !== null && DENY.closed === root) { hideDeny(); return; }
        if (boardMode()) { if (!boardOk(root)) showDeny(root, 'board'); else hideDeny(); return; }
        if (staffUser() && staffDenied(root)) { showDeny(root, 'staff'); return; }
        hideDeny();
      } catch (e) { /* fine */ }
    }, 180);
  }
  window.addEventListener('hashchange', function () { DENY.req = rootOf(location.hash); DENY.closed = null; denyCheck(); });

  /* the board view: links to staff pages stop being links (a toast says why) */
  var GO_ATTRS = ['data-w116go', 'data-w123go', 'data-w124go', 'data-w128go', 'data-w126go', 'data-w116tgo', 'data-w121go', 'data-w116kgo', 'data-w116pgo', 'data-w114go', 'data-jgo', 'data-w93go', 'data-w87go', 'data-w80go', 'data-w73go', 'data-w56go', 'data-w38go', 'data-w127go', 'data-w118cgo', 'data-w112go', 'data-mpgo'];
  var GO_SEL = 'a[href^="#"],' + GO_ATTRS.map(function (a) { return '[' + a + '^="#"]'; }).join(',');
  function navHash(el) {
    for (var n = el, i = 0; n && n.nodeType === 1 && n !== document.body && i < 8; n = n.parentElement, i++) {
      if (n.tagName === 'A') { var hr = n.getAttribute('href'); if (hr && hr.charAt(0) === '#') return { el: n, h: hr }; }
      for (var j = 0; j < GO_ATTRS.length; j++) { var v = n.getAttribute(GO_ATTRS[j]); if (v && v.charAt(0) === '#') return { el: n, h: v }; }
    }
    return null;
  }
  document.addEventListener('click', function (e) {
    if (!boardMode()) return;
    var t = e.target; if (!t || !t.closest || t.closest('#w130deny')) return;
    var nh = navHash(t); if (!nh) return;
    var root = rootOf(nh.h);
    if (boardOk(root)) return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    toastS(sentence(root, 'for staff accounts.') + ' The board view does not open ' + itThem(root) + '.');
  }, true);
  var OFF = [];
  function boardScan() {
    if (!boardMode()) return;
    var root = document.querySelector('.panel.active'); if (!root) return;
    var list; try { list = root.querySelectorAll(GO_SEL); } catch (e) { return; }
    for (var i = 0; i < list.length; i++) {
      var el = list[i], nh = navHash(el); if (!nh || nh.el !== el) continue;
      var bad = !boardOk(rootOf(nh.h));
      var want = '';
      if (bad) {
        var cls = ' ' + String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className || '') + ' ';
        var inText = el.tagName === 'A' && el.parentElement && /^(P|LI|SMALL)$/.test(el.parentElement.tagName) && /\S/.test(String(el.parentElement.textContent || '').replace(el.textContent || '', ''));
        want = inText ? 'text' : (/ (lnk|lk|more|w\d+lnk|w\d+go|go|chev) /.test(cls) || el.tagName === 'BUTTON' || /→|›/.test(el.textContent || '') ? 'hide' : 'text');
      }
      var cur = el.getAttribute('data-w130off') || '';
      if (want !== cur) { if (want) { el.setAttribute('data-w130off', want); el.setAttribute('tabindex', '-1'); if (OFF.indexOf(el) < 0) OFF.push(el); } else { el.removeAttribute('data-w130off'); } }
    }
  }
  /* 7. decisions: the board reads them, the executives record them */
  var DEC_BOARD = 'The calls that need an executive. Each one names who decides, a reason category and a one line rationale. The executives record each outcome here.';
  function boardDecText() {
    if (!boardMode()) return;
    var p = document.querySelector('#overview p.read[data-w116g="1"]');
    if (p && p.textContent !== DEC_BOARD) p.textContent = DEC_BOARD;
  }

  /* ---------- 5. Hub inbox: one header, the fuller line ---------- */
  var HUBMAIL = 'What the team copies to hub@welfareavenue.com, filed automatically: invoices to Finance, meeting summaries to the transcript archive, everything else as team updates. Each filing can be undone here.';
  function hubmailMast() {
    var p = document.querySelector('#hubmail > .w118mast > p');
    if (p && p.textContent !== HUBMAIL) p.textContent = HUBMAIL;
  }

  /* ---------- 10. Ask the Hub: the label in its own span; out of the way while typing ---------- */
  function fab() {
    var b = document.getElementById('waChatBtn'); if (!b) return;
    if (b.getAttribute('aria-label') !== 'Ask the Hub') b.setAttribute('aria-label', 'Ask the Hub');
    if (b.querySelector('.w130lbl')) return;
    for (var i = 0; i < b.childNodes.length; i++) {
      var n = b.childNodes[i];
      if (n.nodeType === 3 && String(n.textContent).trim()) { var s = document.createElement('span'); s.className = 'w130lbl'; s.textContent = String(n.textContent).trim(); b.replaceChild(s, n); break; }
    }
  }
  function isField(el) {
    if (!el || !el.tagName) return false;
    if (el.closest && el.closest('#waChatPanel')) return false;
    var t = el.tagName;
    if (t === 'TEXTAREA') return true;
    if (t === 'INPUT') return ['text', 'search', 'email', 'url', 'tel', 'number', 'password', ''].indexOf(String(el.getAttribute('type') || '').toLowerCase()) >= 0;
    return !!el.isContentEditable;
  }
  document.addEventListener('focusin', function (e) { if (isField(e.target)) document.body.classList.add('w130typing'); });
  document.addEventListener('focusout', function () { setTimeout(function () { if (!isField(document.activeElement)) document.body.classList.remove('w130typing'); }, 80); });

  /* ---------- 11. one coach mark at a time ---------- */
  function nudgeWait() {
    var ck = document.getElementById('w118ck');
    var gs = document.getElementById('w112card');
    var wait = !!ck || !!(gs && gs.offsetParent !== null);
    if (document.body.classList.contains('w130wait') !== wait) document.body.classList.toggle('w130wait', wait);
  }

  /* ---------- 12. Request more access: staff who are not admins, once the role is known ---------- */
  function reqClass() {
    var m = mine();
    var ok = !!(m && staffUser() && String(m.role || '') !== 'admin' && String(m.role || '') !== 'blocked');
    if (document.body.classList.contains('w130canreq') !== ok) document.body.classList.toggle('w130canreq', ok);
  }

  /* ---------- 13. policies: open it before signing it ---------- */
  function polKey() { var em = ''; try { em = String((USER && USER.email) || '').toLowerCase(); } catch (e) { em = ''; } return 'w130pol:' + em; }
  function polOpened() { try { return JSON.parse(localStorage.getItem(polKey()) || '{}') || {}; } catch (e) { return {}; } }
  function polMark(k) { if (!k) return; var o = polOpened(); o[k] = Date.now(); try { localStorage.setItem(polKey(), JSON.stringify(o)); } catch (e) { POL_MEM[k] = 1; } }
  var POL_MEM = {};
  function polKeyOf(b) { return b.getAttribute('data-w105sk') || b.getAttribute('data-w122sign') || ''; }
  function polRow(el) { return (el.closest && (el.closest('.w105sign') || el.closest('.w122trk .it'))) || null; }
  function polLink(el) { var row = polRow(el); var a = row ? row.querySelector('a[href]') : null; return a && !/^#/.test(a.getAttribute('href') || '') ? a : null; }
  function polScan() {
    var btns = document.querySelectorAll('[data-w105sk],[data-w122sign]'); if (!btns.length) return;
    var o = polOpened();
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], k = polKeyOf(b), lock = !!(k && !o[k] && !POL_MEM[k] && polLink(b));
      if (lock && !b.hasAttribute('data-w130lock')) { b.setAttribute('data-w130lock', '1'); b.setAttribute('title', 'Open and read it first'); b.setAttribute('aria-disabled', 'true'); }
      else if (!lock && b.hasAttribute('data-w130lock')) { b.removeAttribute('data-w130lock'); b.removeAttribute('title'); b.removeAttribute('aria-disabled'); }
    }
  }
  function polOpen(e) {
    var t = e.target; if (!t || !t.closest) return false;
    var a = t.closest('.w105sign a[href], .w122trk .it a[href]');
    if (!a || /^#/.test(a.getAttribute('href') || '')) return false;
    var row = polRow(a), b = row && row.querySelector('[data-w105sk],[data-w122sign]');
    if (b) { polMark(polKeyOf(b)); setTimeout(polScan, 30); }
    return true;
  }
  document.addEventListener('click', function (e) {
    if (polOpen(e)) return;
    var t = e.target; if (!t || !t.closest) return;
    var b = t.closest('[data-w105sk],[data-w122sign]');
    if (!b || !b.hasAttribute('data-w130lock')) return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    toastS('Open and read it first, then sign it off.');
    var l = polLink(b); if (l) { l.classList.remove('w130hint'); void l.offsetWidth; l.classList.add('w130hint'); }
  }, true);
  document.addEventListener('auxclick', function (e) { polOpen(e); }, true);

  /* ---------- the paint: cheap, idempotent, run after navigation and DOM changes ---------- */
  function paint() {
    try { fab(); } catch (e) { /* fine */ }
    try { hubmailMast(); } catch (e) { /* fine */ }
    try { if (boardMode()) { if (!document.body.classList.contains('w130board')) document.body.classList.add('w130board'); boardDecText(); boardScan(); } } catch (e) { /* fine */ }
    try { reqClass(); } catch (e) { /* fine */ }
    try { nudgeWait(); } catch (e) { /* fine */ }
    try { polScan(); } catch (e) { /* fine */ }
  }
  var pT = null;
  function soon(ms) { clearTimeout(pT); pT = setTimeout(paint, ms == null ? 200 : ms); }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('[data-w130x]')) { DENY.closed = DENY.req; hideDeny(); }
  });
  try { new MutationObserver(function () { soon(250); }).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* fine */ }

  if (typeof showPanel === 'function') {
    var __sp130 = showPanel;
    showPanel = function (id) {
      var out = __sp130.apply(this, arguments);
      try { denyCheck(); soon(60); setTimeout(paint, 700); } catch (e) { /* fine */ }
      return out;
    };
  }
  if (typeof startApp === 'function') {
    var __sa130 = startApp;
    startApp = async function () {
      var out = await __sa130.apply(this, arguments);
      try { paint(); denyCheck(); setTimeout(paint, 900); } catch (e) { /* fine */ }
      return out;
    };
  }
  window.w130 = { paint: paint, deny: function () { return DENY; }, off: function () { return OFF.filter(function (x) { return x.isConnected; }).map(function (x) { return x.getAttribute('data-w130off') + ' ' + x.tagName + ' ' + String(x.textContent || '').trim().slice(0, 40); }); }, boardOk: boardOk };
})();
