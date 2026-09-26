
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
    (g.items || []).forEach(function (id) {
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
      var res = null;
      LAYOUT.groups.forEach(function (g) {
        if (!g.items) { var d = b.querySelector('.tab-group[data-w42g="' + g.key + '"]'); if (d) seq.push(d); return; }
        var el = groupEl(b, g), host = hostOf(el);
        wanted(b, g).forEach(function (t, i) {
          if (g.loose) t.classList.remove('w116tool');
          var id = t.getAttribute && t.getAttribute('data-tab');
          if (id && LABEL[id]) relabel(t, LABEL[id]);
          putAt(host, t, i);
        });
        if (g.key === 'resources') res = host;
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
  /* true when every page is where the layout wants it (the tests ask this) */
  function ok() {
    var b = bar(); if (!b) return true;
    for (var i = 0; i < LAYOUT.top.length; i++) { var t = tabOf(b, LAYOUT.top[i]); if (t && t.parentNode !== b) return false; }
    for (var j = 0; j < LAYOUT.groups.length; j++) {
      var g = LAYOUT.groups[j]; if (!g.items) continue;
      var el = b.querySelector('.tab-group[data-w42g="' + g.key + '"]'), w = wanted(b, g);
      if (w.length && !el) return false;
      var host = el ? hostOf(el) : null;
      for (var k = 0; k < w.length; k++) if (w[k].parentNode !== host || host.children[k] !== w[k]) return false;
    }
    return !b.querySelector(':scope > .tab-group[data-w42g="strategy"], :scope > .tab-group[data-w42g="more"]');
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
