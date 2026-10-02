
  /* ---------- the event SOPs (#fund/sops[/<id>]): trainings of kind sop, read in the app, edited in the Avenue Academy ---------- */
  function sopTitle(t) { return String((t && t.title) || '').replace(/^SOP:\s*/i, ''); }
  function sopDepts(t) { var b = sopBody(t), d = Array.isArray(b.depts) ? b.depts : (b.dept ? [b.dept] : []); return d; }
  function teamName(d) { try { return (window.WA_TEAMS && WA_TEAMS.short && WA_TEAMS.short[d]) || (window.WA_TEAMS && WA_TEAMS.labels && WA_TEAMS.labels[d]) || d; } catch (e) { return d; } }
  function sopEvents(t) { return F.events.filter(function (f) { return t && String(f.sop_training_id) === String(t.id) && f.status !== 'cancelled'; }).sort(function (a, b) { return String(a.start_date || '9999').localeCompare(String(b.start_date || '9999')); }); }
  /* the fundraising SOPs first (the team's own and the ones an event uses), then the rest of the library */
  function sopsSorted() {
    var used = {}; F.events.forEach(function (f) { if (f.sop_training_id) used[String(f.sop_training_id)] = 1; });
    var mine = function (t) { return sopDepts(t).indexOf('fundraising') >= 0 || used[String(t.id)]; };
    return F.sops.slice().sort(function (a, b) { var ma = mine(a) ? 0 : 1, mb = mine(b) ? 0 : 1; return ma - mb || (a.sort || 0) - (b.sort || 0) || String(a.title).localeCompare(String(b.title)); });
  }
  function sopCard(t) {
    var b = sopBody(t), ev = sopEvents(t), up = ev.filter(function (f) { return f.status !== 'done'; })[0];
    return '<div class="w193sop" data-w193go="#fund/sops/' + t.id + '" tabindex="0" role="button"><h4>' + E(sopTitle(t)) + '</h4><p>' + E(clip(b.intro || t.summary || '', 170)) + '</p><div class="ft">'
      + sopDepts(t).map(function (d) { return '<span class="w193tag">' + E(teamName(d)) + '</span>'; }).join('')
      + (b.owner ? '<span class="w193tag" style="--bg:rgba(200,122,47,.14);--ink:#8a4d12">' + E(b.owner) + '</span>' : '')
      + (up ? '<span class="w193tag" style="--bg:rgba(42,140,122,.14);--ink:#1d6b5d">' + I('clock') + E(up.title) + (up.start_date ? ', ' + E(fmtDate(up.start_date, { month: 'short', day: 'numeric' })) : '') + '</span>' : '')
      + (b.reviewed ? '<span class="w193tag" style="--bg:transparent;--ink:var(--wa-muted)">reviewed ' + E(fmtDate(b.reviewed)) + '</span>' : '')
      + '</div></div>';
  }
  function sopsHtml() {
    var list = sopsSorted();
    var html = '<div class="w193bar"><span class="w193empty">' + list.length + ' standard operating procedure' + (list.length === 1 ? '' : 's') + '. Each one is a reading in the Avenue Academy; open it there to edit it or to count it as read.</span><span class="sp"></span><a class="w193btn ghost sm" data-w193go="#training">' + I('book') + 'The Avenue Academy</a></div>';
    html += list.length ? '<div class="w193sops">' + list.map(sopCard).join('') + '</div>' : '<div class="w193card"><p class="w193empty">No SOP on file yet. Leaders write them in the Avenue Academy (Trainings, Add an SOP).</p></div>';
    return html;
  }
  function li(arr, fmt) { return (arr || []).map(function (x) { return '<li>' + (fmt ? fmt(x) : E(x)) + '</li>'; }).join(''); }
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }
  function sopReaderHtml(t) {
    var b = sopBody(t), ev = sopEvents(t);
    var html = '<div class="w193bar"><a class="w193btn ghost sm" data-w193go="#fund/sops">' + I('chevl') + 'All SOPs</a><span class="sp"></span><a class="w193btn ghost sm" data-w193go="#training/t/' + t.id + '">' + I('book') + 'Open in the Avenue Academy</a></div>';
    html += '<div class="w193side"><div class="w193card w193reader"><h2>' + E(sopTitle(t)) + '</h2>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px">' + sopDepts(t).map(function (d) { return '<span class="w193tag">' + E(teamName(d)) + '</span>'; }).join('') + (b.owner ? '<span class="w193tag" style="--bg:rgba(200,122,47,.14);--ink:#8a4d12">Owner: ' + E(b.owner) + '</span>' : '') + (b.reviewed ? '<span class="w193tag" style="--bg:transparent;--ink:var(--wa-muted)">reviewed ' + E(fmtDate(b.reviewed)) + '</span>' : '') + '</div>'
      + (b.intro ? '<p class="intro">' + nl(b.intro) + '</p>' : '')
      + (b.glance && b.glance.length ? '<div class="w193glance">' + b.glance.map(function (g) { return '<div><small>' + E(g[0]) + '</small><b>' + E(g[1]) + '</b></div>'; }).join('') + '</div>' : '')
      + (b.format && b.format.length ? '<div class="w193sec"><h4>The format</h4><ul class="w193ul">' + li(b.format) + '</ul></div>' : '')
      + (b.roles && b.roles.length ? '<div class="w193sec"><h4>Who does what</h4><div class="w193roles">' + b.roles.map(function (r) { return '<b>' + E(r[0]) + '</b><span>' + E(r[1]) + '</span>'; }).join('') + '</div></div>' : '')
      + (b.phases && b.phases.length ? '<div class="w193sec"><h4>Step by step</h4>' + b.phases.map(function (p) { return '<div class="w193phase"><h4 style="font-size:15.5px;letter-spacing:0;text-transform:none;color:var(--wa-text)">' + E(p.title || '') + '</h4>' + (p.when ? '<small>' + E(p.when) + '</small>' : '') + '<ol>' + li(p.steps) + '</ol></div>'; }).join('') + '</div>' : '')
      + (b.dayof && b.dayof.length ? '<div class="w193sec"><h4>On the day</h4><ol class="w193ul">' + li(b.dayof) + '</ol></div>' : '')
      + (b.money && b.money.length ? '<div class="w193sec"><h4>The money</h4><ul class="w193ul">' + li(b.money) + '</ul></div>' : '')
      + (b.confirm && b.confirm.length ? '<div class="w193sec"><h4>Before you call it done</h4><ul class="w193ul">' + li(b.confirm) + '</ul></div>' : '')
      + (b.lessons && b.lessons.length ? '<div class="w193sec"><h4>Lessons from last time</h4><ul class="w193ul">' + li(b.lessons) + '</ul></div>' : '')
      + (b.editions && b.editions.length ? '<div class="w193sec"><h4>Past editions</h4><ul class="w193ul">' + li(b.editions, function (e) { return '<b>' + E(e[0]) + '</b>' + (e[1] ? ' (' + E(e[1]) + ')' : '') + (e[2] ? ': ' + E(e[2]) : ''); }) + '</ul></div>' : '')
      + (b.links && b.links.length ? '<div class="w193sec"><h4>Links</h4><ul class="w193ul">' + li(b.links, function (l) { var u = safeUrl(l[1]); return u ? '<a class="w193lnk" href="' + E(u) + '" target="_blank" rel="noopener">' + E(l[0] || u) + '</a>' : E(l[0] || ''); }) + '</ul></div>' : '')
      + (b.sources ? '<p class="w193note">Sources: ' + E(Array.isArray(b.sources) ? b.sources.join('; ') : b.sources) + '</p>' : '')
      + '</div>';
    html += '<div class="w193stack"><div class="w193card"><h3>On the events calendar</h3>' + (ev.length ? '<ul class="w193list">' + ev.map(function (f) { return '<li data-w193go="#fundevents/' + f.id + '"><div class="t"><b>' + E(f.title) + '</b><small>' + E(f.status || '') + (f.raised != null && f.status === 'done' ? ' · raised ' + E(money(f.raised)) : '') + '</small></div>' + (f.start_date ? '<span class="when">' + E(fmtDate(f.start_date, { month: 'short', day: 'numeric', year: 'numeric' })) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="w193empty">No event is linked to this SOP yet. Link one from the event’s form on the Events page.</p>') + '</div></div></div>';
    return html;
  }
