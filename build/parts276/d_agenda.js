
  /* ---------- the Agenda tab: When can we meet? ----------
     #w276panel sits right before #w116agHost (wave116's mountAgenda). The heat map shades each cell by the share of
     members with a grid who are free then (members with no grid are "not yet entered", never shaded as busy); tapping a
     cell or hovering it lists the names. Managers (wa_avail_team.can_manage) get Propose on each best slot, the names of
     who is outstanding, and Ask the team. A paint for one team that resolves after a newer paint started is dropped. */
  function heatOf(t) {
    var members = (t && t.members) || [], n = members.length, by = {}, cl = {};
    members.forEach(function (m, i) { uniq(m.slots).forEach(function (s) { (by[s] = by[s] || []).push(i); }); });
    ((t && t.clashes) || []).forEach(function (c) { var s = Number(c.slot); cl[s] = (cl[s] || 0) + 1; });
    function name(m) { return m.name || m.email || ''; }
    return function (s) {
      if (!n) return { alpha: 0, title: 'No one has entered a week yet' };
      var free = by[s] || [], yes = free.map(function (i) { return name(members[i]); });
      var no = members.filter(function (m, i) { return free.indexOf(i) < 0; }).map(name);
      var title = (yes.length ? 'Free: ' + yes.join(', ') + '.' : 'No one is free.') + (no.length ? ' Not free: ' + no.join(', ') + '.' : '');
      if (cl[s]) title += ' ' + (cl[s] === 1 ? '1 person is' : cl[s] + ' people are') + ' usually in a meeting.';
      return { alpha: free.length / n, title: title, x: !!cl[s] };
    };
  }

  function closeProp() {
    var bk = document.getElementById('w276pback'); if (!bk) return;
    bk.remove(); document.removeEventListener('keydown', escProp, true);
    var f = W276.propFrom; W276.propFrom = null;
    if (f && f.isConnected && f.focus) { try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  function escProp(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeProp(); } }
  function propose(dept, t, w, from) {
    closeProp(); W276.propFrom = from || document.activeElement;
    var members = (t && t.members) || [], missing = (t && t.missing) || [];
    var cant = members.filter(function (m) { return w.who.indexOf(String(m.email || '').toLowerCase()) < 0; }).map(function (m) { return m.name || m.email; });
    var label = windowLabel(w);
    var bk = document.createElement('div'); bk.id = 'w276pback';
    bk.innerHTML = '<div id="w276prop" role="dialog" aria-modal="true" aria-labelledby="w276ptitle">'
      + '<button type="button" class="x" aria-label="Close" data-w276p="cancel">&times;</button>'
      + '<p class="k">' + E(teamLabel(dept)) + '</p>'
      + '<h2 id="w276ptitle" tabindex="-1">Propose this meeting time?</h2>'
      + '<p class="slot">' + E(label) + '</p>'
      + '<p><b>Can make it (' + w.names.length + '):</b> ' + E(w.names.join(', ') || 'No one') + '</p>'
      + '<p><b>Cannot make it (' + cant.length + '):</b> ' + E(cant.join(', ') || 'No one') + '</p>'
      + (missing.length ? '<p><b>Not yet entered (' + missing.length + '):</b> ' + E(missing.map(function (m) { return m.name || m.email; }).join(', ')) + '</p>' : '')
      + '<p class="help">Everyone else on the team gets a message in the Hub and on Slack. Nothing is added to the calendar.</p>'
      + '<p id="w276perr" role="alert" hidden></p>'
      + '<div class="row"><button type="button" class="yes" id="w276psend" data-w276p="send">Propose this time</button><button type="button" class="no" data-w276p="cancel">Cancel</button></div>'
      + '</div>';
    document.body.appendChild(bk);
    bk.addEventListener('click', async function (e) {
      if (e.target === bk) { closeProp(); return; }
      var b = e.target.closest && e.target.closest('[data-w276p]'); if (!b) return;
      if (b.getAttribute('data-w276p') !== 'send') { closeProp(); return; }
      if (b.disabled) return;
      b.disabled = true; b.textContent = 'Sending...';
      try {
        var r = await db.functions.invoke('notify', { body: { event: 'meet_propose', dept: dept, slot_label: label, who_can: w.names.length, who_cant: cant.length } });
        if (r && r.error) throw r.error;
        closeProp();
        say('Sent. The team knows you proposed ' + label + '.');
      } catch (err) {
        b.disabled = false; b.textContent = 'Propose this time';
        var pe = document.getElementById('w276perr'); if (pe) { pe.textContent = 'That did not send. Try again in a moment.'; pe.hidden = false; }
        console.warn('wave276 propose', err);
      }
    });
    document.addEventListener('keydown', escProp, true);
    var h = document.getElementById('w276ptitle'); if (h) { try { h.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }

  async function askTeam(dept, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Asking...'; }
    try {
      var r = rpcData(await db.rpc('wa_avail_ask_set', { p_dept: dept, p_date: isoToday(), p_note: null }));
      var n = ((r && r.missing) || []).length;
      var s = await db.functions.invoke('notify', { body: { event: 'meet_avail_ask', dept: dept } });
      if (s && s.error) throw s.error;
      say(n ? 'Asked. ' + (n === 1 ? '1 person' : n + ' people') + ' will get a message to add their week.' : 'Asked. Everyone on the team has an up to date week.');
      if (W276.agenda.dept === dept) paintAgenda(dept);
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Ask the team'; }
      say('That did not go through. Try again in a moment.');
      console.warn('wave276 ask', e);
    }
  }

  async function paintAgenda(dept) {
    var A = W276.agenda, tok = ++A.tok;
    A.dept = dept; A.busy = dept;
    try { await paintTeam(dept, tok); } finally { if (tok === A.tok) A.busy = null; }
  }
  async function paintTeam(dept, tok) {
    var A = W276.agenda;
    await loadCfg();
    var t = null;
    try { t = rpcData(await db.rpc('wa_avail_team', { p_dept: dept })); } catch (e) { t = null; console.warn('wave276 team', e); }
    if (tok !== A.tok) return;
    var host = document.getElementById('w116agHost');
    var panel = document.getElementById('w276panel');
    if (!host || !t) { if (panel) { if (A.view) { A.view.destroy(); A.view = null; } panel.remove(); } return; }
    if (!panel) { panel = document.createElement('section'); panel.id = 'w276panel'; panel.setAttribute('aria-labelledby', 'w276ph'); }
    if (panel.parentNode !== host.parentNode || panel.nextElementSibling !== host) host.parentNode.insertBefore(panel, host);
    if (A.view) { A.view.destroy(); A.view = null; }
    panel.setAttribute('data-dept', dept);
    var c = cfgFrom(t), members = t.members || [], missing = t.missing || [], can = !!t.can_manage;
    var k = members.length, n = members.length + missing.length;
    var wins = best(members, c.cellMin, t.clashes || []);
    var status = k + ' of ' + n + ' entered' + (missing.length ? ', ' + missing.length + ' outstanding' : '');
    panel.innerHTML = '<div class="hd"><h3 id="w276ph"><span class="k">' + E(teamLabel(dept)) + '</span>When can we meet?</h3>'
      + '<div class="acts"><button type="button" class="b2" id="w276mine">My availability</button>'
      + (can ? '<button type="button" class="b1" id="w276ask">Ask the team</button>' : '') + '</div></div>'
      + (can && missing.length
        ? '<p class="st"><button type="button" class="lk" id="w276st" aria-expanded="false" aria-controls="w276miss">' + E(status) + '</button></p>'
          + '<p id="w276miss" hidden>Not yet entered: ' + E(missing.map(function (m) { return m.name || m.email; }).join(', ')) + '</p>'
        : '<p class="st">' + E(status) + '</p>')
      + '<div class="body"><div class="map"><p class="help">Darker means more of the team is free. Tap or point at a time to see who.</p><div id="w276heat"></div><p id="w276cell" aria-live="polite"></p></div>'
      + '<div class="side"><h4>Best slots</h4><ol id="w276best">'
      + wins.map(function (w, i) {
        return '<li><span class="w">' + E(windowLabel(w)) + '</span><span class="n">' + w.n + ' of ' + k + ' can make it' + (w.clash ? ', clashes with ' + (w.clash === 1 ? '1 regular meeting' : w.clash + ' regular meetings') : '') + '</span>'
          + (can ? '<button type="button" class="b1" data-w276best="' + i + '">Propose</button>' : '') + '</li>';
      }).join('') + '</ol>'
      + (wins.length ? '' : '<p class="help">' + (k ? 'No hour yet when the same people are free for 60 minutes in a row. As more people add their week, times show here.' : 'Times show here once people add their week.') + '</p>')
      + '</div></div>';
    var heat = heatOf(t);
    A.view = grid(document.getElementById('w276heat'), {
      start: c.start, end: c.end, cellMin: c.cellMin, readOnly: true, heat: heat,
      onCell: function (s, el) { var u = unslot(s), o = document.getElementById('w276cell'); if (o) o.textContent = DAYS[u.di] + ' ' + clock(u.min) + ': ' + heat(s).title; }
    });
    panel.querySelector('#w276mine').addEventListener('click', function () { openPop(dept, null); });
    var ask = panel.querySelector('#w276ask'); if (ask) ask.addEventListener('click', function () { askTeam(dept, ask); });
    var st = panel.querySelector('#w276st');
    if (st) st.addEventListener('click', function () {
      var m = document.getElementById('w276miss'); if (!m) return;
      m.hidden = !m.hidden; st.setAttribute('aria-expanded', String(!m.hidden));
    });
    panel.querySelector('#w276best').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-w276best]'); if (!b) return;
      var w = wins[Number(b.getAttribute('data-w276best'))]; if (w) propose(dept, t, w, b);
    });
  }
  W276.paintAgenda = paintAgenda;
