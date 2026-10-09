
  /* ---------- short links that count clicks (the link pages live in l_pages.js since wave230) ---------- */
  function shortUrl(code) { return HUB + '/l/' + code; }
  function randCode(n) { var a = 'abcdefghjkmnpqrstuvwxyz23456789', s = ''; for (var i = 0; i < (n || 6); i++) s += a.charAt(Math.floor(Math.random() * a.length)); return s; }
  function slug(s) { return lower(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30); }
  function clicksBy(linkId) { return S.clicks.filter(function (c) { return String(c.link_id) === String(linkId); }); }
  function sparkHtml(list, days) {
    days = days || 30; var t = today(), b = [], mx = 1;
    for (var i = days - 1; i >= 0; i--) { var d = addDays(t, -i), n = list.filter(function (c) { return dayOf(c.at) === d; }).length; b.push([d, n]); if (n > mx) mx = n; }
    return '<div class="spark" role="img" aria-label="Clicks a day, last ' + days + ' days">' + b.map(function (x) { return '<i style="height:' + Math.max(2, Math.round(x[1] / mx * 100)) + '%" title="' + E(niceDate(x[0])) + ': ' + x[1] + '"></i>'; }).join('') + '</div>';
  }
  function topOf(list, key, n) { var m = {}; list.forEach(function (c) { var k = c[key] || 'unknown'; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n || 5); }
  function linksTabs() { return '<div class="row" style="margin:0 0 12px"><span class="muted">Short links for posts, emails and print. The link in our bio and its insights live in <a data-w225go="#studio/pages" style="cursor:pointer;font-weight:700;color:' + ROSE + '">Link pages</a>.</span></div>'; }
  function linksHtml() {
    if (S.sub === 'bio') { setTimeout(function () { go('#studio/pages'); }, 0); return ''; }
    var all = S.links.filter(function (l) { return !/^(bio|lp)-/.test(l.code); }), qq = lower(S.f.kq);
    var list = all.filter(function (l) { return (S.f.kall || l.active) && (!qq || (lower(l.code) + ' ' + lower(l.label) + ' ' + lower(l.url) + ' ' + lower(l.campaign)).indexOf(qq) >= 0); });
    var c30 = S.clicks, c7 = c30.filter(function (c) { return Date.now() - new Date(c.at).getTime() < 7 * 86400000; });
    var bio = S.links.filter(function (l) { return /^(bio|lp)-/.test(l.code); }).map(function (l) { return String(l.id); });
    var bioClicks = c30.filter(function (c) { return bio.indexOf(String(c.link_id)) >= 0; }).length;
    var kpis = '<div class="kpis"><div class="kpi"><b>' + num(c30.length) + '</b><span>clicks, 30 days</span><em>' + num(c7.length) + ' in the last 7</em></div><div class="kpi"><b>' + all.filter(function (l) { return l.active; }).length + '</b><span>live short links</span></div><div class="kpi" data-w225go="#studio/pages"><b>' + num(bioClicks) + '</b><span>link page clicks, 30 days</span></div>' +
      '<div class="kpi"><b style="font-size:17px">' + E((topOf(c30, 'device', 1)[0] || ['–'])[0]) + '</b><span>most clicks from</span><em>' + E(topOf(c30, 'referrer_host', 2).map(function (x) { return x[0] + ' ' + x[1]; }).join(' · ')) + '</em></div></div>';
    var mk = S.mk;
    var form = '<div class="card"><h3>' + I('plus') + ' Make a short link <small>anyone on staff</small></h3><div class="row" style="gap:8px"><input type="url" id="w225kurl" placeholder="https://welfareavenue.com/…" style="flex:2;min-width:220px"><input type="text" id="w225klabel" placeholder="What it is (for us)" style="flex:1;min-width:150px"><input type="text" id="w225kcode" placeholder="Ending (optional)" style="width:150px" maxlength="40"><input type="text" id="w225kcamp" placeholder="Campaign (optional)" style="width:160px"><a class="btn225 sm pri" data-w225kmake="1"' + (S.busy.link ? ' disabled' : '') + '>' + I('link') + ' Make it</a></div><p class="muted" style="margin:8px 0 0">The short link is ' + E(HUB) + '/l/<i>ending</i>. Posts make their own when Tracked links is on in the composer, with the UTM tags added.</p></div>';
    var rows = list.map(function (l) {
      var cl = clicksBy(l.id), p = l.post_id ? posts().filter(function (x) { return String(x.id) === String(l.post_id); })[0] : null;
      return '<div class="card" style="padding:12px 14px;' + (l.active ? '' : 'opacity:.6') + '"><div class="row" style="gap:10px;align-items:flex-start"><div style="flex:1;min-width:0"><b>' + E(l.label || l.code) + '</b>' + (l.platform ? ' ' + mark(l.platform) : '') + (l.campaign ? ' <span class="pill">' + E(l.campaign) + '</span>' : '') + (l.active ? '' : ' <span class="pill bad">off</span>') +
        '<div style="font-size:12.5px;margin-top:3px"><a href="' + E(shortUrl(l.code)) + '" target="_blank" rel="noopener" style="color:' + ROSE + ';font-weight:700">' + E(shortUrl(l.code).replace(/^https:\/\//, '')) + '</a> <span class="muted">→ ' + E(clip(l.url, 90)) + '</span></div>' +
        (p ? '<div class="muted" style="font-size:12px;margin-top:2px;cursor:pointer" data-w225open="' + p.id + '">From the post: ' + E(clip(titleOf(p), 60)) + '</div>' : '') + '</div>' +
        '<div style="width:150px">' + sparkHtml(cl, 30) + '<div class="muted" style="font-size:11.5px;text-align:right">' + num(l.clicks || 0) + ' in all · ' + cl.length + ' in 30 days</div></div>' +
        '<div class="row" style="gap:4px"><a class="btn225 sm" data-w225kcopy="' + E(l.code) + '" title="Copy">' + I('copy') + '</a>' + (mk ? '<a class="btn225 sm" data-w225kact="' + (l.active ? 'off' : 'on') + '|' + l.id + '">' + (l.active ? 'Switch off' : 'Switch on') + '</a>' : '') + '</div></div></div>';
    }).join('');
    return linksTabs() + kpis + '<div class="card"><h3>' + I('bolt') + ' Clicks a day <small>every short link, 30 days</small></h3>' + sparkHtml(c30, 30) + '</div>' + form +
      '<div class="row" style="margin:0 0 10px"><input type="search" data-w225kq placeholder="Search the links" value="' + E(S.f.kq || '') + '"><label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-w225kall' + (S.f.kall ? ' checked' : '') + '> Show the switched-off ones</label></div>' +
      (rows || '<div class="card"><div class="empty">' + (all.length ? 'Nothing matches.' : 'No short links yet.') + '</div></div>');
  }
  async function makeLink(url, label, code, campaign, extra) {
    url = String(url || '').trim(); if (!/^https?:\/\/\S+\.\S+/.test(url)) throw new Error('Paste a full address that starts with https://');
    code = String(code || '').trim(); if (code && !/^[A-Za-z0-9_-]{3,40}$/.test(code)) throw new Error('The ending takes letters, numbers, - and _ (3 to 40)');
    if (code && /^(bio|lp)-/.test(code) && !(extra && extra.bio)) throw new Error('Endings that start with lp- are for the link pages');
    var tries = code ? 1 : 4;
    for (var i = 0; i < tries; i++) {
      var c = code || randCode(6);
      var r = await db.from('short_links').insert(Object.assign({ code: c, url: url, label: label || null, campaign: campaign || null, created_by: myName() || myEmail() }, extra && extra.row || {})).select('*').maybeSingle();
      if (!r.error) { S.links.unshift(r.data); return r.data; }
      if (String(r.error.code) !== '23505') throw r.error;
      if (code) throw new Error('That ending is taken: pick another');
    }
    throw new Error('Could not find a free ending, try again');
  }
  async function makeLinkFromForm() {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    S.busy.link = true;
    try { var l = await makeLink(g('w225kurl'), g('w225klabel').trim(), g('w225kcode'), g('w225kcamp').trim()); ['w225kurl', 'w225klabel', 'w225kcode', 'w225kcamp'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; }); copyText(shortUrl(l.code)); toastS('Made and copied: ' + shortUrl(l.code).replace(/^https:\/\//, '')); }
    catch (x) { toastS(x.message || String(x)); }
    S.busy.link = false; paint();
  }
  async function linkActive(id, on) {
    try { var r = await db.from('short_links').update({ active: on }).eq('id', id); if (r.error) throw r.error; S.links.forEach(function (l) { if (String(l.id) === String(id)) l.active = on; }); toastS(on ? 'Switched on' : 'Switched off: the link now goes to the website'); }
    catch (x) { toastS('Could not change it: ' + (x.message || x)); }
    paint();
  }

