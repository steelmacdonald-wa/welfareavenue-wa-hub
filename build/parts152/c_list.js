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
  function quickOk(c) {
    var u = S.ui;
    return (!u.kind || hasKind(c, u.kind)) && (!u.role || c._roles.indexOf(u.role) >= 0) && actOk(c, u.act) && permOk(c, u.perm) && qOk(c, u.q);
  }
  /* wave295: and the Filters builder's answer from the database, when one is in use */
  function matches(c) { return quickOk(c) && (!fbOn() || !FB.ids || !!FB.ids[String(c.id)]); }
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
      '<button role="tab" class="' + (t === 'gifts' ? 'on' : '') + '" data-w152go="#crm/gifts">' + I('heart') + ' Gifts</button>' +
      '<button role="tab" class="' + (t === 'email' ? 'on' : '') + '" data-w152go="#crm/email">' + I('mail') + ' Email</button>' +
      '<button role="tab" class="' + (t === 'studio' ? 'on' : '') + '" data-w152go="#crm/studio">' + I('spark') + ' Studio</button>' +
      '<button role="tab" class="' + (t === 'lists' ? 'on' : '') + '" data-w152go="#crm/lists">' + I('list') + ' Lists</button>' +
      '<button role="tab" class="' + (t === 'campaigns' ? 'on' : '') + '" data-w152go="#crm/campaigns">' + I('send') + ' Sends</button>' +
      '<button role="tab" class="' + (t === 'forms' ? 'on' : '') + '" data-w152go="#crm/forms">' + I('form') + ' Forms</button>' +
      '<button role="tab" class="' + (t === 'automations' ? 'on' : '') + '" data-w152go="#crm/automations">' + I('bolt') + ' Automations</button>' +
      '<button role="tab" class="' + (t === 'reports' ? 'on' : '') + '" data-w152go="#crm/reports">' + I('chart') + ' Reports</button></nav>';
  }
  function statsHtml(all) {
    var u = S.ui, plain = !u.role && !u.perm && !u.q && !fbOn();   /* wave295: no tile is the whole story while a filter is on */
    var vol = all.filter(function (c) { return hasKind(c, 'volunteer'); }).length;
    var served = all.filter(function (c) { return c._served > 0; }).length;
    var donors = all.filter(function (c) { return c._donor; }).length;
    var pairs = S.dupes ? dupePairs().length : 0;
    function st(key, n, label, on) { return '<button class="w152st' + (on ? ' on' : '') + '" data-w152set="' + key + '"><b>' + Number(n).toLocaleString('en-CA') + '</b><span>' + E(label) + '</span></button>'; }
    var one = function (n, a, b) { return n === 1 ? a : b; };   /* task 10b: "1 volunteer", never "1 volunteers" */
    return '<div class="w152stats">' +
      st('all', all.length, one(all.length, 'contact in the CRM', 'contacts in the CRM'), plain && !u.kind && !u.act) +
      st('volunteer', vol, one(vol, 'volunteer', 'volunteers'), plain && u.kind === 'volunteer' && !u.act) +
      st('served', served, one(served, 'has served at an event', 'have served at an event'), plain && !u.kind && u.act === 'served') +
      (donors ? st('donor', donors, one(donors, 'donor', 'donors'), plain && u.kind === 'donor' && !u.act)
        : '<button class="w152st" data-w152go="#crm/dupes"><b>' + pairs.toLocaleString('en-CA') + '</b><span>' + one(pairs, 'possible duplicate to check', 'possible duplicates to check') + '</span></button>') + '</div>';
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
      fbButtonHtml() +   /* wave295 */
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
    var filtered = u.kind || u.role || u.act || u.perm || u.q || fbOn();
    /* wave295: the Filters builder, its chips, its message or error; while the first answer is on its way the list waits (no flash of everyone) */
    var waiting = fbOn() && FB.busy && !FB.ids;
    root.innerHTML = statsHtml(all) + tabsHtml() + barHtml(all) + (FB.open ? fbPanelHtml() : '') + fbChipsHtml() +
      (FB.err ? '<div class="w295err" role="alert">The filter did not run: ' + E(FB.err) + '. The list has not changed.</div>' : '') +
      (FB.msg && fbOn() ? '<p class="w295msg m">' + E(FB.msg) + '</p>' : '') +
      '<div class="w152count" aria-live="polite">' + (waiting ? 'Finding who matches…' : filtered ? (fbOn() ? plural(list.length, 'person matches', 'people match') : plural(list.length, 'contact matches', 'contacts match')) + ' · <button class="w152mini" data-w152clear="1">' + I('x') + 'Clear the filters</button>' : plural(all.length, 'contact', 'contacts')) +
      (!waiting && shown.length < list.length ? ' · showing the first ' + shown.length : '') + (fbOn() && FB.busy && FB.ids ? ' · <span class="m">updating…</span>' : '') + '</div>' +
      (waiting ? '' : shown.length ? '<div class="w152list" role="list"><div class="w152lh" aria-hidden="true"><span>Name</span><span>Email and phone</span><span class="c3">Volunteer roles</span><span>Served</span><span>Last activity</span></div>' +
        shown.map(rowHtml).join('') + '</div>' +
        (shown.length < list.length ? '<button class="w152btn soft w152more" data-w152more="1">Show ' + Math.min(60, list.length - shown.length) + ' more</button>' : '')
        : fbOn() ? '<div class="w152empty">No one matches. Remove a condition, or <button class="w152mini" data-w152clear="1">clear the filters</button>.</div>'
        : '<div class="w152empty">Nobody matches. Try another word, or <button class="w152mini" data-w152clear="1">clear the filters</button>.</div>');
    fbSyncHash();
    if (focus) { var inp = root.querySelector('[data-w152q="' + focus + '"]'); if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) { /* fine */ } } }
  }
  function paint() {
    var root = mastFor(); if (!root) return;
    if (!staffOk() || boardMode()) { root.innerHTML = '<div class="w152empty">' + I('lock') + ' The CRM is for the Welfare Avenue team.</div>'; return; }
    if (!S.contacts) { root.innerHTML = busy('Loading the contacts…'); return; }
    if (S.err.contacts && !S.contacts.length) { root.innerHTML = '<div class="w152empty">The contacts could not load (' + E(S.err.contacts) + ').</div>'; return; }
    keepUi(function () { paintTab(root); });   /* wave295: a builder drawn again keeps the focus and its tag lists' scroll */
  }
  function paintTab(root) {
    if (S.ui.tab === 'dupes') paintDupes(root);
    else if (S.ui.tab === 'sources') paintSources(root);
    else if (S.ui.tab === 'gifts') paintGifts(root);
    else if (S.ui.tab === 'email') paintEmail(root);
    else if (S.ui.tab === 'studio') paintStudio(root);
    else if (S.ui.tab === 'lists') paintLists(root);
    else if (S.ui.tab === 'campaigns') paintCampaigns(root);
    else if (S.ui.tab === 'forms') paintForms(root);
    else if (S.ui.tab === 'automations') paintAutos(root);
    else if (S.ui.tab === 'reports') paintReports(root);
    else if (S.ui.tab === 'imports') paintImports(root);
    else paintContacts(root);
  }
  /* wave284: the Import page (#crm/settings/imports, admins); the page itself is build/parts284 (window.w284), drawn into #w284root */
  function paintImports(root) {
    /* task 10b (UI review row 22): no CRM stats strip on the Import page; its first screen is about the run (build/parts284 heads it) */
    root.innerHTML = tabsHtml() + '<div class="w284root" id="w284root"></div>';
    var el = document.getElementById('w284root');
    if (window.w284 && window.w284.open) window.w284.open(el); else el.innerHTML = busy('The Import page is loading…');
  }
  /* wave202: the email studio's tab; the studio itself is build/parts202 (window.w202), drawn into #w202root */
  function paintStudio(root) {
    root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + '<div class="w202root" id="w202root"></div>';
    var el = document.getElementById('w202root');
    if (window.w202 && window.w202.paint) window.w202.paint(el); else el.innerHTML = busy('The email studio is loading…');
  }
  function openCrm(h) {
    /* wave283: what this person may do comes first (wa_my_caps), so every loader and paint after it knows; {} on an error (nothing extra) */
    if (S.caps === undefined && staffOk() && !boardMode() && typeof db !== 'undefined' && db && db.rpc) {
      if (!S.capsLoading) {
        S.capsLoading = true;
        var root0 = mastFor(); if (root0) root0.innerHTML = busy('Loading the CRM…');
        Promise.resolve(db.rpc('wa_my_caps')).then(function (r) { S.caps = (r && !r.error && r.data && typeof r.data === 'object') ? r.data : {}; }, function () { S.caps = {}; })
          .then(function () {
            S.capsLoading = false;
            var cur = decodeURIComponent(location.hash || '').replace(/^#/, '');   /* where the person is now (they may have moved on while it loaded) */
            if (/^crm(\/|$)/.test(cur)) openCrm(cur); else if (!cur) openCrm(h);
            /* wave284: the rail's Imports item follows import_admin, which is known only now: an admin's rail is drawn again */
            try { if (S.caps && S.caps.import_admin && window.WA_APP && WA_APP.current && WA_APP.current() === 'crm') WA_APP.open('crm'); } catch (e) { /* fine */ }
          });
      }
      return;
    }
    var parts = String(h || '').split('/');
    var sub = parts[1] || '';
    S.ui.tab = sub === 'dupes' ? 'dupes' : sub === 'sources' ? 'sources' : sub === 'gifts' ? 'gifts' : sub === 'email' ? 'email' : sub === 'studio' ? 'studio' : sub === 'lists' ? 'lists' : sub === 'campaigns' ? 'campaigns' : sub === 'forms' ? 'forms' : sub === 'automations' ? 'automations' : sub === 'reports' ? 'reports' : (sub === 'settings' && parts[2] === 'imports') ? 'imports' : 'contacts';   /* wave284: imports from #crm/settings/imports */
    if (sub === 'f' && parts[2]) fbFromHash(parts.slice(2).join('/'));   /* wave295: #crm/f/<filter>, the Contacts filters from the address */
    if (sub === 'campaigns') openCampaigns(parts);
    if (sub === 'studio' && window.w202 && window.w202.open) window.w202.open(parts);
    if (sub === 'forms') openForms(parts);
    if (sub === 'automations') openAutos(parts);
    if (sub === 'reports') openReports(parts);
    if (sub === 'gifts') { GF.view = parts[2] === 'receipts' ? 'receipts' : parts[2] === 'online' ? 'online' : ''; DG.confirm = false; DG.msg = ''; DG.err = ''; DG.draft = {}; if (GF.view === 'receipts') { GF.cfg = null; S.rcpts = null; RB.act = null; RB.confirmOn = false; } GF.msg = ''; GF.err = ''; RB.msg = ''; RB.err = ''; }
    if (!staffOk() || boardMode()) { paint(); return; }
    /* wave295: the custom fields and lists the Filters builder offers come with the contacts, so opening it draws once */
    if (!sub || sub === 'f' || sub === 'c') { load('cfields'); load('lists'); }
    Promise.all([load('contacts'), load('dupes')].concat(sub === 'gifts' ? [load('gifts'), load('grcpt')] : sub === 'email' ? [load('templates'), load('sends')] : sub === 'studio' ? [load('templates'), load('lists')] : sub === 'lists' ? [load('lists'), load('cfields')] : sub === 'campaigns' ? [load('campaigns'), load('cstats'), load('lists'), load('templates')] : sub === 'forms' ? [load('forms'), load('fstats'), load('cfields'), load('fevents')] : sub === 'automations' ? [load('autos'), load('astats'), load('forms'), load('templates'), load('depts'), load('tmembers')] : [])).then(function () {
      paint();
      if (sub === 'c' && parts[2]) contactSheet(parts[2]);
      else if (S.sheet && /^c:/.test(S.sheet)) closeSheet(true);
    });
    paint();
  }
