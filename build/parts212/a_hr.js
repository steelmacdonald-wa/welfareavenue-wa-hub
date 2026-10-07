/* =====================================================================
   WA v212 The HR centre: brighter colours, a notification bell, time off that works (06/10/26)
   =====================================================================
   Valex's voice note (06/10/26): "the colours could be brighter", "a notification box", "time off disappeared",
   "notify Valex and Samson when someone asks for time off", "a form that tracks the weeks off". Steel: "for brighter
   colors do it for the hr center only".
   - Colours (HR centre only, #hrcentre): each stage of Applications has its own colour (New teal, Reviewing gold,
     Interview purple, Offer coral, Hired green) on the column, its count and the cards' edge; the Overview tiles carry
     a coloured top edge and number; pills and the time-off chips are stronger. Nothing outside the HR centre changes.
   - The bell (the HR centre's masthead): what needs you, counted since you last opened it: time-off requests waiting
     (HR), applications you handle that need a call, an interview, or the offer letter, new applications in the last
     three days, interviews today and tomorrow. Each line opens the page or the card.
   - Time off (wave105, edited in its segment): the page shows for the HR access profile too (wa_can_timeoff in the database; policies and the discipline tracker stay with the HR access list),
     Log time off opens a proper form, a decline needs a reason, the totals add a Total and the sick days left of 7, recent
     decisions fold open; the Overview count reads 'requested' (it read 'pending', so it was always 0). A new request is
     sent to Valex and Samson by Slack DM (hr-notify, trigger on wa_timeoff; app_config hr_notify_emails).
   Hooks: parts197 mastHr (the bell). */
