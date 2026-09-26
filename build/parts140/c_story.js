  /* ======================= Our story (#ourstory) ======================= */
  var BLURB_S = 'What Welfare Avenue has done since March 2020, from our own documents, posts and designs. Every moment shows where it came from.';
  function visibleHist() {
    var lead = isLeaderUI();
    return (S.hist || []).filter(function (h) { return h.status !== 'hidden' || (lead && S.ui.hidden); });
  }
  function histMatch(h) {
    var u = S.ui;
    if (u.kind && h.kind !== u.kind) return false;
    if (u.city && fold(h.city) !== fold(u.city)) return false;
    if (u.q) {
      var hay = fold([h.title, h.summary, h.city, (h.partners || []).join(' '), numbersText(h.numbers), (h.date_start || '').slice(0, 4)].join(' '));
      var ok = fold(u.q).split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) >= 0; });
      if (!ok) return false;
    }
    return true;
  }
  function yearOf(h) { return String(h.date_start || '').slice(0, 4); }
  function statsHtml() {
    var hs = visibleHist(), first = 2020, last = yearNow();
    var nYears = Math.max(1, last - first + 1);
    return '<div class="w140stats">' +
      '<div class="w140st"><b>' + nYears + '</b><span>years in our story, ' + first + ' to ' + last + '</span></div>' +
      '<button class="w140st" data-w140go="#ourstory"><b>' + hs.length + '</b><span>moments in our story</span></button>' +
      '<button class="w140st" data-w140go="#partners"><b>' + ((S.partners || []).filter(function (p) { return p.status === 'active' || p.status === 'past'; }).length || '–') + '</b><span>organizations we have worked with</span></button>' +
      '<button class="w140st" data-w140go="#ourstory/lessons"><b>' + ((S.lessons || []).filter(function (l) { return l.status !== 'hidden'; }).length || '–') + '</b><span>lessons learned</span></button></div>';
  }
  function tabsHtml() {
    var t = S.ui.tab;
    return '<nav class="w140tabs" role="tablist"><button role="tab" class="' + (t === 'timeline' ? 'on' : '') + '" data-w140go="#ourstory">' + I('book') + ' Timeline</button>' +
      '<button role="tab" class="' + (t === 'lessons' ? 'on' : '') + '" data-w140go="#ourstory/lessons">' + I('bulb') + ' Lessons learned</button></nav>';
  }
  function hlHtml(hs) {
    var hl = hs.filter(function (h) { return h.highlight && h.status !== 'hidden'; });
    if (!hl.length) return '';
    return '<div class="w140card"><h3>Milestones <span>The moments that shaped Welfare Avenue. Click one to find it in the timeline.</span></h3><div class="w140hl">' +
      hl.map(function (h) { return '<button class="w140hc" data-w140ev="' + E(h.id) + '"><span class="y">' + E(yearOf(h)) + '</span><b>' + E(h.title) + '</b><span>' + E(fmtRange(h)) + '</span></button>'; }).join('') + '</div></div>';
  }
  function barHtml(hs) {
    var u = S.ui, counts = {}, cities = {};
    hs.forEach(function (h) { counts[h.kind] = (counts[h.kind] || 0) + 1; if (h.city) cities[h.city] = (cities[h.city] || 0) + 1; });
    var lead = isLeaderUI(), nHidden = (S.hist || []).filter(function (h) { return h.status === 'hidden'; }).length;
    return '<div class="w140bar"><div class="w140chips">' + chip(!u.kind, 'data-w140kind', '', 'Everything', hs.length) +
      KIND_ORDER.filter(function (k) { return counts[k]; }).map(function (k) { return chip(u.kind === k, 'data-w140kind', k, KINDS[k][0], counts[k], KINDS[k][1]); }).join('') + '</div>' +
      '<select class="w140sel" data-w140city aria-label="City"><option value="">Every city</option>' + Object.keys(cities).sort().map(function (c) { return '<option' + (lower(u.city) === lower(c) ? ' selected' : '') + ' value="' + E(c) + '">' + E(c) + '</option>'; }).join('') + '</select>' +
      '<div class="w140q">' + I('search') + '<input type="search" data-w140q="story" placeholder="Search the story" value="' + E(u.q) + '" aria-label="Search the story"></div>' +
      '<button class="w140btn soft" data-w140order="1" title="Change the order">' + I(u.order === 'asc' ? 'down' : 'up') + (u.order === 'asc' ? ' Oldest first' : ' Newest first') + '</button>' +
      (lead ? '<button class="w140btn" data-w140add="hist">' + I('plus') + ' Add a moment</button>' + (nHidden ? '<button class="w140btn ghost" data-w140hidden="1">' + I(S.ui.hidden ? 'eyeoff' : 'eye') + (S.ui.hidden ? ' Hide the hidden' : ' Show hidden (' + nHidden + ')') + '</button>' : '') : '') + '</div>';
  }
  function partnerChips(names) {
    return (names || []).map(function (n) {
      var p = partnerFor(n);
      return p ? '<button class="w140pl" data-w140partner="' + E(p.id) + '">' + E(n) + '</button>' : '<span class="w140pl">' + E(n) + '</span>';
    }).join(' ');
  }
  function evHtml(h) {
    var k = KINDS[h.kind] || ['Moment', GREEN], lead = isLeaderUI();
    var meta = [];
    if (h.date_precision !== 'day' || h.date_end) meta.push('<span>' + E(fmtRange(h)) + '</span>');
    if (h.city) meta.push('<span>' + I('pin') + ' ' + E(h.city) + '</span>');
    var nums = numbersText(h.numbers); if (nums) meta.push('<span><b>' + E(nums) + '</b></span>');
    if (h.partners && h.partners.length) meta.push('<span>' + partnerChips(h.partners) + '</span>');
    return '<li class="w140ev' + (h.highlight ? ' hl' : '') + (h.status === 'hidden' ? ' hid' : '') + '" id="w140e' + E(h.id) + '" data-w140id="' + E(h.id) + '">' +
      '<div class="d">' + E(fmtSide(h.date_start, h.date_precision)) + '</div><div class="ln"><i style="background:' + k[1] + '"></i></div><div class="c">' +
      '<div class="t">' + (h.highlight ? I('star', 'st') + ' ' : '') + E(h.title) + '<span class="w140kd" style="color:' + k[1] + ';background:' + k[1] + '1f">' + E(k[0]) + '</span>' +
      (h.visibility === 'leadership' ? '<span class="w140tag lead">' + I('lock') + 'Leaders and directors</span>' : '') + (h.status === 'hidden' ? '<span class="w140tag hid">Hidden</span>' : '') + '</div>' +
      (h.summary ? '<p>' + E(h.summary) + '</p>' : '') + (meta.length ? '<div class="w140m">' + meta.join('') + '</div>' : '') +
      '<div class="w140m">' + srcHtml(h.sources) + (lead ? '<button class="w140mini" data-w140edit="hist" data-id="' + E(h.id) + '">' + I('edit') + ' Edit</button>' : '') + '</div></div></li>';
  }
  function yearsHtml(hs) {
    var u = S.ui, by = {}, order = [];
    hs.filter(histMatch).forEach(function (h) { var y = yearOf(h); if (!by[y]) { by[y] = []; order.push(y); } by[y].push(h); });
    order.sort(); if (u.order === 'desc') order.reverse();
    if (!order.length) return '<div class="w140empty">Nothing matches. Try another word, or show everything.</div>';
    var ysum = {}; (S.years || []).forEach(function (y) { ysum[String(y.year)] = y; });
    var lead = isLeaderUI();
    var nav = order.length > 1 ? '<div class="w140yn" aria-label="Jump to a year">' + order.map(function (y) { return '<button data-w140year="' + E(y) + '">' + E(y) + '</button>'; }).join('') + '</div>' : '';
    return nav + order.map(function (y) {
      var list = by[y].slice().sort(function (a, b) { return String(a.date_start).localeCompare(String(b.date_start)) || (a.id - b.id); });
      if (u.order === 'desc') list.reverse();
      var ys = ysum[y];
      return '<section class="w140year" id="w140y' + E(y) + '"><div class="yh"><h2>' + E(y) + '</h2><div>' + (ys && ys.summary ? '<p>' + E(ys.summary) + '</p>' : '') +
        (lead ? '<button class="w140mini" data-w140edit="year" data-id="' + E(y) + '">' + I('edit') + (ys ? ' Edit the year' : ' Add a line about the year') + '</button>' : '') + '</div></div>' +
        '<ol class="w140tl">' + list.map(evHtml).join('') + '</ol></section>';
    }).join('');
  }

  /* ---- Lessons learned ---- */
  function lessonsHtml() {
    var u = S.ui, lead = isLeaderUI();
    var all = (S.lessons || []).filter(function (l) { return l.status !== 'hidden' || lead; });
    var counts = {}; all.forEach(function (l) { counts[l.area] = (counts[l.area] || 0) + 1; });
    var list = all.filter(function (l) {
      if (u.lArea && l.area !== u.lArea) return false;
      if (u.lq) { var hay = fold([l.lesson, l.context, l.topic, l.area, l.years].join(' ')); if (!fold(u.lq).split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) >= 0; })) return false; }
      return true;
    }).sort(function (a, b) { return String(a.area).localeCompare(String(b.area)) || String(a.topic || '').localeCompare(String(b.topic || '')); });
    var bar = '<div class="w140bar"><div class="w140chips">' + chip(!u.lArea, 'data-w140area', '', 'Every area', all.length) +
      AREAS.filter(function (a) { return counts[a[0]]; }).map(function (a) { return chip(u.lArea === a[0], 'data-w140area', a[0], a[1], counts[a[0]]); }).join('') + '</div>' +
      '<div class="w140q">' + I('search') + '<input type="search" data-w140q="lessons" placeholder="Search the lessons" value="' + E(u.lq) + '" aria-label="Search the lessons"></div>' +
      (lead ? '<button class="w140btn" data-w140add="lesson">' + I('plus') + ' Add a lesson</button>' : '') + '</div>';
    var intro = '<div class="w140card"><h3>What we learned <span>Advice from Welfare Avenue’s own events, programs and campaigns: what happened, and what to do next time.</span></h3></div>';
    if (!list.length) return intro + bar + '<div class="w140empty">No lesson matches. Try another word or area.</div>';
    var areaLabel = {}; AREAS.forEach(function (a) { areaLabel[a[0]] = a[1]; });
    return intro + bar + '<div class="w140lg">' + list.map(function (l) {
      return '<article class="w140lc' + (l.status === 'hidden' ? ' hid' : '') + '" data-w140lesson="' + E(l.id) + '"><div class="ls">' + E(l.lesson) + '</div>' + (l.context ? '<div class="cx">' + E(l.context) + '</div>' : '') +
        '<div class="ft"><span class="w140tag">' + E(areaLabel[l.area] || l.area) + '</span>' + (l.topic ? '<span class="w140tag" style="background:rgba(220,165,39,.16);color:#7a5a12">' + E(l.topic) + '</span>' : '') +
        (l.years ? '<span class="w140count">' + E(l.years) + '</span>' : '') + (l.visibility === 'leadership' ? '<span class="w140tag lead">' + I('lock') + 'Leaders</span>' : '') + (l.status === 'hidden' ? '<span class="w140tag hid">Hidden</span>' : '') + '</div>' +
        '<div class="w140m">' + srcHtml(l.sources) + (lead ? '<button class="w140mini" data-w140edit="lesson" data-id="' + E(l.id) + '">' + I('edit') + ' Edit</button>' : '') + '</div></article>';
    }).join('') + '</div>';
  }

  function paintStory() {
    var root = mastFor('ourstory', 'Resources', 'Our story', BLURB_S); if (!root) return;
    if (!S.hist || !S.lessons) { root.innerHTML = busy('Loading our story…'); return; }
    if (S.err.hist && !S.hist.length) { root.innerHTML = '<div class="w140empty">Our story could not load (' + E(S.err.hist) + ').</div>'; return; }
    var hs = visibleHist();
    var focus = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-w140q') : null;
    var caret = focus && document.activeElement.selectionStart;
    var html = statsHtml() + tabsHtml();
    if (S.ui.tab === 'lessons') html += lessonsHtml();
    else html += hlHtml(hs) + barHtml(hs) + yearsHtml(hs);
    root.innerHTML = html;
    if (focus) { var inp = root.querySelector('[data-w140q="' + focus + '"]'); if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) { /* fine */ } } }
  }
  function openStory(h) {
    var rest = String(h || '').split('/').slice(1);
    S.ui.tab = rest[0] === 'lessons' ? 'lessons' : 'timeline';
    Promise.all([load('hist'), load('years'), load('lessons'), load('partners')]).then(function () {
      paintStory();
      if (rest[0] === 'e' && rest[1]) flashEv(rest[1]);
      else if (/^\d{4}$/.test(rest[0] || '')) { var y = document.getElementById('w140y' + rest[0]); if (y) y.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    paintStory();
  }
  function flashEv(id) {
    var h = (S.hist || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (h && (S.ui.kind || S.ui.q || S.ui.city)) { S.ui.kind = ''; S.ui.q = ''; S.ui.city = ''; paintStory(); }
    var el = document.getElementById('w140e' + id); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
