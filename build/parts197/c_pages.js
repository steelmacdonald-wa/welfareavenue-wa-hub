
  /* ---------- the hosts this wave draws into ---------- */
  function host(id, cls) {
    var body = document.getElementById('w46body'); if (!body) return null;
    var h = document.getElementById(id);
    if (!h) { h = document.createElement('div'); h.id = id; h.className = 'w197card ' + (cls || ''); var tabs = body.querySelector('.w47tabs'); if (tabs) tabs.insertAdjacentElement('afterend', h); else body.insertBefore(h, body.firstChild); }
    return h;
  }
  function go(k) { location.hash = '#hrcentre/' + k; }

  /* ---------- Overview: HR's to-do list ---------- */
  function overviewHtml() {
    var d = S.data; if (!d) return '<p class="w197note">Loading what needs HR…</p>';
    var ppl = members(), cands = S.cands, hb = hoursBy();
    var newC = cands.filter(function (c) { return c.status === 'new'; });
    var nobody = cands.filter(function (c) { return ['new', 'reviewing', 'interview', 'offer'].indexOf(c.status) >= 0 && !c.owner; });
    var inFlight = cands.filter(function (c) { return c.status === 'interview' || c.status === 'offer'; });
    var onb = d.onb.filter(function (o) { return !o.completed_at && o.status !== 'done' && o.status !== 'completed' && o.status !== 'removed'; });
    var t0 = today(), overdue = d.tp.filter(function (t) { return t.due_date && t.due_date < t0; });
    var overduePeople = {}; overdue.forEach(function (t) { overduePeople[lower(t.email || t.person_name)] = 1; });
    var req = d.pol.filter(function (p) { return p.required; }), signed = {};
    d.sig.forEach(function (s) { signed[lower(s.email) + '|' + s.policy_key] = 1; });
    var unsigned = ppl.filter(function (m) { return m.email && req.some(function (p) { return !signed[lower(m.email) + '|' + p.key]; }); });
    var low = !S.avgW ? [] : ppl.filter(function (m) { var mn = minFor(m); if (!mn) return false; var h = hb[lower(m.email)]; var avg = h ? h.past / S.avgW / 60 : 0; return avg < mn; });
    var inLoop = ppl.filter(function (m) { var h = hb[lower(m.email)]; return h && h.week > 0; });
    var checkIn = Array.prototype.map.call(document.querySelectorAll('#w144hr .w144sub'), function (s) { return s; }).filter(function (s) { return /worth a check/i.test(s.textContent); })[0];
    var checkList = checkIn && checkIn.nextElementSibling ? Array.prototype.map.call(checkIn.nextElementSibling.querySelectorAll('li'), function (li) { var a = li.querySelector('a') || li.firstChild; return a ? String(a.textContent || '').trim() : ''; }).filter(Boolean) : [];
    function names(arr, f, n) { var a = arr.slice(0, n || 4).map(f); return a.join(', ') + (arr.length > (n || 4) ? ' and ' + (arr.length - (n || 4)) + ' more' : ''); }
    var oldest = newC.length ? newC.reduce(function (a, c) { return c.created_at < a ? c.created_at : a; }, newC[0].created_at) : null;
    var items = [
      { n: newC.length, k: 'applications', t: newC.length === 1 ? 'new application to read' : 'new applications to read', s: newC.length ? 'The oldest came ' + ago(oldest) + '. Read each one and move it to Reviewing, or close it.' : '' },
      { n: nobody.length, k: 'applications', t: nobody.length === 1 ? 'application nobody is handling' : 'applications nobody is handling', s: nobody.length ? names(nobody, function (c) { return c.name; }) : '' },
      { n: inFlight.length, k: 'applications', t: inFlight.length === 1 ? 'candidate at interview or offer' : 'candidates at interview or offer', s: inFlight.length ? names(inFlight, function (c) { return c.name + ' (' + c.status + ')'; }) : '' },
      { n: d.timeoff.length, k: 'timeoff', t: d.timeoff.length === 1 ? 'time-off request to decide' : 'time-off requests to decide', s: d.timeoff.length ? names(d.timeoff, function (r) { return (r.name || r.email) + ', ' + r.start_date; }) : '' },
      { n: onb.length, k: 'onboarding', t: onb.length === 1 ? 'person onboarding' : 'people onboarding', s: onb.length ? names(onb, function (o) { return o.person_name; }) : '' },
      { n: Object.keys(overduePeople).length, k: 'training', t: Object.keys(overduePeople).length === 1 ? 'person with a training past its due date' : 'people with a training past its due date', s: overdue.length ? overdue.length + ' trainings in all' : '' },
      { n: unsigned.length, k: 'policies', t: unsigned.length === 1 ? 'person who has not signed every required policy' : 'people who have not signed every required policy', s: unsigned.length ? names(unsigned, function (m) { return m.name; }, 5) : '' },
      { n: low.length, k: 'hours', t: low.length === 1 ? 'person below their weekly minimum' : 'people below their weekly minimum', s: low.length ? 'Average over the last ' + S.avgW + (S.avgW === 1 ? ' full week' : ' full weeks') + ' in The Loop. ' + names(low, function (m) { return m.name; }, 5) : '' },
      { n: checkList.length, k: 'hours', t: (checkList.length === 1 ? 'person' : 'people') + ' worth a check-in (missed their team’s last meetings)', s: checkList.length ? checkList.join(', ') + '. A kind word first: people step back for many reasons.' : '' }
    ];
    var todo = items.filter(function (i) { return i.n > 0; });
    var tiles = [
      [ppl.length, 'people on the team', 'team'], [inLoop.length, 'in The Loop this week', 'hours'], [newC.length, 'new applications', 'applications', newC.length > 0],
      [onb.length, 'onboarding now', 'onboarding'], [Object.keys(overduePeople).length, 'with a training overdue', 'training', overdue.length > 0], [d.timeoff.length, 'time off to decide', 'timeoff', d.timeoff.length > 0]
    ];
    /* anniversaries in the next 30 days and the newest people */
    var now = new Date(), soon = [];
    ppl.forEach(function (m) {
      if (!m.start_date) return; var sd = new Date(m.start_date + 'T12:00:00'), y = now.getFullYear() - sd.getFullYear();
      var next = new Date(sd); next.setFullYear(now.getFullYear()); if (next < now) { next.setFullYear(now.getFullYear() + 1); y++; }
      var days = Math.round((next - now) / 86400000); if (y >= 1 && days <= 30) soon.push({ m: m, y: y, days: days, next: next });
    });
    soon.sort(function (a, b) { return a.days - b.days; });
    var newest = ppl.filter(function (m) { return m.start_date; }).sort(function (a, b) { return String(b.start_date).localeCompare(String(a.start_date)); }).slice(0, 4);
    function dm(x) { try { return x.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
    return '<div class="w197tiles">' + tiles.map(function (t) { return '<button type="button" class="w197tile' + (t[3] ? ' hot' : '') + '" data-w197go="' + t[2] + '"><b>' + t[0] + '</b><span>' + E(t[1]) + '</span></button>'; }).join('') + '</div>' +
      '<div class="w197grid2"><div class="w197card" style="margin:0"><h2>Needs HR</h2>' +
      (todo.length ? '<ul class="w197todo">' + todo.map(function (i) { return '<li><span class="n">' + i.n + '</span><div class="t"><b>' + E(i.n + ' ' + i.t) + '</b>' + (i.s ? '<small>' + E(i.s) + '</small>' : '') + '</div>' + btn('Open', 'data-w197go="' + i.k + '"', 'sm') + '</li>'; }).join('') + '</ul>' : '<p class="w197done">Nothing waiting on HR. Nice.</p>') +
      '</div><div class="w197card" style="margin:0"><h2>Coming up</h2>' +
      (soon.length ? '<ul class="w197todo">' + soon.slice(0, 6).map(function (x) { return '<li>' + av(x.m, 36) + '<div class="t"><b>' + E(x.m.name) + '</b><small>' + x.y + (x.y === 1 ? ' year' : ' years') + ' with us on ' + dm(x.next) + (x.days === 0 ? ' (today)' : '') + '</small></div></li>'; }).join('') + '</ul>' : '<p class="w197note">No work anniversaries in the next 30 days.</p>') +
      (newest.length ? '<h2 style="margin-top:16px">Newest on the team</h2>' : '') + '<ul class="w197todo">' + newest.map(function (m) { return '<li>' + av(m, 36) + '<div class="t"><b>' + E(m.name) + '</b><small>' + E(teamLabel(m.department)) + ' · started ' + E(ago(m.start_date + 'T12:00:00')) + '</small></div></li>'; }).join('') + '</ul></div></div>';
  }
  function paintOverview() { var h = host('w197ov'); if (!h) return; h.className = 'w197ovwrap'; h.innerHTML = overviewHtml(); }

  /* ---------- Applications: the stage board ---------- */
  function stageLabel(s) { var x = STAGES.concat(CLOSED).filter(function (p) { return p[0] === s; })[0]; return x ? x[1] : s; }
  function daysIn(c) { var t = c.stage_at || c.created_at; return t ? Math.floor((Date.now() - new Date(t).getTime()) / 86400000) : 0; }
  function roles() { var r = {}; S.cands.forEach(function (c) { if (c.role) r[c.role] = (r[c.role] || 0) + 1; }); return Object.keys(r).sort(); }
  function filtered() {
    var qq = lower(S.q), ow = S.filterOwner, ro = S.filterRole || '';
    return S.cands.filter(function (c) {
      if (qq && (lower(c.name) + ' ' + lower(c.role) + ' ' + lower(c.email)).indexOf(qq) < 0) return false;
      if (ro && c.role !== ro) return false;
      if (ow === '__me') return lower(c.owner) === lower(me().name) || lower(c.owner) === lower((me().name || '').split(' ')[0]);
      if (ow === '__none') return !c.owner;
      if (ow) return c.owner === ow;
      return true;
    });
  }
  function candCard(c, small) {
    var still = /still interested/i.test(String(c.summary || '') + ' ' + String(c.notes || ''));
    var d = daysIn(c);
    return '<button type="button" class="w197cand" draggable="' + (small ? 'false' : 'true') + '" data-w197c="' + c.id + '"><b>' + E(c.name || 'Someone') + '</b>' +
      (small ? '' : '<span class="r">' + E(c.role || 'No role given') + ' · applied ' + E(ago(c.created_at)) + '</span><span class="m">' +
        (c.owner ? '<span class="who">' + E(String(c.owner).split(' ')[0]) + '</span>' : '<span>Nobody yet</span>') +
        (still ? '<span class="ok">Still interested</span>' : '') + (c.cv_path ? '<span>CV</span>' : '') +
        (d >= 7 ? '<span class="age">' + d + ' days here</span>' : '') + '</span>') + '</button>';
  }
  function boardHtml() {
    var rows = filtered(), people = members().slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var owners = {}; S.cands.forEach(function (c) { if (c.owner) owners[c.owner] = 1; });
    var bar = '<div class="w197bar"><input type="search" id="w197q" placeholder="Search a name or a role" value="' + E(S.q) + '">' +
      '<select id="w197role" aria-label="Role"><option value="">Every role</option>' + roles().map(function (r) { return '<option' + (S.filterRole === r ? ' selected' : '') + '>' + E(r) + '</option>'; }).join('') + '</select>' +
      '<select id="w197own" aria-label="Handled by"><option value="">Anyone handling</option><option value="__me"' + (S.filterOwner === '__me' ? ' selected' : '') + '>Mine</option><option value="__none"' + (S.filterOwner === '__none' ? ' selected' : '') + '>Nobody yet</option>' +
      Object.keys(owners).sort().map(function (o) { return '<option' + (S.filterOwner === o ? ' selected' : '') + '>' + E(o) + '</option>'; }).join('') + '</select>' +
      btn('Refresh', 'data-w197a="reload"', 'sm') + '</div>';
    var cols = STAGES.map(function (s) {
      var list = rows.filter(function (c) { return c.status === s[0] || (s[0] === 'new' && !c.status); });
      if (s[0] === 'hired') list = list.filter(function (c) { return daysIn(c) <= 90; });
      list.sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
      return '<div class="w197col" data-w197col="' + s[0] + '"><h4>' + E(s[1]) + ' <small>' + list.length + '</small></h4>' + (list.length ? list.map(function (c) { return candCard(c); }).join('') : '<p class="w197note" style="margin:4px">' + (s[0] === 'new' ? 'No new applications.' : 'Drop a card here.') + '</p>') + '</div>';
    }).join('');
    var closed = rows.filter(function (c) { return c.status === 'declined' || c.status === 'withdrawn'; });
    return bar + '<div class="w197board" id="w197board">' + cols + '</div>' +
      '<div class="w197closed">' + (closed.length ? '<button type="button" class="w197b sm" data-w197a="closed">' + (S.showClosed ? 'Hide' : 'Show') + ' the ' + closed.length + ' closed (declined or withdrawn)</button>' + (S.showClosed ? '<div>' + closed.map(function (c) { return candCard(c, true); }).join('') + '</div>' : '') : '') +
      '<p class="w197note">Applications emailed to hub@ (label Hub/Recruitment) and from the job boards land in New. Hired shows the last 90 days.</p></div>';
  }
  function paintBoard() { var h = host('w197apps'); if (!h) return; var a = document.activeElement, qf = a && a.id === 'w197q'; h.innerHTML = boardHtml(); if (qf) { var x = document.getElementById('w197q'); if (x) { x.focus(); try { x.setSelectionRange(x.value.length, x.value.length); } catch (e) { /* fine */ } } } }

  /* the candidate sheet */
  var NEXT = {
    'new': 'Read the application, choose who handles it, then move it to Reviewing (or close it as Declined).',
    reviewing: 'Invite them to an interview. The interview question templates are in Playbook.',
    interview: 'After the interview, write your impressions here. If it is a yes, move it to Offer and send the offer letter (Playbook).',
    offer: 'When they accept, move it to Hired, then set up their onboarding.',
    hired: 'Set up their onboarding: Onboarding, Assign an onboarding. The Welcome kit there has the email and the account setup.',
    declined: 'Closed. Move it back to a stage if this changes.', withdrawn: 'Closed. Move it back to a stage if this changes.'
  };
  function sheetEl() { var s = document.getElementById('w197sheet'); if (!s) { s = document.createElement('div'); s.id = 'w197sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); s.setAttribute('aria-label', 'Application'); document.body.appendChild(s); } return s; }
  function openSheet(id) {
    var c = S.cands.filter(function (x) { return String(x.id) === String(id); })[0]; if (!c) return;
    S.open = c.id;
    var people = members().slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var positions = []; try { positions = (window.WA46 && WA46.reqs || []).filter(function (r) { return r.type_key === 'hiring-request' && !r.done; }); } catch (e) { positions = []; }
    var pos = positions.map(function (r) { return '<option value="' + r.id + '"' + (String(c.request_id) === String(r.id) ? ' selected' : '') + '>' + E(r.title || ('Request #' + r.id)) + '</option>'; }).join('');
    if (c.request_id && !positions.some(function (r) { return String(r.id) === String(c.request_id); })) pos += '<option value="' + E(c.request_id) + '" selected>Position #' + E(c.request_id) + '</option>';
    var links = (c.links || []).map(function (l) { return '<a href="' + E(l) + '" target="_blank" rel="noopener">' + E(String(l).replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)) + '</a>'; }).join('<br>');
    var s = sheetEl();
    s.innerHTML = '<div class="bk" data-w197a="shut"></div><div class="pn">' + btn('Close', 'data-w197a="shut"', 'sm x') +
      '<h3>' + E(c.name || 'Someone') + '</h3><p class="role">' + E(c.role || 'No role given') + ' · applied ' + E(ago(c.created_at)) + (c.source ? ' · ' + E(c.source) : '') + '</p>' +
      '<label>Stage</label><div class="stg">' + STAGES.map(function (p) { return '<button type="button" data-w197st="' + p[0] + '" class="' + (c.status === p[0] ? 'on' : '') + '">' + E(p[1]) + '</button>'; }).join('') +
      CLOSED.map(function (p) { return '<button type="button" data-w197st="' + p[0] + '" class="cl' + (c.status === p[0] ? ' on' : '') + '">' + E(p[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="next"><b>Next:</b> ' + E(NEXT[c.status || 'new'] || '') + (c.status === 'hired' ? ' ' + btn('Go to Onboarding', 'data-w197go="onboarding"', 'sm pri') : '') + '</div>' +
      '<label>Contact</label><div class="ct">' + (c.email ? '<a href="mailto:' + E(c.email) + '">' + E(c.email) + '</a>' : 'No email') + (c.phone ? '<br><a href="tel:' + E(String(c.phone).replace(/[^\d+]/g, '')) + '">' + E(c.phone) + '</a>' : '') + (links ? '<br>' + links : '') + '</div>' +
      '<div class="acts">' + (c.cv_path ? btn('Open the CV' + (c.cv_name ? ' (' + E(String(c.cv_name).slice(0, 28)) + ')' : ''), 'data-w197cv="' + E(c.cv_path) + '"', 'pri sm') : '<span class="w197pill mut">No CV attached</span>') + (c.mail_id ? '<a class="w197b sm" href="#hubmail">The original email</a>' : '') + '</div>' +
      '<label for="w197own1">Handled by</label><select id="w197own1" data-w197f="owner"><option value="">Nobody yet</option>' + people.map(function (m) { return '<option' + (c.owner === m.name ? ' selected' : '') + '>' + E(m.name) + '</option>'; }).join('') + '</select>' +
      '<label for="w197pos1">Position</label><select id="w197pos1" data-w197f="request_id"><option value="">Not linked to a position</option>' + pos + '</select>' +
      (c.summary ? '<label>What they wrote</label><div class="sum">' + E(c.summary) + '</div>' : '') +
      '<label for="w197notes1">Notes</label><textarea id="w197notes1" data-w197f="notes" placeholder="Interview impressions, the next step">' + E(c.notes || '') + '</textarea>' +
      '<div class="acts">' + btn('Save the notes', 'data-w197a="notes"', 'pri sm') + '</div></div>';
    s.classList.add('open');
    var f = s.querySelector('.stg button.on') || s.querySelector('.stg button'); if (f) { try { f.focus(); } catch (e) { /* fine */ } }
  }
  function shutSheet() { var s = document.getElementById('w197sheet'); if (!s) return; var t = s.querySelector('[data-w197f="notes"]'); if (t && S.open) { var c = S.cands.filter(function (x) { return x.id === S.open; })[0]; if (c && (c.notes || '') !== t.value) updateCand(c.id, { notes: t.value.slice(0, 2000) }, 'Notes saved'); } s.classList.remove('open'); S.open = null; }
  async function updateCand(id, patch, msg) {
    try {
      var who = me().name || me().email;
      patch.updated_at = new Date().toISOString(); patch.updated_by = who;
      if (patch.status) patch.stage_at = patch.updated_at;
      var r = await db.from('hub_candidates').update(patch).eq('id', id);
      if (r && r.error) throw r.error;
      var c = S.cands.filter(function (x) { return x.id === id; })[0]; if (c) Object.keys(patch).forEach(function (k) { c[k] = patch[k]; });
      try { await db.from('change_log').insert({ entity_type: 'candidate', entity_id: String(id), field: Object.keys(patch).filter(function (k) { return k !== 'updated_at' && k !== 'updated_by' && k !== 'stage_at'; })[0] || 'update', old_value: null, new_value: String(patch.status || patch.owner || patch.request_id || (patch.notes ? 'notes' : '')), changed_by: who }); } catch (e) { /* audit */ }
      if (msg) toastS(msg);
      return true;
    } catch (e) { toastS('Could not save: ' + (e.message || e)); return false; }
  }
  async function moveTo(id, st) {
    var c = S.cands.filter(function (x) { return String(x.id) === String(id); })[0]; if (!c || c.status === st) return;
    var ok = await updateCand(c.id, { status: st }, (c.name || 'Moved') + ': ' + stageLabel(st));
    if (ok) { paintBoard(); paintRail(); if (S.open === c.id) openSheet(c.id); }
  }

  /* ---------- Hours: The Loop against the minimums ---------- */
  function hoursHtml() {
    var hb = hoursBy(), ppl = members().filter(function (m) { return m.department !== 'board' || minFor(m) > 0; });
    var rows = ppl.map(function (m) {
      var h = hb[lower(m.email)] || { week: 0, last: 0, past: 0, sessions: 0, open: false, lastAt: null };
      var mn = minFor(m), avg = S.avgW ? h.past / S.avgW / 60 : 0;
      return { m: m, h: h, min: mn, avg: avg, low: !!S.avgW && mn > 0 && avg < mn };
    });
    rows.sort(function (a, b) { if (a.low !== b.low) return a.low ? -1 : 1; if (a.low) return (a.avg / a.min) - (b.avg / b.min); return b.avg - a.avg; });
    var lowN = rows.filter(function (r) { return r.low; }).length, none = rows.filter(function (r) { return r.min > 0 && !r.h.sessions; }).length;
    var weekP = rows.filter(function (r) { return r.h.week > 0; }).length;
    var tot = rows.reduce(function (a, r) { return a + r.h.week; }, 0);
    var html = '<div class="w197tiles">' +
      '<div class="w197tile"><b>' + weekP + '</b><span>people in The Loop this week</span></div>' +
      '<div class="w197tile"><b>' + fmtH(tot) + '</b><span>given this week</span></div>' +
      '<div class="w197tile' + (lowN ? ' hot' : '') + '"><b>' + (S.avgW ? lowN : '\u2013') + '</b><span>' + (S.avgW ? 'below their minimum (' + S.avgW + '-week average)' : 'below their minimum: from the first full week of The Loop') + '</span></div>' +
      '<div class="w197tile"><b>' + none + '</b><span>no session in The Loop yet</span></div></div>' +
      '<div class="w197card"><h2>Hours by person</h2>' +
      '<div class="w197mins"><b>Weekly minimums:</b> managers and up <input type="number" id="w197mmgr" min="1" max="40" value="' + E(S.mins.manager) + '">h, everyone else <input type="number" id="w197mmem" min="1" max="40" value="' + E(S.mins.member) + '">h' + (isAdmin() || canHr() ? btn('Save', 'data-w197a="mins"', 'sm pri') : '') + '<span class="w197note" style="margin:0">The board is exempt; the operational executives (Steel, Suhaib) 8h.</span></div>' +
      '<div class="w197wrap"><table class="w197tbl"><thead><tr><th>Person</th><th>This week</th><th class="hp">Last week</th><th>Average a week</th><th>Minimum</th><th class="hp"></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var pct = r.min ? Math.min(100, Math.round(r.avg / r.min * 100)) : 100;
        return '<tr class="' + (r.low ? 'low' : '') + '"><td><b>' + E(r.m.name) + '</b><br><small style="color:var(--wa-muted)">' + E(teamLabel(r.m.department)) + (r.h.open ? ' · in now' : '') + '</small></td>' +
          '<td>' + fmtH(r.h.week) + '</td><td class="hp">' + fmtH(r.h.last) + '</td>' +
          '<td><div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><i style="width:' + pct + '%"></i></div><span>' + (Math.round(r.avg * 10) / 10) + 'h</span></div></td>' +
          '<td>' + (r.min ? r.min + 'h' : '<span class="w197pill mut">exempt</span>') + '</td><td class="hp">' + (r.min ? (!S.avgW ? '<span class="w197pill mut">too early</span>' : r.low ? '<span class="w197pill low">below</span>' : '<span class="w197pill">on track</span>') : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="w197note">From The Loop: a session counts from I’m in to Close the loop; a session still open counts at most eight hours. Average a week is the last ' + S.hoursWeeks + ' full weeks, counted from The Loop\u2019s first full week (it began on 25 September 2026). Hours stay with the person, HR and admins.</p></div>';
    var feed = S.feed.slice(0, 25);
    html += '<div class="w197card"><h2>What people shared in The Loop</h2><p class="w197note" style="margin:0 0 8px">What moved, as people chose to share it when they closed the loop (last 30 days). Never times or hours.</p>' +
      (feed.length ? '<ul class="w197feed">' + feed.map(function (f) {
        var b = Array.isArray(f.bullets) ? f.bullets : [];
        return '<li><b>' + E(f.name || f.email) + '</b> <small>· ' + E(teamLabel(f.department)) + ' · ' + E(ago(f.day + 'T12:00:00')) + (f.closed ? ' · closed ' + f.closed + (f.closed === 1 ? ' task' : ' tasks') : '') + '</small>' +
          (b.length ? '<ul>' + b.slice(0, 5).map(function (x) { return '<li>' + E(typeof x === 'string' ? x : (x && (x.text || x.t)) || '') + '</li>'; }).join('') + '</ul>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="w197note">Nothing shared in the last 30 days yet.</p>') + '</div>';
    return html;
  }
  function paintHours() { var h = host('w197hours'); if (!h) return; h.className = 'w197hourswrap'; h.innerHTML = S.ckAt ? hoursHtml() : '<p class="w197note">Loading The Loop…</p>'; }
  async function saveMins() {
    var mg = Number((document.getElementById('w197mmgr') || {}).value), mm = Number((document.getElementById('w197mmem') || {}).value);
    if (!(mg > 0) || !(mm > 0)) { toastS('Both minimums need a number of hours'); return; }
    var old = S.mins.manager + '/' + S.mins.member;
    var r = await db.from('hub_settings').upsert({ key: 'hours_minimums', value: { manager: mg, member: mm }, updated_at: new Date().toISOString() });
    if (r && r.error) { toastS('Could not save the minimums'); return; }
    S.mins = { manager: mg, member: mm };
    try { await db.from('change_log').insert({ entity_type: 'settings', entity_id: 'hours_minimums', field: 'minimums', old_value: old, new_value: mg + '/' + mm, changed_by: me().name || me().email }); } catch (e) { /* audit */ }
    toastS('Minimums saved: ' + mg + 'h managers and up, ' + mm + 'h everyone else'); paintHours();
  }
