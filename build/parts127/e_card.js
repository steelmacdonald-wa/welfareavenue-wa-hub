
  /* ---------- Admin > Access profiles ---------- */
  function initials(n) { var p = String(n || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function tierChip(p) {
    if (p.tier === 'admin') return '<span class="w127tier admin">Everything</span>';
    if (p.tier === 'leader') return '<span class="w127tier exec">All but Admin</span>';
    if (p.tier === 'viewer') return '<span class="w127tier board">Board</span>';
    return '<span class="w127tier">Team, lead option</span>';
  }
  function cellVal(p, t) { var e = A.edits[p.key]; if (e && e[t] !== undefined) return e[t]; return valueOf(p, t); }
  function editCount() { var n = 0; Object.keys(A.edits).forEach(function (k) { n += Object.keys(A.edits[k]).length; }); return n; }
  function effPages(p, lead) {
    var out = [];
    knownTabs().forEach(function (t) { if (t === 'team') return; var v = cellVal(p, t); if (v === 'all' || (v === 'lead' && lead)) out.push(t); });
    return out;
  }
  function holders(key) { return (A.cache || []).filter(function (x) { return x.assigned && x.assigned.key === key; }); }
  function proposed(key) { return (A.cache || []).filter(function (x) { return x.sug && x.sug.key === key && !x.same && x.hasRow; }); }
  function groupsWithNew() {
    var seen = {}, gs = GROUPS.map(function (g) { g[1].forEach(function (t) { seen[t] = 1; }); return [g[0], g[1].slice()]; });
    var extra = knownTabs().filter(function (t) { return !seen[t] && t !== 'team'; });
    if (extra.length) gs.unshift(['New pages', extra]);
    return gs;
  }

  function topHtml() {
    var all = (A.cache || []).filter(function (x) { return x.email && x.role !== 'blocked' && x.hasRow; });
    var on = all.filter(function (x) { return !!x.assigned; }).length;
    var todo = (A.cache || []).filter(function (x) { return x.sug && !x.same && x.hasRow; }).length;
    var explicit = all.filter(function (x) { return x.row && x.row.profile; }).length;
    var how = [
      ['people', 'One profile each', 'Nine profiles: one for each team, the board, executives and admins. Pick it here or in People and access.'],
      ['key', 'Leads get a little more', 'A team profile has a lead option: Agendas, Activity, the HR centre, the board pages, and inviting people into their own team.'],
      ['lock', 'The database backs it up', 'The finances and the board pages follow the profile in the database, not only the menu. The rest of the Hub stays open to the team, as it is today.']
    ];
    var left = '<div class="w127box"><p class="lead">Everyone on the Hub can have one access profile. It decides which pages they see and, for the finances and the board, what the database lets them read. Each card below says in plain words what a profile gives, and the table compares every page.</p>'
      + '<div class="w127how">' + how.map(function (h) { return '<div><b>' + I(h[0]) + E(h[1]) + '</b><span>' + E(h[2]) + '</span></div>'; }).join('') + '</div></div>';
    var s = A.settings || {};
    var right = '<div class="w127box w127stat"><div class="kk">Where it stands</div>'
      + '<div class="big">' + on + '<small>of ' + all.length + ' people on a profile</small></div>'
      + '<p>' + (explicit ? (todo ? plural(todo, 'person still differs', 'people still differ') + ' from the proposal.' : 'Everyone matches the proposal.') : (on ? 'Admins count as the Admin profile (it means everything). ' : '') + 'Nobody else has a profile yet, so nobody\'s access has changed. Check the proposal below, then apply it.') + (s.applied_at ? ' Last applied ' + E(String(s.applied_at).slice(0, 10)) + (s.applied_by ? ' by ' + E(String(s.applied_by).split('@')[0].replace('.', ' ')) : '') + '.' : '') + '</p>'
      + '<div class="row">' + (todo ? '<a class="w127btn gold sm" data-w127applyall="1">' + I('check') + 'Apply the proposal (' + todo + ')</a>' : '') + '<a class="w127btn ghost sm" data-w127jump="w127people">' + I('people') + 'See who gets what</a></div>'
      + '<label class="sw"><input type="checkbox" data-w127auto="1"' + (s.auto_profile ? ' checked' : '') + '> New people get their team\'s profile automatically</label></div>';
    return '<div class="w127top">' + left + right + '</div>';
  }
  function bannerHtml() {
    var u = undecided(); if (!u.length) return '';
    return '<div class="w127banner">' + I('alert') + '<div><b>' + plural(u.length, 'new page has', 'new pages have') + ' no decision yet:</b> ' + E(listJoin(u.map(labelOf))) + '. Until you decide, ' + (u.length === 1 ? 'it follows its' : 'they follow their') + ' built-in access (everyone, leads or admins). Decide in the table: each profile gets it, its leads do, or nobody.</div><span class="sp"></span><a class="w127btn sm" data-w127jump="w127mxsec">Decide now</a></div>';
  }
  function cardHtml(p) {
    var team = isTeam(p), mem = effPages(p, p.tier === 'leader' || p.tier === 'admin'), lead = team ? effPages(p, true).filter(function (t) { return mem.indexOf(t) < 0; }) : [];
    var none = knownTabs().filter(function (t) { return t !== 'team' && mem.indexOf(t) < 0 && lead.indexOf(t) < 0 && cellVal(p, t) !== undefined; });
    var hs = holders(p.key), pr = proposed(p.key);
    var out = '';
    if (p.tier === 'admin') out = '<b>Nothing is left out.</b>';
    else {
      var nm = none.map(labelOf);
      out = (nm.length ? '<b>Leaves out:</b> ' + E(nm.length > 7 ? nm.slice(0, 7).join(', ') + ' and ' + (nm.length - 7) + ' more' : listJoin(nm)) + '.' : '<b>Leaves nothing out.</b>')
        + (lead.length ? '<br><b>Leads also get:</b> ' + E(listJoin(lead.map(labelOf))) + '.' : '');
    }
    var who = hs.length
      ? hs.slice(0, 6).map(function (x) { return '<span class="w127av" title="' + E(x.name) + '">' + E(initials(x.name)) + '</span>'; }).join('') + '<span class="n">' + E(hs.length <= 3 ? listJoin(hs.map(function (x) { return String(x.name).split(' ')[0]; })) : plural(hs.length, 'person', 'people')) + '</span>'
      : '<span>' + (pr.length ? 'Nobody yet. Proposed for ' + plural(pr.length, 'person', 'people') + '.' : 'Nobody yet.') + '</span>';
    return '<div class="w127box w127pc" id="w127pc-' + E(p.key) + '" style="--c:' + E(p.color || GREEN) + '"><div class="bar"></div><div class="in">'
      + '<div class="hd"><h3>' + E(p.label) + '</h3>' + tierChip(p) + '</div>'
      + '<p class="sum">' + E(p.summary || '') + '</p>'
      + '<div class="w127nums"><span><b>' + mem.length + '</b> pages</span>' + (lead.length ? '<span><b>+' + lead.length + '</b> for leads</span>' : '') + (hs.length ? '<span><b>' + hs.length + '</b> on it</span>' : '') + '</div>'
      + '<ul class="w127can">' + (p.can || []).slice(0, 5).map(function (c) { return '<li>' + I('check') + '<span>' + E(c) + '</span></li>'; }).join('') + '</ul>'
      + '<div class="w127out">' + out + '</div>'
      + '<div class="w127who">' + who + '</div></div>'
      + '<div class="ft"><a class="w127lnk" data-w127prof="' + E(p.key) + '">Every page ' + I('chev') + '</a><span class="sp"></span>' + (amAdmin() ? '<a class="w127btn ghost sm" data-w127pedit="' + E(p.key) + '">' + I('pen') + 'Edit the words</a>' : '') + '</div></div>';
  }
  function matrixHtml() {
    var ps = A.profiles, adm = amAdmin(), u = undecided();
    var h = '<div class="w127mx"><table class="w127tbl"><thead><tr><th class="pg">Page</th>'
      + ps.map(function (p) { return '<th style="--c:' + E(p.color || GREEN) + '"><i></i>' + E(SHORT[p.key] || p.label) + '</th>'; }).join('') + '</tr></thead><tbody>';
    groupsWithNew().forEach(function (g) {
      h += '<tr class="gp"><td class="pg">' + E(g[0]) + '</td><td colspan="' + ps.length + '"></td></tr>';
      g[1].forEach(function (t) {
        var isNew = u.indexOf(t) >= 0;
        h += '<tr' + (isNew ? ' class="new"' : '') + ' data-w127row="' + E(t) + '"><td class="pg"><b>' + E(labelOf(t)) + '</b>' + (LOCK[t] ? '<span class="lk" title="' + E(LOCK[t]) + '">' + I('lock') + '</span>' : '') + (isNew ? '<em>new</em>' : '') + '</td>';
        ps.forEach(function (p) {
          var v = cellVal(p, t), ed = adm && p.tier !== 'admin', ch = A.edits[p.key] && A.edits[p.key][t] !== undefined;
          var inner = v === 'all' ? '<span class="all" title="Everyone with this profile"></span>' : v === 'lead' ? '<span class="lead">Leads</span>' : v === 'none' ? '<span class="none" title="Nobody with this profile"></span>' : '<span class="und" title="Not decided yet">?</span>';
          h += '<td><button type="button" class="w127c' + (ed ? ' ed' : '') + (ch ? ' ch' : '') + '"' + (ed ? ' data-w127cell="' + E(p.key) + '|' + E(t) + '"' : ' tabindex="-1"') + ' aria-label="' + E(labelOf(t) + ' for ' + p.label + ': ' + (v === 'all' ? 'everyone' : v === 'lead' ? 'leads only' : v === 'none' ? 'nobody' : 'not decided')) + '">' + inner + '</button></td>';
        });
        h += '</tr>';
      });
    });
    h += '</tbody></table></div>';
    h += '<div class="w127leg"><span><span class="w127c"><span class="all"></span></span>Everyone with the profile</span><span><span class="w127c"><span class="lead">Leads</span></span>Only its leads</span><span><span class="w127c"><span class="none"></span></span>Nobody</span><span>' + I('lock') + 'The database enforces it too</span>' + (adm ? '<span>Admins: click a cell to change it. Admin always has everything.</span>' : '') + '</div>';
    var n = editCount();
    if (n) h += '<div class="w127save">' + I('pen') + '<span>' + plural(n, 'change', 'changes') + ' not saved yet. They apply to everyone with those profiles the next time they open the Hub.</span><span class="sp"></span><a class="w127btn ghost sm" data-w127undo="1">' + I('undo') + 'Undo</a><a class="w127btn gold sm" data-w127save="1">' + I('check') + 'Save for everyone</a></div>';
    return h;
  }
  function lookHtml() {
    var xs = A.cache || [], out = [];
    var gone = xs.filter(function (x) { return x.row && x.role !== 'blocked' && x.active === false; });
    if (gone.length) out.push('<b>' + E(listJoin(gone.map(function (x) { return x.name; }))) + '</b> ' + (gone.length === 1 ? 'is' : 'are') + ' marked as no longer active on the roster but still ' + (gone.length === 1 ? 'has' : 'have') + ' Hub access (' + E(listJoin(gone.map(function (x) { return x.role; }).filter(function (v, i, a) { return a.indexOf(v) === i; }))) + '). Remove it in People and access if they have left.');
    var off = xs.filter(function (x) { return x.noRoster && x.role !== 'blocked'; });
    if (off.length) out.push('<b>' + E(listJoin(off.map(function (x) { return x.email; }))) + '</b> ' + (off.length === 1 ? 'has' : 'have') + ' Hub access but ' + (off.length === 1 ? 'is' : 'are') + ' not on the roster, so the Hub cannot tell which team ' + (off.length === 1 ? 'they are' : 'they are') + ' on.');
    var admins = xs.filter(function (x) { return x.role === 'admin' && x.active !== false; });
    if (admins.length > 5) out.push('<b>' + admins.length + ' people are admins.</b> Admin is for the people who run the Hub itself (access, settings, AI models). Consider Executive, or a team profile with the lead option, for the others: ' + E(listJoin(admins.filter(function (x) { return FOUNDERS.indexOf(x.email) < 0; }).map(function (x) { return String(x.name).split(' ')[0]; }))) + '.');
    var ld = xs.filter(function (x) { return x.sug && isTeam(A.byKey[x.sug.key]) && !x.sug.lead && leadTitle(x.title) && x.email; });
    if (ld.length) out.push('<b>' + E(listJoin(ld.map(function (x) { return String(x.name).split(' ')[0]; }))) + '</b> ' + (ld.length === 1 ? 'has a lead title' : 'have lead titles') + ' but ' + (ld.length === 1 ? 'is' : 'are') + ' proposed as team members, because that is their access today. Tick the lead option in People and access if they run their team.');
    var mis = xs.filter(function (x) { return x.assigned && isTeam(x.assigned) && x.dept && x.assigned.team !== x.dept; });
    if (mis.length) out.push('<b>' + E(listJoin(mis.map(function (x) { return String(x.name).split(' ')[0]; }))) + '</b>: the profile names a different team from the roster. Check which one is right.');
    return out.length ? out.map(function (t) { return '<div class="w127warn">' + I('alert') + '<div>' + t + '</div></div>'; }).join('') : '';
  }
  function diffHtml(x) {
    if (!x.email) return '<span class="w127diff s">Needs an email before they can sign in.</span>';
    if (x.role === 'blocked') return '<span class="w127diff s">Removed from the Hub.</span>';
    if (!x.sug) return '<span class="w127diff s">No proposal: keep as is.</span>';
    if (x.same) return '<span class="w127diff s">Already on it.</span>';
    var g = x.gain.map(labelOf), l = x.lose.map(labelOf);
    var t = (g.length ? '<span class="g">Gains ' + E(listJoin(g)) + '.</span> ' : '') + (l.length ? '<span class="l">Loses ' + E(listJoin(l)) + '.</span>' : '');
    if (!g.length && !l.length) t = '<span class="s">Same pages as today.</span>';
    if (!x.hasRow) t += ' <span class="s">Gets it when they first sign in' + ((A.settings || {}).auto_profile ? '' : ', once new people get their team\'s profile automatically') + '.</span>';
    return '<span class="w127diff">' + t + '</span>';
  }
  function pill(p, lead) { if (!p) return ''; return '<span class="w127pill" style="--c:' + E(p.color || GREEN) + '"><i></i>' + E(p.label + (isTeam(p) && lead ? ' (lead)' : '')) + '</span>'; }
  function todayHtml(x) {
    if (!x.email) return '<span class="w127pill none">No access</span>';
    if (x.role === 'blocked') return '<span class="w127pill none">Removed</span>';
    if (x.assigned) return pill(x.assigned, x.role === 'leader');
    var t = x.row ? (handPicked(x.row) ? 'Hand-picked, ' + x.row.tabs.length + ' pages' : 'Classic: ' + x.role) : (x.role === 'member' ? 'Classic: member (not signed in yet)' : 'No access yet');
    return '<span class="w127pill none">' + E(t) + '</span>';
  }
  function peopleHtml() {
    var xs = (A.cache || []).filter(function (x) { return x.email || x.active; });
    var C = {
      change: xs.filter(function (x) { return x.sug && !x.same; }),
      none: xs.filter(function (x) { return x.email && !x.assigned && x.role !== 'blocked'; }),
      all: xs
    };
    var f = C[A.filter] ? A.filter : 'change';
    var rows = C[f].slice().sort(function (a, b) { return String(a.dept).localeCompare(String(b.dept)) || String(a.name).localeCompare(String(b.name)); });
    var chips = [['change', 'Proposed changes'], ['none', 'No profile yet'], ['all', 'Everyone']];
    var h = '<div class="w127box">' + lookHtml()
      + '<div class="w127chips">' + chips.map(function (c) { return '<a data-w127f="' + c[0] + '"' + (f === c[0] ? ' class="on"' : '') + '>' + E(c[1]) + '<b>' + C[c[0]].length + '</b></a>'; }).join('') + '</div>';
    if (!rows.length) return h + '<p class="w127empty">' + (f === 'change' ? 'Everyone already matches the proposal.' : 'Nobody here.') + '</p></div>';
    h += '<table class="w127ppl"><thead><tr><th>Person</th><th class="hide">Today</th><th>Proposed</th><th>What changes</th><th></th></tr></thead><tbody>';
    rows.forEach(function (x) {
      var p = x.sug ? A.byKey[x.sug.key] : null;
      h += '<tr><td><b>' + E(x.name) + '</b><span class="mut">' + E([x.title, deptLabel(x.dept)].filter(Boolean).join(' · ')) + '</span></td>'
        + '<td class="hide">' + todayHtml(x) + '</td>'
        + '<td>' + (p ? pill(p, x.sug.lead) + '<span class="mut">' + E(x.sug.why) + '</span>' : '<span class="w127diff s">Keep as is</span>') + '</td>'
        + '<td>' + diffHtml(x) + '</td>'
        + '<td>' + (amAdmin() && x.sug && !x.same && x.hasRow ? '<a class="w127btn ghost sm" data-w127apply="' + E(x.email) + '">Apply</a>' : '') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function alwaysHtml() {
    var hr = []; (A.hrList || []).forEach(function (e) { var x = (A.cache || []).filter(function (y) { return y.email === e; })[0]; var n = x && !x.noRoster ? String(x.name).split(' ')[0] : nameFromEmail(e).split(' ')[0]; if (hr.indexOf(n) < 0) hr.push(n); });
    var items = [
      ['shield', 'Admins see everything, and they are the only ones who can change access.'],
      ['lock', 'Everyone\'s time off, discipline and policy sign-offs stay with the HR access list' + (hr.length ? ' (' + listJoin(hr) + ')' : '') + ', whatever the profile.'],
      ['eye', 'Private and leadership meeting notes and transcripts stay with the people they name.'],
      ['people', 'Each agenda is visible to the person who made it and the people invited.'],
      ['key', 'Directors see the board pages whatever their staff profile. Board items marked confidential stay with the board.'],
      ['check', 'Everyone sees their own things: their tasks, requests, time off and profile.'],
      ['pen', 'Hand-picked pages (in People and access) replace the profile for that person, and the database keeps today\'s rules for them.']
    ];
    return '<div class="w127box"><div class="w127always">' + items.map(function (i) { return '<div>' + I(i[0]) + '<span>' + E(i[1]) + '</span></div>'; }).join('') + '</div></div>';
  }
  function cardEl() {
    var panel = document.getElementById('adminpanel'); if (!panel) return null;
    var c = document.getElementById('w127card');
    if (!c) { c = document.createElement('div'); c.className = 'card'; c.id = 'w127card'; c.innerHTML = '<div id="w127"></div>'; panel.appendChild(c); }
    return c;
  }
  function paint() {
    var c = cardEl(); if (!c) return;
    var host = document.getElementById('w127'); if (!host) return;
    if (!amAdmin()) { host.innerHTML = '<div class="w127box"><p class="w127empty">Access profiles are managed by admins. Open Your access from your profile menu to see yours.</p></div>'; return; }
    if (!A.loaded) { host.innerHTML = '<div class="w127box"><p class="w127empty">Loading the access profiles…</p></div>'; return; }
    if (!A.profiles.length) { host.innerHTML = '<div class="w127box"><p class="w127empty">The access profiles are not set up yet.</p></div>'; return; }
    A.cache = people();
    var html = topHtml() + bannerHtml()
      + '<div class="w127sec"><h2>The profiles</h2><span>What each one is for, what it lets you do, the pages it opens and what it leaves out.</span></div>'
      + '<div class="w127grid">' + A.profiles.map(cardHtml).join('') + '</div>'
      + '<div class="w127sec" id="w127mxsec"><h2>Every page, profile by profile</h2><span>The pages each profile opens. A lock means the database enforces it too; the other pages are hidden from the menu, and the work on them is shared with the team as today.</span></div>'
      + matrixHtml()
      + '<div class="w127sec" id="w127people"><h2>Who gets what</h2><span>The proposal: each person\'s team from the roster, the lead option for today\'s leads, Admin for today\'s admins and the board profile for directors who are not on staff. Nothing changes until you apply it.</span></div>'
      + peopleHtml()
      + '<div class="w127sec"><h2>Always true, whatever the profile</h2></div>' + alwaysHtml();
    if (host.__h !== html) { var y = window.scrollY; host.innerHTML = html; host.__h = html; try { window.scrollTo(0, y); } catch (e) { /* fine */ } }
  }
  async function show() {
    cardEl(); paint();
    await Promise.all([load(true), loadPeople(), loadHr()]);
    if (onAccess()) paint();
  }
  async function loadHr() { try { var r = await db.from('wa_hr_access').select('email'); A.hrList = ((r && r.data) || []).map(function (x) { return lower(x.email); }); } catch (e) { A.hrList = A.hrList || []; } }
