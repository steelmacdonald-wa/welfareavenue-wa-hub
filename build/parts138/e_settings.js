  /* ---------- Settings, Connections: Send @mentions as you ---------- */
  var S = { status: null, at: 0, busy: '', recent: null, banner: null };
  function slackFn(body) {
    return Promise.resolve(db.functions.invoke('slack-connect', { body: body })).then(function (r) {
      if (r && r.error) throw new Error(String(r.error.message || r.error));
      return (r && r.data) || {};
    });
  }
  function loadStatus(force) {
    if (!force && S.status && !S.status.error && Date.now() - S.at < 60000) return Promise.resolve(S.status);
    return slackFn({ action: 'status' }).then(function (d) {
      S.status = d && typeof d === 'object' ? d : {}; S.at = Date.now();
      if ('connected' in S.status) { C.connected = !!S.status.connected; C.at = Date.now(); }
      return S.status;
    }, function (e) { S.status = { error: String((e && e.message) || e || 'no answer') }; S.at = Date.now(); return S.status; });
  }
  function loadRecent() {
    return Promise.resolve(db.from('hub_mentions').select('id, created_at, to_name, kind, ref_title, private, dm_status, dm_via, dm_error')
      .eq('from_email', myEmail()).order('created_at', { ascending: false }).limit(5)).then(function (r) { S.recent = (r && r.data) || []; return S.recent; }, function () { S.recent = []; return S.recent; });
  }
  var KIND = { task: 'a task', goal: 'a goal', request: 'a request', update: 'a team update', decision: 'a decision', committee: 'a committee note', project: 'a project', content: 'a post' };
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }); } catch (e) { return String(iso || '').slice(0, 10); } }
  function outcome(m) {
    if (m.dm_status === 'sent') return '<em>' + (m.dm_via === 'user' ? 'Sent as you' : 'Sent from the Hub') + '</em>';
    if (m.dm_status === 'pending') return '<em class="wait">Sending</em>';
    var why = String(m.dm_error || '');
    if (/opted out/.test(why)) return '<em class="wait">They turned these off</em>';
    if (/removed/.test(why)) return '<em class="wait">You took it out</em>';
    if (/no Slack account/.test(why)) return '<em class="no">Not sent: no Slack account found</em>';
    if (/no email/.test(why)) return '<em class="no">Not sent: no email on the Hub</em>';
    return '<em class="no">Not sent' + (m.dm_status === 'failed' ? ': Slack refused it' : '') + '</em>';
  }
  function connInner() {
    var st = S.status, on = !!(st && st.connected), sub, cls = '', right = '';
    if (!st) sub = 'Checking your Slack connection...';
    else if (st.error) { sub = 'Could not check the connection. ' + E(String(st.error).slice(0, 120)); cls = ' err'; right = '<button class="w138btn ghost" data-w138c="retry">Try again</button>'; }
    else if (on) { sub = 'On. People you @mention in the Hub get a Slack message from you, like any message you send.' + (st.since ? ' Connected ' + E(day(st.since)) + '.' : ''); cls = ' ok'; right = '<button class="w138btn ghost" data-w138c="disconnect"' + (S.busy ? ' disabled' : '') + '>' + (S.busy === 'disconnect' ? 'Disconnecting...' : 'Disconnect') + '</button>'; }
    else if (st.ready === false) sub = 'People you @mention in the Hub get a Slack message from the Hub with your name. Sending it as you is not set up yet.';
    else { sub = 'People you @mention in the Hub get a Slack message. Connect your Slack account and it comes from you; until then, it comes from the Hub with your name.'; right = '<button class="w138btn" data-w138c="start"' + (S.busy ? ' disabled' : '') + '>' + (S.busy === 'start' ? 'Opening Slack...' : 'Connect Slack') + '</button>'; }
    var out = '';
    if (S.banner) out += '<div class="w138banner' + (S.banner.ok ? '' : ' err') + '">' + E(S.banner.text) + '</div>';
    out += '<div class="row w138row"><span class="ic" style="background:' + SLACK + '">@</span><div><b>Send @mentions as you</b><div class="s' + cls + '">' + sub + '</div></div>' + right + '</div>';
    var rec = S.recent || [];
    if (rec.length) {
      out += '<div class="w138rec"><div class="t">Your latest @mentions</div>' + rec.map(function (m) {
        var what = (KIND[m.kind] || 'something') + (m.ref_title && !m.private ? ': ' + m.ref_title : '');
        return '<div class="r"><span>' + E(String(m.to_name || 'Someone')) + ', on ' + E(what) + ' · ' + E(day(m.created_at)) + '</span>' + outcome(m) + '</div>';
      }).join('') + '</div>';
    }
    return out;
  }
  function connRow() { return staffOk() ? '<div id="w138conn">' + connInner() + '</div>' : ''; }
  function repaintConn() { var box = document.getElementById('w138conn'); if (box) box.innerHTML = connInner(); }
  function afterPaint(tab) {
    if (tab !== 'connections' || !document.getElementById('w138conn')) return;
    var stale = !S.status || S.status.error || Date.now() - S.at > 60000;
    if (stale) loadStatus(true).then(repaintConn);
    loadRecent().then(repaintConn);
  }
  function act(el) {
    var a = el.getAttribute('data-w138c');
    if (a === 'retry') { S.status = null; repaintConn(); loadStatus(true).then(repaintConn); return; }
    if (a === 'start') {
      if (S.busy) return; S.busy = 'start'; S.banner = null; repaintConn();
      slackFn({ action: 'start' }).then(function (d) {
        if (d && d.url && /^https:\/\/slack\.com\//.test(d.url)) { location.href = d.url; return; }
        S.busy = ''; repaintConn(); toastS(String((d && d.error) || 'Slack did not answer. Try again.').slice(0, 160));
      }, function () { S.busy = ''; repaintConn(); toastS('Could not reach the Hub. Try again.'); });
      return;
    }
    if (a === 'disconnect') {
      if (S.busy) return; S.busy = 'disconnect'; S.banner = null; repaintConn();
      slackFn({ action: 'disconnect' }).then(function (d) {
        S.busy = '';
        if (d && d.ok) { toastS('Disconnected. Your @mentions come from the Hub with your name again.'); C.connected = false; C.at = Date.now(); }
        else toastS(String((d && d.error) || 'Could not disconnect. Try again.').slice(0, 160));
        return loadStatus(true);
      }, function () { S.busy = ''; toastS('Could not reach the Hub. Try again.'); }).then(repaintConn);
    }
  }

  /* back from Slack's page: slack-connect sends the browser to /?slack=connected (or error, cancelled) */
  var BACK = (function () {
    try {
      var q = new URLSearchParams(location.search || ''), v = q.get('slack'); if (!v) return null;
      var why = q.get('why') || ''; q.delete('slack'); q.delete('why');
      var rest = q.toString();
      history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
      return { result: v, why: why };
    } catch (e) { return null; }
  })();
  if (BACK) {
    var tries = 0;
    (function wait() {
      var ready = document.documentElement.classList.contains('wa-ready') && typeof window.w116Settings === 'function' && myEmail() && staffOk();
      if (!ready) { if (++tries < 120) setTimeout(wait, 500); return; }
      if (BACK.result === 'connected') S.banner = { ok: true, text: 'Slack is connected. From now on, the people you @mention get a Slack message from you.' };
      else if (BACK.result === 'cancelled') S.banner = { ok: false, text: 'Slack was not connected: you cancelled on Slack’s page. Your @mentions still reach people, from the Hub with your name.' };
      else S.banner = { ok: false, text: 'Slack was not connected. ' + (BACK.why || 'Something went wrong on the way back from Slack.') };
      S.status = null; C.connected = null; C.at = 0;
      setTimeout(function () { S.banner = null; }, 45000);
      toastS(BACK.result === 'connected' ? 'Slack connected: your @mentions now come from you' : 'Slack was not connected');
      try { window.w116Settings('connections'); } catch (e) { /* fine */ }
    })();
  }

