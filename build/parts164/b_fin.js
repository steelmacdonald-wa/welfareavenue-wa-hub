
  /* ---------- the title follows the section (the app bar says Finance, the rail says where) ---------- */
  var SECT = {
    overview: ['Overview', 'The year so far: what came in, what went out, how healthy the numbers are, and the finance work in flight.'],
    tasks: ['Tasks', 'Finance’s own board: bills to pay, receipts to file, reimbursements to approve. Invoices and receipts sent to hub@ land here, and #accounting-finance hears about each one.'],
    trends: ['Trends', 'Income against spending month by month, the net position over the year, and each fiscal year side by side.'],
    money: ['Money map', 'Where the money comes from and where it goes: by category, by merchant and by team.'],
    budget: ['Budget', 'Each line of the budget against what was actually spent.'],
    txns: ['Transactions', 'Every transaction in the ledger, the ones waiting for a review, and the imported statements.']
  };
  function retitle(id) {
    var m = document.querySelector('#finances > .w118mast'); if (!m) return;
    var t = SECT[id] || SECT.overview;
    var h = m.querySelector('h1'), p = m.querySelector(':scope > p');
    if (h && h.textContent !== t[0]) h.textContent = t[0];
    if (p && p.textContent !== t[1]) p.textContent = t[1];
    F.titled = id;
    try { if (panel() && panel().classList.contains('active')) document.title = (id === 'overview' ? 'Finance' : t[0] + ' · Finance') + ' · Welfare Avenue Hub'; } catch (e) { /* fine */ }
  }

  /* ---------- Tasks: Finance's own board (department finance) ---------- */
  function drawTasks() {
    var sec = shell('tasks'); if (!sec) return;
    var slot = sec.querySelector(':scope > #w164board');
    if (!slot) { slot = document.createElement('div'); slot.id = 'w164board'; sec.appendChild(slot); }
    if (!staffOk()) { slot.innerHTML = '<p class="w116empty">Finance’s tasks are for the team.</p>'; return; }
    if (!window.w116Board || !window.w116Board.render) { slot.innerHTML = '<p class="w116empty">The task board is loading…</p>'; return; }
    try { window.w116Board.render(slot, { dept: 'finance', board: null, ws: null }); F.board++; }
    catch (e) { slot.innerHTML = '<p class="w116empty">The board did not load. Refresh the page to try again.</p>'; }
  }

  /* ---------- the Overview: Finance's team inbox (requests to Finance, emails the Hub inbox filed for Finance) ---------- */
  var inboxBusy = false;
  function drawInbox(force) {
    var ov = shell('overview'), W = window.w123;
    if (!ov || !W || !W.cardHtml || !staffOk()) return;
    var cur = document.getElementById('w164inbox');
    var ver = (W.ver ? W.ver() : 0) + '|' + (W.loaded && W.loaded() ? 1 : 0);
    if (cur && !force && ov.contains(cur) && cur.getAttribute('data-w164v') === ver) return;
    if (inboxBusy) return;
    inboxBusy = true;
    try {
      var html = String(W.cardHtml('finance') || '').replace('id="w123tcard"', 'id="w164inbox" data-w164v="' + ver + '"');
      if (cur) cur.remove();
      var kp = ov.querySelector(':scope > .fin-kpis');
      if (kp) kp.insertAdjacentHTML('afterend', html); else ov.insertAdjacentHTML('afterbegin', html);
      F.inbox++;
    } finally { inboxBusy = false; }
    if (W.loaded && !W.loaded() && W.load && !F.loading) {
      F.loading = true;
      Promise.resolve(W.load()).then(function () { F.loading = false; drawInbox(true); }, function () { F.loading = false; });
    }
  }

  /* ---------- one pass over the page ---------- */
  function sync(id) {
    var p = panel(); if (!p) return;
    id = id || curSec();
    p.classList.toggle('w164t', id === 'tasks');
    retitle(id);
    if (id === 'tasks') drawTasks();
    if (id === 'overview' || !document.getElementById('w164inbox')) drawInbox(false);
    F.sec = id; F.drawn++;
  }
