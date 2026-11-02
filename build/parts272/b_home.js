
  /* ---------- Home's layout: the older cards, placed ---------- */
  var P = '#mypage.w272 ';
  var B = P + '#mpBody';
  var homeCss = ''
    + P + '> .card:has(> #mpBody),' + P + '#mpBody{background:none;border:0;box-shadow:none;}'
    + P + '> .card:has(> #mpBody){padding:0;}'
    /* wave262's focus rules set flex and order; these come after and are stronger */
    + '#mypage.w272 #mpBody,#mypage.w272.w262focus #mpBody{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:20px 28px;align-items:start;font-size:16px;line-height:1.5;width:100%;box-sizing:border-box;}'
    + P + '> .card:has(> #mpBody){display:block;width:auto;}'
    + B + ' > *{grid-column:1 / -1;min-width:0;margin-top:0;margin-bottom:0;}'
    + '#mypage.w272 #mpBody > .mp-head{order:1;}#mypage.w272 #mpBody > .mp-chips{order:2;}#mypage.w272 #mpBody > #w151news{order:3;}'
    + '#mypage.w272 #mpBody > #w272setup{order:4;}#mypage.w272 #mpBody > #w112wrap{order:8;}'
    + '#mypage.w272 #mpBody > #w272next{order:6;grid-column:1;align-self:stretch;}#mypage.w272 #mpBody > #w272apps{order:7;grid-column:2;align-self:stretch;}'
    + '#mypage.w272 #mpBody:not(:has(> #w272apps)) > #w272next{grid-column:1 / -1;}'
    + '#mypage.w272 #mpBody > #w180card{order:8;}#mypage.w272 #mpBody > #w219card{order:9;}#mypage.w272 #mpBody > #w166lead{order:10;}#mypage.w272 #mpBody > #w170card{order:11;}'
    + '#mypage.w272 #mpBody > #w116home{order:12;grid-column:1;align-self:stretch;}#mypage.w272 #mpBody > #w171next{order:13;grid-column:2;margin:0;align-self:stretch;}'
    + '#mypage.w272 #mpBody:not(:has(> #w171next)) > #w116home{grid-column:1 / -1;}#mypage.w272 #mpBody:not(:has(> #w116home)) > #w171next{grid-column:1 / -1;}'
    + '#mypage.w272 #mpBody > #w74attn{order:14;}#mypage.w272 #mpBody > .mp-grid{order:15;}'
    + '#mypage.w272 #mpBody > .mp-online{order:20;}#mypage.w272 #mpBody > #w192feed{order:21;}#mypage.w272 #mpBody > #w75card{order:22;}#mypage.w272 #mpBody > #w114switch{order:23;}'
    /* Set up your Hub stands in for wave219's card while it shows */
    + B + ':has(> #w272setup) > #w219card{display:none;}'
    /* the overdue list repeats My tasks: Needs your attention keeps what only it says (the mentions) */
    + P + '#w74attn > .mp-task.w109,' + P + '#w74attn > p.mp-empty,' + P + '#w74attn > .mp-task:has([data-w109cb]){display:none;}'
    + P + '#w74attn:not(:has(> .mp-task:not(.w109))){display:none;}'
    + P + '#w74attn{background:rgba(16,63,57,.05);border:0;border-radius:20px;padding:14px 18px;}'
    + P + '#w74attn h3{margin:0 0 4px;font:500 22px/1.1 ' + HEAD + ';letter-spacing:.2px;text-transform:uppercase;color:' + GREEN + ';}'
    /* the greeting */
    + P + '.mp-head{display:flex;align-items:baseline;gap:6px 12px;flex-wrap:wrap;}'
    + P + '.mp-head h2{margin:0;font:500 clamp(38px,5vw,58px)/1 ' + HEAD + ';text-transform:uppercase;letter-spacing:0;color:' + GREEN + ';}'
    + P + '.w74date{order:-1;flex-basis:100%;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + PURPLE + ';}'
    + '#w272sum{flex-basis:100%;margin:2px 0 0;font-size:18px;color:rgba(31,32,30,.72);}'
    /* the counts: the same buttons */
    + P + '.mp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0;}'
    + P + '.mp-chip{border:0;background:rgba(16,63,57,.09);border-radius:999px;padding:6px 13px;min-height:34px;box-sizing:border-box;box-shadow:none;font-size:14px;font-weight:500;color:' + GREEN + ';display:inline-flex;flex-direction:row;align-items:center;gap:5px;transition:transform 120ms cubic-bezier(.23,1,.32,1);}'
    + P + '.mp-chip b{font:700 14px/1 ' + BODY + ';margin:0;color:inherit;}'
    + P + '.mp-chip.warn{background:rgba(220,165,39,.26);color:' + GREEN + ';}'
    + P + '.mp-chip:active{transform:scale(.97);}'
    /* the older cards: quiet grouped surfaces, larger type */
    + P + '.mp-sec{background:rgba(16,63,57,.05);border:0;box-shadow:none;border-radius:20px;padding:16px 18px;margin:0;}'
    + P + '.mp-sec > h3{margin:0 0 8px;font:500 24px/1.1 ' + HEAD + ';letter-spacing:.2px;text-transform:uppercase;color:' + GREEN + ';}'
    + P + '.mp-grid{grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:20px 28px;}'
    + P + '.w74col{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;align-content:start;min-width:0;}'
    + P + '.mp-task{font-size:15.5px;line-height:1.35;padding:10px 0;border-top:1px solid rgba(16,63,57,.12);align-items:center;gap:10px;}'
    + P + '.mp-task input[type=checkbox]{width:22px;height:22px;flex:none;accent-color:' + GREEN + ';cursor:pointer;margin:0;}'
    + P + '.w74grp{margin:12px 0 2px;font-size:12px;letter-spacing:.06em;}'
    + P + '.w74men{font-size:15px;padding:10px 0;}'
    + P + '.mp-empty{font-size:15px;}'
    /* My tasks: today first */
    + '#mypage.w272:not(.w272later) .w272lt{display:none !important;}'
    + '#w272laterbtn{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:46px;margin-top:6px;padding:0 2px;border:0;border-top:1px solid rgba(16,63,57,.12);background:none;font:500 15px ' + BODY + ';color:' + GREEN + ';cursor:pointer;text-align:left;}'
    + '#w272laterbtn .c{transition:transform 200ms cubic-bezier(.23,1,.32,1);font-size:18px;line-height:1;}'
    + '#w272laterbtn[aria-expanded="true"] .c{transform:rotate(90deg);}'
    + '#w272laterbtn:focus-visible,#w272next button:focus-visible,#w272apps button:focus-visible,#w272setup button:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
    /* Up next */
    + '#w272next{background:' + GREEN + ';color:' + CREAM + ';border-radius:24px;padding:22px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:6px;font-family:' + BODY + ';}'
    + '#w272next small{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + GOLD + ';}'
    + '#w272next h3{margin:2px 0 0;font:500 clamp(28px,3.2vw,40px)/1.05 ' + HEAD + ';text-transform:uppercase;color:' + CREAM + ';text-wrap:balance;overflow-wrap:anywhere;}'
    + '#w272next p{margin:0;font-size:15px;color:rgba(255,250,242,.86);}'
    + '#w272next .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:12px;}'
    + '#w272next button{min-height:44px;padding:0 16px;border:0;border-radius:12px;background:rgba(255,250,242,.14);color:' + CREAM + ';font:500 15px ' + BODY + ';cursor:pointer;transition:transform 120ms cubic-bezier(.23,1,.32,1);}'
    + '#w272next button.go{background:' + GOLD + ';color:' + GREEN + ';font:600 17px/1 ' + HEAD + ';letter-spacing:.5px;text-transform:uppercase;padding:0 20px;}'
    + '#w272next button:active,#w272apps button:active{transform:scale(.97);}'
    + '#w272next button[disabled]{opacity:.6;cursor:default;}'
    + '#w272next.clear{align-items:center;justify-content:center;text-align:center;padding-block:30px;}'
    /* Your apps */
    + '#w272apps{background:rgba(16,63,57,.05);border-radius:20px;padding:16px 18px;box-sizing:border-box;font-family:' + BODY + ';}'
    + '#w272apps h3{margin:0 0 12px;font:500 24px/1.1 ' + HEAD + ';text-transform:uppercase;color:' + GREEN + ';}'
    + '#w272apps .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:14px 6px;}'
    + '#w272apps button{display:grid;justify-items:center;align-content:start;gap:6px;border:0;background:none;padding:2px;cursor:pointer;font:400 13px/1.2 ' + BODY + ';color:' + INK + ';text-align:center;transition:transform 120ms cubic-bezier(.23,1,.32,1);}'
    + '#w272apps .ti{width:52px;height:52px;border-radius:14px;background:' + GREEN + ';color:' + CREAM + ';display:flex;align-items:center;justify-content:center;}'
    + '#w272apps .ti svg{width:25px;height:25px;}'
    + '#w272apps .all .ti{background:rgba(16,63,57,.12);color:' + GREEN + ';}'
    /* the toast with Undo: enters and leaves along the same path */
    + '#w272toast{position:fixed;z-index:99980;left:50%;bottom:24px;display:flex;align-items:center;gap:14px;width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;padding:10px 12px 10px 18px;border-radius:14px;background:' + INK + ';color:' + CREAM + ';font:400 15px ' + BODY + ';box-shadow:0 10px 34px rgba(0,0,0,.28);transform:translate(-50%,160%);opacity:0;transition:transform 300ms cubic-bezier(.32,.72,0,1),opacity 200ms ease;pointer-events:none;}'
    + '#w272toast.on{transform:translate(-50%,0);opacity:1;pointer-events:auto;}'
    + '#w272toast button{border:0;background:none;color:' + GOLD + ';font:700 15px ' + BODY + ';cursor:pointer;min-height:32px;padding:0 6px;flex:none;}'
    + '@media (max-width:900px){'
    + '#mypage.w272 #mpBody,#mypage.w272.w262focus #mpBody{grid-template-columns:minmax(0,1fr);}'
    + '#mypage.w272 #mpBody > *,#mypage.w272 #mpBody > #w272next,#mypage.w272 #mpBody > #w272apps,#mypage.w272 #mpBody > #w116home,#mypage.w272 #mpBody > #w171next{grid-column:1;}'
    + P + '.mp-grid{grid-template-columns:minmax(0,1fr);}'
    + '#w272toast{bottom:84px;}'
    + '}'
    + '@media (prefers-reduced-motion:reduce){#w272toast{transform:translate(-50%,0);transition:opacity 160ms ease;}#w272next button,#w272apps button,' + P + '.mp-chip{transition:none;}#w272next button:active,#w272apps button:active,' + P + '.mp-chip:active{transform:none;}}';

  /* ---------- the person's work ---------- */
  var KEY_SKIP = 'wa272.skip', KEY_LATER = 'wa272.later';
  function myTasks() {
    try { var me = typeof WA_ME !== 'undefined' ? WA_ME : null; return me && typeof waTasksOf === 'function' ? waTasksOf(me.name) || [] : []; } catch (e) { return []; }
  }
  function overdue(t) { return !!t.due_date && t.due_date < isoToday(); }
  function dueToday(t) { return !!t.due_date && t.due_date <= isoToday(); }
  function skipped() {
    var o = null; try { o = JSON.parse(lsGet(KEY_SKIP) || 'null'); } catch (e) { o = null; }
    return o && o.day === isoToday() ? (o.ids || []) : [];
  }
  function ranked() {
    var skip = skipped().map(String);
    var rank = function (t) { return overdue(t) ? 0 : dueToday(t) ? 1 : t.due_date ? 2 : 3; };
    var a = myTasks().filter(function (t) { return t && t.id && !t.done; }).slice();
    a.sort(function (x, y) {
      var sx = skip.indexOf(String(x.id)) >= 0 ? 1 : 0, sy = skip.indexOf(String(y.id)) >= 0 ? 1 : 0;
      if (sx !== sy) return sx - sy;
      if (rank(x) !== rank(y)) return rank(x) - rank(y);
      return String(x.due_date || '9').localeCompare(String(y.due_date || '9'));
    });
    return a;
  }
  function todayCount() { return myTasks().filter(function (t) { return t && !t.done && dueToday(t); }).length; }

  /* ---------- the plain sentence ---------- */
  function paintSentence() {
    var head = document.querySelector('#mpBody > .mp-head'); if (!head) return;
    var el = document.getElementById('w272sum');
    if (!el || el.parentNode !== head) { el = document.createElement('p'); el.id = 'w272sum'; head.appendChild(el); }
    var all = myTasks().filter(function (t) { return t && !t.done; }), n = todayCount(), over = all.filter(overdue).length;
    var txt = n ? word(n) + (n === 1 ? ' thing' : ' things') + ' for today. ' + (over ? word(over) + (over === 1 ? ' is' : ' are') + ' overdue.' : 'Nothing is overdue.')
      : all.length ? 'Nothing is due today.' : 'You are clear for today.';
    if (el.textContent !== txt) el.textContent = txt;
  }

  /* ---------- Up next ---------- */
  function paintNext() {
    var body = document.getElementById('mpBody'); if (!body) return;
    var el = document.getElementById('w272next');
    if (!el || el.parentNode !== body) { el = document.createElement('section'); el.id = 'w272next'; el.setAttribute('aria-label', 'Up next'); body.appendChild(el); }
    var list = ranked(), t = list[0];
    el.classList.toggle('clear', !t);
    var html;
    if (!t) html = '<h3>You are all caught up</h3><p>Nothing has your name on it right now.</p>';
    else {
      var dep = ''; try { dep = (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[t.department]) || ''; } catch (e) { dep = ''; }
      var when = overdue(t) ? 'Due ' + t.due_date : t.due_date ? (dueToday(t) ? 'Due today' : 'Due ' + t.due_date) : 'No due date';
      html = '<small>Up next' + (overdue(t) ? ', overdue' : '') + '</small><h3>' + E(t.title) + '</h3><p>' + E(when) + (dep ? ', ' + E(dep) : '') + '</p>'
        + '<div class="acts"><button type="button" class="go" data-w272do="open" data-id="' + E(t.id) + '">Open task</button>'
        + '<button type="button" data-w272do="done" data-id="' + E(t.id) + '">Mark as done</button>'
        + (list.length > 1 ? '<button type="button" data-w272do="later" data-id="' + E(t.id) + '">Do this later</button>' : '') + '</div>';
    }
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
  }
  var toastT = null, undoFn = null;
  function toastUndo(msg, undo) {
    var el = document.getElementById('w272toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'w272toast'; el.setAttribute('role', 'status');
      el.innerHTML = '<span></span><button type="button">Undo</button>'; document.body.appendChild(el);
      el.querySelector('button').addEventListener('click', function () { var f = undoFn; undoFn = null; el.classList.remove('on'); if (f) f(); });
    }
    el.querySelector('span').textContent = msg; undoFn = undo;
    void el.offsetWidth; el.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); undoFn = null; }, 5000);
  }
  async function rerender() { try { if (typeof renderMyPage === 'function') await renderMyPage(); } catch (e) { /* fine */ } }
  document.addEventListener('click', async function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-w272do]'); if (!b) return;
    var kind = b.getAttribute('data-w272do'), id = b.getAttribute('data-id'), num = Number(id);
    if (kind === 'open') { try { if (window.w116Board && window.w116Board.open) window.w116Board.open(isNaN(num) ? id : num); } catch (x) { say('Could not open that task'); } return; }
    if (kind === 'later') {
      var s = skipped().map(String); if (s.indexOf(String(id)) < 0) s.push(String(id));
      lsSet(KEY_SKIP, JSON.stringify({ day: isoToday(), ids: s })); paintNext(); return;
    }
    if (kind === 'done') {
      if (typeof toggleTask !== 'function') return;
      var title = (myTasks().filter(function (t) { return String(t.id) === String(id); })[0] || {}).title || 'Task';
      b.disabled = true;
      var ok = false; try { ok = await toggleTask(isNaN(num) ? id : num, true); } catch (x) { ok = false; }
      b.disabled = false;
      if (!ok) { say('Could not save that. Try again.'); return; }
      toastUndo('Done: ' + title, async function () { try { await toggleTask(isNaN(num) ? id : num, false); } catch (x) { say('Could not undo that'); } await rerender(); });
      await rerender();
    }
  });

  /* ---------- My tasks: today first, the rest behind Later ---------- */
  function foldTasks() {
    var page = document.getElementById('mypage'), sec = null;
    document.querySelectorAll('#mpBody .mp-sec').forEach(function (s) { var h = s.querySelector(':scope > h3'); if (!sec && h && /^My tasks/.test(h.textContent || '')) sec = s; });
    if (!sec || !page) return;
    var byId = {}; myTasks().forEach(function (t) { byId[String(t.id)] = t; });
    var rows = Array.prototype.slice.call(sec.querySelectorAll('[data-w109]')), later = 0;
    rows.forEach(function (r) {
      var t = byId[r.getAttribute('data-w109')], lt = !t || !dueToday(t), holder = (r.closest && r.closest('.w74extra')) || r;
      holder.classList.toggle('w272lt', lt); if (lt) later++;
    });
    var extraLater = Math.max(0, myTasks().filter(function (t) { return t && !t.done && !dueToday(t); }).length - later);
    later += extraLater;
    /* a group's heading goes with its rows */
    sec.querySelectorAll('.w74grp').forEach(function (g) {
      var any = false, n = g.nextElementSibling;
      while (n && !n.classList.contains('w74grp')) { if (n.querySelector('[data-w109]') || n.hasAttribute('data-w109')) { if (!n.classList.contains('w272lt')) any = true; } n = n.nextElementSibling; }
      g.classList.toggle('w272lt', !any);
    });
    var open = lsGet(KEY_LATER) === '1'; page.classList.toggle('w272later', open);
    var note = sec.querySelector('#w272none');
    if (!rows.length || todayCount()) { if (note) note.remove(); }
    else if (!note) { note = document.createElement('p'); note.id = 'w272none'; note.className = 'mp-empty'; note.textContent = 'Nothing due today.'; sec.querySelector(':scope > h3').insertAdjacentElement('afterend', note); }
    var btn = document.getElementById('w272laterbtn');
    if (!later) { if (btn) btn.remove(); return; }
    if (!btn || btn.parentNode !== sec) { btn = document.createElement('button'); btn.type = 'button'; btn.id = 'w272laterbtn'; sec.appendChild(btn); }
    var lab = 'Later, ' + later + (later === 1 ? ' task' : ' tasks');
    if (btn.getAttribute('data-l') !== lab) { btn.setAttribute('data-l', lab); btn.innerHTML = '<span>' + lab + '</span><span class="c" aria-hidden="true">&#8250;</span>'; }
    btn.setAttribute('aria-expanded', String(open));
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('#w272laterbtn, [data-w74all]'); if (!b) return;
    var open = b.id === 'w272laterbtn' ? lsGet(KEY_LATER) !== '1' : true;
    lsSet(KEY_LATER, open ? '1' : '0');
    var page = document.getElementById('mypage'); if (page) page.classList.toggle('w272later', open);
    var btn = document.getElementById('w272laterbtn'); if (btn) btn.setAttribute('aria-expanded', String(open));
  });

  /* ---------- Your apps ---------- */
  function paintApps() {
    var body = document.getElementById('mpBody'), el = document.getElementById('w272apps'), A = window.WA_APP, Y = null;
    try { Y = A && A.yours ? A.yours() : null; } catch (e) { Y = null; }
    var ids = Y ? (Y.yours || []) : [], any = Y && (ids.length || (Y.more || []).length);
    if (!body || !A || !any) { if (el) el.remove(); return; }
    if (!el || el.parentNode !== body) { el = document.createElement('section'); el.id = 'w272apps'; el.setAttribute('aria-label', 'Your apps'); body.appendChild(el); }
    var tile = function (id) { var a = A.apps[id]; return a ? '<button type="button" data-w272app="' + E(id) + '"><span class="ti">' + (A.icon ? A.icon(a.ic) : '') + '</span>' + E(a.label) + '</button>' : ''; };
    var html = '<h3>Your apps</h3><div class="tiles">' + ids.slice(0, 7).map(tile).join('')
      + '<button type="button" class="all" data-w272app="*" aria-haspopup="true"><span class="ti">' + (A.icon ? A.icon('grid') : '') + '</span>All apps</button></div>';
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-w272app]'); if (!b) return;
    var id = b.getAttribute('data-w272app');
    if (id !== '*') { try { window.WA_APP.open(id); } catch (x) { /* fine */ } return; }
    e.stopPropagation();
    var g = document.querySelector('#w153dock .w153grid');
    if (g && g.offsetParent !== null) { g.click(); return; }
    var m = document.querySelector('[data-w163slot="menu"]'); if (m) m.click();
  }, true);
