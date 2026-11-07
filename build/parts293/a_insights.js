/* =====================================================================
   WA v293 The CRM's Insights tab (#crm/insights): the email history at a glance (07/11/26, design "03 email history" v2, 5.9 and 11.5)
   =====================================================================
   One call, crm_insights_overview() (wave293's database file, build/data/wa293_insights.sql; security invoker, so row security decides
   every count: Steel's mailbox lines count only for admins until mail_history_steel_open). Three sections:
   - Relationships by type over time: the people who emailed with Welfare Avenue each year since 2020, stacked by their type.
   - Top organisations: by the people who wrote and their emails, all time or the last 12 months (a switch), with relationship and status.
   - Gone quiet: donors, partners, supporters and volunteers with history and nothing on their timeline and no gift for
     mail_insights_quiet_months (12), the 100 most recent; a name opens the contact.
   No "waiting on a reply" list. No email line, subject or summary is shown here.
   window.w293.open(host) is called by the CRM page (parts152 c_list.js paintInsights) with #w293root; the names and organisations are
   buttons the CRM page's own click handler opens (data-w152open, data-w152go). */
(function () {
  if (window.__wa293) return; window.__wa293 = true;   /* the ground rule's guard (window.__wa29N) */

  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#6B6965';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  /* the types, in the order of the stack and the legend (none last: not typed, or a type the reader may not see yet) */
  var TYPES = [['partner', 'Partners', '#6F64AB', 'partner'], ['donor', 'Donors', '#B9851B', 'donor'], ['volunteer', 'Volunteers', '#2A8C7A', 'volunteer'], ['supporter', 'Supporters', '#C87A2F', 'supporter'],
    ['government', 'Government', '#4A4F57', 'government'], ['media', 'Media', '#3E7CB1', 'media'], ['vendor', 'Suppliers', '#8C6A2E', 'supplier'], ['other', 'Other', '#A39E93', 'other'], ['none', 'Not typed', 'rgba(16,63,57,.2)', 'not typed']];
  function tname(t, n) { return Number(n) === 1 ? t[3] : t[1].toLowerCase(); }
  var QUIET_KINDS = { donor: ['Donor', '#B9851B'], partner: ['Partner', '#6F64AB'], supporter: ['Supporter', '#C87A2F'], volunteer: ['Volunteer', '#2A8C7A'] };
  var REL_NAMES = { partner: 'Partner', sponsor: 'Sponsor', collaborator: 'Collaborator', supplier: 'Supplier', 'donor organisation': 'Donor organisation' };
  var STATUS = { active: ['Active', '#1d6b5c'], past: ['Past', MUTED], prospect: ['Prospect', '#7a5810'], declined: ['Declined', '#96331f'] };
  var S = { data: null, busy: false, err: '', at: 0, sort: 'all' };

  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function num(n) { return Number(n || 0).toLocaleString('en-CA'); }
  function plural(n, one, many) { return num(n) + ' ' + (Number(n) === 1 ? one : many); }
  function fmtDay(s) { try { if (window.w152 && window.w152.fmtDay) return window.w152.fmtDay(s); } catch (e) { /* fine */ } return String(s || '').slice(0, 10); }
  function ago(s) { try { if (window.w152 && window.w152.ago) return window.w152.ago(s); } catch (e) { /* fine */ } return ''; }
  function arr(a) { return Array.isArray(a) ? a : []; }
  function svg(d) { return '<svg class="w293i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var IC = { refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>' };

  function load() {
    if (S.busy) return;
    if (typeof db === 'undefined' || !db || !db.rpc) { S.err = 'offline'; paint(); return; }
    S.busy = true; S.err = ''; paint();
    Promise.resolve(db.rpc('crm_insights_overview')).then(function (r) {
      S.busy = false;
      if (r && r.error) { S.err = String(r.error.message || r.error); }
      else { S.data = (r && r.data && typeof r.data === 'object') ? r.data : { allowed: true, by_type_year: [], orgs: [], quiet: [] }; S.at = Date.now(); }
      paint();
    }, function (e) { S.busy = false; S.err = String((e && e.message) || e); paint(); });
  }
  function open(host) { if (!host) return; if ((!S.data && !S.err) || Date.now() - S.at > 120000) load(); paint(); }
  function paint() {
    var h = document.getElementById('w293root'); if (!h) return;
    var fk = document.activeElement && h.contains(document.activeElement) ? keyOf(document.activeElement) : null;
    h.innerHTML = html();
    if (fk) { var b = h.querySelector(fk); if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }
  }
  function keyOf(el) { for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (/^data-w29/.test(a.name)) return '[' + a.name + '="' + String(a.value).replace(/["\\]/g, '\\$&') + '"]'; } return null; }

  function html() {
    var d = S.data;
    if (!d) return S.err ? '<div class="w293box w293empty">The insights could not be worked out (' + E(S.err) + '). <button class="w293btn" data-w293reload="1">Try again</button></div>' : '<div class="w293box w293empty" aria-busy="true">Working out the insights…</div>';
    if (d.allowed === false) return '<div class="w293box w293empty">' + svg(IC.lock) + ' Insights are for the Welfare Avenue team with the CRM.</div>';
    var asOf = d.as_of ? new Date(d.as_of) : null, when = asOf && !isNaN(asOf) ? asOf.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }).replace(/\./g, '') : '';
    var note = d.steel_open ? '' : d.admin ? 'You see Steel’s mailbox in these counts; the rest of the team does not until he opens it.' : 'These counts leave out Steel’s mailbox until he opens it to the team.';
    return '<div class="w293hd"><div class="w293hdt"><h2>Insights</h2><p>Who emailed with Welfare Avenue, the organisations who write most, and who has gone quiet. From the email history and every timeline' + (when ? '; worked out at ' + E(when) : '') + '.</p>' +
      (note ? '<p class="w293note" data-w293note>' + svg(IC.lock) + E(note) + '</p>' : '') + '</div>' +
      '<button class="w293btn soft" data-w293reload="1"' + (S.busy ? ' disabled aria-busy="true"' : '') + '>' + svg(IC.refresh) + (S.busy ? 'Working…' : 'Refresh') + '</button></div>' +
      (S.err ? '<div class="w293warn" role="status">The refresh did not finish (' + E(S.err) + '). These are the last numbers.</div>' : '') +
      byTypeHtml(arr(d.by_type_year)) + orgsHtml(arr(d.orgs), Number(d.orgs_total) || 0) + quietHtml(arr(d.quiet), Number(d.quiet_total) || 0, Number(d.quiet_months) || 12);
  }

  /* 1. Relationships by type over time: one bar per year, stacked by type, the total at the end */
  function byTypeHtml(rows) {
    var head = '<section class="w293box" data-w293sec="types"><h3>Relationships by type over time</h3><p class="w293sub">The people who emailed with us each year since 2020, by what they are to us.</p>';
    if (!rows.length) return head + '<p class="w293empty0">No email history yet. When the email history is applied on the Import page, the people who wrote each year show here.</p></section>';
    var years = {}, used = {}, maxY = 2020, nowY = Number(String(new Date().getFullYear()));
    rows.forEach(function (r) { var y = Number(r.year), t = r.type || 'none'; if (!isFinite(y)) return; (years[y] = years[y] || {})[t] = (years[y][t] || 0) + Number(r.people || 0); used[t] = 1; if (y > maxY) maxY = y; });
    var last = Math.max(maxY, Math.min(nowY, maxY + 1)), list = [];
    for (var y = 2020; y <= last; y++) list.push(y);
    var tot = function (y) { var o = years[y] || {}; return Object.keys(o).reduce(function (s, k) { return s + o[k]; }, 0); };
    var max = Math.max.apply(null, list.map(tot).concat([1]));
    var types = TYPES.filter(function (t) { return used[t[0]]; });
    var legend = '<ul class="w293lg" aria-label="Types">' + types.map(function (t) { return '<li><i style="background:' + t[2] + '"></i>' + E(t[1]) + '</li>'; }).join('') + '</ul>';
    var bars = '<div class="w293bars">' + list.map(function (y) {
      var o = years[y] || {}, n = tot(y);
      var parts = types.filter(function (t) { return o[t[0]]; }).map(function (t) { return [t, o[t[0]]]; });
      var label = y + ': ' + (n ? plural(n, 'person', 'people') + ' (' + parts.map(function (p) { return num(p[1]) + ' ' + tname(p[0], p[1]); }).join(', ') + ')' : 'nobody');
      return '<div class="w293yr" role="img" aria-label="' + E(label) + '"><span class="w293y">' + y + '</span><span class="w293track">' +
        (n ? '<span class="w293stack" style="width:' + Math.max(2, n / max * 100).toFixed(2) + '%">' + parts.map(function (p) { return '<i style="flex-grow:' + p[1] + ';background:' + p[0][2] + '" title="' + E(y + ': ' + num(p[1]) + ' ' + tname(p[0], p[1])) + '"></i>'; }).join('') + '</span>' : '') +
        '</span><b class="w293n">' + num(n) + '</b></div>';
    }).join('') + '</div>';
    return head + legend + bars + '</section>';
  }

  /* 2. Top organisations: all time or the last 12 months */
  function orgsHtml(rows, total) {
    var twelve = S.sort === '12';
    var head = '<section class="w293box" data-w293sec="orgs"><div class="w293sh"><div><h3>Top organisations</h3><p class="w293sub">By the people who wrote to us and their emails' + (total > rows.length ? '; the top ' + num(rows.length) + ' of ' + num(total) : '') + '.</p></div>' +
      '<div class="w293seg" role="group" aria-label="Period"><button data-w293sort="all" aria-pressed="' + (!twelve) + '"' + (!twelve ? ' class="on"' : '') + '>All time</button><button data-w293sort="12" aria-pressed="' + twelve + '"' + (twelve ? ' class="on"' : '') + '>Last 12 months</button></div></div>';
    if (!rows.length) return head + '<p class="w293empty0">No organisation is linked to anyone with email history yet. The email history links people to organisations when its Organisations card is applied.</p></section>';
    var list = rows.slice().filter(function (o) { return !twelve || Number(o.writers_12) > 0; });
    list.sort(function (a, b) { return twelve ? (b.writers_12 - a.writers_12) || (b.emails_12 - a.emails_12) || String(a.name).localeCompare(String(b.name)) : (b.writers - a.writers) || (b.emails - a.emails) || String(a.name).localeCompare(String(b.name)); });
    if (!list.length) return head + '<p class="w293empty0">Nobody from these organisations wrote in the last 12 months.</p></section>';
    return head + '<ol class="w293orgs">' + list.map(function (o, i) {
      var st = STATUS[o.status] || [o.status || '', MUTED], w = twelve ? o.writers_12 : o.writers, m = twelve ? o.emails_12 : o.emails;
      return '<li><span class="w293rk">' + (i + 1) + '</span><div class="w293on"><button class="w293lnk" data-w152go="#partners/' + E(o.id) + '">' + E(o.name) + '</button>' +
        '<span class="w293tags">' + (o.relationship ? '<span class="w293tag">' + E(REL_NAMES[o.relationship] || o.relationship) + '</span>' : '') + (st[0] ? '<span class="w293tag" style="color:' + st[1] + '">' + E(st[0]) + '</span>' : '') +
        (o.last_at ? '<span class="w293last">last email ' + E(fmtDay(o.last_at)) + '</span>' : '') + '</span></div>' +
        '<div class="w293m"><b>' + num(w) + '</b><span>' + (Number(w) === 1 ? 'person' : 'people') + '</span></div><div class="w293m"><b>' + num(m) + '</b><span>' + (Number(m) === 1 ? 'email' : 'emails') + '</span></div></li>';
    }).join('') + '</ol></section>';
  }

  /* 3. Gone quiet */
  function quietHtml(rows, total, months) {
    var yrs = months % 12 === 0 ? months / 12 : 0;
    var period = yrs === 1 ? 'a year' : yrs ? plural(yrs, 'year', 'years') : plural(months, 'month', 'months');   /* "for a year or more" */
    var inLast = yrs === 1 ? 'year' : period;   /* "in the last year", "in the last 18 months" */
    var head = '<section class="w293box" data-w293sec="quiet"><h3>Gone quiet</h3><p class="w293sub">Donors, partners, supporters and volunteers with nothing on their timeline and no gift for ' + E(period) + ' or more' +
      (total ? ': ' + plural(total, 'person', 'people') + (total > rows.length ? ', the ' + num(rows.length) + ' who went quiet most recently first' : ', the most recent first') : '') + '.</p>';
    if (!rows.length) return head + '<p class="w293empty0">Nobody has gone quiet. Everyone with history has heard from us, or we from them, in the last ' + E(inLast) + '.</p></section>';
    return head + '<ul class="w293quiet">' + rows.map(function (q) {
      var k = QUIET_KINDS[q.kind] || [q.kind || '', MUTED];
      return '<li><button class="w293row" data-w152open="' + E(q.contact_id) + '"><span class="w293qn">' + E(q.name || 'Someone') + '</span>' +
        '<span class="w293qk" style="background:' + k[1] + '1a;color:' + k[1] + '">' + E(k[0]) + '</span>' +
        '<span class="w293ql">Last ' + (q.last_was === 'gift' ? 'gift' : 'on their timeline') + ' ' + E(fmtDay(q.last_at)) + (ago(q.last_at) ? ' <span>(' + E(ago(q.last_at)) + ')</span>' : '') + '</span>' + svg(IC.arrow) + '</button></li>';
    }).join('') + '</ul></section>';
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target; if (!t || !t.closest || !t.closest('#w293root')) return;
    var el;
    if ((el = t.closest('[data-w293reload]'))) { ev.preventDefault(); load(); return; }
    if ((el = t.closest('[data-w293sort]'))) { ev.preventDefault(); S.sort = el.getAttribute('data-w293sort') === '12' ? '12' : 'all'; paint(); return; }
  });

  window.w293 = { open: open, paint: paint, load: load, state: function () { return S; } };
