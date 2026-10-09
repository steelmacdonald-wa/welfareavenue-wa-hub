
  /* ---------- the comments inbox ---------- */
  function scoreOf(list) {
    var since = Date.now() - 30 * 86400000;
    var theirs = list.filter(function (c) { return !c.from_us && c.commented_at && new Date(c.commented_at).getTime() > since && c.status !== 'deleted'; });
    /* answered: the inbox marked a reply (replied_at), or one of our replies sits under it (its time counts) */
    var repAt = function (c) { if (c.replied_at) return c.replied_at; var k = list.filter(function (x) { return x.from_us && x.platform === c.platform && x.parent_external_id === c.external_id && x.commented_at; }).sort(function (x, y) { return String(x.commented_at).localeCompare(String(y.commented_at)); })[0]; return k ? k.commented_at : null; };
    theirs.forEach(function (c) { c.__rep = repAt(c); });
    var answered = theirs.filter(function (c) { return c.__rep; });
    var times = answered.map(function (c) { return (new Date(c.__rep).getTime() - new Date(c.commented_at).getTime()) / 3600000; }).filter(function (h) { return h >= 0; }).sort(function (a, b) { return a - b; });
    var med = times.length ? times[Math.floor(times.length / 2)] : null;
    var within = theirs.length ? answered.filter(function (c) { return (new Date(c.__rep).getTime() - new Date(c.commented_at).getTime()) < 24 * 3600000; }).length / theirs.length : null;
    var score = theirs.length ? Math.round(((answered.length / theirs.length) * 0.6 + (within || 0) * 0.4) * 100) : null;
    return { total: theirs.length, answered: answered.length, med: med, within: within, score: score };
  }
  function postFor(c) {
    var sp = S.social.filter(function (x) { return (c.social_post_id && x.id === c.social_post_id) || (x.platform === c.platform && (x.external_id === c.media_external_id || String(x.external_id).split('_').pop() === String(c.media_external_id || '').split('_').pop())); })[0];
    if (sp) return { thumb: sp.thumb_cached || sp.thumb_url, text: sp.caption, url: sp.url };
    var cp = c.content_post_id ? posts().filter(function (p) { return p.id === c.content_post_id; })[0] : null;
    if (cp) return { thumb: thumbOf(cp), text: titleOf(cp), url: c.permalink };
    return { thumb: null, text: null, url: c.permalink };
  }
  function cmHtml(c, kids) {
    var mk = S.mk, pub = S.pub, r = S.reply[c.id];
    var nm = c.author_handle ? '@' + c.author_handle : (c.author_name || 'Someone');
    var ours = kids.filter(function (k) { return k.from_us; }), theirs = kids.filter(function (k) { return !k.from_us; });
    var replies = lib().filter(function (x) { return x.kind === 'reply'; });
    var acts = mk ? '<div class="acts">' + (c.status !== 'deleted' ? '<a data-w225rp="' + c.id + '">' + I('chat') + ' Reply</a>' : '') +
      (c.platform === 'facebook' && !c.liked_by_us ? '<a data-w225act="like|' + c.id + '">' + I('heart') + ' Like</a>' : '') +
      (c.hidden ? '<a data-w225act="unhide|' + c.id + '">Show again</a>' : '<a data-w225act="hide|' + c.id + '">' + I('eye') + ' Hide</a>') +
      (c.status === 'open' ? '<a data-w225act="resolve|' + c.id + '">' + I('check') + ' Resolve</a>' : c.status === 'resolved' ? '<a data-w225act="reopen|' + c.id + '">Reopen</a>' : '') +
      '<select data-w225assign="' + c.id + '" aria-label="Assign" style="font-size:11.5px;padding:3px 8px;border-radius:999px"><option value="">' + (c.assigned_to ? 'Assigned: ' + E(c.assigned_to) : 'Assign…') + '</option>' + members().filter(function (m) { return m.department === 'marketing' || m.department === 'exec'; }).map(function (m) { return '<option value="' + E(m.name) + '">' + E(m.name) + '</option>'; }).join('') + '</select>' +
      (pub && c.status !== 'deleted' ? '<a class="bad" data-w225act="delete|' + c.id + '">' + I('trash') + ' Delete</a>' : '') +
      (c.permalink ? '<a href="' + E(c.permalink) + '" target="_blank" rel="noopener">' + I('ext') + ' Open</a>' : '') + '</div>' : '';
    var box = r ? '<div class="rbox"><textarea data-w225rtext="' + c.id + '" placeholder="Reply as Welfare Avenue">' + E(r.text || '') + '</textarea><div class="row" style="margin-top:6px">' +
      (replies.length ? '<select data-w225saved="' + c.id + '"><option value="">Saved replies…</option>' + replies.map(function (x) { return '<option value="' + x.id + '">' + E(x.name) + '</option>'; }).join('') + '</select>' : '') +
      '<a class="btn225 sm" data-w225ai="' + c.id + '"' + (r.busy ? ' disabled' : '') + '>' + I('star') + (r.busy ? ' Writing…' : ' Suggest a reply') + '</a><span class="sp"></span><a class="btn225 sm" data-w225rpx="' + c.id + '">Cancel</a><a class="btn225 sm pri" data-w225send="' + c.id + '"' + (r.sending ? ' disabled' : '') + '>' + I('send') + ' Send</a></div></div>' : '';
    return '<div class="cm"><div class="av">' + E(String(nm).replace(/^@/, '').charAt(0).toUpperCase() || '?') + '</div><div style="min-width:0"><div class="who">' + mark(c.platform) + E(nm) + '<small>' + E(ago(c.commented_at)) + (c.like_count ? ' · ' + c.like_count + ' likes' : '') + (c.status !== 'open' ? ' · ' + E(c.status) : '') + (c.assigned_to ? ' · for ' + E(c.assigned_to) : '') + '</small></div>' +
      '<div class="tx' + (c.hidden ? ' hid' : '') + '">' + E(c.text || '') + '</div>' +
      ours.map(function (o) { return '<div class="ours">' + I('chat') + ' ' + E(o.text || '') + (o.replied_by ? ' <span class="muted">(' + E(o.replied_by) + ')</span>' : '') + '</div>'; }).join('') +
      theirs.map(function (o) { return '<div style="margin:4px 0 4px 10px;font-size:12.5px"><b>' + E(o.author_handle ? '@' + o.author_handle : o.author_name || '') + '</b> ' + E(o.text || '') + '</div>'; }).join('') +
      acts + box + '</div></div>';
  }
  function inboxHtml() {
    var f = S.f, all = S.comments.filter(function (c) { return c.status !== 'deleted' || f.inbox === 'all'; });
    var tops = all.filter(function (c) { return !c.parent_external_id || !all.some(function (p) { return p.platform === c.platform && p.external_id === c.parent_external_id; }); }).filter(function (c) { return !c.from_us; });
    var kidsOf = function (c) { return all.filter(function (k) { return k.platform === c.platform && k.parent_external_id === c.external_id; }); };
    var counts = { open: tops.filter(function (c) { return c.status === 'open'; }).length, resolved: tops.filter(function (c) { return c.status === 'resolved'; }).length, hidden: tops.filter(function (c) { return c.status === 'hidden' || c.hidden; }).length, all: tops.length };
    var list = tops.filter(function (c) {
      if (f.inbox === 'open' && c.status !== 'open') return false;
      if (f.inbox === 'resolved' && c.status !== 'resolved') return false;
      if (f.inbox === 'hidden' && !(c.status === 'hidden' || c.hidden)) return false;
      if (f.ipl && c.platform !== f.ipl) return false;
      if (f.imine && lower(c.assigned_to) !== lower(myName())) return false;
      if (f.iq && (lower(c.text) + ' ' + lower(c.author_handle) + ' ' + lower(c.author_name)).indexOf(lower(f.iq)) < 0) return false;
      return true;
    });
    var sc = scoreOf(S.comments);
    var last = S.inboxLast;
    var errs = last && last.result ? Object.keys(last.result).filter(function (k) { return last.result[k] && last.result[k].error; }) : [];
    var head = '<div class="kpis"><div class="kpi"><b class="' + (counts.open ? 'warn' : 'ok') + '">' + counts.open + '</b><span>open</span></div>' +
      '<div class="kpi"><b>' + (sc.score == null ? '–' : sc.score) + '</b><span>comment score</span><em>' + (sc.total ? sc.answered + ' of ' + sc.total + ' answered, 30 days' : 'No comments in 30 days') + '</em></div>' +
      '<div class="kpi"><b>' + (sc.med == null ? '–' : sc.med < 1 ? Math.round(sc.med * 60) + ' min' : Math.round(sc.med) + ' h') + '</b><span>typical reply time</span><em>' + (sc.within == null ? '' : pct(sc.within) + ' within a day') + '</em></div>' +
      '<div class="kpi"><b style="font-size:18px">' + E(last && last.at ? ago(last.at) : 'never') + '</b><span>last check</span><em>' + (S.mk ? '<a data-w225sync="1" style="cursor:pointer;color:' + ROSE + ';font-weight:700">' + (S.busy.sync ? 'Checking…' : 'Check now') + '</a>' : 'Every 10 minutes') + '</em></div></div>' +
      (errs.length ? '<div class="card" style="background:rgba(220,165,39,.10)"><b>Some platforms could not be read:</b> ' + errs.map(function (k) { return E(PLX[k] ? PLX[k][0] : k) + ' (' + E(clip(last.result[k].error, 120)) + ')'; }).join('; ') + '. <a data-w225go="#studio/connections" style="cursor:pointer;font-weight:700">Connections</a></div>' : '');
    var filters = '<div class="row" style="margin:0 0 12px"><span class="seg">' + [['open', 'Open'], ['resolved', 'Resolved'], ['hidden', 'Hidden'], ['all', 'Everything']].map(function (x) { return '<a data-w225ib="' + x[0] + '" class="' + (f.inbox === x[0] ? 'on' : '') + '">' + x[1] + '<span class="n">' + counts[x[0]] + '</span></a>'; }).join('') + '</span>' +
      '<span class="seg"><a data-w225ipl="" class="' + (!f.ipl ? 'on' : '') + '">All</a>' + PORDER.filter(function (k) { return S.comments.some(function (c) { return c.platform === k; }); }).map(function (k) { return '<a data-w225ipl="' + k + '" class="' + (f.ipl === k ? 'on' : '') + '">' + E(PLX[k][0]) + '</a>'; }).join('') + '</span>' +
      '<label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-w225imine' + (f.imine ? ' checked' : '') + '> Assigned to me</label><span class="sp"></span><input type="search" data-w225iq placeholder="Search comments" value="' + E(f.iq) + '"></div>';
    /* grouped by post */
    var groups = {}, order = [];
    list.forEach(function (c) { var k = c.platform + '|' + (c.media_external_id || c.social_post_id || 'none'); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(c); });
    var body = order.map(function (k) {
      var g = groups[k], pp = postFor(g[0]);
      return '<div class="card"><div class="post">' + (pp.thumb ? '<img src="' + E(pp.thumb) + '" alt="" loading="lazy">' : '<div class="ph"></div>') + '<div style="min-width:0"><b>' + mark(g[0].platform) + E(clip(pp.text || 'A post', 110)) + '</b>' + (pp.url ? '<a class="muted" href="' + E(pp.url) + '" target="_blank" rel="noopener">Open the post</a>' : '') + '</div></div>' +
        g.map(function (c) { return cmHtml(c, kidsOf(c)); }).join('') + '</div>';
    }).join('');
    if (!S.mk && !S.pub) body = '<div class="card"><div class="empty">The comments are for the marketing team and admins.</div></div>';
    else if (!list.length) body = '<div class="card"><div class="empty">' + (S.comments.length ? (f.inbox === 'open' ? 'Every comment is answered.' : 'Nothing matches.') : 'No comments yet. They arrive here within 10 minutes once the Meta token has the comment permissions (Connections), and from Threads and YouTube once they are connected.') + '</div></div>';
    return head + filters + body;
  }
  var REPLY_SYSTEM = 'You reply to comments on Welfare Avenue’s social media posts. Welfare Avenue is a youth-powered charity in Montreal and Toronto that serves meals and builds community. Write one reply as Welfare Avenue: warm, specific, short (one or two sentences), plain words. Thank people by name when there is a handle. Answer questions only with what the post or comment says; otherwise point to info@welfareavenue.com or the link in our bio. Never promise anything, never invent facts, dates or numbers. Reply in the language of the comment (Quebec French for French). No em dashes. At most one emoji, only when natural. Return only the reply text.';
  async function suggestReply(id) {
    var c = S.comments.filter(function (x) { return String(x.id) === String(id); })[0]; if (!c) return;
    var r = S.reply[id] = S.reply[id] || { text: '' }; r.busy = true; paint();
    try {
      var pp = postFor(c);
      var res = await db.functions.invoke('llm', { body: { task: 'draft', caller: 'content-studio', max_tokens: 300, temperature: 0.5, system: REPLY_SYSTEM, messages: [{ role: 'user', content: 'PLATFORM: ' + c.platform + '\nPOST: ' + clip(pp.text || '', 600) + '\nCOMMENT by ' + (c.author_handle || c.author_name || 'someone') + ': ' + (c.text || '') } ] } });
      if (res.error) throw res.error;
      var txt = ((res.data && res.data.content) || []).filter(function (x) { return x.type === 'text'; }).map(function (x) { return x.text; }).join(' ').replace(/—/g, ',').trim();
      if (!txt) throw new Error('nothing came back');
      r.text = txt;
    } catch (x) { toastS('The Hub could not help this time: ' + (x.message || x)); }
    r.busy = false; paint();
  }
  async function inboxAct(action, id, extra) {
    if (action === 'delete' && !confirm('Delete this comment on the platform? It cannot be brought back.')) return;
    try {
      var body = Object.assign({ action: action, id: Number(id) }, extra || {});
      await fn('social-inbox', body);
      toastS({ reply: 'Reply sent', like: 'Liked', hide: 'Hidden', unhide: 'Shown again', resolve: 'Resolved', reopen: 'Reopened', delete: 'Deleted', assign: 'Assigned' }[action] || 'Done');
      if (action === 'reply') delete S.reply[id];
      var r = await q(db.from('social_comments').select('*').gte('commented_at', new Date(Date.now() - 90 * 86400000).toISOString()).order('commented_at', { ascending: false }).limit(1500));
      if (r.data) S.comments = r.data;
      paint(); try { if (window.w153) window.w153.paint(); } catch (e) { /* fine */ }
    } catch (x) { toastS('Could not ' + action + ': ' + (x.message || x)); if (action === 'reply' && S.reply[id]) { S.reply[id].sending = false; paint(); } }
  }
