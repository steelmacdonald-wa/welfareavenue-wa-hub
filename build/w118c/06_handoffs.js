
  /* ---------- the picker: choose a library photo from another screen ---------- */
  function pick(opts) {
    opts = opts || {};
    if (!allowed()) return;
    P.pick = { onPick: opts.onPick, title: opts.title || 'Pick a photo', ready: opts.readyOnly !== false, q: '', why: opts.why || '' };
    var el = document.getElementById('w118cpk');
    if (!el) { el = document.createElement('div'); el.id = 'w118cpk'; el.setAttribute('data-w118c', '1'); document.body.appendChild(el); }
    paintPick();
    load(false).then(paintPick);
    setTimeout(function () { var q = document.getElementById('w118cpq'); if (q) try { q.focus(); } catch (e) { /* fine */ } }, 40);
  }
  function pickList() {
    var k = P.pick; if (!k) return [];
    var terms = k.q.toLowerCase().split(/\s+/).filter(Boolean);
    return sortRows(P.rows.filter(function (p) {
      if (p.status === 'archived') return false;
      if (k.ready && (p.usage !== 'ready' || p.status !== 'ready')) return false;
      var h = hay(p); for (var i = 0; i < terms.length; i++) if (h.indexOf(terms[i]) < 0) return false;
      return true;
    }));
  }
  function paintPick() {
    var el = document.getElementById('w118cpk'), k = P.pick; if (!el || !k) return;
    var list = pickList(), keepQ = document.activeElement && document.activeElement.id === 'w118cpq';
    el.innerHTML = '<div class="bk" data-w118cpx="1"></div><div class="box" role="dialog" aria-modal="true" aria-label="' + E(k.title) + '">' +
      '<header><h3>' + E(k.title) + '</h3><input type="search" id="w118cpq" placeholder="Search the photos" value="' + E(k.q) + '" aria-label="Search the photos">' +
      '<span class="tg' + (k.ready ? ' on' : '') + '" data-w118cpr="1" role="button" tabindex="0">Ready for public use only</span>' +
      '<button class="x" data-w118cpx="1" aria-label="Close">' + ic('close') + '</button></header>' +
      '<div class="pg">' + (!P.loaded ? '<div class="none">Loading the photos...</div>' : list.length ? list.map(function (p) {
        return '<button type="button" class="pi" data-w118cpp="' + E(p.key) + '" title="' + E(p.title + (p.usage_note && p.usage !== 'ready' ? ': ' + p.usage_note : '')) + '"><span class="im" style="background:' + E(p.color || '#d9d6cc') + '"><img loading="lazy" src="' + E(url(p, 'thumb')) + '" alt="' + E(p.alt_text || p.title) + '" style="' + focalCss(p) + '"></span>' + badge(p) + '<b>' + E(p.title) + '</b></button>';
      }).join('') : '<div class="none">' + (k.ready ? 'No ready photo matches. Turn off Ready for public use only to see the rest.' : 'No photo matches.') + '</div>') + '</div>' +
      '<div class="ft">' + (k.why ? E(k.why) + ' ' : '') + (k.ready ? 'Showing the photos cleared for public use.' : 'Showing every photo: check the badge before anything goes public.') + ' <a href="#photos" data-w118cpx="1" style="color:' + GREEN + ';font-weight:700">Open the photo library</a></div></div>';
    if (keepQ) { var q = document.getElementById('w118cpq'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) { /* fine */ } } }
  }
  function closePick() { P.pick = null; var el = document.getElementById('w118cpk'); if (el) el.remove(); }
  function choose(key) {
    var k = P.pick, p = byKey(key); if (!k || !p) return;
    if ((p.usage !== 'ready' || p.status !== 'ready') && !confirm((USAGE[p.usage] || USAGE.check).label + ': ' + (p.usage_note || (USAGE[p.usage] || USAGE.check).tip) + '\n\nUse it anyway?')) return;
    var cb = k.onPick; closePick();
    try { if (cb) cb(p); } catch (e) { toastS('Could not use that photo: ' + ((e && e.message) || e)); }
  }

  /* ---------- hand-off 1: the Create studio (a photo behind a social graphic) ---------- */
  var CD_HINT = 'A photo sits behind the text with a dark overlay so the words stay readable.';
  function cdEnsure() {
    var hint = document.getElementById('cdImgHint'); if (!hint || !staff()) return null;
    var box = document.getElementById('w118ccd');
    if (!box) { box = document.createElement('div'); box.id = 'w118ccd'; box.className = 'w118ccd'; box.setAttribute('data-w118c', '1'); box.innerHTML = 'Or <a data-w118cpick="cd">pick one from the photo library</a>, labelled and cleared for use.<div class="sel" style="display:none"></div>'; hint.parentNode.insertBefore(box, hint.nextSibling); }
    return box;
  }
  function cdShow(p) {
    var box = cdEnsure(); if (!box) return;
    var sel = box.querySelector('.sel');
    if (!p) { sel.style.display = 'none'; sel.innerHTML = ''; box.removeAttribute('data-key'); return; }
    box.setAttribute('data-key', p.key);
    sel.innerHTML = '<img src="' + E(url(p, 'thumb')) + '" alt="" style="' + focalCss(p) + '"><span>' + E(p.title) + '<small>' + E(p.status === 'ready' && p.usage === 'ready' ? 'From the photo library, ready for public use' : ulabel(p) + (p.usage_note ? ': ' + p.usage_note : '')) + '</small></span><button type="button" data-w118ccdx="1">Remove</button>';
    sel.style.display = 'flex';
  }
  function cdApply(p) {
    var t = document.getElementById('cdType'), hint = document.getElementById('cdImgHint');
    if (!t || !hint) return false;
    try { WA_CD_IMG = url(p, 'web'); } catch (e) { return false; }
    if (t.value !== 'graphic') { t.value = 'graphic'; try { if (typeof waCdSyncGfx === 'function') waCdSyncGfx(); } catch (e) { /* fine */ } }
    var fi = document.getElementById('cdImg'); if (fi) fi.value = '';
    hint.textContent = 'Photo attached from the library. It will sit behind the words on the tile.';
    cdShow(p);
    var brief = document.getElementById('cdBrief') || document.querySelector('#create textarea');
    try { var o = document.getElementById('cdGfxOpts'); if (o && o.scrollIntoView) o.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* fine */ }
    if (brief && !brief.value) { try { brief.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    return true;
  }
  function toCreate(p) {
    W.pendingCd = p; location.hash = '#create';
    var n = 0, t = setInterval(function () {
      n++;
      if (W.pendingCd && cdApply(W.pendingCd)) { W.pendingCd = null; clearInterval(t); toastS('Photo attached in the Create studio: write the brief and Write it'); return; }
      if (n > 40) { clearInterval(t); W.pendingCd = null; toastS('Open the Create studio and use Pick one from the photo library'); }
    }, 150);
  }
  /* when the studio resets or takes an uploaded file, the library chip goes */
  function cdWatch() {
    var hint = document.getElementById('cdImgHint'); if (!hint || hint.__w118c) return;
    hint.__w118c = true;
    new MutationObserver(function () {
      var box = document.getElementById('w118ccd'); if (!box || !box.getAttribute('data-key')) return;
      var p = byKey(box.getAttribute('data-key')); var cur = null; try { cur = WA_CD_IMG; } catch (e) { cur = null; }
      if (!p || cur !== url(p, 'web')) cdShow(null);
    }).observe(hint, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- hand-off 2: the content calendar composer (wave121) ---------- */
  async function fileOf(p) {
    var r = await fetch(url(p, 'web'), { mode: 'cors' }); if (!r.ok) throw new Error('could not fetch the photo (' + r.status + ')');
    var b = await r.blob();
    return new File([b], p.key + '.jpg', { type: 'image/jpeg' });
  }
  async function intoComposer(p) {
    var input = document.querySelector('#w121dr #w121file');
    if (!input) throw new Error('the post composer is not open');
    var file = await fileOf(p);
    var dt = new DataTransfer(); dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function toPost(p) {
    if (typeof window.w121Compose !== 'function') { toastS('The content calendar is not available'); return; }
    closeDrawer(true);
    var note = 'Photo from the library: ' + p.title + '.' + (p.alt_text ? ' Alt text: ' + p.alt_text : '') + (p.usage !== 'ready' || p.status !== 'ready' ? ' Usage: ' + ulabel(p) + (p.usage_note ? ', ' + p.usage_note : '') : '');
    window.w121Compose({ title: p.title, notes: note });
    var n = 0, t = setInterval(function () {
      n++;
      if (document.querySelector('#w121dr #w121file')) { clearInterval(t); intoComposer(p).then(function () { toastS('Photo added to the post'); }).catch(function (x) { toastS('Could not attach the photo: ' + ((x && x.message) || x)); }); return; }
      if (n > 60) { clearInterval(t); toastS('Open a post and use From the photo library'); }
    }, 150);
  }
  function calLink() {
    var drop = document.querySelector('#w121dr #w121drop'); if (!drop || drop.querySelector('[data-w118cpick]') || !staff()) return;
    var a = document.createElement('a'); a.setAttribute('data-w118cpick', 'cal'); a.setAttribute('data-w118c', '1'); a.textContent = 'pick from the photo library';
    var span = document.createElement('span'); span.setAttribute('data-w118c', '1'); span.appendChild(document.createTextNode(' Or ')); span.appendChild(a); span.appendChild(document.createTextNode('.'));
    var input = drop.querySelector('#w121file'); drop.insertBefore(span, input || null);
  }
  var calMo = null;
  function calWatch() {
    var dr = document.getElementById('w121dr');
    if (!dr) { if (calMo) { calMo.disconnect(); calMo = null; } return; }
    if (calMo && calMo.__el === dr) { calLink(); return; }
    if (calMo) calMo.disconnect();
    calMo = new MutationObserver(function () { calLink(); }); calMo.__el = dr;
    calMo.observe(dr, { childList: true, subtree: true });
    calLink();
  }

  /* ---------- hand-off 3: team tools and Search everything ---------- */
  function teamTools() {
    try {
      var tools = document.querySelector('#team .w116tools'); if (!tools || tools.querySelector('[data-w116go="#photos"]') || !allowed()) return;
      var h = decodeURIComponent(location.hash || ''); if (!/^#team\/(marketing|fundraising)\b/.test(h)) return;
      var a = document.createElement('a'); a.setAttribute('data-w116go', '#photos'); a.setAttribute('data-w118c', '1'); a.innerHTML = ic('image') + ' Photo library';
      var after = tools.querySelector('[data-w116go="#create"]');
      if (after && after.nextSibling) tools.insertBefore(a, after.nextSibling); else tools.insertBefore(a, tools.firstChild);
    } catch (e) { /* cosmetic */ }
  }
  var searchSeq = 0;
  async function searchPhotos(q) {
    var seq = ++searchSeq;
    try {
      q = String(q || '').trim().toLowerCase();
      if (!allowed() || q.length < 3) return;
      await load(false);
      if (seq !== searchSeq) return;
      var terms = q.split(/\s+/).filter(Boolean);
      var hits = P.rows.filter(function (p) { if (p.status === 'archived') return false; var h = hay(p); return terms.every(function (t) { return h.indexOf(t) >= 0; }); }).slice(0, 4);
      var pop = document.getElementById('searchResults');
      if (!hits.length || !pop || pop.style.display === 'none' || pop.querySelector('[data-w118cs]')) return;
      var empty = !pop.querySelector('.sr[data-hash], .sr[data-w107]') ? pop.querySelector('.sr') : null;
      if (empty && (empty.textContent || '').indexOf('No matches') >= 0) empty.remove();
      hits.forEach(function (p) {
        var div = document.createElement('div'); div.className = 'sr'; div.setAttribute('data-w118cs', p.key);
        div.innerHTML = '<span class="sr-type w118cst">Photo</span><img src="' + E(url(p, 'thumb')) + '" alt="">' + E(p.title);
        div.addEventListener('click', function () { pop.style.display = 'none'; var gs = document.getElementById('globalSearch'); if (gs) gs.value = ''; location.hash = '#photos/' + encodeURIComponent(p.key); });
        pop.appendChild(div);
      });
    } catch (e) { /* search stays as it was */ }
  }
  if (typeof renderSearch === 'function') {
    var __rs118c = renderSearch, tS = null;
    renderSearch = function (q) { var r = __rs118c.apply(this, arguments); clearTimeout(tS); tS = setTimeout(function () { searchPhotos(q); }, 280); return r; };
  }

  /* ---------- the guide ---------- */
  function help() {
    if (typeof openModal !== 'function') return;
    openModal('<h3>Photo library</h3><div class="w43hm">' +
      '<p>Every photo we can use, with the words that go with it. Search or filter, open a photo, and copy what you need.</p>' +
      '<p><b>The badges.</b> Ready: fine for posts, the website, decks and reports. Crop first: crop the edge named in the note before it goes public. Consent needed: someone we serve or a child is recognizable, so use it inside the team, or publicly only with their consent. Internal only: keep it inside the team. Needs a look: new, with first labels from the AI that a person has not confirmed yet.</p>' +
      '<p><b>Sizes.</b> Full (2400 px) for print and big screens, Web (1600 px) for posts, the website and decks, Thumbnail (640 px) for emails and documents. None of them carry location or camera data.</p>' +
      '<p><b>Using a photo.</b> Use in the Create studio puts it behind a social graphic. Use in a post opens the content calendar with the photo attached. Paste the alt text into the alt text field wherever the photo goes. Both screens also have a Pick from the photo library link.</p>' +
      '<p><b>Adding photos</b> (staff). Add photos, drop the files, and the hub makes the three sizes, keeps the date, uploads them and asks the AI for first labels. Open each one marked Needs a look, fix what is off (above all who is recognizable), click the photo on its main subject, and save. Describe people by role, not by name. When someone gives consent, set the photo to Ready and note who agreed and when.</p>' +
      '<p><b>Where it lives.</b> Files: Supabase storage, content-images/photos (full, web and thumb). Labels: the wa_photos table. Archive hides a photo; an admin can delete an archived photo for good. Every change goes to the Activity log.</p>' +
      '</div><div class="m-actions"><button class="btn" id="w118chc">Got it</button></div>');
    var c = document.getElementById('w118chc'); if (c) c.addEventListener('click', function () { closeModal(); });
  }
