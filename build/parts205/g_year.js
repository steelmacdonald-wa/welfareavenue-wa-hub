
  /* =====================================================================
     wave207 (04/10/26): the charitable activities and this year's goals, inside wave205's page.
     Steel: "Each org goal is anchored on one or more of WA's 8 registered charitable activities": chips on each goal (the
     reason on hover or tap), a column in the goals at a glance, and the 8 activities coverage strip; owners and admins
     anchor a goal on an activity, take one off and say why (strategy_activity_set, strategy_save 'activity' reason).
     "This year's goals (FY27)": per goal the FY27 target and its Q1 to Q4 checkpoints with a status (not started, on track,
     at risk, done), edited live like every other field (strategy_save 'target' and 'checkpoint'), with comments
     (strategy_checkpoint_comment_add) and history; the This year view at the top of Goals: the current quarter, what is due
     next, overdue checkpoints flagged. Projects link to a checkpoint (strategy_link_checkpoint) as well as a goal.
     The words are the plan's (wa207_activities_fy27.sql); nothing here invents a target.
     ===================================================================== */
  if (!document.getElementById('w207css')) {
    var css7 = document.createElement('style'); css7.id = 'w207css';
    css7.textContent = ''
      /* the This year view */
      + '.w207year{background:#FFFAF2;border:1px solid rgba(16,63,57,.12);border-radius:20px;padding:20px 22px 18px;margin:0 0 8px;position:relative;overflow:hidden;}'
      + '.w207year:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:' + GOLD + ';}'
      + '.w207year .hd{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;}'
      + '.w207year .lab{font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:' + PURPLE + ';}'
      + '.w207year h2{font-family:' + HEAD + ';font-size:30px;line-height:1.05;text-transform:uppercase;color:' + GREEN + ';margin:2px 0 0;}'
      + '.w207year .sub{font-size:13px;color:' + MUTED + ';margin:4px 0 0;max-width:620px;line-height:1.45;}'
      + '.w207qs{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap;}'
      + '.w207q{border:1px solid rgba(16,63,57,.15);border-radius:12px;padding:6px 10px;min-width:86px;background:#F4F2EA;}'
      + '.w207q b{display:block;font-family:' + HEAD + ';font-size:17px;font-weight:600;color:' + GREEN + ';}'
      + '.w207q small{font-size:11px;color:' + MUTED + ';}'
      + '.w207q.now{background:' + GREEN + ';border-color:' + GREEN + ';}'
      + '.w207q.now b,.w207q.now small{color:' + CREAM + ';}'
      + '.w207q.now em{display:inline-block;font-style:normal;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:' + GROUND + ';background:' + GOLD + ';border-radius:999px;padding:1px 7px;margin-left:4px;vertical-align:2px;}'
      + '.w207q.past{opacity:.6;}'
      + '.w207alerts{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0 14px;}'
      + '.w207box{border-radius:14px;padding:12px 14px;border:1px solid rgba(16,63,57,.12);background:#F4F2EA;min-width:0;}'
      + '.w207box h3{font-family:' + HEAD + ';font-size:18px;font-weight:600;text-transform:uppercase;color:' + GREEN + ';margin:0 0 2px;display:flex;align-items:center;gap:8px;}'
      + '.w207box .when{font-size:12.5px;color:' + MUTED + ';margin:0 0 8px;}'
      + '.w207box.late{background:rgba(179,64,47,.07);border-color:rgba(179,64,47,.35);}'
      + '.w207box.late h3{color:' + FLAG + ';}'
      + '.w207box.ok{background:rgba(42,140,122,.07);border-color:rgba(42,140,122,.3);}'
      + '.w207it{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-top:1px solid rgba(16,63,57,.08);font-size:13px;line-height:1.4;cursor:pointer;}'
      + '.w207it:first-of-type{border-top:0;}'
      + '.w207it:hover .tx{text-decoration:underline;text-underline-offset:3px;}'
      + '.w207it .w205num{width:22px;height:22px;font-size:12px;}'
      + '.w207it .tx{flex:1;min-width:0;}'
      + '.w207pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;white-space:nowrap;background:rgba(16,63,57,.07);color:' + GREEN + ';}'
      + '.w207pill:before{content:"";width:7px;height:7px;border-radius:50%;background:rgba(16,63,57,.35);}'
      + '.w207pill.s-onTrack{background:rgba(42,140,122,.12);color:#1d6b5d;}.w207pill.s-onTrack:before{background:' + TEAL + ';}'
      + '.w207pill.s-atRisk{background:rgba(179,64,47,.1);color:' + FLAG + ';}.w207pill.s-atRisk:before{background:' + FLAG + ';}'
      + '.w207pill.s-done{background:rgba(42,140,122,.18);color:#1d6b5d;}.w207pill.s-done:before{background:' + TEAL + ';}'
      + '.w207pill.late{background:' + FLAG + ';color:' + CREAM + ';}.w207pill.late:before{background:' + CREAM + ';}'
      + '.w207grid{border:1px solid rgba(16,63,57,.10);border-radius:14px;overflow:hidden;background:#FFFAF2;}'
      + '.w207grid table{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed;}'
      + '.w207grid th{text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:' + MUTED + ';font-weight:700;padding:10px 10px;background:rgba(16,63,57,.04);}'
      + '.w207grid th.now{color:' + GREEN + ';background:rgba(220,165,39,.22);}'
      + '.w207grid td{padding:10px 10px;border-top:1px solid rgba(16,63,57,.08);vertical-align:top;line-height:1.4;overflow-wrap:anywhere;}'
      + '.w207grid td.now{background:rgba(220,165,39,.09);}'
      + '.w207grid td.late{box-shadow:inset 3px 0 0 ' + FLAG + ';}'
      + '.w207grid tr[data-w207goto]{cursor:pointer;}'
      + '.w207grid tr[data-w207goto]:hover td{background:rgba(111,100,171,.05);}'
      + '.w207grid tr[data-w207goto]:hover td.now{background:rgba(220,165,39,.16);}'
      + '.w207grid td b{font-family:' + HEAD + ';font-size:16px;font-weight:600;color:' + GREEN + ';}'
      + '.w207grid .tg{font-weight:700;color:' + GREEN + ';}'
      + '.w207grid .w207pill{margin-bottom:4px;}'
      + '.w207year .note{font-size:12px;color:' + MUTED + ';margin:10px 0 0;line-height:1.45;}'
      /* activities: chips on a goal, the coverage strip */
      + '.w207acts{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 12px;}'
      + '.w207acts .lab{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + MUTED + ';margin-right:2px;}'
      + '.w207chip{display:inline-flex;align-items:center;gap:6px;max-width:300px;border:1px solid rgba(111,100,171,.3);background:rgba(111,100,171,.07);color:#3f3780;border-radius:999px;padding:3px 10px 3px 3px;font-size:12px;font-weight:600;cursor:pointer;font-family:' + BODY + ';}'
      + '.w207chip b{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:' + PURPLE + ';color:' + CREAM + ';font-size:11px;flex:none;}'
      + '.w207chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      + '.w207chip[aria-expanded="true"]{background:' + PURPLE + ';color:' + CREAM + ';}'
      + '.w207chip[aria-expanded="true"] b{background:' + CREAM + ';color:' + PURPLE + ';}'
      + '.w207chip:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
      + '.w207tip{flex:1 0 100%;background:#F4F2EA;border:1px solid rgba(111,100,171,.25);border-radius:12px;padding:9px 12px;font-size:13px;line-height:1.45;}'
      + '.w207tip b{color:#3f3780;}'
      + '.w207note{flex:1 0 100%;font-size:12.5px;color:' + MUTED + ';}'
      + '.w207note .w205ed{font-size:12.5px;padding:2px 4px;margin:0;color:' + MUTED + ';}'
      + '.w207mini{display:flex;gap:4px;flex-wrap:wrap;}'
      + '.w207mini i{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:rgba(111,100,171,.14);color:#3f3780;font-style:normal;font-size:11.5px;font-weight:700;}'
      + '.w207cov{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}'
      + '.w207tile{background:#FFFAF2;border:1px solid rgba(16,63,57,.10);border-radius:14px;padding:12px 12px 10px;display:flex;flex-direction:column;gap:8px;min-width:0;}'
      + '.w207tile .n{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:' + PURPLE + ';color:' + CREAM + ';font-family:' + HEAD + ';font-weight:700;font-size:15px;}'
      + '.w207tile .t{font-size:13px;font-weight:600;line-height:1.35;color:' + GROUND + ';flex:1;}'
      + '.w207tile .gs{display:flex;gap:4px;flex-wrap:wrap;align-items:center;}'
      + '.w207tile .gs button{border:0;padding:0;background:none;cursor:pointer;}'
      + '.w207tile .gs .w205num{width:24px;height:24px;font-size:13px;}'
      + '.w207tile.gap{border-color:rgba(179,64,47,.45);background:rgba(179,64,47,.05);}'
      + '.w207tile.gap .gs{color:' + FLAG + ';font-size:12px;font-weight:700;}'
      + '.w207covsum{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#1d6b5d;}'
      + '.w207covsum.gap{color:' + FLAG + ';}'
      /* a goal's year block */
      + '.w207yb{background:#F4F2EA;border:1px solid rgba(220,165,39,.45);border-radius:16px;padding:12px 14px;margin:6px 0 4px;}'
      + '.w207yb .top{display:grid;grid-template-columns:2fr 1fr;gap:12px;}'
      + '.w207yb .w205ed{background:#FFFAF2;}'
      + '.w207cps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px;}'
      + '.w207cp{background:#FFFAF2;border:1px solid rgba(16,63,57,.10);border-radius:12px;padding:8px 9px;min-width:0;display:flex;flex-direction:column;gap:6px;}'
      + '.w207cp.now{border-color:rgba(220,165,39,.8);box-shadow:inset 0 0 0 1px rgba(220,165,39,.5);}'
      + '.w207cp.late{border-color:rgba(179,64,47,.55);}'
      + '.w207cp.done .w205ed{color:#2d6a5f;}'
      + '.w207cp .qh{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}'
      + '.w207cp .qh b{font-family:' + HEAD + ';font-size:17px;font-weight:600;color:' + GREEN + ';}'
      + '.w207cp .qh em{font-style:normal;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;background:' + GOLD + ';color:' + GROUND + ';border-radius:999px;padding:1px 7px;}'
      + '.w207cp .w205ed{font-size:13px;padding:3px 4px;margin:0;}'
      + '#w205 select.w207st{appearance:auto;font-size:12px;font-weight:700;border-radius:999px;border:1px solid rgba(16,63,57,.2);padding:3px 6px;background:#FFFAF2;color:' + GREEN + ';max-width:100%;}'
      + '#w205 select.w207st.s-onTrack,#w205 select.w207st.s-done{background:rgba(42,140,122,.12);border-color:rgba(42,140,122,.4);color:#1d6b5d;}'
      + '#w205 select.w207st.s-atRisk{background:rgba(179,64,47,.1);border-color:rgba(179,64,47,.4);color:' + FLAG + ';}'
      + '.w207cp .ft{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11.5px;color:' + MUTED + ';}'
      + '.w207cp input.w207due{font-family:' + BODY + ';font-size:11.5px;border:1px solid rgba(16,63,57,.15);border-radius:8px;padding:2px 5px;background:#FFFAF2;color:' + GROUND + ';max-width:140px;}'
      + '.w207cp input.w207due[readonly]{border-color:transparent;background:transparent;padding-left:0;}'
      + '.w207late{color:' + FLAG + ';font-weight:700;}'
      /* the activities drawer */
      + '.w207pick label{align-items:flex-start;}'
      + '.w207pick .w205ed{background:#FFFAF2;border:1px solid rgba(16,63,57,.15);border-radius:8px;margin-top:6px;font-size:13px;}'
      + '@media (max-width:900px){.w207cov{grid-template-columns:1fr 1fr;}.w207cps{grid-template-columns:1fr 1fr;}.w207alerts{grid-template-columns:1fr;}}'
      + '@media (max-width:640px){'
      + '.w207year{padding:16px 14px 14px;border-radius:16px;}'
      + '.w207qs{margin-left:0;width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;}'
      + '.w207q{min-width:0;padding:5px 6px;}'
      + '.w207q b{font-size:15px;}'
      + '.w207q small{font-size:10px;}'
      + '.w207q.now em{display:none;}'
      + '.w207grid table,.w207grid tbody,.w207grid tr,.w207grid td{display:block;width:100%;}'
      + '.w207grid thead{display:none;}'
      + '.w207grid tr{border-top:1px solid rgba(16,63,57,.1);padding:8px 0;}'
      + '.w207grid td{border:0;padding:3px 12px;}'
      + '.w207grid td[data-l]:before{content:attr(data-l) ": ";font-size:10.5px;font-weight:700;color:' + MUTED + ';text-transform:uppercase;letter-spacing:.8px;}'
      + '.w207grid td.now{background:rgba(220,165,39,.12);}'
      + '.w207cov{grid-template-columns:1fr;}'
      + '.w207yb .top{grid-template-columns:1fr;}'
      + '.w207cps{grid-template-columns:1fr;}'
      + '.w207chip{max-width:100%;}'
      + '}';
    document.head.appendChild(css7);
  }

  /* ---------- dates: the fiscal year starts October 1 ---------- */
  function todayStr() {
    if (window.__W207_TODAY) return String(window.__W207_TODAY);
    var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function quarterOf(ds) {
    var p = String(ds || todayStr()).slice(0, 10).split('-'), y = Number(p[0]), m = Number(p[1]) - 1;
    var q = m >= 9 ? 1 : m <= 2 ? 2 : m <= 5 ? 3 : 4;
    return { fy: 'FY' + String(m >= 9 ? y + 1 : y).slice(2), q: q };
  }
  function daysTo(ds) { var a = new Date(todayStr() + 'T12:00:00'), b = new Date(String(ds).slice(0, 10) + 'T12:00:00'); return Math.round((b - a) / 86400000); }
  function inDays(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 1 ? 'in ' + n + ' days' : n === -1 ? 'yesterday' : (-n) + ' days ago'; }
  var Q_SPAN = { 1: 'Oct to Dec', 2: 'Jan to Mar', 3: 'Apr to Jun', 4: 'Jul to Sep' };

  /* ---------- the rows ---------- */
  function targetOf(gid, fy) { return S.targets.filter(function (t) { return String(t.goal_id) === String(gid) && t.fy === fy; })[0] || null; }
  function cpsOfTarget(tid) { return S.checkpoints.filter(function (c) { return String(c.target_id) === String(tid); }).sort(function (a, b) { return a.quarter - b.quarter; }); }
  function cpsOfGoal(gid) {
    return S.checkpoints.filter(function (c) { return String(c.goal_id) === String(gid); }).sort(function (a, b) {
      var ta = byId(S.targets, a.target_id) || {}, tb = byId(S.targets, b.target_id) || {};
      return String(ta.fy).localeCompare(String(tb.fy)) || a.quarter - b.quarter;
    });
  }
  function cpFy(c) { var t = c ? byId(S.targets, c.target_id) : null; return t ? t.fy : ''; }
  function cpLabel(c) { return c ? (cpFy(c) + ' Q' + c.quarter) : 'A checkpoint'; }
  function isLate(c) { return !!c && c.status !== 'done' && !!c.due_date && String(c.due_date).slice(0, 10) < todayStr(); }
  function yearFy() {
    var now = quarterOf().fy;
    if (S.targets.some(function (t) { return t.fy === now; })) return now;
    var fys = S.targets.map(function (t) { return t.fy; }).sort();
    return fys.length ? fys[fys.length - 1] : now;
  }
  function yearState() {
    var fy = yearFy(), tq = quarterOf(), today = todayStr();
    var cps = S.checkpoints.filter(function (c) { return cpFy(c) === fy && byId(S.goals, c.goal_id); });
    var open = cps.filter(function (c) { return c.status !== 'done' && String(c.due_date).slice(0, 10) >= today; }).sort(function (a, b) { return String(a.due_date).localeCompare(String(b.due_date)); });
    var nextDue = open.length ? String(open[0].due_date).slice(0, 10) : null;
    var late = S.checkpoints.filter(function (c) { return isLate(c) && byId(S.goals, c.goal_id); }).sort(function (a, b) { return String(a.due_date).localeCompare(String(b.due_date)); });
    return { fy: fy, today: today, quarter: tq.fy === fy ? tq.q : null, nextDue: nextDue, next: open.filter(function (c) { return String(c.due_date).slice(0, 10) === nextDue; }), overdue: late, total: cps.length, done: cps.filter(function (c) { return c.status === 'done'; }).length };
  }
  function goalNum(gid) { var g = byId(S.goals, gid); return g ? g.number : ''; }
  function pill(c) { return '<span class="w207pill s-' + stKey(c.status) + (isLate(c) ? ' late' : '') + '">' + E(isLate(c) ? 'Overdue' : (ST_LABEL[c.status] || c.status)) + '</span>'; }

  /* ---------- the This year view, at the top of Goals ---------- */
  function yearViewHtml() {
    if (!S.targets.length) return '<div data-w207year></div>';
    var Y = yearState(), plan = S.plan['year_' + Y.fy.toLowerCase()] || {};
    var cps0 = S.checkpoints.filter(function (c) { return cpFy(c) === Y.fy; });
    var qDue = {}; cps0.forEach(function (c) { if (!qDue[c.quarter] || String(c.due_date) > qDue[c.quarter]) qDue[c.quarter] = String(c.due_date).slice(0, 10); });
    var qs = [1, 2, 3, 4].map(function (q) {
      var past = Y.quarter != null ? q < Y.quarter : (qDue[q] && qDue[q] < Y.today);
      return '<div class="w207q' + (Y.quarter === q ? ' now' : '') + (past ? ' past' : '') + '"><b>Q' + q + (Y.quarter === q ? '<em>Now</em>' : '') + '</b><small>' + E(Q_SPAN[q]) + (qDue[q] ? ' · due ' + E(fmtDay(qDue[q]).replace(/, \d{4}$/, '')) : '') + '</small></div>';
    }).join('');
    var item = function (c) {
      return '<div class="w207it" data-w207goto="' + c.goal_id + '" role="link" tabindex="0"><span class="w205num">' + E(goalNum(c.goal_id)) + '</span><span class="tx" data-w198skip>' + E(c.body) + '</span>' + pill(c) + '</div>';
    };
    var lateBox = Y.overdue.length
      ? '<div class="w207box late" data-w207overdue><h3>' + I('flag') + ' Overdue (' + Y.overdue.length + ')</h3><p class="when">Past their due date and not done.</p>' + Y.overdue.map(function (c) { return item(c).replace('<span class="tx"', '<span class="tx" title="' + E(cpLabel(c) + ', due ' + fmtDay(c.due_date)) + '"'); }).join('') + '</div>'
      : '<div class="w207box ok" data-w207overdue><h3>' + I('check') + ' Nothing overdue</h3><p class="when">Every checkpoint that has come due is done.</p></div>';
    var nextBox = Y.nextDue
      ? '<div class="w207box" data-w207next><h3>' + I('clock') + ' Due next</h3><p class="when">' + E(fmtDay(Y.nextDue)) + ' · ' + E(inDays(daysTo(Y.nextDue))) + '</p>' + Y.next.map(item).join('') + '</div>'
      : '<div class="w207box ok" data-w207next><h3>' + I('check') + ' Nothing left to come due</h3><p class="when">' + E(Y.fy) + '’s checkpoints are done or past.</p></div>';
    var rows = S.goals.map(function (g) {
      var t = targetOf(g.id, Y.fy); if (!t) return '';
      var cps = cpsOfTarget(t.id);
      return '<tr data-w207goto="' + g.id + '" tabindex="0" role="link" aria-label="Open goal ' + E(g.number) + '">' +
        '<td><span style="display:flex;gap:8px;align-items:center"><span class="w205num">' + E(g.number) + '</span><b data-w198skip>' + E(g.title) + '</b></span></td>' +
        '<td data-l="' + E(Y.fy) + ' target" class="tg" data-w198skip>' + E(t.body) + '</td>' +
        [1, 2, 3, 4].map(function (q) {
          var c = cps.filter(function (x) { return x.quarter === q; })[0];
          return '<td data-l="Q' + q + '" class="' + (Y.quarter === q ? 'now' : '') + (c && isLate(c) ? ' late' : '') + '">' + (c ? pill(c) + '<div data-w198skip>' + E(c.body) + '</div>' : '') + '</td>';
        }).join('') +
        '<td data-l="Owners" data-w198skip>' + E(t.owners || '') + '</td></tr>';
    }).join('');
    return '<section class="w207year" data-w207year aria-label="This year">' +
      '<div class="hd"><div><div class="lab">This year</div><h2>' + E(Y.fy) + ' goals</h2><p class="sub">' + E(plan.title || ('This year’s goals: ' + Y.fy)) + '</p></div><div class="w207qs" aria-label="Quarters">' + qs + '</div></div>' +
      (plan.intro ? '<p class="sub" style="margin-top:10px">' + E(plan.intro) + '</p>' : '') +
      '<div class="w207alerts">' + nextBox + lateBox + '</div>' +
      '<div class="w207grid"><table><colgroup><col style="width:17%"><col style="width:17%"><col><col><col><col><col style="width:10%"></colgroup><thead><tr><th>Goal</th><th>' + E(Y.fy) + ' target</th>' + [1, 2, 3, 4].map(function (q) { return '<th class="' + (Y.quarter === q ? 'now' : '') + '">Q' + q + (qDue[q] ? ' (by ' + E(fmtDay(qDue[q]).replace(/, \d{4}$/, '')) + ')' : '') + '</th>'; }).join('') + '<th>Owners</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="note">' + E(Y.done + ' of ' + Y.total + ' checkpoints done. ') + (plan.note ? E(plan.note) : '') + '</p></section>';
  }
  function paintYear() {
    var el = document.querySelector('#w205 [data-w207year]'); if (!el) return;
    var t = document.createElement('div'); t.innerHTML = yearViewHtml(); var n = t.firstElementChild; if (n) el.replaceWith(n);
  }
  function goYear(gid) { go('#orggoals/goal/' + gid); setTimeout(function () { var b = document.querySelector('#w205 [data-w207yb="' + gid + '"]'); if (b) try { b.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* fine */ } }, 500); }

  /* ---------- a goal's year block: the target, who reports on it, the four checkpoints ---------- */
  function cpCmtBtn(c) {
    var n = S.comments.filter(function (x) { return String(x.checkpoint_id) === String(c.id); }).length;
    return '<button type="button" class="w205cnt' + (n ? ' has' : '') + '" data-w207cpcmts="' + c.id + '" aria-label="Comments on this checkpoint (' + n + ')">' + I('chat') + (n ? n : '') + '</button>';
  }
  function cpHtml(c, g, Y) {
    var can = canEdit(g), late = isLate(c), now = Y.quarter === c.quarter && cpFy(c) === Y.fy;
    var k = key('checkpoint', c.id, 'status'), kd = key('checkpoint', c.id, 'due_date');
    return '<div class="w207cp' + (now ? ' now' : '') + (late ? ' late' : '') + (c.status === 'done' ? ' done' : '') + '" data-w207cp="' + c.id + '">' +
      '<div class="qh"><b>Q' + c.quarter + '</b>' + (now ? '<em>Now</em>' : '') + '<span class="sp" style="flex:1"></span>' +
      '<select class="w207st s-' + stKey(c.status) + '" data-w205k="' + E(k) + '" aria-label="Q' + c.quarter + ' checkpoint status"' + (can ? '' : ' disabled') + '>' +
      CP_ST.map(function (s0) { return '<option value="' + E(s0) + '"' + (s0 === c.status ? ' selected' : '') + '>' + E(ST_LABEL[s0] || s0) + '</option>'; }).join('') + '</select></div>' +
      ed('checkpoint', c, 'body', { label: 'Q' + c.quarter + ' checkpoint', ph: 'Write the checkpoint' }) +
      '<div class="ft"><span>Due</span><input type="date" class="w207due" data-w205k="' + E(kd) + '" value="' + E(String(c.due_date || '').slice(0, 10)) + '" aria-label="Q' + c.quarter + ' due date"' + (can ? '' : ' readonly tabindex="-1"') + ' />' +
      (late ? '<span class="w207late">Overdue</span>' : '') + '</div>' +
      '<div class="w205msft" style="margin:0" data-w207cpft="' + c.id + '">' + cpFootHtml(c) + '</div></div>';
  }
  function yearBlockHtml(g) {
    var Y = yearState(), t = targetOf(g.id, Y.fy); if (!t) return '';
    return '<div class="w205h4"><h4>This year (' + E(Y.fy) + ')</h4><span style="font-size:12px;color:' + MUTED + '">The yearly target and its quarterly checkpoints</span></div>' +
      '<div class="w207yb" data-w207yb="' + g.id + '"><div class="top"><div><div class="w205lab">' + E(Y.fy) + ' target <span class="who" data-w205who="' + E(key('target', t.id, 'body')) + '" hidden></span></div>' + ed('target', t, 'body', { label: Y.fy + ' target', ph: 'Write the target' }) + '</div>' +
      '<div><div class="w205lab">Owners who report on it <span class="who" data-w205who="' + E(key('target', t.id, 'owners')) + '" hidden></span></div>' + ed('target', t, 'owners', { label: Y.fy + ' owners', ph: 'Who reports on it' }) + '</div></div>' +
      '<div class="w207cps">' + cpsOfTarget(t.id).map(function (c) { return cpHtml(c, g, Y); }).join('') + '</div></div>';
  }
  function afterYearSave(P) {
    if (P.e !== 'checkpoint') return;
    var c = byId(S.checkpoints, P.id), box = document.querySelector('#w205 [data-w207cp="' + P.id + '"]'); if (!c || !box) return;
    var Y = yearState();
    box.classList.toggle('done', c.status === 'done'); box.classList.toggle('late', isLate(c));
    var sel = box.querySelector('select.w207st'); if (sel) sel.className = 'w207st s-' + stKey(c.status);
    var ft = box.querySelector('.ft'), lt = ft && ft.querySelector('.w207late');
    if (isLate(c) && ft && !lt) { var s0 = document.createElement('span'); s0.className = 'w207late'; s0.textContent = 'Overdue'; ft.appendChild(s0); }
    if (!isLate(c) && lt) lt.remove();
    void Y;
  }
  function cpFootHtml(c) {
    var ps = S.projects.filter(function (p) { return String(p.checkpoint_id) === String(c.id); });
    return ps.map(projChip).join('') + cpCmtBtn(c) + (canComment() ? '<button type="button" class="w205cnt" data-w207cplink="' + c.id + '" aria-label="Link a project to this checkpoint">' + I('link') + '</button>' : '');
  }
  function paintCpFoot(gid) { cpsOfGoal(gid).forEach(function (c) { var el = document.querySelector('#w205 [data-w207cpft="' + c.id + '"]'); if (el) el.innerHTML = cpFootHtml(c); }); }
  function paintYearCounts(gid) {
    cpsOfGoal(gid).forEach(function (c) { var b = document.querySelector('#w205 [data-w207cpcmts="' + c.id + '"]'); if (b) b.outerHTML = cpCmtBtn(c); });
  }

  /* ---------- the charitable activities ---------- */
  function actOf(id) { return byId(S.acts, id); }
  function gactsOf(gid) { return S.gacts.filter(function (a) { return String(a.goal_id) === String(gid); }).sort(function (a, b) { return (a.sort - b.sort) || (a.activity_id - b.activity_id); }); }
  function actsMini(gid) { return '<span class="w207mini">' + gactsOf(gid).map(function (a) { var x = actOf(a.activity_id) || {}; return '<i title="' + E(a.activity_id + '. ' + (x.title || '') + (a.reason ? ' (' + a.reason + ')' : '')) + '">' + E(a.activity_id) + '</i>'; }).join('') + '</span>'; }
  function actsHtml(g) {
    var list = gactsOf(g.id), can = canEdit(g);
    var note = can ? '<div class="w207note">' + ed('goal', g, 'activities_note', { label: 'Note on the charitable activities', ph: 'A note on the activities (optional)' }) + '</div>'
      : (g.activities_note ? '<div class="w207note" data-w198skip>' + E(g.activities_note) + '</div>' : '');
    return '<span class="lab">Charitable activities</span>' + list.map(function (a) {
      var x = actOf(a.activity_id) || { title: '' };
      return '<button type="button" class="w207chip" data-w207chip="' + g.id + ':' + a.activity_id + '" aria-expanded="false" title="' + E(a.activity_id + '. ' + x.title + (a.reason ? ': ' + a.reason : '')) + '"><b>' + E(a.activity_id) + '</b><span data-w198skip>' + E(x.title) + '</span></button>';
    }).join('') + (list.length ? '' : '<span style="font-size:12.5px;color:' + FLAG + '">Not anchored on an activity yet.</span>') +
      (can ? '<button type="button" class="w205chip add" data-w207manage="' + g.id + '">' + I('plus') + ' Activities</button>' : '') + note;
  }
  function paintActs(gid) {
    var el = document.querySelector('#w205 [data-w207acts="' + gid + '"]'), g = byId(S.goals, gid); if (!el || !g) return;
    var nk = key('goal', g.id, 'activities_note'), cur = fieldEl(nk), keep = cur && (S.dirty[nk] || document.activeElement === cur) ? cur.value : null, foc = cur && document.activeElement === cur;
    el.innerHTML = actsHtml(g);
    var n = fieldEl(nk); if (n) { if (keep != null) n.value = keep; grow(n); if (foc) n.focus(); }
  }
  function chipTip(el) {
    var p = el.getAttribute('data-w207chip').split(':'), box = el.parentNode, open = el.getAttribute('aria-expanded') === 'true';
    box.querySelectorAll('.w207tip').forEach(function (t) { t.remove(); });
    box.querySelectorAll('[data-w207chip]').forEach(function (c) { c.setAttribute('aria-expanded', 'false'); });
    if (open) return;
    var a = S.gacts.filter(function (x) { return String(x.goal_id) === p[0] && String(x.activity_id) === p[1]; })[0], x = actOf(p[1]) || {};
    var tip = document.createElement('div'); tip.className = 'w207tip'; tip.setAttribute('role', 'note');
    tip.innerHTML = '<b>' + E(p[1] + '. ' + (x.title || '')) + '</b><br>' + (a && a.reason ? 'Why this goal serves it: <span data-w198skip>' + E(a.reason) + '</span>' : 'No reason written yet.');
    el.setAttribute('aria-expanded', 'true');
    var note = box.querySelector('.w207note'); if (note) box.insertBefore(tip, note); else box.appendChild(tip);
  }
  function coverage() { return S.acts.map(function (a) { return { act: a, goals: S.goals.filter(function (g) { return gactsOf(g.id).some(function (x) { return String(x.activity_id) === String(a.id); }); }) }; }); }
  function coverageHtml() {
    if (!S.acts.length) return '<div data-w207cov></div>';
    var cov = coverage(), n = cov.filter(function (c) { return c.goals.length; }).length, plan = S.plan.activities || {};
    return '<div data-w207cov><div class="w205sec"><h2>' + E(S.acts.length) + ' activities</h2><span class="hint">' + E(plan.intro || 'Every goal serves at least one of the charitable activities registered with the CRA.') + '</span><span class="sp"></span>' +
      '<span class="w207covsum' + (n < S.acts.length ? ' gap' : '') + '">' + I(n < S.acts.length ? 'flag' : 'check') + ' ' + (n === S.acts.length ? 'All ' + n + ' covered' : n + ' of ' + S.acts.length + ' covered') + '</span></div>' +
      '<div class="w207cov" aria-label="Charitable activities and the goals that serve them">' + cov.map(function (c) {
        return '<div class="w207tile' + (c.goals.length ? '' : ' gap') + '"><span class="n">' + E(c.act.id) + '</span><span class="t" data-w198skip>' + E(c.act.title) + '</span><div class="gs">' +
          (c.goals.length ? c.goals.map(function (g) { var a = gactsOf(g.id).filter(function (x) { return String(x.activity_id) === String(c.act.id); })[0]; return '<button type="button" data-w205jump="' + g.id + '" title="' + E('Goal ' + g.number + ': ' + g.title + (a && a.reason ? ' (' + a.reason + ')' : '')) + '" aria-label="Goal ' + E(g.number) + '"><span class="w205num">' + E(g.number) + '</span></button>'; }).join('') : 'No goal serves it yet') + '</div></div>';
      }).join('') + '</div></div>';
  }
  function paintCoverage() { var el = document.querySelector('#w205 [data-w207cov]'); if (!el) return; var t = document.createElement('div'); t.innerHTML = coverageHtml(); var n = t.firstElementChild; if (n) el.replaceWith(n); }
  function actsDrawer(st) {
    var g = byId(S.goals, st.goal); if (!g) return drawerShell('Charitable activities', '', '');
    var can = canEdit(g), on = {}; gactsOf(g.id).forEach(function (a) { on[a.activity_id] = a; });
    var body = '<p style="font-size:13px;color:' + MUTED + ';margin:0 0 10px">' + E((S.plan.activities || {}).intro || '') + '</p><div class="w205pick w207pick">' + S.acts.map(function (x) {
      var a = on[x.id];
      return '<label class="' + (a ? 'on' : '') + '"><input type="checkbox" data-w207act="' + x.id + '"' + (a ? ' checked' : '') + (can ? '' : ' disabled') + ' /><span class="t"><span><b>' + E(x.id) + '.</b> ' + E(x.title) + '</span>' +
        (a ? '<small>Why this goal serves it</small>' + ed('activity', a, 'reason', { label: 'Why goal ' + g.number + ' serves activity ' + x.id, ph: 'A few words, e.g. free, healthy meals' }) : '') + '</span></label>';
    }).join('') + '</div>';
    return drawerShell('Charitable activities', '<span data-w198skip>Goal ' + E(g.number) + ': ' + E(g.title) + '</span>', body, '<small style="color:' + MUTED + '">Tick the activities this goal serves and say why in a few words. It saves as you go; every change is in the goal’s history.</small>');
  }
  function actToggle(gid, aid, on, el) {
    if (el) el.disabled = true;
    rpc('strategy_activity_set', { p_goal: Number(gid), p_activity: Number(aid), p_on: !!on, p_reason: null }).then(function (row) {
      S.gacts = S.gacts.filter(function (a) { return !(String(a.goal_id) === String(gid) && String(a.activity_id) === String(aid)); });
      if (row && !row.archived_at) { S.gacts.push(row); baseRow('activity', row, ['reason']); }
      paintActs(gid); paintCoverage(); paintGlance(); if (S.drawer && S.drawer.kind === 'acts') paintDrawer();
      toastS(on ? 'Activity added to the goal' : 'Activity taken off. History has Restore.');
    }).catch(function (e) { if (el) { el.disabled = false; el.checked = !on; } toastS('Not changed: ' + errText(e)); });
  }

  /* the link sheet: a checkpoint of the chosen goal, optional */
  function cpPickHtml(gg, st) {
    var Y = yearState(), list = cpsOfGoal(gg.id); if (!list.length) return '';
    return '<div class="w205grp">The checkpoint (optional)</div><div class="w205pick"><label class="' + (!st.cpPick ? 'on' : '') + '"><input type="radio" name="w207lc" data-w207pickc=""' + (!st.cpPick ? ' checked' : '') + ' /><span class="t">No checkpoint</span></label>' +
      list.map(function (c) {
        var sel = String(st.cpPick) === String(c.id);
        return '<label class="' + (sel ? 'on' : '') + '"><input type="radio" name="w207lc" data-w207pickc="' + c.id + '"' + (sel ? ' checked' : '') + ' /><span class="t"><span data-w198skip>' + E(c.body) + '</span><small>' + E(cpLabel(c)) + ' · due ' + E(fmtDay(c.due_date)) + (Y.quarter === c.quarter && cpFy(c) === Y.fy ? ' · this quarter' : '') + '</small></span></label>';
      }).join('') + '</div>';
  }
