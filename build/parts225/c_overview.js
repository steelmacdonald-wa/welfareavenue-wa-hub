
  /* ---------- the page: one panel (#studio), sections by address ---------- */
  function mast(title, blurb) {
    var sec = document.getElementById('studio'); if (!sec) return;
    var m = sec.querySelector(':scope > .w118mast');
    if (!m) { m = document.createElement('div'); m.className = 'w118mast'; m.setAttribute('data-w225', '1'); sec.insertBefore(m, sec.firstChild); }
    var html = '<h1>' + E(title) + '</h1><p>' + E(blurb) + '</p>';
    if (m.getAttribute('data-h') !== html) { m.innerHTML = html; m.setAttribute('data-h', html); }
  }
  function host() {
    var sec = document.getElementById('studio'); if (!sec) return null;
    var t = SECT[S.sec] || SECT.overview; mast(t[0], t[1]);
    try { document.title = t[0] + ' · Welfare Avenue Hub'; } catch (e) { /* fine */ }
    var h = document.getElementById('w225host');
    if (!h) { h = document.createElement('div'); h.id = 'w225host'; sec.appendChild(h); }
    return h;
  }
  function go(h) { if (location.hash === h) { try { applyHash(); } catch (e) { /* fine */ } } else location.hash = h; }
  function postRow(p, extra) {
    var th = thumbOf(p), s = stateOf(p);
    return '<div class="pl" data-w225open="' + p.id + '">' + (th ? '<img src="' + E(th) + '" alt="" loading="lazy">' : '<div class="ph">' + I('cal') + '</div>') +
      '<div style="min-width:0"><b>' + E(titleOf(p)) + '</b><small>' + (p.platforms || []).map(function (k) { return mark(k, s.live && s.live[k]); }).join('') + ' ' + E(p.scheduled_at ? niceWhen(p.scheduled_at) : 'No date') + (p.owner ? ' · ' + E(p.owner) : '') + '</small>' + (extra || '') + '</div>' +
      '<span class="pill ' + (s.cls === 'live' ? 'ok' : s.cls === 'sched' ? 'warn' : s.cls === 'appr' ? 'appr' : s.cls === 'bad' || s.cls === 'due' ? 'bad' : '') + '">' + E(s.label) + '</span></div>';
  }
  function weekBounds(off) { var m = addDays(mondayOf(today()), 7 * (off || 0)); return [m, addDays(m, 6)]; }
  function postsIn(a, b) { return posts().filter(function (p) { var d = dayOf(p.scheduled_at || p.published_at); return d && d >= a && d <= b && p.status !== 'cancelled'; }); }
  /* goals: posts per platform per week (hub_settings content_studio.goals); a week counts for the streak when every goal with a target is met */
  function goalStatus(off) {
    var wb = weekBounds(off), g = goals(), list = postsIn(wb[0], wb[1]).filter(function (p) { return ['published', 'posted', 'scheduled', 'publishing'].indexOf(p.status) >= 0 || (off < 0 && p.status === 'failed' && Object.keys(p.results || {}).some(function (k) { return p.results[k] && p.results[k].id; })); });
    var out = {}; PORDER.forEach(function (k) { out[k] = { goal: Number(g[k] || 0), n: list.filter(function (p) { return (p.platforms || []).indexOf(k) >= 0; }).length }; });
    return out;
  }
  function streak() {
    var n = 0; for (var w = -1; w > -53; w--) { var gs = goalStatus(w), any = false, met = true; PORDER.forEach(function (k) { if (gs[k].goal > 0) { any = true; if (gs[k].n < gs[k].goal) met = false; } }); if (!any || !met) break; n++; }
    return n;
  }
  function overviewHtml() {
    var now = Date.now(), t = today(), wb = weekBounds(0);
    var all = posts();
    var scheduled = all.filter(function (p) { return p.status === 'scheduled' && p.scheduled_at && new Date(p.scheduled_at).getTime() > now; });
    var thisWeek = postsIn(wb[0], wb[1]);
    var pend = all.filter(function (p) { return p.approval_status === 'pending' && ['draft', 'scheduled', 'failed'].indexOf(p.status) >= 0; });
    var mine = all.filter(function (p) { return p.approval_status === 'changes' && lower(p.submitted_by) === myEmail(); });
    var attn = all.filter(function (p) { return p.status !== 'cancelled' && stateOf(p).attn; });
    var open = S.comments.filter(function (c) { return c.status === 'open' && !c.from_us; });
    var clicks30 = S.clicks.length;
    var reach30 = 0; S.social.forEach(function (sp) { if (sp.published_at && now - new Date(sp.published_at).getTime() < 30 * 86400000) reach30 += Number(sp.reach || sp.views || 0); });
    var gs = goalStatus(0), gT = 0, gN = 0; PORDER.forEach(function (k) { gT += gs[k].goal; gN += Math.min(gs[k].n, gs[k].goal); });
    var st = streak();
    var kpis = '<div class="kpis">' +
      '<div class="kpi" data-w225go="#contentcal"><b>' + scheduled.length + '</b><span>scheduled ahead</span><em>' + thisWeek.length + ' this week</em></div>' +
      '<div class="kpi" data-w225go="#studio/approvals"><b class="' + (pend.length ? 'warn' : '') + '">' + pend.length + '</b><span>waiting for approval</span>' + (mine.length ? '<em>' + mine.length + ' of yours sent back</em>' : '') + '</div>' +
      '<div class="kpi" data-w225go="#studio/inbox"><b class="' + (open.length ? 'warn' : 'ok') + '">' + open.length + '</b><span>comments to answer</span></div>' +
      '<div class="kpi" data-w225go="#studio/queue"><b class="' + (gT && gN >= gT ? 'ok' : '') + '">' + (gT ? gN + '/' + gT : '–') + '</b><span>weekly goal</span><em>' + (st ? st + '-week streak' : 'Meet every goal to start a streak') + '</em></div>' +
      '<div class="kpi" data-w225go="#studio/links"><b>' + num(clicks30) + '</b><span>link clicks, 30 days</span></div>' +
      '<div class="kpi" data-w225go="#socialstats"><b>' + (reach30 ? num(reach30) : '–') + '</b><span>reach and views, 30 days</span></div></div>';
    /* the next seven days */
    var days = ''; for (var i = 0; i < 7; i++) {
      var d = addDays(t, i), list = all.filter(function (p) { return p.scheduled_at && dayOf(p.scheduled_at) === d && p.status !== 'cancelled'; }).sort(function (a, b) { return String(a.scheduled_at).localeCompare(String(b.scheduled_at)); });
      if (!list.length) continue;
      days += '<div class="day">' + E(i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : niceDate(d, { weekday: 'long', month: 'short', day: 'numeric' })) + '</div>' + list.map(function (p) { return postRow(p); }).join('');
    }
    var week = '<div class="card"><h3>' + I('cal') + ' The week ahead <span class="sp"></span><a class="btn225 sm" data-w225go="#contentcal">' + I('cal') + ' Calendar</a><a class="btn225 sm pri" data-w225new="1">' + I('plus') + ' New post</a></h3>' + (days || '<div class="empty">Nothing planned for the next seven days. <a data-w225go="#studio/queue" style="cursor:pointer;color:' + ROSE + ';font-weight:700">Fill the queue</a>.</div>') + '</div>';
    var needs = attn.concat(mine.filter(function (p) { return attn.indexOf(p) < 0; }));
    var attnCard = needs.length ? '<div class="card"><h3>' + I('warn') + ' Needs attention <small>' + needs.length + '</small></h3>' + needs.slice(0, 8).map(function (p) { return postRow(p, '<small style="color:' + FLAG + '">' + E(stateOf(p).note || '') + '</small>'); }).join('') + '</div>' : '';
    var apprCard = pend.length ? '<div class="card"><h3>' + I('check') + ' Waiting for approval <small>' + pend.length + '</small><span class="sp"></span><a class="btn225 sm" data-w225go="#studio/approvals">Open</a></h3>' + pend.slice(0, 5).map(function (p) { return postRow(p, '<small>From ' + E(String(p.submitted_by || '').split('@')[0]) + '</small>'); }).join('') + '</div>' : '';
    var goalsCard = '<div class="card"><h3>' + I('bolt') + ' This week’s goals <span class="sp"></span><a class="btn225 sm" data-w225go="#studio/queue">Change</a></h3>' + PORDER.filter(function (k) { return gs[k].goal > 0 || gs[k].n > 0; }).map(function (k) { var g = gs[k], w = g.goal ? Math.min(100, Math.round(g.n / g.goal * 100)) : 100; return '<div class="goal"><span>' + mark(k) + ' ' + E(PLX[k][0]) + '</span><div class="bar"><i class="' + (g.goal && g.n > g.goal ? 'over' : '') + '" style="width:' + w + '%"></i></div><span>' + g.n + (g.goal ? ' / ' + g.goal : '') + '</span></div>'; }).join('') + '<p class="muted" style="margin:8px 0 0">' + (st ? 'A ' + st + '-week streak: every goal met ' + st + ' week' + (st === 1 ? '' : 's') + ' in a row.' : 'Counts what is scheduled or out this week (Monday to Sunday).') + '</p></div>';
    var cx = cap(); var connCard = '<div class="card"><h3>' + I('plug') + ' How we post <span class="sp"></span><a class="btn225 sm" data-w225go="#studio/connections">Connections</a></h3>' + PORDER.map(function (k) { var m = modeOf(k), mm = MODE[m] || MODE.reminder; return '<div class="row" style="margin:5px 0;font-size:12.5px">' + mark(k) + '<b style="width:80px">' + E(PLX[k][0]) + '</b><span style="color:' + mm[1] + ';font-weight:700">' + E(mm[0]) + '</span></div>'; }).join('') + (cx && cx.missing && cx.missing.length ? '<p class="muted" style="margin:8px 0 0;color:' + FLAG + '">The Meta token is missing ' + cx.missing.length + ' permission' + (cx.missing.length === 1 ? '' : 's') + ': comments and some formats wait for the new token.</p>' : '') + '</div>';
    var cmCard = '<div class="card"><h3>' + I('chat') + ' Latest comments <span class="sp"></span><a class="btn225 sm" data-w225go="#studio/inbox">Comments</a></h3>' + (open.length ? open.slice(0, 4).map(function (c) { return '<div style="font-size:12.5px;margin:6px 0">' + mark(c.platform) + '<b>' + E(c.author_handle || c.author_name || 'Someone') + '</b> <span class="muted">' + E(ago(c.commented_at)) + '</span><div>' + E(clip(c.text, 140)) + '</div></div>'; }).join('') : '<div class="empty">' + (S.inboxLast ? 'Every comment is answered.' : 'The inbox fills once the Meta token has the comment permissions (Connections).') + '</div>') + '</div>';
    var top = S.social.filter(function (sp) { return sp.published_at && now - new Date(sp.published_at).getTime() < 30 * 86400000; }).sort(function (a, b) { return Number(b.engagement || (Number(b.likes || 0) + Number(b.comments || 0) + Number(b.shares || 0) + Number(b.saves || 0))) - Number(a.engagement || (Number(a.likes || 0) + Number(a.comments || 0) + Number(a.shares || 0) + Number(a.saves || 0))); })[0];
    var topCard = top ? '<div class="card"><h3>' + I('star') + ' Best post, 30 days</h3><div class="pl" style="cursor:default">' + (top.thumb_cached || top.thumb_url ? '<img src="' + E(top.thumb_cached || top.thumb_url) + '" alt="" loading="lazy">' : '<div class="ph"></div>') + '<div style="min-width:0"><b>' + E(clip(top.caption || 'A post', 80)) + '</b><small>' + mark(top.platform) + ' ' + num(top.reach || top.views || 0) + ' reach · ' + num(top.likes || 0) + ' likes · ' + num(top.comments || 0) + ' comments</small></div>' + (top.url ? '<a class="btn225 sm" href="' + E(top.url) + '" target="_blank" rel="noopener">' + I('ext') + '</a>' : '') + '</div></div>' : '';
    return kpis + '<div class="grid2"><div>' + week + attnCard + apprCard + '</div><div>' + goalsCard + connCard + cmCard + topCard + '</div></div>';
  }
