
  /* =====================================================================
     wave262c (20/10/26): Hashtags (#studio/hashtags)
     Kahkashan, 19/10/26 leadership meeting: "one place where we can ... monitor the hashtags, so we can put out a fire before it
     becomes a wildfire" (the OneBagChallenge). Public Instagram posts under the watched hashtags (hashtag-watch, every 30 minutes;
     Check now), each marked by the marketing team: Looks fine, Needs attention, Reported. Instagram only: Facebook and TikTok
     have no hashtag search. Data social_hashtag_watch / social_hashtag_posts, functions wa262_hashtag_set and wa262_hashtag_review.
     ===================================================================== */
  var css262 = document.createElement('style'); css262.id = 'wa262hcss';
  css262.textContent = ''
    + '#w225host .w262tags{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px;}'
    + '#w225host .w262tag{display:inline-flex;align-items:center;gap:6px;background:rgba(180,70,122,.10);color:#7a2c52;border-radius:999px;padding:5px 6px 5px 12px;font-weight:700;font-size:13px;}'
    + '#w225host .w262tag.off{background:rgba(16,63,57,.06);color:' + MUTED + ';}'
    + '#w225host .w262tag button{border:none;background:rgba(255,250,242,.7);border-radius:50%;width:22px;height:22px;cursor:pointer;color:inherit;font-size:13px;line-height:1;}'
    + '#w225host .w262tag small{font-weight:500;color:' + MUTED + ';}'
    + '#w225host .w262add{display:inline-flex;gap:6px;align-items:center;}'
    + '#w225host .w262add input{font:inherit;font-size:13px;padding:6px 10px;border:1px solid rgba(16,63,57,.2);border-radius:999px;background:' + CREAM + ';width:180px;}'
    + '#w225host .w262post{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;padding:12px 4px;border-top:1px solid rgba(16,63,57,.07);}'
    + '#w225host .w262post:first-child{border-top:0;}'
    + '#w225host .w262post.flagged{background:rgba(179,64,47,.06);border-radius:12px;padding:12px 10px;}'
    + '#w225host .w262post .cap{font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word;}'
    + '#w225host .w262post .meta{font-size:12px;color:' + MUTED + ';display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;}'
    + '#w225host .w262post .acts{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;justify-content:flex-end;}'
    + '#w225host .w262st{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;border-radius:999px;padding:2px 8px;}'
    + '#w225host .w262st.new{background:rgba(220,165,39,.2);color:#6b4b00;}#w225host .w262st.ok{background:rgba(42,140,122,.12);color:#1c6b5d;}'
    + '#w225host .w262st.flagged{background:rgba(179,64,47,.14);color:#8a2f22;}#w225host .w262st.reported{background:rgba(16,63,57,.10);color:' + GREEN + ';}'
    + '#w225host .w262post .acts .btn225.on{background:' + GREEN + ';color:' + CREAM + ';border-color:' + GREEN + ';}'
    + '@media (max-width:700px){#w225host .w262post{grid-template-columns:1fr;}#w225host .w262post .acts{justify-content:flex-start;}}';
  document.head.appendChild(css262);
  var M262 = { loaded: 0, tags: [], posts: [], f: lsGet('w262hf') || 'new', tag: '', busy: {}, err: '' };
  async function load262(force) {
    if (M262.loaded && !force && Date.now() - M262.loaded < 60000) return;
    try {
      var a = await db.from('social_hashtag_watch').select('id, tag, active, added_by, added_at, last_checked_at, last_error').order('tag');
      if (a.error) throw a.error;
      var b = await db.from('social_hashtag_posts').select('id, tag, media_id, permalink, media_type, caption, posted_at, like_count, comments_count, source, first_seen_at, status, reviewed_by, reviewed_at, note').order('posted_at', { ascending: false }).limit(400);
      if (b.error) throw b.error;
      M262.tags = a.data || []; M262.posts = b.data || []; M262.err = '';
    } catch (e) { M262.err = (e && e.message) || String(e); }
    M262.loaded = Date.now();
  }
  function counts262() { return M262.posts.filter(function (p) { return p.status === 'new' || p.status === 'flagged'; }).length || null; }
  var HST = { new: 'New', ok: 'Looks fine', flagged: 'Needs attention', reported: 'Reported' };
  function hashtagsHtml() {
    if (!S.mk && !S.pub) return '<div class="card"><div class="empty">Hashtags are for the marketing team and admins.</div></div>';
    if (!M262.loaded) { load262().then(paint); return '<div class="card"><div class="empty">Loading the hashtags…</div></div>'; }
    if (M262.err) return '<div class="card"><div class="empty">The hashtag watch is not set up yet (' + E(clip(M262.err, 120)) + ').</div></div>';
    var act = M262.tags.filter(function (t) { return t.active; });
    var last = act.map(function (t) { return t.last_checked_at; }).filter(Boolean).sort().pop();
    var all = M262.posts.filter(function (p) { return !M262.tag || p.tag === M262.tag; });
    var c = { new: 0, flagged: 0, ok: 0, reported: 0, all: all.length }; all.forEach(function (p) { c[p.status] = (c[p.status] || 0) + 1; });
    var head = '<div class="kpis"><div class="kpi"><b class="' + (c.new ? 'warn' : 'ok') + '">' + c.new + '</b><span>new, not looked at</span></div>' +
      '<div class="kpi"><b class="' + (c.flagged ? 'warn' : '') + '">' + c.flagged + '</b><span>need attention</span></div>' +
      '<div class="kpi"><b>' + c.reported + '</b><span>reported</span></div>' +
      '<div class="kpi"><b style="font-size:18px">' + E(last ? ago(last) : 'never') + '</b><span>last check</span><em><a data-w262hsync="1" style="cursor:pointer;color:' + ROSE + ';font-weight:700">' + (M262.busy.sync ? 'Checking…' : 'Check now') + '</a></em></div></div>';
    var tags = '<div class="w262tags">' + M262.tags.map(function (t) {
      return '<span class="w262tag' + (t.active ? '' : ' off') + '" title="' + E(t.last_error ? 'Last check failed: ' + t.last_error : (t.active ? 'Watched' : 'Not watched')) + '"><a data-w262htag="' + E(t.tag) + '" style="cursor:pointer">#' + E(t.tag) + '</a>' + (t.last_error ? ' <small>check failed</small>' : '') +
        '<button type="button" data-w262hon="' + E(t.tag) + '|' + (t.active ? '0' : '1') + '" aria-label="' + (t.active ? 'Stop watching #' : 'Watch #') + E(t.tag) + '" title="' + (t.active ? 'Stop watching' : 'Watch again') + '">' + (t.active ? '&times;' : '+') + '</button></span>';
    }).join('') + '<span class="w262add"><input type="text" data-w262hq placeholder="#hashtag to watch" aria-label="A hashtag to watch" value="' + E(M262.add || '') + '"><a class="btn225 sm" data-w262hadd="1">' + I('plus') + ' Watch</a></span></div>';
    var filters = '<div class="row" style="margin:0 0 12px"><span class="seg">' + [['new', 'New'], ['flagged', 'Needs attention'], ['ok', 'Looks fine'], ['reported', 'Reported'], ['all', 'All']].map(function (x) { return '<a data-w262hf="' + x[0] + '" class="' + (M262.f === x[0] ? 'on' : '') + '">' + x[1] + '<span class="n">' + (c[x[0]] || 0) + '</span></a>'; }).join('') + '</span>' +
      (M262.tag ? '<span class="sp"></span><a class="btn225 sm" data-w262htag="">#' + E(M262.tag) + ' ' + I('x') + '</a>' : '') + '</div>';
    var list = all.filter(function (p) { return M262.f === 'all' || p.status === M262.f; });
    var rows = list.map(function (p) {
      var btn = function (st, l) { return '<a class="btn225 sm' + (p.status === st ? ' on' : '') + '" data-w262hrev="' + p.id + '|' + st + '"' + (M262.busy['r' + p.id] ? ' disabled' : '') + '>' + l + '</a>'; };
      return '<div class="w262post' + (p.status === 'flagged' ? ' flagged' : '') + '"><div style="min-width:0"><div class="cap">' + E(clip(p.caption || '(no caption)', 400)) + '</div>' +
        '<div class="meta"><span class="w262st ' + E(p.status) + '">' + E(HST[p.status] || p.status) + '</span><span>#' + E(p.tag) + '</span><span>' + E(String(p.media_type || '').toLowerCase().replace('_album', '').replace('carousel', 'carousel')) + '</span>' +
        '<span>posted ' + E(p.posted_at ? ago(p.posted_at) : '?') + '</span><span>' + (p.like_count != null ? E(String(p.like_count)) + ' likes' : '') + (p.comments_count != null ? ', ' + E(String(p.comments_count)) + ' comments' : '') + '</span>' +
        (p.reviewed_by ? '<span>' + E(HST[p.status] || '') + ' by ' + E(String(p.reviewed_by).split('@')[0].replace('.', ' ')) + '</span>' : '') + (p.note ? '<span>' + E(clip(p.note, 120)) + '</span>' : '') + '</div></div>' +
        '<div class="acts">' + (p.permalink ? '<a class="btn225 sm" href="' + E(p.permalink) + '" target="_blank" rel="noopener">' + I('ext') + ' Open on Instagram</a>' : '') + btn('ok', 'Looks fine') + btn('flagged', 'Needs attention') + btn('reported', 'Reported') + '</div></div>';
    }).join('');
    var empty = M262.posts.length ? 'Nothing here.' : (act.length ? 'No public Instagram posts under ' + act.map(function (t) { return '#' + t.tag; }).join(', ') + ' yet. The Hub checks every 30 minutes.' : 'Add a hashtag to watch.');
    var note = '<p class="muted" style="margin:10px 2px 0;font-size:12px">Instagram only: Facebook and TikTok offer no hashtag search, so check those in their apps. Instagram shares public posts from the last 24 hours and its top posts; private accounts never show. To take a post down, open it on Instagram (the three dots, Report) or message the person, then mark it Reported here. Instagram lets us look up 30 different hashtags a week.</p>';
    return head + tags + filters + '<div class="card">' + (rows || '<div class="empty">' + E(empty) + '</div>') + '</div>' + note;
  }
  async function sync262() {
    M262.busy.sync = true; paint();
    try { var r = await fn('hashtag-watch', { action: 'sync' }); var n = ((r && r.tags) || []).reduce(function (s, t) { return s + (t.added || 0); }, 0); toastS(n ? n + (n === 1 ? ' new post' : ' new posts') + ' found' : 'Checked: nothing new'); }
    catch (x) { toastS('Could not check: ' + (x.message || x)); }
    M262.busy.sync = false; await load262(true); paint(); try { if (window.w153) window.w153.paint(); } catch (e) { /* fine */ }
  }
  async function setTag262(tag, on) {
    try { var r = await db.rpc('wa262_hashtag_set', { p_tag: tag, p_active: on }); if (r.error) throw r.error; M262.add = ''; toastS(on ? 'Watching #' + (r.data && r.data.tag || tag) + '. The first check runs now.' : 'Stopped watching #' + tag); }
    catch (x) { toastS(x.message || String(x)); return; }
    await load262(true); paint();
    if (on) sync262();
  }
  async function review262(id, st) {
    M262.busy['r' + id] = true; paint();
    try { var r = await db.rpc('wa262_hashtag_review', { p_id: Number(id), p_status: st, p_note: null }); if (r.error) throw r.error; M262.posts.forEach(function (p) { if (String(p.id) === String(id)) { p.status = st; p.reviewed_by = myEmail(); } }); }
    catch (x) { toastS(x.message || String(x)); }
    delete M262.busy['r' + id]; paint(); try { if (window.w153) window.w153.paint(); } catch (e) { /* fine */ }
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!inApp(t)) return;
    var el = t.closest('[data-w262hsync],[data-w262hon],[data-w262hadd],[data-w262hf],[data-w262htag],[data-w262hrev]'); if (!el) return;
    if (el.hasAttribute('disabled')) { e.preventDefault(); return; }
    var x;
    if (el.hasAttribute('data-w262hsync')) { if (!M262.busy.sync) sync262(); return; }
    if ((x = el.getAttribute('data-w262hon'))) { var p = x.split('|'); setTag262(p[0], p[1] === '1'); return; }
    if (el.hasAttribute('data-w262hadd')) { var inp = document.querySelector('#w225host [data-w262hq]'); var v = inp ? inp.value : ''; if (!String(v).replace(/[^A-Za-z0-9_]/g, '')) { toastS('Type a hashtag first'); return; } setTag262(v, true); return; }
    if (el.hasAttribute('data-w262hf')) { M262.f = el.getAttribute('data-w262hf') || 'new'; lsSet('w262hf', M262.f); paint(); return; }
    if (el.hasAttribute('data-w262htag')) { M262.tag = el.getAttribute('data-w262htag') || ''; paint(); return; }
    if ((x = el.getAttribute('data-w262hrev'))) { var q = x.split('|'); review262(q[0], q[1]); return; }
  });
  document.addEventListener('input', function (e) { var i = e.target && e.target.closest && e.target.closest('#w225host [data-w262hq]'); if (i) M262.add = i.value; });
  document.addEventListener('keydown', function (e) { if (e.key !== 'Enter') return; var i = e.target && e.target.closest && e.target.closest('#w225host [data-w262hq]'); if (!i) return; e.preventDefault(); if (String(i.value).replace(/[^A-Za-z0-9_]/g, '')) setTag262(i.value, true); });
