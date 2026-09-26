
  /* ---------- the master calendar (#calendar) ---------- */
  function mast(id, crumb, title, blurb) {
    var sec = document.getElementById(id); if (!sec) return;
    var m = sec.querySelector(':scope > .w118mast');
    if (!m) { m = document.createElement('div'); m.className = 'w118mast'; m.setAttribute('data-w124', id); sec.insertBefore(m, sec.firstChild); }
    var html = '<div class="crumb">' + E(crumb) + '</div><h1>' + E(title) + '</h1><p>' + E(blurb) + '</p>';
    if (m.getAttribute('data-h') !== html) { m.innerHTML = html; m.setAttribute('data-h', html); }
  }
  function calHost() {
    var sec = document.getElementById('calendar'); if (!sec) return null;
    /* the board has no Home: the calendar sits in Strategy, without the volunteering and birthday layers */
    var bv = boardOk() && !staffOk();
    var hb = hasBoard();
    mast('calendar', bv ? 'Strategy' : 'Home', 'Calendar', bv ? (hb ? 'Board meetings, fundraising events, your meetings and marketing posts, in one place.' : 'Fundraising events, your meetings and marketing posts, in one place.') : 'Fundraising events, ' + (hb ? 'board dates, ' : '') + 'your meetings, marketing posts, volunteering and birthdays, in one place.');
    var h = document.getElementById('w124cal');
    if (!h) { h = document.createElement('div'); h.id = 'w124cal'; sec.appendChild(h); }
    return h;
  }
  function chipCounts(list) { var c = {}; list.forEach(function (x) { c[x.k] = (c[x.k] || 0) + 1; }); return c; }
  function evPill(it, compact) {
    var L = LAYER[it.k];
    return '<div class="w124ev' + (it.past ? ' past' : '') + (it.cancelled ? ' x' : '') + '" data-w124it="' + E(it.id) + '" style="--c:' + L.c + ';--bg:' + L.bg + ';--ink:' + L.ink + '" title="' + E(it.title + (it.time ? ', ' + it.time : '')) + '" tabindex="0" role="button">'
      + (it.k === 'bday' ? I('cake') : '') + (it.time && !compact ? '<b>' + E(it.time) + '</b>' : '') + '<span>' + E(it.title) + '</span></div>';
  }
  function monthHtml(list) {
    var s = monthStart(C.anchor), dow = (s.getDay() + 6) % 7, start = addDays(s, -dow), t = today();
    var byDay = {}; list.forEach(function (it) { (byDay[it.day] = byDay[it.day] || []).push(it); });
    var html = '<div class="w124grid">' + WD.map(function (d) { return '<div class="w124dow">' + d + '</div>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var d = addDays(start, i), key = ymd(d), evs = byDay[key] || [];
      var out = d.getMonth() !== s.getMonth();
      if (i === 35 && out) break;
      var shown = evs.slice(0, 3);
      html += '<div class="w124cell' + (out ? ' out' : '') + (sameDay(d, t) ? ' today' : '') + (((i % 7) >= 5) ? ' wk' : '') + '" data-day="' + key + '"><span class="dn">' + d.getDate() + '</span>'
        + shown.map(function (it) { return evPill(it, false); }).join('')
        + (evs.length > 3 ? '<a class="w124more" data-w124day="' + key + '">+' + (evs.length - 3) + ' more</a>' : '') + '</div>';
    }
    return html + '</div>';
  }
  function rowHtml(it) {
    var L = LAYER[it.k];
    return '<div class="w124row" data-w124it="' + E(it.id) + '" style="--c:' + L.c + '" tabindex="0" role="button"><span class="tm">' + (it.allDay ? (it.k === 'bday' ? 'Birthday' : 'All day') : E(it.time || '')) + '</span><div style="min-width:0"><div class="tt"><i></i>' + E(it.title) + '</div>' + (it.sub ? '<div class="mm">' + E(clip(it.sub, 120)) + '</div>' : '') + '</div></div>';
  }
  function agendaHtml(list) {
    var t = today(), tk = ymd(t), byDay = {}, days = [];
    list.forEach(function (it) { if (!byDay[it.day]) { byDay[it.day] = []; days.push(it.day); } byDay[it.day].push(it); });
    if (!days.length) return '<div class="w124ag"><p class="w124empty" style="padding:18px 20px">Nothing in ' + E(MONTHS[C.anchor.getMonth()]) + ' with these layers on.</p></div>';
    /* this month's agenda always has a today row, so you can see where you are */
    if (!byDay[tk] && C.anchor.getMonth() === t.getMonth() && C.anchor.getFullYear() === t.getFullYear()) { byDay[tk] = []; days.push(tk); days.sort(); }
    return '<div class="w124ag">' + days.map(function (k) {
      var d = parseDay(k);
      return '<div class="w124agd' + (sameDay(d, t) ? ' today' : '') + '" id="w124d' + k + '"><div class="dd"><b>' + d.getDate() + '</b><span>' + E(fmtDate(d, { weekday: 'short' })) + (sameDay(d, t) ? ', today' : '') + '</span></div><div>' + (byDay[k].length ? byDay[k].map(rowHtml).join('') : '<p class="w124empty" style="padding:9px 0">Nothing on today.</p>') + '</div></div>';
    }).join('') + '</div>';
  }
  function bandHtml(from, to) {
    var bs = bands(from, to); if (!bs.length) return '';
    return '<div class="w124band"><span class="lb">' + (C.view === 'month' ? 'This month' : 'Also this month') + '</span>' + bs.map(function (f) { return '<a data-w124fund="' + f.id + '">' + I('heart') + E(f.title) + ' <small>' + E(f.precision === 'month' ? 'all ' + MONTHS[parseDay(f.start_date).getMonth()] : (f.timing || '')) + '</small></a>'; }).join('') + '</div>';
  }
  function upNext() {
    var now = new Date(), t = today();
    var list = items(t, addDays(t, 35)).filter(function (it) { if (it.at) return it.at >= now || (it.day === ymd(t) && !it.past); return it.day >= ymd(t); }).slice(0, 7);
    list.forEach(function (it) { C.idx[it.id] = it; });
    if (!list.length) return '<p class="w124empty">Nothing coming up in the next five weeks with these layers on.</p>';
    return '<div class="w124up">' + list.map(function (it) { var d = parseDay(it.day); var copy = Object.assign({}, it); copy.time = (sameDay(d, t) ? 'Today' : sameDay(d, addDays(t, 1)) ? 'Tomorrow' : fmtDate(d, { month: 'short', day: 'numeric' })) + (it.time ? ' ' + it.time : ''); copy.allDay = false; return rowHtml(copy); }).join('') + '</div>';
  }
  function bdaysHtml() {
    var mo = C.anchor.getMonth(), m0 = me();
    var list = C.bdays.filter(function (b) { return b.month - 1 === mo; }).sort(function (a, b) { return a.day - b.day; });
    var mine = myBirthday();
    var rows = list.map(function (b) { var m = memberByEmail(b.email); var nm = m ? m.name : b.email.split('@')[0]; var isMe = lower(b.email) === m0.email; return '<div class="w124bd' + (isMe ? ' me' : '') + '"' + (m ? ' data-w124person="' + m.id + '" style="cursor:pointer"' : '') + '><span class="av">' + E(initials(nm)) + '</span><b>' + E(nm) + '</b><span>' + E(MONTHS[b.month - 1].slice(0, 3) + ' ' + b.day) + (isMe ? ', you' : '') + '</span></div>'; }).join('');
    return '<div class="w124card"><h3>Birthdays in ' + E(MONTHS[mo]) + '</h3>' + (rows || '<p class="w124empty">No birthdays this month yet.</p>')
      + (staffOk() ? '<p class="w124empty" style="margin-top:10px">' + (mine ? 'Yours is on ' + E(MONTHS[mine.month - 1] + ' ' + mine.day) + '. <a class="w124lnk" data-w124bday="1">Change it</a>' : '<a class="w124lnk" data-w124bday="1">+ Add your birthday</a> (month and day only; you choose who sees it).') + '</p>' : '') + '</div>';
  }
  function fundSideHtml() {
    var t = today();
    var next = C.fund.filter(function (f) { var s = parseDay(f.start_date), e = parseDay(f.end_date) || s; return s && e >= t && f.status !== 'cancelled' && f.status !== 'idea' && f.precision !== 'none'; }).sort(function (a, b) { return String(a.start_date).localeCompare(String(b.start_date)); }).slice(0, 4);
    return '<div class="w124card"><h3>Fundraising next<span class="lnk" data-w124go="#fundevents">events calendar</span></h3>' + (next.length ? next.map(function (f) { return '<div class="w124row" data-w124fund="' + f.id + '" style="--c:' + LAYER.fund.c + ';grid-template-columns:1fr"><div><div class="tt"><i></i>' + E(f.title) + '</div><div class="mm">' + E(fundWhen(f)) + (f.target_min ? ' · target ' + E(kMoney(f.target_min)) + (f.target_max ? ' to ' + E(kMoney(f.target_max)) : '') : '') + '</div></div></div>'; }).join('') : '<p class="w124empty">No fundraising events ahead.</p>') + '</div>';
  }
  function calPaint() {
    var h = calHost(); if (!h) return;
    var r = rangeFor(), grid = C.view === 'month';
    var from = grid ? r.from : monthStart(C.anchor), to = grid ? r.to : addMonths(C.anchor, 1);
    var list = items(from, to);
    C.idx = {}; list.forEach(function (it) { C.idx[it.id] = it; });
    var monthOnly = list.filter(function (it) { var d = parseDay(it.day); return d.getMonth() === C.anchor.getMonth(); });
    var cnt = chipCounts(monthOnly);
    var chips = LAYERS.filter(function (x) { if (x.k === 'board') return hasBoard(); return (x.k !== 'vol' && x.k !== 'bday') || staffOk(); }).map(function (x) { var on = C.layers[x.k]; return '<a class="w124chip' + (on ? '' : ' off') + '" data-w124layer="' + x.k + '" style="--c:' + x.c + ';--bg:' + x.bg + ';--ink:' + x.ink + '" role="switch" aria-checked="' + on + '" tabindex="0"><i></i>' + E(x.l) + (on && cnt[x.k] ? ' <span class="n">' + cnt[x.k] + '</span>' : '') + '</a>'; }).join('');
    var title = MONTHS[C.anchor.getMonth()] + ' ' + C.anchor.getFullYear();
    var html = '<div class="w124bar"><button type="button" class="w124btn ghost icon" data-w124nav="-1" aria-label="Previous month">' + I('chevl') + '</button><button type="button" class="w124btn ghost sm" data-w124nav="0">Today</button><button type="button" class="w124btn ghost icon" data-w124nav="1" aria-label="Next month">' + I('chevr') + '</button><h2>' + E(title) + '</h2><span class="sp"></span>'
      + '<span class="w124seg"><a data-w124view="month" class="' + (grid ? 'on' : '') + '">' + I('grid') + 'Month</a><a data-w124view="agenda" class="' + (!grid ? 'on' : '') + '">' + I('list') + 'Agenda</a></span></div>'
      + '<div class="w124layers" role="group" aria-label="Layers">' + chips + '</div>'
      + '<div class="w124wrap"><div style="min-width:0">' + bandHtml(monthStart(C.anchor), addMonths(C.anchor, 1)) + (grid ? monthHtml(list) : agendaHtml(monthOnly)) + '</div>'
      + '<div class="w124side"><div class="w124card"><h3>Up next</h3>' + upNext() + '</div>' + fundSideHtml() + (staffOk() ? bdaysHtml() : '') + '</div></div>';
    h.innerHTML = html;
    if (!grid && sameDay(monthStart(today()), monthStart(C.anchor))) { var el = document.getElementById('w124d' + ymd(today())); if (el && el.scrollIntoView && C.scrollOnce) { C.scrollOnce = false; el.scrollIntoView({ block: 'center' }); } }
  }
  async function calShow() {
    var h = calHost(); if (!h) return;
    if (!C.loadedBase) h.innerHTML = '<div class="w124card"><p class="w124empty">Loading the calendar…</p></div>';
    await loadBase();
    calPaint();
    await loadRange();
    if (onCal()) calPaint();
  }
  function onCal() { var a = document.querySelector('.panel.active'); return !!(a && a.id === 'calendar'); }
  function calItemById(id) { return (C.idx && C.idx[id]) || null; }
