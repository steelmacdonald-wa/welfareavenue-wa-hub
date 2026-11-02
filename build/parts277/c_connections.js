
  /* ---------- the page: renders only (the wiring is in z_wire) ---------- */
  var CHEV = '<svg class="w277chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  function markOf(p, small) { return '<i class="w277m' + (small ? ' sm' : '') + '" style="background:' + E(p.colour || '#1F201E') + '" title="' + E(p.label) + '" aria-hidden="true">' + E(p.short || p.label.slice(0, 2)) + '</i>'; }
  function btn(act, k, text, cls, extra) {
    var busy = S277.busy[k + ':' + act];
    return '<button type="button" class="w277btn' + (cls ? ' ' + cls : '') + '" data-w277act="' + act + '" data-w277k="' + E(k) + '"' + (extra || '') + (busy ? ' disabled aria-busy="true"' : '') + '>' + E(text) + '</button>';
  }
  function chipsOf(caps) {
    caps = caps || {}; var out = [];
    if (caps.images && caps.max_images > 0) out.push('Photos ' + caps.max_images);
    if (caps.video) out.push('Video');
    if (caps.comments) out.push('Comments');
    if (caps.analytics) out.push('Analytics');
    return out.map(function (x) { return '<span>' + E(x) + '</span>'; }).join('');
  }
  function list(xs, cls) { return (xs || []).map(function (x) { return '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + E(x) + '</span>'; }).join(''); }
  function pillHtml(k) {
    var p = pillOf(k), prev = S277.pills[k], fresh = prev && prev !== p[0];
    S277.pills[k] = p[0];
    return '<span class="w277pill ' + p[1] + (fresh ? ' fresh' : '') + '" data-w277pill="' + E(k) + '">' + E(p[0]) + '</span>';
  }

  /* the row's one action: Connect, Reconnect, or the chevron that says it opens */
  function actionOf(k) {
    if (k === 'meta') return canMeta() && metaState() === 'none' ? btn('connect', 'meta', 'Connect', 'gold') : CHEV;
    if (!canChange()) return CHEV;
    var c = connOf(k), h = healthOf(c), sc = scopesOf(k);
    if (h === 'not_connected') return btn('connect', k, 'Connect', 'gold');
    if (h === 'expiring' || h === 'expired' || h === 'error' || (sc && sc.m < sc.n)) return btn('reconnect', k, 'Reconnect', 'gold');
    return CHEV;
  }
  function rowHtml(k, marks, name, sub, caps) {
    var open = S277.open === k, act = actionOf(k), quiet = act === CHEV;
    return '<div class="w277item" role="listitem">'
      + '<div class="w277row' + (quiet ? ' quiet' : '') + '" data-w277row="' + E(k) + '" role="button" tabindex="0" aria-expanded="' + open + '" aria-controls="w277d-' + E(k) + '">'
      + '<span class="w277mk">' + marks + '</span>'
      + '<span class="w277nm"><b>' + E(name) + '</b>' + (sub ? '<small>' + E(sub) + '</small>' : '') + '</span>'
      + '<span class="w277pl">' + pillHtml(k) + '</span>'
      + '<span class="w277ch">' + chipsOf(caps) + '</span>'
      + '<span class="w277act">' + act + '</span></div>'
      + '<div class="w277disc' + (open ? ' open' : '') + '" id="w277d-' + E(k) + '" data-w277disc="' + E(k) + '"><div class="w277in"' + (open ? '' : ' inert') + '><div class="w277body">' + (k === 'meta' ? metaBody() : oauthBody(k)) + '</div></div></div></div>';
  }

  /* the Meta row's disclosure: the system user token and its permissions (the words of wave225's Meta card) */
  function metaBody() {
    var c = connOf('meta'), cx = metaCap(), S = St() || { keys: {}, busy: {} }, granted = c.granted || cx.granted || [], missing = c.missing || cx.missing || [];
    var h = '<p class="muted">Instagram and Facebook, through the Meta system user token.</p>';
    if (metaState() === 'none') h += '<p class="flag">No Meta token in the vault yet.</p>';
    if (granted.length || missing.length) h += '<div class="w277chips">' + list(granted) + list(missing, 'miss') + '</div>';
    if (missing.length) h += '<p class="flag">Missing: ' + E(missing.join(', ')) + '. Comments' + (missing.some(function (x) { return /publish|manage_posts/.test(x); }) ? ', posting' : '') + ' and some formats wait for a token with these. Section 2 of the setup doc says how to make it.</p>';
    else if (granted.length) h += '<p class="muted">Every permission the Studio uses is there.</p>';
    if (c.replaced_at) h += '<p class="muted">Replaced ' + E(ago(c.replaced_at)) + ' by ' + E(who(c.replaced_by)) + '.</p>';
    if (canMeta()) {
      h += '<div class="w277keys"><input type="password" id="w277metatok" autocomplete="off" spellcheck="false" aria-label="The new system user token" placeholder="Paste the new system user token">'
        + btn('meta_check', 'meta', 'Check it', 'sm', S.busy.meta ? ' disabled' : '') + btn('meta_save', 'meta', 'Replace', 'sm gold', S.busy.meta ? ' disabled' : '') + '</div>'
        + '<p class="muted">It goes straight into the vault. The Hub never shows it again.</p>'
        + (S.keys.metaCheck ? '<div class="w277chips">' + list(S.keys.metaCheck.granted) + list(S.keys.metaCheck.missing, 'miss') + '</div>' : '');
    } else h += '<p class="muted">An admin replaces the token.</p>';
    return h;
  }

  /* an OAuth platform's disclosure */
  function oauthBody(k) {
    var p = platOf(k) || {}, c = connOf(k), h = healthOf(c), sc = scopesOf(k), ch = canChange(), r = redirect(), out = '';
    if (h !== 'not_connected') {
      var facts = [];
      if (c.connected_at) facts.push('Connected ' + (c.connected_by ? 'by ' + who(c.connected_by) + ' ' : '') + 'on ' + dateOf(c.connected_at));
      if (c.expires_at) facts.push((h === 'expired' ? 'Expired on ' : 'Expires on ') + dateOf(c.expires_at));
      if (c.last_checked_at) facts.push('Checked ' + ago(c.last_checked_at));
      if (facts.length) out += '<div class="w277facts">' + facts.map(function (f) { return '<span>' + E(f) + '</span>'; }).join('') + '</div>';
    }
    if (c.last_error) out += '<p class="flag">' + E(c.last_error) + '</p>';
    if (sc) out += '<div class="w277line"><span>Asked for ' + sc.n + ', granted ' + sc.m + '</span>' + (sc.m < sc.n ? '<span class="muted">Some features wait for the rest.</span>' + (ch ? btn('reconnect', k, 'Reconnect', 'sm gold') : '') : '') + '</div>';
    if (h === 'not_connected' && (p.steps || []).length) out += '<ol>' + p.steps.map(function (s) { return '<li>' + E(s) + '</li>'; }).join('') + '</ol>';
    if (p.console_url) out += '<div class="w277line"><a class="w277btn sm" data-w277act="open_console" data-w277k="' + E(k) + '" href="' + E(p.console_url) + '" target="_blank" rel="noopener">Open the console</a>' + (p.console_note ? '<span class="muted">' + E(p.console_note) + '</span>' : '') + '</div>';
    out += '<div class="w277line"><span class="muted">Redirect address</span><code>' + E(r) + '</code>' + btn('copy_redirect', k, 'Copy', 'sm', ' data-w277v="' + E(r) + '"') + '</div>';
    if (k === 'threads') out += ['uninstall', 'delete'].map(function (ev) { var u = r + '?event=' + ev; return '<div class="w277line"><span class="muted">' + (ev === 'uninstall' ? 'Uninstall callback' : 'Delete callback') + '</span><code>' + E(u) + '</code>' + btn('copy_redirect', k, 'Copy', 'sm', ' data-w277v="' + E(u) + '"') + '</div>'; }).join('');
    if (ch) {
      out += (c.app_saved ? '<p class="muted">Keys saved' + (c.app_id ? ' (' + E(c.app_id) + ')' : '') + '. Paste new ones to replace them.</p>' : '')
        + '<div class="w277keys"><input type="text" id="w277id-' + E(k) + '" autocomplete="off" spellcheck="false" aria-label="' + E(p.label) + ' client ID" placeholder="' + (k === 'tiktok' ? 'Client key' : k === 'threads' ? 'Threads app ID' : 'Client ID') + '">'
        + '<input type="password" id="w277sec-' + E(k) + '" autocomplete="off" aria-label="' + E(p.label) + ' client secret" placeholder="' + (k === 'threads' ? 'Threads app secret' : 'Client secret') + '">'
        + btn('save_keys', k, 'Save keys', 'sm') + '</div>';
      out += '<div class="w277line">' + (h === 'not_connected' ? btn('connect', k, 'Connect', 'gold') : (sc && sc.m < sc.n ? '' : btn('reconnect', k, 'Reconnect', '')) + btn('disconnect', k, 'Disconnect', 'bad'))
        + (k === 'youtube' && h !== 'not_connected' ? btn('test_short', k, 'Send a test Short', '') : '') + '</div>';
    } else out += '<p class="muted">A marketing lead or an admin connects it.</p>';
    if (k === 'linkedin') out += makeBody();
    return out;
  }
  /* LinkedIn, Advanced: the Make hook that posts to the Page until LinkedIn approves the direct connection */
  function makeBody() {
    var m = connOf('make'), ch = canChange();
    var h = '<details class="w277adv"><summary>Advanced</summary><p class="muted">Until LinkedIn approves the direct connection, a Make scenario can post to the Page. Paste its webhook address here.</p>';
    if (ch) {
      h += '<div class="w277keys"><input type="url" id="w277mkhook" autocomplete="off" aria-label="Make webhook address" placeholder="' + (m.saved ? 'Saved. Paste a new address to replace it' : 'The Make webhook address') + '">' + btn('make_hook', 'make', 'Save', 'sm') + '</div>';
      if (m.secret) h += '<div class="w277line"><span class="muted">The filter code</span><code>' + E(m.secret) + '</code>' + btn('copy_redirect', 'make', 'Copy', 'sm', ' data-w277v="' + E(m.secret) + '"') + '</div>';
      if (m.saved) h += '<div class="w277line">' + btn('make_sample', 'make', 'Send Make a sample', 'sm') + btn('make_test', 'make', 'Send a test post', 'sm') + btn('disconnect', 'make', 'Forget it', 'sm bad') + '</div>';
      if (m.sampled_at || m.tested_at) h += '<p class="muted">' + (m.sampled_at ? 'Sample sent ' + E(ago(m.sampled_at)) + '. ' : '') + (m.tested_at ? 'Test post ' + E(ago(m.tested_at)) + (m.tested_ok ? ', Make took it.' : ', Make refused it.') : '') + '</p>';
    } else h += '<p class="muted">' + (m.saved ? 'Set up.' : 'Not set up yet.') + ' A marketing lead or an admin changes it.</p>';
    return h + '</details>';
  }

  function attnHtml() {
    var xs = attention(); if (!xs.length) return '';
    return '<div id="w277attn" role="region" aria-label="Needs attention">' + xs.map(function (x) {
      return '<div class="w277arow"><b>' + E(x.label) + '</b><span class="why">' + E(x.why) + '</span>' + (canChange() ? btn(x.act, x.k, x.btn, 'sm gold') : '') + '</div>';
    }).join('') + '</div>';
  }
  function testHtml() {
    var S = St() || { keys: {} }, x = w(), byHand = platforms().filter(function (p) { return x && x.modeOf && x.modeOf(p.key) === 'reminder'; }).map(function (p) { return p.label; });
    return '<div class="w277card"><div class="w277test"><b>Reminders</b><span>' + (byHand.length ? 'By reminder now: ' + E(byHand.join(', ')) + '. ' : 'Every platform posts on its own. ') + 'At the time of the post, its owner gets the caption and the media to post by hand.</span>'
      + btn('remind_preview', 'remind', 'Preview a reminder', 'sm') + '</div>'
      + (S.keys.remind ? '<div class="w277pre">' + E(S.keys.remind) + '</div>' : '') + '</div>';
  }

  function connectHtml() {
    var S = St(); if (!S) return '';
    if (!S.conn) { loadConn().then(paint); return '<div id="w277conn" aria-busy="true"><div class="w277card"><div class="w277empty">Checking the connections.</div></div></div>'; }
    if (S.conn.error) return '<div id="w277conn"><div class="w277card"><div class="w277empty">Could not read the connections. <a data-w277act="reload" data-w277k="" role="button" tabindex="0">Try again</a></div></div></div>';
    var ps = platforms(), meta = ps.filter(function (p) { return META.indexOf(p.key) >= 0; }), rows = [], metaDone = false;
    ps.forEach(function (p) {
      if (META.indexOf(p.key) >= 0) {
        if (metaDone) return; metaDone = true;
        rows.push(rowHtml('meta', meta.map(function (m) { return markOf(m, true); }).join(''), meta.map(function (m) { return m.label; }).join(' and '), 'Meta', p.caps));
      } else {
        var c = connOf(p.key);
        rows.push(rowHtml(p.key, markOf(p), p.label, c.handle ? '@' + c.handle : c.name || '', p.caps));
      }
    });
    var fl = S.keys.flash;
    return '<div id="w277conn">'
      + (fl ? '<div class="w277flash' + (fl.ok ? '' : ' bad') + '" role="status">' + E(fl.text) + '</div>' : '')
      + '<div class="w277bar"><span>Keys and tokens go into the vault and are never shown again.</span>' + btn('reload', '', 'Check again', 'sm') + '</div>'
      + attnHtml()
      + (rows.length ? '<div class="w277card" role="list">' + rows.join('') + '</div>' : '<div class="w277card"><div class="w277empty">No platforms are on yet. <a data-w277act="reload" data-w277k="" role="button" tabindex="0">Check again</a></div></div>')
      + testHtml() + '</div>';
  }
