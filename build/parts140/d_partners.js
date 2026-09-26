  /* ======================= Partners (#partners) ======================= */
  var BLURB_P = 'Every organization Welfare Avenue has worked with, from its first backers in 2020 to today, and the ones we approached: what they did, when, and where it is written down.';
  var PSETS = [['worked', 'Worked with us'], ['active', 'Active'], ['past', 'Past'], ['prospect', 'Prospects'], ['declined', 'Declined'], ['all', 'All']];
  function inSet(p, set) {
    if (set === 'all') return true;
    if (set === 'worked') return p.status === 'active' || p.status === 'past';
    return p.status === set;
  }
  function yearsText(p) {
    if (p.first_year && p.last_year && p.first_year !== p.last_year) return p.first_year + ' to ' + p.last_year;
    return String(p.first_year || p.last_year || '');
  }
  function statusChip(st) { var s = STATUS[st] || [st, MUTED]; return '<span class="w140st2" style="background:' + s[1] + '1c;color:' + s[1] + '"><i style="background:' + s[1] + '"></i>' + E(s[0]) + '</span>'; }
  function partnerMatch(p) {
    var u = S.ui;
    if (!inSet(p, u.pSet)) return false;
    if (u.pRel && p.relationship !== u.pRel) return false;
    if (u.pKind && p.kind !== u.pKind) return false;
    if (u.pCity && fold(p.city) !== fold(u.pCity)) return false;
    if (u.pq) { var hay = fold([p.name, (p.aka || []).join(' '), p.summary, p.kind, p.city, p.relationship, p.contact_role].join(' ')); if (!fold(u.pq).split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) >= 0; })) return false; }
    return true;
  }
  function paintPartners() {
    var root = mastFor('partners', 'Resources', 'Partners', BLURB_P); if (!root) return;
    if (!S.partners) { root.innerHTML = busy('Loading our partners…'); return; }
    if (S.err.partners && !S.partners.length) { root.innerHTML = '<div class="w140empty">Partners could not load (' + E(S.err.partners) + ').</div>'; return; }
    var u = S.ui, all = S.partners, lead = isLeaderUI();
    var cnt = {}; PSETS.forEach(function (s) { cnt[s[0]] = all.filter(function (p) { return inSet(p, s[0]); }).length; });
    var rels = {}, kinds = {}, cities = {};
    all.forEach(function (p) { if (p.relationship) rels[p.relationship] = 1; if (p.kind) kinds[p.kind] = 1; if (p.city) cities[p.city] = (cities[p.city] || 0) + 1; });
    var focus = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-w140q') : null;
    var caret = focus && document.activeElement.selectionStart;
    var list = all.filter(partnerMatch).sort(function (a, b) {
      var o = { active: 0, past: 1, prospect: 2, declined: 3 };
      return (o[a.status] - o[b.status]) || ((b.last_year || 0) - (a.last_year || 0)) || String(a.name).localeCompare(String(b.name));
    });
    var html = '<div class="w140stats">' + ['active', 'past', 'prospect', 'declined'].map(function (s) {
      return '<button class="w140st" data-w140pset="' + s + '"><b style="color:' + STATUS[s][1] + '">' + cnt[s] + '</b><span>' + E({ active: 'working with us now', past: 'worked with us before', prospect: 'approached, nothing yet', declined: 'said no' }[s]) + '</span></button>';
    }).join('') + '</div>' +
      '<div class="w140bar"><div class="w140chips">' + PSETS.map(function (s) { return chip(u.pSet === s[0], 'data-w140pset', s[0], s[1], cnt[s[0]]); }).join('') + '</div></div>' +
      '<div class="w140bar"><select class="w140sel" data-w140prel aria-label="How they helped"><option value="">Every kind of help</option>' + Object.keys(REL).filter(function (r) { return rels[r]; }).map(function (r) { return '<option value="' + E(r) + '"' + (u.pRel === r ? ' selected' : '') + '>' + E(REL[r]) + '</option>'; }).join('') + '</select>' +
      '<select class="w140sel" data-w140pkind aria-label="Kind of organization"><option value="">Every kind of organization</option>' + PKINDS.filter(function (k) { return kinds[k]; }).map(function (k) { return '<option value="' + E(k) + '"' + (u.pKind === k ? ' selected' : '') + '>' + E(k.charAt(0).toUpperCase() + k.slice(1)) + '</option>'; }).join('') + '</select>' +
      '<select class="w140sel" data-w140pcity aria-label="City"><option value="">Every city</option>' + Object.keys(cities).sort().map(function (c) { return '<option value="' + E(c) + '"' + (lower(u.pCity) === lower(c) ? ' selected' : '') + '>' + E(c) + '</option>'; }).join('') + '</select>' +
      '<div class="w140q">' + I('search') + '<input type="search" data-w140q="partners" placeholder="Search partners" value="' + E(u.pq) + '" aria-label="Search partners"></div>' +
      (lead ? '<button class="w140btn" data-w140add="partner">' + I('plus') + ' Add a partner</button>' : '') + '</div>' +
      '<div class="w140count">' + plural(list.length, 'organization', 'organizations') + '</div>' +
      (list.length ? '<div class="w140pg">' + list.map(function (p) {
        return '<button class="w140pc" data-w140partner="' + E(p.id) + '"><div class="nm">' + E(p.name) + '</div><div class="sub">' + E([p.kind, p.city].filter(Boolean).join(' · ')) + '</div>' +
          (p.summary ? '<div class="sm">' + E(p.summary) + '</div>' : '') + '<div class="ft">' + statusChip(p.status) + '<span class="w140tag">' + E(REL[p.relationship] || p.relationship) + '</span>' +
          (yearsText(p) ? '<span class="w140count">' + E(yearsText(p)) + '</span>' : '') + (p.visibility === 'leadership' ? '<span class="w140tag lead">' + I('lock') + 'Leaders</span>' : '') + '</div></button>';
      }).join('') + '</div>' : '<div class="w140empty">No organization matches. Try another word or show all of them.</div>');
    root.innerHTML = html;
    if (focus) { var inp = root.querySelector('[data-w140q="' + focus + '"]'); if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) { /* fine */ } } }
  }
  /* where a partner appears: the moments that name them, and the documents that mention them */
  function partnerMoments(p) {
    var ns = namesOf(p);
    return visibleHist().filter(function (h) {
      if ((h.partners || []).some(function (n) { return ns.indexOf(fold(n)) >= 0; })) return true;
      var hay = fold(h.title + ' ' + (h.summary || ''));
      return ns.some(function (n) { return n.length > 4 && hay.indexOf(n) >= 0; });
    });
  }
  function partnerDocs(p) {
    var ns = namesOf(p);
    return (S.docs || []).filter(function (d) { return (d.organisations || []).some(function (n) { return ns.indexOf(fold(n)) >= 0; }); }).slice(0, 12);
  }
  function partnerSheet(id) {
    var p = (S.partners || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p) { toastS('That partner is not in the list'); return; }
    var lead = isLeaderUI();
    var ms = partnerMoments(p), ds = partnerDocs(p);
    var rows = [['Kind', [p.kind, p.city].filter(Boolean).join(' · ')], ['How', REL[p.relationship] || p.relationship], ['Years', yearsText(p)], ['Contact', p.contact_role || '']]
      .filter(function (r) { return r[1]; }).map(function (r) { return '<div class="row"><b>' + E(r[0]) + '</b><span>' + E(r[1]) + '</span></div>'; }).join('');
    var html = '<h2>' + E(p.name) + '</h2><div class="sub">' + statusChip(p.status) + (p.aka && p.aka.length ? ' Also written ' + E(p.aka.join(', ')) : '') + '</div>' +
      (p.summary ? '<p style="font-size:14px;line-height:1.55;margin:8px 0 4px">' + E(p.summary) + '</p>' : '') + rows +
      (p.notes ? '<h4>Good to know</h4><p style="font-size:13px;margin:0">' + E(p.notes) + '</p>' : '') +
      '<h4>In our story</h4>' + (ms.length ? ms.slice(0, 14).map(function (h) { return '<div class="row"><b>' + E(yearOf(h)) + '</b><button class="w140mini" style="padding:0;text-align:left" data-w140go="#ourstory/e/' + E(h.id) + '">' + E(h.title) + '</button></div>'; }).join('') : '<p class="w140count">No moment in the timeline names them yet.</p>') +
      (S.docs ? '<h4>In our documents</h4>' + (ds.length ? ds.map(function (d) { return '<div class="row"><b>' + E(d.year || '') + '</b>' + (d.url ? '<a href="' + E(d.url) + '" target="_blank" rel="noopener">' + E(d.title) + '</a>' : '<span>' + E(d.title) + '</span>') + '</div>'; }).join('') : '<p class="w140count">No document in the finder mentions them.</p>') : '') +
      '<h4>Where this comes from</h4>' + (srcHtml(p.sources, 'Show the sources') || '<p class="w140count">Added by hand.</p>') +
      '<div class="acts">' + (lead ? '<button class="w140btn soft" data-w140edit="partner" data-id="' + E(p.id) + '">' + I('edit') + ' Edit</button>' : '') + '<button class="w140btn" data-w140close="1">Done</button></div>';
    openSheet(html, 'partner:' + p.id);
    if (!S.docs && staffOk() && !boardMode()) load('docs').then(function () { if (S.sheet === 'partner:' + p.id) partnerSheet(id); });
  }
  function openPartners(h) {
    var rest = String(h || '').split('/').slice(1);
    Promise.all([load('partners'), load('hist')]).then(function () {
      paintPartners();
      if (rest[0]) partnerSheet(rest[0]);
    });
    paintPartners();
  }
