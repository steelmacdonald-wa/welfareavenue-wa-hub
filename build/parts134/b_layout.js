
  /* ---------- the menu: move the buttons where the layout says ---------- */
  var OBS = null, busy = false, T = null, applied = 0, moves = [];
  function bar() { return document.getElementById('tabBar'); }
  function tabOf(root, id) { return root.querySelector('.tab[data-tab="' + id + '"]'); }
  function shown(el) { return !!el && el.style.display !== 'none'; }
  function kids(el) { return Array.prototype.slice.call(el.children); }
  /* a page button inside a team row whose team page this person can open (it stays in that row) */
  function inOpenRow(el) {
    var row = el && el.closest ? el.closest('.w42d') : null; if (!row) return false;
    var main = row.querySelector(':scope > .tab');
    return !!main && main !== el && shown(main) && row.getAttribute('data-w127hid') !== '1' && !row.classList.contains('w127flat');
  }
  function relabel(btn, text) {
    if (!btn || (btn.textContent || '').trim() === text) return;
    var dot = btn.querySelector('.tabdot');
    btn.innerHTML = (dot ? dot.outerHTML : '') + E(text);
  }
  function groupDef(key) { for (var i = 0; i < LAYOUT.groups.length; i++) if (LAYOUT.groups[i].key === key) return LAYOUT.groups[i]; return null; }
  function groupEl(b, g) {
    var el = b.querySelector('.tab-group[data-w42g="' + g.key + '"]');
    if (!el) {
      el = document.createElement('span'); el.className = 'tab-group'; el.setAttribute('data-w42g', g.key);
      var h = document.createElement('button'); h.className = 'tab-group-h'; h.type = 'button';
      var p = document.createElement('div'); p.className = 'tab-group-p';
      el.appendChild(h); el.appendChild(p);
      h.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var was = el.classList.contains('open');
        document.querySelectorAll('#tabBar .tab-group.open').forEach(function (x) { x.classList.remove('open'); });
        if (!was) el.classList.add('open');
      });
    }
    if (!el.hasAttribute('data-w134')) el.setAttribute('data-w134', '1');
    var hd = el.querySelector(':scope > .tab-group-h');
    if (hd && g.label && g.items && hd.getAttribute('data-w134l') !== g.label) { hd.innerHTML = E(g.label) + ' <span class="caret">&#9660;</span>'; hd.setAttribute('data-w134l', g.label); }
    return el;
  }
  function hostOf(el) { return el.querySelector(':scope > .tab-group-p') || el; }
  function putAt(host, el, i) {
    if (host.children[i] === el) return;
    host.insertBefore(el, host.children[i] || null);
    moves.push(Date.now());
  }
  /* the buttons each group should hold, in order, for this person */
  function wanted(b, g) {
    var out = [];
    itemsOf(g).forEach(function (id) {
      var t = tabOf(b, id); if (!t) return;
      if (g.loose && inOpenRow(t)) return;
      out.push(t);
      if (id === 'adminpanel') { var sub = adminSub(b); if (sub) out.push(sub); }
    });
    return out;
  }
  /* Admin's section links (wave118 draws them after the Admin button; an older menu rebuild can drop them) */
  function adminSub(b) {
    var sub = b.querySelector('.w118sub');
    if (sub) return sub;
    var A = window.__wa118 && window.__wa118.ADMIN; if (!Array.isArray(A) || !A.length) return null;
    sub = document.createElement('div'); sub.className = 'w118sub';
    sub.innerHTML = A.map(function (a) { return '<a href="#adminpanel/' + E(a[0]) + '" data-w118sec="' + E(a[0]) + '">' + E(a[1]) + '</a>'; }).join('');
    sub.addEventListener('click', function () { try { document.body.classList.remove('wa-mob-open'); } catch (e) { /* fine */ } });
    var cur = (String(location.hash || '').match(/^#adminpanel\/([a-z]+)/) || [])[1] || A[0][0];
    sub.querySelectorAll('a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-w118sec') === cur); });
    return sub;
  }
  function isHidden(t) { var id = t.getAttribute && t.getAttribute('data-tab'); return LAYOUT.hidden.indexOf(id) >= 0 || !!t.getAttribute('data-w73hide'); }
  function apply() {
    var b = bar(); if (!b || !WA_NAV.layout) return;
    /* a safety valve: if something keeps moving buttons back, stop arguing for a while */
    var now = Date.now(); moves = moves.filter(function (t) { return now - t < 10000; });
    if (moves.length > 120) { console.warn('wave134: the menu keeps moving; layout paused for 10 s'); return; }
    busy = true; if (OBS) OBS.disconnect();
    try {
      var seq = [];
      LAYOUT.top.forEach(function (id) { var t = tabOf(b, id); if (t) seq.push(t); });
      LAYOUT.afterCalendar.forEach(function (id) { var t = tabOf(b, id); if (t && !inOpenRow(t)) { t.classList.remove('w116tool'); seq.push(t); } });
      (LAYOUT.afterEvents || []).forEach(function (id) { var t = tabOf(b, id); if (t) { t.classList.remove('w116tool'); seq.push(t); } });
      var res = null;
      LAYOUT.groups.forEach(function (g) {
        if (g.fold) { seq.push(foldEl(b, g)); return; }   /* wave262: the More fold's header */
        if (!g.items) { var d = b.querySelector('.tab-group[data-w42g="' + g.key + '"]'); if (d) seq.push(d); return; }
        var el = groupEl(b, g), host = hostOf(el);
        wanted(b, g).forEach(function (t, i) {
          if (g.loose) t.classList.remove('w116tool');
          var id = t.getAttribute && t.getAttribute('data-tab');
          if (id && LABEL[id]) relabel(t, LABEL[id]);
          putAt(host, t, i);
        });
        if (g.key === 'tools') res = host;   /* wave163: Other Tools takes what the layout does not name */
        seq.push(el);
      });
      /* what the layout does not name: an older group (Strategy, More) gives up its buttons and goes;
         a page registered later lands in Resources until the layout names it */
      kids(b).forEach(function (el) {
        if (seq.indexOf(el) >= 0) return;
        if (el.classList.contains('tab')) {
          if (isHidden(el)) return;
          if (res) { res.appendChild(el); moves.push(Date.now()); }
          return;
        }
        if (el.classList.contains('tab-group')) {
          kids(hostOf(el)).forEach(function (t) {
            if (!t.classList || !t.classList.contains('tab')) return;
            if (isHidden(t)) b.appendChild(t); else if (res) res.appendChild(t);
            moves.push(Date.now());
          });
          if (!el.querySelector('.tab, .w42d')) el.parentNode.removeChild(el);
        }
      });
      seq.forEach(function (el, i) { putAt(b, el, i); });
      heads(b);
      folds(b);
    } catch (e) { console.warn('wave134 layout', e); }
    busy = false; applied++;
    watch();
  }
  /* group headers show only when the group has something this person can open; Admin shows its sections */
  function heads(b) {
    kids(b).forEach(function (g) {
      if (!g.classList || !g.classList.contains('tab-group')) return;
      var key = g.getAttribute('data-w42g');
      if (key === 'departments') return;   /* wave116 looks after the Departments header */
      if (key === 'w262more') return;   /* wave262: folds() decides the More header (not 'more': that was an older group's key) */
      var any = Array.prototype.some.call(g.querySelectorAll('.tab'), function (t) { return shown(t) && t.getAttribute('data-tab') !== 'adminpanel'; });
      if (key === 'admin') {
        var adm = tabOf(g, 'adminpanel'), on = !!adm && shown(adm);
        if (g.classList.contains('w134on') !== on) g.classList.toggle('w134on', on);
        any = any || on;
      }
      var want = any ? '' : 'none';
      var h = g.querySelector(':scope > .tab-group-h');
      if (h && h.style.display !== want) h.style.display = want;
      if (g.style.display !== want) g.style.display = want;
    });
  }
  /* ---------- wave262: the folds (More, and the other teams) ----------
     Steel (20/10/26): keep each person's menu simple, "just really keeping the main important things on the main page and
     then a drop down of other tabs". Nothing is taken away: the buttons stay where the layout puts them and a fold only
     hides them until it is opened (a click, remembered on this device), and it opens by itself when you are on one of its
     pages. Computers only: the phone's Menu sheet (wave163b) already lists every page with its own Find a page. */
  var FOLD_KEY = { more: 'wa262.more', teams: 'wa262.teams' };
  function remembered(k) { try { return localStorage.getItem(FOLD_KEY[k]); } catch (e) { return null; } }
  function remember(k, v) { try { localStorage.setItem(FOLD_KEY[k], v ? '1' : '0'); } catch (e) { /* private mode */ } }
  function amAdmin() { try { return typeof WA40_MINE !== 'undefined' && !!WA40_MINE && WA40_MINE.role === 'admin'; } catch (e) { return false; } }
  /* the person's own team: their roster department, when it has a team row they can open */
  function myTeam(b) {
    var d = '';
    try { d = (typeof WA_ME !== 'undefined' && WA_ME && WA_ME.department) || ''; } catch (e) { d = ''; }
    if (!d) return '';
    var t = tabOf(b, d), row = t && t.closest ? t.closest('.w42d') : null;
    return row && shown(t) ? d : '';
  }
  function foldEl(b, g) {
    var el = b.querySelector('.tab-group[data-w42g="' + g.key + '"]');
    if (!el) {
      el = document.createElement('span'); el.className = 'tab-group w262fold'; el.setAttribute('data-w42g', g.key);
      el.innerHTML = '<button type="button" class="w262fh" aria-expanded="false" data-w262fold="more"><span class="w262lb">' + E(g.label) + '</span><span class="w262ch" aria-hidden="true">&#9662;</span></button>';
      el.querySelector('button').addEventListener('click', function (ev) {
        ev.stopPropagation();
        var open = !(bar() && bar().classList.contains('w262more'));
        remember('more', open); folds(bar(), true);
      });
    }
    return el;
  }
  function teamsToggle(host) {
    var t = host.querySelector(':scope > .w262tt');
    if (!t) {
      t = document.createElement('button'); t.type = 'button'; t.className = 'w262tt'; t.setAttribute('data-w262fold', 'teams');
      t.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var open = !(bar() && bar().classList.contains('w262teams'));
        remember('teams', open); folds(bar(), true);
      });
      host.appendChild(t);
    }
    return t;
  }
  function activeTab(b) { return b.querySelector('.tab.active'); }
  function folds(b, byHand) {
    if (!b) return;
    try {
      /* More: Other Tools and Organization */
      var more = b.querySelector(':scope > .tab-group[data-w42g="w262more"]');
      var inside = (groupDef('w262more') || {}).fold || [];
      var any = inside.some(function (k) { var g = b.querySelector(':scope > .tab-group[data-w42g="' + k + '"]'); return !!g && g.style.display !== 'none' && Array.prototype.some.call(g.querySelectorAll('.tab'), shown); });
      var act = activeTab(b), here = !!act && inside.some(function (k) { var g = b.querySelector(':scope > .tab-group[data-w42g="' + k + '"]'); return !!g && g.contains(act); });
      var r = remembered('more'), open = here || r === '1';
      if (more) {
        var want = any ? '' : 'none'; if (more.style.display !== want) more.style.display = want;
        var hb = more.querySelector('.w262fh'); if (hb && hb.getAttribute('aria-expanded') !== String(open)) hb.setAttribute('aria-expanded', String(open));
      }
      if (b.classList.contains('w262more') !== open) b.classList.toggle('w262more', open);
      /* Teams: your team first; the others behind "Other teams" */
      var dep = b.querySelector(':scope > .tab-group[data-w42g="departments"]'), host = dep ? hostOf(dep) : null;
      var mine = myTeam(b);
      if (!host) return;
      var rows = Array.prototype.filter.call(host.children, function (c) { return c.classList && c.classList.contains('w42d'); });
      var others = rows.filter(function (row) { var m = row.querySelector(':scope > .tab'); return !(m && m.getAttribute('data-tab') === mine); });
      var visibleOthers = others.filter(function (row) { return row.style.display !== 'none' && Array.prototype.some.call(row.querySelectorAll('.tab'), shown); });
      var useFold = !!mine && visibleOthers.length > 0;
      if (dep.classList.contains('w262tf') !== useFold) dep.classList.toggle('w262tf', useFold);
      rows.forEach(function (row) {
        var isOther = others.indexOf(row) >= 0, isHere = isOther && ((!!act && row.contains(act)) || row.classList.contains('w116act'));
        if (row.classList.contains('w262other') !== (useFold && isOther)) row.classList.toggle('w262other', useFold && isOther);
        if (row.classList.contains('w262here') !== isHere) row.classList.toggle('w262here', isHere);
        if (!isOther && useFold && !row.hasAttribute('data-w262mine')) row.setAttribute('data-w262mine', '1');
      });
      if (!useFold) { var old = host.querySelector(':scope > .w262tt'); if (old && old.style.display !== 'none') old.style.display = 'none'; if (b.classList.contains('w262teams')) b.classList.remove('w262teams'); return; }
      var tr = remembered('teams'), topen = tr === null ? amAdmin() : tr === '1';
      if (b.classList.contains('w262teams') !== topen) b.classList.toggle('w262teams', topen);
      var tt = teamsToggle(host); if (tt.style.display) tt.style.display = '';
      var label = (topen ? 'Hide other teams' : 'Other teams') + ' (' + visibleOthers.length + ')';
      if (tt.getAttribute('data-l') !== label) { tt.setAttribute('data-l', label); tt.innerHTML = '<span>' + E(label) + '</span><span class="w262ch" aria-hidden="true">&#9662;</span>'; }
      if (tt.getAttribute('aria-expanded') !== String(topen)) tt.setAttribute('aria-expanded', String(topen));
    } catch (e) { console.warn('wave262 folds', e); }
  }

  /* true when every page is where the layout wants it (the tests ask this) */
  function ok() {
    var b = bar(); if (!b) return true;
    var loose = LAYOUT.top.concat(LAYOUT.afterEvents || []);
    for (var i = 0; i < loose.length; i++) { var t = tabOf(b, loose[i]); if (t && t.parentNode !== b) return false; }
    for (var j = 0; j < LAYOUT.groups.length; j++) {
      var g = LAYOUT.groups[j]; if (!g.items) continue;
      var el = b.querySelector('.tab-group[data-w42g="' + g.key + '"]'), w = wanted(b, g);
      if (w.length && !el) return false;
      var host = el ? hostOf(el) : null;
      for (var k = 0; k < w.length; k++) if (w[k].parentNode !== host || host.children[k] !== w[k]) return false;
    }
    return !b.querySelector(':scope > .tab-group[data-w42g="strategy"], :scope > .tab-group[data-w42g="more"], :scope > .tab-group[data-w42g="goals"], :scope > .tab-group[data-w42g="resources"], :scope > .tab-group[data-w42g="people"], :scope > .tab-group[data-w42g="meetings"], :scope > .tab-group[data-w42g="inbox"]');
  }
  function watch() {
    var b = bar(); if (!b) return;
    if (!OBS) OBS = new MutationObserver(function () {
      if (busy) return;
      clearTimeout(T);
      T = setTimeout(function () { try { apply(); } catch (e) { /* fine */ } }, 90);
    });
    OBS.observe(b, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  }
