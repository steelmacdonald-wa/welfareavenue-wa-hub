
  /* ---------- links: short links that count clicks, and the link-in-bio page ---------- */
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
  function linksTabs(cur) { return '<div class="row" style="margin:0 0 12px"><span class="seg"><a data-w225go="#studio/links" class="' + (cur === 'links' ? 'on' : '') + '">' + I('link') + ' Short links<span class="n">' + S.links.filter(function (l) { return !/^bio-/.test(l.code); }).length + '</span></a><a data-w225go="#studio/links/bio" class="' + (cur === 'bio' ? 'on' : '') + '">' + I('heart') + ' Link in bio</a></span><span class="sp"></span><a class="btn225 sm" href="' + HUB + '/links" target="_blank" rel="noopener">' + I('ext') + ' Open the bio page</a></div>'; }
  function linksHtml() {
    if (S.sub === 'bio') return linksTabs('bio') + bioHtml();
    var all = S.links.filter(function (l) { return !/^bio-/.test(l.code); }), qq = lower(S.f.kq);
    var list = all.filter(function (l) { return (S.f.kall || l.active) && (!qq || (lower(l.code) + ' ' + lower(l.label) + ' ' + lower(l.url) + ' ' + lower(l.campaign)).indexOf(qq) >= 0); });
    var c30 = S.clicks, c7 = c30.filter(function (c) { return Date.now() - new Date(c.at).getTime() < 7 * 86400000; });
    var bio = S.links.filter(function (l) { return /^bio-/.test(l.code); }).map(function (l) { return String(l.id); });
    var bioClicks = c30.filter(function (c) { return bio.indexOf(String(c.link_id)) >= 0; }).length;
    var kpis = '<div class="kpis"><div class="kpi"><b>' + num(c30.length) + '</b><span>clicks, 30 days</span><em>' + num(c7.length) + ' in the last 7</em></div><div class="kpi"><b>' + all.filter(function (l) { return l.active; }).length + '</b><span>live short links</span></div><div class="kpi" data-w225go="#studio/links/bio"><b>' + num(bioClicks) + '</b><span>link-in-bio clicks, 30 days</span></div>' +
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
    return linksTabs('links') + kpis + '<div class="card"><h3>' + I('bolt') + ' Clicks a day <small>every short link, 30 days</small></h3>' + sparkHtml(c30, 30) + '</div>' + form +
      '<div class="row" style="margin:0 0 10px"><input type="search" data-w225kq placeholder="Search the links" value="' + E(S.f.kq || '') + '"><label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-w225kall' + (S.f.kall ? ' checked' : '') + '> Show the switched-off ones</label></div>' +
      (rows || '<div class="card"><div class="empty">' + (all.length ? 'Nothing matches.' : 'No short links yet.') + '</div></div>');
  }
  async function makeLink(url, label, code, campaign, extra) {
    url = String(url || '').trim(); if (!/^https?:\/\/\S+\.\S+/.test(url)) throw new Error('Paste a full address that starts with https://');
    code = String(code || '').trim(); if (code && !/^[A-Za-z0-9_-]{3,40}$/.test(code)) throw new Error('The ending takes letters, numbers, - and _ (3 to 40)');
    if (code && /^bio-/.test(code) && !(extra && extra.bio)) throw new Error('Endings that start with bio- are for the link in bio');
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

  /* the link-in-bio page (hub.welfareavenue.com/links): hub_settings link_page + the active bio-* short links */
  function bioDraft() {
    if (!S.bioDraft) { var v = S.linkPage || {}; S.bioDraft = { title: v.title || 'Welfare Avenue', bio: v.bio || '', theme: v.theme || 'green', order: (v.order || []).slice(), socials: Object.assign({}, v.socials || {}), dirty: false }; }
    return S.bioDraft;
  }
  function bioLinks(includeOff) {
    var d = bioDraft(), list = S.links.filter(function (l) { return /^bio-/.test(l.code) && (includeOff || l.active); });
    return list.sort(function (a, b) { var ia = d.order.indexOf(a.code), ib = d.order.indexOf(b.code); if (ia < 0) ia = 999 + Number(a.id); if (ib < 0) ib = 999 + Number(b.id); return ia - ib; });
  }
  var BIO_SOC = [['instagram', 'Instagram', 'https://instagram.com/welfareavenue'], ['facebook', 'Facebook', 'https://facebook.com/welfareavenue'], ['tiktok', 'TikTok', ''], ['linkedin', 'LinkedIn', ''], ['youtube', 'YouTube', '']];
  function bioHtml() {
    var d = bioDraft(), mk = S.mk, live = bioLinks(false), all = bioLinks(true);
    var editor = '<div class="card"><h3>' + I('star') + ' The page</h3>' +
      '<label class="muted" style="display:block;margin:0 0 4px">Name at the top</label><input type="text" data-w225bf="title" value="' + E(d.title) + '" style="width:100%" maxlength="60"' + (mk ? '' : ' disabled') + '>' +
      '<label class="muted" style="display:block;margin:10px 0 4px">A line under it</label><textarea data-w225bf="bio" rows="2" style="width:100%" maxlength="200"' + (mk ? '' : ' disabled') + '>' + E(d.bio) + '</textarea>' +
      '<label class="muted" style="display:block;margin:10px 0 4px">Colours</label><span class="seg"><a data-w225btheme="green" class="' + (d.theme === 'green' ? 'on' : '') + '">Green</a><a data-w225btheme="cream" class="' + (d.theme === 'cream' ? 'on' : '') + '">Cream</a></span>' +
      '<h4>Social icons at the bottom</h4>' + BIO_SOC.map(function (s) { return '<div class="row" style="margin:4px 0">' + mark(s[0]) + '<input type="url" data-w225bsoc="' + s[0] + '" value="' + E(d.socials[s[0]] != null ? d.socials[s[0]] : '') + '" placeholder="' + E(s[2] || s[1] + ' address (optional)') + '" style="flex:1"' + (mk ? '' : ' disabled') + '></div>'; }).join('') + '</div>';
    var links = '<div class="card"><h3>' + I('link') + ' The buttons <small>top to bottom</small></h3>' + (all.length ? all.map(function (l, i) {
      var cl = clicksBy(l.id).length;
      return '<div class="bl" style="' + (l.active ? '' : 'opacity:.55') + '"><span class="muted">' + (i + 1) + '</span><input type="text" data-w225blabel="' + l.id + '" value="' + E(l.label || '') + '"' + (mk ? '' : ' disabled') + '><input type="url" data-w225burl="' + l.id + '" value="' + E(l.url) + '"' + (mk ? '' : ' disabled') + '><span class="row" style="gap:3px;flex-wrap:nowrap">' +
        (mk ? '<a class="btn225 sm" data-w225bmove="up|' + l.code + '" title="Up"' + (i ? '' : ' disabled') + '>' + I('up') + '</a><a class="btn225 sm" data-w225bmove="down|' + l.code + '" title="Down"' + (i < all.length - 1 ? '' : ' disabled') + '>' + I('down') + '</a><a class="btn225 sm" data-w225kact="' + (l.active ? 'off' : 'on') + '|' + l.id + '" title="' + (l.active ? 'Hide it' : 'Show it') + '">' + I(l.active ? 'eye' : 'plus') + '</a>' : '') + '<span class="muted" style="font-size:11.5px;min-width:52px;text-align:right">' + cl + ' clicks</span></span></div>';
    }).join('') : '<div class="empty">No buttons yet.</div>') +
      (mk ? '<div class="row" style="margin-top:10px;gap:8px"><input type="text" id="w225bnl" placeholder="Button text, e.g. Volunteer with us" style="flex:1;min-width:160px"><input type="url" id="w225bnu" placeholder="https://…" style="flex:1.3;min-width:180px"><a class="btn225 sm" data-w225badd="1">' + I('plus') + ' Add a button</a></div>' : '') +
      '<p class="muted" style="margin:8px 0 0">Each button is a short link (bio-…), so its clicks count here. Changes to a button’s text or address save when you press Save the page.</p></div>';
    var phone = '<div class="phone ' + E(d.theme) + '"><div class="av">W</div><h5>' + E(d.title) + '</h5><p>' + E(d.bio) + '</p>' + live.map(function (l) { return '<a>' + E(l.label || l.code) + '</a>'; }).join('') +
      '<div style="margin-top:14px;display:flex;gap:6px;justify-content:center">' + BIO_SOC.filter(function (s) { return d.socials[s[0]]; }).map(function (s) { return mark(s[0]); }).join('') + '</div></div>';
    var save = mk ? '<div class="row" style="margin:0 0 12px"><span class="muted">' + (d.dirty ? 'Changes not saved yet.' : 'Everything is saved.') + '</span><span class="sp"></span><a class="btn225 sm" data-w225bcopy="1">' + I('copy') + ' Copy the address for the bio</a><a class="btn225 sm pri" data-w225bsave="1"' + (S.busy.bio ? ' disabled' : '') + '>' + I('check') + ' Save the page</a></div>' : '';
    return save + '<div class="grid2"><div>' + editor + links + '</div><div><div class="card"><h3>' + I('eye') + ' How it looks</h3>' + phone + '<p class="muted" style="text-align:center;margin:10px 0 0">' + E(HUB.replace(/^https:\/\//, '')) + '/links</p></div></div></div>';
  }
  async function bioAdd() {
    var lab = (document.getElementById('w225bnl') || {}).value || '', url = (document.getElementById('w225bnu') || {}).value || '';
    if (!lab.trim()) { toastS('Write the button text'); return; }
    try {
      var base = 'bio-' + (slug(lab) || randCode(4)), code = base, n = 2;
      while (S.links.some(function (l) { return l.code === code; })) code = base.slice(0, 36) + '-' + (n++);
      var l = await makeLink(url, lab.trim(), code, 'link in bio', { bio: true, row: { platform: 'instagram' } });
      ['w225bnl', 'w225bnu'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
      var d = bioDraft(); d.order = bioLinks(true).map(function (x) { return x.code; }).filter(function (c) { return c !== l.code; }).concat([l.code]); d.dirty = true;
      toastS('Added: press Save the page to keep the order');
    } catch (x) { toastS(x.message || String(x)); }
    paint();
  }
  function bioMove(dir, code) {
    var d = bioDraft(), codes = bioLinks(true).map(function (l) { return l.code; }), i = codes.indexOf(code), j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= codes.length) return; var t = codes[i]; codes[i] = codes[j]; codes[j] = t; d.order = codes; d.dirty = true; paint();
  }
  async function bioSave() {
    var d = bioDraft(); S.busy.bio = true; paint();
    try {
      /* the buttons' text and addresses */
      var edits = [];
      document.querySelectorAll('#w225host [data-w225blabel]').forEach(function (el) { var id = el.getAttribute('data-w225blabel'), l = S.links.filter(function (x) { return String(x.id) === id; })[0], u = document.querySelector('#w225host [data-w225burl="' + id + '"]'); if (!l) return; var nl = el.value.trim(), nu = u ? u.value.trim() : l.url; if (nl !== (l.label || '') || nu !== l.url) edits.push([l, nl, nu]); });
      for (var i = 0; i < edits.length; i++) {
        if (!/^https?:\/\/\S+\.\S+/.test(edits[i][2])) throw new Error('A button’s address needs to start with https://');
        var r = await db.from('short_links').update({ label: edits[i][1] || null, url: edits[i][2] }).eq('id', edits[i][0].id); if (r.error) throw r.error; edits[i][0].label = edits[i][1]; edits[i][0].url = edits[i][2];
      }
      var socials = {}; Object.keys(d.socials).forEach(function (k) { var v = String(d.socials[k] || '').trim(); if (v) { if (!/^https?:\/\//.test(v)) throw new Error('Social addresses start with https://'); socials[k] = v; } });
      var value = Object.assign({}, S.linkPage || {}, { title: String(d.title || '').trim() || 'Welfare Avenue', bio: String(d.bio || '').trim(), theme: d.theme === 'cream' ? 'cream' : 'green', order: bioLinks(true).map(function (l) { return l.code; }), socials: socials });
      var s = await db.rpc('studio_settings_save', { p_key: 'link_page', p_value: value }); if (s.error) throw s.error;
      S.linkPage = value; d.dirty = false; toastS('Saved: the page is live');
    } catch (x) { toastS('Could not save: ' + (x.message || x)); }
    S.busy.bio = false; paint();
  }
