
  /* ---------- the sheet: one at a time, Escape closes it, focus stays inside and goes back to what opened it ---------- */
  var SH = { kind: null, opener: null, openerSel: null, ctx: null };
  function sheetRoot() {
    var el = document.getElementById('w274sheet');
    if (!el) {
      el = document.createElement('div'); el.id = 'w274sheet'; el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<div class="w274bd" data-w274x="1"></div><div id="w274pane" role="dialog" aria-modal="true" aria-labelledby="w274sht" tabindex="-1"></div>';
      document.body.appendChild(el);
    }
    return el;
  }
  function sheetOpen() { var el = document.getElementById('w274sheet'); return !!el && el.classList.contains('open'); }
  function openSheet(kind, o) {
    var el = sheetRoot(), pane = document.getElementById('w274pane');
    closeMenu(true);
    try { if (window.w272 && window.w272.closeTip) window.w272.closeTip(); } catch (e) { /* fine */ }   /* wave272's corner note never sits over a window */
    if (!S.snackFn) hideSnack();   /* a plain note (saved, copied) makes way for the sheet; an Undo stays its 5 seconds */
    if (!sheetOpen()) { SH.opener = o.opener || document.activeElement; SH.openerSel = selOf(SH.opener); }
    SH.kind = kind; SH.ctx = o.ctx || null;
    pane.innerHTML = '<form id="w274f" class="w274fx" novalidate data-w274form="' + E(kind) + '"><div class="w274grab" aria-hidden="true"></div>' +
      '<div class="w274shd"><div><h2 id="w274sht">' + E(o.title) + '</h2>' + (o.sub ? '<p>' + E(o.sub) + '</p>' : '') + '</div><button type="button" class="w274ib" data-w274x="1" aria-label="Close">' + ic('x') + '</button></div>' +
      '<div class="w274sbd">' + o.body + '</div><div class="w274sft">' + errLine('sheet', '') + (o.foot || '') + '</div></form>';
    S.err.sheet = '';
    el.removeAttribute('aria-hidden');
    void pane.offsetWidth;
    still(el, function () { el.classList.add('open'); });
    var f = o.focus ? pane.querySelector(o.focus) : null;
    if (!f) f = pane.querySelector('.w274sbd input:not([type=hidden]):not([disabled]), .w274sbd select, .w274sbd textarea');
    try { (f || pane).focus({ preventScroll: true }); } catch (e) { /* fine */ }
  }
  function closeSheet(noReturn) {
    var el = document.getElementById('w274sheet'); if (!el || !el.classList.contains('open')) return;
    still(el, function () { el.classList.remove('open'); }); el.setAttribute('aria-hidden', 'true');
    SH.kind = null; SH.ctx = null;
    var op = SH.opener, sel = SH.openerSel; SH.opener = null; SH.openerSel = null;
    if (noReturn) return;
    if (!op || !document.contains(op) || op.offsetParent === null) op = sel ? document.querySelector(sel) : null;
    if (op) { try { op.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  /* a keyboard action changes at once (no slide, no fade); a pointer gets the motion */
  function still(el, fn) {
    if (!S.kbd) { el.classList.remove('w274inst'); fn(); return; }
    el.classList.add('w274inst'); fn(); void el.offsetWidth;
    requestAnimationFrame(function () { el.classList.remove('w274inst'); });
  }
  function focusables(root) { return Array.prototype.filter.call(root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'), function (x) { return x.offsetParent !== null || x === document.activeElement; }); }
  function busy(on) { var b = document.querySelector('#w274f [type="submit"]'); if (b) { b.disabled = !!on; b.setAttribute('aria-busy', on ? 'true' : 'false'); } }
  function fld(label, input) { return '<label class="w274lb" for="' + input.id + '">' + label + '</label>' + input.html; }
  function inp(id, name, type, value, extra) { return { id: id, html: '<input class="w274i" id="' + id + '" name="' + name + '" type="' + type + '" value="' + E(value == null ? '' : value) + '"' + (extra || '') + '>' }; }
  function bad(el, msg) { if (!el) return; el.setAttribute('aria-invalid', 'true'); setErr('sheet', msg); try { el.focus(); } catch (e) { /* fine */ } }
  function wholeOrNull(v, max) { v = String(v == null ? '' : v).trim(); if (v === '') return null; var n = Number(v); return isFinite(n) && n >= 0 && n <= (max || 2000) && Math.round(n) === n ? n : NaN; }

  /* ---------- the small menus ---------- */
  var MN = { trigger: null, sel: null, fn: null };
  function menuEl() { var m = document.getElementById('w274menu'); if (!m) { m = document.createElement('div'); m.id = 'w274menu'; m.setAttribute('role', 'menu'); m.tabIndex = -1; document.body.appendChild(m); } return m; }
  function openMenu(trigger, items, fn, label, kbd) {
    closeMenu(true);
    var m = menuEl();
    m.setAttribute('aria-label', label || 'Options');
    m.innerHTML = items.map(function (it) {
      if (it === '-') return '<hr role="separator">';
      var a = ' class="w274mi' + (it.dng ? ' dng' : '') + '" data-w274mk="' + E(it.k) + '"';
      if (it.href) return '<a role="menuitem"' + a + ' href="' + E(it.href) + '" tabindex="-1">' + ic(it.ic) + E(it.l) + '</a>';
      return '<button type="button" role="' + (it.radio ? 'menuitemradio' : 'menuitem') + '"' + (it.radio ? ' aria-checked="' + (it.on ? 'true' : 'false') + '"' : '') + a + ' tabindex="-1">' + ic(it.radio ? (it.on ? 'check' : '') : it.ic) + E(it.l) + '</button>';
    }).join('');
    var r = trigger.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    var left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)), top = r.bottom + 6, up = false;
    if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) { top = r.top - h - 6; up = true; }
    m.style.left = Math.round(left) + 'px'; m.style.top = Math.round(top) + 'px';
    m.style.transformOrigin = Math.round(Math.min(w, Math.max(0, r.right - left - r.width / 2))) + 'px ' + (up ? h + 'px' : '0px');
    m.classList.toggle('up', up);
    void m.offsetWidth; still(m, function () { m.classList.add('on'); });
    trigger.setAttribute('aria-expanded', 'true');
    MN.trigger = trigger; MN.sel = selOf(trigger); MN.fn = fn;
    var first = kbd ? m.querySelector('.w274mi') : m; if (first) { try { first.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  function menuOpen() { var m = document.getElementById('w274menu'); return !!m && m.classList.contains('on'); }
  function closeMenu(silent) {
    var m = document.getElementById('w274menu'); if (!m || !m.classList.contains('on')) return;
    still(m, function () { m.classList.remove('on'); });
    var t = MN.trigger; if (t) t.setAttribute('aria-expanded', 'false');
    if (!silent) { if (!t || !document.contains(t)) t = MN.sel ? document.querySelector(MN.sel) : null; if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }
    MN.trigger = null; MN.fn = null;
  }

  /* ---------- the note at the foot of the screen ---------- */
  function snack(msg, act, fn) {
    var s = document.getElementById('w274snack');
    if (!s) { s = document.createElement('div'); s.id = 'w274snack'; s.setAttribute('role', 'status'); s.setAttribute('aria-live', 'polite'); s.innerHTML = '<span></span><button type="button"></button>'; document.body.appendChild(s); }
    s.querySelector('span').textContent = msg;
    s.querySelector('button').textContent = act || '';
    S.snackFn = fn || null;
    s.classList.add('on');
    clearTimeout(S.snackT); S.snackT = setTimeout(hideSnack, act ? 5000 : 3200);
  }
  function hideSnack() { var s = document.getElementById('w274snack'); if (s) s.classList.remove('on'); S.snackFn = null; clearTimeout(S.snackT); }

  /* ---------- New event and Edit (one sheet) ---------- */
  function kitchens() {
    var o = ['Ralph Thornton Community Centre'];
    S.events.slice().reverse().forEach(function (e) { var k = String(e.kitchen_place || '').trim(); if (k && o.indexOf(k) < 0) o.push(k); });
    return o;
  }
  function kitchenList() { return '<datalist id="w274kl">' + kitchens().map(function (k) { return '<option value="' + E(k) + '"></option>'; }).join('') + '</datalist>'; }
  function eventSheet(ev) {
    var e = ev || {};
    var body = fld('Date', inp('w274fd', 'event_date', 'date', e.event_date || '', ' required aria-required="true"')) +
      '<div class="w274row2"><div>' + fld('Start time', inp('w274ft', 'start_time', 'time', hm(e.start_time) || '10:00')) + '</div><div>' +
      fld('Meals planned', inp('w274fm', 'planned_meals', 'number', e.planned_meals == null ? '' : e.planned_meals, ' min="0" max="2000" step="1" inputmode="numeric"')) + '</div></div>' +
      fld('Kitchen', inp('w274fk', 'kitchen_place', 'text', e.kitchen_place || '', ' list="w274kl" autocomplete="off"')) + kitchenList() +
      fld('Kitchen time', inp('w274fs', 'kitchen_shift', 'text', e.kitchen_shift || '', ' placeholder="10:00 to 14:00" autocomplete="off"')) +
      fld('Title', inp('w274fti', 'title', 'text', ev ? titleOf(e) : 'Free meal event', ' autocomplete="off"')) +
      '<label class="w274lb" for="w274fn">Note <small>(optional)</small></label><textarea class="w274i" id="w274fn" name="notes" rows="3">' + E(e.notes || '') + '</textarea>';
    openSheet('event', { title: ev ? 'Edit the event' : 'New event', sub: ev ? (e.code || '') : 'A date and a kitchen to start. The crew and who the meals go to come next.', body: body, ctx: ev ? ev.id : null,
      foot: '<button type="button" class="w274btn" data-w274x="1">Cancel</button><button type="submit" class="w274btn pri">' + (ev ? 'Save the changes' : 'Create the event') + '</button>' });
  }
  function newEvent() {
    if (!staffOk()) return;
    if (!S.loaded) { loadEvents().then(function () { eventSheet(null); }); return; }
    eventSheet(null);
  }
  async function submitEvent(form) {
    var ev = SH.ctx != null ? evById(SH.ctx) : null;
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (x) { x.removeAttribute('aria-invalid'); });
    var d = form.event_date.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return bad(form.event_date, 'Pick a date for the event.');
    var meals = wholeOrNull(form.planned_meals.value);
    if (meals !== meals) return bad(form.planned_meals, 'Meals planned is a whole number from 0 to 2000.');
    var f = { event_date: d, start_time: form.start_time.value || '10:00', planned_meals: meals, kitchen_place: form.kitchen_place.value.trim() || null, kitchen_shift: form.kitchen_shift.value.trim() || null, title: form.title.value.trim() || 'Free meal event', notes: form.notes.value.trim() || null };
    setErr('sheet', ''); busy(true);
    try {
      if (ev) {
        var patch = {};
        Object.keys(f).forEach(function (k) { var o = k === 'start_time' ? hm(ev[k]) : k === 'title' ? titleOf(ev) : ev[k]; if (String(o == null ? '' : o) !== String(f[k] == null ? '' : f[k])) patch[k] = f[k]; });
        if (Object.keys(patch).length) await saveEvent(ev, patch);
        closeSheet(); paint(); snack(Object.keys(patch).length ? 'Saved the event.' : 'Nothing changed.');
      } else {
        var made = await createEvent(f);
        if (!made || made.id == null) throw new Error('no id');
        closeSheet(true);
        location.hash = '#toronto/e/' + made.id;
        snack('Created ' + (made.code || 'the event') + '. Next: who the meals go to, then the crew.');
      }
    } catch (e) { busy(false); setErr('sheet', ev ? 'Couldn’t save the event. Try again.' : 'Couldn’t create the event. Try again.'); console.warn('wave274 event', e); }
  }

  /* ---------- the kitchen ---------- */
  function kitchenSheet(ev) {
    var body = fld('Kitchen', inp('w274kp', 'kitchen_place', 'text', ev.kitchen_place || '', ' list="w274kl" autocomplete="off"')) + kitchenList() +
      fld('Kitchen time', inp('w274ks', 'kitchen_shift', 'text', ev.kitchen_shift || '', ' placeholder="10:00 to 14:00" autocomplete="off"')) +
      fld('Kitchen contact', inp('w274kc', 'kitchen_contact', 'text', ev.kitchen_contact || '', ' placeholder="Who to reach at the kitchen" autocomplete="off"')) +
      '<p class="w274hint">The person at the kitchen, by name or role. Keep personal phone numbers in the CRM.</p>';
    openSheet('kitchen', { title: 'The kitchen', sub: titleOf(ev) + ', ' + fmtDay(ev.event_date), body: body, ctx: ev.id, foot: '<button type="button" class="w274btn" data-w274x="1">Cancel</button><button type="submit" class="w274btn pri">Save the kitchen</button>' });
  }
  async function submitKitchen(form) {
    var ev = evById(SH.ctx); if (!ev) return closeSheet();
    var f = { kitchen_place: form.kitchen_place.value.trim() || null, kitchen_shift: form.kitchen_shift.value.trim() || null, kitchen_contact: form.kitchen_contact.value.trim() || null };
    var patch = {}; Object.keys(f).forEach(function (k) { if (String(ev[k] == null ? '' : ev[k]) !== String(f[k] == null ? '' : f[k])) patch[k] = f[k]; });
    setErr('sheet', ''); busy(true);
    try { if (Object.keys(patch).length) await saveEvent(ev, patch); closeSheet(); paint(); snack('Saved the kitchen.'); }
    catch (e) { busy(false); setErr('sheet', 'Couldn’t save the kitchen. Try again.'); console.warn('wave274 kitchen', e); }
  }

  /* ---------- an organization the meals go to ---------- */
  function recSheet(ev, rid) {
    var r = rid ? S.rec.filter(function (x) { return String(x.id) === String(rid); })[0] : null;
    if (rid && !r) return;
    var x = r || {}, d = (x.dietary && typeof x.dietary === 'object') ? x.dietary : {};
    var ck = function (id, name, on, label) { return '<label class="w274ck" for="' + id + '"><input type="checkbox" id="' + id + '" name="' + name + '"' + (on ? ' checked' : '') + '>' + label + '</label>'; };
    var body = fld('Organization', inp('w274rn', 'name', 'text', x.name || '', ' required aria-required="true" autocomplete="off" maxlength="160"')) +
      fld('Meals <small>(the headcount they sent)</small>', inp('w274rm', 'meals', 'number', x.meals == null ? '' : x.meals, ' min="0" max="2000" step="1" inputmode="numeric"')) +
      '<fieldset><legend>Dietary needs</legend>' + ck('w274rh', 'halal', d.halal, 'Halal') + ck('w274rnf', 'nut_free', d.nut_free, 'Nut-free') +
      '<div class="w274row2"><div>' + fld('Vegetarian meals', inp('w274rv', 'vegetarian', 'number', num(d.vegetarian, 0) || '', ' min="0" max="2000" step="1" inputmode="numeric"')) + '</div><div>' +
      fld('Vegan meals', inp('w274rvg', 'vegan', 'number', num(d.vegan, 0) || '', ' min="0" max="2000" step="1" inputmode="numeric"')) + '</div></div>' +
      fld('Anything else', inp('w274ro', 'other', 'text', d.other || '', ' placeholder="No pork, low sodium" autocomplete="off"')) + '</fieldset>' +
      fld('Drop-off', inp('w274rd', 'drop_off', 'text', x.drop_off || '', ' placeholder="12:30 at the side door" autocomplete="off"')) +
      fld('Address', inp('w274ra', 'address', 'text', x.address || '', ' autocomplete="off"')) +
      fld('Contact name', inp('w274rcn', 'contact_name', 'text', x.contact_name || '', ' autocomplete="off"')) +
      '<div class="w274row2"><div>' + fld('Contact phone', inp('w274rcp', 'contact_phone', 'tel', x.contact_phone || '', ' autocomplete="off"')) + '</div><div>' +
      fld('Contact email', inp('w274rce', 'contact_email', 'email', x.contact_email || '', ' autocomplete="off"')) + '</div></div>' +
      '<fieldset><legend>Naming them</legend>' + ck('w274rp', 'private', x.private, 'Supported but not named publicly') + '<p class="w274hint">The Hub then says “1 organization, not named publicly” wherever it lists who the meals go to.</p></fieldset>' +
      '<label class="w274lb" for="w274rnote">Note <small>(optional)</small></label><textarea class="w274i" id="w274rnote" name="note" rows="2">' + E(x.note || '') + '</textarea>';
    openSheet('rec', { title: r ? 'Edit ' + (x.name || 'the organization') : 'Add an organization', sub: 'Who the meals go to, ' + titleOf(ev) + ', ' + fmtDay(ev.event_date), body: body, ctx: { ev: ev.id, id: r ? r.id : null },
      foot: '<button type="button" class="w274btn" data-w274x="1">Cancel</button><button type="submit" class="w274btn pri">' + (r ? 'Save the changes' : 'Add the organization') + '</button>' });
  }
  async function submitRec(form) {
    var ctx = SH.ctx || {}, ev = evById(ctx.ev); if (!ev) return closeSheet();
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (x) { x.removeAttribute('aria-invalid'); });
    var name = form.name.value.trim();
    if (!name) return bad(form.name, 'Give the organization’s name.');
    var meals = wholeOrNull(form.meals.value), veg = wholeOrNull(form.vegetarian.value), vg = wholeOrNull(form.vegan.value);
    if (meals !== meals) return bad(form.meals, 'Meals is a whole number from 0 to 2000.');
    if (veg !== veg) return bad(form.vegetarian, 'Vegetarian meals is a whole number.');
    if (vg !== vg) return bad(form.vegan, 'Vegan meals is a whole number.');
    var em = form.contact_email.value.trim();
    if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return bad(form.contact_email, 'That email doesn’t look right.');
    var diet = { halal: !!form.halal.checked, nut_free: !!form.nut_free.checked, vegetarian: veg || 0, vegan: vg || 0, other: form.other.value.trim() };
    var f = { name: name, meals: meals, dietary: diet, drop_off: form.drop_off.value.trim() || null, address: form.address.value.trim() || null, contact_name: form.contact_name.value.trim() || null,
      contact_phone: form.contact_phone.value.trim() || null, contact_email: em || null, private: !!form.private.checked, note: form.note.value.trim() || null };
    setErr('sheet', ''); busy(true);
    try { await saveRecipient(ev, ctx.id, f); closeSheet(); paintParts(['plan', 'wrap', 'sum']); snack(ctx.id ? 'Saved ' + name + '.' : 'Added ' + name + ' to who the meals go to.'); }
    catch (e) { busy(false); setErr('sheet', 'Couldn’t save the organization. Try again.'); console.warn('wave274 recipient', e); }
  }

  /* ---------- the crew targets (volunteer_events.spot_counts) ---------- */
  function targetsSheet(ev) {
    var t = targetsOf(ev);
    var body = '<p class="w274hint">How many people each crew needs. Photos shows on the page once it needs someone.</p>' +
      ROLES.map(function (r) { return fld(r[1], inp('w274t' + r[0], r[0], 'number', t[r[0]], ' min="0" max="40" step="1" inputmode="numeric"')); }).join('');
    openSheet('targets', { title: 'Crew targets', sub: titleOf(ev) + ', ' + fmtDay(ev.event_date), body: body, ctx: ev.id, foot: '<button type="button" class="w274btn" data-w274x="1">Cancel</button><button type="submit" class="w274btn pri">Save the targets</button>' });
  }
  async function submitTargets(form) {
    var ev = evById(SH.ctx); if (!ev) return closeSheet();
    var sc = Object.assign({}, (ev.spot_counts && typeof ev.spot_counts === 'object') ? ev.spot_counts : {});
    for (var i = 0; i < ROLES.length; i++) {
      var k = ROLES[i][0], v = wholeOrNull(form[k].value, 40);
      if (v !== v) return bad(form[k], ROLES[i][1] + ' is a whole number from 0 to 40.');
      sc[k] = v == null ? 0 : v;
    }
    setErr('sheet', ''); busy(true);
    try { await saveEvent(ev, { spot_counts: sc }); closeSheet(); repaintCrew(); snack('Saved the crew targets.'); }
    catch (e) { busy(false); setErr('sheet', 'Couldn’t save the targets. Try again.'); console.warn('wave274 targets', e); }
  }

  /* ---------- Add people: the Toronto pool in a sheet, a crew, Add ---------- */
  function roleRadios(sel, roles) {
    return '<fieldset><legend>Crew</legend><div class="w274rad">' + roles.map(function (r) { var on = r[0] === sel; return '<label class="' + (on ? 'on' : '') + '" for="w274ro' + r[0] + '"><input type="radio" name="w274role" id="w274ro' + r[0] + '" value="' + r[0] + '"' + (on ? ' checked' : '') + '>' + E(r[1]) + '</label>'; }).join('') + '</div></fieldset>';
  }
  function pickSheet(ev, role) {
    S.pk = { ev: ev.id, role: role || 'cook', f: { q: '', kind: 'all', school: '', area: '', days: [] }, sel: {}, order: [] };
    var go = function () {
      openSheet('pick', { title: 'Add people to the crew', sub: titleOf(ev) + ', ' + fmtDay(ev.event_date), ctx: ev.id, focus: '#w274qk',
        body: roleRadios(S.pk.role, ROLES) + '<div class="w274tools" data-w274tools="k">' + toolsHtml(S.pk.f, 'k') + '</div><p class="w274pkc" id="w274pkc" aria-live="polite"></p><div class="w274pks" id="w274pkl"></div>',
        foot: '<button type="button" class="w274btn" data-w274x="1">Cancel</button><button type="submit" class="w274btn pri" id="w274pkgo" disabled>Add people</button>' });
      paintPick();
    };
    if (S.pool) go(); else loadPool().then(go);
  }
  function paintPick() {
    var box = document.getElementById('w274pkl'), cnt = document.getElementById('w274pkc'), k = S.pk; if (!box || !k) return;
    var pool = S.pool || [], list = sortPeople(filterPeople(pool, k.f), 'name'), shown = list.slice(0, 150);
    if (cnt) cnt.textContent = !pool.length ? '' : (list.length > shown.length ? 'Showing ' + shown.length + ' of ' + list.length + '. Search to find someone.' : countLine(list.length, pool.length));
    box.innerHTML = !pool.length ? '<p class="w274quiet">No Toronto volunteers in the CRM yet.</p>' : !list.length ? noneHtml(k.f) : shown.map(function (p) {
      var on = onEvent(p, k.ev), sel = !!k.sel[p.id];
      return '<label class="w274pk' + (on ? ' dis' : sel ? ' on' : '') + '" for="w274pk' + E(p.id) + '"><input type="checkbox" id="w274pk' + E(p.id) + '" data-w274pick="' + E(p.id) + '"' + (on ? ' checked disabled' : sel ? ' checked' : '') + '>' +
        '<span><span class="w274pn">' + E(p.name) + '</span><span class="s">' + whoChip(p) + '<span>' + E(p.area || 'Area not given') + '</span>' + daysDots(p.days) + (on ? '<span>Already on this event</span>' : '') + '</span></span></label>';
    }).join('');
    pickFoot();
  }
  function pickFoot() {
    var b = document.getElementById('w274pkgo'), k = S.pk; if (!b || !k) return;
    var n = k.order.filter(function (id) { return k.sel[id]; }).length;
    b.disabled = !n;
    b.textContent = n ? 'Add ' + plural(n, 'person', 'people') + ' to ' + roleIn(k.role) : 'Add people';
  }
  async function submitPick() {
    var k = S.pk, ev = k && evById(k.ev); if (!ev) return closeSheet();
    var ids = k.order.filter(function (id) { return k.sel[id]; }); if (!ids.length) return;
    setErr('sheet', ''); busy(true);
    var added = [], already = [], needs = [], errs = [];
    for (var i = 0; i < ids.length; i++) {
      var p = S.byCid[ids[i]]; if (!p) continue;
      var r = await crewAdd(ev, p, k.role);
      if (r.ok && r.already) already.push(p.name); else if (r.ok) added.push(p.name); else if (r.needs) needs.push(p.name); else errs.push(p.name);
      if (r.ok) delete k.sel[p.id];
    }
    reindexPool(); repaintCrew();
    var said = added.length ? 'Added ' + andJoin(added) + ' to ' + roleIn(k.role) + '.' : already.length ? andJoin(already) + (already.length === 1 ? ' is' : ' are') + ' already on this event.' : '';
    if (!needs.length && !errs.length) { closeSheet(); if (said) snack(said); return; }
    busy(false); paintPick();
    setErr('sheet', [needs.length ? andJoin(needs) + (needs.length === 1 ? ' needs' : ' need') + ' the wave274 database update first: there is no volunteer record for ' + (needs.length === 1 ? 'them' : 'them') + ' yet.' : '',
      errs.length ? 'Couldn’t add ' + andJoin(errs) + '. Try again.' : ''].filter(Boolean).join(' '));
    if (said) snack(said);
  }

  /* ---------- Add to an event (from Volunteers): an upcoming Toronto event and a crew ---------- */
  function toEventSheet(p) {
    var t = todayIso(), evs = S.events.filter(function (e) { return isOpen(e) && String(e.event_date) >= t; }).sort(function (a, b) { return String(a.event_date) < String(b.event_date) ? -1 : 1; });
    var first = evs.filter(function (e) { return !onEvent(p, e.id); })[0];
    S.te = { cid: p.id, ev: first ? first.id : null, role: 'cook' };
    var body = !evs.length ? '<p class="w274quiet">There is no upcoming Toronto event to add them to yet. Create one with New event.</p>' :
      '<fieldset><legend>Event</legend><div class="w274pks">' + evs.map(function (e) {
        var on = onEvent(p, e.id), sel = first && first.id === e.id;
        return '<label class="w274evp' + (on ? ' dis' : sel ? ' on' : '') + '" for="w274te' + E(e.id) + '"><input type="radio" name="w274tev" id="w274te' + E(e.id) + '" value="' + E(e.id) + '"' + (on ? ' disabled' : sel ? ' checked' : '') + '>' +
          '<span><span class="w274pn">' + E(fmtDay(e.event_date)) + ', ' + E(titleOf(e)) + '</span><span class="s"><span>' + E(kitchenLine(e)) + '</span>' + (on ? '<span>Already on the crew</span>' : '<span>' + E(cap(rel(daysTo(e.event_date)))) + '</span>') + '</span></span></label>';
      }).join('') + '</div></fieldset>' + roleRadios('cook', ROLES);
    openSheet('toev', { title: 'Add ' + p.name + ' to an event', sub: p.student ? (p.school || 'Student') : 'General volunteer', body: body, ctx: p.id,
      foot: '<button type="button" class="w274btn" data-w274x="1">' + (evs.length ? 'Cancel' : 'Close') + '</button>' + (evs.length ? '<button type="submit" class="w274btn pri" id="w274tego"' + (first ? '' : ' disabled') + '>Add to the crew</button>' : '') });
  }
  async function submitToEvent() {
    var k = S.te, p = k && S.byCid[k.cid], ev = k && evById(k.ev); if (!p || !ev) return;
    setErr('sheet', ''); busy(true);
    var r = await crewAdd(ev, p, k.role);
    if (r.ok) { reindexPool(); closeSheet(); if (S.view === 'people') paintList(false); else if (S.view === 'event') repaintCrew(); snack(r.already ? p.name + ' is already on that event.' : 'Added ' + p.name + ' to ' + roleIn(k.role) + ' on ' + fmtDay(ev.event_date) + '.'); return; }
    busy(false);
    setErr('sheet', r.needs ? p.name + ' needs the wave274 database update first: there is no volunteer record for them yet.' : 'Couldn’t add ' + p.name + ' to the crew. Try again.');
  }

  /* ---------- Cancel this event (a confirm step) ---------- */
  function cancelSheet(ev) {
    openSheet('cancel', { title: 'Cancel this event?', sub: (ev.code ? ev.code + ', ' : '') + fmtDay(ev.event_date), ctx: ev.id, focus: '[data-w274keep]',
      body: '<p>' + E(titleOf(ev)) + ' moves to the past events as cancelled. Nobody is told automatically: let the crew and the organizations know yourself.</p><p class="w274hint">You can plan it again later from More.</p>',
      foot: '<button type="button" class="w274btn" data-w274x="1" data-w274keep="1">Keep the event</button><button type="submit" class="w274btn pri dng">Cancel the event</button>' });
  }
  async function submitCancel() {
    var ev = evById(SH.ctx); if (!ev) return closeSheet();
    setErr('sheet', ''); busy(true);
    try { await saveEvent(ev, { status: 'cancelled' }); closeSheet(); paint(); snack('Cancelled the event.'); }
    catch (e) { busy(false); setErr('sheet', 'Couldn’t cancel the event. Try again.'); console.warn('wave274 cancel', e); }
  }
  var SUBMIT = { event: submitEvent, kitchen: submitKitchen, rec: submitRec, targets: submitTargets, pick: submitPick, toev: submitToEvent, cancel: submitCancel };
