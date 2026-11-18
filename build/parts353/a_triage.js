<script>
/* =====================================================================
   WA v353 Triage: tasks and requests, one card at a time (18/11/26)
   =====================================================================
   Steel (18/11/26): Ask the Hub and the overdue tasks no longer showed when people opened the Hub. He wants a swipe
   experience: right = the task is done; left = a later date (the next meeting, in 7 days or a date of their choice);
   on the card, move it to the task bank, reassign it, or move it to a different project. Leaders triage the requests
   that reach them the same way: keep it, send it on to a person or a team (Amanda sends a marketing request back to
   marketing), set where it stands, and the Hub learns where each kind of request belongs.

   - Why nothing showed: wave213's due-date check and wave320's note both started from the end of the startApp
     chain; wave320's note tried three times in its first 52 seconds and gave up for the day whenever something else
     was open (the due-date check itself, the Loop's gate, a tour). Triage starts on its own once the Hub has loaded
     (the loading screen lifted, signed in, on the roster), and the note is tried again for ten minutes once nothing
     covers it.
   - Triage (#w353): replaces wave213's list for the same rows (wa237_due_check) and saves through the same
     confirm_due_check (done, a date, bank, assign, not mine, discard). Right = Done, left = Later (Next meeting,
     In 7 days, Pick a date, or Keep the date a meeting set). On the card: Task bank, Reassign, Move project
     (wa353_task_project), Discard, and Mine / Not mine when the meeting was unsure. Each choice waits 5 seconds with
     Undo before it saves. Tasks must be sorted before it closes, as the due-date check required.
   - Requests (wa353_request_deck, wa353_request_triage): right = Mine (keep it), left = Send on (a team, a person,
     or both; "Always send these here" saves a wa353_request_rules row so the next one goes there by itself). Where
     it stands (the type's own statuses) and Done on the card. A request can wait: Finish later closes once only
     requests are left. The same choice for every request of that kind on one tick.
   - When everything is sorted: Ask the Hub what's next opens the chat with The Hub suggests.
   - Home: "Sort tasks and requests (n)" opens Triage any time (#w353home).
   ===================================================================== */
