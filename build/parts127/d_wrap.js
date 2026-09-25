
  /* ---------- the menu follows my profile ---------- */
  var MINE_FN = null, MINE_ENF = null;
  function shape(a) {
    var p = myProfile(); if (!p) return a;
    var role = myRole();
    if (role === 'blocked') return a;
    var out = pagesFor(p, leadRole(role) || p.tier === 'leader');
    /* a page no profile decides yet follows its built-in gate until an admin decides */
    a.forEach(function (t) { if (valueOf(p, t) === undefined && t !== 'team' && out.indexOf(t) < 0) out.push(t); });
    /* directors keep the board pages whatever their staff profile */
    if (boardPerson()) ['governance', 'committees'].forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); });
    return out;
  }
  function tabOk(t) { try { return typeof wa40Allowed !== 'function' || (wa40Allowed() || []).indexOf(t) >= 0; } catch (e) { return true; } }
  /* after every enforcement: with a profile, the HR centre follows the profile (not the old hard-coded list),
     the donations tile follows the ledger, and empty menu groups close up */
  function afterEnforce() {
    var p = myProfile();
    try { document.body.classList.toggle('w127nofin', !!p && !tabOk('finances')); } catch (e) { /* fine */ }
    rowsFix();
    if (!p) return;
    try {
      var hr = document.querySelector('#tabBar .tab[data-tab="hrcentre"]');
      if (hr) { var want = tabOk('hrcentre') ? '' : 'none'; if (hr.style.display !== want) hr.style.display = want; }
      document.querySelectorAll('#tabBar .tab-group').forEach(function (g) {
        var any = false; g.querySelectorAll('.tab').forEach(function (b) { if (b.style.display !== 'none') any = true; });
        var hd = g.querySelector('.tab-group-h'); if (hd) { var w = any ? '' : 'none'; if (hd.style.display !== w) hd.style.display = w; }
      });
    } catch (e) { /* fine */ }
  }
  /* a team row whose page is hidden: with no visible tool it closes up (it used to leave a lone chevron);
     with tools inside (the board's Analytics and Content calendar sit in the Marketing row) they show as plain items */
  function rowsFix() {
    try {
      document.querySelectorAll('#tabBar .w42d').forEach(function (row) {
        var main = row.querySelector(':scope > .tab'); if (!main) return;
        var tools = Array.prototype.some.call(row.querySelectorAll('.w42sub .tab'), function (b) { return b.style.display !== 'none'; });
        var hidden = main.style.display === 'none';
        var flat = hidden && tools;
        if (row.classList.contains('w127flat') !== flat) row.classList.toggle('w127flat', flat);
        if (hidden && !tools) { if (row.style.display !== 'none') { row.style.display = 'none'; row.setAttribute('data-w127hid', '1'); } }
        else if (row.getAttribute('data-w127hid') === '1') { row.style.display = ''; row.removeAttribute('data-w127hid'); }
      });
    } catch (e) { /* fine */ }
  }
  var rowsT = null;
  function watchRows() {
    var bar = document.getElementById('tabBar'); if (!bar || bar.__w127rows) return;
    bar.__w127rows = true;
    try { new MutationObserver(function () { clearTimeout(rowsT); rowsT = setTimeout(rowsFix, 220); }).observe(bar, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }
  /* other waves wrap these two after load; keep ours outermost */
  function wrapAllowed() {
    try {
      if (typeof wa40Allowed === 'function' && wa40Allowed !== MINE_FN) {
        var inner = wa40Allowed;
        var fn = function () { var a = inner.apply(this, arguments) || []; try { return shape(a); } catch (e) { return a; } };
        Object.keys(inner).forEach(function (k) { try { fn[k] = inner[k]; } catch (e) { /* fine */ } });
        MINE_FN = fn; wa40Allowed = fn;
      }
      if (typeof wa40Enforce === 'function' && wa40Enforce !== MINE_ENF) {
        var innerE = wa40Enforce;
        var fe = function () { var out = innerE.apply(this, arguments); try { afterEnforce(); } catch (e) { /* fine */ } return out; };
        MINE_ENF = fe; wa40Enforce = fe;
      }
    } catch (e) { /* fine */ }
  }
  function enforce() {
    wrapAllowed();
    try { if (typeof wa40Enforce === 'function') wa40Enforce(); else afterEnforce(); } catch (e) { /* fine */ }
  }
  /* a page I no longer have (a bookmark, or the first paint before my profile loaded) goes back to the dashboard */
  function recheck() {
    try {
      var root = decodeURIComponent(location.hash || '').replace(/^#/, '').split('/')[0];
      if (!root || !myProfile() || root === 'team') return;
      /* the pages wave40 always lets through stay as they were */
      if (['needsme', 'personpage', 'projectpage', 'volunteering', 'importantinfo'].indexOf(root) >= 0) return;
      if (knownTabs().indexOf(root) < 0) return;
      if (!tabOk(root) && typeof showPanel === 'function') showPanel(root);
    } catch (e) { /* fine */ }
  }
