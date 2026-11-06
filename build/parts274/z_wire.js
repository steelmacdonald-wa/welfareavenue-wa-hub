
  /* ---------- the page: one root inside #toronto, under wave118's masthead ---------- */
  function rootEl() {
    var p = document.getElementById('toronto'); if (!p) return null;
    var r = document.getElementById('w274root');
    if (!r || r.parentNode !== p) { r = document.createElement('div'); r.id = 'w274root'; p.appendChild(r); }
    return r;
  }
  function paint() {
    var root = rootEl(); if (!root || !staffOk()) return;
    try { root.parentNode.setAttribute('data-w274v', S.view); } catch (e) { /* fine */ }
    var ready = S.loaded && (S.view === 'events' || !!S.pool), fresh = false;
    if (ready && S.fresh) { S.fresh = false; fresh = true; }
    if (S.view === 'event') paintEvent(root, fresh);
    else if (S.view === 'people') paintPeople(root, fresh);
    else paintEvents(root, fresh);
  }
  function show(h) {
    if (!staffOk()) return;
    h = String(h || '').replace(/^#/, '');
    var p = h.split('/'); if (p[0] !== 'toronto') return;
    var v = 'events', id = null;
    if (p[1] === 'e' && p[2]) { v = 'event'; id = p[2]; } else if (p[1] === 'people') v = 'people';
    var key = v + ':' + (id || '');
    if (key !== S.key) {
      var first = !S.key;
      S.key = key; S.view = v; S.evId = id; S.fresh = true; S.mk = null; S.waEdit = false; S.confirmRec = null; S.confirmDone = false; S.err = {}; S.copyShow = ''; S.toolsSig = null;
      closeMenu(true); if (sheetOpen()) closeSheet(true);
      if (!first) { try { window.scrollTo(0, 0); } catch (e) { /* fine */ } }
    }
    paint();
    var need = [];
    if (!S.loaded) need.push(loadEvents());
    if (v !== 'events' && !S.pool) need.push(loadPool());
    if (need.length) Promise.all(need).then(function () { if (S.key === key) paint(); }, function (e) { console.warn('wave274 load', e); if (S.key === key) paint(); });
  }
  function scrollToSec(k, pointer) {
    var s = document.getElementById('w274s-' + k), h = document.getElementById('w274h-' + k); if (!s) return;
    try { s.scrollIntoView({ behavior: pointer && !reduced() ? 'smooth' : 'auto', block: 'start' }); } catch (e) { s.scrollIntoView(); }
    if (h) { try { h.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }

  /* ---------- the actions on the event page ---------- */
  function personMenu(btn, r, kbd) {
    var p = personOf(r), st = stOf(r), nm = nameOf(r);
    var items = [{ k: 'yes', l: 'Confirmed', ic: 'check', radio: true, on: st === 'yes' }, { k: 'no', l: 'Can’t come', ic: 'off', radio: true, on: st === 'no' }, { k: 'wait', l: 'Waiting', ic: 'wait', radio: true, on: st === 'wait' }, '-'];
    if (p) items.push({ k: 'crm', l: 'Open in the CRM', ic: 'person', href: '#crm/c/' + p.id });
    items.push({ k: 'off', l: 'Take off the crew', ic: 'x', dng: true });
    openMenu(btn, items, function (k) {
      if (k === 'crm') return;
      if (k === 'off') return doTakeOff(r);
      if (stOf(r) === k) return;
      setErr('crew', '');
      setStatus(r, k).then(function () { statusInPlace(r); snack(nm + ': ' + ST_LABEL[k] + '.'); }, function (e) { statusInPlace(r); setErr('crew', 'Couldn’t change ' + nm + '’s status. Try again.'); console.warn('wave274 status', e); });
      statusInPlace(r);
    }, 'Options for ' + nm, kbd);
  }
  function doTakeOff(r) {
    var nm = nameOf(r), role = roleLabel(r.role), root = document.getElementById('w274root'), card = root && root.querySelector('[data-w274r="' + r.id + '"]');
    setErr('crew', '');
    takeOff(r, function (err) { if (err) { repaintCrew(); setErr('crew', 'Couldn’t take ' + nm + ' off the crew, so they are still on it. Try again.'); console.warn('wave274 off', err); } });
    var redraw = function () { repaintCrew(); var c = root && root.querySelector('.w274col[data-w274role="' + r.role + '"] [data-w274addp], [data-w274addp=""]'); if (c) { try { c.focus({ preventScroll: true }); } catch (e) { /* fine */ } } };
    if (card) { card.classList.add('gone'); setTimeout(redraw, 200); } else redraw();
    snack(nm + ' is off the ' + lower(role) + '.', 'Undo', function () { if (undoOff(r.id)) { repaintCrew(); snack(nm + ' is back on the crew.'); var b = document.querySelector('[data-w274pm="' + r.id + '"]'); if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* fine */ } } } });
  }
  function moreMenu(btn, e, kbd) {
    var s = lower(e.status), items = [];
    if (s === 'cancelled') items.push({ k: 'plan', l: 'Plan this event again', ic: 'cal' });
    else if (s === 'completed') items.push({ k: 'plan', l: 'Reopen this event', ic: 'cal' });
    else items.push({ k: 'cancel', l: 'Cancel this event', ic: 'x', dng: true });
    openMenu(btn, items, function (k) {
      if (k === 'cancel') return cancelSheet(e);
      if (k === 'plan') saveEvent(e, { status: 'planned' }).then(function () { paint(); snack(s === 'cancelled' ? 'The event is planned again.' : 'The event is open again.'); }, function (x) { setErr('done', 'Couldn’t change the event. Try again.'); console.warn('wave274 status', x); });
    }, 'More for this event', kbd);
  }
  async function copyText(txt) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); return true; } } catch (e) { /* the fallback below */ }
    try {
      var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.left = '0'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); document.body.removeChild(ta); return !!ok;
    } catch (e) { return false; }
  }
  async function doCopy(e, kind) {
    var rows = scopeRows(e), vals = [], miss = 0;
    rows.forEach(function (r) { var k = contactOfRow(r), v = kind === 'email' ? k.email : k.phone; if (v && vals.indexOf(v) < 0) vals.push(v); else if (!v) miss++; });
    setErr('copy', ''); S.copyShow = '';
    var what = kind === 'email' ? 'email' : 'phone number';
    if (!vals.length) { setErr('copy', rows.length ? 'No ' + what + 's on file for ' + (S.scope === 'wait' ? 'the people waiting.' : 'this crew.') : 'No one to copy yet.'); return; }
    var txt = vals.join(', ');
    S.lastCopy = txt;
    var ok = await copyText(txt);
    if (ok) snack('Copied ' + plural(vals.length, what) + '.' + (miss ? ' ' + plural(miss, 'person', 'people') + ' have none on file.' : ''));
    else { S.copyShow = txt; paintParts(['confirm']); setErr('copy', 'Couldn’t copy by itself. The list is in the box below: select it and copy.'); }
  }
  async function waAction(e, k) {
    if (k === 'edit') { S.waEdit = true; S.err.wa = ''; paintParts(['confirm']); var i = document.getElementById('w274wa'); if (i) { try { i.focus(); } catch (x) { /* fine */ } } return; }
    if (k === 'cancel') { S.waEdit = false; S.err.wa = ''; paintParts(['confirm']); var b = document.querySelector('[data-w274wa="edit"]'); if (b) { try { b.focus(); } catch (x) { /* fine */ } } return; }
    var input = document.getElementById('w274wa'), v = k === 'clear' ? '' : String((input && input.value) || '').trim();
    if (v && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//.test(v)) { if (input) input.setAttribute('aria-invalid', 'true'); setErr('wa', 'That isn’t a WhatsApp group link. It starts with https://chat.whatsapp.com/'); if (input) { try { input.focus(); } catch (x) { /* fine */ } } return; }
    try { await saveEvent(e, { whatsapp_url: v || null }); S.waEdit = false; S.err.wa = ''; paintParts(['confirm']); snack(v ? 'Saved the WhatsApp group link.' : 'Removed the WhatsApp group link.'); var b2 = document.querySelector('[data-w274wa="edit"]'); if (b2) { try { b2.focus({ preventScroll: true }); } catch (x) { /* fine */ } } }
    catch (x) { setErr('wa', 'Couldn’t save the link. Try again.'); console.warn('wave274 whatsapp', x); }
  }
  async function saveDelivered(e) {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('#w274root [data-w274md]')), todo = [];
    setErr('md', '');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i], v = wholeOrNull(el.value); el.removeAttribute('aria-invalid');
      if (v !== v) { el.setAttribute('aria-invalid', 'true'); setErr('md', 'Meals delivered is a whole number from 0 to 2000.'); try { el.focus(); } catch (x) { /* fine */ } return; }
      var r = S.rec.filter(function (x) { return String(x.id) === el.getAttribute('data-w274md'); })[0];
      if (r && String(r.meals_delivered == null ? '' : r.meals_delivered) !== String(v == null ? '' : v)) todo.push([r, v]);
    }
    if (!todo.length) { snack('Nothing changed.'); return; }
    try {
      await Promise.all(todo.map(function (x) { return saveRecipient(e, x[0].id, { meals_delivered: x[1] }); }));
      paintParts(['wrap', 'sum']); var d = delivered(e); snack('Saved the meals delivered' + (d != null ? ': ' + d + ' in all.' : '.'));
    } catch (x) { setErr('md', 'Couldn’t save the meals delivered. Try again.'); console.warn('wave274 delivered', x); }
  }
  async function complete(e) {
    setErr('done', '');
    try { await saveEvent(e, { status: 'completed' }); S.confirmDone = false; paint(); snack('Marked completed. The CRM counts it now.'); var h = document.getElementById('w274h-wrap'); if (h) { try { h.focus({ preventScroll: true }); } catch (x) { /* fine */ } } }
    catch (x) { setErr('done', 'Couldn’t mark the event completed. Try again.'); console.warn('wave274 complete', x); }
  }

  /* ---------- clicks ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target; if (!t || !t.closest) return;
    var el = t.closest('#w274menu [data-w274mk]');
    if (el) { var fn = MN.fn, k = el.getAttribute('data-w274mk'); if (k !== 'crm') ev.preventDefault(); closeMenu(k === 'crm'); if (fn) fn(k); return; }
    if (menuOpen() && !t.closest('#w274menu')) { var trig = MN.trigger; closeMenu(true); if (trig && t.closest('[data-w274pm], [data-w274more]') === trig) return; }
    if (!t.closest('#toronto, #w274sheet, #w274snack')) return;
    var e = curEv();
    if ((el = t.closest('#w274snack button'))) { var sf = S.snackFn; hideSnack(); if (sf) sf(); return; }
    if ((el = t.closest('[data-w274x]'))) { ev.preventDefault(); closeSheet(); return; }
    if ((el = t.closest('[data-w274new]'))) { ev.preventDefault(); newEvent(); return; }
    if ((el = t.closest('[data-w274past]'))) { S.pastOpen = el.getAttribute('aria-expanded') !== 'true'; el.setAttribute('aria-expanded', S.pastOpen ? 'true' : 'false'); var pl = document.getElementById('w274pastl'); if (pl) pl.hidden = !S.pastOpen; return; }
    /* the Volunteers page and the Add people sheet */
    if ((el = t.closest('[data-w274kind]'))) { var sc = el.getAttribute('data-w274fs'), f = sc === 'k' ? S.pk.f : S.f; f.kind = el.getAttribute('data-w274kind'); syncTools(sc); return; }
    if ((el = t.closest('[data-w274day]'))) { var sc2 = el.getAttribute('data-w274fs'), f2 = sc2 === 'k' ? S.pk.f : S.f, d = Number(el.getAttribute('data-w274day')), at = f2.days.indexOf(d); if (at >= 0) f2.days.splice(at, 1); else f2.days.push(d); syncTools(sc2); return; }
    if ((el = t.closest('[data-w274clear]'))) { var sc3 = el.getAttribute('data-w274fs'), f3 = sc3 === 'k' ? S.pk.f : S.f; if (el.getAttribute('data-w274clear') === 'q') f3.q = ''; else { f3.kind = 'all'; f3.school = ''; f3.area = ''; f3.days = []; } syncTools(sc3); var qi = document.querySelector('[data-w274q="' + sc3 + '"]'); if (qi) { try { qi.focus(); } catch (x) { /* fine */ } } return; }
    if ((el = t.closest('[data-w274cpe]'))) { var pp = S.byCid[el.getAttribute('data-w274cpe')]; if (pp && pp.email) { S.lastCopy = pp.email; copyText(pp.email).then(function (ok) { snack(ok ? 'Copied ' + pp.email + '.' : 'Couldn’t copy. The email is ' + pp.email + '.'); }); } return; }
    if ((el = t.closest('[data-w274to]'))) { var pt = S.byCid[el.getAttribute('data-w274to')]; if (pt) { if (!S.loaded) loadEvents().then(function () { toEventSheet(pt); }); else toEventSheet(pt); } return; }
    if (!e) return;
    /* the event page */
    if ((el = t.closest('[data-w274go]'))) { scrollToSec(el.getAttribute('data-w274go'), ev.detail > 0); return; }
    if ((el = t.closest('[data-w274edit]'))) { eventSheet(e); return; }
    if ((el = t.closest('[data-w274more]'))) { moreMenu(el, e, ev.detail === 0); return; }
    if ((el = t.closest('[data-w274kit]'))) { kitchenSheet(e); return; }
    if ((el = t.closest('[data-w274recx]'))) { S.confirmRec = el.getAttribute('data-w274recx'); paintParts(['plan']); var y = document.querySelector('[data-w274recn="' + S.confirmRec + '"]'); if (y) { try { y.focus({ preventScroll: true }); } catch (x) { /* fine */ } } return; }
    if ((el = t.closest('[data-w274recn]'))) { var rn = el.getAttribute('data-w274recn'); S.confirmRec = null; paintParts(['plan']); var rb = document.querySelector('[data-w274recx="' + rn + '"]'); if (rb) { try { rb.focus({ preventScroll: true }); } catch (x) { /* fine */ } } return; }
    if ((el = t.closest('[data-w274recy]'))) {
      var rid = el.getAttribute('data-w274recy'), rr = S.rec.filter(function (x) { return String(x.id) === rid; })[0], rname = rr ? rr.name : 'the organization';
      setErr('rec', '');
      removeRecipient(rid).then(function () { S.confirmRec = null; paintParts(['plan', 'wrap', 'sum']); snack('Removed ' + rname + '.'); var ab = document.querySelector('[data-w274rec="new"]'); if (ab) { try { ab.focus({ preventScroll: true }); } catch (x) { /* fine */ } } },
        function (x) { S.confirmRec = null; paintParts(['plan']); setErr('rec', 'Couldn’t remove ' + rname + '. Try again.'); console.warn('wave274 recipient', x); });
      return;
    }
    if ((el = t.closest('[data-w274rec]'))) { var w = el.getAttribute('data-w274rec'); recSheet(e, w === 'new' ? null : w); return; }
    if ((el = t.closest('[data-w274addp]'))) { pickSheet(e, el.getAttribute('data-w274addp') || stageOfRole(e)); return; }
    if ((el = t.closest('[data-w274tg]'))) { targetsSheet(e); return; }
    if ((el = t.closest('[data-w274pm]'))) { var pr = rowById(el.getAttribute('data-w274pm')); if (pr) personMenu(el, pr, ev.detail === 0); return; }
    if ((el = t.closest('[data-w274call]'))) {
      var cr = rowById(el.getAttribute('data-w274call')); if (!cr) return;
      var on = el.getAttribute('aria-pressed') !== 'true'; el.setAttribute('aria-pressed', on ? 'true' : 'false'); setErr('call', '');
      setCalled(cr, on).then(function () { paintParts(['confirm']); snack(on ? 'Marked ' + nameOf(cr) + ' as called.' : nameOf(cr) + ': not called yet.'); }, function (x) { el.setAttribute('aria-pressed', on ? 'false' : 'true'); setErr('call', 'Couldn’t save that call. Try again.'); console.warn('wave274 called', x); });
      return;
    }
    if ((el = t.closest('[data-w274scope]'))) { S.scope = el.getAttribute('data-w274scope'); Array.prototype.forEach.call(document.querySelectorAll('[data-w274scope]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-w274scope') === S.scope ? 'true' : 'false'); }); return; }
    if ((el = t.closest('[data-w274copy]'))) { doCopy(e, el.getAttribute('data-w274copy')); return; }
    if ((el = t.closest('[data-w274wa]'))) { waAction(e, el.getAttribute('data-w274wa')); return; }
    if ((el = t.closest('[data-w274mdsave]'))) { saveDelivered(e); return; }
    if ((el = t.closest('[data-w274came]'))) {
      var wr = rowById(el.getAttribute('data-w274came')), want = el.getAttribute('data-v') === 'yes' ? 'yes' : 'no'; if (!wr || stOf(wr) === want) return;
      setErr('came', '');
      setStatus(wr, want).then(function () { statusInPlace(wr); }, function (x) { statusInPlace(wr); setErr('came', 'Couldn’t save that for ' + nameOf(wr) + '. Try again.'); console.warn('wave274 came', x); });
      statusInPlace(wr);
      return;
    }
    if ((el = t.closest('[data-w274done]'))) {
      var dk = el.getAttribute('data-w274done');
      if (dk === 'no') { S.confirmDone = false; paintParts(['wrap']); var ab2 = document.querySelector('[data-w274done="ask"]'); if (ab2) { try { ab2.focus({ preventScroll: true }); } catch (x) { /* fine */ } } return; }
      if (dk === 'ask' && daysTo(e.event_date) > 0) { S.confirmDone = true; paintParts(['wrap']); var yb = document.querySelector('[data-w274done="yes"]'); if (yb) { try { yb.focus({ preventScroll: true }); } catch (x) { /* fine */ } } return; }
      complete(e); return;
    }
  });
  /* the crew to add to from the section's own button: the one most short of people */
  function stageOfRole(e) { var best = null; crewOf(e).forEach(function (c) { var gap = c.target - (c.yes + c.wait); if (gap > 0 && (!best || gap > best.gap)) best = { role: c.role, gap: gap }; }); return best ? best.role : 'cook'; }

  /* ---------- fields: search, selects, the picker's ticks and radios, the forms ---------- */
  var qT = null;
  document.addEventListener('change', function (ev) {   /* wave274b: a typed $ or stray spaces settle into the house format */
    var t = ev.target; if (!t || t.id !== 'w274fb' || !String(t.value).trim()) return;
    var v = dollarsOrNull(t.value); if (typeof v === 'number' && isFinite(v)) t.value = amt(v);
  });
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute) return;
    var sc = t.getAttribute('data-w274q');
    if (sc) { clearTimeout(qT); qT = setTimeout(function () { var f = sc === 'k' ? S.pk && S.pk.f : S.f; if (!f) return; f.q = t.value; if (sc === 'k') paintPick(); else paintList(false); }, 120); return; }
    if (t.closest && t.closest('#w274pane') && t.getAttribute('aria-invalid')) t.removeAttribute('aria-invalid');
    if (t.id === 'w274fb' && S.err.budget) setErr('budget', '');   /* wave274b: the error goes once the amount is being fixed */
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute) return;
    var k = t.getAttribute('data-w274fsel');
    if (k) { var sc = t.getAttribute('data-w274fs'), f = sc === 'k' ? S.pk.f : S.f; f[k] = t.value; syncTools(sc); return; }
    var pid = t.getAttribute('data-w274pick');
    if (pid && S.pk) { S.pk.sel[pid] = !!t.checked; if (t.checked && S.pk.order.indexOf(pid) < 0) S.pk.order.push(pid); var lab = t.closest('.w274pk'); if (lab) lab.classList.toggle('on', !!t.checked); pickFoot(); return; }
    if (t.name === 'w274role') {
      Array.prototype.forEach.call(document.querySelectorAll('#w274pane .w274rad label'), function (l) { var i = l.querySelector('input'); l.classList.toggle('on', !!(i && i.checked)); });
      if (SH.kind === 'pick' && S.pk) { S.pk.role = t.value; pickFoot(); }
      if (SH.kind === 'toev' && S.te) S.te.role = t.value;
      return;
    }
    if (t.name === 'w274tev' && S.te) {
      S.te.ev = t.value;
      Array.prototype.forEach.call(document.querySelectorAll('#w274pane .w274evp'), function (l) { var i = l.querySelector('input'); l.classList.toggle('on', !!(i && i.checked)); });
      var g = document.getElementById('w274tego'); if (g) g.disabled = false;
    }
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target; if (!f || f.id !== 'w274f') return;
    ev.preventDefault();
    var fn = SUBMIT[SH.kind]; if (fn) fn(f);
  });
  /* ---------- the keyboard: Escape closes, Tab stays in the sheet, arrows walk a menu ---------- */
  document.addEventListener('keydown', function (ev) {
    S.kbd = true;   /* this key is the action: what it opens or closes does not move */
    if (menuOpen()) {
      var m = document.getElementById('w274menu'), its = Array.prototype.slice.call(m.querySelectorAll('.w274mi')), at = its.indexOf(document.activeElement);
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeMenu(false); return; }
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); var n = its.length, dn = ev.key === 'ArrowDown'; if (n) its[at < 0 ? (dn ? 0 : n - 1) : (at + (dn ? 1 : n - 1)) % n].focus(); return; }
      if (ev.key === 'Home' || ev.key === 'End') { ev.preventDefault(); if (its.length) its[ev.key === 'Home' ? 0 : its.length - 1].focus(); return; }
      if (ev.key === 'Tab') { closeMenu(false); ev.preventDefault(); return; }
    }
    if (!sheetOpen()) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeSheet(); return; }
    if (ev.key === 'Tab') {
      var pane = document.getElementById('w274pane'), fs = focusables(pane); if (!fs.length) { ev.preventDefault(); return; }
      var a = fs[0], z = fs[fs.length - 1], cur = document.activeElement;
      if (!pane.contains(cur)) { ev.preventDefault(); a.focus(); return; }
      if (ev.shiftKey && (cur === a || cur === pane)) { ev.preventDefault(); z.focus(); }
      else if (!ev.shiftKey && cur === z) { ev.preventDefault(); a.focus(); }
    }
  }, true);
  window.addEventListener('hashchange', function () { closeMenu(true); if (sheetOpen()) closeSheet(true); hideSnack(); });
  document.addEventListener('pointerdown', function () { S.kbd = false; }, true);
  /* break274: what was tapped, for a sheet to give focus back to (a visible control: a proxy that clicks a hidden one keeps itself) */
  document.addEventListener('click', function (ev) { var t = ev.target, c = t && t.closest ? t.closest('button, a[href], [tabindex]:not([tabindex="-1"])') : null; if (c && c.offsetParent === null && getComputedStyle(c).position !== 'fixed') return; S.tapEl = c; S.tapAt = performance.now(); }, true);
  document.addEventListener('touchstart', function () {}, { passive: true });   /* iOS Safari applies :active only with a touch listener */
  window.addEventListener('resize', function () { closeMenu(true); placeSnack(); });
  /* the menu belongs to its button. break274: it closes once its button has moved away, not on the last scroll event of a
     scroll that ended before the tap (a wheel's smooth scroll or a flick still settling would close it the moment it opened) */
  window.addEventListener('scroll', function () { if (!menuOpen()) return; var t = MN.trigger; if (!t || !document.contains(t) || Math.abs(t.getBoundingClientRect().top - (MN.top || 0)) > 8) closeMenu(false); }, { passive: true });
  window.addEventListener('pagehide', flushOff);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushOff(); });

  /* ---------- Montreal's Volunteer Manager leaves Toronto out (its events list is WA_VOL_EVENTS, filled by waVolLoad) ---------- */
  function montrealOnly() {
    try {
      if (typeof WA_VOL_EVENTS === 'undefined' || !Array.isArray(WA_VOL_EVENTS)) return;
      var keep = WA_VOL_EVENTS.filter(function (e) { return !(e && (lower(e.kind) === 'meal' || /toronto/i.test(String(e.location || '')))); });
      if (keep.length !== WA_VOL_EVENTS.length) WA_VOL_EVENTS = keep;
    } catch (e) { /* fine */ }
  }
  if (typeof waVolLoad === 'function' && !waVolLoad.__w274) {
    var __vl274 = waVolLoad;
    waVolLoad = async function () { var r = await __vl274.apply(this, arguments); montrealOnly(); return r; };
    waVolLoad.__w274 = true;
  }

  /* ---------- access: until wa274_toronto.sql gives every profile the page, it follows the Volunteer Manager's ----------
     The profile's own word for 'toronto' wins once it has one (wave127 applies it); before that, a person who opens the
     Volunteer Manager opens Toronto Volunteers too, and directors never do. */
  function torontoRule(a) {
    a = (a || []).slice();
    var has = a.indexOf('toronto') >= 0;
    if (boardMode()) return has ? a.filter(function (x) { return x !== 'toronto'; }) : a;
    var prof = null, lead = false;
    try { var k = window.w127 && window.w127.mine ? window.w127.mine() : null, st = k && window.w127.state ? window.w127.state() : null; prof = st && st.byKey ? st.byKey[k] : null; } catch (e) { prof = null; }
    try { var rl = (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; lead = rl === 'leader' || rl === 'admin' || (prof && prof.tier === 'leader'); } catch (e) { /* fine */ }
    var vol;
    if (prof && prof.pages) {
      if (prof.pages.toronto !== undefined) return a;
      var v = prof.pages.volunteering; vol = v === 'all' || (v === 'lead' && lead);
    } else vol = a.indexOf('volunteering') >= 0;
    if (vol && !has) a.push('toronto');
    if (!vol && has) a = a.filter(function (x) { return x !== 'toronto'; });
    return a;
  }
  function wrapAllowed() {
    try {
      if (typeof wa40Allowed !== 'function' || wa40Allowed.__w274) return;
      var __al274 = wa40Allowed;
      wa40Allowed = function () { var a = __al274.apply(this, arguments) || []; try { return torontoRule(a); } catch (e) { return a; } };
      Object.keys(__al274).forEach(function (k) { try { wa40Allowed[k] = __al274[k]; } catch (x) { /* fine */ } });
      wa40Allowed.__w274 = true;
    } catch (e) { /* fine */ }
  }
  /* wave274 (one app, 06/11/26): Toronto is now a city of the Volunteer Manager (wave153's APPS.toronto, of: 'volunteer'; the
     Montreal | Toronto switch is wave153's). The page keeps its own id and its access label, Toronto Volunteers (People and
     access decides it per profile); only the launcher shows it as the Volunteer Manager. */
  function register() {
    if (!window.WA_NAV || typeof WA_NAV.register !== 'function') return;
    wrapAllowed();
    if (!WA_NAV.pages.some(function (p) { return p.id === 'toronto'; })) WA_NAV.register({ id: 'toronto', label: 'Toronto Volunteers', group: 'apps', dot: PURPLE, gate: 'member', onShow: function (h) { show(h); } });
    try { if (typeof wa40Enforce === 'function') wa40Enforce(); } catch (e) { /* fine */ }
    /* Home's Your apps (wave272) was drawn before the page existed: draw it again so the app is there from the start */
    try { if (window.w272 && typeof window.w272.paint === 'function') window.w272.paint(); } catch (e) { /* fine */ }
  }
  if (typeof startApp === 'function') {
    var __sa274 = startApp;
    startApp = async function () {
      var out = await __sa274.apply(this, arguments);
      try {
        montrealOnly();
        register();
        var h = decodeURIComponent(location.hash || '').replace(/^#/, '');
        if (h.split('/')[0] === 'toronto') { try { showPanel('toronto'); } catch (x) { /* fine */ } show(h); }
      } catch (e) { console.warn('wave274 boot', e); }
      return out;
    };
  }

  /* ---------- test hook ---------- */
  window.w274 = {
    state: function () { return S; }, show: show, paint: paint, load: loadEvents, loadPool: loadPool, newEvent: newEvent, stageOf: stageOf, crewOf: crewOf, totals: totals,
    pool: function () { return S.pool; }, filterPeople: filterPeople, flush: flushOff, close: closeSheet, isTo: isTo, rule: torontoRule, montrealOnly: montrealOnly, today: todayIso
  };
})();
