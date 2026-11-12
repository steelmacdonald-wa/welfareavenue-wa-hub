/* =====================================================================
   WA v322 One box: pages, actions and Ask the Hub in Search everything (12/11/26)
   =====================================================================
   Steel (12/11/26): "ways to simplify navigation ... have them ask questions, submit requests". The box at the top of the
   Hub found tasks, people, goals, meetings, documents and contacts, but not pages, it could not be reached from the
   keyboard, and a search that found nothing was a dead end. Wave262's tour already tells people "type a page".
   - Pages: the pages the person may open (wa40Allowed, the same list the menu uses) come first in the results. A page
     the menu retired (hidden at the top level) is left out.
   - Ask the Hub: with three letters or more, the last row asks the question as typed, so "No matches" always has a
     next step. "task ..." and "request ..." get a row that hands the sentence to Ask the Hub, which answers with its
     usual confirm card. Only for people who have Ask the Hub.
   - Keyboard: Ctrl K (Cmd K on a Mac) goes to the box from anywhere, unless a window is open or the keys belong to an
     editor (the task description uses Ctrl K for a link). Down and Up move through the rows, Enter opens the lit row
     (the first when none is lit), Escape closes the list.
   - I want to: a click in the empty box (or Ctrl K, or Down) lists what the box can do: file a request, add a task,
     ask a question, and four everyday pages. Not on a phone (the phone bar has Ask), not during a page tour.
   No motion: a list people use all day opens at once. Nothing is read from or written to the database here.
   window.w322 = { pages, launcher, extend, state }. ASCII only.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__wa322) return; window.__wa322 = true;

  var GREEN = '#103F39', MUTED = '#585B57';
  var BODY = "'Space Grotesk',system-ui,-apple-system,Segoe UI,sans-serif";
  var MAC = false; try { MAC = /Mac|iPhone|iPad/.test(navigator.platform || ''); } catch (e) { /* fine */ }
  var S = { on: null, mo: null };

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026' : s; }
  function inp() { return document.getElementById('globalSearch'); }
  function popEl() { return document.getElementById('searchResults'); }
  function wrapEl() { return document.getElementById('searchWrap'); }
  function phone() { try { return window.matchMedia('(max-width: 900px)').matches; } catch (e) { return false; } }
  function shown(el) { if (!el) return false; var r = el.getBoundingClientRect(); var cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; }
  function allowed() { try { return (typeof wa40Allowed === 'function' && wa40Allowed()) || []; } catch (e) { return []; } }
  function touring() { try { var st = window.w122 && window.w122.state && window.w122.state(); return !!(st && st.T); } catch (e) { return false; } }
  /* Ask the Hub is there for this person: its button, or its place in the phone bar */
  function canAsk() {
    try {
      var b = document.getElementById('waChatBtn'); if (b && getComputedStyle(b).display !== 'none') return true;
      return !!document.querySelector('#w163bar [data-w163slot="ask"]');
    } catch (e) { return false; }
  }

  /* ---------- the pages a person may open ---------- */
  function tabLabel(t) { return String(t.textContent || '').replace(/[\u25B8\u25BE\u25B6\u25BC\u203A]/g, ' ').replace(/\s+/g, ' ').replace(/\s\d+$/, '').trim(); }
  function pageList() {
    var al = allowed(), out = [], seen = {};
    if (!al.length) return out;
    var tabs = document.querySelectorAll('#tabBar .tab[data-tab]');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i], id = t.getAttribute('data-tab');
      if (!id || seen[id] || al.indexOf(id) < 0 || !document.getElementById(id)) continue;
      /* a page the menu retired sits at the top level, hidden: leave it out (a folded page sits inside a fold) */
      if (t.parentNode && t.parentNode.id === 'tabBar' && getComputedStyle(t).display === 'none') continue;
      var label = tabLabel(t); if (!label) continue;
      seen[id] = 1; out.push({ id: id, label: label });
    }
    return out;
  }
  function pages(q) {
    var ql = String(q || '').toLowerCase().trim(); if (ql.length < 2) return [];
    var starts = [], has = [];
    pageList().forEach(function (p) {
      var l = p.label.toLowerCase(), at = l.indexOf(ql);
      if (at === 0 || (at > 0 && /[\s,&(]/.test(l.charAt(at - 1)))) starts.push(p); else if (at > 0) has.push(p);
    });
    return starts.concat(has).slice(0, 5);
  }

  /* ---------- Ask the Hub ---------- */
  function chatOpen() { var p = document.getElementById('waChatPanel'); return !!(p && p.style.display === 'flex'); }
  function openChat() {
    if (chatOpen()) return;
    if (typeof window.w75Open === 'function') { try { window.w75Open(); return; } catch (e) { /* the button, then */ } }
    var b = document.getElementById('waChatBtn'); if (b) b.click();
  }
  function ask(q, send) {
    openChat();
    setTimeout(function () {
      var i = document.getElementById('w38in') || document.getElementById('wacInput'); if (!i) return;
      i.value = q; try { i.focus(); i.setSelectionRange(q.length, q.length); } catch (e) { /* fine */ }
      if (send) { var b = document.getElementById('w38send') || document.getElementById('wacSend'); if (b) b.click(); }
    }, 120);
  }
  function done() { var p = popEl(), i = inp(); if (p) { p.style.display = 'none'; p.removeAttribute('data-w322l'); } if (i) { i.value = ''; i.setAttribute('aria-expanded', 'false'); } S.on = null; }
  function goPage(id) { done(); try { location.hash = '#' + id; } catch (e) { /* fine */ } }

  /* ---------- rows ---------- */
  function row(type, label, how, cls) {
    var d = document.createElement('div'); d.className = 'sr' + (cls ? ' ' + cls : '');
    d.innerHTML = '<span class="sr-type">' + E(type) + '</span>' + E(label);
    d.addEventListener('click', function (e) { e.stopPropagation(); how(); });
    return d;
  }
  function noMatch(pop) {
    var rows = pop.querySelectorAll('.sr');
    for (var i = 0; i < rows.length; i++) { var r = rows[i]; if (!r.hasAttribute('data-hash') && !r.hasAttribute('data-w322') && /^No matches/.test(r.textContent || '')) return r; }
    return null;
  }
  /* "task call the caterer" or "request a poster for Sunday": hand the sentence to Ask the Hub */
  function actionOf(q) {
    var m = q.match(/^(?:add |new |create )?(?:a |an )?task\b[:,]?\s+(.{3,})$/i);
    if (m) return { type: 'Add a task', label: m[1], q: 'Add a task for me: ' + m[1] };
    m = q.match(/^(?:file |put in |make |new |send )?(?:a |an )?request\b[:,]?\s+(?:to |for )?(.{3,})$/i);
    if (m) return { type: 'File a request', label: m[1], q: 'Put in a request: ' + m[1] };
    return null;
  }
  function extend(q) {
    var pop = popEl(); if (!pop) return;
    q = String(q || '').trim();
    pop.removeAttribute('data-w322l'); S.on = null;
    var old = pop.querySelectorAll('[data-w322]'); for (var k = 0; k < old.length; k++) old[k].remove();
    var hits = pages(q);
    if (hits.length) {
      var none = noMatch(pop); if (none) none.remove();
      var first = pop.firstChild;
      /* inside the CRM its contacts come first (wave153): the pages go under them */
      while (first && first.nodeType === 1 && first.hasAttribute('data-w153c')) first = first.nextSibling;
      hits.forEach(function (h) {
        var d = row('Page', h.label, function () { goPage(h.id); });
        d.setAttribute('data-hash', '#' + h.id); d.setAttribute('data-w322', 'page');
        pop.insertBefore(d, first);
      });
    }
    if (canAsk() && q.length >= 3) {
      var act = actionOf(q);
      if (act) { var a = row(act.type, clip(act.label, 90), function () { done(); ask(act.q, true); }, 'w322ask'); a.setAttribute('data-w322', 'act'); pop.appendChild(a); }
      var d2 = row('Ask the Hub', '\u201C' + clip(q, 90) + '\u201D', function () { done(); ask(q, true); }, 'w322ask'); d2.setAttribute('data-w322', 'ask');
      pop.appendChild(d2);
    }
    dress();
  }

  /* ---------- I want to: what the box can do, in an empty box ---------- */
  function launcher() {
    var pop = popEl(), i = inp(); if (!pop || !i || i.value.trim()) return false;
    if (phone() || touring() || !canAsk()) return false;
    var al = allowed(), rows = [];
    rows.push(row('Ask the Hub', 'File a request', function () { done(); ask('Put in a request to ', false); }));
    rows.push(row('Ask the Hub', 'Add a task', function () { done(); ask('Add a task for me: ', false); }));
    rows.push(row('Ask the Hub', 'Ask a question', function () { done(); openChat(); }));
    [['mypage', 'Home, with my tasks'], ['requests', 'Team Requests'], ['calendar', 'Calendar'], ['documents', 'Document finder']].forEach(function (p) {
      if (al.indexOf(p[0]) >= 0 && document.getElementById(p[0])) rows.push(row('Page', p[1], function () { goPage(p[0]); }));
    });
    pop.innerHTML = '<div class="w322h" data-w322="h" role="presentation">I want to</div>';
    rows.forEach(function (r) { r.setAttribute('data-w322', 'l'); pop.appendChild(r); });
    pop.setAttribute('data-w322l', '1'); pop.style.display = 'block'; S.on = null;
    dress();
    return true;
  }

  /* ---------- the list for the keyboard and for screen readers ---------- */
  function rowsOf(pop) {
    var all = pop.querySelectorAll('.sr'), out = [];
    for (var i = 0; i < all.length; i++) { var r = all[i]; if (/^No matches/.test(r.textContent || '') && !r.hasAttribute('data-w322') && !r.hasAttribute('data-hash')) continue; out.push(r); }
    return out;
  }
  function dress() {
    var pop = popEl(), i = inp(); if (!pop || !i) return;
    var rows = rowsOf(pop);
    for (var k = 0; k < rows.length; k++) { var r = rows[k]; if (!r.id) r.id = 'w322r' + k + '_' + Math.floor(Math.random() * 1e6); r.setAttribute('role', 'option'); }
    var none = noMatch(pop); if (none) { none.setAttribute('role', 'option'); none.setAttribute('aria-disabled', 'true'); }
    i.setAttribute('aria-expanded', pop.style.display !== 'none' && rows.length ? 'true' : 'false');
    if (!S.on || !pop.contains(S.on)) { S.on = null; i.removeAttribute('aria-activedescendant'); }
  }
  function light(r) {
    var pop = popEl(), i = inp(); if (!pop || !i) return;
    var was = pop.querySelectorAll('.sr.w322on'); for (var k = 0; k < was.length; k++) { was[k].classList.remove('w322on'); was[k].removeAttribute('aria-selected'); }
    S.on = r || null;
    if (r) { r.classList.add('w322on'); r.setAttribute('aria-selected', 'true'); i.setAttribute('aria-activedescendant', r.id); try { r.scrollIntoView({ block: 'nearest' }); } catch (e) { /* fine */ } }
    else i.removeAttribute('aria-activedescendant');
  }
  function onKey(e) {
    var pop = popEl(), i = inp(); if (!pop || !i || e.isComposing) return;
    var open = pop.style.display !== 'none';
    if (e.key === 'Escape') { if (open) { pop.style.display = 'none'; pop.removeAttribute('data-w322l'); i.setAttribute('aria-expanded', 'false'); S.on = null; } return; }
    if (!open) { if (e.key === 'ArrowDown' && !i.value.trim() && launcher()) e.preventDefault(); return; }
    var rows = rowsOf(pop); if (!rows.length) return;
    var at = S.on ? rows.indexOf(S.on) : -1;
    if (e.key === 'ArrowDown') { e.preventDefault(); light(rows[at + 1 < rows.length ? at + 1 : 0]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); light(rows[at > 0 ? at - 1 : rows.length - 1]); }
    else if (e.key === 'Enter') { e.preventDefault(); (at >= 0 ? rows[at] : rows[0]).click(); }
  }

  /* ---------- Ctrl K ---------- */
  function windowOpen() {
    try {
      var g = document.getElementById('gate'); if (g && g.style.display !== 'none') return true;
      var els = document.querySelectorAll('[aria-modal="true"], #w213pop, #w177pop, #modalBack');
      for (var k = 0; k < els.length; k++) { if (els[k].id === 'modalBack' ? els[k].style.display === 'flex' : shown(els[k])) return true; }
    } catch (e) { return true; }
    return false;
  }
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || String(e.key || '').toLowerCase() !== 'k') return;
    if (e.defaultPrevented) return;                       /* an editor took it (a link in the task description) */
    var t = e.target; if (t && t.isContentEditable) return;
    var i = inp(), w = wrapEl(); if (!i || !w || !shown(i) || windowOpen()) return;
    e.preventDefault();
    try { i.focus(); i.select(); } catch (e2) { /* fine */ }
    if (!i.value.trim()) launcher();
  });

  /* ---------- wiring ---------- */
  function wire() {
    var i = inp(), pop = popEl(), w = wrapEl(); if (!i || !pop || !w || i.__w322) return;
    i.__w322 = true;
    i.setAttribute('role', 'combobox'); i.setAttribute('aria-autocomplete', 'list'); i.setAttribute('aria-controls', 'searchResults'); i.setAttribute('aria-expanded', 'false');
    i.title = 'Search, go to a page, or ask. ' + (MAC ? 'Cmd' : 'Ctrl') + ' K from anywhere.';
    i.setAttribute('aria-label', 'Search the Hub, go to a page, or ask');
    pop.setAttribute('role', 'listbox'); pop.setAttribute('aria-label', 'Search results');
    i.addEventListener('keydown', onKey);
    i.addEventListener('click', function () { if (!i.value.trim() && pop.style.display === 'none') launcher(); });
    i.addEventListener('input', function () { if (pop.hasAttribute('data-w322l')) { pop.removeAttribute('data-w322l'); if (i.value.trim().length < 2) pop.style.display = 'none'; } S.on = null; });
    w.addEventListener('focusout', function () {
      setTimeout(function () { try { if (!w.contains(document.activeElement) && pop.hasAttribute('data-w322l')) { pop.style.display = 'none'; pop.removeAttribute('data-w322l'); i.setAttribute('aria-expanded', 'false'); } } catch (e) { /* fine */ } }, 160);
    });
    if (!document.getElementById('w322k')) {
      var k = document.createElement('kbd'); k.id = 'w322k'; k.setAttribute('aria-hidden', 'true'); k.textContent = (MAC ? '\u2318' : 'Ctrl ') + 'K';
      w.appendChild(k);
    }
    /* rows that arrive late (documents, photos, contacts) land above the Ask rows, never under them */
    try {
      S.mo = new MutationObserver(function () {
        var mine = pop.querySelectorAll('.sr[data-w322="act"], .sr[data-w322="ask"]');
        if (mine.length && pop.lastElementChild !== mine[mine.length - 1]) { for (var n = 0; n < mine.length; n++) pop.appendChild(mine[n]); }
        dress();
      });
      S.mo.observe(pop, { childList: true });
    } catch (e) { /* the rows still work */ }
  }
  function wrapSearch() {
    try {
      if (typeof renderSearch !== 'function' || renderSearch.__w322) return;
      var prev = renderSearch;
      renderSearch = function (q) {
        var r = prev.apply(this, arguments);
        try { extend(q); } catch (e) { /* the search stays as it was */ }
        return r;
      };
      renderSearch.__w322 = true;
    } catch (e) { /* the search stays as it was */ }
  }

  var css = ''
    + '#w322k{position:absolute;right:12px;top:50%;transform:translateY(-50%);font:600 11px/1 ' + BODY + ';color:' + MUTED + ';background:rgba(16,63,57,.08);border-radius:6px;padding:4px 7px;pointer-events:none;letter-spacing:.02em;white-space:nowrap;}'
    + '#searchWrap:focus-within #w322k,#globalSearch:not(:placeholder-shown) ~ #w322k{display:none;}'
    + '@media (max-width:900px),(pointer:coarse){#w322k{display:none;}}'
    + '.search-pop .sr.w322on{background:#F4F2EA;box-shadow:inset 3px 0 0 ' + GREEN + ';}'
    + '.search-pop .sr.w322ask{color:' + GREEN + ';font-weight:600;}'
    + '.search-pop .w322h{padding:10px 13px 5px;font:600 11px/1.2 ' + BODY + ';letter-spacing:.08em;text-transform:uppercase;color:' + MUTED + ';}';
  try { var st = document.createElement('style'); st.id = 'wa322css'; st.textContent = css; (document.head || document.documentElement).appendChild(st); } catch (e) { /* fine */ }

  wrapSearch();
  function boot() { wrapSearch(); wire(); }
  if (typeof startApp === 'function') {
    var __sa322 = startApp;
    startApp = async function () { var r = await __sa322.apply(this, arguments); try { boot(); } catch (e) { /* the search stays as it was */ } return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { try { wire(); } catch (e) { /* fine */ } }); else { try { wire(); } catch (e) { /* fine */ } }

  window.w322 = { pages: pages, launcher: launcher, extend: extend, state: function () { return S; } };
})();
