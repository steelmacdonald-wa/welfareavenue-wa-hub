  /* ---------- WA v353 (18/11/26): the goals ecosystem ----------
     Steel (17/11/26): every piece of work, whether a project, an event, a milestone or a KPI, measured where the Hub can
     (live from its own data and connections), flowing into the goals, so the strategy shows from every angle how we get there.
     From the 10 Nov leadership meeting and the 16 Nov session with Ian:
     - Live measures on each goal (wa353_measures, goal_measures): goal 3 counts the community that comes back; goal 4 the
       recurring donors and the six-month trend of gifts.
     - Milestones as year bubbles, FY27 to FY29 (FY31 on request; the SMART text stays as the board has it). This year opens
       into its four quarters: each quarter's checkpoint and the milestones due in it (goal_milestones.quarter).
     - A project moves many milestones (project_milestones); a milestone shows every project moving it.
     - Key events: the fundraising events and drives that feed a goal (fund_events.goal_id, milestone_id), target against raised.
     - Contributors beside the owners (goal_contributors): the leads whose teams carry the goal.
     - Reaching a milestone feels like it: a small burst, the ring of its year fills, the toast says where the year stands.
       Motion follows the design rules: transform and opacity only, strong ease-out, under 300ms for UI, delight kept for
       the rare moments (a milestone done, a target reached, the first count of the numbers), none for reduced motion. */
  var W353 = { yr: {}, show31: lsGet('w353show31') === '1', counted: {} };
  var RM = (function () { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } })();
  var EASE = 'cubic-bezier(.23,1,.32,1)';
  (function () {
    if (document.getElementById('wa353css')) return;
    var c = document.createElement('style'); c.id = 'wa353css';
    c.textContent = ''
      /* live measures */
      + '.w353meas{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin:14px 0 4px;}'
      + '.w353m{background:#fff;border:1px solid rgba(16,63,57,.1);border-radius:14px;padding:11px 13px 10px;min-width:0;display:flex;flex-direction:column;gap:5px;}'
      + '.w353m.head{grid-column:span 2;background:' + GREEN + ';border-color:' + GREEN + ';color:' + CREAM + ';}'
      + '.w353m .lab{font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;font-weight:700;color:' + MUTED + ';}'
      + '.w353m.head .lab{color:rgba(255,250,242,.75);}'
      + '.w353m .num{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;}'
      + '.w353m .num b{font-family:' + HEAD + ';font-size:26px;line-height:1;font-weight:700;color:' + GREEN + ';font-variant-numeric:tabular-nums;}'
      + '.w353m.head .num b{font-size:38px;color:' + CREAM + ';}'
      + '.w353m .num small{font-size:12px;color:' + MUTED + ';}'
      + '.w353m.head .num small{color:rgba(255,250,242,.75);}'
      + '.w353m.off .num b{font-family:' + BODY + ';font-size:14px;font-weight:600;color:' + MUTED + ';}'
      + '.w353tr{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 7px;background:rgba(16,63,57,.07);color:' + GREEN + ';}'
      + '.w353tr.up{background:rgba(42,140,122,.14);color:' + TEAL + ';}.w353tr.dn{background:rgba(179,64,47,.1);color:' + FLAG + ';}'
      + '.w353m.head .w353tr{background:rgba(255,250,242,.16);color:' + CREAM + ';}'
      + '.w353m .tg{font-size:12px;color:' + MUTED + ';}.w353m.head .tg{color:rgba(255,250,242,.8);}'
      + '.w353m .src{font-size:11px;color:' + MUTED + ';display:flex;align-items:center;gap:5px;margin-top:auto;}'
      + '.w353m.head .src{color:rgba(255,250,242,.7);}'
      + '.w353m .src .dot{width:7px;height:7px;border-radius:50%;background:#C9C6BD;flex:none;}.w353m .src .dot.on{background:' + TEAL + ';box-shadow:0 0 0 3px rgba(42,140,122,.16);}'
      + '.w353asof{font-size:12px;color:' + MUTED + ';margin:2px 2px 10px;}'
      /* bars: transform only, filled from the left the first time they appear */
      + '.w353bar{height:7px;border-radius:999px;background:rgba(16,63,57,.1);overflow:hidden;position:relative;}'
      + '.w353m.head .w353bar{background:rgba(255,250,242,.18);}'
      + '.w353bar.sm{height:5px;}'
      + '.w353bar i{position:absolute;inset:0;border-radius:inherit;background:' + TEAL + ';transform-origin:left center;transform:scaleX(var(--p,0));transition:transform 700ms ' + EASE + ';}'
      + '.w353m.head .w353bar i{background:' + GOLD + ';}'
      + '@starting-style{.w353bar i{transform:scaleX(0);}}'
      /* year bubbles (the years block was a grid of year cards: now one column, bubbles over the open year) */
      + '#w205 .w205years{display:block;}'
      + '.w353q .w207cp .qh>b,.w353q .w207cp .qh>em{display:none;}'
      + '.w353ybs{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 12px;}'
      + '.w353yb{display:flex;align-items:center;gap:9px;border:1px solid rgba(16,63,57,.14);background:#fff;border-radius:999px;padding:6px 14px 6px 6px;cursor:pointer;font:inherit;color:' + GREEN + ';transition:transform 160ms ' + EASE + ',background-color 160ms ease,border-color 160ms ease;}'
      + '.w353yb:active{transform:scale(.97);}'
      + '.w353yb.on{background:' + GREEN + ';border-color:' + GREEN + ';color:' + CREAM + ';}'
      + '.w353yb .t{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1;}'
      + '.w353yb .t b{font-family:' + HEAD + ';font-size:18px;letter-spacing:.02em;}'
      + '.w353yb .t small{font-size:11.5px;opacity:.8;}'
      + '.w353yb.gated{border-style:dashed;}'
      + '.w353yb .ring{width:30px;height:30px;transform:rotate(-90deg);flex:none;}'
      + '.w353yb .ring circle{fill:none;stroke-width:3.4;}'
      + '.w353yb .ring .bg{stroke:rgba(16,63,57,.12);}.w353yb.on .ring .bg{stroke:rgba(255,250,242,.22);}'
      + '.w353yb .ring .fg{stroke:' + TEAL + ';stroke-linecap:round;stroke-dasharray:97.4;stroke-dashoffset:var(--o,97.4);transition:stroke-dashoffset 800ms ' + EASE + ',stroke 300ms ease;}'
      + '.w353yb.on .ring .fg{stroke:' + GOLD + ';}'
      + '@starting-style{.w353yb .ring .fg{stroke-dashoffset:97.4;}}'
      + '.w353yb.full .ring .fg{stroke:' + GOLD + ';}'
      + '.w353yb.full:not(.on){border-color:rgba(220,165,39,.6);}'
      + '.w353y31{border:0;background:none;font:inherit;font-size:12.5px;color:' + MUTED + ';text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:4px 6px;}'
      + '.w353ypanel{animation:w353in 220ms ' + EASE + ';}'
      + '@keyframes w353in{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}'
      + '.w353yh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 2px 10px;}.w353yh b{font-family:' + HEAD + ';font-size:20px;color:' + GREEN + ';}.w353yh span{font-size:12.5px;color:' + MUTED + ';}.w353yh em{font-style:normal;font-size:12px;color:' + FLAG + ';}'
      + '.w353qs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0;}'
      + '.w353q{background:#F4F2EA;border:1px solid rgba(16,63,57,.08);border-radius:16px;padding:10px 10px 8px;min-width:0;display:flex;flex-direction:column;gap:8px;}'
      + '.w353q.now{background:#FFF7E3;border-color:rgba(220,165,39,.5);}'
      + '.w353q .qh{display:flex;align-items:baseline;gap:6px;}.w353q .qh b{font-family:' + HEAD + ';font-size:17px;color:' + GREEN + ';}.w353q .qh span{font-size:11.5px;color:' + MUTED + ';flex:1;}'
      + '.w353q .qh em{font-style:normal;font-size:11px;font-weight:700;color:#7A5A12;background:rgba(220,165,39,.25);border-radius:999px;padding:1px 7px;}'
      + '.w353q .w207cp{margin:0;}'
      + '.w353any{background:#F4F2EA;border:1px solid rgba(16,63,57,.08);border-radius:16px;padding:10px 12px;margin:0 0 6px;}'
      + '.w353list{display:flex;flex-direction:column;gap:8px;}'
      + '.w353none{font-size:12.5px;color:' + MUTED + ';margin:2px 2px 8px;}'
      + '.w353qsel{font:inherit;font-size:11.5px;border:1px solid rgba(16,63,57,.15);border-radius:999px;background:#fff;color:' + GREEN + ';padding:2px 6px;margin-left:auto;}'
      + '.w353ml{display:flex;align-items:center;gap:8px;margin:4px 0 2px 30px;font-size:12px;color:' + MUTED + ';}.w353ml .w353bar{flex:1;max-width:220px;}.w353ml b{color:' + TEAL + ';}'
      + '.w353reach{display:inline-flex;align-items:center;gap:6px;margin:6px 0 0 30px;border:1px solid rgba(220,165,39,.6);background:#FFF7E3;color:#7A5A12;border-radius:999px;padding:4px 11px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:transform 160ms ' + EASE + ';}'
      + '.w353reach:active{transform:scale(.97);}.w353reach .w205i{width:14px;height:14px;}'
      /* a milestone reached */
      + '.w205ms.w353pop{animation:w353pop 520ms ' + EASE + ';}'
      + '@keyframes w353pop{0%{transform:scale(1);}35%{transform:scale(1.012);box-shadow:0 0 0 6px rgba(220,165,39,.18);}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(220,165,39,0);}}'
      + '.w353burst{position:fixed;width:0;height:0;pointer-events:none;z-index:2147483000;}'
      + '.w353burst i{position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:2px;opacity:0;animation:w353b 720ms ' + EASE + ' forwards;}'
      + '@keyframes w353b{0%{transform:translate(0,0) scale(1) rotate(0);opacity:1;}100%{transform:translate(var(--x),var(--y)) scale(.5) rotate(140deg);opacity:0;}}'
      /* key events */
      + '.w353evsum{font-size:12.5px;color:' + MUTED + ';margin:0 2px 8px;}'
      + '.w353evs{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin:0 0 6px;}'
      + '.w353ev{background:#fff;border:1px solid rgba(16,63,57,.1);border-radius:14px;padding:11px 13px;display:flex;flex-direction:column;gap:6px;min-width:0;}'
      + '.w353ev .eh{display:flex;gap:8px;align-items:flex-start;}.w353ev .eh b{flex:1;font-size:14.5px;color:' + GREEN + ';line-height:1.25;}'
      + '.w353ev .em{font-size:12px;color:' + MUTED + ';}'
      + '.w353ev .tg{font-size:12px;color:' + MUTED + ';}.w353ev .tg b{color:' + GREEN + ';}.w353ev .tg.muted{font-style:italic;}'
      + '.w353ev .w353bar i{background:' + GOLD + ';}'
      + '.w353ev.hit{border-color:rgba(220,165,39,.6);background:#FFFCF3;}'
      + '.w353ev.hit .w353bar i{background:linear-gradient(90deg,' + GOLD + ',#F0CF73,' + GOLD + ');}'
      + '.w353ev.done{opacity:.8;}'
      + '.w353ev .ef{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}.w353ev .ef .sp{flex:1;}'
      + '.w353st{font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;background:rgba(16,63,57,.07);color:' + GREEN + ';white-space:nowrap;}'
      + '.w353st.s-done{background:rgba(42,140,122,.14);color:' + TEAL + ';}.w353st.s-idea{background:rgba(111,100,171,.12);color:' + PURPLE + ';}.w353st.s-planned{background:rgba(220,165,39,.18);color:#7A5A12;}'
      + '.w353msref{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:' + MUTED + ';min-width:0;}.w353msref .w205i{width:13px;height:13px;flex:none;}'
      + '.w353past summary{cursor:pointer;font-size:12.5px;color:' + MUTED + ';margin:4px 2px 8px;}'
      /* contributors */
      + '.w353contribs{margin-top:-2px;}.w353cl{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:' + MUTED + ';margin-right:2px;}'
      + '.w353contribs .w205chip{background:transparent;border-style:dashed;}'
      + '@media (max-width:900px){.w353qs{grid-template-columns:repeat(2,minmax(0,1fr));}}'
      + '@media (max-width:620px){.w353qs{grid-template-columns:1fr;}.w353m.head{grid-column:1/-1;}.w353meas{grid-template-columns:repeat(2,minmax(0,1fr));}.w353yb{padding-right:10px;}.w353ml,.w353reach{margin-left:0;}}'
      + '@media (prefers-reduced-motion:reduce){.w353bar i,.w353yb .ring .fg{transition:none;}.w353ypanel{animation:w353fade 160ms ease;}.w205ms.w353pop{animation:none;background:rgba(220,165,39,.12);}.w353burst{display:none;}}'
      + '@keyframes w353fade{from{opacity:0;}to{opacity:1;}}';
    document.head.appendChild(c);
  })();

  /* this year as the checkpoints read it (quarterOf follows the page's today) */
  function thisFy() { return quarterOf().fy; }
  function mv(k) { return (S.mv || {})[k] || null; }
  function fmtN(v, unit) {
    if (v == null || v === '') return '–';
    var n = Number(v); if (isNaN(n)) return String(v);
    var s = Math.round(n).toLocaleString('en-CA');
    return unit === '$' ? '$' + s : unit === '%' ? s + '%' : s;
  }
  function pctOf(v, t) { v = Number(v); t = Number(t); if (!t || isNaN(v)) return null; return Math.max(0, Math.min(100, Math.round(v / t * 100))); }
  function measuresOf(gid) { return (S.measures || []).filter(function (x) { return String(x.goal_id) === String(gid); }).sort(function (a, b) { return (b.is_headline ? 1 : 0) - (a.is_headline ? 1 : 0) || (a.sort - b.sort); }); }
  function measureByKey(k) { return (S.measures || []).filter(function (x) { return x.key === k; })[0] || null; }
  function trendHtml(x, unit) {
    if (!x || x.prev == null || x.v == null) return '';
    var d = Number(x.v) - Number(x.prev); if (!d) return '<span class="w353tr" title="Against the period before">steady</span>';
    return '<span class="w353tr ' + (d > 0 ? 'up' : 'dn') + '" title="Against the period before">' + (d > 0 ? '↑ ' : '↓ ') + fmtN(Math.abs(d), unit) + '</span>';
  }
  function measuresHtml(g) {
    var list = measuresOf(g.id); if (!list.length) return '';
    var asOf = S.mv && S.mv._as_of;
    return '<div class="w353meas" data-w353meas="' + g.id + '" aria-label="Live measures for goal ' + E(g.number) + '">' + list.map(function (m) {
      var x = mv(m.key) || {}, tracked = !!S.mv && !S.mvErr && x.tracked !== false && x.v != null, p = tracked && m.target_fy27 != null ? pctOf(x.v, m.target_fy27) : null;
      return '<div class="w353m' + (m.is_headline ? ' head' : '') + (tracked ? '' : ' off') + '" title="' + E(x.note || m.source || '') + '">' +
        '<div class="lab">' + E(m.label) + '</div>' +
        '<div class="num"><b' + (tracked && m.is_headline ? ' data-w353n="' + E(Number(x.v)) + '" data-w353u="' + E(m.unit || '') + '" data-w353k="' + E(m.key) + '"' : '') + '>' + (tracked ? fmtN(x.v, m.unit) : (x.tracked === false ? 'Not tracked yet' : '–')) + '</b>' +
        (tracked && m.unit && m.unit !== '$' && m.unit !== '%' ? '<small>' + E(m.unit) + '</small>' : '') + (tracked ? trendHtml(x, m.unit) : '') + '</div>' +
        (p != null ? '<div class="w353bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '" aria-label="' + E(m.label) + ' against the FY27 target"><i style="--p:' + (p / 100) + '"></i></div>' +
          '<div class="tg">' + (p >= 100 ? 'FY27 target reached: ' : p + '% of ') + fmtN(m.target_fy27, m.unit) + (p >= 100 ? '' : ' for FY27') + '</div>' : '') +
        '<div class="src"><i class="dot' + (tracked ? ' on' : '') + '"></i>' + (tracked ? 'Live' : 'Waiting') + ' · ' + E(m.source || '') + '</div></div>';
    }).join('') + '</div>' +
      (asOf ? '<p class="w353asof">Counted by the Hub ' + E(fmtWhen(asOf)) + '. Hover a number for how it is counted. <button type="button" class="w205link" data-w353refresh="1">Count again</button></p>'
            : (S.mvErr ? '<p class="w353asof">The live numbers did not load (' + E(clip(S.mvErr, 90)) + ').</p>' : ''));
  }
  /* the first time the headline numbers show in a visit, they count up to their value (rare: delight is fine) */
  function countUp() {
    if (RM) return;
    document.querySelectorAll('#w205 .w353m.head b[data-w353n]').forEach(function (b) {
      var k = b.getAttribute('data-w353k'), to = Number(b.getAttribute('data-w353n')), u = b.getAttribute('data-w353u');
      if (W353.counted[k] || !(to > 0)) return; W353.counted[k] = 1;
      var t0 = null, D = 900;
      function step(ts) { if (!t0) t0 = ts; var x = Math.min(1, (ts - t0) / D), e = 1 - Math.pow(1 - x, 3); b.textContent = fmtN(to * e, u); if (x < 1) requestAnimationFrame(step); else b.textContent = fmtN(to, u); }
      requestAnimationFrame(step);
    });
  }
  function w353After() { try { countUp(); } catch (e) { /* cosmetic */ } }

  /* a milestone's projects: every project linked to it (project_milestones), and the older single link */
  function msProjects(mid) {
    var ids = {}; (S.pm || []).forEach(function (r) { if (String(r.milestone_id) === String(mid)) ids[r.project_id] = 1; });
    return S.projects.filter(function (p) { return ids[p.id] || String(p.milestone_id) === String(mid); });
  }
  function projMs(pid) { return (S.pm || []).filter(function (r) { return String(r.project_id) === String(pid); }).map(function (r) { return String(r.milestone_id); }); }
  function msReached(m) {
    if (!m.measure_key || m.target_value == null || m.fy !== thisFy()) return false;
    var x = mv(m.measure_key); return !!(x && x.v != null && x.tracked !== false && Number(x.v) >= Number(m.target_value));
  }
  function msLive(m) {
    if (!m.measure_key || m.target_value == null || m.fy !== thisFy()) return '';
    var x = mv(m.measure_key); if (!x || x.v == null || x.tracked === false) return '';
    var unit = (measureByKey(m.measure_key) || {}).unit, p = pctOf(x.v, m.target_value) || 0;
    return '<div class="w353ml" title="' + E(x.note || 'Counted live by the Hub') + '"><div class="w353bar sm"><i style="--p:' + (p / 100) + '"></i></div><span>' + fmtN(x.v, unit) + ' of ' + fmtN(m.target_value, unit) + (p >= 100 && m.status !== 'done' ? ' · <b>reached</b>' : ' · live') + '</span></div>';
  }
  function msFootHtml(m, g) {
    var can = canEdit(g), cur = m.fy === thisFy();
    var qSel = cur && can ? '<select class="w353qsel" data-w353q="' + m.id + '" aria-label="The quarter this milestone is due">' + [['', 'This year'], ['1', 'Q1'], ['2', 'Q2'], ['3', 'Q3'], ['4', 'Q4']].map(function (o) {
      return '<option value="' + o[0] + '"' + (String(m.quarter || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' : '';
    return msProjects(m.id).map(projChip).join('') + cntBtn(g.id, m.id) +
      (canComment() ? '<button type="button" class="w205cnt" data-w205link="' + g.id + ':' + m.id + '" aria-label="Link a project to this milestone">' + I('link') + '</button>' : '') + qSel;
  }

  /* the years as bubbles: FY27 to FY29 on view (FY31 when asked for); this year opens into its quarters */
  function yearList(g) {
    var fys = ['FY27', 'FY28', 'FY29'];
    msOf(g.id).forEach(function (m) { if (fys.indexOf(m.fy) < 0 && m.fy !== 'FY30' && m.fy !== 'FY31') fys.push(m.fy); });
    fys.sort(); if (W353.show31) fys.push('FY31');
    return fys;
  }
  function ringOffset(list) { var done = list.filter(function (m) { return m.status === 'done'; }).length; return (97.4 * (1 - (list.length ? done / list.length : 0))).toFixed(1); }
  function bubbleHtml(g, fy, sel) {
    var now = thisFy(), list = msOf(g.id).filter(function (m) { return m.fy === fy; }), done = list.filter(function (m) { return m.status === 'done'; }).length;
    return '<button type="button" class="w353yb' + (fy === sel ? ' on' : '') + (fy === 'FY31' ? ' gated' : '') + (list.length && done === list.length ? ' full' : '') + '" data-w353yr="' + g.id + ':' + fy + '" aria-pressed="' + (fy === sel ? 'true' : 'false') + '" aria-label="' + E(fy + ': ' + done + ' of ' + list.length + ' milestones done') + '">' +
      '<svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" class="bg"/><circle cx="18" cy="18" r="15.5" class="fg" style="--o:' + ringOffset(list) + '"/></svg>' +
      '<span class="t"><b>' + E(fy) + '</b><small>' + (fy === now ? 'Now · ' : fy === 'FY31' ? 'Gated · ' : '') + done + ' of ' + list.length + '</small></span></button>';
  }
  function selYear(g) { var fys = yearList(g), now = thisFy(), s = W353.yr[g.id]; return s && fys.indexOf(s) >= 0 ? s : (fys.indexOf(now) >= 0 ? now : fys[0]); }
  function yearsHtml(g) {
    var fys = yearList(g), sel = selYear(g), has31 = msOf(g.id).some(function (m) { return m.fy === 'FY31' || m.fy === 'FY30'; });
    return '<div class="w353ybs" role="group" aria-label="Milestones by fiscal year">' + fys.map(function (fy) { return bubbleHtml(g, fy, sel); }).join('') +
      (has31 ? '<button type="button" class="w353y31" data-w353fy31="1">' + (W353.show31 ? 'Hide FY31' : 'Show FY31 (gated)') + '</button>' : '') + '</div>' +
      '<div class="w353ypanel" data-w353yp="' + g.id + '">' + yearPanelHtml(g, sel) + '</div>';
  }
  function yearPanelHtml(g, fy) {
    var ms = msOf(g.id).filter(function (m) { return m.fy === fy; }), can = canEdit(g), now = thisFy();
    var head = '<div class="w353yh"><b>' + E(fy) + '</b><span>' + E(FY_LABEL[fy] || '') + '</span>' + (fy === 'FY31' ? '<em>Only if the FY29 gate is met</em>' : '') + '</div>';
    var add = function (q) { return can ? '<button type="button" class="w205addms" data-w205addms="' + g.id + ':' + fy + (q ? ':' + q : '') + '">' + I('plus') + (q ? ' Milestone in Q' + q : ' Add a milestone') + '</button>' : ''; };
    if (fy !== now) {
      return head + '<div class="w353list">' + ms.map(function (m) { return msHtml(m, g); }).join('') + '</div>' +
        (ms.length ? '' : '<p class="w353none">' + (can ? 'No milestone yet.' : 'No milestone for this year.') + '</p>') + add(null);
    }
    var Y = yearState(), t = targetOf(g.id, fy), cps = t ? cpsOfTarget(t.id) : [];
    var top = t ? '<div class="w207yb" data-w207yb="' + g.id + '"><div class="top"><div><div class="w205lab">' + E(fy) + ' target <span class="who" data-w205who="' + E(key('target', t.id, 'body')) + '" hidden></span></div>' + ed('target', t, 'body', { label: fy + ' target', ph: 'Write the target' }) + '</div>' +
      '<div><div class="w205lab">Owners who report on it <span class="who" data-w205who="' + E(key('target', t.id, 'owners')) + '" hidden></span></div>' + ed('target', t, 'owners', { label: fy + ' owners', ph: 'Who reports on it' }) + '</div></div></div>' : '';
    var cols = [1, 2, 3, 4].map(function (q) {
      var c = cps.filter(function (x) { return x.quarter === q; })[0], list = ms.filter(function (m) { return Number(m.quarter) === q; }), isNow = Y.fy === fy && Y.quarter === q;
      return '<div class="w353q' + (isNow ? ' now' : '') + '" data-w353qcol="' + q + '"><div class="qh"><b>Q' + q + '</b><span>' + E(Q_SPAN[q]) + '</span>' + (isNow ? '<em>Now</em>' : '') + '</div>' +
        (c ? cpHtml(c, g, Y) : '') + list.map(function (m) { return msHtml(m, g); }).join('') + add(q) + '</div>';
    }).join('');
    var any = ms.filter(function (m) { return !m.quarter; });
    return head + top + '<div class="w353qs">' + cols + '</div>' +
      '<div class="w353any"><div class="w205lab">Any time in ' + E(fy) + '</div><div class="w353list">' + any.map(function (m) { return msHtml(m, g); }).join('') + '</div>' +
      (any.length ? '' : '<p class="w353none">Every ' + E(fy) + ' milestone sits in a quarter.</p>') + add(null) + '</div>';
  }
  function paintYears(gid) {
    var g = byId(S.goals, gid), box = document.querySelector('#w205 [data-w205years="' + gid + '"]'); if (!g || !box) return;
    var keep = {}; box.querySelectorAll('[data-w205k]').forEach(function (el) { var k = el.getAttribute('data-w205k'); if (S.dirty[k] || S.conflict[k]) keep[k] = el.value; });
    box.innerHTML = yearsHtml(g);
    Object.keys(keep).forEach(function (k) { var el = fieldEl(k); if (el) el.value = keep[k]; });
    box.querySelectorAll('textarea.w205ed').forEach(grow);
  }
  /* the year's ring follows the milestones without redrawing the panel */
  function paintRings(gid) {
    var g = byId(S.goals, gid); if (!g) return; var sel = selYear(g);
    yearList(g).forEach(function (fy) {
      var b = document.querySelector('#w205 [data-w353yr="' + gid + ':' + fy + '"]'); if (!b) return;
      var t = document.createElement('div'); t.innerHTML = bubbleHtml(g, fy, sel); var n = t.firstChild;
      b.className = n.className; b.setAttribute('aria-label', n.getAttribute('aria-label'));
      var fg = b.querySelector('.ring .fg'); if (fg) fg.style.setProperty('--o', ringOffset(msOf(gid).filter(function (m) { return m.fy === fy; })));
      var sm = b.querySelector('.t small'), sm2 = n.querySelector('.t small'); if (sm && sm2) sm.textContent = sm2.textContent;
    });
  }
  function celebrate(el) {
    try {
      if (!el) return;
      el.classList.remove('w353pop'); void el.offsetWidth; el.classList.add('w353pop');
      setTimeout(function () { el.classList.remove('w353pop'); }, 700);
      if (RM) return;
      var r = el.getBoundingClientRect(), box = document.createElement('div'); box.className = 'w353burst'; box.setAttribute('aria-hidden', 'true');
      box.style.left = (r.left + 20) + 'px'; box.style.top = (r.top + Math.min(r.height, 44) / 2) + 'px';
      var cols = [GOLD, TEAL, GREEN, '#F0CF73', PURPLE];
      for (var i = 0; i < 14; i++) {
        var s = document.createElement('i'), a = (Math.PI * 2 * i) / 14 + Math.random() * 0.35, d = 22 + Math.random() * 30;
        s.style.setProperty('--x', (Math.cos(a) * d).toFixed(1) + 'px'); s.style.setProperty('--y', (Math.sin(a) * d - 6).toFixed(1) + 'px');
        s.style.background = cols[i % cols.length]; s.style.animationDelay = Math.round(Math.random() * 50) + 'ms';
        box.appendChild(s);
      }
      document.body.appendChild(box); setTimeout(function () { box.remove(); }, 1000);
    } catch (e) { /* cosmetic */ }
  }
  function msDone(m) {
    var g = byId(S.goals, m.goal_id); if (!g) return;
    var list = msOf(g.id).filter(function (x) { return x.fy === m.fy; }), done = list.filter(function (x) { return x.status === 'done'; }).length;
    celebrate(document.querySelector('#w205 [data-w205ms="' + m.id + '"]'));
    paintRings(g.id);
    toastS(done === list.length ? 'Every ' + m.fy + ' milestone on goal ' + g.number + ' is done. That is the year.' : 'Milestone reached. ' + m.fy + ' on goal ' + g.number + ': ' + done + ' of ' + list.length + ' done.');
  }

  /* Key events: the fundraising events and drives that feed a goal */
  function evFy(e) {
    var d = e.start_date || e.end_date; if (d) return quarterOf(String(d)).fy;
    var m = /(fall|winter|spring|summer)-(\d{4})/.exec(e.season || ''); if (!m) return '';
    var y = Number(m[2]); return 'FY' + String(m[1] === 'fall' ? y + 1 : y).slice(2);
  }
  function eventsOf(gid) { return (S.events || []).filter(function (e) { return String(e.goal_id) === String(gid); }); }
  function evWhen(e) {
    if (e.start_date) return fmtDay(e.start_date);
    var m = /(fall|winter|spring|summer)-(\d{4})/.exec(e.season || ''); return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) + ' ' + m[2] : 'Date to set';
  }
  function evCard(e) {
    var t = Number(e.target_max || e.target_min || 0), r = e.raised != null ? Number(e.raised) : null, p = t ? pctOf(r || 0, t) : null, st = lower(e.status || 'planned');
    var pj = e.project_id ? byId(S.projects, e.project_id) : null, ms = e.milestone_id ? byId(S.milestones, e.milestone_id) : null;
    return '<div class="w353ev' + (st === 'done' ? ' done' : '') + (p != null && p >= 100 ? ' hit' : '') + '" data-w353ev="' + e.id + '">' +
      '<div class="eh"><b data-w198skip>' + E(e.title) + '</b><span class="w353st s-' + E(stKey(st)) + '">' + E(st.charAt(0).toUpperCase() + st.slice(1)) + '</span></div>' +
      '<div class="em">' + E(evWhen(e)) + (e.lead ? ' · <span data-w198skip>' + E(e.lead) + '</span>' : '') + (e.partners ? ' · <span data-w198skip>' + E(e.partners) + '</span>' : '') + '</div>' +
      (t ? '<div class="w353bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (p || 0) + '" aria-label="Raised against the target"><i style="--p:' + ((p || 0) / 100) + '"></i></div>' +
           '<div class="tg">' + (r != null ? '<b>' + fmtN(r, '$') + '</b> raised of ' : 'Target ') + fmtN(t, '$') + (e.target_min && e.target_max && Number(e.target_min) !== Number(e.target_max) ? ' (' + fmtN(e.target_min, '$') + ' to ' + fmtN(e.target_max, '$') + ')' : '') + (p != null && p >= 100 ? ' · target reached' : '') + '</div>'
         : (r != null ? '<div class="tg"><b>' + fmtN(r, '$') + '</b> raised</div>' : '<div class="tg muted">No target yet: set it in the Fundraising app</div>')) +
      '<div class="ef">' + (pj ? projChip(pj) : '') + (ms ? '<span class="w353msref" title="The milestone it serves" data-w198skip>' + I('flag') + E(clip(ms.body, 54)) + '</span>' : '') + '<span class="sp"></span>' +
      (canComment() ? '<button type="button" class="w205cnt" data-w353evlink="' + e.id + '" aria-label="Change what this event serves">' + I('link') + '</button>' : '') +
      '<a class="w205cnt" href="#fund/calendar" aria-label="Open it in the Fundraising app">' + I('ext') + '</a></div></div>';
  }
  function eventsHtml(g) {
    var list = eventsOf(g.id), now = thisFy();
    if (!list.length && !canComment()) return '';
    var sortE = function (a, b) { return String(a.start_date || evFy(a) || 'z').localeCompare(String(b.start_date || evFy(b) || 'z')); };
    var cur = list.filter(function (e) { var f = evFy(e); return !f || f >= now; }).sort(sortE), past = list.filter(function (e) { var f = evFy(e); return f && f < now; }).sort(sortE);
    var tg = cur.reduce(function (n, e) { return n + Number(e.target_max || e.target_min || 0); }, 0), rz = cur.reduce(function (n, e) { return n + Number(e.raised || 0); }, 0);
    return '<div class="w205h4"><h4>Key events <span style="font-family:' + BODY + ';font-size:13px;color:' + MUTED + ';text-transform:none">' + (list.length ? '(' + list.length + ')' : '') + '</span></h4>' +
      '<span style="font-size:12px;color:' + MUTED + '">Fundraising events and drives that feed this goal</span><span class="sp"></span>' +
      (canComment() ? '<button type="button" class="w205btn sm ghost" data-w353evadd="' + g.id + '">' + I('plus') + ' Link an event</button>' : '') + '</div>' +
      (cur.length ? '<p class="w353evsum">' + plural(cur.length, 'event') + ' this year and ahead' + (tg ? ' · ' + fmtN(rz, '$') + ' raised of ' + fmtN(tg, '$') + ' in targets so far' : ' · targets still to set') + '</p>' : '') +
      (cur.length ? '<div class="w353evs">' + cur.map(evCard).join('') + '</div>' : '<p class="w353none">No event feeds this goal yet.</p>') +
      (past.length ? '<details class="w353past"><summary>Earlier events (' + past.length + ')</summary><div class="w353evs">' + past.map(evCard).join('') + '</div></details>' : '');
  }
  function paintEvents() { S.goals.forEach(function (g) { var el = document.querySelector('#w205 [data-w353evbox="' + g.id + '"]'); if (el) el.innerHTML = eventsHtml(g); }); }
  function eventDrawer(st) {
    var e = st.event ? byId(S.events, st.event) : null;
    if (!e) {
      var g = byId(S.goals, st.goal), qv = lower(st.q || '');
      var list = (S.events || []).filter(function (x) { return String(x.goal_id) !== String(st.goal) && lower(x.season) !== 'backlog' && (!qv || lower(x.title + ' ' + (x.season || '')).indexOf(qv) >= 0); })
        .sort(function (a, b) { return String(a.start_date || evFy(a) || 'z').localeCompare(String(b.start_date || evFy(b) || 'z')); });
      var body = '<label class="w205search" style="max-width:none;margin:0 0 10px">' + I('search') + '<input type="search" data-w353evq value="' + E(st.q || '') + '" placeholder="Find an event" aria-label="Find an event" data-w205autofocus /></label>' +
        (list.length ? '<div class="w205pick">' + list.map(function (x) {
          var cur = x.goal_id ? byId(S.goals, x.goal_id) : null;
          return '<label data-w353evpick="' + x.id + '" tabindex="0" role="button"><span class="t"><span data-w198skip>' + E(x.title) + '</span><small>' + E(evWhen(x)) + ' · ' + (cur ? 'feeds goal ' + E(cur.number) : 'not linked to a goal yet') + '</small></span>' + I('plus') + '</label>';
        }).join('') + '</div>' : '<div class="w205empty"><b>No event matches</b>Events are added in the Fundraising app, on the calendar.</div>');
      return drawerShell('Link a key event', g ? '<span data-w198skip>To goal ' + E(g.number) + ': ' + E(g.title) + '</span>' : '', body, '<small style="color:' + MUTED + '">Events come from the Fundraising app. Linking one shows its target and what it raised on the goal.</small>');
    }
    var gsel = st.goalPick != null ? st.goalPick : e.goal_id, gg = byId(S.goals, gsel);
    var body2 = '<div class="w205th"><b data-w198skip>' + E(e.title) + '</b><div style="font-size:12.5px;color:' + MUTED + ';margin-top:2px">' + E(evWhen(e)) + (e.status ? ' · ' + E(e.status) : '') + '</div></div>' +
      '<div class="w205grp">The goal it feeds</div><div class="w205pick">' + S.goals.map(function (x) {
        var on = String(x.id) === String(gsel);
        return '<label class="' + (on ? 'on' : '') + '"><input type="radio" name="w353eg" data-w353evg="' + x.id + '"' + (on ? ' checked' : '') + ' /><span class="w205num" style="width:24px;height:24px;font-size:13px">' + E(x.number) + '</span><span class="t" data-w198skip>' + E(x.title) + '</span></label>';
      }).join('') + '</div>' +
      (gg ? '<div class="w205grp">The milestone (optional)</div><div class="w205pick"><label class="' + (!st.msPick ? 'on' : '') + '"><input type="radio" name="w353em" data-w353evm=""' + (!st.msPick ? ' checked' : '') + ' /><span class="t">The goal as a whole</span></label>' +
        msOf(gg.id).filter(function (m) { return m.fy !== 'FY31' && m.fy !== 'FY30'; }).map(function (m) {
          var on = String(st.msPick) === String(m.id);
          return '<label class="' + (on ? 'on' : '') + '"><input type="radio" name="w353em" data-w353evm="' + m.id + '"' + (on ? ' checked' : '') + ' /><span class="t"><span data-w198skip>' + E(m.body) + '</span><small>' + E(m.fy) + (m.quarter ? ' Q' + m.quarter : '') + '</small></span></label>';
        }).join('') + '</div>' : '');
    var foot = '<div class="acts" style="margin:0">' + (e.goal_id ? '<button type="button" class="w205btn sm ghost" data-w353evun="' + e.id + '">Unlink</button>' : '') + '<span class="sp"></span><button type="button" class="w205btn sm ghost" data-w205close="1">Cancel</button><button type="button" class="w205btn pri" data-w353evsave="' + e.id + '"' + (gg ? '' : ' disabled') + '>' + I('link') + ' Link it</button></div>';
    return drawerShell(e.goal_id ? 'Move or unlink a key event' : 'Link a key event', '<span data-w198skip>' + E(e.title) + '</span>', body2, foot);
  }
  function eventSave(eid, gid, mid) {
    return rpc('strategy_link_event', { p_event: Number(eid), p_goal: gid ? Number(gid) : null, p_milestone: mid ? Number(mid) : null }).then(function () {
      var e = byId(S.events, eid); if (e) { e.goal_id = gid ? Number(gid) : null; e.milestone_id = gid && mid ? Number(mid) : null; }
      closeDrawer(); paintEvents();
      var g = gid ? byId(S.goals, gid) : null;
      toastS(g ? 'It now feeds goal ' + g.number + '.' : 'Unlinked.');
    }).catch(function (x) { toastS('Not linked: ' + errText(x)); });
  }

  /* contributors: the leads whose teams carry the goal */
  function contribsOf(gid) { return (S.contribs || []).filter(function (c) { return String(c.goal_id) === String(gid); }).sort(function (a, b) { return (a.sort - b.sort) || (a.id - b.id); }); }
  function contribHtml(g) {
    var list = contribsOf(g.id), can = canEdit(g);
    if (!list.length && !can) return '';
    return '<span class="w353cl">Contributors</span>' + list.map(function (c) {
      var m = memberById(c.member_id) || { name: 'Someone' };
      return '<span class="w205chip">' + av(m, 22) + '<span data-w198skip>' + E(m.name) + '</span>' + (c.focus ? '<span class="focus" data-w198skip>' + E(c.focus) + '</span>' : '') + '</span>';
    }).join('') + (can ? '<button type="button" class="w205chip add" data-w353contrib="' + g.id + '">' + I(list.length ? 'people' : 'plus') + (list.length ? ' Contributors' : ' Contributor') + '</button>' : '');
  }
  function paintContribs(gid) { var el = document.querySelector('#w205 [data-w353contribs="' + gid + '"]'), g = byId(S.goals, gid); if (el && g) el.innerHTML = contribHtml(g); }
  function contribDrawer(st) {
    var g = byId(S.goals, st.goal); if (!g) return drawerShell('Contributors', '', '');
    var qv = lower(st.q || ''), list = contribsOf(g.id), ids = {}; list.forEach(function (c) { ids[c.member_id] = 1; });
    ownersOf(g.id).forEach(function (o) { ids[o.member_id] = 1; });
    var current = list.map(function (c) {
      var m = memberById(c.member_id) || { name: '?' };
      return '<div class="w205th" style="display:flex;align-items:center;gap:10px">' + av(m, 30) + '<div style="flex:1;min-width:0"><b data-w198skip>' + E(m.name) + '</b>' +
        '<label class="w205field" style="margin:6px 0 0;font-weight:600">What their team carries <input type="text" data-w353cfocus="' + c.member_id + '" value="' + E(c.focus || '') + '" placeholder="Optional, e.g. fundraising events" /></label></div>' +
        '<button type="button" class="w205btn sm ghost" data-w353coff="' + c.member_id + '">Take off</button></div>';
    }).join('');
    var pool = members().filter(function (m) { return m.active !== false && !ids[m.id] && (!qv || lower(m.name + ' ' + (m.role || '') + ' ' + deptLabel(m.department)).indexOf(qv) >= 0); })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }).slice(0, 40);
    var body = '<div class="w205grp">Contributors now</div>' + (current || '<p style="font-size:13px;color:' + MUTED + '">No contributor yet.</p>') +
      '<div class="w205grp">Add a contributor</div><label class="w205search" style="max-width:none;margin:0 0 8px">' + I('search') + '<input type="search" data-w353cq value="' + E(st.q || '') + '" placeholder="Find someone on the roster" aria-label="Find someone on the roster" data-w205autofocus /></label>' +
      '<div class="w205pick">' + pool.map(function (m) { return '<label data-w353con="' + m.id + '" tabindex="0" role="button">' + av(m, 26) + '<span class="t"><span data-w198skip>' + E(m.name) + '</span><small>' + E(m.role || deptLabel(m.department)) + '</small></span>' + I('plus') + '</label>'; }).join('') + '</div>';
    return drawerShell('Contributors', '<span data-w198skip>Goal ' + E(g.number) + ': ' + E(g.title) + '</span>', body, '<small style="color:' + MUTED + '">Contributors are the leads whose teams carry the goal. They comment and link work; owners and admins edit the goal.</small>');
  }
  function contribSet(gid, mid, on, focus) {
    return rpc('strategy_contributor_set', { p_goal: Number(gid), p_member: Number(mid), p_on: !!on, p_focus: focus == null ? null : focus }).then(function () {
      return Promise.resolve(db.from('goal_contributors').select('*').eq('goal_id', Number(gid))).then(function (r) {
        S.contribs = (S.contribs || []).filter(function (c) { return String(c.goal_id) !== String(gid); }).concat(((r && r.data) || []).filter(function (c) { return !c.removed_at; }));
        paintContribs(gid); if (S.drawer && S.drawer.kind === 'contrib') paintDrawer();
      });
    }).catch(function (e) { toastS('Not changed: ' + errText(e)); });
  }

  /* the link sheet: a project moves any number of milestones */
  function msPickHtml(gg, st, p) {
    if (!st.msPicks) {
      st.msPicks = projMs(p.id);
      if (p.milestone_id && st.msPicks.indexOf(String(p.milestone_id)) < 0) st.msPicks.push(String(p.milestone_id));
      if (st.msPick && st.msPicks.indexOf(String(st.msPick)) < 0) st.msPicks.push(String(st.msPick));
    }
    var mine = msOf(gg.id).filter(function (m) { return m.fy !== 'FY30' && (m.fy !== 'FY31' || W353.show31 || st.msPicks.indexOf(String(m.id)) >= 0); });
    var n = mine.filter(function (m) { return st.msPicks.indexOf(String(m.id)) >= 0; }).length;
    return '<div class="w205grp">The milestones it moves</div><p style="font-size:12.5px;color:' + MUTED + ';margin:0 0 6px" data-w353pickn>' + pickLine(n) + '</p><div class="w205pick">' +
      mine.map(function (m) {
        var on = st.msPicks.indexOf(String(m.id)) >= 0;
        return '<label class="' + (on ? 'on' : '') + '"><input type="checkbox" data-w353pickm="' + m.id + '"' + (on ? ' checked' : '') + ' /><span class="t"><span data-w198skip>' + E(m.body) + '</span><small>' + E(m.fy) + (m.quarter ? ' Q' + m.quarter : '') + (m.status === 'done' ? ' · done' : '') + '</small></span></label>';
      }).join('') + '</div>';
  }
  function pickLine(n) { return n ? plural(n, 'milestone') + ' picked. Its progress shows as the milestones it reaches.' : 'None picked: it serves the goal as a whole. Pick any number.'; }

  /* the events the page hands to wave353 */
  function w353Click(t, e) {
    var el;
    if ((el = t.closest('[data-w353yr]'))) {
      var a = el.getAttribute('data-w353yr').split(':'); flushAll(); W353.yr[a[0]] = a[1]; paintYears(a[0]);
      var b = document.querySelector('#w205 [data-w353yr="' + a[0] + ':' + a[1] + '"]'); if (b) try { b.focus({ preventScroll: true }); } catch (x) { /* fine */ }
      return true;
    }
    if ((el = t.closest('[data-w353fy31]'))) { flushAll(); W353.show31 = !W353.show31; lsSet('w353show31', W353.show31 ? '1' : null); S.goals.forEach(function (g) { paintYears(g.id); }); return true; }
    if ((el = t.closest('[data-w353refresh]'))) {
      el.disabled = true; el.textContent = 'Counting…';
      Promise.resolve(db.rpc('wa353_measures')).then(function (r) { if (r && r.error) throw r.error; S.mv = (r && r.data) || {}; S.mvErr = null; paint(); toastS('Counted again.'); })
        .catch(function (x) { el.disabled = false; el.textContent = 'Count again'; toastS('Not counted: ' + errText(x)); });
      return true;
    }
    if ((el = t.closest('[data-w353done]'))) {
      var sel = fieldEl(key('milestone', el.getAttribute('data-w353done'), 'status'));
      if (sel && !sel.disabled) { sel.value = 'done'; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); el.remove(); }
      return true;
    }
    if ((el = t.closest('[data-w353evadd]'))) { openDrawer({ kind: 'event', goal: el.getAttribute('data-w353evadd'), q: '' }); return true; }
    if ((el = t.closest('[data-w353evlink]'))) { var ev = byId(S.events, el.getAttribute('data-w353evlink')); if (ev) openDrawer({ kind: 'event', event: ev.id, goal: ev.goal_id, goalPick: ev.goal_id, msPick: ev.milestone_id }); return true; }
    if ((el = t.closest('[data-w353evpick]'))) { S.drawer.event = el.getAttribute('data-w353evpick'); S.drawer.goalPick = S.drawer.goal; S.drawer.msPick = null; paintDrawer(); return true; }
    if ((el = t.closest('[data-w353evsave]'))) { el.disabled = true; eventSave(el.getAttribute('data-w353evsave'), S.drawer.goalPick, S.drawer.msPick).then(function () { el.disabled = false; }); return true; }
    if ((el = t.closest('[data-w353evun]'))) { eventSave(el.getAttribute('data-w353evun'), null, null); return true; }
    if ((el = t.closest('[data-w353contrib]'))) { openDrawer({ kind: 'contrib', goal: el.getAttribute('data-w353contrib'), q: '' }); return true; }
    if ((el = t.closest('[data-w353con]'))) { contribSet(S.drawer.goal, el.getAttribute('data-w353con'), true, null); return true; }
    if ((el = t.closest('[data-w353coff]'))) { contribSet(S.drawer.goal, el.getAttribute('data-w353coff'), false, null); return true; }
    void e; return false;
  }
  function w353Change(t) {
    if (t.hasAttribute('data-w353q')) {
      var m = byId(S.milestones, t.getAttribute('data-w353q')); if (!m) return true;
      var q = t.value ? Number(t.value) : null; t.disabled = true;
      rpc('strategy_milestone_meta', { p_id: Number(m.id), p_quarter: q, p_measure_key: m.measure_key || null, p_target: m.target_value == null ? null : Number(m.target_value) }).then(function () {
        m.quarter = q; paintYears(m.goal_id);
        var box = document.querySelector('#w205 [data-w205ms="' + m.id + '"]'); if (box) { box.classList.add('w353pop'); setTimeout(function () { box.classList.remove('w353pop'); }, 600); }
        toastS(q ? 'Moved to Q' + q + '.' : 'Any time this year.');
      }).catch(function (x) { t.disabled = false; toastS('Not moved: ' + errText(x)); });
      return true;
    }
    if (t.hasAttribute('data-w353pickm') && S.drawer) {
      var id = t.getAttribute('data-w353pickm'), list = S.drawer.msPicks || (S.drawer.msPicks = []), i = list.indexOf(id);
      if (t.checked && i < 0) list.push(id); if (!t.checked && i >= 0) list.splice(i, 1);
      var lab = t.closest('label'); if (lab) lab.classList.toggle('on', t.checked);
      var gid = S.drawer.goalPick != null ? S.drawer.goalPick : S.drawer.goal;
      var n = msOf(gid).filter(function (x) { return list.indexOf(String(x.id)) >= 0; }).length, line = document.querySelector('#w205drawer [data-w353pickn]'); if (line) line.textContent = pickLine(n);
      return true;
    }
    if (t.hasAttribute('data-w353evg') && S.drawer) { S.drawer.goalPick = t.getAttribute('data-w353evg'); S.drawer.msPick = null; paintDrawer(); return true; }
    if (t.hasAttribute('data-w353evm') && S.drawer) { S.drawer.msPick = t.getAttribute('data-w353evm') || null; return true; }
    if (t.hasAttribute('data-w353cfocus') && S.drawer) { contribSet(S.drawer.goal, t.getAttribute('data-w353cfocus'), true, t.value); return true; }
    return false;
  }
  function w353Input(t) {
    var a = t.hasAttribute('data-w353evq') ? 'data-w353evq' : t.hasAttribute('data-w353cq') ? 'data-w353cq' : null;
    if (!a || !S.drawer) return false;
    S.drawer.q = t.value; clearTimeout(S.dT);
    S.dT = setTimeout(function () { paintDrawer(); var i = document.querySelector('#w205drawer [' + a + ']'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 150);
    return true;
  }
  /* ---------- end of wave353's block ---------- */

