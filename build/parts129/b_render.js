
  /* ---------- how far back each platform goes ---------- */
  function histDone(a) { var h = (a.meta && a.meta.history) || {}; if (a.platform === 'instagram') return !!(h.daily_done && h.totals_done && h.posts_done); return !!(h.daily_done && h.posts_done); }
  function canBack(a) { return a && (a.platform === 'facebook' || a.platform === 'instagram' || a.platform === 'ga4') && a.status !== 'csv'; }
  function coverageHtml(d) {
    var accs = d.accounts || [], cov = d.coverage || {};
    var rows = ['instagram', 'facebook', 'linkedin', 'tiktok', 'ga4'].map(function (p) {
      var a = accs.filter(function (x) { return x.platform === p; })[0];
      if (!a) return p === 'tiktok' ? '<div class="r">' + mk(p) + '<b>' + E(label(p)) + '</b><span class="m">Not connected. TikTok’s analytics API needs an approval first; its CSV export works in Set up.</span><span class="act"><span class="st off">Not connected</span></span></div>' : '';
      var c = cov[p] || {}, h = (a.meta && a.meta.history) || {};
      var running = X.run && X.run.id === a.id;
      var st = a.status === 'csv' ? '<span class="st csv">From the export</span>' : running ? '<span class="st run">Loading…</span>' : histDone(a) ? '<span class="st">All the history</span>' : h.started_at ? '<span class="st run">Partly loaded</span>' : '<span class="st off">Recent only</span>';
      var m = c.from ? '<em>Daily numbers</em> since ' + E(day(c.from)) + ' (' + num(c.days) + ' days)' : 'No daily numbers yet';
      m += c.posts ? ' · <em>' + num(c.posts) + (p === 'ga4' ? ' pages' : ' posts') + '</em>' + (c.posts_from && p !== 'ga4' ? ' since ' + E(monthY(c.posts_from)) : '') : '';
      if (p === 'instagram' || p === 'facebook') m += '<br>Meta keeps two years of daily numbers' + (p === 'facebook' ? '; posts go back to the start of the Page.' : '; posts and reels go back to the first one.');
      if (p === 'linkedin') m += '<br>LinkedIn’s export covers the last year. A new export extends it.';
      if (p === 'ga4') m += '<br>The website keeps what Google Analytics collected since the property started.';
      if (running && X.run.text) m += '<div class="w129bar"><i style="width:' + Math.max(4, Math.min(100, X.run.pct || 0)).toFixed(0) + '%"></i></div><span style="font-size:11.5px">' + E(X.run.text) + '</span>';
      var act = st;
      if (staff() && canBack(a) && !histDone(a)) act += '<button class="w129btn ghost" data-w129back="' + a.id + '"' + (X.run ? ' disabled' : '') + '>Load more history</button>';
      if (staff() && p === 'linkedin') act += '<input type="number" min="0" id="w129li" placeholder="Followers now" value="' + E(X.liTotal) + '"><button class="w129btn ghost" data-w129li="' + a.id + '"' + (X.busy.li ? ' disabled' : '') + '>' + (X.busy.li ? 'Saving…' : 'Set the total') + '</button>';
      return '<div class="r">' + mk(p) + '<b>' + E(label(p)) + (a.handle ? ' <span style="font-weight:500;color:var(--wa-muted)">@' + E(a.handle) + '</span>' : '') + '</b><span class="m">' + m + '</span><span class="act">' + act + '</span></div>';
    }).join('');
    var wa = X.wa;
    var waMsg = wa ? (wa.ok ? 'Readable: ' + num(wa.analytics && wa.analytics.sent) + ' messages sent in the last 30 days.' : (wa.wabas && wa.wabas.length ? 'A WhatsApp Business account is shared (' + E(wa.wabas[0].name || wa.wabas[0].id) + ') but its numbers are not readable yet.' : (wa.has_permission ? 'The token can read WhatsApp, but no WhatsApp Business account is shared with the Hub’s system user. In Meta Business settings: Accounts > WhatsApp accounts > your account > Assign people > the system user. If Welfare Avenue uses the WhatsApp Business app on a phone, it has no analytics API; the WhatsApp Business Platform does.' : E(wa.next || wa.error || '')))) : 'Message numbers can join once a WhatsApp Business account is shared with the Hub’s system user in Meta Business settings.';
    rows += '<div class="r">' + mk('whatsapp') + '<b>WhatsApp</b><span class="m">' + waMsg + '</span><span class="act"><span class="st off">' + (wa && wa.ok ? 'Readable' : 'Not shared') + '</span>' + (staff() ? '<button class="w129btn ghost" data-w129wa="1"' + (X.busy.wa ? ' disabled' : '') + '>' + (X.busy.wa ? 'Checking…' : 'Check') + '</button>' : '') + '</span></div>';
    var todo = (d.accounts || []).filter(function (a) { return canBack(a) && !histDone(a); });
    return '<div class="cardy"><h4>How far back <span class="sub">each platform, and what it keeps</span></h4><div class="w129cov">' + rows + '</div>'
      + '<div class="w129foot"><span>Pick <b>All time</b> or <b>2 years</b> above to see all of it.</span><span class="sp"></span>'
      + (staff() && todo.length ? '<button class="w129btn" data-w129all="1"' + (X.run ? ' disabled' : '') + '>Load all the history</button>' : '')
      + '<button class="w129btn ghost" data-w129csvd="1"' + (X.busy.csvd ? ' disabled' : '') + '>' + (X.busy.csvd ? 'Preparing…' : 'Download the daily numbers (CSV)') + '</button></div></div>';
  }

  /* ---------- every post ---------- */
  function kindOf(p) { var k = String(p.kind || 'post').toLowerCase(); if (/reel/.test(k)) return 'reel'; if (/video/.test(k)) return 'video'; if (/carousel|album/.test(k)) return 'carousel'; if (/story/.test(k)) return 'story'; if (/image|photo/.test(k)) return 'image'; return k === 'feed' ? 'post' : k; }
  function explorerRows(d) {
    var q = X.q.toLowerCase();
    var rows = (d.posts_all || []).filter(function (p) { return (!X.plat || p.platform === X.plat) && (!X.kind || kindOf(p) === X.kind) && (!q || String(p.caption || '').toLowerCase().indexOf(q) >= 0); });
    var key = X.sort, dir = X.dir;
    rows.sort(function (a, b) {
      var va = key === 'rate' ? rateOf(a) : key === 'engagement' ? engOf(a) : key === 'published_at' ? String(a.published_at || '') : a[key];
      var vb = key === 'rate' ? rateOf(b) : key === 'engagement' ? engOf(b) : key === 'published_at' ? String(b.published_at || '') : b[key];
      if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
    return rows;
  }
  function explorerHtml(d) {
    var all = d.posts_all || [];
    var plats = []; all.forEach(function (p) { if (plats.indexOf(p.platform) < 0) plats.push(p.platform); });
    var kinds = []; all.forEach(function (p) { var k = kindOf(p); if (kinds.indexOf(k) < 0) kinds.push(k); });
    var rows = explorerRows(d);
    var tot = { reach: 0, views: 0, eng: 0 }; rows.forEach(function (p) { tot.reach += Number(p.reach) || 0; tot.views += Number(p.views) || 0; tot.eng += engOf(p) || 0; });
    var h = '<div class="cardy"><h4>Every post <span class="sub">' + E(window.w120 ? window.w120.label() : '') + '</span><span class="sp"></span><button class="w129btn ghost" data-w129csvp="1"' + (rows.length ? '' : ' disabled') + '>Download these posts (CSV)</button></h4>'
      + '<div class="w129tools"><span class="chips"><a data-w129plat=""' + (X.plat ? '' : ' class="on"') + '>All</a>' + plats.map(function (p) { return '<a data-w129plat="' + E(p) + '"' + (X.plat === p ? ' class="on"' : '') + '>' + E(label(p)) + '</a>'; }).join('') + '</span>'
      + '<select data-w129kind><option value="">Every type</option>' + kinds.sort().map(function (k) { return '<option value="' + E(k) + '"' + (X.kind === k ? ' selected' : '') + '>' + E(k.charAt(0).toUpperCase() + k.slice(1) + 's') + '</option>'; }).join('') + '</select>'
      + '<select class="w129ss" data-w129ss aria-label="Sort">' + '<option value="published_at|-1"' + (X.sort + '|' + X.dir === 'published_at|-1' ? ' selected' : '') + '>Newest first</option>' + '<option value="published_at|1"' + (X.sort + '|' + X.dir === 'published_at|1' ? ' selected' : '') + '>Oldest first</option>' + '<option value="reach|-1"' + (X.sort + '|' + X.dir === 'reach|-1' ? ' selected' : '') + '>Most reach</option>' + '<option value="views|-1"' + (X.sort + '|' + X.dir === 'views|-1' ? ' selected' : '') + '>Most views</option>' + '<option value="engagement|-1"' + (X.sort + '|' + X.dir === 'engagement|-1' ? ' selected' : '') + '>Most engaged</option>' + '<option value="rate|-1"' + (X.sort + '|' + X.dir === 'rate|-1' ? ' selected' : '') + '>Best engagement rate</option>' + '</select>'
      + '<input type="search" data-w129q placeholder="Search the captions" value="' + E(X.q) + '"></div>';
    if (!rows.length) return h + '<p style="font-size:13px;color:var(--wa-muted);margin:0">' + (all.length ? 'No post matches.' : 'No posts in this range yet.') + '</p></div>';
    h += '<div class="w129sum"><span><b>' + num(rows.length) + '</b>posts</span><span><b>' + num(tot.reach) + '</b>reach</span><span><b>' + num(tot.views) + '</b>views</span><span><b>' + num(tot.eng) + '</b>engagements</span>' + (tot.reach ? '<span><b>' + (tot.eng / tot.reach * 100).toFixed(1) + '%</b>engaged per reach</span>' : '') + '</div>';
    h += '<div class="w129wrap"><table class="w129tbl"><thead><tr><th class="l' + (X.sort === 'published_at' ? ' on' : '') + '" data-w129sort="published_at">Post' + (X.sort === 'published_at' ? (X.dir < 0 ? ' ↓' : ' ↑') : '') + '</th>'
      + COLS.slice(1).map(function (c) { return '<th data-w129sort="' + c[0] + '"' + (X.sort === c[0] ? ' class="on"' : '') + ' title="' + (c[0] === 'rate' ? 'Engagements divided by reach (or views)' : c[0] === 'engagement' ? 'Likes, comments, shares and saves' : '') + '">' + E(c[1]) + (X.sort === c[0] ? (X.dir < 0 ? ' ↓' : ' ↑') : '') + '</th>'; }).join('') + '</tr></thead><tbody>';
    h += rows.slice(0, X.show).map(function (p) {
      var r = rateOf(p);
      var cell = function (v, l, k) { return '<td data-l="' + l + '"' + (k ? ' class="k"' : '') + '>' + (v == null || v === '' ? '<span style="color:var(--wa-muted)">–</span>' : num(v)) + '</td>'; };
      return '<tr><td class="p"><a ' + (p.url ? 'href="' + E(p.url) + '" target="_blank" rel="noopener"' : '') + '><div class="in">' + (p.thumb_url ? '<img src="' + E(p.thumb_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ph">' + mk(p.platform) + '</span>') + '<div><div class="cap">' + (p.caption ? E(p.caption) : '<span style="color:var(--wa-muted)">No caption</span>') + '</div><div class="mt">' + mk(p.platform) + E(day(p.published_at)) + ' · ' + E(kindOf(p)) + '</div></div></div></a></td>'
        + cell(p.reach, 'Reach', 1) + cell(p.views, 'Views', 1) + cell(p.likes, 'Likes') + cell(p.comments, 'Comments') + cell(p.shares, 'Shares') + cell(p.saves, 'Saves') + cell(p.clicks, 'Clicks') + cell(engOf(p), 'Engaged', 1) + '<td class="rt k" data-l="Rate">' + (r == null ? '<span style="color:var(--wa-muted)">–</span>' : '<b>' + (r * 100).toFixed(1) + '%</b>') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    if (rows.length > X.show) h += '<div class="w129foot"><button class="w129btn ghost" data-w129more="1">Show ' + Math.min(50, rows.length - X.show) + ' more</button><span>' + num(rows.length - X.show) + ' more posts</span></div>';
    return h + '</div>';
  }

  /* ---------- the audience ---------- */
  var RN = null;
  function country(c) { try { RN = RN || new Intl.DisplayNames(['en'], { type: 'region' }); return RN.of(String(c).toUpperCase()) || c; } catch (e) { return c; } }
  function lead(x) { var m = /\d+/.exec(String(x)); return m ? Number(m[0]) : 1e9; }
  /* one breakdown: the top rows as bars, each as a share of everyone counted (or the follower total when it is larger) */
  function bars(title, pairs, color, note, max, o) {
    o = o || {};
    var all = (pairs || []).filter(function (x) { return x && x[0] != null && Number(x[1]) > 0; });
    if (!all.length) return '';
    var sum = all.reduce(function (s, x) { return s + Number(x[1]); }, 0), den = Math.max(sum, Number(o.total) || 0);
    var list = o.order ? all.slice().sort(function (a, b) { return lead(a[0]) - lead(b[0]); }) : all.slice().sort(function (a, b) { return Number(b[1]) - Number(a[1]); });
    list = list.slice(0, max || 8);
    var top = Math.max.apply(null, list.map(function (x) { return Number(x[1]) || 0; })) || 1;
    return '<div class="b" style="--c:' + color + '"><h5>' + title + '</h5>' + list.map(function (x) {
      var nm = o.name ? o.name(x[0]) : x[0], pct = den ? Number(x[1]) / den * 100 : 0;
      return '<div class="row"><div class="t"><span title="' + E(nm) + '">' + E(nm) + '</span><i style="width:' + Math.max(3, Number(x[1]) / top * 100).toFixed(1) + '%"></i></div><b title="' + E(num(x[1])) + '">' + (pct > 0 && pct < 1 ? pct.toFixed(1) : Math.round(pct)) + '%</b></div>';
    }).join('') + (note ? '<p class="w129note">' + note + '</p>' : '') + '</div>';
  }
  function audienceHtml(d) {
    var accs = d.accounts || [];
    var ig = accs.filter(function (a) { return a.platform === 'instagram'; })[0], li = accs.filter(function (a) { return a.platform === 'linkedin'; })[0];
    var igd = ig && ig.meta && ig.meta.demographics && ig.meta.demographics.followers, lid = li && li.meta && li.meta.demographics;
    var parts = '';
    if (igd) {
      var c = PL.instagram[1], asOf = ig.meta.demographics.as_of, igTot = d.followers && d.followers.instagram && Number(d.followers.instagram.now);
      parts += bars(mk('instagram') + 'Followers by age', igd.age, c, null, 8, { order: 1 })
        + bars(mk('instagram') + 'Followers by gender', igd.gender, c, null, 4)
        + bars(mk('instagram') + 'Top cities', igd.city, c, null, 8, { total: igTot })
        + bars(mk('instagram') + 'Top countries', igd.country, c, asOf ? 'Instagram API, ' + E(day(asOf)) + '. Refreshed every week.' : null, 6, { total: igTot, name: country });
    }
    if (lid) {
      var g = lid[X.aud] || lid.followers || {}, lc = PL.linkedin[1], liTot = X.aud === 'visitors' ? 0 : (d.followers && d.followers.linkedin && Number(d.followers.linkedin.now));
      var names = { industry: 'by industry', seniority: 'by seniority', job_function: 'by job function', location: 'by location', company_size: 'by company size' };
      parts += Object.keys(names).map(function (k, i) { return bars(mk('linkedin') + (X.aud === 'visitors' ? 'Page visitors ' : 'Followers ') + names[k], g[k], lc, i === 4 ? 'LinkedIn export' + (lid.period ? ', ' + E(day(lid.period[0])) + ' to ' + E(day(lid.period[1])) : '') + '.' : null, 7, { order: k === 'company_size', total: liTot }); }).join('');
    }
    if (!parts) return '';
    return '<div class="cardy"><h4>Who follows us <span class="sub">the audience each platform shares</span><span class="sp"></span>' + (lid ? '<span class="w129seg"><a data-w129aud="followers"' + (X.aud === 'followers' ? ' class="on"' : '') + '>LinkedIn followers</a><a data-w129aud="visitors"' + (X.aud === 'visitors' ? ' class="on"' : '') + '>LinkedIn visitors</a></span>' : '') + '</h4>'
      + '<div class="w129aud">' + parts + '</div><p class="w129note" style="margin:10px 0 0">Facebook: Meta stopped sharing Page audience breakdowns (age, gender, city) through its API in 2024; Meta Business Suite still shows them.</p></div>';
  }
