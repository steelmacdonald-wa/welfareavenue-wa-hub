
  /* ---------- Home's layout: the older cards, placed and dressed ----------
     One dark surface (Up next), one warm surface (Set up your Hub), everything else a quiet group on the cream. Type from
     the brand, sizes by role, tracking by size. Motion only on what the person touches: a press, a tick, a change. Nothing
     animates on arrival: Home opens many times a day. */
  var OUT = 'cubic-bezier(.23,1,.32,1)', MUTED = 'rgba(31,32,30,.62)', SURF = 'rgba(16,63,57,.05)', SURF2 = 'rgba(16,63,57,.1)', LINE = 'rgba(16,63,57,.11)';
  var TICK = 'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23FFFAF2%27 stroke-width=%272.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27><path d=%27M5 12.5 10 17.5 19 7%27/></svg>")';
  var P = '#mypage.w272 ';
  var B = P + '#mpBody';
  var homeCss = ''
    + P + '> .card:has(> #mpBody),' + P + '#mpBody{background:none;border:0;box-shadow:none;}'
    + P + '> .card:has(> #mpBody){padding:0;display:block;width:auto;}'
    /* wave262's focus rules set flex and order; these come after and are stronger */
    + '#mypage.w272 #mpBody,#mypage.w272.w262focus #mpBody{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:16px 24px;align-items:start;width:100%;box-sizing:border-box;font-family:' + BODY + ';font-size:15.5px;line-height:1.45;color:' + INK + ';}'
    + B + ' > *{grid-column:1 / -1;min-width:0;margin-top:0;margin-bottom:0;}'
    + '#mypage.w272 #mpBody > .mp-head{order:1;}#mypage.w272 #mpBody > .mp-chips{order:2;}#mypage.w272 #mpBody > #w151news{order:3;}'
    + '#mypage.w272 #mpBody > #w272setup{order:4;}'
    + '#mypage.w272 #mpBody > #w272next{order:6;grid-column:1;align-self:stretch;}#mypage.w272 #mpBody > #w272apps{order:7;grid-column:2;align-self:stretch;}'
    + '#mypage.w272 #mpBody:not(:has(> #w272apps)) > #w272next{grid-column:1 / -1;}'
    + '#mypage.w272 #mpBody > #w112wrap{order:8;}#mypage.w272 #mpBody > #w180card{order:9;}#mypage.w272 #mpBody > #w219card{order:10;}#mypage.w272 #mpBody > #w166lead{order:11;}#mypage.w272 #mpBody > #w170card{order:12;}'
    + '#mypage.w272 #mpBody > #w116home{order:13;grid-column:1;align-self:stretch;}#mypage.w272 #mpBody > #w171next{order:14;grid-column:2;margin:0;align-self:stretch;}'
    + '#mypage.w272 #mpBody:not(:has(> #w171next)) > #w116home{grid-column:1 / -1;}#mypage.w272 #mpBody:not(:has(> #w116home)) > #w171next{grid-column:1 / -1;}'
    /* wave290: Your servings this year, right after the Next serving card (both order 14; wave290 appends its card, so it comes second) */
    + '#mypage.w272 #mpBody > #w290srv{order:14;}'
    + '#mypage.w272 #mpBody > #w74attn{order:15;}#mypage.w272 #mpBody > .mp-grid{order:16;}'
    + '#mypage.w272 #mpBody > .mp-online{order:20;}#mypage.w272 #mpBody > #w192feed{order:21;}#mypage.w272 #mpBody > #w75card{order:22;}#mypage.w272 #mpBody > #w114switch{order:23;}'
    /* Set up your Hub stands in for wave219's card and the Policies card: both say the same things */
    + B + ':has(> #w272setup) > #w219card,' + P + '> #w105sign{display:none;}'
    /* the overdue list repeats My tasks: Needs your attention keeps what only it says (the mentions) */
    + P + '#w74attn > .mp-task.w109,' + P + '#w74attn > p.mp-empty,' + P + '#w74attn > .mp-task:has([data-w109cb]){display:none;}'
    + P + '#w74attn:not(:has(> .mp-task:not(.w109))){display:none;}'
    /* ---- type ---- */
    + P + '.mp-head{display:flex;align-items:center;gap:4px 12px;flex-wrap:wrap;padding-top:2px;}'
    + P + '.mp-head h2{margin:0;font:500 clamp(38px,4.6vw,56px)/.98 ' + HEAD + ';text-transform:uppercase;letter-spacing:-.01em;color:' + GREEN + ';}'
    + P + '.mp-head .w115av{width:40px !important;height:40px !important;font-size:15px !important;}'
    + P + '.w74date{order:-1;flex-basis:100%;font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' + PURPLE + ';}'
    + P + '.mp-head .ag-dep{font-size:11px;letter-spacing:.06em;border-radius:6px;padding:3px 7px;}'
    + P + '#w110mine{flex-basis:100%;order:6;margin:0;font-size:13px;}'
    + P + '#w110mine .btn{background:none;border:0;padding:0;color:' + GREEN + ';font:500 13px ' + BODY + ';text-decoration:underline;text-underline-offset:3px;min-height:32px;}'
    + '#w272sum{flex-basis:100%;order:5;margin:2px 0 0;font-size:17px;line-height:1.4;color:' + MUTED + ';}'
    /* the counts: the same buttons, as a quiet row */
    + P + '.mp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0;}'
    + P + '.mp-chip{border:0;background:' + SURF + ';border-radius:10px;padding:7px 12px;min-height:36px;box-sizing:border-box;box-shadow:none;font-size:14px;font-weight:500;color:' + GREEN + ';display:inline-flex;flex-direction:row;align-items:center;gap:6px;font-variant-numeric:tabular-nums;cursor:pointer;}'
    + P + '.mp-chip b{font:700 14px/1 ' + BODY + ';margin:0;color:inherit;}'
    + P + '.mp-chip.warn{background:rgba(220,165,39,.22);}'
    /* ---- the quiet groups ---- */
    + P + '.mp-sec,' + P + '#w112card,' + P + '.w105card,' + P + '#w74attn{background:' + SURF + ';border:0;box-shadow:none;border-radius:18px;padding:16px 18px 14px;margin:0;}'
    + P + '.mp-sec > h3,' + P + '#w74attn h3,' + P + '.w180hd h3,' + P + '.w112top h3,' + P + '.w105card h2{margin:0 0 6px;font:500 22px/1.05 ' + HEAD + ';letter-spacing:.01em;text-transform:uppercase;color:' + GREEN + ';}'
    + P + '.mp-grid{grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:16px 24px;}'
    + P + '.w74col{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-content:start;min-width:0;}'
    + P + '.mp-empty,' + P + '.w116note,' + P + '.w192sub,' + P + '.w112intro,' + P + '.w105card p.read{font-size:14px;line-height:1.45;color:' + MUTED + ';}'
    + P + '.mp-empty{border:0;background:none;padding:4px 0;margin:0 0 4px;}'
    /* rows: 48px to touch, one hairline between, the tick a round control */
    + P + '.mp-task{display:flex;align-items:center;gap:10px;min-height:48px;padding:6px 0;margin:0;border-top:1px solid ' + LINE + ';border-radius:0;background:none;box-shadow:none;font-size:15.5px;line-height:1.35;}'
    + P + '.mp-task:first-of-type,' + P + '.w74grp + .mp-task,' + P + '.w74grp + .w74extra .mp-task{border-top:0;}'
    + P + '.mp-task .w109t{cursor:pointer;}'
    + P + '.mp-task.w109done{opacity:.5;}' + P + '.mp-task.w109done .w109t{text-decoration:line-through;}'
    + P + '.w109undo{margin-left:auto;background:' + GOLD + ';color:' + GREEN + ';border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:700;cursor:pointer;}'
    + P + '.mp-due{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:3px 8px;background:' + SURF2 + ';color:' + GREEN + ';flex:none;}'
    + P + '.mp-due.over,' + P + '.mp-due.soon{background:rgba(220,165,39,.26);color:' + GREEN + ';}'
    + P + '.w74grp{margin:12px 0 2px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' + MUTED + ';}'
    + P + 'input[type=checkbox][data-w109cb],' + P + '.w112step > input[type=checkbox]{appearance:none;-webkit-appearance:none;width:22px;height:22px;margin:0;flex:none;border-radius:50%;box-shadow:inset 0 0 0 1.75px rgba(31,32,30,.42);background:transparent center/14px no-repeat;cursor:pointer;transition:background-color 120ms ease,box-shadow 120ms ease,transform 120ms ' + OUT + ';}'
    + P + 'input[type=checkbox][data-w109cb]:checked,' + P + '.w112step > input[type=checkbox]:checked{background-color:' + GREEN + ';background-image:' + TICK + ';box-shadow:none;}'
    + P + 'input[type=checkbox][data-w109cb]:active,' + P + '.w112step > input[type=checkbox]:active{transform:scale(.88);}'
    /* mentions */
    + P + '.w74men{padding:10px 0;border-top:1px solid ' + LINE + ';font-size:15px;line-height:1.4;}' + P + '.w74men:first-of-type{border-top:0;}'
    + P + '.w74men .cx{color:' + MUTED + ';}' + P + '.w74new{font-size:10px;letter-spacing:.06em;}'
    + P + '.w65got{display:inline-block;margin-top:4px;background:' + SURF2 + ';color:' + GREEN + ';border-radius:999px;padding:5px 12px;font-size:12.5px !important;font-weight:700;}'
    /* the getting started card (wave112) */
    + P + '#w112wrap{margin:0;}' + P + '#w112card{border-left:0;}'
    + P + '.w112top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px;}'
    + P + '.w112count{font-size:13px;color:' + MUTED + ';}' + P + '.w112links{margin-left:auto;font-size:13px;}' + P + '.w112links a{color:' + GREEN + ';}'
    + P + '.w112bar{height:5px;border-radius:3px;background:' + SURF2 + ';overflow:hidden;margin:4px 0 10px;}' + P + '.w112bar i{background:' + GOLD + ';border-radius:3px;height:100%;display:block;transition:width 300ms ' + OUT + ';}'
    + P + '.w112step{display:flex;align-items:center;gap:12px;min-height:54px;padding:8px 0;border-top:1px solid ' + LINE + ';}'
    + P + '.w112txt{flex:1;min-width:0;font-size:15.5px;line-height:1.3;}' + P + '.w112txt small,' + P + '.w112txt .w112d{display:block;font-size:13px;color:' + MUTED + ';}'
    + P + '.w112go{flex:none;min-height:36px;border:0;border-radius:999px;background:' + SURF2 + ';color:' + GREEN + ';padding:0 14px;font:600 13px ' + BODY + ';cursor:pointer;}'
    /* announcements (wave180) */
    + P + '.w180hd{display:flex;align-items:center;gap:10px;margin-bottom:4px;}' + P + '.w180btn{border-radius:999px;font-weight:600;}'
    + P + '.w180it{padding:12px 0 10px;margin:0;border:0;border-top:1px solid ' + LINE + ';border-radius:0;background:none;box-shadow:none;}' + P + '.w180it:first-of-type{border-top:0;}' + P + '.w180it.pin{border-left:3px solid ' + GOLD + ';padding-left:12px;}'
    + P + '.w180it h4{margin:4px 0 2px;font:500 16.5px/1.3 ' + BODY + ';color:' + INK + ';}' + P + '.w180it .body{font-size:15px;color:' + INK + ';}' + P + '.w180it .top{color:' + MUTED + ';}'
    /* the next serving (wave171): a quiet group, so Up next is the one dark surface */
    + P + '#w171next{background:' + SURF + ';color:' + INK + ';border-radius:18px;padding:16px 18px 14px;box-sizing:border-box;}' + P + '#w171next:after{display:none;}'
    + P + '#w171next .k{color:' + PURPLE + ';letter-spacing:.1em;font-size:11.5px;}' + P + '#w171next h3{color:' + GREEN + ';font-size:22px;font-weight:500;letter-spacing:.01em;margin:2px 0 4px;}'
    + P + '#w171next p{color:' + INK + ';font-size:14.5px;}' + P + '#w171next .bar{background:' + SURF2 + ';}' + P + '#w171next .go{border-radius:999px;font-size:13px;}'
    /* time off and policies (wave105), when shown */
    + P + '.w105card .btn.mini{border-radius:999px;font-weight:600;}' + P + '.w105card table{font-size:13.5px;}'
    /* ---- buttons: instant press feedback, hover only on a mouse ---- */
    + P + 'button,' + P + '.mp-chip,' + P + '.w65got,' + P + '.w109undo{transition:transform 120ms ' + OUT + ',background-color 120ms ease,opacity 120ms ease;}'
    + P + 'button:active,' + P + '.mp-chip:active,' + P + '.w65got:active,' + P + '.w109undo:active{transform:scale(.97);}'
    + P + 'button:focus-visible,' + P + '.mp-chip:focus-visible,' + P + 'input:focus-visible,' + P + 'a:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
    + '@media (hover:hover) and (pointer:fine){' + P + '.mp-chip:hover,' + P + '.w112go:hover,' + P + '.w65got:hover{background:rgba(16,63,57,.15);}' + P + '#w272next button:hover{background:rgba(255,250,242,.22);}' + P + '#w272next button.go:hover,' + P + '#w272setup .go:hover{filter:brightness(1.05);}}'
    /* ---- My tasks: today first ---- */
    + '#mypage.w272:not(.w272later) .w272lt{display:none !important;}'
    + '#w272laterbtn{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:46px;margin-top:4px;padding:0 2px;border:0;border-top:1px solid ' + LINE + ';background:none;font:500 15px ' + BODY + ';color:' + GREEN + ';cursor:pointer;text-align:left;}'
    + '#w272laterbtn .c{transition:transform 200ms ' + OUT + ';font-size:20px;line-height:1;}' + '#w272laterbtn[aria-expanded="true"] .c{transform:rotate(90deg);}'
    /* ---- Up next: the one dark surface ---- */
    + '#w272next{background:' + GREEN + ';color:' + CREAM + ';border-radius:22px;padding:22px 24px 20px;box-sizing:border-box;display:flex;flex-direction:column;gap:6px;transition:opacity 140ms ease,filter 140ms ease,transform 140ms ' + OUT + ';}'
    + '#w272next.w272swap{opacity:0;filter:blur(2px);transform:translateY(3px);}'
    + '#w272next small{font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:' + GOLD + ';}'
    + '#w272next h3{margin:0;font:500 clamp(26px,3vw,38px)/1 ' + HEAD + ';letter-spacing:-.005em;text-transform:uppercase;color:' + CREAM + ';text-wrap:balance;overflow-wrap:anywhere;}'
    + '#w272next p{margin:0;font-size:15px;color:rgba(255,250,242,.82);}'
    + '#w272next .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:14px;}'
    + '#w272next button{min-height:44px;padding:0 16px;border:0;border-radius:12px;background:rgba(255,250,242,.14);color:' + CREAM + ';font:500 15px ' + BODY + ';cursor:pointer;}'
    + '#w272next button.go{background:' + GOLD + ';color:' + GREEN + ';font:600 17px/1 ' + HEAD + ';letter-spacing:.04em;text-transform:uppercase;padding:0 20px;}'
    + '#w272next button[disabled]{opacity:.6;cursor:default;}' + '#w272next button:focus-visible{outline-color:' + CREAM + ';}'
    + '#w272next.clear{align-items:center;justify-content:center;text-align:center;padding-block:28px;}'
    /* ---- Your apps ---- */
    + '#w272apps{background:' + SURF + ';border-radius:18px;padding:16px 18px 14px;box-sizing:border-box;}'
    + '#w272apps h3{margin:0 0 12px;font:500 22px/1.05 ' + HEAD + ';letter-spacing:.01em;text-transform:uppercase;color:' + GREEN + ';}'
    + '#w272apps .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:14px 6px;}'
    + '#w272apps button{display:grid;justify-items:center;align-content:start;gap:6px;border:0;background:none;padding:2px;cursor:pointer;font:400 12.5px/1.2 ' + BODY + ';color:' + INK + ';text-align:center;}'
    + '#w272apps .ti{width:50px;height:50px;border-radius:14px;background:' + GREEN + ';color:' + CREAM + ';display:flex;align-items:center;justify-content:center;}' + '#w272apps .ti svg{width:24px;height:24px;}'
    + '#w272apps .all .ti{background:' + SURF2 + ';color:' + GREEN + ';}'
    /* ---- the toast with Undo: enters and leaves along the same path ---- */
    + '#w272toast{position:fixed;z-index:99980;left:50%;bottom:24px;display:flex;align-items:center;gap:14px;width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;padding:10px 12px 10px 18px;border-radius:14px;background:' + INK + ';color:' + CREAM + ';font:400 15px ' + BODY + ';box-shadow:0 10px 34px rgba(0,0,0,.28);transform:translate(-50%,160%);opacity:0;transition:transform 300ms cubic-bezier(.32,.72,0,1),opacity 200ms ease;pointer-events:none;}'
    + '#w272toast.on{transform:translate(-50%,0);opacity:1;pointer-events:auto;}'
    + '#w272toast button{border:0;background:none;color:' + GOLD + ';font:700 15px ' + BODY + ';cursor:pointer;min-height:32px;padding:0 6px;flex:none;}'
    + '@media (max-width:900px){'
    + '#mypage.w272 #mpBody,#mypage.w272.w262focus #mpBody{grid-template-columns:minmax(0,1fr);gap:14px;}'
    + '#mypage.w272 #mpBody > *,#mypage.w272 #mpBody > #w272next,#mypage.w272 #mpBody > #w272apps,#mypage.w272 #mpBody > #w116home,#mypage.w272 #mpBody > #w171next{grid-column:1;}'
    + P + '.mp-grid{grid-template-columns:minmax(0,1fr);gap:14px;}' + P + '.w74col{gap:14px;}'
    + P + '.mp-sec,' + P + '#w112card,' + P + '#w272apps,' + P + '#w74attn{padding:14px 16px 12px;}' + '#w272next{padding:20px 20px 18px;}' + P + '.w112step{flex-wrap:wrap;gap:8px 12px;}' + P + '.w112txt{flex:1 1 200px;}' + P + '.w112go{margin-left:34px;font-size:12px;min-height:34px;}' + P + '.mp-head .w115av{display:none;}' + P + '.mp-head h2{font-size:36px;}'
    + '#w272toast{bottom:84px;}'
    + '}'
    + '@media (prefers-reduced-motion:reduce){#w272toast{transform:translate(-50%,0);transition:opacity 160ms ease;}#w272next{transition:opacity 160ms ease;}#w272next.w272swap{filter:none;transform:none;}' + P + 'button,' + P + '.mp-chip,' + P + 'input[type=checkbox]{transition:none;}' + P + 'button:active,' + P + '.mp-chip:active,' + P + 'input[type=checkbox]:active{transform:none;}}';

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
  var NX = { title: null, t: null };
  function nextHtml(list) {
    var t = list[0];
    if (!t) return '<h3>You are all caught up</h3><p>Nothing has your name on it right now.</p>';
    var dep = ''; try { dep = (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[t.department]) || ''; } catch (e) { dep = ''; }
    var when = overdue(t) ? 'Due ' + t.due_date : t.due_date ? (dueToday(t) ? 'Due today' : 'Due ' + t.due_date) : 'No due date';
    return '<small>Up next' + (overdue(t) ? ', overdue' : '') + '</small><h3>' + E(t.title) + '</h3><p>' + E(when) + (dep ? ', ' + E(dep) : '') + '</p>'
      + '<div class="acts"><button type="button" class="go" data-w272do="open" data-id="' + E(t.id) + '">Open task</button>'
      + '<button type="button" data-w272do="done" data-id="' + E(t.id) + '">Mark as done</button>'
      + (list.length > 1 ? '<button type="button" data-w272do="later" data-id="' + E(t.id) + '">Do this later</button>' : '') + '</div>';
  }
  function paintNext() {
    var body = document.getElementById('mpBody'); if (!body) return;
    var el = document.getElementById('w272next');
    if (!el || el.parentNode !== body) { el = document.createElement('section'); el.id = 'w272next'; el.setAttribute('aria-label', 'Up next'); el.setAttribute('aria-live', 'polite'); body.appendChild(el); }
    var list = ranked(), html = nextHtml(list), key = list[0] ? String(list[0].id) : '';
    if (el.__h === html) return;
    var swap = el.__h && el.__k !== key && !el.classList.contains('w272swap');
    el.__h = html; el.__k = key;
    var apply = function () { el.classList.toggle('clear', !list.length); el.innerHTML = html; el.classList.remove('w272swap'); };
    if (!swap) { apply(); return; }
    /* a change of task: one short blur crossfade, so the eye reads one card changing, not two swapping */
    el.classList.add('w272swap'); clearTimeout(NX.t); NX.t = setTimeout(apply, 140);
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
    later += Math.max(0, myTasks().filter(function (t) { return t && !t.done && !dueToday(t); }).length - later);
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
