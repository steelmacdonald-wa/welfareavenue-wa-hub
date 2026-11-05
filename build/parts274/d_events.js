
  /* ---------- small drawing helpers ---------- */
  var IC = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="m10 6-6 6 6 6"/><path d="M4 12h16"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    dots: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.2a1.7 1.7 0 0 0-1.7-1.7H6.2a1.7 1.7 0 0 0-1.7 1.7v7.6a1.7 1.7 0 0 0 1.7 1.7h2.3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    ext: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 13.5v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 6 6.5h4.5"/>',
    person: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
    pen: '<path d="m4 20 1.2-4.6L15.8 4.8a2.3 2.3 0 0 1 3.3 3.3L8.6 18.8z"/><path d="m14 6.6 3.3 3.3"/>',
    off: '<path d="M5 12h14"/>',
    wait: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24" fill="' + (n === 'dots' ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (IC[n] || '') + '</svg>'; }
  function andJoin(a) { a = a.filter(Boolean); if (a.length < 2) return a.join(''); return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function ratio(a, b) { if (!b) return a > 0 ? 1 : 0; return Math.max(0, Math.min(1, a / b)); }
  function barHtml(c) { return '<span class="w274bar" aria-hidden="true"><i class="w" data-x="' + ratio(c.yes + c.wait, c.target).toFixed(3) + '"></i><i class="c" data-x="' + ratio(c.yes, c.target).toFixed(3) + '"></i></span>'; }
  function barRow(c) { return '<div class="w274br"><span class="l">' + E(c.label) + '</span>' + barHtml(c) + '<span class="n">' + (c.yes + c.wait) + ' of ' + c.target + '</span></div>'; }
  /* the bars: they fill from the left on a page's first draw, and otherwise just stand at their value */
  function bars(scope, grow) {
    if (!scope) return;
    var els = Array.prototype.slice.call(scope.querySelectorAll('.w274bar i[data-x]'));
    if (!els.length) return;
    var set = function () { els.forEach(function (i) { i.style.transform = 'scaleX(' + i.getAttribute('data-x') + ')'; }); };
    if (grow && !reduced()) { void scope.offsetWidth; requestAnimationFrame(function () { requestAnimationFrame(set); }); return; }
    var bs = Array.prototype.slice.call(scope.querySelectorAll('.w274bar'));
    bs.forEach(function (b) { b.classList.add('w274now'); }); set(); void scope.offsetWidth; bs.forEach(function (b) { b.classList.remove('w274now'); });
  }
  /* a list rises in, 40 ms apart, on a page's first draw only */
  function rise(scope, sel) {
    if (!scope) return;
    var items = Array.prototype.slice.call(scope.querySelectorAll(sel)); if (!items.length) return;
    var still = reduced();
    items.forEach(function (el) { el.classList.add('w274st', 'w274pre'); });
    void scope.offsetWidth;
    items.forEach(function (el, i) { el.style.transitionDelay = still ? '0ms' : Math.min(i, 10) * 40 + 'ms'; el.classList.remove('w274pre'); });
    setTimeout(function () { items.forEach(function (el) { el.classList.remove('w274st'); el.style.transitionDelay = ''; }); }, 760);
  }
  function errLine(key, text) { return '<p class="w274err" data-w274err="' + E(key) + '" aria-live="polite">' + E(text || S.err[key] || '') + '</p>'; }
  function setErr(key, text) {
    S.err[key] = text || '';
    var els = document.querySelectorAll('[data-w274err="' + key + '"]');
    Array.prototype.forEach.call(els, function (el) { el.textContent = text || ''; });
  }
  function kitchenLine(e) { var k = String(e.kitchen_place || '').trim(), s = String(e.kitchen_shift || '').trim(); return k ? k + (s ? ', ' + s : '') : (s ? 'Kitchen not set, ' + s : 'Kitchen not booked yet'); }
  function mealsFor(e) {
    var planned = num(e.planned_meals, null);
    if (!S.recOk) return planned ? plural(planned, 'meal') + ' planned' : '';
    var rs = recsOf(e.id);
    if (!rs.length) return (planned ? plural(planned, 'meal') + ' planned. ' : '') + 'Who the meals go to is not set yet.';
    var parts = rs.filter(function (r) { return !r.private; }).map(function (r) { return String(r.name || '') + (r.meals != null ? ' (' + r.meals + ')' : ''); });
    var priv = rs.filter(function (r) { return r.private; });
    if (priv.length) { var pm = priv.reduce(function (s, r) { return s + num(r.meals, 0); }, 0); parts.push(plural(priv.length, 'organization') + ', not named publicly' + (pm ? ' (' + pm + ')' : '')); }
    return 'Meals for: ' + andJoin(parts);
  }
  function delivered(e) { var rs = recsOf(e.id).filter(function (r) { return r.meals_delivered != null && r.meals_delivered !== ''; }); return rs.length ? rs.reduce(function (s, r) { return s + num(r.meals_delivered, 0); }, 0) : null; }
  function relLine(e) { var d = daysTo(e.event_date), t = hm(e.start_time); return cap(rel(d)) + (t ? ', at ' + t : ''); }

  /* ---------- the masthead (wave118's): the page's title, its line, the way back. Its primary action is the app's own New event
     (APPS.toronto.actions): wave197 shows it at the masthead's right on a computer, the app bar shows it on a phone ---------- */
  function mastEl() {
    var panel = document.getElementById('toronto'); if (!panel) return null;
    var m = panel.querySelector(':scope > .w118mast');
    if (!m) { m = document.createElement('div'); m.className = 'w118mast'; m.setAttribute('data-w118', 'toronto'); m.innerHTML = '<div class="crumb">Operations Toronto</div><h1>Toronto Volunteers</h1><p></p>'; panel.insertBefore(m, panel.firstChild); }
    else if (panel.firstElementChild !== m) panel.insertBefore(m, panel.firstChild);
    return m;
  }
  function setMast(title, blurb, o) {
    o = o || {};
    var m = mastEl(); if (!m) return;
    var h1 = m.querySelector('h1'), p = m.querySelector(':scope > p');
    var hh = E(title) + (o.count != null ? ' <span class="w274cnt">' + E(o.count) + '</span>' : ''), want = title + (o.count != null ? ' ' + o.count : '');
    if (h1 && h1.textContent !== want) h1.innerHTML = hh;   /* the live text, so a rename by another wave is put right */
    if (p && p.textContent !== blurb) p.textContent = blurb;
    var b = m.querySelector(':scope > .w274back');
    if (o.back && !b) { b = document.createElement('a'); b.className = 'w274back'; b.href = '#toronto'; b.innerHTML = ic('back') + 'All events'; m.insertBefore(b, h1 || m.firstChild); }
    else if (!o.back && b) b.parentNode.removeChild(b);
  }

  /* ---------- Events (#toronto) ---------- */
  function heroHtml(e) {
    var st = stageOf(e), crews = crewOf(e), t = totals(crews);
    return '<a class="w274hero" href="#toronto/e/' + E(e.id) + '" data-w274ev="' + E(e.id) + '">' +
      '<div class="w274hl"><div class="w274ht"><span class="w274date">' + E(fmtDay(e.event_date)) + '</span><span class="w274chip stg">' + E(stageLabel(st)) + '</span></div>' +
      '<p class="w274rel">' + E(relLine(e)) + '</p>' +
      '<h3>' + E(titleOf(e)) + '</h3>' +
      '<p class="w274meta">' + E(kitchenLine(e)) + '</p>' +
      '<p class="w274meta">' + E(mealsFor(e)) + '</p></div>' +
      '<div class="w274hr"><p class="w274conf"><b>' + t.yes + '</b> of ' + t.target + ' confirmed</p>' + crews.map(barRow).join('') +
      '<p class="w274leg" aria-hidden="true"><span><i></i>Confirmed</span><span><i class="w"></i>Waiting</span></p></div></a>';
  }
  function cardHtml(e) {
    var off = lower(e.status) === 'cancelled', st = stageOf(e), crews = crewOf(e), t = totals(crews);
    return '<a class="w274card' + (off ? ' off' : '') + '" href="#toronto/e/' + E(e.id) + '" data-w274ev="' + E(e.id) + '">' +
      '<div class="w274ct"><span class="w274cd">' + E(fmtDay(e.event_date)) + '</span>' + (off ? '<span class="w274chip st-cancelled">Cancelled</span>' : '<span class="w274chip stg">' + E(stageLabel(st)) + '</span>') + '</div>' +
      '<p class="w274rel">' + E(relLine(e)) + '</p>' +
      '<h3>' + E(titleOf(e)) + '</h3>' +
      '<p class="w274meta">' + E(kitchenLine(e)) + '</p>' +
      '<p class="w274meta">' + E(mealsFor(e)) + '</p>' +
      (off ? '' : '<p class="w274cf"><b>' + t.yes + '</b> of ' + t.target + ' confirmed</p>' + crews.map(barRow).join('')) + '</a>';
  }
  function pastRow(e) {
    var s = lower(e.status), d = delivered(e);
    var m = s === 'cancelled' ? 'Cancelled' : d != null ? plural(d, 'meal') + ' delivered' : s === 'completed' ? 'Meals not counted' : 'Not wrapped up yet';
    return '<a class="w274prow" href="#toronto/e/' + E(e.id) + '" data-w274ev="' + E(e.id) + '"><span class="d">' + E(fmtDay(e.event_date)) + '</span><span class="t">' + E(titleOf(e)) + '</span><span class="m">' + E(m) + '</span></a>';
  }
  function eventsHtml() {
    if (!S.loaded) return '<p class="w274quiet" role="status">Loading the Toronto events…</p>';
    var t = todayIso();
    var all = S.events.slice().sort(function (a, b) { return String(a.event_date) < String(b.event_date) ? -1 : String(a.event_date) > String(b.event_date) ? 1 : num(a.id, 0) - num(b.id, 0); });
    var head = S.evErr ? '<p class="w274err" role="alert">Couldn’t load the Toronto events. Check your connection, then reload the page.</p>' : '';
    if (!all.length) return head + '<div class="w274empty"><h2>No Toronto events yet.</h2><p>Plan the first one: pick a date and a kitchen, then build the crew.</p><button type="button" class="w274btn pri" data-w274new="1">' + ic('plus') + 'New event</button></div>';
    var up = all.filter(function (e) { return String(e.event_date) >= t && isOpen(e); });
    var offUp = all.filter(function (e) { return String(e.event_date) >= t && lower(e.status) === 'cancelled'; });
    var past = all.filter(function (e) { return up.indexOf(e) < 0 && offUp.indexOf(e) < 0; }).reverse();
    var next = up[0], rest = up.slice(1).concat(offUp);
    var html = head + '<section class="w274blk" aria-labelledby="w274hnext"><h2 class="w274kick" id="w274hnext">Next event</h2>' +
      (next ? heroHtml(next) : '<div class="w274empty"><p>No upcoming event yet.</p><button type="button" class="w274btn pri" data-w274new="1">' + ic('plus') + 'New event</button></div>') + '</section>';
    if (rest.length) html += '<section class="w274blk" aria-labelledby="w274hup"><h2 class="w274h2" id="w274hup">Upcoming</h2><div class="w274grid">' + rest.map(cardHtml).join('') + '</div></section>';
    if (past.length) html += '<section class="w274blk" aria-labelledby="w274hpast"><h2 class="w274h2" id="w274hpast"><button type="button" class="w274fold" data-w274past="1" aria-expanded="' + (S.pastOpen ? 'true' : 'false') + '" aria-controls="w274pastl">' + ic('chev') + 'Past events (' + past.length + ')</button></h2>' +
      '<div id="w274pastl"' + (S.pastOpen ? '' : ' hidden') + '>' + past.map(pastRow).join('') + '</div></section>';
    return html;
  }
  function paintEvents(root, fresh) {
    setMast('Toronto events', 'Cook together, then bring the meals to the people who need them.', {});
    root.innerHTML = eventsHtml();
    bars(root, fresh);
    if (fresh) rise(root, '.w274hero, .w274card');
  }
