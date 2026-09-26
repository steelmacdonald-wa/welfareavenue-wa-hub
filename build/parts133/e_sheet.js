
  /* ---------- the sheet: a seat, a person, a new open position ---------- */
  var lastFocus = null;
  function sheetEl() { var el = document.getElementById('w133sheet'); if (!el) { el = document.createElement('div'); el.id = 'w133sheet'; document.body.appendChild(el); } return el; }
  function openSheet(s) { if (!O.sheet) lastFocus = document.activeElement; O.sheet = s; renderSheet(true); }
  function closeSheet() {
    var el = document.getElementById('w133sheet'); if (el) { el.classList.remove('on'); el.innerHTML = ''; }
    O.sheet = null;
    if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    lastFocus = null;
  }
  function whoRow(X, p) {
    var m = holder(p);
    return '<div class="who" data-w133p="' + E(p.id) + '" role="button" tabindex="0">' + (m ? avatar(m, 30) : '<span style="width:30px;height:30px;border-radius:50%;border:1.5px dashed rgba(140,106,46,.7);display:inline-flex;align-items:center;justify-content:center;color:#8C6A2E;flex:none">' + I('open') + '</span>') + '<div style="min-width:0"><b>' + E(m ? m.name : 'Open position') + '</b><br><span>' + E(p.title || (m && m.role) || '') + (m && seatTeam(p) ? ' · ' + E(teamShort(seatTeam(p))) : '') + '</span></div></div>';
  }
  function seatLabel(X, s) { var m = holder(s); return (m ? m.name : 'Open position') + (s.title ? ' (' + clip(s.title, 40) + ')' : ''); }
  function mgrOptions(X, p, cur) {
    var out = '<option value=""' + (cur == null ? ' selected' : '') + '>The executive directors (both)</option>';
    execs(X).forEach(function (e) { out += '<option value="' + E(e.id) + '"' + (String(cur) === String(e.id) ? ' selected' : '') + '>' + E(seatName(e)) + ' (executive director)</option>'; });
    teams().concat(['']).forEach(function (d) {
      var seats = (O.pos || []).filter(function (s) { return s.kind !== 'exec' && (d ? seatTeam(s) === d : teams().indexOf(seatTeam(s)) < 0) && (!p || !isUnder(X, s.id, p.id)); }).sort(seatOrder);
      if (!seats.length) return;
      out += '<optgroup label="' + E(d ? teamLabel(d) : 'Other') + '">' + seats.map(function (s) { return '<option value="' + E(s.id) + '"' + (String(cur) === String(s.id) ? ' selected' : '') + '>' + E(seatLabel(X, s)) + '</option>'; }).join('') + '</optgroup>';
    });
    return out;
  }
  function teamOptions(cur) { return teams().map(function (d) { return '<option value="' + E(d) + '"' + (cur === d ? ' selected' : '') + '>' + E(teamLabel(d)) + '</option>'; }).join(''); }
  function pickList(X, p) {
    var q = lower(O.sheet.pq || ''), mine = [], by = {};
    (O.pos || []).forEach(function (s) {
      if (String(s.id) === String(p.id) || s.kind === 'exec' || isUnder(X, p.id, s.id)) return;
      var hay = lower(seatName(s) + ' ' + s.title + ' ' + teamShort(seatTeam(s)));
      if (q && hay.indexOf(q) < 0) return;
      if (String(s.reports_to) === String(p.id)) mine.push(s); else (by[seatTeam(s)] = by[seatTeam(s)] || []).push(s);
    });
    var sel = O.sheet.sel || {};
    var ticked = function (s, dflt) { return Object.prototype.hasOwnProperty.call(sel, String(s.id)) ? sel[String(s.id)] : dflt; };
    var row = function (s, on0) { var on = ticked(s, on0); return '<label><input type="checkbox" data-w133pick="' + E(s.id) + '"' + (on ? ' checked' : '') + '><span>' + E(seatName(s)) + '</span><em>' + E(clip(s.title, 34)) + (on0 ? '' : ' · now under ' + E(mgrShort(X, s))) + '</em></label>'; };
    var html = mine.length ? '<div class="gh">Report to ' + E(first(seatName(p))) + ' now</div>' + mine.sort(seatOrder).map(function (s) { return row(s, true); }).join('') : '';
    teams().concat(Object.keys(by).filter(function (k) { return teams().indexOf(k) < 0; })).forEach(function (d) { var l = by[d]; if (!l || !l.length) return; html += '<div class="gh">' + E(d ? teamLabel(d) : 'Other') + '</div>' + l.sort(seatOrder).map(function (s) { return row(s, false); }).join(''); });
    return html || '<p class="note">No one matches.</p>';
  }
  function view() {
    var s = O.sheet, X = ix();
    if (s.kind === 'new') {
      var under = s.under == null ? null : X.byId[s.under];
      return { kicker: 'The org chart', title: 'Add an open position', sub: under ? 'Reporting to ' + seatName(under) : (s.dept ? 'Leading ' + teamLabel(s.dept) : ''), body:
        '<div class="sec"><label class="f">Title<input type="text" id="w133ntitle" maxlength="120" placeholder="For example: Volunteer coordinator, Toronto" value="' + E(s.title || '') + '"></label>'
        + '<label class="f">Team<select id="w133nteam">' + teamOptions(s.dept || (under ? seatTeam(under) : teams()[0])) + '</select></label>'
        + '<label class="f">Reports to<select id="w133nmgr">' + mgrOptions(X, null, s.under) + '</select></label>'
        + '<h4>Where it stands</h4><div class="sts">' + ['open', 'hiring', 'on_hold'].map(function (k) { return '<button type="button" data-w133sts="' + k + '" class="' + ((s.status || 'open') === k ? 'on' : '') + '">' + STATUS[k][0] + '</button>'; }).join('') + '</div>'
        + '<label class="f" style="margin-top:12px">Note<textarea id="w133nnote" maxlength="300" placeholder="For example: recruiting now, or once the fall budget is set">' + E(s.note || '') + '</textarea></label><div class="err" id="w133err">' + E(s.err || '') + '</div></div>',
        foot: '<span style="flex:1"></span><button type="button" class="w133btn" data-w133close="1">Cancel</button><button type="button" class="w133btn pri" data-w133do="create">' + I('plus') + 'Add the position</button>' };
    }
    if (s.kind === 'member') {
      var m = memberById(s.mid); if (!m) return null;
      var isBoard = m.department === 'board';
      var body = '<div class="sec"><p>' + (isBoard ? 'On the board of directors.' : (X.seatOf[m.id] ? '' : 'On the roster, not placed on the chart yet.')) + '</p>' + (isBoard && tabOk('governance') ? '<p><a class="w133lnk" data-w133go="#governance" style="color:' + GREEN + ';font-weight:700;cursor:pointer">Open the Board overview</a></p>' : '') + '</div>';
      if (!isBoard && !X.seatOf[m.id] && O.canEdit) body += '<div class="sec"><h4>Place them on the chart</h4><label class="f">Reports to<select id="w133pmgr">' + mgrOptions(X, null, headOf(X, m.department)) + '</select></label><div class="err" id="w133err">' + E(s.err || '') + '</div><button type="button" class="w133btn pri" data-w133do="place">' + I('check') + 'Place ' + E(first(m.name)) + '</button></div>';
      return { kicker: isBoard ? 'Board of directors' : teamLabel(m.department), title: m.name, sub: m.role || '', body: body, foot: '<button type="button" class="w133btn" data-w133go="#person/' + E(m.id) + '">' + I('seat') + 'Open their profile</button><span style="flex:1"></span><button type="button" class="w133btn" data-w133close="1">Close</button>' };
    }
    var p = X.byId[s.id]; if (!p) return null;
    var mm = holder(p), ks = (X.kids[String(p.id)] || []).slice().sort(seatOrder), ed = O.canEdit;
    var html = '';
    /* reports to */
    if (p.kind === 'exec') html += '<div class="sec"><h4>Reports to</h4><p>The board of directors.</p></div>';
    else if (ed) html += '<div class="sec"><h4>Reports to</h4><select id="w133mgr">' + mgrOptions(X, p, p.reports_to) + '</select><div class="row" style="margin-top:10px"><button type="button" class="w133btn pri" data-w133do="mgr">' + I('check') + 'Save</button></div></div>';
    else { var g = p.reports_to == null ? null : X.byId[p.reports_to]; html += '<div class="sec"><h4>Reports to</h4>' + (g ? whoRow(X, g) : '<p>The executive directors.</p>') + '</div>'; }
    /* direct reports */
    if (ed) html += '<div class="sec"><h4>Direct reports' + (ks.length ? ' (' + ks.length + ')' : '') + '</h4><p class="note">Tick who reports to ' + E(mm ? first(mm.name) : 'this position') + '. Anyone you untick moves up to ' + E(mgrShort(X, p)) + '.</p>'
      + '<input type="search" id="w133pq" placeholder="Find someone" value="' + E(s.pq || '') + '" aria-label="Find someone"><div class="picks" id="w133picks">' + pickList(X, p) + '</div><div class="row" style="margin-top:10px"><button type="button" class="w133btn pri" data-w133do="reports">' + I('check') + 'Save direct reports</button></div></div>';
    else html += '<div class="sec"><h4>Direct reports' + (ks.length ? ' (' + ks.length + ')' : '') + '</h4>' + (ks.length ? ks.map(function (k) { return whoRow(X, k); }).join('') : '<p>No one reports to ' + E(mm ? first(mm.name) : 'this position') + '.</p>') + '</div>';
    /* the seat */
    if (!mm) {
      if (ed) html += '<div class="sec"><h4>The position</h4><label class="f">Title<input type="text" id="w133title" maxlength="120" value="' + E(p.title || '') + '"></label><label class="f">Team<select id="w133team">' + teamOptions(p.department || '') + '</select></label>'
        + '<h4>Where it stands</h4><div class="sts">' + ['open', 'hiring', 'on_hold'].map(function (k) { return '<button type="button" data-w133sts="' + k + '" class="' + ((s.status || p.status) === k ? 'on' : '') + '">' + STATUS[k][0] + '</button>'; }).join('') + '</div>'
        + '<label class="f" style="margin-top:12px">Note<textarea id="w133note" maxlength="300">' + E(p.note || '') + '</textarea></label><div class="row"><button type="button" class="w133btn pri" data-w133do="save">' + I('check') + 'Save</button></div></div>'
        + '<div class="sec"><h4>Fill it</h4><select id="w133fill">' + fillOptions(X) + '</select><p class="note" style="margin-top:6px">Someone who already has a seat moves here, and their old seat stays on the chart as an open position.</p><div class="row"><button type="button" class="w133btn pri" data-w133do="fill">' + I('seat') + 'Put them in this position</button></div></div>';
      else html += '<div class="sec"><h4>The position</h4><p>' + statusChip(p) + ' ' + E(teamLabel(p.department)) + '</p>' + (p.note ? '<p>' + E(p.note) + '</p>' : '') + '</div>';
    } else if (ed) {
      html += '<div class="sec"><h4>The seat</h4><label class="f">Title (their role everywhere in the Hub)<input type="text" id="w133title" maxlength="120" value="' + E(p.title || mm.role || '') + '"></label><div class="row"><button type="button" class="w133btn pri" data-w133do="save">' + I('check') + 'Save the title</button></div></div>';
    }
    if (ed) {
      html += '<div class="sec"><h4>More</h4><div class="row"><button type="button" class="w133btn" data-w133addunder="' + E(p.id) + '">' + I('plus') + 'Add an open position under ' + E(mm ? first(mm.name) : 'it') + '</button>'
        + (mm && p.kind !== 'exec' ? '<button type="button" class="w133btn warn" data-w133do="vacate">' + I('out') + 'Take ' + E(first(mm.name)) + ' off this seat</button>' : '')
        + (!mm ? '<button type="button" class="w133btn warn" data-w133do="remove">' + I('trash') + 'Remove this position</button>' : '') + '</div><div class="err" id="w133err">' + E(s.err || '') + '</div></div>';
    }
    var foot = (mm ? '<button type="button" class="w133btn" data-w133go="#person/' + E(mm.id) + '">' + I('seat') + 'Open their profile</button>' : '<button type="button" class="w133btn" data-w133go="#requests/new/hr/hiring-request">' + I('mail') + 'Ask HR to recruit</button>') + '<span style="flex:1"></span><button type="button" class="w133btn" data-w133close="1">Close</button>';
    return { kicker: p.kind === 'exec' ? 'Executive director' : (mm ? teamLabel(seatTeam(p)) : 'Open position · ' + teamLabel(p.department)), title: mm ? mm.name : (p.title || 'Open position'), sub: mm ? (p.title || mm.role || '') : (STATUS[p.status] || STATUS.open)[0] + (p.note ? ' · ' + clip(p.note, 60) : ''), body: html, foot: foot };
  }
  function headOf(X, d) { var h = heads(X).filter(function (p) { return seatTeam(p) === d && !isOpen(p); })[0]; return h ? h.id : null; }
  function fillOptions(X) {
    var out = '<option value="">Pick someone</option>', up = unplaced(X);
    if (up.length) out += '<optgroup label="Not on the chart yet">' + up.map(function (m) { return '<option value="' + E(m.id) + '">' + E(m.name) + ' (' + E(teamShort(m.department)) + ')</option>'; }).join('') + '</optgroup>';
    teams().forEach(function (d) {
      var ms = members().filter(function (m) { return m.department === d && X.seatOf[m.id]; }).sort(function (a, b) { return lower(a.name).localeCompare(lower(b.name)); });
      if (ms.length) out += '<optgroup label="' + E(teamLabel(d)) + '">' + ms.map(function (m) { return '<option value="' + E(m.id) + '">' + E(m.name) + ' (now ' + E(clip(X.seatOf[m.id].title, 30)) + ')</option>'; }).join('') + '</optgroup>';
    });
    return out;
  }
  function renderSheet(first0) {
    var s = O.sheet; if (!s) { closeSheet(); return; }
    var v = view(); if (!v) { closeSheet(); return; }
    var el = sheetEl(), wasOn = el.classList.contains('on');
    if (!wasOn || !el.querySelector('.pane')) el.innerHTML = '<div class="bk" data-w133close="1"></div><div class="pane" role="dialog" aria-modal="true"><div class="ph"></div><div class="bd"></div><div class="ft" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 20px calc(14px + env(safe-area-inset-bottom));border-top:1px solid rgba(16,63,57,.08);background:var(--wa-card,#FFFAF2)"></div></div>';
    var bd = el.querySelector('.bd'), st = bd.scrollTop;
    el.querySelector('.pane').setAttribute('aria-label', v.title);
    el.querySelector('.ph').innerHTML = '<div style="min-width:0"><div class="kk">' + E(v.kicker) + '</div><h2>' + E(v.title) + '</h2>' + (v.sub ? '<div class="sub">' + E(v.sub) + '</div>' : '') + '</div><span class="sp"></span><button type="button" class="xb" data-w133close="1" aria-label="Close">' + I('x') + '</button>';
    bd.innerHTML = v.body; el.querySelector('.ft').innerHTML = v.foot;
    if (wasOn && !first0) bd.scrollTop = st;
    el.classList.add('on');
    if (first0) setTimeout(function () { var f = el.querySelector(s.kind === 'new' ? '#w133ntitle' : '.xb'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }, 40);
  }
  function sheetErr(msg) { if (!O.sheet) return; O.sheet.err = msg; O.sheet.busy = false; var e = document.getElementById('w133err'); if (e) e.textContent = msg; else renderSheet(false); }
  function val(id) { var el = document.getElementById(id); return el ? el.value : null; }
  async function sheetDo(what) {
    var s = O.sheet; if (!s || s.busy) return;
    var X = ix(), p = s.id != null ? X.byId[s.id] : null;
    s.busy = true; s.err = '';
    try {
      if (what === 'create') {
        var t = String(val('w133ntitle') || '').trim(); if (!t) { sheetErr('Give the position a title.'); return; }
        var mg = val('w133nmgr'); var res = await addOpening(mg ? Number(mg) : null, { title: t, dept: val('w133nteam'), status: s.status || 'open', note: val('w133nnote') });
        O.sheet = { kind: 'seat', id: res && res.id }; if (res && res.id) renderSheet(true); else closeSheet();
      } else if (what === 'place') {
        var pm = val('w133pmgr'); await place(s.mid, pm ? Number(pm) : null); var X2 = ix(); var seat = X2.seatOf[s.mid]; if (seat) { O.sheet = { kind: 'seat', id: seat.id }; renderSheet(true); } else closeSheet();
      } else if (what === 'mgr' && p) {
        var to = val('w133mgr'); var toId = to ? Number(to) : null;
        if (String(toId) === String(p.reports_to)) { s.busy = false; toastS('No change'); return; }
        await move(p, toId, null, false);
      } else if (what === 'reports' && p) {
        /* every tick, including the ones hidden by the search */
        var sel = s.sel || {}, ids = [];
        (O.pos || []).forEach(function (x) { var k = String(x.id); var on = Object.prototype.hasOwnProperty.call(sel, k) ? sel[k] : String(x.reports_to) === String(p.id); if (on && String(x.id) !== String(p.id)) ids.push(Number(x.id)); });
        await setReports(p, ids);
      } else if (what === 'save' && p) {
        var tt = String(val('w133title') || '').trim(); if (!tt) { sheetErr('Give the position a title.'); return; }
        await updateSeat(p, { title: tt, status: s.status || p.status, note: val('w133note'), dept: val('w133team') });
      } else if (what === 'fill' && p) {
        var who = val('w133fill'); if (!who) { sheetErr('Pick someone first.'); return; }
        await fill(p, Number(who));
      } else if (what === 'vacate' && p) {
        if (!confirm('Take ' + seatName(p) + ' off this seat? They stay on the roster, and ' + p.title + ' becomes an open position.')) { s.busy = false; return; }
        await vacate(p);
      } else if (what === 'remove' && p) {
        if (!confirm('Remove this open position?' + ((X.kids[String(p.id)] || []).length ? ' Whoever reports to it moves up a level.' : ''))) { s.busy = false; return; }
        await removeSeat(p);
      }
      if (O.sheet) { O.sheet.busy = false; }
    } catch (e) { sheetErr(errText(e)); }
  }
