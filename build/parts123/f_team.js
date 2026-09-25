
  /* ---------- the Team inbox card on each department's overview page ---------- */
  function teamRoute() {
    var h = decodeURIComponent(location.hash || '').replace(/^#/, ''); var p = h.split('/');
    if (p[0] !== 'team' || !p[1] || T.order.indexOf(p[1]) < 0) return null;
    if (p[2] && p[2] !== 'overview') return null;
    return p[1];
  }
  function teamCardHtml(d) {
    var ch = chanFor(d), body;
    if (!R.loaded) body = '<p class="w116empty">Loading the inbox…</p>';
    else {
      var items = teamItems(d, 'open');
      var reqs = items.filter(function (it) { return it.k === 'r'; }), mails = items.filter(function (it) { return it.k === 'm'; }), sugs = items.filter(function (it) { return it.k === 's'; });
      var hot = reqs.filter(function (it) { return it.hot; }).length;
      body = '<div class="w123tsum"><span' + (hot ? ' class="hot"' : '') + '><b>' + reqs.length + '</b> open request' + (reqs.length === 1 ? '' : 's') + (hot ? ' (' + hot + ' urgent or late)' : '') + '</span><span><b>' + mails.length + '</b> email' + (mails.length === 1 ? '' : 's') + ' from the Hub inbox</span>' + (sugs.length ? '<span><b>' + sugs.length + '</b> spotted in meetings</span>' : '') + '</div>'
        + (items.length ? '<div class="w123rows">' + items.slice(0, 5).map(function (it) { return itemRow(it, 'card'); }).join('') + '</div>' + (items.length > 5 ? '<div class="w123more">And ' + (items.length - 5) + ' more in the <a class="w123lnk" data-w123go="#requests/team/' + d + '">team inbox</a>.</div>' : '')
          : '<p class="w116empty">Nothing waiting. Requests to ' + E(teamLabel(d)) + ', emails the Hub inbox files for the team, and asks spotted in its meetings land here.</p>');
    }
    return '<div class="w116card w123tcard" id="w123tcard" data-d="' + d + '" data-v="' + R.ver + '"><h3>Team inbox <span class="lnk" data-w123go="#requests/team/' + d + '">open the inbox</span></h3>' + body
      + '<div class="w116addrow"><a data-w123go="#requests/new/' + d + '">+ Ask ' + E(teamShort(d)) + ' for something</a>' + (ch ? '<span class="w123slkl">' + I('hash') + 'requests post to #' + E(ch) + '</span>' : '') + '</div></div>';
  }
  var cardBusy = false;
  function injectCard(force) {
    if (cardBusy) return;
    var d = teamRoute(); if (!d || !staffOk()) return;
    var hostEl = document.getElementById('w116host'); if (!hostEl) return;
    var col = hostEl.querySelector('.w116grid > .w116col'); if (!col) return;
    var cur = document.getElementById('w123tcard');
    if (cur && !force && cur.getAttribute('data-d') === d && cur.parentNode === col && col.firstElementChild === cur && cur.getAttribute('data-v') === String(R.ver)) return;
    cardBusy = true;
    try {
      if (cur) cur.remove();
      col.insertAdjacentHTML('afterbegin', teamCardHtml(d));
    } finally { cardBusy = false; }
    if (!R.loaded && !R.loading) load().then(function () { injectCard(true); });
    else if (R.loaded && now() - R.loaded > 60000 && !R.loading) load(true).then(function () { injectCard(true); });
  }
  var cardT = null;
  function watchTeam() {
    var sec = document.getElementById('team'); if (!sec || sec.__w123obs) return;
    sec.__w123obs = true;
    try { new MutationObserver(function () { if (cardBusy) return; clearTimeout(cardT); cardT = setTimeout(function () { injectCard(false); }, 40); }).observe(sec, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }

  /* ---------- the Hub inbox page: Jev's call on each filed email ---------- */
  var HM = { notify: {}, busy: false, at: 0 };
  async function hubmailChips() {
    var rows = document.querySelectorAll('#w116mailhost .w116mr[data-mid]'); if (!rows.length) return;
    if (!HM.busy && now() - HM.at > 30000) {
      HM.busy = true;
      var r = await q(db.from('hub_mail').select('id, notify').not('notify', 'is', null).order('id', { ascending: false }).limit(300));
      (r.data || []).forEach(function (x) { if (x.notify) HM.notify[String(x.id)] = x.notify; });
      HM.at = now(); HM.busy = false;
    }
    rows = document.querySelectorAll('#w116mailhost .w116mr[data-mid]');
    Array.prototype.forEach.call(rows, function (row) {
      var n = HM.notify[row.getAttribute('data-mid')]; if (!n) return;
      var f = row.querySelector('.b .f'); if (!f || f.querySelector('.w123jchip')) return;
      var t = n.decision === 'notify' ? '<span class="w123jchip" title="' + E(n.by === 'setting' ? 'Team setting' : 'Jev decided the team needed to hear about it') + '">' + I('hash') + (n.channel ? 'pinged #' + E(n.channel) : 'team pinged') + '</span>'
        : '<span class="w123jchip quiet" title="' + E(n.by === 'setting' ? 'Team setting' : 'Jev decided finding it in the team inbox was enough') + '">filed quietly</span>';
      f.insertAdjacentHTML('beforeend', t);
    });
  }
  var hmT = null;
  function watchHubmail() {
    var el = document.getElementById('hubmail'); if (!el || el.__w123obs) return;
    el.__w123obs = true;
    try { new MutationObserver(function () { clearTimeout(hmT); hmT = setTimeout(hubmailChips, 250); }).observe(el, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }
