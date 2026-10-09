
  /* ---------- the dock, the launcher and the rail ---------- */
  var S = { app: null, open: false, drawn: 0 };
  function nav() { return document.querySelector('nav.wa-nav'); }
  function ensure() {
    var n = nav(); if (!n) return false;
    if (!document.getElementById('w153rail')) {
      var r = document.createElement('div'); r.id = 'w153rail'; r.setAttribute('aria-label', 'App menu');
      var bar = document.getElementById('tabBar');
      if (bar && bar.parentNode === n) bar.insertAdjacentElement('afterend', r); else n.appendChild(r);
    }
    if (!document.getElementById('w153dock')) {
      var d = document.createElement('div'); d.id = 'w153dock';
      d.innerHTML = '<button type="button" class="w153grid" aria-label="Apps" aria-haspopup="true" aria-expanded="false" data-w153grid="1">' + I('grid') + '<span>Apps</span></button>' +
        '<button type="button" class="w153back" data-w153back="1">' + I('back') + ' Back to the Hub</button>';
      n.appendChild(d);
    }
    if (!document.getElementById('w153pop')) {
      var p = document.createElement('div'); p.id = 'w153pop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Apps');
      document.body.appendChild(p);
    }
    if (!document.getElementById('w153bar')) {
      var main = document.querySelector('main');
      if (main) { var b = document.createElement('div'); b.id = 'w153bar'; main.insertBefore(b, main.firstChild); }
    }
    return true;
  }
  function tileHtml(a, on) {
    return '<button type="button" class="w153tile' + (on ? ' on' : '') + '" data-w153app="' + E(a.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '"><span class="w153ai" style="background:' + a.color + '">' + I(a.ic) + '</span><b>' + E(a.label) + '</b><small>' + E(a.blurb) + '</small></button>';
  }
  /* 01/10/26: a link tile (the website): a real link, so it opens in a new tab and the Hub stays put */
  function linkHtml(l) {
    return '<a class="w153tile w153ext" href="' + E(l.url) + '" target="_blank" rel="noopener" data-w153ext="' + E(l.id) + '"><span class="w153ai" style="background:' + l.color + '">' + I(l.ic) + '</span><b>' + E(l.label) + I('ext', 'w153xi') + '</b><small>' + E(l.blurb) + '</small></a>';
  }
  function paintPop() {
    var p = document.getElementById('w153pop'); if (!p) return;
    var cur = S.app || 'hub';
    p.innerHTML = '<div class="w153ph">Apps</div><div class="w153tiles">' + ORDER.filter(appOk).map(function (id) { return tileHtml(APPS[id], id === cur); }).join('') +
      (LINKS.length ? '<div class="w153sep" role="presentation"></div>' + LINKS.map(linkHtml).join('') : '') + '</div>';
  }
  function openPop() { var p = document.getElementById('w153pop'), g = document.querySelector('#w153dock .w153grid'); if (!p) return; paintPop(); p.classList.add('open'); S.open = true; if (g) g.setAttribute('aria-expanded', 'true'); var f = p.querySelector('.w153tile.on') || p.querySelector('.w153tile'); if (f) { try { f.focus(); } catch (e) { /* fine */ } } }
  function closePop() { var p = document.getElementById('w153pop'), g = document.querySelector('#w153dock .w153grid'); if (p) p.classList.remove('open'); S.open = false; if (g) g.setAttribute('aria-expanded', 'false'); }
  function togglePop() { if (S.open) closePop(); else openPop(); }

  /* the rail: the app's pages and sections, the current one marked */
  /* pages with sections switched inside the page: how to read the current one, and the button that opens one */
  var SEC = {
    finances: { now: function () { var t = document.querySelector('#finances .w94tab.on'); return t ? t.getAttribute('data-w94tab') : 'overview'; }, btn: function (k) { return document.querySelector('#finances .w94tab[data-w94tab="' + k + '"]'); }, count: function () { return document.querySelectorAll('#finances .w94tab').length; } },
    hrcentre: { now: function () { var t = document.querySelector('#hrcentre .w47tab.on'); return t ? t.getAttribute('data-w47v') : null; }, btn: function (k) { return document.querySelector('#hrcentre .w47tab[data-w47v="' + k + '"]'); }, count: function () { return document.querySelectorAll('#hrcentre .w47tab').length; } }
  };
  function secNow(page) { return SEC[page] ? SEC[page].now() : null; }
  function subOf(h) { return String(h || '').replace(/^#/, '').split('/')[1] || ''; }
  function firstOfPage(app, pg) { var gs = items(app); for (var i = 0; i < gs.length; i++) for (var j = 0; j < gs[i].items.length; j++) if (pageOf(gs[i].items[j].h) === pg) return gs[i].items[j]; return null; }
  function isOn(app, it) {
    var h = hashNow(), pg = pageOf(h), sub = subOf(h), ip = pageOf(it.h), isub = subOf(it.h);
    if (app === 'strategy' && pg === 'project') return ip === 'projects';   /* wave163: a project's own page marks Projects */
    if (ip !== pg) return false;
    if (app === 'fund' && ip === 'fund') {   /* wave193: #fund/<section>[/<view>|<id>]: the view is the third part; a grant's id marks the Pipeline */
      var fs = h.replace(/^#/, '').split('/'), is = it.h.replace(/^#/, '').split('/');
      if ((fs[1] || '') !== (is[1] || '')) return false;
      if ((fs[1] || '') !== 'grants') return true;
      var v = String(fs[2] || '').split('?')[0]; if (!/^(found|funders|write|playbook|facts)$/.test(v)) v = '';
      return v === String(is[2] || '');
    }
    if (it.sec) return secNow(ip) === it.sec;
    if (app === 'crm' && ip === 'crm') return (isub || 'contacts') === (sub === 'c' || !sub ? 'contacts' : sub);
    if (!sub) return isub ? firstOfPage(app, ip) === it : true;   /* the page alone: its first section */
    if (isub) return isub === sub;
    /* the page's own item while the address names a section the rail does not list */
    return !items(app).some(function (g) { return g.items.some(function (x) { return pageOf(x.h) === ip && subOf(x.h) === sub; }); });
  }
  function paintRail() {
    var r = document.getElementById('w153rail'); if (!r) return;
    var app = S.app; if (!app) { r.innerHTML = ''; return; }
    var a = APPS[app], gs = items(app);
    r.innerHTML = '<div class="w153ah"><span class="w153ai" style="background:' + a.color + '">' + I(a.ic) + '</span><div><b>' + E(a.label) + '</b><small>' + E(a.blurb) + '</small></div></div>' +
      gs.map(function (g) {
        return '<div class="w153sec">' + (g.solo ? '' : '<div class="w153sh">' + E(g.label) + '</div>') + g.items.map(function (it) {
          var on = isOn(app, it);
          return '<a class="w153it' + (on ? ' on' : '') + '" href="' + E(it.h) + '" data-w153go="' + E(it.h) + '"' + (it.sec ? ' data-w153sec="' + E(it.sec) + '"' : '') + (on ? ' aria-current="page"' : '') + '>' + I(it.ic) + '<span>' + E(it.l) + '</span>' + (it.n ? '<small class="w153n">' + E(it.n) + '</small>' : '') + '</a>';
        }).join('') + '</div>';
      }).join('') +
      (a.next ? '<div class="w153next"><b>Next in the ' + E(a.label) + '</b>' + a.next.map(function (n) { return '<span>' + I(n[0]) + E(n[1]) + '</span>'; }).join('') + '</div>' : '');
  }
  /* the app bar: the app, where you are, its quick actions */
  function whereNow(app) {
    var gs = items(app), found = null;
    gs.forEach(function (g) { g.items.forEach(function (it) { if (!found && isOn(app, it)) found = it; }); });
    if (found) return found.l;
    var h = hashNow(), pg = pageOf(h);
    var t = tab(pg); return t ? (t.textContent || '').trim() : '';
  }
  function paintBar() {
    var b = document.getElementById('w153bar'); if (!b) return;
    var app = S.app; if (!app) { b.innerHTML = ''; return; }
    var a = APPS[app], where = whereNow(app);
    b.innerHTML = '<div class="w153bc"><span class="w153ai" style="background:' + a.color + ';width:28px;height:28px;border-radius:8px">' + I(a.ic) + '</span><b>' + E(a.label) + '</b>' + (where ? '<span>' + E(where) + '</span>' : '') + '</div>' +
      '<div class="w153acts"><button type="button" class="w153menu" data-w153menu="1">' + I('menu') + ' Menu</button>' +
      (a.actions || []).filter(function (x) { return !x.page || x.page === pageOf(hashNow()); }).map(function (x) { return '<button type="button" class="w153btn" data-w153act="' + E(x.k) + '">' + I(x.ic) + ' ' + E(x.l) + '</button>'; }).join('') + '</div>';
  }
  function sig() { var h = hashNow(), pg = pageOf(h); return h + '|' + (SEC[pg] ? SEC[pg].now() + '/' + SEC[pg].count() : '') + '|' + (S.app || ''); }
  function paint() {
    if (!ensure()) return;
    S.sig = sig();
    var hn = hashNow(), pn = pageOf(hn), sn = subOf(hn);
    if (hn !== S.lastHash) { S.lastHash = hn; S.settled = null; }   /* a fresh address gets its section settled once */
    if (SEC[pn] && sn && S.settled !== hn && SEC[pn].now() !== sn) { S.settled = hn; settle(pn, sn); }
    var was = S.app; S.app = current(); S.sig = sig();
    document.body.classList.toggle('w153app', !!S.app);
    ORDER.forEach(function (id) { document.body.classList.toggle('w153' + id, S.app === id); });
    var dock = document.getElementById('w153dock');
    var any = ORDER.some(function (id) { return id !== 'hub' && appOk(id); });
    if (dock) dock.style.display = any ? '' : 'none';
    if (!S.app) { var h = hashNow(); if (h && pageOf(h) && !ownerOf(pageOf(h))) store(KEY_LAST, h); }
    paintRail(); paintBar(); if (S.open) paintPop();
    if (was !== S.app) try { document.dispatchEvent(new CustomEvent('wa153app', { detail: { app: S.app } })); } catch (e) { /* fine */ }
    S.drawn++;
  }

  /* ---------- open and close ---------- */
  function open(id) {
    closePop();
    if (id === 'hub' || !APPS[id]) return close();
    if (!appOk(id)) return;
    var pg = pageOf(hashNow());
    if (APPS[id].pages.indexOf(pg) < 0) { if (APPS[id].home) go(APPS[id].home); else { var gs = items(id), first = gs.length ? gs[0].items[0] : null; if (first) go(first.h, first.sec); else location.hash = '#mypage'; } } else paint();
    try { document.body.classList.remove('wa-mob-open'); } catch (e) { /* fine */ }
  }
  /* back to the Hub: the page you left (an app's page always opens its app, so leaving means going somewhere else) */
  function close() {
    closePop();
    var last = read(KEY_LAST), lp = last ? pageOf(last) : '';
    var to = last && lp && !ownerOf(lp) ? last : '#mypage';
    if (location.hash !== to) location.hash = to; else paint();
    try { document.body.classList.remove('wa-mob-open'); } catch (e) { /* fine */ }
  }
  /* a section named in the address: the page may still be drawing (some rebuild their tabs), so keep asking until it is on */
  function settle(pg, sec) {
    if (!SEC[pg] || !sec) return;
    if (S.settle) clearInterval(S.settle);
    var tries = 0, clicks = 0;
    S.settle = setInterval(function () {
      tries++;
      var sub = subOf(hashNow());
      if (pageOf(hashNow()) !== pg || (sub && sub !== sec)) { clearInterval(S.settle); S.settle = null; return; }
      if (SEC[pg].now() === sec) { clearInterval(S.settle); S.settle = null; setTimeout(paint, 60); return; }
      var t = SEC[pg].btn(sec);
      if (t && !t.classList.contains('on') && clicks < 3) { clicks++; t.click(); }
      if (tries > 30) { clearInterval(S.settle); S.settle = null; }
    }, 150);
  }
  function go(h, sec) {
    var pg = pageOf(h);
    if (location.hash !== h) location.hash = h; else { try { if (typeof applyHash === 'function') applyHash(); } catch (e) { /* fine */ } }
    if (sec) settle(pg, sec);
    try { document.body.classList.remove('wa-mob-open'); } catch (e) { /* fine */ }
  }
  function act(k) {
    if (S.app === 'studio' && k === 'newpost') { try { if (pageOf(hashNow()) === 'contentcal' && window.w121 && window.w121.compose) window.w121.compose(); else location.hash = '#contentcal/new'; } catch (e) { location.hash = '#contentcal/new'; } return; }   /* wave225 */
    if (S.app === 'volunteer' && k === 'text') { try { if (typeof waTxtModal === 'function') waTxtModal(); } catch (e) { /* fine */ } return; }
    if (S.app === 'crm' && k === 'add') {
      if (pageOf(hashNow()) !== 'crm' || (hashNow().split('/')[1] || '') !== '') location.hash = '#crm';
      var tries = 0, iv = setInterval(function () { tries++; var b = document.querySelector('#crm [data-w152add]'); if (b) { clearInterval(iv); b.click(); } else if (tries > 40) clearInterval(iv); }, 100);
    }
  }
