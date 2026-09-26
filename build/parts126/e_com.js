
  /* ---------- the committees ---------- */
  function namesOf(ids) { return (ids || []).map(memberName).filter(Boolean); }
  function stepHtml(s) { return '<div class="' + (s.done ? 'done' : '') + '"><small>' + (s.done ? I('check') : '') + E(s.t) + '</small><b>' + E(s.note) + '</b></div>'; }
  function logRowHtml(t) {
    var k = KIND[t.kind] || KIND.note, who = memberName(t.member_id) || t.logged_by_name || '';
    var line = t.kind === 'recommendation' ? (t.recommendation || t.summary) : (t.summary || t.recommendation || '');
    return '<div class="w126lg" data-w126tp="' + t.id + '" tabindex="0" role="button"><span class="k ' + E(t.kind) + '">' + E(k[1].replace(/ (touchpoint|working session|for the board)$/, '')) + '</span><div><b>' + E(clip(line || (t.with_whom ? 'With ' + t.with_whom : k[1]), 120)) + '</b><span>' + E(fmtDay(parseDay(t.happened_on), true)) + (who ? ' · ' + E(who) : '') + (t.with_whom && line ? ' · with ' + E(t.with_whom) : '') + '</span></div></div>';
  }
  function comHtml(c) {
    var st = steps(c), n = st.filter(function (s) { return s.done; }).length, dirs = (c.member_ids || []).map(memberById).filter(Boolean);
    var parts = dirs.map(function (m) {
      var mine = myCycleTps(m.id, c), kinds = {};
      mine.forEach(function (t) { kinds[t.kind] = (kinds[t.kind] || 0) + 1; });
      var txt = mine.length ? Object.keys(kinds).map(function (k) { return kinds[k] + ' ' + (KIND[k] ? KIND[k][1].toLowerCase() : k) + (kinds[k] > 1 ? 's' : ''); }).join(', ') : '';
      return '<div class="row"><span class="w126av" style="background:' + E(c.color || GREEN) + '">' + E(initials(m.full_name || m.name)) + '</span><b>' + E(m.name) + (String(c.chair_id) === String(m.id) ? ' (chair)' : '') + '</b><span class="tx' + (txt ? '' : ' none') + '">' + E(txt || 'Nothing logged this cycle') + '</span></div>';
    }).join('');
    var log = tps().filter(function (t) { return t.committee === c.key; });
    var chair = c.chair_id ? memberName(c.chair_id) : '';
    return '<div class="w126card w126com" id="w126com-' + c.key + '" style="--c:' + E(c.color || GREEN) + '">'
      + '<div class="ch"><div class="tt"><h3>' + E(c.name) + '</h3><span class="sp"></span><span class="w126st" style="background:rgba(16,63,57,.07);color:' + GREEN + '">' + n + ' of 4 this cycle</span></div>' + (c.purpose ? '<p>' + E(c.purpose) + '</p>' : '') + '</div>'
      + '<div class="w126ros"><div><small>Chair</small><b>' + E(chair || 'To name') + (chair && !c.chair_confirmed ? '<em>proposed</em>' : '') + '</b></div>'
      + '<div><small>Directors</small><b>' + E(namesOf(c.member_ids).join(', ') || 'None yet') + '</b></div>'
      + '<div><small>Internal leads</small><b>' + E((c.internal_leads || []).join(', ') || 'To name') + '</b></div>'
      + '<div><small>To recruit</small><b>' + E(c.external_recruit || 'An outside professional') + '</b></div></div>'
      + '<div class="w126stp">' + st.map(stepHtml).join('') + '</div>'
      + (seeDirectors() ? '<div class="w126part"><h4>Each director this cycle</h4>' + (parts || '<p class="w126empty">No directors on this committee yet.</p>') + '</div>' : '')
      + '<div class="w126log"><h4>The log</h4>' + (log.length ? log.slice(0, 4).map(logRowHtml).join('') + (log.length > 4 ? '<a class="w126tog" data-w126all="' + c.key + '">' + I('chev') + 'All ' + log.length + ' entries</a>' : '') : '<p class="w126empty">Nothing logged yet. Start with a touchpoint with the team lead.</p>') + '</div>'
      + '<div class="cf">' + (canLog(c) ? '<a class="w126btn sm" data-w126log="' + c.key + '">' + I('plus') + 'Log a touchpoint</a>' : '') + '<span class="sp"></span>'
      + (c.depts && c.depts.length && staffOk() ? '<a class="w126btn ghost sm" data-w126go="#team/' + E(c.depts[0]) + '">' + I('people') + 'The team</a>' : '')
      + (canEditCommittee(c) ? '<a class="w126btn ghost sm" data-w126cedit="' + c.key + '">' + I('pen') + 'Edit</a>' : '') + '</div></div>';
  }
  function howHtml() {
    var how = [['1', 'Chair', 'Coordinates the meetings and owns the follow-through.', GREEN], ['2', 'Touchpoint 1: internal', 'Meet the team lead to get the real picture from the ground.', '#2A6F55'], ['3', 'Touchpoint 2: external', 'A 30 to 60 minute working session with a professional from your network.', PURPLE], ['4', 'Bring it to the board', 'Arrive with informed views and a recommendation: fuel for real debate.', '#C8961F']];
    var cs = cycleStart(), ce = cycleEnd(), due = committeeDue();
    return '<div class="w126how">' + how.map(function (h) { return '<div style="--c:' + h[3] + '"><i>' + h[0] + '</i><b>' + E(h[1]) + '</b><span>' + E(h[2]) + '</span></div>'; }).join('') + '</div>'
      + '<div class="w126cyc">' + I('clock') + '<span>' + (ce ? 'This cycle runs from the <b>' + E(fmtDay(cs)) + '</b> meeting to the <b>' + E(fmtDay(ce)) + '</b> meeting. Committees meet by <b>' + E(fmtDay(due)) + '</b>: once with the team, once with an outside professional.' : 'Committees meet twice between board meetings: once with the team, once with an outside professional.') + '</span></div>';
  }
  function stratHtml() {
    var s = strategySession(), chair = directors().filter(function (m) { return /^chair\b/i.test(String(m.seat || '').trim()); })[0];
    return '<div class="w126strat"><div class="w126card dark"><h3>Strategy: the whole board</h3><p>Strategy stays with the full board, everyone’s job, run as a dedicated block at every meeting' + (chair ? ', led by the board chair (' + E(chair.name) + ')' : '') + '.</p><p>' + (s ? 'Next: ' + E(s.title) + (s.meets_at ? ', ' + E(fmtDay(dayOfIso(s.meets_at), true)) : ' (to schedule)') + '. ' : '') + '<a class="w126lnk" data-w126go="#governance/strategy">Where strategy stands</a></p></div>'
      + '<div class="w126card"><h3>Cadence</h3><ul><li>4 board meetings a year, plus an AGM</li><li>Each committee meets twice between board meetings: once with the team, once with an outside professional</li><li>Monthly for committees chasing a target</li><li>An October fiscal year-end strategy session</li></ul></div>'
      + '<div class="w126card"><h3>Recruiting beyond the board</h3><ul><li>Our networks: the fastest yes</li><li>Donors, past and standout volunteers</li><li>Professors: public policy, Indigenous studies, IT</li><li>Director networks (ICD) and working groups as on-ramps</li></ul></div></div>';
  }
  function comPaint() {
    var h = host('committees', 'w126com'); if (!h) return;
    mast('committees', 'Board & Governance', 'Committees', 'Four working committees, each chaired by a director: meet the team, bring in an outside professional, and arrive at the board with a recommendation.');
    if (!canSee()) { h.innerHTML = '<div class="w126card"><p class="w126empty">The board pages are for directors, board advisers and leaders.</p></div>'; return; }
    if (!B.data) { h.innerHTML = segHtml('com') + '<div class="w126card"><p class="w126empty">Loading the committees…</p></div>'; return; }
    var cs = comms();
    var html = segHtml('com') + howHtml()
      + '<div class="w126sec"><h2>The four committees</h2><span>From reporting to engaging: each committee owns an area, gathers context and brings an informed view.</span></div>'
      + (cs.length ? '<div class="w126coms">' + cs.map(comHtml).join('') + '</div>' : '<p class="w126empty">No committees yet.</p>')
      + stratHtml();
    if (h.__h !== html) { h.innerHTML = html; h.__h = html; }
  }
  async function comShow(sub) {
    var h = host('committees', 'w126com'); if (!h) return;
    await loadMe();
    comPaint();
    if (!canSee()) return;
    await load();
    if (onPage('committees')) {
      comPaint();
      if (sub && commByKey(sub)) { var el = document.getElementById('w126com-' + sub); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }
    }
  }
