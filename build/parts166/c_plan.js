
  /* ---------- the plan: Academy steps say so, show how far the person is, and open the module or the avenue ---------- */
  var REQ = { hub: 'Using the Hub', foundations: 'Welfare Avenue foundations', branding: 'Our brand' };
  function academy() { try { return (window.w122 && window.w122.A) || null; } catch (e) { return null; } }
  function myName() {
    var n = meName(); if (n) return n;
    try { var full = String((USER && USER.name) || ''), em = String((USER && USER.email) || ''); return full ? full.split(' ')[0] : em.split('@')[0]; } catch (e) { return ''; }
  }
  function personOf(onb) {
    try {
      var m = null;
      if (typeof WA28_PEOPLE !== 'undefined' && onb) m = WA28_PEOPLE.filter(function (p) { return String(p.id) === String(onb.member_id) || String(p.name).toLowerCase() === String(onb.person_name || '').toLowerCase(); })[0] || null;
      return { name: (onb && onb.person_name) || (m && m.name) || '', email: (m && m.email) || '', dept: (m && m.department) || '' };
    } catch (e) { return { name: (onb && onb.person_name) || '', email: '', dept: '' }; }
  }
  /* the person's Academy in one pass (the same rules as wa166_path_state and wa166_training_done: the database ticks the
     step, this shows it at once): what they finished, and every avenue with how far they are */
  function ctxFor(who) {
    var A = academy(); if (!A || !A.loaded) return null;
    var n = String(who.name || '').toLowerCase(), em = String(who.email || '').toLowerCase(), done = {};
    (A.prog || []).forEach(function (p) {
      if (p.status === 'done' && (String(p.person_name || '').toLowerCase() === n || (em && String(p.email || '').toLowerCase() === em))) done[String(p.training_id)] = true;
    });
    var byGroup = {};
    (A.trainings || []).forEach(function (t) {
      if (t.active === false || t.kind === 'tour' || (t.body && t.body.planned)) return;
      (byGroup[t.path_group] = byGroup[t.path_group] || []).push(t);
    });
    var all = (A.paths || []).filter(function (p) { return p.active !== false; }).map(function (p) {
      var items = byGroup[p.name] || [];
      var d = items.filter(function (t) { return done[String(t.id)]; }).length;
      return { key: p.key, title: p.title || p.name, dept: p.dept || null, required: !!p.required, sort: p.sort == null ? 1e9 : Number(p.sort),
        done: d, total: items.length, complete: items.length > 0 && d >= items.length, ratio: items.length ? d / items.length : 0 };
    });
    return { A: A, who: who, done: done, all: all };
  }
  function pick(list) {
    return list.slice().sort(function (x, y) {
      return (y.complete - x.complete) || (y.ratio - x.ratio) || (x.sort - y.sort) || String(x.key).localeCompare(String(y.key));
    })[0] || null;
  }
  /* 'team': the team's avenue they are furthest in (any avenue besides the three everyone does when the team has none);
     'any': an avenue besides the three everyone does and the one that counted for 'team' (one avenue never ticks both) */
  function pathState(cx, key) {
    var elig = cx.all.filter(function (p) { return !p.required && ['tours', 'firstweek', 'keela'].indexOf(p.key) < 0; });
    var team = elig.filter(function (p) { return p.dept && p.dept === cx.who.dept; });
    var teamPick = pick(team.length ? team : elig);
    var cand;
    if (key === 'team') cand = teamPick ? [teamPick] : [];
    else if (key === 'any') cand = elig.filter(function (p) { return !(teamPick && teamPick.complete && p.key === teamPick.key); });
    else cand = cx.all.filter(function (p) { return p.key === key; });
    var best = pick(cand);
    return best ? { key: best.key, title: best.title, done: best.done, total: best.total, complete: best.complete, teamHas: team.length > 0 }
      : { key: key, title: null, done: 0, total: 0, complete: false, teamHas: team.length > 0 };
  }
  function linkState(cx, t) {
    if (!cx) return null;
    if (t.training_id) {
      var tr = cx.A.byId ? cx.A.byId[String(t.training_id)] : null;
      return { kind: 'module', id: t.training_id, title: tr ? tr.title : 'the module', mins: tr ? (tr.minutes || null) : null, done: !!cx.done[String(t.training_id)] };
    }
    if (t.academy_path) {
      var s = pathState(cx, t.academy_path);
      return { kind: 'avenue', key: s.key, title: s.title || REQ[t.academy_path] || 'the avenue', done: s.complete, n: s.done, total: s.total, asked: t.academy_path, teamHas: s.teamHas };
    }
    return null;
  }
  function chipHtml(t, ls) {
    if (!t.training_id && !t.academy_path) return '';
    if (!ls) return '<div><span class="w166acad">Avenue Academy</span></div>';
    var open = (ls.asked === 'team' || ls.asked === 'any') && !ls.n && !ls.done;   /* nothing started yet: they choose */
    var what = ls.kind === 'module' ? 'Avenue Academy module' + (ls.mins ? ' &middot; ' + ls.mins + ' min' : '')
      : (open ? (ls.asked === 'team' && ls.teamHas ? 'Your team&rsquo;s Learning Avenues' : 'Learning Avenues')
        : (ls.title ? E(ls.title) : 'Learning Avenue') + (ls.total ? ' &middot; ' + ls.n + ' of ' + ls.total : ''));
    var go = ls.kind === 'module' ? '<button type="button" class="w166go" data-w166open="t:' + E(ls.id) + '">' + (ls.done ? 'Open it again' : 'Open it') + '</button>'
      : (!open && ls.key && ls.key !== 'team' && ls.key !== 'any' ? '<button type="button" class="w166go" data-w166open="p:' + E(ls.key) + '">' + (ls.done ? 'Open the avenue' : 'Go to the avenue') + '</button>'
        : '<button type="button" class="w166go" data-w166open="a:">Browse the avenues</button>');
    return '<div><span class="w166acad' + (ls.done ? ' ok' : '') + '">' + (ls.done ? '&#10003; ' : '') + what + '</span>' + go + '</div>';
  }
  /* the plan's steps with what the Academy already finished */
  function planStates(onb) {
    var cx = ctxFor(personOf(onb)), m = (typeof wa37StepsFor === 'function') ? wa37StepsFor(onb.id) : {};
    var weeks = (typeof wa37Weeks === 'function') ? wa37Weeks() : [], out = [];
    weeks.forEach(function (wk) {
      var list = wk.steps.filter(function (t) { return m[t.id]; }).map(function (t) {
        var ls = linkState(cx, t);
        return { t: t, s: m[t.id], ls: ls, done: !!(m[t.id].done || (ls && ls.done)) };
      });
      if (list.length) out.push({ name: wk.name, steps: list });
    });
    return out;
  }
  var __chk166 = (typeof wa37Checklist === 'function') ? wa37Checklist : null;
  function checklist(onb, canTick) {
    var today = todayIso(), html = '', firstOpen = false;
    planStates(onb).forEach(function (wk) {
      var d = wk.steps.filter(function (x) { return x.done; }).length;
      var open = !firstOpen && d < wk.steps.length; if (open) firstOpen = true;
      html += '<details class="w37week"' + (open ? ' open' : '') + '><summary>' + E(wk.name)
        + ' <span class="w37bar" style="max-width:140px"><i style="width:' + Math.round(100 * d / wk.steps.length) + '%"></i></span>'
        + '<span style="font-size:11.5px;color:#797773;font-weight:500">' + d + ' of ' + wk.steps.length + '</span></summary><div class="w37wbody">';
      wk.steps.forEach(function (x) {
        var t = x.t, s = x.s, ls = x.ls, done = x.done, acad = !!(t.training_id || t.academy_path);
        var due = '';
        if (!done && s.due_date) due = '<span class="w44due' + (String(s.due_date) < today ? ' late' : '') + '">due ' + E(String(s.due_date)) + '</span>';
        html += '<div class="w37step' + (t.parent_id ? ' child' : '') + (done ? ' done' : '') + '" data-w166t="' + E(t.id) + '">'
          + '<input type="checkbox" data-w37chk="' + s.id + '"' + (done ? ' checked' : '') + (canTick && !(ls && ls.done) ? '' : ' disabled')
          + (acad ? ' title="' + (ls && ls.done ? 'Done in the Avenue Academy' : 'Ticks itself when it is finished in the Avenue Academy') + '"' : '') + ' />'
          + '<div style="flex:1;min-width:0"><div class="nm">' + E(t.name)
          + (t.priority === 'high' ? '<span class="pr">important</span>' : '') + due + '</div>'
          + chipHtml(t, ls)
          + (t.description ? '<div class="ds">' + ((typeof wa37Md === 'function') ? wa37Md(t.description) : E(t.description)) + '</div>' : '')
          + (s.done && s.done_by ? '<div class="ds" style="opacity:.6">done by ' + E(s.done_by) + '</div>' : (done && !s.done ? '<div class="ds" style="opacity:.6">done in the Avenue Academy</div>' : ''))
          + '</div></div>';
      });
      html += '</div></details>';
    });
    return html;
  }
  if (__chk166) wa37Checklist = checklist;
  /* open a module or an avenue from the plan (the plan sheet closes behind it in the Academy's own routing) */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-w166open]') : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var v = String(b.getAttribute('data-w166open') || ''), k = v.slice(0, 2), id = v.slice(2);
    try { if (typeof closeModal === 'function' && b.closest('.modal-back')) closeModal(); } catch (x) { /* fine */ }
    if (k === 't:') location.hash = '#training/t/' + id;
    else if (k === 'p:') location.hash = '#training/p/' + id;
    else location.hash = '#training';
  }, true);

  /* the plan sheet in the Academy: which onboarding it shows (the Academy's own choice: the person's, not cancelled) */
  function planOnb() {
    try {
      if (typeof WA37 === 'undefined' || !WA37.onbs) return null;
      var n = myName().toLowerCase();
      return WA37.onbs.filter(function (o) { return o.status !== 'cancelled' && String(o.person_name || '').toLowerCase() === n; })[0] || null;
    } catch (e) { return null; }
  }
  /* its counts include the steps finished in the Academy that the page has not reloaded yet */
  function syncHead() {
    var sh = document.querySelector('#w122sheet .sh'); if (!sh || !sh.querySelector('.onbwrap')) return;
    var o = planOnb(); if (!o) return;
    var total = 0, done = 0;
    planStates(o).forEach(function (wk) { wk.steps.forEach(function (x) { total++; if (x.done) done++; }); });
    if (!total) return;
    var kk = sh.querySelector('.hd .kk span:last-child'); if (kk && / steps$/.test(kk.textContent)) kk.textContent = done + ' of ' + total + ' steps';
    var bar = sh.querySelector(':scope > .pr > i'); if (bar) bar.style.width = Math.round(100 * done / total) + '%';
    var st = sh.querySelector('.ft .st'); if (st && !st.querySelector('.ok') && / done$/.test(st.textContent)) st.textContent = done + ' of ' + total + ' done';
  }
  /* draw the plan again in place (after the Academy ticked steps), keeping the weeks that were open and the scroll */
  function replan() {
    var sh = document.querySelector('#w122sheet .sh'); if (!sh) return;
    var wrap = sh.querySelector('.onbwrap'); if (!wrap) return;
    var o = planOnb(); if (!o) return;
    var open = [].map.call(wrap.querySelectorAll('details.w37week'), function (d) { return d.open; });
    var main = sh.querySelector('.main'), top = main ? main.scrollTop : 0;
    wrap.innerHTML = checklist(o, true);
    [].forEach.call(wrap.querySelectorAll('details.w37week'), function (d, i) { if (open[i] != null) d.open = open[i]; });
    if (main) main.scrollTop = top;
    syncHead();
    try { document.dispatchEvent(new CustomEvent('w166replan')); } catch (e) { /* fine: wave167's journey listens */ }
  }
  /* the plan sheet: say how Academy steps work, and ask for help from here too */
  function decoratePlan() {
    var sh = document.querySelector('#w122sheet .sh'); if (!sh) return;
    var wrap = sh.querySelector('.onbwrap'); if (!wrap || wrap.getAttribute('data-w166')) return;
    wrap.setAttribute('data-w166', '1');
    var intro = sh.querySelector('.main .prose p');
    if (intro && intro.textContent.indexOf('Avenue Academy') < 0) intro.insertAdjacentHTML('beforeend', ' Steps marked Avenue Academy tick themselves when you finish the module or the avenue here, and the videos play inside the Hub.');
    var mine = planOnb(); if (mine && mine.status !== 'active') mine = null;
    if (mine) {
      /* the Academy's sheet sits above every modal, so the form opens right here */
      var left = planStates(mine).reduce(function (a, wk) { return a.concat(wk.steps.filter(function (x) { return !x.done; }).map(function (x) { return x.t; })); }, []);
      wrap.insertAdjacentHTML('afterend', '<div class="w166help" id="w166help"><button type="button" data-w166help="' + E(mine.id) + '">Stuck on a step? Ask for help</button> <span style="font-size:12px;color:#797773">HR and your lead see it in the Hub.</span>'
        + '<div class="w166hform">'
        + '<label style="font-size:12.5px;font-weight:700;color:#103F39">Which step<select id="w166hs" style="display:block;width:100%;margin-top:4px">' + left.map(function (t) { return '<option>' + E(t.name) + '</option>'; }).join('') + '<option>Something else</option></select></label>'
        + '<label style="font-size:12.5px;font-weight:700;color:#103F39">What is getting in the way<textarea id="w166hn" rows="3" style="display:block;width:100%;margin-top:4px" placeholder="A link that does not open, an invite that never came, a step that is unclear..."></textarea></label>'
        + '<div><button type="button" class="w122btn" data-w166hsend="' + E(mine.id) + '">Send it</button></div></div></div>');
    }
    syncHead();
  }
  document.addEventListener('click', async function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-w166hsend]') : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.disabled) return; b.disabled = true;
    try {
      var r = await db.from('onboarding_help').insert({ onboarding_id: Number(b.getAttribute('data-w166hsend')), person_name: myName() || 'A team member',
        step_name: (document.getElementById('w166hs') || {}).value || 'an onboarding step', note: ((document.getElementById('w166hn') || {}).value || '').trim() || null });
      if (r && r.error) throw r.error;
      var box = document.getElementById('w166help'); if (box) box.innerHTML = '<span class="w166acad ok">&#10003; Sent</span> <span style="font-size:12.5px;color:#4a5551">HR and your lead see it in the Hub and will reach out.</span>';
    } catch (err) { b.disabled = false; T('Could not send it'); }
  }, true);
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-w166help]') : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var f = b.parentElement && b.parentElement.querySelector('.w166hform'); if (f) { f.classList.toggle('on'); if (f.classList.contains('on')) { var ta = f.querySelector('textarea'); if (ta) ta.focus(); } }
  }, true);
