
  /* ---------- What changed: once per person, on Home ---------- */
  var KEY_SEEN = 'wa262.seen', TOUR = 'whatsnew';
  var newCss = ''
    + '#w262new{position:fixed;inset:0;z-index:99990;background:rgba(16,24,22,.5);display:flex;align-items:center;justify-content:center;padding:16px;}'
    + '#w262new .dlg{background:' + CREAM + ';border-radius:16px;max-width:680px;width:100%;max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.3);overflow:hidden;font-family:' + BODY + ';color:' + INK + ';}'
    + '#w262new .hd{background:' + GREEN + ';color:' + CREAM + ';padding:18px 22px 16px;position:relative;}'
    + '#w262new .hd small{display:block;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:' + GOLD + ';margin-bottom:4px;}'
    + '#w262new .hd h2{color:' + CREAM + ' !important;}'
    + '#w262new h2{margin:0;font-family:' + HEAD + ';font-weight:600;font-size:30px;letter-spacing:.3px;line-height:1.05;}'
    + '#w262new .hd p{margin:8px 0 0;font-size:13.5px;line-height:1.45;color:rgba(255,250,242,.9);max-width:560px;}'
    + '#w262new .x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,250,242,.12);color:' + CREAM + ';font-size:20px;line-height:1;cursor:pointer;}'
    + '#w262new .x:hover{background:rgba(255,250,242,.22);}'
    + '#w262new .bd{overflow-y:auto;padding:14px 22px 6px;}'
    + '#w262new .it{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(16,63,57,.10);}'
    + '#w262new .it:last-child{border-bottom:none;}'
    + '#w262new .n{flex:0 0 26px;height:26px;border-radius:50%;background:rgba(220,165,39,.22);color:#6b4d05;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;margin-top:1px;}'
    + '#w262new h3{margin:0 0 3px;font-size:14.5px;color:' + GREEN + ';}'
    + '#w262new .it p{margin:0;font-size:13px;line-height:1.5;color:#3b3c38;}'
    + '#w262new .apps{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}'
    + '#w262new .app{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(16,63,57,.18);background:' + CREAM + ';border-radius:12px;padding:6px 12px 6px 6px;font:inherit;font-size:13px;font-weight:600;color:' + INK + ';cursor:pointer;}'
    + '#w262new .app:hover{border-color:' + GREEN + ';}'
    + '#w262new .app:focus-visible,#w262new button:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
    + '#w262new .app .ai{width:26px;height:26px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:' + CREAM + ';}'
    + '#w262new .app .ai svg{width:15px;height:15px;}'
    + '#w262new .app.more{background:transparent;font-weight:500;}'
    + '#w262new .sub{font-size:12px;color:' + MUTED + ';margin:8px 0 0;}'
    + '#w262new .ft{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 22px 16px;border-top:1px solid rgba(16,63,57,.10);}'
    + '#w262new .go{background:' + GOLD + ';color:' + INK + ';border:0;border-radius:10px;padding:10px 18px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;}'
    + '#w262new .ok{background:none;border:1px solid rgba(16,63,57,.25);color:' + GREEN + ';border-radius:10px;padding:9px 16px;font:inherit;font-weight:600;font-size:13.5px;cursor:pointer;}'
    + '#w262new .ft small{margin-left:auto;font-size:12px;color:' + MUTED + ';}'
    + '@media (max-width:640px){#w262new{padding:0;align-items:stretch;}#w262new .dlg{max-height:100vh;border-radius:0;}#w262new .ft small{margin-left:0;flex-basis:100%;}}';
  var N = { shown: false, tries: 0, timer: null };

  function w122ok() { return !!(window.w122 && window.w122.tours); }
  function tourRow() { try { return window.w122.A.byKey['tour:' + TOUR] || null; } catch (e) { return null; } }
  function tourDone() { try { var t = tourRow(); return !!t && window.w122.isDone(t.id); } catch (e) { return false; } }
  function seen() { return readLS(KEY_SEEN) === '1' || tourDone(); }
  function onHome() { var h = String(location.hash || ''); return !h || h === '#' || /^#mypage(\/|$)/.test(h); }
  function phone() { return window.innerWidth <= 900; }
  function vis(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none'; }
  /* never on top of another window: the Loop's Welcome back, the meeting pop-up, the due-date check, a modal, a running tour */
  function busy() {
    if (document.getElementById('w213pop') || vis(document.getElementById('w238loop')) || vis(document.getElementById('w177pop'))) return true;
    var m = document.getElementById('modalBack'); if (m && m.style.display === 'flex') return true;
    if (document.querySelector('.w122tp') || document.getElementById('w122sheet') && vis(document.getElementById('w122sheet'))) return true;
    return false;
  }
  function apps() {
    var A = window.WA_APP; if (!A || typeof A.yours !== 'function') return { yours: [], more: [], all: true };
    try { return A.yours(); } catch (e) { return { yours: [], more: [], all: true }; }
  }
  function appBtn(id, more) {
    var A = window.WA_APP, a = A && A.apps && A.apps[id]; if (!a) return '';
    return '<button type="button" class="app' + (more ? ' more' : '') + '" data-w262app="' + E(id) + '" title="' + E(a.blurb || '') + '"><span class="ai" style="background:' + E(a.color) + '">' + (A.icon ? A.icon(a.ic) : '') + '</span>' + E(a.label) + '</button>';
  }
  function moreLabels() {
    var out = [];
    ['tools', 'org'].forEach(function (k) {
      var g = document.querySelector('#tabBar > .tab-group[data-w42g="' + k + '"]'); if (!g) return;
      Array.prototype.forEach.call(g.querySelectorAll('.tab'), function (t) {
        if (t.style.display === 'none' || t.getAttribute('data-w73hide')) return;
        var l = ''; t.childNodes.forEach(function (n) { if (n.nodeType === 3 || (n.nodeType === 1 && !n.classList.contains('tabdot') && !n.classList.contains('w134n'))) l += n.textContent; });
        l = l.replace(/\s+/g, ' ').trim(); if (l) out.push(l);
      });
    });
    return out;
  }
  function listWords(a) { return a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : (a[0] || ''); }
  function otherCount() {
    return Array.prototype.filter.call(document.querySelectorAll('#tabBar .w42d.w262other'), function (row) {
      return row.style.display !== 'none' && Array.prototype.some.call(row.querySelectorAll('.tab'), function (t) { return t.style.display !== 'none'; });
    }).length;
  }
  function summary() {
    var f = (window.w134 && window.w134.folds) ? window.w134.folds() : null;
    var mine = f && f.mine ? teamLabel(f.mine) : '', others = otherCount(), more = moreLabels(), ap = apps();
    return { mine: mine, others: others, more: more, apps: ap };
  }
  function html() {
    var s = summary(), n = first(), items = [];
    var menu = 'Home, Team Requests, the Calendar and the Avenue Academy stay at the top. '
      + (s.mine ? 'Your team, ' + s.mine + ', sits open under Teams with its own pages. ' : '')
      + (s.others ? 'The other ' + (s.others === 1 ? 'team is' : s.others + ' teams are') + ' folded under Other teams, one click away. ' : '')
      + (s.more.length ? listWords(s.more) + ' are under More.' : '');
    if (phone()) menu = 'On a phone, the bar at the bottom has Home, the Calendar, Ask, My team and Menu. Menu lists every page you can open, with Find a page at the top.';
    items.push(['Your menu is shorter', menu]);
    items.push(['Home shows what matters first', 'Your counts, what needs you, your tasks and your team’s requests come first, then your meetings and the announcements. In the loop, updates, time off and the rest wait behind Show everything on Home, at the bottom.']);
    var ap = s.apps, appsHtml = '';
    if (ap.yours.length || ap.more.length) {
      appsHtml = '<div class="apps">' + ap.yours.map(function (id) { return appBtn(id, false); }).join('') + '</div>'
        + (ap.more.length ? '<p class="sub">More apps you can open:</p><div class="apps">' + ap.more.map(function (id) { return appBtn(id, true); }).join('') + '</div>' : '');
      items.push([ap.all ? 'The apps you can open' : 'Your apps come first', (ap.all ? 'Every app is yours. ' : (phone() ? 'The apps your team uses come first in Menu; the others follow. ' : 'The apps your team uses sit at the top of Apps (bottom of the menu); the others follow under More apps. ')) + 'Click one to open it now.', appsHtml]);
    }
    items.push(['Ask the Hub finds pages for you', 'Ask where something is (where are the passwords? where do I find grants?) and the answer shows the page with Open. If your access does not open it yet, Request access sends the ask to the admins.']);
    items.push(['Clearing your tasks works for long lists', 'When tasks are overdue, due today or have no date, the Hub asks you to close them or pick a new date. Long sections now have All in this section: Done or Next meeting, and saving a big list no longer fails.']);
    return '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="w262h">'
      + '<div class="hd"><small>What changed in the Hub</small><h2 id="w262h">' + E(n ? n + ', the Hub got simpler' : 'The Hub got simpler') + '</h2>'
      + '<p>After Monday’s leadership meeting we trimmed what you see first. Nothing was taken away: a few things moved one click further.</p>'
      + '<button type="button" class="x" data-w262x="1" aria-label="Close">&times;</button></div>'
      + '<div class="bd">' + items.map(function (it, i) { return '<div class="it"><span class="n">' + (i + 1) + '</span><div><h3>' + E(it[0]) + '</h3><p>' + E(it[1]) + '</p>' + (it[2] || '') + '</div></div>'; }).join('') + '</div>'
      + '<div class="ft"><button type="button" class="go" data-w262tour="1">Take the 1-minute tour</button><button type="button" class="ok" data-w262ok="1">Got it</button>'
      + '<small>The tour stays in the Avenue Academy under Hub page tours.</small></div></div>';
  }
  function closeNew() {
    var el = document.getElementById('w262new'); if (el) el.remove();
    writeLS(KEY_SEEN, '1');
    document.removeEventListener('keydown', escNew, true);
  }
  function escNew(e) { if (e.key === 'Escape' && document.getElementById('w262new')) { e.stopPropagation(); closeNew(); } }
  function showNew() {
    if (document.getElementById('w262new')) return;
    var el = document.createElement('div'); el.id = 'w262new'; el.innerHTML = html();
    el.addEventListener('click', function (e) {
      var t = e.target, b;
      if (t === el || t.closest('[data-w262x]') || t.closest('[data-w262ok]')) { closeNew(); return; }
      if (t.closest('[data-w262tour]')) { closeNew(); startTour(); return; }
      if ((b = t.closest('[data-w262app]'))) {
        closeNew();
        var id = b.getAttribute('data-w262app');
        try { if (window.WA_APP && window.WA_APP.open) window.WA_APP.open(id); } catch (x) { /* fine */ }
      }
    });
    document.body.appendChild(el);
    document.addEventListener('keydown', escNew, true);
    N.shown = true;
    try { var g = el.querySelector('[data-w262tour]'); if (g) g.focus(); } catch (e) { /* fine */ }
  }
  function startTour() {
    if (!w122ok()) return;
    if (!onHome()) location.hash = '#mypage';
    try { window.w122.startTour(TOUR); } catch (e) { toastS('The tour is in the Avenue Academy, under Hub page tours.'); }
  }
  /* wait for Home, the person's data and the must-answer pop-ups; give up quietly after a while */
  function tryNew() {
    clearTimeout(N.timer);
    if (N.shown || !staff()) return;
    try { if (typeof MODE !== 'undefined' && MODE === 'board') return; } catch (e) { return; }
    if (seen()) return;
    if (N.tries++ > 180) return;
    var ready = w122ok() && window.w122.A && window.w122.A.loaded;
    if (!onHome() || busy() || (!ready && N.tries < 20)) { N.timer = setTimeout(tryNew, 1500); return; }
    if (seen()) return;
    showNew();
  }

  /* ---------- the tour ---------- */
  function tourSteps() {
    var s = summary(), ap = s.apps;
    var appLine = ap.all ? 'Every app you can open is here: the Hub, ' + listWords(ap.yours.map(function (id) { return (window.WA_APP.apps[id] || {}).label; }).filter(Boolean)) + '.'
      : 'Apps opens your team’s apps first' + (ap.yours.length ? ' (' + listWords(ap.yours.map(function (id) { return (window.WA_APP.apps[id] || {}).label; }).filter(Boolean)) + ')' : '') + ', then More apps' + (ap.more.length ? ' (' + listWords(ap.more.map(function (id) { return (window.WA_APP.apps[id] || {}).label; }).filter(Boolean)) + ')' : '') + '.';
    var all = [
      { c: 1, t: 'What changed', p: 'A one-minute look at what moved for you. Nothing was taken away: a few things are one click further. Use the arrow keys or the buttons, and Esc to stop.' },
      { s: '#tabBar > .tab[data-tab="mypage"]', t: 'Home', p: 'Home leads with what matters to you: your counts, what needs you, your tasks and your team’s requests, then your meetings and the announcements.', opt: 1 },
      { s: '#w163bar', t: 'Your menu on a phone', p: 'Home, the Calendar, Ask, My team and Menu. Menu lists every page you can open, with your apps and Find a page at the top.', opt: 1 },
      { s: '#tabBar .w42d[data-w262mine]', t: 'Your team', p: (s.mine || 'Your team') + ' sits open under Teams with its own pages: Overview, Agenda, Tasks and the tools your team uses.', opt: 1 },
      { s: '#tabBar .w262tt', t: 'Other teams', p: 'Every other team is folded here. Open it when you need another team’s page; the Hub remembers your choice on this computer.', opt: 1 },
      { s: '#tabBar .w262fold', t: 'More', p: (s.more.length ? listWords(s.more) : 'The Brain and the other tools') + ' live under More. It opens with a click, and by itself when you are on one of those pages.', opt: 1 },
      { s: '#w153dock .w153grid', t: 'Your apps', p: appLine, opt: 1 },
      { s: '#searchWrap', t: 'Search everything', p: 'Looking for something you cannot see in the menu? Type a page, a task, a person or a meeting here and jump straight to it.', opt: 1 },
      { s: '#w262homebar', t: 'Show everything on Home', p: 'In the loop, Updates for you, time commitments, Slack notifications and time off wait here. One click shows them, another hides them again.', opt: 1 },
      { c: 1, t: 'You are set', p: 'Every page still has its own tour in the Avenue Academy, and Ask the Hub (bottom right) can find anything for you.' }
    ];
    /* on a phone the side menu is closed: the bar at the bottom and its Menu sheet do that job */
    var deskOnly = ['#tabBar > .tab[data-tab="mypage"]', '#tabBar .w42d[data-w262mine]', '#tabBar .w262tt', '#tabBar .w262fold', '#w153dock .w153grid'];
    return phone() ? all.filter(function (st) { return deskOnly.indexOf(st.s) < 0; }) : all.filter(function (st) { return st.s !== '#w163bar'; });
  }
  function registerTour() {
    if (!w122ok() || window.w122.tours[TOUR]) return;
    window.w122.tours[TOUR] = { tab: 'mypage', icon: 'compass', hash: '#mypage', steps: tourSteps };
  }
