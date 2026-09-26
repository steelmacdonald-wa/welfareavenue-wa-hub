
  /* ---------- Invite: one person, a list, or everyone not invited yet ---------- */
  function openInvite(team) { S.sheet = { kind: 'invite', f: { name: '', email: '', dept: team || '', title: '' }, pick: null, lead: false, res: null }; renderSheet(); }
  function invPick() {
    var sh = S.sheet, tp = sh.f.dept ? teamProfile(sh.f.dept) : null;
    var key = sh.pick || (sh.f.dept === 'board' && S.byKey.board ? 'board' : (tp ? tp.key : null));
    var lead = key && isTeamP(S.byKey[key]) ? !!sh.lead : false;
    return { key: key, lead: lead };
  }
  function readInviteForm() {
    var f = S.sheet && S.sheet.f; if (!f) return;
    ['name', 'email', 'title'].forEach(function (k) { var el = document.getElementById('w131f_' + k); if (el) f[k] = el.value; });
    var d = document.getElementById('w131f_dept'); if (d) f.dept = d.value;
  }
  function inviteSheet() {
    var sh = S.sheet, f = sh.f, pk = invPick();
    if (sh.res) return { kicker: 'Invited', title: f.name, sub: f.email, body: '<div class="sec res">' + sh.res + '</div>', foot: '<a class="w131btn ghost" data-w131invnext="1">' + I('plus') + 'Invite someone else</a><span class="sp"></span><a class="w131btn" data-w131open="' + E(lower(f.email)) + '">Open their sheet</a>' };
    var body = '<div class="sec"><div class="two"><label class="f">Full name<input type="text" id="w131f_name" placeholder="First Last" value="' + E(f.name) + '" autocomplete="off"></label>'
      + '<label class="f">Email<input type="email" id="w131f_email" placeholder="name@welfareavenue.com" value="' + E(f.email) + '" autocomplete="off"></label></div>'
      + '<div class="two"><label class="f">Team<select id="w131f_dept"><option value="">Pick a team</option>' + TEAMS.map(function (d) { return '<option value="' + d + '"' + (f.dept === d ? ' selected' : '') + '>' + E(teamLabel(d)) + '</option>'; }).join('') + '</select></label>'
      + '<label class="f">Title<input type="text" id="w131f_title" placeholder="e.g. Content manager" value="' + E(f.title) + '"></label></div></div>'
      + '<div class="sec"><h4>Access profile</h4><p style="font-size:13px">' + (f.dept ? 'Their team’s profile is picked for you. Change it if they need something else.' : 'Pick their team first; their team’s profile is picked for you.') + '</p>' + pickerHtml(pk.key, pk.lead, f.dept, false)
      + (pk.key ? '<div style="margin-top:12px"><h4>What they get · ' + pagesOfProfile(pk.key, pk.lead, null, f.email || 'x@welfareavenue.com').length + ' pages</h4>' + pagesHtml(pagesOfProfile(pk.key, pk.lead, null, f.email || 'x@welfareavenue.com'), null) + '</div>' : '') + '</div>'
      + '<div class="sec"><label class="ck"><input type="checkbox" id="w131send" checked> Email them a sign-in invitation now (from hub@welfareavenue.com). They can also sign in with Google using this email straight away.</label></div><div class="err" id="w131err"></div>';
    return { kicker: 'People and access', title: 'Invite someone', sub: 'They join the roster, get the profile and a welcome.', body: body, foot: '<a class="w131btn ghost" data-w131list="1">' + I('list') + 'Invite a list instead</a><span class="sp"></span><a class="w131btn' + (pk.key ? '' : ' off') + '" data-w131invgo="1">' + I('mail') + 'Invite' + (pk.key ? ' as ' + E(profileName(pk.key, pk.lead)) : '') + '</a>' };
  }
  async function inviteGo() {
    if (S.busy) return; readInviteForm();
    var f = S.sheet.f, pk = invPick();
    var name = String(f.name || '').trim(), email = lower(f.email);
    if (!name) { sheetErr('Type their name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { sheetErr('Type a valid email.'); return; }
    if (!f.dept) { sheetErr('Pick their team.'); return; }
    if (!pk.key) { sheetErr('Pick a profile.'); return; }
    var send = !!(document.getElementById('w131send') || {}).checked;
    S.busy = true; var btn = document.querySelector('#w131sheet [data-w131invgo]'); if (btn) { btn.classList.add('off'); btn.textContent = 'Inviting…'; }
    try {
      var res = await doInvite({ name: name, email: email, title: String(f.title || '').trim(), dept: f.dept }, pk.key, pk.lead, send);
      f.name = name; f.email = email;
      S.sheet.res = '<b>' + E(name) + '</b> is on the Hub as <b>' + E(profileName(pk.key, pk.lead)) + '</b>' + (res.existed ? ' (they were already on the roster)' : '') + '.<br>' + resultHtml(res, name);
      toastS(res.email_sent ? 'Invitation emailed to ' + first(name) : first(name) + ' can sign in now; share the message or a link');
      S.busy = false; await afterChange(email);
    } catch (e) { S.busy = false; if (btn) { btn.classList.remove('off'); btn.textContent = 'Invite'; } sheetErr('Could not invite: ' + String((e && e.message) || e).slice(0, 140)); }
  }

  /* a list: paste it, check it, invite them all */
  function parseList(text) {
    var out = [], seen = {};
    String(text || '').split(/\n|;/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      var em = '', name = '', m = /<([^>]+@[^>]+)>/.exec(line);
      if (m) { em = lower(m[1]); name = line.replace(m[0], '').replace(/[",]/g, ' ').trim(); }
      else {
        var parts = line.split(/[,\t]/).map(function (s) { return s.trim(); });
        var hit = parts.filter(function (s) { return s.indexOf('@') > 0; })[0];
        if (hit) { em = lower(hit.split(/\s+/).filter(function (s) { return s.indexOf('@') > 0; })[0]); name = parts.filter(function (s) { return s !== hit; }).join(' ').trim(); }
      }
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || seen[em]) return;
      seen[em] = 1;
      out.push({ email: em, name: name || nameFromEmail(em) });
    });
    return out;
  }
  function openList() { S.sheet = { kind: 'list', step: 'paste', text: '', dept: '', rows: [], results: null }; renderSheet(); }
  function openInviteAll() {
    var ni = people().filter(function (x) { return x.status === 'notinvited' && x.roster; });
    if (!ni.length) { toastS('Everyone on the roster is invited'); return; }
    S.sheet = { kind: 'list', step: 'review', text: '', dept: '', results: null, fromRoster: true, rows: ni.map(function (x) { return { email: x.email, name: x.name, dept: x.dept, title: x.title, key: x.sug ? x.sug.key : (teamProfile(x.dept) || {}).key || '', lead: false }; }) };
    renderSheet();
  }
  function listSheet() {
    var sh = S.sheet;
    if (sh.results) {
      var okN = sh.results.filter(function (r) { return r.ok; }).length;
      return { kicker: 'Invited', title: okN + ' of ' + sh.results.length + ' invited', sub: '', body: '<div class="sec">' + sh.results.map(function (r) { return '<p><b>' + E(r.name || r.email) + '</b> ' + (r.ok ? '<span style="color:' + TEAL + ';font-weight:700">invited</span>' + (r.email_sent ? ', email sent' : ', no email') + (r.profile ? ', ' + E(r.profile) : '') : '<span style="color:' + FLAG + ';font-weight:700">not invited</span>: ' + E(r.error || 'failed')) + '</p>'; }).join('') + '</div>', foot: '<span class="sp"></span><a class="w131btn" data-w131close="1">Done</a>' };
    }
    if (sh.step === 'paste') {
      return { kicker: 'People and access', title: 'Invite a list', sub: 'One person per line: "Name, email", "Name <email>" or just the email.', body: '<div class="sec"><label class="f">The list<textarea id="w131paste" placeholder="Amina Diallo, amina.diallo@welfareavenue.com&#10;Jordan Lee <jordan.lee@welfareavenue.com>&#10;sam.ortiz@welfareavenue.com">' + E(sh.text) + '</textarea></label>'
        + '<label class="f">Their team<select id="w131ldept"><option value="">Pick a team</option>' + TEAMS.map(function (d) { return '<option value="' + d + '"' + (sh.dept === d ? ' selected' : '') + '>' + E(teamLabel(d)) + '</option>'; }).join('') + '</select></label><p class="w131mut" style="font-size:12.5px">You can change the team and profile for each person on the next step.</p></div><div class="err" id="w131err"></div>',
        foot: '<a class="w131btn ghost" data-w131new="1">Just one person</a><span class="sp"></span><a class="w131btn" data-w131lreview="1">' + I('arrow') + 'Check the list</a>' };
    }
    var body = '<div class="sec"><p style="font-size:13px">' + (sh.fromRoster ? 'Everyone on the roster who is not invited yet, with the profile of their team.' : 'Check each person’s team and profile.') + '</p>' + sh.rows.map(function (r, i) {
      var opts = '<option value="">No profile</option>' + S.profiles.map(function (p) { return '<option value="' + E(p.key) + '"' + (r.key === p.key && !r.lead ? ' selected' : '') + '>' + E(p.label) + '</option>' + (isTeamP(p) ? '<option value="' + E(p.key) + ':lead"' + (r.key === p.key && r.lead ? ' selected' : '') + '>' + E(p.label) + ' (lead)</option>' : ''); }).join('');
      return '<div class="w131er" style="flex-wrap:wrap"><span class="lb">' + E(r.name) + '<small>' + E(r.email) + '</small></span>'
        + '<select data-w131lrow="' + i + '|dept" style="font-size:12.5px;padding:6px 8px;border-radius:9px;border:1px solid rgba(16,63,57,.18);max-width:100%">' + '<option value="">Team</option>' + TEAMS.map(function (d) { return '<option value="' + d + '"' + (r.dept === d ? ' selected' : '') + '>' + E(teamLabel(d)) + '</option>'; }).join('') + '</select>'
        + '<select data-w131lrow="' + i + '|key" style="font-size:12.5px;padding:6px 8px;border-radius:9px;border:1px solid rgba(16,63,57,.18);max-width:100%">' + opts + '</select></div>';
    }).join('') + '</div><div class="sec"><label class="ck"><input type="checkbox" id="w131send" checked> Email each of them a sign-in invitation now</label></div><div class="err" id="w131err"></div>';
    var ready = sh.rows.filter(function (r) { return r.dept && r.key; }).length;
    return { kicker: 'People and access', title: plural(sh.rows.length, 'person to invite', 'people to invite'), sub: '', body: body, foot: (sh.fromRoster ? '' : '<a class="w131btn ghost" data-w131lback="1">Back</a>') + '<span class="sp"></span><a class="w131btn' + (ready ? '' : ' off') + '" data-w131lgo="1">' + I('mail') + 'Invite ' + (ready === sh.rows.length ? plural(ready, 'person', 'people') : ready + ' of ' + sh.rows.length) + '</a>' };
  }
  function listReview() {
    var ta = document.getElementById('w131paste'), dsel = document.getElementById('w131ldept');
    var sh = S.sheet; sh.text = ta ? ta.value : sh.text; sh.dept = dsel ? dsel.value : sh.dept;
    var ppl = parseList(sh.text);
    if (!ppl.length) { sheetErr('No emails found in the list.'); return; }
    var tp = sh.dept ? teamProfile(sh.dept) : null;
    sh.rows = ppl.map(function (p) {
      var x = personBy(p.email), d = (x && x.dept) || sh.dept, t = d ? teamProfile(d) : tp;
      return { email: p.email, name: (x && x.name) || p.name, dept: d, title: x ? x.title : '', key: d === 'board' && S.byKey.board ? 'board' : (t ? t.key : ''), lead: false };
    });
    sh.step = 'review'; renderSheet();
  }
  async function listGo() {
    var sh = S.sheet; if (S.busy) return;
    var rows = sh.rows.filter(function (r) { return r.dept && r.key; }); if (!rows.length) return;
    var send = !!(document.getElementById('w131send') || {}).checked, btn = document.querySelector('#w131sheet [data-w131lgo]');
    S.busy = true; if (btn) { btn.classList.add('off'); btn.textContent = 'Inviting ' + rows.length + '…'; }
    var results = [];
    try {
      var res = await invoke({ action: 'bulk_invite', people: rows.map(function (r) { return { name: r.name, email: r.email, department: r.dept, role_title: r.title || '', hub_role: roleFor(r.key, r.lead), send_email: send }; }) });
      var list = Array.isArray(res.results) ? res.results : [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i], out = list.filter(function (o) { return lower(o.email) === r.email; })[0] || { ok: false, email: r.email, error: 'no result' };
        if (out.ok) {
          try {
            var u = await db.from('hub_roles').upsert({ email: r.email, role: roleFor(r.key, r.lead), profile: r.key, tabs: null, updated_by: actor(), updated_at: new Date().toISOString() }, { onConflict: 'email' });
            if (u && u.error) throw u.error;
            logChange('hub_role', r.email, 'profile', null, profileName(r.key, r.lead) + ' (invited in a list)');
            out.profile = profileName(r.key, r.lead);
          } catch (e) { out.profile = 'profile not saved'; }
        }
        out.name = r.name; results.push(out);
      }
    } catch (e) { S.busy = false; if (btn) { btn.classList.remove('off'); btn.textContent = 'Invite'; } sheetErr('Could not invite them: ' + String((e && e.message) || e).slice(0, 140)); return; }
    S.busy = false; sh.results = results;
    toastS(results.filter(function (r) { return r.ok; }).length + ' invited');
    await afterChange(myEmail());
  }
