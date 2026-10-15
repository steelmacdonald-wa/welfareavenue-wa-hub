  /* =====================================================================
     waves 250 to 254 (15/10/26): the Meta additions in the Content Studio
     Steel, 14/10/26: "Add all of these to the hub, use the browser to set them up."
     - Messages (#studio/messages, wave251): Messenger and Instagram direct messages, read and answered here. The marketing
       team and admins reply, resolve and assign; marketing leads and admins take a conversation out of the inbox (Meta
       cannot remove one). Data social_threads / social_messages, function social-dms.
     - Paid and organic (#studio/ads, wave253): the ad accounts' spend, reach and results beside the organic numbers for the
       same days. Data social_ad_daily and hub_settings studio_ads_summary, function social-ads (read-only).
     - Connections > Meta, live (wave250) and WhatsApp (wave254): the webhook's state, what Meta lets us read, lead forms
       (wave252: lead ad sign-ups land in Applicants received), and WhatsApp's switches, templates and a test for admins.
     ===================================================================== */
  var css250 = document.createElement('style'); css250.id = 'wa250css';
  css250.textContent = ''
    + '#w225host .w250th{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 4px;border-top:1px solid rgba(16,63,57,.07);cursor:pointer;}'
    + '#w225host .w250th:first-child{border-top:0;}'
    + '#w225host .w250th:hover{background:rgba(16,63,57,.03);border-radius:12px;}'
    + '#w225host .w250th.on{background:rgba(180,70,122,.07);border-radius:12px;}'
    + '#w225host .w250th .av{width:38px;height:38px;border-radius:50%;background:rgba(16,63,57,.08);display:flex;align-items:center;justify-content:center;font-weight:800;color:' + GREEN + ';position:relative;}'
    + '#w225host .w250th .av i{position:absolute;right:-3px;bottom:-3px;}'
    + '#w225host .w250th b{font-size:13.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '#w225host .w250th .sn{font-size:12.5px;color:' + MUTED + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '#w225host .w250th .sn.new{color:' + INK + ';font-weight:600;}'
    + '#w225host .w250th .tm{font-size:11.5px;color:' + MUTED + ';text-align:right;}'
    + '#w225host .w250th .dot{display:inline-block;min-width:18px;height:18px;border-radius:999px;background:' + ROSE + ';color:#FFFAF2;font-size:10.5px;font-weight:800;line-height:18px;text-align:center;padding:0 5px;margin-top:3px;}'
    + '#w225host .w250dm{display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);gap:14px;align-items:start;}'
    + '#w225host .w250dm>.card{margin:0;}'
    + '#w225host .w250conv{display:flex;flex-direction:column;gap:6px;max-height:56vh;overflow:auto;padding:4px 2px 8px;}'
    + '#w225host .w250b{max-width:78%;padding:8px 12px;border-radius:16px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word;background:rgba(16,63,57,.06);align-self:flex-start;}'
    + '#w225host .w250b.us{background:' + GREEN + ';color:#FFFAF2;align-self:flex-end;}'
    + '#w225host .w250b small{display:block;font-size:10.5px;opacity:.7;margin-top:3px;}'
    + '#w225host .w250b a{color:inherit;text-decoration:underline;}'
    + '#w225host .w250win{font-size:12px;border-radius:12px;padding:8px 10px;margin:6px 0;}'
    + '#w225host .w250win.ok{background:rgba(42,140,122,.10);color:#1c6b5d;}'
    + '#w225host .w250win.no{background:rgba(220,165,39,.14);color:#6b4b00;}'
    + '#w225host .w250cmp{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}'
    + '#w225host .w250cmp .card{margin:0;}'
    + '#w225host .w250cmp h4{margin:0 0 8px;font-family:' + HEAD + ';font-size:18px;color:' + GREEN + ';}'
    + '#w225host .w250tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}'
    + '#w225host .w250tiles div{background:rgba(16,63,57,.04);border-radius:12px;padding:8px 10px;}'
    + '#w225host .w250tiles b{display:block;font-family:' + HEAD + ';font-size:24px;line-height:1.05;color:' + GREEN + ';}'
    + '#w225host .w250tiles span{font-size:11.5px;color:' + MUTED + ';}'
    + '#w225host .w250bars{display:flex;align-items:flex-end;gap:2px;height:70px;margin:8px 0 2px;}'
    + '#w225host .w250bars i{flex:1;background:' + ROSE + ';border-radius:3px 3px 0 0;min-height:1px;opacity:.85;}'
    + '#w225host .w250bars i.z{background:rgba(16,63,57,.10);}'
    + '#w225host .w250kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:12.5px;margin:0;}'
    + '#w225host .w250kv dt{color:' + MUTED + ';}#w225host .w250kv dd{margin:0;}'
    + '#w225host .w250ok{color:' + TEAL + ';font-weight:700;}#w225host .w250no{color:' + FLAG + ';font-weight:700;}#w225host .w250wait{color:#8a5a00;font-weight:700;}'
    + '@media (max-width:820px){#w225host .w250dm{grid-template-columns:minmax(0,1fr);}#w225host .w250cmp{grid-template-columns:minmax(0,1fr);}#w225host .w250tiles{grid-template-columns:repeat(2,minmax(0,1fr));}}';
  document.head.appendChild(css250);

  /* ---------- data ---------- */
  var M250 = { threads: [], msgs: {}, last: null, loaded: 0, sel: null, f: lsGet('w250f') || 'open', pl: '', q: '', reply: {}, busy: {}, ads: null, adsAt: 0, period: lsGet('w250p') || 'last30', daily: [], meta: null, wa: null, waEdit: null };
  async function load250(force) {
    if (!force && M250.loaded && Date.now() - M250.loaded < 30000) return;
    var since = new Date(Date.now() - 120 * 86400000).toISOString();
    var rs = await Promise.all([
      q(db.from('social_threads').select('*').gte('last_message_at', since).order('last_message_at', { ascending: false }).limit(400)),
      q(db.from('hub_settings').select('value').eq('key', 'studio_dm_sync').maybeSingle())
    ]);
    M250.threads = rs[0].data || []; M250.last = rs[1].data ? rs[1].data.value : null; M250.loaded = Date.now();
  }
  async function loadMsgs250(id) {
    var r = await q(db.from('social_messages').select('*').eq('thread_id', Number(id)).order('sent_at', { ascending: true }).limit(200));
    M250.msgs[id] = r.data || [];
  }
  async function loadAds250(force) {
    if (!force && M250.ads && Date.now() - M250.adsAt < 60000) return;
    try { var r = await fn('social-ads', { action: 'summary' }); M250.ads = (r && r.summary) || { accounts: [] }; } catch (e) { M250.ads = { error: e.message || String(e), accounts: [] }; }
    var d = await q(db.from('social_ad_daily').select('day, spend, results, reach, clicks').gte('day', addDays(today(), -89)).order('day', { ascending: true }).limit(3000));
    M250.daily = d.data || []; M250.adsAt = Date.now();
  }
  function counts250() { return M250.threads.filter(function (t) { return t.status === 'open' && !t.last_from_us; }).length || null; }

  /* ---------- Messages ---------- */
  var PLM = { facebook: ['Messenger', '#0866FF'], instagram: ['Instagram', '#C13584'] };
  function winOf(t) {
    if (!t.last_inbound_at) return { open: false, until: null };
    var until = new Date(new Date(t.last_inbound_at).getTime() + 24 * 3600000);
    return { open: until.getTime() > Date.now(), until: until };
  }
  function thName(t) { return t.participant_handle ? '@' + t.participant_handle : (t.participant_name || 'Someone'); }
  function limitNote250() {
    var r = M250.last && M250.last.result ? M250.last.result : null; if (!r) return '';
    var bits = [];
    if (r.instagram && (r.instagram.limited === 'needs_advanced_access' || /role on app|advanced access/i.test(String(r.instagram.error || '')))) bits.push('Instagram only shows the conversations Meta allows before App Review (instagram_manage_messages, Advanced Access). Until it is approved, answer most Instagram messages in Meta Business Suite.');
    if (r.facebook && r.facebook.error) bits.push('Messenger could not be read: ' + clip(r.facebook.error, 140));
    if (r.instagram && r.instagram.error && !/role on app|advanced access/i.test(String(r.instagram.error))) bits.push('Instagram could not be read: ' + clip(r.instagram.error, 140));
    return bits.length ? '<div class="card" style="background:rgba(220,165,39,.10)">' + I('warn') + ' ' + bits.map(E).join(' ') + ' <a href="https://business.facebook.com/latest/inbox/all" target="_blank" rel="noopener" style="font-weight:700">Open Meta Business Suite</a></div>' : '';
  }
  function threadHtml250(t) {
    var msgs = M250.msgs[t.id];
    var mk = S.mk, pub = S.pub, w = winOf(t), r = M250.reply[t.id];
    var replies = lib().filter(function (x) { return x.kind === 'reply'; });
    var conv = !msgs ? '<div class="empty">Loading the conversation…</div>' : !msgs.length ? '<div class="empty">No messages kept for this conversation yet.</div>' :
      '<div class="w250conv">' + msgs.map(function (m) {
        var att = (m.attachments || []).map(function (a) { return a.url ? '<a href="' + E(a.url) + '" target="_blank" rel="noopener">' + E(a.name || ('[' + a.type + ']')) + '</a>' : E(a.name || ('[' + a.type + ']')); }).join(' ');
        return '<div class="w250b' + (m.from_us ? ' us' : '') + '">' + E(m.text || '') + (att ? (m.text ? '<br>' : '') + att : '') + '<small>' + E(niceWhen(m.sent_at)) + (m.from_us && m.sent_by ? ' · ' + E(m.sent_by) : '') + '</small></div>';
      }).join('') + '</div>';
    var win = w.open ? '<div class="w250win ok">' + I('clock') + ' You can answer here until ' + E(niceWhen(w.until.toISOString())) + ' (Meta allows 24 hours after their last message).</div>'
      : '<div class="w250win no">' + I('clock') + ' ' + (t.last_inbound_at ? 'More than 24 hours since their last message: Meta only lets a Page answer within 24 hours. ' : '') + 'Answer in <a href="https://business.facebook.com/latest/inbox/all" target="_blank" rel="noopener" style="font-weight:700">Meta Business Suite</a>.</div>';
    var acts = mk ? '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">' +
      (w.open && !r ? '<a class="btn225 sm pri" data-w250rp="' + t.id + '">' + I('chat') + ' Reply</a>' : '') +
      (t.status === 'open' ? '<a class="btn225 sm" data-w250act="dm_resolve|' + t.id + '">' + I('check') + ' Resolve</a>' : t.status === 'resolved' ? '<a class="btn225 sm" data-w250act="dm_reopen|' + t.id + '">Reopen</a>' : '') +
      '<select data-w250assign="' + t.id + '" aria-label="Assign" style="font-size:11.5px;padding:4px 8px;border-radius:999px"><option value="">' + (t.assigned_to ? 'Assigned: ' + E(t.assigned_to) : 'Assign…') + '</option>' + members().filter(function (m) { return m.department === 'marketing' || m.department === 'exec'; }).map(function (m) { return '<option value="' + E(m.name) + '">' + E(m.name) + '</option>'; }).join('') + '</select>' +
      '<span class="sp"></span>' +
      (pub ? (t.status === 'archived' ? '<a class="btn225 sm" data-w250act="dm_unarchive|' + t.id + '">Bring back</a>' : '<a class="btn225 sm bad" data-w250act="dm_archive|' + t.id + '" title="Meta keeps the conversation; this takes it out of the Hub’s inbox">' + I('trash') + ' Remove</a>') : '') + '</div>' : '';
    var box = r ? '<div class="rbox" style="margin-top:8px"><textarea data-w250rtext="' + t.id + '" placeholder="Reply as Welfare Avenue" style="width:100%;min-height:84px">' + E(r.text || '') + '</textarea><div class="row" style="margin-top:6px">' +
      (replies.length ? '<select data-w250saved="' + t.id + '"><option value="">Saved replies…</option>' + replies.map(function (x) { return '<option value="' + x.id + '">' + E(x.name) + '</option>'; }).join('') + '</select>' : '') +
      '<a class="btn225 sm" data-w250ai="' + t.id + '"' + (r.busy ? ' disabled' : '') + '>' + I('star') + (r.busy ? ' Writing…' : ' Suggest a reply') + '</a><span class="sp"></span><a class="btn225 sm" data-w250rpx="' + t.id + '">Cancel</a><a class="btn225 sm pri" data-w250send="' + t.id + '"' + (r.sending ? ' disabled' : '') + '>' + I('send') + (r.sending ? ' Sending…' : ' Send') + '</a></div></div>' : '';
    return '<div class="card" data-w250conv="' + t.id + '"><div class="row" style="margin:0 0 6px"><b style="font-size:15px">' + E(thName(t)) + '</b><span class="muted">' + E((PLM[t.platform] || [t.platform])[0]) + (t.assigned_to ? ' · for ' + E(t.assigned_to) : '') + (t.status !== 'open' ? ' · ' + E(t.status) : '') + '</span><span class="sp"></span><a class="btn225 sm" data-w250close="1">' + I('x') + ' Close</a></div>' +
      conv + win + acts + box + '</div>';
  }
  function messagesHtml() {
    if (!S.mk && !S.pub) return '<div class="card"><div class="empty">Messages are for the marketing team and admins.</div></div>';
    if (!M250.loaded) { load250().then(paint); return '<div class="card"><div class="empty">Loading the messages…</div></div>'; }
    var all = M250.threads, f = M250.f;
    var c = { open: all.filter(function (t) { return t.status === 'open'; }).length, resolved: all.filter(function (t) { return t.status === 'resolved'; }).length, archived: all.filter(function (t) { return t.status === 'archived'; }).length, all: all.filter(function (t) { return t.status !== 'archived'; }).length };
    var list = all.filter(function (t) {
      if (f === 'open' && t.status !== 'open') return false;
      if (f === 'resolved' && t.status !== 'resolved') return false;
      if (f === 'archived' && t.status !== 'archived') return false;
      if (f === 'all' && t.status === 'archived') return false;
      if (M250.pl && t.platform !== M250.pl) return false;
      if (M250.q && (lower(t.participant_name) + ' ' + lower(t.participant_handle) + ' ' + lower(t.last_snippet)).indexOf(lower(M250.q)) < 0) return false;
      return true;
    });
    var waiting = all.filter(function (t) { return t.status === 'open' && !t.last_from_us; });
    var closing = waiting.filter(function (t) { var w = winOf(t); return w.open && w.until.getTime() - Date.now() < 4 * 3600000; }).length;
    var last = M250.last;
    var head = '<div class="kpis"><div class="kpi"><b class="' + (waiting.length ? 'warn' : 'ok') + '">' + waiting.length + '</b><span>waiting for us</span></div>' +
      '<div class="kpi"><b class="' + (closing ? 'warn' : '') + '">' + closing + '</b><span>window closing</span><em>under 4 hours left to answer here</em></div>' +
      '<div class="kpi"><b>' + all.filter(function (t) { return t.replied_at && Date.now() - new Date(t.replied_at).getTime() < 7 * 86400000; }).length + '</b><span>answered from the Hub</span><em>last 7 days</em></div>' +
      '<div class="kpi"><b style="font-size:18px">' + E(last && last.at ? ago(last.at) : 'never') + '</b><span>last check</span><em><a data-w250sync="1" style="cursor:pointer;color:' + ROSE + ';font-weight:700">' + (M250.busy.sync ? 'Checking…' : 'Check now') + '</a></em></div></div>' + limitNote250();
    var filters = '<div class="row" style="margin:0 0 12px"><span class="seg">' + [['open', 'Open'], ['resolved', 'Answered'], ['all', 'Everything'], ['archived', 'Removed']].map(function (x) { return '<a data-w250f="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '">' + x[1] + '<span class="n">' + c[x[0]] + '</span></a>'; }).join('') + '</span>' +
      '<span class="seg"><a data-w250pl="" class="' + (!M250.pl ? 'on' : '') + '">All</a><a data-w250pl="facebook" class="' + (M250.pl === 'facebook' ? 'on' : '') + '">Messenger</a><a data-w250pl="instagram" class="' + (M250.pl === 'instagram' ? 'on' : '') + '">Instagram</a></span>' +
      '<span class="sp"></span><input type="search" data-w250q placeholder="Search messages" value="' + E(M250.q) + '"></div>';
    var rows = list.map(function (t) {
      var nm = thName(t), pm = PLM[t.platform] || ['', MUTED];
      return '<div class="w250th' + (String(M250.sel) === String(t.id) ? ' on' : '') + '" data-w250open="' + t.id + '"><div class="av">' + E(String(nm).replace(/^@/, '').charAt(0).toUpperCase() || '?') + '<i class="w225pm ok" style="background:' + pm[1] + '" title="' + E(pm[0]) + '">' + (t.platform === 'instagram' ? 'IG' : 'm') + '</i></div>' +
        '<div style="min-width:0"><b>' + E(nm) + '</b><div class="sn' + (t.unread && !t.last_from_us ? ' new' : '') + '">' + (t.last_from_us ? 'You: ' : '') + E(clip(t.last_snippet || '', 90)) + '</div></div>' +
        '<div class="tm">' + E(ago(t.last_message_at)) + (t.unread && !t.last_from_us ? '<br><span class="dot">' + t.unread + '</span>' : '') + '</div></div>';
    }).join('');
    var sel = M250.sel ? all.filter(function (t) { return String(t.id) === String(M250.sel); })[0] : null;
    var right = sel ? threadHtml250(sel) : '<div class="card"><div class="empty">' + (list.length ? 'Pick a conversation to read it and answer.' : '') + '</div></div>';
    var empty = all.length ? (f === 'open' ? 'Every message is answered.' : 'Nothing matches.') : 'No direct messages in the Hub yet. They arrive within 10 minutes of being sent, at once when Meta reports them.';
    return head + filters + '<div class="w250dm"><div class="card">' + (rows || '<div class="empty">' + E(empty) + '</div>') + '</div>' + right + '</div>';
  }
  async function dmAct250(action, id, extra) {
    try {
      await fn('social-dms', Object.assign({ action: action, id: Number(id) }, extra || {}));
      toastS({ dm_reply: 'Sent', dm_resolve: 'Marked answered', dm_reopen: 'Reopened', dm_assign: 'Assigned', dm_archive: 'Removed from the inbox', dm_unarchive: 'Back in the inbox', dm_read: 'Read' }[action] || 'Done');
      if (action === 'dm_reply') delete M250.reply[id];
      if (action === 'dm_archive') M250.sel = null;
      await load250(true); if (M250.sel) await loadMsgs250(M250.sel);
    } catch (x) { toastS((x.message || String(x))); if (M250.reply[id]) M250.reply[id].sending = false; }
    paint(); try { if (window.w153) window.w153.paint(); } catch (e) { /* fine */ }
  }
  async function sync250() {
    if (M250.busy.sync) return; M250.busy.sync = true; paint();
    try {
      var r = await fn('social-dms', { action: 'dm_sync', days: 14 });
      var m = (r && r.messages) || {}, added = Number((m.facebook || {}).added || 0) + Number((m.instagram || {}).added || 0);
      toastS(added ? added + ' new message' + (added === 1 ? '' : 's') : 'Checked: nothing new');
      await load250(true); if (M250.sel) await loadMsgs250(M250.sel);
    } catch (x) { toastS('Could not check: ' + (x.message || x)); }
    M250.busy.sync = false; paint(); try { if (window.w153) window.w153.paint(); } catch (e) { /* fine */ }
  }
  var DM_SYSTEM = 'You answer direct messages sent to Welfare Avenue on Messenger or Instagram. Welfare Avenue is a youth-powered charity in Montreal and Toronto that serves meals and builds community. Write one reply as Welfare Avenue: warm, specific, short (two or three sentences), plain words. Use their first name when you have it. Answer only with what the conversation says or with these: volunteering sign-ups at hub.welfareavenue.com/links, questions to info@welfareavenue.com. Never promise anything, never invent facts, dates or numbers. Reply in the language of their last message (Quebec French for French). No em dashes.';
  async function suggest250(id) {
    var t = M250.threads.filter(function (x) { return String(x.id) === String(id); })[0]; if (!t) return;
    var r = M250.reply[id] = M250.reply[id] || { text: '' }; r.busy = true; paint();
    try {
      var convo = (M250.msgs[id] || []).slice(-12).map(function (m) { return (m.from_us ? 'WELFARE AVENUE: ' : 'THEM (' + (t.participant_name || t.participant_handle || 'someone') + '): ') + (m.text || '[attachment]'); }).join('\n');
      var res = await db.functions.invoke('llm', { body: { task: 'draft', caller: 'content-studio', max_tokens: 300, temperature: 0.5, system: DM_SYSTEM, messages: [{ role: 'user', content: 'PLATFORM: ' + t.platform + '\nCONVERSATION:\n' + clip(convo, 3000) }] } });
      if (res.error) throw res.error;
      var txt = ((res.data && res.data.content) || []).filter(function (x) { return x.type === 'text'; }).map(function (x) { return x.text; }).join(' ').replace(/—/g, ',').trim();
      if (!txt) throw new Error('nothing came back');
      r.text = txt;
    } catch (x) { toastS('The Hub could not help this time: ' + (x.message || x)); }
    r.busy = false; paint();
  }

  /* ---------- Paid and organic ---------- */
  var PER = [['last7', '7 days', 7], ['last30', '30 days', 30], ['last90', '90 days', 90]];
  function money(v, cur) { v = Number(v) || 0; return (cur === 'CAD' || !cur ? '$' : '') + (v >= 1000 ? Math.round(v).toLocaleString('en-CA') : v.toFixed(2).replace(/\.00$/, '')) + (cur && cur !== 'CAD' ? ' ' + cur : ''); }
  var RESW = { link_click: 'link clicks', landing_page_view: 'landing page views', lead: 'leads', 'onsite_conversion.lead_grouped': 'leads', 'offsite_conversion.fb_pixel_lead': 'leads', 'onsite_conversion.messaging_conversation_started_7d': 'conversations', post_engagement: 'engagements', page_engagement: 'engagements', like: 'Page likes', video_view: 'video views', reach: 'people reached', purchase: 'purchases', donate_total: 'donations', none: 'results' };
  function adsHtml() {
    if (!M250.ads) { loadAds250().then(paint); return '<div class="card"><div class="empty">Reading the ad accounts…</div></div>'; }
    var per = PER.filter(function (p) { return p[0] === M250.period; })[0] || PER[1], days = per[2], from = addDays(today(), -(days - 1));
    var accs = (M250.ads.accounts || []), cur = (accs[0] && accs[0].currency) || 'CAD';
    var paid = { spend: 0, reach: 0, impressions: 0, clicks: 0, results: 0 }, camps = [];
    accs.forEach(function (a) { var p = a[per[0]] || {}; if (p.error) return; ['spend', 'reach', 'impressions', 'clicks', 'results'].forEach(function (k) { paid[k] += Number(p[k] || 0); }); (p.campaigns || []).forEach(function (c) { camps.push(Object.assign({ account: a.name || a.id }, c)); }); });
    var org = S.social.filter(function (p) { return p.published_at && dayOf(p.published_at) >= from; });
    var o = { posts: org.length, reach: 0, views: 0, eng: 0 }; org.forEach(function (p) { o.reach += Number(p.reach || 0); o.views += Number(p.views || 0); o.eng += Number(p.engagement || ((p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0)) || 0); });
    var byDay = {}; M250.daily.forEach(function (r) { if (r.day >= from) byDay[r.day] = (byDay[r.day] || 0) + Number(r.spend || 0); });
    var dd = []; for (var i = days - 1; i >= 0; i--) dd.push(addDays(today(), -i)); var mx = Math.max.apply(null, dd.map(function (d) { return byDay[d] || 0; }).concat([0.01]));
    var bars = '<div class="w250bars" aria-label="Spend by day">' + dd.map(function (d) { var v = byDay[d] || 0; return '<i class="' + (v ? '' : 'z') + '" style="height:' + Math.max(2, Math.round(v / mx * 100)) + '%" title="' + E(niceDate(d)) + ': ' + E(money(v, cur)) + '"></i>'; }).join('') + '</div><div class="row muted" style="font-size:11px"><span>' + E(niceDate(from)) + '</span><span class="sp"></span><span>' + E(niceDate(today())) + '</span></div>';
    var cpr = paid.results ? paid.spend / paid.results : null;
    var head = '<div class="row" style="margin:0 0 12px"><span class="seg">' + PER.map(function (p) { return '<a data-w250per="' + p[0] + '" class="' + (M250.period === p[0] ? 'on' : '') + '">' + p[1] + '</a>'; }).join('') + '</span><span class="sp"></span>' +
      '<span class="muted" style="font-size:12px">' + (M250.ads.at ? 'Read ' + E(ago(M250.ads.at)) : 'Not read yet') + '</span><a class="btn225 sm" data-w250adsync="1"' + (M250.busy.ads ? ' disabled' : '') + '>' + I('refresh') + (M250.busy.ads ? ' Reading…' : ' Refresh') + '</a></div>';
    var orgCard = '<div class="card"><h4>Organic</h4><div class="w250tiles"><div><b>' + num(o.posts) + '</b><span>posts</span></div><div><b>' + num(o.reach) + '</b><span>reach (sum of posts)</span></div><div><b>' + num(o.eng) + '</b><span>engagements</span></div></div>' +
      '<p class="muted" style="margin:8px 0 0;font-size:12px">Instagram and Facebook posts published in the last ' + days + ' days, from Analytics. <a data-w225go="#socialstats" style="cursor:pointer;font-weight:700">Open Analytics</a></p></div>';
    var paidCard = '<div class="card"><h4>Paid</h4><div class="w250tiles"><div><b>' + E(money(paid.spend, cur)) + '</b><span>spent</span></div><div><b>' + num(paid.reach) + '</b><span>people reached</span></div><div><b>' + num(paid.results) + '</b><span>results' + (cpr ? ' · ' + E(money(cpr, cur)) + ' each' : '') + '</span></div></div>' +
      bars + '<p class="muted" style="margin:6px 0 0;font-size:12px">' + num(paid.impressions) + ' impressions, ' + num(paid.clicks) + ' clicks. Read-only from Meta’s ad accounts; the Hub never changes an ad.</p></div>';
    var table = camps.length ? '<div class="card"><b>Campaigns, last ' + days + ' days</b><div style="overflow-x:auto"><table class="rt" style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px"><tr><th align="left">Campaign</th><th align="right">Spent</th><th align="right">Reach</th><th align="right">Results</th><th align="right">Each</th></tr>' +
      camps.sort(function (x, y) { return y.spend - x.spend; }).map(function (cpn) { return '<tr><td style="white-space:normal">' + E(clip(cpn.name || cpn.id, 80)) + '<br><span class="muted">' + E(String(cpn.objective || '').replace(/^OUTCOME_/, '').replace(/_/g, ' ').toLowerCase()) + '</span></td><td align="right">' + E(money(cpn.spend, cur)) + '</td><td align="right">' + num(cpn.reach) + '</td><td align="right">' + num(cpn.results) + ' <span class="muted">' + E(RESW[cpn.result_type] || '') + '</span></td><td align="right">' + (cpn.results ? E(money(cpn.spend / cpn.results, cur)) : '–') + '</td></tr>'; }).join('') + '</table></div></div>'
      : '<div class="card"><div class="empty">No ads ran in the last ' + days + ' days.' + (accs.length ? ' Lifetime spend: ' + accs.map(function (a) { return E(a.name || a.id) + ' ' + E(money(a.lifetime_spend, a.currency)); }).join(', ') + '.' : '') + '</div></div>';
    var err = M250.ads.error ? '<div class="card" style="background:rgba(179,64,47,.08)">Could not read the ad accounts: ' + E(clip(M250.ads.error, 160)) + '</div>' : '';
    return err + head + '<div class="w250cmp">' + orgCard + paidCard + '</div><div style="height:14px"></div>' + table +
      '<p class="muted" style="margin:6px 0 0">Ad accounts: ' + (accs.length ? accs.map(function (a) { return E(a.name && a.name !== String(a.id).replace('act_', '') ? a.name : a.id); }).join(', ') : 'none found') + '. <a href="https://adsmanager.facebook.com/adsmanager/manage/campaigns" target="_blank" rel="noopener">Open Ads Manager</a></p>';
  }

  /* ---------- Connections: Meta live, and WhatsApp ---------- */
  function yes250(b, t, f) { return b ? '<span class="w250ok">' + E(t || 'Yes') + '</span>' : '<span class="w250no">' + E(f || 'No') + '</span>'; }
  function metaLiveCard250() {
    var adm = isAdmin();
    var m = M250.meta;
    var body;
    if (!adm) body = '<p class="muted" style="margin:0">Admins see the details here. Comments and messages arrive as they happen; the 10-minute check catches anything missed.</p>';
    else if (!m) body = '<p class="muted" style="margin:0">' + (M250.busy.meta ? 'Checking…' : '<a data-w250cx="meta" style="cursor:pointer;font-weight:700">Check the live connection</a>') + '</p>';
    else if (m.error) body = '<p class="w250no" style="margin:0">' + E(m.error) + '</p>';
    else {
      var ps = m.page_subscription || {}, ev = m.events_7d || {}, evn = Object.keys(ev).reduce(function (s, k) { return s + ev[k]; }, 0);
      var forms = Array.isArray(m.lead_forms) ? m.lead_forms : [];
      body = '<dl class="w250kv">' +
        '<dt>Live updates</dt><dd>' + yes250(!!ps.subscribed, 'On: ' + (ps.fields || []).join(', '), 'Off') + '</dd>' +
        '<dt>Signed by Meta</dt><dd>' + yes250(!!m.app_secret, 'Checked', 'No app secret') + '</dd>' +
        '<dt>Last update</dt><dd>' + E(m.last_event ? ago(m.last_event) : 'none yet') + (evn ? ' · ' + evn + ' in 7 days' : '') + '</dd>' +
        '<dt>Messenger</dt><dd>' + (m.messenger && m.messenger.readable ? '<span class="w250ok">Readable</span>' : yes250(false, '', clip((m.messenger || {}).error || 'Not readable', 80))) + '</dd>' +
        '<dt>Instagram DMs</dt><dd>' + (m.instagram_dm && m.instagram_dm.readable ? '<span class="w250ok">Readable</span>' : '<span class="w250wait">Limited until App Review</span>') + '</dd>' +
        '<dt>Lead forms</dt><dd>' + (forms.length ? forms.length + ' (' + E(forms.map(function (x) { return x.name; }).slice(0, 3).join(', ')) + ')' : 'None yet') + ': sign-ups go to Applicants received</dd>' +
        '<dt>Ad accounts</dt><dd>' + E((m.ad_accounts || []).map(function (a) { return a.name; }).join(', ') || 'none') + '</dd></dl>';
    }
    return '<div class="card"><div class="hd"><div class="lg" style="background:#0866FF">' + I('bolt') + '</div><div><b>Meta, live</b><small>Comments, messages, lead ads and paid results as they happen</small></div></div>' + body +
      (adm ? '<div class="row"><span class="sp"></span>' + (m && !m.error ? '<a class="btn225 sm" data-w250cx="resub">' + I('refresh') + ' Subscribe again</a>' : '') + '<a class="btn225 sm" data-w250cx="meta">' + I('refresh') + ' Check</a></div>' : '') + '</div>';
  }
  function waCard250() {
    var adm = isAdmin(), w = M250.wa;
    if (!w) return '<div class="card"><div class="hd"><div class="lg" style="background:#25D366">' + I('chat') + '</div><div><b>WhatsApp</b><small>Serving reminders and “still in?” beside the texts</small></div></div><p class="muted" style="margin:0">' + (M250.busy.wa ? 'Checking…' : '<a data-w250cx="wa" style="cursor:pointer;font-weight:700">Check WhatsApp</a>') + '</p></div>';
    if (w.error) return '<div class="card"><div class="hd"><div class="lg" style="background:#25D366">' + I('chat') + '</div><div><b>WhatsApp</b></div></div><p class="w250no" style="margin:0">' + E(w.error) + '</p></div>';
    var num0 = w.number || {}, acc = w.account || {}, tps = Array.isArray(w.templates) ? w.templates : [];
    var test = /555/.test(String(num0.display_phone_number || '')) || /test/i.test(String(num0.verified_name || ''));
    var tpl = tps.length ? tps.map(function (t) { return '<span class="' + (t.status === 'APPROVED' ? '' : 'miss') + '" title="' + E(t.rejected_reason || '') + '">' + E(t.name.replace(/^wa_/, '').replace(/_/g, ' ') + ' ' + t.language + ': ' + String(t.status || '').toLowerCase()) + '</span>'; }).join('') : '<span class="miss">no templates yet</span>';
    var ed = M250.waEdit || { mode: w.mode, channel: w.channel, tests: '' };
    var ctrl = adm ? '<div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 10px;align-items:center;font-size:12.5px">' +
      '<label for="w250wmode">Sending</label><select id="w250wmode">' + [['off', 'Off: nothing is sent'], ['test', 'Test: the test phones only'], ['live', 'Live: everyone']].map(function (x) { return '<option value="' + x[0] + '"' + (ed.mode === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
      '<label for="w250wchan">With the texts</label><select id="w250wchan">' + [['off', 'Texts only'], ['also', 'Texts and WhatsApp']].map(function (x) { return '<option value="' + x[0] + '"' + (ed.channel === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
      '<label for="w250wtest">Test phones</label><input id="w250wtest" placeholder="' + (w.test_phones ? w.test_phones + ' saved; type to replace' : '514 555 0123, 438 555 0199') + '" value="' + E(ed.tests || '') + '"></div>' +
      '<div class="row"><a class="btn225 sm" data-w250cx="watest">' + I('send') + ' Send me a test</a><span class="sp"></span><a class="btn225 sm pri" data-w250cx="wasave">Save</a></div>' : '<p class="muted" style="margin:0">An admin changes these.</p>';
    return '<div class="card"><div class="hd"><div class="lg" style="background:#25D366">' + I('chat') + '</div><div><b>WhatsApp</b><small>Serving reminders and “still in?” beside the texts</small></div></div>' +
      '<dl class="w250kv"><dt>Number</dt><dd>' + E(num0.display_phone_number || '–') + (test ? ' <span class="w250wait">Meta’s test number</span>' : '') + '</dd>' +
      '<dt>Business</dt><dd>' + E(String(acc.business_verification_status || '–').replace(/_/g, ' ')) + '</dd>' +
      '<dt>Now</dt><dd>' + (w.mode === 'off' ? '<span class="w250wait">Off</span>' : w.mode === 'test' ? '<span class="w250wait">Test</span>' : '<span class="w250ok">Live</span>') + (w.channel === 'also' ? ', with the texts' : ', not with the texts') + '</dd></dl>' +
      '<div class="chips">' + tpl + '</div>' +
      '<p class="muted" style="margin:0;font-size:12px">The same hours as the texts (9 am to 7 pm), nobody who said STOP, YES or NO and the buttons confirm or decline. WhatsApp cannot post into groups. Going live needs Welfare Avenue’s own number, the business verified and a payment method in the Meta app.</p>' + ctrl + '</div>';
  }
  async function connAct250(a) {
    try {
      if (a === 'meta' || a === 'resub') {
        M250.busy.meta = true; paint();
        if (a === 'resub') { await fn('meta-events', { action: 'subscribe' }); await fn('meta-events', { action: 'app_subscribe' }); toastS('Subscribed again'); }
        M250.meta = await fn('meta-events', { action: 'status' });
      }
      if (a === 'wa') { M250.busy.wa = true; paint(); M250.wa = await fn('whatsapp-send', { action: 'status' }); }
      if (a === 'wasave') {
        var mode = (document.getElementById('w250wmode') || {}).value || 'off', chan = (document.getElementById('w250wchan') || {}).value || 'off', tests = String((document.getElementById('w250wtest') || {}).value || '').trim();
        if (mode === 'live' && !confirm('Live: WhatsApp messages go to volunteers whenever a confirmation or "still in?" text goes out. Turn it on?')) return;
        var rows = [{ key: 'sms_whatsapp_mode', value: mode }, { key: 'sms_whatsapp_channel', value: chan }];
        if (tests) rows.push({ key: 'sms_whatsapp_test_phones', value: tests.split(/[,;\n]+/).map(function (x) { return x.replace(/\D/g, '').slice(-10); }).filter(function (x) { return x.length === 10; }).join(',') });
        for (var i = 0; i < rows.length; i++) { var r = await db.from('app_config').update({ value: rows[i].value }).eq('key', rows[i].key); if (r.error) throw r.error; }
        M250.waEdit = null; toastS('Saved'); M250.wa = await fn('whatsapp-send', { action: 'status' });
      }
      if (a === 'watest') {
        var w = M250.wa || {}, tp = (w.templates || []).filter(function (t) { return t.status === 'APPROVED'; })[0];
        var tpl = tp ? tp.name : 'hello_world';
        if (!confirm('Send one WhatsApp message (' + (tp ? tpl.replace(/^wa_/, '').replace(/_/g, ' ') : 'Meta’s hello world') + ') to the first test phone?')) return;
        var t = await fn('whatsapp-send', { action: 'test', template: tpl, lang: tp && tp.language === 'fr' ? 'fr' : 'en' });
        toastS(t.ok ? 'Sent: check WhatsApp on the test phone' : 'Not sent: ' + (t.error || 'unknown'));
      }
    } catch (x) { toastS(x.message || String(x)); }
    M250.busy.meta = false; M250.busy.wa = false; paint();
  }
  function connectExtra250() { return metaLiveCard250() + waCard250(); }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!inApp(t)) return;
    var el = t.closest('[data-w250open],[data-w250f],[data-w250pl],[data-w250sync],[data-w250close],[data-w250rp],[data-w250rpx],[data-w250send],[data-w250ai],[data-w250act],[data-w250per],[data-w250adsync],[data-w250cx]'); if (!el) return;
    if (el.hasAttribute('disabled')) { e.preventDefault(); return; }
    var x;
    if ((x = el.getAttribute('data-w250open'))) { M250.sel = x; paint(); loadMsgs250(x).then(function () { paint(); var c = document.querySelector('#w225host .w250conv'); if (c) c.scrollTop = c.scrollHeight; }); var th = M250.threads.filter(function (z) { return String(z.id) === x; })[0]; if (th && th.unread && S.mk) fn('social-dms', { action: 'dm_read', id: Number(x) }).then(function () { th.unread = 0; paint(); try { if (window.w153) window.w153.paint(); } catch (er) { /* fine */ } }, function () { /* fine */ }); return; }
    if (el.hasAttribute('data-w250f')) { M250.f = el.getAttribute('data-w250f') || 'open'; lsSet('w250f', M250.f); paint(); return; }
    if (el.hasAttribute('data-w250pl')) { M250.pl = el.getAttribute('data-w250pl'); paint(); return; }
    if (el.hasAttribute('data-w250sync')) { sync250(); return; }
    if (el.hasAttribute('data-w250close')) { M250.sel = null; paint(); return; }
    if ((x = el.getAttribute('data-w250rp'))) { M250.reply[x] = M250.reply[x] || { text: '' }; paint(); var ta = document.querySelector('#w225host [data-w250rtext="' + x + '"]'); if (ta) ta.focus(); return; }
    if ((x = el.getAttribute('data-w250rpx'))) { delete M250.reply[x]; paint(); return; }
    if ((x = el.getAttribute('data-w250ai'))) { suggest250(x); return; }
    if ((x = el.getAttribute('data-w250send'))) { var rr = M250.reply[x]; if (!rr || !String(rr.text || '').trim()) { toastS('Write the reply first'); return; } rr.sending = true; paint(); dmAct250('dm_reply', x, { text: String(rr.text).trim() }); return; }
    if ((x = el.getAttribute('data-w250act'))) { var ap = x.split('|'); dmAct250(ap[0], ap[1]); return; }
    if ((x = el.getAttribute('data-w250per'))) { M250.period = x; lsSet('w250p', x); paint(); return; }
    if (el.hasAttribute('data-w250adsync')) { M250.busy.ads = true; paint(); fn('social-ads', { action: 'sync', days: 30 }).then(function () { return loadAds250(true); }).then(function () { toastS('The ad accounts are read again'); }, function (er) { toastS('Could not read them: ' + (er.message || er)); }).then(function () { M250.busy.ads = false; paint(); }); return; }
    if ((x = el.getAttribute('data-w250cx'))) { e.preventDefault(); connAct250(x); return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!inApp(t) || !t.matches) return;
    if (t.matches('[data-w250q]')) { M250.q = t.value; soon(); return; }
    if (t.matches('[data-w250rtext]')) { var id = t.getAttribute('data-w250rtext'); (M250.reply[id] = M250.reply[id] || {}).text = t.value; return; }
    if (t.matches('#w250wtest')) { M250.waEdit = M250.waEdit || { mode: (M250.wa || {}).mode, channel: (M250.wa || {}).channel }; M250.waEdit.tests = t.value; return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!inApp(t) || !t.matches) return;
    if (t.matches('[data-w250assign]')) { dmAct250('dm_assign', t.getAttribute('data-w250assign'), { to: t.value }); return; }
    if (t.matches('[data-w250saved]')) {
      var tid = t.getAttribute('data-w250saved'), sn = lib().filter(function (x) { return String(x.id) === t.value; })[0]; if (!sn) return;
      var th = M250.threads.filter(function (x) { return String(x.id) === tid; })[0], nm = th ? String(th.participant_name || th.participant_handle || '').split(' ')[0] : '';
      var r = M250.reply[tid] = M250.reply[tid] || {}; r.text = String(sn.body || '').replace(/\{name\}/g, nm || 'there');
      q(db.from('content_snippets').update({ uses: Number(sn.uses || 0) + 1 }).eq('id', sn.id)); paint(); return;
    }
    if (t.matches('#w250wmode,#w250wchan')) { M250.waEdit = M250.waEdit || { tests: '' }; M250.waEdit.mode = (document.getElementById('w250wmode') || {}).value; M250.waEdit.channel = (document.getElementById('w250wchan') || {}).value; return; }
  });
