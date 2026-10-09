/* =====================================================================
   WA v225 the Content Studio (09/10/26)
   =====================================================================
   Steel (09/10/26), after the Buffer comparison: "Okay go ahead and build it entirely on the content calendar. Make it the
   most sophisticated content calendar possible. Consider making it an app in the hub." His choices: an app of its own
   (the calendar and the analytics move in and leave the Hub menu); marketing leads and admins publish, everyone else sends
   a post for approval; the marketing team and admins answer comments (deleting is leads and admins); LinkedIn, TikTok and
   YouTube by the reminder flow until their connections are approved.

   - The app (parts153 APPS.studio): Overview, Calendar (wave121, its composer rebuilt by the patches in parts225), Queue and
     schedule, Approvals, Comments, Library, Links and link in bio, Analytics (wave120), Report, Connections.
   - One page 'studio' with its sections by address: #studio, #studio/queue, #studio/approvals, #studio/inbox,
     #studio/library[/templates|hashtags|replies|tags], #studio/links[/bio], #studio/report[/YYYY-MM], #studio/connections.
   - Data: content_posts (wave121, wave225 columns), content_tags, content_snippets, content_slots, short_links,
     short_link_clicks, social_comments, hub_settings content_studio and link_page (through studio_settings_save), and
     studio_connections (social-connect). Functions: social-publish v3, social-inbox, social-connect, go.
   ===================================================================== */
