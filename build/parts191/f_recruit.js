  /* ---------- Find volunteers (wave191e) ----------
     Steel (01/10/26): "a feature in the recruit section of the event to help recruit for upcoming event(s) and look through our
     CRM to find people that signed up and never volunteered, volunteered a lot but haven't in a while, volunteered once before,
     submitted a survey saying they liked the experience ... find people and get them together for an event and then shoot them
     personalized texts", "use QUO to enable conversations with people and only message them throughout 9am to 7pm".
     One sheet with two tabs. People: pick the servings, a group (never came, regulars we miss, came once, loved it, everyone),
     filter and tick; Review the texts shows each group's wording (English, French) and the real texts (wa191_recruit_send dry
     run); Invite adds them as Waiting For Response and queues one personal text each through Quo (sms_mode, STOP and 9 am to
     7 pm decide). Conversations: every number that texted or was texted lately, the thread (the Hub's copy plus what was typed
     in the Quo app, quo-send thread) and a reply from the ops line (wa191_text_reply).
     wave191i/j (01/10/26, the first evening): the team's Quo app replies are copied in every 10 minutes (quo-send
     sync_threads) and labelled "Typed in Quo"; a conversation waits only while a text of theirs has no person's answer
     (reactions such as Loved "..." do not count); "No reply needed" closes one (wa191_text_done); and the next three
     servings sit under the name with Coming / Can't make it / Add as coming (wa191_text_roster), for the people the team
     invited from the Quo app, whose YES the Hub cannot tie to a roster row by itself. */
  var R = { tab: 'people', evs: null, pool: null, poolKey: '', poolBusy: false, group: 'never', role: '', q: '', sort: 'fit', notTexted: true, hideOn: true, hasPhone: true,
            lapsedDays: 60, regularMin: 3, sel: {}, step: 'list', askRole: '', textThem: true, tpl: null, edits: {}, saveDefault: false, preview: null, prevBusy: false, prevKey: '',
            result: null, inbox: null, inboxAt: 0, ph: null, thread: null, quo: null, can: null, lastTa: null, sending: false,
            drafts: {}, names: {}, setting: null };
  var GROUPS = [
    { k: 'never', l: 'Never came', s: 'Signed up to volunteer and never served. Their text says no experience is needed.' },
    { k: 'lapsed', l: 'Regulars we miss', s: '' },
    { k: 'once', l: 'Came once', s: 'Served one time. Their text thanks them for that serving.' },
    { k: 'liked', l: 'Loved it', s: 'Rated their serving Excellent or Good on the survey or the feedback form (and did not say "not at this time").' },
    { k: 'all', l: 'Everyone', s: 'Every volunteer the CRM knows. Search by name, phone or role.' }
  ];
  var GL = {}; GROUPS.forEach(function (g) { GL[g.k] = g.l; });
  var KIND = { recruit: 'Invitation', confirm: 'Confirmation text', signup: 'Sign-up text', itinerary: 'Itinerary', survey: 'Survey', ack: 'Thank-you', reply: 'Reply', manual: 'Text volunteers', inbound: '' };
  function digits(s) { var d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
  function phf(d) { d = digits(d); return d ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : ''; }
  function initials(n) { var p = String(n || '?').trim().split(/\s+/); return (((p[0] || '')[0] || '') + ((p[1] || '')[0] || '')).toUpperCase() || '?'; }
  function hue(n) { var h = 0; n = String(n || ''); for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360; return h; }
  function ago(iso) { if (!iso) return ''; var d = -daysTo(String(iso).slice(0, 10)); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 60 ? d + ' days ago' : fmtMonth(iso); }
  function fmtMonth(iso) { try { var d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return d.toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'short', year: 'numeric' }); } catch (e) { return String(iso).slice(0, 7); } }
  function fmtShort(iso) { try { var d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); var y = d.getUTCFullYear() !== new Date().getFullYear(); return d.toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'short', day: 'numeric', year: y ? 'numeric' : undefined }); } catch (e) { return String(iso); } }
  function when(ts) {
    if (!ts) return ''; var t = new Date(ts); if (isNaN(t)) return '';
    var day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
    var hm = t.toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' }).replace(/\./g, '').toLowerCase();
    var d = daysTo(day); return d === 0 ? hm : d === -1 ? 'Yesterday ' + hm : fmtShort(day) + ' ' + hm;
  }
  async function canText() {
    if (R.can && Date.now() - R.canAt < 60000) return R.can;
    var out = { text: false };
    try { var r = await Promise.all([db.rpc('is_wa_admin'), db.rpc('is_wa_leader'), db.rpc('wa_is_hr'), db.rpc('wa256_can_text')]); out.text = [0, 1, 2, 3].some(function (i) { return r[i] && r[i].data === true; }); } catch (e) { /* the database decides anyway */ }
    R.can = out; R.canAt = Date.now(); return out;
  }
  /* the servings people can be invited to: upcoming, not cancelled, the next six */
  function upcoming() {
    var t = todayIso(); var list = [];
    try { list = (WA_VOL_EVENTS || []).filter(function (e) { return (e.kind || 'service') === 'service' && e.status !== 'cancelled' && e.status !== 'completed' && String(e.event_date) >= t; }); } catch (e) { /* fine */ }
    list.sort(function (a, b) { return String(a.event_date) < String(b.event_date) ? -1 : 1; }); return list.slice(0, 6);
  }
  function chosen() { return (R.evs || []).slice().sort(function (a, b) { var A = upcoming().filter(function (e) { return e.id === a; })[0], B = upcoming().filter(function (e) { return e.id === b; })[0]; return String((A || {}).event_date) < String((B || {}).event_date) ? -1 : 1; }); }
  function evById(id) { var x = null; upcoming().forEach(function (e) { if (e.id === id) x = e; }); return x; }
  async function loadPool(force) {
    var key = chosen().join(',') + '|' + R.lapsedDays + '|' + R.regularMin;
    if (!force && R.pool && R.poolKey === key) return R.pool;
    R.poolBusy = true; paintBody();
    try {
      var r = await db.rpc('wa191_recruit_pool', { p_events: chosen(), p_lapsed_days: R.lapsedDays, p_regular_min: R.regularMin });
      if (r && r.error) throw r.error;
      R.pool = r.data || { people: [] }; R.poolKey = key;
    } catch (e) { T('Could not load the volunteers: ' + String((e && e.message) || e).slice(0, 90)); R.pool = R.pool || { people: [] }; }
    R.poolBusy = false; return R.pool;
  }
  function inGroup(p, g) { return g === 'all' || (p.g || []).indexOf(g) >= 0; }
  function onChosen(p) { return (p.on || []).filter(function (o) { return chosen().indexOf(o.e) >= 0; }); }
  function score(p) {
    var s = 0; var role = R.role || R.askRole;
    if (role) { if (p.top === role) s += 3; else if ((p.roles || []).indexOf(role) >= 0) s += 2; }
    if (p.lk) s += 2;
    s += Math.min(p.s || 0, 10) * 0.3;
    if (!p.s && p.su && -daysTo(p.su) < 180) s += 1;
    if ((p.ask || 0) >= 2 && (p.no || 0) / p.ask >= 0.5) s -= 1;
    if (p.tx && -daysTo(p.tx) < 7) s -= 2;
    if (!p.ph) s -= 5; if (p.out) s -= 5;
    return s;
  }
  function pass(p) {
    var q = lower(R.q); var qd = q.replace(/\D/g, '');
    if (R.hasPhone && !p.ph) return false;
    if (R.notTexted && p.tx && -daysTo(p.tx) < 7) return false;
    if (R.hideOn && onChosen(p).length) return false;
    if (R.role && p.top !== R.role && (p.roles || []).indexOf(R.role) < 0) return false;
    if (q) { var hay = lower([p.n, p.ph, p.city, p.top, (p.roles || []).join(' ')].join(' ')); if (hay.indexOf(q) < 0 && !(qd.length >= 3 && String(p.ph || '').replace(/\D/g, '').indexOf(qd) >= 0)) return false; }
    return true;
  }
  function shown() {
    var ppl = (R.pool && R.pool.people) || [];
    var list = ppl.filter(function (p) { return inGroup(p, R.group) && pass(p); });
    var byName = function (a, b) { return lower(a.n) < lower(b.n) ? -1 : lower(a.n) > lower(b.n) ? 1 : 0; };
    var by = {
      fit: function (a, b) { var d = score(b) - score(a); return d || byName(a, b); },
      most: function (a, b) { return (b.s || 0) - (a.s || 0) || byName(a, b); },
      away: function (a, b) { var x = String(a.l || a.su || '9999'), y = String(b.l || b.su || '9999'); return x < y ? -1 : x > y ? 1 : byName(a, b); },
      recent: function (a, b) { var x = String(a.l || a.su || ''), y = String(b.l || b.su || ''); return x > y ? -1 : x < y ? 1 : byName(a, b); },
      name: byName
    };
    list.sort(by[R.sort] || by.fit); return list;
  }
  function count(g) { var ppl = (R.pool && R.pool.people) || []; return ppl.filter(function (p) { return inGroup(p, g) && pass(p); }).length; }
  function facts(p) {
    var bits = [];
    if (!p.s) bits.push('Signed up ' + (p.su ? fmtShort(p.su) : '') + ' · never served');
    else bits.push('Served ' + (p.s === 1 ? 'once' : p.s + ' times') + (p.l ? ' · last ' + fmtShort(p.l) : ''));
    if (p.lk) bits.push('Rated it ' + p.lk.w + (p.lk.on ? ' (' + fmtShort(p.lk.on) + ')' : '') + (p.lk.again && /^yes/i.test(p.lk.again) ? ', wants to come again' : ''));
    if ((p.ask || 0) >= 2 && p.no) bits.push('said no ' + p.no + ' of ' + p.ask);
    return bits.join(' · ');
  }
  function tags(p) {
    var t = [];
    var role = p.top || (p.roles || [])[0]; if (role) t.push('<span class="tg">' + E(one(role)) + '</span>');
    onChosen(p).forEach(function (o) { var e = evById(o.e); t.push('<span class="tg on">On ' + E(e ? fmtShort(e.event_date) : '') + ' · ' + E(lower(o.st) === 'waiting for response' ? 'waiting' : lower(o.st)) + '</span>'); });
    if (p.inv) t.push('<span class="tg">Invited ' + E(ago(p.inv)) + '</span>'); else if (p.tx) t.push('<span class="tg">Texted ' + E(ago(p.tx)) + '</span>');
    if (p.rx) t.push('<span class="tg">Texted us ' + E(ago(p.rx)) + '</span>');
    if (p.out) t.push('<span class="tg no">Stopped texts</span>'); else if (!p.ph) t.push('<span class="tg no">No phone</span>');
    if (p.t) t.push('<span class="tg test">Test phone</span>');
    if (p.fr) t.push('<span class="tg">FR</span>');
    return t.join('');
  }
  function key(p) { return p.p ? 'p' + p.p : 'c' + p.c; }
  function rowHtml(p) {
    var k = key(p); var on = !!R.sel[k];
    return '<label class="rw' + (on ? ' on' : '') + '"><input type="checkbox" data-rsel="' + E(k) + '"' + (on ? ' checked' : '') + '><span class="av" style="background:hsl(' + hue(p.n) + ',36%,40%)">' + E(initials(p.n)) + '</span>'
      + '<span class="who"><b>' + E(p.n) + '</b><span>' + E(facts(p)) + '</span><span class="tgs">' + tags(p) + '</span></span><span class="ph">' + E(p.ph || '') + '</span></label>';
  }
  function selList() { var ppl = (R.pool && R.pool.people) || []; return ppl.filter(function (p) { return R.sel[key(p)]; }); }
  function groupFor(p) { if (R.sel[key(p)] && R.sel[key(p)] !== true) return R.sel[key(p)]; var g = p.g || []; return ['liked', 'lapsed', 'once', 'never'].filter(function (x) { return g.indexOf(x) >= 0; })[0] || 'other'; }

  /* ---------- painting ---------- */
  function sheet() { return document.getElementById('w191rec'); }
  function paint() {
    var el = sheet(); if (!el) return;
    var ev = curEv(); var conv = R.tab === 'conv'; var waiting = (R.inbox || []).filter(function (x) { return x.wait; }).length;
    el.querySelector('.hd .t p').textContent = conv ? 'Texts with the ops line (438) 808-7754, through Quo' : (ev ? 'For ' + fmtDay(ev.event_date, true) + (ev.code ? ' · ' + ev.code : '') : 'For the upcoming servings');
    el.querySelectorAll('[data-rtab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-rtab') === R.tab); });
    var bd = el.querySelector('[data-rtab="conv"] .badge'); if (bd) { bd.textContent = waiting ? String(waiting) : ''; bd.style.display = waiting ? '' : 'none'; }
    paintBody(); paintFoot();
  }
  function paintBody() {
    var body = document.getElementById('w191recbody'); if (!body) return;
    var html = R.tab === 'conv' ? convHtml() : R.step === 'compose' ? composeHtml() : R.step === 'done' ? doneHtml() : rListHtml();
    if (body.__h === html) return;
    var keepScroll = body.scrollTop;
    /* the field being typed in (the search, a reply, a name) keeps its focus and caret through a repaint */
    var ae = document.activeElement; var fk = null, fs = 0, fe = 0;
    if (ae && ae.getAttribute && body.contains(ae)) ['data-rq', 'data-rreplyta', 'data-rname'].forEach(function (k) { if (ae.getAttribute(k) !== null) { fk = k; try { fs = ae.selectionStart; fe = ae.selectionEnd; } catch (e) { /* fine */ } } });
    body.innerHTML = html; body.__h = html;
    if (R.step === 'list' && R.tab === 'people') body.scrollTop = keepScroll;
    if (fk) { var f = body.querySelector('[' + fk + ']'); if (f) { f.focus(); try { f.setSelectionRange(fs == null ? f.value.length : fs, fe == null ? f.value.length : fe); } catch (e) { /* fine */ } } }
    if (R.tab === 'conv') {
      var th = body.querySelector('.thr .msgs'); if (th) th.scrollTop = th.scrollHeight;
      var ta = body.querySelector('[data-rreplyta]'); if (ta && ta.value) ta.style.height = Math.min(140, ta.scrollHeight + 2) + 'px';
    }
  }
  function rListHtml() {
    var ups = upcoming();
    var evRow = '<div class="row evs"><span class="lb">Invite to</span>' + (ups.length ? ups.map(function (e) {
      var on = chosen().indexOf(e.id) >= 0; var conf = e.roster_confirmed || 0, list = e.roster_count || 0;
      return '<button class="chip' + (on ? ' on' : '') + '" data-rev="' + e.id + '" aria-pressed="' + on + '"><b>' + E(fmtShort(e.event_date)) + '</b><span>' + conf + ' of ' + list + ' confirmed</span></button>';
    }).join('') : '<span class="none">No upcoming serving. Add one from the calendar first.</span>') + '</div>';
    var segs = '<div class="seg groups" role="tablist">' + GROUPS.map(function (g) { return '<button role="tab" data-rgroup="' + g.k + '" class="' + (R.group === g.k ? 'on' : '') + '" aria-selected="' + (R.group === g.k) + '">' + E(g.l) + (R.pool ? ' <i>' + count(g.k) + '</i>' : '') + '</button>'; }).join('') + '</div>';
    var gnote = R.group === 'lapsed'
      ? '<p class="gn"><input type="number" min="2" max="20" value="' + R.regularMin + '" data-rnum="regularMin" aria-label="Servings for a regular"> or more servings, none in the last <input type="number" min="7" max="365" value="' + R.lapsedDays + '" data-rnum="lapsedDays" aria-label="Days since the last serving"> days. Their text says how many times they served.</p>'
      : '<p class="gn">' + E((GROUPS.filter(function (g) { return g.k === R.group; })[0] || {}).s || '') + '</p>';
    var roles = ROLE_ORDER.filter(function (r) { return r !== 'community_talker'; });
    var filters = '<div class="row flt"><input type="search" placeholder="Search a name, phone or role" value="' + E(R.q) + '" data-rq>'
      + '<select data-rrole aria-label="Role"><option value="">Any role</option>' + roles.map(function (r) { return '<option value="' + r + '"' + (R.role === r ? ' selected' : '') + '>' + E(one(r)) + '</option>'; }).join('') + '</select>'
      + '<select data-rsort aria-label="Sort"><option value="fit"' + (R.sort === 'fit' ? ' selected' : '') + '>Best fit</option><option value="most"' + (R.sort === 'most' ? ' selected' : '') + '>Most servings</option><option value="away"' + (R.sort === 'away' ? ' selected' : '') + '>Longest away</option><option value="recent"' + (R.sort === 'recent' ? ' selected' : '') + '>Most recent</option><option value="name"' + (R.sort === 'name' ? ' selected' : '') + '>Name</option></select></div>'
      + '<div class="row tgl"><label><input type="checkbox" data-rf="notTexted"' + (R.notTexted ? ' checked' : '') + '> Not texted in 7 days</label><label><input type="checkbox" data-rf="hideOn"' + (R.hideOn ? ' checked' : '') + '> Not on these servings yet</label><label><input type="checkbox" data-rf="hasPhone"' + (R.hasPhone ? ' checked' : '') + '> Has a phone</label></div>';
    if (!R.pool || R.poolBusy) return evRow + segs + gnote + filters + '<div class="empty">Looking through the CRM…</div>';
    if (!chosen().length) return evRow + segs + gnote + filters + '<div class="empty">Pick at least one serving to invite them to.</div>';
    var list = shown(); var shownSel = list.filter(function (p) { return R.sel[key(p)]; }).length;
    var head = '<div class="lh"><label><input type="checkbox" data-rall' + (list.length && shownSel === list.length ? ' checked' : '') + '> ' + (list.length ? 'Select all ' + list.length : 'Nobody') + ' shown</label><span>' + (list.length > 150 ? 'Showing the first 150; search or filter to narrow it' : '') + '</span></div>';
    return evRow + segs + gnote + filters + head + (list.length ? '<div class="lst">' + list.slice(0, 150).map(rowHtml).join('') + '</div>' : '<div class="empty">Nobody here with these filters.</div>');
  }
  function groupsInSel() { var g = {}; selList().forEach(function (p) { var k = groupFor(p); (g[k] = g[k] || []).push(p); }); return g; }
  function tplOf(g, lang) { var e = R.edits[g + '|' + lang]; if (e != null) return e; return ((R.tpl || {})[g] || {})[lang] || ''; }
  function composeHtml() {
    var gs = groupsInSel(); var order = ['never', 'lapsed', 'once', 'liked', 'other'];
    var mode = (R.pool && R.pool.mode) || 'off'; var open = R.pool ? R.pool.window_open : true;
    var banner = mode === 'live' ? '' : mode === 'test' ? '<div class="note warn"><b>Test mode.</b> Only the test phone gets a text. Everyone else is added to the roster without one; when an admin switches texts on, the 7-day confirmation still reaches them.</div>' : '<div class="note warn"><b>Texts are off.</b> Everyone you pick is added to the roster without a text.</div>';
    banner += open ? '' : '<div class="note">It is after 7 pm in Montreal, so the texts wait in the queue and go at 9 am.</div>';
    if (!R.textThem) banner = '<div class="note">No texts: they are only added to the roster as Waiting For Response.</div>';
    var cards = order.filter(function (g) { return gs[g]; }).map(function (g) {
      var hasFr = gs[g].some(function (p) { return p.fr; });
      var ta = function (lang) { var v = tplOf(g, lang); return '<div class="tpl"><span class="lg">' + (lang === 'fr' ? 'Français' : 'English') + '</span><textarea rows="3" data-rtpl="' + g + '|' + lang + '">' + E(v) + '</textarea><span class="cnt">' + v.length + ' characters before the names and the link</span></div>'; };
      return '<div class="wc"><h5>' + E(GL[g] || 'Other') + ' <span>' + gs[g].length + (gs[g].length === 1 ? ' person' : ' people') + '</span></h5>' + (R.textThem ? ta('en') + (hasFr ? ta('fr') : '') : '') + '</div>';
    }).join('');
    var chips = R.textThem ? '<div class="phs"><span>Insert:</span>' + ['{first}', '{dates}', '{served}', '{last}', '{role}', '{answer}', '{link}'].map(function (x) { return '<button data-rph="' + x + '">' + x + '</button>'; }).join('') + '</div>'
      + '<p class="gn">{answer} becomes “Reply YES or NO, or tap here: their link” (or “Tap here to pick your dates” for several servings); every text ends with how to stop texts.</p>'
      + '<label class="sv"><input type="checkbox" data-rsave' + (R.saveDefault ? ' checked' : '') + '> Save this wording as the default for these groups</label>' : '';
    return banner + '<div class="cmp"><div class="cw">' + cards + chips + '</div><div class="prev" id="w191recprev">' + prevHtml() + '</div></div>';
  }
  function prevHtml() {
    var prev = '';
    if (R.prevBusy && !R.preview) prev = '<div class="empty">Writing the texts…</div>';
    else if (R.preview) {
      var pv = R.preview;
      var line = [pv.added ? pv.added + ' added as Waiting For Response' : '', pv.kept ? pv.kept + ' already waiting (kept)' : '', pv.already_confirmed ? pv.already_confirmed + ' already confirmed' : '', pv.said_no ? pv.said_no + ' said no to a serving (left alone)' : ''].filter(Boolean).join(' · ');
      prev = '<h6>What they get' + (R.prevBusy ? ' <i>updating…</i>' : '') + '</h6><p class="gn">' + E(line) + (pv.texts ? ' · <b>' + pv.texts + ' text' + (pv.texts === 1 ? '' : 's') + '</b>' : ' · no text goes') + '</p>'
        + (pv.previews || []).slice(0, 12).map(function (x) {
          return '<div class="pv"><div class="pn"><b>' + E(x.n) + '</b><span>' + E(GL[x.g] || '') + (x.chars ? ' · ' + x.chars + ' characters' : '') + '</span></div>' + (x.text ? '<div class="bub out">' + E(x.text).replace(/\n/g, '<br>') + '</div>' : '') + (x.why ? '<div class="why">' + E(x.why === 'test mode: only the test phone gets texts' ? 'Added, no text (test mode)' : x.why === 'texts are off' ? 'Added, no text (texts are off)' : x.why) + '</div>' : '') + '</div>';
        }).join('') + ((pv.previews || []).length > 12 ? '<p class="gn">and ' + ((pv.previews || []).length - 12) + ' more, each with their own name and link.</p>' : '');
    }
    return prev;
  }
  function paintPrev() { var b = document.getElementById('w191recprev'); if (!b) { paintBody(); return; } var h = prevHtml(); if (b.__h !== h) { b.innerHTML = h; b.__h = h; } }
  function doneHtml() {
    var r = R.result || {}; var evs = chosen().map(function (id) { var e = evById(id); return e ? fmtShort(e.event_date) : ''; }).filter(Boolean).join(', ');
    var lines = [];
    lines.push('<li><b>' + (r.added || 0) + '</b> added to ' + E(evs) + ' as Waiting For Response' + (r.kept ? ' (' + r.kept + ' already on the list)' : '') + '</li>');
    if (r.texts) lines.push('<li><b>' + r.texts + '</b> invitation text' + (r.texts === 1 ? '' : 's') + (r.sends_now ? ' going out now' : ' waiting for 9 am') + ' from the ops line</li>');
    if (r.held) lines.push('<li><b>' + r.held + '</b> without a text (' + (r.mode === 'test' ? 'test mode' : 'texts are off') + ')</li>');
    if (r.no_phone) lines.push('<li><b>' + r.no_phone + '</b> with no phone number: call or email them</li>');
    if (r.opted_out) lines.push('<li><b>' + r.opted_out + '</b> who texted STOP (not texted)</li>');
    if (r.invited_recently) lines.push('<li><b>' + r.invited_recently + '</b> invited in the last 3 days (not texted again)</li>');
    if (r.new_records) lines.push('<li><b>' + r.new_records + '</b> new volunteer record' + (r.new_records === 1 ? '' : 's') + ' for people only in the CRM</li>');
    return '<div class="done"><div class="tick">✓</div><h4>Invitations on their way</h4><ul>' + lines.join('') + '</ul><p class="gn">A YES by text or a tap on their link confirms them on the roster. Anything else they write shows in Conversations.</p></div>';
  }
  function convHtml() {
    var list = R.inbox;
    var left = list == null ? '<div class="empty">Loading the conversations…</div>' : !list.length ? '<div class="empty">No texts in the last three weeks.</div>' : list.map(function (c) {
      return '<button class="cv' + (R.ph === c.ph ? ' on' : '') + '" data-rconv="' + E(c.ph) + '"><span class="av" style="background:hsl(' + hue(c.n || c.ph) + ',36%,40%)">' + E(c.n ? initials(c.n) : '#') + '</span><span class="who"><b>' + E(c.n || c.phf) + '</b><span>' + (c.dir === 'out' ? 'You: ' : '') + E(c.last || '') + '</span></span><span class="tm">' + E(when(c.at)) + (c.wait ? '<i class="dot" title="Waiting for an answer"></i>' : '') + '</span></button>';
    }).join('');
    var right = R.ph ? threadHtml() : '<div class="empty">Pick a conversation.</div>';
    return '<div class="conv' + (R.ph ? ' has' : '') + '"><div class="cl">' + left + '</div><div class="thr">' + right + '</div></div>';
  }
  function merged() {
    var t = (R.thread && R.thread.messages) || []; var seen = {}; t.forEach(function (m) { if (m.qid) seen[m.qid] = 1; });
    var out = t.map(function (m) { return { dir: m.dir, body: m.body, at: m.at, kind: m.kind, st: m.st, by: m.by, err: m.err, ev: m.ev, h: m.h }; });
    ((R.quo && R.quo.messages) || []).forEach(function (q) {
      if (seen[q.id]) return;
      /* the Hub has every incoming text from the webhook; an outgoing one it does not have was typed in the Quo app */
      if (q.dir === 'in' && t.some(function (m) { return m.dir === 'in' && String(m.body || '').trim() === String(q.text || '').trim(); })) return;
      out.push({ dir: q.dir, body: q.text, at: q.at, kind: q.dir === 'out' ? 'quo' : 'inbound', st: q.status, quo: true });
    });
    out.sort(function (a, b) { return String(a.at) < String(b.at) ? -1 : 1; });
    return out;
  }
  function threadHtml() {
    var th = R.thread; if (!th) return '<div class="empty">Loading…</div>';
    var msgs = merged(); var open = th.window_open;
    var nm = th.n || th.cn; var name = nm || phf(th.ph);
    var head = '<div class="th"><button class="bk" data-rback aria-label="Back">‹</button><span class="av" style="background:hsl(' + hue(nm || th.ph) + ',36%,40%)">' + E(nm ? initials(nm) : '#') + '</span><span><b>' + E(name) + '</b><span>' + (nm ? E(phf(th.ph)) : 'Unknown number') + (th.p ? ' · <a href="#volunteering/people" data-rperson="' + th.p + '">volunteer record</a>' : th.cn ? ' · in the CRM' : '') + '</span></span></div>';
    var body = msgs.length ? msgs.map(function (m) {
      /* a text the team typed in the Quo app: live from Quo (m.quo) or copied in by sync_threads (sent_by 'Quo app') */
      var lab = m.dir === 'out' ? (m.quo || m.by === 'Quo app' ? 'Typed in Quo' : (KIND[m.kind] || '') + (m.kind === 'reply' && m.by ? ' · ' + String(m.by).split('@')[0] : '')) : '';
      var st = m.dir === 'out' && m.st === 'queued' ? (open ? 'Sending…' : 'Waits for 9 am') : m.st === 'failed' ? 'Not delivered' + (m.err ? ': ' + m.err : '') : m.st === 'skipped' ? 'Not sent' + (m.err ? ': ' + m.err : '') : '';
      return '<div class="m ' + (m.dir === 'in' ? 'in' : 'out') + '"><div class="bub ' + (m.dir === 'in' ? 'in' : 'out') + (m.st === 'failed' || m.st === 'skipped' ? ' bad' : '') + '">' + E(m.body || '').replace(/\n/g, '<br>') + '</div><div class="mt">' + E([lab, m.ev, when(m.at), st].filter(Boolean).join(' · ')) + '</div></div>';
    }).join('') : '<div class="empty">No texts yet.</div>';
    var can = R.can && R.can.text;
    var c = (R.inbox || []).filter(function (x) { return x.ph === th.ph; })[0];
    /* a reply typed in Quo in the last minutes (before the 10-minute copy) already answers them */
    var tIn = 0, tMe = 0; msgs.forEach(function (m) { var t = new Date(m.at).getTime() || 0; if (m.dir === 'in') tIn = Math.max(tIn, t); else if (m.quo || m.kind === 'reply' || m.kind === 'manual') tMe = Math.max(tMe, t); });
    var waitLine = c && c.wait && can && !(tMe && tMe > tIn) ?'<div class="wl"><span><i class="dot"></i>' + (c.open > 1 ? c.open + ' texts wait' : 'Their text waits') + ' for an answer</span><button class="lnk" data-rdone>No reply needed</button></div>' : '';
    var foot = th.out ? '<div class="note warn">They texted STOP, so the Hub cannot text them. If they text START to the ops line, texts work again.</div>'
      : !can ? '<div class="note">Only leaders, HR, admins and the volunteer team can reply from the Hub. Quo has the same conversation on the ops line.</div>'
      : waitLine + '<div class="rp"><textarea rows="2" placeholder="Reply from the ops line" data-rreplyta>' + E(R.drafts[th.ph] || '') + '</textarea><button class="w191btn" data-rreply>' + (open ? 'Send' : 'Send at 9 am') + '</button></div>' + (open ? '' : '<p class="gn">It is outside 9 am to 7 pm in Montreal: your reply waits and goes at 9 am.</p>');
    return head + placesHtml(th) + '<div class="msgs">' + body + '</div>' + foot;
  }
  /* wave191j: their place on the next three servings, set from the conversation (wa191_text_roster). Coming and Can't make
     it are a toggle (tap the lit one again for waiting); a serving they are not on offers Add as coming. A number the
     directory does not know needs a name first (or uses the CRM's). */
  function placeOf(r) { var x = { status: r.st, confirm_status: r.cs }; return isConf(x) ? 'yes' : isDecl(x) ? 'no' : ''; }
  function placesHtml(th) {
    var sv = th.servings || []; if (!sv.length) return '';
    var who = th.p ? '' : th.cn ? '<p class="srn">The CRM knows this number as <b>' + E(th.cn) + '</b>. Adding them to a serving gives them a volunteer record.</p>'
      : '<p class="srn"><label for="w191rname">Not in the volunteer directory yet.</label><input id="w191rname" type="text" data-rname maxlength="80" autocomplete="off" placeholder="Their name, to add them" value="' + E(R.names[th.ph] || '') + '"></p>';
    var rows = sv.map(function (s) {
      var r = s.row; var busy = R.setting != null; var pl = r ? placeOf(r) : '';
      var what = r ? [one(r.role), pl === 'yes' ? 'coming' : pl === 'no' ? 'can’t make it' : lower(r.st) === 'tbd' ? 'to be decided' : 'waiting'] : ['not on the roster'];
      var day = '<span class="d"><b>' + E(fmtDay(s.d)) + '</b><span>' + E([s.t].concat(what).filter(Boolean).join(' · ')) + '</span></span>';
      if (!r) return '<div class="sr">' + day + '<button class="w191btn ghost sm" data-rset="' + s.e + '|Confirmed"' + (busy ? ' disabled' : '') + '>Add as coming</button></div>';
      return '<div class="sr">' + day + '<span class="seg sm" role="group" aria-label="' + E('Their answer for ' + fmtDay(s.d)) + '">'
        + '<button data-rset="' + s.e + '|' + (pl === 'yes' ? 'Waiting For Response' : 'Confirmed') + '"' + (pl === 'yes' ? ' class="on"' : '') + ' aria-pressed="' + (pl === 'yes') + '"' + (busy ? ' disabled' : '') + ' title="' + (pl === 'yes' ? 'Tap again to set them back to waiting' : 'They are coming') + '">Coming</button>'
        + '<button data-rset="' + s.e + '|' + (pl === 'no' ? 'Waiting For Response' : 'Unavailable') + '"' + (pl === 'no' ? ' class="on"' : '') + ' aria-pressed="' + (pl === 'no') + '"' + (busy ? ' disabled' : '') + ' title="' + (pl === 'no' ? 'Tap again to set them back to waiting' : 'They can’t make it') + '">Can’t make it</button></span></div>';
    }).join('');
    return '<div class="srv">' + who + rows + '</div>';
  }
  function paintFoot() {
    var f = document.getElementById('w191recfoot'); if (!f) return;
    var html;
    if (R.tab === 'conv') html = '<span class="gn">Replies go through Quo, so the team sees them in the Quo app too.</span><button class="w191btn ghost" data-rgo="refreshconv">Refresh</button>';
    else if (R.step === 'list') {
      var n = selList().length; var roles = ROLE_ORDER.filter(function (r) { return r !== 'community_talker'; });
      html = '<span class="cnt"><b>' + n + '</b> selected' + (n ? ' <button class="lnk" data-rgo="clear">Clear</button>' : '') + '</span>'
        + '<label class="ask">Ask them as <select data-raskrole><option value="">their usual role</option>' + roles.map(function (r) { return '<option value="' + r + '"' + (R.askRole === r ? ' selected' : '') + '>' + E(one(r).toLowerCase()) + '</option>'; }).join('') + '</select></label>'
        + (R.can && !R.can.text ? '<span class="ask" title="Only leaders, HR, admins and the volunteer team can text volunteers">Added without a text</span>' : '<label class="ask"><input type="checkbox" data-rtext' + (R.textThem ? ' checked' : '') + '> Text them</label>')
        + '<button class="w191btn gold" data-rgo="compose"' + (n && chosen().length ? '' : ' disabled') + '>' + (R.textThem ? 'Review the texts' : 'Review') + '</button>';
    } else if (R.step === 'compose') {
      var pv = R.preview || {}; var n2 = selList().length;
      var lbl = R.textThem ? 'Invite ' + n2 + (pv.texts != null ? ' · send ' + pv.texts + ' text' + (pv.texts === 1 ? '' : 's') : '') : 'Add ' + n2 + ' to the roster';
      html = '<button class="w191btn ghost" data-rgo="list">‹ Back</button><span class="sp"></span><button class="w191btn gold" data-rgo="send"' + (R.sending || R.prevBusy || !n2 ? ' disabled' : '') + '>' + E(R.sending ? 'Inviting…' : lbl) + '</button>';
    } else html = '<button class="w191btn ghost" data-rgo="conv">See the conversations</button><span class="sp"></span><button class="w191btn ghost" data-rgo="more">Find more people</button><button class="w191btn" data-rx>Done</button>';
    if (f.__h !== html) { f.innerHTML = html; f.__h = html; }
  }

  /* ---------- actions ---------- */
  async function openRecruit(opt) {
    opt = opt || {};
    if (!staff()) return;
    var ev = curEv(); var ups = upcoming();
    if (!R.evs || !R.evs.length || opt.reset) R.evs = ev && ups.some(function (e) { return e.id === ev.id; }) ? [ev.id] : ups.length ? [ups[0].id] : [];
    R.tab = opt.tab || 'people'; if (opt.tab !== 'conv') { R.step = R.step === 'done' ? 'list' : R.step || 'list'; }
    if (opt.phone) { R.ph = digits(opt.phone); R.thread = null; R.quo = null; }
    var el = sheet();
    if (!el) {
      el = document.createElement('div'); el.id = 'w191rec'; el.className = 'w191rec'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Find volunteers');
      el.innerHTML = '<div class="sh"><div class="hd"><div class="t"><h3>Find volunteers</h3><p></p></div><div class="seg tabs"><button data-rtab="people">People</button><button data-rtab="conv">Conversations <span class="badge" style="display:none"></span></button></div><button class="x" data-rx aria-label="Close">✕</button></div><div class="bd" id="w191recbody"></div><div class="ft" id="w191recfoot"></div></div>';
      document.body.appendChild(el);
    }
    el.classList.add('open'); document.documentElement.classList.add('w191noscroll');
    paint();
    canText().then(function (cn) { if (!cn.text) R.textThem = false; paint(); });
    loadInbox(false).then(function () { paint(); });
    if (R.tab === 'conv') { if (R.ph) openThread(R.ph); }
    else { await loadPool(false); paint(); }
  }
  function closeRecruit() { var el = sheet(); if (el) el.classList.remove('open'); document.documentElement.classList.remove('w191noscroll'); }
  async function loadInbox(force) {
    if (!force && R.inbox && Date.now() - R.inboxAt < 30000) return R.inbox;
    try { var r = await db.rpc('wa191_recruit_inbox', { p_events: null, p_days: 21 }); if (r && !r.error) { R.inbox = r.data || []; R.inboxAt = Date.now(); } } catch (e) { /* fine */ }
    if (!R.inbox) R.inbox = []; return R.inbox;
  }
  async function openThread(ph) {
    R.ph = digits(ph); R.thread = null; R.quo = null; paint();
    await loadThread(true);
  }
  /* the Hub's copy of one number's texts, then what was typed in the Quo app in the last minutes (leaders, HR and admins;
     quo-send thread). A refresh keeps what is on screen until the new copy is in; a slow answer for a number no longer open
     is dropped. */
  async function loadThread(withQuo) {
    var ph = R.ph; if (!ph) return;
    try { var r = await db.rpc('wa191_recruit_thread', { p_phone: ph }); if (r && r.error) throw r.error; if (R.ph === ph) R.thread = r.data; }
    catch (e) { if (R.ph === ph && !R.thread) R.thread = { ph: ph, messages: [] }; T('Could not load the texts: ' + String((e && e.message) || e).slice(0, 80)); }
    if (R.ph !== ph) return; paint();
    if (!withQuo) return;
    var cn = await canText(); if (!cn.text) return;
    try { var q = await db.functions.invoke('quo-send', { body: { action: 'thread', phone: ph } }); if (q && !q.error && q.data && q.data.messages && R.ph === ph && ph === (q.data.phone || ph)) { R.quo = q.data; paint(); } } catch (e) { /* the Hub's copy is enough */ }
  }
  function refreshThread() { return loadThread(false); }
  async function reply(btn) {
    var ta = document.querySelector('#w191rec [data-rreplyta]'); if (!ta) return; var v = ta.value.trim(); if (!v) { ta.focus(); return; }
    btn.disabled = true;
    try {
      var r = await db.rpc('wa191_text_reply', { p_phone: R.ph, p_body: v }); if (r && r.error) throw r.error;
      ta.value = ''; delete R.drafts[R.ph]; T(r.data && r.data.sends_now ? 'Sent from the ops line' : 'Queued: it goes at 9 am');
      setTimeout(function () { loadThread(true); }, r.data && r.data.sends_now ? 2500 : 300); loadInbox(true).then(paint);
    } catch (e) { T('Could not send: ' + String((e && e.message) || e).slice(0, 120)); }
    btn.disabled = false;
  }
  /* wave191j: Coming / Can't make it / Add as coming from the conversation */
  async function setPlace(evId, status) {
    var th = R.thread; if (!th || R.setting != null) return;
    var name = String(R.names[th.ph] || '').trim();
    if (!th.p && !th.cn && name.length < 2) {
      T('Type their name first: this number is not in the volunteer directory yet.');
      var ni = document.querySelector('#w191rec [data-rname]'); if (ni) ni.focus(); return;
    }
    R.setting = evId; paintBody();
    try {
      var r = await db.rpc('wa191_text_roster', { p_phone: th.ph, p_event: evId, p_status: status, p_name: name || null, p_role: null });
      if (r && r.error) throw r.error; var d = r.data || {};
      var who = String(d.name || 'They').split(' ')[0];
      T(status === 'Confirmed' ? who + ' is coming on ' + fmtDay(d.date) + (d.added ? ' (added to the roster)' : '')
        : status === 'Unavailable' ? who + ' can’t make it on ' + fmtDay(d.date) : who + ' is back to waiting for ' + fmtDay(d.date));
      if (d.new_person) delete R.names[th.ph];
      try { WA_VOL_LOADED = false; } catch (e) { /* fine */ }
      try { if (typeof waVolRender === 'function') waVolRender(); } catch (e) { /* fine */ }
      R.setting = null; await refreshThread(); loadInbox(true).then(paint);
    } catch (e) { R.setting = null; paintBody(); T('Could not save: ' + String((e && e.message) || e).slice(0, 120)); }
  }
  /* wave191i: a "Thanks" needs no answer */
  async function markDone(btn) {
    if (!R.ph) return; btn.disabled = true;
    try {
      var r = await db.rpc('wa191_text_done', { p_phone: R.ph }); if (r && r.error) throw r.error;
      T('Marked as needing no reply'); await loadInbox(true); paint();
    } catch (e) { btn.disabled = false; T('Could not save: ' + String((e && e.message) || e).slice(0, 120)); }
  }
  function people() { return selList().map(function (p) { return { person_id: p.p || null, contact_id: p.c, group: groupFor(p), role: R.askRole || null }; }); }
  function texts() { var out = {}; Object.keys(R.edits).forEach(function (k) { var a = k.split('|'); out[a[0]] = out[a[0]] || {}; out[a[0]][a[1]] = R.edits[k]; }); return out; }
  async function loadTpl() { if (R.tpl) return R.tpl; try { var r = await db.rpc('wa191_recruit_templates'); if (r && !r.error) R.tpl = r.data; } catch (e) { /* fine */ } return R.tpl || {}; }
  var prevTimer = null;
  function schedPreview() { clearTimeout(prevTimer); prevTimer = setTimeout(preview, 700); }
  async function preview() {
    var keyNow = JSON.stringify([chosen(), people(), texts(), R.textThem]); if (R.preview && R.prevKey === keyNow) return;
    R.prevBusy = true; paintFoot(); paintPrev();
    try {
      var r = await db.rpc('wa191_recruit_send', { p_events: chosen(), p_people: people(), p_texts: texts(), p_dry: true, p_text: R.textThem });
      if (r && r.error) throw r.error; R.preview = r.data; R.prevKey = keyNow;
    } catch (e) { T('Could not write the texts: ' + String((e && e.message) || e).slice(0, 120)); }
    R.prevBusy = false; if (R.step === 'compose') { paintPrev(); paintFoot(); }
  }
  async function send(btn) {
    if (R.sending) return; R.sending = true; paintFoot();
    try {
      if (R.saveDefault && Object.keys(R.edits).length) {
        var sv = await db.rpc('wa191_recruit_templates_save', { p: texts() }); if (sv && sv.error) throw sv.error; R.tpl = sv.data || R.tpl;
      }
      var r = await db.rpc('wa191_recruit_send', { p_events: chosen(), p_people: people(), p_texts: texts(), p_dry: false, p_text: R.textThem });
      if (r && r.error) throw r.error;
      R.result = r.data || {}; R.step = 'done'; R.sel = {}; R.preview = null; R.edits = {}; R.saveDefault = false;
      try { WA_VOL_LOADED = false; } catch (e) { /* fine */ }
      T((R.result.added || 0) + ' invited' + (R.result.texts ? ', ' + R.result.texts + ' text' + (R.result.texts === 1 ? '' : 's') + (R.result.sends_now ? ' going out' : ' at 9 am') : ''));
      R.pool = null; loadPool(true).then(paint); loadInbox(true).then(paint);
      try { if (typeof waVolRender === 'function') waVolRender(); } catch (e) { /* fine */ }
    } catch (e) { T('Could not invite: ' + String((e && e.message) || e).slice(0, 140)); }
    R.sending = false; paint();
  }
  async function rgo(what, btn) {
    if (what === 'compose') { if (!selList().length) return; R.step = 'compose'; R.preview = null; await loadTpl(); paint(); preview(); return; }
    if (what === 'list') { R.step = 'list'; paint(); return; }
    if (what === 'send') { await send(btn); return; }
    if (what === 'clear') { R.sel = {}; paint(); return; }
    if (what === 'more') { R.step = 'list'; R.result = null; paint(); if (!R.pool) { await loadPool(true); paint(); } return; }
    if (what === 'conv') { R.tab = 'conv'; R.step = 'list'; paint(); await loadInbox(true); paint(); return; }
    if (what === 'refreshconv') { await loadInbox(true); paint(); if (R.ph) loadThread(true); return; }
  }
  /* placeholders go where the cursor was in the last wording touched */
  function insertPh(ph) {
    var ta = R.lastTa && document.body.contains(R.lastTa) ? R.lastTa : document.querySelector('#w191rec [data-rtpl]'); if (!ta) return;
    var a = ta.selectionStart || ta.value.length, b = ta.selectionEnd || ta.value.length;
    ta.value = ta.value.slice(0, a) + ph + ta.value.slice(b); ta.focus(); try { ta.setSelectionRange(a + ph.length, a + ph.length); } catch (e) { /* fine */ }
    R.edits[ta.getAttribute('data-rtpl')] = ta.value; var c = ta.parentElement.querySelector('.cnt'); if (c) c.textContent = ta.value.length + ' characters before the names and the link';
    schedPreview();
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var cv = t.closest('[data-w191conv]'); if (cv) { e.preventDefault(); e.stopPropagation(); openRecruit({ tab: 'conv', phone: cv.getAttribute('data-w191conv') }); return; }
    var el = t.closest('#w191rec'); if (!el) return;
    if (t === el) { closeRecruit(); return; }
    var x;
    if ((x = t.closest('[data-rx]'))) { e.preventDefault(); closeRecruit(); return; }
    if ((x = t.closest('[data-rtab]'))) { e.preventDefault(); R.tab = x.getAttribute('data-rtab'); paint(); if (R.tab === 'conv') loadInbox(false).then(paint); else if (!R.pool) loadPool(false).then(paint); return; }
    if ((x = t.closest('[data-rev]'))) { e.preventDefault(); var id = Number(x.getAttribute('data-rev')); var i = R.evs.indexOf(id); if (i >= 0) R.evs.splice(i, 1); else R.evs.push(id); R.preview = null; paintBody(); loadPool(false).then(paint); return; }
    if ((x = t.closest('[data-rgroup]'))) { e.preventDefault(); R.group = x.getAttribute('data-rgroup'); paintBody(); return; }
    if ((x = t.closest('[data-rgo]'))) { e.preventDefault(); rgo(x.getAttribute('data-rgo'), x); return; }
    if ((x = t.closest('[data-rconv]'))) { e.preventDefault(); openThread(x.getAttribute('data-rconv')); return; }
    if ((x = t.closest('[data-rback]'))) { e.preventDefault(); R.ph = null; R.thread = null; paint(); return; }
    if ((x = t.closest('[data-rreply]'))) { e.preventDefault(); reply(x); return; }
    if ((x = t.closest('[data-rset]'))) { e.preventDefault(); if (x.disabled) return; var sp = x.getAttribute('data-rset').split('|'); setPlace(Number(sp[0]), sp[1]); return; }
    if ((x = t.closest('[data-rdone]'))) { e.preventDefault(); markDone(x); return; }
    if ((x = t.closest('[data-rph]'))) { e.preventDefault(); insertPh(x.getAttribute('data-rph')); return; }
    if ((x = t.closest('[data-rperson]'))) { closeRecruit(); return; }
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w191rec')) return;
    var k;
    if ((k = t.getAttribute('data-rsel'))) { if (t.checked) R.sel[k] = R.group === 'all' ? true : R.group; else delete R.sel[k]; var lb = t.closest('.rw'); if (lb) lb.classList.toggle('on', t.checked); paintFoot(); var all = document.querySelector('#w191rec [data-rall]'); if (all) { var l = shown(); all.checked = l.length && l.every(function (p) { return R.sel[key(p)]; }); } return; }
    if (t.hasAttribute('data-rall')) { shown().slice(0, 150).forEach(function (p) { if (t.checked) R.sel[key(p)] = R.group === 'all' ? true : R.group; else delete R.sel[key(p)]; }); paint(); return; }
    if (t.hasAttribute('data-rrole')) { R.role = t.value; paintBody(); return; }
    if (t.hasAttribute('data-rsort')) { R.sort = t.value; paintBody(); return; }
    if ((k = t.getAttribute('data-rf'))) { R[k] = t.checked; paintBody(); return; }
    if ((k = t.getAttribute('data-rnum'))) { var v = Math.round(Number(t.value)); if (!isFinite(v)) return; R[k] = Math.max(k === 'lapsedDays' ? 7 : 2, Math.min(k === 'lapsedDays' ? 365 : 20, v)); loadPool(false).then(paint); return; }
    if (t.hasAttribute('data-raskrole')) { R.askRole = t.value; R.preview = null; return; }
    if (t.hasAttribute('data-rtext')) { R.textThem = t.checked; paintFoot(); return; }
    if (t.hasAttribute('data-rsave')) { R.saveDefault = t.checked; return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w191rec')) return;
    if (t.hasAttribute('data-rq')) { R.q = t.value; clearTimeout(R.qT); R.qT = setTimeout(paintBody, 160); return; }
    if (t.hasAttribute('data-rreplyta')) { if (R.ph) R.drafts[R.ph] = t.value; t.style.height = '42px'; t.style.height = Math.min(140, t.scrollHeight + 2) + 'px'; return; }
    if (t.hasAttribute('data-rname')) { if (R.ph) R.names[R.ph] = t.value; return; }
    var k = t.getAttribute('data-rtpl'); if (k) { R.lastTa = t; R.edits[k] = t.value; var c = t.parentElement.querySelector('.cnt'); if (c) c.textContent = t.value.length + ' characters before the names and the link'; schedPreview(); }
  });
  document.addEventListener('focusin', function (e) { var t = e.target; if (t && t.getAttribute && t.getAttribute('data-rtpl')) R.lastTa = t; });
  document.addEventListener('keydown', function (e) {
    var el = sheet(); if (!el || !el.classList.contains('open')) return;
    if (e.key === 'Escape') { if (R.tab === 'conv' && R.ph && window.innerWidth < 720) { R.ph = null; paint(); } else closeRecruit(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target && e.target.hasAttribute && e.target.hasAttribute('data-rreplyta')) { var b = el.querySelector('[data-rreply]'); if (b) reply(b); }
  });

  var rcss = document.createElement('style'); rcss.id = 'wa191rcss';
  rcss.textContent = '' +
    'html.w191noscroll,html.w191noscroll body{overflow:hidden;}' +
    '.w191rec{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;background:rgba(31,32,30,.38);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);font-family:' + BODY + ';color:' + INK + ';}' +
    '.w191rec.open{display:flex;}' +
    '.w191rec .sh{width:min(880px,calc(100vw - 32px));height:min(92vh,980px);background:#FFFAF2;border-radius:18px;box-shadow:0 24px 70px rgba(16,63,57,.28);display:flex;flex-direction:column;overflow:hidden;}' +
    '.w191rec .hd{display:flex;align-items:center;gap:14px;padding:16px 18px 12px;border-bottom:1px solid rgba(16,63,57,.1);}' +
    '.w191rec .hd .t{flex:1;min-width:0;}.w191rec .hd h3{margin:0;font-family:' + HEAD + ';font-size:26px;letter-spacing:.3px;color:' + GREEN + ';line-height:1.05;}.w191rec .hd p{margin:2px 0 0;font-size:12.5px;color:' + MUTED + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.w191rec .x{border:0;background:rgba(16,63,57,.07);color:' + GREEN + ';width:32px;height:32px;border-radius:50%;font-size:14px;cursor:pointer;flex:none;}' +
    '.w191rec .seg{display:inline-flex;background:rgba(16,63,57,.07);border-radius:10px;padding:3px;gap:2px;}' +
    '.w191rec .seg button{border:0;background:transparent;padding:7px 12px;border-radius:8px;font:600 12.5px ' + BODY + ';color:' + GREEN + ';cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;}' +
    '.w191rec .seg button.on{background:#FFFAF2;box-shadow:0 1px 3px rgba(16,63,57,.18);}' +
    '.w191rec .seg button i{font-style:normal;font-weight:700;font-size:11px;background:rgba(16,63,57,.1);border-radius:999px;padding:1px 7px;}.w191rec .seg button.on i{background:' + GOLD + ';color:' + GREEN + ';}' +
    '.w191rec .badge{background:' + FLAG + ';color:#FFFAF2;border-radius:999px;font-size:10.5px;padding:1px 6px;font-weight:700;}' +
    '.w191rec .bd{flex:1;overflow:auto;padding:14px 18px 18px;-webkit-overflow-scrolling:touch;}' +
    '.w191rec .ft{display:flex;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid rgba(16,63,57,.1);background:' + CREAM + ';flex-wrap:wrap;}' +
    '.w191rec .ft .cnt{font-size:13px;}.w191rec .ft .sp{flex:1;}.w191rec .ft .ask{font-size:12.5px;color:' + MUTED + ';display:inline-flex;align-items:center;gap:6px;}.w191rec .ft .ask select{font:inherit;padding:5px 8px;border-radius:8px;border:1px solid rgba(16,63,57,.2);}' +
    '.w191rec .ft .w191btn.gold{margin-left:auto;}.w191rec .lnk{border:0;background:none;color:' + TEAL + ';font:inherit;cursor:pointer;text-decoration:underline;padding:0 4px;}' +
    '.w191rec .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px;}.w191rec .row .lb{font-size:12px;color:' + MUTED + ';font-weight:600;margin-right:2px;}' +
    '.w191rec .chip{border:1px solid rgba(16,63,57,.2);background:#FFFAF2;border-radius:12px;padding:7px 11px;cursor:pointer;text-align:left;font-family:' + BODY + ';color:' + GREEN + ';}' +
    '.w191rec .chip b{display:block;font-size:13px;}.w191rec .chip span{font-size:11px;color:' + MUTED + ';}.w191rec .chip.on{border-color:' + GREEN + ';background:rgba(16,63,57,.06);box-shadow:inset 0 0 0 1px ' + GREEN + ';}' +
    '.w191rec .groups{display:flex;overflow-x:auto;max-width:100%;margin:2px 0 6px;scrollbar-width:none;}.w191rec .groups::-webkit-scrollbar{display:none;}' +
    '.w191rec .gn{font-size:12.5px;color:' + MUTED + ';margin:4px 0 10px;line-height:1.45;}.w191rec .gn input{width:52px;font:inherit;padding:2px 4px;border:1px solid rgba(16,63,57,.25);border-radius:6px;text-align:center;}' +
    '.w191rec .flt input[type=search]{flex:1;min-width:180px;font:inherit;font-size:13px;padding:8px 11px;border-radius:10px;border:1px solid rgba(16,63,57,.2);background:#FFFAF2;}' +
    '.w191rec .flt select{font:inherit;font-size:13px;padding:7px 9px;border-radius:10px;border:1px solid rgba(16,63,57,.2);background:#FFFAF2;}' +
    '.w191rec .tgl label{font-size:12px;color:' + GREEN + ';display:inline-flex;gap:6px;align-items:center;padding:5px 11px 5px 8px;border:1px solid rgba(16,63,57,.18);border-radius:999px;background:#FFFAF2;cursor:pointer;}.w191rec .tgl label:has(input:checked){background:rgba(16,63,57,.07);border-color:rgba(16,63,57,.35);}.w191rec .tgl input{margin:0;accent-color:' + GREEN + ';}' +
    '.w191rec .lh{display:flex;justify-content:space-between;font-size:12.5px;color:' + MUTED + ';padding:6px 2px;border-bottom:1px solid rgba(16,63,57,.1);}.w191rec .lh label{display:inline-flex;gap:6px;align-items:center;color:' + INK + ';font-weight:600;}' +
    '.w191rec .rw{display:grid;grid-template-columns:22px 34px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 4px;border-bottom:1px solid rgba(16,63,57,.07);cursor:pointer;border-radius:10px;}' +
    '.w191rec .rw:hover{background:rgba(16,63,57,.035);}.w191rec .rw.on{background:rgba(220,165,39,.12);}' +
    '.w191rec .av{width:34px;height:34px;border-radius:50%;color:#FFFAF2;font-weight:700;font-size:12px;display:inline-flex;align-items:center;justify-content:center;flex:none;}' +
    '.w191rec .who{min-width:0;display:flex;flex-direction:column;gap:2px;}.w191rec .who b{font-size:14px;}.w191rec .who > span{font-size:12px;color:' + MUTED + ';overflow:hidden;text-overflow:ellipsis;}' +
    '.w191rec .tgs{display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;}.w191rec .tg{font-size:10.5px;padding:2px 7px;border-radius:999px;background:rgba(16,63,57,.07);color:' + GREEN + ';white-space:nowrap;}' +
    '.w191rec .tg.on{background:rgba(42,140,122,.14);color:' + TEAL + ';}.w191rec .tg.no{background:rgba(179,64,47,.1);color:' + FLAG + ';}.w191rec .tg.test{background:rgba(111,100,171,.14);color:' + PURPLE + ';}' +
    '.w191rec .ph{font-size:12px;color:' + MUTED + ';white-space:nowrap;}' +
    '.w191rec .empty{padding:30px 10px;text-align:center;color:' + MUTED + ';font-size:13px;}.w191rec .none{font-size:12.5px;color:' + FLAG + ';}' +
    '.w191rec .note{font-size:12.5px;line-height:1.45;padding:10px 12px;border-radius:12px;background:rgba(16,63,57,.06);margin:0 0 10px;}.w191rec .note.warn{background:#FFF4DC;border:1px solid rgba(220,165,39,.45);}' +
    '.w191rec .wc{border:1px solid rgba(16,63,57,.12);border-radius:14px;padding:12px;margin:0 0 10px;background:#FFFAF2;}.w191rec .wc h5{margin:0 0 8px;font-size:14px;color:' + GREEN + ';}.w191rec .wc h5 span{font-weight:500;color:' + MUTED + ';font-size:12px;margin-left:4px;}' +
    '.w191rec .cmp{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:16px;align-items:start;}.w191rec .cmp .prev{position:sticky;top:0;background:rgba(16,63,57,.045);border-radius:14px;padding:4px 12px 10px;max-height:calc(92vh - 200px);overflow:auto;}.w191rec .cmp .prev h6{margin-top:10px;}' +
    '.w191rec .tpl{display:flex;flex-direction:column;gap:4px;margin:0 0 8px;}.w191rec .tpl .lg{font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:' + MUTED + ';}' +
    '.w191rec .tpl textarea{font:inherit;font-size:13.5px;line-height:1.45;padding:9px 11px;border-radius:10px;border:1px solid rgba(16,63,57,.2);resize:vertical;min-height:72px;height:auto;background:#FFFAF2;}.w191rec .tpl .cnt{font-size:11px;color:' + MUTED + ';}' +
    '.w191rec .phs{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px;color:' + MUTED + ';}.w191rec .phs button{border:1px dashed rgba(16,63,57,.3);background:#FFFAF2;border-radius:8px;padding:3px 8px;font:600 12px ui-monospace,Menlo,monospace;color:' + GREEN + ';cursor:pointer;}' +
    '.w191rec .sv{font-size:12.5px;display:inline-flex;gap:6px;align-items:center;margin:2px 0 8px;}' +
    '.w191rec .prev h6{font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:' + GOLD + ';margin:14px 0 4px;}.w191rec .prev h6 i{font-style:normal;color:' + MUTED + ';letter-spacing:0;text-transform:none;font-weight:500;}' +
    '.w191rec .pv{margin:0 0 12px;}.w191rec .pv .pn{font-size:12px;margin:0 0 4px;display:flex;gap:6px;align-items:baseline;}.w191rec .pv .pn span{color:' + MUTED + ';}.w191rec .pv .why{font-size:11.5px;color:' + FLAG + ';margin-top:3px;}' +
    '.w191rec .bub{max-width:min(460px,86%);padding:9px 13px;border-radius:18px;font-size:13.5px;line-height:1.42;word-wrap:break-word;overflow-wrap:anywhere;}' +
    '.w191rec .bub.out{background:' + GREEN + ';color:' + CREAM + ';border-bottom-right-radius:6px;margin-left:auto;}.w191rec .pv .bub.out{margin-left:0;border-bottom-right-radius:18px;border-bottom-left-radius:6px;}' +
    '.w191rec .bub.in{background:#ECEBE6;color:' + INK + ';border-bottom-left-radius:6px;}.w191rec .bub.bad{opacity:.55;}' +
    '.w191rec .done{text-align:center;padding:26px 10px;}.w191rec .done .tick{width:54px;height:54px;border-radius:50%;background:' + TEAL + ';color:#FFFAF2;font-size:28px;display:inline-flex;align-items:center;justify-content:center;}' +
    '.w191rec .done h4{font-family:' + HEAD + ';font-size:24px;color:' + GREEN + ';margin:10px 0 8px;}.w191rec .done ul{list-style:none;padding:0;margin:0 auto 10px;max-width:520px;text-align:left;}.w191rec .done li{padding:7px 0;border-bottom:1px solid rgba(16,63,57,.08);font-size:13.5px;}' +
    '.w191rec .conv{display:grid;grid-template-columns:280px minmax(0,1fr);gap:0;height:100%;min-height:420px;border:1px solid rgba(16,63,57,.1);border-radius:14px;overflow:hidden;}' +
    '.w191rec .bd:has(.conv){padding:12px;}' +
    '.w191rec .cl{overflow:auto;border-right:1px solid rgba(16,63,57,.1);background:' + CREAM + ';}' +
    '.w191rec .cv{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:9px;align-items:center;width:100%;text-align:left;border:0;background:transparent;padding:10px 12px;border-bottom:1px solid rgba(16,63,57,.07);cursor:pointer;font-family:' + BODY + ';}' +
    '.w191rec .cv.on{background:rgba(16,63,57,.07);}.w191rec .cv .who span{white-space:nowrap;}.w191rec .cv .tm{font-size:11px;color:' + MUTED + ';display:flex;flex-direction:column;align-items:flex-end;gap:5px;}.w191rec .dot{width:9px;height:9px;border-radius:50%;background:' + FLAG + ';display:inline-block;}' +
    '.w191rec .thr{display:flex;flex-direction:column;min-width:0;min-height:0;}' +
    '.w191rec .th{display:flex;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(16,63,57,.1);}.w191rec .th b{display:block;font-size:14px;}.w191rec .th span span{font-size:12px;color:' + MUTED + ';}.w191rec .th a{color:' + TEAL + ';}' +
    '.w191rec .th .bk{display:none;border:0;background:none;font-size:26px;color:' + GREEN + ';cursor:pointer;padding:0 4px;}' +
    '.w191rec .msgs{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#FFFAF2;}' +
    '.w191rec .m{display:flex;flex-direction:column;}.w191rec .m.out{align-items:flex-end;}.w191rec .m .mt{font-size:10.5px;color:' + MUTED + ';margin:3px 6px 0;}' +
    '.w191rec .rp{display:flex;gap:8px;align-items:flex-end;padding:10px 12px;border-top:1px solid rgba(16,63,57,.1);background:#FFFAF2;}.w191rec .rp textarea{flex:1;font:inherit;font-size:13.5px;line-height:1.4;padding:10px 14px;border-radius:20px;border:1px solid rgba(16,63,57,.2);resize:none;min-height:42px;height:42px;max-height:140px;background:#FFFAF2;box-sizing:border-box;}' +
    '.w191rec .thr > .note,.w191rec .thr > .gn{margin:8px 12px;}' +
    /* wave191j: their servings under the name; wave191i: the waiting line over the reply box */
    '.w191rec .srv{padding:8px 14px 6px;border-bottom:1px solid rgba(16,63,57,.1);background:' + CREAM + ';display:flex;flex-direction:column;gap:6px;}' +
    '.w191rec .sr{display:flex;align-items:center;gap:10px;min-height:32px;}.w191rec .sr .d{flex:1;min-width:0;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}.w191rec .sr .d b{font-size:13px;color:' + GREEN + ';white-space:nowrap;}.w191rec .sr .d span{font-size:12px;color:' + MUTED + ';}' +
    '.w191rec .seg.sm{padding:2px;border-radius:9px;flex:none;}.w191rec .seg.sm button{padding:5px 10px;font-size:12px;border-radius:7px;}.w191rec .seg.sm button.on{background:' + GREEN + ';color:' + CREAM + ';box-shadow:none;}.w191rec .seg.sm button[disabled]{opacity:.5;cursor:default;}' +
    '.w191rec .w191btn.sm{padding:6px 11px;font-size:12px;flex:none;}' +
    '.w191rec .srn{margin:0;font-size:12px;color:' + MUTED + ';display:flex;gap:8px;align-items:center;flex-wrap:wrap;}.w191rec .srn b{color:' + INK + ';}.w191rec .srn input{flex:1;min-width:150px;font:inherit;font-size:13px;padding:6px 10px;border-radius:9px;border:1px solid rgba(16,63,57,.25);background:#FFFAF2;}' +
    '.w191rec .wl{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 14px;border-top:1px solid rgba(16,63,57,.1);background:rgba(179,64,47,.05);font-size:12px;color:' + FLAG + ';}.w191rec .wl span{display:inline-flex;align-items:center;gap:7px;}.w191rec .wl .lnk{font-size:12px;}' +
    '.w191rec .wl + .rp{border-top:0;}' +
    '@media (max-width:720px){.w191rec{align-items:flex-end;}.w191rec .sh{width:100vw;height:96vh;border-radius:18px 18px 0 0;}.w191rec .hd{flex-wrap:wrap;padding:14px 14px 10px;}.w191rec .hd .seg{order:3;width:100%;}.w191rec .hd .seg button{flex:1;justify-content:center;}' +
      '.w191rec .bd{padding:12px 14px 16px;}.w191rec .ft{padding:10px 14px;}.w191rec .rw{grid-template-columns:22px 30px minmax(0,1fr);}.w191rec .rw .ph{display:none;}.w191rec .av{width:30px;height:30px;}' +
      '.w191rec .conv{grid-template-columns:1fr;}.w191rec .conv .thr{display:none;}.w191rec .conv.has .cl{display:none;}.w191rec .conv.has .thr{display:flex;}.w191rec .th .bk{display:inline-block;}' +
      '.w191rec .ft .ask{flex:1 1 40%;}.w191rec .ft .w191btn.gold{flex:1 1 100%;justify-content:center;}.w191rec .ft > .gn{display:none;}.w191rec .ft [data-rgo="refreshconv"]{margin-left:auto;}' +
      '.w191rec .flt input[type=search]{flex:1 1 100%;}.w191rec .flt select{flex:1 1 40%;}.w191rec .cmp{grid-template-columns:1fr;}.w191rec .cmp .prev{position:static;max-height:none;}' +
      '.w191rec .srv{padding:8px 12px 6px;}.w191rec .sr .d{gap:0 8px;}.w191rec .sr .d span{flex-basis:100%;}.w191rec .seg.sm button{padding:5px 8px;}}';
  document.head.appendChild(rcss);
