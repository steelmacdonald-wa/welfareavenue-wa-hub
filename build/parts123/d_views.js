
  /* ---------- the page ---------- */
  var MAST_P = 'Ask another team for something, follow it through to done, and see what came in for your team.';
  function host() {
    var sec = document.getElementById('requests'); if (!sec) return null;
    var h = document.getElementById('w123');
    if (!h) { h = document.createElement('div'); h.id = 'w123'; sec.appendChild(h); }
    return h;
  }
  function mount() {
    var sec = document.getElementById('requests');
    if (!sec || !staffOk()) return false;
    sec.classList.add('w123on'); host();
    var p = sec.querySelector(':scope > .w118mast > p'); if (p && p.textContent !== MAST_P) p.textContent = MAST_P;
    return true;
  }
  function onPage() { var a = document.querySelector('.panel.active'); return !!(a && a.id === 'requests'); }
  function paint() {
    var h = host(); if (!h || !mount()) return;
    var html = navHtml();
    if (!R.loaded) html += '<div class="w123card"><p class="w123empty">Loading requests...</p></div>';
    else if (R.view === 'mine') html += mineHtml();
    else if (R.view === 'team') html += teamHtml();
    else if (R.view === 'all') html += allHtml();
    else if (R.view === 'settings') html += settingsHtml();
    else html += newHtml();
    h.innerHTML = html;
    after();
  }
  var paintT = null;
  function paintSoon() { clearTimeout(paintT); paintT = setTimeout(function () { if (onPage()) paint(); }, 30); }
  function repaint() {
    if (onPage() && !typingInForm()) paint();
    if (R.sheet) renderSheet();
    injectCard(true);
  }
  function typingInForm() { var a = document.activeElement; return !!(a && a.closest && a.closest('#w123 form[data-w123form]')); }
  function after() {
    if (R.view === 'new' && R.nw.sent) watchSent(R.nw.sent);
    if (R.view === 'settings' && isLeader() && !R.bot && !R.botBusy) loadBot();
  }

  function navHtml() {
    var c = R.loaded ? counts() : { mine: 0, inbox: 0, d: homeTeam() };
    var items = [['new', 'New request', '#requests/new', 0], ['mine', 'My requests', '#requests/mine', c.mine], ['team', 'Team inbox', '#requests/team/' + (R.tm.d || c.d || ''), c.inbox]];
    if (isLeader()) items.push(['all', 'All requests', '#requests/all', 0]);
    return '<div class="w123nav"><div class="w123seg" role="tablist" aria-label="Requests">' + items.map(function (it) {
      var on = R.view === it[0];
      return '<a role="tab" aria-selected="' + on + '" tabindex="0" data-w123go="' + it[2] + '" class="' + (on ? 'on' : '') + '">' + (it[0] === 'new' ? I('plus') : '') + E(it[1]) + (it[3] ? '<span class="n' + (it[0] === 'team' ? ' hot' : '') + '">' + it[3] + '</span>' : '') + '</a>';
    }).join('') + '</div><span class="sp"></span>' + (isLeader() ? '<a class="w123gear' + (R.view === 'settings' ? ' on' : '') + '" tabindex="0" data-w123go="#requests/settings">' + I('gear') + 'Slack settings</a>' : '') + '</div>';
  }
  function crumb(parts) {
    return '<div class="w123crumb">' + parts.map(function (p, i) { return (i ? I('chev') : '') + (p[1] ? '<a data-w123go="' + p[1] + '">' + E(p[0]) + '</a>' : '<span>' + E(p[0]) + '</span>'); }).join('') + '</div>';
  }
  function teamChip(d) { return '<span class="w123tm" style="' + cv(teamColor(d)) + '"><i></i>' + E(teamShort(d)) + '</span>'; }

  /* ---------- new request: team, then need, then the short form ---------- */
  function newHtml() {
    var n = R.nw;
    if (n.sent) return sentHtml(n.sent);
    if (n.d && n.type) return formHtml(n.d, n.type === 'other' ? null : typeOf(n.type));
    if (n.d) return typesHtml(n.d);
    return teamsHtml();
  }
  function recentTypes() {
    var seen = {}, out = [];
    R.reqs.filter(isMine).forEach(function (r) { var k = r.department + '/' + (r.type_key || 'other'); if (seen[k] || out.length >= 4) return; seen[k] = 1; out.push({ d: r.department, t: r.type_key || 'other', l: r.type_key ? typeLabel(r) : 'Something else for ' + teamShort(r.department) }); });
    return out;
  }
  function teamsHtml() {
    var m = me();
    var tiles = INBOX.map(function (d) {
      var ts = typesFor(d), ch = chanFor(d);
      return '<button type="button" class="w123team' + (m.dept === d ? ' mine' : '') + '" data-w123team="' + d + '" style="' + cv(teamColor(d)) + '">'
        + '<span class="w123ico">' + I(TEAM_ICON[d]) + '</span><b>' + E(teamLabel(d)) + '</b><span class="s">' + E(TEAM_BLURB[d] || '') + '</span>'
        + '<span class="m"><span>' + (ts.length ? ts.length + (ts.length === 1 ? ' kind of request' : ' kinds of request') : 'Describe what you need') + '</span>' + (ch ? '<span>' + I('hash') + E(ch) + '</span>' : '') + '</span></button>';
    }).join('');
    var again = recentTypes();
    var q0 = R.nw.q || '';
    return '<div class="w123anim"><div class="w123card"><h2 class="w123h">Who do you need something from?</h2>'
      + '<p class="w123sub">Pick the team, then what you need. It lands in their team inbox and their Slack channel, and you can follow it in My requests.</p>'
      + '<div class="w123search">' + I('search') + '<input type="search" data-w123q autocomplete="off" placeholder="Or search: flyer, reimbursement, time off, volunteers" value="' + E(q0) + '" aria-label="Search every kind of request"></div>'
      + (again.length ? '<div class="w123again">Again:' + again.map(function (a) { return '<a class="w123chip" data-w123go="#requests/new/' + a.d + '/' + a.t + '">' + I(a.t === 'other' ? 'spark' : typeIcon(a.t)) + E(a.l) + '</a>'; }).join('') + '</div>' : '')
      + '</div><div id="w123qres">' + searchHtml(q0) + '</div>'
      + '<div id="w123tiles"' + (q0 ? ' style="display:none"' : '') + '><div class="w123teams">' + tiles + '</div>' + sugsLanding() + '</div></div>';
  }
  function searchHtml(qs) {
    qs = lower(qs); if (!qs) return '';
    var words = qs.split(/\s+/).filter(Boolean);
    var hits = R.types.filter(function (t) {
      var hay = lower(t.label + ' ' + (t.description || '') + ' ' + teamLabel(t.department) + ' ' + (t.key || '').replace(/-/g, ' '));
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    });
    var teams = INBOX.filter(function (d) { var hay = lower(teamLabel(d) + ' ' + (TEAM_BLURB[d] || '')); return words.every(function (w) { return hay.indexOf(w) >= 0; }); });
    var rows = hits.map(function (t) { return typeRow(t.department, t, true); }).join('')
      + teams.map(function (d) { return '<button type="button" class="w123type other" data-w123team="' + d + '" style="' + cv(teamColor(d)) + '"><span class="w123ico">' + I(TEAM_ICON[d]) + '</span><span><span class="t2">Team</span><b>' + E(teamLabel(d)) + '</b><span class="d">' + E(TEAM_BLURB[d] || '') + '</span></span>' + I('chev') + '</button>'; }).join('');
    if (!rows) return '<div class="w123types w123anim"><p class="w123empty" style="padding:18px 20px">Nothing matches &ldquo;' + E(qs) + '&rdquo;. Pick the team below and choose <b>Something else</b>: describe it in your own words.</p></div>';
    return '<div class="w123types w123anim">' + rows + '</div>';
  }
  function typeRow(d, t, withTeam) {
    return '<button type="button" class="w123type" data-w123type="' + E(t.key) + '" data-d="' + d + '" style="' + cv(teamColor(d)) + '"><span class="w123ico">' + I(typeIcon(t.key)) + '</span><span>'
      + (withTeam ? '<span class="t2">' + E(teamShort(d)) + '</span>' : '') + '<b>' + E(t.label) + '</b>' + (t.description ? '<span class="d">' + E(t.description) + '</span>' : '') + '</span>' + I('chev') + '</button>';
  }
  function typesHtml(d) {
    var ts = typesFor(d), ch = chanFor(d);
    return '<div class="w123anim">' + crumb([['New request', '#requests/new'], [teamLabel(d)]])
      + '<div class="w123card"><span class="w123tm" style="' + cv(teamColor(d)) + '"><i></i>' + E(teamLabel(d)) + '</span><h2 class="w123h" style="margin-top:6px">What do you need from ' + E(teamShort(d)) + '?</h2>'
      + '<p class="w123sub">' + (ch ? 'Requests are posted in <b>#' + E(ch) + '</b> and land in the team inbox.' : 'Requests land in the team inbox.') + ' Pick the closest one; you can add anything the form does not ask for.</p></div>'
      + '<div class="w123types">' + ts.map(function (t) { return typeRow(d, t, false); }).join('')
      + '<button type="button" class="w123type other" data-w123type="other" data-d="' + d + '"><span class="w123ico">' + I('plus') + '</span><span><b>Something else</b><span class="d">Describe what you need from ' + E(teamShort(d)) + ' in your own words.</span></span>' + I('chev') + '</button></div></div>';
  }
  function titleHint(t) {
    var H = { 'post-request': 'Instagram post for the October food drive', 'email-request': 'Newsletter: thank-you to our volunteers', 'design-request': 'Poster for the community kitchen day', 'event-coverage': 'Photos at the Rally Paper finish line', 'print-request': '200 flyers for the clothing drive', 'reimbursement': 'Gloves and containers for Sunday', 'purchase-order': 'Six folding tables for servings', 'grant-info': 'Meal numbers for the DESTA report', 'hiring-request': 'Event coordinator, part time', 'onboarding-request': 'Onboard Priya, Program Coordinator', 'access-request': 'Canva access for Joy', 'event-supplies': 'Containers and gloves for Sunday', 'volunteer-support': 'Four more servers on Sunday', 'transport-request': 'Move the coolers to the park', 'media-release': 'Photo consent line for the volunteer form' };
    return 'A short summary, e.g. ' + (H[t && t.key] || 'what you need, in a few words');
  }
  function fieldHtml(f, i, dr) {
    var id = 'w123f' + i, name = 'f' + i, v = dr[name] == null ? '' : dr[name];
    var lab = '<label for="' + id + '">' + E(f.label) + (f.required ? '<span class="rq" aria-hidden="true">*</span>' : '<span class="op">optional</span>') + '</label>';
    if (f.type === 'textarea') return lab + '<textarea id="' + id + '" name="' + name + '"' + (f.required ? ' required aria-required="true"' : '') + '>' + E(v) + '</textarea>';
    var type = { number: 'number', date: 'date', url: 'url' }[f.type] || 'text';
    return lab + '<input id="' + id + '" name="' + name + '" type="' + type + '"' + (f.required ? ' required aria-required="true"' : '') + ' value="' + E(v) + '"' + (type === 'url' ? ' placeholder="https://"' : '') + (type === 'number' ? ' inputmode="decimal" step="any"' : '') + '>';
  }
  function fieldsOf(t) { return t && Array.isArray(t.fields) ? t.fields : []; }
  function hasDateField(t) { return fieldsOf(t).some(function (f) { return f.type === 'date' && DATE_KEYS.test(f.name || ''); }); }
  function formHtml(d, t) {
    var key = t ? t.key : 'other', dr = R.nw.drafts[d + ':' + key] || {};
    var head = crumb([['New request', '#requests/new'], [teamLabel(d), '#requests/new/' + d], [t ? t.label : 'Something else']]);
    if (t && t.key === 'time-off') return '<div class="w123anim">' + head + '<div class="w123card" style="max-width:720px"><span class="w123ico" style="' + cv('#B9851B') + '">' + I('sun') + '</span><h2 class="w123h" style="margin-top:12px">Time off has its own form</h2><p class="w123sub">It records the days against your time off for the year, HR confirms it, and it shows on your page. HR also sees it here, in their team inbox.</p><div class="w123acts"><button type="button" class="w123btn" data-w123timeoff>' + I('sun') + 'Open the time off form</button><a class="w123btn ghost" data-w123go="#requests/new/' + d + '">Back</a></div></div></div>';
    var fields = fieldsOf(t);
    var html = '<div class="w123anim">' + head + '<div class="w123fw"><form class="w123card w123form" data-w123form="' + E(key) + '" data-d="' + d + '" novalidate>'
      + '<span class="w123tm" style="' + cv(teamColor(d)) + '"><i></i>' + E(teamLabel(d)) + '</span>'
      + '<h2 class="w123h" style="margin-top:6px">' + E(t ? t.label : 'Something else for ' + teamShort(d)) + '</h2>'
      + (t && t.description ? '<p class="w123sub">' + E(t.description) + '</p>' : (!t ? '<p class="w123sub">Say what you need in your own words. The team can ask questions on the request.</p>' : ''))
      + '<label for="w123ft">Title<span class="rq" aria-hidden="true">*</span></label><input type="text" id="w123ft" name="title" maxlength="160" required aria-required="true" placeholder="' + E(titleHint(t)) + '" value="' + E(dr.title || '') + '">'
      + fields.map(function (f, i) { return fieldHtml(f, i, dr); }).join('')
      + (!t ? '<label for="w123fw">What do you need?<span class="rq" aria-hidden="true">*</span></label><textarea id="w123fw" name="__what" required aria-required="true" placeholder="What, for whom, by when, and anything the team should know">' + E(dr.__what || '') + '</textarea>' : '')
      + (!hasDateField(t) ? '<label for="w123fn">Needed by<span class="op">optional</span></label><input type="date" id="w123fn" name="__needed" min="' + isoDay() + '" value="' + E(dr.__needed || '') + '">' : '')
      + (fields.length ? '<label for="w123fm">Anything else<span class="op">optional</span></label><textarea id="w123fm" name="__more" placeholder="Links, context, who to talk to">' + E(dr.__more || '') + '</textarea>' : '')
      + '<label class="w123tog"><input type="checkbox" name="__urgent"' + (dr.__urgent ? ' checked' : '') + '><span><b>This is urgent</b><small>It goes to the top of the team inbox and is flagged in Slack.</small></span></label>'
      + '<p class="w123sub" data-w123err style="color:' + FLAG + ';display:none"></p>'
      + '<div class="w123acts"><button type="submit" class="w123btn" data-w123send>' + I('arrow') + 'Send to ' + E(teamShort(d)) + '</button><a class="w123btn ghost" data-w123go="#requests/new/' + d + '">Back</a></div>'
      + '</form>' + asideHtml(d, t) + '</div></div>';
    return html;
  }
  function asideHtml(d, t) {
    var ch = chanFor(d, t), owner = t && t.default_assignee;
    var st = t && Array.isArray(t.statuses) && t.statuses.length ? t.statuses : DEFAULT_STATUSES;
    return '<aside class="w123aside"><h4>Where it goes</h4>'
      + '<div class="w123ar"><span class="w123ico" style="' + cv(teamColor(d)) + '">' + I('inbox') + '</span><div><b>' + E(teamLabel(d)) + '&rsquo;s team inbox</b><span>On their team page and here in Requests</span></div></div>'
      + '<div class="w123ar"><span class="w123ico" style="' + cv('#4A154B') + '">' + I('hash') + '</span><div><b>' + (ch ? '#' + E(ch) : 'No Slack channel yet') + '</b><span>' + (ch ? 'Posted in the team&rsquo;s channel the moment you send it' : 'An admin can set one in Slack settings') + '</span></div></div>'
      + '<div class="w123ar"><span class="w123ico" style="' + cv(GREEN) + '">' + I('user') + '</span><div><b>' + (owner ? E(owner) + ' picks it up' : 'The team picks it up') + '</b><span>' + (owner ? 'They get a Slack message too' : 'A team lead gets a Slack message and can hand it to someone') + '</span></div></div>'
      + '<div class="flow"><h4>How it moves</h4><ol class="w123vsteps">' + st.map(function (s) { return '<li>' + E(cap(s)) + '</li>'; }).join('') + '</ol></div>'
      + '<p class="fine">You get a Slack message when it is done and when someone adds a note. Everything is in <a class="w123lnk" data-w123go="#requests/mine">My requests</a>.</p></aside>';
  }
  function sentHtml(r) {
    var ch = chanFor(r.department, typeOf(r.type_key));
    return '<div class="w123card w123done w123anim"><span class="ok">' + I('check') + '</span><h2>Sent to ' + E(teamLabel(r.department)) + '</h2>'
      + '<p>It is in their team inbox now' + (r.priority === 'urgent' ? ', marked urgent' : '') + '. Follow it in My requests; you get a Slack message when it is done.</p>'
      + '<div id="w123sl" class="sl">' + I('hash') + (ch ? 'Posting in #' + E(ch) + '…' : 'No Slack channel is set for this team yet') + '</div>'
      + '<div class="w123acts"><a class="w123btn" data-w123go="#requests/r/' + E(r.id) + '">Track it</a><a class="w123btn ghost" data-w123go="#requests/new/' + r.department + '">Another for ' + E(teamShort(r.department)) + '</a><a class="w123btn ghost" data-w123go="#requests/new">Something for another team</a></div></div>';
  }
  var sentWatch = null;
  function watchSent(r) {
    if (!r || !(r.id > 0) || sentWatch === r.id) { if (r && r.slack) slackLine(r); return; }
    sentWatch = r.id;
    var tries = 0;
    (function poll() {
      tries++;
      setTimeout(async function () {
        if (!R.nw.sent || R.nw.sent.id !== r.id) return;
        var res = await q(db.from('dept_requests').select('id, slack').eq('id', r.id).maybeSingle());
        if (res.data && res.data.slack) { r.slack = res.data.slack; var loc = R.reqs.filter(function (x) { return x.id === r.id; })[0]; if (loc) loc.slack = res.data.slack; slackLine(r); return; }
        if (tries < 5) poll(); else slackLine(r);
      }, tries === 1 ? 2500 : 3500);
    })();
  }
  function slackLine(r) {
    var el = document.getElementById('w123sl'); if (!el) return;
    var s = r.slack || {};
    if (s.ts) { el.className = 'sl'; el.innerHTML = I('check') + 'Posted in #' + E(s.channel) + (s.url ? ' &middot; <a class="w123lnk" href="' + E(s.url) + '" target="_blank" rel="noopener">open in Slack</a>' : ''); }
    else if (s.error) { el.className = 'sl bad'; el.innerHTML = I('alert') + 'Not posted in Slack: ' + E(clip(s.error, 140)) + '. The team still has it in their inbox.'; }
    else if (s.skipped) { el.className = 'sl'; el.innerHTML = I('hash') + E(cap(s.skipped)); }
    else { el.className = 'sl'; el.innerHTML = I('clock') + 'In the team inbox; the Slack post is on its way.'; }
  }

  /* ---------- rows ---------- */
  function reqRow(r, ctx) {
    var d = r.department, need = neededOf(r), dn = need ? daysUntil(need) : null, late = !r.done && dn !== null && dn < 0;
    var meta = [];
    if (ctx !== 'team' && ctx !== 'card') meta.push(teamChip(d));
    meta.push(E(typeLabel(r)));
    if (ctx !== 'mine') meta.push('from ' + E(whoAsked(r)));
    meta.push(E(ago(r.created_at)));
    if (need && !r.done) meta.push('<span class="' + (late ? 'late' : '') + '">' + E(dueText(need)) + '</span>');
    if (r.done && r.done_at) meta.push('done ' + E(ago(r.done_at)));
    var right = '<span class="w123pill ' + pillCls(r) + '">' + E(statusText(r)) + '</span>'
      + (r.priority === 'urgent' && !r.done ? '<span class="w123pill urg">' + I('bolt') + 'Urgent</span>' : '')
      + (r.assignee ? avatar(r.assignee, 22) : '');
    return '<div class="w123row" data-w123r="' + E(r.id) + '" tabindex="0" role="button" aria-label="' + E(r.title) + '"><span class="w123ico" style="' + cv(teamColor(d)) + '">' + I(typeIcon(r.type_key)) + '</span>'
      + '<div style="min-width:0"><div class="t">' + E(r.title) + '</div><div class="m">' + meta.join('<span class="dot"></span>') + '</div>'
      + (ctx === 'mine' && !r.done ? '<div class="bar" title="' + E(statusText(r)) + '"><i style="width:' + pct(r) + '%"></i></div>' : '') + '</div>'
      + '<div class="r">' + right + '</div></div>';
  }
  function jevPill(m) {
    var n = m.notify || null;
    if (!n) return '';
    if (n.decision === 'notify') return '<span class="w123pill jev" title="' + E(n.by === 'setting' ? 'The team setting says to always ping' : 'Jev decided the team needed to hear about it') + '">' + I('hash') + (n.channel ? E(n.channel) : 'Team pinged') + '</span>';
    return '<span class="w123pill quiet" title="' + E(n.by === 'setting' ? 'The team setting says never to ping' : 'Jev decided finding it here was enough') + '">Filed quietly</span>';
  }
  function mailRow(m, ctx) {
    var k = MAIL_KIND[m.kind] || MAIL_KIND.update, n = m.notify || {};
    var meta = [];
    if (ctx !== 'team' && ctx !== 'card') meta.push(teamChip(m.department));
    meta.push(E(k.l));
    meta.push('from ' + E(m.from_name || m.from_email || 'someone'));
    meta.push(E(ago(m.internal_date)));
    if (m.amount != null) meta.push('$' + E(Number(m.amount).toLocaleString('en-CA', { maximumFractionDigits: 2 })));
    if (m.due_date && mailOpen(m)) { var dn = daysUntil(m.due_date); meta.push('<span class="' + (dn !== null && dn < 0 ? 'late' : '') + '">' + E(dn !== null && dn < 0 ? 'was due ' + fmtDay(m.due_date) : 'due ' + fmtDay(m.due_date)) + '</span>'); }
    var right = jevPill(m)
      + (typeof n.ask === 'number' && n.ask >= 0.6 && !m.request_id && mailOpen(m) ? '<span class="w123pill new">Looks like a request</span>' : '')
      + (m.request_id ? '<span class="w123pill prog">Tracked as a request</span>' : (!mailOpen(m) ? '<span class="w123pill done">Handled</span>' : ''))
      + (m.assignee ? avatar(m.assignee, 22) : '');
    return '<div class="w123row" data-w123m="' + E(m.id) + '" tabindex="0" role="button" aria-label="' + E(m.title || m.subject || 'Email') + '"><span class="w123ico" style="' + cv(k.c) + '">' + I(k.icon) + '</span>'
      + '<div style="min-width:0"><div class="t">' + E(m.title || m.subject || 'Email') + '</div><div class="m">' + meta.join('<span class="dot"></span>') + '</div>'
      + (m.summary && ctx !== 'card' ? '<div class="s">' + E(m.summary) + '</div>' : '') + '</div><div class="r">' + right + '</div></div>';
  }
  function sugRow(s, ctx) {
    return '<div class="w123row sug" data-w123s="' + E(s.id) + '"><span class="w123ico" style="' + cv(GOLD) + '">' + I('spark') + '</span><div style="min-width:0"><div class="t">' + E(s.title) + '</div>'
      + '<div class="m">' + (ctx !== 'team' && ctx !== 'card' ? teamChip(s.department) + '<span class="dot"></span>' : '') + '<span>' + (s.kind === 'refine' ? 'An update to an open request' : 'Spotted in a meeting') + '</span>' + (s.confidence ? '<span class="dot"></span><span>confidence ' + E(s.confidence) + '/10</span>' : '') + (s.assignee ? '<span class="dot"></span><span>for ' + E(s.assignee) + '</span>' : '') + '</div>'
      + (s.quote && ctx !== 'card' ? '<div class="q">&ldquo;' + E(clip(s.quote, 240)) + '&rdquo;</div>' : '')
      + '<div class="acts"><button type="button" class="w123btn sm" data-w123sacc="' + E(s.id) + '">' + (s.kind === 'refine' ? 'Add it to the request' : 'Accept and file it') + '</button><button type="button" class="w123btn sm ghost" data-w123sx="' + E(s.id) + '">Dismiss</button>' + (s.transcript_id ? '<a class="w123lnk" data-w123go="#tx/' + E(s.transcript_id) + '" style="font-size:12.5px;align-self:center;margin-left:4px">Open the meeting</a>' : '') + '</div></div><div class="r"></div></div>';
  }
  function itemRow(it, ctx) { return it.k === 'r' ? reqRow(it.x, ctx) : it.k === 'm' ? mailRow(it.x, ctx) : sugRow(it.x, ctx); }
  function sugsLanding() {
    if (!R.sugs.length) return '';
    var list = R.sugs.slice(0, 4);
    return '<div class="w123sec"><h3>Spotted in meetings</h3><span class="c">' + R.sugs.length + ' ask' + (R.sugs.length === 1 ? '' : 's') + ' the Hub heard; nothing is filed until someone accepts it</span></div><div class="w123list">' + list.map(function (s) { return sugRow(s, 'all'); }).join('') + '</div>'
      + (R.sugs.length > list.length ? '<p class="w123sub">The rest wait in each team&rsquo;s inbox.</p>' : '');
  }

  /* ---------- my requests ---------- */
  function sortOpen(a, b) {
    var ha = urgentOrLate(a), hb = urgentOrLate(b); if (ha !== hb) return ha ? -1 : 1;
    var na = neededOf(a), nb = neededOf(b); if (na && nb && na !== nb) return na < nb ? -1 : 1; if (na && !nb) return -1; if (nb && !na) return 1;
    return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
  }
  function mineHtml() {
    var mine = R.reqs.filter(isMine);
    if (!mine.length) return '<div class="w123card w123anim"><h2 class="w123h">Nothing asked yet</h2><p class="w123sub">When you ask another team for something, it shows here with where it is at. You get a Slack message when it is done.</p><div class="w123acts"><a class="w123btn" data-w123go="#requests/new">' + I('plus') + 'New request</a></div></div>';
    var open = mine.filter(function (r) { return !r.done; }).sort(sortOpen);
    var done = mine.filter(function (r) { return r.done; }).sort(function (a, b) { return String(b.done_at || b.updated_at || '').localeCompare(String(a.done_at || a.updated_at || '')); });
    var showAll = R.mineAll;
    return '<div class="w123anim">'
      + '<div class="w123sec" style="margin-top:0"><h3>Open</h3><span class="c">' + open.length + '</span></div>'
      + (open.length ? '<div class="w123list">' + open.map(function (r) { return reqRow(r, 'mine'); }).join('') + '</div>' : '<div class="w123list"><p class="w123empty" style="padding:18px 20px">Nothing open. Everything you asked for is done.</p></div>')
      + (done.length ? '<div class="w123sec"><h3>Done</h3><span class="c">' + done.length + '</span></div><div class="w123list">' + done.slice(0, showAll ? 200 : 6).map(function (r) { return reqRow(r, 'mine'); }).join('') + '</div>' + (done.length > 6 && !showAll ? '<p class="w123sub"><a class="w123lnk" data-w123mineall>Show all ' + done.length + '</a></p>' : '') : '')
      + '</div>';
  }

  /* ---------- the team inbox ---------- */
  function teamHtml() {
    var ds = allowedTeams();
    var d = R.tm.d && ds.indexOf(R.tm.d) >= 0 ? R.tm.d : homeTeam(); R.tm.d = d;
    var items = teamItems(d, R.tm.state);
    var nAll = items.length;
    if (R.tm.kind !== 'all') items = items.filter(function (it) { return it.k === R.tm.kind; });
    if (R.tm.mine) items = items.filter(function (it) { return it.k !== 's' && withMe(it.x); });
    var ch = chanFor(d);
    var chips = ds.map(function (x) { var n = teamItems(x, 'open').length; return '<a class="w123chip' + (x === d ? ' on' : '') + '" data-w123go="#requests/team/' + x + '">' + E(teamShort(x)) + (n ? ' <span class="n">' + n + '</span>' : '') + '</a>'; }).join('');
    var seg = function (key, opts, cur) { return '<span class="w123small">' + opts.map(function (o) { return '<a data-' + key + '="' + o[0] + '" class="' + (cur === o[0] ? 'on' : '') + '">' + E(o[1]) + '</a>'; }).join('') + '</span>'; };
    var empty = R.tm.state === 'open'
      ? 'Nothing waiting for <b>' + E(teamLabel(d)) + '</b>. New requests to the team, emails the Hub inbox files for it, and asks spotted in its meetings land here.'
      : 'Nothing handled in the last while.';
    return '<div class="w123anim"><div class="w123again" style="margin:0 0 14px">' + chips + '</div>'
      + '<div class="w123note">' + I('inbox') + '<div><b>' + E(teamLabel(d)) + '</b>: ' + (ch ? 'new requests are posted in <b>#' + E(ch) + '</b>. ' : '') + 'Emails the Hub inbox files for the team land here too, and Jev pings the channel only when one needs the team soon.</div></div>'
      + '<div class="w123bar">' + seg('w123tms', [['open', 'Open'], ['done', 'Done and earlier']], R.tm.state) + seg('w123tmk', [['all', 'Everything'], ['r', 'Requests'], ['m', 'Emails'], ['s', 'From meetings']], R.tm.kind)
      + '<label class="w123chip" style="cursor:pointer"><input type="checkbox" data-w123tmme' + (R.tm.mine ? ' checked' : '') + ' style="margin:0 4px 0 0;accent-color:' + GREEN + '"> With me</label><span class="sp"></span><a class="w123btn sm" data-w123go="#requests/new/' + d + '">' + I('plus') + 'Ask ' + E(teamShort(d)) + '</a></div>'
      + (items.length ? '<div class="w123list">' + items.slice(0, 150).map(function (it) { return itemRow(it, 'team'); }).join('') + '</div>' : '<div class="w123list"><p class="w123empty" style="padding:18px 20px">' + (nAll && (R.tm.kind !== 'all' || R.tm.mine) ? 'Nothing with these filters.' : empty) + '</p></div>')
      + '</div>';
  }

  /* ---------- all requests (leaders) ---------- */
  function allHtml() {
    if (!isLeader()) return mineHtml();
    var f = R.all, ql = lower(f.q);
    var rows = R.reqs.filter(function (r) {
      if (f.d && r.department !== f.d) return false;
      if (f.state === 'open' && r.done) return false;
      if (f.state === 'done' && !r.done) return false;
      if (ql && lower(r.title + ' ' + typeLabel(r) + ' ' + (r.requested_by || '') + ' ' + (r.assignee || '') + ' ' + (typeof r.details === 'string' ? r.details : JSON.stringify(r.details || {}))).indexOf(ql) < 0) return false;
      return true;
    });
    rows = f.state === 'open' ? rows.sort(sortOpen) : rows;
    var byTeam = {}; R.reqs.forEach(function (r) { if (!r.done) byTeam[r.department] = (byTeam[r.department] || 0) + 1; });
    return '<div class="w123anim"><div class="w123bar"><select data-w123alld aria-label="Team"><option value="">Every team</option>' + INBOX.map(function (d) { return '<option value="' + d + '"' + (f.d === d ? ' selected' : '') + '>' + E(teamLabel(d)) + (byTeam[d] ? ' (' + byTeam[d] + ' open)' : '') + '</option>'; }).join('') + '</select>'
      + '<span class="w123small">' + [['open', 'Open'], ['done', 'Done'], ['any', 'Everything']].map(function (o) { return '<a data-w123alls="' + o[0] + '" class="' + (f.state === o[0] ? 'on' : '') + '">' + o[1] + '</a>'; }).join('') + '</span>'
      + '<span class="sp"></span><input type="search" data-w123allq placeholder="Search requests" value="' + E(f.q) + '" aria-label="Search requests"></div>'
      + '<div id="w123allrows">' + allRows(rows) + '</div></div>';
  }
  function allRows(rows) { return rows.length ? '<div class="w123list">' + rows.slice(0, 200).map(function (r) { return reqRow(r, 'all'); }).join('') + '</div>' : '<div class="w123list"><p class="w123empty" style="padding:18px 20px">No requests match.</p></div>'; }

  /* ---------- Slack settings (leaders see, admins change) ---------- */
  async function loadBot() {
    R.botBusy = true;
    try {
      var a = await fx({ action: 'status' });
      if (!a || !a.teams) throw new Error('the Slack check did not answer');
      var b = null; try { b = await fx({ action: 'channels' }); } catch (e) { b = null; }
      R.bot = { teams: a.teams || {}, type_channels: a.type_channels || {}, channels: (b && b.channels) || [] };
      R.botErr = null;
    } catch (e) { R.botErr = String(e.message || e); R.bot = { teams: {}, type_channels: {}, channels: [] }; }
    R.botBusy = false;
    if (R.view === 'settings' && onPage()) paint();
  }
  function settingsHtml() {
    if (!isLeader()) return '<div class="w123card"><p class="w123empty">Slack settings are for leaders and admins.</p></div>';
    var c = R.cfgDraft || (R.cfgDraft = JSON.parse(JSON.stringify(R.cfg || cfgOf(null))));
    var can = isAdmin(), bot = R.bot;
    var dis = can ? '' : ' disabled';
    var rows = INBOX.map(function (d) {
      var st = bot && bot.teams && bot.teams[d];
      var stat = !bot ? '<span class="op" style="font-size:12px;color:var(--wa-muted)">Checking Slack…</span>'
        : st && st.channel ? '<span class="ok">' + I('check') + ' Posting in #' + E(st.channel) + (st.chain && st.chain[0] !== st.channel ? ' (the first choice is not reachable)' : '') + '</span>'
        : '<span class="no">' + I('alert') + ' ' + E(((st && st.tried) || []).map(function (t) { return '#' + t.name + ': ' + t.state; }).join('; ') || 'No channel set') + '</span>';
      var mode = c.email_mode[d] || 'jev';
      return '<div class="w123set"><div><span class="w123tm" style="' + cv(teamColor(d)) + '"><i></i>' + E(teamLabel(d)) + '</span></div>'
        + '<div><input type="text" list="w123chl" data-w123cfgch="' + d + '" value="' + E((c.channels[d] || []).join(', ')) + '" placeholder="channel-name, fallback"' + dis + ' aria-label="Slack channel for ' + E(teamLabel(d)) + '">' + stat + '</div>'
        + '<div><select data-w123cfgem="' + d + '"' + dis + ' aria-label="Emails for ' + E(teamLabel(d)) + '"><option value="jev"' + (mode === 'jev' ? ' selected' : '') + '>Emails: Jev decides</option><option value="always"' + (mode === 'always' ? ' selected' : '') + '>Emails: always ping</option><option value="never"' + (mode === 'never' ? ' selected' : '') + '>Emails: never ping</option></select></div>'
        + '<div><button type="button" class="w123btn sm ghost" data-w123test="' + d + '">Send a test</button></div></div>';
    }).join('');
    var sw = function (key, title, sub) { return '<label class="w123sw"><input type="checkbox" data-w123cfg="' + key + '"' + (c[key] ? ' checked' : '') + dis + '><div><b>' + title + '</b><span>' + sub + '</span></div></label>'; };
    var over = R.types.filter(function (t) { return t.channel; });
    return '<div class="w123anim"><div class="w123card"><h2 class="w123h">Slack and the team inbox</h2><p class="w123sub">Where each team&rsquo;s requests are posted, and what happens to the emails the Hub inbox files for them. Channels are tried in order: if the Hub bot is not in the first one, the next one is used. To use a private channel, add the Hub app to it in Slack (channel settings, Integrations).' + (can ? '' : ' Only admins can change these.') + '</p>'
      + (R.botErr ? '<div class="w123note warn" style="margin-top:14px">' + I('alert') + '<div><b>The Slack check did not answer</b>: ' + E(R.botErr) + '</div></div>' : '')
      + '<div style="margin-top:14px">' + rows + '</div>'
      + '<datalist id="w123chl">' + ((bot && bot.channels) || []).map(function (x) { return '<option value="' + E(x.name) + '">' + (x.member ? 'bot is in it' : 'public, the bot joins') + '</option>'; }).join('') + '</datalist>'
      + '<div style="margin-top:12px">' + sw('post_requests', 'Post every new request in the team&rsquo;s channel', 'With the details, who asked and when it is needed. Time off is posted without the details.')
      + sw('thread_updates', 'Reply in the request&rsquo;s thread', 'When the status changes, it is handed to someone, it is done, or someone adds a note.')
      + sw('dm_requester', 'Message the requester', 'When their request is done, and when someone adds a note to it.') + '</div>'
      + (over.length ? '<div class="w123sec"><h3>Request types with their own channel</h3></div>' + over.map(function (t) { var s2 = bot && bot.type_channels && bot.type_channels[t.key]; return '<div class="w123ar" style="margin:6px 0"><span class="w123ico" style="' + cv(teamColor(t.department)) + '">' + I(typeIcon(t.key)) + '</span><div><b>' + E(t.label) + ' &rarr; #' + E(t.channel) + '</b><span>' + (s2 ? (s2.ok ? 'The bot can post there' : 'The bot cannot post there yet; the team channel is used') : '') + '</span></div></div>'; }).join('') : '')
      + (can ? '<div class="w123acts"><button type="button" class="w123btn" data-w123save>Save</button><button type="button" class="w123btn ghost" data-w123cfgreset>Discard changes</button></div>' : '')
      + '</div></div>';
  }
