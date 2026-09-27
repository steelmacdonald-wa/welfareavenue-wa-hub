
  /* ---------- Search everything finds contacts (staff with the CRM), first inside the CRM ---------- */
  var SEARCH_PH = 'Search everything: tasks, people, goals, meetings...';
  var CRM_PH = 'Search contacts: a name, email, phone, organization or tag';
  var loading = false;
  function crmContacts() { try { var st = window.w152 && window.w152.state && window.w152.state(); return st && st.contacts ? st.contacts : null; } catch (e) { return null; } }
  function loadContacts() {
    if (loading || crmContacts()) return Promise.resolve(crmContacts());
    if (!window.w152 || !window.w152.load) return Promise.resolve(null);
    loading = true;
    return Promise.resolve(window.w152.load('contacts')).then(function () { loading = false; return crmContacts(); }, function () { loading = false; return null; });
  }
  function contactHits(q) {
    var list = crmContacts(); if (!list) return [];
    var fq = fold(q), words = fq.split(/\s+/).filter(Boolean), digits = q.replace(/\D/g, '');
    if (!words.length && !digits) return [];
    var out = [];
    for (var i = 0; i < list.length && out.length < 6; i++) {
      var c = list[i], hay = c._hay || fold([c.full_name, (c.emails || []).join(' '), (c.phones || []).join(' ')].join(' '));
      var ok = words.every(function (w) { return hay.indexOf(w) >= 0; }) || (digits.length >= 4 && (c._digits || '').indexOf(digits) >= 0);
      if (ok) out.push(c);
    }
    return out;
  }
  function kindWord(c) { var k = (c.kinds || [])[0] || ''; return { volunteer: 'Volunteer', donor: 'Donor', partner: 'Partner contact', supporter: 'Supporter', staff: 'Staff', alumni: 'Alumni', board: 'Board' }[k] || 'Contact'; }
  function rowFor(c) {
    var div = document.createElement('div'); div.className = 'sr'; div.setAttribute('data-w153c', c.id);
    div.innerHTML = '<span class="sr-type w153c">' + E(kindWord(c)) + '</span>' + E(c.full_name || '(no name)') + (c.emails && c.emails[0] ? ' <span style="color:var(--wa-muted)">' + E(c.emails[0]) + '</span>' : '');
    div.addEventListener('click', function () {
      var pop = document.getElementById('searchResults'); if (pop) pop.style.display = 'none';
      var gs = document.getElementById('globalSearch'); if (gs) gs.value = '';
      location.hash = '#crm/c/' + c.id;
    });
    return div;
  }
  function addHits(q) {
    var pop = document.getElementById('searchResults'); if (!pop || pop.style.display === 'none') return;
    if (pop.querySelector('[data-w153c]')) return;
    var hits = contactHits(q); if (!hits.length) return;
    var empty = !pop.querySelector('.sr[data-hash]') && !pop.querySelector('[data-w107]') ? pop.querySelector('.sr') : null;
    if (empty && (empty.textContent || '').indexOf('No matches') >= 0) empty.remove();
    var first = S.app === 'crm';
    hits.forEach(function (c) { var row = rowFor(c); if (first) pop.insertBefore(row, pop.firstChild); else pop.appendChild(row); });
    if (first) { /* keep the contacts in the order found (each insert went to the top) */
      var rows = Array.prototype.slice.call(pop.querySelectorAll('[data-w153c]')).reverse();
      rows.forEach(function (r) { pop.insertBefore(r, pop.firstChild); });
    }
  }
  var tS = null;
  if (typeof renderSearch === 'function') {
    var __rs153 = renderSearch;
    renderSearch = function (q) {
      __rs153.apply(this, arguments);
      if (!allowed('crm') || boardMode()) return;
      clearTimeout(tS);
      if (crmContacts()) addHits(q);
      else tS = setTimeout(function () { loadContacts().then(function () { var gs = document.getElementById('globalSearch'); if (gs && gs.value.trim() === q) addHits(q); }); }, 200);
    };
  }
  function placeholder() {
    var gs = document.getElementById('globalSearch'); if (!gs) return;
    var want = S.app === 'crm' ? CRM_PH : SEARCH_PH;
    if (gs.getAttribute('placeholder') !== want) gs.setAttribute('placeholder', want);
  }
  document.addEventListener('wa153app', placeholder);
