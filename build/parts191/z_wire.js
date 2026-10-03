  /* ---------- the page's title names the view (inside the Volunteer Manager) ---------- */
  var TITLES = { calendar: ['Servings', 'This week, the calendar and every serving'], sop: ['The SOP', 'The master checklist every serving starts from, in six stages'], people: ['Volunteers', 'Everyone who volunteers in Montreal, one record with the CRM'], inventory: ['Inventory', 'The kit in storage, counted and reordered'], recipes: ['Recipes', 'What the cooks make'], event: ['Serving', ''] };
  function title() {
    try {
      if (!document.body.classList.contains('w153volunteer')) return;
      var sec = document.getElementById('volunteering'); if (!sec) return;
      var mast = sec.querySelector('.w118mast'); if (!mast) return;
      var h1 = mast.querySelector('h1'), p = mast.querySelector(':scope > p');
      var v = typeof WA_VOL_VIEW !== 'undefined' ? WA_VOL_VIEW : 'calendar'; var t = TITLES[v] || TITLES.calendar;
      var ev = v === 'event' ? curEv() : null;
      var h = ev ? 'Serving' : t[0]; var sub = ev ? [fmtDay(ev.event_date, true), ev.code, ev.title].filter(Boolean).join(' \u00b7 ') : t[1];
      if (h1 && h1.textContent !== h) h1.textContent = h;
      if (p && p.textContent !== sub) p.textContent = sub;
    } catch (e) { /* fine */ }
  }
  var __sched191 = schedule;
  schedule = function () { __sched191(); setTimeout(title, 100); setTimeout(title, 700); };
  if (typeof waVolRender === 'function') { var __vr191 = waVolRender; waVolRender = async function () { var out = await __vr191.apply(this, arguments); setTimeout(title, 120); setTimeout(title, 900); setTimeout(focusStep, 1200); setTimeout(invBanner, 400); setTimeout(invBanner, 1500); return out; }; }
  window.addEventListener('hashchange', function () { setTimeout(title, 300); });
  setTimeout(title, 1500);

  /* the page tour: the cards of the earlier waves now sit in stages, so their steps open the stage first; the masthead pill is gone */
  function fixTour() {
    try {
      var TT = window.w122 && window.w122.tours; var vs = TT && TT.volunteering && TT.volunteering.steps; if (!vs || vs.__w191) return;
      var by = {}; vs.forEach(function (x) { by[x.s] = x; });
      var stage = function (k) { return function () { openStage(k, false); }; };
      var ord = ['#volunteering > .w118mast', '#w191week', '#w106add', '#w119cal', '#w145home', '#volunteering .vl-grid', '#w191head', '#w191next', '#w191team', '#w191stages'];
      var out = ord.map(function (k) { return by[k]; }).filter(Boolean);
      out.push({ s: '#w171card', t: 'Confirm: the texts', p: 'Volunteers get a text from the ops line 7 days before the serving with their own link to confirm. When they tap Confirm (or reply YES), their card turns confirmed within half a minute. Replies that need a person show here.', opt: 1, go: stage('confirm') });
      out.push({ s: '#w174card', t: 'Prepare: the itinerary', p: 'When the serving starts and when each role arrives, a preview of each role\u2019s itinerary, and sending the itineraries by text or email.', opt: 1, go: stage('prepare') });
      out.push({ s: '#w174survey', t: 'Wrap up: the survey', p: 'What volunteers said after the serving: overall, the needs people told us about, what slowed things down, the meal, and every answer in full.', opt: 1, go: stage('wrap_up') });
      if (by['#w145fb']) { var fb = Object.assign({}, by['#w145fb'], { opt: 1, go: stage('wrap_up') }); out.push(fb); }
      out.push({ s: '#w191stages [data-w191go="find"]', t: 'Recruit: Find volunteers', p: 'Looks through the CRM for who signed up and never came, regulars we miss, who came once and who loved it. Tick people, read the texts each one gets, and invite them: they go on the roster as Waiting For Response and get a personal text from the ops line between 9 am and 7 pm. A YES by text or a tap on their link confirms them. Replies show in Conversations.', opt: 1, go: stage('recruit') });
      if (by['#w191extra']) out.push(by['#w191extra']);
      /* any step another wave adds later keeps its place at the end */
      vs.forEach(function (x) { if (out.indexOf(x) < 0 && ['#w171card', '#w174card', '#w119 .mast .w171pill', '#w145fb'].indexOf(x.s) < 0) out.push(x); });
      vs.length = 0; out.forEach(function (x) { vs.push(x); }); vs.__w191 = true;
    } catch (e) { /* fine */ }
  }
  setTimeout(fixTour, 1800); setTimeout(fixTour, 5000);

  window.w191 = { S: S, STAGES: STAGES, model: model, layout: layout, refresh: refresh, stageOf: stageOf, paintWeek: paintWeek, decorateSop: decorateSop, title: title, adoptRail: adoptRail, openRecruit: openRecruit, R: R, counts: rosterCounts };
})();
