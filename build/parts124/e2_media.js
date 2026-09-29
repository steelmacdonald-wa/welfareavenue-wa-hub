
  /* ---------- wave168: photos on the fundraising events (29/09/26) ----------
     Steel: "where possible add photos to our fundraising events pages". An event carries a cover from the Photo library
     (fund_events.cover_photo_id), a gallery (photo_series: its own photos, or last year's edition) and the past fundraisers
     like it from the website's archive (past_site_events: site_events with their posters). Cards show the cover (or the
     latest poster); an event's page opens on it, with the photos and the past fundraisers, each opening full size. Only
     photos marked ready in the Photo library, and only the Hub's own storage. */
  var PSTORE = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/';
  var OWN = /^https:\/\/zwnmulmnvopclzcvytce\.supabase\.co\/storage\/v1\/object\/public\/[\w./%-]+$/;
  var DOODLE = { star: PSTORE + 'brand/doodle-star-gold.png', ast: PSTORE + 'brand/doodle-asterisk-cream.png', flowers: PSTORE + 'brand/doodle-flowers-gold.png' };
  var BRAND_E = PSTORE + 'brand/e-large-gold-600.png';
  var DOODLES = [PSTORE + 'brand/doodle-star-gold.png', PSTORE + 'brand/doodle-flowers-gold.png', PSTORE + 'brand/doodle-heart-purple.png', PSTORE + 'brand/doodle-asterisk-cream.png'];
  /* an event with no picture yet: the brand's green, the E that moves and a doodle (one per event, so the cards differ) */
  function brandBand(f, cls) { return '<div class="' + cls + ' brand" aria-hidden="true"><img class="e" src="' + BRAND_E + '" alt=""><img class="s" src="' + DOODLES[Math.abs(Number(f.id) || 0) % DOODLES.length] + '" alt=""></div>'; }
  /* a poster at the size it is shown (Supabase's image resizing); the original if the resizing does not answer */
  function sized(u, w) { return String(u).replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=' + w + '&resize=contain&quality=72'; }
  function posterImg(u, w, alt, lazy) { return '<img src="' + E(sized(u, w)) + '" data-w168orig="' + E(u) + '" alt="' + E(alt || '') + '"' + (lazy ? ' loading="lazy"' : '') + '>'; }
  document.addEventListener('error', function (e) {
    var t = e.target; if (!t || t.tagName !== 'IMG' || !t.getAttribute('data-w168orig')) return;
    var o = t.getAttribute('data-w168orig'); t.removeAttribute('data-w168orig'); if (OWN.test(o)) t.src = o;
  }, true);
  function photoRow(id) { return (C.photos || []).filter(function (p) { return String(p.id) === String(id); })[0] || null; }
  function pUrl(p, thumb) { return p ? PSTORE + String(thumb && p.path_thumb ? p.path_thumb : p.path_web).replace(/^\/+/, '') : ''; }
  function pPos(p) { return Math.round(100 * (p && p.focal_x != null ? p.focal_x : 0.5)) + '% ' + Math.round(100 * (p && p.focal_y != null ? p.focal_y : 0.5)) + '%'; }
  function yearOf(d) { var m = /^(\d{4})/.exec(String(d || '')); return m ? Number(m[1]) : null; }
  function shown(p) { return !!(p && p.path_web && p.usage === 'ready'); }
  /* the year a photo is from: when it was taken, or the year its series names (gift-baskets-2025) */
  function photoYear(p) { var y = p ? yearOf(p.taken_on) : null; if (!y && p) { var m = /(20\d\d)/.exec(String(p.series || '')); if (m) y = Number(m[1]); } return y; }
  function tidy(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
  function evName(s) { return tidy(s.title) + ', ' + monthYear(s.starts_at); }
  function monthYear(d) { var x = parseDay(String(d || '').slice(0, 10)); return x ? MONTHS[x.getMonth()] + ' ' + x.getFullYear() : ''; }
  function mediaOf(f) {
    var cover = f.cover_photo_id ? photoRow(f.cover_photo_id) : null; if (!shown(cover)) cover = null;
    var gallery = f.photo_series ? (C.photos || []).filter(function (p) { return p.series === f.photo_series && shown(p); }) : [];
    if (!cover && gallery.length) cover = gallery[0];
    var past = (f.past_site_events || []).map(function (id) { return (C.siteEv || []).filter(function (s) { return String(s.id) === String(id); })[0]; }).filter(Boolean)
      .sort(function (a, b) { return String(a.starts_at || '').localeCompare(String(b.starts_at || '')); });
    var last = past.length ? past[past.length - 1] : null, poster = null;
    if (last) { var u = last.poster_url || last.hero_url; if (OWN.test(String(u || ''))) poster = u; }
    var ey = yearOf(f.start_date) || yearOf(f.end_date), cy = cover ? photoYear(cover) : null;
    return { cover: cover, gallery: gallery, past: past, poster: poster, last: last, earlier: !!(cover && cy && (!ey || cy < ey)) && f.status !== 'done', year: cy };
  }
  function cardCover(f) {
    var m = mediaOf(f);
    if (m.cover) return '<div class="w168cv" style="background-image:url(\'' + E(pUrl(m.cover, true)) + '\');background-position:' + pPos(m.cover) + '">' + (m.earlier ? '<span class="lb">The ' + m.year + ' edition</span>' : '') + '</div>';
    if (m.poster) return '<div class="w168cv poster">' + posterImg(m.poster, 480, '', true) + '<span class="lb">From ' + E(monthYear(m.last.starts_at)) + '</span></div>';
    return brandBand(f, 'w168cv');
  }
  function sheetHero(f) {
    var m = mediaOf(f);
    if (m.cover) return '<div class="w168hero" style="background-image:url(\'' + E(pUrl(m.cover)) + '\');background-position:' + pPos(m.cover) + '" role="img" aria-label="' + E(m.cover.alt_text || m.cover.title || '') + '"><img class="d" src="' + DOODLE.star + '" alt="">' + (m.earlier ? '<span class="lb">Photo: the ' + m.year + ' edition</span>' : '') + '</div>';
    if (m.poster) return '<button type="button" class="w168hero poster" data-w168full="' + E(m.poster) + '" data-w168alt="' + E(evName(m.last)) + '">' + posterImg(m.poster, 900, evName(m.last)) + '<span class="lb">' + E(evName(m.last)) + '</span></button>';
    return brandBand(f, 'w168hero') + (canEditFund() ? '<p class="w168hint">No photo yet: Edit the event to choose one from the Photo library, or tick past fundraisers like it.</p>' : '');
  }
  function sheetMedia(f) {
    var m = mediaOf(f), h = '';
    if (m.gallery.length) h += '<div class="w168sec"><b>' + (m.earlier ? 'Photos from the ' + m.year + ' edition' : 'Photos') + '</b><div class="w168gal">' + m.gallery.map(function (p) {
      return '<button type="button" class="w168g" data-w168full="' + E(pUrl(p)) + '" data-w168alt="' + E(p.alt_text || p.title || '') + '" aria-label="' + E(p.title || 'A photo') + '" style="background-image:url(\'' + E(pUrl(p, true)) + '\');background-position:' + pPos(p) + '"></button>';
    }).join('') + '</div></div>';
    if (m.past.length) h += '<div class="w168sec"><b>' + (m.past.length === 1 ? 'A past fundraiser like it' : 'Past fundraisers like it') + '</b><div class="w168past">' + m.past.map(function (s) {
      var u = s.poster_url || s.hero_url; if (!OWN.test(String(u || ''))) u = '';
      return '<button type="button" class="w168pp"' + (u ? ' data-w168full="' + E(u) + '" data-w168alt="' + E(evName(s)) + '"' : '') + '>' + (u ? posterImg(u, 360, '', true) : '') + '<span><b>' + E(tidy(s.title)) + '</b>' + E(monthYear(s.starts_at)) + '</span></button>';
    }).join('') + '</div></div>';
    return h;
  }
  /* the edit form: a cover from the Photo library, the photos shown, the past editions */
  function mediaForm(f) {
    var ready = (C.photos || []).filter(function (p) { return shown(p) && p.path_thumb && (p.orientation !== 'portrait' || String(p.id) === String(f.cover_photo_id)); });
    if (f.photo_series) ready.sort(function (a, b) { return (b.series === f.photo_series ? 1 : 0) - (a.series === f.photo_series ? 1 : 0); });
    if (f.cover_photo_id) ready.sort(function (a, b) { return (String(b.id) === String(f.cover_photo_id) ? 1 : 0) - (String(a.id) === String(f.cover_photo_id) ? 1 : 0); });
    var series = {}; (C.photos || []).forEach(function (p) { if (p.series && shown(p)) series[p.series] = (series[p.series] || 0) + 1; });
    if (f.photo_series && !series[f.photo_series]) series[f.photo_series] = 0;
    var sOpts = '<option value="">None</option>' + Object.keys(series).sort().map(function (k) { return '<option value="' + E(k) + '"' + (k === f.photo_series ? ' selected' : '') + '>' + E(k) + (series[k] ? ' (' + series[k] + ')' : '') + '</option>'; }).join('');
    var past = (f.past_site_events || []).map(String);
    return '<div class="w168form"><label class="f">Cover photo<span class="op">from the Photo library</span></label><input type="hidden" name="cover_photo_id" value="' + E(f.cover_photo_id || '') + '">'
      + '<div class="w168pick"><button type="button" class="w168th none' + (f.cover_photo_id ? '' : ' on') + '" data-w168pick="">None</button>' + ready.map(function (p) {
        return '<button type="button" class="w168th' + (String(p.id) === String(f.cover_photo_id) ? ' on' : '') + '" data-w168pick="' + E(p.id) + '" title="' + E(p.title || '') + '" aria-label="' + E('Use ' + (p.title || 'this photo')) + '" style="background-image:url(\'' + E(pUrl(p, true)) + '\')"></button>';
      }).join('') + '</div>'
      + '<label class="f" for="w168ps">Photos shown<span class="op">a series of the Photo library</span></label><select id="w168ps" name="photo_series">' + sOpts + '</select>'
      + ((C.siteEv || []).length ? '<label class="f">Past fundraisers like it<span class="op">from the website&rsquo;s archive</span></label><div class="w168chk" data-w168past>' + (C.siteEv || []).map(function (s) {
        return '<label><input type="checkbox" name="past_site" value="' + E(s.id) + '"' + (past.indexOf(String(s.id)) >= 0 ? ' checked' : '') + '> ' + E(tidy(s.title)) + ' <span class="op">' + E(monthYear(s.starts_at)) + '</span></label>';
      }).join('') + '</div>' : '') + '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-w168pick]') : null; if (!b) return;
    e.preventDefault();
    var form = b.closest('form'); if (!form) return;
    var inp = form.querySelector('input[name=cover_photo_id]'); if (inp) inp.value = b.getAttribute('data-w168pick');
    [].forEach.call(form.querySelectorAll('[data-w168pick]'), function (x) { x.classList.toggle('on', x === b); });
  }, true);
  /* full size, over everything; a click or Escape closes it */
  function openLb(url, alt) {
    if (!OWN.test(String(url || ''))) return;
    var old = document.getElementById('w168lb'); if (old) old.remove();
    var el = document.createElement('div'); el.id = 'w168lb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', alt || 'Photo');
    el.innerHTML = '<img src="' + E(url) + '" alt="' + E(alt || '') + '"><button type="button" aria-label="Close">&times;</button>';
    el.addEventListener('click', function () { el.remove(); });
    document.body.appendChild(el);
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-w168full]') : null; if (!b) return;
    e.preventDefault(); e.stopPropagation(); openLb(b.getAttribute('data-w168full'), b.getAttribute('data-w168alt'));
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('w168lb')) { e.preventDefault(); e.stopPropagation(); document.getElementById('w168lb').remove(); } }, true);
