
  /* ---------- state ---------- */
  var S = {
    loaded: false, loading: null, members: [], roles: {}, logins: {}, profiles: [], byKey: {}, settings: {}, requests: [], hr: [],
    tab: 'people', q: '', team: '', status: '', sheet: null, busy: false, cache: null, pedits: {}, ptab: 'pages', res: null
  };
  async function load(force) {
    if (S.loading) return S.loading;
    if (S.loaded && !force) return;
    S.loading = (async function () {
      try {
        var r = await Promise.all([
          db.from('team_members').select('id,name,email,department,role,active,avatar_url').order('name'),
          db.from('hub_roles').select('*'),
          db.rpc('wa_hub_logins'),
          db.from('hub_access_profiles').select('*').order('sort'),
          db.from('hub_access_settings').select('*').eq('id', 1),
          db.from('wa_access_requests').select('*').order('id', { ascending: false }).limit(80)
        ]);
        S.members = (r[0] && r[0].data) || [];
        S.roles = {}; ((r[1] && r[1].data) || []).forEach(function (x) { if (x && x.email) S.roles[lower(x.email)] = x; });
        S.logins = {}; ((r[2] && r[2].data) || []).forEach(function (l) { if (l && l.email) S.logins[lower(l.email)] = l; });
        S.profiles = ((r[3] && r[3].data) || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
        S.byKey = {}; S.profiles.forEach(function (p) { if (!p.pages || typeof p.pages !== 'object') p.pages = {}; if (!Array.isArray(p.can)) p.can = []; S.byKey[p.key] = p; });
        S.settings = (r[4] && r[4].data && r[4].data[0]) || S.settings || {};
        S.requests = (r[5] && r[5].data) || [];
        S.loaded = true;
      } catch (e) { /* keep what we had */ }
      S.cache = null;
      S.loading = null;
    })();
    return S.loading;
  }

  /* ---------- the access rules (the same as wave127 and wa_page_ok) ---------- */
  function isTeamP(p) { return !!(p && p.tier === 'member'); }
  function handPicked(row) { return !!(row && Array.isArray(row.tabs) && row.tabs.length); }
  function valueOf(p, tab) { var v = p && p.pages ? p.pages[tab] : undefined; return v === 'all' || v === 'lead' || v === 'none' ? v : undefined; }
  function knownTabs() {
    var t = [];
    try { t = (typeof WA40_TABS !== 'undefined' ? WA40_TABS : []).slice(); } catch (e) { t = []; }
    if (t.indexOf('adminpanel') < 0) t.push('adminpanel');
    GROUPS.forEach(function (g) { g[1].forEach(function (x) { if (t.indexOf(x) < 0) t.push(x); }); });
    return t.filter(function (x) { return x !== 'team' && x !== 'needsme' && x !== 'personpage' && x !== 'projectpage'; });
  }
  function groupsWithNew() {
    var seen = {}, gs = GROUPS.map(function (g) { g[1].forEach(function (t) { seen[t] = 1; }); return [g[0], g[1].slice()]; });
    var extra = knownTabs().filter(function (t) { return !seen[t]; });
    if (extra.length) gs.unshift(['New pages', extra]);
    return gs;
  }
  function undecided() { return knownTabs().filter(function (t) { return S.profiles.some(function (p) { return p.tier !== 'admin' && valueOf(p, t) === undefined; }); }); }
  function defaultsFor(role) { try { return ((typeof WA40_DEFAULTS !== 'undefined' && WA40_DEFAULTS[role]) || (typeof WA40_DEFAULTS !== 'undefined' && WA40_DEFAULTS.member) || []).slice(); } catch (e) { return []; } }
  function leadRole(role) { return role === 'leader' || role === 'admin'; }
  function classicPages(row, email) {
    var role = row ? row.role : (/@welfareavenue\.com$/.test(lower(email)) ? 'member' : 'viewer');
    if (role === 'blocked') return [];
    var a = handPicked(row) ? row.tabs.slice() : defaultsFor(role);
    function add(t) { if (a.indexOf(t) < 0) a.push(t); }
    if (role !== 'viewer') { add('calendar'); add('photos'); }
    if (a.indexOf('marketing') >= 0) { add('socialstats'); add('contentcal'); }
    if (a.indexOf('fundraising') >= 0 || a.indexOf('finances') >= 0) add('fundevents');
    if (leadRole(role)) { add('governance'); add('committees'); }
    if (role !== 'admin') a = a.filter(function (t) { return t !== 'adminpanel'; });
    if (role === 'admin') a = knownTabs();
    return a.filter(function (t) { return t !== 'team'; });
  }
  function pagesOfProfile(key, lead, row, email) {
    var p = S.byKey[key]; if (!p) return classicPages(row, email);
    if (p.tier === 'admin') return knownTabs();
    var ld = !!lead || p.tier === 'leader', out = [];
    knownTabs().forEach(function (t) { var v = valueOf(p, t); if (v === 'all' || (v === 'lead' && ld)) out.push(t); });
    /* a page this profile has not decided follows its built-in gate */
    classicPages(row, email).forEach(function (t) { if (valueOf(p, t) === undefined && out.indexOf(t) < 0) out.push(t); });
    return out;
  }
  function roleFor(key, lead) { var p = S.byKey[key]; if (!p) return 'member'; if (p.tier === 'admin') return 'admin'; if (p.tier === 'leader') return 'leader'; if (p.tier === 'viewer') return 'viewer'; return lead ? 'leader' : 'member'; }
  function profileName(key, lead) { var p = S.byKey[key]; if (!p) return key || ''; return p.label + (isTeamP(p) && lead ? ' (lead)' : ''); }
  function teamProfile(dept) { return S.profiles.filter(function (p) { return isTeamP(p) && p.team === dept; })[0] || null; }
  /* the profile someone is on, as the menu and the database read it */
  function assignedOf(row) {
    if (!row || row.role === 'blocked' || handPicked(row)) return null;
    if (row.role === 'admin') return S.byKey.admin || null;
    var p = row.profile ? S.byKey[row.profile] : null; if (!p) return null;
    if ((RANK[row.role] == null ? -1 : RANK[row.role]) < RANK[p.tier]) return null;
    return p;
  }

  /* ---------- the people ---------- */
  function statusOf(m, row, login, email) {
    if (row && row.role === 'blocked') return 'removed';
    if (m && m.active === false) return 'removed';
    if (!email) return 'noemail';
    if (login && login.last_sign_in_at) return 'active';
    if (login || row) return 'invited';
    return 'notinvited';
  }
  function suggest(x) {
    if (!x.email || x.status === 'removed') return null;
    var role = x.row ? x.row.role : null;
    if (x.founder || role === 'admin') return { key: 'admin', lead: false, why: x.founder ? 'Founder' : 'Admin today' };
    if (x.dept === 'board') return S.byKey.board ? { key: 'board', lead: false, why: 'On the board, not on the staff team' } : null;
    var tp = teamProfile(x.dept); if (!tp) return null;
    return { key: tp.key, lead: role === 'leader', why: 'On the ' + teamLabel(x.dept) + ' roster' + (role === 'leader' ? ', leads today' : '') };
  }
  function people() {
    if (S.cache) return S.cache;
    var out = [], seen = {};
    function mk(m, em) {
      var row = em ? S.roles[em] || null : null, login = em ? S.logins[em] || null : null;
      var x = {
        id: m ? m.id : null, name: m ? (m.name || nameFromEmail(em)) : ((row && row.note) || nameFromEmail(em)),
        title: m ? (m.role || '') : '', dept: m ? (m.department || '') : '', email: em, avatar: m ? m.avatar_url : null,
        roster: !!m, active: m ? m.active !== false : true, row: row, login: login, founder: FOUNDERS.indexOf(em) >= 0
      };
      x.status = statusOf(m, row, login, em);
      x.role = row ? row.role : '';
      x.hand = handPicked(row);
      x.assigned = assignedOf(row);
      x.lead = !!(x.assigned && isTeamP(x.assigned) && x.role === 'leader');
      x.pages = row ? (x.assigned ? pagesOfProfile(x.assigned.key, x.lead, row, em) : classicPages(row, em)) : [];
      x.sug = suggest(x);
      x.same = !!(x.sug && x.assigned && x.assigned.key === x.sug.key && (!isTeamP(x.assigned) || x.lead === !!x.sug.lead));
      return x;
    }
    S.members.forEach(function (m) { var em = lower(m.email); if (em) seen[em] = 1; out.push(mk(m, em)); });
    Object.keys(S.roles).forEach(function (em) { if (!seen[em]) out.push(mk(null, em)); });
    S.cache = out;
    return out;
  }
  function personBy(key) {
    key = String(key || '');
    return people().filter(function (x) { return (x.email && x.email === lower(key)) || (x.id != null && 'id:' + x.id === key); })[0] || null;
  }
  function pkey(x) { return x.email || ('id:' + x.id); }
  function openRequests() { return (S.requests || []).filter(function (q) { return q.status === 'new'; }); }
  function accessChip(x) {
    if (x.status === 'removed') return '<span class="w131chip gone"><span>Removed</span></span>';
    if (x.hand) return '<span class="w131chip hand" title="Hand-picked pages replace the profile"><i style="--c:' + GOLD + '"></i><span>Hand-picked, ' + x.row.tabs.length + ' pages</span></span>';
    if (x.assigned) return '<span class="w131chip" style="--c:' + E(x.assigned.color || GREEN) + '"><i></i><span>' + E(x.assigned.label + (x.lead ? ', lead' : '')) + '</span></span>';
    if (x.row) return '<span class="w131chip none"><span>No profile (classic ' + E(x.role || 'member') + ')</span></span>';
    if (!x.email) return '<span class="w131chip none"><span>Needs an email</span></span>';
    return x.sug && S.byKey[x.sug.key] ? '<span class="w131chip none" title="The profile they get when invited"><span>Will get ' + E(profileName(x.sug.key, x.sug.lead)) + '</span></span>' : '<span class="w131chip none"><span>No access</span></span>';
  }
  function statusHtml(x) {
    var t = { active: 'Signed in', invited: 'Invited', notinvited: 'Not invited', noemail: 'No email', removed: 'Removed' }[x.status] || x.status;
    var sub = '';
    if (x.status === 'active' && x.login) sub = 'last ' + ago(x.login.last_sign_in_at);
    else if (x.status === 'invited') sub = x.login && x.login.account_created ? 'not signed in yet' : 'has access, not signed in';
    else if (x.status === 'notinvited') sub = 'on the roster';
    else if (x.status === 'noemail') sub = 'add one to invite';
    return '<span class="w131st ' + E(x.status) + '"><i></i><span>' + E(t) + (sub ? '<small>' + E(sub) + '</small>' : '') + '</span></span>';
  }
  function avatar(x) {
    var c = x.dept ? teamColor(x.dept) : '#6b7b77';
    return '<span class="w131av" style="--c:' + E(c) + '">' + (x.avatar ? '<img src="' + E(x.avatar) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + E(initials(x.name)) + '</span>';
  }
  function pagesHtml(list, cmp) {
    return groupsWithNew().map(function (g) {
      var ts = g[1].filter(function (t) { return list.indexOf(t) >= 0 || (cmp && cmp.indexOf(t) >= 0); });
      if (!ts.length) return '';
      return '<div class="w131grp"><small>' + E(g[0]) + '</small><div class="w131tags">' + ts.map(function (t) {
        var inNew = list.indexOf(t) >= 0, inOld = cmp ? cmp.indexOf(t) >= 0 : inNew;
        var cls = cmp ? (inNew && !inOld ? 'new' : (!inNew && inOld ? 'gone' : '')) : '';
        return '<span' + (cls ? ' class="' + cls + '"' : '') + (LOCK[t] ? ' title="' + E(LOCK[t]) + '"' : '') + '>' + (LOCK[t] ? I('lock') : '') + E(labelOf(t)) + '</span>';
      }).join('') + '</div></div>';
    }).join('');
  }
  function diffText(next, today) {
    var g = next.filter(function (t) { return today.indexOf(t) < 0; }).map(labelOf), l = today.filter(function (t) { return next.indexOf(t) < 0 && t !== 'adminpanel'; }).map(labelOf);
    if (!g.length && !l.length) return '<span class="w131mut">The same pages as today.</span>';
    return (g.length ? '<span class="g">Gains ' + E(listJoin(g)) + '.</span> ' : '') + (l.length ? '<span class="l">Loses ' + E(listJoin(l)) + '.</span>' : '');
  }

  /* ---------- what needs doing ---------- */
  function todos() {
    var xs = people(), out = [];
    var rq = openRequests();
    if (rq.length) out.push({ k: 'req', cls: 'warn', ic: 'inbox', t: '<b>' + plural(rq.length, 'access request is', 'access requests are') + ' waiting</b>', s: listJoin(rq.slice(0, 4).map(function (q) { return (q.name || q.email) + ' (' + reqWhat(q) + ')'; })), a: '<a class="w131btn sm gold" data-w131tab="requests">Review</a>' });
    var nop = xs.filter(function (x) { return x.row && x.status !== 'removed' && !x.assigned && !x.hand && x.sug && S.byKey[x.sug.key]; });
    if (nop.length) out.push({ k: 'noprof', cls: 'warn', ic: 'key', t: '<b>' + plural(nop.length, 'person has', 'people have') + ' no access profile</b>', s: listJoin(nop.slice(0, 5).map(function (x) { return first(x.name) + ' → ' + profileName(x.sug.key, x.sug.lead); })) + (nop.length > 5 ? ' and ' + (nop.length - 5) + ' more' : ''), a: '<a class="w131btn sm" data-w131apply="noprof">' + I('check') + 'Give ' + (nop.length === 1 ? 'it' : 'them their team’s profile') + '</a>' });
    var mis = xs.filter(function (x) { return x.assigned && isTeamP(x.assigned) && x.dept && TEAMS.indexOf(x.dept) >= 0 && x.dept !== 'board' && x.assigned.team !== x.dept && x.status !== 'removed'; });
    if (mis.length) out.push({ k: 'mis', cls: 'warn', ic: 'alert', t: '<b>' + plural(mis.length, 'profile names', 'profiles name') + ' a different team from the roster</b>', s: listJoin(mis.map(function (x) { return first(x.name) + ': ' + x.assigned.label + ', roster says ' + teamLabel(x.dept); })), a: '<a class="w131btn sm ghost" data-w131filter="mis">Show them</a>' });
    var ni = xs.filter(function (x) { return x.status === 'notinvited' && x.roster; });
    if (ni.length) out.push({ k: 'ni', cls: '', ic: 'mail', t: '<b>' + plural(ni.length, 'person on the roster is', 'people on the roster are') + ' not invited yet</b>', s: listJoin(ni.slice(0, 5).map(function (x) { return x.name; })) + (ni.length > 5 ? ' and ' + (ni.length - 5) + ' more' : ''), a: '<a class="w131btn sm ghost" data-w131filter="notinvited">Show them</a><a class="w131btn sm" data-w131invall="1">' + I('mail') + 'Invite ' + (ni.length === 1 ? 'them' : 'all ' + ni.length) + '</a>' });
    var ne = xs.filter(function (x) { return x.status === 'noemail'; });
    if (ne.length) out.push({ k: 'ne', cls: '', ic: 'user', t: '<b>' + plural(ne.length, 'person has', 'people have') + ' no email yet</b>', s: 'Add an email to invite them: ' + listJoin(ne.slice(0, 5).map(function (x) { return x.name; })) + (ne.length > 5 ? ' and ' + (ne.length - 5) + ' more' : ''), a: '<a class="w131btn sm ghost" data-w131filter="noemail">Show them</a>' });
    var gone = xs.filter(function (x) { return x.roster && x.active === false && x.row && x.row.role !== 'blocked'; });
    if (gone.length) out.push({ k: 'gone', cls: 'risk', ic: 'out', t: '<b>' + plural(gone.length, 'person is', 'people are') + ' marked inactive but can still sign in</b>', s: listJoin(gone.map(function (x) { return x.name; })), a: gone.length === 1 ? '<a class="w131btn sm danger" data-w131open="' + E(pkey(gone[0])) + '">Review</a>' : '<a class="w131btn sm ghost" data-w131filter="gone">Show them</a>' });
    var adm = xs.filter(function (x) { return x.role === 'admin' && x.status !== 'removed' && x.roster; });
    if (adm.length > 5) out.push({ k: 'adm', cls: '', ic: 'shield', t: '<b>' + adm.length + ' people are admins</b>', s: 'Admin is for the people who run the Hub itself. Executive gives every page but Admin: ' + listJoin(adm.filter(function (x) { return !x.founder; }).map(function (x) { return first(x.name); })) + '.', a: '<a class="w131btn sm ghost" data-w131filter="admin">Show them</a>' });
    return out;
  }
  function reqWhat(q) {
    var w = String(q.wanted || '');
    if (w.indexOf('tab:') === 0) return labelOf(w.slice(4));
    if (w === 'role:leader') return 'lead access';
    if (w === 'role:admin') return 'Admin';
    return 'something else';
  }
