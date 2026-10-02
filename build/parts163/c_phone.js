
  /* ---------- the phone menu (wave163b) ----------
     Steel (29/09/26): "the mobile layout of the menu at the bottom needs some serious testing and redesign to make it
     more intuitive". Tested first: Ask read as a menu button (the striped E in a gold circle), Teams and More opened the
     same long drawer, the apps sat at the bottom of it, and nothing lit up on most pages. His choice: a new bar, Home,
     Calendar, Ask, My team and Menu, with Menu opening a full-screen sheet (Find a page, the apps as tiles, then every
     section) and the page you are on always lit.
     - The bar (#w163bar, phones and narrow windows up to 900 px) replaces wave114's #w114bar, which stays in the page
       hidden (its drawer still opens from the older places). Home is the Executive dashboard for directors (they have no
       Home); My team opens your own team's page (directors: the Board overview; no team page: the sheet at Departments).
     - The sheet (#w163sheet) is drawn from the menu itself each time it opens, so it always shows what your access
       opens, in the menu's order: the top pages, Departments (each team with its own pages as chips; yours says so),
       Other Tools and Organization. Inside an app it shows that app's menu instead, with Back to the Hub. A choice in it
       presses the same button the menu would, so every page opens exactly as it does from the menu.
     - Typing hides the bar (as wave130 does for the old one); Esc, the close button or any choice closes the sheet. */
  var PH = { open: false, q: '', lastFocus: null, built: 0 };
  var GREEN = '#103F39', CREAM = '#FFFAF2', INK = '#1F201E', MUTED = '#797773';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var PI = {
    home: '<path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.3 9.8v9.7h11.4V9.8"/><path d="M10 19.5v-5h4v5"/>',
    chart: '<path d="M4 19.5h16"/><path d="M7 16V10M12 16V5.5M17 16v-7"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.6"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2.5M13.5 14H16M8 17h2.5"/>',
    ask: '<path d="M4.5 18.8V7.2A2.7 2.7 0 0 1 7.2 4.5h9.6a2.7 2.7 0 0 1 2.7 2.7v6.6a2.7 2.7 0 0 1-2.7 2.7H8.6z"/><path d="M12 7.6l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" fill="currentColor" stroke="none"/>',
    team: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.2 19.5c.7-3.2 3-5 5.8-5s5.1 1.8 5.8 5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16.4 14.4c2.2.2 3.8 1.7 4.4 4.6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    chev: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="m10 6-6 6 6 6"/><path d="M4 12h16"/>'
  };
  function PIc(n, cls) { return '<svg class="w163i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PI[n] || '') + '</svg>'; }
  function Esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function foldS(s) { try { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); } catch (e) { return String(s || '').toLowerCase().trim(); } }

  var pcss = ''
    + '#w163bar,#w163sheet{display:none;}'
    + '@media (max-width:900px){'
    /* the new bar takes the old one's place */
    + '#w114bar{display:none !important;}'
    + '#w163bar{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:end;position:fixed;left:0;right:0;bottom:0;z-index:92;background:var(--wa-card,' + CREAM + ');border-top:1px solid rgba(16,63,57,.10);box-shadow:0 -6px 22px rgba(16,63,57,.07);padding:6px 4px calc(8px + env(safe-area-inset-bottom));font-family:' + BODY + ';}'
    + '#w163bar.n4{grid-template-columns:repeat(4,minmax(0,1fr));}'
    + '#w163bar button{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;min-height:52px;background:none;border:none;padding:0;margin:0;cursor:pointer;color:' + MUTED + ';font-family:' + BODY + ';font-size:11.5px;font-weight:600;letter-spacing:.1px;-webkit-tap-highlight-color:transparent;}'
    + '#w163bar button .pill{display:flex;align-items:center;justify-content:center;width:52px;height:30px;border-radius:15px;transition:background .18s ease;}'
    + '#w163bar button .w163i{width:23px;height:23px;}'
    + '#w163bar button.on{color:' + GREEN + ';font-weight:700;}'
    + '#w163bar button.on .pill{background:rgba(16,63,57,.12);}'
    + '#w163bar button:focus-visible{outline:none;}#w163bar button:focus-visible .pill{box-shadow:0 0 0 2px ' + GOLD + ';}'
    + '#w163bar button.ask{color:' + GREEN + ';}'
    + '#w163bar button.ask .pill{width:54px;height:54px;border-radius:50%;background:' + GOLD + ';margin-top:-26px;box-shadow:0 8px 20px rgba(16,63,57,.28);border:3px solid var(--wa-card,' + CREAM + ');}'
    + '#w163bar button.ask .w163i{width:26px;height:26px;}'
    /* typing, the sheet and Ask the Hub (full screen on a phone: the old bar sat on its message box) put the bar away */
    + 'body.w130typing #w163bar,body.w163sheet #w163bar,body.w163chat #w163bar{display:none !important;}'
    /* the app bar's own Menu button: the bar's Menu does it now */
    + '#w153bar .w153menu{display:none !important;}'
    /* the sheet */
    + '#w163sheet{display:flex;flex-direction:column;position:fixed;inset:0;z-index:260;background:' + CREAM + ';color:' + INK + ';font-family:' + BODY + ';transform:translateY(100%);visibility:hidden;transition:transform .26s cubic-bezier(.2,.8,.2,1),visibility 0s linear .26s;}'
    + '#w163sheet.on{transform:none;visibility:visible;transition:transform .26s cubic-bezier(.2,.8,.2,1),visibility 0s;}'
    + '#w163sheet .hd{display:flex;align-items:center;gap:10px;padding:calc(14px + env(safe-area-inset-top)) 16px 10px;}'
    + '#w163sheet .hd h2{flex:1;margin:0;font-family:' + HEAD + ';font-weight:600;font-size:28px;letter-spacing:.8px;text-transform:uppercase;color:' + GREEN + ';line-height:1;}'
    + '#w163sheet .hd .x{width:42px;height:42px;border-radius:50%;border:none;background:rgba(16,63,57,.08);color:' + GREEN + ';display:flex;align-items:center;justify-content:center;cursor:pointer;}'
    + '#w163sheet .hd .x .w163i{width:22px;height:22px;}'
    + '#w163sheet .q{margin:0 16px 10px;display:flex;align-items:center;gap:8px;background:rgba(16,63,57,.05);border:1px solid rgba(16,63,57,.16);border-radius:14px;padding:0 12px;}'
    + '#w163sheet .q .w163i{width:18px;height:18px;color:' + MUTED + ';flex:0 0 auto;}'
    + '#w163sheet .q input{flex:1;min-width:0;border:none;background:none;outline:none;font:500 16px ' + BODY + ';color:' + INK + ';padding:12px 0;}'
    + '#w163sheet .bd{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:0 0 calc(24px + env(safe-area-inset-bottom));}'
    + '#w163sheet .apps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 8px;padding:4px 16px 10px;}'
    + '#w163sheet .app{display:flex;flex-direction:column;align-items:center;gap:6px;border:none;background:none;padding:4px 0;cursor:pointer;font:600 12px ' + BODY + ';color:' + INK + ';text-align:center;line-height:1.2;border-radius:14px;}'
    + '#w163sheet .app .t{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;color:' + CREAM + ';box-shadow:0 4px 12px rgba(16,63,57,.14);}'
    + '#w163sheet .app .t svg{width:24px;height:24px;}'
    /* 01/10/26: the website link after the apps (a real link in its own list item: it opens in a new tab) */
    + '#w163sheet .appx{display:flex;justify-content:center;min-width:0;}'
    + '#w163sheet .appx .app{width:100%;text-decoration:none;}'
    + '#w163sheet .app.ext .t{color:' + GREEN + ';}'
    + '#w163sheet .app .xl{display:inline-flex;align-items:center;gap:3px;}'
    + '#w163sheet .app .xl .w163xi{width:11px;height:11px;color:' + MUTED + ';}'
    + '#w163sheet .app.on .t{box-shadow:0 0 0 3px ' + CREAM + ',0 0 0 5px ' + GREEN + ';}'
    + '#w163sheet .app.on{color:' + GREEN + ';font-weight:700;}'
    + '#w163sheet .sh{font-family:' + HEAD + ';font-weight:600;font-size:13px;letter-spacing:1.6px;text-transform:uppercase;color:' + MUTED + ';padding:14px 20px 6px;}'
    + '#w163sheet .it{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;box-sizing:border-box;padding:8px 18px 8px 20px;border:none;background:none;text-align:left;cursor:pointer;font:500 15.5px ' + BODY + ';color:' + INK + ';}'
    + '#w163sheet .it .dot{width:10px;height:10px;border-radius:3px;flex:0 0 auto;}'
    + '#w163sheet .it .ai{width:22px;height:22px;flex:0 0 auto;color:' + MUTED + ';}'
    + '#w163sheet .it .lb{flex:1;min-width:0;}'
    + '#w163sheet .it .lb small{display:block;font-size:12px;font-weight:500;color:' + MUTED + ';margin-top:1px;}'
    + '#w163sheet .it .w163i.ch{width:16px;height:16px;color:rgba(16,63,57,.35);flex:0 0 auto;}'
    + '#w163sheet .it .n{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:' + GOLD + ';color:' + GREEN + ';font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}'
    + '#w163sheet .it .mine{font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:' + GREEN + ';background:rgba(220,165,39,.25);border-radius:6px;padding:2px 6px;}'
    + '#w163sheet .it.on{background:rgba(16,63,57,.08);color:' + GREEN + ';font-weight:700;box-shadow:inset 3px 0 0 ' + GOLD + ';}'
    + '#w163sheet .it:active{background:rgba(16,63,57,.06);}'
    + '#w163sheet .chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 18px 8px 42px;margin-top:-4px;}'
    + '#w163sheet .chip{border:1px solid rgba(16,63,57,.16);background:rgba(16,63,57,.04);border-radius:999px;padding:6px 11px;font:600 12.5px ' + BODY + ';color:' + GREEN + ';cursor:pointer;}'
    + '#w163sheet .chip.on{background:' + GREEN + ';color:' + CREAM + ';border-color:' + GREEN + ';}'
    + '#w163sheet .back{display:flex;align-items:center;gap:8px;margin:2px 16px 6px;border:none;background:rgba(16,63,57,.07);color:' + GREEN + ';border-radius:12px;padding:11px 14px;font:700 14px ' + BODY + ';cursor:pointer;}'
    + '#w163sheet .back .w163i{width:18px;height:18px;}'
    + '#w163sheet .none{padding:18px 20px;color:' + MUTED + ';font-size:14px;}'
    + '#w163sheet .it:focus-visible,#w163sheet .chip:focus-visible,#w163sheet .app:focus-visible,#w163sheet .x:focus-visible,#w163sheet .back:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:-2px;}'
    + 'body.w163sheet{overflow:hidden;}'
    + '}'
    + '@media (prefers-reduced-motion: reduce){#w163sheet,#w163sheet.on{transition:none !important;}#w163bar button .pill{transition:none !important;}}';
  if (!document.getElementById('wa163pcss')) { var pst = document.createElement('style'); pst.id = 'wa163pcss'; pst.textContent = pcss; document.head.appendChild(pst); }

  /* ---------- reading the menu ---------- */
  function tabBar() { return document.getElementById('tabBar'); }
  function tabEl(id) { var b = tabBar(); return b ? b.querySelector('.tab[data-tab="' + id + '"]') : null; }
  function shownEl(el) { if (!el) return false; if (el.style && el.style.display === 'none') return false; try { return getComputedStyle(el).display !== 'none'; } catch (e) { return true; } }
  function labelOf(el) { var t = ''; if (!el) return t; el.childNodes.forEach(function (n) { if (n.nodeType === 3) t += n.textContent; else if (n.nodeType === 1 && !n.classList.contains('tabdot') && !n.classList.contains('w134n') && !n.classList.contains('caret') && n.tagName !== 'svg') t += n.textContent; }); return t.replace(/\s+/g, ' ').trim(); }
  function dotOf(el) { var d = el && el.querySelector('.tabdot'); return d ? (d.style.background || d.style.backgroundColor || '') : ''; }
  function badgeOf(el) { var n = el && el.querySelector('.w134n'); return n ? (n.textContent || '').trim() : ''; }
  function boardView() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function hashRoot() { var h = ''; try { h = decodeURIComponent(location.hash || ''); } catch (e) { h = location.hash || ''; } return h.replace(/^#/, '').split('/'); }
  function activeId() { var t = document.querySelector('#tabBar .tab.active'); return t ? t.getAttribute('data-tab') : ''; }
  /* the page you are on as the menu names it (Home has no marked button: its panel says so) */
  function curId() {
    var a = activeId(); if (a) return a;
    var p = document.querySelector('.panel.active'); if (p && p.id && tabEl(p.id)) return p.id;
    return hashRoot()[0] || 'mypage';
  }
  /* the signed-in person's team: their roster department, when it has a team page they can open */
  function myTeamId() {
    if (boardView()) return shownEl(tabEl('governance')) ? 'governance' : '';
    var d = '';
    try { d = (typeof WA_ME !== 'undefined' && WA_ME && WA_ME.department) || ''; } catch (e) { d = ''; }
    if (!d) { try { var em = String((USER && USER.email) || '').toLowerCase(); var m = (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).filter(function (x) { return String(x.email || '').toLowerCase() === em; })[0]; d = (m && m.department) || ''; } catch (e) { d = ''; } }
    return d && shownEl(tabEl(d)) ? d : '';
  }
  /* which bar button the page you are on belongs to */
  function barKey() {
    if (PH.open) return 'menu';
    var p = hashRoot(), root = p[0] || '', act = curId();
    var first = shownEl(tabEl('mypage')) ? 'mypage' : 'overview';
    if (act === first || (!root && first === 'mypage')) return 'home';
    if (act === 'calendar') return 'cal';
    var mine = myTeamId();
    if (mine) {
      if (act === mine || (root === 'team' && p[1] === mine)) return 'team';
      var t = tabEl(act), row = t && t.closest ? t.closest('.w42d') : null, main = row ? row.querySelector(':scope > .tab') : null;
      if (main && main.getAttribute('data-tab') === mine) return 'team';
    }
    return 'menu';
  }

  /* ---------- the bar ---------- */
  function slots() {
    var out = [];
    if (shownEl(tabEl('mypage'))) out.push({ k: 'home', l: 'Home', ic: 'home', tab: 'mypage' });
    else if (tabEl('overview') && shownEl(tabEl('overview'))) out.push({ k: 'home', l: 'Dashboard', ic: 'chart', tab: 'overview' });
    if (shownEl(tabEl('calendar'))) out.push({ k: 'cal', l: 'Calendar', ic: 'cal', tab: 'calendar' });
    if (document.getElementById('waChatBtn')) out.push({ k: 'ask', l: 'Ask', ic: 'ask' });
    var mine = myTeamId();
    out.push({ k: 'team', l: boardView() ? 'Board' : (mine ? 'My team' : 'Teams'), ic: 'team', tab: mine || '' });
    out.push({ k: 'menu', l: 'Menu', ic: 'menu' });
    return out;
  }
  function paintBar() {
    var bar = document.getElementById('w163bar');
    if (!bar) {
      bar = document.createElement('nav'); bar.id = 'w163bar'; bar.setAttribute('aria-label', 'Hub');
      document.body.appendChild(bar);
    }
    var ss = slots(), key = barKey();
    var sig = ss.map(function (s) { return s.k + ':' + s.l + ':' + (s.tab || ''); }).join('|') + '#' + key;
    if (bar.getAttribute('data-sig') === sig) return;
    bar.setAttribute('data-sig', sig);
    bar.classList.toggle('n4', ss.length === 4);
    bar.innerHTML = ss.map(function (s) {
      var on = s.k !== 'ask' && s.k === key;
      return '<button type="button" class="' + (s.k === 'ask' ? 'ask' : '') + (on ? ' on' : '') + '" data-w163slot="' + s.k + '"' + (s.tab ? ' data-tab-go="' + Esc(s.tab) + '"' : '') + (on ? ' aria-current="page"' : '') + (s.k === 'menu' ? ' aria-haspopup="dialog" aria-expanded="' + (PH.open ? 'true' : 'false') + '"' : '') + (s.k === 'ask' ? ' aria-label="Ask the Hub"' : '') + '><span class="pill">' + PIc(s.ic) + '</span>' + Esc(s.l) + '</button>';
    }).join('');
  }
  function press(el) { if (!el) return false; try { el.click(); return true; } catch (e) { return false; } }
  function slotGo(k, btn) {
    if (k === 'menu') { if (PH.open) closeSheet(); else openSheet(); return; }
    if (k === 'ask') { closeSheet(true); press(document.getElementById('waChatBtn')); return; }
    var id = btn && btn.getAttribute('data-tab-go');
    if (k === 'team' && !id) { openSheet('departments'); return; }
    closeSheet(true);
    if (id) {
      /* inside an app a Hub page takes you out of it (wave153's rule); the menu's own button does the rest */
      if (!press(tabEl(id))) location.hash = '#' + id;
    }
  }

  /* ---------- the sheet ---------- */
  function ensureSheet() {
    var s = document.getElementById('w163sheet');
    if (s) return s;
    s = document.createElement('div'); s.id = 'w163sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); s.setAttribute('aria-label', 'Menu'); s.tabIndex = -1;
    s.innerHTML = '<div class="hd"><h2>Menu</h2><button type="button" class="x" data-w163close="1" aria-label="Close the menu">' + PIc('x') + '</button></div>' +
      '<label class="q">' + PIc('search') + '<input type="search" data-w163q="1" placeholder="Find a page" aria-label="Find a page" autocomplete="off" enterkeyhint="go"></label>' +
      '<div class="bd" data-w163bd="1"></div>';
    document.body.appendChild(s);
    return s;
  }
  /* every place the menu offers, in the menu's order, as {k: an id, l: label, sec: section, dot, badge, on, el: the button to press, go: an app address, sub: [chips], mine} */
  function hubItems() {
    var b = tabBar(); if (!b) return [];
    var act = curId(), mine = myTeamId(), out = [];
    function add(el, sec) {
      if (!shownEl(el)) return;
      var id = el.getAttribute('data-tab');
      out.push({ k: id, l: labelOf(el), sec: sec, dot: dotOf(el), badge: badgeOf(el), on: id === act, el: el });
    }
    Array.prototype.forEach.call(b.children, function (el) {
      if (el.classList.contains('tab')) { add(el, ''); return; }
      if (!el.classList.contains('tab-group') || !shownEl(el)) return;
      var h = el.querySelector(':scope > .tab-group-h'), sec = h ? labelOf(h) : '';
      var host = el.querySelector(':scope > .tab-group-p') || el;
      Array.prototype.forEach.call(host.children, function (c) {
        if (c.classList.contains('w42d')) {
          var main = c.querySelector(':scope > .tab');
          /* a team page this person cannot open (wave127 flattens the row): its own pages stand alone */
          if (!main || !shownEl(main)) { Array.prototype.forEach.call(c.querySelectorAll('.tab'), function (t) { if (t !== main) add(t, sec); }); return; }
          var id = main.getAttribute('data-tab');
          var subs = Array.prototype.filter.call(c.querySelectorAll('.w42sub .tab'), shownEl).map(function (t) { return { k: t.getAttribute('data-tab'), l: labelOf(t), el: t, on: t.getAttribute('data-tab') === act }; });
          out.push({ k: id, l: labelOf(main), sec: sec, dot: dotOf(main), badge: badgeOf(main), on: id === act, el: main, sub: subs, mine: (id === mine) });
          return;
        }
        if (c.classList.contains('tab')) add(c, sec);
      });
    });
    /* directors: their team is the board (the Board group's first page) */
    if (boardView()) out.forEach(function (it) { if (it.k === mine) it.mine = true; });
    return out;
  }
  function appList() {
    var A = window.WA_APP; if (!A || !A.order) return [];
    return A.order.filter(function (id) { try { return A.ok(id); } catch (e) { return false; } }).map(function (id) { return A.apps[id]; });
  }
  /* 01/10/26: links shown after the apps (the website), from wave153's list */
  function linkList() { var A = window.WA_APP; return A && Array.isArray(A.links) ? A.links : []; }
  function appItems(app) {
    var A = window.WA_APP; if (!A) return [];
    var out = [];
    try { A.items(app).forEach(function (g) { g.items.forEach(function (it) { out.push({ k: it.h + (it.sec ? '|' + it.sec : ''), l: it.l, sec: g.solo ? '' : g.label, go: it.h, gsec: it.sec || '', ic: it.ic, on: !!(A.isOn && A.isOn(app, it)), app: app, badge: it.n || null }); }); }); } catch (e) { /* fine */ }   /* wave164: no heading that repeats the app's name; the HR centre's counts */
    return out;
  }
  function rowHtml(it, i) {
    var lead = it.ic && window.WA_APP && window.WA_APP.icon ? '<span class="ai">' + window.WA_APP.icon(it.ic) + '</span>' : '<i class="dot" style="background:' + Esc(it.dot || 'rgba(16,63,57,.35)') + '"></i>';
    return '<button type="button" class="it' + (it.on ? ' on' : '') + '" data-w163i="' + i + '"' + (it.on ? ' aria-current="page"' : '') + '>' + lead +
      '<span class="lb">' + Esc(it.l) + (it.hint ? '<small>' + Esc(it.hint) + '</small>' : '') + '</span>' +
      (it.mine ? '<span class="mine">' + (boardView() ? 'Yours' : 'Your team') + '</span>' : '') + (it.badge ? '<span class="n">' + Esc(it.badge) + '</span>' : '') + PIc('chev', 'ch') + '</button>' +
      (it.sub && it.sub.length && !PH.q ? '<div class="chips">' + it.sub.map(function (s, j) { return '<button type="button" class="chip' + (s.on ? ' on' : '') + '" data-w163i="' + i + '" data-w163sub="' + j + '">' + Esc(s.l) + '</button>'; }).join('') + '</div>' : '');
  }
  function paintSheet(scrollTo) {
    var s = ensureSheet(), bd = s.querySelector('[data-w163bd]'); if (!bd) return;
    var A = window.WA_APP, app = null;
    try { app = A && A.current ? A.current() : null; } catch (e) { app = null; }
    var apps = appList(), q = foldS(PH.q), list = [], html = '';
    var h2 = s.querySelector('.hd h2'); if (h2) h2.textContent = app && A.apps[app] ? A.apps[app].label : 'Menu';
    if (q) {
      /* Find a page: the Hub's pages, their teams' own pages and every app's pages this person can open */
      hubItems().forEach(function (it) {
        list.push(it);
        (it.sub || []).forEach(function (sb) { list.push({ k: sb.k, l: sb.l, sec: it.l, el: sb.el, on: sb.on }); });
      });
      apps.forEach(function (a) { if (a.id !== 'hub') appItems(a.id).forEach(function (it) { it.hint = a.label; list.push(it); }); });
      var words = q.split(/\s+/).filter(Boolean);
      list = list.filter(function (it) { var hay = foldS(it.l + ' ' + (it.sec || '') + ' ' + (it.hint || '')); return words.every(function (w) { return hay.indexOf(w) >= 0; }); });
      list.forEach(function (it) { if (!it.hint) it.hint = it.sec || ''; });
      html = list.length ? list.map(rowHtml).join('') : '<div class="none">No page is called that. Try another word.</div>';
    } else {
      html += apps.length > 1 ? '<div class="sh">Apps</div><div class="apps" role="list">' + apps.map(function (a) {
        var on = (app || 'hub') === a.id;
        return '<button type="button" class="app' + (on ? ' on' : '') + '" role="listitem" data-w163app="' + Esc(a.id) + '"' + (on ? ' aria-current="true"' : '') + '><span class="t" style="background:' + Esc(a.color) + '">' + (A.icon ? A.icon(a.ic) : '') + '</span>' + Esc(a.label) + '</button>';
      }).join('') + linkList().map(function (l) {
        return '<div class="appx" role="listitem"><a class="app ext" href="' + Esc(l.url) + '" target="_blank" rel="noopener" data-w163ext="' + Esc(l.id) + '" aria-label="' + Esc(l.label + ', opens in a new tab') + '"><span class="t" style="background:' + Esc(l.color) + '">' + (A.icon ? A.icon(l.ic) : '') + '</span><span class="xl">' + Esc(l.label) + (A.icon ? A.icon('ext', 'w163xi') : '') + '</span></a></div>';
      }).join('') + '</div>' : '';
      if (app) {
        html += '<button type="button" class="back" data-w163back="1">' + PIc('back') + ' Back to the Hub</button>';
        list = appItems(app);
      } else list = hubItems();
      var sec = null;
      list.forEach(function (it, i) {
        if (it.sec !== sec) { sec = it.sec; if (sec) html += '<div class="sh" data-w163sec="' + Esc(foldS(sec)) + '">' + Esc(sec) + '</div>'; }
        html += rowHtml(it, i);
      });
      if (!list.length) html += '<div class="none">The menu is still loading.</div>';
    }
    PH.items = list;
    bd.innerHTML = html;
    PH.built++;
    if (scrollTo) { var t = bd.querySelector('[data-w163sec="' + scrollTo + '"]'); if (t) { try { bd.scrollTop = t.offsetTop - 8; } catch (e) { /* fine */ } } }
    else if (!q) { var on = bd.querySelector('.it.on'); if (on && on.offsetTop > bd.clientHeight - 80) { try { bd.scrollTop = on.offsetTop - 120; } catch (e) { /* fine */ } } }
  }
  function openSheet(scrollTo) {
    var s = ensureSheet();
    PH.lastFocus = document.activeElement;
    PH.q = ''; var inp = s.querySelector('[data-w163q]'); if (inp) inp.value = '';
    try { document.body.classList.remove('wa-mob-open'); } catch (e) { /* fine */ }
    PH.open = true;
    paintSheet(scrollTo ? foldS(scrollTo) : '');
    s.classList.add('on'); document.body.classList.add('w163sheet');
    paintBar();
    try { s.focus({ preventScroll: true }); } catch (e) { /* fine */ }
  }
  function closeSheet(quiet) {
    var s = document.getElementById('w163sheet');
    if (!PH.open) return;
    PH.open = false;
    if (s) s.classList.remove('on');
    document.body.classList.remove('w163sheet');
    paintBar();
    if (!quiet && PH.lastFocus && PH.lastFocus.focus) { try { PH.lastFocus.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  function choose(i, j) {
    var it = PH.items && PH.items[i]; if (!it) return;
    closeSheet(true);
    if (j != null && it.sub && it.sub[j]) { press(it.sub[j].el); return; }
    if (it.el) { press(it.el); return; }
    if (it.go && window.WA_APP && window.WA_APP.go) { window.WA_APP.go(it.go, it.gsec || null); return; }
    if (it.go) location.hash = it.go;
  }

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
    var el;
    if ((el = t.closest('#w163bar [data-w163slot]'))) { ev.preventDefault(); slotGo(el.getAttribute('data-w163slot'), el); return; }
    if (!t.closest('#w163sheet')) return;
    if ((el = t.closest('[data-w163close]'))) { ev.preventDefault(); closeSheet(); return; }
    if ((el = t.closest('[data-w163back]'))) { ev.preventDefault(); closeSheet(true); try { window.WA_APP.close(); } catch (e) { location.hash = '#mypage'; } return; }
    if ((el = t.closest('[data-w163ext]'))) { closeSheet(true); return; }   /* 01/10/26: the website opens its own tab (no preventDefault) */
    if ((el = t.closest('[data-w163app]'))) { ev.preventDefault(); var id = el.getAttribute('data-w163app'); closeSheet(true); try { if (id === 'hub') window.WA_APP.close(); else window.WA_APP.open(id); } catch (e) { /* fine */ } return; }
    if ((el = t.closest('[data-w163i]'))) { ev.preventDefault(); var sub = el.getAttribute('data-w163sub'); choose(Number(el.getAttribute('data-w163i')), sub == null ? null : Number(sub)); return; }
  });
  document.addEventListener('input', function (ev) {
    if (!ev.target || !ev.target.hasAttribute || !ev.target.hasAttribute('data-w163q')) return;
    PH.q = ev.target.value || ''; paintSheet('');
  });
  document.addEventListener('keydown', function (ev) {
    if (!PH.open) return;
    if (ev.key === 'Escape') { ev.preventDefault(); closeSheet(); return; }
    if (ev.key === 'Enter' && ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-w163q') && PH.q && PH.items && PH.items.length) { ev.preventDefault(); choose(0, null); }
  });
  window.addEventListener('hashchange', function () { if (PH.open) closeSheet(true); setTimeout(paintBar, 0); });
  if (typeof showPanel === 'function') {
    var __sp163 = showPanel;
    showPanel = function () { var r = __sp163.apply(this, arguments); try { setTimeout(paintBar, 0); } catch (e) { /* fine */ } return r; };
  }
  /* Ask the Hub opens full screen on a phone: while it is open the bar steps aside, so its message box is reachable */
  function chatOpen() { var p = document.getElementById('waChatPanel'); if (!p || p.style.display === 'none') return false; try { return getComputedStyle(p).display !== 'none'; } catch (e) { return false; } }
  function watchChat() {
    var p = document.getElementById('waChatPanel'); if (!p) return false;
    if (p.__w163) return true; p.__w163 = true;
    var f = function () { document.body.classList.toggle('w163chat', chatOpen()); };
    try { new MutationObserver(f).observe(p, { attributes: true, attributeFilter: ['style', 'class'] }); } catch (e) { /* fine */ }
    f(); return true;
  }
  /* the bar follows the menu: drawn at once (Home and Menu work before the Hub has started), again when the menu is whole */
  function initPhone() { try { paintBar(); watchChat(); } catch (e) { /* fine */ } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPhone); else initPhone();
  document.addEventListener('wa163nav', function () { try { paintBar(); if (PH.open) paintSheet(''); } catch (e) { /* fine */ } });
  document.addEventListener('wa153app', function () { try { paintBar(); if (PH.open) paintSheet(''); } catch (e) { /* fine */ } });
  /* the chat button can arrive after the bar (waves 75 and 117 draw it on timers) */
  var phTries = 0, phIv = setInterval(function () { phTries++; var w = false; try { paintBar(); w = watchChat(); } catch (e) { /* fine */ } if (phTries > 20 || (w && document.getElementById('waChatBtn') && G.ready)) clearInterval(phIv); }, 500);
