  /* ======================= Document finder (#documents) ======================= */
  var BLURB_D = 'Find a document by what it is about: every useful file in our shared drives and Canva, with a summary, the date it covers and the organizations in it. Private files are never here.';
  var TEAM_LABEL = {}; DTEAMS.forEach(function (t) { TEAM_LABEL[t[0]] = t[1]; });
  var KIND_ONE = { guide: 'Guide', plan: 'Plan', report: 'Report', 'meeting notes': 'Meeting notes', presentation: 'Presentation', proposal: 'Proposal', letter: 'Letter',
    newsletter: 'Newsletter', application: 'Application', list: 'List', posts: 'Post or poster' };
  var DOC_HAY = null;
  function docHay() {
    if (DOC_HAY && DOC_HAY.src === S.docs) return DOC_HAY.map;
    var map = {};
    (S.docs || []).forEach(function (d) {
      map[d.file_id] = {
        t: fold(d.title), o: fold((d.organisations || []).join(' | ')), r: fold((d.resource_title || '') + ' ' + (d.resource_what || '')),
        s: fold(d.summary), p: fold((d.topics || []).join(' | ')), x: fold([d.location, d.kind, d.doc_date, d.year, TEAM_LABEL[d.team]].join(' '))
      };
    });
    DOC_HAY = { src: S.docs, map: map };
    return map;
  }
  function docResults() {
    var u = S.ui, toks = fold(u.dq).split(/[^a-z0-9$&'\-]+/).filter(function (t) { return t.length > 1 || /\d/.test(t); });
    var hay = docHay(), phrase = fold(u.dq).trim();
    var out = [];
    (S.docs || []).forEach(function (d) {
      if (u.dTeam && d.team !== u.dTeam) return;
      if (u.dYear && String(d.year) !== String(u.dYear)) return;
      if (u.dKind && (d.kind || 'other') !== u.dKind) return;
      if (u.dReuse && !d.reusable) return;
      var h = hay[d.file_id], score = 0;
      if (toks.length) {
        for (var i = 0; i < toks.length; i++) {
          var t = toks[i], sc = 0;
          if (h.t.indexOf(t) >= 0) sc += 5;
          if (h.o.indexOf(t) >= 0) sc += 3;
          if (h.r.indexOf(t) >= 0) sc += 3;
          if (h.s.indexOf(t) >= 0) sc += 2;
          if (h.p.indexOf(t) >= 0) sc += 1;
          if (h.x.indexOf(t) >= 0) sc += 1;
          if (!sc) return;
          score += sc;
        }
        if (phrase.length > 3 && h.t.indexOf(phrase) >= 0) score += 8;
      }
      out.push({ d: d, score: score });
    });
    out.sort(function (a, b) { return (b.score - a.score) || ((b.d.year || 0) - (a.d.year || 0)) || String(a.d.title).localeCompare(String(b.d.title)); });
    return out;
  }
  function paintDocs() {
    var root = mastFor('documents', 'Other Tools', 'Document finder', BLURB_D); if (!root) return;   /* wave163: in Other Tools */
    if (!S.docs) { root.innerHTML = busy('Loading the document finder…'); return; }
    if (S.err.docs && !S.docs.length) { root.innerHTML = '<div class="w140empty">The document finder could not load (' + E(S.err.docs) + ').</div>'; return; }
    var u = S.ui, lead = isLeaderUI();
    var years = {}, teams = {}, kinds = {};
    S.docs.forEach(function (d) { if (d.year) years[d.year] = 1; if (d.team) teams[d.team] = 1; kinds[d.kind || 'other'] = 1; });
    var focus = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-w140q') : null;
    var caret = focus && document.activeElement.selectionStart;
    var res = docResults(), shown = res.slice(0, u.dShow);
    var html = '<div class="w140bar"><div class="w140q big">' + I('search') + '<input type="search" data-w140q="docs" placeholder="What are you looking for? For example: flag football sponsorship, volunteer drivers, Moisson" value="' + E(u.dq) + '" aria-label="Search the documents"></div></div>' +
      '<div class="w140bar"><select class="w140sel" data-w140dteam aria-label="Team"><option value="">Every team</option>' + DTEAMS.filter(function (t) { return teams[t[0]]; }).map(function (t) { return '<option value="' + t[0] + '"' + (u.dTeam === t[0] ? ' selected' : '') + '>' + E(t[1]) + '</option>'; }).join('') + '</select>' +
      '<select class="w140sel" data-w140dyear aria-label="Year"><option value="">Every year</option>' + Object.keys(years).sort().reverse().map(function (y) { return '<option value="' + y + '"' + (String(u.dYear) === y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
      '<select class="w140sel" data-w140dkind aria-label="Kind of document"><option value="">Every kind</option>' + DKINDS.filter(function (k) { return kinds[k[0]]; }).map(function (k) { return '<option value="' + E(k[0]) + '"' + (u.dKind === k[0] ? ' selected' : '') + '>' + E(k[1]) + '</option>'; }).join('') + '</select>' +
      chip(u.dReuse, 'data-w140dreuse', '1', 'Guides and templates to reuse', S.docs.filter(function (d) { return d.reusable; }).length) + '</div>' +
      '<div class="w140count">' + (u.dq ? plural(res.length, 'document matches', 'documents match') : plural(res.length, 'document', 'documents')) + (lead ? ' · documents from the board, management, HR and finance drives show to leaders only' : '') + '</div>' +
      (shown.length ? '<div class="w140dl">' + shown.map(function (r) {
        var d = r.d, cv = d.source === 'canva';
        var meta = [d.location, d.doc_date ? String(d.doc_date).slice(0, 7) : (d.year || ''), KIND_ONE[d.kind] || '', TEAM_LABEL[d.team] || ''].filter(Boolean);
        var orgs = (d.organisations || []).slice(0, 6);
        return '<article class="w140doc"><div class="ic' + (cv ? ' cv' : '') + '">' + I(cv ? 'spark' : 'file') + '</div><div>' +
          (d.url ? '<a class="tt" href="' + E(d.url) + '" target="_blank" rel="noopener">' + E(d.title) + ' ' + I('ext') + '</a>' : '<span class="tt">' + E(d.title) + '</span>') +
          (d.visibility === 'leadership' ? '<span class="w140tag lead">' + I('lock') + 'Leaders</span>' : '') +
          '<div class="w140m">' + E(meta.join(' · ')) + '</div>' + (d.summary ? '<p>' + E(d.summary) + '</p>' : '') +
          (d.reusable && d.resource_title ? '<div class="re">' + I('check') + '<span><b>Reuse it:</b> ' + E(d.resource_title) + (d.resource_what ? ': ' + E(d.resource_what) : '') + '</span></div>' : '') +
          (orgs.length ? '<div class="w140m">' + partnerChips(orgs) + '</div>' : '') + '</div></article>';
      }).join('') + (res.length > shown.length ? '<button class="w140btn soft w140more" data-w140dmore="1">Show more (' + (res.length - shown.length) + ' left)</button>' : '') + '</div>'
        : '<div class="w140empty">Nothing matches' + (u.dq ? ' “' + E(u.dq) + '”' : '') + '. Try fewer or different words, or clear the filters. The finder knows what each document is about, the organizations in it and the date it covers, so a partner’s name, an event or a topic works well.</div>');
    root.innerHTML = html;
    if (focus) { var inp = root.querySelector('[data-w140q="' + focus + '"]'); if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) { /* fine */ } } }
  }
  function openDocs(h) {
    var rest = String(h || '').split('/').slice(1);
    if (rest[0] === 'q' && rest[1]) { S.ui.dq = decodeURIComponent(rest.slice(1).join('/')); S.ui.dShow = 40; }
    Promise.all([load('docs'), load('partners')]).then(function () {
      paintDocs();
      var inp = document.querySelector('#documents [data-w140q="docs"]'); if (inp && !rest[0] && window.innerWidth > 700) { try { inp.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    });
    paintDocs();
  }