(function () {
  if (window.__wa353) return; window.__wa353 = true;
  var S = { tasks: [], reqs: [], deck: [], i: 0, q: [], timer: null, open: false, started: false, members: null, projects: null, sheet: null, done: 0, last: null };
  var RM = false; try { RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* fine */ }

  var css = document.createElement('style');
  css.textContent = [
    '#w353{position:fixed;inset:0;z-index:9300;background:rgba(10,32,29,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;}',
    '#w353 .wrap{width:100%;max-width:440px;display:flex;flex-direction:column;gap:12px;max-height:100%;}',
    '#w353 .top{display:flex;align-items:center;justify-content:space-between;color:#fff;gap:10px;}',
    '#w353 .top h2{margin:0;font-size:18px;color:#fff;font-weight:700;}',
    '#w353 .top .n{font-size:13px;opacity:.85;white-space:nowrap;}',
    '#w353 .bar{height:4px;border-radius:4px;background:rgba(255,255,255,.25);overflow:hidden;}',
    '#w353 .bar i{display:block;height:100%;background:#F2B33D;transition:width .3s cubic-bezier(.23,1,.32,1);}',
    '#w353 .stage{position:relative;min-height:340px;}',
    '#w353 .card{position:relative;background:#FFFAF2;color:#103F39;border-radius:20px;padding:20px 20px 16px;box-shadow:0 18px 40px rgba(0,0,0,.25);touch-action:pan-y;user-select:none;-webkit-user-select:none;will-change:transform;}',
        '#w353 .chip{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:rgba(16,63,57,.08);margin:0 6px 8px 0;}',
    '#w353 .chip.late{background:#FBE3DC;color:#8A2B12;} #w353 .chip.today{background:#FFF0C7;color:#6B4A00;} #w353 .chip.team{background:#E3F1EC;}',
    '#w353 .card:focus{outline:none;}',
    '#w353 h3{margin:4px 0 6px;text-transform:none;letter-spacing:0;font-size:21px;line-height:1.25;color:#103F39;word-break:break-word;}',
    '#w353 .meta{font-size:13px;opacity:.8;line-height:1.45;margin:0 0 10px;}',
    '#w353 .det{font-size:13px;background:#fff;border-radius:12px;padding:8px 10px;margin:0 0 10px;max-height:120px;overflow:auto;border:1px solid rgba(16,63,57,.08);}',
    '#w353 .det div{margin:2px 0;} #w353 .det b{font-weight:600;}',
    '#w353 .sug{font-size:13px;margin:0 0 10px;padding:8px 10px;border-radius:12px;background:#E3F1EC;display:flex;gap:8px;align-items:center;justify-content:space-between;}',
    '#w353 .hint{font-size:12px;opacity:.65;text-align:center;margin:6px 0 10px;}',
    '#w353 .big{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
    '#w353 button{font:inherit;cursor:pointer;border:0;border-radius:12px;min-height:44px;transition:transform .12s ease;}',
    '#w353 button:active{transform:scale(.97);}',
    '#w353 .big button{font-weight:700;font-size:15px;padding:10px;}',
    '#w353 .l{background:#fff;color:#103F39;border:1.5px solid rgba(16,63,57,.25)!important;} #w353 .r{background:#103F39;color:#fff;}',
    '#w353 .small{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;justify-content:center;}',
    '#w353 .small button{background:transparent;color:#103F39;font-size:13px;padding:6px 10px;min-height:36px;text-decoration:underline;text-underline-offset:3px;}',
    '#w353 .stamp{position:absolute;top:18px;padding:4px 10px;border:3px solid;border-radius:10px;font-weight:800;font-size:18px;opacity:0;pointer-events:none;text-transform:uppercase;}',
    '#w353 .stamp.ok{right:18px;color:#1E7A4F;transform:rotate(10deg);} #w353 .stamp.no{left:18px;color:#B25E00;transform:rotate(-10deg);}',
    '#w353 .foot{display:flex;justify-content:space-between;align-items:center;color:#fff;font-size:13px;min-height:44px;gap:8px;}',
    '#w353 .foot button{background:rgba(255,255,255,.14);color:#fff;padding:8px 14px;}',
    '#w353 .sheet{position:fixed;left:0;right:0;bottom:0;z-index:9400;background:#FFFAF2;color:#103F39;border-radius:20px 20px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -12px 30px rgba(0,0,0,.25);max-height:80vh;overflow:auto;}',
    '@media (min-width:700px){#w353 .sheet{left:50%;right:auto;bottom:50%;transform:translate(-50%,50%);width:420px;border-radius:20px;}}',
    '#w353 .sheet h4{margin:0 0 4px;font-size:17px;} #w353 .sheet p{margin:0 0 12px;font-size:13px;opacity:.8;}',
    '#w353 .opts{display:flex;flex-direction:column;gap:8px;}',
    '#w353 .opts button,#w353 .opts label.o{background:#fff;color:#103F39;text-align:left;padding:10px 14px;border:1.5px solid rgba(16,63,57,.18)!important;display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:15px;}',
    '#w353 .opts button span{opacity:.7;font-size:13px;}',
    '#w353 .opts button.on{border-color:#103F39!important;background:#E3F1EC;}',
    '#w353 select,#w353 input[type=date]{font:inherit;font-size:16px;width:100%;padding:10px;border-radius:12px;border:1.5px solid rgba(16,63,57,.25);background:#fff;color:#103F39;min-height:44px;box-sizing:border-box;}',
    '#w353 .chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;}',
    '#w353 .chips button{background:#fff;border:1.5px solid rgba(16,63,57,.2)!important;padding:6px 12px;font-size:14px;min-height:40px;color:#103F39;}',
    '#w353 .chips button.on{background:#103F39;color:#fff;}',
    '#w353 .row2{display:flex;gap:8px;margin-top:12px;} #w353 .row2 button{flex:1;font-weight:700;}',
    '#w353 .chk{display:flex;gap:8px;align-items:flex-start;font-size:14px;margin:10px 0 0;} #w353 .chk input{width:20px;height:20px;margin:0;flex:none;}',
    '#w353 .lbl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin:10px 0 6px;}',
    '#w353 .undo{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top));max-width:calc(100% - 24px);transform:translateX(-50%);z-index:9500;background:#103F39;color:#fff;border-radius:999px;padding:6px 6px 6px 16px;display:flex;gap:10px;align-items:center;font-size:14px;box-shadow:0 8px 20px rgba(0,0,0,.25);}',
    '#w353 .undo span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '#w353 .undo button{background:#F2B33D;color:#103F39;font-weight:700;padding:6px 14px;min-height:36px;border-radius:999px;}',
    '#w353 .end{text-align:center;padding:30px 20px;} #w353 .end .heart{font-size:40px;display:inline-block;}',
    '#w353 .end .heart.pop{animation:w353pop .32s cubic-bezier(.34,1.56,.64,1);}',
    '@keyframes w353pop{from{transform:scale(.9)}to{transform:scale(1)}}',
    '#w353 .err{color:#8A2B12;font-size:13px;margin:8px 0 0;}',
    '#w353home{grid-column:1/-1;order:-1;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#103F39;color:#fff;border-radius:16px;padding:12px 16px;margin:0 0 12px;}',
    '#w353home b{font-size:15px;} #w353home span{font-size:13px;opacity:.85;display:block;}',
    '#w353home button{background:#F2B33D;color:#103F39;font-weight:700;border:0;border-radius:12px;padding:10px 16px;min-height:44px;cursor:pointer;font:inherit;white-space:nowrap;}',
    '@media (prefers-reduced-motion: reduce){#w353 *{transition:none!important;animation:none!important;}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- helpers ---------- */
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function ymd(d) { var x = new Date(d); x.setHours(12, 0, 0, 0); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function today() { return ymd(new Date()); }
  function plus(n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return ymd(d); }
  function day(s) { if (!s) return ''; try { return new Date(String(s).slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return s; } }
  function team(k) { if (k === 'finance') return 'Finance'; try { return (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[k]) || k || ''; } catch (e) { return k || ''; } }
  function teams() { var t = []; try { t = (window.WA_TEAMS && WA_TEAMS.order) ? WA_TEAMS.order.slice() : Object.keys(DEPT_LABEL || {}); } catch (e) { t = ['fundraising', 'marketing', 'opsmtl', 'opsto', 'progdev', 'hr', 'board']; } if (t.indexOf('finance') < 0) t.push('finance'); return t; }
  function me() { try { return (typeof WA_ME !== 'undefined' && WA_ME) ? WA_ME : null; } catch (e) { return null; } }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
  function staff() { try { return typeof isStaff === 'function' ? isStaff() : !!me(); } catch (e) { return false; } }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function future(d) { return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d > today(); }
  function members() {
    var all = []; try { all = (typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || []; } catch (e) { /* fine */ }
    if ((!all || !all.length) && window.WA_ROSTER) all = WA_ROSTER;
    return (all || []).filter(function (m) { return m && m.name && m.active !== false; });
  }
  function people(dept) {
    var a = members(), own = a.filter(function (m) { return m.department === dept; }), rest = a.filter(function (m) { return m.department !== dept; });
    var by = function (x, y) { return String(x.name).localeCompare(String(y.name)); };
    return own.sort(by).concat(rest.sort(by));
  }

  /* ---------- load ---------- */
  async function loadTasks() {
    try { var r = await db.rpc('wa237_due_check'); if (r && !r.error && Array.isArray(r.data)) return r.data; } catch (e) { /* fine */ }
    return null;
  }
  async function loadReqs() {
    try { var r = await db.rpc('wa353_request_deck'); if (r && !r.error && Array.isArray(r.data)) return r.data; } catch (e) { /* fine */ }
    return [];
  }
  async function loadProjects() {
    if (S.projects) return S.projects;
    try { var r = await db.from('projects').select('id,name,department,status,is_general').is('banked_at', null).order('name'); S.projects = (r && r.data) || []; } catch (e) { S.projects = []; }
    S.projects = S.projects.filter(function (p) { return !/^(done|closed|complete|archived)/i.test(String(p.status || '')); });
    return S.projects;
  }

  function build() {
    var d = [];
    S.tasks.forEach(function (r) { d.push({ kind: 'task', r: r }); });
    S.reqs.forEach(function (r) { d.push({ kind: 'req', r: r }); });
    S.deck = d; S.i = 0;
  }
  function tasksLeft() { for (var k = S.i; k < S.deck.length; k++) if (S.deck[k].kind === 'task') return true; return false; }

  /* ---------- the overlay ---------- */
  function root() {
    var el = document.getElementById('w353');
    if (!el) {
      el = document.createElement('div'); el.id = 'w353'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Triage');
      document.body.appendChild(el); wire(el);
      document.addEventListener('keydown', keys, true);
    }
    return el;
  }
  function close() {
    flush();
    var el = document.getElementById('w353'); if (el) el.remove();
    document.removeEventListener('keydown', keys, true);
    S.open = false; homeCard();
    afterClose();
  }
  function counts() {
    var t = 0, q = 0; for (var k = S.i; k < S.deck.length; k++) { if (S.deck[k].kind === 'task') t++; else q++; }
    return { t: t, q: q };
  }
  function chipFor(c) {
    var r = c.r;
    if (c.kind === 'req') return '<span class="chip ' + (r.why === 'yours' ? '' : 'team') + '">' + (r.why === 'yours' ? 'Request for you' : 'Request for ' + E(team(r.department))) + '</span>' + (r.type_label ? '<span class="chip">' + E(r.type_label) + '</span>' : '');
    if (r.for_lead) return '<span class="chip team">Who owns this?</span>';
    if (r.owner_unsure) return '<span class="chip team">Is this yours?</span>';
    if (r.why === 'overdue') return '<span class="chip late">Overdue · was due ' + E(day(r.due_date)) + '</span>';
    if (r.why === 'due_today') return '<span class="chip today">Due today</span>';
    if (r.why === 'no_date') return '<span class="chip">No date yet</span>';
    if (r.why === 'meeting_set') return '<span class="chip">A meeting set ' + E(day(r.due_date)) + '</span>';
    return '<span class="chip">Due ' + E(day(r.due_date)) + '</span>';
  }
  function detailsHtml(d) {
    if (!d) return '';
    if (typeof d === 'string') return '<div class="det">' + E(d.slice(0, 600)) + '</div>';
    var keys = Object.keys(d).filter(function (k) { var v = d[k]; return v != null && v !== '' && typeof v !== 'object'; }).slice(0, 6);
    if (!keys.length) return '';
    return '<div class="det">' + keys.map(function (k) { return '<div><b>' + E(k) + ':</b> ' + E(String(d[k]).slice(0, 240)) + '</div>'; }).join('') + '</div>';
  }
  function cardHtml(c) {
    var r = c.r, h = '<span class="stamp ok">' + (c.kind === 'req' ? 'Mine' : 'Done') + '</span><span class="stamp no">' + (c.kind === 'req' ? 'Send on' : 'Later') + '</span>' + chipFor(c);
    if (c.kind === 'task') {
      h += '<h3>' + E(r.title || 'A task') + '</h3>';
      var m = [team(r.department)]; if (r.owner && (r.for_lead || r.owner_unsure)) m.push('on it: ' + r.owner); if (r.meeting_title) m.push('from ' + r.meeting_title);
      h += '<p class="meta">' + E(m.filter(Boolean).join(' · ')) + '</p>';
      if (r.owner_unsure && !r.for_lead) {
        h += '<div class="big"><button type="button" class="l" data-a="notmine">Not mine</button><button type="button" class="r" data-a="mine">Yes, mine</button></div><p class="hint">The meeting wasn’t sure who has this.</p>';
        return h;
      }
      h += '<p class="hint">Swipe right when it’s done, left to give it a later date.</p>';
      h += '<div class="big"><button type="button" class="l" data-a="later">← Later</button><button type="button" class="r" data-a="done">Done →</button></div>';
      h += '<div class="small">' + (r.for_lead ? '<button type="button" data-a="assign"><b>Give it to someone</b></button>' : '<button type="button" data-a="assign">Reassign</button>')
        + '<button type="button" data-a="bank">Task bank</button><button type="button" data-a="project">Move project</button><button type="button" data-a="discard">Discard</button></div>';
      return h;
    }
    h += '<h3>' + E(r.title || r.type_label || 'A request') + '</h3>';
    var mm = []; if (r.requested_by) mm.push('from ' + r.requested_by); if (r.created_at) mm.push(day(r.created_at)); if (r.needed_by) mm.push('needed by ' + day(r.needed_by)); if (r.status) mm.push(r.status); if (r.assignee && r.why !== 'yours') mm.push('with ' + r.assignee);
    h += '<p class="meta">' + E(mm.join(' · ')) + '</p>' + detailsHtml(r.details);
    if ((r.suggest_department || r.suggest_person) && !(r.suggest_department === r.department && !r.suggest_person)) {
      h += '<div class="sug"><span>Last time these went to ' + E([r.suggest_person, r.suggest_department ? team(r.suggest_department) : ''].filter(Boolean).join(', ')) + '</span><button type="button" class="r" style="padding:6px 12px;min-height:36px" data-a="sendsug">Send there</button></div>';
    }
    h += '<p class="hint">Swipe right to keep it, left to send it to a person or a team.</p>';
    h += '<div class="big"><button type="button" class="l" data-a="route">← Send on</button><button type="button" class="r" data-a="keep">Mine →</button></div>';
    h += '<div class="small"><button type="button" data-a="status">Where it stands</button><button type="button" data-a="rdone">Mark done</button><button type="button" data-a="openreq">Open in Requests</button></div>';
    return h;
  }
  function paint() {
    var el = root(); S.open = true;
    var c = S.deck[S.i], n = counts(), total = S.deck.length || 1;
    var pct = Math.round(100 * S.i / total);
    var h = '<div class="wrap"><div class="top"><h2>' + (c ? (c.kind === 'req' ? 'Sort your requests' : 'Sort your tasks') : 'All sorted') + '</h2><span class="n">' + (c ? (n.t ? n.t + ' task' + (n.t === 1 ? '' : 's') : '') + (n.t && n.q ? ' · ' : '') + (n.q ? n.q + ' request' + (n.q === 1 ? '' : 's') : '') + ' left' : '') + '</span></div>'
      + '<div class="bar"><i style="width:' + pct + '%"></i></div><div class="stage">';
    if (c) {
      h += '<div class="card" data-card="1" tabindex="-1">' + cardHtml(c) + '</div>';
    } else {
      h += '<div class="card end"><div class="heart' + (RM ? '' : ' pop') + '" aria-hidden="true">💛</div><h3>You’re all caught up</h3><p class="meta">' + (S.done ? S.done + ' sorted. ' : '') + 'Nice work, ' + E(first((me() || {}).name)) + '.</p>'
        + '<div class="row2"><button type="button" class="l" data-a="close">Close</button><button type="button" class="r" data-a="ask">Ask the Hub what’s next</button></div></div>';
    }
    h += '</div><div class="foot"><span>' + (c && c.kind === 'task' ? 'Tasks first, then anything waiting on you.' : '') + '</span>'
      + (c && !tasksLeft() ? '<button type="button" data-a="close">Finish later</button>' : (c ? '<button type="button" data-a="skip">Skip for now</button>' : '')) + '</div></div>';
    el.innerHTML = h;
    paintUndo();
    var card = el.querySelector('[data-card]'); if (card) { swipe(card); try { card.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  function paintUndo() {
    var el = document.getElementById('w353'); if (!el) return;
    var u = el.querySelector('.undo'); if (u) u.remove();
    if (!S.last) return;
    var d = document.createElement('div'); d.className = 'undo'; d.setAttribute('role', 'status');
    d.innerHTML = '<span>' + E(S.last.say) + '</span><button type="button" data-a="undo">Undo</button>';
    el.appendChild(d);
  }

  /* ---------- swipe ---------- */
  function swipe(card) {
    var x0 = 0, y0 = 0, dx = 0, on = false, t0 = 0, id = null, horiz = null;
    var ok = card.querySelector('.stamp.ok'), no = card.querySelector('.stamp.no');
    var c = S.deck[S.i]; if (c && c.kind === 'task' && c.r.owner_unsure && !c.r.for_lead) return;   /* Mine / Not mine is a question, not a swipe */
    card.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('button,select,input,a,.det')) return;
      on = true; x0 = e.clientX; y0 = e.clientY; dx = 0; t0 = Date.now(); id = e.pointerId; horiz = null;
      card.style.transition = 'none';
    });
    card.addEventListener('pointermove', function (e) {
      if (!on || e.pointerId !== id) return;
      var mx = e.clientX - x0, my = e.clientY - y0;
      if (horiz === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) { horiz = Math.abs(mx) > Math.abs(my); if (horiz) { try { card.setPointerCapture(id); } catch (e2) { /* fine */ } } }
      if (!horiz) return;
      dx = mx; e.preventDefault();
      card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 20) + 'deg)';
      var p = Math.min(1, Math.abs(dx) / 110);
      if (ok) ok.style.opacity = dx > 0 ? p : 0; if (no) no.style.opacity = dx < 0 ? p : 0;
    });
    function end(e) {
      if (!on || (e && e.pointerId !== id)) return; on = false;
      var w = card.getBoundingClientRect().width || 300, v = Math.abs(dx) / Math.max(1, Date.now() - t0);
      if (horiz && (Math.abs(dx) > w * 0.33 || (v > 0.6 && Math.abs(dx) > 40))) { fling(card, dx > 0 ? 1 : -1, function () { act(dx > 0 ? 'right' : 'left'); }); return; }
      card.style.transition = RM ? 'none' : 'transform .35s cubic-bezier(.23,1,.32,1)'; card.style.transform = '';
      if (ok) ok.style.opacity = 0; if (no) no.style.opacity = 0;
    }
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }
  function fling(card, dir, then) {
    if (RM || !card) { then(); return; }
    card.style.transition = 'transform .22s ease-in, opacity .22s ease-in';
    card.style.transform = 'translateX(' + (dir * (window.innerWidth || 600)) + 'px) rotate(' + (dir * 18) + 'deg)'; card.style.opacity = '0';
    setTimeout(then, 200);
  }
  function snapBack() { var card = document.querySelector('#w353 [data-card]'); if (card) { card.style.transition = RM ? 'none' : 'transform .35s cubic-bezier(.23,1,.32,1)'; card.style.transform = ''; card.style.opacity = ''; card.querySelectorAll('.stamp').forEach(function (s) { s.style.opacity = 0; }); } }

  /* ---------- actions ---------- */
  function act(dir) {
    var c = S.deck[S.i]; if (!c) return;
    if (c.kind === 'task') { if (dir === 'right') commit({ id: c.r.task_id, action: 'done' }, 'Done: ' + (c.r.title || 'task')); else laterSheet(c); }
    else { if (dir === 'right') commit({ id: c.r.id, action: 'keep', req: true }, 'Kept: ' + (c.r.title || 'request')); else routeSheet(c); }
  }
  function mineFlag(c, item) { if (c.kind === 'task' && c.mine) item.mine = true; return item; }
  function commit(item, say, bulk) {
    var c = S.deck[S.i]; if (!c) return;
    closeSheet();
    item = mineFlag(c, item);
    var batch = [{ item: item, card: c, at: S.i }];
    if (bulk && c.kind === 'req') {   /* the same for every request of this kind still in the deck */
      for (var k = S.deck.length - 1; k > S.i; k--) {
        var o = S.deck[k];
        if (o.kind === 'req' && o.r.type_key === c.r.type_key && o.r.department === c.r.department) { var it = Object.assign({}, item, { id: o.r.id }); batch.push({ item: it, card: o, at: k }); S.deck.splice(k, 1); }
      }
      if (batch.length > 1) say += ' (and ' + (batch.length - 1) + ' more)';
    }
    flush();
    S.q = batch; S.last = { say: say, batch: batch, i: S.i };
    S.i++; S.done += batch.length;
    clearTimeout(S.timer); S.timer = setTimeout(flush, 5000);
    paint();
  }
  function undo() {
    if (!S.last) return;
    clearTimeout(S.timer);
    var L = S.last; S.q = []; S.last = null;
    S.done -= L.batch.length;
    L.batch.slice(1).forEach(function (b) { S.deck.splice(L.i + 1, 0, b.card); });
    S.i = L.i; paint();
  }
  async function flush() {
    clearTimeout(S.timer);
    var q = S.q; S.q = []; S.last = null; paintUndo();
    if (!q || !q.length) return;
    var tasks = q.filter(function (b) { return !b.item.req; }).map(function (b) { var x = Object.assign({}, b.item); delete x.req; return x; });
    var reqs = q.filter(function (b) { return b.item.req; }).map(function (b) { var x = Object.assign({}, b.item); delete x.req; return x; });
    try {
      if (tasks.length) {
        var r = await db.rpc('confirm_due_check', { p: tasks });
        if (r.error) throw r.error;
        var sk = (r.data && r.data.skipped) || []; if (sk.length) toastS(sk.length === 1 ? 'One task was not saved: ' + (sk[0].why || '') : sk.length + ' tasks were not saved');
      }
      if (reqs.length) {
        var r2 = await db.rpc('wa353_request_triage', { p: reqs });
        if (r2.error) throw r2.error;
        if (r2.data && r2.data.rules) toastS('Got it. The Hub will send these there from now on.');
      }
      refresh();
    } catch (e) {
      toastS('That didn’t save. It’s back in the deck.');
      q.forEach(function (b) { S.deck.push(b.card); }); S.done -= q.length;
      if (S.open) paint();
    }
  }
  var refreshT = null;
  function refresh() {
    clearTimeout(refreshT);
    refreshT = setTimeout(async function () {
      try { if (typeof loadAll === 'function') { await loadAll(); if (typeof renderAllSections === 'function') renderAllSections(); if (typeof renderDashboard === 'function') renderDashboard(); if (typeof renderNeedsMe === 'function') renderNeedsMe(); } } catch (e) { /* the pages refresh on their next load */ }
    }, 1500);
  }

  /* ---------- sheets ---------- */
  function closeSheet() { var s = document.querySelector('#w353 .sheet'); if (s) s.remove(); S.sheet = null; }
  function sheet(html, onClick) {
    closeSheet();
    var el = root(), s = document.createElement('div'); s.className = 'sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
    s.innerHTML = html + '<div class="row2"><button type="button" class="l" data-s="cancel">Cancel</button></div>';
    el.appendChild(s); S.sheet = onClick;
    s.addEventListener('click', function (e) {
      var b = e.target.closest('[data-s]'); if (!b) return;
      if (b.getAttribute('data-s') === 'cancel') { closeSheet(); snapBack(); return; }
      onClick(b.getAttribute('data-s'), b, s);
    });
    var f = s.querySelector('button,select,input'); if (f) try { f.focus(); } catch (e) { /* fine */ }
    return s;
  }
  function laterSheet(c) {
    var r = c.r, nm = r.next_meeting, keep = (r.why === 'meeting_set' || r.why === 'owner_check' || r.why === 'due_today') && r.due_date && r.due_date >= today();
    var h = '<h4>When should it come back?</h4><p>' + E(r.title || '') + '</p><div class="opts">'
      + (keep ? '<button type="button" data-s="keep">Keep the date <span>' + E(day(r.due_date)) + '</span></button>' : '')
      + (nm ? '<button type="button" data-s="nm">Next meeting <span>' + E(day(nm)) + '</span></button>' : '')
      + '<button type="button" data-s="7">In 7 days <span>' + E(day(plus(7))) + '</span></button>'
      + '<label class="o" style="flex-direction:column;align-items:stretch">Pick a date<input type="date" min="' + today() + '" value="' + E(r.suggested && r.suggested > today() ? r.suggested : plus(14)) + '"></label>'
      + '<button type="button" data-s="pick"><b>Use this date</b></button></div>';
    sheet(h, function (k, b, s) {
      var d = k === 'keep' ? r.due_date : k === 'nm' ? nm : k === '7' ? plus(7) : k === 'pick' ? (s.querySelector('input[type=date]') || {}).value : null;
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today()) { toastS('Pick a day that is still ahead.'); return; }
      var it = r.for_lead ? null : { id: r.task_id, due: d };
      if (r.for_lead) { toastS('Give it to someone first, or mark it done.'); return; }
      commit(it, 'Moved to ' + day(d));
    });
  }
  function bankSheet(c) {
    var r = c.r;
    sheet('<h4>Put it in the task bank</h4><p>It leaves your list and comes back on the day you pick.</p><div class="opts">'
      + '<button type="button" data-s="14">In 2 weeks <span>' + E(day(plus(14))) + '</span></button>'
      + '<button type="button" data-s="30">In a month <span>' + E(day(plus(30))) + '</span></button>'
      + '<button type="button" data-s="90">In 3 months <span>' + E(day(plus(90))) + '</span></button>'
      + '<label class="o" style="flex-direction:column;align-items:stretch">Pick a day<input type="date" min="' + plus(1) + '" value="' + plus(60) + '"></label>'
      + '<button type="button" data-s="pick"><b>Use this day</b></button></div>', function (k, b, s) {
      var d = k === 'pick' ? (s.querySelector('input[type=date]') || {}).value : plus(Number(k));
      if (!d || d <= today()) { toastS('The bank needs a day in the future.'); return; }
      commit({ id: r.task_id, action: 'bank', until: d }, 'In the bank until ' + day(d));
    });
  }
  function assignSheet(c) {
    var r = c.r, ppl = people(r.department), mine = first((me() || {}).name).toLowerCase();
    sheet('<h4>Who should have it?</h4><p>' + E(r.title || '') + '</p>'
      + '<select aria-label="Who should have it"><option value="">Pick someone…</option>' + ppl.filter(function (m) { return first(m.name).toLowerCase() !== mine || r.for_lead; }).map(function (m) { return '<option value="' + E(m.name) + '">' + E(m.name) + (m.department !== r.department ? ' (' + E(team(m.department)) + ')' : '') + '</option>'; }).join('') + '</select>'
      + '<div class="lbl">Due</div><input type="date" min="' + today() + '" value="' + E(r.due_date && r.due_date >= today() ? r.due_date : (r.next_meeting || plus(7))) + '">'
      + '<div class="row2"><button type="button" class="r" data-s="go">Send it to them</button></div>', function (k, b, s) {
      if (k !== 'go') return;
      var who = s.querySelector('select').value, d = s.querySelector('input[type=date]').value;
      if (!who) { toastS('Pick someone first.'); return; }
      commit({ id: r.task_id, action: 'assign', owner: who, due: d && d >= today() ? d : undefined }, 'Sent to ' + first(who));
    });
  }
  async function projectSheet(c) {
    var r = c.r, ps = await loadProjects();
    var own = ps.filter(function (p) { return p.department === r.department; }), rest = ps.filter(function (p) { return p.department !== r.department; });
    var opt = function (p) { return '<option value="' + p.id + '">' + E(p.name) + (p.department !== r.department ? ' (' + E(team(p.department)) + ')' : '') + '</option>'; };
    sheet('<h4>Move it to another project</h4><p>' + E(r.title || '') + '</p><select aria-label="Project"><option value="">Pick a project…</option>'
      + (own.length ? '<optgroup label="' + E(team(r.department)) + '">' + own.map(opt).join('') + '</optgroup>' : '')
      + (rest.length ? '<optgroup label="Other teams">' + rest.map(opt).join('') + '</optgroup>' : '') + '</select>'
      + '<p style="margin-top:10px">It stays on your list; give it a date or mark it done after.</p><div class="row2"><button type="button" class="r" data-s="go">Move it</button></div>', async function (k, b, s) {
      if (k !== 'go') return;
      var pid = Number(s.querySelector('select').value); if (!pid) { toastS('Pick a project first.'); return; }
      b.disabled = true;
      var res = await db.rpc('wa353_task_project', { p_task: r.task_id, p_project: pid });
      if (res.error) { b.disabled = false; toastS('Could not move it: ' + (res.error.message || '')); return; }
      var d = res.data || {}; if (d.department) r.department = d.department;
      closeSheet(); toastS('Moved to ' + (d.project || 'the project')); refresh(); paint();
    });
  }
  function routeSheet(c) {
    var r = c.r, sel = { dept: r.suggest_department && r.suggest_department !== r.department ? r.suggest_department : '', person: r.suggest_person || '' };
    var lead = r.why === 'team' || (function () { try { return typeof isAdmin === 'function' && isAdmin(); } catch (e) { return false; } })();
    var tl = teams();
    function body() {
      return '<h4>Send it on</h4><p>' + E(r.title || '') + (r.department ? ' · now with ' + E(team(r.department)) : '') + '</p>'
        + '<div class="lbl">To a team</div><div class="chips">' + tl.map(function (t) { return '<button type="button" data-s="t:' + t + '" class="' + (sel.dept === t ? 'on' : '') + '">' + E(team(t)) + '</button>'; }).join('') + '</div>'
        + '<div class="lbl">Or a person</div><select aria-label="A person"><option value="">Anyone on the team</option>' + people(sel.dept || r.department).map(function (m) { return '<option value="' + E(m.name) + '"' + (sel.person === m.name ? ' selected' : '') + '>' + E(m.name) + ' (' + E(team(m.department)) + ')</option>'; }).join('') + '</select>'
        + (lead && r.type_key ? '<label class="chk"><input type="checkbox" data-al="1"> Always send “' + E(r.type_label || 'these') + '” here from now on</label>' : '')
        + (r.same_kind > 1 ? '<label class="chk"><input type="checkbox" data-bulk="1"> All ' + r.same_kind + ' like this</label>' : '')
        + '<div class="row2"><button type="button" class="r" data-s="go">Send it</button></div>';
    }
    var s = sheet(body(), function (k, b, sh) {
      if (k.indexOf('t:') === 0) { var t = k.slice(2); var keep = { al: (sh.querySelector('[data-al]') || {}).checked, bk: (sh.querySelector('[data-bulk]') || {}).checked }; sel.dept = sel.dept === t ? '' : t; sel.person = ''; sh.innerHTML = body() + '<div class="row2"><button type="button" class="l" data-s="cancel">Cancel</button></div>'; if (keep.al) sh.querySelector('[data-al]').checked = true; if (keep.bk && sh.querySelector('[data-bulk]')) sh.querySelector('[data-bulk]').checked = true; return; }
      if (k !== 'go') return;
      var person = sh.querySelector('select').value;
      if (!sel.dept && !person) { toastS('Pick a team or a person.'); return; }
      var always = !!(sh.querySelector('[data-al]') || {}).checked, bulk = !!(sh.querySelector('[data-bulk]') || {}).checked;
      commit({ id: r.id, action: 'route', department: sel.dept || undefined, person: person || undefined, always: always, req: true }, 'Sent to ' + (person ? first(person) : team(sel.dept)), bulk);
    });
    s.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') sel.person = e.target.value; });
  }
  function statusSheet(c) {
    var r = c.r, st = Array.isArray(r.statuses) && r.statuses.length ? r.statuses : ['Requested', 'In progress', 'Done'];
    sheet('<h4>Where it stands</h4><p>' + E(r.title || '') + '</p><div class="opts">' + st.map(function (x) { return '<button type="button" data-s="' + E(x) + '" class="' + (x === r.status ? 'on' : '') + '">' + E(x) + (x === r.status ? ' <span>now</span>' : '') + '</button>'; }).join('') + '</div>'
      + (r.same_kind > 1 ? '<label class="chk"><input type="checkbox" data-bulk="1"> All ' + r.same_kind + ' like this</label>' : ''), function (k, b, sh) {
      commit({ id: r.id, action: 'status', status: k, req: true }, k, !!(sh.querySelector('[data-bulk]') || {}).checked);
    });
  }

  /* ---------- clicks and keys ---------- */
  function wire(el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a'), c = S.deck[S.i];
      if (a === 'undo') { undo(); return; }
      if (a === 'close') { close(); return; }
      if (a === 'ask') { close(); setTimeout(function () { try { var cb = document.getElementById('waChatBtn'); if (cb) cb.click(); } catch (e2) { /* fine */ } }, 250); return; }
      if (a === 'skip') { if (c) { S.deck.splice(S.i, 1); S.deck.push(c); paint(); } return; }
      if (!c) return;
      var card = el.querySelector('[data-card]');
      if (a === 'done' || a === 'keep') { fling(card, 1, function () { act('right'); }); return; }
      if (a === 'later' || a === 'route') { act('left'); return; }
      if (a === 'mine') { c.mine = true; c.r = Object.assign({}, c.r, { owner_unsure: false }); paint(); return; }
      if (a === 'notmine') { commit({ id: c.r.task_id, action: 'notmine' }, 'Sent back to the team’s lead'); return; }
      if (a === 'bank') { bankSheet(c); return; }
      if (a === 'assign') { assignSheet(c); return; }
      if (a === 'project') { projectSheet(c); return; }
      if (a === 'discard') { commit({ id: c.r.task_id, action: 'discard' }, 'Discarded'); return; }
      if (a === 'sendsug') { commit({ id: c.r.id, action: 'route', department: c.r.suggest_department || undefined, person: c.r.suggest_person || undefined, req: true }, 'Sent to ' + (c.r.suggest_person ? first(c.r.suggest_person) : team(c.r.suggest_department))); return; }
      if (a === 'status') { statusSheet(c); return; }
      if (a === 'rdone') { commit({ id: c.r.id, action: 'done', req: true }, 'Marked done'); return; }
      if (a === 'openreq') { close(); location.hash = '#requests'; return; }
    });
  }
  function keys(e) {
    if (!S.open) return;
    if (e.key === 'Escape') { if (S.sheet) { e.preventDefault(); closeSheet(); snapBack(); } return; }
    if (S.sheet || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
    var c = S.deck[S.i]; if (!c) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); if (!(c.kind === 'task' && c.r.owner_unsure && !c.r.for_lead)) fling(document.querySelector('#w353 [data-card]'), 1, function () { act('right'); }); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (!(c.kind === 'task' && c.r.owner_unsure && !c.r.for_lead)) act('left'); }
    else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); undo(); }
  }

  /* ---------- Home ---------- */
  function homeCard() {
    try {
      var host = document.getElementById('mpBody'); if (!host) return;
      var n = S.tasks.length + S.reqs.length, el = document.getElementById('w353home');
      var left = S.open ? 0 : remaining();
      if (!left) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement('div'); el.id = 'w353home'; host.insertBefore(el, host.firstChild); el.addEventListener('click', function (e) { if (e.target.closest('button')) open(); }); }
      var c = { t: 0, q: 0 }; for (var k = S.i; k < S.deck.length; k++) { if (S.deck[k].kind === 'task') c.t++; else c.q++; }
      el.innerHTML = '<div><b>Sort your tasks and requests</b><span>' + [c.t ? c.t + ' task' + (c.t === 1 ? '' : 's') : '', c.q ? c.q + ' request' + (c.q === 1 ? '' : 's') : ''].filter(Boolean).join(' and ') + ' waiting, one card at a time.</span></div><button type="button">Start</button>';
      void n;
    } catch (e) { /* fine */ }
  }
  function remaining() { return Math.max(0, S.deck.length - S.i); }
  function open() { if (!S.deck.length || S.i >= S.deck.length) { toastS('Nothing to sort right now.'); return; } paint(); }

  /* ---------- Ask the Hub's note, once nothing covers it ---------- */
  var peekTries = 0;
  function afterClose() {
    clearTimeout(S.peekT);
    (function tryPeek() {
      if (peekTries++ > 30 || S.open) return;
      try {
        if (!window.w320 || typeof w320.peek !== 'function') return;
        if (lsGet('wa320.off') === '1' || lsGet('wa320.peek') === today()) return;
        if (typeof w320.blocked === 'function' && w320.blocked()) { S.peekT = setTimeout(tryPeek, 20000); return; }
        w320.peek().then(function (ok) { if (!ok && lsGet('wa320.peek') !== today()) S.peekT = setTimeout(tryPeek, 20000); }).catch(function () { /* fine */ });
      } catch (e) { /* fine */ }
    })();
  }

  /* ---------- start: on its own, once the Hub has loaded ---------- */
  function ready() {
    try {
      if (typeof db === 'undefined' || !db || !db.rpc) return false;
      if (!me()) return false;
      var g = document.getElementById('gate'); if (g && g.style.display !== 'none' && g.offsetParent !== null) return false;
      if (window.w222 && w222.state && !w222.state().lifted) return false;
      return true;
    } catch (e) { return false; }
  }
  function busyElsewhere() {
    try {
      var l = document.getElementById('w238loop'); if (l && l.getBoundingClientRect().width > 0) return true;
      var p = document.getElementById('w177pop'); if (p && p.offsetParent !== null) return true;
      var m = document.getElementById('modalBack'); if (m && m.style.display === 'flex') return true;
      var st = window.w122 && w122.state && w122.state(); if (st && st.T) return true;
      var ln = document.getElementById('w260lock'); if (ln && ln.offsetParent !== null) return true;
    } catch (e) { /* fine */ }
    return false;
  }
  async function start() {
    if (S.started) return; S.started = true;
    if (!staff()) { afterClose(); return; }
    var t = await loadTasks();
    if (t === null) { try { if (window.w213 && w213.state) { w213.state().shown = false; w213.start(); } } catch (e) { /* fine */ } afterClose(); return; }   /* the database said no: wave213's list takes its place again */
    /* wave213's list stands aside: Triage shows the same rows */
    try { if (window.w213 && w213.state) { w213.state().gone = true; } var old = document.getElementById('w213pop'); if (old) old.remove(); } catch (e) { /* fine */ }
    S.tasks = t; S.reqs = await loadReqs(); build(); homeCard();
    if (!S.deck.length) { afterClose(); return; }
    var tries = 0;
    (function wait() {
      if (S.open) return;
      if (busyElsewhere() && tries++ < 180) { setTimeout(wait, 1000); return; }
      /* tasks are a must, as the due-date check was; requests alone open once a day, else wait on Home */
      if (!S.tasks.length && lsGet('wa353.reqday') === today()) { afterClose(); return; }
      try { if (!S.tasks.length) localStorage.setItem('wa353.reqday', today()); } catch (e) { /* fine */ }
      paint();
    })();
  }
  /* wave213's list stands aside from the start, so it never flashes before Triage */
  (function hold() { try { if (window.w213 && w213.state) { w213.state().shown = true; } else { setTimeout(hold, 200); } } catch (e) { /* fine */ } })();
  var boots = 0;
  (function boot() {
    if (S.started) return;
    if (ready()) { setTimeout(start, 2500); return; }
    if (boots++ < 240) setTimeout(boot, 1000);
    else { try { if (window.w213 && w213.state) { w213.state().shown = false; w213.start(); } } catch (e) { /* fine */ } }
  })();
  setInterval(homeCard, 4000);
  window.addEventListener('hashchange', function () { setTimeout(homeCard, 400); });

  window.w353 = { open: open, start: start, state: function () { return S; }, paint: paint };
})();
</script>
