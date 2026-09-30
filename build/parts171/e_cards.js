
  /* ---------- the Volunteering calendar: the format on each upcoming serving ---------- */
  function decorateCalendar() {
    var sec = document.getElementById('volunteering'); if (!sec) return;
    var today = todayIso();
    sec.querySelectorAll('.vl-ev[data-vlev]').forEach(function (el) {
      var e = ((typeof WA_VOL_EVENTS !== 'undefined' ? WA_VOL_EVENTS : []) || []).filter(function (x) { return String(x.id) === el.getAttribute('data-vlev'); })[0];
      if (!e || (e.kind || 'service') !== 'service' || e.event_date < today || e.status === 'cancelled') return;
      var want = e.format ? '<span class="w171fmt cal">' + E(FORMATS[e.format] || e.format) + '</span>' : '';
      var old = el.querySelector('.w171fmt'); if (old && old.outerHTML === want) { /* same */ } else { if (old) old.remove(); if (want) el.insertAdjacentHTML('beforeend', want); }
      var gaps = el.querySelector('.w119gaps');
      if (gaps) {
        var g = gaps.querySelector('.w171gap');
        if (!e.format && !g) gaps.insertAdjacentHTML('beforeend', '<span class="w171gap">format not set</span>');
        if (e.format && g) g.remove();
        var byl = gaps.querySelector('.w171byl');
        var n = Number(e.roster_by_link || 0);
        if (n && !byl) gaps.insertAdjacentHTML('beforeend', '<span class="ok w171byl">' + n + ' by text</span>');
      }
    });
  }

  /* ---------- Home and the Executive dashboard: the next serving's confirmations (staff) ---------- */
  async function loadNext(force) {
    if (!force && S.next && Date.now() - S.nextAt < 60000) return S.next;
    try {
      var today = todayIso();
      var r = await db.from('volunteer_event_summary').select('id,code,event_date,title,location,status,kind,format,roster_count,roster_confirmed,roster_by_link,roster_declined,roster_texted').eq('kind', 'service').gte('event_date', today).neq('status', 'cancelled').order('event_date', { ascending: true }).limit(8);
      var evs = ((r && r.data) || []).filter(function (e) { return e.event_date >= today && e.status !== 'cancelled' && (e.kind || 'service') === 'service' && (!e.location || lower(e.location).indexOf('toronto') < 0); });
      evs.sort(function (a, b) { return a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0; });
      var ev = evs[0] || null;
      var rows = [];
      if (ev) { var rr = await db.from('event_roster').select('id,person_name,role,status,confirm_status,confirmed_at').eq('event_id', ev.id); rows = (rr && rr.data) || []; }
      await loadCfg(false);
      S.next = ev ? { ev: ev, rows: rows } : { ev: null, rows: [] }; S.nextAt = Date.now();
    } catch (e) { S.next = S.next || { ev: null, rows: [] }; }
    return S.next;
  }
  function nextHtml(n) {
    if (!n || !n.ev) return '';
    var ev = n.ev, rows = n.rows.filter(function (r) { return !isOff(r); });
    var conf = rows.filter(isConf), decl = rows.filter(isDecl), wait = rows.filter(function (r) { return !isConf(r) && !isDecl(r); });
    var bytext = rows.filter(function (r) { return r.confirm_status === 'confirmed'; }).length;
    var pct = rows.length ? Math.round(conf.length / rows.length * 100) : 0;
    var d = Math.round((new Date(ev.event_date + 'T12:00:00Z') - new Date(todayIso() + 'T12:00:00Z')) / 86400000);
    var when = d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days';
    var names = wait.slice(0, 6).map(function (r) { return first(r.person_name) + ' (' + one(r.role).toLowerCase() + ')'; }).join(', ') + (wait.length > 6 ? ' and ' + (wait.length - 6) + ' more' : '');
    var mode = S.mode || 'off';
    return '<div class="k">Next serving · ' + E(when) + (ev.format ? ' · ' + E(FORMATS[ev.format] || ev.format) : '') + '</div>'
      + '<h3>' + E(fmtDay(ev.event_date, true)) + '</h3>'
      + '<p><b style="color:' + GOLD + '">' + conf.length + ' of ' + rows.length + '</b> confirmed' + (bytext ? ' · ' + bytext + ' by text' : '') + (decl.length ? ' · ' + decl.length + ' can’t make it' : '') + '</p>'
      + '<div class="bar"><i style="width:' + pct + '%"></i></div>'
      + (wait.length ? '<p>Still waiting: ' + E(names) + '.</p>' : (rows.length ? '<p>Everyone on the list has answered.</p>' : '<p>No one is on the roster yet.</p>'))
      + '<p style="font-size:12px;opacity:.8">' + (mode === 'live' ? 'Confirmation texts go 7 days before.' : mode === 'test' ? 'Texts are in test mode.' : 'Texts are off.') + '</p>'
      + '<button class="go" data-w171open="' + ev.id + '">Open the serving</button>';
  }
  function placeNext(host, anchor, before) {
    var n = S.next; var html = nextHtml(n);
    var el = document.getElementById('w171next');
    if (!html || !host) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'w171next'; }
    if (el.parentNode !== host) { if (anchor && anchor.parentNode === host) host.insertBefore(el, before ? anchor : anchor.nextSibling); else host.insertBefore(el, host.firstChild); }
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
  }
  async function paintNext(force) {
    if (!staff()) { var x = document.getElementById('w171next'); if (x) x.remove(); return; }
    var home = document.getElementById('mypage'), ov = document.getElementById('overview');
    var onHome = home && home.classList.contains('active'), onOv = ov && ov.classList.contains('active');
    if (!onHome && !onOv) return;
    await loadNext(force);
    if (onHome) {
      var body = document.getElementById('mpBody'); if (!body) return;
      var a = document.getElementById('w166lead') || document.getElementById('w112wrap') || body.querySelector('.mp-online') || body.querySelector('.mp-chips') || body.querySelector('.mp-head');
      placeNext(body, a, false);
    } else if (onOv) {
      var w = document.getElementById('w128'); if (!w) return;
      var k = w.querySelector(':scope > .w128kpis') || w.querySelector(':scope > .w128brief');
      if (!k) return;
      placeNext(w, k, false);
    }
  }
