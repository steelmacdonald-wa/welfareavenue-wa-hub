
  /* ---------- the monthly report (printable) ---------- */
  function repMonth() { var m = /^\d{4}-\d{2}$/.test(S.sub) ? S.sub : (S.reportMonth || today().slice(0, 7)); S.reportMonth = m; return m; }
  function monthAdd(m, n) { var d = new Date(m + '-15T12:00:00'); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); }
  function monthName(m) { try { return new Date(m + '-15T12:00:00').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }); } catch (e) { return m; } }
  function engOf(sp) { return Number(sp.engagement || (Number(sp.likes || 0) + Number(sp.comments || 0) + Number(sp.shares || 0) + Number(sp.saves || 0))); }
  function monthStats(m) {
    var inM = function (iso) { return iso && dayOf(iso).slice(0, 7) === m; };
    var out = posts().filter(function (p) { return inM(p.published_at || p.scheduled_at) && (['published', 'posted'].indexOf(p.status) >= 0 || Object.keys(p.results || {}).some(function (k) { return p.results[k] && (p.results[k].id || p.results[k].posted_at); })); });
    var sp = S.social.filter(function (x) { return inM(x.published_at) && PORDER.indexOf(x.platform) >= 0; });
    var per = {}; PORDER.forEach(function (k) { per[k] = { posts: 0, reach: 0, eng: 0, likes: 0, comments: 0, shares: 0, n: 0 }; });
    sp.forEach(function (x) { var r = per[x.platform]; r.n++; r.reach += Number(x.reach || x.views || 0); r.eng += engOf(x); r.likes += Number(x.likes || 0); r.comments += Number(x.comments || 0); r.shares += Number(x.shares || 0); });
    out.forEach(function (p) { (p.platforms || []).forEach(function (k) { if (per[k]) per[k].posts++; }); });
    var reach = 0, eng = 0; PORDER.forEach(function (k) { reach += per[k].reach; eng += per[k].eng; });
    var tags = {}; out.forEach(function (p) { (p.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var cms = S.comments.filter(function (c) { return !c.from_us && inM(c.commented_at); });
    var answered = cms.filter(function (c) { return c.status === 'resolved' || S.comments.some(function (k) { return k.from_us && k.platform === c.platform && k.parent_external_id === c.external_id; }); }).length;
    return { posts: out, social: sp, per: per, reach: reach, eng: eng, rate: reach ? eng / reach : NaN, tags: tags, comments: cms.length, answered: answered, top: sp.slice().sort(function (a, b) { return engOf(b) - engOf(a); }).slice(0, 5) };
  }
  function delta(a, b) { if (!isFinite(a) || !isFinite(b) || !b) return ''; var d = (a - b) / b; return '<em class="' + (d >= 0 ? 'ok' : 'bad') + '" style="font-style:normal;font-size:11.5px;font-weight:700;color:' + (d >= 0 ? TEAL : FLAG) + '">' + (d >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(d * 100)) + '% on ' + E(monthName(monthAdd(S.reportMonth, -1)).split(' ')[0]) + '</em>'; }
  function weeksIn(m) { var out = [], d = mondayOf(m + '-01'); while (d.slice(0, 7) <= m) { if (addDays(d, 6).slice(0, 7) >= m && addDays(d, 6) < today()) out.push(d); d = addDays(d, 7); } return out; }
  function goalWeeks(m) {
    var g = goals(), any = PORDER.some(function (k) { return Number(g[k] || 0) > 0; }); if (!any) return null;
    var wk = weeksIn(m), met = 0;
    wk.forEach(function (w) { var off = Math.round((new Date(w + 'T12:00:00') - new Date(mondayOf(today()) + 'T12:00:00')) / (7 * 86400000)); var gs = goalStatus(off), ok = true; PORDER.forEach(function (k) { if (gs[k].goal > 0 && gs[k].n < gs[k].goal) ok = false; }); if (ok) met++; });
    return { met: met, of: wk.length };
  }
  function reportClicks(m) {
    var key = 'clicks-' + m; if (S.keys[key]) return S.keys[key];
    S.keys[key] = { loading: true, n: null };
    var a = m + '-01T00:00:00', b = monthAdd(m, 1) + '-01T00:00:00';
    q(db.from('short_link_clicks').select('id', { count: 'exact', head: true }).gte('at', new Date(a).toISOString()).lt('at', new Date(b).toISOString())).then(function (r) { S.keys[key] = { n: r.count == null ? null : r.count }; if (S.sec === 'report') paint(); });
    return S.keys[key];
  }
  function reportHtml() {
    var m = repMonth(), st = monthStats(m), prev = monthStats(monthAdd(m, -1)), gw = goalWeeks(m), cl = reportClicks(m), cur = today().slice(0, 7);
    var note = S.keys['note-' + m] || '';
    var bar = '<div class="row noprint" style="margin:0 0 12px"><a class="btn225 sm" data-w225go="#studio/report/' + monthAdd(m, -1) + '">‹ ' + E(monthName(monthAdd(m, -1))) + '</a>' + (m < cur ? '<a class="btn225 sm" data-w225go="#studio/report/' + monthAdd(m, 1) + '">' + E(monthName(monthAdd(m, 1))) + ' ›</a>' : '') + '<span class="sp"></span><a class="btn225 sm" data-w225rcopy="1">' + I('copy') + ' Copy a summary</a><a class="btn225 sm pri" data-w225print="1">' + I('print') + ' Print or save as PDF</a></div>';
    var k = function (v, l, d) { return '<div class="kpi"><b>' + v + '</b><span>' + E(l) + '</span>' + (d || '') + '</div>'; };
    var kpis = '<div class="kpis">' + k(st.posts.length, 'posts out', delta(st.posts.length, prev.posts.length)) + k(st.reach ? num(st.reach) : '–', 'reach and views', delta(st.reach, prev.reach)) + k(st.eng ? num(st.eng) : '–', 'likes, comments, shares, saves', delta(st.eng, prev.eng)) + k(pct(st.rate), 'engagement over reach') +
      k(cl.n == null ? '–' : num(cl.n), 'link clicks') + k(st.comments ? Math.round(st.answered / st.comments * 100) + '%' : '–', 'comments answered', '<em>' + st.comments + ' comments</em>') + (gw ? k(gw.met + '/' + gw.of, 'weeks every goal met') : '') + '</div>';
    var rows = PORDER.filter(function (x) { return st.per[x].posts || st.per[x].n; }).map(function (x) { var r = st.per[x]; return '<tr><td>' + mark(x) + E(PLX[x][0]) + '</td><td>' + r.posts + '</td><td>' + (r.reach ? num(r.reach) : '–') + '</td><td>' + num(r.likes) + '</td><td>' + num(r.comments) + '</td><td>' + num(r.shares) + '</td><td>' + (r.reach ? pct(r.eng / r.reach) : '–') + '</td></tr>'; }).join('');
    var table = '<h4>By platform</h4>' + (rows ? '<table style="width:100%;border-collapse:collapse;font-size:12.5px" class="rt"><thead><tr style="text-align:left;color:' + MUTED + '"><th>Platform</th><th>Posts</th><th>Reach</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Rate</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p class="muted">Nothing went out this month.</p>');
    var top = '<h4>The best posts</h4>' + (st.top.length ? st.top.map(function (x, i) { var u = x.thumb_cached || x.thumb_url; return '<div class="pl" style="cursor:default">' + (u ? '<img src="' + E(u) + '" alt="">' : '<div class="ph"></div>') + '<div style="min-width:0"><b><span style="font-family:' + HEAD + ';color:' + GOLD + ';margin-right:6px">' + (i + 1) + '</span>' + E(clip(x.caption || 'A post', 90)) + '</b><small>' + mark(x.platform) + ' ' + E(niceDate(dayOf(x.published_at), { month: 'short', day: 'numeric' })) + ' · ' + num(x.reach || x.views || 0) + ' reach · ' + num(engOf(x)) + ' engagements</small></div></div>'; }).join('') : '<p class="muted">No results yet for this month.</p>');
    var tg = Object.keys(st.tags).sort(function (a, b) { return st.tags[b] - st.tags[a]; });
    var tags = tg.length ? '<h4>Themes</h4><div class="row" style="gap:6px">' + tg.map(function (t) { var g = tagsAll().filter(function (x) { return x.name === t; })[0]; return '<span class="pill"><span class="tagdot" style="background:' + E(g && g.color || PURPLE) + '"></span> ' + E(t) + ' · ' + st.tags[t] + '</span>'; }).join('') + '</div>' : '';
    var notes = '<h4>What we learned</h4><textarea data-w225rnote="' + m + '" rows="3" class="noprint" style="width:100%" placeholder="A line or two for the board or the team (kept until you leave the page)">' + E(note) + '</textarea>' + (note ? '<p class="printonly" style="white-space:pre-wrap;font-size:13px">' + E(note) + '</p>' : '');
    return bar + '<div class="rep"><div class="row"><div><h2>Content report, ' + E(monthName(m)) + '</h2><span class="muted">Welfare Avenue · Instagram, Facebook, Threads, LinkedIn, TikTok and YouTube · made ' + E(niceDate(today(), { month: 'long', day: 'numeric', year: 'numeric' })) + '</span></div></div><div class="band"></div>' + kpis + '<div class="grid2"><div>' + top + '</div><div>' + table + tags + '</div></div>' + notes +
      '<p class="muted" style="margin:14px 0 0;font-size:11px">Reach and engagement come from the platforms (Analytics); posts out come from the Content Studio. Link clicks count the hub.welfareavenue.com/l short links. Change against the month before where both have numbers.</p></div>';
  }
  function reportSummary() {
    var m = repMonth(), st = monthStats(m), cl = reportClicks(m);
    var by = PORDER.filter(function (k) { return st.per[k].posts; }).map(function (k) { return PLX[k][0] + ' ' + st.per[k].posts; }).join(', ');
    return 'Content, ' + monthName(m) + ': ' + st.posts.length + ' posts out' + (by ? ' (' + by + ')' : '') + '; ' + num(st.reach) + ' reach and views; ' + num(st.eng) + ' engagements (' + pct(st.rate) + ' of reach)' + (cl.n != null ? '; ' + num(cl.n) + ' link clicks' : '') + (st.comments ? '; ' + st.answered + ' of ' + st.comments + ' comments answered' : '') + '.' + (st.top[0] ? ' Best post: ' + clip(st.top[0].caption || 'a post', 80) + ' on ' + PLX[st.top[0].platform][0] + ' (' + num(engOf(st.top[0])) + ' engagements).' : '') + (S.keys['note-' + m] ? '\n' + S.keys['note-' + m] : '');
  }
  function printReport() {
    document.body.classList.add('w225print');
    var done = function () { document.body.classList.remove('w225print'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { try { window.print(); } catch (e) { done(); } }, 60);
  }
