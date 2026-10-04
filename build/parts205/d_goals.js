
  /* ---------- the page ---------- */
  function deptLabel(d) { try { return (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || (window.WA_TEAMS && WA_TEAMS.labels && WA_TEAMS.labels[d]) || d || 'Other'; } catch (e) { return d || 'Other'; } }
  function deptColor(d) { try { return (typeof DEPT_COLOR !== 'undefined' && DEPT_COLOR[d]) || MUTED; } catch (e) { return MUTED; } }
  function av(p, size) { try { return window.w116Avatar ? window.w116Avatar(p, size) : ''; } catch (e) { return ''; } }
  function onPage() { var a = document.querySelector('.panel.active'); return !!(a && a.id === 'orggoals'); }
  function host() {
    var sec = document.getElementById('orggoals'); if (!sec) return null;
    var h = document.getElementById('w205');
    if (!h) { h = document.createElement('div'); h.id = 'w205'; sec.appendChild(h); }
    return h;
  }
  function approvalLabel() { var a = S.plan.approval || {}; return a.label || 'Draft for board approval (19 Oct 2026)'; }
  function approved() { return S.goals.length && S.goals.every(function (g) { return g.approval === 'approved'; }); }

  function mastHtml(title, line) {
    return '<header class="w205mast"><div><div class="crumb">' + (boardMode() ? 'Board' : 'Strategy') + '</div><h1>' + E(title) + '</h1>' + (line ? '<p>' + E(line) + '</p>' : '') + '</div><span class="sp"></span>' +
      '<div class="w205pres" data-w205pres></div></header>';
  }
  /* a field you click and type in; it saves itself (the database checks who may) */
  function ed(e, row, f, o) {
    o = o || {};
    var g = e === 'goal' ? row : byId(S.goals, row.goal_id);
    var k = key(e, row.id, f), can = canEdit(g), v = str(row[f]);
    var ph = can ? (o.ph || 'Click to write') : (o.empty || 'Not written yet');
    return '<textarea class="w205ed' + (o.cls ? ' ' + o.cls : '') + '" rows="1" data-w205k="' + E(k) + '" aria-label="' + E(o.label || f) + '" placeholder="' + E(ph) + '"' + (can ? '' : ' readonly tabindex="-1"') + ' data-w198skip spellcheck="true">' + E(v) + '</textarea>';
  }
  function stSel(e, row, f, list) {
    var g = e === 'goal' ? row : byId(S.goals, row.goal_id), can = canEdit(g), v = row[f] || list[0];
    var cls = e === 'goal' ? 'w205stsel' : 'w205dot';
    return '<select class="' + cls + ' s-' + stKey(v) + '" data-w205k="' + E(key(e, row.id, f)) + '" aria-label="' + (e === 'goal' ? 'Goal status' : 'Milestone status') + '" title="' + E(ST_LABEL[v] || v) + '"' + (can ? '' : ' disabled') + '>' +
      list.map(function (s) { return '<option value="' + E(s) + '"' + (s === v ? ' selected' : '') + '>' + E(ST_LABEL[s] || s) + '</option>'; }).join('') + '</select>';
  }
  function heroHtml() {
    var p = S.plan;
    return '<section class="w205hero" aria-label="Our mission"><div class="lab">Our mission</div><blockquote data-w198skip>' + E(p.mission || '') + '</blockquote><div class="bar"></div>' +
      '<p>' + E(p.mission_note || '') + (p.window ? ' ' + E(p.window) : '') + '</p></section>';
  }
  function statusHtml() {
    var ok = approved(), a = S.goals[0] || {};
    return '<div class="w205status">' +
      (ok ? '<span class="w205badge ok">' + I('check') + ' Approved by the board' + (a.approved_at ? ' · ' + E(fmtDay(a.approved_at)) : '') + '</span>'
          : '<span class="w205badge draft">' + I('flag') + ' ' + E(approvalLabel()) + '</span><span class="note">The board votes on these goals on Oct 19, 2026.</span>') +
      (isAdmin() && S.goals.length ? '<button type="button" class="w205btn sm" data-w205approve="' + (ok ? 'draft' : 'approved') + '">' + (ok ? 'Back to draft' : 'Mark approved by the board') + '</button>' : '') +
      '</div>' +
      (canComment() && S.goals.some(function (g) { return canEdit(g); }) ? '' : '<div class="w205ro" role="note">' + E(readOnlyWhy()) + '</div>');
  }
  function whyHtml() {
    var p = S.plan; if (!p.why_reset) return '';
    return '<details class="w205why" style="margin:0 0 6px"><summary class="w205link" style="list-style:none;display:inline-block">Why these goals</summary>' +
      '<div style="background:#FFFAF2;border:1px solid rgba(16,63,57,.1);border-radius:14px;padding:14px 16px;margin-top:8px;font-size:14px;line-height:1.55">' +
      '<p style="margin:0 0 8px">' + E(p.why_reset) + '</p>' + (p.long_range ? '<p style="margin:0 0 8px">' + E(p.long_range) + '</p>' : '') +
      (p.rule ? '<p style="margin:0"><b>Rule for every goal:</b> ' + E(p.rule) + '</p>' : '') + '</div></details>';
  }
  function ownerNames(gid) { return ownersOf(gid).map(function (o) { var m = memberById(o.member_id); return (m ? m.name : '?') + (o.is_lead ? ' (lead)' : ''); }).join(', '); }
  function glanceHtml() {
    if (!S.goals.length) return '';
    return '<div class="w205sec"><h2>The goals at a glance</h2><span class="hint">FY29 is the 3-year target; FY31 applies only if the FY29 gate is met.</span></div>' +
      '<div class="w205glance" data-w205glance><table><thead><tr><th>Goal</th><th>Headline measure</th><th>Baseline</th><th>FY29 (3-year)</th><th>FY31 (5-year, gated)</th><th>Owners</th><th>Charitable activities</th><th>Milestones</th></tr></thead><tbody>' +
      S.goals.map(function (g) {
        var pr = progress(g.id);
        return '<tr data-w205jump="' + g.id + '" tabindex="0" role="link" aria-label="Open goal ' + E(g.number) + '">' +
          '<td><span style="display:flex;gap:10px;align-items:center"><span class="w205num">' + E(g.number) + '</span><b data-w198skip>' + E(g.title) + '</b></span></td>' +
          '<td data-l="Measure" data-w198skip>' + E(g.measure) + '</td><td data-l="Baseline" data-w198skip>' + E(g.baseline) + '</td>' +
          '<td data-l="FY29" class="t29" data-w198skip>' + E(g.target_fy29) + '</td><td data-l="FY31" class="g31" data-w198skip>' + E(g.target_fy31) + '</td>' +
          '<td data-l="Owners" data-w198skip>' + E(ownerNames(g.id)) + '</td><td data-l="Activities">' + actsMini(g.id) + '</td><td data-l="Milestones">' + pr.done + ' of ' + pr.total + ' done</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function paintGlance() { var el = document.querySelector('#w205 [data-w205glance]'); if (!el) return; var tmp = document.createElement('div'); tmp.innerHTML = glanceHtml(); var n = tmp.querySelector('[data-w205glance]'); if (n) el.innerHTML = n.innerHTML; }

  function ownersHtml(g) {
    var can = canEdit(g);
    return ownersOf(g.id).map(function (o) {
      var m = memberById(o.member_id) || { name: 'Someone' };
      var inner = av(m, 24) + '<span data-w198skip>' + E(m.name) + '</span>' + (o.is_lead ? '<span class="lead">Lead</span>' : '') + (o.focus ? '<span class="focus" data-w198skip>' + E(o.focus) + '</span>' : '');
      return can ? '<button type="button" class="w205chip" data-w205owner="' + g.id + ':' + o.member_id + '" aria-label="' + E(m.name) + ': owner options">' + inner + '</button>' : '<span class="w205chip">' + inner + '</span>';
    }).join('') + (can ? '<button type="button" class="w205chip add" data-w205addowner="' + g.id + '">' + I('plus') + ' Owner</button>' : '') +
      (ownersOf(g.id).length ? '' : '<span style="font-size:12.5px;color:' + MUTED + '">No owner yet.</span>');
  }
  function paintOwners(gid) { var el = document.querySelector('#w205 [data-w205owners="' + gid + '"]'); var g = byId(S.goals, gid); if (el && g) el.innerHTML = ownersHtml(g); paintGlance(); }
  function progHtml(g) {
    var pr = progress(g.id);
    return '<div class="trk" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pr.pct + '" aria-label="Milestones done, FY27 to FY29"><i style="width:' + pr.pct + '%"></i></div>' +
      '<span><b style="color:' + GREEN + '">' + pr.done + ' of ' + pr.total + '</b> milestones done, FY27 to FY29' + (pr.yTotal ? ' · ' + E(pr.fy) + ': ' + pr.yDone + ' of ' + pr.yTotal : '') + '</span>';
  }
  function paintProgress(gid) { var el = document.querySelector('#w205 [data-w205prog="' + gid + '"]'); var g = byId(S.goals, gid); if (el && g) el.innerHTML = progHtml(g); }
  function projChip(p) {
    return '<button type="button" class="w205pj" data-w205proj="' + p.id + '" title="' + E(deptLabel(p.department)) + ': ' + E(p.name) + '"><i class="d" style="background:' + E(deptColor(p.department)) + '"></i><span data-w198skip>' + E(p.name) + '</span></button>';
  }
  function cntBtn(gid, mid) {
    var n = commentsOf(gid, mid == null ? undefined : mid).length;
    if (mid == null) n = commentsOf(gid).length;
    return '<button type="button" class="w205cnt' + (n ? ' has' : '') + '" data-w205cmts="' + gid + (mid != null ? ':' + mid : '') + '" aria-label="' + (mid != null ? 'Comments on this milestone' : 'Comments on this goal') + ' (' + n + ')">' + I('chat') + (n ? n : '') + '</button>';
  }
  function msHtml(m, g) {
    var can = canEdit(g), ps = S.projects.filter(function (p) { return String(p.milestone_id) === String(m.id); });
    return '<div class="w205ms' + (m.status === 'done' ? ' done' : '') + '" data-w205ms="' + m.id + '"><div class="row">' + stSel('milestone', m, 'status', MS_ST) +
      ed('milestone', m, 'body', { label: m.fy + ' milestone', ph: 'Write the milestone' }) +
      (can ? '<button type="button" class="w205rm" data-w205rm="milestone:' + m.id + '" aria-label="Remove this milestone">' + I('x') + '</button>' : '') + '</div>' +
      '<div class="w205msft">' + ps.map(projChip).join('') + cntBtn(g.id, m.id) +
      (canComment() ? '<button type="button" class="w205cnt" data-w205link="' + g.id + ':' + m.id + '" aria-label="Link a project to this milestone">' + I('link') + '</button>' : '') + '</div></div>';
  }
  function yearsHtml(g) {
    var ms = msOf(g.id), now = currentFy(), can = canEdit(g);
    var fys = FYS.slice(); ms.forEach(function (m) { if (fys.indexOf(m.fy) < 0) fys.push(m.fy); }); fys.sort();
    return fys.map(function (fy) {
      var list = ms.filter(function (m) { return m.fy === fy; }), done = list.filter(function (m) { return m.status === 'done'; }).length;
      return '<div class="w205yr' + (fy === 'FY31' || fy === 'FY30' ? ' gated' : '') + (fy === now ? ' now' : '') + '"><div class="yh"><b>' + fy + '</b><span>' + E(FY_LABEL[fy] || '') + '</span>' + (list.length ? '<em>' + done + '/' + list.length + '</em>' : '') + '</div>' +
        list.map(function (m) { return msHtml(m, g); }).join('') +
        (list.length ? '' : '<p style="font-size:12.5px;color:' + MUTED + ';margin:2px 2px 8px">' + (can ? 'No milestone yet.' : 'No milestone for this year.') + '</p>') +
        (can ? '<button type="button" class="w205addms" data-w205addms="' + g.id + ':' + fy + '">' + I('plus') + ' Add a milestone</button>' : '') +
        (fy === 'FY31' ? '<p style="font-size:11px;color:' + MUTED + ';margin:6px 2px 0">Only if the FY29 gate is met.</p>' : '') + '</div>';
    }).join('');
  }
  function pathsHtml(g) {
    var can = canEdit(g), ps = pathsOf(g.id);
    return '<ol class="w205paths">' + ps.map(function (p) {
      return '<li data-w205path="' + p.id + '">' + ed('path', p, 'body', { label: 'Path', ph: 'Write the path' }) + (can ? '<button type="button" class="w205rm" data-w205rm="path:' + p.id + '" aria-label="Remove this path">' + I('x') + '</button>' : '') + '</li>';
    }).join('') + '</ol>' + (ps.length ? '' : '<p style="font-size:13px;color:' + MUTED + ';margin:0">' + (can ? 'No path yet: add how we get there.' : 'No path written yet.') + '</p>');
  }
  function projectsHtml(g) {
    var ms = {}; msOf(g.id).forEach(function (m) { ms[m.id] = 1; });
    var ps = projOf(g.id).filter(function (p) { return !p.milestone_id || !ms[p.milestone_id]; });
    var all = projOf(g.id);
    return '<div class="w205projs">' + (ps.length ? ps.map(projChip).join('') : '') +
      (canComment() ? '<button type="button" class="w205btn sm" data-w205link="' + g.id + '">' + I('link') + ' Link a project</button>' : '') +
      (all.length ? '' : '<span style="font-size:12.5px;color:' + MUTED + '">' + (canComment() ? 'No project serves this goal yet.' : 'No project linked yet.') + '</span>') + '</div>';
  }
  function paintProjects(gid) {
    var g = byId(S.goals, gid); if (!g) return;
    var el = document.querySelector('#w205 [data-w205projs="' + gid + '"]'); if (el) el.innerHTML = projectsHtml(g);
    msOf(gid).forEach(function (m) {
      var box = document.querySelector('#w205 [data-w205ms="' + m.id + '"] .w205msft'); if (!box) return;
      var ps = S.projects.filter(function (p) { return String(p.milestone_id) === String(m.id); });
      box.innerHTML = ps.map(projChip).join('') + cntBtn(g.id, m.id) + (canComment() ? '<button type="button" class="w205cnt" data-w205link="' + g.id + ':' + m.id + '" aria-label="Link a project to this milestone">' + I('link') + '</button>' : '');
    });
    var c = document.querySelector('#w205 [data-w205pcount="' + gid + '"]'); if (c) c.textContent = projOf(gid).length ? '(' + projOf(gid).length + ')' : '';
    paintCpFoot(gid);
  }
  function paintCounts(gid) {
    var b = document.querySelector('#w205 [data-w205cmtsft="' + gid + '"]'); var n = commentsOf(gid).length;
    if (b) b.innerHTML = I('chat') + ' Comments' + (n ? ' (' + n + ')' : '');
    msOf(gid).forEach(function (m) { var x = document.querySelector('#w205 [data-w205cmts="' + gid + ':' + m.id + '"]'); if (x) x.outerHTML = cntBtn(gid, m.id); });
  }
  function goalBodyHtml(g) {
    return '<div class="w205prog" data-w205prog="' + g.id + '">' + progHtml(g) + '</div>' +
      '<div class="w205two"><div class="w205smart"><div class="w205lab">SMART <span class="who" data-w205who="' + E(key('goal', g.id, 'detail')) + '" hidden></span></div>' + ed('goal', g, 'detail', { label: 'SMART statement', ph: 'Write the goal as the board will read it' }) + '</div>' +
      '<div><div class="w205lab">Why <span class="who" data-w205who="' + E(key('goal', g.id, 'why')) + '" hidden></span></div>' + ed('goal', g, 'why', { label: 'Why', ph: 'Why this goal matters' }) + '</div></div>' +
      '<div class="w205meas">' + [['measure', 'Headline measure'], ['baseline', 'Baseline'], ['target_fy29', 'FY29 target'], ['target_fy31', 'FY31 target, gated']].map(function (x) {
        return '<div' + (x[0] === 'target_fy29' ? ' class="t29"' : '') + '><div class="w205lab">' + E(x[1]) + ' <span class="who" data-w205who="' + E(key('goal', g.id, x[0])) + '" hidden></span></div>' + ed('goal', g, x[0], { label: x[1], ph: 'Add it' }) + '</div>';
      }).join('') + '</div>' +
      '<div class="w205h4"><h4>Paths</h4><span style="font-size:12px;color:' + MUTED + '">How we get there</span><span class="sp"></span>' + (canEdit(g) ? '<button type="button" class="w205btn sm ghost" data-w205addpath="' + g.id + '">' + I('plus') + ' Add a path</button>' : '') + '</div>' +
      '<div data-w205paths="' + g.id + '">' + pathsHtml(g) + '</div>' +
      yearBlockHtml(g) +
      '<div class="w205h4"><h4>Milestones</h4><span style="font-size:12px;color:' + MUTED + '">By fiscal year (Oct 1 to Sep 30)</span></div>' +
      '<div class="w205years" data-w205years="' + g.id + '">' + yearsHtml(g) + '</div>' +
      '<div class="w205h4"><h4>Projects serving this goal <span data-w205pcount="' + g.id + '" style="font-family:' + BODY + ';font-size:13px;color:' + MUTED + ';text-transform:none">' + (projOf(g.id).length ? '(' + projOf(g.id).length + ')' : '') + '</span></h4></div>' +
      '<div data-w205projs="' + g.id + '">' + projectsHtml(g) + '</div>';
  }
  function goalHtml(g) {
    var folded = !!S.folded[g.id] && String(S.goalId) !== String(g.id);
    var n = commentsOf(g.id).length;
    return '<article class="w205goal' + (folded ? ' folded' : '') + (String(S.goalId) === String(g.id) ? ' target' : '') + '" id="w205g-' + g.id + '" data-w205goal="' + g.id + '" aria-labelledby="w205gt-' + g.id + '">' +
      '<div class="w205ghd"><span class="w205num" aria-hidden="true">' + E(g.number) + '</span><div class="tw" id="w205gt-' + g.id + '">' + ed('goal', g, 'title', { cls: 'title', label: 'Goal ' + g.number + ' title', ph: 'Name the goal' }) + '</div>' +
      '<div class="side"><span class="w205pres" style="margin:0" data-w205gpres="' + g.id + '"></span>' + stSel('goal', g, 'status', GOAL_ST) + '<span class="w205saved" data-w205saved="' + g.id + '" aria-live="polite"></span>' +
      '<button type="button" class="w205fold" data-w205fold="' + g.id + '" aria-expanded="' + (folded ? 'false' : 'true') + '" aria-label="Fold or open this goal">' + I('chev') + '</button></div></div>' +
      '<div class="w205owners" data-w205owners="' + g.id + '">' + ownersHtml(g) + '</div>' +
      '<div class="w207acts" data-w207acts="' + g.id + '">' + actsHtml(g) + '</div>' +
      '<div class="w205gbody" data-w205gbody="' + g.id + '">' + goalBodyHtml(g) + '</div>' +
      '<div class="w205gft"><button type="button" class="w205btn sm" data-w205cmtsft="' + g.id + '" data-w205cmts="' + g.id + '">' + I('chat') + ' Comments' + (n ? ' (' + n + ')' : '') + '</button>' +
      '<button type="button" class="w205btn sm" data-w205hist="' + g.id + '">' + I('clock') + ' History</button>' +
      '<span class="sp"></span><span>Due ' + E(fmtDay(g.due_date)) + (canEdit(g) ? '' : ' · read only') + '</span></div></article>';
  }
  /* repaint one goal's body without losing what someone is typing */
  function repaintGoal(gid, keepFocus) {
    var g = byId(S.goals, gid), box = document.querySelector('#w205 [data-w205gbody="' + gid + '"]'); if (!g || !box) return;
    var act = document.activeElement, actKey = act && box.contains(act) ? act.getAttribute('data-w205k') : null, sel = null;
    if (actKey && act.selectionStart != null) sel = [act.selectionStart, act.selectionEnd];
    var keep = {};
    box.querySelectorAll('[data-w205k]').forEach(function (el) { var k = el.getAttribute('data-w205k'); if (S.dirty[k] || S.conflict[k]) keep[k] = el.value; });
    box.innerHTML = goalBodyHtml(g);
    Object.keys(keep).forEach(function (k) { var el = fieldEl(k); if (el) el.value = keep[k]; if (S.conflict[k]) paintConflict(k); });
    box.querySelectorAll('textarea.w205ed').forEach(grow);
    if (keepFocus && actKey) { var n = fieldEl(actKey); if (n) { n.focus(); if (sel) try { n.setSelectionRange(sel[0], sel[1]); } catch (e) { /* fine */ } } }
    paintGlance(); paintPresence();
  }
  function roadHtml() {
    var r = S.plan.roadmap; if (!r) return '';
    var ph = r.phases || [];
    return '<div class="w205sec"><h2>Roadmap</h2><span class="hint">Four phases, one checkpoint, one gate.</span></div>' +
      '<section class="w205road" aria-label="Roadmap"><h3>' + E(r.title || '') + '</h3><div class="bar"></div>' +
      '<div class="w205phases">' + ph.map(function (p) {
        return '<div class="w205ph' + (p.gated ? ' gated' : '') + '"><div class="k">' + E(p.key + ' ' + p.name) + '</div><div class="d">' + E(p.dates) + (p.gated ? ' · gated' : '') + '</div><ul>' + (p.items || []).map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul></div>';
      }).join('') + '</div>' +
      '<div class="w205marks"><div></div>' +
      (r.checkpoint ? '<div class="w205mk"><b>' + E(r.checkpoint.name) + '</b><ul>' + (r.checkpoint.items || []).map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul></div>' : '<div></div>') + '<div></div>' +
      (r.gate ? '<div class="w205mk gt"><b>' + E(r.gate.name) + '</b><ul>' + (r.gate.items || []).map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul></div>' : '') + '</div>' +
      (r.gate_rule ? '<p class="w205rule">' + E(r.gate_rule) + '</p>' : '') + '</section>' +
      (S.plan.cadence && S.plan.cadence.length ? '<div class="w205list" style="margin-top:12px"><div class="it" style="font-weight:700;color:' + GREEN + '">How we track it</div>' + S.plan.cadence.map(function (c) { return '<div class="it">' + E(c) + '</div>'; }).join('') + '</div>' : '');
  }
  function unlinkedList() {
    return S.projects.filter(function (p) {
      var s = lower(p.status || 'active'); if (/done|complete|closed|archiv/.test(s)) return false;
      return !p.goal_id || !byId(S.goals, p.goal_id);
    }).sort(function (a, b) { return String(a.department).localeCompare(String(b.department)) || String(a.name).localeCompare(String(b.name)); });
  }
  function unlinkedHtml() {
    var list = unlinkedList();
    return '<div class="w205sec"><h2>Projects not linked to a goal yet</h2><span class="hint">Departments own projects; each one serves a goal.</span></div>' +
      (list.length ? '<div class="w205list" data-w205unlinked>' + list.map(function (p) {
        var was = p.goal_id ? byId(S.allGoals || [], p.goal_id) : null;
        return '<div class="it"><i style="width:9px;height:9px;border-radius:50%;background:' + E(deptColor(p.department)) + ';flex:none"></i><div class="t"><b data-w198skip>' + E(p.name) + '</b><small>' + E(deptLabel(p.department)) + (was ? ' · was linked to a retired goal: <span data-w198skip>' + E(clip(was.title, 70)) + '</span>' : '') + '</small></div>' +
          (canComment() ? '<button type="button" class="w205btn sm" data-w205linkp="' + p.id + '">' + I('link') + ' Link</button>' : '') + '</div>';
      }).join('') + '</div>' : '<div class="w205empty" data-w205unlinked><b>Every project serves a goal</b>Nothing to link.</div>');
  }
  function paintUnlinked() { var el = document.querySelector('#w205 [data-w205unlinked]'); if (!el) return; var t = document.createElement('div'); t.innerHTML = unlinkedHtml(); var n = t.querySelector('[data-w205unlinked]'); if (n) el.replaceWith(n); }
  function libPreviewHtml() {
    var pinned = S.docs.filter(function (d) { return d.pinned; }).slice(0, 6);
    return '<div class="w205sec"><h2>Strategy Library</h2><span class="hint">The documents that set our direction, pinned for everyone.</span><span class="sp"></span><button type="button" class="w205btn sm" data-w205go="#orggoals/library">' + I('doc') + ' Open the library (' + S.docs.length + ')</button></div>' +
      (pinned.length ? '<div class="w205lib">' + pinned.map(function (d) { return docHtml(d, true); }).join('') + '</div>' : '<div class="w205empty"><b>Nothing pinned yet</b>' + (isAdmin() ? 'Pin the documents everyone should read from the library.' : 'Admins pin the documents everyone should read.') + '</div>');
  }
  function goalsViewHtml() {
    var p = S.plan;
    if (!S.goals.length) {
      return mastHtml('Goals', p.window || '') + heroHtml() + '<div class="w205empty"><b>No organizational goals yet</b>' + (S.err ? 'The goals could not be read (' + E(clip(S.err, 120)) + ').' : 'When the goals are written, they show here.') + '</div>';
    }
    return mastHtml('Goals', 'Five goals for FY27 to FY29, with a gated view to FY31. Departments own projects; each one serves a goal.') +
      heroHtml() + statusHtml() + yearViewHtml() + whyHtml() + glanceHtml() + coverageHtml() +
      '<div class="w205sec"><h2>Goal by goal</h2><span class="hint">' + (S.goals.some(canEdit) ? 'Click any text to change it; it saves as you type.' : 'Owners keep these up to date.') + '</span></div>' +
      S.goals.map(goalHtml).join('') + roadHtml() + libPreviewHtml() + unlinkedHtml() +
      '<div class="w205more"><button type="button" class="w205tile" data-w205go="#goalmap"><b>Goal alignment</b><span>Every project and the goal it serves, on one map.</span></button>' +
      '<button type="button" class="w205tile" data-w205go="#projects"><b>Projects</b><span>Every department’s projects, their leads and their goals.</span></button>' +
      '<button type="button" class="w205tile" data-w205go="#orggoals/retired"><b>Retired goals (' + S.retired.length + ')</b><span>The department goals and the three earlier org goals, kept with their wins and comments.</span></button></div>' +
      (p.source && p.source.title ? '<p style="font-size:12px;color:' + MUTED + ';margin:18px 0 0">From the draft "' + E(p.source.title) + '".</p>' : '');
  }
