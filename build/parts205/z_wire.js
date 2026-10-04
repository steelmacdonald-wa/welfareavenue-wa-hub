
  /* ---------- presence on the page ---------- */
  function presName(p) { var m = p.mid ? memberById(p.mid) : null; return (m && m.name) || p.name || 'Someone'; }
  function presMember(p) { return (p.mid && memberById(p.mid)) || { name: presName(p) }; }
  function paintPresence() {
    var top = document.querySelector('#w205 [data-w205pres]');
    var people = S.presence;
    if (top) {
      top.innerHTML = '<span class="w205live' + (S.live ? '' : ' off') + '" title="' + (S.live ? 'Live: changes arrive as people make them' : 'Not live: changes show when you reload') + '"></span>' +
        (people.length ? '<span>Here now</span><span class="avs">' + people.slice(0, 8).map(function (p) {
          var g = p.goal ? byId(S.goals, p.goal) : null, m = presMember(p);
          return '<span title="' + E(presName(p) + (g ? ', in goal ' + g.number : '')) + '">' + av(m, 26) + '</span>';
        }).join('') + '</span>' + (people.length > 8 ? '<span>+' + (people.length - 8) + '</span>' : '') : '<span>' + (S.live ? 'Just you here' : 'Offline view') + '</span>');
    }
    document.querySelectorAll('#w205 [data-w205gpres]').forEach(function (el) {
      var gid = el.getAttribute('data-w205gpres'), here = people.filter(function (p) { return String(p.goal) === String(gid); });
      el.innerHTML = here.length ? '<span class="avs">' + here.map(function (p) { var m = presMember(p); return '<span title="' + E(presName(p)) + ' is in this goal">' + av(m, 24) + '</span>'; }).join('') + '</span>' : '';
    });
    document.querySelectorAll('#w205 [data-w205who]').forEach(function (el) {
      var k = el.getAttribute('data-w205who'), who = people.filter(function (p) { return p.field === k; }).map(presName);
      if (who.length) { el.hidden = false; el.textContent = who.join(', ') + ' editing'; } else el.hidden = true;
    });
    document.querySelectorAll('#w205 .w205ed.other').forEach(function (el) { el.classList.remove('other'); el.removeAttribute('data-w205by'); });
    people.forEach(function (p) { if (!p.field) return; var el = fieldEl(p.field); if (el) { el.classList.add('other'); el.title = presName(p) + ' is editing this'; } });
  }

  /* the boxes fit their words: again once the fonts are in and when the width changes */
  function growAll() { document.querySelectorAll('#w205 textarea.w205ed').forEach(grow); }
  function growSoon() { setTimeout(growAll, 30); setTimeout(growAll, 400); try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(growAll); } catch (e) { /* fine */ } }
  var rzT = null; window.addEventListener('resize', function () { clearTimeout(rzT); rzT = setTimeout(function () { if (onPage()) growAll(); }, 150); });
  /* ---------- paint and route ---------- */
  function paint() {
    var h = host(); if (!h) return;
    var act = document.activeElement, actKey = act && h.contains(act) ? act.getAttribute('data-w205k') : null, sel = null;
    if (actKey && act.selectionStart != null) sel = [act.selectionStart, act.selectionEnd];
    var keep = {}; h.querySelectorAll('[data-w205k]').forEach(function (el) { var k = el.getAttribute('data-w205k'); if (S.dirty[k] || S.conflict[k]) keep[k] = el.value; });
    var libFocus = act && act.hasAttribute && act.hasAttribute('data-w205libq');
    var html;
    if (!staffOk() && !boardMode()) html = mastHtml('Goals', '') + '<div class="w205empty"><b>Sign in to read the goals</b>The Strategy app is for Welfare Avenue accounts and the board.</div>';
    else if (S.view === 'library') html = libraryViewHtml();
    else if (S.view === 'retired') html = retiredViewHtml();
    else html = goalsViewHtml();
    h.innerHTML = html;
    Object.keys(keep).forEach(function (k) { var el = fieldEl(k); if (el) el.value = keep[k]; if (S.conflict[k]) paintConflict(k); });
    h.querySelectorAll('textarea.w205ed').forEach(grow);
    Object.keys(S.errors).forEach(paintFieldError);
    S.goals.forEach(function (g) { savedState(key('goal', g.id, 'title')); });
    if (actKey) { var n = fieldEl(actKey); if (n) { n.focus(); if (sel) try { n.setSelectionRange(sel[0], sel[1]); } catch (e) { /* fine */ } } }
    if (libFocus) { var li = h.querySelector('[data-w205libq]'); if (li) { li.focus(); li.setSelectionRange(li.value.length, li.value.length); } }
    paintPresence(); growSoon();
    try { document.title = (S.view === 'library' ? 'Strategy Library' : S.view === 'retired' ? 'Retired goals' : 'Goals') + ' · Welfare Avenue Hub'; } catch (e) { /* fine */ }
    S.lastNoEdit = S.goals.filter(function (x) { return !canEdit(x); }).length;
  }
  function route(hh) {
    var p = String(hh || '').replace(/^#/, '').split('/');
    S.view = 'goals'; S.goalId = null; S.sub = ''; S.subId = null;
    if (p[1] === 'library') S.view = 'library';
    else if (p[1] === 'retired') S.view = 'retired';
    else if (p[1] === 'goal' && p[2]) { S.goalId = p[2]; S.sub = p[3] || ''; S.subId = p[4] || null; }
  }
  function show(hh) {
    route(hh);
    var h = host(); if (!h) return;
    if (!S.loaded) h.innerHTML = '<div class="w205empty" style="margin-top:20px"><b>Loading the goals</b>One moment.</div>';
    return loadAll().then(function () {
      paint();
      goLive(); trackSoon();
      if (S.goalId) {
        var card = document.getElementById('w205g-' + S.goalId);
        if (card) setTimeout(function () { try { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { card.scrollIntoView(); } }, 80);
        if (S.sub === 'comments') openDrawer({ kind: 'comments', goal: S.goalId, milestone: null, focusComment: S.subId });
        else if (S.sub === 'history') { openDrawer({ kind: 'history', goal: S.goalId }); loadHistory(); }
      } else window.scrollTo(0, 0);
    });
  }
  function go(h) { if (location.hash === h) { try { applyHash(); } catch (e) { show(h); } } else location.hash = h; }

  /* ---------- events ---------- */
  function inApp(t) { return !!(t && t.closest && (t.closest('#w205') || t.closest('#w205drawer') || t.closest('#w205scrim'))); }
  document.addEventListener('input', function (e) {
    var t = e.target; if (!inApp(t)) return;
    var k = t.getAttribute && t.getAttribute('data-w205k');
    if (k) {
      if (t.readOnly || t.disabled) return;
      grow(t); S.dirty[k] = true; delete S.errors[k];
      var er = t.parentNode.querySelector('.w205err[data-for="' + k + '"]'); if (er) er.remove();
      schedule(k, t.tagName === 'SELECT' ? 0 : SAVE_MS);
      return;
    }
    if (t.hasAttribute('data-w205libq')) { S.libQ = t.value; clearTimeout(S.libT); S.libT = setTimeout(paint, 160); return; }
    if (t.hasAttribute('data-w205linkq') && S.drawer) { S.drawer.q = t.value; clearTimeout(S.dT); S.dT = setTimeout(function () { paintDrawer(); var i = document.querySelector('#w205drawer [data-w205linkq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 150); return; }
    if (t.hasAttribute('data-w205ownq') && S.drawer) { S.drawer.q = t.value; clearTimeout(S.dT); S.dT = setTimeout(function () { paintDrawer(); var i = document.querySelector('#w205drawer [data-w205ownq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 150); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!inApp(t)) return;
    var k = t.getAttribute && t.getAttribute('data-w205k');
    if (k && t.tagName === 'SELECT') { t.className = t.className.replace(/\bs-\w+/, 's-' + stKey(t.value)); t.title = ST_LABEL[t.value] || t.value; return; }
    if (t.hasAttribute('data-w205pickp') && S.drawer) { S.drawer.project = t.getAttribute('data-w205pickp'); var p = byId(S.projects, S.drawer.project); S.drawer.goalPick = S.drawer.goal || (p && p.goal_id) || null; S.drawer.msPick = p && String(p.goal_id) === String(S.drawer.goalPick) ? p.milestone_id : (S.drawer.ms || null); paintDrawer(); return; }
    if (t.hasAttribute('data-w205pickg') && S.drawer) { S.drawer.goalPick = t.getAttribute('data-w205pickg'); S.drawer.msPick = null; paintDrawer(); return; }
    if (t.hasAttribute('data-w205pickm') && S.drawer) { S.drawer.msPick = t.getAttribute('data-w205pickm') || null; paintDrawer(); return; }
    if (t.hasAttribute('data-w205focus') && S.drawer) { ownerSet(S.drawer.goal, t.getAttribute('data-w205focus'), true, null, t.value); return; }
  });
  document.addEventListener('focusin', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w205')) return;
    var card = t.closest('[data-w205goal]'), k = t.getAttribute('data-w205k');
    var g = card ? card.getAttribute('data-w205goal') : null;
    var f = k && !t.readOnly && !t.disabled ? k : null;
    if (g !== S.focus.goal || f !== S.focus.field) { S.focus = { goal: g, field: f }; trackSoon(); }
  });
  document.addEventListener('focusout', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w205')) return;
    var k = t.getAttribute('data-w205k');
    if (k && S.dirty[k] && t.tagName !== 'SELECT') { clearTimeout(S.timers[k]); save(k); }
    setTimeout(function () { var a = document.activeElement; if (!a || !a.closest || !a.closest('#w205')) { if (S.focus.field || S.focus.goal) { S.focus = { goal: null, field: null }; trackSoon(); } } }, 50);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.drawer) { e.preventDefault(); closeDrawer(); return; }
    var t = e.target; if (!inApp(t)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (t.matches('textarea[data-w205cmt="new"]')) { e.preventDefault(); postComment(null); return; }
      if (t.matches('textarea[data-w205reply]')) { e.preventDefault(); postComment(t.getAttribute('data-w205reply')); return; }
      if (t.matches('textarea[data-w205edit]')) { e.preventDefault(); saveEdit(t.getAttribute('data-w205edit')); return; }
    }
    /* a title and a measure are one line: Enter saves and leaves, like a heading in a document */
    var k = t.getAttribute && t.getAttribute('data-w205k');
    if (k && e.key === 'Enter' && !e.shiftKey && /:(title|measure|baseline|target_fy29|target_fy31)$/.test(k)) { e.preventDefault(); t.blur(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && t.matches('[data-w205jump],label[data-w205ownon]')) { e.preventDefault(); t.click(); }
  });
  document.addEventListener('click', function (e) {
    var t = e.target; if (!inApp(t)) return;
    var el;
    if ((el = t.closest('[data-w205close]'))) { closeDrawer(); return; }
    if ((el = t.closest('[data-w205go]'))) { e.preventDefault(); go(el.getAttribute('data-w205go')); return; }
    if ((el = t.closest('[data-w205jump]'))) { go('#orggoals/goal/' + el.getAttribute('data-w205jump')); return; }
    if ((el = t.closest('[data-w205keep]'))) { resolveConflict(el.getAttribute('data-w205keep'), true); return; }
    if ((el = t.closest('[data-w205theirs]'))) { resolveConflict(el.getAttribute('data-w205theirs'), false); return; }
    if ((el = t.closest('[data-w205fold]'))) {
      var gid = el.getAttribute('data-w205fold'), card = document.getElementById('w205g-' + gid);
      var f = !card.classList.contains('folded'); card.classList.toggle('folded', f); el.setAttribute('aria-expanded', f ? 'false' : 'true');
      if (f) S.folded[gid] = 1; else delete S.folded[gid]; lsSet('w205folded', JSON.stringify(S.folded));
      if (!f) card.querySelectorAll('textarea.w205ed').forEach(grow);
      return;
    }
    if ((el = t.closest('[data-w205cmts]'))) { var p = el.getAttribute('data-w205cmts').split(':'); openDrawer({ kind: 'comments', goal: p[0], milestone: p[1] || null }); return; }
    if ((el = t.closest('[data-w205cseg]'))) { S.drawer.milestone = el.getAttribute('data-w205cseg') || null; S.drawer.replyTo = null; paintDrawer(); return; }
    if ((el = t.closest('[data-w205replyto]'))) { S.drawer.replyTo = el.getAttribute('data-w205replyto') || null; paintDrawer(); var rt = document.querySelector('#w205drawer textarea[data-w205reply]'); if (rt) rt.focus(); return; }
    if ((el = t.closest('[data-w205sendreply]'))) { postComment(el.getAttribute('data-w205sendreply')); return; }
    if ((el = t.closest('[data-w205post]'))) { postComment(null); return; }
    if ((el = t.closest('[data-w205editc]'))) { S.drawer.editing = el.getAttribute('data-w205editc'); paintDrawer(); return; }
    if ((el = t.closest('[data-w205editcancel]'))) { S.drawer.editing = null; paintDrawer(); return; }
    if ((el = t.closest('[data-w205editsave]'))) { saveEdit(el.getAttribute('data-w205editsave')); return; }
    if ((el = t.closest('[data-w205hist]'))) { openDrawer({ kind: 'history', goal: el.getAttribute('data-w205hist') }); loadHistory(); return; }
    if ((el = t.closest('[data-w205restore]'))) { el.disabled = true; restore(el.getAttribute('data-w205restore')); return; }
    if ((el = t.closest('[data-w205link]'))) { var lp = el.getAttribute('data-w205link').split(':'); openDrawer({ kind: 'link', goal: lp[0], ms: lp[1] || null, msPick: lp[1] || null, q: '' }); return; }
    if ((el = t.closest('[data-w205linkp]'))) { var pr = byId(S.projects, el.getAttribute('data-w205linkp')); openDrawer({ kind: 'link', goal: null, project: pr ? pr.id : null, goalPick: null, msPick: null }); return; }
    if ((el = t.closest('[data-w205proj]'))) { var pj = byId(S.projects, el.getAttribute('data-w205proj')); if (!pj) return; if (!canComment()) { location.hash = '#project/' + pj.id; return; } openDrawer({ kind: 'link', goal: pj.goal_id, project: pj.id, goalPick: pj.goal_id, msPick: pj.milestone_id }); return; }
    if ((el = t.closest('[data-w205dolink]'))) { doLink(false); return; }
    if ((el = t.closest('[data-w205unlink]'))) { doLink(true); return; }
    if ((el = t.closest('[data-w205addowner]'))) { openDrawer({ kind: 'owner', goal: el.getAttribute('data-w205addowner'), q: '' }); return; }
    if ((el = t.closest('[data-w205owner]'))) { openDrawer({ kind: 'owner', goal: el.getAttribute('data-w205owner').split(':')[0], q: '' }); return; }
    if ((el = t.closest('[data-w205ownon]'))) { ownerSet(S.drawer.goal, el.getAttribute('data-w205ownon'), true, ownersOf(S.drawer.goal).length ? null : true, null); return; }
    if ((el = t.closest('[data-w205ownoff]'))) { ownerSet(S.drawer.goal, el.getAttribute('data-w205ownoff'), false, null, null); return; }
    if ((el = t.closest('[data-w205lead]'))) { ownerSet(S.drawer.goal, el.getAttribute('data-w205lead'), true, true, null); return; }
    if ((el = t.closest('[data-w205addms]'))) {
      var a = el.getAttribute('data-w205addms').split(':'); el.disabled = true;
      rpc('strategy_add', { p_entity: 'milestone', p_goal: Number(a[0]), p_fy: a[1], p_body: '' }).then(function (row) {
        if (row && row.id && !byId(S.milestones, row.id)) S.milestones.push(row);
        baseRow('milestone', row, ['body', 'status', 'fy']); repaintGoal(a[0], false);
        var n = fieldEl(key('milestone', row.id, 'body')); if (n) n.focus();
      }).catch(function (x) { el.disabled = false; toastS('Not added: ' + errText(x)); });
      return;
    }
    if ((el = t.closest('[data-w205addpath]'))) {
      var gp = el.getAttribute('data-w205addpath'); el.disabled = true;
      rpc('strategy_add', { p_entity: 'path', p_goal: Number(gp), p_fy: null, p_body: '' }).then(function (row) {
        el.disabled = false;
        if (row && row.id && !byId(S.paths, row.id)) S.paths.push(row);
        baseRow('path', row, ['body']); repaintGoal(gp, false);
        var n = fieldEl(key('path', row.id, 'body')); if (n) n.focus();
      }).catch(function (x) { el.disabled = false; toastS('Not added: ' + errText(x)); });
      return;
    }
    if ((el = t.closest('[data-w205rm]'))) {
      var r = el.getAttribute('data-w205rm').split(':'), row0 = rowOf(r[0], r[1]); if (!row0) return;
      var gid2 = row0.goal_id;
      rpc('strategy_remove', { p_entity: r[0], p_id: Number(r[1]) }).then(function () {
        var list = r[0] === 'milestone' ? S.milestones : S.paths, i = list.indexOf(row0); if (i >= 0) list.splice(i, 1);
        if (r[0] === 'milestone') S.projects.forEach(function (p) { if (String(p.milestone_id) === String(r[1])) p.milestone_id = null; });
        repaintGoal(gid2, false); paintProgress(gid2);
        toastS((r[0] === 'milestone' ? 'Milestone' : 'Path') + ' removed. History has Restore.');
      }).catch(function (x) { toastS('Not removed: ' + errText(x)); });
      return;
    }
    if ((el = t.closest('[data-w205approve]'))) {
      var to = el.getAttribute('data-w205approve');
      if (to === 'approved' && !window.confirm('Mark the five goals approved by the board? The draft label comes off for everyone.')) return;
      rpc('strategy_set_approval', { p_status: to }).then(function () { S.loaded = 0; return loadAll(true).then(paint); }).catch(function (x) { toastS('Not changed: ' + errText(x)); });
      return;
    }
    if ((el = t.closest('[data-w205toproj]'))) {
      var rg = byId(S.retired, el.getAttribute('data-w205toproj')); if (!rg) return;
      if (!window.confirm('Make "' + rg.title + '" a project in ' + deptLabel(rg.department) + '? This can be done once.')) return;
      el.disabled = true;
      rpc('strategy_retired_to_project', { p_goal: Number(rg.id) }).then(function (res) {
        toastS('Now a project'); S.loaded = 0;
        try { if (window.w116LoadProjects) window.w116LoadProjects(true); } catch (x) { /* fine */ }
        return loadAll(true).then(paint).then(function () { if (res && res.project_id) location.hash = '#project/' + res.project_id; });
      }).catch(function (x) { el.disabled = false; toastS('Not done: ' + errText(x)); });
      return;
    }
    if ((el = t.closest('[data-w205pin]'))) { togglePin(el.getAttribute('data-w205pin')); return; }
    if ((el = t.closest('[data-w205docadd]'))) { openDrawer({ kind: 'doc', id: null }); return; }
    if ((el = t.closest('[data-w205docedit]'))) { openDrawer({ kind: 'doc', id: el.getAttribute('data-w205docedit') }); return; }
    if ((el = t.closest('[data-w205docsave]'))) { docSave(false); return; }
    if ((el = t.closest('[data-w205docarch]'))) { if (window.confirm('Take this document out of the library? An admin can add it again.')) docSave(true); return; }
  });
  window.addEventListener('beforeunload', function (e) { if (Object.keys(S.dirty).length) { flushAll(); e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', function () {
    var on = /^#orggoals(\/|$)/.test(location.hash || '');
    if (!on) { flushAll(); if (S.drawer) closeDrawer(); goQuiet(); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushAll(); });

  /* ---------- the older pages: retired goals leave their views (they stay in the database and on Retired goals) ---------- */
  function hookOlder() {
    if (typeof waLoadGoals === 'function' && !waLoadGoals.__w205) {
      var __lg = waLoadGoals;
      waLoadGoals = async function () { var r = await __lg.apply(this, arguments); try { if (typeof GOALS_CACHE !== 'undefined') GOALS_CACHE = GOALS_CACHE.filter(function (g) { return !g.retired_at; }); } catch (e) { /* fine */ } return r; };
      waLoadGoals.__w205 = true;
    }
    try { if (typeof GOALS_CACHE !== 'undefined' && GOALS_CACHE.length) GOALS_CACHE = GOALS_CACHE.filter(function (g) { return !g.retired_at; }); } catch (e) { /* fine */ }
    /* board viewers read the goals (read only; the database refuses their writes) */
    if (typeof wa40Allowed === 'function' && !wa40Allowed.__w205) {
      var __al = wa40Allowed;
      wa40Allowed = function () { var a = __al.apply(this, arguments) || []; if ((boardMode() || role() === 'viewer') && a.indexOf('orggoals') < 0) a = a.concat(['orggoals']); return a; };
      Object.keys(__al).forEach(function (k) { try { wa40Allowed[k] = __al[k]; } catch (e) { /* fine */ } });
      wa40Allowed.__w205 = true;
    }
  }
  /* the page: wave116f registered 'orggoals'; wave205 draws it. #goals (Department goals) opens Retired goals */
  function takeOver() {
    if (!window.WA_NAV || !WA_NAV.pages) return;
    var pg = WA_NAV.pages.filter(function (p) { return p.id === 'orggoals'; })[0];
    if (!pg) { WA_NAV.register({ id: 'orggoals', gate: 'member', panel: false, onShow: function (h) { show(h); } }); pg = WA_NAV.pages.filter(function (p) { return p.id === 'orggoals'; })[0]; }
    if (pg && !pg.__w205) { pg.onShow = function (h) { show(h); }; pg.__w205 = true; }
    var gp = WA_NAV.pages.filter(function (p) { return p.id === 'goals'; })[0];
    if (!gp) { WA_NAV.pages.push({ id: 'goals', __w205: true, onShow: function () { location.replace('#orggoals/retired'); } }); }
    else if (!gp.__w205) { gp.onShow = function () { location.replace('#orggoals/retired'); }; gp.__w205 = true; }
  }
  if (typeof showPanel === 'function') {
    var __sp205 = showPanel;
    showPanel = function (id) {
      if (id === 'goals') { setTimeout(function () { if (!/^#orggoals/.test(location.hash)) location.replace('#orggoals/retired'); }, 0); }
      var r = __sp205.apply(this, arguments);
      try { if (id !== 'orggoals') { if (S.drawer) closeDrawer(); goQuiet(); } } catch (e) { /* fine */ }
      return r;
    };
  }
  if (typeof startApp === 'function') {
    var __sa205 = startApp;
    startApp = async function () {
      var out = await __sa205.apply(this, arguments);
      try {
        hookOlder(); takeOver(); addTours();
        if (typeof wa40Enforce === 'function') wa40Enforce();
        var h = decodeURIComponent(location.hash || '');
        if (/^#goals(\/|$)/.test(h)) location.replace('#orggoals/retired');
        else if (/^#orggoals(\/|$)/.test(h)) { showPanel('orggoals'); show(h.replace(/^#/, '')); }
      } catch (e) { console.warn('wave205 boot', e); }
      return out;
    };
  }

  /* ---------- test hook ---------- */
  window.w205 = {
    state: function () { return S; }, load: loadAll, paint: paint, show: show, route: route, save: save, flush: flushAll,
    remote: onRemote, presence: function (list) { S.presence = list || []; paintPresence(); }, canEdit: canEdit, canComment: canComment,
    open: openDrawer, close: closeDrawer, progress: progress, key: key, live: function () { return { live: S.live, channel: !!S.channel }; }
  };
})();
