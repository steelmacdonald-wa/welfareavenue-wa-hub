
  /* ---------- Home: the people a lead is onboarding, and where the lead comes in (onboarding_lead_view) ---------- */
  function load(force) {
    if (S.loading) return S.loading;
    if (S.lead && !force && Date.now() - S.at < 60000) return Promise.resolve(S.lead);
    S.loading = (async function () {
      try {
        var r = await db.rpc('onboarding_lead_view');
        if (r && r.error) throw r.error;
        S.lead = (r && r.data) || { people: [] }; S.err = null;
      } catch (e) { S.err = String((e && e.message) || e); S.lead = S.lead || { people: [] }; }
      S.at = Date.now(); S.loading = null;
      return S.lead;
    })();
    return S.loading;
  }
  var SEC_SHORT = { 'WEEK 1': 'Week 1', 'WEEK 2': 'Week 2', 'WEEK 3': 'Week 3', 'WEEK 4': 'Week 4', '60 DAYS': '60 days', '90 DAYS': '90 days', '6 MONTHS': '6 months' };
  function weekOf(day) { if (day <= 7) return 'Week 1 of 4'; if (day <= 14) return 'Week 2 of 4'; if (day <= 21) return 'Week 3 of 4'; if (day <= 28) return 'Week 4 of 4'; if (day <= 60) return 'Up to 60 days'; return 'Past 60 days'; }
  function leadStepsHtml(p) {
    var today = todayIso(), soonDay = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    var steps = (p.lead_steps || []).slice();
    var open = steps.filter(function (s) { return !s.done; }), done = steps.filter(function (s) { return s.done; });
    var showOpen = open.filter(function (s) { return !s.due || String(s.due) <= soonDay; });
    var later = open.length - showOpen.length;
    var h = '';
    showOpen.forEach(function (s) {
      var late = s.due && String(s.due) < today;
      var extra = '';
      if (/quiz/i.test(s.name || '')) extra = (p.quizzes_done >= 2 ? 'Both quizzes are in: review them with them.' : (p.quizzes_done === 1 ? 'One of the two quizzes is in.' : 'Their quizzes come in week 4.'));
      h += '<label class="w166ls"><input type="checkbox" data-w166tick="' + E(s.id) + '"' + (S.busy['t' + s.id] ? ' disabled' : '') + ' /><span>' + E(s.name)
        + (s.due ? '<span class="w166due' + (late ? ' late' : (String(s.due) <= soonDay ? ' soon' : '')) + '">' + (late ? 'was due ' : 'by ') + E(fmtDay(s.due)) + '</span>' : '')
        + (s.description || extra ? '<small>' + E(extra || s.description) + '</small>' : '') + '</span></label>';
    });
    if (later) h += '<div class="w166note">Later: ' + later + ' more of yours, starting ' + E(fmtDay((open.filter(function (s) { return String(s.due || '') > soonDay; })[0] || {}).due)) + '.</div>';
    if (!showOpen.length && !later && done.length) h += '<div class="w166note">All your moments are done. Thank you for bringing them in.</div>';
    if (done.length && (showOpen.length || later)) h += '<div class="w166note" style="color:#797773">Done: ' + done.map(function (s) { return E(s.name); }).join(', ') + '.</div>';
    (p.help || []).forEach(function (q) {
      h += '<div class="w166ask"><b>Asked for help</b> on ' + E(q.step || 'a step') + (q.note ? ': “' + E(q.note) + '”' : '') + ' <span style="color:#8a6414">(' + E(ago(q.at)) + ')</span>'
        + '<button type="button" data-w166resolve="' + E(q.id) + '">Dealt with</button></div>';
    });
    if (p.late_count) {
      h += '<div class="w166note"><b style="color:#B3402F">Behind on ' + p.late_count + (p.late_count === 1 ? ' step' : ' steps') + '</b>: '
        + (p.late || []).slice(0, 3).map(function (l) { return E(l.name) + ' (due ' + E(fmtDay(l.due)) + ')'; }).join(', ')
        + (p.late_count > 3 ? ', and more' : '') + '. A quick message or ten minutes together usually unblocks it.</div>';
    }
    return h;
  }
  function planHtml(p) {
    var today = todayIso(), by = {}, order = [];
    (p.steps || []).forEach(function (s) { if (!by[s.section]) { by[s.section] = []; order.push(s.section); } by[s.section].push(s); });
    return order.map(function (sec) {
      return '<div class="w166sec"><b>' + E(SEC_SHORT[sec] || sec) + '</b>' + by[sec].map(function (s) {
        var late = !s.done && s.due && String(s.due) < today;
        return '<div class="w166st' + (s.child ? ' child' : '') + (s.done ? ' done' : '') + (late ? ' late' : '') + '">' + E(s.name) + (s.academy ? '<em>Avenue Academy</em>' : '') + (late ? ' <span style="font-size:11px">(due ' + E(fmtDay(s.due)) + ')</span>' : '') + '</div>';
      }).join('') + '</div>';
    }).join('');
  }
  function personHtml(p) {
    var pct = p.total ? Math.round(100 * p.done / p.total) : 0;
    var status = p.late_count ? '<span class="late">' + p.late_count + ' late</span>' : '<span class="ok">on pace</span>';
    var wks = (p.sections || []).map(function (s) {
      var cls = s.done >= s.total ? ' done' : (s.due && String(s.due) < todayIso() ? ' late' : '');
      return '<span class="w166wk' + cls + '">' + E(SEC_SHORT[s.name] || s.name) + ' ' + s.done + '/' + s.total + '</span>';
    }).join('');
    var av = (p.academy || []).filter(function (a) { return a && a.total; }).map(function (a) {
      if (a.asked === 'team' && !a.done && !a.complete) return '<span>Team avenue: not started</span>';
      return '<span class="' + (a.complete ? 'ok' : '') + '">' + (a.complete ? '&#10003; ' : '') + E(a.title || a.key) + ' ' + a.done + '/' + a.total + '</span>';
    }).join('');
    var sub = [p.title, teamName(p.department), p.via].filter(Boolean).map(E).join(' &middot; ');
    return '<div class="w166p" data-w166p="' + E(p.onboarding_id) + '">'
      + '<div class="w166top"><div class="w166av"' + (ownImg(p.avatar_url) ? ' style="background:' + GREEN + ' url(\'' + E(p.avatar_url) + '\') center/cover"' : '') + '>' + (ownImg(p.avatar_url) ? '' : E(initials(p.name))) + '</div><div class="w166who"><b>' + E(p.name) + '</b><span>' + sub + '</span></div>'
      + '<div class="w166day">Day ' + E(p.day) + '<span>' + E(weekOf(p.day)) + '</span></div></div>'
      + '<div class="w166bar" title="' + pct + '% of their plan"><i style="width:' + pct + '%"></i></div>'
      + '<div class="w166sum">' + p.done + ' of ' + p.total + ' steps &middot; ' + status + (p.last_done_at ? ' &middot; last step ' + E(ago(p.last_done_at)) : ' &middot; no step ticked yet')
      + (p.next ? ' &middot; next: ' + E(p.next.name) : '') + '</div>'
      + '<div class="w166wks">' + wks + '</div>'
      + '<div class="w166you"><div class="w166h">Where you come in</div>' + (leadStepsHtml(p) || '<div class="w166note">Nothing for you right now.</div>') + '</div>'
      + (av ? '<div class="w166av2"><b>Avenue Academy</b>' + av + '</div>' : '')
      + '<details class="w166plan"' + (S.open[p.onboarding_id] ? ' open' : '') + ' data-w166plan="' + E(p.onboarding_id) + '"><summary>See their plan</summary>' + planHtml(p) + '</details>'
      + '</div>';
  }
  function cardHtml(d) {
    var ppl = (d && d.people) || [];
    if (!ppl.length) return '';
    return '<h3>' + (ppl.length === 1 ? 'Your new person’s onboarding' : 'Your people’s onboarding (' + ppl.length + ')') + '</h3>'
      + '<p style="margin:0 0 10px;font-size:12.5px;color:#4a5551">How each person you are bringing in is doing, and the moments that are yours. Tick yours as you do them.</p>'
      + '<div class="w166ppl">' + ppl.map(personHtml).join('') + '</div>';
  }
  function paint() {
    var body = document.getElementById('mpBody');
    var el = document.getElementById('w166lead');
    var html = cardHtml(S.lead);
    if (!body || !html) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'w166lead'; el.className = 'mp-sec';
      var a = document.getElementById('w112wrap') || body.querySelector('.mp-online') || body.querySelector('.mp-chips') || body.querySelector('.mp-head');
      if (a && a.parentNode === body) body.insertBefore(el, a.nextSibling); else body.insertBefore(el, body.firstChild);
    }
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
  }
  function refresh(force) { return load(force).then(function () { paint(); }); }
  document.addEventListener('toggle', function (e) {
    var d = e.target; if (!d || !d.getAttribute || !d.getAttribute('data-w166plan')) return;
    S.open[d.getAttribute('data-w166plan')] = d.open;
  }, true);
  document.addEventListener('change', async function (e) {
    var c = e.target; if (!c || !c.getAttribute || !c.getAttribute('data-w166tick')) return;
    var id = Number(c.getAttribute('data-w166tick')); S.busy['t' + id] = true; c.disabled = true;
    try {
      var r = await db.rpc('onboarding_lead_tick', { p_step: id, p_done: !!c.checked });
      if (r && r.error) throw r.error;
      T(c.checked ? 'Done. Thank you.' : 'Marked not done');
    } catch (err) { c.checked = !c.checked; T('Could not save that: ' + String((err && err.message) || err).slice(0, 80)); }
    delete S.busy['t' + id];
    await refresh(true);
  }, true);
  document.addEventListener('click', async function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-w166resolve]') : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation(); b.disabled = true;
    try {
      var r = await db.rpc('onboarding_help_resolve', { p_id: Number(b.getAttribute('data-w166resolve')) });
      if (r && r.error) throw r.error;
      T('Marked as dealt with');
    } catch (err) { b.disabled = false; T('Could not save that'); return; }
    await refresh(true);
  }, true);
