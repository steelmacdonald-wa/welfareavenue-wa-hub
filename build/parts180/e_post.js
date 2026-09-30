  /* ---------- posting: who it is for, the poll or the short form, and the one Slack post ---------- */
  function newDraft() {
    var own = postTeams(), lead = !isAdmin() && !isHr();
    return { title: '', body: '', link: '', audience: lead && own.length ? 'teams' : 'everyone', teams: lead && own.length ? [own[0]] : [], ask: 'none',
      poll: { question: '', options: ['', ''], multi: false }, form: { questions: [{ id: 'q1', label: '', type: 'short', required: true, options: '' }] },
      anonymous: false, show_results: true, closes: '', pinned: false, expires: '', slack: true };
  }
  function slackWhere(d) {
    if (d.audience === 'everyone') return '#general';
    if (d.audience === 'leaders') return '#leaders';
    return d.teams.length ? (d.teams.length === 1 ? 'the ' + teamName(d.teams[0]) + ' channel' : 'each team’s channel') : 'the team’s channel';
  }
  function editorHtml(d) {
    if (d.ask === 'poll') {
      return '<div class="w180ed"><label class="l" for="w180pq">The question<span class="req" aria-hidden="true">*</span></label><input type="text" id="w180pq" maxlength="300" placeholder="Which start time works for you?" value="' + E(d.poll.question) + '">'
        + '<label class="l">The choices<span class="op">2 to 8</span></label>' + d.poll.options.map(function (o, i) {
          return '<div class="w180oped"><input type="text" data-w180popt="' + i + '" maxlength="120" placeholder="Choice ' + (i + 1) + '" value="' + E(o) + '" aria-label="Choice ' + (i + 1) + '">' + (d.poll.options.length > 2 ? '<button type="button" class="w180x" data-w180delopt="' + i + '" aria-label="Remove choice ' + (i + 1) + '">&times;</button>' : '') + '</div>';
        }).join('')
        + (d.poll.options.length < 8 ? '<button type="button" class="w180lnk" data-w180addopt>Add a choice</button>' : '')
        + '<label class="w180ck"><input type="checkbox" id="w180pm"' + (d.poll.multi ? ' checked' : '') + '> People can pick more than one</label></div>';
    }
    if (d.ask === 'form') {
      return '<div class="w180ed">' + d.form.questions.map(function (qq, i) {
        var choice = qq.type === 'one' || qq.type === 'several';
        return '<div class="w180qed"><div class="h"><input type="text" data-w180ql="' + i + '" maxlength="300" placeholder="Question ' + (i + 1) + '" value="' + E(qq.label) + '" aria-label="Question ' + (i + 1) + '">'
          + '<select data-w180qt="' + i + '" aria-label="Kind of answer">' + QTYPES.map(function (t) { return '<option value="' + t[0] + '"' + (qq.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>'
          + (d.form.questions.length > 1 ? '<button type="button" class="w180x" data-w180delq="' + i + '" aria-label="Remove question ' + (i + 1) + '">&times;</button>' : '') + '</div>'
          + (choice ? '<textarea data-w180qo="' + i + '" rows="3" placeholder="The choices, one per line (2 to 10)" aria-label="The choices for question ' + (i + 1) + '" style="margin-top:6px">' + E(qq.options) + '</textarea>' : '')
          + '<label class="w180ck"><input type="checkbox" data-w180qr="' + i + '"' + (qq.required ? ' checked' : '') + '> Everyone must answer this one</label></div>';
      }).join('') + (d.form.questions.length < 8 ? '<button type="button" class="w180lnk" data-w180addq>Add a question</button>' : '') + '</div>';
    }
    return '';
  }
  function postHtml(d) {
    var own = postTeams(), lead = !isAdmin() && !isHr();
    var aud = [['everyone', 'Everyone'], ['leaders', 'The leaders'], ['teams', lead ? 'My team' + (own.length > 1 ? 's' : '') : 'Some teams']];
    var h = '<h3>Post an announcement</h3><p class="sub">It shows at the top of Home for the people it is for' + (d.slack ? ', and goes once to Slack' : '') + '. You can add a poll or a short form they answer right there.</p>'
      + '<form class="w180f" data-w180postform novalidate>'
      + '<label class="l" for="w180pt">Headline<span class="req" aria-hidden="true">*</span></label><input type="text" id="w180pt" maxlength="200" placeholder="The gala moves to November 21" value="' + E(d.title) + '">'
      + '<label class="l" for="w180pb">Detail<span class="op">optional</span></label><textarea id="w180pb" maxlength="2000" rows="3" placeholder="A line or two of context.">' + E(d.body) + '</textarea>'
      + '<label class="l">Who it is for</label><div class="w180seg" role="group" aria-label="Who it is for">' + aud.map(function (x) {
        var off = x[0] === 'teams' && !own.length;
        return '<button type="button" data-w180aud="' + x[0] + '"' + (d.audience === x[0] ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + (off ? ' disabled' : '') + '>' + E(x[1]) + '</button>';
      }).join('') + '</div>'
      + (d.audience === 'teams' ? '<div class="w180seg" role="group" aria-label="The teams" style="margin-top:8px">' + own.map(function (t) {
        var on = d.teams.indexOf(t) >= 0;
        return '<button type="button" data-w180team="' + t + '"' + (on ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + E(teamName(t)) + '</button>';
      }).join('') + '</div>' : '')
      + '<label class="l">What should they answer?</label><div class="w180seg" role="group" aria-label="What should they answer">' + [['none', 'Nothing, it is news'], ['poll', 'A poll'], ['form', 'A short form']].map(function (x) {
        return '<button type="button" data-w180askt="' + x[0] + '"' + (d.ask === x[0] ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + E(x[1]) + '</button>';
      }).join('') + '</div>'
      + editorHtml(d)
      + (d.ask !== 'none' ? '<div class="w180row"><div><label class="l" for="w180pc">Answers close on<span class="op">optional</span></label><input type="date" id="w180pc" min="' + todayIso() + '" value="' + E(d.closes) + '"></div><div></div></div>'
        + '<label class="w180ck"><input type="checkbox" id="w180pa"' + (d.anonymous ? ' checked' : '') + '> Anonymous: you see the totals, not who answered what</label>'
        + '<label class="w180ck"><input type="checkbox" id="w180pr"' + (d.show_results ? ' checked' : '') + '> Show people the totals once they answer</label>' : '')
      + '<label class="l" for="w180pl">A link<span class="op">optional</span></label><input type="text" id="w180pl" maxlength="500" placeholder="#team/fundraising or https://…" value="' + E(d.link) + '">'
      + '<div class="w180row"><div><label class="l" for="w180pe">Comes down on<span class="op">optional</span></label><input type="date" id="w180pe" min="' + plusDays(1) + '" value="' + E(d.expires) + '"></div>'
      + '<div><label class="l">&nbsp;</label><label class="w180ck" style="margin-top:6px"><input type="checkbox" id="w180pp"' + (d.pinned ? ' checked' : '') + '> Pin it to the top of Home</label></div></div>'
      + '<label class="w180ck"><input type="checkbox" id="w180ps"' + (d.slack ? ' checked' : '') + '> Post it once in Slack too, in ' + E(slackWhere(d)) + '</label>'
      + '<p class="w180err" data-w180perr hidden></p>'
      + '<div class="w180foot"><button type="button" class="w180btn ghost sm" data-w180close>Cancel</button><button type="submit" class="w180btn"' + (S.busy.post ? ' disabled' : '') + '>' + (S.busy.post ? 'Posting…' : 'Post it') + '</button></div></form>';
    return h;
  }
  function openPost() {
    if (!canPost()) { T('Leaders, HR and admins post announcements'); return; }
    S.draft = S.draft || newDraft();
    openWin(postHtml(S.draft), false);
    setTimeout(function () { var t = document.getElementById('w180pt'); if (t) { try { t.focus(); } catch (e) { /* fine */ } } }, 30);
  }
  function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function ck(id) { var el = document.getElementById(id); return !!(el && el.checked); }
  /* what is typed goes into the draft before anything redraws the form */
  function syncDraft() {
    var d = S.draft; if (!d || !document.querySelector('#modalBox [data-w180postform]')) return d;
    d.title = v('w180pt'); d.body = v('w180pb'); d.link = v('w180pl'); d.expires = v('w180pe'); d.pinned = ck('w180pp'); d.slack = ck('w180ps');
    if (document.getElementById('w180pc')) { d.closes = v('w180pc'); d.anonymous = ck('w180pa'); d.show_results = ck('w180pr'); }
    if (d.ask === 'poll' && document.getElementById('w180pq')) {
      d.poll.question = v('w180pq'); d.poll.multi = ck('w180pm');
      Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-w180popt]'), function (el) { d.poll.options[Number(el.getAttribute('data-w180popt'))] = el.value; });
    }
    if (d.ask === 'form') {
      Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-w180ql]'), function (el) { var i = Number(el.getAttribute('data-w180ql')); if (d.form.questions[i]) d.form.questions[i].label = el.value; });
      Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-w180qo]'), function (el) { var i = Number(el.getAttribute('data-w180qo')); if (d.form.questions[i]) d.form.questions[i].options = el.value; });
      Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-w180qr]'), function (el) { var i = Number(el.getAttribute('data-w180qr')); if (d.form.questions[i]) d.form.questions[i].required = el.checked; });
    }
    return d;
  }
  function redrawPost(focusSel) {
    var box = document.querySelector('#modalBox .w180m'); if (!box) return;
    var y = document.getElementById('modalBox') ? document.getElementById('modalBox').scrollTop : 0;
    box.innerHTML = postHtml(S.draft);
    try { document.getElementById('modalBox').scrollTop = y; } catch (e) { /* fine */ }
    if (focusSel) { var f = document.querySelector('#modalBox ' + focusSel); if (f) { try { f.focus(); } catch (e) { /* fine */ } } }
  }
  /* end of that day in Toronto (EDT or EST), for "Answers close on" */
  function endOfDay(day) {
    var off = '-04:00';
    try {
      var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', timeZoneName: 'shortOffset' }).formatToParts(new Date(day + 'T16:00:00Z')).filter(function (x) { return x.type === 'timeZoneName'; })[0];
      var m = p && /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(p.value); if (m) off = m[1] + ('0' + m[2]).slice(-2) + ':' + (m[3] || '00');
    } catch (e) { /* fine */ }
    return new Date(day + 'T23:59:00' + off).toISOString();
  }
  function buildRow(d) {
    var title = String(d.title || '').trim(), body = String(d.body || '').trim(), link = String(d.link || '').trim();
    if (!title) return { err: 'Give it a headline.' };
    if (d.audience === 'teams' && !d.teams.length) return { err: 'Pick the team it is for.' };
    if (link && !/^(#|https?:\/\/)/i.test(link)) return { err: 'A link starts with # (a Hub page) or https://.' };
    var ask = null;
    if (d.ask === 'poll') {
      var opts = d.poll.options.map(function (o) { return String(o || '').trim(); }).filter(Boolean);
      if (!String(d.poll.question || '').trim()) return { err: 'Write the poll’s question.' };
      if (opts.length < 2) return { err: 'A poll needs at least two choices.' };
      if (opts.some(function (o, i) { return opts.indexOf(o) !== i; })) return { err: 'Two choices are the same.' };
      ask = { type: 'poll', question: String(d.poll.question).trim(), options: opts, multi: !!d.poll.multi };
    } else if (d.ask === 'form') {
      var qs = [], bad = null;
      d.form.questions.forEach(function (qq, i) {
        if (bad) return;
        var label = String(qq.label || '').trim(); if (!label) { bad = 'Write question ' + (i + 1) + '.'; return; }
        var x = { id: 'q' + (i + 1), label: label, type: qq.type, required: !!qq.required };
        if (qq.type === 'one' || qq.type === 'several') {
          var o = String(qq.options || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
          if (o.length < 2 || o.length > 10) { bad = 'Question ' + (i + 1) + ' needs 2 to 10 choices, one per line.'; return; }
          x.options = o;
        }
        qs.push(x);
      });
      if (bad) return { err: bad };
      ask = { type: 'form', questions: qs };
    }
    if (d.closes && d.closes < todayIso()) return { err: 'Answers cannot close in the past.' };
    if (d.expires && d.expires <= todayIso()) return { err: 'It can come down tomorrow at the earliest.' };
    return { row: { kind: 'general', title: title, body: body || null, link: link || null, pinned: !!d.pinned, happened_at: todayIso(), expires_at: d.expires || null,
      created_by: myEmail(), created_name: meName(), audience: d.audience, teams: d.audience === 'teams' ? d.teams.slice() : [],
      department: d.audience === 'teams' && d.teams.length === 1 ? d.teams[0] : null, ask: ask, anonymous: ask ? !!d.anonymous : false,
      show_results: ask ? !!d.show_results : true, closes_at: ask && d.closes ? endOfDay(d.closes) : null, post_slack: !!d.slack } };
  }
  function submitPost() {
    var d = syncDraft(), b = buildRow(d), err = document.querySelector('#modalBox [data-w180perr]');
    if (b.err) { if (err) { err.hidden = false; err.textContent = b.err; } return; }
    S.busy.post = true; redrawPost();
    q(db.from('hub_announcements').insert(b.row).select('id, created_at').single()).then(function (r) {
      S.busy.post = false;
      if (!r || r.error || !r.data) {
        var m = r && r.error ? String(r.error.message || '') : '';
        redrawPost();
        var e2 = document.querySelector('#modalBox [data-w180perr]');
        if (e2) { e2.hidden = false; e2.textContent = /row-level security|policy/i.test(m) ? 'Leaders post to everyone, the leaders or their own team; HR and admins to anyone. This one is outside what you can post to.' : ('It did not post: ' + cleanErr(m || 'try again')); }
        return;
      }
      var row = Object.assign({}, b.row, { id: r.data.id, created_at: r.data.created_at || new Date().toISOString() });
      (S.list = S.list || []).unshift(row); S.draft = null;
      closeModal(); T(b.row.post_slack ? 'Posted, and on its way to ' + slackWhere(d) : 'Posted');
      paintCard();
      try { if (window.w116News && w116News.refresh) w116News.refresh(); } catch (e) { /* fine */ }
    });
  }

