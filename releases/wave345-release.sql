-- 15/11/26 - wave345 release: Settings for the Montreal Volunteer Manager, and a calmer event page.
-- One block: if any check fails, nothing changes. Made against the live Hub page d0e8555c5d2052edb0da59f45cf7bda5 (wave342).
-- What changes: Setup becomes Settings (staffing rules, who emails come from and who replies reach, automatic messages,
-- the WhatsApp link; leads and admins change them); an event can use its own automatic-messages setting; the Team tab's
-- cards close to two lines; Next up is one list; Plan is shorter; the itinerary has its own tab; Wrap up has Photos.
-- Nobody is messaged by this release. Undo: "15-11-26 - wave345 undo (only if needed).sql".

create table if not exists public.site_files_bak_wa345 (path text, part int, content text, updated_at timestamptz);
alter table public.site_files_bak_wa345 enable row level security;
revoke all on public.site_files_bak_wa345 from anon, authenticated;
grant all on public.site_files_bak_wa345 to service_role;
comment on table public.site_files_bak_wa345 is 'wave345 (15/11/26): index.html before wave345, for its undo. Drop after a week.';
create table if not exists public.wa345_undo (k text primary key, v text, saved_at timestamptz default now());
alter table public.wa345_undo enable row level security;
revoke all on public.wa345_undo from anon, authenticated;
grant all on public.wa345_undo to service_role;
comment on table public.wa345_undo is 'wave345 (15/11/26): the four email functions as they were before wave345, for its undo. Drop after a week.';

