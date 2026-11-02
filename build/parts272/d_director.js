
  /* ---------- directors get Home (Steel, 01/11/26) ----------
     Wave74 draws them the greeting; their meetings come from wave116 as for everyone. Their Board pages take the place of the
     apps, which directors do not open. Read only, as ever; a card the older waves draw for staff stays out of their Home. */
  var dirCss = ''
    + '#mypage.w272dir #mpBody > #w272apps{grid-column:1 / -1;}'
    + '#mypage.w272dir > #w105my,#mypage.w272dir > #w105sign,#mypage.w272dir #w110mine,#mypage.w272dir #w114switch,#mypage.w272dir #w262homebar{display:none !important;}';
  var BOARD_PAGES = [['governance', 'Board overview', 'shield'], ['committees', 'Committees', 'people'], ['orggoals', 'Organization goals', 'target'], ['calendar', 'Calendar', 'list']];
  function paintDirector() {
    var body = document.getElementById('mpBody'), head = body && body.querySelector(':scope > .mp-head'); if (!head) return;
    var sum = document.getElementById('w272sum');
    if (!sum || sum.parentNode !== head) { sum = document.createElement('p'); sum.id = 'w272sum'; head.appendChild(sum); }
    sum.textContent = 'Your meetings and the board’s pages, in one place.';
    var allowed = []; try { allowed = wa40Allowed() || []; } catch (e) { allowed = []; }
    var A = window.WA_APP, el = document.getElementById('w272apps');
    var mine = BOARD_PAGES.filter(function (p) { return allowed.indexOf(p[0]) >= 0; });
    if (!mine.length) { if (el) el.remove(); return; }
    if (!el || el.parentNode !== body) { el = document.createElement('section'); el.id = 'w272apps'; el.setAttribute('aria-label', 'Board'); body.appendChild(el); }
    var html = '<h3>Board</h3><div class="tiles">' + mine.map(function (p) { return '<button type="button" data-w272page="#' + E(p[0]) + '"><span class="ti">' + (A && A.icon ? A.icon(p[2]) : '') + '</span>' + E(p[1]) + '</button>'; }).join('') + '</div>';
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-w272page]'); if (b) location.hash = b.getAttribute('data-w272page');
  });
  /* Home joins the pages a director may open; wave260's landing and the menu read this same list */
  function wrapAllowed() {
    try {
      if (typeof wa40Allowed !== 'function' || !board() || wa40Allowed().indexOf('mypage') >= 0) return;
      var __al = wa40Allowed;
      wa40Allowed = function () { var a = __al.apply(this, arguments) || []; if (board() && a.indexOf('mypage') < 0) a = a.concat(['mypage']); return a; };
      Object.keys(__al).forEach(function (k) { try { wa40Allowed[k] = __al[k]; } catch (e) { /* fine */ } });
    } catch (e) { /* fine */ }
  }
  /* wave9 adds Home's menu button for staff only */
  function directorTab() {
    var bar = document.getElementById('tabBar'); if (!bar) return;
    var b = bar.querySelector('.tab[data-tab="mypage"]');
    if (!b) { b = document.createElement('button'); b.className = 'tab'; b.dataset.tab = 'mypage'; b.innerHTML = '<span class="tabdot" style="background:' + GREEN + '"></span>Home'; bar.insertBefore(b, bar.firstChild); }
    b.style.display = '';
    try { if (window.WA_NAV && WA_NAV.applyLayout) WA_NAV.applyLayout(); } catch (e) { /* fine */ }
  }
