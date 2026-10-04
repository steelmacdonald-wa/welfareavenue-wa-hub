
  /* ---------- the Strategy Library ---------- */
  function docHtml(d, compact) {
    var admin = isAdmin();
    var gl = (d.goals || []).filter(Boolean).map(function (n) { var g = S.goals.filter(function (x) { return String(x.number) === String(n); })[0]; return g ? '<a class="w205tag g" href="#orggoals/goal/' + g.id + '" data-w205go="#orggoals/goal/' + g.id + '">Goal ' + E(n) + '</a>' : ''; }).join(' ');
    return '<article class="w205doc' + (d.pinned ? '' : ' unpinned') + '" data-w205doc="' + d.id + '"><div class="hd"><span class="ic">' + I(d.url ? 'doc' : 'archive') + '</span><div style="flex:1;min-width:0">' +
      '<h4 data-w198skip>' + (d.url ? '<a href="' + E(d.url) + '" target="_blank" rel="noopener">' + E(d.title) + '</a>' : E(d.title)) + '</h4>' +
      '<div class="meta">' + E(d.group_label || '') + (d.doc_date ? ' · ' + E(d.doc_date) : '') + (d.url ? '' : ' · no link yet') + '</div></div>' +
      (admin ? '<button type="button" class="w205pinb' + (d.pinned ? ' on' : '') + '" data-w205pin="' + d.id + '" aria-pressed="' + (d.pinned ? 'true' : 'false') + '" aria-label="' + (d.pinned ? 'Unpin' : 'Pin') + ' this document" title="' + (d.pinned ? 'Pinned for everyone: unpin' : 'Pin it for everyone') + '">' + I('star') + '</button>' : (d.pinned ? '<span class="w205pinb on" title="Pinned">' + I('star') + '</span>' : '')) + '</div>' +
      (d.direction ? '<div class="dir" data-w198skip>' + E(compact ? clip(d.direction, 150) : d.direction) + '</div>' : '') +
      (d.status_note && !compact ? '<div class="st" data-w198skip>' + E(d.status_note) + '</div>' : '') +
      '<div class="ft">' + gl + '<span style="flex:1"></span>' + (d.url ? '<a class="w205btn sm ghost" href="' + E(d.url) + '" target="_blank" rel="noopener">' + I('ext') + ' Open</a>' : '') +
      (admin && !compact ? '<button type="button" class="w205btn sm ghost" data-w205docedit="' + d.id + '">Edit</button>' : '') + '</div></article>';
  }
  function libraryViewHtml() {
    var qv = lower(S.libQ), admin = isAdmin();
    var list = S.docs.filter(function (d) {
      if (!qv) return true;
      return lower([d.title, d.direction, d.status_note, d.group_label, d.doc_date].join(' ')).indexOf(qv) >= 0;
    });
    var shelves = []; list.forEach(function (d) { var s = d.group_label || 'Other'; if (shelves.indexOf(s) < 0) shelves.push(s); });
    var order = ['Our plans', 'Consulting work', 'Sources']; shelves.sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.localeCompare(b); });
    var pinnedN = S.docs.filter(function (d) { return d.pinned; }).length;
    var html = mastHtml('Strategy Library', 'The documents that set Welfare Avenue’s direction: what each one says and where it stands. Pinned documents lead the Goals page.') +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 6px"><label class="w205search">' + I('search') + '<input type="search" data-w205libq value="' + E(S.libQ) + '" placeholder="Search the library" aria-label="Search the Strategy Library" /></label>' +
      '<span style="font-size:13px;color:' + MUTED + '">' + plural(S.docs.length, 'document') + ', ' + pinnedN + ' pinned</span><span style="flex:1"></span>' +
      (admin ? '<button type="button" class="w205btn pri" data-w205docadd>' + I('plus') + ' Add a document</button>' : '') +
      '<button type="button" class="w205btn" data-w205go="#orggoals">Back to the goals</button></div>';
    if (!list.length) {
      html += '<div class="w205empty" style="margin-top:16px"><b>' + (qv ? 'Nothing matches' : 'The library is empty') + '</b>' + (qv ? 'Try another word, or clear the search.' : (admin ? 'Add the first document.' : 'Admins add the documents that set our direction.')) + '</div>';
      return html;
    }
    shelves.forEach(function (s) {
      var ds = list.filter(function (d) { return (d.group_label || 'Other') === s; }).sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.sort - b.sort); });
      html += '<div class="w205shelf">' + E(s) + ' <small>' + ds.length + '</small></div><div class="w205lib">' + ds.map(function (d) { return docHtml(d, false); }).join('') + '</div>';
    });
    if (S.plan.source && S.plan.source.title) html += '<p style="font-size:12px;color:' + MUTED + ';margin:20px 0 0">Seeded from "What our own plans already say" and the sources of the draft "' + E(S.plan.source.title) + '".</p>';
    return html;
  }

  /* ---------- the retired goals ---------- */
  function retiredViewHtml() {
    var oldOrg = S.retired.filter(function (g) { return g.department === 'org'; });
    var dept = S.retired.filter(function (g) { return g.department !== 'org'; });
    var lead = isLeader();
    function row(g) {
      var to = g.maps_to_goal_id ? byId(S.goals, g.maps_to_goal_id) : null;
      var proj = g.moved_to_project_id ? byId(S.projects, g.moved_to_project_id) : null;
      var wins = S.wins[g.id] || 0, cm = (S.comments || []).filter(function (c) { return String(c.goal_id) === String(g.id); }).length;
      return '<div class="it"><i style="width:9px;height:9px;border-radius:50%;background:' + E(g.department === 'org' ? GOLD : deptColor(g.department)) + ';flex:none"></i><div class="t"><b data-w198skip>' + E(g.title) + '</b>' +
        '<small>' + E(g.department === 'org' ? 'Organizational goal' : deptLabel(g.department)) + (g.quarter ? ' · ' + E(g.quarter) : '') + (g.status_before_retire ? ' · was ' + E(ST_LABEL[g.status_before_retire] || g.status_before_retire) : '') +
        (wins ? ' · ' + plural(wins, 'win') : '') + (cm ? ' · ' + plural(cm, 'comment') : '') + '</small>' +
        (g.retired_note ? '<small data-w198skip>' + E(g.retired_note) + '</small>' : '') + '</div>' +
        (to ? '<a class="w205tag g" href="#orggoals/goal/' + to.id + '" data-w205go="#orggoals/goal/' + to.id + '">Goal ' + E(to.number) + '</a>' : '<span class="w205tag">No obvious fit</span>') +
        (g.department !== 'org' ? (proj ? '<a class="w205btn sm ghost" href="#project/' + proj.id + '">Now a project</a>' : g.moved_to_project_id ? '<span class="w205tag p">Now a project</span>' : (lead ? '<button type="button" class="w205btn sm" data-w205toproj="' + g.id + '" title="Once only: a project in ' + E(deptLabel(g.department)) + (to ? ', linked to goal ' + E(to.number) : '') + '">Make it a project</button>' : '')) : '') + '</div>';
    }
    var groups = {}; dept.forEach(function (g) { var k = g.maps_to_goal_id && byId(S.goals, g.maps_to_goal_id) ? String(g.maps_to_goal_id) : 'none'; (groups[k] = groups[k] || []).push(g); });
    var html = mastHtml('Retired goals', 'Department goals are retired as a tier: departments own projects, and projects serve the five goals. Nothing was removed: each goal keeps its wins, comments and history.') +
      '<div style="margin:0 0 14px"><button type="button" class="w205btn" data-w205go="#orggoals">Back to the goals</button></div>';
    if (!S.retired.length) return html + '<div class="w205empty"><b>No retired goals</b>Goals retired later show here.</div>';
    if (oldOrg.length) html += '<div class="w205shelf">The earlier organizational goals <small>' + oldOrg.length + '</small></div><div class="w205list">' + oldOrg.map(row).join('') + '</div>';
    html += '<div class="w205shelf">Department goals <small>' + dept.length + '</small></div>' +
      '<p style="font-size:13px;color:' + MUTED + ';margin:-4px 0 10px">Grouped by the goal each one served. ' + (lead ? 'Make it a project turns one into a project in the same team, linked to that goal (once per goal).' : 'Leaders and admins can turn one into a project.') + '</p>';
    S.goals.concat([{ id: 'none' }]).forEach(function (g) {
      var list = groups[String(g.id)]; if (!list || !list.length) return;
      html += '<div class="w205grp">' + (g.id === 'none' ? 'No obvious fit with one of the five goals' : 'Served goal ' + E(g.number) + ': <span data-w198skip>' + E(g.title) + '</span>') + '</div><div class="w205list" style="margin-bottom:10px">' + list.map(row).join('') + '</div>';
    });
    return html;
  }
