
  /* ---------- Volunteers (#toronto/people): the Toronto pool from the CRM ---------- */
  function schoolsOf(list) {
    var seen = {}, o = [];
    list.forEach(function (p) { if (p.schoolId != null && !seen[p.schoolId]) { seen[p.schoolId] = 1; o.push({ id: p.schoolId, name: p.schoolName || p.school, short: p.school }); } });
    return o.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  }
  function areasOf(list) {
    var o = AREAS.slice();
    list.forEach(function (p) { if (p.area && o.indexOf(p.area) < 0) o.push(p.area); });
    return o;
  }
  function filterPeople(list, f) {
    var qn = fold(f.q), dg = String(f.q || '').replace(/\D/g, '');
    return (list || []).filter(function (p) {
      if (f.kind === 'students' && !p.student) return false;
      if (f.kind === 'general' && p.student) return false;
      if (f.school && String(p.schoolId) !== String(f.school)) return false;
      if (f.area && p.area !== f.area) return false;
      if (f.days && f.days.length && !f.days.some(function (d) { return p.days[d]; })) return false;
      if (qn) {
        var hay = fold([p.name, p.email, (p.c.emails || []).join(' '), (p.c.phones || []).join(' '), p.school, p.schoolName].join(' '));
        var tel = dg.length >= 3 && (p.c.phones || []).some(function (x) { return String(x).replace(/\D/g, '').indexOf(dg) >= 0; });
        if (hay.indexOf(qn) < 0 && !tel) return false;
      }
      return true;
    });
  }
  function sortPeople(list, how) {
    var byName = function (a, b) { return a.name.localeCompare(b.name); };
    return list.slice().sort(function (a, b) {
      if (how === 'name') return byName(a, b);
      if (how === 'last') { var x = a.last || a.next || '', y = b.last || b.next || ''; return x === y ? byName(a, b) : x < y ? 1 : -1; }
      var c = String(a.created || ''), d = String(b.created || ''); return c === d ? byName(a, b) : c < d ? 1 : -1;
    });
  }
  function daysDots(on) {
    var names = WEEK.filter(function (d, i) { return on[i]; }), lbl = names.length ? 'Can give ' + andJoin(names) : 'Days not given';
    return '<span class="w274d7" role="img" aria-label="' + E(lbl) + '" title="' + E(lbl) + '">' + on.map(function (x) { return '<i' + (x ? ' class="on"' : '') + '></i>'; }).join('') + '</span>';
  }
  function anyFilter(f) { return f.kind !== 'all' || !!f.school || !!f.area || (f.days && f.days.length > 0); }
  function describe(f) {
    var o = [];
    if (f.q) o.push('“' + f.q + '”');
    if (f.kind === 'students') o.push('Students'); if (f.kind === 'general') o.push('General');
    if (f.school) { var s = schoolsOf(S.pool || []).filter(function (x) { return String(x.id) === String(f.school); })[0]; o.push(s ? s.short || s.name : 'that school'); }
    if (f.area) o.push(f.area);
    if (f.days && f.days.length) o.push(f.days.slice().sort().map(function (d) { return WEEK[d]; }).join(' or '));
    return o;
  }
  /* the search and the filters, shared by the page (scope p) and the Add people sheet (scope k) */
  function toolsHtml(f, sc) {
    var pool = S.pool || [];
    return '<div class="w274srch">' + ic('search') + '<label class="w274vh" for="w274q' + sc + '">Search the Toronto volunteers</label><input class="w274i" type="search" id="w274q' + sc + '" data-w274q="' + sc + '" placeholder="Name, email, phone or school" autocomplete="off" spellcheck="false" value="' + E(f.q) + '"></div>' +
      '<div class="w274fl"><div class="w274seg" role="group" aria-label="Students or general">' + [['all', 'All'], ['students', 'Students'], ['general', 'General']].map(function (k) { return '<button type="button" data-w274kind="' + k[0] + '" data-w274fs="' + sc + '" aria-pressed="' + (f.kind === k[0] ? 'true' : 'false') + '">' + k[1] + '</button>'; }).join('') + '</div>' +
      '<label class="w274sl">School <select class="w274i" data-w274fsel="school" data-w274fs="' + sc + '"><option value="">All schools</option>' + schoolsOf(pool).map(function (s) { return '<option value="' + E(s.id) + '"' + (String(f.school) === String(s.id) ? ' selected' : '') + '>' + E(s.short && s.short !== s.name ? s.short + ', ' + s.name : s.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="w274sl">Area <select class="w274i" data-w274fsel="area" data-w274fs="' + sc + '"><option value="">All areas</option>' + areasOf(pool).map(function (a) { return '<option' + (f.area === a ? ' selected' : '') + '>' + E(a) + '</option>'; }).join('') + '</select></label>' +
      '<div class="w274dayb" role="group" aria-label="Days they can give">' + WEEK.map(function (d, i) { return '<button type="button" data-w274day="' + i + '" data-w274fs="' + sc + '" aria-pressed="' + (f.days.indexOf(i) >= 0 ? 'true' : 'false') + '">' + d + '</button>'; }).join('') + '</div>' +
      (sc === 'p' ? '<label class="w274sl">Sort <select class="w274i" data-w274fsel="sort" data-w274fs="p">' + [['newest', 'Newest'], ['last', 'Last event'], ['name', 'Name']].map(function (o) { return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' : '') + '</div>';
  }
  function noneHtml(f) {
    return '<div class="w274empty"><p>No one matches ' + E(andJoin(describe(f))) + '.</p><div class="w274copy">' +
      (anyFilter(f) ? '<button type="button" class="w274btn" data-w274clear="f" data-w274fs="' + (f === S.f ? 'p' : 'k') + '">Clear the filters</button>' : '') +
      (f.q ? '<button type="button" class="w274btn" data-w274clear="q" data-w274fs="' + (f === S.f ? 'p' : 'k') + '">Clear the search</button>' : '') + '</div></div>';
  }
  function rowHtml(p) {
    var evs = p.count ? '<b>' + E(plural(p.count, 'Toronto event')) + '</b>' + (p.last ? 'Last: ' + E(fmtDay(p.last)) : p.next ? 'Next: ' + E(fmtDay(p.next)) : '') : '<b>No Toronto event yet</b>';
    return '<article class="w274row" data-w274cid="' + E(p.id) + '"><div><div class="a"><span class="w274pn">' + E(p.name) + '</span>' + whoChip(p) + '</div>' +
      '<div class="b"><span>' + E(p.area || 'Area not given') + '</span>' + daysDots(p.days) + '</div></div>' +
      '<div class="ev">' + evs + '</div>' +
      '<div class="x">' + (p.email ? '<button type="button" class="w274ib" data-w274cpe="' + E(p.id) + '" aria-label="' + E('Copy ' + p.name + '’s email') + '" title="Copy the email">' + ic('copy') + '</button>' : '') +
      '<a class="w274btn sm" href="#crm/c/' + E(p.id) + '" data-w274crm="' + E(p.id) + '">Open in the CRM</a>' +
      '<button type="button" class="w274btn sm" data-w274to="' + E(p.id) + '">' + ic('plus') + 'Add to an event</button></div></article>';
  }
  function countLine(n, all) { return n === all ? plural(all, 'person', 'people') : n + ' of ' + plural(all, 'person', 'people'); }
  function paintList(fresh) {
    var rows = document.getElementById('w274rows'), cnt = document.getElementById('w274pcount'); if (!rows) return;
    var pool = S.pool || [], list = sortPeople(filterPeople(pool, S.f), S.f.sort);
    if (cnt) cnt.textContent = pool.length ? countLine(list.length, pool.length) : '';
    if (S.poolErr && !pool.length) rows.innerHTML = '<p class="w274err" role="alert">Couldn’t load the Toronto volunteers from the CRM. Check your connection, then reload the page.</p>';
    else if (!pool.length) rows.innerHTML = '<div class="w274empty"><h2>No Toronto volunteers in the CRM yet.</h2><p>Contacts tagged toronto, toronto volunteer or toronto student, or living in the GTA, show here.</p></div>';
    else if (!list.length) rows.innerHTML = noneHtml(S.f);
    else rows.innerHTML = list.map(rowHtml).join('');
    if (fresh) rise(rows, '.w274row');
  }
  function paintPeople(root, fresh) {
    if (!S.pool) { setMast('Toronto volunteers', 'Everyone in the CRM who volunteers with us in Toronto.', {}); root.innerHTML = '<p class="w274quiet" role="status">Loading the Toronto volunteers…</p>'; return; }
    setMast('Toronto volunteers', 'Everyone in the CRM who volunteers with us in Toronto: students and general volunteers.', { count: S.pool.length });
    var sig = S.pool.length + '|' + schoolsOf(S.pool).length;
    if (!root.querySelector('[data-w274tools="p"]') || S.toolsSig !== sig) {
      keepFocus(function () {
        root.innerHTML = (S.poolErr ? '<p class="w274err" role="alert">Some of the CRM didn’t load. The list may be missing people: reload the page to try again.</p>' : '') +
          '<div class="w274tools" data-w274tools="p">' + toolsHtml(S.f, 'p') + '</div><p class="w274count" id="w274pcount" aria-live="polite"></p><div class="w274rows" id="w274rows"></div>';
      });
      S.toolsSig = sig;
    }
    paintList(fresh);
  }
  /* a filter changed: its buttons follow in place (the search keeps its focus), then the list redraws, never rising */
  function syncTools(sc) {
    var f = sc === 'k' ? S.pk.f : S.f, host = sc === 'k' ? document.getElementById('w274pane') : document.getElementById('w274root'); if (!host) return;
    Array.prototype.forEach.call(host.querySelectorAll('[data-w274kind][data-w274fs="' + sc + '"]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-w274kind') === f.kind ? 'true' : 'false'); });
    Array.prototype.forEach.call(host.querySelectorAll('[data-w274day][data-w274fs="' + sc + '"]'), function (b) { b.setAttribute('aria-pressed', f.days.indexOf(Number(b.getAttribute('data-w274day'))) >= 0 ? 'true' : 'false'); });
    Array.prototype.forEach.call(host.querySelectorAll('[data-w274fsel][data-w274fs="' + sc + '"]'), function (s) { var k = s.getAttribute('data-w274fsel'); if (s.value !== String(f[k] || '')) s.value = String(f[k] || ''); });
    var qi = host.querySelector('[data-w274q="' + sc + '"]'); if (qi && qi.value !== f.q) qi.value = f.q;
    if (sc === 'k') paintPick(); else paintList(false);
  }