(function () {
  'use strict';
  if (window.w212) return;
  var GREEN = '#103F39', GOLD = '#DCA527', TEAL = '#2A8C7A', PURPLE = '#6F64AB', CORAL = '#D9654B', FLAG = '#B3402F';
  var STAGE = { 'new': TEAL, reviewing: GOLD, interview: PURPLE, offer: CORAL, hired: GREEN };
  var B = { open: false, items: [] };

  function E(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function st() { try { return window.w197 ? w197.state() : null; } catch (e) { return null; } }
  function myName() { try { return (typeof USER !== 'undefined' && USER && (USER.name || USER.full_name)) || ''; } catch (e) { return ''; } }
  function myEmail() { try { return String((typeof USER !== 'undefined' && USER && USER.email) || '').toLowerCase(); } catch (e) { return ''; } }
  function firstName(n) { return String(n || '').trim().split(/\s+/)[0].toLowerCase(); }
  function mine(c) { var o = String(c.owner || '').toLowerCase(), me = myName().toLowerCase(); return !!o && !!me && (o === me || firstName(o) === firstName(me)); }
  function key() { return 'w212seen:' + myEmail(); }
  function seenAt() { try { return Number(localStorage.getItem(key()) || 0); } catch (e) { return 0; } }
  function markSeen() { try { localStorage.setItem(key(), String(Date.now())); } catch (e) { /* fine */ } }
  function day(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function when(t) { try { return new Date(t).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function callsOf(id) { try { return (w199.state().calls || []).filter(function (k) { return String(k.candidate_id) === String(id); }); } catch (e) { return []; } }
  function hr() { try { return typeof window.wa46IsHr === 'function' ? wa46IsHr() : false; } catch (e) { return false; } }

  /* what needs the person, newest first; at = when it became true (for the unread count) */
  function items() {
    var S = st(); if (!S) return [];
    var out = [], now = Date.now();
    var tod = day(now), tom = day(now + 86400000);
    if (hr() && S.data && S.data.timeoff) S.data.timeoff.forEach(function (t) {
      out.push({ k: 'to', at: t.created_at, ic: '🌴', t: (t.name || 'Someone') + ' asked for time off', s: t.start_date + ' to ' + t.end_date + ' (' + t.days + ' day' + (Number(t.days) === 1 ? '' : 's') + ')', go: '#hrcentre/timeoff' });
    });
    (S.cands || []).forEach(function (c) {
      var at = c.stage_at || c.created_at;
      if (c.status === 'new' && c.created_at && now - new Date(c.created_at).getTime() < 3 * 86400000) out.push({ k: 'new', at: c.created_at, ic: '✉', t: 'New application: ' + (c.name || 'someone'), s: (window.w199 ? w199.roleOf(c) : c.role) || '', id: c.id });
      if (!mine(c)) return;
      if ((c.status === 'new' || c.status === 'reviewing') && !callsOf(c.id).length) out.push({ k: 'call', at: at, ic: '☎', t: 'Call ' + (c.name || 'them'), s: 'You handle this application; no call logged yet', id: c.id });
      if (c.status === 'interview' && c.interview_at && (day(c.interview_at) === tod || day(c.interview_at) === tom)) out.push({ k: 'iv', at: at, ic: '🗓', t: 'Interview: ' + (c.name || 'someone'), s: when(c.interview_at), id: c.id });
      if (c.status === 'offer' && !c.offer_sent_at) out.push({ k: 'offer', at: at, ic: '✍', t: 'Send the offer letter to ' + (c.name || 'them'), s: 'At Offer, the letter is not sent yet', id: c.id });
    });
    out.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    return out.slice(0, 30);
  }
  function unread(list) { var s = seenAt(); return list.filter(function (i) { return i.at && new Date(i.at).getTime() > s; }).length; }

  function bell(acts) {
    if (!acts) return;
    var list = items(), n = unread(list);
    var b = acts.querySelector('#w212bell');
    if (!b) { acts.insertAdjacentHTML('afterbegin', '<button type="button" id="w212bell" aria-haspopup="true" aria-expanded="false"></button>'); b = acts.querySelector('#w212bell'); }
    var label = list.length + (list.length === 1 ? ' thing needs' : ' things need') + ' you' + (n ? ', ' + n + ' new' : '');
    /* only touch the DOM when something changed: the HR centre's observers watch every change */
    if (b.getAttribute('aria-label') !== 'Notifications: ' + label) { b.setAttribute('aria-label', 'Notifications: ' + label); b.title = label; }
    var html = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>' + (n ? '<span class="w212n">' + (n > 9 ? '9+' : n) + '</span>' : '');
    if (b.__w212html !== html) { b.innerHTML = html; b.__w212html = html; }
    B.items = list;
    if (B.open) paintBox();
  }
  function paintBox() {
    var box = document.getElementById('w212box'); if (!box) { box = document.createElement('div'); box.id = 'w212box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'What needs you'); document.body.appendChild(box); }
    var b = document.getElementById('w212bell'); if (!b) return;
    var r = b.getBoundingClientRect(), s = seenAt();
    box.style.top = Math.round(r.bottom + 8) + 'px';
    var w = Math.min(360, window.innerWidth - 16);
    box.style.left = Math.round(Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))) + 'px'; box.style.right = 'auto';
    box.innerHTML = '<h3>What needs you</h3>' + (B.items.length ? '<ul>' + B.items.map(function (i, ix) {
      var isNew = i.at && new Date(i.at).getTime() > s;
      return '<li><button type="button" data-w212i="' + ix + '" class="w212k-' + i.k + (isNew ? ' new' : '') + '"><span class="ic" aria-hidden="true">' + i.ic + '</span><span><b>' + E(i.t) + '</b><small>' + E(i.s) + '</small></span></button></li>';
    }).join('') + '</ul>' : '<p>Nothing needs you right now.</p>');
    box.classList.add('open');
  }
  function toggle() {
    B.open = !B.open;
    var b = document.getElementById('w212bell'); if (b) b.setAttribute('aria-expanded', B.open ? 'true' : 'false');
    if (B.open) { B.items = items(); paintBox(); markSeen(); setTimeout(function () { var x = document.querySelector('#w212bell .w212n'); if (x) { x.remove(); var bb = document.getElementById('w212bell'); if (bb) bb.__w212html = bb.innerHTML; } }, 0); }
    else { var box = document.getElementById('w212box'); if (box) box.classList.remove('open'); }
  }
  function shut() { if (!B.open) return; B.open = false; var box = document.getElementById('w212box'); if (box) box.classList.remove('open'); var b = document.getElementById('w212bell'); if (b) b.setAttribute('aria-expanded', 'false'); }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    if (t.closest('#w212bell')) { toggle(); return; }
    var it = t.closest('#w212box [data-w212i]');
    if (it) { var i = B.items[Number(it.getAttribute('data-w212i'))]; shut(); if (!i) return; if (i.id) { if (!/^#hrcentre\/applications/.test(location.hash)) location.hash = '#hrcentre/applications'; setTimeout(function () { try { w197.openSheet(i.id); } catch (x) { /* fine */ } }, 250); } else if (i.go) location.hash = i.go; return; }
    if (B.open && !t.closest('#w212box')) shut();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && B.open) { shut(); var b = document.getElementById('w212bell'); if (b) try { b.focus(); } catch (x) { /* fine */ } } });
  window.addEventListener('hashchange', shut);

  var css = document.createElement('style'); css.id = 'w212css';
  var stageCss = Object.keys(STAGE).map(function (k) {
    var c = STAGE[k];
    return '#hrcentre .w197col[data-w197col="' + k + '"]{background:' + c + '1f;border-top:4px solid ' + c + ';}' +
      '#hrcentre .w197col[data-w197col="' + k + '"] h4{color:' + (k === 'reviewing' ? '#7a5a0c' : c) + ';}' +
      '#hrcentre .w197col[data-w197col="' + k + '"] h4 small{background:' + c + ';color:' + (k === 'reviewing' ? GREEN : '#FFFAF2') + ';}' +
      '#hrcentre .w197col[data-w197col="' + k + '"] .w197cand{border-left:4px solid ' + c + ';}';
  }).join('');
  var tileCols = [TEAL, GOLD, PURPLE, CORAL, GREEN, FLAG];
  css.textContent = stageCss +
    tileCols.map(function (c, i) { return '#hrcentre .w197tiles > .w197tile:nth-child(6n+' + (i + 1) + '){border-top:4px solid ' + c + ';}#hrcentre .w197tiles > .w197tile:nth-child(6n+' + (i + 1) + ') b{color:' + (c === GOLD ? '#9a7110' : c) + ';}'; }).join('') +
    '#hrcentre .w197tile:hover{box-shadow:0 10px 24px -14px rgba(16,63,57,.45);}' +
    '#hrcentre .w197cand:hover{box-shadow:0 8px 18px -12px rgba(16,63,57,.5);}' +
    '#hrcentre .w105ok{background:' + TEAL + '!important;color:#FFFAF2!important;}#hrcentre .w105no{background:' + FLAG + '!important;color:#FFFAF2!important;}#hrcentre .w105pend{background:' + GOLD + '!important;color:' + GREEN + '!important;}' +
    '#hrcentre .w105ok,#hrcentre .w105no,#hrcentre .w105pend{border-radius:999px;padding:1px 8px;font-size:12px;font-weight:700;}' +
    '#hrcentre .w212toacts{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px;}' +
    '#hrcentre .w212towrap{overflow-x:auto;}#hrcentre .w212tot td.w212low{color:' + FLAG + ';font-weight:700;}#hrcentre .w212tot th:last-child,#hrcentre .w212tot th:nth-last-child(2){color:' + PURPLE + ';}' +
    '#hrcentre .w212past{margin:12px 0 0;}#hrcentre .w212past summary{cursor:pointer;font-weight:600;color:' + GREEN + ';}' +
    '#w212bell{position:relative;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;border:1px solid rgba(16,63,57,.2);background:var(--wa-card,#FFFAF2);color:' + GREEN + ';cursor:pointer;}' +
    '#w212bell:hover{border-color:' + GREEN + ';}#w212bell .w212n{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:999px;background:' + CORAL + ';color:#FFFAF2;font-size:11px;font-weight:700;line-height:18px;padding:0 4px;box-sizing:border-box;}' +
    '#w212box{position:fixed;z-index:8800;width:min(360px,calc(100vw - 16px));max-height:min(70vh,520px);overflow:auto;background:var(--wa-card,#FFFAF2);border:1px solid rgba(16,63,57,.18);border-radius:16px;box-shadow:0 24px 50px -20px rgba(16,63,57,.55);padding:12px;display:none;}' +
    '#w212box.open{display:block;}#w212box h3{margin:2px 6px 8px;font-size:15px;color:' + GREEN + ';}#w212box p{margin:6px;font-size:14px;}' +
    '#w212box ul{list-style:none;margin:0;padding:0;}#w212box li button{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;background:none;border:none;border-radius:10px;padding:8px;cursor:pointer;font:inherit;color:inherit;}' +
    '#w212box li button:hover{background:rgba(16,63,57,.06);}#w212box li button.new{background:rgba(217,101,75,.10);}#w212box .ic{font-size:16px;line-height:1.3;width:20px;text-align:center;}' +
    '#w212box b{display:block;font-size:13.5px;}#w212box small{display:block;font-size:12.5px;color:#5b6b67;}' +
    '@media (prefers-color-scheme: dark){#w212box small{color:inherit;opacity:.75;}}';
  (document.head || document.documentElement).appendChild(css);

  /* the counts follow the data: a light refresh while the HR centre is open */
  setInterval(function () { var a = document.querySelector('#hrcentre > .w118mast .w197acts'); if (a && document.getElementById('w212bell')) bell(a); }, 20000);

  window.w212 = { bell: bell, items: items, toggle: toggle, state: function () { return B; } };
})();
