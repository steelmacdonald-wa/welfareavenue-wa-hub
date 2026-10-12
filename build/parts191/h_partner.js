  /* ---------- wave191o: a serving with a partner organization (Plan) ----------
     Steel (01/10/26): collaborators like Oberoi Financial Group "work differently": is their group bringing the food, how
     many are there, which roles do we still fill (cooks, servers, drivers, photographers), "a team leader and community lead
     on our end always need to be there", the kitchen model with DESTA or their own space; their people by "headcount and
     coordinator or each person by name - allow our team to choose", the form route so "we get more people in to our system".
     The card in Plan shows the collaboration (wa191_partner_save keeps it in volunteer_event_partners); the editor sets it.
     What they cover counts toward each role on the serving (the header, Next up, Recruit, the team), so Find volunteers and
     Plan the roster fill only the gap; signed-up people from their form count as themselves. */
  var PART = { by: {}, at: {}, list: null };
  var FOOD = {
    ours: ['Our cooks', 'Our home cooks make the food, as usual.'],
    they_bring: ['They bring the food', 'Their group brings the meals ready to serve: no cooks or pickups from us.'],
    desta_kitchen: ['They cook with us in DESTA’s kitchen', 'Community kitchen at DESTA: their people cook, our driver picks the food up there.'],
    their_kitchen: ['They cook in their own space', 'Their people cook at their place: our driver picks the food up there.']
  };
  var PROLES = [['server', 'Servers'], ['cook', 'Cooks'], ['driver', 'Drivers'], ['photographer', 'Photographers'], ['dishwasher', 'Dishwashing'], ['community_talker', 'Community welcome']];
  function partnerOf(evId) { var x = PART.by[evId]; return x && x.active ? x : null; }
  async function loadPartner(ev, force) {
    if (!ev || !staff()) return null;
    if (!force && PART.at[ev.id] && Date.now() - PART.at[ev.id] < 30000) return partnerOf(ev.id);
    try { var r = await db.from('volunteer_event_partners').select('*').eq('event_id', ev.id).maybeSingle(); if (r && !r.error) PART.by[ev.id] = r.data || null; } catch (e) { /* fine */ }
    PART.at[ev.id] = Date.now();
    return partnerOf(ev.id);
  }
  /* what we still bring, role by role: what they cover comes off our part; our team leader and community lead are always
     ours; when they make the food we bring no cooks, and when they bring it ready, one driver for the equipment */
  function partnerOurs(evId, base) {
    var P = partnerOf(evId); if (!P) return null;
    var out = Object.assign({}, base); var cov = P.covers || {};
    Object.keys(out).forEach(function (r) { if (r === 'team_leader' || r === 'community_debrief') return; out[r] = Math.max(0, (out[r] || 0) - (cov[r] || 0)); });
    if (P.food && P.food !== 'ours') out.cook = 0;
    if (P.food === 'they_bring' && (out.driver || 0) > 1) out.driver = 1;
    return out;
  }
  /* Plan the roster counts everyone on the list (their people signed up by name too): those come back onto the target */
  function partnerTargets(evId, base, roster) {
    var out = partnerOurs(evId, base); if (!out) return null;
    var P = partnerOf(evId), cov = P.covers || {}, signed = {};
    (roster || []).forEach(function (r) { if ((r.detail || {}).source === 'partner form' && !isOff(r) && !isDecl(r)) signed[r.role] = (signed[r.role] || 0) + 1; });
    Object.keys(out).forEach(function (r) { if (r === 'team_leader' || r === 'community_debrief') return; out[r] += Math.min(signed[r] || 0, cov[r] || 0); });
    return out;
  }
  window.WA191TARGETS = function (evId, base) { var D = curD(); var b2 = withSpots(evId, base); return partnerTargets(evId, b2, D && D.id === evId ? D.roster : []) || (b2 !== base ? b2 : null); };   /* wave232: the serving's own spot counts first */
  function coversText(P) {
    var c = P.covers || {}; var bits = PROLES.filter(function (x) { return c[x[0]]; }).map(function (x) { return c[x[0]] + ' ' + (c[x[0]] === 1 ? x[1].replace(/s$/, '').replace(/^Dishwashing$/, 'dishwasher').toLowerCase() : x[1].toLowerCase()); });
    return bits.join(', ');
  }
  function partnerCardHtml(ev, D, P) {
    var signed = (D.roster || []).filter(function (r) { return (r.detail || {}).source === 'partner form' && !isOff(r) && !isDecl(r); });
    var base = targets(ev.id); var T = partnerOurs(ev.id, base) || base;
    var ours = ROLE_ORDER.filter(function (r) { return (T[r] || 0) > 0; }).map(function (r) { return (T[r] > 1 ? T[r] + ' ' : '') + one(r).toLowerCase() + (T[r] > 1 ? 's' : ''); });
    var link = P.route === 'everyone' && P.signup_token ? 'https://hub.welfareavenue.com/c/' + P.signup_token : '';
    var h = '<h4>Collaboration</h4><div class="w191pt"><div class="nm"><b>' + E(P.partner_name) + '</b>' + (P.headcount ? '<span>' + E(P.headcount + ' people') + '</span>' : '') + '</div>'
      + '<dl><dt>Food</dt><dd>' + E((FOOD[P.food] || FOOD.ours)[0]) + (P.kitchen_place && (P.food === 'desta_kitchen' || P.food === 'their_kitchen') ? ' <i>· ' + E(P.kitchen_place) + '</i>' : '') + '</dd>'
      + '<dt>They cover</dt><dd>' + (coversText(P) ? E(coversText(P)) : '<i>no roles yet</i>') + '</dd>'
      + '<dt>We bring</dt><dd>' + E(ours.join(', ') || 'nobody else') + ' <i>(our team leader and community lead, always)</i></dd>'
      + '<dt>Their people</dt><dd>' + (P.route === 'everyone' ? 'Everyone signs up with the form · <b>' + signed.length + '</b> signed up so far' : 'A coordinator gives us the headcount')
      + (P.coordinator_name || P.coordinator_email || P.coordinator_phone ? '<br><span class="ct">' + E([P.coordinator_name, P.coordinator_email, P.coordinator_phone].filter(Boolean).join(' · ')) + '</span>' : '') + '</dd>'
      + (P.note ? '<dt>Note</dt><dd>' + E(P.note) + '</dd>' : '') + '</dl></div>'
      + '<div class="w191line">' + (staff() ? '<button class="w191btn ghost" data-w191go="partner">Edit the collaboration</button>' : '')
      + (link ? '<button class="w191btn quiet" data-w191pcopy="' + E(link) + '">Copy the form link</button><a class="w191btn quiet" target="_blank" rel="noopener" href="' + E(link) + '?test=1">See the form</a>' : '') + '</div>'
      + (link && !P.signup_open ? '<p class="w191rsub" style="margin-top:6px">The form is closed to new sign-ups.</p>' : '');
    return h;
  }
  function partnerBox() {
    var b = stageBody('plan'); if (!b) return null;
    var box = document.getElementById('w191partner');
    if (!box) { box = document.createElement('div'); box.id = 'w191partner'; box.className = 'cardy w191run w191partner'; }
    var own = b.querySelector(':scope > .w191own');
    if (own) { if (own.nextElementSibling !== box) own.insertAdjacentElement('afterend', box); }
    else if (box.parentNode !== b) b.insertBefore(box, b.firstChild);
    return box;
  }
  async function paintPartner() {
    var ev = curEv(), D = curD(); if (!ev || !D || !root() || !staff()) return;
    if (ev.kind && ev.kind !== 'service') return;
    var had = !!partnerOf(ev.id);
    var P = await loadPartner(ev, false);
    if (curEv() !== ev || !root()) return;
    var box = document.getElementById('w191partner');
    if (!P) { if (box) box.remove(); if (had) refresh(false); return; }
    box = partnerBox(); if (!box) return;
    var html = partnerCardHtml(ev, D, P);
    if (box.__h !== html) { box.innerHTML = html; box.__h = html; }
    if (!had) refresh(false);
  }
  async function partnerList() {
    if (PART.list) return PART.list;
    try { var r = await db.from('wa_partners').select('id,name,category,status').order('name'); PART.list = ((r && r.data) || []).filter(function (x) { return x.status !== 'inactive'; }); } catch (e) { PART.list = []; }
    return PART.list;
  }
  async function partnerEditor() {
    var ev = curEv(); if (!ev || !staff()) return;
    var P = await loadPartner(ev, true) || {}; var list = await partnerList();
    var c = P.covers || {}; var food = P.food || 'ours'; var route = P.route || 'coordinator';
    var known = P.partner_id && list.some(function (x) { return x.id === P.partner_id; });
    var opts = '<option value="">Choose the organization…</option>' + list.map(function (x) { return '<option value="' + x.id + '"' + (P.partner_id === x.id ? ' selected' : '') + '>' + E(x.name) + '</option>'; }).join('') + '<option value="other"' + (P.partner_name && !known ? ' selected' : '') + '>Another organization (type its name)</option>';
    var html = '<div class="w171m w191pm"><h3>Collaboration</h3><p class="sub">' + E(fmtDay(ev.event_date, true)) + ' · a partner organization serves with us. Our team leader and community lead are always ours.</p>'
      + '<label class="f">The organization</label><select id="w191pp">' + opts + '</select>'
      + '<input type="text" id="w191pn" placeholder="The organization’s name" value="' + E(P.partner_name && !known ? P.partner_name : '') + '" style="margin-top:6px' + (P.partner_name && !known ? '' : ';display:none') + '">'
      + '<label class="f">The food</label><div class="modes">' + Object.keys(FOOD).map(function (k) { return '<label class="' + (food === k ? 'on' : '') + '"><input type="radio" name="w191pf" value="' + k + '"' + (food === k ? ' checked' : '') + '><span><b>' + E(FOOD[k][0]) + '</b><small>' + E(FOOD[k][1]) + '</small></span></label>'; }).join('') + '</div>'
      + '<div id="w191pkw"' + (food === 'desta_kitchen' || food === 'their_kitchen' ? '' : ' style="display:none"') + '><label class="f">The kitchen’s address (the drivers’ run picks the food up there)</label><input type="text" id="w191pk" placeholder="Street address, Montréal" value="' + E(P.kitchen_place || ev.kitchen_place || '') + '"></div>'
      + '<label class="f">Their people</label><div class="modes">'
      + '<label class="' + (route === 'coordinator' ? 'on' : '') + '"><input type="radio" name="w191pr" value="coordinator"' + (route === 'coordinator' ? ' checked' : '') + '><span><b>A coordinator gives us a headcount</b><small>One contact for their group; we count their people by role.</small></span></label>'
      + '<label class="' + (route === 'everyone' ? 'on' : '') + '"><input type="radio" name="w191pr" value="everyone"' + (route === 'everyone' ? ' checked' : '') + '><span><b>Everyone signs up with the form</b><small>Each person gives their name and contact: they join our volunteer list and get their own page. You get a link to share.</small></span></label></div>'
      + '<div class="two3"><div><label class="f">Coordinator</label><input type="text" id="w191pcn" placeholder="Name" value="' + E(P.coordinator_name || '') + '"></div><div><label class="f">Email</label><input type="text" id="w191pce" placeholder="name@company.com" value="' + E(P.coordinator_email || '') + '"></div><div><label class="f">Phone</label><input type="text" id="w191pcp" placeholder="514-555-0100" value="' + E(P.coordinator_phone || '') + '"></div></div>'
      + '<label class="f">How many of theirs, by role (they cover these; we fill the rest)</label><div class="w191pnum">' + PROLES.map(function (x) { return '<label><span>' + E(x[1]) + '</span><input type="number" min="0" max="100" data-w191pc="' + x[0] + '" value="' + E(c[x[0]] || '') + '" placeholder="0"></label>'; }).join('')
      + '<label><span>In all</span><input type="number" min="0" max="500" id="w191ph" value="' + E(P.headcount == null ? '' : P.headcount) + '" placeholder="people"></label></div>'
      + '<label class="f">Note (for the team)</label><textarea id="w191pnote" placeholder="Anything the team should know">' + E(P.note || '') + '</textarea>'
      + (P.route === 'everyone' ? '<label class="row" style="border:none"><input type="checkbox" id="w191pso"' + (P.signup_open === false ? '' : ' checked') + '> The form is open to new sign-ups</label>' : '')
      + '<div class="warn" id="w191perr" style="display:none"></div>'
      + '<div class="foot">' + (P.event_id && P.active ? '<button class="w191btn ghost" data-w191pend="1" style="margin-right:auto">No longer a collaboration</button>' : '') + '<button class="w191btn ghost" onclick="closeModal()">Cancel</button><button class="w191btn gold" data-w191psave="1">Save the collaboration</button></div></div>';
    openModal(html);
  }
  async function partnerSave(btn, end) {
    var ev = curEv(); if (!ev) return;
    var q = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var p;
    if (end) p = { active: false };
    else {
      var sel = q('w191pp'); var covers = {};
      Array.prototype.forEach.call(document.querySelectorAll('[data-w191pc]'), function (el) { var v = String(el.value || '').trim(); if (v !== '') covers[el.getAttribute('data-w191pc')] = Number(v); });
      var f = document.querySelector('input[name="w191pf"]:checked'), r = document.querySelector('input[name="w191pr"]:checked');
      var so = document.getElementById('w191pso');
      p = { partner_id: sel && sel !== 'other' ? Number(sel) : null, partner_name: sel === 'other' ? q('w191pn') : '', food: f ? f.value : 'ours', kitchen_place: q('w191pk'), route: r ? r.value : 'coordinator',
        coordinator_name: q('w191pcn'), coordinator_email: q('w191pce'), coordinator_phone: q('w191pcp'), headcount: q('w191ph') === '' ? null : Number(q('w191ph')), covers: covers, note: q('w191pnote'), signup_open: so ? so.checked : true };
    }
    btn.disabled = true;
    try {
      var res = await db.rpc('wa191_partner_save', { p_event: ev.id, p: p });
      if (res.error) throw res.error;
      PART.by[ev.id] = res.data && res.data.active === false ? Object.assign({}, PART.by[ev.id] || {}, { active: false }) : res.data; PART.at[ev.id] = Date.now();
      if (!end && (p.food === 'desta_kitchen' || p.food === 'their_kitchen')) { ev.format = 'community_kitchen'; try { await loadEvRow(ev, true); } catch (e) { /* fine */ } }
      closeModal(); T(end ? 'No longer a collaboration' : 'The collaboration is saved');
      var box = document.getElementById('w191partner'); if (box) box.__h = '';
      refresh(false); paintPartner();
    } catch (e) {
      btn.disabled = false;
      var w = document.getElementById('w191perr'); var msg = String((e && e.message) || e).replace(/^.*?ERROR:\s*/, '').slice(0, 200);
      if (w) { w.style.display = ''; w.textContent = msg; } else T('Could not save: ' + msg);
    }
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('.w191pm')) return;
    if (t.id === 'w191pp') { var n = document.getElementById('w191pn'); if (n) n.style.display = t.value === 'other' ? '' : 'none'; }
    if (t.name === 'w191pf') { var kw = document.getElementById('w191pkw'); if (kw) kw.style.display = t.value === 'desta_kitchen' || t.value === 'their_kitchen' ? '' : 'none'; }
    if (t.name === 'w191pf' || t.name === 'w191pr') { var grp = t.closest('.modes'); if (grp) grp.querySelectorAll('label').forEach(function (l) { l.classList.toggle('on', !!l.querySelector('input:checked')); }); }
  });
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var s = t.closest('[data-w191psave]'); if (s) { e.preventDefault(); partnerSave(s, false); return; }
    var x = t.closest('[data-w191pend]'); if (x) { e.preventDefault(); partnerSave(x, true); return; }
    var c = t.closest('[data-w191pcopy]'); if (c) { e.preventDefault(); var link = c.getAttribute('data-w191pcopy'); try { navigator.clipboard.writeText(link).then(function () { T('The form link is copied'); }, function () { T(link); }); } catch (err) { T(link); } }
  }, true);
