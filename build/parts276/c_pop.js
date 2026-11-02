
  /* ---------- the pop-up: your availability for a team ----------
     A centred card (a bottom sheet under 700px) in wave177's style. due is the wa_avail_due() row when Home asks, or null
     when the person opened it themselves (My availability on the Agenda tab): then the second button is Cancel and no
     snooze is written. Escape and a click on the scrim do what the second button does. */
  var NOTE1 = 'Thanks for adding your availability. Could you add a little more? We ask for at least {m} hours so your manager has room to find a time that works for the whole team.';
  var NOTE2 = "If your week is tight, that's fine. Even an extra hour or two near the times you already picked helps, since the next person can plan around them.";
  var P = { dept: null, due: null, g: null, from: null, cfg: null, busy: false };

  function closePop() {
    var bk = document.getElementById('w276back');
    if (P.g) { P.g.destroy(); P.g = null; }
    document.removeEventListener('keydown', escPop, true);
    if (bk) bk.remove();
    var f = P.from; P.from = null;
    if (f && f.isConnected && f.focus) { try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  function escPop(e) { if (e.key === 'Escape' && document.getElementById('w276pop')) { e.stopPropagation(); e.preventDefault(); later(); } }
  function later() {
    if (P.busy) return;
    var dept = P.dept, due = P.due;
    closePop();
    if (due && dept) {
      Promise.resolve().then(function () { return db.rpc('wa_avail_snooze', { p_dept: dept }); })
        .then(function (r) { if (r && r.error) console.warn('wave276 snooze', r.error); }, function (e) { console.warn('wave276 snooze', e); });
    }
  }
  function syncHours(slots) {
    var c = P.cfg, hrs = hours(slots, c.cellMin);
    var n = document.getElementById('w276hours'); if (n) n.textContent = hoursText(hrs) + ' selected';
    var note = document.getElementById('w276note'); if (note) note.hidden = !(c.minHours > 0 && hrs < c.minHours);
  }
  function popErr(msg) { var e = document.getElementById('w276err'); if (e) { e.textContent = msg || ''; e.hidden = !msg; } }
  async function save() {
    if (P.busy || !P.g || P.loadFailed) return;
    var dept = P.dept, slots = P.g.get(), fromEl = document.getElementById('w276from');
    var from = (fromEl && /^\d{4}-\d{2}-\d{2}$/.test(fromEl.value)) ? fromEl.value : isoToday();
    var btn = document.getElementById('w276save');
    P.busy = true; if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; } popErr('');
    try {
      rpcData(await db.rpc('wa_avail_save', { p_dept: dept, p_from: from, p_slots: slots }));
      P.busy = false;
      closePop();
      say('Thanks. Your availability for ' + teamLabel(dept) + ' is saved.');
      if (W276.agenda.dept === dept && document.getElementById('w276panel')) paintAgenda(dept);
    } catch (e) {
      P.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      popErr('That did not save. Check your connection and try again.');
      console.warn('wave276 save', e);
    }
  }

  async function openPop(dept, due) {
    if (!dept || document.getElementById('w276pop')) return false;
    var opener = document.activeElement;
    await loadCfg();
    if (document.getElementById('w276pop')) return false;
    var mine = null, team = null, me = myEmail(), mineErr = null;
    /* null data means no saved week. An error means the saved week is unknown, and an empty grid saved over it would
       replace the person's real week: the Home ask does not open (autoPop tries again later), My availability opens
       with Save off until Retry reads the week. */
    try { mine = rpcData(await db.rpc('wa_avail_mine', { p_dept: dept })); } catch (e) { mineErr = e || new Error('wa_avail_mine failed'); console.warn('wave276 mine', e); }
    if (mineErr && due) return false;
    try { team = rpcData(await db.rpc('wa_avail_team', { p_dept: dept })); } catch (e) { team = null; console.warn('wave276 team (clashes)', e); }   /* members see their team; clashes are optional */
    if (document.getElementById('w276pop')) return false;
    if (due && (otherOpen() || !onHome())) return false;   /* the Home ask never stacks on another window, nor opens off Home */
    P.dept = dept; P.due = due || null; P.from = opener; P.busy = false; P.cfg = cfgFrom(team); P.loadFailed = !!mineErr;
    if (team && team.me) me = String(team.me).toLowerCase();   /* the roster's address, also when signed in with an alias */
    var clashes = ((team && team.clashes) || []).filter(function (c) { return String(c.email || '').toLowerCase() === me; }).map(function (c) { return Number(c.slot); });
    var slots = (mine && mine.slots) || [];
    var lbl = teamLabel(dept);
    var bk = document.createElement('div'); bk.id = 'w276back';
    bk.innerHTML = '<div id="w276pop" role="dialog" aria-modal="true" aria-labelledby="w276title" aria-describedby="w276lead">'
      + '<button type="button" class="x" aria-label="Close" data-w276="later">&times;</button>'
      + '<p class="k">' + E(lbl) + '</p>'
      + '<h2 id="w276title" tabindex="-1">Your availability for ' + E(lbl) + ' meetings</h2>'
      + '<p class="lead" id="w276lead">Mark the times you are usually free in a typical week. Drag across cells to mark several at once, or tap one at a time. ' + E(tzNote()) + '</p>'
      + '<div class="from"><label for="w276from">Valid from</label><input type="date" id="w276from" value="' + E(isoToday()) + '" aria-describedby="w276fromh"><p id="w276fromh" class="help">Pick the date your week changes, for example the first day of term.</p></div>'
      + (clashes.length ? '<p class="legend"><span class="sw"></span>Usually in a meeting (from your Hub calendar)</p>' : '')
      + '<div id="w276grid"></div>'
      + '<p id="w276hours" aria-live="polite"></p>'
      + '<div id="w276note" hidden><p>' + E(NOTE1.replace('{m}', String(P.cfg.minHours))) + '</p><p>' + E(NOTE2) + '</p></div>'
      + '<p id="w276err" role="alert" hidden></p>'
      + '<div class="row"><button type="button" class="yes" id="w276save" data-w276="save">Save</button>'
      + '<button type="button" class="no" id="w276later" data-w276="later">' + (P.due ? 'Ask me later' : 'Cancel') + '</button></div>'
      + '</div>';
    document.body.appendChild(bk);
    P.g = grid(document.getElementById('w276grid'), { start: P.cfg.start, end: P.cfg.end, cellMin: P.cfg.cellMin, slots: slots, clashes: clashes, onChange: syncHours });
    syncHours(P.g.get());
    bk.addEventListener('click', function (e) {
      if (e.target === bk) { later(); return; }
      var t = e.target.closest && e.target.closest('[data-w276]'); if (!t) return;
      var act = t.getAttribute('data-w276');
      if (act === 'save') save(); else if (act === 'retry') retryMine(); else later();
    });
    if (P.loadFailed) loadFailed();
    document.addEventListener('keydown', escPop, true);
    var t = document.getElementById('w276title'); if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    if (P.due) W276.popped = true;
    return true;
  }
  W276.openPop = openPop;
  function loadFailed() {
    var b = document.getElementById('w276save'); if (b) b.disabled = true;
    var e = document.getElementById('w276err'); if (!e) return;
    e.innerHTML = 'Your saved week could not be loaded, so Save is off to keep it safe. <button type="button" class="lk" data-w276="retry">Retry</button>';
    e.hidden = false;
  }
  async function retryMine() {
    var dept = P.dept; if (!dept || !P.loadFailed) return;
    popErr('Loading your saved week...');
    try {
      var mine = rpcData(await db.rpc('wa_avail_mine', { p_dept: dept }));
      if (P.dept !== dept || !P.g) return;
      P.loadFailed = false;
      P.g.set((mine && mine.slots) || []);
      popErr('');
      var b = document.getElementById('w276save'); if (b) b.disabled = false;
    } catch (err) {
      console.warn('wave276 mine retry', err);
      if (P.dept === dept && P.g) loadFailed();
    }
  }

  /* Home asks: once per page load, for the first team wa_avail_due() returns, never over another window (it waits
     and looks again a few times, so a pop-up that opened first can finish). */
  var AUTO = { timer: null, tries: 0, due: null, busy: false };
  function autoPop(delay) {
    clearTimeout(AUTO.timer);
    if (W276.popped || AUTO.busy) return;
    AUTO.timer = setTimeout(async function () {
      if (W276.popped || !onHome()) return;
      try { if (typeof MODE !== 'undefined' && MODE !== 'staff' && MODE !== 'board') return; } catch (e) { return; }
      if (otherOpen()) { if (AUTO.tries++ < 20) autoPop(document.documentElement.classList.contains('wa-ready') ? 5000 : 1000); return; }
      try {
        if (!AUTO.due) AUTO.due = Promise.resolve(db.rpc('wa_avail_due')).then(rpcData);
        var rows = await AUTO.due;
        if (!rows || !rows.length) { W276.popped = true; return; }
        if (W276.popped || !onHome() || otherOpen()) { if (!W276.popped && onHome() && AUTO.tries++ < 20) autoPop(5000); return; }
        AUTO.busy = true;
        var opened = false;
        try { opened = await openPop(rows[0].department, rows[0]); } finally { AUTO.busy = false; }
        /* not opened (the saved week did not load, another window opened, the person left Home): popped stays false */
        if (!opened && !W276.popped && AUTO.tries++ < 20) autoPop(5000);
      } catch (e) { AUTO.due = null; AUTO.busy = false; console.warn('wave276 due', e); }
    }, delay == null ? 1500 : delay);
  }