do $pg$
declare v text; v_new text; n int; i int; sz int; o text; nw text;
  olds text[] := array[
  replace($o0${ h: '#volunteering/setup', l: 'Setup', ic: 'layers', page: 'volunteering' }$o0$, chr(13), ''),
  replace($o1$['setup', 'Setup', '#volunteering/setup', 'setup']$o1$, chr(13), ''),
  replace($o2$['setup', 'Setup', '#volunteering/setup']]$o2$, chr(13), ''),
  replace($o3$ conversation, group texts and calls'], setup: ['Setup', 'The usual spot counts, role owners, the message schedule and the page tour']$o3$, chr(13), ''),
  replace($o4$not know ---------- */
  var TITLES = { setup: ['Setup', 'The usual spot counts, role owners, the message schedule and the page tour']$o4$, chr(13), ''),
  replace($o5$the Thursday check-in, see Setup)$o5$, chr(13), ''),
  replace($o6$The SOP and Setup.$o6$, chr(13), ''),
  replace($o7$Loading the setup\u2026$o7$, chr(13), ''),
  replace($o8$Could not load the setup: $o8$, chr(13), ''),
  replace($o9$    await loadSetup(true);
    try { if (window.w258v$o9$, chr(13), ''),
  replace($o10$    h += '<section class="w259card" id="w259how"><h3>How the Volunteer Manager works</h3><p class="lead">A short tour of the Events page and an event\u2019s five tabs.$o10$, chr(13), ''),
  replace($o11$+ E(sched(c)) + '</span></div>';$o11$, chr(13), ''),
  replace($o12$var TABS = [['team', 'Team'], ['todo', 'To do'], ['messages', 'Messages'], ['plan', 'Plan'], ['wrap', 'Wrap up']];$o12$, chr(13), ''),
  replace($o13$/* =====================================================================
   WA v110 boot veil + self-provisioning$o13$, chr(13), '')];
  news text[] := array[
  replace($n0${ h: '#volunteering/setup', l: 'Settings', ic: 'layers', page: 'volunteering' }$n0$, chr(13), ''),
  replace($n1$['setup', 'Settings', '#volunteering/setup', 'setup']$n1$, chr(13), ''),
  replace($n2$['setup', 'Settings', '#volunteering/setup']]$n2$, chr(13), ''),
  replace($n3$ conversation, group texts and calls'], setup: ['Settings', 'The staffing rules, who emails come from, automatic messages, role owners and the page tour']$n3$, chr(13), ''),
  replace($n4$not know ---------- */
  var TITLES = { setup: ['Settings', 'The staffing rules, who emails come from, automatic messages, role owners and the page tour']$n4$, chr(13), ''),
  replace($n5$the Thursday check-in, see Settings)$n5$, chr(13), ''),
  replace($n6$The SOP and Settings.$n6$, chr(13), ''),
  replace($n7$Loading the settings\u2026$n7$, chr(13), ''),
  replace($n8$Could not load the settings: $n8$, chr(13), ''),
  replace($n9$    await loadSetup(true);
    try { if (window.w345 && w345.load) await w345.load(); } catch (e) { /* the older cards still show */ }   /* WA v345 */
    try { if (window.w258v$n9$, chr(13), ''),
  replace($n10$    h += (window.w345 && w345.html ? w345.html() : '');   /* WA v345: the staffing rules, emails, automatic messages, the community link */
    h += '<section class="w259card" id="w259how"><h3>How the Volunteer Manager works</h3><p class="lead">A short tour of the Events page and an event\u2019s tabs.$n10$, chr(13), ''),
  replace($n11$+ E(sched(c)) + '</span></div>' + (window.w345 && w345.eventLine ? w345.eventLine(w, can) : '');   /* WA v345 */$n11$, chr(13), ''),
  replace($n12$var TABS = [['team', 'Team'], ['todo', 'To do'], ['messages', 'Messages'], ['plan', 'Plan'], ['day', 'Itinerary'], ['wrap', 'Wrap up']];   /* WA v346: the itinerary and the run, out of Plan */$n12$, chr(13), ''),
  replace($n13$/* =====================================================================
   WA v345 (14/11/26): Settings for the Montreal Volunteer Manager.
   Steel: "All of these edits I'm making should be a settings tab in the volunteer manager for montreal if Ops leads decide to change
   settings they should have the ability to do so. It should also be where they decide automated texts and emails but it can be
   overrided in each event if wanted." and "All leaders can make these changes, so in the admin center it's anyone that is a lead."
   Setup is now Settings. Its new cards: Staffing rules (the minimum of cooks, servers per cook, the most cooks, the most pick-ups,
   community leads), Emails to volunteers (from the role's owner; who replies go to), Automatic messages (Montreal's emails and texts,
   the same switches as an event's Messages tab), Community (the WhatsApp link). Leads and admins change them (wa345_settings_save);
   everyone on the team can read them. Each event's Messages tab gets "This event": use Montreal's setting, or its own
   (volunteer_events.confirm_channels, which the rounds already obey: wa297_channel).
   ===================================================================== */
(function () {
  if (window.w345) return;
  var ST = { data: null, loading: false, err: '', ev: {}, busy: false };
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function staff() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function say(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function msgOf(e) { return String((e && (e.message || e.details)) || e || '').replace(/^.*?ERROR:\s*/, '').slice(0, 200); }
  function onSetup() { try { return typeof WA_VOL_VIEW !== 'undefined' && WA_VOL_VIEW === 'setup'; } catch (e) { return false; } }
  function rerender() { try { if (onSetup() && window.w259 && w259.renderSetup) w259.renderSetup(); } catch (e) { /* fine */ } }
  async function load(force) {
    if (ST.loading || (ST.data && !force)) return ST.data;
    ST.loading = true;
    try { var r = await db.rpc('wa345_settings_get'); if (r && r.error) throw r.error; ST.data = r.data || {}; ST.err = ''; } catch (e) { ST.err = msgOf(e) || 'no answer'; }
    ST.loading = false; return ST.data;
  }
  function card(id, title, body, foot) { return '<section class="w259card" id="' + id + '"><h3>' + E(title) + '</h3>' + body + (foot ? '<div class="ft">' + foot + '</div>' : '') + '</section>'; }
  function num(k, label, hint, v, min, max, can) { return '<label><span>' + E(label) + (hint ? '<i class="w345h">' + E(hint) + '</i>' : '') + '</span><input type="number" inputmode="numeric" min="' + min + '" max="' + max + '" value="' + E(v == null ? '' : v) + '" data-w345n="' + k + '"' + (can ? '' : ' disabled') + '></label>'; }
  function html() {
    if (!staff()) return '';
    if (!ST.data) {
      if (!ST.loading && !ST.err) load().then(rerender);
      return card('w345rules', 'Staffing rules', '<p class="m" role="status">' + (ST.err ? 'Could not load the settings: ' + E(ST.err) + '. Reload the page to try again.' : 'Loading the settings…') + '</p>');
    }
    var d = ST.data, can = !!d.can, who = can ? '' : '<span class="m">Leads and admins change these (Admin centre, People and access).</span>';
    var h = card('w345rules', 'Staffing rules',
      '<p class="lead">The rules every Montreal serving starts from. Cooks are a minimum: every cook the team adds opens more server spots, up to the most one serving takes.</p>'
      + '<div class="w259spots w345grid">'
      + num('cook_min', 'Cooks, at least', 'the minimum for a serving', d.cook_min, 1, 15, can)
      + num('per_cook', 'Servers per cook', '0 switches the rule off', d.per_cook, 0, 6, can)
      + num('cooks_max', 'Cooks, at most', 'at one serving', d.cooks_max, 1, 40, can)
      + num('pickups_max', 'Pick-ups, at most', 'cooks whose food we collect', d.pickups_max, 0, 40, can)
      + num('community_leads', 'Community leads', '2 on conversations, 1 on the count', d.community_leads, 0, 10, can)
      + '</div>',
      can ? '<button type="button" class="w259b pri" data-w345go="rules"' + (ST.busy ? ' disabled' : '') + '>Save the rules</button><span class="m">The other roles are under The usual spot counts, below.</span>' : who);
    var rd = String(d.reply_default || 'sender');
    h += card('w345mail', 'Emails to volunteers',
      '<p class="lead">Who an email to volunteers comes from, and who their replies reach.</p>'
      + '<label class="sw w345sw"><input type="checkbox" data-w345sw="owner_from"' + (String(d.owner_from) === 'on' ? ' checked' : '') + (can && d.owner_ready ? '' : ' disabled') + '><span>Send from the role’s owner (for example “Mary, Welfare Avenue” for cooks). Off: from volunteer@welfareavenue.com.' + (d.owner_ready ? '' : ' <i class="w345h">Not available yet: it arrives with the next update to the Hub’s mail sender. Until then every email comes from volunteer@welfareavenue.com.</i>') + '</span></label>'
      + '<label class="w345row"><span>Replies go to</span><select data-w345sel="reply_default"' + (can ? '' : ' disabled') + '>'
      + [['sender', 'The person who pressed Send'], ['owner', 'The role’s owner'], ['volunteer', 'volunteer@welfareavenue.com (the ops team)']].map(function (o) { return '<option value="' + o[0] + '"' + (rd === o[0] ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('')
      + ((d.team || []).length ? '<optgroup label="One person on the team">' + (d.team || []).map(function (m) { var em = String(m.email || '').toLowerCase(); return '<option value="' + E(em) + '"' + (rd === em ? ' selected' : '') + '>' + E(m.name || em) + '</option>'; }).join('') + '</optgroup>' : '')
      + '</select></label><p class="m">For Montreal events. A round nobody presses Send on (an automatic one) replies to the role’s owner, unless a person or the ops inbox is chosen here.</p>',
      can ? '<button type="button" class="w259b pri" data-w345go="mail"' + (ST.busy ? ' disabled' : '') + '>Save</button>' : who);
    var a = d.auto || {}, ca = !!d.can_auto;
    h += card('w345auto', 'Automatic messages',
      '<p class="lead">' + (a.emails || a.texts ? 'Each round goes out by itself on its date.' : '<b>Off:</b> nothing goes out by itself. A person reviews each round and sends it from the event’s Messages tab.') + ' This is the setting for every Montreal event; one event can use its own (its Messages tab, This event).</p>'
      + '<label class="sw w345sw"><input type="checkbox" data-w345auto="emails"' + (a.emails ? ' checked' : '') + (ca ? '' : ' disabled') + '><span>Emails go out by themselves</span></label>'
      + '<label class="sw w345sw"><input type="checkbox" data-w345auto="texts"' + (a.texts ? ' checked' : '') + (ca ? '' : ' disabled') + '><span>Texts go out by themselves</span></label>',
      ca ? '<span class="m">The dates of each round are under the message schedule, below.</span>' : '<span class="m">The team that runs Montreal volunteers changes these.</span>');
    h += card('w345wa', 'Community',
      '<p class="lead">The WhatsApp community link the welcome emails invite new volunteers to.</p>'
      + '<label class="w345row"><span>Invite link</span><input type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://chat.whatsapp.com/…" value="' + E(d.whatsapp || '') + '" data-w345in="whatsapp"' + (can ? '' : ' disabled') + '></label>'
      + '<p class="m">If an admin of the community resets the link, paste the new one here: the welcome emails follow. Emails already sent keep the old one.</p>',
      can ? '<button type="button" class="w259b pri" data-w345go="wa"' + (ST.busy ? ' disabled' : '') + '>Save the link</button>' : who);
    return h;
  }
  async function save(p, okMsg) {
    if (ST.busy) return; ST.busy = true;
    try {
      var r = await db.rpc('wa345_settings_save', { p: p }); if (r && r.error) throw r.error;
      ST.data = r.data || ST.data; say(okMsg);
      try { if (window.w342 && w342.load) w342.load(true); } catch (e) { /* the Events page reloads on its own */ }
    } catch (e) { say('Could not save: ' + msgOf(e)); }
    ST.busy = false; rerender();
  }
  function val(k) { var el = document.querySelector('[data-w345n="' + k + '"]'); if (!el || el.value === '') return null; var n = Math.round(Number(el.value)); return isFinite(n) ? n : null; }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-w345go]') : null; if (!b) return;
    e.preventDefault(); var go = b.getAttribute('data-w345go');
    if (go === 'rules') {
      var p = {}; ['cook_min', 'per_cook', 'cooks_max', 'pickups_max', 'community_leads'].forEach(function (k) { var v = val(k); if (v != null) p[k] = v; });
      if (p.cook_min != null && p.cooks_max != null && p.cooks_max < p.cook_min) { say('The most cooks cannot be fewer than the minimum.'); return; }
      save(p, 'The staffing rules are saved');
    } else if (go === 'mail') {
      var sw = document.querySelector('[data-w345sw="owner_from"]'), sel = document.querySelector('[data-w345sel="reply_default"]'), pm = { reply_default: sel ? sel.value : 'sender' };
      if (sw && !sw.disabled) pm.owner_from = sw.checked ? 'on' : 'off';
      save(pm, 'Saved');
    } else if (go === 'wa') {
      var inp = document.querySelector('[data-w345in="whatsapp"]'); save({ whatsapp: inp ? String(inp.value || '').trim() : '' }, 'The link is saved');
    }
  });
  document.addEventListener('change', async function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    if (t.hasAttribute('data-w345auto')) {
      var em = document.querySelector('[data-w345auto="emails"]'), tx = document.querySelector('[data-w345auto="texts"]');
      t.disabled = true;
      try { var r = await db.rpc('wa297_auto_set', { p_city: 'montreal', p_texts: !!(tx && tx.checked), p_emails: !!(em && em.checked) }); if (r && r.error) throw r.error;
        if (ST.data) ST.data.auto = { emails: !!(em && em.checked), texts: !!(tx && tx.checked) }; say('Saved for every Montreal event');
        try { if (window.w297 && w297.reload) w297.reload(); } catch (x) { /* fine */ } }
      catch (err) { t.checked = !t.checked; say('Could not change it: ' + msgOf(err)); }
      t.disabled = false; rerender(); return;
    }
    if (t.hasAttribute('data-w345ev')) {
      var id = Number(t.getAttribute('data-w345ev')), v = t.value, was = ST.ev[id] ? ST.ev[id].v : '';
      t.disabled = true;
      try { var r2 = await db.rpc('wa345_event_channels', { p_event: id, p_value: v }); if (r2 && r2.error) throw r2.error; ST.ev[id] = { v: v }; say(v ? 'This event uses its own setting' : 'This event uses the Montreal setting'); }
      catch (err2) { t.value = was; say('Could not change it: ' + msgOf(err2)); }
      t.disabled = false; try { if (window.w297 && w297.paint) w297.paint(); } catch (x2) { /* fine */ }
    }
  });
  /* an event's Messages tab: this event's own setting (Montreal events) */
  function eventLine(w, can) {
    if (!w || w.city !== 'montreal' || !staff()) return '';
    var c = ST.ev[w.id];
    if (c === undefined) {
      ST.ev[w.id] = null;
      db.from('volunteer_events').select('id,confirm_channels').eq('id', w.id).limit(1).then(function (r) { var row = ((r && r.data) || [])[0] || {}; ST.ev[w.id] = { v: String(row.confirm_channels || '') }; try { if (window.w297 && w297.paint) w297.paint(); } catch (e) { /* fine */ } });
      return '';
    }
    if (!c) return '';
    var opts = [['', 'Use the Montreal setting'], ['both', 'Emails and texts go by themselves'], ['email', 'Emails go by themselves'], ['text', 'Texts go by themselves'], ['none', 'Nothing goes by itself']];
    return '<div class="auto w345ev"><span class="lb">This event</span><select data-w345ev="' + E(w.id) + '" aria-label="Automatic messages for this event"' + (can ? '' : ' disabled') + '>' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (c.v === o[0] ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('') + '</select>'
      + '<span class="nt">' + (c.v ? 'This event has its own setting.' : 'Change it for this event only; Settings holds the one for every Montreal event.') + '</span></div>';
  }
  var st = document.createElement('style'); st.id = 'wa345css';
  st.textContent = '#volunteering .w345grid label span{display:block;}#volunteering .w345h{display:block;font-style:normal;font-weight:400;font-size:11.5px;color:#585B57;}'
    + '#volunteering .w345sw{display:flex;align-items:flex-start;gap:10px;margin:8px 0;font-size:14px;line-height:1.4;cursor:pointer;}#volunteering .w345sw input{width:18px;height:18px;flex:0 0 18px;margin-top:2px;}'
    + '#volunteering .w345row{display:grid;grid-template-columns:minmax(110px,auto) minmax(0,1fr);align-items:center;gap:8px 12px;margin:10px 0;font-size:14px;font-weight:600;color:#103F39;}'
    + '#volunteering .w345row select,#volunteering .w345row input{min-height:40px;padding:7px 10px;border:1px solid rgba(16,63,57,.24);border-radius:10px;background:#fff;font:inherit;font-weight:400;color:#1F201E;min-width:0;width:100%;box-sizing:border-box;}'
    + '.w297box .w345ev select{min-height:34px;padding:4px 8px;border:1px solid rgba(16,63,57,.24);border-radius:8px;background:#fff;font:inherit;font-size:13px;max-width:100%;}'
    + '@media (max-width:600px){#volunteering .w345row{grid-template-columns:minmax(0,1fr);}}@media (pointer:coarse){#volunteering .w345row select,#volunteering .w345row input,#volunteering .w345grid input,.w297box .w345ev select{font-size:16px;}}';
  document.head.appendChild(st);
  window.w345 = { html: html, eventLine: eventLine, load: load, state: function () { return ST; } };
})();

/* =====================================================================
   WA v346 (14/11/26): a calmer event page for the Montreal Volunteer Manager.
   Steel, with screenshots of the Team and Messages tabs: "This whole layout here, is still a little messy" and "it needs to look
   more cleaner". Nothing is taken away; what changes is what shows first.
   - Team: a person's card is two lines (a status dot, the name, one line that says where they stand and what is still missing).
     A tap opens everything the card had (status, move, contact, the cook's food plan, the community lead's job, the history,
     Answers and messages). Open cards stay open through repaints; "Open all" shows every card in full.
   - Next up: one ordered list in one surface, one button a row, the first one gold.
   - Messages: the rounds, the automatic switches and the Texts card share one surface style; the rounds line up as equal cells.
   - Plan: the plan, then the cooks and their recipes (the cooks who cannot make it fold away), then the content brief. The counts and
     the cars it repeated from the header and the Team tab no longer show here.
   - Itinerary (a tab of its own): the day's contact sheet first, then the itinerary by role and the drivers' run.
   - Wrap up: a Photos card. The Hub cannot look inside Google Photos, so a person ticks "The photos are in" (wa346_photos).
   The columns still stop at about 500px and scroll for a long list (Steel, 01/10/26); two-line cards mean eight people show first.
   ===================================================================== */
(function () {
  if (window.w346) return;
  var ST = { open: {}, all: false, ev: null, t: 0, gone: false, ph: {}, phBusy: false };
  function evId() { var m = String(location.hash || '').match(/^#volunteering\/e\/(\d+)/); return m ? m[1] : null; }
  function txt(el) { return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function noTime(s) { return String(s || '').replace(/,?\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?/ig, '').replace(/\s+·\s*$/, '').trim(); }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* one line for a closed card, read from what the card itself shows */
  function line(pc) {
    var ok = [], warn = [];
    var sel = pc.querySelector('select[data-vlrstat]'), st = sel && sel.options[sel.selectedIndex] ? txt(sel.options[sel.selectedIndex]) : '';
    var gone = /can.t make it|cancelled/i.test(st);
    var tag = pc.querySelector('.w171tag'), tt = tag ? txt(tag).replace(/^[✓✓]\s*/, '') : '';
    if (tag && /^confirmed/i.test(tt)) { var d = tt.match(/·\s*([A-Za-zéû]{3,9}\.? \d{1,2})/); ok.push('Confirmed' + (d ? ' ' + d[1] : '')); }
    else if (st && !/^no status$/i.test(st)) ok.push(st);
    else warn.push('No status yet');
    if (tag && !/^confirmed/i.test(tt) && tt) (!tag.classList.contains('ok') && /no answer|not |no |waiting|declin|can.t|texted|emailed/i.test(tt) ? warn : ok).push(noTime(tt));
    if (!gone) {
      var serve = pc.querySelector('[data-w342serve]'), plan = pc.querySelector('.w304');
      if (serve && serve.getAttribute('aria-pressed') === 'true') ok.push('Brings it and serves');
      else if (plan) { var f = plan.querySelector('[data-w304f].on'); if (f) ok.push(txt(f)); else warn.push('Food plan not set'); }
      var jobs = pc.querySelectorAll('[data-w342job][data-v="talk"],[data-w342job][data-v="count"]');
      if (jobs.length) { var on = Array.prototype.filter.call(jobs, function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0]; if (on) ok.push(txt(on)); else warn.push('No job yet'); }
      var chip = pc.querySelector('.w342jobs .w342chip'); if (chip) ok.push(txt(chip));
      Array.prototype.slice.call(pc.querySelectorAll('.w258t:not(.ok), .flag, .w342lent')).slice(0, 2).forEach(function (c) { var t = txt(c).replace(/×$/, '').trim(); if (t && t.length < 46) (/not |no /i.test(t) ? warn : ok).push(t); });
    }
    return E(ok.join(' · ')) + (warn.length ? (ok.length ? ' · ' : '') + '<em>' + E(warn.join(' · ')) + '</em>' : '');
  }
  function dress() {
    var root = document.getElementById('w119'); if (!root) return;
    var id = evId(); if (!id) { root.removeAttribute('data-w346'); return; }
    if (ST.ev !== id) { ST.ev = id; ST.open = {}; ST.all = false; }
    if (root.getAttribute('data-w346') !== 'on') root.setAttribute('data-w346', 'on');
    var board = root.querySelector('#w191team .board');
    if (board && !root.querySelector('.w346bar')) {
      var bar = document.createElement('div'); bar.className = 'w346bar';
      bar.innerHTML = '<span>Tap a person to open their details.</span><button type="button" data-w346all="1" aria-pressed="false">Open all</button>';
      board.parentNode.insertBefore(bar, board);
    }
    plan(root); photos(root, id);
    var ab = root.querySelector('[data-w346all]');
    if (ab) { var want = ST.all ? 'Close all' : 'Open all'; if (ab.textContent !== want) ab.textContent = want; if (ab.getAttribute('aria-pressed') !== String(ST.all)) ab.setAttribute('aria-pressed', String(ST.all)); }
    root.querySelectorAll('.pc[data-w119card]').forEach(function (pc) {
      var k = pc.getAttribute('data-w119card'), nm = pc.querySelector(':scope > b'); if (!nm) return;
      var open = ST.all ? ST.open[k] !== false : ST.open[k] === true;
      var ch = pc.querySelector(':scope > .w346ch');
      if (!ch) {
        ch = document.createElement('button'); ch.type = 'button'; ch.className = 'w346ch'; ch.setAttribute('data-w346t', k);
        ch.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        nm.insertAdjacentElement('afterend', ch);
      }
      var lab = (open ? 'Close ' : 'Open ') + txt(nm) + '’s details';
      if (ch.getAttribute('aria-label') !== lab) ch.setAttribute('aria-label', lab);
      if (ch.getAttribute('aria-expanded') !== String(open)) ch.setAttribute('aria-expanded', String(open));
      var s = pc.querySelector(':scope > .w346s');
      if (!s) { s = document.createElement('span'); s.className = 'w346s'; ch.insertAdjacentElement('afterend', s); }
      var h = line(pc); if (s.__h !== h) { s.__h = h; s.innerHTML = h; }
      if (open) { if (!pc.hasAttribute('data-w346open')) pc.setAttribute('data-w346open', '1'); }
      else if (pc.hasAttribute('data-w346open')) pc.removeAttribute('data-w346open');
    });
  }
  /* Plan: mark what repeats other tabs, fold the cooks who cannot make it */
  function plan(root) {
    var sum = root.querySelector('#w191stages .w191stage[data-stage="plan"] .w31sum'); if (!sum) return;
    sum.querySelectorAll(':scope > .row').forEach(function (r) {
      var t = txt(r), rep = /checklist steps/i.test(t) || /^Cars:/i.test(t);
      if (rep && !r.hasAttribute('data-w346rep')) r.setAttribute('data-w346rep', '1');
    });
    var rows = sum.querySelectorAll('.w31cook'), n = 0, host = null;
    rows.forEach(function (c) {
      host = host || c.parentNode;
      var st = txt(c.querySelector(':scope > .b')), g = /unavailable|cancel|can.t|declin/i.test(st);
      if (g) n++;
      if (g !== c.hasAttribute('data-w346gone')) { if (g) c.setAttribute('data-w346gone', '1'); else c.removeAttribute('data-w346gone'); }
    });
    if (!host) return;
    var want = ST.gone ? 'open' : 'shut'; if (host.getAttribute('data-w346cooks') !== want) host.setAttribute('data-w346cooks', want);
    var tg = host.querySelector(':scope > .w346gt');
    if (!n) { if (tg) tg.remove(); return; }
    if (!tg) { tg = document.createElement('button'); tg.type = 'button'; tg.className = 'w346gt'; tg.setAttribute('data-w346gone', '1'); host.appendChild(tg); }
    var lab = ST.gone ? 'Hide the ' + n + ' who can\u2019t make it' : n + (n === 1 ? ' cook' : ' cooks') + ' can\u2019t make it: show';
    if (tg.textContent !== lab) tg.textContent = lab;
    if (tg.getAttribute('aria-expanded') !== String(ST.gone)) tg.setAttribute('aria-expanded', String(ST.gone));
  }
  /* Wrap up: are the photos in the album? */
  function photosHtml(d) {
    var ppl = (d.people || []).map(function (x) { return E(x.name) + ' (' + E(String(x.role || '').replace('_', ' ')) + (x.status ? ', ' + E(String(x.status).toLowerCase()) : '') + ')'; });
    var h = '<h4>Photos</h4><p class="w346pw">' + (ppl.length ? ppl.join(' \u00b7 ') : 'No photographer on this event.') + '</p>';
    h += d.in_at ? '<p class="w346pi ok">\u2713 The photos are in the album' + (d.by ? ', marked by ' + E(d.by) : '') + (d.when ? ' on ' + E(d.when) : '') + '.</p>'
      : '<p class="w346pi">Not marked yet. The Hub cannot look inside Google Photos, so someone ticks this once the photos are there.</p>';
    h += '<div class="w191line">' + (d.album ? '<a class="w191btn ghost" href="' + E(d.album) + '" target="_blank" rel="noopener">Open the album</a>' : '<span class="w346pn">No album link yet: set it on the Plan tab, under Content.</span>')
      + (d.can === false ? '' : d.in_at ? '<button type="button" class="w191btn quiet" data-w346ph="off">Not in yet</button>' : '<button type="button" class="w191btn gold" data-w346ph="on">The photos are in</button>') + '</div>';
    return h;
  }
  function photos(root, id) {
    var b = root.querySelector('#w191stages .w191stage[data-stage="wrap_up"] > .b'); if (!b || root.getAttribute('data-w307tab') !== 'wrap') return;
    var c = ST.ph[id];
    if (c === undefined) {
      ST.ph[id] = null;
      try { db.rpc('wa346_photos', { p_event: Number(id), p_on: null }).then(function (r) { ST.ph[id] = (r && !r.error && r.data) ? r.data : false; soon(); }); } catch (e) { ST.ph[id] = false; }
      return;
    }
    if (!c) return;
    var card = b.querySelector(':scope > #w346photos');
    if (!card) { card = document.createElement('div'); card.id = 'w346photos'; card.className = 'cardy w346photos'; var sv = b.querySelector(':scope > #w174survey'); if (sv) sv.insertAdjacentElement('afterend', card); else b.appendChild(card); }
    var h = photosHtml(c); if (card.__h !== h) { card.__h = h; card.innerHTML = h; }
  }
  async function markPhotos(on) {
    var id = evId(); if (!id || ST.phBusy) return; ST.phBusy = true;
    try { var r = await db.rpc('wa346_photos', { p_event: Number(id), p_on: on }); if (r && r.error) throw r.error; ST.ph[id] = r.data; try { toast(on ? 'Marked: the photos are in the album' : 'Marked as not in yet'); } catch (e) { /* fine */ } }
    catch (e) { try { toast('Could not save: ' + String((e && e.message) || e).slice(0, 160)); } catch (x) { /* fine */ } }
    ST.phBusy = false; try { dress(); } catch (e) { /* fine */ }
  }
  function soon() { if (ST.t) return; ST.t = setTimeout(function () { ST.t = 0; try { dress(); } catch (e) { /* the page still works in full */ } }, 90); }   /* a throttle, not a debounce: the page repaints often */
  function toggle(k) {
    var open = ST.all ? ST.open[k] !== false : ST.open[k] === true;
    ST.open[k] = !open; try { dress(); } catch (e) { /* fine */ }
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var gt = t.closest('#w119 .w346gt'); if (gt) { ST.gone = !ST.gone; dress(); return; }
    var ph = t.closest('#w119 [data-w346ph]'); if (ph) { markPhotos(ph.getAttribute('data-w346ph') === 'on'); return; }
    var all = t.closest('#w119 [data-w346all]');
    if (all) { ST.all = !ST.all; ST.open = {}; dress(); return; }
    var pc = t.closest('#w119[data-w346="on"] .pc[data-w119card]'); if (!pc) return;
    var k = pc.getAttribute('data-w119card');
    if (t.closest('.w346ch')) { toggle(k); return; }
    if (t.closest('button,select,a,input,textarea,label,summary,[contenteditable]')) return;
    if (!pc.hasAttribute('data-w346open')) { toggle(k); return; }
    if (t.closest('.pc > b')) toggle(k);
  });
  function watch() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', watch); return; }
    try {
      new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) { var m = ms[i]; if (m.type === 'attributes' && m.target && m.target.classList && !m.target.classList.contains('pc')) continue; soon(); return; }
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] });
    } catch (e) { /* older browsers: the cards stay in full */ }
    soon();
  }
  watch();
  window.addEventListener('hashchange', soon);
  var G = '#103F39', MUT = '#5a6663', LINE = 'rgba(16,63,57,.10)', R = '#w119[data-w346="on"] ';
  var css = ''
    /* ---- Team: the bar, the card closed, the card open ---- */
    + R + '.w346bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 2px 10px;font-size:12.5px;color:' + MUT + ';}'
    + R + '.w346bar button{font:600 12.5px/1 inherit;font-family:inherit;color:' + G + ';background:none;border:1px solid rgba(16,63,57,.22);border-radius:999px;padding:8px 14px;cursor:pointer;touch-action:manipulation;transition:transform .12s cubic-bezier(.23,1,.32,1);}'
    + R + '.w346bar button:active{transform:scale(.97);}'
    + R + '.pc[data-w119card]{background:#fff;border:1px solid ' + LINE + ';box-shadow:none;border-radius:12px;padding:10px 40px 10px 30px;margin:0 0 6px;cursor:pointer;min-height:44px;box-sizing:border-box;}'
    + R + '.pc[data-w119card]:before{content:"";position:absolute;left:12px;top:16px;width:9px;height:9px;border-radius:50%;box-sizing:border-box;border:2px solid rgba(16,63,57,.32);background:transparent;}'
    + R + '.pc.s-confirmed[data-w119card]:before{border-color:#2A8C7A;background:#2A8C7A;}'
    + R + '.pc.s-waiting[data-w119card]:before{border-color:#DCA527;background:#DCA527;}'
    + R + '.pc.s-unavailable[data-w119card]:before,' + R + '.pc.s-cancelled[data-w119card]:before{border-color:#B3402F;background:transparent;}'
    + R + '.pc[data-w119card] > b{font-size:14px;font-weight:600;line-height:1.3;letter-spacing:-.005em;padding-right:0;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;}'
    + R + '.pc[data-w119card] > .w346s{display:block;margin-top:2px;font-size:12.5px;line-height:1.4;color:' + MUT + ';overflow-wrap:anywhere;}'
    + R + '.pc[data-w119card] > .w346s em{font-style:normal;font-weight:600;color:#8a5a00;}'
    + R + '.pc[data-w119card] > .w346ch{position:absolute;top:4px;right:4px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:0;background:none;border-radius:50%;color:' + MUT + ';cursor:pointer;padding:0;touch-action:manipulation;}'
    + R + '.pc[data-w119card] > .w346ch svg{transition:transform .18s cubic-bezier(.23,1,.32,1);}'
    + R + '.pc[data-w346open] > .w346ch svg{transform:rotate(180deg);}'
    + R + '.pc[data-w119card] > .w346ch:focus-visible{outline:2px solid ' + G + ';outline-offset:-4px;}'
    + R + '.pc[data-w119card]:not([data-w346open]) > :not(b):not(.w346s):not(.w346ch){display:none !important;}'
    + R + '.pc[data-w346open]{padding:10px 12px 12px 30px;border-color:rgba(16,63,57,.22);box-shadow:0 10px 24px -20px rgba(16,63,57,.55);cursor:default;}'
    + R + '.pc[data-w346open] > b{padding-right:64px;cursor:pointer;}'
    + R + '.pc[data-w346open] > .w346s{display:none;}'
    + R + '.pc[data-w346open] > .w346ch{right:30px;}'
    + R + '.pc[data-w346open] > .x{top:10px;right:6px;}'
    + R + '.pc[data-w346open] > .sel2{margin:10px 0 0 -18px;}'
    + R + '.pc[data-w346open] > :not(b):not(.w346s):not(.w346ch):not(.x):not(.sel2){margin-left:-18px;}'
    + R + '.pc[data-w346open] > .c{display:block;margin-top:8px;font-size:12.5px;color:' + MUT + ';white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;line-height:1.45;}'
    + R + '.pc[data-w346open] > .c a{color:' + G + ';font-weight:600;}'
    + R + '.pc[data-w346open] .w342jobs{display:flex;margin-top:8px;}'
    /* the history: plain lines, no pile of pills */
    + R + '.pc[data-w346open] .w171tag,' + R + '.pc[data-w346open] .w258t{display:block;background:none;border:0;border-radius:0;padding:0;margin:6px 0 0;font-size:12.5px;font-weight:500;line-height:1.4;color:' + MUT + ';white-space:normal;}'
    + R + '.pc[data-w346open] .w171tag.ok,' + R + '.pc[data-w346open] .w258t.ok{color:#1c6b5d;}'
    + R + '.pc[data-w346open] .w258t.ok:before{content:"\\2713\\00a0";}'
    + R + '.pc[data-w346open] .w258c{display:block;margin-top:2px;}'
    + R + '.pc[data-w346open] .w273a{background:none;border:0;border-radius:0;padding:0;margin:6px 0 0;}'
    + R + '.pc[data-w346open] .w273a p{margin:0;font-size:12.5px;line-height:1.4;color:' + MUT + ';}'
    + R + '.pc[data-w346open] .w273a p.h{font-weight:500;color:#1c6b5d;}'
    + R + '.pc[data-w346open]:has(> .w171tag.ok) .w273a p.h{display:none;}'
    + R + '.pc[data-w346open] .w304{border:0;background:rgba(16,63,57,.045);border-radius:10px;padding:10px;margin-top:10px;}'
    + R + '.pc[data-w346open] .w307ans{margin-top:10px;border:0;border-top:1px solid ' + LINE + ';border-radius:0;background:none;padding:10px 2px 0;width:100%;font-weight:600;color:' + G + ';}'
    + '@media (prefers-reduced-motion:no-preference){' + R + '.pc[data-w346open] > :not(b):not(.w346s):not(.w346ch):not(.x){animation:w346in .16s cubic-bezier(.23,1,.32,1);}}'
    + '@keyframes w346in{from{opacity:0;transform:translateY(-3px);}to{opacity:1;transform:none;}}'
    + '@media (hover:hover) and (pointer:fine){' + R + '.pc[data-w119card]:not([data-w346open]):hover{border-color:rgba(16,63,57,.24);}' + R + '.pc[data-w119card] > .w346ch:hover{background:rgba(16,63,57,.06);}' + R + '.w346bar button:hover{background:rgba(16,63,57,.05);}}'
    /* the role columns: quieter heads, the cooks' rules on one line */
    + R + '.board .rc{background:rgba(16,63,57,.035);padding:12px;}'
    + R + '.board .rc > .sub{margin-bottom:8px;}'
    + R + '.board .rc{max-height:min(680px,82vh);}'
    + R + '.board .rc .w342cl{display:block;font-size:12px;line-height:1.5;color:' + MUT + ';margin:-2px 0 10px;}'
    + R + '.board .rc .w342cl > span{display:inline;}' + R + '.board .rc .w342cl > span + span:before{content:" \\00b7 ";}'
    + R + '.board .rc .w342cl > span b{font-weight:600;color:inherit;}'
    + R + '.w342tray{background:#fff;border:1px solid rgba(220,165,39,.55);}'
    /* ---- Next up: one list ---- */
    + R + '#w191next .grid{display:block;background:#fff;border:1px solid ' + LINE + ';border-radius:14px;overflow:hidden;}'
    + R + '#w191next .n,' + R + '#w191next .n.act{display:grid;grid-template-columns:20px minmax(0,1fr);gap:12px;align-items:center;background:none;border:0;border-top:1px solid rgba(16,63,57,.08);border-radius:0;box-shadow:none;padding:12px 16px;}'
    + R + '#w191next .n:first-child{border-top:0;}'
    + R + '#w191next .n .go{width:8px;height:8px;margin:0 6px;font-size:0;color:transparent;background:#DCA527;}'
    + R + '#w191next .n > div{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:16px;align-items:center;}'
    + R + '#w191next .n > div > b{grid-column:1;font-size:14px;font-weight:600;line-height:1.35;}'
    + R + '#w191next .n > div > span{grid-column:1;font-size:12.5px;line-height:1.45;margin-top:1px;}'
    + R + '#w191next .n > div > .w191btn{grid-column:2;grid-row:1 / span 2;margin:0;padding:9px 14px;font-size:12.5px;white-space:nowrap;touch-action:manipulation;}'
    + R + '#w191next .n ~ .n .w191btn.gold{background:#fff;color:' + G + ';box-shadow:inset 0 0 0 1px rgba(16,63,57,.25);}'
    + '@media (max-width:640px){' + R + '#w191next .n > div{grid-template-columns:minmax(0,1fr);}' + R + '#w191next .n > div > .w191btn{grid-column:1;grid-row:auto;justify-self:start;margin-top:8px;}}'
    /* ---- Messages: one surface style ---- */
    + R + '.w258strip,' + R + '.w297box{background:#fff;border:1px solid ' + LINE + ';border-radius:14px;padding:16px 18px;margin:12px 0;}'
    + R + '.w258strip .hd,' + R + '.w297box .hd{display:block;margin-bottom:12px;}'
    + R + '.w258strip .hd b,' + R + '.w297box .hd b{display:block;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:' + G + ';}'
    + R + '.w258strip .hd span,' + R + '.w297box .hd span{display:block;margin-top:3px;font-size:13px;line-height:1.45;color:' + MUT + ';}'
    + R + '.w258strip .sch{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:8px;}'
    + R + '.w258strip .sch li{min-width:0;padding:10px 12px;gap:2px;border:0;border-radius:10px;background:rgba(16,63,57,.045);font-size:12.5px;}'
    + R + '.w258strip .sch li b{font-size:13px;font-weight:600;}'
    + R + '.w258strip .sch li i{font-size:12px;font-weight:600;margin-top:2px;}'
    + R + '.w258strip .sch li.done{box-shadow:inset 0 0 0 1px rgba(42,140,122,.45);background:rgba(42,140,122,.07);}'
    + R + '.w258strip .sch li.dl{background:rgba(220,165,39,.16);box-shadow:none;}'
    + R + '.w258strip .ft{margin-top:14px;padding-top:12px;border-top:1px solid rgba(16,63,57,.08);}'
    + R + '.w258strip .own{font-size:12.5px;line-height:1.5;color:' + MUT + ';}'
    + R + '.w297box .auto,' + R + '.w297box .now{margin:10px 0 0;gap:8px 10px;}'
    + R + '.w297box .lb{min-width:92px;font-size:13px;font-weight:600;}'
    + R + '.w297box .nt{font-size:12.5px;line-height:1.45;color:' + MUT + ';}'
    + R + '.w297box .sw{padding:7px 12px;font-size:13px;}'
    + R + '.w297box .w297b{padding:8px 14px;font-size:13px;touch-action:manipulation;}'
    + R + '.w171card .w171nums{display:flex;flex-wrap:wrap;gap:6px 28px;margin:10px 0 12px;}'
    + R + '.w171card .w171nums div{background:none;border-radius:0;padding:0;text-align:left;display:flex;align-items:baseline;gap:6px;}'
    + R + '.w171card .w171nums b{display:inline;font-size:22px;font-variant-numeric:tabular-nums;}'
    + R + '.w171card .w171nums span{display:inline;font-size:12.5px;margin:0;}'
    + R + '.w171card .w171note{font-size:12.5px;}';
  var T = '#w119.w307[data-w346="on"]';
  css += ''
    /* ---- the tabs: Plan keeps the plan; the Itinerary tab takes the getting-ready and the day ---- */
    + T + '[data-w307tab="plan"] .w191stage[data-stage="prepare"],' + T + '[data-w307tab="plan"] .w191stage[data-stage="day_of"]{display:none;}'
    + T + '[data-w307tab="plan"] .w191stage[data-stage="plan"]::before{display:none;}'
    + T + '[data-w307tab="day"] > #w191stages{display:flex;flex-direction:column;}'
    + T + '[data-w307tab="day"] .w191stage:not([data-stage="prepare"]):not([data-stage="day_of"]){display:none;}'
    + T + '[data-w307tab="day"] .w191stage > .b > .w191steps,' + T + '[data-w307tab="day"] .w191stage > .b > #w171card{display:none;}'
    + T + '[data-w307tab="day"] .w191stage[data-stage="day_of"]{order:1;}' + T + '[data-w307tab="day"] .w191stage[data-stage="prepare"]{order:2;}'
    /* ---- Plan ---- */
    + T + '[data-w307tab="plan"] .w191stage[data-stage="plan"] > .b{display:flex;flex-direction:column;}'
    + T + '[data-w307tab="plan"] .w191stage[data-stage="plan"] > .b > *{order:5;}'
    + T + '[data-w307tab="plan"] .w191stage[data-stage="plan"] > .b > .w191own{order:1;}'
    + T + '[data-w307tab="plan"] .w191stage[data-stage="plan"] > .b > .w31sum{order:2;}'
    + T + '[data-w307tab="plan"] .w191stage[data-stage="plan"] > .b > #w240content{order:8;}'
    + T + ' .w31sum > .row[data-w346rep]{display:none;}'
    + T + ' .w31sum .w33plan{display:flex;flex-wrap:wrap;align-items:center;gap:8px;border-bottom:0;padding:0 0 4px;margin:0 0 10px;font-size:14px;}'
    + T + ' .w31sum .w33plan input{margin:0;min-height:40px;}' + T + ' .w31sum .w33plan input[data-w33pn]{flex:1 1 240px;min-width:0;}'
    + T + ' .w31sum .w31cook{gap:4px 10px;padding:10px 0;border-top:1px solid rgba(16,63,57,.08);font-size:13px;}'
    + T + ' .w31sum .w31cook > b{flex:0 0 210px;max-width:100%;font-size:14px;font-weight:600;overflow-wrap:anywhere;}'
    + T + ' .w31sum .w31cook > .b{border:0;border-radius:0;background:none;padding:0;margin:0;font-size:12.5px;color:' + MUT + ';}'
    + T + ' .w31sum .w31cook > .b.ok{color:#1c6b5d;font-weight:600;}'
    + T + ' .w31sum .w31cook > .b + .b:before{content:"\\00b7\\00a0";color:' + MUT + ';font-weight:400;}'
    + T + ' .w31sum .w31cook > select{margin-left:auto;flex:0 1 230px;min-height:38px;}'
    + T + ' .w31sum [data-w346cooks="shut"] > .w31cook[data-w346gone]{display:none;}'
    + T + ' .w31sum .w31cook[data-w346gone]{opacity:.6;}'
    + T + ' .w31sum .w346gt{display:block;margin:10px 0 0;padding:8px 0;border:0;background:none;font:600 12.5px/1.3 inherit;font-family:inherit;color:' + G + ';cursor:pointer;text-decoration:underline;text-underline-offset:3px;touch-action:manipulation;}'
    + '@media (max-width:640px){' + T + ' .w31sum .w31cook > b{flex-basis:100%;}' + T + ' .w31sum .w31cook > select{margin-left:0;flex:1 1 100%;}}'
    /* ---- Itinerary ---- */
    + T + ' #w174card .w174roles{gap:8px 14px;font-size:13.5px;margin:10px 0 12px;align-items:baseline;}'
    + T + ' #w174card .w174roles b{font-variant-numeric:tabular-nums;white-space:nowrap;}'
    + T + ' #w174card > .w171note{font-size:12.5px;color:' + MUT + ';max-width:78ch;}'
    + T + ' #w174card > .w171btns .w171btn.ghost{padding:6px 12px;font-size:12px;font-weight:600;border-width:1px;}'
    + T + ' #w182blk{background:rgba(16,63,57,.045);color:#1F201E;padding:16px;margin-top:16px;}'
    + T + ' #w182blk .bgp{display:none;}'
    + T + ' #w182blk .ov{color:' + MUT + ';letter-spacing:.08em;}'
    + T + ' #w182blk h5{color:' + G + ';font-size:20px;margin:2px 0 8px;}'
    + T + ' #w182blk p{color:' + MUT + ';}'
    + T + ' #w182blk .w182st span{background:#fff;color:' + G + ';box-shadow:inset 0 0 0 1px rgba(16,63,57,.14);}'
    + T + ' #w182blk .w171btn.ghost{color:' + G + ';border-color:rgba(16,63,57,.25);background:#fff;}'
    /* ---- Wrap up: Photos ---- */
    + T + ' #w346photos .w346pw{margin:0 0 6px;font-size:13.5px;}' + T + ' #w346photos .w346pi{margin:0 0 10px;font-size:13px;color:' + MUT + ';}'
    + T + ' #w346photos .w346pi.ok{color:#1c6b5d;font-weight:600;}' + T + ' #w346photos .w346pn{font-size:12.5px;color:' + MUT + ';}';
  var st = document.createElement('style'); st.id = 'wa346css'; st.textContent = css; document.head.appendChild(st);
  soon();
  window.w346 = { dress: dress, line: line, state: function () { return ST; } };
})();

/* =====================================================================
   WA v110 boot veil + self-provisioning$n13$, chr(13), '')];
begin
  select string_agg(content, '' order by part) into v from public.site_files where path = 'index.html';
  if v is null then raise exception 'index.html not found'; end if;
  if (select count(*) from public.site_files where path = 'index.html') <> 10 then raise exception 'index.html is not in 10 parts'; end if;
  if position('window.w345 = ' in v) > 0 then raise exception 'index.html already has wave345'; end if;
  if md5(v) <> 'd0e8555c5d2052edb0da59f45cf7bda5' then raise notice 'index.html has moved since this file was made (md5 %): each edit applies only if it still matches', md5(v); end if;
  if not exists (select 1 from public.site_files_bak_wa345) then
    insert into public.site_files_bak_wa345 select path, part, content, updated_at from public.site_files where path = 'index.html';
  end if;
  insert into public.wa345_undo (k, v) select 'wa340_email_drain', pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'wa340_email_drain' on conflict (k) do nothing;
  insert into public.wa345_undo (k, v) select 'wa297_email_copy', pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'wa297_email_copy' on conflict (k) do nothing;
  insert into public.wa345_undo (k, v) select 'wa266_confirm_email', pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'wa266_confirm_email' on conflict (k) do nothing;
  insert into public.wa345_undo (k, v) select 'wa266f_email_drain', pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'wa266f_email_drain' on conflict (k) do nothing;
  if (select count(*) from public.wa345_undo where k in ('wa340_email_drain', 'wa297_email_copy', 'wa266_confirm_email', 'wa266f_email_drain')) <> 4 then raise exception 'could not save what the undo needs'; end if;
  execute $db345$
-- wave345 database part: Settings for the Montreal Volunteer Manager, an event's own automatic-messages setting,
-- who replies go to, and the Photos mark on Wrap up.

-- an event may say "nothing goes by itself" (wa297_channel already understands 'none')
alter table public.volunteer_events drop constraint if exists volunteer_events_confirm_channels_check;
alter table public.volunteer_events add constraint volunteer_events_confirm_channels_check
  check (confirm_channels is null or confirm_channels in ('text', 'email', 'both', 'none'));
alter table public.volunteer_events add column if not exists photos_in_at timestamptz;
alter table public.volunteer_events add column if not exists photos_in_by text;
comment on column public.volunteer_events.photos_in_at is 'wave345: when someone marked the photos as in the album (Wrap up, Photos).';

create or replace function public.wa345_settings_get() returns jsonb
language plpgsql stable security definer set search_path to '' as $f$
declare c jsonb;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into c from public.app_config
   where key in ('vol_servers_per_cook', 'vol_cooks_max', 'vol_pickups_max', 'mail_role_owner_from', 'mail_role_owner_ready', 'vol_reply_default',
                 'vol_auto_emails_montreal', 'vol_auto_texts_montreal', 'vol_whatsapp_community_url');
  return jsonb_build_object(
    'can', coalesce(public.is_wa_leader(), false),
    'can_auto', coalesce(public.wa297_can('montreal'), false),
    'cook_min', (select target from public.volunteer_role_guides where role = 'cook'),
    'community_leads', (select target from public.volunteer_role_guides where role = 'community_debrief'),
    'per_cook', coalesce(nullif(c->>'vol_servers_per_cook', '')::int, 2),
    'cooks_max', coalesce(nullif(c->>'vol_cooks_max', '')::int, 15),
    'pickups_max', coalesce(nullif(c->>'vol_pickups_max', '')::int, 6),
    'owner_from', coalesce(c->>'mail_role_owner_from', 'off'),
    'owner_ready', coalesce(c->>'mail_role_owner_ready', 'off') = 'on',
    'reply_default', coalesce(nullif(c->>'vol_reply_default', ''), 'sender'),
    'auto', jsonb_build_object('emails', coalesce(c->>'vol_auto_emails_montreal', 'off') = 'on', 'texts', coalesce(c->>'vol_auto_texts_montreal', 'off') = 'on'),
    'whatsapp', coalesce(c->>'vol_whatsapp_community_url', ''),
    'team', (select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'email', lower(m.email)) order by m.name), '[]'::jsonb)
               from public.team_members m where m.active and m.department = 'opsmtl' and lower(m.email) like '%@welfareavenue.com'));
end $f$;
revoke all on function public.wa345_settings_get() from public, anon;
grant execute on function public.wa345_settings_get() to authenticated, service_role;

create or replace function public.wa345_settings_save(p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $f$
declare v_who text := coalesce(auth.jwt()->>'email', 'staff'); k text; v text; o text; n int;
        v_cook int; v_max int; v_rule int; v_old text; v_new text;
        lims jsonb := '{"cook_min":[1,40],"cooks_max":[1,40],"per_cook":[0,6],"pickups_max":[0,40],"community_leads":[0,10]}'::jsonb;
        cfg jsonb := '{"cooks_max":"vol_cooks_max","per_cook":"vol_servers_per_cook","pickups_max":"vol_pickups_max"}'::jsonb;
begin
  if not coalesce(public.is_wa_leader(), false) then raise exception 'Only leads and admins change the Volunteer Manager settings.'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Nothing to save.'; end if;
  -- the numbers
  for k in select jsonb_object_keys(lims) loop
    if p ? k then
      if coalesce(p->>k, '') !~ '^\d{1,3}$' then raise exception 'That is not a whole number: %', replace(k, '_', ' '); end if;
      n := (p->>k)::int;
      if n < (lims->k->>0)::int or n > (lims->k->>1)::int then raise exception '% must be between % and %.', initcap(replace(k, '_', ' ')), lims->k->>0, lims->k->>1; end if;
    end if;
  end loop;
  v_cook := coalesce((p->>'cook_min')::int, (select target from public.volunteer_role_guides where role = 'cook'), 4);
  v_max := coalesce((p->>'cooks_max')::int, nullif((select value from public.app_config where key = 'vol_cooks_max'), '')::int, 15);
  if v_max < v_cook then raise exception 'The most cooks (%) cannot be fewer than the minimum (%).', v_max, v_cook; end if;
  for k in select jsonb_object_keys(lims) loop
    if not p ? k then continue; end if;
    v := (p->>k)::int::text;
    if k in ('cook_min', 'community_leads') then
      select target::text into o from public.volunteer_role_guides where role = case k when 'cook_min' then 'cook' else 'community_debrief' end;
      if o is distinct from v then
        update public.volunteer_role_guides set target = v::int where role = case k when 'cook_min' then 'cook' else 'community_debrief' end;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_role_guides', 'target', k, o, v, v_who);
      end if;
    else
      select value into o from public.app_config where key = cfg->>k;
      if o is distinct from v then
        insert into public.app_config (key, value) values (cfg->>k, v) on conflict (key) do update set value = excluded.value;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('app_config', cfg->>k, 'value', o, v, v_who);
      end if;
    end if;
  end loop;
  -- servers follow the cooks
  v_rule := coalesce(nullif((select value from public.app_config where key = 'vol_servers_per_cook'), '')::int, 0);
  if v_rule > 0 and (p ? 'cook_min' or p ? 'per_cook') then
    update public.volunteer_role_guides set target = v_cook * v_rule where role = 'server' and target is distinct from v_cook * v_rule;
  end if;
  -- who emails come from
  if p ? 'owner_from' then
    v := lower(coalesce(p->>'owner_from', ''));
    if v not in ('on', 'off') then raise exception 'Send from the role owner: on or off.'; end if;
    if v = 'on' and coalesce((select value from public.app_config where key = 'mail_role_owner_ready'), 'off') <> 'on' then
      raise exception 'Sending from the role owner is not available yet: it arrives with the next update to the mail sender.';
    end if;
    select value into o from public.app_config where key = 'mail_role_owner_from';
    if o is distinct from v then
      insert into public.app_config (key, value) values ('mail_role_owner_from', v) on conflict (key) do update set value = excluded.value;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('app_config', 'mail_role_owner_from', 'value', o, v, v_who);
    end if;
  end if;
  -- who replies go to
  if p ? 'reply_default' then
    v := lower(btrim(coalesce(p->>'reply_default', '')));
    if v not in ('sender', 'owner', 'volunteer')
       and not (v ~ '^[^@\s]+@welfareavenue\.com$' and exists (select 1 from public.team_members m where m.active and lower(m.email) = v)) then
      raise exception 'Replies go to: the person who pressed Send, the role owner, the ops inbox, or someone on the team.';
    end if;
    select value into o from public.app_config where key = 'vol_reply_default';
    if coalesce(o, 'sender') is distinct from v then
      insert into public.app_config (key, value) values ('vol_reply_default', v) on conflict (key) do update set value = excluded.value;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('app_config', 'vol_reply_default', 'value', o, v, v_who);
    end if;
  end if;
  -- the WhatsApp community link; the welcome emails follow
  if p ? 'whatsapp' then
    v_new := btrim(coalesce(p->>'whatsapp', ''));
    if v_new <> '' and v_new !~ '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{8,}(\?[A-Za-z0-9_=&.-]*)?$' then
      raise exception 'That does not look like a WhatsApp invite link (https://chat.whatsapp.com/...).';
    end if;
    select coalesce(value, '') into v_old from public.app_config where key = 'vol_whatsapp_community_url';
    v_old := coalesce(v_old, '');
    if v_old is distinct from v_new then
      if v_new = '' and exists (select 1 from public.crm_automations a where v_old <> '' and position(v_old in a.steps::text) > 0 and a.status = 'on') then
        raise exception 'The welcome emails use this link and are switched on. Paste the new link instead of clearing it.';
      end if;
      insert into public.app_config (key, value) values ('vol_whatsapp_community_url', v_new) on conflict (key) do update set value = excluded.value;
      if v_old <> '' and v_new <> '' then
        update public.crm_automations a set steps = replace(a.steps::text, v_old, v_new)::jsonb where position(v_old in a.steps::text) > 0;
      end if;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('app_config', 'vol_whatsapp_community_url', 'value', case when v_old = '' then null else 'a link' end, case when v_new = '' then 'cleared' else 'a new link' end, v_who);
    end if;
  end if;
  return public.wa345_settings_get();
end $f$;
revoke all on function public.wa345_settings_save(jsonb) from public, anon;
grant execute on function public.wa345_settings_save(jsonb) to authenticated, service_role;

create or replace function public.wa345_event_channels(p_event bigint, p_value text) returns jsonb
language plpgsql security definer set search_path to '' as $f$
declare v_who text := coalesce(auth.jwt()->>'email', 'staff'); v text := nullif(lower(btrim(coalesce(p_value, ''))), ''); o text; v_city text;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  if not exists (select 1 from public.volunteer_events e where e.id = p_event) then raise exception 'No such event.'; end if;
  v_city := public.wa297_city(p_event);
  if not public.wa297_can(v_city) then raise exception 'Only the team that runs % volunteers can change this.', initcap(v_city); end if;
  if v is not null and v not in ('text', 'email', 'both', 'none') then raise exception 'Choose emails, texts, both, nothing, or the % setting.', initcap(v_city); end if;
  select confirm_channels into o from public.volunteer_events where id = p_event;
  if o is distinct from v then
    update public.volunteer_events set confirm_channels = v where id = p_event;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_events', p_event::text, 'confirm_channels', coalesce(o, 'the ' || v_city || ' setting'), coalesce(v, 'the ' || v_city || ' setting') || ' (automatic messages, this event)', v_who);
  end if;
  return jsonb_build_object('value', coalesce(v, ''), 'channel', public.wa297_channel(p_event));
end $f$;
revoke all on function public.wa345_event_channels(bigint, text) from public, anon;
grant execute on function public.wa345_event_channels(bigint, text) to authenticated, service_role;

-- who a volunteer's reply reaches. Montreal follows Settings (vol_reply_default); Toronto is as before.
create or replace function public.wa345_reply_to(p_event bigint, p_role text, p_sender text default null) returns text
language plpgsql stable security definer set search_path to '' as $f$
declare s text := case when lower(coalesce(p_sender, '')) ~ '^[^@\s]+@welfareavenue\.com$' then lower(p_sender) end; o text; d text;
begin
  if p_event is null then return s; end if;
  o := public.wa297_reply_to(p_event, p_role);
  if public.wa297_city(p_event) = 'toronto' then return coalesce(s, o); end if;
  d := lower(coalesce(nullif((select value from public.app_config where key = 'vol_reply_default'), ''), 'sender'));
  return case when d = 'owner' then coalesce(o, s)
              when d = 'volunteer' then 'volunteer@welfareavenue.com'
              when d ~ '^[^@\s]+@welfareavenue\.com$' and exists (select 1 from public.team_members m where m.active and lower(m.email) = d) then d
              else coalesce(s, o) end;
end $f$;
revoke all on function public.wa345_reply_to(bigint, text, text) from public, anon;
grant execute on function public.wa345_reply_to(bigint, text, text) to authenticated, service_role;

-- Wrap up, Photos: read, or mark the photos as in the album (p_on true / false)
create or replace function public.wa346_photos(p_event bigint, p_on boolean default null) returns jsonb
language plpgsql security definer set search_path to '' as $f$
declare v_who text := lower(coalesce(auth.jwt()->>'email', 'staff')); e record;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  if p_on is not null then
    update public.volunteer_events set photos_in_at = case when p_on then now() end, photos_in_by = case when p_on then v_who end where id = p_event;
    if not found then raise exception 'No such event.'; end if;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_events', p_event::text, 'photos_in', null, case when p_on then 'the photos are in the album' else 'not in yet' end, v_who);
  end if;
  select id, photos_album_url, photos_in_at, photos_in_by into e from public.volunteer_events where id = p_event;
  if e.id is null then raise exception 'No such event.'; end if;
  return jsonb_build_object('album', nullif(btrim(coalesce(e.photos_album_url, '')), ''), 'in_at', e.photos_in_at,
    'by', case when e.photos_in_by is null then null else coalesce((select split_part(m.name, ' ', 1) from public.team_members m where lower(m.email) = e.photos_in_by limit 1), split_part(e.photos_in_by, '@', 1)) end,
    'when', case when e.photos_in_at is null then null else to_char(e.photos_in_at at time zone 'America/Toronto', 'FMMon FMDD') end,
    'people', (select coalesce(jsonb_agg(jsonb_build_object('name', r.person_name, 'role', r.role, 'status', r.status) order by r.role, r.person_name), '[]'::jsonb)
                 from public.event_roster r where r.event_id = p_event and r.role in ('photographer', 'videographer') and lower(coalesce(r.status, '')) not in ('cancelled', 'unavailable')));
end $f$;
revoke all on function public.wa346_photos(bigint, boolean) from public, anon;
grant execute on function public.wa346_photos(bigint, boolean) to authenticated, service_role;

-- the four places that write the reply address of a volunteer email now ask wa345_reply_to
do $patch$
declare d text; n text; old1 text := $o$'reply_to', public.wa297_reply_to(r.event_id, r.role)$o$; new1 text := $o$'reply_to', public.wa345_reply_to(r.event_id, r.role)$o$;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'wa340_email_drain';
  n := regexp_replace(d, 'v_reply := case when lower\(coalesce\(q\.sent_by.*?wa297_reply_to\(q\.event_id, v_role\) end;', 'v_reply := public.wa345_reply_to(q.event_id, v_role, q.sent_by);   -- wave345: Settings decides who replies reach');
  if n = d or position('wa345_reply_to(q.event_id, v_role, q.sent_by)' in n) = 0 then raise exception 'wa340_email_drain: the reply line was not found'; end if;
  execute n;
  foreach n in array array['wa297_email_copy', 'wa266_confirm_email', 'wa266f_email_drain'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = n;
    if d is null or (length(d) - length(replace(d, old1, ''))) / length(old1) <> 1 then raise exception '%: the reply line was not found once', n; end if;
    execute replace(d, old1, new1);
  end loop;
end $patch$;

insert into public.app_config (key, value) values ('vol_reply_default', 'sender') on conflict (key) do nothing;
insert into public.app_config (key, value) values ('mail_role_owner_ready', 'off') on conflict (key) do nothing;

$db345$;
  v_new := v;
  for i in 1..array_length(olds, 1) loop
    o := olds[i]; nw := news[i];
    n := (length(v_new) - length(replace(v_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'index.html: edit % matches % times (expected 1), nothing changed', i, n; end if;
    v_new := replace(v_new, o, nw);
  end loop;
  if md5(v) = 'd0e8555c5d2052edb0da59f45cf7bda5' and md5(v_new) <> '2b3d3fdf0c145b1bfdafabe2e3bb3311' then raise exception 'index.html: unexpected result %', md5(v_new); end if;
  if right(v_new, 8) <> E'</html>\n' then raise exception 'index.html: tail mismatch'; end if;
  sz := ceil(length(v_new) / 10.0);
  for i in 1..10 loop
    update public.site_files set content = substr(v_new, (i - 1) * sz + 1, sz), updated_at = now() where path = 'index.html' and part = i;
    if not found then raise exception 'index.html part % missing', i; end if;
  end loop;
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') <> md5(v_new) then raise exception 'index.html: post-check failed'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave345', md5(v), md5(v_new) || ': Settings for the Montreal Volunteer Manager; a calmer event page (closed cards, one Next up list, a shorter Plan, an Itinerary tab, Photos on Wrap up)', 'wave345');
end $pg$;
-- PUBLISH
select public.call_edge('host-sync', '{}'::jsonb) as host_sync,
  (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') as hub_md5;
