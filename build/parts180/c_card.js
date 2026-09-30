  /* ---------- the totals (bars) ---------- */
  function barsHtml(qr, mineVal) {
    var opts = qr.options || [], total = opts.reduce(function (s, o) { return s + (Number(o.count) || 0); }, 0), mineIdx = [];
    if (Array.isArray(mineVal)) mineIdx = mineVal.map(Number); else if (typeof mineVal === 'number') mineIdx = [mineVal]; else if (mineVal === true) mineIdx = [0]; else if (mineVal === false) mineIdx = [1];
    return '<div class="w180bars">' + opts.map(function (o, i) {
      var n = Number(o.count) || 0, pc = total ? Math.round(100 * n / total) : 0;
      return '<div class="w180bar' + (mineIdx.indexOf(i) >= 0 ? ' me' : '') + '"><div class="l"><span>' + E(o.label) + (mineIdx.indexOf(i) >= 0 ? ' <span class="w180chip gold">you</span>' : '') + '</span><b>' + n + (total ? ' · ' + pc + '%' : '') + '</b></div><div class="t"><i style="width:' + pc + '%"></i></div>'
        + (Array.isArray(o.names) && o.names.length ? '<div class="n w180names">' + E(o.names.join(', ')) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function choiceLabels(a, idx) { var o = (a.ask && a.ask.options) || []; return (Array.isArray(idx) ? idx : [idx]).map(function (i) { return o[i]; }).filter(Boolean).join(', '); }

  /* ---------- a poll, answered with a tap ---------- */
  function pollHtml(a) {
    var ask = a.ask, m = S.mine[a.id], cl = closed(a), res = S.res[a.id], sel = S.sel[a.id], multi = !!ask.multi;
    var editing = !!(sel && sel.edit), canVote = openAsk(a) && forMe(a) && (!m || editing);
    var h = '<div class="w180q">' + E(ask.question) + (multi ? ' <span class="w180chip">pick any</span>' : '') + '</div>';
    if (canVote) {
      var picks = (sel && sel.picks) || (m && m.choice) || [];
      h += '<div class="w180opts" role="group" aria-label="' + E(ask.question) + '">' + ask.options.map(function (o, i) {
        var on = picks.indexOf(i) >= 0;
        return '<button type="button" class="w180opt' + (on ? ' on' : '') + '" data-w180vote="' + E(a.id) + '" data-i="' + i + '" aria-pressed="' + on + '"' + (S.busy['v' + a.id] ? ' disabled' : '') + '>' + E(o) + '</button>';
      }).join('') + '</div>';
      if (multi || editing) h += '<div class="w180acts">' + (multi ? '<button type="button" class="w180btn sm" data-w180send="' + E(a.id) + '"' + (!picks.length || S.busy['v' + a.id] ? ' disabled' : '') + '>' + (S.busy['v' + a.id] ? 'Sending…' : 'Send my answer') + '</button>' : '')
        + (editing ? '<button type="button" class="w180lnk" data-w180keep="' + E(a.id) + '">Keep my answer</button>' : '') + '</div>';
      return h;
    }
    if (res && res.visible && res.questions && res.questions[0]) h += barsHtml(res.questions[0], m && m.choice);
    if (m) h += '<div class="w180done">✓ You chose ' + E(choiceLabels(a, m.choice)) + (openAsk(a) ? ' · <button type="button" class="w180lnk" data-w180change="' + E(a.id) + '">Change my answer</button>' : '') + '</div>';
    else if (cl) h += '<div class="w180done" style="color:' + MUTED + '">Closed ' + E(dayLabel(a.closes_at)) + '</div>';
    if (m && !(res && res.visible) && !a.show_results && !manages(a)) h += '<div class="w180names" style="font-size:12px;color:' + MUTED + ';margin-top:4px">' + E(first(a.created_name || nameFor(a.created_by))) + ' keeps the totals for now.</div>';
    return h;
  }
  /* ---------- a short form: answered in a window ---------- */
  function formStub(a) {
    var qs = (a.ask && a.ask.questions) || [], m = S.mine[a.id], res = S.res[a.id];
    var h = '';
    if (openAsk(a) && forMe(a) && !m) h += '<div class="w180acts"><button type="button" class="w180btn gold" data-w180form="' + E(a.id) + '">Answer (' + plural(qs.length, 'question') + ')</button></div>';
    else if (m) h += '<div class="w180done">✓ You answered' + (openAsk(a) ? ' · <button type="button" class="w180lnk" data-w180form="' + E(a.id) + '">Change my answers</button>' : '') + (a.show_results && !manages(a) ? ' · <button type="button" class="w180lnk" data-w180res="' + E(a.id) + '">See the totals</button>' : '') + '</div>';
    else if (closed(a)) h += '<div class="w180done" style="color:' + MUTED + '">Closed ' + E(dayLabel(a.closes_at)) + (a.show_results && !manages(a) ? ' · <button type="button" class="w180lnk" data-w180res="' + E(a.id) + '">See the totals</button>' : '') + '</div>';
    return h;
  }

  /* ---------- one announcement ---------- */
  function itemHtml(a) {
    var ask = a.ask || null, res = S.res[a.id], who = a.created_name || nameFor(a.created_by), chips = [];
    chips.push('<span class="w180chip purple">' + E(audienceLabel(a)) + '</span>');
    if (ask) chips.push('<span class="w180chip gold">' + (ask.type === 'poll' ? 'Poll' : 'Short form') + (a.anonymous ? ', anonymous' : '') + '</span>');
    if (ask && closed(a)) chips.push('<span class="w180chip">Closed</span>'); else if (ask && a.closes_at) chips.push('<span class="w180chip">Closes ' + E(dayLabel(a.closes_at)) + '</span>');
    if (a.pinned) chips.push('<span class="w180chip teal">Pinned</span>');
    var h = '<article class="w180it' + (a.pinned ? ' pin' : '') + '" data-w180id="' + E(a.id) + '">'
      + '<div class="top"><span class="who"><span class="w180av" aria-hidden="true">' + E(initials(who)) + '</span><b>' + E(who) + '</b></span><span>' + E(ago(a.created_at)) + '</span>' + chips.join('') + '</div>'
      + '<h4>' + E(a.title) + '</h4>' + (a.body ? '<p class="body">' + E(a.body) + '</p>' : '')
      + (a.link ? '<p style="margin:0 0 6px"><a class="w180lnk" href="' + E(a.link) + '"' + (/^https?:/i.test(a.link) ? ' target="_blank" rel="noopener"' : '') + '>Open the link</a></p>' : '');
    if (ask && ask.type === 'poll') h += pollHtml(a); else if (ask) h += formStub(a);
    if (ask && manages(a)) h += '<div class="w180acts"><button type="button" class="w180lnk" data-w180res="' + E(a.id) + '">See the answers' + (res && res.manage ? ' (' + res.answered + (res.audience ? ' of ' + res.audience : '') + ')' : '') + '</button></div>';
    if (S.errs[a.id]) h += '<p class="w180err">' + E(S.errs[a.id]) + '</p>';
    return h + '</article>';
  }

  /* ---------- Home: the card ---------- */
  function homeList() {
    return (S.list || []).filter(function (a) { return live(a) && forMe(a); }).sort(function (x, y) {
      var p = (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0); if (p) return p;
      var w = (waiting(y) ? 1 : 0) - (waiting(x) ? 1 : 0); if (w) return w;
      return new Date(y.created_at) - new Date(x.created_at);
    });
  }
  /* what waits on an answer; one answered just now keeps its place until the page reloads (the totals show where it was) */
  function waiting(a) { return (openAsk(a) && !answered(a)) || !!S.just[a.id]; }
  function toAnswer() { return homeList().filter(function (a) { return openAsk(a) && !answered(a); }); }
  function allList() { return (S.list || []).filter(function (a) { return manages(a) || (forMe(a) && live(a)); }).sort(function (x, y) { return new Date(y.created_at) - new Date(x.created_at); }); }
  function cardHtml() {
    var list = homeList(), n = toAnswer().length, cp = canPost();
    if (!list.length && !cp) return '';
    var shown = list.slice(0, 3), all = allList().length;
    var h = '<div class="w180hd"><h3>Announcements</h3>' + (n ? '<span class="w180cnt">' + n + ' to answer</span>' : '') + '<span class="sp"></span>'
      + (cp ? '<button type="button" class="w180btn sm" data-w180post>Post an announcement</button>' : '') + '</div>';
    if (!list.length) return h + '<div class="w180empty"><span>Nothing posted for you right now. What you post shows here for the people it is for, with one Slack post and an email.</span>' + (all ? '<button type="button" class="w180lnk" data-w180all>See all announcements (' + all + ')</button>' : '') + '</div>';
    h += shown.map(itemHtml).join('');
    if (all > shown.length) h += '<p class="w180more"><button type="button" class="w180lnk" data-w180all>See all announcements (' + all + ')</button></p>';
    return h;
  }
  function paintCard() {
    var body = document.getElementById('mpBody'), el = document.getElementById('w180card');
    var html = S.list ? cardHtml() : '';
    if (!body || !html) { if (el) el.remove(); return; }
    /* at the top of Home: right after the line of who is online (before the getting-started list and the other cards) */
    var a = body.querySelector(':scope > .mp-online') || body.querySelector(':scope > .mp-chips') || body.querySelector(':scope > .mp-head');
    if (!el) { el = document.createElement('div'); el.id = 'w180card'; el.className = 'mp-sec'; }
    if (a) { if (a.nextSibling !== el) body.insertBefore(el, a.nextSibling); } else if (el.parentNode !== body) body.insertBefore(el, body.firstChild);
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
    warm();
    /* who may post and manage comes with the person's access (WA40_MINE), which can arrive after Home first draws */
    if ((typeof WA40_MINE === 'undefined' || !WA40_MINE) && !S.waitMine) {
      S.waitMine = 1; var n = 0, tm = setInterval(function () { n++; if ((typeof WA40_MINE !== 'undefined' && WA40_MINE) || n > 50) { clearInterval(tm); S.waitMine = 0; paintCard(); } }, 400);
    }
  }
  /* the totals for the polls on the card (answered, closed, or the poster's), loaded once */
  function warm() {
    homeList().slice(0, 3).forEach(function (a) {
      if (!a.ask || S.res[a.id] || S.busy['r' + a.id]) return;
      if (!(manages(a) || ((answered(a) || closed(a)) && a.show_results && a.ask.type === 'poll'))) return;
      S.busy['r' + a.id] = 1;
      results(a.id).then(function (v) { S.busy['r' + a.id] = 0; if (!v || !v.ok) S.res[a.id] = { ok: false, failed: true, __at: Date.now() }; paintCard(); },
        function () { S.busy['r' + a.id] = 0; S.res[a.id] = { ok: false, failed: true, __at: Date.now() }; });
    });
  }
  function refreshCard(force) { return load(force).then(function () { paintCard(); }, function () { /* offline */ }); }

