
  /* ---------- Profiles: the nine profiles, what each opens, who has it ---------- */
  function tierChip(p) {
    if (p.tier === 'admin') return '<span class="w131tier admin">Everything</span>';
    if (p.tier === 'leader') return '<span class="w131tier exec">All but Admin</span>';
    if (p.tier === 'viewer') return '<span class="w131tier board">Board</span>';
    return '<span class="w131tier">Team, lead option</span>';
  }
  function holders(key) { return people().filter(function (x) { return x.assigned && x.assigned.key === key && x.status !== 'removed'; }); }
  function pagesCount(p) {
    var mem = pagesOfProfile(p.key, false, null, 'x@welfareavenue.com'), lead = isTeamP(p) ? pagesOfProfile(p.key, true, null, 'x@welfareavenue.com').filter(function (t) { return mem.indexOf(t) < 0; }) : [];
    return { mem: mem.length, lead: lead.length };
  }
  function profilesHtml() {
    var u = undecided(), s = S.settings || {};
    var h = '<div class="w131intro"><p>A profile is a set of pages. Everyone on the Hub has one: their team’s (with a <b>Lead</b> switch for team leads), <b>Board member</b> for directors, <b>Executive</b> for the leadership team or <b>Admin</b> for the people who run the Hub. Open a profile to change its pages; everyone on it sees the change the next time they open the Hub.</p>'
      + '<label><button type="button" class="w131sw' + (s.auto_profile ? ' on' : '') + '" data-w131auto="1" role="switch" aria-checked="' + !!s.auto_profile + '" aria-label="New people get their team’s profile"></button>New people get their team’s profile automatically</label></div>';
    if (u.length) h += '<div class="w131box w131todo" style="margin-bottom:16px"><div class="w131do warn"><span class="ic">' + I('alert') + '</span><div class="tx"><b>' + plural(u.length, 'page has', 'pages have') + ' no decision yet</b><small>' + E(listJoin(u.map(labelOf))) + '. Until you decide, ' + (u.length === 1 ? 'it follows its' : 'they follow their') + ' built-in access.</small></div><div class="ac"><a class="w131btn sm gold" data-w131decide="1">Decide</a></div></div></div>';
    h += '<div class="w131pgrid">' + S.profiles.map(function (p) {
      var hs = holders(p.key), n = pagesCount(p);
      return '<button type="button" class="w131box w131pc" data-w131prof="' + E(p.key) + '" style="--c:' + E(p.color || GREEN) + '"><span class="bar"></span><span class="in"><span class="hd"><h3>' + E(p.label) + '</h3>' + tierChip(p) + '</span>'
        + '<p>' + E(p.summary || '') + '</p>'
        + '<span class="nums"><span>' + (p.tier === 'admin' ? 'Every page' : n.mem + ' pages') + '</span>' + (n.lead ? '<span>+' + n.lead + ' for leads</span>' : '') + '<span>' + plural(hs.length, 'person', 'people') + '</span></span></span></button>';
    }).join('') + '</div>';
    h += '<div class="w131sec"><h2>Compare the profiles</h2><span>Every page, profile by profile. A lock means the database enforces it too. Open a profile above to change it.</span></div>' + matrixHtml()
      + '<div class="w131box w131phone"><p class="w131empty">The comparison needs a wider screen. Open a profile above to see and change its pages.</p></div>';
    return h;
  }
  function matrixHtml() {
    var ps = S.profiles, SHORT = { marketing: 'Marketing', fundraising: 'Fundraising', progdev: 'Program Dev.', opsmtl: 'Montreal ops', opsto: 'Toronto ops', hr: 'HR & People', board: 'Board', executive: 'Executive', admin: 'Admin' };
    var h = '<div class="w131mx"><table><thead><tr><th class="pg">Page</th>' + ps.map(function (p) { return '<th style="--c:' + E(p.color || GREEN) + '"><i></i>' + E(SHORT[p.key] || p.label) + '</th>'; }).join('') + '</tr></thead><tbody>';
    groupsWithNew().forEach(function (g) {
      h += '<tr class="gp"><td class="pg" colspan="' + (ps.length + 1) + '">' + E(g[0]) + '</td></tr>';
      g[1].forEach(function (t) {
        h += '<tr><td class="pg">' + E(labelOf(t)) + (LOCK[t] ? '<span class="lk" title="' + E(LOCK[t]) + '">' + I('lock') + '</span>' : '') + '</td>' + ps.map(function (p) {
          var v = p.tier === 'admin' ? 'all' : valueOf(p, t);
          return '<td>' + (v === 'all' ? '<span class="all" title="Everyone on it"></span>' : v === 'lead' ? '<span class="lead">Leads</span>' : v === 'none' ? '<span class="none" title="Nobody"></span>' : '<span class="und" title="Not decided yet">?</span>') + '</td>';
        }).join('') + '</tr>';
      });
    });
    return h + '</tbody></table></div>';
  }

  /* ---------- the profile sheet: its pages, its people, its words ---------- */
  function openProfile(key) { S.sheet = { kind: 'profile', key: key }; S.ptab = 'pages'; S.pedits = {}; renderSheet(); }
  function editVal(p, t) { var e = S.pedits[t]; return e !== undefined ? e : (p.tier === 'admin' ? 'all' : valueOf(p, t)); }
  function profileSheet() {
    var p = S.byKey[S.sheet.key]; if (!p) return null;
    var team = isTeamP(p), hs = holders(p.key), n = Object.keys(S.pedits).length, body = '';
    body += '<div class="w131stabs" role="tablist">' + [['pages', 'Pages'], ['people', 'People (' + hs.length + ')'], ['words', 'What it says']].map(function (t) { return '<a data-w131ptab="' + t[0] + '"' + (S.ptab === t[0] ? ' class="on"' : '') + '>' + E(t[1]) + '</a>'; }).join('') + '</div>';
    if (S.ptab === 'pages') {
      if (p.tier === 'admin') body += '<div class="sec"><p>Admin opens every page, including Admin itself, and only admins can change access. There is nothing to set here.</p></div>';
      else {
        body += '<div class="sec"><p style="font-size:13px">For each page: <b>Everyone</b> on the profile' + (team ? ', only its <b>Leads</b>' : '') + ', or <b>Nobody</b>. A lock means the database enforces it too.</p><div class="w131ed">' + groupsWithNew().map(function (g) {
          var rows = g[1].filter(function (t) { return t !== 'adminpanel'; }).map(function (t) {
            var v = editVal(p, t), ch = S.pedits[t] !== undefined;
            var opts = team ? [['all', 'Everyone'], ['lead', 'Leads'], ['none', 'Nobody']] : [['all', 'Everyone'], ['none', 'Nobody']];
            return '<div class="w131er' + (ch ? ' ch' : '') + '"><span class="lb">' + E(labelOf(t)) + (LOCK[t] ? ' ' + I('lock') : '') + (v === undefined ? '<small>Not decided yet: follows its built-in access</small>' : (LOCK[t] ? '<small>' + E(LOCK[t]) + '</small>' : '')) + '</span><span class="w131seg3" role="group" aria-label="' + E(labelOf(t)) + '">'
              + opts.map(function (o) { return '<button type="button" data-w131cell="' + E(t) + '|' + o[0] + '" class="' + (v === o[0] ? 'on ' + o[0] : '') + '" aria-pressed="' + (v === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</span></div>';
          }).join('');
          return rows ? '<div class="gl">' + E(g[0]) + '</div>' + rows : '';
        }).join('') + '</div></div>';
      }
    } else if (S.ptab === 'people') {
      body += '<div class="sec">' + (hs.length ? hs.map(function (x) { return '<button type="button" class="w131p" data-w131open="' + E(pkey(x)) + '" style="padding:8px 0;grid-template-columns:40px minmax(0,1fr) auto 20px">' + avatar(x) + '<span class="nm"><b>' + E(x.name) + '</b><span>' + E([x.title, teamLabel(x.dept)].filter(Boolean).join(' · ')) + '</span></span><span>' + (x.lead ? '<span class="w131tier exec">Lead</span>' : '') + '</span><span class="chv">' + I('chev') + '</span></button>'; }).join('') : '<p class="w131mut">Nobody has it yet.</p>') + '</div>';
      var sug = people().filter(function (x) { return x.sug && x.sug.key === p.key && !x.same && x.row && x.status !== 'removed'; });
      if (sug.length) body += '<div class="sec"><h4>Suggested for</h4><p>' + E(listJoin(sug.map(function (x) { return x.name; }))) + '</p><div class="row"><a class="w131btn sm" data-w131apply="prof:' + E(p.key) + '">' + I('check') + 'Give it to ' + (sug.length === 1 ? first(sug[0].name) : 'all ' + sug.length) + '</a></div></div>';
    } else {
      body += '<div class="sec"><form data-w131words="1" onsubmit="return false"><label class="f">Name<input type="text" name="label" maxlength="60" value="' + E(p.label) + '"></label>'
        + '<label class="f">Who it is for<input type="text" name="summary" maxlength="220" value="' + E(p.summary || '') + '"></label>'
        + '<label class="f">What it lets you do (one line each)<textarea name="can">' + E((p.can || []).join('\n')) + '</textarea></label>'
        + (team ? '<label class="f">What a lead adds<textarea name="lead_note" style="min-height:80px">' + E(p.lead_note || '') + '</textarea></label>' : '') + '</form></div>';
    }
    body += '<div class="err" id="w131err"></div>';
    var foot = S.ptab === 'pages' && p.tier !== 'admin'
      ? (n ? '<a class="w131btn sm ghost" data-w131pundo="1">' + I('undo') + 'Undo</a>' : '') + '<span class="sp"></span><a class="w131btn' + (n ? '' : ' off') + '" data-w131psave="1">' + I('check') + (n ? 'Save ' + plural(n, 'change', 'changes') : 'No changes') + '</a>'
      : S.ptab === 'words' ? '<span class="sp"></span><a class="w131btn" data-w131wsave="1">' + I('check') + 'Save the words</a>' : '<span class="sp"></span><a class="w131btn ghost" data-w131close="1">Close</a>';
    return { kicker: 'Access profile', title: p.label, sub: p.summary || '', body: body, foot: foot };
  }
  function cell(t, v) {
    var p = S.byKey[S.sheet && S.sheet.key]; if (!p || p.tier === 'admin') return;
    if (v === valueOf(p, t)) delete S.pedits[t]; else S.pedits[t] = v;
    renderSheet();
  }
  async function savePages() {
    var p = S.byKey[S.sheet && S.sheet.key]; if (!p || S.busy) return;
    var ed = S.pedits, keys = Object.keys(ed); if (!keys.length) return;
    S.busy = true;
    try {
      var next = Object.assign({}, p.pages, ed);
      var r = await db.from('hub_access_profiles').update({ pages: next, updated_by: myEmail(), updated_at: new Date().toISOString() }).eq('key', p.key);
      if (r && r.error) throw r.error;
      logChange('access_profile', p.key, 'pages', null, keys.map(function (t) { return labelOf(t) + ': ' + (ed[t] === 'all' ? 'everyone' : ed[t] === 'lead' ? 'leads' : 'nobody'); }).join('; '));
      try { await db.from('hub_access_settings').update({ reviewed_at: new Date().toISOString(), reviewed_by: myEmail(), updated_by: myEmail(), updated_at: new Date().toISOString() }).eq('id', 1); } catch (e) { /* fine */ }
      S.pedits = {}; S.busy = false;
      toastS('Saved. Everyone on ' + p.label + ' sees it the next time they open the Hub.');
      await afterChange(myEmail());
    } catch (e) { S.busy = false; sheetErr('Could not save it: ' + ((e && e.message) || 'try again')); }
  }
  async function saveWords() {
    var p = S.byKey[S.sheet && S.sheet.key], f = document.querySelector('#w131sheet form[data-w131words]'); if (!p || !f || S.busy) return;
    var label = String(f.label.value || '').trim(); if (!label) { sheetErr('Give the profile a name.'); return; }
    var patch = { label: label, summary: String(f.summary.value || '').trim(), can: String(f.can.value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 12), updated_by: myEmail(), updated_at: new Date().toISOString() };
    if (f.lead_note) patch.lead_note = String(f.lead_note.value || '').trim();
    S.busy = true;
    try {
      var r = await db.from('hub_access_profiles').update(patch).eq('key', p.key);
      if (r && r.error) throw r.error;
      logChange('access_profile', p.key, 'words', p.label, label);
      S.busy = false; toastS('Saved'); await afterChange(myEmail());
    } catch (e) { S.busy = false; sheetErr('Could not save it: ' + ((e && e.message) || 'try again')); }
  }
  async function setAuto(on) {
    try {
      var r = await db.from('hub_access_settings').update({ auto_profile: !!on, updated_by: myEmail(), updated_at: new Date().toISOString() }).eq('id', 1);
      if (r && r.error) throw r.error;
      S.settings.auto_profile = !!on; logChange('access_profile', 'settings', 'auto_profile', String(!on), String(!!on));
      toastS(on ? 'New people now get their team’s profile' : 'New people wait for you to pick a profile');
    } catch (e) { toastS('Could not change it'); }
    paint();
  }

  /* ---------- new pages to decide: one sheet, every profile ---------- */
  function openDecide() { S.sheet = { kind: 'decide' }; S.dedits = {}; renderSheet(); }
  function decideSheet() {
    var u = undecided(); if (!u.length && !Object.keys(S.dedits || {}).length) return { kicker: 'New pages', title: 'Nothing to decide', sub: '', body: '<div class="sec"><p>Every page has a decision in every profile.</p></div>', foot: '<span class="sp"></span><a class="w131btn ghost" data-w131close="1">Close</a>' };
    var body = '<div class="sec"><p style="font-size:13px">A release added ' + (u.length === 1 ? 'this page' : 'these pages') + '. Decide who sees ' + (u.length === 1 ? 'it' : 'them') + ' in each profile; until then ' + (u.length === 1 ? 'it follows its' : 'they follow their') + ' built-in access.</p></div>';
    u.forEach(function (t) {
      body += '<div class="sec"><h4>' + E(labelOf(t)) + '</h4><div class="w131ed">' + S.profiles.filter(function (p) { return p.tier !== 'admin'; }).map(function (p) {
        var k = p.key + '|' + t, v = (S.dedits || {})[k] !== undefined ? S.dedits[k] : valueOf(p, t), team = isTeamP(p);
        var opts = team ? [['all', 'Everyone'], ['lead', 'Leads'], ['none', 'Nobody']] : [['all', 'Everyone'], ['none', 'Nobody']];
        return '<div class="w131er"><span class="lb">' + E(p.label) + '</span><span class="w131seg3">' + opts.map(function (o) { return '<button type="button" data-w131dcell="' + E(k) + '|' + o[0] + '" class="' + (v === o[0] ? 'on ' + o[0] : '') + '">' + o[1] + '</button>'; }).join('') + '</span></div>';
      }).join('') + '</div></div>';
    });
    var n = Object.keys(S.dedits || {}).length;
    return { kicker: 'New pages', title: plural(u.length, 'page to decide', 'pages to decide'), sub: '', body: body + '<div class="err" id="w131err"></div>', foot: '<span class="sp"></span><a class="w131btn' + (n ? '' : ' off') + '" data-w131dsave="1">' + I('check') + (n ? 'Save ' + plural(n, 'decision', 'decisions') : 'Pick above') + '</a>' };
  }
  async function saveDecide() {
    var ed = S.dedits || {}, keys = Object.keys(ed); if (!keys.length || S.busy) return;
    var byP = {}; keys.forEach(function (k) { var a = k.split('|'); (byP[a[0]] = byP[a[0]] || {})[a[1]] = ed[k]; });
    S.busy = true;
    try {
      for (var pk in byP) {
        var p = S.byKey[pk]; if (!p) continue;
        var r = await db.from('hub_access_profiles').update({ pages: Object.assign({}, p.pages, byP[pk]), updated_by: myEmail(), updated_at: new Date().toISOString() }).eq('key', pk);
        if (r && r.error) throw r.error;
        logChange('access_profile', pk, 'pages', null, Object.keys(byP[pk]).map(function (t) { return labelOf(t) + ': ' + byP[pk][t]; }).join('; '));
      }
      S.dedits = {}; S.busy = false; toastS('Saved'); closeSheet(); await afterChange(myEmail());
    } catch (e) { S.busy = false; sheetErr('Could not save it: ' + ((e && e.message) || 'try again')); }
  }

  /* ---------- give many people their suggested profile ---------- */
  function applyList(which) {
    var xs = people().filter(function (x) { return x.row && x.status !== 'removed' && x.sug && S.byKey[x.sug.key] && !x.same && !x.founder; });
    if (which === 'noprof') xs = xs.filter(function (x) { return !x.assigned && !x.hand; });
    else if (String(which).indexOf('prof:') === 0) { var k = which.slice(5); xs = xs.filter(function (x) { return x.sug.key === k; }); }
    return xs;
  }
  function openApply(which) {
    var xs = applyList(which); if (!xs.length) { toastS('Nothing to change'); return; }
    S.sheet = { kind: 'apply', which: which }; renderSheet();
  }
  function applySheet() {
    var xs = applyList(S.sheet.which);
    var body = '<div class="sec"><p>' + (xs.length === 1 ? E(xs[0].name) + ' gets' : plural(xs.length, 'person gets', 'people get')) + ' the profile suggested from the roster. They see the change the next time they open the Hub, and you can change anyone afterwards.</p></div>'
      + '<div class="sec">' + xs.map(function (x) { var nx = pagesOfProfile(x.sug.key, x.sug.lead, x.row, x.email); return '<p><b>' + E(x.name) + '</b> → ' + E(profileName(x.sug.key, x.sug.lead)) + (x.hand ? ' <span class="w131mut">(replaces hand-picked pages)</span>' : '') + '<br><span class="w131diff">' + diffText(nx, x.pages) + '</span></p>'; }).join('') + '</div>'
      + (!(S.settings || {}).auto_profile ? '<div class="sec"><label class="ck"><input type="checkbox" id="w131autoalso" checked> Also give new people their team’s profile automatically</label></div>' : '') + '<div class="err" id="w131err"></div>';
    return { kicker: 'Give the suggested profile', title: xs.length === 1 ? xs[0].name : plural(xs.length, 'person', 'people'), sub: '', body: body, foot: '<a class="w131btn ghost" data-w131close="1">Cancel</a><span class="sp"></span><a class="w131btn gold" data-w131applygo="1">' + I('check') + 'Apply to ' + plural(xs.length, 'person', 'people') + '</a>' };
  }
  async function applyGo() {
    var xs = applyList(S.sheet.which); if (!xs.length || S.busy) return;
    var also = document.getElementById('w131autoalso'), btn = document.querySelector('#w131sheet [data-w131applygo]');
    S.busy = true; var done = 0, failed = [];
    for (var i = 0; i < xs.length; i++) {
      if (btn) btn.textContent = 'Applying ' + (i + 1) + ' of ' + xs.length + '…';
      try { if (await saveProfile(xs[i], xs[i].sug.key, xs[i].sug.lead, 'suggested from the roster')) done++; else failed.push(xs[i].name); } catch (e) { failed.push(xs[i].name); }
    }
    try {
      var patch = { applied_at: new Date().toISOString(), applied_by: myEmail(), updated_by: myEmail(), updated_at: new Date().toISOString() };
      if (also && also.checked) patch.auto_profile = true;
      await db.from('hub_access_settings').update(patch).eq('id', 1);
    } catch (e) { /* fine */ }
    S.busy = false; closeSheet();
    toastS(failed.length ? 'Done for ' + done + '; could not change ' + listJoin(failed) : 'Done for ' + plural(done, 'person', 'people'));
    await afterChange(myEmail());
  }
