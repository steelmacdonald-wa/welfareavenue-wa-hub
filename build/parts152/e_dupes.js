  /* ======================= possible duplicates (#crm/dupes) ======================= */
  function sideHtml(c, other) {
    var lines = [];
    if (c.emails.length) lines.push('<div class="ln">' + c.emails.map(function (e) { return other.emails.some(function (x) { return lower(x) === lower(e); }) ? '<b>' + E(e) + '</b>' : E(e); }).join(', ') + '</div>');
    if (c.phones.length) lines.push('<div class="ln">' + c.phones.map(function (p) { var d = digits(p); return d.length >= 7 && other._digits.indexOf(d) >= 0 ? '<b>' + E(p) + '</b>' : E(p); }).join(', ') + '</div>');
    var facts = [];
    if (c._served) facts.push(plural(c._served, 'serving', 'servings'));
    if (Number(c.donation_count)) facts.push(plural(Number(c.donation_count), 'gift', 'gifts'));
    if (c._roles.length) facts.push(c._roles.map(roleName).join(', '));
    lines.push('<div class="ln m">' + E(['From ' + sourceName(c.source)].concat(facts).join(' · ')) + '</div>');
    if (c.created_at) lines.push('<div class="ln m">In the CRM since ' + E(fmtDay(c.created_at)) + '</div>');
    return '<div class="w152ds"><div class="top">' + avatar(c) + '<div style="min-width:0"><div class="nm">' + E(c.full_name) + '</div><div class="ks" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">' + kindsHtml(c) + '</div></div></div>' +
      lines.join('') + '<div class="act"><button class="w152btn sm" data-w152keep="' + E(c.id) + '" data-drop="' + E(other.id) + '">' + I('check') + ' Keep this one</button>' +
      '<button class="w152mini" data-w152open="' + E(c.id) + '">Open</button></div></div>';
  }
  function pairHtml(p) {
    var a = contact(p.a), b = contact(p.b);
    var why = p.on.length > 1 ? 'Same email and phone' : p.on[0] === 'email' ? 'Same email' : 'Same phone';
    var cf = '';
    var m = /^merge:(\d+):(\d+)$/.exec(S.confirm || '');
    if (m && ((m[1] === String(a.id) && m[2] === String(b.id)) || (m[1] === String(b.id) && m[2] === String(a.id)))) {
      var keep = contact(m[1]), drop = contact(m[2]);
      cf = '<div class="w152cf"><span>Merge <b>' + E(drop.full_name) + '</b> into <b>' + E(keep.full_name) + '</b>? Their emails, phones, tags, notes and history move to ' + E(keep.full_name) +
        (keep.volunteer_id && drop.volunteer_id ? ', and their two volunteer records become one (with both rosters)' : '') + '. The Hub cannot undo it.</span>' +
        '<span style="display:flex;gap:6px"><button class="w152btn ghost sm" data-w152cancel="1">Cancel</button><button class="w152btn danger sm" data-w152merge="' + E(keep.id) + '" data-drop="' + E(drop.id) + '">' + I('merge') + ' Merge</button></span></div>';
    }
    return '<div class="w152dp" data-pair="' + E(p.a + '-' + p.b) + '"><div class="why">' + I('merge') + E(why) + ' <span>' + E(p.values.join(' · ')) + '</span></div>' +
      '<div class="two">' + sideHtml(a, b) + sideHtml(b, a) + '</div>' + cf +
      '<div class="bot"><button class="w152btn ghost sm" data-w152notdup="' + E(p.a + '-' + p.b) + '">' + I('x') + ' Not the same person</button></div></div>';
  }
  function paintDupes(root) {
    var pairs = dupePairs();
    root.innerHTML = tabsHtml() +
      '<div class="w152count" style="max-width:760px;line-height:1.5">Two contacts with the same email or phone. Keep the right one and the other one’s emails, phones, tags, notes and history move to it. Family members often share a phone: mark those as different people and they leave this list.</div>' +
      (S.err.dupes && !S.dupes.length ? '<div class="w152empty">The duplicates could not load (' + E(S.err.dupes) + ').</div>' :
        pairs.length ? '<div class="w152dl">' + pairs.map(pairHtml).join('') + '</div>' : '<div class="w152empty">' + I('check') + ' No possible duplicates right now.</div>');
  }
  async function merge(keepId, dropId) {
    var keep = contact(keepId), drop = contact(dropId); if (!keep || !drop) return;
    var btn = document.querySelector('[data-w152merge="' + keepId + '"]'); if (btn) btn.disabled = true;
    try {
      var r = await db.rpc('crm_merge_contacts', { p_keep: Number(keepId), p_drop: Number(dropId) });
      if (r && r.error) throw r.error;
      /* what the database did, on the page at once; the next visit reloads the numbers */
      applyLocal(keep.id, {
        emails: uniq(keep.emails.concat(drop.emails)), phones: uniq(keep.phones.concat(drop.phones)), tags: uniq(keep.tags.concat(drop.tags)), kinds: uniq(keep.kinds.concat(drop.kinds)),
        hub_servings: (Number(keep.hub_servings) || 0) + (keep.volunteer_id && drop.volunteer_id && keep.volunteer_id !== drop.volunteer_id ? (Number(drop.hub_servings) || 0) : 0),
        legacy_servings: (Number(keep.legacy_servings) || 0) + (Number(drop.legacy_servings) || 0), donation_total: (Number(keep.donation_total) || 0) + (Number(drop.donation_total) || 0),
        donation_count: (Number(keep.donation_count) || 0) + (Number(drop.donation_count) || 0), org_names: uniq(keep.org_names.concat(drop.org_names))
      });
      S.contacts = S.contacts.filter(function (x) { return String(x.id) !== String(dropId); }); delete BY_ID[String(dropId)];
      S.dupes = (S.dupes || []).filter(function (d) { return String(d.contact_id) !== String(dropId) && String(d.duplicate_id) !== String(dropId); });
      delete S.detail[String(keepId)]; delete S.detail[String(dropId)];
      S.at.contacts = 0; S.at.dupes = 0; S.confirm = null;
      toastS(drop.full_name + ' merged into ' + keep.full_name);
      paint();
    } catch (e) { if (btn) btn.disabled = false; toastS('Could not merge: ' + String((e && e.message) || e).slice(0, 140)); }
  }
  async function notDup(key) {
    var ab = String(key).split('-').map(Number); if (ab.length !== 2) return;
    try {
      var r = await db.from('crm_dupe_dismissals').insert({ a_id: Math.min(ab[0], ab[1]), b_id: Math.max(ab[0], ab[1]), dismissed_by: actor() });
      if (r && r.error && !/duplicate key/i.test(String(r.error.message || ''))) throw r.error;
      S.dupes = (S.dupes || []).filter(function (d) { var a = Math.min(Number(d.contact_id), Number(d.duplicate_id)), b = Math.max(Number(d.contact_id), Number(d.duplicate_id)); return !(a === Math.min(ab[0], ab[1]) && b === Math.max(ab[0], ab[1])); });
      toastS('Marked as different people');
      paint();
    } catch (e) { toastS('Could not save: ' + String((e && e.message) || e).slice(0, 140)); }
  }

  /* ======================= sources (#crm/sources) ======================= */
  function loadCounts() {
    if (S.counts && Date.now() - (S.counts.at || 0) < 120000) return Promise.resolve(S.counts);
    var n = function (p) { return Promise.resolve(p).then(function (r) { return r && !r.error && typeof r.count === 'number' ? r.count : null; }, function () { return null; }); };
    return Promise.all([
      n(db.from('crm_volunteer_history').select('id', { count: 'exact', head: true })),
      n(db.from('crm_interactions').select('id', { count: 'exact', head: true }).eq('kind', 'website_message')),
      n(db.from('crm_donations').select('id', { count: 'exact', head: true }))
    ]).then(function (r) { S.counts = { hist: r[0], msgs: r[1], gifts: r[2], at: Date.now() }; return S.counts; });
  }
  function paintSources(root) {
    var all = S.contacts || [], by = {}, perm = {};
    all.forEach(function (c) { by[c.source || ''] = (by[c.source || ''] || 0) + 1; perm[c._perm] = (perm[c._perm] || 0) + 1; });
    var srcRows = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (s) {
      var d = SOURCES[s] || [s ? String(s).replace(/_/g, ' ') : 'Unknown', ''];
      return '<div class="w152srow"><b>' + by[s] + '</b><div><div class="tt">' + E(d[0]) + '</div>' + (d[1] ? '<p>' + E(d[1]) + '</p>' : '') + '</div><span></span></div>';
    }).join('');
    var k = S.counts || {};
    var st = function (n, none) { return n == null ? '<span class="st next">Checking…</span>' : n > 0 ? '<span class="st on">' + Number(n).toLocaleString('en-CA') + ' in</span>' : '<span class="st next">' + E(none) + '</span>'; };
    var keela = by.keela || 0;
    var next = [
      ['Volunteer history from the old website', 'Every event each volunteer signed up for, was confirmed for and served at, from the Django site.', st(k.hist, 'Next')],
      ['Messages from the website', 'What people write through the contact form on welfareavenue.com, on the sender’s timeline.', st(k.msgs, 'Next')],
      ['Gifts and tax receipts from Zeffy', 'Every donation with its receipt, on the donor’s timeline and in their total.', st(k.gifts, 'Later')],
      ['The Keela export', 'Donors and supporters from Keela, merged with the people already here.', keela ? '<span class="st on">' + keela + ' in</span>' : '<span class="st next">When it arrives</span>']
    ].map(function (r) { return '<div class="w152srow nx"><div><div class="tt">' + E(r[0]) + '</div><p>' + E(r[1]) + '</p></div>' + r[2] + '</div>'; }).join('');
    var ok = (perm.express || 0) + (perm.implied || 0);
    var pr = [['express', 'said yes to our emails'], ['implied', 'with an implied consent that has not run out'], ['unknown', 'with no permission on file yet'], ['none', 'with no consent'], ['unsub', 'who unsubscribed'], ['bounced', 'whose address bounces']]
      .filter(function (x) { return perm[x[0]]; }).map(function (x) { return '<div class="w152srow"><b>' + perm[x[0]] + '</b><div><div class="tt">' + permChip(x[0]) + '</div><p>' + E('Contacts ' + x[1] + '.') + '</p></div><span></span></div>'; }).join('');
    var rev = all.filter(function (c) { return c.volunteer_needs_review; }).length, noEm = all.filter(function (c) { return !c.emails.length; }).length, noPh = all.filter(function (c) { return !c.phones.length; }).length, pairs = S.dupes ? dupePairs().length : 0;
    var tidy = [[pairs, 'possible duplicates', 'Same email or phone on two contacts.', '#crm/dupes'], [rev, 'volunteer records to review', 'Flagged in the Volunteer Manager when they were imported.', ''],
      [noEm, 'contacts with no email', '', ''], [noPh, 'contacts with no phone', '', '']].map(function (x) {
      return '<div class="w152srow"><b>' + x[0] + '</b><div><div class="tt">' + E(x[1].charAt(0).toUpperCase() + x[1].slice(1)) + '</div>' + (x[2] ? '<p>' + E(x[2]) + '</p>' : '') + '</div>' + (x[3] && x[0] ? '<button class="w152mini" data-w152go="' + x[3] + '">Check them ' + I('arrow') + '</button>' : '<span></span>') + '</div>';
    }).join('');
    root.innerHTML = tabsHtml() + '<div class="w152grid2">' + keelaHtml() +
      '<div class="w152card"><h3>Where they come from <span>' + plural(all.length, 'contact', 'contacts') + '</span></h3>' + srcRows + '</div>' +
      '<div class="w152card"><h3>What joins next</h3>' + next + '</div>' +
      '<div class="w152card"><h3>Email permission <span>' + plural(ok, 'contact', 'contacts') + ' can get a newsletter today</span></h3>' + pr +
      '<p class="w152pnote">Campaigns go only to express consent, or implied consent that has not run out (CASL). Everyone else is asked first.</p></div>' +
      '<div class="w152card"><h3>To tidy</h3>' + tidy + '</div></div>';
    if (!S.counts) loadCounts().then(function () { if (S.ui.tab === 'sources') paint(); });
    /* wave159a: what Leaving Keela reads */
    var need = ['forms', 'autos', 'kcfg', 'gifts'].filter(function (k) { return !S[k] && !S.loading[k]; });
    if (need.length) Promise.all(need.map(function (k) { return load(k); })).then(function () { if (S.ui.tab === 'sources') paint(); });
  }
