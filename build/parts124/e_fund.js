
  /* ---------- the fundraising events calendar (#fundevents) ---------- */
  var PLAN_START = mk(2026, 9, 1, 12), PLAN_END = mk(2027, 9, 1, 12);
  function fundHost() {
    var sec = document.getElementById('fundevents'); if (!sec) return null;
    mast('fundevents', tabOk('fundraising') ? 'Fundraising' : 'Home', 'Events calendar', 'The year’s fundraising events, season by season: partners, targets, and where each one stands.');
    var h = document.getElementById('w124fund');
    if (!h) { h = document.createElement('div'); h.id = 'w124fund'; sec.appendChild(h); }
    return h;
  }
  function stTag(s) { var x = STATUS[s] || STATUS.planned; return '<span class="st" style="background:' + x[1] + ';color:' + x[2] + '">' + E(x[0]) + '</span>'; }
  function targetText(f) {
    if (f.target_min && f.target_max) return 'Target ' + kMoney(f.target_min) + ' to ' + kMoney(f.target_max);
    if (f.target_min) return 'Target about ' + kMoney(f.target_min);
    return '';
  }
  function pastDue(f) { var e = parseDay(f.end_date) || parseDay(f.start_date); return !!e && e < today() && (f.status === 'planned' || f.status === 'confirmed'); }
  function feCard(f) {
    var proj = f.project_id ? C.projects.filter(function (p) { return String(p.id) === String(f.project_id); })[0] : null;
    var tg = targetText(f);
    return '<div class="w124fe" data-w124fund="' + f.id + '" tabindex="0" role="button"><div class="hd">' + stTag(f.status) + '<span class="sp"></span><span class="when">' + I('clock') + E(fundWhen(f)) + '</span></div>'
      + '<h4>' + E(f.title) + '</h4>'
      + (f.partners ? '<div class="pt"><b>Partners:</b> ' + E(f.partners) + '</div>' : '')
      + (tg || f.raised != null ? '<div class="tg">' + (tg ? '<span>' + E(tg) + '</span>' : '') + (f.raised != null ? '<span class="raised">' + (tg ? '· ' : '') + 'raised ' + E(money(f.raised)) + '</span>' : '') + '</div>' : '')
      + (f.result_note ? '<div class="nt"><b>Result:</b> ' + E(f.result_note) + '</div>' : (f.notes ? '<div class="nt">' + E(f.notes) + '</div>' : ''))
      + (pastDue(f) ? '<div class="warn">The date has passed: record how it went.</div>' : '')
      + '<div class="ft">' + (proj ? '<a class="w124lnk" data-w124go="#project/' + proj.id + '">' + I('board') + ' Project board</a>' : '') + (f.sop_training_id ? '<a class="w124lnk" data-w124go="#training/t/' + f.sop_training_id + '">' + I('doc') + ' SOP</a>' : '') + '</div></div>';
  }
  function goalsHtml() {
    var g = C.goals || {}, target = Number(g.target || 20000), min = Number(g.minimum || 10000), healthy = Number(g.healthy || 15000);
    var inPlan = function (f) { var s = parseDay(f.start_date); return s && s >= PLAN_START && s < PLAN_END; };
    var raised = C.fund.filter(inPlan).reduce(function (a, f) { return a + Number(f.raised || 0); }, 0);
    var kick = C.fund.filter(function (f) { return f.season === 'summer-2026'; }).reduce(function (a, f) { return a + Number(f.raised || 0); }, 0);
    var planned = C.fund.filter(function (f) { return inPlan(f) && f.status !== 'cancelled' && f.status !== 'idea'; });
    var lo = planned.reduce(function (a, f) { return a + Number(f.target_min || 0); }, 0), hi = planned.reduce(function (a, f) { return a + Number(f.target_max || f.target_min || 0); }, 0);
    var pct = function (v) { return Math.max(0, Math.min(100, v / target * 100)); };
    var notes = (g.notes || []).map(function (n) { return '<li>' + E(n) + '</li>'; }).join('');
    return '<div class="w124card"><div class="w124goals"><div><h3 style="margin-bottom:6px">Fiscal 2026-27, from October 1</h3>'
      + '<div class="big">' + E(money(raised)) + '<small>raised of the ' + E(money(target)) + ' target</small></div>'
      + '<div class="w124meter" title="Raised by the events this fiscal year"><div class="fill" style="width:' + pct(raised).toFixed(1) + '%"></div>'
      + '<div class="tick" style="left:' + pct(min) + '%"><span>' + E(kMoney(min)) + '<em> minimum</em></span></div><div class="tick" style="left:' + pct(healthy) + '%"><span>' + E(kMoney(healthy)) + '<em> healthy</em></span></div><div class="tick" style="left:calc(100% - 2px)"><span style="left:auto;right:0;transform:none">' + E(kMoney(target)) + '+<em> target</em></span></div></div>'
      + '<p class="w124empty">' + (lo ? 'The events with a target this year aim at ' + E(kMoney(lo)) + (hi > lo ? ' to ' + E(kMoney(hi)) : '') + '. ' : '') + (kick ? 'The summer 2026 kickoff raised ' + E(money(kick)) + ' (fiscal 2025-26).' : '') + '</p></div>'
      + '<div><ul class="w124gnotes">' + notes + '</ul></div></div></div>';
  }
  function stripHtml() {
    var months = []; for (var i = 0; i < 14; i++) months.push(mk(2026, 7 + i, 1, 12));
    var t = today();
    var head = months.map(function (m, i) { return '<div class="m' + (m.getMonth() === 9 ? ' fy' : '') + (m.getMonth() === t.getMonth() && m.getFullYear() === t.getFullYear() ? ' now' : '') + '" title="' + E(MONTHS[m.getMonth()] + ' ' + m.getFullYear()) + '">' + E(MONTHS[m.getMonth()].slice(0, 3)) + (m.getMonth() === 0 || i === 0 ? ' ’' + String(m.getFullYear()).slice(2) : '') + '</div>'; }).join('');
    var idx = function (d) { return (d.getFullYear() - 2026) * 12 + d.getMonth() - 7; };
    var evs = C.fund.filter(function (f) { return f.start_date && f.precision !== 'none' && f.precision !== 'flexible' && f.status !== 'cancelled'; }).map(function (f) {
      var s = parseDay(f.start_date), e = parseDay(f.end_date) || s; return { f: f, a: Math.max(0, idx(s)), b: Math.min(13, idx(e)) };
    }).filter(function (x) { return x.b >= 0 && x.a <= 13; }).sort(function (x, y) { return x.a - y.a || (y.b - y.a) - (x.b - x.a); });
    var lanes = [];
    evs.forEach(function (x) { for (var l = 0; l < lanes.length; l++) { if (lanes[l].every(function (o) { return o.b < x.a || o.a > x.b; })) { lanes[l].push(x); return; } } lanes.push([x]); });
    var body = lanes.map(function (ln) { return '<div class="w124lane">' + ln.map(function (x) { return '<a data-w124fund="' + x.f.id + '" class="' + (x.f.status === 'done' ? 'done' : x.f.status === 'idea' ? 'idea' : '') + '" style="grid-column:' + (x.a + 1) + ' / ' + (x.b + 2) + '" title="' + E(x.f.title + ', ' + fundWhen(x.f)) + '">' + E(x.f.title) + '</a>'; }).join('') + '</div>'; }).join('');
    return '<div class="w124card" style="margin-top:14px"><h3>The year at a glance<span class="lnk" data-w124go="#calendar">master calendar</span></h3><div class="w124sw"><div><div class="w124strip">' + head + '</div><div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">' + body + '</div></div></div></div>';
  }
  function fundPaint() {
    var h = fundHost(); if (!h) return;
    var edit = canEditFund();
    var html = goalsHtml() + stripHtml();
    SEASONS.forEach(function (s) {
      var list = C.fund.filter(function (f) { return (f.season || 'backlog') === s[0]; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      if (s[0] === 'backlog') {
        html += '<div class="w124season"><h3>' + E(s[1]) + '</h3><span>' + E(s[2]) + '</span><span class="sp"></span>' + (edit ? '<a class="w124btn ghost sm" data-w124fadd="backlog">' + I('plus') + 'Add an idea</a>' : '') + '</div>'
          + '<div class="w124ideas">' + (list.length ? list.map(function (f) { return '<a data-w124fund="' + f.id + '" title="' + E(f.notes || '') + '">' + I('spark') + E(f.title) + '</a>'; }).join('') : '<p class="w124empty">No ideas parked yet.</p>') + '</div>';
        return;
      }
      html += '<div class="w124season"><h3>' + E(s[1]) + '</h3><span>' + E(s[2]) + '</span><span class="sp"></span>' + (edit ? '<a class="w124btn ghost sm" data-w124fadd="' + s[0] + '">' + I('plus') + 'Add an event</a>' : '') + '</div>'
        + (list.length ? '<div class="w124evs">' + list.map(feCard).join('') + '</div>' : '<p class="w124empty">Nothing planned for this season yet.</p>');
    });
    var other = C.fund.filter(function (f) { return f.season && !SEASONS.some(function (s) { return s[0] === f.season; }); });
    if (other.length) html += '<div class="w124season"><h3>Other events</h3></div><div class="w124evs">' + other.map(feCard).join('') + '</div>';
    var g = C.goals || {};
    if ((g.planning || []).length) html += '<div class="w124card" style="margin-top:22px"><h3>Planning notes</h3><ul class="w124gnotes">' + g.planning.map(function (n) { return '<li>' + E(n) + '</li>'; }).join('') + '</ul>' + (g.source ? '<p class="w124empty" style="margin-top:6px">From ' + E(g.source) + '.</p>' : '') + '</div>';
    h.innerHTML = html;
  }
  async function fundShow(sub) {
    var h = fundHost(); if (!h) return;
    if (!C.loadedBase) h.innerHTML = '<div class="w124card"><p class="w124empty">Loading the events…</p></div>';
    await loadBase();
    fundPaint();
    if (sub && /^\d+$/.test(sub)) { var f = fundById(sub); if (f) openFund(f); }
  }
  function onFund() { var a = document.querySelector('.panel.active'); return !!(a && a.id === 'fundevents'); }
  function fundById(id) { return C.fund.filter(function (f) { return String(f.id) === String(id); })[0] || null; }
