  /* ---------- the serving page: header, Next up, the six stages ---------- */
  function root() { var r = document.getElementById('w119'); return r && r.classList.contains('w191') ? r : null; }
  function stageBody(k) { var r = root(); return r ? r.querySelector('.w191stage[data-stage="' + k + '"] > .b') : null; }
  function stepsBox(k) { var b = stageBody(k); return b ? b.querySelector('.w191steps') : null; }
  function clickProxy(sel) { var el = document.querySelector(sel); if (el) { el.click(); return true; } return false; }
  function openStage(k, scroll) { var r = root(); if (!r) return; var sec = r.querySelector('.w191stage[data-stage="' + k + '"]'); if (!sec) return; sec.classList.add('open'); S.open[k] = true; if (scroll) { try { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { sec.scrollIntoView(); } } }

  function headHtml(ev, D, M, row) {
    var fmt = ev.format || (row && row.format); var fmtL = fmt ? FORMATS[fmt] || fmt : '';
    var up = ev.status !== 'cancelled' && ev.status !== 'completed';
    var start = (row && row.start_time) || ev.start_time; var place = (row && row.location) || ev.location || '';
    var meals = row && row.planned_meals ? row.planned_meals + ' meals planned' : '';
    var meta = '<span class="cd">' + (M.cur === 'done' ? 'Done' : M.cur === 'cancelled' ? 'Cancelled' : countdown(ev).replace(/^(\d+) /, '<b>$1</b> ')) + '</span>'
      + (start ? '<span>' + E(hm12(start)) + (place ? ' at ' + E(place) : '') + '</span>' : (place ? '<span>' + E(place) + '</span>' : ''))
      + (meals ? '<span>' + E(meals) + '</span>' : '') + (ev.title ? '<span>' + E(ev.title) + '</span>' : '') + (partnerOf(ev.id) ? '<span class="w191with">With ' + E(partnerOf(ev.id).partner_name) + '</span>' : '');
    var prim = primaryAction(ev, D, M, row);
    var menu = ''
      + (staff() ? '<button data-w191go="find">Find volunteers</button><button data-w191go="conv">Conversations</button><button data-w191go="bplan">Plan the roster</button>' : '')
      + (staff() ? '<button data-w191go="text171">Text to confirm</button>' : '')
      + (staff() ? '<button data-w191go="send182">Send itineraries</button><button data-w191go="hist182">Sent and scheduled</button><button data-w191go="ev182">This serving’s itinerary</button>' : '')
      + (staff() ? '<button data-w191go="fmt">' + (fmt ? 'Change the format' : 'Set the format') + '</button><button data-w191go="date">Change the date</button><button data-w191go="partner">' + (partnerOf(ev.id) ? 'Edit the collaboration' : 'A partner organization serves with us') + '</button>' : '')
      + (staff() ? '<button data-w191go="brecap">Recap in Slack</button>' : '')
      + (staff() && up ? '<button data-w191go="close">Close this serving</button>' : '')
      + (staff() && ev.status === 'completed' ? '<button data-w191go="reopen">Reopen this serving</button>' : '')
      + (staff() ? '<button class="warn" data-w191go="cancel">' + (ev.status === 'cancelled' ? 'Restore this serving' : 'Cancel this serving') + '</button>' : '');
    var bar = STAGES.map(function (s, i) {
      var g = M.stages[s.k]; var sub = s.k === M.cur ? (M.cur === 'wrap_up' ? 'Now' : 'Now · ' + s.when.toLowerCase()) : g.state === 'done' ? 'Done' : g.state === 'late' ? (g.leaves - g.done) + ' left' : s.when;
      return '<button class="st ' + g.state + '" data-w191stage="' + s.k + '" style="--p:' + g.pct + '%" title="' + E(s.s) + '"><b>' + E(s.l) + '</b><span>' + E(sub) + '</span><i></i></button>';
    }).join('');
    return '<div class="k"><span>' + E(ev.code || 'Serving') + (ev.season ? ' · ' + E(ev.season) : '') + '</span>'
      + (up || fmtL ? '<button class="fmt' + (fmtL ? '' : ' unset') + '" data-w191go="fmt" title="The serving’s format">' + E(fmtL || 'Format not set') + '</button>' : '')
      + (ev.status === 'cancelled' ? '<span class="fmt" style="background:' + FLAG + '">Cancelled</span>' : ev.status === 'completed' ? '<span class="fmt" style="background:' + TEAL + '">Done</span>' : '') + '</div>'
      + '<h3>' + E(fmtDay(ev.event_date, true)) + '</h3><div class="meta">' + meta + '</div>'
      + '<div class="acts">' + (prim ? '<button class="w191btn gold" data-w191go="' + E(prim.go) + '">' + E(prim.l) + '</button>' : '')
      + '<button class="w191btn ghost" data-w191go="back">← All servings</button><span style="flex:1"></span>'
      + '<span class="more"><button class="w191btn quiet" data-w191go="menu">More ⋮</button><div class="menu">' + menu + '</div></span></div>'
      + '<div class="w191bar">' + bar + '</div>';
  }
  function primaryAction(ev, D, M, row) {
    if (!staff()) return null;
    var c = rosterCounts(D); var fmt = ev.format || (row && row.format);
    switch (M.cur) {
      case 'plan': return fmt ? { go: 'stage:plan', l: 'Review the plan' } : { go: 'fmt', l: 'Set the format' };
      case 'recruit': return { go: 'find', l: 'Find volunteers' };
      case 'confirm': return c.wait ? { go: 'text171', l: 'Text to confirm' } : { go: 'stage:prepare', l: 'Prepare the day' };
      case 'prepare': return (row && !row.whatsapp_url) ? { go: 'ev182', l: 'Add the WhatsApp link' } : { go: 'send182', l: 'Send itineraries' };
      case 'day_of': return { go: 'stage:day_of', l: 'Today’s contacts' };
      case 'wrap_up': return { go: 'close', l: 'Close this serving' };
      case 'done': return { go: 'brecap', l: 'Recap in Slack' };
    }
    return null;
  }
  function nextHtml(ev, D, M, row) {
    var items = []; var c = rosterCounts(D); var up = ev.status !== 'cancelled' && ev.status !== 'completed';
    /* what the serving itself still needs, by stage */
    if (up && !(ev.format || (row && row.format))) items.push({ act: 1, go: 'fmt', b: 'Set the format', s: 'Home-cooked or community kitchen: the itinerary and the texts depend on it.', l: 'Set it' });
    if (up && M.curIx >= STAGE_IX.recruit && c.short.length) items.push({ act: 1, go: 'find', b: 'Fill the roster: ' + c.short.length + ' role' + (c.short.length === 1 ? '' : 's') + ' short', s: c.short.slice(0, 3).map(function (r) { return roleLabel(r).toLowerCase() + ' ' + (c.by[r] || 0) + ' of ' + c.T[r]; }).join(', ') + (c.short.length > 3 ? ' and ' + (c.short.length - 3) + ' more' : '') + '. Find volunteers looks through the CRM and texts them for you.', l: 'Find volunteers' });
    if (up && M.curIx >= STAGE_IX.confirm && c.wait) items.push({ act: 1, go: 'text171', b: c.wait + ' still to confirm', s: 'The confirmation text carries their personal link.', l: 'Text to confirm' });
    if (up && M.curIx >= STAGE_IX.prepare && row && !row.whatsapp_url) items.push({ act: 1, go: 'ev182', b: 'Paste the WhatsApp group link', s: 'The itineraries carry it; nobody is added by hand.', l: 'Add the link' });
    /* then the steps a person must do: the current stage first, overdue first, due soonest first */
    var rows = M.steps.filter(function (r) { return !r.parent && !r.hub && !r.s.done && r.stage !== 'cancelled'; });
    rows.sort(function (a, b) { var ai = STAGE_IX[a.stage] <= M.curIx ? 0 : 1, bi = STAGE_IX[b.stage] <= M.curIx ? 0 : 1; if (ai !== bi) return ai - bi; var ad = a.s.due_date || '9999', bd = b.s.due_date || '9999'; if (ad !== bd) return ad < bd ? -1 : 1; return (a.t.sort || 0) - (b.t.sort || 0); });
    rows.slice(0, Math.max(1, 4 - items.length)).forEach(function (r) { items.push({ r: r }); });
    if (!items.length) return '';
    return '<div class="lbl">Next up</div><div class="grid">' + items.map(function (it) {
      if (it.act) return '<div class="n act"><span class="go">!</span><div><b>' + E(it.b) + '</b><span>' + E(it.s) + '</span>' + (staff() ? '<button class="w191btn gold" data-w191go="' + E(it.go) + '">' + E(it.l) + '</button>' : '') + '</div></div>';
      var r = it.r; var who = ownerOf(r);
      return '<div class="n">' + (staff() ? '<button class="tk" data-w191tick="' + r.s.id + '" title="Mark done"></button>' : '<span></span>') + '<div><b>' + E(r.t.name) + '</b><span>' + (who ? E(who) : '<em>no owner yet</em>') + (r.s.due_date ? ' · ' + (r.over ? '<em>due ' + E(fmtDue(r.s.due_date)) + '</em>' : 'due ' + E(fmtDue(r.s.due_date))) : '') + ' · ' + E(stageLabel(r.stage)) + '</span></div></div>';
    }).join('') + '</div>';
  }
  function stageHeadHtml(s, i, g, ev, D, row) {
    return '<span class="num">' + (g.state === 'done' ? '✓' : (i + 1)) + '</span><span><b>' + E(s.l) + '</b><span class="sub">' + stageSummary(s.k, g, ev, D, row) + '</span></span>'
      + '<span class="r">' + (g.hub ? '<span title="Steps the Hub ticks by itself">' + g.hubDone + '/' + g.hub + ' by the Hub</span>' : '') + '<span class="chev">▾</span></span>';
  }
  function planLine(ev, D, row) {
    var fmt = ev.format || (row && row.format);
    return '<div class="w191line"><span class="pill' + (fmt ? ' ok' : ' short') + '">' + E(fmt ? FORMATS[fmt] || fmt : 'Format not set') + '</span>'
      + (row && row.start_time ? '<button class="pill" data-w191go="start" title="Change the start time">Starts ' + E(hm12(row.start_time)) + '</button>' : '<button class="pill short" data-w191go="start">No start time</button>')
      + (row && row.planned_meals ? '<span class="pill">' + E(row.planned_meals) + ' meals</span>' : '<span class="pill short">Meals not set</span>')
      + (fmt === 'community_kitchen' && row && row.kitchen_place ? '<span class="pill">' + E(row.kitchen_place) + '</span>' : '')
      + (staff() ? '<button class="w191btn ghost" data-w191go="fmt">' + (fmt ? 'Change the format' : 'Set the format') + '</button>' : '')
      + (staff() && !partnerOf(ev.id) ? '<button class="w191btn ghost" data-w191go="partner" title="A partner organization (Oberoi Financial Group, say) serves with us">With a partner?</button>' : '') + '</div>'
      + (ev.title || ev.notes ? '<div class="w191ctx">' + (ev.title ? '<b>' + E(ev.title) + '</b>' : '') + (ev.notes ? '<span>' + E(ev.notes) + '</span>' : '') + '</div>' : '');
  }
  function recruitLine(D) {
    var c = rosterCounts(D);
    return '<div class="w191line">' + ROLE_ORDER.filter(function (r) { return c.T[r] || c.by[r]; }).map(function (r) { var n = c.by[r] || 0, t = c.T[r] || 0; var cls = 'pill' + (t && n < t ? ' short' : t ? ' ok' : ''), txt = E(roleLabel(r)) + ' ' + n + (t ? '/' + t : '');
      /* wave200: a staff member's pill opens Add people for that role */
      return staff() ? '<button type="button" class="' + cls + '" data-w119bench="' + E(r) + '" title="Add people as ' + E(roleLabel(r).replace(/s$/, '').toLowerCase()) + '">' + txt + '</button>' : '<span class="' + cls + '">' + txt + '</span>'; }).join('')
      + (staff() ? '<button class="w191btn ghost" data-w191go="bplan">Plan the roster</button>' : '') + '</div>';
  }
  function teamHeadHtml(D) {
    var c = rosterCounts(D); var need = 0; Object.keys(c.T).forEach(function (k) { need += c.T[k] || 0; });
    return '<span class="num" style="background:rgba(16,63,57,.08);color:' + GREEN + '">\u263A</span><span><b>The team</b><span class="sub">' + c.conf + ' confirmed of ' + c.on + ' on the list' + (need ? ' \u00b7 needs ' + need : '') + (c.short.length ? ' \u00b7 <em>' + c.short.length + ' role' + (c.short.length === 1 ? '' : 's') + ' short</em>' : (c.on ? ' \u00b7 <span class="ok">every role filled</span>' : '')) + '</span></span><span class="r"><span class="chev">\u25BE</span></span>';
  }
  function recruitStageLine(D) {
    var c = rosterCounts(D);
    var P0 = curEv() ? partnerOf(curEv().id) : null;
    return '<div class="w191line">' + (P0 && coversText(P0) ? '<span class="pill" title="Counted toward each role">' + E(P0.partner_name + ' covers ' + coversText(P0)) + '</span>' : '') + (c.short.length ? '<span class="pill short">' + c.short.length + ' role' + (c.short.length === 1 ? '' : 's') + ' short: ' + E(c.short.map(function (r) { return roleLabel(r).toLowerCase(); }).join(', ')) + '</span>' : '<span class="pill ok">Every role has someone</span>')
      + (staff() ? '<button class="w191btn gold" data-w191go="find">Find volunteers</button><button class="w191btn ghost" data-w191go="conv">Conversations</button><button class="w191btn ghost" data-w191go="bplan">Plan the roster</button><button class="w191btn ghost" data-w191go="team">See the team</button>' : '') + '</div>'
      + (staff() ? '<p style="margin:6px 0 0;font-size:12px;line-height:1.45;color:' + MUTED + '">Find volunteers: who signed up and never came, regulars we miss, who came once and who loved it, with a personal text to each from the ops line (9 am to 7 pm). Their YES lands on the roster by itself.</p>' : '');
  }
  /* a partner organization on the roster (Old Brewery Mission on dishes, a corporate partner serving) is not "not matched" */
  /* wave191l: a role column that scrolls says how many cards are below (and nothing once at the end) */
  function scrollHints() { document.querySelectorAll('#w119.w191 .board .rc').forEach(hintOne); }
  function hintOne(rc) {
    var m = rc.querySelector(':scope > .w191more');
    var over = rc.scrollHeight > rc.clientHeight + 6 && !rc.querySelector(':scope > .bench');
    if (!over) { if (m) m.remove(); return; }
    var bottom = rc.scrollTop + rc.clientHeight - 28, n = 0;
    rc.querySelectorAll(':scope > .pc').forEach(function (c) { if (c.offsetTop + c.offsetHeight / 2 > bottom) n++; });
    var txt = n ? '↓ ' + n + ' more' : '';
    if (!m) { m = document.createElement('div'); m.className = 'w191more'; m.setAttribute('aria-hidden', 'true'); rc.appendChild(m); }
    if (m.textContent !== txt) m.textContent = txt;
    if (m.classList.contains('end') !== !n) m.classList.toggle('end', !n);
  }
  document.addEventListener('scroll', function (e) {
    var t = e.target; if (!t || !t.classList || !t.classList.contains('rc') || !t.closest || !t.closest('#w119.w191')) return;
    if (t.__w191hr) return; t.__w191hr = requestAnimationFrame(function () { t.__w191hr = null; hintOne(t); });
  }, true);
  function partners() {
    var D = curD(); if (!D) return;
    var by = {}; (D.roster || []).forEach(function (x) { by[String(x.id)] = x; });
    document.querySelectorAll('#w119 [data-w119card]').forEach(function (el) {
      var x = by[el.getAttribute('data-w119card')]; if (!x || !(x.detail || {}).partner) return;
      var f = el.querySelector('.flag'); if (f && f.textContent !== 'Partner organization') { f.textContent = 'Partner organization'; f.classList.add('w191partner'); }
    });
  }
  function dayCard(ev, D, row) {
    var list = (D.roster || []).filter(function (r) { return !isOff(r) && !isDecl(r); });
    var ph = function (r) { var p = (r.detail || {}).phone; return p ? '<a href="tel:' + E(String(p).replace(/[^\d+]/g, '')) + '" style="color:' + GREEN + '">' + E(p) + '</a>' : '<span style="color:' + MUTED + '">no phone</span>'; };
    var who = function (role) { return list.filter(function (r) { return r.role === role; }).map(function (r) { var k = (r.detail || {}).driver_role; var st = runStartFor(ev.id, r.id, role); return '<div style="padding:4px 0;font-size:13.5px"><b>' + E(r.person_name || 'Unnamed') + '</b>' + (role === 'driver' && k ? ' <span style="color:' + MUTED + ';font-size:12px">' + E(k === 'main' ? 'main' : k === 'pickup' ? 'pickups' : 'main and pickups') + '</span>' : '') + (st ? ' <span class="w191st" title="From the run (Prepare)">starts ' + E(hm12(st)) + '</span>' : '') + ' · ' + ph(r) + (isConf(r) ? '' : ' <span style="color:' + MUTED + ';font-size:11.5px">not confirmed</span>') + '</div>'; }).join('') || '<div style="padding:4px 0;font-size:13px;color:' + FLAG + '">Nobody yet</div>'; };
    var tl = list.filter(function (r) { return r.role === 'team_leader' && r.confirm_token; })[0];
    return '<div class="cardy"><h4>The day</h4><div class="w191grid2">'
      + '<div><div class="w191grp" style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:' + MUTED + ';font-weight:700;margin:0 0 2px">Team leaders</div>' + who('team_leader') + '<div class="w191grp" style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:' + MUTED + ';font-weight:700;margin:10px 0 2px">Drivers</div>' + who('driver') + '</div>'
      + '<div><div style="font-size:13.5px;line-height:1.6">' + (row && row.start_time ? 'Serving at <b>' + E(hm12(row.start_time)) + '</b>' : 'Start time not set') + (row && row.location ? ' · ' + E(row.location) : '') + '<br>Ops line <a href="tel:+14388087754" style="color:' + GREEN + '"><b>438-808-7754</b></a>'
      + '<br>WhatsApp group: ' + (row && row.whatsapp_url ? '<a href="' + E(row.whatsapp_url) + '" target="_blank" rel="noopener" style="color:' + GREEN + ';font-weight:600">open</a>' : '<span style="color:' + FLAG + '">no link yet</span>') + '</div>'
      + '<div class="w191line" style="margin-top:10px">' + (tl ? '<a class="w191btn ghost" target="_blank" rel="noopener" href="https://hub.welfareavenue.com/c/' + E(tl.confirm_token) + '?test=1&it=1">The team leader’s itinerary</a>' : '') + (staff() ? '<button class="w191btn ghost" data-w191go="hist182">Sent and scheduled</button>' : '') + '</div></div></div></div>';
  }
  function wrapLine(ev) {
    return '<div class="w191line">' + (staff() ? '<button class="w191btn ghost" data-w191go="brecap">Recap in Slack</button>' : '')
      + (staff() && ev.status !== 'completed' && ev.status !== 'cancelled' ? '<button class="w191btn ghost" data-w191go="close">Close this serving</button>' : '')
      + (ev.status === 'completed' ? '<span class="pill ok">Closed' + '</span>' + (staff() ? '<button class="w191btn ghost" data-w191go="reopen">Reopen</button>' : '') : '') + '</div>';
  }

  /* the steps: moved out of the phase checklist into their stage, flat, grouped by the parent they sit under */
  function placeSteps(M) {
    var r = root(); if (!r) return;
    var TM = tmap();
    var kicker = function (t) { var p = t.parent_id ? TM[t.parent_id] : null; return p ? p.name : (t.section || ''); };
    STAGES.forEach(function (s) {
      var box = stepsBox(s.k); if (!box) return;
      var rows = M.steps.filter(function (x) { return x.stage === s.k; }).sort(function (a, b) { return (a.t.sort || 0) - (b.t.sort || 0); });
      var lastGrp = null, any = false;
      rows.forEach(function (x) {
        var el = r.querySelector('.vl-step[data-vlstep="' + x.s.id + '"]'); if (!el) return;
        if (x.parent) { el.setAttribute('data-w191parent', '1'); }
        else {
          var grp = kicker(x.t);
          if (grp !== lastGrp) { var g = document.createElement('div'); g.className = 'w191grp'; g.textContent = grp; box.appendChild(g); lastGrp = grp; }
          any = true;
        }
        var tail = []; var n = el.nextElementSibling; while (n && !n.classList.contains('vl-step') && !n.classList.contains('vl-sec') && !n.classList.contains('w191grp')) { tail.push(n); n = n.nextElementSibling; }
        box.appendChild(el); tail.forEach(function (t) { box.appendChild(t); });
        decorateStep(el, x);
      });
      if (!any) { var e = document.createElement('div'); e.className = 'w191empty'; e.textContent = s.k === 'day_of' ? 'No steps here beyond the day itself.' : 'No steps in this stage.'; box.appendChild(e); }
      foldDone(s.k);
    });
  }
  function compactLine(el) {
    var meta = el.querySelector('.vl-meta'); if (!meta) return;
    var own = ''; var sel = meta.querySelector('select[data-vlowner], select.w28sel[data-w28own]'); var inp = meta.querySelector('input[data-vlowner]');
    if (sel) { var o = sel.options[sel.selectedIndex]; own = o && sel.value ? o.textContent.trim() : ''; } else if (inp) own = inp.value.trim();
    var due = (meta.querySelector('input[data-vldue]') || {}).value || '';
    var role = meta.querySelector('.w59role'); var roleT = role ? role.textContent.trim() : '';
    var over = due && due < todayIso() && !el.classList.contains('done');
    var txt = [own ? E(own) : '<em>no owner</em>', due ? (over ? '<em>due ' + E(fmtDue(due)) + '</em>' : 'due ' + E(fmtDue(due))) : '', roleT ? E(roleT) : ''].filter(Boolean).join(' \u00b7 ');
    var cm = el.querySelector('.w191cm'); if (!cm) { cm = document.createElement('button'); cm.className = 'w191cm'; cm.type = 'button'; cm.title = 'Owner and due date'; var t = el.querySelector('.vl-t'); (t || el).insertBefore(cm, meta); }
    cm.innerHTML = txt + ' <span class="w191cmx">' + (el.classList.contains('w191x') ? 'Done editing' : 'Edit') + '</span>';
  }
  /* done steps fold away under the stage's list */
  function foldDone(k) {
    var box = stepsBox(k); if (!box) return;
    var rows = Array.prototype.slice.call(box.querySelectorAll(':scope > .vl-step.done:not([data-w191parent])'));
    if (!rows.length) return;
    var d = box.querySelector(':scope > details.w191donebox');
    if (!d) { d = document.createElement('details'); d.className = 'w191donebox'; d.innerHTML = '<summary></summary><div class="w191donein"></div>'; box.appendChild(d); }
    var inner = d.querySelector('.w191donein');
    rows.forEach(function (el) { var tail = []; var n = el.nextElementSibling; while (n && n.classList.contains('wa24-sx')) { tail.push(n); n = n.nextElementSibling; } inner.appendChild(el); tail.forEach(function (t) { inner.appendChild(t); }); });
    /* a kicker left with nothing under it goes too */
    Array.prototype.slice.call(box.querySelectorAll(':scope > .w191grp')).forEach(function (g) { var n = g.nextElementSibling; if (!n || n.classList.contains('w191grp') || n.classList.contains('w191donebox')) g.remove(); });
    var all = inner.querySelectorAll('.vl-step').length; d.querySelector('summary').textContent = all + ' done';
    box.appendChild(d);
  }
  function decorateStep(el, x) {
    el.setAttribute('data-w191stage', x.stage);
    var name = el.querySelector('.vl-name'); if (!name) return;
    compactLine(el);
    if (x.hub && !name.querySelector('.w191hub')) {
      el.setAttribute('data-w191hub', '1');
      var b = document.createElement('span'); b.className = 'w191hub'; b.textContent = 'Hub'; b.title = x.t.hub_note || 'The Hub ticks this step by itself.'; name.appendChild(b);
    }
    var note = el.querySelector('.w191hubnote');
    var txt = x.hub ? (x.s.done ? (x.s.done_source === 'hub' || x.s.done_by === 'the Hub' ? 'Ticked by the Hub' : 'Ticked by ' + (x.s.done_by || 'the team')) + (x.t.hub_note ? ' · ' + x.t.hub_note.replace(/^Ticks itself when /i, 'when ').replace(/\.$/, '') : '') : (x.t.hub_note || '')) : '';
    if (txt && !note) { note = document.createElement('span'); note.className = 'w191hubnote'; name.appendChild(note); }
    if (note) note.textContent = txt;
  }

  function layout() {
    var sec = document.getElementById('volunteering'); if (!sec) return;
    if (typeof WA_VOL_VIEW === 'undefined' || WA_VOL_VIEW !== 'event') return;
    var r = document.getElementById('w119'); if (!r || r.classList.contains('w191')) return;
    var ev = curEv(), D = curD(); if (!ev || !D) return;
    var right = r.querySelector('#w119right'); var check = r.querySelector('#w119check'); if (!right || !check) return;
    var row = S.ev && S.ev.id === ev.id ? S.ev : null;
    var M = model(ev, D);
    r.classList.add('w191');
    var head = document.createElement('div'); head.id = 'w191head'; head.innerHTML = headHtml(ev, D, M, row);
    var next = document.createElement('div'); next.id = 'w191next'; next.innerHTML = nextHtml(ev, D, M, row);
    var stages = document.createElement('div'); stages.id = 'w191stages';
    var openK = M.cur === 'done' || M.cur === 'cancelled' ? 'wrap_up' : M.cur;
    STAGES.forEach(function (s, i) {
      var g = M.stages[s.k]; var open = S.showAll || S.open[s.k] != null ? (S.showAll || S.open[s.k]) : s.k === openK;
      var d = document.createElement('section'); d.className = 'w191stage ' + g.state + (open ? ' open' : ''); d.setAttribute('data-stage', s.k);
      d.innerHTML = '<div class="h" data-w191toggle="' + s.k + '">' + stageHeadHtml(s, i, g, ev, D, row) + '</div><div class="b"><div class="w191own"></div><div class="w191steps"></div></div>';
      stages.appendChild(d);
    });
    var extra = document.createElement('div'); extra.id = 'w191extra';
    /* The team is open on a computer and folded on a phone (its header carries the counts), unless someone chose */
    var teamOpen = S.teamOpen != null ? S.teamOpen : !(window.matchMedia && window.matchMedia('(max-width: 700px)').matches);
    var team = document.createElement('section'); team.id = 'w191team'; team.className = 'w191stage' + (teamOpen ? ' open' : '');
    team.innerHTML = '<div class="h" data-w191team="1">' + teamHeadHtml(D) + '</div><div class="b"><div class="w191own">' + recruitLine(D) + '</div></div>';
    var grid = r.querySelector('.grid');
    r.insertBefore(head, grid); r.insertBefore(next, grid); r.insertBefore(team, grid); r.insertBefore(stages, grid); r.insertBefore(extra, grid);
    /* the stage's own line, then the cards the earlier waves paint */
    var own = function (k) { return stages.querySelector('.w191stage[data-stage="' + k + '"] .w191own'); };
    own('plan').innerHTML = planLine(ev, D, row); own('recruit').innerHTML = recruitStageLine(D); own('day_of').innerHTML = dayCard(ev, D, row); own('wrap_up').innerHTML = wrapLine(ev);
    var dateCtl = r.querySelector('.top > span'); if (dateCtl) { var dw = document.createElement('div'); dw.className = 'w191line w191date'; dw.appendChild(dateCtl); own('plan').appendChild(dw); }
    var rosterCard = right.querySelector(':scope > .cardy'); if (rosterCard) { rosterCard.classList.add('w191roster'); team.querySelector(':scope > .b').appendChild(rosterCard); }
    partners(); setTimeout(scrollHints, 60);
    adoptRail();
    placeSteps(M);
    S.laid = ev.id;
    paintRun(); paintInv(); paintPartner();
    autotick(ev).then(function (changed) { if (changed) refresh(true); });
  }
  /* cards the earlier waves put in wave119's rail land in their stage; anything new arriving later follows (the observer) */
  function adoptRail() {
    var r = root(); if (!r) return; var rail = r.querySelector('#w119rail'); if (!rail) return;
    var put = function (el, k) { var b = stageBody(k); if (!b || !el || el.parentNode === b) return; b.insertBefore(el, stepsBox(k)); };
    Array.prototype.slice.call(rail.children).forEach(function (el) {
      if (el.classList.contains('w31sum')) return put(el, 'plan');
      if (el.id === 'w171card') return put(el, 'confirm');
      if (el.id === 'w174card') return put(el, 'prepare');
      if (el.id === 'w174survey') return put(el, 'wrap_up');
      if (el.id === 'w145fb' || el.id === 'w145au') return put(el, 'wrap_up');   /* the volunteers' feedback form and the lead's audit (wave145) */
      var h4 = el.querySelector(':scope > h4'); if (h4 && /From the meetings/i.test(h4.textContent)) { var x = document.getElementById('w191extra'); if (x && el.parentNode !== x) { h4.textContent = 'Also for this serving'; x.appendChild(el); } return; }
      /* anything else a wave puts in the rail stays visible below the stages (the old roster list and hero are hidden on purpose) */
      if (el.classList.contains('w119hide') || el.classList.contains('w191hide')) return;
      var xx = document.getElementById('w191extra'); if (xx && el.parentNode !== xx) xx.appendChild(el);
    });
    /* the survey card is born next to the itinerary card: move it on */
    var sv = r.querySelector('.w191stage[data-stage="prepare"] #w174survey'); if (sv) put(sv, 'wrap_up');
  }
  /* repaint the header, Next up and the stage lines from the data as it changes; the cards repaint themselves */
  function refresh(steps) {
    var r = root(); var ev = curEv(), D = curD(); if (!r || !ev || !D) return;
    var row = S.ev && S.ev.id === ev.id ? S.ev : null; var M = model(ev, D);
    var head = r.querySelector('#w191head'); if (head) { var openMenu = !!head.querySelector('.more.open'); head.innerHTML = headHtml(ev, D, M, row); if (openMenu) head.querySelector('.more').classList.add('open'); }
    var next = r.querySelector('#w191next'); if (next) next.innerHTML = nextHtml(ev, D, M, row);
    STAGES.forEach(function (s, i) {
      var g = M.stages[s.k]; var sec = r.querySelector('.w191stage[data-stage="' + s.k + '"]'); if (!sec) return;
      sec.className = 'w191stage ' + g.state + (sec.classList.contains('open') ? ' open' : '');
      var h = sec.querySelector(':scope > .h'); if (h) h.innerHTML = stageHeadHtml(s, i, g, ev, D, row);
    });
    var own = function (k) { return r.querySelector('.w191stage[data-stage="' + k + '"] .w191own'); };
    var pl = own('plan'); if (pl) { var keep = pl.querySelector('.w191date'); pl.innerHTML = planLine(ev, D, row); if (keep) pl.appendChild(keep); }
    var rc = own('recruit'); if (rc) rc.innerHTML = recruitStageLine(D);
    var tm = r.querySelector('#w191team'); if (tm) { var th = tm.querySelector(':scope > .h'); if (th) th.innerHTML = teamHeadHtml(D); var tl = tm.querySelector(':scope > .b > .w191own'); if (tl) tl.innerHTML = recruitLine(D); }
    partners(); scrollHints();
    var dc = own('day_of'); if (dc) dc.innerHTML = dayCard(ev, D, row);
    var wl = own('wrap_up'); if (wl) wl.innerHTML = wrapLine(ev);
    paintRun(); paintInv(); paintPartner();
    if (steps) { /* the steps were reloaded: tick the boxes and the notes in place */
      M.steps.forEach(function (x) { var el = r.querySelector('.vl-step[data-vlstep="' + x.s.id + '"]'); if (!el) return; el.classList.toggle('done', !!x.s.done); var cb = el.querySelector('input[data-vlchk]'); if (cb) cb.checked = !!x.s.done; decorateStep(el, x); });
      STAGES.forEach(function (s) { foldDone(s.k); });
    }
  }
  async function setStatus(ev, status) {
    if (!staff()) return;
    var old = ev.status;
    var r = await db.rpc('wa191_settle', { p_event: ev.id, p_status: status });
    if (r && r.error) { T('Could not save: ' + r.error.message); return; }
    ev.status = status; try { WA_VOL_LOADED = false; } catch (e) { /* fine */ }
    T(status === 'completed' ? 'This serving is closed' : 'This serving is open again');
    refresh();
  }
  function go(what, btn) {
    var ev = curEv(); if (!ev) return;
    if (what === 'menu') { var m = btn.closest('.more'); if (m) m.classList.toggle('open'); return; }
    document.querySelectorAll('#w191head .more.open').forEach(function (m) { m.classList.remove('open'); });
    if (what === 'back') { location.hash = '#volunteering'; return; }
    if (what.indexOf('stage:') === 0) { openStage(what.slice(6), true); return; }
    if (what === 'fmt') { if (!clickProxy('#w119 [data-w171fmt]')) T('Set the format from the serving’s header once the texts card has loaded.'); return; }
    if (what === 'find') { openRecruit({ tab: 'people', reset: true }); return; }
    if (what === 'conv') { openRecruit({ tab: 'conv' }); return; }
    if (what === 'bplan') { openStage('recruit'); if (!clickProxy('#w119 [data-w119bplan]')) T('Plan the roster is loading'); return; }
    if (what === 'brecap') { if (!clickProxy('#w119 [data-w119brecap]')) T('The recap is loading'); return; }
    if (what === 'text171') { openStage('confirm'); if (!clickProxy('#w171card [data-w171send]')) T('The Texts card is loading'); return; }
    if (what === 'send182') { openStage('prepare'); if (!clickProxy('#w119 [data-w182send]')) T('The itinerary card is loading'); return; }
    if (what === 'hist182') { if (!clickProxy('#w119 [data-w182hist]')) T('The itinerary card is loading'); return; }
    if (what === 'ev182') { openStage('prepare'); if (!clickProxy('#w119 [data-w182ev]')) T('The itinerary card is loading'); return; }
    if (what === 'date') { openStage('plan', true); var inp = document.querySelector('#w119 .w191date input'); if (inp) { try { inp.focus(); inp.showPicker && inp.showPicker(); } catch (e) { /* fine */ } } return; }
    if (what === 'cancel') { if (!clickProxy('#w106can')) T('The cancel control is loading'); return; }
    if (what === 'start') { openStage('prepare', true); setTimeout(function () { var st = document.getElementById('w174st'); if (st) { try { st.focus(); } catch (e) { /* fine */ } } }, 350); return; }
    if (what === 'inventory') { location.hash = '#volunteering/inventory'; return; }
    if (what === 'partner') { partnerEditor(); return; }
    if (what === 'team') { var tm = document.getElementById('w191team'); if (tm) { tm.classList.add('open'); S.teamOpen = true; setTimeout(scrollHints, 60); try { tm.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { tm.scrollIntoView(); } } return; }
    if (what === 'close') { if (confirm('Close this serving? It moves to Done; you can reopen it.')) setStatus(ev, 'completed'); return; }
    if (what === 'reopen') { setStatus(ev, 'planned'); return; }
  }

  /* ---------- wiring ---------- */
  if (typeof waVolRenderEvent === 'function') {
    var __ev191 = waVolRenderEvent;
    waVolRenderEvent = function () { var out = __ev191.apply(this, arguments); var ev = curEv(); loadGuides(); if (ev) loadEvRow(ev, false).then(function () { schedule(); }); schedule(); return out; };
  }
  function schedule() { if (S.pend) return; S.pend = setTimeout(function () { S.pend = null; try { layout(); adoptRail(); } catch (e) { /* fine */ } }, 320); }
  try {
    new MutationObserver(function (muts) {
      var r = document.getElementById('w119'); if (!r) return;
      if (!r.classList.contains('w191')) { schedule(); return; }
      var touch = false;
      for (var i = 0; i < muts.length; i++) { var t = muts[i].target; if (t && t.closest && (t.closest('#w119rail') || t.closest('#w119 .board') || t.closest('#w171card') || t.closest('#w174card') || t.closest('.w31sum'))) { touch = true; break; } }
      if (!touch) return;
      if (S.pend2) return; S.pend2 = setTimeout(function () { S.pend2 = null; try { adoptRail(); refresh(); } catch (e) { /* fine */ } }, 260);
    }).observe(document.body, { childList: true, subtree: true });
  } catch (e) { /* fine */ }
  document.addEventListener('click', async function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var g = t.closest('[data-w191go]'); if (g && g.closest('#volunteering')) { e.preventDefault(); e.stopPropagation(); go(g.getAttribute('data-w191go'), g); return; }
    /* the format editor (wave171) saves into the event: the flow header follows */
    if (t.closest('[data-w171fsave]')) { var ev0 = curEv(), f0 = ev0 ? ev0.format : null, n0 = 0; var iv = setInterval(function () { var e1 = curEv(); n0++; if ((e1 && e1.format !== f0) || n0 > 20) { clearInterval(iv); if (root()) refresh(false); } }, 150); }
    var st = t.closest('.w191bar [data-w191stage]'); if (st) { e.preventDefault(); e.stopPropagation(); openStage(st.getAttribute('data-w191stage'), true); return; }
    var tt = t.closest('[data-w191team]'); if (tt) { var ts = tt.closest('#w191team'); if (ts) { var on2 = !ts.classList.contains('open'); ts.classList.toggle('open', on2); S.teamOpen = on2; if (on2) setTimeout(scrollHints, 60); } return; }
    var tg = t.closest('[data-w191toggle]'); if (tg) { var sec = tg.closest('.w191stage'); if (sec) { var k = sec.getAttribute('data-stage'); var on = !sec.classList.contains('open'); sec.classList.toggle('open', on); S.open[k] = on; } return; }
    var tk = t.closest('#w191next [data-w191tick]'); if (tk) { e.preventDefault(); e.stopPropagation(); var sid = tk.getAttribute('data-w191tick'); var box = document.querySelector('#w119 input[data-vlchk="' + sid + '"]'); if (box) { box.click(); } else if (typeof waVolToggleStep === 'function') { await waVolToggleStep(sid, true, null); } setTimeout(function () { refresh(true); }, 500); return; }
    if (!t.closest('#w191head .more')) document.querySelectorAll('#w191head .more.open').forEach(function (m) { m.classList.remove('open'); });
  }, true);
  document.addEventListener('change', function (e) { var t = e.target; if (!t || !t.getAttribute) return; if (t.getAttribute('data-vlchk') && root()) setTimeout(function () { refresh(false); }, 450); if (t.getAttribute('data-vlrstat') && root()) setTimeout(function () { refresh(false); }, 400); var row = t.closest && t.closest('.w191steps .vl-step'); if (row) setTimeout(function () { compactLine(row); }, 50); });
  document.addEventListener('click', function (e) { var t = e.target; if (!t || !t.closest) return; var cm = t.closest('.w191steps .w191cm'); if (cm) { e.preventDefault(); e.stopPropagation(); var row = cm.closest('.vl-step'); row.classList.toggle('w191x'); var sx = row.nextElementSibling; while (sx && sx.classList.contains('wa24-sx')) { sx.classList.toggle('w191sx', row.classList.contains('w191x')); sx = sx.nextElementSibling; } compactLine(row); } }, true);
