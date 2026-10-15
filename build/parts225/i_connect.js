
  /* ---------- connections: how the Hub reaches each platform ---------- */
  var REDIRECT = 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/social-connect';
  var CONSOLE = {
    threads: ['https://developers.facebook.com/apps/', 'Meta for Developers: the Welfare Avenue Threads app, Use cases, Access the Threads API, Settings'],
    youtube: ['https://console.cloud.google.com/apis/credentials', 'Google Cloud: APIs and services, Credentials, the Web client'],
    tiktok: ['https://developers.tiktok.com/apps/', 'TikTok for Developers: Manage apps, the Welfare Avenue app, Basic information'],
    linkedin: ['https://www.linkedin.com/developers/apps', 'LinkedIn Developers: My apps, the Welfare Avenue app, Auth']
  };
  var CX_STEPS = {
    threads: ['Steel adds the Welfare Avenue Threads account as a Threads tester in the app and accepts the invite in Threads (Settings, Account, Website permissions).', 'Copy the Threads app ID and app secret below and save them.', 'Press Connect and sign in to Threads as @welfareavenue.'],
    youtube: ['In Google Cloud, the OAuth client lists the redirect address below and the YouTube Data API v3 is on.', 'Copy the client ID and client secret below and save them.', 'Press Connect and pick the Welfare Avenue channel (the brand account).'],
    tiktok: ['The TikTok app has Login Kit and Content Posting API with video.upload, and the redirect address below.', 'Copy the client key and client secret below and save them.', 'Press Connect and sign in to TikTok as Welfare Avenue. Videos then land in the TikTok drafts to finish in the app.'],
    linkedin: ['Once LinkedIn approves the Community Management API, copy the client ID and secret below.', 'Press Connect and sign in as a Page admin. Until then, the Make route below posts to the Page.']
  };
  function connOf(k) { return (S.conn && S.conn.connections && S.conn.connections[k]) || {}; }
  function chips(list, cls) { return (list || []).map(function (x) { return '<span class="' + (cls || '') + '">' + E(x) + '</span>'; }).join(''); }
  function statusLine(k) {
    var m = modeOf(k), mm = MODE[m] || MODE.reminder, c = connOf(k);
    return '<small style="color:' + mm[1] + ';font-weight:700">' + E(mm[0]) + '</small>' + (c.name || c.handle ? ' <small>· ' + E(c.handle ? '@' + c.handle : c.name) + '</small>' : '') + (c.connected_at ? ' <small>· since ' + E(niceDate(dayOf(c.connected_at), { month: 'short', day: 'numeric', year: 'numeric' })) + '</small>' : '');
  }
  function hdr(k, sub, name) { var x = PLX[k] || ['Make.com', 'M', '#6D00CC']; return '<div class="hd"><div class="lg" style="background:' + x[2] + '">' + E(x[1]) + '</div><div><b>' + E(name || x[0]) + '</b>' + (sub || statusLine(k)) + '</div></div>'; }
  function metaCard() {
    var cx = cap() || {}, c = connOf('meta'), can = S.conn && S.conn.can_meta, granted = cx.granted || c.granted || [], missing = cx.missing || c.missing || [];
    var html = '<div class="card">' + hdr('instagram', '<small>Instagram and Facebook, through the Meta system user token</small>', 'Meta') +
      '<div class="row" style="gap:6px">' + ['instagram', 'facebook'].map(function (k) { var mm = MODE[modeOf(k)] || MODE.reminder; return mark(k) + '<small style="color:' + mm[1] + ';font-weight:700;margin-right:8px">' + E(mm[0]) + '</small>'; }).join('') + '</div>' +
      (cx.token === false ? '<p style="color:' + FLAG + ';margin:0">No Meta token in the vault yet.</p>' : '') +
      (granted.length ? '<div class="chips">' + chips(granted) + chips(missing, 'miss') + '</div>' : '') +
      (missing.length ? '<p class="muted" style="margin:0;color:' + FLAG + '">Missing: ' + E(missing.join(', ')) + '. Comments' + (missing.some(function (x) { return /publish|manage_posts/.test(x); }) ? ', posting' : '') + ' and some formats wait for a token with these. Section 2 of the setup doc says how to make it.</p>' : granted.length ? '<p class="muted" style="margin:0">Every permission the Studio uses is there.</p>' : '') +
      (c.replaced_at ? '<p class="muted" style="margin:0">Replaced ' + E(ago(c.replaced_at)) + ' by ' + E(String(c.replaced_by || '').split('@')[0]) + '.</p>' : '');
    if (can) html += '<h4>Replace the token</h4><div class="row" style="gap:6px"><input type="password" id="w225metatok" autocomplete="off" spellcheck="false" placeholder="Paste the new system user token" style="flex:1;min-width:200px"><a class="btn225 sm" data-w225cx="meta_check">Check it</a><a class="btn225 sm pri" data-w225cx="meta_save"' + (S.busy.meta ? ' disabled' : '') + '>Replace</a></div><p class="muted" style="margin:0">It goes straight into the vault. The Hub never shows it again.</p>' + (S.keys.metaCheck ? '<div class="chips">' + chips(S.keys.metaCheck.granted) + chips(S.keys.metaCheck.missing, 'miss') + '</div>' : '');
    else html += '<p class="muted" style="margin:0">An admin replaces the token.</p>';
    return html + '</div>';
  }
  function appCard(k) {
    var c = connOf(k), st = S.conn || {}, ch = st.can_change, con = CONSOLE[k];
    var connected = c.status === 'connected';
    var html = '<div class="card">' + hdr(k) +
      (c.last_error ? '<p style="color:' + FLAG + ';margin:0;font-size:12.5px">' + E(c.last_error) + '</p>' : '') +
      '<ol>' + CX_STEPS[k].map(function (s) { return '<li>' + E(s) + '</li>'; }).join('') + '</ol>' +
      '<div style="font-size:12px">Redirect address <code>' + E(REDIRECT) + '</code> <a data-w225ccopy="' + E(REDIRECT) + '" style="cursor:pointer" title="Copy">' + I('copy') + '</a></div>' +
      (k === 'threads' ? '<div style="font-size:12px">Uninstall callback <code>' + E(REDIRECT + '?event=uninstall') + '</code> <a data-w225ccopy="' + E(REDIRECT + '?event=uninstall') + '" style="cursor:pointer">' + I('copy') + '</a><br>Delete callback <code>' + E(REDIRECT + '?event=delete') + '</code> <a data-w225ccopy="' + E(REDIRECT + '?event=delete') + '" style="cursor:pointer">' + I('copy') + '</a></div>' : '') +
      (con ? '<a class="muted" href="' + con[0] + '" target="_blank" rel="noopener" style="font-size:12px">' + I('ext') + ' ' + E(con[1]) + '</a>' : '');
    if (ch) {
      html += '<h4>App keys ' + (c.app_saved ? '<span class="pill ok" style="text-transform:none;letter-spacing:0">saved ' + E(c.app_id || '') + '</span>' : '') + '</h4>' +
        '<div class="row" style="gap:6px"><input type="text" id="w225cid-' + k + '" autocomplete="off" spellcheck="false" placeholder="' + (k === 'tiktok' ? 'Client key' : k === 'threads' ? 'Threads app ID' : 'Client ID') + '" style="flex:1;min-width:140px"><input type="password" id="w225csec-' + k + '" autocomplete="off" placeholder="' + (k === 'threads' ? 'Threads app secret' : 'Client secret') + '" style="flex:1;min-width:140px"><a class="btn225 sm" data-w225cx="save_app|' + k + '">Save the keys</a></div>' +
        '<div class="row" style="gap:6px;margin-top:4px">' + (connected ? '<span class="pill ok">' + I('check') + ' Connected</span><span class="sp"></span><a class="btn225 sm" data-w225cx="start|' + k + '">Connect again</a><a class="btn225 sm bad" data-w225cx="disconnect|' + k + '">Disconnect</a>' : '<span class="sp"></span><a class="btn225 sm pri" data-w225cx="start|' + k + '"' + (c.app_saved ? '' : ' disabled title="Save the app keys first"') + '>' + I('plug') + ' Connect</a>') + '</div>';
      if (k === 'youtube' && connected) html += '<div class="row"><span class="muted" style="flex:1">Try it with an unlisted Short only you can see.</span><a class="btn225 sm" data-w225cx="test_short">' + I('send') + ' Send a test Short</a></div>';
    } else html += '<p class="muted" style="margin:0">A marketing lead or an admin connects it.</p>';
    return html + '</div>';
  }
  function makeCard() {
    var c = connOf('make'), ch = S.conn && S.conn.can_change, li = modeOf('linkedin');
    var html = '<div class="card">' + hdr('make', '<small>Posts to the LinkedIn Page until LinkedIn approves the direct connection' + (li === 'make' ? ' · <b style="color:' + TEAL + '">in use</b>' : '') + '</small>') +
      '<ol><li>In Make, a scenario starts with Webhooks, Custom webhook. Copy its address and save it below.</li><li>Press Send Make a sample, then in Make press Redetermine data structure (or run once) so it learns the fields.</li><li>Add a filter: secret equals the code below. Then LinkedIn, Create a company text post (or image post when image_url is filled), with text as the content.</li><li>Turn the scenario on. Send a test post if you want to see it on the Page.</li></ol>';
    if (ch) {
      html += '<div class="row" style="gap:6px"><input type="url" id="w225mkhook" autocomplete="off" placeholder="' + (c.saved ? 'Saved. Paste a new address to replace it' : 'https://hook.us2.make.com/…') + '" style="flex:1;min-width:200px"><a class="btn225 sm" data-w225cx="make_hook">Save</a></div>' +
        (c.secret ? '<div style="font-size:12px">The filter code <code>' + E(c.secret) + '</code> <a data-w225ccopy="' + E(c.secret) + '" style="cursor:pointer">' + I('copy') + '</a></div>' : '') +
        '<div class="row" style="gap:6px">' + (c.saved ? '<a class="btn225 sm" data-w225cx="make_sample">Send Make a sample</a><a class="btn225 sm" data-w225cx="make_test">' + I('send') + ' Send a test post</a><span class="sp"></span><a class="btn225 sm bad" data-w225cx="disconnect|make">Forget it</a>' : '') + '</div>' +
        (c.sampled_at || c.tested_at ? '<p class="muted" style="margin:0">' + (c.sampled_at ? 'Sample sent ' + E(ago(c.sampled_at)) + '. ' : '') + (c.tested_at ? 'Test post ' + E(ago(c.tested_at)) + (c.tested_ok ? ', Make took it.' : ', Make refused it.') : '') + '</p>' : '');
    } else html += '<p class="muted" style="margin:0">' + (c.saved ? 'Set up.' : 'Not set up yet.') + ' A marketing lead or an admin changes it.</p>';
    return html + '</div>';
  }
  function remindCard() {
    var man = PORDER.filter(function (k) { return modeOf(k) === 'reminder'; });
    return '<div class="card">' + '<div class="hd"><div class="lg" style="background:' + GOLD + ';color:' + GREEN + '">' + I('clock') + '</div><div><b>Reminders</b><small>For every platform the Hub cannot post to yet</small></div></div>' +
      '<p style="margin:0;font-size:12.5px">At the post’s time, its owner gets a Hub notification and a Slack message with the caption and the media. They post it in the app, then press Mark posted in the composer, so the calendar and the goals stay right.</p>' +
      '<p class="muted" style="margin:0">' + (man.length ? 'By reminder now: ' + E(man.map(function (k) { return PLX[k][0]; }).join(', ')) + '.' : 'Every platform posts on its own.') + ' People turn these off in their notification settings (Content Studio).</p>' +
      '<div class="row"><span class="sp"></span><a class="btn225 sm" data-w225cx="remind_preview">' + I('eye') + ' Preview a reminder</a></div>' +
      (S.keys.remind ? '<div style="white-space:pre-wrap;font-size:12px;background:rgba(16,63,57,.05);border-radius:10px;padding:10px">' + E(S.keys.remind) + '</div>' : '') + '</div>';
  }
  function connectHtml() {
    if (!S.conn) { loadConn().then(paint); return '<div class="card"><div class="empty">Checking the connections…</div></div>'; }
    if (S.conn.error) return '<div class="card"><div class="empty">Could not read the connections: ' + E(S.conn.error) + ' <a data-w225cx="reload" style="cursor:pointer;font-weight:700">Try again</a></div></div>';
    var flash = S.keys.flash ? '<div class="card" style="background:' + (S.keys.flash.ok ? 'rgba(42,140,122,.10)' : 'rgba(179,64,47,.08)') + '">' + E(S.keys.flash.text) + '</div>' : '';
    return flash + '<div class="row" style="margin:0 0 12px"><span class="muted">Every platform posts straight from the Hub once it is connected. Until then, the Hub reminds the post’s owner to post it by hand. Keys and tokens go into the vault and are never shown again.</span><span class="sp"></span><a class="btn225 sm" data-w225cx="reload">' + I('refresh') + ' Check again</a></div>' +
      '<div class="cx">' + metaCard() + connectExtra250() + appCard('threads') + appCard('youtube') + appCard('tiktok') + appCard('linkedin') + makeCard() + remindCard() + '</div>' +
      '<p class="muted" style="margin:14px 0 0">The setup doc (09/10/26) has every form, answer and email for these steps.</p>';
  }
  /* the platforms send people back to #studio/connections?connected=x or ?error= */
  function connFlash() {
    var h = location.hash || '', i = h.indexOf('?'); if (i < 0) return;
    var p = new URLSearchParams(h.slice(i + 1)), ok = p.get('connected'), er = p.get('error');
    if (ok) S.keys.flash = { ok: true, text: (PLX[ok] ? PLX[ok][0] : ok) + ' is connected. New posts go there directly.' };
    else if (er) S.keys.flash = { ok: false, text: er };
    S.conn = null;
    try { history.replaceState(null, '', location.pathname + location.search + h.slice(0, i)); } catch (e) { /* fine */ }
  }
  async function connAct(what) {
    var parts = String(what).split('|'), a = parts[0], k = parts[1];
    var val = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var clear = function (id) { var el = document.getElementById(id); if (el) el.value = ''; };
    try {
      if (a === 'reload') { S.conn = null; S.keys.flash = null; var w = W(); if (w) await w.loadCap(); paint(); return; }
      if (a === 'meta_check' || a === 'meta_save') {
        var tok = val('w225metatok'); if (!tok) { toastS('Paste the token first'); return; }
        S.busy.meta = true; paint();
        var r = await fn('social-connect', { action: 'meta_token', token: tok, check_only: a === 'meta_check' });
        S.keys.metaCheck = { granted: r.granted || [], missing: r.missing || [] };
        if (a === 'meta_save') { clear('w225metatok'); toastS('Replaced. ' + (r.missing && r.missing.length ? r.missing.length + ' permissions still missing' : 'Every permission is there')); S.conn = null; var w2 = W(); if (w2) await w2.loadCap(); }
        else toastS(r.missing && r.missing.length ? 'Missing ' + r.missing.length + ': ' + r.missing.join(', ') : 'Every permission is there');
        S.busy.meta = false; paint(); return;
      }
      if (a === 'save_app') {
        var id = val('w225cid-' + k), sec = val('w225csec-' + k); if (!id || !sec) { toastS('Paste both the ID and the secret'); return; }
        await fn('social-connect', { action: 'save_app', platform: k, id: id, secret: sec }); clear('w225cid-' + k); clear('w225csec-' + k);
        toastS('Saved in the vault'); await loadConn(); paint(); return;
      }
      if (a === 'start') { var s = await fn('social-connect', { action: 'start', platform: k }); if (s && s.url) location.href = s.url; return; }
      if (a === 'disconnect') {
        if (!confirm('Disconnect ' + (PLX[k] ? PLX[k][0] : 'Make') + '? Posts go back to reminders until it is connected again.')) return;
        await fn('social-connect', { action: 'disconnect', platform: k }); toastS('Disconnected'); await loadConn(); var w3 = W(); if (w3) await w3.loadCap(); paint(); return;
      }
      if (a === 'make_hook') { var u = val('w225mkhook'); if (!u) { toastS('Paste the webhook address'); return; } await fn('social-connect', { action: 'make_hook', url: u }); clear('w225mkhook'); toastS('Saved. Now send Make a sample'); await loadConn(); var w4 = W(); if (w4) await w4.loadCap(); paint(); return; }
      if (a === 'make_sample') { var m = await fn('social-connect', { action: 'make_sample' }); toastS(m.ok ? 'Make got the sample' : 'Make answered ' + m.status + ': is the scenario listening?'); await loadConn(); paint(); return; }
      if (a === 'make_test') {
        if (!confirm('This puts a real post on the Welfare Avenue LinkedIn Page: "Testing the connection between the Welfare Avenue Hub and our LinkedIn Page. Please ignore this post." Send it?')) return;
        var t = await fn('social-connect', { action: 'make_test', confirm: true }); toastS(t.ok ? 'Sent: check the LinkedIn Page in a minute' : 'Make answered ' + t.status); await loadConn(); paint(); return;
      }
      if (a === 'test_short') {
        var w5 = W(); var pre = { title: 'Test Short from the Hub', platforms: ['youtube'], caption: 'Testing the connection between the Welfare Avenue Hub and YouTube.', variants: { youtube: { title: 'Test from the Hub', privacy: 'unlisted', kids: false } } };
        toastS('Add a short vertical video, then Publish now. It goes up unlisted.');
        if (w5 && w5.compose) w5.compose(pre); return;
      }
      if (a === 'remind_preview') {
        var cand = posts().filter(function (p) { return ['draft', 'scheduled'].indexOf(p.status) >= 0 && (p.platforms || []).some(function (x) { return modeOf(x) === 'reminder'; }); }).sort(function (x, y) { return String(x.scheduled_at || '9').localeCompare(String(y.scheduled_at || '9')); })[0];
        if (!cand) { S.keys.remind = 'No planned post goes out by reminder. Make one for LinkedIn, TikTok or YouTube to see the message.'; paint(); return; }
        var pl = (cand.platforms || []).filter(function (x) { return modeOf(x) === 'reminder'; })[0];
        var rr = await fn('social-publish', { action: 'remind_test', post_id: cand.id, platform: pl });
        var plan = rr.plan || {}; S.keys.remind = 'To: ' + (plan.to || 'nobody (the post has no owner)') + '\n\n' + String(plan.slack || '').replace(/<([^|>]+)\|([^>]+)>/g, '$2').replace(/\*/g, ''); paint(); return;
      }
    } catch (x) { S.busy.meta = false; toastS((x.message || String(x))); paint(); }
  }
