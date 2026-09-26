  /* ======================= wiring ======================= */
  function go(h) { if (location.hash === h) { try { applyHash(); } catch (e) { /* fine */ } } else location.hash = h; }
  function inOurs(t) { return t.closest && (t.closest('.w140root') || t.closest('#w140sheet')); }
  var qT = null;
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest || !inOurs(t)) return;
    var el;
    if ((el = t.closest('[data-w140close]'))) { e.preventDefault(); closeSheet(); return; }
    if ((el = t.closest('[data-w140save]'))) { e.preventDefault(); el.disabled = true; saveEdit(el.getAttribute('data-w140save'), el.getAttribute('data-id')).then(function () { el.disabled = false; }); return; }
    if ((el = t.closest('[data-w140go]'))) { e.preventDefault(); closeSheet(); go(el.getAttribute('data-w140go')); return; }
    if ((el = t.closest('[data-w140partner]'))) {
      e.preventDefault();
      var pid = el.getAttribute('data-w140partner');
      if (location.hash.indexOf('#partners') === 0) { try { history.replaceState(null, '', '#partners/' + pid); } catch (x) { /* fine */ } partnerSheet(pid); }
      else { closeSheet(); go('#partners/' + pid); }
      return;
    }
    if ((el = t.closest('[data-w140edit]'))) { e.preventDefault(); editForm(el.getAttribute('data-w140edit'), el.getAttribute('data-id')); return; }
    if ((el = t.closest('[data-w140add]'))) { e.preventDefault(); editForm(el.getAttribute('data-w140add'), null); return; }
    if ((el = t.closest('[data-w140ev]'))) { e.preventDefault(); flashEv(el.getAttribute('data-w140ev')); return; }
    if ((el = t.closest('[data-w140year]'))) { e.preventDefault(); var y = document.getElementById('w140y' + el.getAttribute('data-w140year')); if (y) y.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if ((el = t.closest('[data-w140kind]'))) { S.ui.kind = el.getAttribute('data-w140kind'); paintStory(); return; }
    if ((el = t.closest('[data-w140order]'))) { S.ui.order = S.ui.order === 'asc' ? 'desc' : 'asc'; paintStory(); return; }
    if ((el = t.closest('[data-w140hidden]'))) { S.ui.hidden = !S.ui.hidden; paintStory(); return; }
    if ((el = t.closest('[data-w140area]'))) { S.ui.lArea = el.getAttribute('data-w140area'); paintStory(); return; }
    if ((el = t.closest('[data-w140pset]'))) { S.ui.pSet = el.getAttribute('data-w140pset'); paintPartners(); return; }
    if ((el = t.closest('[data-w140dreuse]'))) { S.ui.dReuse = !S.ui.dReuse; S.ui.dShow = 40; paintDocs(); return; }
    if ((el = t.closest('[data-w140dmore]'))) { S.ui.dShow += 40; paintDocs(); return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.getAttribute || !t.hasAttribute('data-w140q')) return;
    var which = t.getAttribute('data-w140q'), v = t.value;
    clearTimeout(qT);
    qT = setTimeout(function () {
      if (which === 'story') { S.ui.q = v; paintStory(); }
      else if (which === 'lessons') { S.ui.lq = v; paintStory(); }
      else if (which === 'partners') { S.ui.pq = v; paintPartners(); }
      else if (which === 'docs') { S.ui.dq = v; S.ui.dShow = 40; paintDocs(); }
    }, 160);
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('.w140root')) return;
    if (t.hasAttribute('data-w140city')) { S.ui.city = t.value; paintStory(); }
    else if (t.hasAttribute('data-w140prel')) { S.ui.pRel = t.value; paintPartners(); }
    else if (t.hasAttribute('data-w140pkind')) { S.ui.pKind = t.value; paintPartners(); }
    else if (t.hasAttribute('data-w140pcity')) { S.ui.pCity = t.value; paintPartners(); }
    else if (t.hasAttribute('data-w140dteam')) { S.ui.dTeam = t.value; S.ui.dShow = 40; paintDocs(); }
    else if (t.hasAttribute('data-w140dyear')) { S.ui.dYear = t.value; S.ui.dShow = 40; paintDocs(); }
    else if (t.hasAttribute('data-w140dkind')) { S.ui.dKind = t.value; S.ui.dShow = 40; paintDocs(); }
  });
  window.addEventListener('hashchange', function () {
    var root = String(location.hash || '').replace(/^#/, '').split('/')[0];
    if (S.sheet && !(root === 'partners' && /^#partners\/\d+/.test(location.hash))) closeSheet();
  });
  /* a link to a Hub page inside an Avenue Academy lesson (#ourstory, #partners, #documents) opens here, not in a new tab;
     the lesson closes itself when the page changes (wave122's route) */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('#w122sheet a[href^="#"]') : null;
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    var h = a.getAttribute('href') || ''; if (h.length < 2) return;
    e.preventDefault(); e.stopPropagation();
    location.hash = h;
  }, true);

  /* ---------- the menu: Resources > Our story, Partners, Document finder ---------- */
  var PAGES = [
    { id: 'ourstory', label: 'Our story', group: 'resources', dot: GOLD, gate: 'member', onShow: function (h) { openStory(h); } },
    { id: 'partners', label: 'Partners', group: 'resources', dot: PURPLE, gate: 'member', onShow: function (h) { openPartners(h); } },
    { id: 'documents', label: 'Document finder', group: 'resources', dot: TEAL, gate: 'member', onShow: function (h) { openDocs(h); } }
  ];
  function register() {
    if (!window.WA_NAV || typeof WA_NAV.register !== 'function') return;
    PAGES.forEach(function (d) { if (!WA_NAV.pages.some(function (p) { return p.id === d.id; })) WA_NAV.register(d); });
  }
  if (typeof startApp === 'function') {
    var __sa140 = startApp;
    startApp = async function () {
      var out = await __sa140.apply(this, arguments);
      try {
        register();
        var root = decodeURIComponent(location.hash || '').replace(/^#/, '').split('/')[0];
        if (root === 'ourstory' || root === 'partners' || root === 'documents') { try { applyHash(); } catch (e) { /* fine */ } }
      } catch (e) { console.warn('wave140 boot', e); }
      return out;
    };
  }

  /* ---------- the page tours (wave122's engine; trainings rows tour:ourstory, tour:partners, tour:documents) ---------- */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours) return;
      var OPT = { opt: 1 };
      var T = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      if (!W.tours.ourstory) W.tours.ourstory = { tab: 'ourstory', icon: 'book', hash: '#ourstory', steps: [
        T('#ourstory > .w118mast', 'Our story', 'What Welfare Avenue has done since March 2020, read from our own documents, posts and designs.'),
        T('#ourstory .w140stats', 'At a glance', 'The years, the moments, the organizations we have worked with and the lessons. The numbers open their page.', OPT),
        T('#ourstory .w140hl', 'Milestones', 'The moments that shaped us. Click one to find it in the timeline.', OPT),
        T('#ourstory .w140bar', 'Find a moment', 'Show one kind of moment or one city, search for a word, or read newest first.', OPT),
        T('#ourstory .w140year', 'Year by year', 'Each year opens with what it was for us. Every moment says when, where, with whom and how many.', OPT),
        T('#ourstory .w140src', 'Where it came from', 'Every moment keeps its sources: the document or post, and the words it came from.', OPT),
        T('#ourstory .w140tabs', 'Lessons learned', 'What we learned from our own events and programs, as advice for next time.', OPT)
      ] };
      if (!W.tours.partners) W.tours.partners = { tab: 'partners', icon: 'handshake', hash: '#partners', steps: [
        T('#partners > .w118mast', 'Partners', 'Every organization we have worked with, and the ones we approached.'),
        T('#partners .w140stats', 'Where each one stands', 'Working with us now, before, approached with nothing yet, or said no.', OPT),
        T('#partners .w140bar', 'Narrow it down', 'By how they helped, the kind of organization or the city, or search for a name.', OPT),
        T('#partners .w140pg', 'Every organization', 'What they did with us, how they helped and the years. Open one for the moments and documents it appears in.', OPT)
      ] };
      if (!W.tours.documents) W.tours.documents = { tab: 'documents', icon: 'search', hash: '#documents', steps: [
        T('#documents > .w118mast', 'Document finder', 'Every useful file in our shared drives and Canva, found by what it is about.'),
        T('#documents .w140q.big', 'Search by meaning', 'Type what you need: an event, a partner, a topic. The finder knows each document’s summary, the date it covers and the organizations in it.', OPT),
        T('#documents .w140bar + .w140bar', 'Narrow it down', 'By team, year and kind, or only the guides and templates worth reusing.', OPT),
        T('#documents .w140doc', 'A result', 'The summary, where it sits and the date it covers. The title opens it in Drive or Canva.', OPT)
      ] };
    } catch (e) { /* fine */ }
  }
  addTours();

  /* ---------- test hook ---------- */
  window.w140 = { state: function () { return S; }, load: load, story: paintStory, partners: paintPartners, docs: paintDocs, openStory: openStory, openPartners: openPartners, openDocs: openDocs,
    edit: editForm, save: saveEdit, close: closeSheet, results: docResults, partnerFor: partnerFor, fmtRange: fmtRange, readDate: readDate };
})();
