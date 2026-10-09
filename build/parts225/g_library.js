
  /* ---------- the library: templates, hashtag groups, saved replies, tags ---------- */
  var LIBT = [['templates', 'Templates', 'template'], ['hashtags', 'Hashtag groups', 'hashtags'], ['replies', 'Saved replies', 'reply'], ['tags', 'Tags', null]];
  var TAGCOLORS = ['#6F64AB', '#2A8C7A', '#B4467A', '#DCA527', '#1877F2', '#B3402F', '#103F39', '#C13584'];
  function libTab() { var t = LIBT.filter(function (x) { return x[0] === S.sub; })[0]; return t || LIBT.filter(function (x) { return x[0] === S.f.lib; })[0] || LIBT[0]; }
  function hashCount(s) { return (String(s || '').match(/#[\p{L}\p{N}_]+/gu) || []).length; }
  function libEditor(t) {
    var e = S.libEdit; if (!e || e.tab !== t[0]) return '';
    var nm = '<label class="muted" style="display:block;margin:0 0 4px">Name</label><input type="text" data-w225lf="name" value="' + E(e.name || '') + '" style="width:100%" maxlength="80">';
    var body = '';
    if (t[0] === 'tags') {
      body = '<label class="muted" style="display:block;margin:10px 0 4px">Colour</label><div class="row" style="gap:6px">' + TAGCOLORS.map(function (c) { return '<a data-w225lcol="' + c + '" title="' + c + '" style="width:26px;height:26px;border-radius:50%;background:' + c + ';cursor:pointer;outline:' + (e.color === c ? '3px solid ' + GOLD : 'none') + ';outline-offset:2px"></a>'; }).join('') + '</div>';
    } else {
      var lab = t[0] === 'hashtags' ? 'The hashtags (Instagram takes 5 at most)' : t[0] === 'replies' ? 'The reply' : 'The caption';
      body = '<label class="muted" style="display:block;margin:10px 0 4px">' + lab + '</label><textarea data-w225lf="body" rows="' + (t[0] === 'hashtags' ? 3 : 6) + '" style="width:100%">' + E(e.body || '') + '</textarea>';
      if (t[0] === 'hashtags') { var n = hashCount(e.body); body += '<p class="muted" style="margin:4px 0 0;' + (n > 5 ? 'color:' + FLAG : '') + '">' + n + ' hashtag' + (n === 1 ? '' : 's') + (n > 5 ? ': Instagram keeps the first 5' : '') + '</p>'; }
      if (t[0] === 'templates') {
        var pls = e.platforms || [];
        body += '<label class="muted" style="display:block;margin:10px 0 4px">Platforms</label><div class="row" style="gap:6px">' + PORDER.map(function (k) { return '<label style="display:flex;gap:4px;align-items:center;font-size:12.5px"><input type="checkbox" data-w225lpl="' + k + '"' + (pls.indexOf(k) >= 0 ? ' checked' : '') + '>' + mark(k) + E(PLX[k][0]) + '</label>'; }).join('') + '</div>' +
          '<label class="muted" style="display:block;margin:10px 0 4px">First comment (optional)</label><input type="text" data-w225lf="first_comment" value="' + E(e.first_comment || '') + '" style="width:100%">';
      }
      if (t[0] === 'replies') body += '<p class="muted" style="margin:4px 0 0">Use {name} for the person’s name or handle.</p>';
    }
    return '<div class="card" style="border-color:' + ROSE + '"><h3>' + I(e.id ? 'star' : 'plus') + ' ' + (e.id ? 'Change' : 'New') + ' ' + E(t[1].replace(/s$/, '').toLowerCase()) + '</h3>' + nm + body +
      '<div class="row" style="margin-top:12px"><span class="sp"></span><a class="btn225 sm" data-w225lcancel="1">Cancel</a><a class="btn225 sm pri" data-w225lsave="1"' + (S.busy.lib ? ' disabled' : '') + '>' + I('check') + ' Save</a></div></div>';
  }
  function libraryHtml() {
    var t = libTab(), mk = S.mk, qq = lower(S.f.lq);
    var tabs = '<div class="row" style="margin:0 0 12px"><span class="seg">' + LIBT.map(function (x) {
      var n = x[2] ? lib().filter(function (s) { return s.kind === x[2]; }).length : tagsAll().length;
      return '<a data-w225go="#studio/library/' + x[0] + '" class="' + (t[0] === x[0] ? 'on' : '') + '">' + E(x[1]) + '<span class="n">' + n + '</span></a>';
    }).join('') + '</span><span class="sp"></span><input type="search" data-w225lq placeholder="Search the library" value="' + E(S.f.lq || '') + '">' + (mk ? '<a class="btn225 sm pri" data-w225lnew="' + t[0] + '">' + I('plus') + ' New</a>' : '') + '</div>';
    var intro = { templates: 'Start a post from a template: the platforms, caption, first comment and tags come with it. Save one from the composer with Save as template, or make one here.', hashtags: 'Groups of hashtags to drop into a caption from the composer. Instagram counts 5 at most since December 2025, so keep the groups short.', replies: 'Answers the team sends often, ready in the Comments inbox.', tags: 'Tags sort posts by theme or campaign. Filter the calendar and the report by them.' }[t[0]];
    var items;
    if (t[0] === 'tags') {
      var used = {}; posts().forEach(function (p) { (p.tags || []).forEach(function (g) { used[g] = (used[g] || 0) + 1; }); });
      items = tagsAll().filter(function (g) { return !qq || lower(g.name).indexOf(qq) >= 0; }).map(function (g) {
        return '<div class="it"><div class="row"><span class="tagdot" style="background:' + E(g.color || PURPLE) + '"></span><b>' + E(g.name) + '</b><span class="sp"></span><span class="muted">' + (used[g.name] || 0) + ' post' + (used[g.name] === 1 ? '' : 's') + '</span></div>' +
          (mk ? '<div class="row"><a class="btn225 sm" data-w225lcal="' + E(g.name) + '">' + I('cal') + ' See the posts</a><span class="sp"></span><a class="btn225 sm" data-w225ledit="tag|' + g.id + '">Change</a><a class="btn225 sm bad" data-w225ldel="tag|' + g.id + '">' + I('trash') + '</a></div>' : '<div class="row"><a class="btn225 sm" data-w225lcal="' + E(g.name) + '">' + I('cal') + ' See the posts</a></div>') + '</div>';
      });
    } else {
      items = lib().filter(function (s) { return s.kind === t[2] && (!qq || (lower(s.name) + ' ' + lower(s.body)).indexOf(qq) >= 0); }).sort(function (a, b) { return Number(b.uses || 0) - Number(a.uses || 0) || String(a.name).localeCompare(String(b.name)); }).map(function (s) {
        var d = s.data || {}, txt = t[0] === 'templates' ? (d.caption || s.body || '') : s.body;
        var meta = t[0] === 'templates' ? (d.platforms || []).map(function (k) { return mark(k); }).join('') + ((d.tags || []).length ? ' <span class="muted">' + E(d.tags.join(', ')) + '</span>' : '') : t[0] === 'hashtags' ? '<span class="muted">' + hashCount(s.body) + ' hashtags</span>' : '';
        var use = t[0] === 'templates' ? '<a class="btn225 sm pri" data-w225luse="' + s.id + '">' + I('plus') + ' Use</a>' : '<a class="btn225 sm" data-w225lcopy="' + s.id + '">' + I('copy') + ' Copy</a>';
        return '<div class="it"><div class="row"><b style="flex:1;min-width:0">' + E(s.name) + '</b>' + (s.uses ? '<span class="muted">used ' + s.uses + '×</span>' : '') + '</div>' + (meta ? '<div>' + meta + '</div>' : '') + '<p>' + E(txt) + '</p>' +
          '<div class="row" style="margin-top:auto">' + use + '<span class="sp"></span>' + (mk ? '<a class="btn225 sm" data-w225ledit="' + t[2] + '|' + s.id + '">Change</a><a class="btn225 sm bad" data-w225ldel="' + t[2] + '|' + s.id + '" title="Remove">' + I('trash') + '</a>' : '') + '</div>' +
          '<small class="muted">' + E(s.updated_by || s.created_by || '') + (s.updated_at ? ' · ' + E(ago(s.updated_at)) : '') + '</small></div>';
      });
    }
    return tabs + '<p class="muted" style="margin:-4px 0 12px">' + E(intro) + '</p>' + libEditor(t) +
      (items.length ? '<div class="lib">' + items.join('') + '</div>' : '<div class="card"><div class="empty">' + (qq ? 'Nothing matches.' : 'Nothing here yet.' + (mk ? ' Press New to add the first one.' : '')) + '</div></div>');
  }
  function libNew(tab) {
    var t = LIBT.filter(function (x) { return x[0] === tab; })[0] || LIBT[0];
    S.libEdit = { tab: t[0], id: null, name: '', body: t[0] === 'hashtags' ? '#WelfareAvenue ' : '', color: TAGCOLORS[tagsAll().length % TAGCOLORS.length], platforms: t[0] === 'templates' ? ['instagram', 'facebook'] : [], first_comment: '' };
  }
  function libEdit(kind, id) {
    if (kind === 'tag') { var g = tagsAll().filter(function (x) { return String(x.id) === String(id); })[0]; if (!g) return; S.libEdit = { tab: 'tags', id: g.id, name: g.name, color: g.color || PURPLE, oldName: g.name }; return; }
    var s = lib().filter(function (x) { return String(x.id) === String(id); })[0]; if (!s) return;
    var t = LIBT.filter(function (x) { return x[2] === s.kind; })[0] || LIBT[0], d = s.data || {};
    S.libEdit = { tab: t[0], id: s.id, name: s.name, body: t[0] === 'templates' ? (d.caption || s.body || '') : s.body, platforms: (d.platforms || []).slice(), first_comment: d.first_comment || '', data: d };
  }
  async function libSave() {
    var e = S.libEdit; if (!e) return;
    var name = String(e.name || '').trim(); if (!name) { toastS('Give it a name'); return; }
    S.busy.lib = true; paint();
    try {
      var r;
      if (e.tab === 'tags') {
        if (tagsAll().some(function (g) { return lower(g.name) === lower(name) && String(g.id) !== String(e.id); })) throw new Error('That tag already exists');
        r = e.id ? await db.from('content_tags').update({ name: name, color: e.color }).eq('id', e.id) : await db.from('content_tags').insert({ name: name, color: e.color, created_by: myName() || myEmail() });
        if (r.error) throw r.error;
        /* a renamed tag follows onto the posts that carry it (the ones this person may change) */
        if (e.id && e.oldName && e.oldName !== name) {
          var hit = posts().filter(function (p) { return (p.tags || []).indexOf(e.oldName) >= 0; });
          for (var i = 0; i < hit.length; i++) { await q(db.from('content_posts').update({ tags: hit[i].tags.map(function (x) { return x === e.oldName ? name : x; }) }).eq('id', hit[i].id)); }
        }
      } else {
        var kind = { templates: 'template', hashtags: 'hashtags', replies: 'reply' }[e.tab];
        var row = { name: name, body: String(e.body || ''), updated_by: myName() || myEmail(), updated_at: new Date().toISOString() };
        if (kind === 'template') row.data = Object.assign({}, e.data || {}, { platforms: (e.platforms || []).slice(), caption: String(e.body || ''), first_comment: String(e.first_comment || '') });
        r = e.id ? await db.from('content_snippets').update(row).eq('id', e.id) : await db.from('content_snippets').insert(Object.assign({ kind: kind, created_by: myName() || myEmail() }, row));
        if (r.error) throw r.error;
      }
      S.libEdit = null; var w = W(); if (w) { await w.studio(); if (e.tab === 'tags') await w.load(true); }
      toastS('Saved');
    } catch (x) { toastS('Could not save: ' + (x.message || x)); }
    S.busy.lib = false; paint();
  }
  async function libRemove(kind, id) {
    var isTag = kind === 'tag', item = isTag ? tagsAll().filter(function (x) { return String(x.id) === String(id); })[0] : lib().filter(function (x) { return String(x.id) === String(id); })[0];
    if (!item) return;
    if (!confirm('Remove "' + item.name + '" from the library?' + (isTag ? ' Posts keep the tag name, without its colour.' : ''))) return;
    try { var r = await db.from(isTag ? 'content_tags' : 'content_snippets').delete().eq('id', id); if (r.error) throw r.error; var w = W(); if (w) await w.studio(); toastS('Removed'); }
    catch (x) { toastS('Could not remove it: ' + (x.message || x)); }
    paint();
  }
  function libUse(id) {
    var s = lib().filter(function (x) { return String(x.id) === String(id); })[0]; if (!s) return;
    var d = s.data || {}, w = W();
    var pre = { platforms: (d.platforms && d.platforms.length ? d.platforms : ['instagram', 'facebook']).slice(), caption: d.caption != null ? d.caption : s.body, first_comment: d.first_comment || '', tags: (d.tags || []).slice(), title: d.title || '' };
    if (d.variants) pre.variants = d.variants;
    if (d.campaign) pre.campaign = d.campaign;
    q(db.from('content_snippets').update({ uses: Number(s.uses || 0) + 1 }).eq('id', s.id));
    if (w && w.compose) w.compose(pre); else if (window.w121Compose) window.w121Compose(pre);
  }
  function libCopy(id) {
    var s = lib().filter(function (x) { return String(x.id) === String(id); })[0]; if (!s) return;
    copyText(s.body || ''); q(db.from('content_snippets').update({ uses: Number(s.uses || 0) + 1 }).eq('id', s.id));
  }
