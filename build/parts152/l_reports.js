  /* ======================= Reports (wave160, 28/09/26) =======================
     The CRM's Reports tab (#crm/reports, or #crm/reports/<the year a fiscal year starts>): one fiscal year (1 October to
     30 September) from crm_report(), which runs with the reader's rights. The year in a few lines for the board (copy it or
     print the page), the headline numbers against the year before (at the same point while the year is still running), gifts
     by month, kind, campaign, source and size, donors (new, retained, recaptured, lapsed, the retention rate; who gave last
     year and not yet this year, made into a fixed list in one click; the largest donors), volunteering (servings by month, new
     and returning volunteers, retention, roles, the most servings, the application funnel, the hours and meals where they were
     recorded), email permission today, and the emails and form answers of the year. Read-only apart from Make a list. */
  P.chart = '<path d="M4 4v16h16"/><path d="M8.5 16v-4.5M12.5 16V8M16.5 16v-6"/>';
  P.print = '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7.5" rx="2"/><path d="M7 14h10v6H7z"/>';
  P.refresh = '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>';
  var RP = { fy: null, data: {}, busy: false, err: '', msg: '', showLapsed: false, listing: false };
  function rpGet() { return RP.data[RP.fy == null ? 'cur' : String(RP.fy)] || null; }
  function rpLabel(y) { y = Number(y); return y + '-' + String(y + 1).slice(2); }
  function rpPct(a, b) { a = Number(a) || 0; b = Number(b) || 0; return b ? Math.round(a * 100 / b) + '%' : '–'; }
  function rpCap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function rpNum(n) { return (Number(n) || 0).toLocaleString('en-CA'); }
  function rpMonth(m) { return MON[Number(String(m).slice(5, 7)) - 1] || ''; }
  function rpLoad(fy, force) {
    var key = fy == null ? 'cur' : String(fy);
    if (RP.data[key] && !force) return Promise.resolve(RP.data[key]);
    if (typeof db === 'undefined' || !db || !db.rpc) return Promise.resolve(null);
    RP.busy = true; RP.err = '';
    return Promise.resolve(db.rpc('crm_report', { p_fy: fy == null ? null : Number(fy) })).then(function (r) {
      RP.busy = false;
      if (r && r.error) { RP.err = String(r.error.message || r.error); return null; }
      var d = r && r.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
      if (!d || d.fy == null) { RP.err = 'The report did not come back.'; return null; }
      RP.data[String(d.fy)] = d; if (fy == null) RP.data.cur = d;
      return d;
    }, function (e) { RP.busy = false; RP.err = String((e && e.message) || e); return null; });
  }
  function openReports(parts) {
    var y = parts[2] && /^\d{4}$/.test(parts[2]) ? Number(parts[2]) : null;
    if (y !== RP.fy) { RP.showLapsed = false; RP.msg = ''; }
    RP.fy = y; RP.err = '';
  }

  /* ---------- the year in a few lines (for the board) ---------- */
  function rpSpan(d) { return d.label + ' (' + fmtDay(d.from) + ' to ' + fmtDay(d.in_progress ? d.through : d.to) + ')'; }
  function rpSummary(d) {
    var g = d.gifts || {}, dn = d.donors || {}, v = d.volunteers || {}, out = [];
    var pg = (d.in_progress ? g.prev_to_date : g.prev) || {}, pv = (d.in_progress ? v.prev_to_date : v.prev) || {};
    var pwhen = d.in_progress ? 'at the same point in ' + d.prev_label : 'in ' + d.prev_label;
    if (g.count) out.push('In ' + rpSpan(d) + ', ' + plural(g.donors, 'person', 'people') + ' gave ' + money(g.total) + ' in ' + plural(g.count, 'gift', 'gifts') + ' (' + pwhen + ': ' + money(pg.total || 0) + ' from ' + plural(pg.donors || 0, 'person', 'people') + ').');
    else out.push('No gift is recorded in ' + rpSpan(d) + (pg.count ? ' (' + pwhen + ': ' + money(pg.total) + ')' : '') + '.');
    var bits = [];
    if (dn.new) bits.push(plural(dn.new, 'person', 'people') + ' gave for the first time');
    if (dn.last_year) bits.push(rpNum(dn.retained) + ' of the ' + plural(dn.last_year, 'donor', 'donors') + ' of ' + d.prev_label + ' gave again (' + rpPct(dn.retained, dn.last_year) + ' retention)');
    if (dn.recaptured) bits.push(plural(dn.recaptured, 'person', 'people') + ' came back after a year or more without giving');
    if (dn.lapsed) bits.push(rpNum(dn.lapsed) + ' who gave in ' + d.prev_label + ' have not given ' + (d.in_progress ? 'yet ' : '') + 'in ' + d.label);
    if (bits.length) out.push(rpCap(listJoin(bits)) + '.');
    if (v.servings) {
      var vb = [plural(v.people, 'volunteer', 'volunteers') + ' served ' + plural(v.servings, 'time', 'times') + ' at ' + plural(v.events, 'event', 'events') + ' (' + pwhen + ': ' + plural(pv.people || 0, 'volunteer', 'volunteers') + ', ' + plural(pv.servings || 0, 'serving', 'servings') + ').'];
      var nb = [];
      if (v.new) nb.push(plural(v.new, 'person', 'people') + ' served for the first time');
      if (v.prev && v.prev.people) nb.push(rpNum(v.retained) + ' of the ' + plural(v.prev.people, 'volunteer', 'volunteers') + ' of ' + d.prev_label + ' came back (' + rpPct(v.retained, v.prev.people) + ')');
      if (nb.length) vb.push(rpCap(listJoin(nb)) + '.');
      if (v.hours && Number(v.hours.recorded) > 0) vb.push('They gave ' + plural(Math.round(Number(v.hours.recorded)), 'hour', 'hours') + ' where hours were recorded.');
      if (v.meals && Number(v.meals.served) > 0) vb.push(plural(v.meals.served, 'meal was', 'meals were') + ' served at the events that recorded it.');
      out.push(vb.join(' '));
    } else out.push('No serving is recorded in ' + rpSpan(d) + '.');
    var ap = v.applied || {};
    if (ap.applied) out.push(plural(ap.applied, 'person', 'people') + ' applied to volunteer, and ' + rpNum(ap.served1) + ' of them ' + (ap.served1 === 1 ? 'has' : 'have') + ' served since.');
    var em = d.email || {};
    if (em.sent) out.push('The Hub sent ' + plural(em.sent, 'email', 'emails') + (em.campaigns ? ' (' + plural(em.campaigns, 'campaign', 'campaigns') + ')' : '') + '; ' + rpNum(em.opened) + ' were opened.');
    var fa = (d.forms || []).reduce(function (a, x) { return a + (Number(x.answers) || 0); }, 0);
    if (fa) out.push('The CRM’s forms were answered ' + plural(fa, 'time', 'times') + '.');
    return out;
  }

  /* ---------- email permission today (the CRM's rule, from the contacts) ---------- */
  function rpPerm() {
    var o = { reach: 0, express: 0, implied: 0, ending: 0, unsub: 0, bounced: 0, none: 0, noemail: 0, total: 0 };
    (S.contacts || []).forEach(function (c) {
      o.total++;
      if (!c.emails.length) { o.noemail++; return; }
      var p = c._perm;
      if (p === 'express' || p === 'implied') { o.reach++; o[p]++; }
      else if (p === 'unsub') o.unsub++;
      else if (p === 'bounced') o.bounced++;
      else o.none++;
      if (p === 'implied') { var n = daysSince(c.implied_consent_until); if (n != null && n <= 0 && n >= -90) o.ending++; }
    });
    return o;
  }

  /* ---------- pieces ---------- */
  function rpBars(rows, cur, prev, fmt, label, labels) {
    var max = 0;
    rows.forEach(function (r) { max = Math.max(max, Number(r[cur]) || 0, prev ? Number(r[prev]) || 0 : 0); });
    var h = function (v) { return max && v ? Math.max(3, Math.round(v * 100 / max)) : 0; };
    var aria = label + ': ' + rows.map(function (r) { return rpMonth(r.month) + ' ' + fmt(Number(r[cur]) || 0); }).join(', ');
    return '<div class="w160ch" role="img" aria-label="' + E(aria) + '">' + rows.map(function (r) {
      var a = Number(r[cur]) || 0, b = prev ? Number(r[prev]) || 0 : 0, mo = rpMonth(r.month);
      return '<div class="w160col" title="' + E(mo + ' ' + String(r.month).slice(0, 4) + ': ' + fmt(a) + (prev ? ' (the year before: ' + fmt(b) + ')' : '')) + '"><div class="w160bars">' +
        (prev ? '<i class="p" style="height:' + h(b) + '%"></i>' : '') + '<i class="c" style="height:' + h(a) + '%"></i></div></div>';
    }).join('') + '</div><div class="w160ml" aria-hidden="true">' + rows.map(function (r) { return '<span>' + E(rpMonth(r.month)) + '</span>'; }).join('') + '</div>' +
      (labels ? '<div class="w160lg"><span><i class="c"></i>' + E(labels[0]) + '</span>' + (prev ? '<span><i class="p"></i>' + E(labels[1]) + '</span>' : '') + '</div>' : '');
  }
  /* rows: [label html, value text, share 0..1, extra text] */
  function rpRows(list, empty) {
    if (!list.length) return '<p class="m">' + E(empty || 'Nothing to show.') + '</p>';
    return '<div class="w160rows">' + list.map(function (x) {
      return '<div class="w160r"><span class="k">' + x[0] + (x[3] ? '<span class="m"> · ' + E(x[3]) + '</span>' : '') + '</span>' +
        '<span class="bar" aria-hidden="true"><i style="width:' + Math.round(Math.max(0, Math.min(1, x[2] || 0)) * 100) + '%"></i></span><span class="v">' + E(x[1]) + '</span></div>';
    }).join('') + '</div>';
  }
  function rpWho(id, name) {
    var c = id != null ? contact(id) : null, n = (c && c.full_name) || name || 'Someone not in the CRM';
    return c ? '<a href="#crm/c/' + E(c.id) + '">' + E(n) + '</a>' : E(n);
  }
  function rpBox(n, label) { return '<div><b>' + E(n) + '</b><span>' + E(label) + '</span></div>'; }
  function rpMethod(m) { var x = GMETH.filter(function (o) { return o[0] === m; })[0]; return x && m ? x[1] : ''; }

  function rpGiftsHtml(d) {
    var g = d.gifts || {}, months = g.by_month || [], tot = Number(g.total) || 0;
    var best = months.reduce(function (a, r) { return Number(r.total) > Number(a.total || 0) ? r : a; }, {});
    var kinds = (g.by_kind || []).map(function (k) { var nm = (GKIND[k.kind] || [rpCap(k.kind)])[0]; return [E(nm), money(k.total), tot ? k.total / tot : 0, plural(k.count, 'gift', 'gifts')]; });
    var camps = (g.by_campaign || []).slice(0, 10).map(function (k) { return [E(k.campaign || 'No campaign'), money(k.total), tot ? k.total / tot : 0, plural(k.count, 'gift', 'gifts') + ', ' + plural(k.donors, 'donor', 'donors')]; });
    var srcs = (g.by_source || []).map(function (k) { var m = rpMethod(k.method); return [E(platName(k.platform) + (m ? ' (' + m + ')' : '')), money(k.total), tot ? k.total / tot : 0, plural(k.count, 'gift', 'gifts')]; });
    var rc = g.receipts || {}, rcl = Object.keys(RSTS).filter(function (k) { return rc[k]; }).map(function (k) { return plural(rc[k], 'gift', 'gifts') + ' ' + RSTS[k][0].toLowerCase(); });
    var allKeela = (g.by_source || []).length && (g.by_source || []).every(function (k) { return k.platform === 'keela'; });
    return '<section class="w154card wide"><h3>' + I('heart') + ' Gifts by month <span class="m">' + E(money(tot)) + ' in ' + E(d.label) + (g.prev ? ', ' + E(money(g.prev.total)) + ' in ' + E(d.prev_label) : '') + '</span></h3>' +
      rpBars(months, 'total', 'prev_total', money, 'Gifts by month in ' + d.label, [d.label, d.prev_label]) +
      (best.month && Number(best.total) > 0 ? '<p class="w160note">The best month: ' + E(rpMonth(best.month) + ' ' + best.month.slice(0, 4)) + ' (' + E(money(best.total)) + ', ' + E(plural(best.count, 'gift', 'gifts')) + ').</p>' : '') + '</section>' +
      '<section class="w154card"><h3>' + I('db') + ' Where it came from</h3>' +
      '<div class="w160h4">What kind of money</div>' + rpRows(kinds, 'No gift this year.') +
      '<div class="w160h4">Campaigns</div>' + rpRows(camps, 'No gift this year.') +
      '<div class="w160h4">How it came</div>' + rpRows(srcs, 'No gift this year.') +
      (rcl.length ? '<p class="w160note">Receipts: ' + E(listJoin(rcl)) + '. <a href="#crm/gifts/receipts">Receipts</a></p>' : '') +
      (allKeela ? '<p class="w160note">Keela’s gifts came in as donations: registrations and tickets among them count as donations until someone sets their kind in Gifts.</p>' : '') + '</section>';
  }
  function rpSizesHtml(d) {
    var g = d.gifts || {}, dn = d.donors || {}, bands = g.bands || [], most = 0;
    bands.forEach(function (b) { most = Math.max(most, Number(b.count) || 0); });
    var rows = bands.map(function (b) { return [E(b.band), plural(b.count, 'gift', 'gifts'), most ? b.count / most : 0, Number(b.total) ? money(b.total) : '']; });
    var top = (dn.top || []).map(function (x, i) { return [rpWho(x.contact_id, x.name), money(x.total), dn.top[0] && Number(dn.top[0].total) ? x.total / dn.top[0].total : 0, plural(x.count, 'gift', 'gifts')]; });
    return '<section class="w154card"><h3>' + I('spark') + ' Gift sizes <span class="m">' + (g.count ? 'average ' + E(money(g.average)) + ', middle ' + E(money(g.median)) + ', largest ' + E(money(g.largest)) : '') + '</span></h3>' +
      rpRows(rows, 'No gift this year.') + '<div class="w160h4">The largest donors of ' + E(d.label) + '</div>' + rpRows(top, 'No donor this year.') + '</section>';
  }
  function rpDonorsHtml(d) {
    var dn = d.donors || {}, lap = dn.lapsed_list || [], shown = RP.showLapsed ? lap : lap.slice(0, 8);
    var rows = shown.map(function (x) { return [rpWho(x.contact_id, x.name), money(x.prev_total), 0, 'last gave ' + fmtDay(x.last_day) + ', ' + plural(x.gifts_ever, 'gift', 'gifts') + ' in all']; });
    return '<section class="w154card"><h3>' + I('people') + ' Donors <span class="m">' + E(plural(dn.this_year || 0, 'donor', 'donors')) + ' in ' + E(d.label) + '</span></h3>' +
      '<div class="w160ret">' + rpBox(rpNum(dn.new), 'gave for the first time') + rpBox(rpNum(dn.retained), 'gave again after ' + d.prev_label) +
      rpBox(rpNum(dn.recaptured), 'came back after a gap') + rpBox(rpNum(dn.lapsed), 'gave in ' + d.prev_label + ', not ' + (d.in_progress ? 'yet ' : '') + 'in ' + d.label) + '</div>' +
      '<p>Donor retention: <b>' + E(rpPct(dn.retained, dn.last_year)) + '</b> of the ' + E(plural(dn.last_year || 0, 'donor', 'donors')) + ' of ' + E(d.prev_label) + ' gave again in ' + E(d.label) + (d.in_progress ? ' so far' : '') + '.</p>' +
      (lap.length ? '<div class="w160h4">Gave in ' + E(d.prev_label) + ', not ' + (d.in_progress ? 'yet ' : '') + 'in ' + E(d.label) + '</div>' +
        '<div class="w160rows w160lap">' + rows.map(function (x) { return '<div class="w160r"><span class="k">' + x[0] + '<span class="m"> · ' + E(x[3]) + '</span></span><span></span><span class="v">' + E(x[1]) + '</span></div>'; }).join('') + '</div>' +
        '<div class="w154acts w160noprint">' + (lap.length > shown.length ? '<button class="w152mini" data-w160lapsed="1">Show all ' + lap.length + '</button>' : '') +
        '<button class="w152btn sm" data-w160list="1"' + (RP.listing ? ' disabled' : '') + '>' + I('list') + ' Make a list of them</button></div>' : '') +
      (RP.msg ? '<div class="w154msg">' + E(RP.msg) + (/saved/.test(RP.msg) ? ' <a href="#crm/lists">Lists</a>' : '') + '</div>' : '') + '</section>';
  }
  function rpVolHtml(d) {
    var v = d.volunteers || {}, months = v.by_month || [], pv = v.prev || {};
    var roles = v.by_role || [], most = roles.reduce(function (a, r) { return Math.max(a, Number(r.servings) || 0); }, 0);
    var rrows = roles.map(function (r) { return [E(roleName(r.role)), plural(r.servings, 'serving', 'servings'), most ? r.servings / most : 0, plural(r.people, 'person', 'people')]; });
    var top = (v.top || []).map(function (x) { return [rpWho(x.contact_id, x.name), plural(x.servings, 'serving', 'servings'), v.top[0] && v.top[0].servings ? x.servings / v.top[0].servings : 0, '']; });
    var ap = v.applied || {}, steps = [['Applied in ' + d.label, ap.applied], ['Served at least once since', ap.served1], ['Twice or more', ap.served2], ['Three times or more', ap.served3]];
    var funnel = ap.applied ? rpRows(steps.map(function (s) { return [E(s[0]), rpNum(s[1]), ap.applied ? (Number(s[1]) || 0) / ap.applied : 0, '']; })) : '<p class="m">No application is dated in ' + E(d.label) + '.</p>';
    var hrs = v.hours || {}, meals = v.meals || {};
    var notes = [];
    if (Number(hrs.recorded) > 0) notes.push(plural(Math.round(Number(hrs.recorded)), 'hour', 'hours') + ' recorded for ' + plural(hrs.servings_with_hours, 'serving', 'servings') + ' (the old website).');
    else notes.push('Hours are not recorded for servings in the Hub' + (hrs.last_recorded ? '; the old website recorded them until ' + fmtDay(hrs.last_recorded) : '') + '.');
    if (Number(meals.served) > 0) notes.push(plural(meals.served, 'meal', 'meals') + ' served at ' + plural(meals.events, 'event', 'events') + ' that recorded it.');
    else notes.push('Meals served are not recorded' + (meals.last_recorded ? ' since ' + fmtDay(meals.last_recorded) + ' (the old website)' : '') + '.');
    return '<section class="w154card wide"><h3>' + I('hand') + ' Volunteering by month <span class="m">' + E(plural(v.servings || 0, 'serving', 'servings')) + ' in ' + E(d.label) + ', ' + E(plural(pv.servings || 0, 'serving', 'servings')) + ' in ' + E(d.prev_label) + '</span></h3>' +
      rpBars(months, 'servings', 'prev_servings', function (n) { return plural(n, 'serving', 'servings'); }, 'Servings by month in ' + d.label, [d.label, d.prev_label]) + '</section>' +
      '<section class="w154card"><h3>' + I('people') + ' Volunteers <span class="m">' + E(plural(v.people || 0, 'person', 'people')) + ' at ' + E(plural(v.events || 0, 'event', 'events')) + '</span></h3>' +
      '<div class="w160ret">' + rpBox(rpNum(v.people), 'served in ' + d.label) + rpBox(rpNum(v.new), 'for the first time') +
      rpBox(rpNum(v.retained), 'of ' + rpNum(pv.people) + ' from ' + d.prev_label + ' came back') + rpBox(rpPct(v.retained, pv.people), 'volunteer retention') + '</div>' +
      '<div class="w160h4">Roles</div>' + rpRows(rrows, 'No serving this year.') +
      '<div class="w160h4">The most servings</div>' + rpRows(top, 'No serving this year.') + '</section>' +
      '<section class="w154card"><h3>' + I('arrow') + ' From applying to serving</h3>' + funnel +
      '<p class="w160note">From the volunteer record: the date of someone’s latest application, and the servings on or after it.</p>' +
      '<div class="w160h4">Hours and meals</div><p class="w160note">' + E(notes.join(' ')) + '</p></section>';
  }
  function rpMailHtml(d) {
    var p = rpPerm(), em = d.email || {}, forms = d.forms || [];
    var frows = forms.map(function (x) { return [E(x.title || x.slug || 'A form'), plural(x.answers, 'answer', 'answers'), 0, '']; });
    return '<section class="w154card"><h3>' + I('mail') + ' Email <span class="m">permission today</span></h3>' +
      '<div class="w160ret">' + rpBox(rpNum(p.reach), 'can get a newsletter') + rpBox(rpNum(p.express), 'said yes (express)') + rpBox(rpNum(p.implied), 'implied: gave or served') + rpBox(rpNum(p.ending), 'implied ends within 90 days') + '</div>' +
      '<p class="w160note">' + E(plural(p.unsub, 'person has', 'people have') + ' unsubscribed, ' + plural(p.bounced, 'address bounces', 'addresses bounce') + ', ' + plural(p.none, 'person has', 'people have') + ' no permission on file (confirmations only), and ' + plural(p.noemail, 'contact has', 'contacts have') + ' no email address.') + (p.ending ? ' Asking the people whose implied consent ends soon to say yes keeps them on the newsletter.' : '') + '</p>' +
      '<div class="w160h4">Sent in ' + E(d.label) + '</div>' +
      (em.sent ? rpRows([['Emails sent', rpNum(em.sent), 1, ''], ['Delivered', rpNum(em.delivered), em.delivered / em.sent, ''], ['Opened', rpNum(em.opened), em.opened / em.sent, rpPct(em.opened, em.sent)],
        ['Clicked', rpNum(em.clicked), em.clicked / em.sent, rpPct(em.clicked, em.sent)], ['Unsubscribed', rpNum(em.unsubscribed), em.unsubscribed / em.sent, '']]) +
        '<p class="w160note">' + E(plural(em.from_campaigns, 'email', 'emails') + ' from ' + plural(em.campaigns, 'campaign', 'campaigns') + ', ' + plural(em.from_automations, 'email', 'emails') + ' from automations.') + '</p>'
        : '<p class="m">No email has gone out from the Hub in ' + E(d.label) + ' (test emails are left out).</p>') +
      '<div class="w160h4">Form answers in ' + E(d.label) + '</div>' + rpRows(frows, 'No form answer yet (the CRM’s forms are new in wave156).') + '</section>';
  }
  function rpNotesHtml(d) {
    return '<section class="w154card wide"><h3>' + I('note') + ' How it is counted</h3><p class="w160note">' + E([
      'A fiscal year runs from 1 October to 30 September; ' + d.label + ' began on ' + fmtDay(d.from) + '.',
      d.in_progress ? 'While a year is running, it is compared with the year before at the same date (' + fmtDay(((d.gifts || {}).prev_to_date || {}).through) + ').' : '',
      'A gift counts on the day it was received. A serving is someone confirmed on the roster of a completed event in MTL volunteering, the old website’s events included.',
      'A first-time donor gave for the first time in the year; a retained donor gave in both years; a donor who came back after a gap last gave before the year before.',
      'Someone on two volunteer records counts twice until the records are merged in Possible duplicates.',
      'The numbers follow what the CRM holds today: a gift or a roster added later changes them.'].filter(Boolean).join(' ')) + '</p></section>';
  }

  function paintReports(root) {
    var head = statsHtml(S.contacts || []) + tabsHtml();
    var d = rpGet();
    if (!d) {
      if (RP.err) { root.innerHTML = head + '<div class="w152empty">' + I('alert') + ' The report could not be made (' + E(RP.err) + '). <button class="w152mini" data-w160reload="1">Try again</button>' + (RP.fy != null ? ' <button class="w152mini" data-w152go="#crm/reports">This year</button>' : '') + '</div>'; return; }
      root.innerHTML = head + busy('Working out the report…');
      if (!RP.busy) rpLoad(RP.fy).then(function () { if (S.ui.tab === 'reports') paint(); });
      return;
    }
    var g = d.gifts || {}, dn = d.donors || {}, v = d.volunteers || {};
    var pg = (d.in_progress ? g.prev_to_date : g.prev) || {}, pv = (d.in_progress ? v.prev_to_date : v.prev) || {};
    var pwhen = d.in_progress ? d.prev_label + ' at this point' : d.prev_label;
    var years = (d.years || [d.fy]).map(Number);
    var sum = rpSummary(d);
    root.innerHTML = head +
      '<div class="w160rep" data-w160fyshown="' + E(d.fy) + '">' +
      '<div class="w152bar w160top w160noprint"><select class="w152sel" data-w160fy aria-label="Fiscal year">' + years.map(function (y) {
        return '<option value="' + y + '"' + (y === Number(d.fy) ? ' selected' : '') + '>Fiscal year ' + E(rpLabel(y)) + (y === years[0] ? ' (this year)' : '') + '</option>';
      }).join('') + '</select>' +
      '<button class="w152btn" data-w160copy="1">' + I('copy') + ' Copy the summary</button><button class="w152btn ghost" data-w160print="1">' + I('print') + ' Print</button>' +
      '<button class="w152mini" data-w160reload="1" title="Work the numbers out again">' + I('refresh') + ' Refresh</button>' +
      '<span class="w160asof">Figures as of ' + E(fmtDay(d.today)) + (d.at ? ', ' + E(new Date(d.at).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' })) : '') + '</span></div>' +
      '<h2 class="w160title">Fiscal year ' + E(d.label) + (d.in_progress ? ' <span>so far, to ' + E(fmtDay(d.through)) + '</span>' : '') + '</h2>' +
      '<div class="w152stats w160stats">' +
      '<div class="w152st"><b>' + E(money(g.total || 0)) + '</b><span>raised in ' + E(plural(g.count || 0, 'gift', 'gifts')) + ' (' + E(pwhen) + ': ' + E(money(pg.total || 0)) + ')</span></div>' +
      '<div class="w152st"><b>' + rpNum(dn.this_year) + '</b><span>donors, ' + rpNum(dn.new) + ' new (' + E(pwhen) + ': ' + rpNum(pg.donors) + ')</span></div>' +
      '<div class="w152st"><b>' + rpNum(v.people) + '</b><span>volunteers served, ' + rpNum(v.new) + ' for the first time (' + E(pwhen) + ': ' + rpNum(pv.people) + ')</span></div>' +
      '<div class="w152st"><b>' + rpNum(v.servings) + '</b><span>servings at ' + E(plural(v.events || 0, 'event', 'events')) + ' (' + E(pwhen) + ': ' + rpNum(pv.servings) + ')</span></div></div>' +
      '<div class="w154grid w160grid">' +
      '<section class="w154card wide w160sum"><h3>' + I('note') + ' The year in a few lines <span class="m">ready for the board</span></h3>' + sum.map(function (s) { return '<p>' + E(s) + '</p>'; }).join('') + '</section>' +
      rpGiftsHtml(d) + rpSizesHtml(d) + rpDonorsHtml(d) + rpMailHtml(d) + rpVolHtml(d) + rpNotesHtml(d) + '</div></div>';
  }
  function rpMakeList() {
    var d = rpGet(); if (!d || RP.listing) return;
    var ids = ((d.donors || {}).lapsed_list || []).map(function (x) { return Number(x.contact_id); }).filter(function (x) { return x && contact(x); });
    if (!ids.length) { RP.msg = 'Nobody to put on a list.'; paint(); return; }
    var name = 'Gave in ' + d.prev_label + ', not ' + (d.in_progress ? 'yet ' : '') + 'in ' + d.label;
    var row = { name: name, description: 'Donors who gave in ' + d.prev_label + ' and had not given in ' + d.label + ' on ' + fmtDay(d.today) + ' (made in Reports).', kind: 'static',
      filter: { groups: [] }, member_ids: ids, created_by: actor(), updated_by: actor(), updated_at: new Date().toISOString() };
    RP.listing = true; RP.msg = ''; paint();
    Promise.resolve(db.from('crm_lists').insert(row).select().single()).then(function (r) {
      RP.listing = false;
      if (r && r.error) RP.msg = 'Not saved: ' + (r.error.message || r.error);
      else { RP.msg = '“' + name + '” saved as a fixed list of ' + plural(ids.length, 'person', 'people') + '.'; S.at.lists = 0; }
      if (S.ui.tab === 'reports') paint();
    }, function (e) { RP.listing = false; RP.msg = 'Not saved: ' + ((e && e.message) || e); if (S.ui.tab === 'reports') paint(); });
  }

  /* ---------- styles ---------- */
  var css160 = document.createElement('style'); css160.id = 'w160css';
  css160.textContent = ''
    + '.w160top{align-items:center;}.w160top .w152sel{flex:0 1 260px;max-width:280px;}.w160asof{font-size:12.5px;color:var(--wa-muted,' + MUTED + ');margin-left:auto;}'
    + '.w160title{font-family:' + HEAD + ';font-size:30px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--wa-green,' + GREEN + ');margin:6px 0 12px;}.w160title span{font-family:' + BODY + ';font-size:14px;font-weight:500;text-transform:none;letter-spacing:0;color:var(--wa-muted,' + MUTED + ');}'
    + '.w160stats{margin-bottom:16px;}.w160stats .w152st{cursor:default;}.w160stats .w152st span{line-height:1.35;}'
    + '.w160sum p{font-size:15px;line-height:1.6;margin:0 0 8px;}'
    + '.w160ch{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px;align-items:end;height:150px;padding-top:6px;border-bottom:1px solid rgba(16,63,57,.18);}'
    + '.w160col{height:100%;min-width:0;display:flex;}.w160bars{flex:1;display:flex;align-items:flex-end;justify-content:center;gap:2px;}'
    + '.w160bars i{display:block;width:42%;max-width:18px;border-radius:4px 4px 0 0;}.w160bars i.c,.w160lg i.c{background:' + GREEN + ';}.w160bars i.p,.w160lg i.p{background:rgba(220,165,39,.6);}'
    + '.w160ml{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px;font-size:11px;color:var(--wa-muted,' + MUTED + ');text-align:center;margin-top:4px;}'
    + '.w160lg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;color:var(--wa-muted,' + MUTED + ');margin-top:8px;}.w160lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px;}'
    + '.w160ret{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px;}.w160ret>div{background:rgba(16,63,57,.05);border-radius:12px;padding:10px 12px;min-width:0;}'
    + '.w160ret b{display:block;font-family:' + HEAD + ';font-size:28px;font-weight:600;color:var(--wa-green,' + GREEN + ');line-height:1.05;}.w160ret span{display:block;font-size:12.5px;line-height:1.3;color:var(--wa-muted,' + MUTED + ');}'
    + '.w160h4{font-weight:700;font-size:12.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--wa-green,' + GREEN + ');margin:14px 0 4px;}'
    + '.w160rows{display:flex;flex-direction:column;}.w160r{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(40px,.8fr) auto;gap:10px;align-items:center;padding:7px 0;border-bottom:1px dashed rgba(16,63,57,.12);font-size:13.5px;}'
    + '.w160r .k{min-width:0;overflow:hidden;text-overflow:ellipsis;}.w160r .k a{color:inherit;font-weight:600;}.w160r .bar{height:8px;border-radius:4px;background:rgba(16,63,57,.08);overflow:hidden;}.w160r .bar i{display:block;height:100%;background:' + TEAL + ';border-radius:4px;}'
    + '.w160r .v{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600;}.w160lap .w160r{grid-template-columns:minmax(0,1fr) 0 auto;}'
    + '.w160note{font-size:12.5px;line-height:1.55;color:var(--wa-muted,' + MUTED + ');margin:10px 0 0;}.w160note a{color:inherit;font-weight:600;}'
    + '@media (max-width:700px){.w160ret{grid-template-columns:repeat(2,minmax(0,1fr));}.w160ch{height:120px;gap:3px;}.w160ml{gap:3px;font-size:10px;}.w160asof{margin-left:0;flex:1 1 100%;}.w160title{font-size:24px;}.w160r{grid-template-columns:minmax(0,1.5fr) minmax(30px,.6fr) auto;}}'
    + '@media print{body *{visibility:hidden !important;}.w160rep,.w160rep *{visibility:visible !important;}.w160rep{position:absolute;left:0;top:0;width:100%;}.w160noprint{display:none !important;}.w160rep .w154card{box-shadow:none;border:1px solid rgba(16,63,57,.2);break-inside:avoid;}}';
  document.head.appendChild(css160);

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest || !t.closest('.w160rep, .w152root')) return;
    if ((el = t.closest('[data-w160copy]'))) { e.preventDefault(); var d = rpGet(); if (d) copy('Fiscal year ' + d.label + (d.in_progress ? ', to ' + fmtDay(d.through) : '') + '\n\n' + rpSummary(d).join('\n\n')); return; }
    if ((el = t.closest('[data-w160print]'))) { e.preventDefault(); try { window.print(); } catch (x) { /* fine */ } return; }
    if ((el = t.closest('[data-w160reload]'))) { e.preventDefault(); RP.err = ''; RP.msg = ''; rpLoad(RP.fy, true).then(function () { if (S.ui.tab === 'reports') paint(); }); paint(); return; }
    if ((el = t.closest('[data-w160lapsed]'))) { e.preventDefault(); RP.showLapsed = true; paint(); return; }
    if ((el = t.closest('[data-w160list]'))) { e.preventDefault(); rpMakeList(); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-w160fy')) return;
    var y = Number(t.value), d = rpGet(), cur = d && d.years && d.years.length ? Number(d.years[0]) : null;
    go(y === cur ? '#crm/reports' : '#crm/reports/' + y);
  });
