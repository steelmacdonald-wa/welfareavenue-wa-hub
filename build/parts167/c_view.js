
  /* ---------- the journey's parts ---------- */
  function avHtml(m, cls) {
    var url = m && m.avatar_url ? String(m.avatar_url) : '';
    return '<span class="' + (cls || 'av') + '"' + (url ? ' style="background-image:url(\'' + E(url) + '\')"' : '') + '>' + (url ? '' : E(initials(m && m.name))) + '</span>';
  }
  function short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
  function heroHtml(J) {
    var C = cfg(), h = C.hero || {}, o = J.o, pp = peopleFor(o);
    var nm = first(o.person_name) || 'friend';
    var who = pp && pp.title ? E(pp.title) + (pp.dept ? ', ' + E(teamName(pp.dept)) : '') + '. ' : (pp && pp.dept ? E(teamName(pp.dept)) + '. ' : '');
    var line = J.complete ? who + 'Every step of your plan is done. Welcome to the team, for good.'
      : who + 'Day ' + J.day + ' of your onboarding. Here is your road for the first 90 days, one stop at a time.';
    var go = '';
    if (J.next) {
      var t = J.next.t, lessonStep = /^wa167w/.test(String(t.id)) && t.training_id;
      go = lessonStep ? '<button type="button" class="w167btn" data-w166open="t:' + E(t.training_id) + '">Start here: ' + E(short(String(t.name).replace(/^Start here:\s*/i, ''), 40)) + '</button>'
        : '<button type="button" class="w167btn" data-w167go="next">Continue: ' + E(short(t.name, 40)) + '</button>';
    } else go = '<button type="button" class="w167btn" data-w166open="a:">Explore the Avenue Academy</button>';
    var lead = pp && pp.lead ? '<button type="button" class="w167btn ghost" data-w167person="' + E(pp.lead.id) + '">Your lead: ' + E(first(pp.lead.name)) + '</button>' : '';
    return '<section class="w167hero" style="background-image:url(\'' + E(photoUrl(h.photo)) + '\');background-position:' + bgPos(h) + '">'
      + '<img class="lg" src="' + BR.logo + '" alt="Welfare Avenue, building pathways in our community">'
      + '<img class="dd1" src="' + BR.star + '" alt="">'
      + '<div class="tx"><div class="ey">Your onboarding' + (J.complete ? ' &middot; complete' : ' &middot; day ' + J.day) + '</div>'
      + '<h1>Welcome, <span>' + E(nm) + '</span></h1>'
      + '<p>' + line + '</p>'
      + (h.tag ? '<div class="tag">' + E(h.tag) + '</div>' : '')
      + '<div class="cta">' + go + lead + '</div></div>'
      + '<div class="rg" title="' + J.done + ' of ' + J.total + ' steps done">' + ring(J.pct, 132, 12) + '<div class="in"><b>' + J.pct + '%</b><span>' + J.done + ' of ' + J.total + ' steps</span></div></div>'
      + '</section>';
  }
  function curWeek(J) { return J.nextWk || (J.weeks.length ? J.weeks[J.weeks.length - 1].name : null); }
  function roadHtml(J) {
    var cur = curWeek(J), n = J.weeks.length, ci = 0;
    J.weeks.forEach(function (w, i) { if (w.name === cur) ci = i; });
    var lane = n > 1 ? Math.round(100 * ci / (n - 1)) : 0;
    return '<nav class="w167road" aria-label="Your onboarding, week by week"><div class="lane"><i style="width:' + lane + '%"></i></div><div class="stops">'
      + J.weeks.map(function (w) {
        var m = w.meta || {}, pct = w.total ? Math.round(100 * w.done / w.total) : 0, lbl = lab(w.name);
        return '<button type="button" class="w167stop' + (w.complete ? ' done' : '') + (w.name === S.wk ? ' on' : '') + (w.name === cur && !J.complete ? ' cur' : '') + '" data-w167wk="' + E(w.name) + '" aria-pressed="' + (w.name === S.wk ? 'true' : 'false') + '" aria-label="' + E(lbl + ': ' + (m.title || '') + ', ' + w.done + ' of ' + w.total + ' done') + '">'
          + (w.name === cur && !J.complete ? '<img class="e" src="' + BR.e + '" alt="">' : '')
          + '<span class="pic" style="' + (m.photo ? 'background-image:url(\'' + E(photoUrl(m.photo)) + '\');background-position:' + bgPos(m) : '') + '"></span>'
          + '<span class="lb">' + E(lbl) + '</span><b>' + E(m.title || lbl) + '</b><span class="n">' + w.done + ' of ' + w.total + '</span>' + BAR(pct) + '</button>';
      }).join('') + '</div><p class="hint">Choose a stop to see that week. You are here: the E that moves.</p></nav>';
  }
  function featHtml(w) {
    var x = w.lesson; if (!x || !x.t.training_id) return '';
    var ls = x.ls || {}, done = !!x.done, title = String(x.t.name).replace(/^Start here:\s*/i, ''), num = String(lab(w.name)).replace(/\D/g, '') || '&#9733;';
    return '<div class="w167feat' + (done ? ' ok' : '') + '"><div class="ic">' + (done ? '&#10003;' : num) + '</div><div class="tx"><span>' + (done ? 'Done: you passed its knowledge check' : 'Start here') + '</span><b>' + E(title) + '</b>'
      + '<em>' + (ls.mins ? ls.mins + '-minute lesson with photos' : 'A short lesson with photos') + ' &middot; a knowledge check at the end &middot; it ticks itself</em></div>'
      + '<button type="button" class="w167btn' + (done ? ' ghost' : '') + '" data-w166open="t:' + E(x.t.training_id) + '">' + (done ? 'Open it again' : 'Start the lesson') + '</button></div>';
  }
  function weekHeadHtml(J, w) {
    if (!w) return '';
    var m = w.meta || {}, lbl = lab(w.name), pct = w.total ? Math.round(100 * w.done / w.total) : 0;
    var k = lbl + (w.complete ? ' &middot; done' : (w.due ? ' &middot; due ' + E(fmtDay(w.due)) : ''));
    var li = function (s) { return '<li>' + E(s) + '</li>'; };
    return '<header class="w167ban" style="' + (m.photo ? 'background-image:url(\'' + E(photoUrl(m.photo)) + '\');background-position:' + bgPos(m) : '') + '"><img class="dd" src="' + BR.ast + '" alt="">'
      + '<div><div class="k">' + k + '</div><h2>' + E(m.title || lbl) + '</h2><p>' + w.done + ' of ' + w.total + ' steps done</p><div class="pb">' + BAR(pct) + '</div></div></header>'
      + ((m.learn && m.learn.length) || m.why ? '<div class="w167learn">' + (m.learn && m.learn.length ? '<div class="ob"><h3>By the end of this week you will</h3><ul>' + m.learn.map(li).join('') + '</ul></div>' : '')
        + (m.why ? '<div class="wy"><img src="' + BR.heart + '" alt=""><h3>Why it matters</h3><p>' + E(m.why) + '</p></div>' : '') + '</div>' : '')
      + featHtml(w)
      /* wave191p: Week 3, choose your servings (four a year; filled by wave191's onboarding module) */
      + (w.name === 'WEEK 3' ? '<div class="w191onbw"><h3><img src="' + BR.star + '" alt="">Choose your servings</h3><p>Every member volunteers four times a year. Pick your first ones: they are confirmed right away, and the operations lead hears from you.</p><div class="w191onb" data-w191onbat="journey"></div></div>' : '');
  }
  function pplHtml(J) {
    var pp = peopleFor(J.o);
    var h = '<h3><img src="' + BR.flowers + '" alt="">Your people</h3>';
    if (!pp) return h + '<div class="w167ppl"><div class="w167pc" style="cursor:default"><span class="av">&hellip;</span><div class="t"><b>Finding your people</b></div></div></div>';
    var cards = [];
    if (pp.lead) cards.push('<button type="button" class="w167pc" data-w167person="' + E(pp.lead.id) + '">' + avHtml(pp.lead) + '<div class="t"><em>Your lead</em><b>' + E(pp.lead.name) + '</b><span>' + E(pp.leadTitle || teamName(pp.lead.department)) + '. Checks in with you at two weeks and around day 30.</span></div></button>');
    pp.eds.forEach(function (x) { cards.push('<button type="button" class="w167pc" data-w167person="' + E(x.m.id) + '">' + avHtml(x.m) + '<div class="t"><em>Co-executive director</em><b>' + E(x.m.name) + '</b><span>Book 15 minutes with one of them in your first 60 days.</span></div></button>'); });
    var team = pp.team.slice(0, 12);
    return h + (cards.length ? '<div class="w167ppl">' + cards.join('') + '</div>' : '')
      + (team.length ? '<div class="w167team" aria-label="Your team">' + team.map(function (m) { return '<button type="button" data-w167person="' + E(m.id) + '" title="' + E(m.name + (m.role ? ', ' + m.role : '')) + '">' + avHtml(m) + '<span>' + E(first(m.name)) + '</span></button>'; }).join('')
        + (pp.team.length > team.length ? '<span style="align-self:center;font-size:12px;color:' + MUTED + '">and ' + (pp.team.length - team.length) + ' more</span>' : '') + '</div>'
        + '<p style="margin:8px 0 0;font-size:12.5px;color:' + MUTED + '">Your ' + E(teamName(pp.dept)) + ' team. Say hello in your team&rsquo;s channel; the org chart shows everyone else.</p>' : '');
  }
  function numHtml() {
    var C = cfg(); if (!C.numbers || !C.numbers.length) return '';
    return '<h3><img src="' + BR.star + '" alt="">Welfare Avenue in numbers</h3><div class="w167num"><img class="dd1" src="' + BR.blob + '" alt=""><img class="dd2" src="' + BR.arrow + '" alt="">'
      + '<div class="g">' + C.numbers.map(function (x) { return '<div><b>' + E(x.n) + '</b><span>' + E(x.l) + '</span></div>'; }).join('') + '</div>'
      + (C.numbers_note ? '<p class="nt">' + E(C.numbers_note) + '</p>' : '') + '</div>';
  }
  function dykHtml() {
    var rows = S.story || []; if (!rows.length) return '';
    var x = rows[S.storyI % rows.length];
    return '<h3><img src="' + BR.heart + '" alt="">Did you know?</h3><div class="w167dyk"><div class="yr">' + E(String(x.date_start || '').slice(0, 4)) + '</div><div class="tx"><b>' + E(x.title) + '</b><p>' + E(short(x.summary, 320)) + '</p>'
      + '<div class="ac"><button type="button" class="w167btn green" data-w167dyk="1">Another moment</button><button type="button" class="w167lnk" data-w167story="1">All of our story</button></div></div></div>';
  }
