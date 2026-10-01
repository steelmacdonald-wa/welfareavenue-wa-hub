  /* ---------- the Calendar opens on This week ---------- */
  async function loadWeek(force) {
    if (!staff()) return null;
    if (!force && S.week && Date.now() - S.weekAt < 60000) return S.week;
    try {
      var res = await Promise.all([db.rpc('wa191_this_week', { p_days: 30 }), db.rpc('wa191_this_week_unclosed'), db.rpc('wa191_recruit_inbox', { p_events: null, p_days: 14 })]);
      var r = res[0]; if (r && !r.error && r.data) { S.week = r.data; S.weekAt = Date.now(); S.week.unclosed = (res[1] && !res[1].error && Array.isArray(res[1].data)) ? res[1].data : [];
        S.week.waiting = (res[2] && !res[2].error && Array.isArray(res[2].data)) ? res[2].data.filter(function (c) { return c.wait; }).length : 0; }
    } catch (e) { /* fine */ }
    return S.week;
  }
  function svHtml(sv) {
    var stg = sv.stage; var days = sv.days;
    var cd = sv.status === 'completed' ? 'Done' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days > 1 ? days + ' days to go' : days === -1 ? 'Yesterday' : Math.abs(days) + ' days ago';
    var fmt = sv.format ? FORMATS[sv.format] || sv.format : null;
    var rosterP = sv.target ? Math.min(100, Math.round(sv.confirmed / sv.target * 100)) : 0;
    var stepsP = sv.steps_total ? Math.round(sv.steps_done / sv.steps_total * 100) : 0;
    var nx = sv.next;
    return '<div class="sv" data-vlev="' + sv.id + '" role="link" tabindex="0">'
      + '<div class="d"><b>' + E(fmtDay(sv.date)) + '</b><span>' + E(cd) + '</span></div>'
      + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="stg ' + E(stg) + '"><i></i>' + E(stageLabel(stg) || stg) + '</span><span style="font-size:11.5px;color:' + (fmt ? MUTED : FLAG) + '">' + E(fmt || 'Format not set') + (sv.code ? ' · ' + E(sv.code) : '') + '</span></div>'
      + '<div class="bars"><div><b>' + sv.confirmed + '</b> confirmed of ' + sv.on_list + ' on the list' + (sv.target ? ' <span style="opacity:.8">(need ' + sv.target + ')</span>' : '') + '<i style="--p:' + rosterP + '%"></i></div>'
      + '<div><b>' + sv.steps_done + '</b> of ' + sv.steps_total + ' steps' + (sv.overdue ? ' · <em style="font-style:normal;color:' + FLAG + '">' + sv.overdue + ' overdue</em>' : '') + '<i style="--p:' + stepsP + '%"></i></div></div>'
      + (nx ? '<div class="nx"><span>Next for a person:</span> ' + E(nx.name) + ' <span>· ' + (nx.owner ? E(nx.owner) : '<em>no owner</em>') + (nx.due ? ' · ' + (nx.due < todayIso() ? '<em>due ' + E(fmtDue(nx.due)) + '</em>' : 'due ' + E(fmtDue(nx.due))) : '') + '</span></div>' : (sv.status === 'completed' ? '<div class="nx"><span>Every step done.</span></div>' : ''))
      + '</div>';
  }
  function listHtml(title, rows, kind, sub) {
    var body = rows.length ? rows.slice(0, 8).map(function (x) {
      return '<div class="it" data-w191step="' + E(x.step_id) + '" data-w191ev="' + E(x.event_id) + '"><div>' + E(x.name) + '<small>' + E(fmtDay(x.date)) + (x.owner ? ' · ' + E(x.owner) : kind === 'unassigned' ? ' · <span style="color:' + FLAG + '">no owner</span>' : '') + '</small></div><span>' + (x.due ? (x.due < todayIso() ? '<em>due ' + E(fmtDue(x.due)) + '</em>' : 'due ' + E(fmtDue(x.due))) : '') + '</span></div>';
    }).join('') + (rows.length > 8 ? '<div class="it" style="color:' + MUTED + '">and ' + (rows.length - 8) + ' more</div>' : '') : '<div class="none">' + E(sub) + '</div>';
    return '<div class="ls"><h5>' + E(title) + '<span>' + (rows.length ? rows.length : '') + '</span></h5>' + body + '</div>';
  }
  function weekHtml(w) {
    var sv = (w.servings || []).filter(function (x) { return x.status !== 'cancelled'; });
    return '<div class="lbl"><span style="color:' + GOLD + ';letter-spacing:1.6px;text-transform:uppercase;font-weight:700;font-size:11px">This week</span><span>' + (w.me ? 'Hi ' + E(String(w.me).split(' ')[0]) + ' · ' : '') + E(fmtDay(w.today, true)) + ' <button class="w191btn ghost" style="padding:5px 10px;font-size:11px;margin-left:6px" data-w191week="refresh">Refresh</button></span></div>'
      + (w.waiting && staff() ? '<button class="w191wait" data-w191convopen="1"><i></i><b>' + w.waiting + ' text' + (w.waiting === 1 ? '' : 's') + ' from volunteers wait' + (w.waiting === 1 ? 's' : '') + ' for an answer</b><span>Open the conversations \u203a</span></button>' : '')
      + (sv.length ? '<div class="srv">' + sv.slice(0, 4).map(svHtml).join('') + '</div>' : '<div class="w191empty">No serving in the next 30 days. Add one from the calendar.</div>')
      + ((w.unclosed || []).length ? '<div class="ls" style="margin-top:10px;border-color:rgba(220,165,39,.5);background:#FFF8E8"><h5>Did it happen?<span>The Hub could not tell from the roster or the survey</span></h5>' + w.unclosed.map(function (u) { return '<div class="it" style="cursor:default;grid-template-columns:minmax(0,1fr) auto"><div>' + E(fmtDay(u.date, true)) + (u.title ? ' \u00b7 ' + E(u.title) : '') + '<small>' + E(u.code || '') + '</small></div><span style="display:flex;gap:6px">' + (staff() ? '<button class="w191btn gold" style="padding:6px 11px;font-size:11.5px" data-w191settle="completed" data-ev="' + E(u.id) + '">It happened</button><button class="w191btn ghost" style="padding:6px 11px;font-size:11.5px" data-w191settle="cancelled" data-ev="' + E(u.id) + '">Cancelled</button>' : '') + '</span></div>'; }).join('') + '</div>' : '')
      + '<div class="lists">' + listHtml('Overdue', w.overdue || [], 'overdue', 'Nothing overdue.') + listHtml('No owner yet', w.unassigned || [], 'unassigned', 'Every step due soon has an owner.') + listHtml('Mine this week', w.mine || [], 'mine', w.me ? 'Nothing of yours due this week.' : 'Your name is not on the team list yet.') + '</div>';
  }
  async function paintWeek() {
    var sec = document.getElementById('volunteering'); if (!sec || !staff()) return;
    if (typeof WA_VOL_VIEW === 'undefined' || WA_VOL_VIEW !== 'calendar') return;
    var card = sec.querySelector('.card'); if (!card) return;
    var w = await loadWeek(false); if (!w) return;
    if (WA_VOL_VIEW !== 'calendar') return;
    card = sec.querySelector('.card'); if (!card) return;
    var box = document.getElementById('w191week');
    if (!box) {
      box = document.createElement('div'); box.id = 'w191week';
      var anchor = card.querySelector('.vl-hero') || card.querySelector('#w106add') || card.querySelector('#w119cal') || card.querySelector('.vl-month') || card.querySelector('.vl-empty');
      if (anchor) anchor.parentElement.insertBefore(box, anchor); else card.appendChild(box);
    }
    var html = weekHtml(w); if (box.__h !== html) { box.innerHTML = html; box.__h = html; }
    var hero = card.querySelector('.vl-hero'); if (hero) hero.classList.add('w191hide');
    var add = card.querySelector('#w106add'); if (add && box.nextElementSibling !== add) { box.insertAdjacentElement('afterend', add); add.style.margin = '0 0 10px'; }
  }
  if (typeof waVolRenderCalendar === 'function') {
    var __cal191 = waVolRenderCalendar;
    waVolRenderCalendar = function () { var out = __cal191.apply(this, arguments); setTimeout(paintWeek, 60); setTimeout(paintWeek, 400); return out; };
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var rf = t.closest('#w191week [data-w191week="refresh"]'); if (rf) { e.preventDefault(); e.stopPropagation(); rf.disabled = true; loadWeek(true).then(function () { rf.disabled = false; paintWeek(); }); return; }
    var se = t.closest('#w191week [data-w191settle]'); if (se) { e.preventDefault(); e.stopPropagation(); se.disabled = true; db.rpc('wa191_settle', { p_event: Number(se.getAttribute('data-ev')), p_status: se.getAttribute('data-w191settle') }).then(function (r) { if (r && r.error) { T('Could not save: ' + r.error.message); se.disabled = false; return; } T(se.getAttribute('data-w191settle') === 'completed' ? 'Marked as done' : 'Marked as cancelled'); try { WA_VOL_LOADED = false; } catch (x) { /* fine */ } loadWeek(true).then(paintWeek); }); return; }
    var cw = t.closest('#w191week [data-w191convopen]'); if (cw) { e.preventDefault(); e.stopPropagation(); openRecruit({ tab: 'conv' }); return; }
    var it = t.closest('#w191week [data-w191step]'); if (it) { e.preventDefault(); e.stopPropagation(); S.focusStep = Number(it.getAttribute('data-w191step')); location.hash = '#volunteering/e/' + it.getAttribute('data-w191ev'); return; }
  }, true);
  /* a step picked on This week: its stage opens and the row is brought into view */
  function focusStep() {
    var r = root(); if (!r || !S.focusStep) return;
    var el = r.querySelector('.vl-step[data-vlstep="' + S.focusStep + '"]'); S.focusStep = null; if (!el) return;
    var k = el.getAttribute('data-w191stage'); if (k) openStage(k, false);
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
    el.style.transition = 'background .6s'; el.style.background = 'rgba(220,165,39,.25)'; setTimeout(function () { el.style.background = ''; }, 1800);
  }
