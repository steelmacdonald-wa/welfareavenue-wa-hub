
  /* ---------- the event page (#toronto/e/<id>): Plan, Crew, Confirm, Wrap up ---------- */
  var ADD_TO = { team_leader: 'Add a lead', cook: 'Add to the kitchen crew', server: 'Add to the serving crew', driver: 'Add someone for delivery', photographer: 'Add a photographer' };
  var ST_NAME = { planned: 'Planned', completed: 'Completed', cancelled: 'Cancelled' };
  function curEv() { return S.view === 'event' ? evById(S.evId) : null; }
  function mastLine(e) { var t = hm(e.start_time), k = String(e.kitchen_place || '').trim(); return fmtDay(e.event_date) + (t ? ' at ' + t : '') + (k ? ', ' + k : ''); }
  /* the current stage's main action is the page's primary one */
  function pri(e, k) { return stageOf(e) === k && isOpen(e) ? ' pri' : ''; }
  function val(v) { v = String(v == null ? '' : v).trim(); return v ? E(v) : '<span class="none">Not set yet</span>'; }
  function secHead(k, e, acts) {
    return '<div class="w274sh"><span class="w274no" aria-hidden="true">' + (stageIdx(k) + 1) + '</span><h2 id="w274h-' + k + '" tabindex="-1">' + E(stageLabel(k)) + '</h2>' +
      (stageOf(e) === k ? '<span class="w274chip stg">Now</span>' : '') + (acts ? '<div class="w274sha">' + acts + '</div>' : '') + '</div>';
  }
  function headHtml(e) {
    var s = lower(e.status) || 'planned';
    return '<div class="w274ehl"><span class="w274chip st-' + E(s) + '">' + E(ST_NAME[s] || cap(s)) + '</span>' + (e.code ? '<span class="w274code">' + E(e.code) + '</span>' : '') + '<span>' + E(cap(rel(daysTo(e.event_date)))) + '</span></div>' +
      '<div class="w274eha"><button type="button" class="w274btn" data-w274edit="1">' + ic('pen') + 'Edit</button><button type="button" class="w274btn" data-w274more="1" aria-haspopup="menu" aria-expanded="false">More</button></div>';
  }
  function stepsHtml(e) {
    var cur = stageOf(e);
    return '<nav class="w274steps" aria-label="Stages of this event"><span class="w274mk" aria-hidden="true"></span>' +
      STAGES.map(function (s) { return '<button type="button" data-w274go="' + s[0] + '"' + (s[0] === cur ? ' aria-current="step"' : '') + '>' + E(s[1]) + '</button>'; }).join('') + '</nav>';
  }
  function sumHtml(e) {
    var s = lower(e.status);
    if (s === 'cancelled') return '<p class="w274cx" role="status">This event was cancelled. More, then Plan this event again, brings it back.</p>';
    if (s !== 'completed') return '';
    var d = delivered(e), rs = recsOf(e.id), came = rowsOf(e.id).filter(function (r) { return stOf(r) === 'yes'; }).length;
    return '<p class="w274done" role="status"><b>Completed.</b> ' + (d != null ? E(plural(d, 'meal')) + ' delivered' + (rs.length ? ' to ' + E(plural(rs.length, 'organization')) : '') + '. ' : '') + E(plural(came, 'person', 'people')) + ' came.</p>';
  }
  /* Plan: the kitchen, and who the meals go to */
  function dietChips(d) {
    d = (d && typeof d === 'object') ? d : {}; var o = [];
    if (d.halal) o.push('Halal'); if (d.nut_free) o.push('Nut-free');
    if (num(d.vegetarian, 0) > 0) o.push(num(d.vegetarian, 0) + ' vegetarian'); if (num(d.vegan, 0) > 0) o.push(num(d.vegan, 0) + ' vegan');
    if (String(d.other || '').trim()) o.push(String(d.other).trim());
    return o;
  }
  function recHtml(r) {
    var chips = dietChips(r.dietary), id = E(r.id);
    var contact = [r.contact_name ? E(r.contact_name) : '', r.contact_phone ? '<a href="tel:' + E(String(r.contact_phone).replace(/[^\d+]/g, '')) + '">' + E(r.contact_phone) + '</a>' : '', r.contact_email ? '<a href="mailto:' + E(r.contact_email) + '">' + E(r.contact_email) + '</a>' : ''].filter(Boolean);
    var drop = [r.drop_off, r.address].map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    return '<article class="w274rc" data-w274rid="' + id + '"><div class="w274rct"><h4>' + E(r.name) + (r.private ? '<span class="w274chip">' + ic('lock') + 'Not named publicly</span>' : '') + '</h4>' +
      (r.meals != null ? '<span class="w274ml"><b>' + E(nf(r.meals)) + '</b> ' + (Number(r.meals) === 1 ? 'meal' : 'meals') + '</span>' : '') + '</div>' +   /* break274: "1 meal" */
      (chips.length ? '<div class="w274diet" role="list" aria-label="Dietary needs">' + chips.map(function (c) { return '<span class="w274chip" role="listitem">' + E(c) + '</span>'; }).join('') + '</div>' : '') +
      (drop.length ? '<p class="w274meta">Drop-off: ' + E(drop.join(', ')) + '</p>' : '') +
      (contact.length ? '<p class="w274meta">Contact: ' + contact.join(', ') + '</p>' : '') +
      (r.note ? '<p class="w274meta">' + E(r.note) + '</p>' : '') +
      (String(S.confirmRec) === String(r.id)
        ? '<div class="w274cfm" role="group" aria-label="Remove ' + E(r.name) + '"><span>Remove ' + E(r.name) + ' from this event?</span><button type="button" class="w274btn sm dng pri" data-w274recy="' + id + '">Remove</button><button type="button" class="w274btn sm" data-w274recn="' + id + '">Keep</button></div>'
        : '<div class="w274rca"><button type="button" class="w274btn sm" data-w274rec="' + id + '">' + ic('pen') + 'Edit</button><button type="button" class="w274btn sm dng" data-w274recx="' + id + '">Remove</button></div>') + '</article>';
  }
  function planHtml(e) {
    var kit = '<div class="w274box"><div class="w274bh"><h3>Kitchen</h3><button type="button" class="w274btn sm" data-w274kit="1">' + ic('pen') + 'Edit</button></div>' +
      '<dl class="w274dl"><dt>Place</dt><dd>' + val(e.kitchen_place) + '</dd><dt>Time</dt><dd>' + val(e.kitchen_shift) + '</dd><dt>Contact</dt><dd>' + val(e.kitchen_contact) + '</dd><dt>Starts</dt><dd>' + val(hm(e.start_time)) + '</dd></dl>' + errLine('kit') + '</div>';
    var body;
    if (!S.recOk) body = '<p class="w274quiet">Who the meals go to opens once the Toronto database update is applied.</p>';
    else {
      var rs = recsOf(e.id), planned = num(e.planned_meals, null), placed = rs.reduce(function (s, r) { return s + num(r.meals, 0); }, 0);
      body = (rs.length ? '<div class="w274rcs">' + rs.map(recHtml).join('') + '</div>' : '<p class="w274quiet">No organization yet. Add the one that sent the request, with its headcount and dietary needs.</p>') +
        (planned != null && rs.some(function (r) { return r.meals != null; }) ? '<p class="w274placed"><b>' + nf(placed) + ' of ' + nf(planned) + '</b> planned meals placed</p>' : planned != null ? '<p class="w274placed">' + E(plural(planned, 'meal')) + ' planned</p>' : '');
    }
    var rec = '<div class="w274box"><div class="w274bh"><h3>Who the meals go to</h3>' + (S.recOk ? '<button type="button" class="w274btn' + (pri(e, 'plan') ? pri(e, 'plan') : ' sm') + '" data-w274rec="new">' + ic('plus') + 'Add an organization</button>' : '') + '</div>' + body + errLine('rec') + '</div>';
    return secHead('plan', e) + '<p class="w274lead">The kitchen and its time, and the organizations the meals go to, with what each one asked for.</p><div class="w274two">' + kit + rec + '</div>';
  }
  /* Crew: one column per crew, its people, Add people, the targets */
  function stChip(st) { return '<span class="w274chip ' + st + '">' + E(ST_LABEL[st]) + '</span>'; }
  /* break274: a school's long name is cut to the chip's width (b_css.js), the full name on hover */
  function whoChip(p) { return !p ? '' : p.student ? '<span class="w274chip sch" title="' + E(p.schoolName || p.school || 'Student') + '">' + E(p.school || 'Student') + '</span>' : '<span class="w274chip gen">General</span>'; }
  function nameOf(r) { var p = personOf(r); return String((r && r.person_name) || (p && p.name) || 'No name').trim(); }
  function pcHtml(r) {
    var p = personOf(r), st = stOf(r), nm = nameOf(r), chip = whoChip(p);
    return '<div class="w274pc" data-w274r="' + E(r.id) + '" data-st="' + st + '"><div class="w274pm"><span class="w274pn">' + E(nm) + '</span><span class="w274pcs">' + chip +
      '<span class="w274sw" data-w274chip="' + E(r.id) + '">' + stChip(st) + '</span></span></div>' +
      '<button type="button" class="w274ib" data-w274pm="' + E(r.id) + '" aria-haspopup="menu" aria-expanded="false" aria-label="' + E('Change ' + nm + '\u2019s place on the crew') + '">' + ic('dots') + '</button></div>';
  }
  function crewSum(t) { return t.target ? nf(t.filled) + ' of ' + nf(t.target) + ' places filled, ' + nf(t.yes) + ' confirmed.' : 'No crew places set yet. Edit the targets to say how many people each crew needs.'; }
  function colHtml(e, c) {
    return '<div class="w274col" data-w274role="' + E(c.role) + '"><div class="w274colh"><h3>' + E(c.label) + '</h3><span class="w274cn" data-w274cn="' + E(c.role) + '">' + ofT(c.yes + c.wait, c.target) + '</span></div>' + barHtml(c) +
      '<div class="w274ppl">' + (c.people.length ? c.people.map(pcHtml).join('') : '<p class="w274quiet">No one yet.</p>') + '</div>' +
      (isOpen(e) ? '<button type="button" class="w274add" data-w274addp="' + E(c.role) + '">' + ic('plus') + E(ADD_TO[c.role] || 'Add people') + '</button>' : '') + '</div>';
  }
  function crewHtml(e) {
    var crews = crewOf(e), t = totals(crews);
    var acts = isOpen(e) ? '<button type="button" class="w274btn' + pri(e, 'crew') + '" data-w274addp="">' + ic('plus') + 'Add people</button><button type="button" class="w274btn" data-w274tg="1">Edit the targets</button>' : '';
    return secHead('crew', e, acts) + '<p class="w274lead" data-w274crewsum="1">' + E(crewSum(t)) + '</p>' +
      (S.rosterErr ? '<p class="w274err" role="alert">Couldn\u2019t load the crew. Reload the page to try again.</p>' : '') +
      '<div class="w274crews">' + crews.map(function (c) { return colHtml(e, c); }).join('') + '</div>' + errLine('crew');
  }
  /* Confirm: the counts, who to call, the crew's emails and numbers, the WhatsApp group */
  function linksOf(r) {
    var k = contactOfRow(r), o = [];
    if (k.phone) o.push('<a href="tel:' + E(String(k.phone).replace(/[^\d+]/g, '')) + '">' + E(k.phone) + '</a>');
    if (k.email) o.push('<a href="mailto:' + E(k.email) + '">' + E(k.email) + '</a>');
    return o.length ? o.join('<span class="w274sep">, </span>') : 'No phone or email on file';   /* on a phone each link is its own 44 px line */
  }
  function who(email) { var s = String(email || ''); return s.split('@')[0].split('.')[0].replace(/^\w/, function (c) { return c.toUpperCase(); }); }
  function scopeRows(e) { return rowsOf(e.id).filter(function (r) { var s = stOf(r); return S.scope === 'wait' ? s === 'wait' : (s === 'yes' || s === 'wait'); }); }
  function confirmHtml(e) {
    var rows = rowsOf(e.id).filter(function (r) { return stOf(r) !== 'off'; });
    var yes = rows.filter(function (r) { return stOf(r) === 'yes'; }).length, wait = rows.filter(function (r) { return stOf(r) === 'wait'; }).length, no = rows.length - yes - wait;
    var waiting = rows.filter(function (r) { return stOf(r) === 'wait'; });
    var list = waiting.length ? '<div class="w274wl">' + waiting.map(function (r) {
      var d = r.detail || {}, on = !!d.called_at;
      return '<div class="w274wr" data-w274wr="' + E(r.id) + '"><div class="who"><span class="w274pn">' + E(nameOf(r)) + '</span> <span class="w274chip">' + E(roleLabel(r.role)) + '</span><div class="how">' + linksOf(r) + '</div>' +
        (on ? '<div class="when">Called ' + E(stamp(d.called_at)) + (d.called_by ? ' by ' + E(who(d.called_by)) : '') + '</div>' : '') + '</div>' +
        '<button type="button" class="w274tog" data-w274call="' + E(r.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + E('Called ' + nameOf(r)) + '"><span class="bx">' + ic('check') + '</span>Called</button></div>';
    }).join('') + '</div>' : '<p class="w274quiet">' + (rows.length ? 'No one is waiting: everyone on the crew has answered.' : 'No one on the crew yet. Add people in Crew first.') + '</p>';
    var n = yes + wait;
    var copy = '<div class="w274copy"><div class="w274seg" role="group" aria-label="Whose details to copy">' +
      '<button type="button" data-w274scope="all" aria-pressed="' + (S.scope !== 'wait' ? 'true' : 'false') + '">All the crew (' + nf(n) + ')</button>' +
      '<button type="button" data-w274scope="wait" aria-pressed="' + (S.scope === 'wait' ? 'true' : 'false') + '">Only those waiting (' + nf(wait) + ')</button></div>' +
      '<button type="button" class="w274btn' + pri(e, 'confirm') + '" data-w274copy="phone">' + ic('copy') + 'Copy phone numbers</button><button type="button" class="w274btn" data-w274copy="email">' + ic('copy') + 'Copy emails</button></div>' + errLine('copy') +
      (S.copyShow ? '<label class="w274vh" for="w274cpt">The copied list</label><textarea class="w274i" id="w274cpt" readonly rows="3">' + E(S.copyShow) + '</textarea>' : '');
    var url = String(e.whatsapp_url || '').trim();
    var wa = '<div class="w274box"><div class="w274bh"><h3>WhatsApp group</h3></div>' + (S.waEdit
      ? '<label class="w274vh" for="w274wa">WhatsApp group link</label><div class="w274wa"><input class="w274i" id="w274wa" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://chat.whatsapp.com/your-group" value="' + E(url) + '" aria-describedby="w274wae"><button type="button" class="w274btn pri" data-w274wa="save">Save the link</button><button type="button" class="w274btn" data-w274wa="cancel">Cancel</button>' + (url ? '<button type="button" class="w274btn dng" data-w274wa="clear">Remove the link</button>' : '') + '</div><p class="w274err" id="w274wae" data-w274err="wa" aria-live="polite">' + E(S.err.wa || '') + '</p>'
      : (url ? '<div class="w274wa"><a class="w274btn" href="' + E(url) + '" target="_blank" rel="noopener noreferrer">' + ic('ext') + 'Open the group</a><button type="button" class="w274btn" data-w274wa="edit">' + ic('pen') + 'Edit the link</button></div><p class="w274meta">' + E(url) + '</p>'
        : '<p class="w274quiet">No group link yet. Add it so the crew can find the chat.</p><button type="button" class="w274btn" data-w274wa="edit">' + ic('plus') + 'Add the group link</button>') + errLine('wa')) + '</div>';
    return secHead('confirm', e) + '<p class="w274cnts" data-w274cnts="1"><span><b>' + nf(yes) + '</b> confirmed</span><span><b>' + nf(wait) + '</b> waiting</span><span><b>' + nf(no) + '</b> can\u2019t come</span></p>' +
      '<div class="w274two"><div class="w274box"><div class="w274bh"><h3>Waiting to hear back</h3></div>' + list + errLine('call') + copy + '</div>' + wa + '</div>';
  }
  /* Wrap up: meals delivered, who came, Mark this event completed */
  function wrapHtml(e) {
    var s = lower(e.status), rs = recsOf(e.id), d = delivered(e);
    var md = !S.recOk ? '<p class="w274quiet">Counting meals delivered opens once the Toronto database update is applied.</p>'
      : !rs.length ? '<p class="w274quiet">Add who the meals go to in Plan, then count what each organization got here.</p>'
        : '<div class="w274mds">' + rs.map(function (r) {
          return '<div class="w274md"><label for="w274md' + E(r.id) + '"><span class="w274pn">' + E(r.name) + '</span>' + (r.meals != null ? ' <span class="w274meta">' + E(nf(r.meals)) + ' asked for</span>' : '') + '</label>' +
            '<input class="w274i" type="number" min="0" max="2000" step="1" inputmode="numeric" id="w274md' + E(r.id) + '" data-w274md="' + E(r.id) + '" value="' + E(r.meals_delivered == null ? '' : r.meals_delivered) + '"></div>';
        }).join('') + '</div><div class="w274copy"><button type="button" class="w274btn" data-w274mdsave="1">Save meals delivered</button><span class="w274meta">' + (d != null ? E(plural(d, 'meal')) + ' delivered in all' : 'Not counted yet') + '</span></div>' + errLine('md');
    var came = rowsOf(e.id).filter(function (r) { var x = stOf(r); return x === 'yes' || (x === 'no' && r.confirmed_at); });
    var whoList = came.length ? '<div class="w274wl">' + came.map(function (r) {
      var y = stOf(r) === 'yes', nm = nameOf(r);
      return '<div class="w274wr w274cr"><div class="who"><span class="w274pn">' + E(nm) + '</span> <span class="w274chip">' + E(roleLabel(r.role)) + '</span></div>' +
        '<div class="w274seg" role="group" aria-label="' + E('Did ' + nm + ' come?') + '"><button type="button" data-w274came="' + E(r.id) + '" data-v="yes" aria-pressed="' + (y ? 'true' : 'false') + '">Came</button><button type="button" data-w274came="' + E(r.id) + '" data-v="no" aria-pressed="' + (y ? 'false' : 'true') + '">Didn\u2019t come</button></div></div>';
    }).join('') + '</div>' : '<p class="w274quiet">No one has confirmed yet. The confirmed crew shows here, to mark who came.</p>';
    var fin;
    if (s === 'cancelled') fin = '<p class="w274quiet">This event was cancelled, so there is nothing to wrap up.</p>';
    else if (s === 'completed') fin = '<p class="w274quiet">This event is completed. The CRM counts it for everyone marked as came.</p>';
    else if (S.confirmDone) fin = '<div class="w274cfm ok" role="group" aria-label="Mark completed"><span>This event is ' + E(rel(daysTo(e.event_date))) + '. Mark it completed now?</span><button type="button" class="w274btn sm pri" data-w274done="yes">Mark completed</button><button type="button" class="w274btn sm" data-w274done="no">Not yet</button></div>';
    else fin = '<button type="button" class="w274btn' + pri(e, 'wrap') + '" data-w274done="ask">' + ic('check') + 'Mark this event completed</button>';
    return secHead('wrap', e) + '<p class="w274lead">After the event: what each organization got, who came, and the event marked completed so the CRM counts it.</p>' +
      '<div class="w274two"><div class="w274box"><div class="w274bh"><h3>Meals delivered</h3></div>' + md + '</div><div class="w274box"><div class="w274bh"><h3>Who came</h3></div>' + whoList + errLine('came') + '</div></div>' +
      '<div class="w274copy">' + fin + '</div>' + errLine('done');
  }
  var PART = { head: headHtml, sum: sumHtml, plan: planHtml, crew: crewHtml, confirm: confirmHtml, wrap: wrapHtml };
  function selOf(a) {
    if (!a || !a.getAttribute) return null;
    for (var i = 0; i < a.attributes.length; i++) {
      var n = a.attributes[i].name;
      if (/^data-w274/.test(n)) { var s = '[' + n + '="' + String(a.attributes[i].value).replace(/["\\]/g, '\\$&') + '"]'; if (a.getAttribute('data-v')) s += '[data-v="' + a.getAttribute('data-v') + '"]'; return s; }
    }
    return a.id ? '#' + a.id : null;
  }
  function keepFocus(fn) {
    var a = document.activeElement, sel = a && a !== document.body ? selOf(a) : null;
    fn();
    if (sel) { var b = document.querySelector(sel); if (b && b !== document.activeElement && b.offsetParent !== null) { try { b.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }
  }
  function paintParts(names) {
    var e = curEv(), root = document.getElementById('w274root'); if (!e || !root) return;
    keepFocus(function () {
      names.forEach(function (n) {
        var el = root.querySelector('[data-w274part="' + n + '"]'); if (!el || !PART[n]) return;
        el.innerHTML = PART[n](e); bars(el, false);
        if (/^(plan|crew|confirm|wrap)$/.test(n)) el.classList.toggle('cur', stageOf(e) === n);
      });
    });
  }
  /* the stage marker: placed at once on a first draw, moved (240 ms) when the stage changes */
  function marker(root, e) {
    var st = root.querySelector('.w274steps'), mk = st && st.querySelector('.w274mk'); if (!mk) return;
    var to = stageIdx(stageOf(e)), from = S.mk && String(S.mk.id) === String(e.id) ? S.mk.i : to;
    mk.style.transform = 'translateX(' + (from * 100) + '%)';
    void mk.offsetWidth;
    st.classList.add('w274go');
    if (from !== to) requestAnimationFrame(function () { mk.style.transform = 'translateX(' + (to * 100) + '%)'; });
    S.mk = { id: e.id, i: to };
  }
  function paintEvent(root, fresh) {
    var e = curEv();
    if (!S.loaded) { setMast('Toronto event', 'Loading the event\u2026', { back: true }); root.innerHTML = '<p class="w274quiet" role="status">Loading the event\u2026</p>'; return; }
    if (!e) { setMast('This event isn\u2019t here', 'It may have been removed, or it is not a Toronto event.', { back: true }); root.innerHTML = '<div class="w274empty"><p>Go back to all the Toronto events to find the one you need.</p><a class="w274btn" href="#toronto">All events</a></div>'; return; }
    setMast(titleOf(e), mastLine(e), { back: true });
    var st = stageOf(e);
    keepFocus(function () {
      root.innerHTML = '<div class="w274eh" data-w274part="head">' + headHtml(e) + '</div>' + stepsHtml(e) + '<div data-w274part="sum">' + sumHtml(e) + '</div>' +
        ['plan', 'crew', 'confirm', 'wrap'].map(function (k) { return '<section class="w274sec' + (k === st ? ' cur' : '') + '" id="w274s-' + k + '" data-w274part="' + k + '" aria-labelledby="w274h-' + k + '">' + PART[k](e) + '</section>'; }).join('');
    });
    marker(root, e);
    bars(root, fresh);
  }
  /* a status changed: the chip crossfades in place, the counts follow, Confirm and Wrap up redraw */
  function crossfade(sw, html) {
    var old = Array.prototype.slice.call(sw.children), tmp = document.createElement('span'); tmp.innerHTML = html;
    var nu = tmp.firstChild; if (!nu) return;
    if (S.kbd) { sw.innerHTML = html; return; }   /* a keyboard action: the new status at once */
    nu.classList.add('w274fo'); sw.appendChild(nu); void nu.offsetWidth;
    nu.classList.remove('w274fo'); old.forEach(function (o) { o.classList.add('w274fo'); });
    setTimeout(function () { old.forEach(function (o) { if (o.parentNode) o.parentNode.removeChild(o); }); }, 220);
  }
  function statusInPlace(r) {
    var root = document.getElementById('w274root'), e = evById(r.event_id); if (!root || !e) return;
    var st = stOf(r), sw = root.querySelector('[data-w274chip="' + r.id + '"]'), card = root.querySelector('[data-w274r="' + r.id + '"]');
    if (sw) crossfade(sw, stChip(st));
    if (card) card.setAttribute('data-st', st);
    crewOf(e).forEach(function (c) {
      var cn = root.querySelector('[data-w274cn="' + c.role + '"]'); if (cn) cn.textContent = ofT(c.yes + c.wait, c.target);
      var col = root.querySelector('.w274col[data-w274role="' + c.role + '"]'), w = col && col.querySelector('.w274bar .w'), cc = col && col.querySelector('.w274bar .c'), bar = col && col.querySelector('.w274bar');
      if (bar && S.kbd) bar.classList.add('w274now');   /* break274: a keyboard action: the bar stands at its new value at once */
      if (w) { w.setAttribute('data-x', ratio(c.yes + c.wait, c.target).toFixed(3)); w.style.transform = 'scaleX(' + w.getAttribute('data-x') + ')'; }
      if (cc) { cc.setAttribute('data-x', ratio(c.yes, c.target).toFixed(3)); cc.style.transform = 'scaleX(' + cc.getAttribute('data-x') + ')'; }
      if (bar && S.kbd) { void bar.offsetWidth; bar.classList.remove('w274now'); }
    });
    var sum = root.querySelector('[data-w274crewsum]'); if (sum) sum.textContent = crewSum(totals(crewOf(e)));
    paintParts(['confirm', 'wrap', 'sum']);
  }
  function repaintCrew() { paintParts(['crew', 'confirm', 'wrap', 'sum']); }
