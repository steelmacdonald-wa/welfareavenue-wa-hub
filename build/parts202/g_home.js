  /* ---------- the studio's front page: three ways to start, the templates on their shelves, the recent emails ---------- */
  function studioTemplates() { return templates().filter(function (t) { return t.design && !t.one_off; }); }
  function recentOneOffs() {
    return templates().filter(function (t) { return t.design && t.one_off; })
      .sort(function (a, b) { return str(b.updated_at).localeCompare(str(a.updated_at)); });
  }
  function hasBrackets(t) { return /\[[^\]\n]{1,90}\](?!\()/.test(str(t.subject) + ' ' + str(t.preheader) + ' ' + str(t.html_body)); }
  function miniHero(t) {
    var h = ((t.design && t.design.blocks) || []).filter(function (b) { return b.type === 'hero'; })[0];
    var lines = h ? (h.lines || []) : [t.name], green = h && h.style === 'green';
    var sv = function (s) { return MAIL202.fill(s, MAIL202.SAMPLE, false); };   /* placeholders shown as a reader would see them */
    return '<div class="w202mini' + (green ? ' g' : '') + '" aria-hidden="true">' + (h && h.kicker ? '<i>' + E(sv(h.kicker)) + '</i>' : '') +
      lines.slice(0, 3).map(function (l, k) { return '<b' + (k === lines.length - 1 ? ' class="a"' : '') + '>' + E(sv(l)) + '</b>'; }).join('') + '</div>';
  }
  function tplCard(t) {
    var k = KIND[t.kind] || { short: t.kind }, mine = canEdit(t), fill = hasBrackets(t);
    return '<div class="w202card" role="listitem">' + miniHero(t) +
      '<div class="w202cb" data-w198skip><b>' + E(t.name) + '</b><span class="m">' + E(t.description || t.subject) + '</span></div>' +
      '<div class="w202chips"><span class="w202chip">' + E(k.short) + '</span>' + (t.audience ? '<span class="w202chip p">' + E(AUD[t.audience] || t.audience) + '</span>' : '') +
      (t.created_by === 'starter' ? '<span class="w202chip g">Starter</span>' : '') + (!t.active ? '<span class="w202chip x">Switched off</span>' : '') + (fill ? '' : '<span class="w202chip t" title="No [brackets] left: an automation can use it as it is">Ready as is</span>') + '</div>' +
      '<div class="w202ca">' + (fill ? '<button class="w152btn sm" data-w202fill="' + E(t.key) + '">' + I('spark') + ' Fill it in</button>' : '<button class="w152btn sm" data-w202use="' + E(t.key) + '">' + I('copy') + ' Use it</button>') +
      '<button class="w152btn sm ghost" data-w202peek="' + E(t.key) + '">' + I('eye') + ' Look</button>' +
      (mine ? '<button class="w152btn sm ghost" data-w202edit="' + E(t.key) + '">' + I('edit') + ' Edit</button>' : '') + '</div></div>';
  }
  function shelvesHtml(list, compact) {
    var f = SS.filter;
    var rows = list.filter(function (t) { return f === 'all' || (t.audience === f) || (f === 'donors' && t.audience === 'everyone') || (f === 'volunteers' && t.audience === 'everyone'); });
    if (!rows.length) return '<p class="m">No templates here yet.</p>';
    return SHELF.map(function (s) {
      var on = rows.filter(function (t) { return (t.category || 'other') === s[0]; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0) || str(a.name).localeCompare(str(b.name)); });
      if (!on.length) return '';
      return '<div class="w202shelf"><h4>' + E(s[1]) + ' <span class="m">' + on.length + '</span></h4><div class="w202grid' + (compact ? ' c' : '') + '" role="list">' + on.map(compact ? tplRow : tplCard).join('') + '</div></div>';
    }).join('');
  }
  function tplRow(t) {
    var on = SS.start.tpl === t.key;
    return '<button class="w202trow' + (on ? ' on' : '') + '" role="listitem" data-w202tplpick="' + E(t.key) + '" aria-pressed="' + on + '">' + miniHero(t) + '<span data-w198skip><b>' + E(t.name) + '</b><span class="m">' + E(t.description || t.subject) + '</span></span></button>';
  }
  function filterHtml() {
    return '<div class="w202filt" role="group" aria-label="Who the templates are for">' + [['all', 'All'], ['volunteers', 'Volunteers'], ['donors', 'Donors']].map(function (f) {
      return '<button class="w202fb' + (SS.filter === f[0] ? ' on' : '') + '" data-w202filter="' + f[0] + '" aria-pressed="' + (SS.filter === f[0]) + '">' + E(f[1]) + '</button>';
    }).join('') + '</div>';
  }
  function homeHtml() {
    var mine = recentOneOffs(), me = myEmail();
    var rec = mine.filter(function (t) { return lower(t.created_by) === me; }).concat(mine.filter(function (t) { return lower(t.created_by) !== me; })).slice(0, SS.allRecent ? 60 : 8);
    return '<div class="w202">' +
      '<section class="w202top" data-w202sec="start"><div class="w202intro"><span class="w202kick">Email studio</span><h2>Emails in the brand, put together with you</h2>' +
      '<p>For one person, a list or an automation. The Hub puts your words and photos into a Welfare Avenue email, and checks it with you before anything goes out.</p>' +
      '<button class="w202vbtn" data-w202voices="wa">' + I('voice') + ' Voices <span>Welfare Avenue' + (SS.voices.mine ? ' · My voice' : '') + '</span></button></div>' +
      '<div class="w202ways">' +
      '<button class="w202way" data-w202go="#crm/studio/ai">' + I('spark') + '<b>Tell the Hub</b><span>Write what you want to say and add your photos. The Hub puts it together and asks about anything missing.</span></button>' +
      '<button class="w202way" data-w202go="#crm/studio/tpl">' + I('layout') + '<b>Start from a template</b><span>Pick one of our templates and give it your details. The Hub fills it in, or you do.</span></button>' +
      '<button class="w202way" data-w202blank>' + I('blocks') + '<b>Build it yourself</b><span>Blocks you arrange: a headline, text, details, a button, photos, a video, a sign-off.</span></button>' +
      '</div></section>' +
      (SS.msg ? '<div class="w154msg">' + E(SS.msg) + '</div>' : '') + (SS.err ? '<div class="w152err">' + E(SS.err) + '</div>' : '') +
      '<section class="w202sec" data-w202sec="templates"><div class="w202sh"><h3>' + I('layout') + ' Templates</h3>' + filterHtml() + '</div>' +
      '<p class="m">Our starters and the templates the team saved. “Ready as is” ones have nothing left to fill in, so an automation can send them; the others start you off with [brackets] to fill.</p>' +
      shelvesHtml(studioTemplates()) + '</section>' +
      '<section class="w202sec" data-w202sec="recent"><div class="w202sh"><h3>' + I('mail') + ' Recent emails</h3></div>' +
      (rec.length ? '<div class="w202recent" role="list">' + rec.map(function (t) {
        return '<button class="w202rrow" role="listitem" data-w202open="' + E(t.key) + '"><span data-w198skip><b>' + E(t.name) + '</b><span class="m">' + E(t.subject) + '</span></span>' +
          '<span class="m">' + E(KIND[t.kind] ? KIND[t.kind].short : t.kind) + ' · ' + E(lower(t.created_by) === me ? 'you' : str(t.created_by).split('@')[0]) + ' · ' + E(ago(t.updated_at)) + '</span>' + I('chev') + '</button>';
      }).join('') + '</div>' + (mine.length > 8 && !SS.allRecent ? '<button class="w152btn sm ghost" data-w202allrecent>Show all ' + mine.length + '</button>' : '')
        : '<p class="m">The emails you write here show up in this list, ready to finish or send again.</p>') + '</section>' +
      peekHtml() + voicesHtml() + '</div>';
  }
  /* a quick look at a template as it will arrive */
  function peekHtml() {
    if (!SS.peek) return '';
    var t = tplByKey(SS.peek); if (!t) return '';
    var html = MAIL202.preview({ html: t.html_body, subject: t.subject, preheader: t.preheader, kind: t.kind, cfg: mailSettings() || {} });
    return '<div class="w202modal" role="dialog" aria-modal="true" aria-label="' + E(t.name) + '"><div class="w202mbox wide">' +
      '<div class="w202mh"><h3 data-w198skip>' + E(t.name) + '</h3><button class="w202x" data-w202peekx aria-label="Close">' + I('x') + '</button></div>' +
      '<div class="m" data-w198skip>Subject: <b>' + E(MAIL202.fill(t.subject, MAIL202.SAMPLE, false)) + '</b>' + (t.preheader ? ' · ' + E(MAIL202.fill(t.preheader, MAIL202.SAMPLE, false)) : '') + '</div>' +
      '<iframe class="w202frame peek" sandbox="allow-same-origin" title="The template as it will look" srcdoc="' + E(html) + '"></iframe>' +
      '<div class="w154acts">' + (hasBrackets(t) ? '<button class="w152btn" data-w202fill="' + E(t.key) + '">' + I('spark') + ' Fill it in</button>' : '<button class="w152btn" data-w202use="' + E(t.key) + '">' + I('copy') + ' Use it</button>') +
      (canEdit(t) ? '<button class="w152btn ghost" data-w202edit="' + E(t.key) + '">' + I('edit') + ' Edit the template</button>' : '') + '<button class="w152btn ghost" data-w202peekx>Close</button></div></div></div>';
  }
