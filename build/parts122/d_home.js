
  /* ---------- the home page ---------- */
  function cardHtml(t, extra) {
    var k = KIND[kindOf(t)] || KIND.read, r = mine(t.id), done = r && r.status === 'done', pct = pctOf(t);
    var tags = [];
    if (extra && extra.tag) tags.push(extra.tag);
    if (r && r.assigned_by && !done) tags.push('<span class="tag gold">Assigned' + (r.assigned_by ? ' by ' + E(String(r.assigned_by).split(' ')[0]) : '') + '</span>');
    var p = pathOf(t); if (p && p.required && !done && !(extra && extra.noReq)) tags.push('<span class="tag purple">Required</span>');
    return '<button class="w122card" data-w122open="' + E(t.id) + '">' +
      '<div class="cv" style="' + coverStyle(t) + '">' +
      '<span class="big">' + ic(k.icon) + '</span><span class="kd">' + ic(k.icon) + ' ' + E(k.l) + '</span>' +
      (done ? '<span class="dn">' + ic('check') + '</span>' : '') + '</div>' +
      '<div class="bd"><b>' + E(t.title) + '</b><div class="m"><span>' + ic('clock') + ' ' + mins(minutesOf(t)) + (p ? ' &middot; ' + E(p.title) : (t.category ? ' &middot; ' + E(t.category) : '')) + '</span></div>' +
      (tags.length ? '<div class="tags">' + tags.join('') + '</div>' : '') +
      (!done && pct > 0 ? '<div class="pb"><i style="width:' + pct + '%"></i></div>' : '') + '</div></button>';
  }
  function topHtml() {
    return '<div class="w122top"><span class="crumb">People &middot; Training academy</span><span class="sp"></span>' +
      (TOURS.academy ? '<button class="w122btn soft sm" data-w122tour="academy">' + ic('map') + ' Tour this page</button>' : '') +
      (isLeader() ? '<button class="w122btn soft sm" data-w122add="1">' + ic('plus') + ' Add a training</button><a class="w122btn soft sm" href="#hrcentre/training">' + ic('people') + ' HR training board</a>' : '') +
      '<button class="w122btn ghost sm" data-w122classic="1" title="The previous Training page">Classic view</button></div>';
  }
  function onbHtml(o) {
    if (!o.org.has && !o.hub.has && !o.pol.has) return '';
    var m = me();
    if (o.all && !A.ui.onbOpen) {
      return '<section class="w122onb all" data-sec="onboarding"><div class="oh"><div class="done-seal">' + ic('check') + '</div><div><div class="eyebrow">Onboarding</div><h2>You are fully onboarded</h2>' +
        '<p>' + (o.when ? 'Completed ' + E(fmtDate(o.when)) + '. ' : '') + 'Your onboarding plan, the Hub first steps and your policies are all done.</p></div><span class="sp"></span>' +
        (A.myAwards['cert:onboarding'] ? '<button class="w122btn gold sm" data-w122cert="cert:onboarding">' + ic('seal') + ' Certificate</button>' : '') +
        '<button class="w122btn soft sm" data-w122onbx="1">Review</button></div>' +
        (o.org.pending && o.org.pending.length ? '<div class="w122tracks" style="grid-template-columns:1fr"><div class="w122trk">' + pendingHtml(o.org) + '</div></div>' : '') + '</section>';
    }
    var h = '<section class="w122onb" data-sec="onboarding"><div class="oh"><div><div class="eyebrow">Start here</div><h2>Onboarding</h2>' +
      '<p>Everything for your first weeks at Welfare Avenue, in one place: your onboarding plan, the Hub first steps and the policies to sign.</p></div><span class="sp"></span>' +
      '<div class="big">' + ring(o.pct, 96, 10, GOLD, 'rgba(16,63,57,.08)') + '<b>' + o.pct + '%</b></div>' +
      (o.all ? '<button class="w122btn soft sm" data-w122onbx="0">Collapse</button>' : '') + '</div><div class="w122tracks">';
    /* 1. the onboarding plan */
    var g = o.org;
    h += '<div class="w122trk" data-trk="plan"><div class="th"><div class="rg">' + ring(g.has ? g.pct : 0, 48, 5, GOLD) + '<i>' + (g.has ? g.pct + '%' : '–') + '</i></div><div><h3>Your onboarding plan</h3><div class="m">' +
      (g.has ? (g.complete ? 'Complete' + (g.completedAt ? ' · ' + E(fmtShort(g.completedAt)) : '') : (g.done + ' of ' + g.total + ' steps' + (g.week ? ' · ' + E(titleCase(g.week)) : ''))) : 'Week by week, set up by HR') + '</div></div></div>';
    if (!g.has) {
      h += '<div class="empty">HR has not assigned your onboarding plan yet. When they do, it appears here week by week' + (isLeader() ? '. Assign plans from the HR centre.' : ', so check back soon.') + '</div>';
      if (isLeader()) h += '<div class="foot"><a class="w122btn soft sm" href="#hrcentre/onboarding">' + ic('people') + ' Onboarding board</a></div>';
    } else {
      if (g.next) h += '<div class="nx"><div class="k">Next step</div>' + E(g.next.name) + '</div>';
      else if (g.complete) h += '<div class="nx"><div class="k">Done</div>Every step is ticked. Revisit the plan any time.</div>';
      if (g.pending && g.pending.length) h += pendingHtml(g);
      h += '<div class="foot"><button class="w122btn sm" data-w122onbopen="1">' + ic('list') + (g.complete ? ' View the plan' : ' Open my plan') + '</button>' + (isLeader() ? '<a class="w122btn soft sm" href="#hrcentre/onboarding">Board</a>' : '') + '</div>';
    }
    h += '</div>';
    /* 2. the Hub first steps */
    var u = o.hub;
    h += '<div class="w122trk" data-trk="hub"><div class="th"><div class="rg">' + ring(u.has ? u.pct : 0, 48, 5, TEAL) + '<i>' + (u.has ? u.done + '/' + u.total : '–') + '</i></div><div><h3>Hub first steps</h3><div class="m">' + (u.has ? (u.all ? 'All done' : 'Each one ticks itself when you do it') : 'Loading…') + '</div></div></div>';
    if (u.has) {
      h += '<div class="lst">' + u.list.map(function (s) {
        return '<div class="it' + (s.done ? ' done' : '') + '"><button class="ck' + (s.done ? ' on' : '') + '" data-w122hub="' + E(s.id) + '" title="' + (s.done ? 'Mark not done' : 'Mark done') + '">' + ic('check') + '</button>' +
          '<div class="tx"><b>' + E(s.t) + '</b>' + (s.done ? '' : '<span>' + E(s.d) + '</span><div class="ia"><button class="go" data-w122hubgo="' + E(s.id) + '">' + E(s.go) + '</button></div>') + '</div></div>';
      }).join('') + '</div>';
    }
    h += '<div class="foot"><button class="w122btn soft sm" data-w122tour="chrome">' + ic('map') + ' Take the 2 minute tour</button></div></div>';
    /* 3. policies */
    var p = o.pol;
    h += '<div class="w122trk" data-trk="policies"><div class="th"><div class="rg">' + ring(p.has ? p.pct : 0, 48, 5, PURPLE) + '<i>' + (p.has ? p.signed + '/' + p.total : '–') + '</i></div><div><h3>Policies to sign</h3><div class="m">' + (p.has ? (p.all ? 'All signed' : 'Read each one, then sign off') : 'Nothing to sign') + '</div></div></div>';
    if (p.has) {
      h += '<div class="lst">' + p.list.map(function (x) {
        return '<div class="it' + (x.at ? ' done' : '') + '"><span class="ck' + (x.at ? ' on' : '') + '">' + ic('check') + '</span><div class="tx"><b>' + E(x.t) + '</b><span>' + (x.at ? 'Signed ' + E(fmtShort(x.at)) : 'Your sign-off is recorded for HR with the date') + '</span><div class="ia">' +
          (x.url ? '<a class="go" href="' + E(x.url) + '" target="_blank" rel="noopener">' + (x.at ? 'Read again' : 'Open and read') + '</a>' : '') +
          (x.at ? '' : '<button class="go dark" data-w122sign="' + E(x.key) + '">I have read it</button>') + '</div></div></div>';
      }).join('') + '</div>';
    } else h += '<div class="empty">There are no policies waiting for you.</div>';
    h += '</div></div>';
    if (isLeader()) h += '<div class="hrrow"><span>HR tools:</span><a class="w122lnk" href="#hrcentre/onboarding">Onboarding board and master plan</a><a class="w122lnk" href="#hrcentre/training">Assign trainings in bulk</a></div>';
    return h + '</section>';
  }
  function titleCase(s) { return String(s || '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  function pendingHtml(g) {
    return '<div class="upd"><b>Updated since you finished (' + g.pending.length + ')</b>' + g.pending.map(function (t) {
      return '<div class="ur"><span>' + E(t.name) + '</span><button class="go" data-w122ack="' + E(t.id) + '" data-up="' + E(t.updated_at) + '">Got it</button></div>';
    }).join('') + '</div>';
  }
  function heroHtml(s) {
    var m = me(), lv = s.level;
    var hi = (s.done ? 'You have completed ' + plural(s.done, 'training') : 'Your learning starts here') + (s.streak > 1 ? ', and you are on a ' + s.streak + '-day streak.' : '.');
    var rings = '<svg width="180" height="180" viewBox="0 0 180 180" aria-hidden="true">' +
      ringArc(90, 80, 13, s.onb.total ? s.onb.pct : 100, GOLD) + ringArc(90, 62, 13, s.reqPct, '#5CD6B8') + ringArc(90, 44, 13, lv.pct, '#B3A8F5') + '</svg>';
    var h = '<section class="w122hero" data-sec="hero"><div><div class="eyebrow">Welfare Avenue</div><h1>Training academy</h1>' +
      '<div class="hi">Hi ' + E(m.name) + '. ' + E(hi) + '</div>' +
      '<div class="lvl"><span class="n">' + lv.n + '</span>Level ' + lv.n + ' &middot; ' + E(lv.name) + '</div>' +
      '<div class="xpbar"><i style="width:' + lv.pct + '%"></i></div><div class="xpt">' + s.xp.toLocaleString() + ' XP' + (lv.next ? ' &middot; ' + lv.toNext + ' to ' + E(lv.nextName) : ' &middot; top level') + '</div>' +
      '<div class="stats"><div class="st"><b>' + s.done + '</b><span>completed</span></div><div class="st"><b>' + s.certCount + '</b><span>' + (s.certCount === 1 ? 'certificate' : 'certificates') + '</span></div>' +
      '<div class="st"><b>' + s.badges.length + '<span style="font-size:13px;color:rgba(255,250,242,.6)">/' + BADGES.length + '</span></b><span>badges</span></div><div class="st fl"><b>' + s.streak + '</b><span>day streak</span></div></div></div>' +
      '<div class="rings"><div class="rs">' + rings + '<div class="ctr"><b>' + lv.n + '</b><span>level</span></div></div>' +
      '<div class="leg"><div><i style="background:' + GOLD + '"></i>Onboarding<b>' + (s.onb.total ? s.onb.pct + '%' : 'done') + '</b></div><div><i style="background:#5CD6B8"></i>Required learning<b>' + s.reqPct + '%</b></div><div><i style="background:#B3A8F5"></i>To level ' + (lv.next ? lv.n + 1 : lv.n) + '<b>' + lv.pct + '%</b></div></div></div></section>';
    if (A.welcome) h += '<div class="w122welcome">' + ic('sparkle') + '<div><b>Welcome to the new academy.</b> Your past work already counts: ' + plural(A.welcome, 'achievement') + ' unlocked.</div><span class="sp"></span><button class="w122btn sm" data-w122goto="trophies">See your trophies</button><button class="w122lnk" data-w122welcomex="1">Dismiss</button></div>';
    return h;
  }
  function ringArc(c, r, w, pct, color) {
    var cir = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct || 0));
    return '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="' + w + '"/>' +
      '<circle class="arc" cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-dasharray="' + cir.toFixed(2) + '" stroke-dashoffset="' + (cir * (1 - p / 100)).toFixed(2) + '" transform="rotate(-90 ' + c + ' ' + c + ')" style="transition:stroke-dashoffset 1.1s ' + EASE + '"/>';
  }
  function upNext(s) {
    var seen = {}, out = [];
    function add(t, tag) { if (!t || seen[t.id] || !visibleT(t) || isDone(t.id)) return; seen[t.id] = 1; out.push({ t: t, tag: tag }); }
    var n = me().name.toLowerCase();
    var mineRows = A.prog.filter(function (p) { return String(p.person_name).toLowerCase() === n && p.status !== 'done'; });
    mineRows.filter(function (p) { return p.started_at || p.pct; }).sort(function (a, b) { return String(b.updated_at || '').localeCompare(String(a.updated_at || '')); })
      .forEach(function (p) { add(A.byId[String(p.training_id)], '<span class="tag">In progress</span>'); });
    mineRows.filter(function (p) { return p.assigned_by; }).forEach(function (p) { add(A.byId[String(p.training_id)]); });
    s.paths.filter(function (ps) { return ps.p.required; }).forEach(function (ps) { add(ps.next); });
    s.paths.filter(function (ps) { return !ps.p.required && ps.p.dept && ps.p.dept === me().dept; }).forEach(function (ps) { add(ps.next, '<span class="tag">For your team</span>'); });
    ['chrome', 'home', 'team'].forEach(function (k) { add(A.byKey['tour:' + k]); });
    return out.slice(0, 10);
  }
  function nextHtml(s) {
    var list = upNext(s);
    if (!list.length) return '<section class="w122sec" data-sec="next"><div class="w122sech"><div><h2>Up next</h2><div class="sub">You are all caught up. Explore a path or the library below.</div></div></div></section>';
    return '<section class="w122sec" data-sec="next"><div class="w122sech"><div><h2>Up next</h2><div class="sub">What you started, what was assigned to you, and what is recommended.</div></div></div>' +
      '<div class="w122scroll">' + list.map(function (x) { return cardHtml(x.t, { tag: x.tag }); }).join('') + '</div></section>';
  }
  function pathsHtml(s) {
    var mineP = s.paths.filter(function (ps) { return ps.total && forMe(ps.p); }), other = s.paths.filter(function (ps) { return ps.total && !forMe(ps.p); });
    function one(ps) {
      var p = ps.p, col = p.color || GREEN, cert = A.myAwards['cert:' + p.key];
      return '<div class="w122path" data-w122path="' + E(p.key) + '" role="button" tabindex="0"><div class="pc" style="background:linear-gradient(135deg,' + E(col) + ',' + E(shade(col)) + ')"><span class="big">' + ic(p.icon || 'book') + '</span>' +
        '<div class="row">' + (p.required ? '<span class="chip">Required</span>' : '') + (p.dept && !p.required ? '<span class="chip">' + E(tabLabel(p.dept)) + '</span>' : '') + '<span class="chip">' + plural(ps.total, 'item') + '</span></div><h3>' + E(p.title) + '</h3></div>' +
        '<div class="pb2"><p>' + E(p.blurb || '') + '</p><div class="bar"><i style="width:' + ps.pct + '%;background:' + E(col) + '"></i></div>' +
        '<div class="ft2">' + (ps.complete ? '<span class="seal">' + ic('seal') + ' Certified' + (cert ? ' ' + E(fmtShort(cert.earned_at)) : '') + '</span>' : '<span>' + ps.done + ' of ' + ps.total + ' done' + (ps.minsLeft ? ' &middot; ' + mins(ps.minsLeft) + ' left' : '') + '</span>') +
        '<span class="sp"></span><span class="w122lnk">' + (ps.complete ? 'Review' : ps.done ? 'Continue' : 'Start') + ' ' + ic('arrow') + '</span></div></div></div>';
    }
    return '<section class="w122sec" data-sec="paths"><div class="w122sech"><div><h2>Learning paths</h2><div class="sub">Short series with a certificate at the end.</div></div></div>' +
      '<div class="w122paths">' + mineP.map(one).join('') + '</div>' +
      (other.length ? '<div class="w122sech" style="margin-top:22px"><div><h2 style="font-size:19px">More paths</h2><div class="sub">For other teams, open to everyone.</div></div></div><div class="w122paths">' + other.map(one).join('') + '</div>' : '') + '</section>';
  }
  function shade(hex) {
    var m = String(hex || '').match(/^#?([0-9a-f]{6})$/i); if (!m) return hex;
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function mix(c) { return Math.round(c + (255 - c) * 0.28); }
    return 'rgb(' + mix(r) + ',' + mix(g) + ',' + mix(b) + ')';
  }
  function toursHtml(s) {
    var list = A.trainings.filter(function (t) { return kindOf(t) === 'tour' && visibleT(t); }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    if (!list.length) return '';
    var done = list.filter(function (t) { return isDone(t.id); }).length;
    return '<section class="w122sec" data-sec="tours"><div class="w122sech"><div><h2>Page tours</h2><div class="sub">A guided walkthrough of every page you can open, section by section. Each takes a minute or two.</div></div></div>' +
      '<div class="w122tourbar">' + ic('map') + '<b>' + done + ' of ' + list.length + '</b><span>toured</span><div class="bar"><i style="width:' + Math.round(100 * done / list.length) + '%"></i></div><span style="color:#797773">Tour them all for the Hub Navigator certificate.</span></div>' +
      '<div class="w122tours">' + list.map(function (t) {
        var k = tourKeyOf(t), d = TOURS[k] || {}, ok = isDone(t.id);
        return '<button class="w122tile' + (ok ? ' on' : '') + '" data-w122tour="' + E(k) + '"><span class="ti">' + ic(ok ? 'check' : (d.icon || 'map')) + '</span><span><b>' + E(String(t.title).replace(/^Page tour:\s*/, '')) + '</b><span>' + (ok ? 'Toured' : mins(minutesOf(t))) + '</span></span></button>';
      }).join('') + '</div></section>';
  }
  function libList() {
    var q = A.ui.q.trim().toLowerCase();
    return A.trainings.filter(function (t) {
      if (!visibleT(t)) return false;
      var k = kindOf(t);
      if (A.ui.kind !== 'all' && k !== A.ui.kind) return false;
      if (A.ui.cat && t.category !== A.ui.cat && t.path_group !== A.ui.cat) return false;
      if (q && (String(t.title) + ' ' + String(t.description || '') + ' ' + String(t.category || '') + ' ' + String(t.path_group || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return String(a.category || '').localeCompare(String(b.category || '')) || (a.sort || 0) - (b.sort || 0) || a.id - b.id; });
  }
  function libGridHtml() {
    var list = libList(); var shown = list.slice(0, A.ui.libN);
    if (!list.length) return '<div class="w122none">Nothing matches. Try another word or filter.</div>';
    return '<div class="w122grid">' + shown.map(function (t) { return cardHtml(t, { noReq: true }); }).join('') + '</div>' +
      (list.length > shown.length ? '<div class="w122more"><button class="w122btn soft" data-w122more="1">Show ' + Math.min(24, list.length - shown.length) + ' more of ' + list.length + '</button></div>' : '');
  }
  function libHtml() {
    var kinds = [['all', 'All'], ['video', 'Videos'], ['lesson', 'Lessons'], ['read', 'Reading'], ['doc', 'Documents'], ['tour', 'Tours']];
    var groups = {}; A.trainings.forEach(function (t) { if (t.category) groups[t.category] = 1; });
    return '<section class="w122sec" data-sec="library"><div class="w122sech"><div><h2>Library</h2><div class="sub">Every training: videos, lessons, reading and documents.</div></div></div>' +
      '<div class="w122lib"><div class="w122seg">' + kinds.map(function (k) { return '<button data-w122kind="' + k[0] + '" class="' + (A.ui.kind === k[0] ? 'on' : '') + '">' + k[1] + '</button>'; }).join('') + '</div>' +
      '<select class="w122sel" data-w122cat="1"><option value="">All topics</option>' + Object.keys(groups).sort().map(function (c) { return '<option value="' + E(c) + '"' + (A.ui.cat === c ? ' selected' : '') + '>' + E(c) + '</option>'; }).join('') + '</select>' +
      '<label class="w122srch">' + ic('search') + '<input type="search" data-w122q="1" placeholder="Search the library" value="' + E(A.ui.q) + '"></label></div>' +
      '<div id="w122libgrid">' + libGridHtml() + '</div></section>';
  }
  function badgeMedal(b, earned) {
    return '<div class="w122bdg' + (earned ? '' : ' lock') + '" title="' + E(b.d) + '"><div class="md" style="background:linear-gradient(135deg,' + b.c + ',' + shade(b.c) + ')">' + ic(earned ? b.icon : 'lock') + '</div><b>' + E(b.t) + '</b><span>' + (earned ? 'Earned ' + E(fmtShort(earned.earned_at)) : E(b.d)) + '</span></div>';
  }
  function trophiesHtml(s) {
    var certRows = [];
    var onbA = A.myAwards['cert:onboarding'];
    if (s.onb.org.has) certRows.push({ key: 'cert:onboarding', t: 'Welfare Avenue Onboarding', d: 'Finish your plan, the Hub first steps and your policies', a: onbA });
    s.paths.filter(function (ps) { return ps.total; }).forEach(function (ps) { certRows.push({ key: 'cert:' + ps.p.key, t: ps.p.cert_title || ps.p.title, d: ps.done + ' of ' + ps.total + ' in ' + ps.p.title, a: A.myAwards['cert:' + ps.p.key] }); });
    certRows.sort(function (a, b) { return (b.a ? 1 : 0) - (a.a ? 1 : 0); });
    return '<section class="w122sec" data-sec="trophies" id="w122trophies"><div class="w122sech"><div><h2>Trophy case</h2><div class="sub">Certificates you can print or share, and badges for the way you learn.</div></div></div>' +
      '<div class="w122troph"><div class="w122shelf"><h3>Certificates</h3><div class="w122certs">' + certRows.map(function (c) {
        return c.a ? '<button class="w122mc" data-w122cert="' + E(c.key) + '"><span class="sl">' + ic('seal') + '</span><span class="k">Certificate</span><b>' + E(c.t) + '</b><span>Awarded ' + E(fmtDate(c.a.earned_at)) + '</span></button>'
          : '<div class="w122mc lock"><span class="sl">' + ic('lock') + '</span><span class="k">Certificate</span><b>' + E(c.t) + '</b><span>' + E(c.d) + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="w122shelf"><h3>Badges &middot; ' + s.badges.length + ' of ' + BADGES.length + '</h3><div class="w122badges">' + BADGES.map(function (b) { return badgeMedal(b, A.myAwards['badge:' + b.id] || (s.badges.indexOf(b) >= 0 ? { earned_at: nowIso() } : null)); }).join('') + '</div></div></div></section>';
  }
  function awardVisual(a) {
    var meta = a.meta || {};
    if (a.kind === 'cert') return { icon: 'seal', color: meta.color || GOLD };
    if (a.kind === 'level') return { icon: 'bolt', color: PURPLE };
    var b = BADGES.filter(function (x) { return 'badge:' + x.id === a.award; })[0];
    return { icon: (b && b.icon) || meta.icon || 'star', color: (b && b.c) || meta.color || TEAL };
  }
  function feedHtml() {
    /* one line per achievement that matters: the highest level per person, and at most three lines per person */
    var topLv = {}; A.awards.forEach(function (a) { if (a.kind === 'level') { var k = String(a.person_name).toLowerCase(), n = Number((a.meta || {}).n) || 0; if (!topLv[k] || n > topLv[k]) topLv[k] = n; } });
    var per = {}, list = [];
    A.awards.slice().sort(function (a, b) { return String(b.earned_at || '').localeCompare(String(a.earned_at || '')); }).forEach(function (a) {
      var k = String(a.person_name).toLowerCase();
      if (a.kind === 'level' && (Number((a.meta || {}).n) || 0) !== topLv[k]) return;
      if (a.kind === 'level' && (Number((a.meta || {}).n) || 0) < 3) return;
      per[k] = (per[k] || 0) + 1; if (per[k] > 3 || list.length >= 10) return;
      list.push(a);
    });
    if (!list.length) return '';
    var colors = [GREEN, PURPLE, '#B9851B', TEAL, FLAG, STEM];
    return '<section class="w122sec" data-sec="feed"><div class="w122sech"><div><h2>Recently earned</h2><div class="sub">Celebrate each other: what people across Welfare Avenue achieved.</div></div></div><div class="w122feed">' +
      list.map(function (a, i) {
        var v = awardVisual(a), nm = String(a.person_name || '');
        var verb = a.kind === 'cert' ? 'earned the <b>' + E(a.title) + '</b> certificate' : a.kind === 'level' ? 'reached <b>' + E(a.title) + '</b>' : 'unlocked <b>' + E(a.title) + '</b>';
        return '<div class="w122fr"><span class="av" style="background:' + colors[nm.length % colors.length] + '">' + E(initials(nm)) + '</span><div class="tx"><b>' + E(nm) + '</b> ' + verb + '<span>' + E(ago(a.earned_at)) + '</span></div><span class="aw" style="background:linear-gradient(135deg,' + v.color + ',' + shade(v.color) + ')">' + ic(v.icon) + '</span></div>';
      }).join('') + '</div></section>';
  }
  function homeHtml() {
    if (!staffOk()) return '<div class="w122none">The Training academy is available to staff accounts.</div>';
    if (A.err && !A.trainings.length) return topHtml() + '<div class="w122none">The academy could not load (' + E(A.err) + '). <button class="w122lnk" data-w122reload="1">Try again</button></div>';
    var s = stats();
    return topHtml() + onbHtml(s.onb) + heroHtml(s) + nextHtml(s) + pathsHtml(s) + toursHtml(s) + libHtml() + trophiesHtml(s) + feedHtml();
  }
  var paintQ = null;
  function paint() {
    var root = document.getElementById('w122'); if (!root) return;
    if (!A.loaded) {
      if (!root.__skel) { root.innerHTML = '<div class="w122none" style="margin-top:20px">Loading the academy…</div>'; root.__skel = 1; }
      load().then(function () { root.__skel = 0; paint(); after(); });
      return;
    }
    var active = document.activeElement, focusQ = active && active.getAttribute && active.getAttribute('data-w122q');
    var html = homeHtml();
    if (root.__h !== html) {
      root.innerHTML = html; root.__h = html;
      if (focusQ) { var inp = root.querySelector('[data-w122q]'); if (inp) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { /* fine */ } } }
    }
  }
  function paintSoon() { if (paintQ) return; paintQ = setTimeout(function () { paintQ = null; paint(); }, 60); }
  /* after the first paint: persist what the person has already earned, once */
  var afterDone = false;
  function after() {
    if (afterDone || !A.loaded) return; afterDone = true;
    evaluate({ celebrate: false }).then(function () { paint(); });
  }
