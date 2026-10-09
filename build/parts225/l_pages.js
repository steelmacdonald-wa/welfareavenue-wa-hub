
  /* =====================================================================
     wave230 link pages (Steel, 09/10/26): "a linktree section of the studio with the ability to track insights on who
     clicking what link and make it similar to linktree pro but much better". His choices: anonymous insights with no
     cookies, a person named only when they sign up or give; several pages; smart links (schedules, featured, A/B tests,
     fallbacks); sign-up, volunteer and donation blocks; content blocks (Instagram, YouTube, events, impact, English and
     French); a tracked address per source and QR codes; a weekly summary (the linkpage function, Mondays).
     #studio/pages (the pages), #studio/pages/edit/<id>, #studio/pages/insights, #studio/pages/sources, #studio/pages/people.
     Data: link_pages, link_page_sources, link_page_events, wa230_conversions(), short_links (each link button), crm_forms.
     ===================================================================== */
  var LPT = {
    link: ['Link', '🔗', 'A button to any address'],
    form: ['Sign-up form', '📝', 'Volunteer, newsletter or any CRM form; sign-ups are credited to the page'],
    donate: ['Donate', '💛', 'The donation page; gifts are credited to the page'],
    header: ['Heading', '🔠', 'A title between buttons'],
    text: ['Text', '✏️', 'A short paragraph'],
    youtube: ['YouTube video', '▶️', 'Plays on the page'],
    instagram: ['Instagram posts', '📸', 'Our latest posts, as a grid'],
    events: ['Upcoming events', '📅', 'From the website’s events'],
    impact: ['Impact numbers', '📈', 'Up to four big numbers'],
    socials: ['Social icons', '🔗', 'Our profiles as icons']
  };
  var LPTHEMES = { green: ['#103F39', '#FFFAF2', '#DCA527'], cream: ['#FFFAF2', '#103F39', '#DCA527'], gold: ['#DCA527', '#103F39', '#FFFAF2'], purple: ['#6F64AB', '#FFFAF2', '#DCA527'], night: ['#1F201E', '#103F39', '#DCA527'] };
  var SRCNAME = { ig: 'Instagram', fb: 'Facebook', tt: 'TikTok', li: 'LinkedIn', th: 'Threads', yt: 'YouTube', x: 'X', snap: 'Snapchat', website: 'welfareavenue.com', search: 'Search', email: 'Email', web: 'Other sites', direct: 'Direct or typed' };
  var LPTPL = {
    blank: [],
    event: [{ type: 'header', label: 'The event', label_fr: 'L’événement' }, { type: 'link', label: 'Get your ticket', label_fr: 'Réserver ma place', icon: '🎟️', featured: true, url: 'https://welfareavenue.com/' }, { type: 'form', form: 'volunteer', form_fr: 'benevole', label: 'Volunteer at the event', label_fr: 'Être bénévole à l’événement', icon: '🙌' }, { type: 'donate', label: 'Can’t come? Give instead', label_fr: 'Vous ne pouvez pas venir? Donnez', icon: '💛' }, { type: 'instagram', count: 6 }, { type: 'socials' }],
    campaign: [{ type: 'impact', label: 'What your gift does', label_fr: 'Ce que votre don permet', stats: [{ n: '1,000+', label: 'meals a month', label_fr: 'repas par mois' }, { n: '2', label: 'cities', label_fr: 'villes' }] }, { type: 'donate', label: 'Give now', label_fr: 'Donner maintenant', icon: '💛', featured: true }, { type: 'form', form: 'newsletter', label: 'Follow the campaign', label_fr: 'Suivre la campagne', icon: '💌' }, { type: 'socials' }],
    city: [{ type: 'form', form: 'volunteer', form_fr: 'benevole', label: 'Volunteer in the city', label_fr: 'Faire du bénévolat', icon: '🙌', featured: true }, { type: 'events', count: 3 }, { type: 'instagram', count: 6 }, { type: 'socials' }]
  };
  S.lp = { loaded: 0, loading: null, pages: [], sources: [], ev: [], conv: [], forms: [], days: 30, page: 'all', edit: null, open: {}, err: null, busy: {}, prevLang: 'en', prevB: false };

  async function lpLoad(force) {
    var L = S.lp; if (L.loading) return L.loading;
    if (!force && L.loaded && Date.now() - L.loaded < 45000) return;
    L.loading = (async function () {
      try {
        var since = new Date(Date.now() - 92 * 86400000).toISOString();
        var rs = await Promise.all([
          q(db.from('link_pages').select('*').order('id')),
          q(db.from('link_page_sources').select('*').order('id')),
          q(db.from('link_page_events').select('id, page_id, at, kind, block_id, variant, src, src_detail, visitor, repeat_visit, lang, device, os, browser, country, region, city').gte('at', since).eq('is_test', false).order('at', { ascending: false }).limit(40000)),
          q(db.rpc('wa230_conversions', { p_days: 92 })),
          q(db.from('crm_forms').select('slug, title, kind, lang, status').eq('status', 'published').order('title'))
        ]);
        if (rs[0].error) throw rs[0].error;
        L.pages = rs[0].data || []; L.sources = rs[1].data || []; L.ev = rs[2].data || []; L.conv = rs[3].data || []; L.forms = rs[4].data || [];
        L.err = null; L.loaded = Date.now();
      } catch (e) { L.err = e.message || String(e); }
      L.loading = null;
    })();
    return L.loading;
  }
  function lpUrl(p, src) { return HUB + '/links' + (p && p.slug !== 'main' ? '/' + p.slug : '') + (src ? '?s=' + encodeURIComponent(src) : ''); }
  function lpPage(id) { return S.lp.pages.filter(function (p) { return String(p.id) === String(id); })[0] || null; }
  function lpEv(pageId, days) { var since = Date.now() - (days || S.lp.days) * 86400000; return S.lp.ev.filter(function (e) { return (pageId === 'all' || String(e.page_id) === String(pageId)) && new Date(e.at).getTime() >= since; }); }
  function lpConv(pageId, days) { var since = Date.now() - (days || S.lp.days) * 86400000; return S.lp.conv.filter(function (c) { return (pageId === 'all' || String(c.page_id) === String(pageId)) && new Date(c.at).getTime() >= since; }); }
  function uniq(list, key) { var m = {}; list.forEach(function (x) { if (x[key]) m[x[key]] = 1; }); return Object.keys(m).length; }
  function lpStats(ev, conv) {
    var views = ev.filter(function (e) { return e.kind === 'view'; }), clicks = ev.filter(function (e) { return e.kind === 'click'; });
    var vis = uniq(views, 'visitor'), rep = {}; views.forEach(function (e) { if (e.repeat_visit && e.visitor) rep[e.visitor] = 1; });
    var signups = (conv || []).filter(function (c) { return c.kind === 'form'; }).length, gifts = (conv || []).filter(function (c) { return c.kind === 'donation'; }).length;
    return { views: views.length, visitors: vis, repeat: Object.keys(rep).length, clicks: clicks.length, clickers: uniq(clicks, 'visitor'), ctr: views.length ? clicks.length / views.length : NaN, signups: signups, gifts: gifts, gave: (conv || []).filter(function (c) { return c.kind === 'donation' && c.completed; }).length };
  }
  function srcName(code) { var s = S.lp.sources.filter(function (x) { return x.code === code; })[0]; return s ? s.label : (SRCNAME[code] || code || 'Direct'); }
  function blockName(pageId, bid) {
    if (!bid) return 'the page';
    var base = String(bid).replace(/-(\d+|[a-z]+)$/, function (m) { return /^-(\d+)$/.test(m) || /^-(instagram|facebook|tiktok|linkedin|youtube|threads|x)$/.test(m) ? '' : m; });
    var p = lpPage(pageId), b = p && (p.blocks || []).filter(function (x) { return x.id === bid || x.id === base; })[0];
    if (!b) return bid;
    var lab = b.label || (LPT[b.type] ? LPT[b.type][0] : b.type);
    if (b.id !== bid) { var tail = String(bid).slice(b.id.length + 1); lab += /^\d+$/.test(tail) ? ' · post ' + tail : ' · ' + tail; }
    return lab;
  }
  function countBy(list, fnk) { var m = {}; list.forEach(function (x) { var k = fnk(x); if (k == null || k === '') return; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); }
  function bar(v, max, color) { return '<span class="w230bar"><i style="width:' + (max ? Math.max(2, Math.round(v / max * 100)) : 0) + '%;' + (color ? 'background:' + color : '') + '"></i></span>'; }

  /* ---------- the section's tabs ---------- */
  function lpTabs(cur) {
    return '<div class="row" style="margin:0 0 12px"><span class="seg">' + [['', 'Pages'], ['insights', 'Insights'], ['sources', 'Sources and QR codes'], ['people', 'People']].map(function (t) { return '<a data-w225go="#studio/pages' + (t[0] ? '/' + t[0] : '') + '" class="' + (cur === t[0] ? 'on' : '') + '">' + E(t[1]) + '</a>'; }).join('') + '</span><span class="sp"></span>' +
      (cur === 'insights' || cur === 'people' || cur === 'sources' ? '<select data-w230pg aria-label="Page"><option value="all">Every page</option>' + S.lp.pages.filter(function (p) { return p.status !== 'archived'; }).map(function (p) { return '<option value="' + p.id + '"' + (String(S.lp.page) === String(p.id) ? ' selected' : '') + '>' + E(p.title + (p.slug === 'main' ? ' (bio)' : ' · /' + p.slug)) + '</option>'; }).join('') + '</select>' +
        '<span class="seg">' + [7, 30, 90].map(function (d) { return '<a data-w230days="' + d + '" class="' + (S.lp.days === d ? 'on' : '') + '">' + d + ' days</a>'; }).join('') + '</span>' : '') + '</div>';
  }
  function pagesHtml() {
    var L = S.lp;
    if (!L.loaded) { lpLoad().then(paint); return '<div class="card"><div class="empty">Loading the link pages…</div></div>'; }
    if (L.err && !L.pages.length) return '<div class="card"><div class="empty">Could not load the link pages: ' + E(L.err) + '</div></div>';
    if (S.sub === 'edit') return lpEditorHtml();
    if (S.sub === 'insights') return lpTabs('insights') + lpInsightsHtml();
    if (S.sub === 'sources') return lpTabs('sources') + lpSourcesHtml();
    if (S.sub === 'people') return lpTabs('people') + lpPeopleHtml();
    return lpTabs('') + lpListHtml();
  }

  /* ---------- the pages ---------- */
  function lpListHtml() {
    var L = S.lp, mk = S.mk;
    var cards = L.pages.filter(function (p) { return p.status !== 'archived' || L.showArchived; }).map(function (p) {
      var ev = lpEv(p.id, 30), st = lpStats(ev, lpConv(p.id, 30)), views = ev.filter(function (e) { return e.kind === 'view'; });
      var th = (p.theme && LPTHEMES[p.theme.preset]) || LPTHEMES.green;
      return '<div class="card w230pc"><div class="row" style="align-items:flex-start;gap:12px"><div class="w230sw" style="background:' + E((p.theme && p.theme.bg) || th[0]) + '"><i style="background:' + E((p.theme && p.theme.btn) || th[1]) + '"></i><i style="background:' + E((p.theme && p.theme.accent) || th[2]) + '"></i><i style="background:' + E((p.theme && p.theme.btn) || th[1]) + '"></i></div>' +
        '<div style="flex:1;min-width:0"><b style="font-size:16px">' + E(p.title) + '</b> <span class="pill ' + (p.status === 'live' ? 'ok' : p.status === 'archived' ? '' : 'warn') + '">' + E(p.status === 'live' ? 'Live' : p.status === 'archived' ? 'Archived' : 'Draft') + '</span>' + (p.slug === 'main' ? ' <span class="pill appr">Link in bio</span>' : '') +
        '<div style="font-size:12.5px;margin-top:3px"><a href="' + E(lpUrl(p)) + '" target="_blank" rel="noopener" style="color:' + ROSE + ';font-weight:700">' + E(lpUrl(p).replace(/^https:\/\//, '')) + '</a> <a data-w230copy="' + E(lpUrl(p)) + '" title="Copy" style="cursor:pointer">' + I('copy') + '</a></div>' +
        '<div class="w230mini"><span><b>' + num(st.views) + '</b> views</span><span><b>' + num(st.visitors) + '</b> people</span><span><b>' + num(st.clicks) + '</b> clicks</span><span><b>' + pct(st.ctr) + '</b> click rate</span><span><b>' + (st.signups + st.gifts) + '</b> sign-ups and gifts</span></div>' +
        '<div style="max-width:320px;margin-top:6px">' + sparkHtml(views, 30) + '</div></div></div>' +
        '<div class="row" style="margin-top:10px;gap:6px">' + (mk ? '<a class="btn225 sm pri" data-w225go="#studio/pages/edit/' + p.id + '">' + I('star') + ' Edit</a>' : '') + '<a class="btn225 sm" data-w230ins="' + p.id + '">' + I('bolt') + ' Insights</a><a class="btn225 sm" data-w230src="' + p.id + '">Sources and QR</a><a class="btn225 sm" href="' + E(lpUrl(p)) + '" target="_blank" rel="noopener">' + I('ext') + ' Open</a>' +
        (mk && p.slug !== 'main' ? '<span class="sp"></span><a class="btn225 sm" data-w230arch="' + p.id + '">' + (p.status === 'archived' ? 'Bring back' : 'Archive') + '</a>' : '') + '</div></div>';
    }).join('');
    var add = mk ? '<div class="card"><h3>' + I('plus') + ' New page <small>a campaign, an event, a city team</small></h3><div class="row" style="gap:8px"><input type="text" id="w230nt" placeholder="Name, e.g. Rally Paper 2026" style="flex:1;min-width:180px" maxlength="60"><span class="muted">hub.welfareavenue.com/links/</span><input type="text" id="w230ns" placeholder="rally" style="width:140px" maxlength="40">' +
      '<select id="w230ntpl"><option value="blank">Start empty</option><option value="event">Event</option><option value="campaign">Fundraising campaign</option><option value="city">City team</option></select><a class="btn225 sm pri" data-w230new="1">' + I('plus') + ' Make it</a></div><p class="muted" style="margin:8px 0 0">Every page has its own address, QR codes and insights. It starts as a draft: publish it from the editor.</p></div>' : '';
    var arch = L.pages.some(function (p) { return p.status === 'archived'; }) ? '<p class="muted"><a data-w230sharch="1" style="cursor:pointer">' + (L.showArchived ? 'Hide' : 'Show') + ' the archived pages</a></p>' : '';
    return '<div class="w230cards">' + cards + '</div>' + arch + add;
  }
  async function lpCreate() {
    var t = (document.getElementById('w230nt') || {}).value || '', sl = (document.getElementById('w230ns') || {}).value || '', tpl = (document.getElementById('w230ntpl') || {}).value || 'blank';
    t = t.trim(); sl = slug(sl || t).slice(0, 40);
    if (!t) { toastS('Give the page a name'); return; }
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(sl) || sl === 'main') { toastS('The address takes lowercase letters, numbers and dashes'); return; }
    if (S.lp.pages.some(function (p) { return p.slug === sl; })) { toastS('That address is taken'); return; }
    var blocks = JSON.parse(JSON.stringify(LPTPL[tpl] || [])).map(function (b) { b.id = 'b' + randCode(5); b.on = true; return b; });
    var main = lpPage((S.lp.pages.filter(function (p) { return p.slug === 'main'; })[0] || {}).id);
    try {
      var r = await db.from('link_pages').insert({ slug: sl, title: t, bio: '', theme: (main && main.theme) || { preset: 'green' }, socials: (main && main.socials) || {}, blocks: blocks, settings: { lang: 'auto', fallback_url: 'https://welfareavenue.com/' }, status: 'draft', created_by: myName() || myEmail(), updated_by: myName() || myEmail() }).select('*').maybeSingle();
      if (r.error) throw r.error;
      var row = r.data && r.data.id ? r.data : null;
      if (!row) { await lpLoad(true); row = S.lp.pages.filter(function (p) { return p.slug === sl; })[0] || null; } else S.lp.pages.push(row);
      if (row) go('#studio/pages/edit/' + row.id); else { toastS('Made: refresh to open it'); paint(); }
    } catch (x) { toastS('Could not make the page: ' + (x.message || x)); }
  }

  /* ---------- the editor ---------- */
  function lpDraft() {
    var L = S.lp, id = S.sub2;
    if (!L.edit || String(L.edit.id) !== String(id)) {
      var p = lpPage(id); if (!p) return null;
      L.edit = JSON.parse(JSON.stringify(p)); L.edit.dirty = false; L.edit.theme = L.edit.theme || { preset: 'green' }; L.edit.settings = L.edit.settings || {}; L.edit.socials = L.edit.socials || {}; L.edit.blocks = Array.isArray(L.edit.blocks) ? L.edit.blocks : [];
      L.open = {};
    }
    return L.edit;
  }
  function lpResolved(d, fr, showB) {
    /* what the public page would draw from this draft (switched-off and scheduled blocks are shown faded with a tag) */
    var now = Date.now();
    return d.blocks.map(function (b) {
      var pick = function (o, k) { return (fr && o[k + '_fr']) || o[k] || ''; };
      var label = pick(b, 'label'), sub = pick(b, 'sub');
      if (b.ab && b.ab.on && (showB || b.ab.winner === 'b') && b.ab.winner !== 'a') { label = pick(b.ab, 'label') || label; sub = pick(b.ab, 'sub') || sub; }
      var off = b.on === false ? 'Off' : b.start_at && new Date(b.start_at).getTime() > now ? 'From ' + niceDate(dayOf(b.start_at), { month: 'short', day: 'numeric' }) : b.end_at && new Date(b.end_at).getTime() <= now ? 'Ended' : '';
      var o = { id: b.id, type: b.type, label: label, sub: sub, icon: b.icon || '', featured: !!b.featured, thumb: b.thumb || '', _off: off, code: b.code || '', text: pick(b, 'text'), video: lpYt(b.video || ''), count: b.count, stats: (b.stats || []).map(function (s) { return { n: s.n, label: (fr && s.label_fr) || s.label }; }) };
      if (b.type === 'link' && !b.code) o.url = b.url || '';
      return o;
    });
  }
  function lpYt(v) { v = String(v || '').trim(); var m = /(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{6,20})/.exec(v); return m ? m[1] : (/^[A-Za-z0-9_-]{6,20}$/.test(v) ? v : ''); }
  var lpPrevT = null;
  function lpPreview() {
    clearTimeout(lpPrevT);
    lpPrevT = setTimeout(function () {
      var d = S.lp.edit, f = document.getElementById('w230prev'); if (!d || !f || !f.contentWindow) return;
      var fr = S.lp.prevLang === 'fr';
      try { f.contentWindow.postMessage({ type: 'wa230-preview', lang: fr ? 'fr' : 'en', page: { title: (fr && d.title_fr) || d.title, bio: (fr && d.bio_fr) || d.bio || '', avatar: d.avatar_url || '', theme: d.theme, socials: d.socials, lang_toggle: false }, blocks: lpResolved(d, fr, S.lp.prevB) }, location.origin); } catch (e) { /* fine */ }
    }, 120);
  }
  window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.type === 'wa230-ready') lpPreview(); });
  function fld(i, k, label, val, opts) {
    opts = opts || {};
    var a = 'data-w230b="' + i + '|' + k + '"';
    if (opts.area) return '<label class="w230f' + (opts.wide ? ' wide' : '') + '"><span>' + E(label) + '</span><textarea ' + a + ' rows="' + (opts.rows || 2) + '" maxlength="' + (opts.max || 600) + '">' + E(val || '') + '</textarea></label>';
    return '<label class="w230f' + (opts.wide ? ' wide' : '') + '"><span>' + E(label) + '</span><input type="' + (opts.type || 'text') + '" ' + a + ' value="' + E(val || '') + '" placeholder="' + E(opts.ph || '') + '" maxlength="' + (opts.max || 300) + '"></label>';
  }
  function chk(i, k, label, on) { return '<label class="w230c"><input type="checkbox" data-w230bc="' + i + '|' + k + '"' + (on ? ' checked' : '') + '> ' + E(label) + '</label>'; }
  function dtl(iso) { if (!iso) return ''; var d = new Date(iso); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function abResult(pageId, b) {
    var ev = lpEv(pageId, 90), out = { a: { v: 0, c: 0 }, b: { v: 0, c: 0 } };
    ev.forEach(function (e) {
      if (e.kind === 'view' && e.variant) { try { var m = JSON.parse(e.variant); if (m[b.id] && out[m[b.id]]) out[m[b.id]].v++; } catch (x) { /* fine */ } }
      if (e.kind === 'click' && e.block_id === b.id && e.variant && out[e.variant]) out[e.variant].c++;
    });
    var ra = out.a.v ? out.a.c / out.a.v : 0, rb = out.b.v ? out.b.c / out.b.v : 0, conf = null;
    if (out.a.v >= 20 && out.b.v >= 20) {
      var p = (out.a.c + out.b.c) / (out.a.v + out.b.v), se = Math.sqrt(p * (1 - p) * (1 / out.a.v + 1 / out.b.v));
      if (se > 0) { var z = Math.abs(ra - rb) / se; conf = 1 - Math.exp(-0.717 * z - 0.416 * z * z); }
    }
    return { a: out.a, b: out.b, ra: ra, rb: rb, conf: conf, lead: rb > ra ? 'b' : ra > rb ? 'a' : null };
  }
  function lpBlockHtml(d, b, i) {
    var t = LPT[b.type] || [b.type, '•', ''], open = !!S.lp.open[b.id], n = d.blocks.length;
    var badges = (b.on === false ? '<span class="pill">Off</span>' : '') + (b.featured ? '<span class="pill appr">Featured</span>' : '') + (b.start_at || b.end_at ? '<span class="pill warn">Scheduled</span>' : '') + (b.ab && b.ab.on ? '<span class="pill ok">A/B' + (b.ab.winner ? ': ' + b.ab.winner.toUpperCase() + ' won' : '') + '</span>' : '');
    var cl = lpEv(d.id, 30).filter(function (e) { return e.kind === 'click' && (e.block_id === b.id || String(e.block_id || '').indexOf(b.id + '-') === 0); }).length;
    var head = '<div class="w230bh" data-w230open="' + E(b.id) + '"><span class="w230ic">' + E(b.icon || t[1]) + '</span><div style="flex:1;min-width:0"><b>' + E(b.label || b.text || t[0]) + '</b><small>' + E(t[0]) + (cl ? ' · ' + cl + ' clicks in 30 days' : '') + '</small></div>' + badges +
      '<a class="btn225 sm" data-w230mv="up|' + i + '" title="Up"' + (i ? '' : ' disabled') + '>' + I('up') + '</a><a class="btn225 sm" data-w230mv="down|' + i + '" title="Down"' + (i < n - 1 ? '' : ' disabled') + '>' + I('down') + '</a></div>';
    if (!open) return '<div class="w230blk">' + head + '</div>';
    var f = '';
    var labels = fld(i, 'label', 'Text', b.label) + fld(i, 'label_fr', 'Text in French', b.label_fr, { ph: 'Optional' });
    if (b.type === 'link' || b.type === 'form' || b.type === 'donate') {
      f += labels + fld(i, 'sub', 'Small line under it', b.sub, { ph: 'Optional' }) + fld(i, 'sub_fr', 'Small line in French', b.sub_fr, { ph: 'Optional' }) + fld(i, 'icon', 'Emoji', b.icon, { max: 4, ph: '🙌' }) + fld(i, 'thumb', 'Picture (address)', b.thumb, { ph: 'https://… (optional)' });
      if (b.type === 'link') f += fld(i, 'url', 'Goes to', b.url, { type: 'url', wide: true, ph: 'https://' }) + fld(i, 'fallback', 'When it is switched off, go to', b.fallback, { type: 'url', wide: true, ph: 'Optional: else the page’s fallback' });
      if (b.type === 'form') f += '<label class="w230f"><span>Form</span><select data-w230b="' + i + '|form">' + S.lp.forms.map(function (x) { return '<option value="' + E(x.slug) + '"' + (x.slug === b.form ? ' selected' : '') + '>' + E(x.title) + '</option>'; }).join('') + '</select></label><label class="w230f"><span>French form</span><select data-w230b="' + i + '|form_fr"><option value="">The same form</option>' + S.lp.forms.map(function (x) { return '<option value="' + E(x.slug) + '"' + (x.slug === b.form_fr ? ' selected' : '') + '>' + E(x.title) + '</option>'; }).join('') + '</select></label>';
      if (b.type === 'donate') f += fld(i, 'campaign', 'Campaign (optional)', b.campaign, { max: 40 });
      f += '<div class="w230row wide">' + chk(i, 'featured', 'Featured (gold, gently pulsing)', b.featured) + '</div>';
      f += '<label class="w230f"><span>Show from</span><input type="datetime-local" data-w230b="' + i + '|start_at" value="' + E(dtl(b.start_at)) + '"></label><label class="w230f"><span>Until</span><input type="datetime-local" data-w230b="' + i + '|end_at" value="' + E(dtl(b.end_at)) + '"></label>';
      var ab = b.ab || {};
      f += '<div class="w230ab wide"><label class="w230c"><input type="checkbox" data-w230ab="' + i + '|on"' + (ab.on ? ' checked' : '') + '> A/B test: show half the visitors another text</label>' +
        (ab.on ? '<div class="w230grid">' + '<label class="w230f"><span>Text B</span><input type="text" data-w230ab="' + i + '|label" value="' + E(ab.label || '') + '"></label><label class="w230f"><span>Text B in French</span><input type="text" data-w230ab="' + i + '|label_fr" value="' + E(ab.label_fr || '') + '"></label></div>' + lpAbHtml(d, b, i) : '') + '</div>';
    } else if (b.type === 'header') f += labels;
    else if (b.type === 'text') f += fld(i, 'text', 'Text', b.text, { area: true, wide: true, rows: 3 }) + fld(i, 'text_fr', 'Text in French', b.text_fr, { area: true, wide: true, rows: 3 });
    else if (b.type === 'youtube') f += fld(i, 'video', 'YouTube address', b.video, { wide: true, ph: 'https://youtu.be/…' }) + labels;
    else if (b.type === 'instagram' || b.type === 'events') f += labels + fld(i, 'count', 'How many', b.count || (b.type === 'events' ? 3 : 6), { type: 'number', max: 2 });
    else if (b.type === 'impact') {
      f += labels;
      var st = (b.stats || []).concat([{}, {}, {}, {}]).slice(0, 4);
      f += '<div class="wide w230grid4">' + st.map(function (s, k) { return '<label class="w230f"><span>Number ' + (k + 1) + '</span><input type="text" data-w230st="' + i + '|' + k + '|n" value="' + E(s.n || '') + '" placeholder="1,000+" maxlength="20"></label><label class="w230f"><span>says</span><input type="text" data-w230st="' + i + '|' + k + '|label" value="' + E(s.label || '') + '" placeholder="meals a month"></label><label class="w230f"><span>in French</span><input type="text" data-w230st="' + i + '|' + k + '|label_fr" value="' + E(s.label_fr || '') + '"></label>'; }).join('') + '</div>';
    } else if (b.type === 'socials') f += '<p class="muted wide" style="margin:0">The icons come from the page’s social profiles (Look and settings).</p>';
    return '<div class="w230blk open">' + head + '<div class="w230bb">' + f + '<div class="row wide" style="margin-top:6px">' + chk(i, 'on', 'Shown on the page', b.on !== false) + '<span class="sp"></span><a class="btn225 sm" data-w230dup="' + i + '">Duplicate</a><a class="btn225 sm bad" data-w230rm="' + i + '">' + I('trash') + ' Remove</a></div></div></div>';
  }
  function lpAbHtml(d, b, i) {
    var r = abResult(d.id, b), cf = r.conf;
    var row = function (k, lab) { var x = r[k]; return '<tr' + (b.ab.winner === k ? ' style="font-weight:700"' : '') + '><td>' + k.toUpperCase() + '</td><td>' + E(clip(lab || '', 40)) + '</td><td>' + x.v + '</td><td>' + x.c + '</td><td>' + (x.v ? pct(x.c / x.v) : '–') + '</td></tr>'; };
    return '<table class="w230t" style="margin-top:6px"><thead><tr><th></th><th>Text</th><th>Views</th><th>Clicks</th><th>Rate</th></tr></thead><tbody>' + row('a', b.label) + row('b', b.ab.label) + '</tbody></table>' +
      '<p class="muted" style="margin:6px 0">' + (b.ab.winner ? 'Everyone now sees ' + b.ab.winner.toUpperCase() + '.' : r.a.v + r.b.v < 40 ? 'Too early to tell: about 20 views each is the least.' : cf != null && cf >= 0.95 && r.lead ? r.lead.toUpperCase() + ' is ahead and we are ' + Math.round(cf * 100) + '% sure: pick it.' : r.lead ? r.lead.toUpperCase() + ' leads, but not clearly yet (' + Math.round((cf || 0) * 100) + '% sure).' : 'No difference yet.') + '</p>' +
      '<div class="row" style="gap:6px"><a class="btn225 sm" data-w230win="' + i + '|a">Keep A</a><a class="btn225 sm" data-w230win="' + i + '|b">Keep B</a>' + (b.ab.winner ? '<a class="btn225 sm" data-w230win="' + i + '|">Test again</a>' : '') + '</div>';
  }
  function lpEditorHtml() {
    var d = lpDraft(); if (!d) return '<div class="card"><div class="empty">That page is not here. <a data-w225go="#studio/pages" style="cursor:pointer">Back to the pages</a></div></div>';
    if (!S.mk) return '<div class="card"><div class="empty">The marketing team and admins change the link pages.</div></div>';
    var th = d.theme || {}, st = d.settings || {};
    var top = '<div class="row w230bar0"><a class="btn225 sm" data-w225go="#studio/pages">‹ Pages</a><b style="font-size:16px">' + E(d.title) + '</b><span class="pill ' + (d.status === 'live' ? 'ok' : 'warn') + '">' + (d.status === 'live' ? 'Live' : 'Draft') + '</span><span class="sp"></span><span class="muted">' + (d.dirty ? 'Changes not saved' : 'Saved') + '</span>' +
      (d.dirty ? '<a class="btn225 sm" data-w230discard="1">Discard</a>' : '') + '<a class="btn225 sm' + (d.dirty ? ' pri' : '') + '" data-w230save="1"' + (S.lp.busy.save ? ' disabled' : '') + '>' + I('check') + ' Save</a>' +
      (d.slug !== 'main' ? '<a class="btn225 sm' + (d.status === 'live' ? '' : ' pri') + '" data-w230pub="' + (d.status === 'live' ? 'draft' : 'live') + '">' + (d.status === 'live' ? 'Unpublish' : 'Save and publish') + '</a>' : '') + '<a class="btn225 sm" href="' + E(lpUrl(d)) + '" target="_blank" rel="noopener">' + I('ext') + '</a></div>';
    var page = '<div class="card"><h3>' + I('star') + ' The page</h3><div class="w230grid">' +
      '<label class="w230f"><span>Name at the top</span><input type="text" data-w230p="title" value="' + E(d.title) + '" maxlength="60"></label><label class="w230f"><span>In French</span><input type="text" data-w230p="title_fr" value="' + E(d.title_fr || '') + '" maxlength="60" placeholder="Optional"></label>' +
      '<label class="w230f wide"><span>A line under it</span><textarea data-w230p="bio" rows="2" maxlength="220">' + E(d.bio || '') + '</textarea></label><label class="w230f wide"><span>In French</span><textarea data-w230p="bio_fr" rows="2" maxlength="220" placeholder="Optional">' + E(d.bio_fr || '') + '</textarea></label>' +
      '<label class="w230f wide"><span>Picture at the top (address; empty shows our logo)</span><input type="url" data-w230p="avatar_url" value="' + E(d.avatar_url || '') + '" placeholder="https://…"></label>' +
      (d.slug !== 'main' ? '<label class="w230f"><span>Address</span><input type="text" data-w230p="slug" value="' + E(d.slug) + '" maxlength="40"></label>' : '') + '</div></div>';
    var adds = Object.keys(LPT).map(function (k) { return '<a class="w230add" data-w230addb="' + k + '" title="' + E(LPT[k][2]) + '"><span>' + LPT[k][1] + '</span>' + E(LPT[k][0]) + '</a>'; }).join('');
    var blocks = '<div class="card"><h3>' + I('link') + ' What is on it <small>top to bottom; open one to change it</small></h3>' + (d.blocks.length ? d.blocks.map(function (b, i) { return lpBlockHtml(d, b, i); }).join('') : '<div class="empty">Nothing yet: add a block below.</div>') +
      '<h4>Add</h4><div class="w230adds">' + adds + '</div></div>';
    var look = '<div class="card"><h3>' + I('eye') + ' Look and settings</h3><div class="row" style="gap:6px;flex-wrap:wrap">' + Object.keys(LPTHEMES).map(function (k) { var c = LPTHEMES[k]; return '<a class="w230th' + ((th.preset || 'green') === k ? ' on' : '') + '" data-w230t="preset|' + k + '" title="' + k + '" style="background:' + c[0] + '"><i style="background:' + c[1] + '"></i><i style="background:' + c[2] + '"></i></a>'; }).join('') + '</div>' +
      '<div class="w230grid" style="margin-top:10px"><label class="w230f"><span>Background</span><input type="color" data-w230tc="bg" value="' + E(th.bg || LPTHEMES[th.preset || 'green'][0]) + '"></label><label class="w230f"><span>Buttons</span><input type="color" data-w230tc="btn" value="' + E(th.btn || LPTHEMES[th.preset || 'green'][1]) + '"></label><label class="w230f"><span>Highlight</span><input type="color" data-w230tc="accent" value="' + E(th.accent || LPTHEMES[th.preset || 'green'][2]) + '"></label>' +
      '<label class="w230f"><span>Button shape</span><select data-w230t2="shape">' + [['pill', 'Pill'], ['rounded', 'Rounded'], ['square', 'Square']].map(function (x) { return '<option value="' + x[0] + '"' + ((th.shape || 'pill') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="w230f"><span>Language</span><select data-w230s="lang">' + [['auto', 'English or French, from the phone’s language'], ['en', 'English only'], ['fr-only', 'French only']].map(function (x) { return '<option value="' + x[0] + '"' + ((st.lang || 'auto') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="w230f"><span>Switched-off links go to</span><input type="url" data-w230s="fallback_url" value="' + E(st.fallback_url || 'https://welfareavenue.com/') + '"></label></div>' +
      '<h4>Social profiles</h4><div class="w230grid">' + ['instagram', 'facebook', 'tiktok', 'linkedin', 'threads', 'youtube'].map(function (k) { return '<label class="w230f"><span>' + E(PLX[k] ? PLX[k][0] : k) + '</span><input type="url" data-w230so="' + k + '" value="' + E(d.socials[k] || '') + '" placeholder="https://"></label>'; }).join('') + '</div></div>';
    var prev = '<div class="card w230prevcard"><h3>' + I('eye') + ' How it looks <span class="sp"></span><span class="seg"><a data-w230pl="en" class="' + (S.lp.prevLang === 'en' ? 'on' : '') + '">EN</a><a data-w230pl="fr" class="' + (S.lp.prevLang === 'fr' ? 'on' : '') + '">FR</a></span>' + (d.blocks.some(function (b) { return b.ab && b.ab.on && !b.ab.winner; }) ? '<span class="seg"><a data-w230pb="0" class="' + (!S.lp.prevB ? 'on' : '') + '">A</a><a data-w230pb="1" class="' + (S.lp.prevB ? 'on' : '') + '">B</a></span>' : '') + '</h3>' +
      '<div class="w230phone"><iframe id="w230prev" title="Preview" src="/links/' + E(d.slug) + '?preview=1&from=' + E(lpPage(d.id) ? lpPage(d.id).slug : 'main') + '"></iframe></div><p class="muted" style="text-align:center;margin:8px 0 0">Faded buttons are off or scheduled; the live page leaves them out.</p></div>';
    return top + '<div class="grid2 w230ed"><div>' + page + blocks + look + '</div><div>' + prev + '</div></div>';
  }
  function lpSet(path, val) {
    var d = S.lp.edit; if (!d) return;
    var p = path.split('|'), i = Number(p[0]), k = p[1], b = d.blocks[i]; if (!b) return;
    if (k === 'start_at' || k === 'end_at') val = val ? new Date(val).toISOString() : null;
    if (k === 'count') val = Math.max(1, Math.min(9, Number(val) || 1));
    if (k === 'icon') val = String(val || '').trim().slice(0, 4);
    b[k] = val; d.dirty = true;
  }
  async function lpSave(status) {
    var d = S.lp.edit; if (!d || S.lp.busy.save) return;
    var orig = lpPage(d.id) || {};
    if (!String(d.title || '').trim()) { toastS('The page needs a name'); return; }
    if (d.slug !== 'main' && (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(d.slug) || d.slug === 'main' || S.lp.pages.some(function (p) { return p.slug === d.slug && String(p.id) !== String(d.id); }))) { toastS('Check the address: lowercase letters, numbers and dashes, not taken'); return; }
    for (var i = 0; i < d.blocks.length; i++) { var b0 = d.blocks[i]; if (b0.type === 'link' && b0.url && !/^https?:\/\/\S+\.\S+/.test(b0.url)) { toastS('“' + (b0.label || 'A link') + '” needs a full address starting with https://'); S.lp.open[b0.id] = true; paint(); return; } }
    S.lp.busy.save = true; paint();
    try {
      /* each link button is a short link, so the go function redirects and counts it */
      for (var j = 0; j < d.blocks.length; j++) {
        var b = d.blocks[j]; if (b.type !== 'link' || !b.url) continue;
        var row = b.code ? S.links.filter(function (l) { return l.code === b.code; })[0] : null;
        if (b.code && !row) { var rr = await q(db.from('short_links').select('*').eq('code', b.code).maybeSingle()); row = rr.data || null; }
        if (row) {
          if (row.url !== b.url || (row.fallback_url || '') !== (b.fallback || '') || row.active !== (b.on !== false)) {
            var up = await db.from('short_links').update({ url: b.url, fallback_url: b.fallback || null, label: (b.label || 'Link') + ' (link page ' + d.slug + ')', active: b.on !== false }).eq('id', row.id); if (up.error) throw up.error;
            row.url = b.url; row.fallback_url = b.fallback || null; row.active = b.on !== false;
          }
        } else {
          var made = await makeLink(b.url, (b.label || 'Link') + ' (link page ' + d.slug + ')', 'lp-' + d.slug.slice(0, 20) + '-' + randCode(4), 'link page ' + d.slug, { bio: true, row: { fallback_url: b.fallback || null } });
          b.code = made.code;
        }
      }
      var patch = { title: String(d.title).trim(), title_fr: d.title_fr || null, bio: d.bio || null, bio_fr: d.bio_fr || null, avatar_url: d.avatar_url || null, theme: d.theme, socials: d.socials, settings: d.settings, blocks: d.blocks.map(function (b) { var c = Object.assign({}, b); return c; }), updated_by: myName() || myEmail() };
      if (d.slug !== orig.slug) patch.slug = d.slug;
      if (status) patch.status = status;
      var r = await db.from('link_pages').update(patch).eq('id', d.id).select('*').maybeSingle(); if (r.error) throw r.error;
      var saved = Object.assign({}, orig, patch, r.data || {});
      S.lp.pages = S.lp.pages.map(function (p) { return String(p.id) === String(d.id) ? saved : p; });
      S.lp.edit = null; lpDraft();
      toastS(status === 'live' ? 'Saved and live at ' + lpUrl(saved).replace(/^https:\/\//, '') : status === 'draft' ? 'Unpublished: the page shows nothing until you publish it again' : 'Saved' + (saved.status === 'live' ? ': the page is updated' : ''));
    } catch (x) { toastS('Could not save: ' + (x.message || x)); }
    S.lp.busy.save = false; paint();
  }

  /* ---------- insights ---------- */
  function lpDaily(ev, days) {
    var t = today(), rows = [];
    for (var i = days - 1; i >= 0; i--) { var d = addDays(t, -i); rows.push({ d: d, v: 0, c: 0 }); }
    var idx = {}; rows.forEach(function (r, k) { idx[r.d] = k; });
    ev.forEach(function (e) { var k = idx[dayOf(e.at)]; if (k == null) return; if (e.kind === 'view') rows[k].v++; else rows[k].c++; });
    var mx = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1])), W = 720, H = 150, bw = W / rows.length;
    var bars = rows.map(function (r, k) { var h = Math.round(r.v / mx * (H - 24)); return '<rect x="' + (k * bw + 1).toFixed(1) + '" y="' + (H - 18 - h) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + h + '" rx="2" fill="' + GREEN + '" opacity=".75"><title>' + E(niceDate(r.d)) + ': ' + r.v + ' views, ' + r.c + ' clicks</title></rect>'; }).join('');
    var line = rows.map(function (r, k) { return (k ? 'L' : 'M') + (k * bw + bw / 2).toFixed(1) + ' ' + (H - 18 - Math.round(r.c / mx * (H - 24))); }).join(' ');
    var lab = rows.filter(function (r, k) { return k === 0 || k === rows.length - 1 || k === Math.floor(rows.length / 2); }).map(function (r) { var k = idx[r.d]; return '<text x="' + (k * bw + bw / 2).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle" font-size="10" fill="' + MUTED + '">' + E(niceDate(r.d, { month: 'short', day: 'numeric' })) + '</text>'; }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w230chart" role="img" aria-label="Views and clicks a day">' + bars + '<path d="' + line + '" fill="none" stroke="' + GOLD + '" stroke-width="2.5" stroke-linejoin="round"/>' + lab + '</svg><div class="w230leg"><span><i style="background:' + GREEN + '"></i>Views</span><span><i style="background:' + GOLD + '"></i>Clicks</span></div>';
  }
  function lpHeat(views) {
    var g = []; for (var d = 0; d < 7; d++) { g.push([]); for (var h = 0; h < 24; h++) g[d].push(0); }
    views.forEach(function (e) { var t = new Date(e.at); g[(t.getDay() + 6) % 7][t.getHours()]++; });
    var mx = 1; g.forEach(function (r) { r.forEach(function (v) { if (v > mx) mx = v; }); });
    var best = null; g.forEach(function (r, d) { r.forEach(function (v, h) { if (!best || v > best.v) best = { d: d, h: h, v: v }; }); });
    return { html: '<div class="w230heat">' + '<span></span>' + [0, 3, 6, 9, 12, 15, 18, 21].map(function (h) { return '<em style="grid-column:span 3">' + h + 'h</em>'; }).join('') + g.map(function (r, d) { return '<b>' + WD[d] + '</b>' + r.map(function (v, h) { return '<i title="' + WDL[d] + ' ' + h + ':00, ' + v + ' views" style="opacity:' + (v ? (0.15 + 0.85 * v / mx).toFixed(2) : 0.05) + '"></i>'; }).join(''); }).join('') + '</div>', best: best && best.v ? best : null };
  }
  function lpTable(rows, heads) { return '<table class="w230t"><thead><tr>' + heads.map(function (h) { return '<th>' + E(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>'; }
  function lpInsightsHtml() {
    var L = S.lp, ev = lpEv(L.page, L.days), conv = lpConv(L.page, L.days), st = lpStats(ev, conv);
    var prevEv = S.lp.ev.filter(function (e) { var a = Date.now() - new Date(e.at).getTime(); return (L.page === 'all' || String(e.page_id) === String(L.page)) && a >= L.days * 86400000 && a < 2 * L.days * 86400000; });
    var pst = lpStats(prevEv, []);
    var dl = function (a, b) { if (!b || L.days > 45) return ''; var x = (a - b) / b; return '<em style="color:' + (x >= 0 ? TEAL : FLAG) + '">' + (x >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(x * 100)) + '%</em>'; };
    var views = ev.filter(function (e) { return e.kind === 'view'; }), clicks = ev.filter(function (e) { return e.kind === 'click'; });
    if (!ev.length) return '<div class="card"><div class="empty">No visits in this window yet. Put ' + E(lpUrl(L.page === 'all' ? lpPage((L.pages.filter(function (p) { return p.slug === 'main'; })[0] || {}).id) : lpPage(L.page)).replace(/^https:\/\//, '')) + ' in our bios (Sources and QR codes gives each platform its own address), and the numbers start with the first visit.</div></div>';
    var kpis = '<div class="kpis"><div class="kpi"><b>' + num(st.views) + '</b><span>views</span>' + dl(st.views, pst.views) + '</div><div class="kpi"><b>' + num(st.visitors) + '</b><span>people</span><em>' + (st.visitors ? pct(st.repeat / st.visitors) + ' came back' : '') + '</em></div>' +
      '<div class="kpi"><b>' + num(st.clicks) + '</b><span>clicks</span>' + dl(st.clicks, pst.clicks) + '</div><div class="kpi"><b>' + pct(st.ctr) + '</b><span>click rate</span><em>' + (st.visitors ? pct(st.clickers / st.visitors) + ' of people clicked' : '') + '</em></div>' +
      '<div class="kpi" data-w225go="#studio/pages/people"><b class="' + (st.signups ? 'ok' : '') + '">' + st.signups + '</b><span>sign-ups</span><em>' + (st.gifts ? st.gifts + ' gift' + (st.gifts === 1 ? '' : 's') + ' started, ' + st.gave + ' made' : 'from the forms on the page') + '</em></div></div>';
    /* buttons */
    var byBlock = {}; clicks.forEach(function (e) { var k = e.page_id + '|' + e.block_id; (byBlock[k] = byBlock[k] || { p: e.page_id, b: e.block_id, n: 0, who: {} }).n++; if (e.visitor) byBlock[k].who[e.visitor] = 1; });
    var cvBlock = {}; conv.forEach(function (c) { var k = c.page_id + '|' + c.block_id; cvBlock[k] = (cvBlock[k] || 0) + 1; });
    var bl = Object.keys(byBlock).map(function (k) { return byBlock[k]; }).sort(function (a, b) { return b.n - a.n; });
    var mxb = bl.length ? bl[0].n : 1;
    var btnRows = bl.slice(0, 15).map(function (x) { var k = x.p + '|' + x.b; return '<tr><td>' + E(blockName(x.p, x.b)) + (L.page === 'all' ? ' <small class="muted">' + E((lpPage(x.p) || {}).title || '') + '</small>' : '') + '</td><td>' + bar(x.n, mxb) + ' ' + x.n + '</td><td>' + Object.keys(x.who).length + '</td><td>' + (st.views ? pct(x.n / st.views) : '–') + '</td><td>' + (cvBlock[k] || '') + '</td></tr>'; });
    /* sources */
    var srcs = {}; views.forEach(function (e) { var s = e.src || 'direct'; (srcs[s] = srcs[s] || { v: 0, c: 0, who: {}, cv: 0 }).v++; if (e.visitor) srcs[s].who[e.visitor] = 1; });
    clicks.forEach(function (e) { var s = e.src || 'direct'; (srcs[s] = srcs[s] || { v: 0, c: 0, who: {}, cv: 0 }).c++; });
    conv.forEach(function (c) { var s = c.src || 'direct'; (srcs[s] = srcs[s] || { v: 0, c: 0, who: {}, cv: 0 }).cv++; });
    var sl = Object.keys(srcs).map(function (k) { return [k, srcs[k]]; }).sort(function (a, b) { return b[1].v - a[1].v; });
    var mxs = sl.length ? sl[0][1].v : 1;
    var srcRows = sl.map(function (x) { var s = x[1]; return '<tr><td>' + E(srcName(x[0])) + '</td><td>' + bar(s.v, mxs, ROSE) + ' ' + s.v + '</td><td>' + Object.keys(s.who).length + '</td><td>' + s.c + '</td><td>' + (s.v ? pct(s.c / s.v) : '–') + '</td><td>' + (s.cv || '') + '</td></tr>'; });
    /* places, devices, languages */
    var places = countBy(views, function (e) { return e.city ? e.city + (e.region ? ', ' + e.region : '') : e.region ? e.region : e.country ? e.country : null; }).slice(0, 8);
    var cn = null; try { cn = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (x) { cn = null; }
    var countries = countBy(views, function (e) { return e.country ? (cn ? cn.of(e.country) : e.country) : null; }).slice(0, 5);
    var devs = countBy(views, function (e) { return e.device ? e.device.charAt(0).toUpperCase() + e.device.slice(1) : null; }), apps = countBy(views, function (e) { return e.browser; }).slice(0, 6), oss = countBy(views, function (e) { return e.os; }).slice(0, 5), langs = countBy(views, function (e) { return e.lang === 'fr' ? 'French' : 'English'; });
    var listCard = function (title, rows, total) { var mx = rows.length ? rows[0][1] : 1; return '<h4>' + E(title) + '</h4>' + (rows.length ? rows.map(function (r) { return '<div class="w230li"><span>' + E(r[0]) + '</span>' + bar(r[1], mx, PURPLE) + '<b>' + (total ? pct(r[1] / total) : r[1]) + '</b></div>'; }).join('') : '<p class="muted">Not known yet.</p>'); };
    var heat = lpHeat(views);
    /* the funnel */
    var fun = [['Views', st.views], ['People', st.visitors], ['Clicked', st.clickers], ['Signed up or gave', st.signups + st.gave]];
    var funnel = '<div class="w230fun">' + fun.map(function (f, k) { return '<div><b>' + num(f[1]) + '</b><span>' + E(f[0]) + '</span>' + (k ? '<em>' + (fun[k - 1][1] ? pct(f[1] / fun[k - 1][1]) : '–') + '</em>' : '') + '</div>'; }).join('') + '</div>';
    /* what it says */
    var tips = [];
    if (sl.length) { var top = sl[0]; tips.push(srcName(top[0]) + ' brings ' + pct(top[1].v / st.views) + ' of the visits.'); }
    var conv2 = sl.filter(function (x) { return x[1].v >= 15; }).sort(function (a, b) { return (b[1].c / b[1].v) - (a[1].c / a[1].v); });
    if (conv2.length > 1) tips.push('People from ' + srcName(conv2[0][0]) + ' click the most (' + pct(conv2[0][1].c / conv2[0][1].v) + ' click rate); ' + srcName(conv2[conv2.length - 1][0]) + ' the least (' + pct(conv2[conv2.length - 1][1].c / conv2[conv2.length - 1][1].v) + ').');
    if (bl.length) tips.push('“' + blockName(bl[0].p, bl[0].b) + '” gets ' + pct(bl[0].n / Math.max(1, st.clicks)) + ' of all clicks.');
    if (heat.best && views.length >= 20) tips.push('Visits peak on ' + WDL[heat.best.d] + 's around ' + heat.best.h + ':00: a good time to post.');
    var phone = devs.filter(function (x) { return x[0] === 'Phone'; })[0]; if (phone && st.views) tips.push(pct(phone[1] / st.views) + ' visit on a phone.');
    var tipCard = tips.length ? '<div class="card w230tips"><h3>' + I('bolt') + ' What it says</h3><ul>' + tips.map(function (t) { return '<li>' + E(t) + '</li>'; }).join('') + '</ul></div>' : '';
    return kpis + tipCard + '<div class="card"><h3>' + I('cal') + ' Views and clicks a day <span class="sp"></span><a class="btn225 sm" data-w230csv="1">' + I('down') + ' Export</a></h3>' + lpDaily(ev, L.days) + '</div>' +
      '<div class="grid2"><div><div class="card"><h3>' + I('link') + ' Buttons <small>what people clicked</small></h3>' + (btnRows.length ? lpTable(btnRows, ['Button', 'Clicks', 'People', 'Of views', 'Sign-ups']) : '<div class="empty">No clicks yet.</div>') + '</div>' +
      '<div class="card"><h3>' + I('send') + ' Where they came from</h3>' + lpTable(srcRows, ['Source', 'Views', 'People', 'Clicks', 'Click rate', 'Sign-ups']) + '<p class="muted" style="margin:8px 0 0">Visits with a source address (Sources and QR codes) are exact; the rest are read from the app they opened in or the site that sent them.</p></div></div>' +
      '<div><div class="card"><h3>' + I('check') + ' From a view to a sign-up</h3>' + funnel + '</div><div class="card"><h3>' + I('home') + ' Where they are</h3>' + listCard('Cities and regions', places, 0) + listCard('Countries', countries, st.views) + '</div>' +
      '<div class="card"><h3>' + I('eye') + ' How they visit</h3>' + listCard('Device', devs, st.views) + listCard('App or browser', apps, st.views) + listCard('System', oss, st.views) + listCard('Language', langs, st.views) + '</div></div></div>' +
      '<div class="card"><h3>' + I('clock') + ' When they visit <small>Toronto time</small></h3>' + heat.html + '</div>' +
      '<p class="muted">No cookie is set and no address is kept: a person is a code that changes every month, so “people” and “came back” count within the month. Names appear only under People, for those who signed up or gave.</p>';
  }
  function lpCsv() {
    var L = S.lp, ev = lpEv(L.page, L.days);
    var head = ['when', 'page', 'kind', 'button', 'variant', 'source', 'device', 'system', 'app_or_browser', 'language', 'city', 'region', 'country', 'came_back'];
    var esc = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = ev.map(function (e) { return [e.at, (lpPage(e.page_id) || {}).slug, e.kind, e.kind === 'click' ? blockName(e.page_id, e.block_id) : '', e.kind === 'click' ? e.variant : '', srcName(e.src), e.device, e.os, e.browser, e.lang, e.city, e.region, e.country, e.repeat_visit ? 'yes' : ''].map(esc).join(','); });
    var blob = new Blob([head.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'link-pages-' + today() + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- people ---------- */
  function lpPeopleHtml() {
    var L = S.lp, conv = lpConv(L.page, L.days).slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    var st = lpStats(lpEv(L.page, L.days), conv);
    var rows = conv.map(function (c) {
      var who = c.contact_name ? '<a href="#crm/c/' + c.contact_id + '" style="font-weight:700;color:' + ROSE + '">' + E(c.contact_name) + '</a>' : '<span class="muted">' + (c.kind === 'donation' ? (c.completed ? 'A donor' : 'Someone (not finished)') : 'Someone') + '</span>';
      return '<tr><td>' + who + '</td><td>' + E(c.kind === 'form' ? c.title : c.completed ? 'Gave (' + (c.ref || 'once') + ')' : 'Started a gift') + '</td><td>' + E(srcName(c.src)) + '</td><td>' + E(blockName(c.page_id, c.block_id)) + (L.page === 'all' ? ' <small class="muted">' + E((lpPage(c.page_id) || {}).title || '') + '</small>' : '') + '</td><td>' + E(niceWhen(c.at)) + '</td><td class="muted">' + E(Math.max(1, Math.round((new Date(c.at) - new Date(c.clicked_at)) / 60000))) + ' min after the click</td></tr>';
    });
    return '<div class="kpis"><div class="kpi"><b>' + num(st.visitors) + '</b><span>people visited</span><em>anonymous</em></div><div class="kpi"><b>' + num(st.clickers) + '</b><span>clicked something</span><em>anonymous</em></div><div class="kpi"><b class="ok">' + conv.length + '</b><span>signed up or gave</span><em>named in the CRM</em></div></div>' +
      '<div class="card"><h3>' + I('heart') + ' Who signed up or gave after a click</h3>' + (rows.length ? lpTable(rows, ['Person', 'What', 'Came from', 'Button', 'When', '']) : '<div class="empty">Nobody yet in this window. When someone clicks a form or the donation button and finishes it within 2 hours, they appear here with their CRM record.</div>') +
      '<p class="muted" style="margin:8px 0 0">A sign-up is credited to the last click on a link page from the same network in the 2 hours before it. Everyone else stays anonymous.</p></div>';
  }

  /* ---------- sources and QR codes ---------- */
  function lpSourcesHtml() {
    var L = S.lp, page = L.page === 'all' ? (L.pages.filter(function (p) { return p.slug === 'main'; })[0] || L.pages[0]) : lpPage(L.page);
    if (!page) return '<div class="card"><div class="empty">Make a page first.</div></div>';
    var ev = lpEv(page.id, L.days), conv = lpConv(page.id, L.days);
    var mine = L.sources.filter(function (s) { return s.active && (!s.page_id || String(s.page_id) === String(page.id)); });
    var seen = countBy(ev.filter(function (e) { return e.kind === 'view'; }), function (e) { return e.src || 'direct'; });
    var rows = mine.map(function (s) {
      var v = ev.filter(function (e) { return e.kind === 'view' && e.src === s.code; }).length, c = ev.filter(function (e) { return e.kind === 'click' && e.src === s.code; }).length, cv = conv.filter(function (x) { return x.src === s.code; }).length;
      var u = lpUrl(page, s.code);
      return '<tr><td><b>' + E(s.label) + '</b><br><small class="muted">' + E({ platform: 'Platform bio', qr: 'QR code', email: 'Email', print: 'Print', partner: 'Partner', other: 'Other' }[s.kind] || s.kind) + (s.page_id ? '' : ' · every page') + '</small></td><td><code>' + E(u.replace(/^https:\/\//, '')) + '</code> <a data-w230copy="' + E(u) + '" style="cursor:pointer" title="Copy">' + I('copy') + '</a></td><td>' + v + '</td><td>' + c + '</td><td>' + (cv || '') + '</td>' +
        '<td style="white-space:nowrap"><a class="btn225 sm" data-w230qr="' + E(s.code) + '|png">QR PNG</a> <a class="btn225 sm" data-w230qr="' + E(s.code) + '|svg">SVG</a>' + (S.mk ? ' <a class="btn225 sm" data-w230soff="' + s.id + '" title="Retire">' + I('x') + '</a>' : '') + '</td></tr>';
    });
    var other = seen.filter(function (x) { return !mine.some(function (s) { return s.code === x[0]; }); });
    var add = S.mk ? '<div class="card"><h3>' + I('plus') + ' New source</h3><div class="row" style="gap:8px"><input type="text" id="w230sl" placeholder="e.g. Poster at Concordia" style="flex:1;min-width:180px" maxlength="60"><select id="w230sk"><option value="qr">QR code</option><option value="print">Print</option><option value="platform">Platform bio</option><option value="email">Email</option><option value="partner">Partner</option><option value="other">Other</option></select>' +
      '<select id="w230sp"><option value="' + page.id + '">This page only</option><option value="">Every page</option></select><a class="btn225 sm pri" data-w230sadd="1">' + I('plus') + ' Add</a></div><p class="muted" style="margin:8px 0 0">Each source gets its own address and QR code, so every visit and sign-up is credited to the right place. Put a different QR code on each poster to see which spot works.</p></div>' : '';
    return '<div class="card"><h3>' + I('send') + ' Addresses for ' + E(page.title) + ' <small>' + E(L.days) + ' days</small></h3>' + lpTable(rows, ['Source', 'Address', 'Views', 'Clicks', 'Sign-ups', '']) +
      (other.length ? '<h4>Also seen, without a source address</h4><div class="row" style="gap:6px;flex-wrap:wrap">' + other.map(function (x) { return '<span class="pill">' + E(srcName(x[0])) + ' · ' + x[1] + '</span>'; }).join('') + '</div>' : '') + '</div>' + add + '<div id="w230qrbox"></div>';
  }
  async function lpAddSource() {
    var label = ((document.getElementById('w230sl') || {}).value || '').trim(), kind = (document.getElementById('w230sk') || {}).value || 'other', pg = (document.getElementById('w230sp') || {}).value;
    if (!label) { toastS('Name the source'); return; }
    var base = slug(label).slice(0, 30) || 'src', code = base, n = 2;
    while (S.lp.sources.some(function (s) { return s.code === code && (!s.page_id || !pg || String(s.page_id) === String(pg)); })) code = base.slice(0, 26) + '-' + (n++);
    try { var r = await db.from('link_page_sources').insert({ page_id: pg ? Number(pg) : null, code: code, label: label, kind: kind, created_by: myName() || myEmail() }).select('*').maybeSingle(); if (r.error) throw r.error; S.lp.sources.push(r.data || { code: code, label: label, kind: kind, active: true, page_id: pg ? Number(pg) : null }); toastS('Added: ' + code); }
    catch (x) { toastS('Could not add it: ' + (x.message || x)); }
    paint();
  }
  /* QR codes: qrcode-generator (MIT, cdnjs) draws the matrix; we draw it in our green with a cream quiet zone */
  function lpQrLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; s.onload = function () { res(window.qrcode); }; s.onerror = function () { rej(new Error('the QR maker did not load')); }; document.head.appendChild(s); });
  }
  async function lpQr(code, kind) {
    var L = S.lp, page = L.page === 'all' ? (L.pages.filter(function (p) { return p.slug === 'main'; })[0] || L.pages[0]) : lpPage(L.page);
    var src = L.sources.filter(function (s) { return s.code === code; })[0] || { label: code };
    var url = lpUrl(page, code);
    try {
      var qr = (await lpQrLib())(0, 'H'); qr.addData(url); qr.make();
      var n = qr.getModuleCount(), pad0 = 4, sz = n + pad0 * 2, cells = '';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) cells += 'M' + (c + pad0) + ' ' + (r + pad0) + 'h1v1h-1z';
      var mid = sz / 2, badge = Math.round(n * 0.22);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + sz + ' ' + sz + '" shape-rendering="crispEdges"><rect width="' + sz + '" height="' + sz + '" fill="#FFFAF2"/><path d="' + cells + '" fill="#103F39"/>' +
        '<rect x="' + (mid - badge / 2 - 0.5) + '" y="' + (mid - badge / 2 - 0.5) + '" width="' + (badge + 1) + '" height="' + (badge + 1) + '" rx="1.5" fill="#FFFAF2"/><rect x="' + (mid - badge / 2) + '" y="' + (mid - badge / 2) + '" width="' + badge + '" height="' + badge + '" rx="1.2" fill="#DCA527"/>' +
        '<text x="' + mid + '" y="' + (mid + badge * 0.24) + '" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="' + (badge * 0.62).toFixed(2) + '" fill="#103F39">W</text></svg>';
      var name = 'qr-' + (page.slug === 'main' ? 'links' : page.slug) + '-' + code;
      var save = function (blob, ext) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.' + ext; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); };
      var box = document.getElementById('w230qrbox');
      if (box) box.innerHTML = '<div class="card"><h3>' + I('eye') + ' ' + E(src.label) + ' <small>' + E(url.replace(/^https:\/\//, '')) + '</small></h3><div style="width:180px">' + svg + '</div><p class="muted" style="margin:6px 0 0">Scans open the page and are counted as ' + E(src.label) + '.</p></div>';
      if (kind === 'svg') { save(new Blob([svg], { type: 'image/svg+xml' }), 'svg'); return; }
      var img = new Image(), px = 1200; img.onload = function () { var cv = document.createElement('canvas'); cv.width = px; cv.height = px; var g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, px, px); cv.toBlob(function (b) { if (b) save(b, 'png'); }, 'image/png'); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch (x) { toastS('Could not make the QR code: ' + (x.message || x)); }
  }

  /* a repaint of the editor keeps the preview's frame (a fresh frame would reload the page each click) */
  function lpPatch(h, html) {
    var old = h.querySelector('.w230ed'), f0 = h.querySelector('#w230prev'); if (!old || !f0) return false;
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    var ned = tmp.querySelector('.w230ed'), f1 = tmp.querySelector('#w230prev');
    if (!ned || !f1 || f1.getAttribute('src') !== f0.getAttribute('src')) return false;
    old.firstElementChild.innerHTML = ned.firstElementChild.innerHTML;
    var oc = old.querySelector('.w230prevcard'), nc = ned.querySelector('.w230prevcard');
    if (oc && nc) { oc.querySelector('h3').innerHTML = nc.querySelector('h3').innerHTML; }
    while (old.previousSibling) old.parentNode.removeChild(old.previousSibling);
    while (ned.previousSibling) old.parentNode.insertBefore(ned.parentNode.firstChild, old);
    while (old.nextSibling) old.parentNode.removeChild(old.nextSibling);
    while (ned.nextSibling) old.parentNode.appendChild(ned.nextSibling);
    return true;
  }

  /* ---------- events of this section ---------- */
  function inLp(t) { return !!(t && t.closest && t.closest('#w225host')) && S.sec === 'pages'; }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!inLp(t)) return;
    var el = t.closest('[data-w230copy],[data-w230ins],[data-w230src],[data-w230arch],[data-w230sharch],[data-w230new],[data-w230days],[data-w230open],[data-w230mv],[data-w230addb],[data-w230dup],[data-w230rm],[data-w230save],[data-w230pub],[data-w230discard],[data-w230t],[data-w230pl],[data-w230pb],[data-w230win],[data-w230csv],[data-w230qr],[data-w230sadd],[data-w230soff]');
    if (!el || el.hasAttribute('disabled')) return;
    var x, d = S.lp.edit;
    if ((x = el.getAttribute('data-w230copy'))) { copyText(x); return; }
    if ((x = el.getAttribute('data-w230ins'))) { S.lp.page = x; go('#studio/pages/insights'); return; }
    if ((x = el.getAttribute('data-w230src'))) { S.lp.page = x; go('#studio/pages/sources'); return; }
    if ((x = el.getAttribute('data-w230arch'))) { var pg = lpPage(x); if (!pg) return; q(db.from('link_pages').update({ status: pg.status === 'archived' ? 'draft' : 'archived', updated_by: myName() || myEmail() }).eq('id', pg.id)).then(function (r) { if (r.error) toastS('Could not change it'); else { pg.status = pg.status === 'archived' ? 'draft' : 'archived'; paint(); } }); return; }
    if (el.hasAttribute('data-w230sharch')) { S.lp.showArchived = !S.lp.showArchived; paint(); return; }
    if (el.hasAttribute('data-w230new')) { lpCreate(); return; }
    if ((x = el.getAttribute('data-w230days'))) { S.lp.days = Number(x); paint(); return; }
    if (el.hasAttribute('data-w230csv')) { lpCsv(); return; }
    if ((x = el.getAttribute('data-w230qr'))) { var qp = x.split('|'); lpQr(qp[0], qp[1]); return; }
    if (el.hasAttribute('data-w230sadd')) { lpAddSource(); return; }
    if ((x = el.getAttribute('data-w230soff'))) { if (!confirm('Retire this source? Its address keeps working; it just leaves this list.')) return; q(db.from('link_page_sources').update({ active: false }).eq('id', Number(x))).then(function () { S.lp.sources.forEach(function (s) { if (String(s.id) === x) s.active = false; }); paint(); }); return; }
    if (!d) return;
    if ((x = el.getAttribute('data-w230open'))) { if (t.closest('[data-w230mv]')) return; S.lp.open[x] = !S.lp.open[x]; paint(); return; }
    if ((x = el.getAttribute('data-w230mv'))) { var mp = x.split('|'), i = Number(mp[1]), j = mp[0] === 'up' ? i - 1 : i + 1; if (j < 0 || j >= d.blocks.length) return; var tmp = d.blocks[i]; d.blocks[i] = d.blocks[j]; d.blocks[j] = tmp; d.dirty = true; paint(); lpPreview(); return; }
    if ((x = el.getAttribute('data-w230addb'))) { var nb = { id: 'b' + randCode(5), type: x, on: true }; if (x === 'form') nb.form = (S.lp.forms[0] || {}).slug || 'newsletter'; if (x === 'donate') { nb.label = 'Give'; nb.label_fr = 'Donner'; nb.icon = '💛'; } if (x === 'instagram') nb.count = 6; if (x === 'events') nb.count = 3; if (x === 'link') nb.url = 'https://'; d.blocks.push(nb); S.lp.open[nb.id] = true; d.dirty = true; paint(); lpPreview(); return; }
    if ((x = el.getAttribute('data-w230dup'))) { var src0 = d.blocks[Number(x)]; if (!src0) return; var cp = JSON.parse(JSON.stringify(src0)); cp.id = 'b' + randCode(5); delete cp.code; if (cp.ab) cp.ab.winner = null; d.blocks.splice(Number(x) + 1, 0, cp); S.lp.open[cp.id] = true; d.dirty = true; paint(); lpPreview(); return; }
    if ((x = el.getAttribute('data-w230rm'))) { var rb = d.blocks[Number(x)]; if (!rb || !confirm('Remove “' + (rb.label || (LPT[rb.type] || [rb.type])[0]) + '” from the page? Its past clicks stay in the insights.')) return; d.blocks.splice(Number(x), 1); d.dirty = true; paint(); lpPreview(); return; }
    if (el.hasAttribute('data-w230save')) { lpSave(null); return; }
    if ((x = el.getAttribute('data-w230pub'))) { lpSave(x); return; }
    if (el.hasAttribute('data-w230discard')) { if (!confirm('Discard the changes since the last save?')) return; S.lp.edit = null; paint(); return; }
    if ((x = el.getAttribute('data-w230t'))) { var tp = x.split('|'); d.theme = { preset: tp[1], shape: d.theme.shape }; d.dirty = true; paint(); lpPreview(); return; }
    if ((x = el.getAttribute('data-w230pl'))) { S.lp.prevLang = x; paint(); lpPreview(); return; }
    if ((x = el.getAttribute('data-w230pb'))) { S.lp.prevB = x === '1'; paint(); lpPreview(); return; }
    if (el.hasAttribute('data-w230win')) { var wp = el.getAttribute('data-w230win').split('|'), wb = d.blocks[Number(wp[0])]; if (!wb || !wb.ab) return; wb.ab.winner = wp[1] || null; if (wp[1] === 'b') { /* B becomes the text everyone sees */ } d.dirty = true; paint(); lpPreview(); toastS(wp[1] ? 'Everyone will see ' + wp[1].toUpperCase() + ' once you save' : 'The test restarts once you save'); return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!inLp(t) || !t.matches) return;
    var d = S.lp.edit; if (!d) return;
    var mark0 = function () { d.dirty = true; var m = document.querySelector('#w225host .w230bar0 .muted'); if (m) m.textContent = 'Changes not saved'; lpPreview(); };
    if (t.matches('[data-w230b]')) { lpSet(t.getAttribute('data-w230b'), t.value); mark0(); return; }
    if (t.matches('[data-w230p]')) { var k = t.getAttribute('data-w230p'); d[k] = k === 'slug' ? t.value.toLowerCase().replace(/[^a-z0-9-]/g, '') : t.value; mark0(); return; }
    if (t.matches('[data-w230s]')) { d.settings[t.getAttribute('data-w230s')] = t.value; mark0(); return; }
    if (t.matches('[data-w230so]')) { var v = t.value.trim(); if (v) d.socials[t.getAttribute('data-w230so')] = v; else delete d.socials[t.getAttribute('data-w230so')]; mark0(); return; }
    if (t.matches('[data-w230tc]')) { d.theme[t.getAttribute('data-w230tc')] = t.value; mark0(); return; }
    if (t.matches('[data-w230ab]')) { var ap = t.getAttribute('data-w230ab').split('|'), ab = d.blocks[Number(ap[0])]; if (!ab) return; ab.ab = ab.ab || {}; if (ap[1] !== 'on') { ab.ab[ap[1]] = t.value; mark0(); } return; }
    if (t.matches('[data-w230st]')) { var sp = t.getAttribute('data-w230st').split('|'), sb = d.blocks[Number(sp[0])]; if (!sb) return; sb.stats = (sb.stats || []).concat([{}, {}, {}, {}]).slice(0, 4); sb.stats[Number(sp[1])][sp[2]] = t.value; sb.stats = sb.stats.filter(function (s, k) { return s.n || s.label || k < 1; }); mark0(); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!inLp(t) || !t.matches) return;
    if (t.matches('[data-w230pg]')) { S.lp.page = t.value === 'all' ? 'all' : t.value; paint(); return; }
    var d = S.lp.edit; if (!d) return;
    if (t.matches('[data-w230bc]')) { var p = t.getAttribute('data-w230bc').split('|'), b = d.blocks[Number(p[0])]; if (!b) return; b[p[1]] = !!t.checked; d.dirty = true; paint(); lpPreview(); return; }
    if (t.matches('[data-w230ab]') && /\|on$/.test(t.getAttribute('data-w230ab'))) { var ab = d.blocks[Number(t.getAttribute('data-w230ab').split('|')[0])]; if (!ab) return; ab.ab = Object.assign(ab.ab || {}, { on: !!t.checked, started_at: ab.ab && ab.ab.started_at || new Date().toISOString() }); d.dirty = true; paint(); lpPreview(); return; }
    if (t.matches('select[data-w230b]')) { lpSet(t.getAttribute('data-w230b'), t.value); d.dirty = true; paint(); lpPreview(); return; }
    if (t.matches('[data-w230t2]')) { d.theme[t.getAttribute('data-w230t2')] = t.value; d.dirty = true; lpPreview(); return; }
    if (t.matches('select[data-w230s]')) { d.settings[t.getAttribute('data-w230s')] = t.value; d.dirty = true; lpPreview(); return; }
  });
