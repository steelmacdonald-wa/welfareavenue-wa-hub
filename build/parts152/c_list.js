  /* ======================= the contacts (#crm) ======================= */
  var ACTS = [['', 'Any activity'], ['served12', 'Served in the last 12 months'], ['served', 'Has served at an event'], ['never', 'Volunteers who have not served yet'],
    ['review', 'Volunteer record needs a review'], ['noemail', 'No email address'], ['new30', 'Added in the last 30 days']];
  var PERMS = [['', 'Any email permission'], ['express', 'Express consent'], ['implied', 'Implied consent'], ['unknown', 'Not recorded'], ['none', 'No consent'], ['unsub', 'Unsubscribed or bouncing']];
  var SORTS = [['recent', 'Recently active'], ['name', 'Name'], ['served', 'Most servings'], ['new', 'Newest']];
  function hasKind(c, k) {
    if (k === 'donor') return c._donor;
    if (k === 'partner') return c._partner;
    return c.kinds.indexOf(k) >= 0;
  }
  function actOk(c, a) {
    if (!a) return true;
    if (a === 'served12') { var n = daysSince(c.last_serving_on); return n != null && n <= 365 && n >= 0; }
    if (a === 'served') return c._served > 0;
    if (a === 'never') return c.kinds.indexOf('volunteer') >= 0 && !c._served;
    if (a === 'review') return !!c.volunteer_needs_review;
    if (a === 'noemail') return !c.emails.length;
    if (a === 'new30') { var d = daysSince(c.created_at); return d != null && d <= 30; }
    return true;
  }
  function permOk(c, p) {
    if (!p) return true;
    if (p === 'unsub') return c._perm === 'unsub' || c._perm === 'bounced';
    return c._perm === p;
  }
  function qOk(c, q) {
    if (!q) return true;
    var ds = digits(q);
    if (ds.length >= 4 && ds.length >= q.replace(/[\s()+.-]/g, '').length - 1) return c._digits.some(function (d) { return d.indexOf(ds) >= 0; });
    return fold(q).split(/\s+/).filter(Boolean).every(function (t) { return c._hay.indexOf(t) >= 0; });
  }
  function matches(c) {
    var u = S.ui;
    return (!u.kind || hasKind(c, u.kind)) && (!u.role || c._roles.indexOf(u.role) >= 0) && actOk(c, u.act) && permOk(c, u.perm) && qOk(c, u.q);
  }
  function sortRows(list) {
    var s = S.ui.sort;
    var byName = function (a, b) { return fold(a.full_name).localeCompare(fold(b.full_name)); };
    if (s === 'name') return list.sort(byName);
    if (s === 'served') return list.sort(function (a, b) { return (b._served - a._served) || byName(a, b); });
    if (s === 'new') return list.sort(function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')) || byName(a, b); });
    return list.sort(function (a, b) { return String(b._last || '').localeCompare(String(a._last || '')) || (b._served - a._served) || byName(a, b); });
  }
  function tabsHtml() {
    var t = S.ui.tab, n = S.contacts && S.dupes ? dupePairs().length : 0;
    return '<nav class="w152tabs" role="tablist">' +
      '<button role="tab" class="' + (t === 'contacts' ? 'on' : '') + '" data-w152go="#crm">' + I('people') + ' Contacts</button>' +
      '<button role="tab" class="' + (t === 'dupes' ? 'on' : '') + '" data-w152go="#crm/dupes">' + I('merge') + ' Possible duplicates' + (n ? ' <em>' + n + '</em>' : '') + '</button>' +
      '<button role="tab" class="' + (t === 'sources' ? 'on' : '') + '" data-w152go="#crm/sources">' + I('db') + ' Sources</button>' +
      '<button role="tab" class="' + (t === 'gifts' ? 'on' : '') + '" data-w152go="#crm/gifts">' + I('heart') + ' Gifts</button></nav>';
  }
  function statsHtml(all) {
    var u = S.ui, plain = !u.role && !u.perm && !u.q;
    var vol = all.filter(function (c) { return hasKind(c, 'volunteer'); }).length;
    var served = all.filter(function (c) { return c._served > 0; }).length;
    var donors = all.filter(function (c) { return c._donor; }).length;
    var pairs = S.dupes ? dupePairs().length : 0;
    function st(key, n, label, on) { return '<button class="w152st' + (on ? ' on' : '') + '" data-w152set="' + key + '"><b>' + Number(n).toLocaleString('en-CA') + '</b><span>' + E(label) + '</span></button>'; }
    return '<div class="w152stats">' +
      st('all', all.length, 'contacts in the CRM', plain && !u.kind && !u.act) +
      st('volunteer', vol, 'volunteers', plain && u.kind === 'volunteer' && !u.act) +
      st('served', served, 'have served at an event', plain && !u.kind && u.act === 'served') +
      (donors ? st('donor', donors, 'donors', plain && u.kind === 'donor' && !u.act)
        : '<button class="w152st" data-w152go="#crm/dupes"><b>' + pairs + '</b><span>possible duplicates to check</span></button>') + '</div>';
  }
  function opts(list, cur) { return list.map(function (o) { return '<option value="' + E(o[0]) + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join(''); }
  function barHtml(all) {
    var u = S.ui, kc = {}, rc = {};
    all.forEach(function (c) {
      KIND_ORDER.forEach(function (k) { if (hasKind(c, k)) kc[k] = (kc[k] || 0) + 1; });
      c._roles.forEach(function (r) { rc[r] = (rc[r] || 0) + 1; });
    });
    var chips = '<button class="w152chip' + (!u.kind ? ' on' : '') + '" data-w152kind="">Everyone <em>' + all.length + '</em></button>' +
      KIND_ORDER.filter(function (k) { return kc[k]; }).map(function (k) {
        return '<button class="w152chip' + (u.kind === k ? ' on' : '') + '" data-w152kind="' + k + '"><i style="background:' + KINDS[k][1] + '"></i>' + E(KINDS[k][0]) + ' <em>' + kc[k] + '</em></button>';
      }).join('');
    var roles = ROLE_ORDER.filter(function (r) { return rc[r]; }).concat(Object.keys(rc).filter(function (r) { return ROLE_ORDER.indexOf(r) < 0; }).sort());
    return '<div class="w152bar"><div class="w152chips">' + chips + '</div></div>' +
      '<div class="w152bar">' +
      '<div class="w152q">' + I('search') + '<input type="search" data-w152q="contacts" placeholder="Search a name, email, phone, organization or tag" value="' + E(u.q) + '" aria-label="Search contacts"></div>' +
      '<select class="w152sel" data-w152role aria-label="Volunteer role"><option value="">Every volunteer role</option>' + roles.map(function (r) { return '<option value="' + E(r) + '"' + (u.role === r ? ' selected' : '') + '>' + E(roleName(r)) + ' (' + rc[r] + ')</option>'; }).join('') + '</select>' +
      '<select class="w152sel" data-w152act aria-label="Activity">' + opts(ACTS, u.act) + '</select>' +
      '<select class="w152sel" data-w152perm aria-label="Email permission">' + opts(PERMS, u.perm) + '</select>' +
      '<select class="w152sel" data-w152sort aria-label="Sort">' + opts(SORTS.map(function (s) { return [s[0], 'Sort: ' + s[1]]; }), u.sort) + '</select>' +
      '<button class="w152btn" data-w152add="1">' + I('plus') + ' Add a contact</button></div>';
  }
  function rowHtml(c) {
    var roles = c._roles.slice(0, 3).map(function (r) { return '<span class="w152rl">' + E(roleName(r)) + '</span>'; }).join('') + (c._roles.length > 3 ? '<span class="w152count">+' + (c._roles.length - 3) + '</span>' : '');
    var em = c.emails[0] || '', ph = c.phones[0] || '';
    return '<button class="w152row" data-w152open="' + E(c.id) + '">' +
      '<span class="who">' + avatar(c) + '<span style="min-width:0"><span class="nm">' + E(c.full_name) + '</span><span class="ks">' + kindsHtml(c) +
      (c.volunteer_needs_review ? '<span class="w152kd" style="background:rgba(179,64,47,.1);color:' + FLAG + '">Review</span>' : '') + '</span></span></span>' +
      '<span class="ct"><div>' + (em ? E(em) : '<span class="m">No email</span>') + '</div>' + (ph ? '<div class="m">' + E(ph) + '</div>' : '') + '</span>' +
      '<span class="rl">' + (roles || '<span class="w152count">–</span>') + '</span>' +
      '<span class="sv">' + (c._served ? c._served + '<small>' + (c._served === 1 ? 'serving' : 'servings') + '</small>' : '<span class="w152count">–</span>') + '</span>' +
      '<span class="la">' + (c._last ? E(ago(c._last)) : '–') + '</span></button>';
  }
  function paintContacts(root) {
    var all = S.contacts || [], u = S.ui;
    var focus = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-w152q') : null;
    var caret = focus && document.activeElement.selectionStart;
    var list = sortRows(all.filter(matches));
    var shown = list.slice(0, u.show);
    var filtered = u.kind || u.role || u.act || u.perm || u.q;
    root.innerHTML = statsHtml(all) + tabsHtml() + barHtml(all) +
      '<div class="w152count">' + (filtered ? plural(list.length, 'contact matches', 'contacts match') + ' · <button class="w152mini" data-w152clear="1">' + I('x') + 'Clear the filters</button>' : plural(all.length, 'contact', 'contacts')) +
      (shown.length < list.length ? ' · showing the first ' + shown.length : '') + '</div>' +
      (shown.length ? '<div class="w152list" role="list"><div class="w152lh" aria-hidden="true"><span>Name</span><span>Email and phone</span><span class="c3">Volunteer roles</span><span>Served</span><span>Last activity</span></div>' +
        shown.map(rowHtml).join('') + '</div>' +
        (shown.length < list.length ? '<button class="w152btn soft w152more" data-w152more="1">Show ' + Math.min(60, list.length - shown.length) + ' more</button>' : '')
        : '<div class="w152empty">Nobody matches. Try another word, or <button class="w152mini" data-w152clear="1">clear the filters</button>.</div>');
    if (focus) { var inp = root.querySelector('[data-w152q="' + focus + '"]'); if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) { /* fine */ } } }
  }
  function paint() {
    var root = mastFor(); if (!root) return;
    if (!staffOk() || boardMode()) { root.innerHTML = '<div class="w152empty">' + I('lock') + ' The CRM is for the Welfare Avenue team.</div>'; return; }
    if (!S.contacts) { root.innerHTML = busy('Loading the contacts…'); return; }
    if (S.err.contacts && !S.contacts.length) { root.innerHTML = '<div class="w152empty">The contacts could not load (' + E(S.err.contacts) + ').</div>'; return; }
    if (S.ui.tab === 'dupes') paintDupes(root);
    else if (S.ui.tab === 'sources') paintSources(root);
    else if (S.ui.tab === 'gifts') paintGifts(root);
    else paintContacts(root);
  }
  function openCrm(h) {
    var parts = String(h || '').split('/');
    var sub = parts[1] || '';
    S.ui.tab = sub === 'dupes' ? 'dupes' : sub === 'sources' ? 'sources' : sub === 'gifts' ? 'gifts' : 'contacts';
    if (!staffOk() || boardMode()) { paint(); return; }
    Promise.all([load('contacts'), load('dupes')].concat(sub === 'gifts' ? [load('gifts')] : [])).then(function () {
      paint();
      if (sub === 'c' && parts[2]) contactSheet(parts[2]);
      else if (S.sheet && /^c:/.test(S.sheet)) closeSheet(true);
    });
    paint();
  }
