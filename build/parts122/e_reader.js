
  /* ---------- the sheet ---------- */
  function sheetEl() {
    var el = document.getElementById('w122sheet');
    if (!el) {
      el = document.createElement('div'); el.id = 'w122sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
      el.innerHTML = '<div class="bk" data-w122x="1"></div><div class="sh"></div>';
      document.body.appendChild(el);
    }
    return el;
  }
  function sheetOpen() { var el = document.getElementById('w122sheet'); return !!(el && el.classList.contains('on')); }
  function showSheet() {
    var el = sheetEl();
    if (!el.classList.contains('on')) {
      el.classList.add('on'); document.documentElement.classList.add('w122lock');
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('in'); }); });
    }
    return el.querySelector('.sh');
  }
  function closeSheet(silent) {
    stopTimer();
    if (R && R.t && R.secs > 3 && !R.saved) { var t0 = R.t, add = R.secs; R.saved = true; var cur = mine(t0.id); saveProg(t0, { seconds: (Number(cur && cur.seconds) || 0) + add }); }
    R = null;
    var el = document.getElementById('w122sheet');
    if (el && el.classList.contains('on')) {
      el.classList.remove('in'); document.documentElement.classList.remove('w122lock');
      setTimeout(function () { if (!el.classList.contains('in')) { el.classList.remove('on'); el.querySelector('.sh').innerHTML = ''; } }, 260);
    }
    if (!silent && /^#training\//.test(location.hash || '')) { try { location.hash = '#training'; } catch (e) { /* fine */ } }
    paintSoon();
  }
  function startTimer() { stopTimer(); if (!R) return; R.tick = setInterval(function () { if (R && document.visibilityState !== 'hidden') R.secs++; }, 1000); }
  function stopTimer() { if (R && R.tick) { clearInterval(R.tick); R.tick = null; } }

  function kindChip(t) { var k = KIND[kindOf(t)] || KIND.read; return '<span class="kd" style="background:linear-gradient(135deg,' + k.c1 + ',' + k.c2 + ')">' + ic(k.icon) + ' ' + E(k.l) + '</span>'; }
  function headHtml(t, sub) {
    var p = R && R.path ? R.path : pathOf(t), idx = '';
    if (p) { var items = pathItems(p); var i = items.indexOf(t); if (i >= 0) idx = ' &middot; ' + (i + 1) + ' of ' + items.length; }
    return '<div class="hd"><div class="hi"><div class="kk">' + kindChip(t) + (p ? '<span>' + E(p.title) + idx + '</span>' : (t.category ? '<span>' + E(t.category) + '</span>' : '')) +
      '<span>' + ic('clock') + ' ' + mins(minutesOf(t)) + '</span><span>' + ic('bolt') + ' ' + xpFor(t) + ' XP</span></div><h2>' + E(sub || t.title) + '</h2></div>' +
      '<div class="acts">' + (isLeader() && t.id ? '<button class="w122btn soft sm" data-w122assign="1">' + ic('user') + ' Assign</button>' : '') +
      (kindOf(t) === 'sop' ? (t.id && canEditSop(t) ? '<button class="w122btn soft sm" data-w122sopedit="1">' + ic('edit') + ' Edit</button>' : '') : (isLeader() && t.id && kindOf(t) !== 'tour' && kindOf(t) !== 'lesson' ? '<button class="w122btn soft sm" data-w122edit="1">' + ic('edit') + ' Edit</button>' : '')) +
      '<button class="xb" data-w122x="1" title="Close (Esc)">' + ic('x') + '</button></div></div>';
  }
  function railPath(t) {
    var p = R.path || pathOf(t); if (!p) return '';
    var items = pathItems(p);
    return '<div class="rail"><div class="rh">' + E(p.title) + '</div>' + items.map(function (x, i) {
      var ok = isDone(x.id);
      return '<button class="ri' + (x.id === t.id ? ' on' : '') + (ok ? ' ok' : '') + '" data-w122pitem="' + E(x.id) + '"><span class="n">' + (ok ? ic('check') : (i + 1)) + '</span><span>' + E(String(x.title).replace(/^Page tour:\s*/, '')) + '</span></button>';
    }).join('') + '</div>';
  }
  function footHtml(t, primary) {
    var r = mine(t.id), done = r && r.status === 'done';
    return '<div class="ft"><div class="st">' + (done ? '<span class="ok">' + ic('check') + ' Completed ' + E(fmtShort(r.done_at)) + '</span>' + (r.score != null && kindOf(t) === 'lesson' ? ' &middot; knowledge check ' + E(r.score) + '%' : '') + ' <button class="w122lnk" data-w122undone="1" style="font-weight:500;color:#9a9893">Mark as not complete</button>' : (r && r.assigned_by ? 'Assigned by ' + E(r.assigned_by) : (r && r.started_at ? 'Started ' + E(fmtShort(r.started_at)) : ''))) + '</div><span class="sp"></span>' + (primary || '') + nextBtn(t, done) + '</div>';
  }
  function nextInPath(t) { var p = R && R.path ? R.path : pathOf(t); if (!p) return null; var items = pathItems(p); var i = items.indexOf(t); for (var j = i + 1; j < items.length; j++) if (!isDone(items[j].id)) return items[j]; for (var k = 0; k < items.length; k++) if (items[k] !== t && !isDone(items[k].id)) return items[k]; return null; }
  function nextBtn(t, done) { if (!done) return ''; var n = nextInPath(t); return n ? '<button class="w122btn" data-w122pitem="' + E(n.id) + '">Next: ' + E(String(n.title).replace(/^Page tour:\s*/, '').slice(0, 42)) + ' ' + ic('arrow') + '</button>' : ''; }

  function openTraining(id, ctx) {
    var t = A.byId[String(id)];
    if (!t) { toastS('That training is not in the catalog any more'); if (/^#training\//.test(location.hash)) location.hash = '#training'; return; }
    stopTimer();
    R = { t: t, kind: kindOf(t), mode: 'view', ch: 0, quiz: null, path: (ctx && ctx.path) || (R && R.path && pathItems(R.path).indexOf(t) >= 0 ? R.path : pathOf(t)), secs: 0, saved: false, preview: false };
    var r = mine(t.id);
    if (R.kind === 'lesson' && r && r.last_step != null) R.ch = Math.max(0, Math.min((lessonBody(t).chapters || []).length - 1, Number(r.last_step) || 0));
    if (R.kind !== 'tour' && (!r || (r.status !== 'done' && !r.started_at))) saveProg(t, { status: r && r.status === 'assigned' ? 'assigned' : 'started', started_at: nowIso() });
    if (R.kind === 'lesson' && !isDone(t.id)) markSeen(t, R.ch);
    renderSheet(); startTimer();
  }
  function renderSheet() {
    if (!R) return;
    var sh = showSheet();
    if (R.mode === 'path') return renderPath(sh);
    if (R.mode === 'onb') return renderOnb(sh);
    if (R.mode === 'cert') return renderCert(sh);
    if (R.mode === 'form') return renderForm(sh);
    if (R.mode === 'sopform') return renderSopForm(sh);
    var t = R.t;
    if (R.mode === 'assign') return renderAssign(sh, t);
    var k = R.kind, html = '';
    if (k === 'lesson') html = lessonHtml(t);
    else if (k === 'video') html = headHtml(t) + '<div class="pr"><i style="width:' + pctOf(t) + '%"></i></div><div class="bd">' + railPath(t) + '<div class="main"><div class="wrap wide">' + videoHtml(t) + '</div></div></div>' + footHtml(t, isDone(t.id) ? '' : '<button class="w122btn" data-w122done="1">' + ic('check') + ' I have watched it</button>');
    else if (k === 'doc') html = headHtml(t) + '<div class="pr"><i style="width:' + pctOf(t) + '%"></i></div><div class="bd">' + railPath(t) + '<div class="main"><div class="wrap' + (R.preview ? ' wide' : '') + '">' + docHtml(t) + '</div></div></div>' + footHtml(t, isDone(t.id) ? '' : '<button class="w122btn" data-w122done="1">' + ic('check') + ' Mark as complete</button>');
    else if (k === 'sop') html = headHtml(t, sopTitle(t)) + '<div class="pr"><i style="width:' + pctOf(t) + '%"></i></div><div class="bd">' + railPath(t) + '<div class="main"><div class="wrap wide">' + sopHtml(t) + '</div></div></div>' + footHtml(t, isDone(t.id) ? '' : '<button class="w122btn" data-w122done="1">' + ic('check') + ' I have read it</button>');
    else if (k === 'tour') html = headHtml(t) + '<div class="pr"><i style="width:' + pctOf(t) + '%"></i></div><div class="bd">' + railPath(t) + '<div class="main"><div class="wrap">' + tourIntroHtml(t) + '</div></div></div>' + footHtml(t, '<button class="w122btn" data-w122starttour="' + E(tourKeyOf(t)) + '">' + ic('map') + (isDone(t.id) ? ' Take it again' : ' Start the tour') + '</button>');
    else html = headHtml(t) + '<div class="pr"><i style="width:' + pctOf(t) + '%"></i></div><div class="bd">' + railPath(t) + '<div class="main"><div class="wrap"><div class="prose">' + articleHtml(t) + '</div></div></div></div>' + footHtml(t, isDone(t.id) ? '' : '<button class="w122btn" data-w122done="1">' + ic('check') + ' Mark as complete</button>');
    sh.innerHTML = html;
    var main = sh.querySelector('.main'); if (main) main.scrollTop = 0;
    if (!sh.getAttribute('tabindex')) sh.setAttribute('tabindex', '-1'); try { sh.focus({ preventScroll: true }); } catch (e) { /* fine */ }
  }
  function videoHtml(t) {
    var src = embedOf(t);
    var v = src ? '<div class="vid"><iframe src="' + E(src) + '" title="' + E(t.title) + '" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen loading="lazy"></iframe></div>'
      : '<div class="vid"><div class="ph">' + ic('play') + '<div>This video can’t play inside the Hub.</div>' + (t.resource_url ? '<a class="w122btn white sm" href="' + E(t.resource_url) + '" target="_blank" rel="noopener">Open it in a new tab ' + ic('ext') + '</a>' : '') + '</div></div>';
    var desc = String(t.description || '').trim();
    return v + '<div class="meta2"><span>' + ic('clock') + ' ' + mins(minutesOf(t)) + '</span>' + (t.resource_url ? '<a class="w122lnk" href="' + E(t.resource_url) + '" target="_blank" rel="noopener">' + ic('ext') + ' Open in ' + E(/loom\.com/.test(t.resource_url) ? 'Loom' : hostOf(t.resource_url)) + '</a>' : '') + '</div>' +
      (desc ? '<div class="prose" style="margin-top:18px">' + articleText(desc) + '</div>' : '') + relatedTours(t);
  }
  function docHtml(t) {
    var u = String(t.resource_url || ''), pv = previewOf(u);
    var h = '<div class="docbox"><div class="i">' + ic('file') + '</div><div class="tx"><b>' + E(t.title) + '</b><span>' + E(hostOf(u)) + '</span></div>' +
      (u ? '<a class="w122btn" href="' + E(u) + '" target="_blank" rel="noopener">Open the document ' + ic('ext') + '</a>' : '') + (pv ? '<button class="w122btn soft" data-w122preview="1">' + (R.preview ? 'Hide the preview' : 'Preview here') + '</button>' : '') + '</div>';
    if (pv && R.preview) h += '<div class="pvw"><iframe src="' + E(pv) + '" title="' + E(t.title) + '" loading="lazy"></iframe></div><p class="snote">If the preview asks you to sign in or stays blank, use Open the document instead.</p>';
    var desc = String(t.description || '').trim();
    return h + (desc ? '<div class="prose">' + articleText(desc) + '</div>' : '') + relatedTours(t);
  }
  function articleHtml(t) {
    var desc = String(t.description || '').trim();
    return (desc ? articleText(desc) : '<p>This training has no written content yet.</p>') + relatedTours(t);
  }
  function articleText(text) {
    return redact(text).split(/\n{2,}/).map(function (p) {
      var s = p.trim(); if (!s) return '';
      if (/^try it:/i.test(s)) return '<div class="callout try">' + ic('bolt') + '<div><b>Try it</b>' + md(s.replace(/^try it:\s*/i, '')) + '</div></div>';
      if (/^done when:/i.test(s)) return '<div class="callout info">' + ic('check') + '<div><b>Done when</b>' + md(s.replace(/^done when:\s*/i, '')) + '</div></div>';
      if (/^goal:/i.test(s)) return '<p class="lead">' + md(s.replace(/^goal:\s*/i, '')) + '</p>';
      var lines = s.split('\n');
      if (lines.length > 1 && lines.every(function (l) { return /^\s*(?:[-•*]|\d+[.)])\s+/.test(l); })) return '<ul>' + lines.map(function (l) { return '<li>' + md(l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '')) + '</li>'; }).join('') + '</ul>';
      return '<p>' + lines.map(md).join('<br>') + '</p>';
    }).join('');
  }
  function relatedTours(t) {
    var keys = (t.body && t.body.tours) || [];
    keys = keys.filter(function (k) { return TOURS[k] && tourAvail(k); });
    if (!keys.length) return '';
    return '<h3 style="font-size:17px;margin:26px 0 10px">See it for yourself</h3><div class="cards">' + keys.map(function (k) {
      var tt = A.byKey['tour:' + k];
      return '<div class="c" style="cursor:pointer" data-w122starttour="' + E(k) + '"><div class="i">' + ic(TOURS[k].icon || 'map') + '</div><b>' + E(tt ? String(tt.title).replace(/^Page tour:\s*/, '') : k) + '</b><p>' + E(tt ? tt.description : '') + '</p><span class="k">Page tour' + (tt && isDone(tt.id) ? ' · done' : '') + '</span></div>';
    }).join('') + '</div>';
  }
  function tourIntroHtml(t) {
    var k = tourKeyOf(t), d = TOURS[k];
    if (!d) return '<p>This tour is not available.</p>';
    var steps = typeof d.steps === 'function' ? d.steps() : d.steps;
    return '<div class="prose"><p class="lead">' + E(t.description || '') + '</p><p>The tour opens the page and highlights each part in turn. Use the arrow keys or the buttons to move through it, and Esc to stop. It takes about ' + mins(minutesOf(t)) + '.</p></div>' +
      '<div class="tourlist">' + steps.filter(function (s) { return !s.hidden; }).map(function (s, i) { return '<div><i>' + (i + 1) + '</i><div><b>' + E(s.t) + '</b></div></div>'; }).join('') + '</div>';
  }

  /* ---------- lessons ---------- */
  function lessonBody(t) { var b = t.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } } return b && b.chapters ? b : { chapters: [] }; }
  function lessonHtml(t) {
    var b = lessonBody(t), chs = b.chapters || [], hasQ = !!(b.quiz && b.quiz.questions && b.quiz.questions.length);
    var r = mine(t.id), seen = (r && r.data && r.data.seen) || [];
    var total = chs.length + (hasQ ? 1 : 0), onQuiz = R.ch >= chs.length;
    var pct = isDone(t.id) ? 100 : Math.round(100 * Math.min(total, seen.length + (onQuiz ? 0 : 0)) / Math.max(1, total));
    var rail = '<div class="rail"><div class="rh">In this lesson</div>' + chs.map(function (c, i) {
      var ok = seen.indexOf(c.id) >= 0 || isDone(t.id);
      return '<button class="ri' + (i === R.ch ? ' on' : '') + (ok ? ' ok' : '') + '" data-w122ch="' + i + '"><span class="n">' + (ok ? ic('check') : (i + 1)) + '</span><span>' + E(c.t) + '</span></button>';
    }).join('') + (hasQ ? '<button class="ri' + (onQuiz ? ' on' : '') + (isDone(t.id) ? ' ok' : '') + '" data-w122ch="' + chs.length + '"><span class="n">' + (isDone(t.id) ? ic('check') : ic('star')) + '</span><span>Knowledge check</span></button>' : '') + '</div>';
    var body;
    if (onQuiz && hasQ) body = quizHtml(t, b.quiz);
    else {
      var c = chs[R.ch] || { t: '', blocks: [] };
      body = (R.ch === 0 && b.summary ? '' : '') + '<div class="chh">Chapter ' + (R.ch + 1) + ' of ' + chs.length + '</div><div class="cht">' + E(c.t) + '</div><div class="prose">' + blocksHtml(c.blocks || []) + '</div>' +
        '<div class="chfoot">' + (R.ch > 0 ? '<button class="w122btn soft" data-w122ch="' + (R.ch - 1) + '">' + ic('back') + ' Previous</button>' : '') + '<span class="sp"></span>' +
        (R.ch < chs.length - 1 ? '<button class="w122btn" data-w122ch="' + (R.ch + 1) + '">Next: ' + E(chs[R.ch + 1].t) + ' ' + ic('arrow') + '</button>' : (hasQ ? '<button class="w122btn gold" data-w122ch="' + chs.length + '">' + ic('star') + ' Take the knowledge check</button>' : (isDone(t.id) ? '' : '<button class="w122btn" data-w122done="1">' + ic('check') + ' Finish the lesson</button>'))) + '</div>';
    }
    return headHtml(t) + '<div class="pr"><i style="width:' + pct + '%"></i></div><div class="bd">' + rail + '<div class="main"><div class="wrap">' + body + '</div></div></div>' + footHtml(t, '');
  }
  function markSeen(t, idx) {
    var b = lessonBody(t), c = (b.chapters || [])[idx]; if (!c) return;
    var r = mine(t.id) || {}; var data = Object.assign({}, r.data || {}); var seen = (data.seen || []).slice();
    if (seen.indexOf(c.id) < 0) seen.push(c.id);
    data.seen = seen;
    var total = (b.chapters || []).length + (b.quiz ? 1 : 0);
    var patch = { data: data, last_step: idx };
    if (!r || r.status !== 'done') patch.pct = Math.min(95, Math.round(100 * seen.length / Math.max(1, total)));
    saveProg(t, patch);
  }
  function blocksHtml(blocks) { return blocks.map(blockHtml).join(''); }
  function blockHtml(b) {
    switch (b.type) {
      case 'lead': return '<p class="lead">' + md(b.text) + '</p>';
      case 'p': return '<p>' + md(b.text) + '</p>';
      case 'h': return '<h3>' + E(b.text) + '</h3>';
      case 'quote': return '<div class="quote">“' + E(b.text) + '”' + (b.by ? '<span>' + E(b.by) + '</span>' : '') + '</div>';
      case 'stats': return '<div class="stats">' + (b.items || []).map(function (x) { return '<div><b>' + E(x.n) + '</b><span>' + E(x.l) + '</span></div>'; }).join('') + '</div>' + (b.note ? '<p class="snote">' + E(b.note) + '</p>' : '');
      case 'note': return '<p class="snote">' + md(b.text) + '</p>';
      case 'cards': return '<div class="cards">' + (b.items || []).map(function (x) { return '<div class="c"><div class="i">' + ic(x.icon || 'spark') + '</div><b>' + E(x.t) + '</b><p>' + md(x.d) + '</p>' + (x.k ? '<span class="k">' + E(x.k) + '</span>' : '') + '</div>'; }).join('') + '</div>';
      case 'activities': return '<div class="acts8">' + (b.items || []).map(function (x) {
        return '<div class="a8" data-a8="' + E(x.n) + '"><button data-w122a8="' + E(x.n) + '"><span class="nn">' + E(x.n) + '</span><span><b>' + E(x.t) + '</b><p>' + E(x.sum) + '</p></span><span class="cv">' + ic('chev') + '</span></button>' +
          '<div class="more"><b style="display:block;margin:0 0 4px">How we do it</b><ul>' + (x.how || []).map(function (h) { return '<li>' + md(h) + '</li>'; }).join('') + '</ul>' +
          (x.teams ? '<div class="tm"><b>Who is involved: </b>' + E(x.teams) + '</div>' : '') + (x.extra ? '<div class="ex">' + E(x.extra) + '</div>' : '') + '</div></div>';
      }).join('') + '</div>';
      case 'callout': { var icn = { info: 'compass', tip: 'sparkle', warn: 'flag', try: 'bolt' }[b.tone] || 'compass'; return '<div class="callout ' + E(b.tone || 'info') + '">' + ic(icn) + '<div>' + (b.t ? '<b>' + E(b.t) + '</b>' : '') + md(b.text) + '</div></div>'; }
      case 'compare': return '<div class="compare">' + (b.cols || []).map(function (c) { return '<div class="col ' + E(c.tone || 'neutral') + '"><h4>' + ic(c.tone === 'bad' ? 'x' : 'check') + E(c.t) + '</h4>' + (c.items || []).map(function (x) { return '<div>' + E(x) + '</div>'; }).join('') + '</div>'; }).join('') + '</div>';
      case 'list': return '<ul>' + (b.items || []).map(function (x) { return '<li>' + md(x) + '</li>'; }).join('') + '</ul>';
      case 'steps': return '<div class="steps">' + (b.items || []).map(function (x) { return '<div class="s"><div><b>' + E(x.t) + '</b><p>' + md(x.d) + '</p></div></div>'; }).join('') + '</div>';
      case 'link': return linkCard(b);
      case 'links': return (b.items || []).map(linkCard).join('');
      case 'kinds': { var cols = { Partner: [GREEN, '#1d5a51'], Sponsor: ['#B9851B', '#D9A43A'], Collaborator: [PURPLE, '#8b80c9'] }; return '<div class="kinds">' + (b.items || []).map(function (x) { var c = cols[x.t] || [GREEN, TEAL]; return '<div class="k3" style="background:linear-gradient(145deg,' + c[0] + ',' + c[1] + ')"><span class="i">' + ic(x.icon || 'star') + '</span><b>' + E(x.t) + '</b><p>' + E(x.d) + '</p>' + (x.e ? '<div class="e">For example: ' + E(x.e) + '</div>' : '') + '</div>'; }).join('') + '</div>'; }
      case 'partners': return '<div class="pgroups">' + (b.groups || []).map(function (g) { return '<div class="pg"><h4>' + E(g.g) + '</h4><div class="pl">' + (g.items || []).map(function (x) { var st = String(x.s || ''); var cls = st.indexOf('New') === 0 ? 'New' : st; return '<div class="p"><b><span>' + E(x.n) + '</span><span class="w122st ' + E(cls) + '">' + E(st) + '</span></b><p>' + E(x.d) + '</p></div>'; }).join('') + '</div></div>'; }).join('') + '</div>';
      case 'stages': { var tc = { muted: '#9a9893', gold: GOLD, green: TEAL, purple: PURPLE, flag: FLAG }; return '<div class="stages">' + (b.items || []).map(function (x) { return '<div class="g"><i style="background:' + (tc[x.tone] || TEAL) + '"></i><b>' + E(x.t) + '</b><span>' + E(x.d) + '</span></div>'; }).join('') + '</div>'; }
      default: return b.text ? '<p>' + md(b.text) + '</p>' : '';
    }
  }
  function linkCard(x) { return '<a class="lnk2" href="' + E(x.url) + '" target="_blank" rel="noopener"><span class="i">' + ic('doc') + '</span><span><b>' + E(x.t) + '</b><span>' + E(x.d || hostOf(x.url)) + '</span></span><span class="ar">' + ic('ext') + '</span></a>'; }

  /* ---------- the knowledge check ---------- */
  function quizHtml(t, q) {
    var qs = q.questions || [];
    if (!R.quiz) R.quiz = { i: 0, picks: [], shown: false, first: !(mine(t.id) && mine(t.id).data && mine(t.id).data.quizTries) };
    var Z = R.quiz;
    if (Z.i >= qs.length) {
      var right = Z.picks.filter(function (p, i) { return p === qs[i].c; }).length, pct = Math.round(100 * right / qs.length), pass = pct >= Math.round(100 * (q.pass || 0.8));
      return '<div class="quiz"><div class="res"><div class="rg">' + ring(pct, 150, 12, pass ? TEAL : FLAG) + '<b>' + pct + '%</b></div><h3>' + (pass ? (pct === 100 ? 'Perfect score!' : 'You passed') : 'Almost there') + '</h3>' +
        '<p>' + right + ' of ' + qs.length + ' right. ' + (pass ? 'This lesson is complete.' : 'You need ' + Math.round(100 * (q.pass || 0.8)) + '% to pass. Review the chapters and try again.') + '</p>' +
        (pass ? (isDone(t.id) ? '' : '<button class="w122btn" data-w122qfinish="' + pct + '">' + ic('check') + ' Complete the lesson</button>') : '<button class="w122btn" data-w122qretry="1">' + ic('refresh') + ' Try again</button> <button class="w122btn soft" data-w122ch="0">Review the lesson</button>') + '</div></div>';
    }
    var cur = qs[Z.i], picked = Z.picks[Z.i];
    var dots = qs.map(function (x, i) { return '<i class="' + (i < Z.i ? (Z.picks[i] === qs[i].c ? 'ok' : 'no') : i === Z.i ? 'cur' : '') + '"></i>'; }).join('');
    return '<div class="quiz"><div class="dots">' + dots + '</div><div class="qn">Question ' + (Z.i + 1) + ' of ' + qs.length + '</div><div class="qq">' + E(cur.q) + '</div><div class="opts">' +
      cur.a.map(function (a, i) { var cls = picked == null ? '' : (i === cur.c ? ' right' : (i === picked ? ' wrong' : '')); return '<button class="op' + cls + '" data-w122opt="' + i + '"' + (picked != null ? ' disabled' : '') + '><span class="l">' + 'ABCDEF'[i] + '</span><span>' + E(a) + '</span></button>'; }).join('') + '</div>' +
      (picked != null ? '<div class="why"><b>' + (picked === cur.c ? 'Right. ' : 'Not quite. ') + '</b>' + E(cur.why || '') + '</div><div class="chfoot"><span class="sp"></span><button class="w122btn" data-w122qnext="1">' + (Z.i + 1 < qs.length ? 'Next question' : 'See my score') + ' ' + ic('arrow') + '</button></div>' : '') + '</div>';
  }

  /* ---------- path view ---------- */
  function openPath(key) {
    var p = pathByKey(key); if (!p) { toastS('That path is not available'); location.hash = '#training'; return; }
    stopTimer(); R = { mode: 'path', path: p, secs: 0 }; renderSheet();
  }
  function renderPath(sh) {
    var p = R.path, ps = pathState(p), col = p.color || GREEN, cert = A.myAwards['cert:' + p.key];
    var html = '<div class="hd"><div class="hi"><div class="kk"><span class="kd" style="background:linear-gradient(135deg,' + E(col) + ',' + E(shade(col)) + ')">' + ic('map') + ' Learning path</span><span>' + plural(ps.total, 'item') + '</span></div><h2>' + E(p.title) + '</h2></div><div class="acts"><button class="xb" data-w122x="1">' + ic('x') + '</button></div></div>' +
      '<div class="pr"><i style="width:' + ps.pct + '%"></i></div><div class="bd"><div class="main"><div class="wrap">' +
      '<div class="phero" style="background:linear-gradient(135deg,' + E(col) + ',' + E(shade(col)) + ')"><span class="big">' + ic(p.icon || 'book') + '</span><h3>' + E(p.title) + '</h3><p>' + E(p.blurb || '') + '</p><div class="bar"><i style="width:' + ps.pct + '%"></i></div><div style="font-size:13px">' + ps.done + ' of ' + ps.total + ' done' + (ps.minsLeft ? ' &middot; about ' + mins(ps.minsLeft) + ' left' : '') + '</div></div>' +
      (cert ? '<div class="callout tip">' + ic('seal') + '<div><b>Certified</b>You earned the ' + E(p.cert_title || p.title) + ' certificate on ' + E(fmtDate(cert.earned_at)) + '. <button class="w122lnk" data-w122cert="cert:' + E(p.key) + '">View it</button></div></div>' : '<div class="callout info">' + ic('seal') + '<div><b>' + E(p.cert_title || p.title) + ' certificate</b>Finish every item to earn it.</div></div>') +
      '<div class="pitems">' + ps.items.map(function (t, i) {
        var ok = isDone(t.id), k = KIND[kindOf(t)] || KIND.read;
        return '<button class="pitem' + (ok ? ' ok' : '') + '" data-w122pitem="' + E(t.id) + '"><span class="n">' + (ok ? ic('check') : (i + 1)) + '</span><span class="tx"><b>' + E(String(t.title).replace(/^Page tour:\s*/, '')) + '</b><span>' + E(k.l) + ' &middot; ' + mins(minutesOf(t)) + (ok ? ' &middot; done' : '') + '</span></span>' + ic('chev') + '</button>';
      }).join('') + '</div></div></div></div>' +
      '<div class="ft"><div class="st">' + (ps.complete ? '<span class="ok">' + ic('check') + ' Path complete</span>' : ps.done + ' of ' + ps.total + ' done') + '</div><span class="sp"></span>' + (ps.next ? '<button class="w122btn" data-w122pitem="' + E(ps.next.id) + '">' + (ps.done ? 'Continue' : 'Start') + ': ' + E(String(ps.next.title).replace(/^Page tour:\s*/, '').slice(0, 40)) + ' ' + ic('arrow') + '</button>' : '') + '</div>';
    sh.innerHTML = html;
  }

  /* ---------- the onboarding plan ---------- */
  function openOnb() { stopTimer(); R = { mode: 'onb', secs: 0, open: {} }; renderSheet(); }
  function renderOnb(sh) {
    var g = orgState();
    if (!g.has) { sh.innerHTML = '<div class="hd"><div class="hi"><h2>Your onboarding plan</h2></div><div class="acts"><button class="xb" data-w122x="1">' + ic('x') + '</button></div></div><div class="bd"><div class="main"><div class="wrap"><p class="prose">HR has not assigned your onboarding plan yet.</p></div></div></div>'; return; }
    var inner = ''; try { inner = wa37Checklist(g.o, true) || ''; } catch (e) { inner = '<p>The plan could not load.</p>'; }
    sh.innerHTML = '<div class="hd"><div class="hi"><div class="kk"><span class="kd" style="background:linear-gradient(135deg,#B9851B,' + GOLD + ')">' + ic('list') + ' Onboarding</span><span>' + g.done + ' of ' + g.total + ' steps</span></div><h2>Your onboarding plan</h2></div><div class="acts"><button class="xb" data-w122x="1">' + ic('x') + '</button></div></div>' +
      '<div class="pr"><i style="width:' + g.pct + '%"></i></div><div class="bd"><div class="main"><div class="wrap"><div class="prose"><p>Work top to bottom and tick each step as you go. Big steps fold their details away; open a week to see everything in it. Lean on your onboarding channel whenever something is unclear.</p></div><div class="onbwrap">' + inner + '</div></div></div></div>' +
      '<div class="ft"><div class="st">' + (g.complete ? '<span class="ok">' + ic('check') + ' Complete</span>' : g.done + ' of ' + g.total + ' done') + '</div><span class="sp"></span><button class="w122btn" data-w122x="1">Done</button></div>';
    /* keep the weeks the person had open */
    sh.querySelectorAll('.onbwrap details.w37week').forEach(function (d, i) { if (R.open[i] != null) d.open = R.open[i]; d.addEventListener('toggle', function () { if (R && R.open) R.open[i] = d.open; }); });
  }

  /* ---------- certificates ---------- */
  function openCert(award) {
    var a = A.myAwards[award]; if (!a) { toastS('That certificate is not earned yet'); location.hash = '#training'; return; }
    stopTimer(); R = { mode: 'cert', award: a, secs: 0 }; renderSheet();
  }
  function certHtml(a) {
    var m = me();
    return '<div class="w122cert"><div class="c-top">WELFARE AVENUE &middot; TRAINING ACADEMY</div><div class="c-title">Certificate of completion</div><div class="c-sub">This certifies that</div><div class="c-name">' + E(m.full || m.name) + '</div><div class="c-sub">has completed</div><div class="c-path">' + E(a.title) + '</div>' +
      '<div class="c-meta"><span>Awarded ' + E(fmtDate(a.earned_at)) + '</span><span>Certificate ' + E(certNo(a, a.earned_at)) + '</span></div><div class="c-seal">' + ic('seal') + '</div></div>';
  }
  function renderCert(sh) {
    var a = R.award, shared = a.meta && a.meta.shared;
    sh.innerHTML = '<div class="hd"><div class="hi"><div class="kk"><span class="kd" style="background:linear-gradient(135deg,#B9851B,' + GOLD + ')">' + ic('seal') + ' Certificate</span></div><h2>' + E(a.title) + '</h2></div><div class="acts"><button class="xb" data-w122x="1">' + ic('x') + '</button></div></div>' +
      '<div class="bd"><div class="main"><div class="wrap wide">' + certHtml(a) + '</div></div></div>' +
      '<div class="ft"><div class="st">Earned ' + E(fmtDate(a.earned_at)) + '</div><span class="sp"></span>' + (shared ? '<span class="st">' + ic('check') + ' Shared with the team</span>' : '<button class="w122btn soft" data-w122share="' + E(a.award) + '">' + ic('megaphone') + ' Share with the team</button>') + '<button class="w122btn" data-w122print="' + E(a.award) + '">' + ic('print') + ' Print or save as PDF</button></div>';
  }
  function printCert(award) {
    var a = A.myAwards[award]; if (!a) return;
    var w = window.open('', '_blank'); if (!w) { toastS('Allow pop-ups for the Hub to print the certificate'); return; }
    var certCss = (document.getElementById('wa122css') || {}).textContent || '';
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + E(a.title) + ' certificate</title><style>@page{size:A4 landscape;margin:12mm;}body{margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;}.w122cert{width:260mm;max-width:100%;}' +
      certCss + '</style></head><body>' + certHtml(a) + '<script>setTimeout(function(){window.print();},350);<\/script></body></html>');
    w.document.close();
  }
  async function shareAward(award, silent) {
    var a = A.myAwards[award]; if (!a || (a.meta && a.meta.shared)) return;
    var m = me();
    var text = a.kind === 'cert' ? m.name + ' earned the ' + a.title + ' certificate in the Training academy.' : m.name + ' reached ' + a.title + ' in the Training academy.';
    try {
      var r = await db.from('hub_shoutouts').insert({ kind: 'manual', source: 'academy', ref: 'award:' + award, person: m.name, member_id: m.id || null, team: m.dept || null, text: text, by: m.email });
      if (r && r.error) throw r.error;
      a.meta = Object.assign({}, a.meta || {}, { shared: true });
      try { await db.from('academy_awards').update({ meta: a.meta }).eq('person_name', m.name).eq('award', award); } catch (e) { /* the shout-out is what matters */ }
      if (!silent) toastS('Shared with the team. It shows in the HR centre shout-outs.');
      if (R && R.mode === 'cert') renderSheet();
    } catch (e) { if (!silent) toastS('Could not share it right now'); }
  }

  /* ---------- assign (leaders) ---------- */
  function renderAssign(sh, t) {
    var q = (R.q || '').toLowerCase();
    var ppl = people().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }).filter(function (p) { return !q || String(p.name + ' ' + (p.role || '') + ' ' + (p.department || '')).toLowerCase().indexOf(q) >= 0; });
    R.pick = R.pick || {};
    sh.innerHTML = headHtml(t, 'Assign: ' + t.title) + '<div class="bd"><div class="main"><div class="wrap"><div class="prose"><p>Pick the people who should take this training. It shows up in their Up next with your name on it, and HR sees it on the training board.</p></div>' +
      '<label class="w122srch" style="max-width:none;background:#fff">' + ic('search') + '<input type="search" data-w122aq="1" placeholder="Search people" value="' + E(R.q || '') + '"></label><div class="ppl">' + ppl.map(function (p) {
        var r = rowFor(t.id, p.name), st = r ? (r.status === 'done' ? 'done ' + fmtShort(r.done_at) : (r.assigned_by ? 'assigned' : 'started')) : '';
        return '<label><input type="checkbox" data-w122pick="' + E(p.name) + '"' + (R.pick[p.name] ? ' checked' : '') + (r && r.status === 'done' ? ' disabled' : '') + '><span>' + E(p.name) + ' <em>' + E(p.role || '') + '</em></span><em>' + E(st) + '</em></label>';
      }).join('') + '</div></div></div></div><div class="ft"><button class="w122btn soft" data-w122assignx="1">' + ic('back') + ' Back</button><span class="sp"></span><button class="w122btn" data-w122assigngo="1">' + ic('check') + ' Assign to ' + Object.keys(R.pick).filter(function (k) { return R.pick[k]; }).length + '</button></div>';
  }
  async function doAssign() {
    var t = R.t, names = Object.keys(R.pick || {}).filter(function (k) { return R.pick[k]; });
    if (!names.length) { toastS('Pick at least one person'); return; }
    var by = me().name, n = 0;
    for (var i = 0; i < names.length; i++) { var cur = rowFor(t.id, names[i]); if (cur && cur.status === 'done') continue; var ok = await saveProg(t, { status: cur && cur.status === 'started' ? 'started' : 'assigned', assigned_by: by }, names[i]); if (ok) n++; }
    toastS('Assigned to ' + plural(n, 'person', 'people'));
    R.mode = 'view'; R.pick = {}; renderSheet(); paintSoon();
  }

  /* ---------- add or edit a training (leaders) ---------- */
  function openForm(t) { stopTimer(); R = { mode: 'form', t: t || null, secs: 0 }; renderSheet(); }
  function renderForm(sh) {
    var t = R.t || {}, isNew = !R.t;
    var cats = A.cats.slice(); if (t.category && cats.indexOf(t.category) < 0) cats.push(t.category);
    var kinds = [['video', 'Video (Loom, YouTube, Vimeo or Drive link)'], ['doc', 'Document or link'], ['read', 'Reading (write it here)']];
    var paths = pathDefs();
    sh.innerHTML = '<div class="hd"><div class="hi"><div class="kk"><span class="kd" style="background:linear-gradient(135deg,' + GREEN + ',' + TEAL + ')">' + ic(isNew ? 'plus' : 'edit') + (isNew ? ' New training' : ' Edit') + '</span></div><h2>' + (isNew ? 'Add a training' : E(t.title)) + '</h2></div><div class="acts"><button class="xb" data-w122x="1">' + ic('x') + '</button></div></div>' +
      '<div class="bd"><div class="main"><div class="wrap"><div class="form">' +
      '<label>Title<input type="text" data-f="title" value="' + E(t.title || '') + '" placeholder="For example: Running a Sunday serving"></label>' +
      '<div class="row2"><label>Type<select data-f="kind">' + kinds.map(function (k) { return '<option value="' + k[0] + '"' + (kindOf(t) === k[0] && !isNew || (isNew && k[0] === 'video') ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select></label>' +
      '<label>Minutes<input type="number" min="1" max="600" data-f="minutes" value="' + E(t.minutes || (t.id ? minutesOf(t) : '')) + '"></label></div>' +
      '<label>Link (video or document)<input type="url" data-f="resource_url" value="' + E(t.resource_url || '') + '" placeholder="https://www.loom.com/share/..."></label>' +
      '<div class="row2"><label>Topic<input type="text" list="w122cats" data-f="category" value="' + E(t.category || 'General') + '"><datalist id="w122cats">' + cats.map(function (c) { return '<option value="' + E(c) + '">'; }).join('') + '</datalist></label>' +
      '<label>Learning path<select data-f="path_group"><option value="">None</option>' + paths.map(function (p) { return '<option value="' + E(p.name) + '"' + (t.path_group === p.name ? ' selected' : '') + '>' + E(p.title) + '</option>'; }).join('') + '</select></label></div>' +
      '<label>Description or the reading itself<textarea data-f="description" placeholder="What people will learn. For a reading, write it here: blank lines make paragraphs, and lines starting Try it: or Done when: become highlighted boxes.">' + E(t.description || '') + '</textarea></label>' +
      '</div></div></div></div><div class="ft">' + (!isNew ? '<button class="w122btn ghost" data-w122retire="1">Retire it</button>' : '') + '<span class="sp"></span><button class="w122btn soft" data-w122x="1">Cancel</button><button class="w122btn" data-w122save="1">' + ic('check') + ' Save</button></div>';
  }
  async function saveForm() {
    var sh = document.querySelector('#w122sheet .sh'); if (!sh || !R) return;
    var f = {}; sh.querySelectorAll('[data-f]').forEach(function (el) { f[el.getAttribute('data-f')] = el.value; });
    f.title = String(f.title || '').trim(); if (!f.title) { toastS('Give it a title'); return; }
    var row = { title: f.title, kind: f.kind || 'read', minutes: f.minutes ? Math.max(1, Math.round(Number(f.minutes))) : null, resource_url: String(f.resource_url || '').trim() || null, category: String(f.category || 'General').trim() || 'General', path_group: f.path_group || null, description: String(f.description || '').trim() || null, updated_at: nowIso() };
    if (row.kind === 'video' && row.resource_url) { var lid = (row.resource_url.match(/loom\.com\/(?:share|embed)\/([0-9a-f]{32})/i) || [])[1]; if (lid) { row.source = 'loom'; row.ext_id = lid; } }
    if (!row.source) row.source = 'hub';
    try {
      var res;
      if (R.t) { res = await db.from('trainings').update(row).eq('id', R.t.id).select(); if (res.error) throw res.error; Object.keys(row).forEach(function (k) { R.t[k] = row[k]; }); toastS('Saved'); var keep = R.t; applyTrainings(A.trainings); openTraining(keep.id); }
      else {
        row.active = true; row.sort = 900;
        res = await db.from('trainings').insert(row).select(); if (res.error) throw res.error;
        var nt = (res.data && res.data[0]) || row; if (!nt.id) nt.id = 'tmp' + Date.now();
        A.trainings.push(nt); applyTrainings(A.trainings); toastS('Added to the library'); if (location.hash === '#training/t/' + nt.id) openTraining(nt.id); else location.hash = '#training/t/' + nt.id;
      }
      paintSoon();
    } catch (e) { toastS('Could not save: ' + String((e && e.message) || e).slice(0, 80)); }
  }
  async function retire() {
    if (!R || !R.t) return;
    try { var res = await db.from('trainings').update({ active: false, updated_at: nowIso() }).eq('id', R.t.id); if (res.error) throw res.error; A.trainings = A.trainings.filter(function (x) { return x.id !== R.t.id; }); applyTrainings(A.trainings); toastS('Retired. It no longer shows in the academy.'); closeSheet(); }
    catch (e) { toastS('Could not retire it'); }
  }

  /* ---------- completion and celebration ---------- */
  async function complete(t, extra) {
    var r = mine(t.id);
    if (r && r.status === 'done' && !(extra && extra.score != null && (r.score == null || extra.score > r.score))) return;
    var patch = Object.assign({ status: 'done', done_at: (r && r.status === 'done' && r.done_at) || nowIso(), pct: 100 }, extra || {});
    if (R && R.t === t && R.secs) { patch.seconds = (Number(r && r.seconds) || 0) + R.secs; R.secs = 0; R.saved = true; }
    await saveProg(t, patch);
    var res = await evaluate({ celebrate: true });
    celebrate(t, res);
    if (R && R.t === t && R.mode === 'view') renderSheet();
    paintSoon();
  }
  function celebrate(t, res) {
    res = res || {};
    var s = res.s || stats(), lv = s.level, fresh = (res.fresh || []).filter(function (a) { return a.kind !== 'level'; });
    var certs = fresh.filter(function (a) { return a.kind === 'cert'; });
    var old = document.getElementById('w122cel'); if (old) old.remove();
    var el = document.createElement('div'); el.id = 'w122cel';
    var gained = res.xpGained || (t ? xpFor(t) : 0);
    var fromPct = Math.max(0, lv.pct - (lv.next ? Math.round(100 * gained / (lv.next - lv.floor)) : 0));
    el.innerHTML = '<div class="bk" data-w122celx="1"></div><canvas></canvas><div class="cc" role="dialog" aria-modal="true">' +
      '<div class="ck">' + ring(100, 92, 7, GOLD, 'rgba(16,63,57,.08)') + '<div class="in">' + ic(certs.length ? 'seal' : 'check') + '</div></div>' +
      '<h3>' + (certs.length ? 'Certificate earned!' : (t ? (kindOf(t) === 'tour' ? 'Tour complete' : 'Training complete') : 'Nice work')) + '</h3>' +
      '<p>' + (t ? E(String(t.title).replace(/^Page tour:\s*/, '')) : '') + '</p>' +
      (gained ? '<div class="xp">' + ic('bolt') + ' +' + gained + ' XP</div>' : '') +
      (res.levelUp ? '<div class="lvup">You reached<b>Level ' + res.levelUp.n + ': ' + E(res.levelUp.name) + '</b></div>' : '<div class="lv"><div class="t">Level ' + lv.n + ' &middot; ' + E(lv.name) + '<span>' + (lv.next ? lv.toNext + ' XP to ' + E(lv.nextName) : 'Top level') + '</span></div><div class="bar"><i style="width:' + fromPct + '%" data-to="' + lv.pct + '"></i></div></div>') +
      (fresh.length ? '<div class="aws">' + fresh.map(function (a, i) { var v = awardVisual(a); return '<div class="aw' + (a.kind === 'cert' ? ' cert' : '') + '" style="animation-delay:' + (0.25 + i * 0.12) + 's"><span class="md" style="background:linear-gradient(135deg,' + v.color + ',' + shade(v.color) + ')">' + ic(v.icon) + '</span><div><b>' + E(a.title) + '</b><span>' + (a.kind === 'cert' ? 'Certificate' : 'Badge') + ' unlocked</span></div></div>'; }).join('') + '</div>' : '') +
      (certs.length ? '<label class="share"><input type="checkbox" data-w122shareck="1" checked> Share it with the team in the shout-outs</label>' : '') +
      '<div class="btns">' + (certs.length ? '<button class="w122btn gold" data-w122celcert="' + E(certs[0].award) + '">' + ic('seal') + ' View certificate</button>' : '') + nextAfter(t) + '<button class="w122btn' + (certs.length ? ' soft' : '') + '" data-w122celx="1">' + (T || (t && kindOf(t) === 'tour') ? 'Stay on this page' : 'Continue') + '</button>' + (t && kindOf(t) === 'tour' ? '<button class="w122btn soft" data-w122celhome="1">Back to the academy</button>' : '') + '</div></div>';
    el.__certs = certs.map(function (a) { return a.award; });
    document.body.appendChild(el);
    setTimeout(function () { var bar = el.querySelector('.lv .bar i'); if (bar) bar.style.width = bar.getAttribute('data-to') + '%'; }, 300);
    if (!reduced()) confetti(el.querySelector('canvas'), certs.length ? 180 : 90);
  }
  function nextAfter(t) { if (!t || kindOf(t) === 'tour') return ''; var n = nextInPath(t); return n ? '<button class="w122btn" data-w122celnext="' + E(n.id) + '">Next up ' + ic('arrow') + '</button>' : ''; }
  function closeCel(opts) {
    var el = document.getElementById('w122cel'); if (!el) return;
    var ck = el.querySelector('[data-w122shareck]');
    if (ck && ck.checked) (el.__certs || []).forEach(function (a) { shareAward(a, true); });
    el.remove();
  }
  function confetti(cv, n) {
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'), W = cv.width = innerWidth, H = cv.height = innerHeight;
    var cols = [GOLD, TEAL, PURPLE, '#F4D27A', '#5CD6B8', '#fff', FLAG];
    var ps = []; for (var i = 0; i < n; i++) ps.push({ x: W / 2 + (Math.random() - 0.5) * 120, y: H * 0.42, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 15 - 5, r: Math.random() * 6 + 3, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, life: 0 });
    var t0 = performance.now();
    (function frame(now) {
      if (!cv.isConnected) return;
      ctx.clearRect(0, 0, W, H);
      ps.forEach(function (p) { p.vy += 0.38; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); });
      if (now - t0 < 3200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    })(t0);
  }
