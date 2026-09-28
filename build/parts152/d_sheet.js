  /* ======================= a contact's page (#crm/c/<id>) ======================= */
  var lastFocus = null;
  function openSheet(html, tag, narrow) {
    var o = document.getElementById('w152sheet');
    if (!o) {
      o = document.createElement('div'); o.id = 'w152sheet'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
      document.body.appendChild(o);
      o.addEventListener('click', function (e) { if (e.target === o) closeSheet(); });
    }
    if (!S.sheet) lastFocus = document.activeElement;
    var same = S.sheet === tag;
    S.sheet = tag || 'sheet';
    var keep = same ? o.scrollTop : 0;
    o.innerHTML = '<div class="sh' + (narrow ? ' narrow' : '') + '"><button class="xb" data-w152close="1" aria-label="Close">' + I('x') + '</button>' + html + '</div>';
    o.style.display = 'flex';
    o.scrollTop = keep;
    if (!same) { var f = o.querySelector('.w152form input,.w152form select,.w152form textarea') || o.querySelector('.xb'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }
  }
  /* closing a contact puts the address back to the list (no page repaint) */
  function closeSheet(quiet) {
    var o = document.getElementById('w152sheet'); if (o) { o.style.display = 'none'; o.innerHTML = ''; }
    S.sheet = null; S.confirm = null;
    if (!quiet && /^#crm\/c\//.test(location.hash)) { try { history.replaceState(null, '', '#crm'); } catch (e) { /* fine */ } }
    if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    lastFocus = null;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.sheet) closeSheet(); });

  function loadDetail(c) {
    var id = String(c.id);
    var q = function (p) { return Promise.resolve(p).then(function (r) { return (r && !r.error && r.data) || []; }, function () { return []; }); };
    return Promise.all([
      q(db.from('crm_interactions').select('*').eq('contact_id', c.id).order('occurred_at', { ascending: false }).limit(300)),
      q(db.from('crm_donations').select('id,amount,currency,donated_at,platform,campaign,designation,recurring,receipt_number,receipt_issued_at,receipt_url,notes').eq('contact_id', c.id).order('donated_at', { ascending: false }).limit(300)),
      q(db.from('crm_volunteer_history').select('*').eq('contact_id', c.id).order('event_at', { ascending: false }).limit(500)),
      c.volunteer_id ? q(db.from('event_roster').select('id,event_id,person_id,role,status,confirmed_at,detail').eq('person_id', c.volunteer_id).limit(500)) : Promise.resolve([]),
      q(db.from('crm_contact_orgs').select('*').eq('contact_id', c.id)),
      load('partners'),
      q(db.from('crm_contact_fields').select('field_id,value,source,updated_at').eq('contact_id', c.id)),
      load('cfields')
    ]).then(function (r) {
      var roster = r[3].filter(function (x) { return String(x.person_id) === String(c.volunteer_id); });
      var ids = uniq(roster.map(function (x) { return String(x.event_id); }));
      var evs = ids.length ? q(db.from('volunteer_events').select('id,event_date,title,location,status,kind,code').in('id', ids.map(Number))) : Promise.resolve([]);
      return evs.then(function (events) {
        S.detail[id] = { ints: r[0], gifts: r[1], hist: r[2], roster: roster, events: events, orgs: r[4], fields: r[6] || [], at: Date.now() };
        return S.detail[id];
      });
    });
  }

  function partnerOf(id) { return (S.partners || []).filter(function (p) { return String(p.id) === String(id); })[0] || null; }
  function sourceName(s) { return (SOURCES[s] || [s ? String(s).replace(/_/g, ' ') : 'Unknown'])[0]; }
  function langName(l) { var x = LANGS.filter(function (o) { return o[0] === l; })[0]; return x ? x[1] : (l || ''); }
  function telOf(p) { var d = digits(p); if (d.length === 10) d = '1' + d; return d ? '+' + d : ''; }

  function detailsHtml(c) {
    var rows = [];
    if (c.emails.length) rows.push(['Email', c.emails.map(function (e) { return '<a href="mailto:' + E(e) + '">' + E(e) + '</a>'; }).join('<br>')]);
    if (c.phones.length) rows.push(['Phone', c.phones.map(function (p) { return telOf(p) ? '<a href="tel:' + E(telOf(p)) + '">' + E(p) + '</a>' : E(p); }).join('<br>')]);
    var place = [c.address, [c.city, c.province].filter(Boolean).join(', '), c.postal_code].filter(Boolean).join(' · ');
    if (place) rows.push(['Address', E(place)]);
    if (c.language) rows.push(['Language', E(langName(c.language))]);
    if (c.volunteer_organization) rows.push(['School or work', E(c.volunteer_organization)]);
    return rows.length ? '<div class="w152kv">' + rows.map(function (r) { return '<b>' + r[0] + '</b><span>' + r[1] + '</span>'; }).join('') + '</div>' : '<p class="w152pnote">No details yet.</p>';
  }
  function withUsHtml(c, d) {
    var out = [];
    if (c.kinds.indexOf('volunteer') >= 0 || c.volunteer_id) {
      if (c._roles.length) out.push('<div class="w152line">' + c._roles.map(function (r) { return '<span class="w152rl">' + E(roleName(r)) + '</span>'; }).join(' ') + '</div>');
      var hs = Number(c.hub_servings) || 0, ls = Number(c.legacy_servings) || 0, lh = Number(c.legacy_hours) || 0;
      out.push('<div class="w152line">' + (hs ? '<b>' + plural(hs, 'serving', 'servings') + '</b> with us (MTL volunteering)' + (c.last_serving_on ? ', the last on ' + E(fmtDay(c.last_serving_on)) : '') + (lh && !ls ? ' · ' + lh.toLocaleString('en-CA') + ' hours on the old website’s records' : '') : 'No serving with us yet') + '</div>');
      if (ls) out.push('<div class="w152line"><b>' + plural(ls, 'serving', 'servings') + '</b> on the old website, not yet in MTL volunteering' + (lh ? ' (' + lh.toLocaleString('en-CA') + ' hours)' : '') + '</div>');
      if (c.last_applied) out.push('<div class="w152line"><span class="m">Last signed up on the old website on ' + E(fmtDay(c.last_applied)) + '</span></div>');
      if (c.volunteer_needs_review) out.push('<div class="w152line" style="color:' + FLAG + '">' + I('alert') + ' Their volunteer record needs a review in MTL volunteering.</div>');
    }
    if (Number(c.donation_count) > 0) out.push('<div class="w152line"><b>' + money(c.donation_total) + '</b> over ' + plural(Number(c.donation_count), 'gift', 'gifts') + (c.last_donation_at ? ', the last on ' + E(fmtDay(c.last_donation_at)) : '') + '</div>');
    if (c.kinds.indexOf('staff') >= 0 || c.kinds.indexOf('alumni') >= 0) out.push('<div class="w152line">' + (c.kinds.indexOf('staff') >= 0 ? 'On the team' : 'Was on the team') + ' (the Hub roster)</div>');
    /* organizations from Partners */
    var orgs = (d && d.orgs) || [];
    out.push('<div class="w152orgs">' + (orgs.length ? orgs.map(function (o) {
      var p = partnerOf(o.partner_id); var nm = p ? p.name : (c.org_names[0] || 'An organization');
      return '<div class="w152line">' + I('hand') + ' <button class="w152mini" style="padding:0" data-w152go="#partners/' + E(o.partner_id) + '">' + E(nm) + '</button>' + (o.role_title ? ' <span class="m">' + E(o.role_title) + '</span>' : '') +
        ' <button class="w152mini" data-w152unlink="' + E(o.id) + '" aria-label="Unlink ' + E(nm) + '">' + I('x') + '</button></div>';
    }).join('') : (d ? '' : c.org_names.map(function (n) { return '<div class="w152line">' + I('hand') + ' ' + E(n) + '</div>'; }).join(''))) + '</div>');
    /* what Keela knew (the export of 27/09/26) */
    var K = c.legacy_refs && c.legacy_refs.keela;
    if (K && typeof K === 'object') {
      var kl = [];
      var pos = arr(K.positions).map(function (p) { return String(p).replace(/^Volunteer\s+/i, ''); });
      if (pos.length) kl.push('chose ' + listJoin(pos));
      if (K.try_out_date) kl.push('try-out ' + fmtDay(K.try_out_date));
      var dv = arr(K.dates_volunteered).map(function (d) { return fmtDay(String(d).slice(0, 10)); }).filter(Boolean);
      if (dv.length) kl.push('volunteered ' + (dv.length > 4 ? plural(dv.length, 'time', 'times') + ', last ' + dv[dv.length - 1] : listJoin(dv)));
      var av = arr(K.availability); if (av.length) kl.push('available ' + listJoin(av.slice(0, 3)) + (av.length > 3 ? ' and ' + (av.length - 3) + ' more' : ''));
      if (K.rally_paper_team) kl.push('Rally Paper: ' + K.rally_paper_team);
      if (K.assignee) kl.push('looked after by ' + K.assignee);
      var em = K.email_marketing;
      if (em && em.sent) kl.push('opened ' + (Number(em.opened) || 0) + ' of ' + em.sent + ' newsletters' + (em.last_opened ? ', last on ' + fmtDay(em.last_opened) : ''));
      if (kl.length) out.push('<div class="w152line"><span class="m">From Keela: ' + E(kl.join(' · ')) + '</span></div>');
    }
    var links = [];
    links.push('<button class="w152mini" data-w152linkorg="' + E(c.id) + '">' + I('link') + 'Link an organization</button>');
    if (c.volunteer_id) links.push('<button class="w152mini" data-w152go="#volunteering/people">' + I('arrow') + 'MTL volunteering</button>');
    var mem = c.member_id && typeof MEMBER_BY_ID !== 'undefined' && MEMBER_BY_ID ? MEMBER_BY_ID[c.member_id] : null;
    if (mem && mem.name) links.push('<button class="w152mini" data-w152go="#person/' + E(encodeURIComponent(mem.name)) + '">' + I('arrow') + 'Their Hub profile</button>');
    out.push('<div class="w152line">' + links.join(' ') + '</div>');
    return out.join('');
  }
  function permHtml(c) {
    var p = PERM[c._perm] || PERM.unknown, bits = [];
    if (c.email_consent === 'express' && (c.consent_source || c.consent_at)) bits.push('Given ' + [c.consent_source ? '(' + c.consent_source + ')' : '', c.consent_at ? 'on ' + fmtDay(c.consent_at) : ''].filter(Boolean).join(' '));
    if (c.email_consent === 'implied' && c.implied_consent_until) bits.push((dayOf(c.implied_consent_until) >= today() ? 'Runs until ' : 'Ran out on ') + fmtDay(c.implied_consent_until) + (c.consent_source ? ' (' + c.consent_source + ')' : ''));
    if (c._perm === 'unknown' && c.email_consent === 'implied') bits.push('Their implied consent ran out' + (c.implied_consent_until ? ' on ' + fmtDay(c.implied_consent_until) : '') + '.');
    return '<div class="w152line">' + permChip(c._perm) + ' <span class="m">' + E(p[2]) + '</span></div>' + (bits.length ? '<div class="w152line m">' + E(bits.join(' · ')) + '</div>' : '') +
      permLine(c) +
      (c.sms_opt_out ? '<div class="w152line m">No text messages, they asked.</div>' : '') +
      '<p class="w152pnote">Canada\u2019s anti-spam law (CASL): newsletters and appeals need their express consent, or an implied consent that has not run out (two years after a gift or a serving; Welfare Avenue is a registered charity). Confirmations, reminders and receipts are not commercial messages and still go out; a bouncing address stops everything.</p>';
  }
  function tagsHtml(c) {
    return '<div class="w152tags">' + c.tags.map(function (t) { return '<span class="w152tg">' + I('tag') + E(t) + '<button data-w152untag="' + E(t) + '" aria-label="Remove the tag ' + E(t) + '">×</button></span>'; }).join('') +
      '<input data-w152tagin="' + E(c.id) + '" placeholder="Add a tag" aria-label="Add a tag" maxlength="40"></div>';
  }
  /* one timeline: what was logged here, the gifts, the old website's history, the Hub's rosters */
  function timeline(c, d) {
    var out = [];
    var ICON = { note: 'note', call: 'phone', meeting: 'people', email: 'mail', sms: 'chat', website_message: 'mail', form: 'note' };
    (d.ints || []).forEach(function (x) {
      var k = lower(x.kind), dir = lower(x.direction), undated = !!(x.meta && x.meta.undated);
      var t = k === 'note' ? 'Note' : k === 'call' ? (dir === 'in' ? 'They called' : 'Call') : k === 'meeting' ? 'Meeting' : k === 'email' ? (dir === 'in' ? 'Email from them' : 'Email to them') :
        k === 'sms' ? (dir === 'in' ? 'Text from them' : 'Text message') : k === 'website_message' ? (undated ? 'Message from the old website' : 'Message from the website') : (x.subject || k || 'Activity');
      var mine = lower(x.created_by) === myEmail() && lower(x.source) === 'hub';
      var system = /^(crm_sync|wa\d+_import|mail-unsubscribe|mail-events)$/.test(String(x.created_by || ''));
      var sent = lower(x.source) === 'resend' && x.meta && x.meta.send_id; /* wave154: an email the Hub sent, with what happened to it */
      var hubForm = lower(x.source) === 'hub_form'; /* wave156: an answer to one of the CRM's forms */
      out.push({ at: x.occurred_at || x.created_at, undated: undated, icon: hubForm ? 'form' : (ICON[k] || 'note'), t: t + (x.subject && x.subject !== t ? ': ' + x.subject : ''), p: sent ? '' : (x.body || ''), pre: hubForm,
        st: sent ? (x.meta.status || 'sent') : '', by: hubForm ? 'The form at hub.welfareavenue.com/f/' + ((x.meta && x.meta.slug) || '') : sent ? 'Sent from the Hub' + (x.meta.template_name ? ' (' + x.meta.template_name + ')' : '') + (x.created_by && x.created_by !== 'automation' ? ' by ' + x.created_by : '') :
        system ? (undated ? 'The old website (the form kept no date)' : (x.created_by === 'mail-unsubscribe' ? 'Their unsubscribe link' : '')) : (x.created_by || ''), del: !sent && (mine || amAdmin()) ? x.id : null });
    });
    (d.gifts || []).forEach(function (g) {
      out.push({ at: g.donated_at, icon: 'heart', t: money(g.amount) + (g.recurring ? ' monthly gift' : ' gift'),
        p: [g.campaign, g.designation, g.platform ? 'through ' + (g.platform.charAt(0).toUpperCase() + g.platform.slice(1)) : ''].filter(Boolean).join(' · '),
        rc: g.receipt_number ? 'Tax receipt ' + g.receipt_number : '', rcUrl: g.receipt_url || '' });
    });
    (d.hist || []).forEach(function (h) {
      if (h.attended && h.volunteer_event_id) return; /* served: the Hub roster has it (the old website's events are in MTL volunteering) */
      var role = h.position ? roleName(lower(h.position)) : 'a volunteer';
      var t = h.attended ? 'Served as ' + role : h.withdrawn ? 'Withdrew' : h.waitlisted ? 'On the waiting list' : h.confirmed ? 'Confirmed as ' + role : h.approved ? 'Approved as ' + role : 'Signed up as ' + role;
      out.push({ at: h.event_at, icon: 'hand2', t: t, p: [h.event_title, h.location || h.city].filter(Boolean).join(' · ') + (h.attended && Number(h.hours) ? ' · ' + Number(h.hours) + ' hours' : ''), faint: !h.attended, by: 'The old website' });
    });
    var EV = {}; (d.events || []).forEach(function (e) { EV[String(e.id)] = e; });
    (d.roster || []).forEach(function (r) {
      var e = EV[String(r.event_id)]; if (!e || lower(e.status) === 'cancelled') return;
      var st = r.status || '', role = roleName(r.role), past = lower(e.status) === 'completed' || (dayOf(e.event_date) && dayOf(e.event_date) < today());
      var t;
      if (st === 'Confirmed') t = past ? (lower(e.status) === 'completed' ? 'Served as ' + role : 'Down as ' + role) : 'Confirmed as ' + role;
      else if (st === 'Waiting For Response') { if (past) return; t = 'Asked to come as ' + role; }
      else if (st === 'Unavailable') t = 'Could not come (' + role + ')';
      else if (st === 'TBD' && r.detail && r.detail.source === 'hub_form') { if (past) return; t = 'Signed up as ' + role + ' through a form (to confirm)'; }
      else return;
      var nm = e.title || (lower(e.kind) === 'service' || !e.kind ? 'Serving' : e.kind);
      var old = r.detail && r.detail.source === 'old website';
      out.push({ at: e.event_date, icon: 'hand2', t: t, p: [nm, e.location].filter(Boolean).join(' · ') + (old && Number(r.detail.hours) ? ' · ' + Number(r.detail.hours) + ' hours' : ''), faint: st !== 'Confirmed', by: old ? 'The old website, now in MTL volunteering' : 'MTL volunteering' });
    });
    out.sort(function (a, b) { return ((a.undated ? 1 : 0) - (b.undated ? 1 : 0)) || String(dayOf(b.at)).localeCompare(String(dayOf(a.at))) || String(b.at || '').localeCompare(String(a.at || '')); });
    return out;
  }
  function logFormHtml(c) {
    return '<div class="w152log"><div class="r"><select data-w152logk aria-label="What happened">' + LOG_ORDER.map(function (k) { return '<option value="' + k + '">' + E(LOGS[k][2]) + '</option>'; }).join('') + '</select>' +
      '<input type="date" data-w152logd value="' + E(today()) + '" max="' + E(today()) + '" aria-label="When"></div>' +
      '<textarea data-w152logt placeholder="What happened, or what to remember next time" aria-label="Note"></textarea>' +
      '<div class="r" style="justify-content:space-between"><span class="w152err" data-w152logerr></span><button class="w152btn sm" data-w152log="' + E(c.id) + '">' + I('check') + ' Save to the timeline</button></div></div>';
  }
  function timelineHtml(c, d) {
    if (!d) return logFormHtml(c) + busy('Loading their history…');
    var items = timeline(c, d);
    return logFormHtml(c) + (items.length ? '<ul class="w152tl">' + items.map(function (x) {
      return '<li class="w152it' + (x.faint ? ' faint' : '') + '"><span class="ic">' + I(x.icon) + '</span><div><div class="t">' + E(x.t) + (x.st ? '<span class="w154st" style="background:' + (MSTATUS[x.st] || MSTATUS.sent)[1] + '1a;color:' + (MSTATUS[x.st] || MSTATUS.sent)[1] + '">' + E((MSTATUS[x.st] || [x.st])[0]) + '</span>' : '') + '<span class="d">' + (x.undated ? 'date not recorded' : E(fmtDay(x.at)) + (dayOf(x.at) >= today() && dayOf(x.at) !== today() ? ' (' + E(ago(x.at)) + ')' : '')) + '</span></div>' +
        (x.p ? '<p' + (x.pre ? ' class="pre"' : '') + '>' + E(x.p) + '</p>' : '') + (x.rc ? '<div class="by">' + (x.rcUrl ? '<a class="w152mini" style="padding:0" href="' + E(x.rcUrl) + '" target="_blank" rel="noopener">' + E(x.rc) + ' ' + I('ext') + '</a>' : E(x.rc)) + '</div>' : '') +
        (x.by || x.del ? '<div class="by">' + (x.by ? '<span>' + E(x.by) + '</span>' : '') + (x.del ? '<button class="w152mini" data-w152delint="' + E(x.del) + '">' + I('trash') + 'Delete</button>' : '') + '</div>' : '') + '</div></li>';
    }).join('') + '</ul>' : '<p class="w152pnote">Nothing on their timeline yet.</p>');
  }
  /* wave156: custom fields (a form's answers, Keela's fields) */
  function moreHtml(d) {
    var defs = {}; (S.cfields || []).forEach(function (f) { defs[String(f.id)] = f; });
    var rows = (d.fields || []).map(function (v) { var f = defs[String(v.field_id)]; return f && !f.archived_at ? { f: f, v: v } : null; }).filter(Boolean)
      .sort(function (a, b) { return (a.f.sort - b.f.sort) || (a.f.id - b.f.id); });
    if (!rows.length) return '';
    return '<div class="w156more">' + rows.map(function (x) {
      var val = x.v.value, txt = x.f.type === 'yes_no' || typeof val === 'boolean' ? (val === true || val === 'yes' ? 'Yes' : 'No') : Array.isArray(val) ? val.join(', ') : String(val == null ? '' : val);
      return '<div class="w152kv"><span>' + E(x.f.label) + '</span><span' + (x.f.type === 'long_text' ? ' style="white-space:pre-wrap"' : '') + '>' + E(txt) + '</span></div>';
    }).join('') + '</div>';
  }
  function contactHtml(c, d) {
    var srcLine = 'From ' + sourceName(c.source) + (c.created_at ? ' · in the CRM since ' + fmtDay(c.created_at) : '');
    var qa = [];
    if (c.emails[0]) qa.push('<a class="w152btn soft sm" href="mailto:' + E(c.emails[0]) + '">' + I('mail') + ' Email</a>');
    if (c.phones[0] && telOf(c.phones[0])) { qa.push('<a class="w152btn soft sm" href="tel:' + E(telOf(c.phones[0])) + '">' + I('phone') + ' Call</a>'); if (!c.sms_opt_out) qa.push('<a class="w152btn soft sm" href="sms:' + E(telOf(c.phones[0])) + '">' + I('chat') + ' Text</a>'); }
    if (c.emails[0]) qa.push('<button class="w152btn ghost sm" data-w152copy="' + E(c.emails[0]) + '">' + I('copy') + ' Copy the email</button>');
    if (c.emails[0] && lower(c.email_status) !== 'bounced' && lower(c.email_status) !== 'complained') qa.push('<button class="w152btn soft sm" data-w154send="' + E(c.id) + '">' + I('spark') + ' Send an email from the Hub</button>');
    return '<div class="w152hd">' + avatar(c, true) + '<div style="min-width:0"><h2>' + E(c.full_name) + '</h2><div class="ks">' + kindsHtml(c) + permChip(c._perm) + '</div><div class="sub">' + E(srcLine) + '</div></div></div>' +
      (qa.length ? '<div class="w152qa">' + qa.join('') + '</div>' : '') +
      '<div class="w152cols"><div>' +
      '<div class="w152sec"><h4>Contact details <button class="w152mini" data-w152edit="' + E(c.id) + '">' + I('edit') + 'Edit</button></h4>' + detailsHtml(c) + '</div>' +
      '<div class="w152sec"><h4>With Welfare Avenue</h4>' + withUsHtml(c, d) + '</div>' +
      '<div class="w152sec"><h4>Email permission <button class="w152mini" data-w152perm-edit="' + E(c.id) + '">' + I('shield') + 'Change</button></h4>' + permHtml(c) + '</div>' +
      '<div class="w152sec"><h4>Tags</h4>' + tagsHtml(c) + '</div>' +
      (d && d.fields && moreHtml(d) ? '<div class="w152sec"><h4>More about them</h4>' + moreHtml(d) + '</div>' : '') +
      (c.notes ? '<div class="w152sec"><h4>Good to know</h4><p class="w152line" style="white-space:pre-wrap">' + E(c.notes) + '</p></div>' : '') +
      '</div><div><div class="w152sec"><h4>Timeline</h4>' + timelineHtml(c, d) + '</div></div></div>';
  }
  function contactSheet(id, refresh) {
    var c = contact(id);
    if (!c) {
      if (S.contacts) { toastS('That contact is not in the CRM any more (merged, or never there)'); if (/^#crm\/c\//.test(location.hash)) { try { history.replaceState(null, '', '#crm'); } catch (e) { /* fine */ } } }
      return;
    }
    var tag = 'c:' + c.id, d = S.detail[String(c.id)];
    openSheet(contactHtml(c, d), tag);
    if (!d || refresh) loadDetail(c).then(function (dd) { if (S.sheet === tag) openSheet(contactHtml(contact(id) || c, dd), tag); });
  }
  /* a list repaint behind the sheet keeps the list true after an edit */
  function repaintBehind() { try { if (document.getElementById('crm') && document.getElementById('crm').classList.contains('active')) paint(); } catch (e) { /* fine */ } }

  /* ---------- the forms ---------- */
  function field(label, html, full, hint) { return '<label' + (full ? ' class="full"' : '') + '>' + E(label) + (hint ? ' <span class="hint">' + E(hint) + '</span>' : '') + html + '</label>'; }
  function inp(name, val, ph, type) { return '<input data-f="' + name + '"' + (type ? ' type="' + type + '"' : '') + ' value="' + E(val == null ? '' : val) + '"' + (ph ? ' placeholder="' + E(ph) + '"' : '') + '>'; }
  function area(name, val, ph) { return '<textarea data-f="' + name + '"' + (ph ? ' placeholder="' + E(ph) + '"' : '') + '>' + E(val == null ? '' : val) + '</textarea>'; }
  function sel(name, list, cur) { return '<select data-f="' + name + '">' + opts(list, cur) + '</select>'; }
  function formVals() {
    var o = document.getElementById('w152sheet'), v = {}, ks = [];
    if (!o) return v;
    o.querySelectorAll('[data-f]').forEach(function (el) { v[el.getAttribute('data-f')] = el.type === 'checkbox' ? el.checked : String(el.value || '').trim(); });
    o.querySelectorAll('[data-fk]').forEach(function (el) { if (el.checked) ks.push(el.getAttribute('data-fk')); });
    v._kinds = ks;
    return v;
  }
  function showErr(m) { var el = document.querySelector('#w152sheet [data-w152err]'); if (el) el.textContent = m; }
  function splitList(s) { return String(s || '').split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  var EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
  function nameParts(n) { var p = String(n || '').trim().split(/\s+/); return { first: p[0] || null, last: p.length > 1 ? p.slice(1).join(' ') : null }; }
  function kindsBoxes(c, isNew) {
    var fixed = [];
    if (!isNew && c && c.volunteer_id) fixed.push('Volunteer (from MTL volunteering)');
    if (!isNew && c && c.kinds.indexOf('staff') >= 0) fixed.push('Staff (from the roster)');
    if (!isNew && c && c.kinds.indexOf('alumni') >= 0) fixed.push('Alumni (from the roster)');
    var list = (isNew ? ['volunteer'] : []).concat(KIND_HAND);
    var cur = c ? c.kinds : [];
    return '<div class="kinds">' + list.map(function (k) { return '<label><input type="checkbox" data-fk="' + k + '"' + (cur.indexOf(k) >= 0 ? ' checked' : '') + '> ' + E(KINDS[k][0]) + '</label>'; }).join('') +
      (fixed.length ? '<span class="w152count">' + E(fixed.join(' · ')) + '</span>' : '') + '</div>';
  }
  function editForm(id) {
    var c = id ? contact(id) : null, isNew = !c;
    var x = c || { full_name: '', emails: [], phones: [], kinds: [], tags: [] };
    var html = '<h2>' + (isNew ? 'Add a contact' : 'Edit ' + E(x.full_name)) + '</h2>' +
      '<div class="sub">' + (isNew ? 'Someone we know: a donor, a partner\u2019s contact, a supporter. A new volunteer also gets a volunteer record, so MTL volunteering sees them.' : 'Their details, as the whole team will see them.') + '</div>' +
      '<div class="w152form">' +
      (c && c.volunteer_id ? '<div class="note">' + I('link') + ' Their name, emails, phones and address are saved on their volunteer record as well, so MTL volunteering and the CRM stay the same person.</div>' : '') +
      field('Full name', inp('full_name', x.full_name, 'First and last name'), true) +
      field('Emails', inp('emails', x.emails.join(', '), 'name@example.com'), false, 'separated by commas; the first one is used') +
      field('Phones', inp('phones', x.phones.join(', '), '514 555 0123'), false, 'separated by commas') +
      field('Street address', inp('address', x.address), true) +
      field('City', inp('city', x.city, 'Montreal')) + field('Province', inp('province', x.province, 'QC')) +
      field('Postal code', inp('postal_code', x.postal_code, 'H2X 1Y4')) + field('Language', sel('language', LANGS, x.language || '')) +
      '<div class="full lbl">What they are to us' + kindsBoxes(c, isNew) + '</div>' +
      (isNew ? field('Email permission', sel('perm', [['', 'Not recorded'], ['express', 'Express consent: they said yes to our emails'], ['implied', 'Implied consent: a recent gift, membership or volunteering'], ['none', 'No consent']], ''), false) +
        field('Where it came from', inp('perm_source', '', 'e.g. signed up at the gala'), false) : '') +
      field('Good to know', area('notes', x.notes, 'Anything the team should know: how they like to be reached, who knows them best'), true) +
      '</div><div class="w152foot"><span class="w152err" data-w152err></span><button class="w152btn ghost" data-w152back="' + E(id || '') + '">Cancel</button>' +
      '<button class="w152btn" data-w152save="' + E(id || 'new') + '">' + I('check') + (isNew ? ' Add them' : ' Save') + '</button></div>';
    openSheet(html, isNew ? 'add' : 'edit:' + id, true);
  }
  function permForm(id) {
    var c = contact(id); if (!c) return;
    var until = c.implied_consent_until ? dayOf(c.implied_consent_until) : (c._last ? addYears(c._last, 2) : '');
    var html = '<h2>Email permission</h2><div class="sub">' + E(c.full_name) + '. What they agreed to, so newsletters and campaigns only go to people who said yes.</div><div class="w152form">' +
      field('Permission', sel('email_consent', [['', 'Not recorded'], ['express', 'Express consent: they said yes to our emails'], ['implied', 'Implied consent: an existing relationship'], ['none', 'No consent']], c.email_consent || ''), true) +
      field('Where it came from', inp('consent_source', c.consent_source, 'the website form, a sign-up sheet, an email'), true) +
      field('Date they said yes', inp('consent_at', c.consent_at ? dayOf(c.consent_at) : '', '', 'date'), false, 'express consent') +
      field('Implied consent runs until', inp('implied_consent_until', until, '', 'date'), false, 'two years after the last gift, membership or volunteering') +
      '<label class="chk full"><input type="checkbox" data-f="unsub"' + (c._perm === 'unsub' ? ' checked' : '') + '> They unsubscribed: no newsletters or campaigns</label>' +
      '<label class="chk full"><input type="checkbox" data-f="sms_opt_out"' + (c.sms_opt_out ? ' checked' : '') + '> No text messages</label>' +
      '<div class="note">Implied consent under CASL: an existing relationship in the last two years, such as a gift or volunteering for a registered charity, or a membership. It runs out two years after the last one. When in doubt, ask for express consent.</div>' +
      '</div><div class="w152foot"><span class="w152err" data-w152err></span><button class="w152btn ghost" data-w152back="' + E(id) + '">Cancel</button><button class="w152btn" data-w152savep="' + E(id) + '">' + I('check') + ' Save</button></div>';
    openSheet(html, 'perm:' + id, true);
  }
  function orgForm(id) {
    var c = contact(id); if (!c) return;
    load('partners').then(function (ps) {
      if (S.sheet !== 'c:' + id && S.sheet !== 'org:' + id) return;
      var list = (ps || []).filter(function (p) { return p.status !== 'declined'; });
      var html = '<h2>Link an organization</h2><div class="sub">' + E(c.full_name) + ' and an organization from Partners: a sponsor\u2019s contact, a school\u2019s club president, a funder\u2019s program officer.</div><div class="w152form">' +
        (list.length ? field('Organization', '<select data-f="partner_id"><option value="">Choose</option>' + list.map(function (p) { return '<option value="' + E(p.id) + '">' + E(p.name) + '</option>'; }).join('') + '</select>', true) +
          field('Their role there', inp('role_title', '', 'President, Program officer, Owner'), true) +
          '<label class="chk full"><input type="checkbox" data-f="is_primary"> Their main organization</label>'
          : '<div class="note">No organization in Partners yet. Add it on the Partners page first.</div>') +
        '</div><div class="w152foot"><span class="w152err" data-w152err></span><button class="w152btn ghost" data-w152back="' + E(id) + '">Cancel</button>' + (list.length ? '<button class="w152btn" data-w152saveorg="' + E(id) + '">' + I('check') + ' Link</button>' : '') + '</div>';
      openSheet(html, 'org:' + id, true);
    });
  }

  /* ---------- saving ---------- */
  async function audit(id, field, oldV, newV) {
    try { await db.from('change_log').insert({ entity_type: 'crm_contact', entity_id: String(id), field: field, old_value: oldV == null ? null : String(oldV).slice(0, 500), new_value: newV == null ? null : String(newV).slice(0, 500), changed_by: actor() }); } catch (e) { /* the audit trail is best effort */ }
  }
  /* the row after a save: the database's answer when there is one, else what we sent */
  function applyLocal(id, patch) {
    var c = contact(id); if (!c) return null;
    Object.keys(patch).forEach(function (k) { c[k] = patch[k]; });
    if (patch.emails) c.primary_email = (patch.emails[0] || '').toLowerCase() || null;
    shape(c);
    return c;
  }
  async function saveContact(id) {
    var v = formVals(), isNew = id === 'new';
    var c = isNew ? null : contact(id);
    if (!v.full_name) { showErr('Give their name.'); return; }
    var emails = uniq(splitList(v.emails).map(function (e) { return e.toLowerCase(); }));
    var bad = emails.filter(function (e) { return !EMAIL_RE.test(e); });
    if (bad.length) { showErr('This does not look like an email: ' + bad[0]); return; }
    var phones = uniq(splitList(v.phones));
    var np = nameParts(v.full_name);
    var fixedKinds = c ? c.kinds.filter(function (k) { return KIND_HAND.indexOf(k) < 0; }) : [];
    var kinds = uniq(fixedKinds.concat(v._kinds.filter(function (k) { return k !== 'volunteer' || isNew; })));
    var row = { full_name: v.full_name, first_name: np.first, last_name: np.last, emails: emails, phones: phones, address: v.address || null, city: v.city || null,
      province: v.province || null, postal_code: v.postal_code ? v.postal_code.toUpperCase() : null, language: v.language || null, kinds: kinds, notes: v.notes || null, updated_by: actor() };
    try {
      if (isNew) {
        /* the same person twice is the most common CRM mistake: stop at an email or a phone we already have */
        var byEmail = (S.contacts || []).filter(function (x) { return x.emails.some(function (e) { return emails.indexOf(lower(e)) >= 0; }); })[0];
        var byPhone = (S.contacts || []).filter(function (x) { return x._digits.some(function (d) { return phones.map(digits).indexOf(d) >= 0; }); })[0];
        var clash = byEmail || byPhone;
        var warn = function (html) {
          showErr('');
          var box = document.querySelector('#w152sheet .w152form'); if (!box) return;
          var old = box.querySelector('.w152warn'); if (old) old.remove();
          box.insertAdjacentHTML('afterbegin', '<div class="w152warn">' + html + '</div>');
        };
        if (byEmail && kinds.indexOf('volunteer') >= 0) {
          warn('<b>Already in the CRM.</b> ' + E(byEmail.full_name) + ' has this email, and a volunteer is added once. <button class="w152mini" data-w152open="' + E(byEmail.id) + '">Open ' + E(byEmail.full_name) + '</button>');
          return;
        }
        if (clash && S.confirm !== 'dup:' + clash.id) {
          S.confirm = 'dup:' + clash.id;
          warn('<b>Already in the CRM?</b> ' + E(clash.full_name) + ' has the same ' + (byEmail ? 'email' : 'phone') + '. <button class="w152mini" data-w152open="' + E(clash.id) + '">Open ' + E(clash.full_name) + '</button> or press Add them again to add a new contact anyway.');
          return;
        }
        row.source = 'hub'; row.created_by = actor();
        if (v.perm) { row.email_consent = v.perm; row.consent_source = v.perm_source || null; if (v.perm === 'express') row.consent_at = new Date().toISOString(); if (v.perm === 'implied') row.implied_consent_until = addYears(today(), 2); }
        var newId = null;
        if (kinds.indexOf('volunteer') >= 0) {
          /* a new volunteer: their volunteer record first; the database makes (or links) their contact from it */
          var vr = await db.from('volunteer_people').insert({ full_name: row.full_name, emails: emails, phones: phones, address: row.address, roles: [], tags: [] }).select('id');
          if (vr && vr.error) throw vr.error;
          var vid = vr && vr.data && vr.data[0] && vr.data[0].id;
          if (vid != null) {
            var cr = await db.from('crm_contacts').select('id').eq('volunteer_id', vid).limit(1);
            newId = cr && cr.data && cr.data[0] && cr.data[0].id;
            if (newId != null) {
              var ur = await db.from('crm_contacts').update(row).eq('id', newId).select('id');
              if (ur && ur.error) throw ur.error;
            }
          }
          row.volunteer_id = vid != null ? vid : null;
        }
        if (newId == null) {
          var ir = await db.from('crm_contacts').insert(row).select('id');
          if (ir && ir.error) throw ir.error;
          newId = ir && ir.data && ir.data[0] && ir.data[0].id;
        }
        if (newId == null) newId = 'tmp' + Date.now();
        var nc = shape(Object.assign({ id: newId, kinds: [], tags: [], emails: [], phones: [], created_at: new Date().toISOString(), hub_servings: 0, legacy_servings: 0, legacy_hours: 0, donation_total: 0, donation_count: 0, org_names: [], volunteer_roles: [], volunteer_tags: [] }, row));
        S.contacts.push(nc); BY_ID[String(nc.id)] = nc; S.confirm = null;
        audit(newId, 'created', null, row.full_name);
        S.detail[String(newId)] = { ints: [], gifts: [], hist: [], roster: [], events: [], orgs: [], at: Date.now() };
        toastS(row.full_name + ' is in the CRM');
        try { history.replaceState(null, '', '#crm/c/' + newId); } catch (e) { /* fine */ }
        contactSheet(newId); repaintBehind();
        return;
      }
      if (c.volunteer_id) {
        /* their volunteer record carries the name, emails, phones and address (MTL volunteering reads it) */
        var vu = await db.from('volunteer_people').update({ full_name: row.full_name, emails: emails, phones: phones, address: row.address }).eq('id', c.volunteer_id).select('id');
        if (vu && vu.error) throw vu.error;
      }
      var res = await db.from('crm_contacts').update(row).eq('id', c.id).select('id');
      if (res && res.error) throw res.error;
      if (res && Array.isArray(res.data) && !res.data.length) { showErr('Could not save: the CRM is not open to you.'); return; }
      var changed = ['full_name', 'emails', 'phones', 'address', 'city', 'province', 'postal_code', 'language', 'kinds', 'notes'].filter(function (k) { return JSON.stringify(c[k] == null ? null : c[k]) !== JSON.stringify(row[k] == null ? null : row[k]); });
      applyLocal(c.id, row);
      if (changed.length) audit(c.id, 'details', null, changed.join(', '));
      toastS('Saved'); contactSheet(c.id); repaintBehind();
    } catch (e) { showErr('Could not save: ' + String((e && e.message) || e).slice(0, 160)); }
  }
  async function savePerm(id) {
    var c = contact(id); if (!c) return;
    var v = formVals();
    var row = { email_consent: v.email_consent || null, consent_source: v.consent_source || null, updated_by: actor(), sms_opt_out: !!v.sms_opt_out };
    if (v.email_consent === 'express') row.consent_at = v.consent_at ? v.consent_at + 'T12:00:00Z' : (c.consent_at || new Date().toISOString());
    else row.consent_at = v.email_consent ? (c.consent_at || null) : null;
    if (v.email_consent === 'implied') { if (!v.implied_consent_until) { showErr('Say until when the implied consent runs (two years after the last gift or volunteering).'); return; } row.implied_consent_until = v.implied_consent_until; }
    else row.implied_consent_until = null;
    var st = lower(c.email_status);
    if (v.unsub) row.email_status = 'unsubscribed';
    else if (st === 'unsubscribed' || st === 'complained') row.email_status = 'unknown';
    try {
      var res = await db.from('crm_contacts').update(row).eq('id', c.id).select('id');
      if (res && res.error) throw res.error;
      if (res && Array.isArray(res.data) && !res.data.length) { showErr('Could not save: the CRM is not open to you.'); return; }
      var before = c._perm;
      applyLocal(c.id, row);
      audit(c.id, 'email_permission', PERM[before][0], PERM[c._perm][0] + (row.consent_source ? ' (' + row.consent_source + ')' : ''));
      toastS('Saved'); contactSheet(c.id); repaintBehind();
    } catch (e) { showErr('Could not save: ' + String((e && e.message) || e).slice(0, 160)); }
  }
  async function saveTags(id, tags) {
    var c = contact(id); if (!c) return;
    var before = c.tags.slice();
    try {
      var res = await db.from('crm_contacts').update({ tags: tags, updated_by: actor() }).eq('id', c.id).select('id');
      if (res && res.error) throw res.error;
      applyLocal(c.id, { tags: tags });
      audit(c.id, 'tags', before.join(', '), tags.join(', '));
      contactSheet(c.id); repaintBehind();
      var t = document.querySelector('#w152sheet [data-w152tagin]'); if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    } catch (e) { toastS('Could not save the tag: ' + String((e && e.message) || e).slice(0, 120)); }
  }
  async function saveLog(id) {
    var c = contact(id); if (!c) return;
    var o = document.getElementById('w152sheet'); if (!o) return;
    var k = (o.querySelector('[data-w152logk]') || {}).value || 'note', when = (o.querySelector('[data-w152logd]') || {}).value || today(), text = String((o.querySelector('[data-w152logt]') || {}).value || '').trim();
    var errEl = o.querySelector('[data-w152logerr]');
    if (!text) { if (errEl) errEl.textContent = 'Write what happened first.'; return; }
    if (when > today()) { if (errEl) errEl.textContent = 'That date is in the future.'; return; }
    var L = LOGS[k] || LOGS.note;
    var row = { contact_id: c.id, kind: L[0], direction: L[1], channel: L[0] === 'note' ? null : L[0], body: text, occurred_at: when === today() ? new Date().toISOString() : when + 'T12:00:00Z', source: 'hub', created_by: actor() };
    try {
      var res = await db.from('crm_interactions').insert(row).select('*');
      if (res && res.error) throw res.error;
      var saved = Object.assign({ id: 'tmp' + Date.now(), created_at: new Date().toISOString() }, row, (res && res.data && res.data[0]) || {});
      var d = S.detail[String(c.id)]; if (d) d.ints.unshift(saved);
      if (L[1] !== 'internal' && (!c.last_activity_at || String(row.occurred_at) > String(c.last_activity_at))) applyLocal(c.id, { last_activity_at: row.occurred_at });
      toastS('Saved to ' + (c.first_name || c.full_name) + '\u2019s timeline'); contactSheet(c.id); repaintBehind();
    } catch (e) { if (errEl) errEl.textContent = 'Could not save: ' + String((e && e.message) || e).slice(0, 140); }
  }
  async function deleteLog(id, intId) {
    var c = contact(id); if (!c) return;
    if (S.confirm !== 'del:' + intId) { S.confirm = 'del:' + intId; toastS('Press Delete again to remove it from the timeline'); return; }
    S.confirm = null;
    try {
      var res = await db.from('crm_interactions').delete().eq('id', intId).select('id');
      if (res && res.error) throw res.error;
      if (res && Array.isArray(res.data) && !res.data.length) { toastS('Only the person who wrote it (or an admin) can delete it'); return; }
      var d = S.detail[String(c.id)]; if (d) d.ints = d.ints.filter(function (x) { return String(x.id) !== String(intId); });
      audit(c.id, 'timeline', 'deleted an entry', null);
      toastS('Deleted'); contactSheet(c.id);
    } catch (e) { toastS('Could not delete: ' + String((e && e.message) || e).slice(0, 120)); }
  }
  async function saveOrg(id) {
    var c = contact(id); if (!c) return;
    var v = formVals();
    if (!v.partner_id) { showErr('Choose the organization.'); return; }
    var d = S.detail[String(c.id)];
    if (d && d.orgs.some(function (o) { return String(o.partner_id) === String(v.partner_id); })) { showErr('They are already linked to it.'); return; }
    var row = { contact_id: c.id, partner_id: Number(v.partner_id), role_title: v.role_title || null, is_primary: !!v.is_primary, created_by: actor() };
    try {
      var res = await db.from('crm_contact_orgs').insert(row).select('*');
      if (res && res.error) throw res.error;
      var saved = Object.assign({ id: 'tmp' + Date.now() }, row, (res && res.data && res.data[0]) || {});
      if (d) d.orgs.push(saved);
      var p = partnerOf(v.partner_id);
      if (p && c.org_names.indexOf(p.name) < 0) applyLocal(c.id, { org_names: c.org_names.concat([p.name]) });
      audit(c.id, 'organization', null, p ? p.name : v.partner_id);
      toastS('Linked'); contactSheet(c.id); repaintBehind();
    } catch (e) { showErr('Could not link: ' + String((e && e.message) || e).slice(0, 160)); }
  }
  async function unlinkOrg(linkId) {
    var id = String(S.sheet || '').replace(/^c:/, ''); var c = contact(id); if (!c) return;
    if (S.confirm !== 'unlink:' + linkId) { S.confirm = 'unlink:' + linkId; toastS('Press × again to unlink the organization'); return; }
    S.confirm = null;
    try {
      var res = await db.from('crm_contact_orgs').delete().eq('id', linkId).select('id');
      if (res && res.error) throw res.error;
      var d = S.detail[String(c.id)], gone = null;
      if (d) { gone = d.orgs.filter(function (o) { return String(o.id) === String(linkId); })[0]; d.orgs = d.orgs.filter(function (o) { return String(o.id) !== String(linkId); }); }
      var p = gone ? partnerOf(gone.partner_id) : null;
      if (p) applyLocal(c.id, { org_names: c.org_names.filter(function (n) { return n !== p.name; }) });
      audit(c.id, 'organization', p ? p.name : linkId, null);
      toastS('Unlinked'); contactSheet(c.id); repaintBehind();
    } catch (e) { toastS('Could not unlink: ' + String((e && e.message) || e).slice(0, 120)); }
  }