(function () {
  if (window.__wa225) return; window.__wa225 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#797773', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB', ROSE = '#B4467A';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var HUB = 'https://hub.welfareavenue.com';
  var SECTIONS = ['overview', 'queue', 'approvals', 'inbox', 'library', 'links', 'report', 'connections'];
  var SECT = {
    overview: ['Content Studio', 'The week ahead, what waits for you, and how the content is doing.'],
    queue: ['Queue and schedule', 'When each platform posts, the free slots in the next two weeks, and the weekly goals.'],
    approvals: ['Approvals', 'Posts waiting for a marketing lead or an admin, and the ones sent back.'],
    inbox: ['Comments', 'Every comment on our posts, in one place. Reply, hide, resolve.'],
    library: ['Library', 'Templates, hashtag groups, saved replies and tags the whole team shares.'],
    links: ['Links and link in bio', 'Short links that count clicks, and the page behind the link in our bio.'],
    report: ['Report', 'A month of content on one page, ready to print or share.'],
    connections: ['Connections', 'How the Hub posts to each platform, and what to set up next.']
  };
  var PLX = { instagram: ['Instagram', 'IG', '#C13584'], facebook: ['Facebook', 'f', '#1877F2'], threads: ['Threads', '@', '#1F201E'], linkedin: ['LinkedIn', 'in', '#0A66C2'], tiktok: ['TikTok', 'Tk', '#EE1D52'], youtube: ['YouTube', '▶', '#FF0000'] };
  var PORDER = ['instagram', 'facebook', 'threads', 'linkedin', 'tiktok', 'youtube'];
  var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var WDL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var MODE = { direct: ['Direct', TEAL], make: ['Via Make', TEAL], drafts: ['To TikTok drafts', TEAL], reminder: ['Reminder', '#8a5a00'] };

  var P = {
    home: '<path d="M4 11.5 12 4.5l8 7"/><path d="M6.5 10.5V19.5h11v-9"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    chat: '<path d="M4.5 5.5h15v10h-9l-4 3.5v-3.5h-2z"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>', ext: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 13.5v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 6 6.5h4.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>', heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    star: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>', bolt: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z"/>',
    print: '<path d="M7 9V4.5h10V9"/><rect x="4" y="9" width="16" height="7.5" rx="2"/><path d="M7 14h10v5.5H7z"/>', warn: '<path d="M12 4 21 20H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5z"/>',
    plug: '<path d="M9 3.5v5M15 3.5v5"/><path d="M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 17v3.5"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
  };
  function I(n, cls) { return '<svg class="w225i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.star) + '</svg>'; }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function num(v) { v = Number(v); if (!isFinite(v)) return '–'; var a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (a >= 1e4) return Math.round(v / 1e3) + 'k'; if (a >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'; return String(Math.round(v)); }
  function pct(v) { return isFinite(v) ? Math.round(v * 100) + '%' : '–'; }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function addDays(ds, n) { var d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  function dowOf(ds) { return (new Date(ds + 'T12:00:00').getDay() + 6) % 7; }
  function mondayOf(ds) { return addDays(ds, -dowOf(ds)); }
  function dayOf(iso) { return iso ? ymd(new Date(iso)) : null; }
  function hm(iso) { if (!iso) return ''; var d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function niceDate(ds, opts) { try { return new Date(ds + 'T12:00:00').toLocaleDateString('en-CA', opts || { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return ds; } }
  function niceWhen(iso) { if (!iso) return ''; return niceDate(dayOf(iso)) + ', ' + hm(iso); }
  function ago(iso) { if (!iso) return ''; var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; var h = Math.round(m / 60); if (h < 24) return h + ' h ago'; var d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago'; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* fine */ } }
  function q(p) { return Promise.resolve(p).then(function (r) { return r || { data: null }; }, function (e) { return { data: null, error: e }; }); }
  function fn(name, body) { return db.functions.invoke(name, { body: body }).then(function (r) { if (r.error) { var m = r.error.message || String(r.error); try { if (r.error.context && r.error.context.json) return r.error.context.json().then(function (j) { throw new Error((j && j.error) || m); }); } catch (x) { /* below */ } throw new Error(m); } if (r.data && r.data.error) throw new Error(r.data.error); return r.data; }); }
  function copyText(t) { try { if (navigator.clipboard) { navigator.clipboard.writeText(t); toastS('Copied'); return; } } catch (e) { /* below */ } window.prompt('Copy this', t); }
  function mark(k, on) { var x = PLX[k]; if (!x) return ''; return '<i class="w225pm' + (on ? ' ok' : '') + '" style="background:' + x[2] + '" title="' + E(x[0]) + '">' + E(x[1]) + '</i>'; }

  /* ---------- who ---------- */
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function myEmail() { try { return lower((typeof USER !== 'undefined' && USER && USER.email) || ''); } catch (e) { return ''; } }
  function myName() { try { return (typeof USER !== 'undefined' && USER && USER.name) || ''; } catch (e) { return ''; } }
  function members() { try { return ((typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || []).filter(function (m) { return m && m.active !== false && m.name; }); } catch (e) { return []; } }
  function memberByEmail(e) { e = lower(e); return members().filter(function (m) { return lower(m.email) === e; })[0] || null; }
  function role() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function isAdmin() { return role() === 'admin'; }

  /* ---------- state ---------- */
  var S = {
    sec: 'overview', sub: '', loaded: 0, loading: null, err: null, pub: null, mk: null,
    comments: [], links: [], clicks: [], social: [], conn: null, cap: null, settings: {}, linkPage: {}, inboxLast: null,
    f: { inbox: lsGet('w225ib') || 'open', ipl: '', imine: false, iq: '', apr: 'pending', lib: 'templates', lq: '' },
    reply: {}, busy: {}, reportMonth: null, suggest: null, linkSel: null, bioDraft: null, keys: {}
  };
  function W() { return window.w121 || null; }
  function posts() { var w = W(); return w ? w.posts() : []; }
  function cap() { var w = W(); return (w && w.cap()) || S.cap; }
  function tagsAll() { var w = W(); return (w && w.tags()) || []; }
  function lib() { var w = W(); return (w && w.lib()) || []; }
  function slots() { var w = W(); return (w && w.slots()) || []; }
  function modeOf(k) { var w = W(); return w ? w.modeOf(k) : 'reminder'; }
  function stateOf(p) { var w = W(); return w ? w.stateOf(p) : { cls: 'draft', label: p.status, note: '', attn: false, live: {} }; }
  function titleOf(p) { var w = W(); return w ? w.titleOf(p) : (p.title || 'Untitled post'); }
  function thumbOf(p) { var w = W(); return w ? w.thumbOf(p) : null; }
  function goals() { var g = (S.settings && S.settings.goals) || {}; return g; }

  async function loadAll(force) {
    if (S.loading) return S.loading;
    if (!force && S.loaded && Date.now() - S.loaded < 45000) return;
    S.loading = (async function () {
      try {
        var w = W(); if (w) { await w.load(true); if (!w.cap()) await w.loadCap(); await w.studio(); }
        var since90 = new Date(Date.now() - 90 * 86400000).toISOString(), since30 = new Date(Date.now() - 31 * 86400000).toISOString(), since365 = new Date(Date.now() - 365 * 86400000).toISOString();
        var rs = await Promise.all([
          q(db.rpc('wa225_publisher')), q(db.rpc('wa225_marketing')),
          q(db.from('social_comments').select('*').gte('commented_at', since90).order('commented_at', { ascending: false }).limit(1500)),
          q(db.from('short_links').select('*').order('created_at', { ascending: false }).limit(500)),
          q(db.from('short_link_clicks').select('link_id, at, referrer_host, device, country').gte('at', since30).order('at', { ascending: false }).limit(5000)),
          q(db.from('social_posts').select('id, platform, external_id, url, kind, caption, thumb_url, thumb_cached, published_at, reach, views, likes, comments, shares, saves, engagement').gte('published_at', since365).order('published_at', { ascending: false }).limit(1200)),
          q(db.from('hub_settings').select('key, value, updated_at').in('key', ['content_studio', 'link_page', 'studio_inbox_sync']))
        ]);
        S.pub = rs[0].data === true; S.mk = rs[1].data === true;
        S.comments = rs[2].data || []; S.links = rs[3].data || []; S.clicks = rs[4].data || []; S.social = rs[5].data || [];
        (rs[6].data || []).forEach(function (r) { if (r.key === 'content_studio') S.settings = r.value || {}; else if (r.key === 'link_page') S.linkPage = r.value || {}; else if (r.key === 'studio_inbox_sync') S.inboxLast = r.value || null; });
        S.cap = w ? w.cap() : S.cap;
        S.err = null; S.loaded = Date.now();
      } catch (e) { S.err = e.message || String(e); }
      S.loading = null;
      try { if (window.w153 && window.w153.paint) window.w153.paint(); } catch (e) { /* the rail counts */ }
    })();
    return S.loading;
  }
  async function loadConn() { try { S.conn = await fn('social-connect', { action: 'status' }); } catch (e) { S.conn = { error: e.message || String(e) }; } }
  function counts() {
    var pend = posts().filter(function (p) { return p.approval_status === 'pending' && ['draft', 'scheduled', 'failed'].indexOf(p.status) >= 0; }).length;
    var open = S.comments.filter(function (c) { return c.status === 'open' && !c.from_us; }).length;
    return { approvals: pend || null, inbox: open || null };
  }
