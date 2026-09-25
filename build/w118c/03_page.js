
  /* ---------- the page ---------- */
  var INTRO = 'Our photos, labelled and cleared for use. Copy the alt text and caption, download the size you need, or send a photo straight to the Create studio or a post.';
  var INTRO_RO = 'Our photos, labelled and cleared for use. Copy the alt text and caption, or download the size you need.';
  function panel() {
    var main = document.querySelector('main'); if (!main) return null;
    var sec = document.getElementById('photos');
    if (!sec) { sec = document.createElement('section'); sec.id = 'photos'; sec.className = 'panel'; main.appendChild(sec); }
    sec.setAttribute('data-w118c', '1');
    if (!sec.querySelector('.w118chost')) {
      sec.innerHTML = '<div class="w116ptop"><div class="crumb">More</div><h2>Photo library</h2><p>' + E(INTRO) + '</p><button class="w43help" data-w118chelp="1" type="button">&#63; How this page works</button></div><div class="w118chost"><p class="read">Loading the photo library...</p></div>';
    }
    return sec;
  }
  function live() { return P.rows.filter(function (p) { return p.status !== 'archived'; }); }
  function base(except) {
    /* every filter except one, so each chip shows what it would add */
    var f = P.f;
    return P.rows.filter(function (p) {
      if (f.status === 'archived') { if (p.status !== 'archived') return false; }
      else { if (p.status === 'archived') return false; if (except !== 'status' && f.status === 'needs_labels' && p.status !== 'needs_labels') return false; }
      if (except !== 'usage' && f.usage && (p.usage !== f.usage || p.status === 'needs_labels')) return false;
      if (except !== 'season' && f.season && p.season !== f.season) return false;
      if (except !== 'scene' && f.scene && p.scene !== f.scene) return false;
      if (except !== 'picks' && f.picks && !p.is_pick) return false;
      if (f.series && p.series !== f.series) return false;
      if (f.tag && arr(p.tags).indexOf(f.tag) < 0) return false;
      if (f.q) { var h = hay(p); var terms = f.q.toLowerCase().split(/\s+/).filter(Boolean); for (var i = 0; i < terms.length; i++) if (h.indexOf(terms[i]) < 0) return false; }
      return true;
    });
  }
  function shown() { return sortRows(base(null)); }
  function chip(attr, val, text, on, count, dot, extra) {
    var off = count === 0 && !on;
    return '<span data-' + attr + '="' + E(val) + '" class="' + (on ? 'on' : '') + (off ? ' off' : '') + (extra ? ' ' + extra : '') + '" role="button" tabindex="0" aria-pressed="' + (on ? 'true' : 'false') + '">' + (dot || '') + E(text) + (count != null ? ' <em>' + count + '</em>' : '') + '</span>';
  }
  function toolbar() {
    var f = P.f, st = staff();
    var bu = base('usage'), bs = base('season'), bp = base('picks');
    var cu = function (u) { return bu.filter(function (p) { return p.usage === u && p.status !== 'needs_labels'; }).length; };
    var h = '<div class="pbar"><div class="pr1">' +
      '<label class="srch">' + ic('search') + '<input type="search" id="w118cq" placeholder="Search titles, tags, places, people..." value="' + E(f.q) + '" aria-label="Search the photos"></label>' +
      '<select class="sl" id="w118cscene" aria-label="Scene"><option value="">Any scene</option>' + SCENES.map(function (s) { return '<option value="' + s[0] + '"' + (f.scene === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
      '<select class="sl" id="w118csort" aria-label="Order"><option value="taken"' + (P.sort === 'taken' ? ' selected' : '') + '>Newest first</option><option value="taken_asc"' + (P.sort === 'taken_asc' ? ' selected' : '') + '>Oldest first</option><option value="added"' + (P.sort === 'added' ? ' selected' : '') + '>Recently added</option><option value="title"' + (P.sort === 'title' ? ' selected' : '') + '>By title</option></select>' +
      '<span class="sp"></span>' +
      (st ? '<button class="add" data-w118cgo="new" type="button">' + ic('upload') + 'Add photos</button>' : '') +
      '</div><div class="chips">' +
      chip('w118cu', '', 'All', !f.usage, bu.length) +
      USAGE_ORDER.filter(function (u) { return u === 'ready' || u === 'crop' || u === 'consent' || cu(u) > 0 || f.usage === u; }).map(function (u) { return chip('w118cu', u, USAGE[u].label, f.usage === u, cu(u), '<i class="w118cdot u-' + u + '"></i>'); }).join('') +
      '<b class="dv"></b>' +
      SEASONS.map(function (s) { return chip('w118cs', s[0], s[1], f.season === s[0], bs.filter(function (p) { return p.season === s[0]; }).length); }).join('') +
      '<b class="dv"></b>' +
      chip('w118cpk', '1', 'Picks', f.picks, bp.filter(function (p) { return p.is_pick; }).length, ic('star'), 'pk');
    if (st) {
      var nl = P.rows.filter(function (p) { return p.status === 'needs_labels'; }).length, ar = P.rows.filter(function (p) { return p.status === 'archived'; }).length;
      if (nl || f.status === 'needs_labels') h += '<b class="dv"></b>' + chip('w118cst', 'needs_labels', 'Needs a look', f.status === 'needs_labels', nl, '<i class="w118cdot u-needs"></i>');
      if (ar || f.status === 'archived') h += (nl ? '' : '<b class="dv"></b>') + chip('w118cst', 'archived', 'Archived', f.status === 'archived', ar);
    }
    if (f.series) h += '<b class="dv"></b><span class="x on" data-w118cclr="series" role="button" tabindex="0">Set: ' + E(f.series) + ' &nbsp;&#215;</span>';
    if (f.tag) h += (f.series ? '' : '<b class="dv"></b>') + '<span class="x on" data-w118cclr="tag" role="button" tabindex="0">Tag: ' + E(f.tag) + ' &nbsp;&#215;</span>';
    h += '</div><div class="legend"><i class="w118cdot u-ready"></i><b>Ready</b> for posts, the website, decks and reports. &nbsp; <i class="w118cdot u-crop"></i><b>Crop first:</b> crop the edge in the note before it goes public. &nbsp; <i class="w118cdot u-consent"></i><b>Consent needed:</b> someone we serve or a child is recognizable, so inside the team, or public with their consent.</div></div>';
    return h;
  }
  function card(p) {
    var meta = [monthYear(p.taken_on) || 'Date unknown', label(SEASONS, p.season), label(SCENES, p.scene)].filter(Boolean).join(' \u00b7 ');
    return '<button type="button" class="ph' + (p.status === 'archived' ? ' arch' : '') + '" data-w118cop="' + E(p.key) + '" aria-label="' + E(p.title + ', ' + ulabel(p)) + '">' +
      '<span class="im" style="background:' + E(p.color || '#d9d6cc') + '"><img loading="lazy" decoding="async" src="' + E(url(p, 'thumb')) + '" alt="' + E(p.alt_text || p.title) + '" style="' + focalCss(p) + '">' + badge(p) + (p.is_pick ? '<span class="w118cstar" title="One of our picks">' + ic('star') + '</span>' : '') + '</span>' +
      '<span class="tx"><b>' + E(p.title) + '</b><em>' + E(meta) + '</em></span></button>';
  }
  function paint() {
    var sec = panel(); if (!sec) return;
    var host = sec.querySelector('.w118chost'); if (!host) return;
    var intro = sec.querySelector('.w116ptop p'); if (intro) { var want = staff() ? INTRO : INTRO_RO; if (intro.textContent !== want) intro.textContent = want; }
    if (!allowed()) { host.innerHTML = '<div class="w116empty">The photo library is open to staff and board accounts.</div>'; return; }
    if (!P.loaded) { host.innerHTML = P.err ? '<div class="w116empty">Could not load the photos: ' + E(P.err) + '</div>' : '<p class="read">Loading the photo library...</p>'; return; }
    var qEl = document.getElementById('w118cq'), hadFocus = qEl && document.activeElement === qEl, caret = hadFocus ? qEl.selectionStart : null;
    var list = shown(), html = toolbar();
    var nLive = live().length;
    if (!P.rows.length) {
      html += '<div class="w116empty" style="margin-top:14px">No photos yet.' + (staff() ? ' Add the first ones with Add photos: the hub makes the sizes and suggests the labels.' : '') + '</div>';
    } else if (!list.length) {
      html += '<div class="w116empty" style="margin-top:14px">No photo matches that. <a data-w118cclr="all" style="cursor:pointer;text-decoration:underline;font-weight:700">Clear the filters</a></div>';
    } else {
      var picked = list.slice(0, P.limit);
      html += '<div class="sum">' + (list.length === nLive && P.f.status !== 'archived' ? nLive + ' photo' + (nLive === 1 ? '' : 's') : list.length + ' of ' + nLive + ' photo' + (nLive === 1 ? '' : 's')) + (P.f.status === 'archived' ? ' (archived)' : '') + '</div>';
      if (P.sort === 'taken' || P.sort === 'taken_asc') {
        var groups = [], cur = null;
        picked.forEach(function (p) { var y = p.taken_on ? String(p.taken_on).slice(0, 4) : 'Date unknown'; if (!cur || cur.y !== y) { cur = { y: y, list: [] }; groups.push(cur); } cur.list.push(p); });
        groups.forEach(function (g) {
          var all = list.filter(function (p) { return (p.taken_on ? String(p.taken_on).slice(0, 4) : 'Date unknown') === g.y; }).length;
          html += '<div class="grp"><h3>' + E(g.y) + '</h3><span>' + all + ' photo' + (all === 1 ? '' : 's') + '</span></div><div class="grid">' + g.list.map(card).join('') + '</div>';
        });
      } else {
        html += '<div class="grid" style="margin-top:14px">' + picked.map(card).join('') + '</div>';
      }
      if (list.length > picked.length) html += '<button class="more" data-w118cmore="1" type="button">Show ' + Math.min(120, list.length - picked.length) + ' more</button>';
    }
    html += '<div class="foot">Files live in Supabase storage, <code>content-images/photos/</code> (full, web and thumb), and the labels in the <code>wa_photos</code> table.' + (staff() ? ' Every change is in the Activity log.' : '') + '</div>';
    host.innerHTML = html;
    if (hadFocus) { var q2 = document.getElementById('w118cq'); if (q2) { q2.focus(); try { q2.setSelectionRange(caret, caret); } catch (e) { /* fine */ } } }
  }
