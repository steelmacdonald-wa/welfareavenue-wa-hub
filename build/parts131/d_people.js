
  /* ---------- People: what needs doing, then everyone by team ---------- */
  var FILTERS = [['', 'Everyone'], ['active', 'Signed in'], ['invited', 'Invited'], ['notinvited', 'Not invited'], ['noemail', 'No email'], ['noprof', 'No profile'], ['removed', 'Removed']];
  var SPECIAL = { mis: 'Profile and roster disagree', gone: 'Inactive but can sign in', admin: 'Admins' };
  function matchStatus(x, f) {
    if (f === 'removed') return x.status === 'removed';
    if (f === 'gone') return x.roster && x.active === false && x.row && x.row.role !== 'blocked';
    if (x.status === 'removed') return false;
    if (!f) return true;
    if (f === 'noprof') return !!x.row && !x.assigned && !x.hand;
    if (f === 'mis') return !!(x.assigned && isTeamP(x.assigned) && x.dept && x.dept !== 'board' && x.assigned.team !== x.dept);
    if (f === 'admin') return x.role === 'admin';
    return x.status === f;
  }
  function matchQuery(x) {
    if (S.team && (S.team === 'none' ? (x.dept && TEAMS.indexOf(x.dept) >= 0) : x.dept !== S.team)) return false;
    if (!S.q) return true;
    var q = lower(S.q);
    return lower([x.name, x.email, x.title, teamLabel(x.dept), x.assigned ? x.assigned.label : ''].join(' ')).indexOf(q) >= 0;
  }
  function rowHtml(x) {
    return '<button type="button" class="w131p" data-w131open="' + E(pkey(x)) + '">' + avatar(x)
      + '<span class="nm"><b>' + E(x.name) + '</b><span>' + E(x.title || (x.roster ? '' : 'Not on the roster')) + (x.email ? (x.title || !x.roster ? ' · ' : '') + E(x.email) : '') + '</span></span>'
      + statusHtml(x) + '<span class="acc">' + accessChip(x) + '</span><span class="chv">' + I('chev') + '</span></button>';
  }
  function peopleHtml() {
    var xs = people(), td = todos(), h = '';
    if (td.length) {
      h += '<div class="w131box w131todo"><div class="hd">' + I('spark') + 'What needs doing</div>' + td.map(function (t) {
        return '<div class="w131do ' + t.cls + '" data-w131do="' + t.k + '"><span class="ic">' + I(t.ic) + '</span><div class="tx">' + t.t + (t.s ? '<small>' + E(t.s) + '</small>' : '') + '</div><div class="ac">' + t.a + '</div></div>';
      }).join('') + '</div>';
    } else h += '<div class="w131box w131alldone">' + I('check') + '<span>Everyone is set up: each person with access has a profile, and no request is waiting.</span></div>';
    var base = xs.filter(matchQuery);
    var counts = {}; FILTERS.forEach(function (f) { counts[f[0]] = base.filter(function (x) { return matchStatus(x, f[0]); }).length; });
    h += '<div class="w131bar"><label class="w131q">' + I('search') + '<input type="search" id="w131q" placeholder="Search a name, email, title or profile" value="' + E(S.q) + '" aria-label="Search people"></label>'
      + '<select id="w131team" aria-label="Team"><option value="">Every team</option>' + TEAMS.map(function (d) { return '<option value="' + d + '"' + (S.team === d ? ' selected' : '') + '>' + E(teamLabel(d)) + '</option>'; }).join('') + '<option value="none"' + (S.team === 'none' ? ' selected' : '') + '>No team</option></select></div>'
      + '<div class="w131chips" role="group" aria-label="Show">' + FILTERS.map(function (f) { return '<a data-w131st="' + f[0] + '"' + (S.status === f[0] ? ' class="on"' : '') + '>' + E(f[1]) + ' <b>' + counts[f[0]] + '</b></a>'; }).join('')
      + (SPECIAL[S.status] ? '<a class="on" data-w131st="">' + E(SPECIAL[S.status]) + ' <b>' + base.filter(function (x) { return matchStatus(x, S.status); }).length + '</b> ×</a>' : '') + '</div>';
    var list = base.filter(function (x) { return matchStatus(x, S.status); });
    if (!list.length) return h + '<div class="w131box"><p class="w131empty">Nobody matches. Clear the search or pick another filter.</p></div>' + footHtml();
    var groups = TEAMS.map(function (d) { return [d, teamLabel(d), teamColor(d)]; }).concat([['', 'No team', '#8b8d88']]);
    groups.forEach(function (g) {
      var inG = list.filter(function (x) { return g[0] ? x.dept === g[0] : !(x.dept && TEAMS.indexOf(x.dept) >= 0); });
      if (!inG.length) return;
      inG.sort(function (a, b) { var la = a.lead || a.role === 'admin' ? 0 : 1, lb = b.lead || b.role === 'admin' ? 0 : 1; return (la - lb) || String(a.name).localeCompare(String(b.name)); });
      h += '<section class="w131box w131team" style="padding:4px 0 2px;--c:' + E(g[2]) + '"><div class="th"><i></i><h3>' + E(g[1]) + '</h3><span class="n">' + inG.length + '</span><span class="sp"></span>'
        + (g[0] ? '<a class="w131lnk" data-w131newin="' + E(g[0]) + '" style="font-size:12.5px;white-space:nowrap" aria-label="Invite someone to ' + E(g[1]) + '">' + I('plus') + ' Invite<span class="t"> to this team</span></a>' : '') + '</div>'
        + inG.map(rowHtml).join('') + '</section>';
    });
    return h + footHtml();
  }
  function footHtml() {
    return '<p class="w131foot">A person’s access profile decides the pages they see and, for the finances and the board, what the database lets them read. Their role follows the profile. '
      + '<a class="w131lnk" data-w131classic="1">Open the classic view</a> for the old table, the roles and hand-picked pages.</p>';
  }

  /* ---------- the person sheet ---------- */
  function openPerson(key) { S.sheet = { kind: 'person', key: key, pick: null, lead: null, rm: false, email: '', res: null, link: null }; renderSheet(); }
  function sheetPick(x) {
    var sh = S.sheet;
    var key = sh.pick || (x.assigned ? x.assigned.key : (x.sug ? x.sug.key : null));
    var lead = sh.lead != null ? sh.lead : (sh.pick ? false : (x.assigned ? x.lead : !!(x.sug && x.sug.lead)));
    if (key && !isTeamP(S.byKey[key])) lead = false;
    return { key: key, lead: lead };
  }
  function tierText(p) { return p.tier === 'admin' ? 'Everything, and Admin' : p.tier === 'leader' ? 'Every page but Admin' : p.tier === 'viewer' ? 'Directors, not on staff' : 'Team, lead option'; }
  function pickerHtml(sel, lead, dept, lockedAdmin) {
    var teamPs = S.profiles.filter(isTeamP).slice().sort(function (a, b) { return (a.team === dept ? -1 : 0) - (b.team === dept ? -1 : 0) || (a.sort || 0) - (b.sort || 0); });
    var others = S.profiles.filter(function (p) { return !isTeamP(p); });
    function opt(p) {
      var dis = lockedAdmin && p.key !== 'admin';
      return '<button type="button" class="w131opt' + (sel === p.key ? ' on' : '') + '" data-w131pick="' + E(p.key) + '"' + (dis ? ' disabled' : '') + ' style="--c:' + E(p.color || GREEN) + '" aria-pressed="' + (sel === p.key) + '"><i></i><span>' + E(p.label) + '<small>' + E(tierText(p)) + '</small></span>' + (p.team && p.team === dept ? '<em>their team</em>' : '') + '</button>';
    }
    var h = '<div class="w131pick"><div class="gl">Team profiles</div>' + teamPs.map(opt).join('') + '<div class="gl">Everything else</div>' + others.map(opt).join('') + '</div>';
    var sp = S.byKey[sel];
    if (sp && isTeamP(sp)) h += '<div class="w131lead"><button type="button" class="w131sw' + (lead ? ' on' : '') + '" data-w131lead="1" role="switch" aria-checked="' + !!lead + '" aria-label="Lead of the team"></button><div><b>Lead of ' + E(teamLabel(sp.team) || sp.label) + '</b><span>' + E(sp.lead_note || 'A lead also gets Agendas, Activity, the HR centre for their team and the board pages.') + '</span></div></div>';
    return h;
  }
  function personSheet(x) {
    var sh = S.sheet, pk = sheetPick(x), p = pk.key ? S.byKey[pk.key] : null;
    var next = p ? pagesOfProfile(p.key, pk.lead, x.row, x.email) : [];
    var changed = !!p && (!x.assigned || x.assigned.key !== p.key || (isTeamP(p) && x.lead !== pk.lead) || x.hand);
    var body = '';
    /* sign-in */
    var sign = '';
    if (x.status === 'active') sign = '<p>Signed in ' + E(ago(x.login && x.login.last_sign_in_at)) + '.</p><div class="row"><a class="w131btn sm ghost" data-w131link="1">' + I('link') + 'Copy a sign-in link</a></div>';
    else if (x.status === 'invited') sign = '<p>Has access but has not signed in yet' + (x.login && x.login.account_created ? ' (account made ' + E(ago(x.login.account_created)) + ')' : '') + '.</p><div class="row"><a class="w131btn sm" data-w131resend="1">' + I('mail') + 'Send the invitation again</a><a class="w131btn sm ghost" data-w131link="1">' + I('link') + 'Copy a sign-in link</a></div>';
    else if (x.status === 'notinvited') sign = '<p>On the roster, not invited yet. Pick the profile below, then invite them: the Hub emails a sign-in invitation from hub@ and sends a Slack welcome when it can find them.</p>';
    else if (x.status === 'noemail') sign = '<p>No email yet, so they cannot be invited.</p><label class="f">Their Welfare Avenue email<input type="email" id="w131em" placeholder="name@welfareavenue.com" value="' + E(sh.email || '') + '"></label><div class="row"><a class="w131btn sm" data-w131setem="1">' + I('check') + 'Save the email</a></div>';
    else if (x.status === 'removed') sign = '<p>' + (x.row && x.row.role === 'blocked' ? 'Removed from the Hub: they cannot sign in.' : 'Marked as no longer active on the roster.') + ' Their work and history stay.</p>';
    if (sh.link) sign += '<div class="note" style="margin-top:8px">' + sh.link + '</div>';
    if (sh.res) sign += '<div class="res" style="margin-top:10px">' + sh.res + '</div>';
    body += '<div class="sec"><h4>Sign-in</h4>' + sign + '</div>';
    /* access */
    var acc = '';
    if (x.status === 'noemail') acc = '<p class="w131mut" style="font-size:13px">Add their email first; then pick a profile and invite them.</p>';
    else {
      acc += '<p style="font-size:13px">' + (x.founder ? 'Founders always keep Admin.' : x.hand ? 'Today: <b>hand-picked pages</b> (' + x.row.tabs.length + '), which replace any profile.' : x.assigned ? 'Today: <b>' + E(profileName(x.assigned.key, x.lead)) + '</b>.' : x.row ? 'Today: <b>no profile</b>; the classic ' + E(x.role || 'member') + ' pages apply.' : 'They get this profile when they are invited.') + (x.sug && S.byKey[x.sug.key] && !x.same && !x.founder && x.status !== 'removed' ? ' Suggested: <b>' + E(profileName(x.sug.key, x.sug.lead)) + '</b> (' + E(x.sug.why) + ').' : '') + '</p>';
      acc += pickerHtml(pk.key, pk.lead, x.dept, x.founder);
      if (p) {
        acc += '<div style="margin-top:14px"><h4>' + (x.row && x.status !== 'removed' ? 'What they will see' : 'What they get') + ' · ' + next.length + ' pages</h4>'
          + (x.row && x.status !== 'removed' && changed ? '<p class="w131diff">' + diffText(next, x.pages) + '</p>' : '')
          + pagesHtml(next, x.row && x.status !== 'removed' && changed ? x.pages : null) + '</div>';
      }
      if (x.hand && !x.founder) acc += '<div class="note" style="margin-top:12px">Saving a profile replaces the ' + x.row.tabs.length + ' hand-picked pages. <a class="w131lnk" data-w131hand="1">Edit the hand-picked pages instead</a></div>';
    }
    body += '<div class="sec"><h4>Access profile</h4>' + acc + '<div class="err" id="w131err"></div></div>';
    /* remove */
    if (x.email && x.status !== 'removed' && !x.founder && x.email !== myEmail()) {
      body += '<div class="sec"><h4>Remove</h4>' + (sh.rm
        ? '<p>Remove <b>' + E(x.name) + '</b> from the Hub? Their access is blocked, their sign-in is revoked and they are marked inactive on the roster. Their tasks, updates and history stay, and you can invite them again later.</p><div class="row"><a class="w131btn sm danger solid" data-w131rmgo="1">Remove them</a><a class="w131btn sm ghost" data-w131rm="0">Cancel</a></div>'
        : '<p class="w131mut" style="font-size:13px">Takes away their access and signs them out everywhere.</p><div class="row"><a class="w131btn sm danger" data-w131rm="1">' + I('out') + 'Remove from the Hub</a></div>') + '</div>';
    }
    /* the footer: the one thing to do */
    var foot = '';
    if (x.status === 'notinvited' || x.status === 'removed') {
      foot = '<label class="ck" style="font-size:13px"><input type="checkbox" id="w131send" checked> Email the invitation</label><span class="sp"></span><a class="w131btn' + (p ? '' : ' off') + '" data-w131invite="1">' + I('mail') + (x.status === 'removed' ? 'Invite again' : 'Invite') + (p ? ' as ' + E(profileName(p.key, pk.lead)) : '') + '</a>';
    } else if (x.status !== 'noemail') {
      foot = (x.id ? '<a class="w131btn sm ghost" data-w131go="#person/' + E(x.id) + '">' + I('user') + 'Their page</a>' : '') + '<span class="sp"></span><a class="w131btn' + (changed && !x.founder ? '' : ' off') + '" data-w131save="1">' + I('check') + (changed ? 'Save: ' + E(p ? profileName(p.key, pk.lead) : '') : 'Saved') + '</a>';
    } else foot = '<span class="sp"></span><a class="w131btn ghost" data-w131close="1">Close</a>';
    return { kicker: x.roster ? teamLabel(x.dept) || 'No team' : 'Not on the roster', title: x.name, sub: [x.title, x.email].filter(Boolean).join(' · '), body: body, foot: foot };
  }

  /* ---------- person actions ---------- */
  function sheetErr(m) { var e = document.getElementById('w131err'); if (e) e.textContent = m || ''; }
  async function afterChange(email) {
    await load(true);
    try { if (typeof wa40Load === 'function') await wa40Load(); } catch (e) { /* fine */ }
    try { if (lower(email) === myEmail() && typeof wa40Enforce === 'function') wa40Enforce(); } catch (e) { /* fine */ }
    try { if (window.w127 && window.w127.load) window.w127.load(true); } catch (e) { /* fine */ }
    paint(); if (S.sheet) renderSheet();
  }
  async function saveProfile(x, key, lead, why) {
    var p = S.byKey[key]; if (!p || !x.email) return false;
    if (x.founder && key !== 'admin') { sheetErr('Founders always keep Admin.'); return false; }
    if (x.email === myEmail() && x.role === 'admin' && key !== 'admin') { sheetErr('You cannot take Admin away from yourself here. Ask another admin.'); return false; }
    var role = roleFor(key, lead);
    var r = await db.from('hub_roles').upsert({ email: x.email, role: role, profile: key, tabs: null, updated_by: actor(), updated_at: new Date().toISOString() }, { onConflict: 'email' });
    if (r && r.error) { sheetErr('Could not save it: ' + (r.error.message || 'try again')); return false; }
    logChange('hub_role', x.email, 'profile', x.hand ? 'hand-picked pages' : x.assigned ? profileName(x.assigned.key, x.lead) : (x.row ? x.row.role + ' (classic)' : null), profileName(key, lead) + (why ? ' (' + why + ')' : ''));
    return true;
  }
  async function doSave() {
    var x = personBy(S.sheet.key); if (!x || S.busy) return;
    var pk = sheetPick(x); if (!pk.key) return;
    S.busy = true;
    var ok = await saveProfile(x, pk.key, pk.lead);
    S.busy = false;
    if (ok) { toastS(first(x.name) + ': ' + profileName(pk.key, pk.lead)); S.sheet.pick = null; S.sheet.lead = null; await afterChange(x.email); }
  }
  function resultHtml(res, name) {
    return (res.email_sent ? '<b class="ok">Invitation emailed</b>' + (res.note && /Supabase/.test(res.note) ? ' <span class="w131mut">(by Supabase; the hub@ send failed)</span>' : ' <span class="w131mut">from hub@welfareavenue.com</span>') : '<b class="no">No email sent</b>' + (res.note && res.note !== 'not requested' ? ' <span class="w131mut">(' + E(String(res.note).slice(0, 110)) + ')</span>' : ' <span class="w131mut">(you chose not to)</span>'))
      + '<br>Slack welcome: ' + (res.slack === 'sent' || res.slack === 'sent_channel' ? '<b class="ok">sent</b>' : '<b class="no">not sent</b> <span class="w131mut">(' + E(res.slack === 'no_slack' ? 'not in the WA Slack yet' : (res.slack || 'skipped')) + ')</span>')
      + '<div style="margin-top:10px"><textarea class="msg" readonly id="w131msg">' + E(inviteMessage(name)) + '</textarea></div><div class="row" style="margin-top:8px"><a class="w131btn sm ghost" data-w131copymsg="1">Copy the message</a><a class="w131btn sm ghost" data-w131link="1">' + I('link') + 'Copy a sign-in link</a></div>';
  }
  async function doInvite(x, key, lead, send) {
    var body = { action: 'invite', name: x.name, email: x.email, role_title: x.title || '', hub_role: roleFor(key, lead), send_email: !!send };
    if (x.dept && TEAMS.indexOf(x.dept) >= 0) body.department = x.dept;
    var res = await invoke(body);
    var r = await db.from('hub_roles').upsert({ email: x.email, role: roleFor(key, lead), profile: key, tabs: null, updated_by: actor(), updated_at: new Date().toISOString() }, { onConflict: 'email' });
    if (r && r.error) throw new Error('invited, but the profile did not save: ' + (r.error.message || ''));
    logChange('hub_role', x.email, 'profile', null, profileName(key, lead) + ' (with the invitation)');
    return res;
  }
  async function inviteFromSheet() {
    var x = personBy(S.sheet.key); if (!x || S.busy) return;
    var pk = sheetPick(x); if (!pk.key) { sheetErr('Pick a profile first.'); return; }
    var send = !!(document.getElementById('w131send') || {}).checked;
    S.busy = true; var btn = document.querySelector('#w131sheet [data-w131invite]'); if (btn) { btn.classList.add('off'); btn.textContent = 'Inviting…'; }
    try {
      var res = await doInvite(x, pk.key, pk.lead, send);
      S.sheet.res = resultHtml(res, x.name); S.sheet.pick = null; S.sheet.lead = null;
      toastS(res.email_sent ? 'Invitation emailed to ' + first(x.name) : first(x.name) + ' can sign in now; share the message or a link');
      S.busy = false; await afterChange(x.email);
    } catch (e) { S.busy = false; sheetErr('Could not invite: ' + String((e && e.message) || e).slice(0, 140)); renderSheetKeepErr(); }
  }
  async function resend() {
    var x = personBy(S.sheet.key); if (!x || S.busy) return;
    S.busy = true;
    try {
      var body = { action: 'invite', name: x.name, email: x.email, role_title: x.title || '', hub_role: x.role && x.role !== 'blocked' ? x.role : 'member', send_email: true };
      if (x.dept && TEAMS.indexOf(x.dept) >= 0) body.department = x.dept;
      var res = await invoke(body);
      S.sheet.res = resultHtml(res, x.name);
      toastS(res.email_sent ? 'Invitation sent again' : 'The email did not go; copy a sign-in link instead');
    } catch (e) { toastS('Could not send it: ' + String((e && e.message) || e).slice(0, 90)); }
    S.busy = false; renderSheet();
  }
  async function signLink() {
    var x = personBy(S.sheet.key); if (!x || !x.email) return;
    S.sheet.link = 'Making a one-time sign-in link…'; renderSheet();
    try {
      var res = await invoke({ action: 'link', email: x.email });
      var ok = await copyText(res.link);
      S.sheet.link = (ok ? '<b>Copied.</b> ' : 'Here it is: ') + 'A one-time link that signs ' + E(first(x.name)) + ' straight in' + (res.existing_account ? '' : ' and sets up their account') + '. Send it only to them.<input type="text" readonly value="' + E(res.link) + '" style="width:100%;box-sizing:border-box;margin-top:6px;font-size:11.5px;padding:6px 8px;border:1px solid rgba(16,63,57,.2);border-radius:8px" onclick="this.select()">';
      toastS(ok ? 'Sign-in link copied' : 'Link ready to copy');
    } catch (e) { S.sheet.link = 'Could not make a link: ' + E(String((e && e.message) || e).slice(0, 110)); }
    renderSheet();
  }
  async function setEmail() {
    var x = personBy(S.sheet.key); if (!x || !x.id || S.busy) return;
    var inp = document.getElementById('w131em'); var em = lower(inp && inp.value);
    S.sheet.email = em;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { sheetErr('Type a valid email.'); return; }
    S.busy = true;
    try {
      await invoke({ action: 'set_email', member_id: Number(x.id), email: em });
      toastS('Email saved; ' + first(x.name) + ' can be invited now');
      S.sheet.key = em; S.sheet.email = ''; S.busy = false;
      await afterChange(em);
    } catch (e) { S.busy = false; sheetErr('Could not save it: ' + String((e && e.message) || e).slice(0, 120)); }
  }
  async function removeGo() {
    var x = personBy(S.sheet.key); if (!x || S.busy) return;
    S.busy = true;
    try {
      var res = await invoke({ action: 'remove', email: x.email });
      toastS('Removed from the Hub' + (res.auth_deleted ? ' and signed out everywhere' : ''));
      S.sheet.rm = false; S.busy = false;
      await afterChange(x.email);
    } catch (e) { S.busy = false; sheetErr('Could not remove them: ' + String((e && e.message) || e).slice(0, 120)); }
  }
  function renderSheetKeepErr() { var e = document.getElementById('w131err'); var m = e ? e.textContent : ''; renderSheet(); if (m) sheetErr(m); }
