
  /* ---------- sheets ---------- */
  function sheetEl() { var el = document.getElementById('w127sheet'); if (!el) { el = document.createElement('div'); el.id = 'w127sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.appendChild(el); } return el; }
  function openSheet(kind, kicker, title, body, foot) {
    var el = sheetEl();
    el.innerHTML = '<div class="bk" data-w127close="1"></div><div class="pane"><div class="ph"><div><div class="kk">' + E(kicker) + '</div><h2>' + E(title) + '</h2></div><span class="sp"></span><button type="button" class="xb" data-w127close="1" aria-label="Close">' + I('x') + '</button></div><div class="pb">' + body + '</div>' + (foot ? '<div class="pf">' + foot + '</div>' : '') + '</div>';
    el.classList.add('on'); A.sheet = kind;
  }
  function closeSheet() { var el = document.getElementById('w127sheet'); if (el) { el.classList.remove('on'); el.innerHTML = ''; } A.sheet = null; }
  function sheetErr(m) { var e = document.querySelector('#w127sheet .err'); if (e) e.textContent = m || ''; }
  async function logChange(type, id, field, oldV, newV) { try { await db.from('change_log').insert({ entity_type: type, entity_id: String(id), field: field, old_value: oldV == null ? null : String(oldV).slice(0, 500), new_value: newV == null ? null : String(newV).slice(0, 500), changed_by: actor() }); } catch (e) { /* audit only */ } }

  function pagesTags(p, lead) {
    return groupsWithNew().map(function (g) {
      var tags = g[1].map(function (t) {
        var v = valueOf(p, t);
        if (v === 'all' || p.tier === 'admin') return '<span>' + (LOCK[t] ? I('lock') : '') + E(labelOf(t)) + '</span>';
        if (v === 'lead') return lead || p.tier === 'leader' ? '<span>' + (LOCK[t] ? I('lock') : '') + E(labelOf(t)) + '</span>' : '<span class="lead" title="Only for the profile\'s leads">' + E(labelOf(t)) + ' (leads)</span>';
        if (v === undefined) return '<span class="lead" title="Not decided yet">' + E(labelOf(t)) + ' (not decided)</span>';
        return '<span class="off">' + E(labelOf(t)) + '</span>';
      }).join('');
      return '<div class="grp"><small>' + E(g[0]) + '</small><div class="w127tags">' + tags + '</div></div>';
    }).join('');
  }
  function openProfile(key) {
    var p = A.byKey[key]; if (!p) return;
    A.cache = A.cache || people();
    var hs = holders(key), pr = proposed(key), team = isTeam(p);
    var locks = Object.keys(LOCK).filter(function (t) { var v = valueOf(p, t); return p.tier === 'admin' || v === 'all' || v === 'lead'; });
    var body = '<p>' + E(p.summary || '') + '</p>'
      + '<div><h4>What it lets you do</h4><ul class="w127can" style="--c:' + E(p.color || GREEN) + '">' + (p.can || []).map(function (c) { return '<li>' + I('check') + '<span>' + E(c) + '</span></li>'; }).join('') + '</ul>' + (team && p.lead_note ? '<p style="margin-top:10px;color:#5c5a56;font-size:13px">' + E(p.lead_note) + '</p>' : '') + '</div>'
      + '<div><h4>Its pages</h4>' + pagesTags(p, false) + '<p style="font-size:12.5px;color:#5c5a56">Dashed pages are not included' + (team ? '; gold ones are for the profile\'s leads' : '') + '. ' + I('lock') + ' means the database enforces it too.</p></div>'
      + (locks.length ? '<div><h4>What the database adds</h4>' + locks.map(function (t) { return '<p style="font-size:13px;margin:0 0 6px"><b>' + E(labelOf(t)) + ':</b> ' + E(LOCK[t]) + '</p>'; }).join('') + '</div>' : '')
      + '<div><h4>Who has it</h4><p>' + (hs.length ? E(listJoin(hs.map(function (x) { return x.name + (team && x.role === 'leader' ? ' (lead)' : ''); }))) + '.' : 'Nobody yet.') + (pr.length ? ' Proposed for ' + E(listJoin(pr.map(function (x) { return x.name; }))) + '.' : '') + '</p></div>';
    var foot = (amAdmin() ? '<a class="w127btn ghost sm" data-w127pedit="' + E(key) + '">' + I('pen') + 'Edit the words</a>' : '') + '<span class="sp"></span><a class="w127btn sm" data-w127close="1">Close</a>';
    openSheet('profile', 'Access profile', p.label, body, foot);
  }
  function openEdit(key) {
    var p = A.byKey[key]; if (!p || !amAdmin()) return;
    var body = '<form data-w127form="' + E(key) + '" onsubmit="return false">'
      + '<label>Name<input type="text" name="label" value="' + E(p.label) + '" maxlength="60"></label>'
      + '<label style="margin-top:12px">Who it is for<input type="text" name="summary" value="' + E(p.summary || '') + '" maxlength="220"></label>'
      + '<label style="margin-top:12px">What it lets you do <small style="font-weight:500;color:var(--wa-muted)">one line each, the first five show on the card</small><textarea name="can">' + E((p.can || []).join('\n')) + '</textarea></label>'
      + (isTeam(p) ? '<label style="margin-top:12px">What a lead adds<textarea name="lead_note" style="min-height:80px">' + E(p.lead_note || '') + '</textarea></label>' : '')
      + '<p style="font-size:12.5px;color:#5c5a56;margin-top:12px">The pages themselves are set in the table: click a cell to change it.</p><div class="err"></div></form>';
    openSheet('edit', 'Edit the words', p.label, body, '<a class="w127btn ghost sm" data-w127close="1">Cancel</a><span class="sp"></span><a class="w127btn sm" data-w127psave="' + E(key) + '">' + I('check') + 'Save</a>');
  }
  async function saveEdit(key) {
    var f = document.querySelector('#w127sheet form[data-w127form]'); if (!f || A.busy) return;
    var label = String(f.label.value || '').trim(); if (!label) { sheetErr('Give the profile a name.'); return; }
    var patch = { label: label, summary: String(f.summary.value || '').trim(), can: String(f.can.value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 12), updated_by: myEmail(), updated_at: new Date().toISOString() };
    if (f.lead_note) patch.lead_note = String(f.lead_note.value || '').trim();
    A.busy = true;
    try {
      var r = await db.from('hub_access_profiles').update(patch).eq('key', key);
      if (r && r.error) throw r.error;
      Object.assign(A.byKey[key], patch);
      logChange('access_profile', key, 'words', null, label);
      closeSheet(); toastS('Saved'); await load(true); paint();
    } catch (e) { sheetErr('Could not save it: ' + ((e && e.message) || 'try again')); }
    A.busy = false;
  }

  /* the table: click a cell to cycle it; save for everyone */
  function cycle(key, tab) {
    var p = A.byKey[key]; if (!p || !amAdmin() || p.tier === 'admin') return;
    var cur = cellVal(p, tab), order = isTeam(p) ? ['all', 'lead', 'none'] : ['all', 'none'];
    var i = order.indexOf(cur), next = cur === undefined ? 'all' : order[(i + 1) % order.length];
    A.edits[key] = A.edits[key] || {};
    if (next === valueOf(p, tab)) delete A.edits[key][tab]; else A.edits[key][tab] = next;
    if (!Object.keys(A.edits[key]).length) delete A.edits[key];
    paint();
  }
  async function saveMatrix() {
    if (A.busy || !amAdmin()) return;
    var keys = Object.keys(A.edits); if (!keys.length) return;
    A.busy = true;
    try {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i], p = A.byKey[k], ed = A.edits[k], next = Object.assign({}, p.pages, ed);
        var r = await db.from('hub_access_profiles').update({ pages: next, updated_by: myEmail(), updated_at: new Date().toISOString() }).eq('key', k);
        if (r && r.error) throw r.error;
        p.pages = next;
        logChange('access_profile', k, 'pages', null, Object.keys(ed).map(function (t) { return labelOf(t) + ': ' + (ed[t] === 'all' ? 'everyone' : ed[t] === 'lead' ? 'leads' : 'nobody'); }).join('; '));
      }
      A.edits = {};
      await db.from('hub_access_settings').update({ reviewed_at: new Date().toISOString(), reviewed_by: myEmail(), updated_by: myEmail(), updated_at: new Date().toISOString() }).eq('id', 1);
      toastS('Saved. People see it the next time they open the Hub.');
      await load(true); enforce(); paint();
    } catch (e) { toastS('Could not save the changes'); }
    A.busy = false;
  }

  /* apply the proposal to one person or everyone */
  function openApply(list) {
    list = (list || []).filter(function (x) { return x && x.sug && x.hasRow && !x.same; });
    if (!list.length) { toastS('Nothing to apply'); return; }
    var auto = (A.settings || {}).auto_profile;
    var body = '<p>' + (list.length === 1 ? E(list[0].name) + ' moves' : plural(list.length, 'person moves', 'people move')) + ' to the proposed profile. They see the change the next time they open the Hub. You can change anyone back in People and access.</p>'
      + '<div class="chg">' + list.map(function (x) {
        var g = x.gain.map(labelOf), l = x.lose.map(labelOf);
        return '<div><b>' + E(x.name) + '</b> \u2192 ' + E(profileName(x.sug.key, x.sug.lead)) + (x.row && handPicked(x.row) ? ' <span style="color:#5c5a56">(replaces hand-picked pages)</span>' : '') + '<br><span class="w127diff">' + (g.length ? '<span class="g">Gains ' + E(listJoin(g)) + '.</span> ' : '') + (l.length ? '<span class="l">Loses ' + E(listJoin(l)) + '.</span>' : '') + (!g.length && !l.length ? '<span class="s">Same pages as today.</span>' : '') + '</span></div>';
      }).join('') + '</div>'
      + (auto ? '' : '<label class="chk"><input type="checkbox" name="auto" checked> Also give new people their team\'s profile automatically when they join</label>')
      + '<div class="err"></div>';
    A.applyList = list;
    openSheet('apply', 'Apply the proposal', list.length === 1 ? list[0].name : plural(list.length, 'person', 'people'), body, '<a class="w127btn ghost sm" data-w127close="1">Cancel</a><span class="sp"></span><a class="w127btn gold sm" data-w127doapply="1">' + I('check') + 'Apply to ' + plural(list.length, 'person', 'people') + '</a>');
  }
  async function doApply() {
    var list = A.applyList || []; if (!list.length || A.busy || !amAdmin()) return;
    var autoBox = document.querySelector('#w127sheet input[name=auto]');
    var btn = document.querySelector('#w127sheet [data-w127doapply]');
    A.busy = true; var done = 0, failed = [];
    for (var i = 0; i < list.length; i++) {
      var x = list[i], role = roleFor(x.sug.key, x.sug.lead);
      if (btn) btn.textContent = 'Applying ' + (i + 1) + ' of ' + list.length + '…';
      try {
        var r = await db.from('hub_roles').upsert({ email: x.email, role: role, profile: x.sug.key, tabs: null, updated_by: actor(), updated_at: new Date().toISOString() }, { onConflict: 'email' });
        if (r && r.error) throw r.error;
        logChange('hub_role', x.email, 'profile', x.assigned ? x.assigned.label : (x.row ? x.row.role : null), profileName(x.sug.key, x.sug.lead));
        done++;
      } catch (e) { failed.push(x.name); }
    }
    try {
      var patch = { applied_at: new Date().toISOString(), applied_by: myEmail(), updated_by: myEmail(), updated_at: new Date().toISOString() };
      if (autoBox && autoBox.checked) patch.auto_profile = true;
      await db.from('hub_access_settings').update(patch).eq('id', 1);
    } catch (e) { /* fine */ }
    A.busy = false;
    try { if (typeof wa40Load === 'function') await wa40Load(); } catch (e) { /* fine */ }
    await load(true);
    closeSheet(); enforce(); paint();
    try { if (typeof wa40Render === 'function') wa40Render(); } catch (e) { /* fine */ }
    toastS(failed.length ? 'Applied to ' + done + '; could not change ' + listJoin(failed) : 'Applied to ' + plural(done, 'person', 'people'));
  }
  async function setAuto(on) {
    if (!amAdmin()) return;
    try {
      var r = await db.from('hub_access_settings').update({ auto_profile: !!on, updated_by: myEmail(), updated_at: new Date().toISOString() }).eq('id', 1);
      if (r && r.error) throw r.error;
      A.settings.auto_profile = !!on; logChange('access_profile', 'settings', 'auto_profile', String(!on), String(!!on));
      toastS(on ? 'New people now get their team\'s profile' : 'New people keep the classic access until you pick a profile');
    } catch (e) { toastS('Could not change it'); }
    paint();
  }

  /* People and access: the Access column */
  function accessCell(r) {
    if (!A.loaded || !A.profiles.length || !amAdmin()) return null;
    var row = rowOf(r.email) || { email: r.email, role: r.role || 'member' };
    var cur = row.profile && A.byKey[row.profile] && !handPicked(row) ? 'p:' + row.profile + (isTeam(A.byKey[row.profile]) && row.role === 'leader' ? ':lead' : '') : 'r:' + (row.role || 'member');
    var opts = '<optgroup label="Access profiles">';
    A.profiles.forEach(function (p) {
      opts += '<option value="p:' + E(p.key) + '"' + (cur === 'p:' + p.key ? ' selected' : '') + '>' + E(p.label) + '</option>';
      if (isTeam(p)) opts += '<option value="p:' + E(p.key) + ':lead"' + (cur === 'p:' + p.key + ':lead' ? ' selected' : '') + '>' + E(p.label) + ' (lead)</option>';
    });
    opts += '</optgroup><optgroup label="Classic roles, no profile">' + ['admin', 'leader', 'member', 'viewer'].map(function (x) { return '<option value="r:' + x + '"' + (cur === 'r:' + x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</optgroup>';
    return '<select class="w127acc" data-w127acc="' + E(r.email) + '">' + opts + '</select>';
  }
  function pagesCell(r) {
    if (!A.loaded || !A.profiles.length) return null;
    var row = rowOf(r.email); if (!row) return null;
    var st = 'font-size:12px;color:#103F39;cursor:pointer;text-decoration:underline;white-space:nowrap';
    if (handPicked(row)) return '<a data-w40t="' + E(r.email) + '" style="' + st + '">' + row.tabs.length + ' pages, hand-picked</a>' + (row.profile ? '<div class="w127mini">replaces the ' + E((A.byKey[row.profile] || {}).label || row.profile) + ' profile</div>' : '');
    var p = profileOf(row) || (row.role === 'admin' && row.profile === 'admin' ? A.byKey.admin : null);
    if (p) return '<a data-w127prof="' + E(p.key) + '" style="' + st + '">' + profilePages(p.key, row.role === 'leader', row, r.email).filter(function (t) { return t !== 'team'; }).length + ' pages</a><div class="w127mini"><a data-w40t="' + E(r.email) + '" style="cursor:pointer;text-decoration:underline">hand-pick instead</a></div>';
    return null;
  }
  async function changeAccess(email, val) {
    if (!amAdmin()) return;
    var row = rowOf(email), patch = { email: email, updated_by: actor(), updated_at: new Date().toISOString() };
    var m = /^p:([a-z0-9_-]+)(:lead)?$/.exec(val), label;
    if (m) { patch.profile = m[1]; patch.role = roleFor(m[1], !!m[2]); patch.tabs = null; label = profileName(m[1], !!m[2]); }
    else { patch.profile = null; patch.role = val.replace(/^r:/, ''); label = patch.role + ' (classic)'; }
    if (FOUNDERS.indexOf(lower(email)) >= 0 && patch.role !== 'admin') { toastS('Founders stay admins'); try { if (typeof wa40Render === 'function') wa40Render(); } catch (e) { /* fine */ } return; }
    try {
      var r = await db.from('hub_roles').upsert(patch, { onConflict: 'email' });
      if (r && r.error) throw r.error;
      logChange('hub_role', email, m ? 'profile' : 'role', row ? (row.profile || row.role) : null, label);
      toastS(email.split('@')[0] + ': ' + label);
    } catch (e) { toastS('Could not change the access'); }
    try { if (typeof wa40Load === 'function') await wa40Load(); } catch (e) { /* fine */ }
    try { if (typeof wa40Render === 'function') wa40Render(); } catch (e) { /* fine */ }
    if (lower(email) === myEmail()) enforce();
  }

  /* Your access (the profile menu) */
  function openMine() {
    var p = myProfile(), role = myRole(), lead = leadRole(role);
    var allowed = []; try { allowed = (wa40Allowed() || []).slice(); } catch (e) { allowed = []; }
    var title = p ? p.label + (isTeam(p) && role === 'leader' ? ' (lead)' : '') : (role === 'admin' ? 'Admin' : boardMode() ? 'Board member' : 'Classic access: ' + (role || 'member'));
    var admP = !p && role === 'admin' ? A.byKey.admin : null, show = p || admP;
    var body = '<p>' + (show ? E(show.summary || '') + ' ' : '') + (p ? 'This is your access profile: it decides the pages you see' + (p.tier !== 'admin' ? ', and the database follows it for the finances and the board pages' : '') + '.' : role === 'admin' ? 'You are an admin: you see every page and manage access for everyone.' : 'You have the classic access for your role. An admin can give you your team\'s profile.') + '</p>'
      + (show && show.can && show.can.length ? '<div><h4>What you can do</h4><ul class="w127can" style="--c:' + E(show.color || GREEN) + '">' + show.can.map(function (c) { return '<li>' + I('check') + '<span>' + E(c) + '</span></li>'; }).join('') + '</ul>' + (p && isTeam(p) && lead && p.lead_note ? '<p style="margin-top:10px;font-size:13px;color:#5c5a56">As a lead: ' + E(p.lead_note.replace(/^A lead also gets /, '')) + '</p>' : '') + '</div>' : '')
      + '<div><h4>Your pages</h4>' + groupsWithNew().map(function (g) {
        var ts = g[1].filter(function (t) { return allowed.indexOf(t) >= 0; });
        return ts.length ? '<div class="grp"><small>' + E(g[0]) + '</small><div class="w127tags">' + ts.map(function (t) { return '<span>' + (LOCK[t] ? I('lock') : '') + E(labelOf(t)) + '</span>'; }).join('') + '</div></div>' : '';
      }).join('') + '</div>';
    var out = p ? knownTabs().filter(function (t) { return t !== 'team' && allowed.indexOf(t) < 0; }) : [];
    if (out.length) body += '<div><h4>Not in your profile</h4><div class="w127tags">' + out.map(function (t) { return '<span class="off">' + E(labelOf(t)) + '</span>'; }).join('') + '</div></div>';
    var foot = (staffOk() && role !== 'admin' ? '<a class="w127btn ghost sm" data-w127ask="1">' + I('key') + 'Request more access</a>' : '') + (amAdmin() ? '<a class="w127btn ghost sm" data-w127go="#adminpanel/access">' + I('shield') + 'All the profiles</a>' : '') + '<span class="sp"></span><a class="w127btn sm" data-w127close="1">Close</a>';
    openSheet('mine', 'Your access', title, body, foot);
  }
