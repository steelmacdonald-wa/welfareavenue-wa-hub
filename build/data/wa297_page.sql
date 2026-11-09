-- wave297 page: Messages to volunteers (both cities) and the org chart tree. Built on the live page 0df3dfe6 (waves 300-301).
do $do$
declare cur text; whole text;
begin
  select string_agg(content, '' order by part) into whole from public.site_files where path = 'index.html';
  if md5(whole) = '61db595873b6dc34201d385307b4a63f' then raise notice 'wave297 already on the page'; return; end if;
  if md5(whole) <> '0df3dfe67734de147c8c576d0c2e6923' then raise exception 'The Hub page changed (md5 %). Nothing changed.', md5(whole); end if;
  select content into cur from public.site_files where path = 'index.html' and part = 5;
  if (length(cur) - length(replace(cur, $w297$        + '<div class="w133lv w133exec"><h3 data-w133drop="team:">Executive directors <span>day-to-day leadership; the team leads report to them</span></h3><div class="w133row">' + ex.map(function (p) { return cardHtml(X, p, ''); }).join('') + '</div></div>'
        + '<div class="w133link"></div>';
    }
    var cols = O.team ? [O.team] : teams();
    html += '<div class="w133grid">' + cols.map(function (d) { return teamCol(X, d, hs); }).join('') + '</div>';
    var other = hs.filter(function (p) { var t = seatTeam(p); return cols.indexOf(t) < 0 && (!O.team) && (O.showOpen || !isOpen(p)); });$w297$, ''))) / length($w297$        + '<div class="w133lv w133exec"><h3 data-w133drop="team:">Executive directors <span>day-to-day leadership; the team leads report to them</span></h3><div class="w133row">' + ex.map(function (p) { return cardHtml(X, p, ''); }).join('') + '</div></div>'
        + '<div class="w133link"></div>';
    }
    var cols = O.team ? [O.team] : teams();
    html += '<div class="w133grid">' + cols.map(function (d) { return teamCol(X, d, hs); }).join('') + '</div>';
    var other = hs.filter(function (p) { var t = seatTeam(p); return cols.indexOf(t) < 0 && (!O.team) && (O.showOpen || !isOpen(p)); });$w297$) <> 1 then raise exception 'edit 1: anchor not found once'; end if;
  update public.site_files set content = replace(cur, $w297$        + '<div class="w133lv w133exec"><h3 data-w133drop="team:">Executive directors <span>day-to-day leadership; the team leads report to them</span></h3><div class="w133row">' + ex.map(function (p) { return cardHtml(X, p, ''); }).join('') + '</div></div>'
        + '<div class="w133link"></div>';
    }
    var cols = O.team ? [O.team] : teams();
    html += '<div class="w133grid">' + cols.map(function (d) { return teamCol(X, d, hs); }).join('') + '</div>';
    var other = hs.filter(function (p) { var t = seatTeam(p); return cols.indexOf(t) < 0 && (!O.team) && (O.showOpen || !isOpen(p)); });$w297$, $w297$        + treeHtml(X, ex, hs);   /* wave297: each co-executive director with the teams that report to them */
    }
    var cols = O.team ? [O.team] : [];
    if (O.team) html += '<div class="w133grid">' + cols.map(function (d) { return teamCol(X, d, hs); }).join('') + '</div>';
    var other = [];$w297$), updated_at = now() where path = 'index.html' and part = 5;
  select content into cur from public.site_files where path = 'index.html' and part = 5;
  if (length(cur) - length(replace(cur, $w297$  function allUnder(X, p) {$w297$, ''))) / length($w297$  function allUnder(X, p) {$w297$) <> 1 then raise exception 'edit 2: anchor not found once'; end if;
  update public.site_files set content = replace(cur, $w297$  function allUnder(X, p) {$w297$, $w297$  /* wave297 (09/11/26): the tree. The board above; one column per co-executive director, their card on top and
     the teams that report to them underneath, joined by lines; HR and any lead who reports to no one sits in a
     last column, "Shared by the co-executive directors". A team chip still opens the team's own column. */
  function treeHtml(X, ex, hs) {
    var shown = function (p) { return O.showOpen || !isOpen(p); }, seen = {};
    var order = teams();
    function groups(list) {
      var by = {}, keys = [];
      list.forEach(function (p) { var t = seatTeam(p) || ''; if (!by[t]) { by[t] = []; keys.push(t); } by[t].push(p); });
      keys.sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      return keys.map(function (t) {
        var ppl = 0, open = 0;
        by[t].forEach(function (p) { [p].concat(allUnder(X, p)).forEach(function (s) { if (isOpen(s)) open++; else ppl++; }); });
        return '<div class="w297tm" data-team="' + E(t) + '" style="--tc:' + E(teamColor(t)) + '"><h4 data-w133drop="team:' + E(t) + '">' + E(teamLabel(t)) + ' <span>' + plural(ppl, 'person', 'people') + (open ? ', ' + plural(open, 'open position', 'open positions') : '') + '</span></h4>'
          + by[t].map(function (p) { return nodeHtml(X, p, t, seen, 0); }).join('') + '</div>';
      }).join('');
    }
    var cols = ex.map(function (e) {
      var under = hs.filter(function (p) { return String(p.reports_to) === String(e.id) && shown(p); });
      return '<div class="w297br"><div class="w297top">' + cardHtml(X, e, '') + '</div>'
        + (under.length ? '<div class="w297teams">' + groups(under) + '</div>' : '<p class="w297none">No team leads report here yet.</p>') + '</div>';
    });
    var shared = hs.filter(function (p) { return (p.reports_to == null || !isExec(X.byId[p.reports_to])) && shown(p); });
    if (shared.length) cols.push('<div class="w297br sh"><div class="w297top"><div class="w297shh"><b>Shared</b><span>by the co-executive directors</span></div></div><div class="w297teams">' + groups(shared) + '</div></div>');
    return '<div class="w133lv w133exec w297tree"><h3 data-w133drop="team:">Executive directors <span>each co-executive director, with the teams that report to them</span></h3><div class="w297row">' + cols.join('') + '</div></div>';
  }
  function allUnder(X, p) {$w297$), updated_at = now() where path = 'index.html' and part = 5;
  select content into cur from public.site_files where path = 'index.html' and part = 9;
  if (length(cur) - length(replace(cur, $w297$<b>Texts to volunteers</b><span>9 am to 7 pm, from the ops line. Each one once.</span>$w297$, ''))) / length($w297$<b>Texts to volunteers</b><span>9 am to 7 pm, from the ops line. Each one once.</span>$w297$) <> 1 then raise exception 'edit 3: anchor not found once'; end if;
  update public.site_files set content = replace(cur, $w297$<b>Texts to volunteers</b><span>9 am to 7 pm, from the ops line. Each one once.</span>$w297$, $w297$<b>Texts to volunteers</b><span>When texts are on (Messages to volunteers, below): 9 am to 7 pm, from the ops line. Each one once.</span>$w297$), updated_at = now() where path = 'index.html' and part = 9;
  select content into cur from public.site_files where path = 'index.html' and part = 10;
  if (length(cur) - length(replace(cur, $w297$/* =====================================================================
   WA v300$w297$, ''))) / length($w297$/* =====================================================================
   WA v300$w297$) <> 1 then raise exception 'edit 4: anchor not found once'; end if;
  update public.site_files set content = replace(cur, $w297$/* =====================================================================
   WA v300$w297$, $w297$/* =====================================================================
   WA v297 Messages to volunteers: automatic emails and texts per city, and Send now (09/11/26)
   =====================================================================
   Steel (08/11/26): "we should have the ability to confirm people via email as well, and follow up via email as
   well, and not always have texts ... both the optional ability to send out automatic texts and automatic emails,
   and also have the button to send those out, both in Montreal and Toronto."

   - One box, "Messages to volunteers", under the Texts strip of a Montreal serving (#volunteering/e/<id>) and in
     the Confirm part of a Toronto event (#toronto/e/<id>).
   - Automatic: two switches for the city, Emails and Texts (wa297_auto_get / wa297_auto_set). They decide how the
     confirmation (10 days before), the Monday reminder, the Thursday check-in, the sign-up message and the
     thank-you reach people: email, text, both, or nothing automatic. Montreal started on emails only (what it
     already did); Toronto too.
   - Send now: Confirmation, Reminder, Check-in or Thank-you for this event, by email, text or both, to everyone
     on the list who has not had that message yet (wa297_send_now). Emails go within a minute; texts wait for
     9 am to 7 pm. Each message reaches a person once.
   - Who: Montreal, the people who can text volunteers (leaders, HR, admins, Ibrahim, Mary, Terry); Toronto, the
     same plus the Toronto team. Everyone else sees the settings read-only and no buttons.
   - The database checks every call; this page only draws. No timers: one MutationObserver puts the box back
     when the serving or event page redraws.
   ===================================================================== */
(function () {
  if (window.w297) return;
  var S = { cfg: null, loading: false, pick: null, busy: false, msg: {} };
  var KINDS = [['confirm', 'Confirmation'], ['reminder', 'Reminder'], ['checkin', 'Check-in'], ['thanks', 'Thank-you']];
  var CH = [['email', 'By email'], ['text', 'By text'], ['both', 'Email and text']];
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function client() { try { if (typeof db !== 'undefined' && db && db.rpc) return db; } catch (e) { /* fine */ } return window.sb || null; }
  function where() {
    var h = String(location.hash || '');
    var m = h.match(/^#toronto\/e\/(\d+)/);
    if (m) return { city: 'toronto', id: Number(m[1]), host: document.getElementById('w274s-confirm') };
    m = h.match(/^#volunteering\/e\/(\d+)/);
    if (m) { var st = document.querySelector('#w119 .w258strip'); return { city: 'montreal', id: Number(m[1]), host: st, after: true }; }
    return null;
  }
  async function load(force) {
    if (S.loading || (S.cfg && !force)) return;
    var c = client(); if (!c) return;
    S.loading = true;
    try { var r = await c.rpc('wa297_auto_get'); if (!r.error) S.cfg = r.data; } catch (e) { /* the box stays hidden */ }
    S.loading = false; paint();
  }
  function sched(c) {
    return 'Confirmation ' + (c.confirm_days || 10) + ' days before, a reminder the Monday, a check-in the Thursday, a thank-you after. Emails go within a minute; texts between 9 am and 7 pm.';
  }
  function boxHtml(w) {
    var c = S.cfg, s = c && c[w.city]; if (!s) return '';
    var can = !!s.can, city = w.city === 'toronto' ? 'Toronto' : 'Montreal';
    var mode = s.emails && s.texts ? 'by email and text' : s.emails ? 'by email' : s.texts ? 'by text' : 'not sent automatically';
    var h = '<div class="w297box" data-w297ev="' + w.id + '" data-w297city="' + w.city + '">'
      + '<div class="hd"><b>Messages to volunteers</b><span>' + E(city) + ': automatic messages go ' + E(mode) + '.</span></div>'
      + '<div class="auto"><span class="lb">Automatic</span>'
      + '<label class="sw"><input type="checkbox" data-w297sw="emails"' + (s.emails ? ' checked' : '') + (can ? '' : ' disabled') + '> Emails</label>'
      + '<label class="sw"><input type="checkbox" data-w297sw="texts"' + (s.texts ? ' checked' : '') + (can ? '' : ' disabled') + '> Texts</label>'
      + '<span class="nt">For every ' + E(city) + (w.city === 'toronto' ? ' event' : ' serving') + '. ' + E(sched(c)) + '</span></div>';
    if (can) {
      h += '<div class="now"><span class="lb">Send now</span>' + KINDS.map(function (k) {
        return '<button type="button" class="w297b' + (S.pick === k[0] ? ' on' : '') + '" data-w297k="' + k[0] + '">' + E(k[1]) + '</button>';
      }).join('') + '</div>';
      if (S.pick) {
        var lab = KINDS.filter(function (k) { return k[0] === S.pick; })[0][1];
        var def = s.emails && s.texts ? 'both' : s.texts ? 'text' : 'email';
        h += '<div class="pick"><span>' + E(lab) + ' to everyone on this list who has not had it yet:</span>'
          + CH.map(function (x) { return '<button type="button" class="w297b pri' + (x[0] === def ? ' def' : '') + '" data-w297go="' + x[0] + '"' + (S.busy ? ' disabled' : '') + '>' + E(x[1]) + '</button>'; }).join('')
          + '<button type="button" class="w297b ghost" data-w297x="1">Cancel</button></div>';
      }
    } else {
      h += '<p class="ro">Only the team that runs ' + E(city) + ' volunteers can change these or send messages.</p>';
    }
    var m = S.msg[w.id]; if (m) h += '<p class="res' + (m.err ? ' err' : '') + '">' + E(m.t) + '</p>';
    return h + '</div>';
  }
  function paint() {
    var w = where(); if (!w || !w.host) return;
    if (!S.cfg) { load(); return; }
    var html = boxHtml(w); if (!html) return;
    var old = document.querySelector('.w297box');
    if (old && old.__h === html && old.getAttribute('data-w297ev') === String(w.id) && (w.after ? old.previousElementSibling === w.host : old.parentNode === w.host)) return;
    if (old) old.remove();
    var t = document.createElement('div'); t.innerHTML = html; var el = t.firstChild; el.__h = html;
    if (w.after) w.host.insertAdjacentElement('afterend', el);
    else { var cn = w.host.querySelector('.w274cnts'); if (cn) cn.insertAdjacentElement('afterend', el); else w.host.appendChild(el); }
  }
  function words(r, ch) {
    if (!r) return 'Done.';
    var n = 0, k = r.kind;
    if (k === 'confirm') n = (r.queued || 0) + (r.emailed || 0);
    else if (k === 'reminder' || k === 'checkin') n = (r[k] && r[k].queued) || 0;
    else n = r.queued || 0;
    var how = ch === 'both' ? 'by email and text' : ch === 'text' ? 'by text' : 'by email';
    if (!n) return 'Nobody new to send to: everyone on the list has had this message already, or is not on the list yet.';
    return n + (n === 1 ? ' person gets it ' : ' people get it ') + how + '.' + (ch !== 'email' ? ' Texts go between 9 am and 7 pm.' : ' Emails go within a minute.');
  }
  async function send(ch) {
    var w = where(); if (!w || !S.pick || S.busy) return;
    var c = client(); if (!c) return;
    S.busy = true; paint();
    var kind = S.pick;
    try {
      var r = await c.rpc('wa297_send_now', { p_event: w.id, p_kind: kind, p_channel: ch });
      if (r.error) S.msg[w.id] = { t: r.error.message || 'That did not go through.', err: true };
      else { S.msg[w.id] = { t: words(r.data, ch) }; S.pick = null; }
    } catch (e) { S.msg[w.id] = { t: 'That did not go through. Try again.', err: true }; }
    S.busy = false; paint();
  }
  async function toggle(w, which, on) {
    var c = client(); if (!c || !S.cfg) return;
    var s = S.cfg[w.city], em = which === 'emails' ? on : !!s.emails, tx = which === 'texts' ? on : !!s.texts;
    try {
      var r = await c.rpc('wa297_auto_set', { p_city: w.city, p_texts: tx, p_emails: em });
      if (r.error) S.msg[w.id] = { t: r.error.message, err: true };
      else { S.cfg = r.data; S.msg[w.id] = { t: 'Saved. Automatic ' + (w.city === 'toronto' ? 'Toronto' : 'Montreal') + ' messages now go ' + (em && tx ? 'by email and text.' : em ? 'by email.' : tx ? 'by text.' : 'nowhere: use Send now.') }; }
    } catch (e) { S.msg[w.id] = { t: 'Not saved. Try again.', err: true }; }
    paint();
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var b = t.closest('.w297box button'); if (!b) return;
    if (b.hasAttribute('data-w297k')) { S.pick = S.pick === b.getAttribute('data-w297k') ? null : b.getAttribute('data-w297k'); var w0 = where(); if (w0) delete S.msg[w0.id]; paint(); return; }
    if (b.hasAttribute('data-w297go')) { send(b.getAttribute('data-w297go')); return; }
    if (b.hasAttribute('data-w297x')) { S.pick = null; paint(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.matches || !t.matches('.w297box input[data-w297sw]')) return;
    var w = where(); if (w) toggle(w, t.getAttribute('data-w297sw'), t.checked);
  });
  var css = document.createElement('style');
  css.textContent = '.w297box{margin:10px 0 14px;padding:12px 14px;border-radius:14px;background:rgba(16,63,57,.05);border:1px solid rgba(16,63,57,.12);font-size:13px;color:#103F39;}'
    + '.w297box .hd{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;margin-bottom:8px;}'
    + '.w297box .hd b{font-size:12px;letter-spacing:.6px;text-transform:uppercase;}.w297box .hd span{color:#5f6b68;}'
    + '.w297box .auto,.w297box .now,.w297box .pick{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:6px 0;}'
    + '.w297box .lb{font-weight:700;min-width:84px;}.w297box .nt{flex-basis:100%;color:#5f6b68;font-size:12px;}'
    + '.w297box .sw{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:#fff;border:1px solid rgba(16,63,57,.18);cursor:pointer;}'
    + '.w297box .sw input{accent-color:#103F39;}'
    + '.w297b{font:inherit;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid rgba(16,63,57,.25);background:#fff;color:#103F39;cursor:pointer;}'
    + '.w297b.on{background:#103F39;color:#fff;border-color:#103F39;}.w297b.pri{background:#103F39;color:#fff;border-color:#103F39;}'
    + '.w297b.pri.def{box-shadow:0 0 0 3px rgba(226,170,60,.45);}.w297b.ghost{background:transparent;}.w297b[disabled]{opacity:.55;cursor:default;}'
    + '.w297box .pick{padding:8px 10px;border-radius:10px;background:#fff;}.w297box .pick>span{flex-basis:100%;}'
    + '.w297box .ro{margin:6px 0 0;color:#5f6b68;}.w297box .res{margin:8px 0 0;font-weight:600;}.w297box .res.err{color:#9b2c2c;}'
    /* the org chart tree (parts133 treeHtml) */
    + '#w133 .w297row{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;align-items:start;}'
    + '#w133 .w297br{position:relative;min-width:0;}#w133 .w297top .w133c{padding:12px 14px;background:rgba(16,63,57,.06);}#w133 .w297top .w133c b{font-size:15.5px;}'
    + '#w133 .w297teams{margin:0 0 0 22px;padding:10px 0 0 12px;border-left:2px solid rgba(16,63,57,.18);display:flex;flex-direction:column;gap:10px;}'
    + '#w133 .w297tm{position:relative;background:#fff;border-radius:14px;border-top:3px solid var(--tc,#103F39);padding:8px 8px 10px;box-shadow:0 1px 2px rgba(16,63,57,.08);min-width:0;}'
    + '#w133 .w297tm::before{content:"";position:absolute;left:-14px;top:18px;width:12px;height:2px;background:rgba(16,63,57,.18);}'
    + '#w133 .w297tm h4{margin:2px 4px 6px;font-family:"Barlow Condensed",sans-serif;font-size:16px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;color:var(--tc,#103F39);display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;}'
    + '#w133 .w297tm h4 span{font-family:inherit;font-size:11.5px;font-weight:500;text-transform:none;letter-spacing:0;color:#797773;}'
    + '#w133 .w297shh{padding:12px 14px;border-radius:14px;border:1px dashed rgba(16,63,57,.3);display:flex;flex-direction:column;gap:2px;}#w133 .w297shh span{color:#797773;font-size:12.5px;}'
    + '#w133 .w297none{margin:8px 0 0 22px;color:#797773;font-size:13px;}'
    + '#w133 .w297tree .w297tm .w133tag:not(.tm){display:none;}';
  document.head.appendChild(css);
  var queued = false;
  function soon() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; try { paint(); } catch (e) { /* fine */ } }); }
  new MutationObserver(function () { if (where()) soon(); }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', function () { S.pick = null; soon(); });
  window.w297 = { state: function () { return S; }, paint: paint, reload: function () { return load(true); } };
})();

/* =====================================================================
   WA v300$w297$), updated_at = now() where path = 'index.html' and part = 10;
  select string_agg(content, '' order by part) into whole from public.site_files where path = 'index.html';
  if md5(whole) <> '61db595873b6dc34201d385307b4a63f' then raise exception 'Unexpected result (md5 %). Rolled back.', md5(whole); end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'wave297', 'index.html', '0df3dfe67734de147c8c576d0c2e6923', '61db595873b6dc34201d385307b4a63f: Messages to volunteers (automatic emails and texts per city, Send now) on Montreal servings and Toronto events; the org chart as a tree (board, each co-ED with their teams, Shared).', 'wave297');
end $do$;
select public.call_edge('host-sync', '{}'::jsonb);
