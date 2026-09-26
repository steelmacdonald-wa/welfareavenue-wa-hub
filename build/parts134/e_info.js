
  /* ---------- Important info: everyone sees the list; a password is shown only to the people an admin approved ----------
     Steel (26/09/26): "By default the important info section with passwords should be there for everyone and if they
     want to see a password they must request it". The database no longer hands the password column to the page:
     info_secret() returns it to admins, to whoever added the login and to approved people (and logs the view),
     info_request() asks, info_decide() and info_grant() are the admin's answers (wa134_passwords). */
  var PW = { acc: [], shown: {}, asking: null, open: {} };
  function amAdmin() { try { return typeof WA40_MINE !== 'undefined' && !!WA40_MINE && WA40_MINE.role === 'admin'; } catch (e) { return false; } }
  function myEmail() { try { return String((USER && USER.email) || '').toLowerCase(); } catch (e) { return ''; } }
  function nameOf(email) {
    var e = String(email || '').toLowerCase();
    try { var m = (DB_MEMBERS || []).filter(function (x) { return String(x.email || '').toLowerCase() === e; })[0]; if (m) return m.name; } catch (x) { /* fine */ }
    return e.split('@')[0] || e;
  }
  function ago(iso) {
    var d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
  }
  function rpcInfo(fn, args) { return Promise.resolve(db.rpc(fn, args || {})).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; }); }
  function errMsg(e) { var m = String((e && (e.message || e.details)) || e || ''); return m.replace(/^.*?ERROR:\s*/, '') || 'Something went wrong.'; }
  function statusOf(linkId) {
    var me = myEmail();
    var a = PW.acc.filter(function (x) { return String(x.link_id) === String(linkId) && String(x.email).toLowerCase() === me; })[0];
    return a ? a.status : '';
  }
  function canSee(i) { return amAdmin() || statusOf(i.id) === 'granted'; }

  async function renderInfo134() {
    var body = document.getElementById('infoBody');
    if (!body) return;
    if (!isStaff()) { body.innerHTML = '<p class="read">This page is available to Welfare Avenue staff accounts only.</p>'; return; }
    var r = await db.from('info_links').select('id,kind,label,url,username,department,notes,sort,added_by,updated_at').order('kind').order('sort').order('label');
    if (r.error) { body.innerHTML = '<p class="read">Could not load. Refresh to retry.</p>'; return; }
    INFO_CACHE = r.data || [];
    try { var a = await db.from('info_link_access').select('*').order('requested_at', { ascending: false }); PW.acc = (a && !a.error && a.data) || []; } catch (e) { PW.acc = []; }
    paintInfo();
    badge();
  }
  function pwRow(i) {
    var st = statusOf(i.id), see = canSee(i), id = String(i.id);
    var out = (i.username ? ' <span class="w134user">' + E(i.username) + '</span>' : '');
    if (see) {
      out += ' <span class="sec" data-sec="' + E(id) + '">' + (PW.shown[id] ? E(PW.shown[id]) : '&bull;&bull;&bull;&bull;&bull;&bull;') + '</span>'
        + ' <button class="btn ghost mini" type="button" data-w134show="' + E(id) + '">' + (PW.shown[id] ? 'Hide' : 'Show') + '</button>'
        + ' <button class="btn ghost mini" type="button" data-w134copy="' + E(id) + '">Copy</button>';
    } else if (st === 'requested') {
      out += ' <span class="sec">&bull;&bull;&bull;&bull;&bull;&bull;</span> <span class="w134chip">Requested, waiting for an admin</span>';
    } else if (PW.asking === id) {
      out += ' <span class="w134ask"><input type="text" maxlength="300" id="w134why" placeholder="What do you need it for? (optional)" aria-label="Why you need it">'
        + '<button class="btn mini w134go" type="button" data-w134send="' + E(id) + '">Send the request</button><button class="btn ghost mini" type="button" data-w134cancel="1">Cancel</button></span>';
    } else {
      out += ' <span class="sec">&bull;&bull;&bull;&bull;&bull;&bull;</span>'
        + (st === 'declined' ? ' <span class="w134chip no">Declined</span>' : '')
        + ' <button class="btn ghost mini" type="button" data-w134ask="' + E(id) + '">' + (st === 'declined' ? 'Ask again' : 'Request access') + '</button>';
    }
    if (i.url) out += ' <a href="' + E(i.url) + '" target="_blank" rel="noopener" style="font-size:12px;">Open &#8599;</a>';
    if (amAdmin()) {
      var who = PW.acc.filter(function (x) { return String(x.link_id) === id && x.status === 'granted'; });
      out += ' <button class="w134who" type="button" data-w134who="' + E(id) + '">' + (who.length === 1 ? '1 person can see it' : who.length + ' people can see it') + '</button>';
      if (PW.open[id]) {
        var have = {}; who.forEach(function (x) { have[String(x.email).toLowerCase()] = 1; });
        var opts = []; try { opts = (DB_MEMBERS || []).filter(function (m) { return m.email && !have[String(m.email).toLowerCase()]; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }); } catch (e) { opts = []; }
        out += '<div class="w134acc">' + (who.length ? who.map(function (x) {
          return '<span class="w134p">' + E(nameOf(x.email)) + (x.decided_by === 'added it' ? ' <small>(added it)</small>' : '') + ' <button type="button" class="w134rm" data-w134revoke="' + E(x.id) + '" title="Remove their access" aria-label="Remove ' + E(nameOf(x.email)) + '">&#10005;</button></span>';
        }).join('') : '<span class="w134none">Only admins so far.</span>')
          + '<span class="w134give"><select id="w134give-' + E(id) + '" aria-label="Give access to"><option value="">Give access to...</option>' + opts.map(function (m) { return '<option value="' + E(String(m.email).toLowerCase()) + '">' + E(m.name) + '</option>'; }).join('') + '</select>'
          + '<button class="btn ghost mini" type="button" data-w134give="' + E(id) + '">Give</button></span></div>';
      }
    }
    return out;
  }
  function paintInfo() {
    var body = document.getElementById('infoBody'); if (!body) return;
    var admin = amAdmin(), me = (typeof who === 'function' ? who() : '');
    var kinds = [
      { k: 'password', title: 'Logins and passwords', note: '<div class="pw-note">Everyone on staff sees this list. Passwords stay hidden: press <b>Request access</b> and an admin approves it, then you can show and copy it. Whoever adds a login can always see it, and every time a password is shown it goes in the audit trail. Keep it to shared team logins (Canva, social accounts, tools); never banking, government or personal credentials. Board viewers never see this page.</div>' },
      { k: 'video', title: 'Training videos (Loom)', note: '' },
      { k: 'folder', title: 'Shared Google Drive folders', note: '' },
      { k: 'link', title: 'Other key links', note: '' }
    ];
    var pend = PW.acc.filter(function (x) { return x.status === 'requested'; });
    var reqHtml = '';
    if (admin && pend.length) {
      reqHtml = '<div class="w134req"><b>' + (pend.length === 1 ? '1 request' : pend.length + ' requests') + ' to see a password</b>' + pend.map(function (x) {
        var l = INFO_CACHE.filter(function (i) { return String(i.id) === String(x.link_id); })[0];
        return '<div class="w134rq"><span class="t"><b>' + E(nameOf(x.email)) + '</b> asked for <b>' + E(l ? l.label : 'a login') + '</b>' + (x.note ? ': ' + E(x.note) : '') + ' <small>' + E(ago(x.requested_at)) + '</small></span>'
          + '<button class="btn mini w134go" type="button" data-w134decide="' + E(x.id) + '" data-s="granted">Grant</button><button class="btn ghost mini" type="button" data-w134decide="' + E(x.id) + '" data-s="declined">Decline</button></div>';
      }).join('') + '</div>';
    }
    body.innerHTML = kinds.map(function (K) {
      var rows = INFO_CACHE.filter(function (i) { return i.kind === K.k; });
      return '<h3>' + K.title + '</h3>' + K.note + (K.k === 'password' ? reqHtml : '') + (rows.length ? rows.map(function (i) {
        var dep = i.department && DEPT_LABEL[i.department] ? '<span class="dep" style="background:' + (DEPT_COLOR[i.department] || '#797773') + '">' + DEPT_LABEL[i.department] + '</span>' : '';
        var main2 = '<span class="lbl">' + E(i.label) + '</span>' + dep;
        if (K.k === 'password') main2 += pwRow(i);
        else main2 += (i.url ? ' <a href="' + E(i.url) + '" target="_blank" rel="noopener" style="font-size:12px;font-weight:600;">Open &#8599;</a>' : '');
        var mayDel = admin || (i.added_by && me && i.added_by === me);
        return '<div class="info-row" data-w134row="' + E(i.id) + '">' + main2
          + (mayDel ? '<button class="mini-x" type="button" data-w134del="' + E(i.id) + '" title="Remove" aria-label="Remove ' + E(i.label) + '">&#10005;</button>' : '')
          + (i.notes ? '<div class="nts">' + E(i.notes) + '</div>' : '') + '</div>';
      }).join('') : '<div class="info-row" style="color:var(--wa-muted);">Nothing here yet. Add the first one below.</div>');
    }).join('')
      + '<div class="info-add"><select id="ii-kind"><option value="password">Password / login</option><option value="video">Training video</option><option value="folder">Drive folder</option><option value="link">Other link</option></select>'
      + '<input id="ii-label" placeholder="Label, e.g. Canva team login" />'
      + '<input id="ii-url" placeholder="URL (optional for passwords)" />'
      + '<input id="ii-user" placeholder="Username / email (passwords)" />'
      + '<input id="ii-secret" placeholder="Password (passwords only)" type="password" autocomplete="new-password" />'
      + '<select id="ii-dept"><option value="">No department</option>' + DEPT_ORDER.map(function (d) { return '<option value="' + d + '">' + DEPT_LABEL[d] + '</option>'; }).join('') + '</select>'
      + '<input id="ii-notes" placeholder="Notes (optional)" />'
      + '<button class="btn mini" id="ii-add" type="button" style="background:var(--wa-green);color:#FFFAF2;border:none;border-radius:7px;cursor:pointer;">Add</button></div>';
  }
  /* the admin's menu item shows how many requests are waiting */
  function badge() {
    try {
      var t = document.querySelector('#tabBar .tab[data-tab="importantinfo"]'); if (!t) return;
      var n = amAdmin() ? PW.acc.filter(function (x) { return x.status === 'requested'; }).length : 0;
      var b = t.querySelector('.w134n');
      if (!n) { if (b) b.parentNode.removeChild(b); return; }
      if (!b) { b = document.createElement('span'); b.className = 'w134n'; t.appendChild(b); }
      if (b.textContent !== String(n)) b.textContent = String(n);
      b.setAttribute('title', n === 1 ? '1 request to see a password' : n + ' requests to see a password');
    } catch (e) { /* fine */ }
  }
  async function badgeAtBoot() {
    if (!amAdmin()) return;
    try { var a = await db.from('info_link_access').select('id,link_id,email,status,requested_at').eq('status', 'requested'); if (a && !a.error) { PW.acc = a.data || []; badge(); } } catch (e) { /* fine */ }
  }

  document.addEventListener('click', async function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#infoBody')) return;
    var el;
    try {
      if ((el = t.closest('[data-w134show]'))) {
        var id = el.getAttribute('data-w134show');
        if (PW.shown[id]) { delete PW.shown[id]; paintInfo(); return; }
        var r = await rpcInfo('info_secret', { p_link_id: Number(id) });
        PW.shown[id] = (r && r.secret) || '(empty)'; paintInfo(); return;
      }
      if ((el = t.closest('[data-w134copy]'))) {
        var cid = el.getAttribute('data-w134copy');
        var s = PW.shown[cid];
        if (!s) { var r2 = await rpcInfo('info_secret', { p_link_id: Number(cid) }); s = r2 && r2.secret; }
        if (s) { await navigator.clipboard.writeText(s); toast('Copied'); }
        return;
      }
      if ((el = t.closest('[data-w134ask]'))) { PW.asking = el.getAttribute('data-w134ask'); paintInfo(); var f = document.getElementById('w134why'); if (f) f.focus(); return; }
      if ((el = t.closest('[data-w134cancel]'))) { PW.asking = null; paintInfo(); return; }
      if ((el = t.closest('[data-w134send]'))) {
        var sid = el.getAttribute('data-w134send'), why = (document.getElementById('w134why') || {}).value || '';
        el.disabled = true;
        var st = await rpcInfo('info_request', { p_link_id: Number(sid), p_note: why });
        PW.asking = null;
        toast(st === 'granted' ? 'You can see it now' : 'Request sent. An admin will approve it.');
        await renderInfo134(); return;
      }
      if ((el = t.closest('[data-w134decide]'))) {
        el.disabled = true;
        var out = await rpcInfo('info_decide', { p_access_id: Number(el.getAttribute('data-w134decide')), p_status: el.getAttribute('data-s') });
        toast(out === 'granted' ? 'Granted' : 'Declined');
        await renderInfo134(); return;
      }
      if ((el = t.closest('[data-w134who]'))) { var wid = el.getAttribute('data-w134who'); PW.open[wid] = !PW.open[wid]; paintInfo(); return; }
      if ((el = t.closest('[data-w134revoke]'))) {
        if (!confirm('Remove their access to this password?')) return;
        await rpcInfo('info_decide', { p_access_id: Number(el.getAttribute('data-w134revoke')), p_status: 'revoked' });
        toast('Access removed'); await renderInfo134(); return;
      }
      if ((el = t.closest('[data-w134give]'))) {
        var gid = el.getAttribute('data-w134give'), sel = document.getElementById('w134give-' + gid);
        if (!sel || !sel.value) { toast('Pick a person'); return; }
        await rpcInfo('info_grant', { p_link_id: Number(gid), p_email: sel.value });
        toast('Access given'); await renderInfo134(); return;
      }
      if ((el = t.closest('[data-w134del]'))) {
        if (!confirm('Remove this entry for everyone?')) return;
        var d = await db.from('info_links').delete().eq('id', Number(el.getAttribute('data-w134del')));
        if (d && d.error) throw d.error;
        await renderInfo134(); return;
      }
      if ((el = t.closest('#ii-add'))) {
        var v = function (x) { return ((document.getElementById(x) || {}).value || '').trim(); };
        if (!v('ii-label')) { toast('Add a label'); return; }
        var ins = await db.from('info_links').insert({ kind: v('ii-kind') || 'link', label: v('ii-label'), url: v('ii-url') || null, username: v('ii-user') || null, secret: v('ii-secret') || null, department: v('ii-dept') || null, notes: v('ii-notes') || null, added_by: (typeof who === 'function' ? who() : null) });
        if (ins && ins.error) { toast('Could not save'); return; }
        toast('Added'); await renderInfo134(); return;
      }
    } catch (err) { toast(errMsg(err)); try { await renderInfo134(); } catch (x) { /* fine */ } }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'w134why') { var b = document.querySelector('[data-w134send]'); if (b) b.click(); }
  });
  /* the page's own renderer (wave4) becomes this one; every caller (the route, the tours) uses the global name */
  try { if (typeof renderInfoPage === 'function') renderInfoPage = renderInfo134; } catch (e) { /* fine */ }
