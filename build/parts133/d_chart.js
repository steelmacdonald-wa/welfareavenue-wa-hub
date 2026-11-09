
  /* ---------- the chart ---------- */
  var MAX_KIDS = 12;
  function hostEl() {
    var sec = document.getElementById('orgchart'); if (!sec) return null;
    var h = document.getElementById('w133');
    if (!h) {
      h = document.createElement('div'); h.id = 'w133';
      var m = sec.querySelector(':scope > .w118mast');
      if (m && m.nextSibling) sec.insertBefore(h, m.nextSibling); else sec.appendChild(h);
    }
    return h;
  }
  function oldCard(on) {
    try { var b = document.getElementById('ocBody'); var c = b && b.closest('.card'); if (c) c.classList.toggle('w133old', !!on); } catch (e) { /* fine */ }
  }
  function statusChip(p) { var s = STATUS[p.status] || STATUS.open; return '<span class="w133st" style="background:' + s[1] + ';color:' + s[2] + '">' + E(s[0]) + '</span>'; }
  function online(m) { return !!(m && m.email && O.online[lower(m.email)]); }
  function cardHtml(X, p, colTeam) {
    var m = holder(p), n = (X.kids[String(p.id)] || []).length, drag = O.arrange && O.canEdit && p.kind !== 'exec';
    var tags = [];
    if (p.kind !== 'exec' && p.reports_to != null && isExec(X.byId[p.reports_to])) tags.push('<span class="w133tag">reports to ' + E(first(seatName(X.byId[p.reports_to]))) + '</span>');
    var tm = seatTeam(p);
    if (colTeam && tm && tm !== colTeam && tm !== 'board') tags.push('<span class="w133tag tm" style="background:' + E(teamColor(tm)) + '">' + E(teamShort(tm)) + '</span>');
    var attrs = ' data-w133p="' + E(p.id) + '" data-w133drop="pos:' + E(p.id) + '"' + (drag ? ' draggable="true" data-w133drag="pos:' + E(p.id) + '"' : '') + ' role="button" tabindex="0"';
    var add = O.canEdit ? '<button type="button" class="addk" data-w133addunder="' + E(p.id) + '" title="Add an empty position under ' + E(m ? first(m.name) : p.title) + '" aria-label="Add an empty position">' + I('plus') + '</button>' : '';
    if (!m) {
      return '<div class="w133c open"' + attrs + ' aria-label="Open position: ' + E(p.title) + '"><span class="oic">' + I('open') + '</span><div class="tx"><span class="kk">Open position</span><b>' + E(p.title || 'Untitled') + '</b>'
        + '<div class="tags">' + statusChip(p) + tags.join('') + '</div>' + (p.note ? '<span>' + E(clip(p.note, 90)) + '</span>' : '') + '</div>' + (n ? '<span class="cnt">' + n + '</span>' : '') + add + '</div>';
    }
    return '<div class="w133c' + (p.kind === 'exec' ? ' ex' : '') + '"' + attrs + ' data-w133m="' + E(m.id) + '" aria-label="' + E(m.name + ', ' + (p.title || m.role || '')) + '"><span class="avw">' + avatar(m, p.kind === 'exec' ? 44 : 34) + (online(m) ? '<span class="w133on" title="On the Hub now"></span>' : '') + '</span>'
      + '<div class="tx"><b>' + E(m.name) + '</b><span>' + E(p.title || m.role || 'Team member') + '</span>' + (tags.length ? '<div class="tags">' + tags.join('') + '</div>' : '') + '</div>'
      + (n ? '<span class="cnt" title="' + plural(n, 'direct report', 'direct reports') + '">' + n + '</span>' : '') + add + '</div>';
  }
  function nodeHtml(X, p, colTeam, seen, depth) {
    if (seen[p.id] || depth > 14) return ''; seen[p.id] = 1;
    var ks = kidsOf(X, p), key = String(p.id), open = !!O.expand[key] || !!O.q || O.arrange;
    /* open positions always show; a long list of people folds after twelve */
    var shown = open ? ks : ks.filter(function (k, i) { return isOpen(k) || ks.filter(function (x, j) { return j <= i && !isOpen(x); }).length <= MAX_KIDS; });
    var html = '<div class="w133node" data-n="' + E(p.id) + '">' + cardHtml(X, p, colTeam);
    if (ks.length) {
      html += '<div class="w133kids">' + shown.map(function (k) { return nodeHtml(X, k, colTeam, seen, depth + 1); }).join('')
        + (ks.length > shown.length ? '<button type="button" class="w133more" data-w133exp="' + E(key) + '">Show ' + (ks.length - shown.length) + ' more</button>' : '') + '</div>';
    }
    return html + '</div>';
  }
  function teamCol(X, d, hs) {
    var seen = {}, list = hs.filter(function (p) { return seatTeam(p) === d && (O.showOpen || !isOpen(p)); });
    var ppl = 0, open = 0;
    list.forEach(function (p) { [p].concat(allUnder(X, p)).forEach(function (s) { if (isOpen(s)) open++; else ppl++; }); });
    var head = '<h3 data-w133drop="team:' + E(d) + '">' + E(teamLabel(d)) + ' <span>' + plural(ppl, 'person', 'people') + (open ? ', ' + plural(open, 'open position', 'open positions') : '') + '</span></h3>';
    var body = list.length ? list.map(function (p) { return nodeHtml(X, p, d, seen, 0); }).join('') : '<p class="empty">No one on this team yet.</p>';
    var add = O.canEdit && O.arrange ? '<div class="addrow"><button type="button" class="w133btn" data-w133addteam="' + E(d) + '">' + I('plus') + 'Add a position to lead ' + E(teamShort(d)) + '</button></div>' : '';
    return '<div class="w133team" data-team="' + E(d) + '" style="--tc:' + E(teamColor(d)) + '">' + head + body + add + '</div>';
  }
  /* wave297b: the board row in governance order. The President of the Board leads, then the officers, then members and advisers. */
  function w297rank(m) { var r = String(m.role || '').toLowerCase(); if (r.indexOf('president') >= 0) return 0; if (/chair|treasurer|secretary|vice/.test(r)) return 1; if (r.indexOf('advis') >= 0) return 3; return 2; }
  /* wave297 (09/11/26): the tree. The board above; one column per co-executive director, their card on top and
     the teams that report to them underneath, joined by lines; HR and any lead who reports to no one sits in a
     last column, "Shared by the co-executive directors". A team chip still opens the team's own column. */
  function treeHtml(X, ex, hs) {
    var shown = function (p) { return O.showOpen || !isOpen(p); }, seen = {};
    var order = teams();
    function groups(list) {
      var by = {}, keys = [];
      list.forEach(function (p) { var t = seatTeam(p) || ''; if (!by[t]) { by[t] = []; keys.push(t); } by[t].push(p); });
      keys.sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      return keys.map(function (t) {
        var ppl = 0, open = 0;
        by[t].forEach(function (p) { [p].concat(allUnder(X, p)).forEach(function (s) { if (isOpen(s)) open++; else ppl++; }); });
        return '<div class="w297tm" data-team="' + E(t) + '" style="--tc:' + E(teamColor(t)) + '"><h4 data-w133drop="team:' + E(t) + '">' + E(teamLabel(t)) + ' <span>' + plural(ppl, 'person', 'people') + (open ? ', ' + plural(open, 'open position', 'open positions') : '') + '</span></h4>'
          + by[t].map(function (p) { return nodeHtml(X, p, t, seen, 0); }).join('') + '</div>';
      }).join('');
    }
    var cols = ex.map(function (e) {
      var under = hs.filter(function (p) { return String(p.reports_to) === String(e.id) && shown(p); });
      return '<div class="w297br"><div class="w297top">' + cardHtml(X, e, '') + '</div>'
        + (under.length ? '<div class="w297teams">' + groups(under) + '</div>' : '<p class="w297none">No team leads report here yet.</p>') + '</div>';
    });
    var shared = hs.filter(function (p) { return (p.reports_to == null || !isExec(X.byId[p.reports_to])) && shown(p); });
    if (shared.length) cols.push('<div class="w297br sh"><div class="w297top"><div class="w297shh"><b>Shared</b><span>by the co-executive directors</span></div></div><div class="w297teams">' + groups(shared) + '</div></div>');
    return '<div class="w133lv w133exec w297tree"><h3 data-w133drop="team:">Executive directors <span>each co-executive director, with the teams that report to them</span></h3><div class="w297row">' + cols.join('') + '</div></div>';
  }
  function allUnder(X, p) { var out = [], st = (X.kids[String(p.id)] || []).slice(), seen = {}; while (st.length) { var k = st.shift(); if (seen[k.id]) continue; seen[k.id] = 1; out.push(k); (X.kids[String(k.id)] || []).forEach(function (c) { st.push(c); }); } return out; }
  function barHtml(X) {
    var filled = (O.pos || []).filter(function (p) { return !isOpen(p); }).length, open = (O.pos || []).filter(isOpen).length, up = unplaced(X).length;
    var chips = '<button type="button" class="w133chip' + (!O.team ? ' on' : '') + '" data-w133team="">All teams</button>' + teams().map(function (d) { return '<button type="button" class="w133chip' + (O.team === d ? ' on' : '') + '" data-w133team="' + E(d) + '"><i style="background:' + E(teamColor(d)) + '"></i>' + E(teamShort(d)) + '</button>'; }).join('');
    return '<div class="w133bar"><div class="w133stats"><b>' + filled + '</b> people on the chart' + (open ? ' · <b>' + open + '</b> open ' + (open === 1 ? 'position' : 'positions') : '') + (up ? ' · <b>' + up + '</b> not placed yet' : '') + ' · ' + teams().length + ' teams</div>'
      + '<label class="w133q">' + I('search') + '<input type="search" id="w133q" placeholder="Find someone" value="' + E(O.q) + '" aria-label="Find someone on the chart"></label>'
      + '<label class="w133tog"><input type="checkbox" id="w133open"' + (O.showOpen ? ' checked' : '') + '> Open positions</label>'
      + (O.canEdit ? '<button type="button" class="w133btn' + (O.arrange ? ' pri' : '') + '" data-w133arr="1">' + I(O.arrange ? 'check' : 'move') + (O.arrange ? 'Done' : 'Rearrange') + '</button><button type="button" class="w133btn" data-w133addteam="">' + I('plus') + 'Add an open position</button>' : '')
      + '</div><div class="w133chips" role="group" aria-label="Teams">' + chips + '</div>'
      + (O.arrange ? '<div class="w133arr"><span class="t"><b>Rearranging.</b> Drag someone onto the person they report to, or onto a team’s name to make them one of its leads. Use + on any card to add an empty position under it. Every move can be undone.</span><button type="button" class="w133btn pri" data-w133arr="1">' + I('check') + 'Done</button></div>' : '');
  }
  function paint() {
    var h = hostEl(); if (!h) return;
    if (!O.pos) { h.innerHTML = '<div class="w133load"></div>'; return; }
    oldCard(true);
    var X = ix(), hs = heads(X), ex = execs(X), board = boardPeople(X), up = unplaced(X);
    var focus = document.activeElement && document.activeElement.id === 'w133q', caret = focus ? document.activeElement.selectionStart : null;
    var html = barHtml(X) + (O.err ? '<div class="w133err">' + E(O.err) + '</div>' : '');
    if (!O.team) {
      html += '<div class="w133lv w133board"><h3>Board of directors <span>governance, with the co-executive directors reporting to it</span>' + (tabOk('governance') ? '<a data-w133go="#governance">Board overview</a>' : '') + '</h3><div class="w133row">'
        + (board.length ? board.slice().sort(function (a, b) { return w297rank(a) - w297rank(b); }).map(function (m) { return '<button type="button" class="w133bchip' + (w297rank(m) === 0 ? ' lead' : '') + '" data-w133m="' + E(m.id) + '">' + avatar(m, 26) + '<b>' + E(m.name) + '</b><span class="r">' + E(clip(m.role || 'Board member', 40)) + '</span></button>'; }).join('') : '<p class="note">No directors on the roster.</p>') + '</div></div>'
        + '<div class="w133link"></div>'
        + treeHtml(X, ex, hs);   /* wave297: each co-executive director with the teams that report to them */
    }
    var cols = O.team ? [O.team] : [];
    if (O.team) html += '<div class="w133grid">' + cols.map(function (d) { return teamCol(X, d, hs); }).join('') + '</div>';
    var other = [];
    if (other.length) html += '<div class="w133team" style="--tc:' + GREEN + '"><h3>Other seats</h3>' + other.map(function (p) { return nodeHtml(X, p, '', {}, 0); }).join('') + '</div>';
    if (up.length && (!O.team || up.some(function (m) { return m.department === O.team; }))) {
      var list = O.team ? up.filter(function (m) { return m.department === O.team; }) : up;
      html += '<div class="w133tray"><h3>Not on the chart yet</h3><p>' + (O.canEdit ? 'On the roster but not placed. Open someone to choose who they report to' + (O.arrange ? ', or drag them onto a card.' : '.') : 'On the roster but not placed on the chart yet.') + '</p><div class="w133row">'
        + list.map(function (m) { return '<button type="button" class="w133bchip" data-w133m="' + E(m.id) + '"' + (O.arrange && O.canEdit ? ' draggable="true" data-w133drag="member:' + E(m.id) + '"' : '') + '>' + avatar(m, 26) + '<b>' + E(m.name) + '</b><span class="r">' + E(teamShort(m.department)) + '</span></button>'; }).join('') + '</div></div>';
    }
    h.innerHTML = html;
    h.classList.toggle('arr', !!O.arrange);
    applySearch();
    if (focus) { var q = document.getElementById('w133q'); if (q) { q.focus(); try { q.setSelectionRange(caret, caret); } catch (e) { /* fine */ } } }
  }
  function applySearch() {
    var h = document.getElementById('w133'); if (!h) return;
    var q = lower(O.q); h.classList.toggle('searching', !!q);
    if (!q) return;
    var first0 = null;
    h.querySelectorAll('.w133c, .w133bchip').forEach(function (el) {
      var hit = lower(el.textContent).indexOf(q) >= 0;
      el.classList.toggle('hit', hit);
      if (hit && !first0) first0 = el;
    });
    if (first0 && O.scrollHit) { O.scrollHit = false; try { first0.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* fine */ } }
  }
  O.expand = {};
