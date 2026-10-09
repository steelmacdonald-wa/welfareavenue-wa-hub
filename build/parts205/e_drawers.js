
  /* ---------- the drawer: comments, history, link a project, owners, a library document ---------- */
  function ensureDrawer() {
    if (document.getElementById('w205drawer')) return;
    var s = document.createElement('div'); s.id = 'w205scrim'; s.setAttribute('data-w205close', '1');
    var d = document.createElement('aside'); d.id = 'w205drawer'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'w205dt'); d.setAttribute('aria-hidden', 'true');
    document.body.appendChild(s); document.body.appendChild(d);
  }
  function openDrawer(st) {
    ensureDrawer();
    S.drawer = st; S.drawer.opener = document.activeElement;
    paintDrawer();
    var d = document.getElementById('w205drawer'), s = document.getElementById('w205scrim');
    d.classList.add('open'); s.classList.add('open'); d.setAttribute('aria-hidden', 'false');
    setTimeout(function () { var f = d.querySelector('[data-w205autofocus]') || d.querySelector('textarea,input,button'); if (f) try { f.focus(); } catch (e) { /* fine */ } }, 60);
  }
  function closeDrawer() {
    var d = document.getElementById('w205drawer'), s = document.getElementById('w205scrim');
    if (!d || !S.drawer) return;
    var op = S.drawer.opener; S.drawer = null;
    d.classList.remove('open'); s.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
    if (onPage() && /\/(comments|history)/.test(location.hash)) { try { history.replaceState(null, '', '#orggoals/goal/' + S.goalId); } catch (e) { /* fine */ } }
    if (op && document.body.contains(op)) try { op.focus(); } catch (e) { /* fine */ }
  }
  function drawerShell(title, sub, body, foot) {
    return '<div class="dh"><div><h3 id="w205dt">' + title + '</h3>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><span class="sp"></span><button type="button" class="w205btn sm ghost" data-w205close="1" aria-label="Close">' + I('x') + '</button></div>' +
      '<div class="db">' + body + '</div>' + (foot ? '<div class="df">' + foot + '</div>' : '');
  }
  function paintDrawer() {
    var d = document.getElementById('w205drawer'); if (!d || !S.drawer) return;
    var st = S.drawer, html = '';
    var keepVal = null, ta = d.querySelector('textarea[data-w205cmt]'); if (ta) keepVal = { v: ta.value, focus: document.activeElement === ta, s: ta.selectionStart };
    var keepReply = {}; d.querySelectorAll('textarea[data-w205reply]').forEach(function (t) { keepReply[t.getAttribute('data-w205reply')] = t.value; });
    if (st.kind === 'comments') html = commentsDrawer(st);
    else if (st.kind === 'history') html = historyDrawer(st);
    else if (st.kind === 'link') html = linkDrawer(st);
    else if (st.kind === 'owner') html = ownerDrawer(st);
    else if (st.kind === 'doc') html = docDrawer(st);
    else if (st.kind === 'acts') html = actsDrawer(st);
    d.innerHTML = html;
    if (keepVal) { var t2 = d.querySelector('textarea[data-w205cmt]'); if (t2) { t2.value = keepVal.v; if (keepVal.focus) { t2.focus(); try { t2.setSelectionRange(keepVal.s, keepVal.s); } catch (e) { /* fine */ } } } }
    Object.keys(keepReply).forEach(function (k) { var t = d.querySelector('textarea[data-w205reply="' + k + '"]'); if (t) t.value = keepReply[k]; });
  }

  /* comments, threaded; @mentions through wave138 (the picker and the DM it already sends) */
  function markText(s) { var h = E(s); try { if (window.w138Mark) h = window.w138Mark(h); } catch (e) { /* fine */ } return h; }
  function commentHtml(c, gid, canReply) {
    var mine = c.author_email && lower(c.author_email) === myEmail();
    var m = memberByEmail(c.author_email) || { name: c.author || 'Someone' };
    var editing = S.drawer && String(S.drawer.editing) === String(c.id);
    return '<div class="w205cm" data-w205c="' + c.id + '">' + av(m, 28) + '<div class="bd"><div class="who" data-w198skip>' + E(c.author || m.name) + '<small>' + E(fmtWhen(c.created_at)) + (c.edited_at ? ' · edited' : '') + '</small></div>' +
      (editing ? '<textarea data-w205edit="' + c.id + '" aria-label="Edit your comment">' + E(c.body) + '</textarea><div class="acts"><button type="button" class="w205btn sm pri" data-w205editsave="' + c.id + '">Save</button><button type="button" class="w205btn sm ghost" data-w205editcancel="1">Cancel</button></div>'
        : '<div class="tx" data-w198skip>' + markText(c.body) + '</div>') +
      (!editing ? '<div class="ln">' + (canReply ? '<button type="button" class="w205link" data-w205replyto="' + c.id + '">Reply</button>' : '') + ((mine || isAdmin()) && canComment() ? '<button type="button" class="w205link" data-w205editc="' + c.id + '">Edit</button>' : '') + '</div>' : '') + '</div></div>';
  }
  function commentsDrawer(st) {
    var g = byId(S.goals, st.goal) || byId(S.allGoals || [], st.goal);
    if (!g) return drawerShell('Comments', '', '<p>That goal is not here.</p>');
    var ms = msOf(g.id), mid = st.milestone || null, cid = st.checkpoint || null, can = canComment();
    var all = commentsOf(g.id);
    var roots = all.filter(function (c) { return !c.parent_id && (cid ? String(c.checkpoint_id) === String(cid) : mid ? String(c.milestone_id) === String(mid) : true); });
    var seg = '<div class="w205seg" role="tablist"><button type="button" role="tab" class="' + (!mid && !cid ? 'on' : '') + '" data-w205cseg="" aria-selected="' + (!mid && !cid) + '">Everything (' + all.length + ')</button>' +
      cpsOfGoal(g.id).filter(function (c) { return all.some(function (x) { return String(x.checkpoint_id) === String(c.id); }) || String(c.id) === String(cid); }).map(function (c) {
        var n = all.filter(function (x) { return String(x.checkpoint_id) === String(c.id); }).length;
        return '<button type="button" role="tab" class="' + (String(c.id) === String(cid) ? 'on' : '') + '" data-w207cseg="' + c.id + '" title="' + E(c.body) + '" aria-selected="' + (String(c.id) === String(cid)) + '">' + E(cpLabel(c)) + ' (' + n + ')</button>';
      }).join('') +
      ms.filter(function (m) { return all.some(function (c) { return String(c.milestone_id) === String(m.id); }) || String(m.id) === String(mid); }).map(function (m) {
        var n = all.filter(function (c) { return String(c.milestone_id) === String(m.id); }).length;
        return '<button type="button" role="tab" class="' + (String(m.id) === String(mid) ? 'on' : '') + '" data-w205cseg="' + m.id + '" title="' + E(m.body) + '" aria-selected="' + (String(m.id) === String(mid)) + '">' + E(m.fy) + ': ' + E(clip(m.body, 26)) + ' (' + n + ')</button>';
      }).join('') + '</div>';
    var threads = roots.map(function (c) {
      var reps = all.filter(function (r) { return String(r.parent_id) === String(c.id); });
      var mm = c.milestone_id ? byId(S.milestones, c.milestone_id) : null, cc = c.checkpoint_id ? byId(S.checkpoints, c.checkpoint_id) : null;
      return '<div class="w205th">' + (mm && !mid ? '<span class="w205ms-tag" data-w198skip>' + E(mm.fy) + ': ' + E(clip(mm.body, 40)) + '</span>' : '') + (cc && !cid ? '<span class="w205ms-tag" data-w198skip>' + E(cpLabel(cc)) + ': ' + E(clip(cc.body, 40)) + '</span>' : '') + commentHtml(c, g.id, can) +
        (reps.length || String(st.replyTo) === String(c.id) ? '<div class="w205replies">' + reps.map(function (r) { return commentHtml(r, g.id, false); }).join('') +
          (String(st.replyTo) === String(c.id) ? '<div style="margin-top:10px"><textarea data-w205reply="' + c.id + '" data-w205cmt="reply" placeholder="Write a reply. Type @ to bring someone in." aria-label="Your reply" data-w205autofocus></textarea><div class="acts"><button type="button" class="w205btn sm pri" data-w205sendreply="' + c.id + '">Reply</button><button type="button" class="w205btn sm ghost" data-w205replyto="">Cancel</button></div></div>' : '') + '</div>' : '') + '</div>';
    }).join('');
    var msNow = mid ? byId(S.milestones, mid) : null, cpNow = cid ? byId(S.checkpoints, cid) : null;
    var body = seg + (threads || '<div class="w205empty"><b>No comments yet</b>' + (can ? 'Start the conversation: a question, a link, an @mention.' : 'When the team talks about this goal, it shows here.') + '</div>');
    var foot = can ? '<textarea data-w205cmt="new" placeholder="' + (cpNow ? 'Comment on this checkpoint' : msNow ? 'Comment on this milestone' : 'Comment on this goal') + '. Type @ to bring someone in." aria-label="Your comment"' + (st.replyTo ? '' : ' data-w205autofocus') + '></textarea>' +
      '<div class="acts"><small>' + (cpNow ? 'On ' + E(cpLabel(cpNow)) + ': ' + E(clip(cpNow.body, 40)) : msNow ? 'On ' + E(msNow.fy) + ': ' + E(clip(msNow.body, 40)) : 'On the whole goal') + ' · Ctrl+Enter posts</small><span class="sp"></span><button type="button" class="w205btn pri sm" data-w205post="1">Post</button></div>' +
      '<small style="display:block;color:' + MUTED + ';font-size:11px;margin-top:6px">People you @mention hear about it the way every Hub @mention works.</small>'
      : '<small style="color:' + MUTED + '">' + E(readOnlyWhy()) + '</small>';
    return drawerShell('Comments', '<span data-w198skip>Goal ' + E(g.number || '') + ': ' + E(g.title) + '</span>', body, foot);
  }
  function postComment(parent) {
    var d = document.getElementById('w205drawer'); if (!d || !S.drawer) return;
    var ta = parent ? d.querySelector('textarea[data-w205reply="' + parent + '"]') : d.querySelector('textarea[data-w205cmt="new"]');
    var body = ta ? ta.value.trim() : ''; if (!body) { if (ta) ta.focus(); return; }
    var st = S.drawer, btn = d.querySelector(parent ? '[data-w205sendreply="' + parent + '"]' : '[data-w205post]'); if (btn) btn.disabled = true;
    var pc = parent ? byId(S.comments, parent) : null, cpId = parent ? (pc && pc.checkpoint_id) : st.checkpoint;
    (cpId ? rpc('strategy_checkpoint_comment_add', { p_checkpoint: Number(cpId), p_parent: parent ? Number(parent) : null, p_body: body })
      : rpc('strategy_comment_add', { p_goal: Number(st.goal), p_milestone: parent ? null : (st.milestone ? Number(st.milestone) : null), p_parent: parent ? Number(parent) : null, p_body: body })).then(function (row) {
      if (row && row.id && !byId(S.comments, row.id)) S.comments.push(row);
      if (ta) ta.value = '';
      if (parent) st.replyTo = null;
      paintDrawer(); paintCounts(st.goal); paintYearCounts(st.goal);
      toastS('Comment posted');
    }).catch(function (e) { toastS('Not posted: ' + errText(e)); if (btn) btn.disabled = false; });
  }
  function saveEdit(id) {
    var d = document.getElementById('w205drawer'), ta = d && d.querySelector('textarea[data-w205edit="' + id + '"]'); if (!ta) return;
    rpc('strategy_comment_edit', { p_id: Number(id), p_body: ta.value }).then(function (row) {
      var c = byId(S.comments, id); if (c && row) Object.assign(c, row);
      S.drawer.editing = null; paintDrawer();
    }).catch(function (e) { toastS('Not saved: ' + errText(e)); });
  }

  /* the history: every change, who and when, with Restore */
  function histLabel(h) {
    var f = FIELD_LABEL[h.field] || h.field;
    if (h.entity === 'goal') return 'changed ' + f;
    if (h.entity === 'milestone') return h.field === 'added' ? 'added a milestone' : h.field === 'archived_at' ? (h.new_value ? 'removed a milestone' : 'brought back a milestone') : 'changed a milestone’s ' + (h.field === 'body' ? 'text' : f.replace(/^the /, ''));
    if (h.entity === 'path') return h.field === 'added' ? 'added a path' : h.field === 'archived_at' ? (h.new_value ? 'removed a path' : 'brought back a path') : 'changed a path';
    if (h.entity === 'owner') return h.field === 'added' ? 'added an owner' : h.field === 'removed' ? 'took an owner off' : h.field === 'is_lead' ? 'changed the lead' : 'changed an owner’s focus';
    if (h.entity === 'project') return h.field === 'goal_id' ? (h.new_value ? 'linked a project' : 'unlinked a project') : h.field === 'checkpoint_id' ? (h.new_value ? 'linked a project to a checkpoint' : 'took a project off a checkpoint') : 'moved a project to a milestone';
    if (h.entity === 'activity') return h.field === 'added' ? 'anchored the goal on a charitable activity' : h.field === 'archived_at' ? (h.new_value ? 'took a charitable activity off' : 'brought back a charitable activity') : 'changed why it serves a charitable activity';
    if (h.entity === 'target') return h.field === 'owners' ? 'changed who reports on the yearly target' : 'changed the yearly target';
    if (h.entity === 'checkpoint') return 'changed a checkpoint’s ' + (h.field === 'body' ? 'text' : h.field === 'due_date' ? 'due date' : f.replace(/^the /, ''));
    return 'changed ' + f;
  }
  function restorable(h) {
    if (h.entity === 'project') return canComment();
    var g = byId(S.goals, h.goal_id); if (!canEdit(g)) return false;
    if (h.entity === 'goal') return ['title', 'detail', 'why', 'measure', 'baseline', 'target_fy29', 'target_fy31', 'status', 'due_date', 'activities_note'].indexOf(h.field) >= 0;
    return true;
  }
  function histVal(h, v) {
    if (v == null || v === '') return '';
    if (h.field === 'archived_at') return '';
    if (h.field === 'status') return ST_LABEL[v] || v;
    if (h.field === 'is_lead') return v === 'true' ? 'Lead' : 'Not the lead';
    return v;
  }
  function historyDrawer(st) {
    var g = byId(S.goals, st.goal); if (!g) return drawerShell('History', '', '<p>That goal is not here.</p>');
    var body;
    if (st.loading) body = '<p style="color:' + MUTED + '">Reading the history…</p>';
    else if (st.err) body = '<div class="w205empty"><b>The history could not be read</b>' + E(st.err) + '</div>';
    else if (!st.rows || !st.rows.length) body = '<div class="w205empty"><b>No changes yet</b>Every change to this goal shows here, with who made it and when.</div>';
    else {
      var day = '', out = [];
      st.rows.forEach(function (h) {
        var dd = fmtDay(h.changed_at); if (dd !== day) { day = dd; out.push('<div class="w205hday">' + E(dd) + '</div>'); }
        var ov = histVal(h, h.old_value), nv = histVal(h, h.new_value), simple = (h.entity === 'project' && h.field !== 'checkpoint_id') || h.entity === 'owner' || h.field === 'added' || (h.field === 'archived_at' && h.entity !== 'activity');
        if (h.entity === 'activity' && h.field === 'archived_at') { simple = true; nv = h.new_value || h.old_value || ''; }
        var cpx = h.entity === 'checkpoint' ? cpLabel(byId(S.checkpoints, h.entity_id)) : '';
        out.push('<div class="w205h" data-w205h="' + h.id + '"><div class="l1"><span><b data-w198skip>' + E(h.changed_by_name || h.changed_by || 'Someone') + '</b> ' + E(histLabel(h)) + '</span><span class="sp"></span><small>' + E(new Date(h.changed_at).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })) + '</small></div>' +
          (h.restored_from ? '<span class="rs">A restore</span>' : '') + (cpx ? '<span class="w205ms-tag">' + E(cpx) + '</span>' : '') +
          (simple ? ((nv || ov) ? '<span class="nv" data-w198skip>' + E(nv || ov) + '</span>' : '') : (ov ? '<span class="ov" data-w198skip>' + E(ov) + '</span>' : '') + (nv ? '<span class="nv" data-w198skip>' + E(nv) + '</span>' : '<span class="nv"><i>cleared</i></span>')) +
          (restorable(h) ? '<div style="margin-top:6px"><button type="button" class="w205btn sm" data-w205restore="' + h.id + '">' + I('undo') + ' Restore</button></div>' : '') + '</div>');
      });
      body = out.join('');
    }
    return drawerShell('History', '<span data-w198skip>Goal ' + E(g.number) + ': ' + E(g.title) + '</span> · every change, newest first', body, canEdit(g) ? '<small style="color:' + MUTED + '">Restore puts the old version back; the restore is itself a change here, so nothing is lost.</small>' : '');
  }
  function loadHistory() {
    var st = S.drawer; if (!st || st.kind !== 'history') return;
    st.loading = true; paintDrawer();
    Promise.resolve(db.from('goal_history').select('*').eq('goal_id', Number(st.goal)).order('changed_at', { ascending: false }).limit(300)).then(function (r) {
      if (S.drawer !== st) return;
      st.loading = false; st.err = r && r.error ? (r.error.message || String(r.error)) : null; st.rows = (r && r.data) || [];
      st.rows.sort(function (a, b) { return String(b.changed_at).localeCompare(String(a.changed_at)) || b.id - a.id; });
      paintDrawer();
    }, function (e) { st.loading = false; st.err = errText(e); paintDrawer(); });
  }
  function restore(id) {
    rpc('strategy_restore', { p_history: Number(id) }).then(function (res) {
      if (res && res.conflict) { toastS('Someone changed that field again; read the latest first.'); }
      else toastS('Restored');
      S.loaded = 0;
      return loadAll(true).then(function () { paint(); if (S.drawer && S.drawer.kind === 'history') loadHistory(); });
    }).catch(function (e) { toastS('Not restored: ' + errText(e)); });
  }

  /* link a project to a goal and, ideally, one milestone */
  function linkDrawer(st) {
    var g = st.goal ? byId(S.goals, st.goal) : null;
    var qv = lower(st.q || '');
    var p = st.project ? byId(S.projects, st.project) : null;
    var body = '';
    if (!p) {
      var list = S.projects.filter(function (x) { var s = lower(x.status || 'active'); return !/done|complete|closed|archiv/.test(s); })
        .filter(function (x) { return !qv || lower(x.name + ' ' + deptLabel(x.department)).indexOf(qv) >= 0; })
        .sort(function (a, b) { return String(deptLabel(a.department)).localeCompare(String(deptLabel(b.department))) || String(a.name).localeCompare(String(b.name)); });
      var groups = {}; list.forEach(function (x) { (groups[x.department] = groups[x.department] || []).push(x); });
      body = '<label class="w205search" style="max-width:none;margin:0 0 10px">' + I('search') + '<input type="search" data-w205linkq value="' + E(st.q || '') + '" placeholder="Find a project" aria-label="Find a project" data-w205autofocus /></label>' +
        (list.length ? Object.keys(groups).map(function (d) {
          return '<div class="w205grp">' + E(deptLabel(d)) + '</div><div class="w205pick">' + groups[d].map(function (x) {
            var cur = x.goal_id ? byId(S.goals, x.goal_id) : null;
            return '<label><input type="radio" name="w205lp" data-w205pickp="' + x.id + '" /><span class="t"><span data-w198skip>' + E(x.name) + '</span><small>' + (cur ? 'Serves goal ' + E(cur.number) + (g && cur.id === g.id ? ' (this goal)' : '') : 'Not linked to a goal yet') + '</small></span></label>';
          }).join('') + '</div>';
        }).join('') : '<div class="w205empty"><b>No project matches</b>Projects are added on a team’s page or on Projects.</div>');
      return drawerShell('Link a project', g ? '<span data-w198skip>To goal ' + E(g.number) + ': ' + E(g.title) + '</span>' : 'Pick the project first', body, '<small style="color:' + MUTED + '">Teams own their projects; linking one says which goal (and milestone) it serves.</small>');
    }
    var goalSel = st.goalPick != null ? st.goalPick : (g ? g.id : p.goal_id);
    var gg = byId(S.goals, goalSel);
    var curG = p.goal_id ? byId(S.goals, p.goal_id) : null;
    body = '<div class="w205th"><b data-w198skip>' + E(p.name) + '</b><div style="font-size:12.5px;color:' + MUTED + ';margin-top:2px">' + E(deptLabel(p.department)) + ' · ' + (curG ? 'serves goal ' + E(curG.number) : 'not linked to a goal yet') + '</div>' +
      '<div style="margin-top:8px"><a class="w205btn sm" href="#project/' + p.id + '">Open the project</a></div></div>' +
      '<div class="w205grp">The goal it serves</div><div class="w205pick">' + S.goals.map(function (x) {
        return '<label class="' + (String(x.id) === String(goalSel) ? 'on' : '') + '"><input type="radio" name="w205lg" data-w205pickg="' + x.id + '"' + (String(x.id) === String(goalSel) ? ' checked' : '') + ' /><span class="w205num" style="width:24px;height:24px;font-size:13px">' + E(x.number) + '</span><span class="t" data-w198skip>' + E(x.title) + '</span></label>';
      }).join('') + '</div>' +
      (gg ? '<div class="w205grp">The milestone (optional)</div><div class="w205pick"><label class="' + (!st.msPick ? 'on' : '') + '"><input type="radio" name="w205lm" data-w205pickm=""' + (!st.msPick ? ' checked' : '') + ' /><span class="t">The goal as a whole</span></label>' +
        msOf(gg.id).map(function (m) { return '<label class="' + (String(st.msPick) === String(m.id) ? 'on' : '') + '"><input type="radio" name="w205lm" data-w205pickm="' + m.id + '"' + (String(st.msPick) === String(m.id) ? ' checked' : '') + ' /><span class="t"><span data-w198skip>' + E(m.body) + '</span><small>' + E(m.fy) + '</small></span></label>'; }).join('') + '</div>' : '') +
      (gg ? cpPickHtml(gg, st) : '');
    var foot = '<div class="acts" style="margin:0">' + (curG ? '<button type="button" class="w205btn sm ghost" data-w205unlink="' + p.id + '">Unlink</button>' : '') + '<span class="sp"></span><button type="button" class="w205btn sm ghost" data-w205close="1">Cancel</button><button type="button" class="w205btn pri" data-w205dolink="1"' + (gg ? '' : ' disabled') + '>' + I('link') + ' Link it</button></div>';
    return drawerShell(curG ? 'Move or unlink a project' : 'Link a project', '<span data-w198skip>' + E(p.name) + '</span>', body, foot);
  }
  function doLink(unlink) {
    var st = S.drawer; if (!st || st.kind !== 'link' || !st.project) return;
    var p = byId(S.projects, st.project), g = unlink ? null : (st.goalPick != null ? st.goalPick : (st.goal || (p && p.goal_id)));
    var m = unlink ? null : (st.msPick || null);
    var cp = unlink ? null : (st.cpPick || null);
    rpc('strategy_link_project', { p_project: Number(st.project), p_goal: g ? Number(g) : null, p_milestone: m ? Number(m) : null }).then(function () {
      /* wave207: the checkpoint after the goal (moving the goal clears a checkpoint of another goal) */
      var keep = p && p.checkpoint_id && cpsOfGoal(g).some(function (c) { return String(c.id) === String(p.checkpoint_id); }) ? p.checkpoint_id : null;
      if (String(cp || '') === String(keep || '')) return null;
      return rpc('strategy_link_checkpoint', { p_project: Number(st.project), p_checkpoint: cp ? Number(cp) : null });
    }).then(function () {
      if (p) { p.goal_id = g ? Number(g) : null; p.milestone_id = m ? Number(m) : null; p.checkpoint_id = cp ? Number(cp) : null; }
      paintYear();
      closeDrawer();
      S.goals.forEach(function (x) { paintProjects(x.id); }); paintUnlinked();
      /* the shared project store (wave116i): Projects, the team pages and Goal alignment repaint from the same rows */
      try {
        var PS = window.__waProjects;
        if (PS && PS.rows) { PS.rows.forEach(function (x) { if (String(x.id) === String(st.project)) { x.goal_id = g ? Number(g) : null; x.milestone_id = m ? Number(m) : null; x.checkpoint_id = cp ? Number(cp) : null; } }); if (window.w116ProjectsChanged) window.w116ProjectsChanged(PS.rows); }
        else if (window.w116Goals && window.w116Goals.refresh) window.w116Goals.refresh();
      } catch (e) { /* fine */ }
      toastS(unlink ? 'Unlinked' : 'Linked to goal ' + ((byId(S.goals, g) || {}).number || ''));
    }).catch(function (e) { toastS('Not linked: ' + errText(e)); });
  }

  /* owners: add someone from the roster, make the lead, take someone off */
  function ownerDrawer(st) {
    var g = byId(S.goals, st.goal); if (!g) return drawerShell('Owners', '', '');
    var qv = lower(st.q || ''), own = ownersOf(g.id);
    var current = own.map(function (o) {
      var m = memberById(o.member_id) || { name: '?' };
      return '<div class="w205th" style="display:flex;align-items:center;gap:10px">' + av(m, 30) + '<div style="flex:1;min-width:0"><b data-w198skip>' + E(m.name) + '</b>' + (o.is_lead ? ' <span class="w205tag g">Lead</span>' : '') +
        '<label class="w205field" style="margin:6px 0 0;font-weight:600">What they carry <input type="text" data-w205focus="' + o.member_id + '" value="' + E(o.focus || '') + '" placeholder="Optional, e.g. Toronto" /></label></div>' +
        '<div style="display:flex;flex-direction:column;gap:6px">' + (o.is_lead ? '' : '<button type="button" class="w205btn sm" data-w205lead="' + o.member_id + '">Make lead</button>') + '<button type="button" class="w205btn sm ghost" data-w205ownoff="' + o.member_id + '">Take off</button></div></div>';
    }).join('');
    var ids = {}; own.forEach(function (o) { ids[o.member_id] = 1; });
    var pool = members().filter(function (m) { return m.active !== false && !ids[m.id] && (!qv || lower(m.name + ' ' + (m.role || '') + ' ' + deptLabel(m.department)).indexOf(qv) >= 0); })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }).slice(0, 40);
    var body = '<div class="w205grp">Owners now</div>' + (current || '<p style="font-size:13px;color:' + MUTED + '">No owner yet.</p>') +
      '<div class="w205grp">Add an owner</div><label class="w205search" style="max-width:none;margin:0 0 8px">' + I('search') + '<input type="search" data-w205ownq value="' + E(st.q || '') + '" placeholder="Find someone on the roster" aria-label="Find someone on the roster" data-w205autofocus /></label>' +
      '<div class="w205pick">' + pool.map(function (m) { return '<label data-w205ownon="' + m.id + '" tabindex="0" role="button">' + av(m, 26) + '<span class="t"><span data-w198skip>' + E(m.name) + '</span><small>' + E(m.role || deptLabel(m.department)) + '</small></span>' + I('plus') + '</label>'; }).join('') + '</div>';
    return drawerShell('Owners', '<span data-w198skip>Goal ' + E(g.number) + ': ' + E(g.title) + '</span> · one to three, one lead', body, '<small style="color:' + MUTED + '">Owners and admins edit the goal. Every change is in its history.</small>');
  }
  function ownerSet(gid, mid, on, lead, focus) {
    return rpc('strategy_owner_set', { p_goal: Number(gid), p_member: Number(mid), p_on: !!on, p_lead: lead == null ? null : !!lead, p_focus: focus == null ? null : focus }).then(function () {
      return Promise.resolve(db.from('goal_owners').select('*').eq('goal_id', Number(gid))).then(function (r) {
        S.owners = S.owners.filter(function (o) { return String(o.goal_id) !== String(gid); }).concat(((r && r.data) || []).filter(function (o) { return !o.removed_at; }));
        paintOwners(gid); if (S.drawer && S.drawer.kind === 'owner') paintDrawer(); paintSoonIfRights();
      });
    }).catch(function (e) { toastS('Not changed: ' + errText(e)); });
  }
  function paintSoonIfRights() { /* someone who took themselves off loses the pen: redraw the fields */ var g = S.goals.filter(function (x) { return !canEdit(x); }).length; if (g !== S.lastNoEdit) { S.lastNoEdit = g; paintSoon(); } }

  /* a library document (admins) */
  function docDrawer(st) {
    var d = st.id ? byId(S.docs, st.id) : {};
    var f = function (n, l, ph, ta) { return '<label class="w205field">' + E(l) + (ta ? '<textarea data-w205df="' + n + '" rows="3" placeholder="' + E(ph) + '">' + E(d[n] || '') + '</textarea>' : '<input type="' + (n === 'url' ? 'url' : 'text') + '" data-w205df="' + n + '" value="' + E(d[n] || '') + '" placeholder="' + E(ph) + '"' + (n === 'title' ? ' data-w205autofocus' : '') + ' />') + '</label>'; };
    var body = f('title', 'Title', 'The document’s name') + f('url', 'Link', 'https://docs.google.com/...') + f('group_label', 'Shelf', 'Our plans, Consulting work or Sources') + f('doc_date', 'When it was written', 'e.g. Jun 2026') +
      f('direction', 'The direction it sets', 'What it says we will do', true) + f('status_note', 'Where it stands', 'e.g. Concept; no dates or targets', true) +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600"><input type="checkbox" data-w205df="pinned"' + (st.id ? (d.pinned ? ' checked' : '') : ' checked') + ' /> Pinned for everyone (shows on the Goals page)</label>';
    var foot = '<div class="acts" style="margin:0">' + (st.id ? '<button type="button" class="w205btn sm ghost" data-w205docarch="' + st.id + '">Take it out of the library</button>' : '') + '<span class="sp"></span><button type="button" class="w205btn sm ghost" data-w205close="1">Cancel</button><button type="button" class="w205btn pri" data-w205docsave="1">' + (st.id ? 'Save' : 'Add it') + '</button></div>';
    return drawerShell(st.id ? 'Edit a document' : 'Add a document', 'The Strategy Library', body, foot);
  }
  function docSave(archive) {
    var st = S.drawer, d = document.getElementById('w205drawer'); if (!st || !d) return;
    var patch = {};
    if (archive) patch.archived = true;
    else d.querySelectorAll('[data-w205df]').forEach(function (el) { var n = el.getAttribute('data-w205df'); patch[n] = el.type === 'checkbox' ? el.checked : el.value; });
    if (!archive && !String(patch.title || '').trim()) { toastS('A document needs a title'); return; }
    rpc('strategy_doc_save', { p_id: st.id ? Number(st.id) : null, p_patch: patch }).then(function (row) {
      S.docs = S.docs.filter(function (x) { return String(x.id) !== String(row && row.id); });
      if (row && !row.archived_at) S.docs.push(row);
      S.docs.sort(function (a, b) { return a.sort - b.sort; });
      closeDrawer(); paint(); toastS(archive ? 'Taken out of the library' : 'Saved');
    }).catch(function (e) { toastS('Not saved: ' + errText(e)); });
  }
  function togglePin(id) {
    var d = byId(S.docs, id); if (!d) return;
    rpc('strategy_doc_save', { p_id: Number(id), p_patch: { pinned: !d.pinned } }).then(function (row) { if (row) Object.assign(d, row); paint(); toastS(d.pinned ? 'Pinned for everyone' : 'Unpinned'); }).catch(function (e) { toastS('Not changed: ' + errText(e)); });
  }
