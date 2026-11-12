-- 12/11/26 - wave310 release: Microsoft Clarity in the Content Studio's Results > Website (heat map buttons, the Clarity card).
-- One transaction: if any check fails, nothing changes. Made against the live Hub page a52ac4e9d394fa7e1c2667b6df574f6b.
create table if not exists public.site_files_bak_wa310 (path text, part int, content text, updated_at timestamptz);
alter table public.site_files_bak_wa310 enable row level security;
revoke all on public.site_files_bak_wa310 from anon, authenticated;
grant all on public.site_files_bak_wa310 to service_role;
comment on table public.site_files_bak_wa310 is 'wave310 (12/11/26): the Hub page before wave310, for its undo. Drop after a week.';
do $bk$ begin
  if not exists (select 1 from public.site_files_bak_wa310) then
    insert into public.site_files_bak_wa310 select path, part, content, updated_at from public.site_files where path = 'index.html';
  end if;
end $bk$;
do $pg$
declare v text; v_new text; n int; i int; sz int; o text; nw text;
  olds text[] := array[$o310$  function web() {
$o310$,
    $o310$'<button type="button" class="btn" data-w306fresh="1" aria-label="Read again from Google Analytics">'$o310$,
    $o310$+ '</span><span class="vl"></span></div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr)$o310$,
    $o310$+ doCard + clickCard + depthCard + whoCard + popCard +$o310$,
    $o310$ Visitors are counted only when they accept cookies on the site.</p>';$o310$];
  news text[] := array[$n310$  /* ---------- wave310 (12/11/26): Microsoft Clarity, heat maps and visit recordings (project zbcoohovt6) ----------
     The numbers come from clarity-insights (one row a day in clarity_daily, filled by cron wa-clarity-pull once
     CLARITY_TOKEN is in the Vault). The heat maps themselves live in Clarity: the buttons open them, page by page. */
  IC.heat = '<path d="M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.6-2.6-5.3-3.4-8.8-1.9 1.2-2.6 3.3-2.6 4.6-1.3-.6-2.2-2.2-2.2-4.1C7.6 8.2 5.5 11 5.5 14.8 5.5 18.4 8.1 21 12 21z"/>';
  IC.play = '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>';
  var CLA = { id: 'zbcoohovt6', site: 'https://welfareavenue.com', data: {}, busy: {}, err: {}, at: {} };
  function clDate(days) { return days <= 3 ? 'Last 3 days' : days <= 7 ? 'Last 7 days' : 'Last 30 days'; }
  function clFilter(path) { var p = String(path || '/').split('?')[0]; return '2;6;^' + (CLA.site + p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\?.*)?$'; }
  function clUrl(view, path, days) {
    var q = 'date=' + encodeURIComponent(clDate(days || WEB.range));
    if (view === 'heatmaps') q += '&heatmapDeviceType=0&heatmapType=0';
    if (path) q += '&URL=' + encodeURIComponent(clFilter(path));
    return 'https://clarity.microsoft.com/projects/view/' + CLA.id + '/' + view + '?' + q;
  }
  function clLinks(path) {
    return '<span class="cl-links"><a href="' + E(clUrl('heatmaps', path)) + '" target="_blank" rel="noopener" title="Open the heat map for ' + E(pageName(path)) + ' in Clarity">' + ic('heat') + 'Heat map</a>'
      + '<a href="' + E(clUrl('recordings', path)) + '" target="_blank" rel="noopener" title="Watch visits to ' + E(pageName(path)) + ' in Clarity">' + ic('play') + 'Recordings</a></span>';
  }
  function loadClarity(days) {
    var k = String(days);
    if (CLA.busy[k] || (CLA.at[k] && Date.now() - CLA.at[k] < 300000)) return;
    CLA.at[k] = Date.now();
    var w = W2(); if (!(w && w.x && w.x.fn)) return;
    CLA.busy[k] = w.x.fn('clarity-insights', { action: 'summary', days: days }).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || 'No answer');
      CLA.data[k] = j; CLA.err[k] = null;
    }).catch(function (e) { CLA.err[k] = (e && e.message) || String(e); }).then(function () { CLA.busy[k] = null; repaint('web'); });
  }
  function clv(m, metric, field) { var x = m && m[metric]; var v = x ? Number(x[field]) : NaN; return isFinite(v) ? v : 0; }
  function clarityCard() {
    var k = String(WEB.range), d = CLA.data[k];
    loadClarity(WEB.range);
    var open = '<a class="btn" href="' + E(clUrl('heatmaps')) + '" target="_blank" rel="noopener">' + ic('heat').replace('<svg', '<svg width="15" height="15"') + 'Open heat maps</a>';
    var head = '<h3>Heat maps and recordings<span class="sp"></span><small>Microsoft Clarity</small></h3>';
    var how = '<p class="muted sm" style="margin:10px 0 0">A <b>rage click</b> is tapping the same spot again and again; a <b>dead click</b> is a tap that does nothing; a <b>quick back</b> is leaving a page within seconds. Each one marks a spot worth a look on the heat map.</p>';
    if (!d) {
      var why = CLA.err[k] ? '<div class="empty">The Clarity numbers could not load (' + E(clip(CLA.err[k], 120)) + '). The heat maps still open in Clarity.</div>' : '<div class="empty" aria-busy="true">Reading Clarity…</div>';
      return '<div class="card cl310">' + head + why + '<div class="cl-open">' + open + '</div></div>';
    }
    if (!d.connected || !d.day_count) {
      var msg = !d.connected
        ? 'Clarity’s numbers show here once its data link is switched on (Clarity, Settings, Data export: a token Steel adds to the Hub). The heat maps and recordings already work: open them below, or from any page in “How far people read”.'
        : 'Clarity is connected. Its first daily numbers arrive tomorrow morning; the heat maps and recordings already work.';
      return '<div class="card cl310">' + head + '<div class="empty">' + msg + '</div><div class="cl-open">' + open + '</div>' + how + '</div>';
    }
    var o = d.overall || {}, visits = clv(o, 'Traffic', 'totalSessionCount');
    var hero = function (label, val, sub) { return '<div><span>' + label + '</span><b class="tnum">' + val + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var share = function (metric) { var s = clv(o, metric, 'sessionsWithMetricPercentage'); return s ? Math.round(s) + '% of visits' : ''; };
    var stats = '<div class="cl-stats">'
      + hero('Visits recorded', num(visits), clv(o, 'Traffic', 'totalBotSessionCount') ? num(clv(o, 'Traffic', 'totalBotSessionCount')) + ' bots left out' : '')
      + hero('Read down the page', clv(o, 'ScrollDepth', 'averageScrollDepth') ? Math.round(clv(o, 'ScrollDepth', 'averageScrollDepth')) + '%' : '–', 'on average')
      + hero('Rage clicks', num(clv(o, 'RageClickCount', 'subTotal')), share('RageClickCount'))
      + hero('Dead clicks', num(clv(o, 'DeadClickCount', 'subTotal')), share('DeadClickCount'))
      + hero('Quick backs', num(clv(o, 'QuickbackClick', 'subTotal')), share('QuickbackClick'))
      + hero('Time active', clv(o, 'EngagementTime', 'activeTime') && visits ? Math.round(clv(o, 'EngagementTime', 'activeTime') / Math.max(1, visits)) + ' s' : '–', 'per visit')
      + '</div>';
    var pages = Object.keys(d.pages || {}).map(function (p) {
      var m = d.pages[p]; return { p: p, v: clv(m, 'Traffic', 'totalSessionCount'), sd: clv(m, 'ScrollDepth', 'averageScrollDepth'),
        fr: clv(m, 'RageClickCount', 'subTotal') + clv(m, 'DeadClickCount', 'subTotal') + clv(m, 'QuickbackClick', 'subTotal') };
    }).filter(function (x) { return x.v > 0 && /^\//.test(x.p); }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    var rows = pages.map(function (x) {
      var flag = x.v >= 3 && x.fr / x.v >= 0.3 ? '<span class="tag bad">people get stuck</span>' : '';
      return '<tr><td>' + E(pageName(x.p)) + flag + '<small>' + clLinks(x.p) + '</small></td><td class="tnum">' + num(x.v) + '</td><td class="tnum">' + (x.sd ? Math.round(x.sd) + '%' : '–') + '</td><td class="tnum">' + num(x.fr) + '</td></tr>';
    }).join('');
    var table = rows ? '<table class="t"><thead><tr><th>Page</th><th>Visits</th><th>Read</th><th title="Rage clicks, dead clicks and quick backs">Stuck</th></tr></thead><tbody>' + rows + '</tbody></table>' : '';
    var since = d.day_count < WEB.range ? '<p class="muted sm" style="margin:8px 0 0">Clarity numbers start ' + E(d.from) + ' (' + num(d.day_count) + (d.day_count === 1 ? ' day' : ' days') + ' so far).</p>' : '';
    return '<div class="card cl310">' + head + stats + table + since + '<div class="cl-open">' + open + '</div>' + how + '</div>';
  }
  (function () {
    var css = '.w306 .cl-links{display:inline-flex;gap:12px;margin-left:0;}.w306 .cl-links a{display:inline-flex;align-items:center;gap:4px;color:' + ROSE + ';font-weight:600;text-decoration:none;}'
      + '.w306 .cl-links a svg{width:13px;height:13px;}@media (hover:hover) and (pointer:fine){.w306 .cl-links a:hover{text-decoration:underline;}}'
      + '.w306 .cl-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px;}'
      + '.w306 .cl-stats>div{background:rgba(16,63,57,.04);border-radius:12px;padding:10px 11px;}.w306 .cl-stats span{display:block;font-size:12px;color:' + MUTED + ';}'
      + '.w306 .cl-stats b{display:block;font:700 19px/1.2 inherit;color:' + GREEN + ';margin-top:2px;}.w306 .cl-stats small{display:block;font-size:11.5px;color:' + MUTED + ';}'
      + '.w306 .cl-open{margin-top:12px;}.w306 td small .cl-links{margin-top:3px;}'
      + '@media (max-width:640px){.w306 .cl-stats{grid-template-columns:repeat(2,minmax(0,1fr));}}';
    var st = document.createElement('style'); st.id = 'w310css'; st.textContent = css; (document.head || document.documentElement).appendChild(st);
  })();
  function web() {
$n310$,
    $n310$'<a class="btn" href="' + E(clUrl('heatmaps')) + '" target="_blank" rel="noopener" title="Where people click and how far they scroll, in Microsoft Clarity">' + ic('heat').replace('<svg', '<svg width="15" height="15"') + 'Heat maps</a>' + '<button type="button" class="btn" data-w306fresh="1" aria-label="Read again from Google Analytics">'$n310$,
    $n310$+ '</span><span class="vl"></span></div>' + '<div class="sm" style="margin-top:4px">' + clLinks(x.pg) + '</div>' +   /* wave310 */
        '<div style="display:grid;grid-template-columns:repeat(4,1fr)$n310$,
    $n310$+ doCard + clickCard + depthCard + clarityCard() + whoCard + popCard +$n310$,
    $n310$ Visitors are counted only when they accept cookies on the site. Heat maps and recordings: Microsoft Clarity.</p>';$n310$];
begin
  select string_agg(content, '' order by part) into v from public.site_files where path = 'index.html';
  if v is null then raise exception 'index.html not found'; end if;
  if position('wave310 (12/11/26): Microsoft Clarity' in v) > 0 then raise exception 'index.html already has wave310'; end if;
  if md5(v) <> 'a52ac4e9d394fa7e1c2667b6df574f6b' then raise notice 'index.html has moved since this file was made (md5 %): the edits apply only if each still matches once', md5(v); end if;
  v_new := v;
  for i in 1..array_length(olds, 1) loop
    o := olds[i]; nw := news[i];
    n := (length(v_new) - length(replace(v_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'index.html: edit % matches % times, nothing changed', i, n; end if;
    v_new := replace(v_new, o, nw);
  end loop;
  if md5(v) = 'a52ac4e9d394fa7e1c2667b6df574f6b' and md5(v_new) <> '21a6e9ffa4fae13d91549d9aa79a730b' then raise exception 'index.html: unexpected result %', md5(v_new); end if;
  if right(v_new, 8) <> E'</html>\n' then raise exception 'index.html: tail mismatch'; end if;
  sz := ceil(length(v_new) / 10.0);
  for i in 1..10 loop
    update public.site_files set content = substr(v_new, (i - 1) * sz + 1, sz), updated_at = now() where path = 'index.html' and part = i;
    if not found then raise exception 'index.html part % missing', i; end if;
  end loop;
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') <> md5(v_new) then raise exception 'index.html: post-check failed'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave310', md5(v), md5(v_new) || ': Microsoft Clarity in Results > Website: a Heat maps button, Heat map and Recordings links per page, the Clarity card (clarity-insights)', 'Claude for Steel (12/11/26)');
end $pg$;
select public.call_edge('host-sync', '{}'::jsonb) as host_sync,
  (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') as hub_md5;
