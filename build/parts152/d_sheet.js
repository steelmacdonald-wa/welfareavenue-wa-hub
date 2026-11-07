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
    var fk = same ? focusKey(document.activeElement, o) : null;   /* task 10b: a repaint of the same sheet keeps the keyboard focus */
    o.innerHTML = '<div class="sh' + (narrow ? ' narrow' : '') + '"><button class="xb" data-w152close="1" aria-label="Close">' + I('x') + '</button>' + html + '</div>';
    o.style.display = 'flex';
    o.scrollTop = keep;
    if (fk) { var back = o.querySelector(fk); if (back) { try { back.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }
    if (!same) { var f = o.querySelector('.w152form input,.w152form select,.w152form textarea') || o.querySelector('.xb'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }
  }
  /* the element's own data attribute (data-w283dncr="5003", data-f="notes") finds it again after a repaint */
  function focusKey(el, root) {
    if (!el || !root || !root.contains(el) || !el.attributes) return null;
    for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (/^data-(w\d|f$)/.test(a.name)) return '[' + a.name + '="' + String(a.value).replace(/["\\]/g, '\\$&') + '"]'; }
    return null;
  }
  /* closing a contact puts the address back to the list (no page repaint) */
  function closeSheet(quiet) {
    var o = document.getElementById('w152sheet'); if (o) { o.style.display = 'none'; o.innerHTML = ''; }
    S.sheet = null; S.confirm = null; S.note = null; S.dnc = null; S.tl = null; if (S.rel && !S.rel.busy) S.rel = null;   /* wave293: the timeline's filters are page state */
    if (!quiet && /^#crm\/c\//.test(location.hash)) { try { history.replaceState(null, '', '#crm'); } catch (e) { /* fine */ } }
    if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    lastFocus = null;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !S.sheet) return;
    if (S.dnc && S.dnc.ask && S.sheet === 'c:' + S.dnc.id) { dncCancel(S.dnc.id); return; }   /* task 10b: Escape steps back out of the do-not-contact question first */
    closeSheet();
  });

  function loadDetail(c) {
    var id = String(c.id);
    var q = function (p) { return Promise.resolve(p).then(function (r) { return (r && !r.error && r.data) || []; }, function () { return []; }); };
    /* wave293: the email history (source gmail) has its own query, so a long correspondence never pushes notes and gifts off; with it the
       Relationship card's row (crm_email_relationship), its counts (crm_email_relationship_v) and two settings. Row security decides what comes
       back: Steel's mailbox lines and summaries reach admins only until mail_history_steel_open (wave292, H1). */
    var mail = Promise.all([
      q(db.from('crm_interactions').select('id,kind,direction,subject,body,occurred_at,source,source_ref,meta,created_by').eq('contact_id', c.id).eq('source', 'gmail').order('occurred_at', { ascending: false }).limit(600)),
      q(db.from('crm_email_relationship').select('rel_type,rel_conf,topics,open_item,summary,from_steel,stale,generated_at,generated_by').eq('contact_id', c.id).limit(1)),
      q(db.from('crm_email_relationship_v').select('*').eq('contact_id', c.id).limit(1)),
      q(db.from('app_config').select('key,value').in('key', ['mail_history_type_unsure', 'mail_history_steel_open']))
    ]);
    return Promise.all([
      q(db.from('crm_interactions').select('*').eq('contact_id', c.id).neq('source', 'gmail').order('occurred_at', { ascending: false }).limit(300)),
      q(db.from('crm_donations').select('id,amount,currency,donated_at,platform,campaign,designation,recurring,receipt_number,receipt_issued_at,receipt_url,notes').eq('contact_id', c.id).order('donated_at', { ascending: false }).limit(300)),
      q(db.from('crm_volunteer_history').select('*').eq('contact_id', c.id).order('event_at', { ascending: false }).limit(500)),
      c.volunteer_id ? q(db.from('event_roster').select('id,event_id,person_id,role,status,confirmed_at,detail').eq('person_id', c.volunteer_id).limit(500)) : Promise.resolve([]),
      q(db.from('crm_contact_orgs').select('*').eq('contact_id', c.id)),
      load('partners'),
      q(db.from('crm_contact_fields').select('field_id,value,source,updated_at').eq('contact_id', c.id)),
      load('cfields'),
      /* wave157: the automations they are in */
      q(db.from('crm_automation_runs').select('id,automation_id,status,step_id,next_at,is_test,started_at,finished_at').eq('contact_id', c.id).eq('is_test', false).order('started_at', { ascending: false }).limit(50)),
      load('autos'),
      /* wave283: the age band (never the date), their chapters, and for HR and admins the birth date */
      Promise.resolve(db.rpc('crm_age_band', { p_contact: Number(c.id) })).then(function (x) { return x && !x.error && typeof x.data === 'string' ? x.data : null; }, function () { return null; }),
      q(db.from('crm_contact_chapters').select('chapter,source').eq('contact_id', c.id)),
      load('chapters'),
      can('hr_private') ? q(db.from('crm_contact_private').select('birth_date').eq('contact_id', c.id).limit(1)) : Promise.resolve(null),
      mail
    ]).then(function (r) {
      var roster = r[3].filter(function (x) { return String(x.person_id) === String(c.volunteer_id); });
      var ids = uniq(roster.map(function (x) { return String(x.event_id); }));
      var evs = ids.length ? q(db.from('volunteer_events').select('id,event_date,title,location,status,kind,code').in('id', ids.map(Number))) : Promise.resolve([]);
      return evs.then(function (events) {
        var m = r[14] || [[], [], [], []], cfg = {};
        (m[3] || []).forEach(function (x) { cfg[x.key] = x.value; });
        S.detail[id] = { ints: (r[0] || []).filter(function (x) { return lower(x.source) !== 'gmail'; }), gifts: r[1], hist: r[2], roster: roster, events: events, orgs: r[4], fields: r[6] || [], runs: r[8] || [], at: Date.now(),
          age: r[10] || null, chapters: (r[11] || []).map(function (x) { return x.chapter; }),
          birth: r[13] ? ((r[13][0] && r[13][0].birth_date) || '') : null,
          /* wave293 */ mail: m[0] || [], rel: (m[1] || [])[0] || null, relv: (m[2] || [])[0] || null,
          unsure: isFinite(parseFloat(cfg.mail_history_type_unsure)) ? parseFloat(cfg.mail_history_type_unsure) : 0.5, steelOpen: String(cfg.mail_history_steel_open || '').trim() === 'true' };
        return S.detail[id];
      });
    });
  }

  function partnerOf(id) { return (S.partners || []).filter(function (p) { return String(p.id) === String(id); })[0] || null; }
  function sourceName(s) { return (SOURCES[s] || [s ? String(s).replace(/_/g, ' ') : 'Unknown'])[0]; }
  function langName(l) { var x = LANGS.filter(function (o) { return o[0] === l; })[0]; return x ? x[1] : (l || ''); }
  function telOf(p) { var d = digits(p); if (d.length === 10) d = '1' + d; return d ? '+' + d : ''; }

  /* wave283: the postal code is left out when the street address already holds it (compared without spaces, ignoring case) */
  function postalIn(addr, pc) { var a = String(addr || '').replace(/\s+/g, '').toLowerCase(), p = String(pc || '').replace(/\s+/g, '').toLowerCase(); return !!p && a.indexOf(p) >= 0; }
  function detailsHtml(c, d) {
    var rows = [];
    var dnc = !!c.do_not_contact;   /* task 10b: for a do-not-contact person the address and phone are text, not mailto or tel links */
    if (c.emails.length) rows.push(['Email', c.emails.map(function (e) { return dnc ? '<span class="w152txt">' + E(e) + '</span>' : '<a href="mailto:' + E(e) + '">' + E(e) + '</a>'; }).join('<br>')]);
    if (c.phones.length) rows.push(['Phone', c.phones.map(function (p) { return !dnc && telOf(p) ? '<a href="tel:' + E(telOf(p)) + '">' + E(p) + '</a>' : E(p); }).join('<br>')]);
    var place = [c.address, [c.city, c.province].filter(Boolean).join(', '), postalIn(c.address, c.postal_code) ? '' : c.postal_code].filter(Boolean).join(' · ');
    if (place) rows.push(['Address', E(place)]);
    if (c.job_title) rows.push(['Job title', E(c.job_title)]);   /* wave283 */
    if (d && d.age) rows.push(['Age', E(d.age)]);   /* wave283: crm_age_band, never the date */
    if (c.language) rows.push(['Language', E(langName(c.language))]);
    if (c.volunteer_organization) rows.push(['School or work', E(c.volunteer_organization)]);
    return rows.length ? '<div class="w152kv">' + rows.map(function (r) { return '<b>' + r[0] + '</b><span>' + r[1] + '</span>'; }).join('') + '</div>' : '<p class="w152pnote">No details yet.</p>';
  }
  function withUsHtml(c, d) {
    var out = [];
    if (c.kinds.indexOf('volunteer') >= 0 || c.volunteer_id) {
      if (c._roles.length) out.push('<div class="w152line">' + c._roles.map(function (r) { return '<span class="w152rl">' + E(roleName(r)) + '</span>'; }).join(' ') + '</div>');
      var hs = Number(c.hub_servings) || 0, ls = Number(c.legacy_servings) || 0, lh = Number(c.legacy_hours) || 0;
      out.push('<div class="w152line">' + (hs ? '<b>' + plural(hs, 'serving', 'servings') + '</b> with us (Volunteer Manager)' + (c.last_serving_on ? ', the last on ' + E(fmtDay(c.last_serving_on)) : '') + (lh && !ls ? ' · ' + lh.toLocaleString('en-CA') + ' hours on the old website’s records' : '') : 'No serving with us yet') + '</div>');
      if (ls) out.push('<div class="w152line"><b>' + plural(ls, 'serving', 'servings') + '</b> on the old website, not yet in the Volunteer Manager' + (lh ? ' (' + lh.toLocaleString('en-CA') + ' hours)' : '') + '</div>');
      if (c.last_applied) out.push('<div class="w152line"><span class="m">Last signed up on the old website on ' + E(fmtDay(c.last_applied)) + '</span></div>');
      if (c.volunteer_needs_review) out.push('<div class="w152line" style="color:' + FLAG + '">' + I('alert') + ' Their volunteer record needs a review in the Volunteer Manager.</div>');
    }
    if (Number(c.donation_count) > 0) out.push('<div class="w152line"><b class="w152num">' + cents(c.donation_total) + '</b> over ' + plural(Number(c.donation_count), 'gift', 'gifts') + (c.last_donation_at ? ', the last on ' + E(fmtDay(c.last_donation_at)) : '') + '</div>');
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
    if (c.volunteer_id) links.push('<button class="w152mini" data-w152go="#volunteering/people" data-w176vid="' + E(String(c.volunteer_id)) + '">' + I('arrow') + 'Open in the Volunteer Manager</button>');
    var mem = c.member_id && typeof MEMBER_BY_ID !== 'undefined' && MEMBER_BY_ID ? MEMBER_BY_ID[c.member_id] : null;
    if (mem && mem.name) links.push('<button class="w152mini" data-w152go="#person/' + E(encodeURIComponent(mem.name)) + '">' + I('arrow') + 'Their Hub profile</button>');
    out.push('<div class="w152line">' + links.join(' ') + '</div>');
    return out.join('');
  }
  /* task 10b: the one rule (Steel, 5 Nov 2026) decides, do not contact first (permWhy); the consent they gave is kept below as history only */
  function permHtml(c) {
    var k = lower(c.email_consent), hist = '';
    if (k === 'express') hist = permChip('express') + ' <span class="m">' + E(['Given', c.consent_source ? '(' + c.consent_source + ')' : '', c.consent_at ? 'on ' + fmtDay(c.consent_at) : ''].filter(Boolean).join(' ')) + '</span>';
    else if (k === 'implied') hist = permChip('implied') + ' <span class="m">' + E(c.implied_consent_until ? (dayOf(c.implied_consent_until) >= today() ? 'Runs until ' : 'Ran out on ') + fmtDay(c.implied_consent_until) + (c.consent_source ? ' (' + c.consent_source + ')' : '') : (c.consent_source || 'Recorded by the team')) + '</span>';
    else if (k === 'none') hist = permChip('none') + ' <span class="m">' + E(PERM.none[2]) + '</span>';
    return permLine(c) +
      (hist ? '<div class="w152line w152hist"><span class="w152hl">History</span> ' + hist + '</div>' : '') +
      (c.sms_opt_out ? '<div class="w152line m">No text messages, they asked.</div>' : '') +
      '<p class="w152pnote w152measure">' + E(RULE_TEXT) + ' Nobody marked do not contact gets any email, and a bouncing address stops everything.</p>';   /* final review M6: Steel's rule of 5 Nov 2026 */
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
      out.push({ f: hubForm || k === 'form' ? 'forms' : (k === 'email' || k === 'website_message' || k === 'campaign') ? 'email' : 'notes',   /* wave293: the filter it falls under */
        at: x.occurred_at || x.created_at, undated: undated, icon: hubForm ? 'form' : (ICON[k] || 'note'), t: t + (x.subject && x.subject !== t ? ': ' + x.subject : ''), p: sent ? '' : (x.body || ''), pre: hubForm,
        st: sent ? (x.meta.status || 'sent') : '', by: hubForm ? 'The form at hub.welfareavenue.com/f/' + ((x.meta && x.meta.slug) || '') : sent ? 'Sent from the Hub' + (x.meta.template_name ? ' (' + x.meta.template_name + ')' : '') + (x.created_by && x.created_by !== 'automation' ? ' by ' + x.created_by : '') :
        system ? (undated ? 'The old website (the form kept no date)' : (x.created_by === 'mail-unsubscribe' ? 'Their unsubscribe link' : '')) : (x.created_by || ''), del: !sent && (mine || amAdmin()) ? x.id : null });
    });
    (d.gifts || []).forEach(function (g) {
      out.push({ f: 'gifts', at: g.donated_at, icon: 'heart', t: cents(g.amount) + (g.recurring ? ' monthly gift' : ' gift'),   /* task 10b: two decimals in lists */
        p: [g.campaign, g.designation, g.platform ? 'through ' + (g.platform.charAt(0).toUpperCase() + g.platform.slice(1)) : ''].filter(Boolean).join(' · '),
        rc: g.receipt_number ? 'Tax receipt ' + g.receipt_number : '', rcUrl: g.receipt_url || '' });
    });
    (d.hist || []).forEach(function (h) {
      if (h.attended && h.volunteer_event_id) return; /* served: the Hub roster has it (the old website's events are in MTL volunteering) */
      var role = h.position ? roleName(lower(h.position)) : 'a volunteer';
      var t = h.attended ? 'Served as ' + role : h.withdrawn ? 'Withdrew' : h.waitlisted ? 'On the waiting list' : h.confirmed ? 'Confirmed as ' + role : h.approved ? 'Approved as ' + role : 'Signed up as ' + role;
      out.push({ f: 'vol', at: h.event_at, icon: 'hand2', t: t, p: [h.event_title, h.location || h.city].filter(Boolean).join(' · ') + (h.attended && Number(h.hours) ? ' · ' + Number(h.hours) + ' hours' : ''), faint: !h.attended, by: 'The old website' });
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
      out.push({ f: 'vol', at: e.event_date, icon: 'hand2', t: t, p: [nm, e.location].filter(Boolean).join(' · ') + (old && Number(r.detail.hours) ? ' · ' + Number(r.detail.hours) + ' hours' : ''), faint: st !== 'Confirmed', by: old ? 'The old website, now in the Volunteer Manager' : 'MTL volunteering' });
    });
    mailThreads(d).forEach(function (th) { out.push(th); });   /* wave293: the email history, one item per thread */
    out.sort(function (a, b) { return ((a.undated ? 1 : 0) - (b.undated ? 1 : 0)) || String(dayOf(b.at)).localeCompare(String(dayOf(a.at))) || String(b.at || '').localeCompare(String(a.at || '')); });
    return out;
  }

  /* ---------- wave293: the email history on a contact's page (design "03 email history", 5.8 and 5.9) ---------- */
  var STEEL_BOX = 'steel.macdonald@welfareavenue.com';   /* Open in Gmail is for the mailbox's owner only, on lines from his mailbox */
  var BOXES = { steel: 'Steel’s mailbox', hub: 'hub@', info: 'info@' };
  var TOPICS = { donation: 'Donations', partnership: 'Partnerships', volunteering: 'Volunteering', event: 'Events', media: 'Media', supplier: 'Suppliers', government: 'Government', program: 'Programs', other: 'Other' };
  var TL_KINDS = [['', 'All'], ['email', 'Emails'], ['notes', 'Notes and calls'], ['forms', 'Forms'], ['gifts', 'Gifts'], ['vol', 'Volunteering']];
  var REL = { donor: 'Donor', partner: 'Partner', volunteer: 'Volunteer', supporter: 'Supporter', vendor: 'Supplier', media: 'Media', government: 'Government', other: 'Other' };
  var TL_PAGE = 50;
  function topicName(t) { return TOPICS[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : ''); }
  function boxesLine(list) { var b = uniq((list || []).filter(Boolean)); return 'From ' + (b.length ? listJoin(b.map(function (x) { return BOXES[x] || x; })) : 'the email history'); }
  function gmailIdOf(x) { var p = String((x && x.source_ref) || '').split(':'); return p.length >= 2 ? p[1] : ''; }
  /* "12 Mar to 2 Apr 2021", "30 Dec 2020 to 4 Jan 2021", or one day */
  function spanDays(a, b) {
    var A = dayOf(a), B = dayOf(b);
    if (!A || !B) return fmtDay(a || b);
    if (A === B) return fmtDay(A);
    var fa = fmtDay(A);
    if (A.slice(0, 4) === B.slice(0, 4)) fa = fa.replace(/ \d{4}$/, '');
    return fa + ' to ' + fmtDay(B);
  }
  function mailThreads(d) {
    var by = {}, order = [];
    (d.mail || []).forEach(function (x) {
      var m = x.meta || {}, k = m.thread ? 't:' + m.thread : 'r:' + (x.source_ref || x.id);
      if (!by[k]) { by[k] = []; order.push(k); }
      by[k].push(x);
    });
    var steelMe = myEmail() === STEEL_BOX;
    return order.map(function (k) {
      var L = by[k].slice().sort(function (a, b) { return String(a.occurred_at || '').localeCompare(String(b.occurred_at || '')); });   /* oldest first, as a conversation reads */
      var first = L[0], last = L[L.length - 1];
      var boxes = L.map(function (x) { return (x.meta || {}).mailbox; });
      var steel = boxes.indexOf('steel') >= 0;
      var thread = (first.meta || {}).thread || '';
      var gm = steel && steelMe ? 'https://mail.google.com/mail/u/?authuser=' + encodeURIComponent(STEEL_BOX) + '#all/' + encodeURIComponent(thread || gmailIdOf(last)) : '';
      var item = { f: 'email', mail: true, key: k, topics: uniq(L.map(function (x) { return (x.meta || {}).topic; }).filter(Boolean)), at: last.occurred_at, icon: 'mail',
        p: last.body || '', by: boxesLine(boxes), steel: steel, gm: gm };
      if (L.length === 1) item.t = (lower(first.direction) === 'in' ? 'Email from them' : 'Email to them') + (first.subject ? ': ' + first.subject : '');
      else { item.t = 'Email thread: ' + (first.subject || 'no subject'); item.span = plural(L.length, 'email', 'emails') + ', ' + spanDays(first.occurred_at, last.occurred_at); item.emails = L; }
      return item;
    });
  }
  function tlState(c) { if (!S.tl || S.tl.id !== String(c.id)) S.tl = { id: String(c.id), f: '', topic: '', show: TL_PAGE, open: {} }; return S.tl; }
  function tlChip(attr, val, label, n, on) {
    return '<button class="w293chip' + (on ? ' on' : '') + '" ' + attr + '="' + E(val) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + E(label) + (n != null ? ' <em class="w152num">' + Number(n).toLocaleString('en-CA') + '</em>' : '') + '</button>';
  }
  function tlFiltersHtml(items, st) {
    var n = {}; items.forEach(function (x) { n[x.f] = (n[x.f] || 0) + 1; });
    var kinds = TL_KINDS.filter(function (k) { return k[0] && n[k[0]]; });
    var out = '';
    if (kinds.length > 1 || st.f) out += '<div class="w293chips" role="group" aria-label="Show on the timeline">' + tlChip('data-w293tlf', '', 'All', items.length, !st.f) +
      kinds.map(function (k) { return tlChip('data-w293tlf', k[0], k[1], n[k[0]], st.f === k[0]); }).join('') + '</div>';
    if (st.f === 'email') {
      var tc = {}; items.forEach(function (x) { if (x.f === 'email') (x.topics || []).forEach(function (t) { tc[t] = (tc[t] || 0) + 1; }); });
      var ts = Object.keys(tc).sort(function (a, b) { return (tc[b] - tc[a]) || topicName(a).localeCompare(topicName(b)); });
      if (ts.length) out += '<div class="w293chips sub" role="group" aria-label="Email topics">' + tlChip('data-w293tlt', '', 'Every topic', null, !st.topic) +
        ts.map(function (t) { return tlChip('data-w293tlt', t, topicName(t), tc[t], st.topic === t); }).join('') + '</div>';
    }
    return out;
  }
  function threadHtml(x, st, d) {
    var open = !!st.open[x.key];
    return '<details class="w293em" data-w293det="' + E(x.key) + '"' + (open ? ' open' : '') + '><summary>' + I('chevd', 'w293chev') + '<span>Show the ' + x.emails.length.toLocaleString('en-CA') + ' emails</span></summary>' +
      '<ol class="w293list">' + x.emails.map(function (m) {
        var mb = (m.meta || {}).mailbox, inn = lower(m.direction) === 'in';
        return '<li><div class="w293mh"><span class="w293d w152num">' + E(fmtDay(m.occurred_at)) + '</span><span class="w293dir ' + (inn ? 'in' : 'out') + '">' + (inn ? 'From them' : 'To them') + '</span><span class="w293mb">' + E(BOXES[mb] || mb || '') + '</span></div>' +
          (m.subject && m.subject !== x.emails[0].subject ? '<div class="w293ms">' + E(m.subject) + '</div>' : '') + (m.body ? '<p>' + E(m.body) + '</p>' : '') + '</li>';
      }).join('') + '</ol></details>';
  }
  /* the Relationship card above the timeline (5.9): the type, the counts, the topics, anything open, the summary, Refresh */
  function relationshipHtml(c, d) {
    if (!d) return '';
    var r = d.rel, v = d.relv, mail = d.mail || [];
    if (!r && !v && !mail.length) return '';
    var out = [], st = S.rel && S.rel.id === String(c.id) ? S.rel : null;
    if (r && r.rel_type) {
      var conf = Number(r.rel_conf), sure = isFinite(conf) && conf >= (d.unsure || 0.5);
      out.push('<div class="w293type">' + (sure ? '<b>' + E(REL[r.rel_type] || r.rel_type) + '</b><span class="w152num">, ' + Math.round(conf * 100) + '% sure</span>' : '<b>Not sure</b><span>' + E(' (perhaps ' + (REL[r.rel_type] || r.rel_type).toLowerCase() + ')') + '</span>') +
        (r.stale ? ' <span class="w293stale">May be out of date</span>' : '') + '</div>');
    }
    if (v && Number(v.emails_in) + Number(v.emails_out) > 0) {
      var tot = Number(v.emails_in || 0) + Number(v.emails_out || 0), th = Number(v.threads || 0);
      var inTh = th > 1 ? ' in ' + plural(th, 'thread', 'threads') : th === 1 ? ' in one thread' : '';
      var line = tot === 1 ? 'One email, ' + fmtDay(v.first_email_at)
        : dayOf(v.first_email_at) === dayOf(v.last_email_at) ? plural(tot, 'email', 'emails') + ' on ' + fmtDay(v.first_email_at) + inTh
        : 'First email ' + fmtDay(v.first_email_at) + ', last ' + fmtDay(v.last_email_at) + ', ' + plural(tot, 'email', 'emails') + inTh;
      out.push('<div class="w152line w152num" data-w293counts>' + E(line) + '</div>');
    }
    var topics = arr(r && r.topics);
    if (topics.length) out.push('<div class="w293tops">' + topics.map(function (t) { return '<span class="w152rl">' + E(topicName(t)) + '</span>'; }).join('') + '</div>');
    if (r && r.open_item) out.push('<div class="w293open"><b>Still open</b> ' + E(r.open_item) + (r.generated_at ? ' <span class="m">(as of ' + E(fmtDay(r.generated_at)) + ')</span>' : '') + '</div>');
    if (r && r.summary) out.push('<p class="w293sum w152measure">' + E(r.summary) + '</p>');
    if (amAdmin() && !d.steelOpen && (mail.some(function (x) { return (x.meta || {}).mailbox === 'steel'; }) || (r && r.from_steel))) out.push('<div class="w152line m" data-w293adm>' + I('lock') + ' Lines from Steel’s mailbox are visible to admins only for now.</div>');
    var busyNow = st && st.busy;
    var foot = (r && r.summary && r.generated_at ? '<span>Written by the Hub on ' + E(fmtDay(r.generated_at)) + '</span>' : '<span>No summary yet.</span>') +
      '<button class="w152mini w293ref" data-w293refresh="' + E(c.id) + '"' + (busyNow ? ' disabled aria-busy="true"' : '') + '>' + I('spark') + (busyNow ? 'Writing…' : (r && r.summary ? 'Refresh' : 'Write one')) + '</button><span class="m">about 1¢</span>';
    out.push('<div class="w293foot">' + foot + '</div>' + '<div class="w293msg" role="status" aria-live="polite">' + (st && st.msg ? E(st.msg) : '') + '</div>');
    return '<div class="w152sec w293rel" data-w293card><h4>Relationship</h4>' + out.join('') + '</div>';
  }
  /* Refresh: the one summary path (mail-history insight: crm_insight_input, the mail_history_insight route, crm_insight_save) for one contact */
  function refreshInsight(id) {
    var c = contact(id); if (!c || (S.rel && S.rel.busy)) return;
    S.rel = { id: String(c.id), busy: true, msg: '' };
    contactSheet(c.id);
    var done = function (msg) { S.rel = { id: String(c.id), busy: false, msg: msg }; if (S.sheet === 'c:' + c.id) contactSheet(c.id, true); };
    if (typeof db === 'undefined' || !db || !db.functions) { done('The Hub is offline. Try again in a moment.'); return; }
    Promise.resolve(db.functions.invoke('mail-history', { body: { action: 'insight', contact_id: Number(c.id) } })).then(function (res) {
      if (res && res.error) {
        var ctx = res.error.context;
        if (ctx && typeof ctx.json === 'function') return ctx.json().then(function (j) { done((j && j.error) || 'The summary could not be written.'); }, function () { done('The summary could not be written.'); });
        done(res.error.message || 'The summary could not be written.'); return;
      }
      if (res && res.data && res.data.error) { done(String(res.data.error)); return; }
      done(res && res.data && res.data.saved === false ? 'Nothing to summarise yet.' : 'Summary written.');   /* eh-293 A-I1: one neutral answer */
    }).catch(function (e) { done('The summary could not be written (' + String((e && e.message) || e) + ').'); });
  }
  function logFormHtml(c) {
    return '<div class="w152log"><div class="r"><select data-w152logk aria-label="What happened">' + LOG_ORDER.map(function (k) { return '<option value="' + k + '">' + E(LOGS[k][2]) + '</option>'; }).join('') + '</select>' +
      '<input type="date" data-w152logd value="' + E(today()) + '" max="' + E(today()) + '" aria-label="When"></div>' +
      '<textarea data-w152logt placeholder="What happened, or what to remember next time" aria-label="Note"></textarea>' +
      '<div class="r" style="justify-content:space-between"><span class="w152err" data-w152logerr></span><button class="w152btn sm" data-w152log="' + E(c.id) + '">' + I('check') + ' Save to the timeline</button></div></div>';
  }
  function timelineHtml(c, d) {
    if (!d) return logFormHtml(c) + busy('Loading their history…');
    var all = timeline(c, d), st = tlState(c);
    /* wave293: the filters by kind (All, Emails, Notes and calls, Forms, Gifts, Volunteering) and, under Emails, the topics; page state only */
    if (st.f && !all.some(function (x) { return x.f === st.f; })) { st.f = ''; st.topic = ''; }
    var items = all.filter(function (x) { return (!st.f || x.f === st.f) && (!st.topic || (x.topics || []).indexOf(st.topic) >= 0); });
    var shown = items.slice(0, st.show);
    /* eh-293 A-M3: the timeline reads the latest 600 email lines; say so when the history holds more */
    var mailTotal = d.relv ? Number(d.relv.emails_in || 0) + Number(d.relv.emails_out || 0) : 0, mailRead = (d.mail || []).length;
    var cut = mailTotal > mailRead && mailRead >= 600 ? '<p class="w152pnote w293cut" data-w293cut>The timeline shows the latest ' + mailRead.toLocaleString('en-CA') + ' of ' + mailTotal.toLocaleString('en-CA') + ' emails.</p>' : '';
    return logFormHtml(c) + (all.length ? tlFiltersHtml(all, st) : '') + cut + (shown.length ? '<ul class="w152tl">' + shown.map(function (x) {
      return '<li class="w152it' + (x.faint ? ' faint' : '') + (x.mail ? ' w293mail' : '') + '"><span class="ic">' + I(x.icon) + '</span><div><div class="t">' + E(x.t) + (x.st ? '<span class="w154st" style="background:' + (MSTATUS[x.st] || MSTATUS.sent)[1] + '1a;color:' + (MSTATUS[x.st] || MSTATUS.sent)[1] + '">' + E((MSTATUS[x.st] || [x.st])[0]) + '</span>' : '') + '<span class="d">' + (x.undated ? 'date not recorded' : E(fmtDay(x.at)) + (dayOf(x.at) >= today() && dayOf(x.at) !== today() ? ' (' + E(ago(x.at)) + ')' : '')) + '</span></div>' +
        (x.span ? '<div class="w293span w152num">' + E(x.span) + '</div>' : '') +
        (x.p ? '<p' + (x.pre ? ' class="pre"' : '') + '>' + E(x.p) + '</p>' : '') + (x.emails ? threadHtml(x, st, d) : '') + (x.rc ? '<div class="by">' + (x.rcUrl ? '<a class="w152mini" style="padding:0" href="' + E(x.rcUrl) + '" target="_blank" rel="noopener">' + E(x.rc) + ' ' + I('ext') + '</a>' : E(x.rc)) + '</div>' : '') +
        (x.by || x.del || x.gm ? '<div class="by">' + (x.by ? '<span>' + E(x.by) + (x.steel && !d.steelOpen && amAdmin() ? ' · admins only for now' : '') + '</span>' : '') +
          (x.gm ? '<a class="w152mini" href="' + E(x.gm) + '" target="_blank" rel="noopener" data-w293gmail="1">' + I('ext') + 'Open in Gmail</a>' : '') +
          (x.del && !x.mail ? '<button class="w152mini" data-w152delint="' + E(x.del) + '">' + I('trash') + 'Delete</button>' : '') + '</div>' : '') + '</div></li>';
    }).join('') + '</ul>' + (shown.length < items.length ? '<button class="w152btn soft sm w293more" data-w293more="1">Show ' + Math.min(TL_PAGE, items.length - shown.length) + ' more (' + (items.length - shown.length).toLocaleString('en-CA') + ' left)</button>' : '')
      : all.length ? '<p class="w152pnote">Nothing of this kind on their timeline. <button class="w152mini" data-w293tlf="">Show everything</button></p>' : '<p class="w152pnote">Nothing on their timeline yet.</p>');
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
    var qa = [], dnc = !!c.do_not_contact;
    /* task 10b (UI review top fix 1): a do-not-contact person shows no way to reach them (no mailto, tel, sms or Send, which would go round
       every server check); the banner says why, and a deceased person never shows a Call button */
    if (!dnc) {
      if (c.emails[0]) qa.push('<a class="w152btn soft sm" href="mailto:' + E(c.emails[0]) + '">' + I('mail') + ' Email</a>');
      if (c.phones[0] && telOf(c.phones[0])) { qa.push('<a class="w152btn soft sm" href="tel:' + E(telOf(c.phones[0])) + '">' + I('phone') + ' Call</a>'); if (!c.sms_opt_out) qa.push('<a class="w152btn soft sm" href="sms:' + E(telOf(c.phones[0])) + '">' + I('chat') + ' Text</a>'); }
      if (c.emails[0]) qa.push('<button class="w152btn ghost sm" data-w152copy="' + E(c.emails[0]) + '">' + I('copy') + ' Copy the email</button>');
    }
    if (can('gifts_edit')) qa.push('<button class="w152btn soft sm" data-w158new="' + E(c.id) + '">' + I('heart') + ' Record a gift</button>');   /* wave283: gifts_edit */
    if (!dnc && c.emails[0] && lower(c.email_status) !== 'bounced' && lower(c.email_status) !== 'complained') qa.push('<button class="w152btn soft sm" data-w154send="' + E(c.id) + '">' + I('spark') + ' Send an email from the Hub</button>');
    /* the header names email only when it is stopped; the consent they gave is history, under Email permission */
    var stop = !dnc && (c._perm === 'unsub' || c._perm === 'bounced') ? permChip(c._perm) : '';
    return '<div class="w152hd">' + avatar(c, true) + '<div style="min-width:0"><h2>' + E(c.full_name) + '</h2><div class="ks">' + kindsHtml(c) + stop + '</div><div class="sub">' + E(srcLine) + '</div></div></div>' +
      (dnc ? '<div class="w283dnc" role="status" data-w283banner>' + I('lock') + '<span><b>' + E(dncWords(c)) + '</b><span class="w283dncm">No email, calls or texts.</span></span></div>' : '') +   /* wave283 */
      (S.note && S.note.id === String(c.id) ? '<div class="w152warn" role="status">' + E(S.note.msg) + '</div>' : '') +
      (qa.length ? '<div class="w152qa">' + qa.join('') + '</div>' : '') +
      '<div class="w152cols"><div>' +
      '<div class="w152sec"><h4>Contact details <button class="w152mini" data-w152edit="' + E(c.id) + '">' + I('edit') + 'Edit</button></h4>' + detailsHtml(c, d) + '</div>' +
      '<div class="w152sec"><h4>With Welfare Avenue</h4>' + withUsHtml(c, d) + '</div>' +
      '<div class="w152sec"><h4>Email permission <button class="w152mini" data-w152perm-edit="' + E(c.id) + '">' + I('shield') + 'Change</button></h4>' + permHtml(c) + '</div>' +
      '<div class="w152sec w283"><h4>Do not contact</h4>' + dncHtml(c) + '</div>' +
      '<div class="w152sec"><h4>Tags</h4>' + tagsHtml(c) + '</div>' +
      (d && d.fields && moreHtml(d) ? '<div class="w152sec"><h4>More about them</h4>' + moreHtml(d) + '</div>' : '') +
      (d && d.runs && d.runs.length ? '<div class="w152sec"><h4>Automations</h4>' + contactAutosHtml(d) + '</div>' : '') +
      (c.notes ? '<div class="w152sec"><h4>Good to know</h4><p class="w152line" style="white-space:pre-wrap">' + E(c.notes) + '</p></div>' : '') +
      '</div><div>' + relationshipHtml(c, d) + '<div class="w152sec"><h4>Timeline</h4>' + timelineHtml(c, d) + '</div></div></div>';   /* wave293: the Relationship card above the timeline */
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
  function inp(name, val, ph, type, max) { return '<input data-f="' + name + '"' + (type ? ' type="' + type + '"' : '') + ' value="' + E(val == null ? '' : val) + '"' + (ph ? ' placeholder="' + E(ph) + '"' : '') + (max ? ' maxlength="' + max + '"' : '') + '>'; }
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
    if (!isNew && c && c.volunteer_id) fixed.push('Volunteer (from the Volunteer Manager)');
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
      '<div class="sub">' + (isNew ? 'Someone we know: a donor, a partner\u2019s contact, a supporter. A new volunteer also gets a volunteer record, so the Volunteer Manager sees them.' : 'Their details, as the whole team will see them.') + '</div>' +
      '<div class="w152form">' +
      (c && c.volunteer_id ? '<div class="note">' + I('link') + ' One record: this contact is also their volunteer record, so the Volunteer Manager shows the same name, emails, phones, address, tags and notes.</div>' : '') +
      field('Full name', inp('full_name', x.full_name, 'First and last name'), true) +
      field('Emails', inp('emails', x.emails.join(', '), 'name@example.com'), false, 'separated by commas; the first one is used') +
      field('Phones', inp('phones', x.phones.join(', '), '514 555 0123'), false, 'separated by commas') +
      field('Street address', inp('address', x.address), true) +
      field('City', inp('city', x.city, 'Montreal')) + field('Province', inp('province', x.province, 'QC')) +
      field('Postal code', inp('postal_code', x.postal_code, 'H2X 1Y4')) + field('Language', sel('language', LANGS, x.language || '')) +
      field('Job title', inp('job_title', x.job_title, 'Chef, Teacher, Program officer', null, 120)) +   /* wave283; task 10b: 120 characters (Keela or the API may still bring a longer one) */
      '<div class="full lbl">What they are to us' + kindsBoxes(c, isNew) + '</div>' +
      '<div class="full lbl w283">Chapter' + chapterBoxes(c) + '</div>' +   /* wave283: one toggle per active chapter (crm_contact_chapters, source hand) */
      (can('hr_private') ? birthField(c) : '') +   /* wave283: HR and admins only (crm_contact_private) */
      (isNew ? field('Email permission', sel('perm', [['', 'Not recorded'], ['express', 'Express consent: they said yes to our emails'], ['implied', 'Implied consent: a recent gift, membership or volunteering'], ['none', 'No consent']], ''), false) +
        field('Where it came from', inp('perm_source', '', 'e.g. signed up at the gala'), false) : '') +
      field('Good to know', area('notes', x.notes, 'Anything the team should know: how they like to be reached, who knows them best'), true) +
      '</div><div class="w152foot"><span class="w152err" data-w152err></span><button class="w152btn ghost" data-w152back="' + E(id || '') + '">Cancel</button>' +
      '<button class="w152btn" data-w152save="' + E(id || 'new') + '">' + I('check') + (isNew ? ' Add them' : ' Save') + '</button></div>';
    openSheet(html, isNew ? 'add' : 'edit:' + id, true);
    fillEditExtras(c, isNew ? 'add' : 'edit:' + id);
  }
  /* ---------- wave283: chapters, the birth date and do-not-contact on a contact ---------- */
  LOADERS.chapters = function () { return db.from('crm_chapters').select('code,name_en,active,sort').eq('active', true).order('sort', { ascending: true }); };
  function chapterBoxes(c) {
    var d = c ? S.detail[String(c.id)] : null, ready = !!S.chapters && (!c || !!(d && d.chapters));
    var had = ready && c ? d.chapters : [];
    if (!ready) return '<div class="kinds" data-w283chs data-ready="0"><span class="m">Loading the chapters…</span></div>';
    return '<div class="kinds" data-w283chs data-ready="1" data-had="' + E(had.join(',')) + '">' + (S.chapters || []).map(function (ch) {
      return '<label><input type="checkbox" data-w283ch="' + E(ch.code) + '"' + (had.indexOf(ch.code) >= 0 ? ' checked' : '') + '> ' + E(ch.name_en || ch.code) + '</label>';
    }).join('') + '<span class="w152count">No chapter: counted as Montreal.</span></div>';   /* task 10b: Steel's decision 5, the same sentence as the form editor */
  }
  function birthField(c) {
    var d = c ? S.detail[String(c.id)] : null, v = d && typeof d.birth === 'string' ? d.birth : '';
    var ready = !c || !!(d && d.birth !== null && d.birth !== undefined);
    return field('Birth date', '<input data-f="birth_date" type="date" value="' + E(v) + '" data-had="' + E(v) + '"' + (ready ? '' : ' disabled data-w283wait="1"') + '>', false, 'HR and admins only; the team sees an age band');
  }
  /* the chapters and the birth date may still be loading when the form opens: fill those two in place, so nothing typed is lost */
  function fillEditExtras(c, tag) {
    var need = [];
    if (!S.chapters) need.push(load('chapters'));
    if (c && !S.detail[String(c.id)]) need.push(loadDetail(c));
    if (!need.length) return;
    Promise.all(need).then(function () {
      if (S.sheet !== tag) return;
      var o = document.getElementById('w152sheet'); if (!o) return;
      var box = o.querySelector('[data-w283chs]'); if (box) box.outerHTML = chapterBoxes(c);
      var bd = o.querySelector('[data-w283wait]');
      if (bd && c) { var d = S.detail[String(c.id)], v = d && typeof d.birth === 'string' ? d.birth : ''; bd.value = v; bd.setAttribute('data-had', v); bd.disabled = false; bd.removeAttribute('data-w283wait'); }
    });
  }
  /* after the contact row is saved: chapter rows added or removed (source hand), the birth date written; returns what did not save */
  async function saveExtras(cid) {
    var o = document.getElementById('w152sheet'), errs = [], d = S.detail[String(cid)];
    if (!o || !/^\d+$/.test(String(cid))) return errs;
    var box = o.querySelector('[data-w283chs]');
    if (box && box.getAttribute('data-ready') === '1') {
      var had = (box.getAttribute('data-had') || '').split(',').filter(Boolean), now = had.slice();
      var want = Array.prototype.filter.call(box.querySelectorAll('[data-w283ch]'), function (el) { return el.checked; }).map(function (el) { return el.getAttribute('data-w283ch'); });
      for (var i = 0; i < want.length; i++) {
        if (had.indexOf(want[i]) >= 0) continue;
        var ri = await db.from('crm_contact_chapters').insert({ contact_id: Number(cid), chapter: want[i], source: 'hand', source_ref: 'the CRM', added_by: actor() });
        if (ri && ri.error) errs.push('the chapter ' + want[i]); else now.push(want[i]);
      }
      for (var j = 0; j < had.length; j++) {
        if (want.indexOf(had[j]) >= 0) continue;
        var rd = await db.from('crm_contact_chapters').delete().eq('contact_id', Number(cid)).eq('chapter', had[j]);
        if (rd && rd.error) errs.push('removing the chapter ' + had[j]); else now = now.filter(function (x) { return x !== had[j]; });
      }
      if (now.slice().sort().join(',') !== had.slice().sort().join(',')) { if (d) d.chapters = now; audit(cid, 'chapters', had.join(', '), now.join(', ')); }
    }
    var bd = o.querySelector('[data-f="birth_date"]');
    if (bd && can('hr_private') && !bd.disabled) {
      var before = bd.getAttribute('data-had') || '', val = String(bd.value || '');
      if (val !== before) {
        var rb = val ? await db.from('crm_contact_private').upsert({ contact_id: Number(cid), birth_date: val, source: 'set by HR in the CRM', updated_by: actor(), updated_at: new Date().toISOString() })
          : await db.from('crm_contact_private').delete().eq('contact_id', Number(cid));
        if (rb && rb.error) errs.push('the birth date');
        else {
          if (d) d.birth = val;
          audit(cid, 'birth_date', null, val ? 'birth date set' : 'birth date removed');   /* never the date itself (Part A.7) */
          var ab = await Promise.resolve(db.rpc('crm_age_band', { p_contact: Number(cid) })).catch(function () { return null; });
          if (d) d.age = ab && !ab.error && typeof ab.data === 'string' ? ab.data : null;
        }
      }
    }
    return errs;
  }
  var DNC_REASONS = [['deceased', 'Deceased'], ['asked', 'They asked'], ['other', 'Other']];
  /* task 10b: the picker's words, never the stored code ("Do not contact: they asked"). "Other" keeps no note: crm_set_do_not_contact and the
     dnc_reason column accept only deceased, asked or other, and Steel's ruling allows no schema change in this slice */
  var DNC_WORDS = { deceased: 'deceased', asked: 'they asked', other: 'other' };
  function dncWords(c) { var r = lower(c.dnc_reason); return 'Do not contact' + (r ? ': ' + (DNC_WORDS[r] || r) : ''); }
  function dncReasonOk(r) { return DNC_REASONS.some(function (x) { return x[0] === r; }); }
  function dncFocus(sel) { var el = document.querySelector('#w152sheet ' + sel); if (el) { try { el.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }
  /* task 10b (Steel's decision 3): confirm the set, not the clear. Setting it unsubscribes them for good, so it asks first; clearing never
     resubscribes anyone, so it goes through at once with a short note. The button waits for a reason (no late "Pick why first.") */
  function dncHtml(c) {
    var id = String(c.id), st = S.dnc && S.dnc.id === id ? S.dnc : {};
    var err = '<span class="w152err" data-w283dncerr id="w283dncerr-' + E(id) + '" role="status">' + E(st.err || '') + '</span>';
    if (c.do_not_contact) {
      return '<div class="w152line">' + E(dncWords(c)) + '. <span class="w283m">No email of any kind, no texts and no WhatsApp. Receipts are still issued and kept, not emailed.</span></div>' +
        '<div class="w283acts"><button class="w152btn sm soft" data-w283dncclear="' + E(id) + '">' + I('x') + ' Clear do not contact</button></div>' +
        '<p class="w283m">Clearing it does not resubscribe them.</p>' + err;
    }
    var r = dncReasonOk(st.reason) ? st.reason : '';
    return (st.note ? '<div class="w283said ok" role="status" data-w283note>' + E(st.note) + '</div>' : '') +
      '<div class="w283acts"><select class="w152sel" data-w283dncr="' + E(id) + '" aria-label="Why they are not to be contacted" aria-describedby="w283dnch-' + E(id) + ' w283dncerr-' + E(id) + '"><option value="">Why…</option>' +
      DNC_REASONS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === r ? ' selected' : '') + '>' + E(x[1]) + '</option>'; }).join('') + '</select>' +
      '<button class="w152btn sm soft" data-w283dnc="' + E(id) + '"' + (r && !st.ask ? '' : ' disabled') + '>' + I('lock') + ' Do not contact</button></div>' +
      (st.ask ? '<div class="w283cf" data-w283cf><b>Set do not contact for ' + E(c.full_name) + '?</b> This unsubscribes them from everything. Clearing it later will not resubscribe them.' +
          '<div class="w283acts"><button class="w152btn sm danger" data-w283dncyes="' + E(id) + '">Yes, set do not contact</button><button class="w152btn sm ghost" data-w283dncno="' + E(id) + '">Cancel</button></div></div>'
        : '<p class="w283m" id="w283dnch-' + E(id) + '">Pick why, then Do not contact. It stops every email (a receipt is still issued and kept, not emailed), texts and WhatsApp, and unsubscribes them.</p>') + err;
  }
  function saveDnc(id, reason) {
    var c = contact(id); if (!c) return;
    var sid = String(c.id);
    if (reason !== null && !dncReasonOk(reason)) { S.dnc = { id: sid, err: 'Pick why first.' }; contactSheet(c.id); dncFocus('[data-w283dncr]'); return; }
    S.dnc = { id: sid, err: '', reason: reason || '' };
    var failed = function (m) { S.dnc = { id: sid, err: 'Not saved: ' + String(m).slice(0, 160), reason: reason || '' }; contactSheet(c.id); dncFocus(reason ? '[data-w283dncr]' : '[data-w283dncclear]'); };
    Promise.resolve(db.rpc('crm_set_do_not_contact', { p_contact: Number(c.id), p_reason: reason })).then(function (r) {
      if (r && r.error) { failed(r.error.message || r.error); return; }
      var before = c.do_not_contact ? dncWords(c) : null, st = lower(c.email_status);
      /* what crm_set_do_not_contact did (wave281): with a reason, the flag and every opt-out; with none, the flag only (never a resubscribe) */
      applyLocal(c.id, reason ? { do_not_contact: true, dnc_reason: reason, email_status: st === 'bounced' || st === 'complained' ? c.email_status : 'unsubscribed', sms_opt_out: true }
        : { do_not_contact: false, dnc_reason: null });
      if (reason) audit(c.id, 'do_not_contact', before, 'do not contact: ' + reason);   /* clearing is logged by the function itself */
      S.dnc = reason ? null : { id: sid, note: 'Cleared. This did not resubscribe them.' };
      toastS(reason ? 'Do not contact is set' : 'Do not contact is cleared');
      contactSheet(c.id); repaintBehind();
      dncFocus(reason ? '[data-w283dncclear]' : '[data-w283dncr]');   /* focus stays where the control was */
    }, function (e) { failed((e && e.message) || e); });
  }
  function dncCancel(id) { S.dnc = { id: String(id), reason: (S.dnc && S.dnc.reason) || '' }; contactSheet(id); dncFocus('[data-w283dnc]'); }
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest || !t.closest('#w152sheet')) return;
    if ((el = t.closest('[data-w283dnc]'))) {
      e.preventDefault(); var id0 = el.getAttribute('data-w283dnc'), sl = document.querySelector('#w152sheet [data-w283dncr]'), r0 = sl && sl.value ? sl.value : '';
      if (!dncReasonOk(r0)) { saveDnc(id0, ''); return; }
      S.dnc = { id: String(id0), ask: true, reason: r0, err: '' }; contactSheet(id0); dncFocus('[data-w283dncno]');   /* the safe choice has the focus */
      return;
    }
    if ((el = t.closest('[data-w283dncyes]'))) { e.preventDefault(); el.disabled = true; saveDnc(el.getAttribute('data-w283dncyes'), (S.dnc && S.dnc.reason) || ''); return; }
    if ((el = t.closest('[data-w283dncno]'))) { e.preventDefault(); dncCancel(el.getAttribute('data-w283dncno')); return; }
    if ((el = t.closest('[data-w283dncclear]'))) { e.preventDefault(); el.disabled = true; saveDnc(el.getAttribute('data-w283dncclear'), null); return; }
  });
  /* picking a reason enables the button in place: no repaint, so the focus and the select stay (a closed select on Windows fires change on each arrow key) */
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-w283dncr')) return;
    var v = dncReasonOk(t.value) ? t.value : '';
    S.dnc = { id: String(t.getAttribute('data-w283dncr')), reason: v, err: '' };
    var b = document.querySelector('#w152sheet [data-w283dnc]'); if (b) b.disabled = !v;
    var er = document.querySelector('#w152sheet [data-w283dncerr]'); if (er) er.textContent = '';
    var nt = document.querySelector('#w152sheet [data-w283note]'); if (nt) nt.remove();
  });
  var css283 = document.createElement('style'); css283.id = 'w283css';
  css283.textContent = ''
    + '.w283dnc{display:flex;align-items:flex-start;gap:8px;margin:10px 0 0;padding:9px 12px;border-radius:10px;background:rgba(179,64,47,.08);color:' + FLAG + ';font-size:13.5px;line-height:1.45;}'
    + '.w283dnc .w152i{width:16px;height:16px;flex:none;margin-top:2px;}.w283dnc>span{min-width:0;display:flex;flex-wrap:wrap;column-gap:10px;row-gap:2px;}'
    + '.w283dncm{color:#6B6965;font-weight:500;}'
    + '.w283acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0;}.w283acts .w152sel{width:auto;}'
    + '.w283m{color:#6B6965;font-size:12.5px;line-height:1.45;}'
    + '.w283cf{background:rgba(179,64,47,.06);border-radius:10px;padding:9px 11px;margin:6px 0;font-size:13px;line-height:1.5;animation:w283in 140ms ease-out;}'
    + '.w283said{color:' + FLAG + ';font-weight:600;font-size:13px;}.w283said.ok{color:' + GREEN + ';margin:2px 0 4px;}'
    + '.w283first{margin:8px 0 4px;font-size:13.5px;font-weight:600;line-height:1.45;}'
    + '.w283 button:focus-visible,.w283 select:focus-visible,.w283 input:focus-visible,.w283cf button:focus-visible{outline:2px solid ' + GREEN + ';outline-offset:2px;box-shadow:0 0 0 5px rgba(220,165,39,.35);}'
    /* task 10b: the confirmation fades in, reduced motion included (opacity is not movement) */
    + '@keyframes w283in{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(css283);
  function permForm(id) {
    var c = contact(id); if (!c) return;
    var until = c.implied_consent_until ? dayOf(c.implied_consent_until) : (c._last ? addYears(c._last, 2) : '');
    var spam = lower(c.email_status) === 'complained';
    var html = '<h2>Email permission</h2><div class="sub">' + E(c.full_name) + '. Their opt-outs decide what they get; the consent they gave is kept as history.</div><div class="w152form">' +
      field('Permission', sel('email_consent', [['', 'Not recorded'], ['express', 'Express consent: they said yes to our emails'], ['implied', 'Implied consent: an existing relationship'], ['none', 'No consent']], c.email_consent || ''), true) +
      field('Where it came from', inp('consent_source', c.consent_source, 'the website form, a sign-up sheet, an email'), true) +
      field('Date they said yes', inp('consent_at', c.consent_at ? dayOf(c.consent_at) : '', '', 'date'), false, 'express consent') +
      field('Implied consent runs until', inp('implied_consent_until', until, '', 'date'), false, 'two years after the last gift, membership or volunteering') +
      '<label class="chk full"><input type="checkbox" data-f="unsub"' + (c._perm === 'unsub' ? ' checked' : '') + (spam ? ' disabled aria-describedby="w283spam"' : '') + '> They unsubscribed: no newsletters, fundraising or volunteer emails</label>' +
      (spam ? '<div class="note" data-w283spam id="w283spam">They marked one of our emails as spam, so this stays ticked: a spam complaint cannot be cleared here.</div>' : '') +   /* final review M4; task 10b: the box is disabled too */
      '<label class="chk full"><input type="checkbox" data-f="sms_opt_out"' + (c.sms_opt_out ? ' checked' : '') + '> No text messages</label>' +
      (c.do_not_contact ? '<div class="note" data-w281dnc>Do not contact is on. Clear it first to change these.</div>' : '') +
      '<div class="note">' + E(RULE_TEXT) + ' Express and implied consent are kept on the record as history.</div>' +   /* task 10b: Steel's rule of 5 Nov 2026, not the CASL note */
      '</div><div class="w152foot"><span class="w152err" data-w152err></span><button class="w152btn ghost" data-w152back="' + E(id) + '">Cancel</button>' + (c.do_not_contact ? '' : '<button class="w152btn" data-w152savep="' + E(id) + '">' + I('check') + ' Save</button>') + '</div>';
    if (c.do_not_contact) html = html.replace(/<(input|select) /g, '<$1 disabled ');   /* final review I1: do not contact holds these (the database too), so the form only shows them */
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
      province: v.province || null, postal_code: v.postal_code ? v.postal_code.toUpperCase() : null, language: v.language || null, kinds: kinds, notes: v.notes || null, job_title: v.job_title || null, updated_by: actor() };
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
        S.detail[String(newId)] = { ints: [], gifts: [], hist: [], roster: [], events: [], orgs: [], at: Date.now(), chapters: [], birth: '', age: null };
        var xnew = await saveExtras(newId);   /* wave283: chapters and the birth date */
        if (xnew.length) S.note = { id: String(newId), msg: 'Added, but not saved: ' + listJoin(xnew) + '. Open Edit to try again.' };
        toastS(row.full_name + ' is in the CRM');
        try { history.replaceState(null, '', '#crm/c/' + newId); } catch (e) { /* fine */ }
        contactSheet(newId); repaintBehind();
        return;
      }
      /* wave176: one record: the contact is the person, and the Volunteer Manager reads the same row (no second copy to write) */
      var res = await db.from('crm_contacts').update(row).eq('id', c.id).select('id');
      if (res && res.error) throw res.error;
      if (res && Array.isArray(res.data) && !res.data.length) { showErr('Could not save: the CRM is not open to you.'); return; }
      var changed = ['full_name', 'emails', 'phones', 'address', 'city', 'province', 'postal_code', 'language', 'kinds', 'notes', 'job_title'].filter(function (k) { return JSON.stringify(c[k] == null ? null : c[k]) !== JSON.stringify(row[k] == null ? null : row[k]); });
      applyLocal(c.id, row);
      if (changed.length) audit(c.id, 'details', null, changed.join(', '));
      var xerr = await saveExtras(c.id);   /* wave283: chapters and the birth date */
      if (xerr.length) { showErr('Saved the details, but not ' + listJoin(xerr) + '. Try again.'); repaintBehind(); return; }
      toastS('Saved'); contactSheet(c.id); repaintBehind();
    } catch (e) { showErr('Could not save: ' + String((e && e.message) || e).slice(0, 160)); }
  }
  async function savePerm(id) {
    var c = contact(id); if (!c) return;
    if (c.do_not_contact) { showErr('Do not contact is on. Clear it first to change these.'); return; }   /* final review I1 */
    var v = formVals();
    var row = { email_consent: v.email_consent || null, consent_source: v.consent_source || null, updated_by: actor(), sms_opt_out: !!v.sms_opt_out };
    if (v.email_consent === 'express') row.consent_at = v.consent_at ? v.consent_at + 'T12:00:00Z' : (c.consent_at || new Date().toISOString());
    else row.consent_at = v.email_consent ? (c.consent_at || null) : null;
    if (v.email_consent === 'implied') { if (!v.implied_consent_until) { showErr('Say until when the implied consent runs (two years after the last gift or volunteering).'); return; } row.implied_consent_until = v.implied_consent_until; }
    else row.implied_consent_until = null;
    var st = lower(c.email_status);
    if (st === 'complained') { /* final review M4: a spam complaint is never changed from here (task 10b: not even into unsubscribed) */ }
    else if (v.unsub) row.email_status = 'unsubscribed';
    else if (st === 'unsubscribed') row.email_status = 'unknown';
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
