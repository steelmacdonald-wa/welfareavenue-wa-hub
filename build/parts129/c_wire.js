
  /* ---------- paint into the Analytics page, after wave120's own content ---------- */
  var HOST = null;
  function host() {
    var wrap = document.querySelector('#socialstats .w120wrap'); if (!wrap) return null;
    if (!HOST) { HOST = document.createElement('div'); HOST.id = 'w129'; }
    if (HOST.parentNode !== wrap || wrap.lastElementChild !== HOST) wrap.appendChild(HOST);
    return HOST;
  }
  function paint() {
    watch();
    var d = data(); if (!d || !(d.accounts || []).length) { if (HOST) { HOST.innerHTML = ''; HOST.__h = ''; } return; }
    var h = host(); if (!h) return;
    var html = explorerHtml(d) + audienceHtml(d) + coverageHtml(d);
    if (h.__h !== html) {
      var focus = document.activeElement && document.activeElement.matches && document.activeElement.matches('#w129 [data-w129q]') ? document.activeElement.selectionStart : null;
      h.innerHTML = html; h.__h = html;
      if (focus != null) { var q = h.querySelector('[data-w129q]'); if (q) { q.focus(); try { q.setSelectionRange(focus, focus); } catch (e) { /* fine */ } } }
    }
  }
  var paintT = null;
  function soon() { clearTimeout(paintT); paintT = setTimeout(paint, 30); }
  /* wave120 rewrites its section on every paint: put the same block straight back (a microtask, before the browser draws), so nothing flickers */
  function watch() {
    var sec = document.getElementById('socialstats'); if (!sec || sec.__w129) return;
    sec.__w129 = true;
    try { new MutationObserver(function () { var d = data(); if (d && (d.accounts || []).length && HOST && HOST.__h) host(); soon(); }).observe(sec, { childList: true }); } catch (e) { /* fine */ }
  }
  document.addEventListener('w120:data', function () { X.show = 25; soon(); });

  /* ---------- history, one step at a time ---------- */
  async function runBackfill(ids) {
    if (X.run || !window.w120) return;
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      X.run = { id: id, text: 'Starting…', pct: 2 }; paint();
      for (var step = 0; step < 40; step++) {
        var r = null;
        try { r = await window.w120.fn({ action: 'backfill', account_id: id, budget: 40 }); } catch (e) { r = { ok: false, error: e.message || String(e) }; }
        if (!r || r.ok === false) { toastS('History stopped: ' + String((r && r.error) || 'no answer').slice(0, 80)); break; }
        var back = r.daily_from || r.totals_from;
        var covered = back ? Math.round((Date.now() - new Date(back + 'T12:00:00Z').getTime()) / 86400000) : 0;
        X.run.pct = Math.min(99, covered / 730 * 100);
        X.run.text = (back ? 'Back to ' + day(back) : 'Working') + (r.posts ? ', ' + num(r.posts) + ' more posts this step' : '') + (r.done ? '. Done.' : '…');
        paint();
        if (r.done) break;
      }
    }
    X.run = null;
    try { await window.w120.reload(); } catch (e) { /* fine */ }
    toastS('The history is loaded');
  }

  /* LinkedIn: the follower total today, and the year rebuilt from the daily new followers */
  async function setLinkedIn(id) {
    var inp = document.getElementById('w129li'); var n = Math.round(Number(inp && inp.value));
    if (!(n > 0)) { toastS('Type the follower total shown on the LinkedIn page'); return; }
    X.liTotal = String(n); X.busy.li = true; paint();
    try {
      var r = await db.from('social_daily').select('day,value').eq('platform', 'linkedin').eq('metric', 'new_followers').order('day', { ascending: false }).limit(1000);
      var rows = [], cum = 0, today = (window.w120 && window.w120.dates ? window.w120.dates()[1] : new Date().toISOString().slice(0, 10));
      rows.push({ day: today, metric: 'followers', value: n });
      ((r && r.data) || []).forEach(function (x) { if (String(x.day) < today) rows.push({ day: String(x.day), metric: 'followers', value: n - cum }); cum += Number(x.value) || 0; });
      await window.w120.fn({ action: 'import_csv', platform: 'linkedin', rows: rows });
      toastS('LinkedIn: ' + num(n) + ' followers, and the year rebuilt');
      await window.w120.reload();
    } catch (e) { toastS('Could not save it: ' + (e.message || e)); }
    X.busy.li = false; paint();
  }
  async function checkWhatsApp() {
    X.busy.wa = true; paint();
    try { var r = await window.w120.fn({ action: 'probe' }); X.wa = (r && r.whatsapp) || { ok: false, error: 'No answer' }; }
    catch (e) { X.wa = { ok: false, error: e.message || String(e) }; }
    X.busy.wa = false; paint();
  }
  async function csvDaily() {
    var d = data(); if (!d) return;
    X.busy.csvd = true; paint();
    try {
      var out = [['platform', 'day', 'metric', 'value']], from = d.from, to = d.to;
      for (var i = 0; i < 40; i++) {
        var q = db.from('social_daily').select('platform,day,metric,value').lte('day', to).order('day', { ascending: true }).order('platform').range(i * 1000, i * 1000 + 999);
        if (from) q = q.gte('day', from);
        var r = await q; var rows = (r && r.data) || [];
        rows.forEach(function (x) { out.push([x.platform, x.day, x.metric, x.value]); });
        if (rows.length < 1000) break;
      }
      download('welfare-avenue-analytics-daily-' + (from || 'start') + '-to-' + to + '.csv', out);
    } catch (e) { toastS('Could not build the file'); }
    X.busy.csvd = false; paint();
  }
  function csvPosts() {
    var d = data(); if (!d) return;
    var rows = explorerRows(d);
    var out = [['platform', 'published', 'type', 'caption', 'link', 'reach', 'views', 'likes', 'comments', 'shares', 'saves', 'clicks', 'engagements', 'engagement rate']];
    rows.forEach(function (p) { var r = rateOf(p); out.push([p.platform, String(p.published_at || '').slice(0, 10), kindOf(p), String(p.caption || '').replace(/\s+/g, ' '), p.url || '', p.reach, p.views, p.likes, p.comments, p.shares, p.saves, p.clicks, engOf(p), r == null ? '' : (r * 100).toFixed(2) + '%']); });
    download('welfare-avenue-posts-' + (d.from || 'start') + '-to-' + d.to + '.csv', out);
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w129')) return;
    var el;
    if ((el = t.closest('[data-w129plat]'))) { X.plat = el.getAttribute('data-w129plat'); X.show = 25; paint(); return; }
    if ((el = t.closest('[data-w129sort]'))) { var k = el.getAttribute('data-w129sort'); if (X.sort === k) X.dir = -X.dir; else { X.sort = k; X.dir = -1; } paint(); return; }
    if ((el = t.closest('[data-w129more]'))) { X.show += 50; paint(); return; }
    if ((el = t.closest('[data-w129csvp]'))) { csvPosts(); return; }
    if ((el = t.closest('[data-w129csvd]'))) { csvDaily(); return; }
    if ((el = t.closest('[data-w129aud]'))) { X.aud = el.getAttribute('data-w129aud'); paint(); return; }
    if ((el = t.closest('[data-w129back]'))) { runBackfill([Number(el.getAttribute('data-w129back'))]); return; }
    if ((el = t.closest('[data-w129all]'))) { var d = data(); runBackfill(((d && d.accounts) || []).filter(function (a) { return canBack(a) && !histDone(a); }).map(function (a) { return a.id; })); return; }
    if ((el = t.closest('[data-w129li]'))) { setLinkedIn(Number(el.getAttribute('data-w129li'))); return; }
    if ((el = t.closest('[data-w129wa]'))) { checkWhatsApp(); return; }
  });
  var qT = null;
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.matches) return;
    if (t.matches('#w129 [data-w129q]')) { clearTimeout(qT); var v = t.value; qT = setTimeout(function () { X.q = v; X.show = 25; paint(); }, 200); return; }
    if (t.matches('#w129li')) { X.liTotal = t.value; return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.matches) return;
    if (t.matches('#w129 [data-w129kind]')) { X.kind = t.value; X.show = 25; paint(); }
    if (t.matches('#w129 [data-w129ss]')) { var sv = String(t.value).split('|'); X.sort = sv[0]; X.dir = Number(sv[1]) || -1; paint(); }
  });

  /* ---------- the page tour ---------- */
  function tour() {
    try {
      var W = window.w122; if (!W || !W.tours || !W.tours.socialstats || W.tours.socialstats.__w129) return;
      var st = W.tours.socialstats.steps, OPT = { opt: 1 };
      var S2 = function (sel, tt, p) { return { s: sel, t: tt, p: p, opt: 1 }; };
      st.forEach(function (x) { if (x.s === '#socialstats .w120ctl') x.p = 'Look at the last week, month or quarter, six months, one or two years, all time, or pick two dates. Long ranges chart by week or by month.'; if (x.s === '#socialstats .cardy.chart') { x.t = 'Over time'; x.p = 'The numbers per platform by day, week or month. Switch the measure at the top of the chart.'; } if (x.s === '#socialstats .posts') x.p = 'The posts in the range, ranked by what worked.'; });
      st.push(S2('#w129 .w129tbl', 'Every post', 'Every post in the range with its reach, views, likes, comments, shares, saves and engagement rate. Filter, search, sort any column, and download it.'));
      st.push(S2('#w129 .w129aud', 'Who follows us', 'Instagram followers by age, gender, city and country, and LinkedIn followers and visitors by industry, seniority, function, location and company size.'));
      st.push(S2('#w129 .w129cov', 'How far back', 'How far back each platform goes. Meta keeps two years of daily numbers; posts go back to the first one. Download the daily numbers here.'));
      W.tours.socialstats.__w129 = true;
    } catch (e) { /* fine */ }
  }
  tour();
  if (typeof showPanel === 'function') {
    var __sp129 = showPanel;
    showPanel = function (id) { var out = __sp129.apply(this, arguments); try { if (id === 'socialstats') { watch(); setTimeout(paint, 60); } } catch (e) { /* fine */ } return out; };
  }
  if (typeof startApp === 'function') {
    var __sa129 = startApp;
    startApp = async function () { var out = await __sa129.apply(this, arguments); try { tour(); watch(); } catch (e) { /* fine */ } return out; };
  }
  window.w129 = { paint: paint, state: function () { return X; }, rows: function () { var d = data(); return d ? explorerRows(d) : []; } };
})();
