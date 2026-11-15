-- 14/11/26 - wave342 release: the Montreal Volunteer Manager, revised.
-- Run this whole file once in the Supabase SQL editor (project zwnmulmnvopclzcvytce). It is one block: if any check fails, nothing changes.
-- Made against the live Hub page 04a6163f23704c9a2c7ec0b845219ff2. It includes wave341 (the number fix): do not run wave341 as well.
-- What changes: the Events page (calendar first), New event, each event's header and sign-up list, cooks as a minimum
-- (every cook opens 2 server spots), 3 community leads, one count everywhere (confirmed of needed), the menu.
-- Nobody is messaged by this release. The usual counts change: cooks 6 to a minimum of 4, community leads 1 to 3.
-- Undo: "14-11-26 - wave342 undo (only if needed).sql". Publishing takes about a minute.

create table if not exists public.site_files_bak_wa342 (path text, part int, content text, updated_at timestamptz);
alter table public.site_files_bak_wa342 enable row level security;
revoke all on public.site_files_bak_wa342 from anon, authenticated;
grant all on public.site_files_bak_wa342 to service_role;
comment on table public.site_files_bak_wa342 is 'wave342 (14/11/26): index.html before wave342, for its undo. Drop after a week.';
create table if not exists public.wa342_undo (k text primary key, v text, saved_at timestamptz default now());
alter table public.wa342_undo enable row level security;
revoke all on public.wa342_undo from anon, authenticated;
grant all on public.wa342_undo to service_role;
comment on table public.wa342_undo is 'wave342 (14/11/26): the two message functions and the usual counts as they were before wave342, for its undo. Drop after a week.';

do $pg$
declare v text; v_new text; n int; i int; sz int; o text; nw text;
  olds text[] := array[
  replace($o0$function waVolToday() { return new Date().toISOString().slice(0, 10); }$o0$, chr(13), ''),
  replace($o1$        return [{ label: 'Servings', items: [
          { h: '#volunteering', l: 'Servings', ic: 'list', page: 'volunteering' },
          { h: '#volunteering/calendar', l: 'Calendar', ic: 'cal', page: 'volunteering' }
        ] }, { label: 'People', solo: true, items: [
          { h: '#volunteering/people', l: 'People', ic: 'people', page: 'volunteering', n: (function () { try { return (window.w259 && window.w259.peopleBadge && window.w259.peopleBadge()) || null; } catch (e) { return null; } })() },
          { h: '#volunteering/phone', l: 'Messages', ic: 'chat', page: 'volunteering', n: (function () { try { return (window.w256 && window.w256.waiting && window.w256.waiting()) || null; } catch (e) { return null; } })() }
        ] }, { label: 'Setup', solo: true, items: [
          { h: '#volunteering/setup', l: 'Setup', ic: 'layers', page: 'volunteering' }
        ] }];
      },
      actions: [{ k: 'text', l: 'Message volunteers', ic: 'send', page: 'volunteering' }]
    },
$o1$, chr(13), ''),
  replace($o2$    if (S.app === 'volunteer' && k === 'text') { try { if (typeof waTxtModal === 'function') waTxtModal(); } catch (e) { /* fine */ } return; }$o2$, chr(13), ''),
  replace($o3$  var PLACES = [['', 'Servings', '#volunteering', 'calendar'], ['calendar', 'Calendar', '#volunteering/calendar', ''], ['people', 'People', '#volunteering/people', 'people'], ['phone', 'Messages', '#volunteering/phone', 'phone'], ['setup', 'Setup', '#volunteering/setup', 'setup']];
  var PEOPLE = ['people', 'applicants', 'signoffs'];
  var SETUP = ['setup', 'sop', 'recipes', 'inventory'];
  function placeOf(s) { if (PEOPLE.indexOf(s) >= 0) return 'people'; if (SETUP.indexOf(s) >= 0) return 'setup'; if (s === 'phone' || s === 'messages') return 'phone'; if (s === 'calendar') return 'calendar'; return ''; }$o3$, chr(13), ''),
  replace($o4$'" data-w259chip="' + (p[0] || 'home') + '"' + (p[3] ? ' data-vl="' + p[3] + '"' : ' data-w257cal="1"') + '>' + E(p[1]) + (p[0] === 'people'$o4$, chr(13), ''),
  replace($o5$    var where = document.querySelector('#w153bar .w153bc > span');
    if (where) { var lbl = (PLACES.filter(function (p) { return p[0] === want; })[0] || PLACES[0])[1]; if (/^#volunteering\/e\//.test(location.hash || '')) lbl = 'Serving'; if (where.textContent !== lbl) where.textContent = lbl; }$o5$, chr(13), ''),
  replace($o6$    /* the three reference pages */
    h += '<div class="w259grid">'
      + '<a class="w259tile" href="#volunteering/sop"><b>The SOP</b><span>The master checklist every serving starts from, in six stages.</span></a>'
      + '<a class="w259tile" href="#volunteering/recipes"><b>Recipes</b><span>What the cooks make, with the recipe links.</span></a>'
      + '<a class="w259tile" href="#volunteering/inventory"><b>Inventory</b><span>The kit in storage, counted and reordered.</span></a></div>';
$o6$, chr(13), ''),
  replace($o7$      '<p class="lead">Every automatic text, from the ops line 438-808-7754, between ' + E(hour12(num('sms_window_start', 9))) + ' and ' + E(hour12(num('sms_window_end', 19))) + ' Toronto time, once per person per serving. '$o7$, chr(13), ''),
  replace($o8$      + '<p class="m">Not on a schedule: the sign-up text the moment a form puts someone on a serving; the text and email when the team places someone (Assign to servings); invitations from Find volunteers; Still in?; the thank-you after a YES or NO reply. A confirmed volunteer who says they can\u2019t come on their page tells the role\u2019s owner and the volunteer team at once.</p>'$o8$, chr(13), ''),
  replace($o9$      '<p class="lead">How many of each role a serving needs unless it sets its own (a serving\u2019s More menu, Spot counts).</p><div class="w259spots">'$o9$, chr(13), ''),
  replace($o10$  var TITLES = { setup: ['Setup', 'The SOP, recipes, inventory, the usual spot counts, role owners and the text schedule'], phone: ['Messages', 'The ops line: every conversation, group texts and calls'] };$o10$, chr(13), ''),
  replace($o11$  var TITLES = { calendar: ['Servings', 'This week and every upcoming serving'],$o11$, chr(13), ''),
  replace($o12$recipes: ['Recipes', 'What the cooks make'], event: ['Serving', ''],$o12$, chr(13), ''),
  replace($o13$    applicants: ['Applicants received', 'Volunteers who applied, waiting for a reply'],$o13$, chr(13), ''),
  replace($o14$setup: ['Setup', 'The SOP, recipes, inventory, the usual spot counts, role owners and the text schedule'] };
  function title() {$o14$, chr(13), ''),
  replace($o15$    var t = { team_leader: 1, cook: 4, driver: 2, server: 8, dishwasher: 1, photographer: 1, community_debrief: 1 };
    if (S.guides && S.guides.length) {$o15$, chr(13), ''),
  replace($o16$  function rosterCounts(D) {
    var T = targets(D && D.id); var list = (D.roster || []).filter(function (r) { return !isOff(r) && !isDecl(r); });
    var by = {}; list.forEach(function (r) { by[r.role || 'other'] = (by[r.role || 'other'] || 0) + 1; });
    /* wave191o: a partner's people count toward the roles they cover (promised until they sign up by name); our team leader and
       community lead are always ours; when they make the food the cooks are covered, and when they bring it ready, one driver */
    var P = typeof partnerOf === 'function' && D && D.id ? partnerOf(D.id) : null;
    if (P) {
      var cov = P.covers || {}, signed = {};
      list.forEach(function (r) { if ((r.detail || {}).source === 'partner form') signed[r.role] = (signed[r.role] || 0) + 1; });
      Object.keys(cov).forEach(function (r) { if (r === 'team_leader' || r === 'community_debrief') return; by[r] = (by[r] || 0) + Math.max(0, (cov[r] || 0) - (signed[r] || 0)); });
      if (P.food && P.food !== 'ours') by.cook = Math.max(by.cook || 0, T.cook || 0);
      if (P.food === 'they_bring' && (T.driver || 0) > 1) T = Object.assign({}, T, { driver: 1 });
    }
    var short = ROLE_ORDER.filter(function (r) { return (T[r] || 0) > (by[r] || 0); });
    var conf = list.filter(isConf).length;
    return { on: list.length, conf: conf, wait: list.length - conf, by: by, short: short, T: T };
  }
$o16$, chr(13), ''),
  replace($o17$  function headHtml(ev, D, M, row) {
    var fmt = ev.format || (row && row.format); var fmtL = fmt ? FORMATS[fmt] || fmt : '';
    var up = ev.status !== 'cancelled' && ev.status !== 'completed';
    var start = (row && row.start_time) || ev.start_time; var place = (row && row.location) || ev.location || '';
    var meals = row && row.planned_meals ? row.planned_meals + ' meals planned' : '';
    var meta = '<span class="cd">' + (M.cur === 'done' ? 'Done' : M.cur === 'cancelled' ? 'Cancelled' : countdown(ev).replace(/^(\d+) /, '<b>$1</b> ')) + '</span>'
      + (start ? '<span>' + E(hm12(start)) + (place ? ' at ' + E(place) : '') + '</span>' : (place ? '<span>' + E(place) + '</span>' : ''))
      + (meals ? '<span>' + E(meals) + '</span>' : '') + (ev.title ? '<span>' + E(ev.title) + '</span>' : '') + (partnerOf(ev.id) ? '<span class="w191with">With ' + E(partnerOf(ev.id).partner_name) + '</span>' : '');
    var prim = primaryAction(ev, D, M, row);
    var menu = ''
      + (staff() ? '<button data-w191go="find">Find volunteers</button><button data-w191go="conv">Conversations</button><button data-w191go="bplan">Plan the roster</button><button data-w191go="spots">Spot counts</button>' : '')
      + (staff() ? '<button data-w191go="text171">Ask to confirm</button>' : '')
      + (staff() ? '<button data-w191go="send182">Send itineraries</button><button data-w191go="hist182">Sent and scheduled</button><button data-w191go="ev182">This serving\u2019s itinerary</button>' : '')
      + (staff() ? '<button data-w191go="fmt">' + (fmt ? 'Change the format' : 'Set the format') + '</button><button data-w191go="date">Change the date</button><button data-w191go="partner">' + (partnerOf(ev.id) ? 'Edit the collaboration' : 'A partner organization serves with us') + '</button>' : '')
      + (staff() ? '<button data-w191go="brecap">Recap in Slack</button>' : '')
      + (staff() && up ? '<button data-w191go="close">Close this serving</button>' : '')
      + (staff() && ev.status === 'completed' ? '<button data-w191go="reopen">Reopen this serving</button>' : '')
      + (staff() ? '<button class="warn" data-w191go="cancel">' + (ev.status === 'cancelled' ? 'Restore this serving' : 'Cancel this serving') + '</button>' : '');
    var bar = STAGES.map(function (s, i) {
      var g = M.stages[s.k]; var sub = s.k === M.cur ? (M.cur === 'wrap_up' ? 'Now' : 'Now \u00b7 ' + s.when.toLowerCase()) : g.state === 'done' ? 'Done' : g.state === 'late' ? (g.leaves - g.done) + ' left' : s.when;
      return '<button class="st ' + g.state + '" data-w191stage="' + s.k + '" style="--p:' + g.pct + '%" title="' + E(s.s) + '"><b>' + E(s.l) + '</b><span>' + E(sub) + '</span><i></i></button>';
    }).join('');
    return '<div class="k"><span>' + E(ev.code || 'Serving') + (ev.season ? ' \u00b7 ' + E(ev.season) : '') + '</span>'
      + (up || fmtL ? '<button class="fmt' + (fmtL ? '' : ' unset') + '" data-w191go="fmt" title="The serving\u2019s format">' + E(fmtL || 'Format not set') + '</button>' : '')
      + (ev.status === 'cancelled' ? '<span class="fmt" style="background:' + FLAG + '">Cancelled</span>' : ev.status === 'completed' ? '<span class="fmt" style="background:' + TEAL + '">Done</span>' : '') + '</div>'
      + '<h3>' + E(fmtDay(ev.event_date, true)) + '</h3><div class="meta">' + meta + '</div>'
      + '<div class="acts">' + (prim ? '<button class="w191btn gold" data-w191go="' + E(prim.go) + '">' + E(prim.l) + '</button>' : '')
      + '<button class="w191btn ghost" data-w191go="back">\u2190 All servings</button><span style="flex:1"></span>'
      + '<span class="more"><button class="w191btn quiet" data-w191go="menu">More \u22ee</button><div class="menu">' + menu + '</div></span></div>'
      + '<div class="w191bar">' + bar + '</div>';
  }
$o17$, chr(13), ''),
  replace($o18$    if (up && M.curIx >= STAGE_IX.recruit && c.short.length) items.push({ act: 1, go: 'find', b: 'Fill the roster: ' + c.short.length + ' role' + (c.short.length === 1 ? '' : 's') + ' short', s: c.short.slice(0, 3).map(function (r) { return roleLabel(r).toLowerCase() + ' ' + (c.by[r] || 0) + ' of ' + c.T[r]; }).join(', ') + (c.short.length > 3 ? ' and ' + (c.short.length - 3) + ' more' : '') + '. Find volunteers looks through the CRM and texts them for you.', l: 'Find volunteers' });
    if (up && M.curIx >= STAGE_IX.confirm && c.wait) items.push({ act: 1, go: 'text171', b: c.wait + ' still to confirm', s: 'The confirmation carries their personal link.', l: 'Ask to confirm' });
    if (up && M.curIx >= STAGE_IX.prepare && row && !row.whatsapp_url) items.push({ act: 1, go: 'ev182', b: 'Paste the WhatsApp group link', s: 'The itineraries carry it; nobody is added by hand.', l: 'Add the link' });$o18$, chr(13), ''),
  replace($o19$map(function (r) { var n = c.by[r] || 0, t = c.T[r] || 0; var cls = 'pill' + (t && n < t ? ' short' : t ? ' ok' : ''), txt = E(roleLabel(r)) + ' ' + n + (t ? '/' + t : '');$o19$, chr(13), ''),
  replace($o20$<span><b>The team</b><span class="sub">' + c.conf + ' confirmed of ' + c.on + ' on the list' + (need ? ' \u00b7 needs ' + need : '') + (c.short.length ? ' \u00b7 <em>' + c.short.length + ' role' + (c.short.length === 1 ? '' : 's') + ' short</em>' : (c.on ? ' \u00b7 <span class="ok">every role filled</span>' : '')) + '</span></span>$o20$, chr(13), ''),
  replace($o21$    if (k === 'recruit') { var c = rosterCounts(D); var short = c.short; bits.push(c.on + ' on the list' + (short.length ? ', <em>' + short.length + ' role' + (short.length === 1 ? '' : 's') + ' short</em>' : ', <span class="ok">every role filled</span>')); }
    if (k === 'confirm') { var cc = rosterCounts(D); bits.push(cc.conf + ' of ' + cc.on + ' confirmed' + (cc.wait ? ', ' + cc.wait + ' waiting' : '')); }$o21$, chr(13), ''),
  replace($o22$(c.short.length ? '<span class="pill short">' + c.short.length + ' role' + (c.short.length === 1 ? '' : 's') + ' short: ' + E(c.short.map(function (r) { return roleLabel(r).toLowerCase(); }).join(', ')) + '</span>' : '<span class="pill ok">Every role has someone</span>')$o22$, chr(13), ''),
  replace($o23$'<p style="margin:6px 0 0;font-size:12px;line-height:1.45;color:' + MUTED + '">Find volunteers: who signed up and never came, regulars we miss, who came once and who loved it, with a personal text to each from the ops line (9 am to 7 pm). Their YES lands on the roster by itself.</p>'$o23$, chr(13), ''),
  replace($o24$    if (what === 'back') { location.hash = '#volunteering'; return; }
    if (what.indexOf('stage:') === 0) { openStage(what.slice(6), true); return; }$o24$, chr(13), ''),
  replace($o25$    if (what === 'close') { if (confirm('Close this serving? It moves to Done; you can reopen it.')) setStatus(ev, 'completed'); return; }$o25$, chr(13), ''),
  replace($o26$    T(status === 'completed' ? 'This serving is closed' : 'This serving is open again');$o26$, chr(13), ''),
  replace($o27$      + '<p class="m-sub">How many people this serving needs in each role. The roster, the open spots, Find volunteers and Home all count against these. 0 means this serving does not need the role.</p>'$o27$, chr(13), ''),
  replace($o28$  window.w191 = { S: S, STAGES: STAGES, model: model, layout: layout, refresh: refresh,$o28$, chr(13), ''),
  replace($o29$    var by = {}, conf = 0; (D.roster || []).forEach(function (r) { var s = lower(r.status); if (s === 'cancelled' || s === 'unavailable') return; by[r.role || 'other'] = (by[r.role || 'other'] || 0) + 1; if (s.indexOf('confirm') === 0) conf++; });
    return { by: by, T: TARGET, conf: conf };$o29$, chr(13), ''),
  replace($o30$  function boardHtml(D) {
    var roster = D.roster || [], c = counts(D);
    return '<div class="board">' + allRoles(D).map(function (role) {
      var list = roster.filter(function (r) { return (r.role || 'other') === role; });
      list.sort(function (a, b) { return (isGone(a) ? 1 : 0) - (isGone(b) ? 1 : 0); });
      var on = c.by[role] || 0, target = (c.T || {})[role] || 0;
      var conf = list.filter(function (r) { return lower(r.status).indexOf('confirm') === 0 || r.confirm_status === 'confirmed'; }).length;
      var cls = target ? (on >= target ? 'full' : 'short') : '';
      return '<div class="rc" data-w119role="' + E(role) + '"><div class="h"><b>' + E(roleLabel(role)) + '</b><span class="n ' + cls + '" title="' + E(on + ' on the list' + (target ? ' of ' + target + ' needed' : '') + ', ' + conf + ' confirmed') + '">' + on + (target ? '/' + target : '') + '</span>' +
        (staff() ? '<button class="add" data-w119bench="' + E(role) + '" title="Add people as ' + E(one(role).toLowerCase()) + '">+ Add</button>' : '') + '</div>' +
        (list.length ? '<div class="sub">' + (conf ? conf + ' confirmed' : 'none confirmed yet') + (target && on < target ? ' · <em>' + (target - on) + ' more needed</em>' : '') + '</div>' + list.map(function (r) { return cardHtml(r, D); }).join('') : '') +
        (!list.length ? (staff() ? '<button class="empty" data-w119bench="' + E(role) + '">' + (target ? 'Need ' + target : 'Nobody yet') + '<span>+ Add people, or drag someone here</span></button>' : '<div class="empty">' + (target ? 'Need ' + target : 'Nobody yet') + '</div>') : '') + '</div>';
    }).join('') + '</div>';
  }
$o30$, chr(13), ''),
  replace($o31$      (r.person_id ? '' : '<span class="flag" title="This name is not matched to anyone in Volunteers yet">No volunteer record</span>') + '</div>';
  }

  /* ---------- wave200: Add people ---------- */$o31$, chr(13), ''),
  replace($o32$    var chips = allRoles(D).map(function (r) { var n = c.by[r] || 0, t$o32$, chr(13), ''),
  replace($o33$    var target = 0; Object.keys(TARGET).forEach(function (k) { target += TARGET[k]; });
    var pctR$o33$, chr(13), ''),
  replace($o34$  function repaintBoard() { var D = detail(); var b = document.querySelector('#w119 .board'); if (!b || !D) return; b.outerHTML = boardHtml(D); }$o34$, chr(13), ''),
  replace($o35$      if (t[0] === 'team' && c.on) n = '<span class="n' + (c.ok < c.on ? ' warn' : '') + '" aria-label="' + c.ok + ' of ' + c.on + ' confirmed">' + c.ok + '/' + c.on + '</span>';$o35$, chr(13), ''),
  replace($o36$      + '<div class="hd"><b>Messages to volunteers</b><span>' + E(city) + ': automatic messages go ' + E(mode) + '.</span></div>'$o36$, chr(13), ''),
  replace($o37$    else note = (ad.day > todayIso() ? 'Confirmation texts go automatically on '$o37$, chr(13), ''),
  replace($o38$    var c = counts(D.roster, ev.id);
    var mode = S.mode || 'off';
    var up = ev.event_date > todayIso() && ev.status !== 'cancelled' && ev.status !== 'completed';
    var ad = autoDay(ev);$o38$, chr(13), ''),
  replace($o39$'<div class="w171nums"><div><b>' + c.conf + '</b><span>confirmed of ' + c.list + '</span></div>$o39$, chr(13), ''),
  replace($o40$<div class="hd"><b>Texts to volunteers</b><span>When texts are on (Messages to volunteers, below): 9 am to 7 pm, from the ops line. Each one once.</span></div>'$o40$, chr(13), ''),
  replace($o41$    var state = !s.on ? 'off' : n ? n + ' sent' : s.kind === 'deadline' ? '' : past ? 'none sent' : 'planned';$o41$, chr(13), ''),
  replace($o42$      if (!acts && src.length) { acts = document.createElement('div'); acts.className = 'w197acts'; m.appendChild(acts); var help = m.querySelector('.w43help'); if (help) acts.appendChild(help); }
      if (acts) {$o42$, chr(13), ''),
  replace($o43$      var want = mode === 'cal' ? ['Calendar', 'Every serving, month by month. Click one to open it.'] : ['Servings', 'This week and every upcoming serving'];$o43$, chr(13), ''),
  replace($o44$      if (c0) { c0.textContent = 'Servings'; c0.classList.toggle('on', mode === 'home'); c0.insertAdjacentHTML('afterend', '<a class="fchip' + (mode === 'cal' ? ' on' : '') + '" data-w257cal="1" href="#volunteering/calendar">Calendar</a>'); }$o44$, chr(13), ''),
  replace($o45$      var h = ev ? 'Serving' : t[0]; var sub = ev ?$o45$, chr(13), ''),
  replace($o46$      + pill('w304i', 'send', g === 'send', 'We send them', id, busy) + pill('w304i', 'own', g === 'own', 'Their own', id, busy) + '</span></div>';$o46$, chr(13), ''),
  replace($o47$        + pill('w304f', 'pickup', f === 'pickup', 'Pick-up', id, busy) + pill('w304f', 'dropoff', f === 'dropoff', 'Drop-off', id, busy) + '</span></div>';$o47$, chr(13), ''),
  replace($o48$/* =====================================================================
   WA v110 boot veil + self-provisioning$o48$, chr(13), '')];
  news text[] := array[
  replace($n0$function waVolToday() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }   /* WA v342: the date in Montreal, not in UTC (it was tomorrow after 7 pm) */$n0$, chr(13), ''),
  replace($n1$        /* WA v342 (Steel, 14/11/26): Events (the calendar first), Volunteers, Messages; under More, each its own page */
        var st342 = false; try { st342 = typeof isStaff === 'function' && isStaff(); } catch (e) { st342 = false; }
        return [{ label: 'Events', solo: true, items: [
          { h: '#volunteering', l: 'Events', ic: 'cal', page: 'volunteering', also: ['#volunteering/calendar', '#volunteering/e'] },
          { h: '#volunteering/people', l: 'Volunteers', ic: 'people', page: 'volunteering', also: ['#volunteering/applicants', '#volunteering/signoffs'], n: (function () { try { return (window.w259 && window.w259.peopleBadge && window.w259.peopleBadge()) || null; } catch (e) { return null; } })() },
          { h: '#volunteering/phone', l: 'Messages', ic: 'chat', page: 'volunteering', also: ['#volunteering/messages'], n: (function () { try { return (window.w256 && window.w256.waiting && window.w256.waiting()) || null; } catch (e) { return null; } })() }
        ] }, { label: 'More', items: (st342 ? [{ h: '#volunteering/fundraisers', l: 'Fundraisers', ic: 'gift', page: 'volunteering' }] : []).concat([
          { h: '#volunteering/recipes', l: 'Recipes', ic: 'book', page: 'volunteering' },
          { h: '#volunteering/inventory', l: 'Inventory', ic: 'box', page: 'volunteering' },
          { h: '#volunteering/sop', l: 'The SOP', ic: 'list', page: 'volunteering' },
          { h: '#volunteering/setup', l: 'Setup', ic: 'layers', page: 'volunteering' }
        ]) }];
      },
      actions: [{ k: 'newevent', l: 'New event', ic: 'plus', page: 'volunteering' }]
    },
$n1$, chr(13), ''),
  replace($n2$    if (S.app === 'volunteer' && k === 'text') { try { if (typeof waTxtModal === 'function') waTxtModal(); } catch (e) { /* fine */ } return; }
    if (S.app === 'volunteer' && k === 'newevent') { try { if (window.w342 && window.w342.newEvent) window.w342.newEvent(); } catch (e) { /* fine */ } return; }   /* WA v342 */$n2$, chr(13), ''),
  replace($n3$  /* WA v342: the menu's eight places, each its own page */
  var PLACES = [['', 'Events', '#volunteering', 'calendar'], ['people', 'Volunteers', '#volunteering/people', 'people'], ['phone', 'Messages', '#volunteering/phone', 'phone'], ['fundraisers', 'Fundraisers', '#volunteering/fundraisers', ''], ['recipes', 'Recipes', '#volunteering/recipes', 'recipes'], ['inventory', 'Inventory', '#volunteering/inventory', 'inventory'], ['sop', 'The SOP', '#volunteering/sop', 'sop'], ['setup', 'Setup', '#volunteering/setup', 'setup']];
  var PEOPLE = ['people', 'applicants', 'signoffs'];
  var SETUP = ['setup'];
  function placeOf(s) { if (PEOPLE.indexOf(s) >= 0) return 'people'; if (s === 'phone' || s === 'messages') return 'phone'; if (s === 'fundraisers' || s === 'recipes' || s === 'inventory' || s === 'sop' || s === 'setup') return s; return ''; }$n3$, chr(13), ''),
  replace($n4$'" data-w259chip="' + (p[0] || 'home') + '"' + (p[3] ? ' data-vl="' + p[3] + '"' : '') + '>' + E(p[1]) + (p[0] === 'people'$n4$, chr(13), ''),
  replace($n5$    var where = document.querySelector('#w153bar .w153bc > span:not(.w153ai)');   /* WA v342: the label, never the app's icon (it read "rvin" on a phone) */
    if (where) { var lbl = (PLACES.filter(function (p) { return p[0] === want; })[0] || PLACES[0])[1]; if (/^#volunteering\/e\//.test(location.hash || '')) lbl = 'Event'; if (where.textContent !== lbl) where.textContent = lbl; }$n5$, chr(13), ''),
  replace($n6$    /* WA v342: the SOP, Recipes and Inventory are pages of their own in the menu; the page tour lives here */
    h += '<section class="w259card" id="w259how"><h3>How the Volunteer Manager works</h3><p class="lead">A short tour of the Events page and an event\u2019s five tabs. New on the volunteer team? Start here.</p><div class="ft"><button type="button" class="w259b pri" data-w43help="volunteering">Take the tour</button></div></section>';
$n6$, chr(13), ''),
  replace($n7$      '<p class="lead">' + (window.w342 && !w342.auto() ? '<b>Nothing on this schedule goes out by itself.</b> On each date the role owners get a task; they review the round and send it from the event\u2019s Messages tab. ' : 'These rounds go out by themselves (' + E(window.w342 && w342.auto() === 'email' ? 'by email' : window.w342 && w342.auto() === 'text' ? 'by text' : 'by email and text') + '); switch them off from an event\u2019s Messages tab. ') + 'Texts leave from the ops line 438-808-7754, between ' + E(hour12(num('sms_window_start', 9))) + ' and ' + E(hour12(num('sms_window_end', 19))) + ' Toronto time, once per person per event. '$n7$, chr(13), ''),
  replace($n8$      + '<p class="m">Not on a schedule, and only when a person chooses to send: a note when you place someone from an event\u2019s sign-up list, invitations from Find volunteers, and Still in? Someone who signs up on a form sees their confirmation on the form itself and waits on the event\u2019s list to be placed. A confirmed volunteer who says they can\u2019t come on their page tells the role\u2019s owner and the volunteer team at once.</p>'$n8$, chr(13), ''),
  replace($n9$      '<p class="lead">How many of each role an event needs unless it sets its own (an event\u2019s More menu, Spot counts). ' + (window.w342 && w342.rule() ? '<b>Cooks are a minimum.</b> Every cook the team adds to an event opens ' + w342.rule() + ' more server spots, so take every cook who offers, up to ' + w342.caps().cooks + ' at one serving. Food is picked up from at most ' + w342.caps().pickups + ' cooks; the others bring theirs, and are welcome to stay and serve it. ' : '') + 'Community leads: two for the conversations, one for the count.</p><div class="w259spots">'$n9$, chr(13), ''),
  replace($n10$  var TITLES = { setup: ['Setup', 'The usual spot counts, role owners, the message schedule and the page tour'], phone: ['Messages', 'The ops line: every conversation, group texts and calls'] };$n10$, chr(13), ''),
  replace($n11$  var TITLES = { calendar: ['Events', 'Programs and fundraisers that need volunteers, in Montreal'],$n11$, chr(13), ''),
  replace($n12$recipes: ['Recipes', 'What the cooks make'], event: ['Event', ''],$n12$, chr(13), ''),
  replace($n13$    applicants: ['New applicants', 'Volunteers who applied, waiting for a reply'],$n13$, chr(13), ''),
  replace($n14$setup: ['Setup', 'The usual spot counts, role owners, the message schedule and the page tour'] };
  function title() {$n14$, chr(13), ''),
  replace($n15$    var t = { team_leader: 1, cook: 4, driver: 2, server: 8, dishwasher: 1, photographer: 1, community_debrief: 3 };   /* WA v342: the usual counts (at least 4 cooks, 2 servers per cook, 3 community leads) until the database's load */
    if (S.guides && S.guides.length) {$n15$, chr(13), ''),
  replace($n16$  /* WA v342 (Steel, 13/11/26: "how many confirmed on the denominator of how many we actually need"): one sum for every
     screen (wave342's tally): confirmed out of needed per role, a partner's promised people counted (wave191o), and the people
     who signed up and wait to be placed kept apart until someone places them. */
  function rosterCounts(D) {
    var T = targets(D && D.id);
    var P = typeof partnerOf === 'function' && D && D.id ? partnerOf(D.id) : null;
    try { if (window.w342 && typeof window.w342.tallyD === 'function') return window.w342.tallyD(D, T, P); } catch (e) { /* the plain sum below */ }
    var list = ((D && D.roster) || []).filter(function (r) { return !isOff(r) && !isDecl(r); });
    var by = {}, byConf = {}; list.forEach(function (r) { var k = r.role || 'other'; by[k] = (by[k] || 0) + 1; if (isConf(r)) byConf[k] = (byConf[k] || 0) + 1; });
    var need = 0, filled = 0; Object.keys(T).forEach(function (k) { need += T[k] || 0; filled += Math.min(byConf[k] || 0, T[k] || 0); });
    var conf = list.filter(isConf).length;
    return { on: list.length, conf: conf, wait: list.length - conf, by: by, byConf: byConf, byWait: {}, short: ROLE_ORDER.filter(function (r) { return (T[r] || 0) > (byConf[r] || 0); }), T: T, need: need, filled: filled, open: Math.max(0, need - filled), place: 0, placeRows: [], find: 0, over: 0, waitIn: 0 };
  }
$n16$, chr(13), ''),
  replace($n17$  /* WA v342: the event's header in Toronto's shape. One count (confirmed of needed), three fixed actions, and More in three
     groups; the six stage tiles became one line that opens the To do tab (the tabs are the page's navigation). */
  function headHtml(ev, D, M, row) {
    var fmt = ev.format || (row && row.format); var fmtL = fmt ? FORMATS[fmt] || fmt : '';
    var up = ev.status !== 'cancelled' && ev.status !== 'completed';
    var fund = ev.kind === 'fundraiser';
    var start = (row && row.start_time) || ev.start_time; var place = (fmt === 'community_kitchen' && row && row.kitchen_place) || (row && row.location) || ev.location || '';
    var meals = row && row.planned_meals ? row.planned_meals + ' meals planned' : '';
    var c = rosterCounts(D), P = partnerOf(ev.id);
    var meta = '<span class="cd">' + (M.cur === 'done' ? 'Done' : M.cur === 'cancelled' ? 'Cancelled' : countdown(ev).replace(/^(\d+) /, '<b>$1</b> ')) + '</span>'
      + (start ? '<span>' + E(hm12(start)) + (place ? ' at ' + E(place) : '') + '</span>' : (place ? '<span>' + E(place) + '</span>' : ''))
      + (meals ? '<span>' + E(meals) + '</span>' : '') + (ev.title ? '<span>' + E(ev.title) + '</span>' : '') + (P ? '<span class="w191with">With ' + E(P.partner_name) + '</span>' : '');
    var grp = function (label, items) { items = items.filter(Boolean); return items.length ? '<span class="mh">' + label + '</span>' + items.join('') : ''; };
    var menu = !staff() ? '' : grp('People', ['<button data-w191go="conv">Answers and messages</button>', '<button data-w191go="bplan">Plan the roster</button>', '<button data-w191go="spots">Spot counts</button>'])
      + grp('Messages', ['<button data-w191go="text171">Ask to confirm</button>', '<button data-w191go="send182">Send itineraries</button>', '<button data-w191go="hist182">Sent and scheduled</button>', '<button data-w191go="brecap">Recap in Slack</button>'])
      + grp('This event', [fund ? '' : '<button data-w191go="fmt">' + (fmt ? 'Change the format' : 'Set the format') + '</button>', '<button data-w191go="date">Change the date</button>', '<button data-w191go="start">Change the start time</button>', '<button data-w191go="ev182">The itinerary and the WhatsApp link</button>', '<button data-w191go="partner">' + (P ? 'Edit the collaboration' : 'A partner organization serves with us') + '</button>',
        up ? '<button data-w191go="close">Close this event</button>' : '', ev.status === 'completed' ? '<button data-w191go="reopen">Reopen this event</button>' : '',
        '<button class="warn" data-w191go="cancel">' + (ev.status === 'cancelled' ? 'Restore this event' : 'Cancel this event') + '</button>']);
    var cur = STAGES.filter(function (s) { return s.k === M.cur; })[0], g = cur ? M.stages[cur.k] : null, left = g ? g.people : 0;
    var late = 0; STAGES.forEach(function (s) { late += M.stages[s.k].overdue || 0; });
    var stage = '<div class="w191bar w342sb"><button type="button" class="w342stage" data-w191stage="' + E(cur ? cur.k : 'wrap_up') + '" title="Open the To do list">' + (cur ? 'Stage: ' + E(cur.l) : M.cur === 'cancelled' ? 'Cancelled' : 'Done') + (left ? ' <i>' + left + ' to do</i>' : '') + (late ? ' <i>' + late + ' overdue</i>' : '') + '</button></div>';
    var need = c.need || 0, filled = c.filled || 0, waitIn = c.waitIn || 0;
    var count = need ? '<div class="w342ehc"><span class="big"><b>' + filled + '</b>of ' + need + ' confirmed</span>'
      + '<span class="w342bar" role="img" aria-label="' + filled + ' of ' + need + ' confirmed' + (waitIn ? ', ' + waitIn + ' waiting to confirm' : '') + '"><i class="w" style="--s:' + Math.min(1, (filled + waitIn) / need).toFixed(3) + '"></i><i style="--s:' + Math.min(1, filled / need).toFixed(3) + '"></i></span>'
      + '<small>' + [c.wait ? c.wait + ' waiting to confirm' : '', c.place ? '<b>' + c.place + ' signed up, to place</b>' : '', c.over ? c.over + ' more than their role needs' : '', !c.wait && !c.place && filled >= need ? 'Every spot is confirmed' : ''].filter(Boolean).join(' \u00b7 ') + '</small></div>'
      : '<div class="w342ehc"><small>' + (c.conf || 0) + ' confirmed' + (c.wait ? ' \u00b7 ' + c.wait + ' waiting' : '') + '</small></div>';
    return '<a class="w342back" href="#volunteering" data-w191go="back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>All events</a>'
      + '<div class="k"><span>' + E(ev.code || 'Event') + ' \u00b7 ' + (fund ? 'Fundraiser shift' : 'Program') + '</span>'
      + (!fund && (up || fmtL) ? '<button class="fmt' + (fmtL ? '' : ' unset') + '" data-w191go="fmt" title="The format: cooked at home or in a community kitchen">' + E(fmtL || 'Format not set') + '</button>' : '')
      + (ev.status === 'cancelled' ? '<span class="fmt" style="background:' + FLAG + '">Cancelled</span>' : ev.status === 'completed' ? '<span class="fmt" style="background:' + TEAL + '">Done</span>' : '') + '</div>'
      + '<h3>' + E(fmtDay(ev.event_date, true)) + '</h3><div class="meta">' + meta + '</div>' + count + stage   /* the stage line stays the header's own child: wave258 puts the rounds after the header by it */
      + (staff() ? '<div class="acts">' + (up ? '<button class="w191btn gold" data-w191go="find">Find volunteers</button><button class="w191btn ghost" data-w342msg="1">Message the team</button>' : '') + '<span style="flex:1"></span>'
      + '<span class="more"><button class="w191btn quiet" data-w191go="menu" aria-haspopup="true">More \u22ee</button><div class="menu">' + menu + '</div></span></div>' : '');
  }
$n17$, chr(13), ''),
  replace($n18$    /* WA v342: sign-ups first (they are already here), then who is still to find, then who is still to confirm */
    if (up && c.place) items.push({ act: 1, go: 'tray', b: c.place + (c.place === 1 ? ' person' : ' people') + ' signed up, to place', s: 'They put their hand up for this event. Place them in a role, offer another date, or tell them not this time.', l: 'Place them' });
    if (up && M.curIx >= STAGE_IX.recruit && c.find > Math.max(0, c.place)) items.push({ act: 1, go: 'find', b: 'Find ' + (c.find - c.place) + ' more ' + (c.find - c.place === 1 ? 'person' : 'people'), s: c.short.slice(0, 3).map(function (r) { return roleLabel(r).toLowerCase() + ' ' + ((c.byConf || {})[r] || 0) + ' of ' + c.T[r] + ' confirmed'; }).join(', ') + (c.short.length > 3 ? ' and ' + (c.short.length - 3) + ' more' : '') + '. Find volunteers looks through the CRM; you choose who to write to.', l: 'Find volunteers' });
    if (up && M.curIx >= STAGE_IX.confirm && c.wait) items.push({ act: 1, go: 'text171', b: c.wait + ' still to confirm', s: 'The confirmation carries their personal link.', l: 'Ask to confirm' });
    if (up && M.curIx >= STAGE_IX.prepare && row && !row.whatsapp_url) items.push({ act: 1, go: 'ev182', b: 'Paste the WhatsApp group link', s: 'The itineraries carry it; nobody is added by hand.', l: 'Add the link' });$n18$, chr(13), ''),
  replace($n19$map(function (r) { var n = (c.byConf || c.by)[r] || 0, t = c.T[r] || 0; var cls = 'pill' + (t && n < t ? ' short' : t ? ' ok' : ''), txt = E(roleLabel(r)) + ' ' + n + (t ? '/' + t : '');$n19$, chr(13), ''),
  replace($n20$<span><b>The team</b><span class="sub">' + (need ? (c.filled || 0) + ' of ' + need + ' confirmed' : c.conf + ' confirmed') + (c.wait ? ' \u00b7 ' + c.wait + ' waiting' : '') + (c.place ? ' \u00b7 ' + c.place + ' to place' : '') + (c.short.length ? ' \u00b7 <em>' + c.short.length + ' role' + (c.short.length === 1 ? '' : 's') + ' short</em>' : (c.on ? ' \u00b7 <span class="ok">every role confirmed</span>' : '')) + '</span></span>$n20$, chr(13), ''),
  replace($n21$    if (k === 'recruit') { var c = rosterCounts(D); var short = c.short; bits.push(c.on + ' on the team' + (c.place ? ', ' + c.place + ' to place' : '') + (short.length ? ', <em>' + short.length + ' role' + (short.length === 1 ? '' : 's') + ' short</em>' : ', <span class="ok">every role confirmed</span>')); }
    if (k === 'confirm') { var cc = rosterCounts(D); bits.push((cc.need ? (cc.filled || 0) + ' of ' + cc.need : cc.conf) + ' confirmed' + (cc.wait ? ', ' + cc.wait + ' waiting' : '')); }$n21$, chr(13), ''),
  replace($n22$(c.short.length ? '<span class="pill short">' + c.short.length + ' role' + (c.short.length === 1 ? '' : 's') + ' short: ' + E(c.short.map(function (r) { return roleLabel(r).toLowerCase(); }).join(', ')) + '</span>' : '<span class="pill ok">Every role is confirmed</span>')$n22$, chr(13), ''),
  replace($n23$'<p style="margin:6px 0 0;font-size:12px;line-height:1.45;color:' + MUTED + '">Find volunteers: who signed up and never came, regulars we miss, who came once and who loved it. You choose who to write to; their YES lands on the team by itself.</p>'$n23$, chr(13), ''),
  replace($n24$    if (what === 'back') { location.hash = '#volunteering'; return; }
    /* WA v342: each action first opens the tab that holds what it shows (a button that changed something off-screen looked dead) */
    var tab342 = function (k) { try { if (window.w342 && w342.tabTo) w342.tabTo(k); } catch (e) { /* fine */ } };
    if (what === 'tray') { tab342('team'); setTimeout(function () { var el = document.getElementById('w342tray'); if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); } } }, 60); return; }
    if (what === 'text171') tab342('messages');
    if (what === 'send182' || what === 'ev182' || what === 'date' || what === 'start' || what === 'fmt') tab342('plan');
    if (what === 'bplan' || what === 'team') tab342('team');
    if (what.indexOf('stage:') === 0) { tab342('todo'); openStage(what.slice(6), true); return; }$n24$, chr(13), ''),
  replace($n25$    if (what === 'close') { if (confirm('Close this event? It moves to Done; you can reopen it.')) setStatus(ev, 'completed'); return; }$n25$, chr(13), ''),
  replace($n26$    T(status === 'completed' ? 'This event is closed' : 'This event is open again');$n26$, chr(13), ''),
  replace($n27$      + '<p class="m-sub">How many people this event needs in each role. Every count on the page is confirmed people out of these. 0 means this event does not need the role.' + (window.w342 && w342.rule() ? ' <b>Cooks are a minimum:</b> every cook on the team opens ' + w342.rule() + ' more server spots by itself. Set the servers here only to hold them at a fixed number.' : '') + '</p>'$n27$, chr(13), ''),
  replace($n28$  window.w191 = { S: S, STAGES: STAGES, model: model, layout: layout, refresh: refresh, go: go,$n28$, chr(13), ''),
  replace($n29$    var by = {}, byConf = {}, conf = 0; (D.roster || []).forEach(function (r) { var s = lower(r.status); if (s === 'cancelled' || s === 'unavailable' || r.confirm_status === 'declined') return; by[r.role || 'other'] = (by[r.role || 'other'] || 0) + 1; if (s.indexOf('confirm') === 0 || r.confirm_status === 'confirmed') { conf++; byConf[r.role || 'other'] = (byConf[r.role || 'other'] || 0) + 1; } });
    return { by: by, byConf: byConf, T: TARGET, conf: conf };$n29$, chr(13), ''),
  replace($n30$  /* WA v342: each role says confirmed of needed (wave341's fix, never released on its own); the people who signed up and wait
     to be placed are in their own list above the board (wave342), and the people who can't make it fold away under each role */
  function boardHtml(D) {
    var c = counts(D), hid = c.placeRows || [], X = window.w342 || null;
    var roster = (D.roster || []).filter(function (r) { return hid.indexOf(r) < 0; });
    var okd = function (r) { return lower(r.status).indexOf('confirm') === 0 || r.confirm_status === 'confirmed'; };
    return '<div class="board">' + allRoles({ roster: roster }).map(function (role) {
      var list = roster.filter(function (r) { return (r.role || 'other') === role; });
      var live = list.filter(function (r) { return !isGone(r); }), gone = list.filter(isGone);
      var target = (c.T || {})[role] || 0, onList = c.by[role] || 0;
      var conf = (c.byConf ? c.byConf[role] : live.filter(okd).length) || 0, waitN = Math.max(0, onList - conf);
      var cls = target ? (conf >= target ? 'full' : 'short') : '';
      return '<div class="rc" data-w119role="' + E(role) + '"><div class="h"><b>' + E(roleLabel(role)) + '</b><span class="n ' + cls + '" title="' + E(conf + ' confirmed' + (target ? ' of ' + target + ' needed' : '') + (waitN ? ', ' + waitN + ' waiting to confirm' : '')) + '">' + conf + (target ? '/' + target : '') + '</span>' +
        (staff() ? '<button class="add" data-w119bench="' + E(role) + '" title="Add people as ' + E(one(role).toLowerCase()) + '">+ Add</button>' : '') + '</div>' +
        (live.length || onList ? '<div class="sub">' + (conf ? conf + ' confirmed' : 'none confirmed yet') + (waitN ? ' · ' + waitN + ' waiting' : '') + (target && conf < target ? ' · <em>' + (target - conf) + ' more needed</em>' : '') + '</div>' : '') +
        (X && X.colNote ? X.colNote(role, D) : '') +
        live.map(function (r) { return cardHtml(r, D); }).join('') +
        (!live.length ? (staff() ? '<button class="empty" data-w119bench="' + E(role) + '">' + (target ? 'Need ' + target : 'Nobody yet') + '<span>+ Add people, or drag someone here</span></button>' : '<div class="empty">' + (target ? 'Need ' + target : 'Nobody yet') + '</div>') : '') +
        (gone.length ? '<details class="w342gone"><summary>' + gone.length + ' can\u2019t make it</summary>' + gone.map(function (r) { return cardHtml(r, D); }).join('') + '</details>' : '') + '</div>';
    }).join('') + '</div>';
  }
$n30$, chr(13), ''),
  replace($n31$      (r.person_id ? '' : '<span class="flag" title="This name is not matched to anyone in Volunteers yet">No volunteer record</span>') + (window.w342 && w342.cardBits ? w342.cardBits(r, D || detail()) : '') + '</div>';
  }

  /* ---------- wave200: Add people ---------- */$n31$, chr(13), ''),
  replace($n32$    var chips = allRoles(D).map(function (r) { var n = (c.byConf || c.by)[r] || 0, t$n32$, chr(13), ''),
  replace($n33$    var target = 0, TT = TARGET; try { var cc = counts(D); if (cc && cc.T) TT = cc.T; if (cc && cc.byConf) conf = Object.keys(TT).reduce(function (a, k) { return a + Math.min(cc.byConf[k] || 0, TT[k] || 0); }, 0); } catch (e) { /* fine */ } /* WA v341 n */
    Object.keys(TT).forEach(function (k) { target += TT[k] || 0; });
    var pctR$n33$, chr(13), ''),
  replace($n34$  function repaintBoard() { var D = detail(); var b = document.querySelector('#w119 .board'); if (!b || !D) return; b.outerHTML = boardHtml(D); }
  window.w119x = { board: function () { repaintBoard(); }, mast: function () { repaintMast(); } };   /* WA v342: the sign-up list repaints the board after placing someone */$n34$, chr(13), ''),
  replace($n35$      var q342 = null; try { q342 = t[0] === 'team' && window.w191 && w191.counts && detail() ? w191.counts(detail()) : null; } catch (e) { q342 = null; }   /* WA v342: the same count as the header */
      if (t[0] === 'team' && q342 && q342.need) n = '<span class="n' + (q342.filled < q342.need ? ' warn' : '') + '" aria-label="' + q342.filled + ' of ' + q342.need + ' confirmed">' + q342.filled + '/' + q342.need + '</span>';
      else if (t[0] === 'team' && c.on) n = '<span class="n' + (c.ok < c.on ? ' warn' : '') + '" aria-label="' + c.ok + ' of ' + c.on + ' confirmed">' + c.ok + '/' + c.on + '</span>';$n35$, chr(13), ''),
  replace($n36$      + '<div class="hd"><b>Messages to volunteers</b><span>' + E(city) + ': ' + (s.emails || s.texts ? 'each round goes out by itself, ' + E(mode) + '.' : 'nothing goes out by itself. A person reviews each round and sends it, below.') + '</span></div>'$n36$, chr(13), ''),
  replace($n37$    else if (window.w342 && !w342.auto()) note = 'Nothing goes out by itself: a person sends each round from Send now, above. Ask to confirm writes only to the people still waiting.';
    else note = (ad.day > todayIso() ? 'Confirmation texts go automatically on '$n37$, chr(13), ''),
  replace($n38$    var c = counts(D.roster, ev.id);
    var q171 = [c.conf, c.list]; try { var q0 = window.w191 && w191.counts ? w191.counts(D) : null; if (q0 && q0.need) q171 = [q0.filled, q0.need + ' needed']; } catch (e) { /* fine */ }   /* WA v342: the same count as the header */
    var mode = S.mode || 'off';
    var up = ev.event_date > todayIso() && ev.status !== 'cancelled' && ev.status !== 'completed';
    var ad = autoDay(ev);$n38$, chr(13), ''),
  replace($n39$'<div class="w171nums"><div><b>' + q171[0] + '</b><span>confirmed of ' + q171[1] + '</span></div>$n39$, chr(13), ''),
  replace($n40$<div class="hd"><b>The rounds for this event</b><span>' + (window.w342 && !w342.auto() ? 'A person sends each one from Messages to volunteers, below. Each goes once per person.' : 'They go out by themselves on these dates, once per person; texts between 9 am and 7 pm.') + '</span></div>'$n40$, chr(13), ''),
  replace($n41$    var state = !s.on ? 'off' : n ? n + ' sent' : s.kind === 'deadline' ? '' : past ? 'none sent' : (window.w342 && !w342.auto() ? 'to send' : 'planned');$n41$, chr(13), ''),
  replace($n42$      if (!acts && src.length) { acts = document.createElement('div'); acts.className = 'w197acts'; m.appendChild(acts); }
      if (acts) {
        var help = m.querySelector(':scope > .w43help'); if (help) acts.appendChild(help);   /* WA v342: the page help joins the row whenever it arrives (it sat on top of the app's button) */$n42$, chr(13), ''),
  replace($n43$      var want = ['Events', 'Programs and fundraisers that need volunteers, in Montreal'];   /* WA v342: one Events page, the calendar on it */$n43$, chr(13), ''),
  replace($n44$      if (c0) { c0.textContent = 'Events'; c0.classList.toggle('on', !!mode); }   /* WA v342: no separate Calendar chip */$n44$, chr(13), ''),
  replace($n45$      var h = ev ? 'Event' : t[0]; var sub = ev ?$n45$, chr(13), ''),
  replace($n46$      + pill('w304i', 'own', g === 'own', 'Their own (ask first)', id, busy) + pill('w304i', 'send', g === 'send', 'We send them', id, busy) + '</span></div>';   /* WA v342 (Ahmed): their own ingredients first; we send them only when that is hard */$n46$, chr(13), ''),
  replace($n47$        + (function () { var full342 = f !== 'pickup' && window.w342 && w342.pickFull && w342.pickFull(); return pill('w304f', 'pickup', f === 'pickup', full342 ? 'Pick-up (all ' + w342.caps().pickups + ' taken)' : 'Pick-up', id, busy || full342); })() + pill('w304f', 'dropoff', f === 'dropoff', 'Drop-off', id, busy) + '</span></div>';   /* WA v342: food is picked up from at most 6 cooks */$n47$, chr(13), ''),
  replace($n48$/* =====================================================================
   WA v342 the Montreal Volunteer Manager, set straight (14/11/26)
   =====================================================================
   Steel (13 and 14/11/26): "I don't understand how the Volunteer manager works for montreal and I can only imagine how
   confusing it is for the operations team ... Servings Page should only be Events page. The layout of that page should
   look more like the Toronto Page ... a calendar should be the first thing that shows up ... The overlap buttons should
   instead be create a new event [that asks] what type of event it is, program or fundraiser, then for program,
   kitchen-based or cook from home, and for fundraiser they should choose which one it is, along with linked volunteer
   forms ... It should be how many confirmed on the denominator of how many we actually need ... an area where new
   volunteers that sign up for an event is in a list on that event for them to be placed ... a rule of 1 cook = 2 servers
   ... the main community lead could always use another one to support with 1 by 1 entry of each beneficiary (this could
   also be handed to a server) while the main one (conversations) could have 2 people ... encouragement to get more
   volunteers involved when we have many come through ... there's a lot of buttons now, and some of them go to the same
   place, some of them bring you to a place that you're not supposed to go."

   One module owns the Events page (#volunteering, #volunteering/calendar): the month, the next event, the upcoming
   events, the past ones; New event (a program or a fundraiser, step by step); the counts (confirmed of needed, one
   sum for every screen: w342.tally, which wave191's rosterCounts now returns); each event's "Signed up, to place" list
   (wa342_place); the community leads' jobs (wa342_cl_job); 2 servers per cook (vol_servers_per_cook, wa342_rule_save).
   The older waves keep each event's page (the board, the steps, the messages, the plan): their sources were edited
   where they counted, named or linked differently (the header, Next up, the More menu, the tabs, the titles, the rail).
   Nothing here sends a message: every email and text is still reviewed and sent by a person (wave340).
   ===================================================================== */
(function () {
  'use strict';
  if (window.w342) return;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif", HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var OUT = 'cubic-bezier(.23,1,.32,1)';
  var ROLE_ORDER = ['team_leader', 'cook', 'driver', 'server', 'dishwasher', 'photographer', 'videographer', 'community_debrief'];
  var ONE = { team_leader: 'Team leader', cook: 'Cook', driver: 'Driver', server: 'Server', dishwasher: 'Dishwasher', photographer: 'Photographer', videographer: 'Videographer', community_debrief: 'Community lead', volunteer: 'Volunteer' };
  var MANY = { team_leader: 'Team leaders', cook: 'Cooks', driver: 'Drivers', server: 'Servers', dishwasher: 'Dishwashers', photographer: 'Photographers', videographer: 'Videographers', community_debrief: 'Community leads', volunteer: 'Volunteers' };
  var FORMATS = { home_cooked: 'Home-cooked', community_kitchen: 'Community kitchen' };
  var FALLBACK = { team_leader: 1, cook: 4, driver: 2, server: 8, dishwasher: 1, photographer: 1, videographer: 0, community_debrief: 3 };
  var S = { at: 0, busy: null, loaded: false, err: '', events: [], more: {}, rows: {}, guides: null, rule: 2, cookMax: 15, pickMax: 6, funds: {}, froles: {}, partners: {}, month: null, sel: null, filter: 'all', pastOpen: false, pastN: 30, fresh: true };

  /* ---------- small things ---------- */
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lower(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function staff() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function say(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function msgOf(e) { return String((e && (e.message || e.details)) || e || '').replace(/^.*?ERROR:\s*/, '').slice(0, 200); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function today() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateOf(iso) { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); }
  function isoOf(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(iso, n) { var d = dateOf(iso); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); }
  function daysTo(iso) { return Math.round((dateOf(iso).getTime() - dateOf(today()).getTime()) / 86400000); }
  function fmtDay(iso, how) {
    try {
      var o = how === 'long' ? { weekday: 'long', month: 'long', day: 'numeric' } : how === 'full' ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } : how === 'md' ? { month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' };
      o.timeZone = 'UTC'; return dateOf(iso).toLocaleDateString('en-CA', o).replace(/\./g, '');
    } catch (e) { return String(iso); }
  }
  function rel(iso) { var d = daysTo(iso); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 1 ? 'In ' + d + ' days' : d === -1 ? 'Yesterday' : Math.abs(d) + ' days ago'; }
  function hm(t) { var m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); if (!m) return ''; var h = Number(m[1]); return (h % 12 || 12) + (m[2] === '00' ? '' : ':' + m[2]) + (h < 12 ? ' am' : ' pm'); }
  function roleKey(r) { var k = lower(r) || 'volunteer'; return k === 'community_talker' ? 'community_debrief' : k; }
  function roleOne(k, ev) { var f = ev && froleName(ev, k); return f || ONE[k] || String(k || '').replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function roleMany(k, ev) { var f = ev && froleName(ev, k); return f || MANY[k] || roleOne(k); }
  function froleName(ev, k) { var rs = ev && ev.fund_event_id != null ? S.froles[ev.fund_event_id] : null; var r = rs ? rs.filter(function (x) { return x.key === k; })[0] : null; return r ? r.name : ''; }
  var IC = {
    plus: '<path d="M12 5v14M5 12h14"/>', chev: '<path d="m9 6 6 6-6 6"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 2.9-5 6-5s5.400 1.800 6 5M16 5.200a3.200 3.200 0 0 1 0 6.200M17.500 14.300c2 .500 3.200 2.100 3.500 4.700"/>',
    chat: '<path d="M4 5.500h16v10.500H10l-4.500 3.500V16H4z"/>', cal: '<rect x="3.500" y="5" width="17" height="15" rx="2.500"/><path d="M3.500 10h17M8 3v4M16 3v4"/>',
    pot: '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM2 10h20M9 6.500c0-1.500 1.500-1.500 1.500-3M13.500 6.500c0-1.500 1.500-1.500 1.500-3"/>', home: '<path d="M4 11.500 12 4l8 7.500M6.500 10V20h11V10"/>',
    gift: '<rect x="3.500" y="9" width="17" height="11" rx="1.500"/><path d="M3.500 13h17M12 9v11M12 9c-1.500-4-6-3.500-5-1 .600 1.300 3 1 5 1zM12 9c1.500-4 6-3.500 5-1-.600 1.300-3 1-5 1z"/>', heart: '<path d="M12 20s-7.500-4.600-7.500-10A4.200 4.200 0 0 1 12 7.500 4.200 4.200 0 0 1 19.500 10c0 5.400-7.500 10-7.500 10z"/>'
  };
  function ic(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[k] || '') + '</svg>'; }

  /* ---------- who counts, and how (one sum for every screen) ---------- */
  function isConf(r) { return lower(r.status) === 'confirmed' || r.confirm_status === 'confirmed'; }
  function isOut(r) { var s = lower(r.status); return s === 'cancelled' || s === 'unavailable' || r.confirm_status === 'declined'; }
  function isSignup(r) { var s = lower((r.detail || {}).source); return s === 'hub_form' || s === 'form' || s.indexOf('self sign-up') === 0; }
  /* signed up themselves (or waiting for a role), and nobody on the team has placed, asked or heard from them yet: the same rule as wa342_to_place */
  function toPlace(r) {
    if (!r || isOut(r) || r.confirm_status) return false;
    var s = lower(r.status); if (s !== '' && s !== 'tbd') return false;
    var d = r.detail || {}; if (d.placed_at || d.assigned_at || d.partner === true || d.partner === 'true') return false;
    return roleKey(r.role) === 'volunteer' || isSignup(r);
  }
  function usual() {
    var t = {}; var g = S.guides;
    try { if ((!g || !g.length) && window.w191 && w191.S && w191.S.guides && w191.S.guides.length) g = w191.S.guides; } catch (e) { /* fine */ }
    if (g && g.length) { g.forEach(function (x) { if (x.target != null && Number(x.target) > 0) t[roleKey(x.role)] = Number(x.target); }); return t; }
    return Object.assign({}, FALLBACK);
  }
  function targetsFor(ev) {
    var sc = ev && ev.spot_counts && typeof ev.spot_counts === 'object' ? ev.spot_counts : null;
    if (ev && ev.kind === 'fundraiser') { var f = {}; Object.keys(sc || {}).forEach(function (k) { var n = Number(sc[k]); if (isFinite(n) && n > 0) f[k] = Math.round(n); }); return f; }
    var t = usual();
    if (sc) Object.keys(sc).forEach(function (k) { var n = Number(sc[k]); if (isFinite(n) && n >= 0) t[roleKey(k)] = Math.round(n); });
    Object.keys(t).forEach(function (k) { if (!t[k]) delete t[k]; });
    return t;
  }
  /* rows: an event's roster. T: its spots per role. P: its partner organization, if one serves with us (wave191o's rule).
     service: the sign-up list applies (Montreal servings). */
  function tally(rows, T, P, service, fixedServers) {
    T = Object.assign({}, T || {});
    var live = (rows || []).filter(function (r) { return !isOut(r); });
    var place = service === false ? [] : live.filter(toPlace);
    var list = live.filter(function (r) { return place.indexOf(r) < 0; });
    var by = {}, byConf = {}, byWait = {};
    list.forEach(function (r) { var k = roleKey(r.role); by[k] = (by[k] || 0) + 1; if (isConf(r)) byConf[k] = (byConf[k] || 0) + 1; else byWait[k] = (byWait[k] || 0) + 1; });
    /* the count handed to a server fills a community lead's spot */
    var lent = list.filter(function (r) { return roleKey(r.role) === 'server' && (r.detail || {}).cl_job === 'count'; })[0];
    if (lent && (T.community_debrief || 0) > (by.community_debrief || 0)) { by.community_debrief = (by.community_debrief || 0) + 1; if (isConf(lent)) byConf.community_debrief = (byConf.community_debrief || 0) + 1; else byWait.community_debrief = (byWait.community_debrief || 0) + 1; }
    if (P) {
      var cov = P.covers || {}, signed = {};
      list.forEach(function (r) { if ((r.detail || {}).source === 'partner form') signed[roleKey(r.role)] = (signed[roleKey(r.role)] || 0) + 1; });
      Object.keys(cov).forEach(function (k) { if (k === 'team_leader' || k === 'community_debrief') return; var add = Math.max(0, (Number(cov[k]) || 0) - (signed[k] || 0)); if (!add) return; by[k] = (by[k] || 0) + add; byConf[k] = (byConf[k] || 0) + add; });
      if (P.food && P.food !== 'ours') { by.cook = Math.max(by.cook || 0, T.cook || 0); byConf.cook = Math.max(byConf.cook || 0, T.cook || 0); }
      if (P.food === 'they_bring' && (T.driver || 0) > 1) T.driver = 1;
    }
    /* Steel, 14/11/26: the cooks are a minimum. Every cook on the team is needed, and each one opens S.rule more server
       spots, so adding cooks early lets the team accept more servers. A cook who brings their dish and serves it is a server too. */
    var cookMin = T.cook || 0, serving = [];
    if (service !== false && S.rule > 0 && cookMin) {
      T.cook = Math.max(cookMin, Math.min(Math.max(cookMin, S.cookMax || 15), by.cook || 0));   /* at most 15 cooks at one serving (Steel, 14/11/26) */
      if (!fixedServers) T.server = Math.max(T.server || 0, T.cook * S.rule);
    }
    if (service !== false) {
      serving = list.filter(function (r) { return roleKey(r.role) === 'cook' && (r.detail || {}).serves_too; });
      serving.forEach(function (r) { by.server = (by.server || 0) + 1; if (isConf(r)) byConf.server = (byConf.server || 0) + 1; else byWait.server = (byWait.server || 0) + 1; });
    }
    var keys = ROLE_ORDER.filter(function (k) { return T[k] || by[k]; });
    Object.keys(T).concat(Object.keys(by)).forEach(function (k) { if (keys.indexOf(k) < 0 && k !== 'volunteer' && (T[k] || by[k])) keys.push(k); });
    var need = 0, filled = 0, waitIn = 0;
    keys.forEach(function (k) { var t = T[k] || 0; need += t; filled += Math.min(byConf[k] || 0, t); waitIn += Math.min(byWait[k] || 0, Math.max(0, t - (byConf[k] || 0))); });
    var confAll = list.filter(isConf).length;
    return { T: T, by: by, byConf: byConf, byWait: byWait, roles: keys, on: list.length, confAll: confAll, conf: confAll, wait: list.length - confAll, waitIn: waitIn,
      place: place.length, placeRows: place, need: need, filled: filled, open: Math.max(0, need - filled),
      short: keys.filter(function (k) { return (T[k] || 0) > (byConf[k] || 0); }), extra: Math.max(0, live.length - need),
      find: keys.reduce(function (a, k) { return a + Math.max(0, (T[k] || 0) - (by[k] || 0)); }, 0), over: Math.max(0, confAll - filled), cookMin: cookMin, serving: serving, cookMax: S.cookMax || 15, pickMax: S.pickMax,
      pickups: list.filter(function (r) { return roleKey(r.role) === 'cook' && /^pick/i.test(String((r.detail || {}).pickup_dropoff || '')); }).length };
  }
  function rosterOf(id) { return S.rows[id] || []; }
  function evFull(e) { return Object.assign({}, e, S.more[e.id] || {}); }
  /* an event whose servers a person set by hand (not the rule's number) keeps that number */
  function fixedSrv(id, sc) {
    try { if (!sc && window.w191 && w191.S && w191.S.spots) sc = w191.S.spots[id]; } catch (e) { /* fine */ }
    if (!sc && S.more[id]) sc = S.more[id].spot_counts;
    if (!sc || typeof sc !== 'object' || sc.server == null) return false;
    var ck = sc.cook != null ? Number(sc.cook) : (usual().cook || 0);
    return Number(sc.server) !== ck * S.rule;
  }
  function tallyOf(e) { var f = evFull(e); return tally(rosterOf(e.id), targetsFor(f), S.partners[e.id] || null, f.kind === 'service', fixedSrv(e.id, f.spot_counts)); }
  /* the event page's own data (wave191 holds the serving's row and the partner) */
  function tallyD(D, T, P) { var ev = evOfD(D); return tally((D && D.roster) || [], T || targetsFor(ev), P || null, !ev || ev.kind === 'service' || !ev.kind, fixedSrv(D && D.id, null)); }
  function evOfD(D) { var id = D && D.id, e = null; try { (WA_VOL_EVENTS || []).forEach(function (x) { if (String(x.id) === String(id)) e = x; }); } catch (x) { /* fine */ } return e ? evFull(e) : null; }

  /* ---------- the Events page's data ---------- */
  function isMtl(e) { return e && e.kind !== 'meal' && lower(e.location) !== 'toronto' && !/^TO-/.test(String(e.code || '')); }
  function isProgram(e) { return e.kind !== 'fundraiser'; }
  async function load(force) {
    if (S.busy) return S.busy;
    if (!force && S.loaded && Date.now() - S.at < 20000) return;
    S.busy = (async function () {
      try {
        if (force) { try { WA_VOL_LOADED = false; } catch (e) { /* fine */ } }
        await waVolLoad(false);
        var t = today(); var evs = ((typeof WA_VOL_EVENTS !== 'undefined' && WA_VOL_EVENTS) || []).filter(isMtl);
        var ids = evs.filter(function (e) { return String(e.event_date) >= t; }).map(function (e) { return e.id; });
        var none = Promise.resolve({ data: [] });
        var res = await Promise.all([
          ids.length ? db.from('volunteer_events').select('id,spot_counts,format,start_time,fund_event_id,kitchen_place,planned_meals').in('id', ids) : none,
          ids.length ? db.from('event_roster').select('id,event_id,person_id,person_name,role,status,confirm_status,detail,created_at').in('event_id', ids) : none,
          db.from('volunteer_role_guides').select('role,target,label_en'),
          db.from('app_config').select('key,value').in('key', ['vol_servers_per_cook', 'vol_cooks_max', 'vol_pickups_max']),
          db.from('fund_events').select('id,title,status'),
          ids.length ? db.from('volunteer_event_partners').select('event_id,covers,food,active').in('event_id', ids) : none,
          db.from('fund_event_roles').select('id,fund_event_id,key,name,spots,retired_at')
        ]);
        if (res[1] && res[1].error) throw res[1].error;
        S.events = evs; S.more = {}; S.rows = {}; S.partners = {}; S.funds = {}; S.froles = {};
        ((res[0] && res[0].data) || []).forEach(function (x) { S.more[x.id] = x; });
        ((res[1] && res[1].data) || []).forEach(function (r) { (S.rows[r.event_id] = S.rows[r.event_id] || []).push(r); });
        if (res[2] && res[2].data && res[2].data.length) S.guides = res[2].data;
        ((res[3] && res[3].data) || []).forEach(function (c) { var n = Number(c.value); if (!isFinite(n) || n < 0) return; if (c.key === 'vol_servers_per_cook') S.rule = n; if (c.key === 'vol_cooks_max' && n > 0) S.cookMax = n; if (c.key === 'vol_pickups_max') S.pickMax = n; });
        ((res[4] && res[4].data) || []).forEach(function (f) { S.funds[f.id] = f; });
        ((res[5] && res[5].data) || []).forEach(function (p) { if (p.active !== false) S.partners[p.event_id] = p; });
        ((res[6] && res[6].data) || []).forEach(function (r) { (S.froles[r.fund_event_id] = S.froles[r.fund_event_id] || []).push(r); });
        S.loaded = true; S.at = Date.now(); S.err = '';
      } catch (e) { S.err = msgOf(e) || 'Could not load the events'; }
      S.busy = null;
    })();
    return S.busy;
  }
  function typeLine(e) {
    var f = evFull(e);
    if (f.kind === 'fundraiser') { var fe = f.fund_event_id != null ? S.funds[f.fund_event_id] : null; return 'Fundraiser' + (fe ? ' · ' + fe.title : ''); }
    if (f.kind && f.kind !== 'service') return f.kind.charAt(0).toUpperCase() + f.kind.slice(1);
    return 'Program' + (f.format ? ' · ' + (FORMATS[f.format] || f.format) : ' · format not set');
  }
  function titleOf(e) { return String(e.title || '').trim() || (e.kind === 'fundraiser' ? 'Shift' : 'Sunday serving'); }
  function whereLine(e) { var f = evFull(e), t = hm(f.start_time), p = String(f.kind === 'service' && f.format === 'community_kitchen' && f.kitchen_place ? f.kitchen_place : (e.location || '')).trim(); return [t, p].filter(Boolean).join(' · '); }

  /* ---------- the Events page ---------- */
  function mast(title, line) {
    var sec = document.getElementById('volunteering'); if (!sec) return null;
    var m = sec.querySelector(':scope > .w118mast');
    if (!m) { m = document.createElement('div'); m.className = 'w118mast'; m.setAttribute('data-w118', 'volunteering'); m.innerHTML = '<div class="crumb">Operations Montreal</div><h1></h1><p></p>'; sec.insertBefore(m, sec.firstChild); }
    var h1 = m.querySelector('h1'), p = m.querySelector(':scope > p');
    if (h1 && h1.textContent !== title) h1.textContent = title;
    if (p && p.textContent !== line) p.textContent = line;
    return m;
  }
  function rootEl() {
    var sec = document.getElementById('volunteering'); if (!sec) return null;
    var r = document.getElementById('w342root');
    Array.prototype.slice.call(sec.children).forEach(function (c) { if (c !== r && !c.classList.contains('w118mast')) sec.removeChild(c); });
    if (!r) { r = document.createElement('div'); r.id = 'w342root'; sec.appendChild(r); S.fresh = true; }
    sec.classList.remove('w307home', 'w307l');
    return r;
  }
  function barRows(e, t, dark) {
    var f = evFull(e);
    return '<div class="w342brs">' + t.roles.map(function (k) {
      var need = t.T[k] || 0, c = t.byConf[k] || 0, w = t.byWait[k] || 0, den = Math.max(need, c + w, 1);
      return '<div class="w342br"><span class="l">' + E(roleMany(k, f)) + '</span><span class="w342bar" role="img" aria-label="' + E(c + ' confirmed' + (need ? ' of ' + need + ' needed' : '') + (w ? ', ' + w + ' waiting' : '')) + '"><i class="w" style="--s:' + Math.min(1, (c + w) / den).toFixed(3) + '"></i><i class="c" style="--s:' + Math.min(1, c / den).toFixed(3) + '"></i></span><span class="n' + (need && c >= need ? ' ok' : '') + '">' + c + (need ? '/' + need : '') + '</span></div>';
    }).join('') + '</div>';
  }
  function sideNotes(e, t) {
    var bits = [];
    if (t.wait) bits.push(plural(t.wait, 'waiting to confirm', 'waiting to confirm'));
    if (t.place) bits.push('<b class="pl">' + plural(t.place, 'signed up, to place', 'signed up, to place') + '</b>');
    return bits.join(' · ');
  }
  function heroHtml(e, isNext) {
    var t = tallyOf(e), f = evFull(e), off = lower(e.status) === 'cancelled';
    var kick = isNext ? 'Next event' : (String(e.event_date) < today() ? 'Past event' : 'Selected');
    return '<section class="w342blk" aria-labelledby="w342hk"><div role="heading" aria-level="2" class="w342kick" id="w342hk">' + E(kick) + '</div>'
      + '<a class="w342hero' + (f.kind === 'fundraiser' ? ' fund' : '') + '" id="w342hero" href="#volunteering/e/' + E(e.id) + '" data-w342ev="' + E(e.id) + '">'
      + '<div class="hl"><div class="ht"><span class="date">' + E(fmtDay(e.event_date)) + '</span>' + (off ? '<span class="w342chip no">Cancelled</span>' : '<span class="w342chip gold">' + E(rel(e.event_date)) + '</span>') + '</div>'
      + '<div class="tt" role="heading" aria-level="3">' + E(titleOf(e)) + '</div><p class="meta">' + E(typeLine(e)) + '</p>' + (whereLine(e) ? '<p class="meta">' + E(whereLine(e)) + '</p>' : '')
      + '<span class="w342open">Open the event ' + ic('chev') + '</span></div>'
      + '<div class="hr">' + (off ? '<p class="meta">This event is cancelled.</p>' : (t.need
        ? '<p class="conf"><b>' + t.filled + '</b> of ' + t.need + ' confirmed</p>' + (sideNotes(e, t) ? '<p class="side">' + sideNotes(e, t) + '</p>' : '') + barRows(e, t)
          + '<p class="leg" aria-hidden="true"><span><i></i>Confirmed</span><span><i class="w"></i>Waiting to confirm</span></p>'
        : '<p class="conf"><b>' + t.confAll + '</b> confirmed</p><p class="side">No spots set for this event yet.</p>')) + '</div></a>'
      + (!off && t.place ? cheer(e, t) : '') + '</section>';
  }
  /* when more people sign up than the event has room for: keep them involved */
  function cheer(e, t) {
    var over = t.place + t.on > t.need && t.need > 0;
    var line = over
      ? '<b>' + plural(t.place, 'person', 'people') + ' signed up</b> and ' + (t.open ? 'there ' + (t.open === 1 ? 'is 1 spot' : 'are ' + t.open + ' spots') + ' left' : 'every spot is taken') + '. Place who fits, then offer the others another date or a fundraiser shift so nobody who raised a hand is left out.'
      : '<b>' + plural(t.place, 'person', 'people') + ' signed up</b> and ' + (t.place === 1 ? 'is' : 'are') + ' waiting for a spot. Place them while they are keen.';
    return '<div class="w342cheer">' + ic('heart') + '<p>' + line + '</p><a class="w342btn sm" href="#volunteering/e/' + E(e.id) + '" data-w342ev="' + E(e.id) + '">Place them</a></div>';
  }
  function cardHtml(e) {
    var off = lower(e.status) === 'cancelled', t = off ? null : tallyOf(e), f = evFull(e);
    return '<a class="w342card' + (off ? ' off' : '') + (f.kind === 'fundraiser' ? ' fund' : '') + (String(S.sel) === String(e.id) ? ' sel' : '') + '" href="#volunteering/e/' + E(e.id) + '" data-w342ev="' + E(e.id) + '">'
      + '<div class="ct"><span class="cd">' + E(fmtDay(e.event_date)) + '</span>' + (off ? '<span class="w342chip no">Cancelled</span>' : '<span class="w342chip">' + E(rel(e.event_date)) + '</span>') + '</div>'
      + '<div class="tt" role="heading" aria-level="3">' + E(titleOf(e)) + '</div><p class="meta">' + E(typeLine(e)) + '</p>'
      + (off ? '' : (t.need
        ? '<p class="cf"><b>' + t.filled + '</b> of ' + t.need + ' confirmed</p><span class="w342bar big" aria-hidden="true"><i class="w" style="--s:' + Math.min(1, (t.filled + t.waitIn) / t.need).toFixed(3) + '"></i><i class="c" style="--s:' + Math.min(1, t.filled / t.need).toFixed(3) + '"></i></span>'
        : '<p class="cf"><b>' + t.confAll + '</b> confirmed</p>')
        + (sideNotes(e, t) ? '<p class="side">' + sideNotes(e, t) + '</p>' : '')) + '</a>';
  }
  function pastRow(e) {
    var s = lower(e.status), n = Number(e.roster_confirmed) || 0;
    var m = s === 'cancelled' ? 'Cancelled' : n ? plural(n, 'volunteer') + ' confirmed' : s === 'completed' ? 'Done' : 'Not closed yet';
    return '<a class="w342prow" href="#volunteering/e/' + E(e.id) + '" data-w342ev="' + E(e.id) + '"><span class="d">' + E(fmtDay(e.event_date, 'md')) + ' ' + E(String(e.event_date).slice(0, 4)) + '</span><span class="t">' + E(titleOf(e)) + '<small>' + E(e.code || '') + '</small></span><span class="m">' + E(m) + '</span></a>';
  }
  /* the month: Monday first; a day with an event is a button */
  function monthOf(iso) { return String(iso).slice(0, 7); }
  function calHtml(all) {
    var m = S.month || monthOf(today()), y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7));
    var first = new Date(Date.UTC(y, mo - 1, 1, 12)), lead = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, mo, 0, 12)).getUTCDate();
    var byDay = {}; all.forEach(function (e) { if (monthOf(e.event_date) === m) (byDay[e.event_date] = byDay[e.event_date] || []).push(e); });
    var t = today(), cells = '';
    for (var i = 0; i < lead; i++) cells += '<span class="e"></span>';
    for (var d = 1; d <= days; d++) {
      var iso = m + '-' + pad(d), evs = byDay[iso] || [];
      if (!evs.length) { cells += '<span class="d' + (iso === t ? ' today' : '') + '">' + d + '</span>'; continue; }
      var on = evs.some(function (e) { return String(e.id) === String(S.sel); }), off = evs.every(function (e) { return lower(e.status) === 'cancelled'; }), fund = evs.some(function (e) { return e.kind === 'fundraiser'; }), prog = evs.some(isProgram);
      var lbl = fmtDay(iso, 'long') + ': ' + evs.map(function (e) { return titleOf(e) + (lower(e.status) === 'cancelled' ? ' (cancelled)' : ''); }).join(', ');
      cells += '<button type="button" class="d has' + (iso === t ? ' today' : '') + (on ? ' on' : '') + (off ? ' off' : '') + (iso < t ? ' past' : '') + '" data-w342day="' + iso + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + E(lbl) + '" title="' + E(lbl) + '">' + d
        + '<span class="dots">' + (prog ? '<i class="p"></i>' : '') + (fund ? '<i class="f"></i>' : '') + '</span></button>';
    }
    var name = first.toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return '<section class="w342cal" id="w342cal" aria-label="Calendar"><div class="top"><div class="mo" role="heading" aria-level="2" aria-live="polite">' + E(name) + '</div><div class="nav">'
      + '<button type="button" class="w342ib" data-w342m="-1" aria-label="Previous month">' + ic('back') + '</button>'
      + '<button type="button" class="w342btn sm" data-w342m="0">Today</button>'
      + '<button type="button" class="w342ib fw" data-w342m="1" aria-label="Next month">' + ic('back') + '</button></div></div>'
      + '<div class="wk" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>'
      + '<div class="grid">' + cells + '</div>'
      + '<p class="leg"><span><i class="p"></i>Program</span><span><i class="f"></i>Fundraiser</span><span class="q">Pick a day to see its event.</span></p></section>';
  }
  function nudges(up) {
    var out = '', n = 0; up.forEach(function (e) { if (lower(e.status) !== 'cancelled') n += tallyOf(e).place; });
    var first = up.filter(function (e) { return lower(e.status) !== 'cancelled' && tallyOf(e).place; })[0];
    if (n && first) out += '<a class="w342nudge" href="#volunteering/e/' + E(first.id) + '" data-w342ev="' + E(first.id) + '">' + ic('people') + '<span><b>' + plural(n, 'person', 'people') + ' signed up</b> and ' + (n === 1 ? 'is' : 'are') + ' waiting to be placed.</span><em>Place them ' + ic('chev') + '</em></a>';
    var w = 0; try { w = Number(window.w256 && w256.waiting && w256.waiting()) || 0; } catch (e) { w = 0; }
    if (w) out += '<a class="w342nudge" href="#volunteering/phone">' + ic('chat') + '<span><b>' + plural(w, 'conversation') + '</b> on the ops line ' + (w === 1 ? 'is' : 'are') + ' waiting for an answer.</span><em>Open Messages ' + ic('chev') + '</em></a>';
    return out ? '<div class="w342nudges">' + out + '</div>' : '';
  }
  function eventsHtml() {
    if (!S.loaded) return S.err ? '<p class="w342err" role="alert">Couldn’t load the events: ' + E(S.err) + '. Check your connection, then reload the page.</p>' : '<p class="w342quiet" role="status">Loading the events…</p>';
    var t = today();
    var all = S.events.slice().sort(function (a, b) { return String(a.event_date) < String(b.event_date) ? -1 : String(a.event_date) > String(b.event_date) ? 1 : Number(a.id) - Number(b.id); });
    var up = all.filter(function (e) { return String(e.event_date) >= t; });
    var live = up.filter(function (e) { return lower(e.status) !== 'cancelled' && lower(e.status) !== 'completed'; });
    var past = all.filter(function (e) { return String(e.event_date) < t; }).reverse();
    var next = live[0] || null;
    var sel = S.sel != null ? all.filter(function (e) { return String(e.id) === String(S.sel); })[0] : null;
    var hero = sel || next;
    var anyFund = up.some(function (e) { return e.kind === 'fundraiser'; });
    var rest = up.filter(function (e) { return e !== next; }).filter(function (e) { return S.filter === 'all' || (S.filter === 'fund') === (e.kind === 'fundraiser'); });
    rest.sort(function (a, b) { var ca = lower(a.status) === 'cancelled' ? 1 : 0, cb = lower(b.status) === 'cancelled' ? 1 : 0; return ca - cb || (String(a.event_date) < String(b.event_date) ? -1 : 1); });
    var html = (S.err ? '<p class="w342err" role="alert">Couldn’t refresh the events: ' + E(S.err) + '</p>' : '') + nudges(up);
    html += '<div class="w342top">' + calHtml(all) + '<div class="w342side">' + (hero ? heroHtml(hero, hero === next)
      : '<section class="w342blk"><div role="heading" aria-level="2" class="w342kick">Next event</div><div class="w342empty"><div class="tt" role="heading" aria-level="3">No upcoming event yet.</div><p>Plan the next one: it takes a minute, and its checklist comes with it.</p>' + (staff() ? '<button type="button" class="w342btn pri" data-w342new="1">' + ic('plus') + 'New event</button>' : '') + '</div></section>') + '</div></div>';
    if (rest.length || anyFund) html += '<section class="w342blk" aria-labelledby="w342hup"><div class="w342hrow"><div role="heading" aria-level="2" class="w342h2" id="w342hup">Upcoming</div>'
      + (anyFund ? '<div class="w342seg" role="group" aria-label="Which events">' + [['all', 'All'], ['program', 'Programs'], ['fund', 'Fundraisers']].map(function (f) { return '<button type="button" data-w342f="' + f[0] + '" aria-pressed="' + (S.filter === f[0] ? 'true' : 'false') + '">' + f[1] + '</button>'; }).join('') + '</div>' : '') + '</div>'
      + (rest.length ? '<div class="w342grid" id="w342up">' + rest.map(cardHtml).join('') + '</div>' : '<p class="w342quiet">Nothing here yet.</p>') + '</section>';
    if (past.length) html += '<section class="w342blk" aria-labelledby="w342hpast"><div role="heading" aria-level="2" class="w342h2" id="w342hpast"><button type="button" class="w342fold" data-w342past="1" aria-expanded="' + (S.pastOpen ? 'true' : 'false') + '" aria-controls="w342pastl">' + ic('chev') + 'Past events (' + past.length + ')</button></div>'
      + '<div id="w342pastl"' + (S.pastOpen ? '' : ' hidden') + '>' + (S.pastOpen ? past.slice(0, S.pastN).map(pastRow).join('') + (past.length > S.pastN ? '<button type="button" class="w342btn" data-w342more="1">Show ' + Math.min(30, past.length - S.pastN) + ' more</button>' : '') : '') + '</div></section>';
    return html;
  }
  function paintEvents() {
    var r = rootEl(); if (!r) return;
    mast('Events', 'Programs and fundraisers that need volunteers, in Montreal');
    var html = chips() + eventsHtml();   /* the menu's places as a row on a phone */
    if (r.__h !== html) { r.innerHTML = html; r.__h = html; if (S.fresh && S.loaded) { r.classList.add('w342in'); S.fresh = false; setTimeout(function () { r.classList.remove('w342in'); }, 500); } }
    try { document.title = 'Events · Volunteer Manager · Welfare Avenue Hub'; } catch (e) { /* fine */ }
  }
  function onEvents() { try { return WA_VOL_VIEW === 'calendar' && /^#volunteering(\/calendar)?\/?$/.test(String(location.hash || '')); } catch (e) { return false; } }
  async function renderEvents(force) {
    if (!onEvents()) return;
    paintEvents();
    await load(force);
    if (!onEvents()) return;
    if (!S.month) { var t = today(), nx = S.events.filter(function (e) { return String(e.event_date) >= t && lower(e.status) === 'planned'; }).sort(function (a, b) { return String(a.event_date) < String(b.event_date) ? -1 : 1; })[0]; S.month = monthOf(nx && daysTo(nx.event_date) < 45 ? nx.event_date : t); }
    paintEvents();
  }

  /* ---------- a sheet: New event, and placing people (one at a time on the screen; Escape, the backdrop or Close leave it) ---------- */
  var SH = { el: null, back: null, paint: null, onclose: null };
  function sheetOpen(paint, onclose) {
    sheetClose(true);
    var el = document.createElement('div'); el.id = 'w342sheet'; el.className = 'w342sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'w342sh');
    el.innerHTML = '<div class="bk" data-w342x="1"></div><div class="pn" tabindex="-1"></div>';
    document.body.appendChild(el); document.documentElement.classList.add('w342lock');
    SH.el = el; SH.back = document.activeElement; SH.paint = paint; SH.onclose = onclose || null;
    sheetPaint(true);
    (window.requestAnimationFrame || setTimeout)(function () { el.classList.add('in'); });
  }
  function sheetPaint(focus) {
    if (!SH.el || !SH.paint) return;
    var pn = SH.el.querySelector('.pn'), v = SH.paint() || {};
    var keep = document.activeElement && pn.contains(document.activeElement) ? (document.activeElement.id || document.activeElement.getAttribute('data-w342k') || '') : '';
    var top = pn.querySelector('.bd') ? pn.querySelector('.bd').scrollTop : 0;
    pn.innerHTML = '<div class="hd">' + (v.back ? '<button type="button" class="w342ib" data-w342w="back" aria-label="Back">' + ic('back') + '</button>' : '<span class="sp"></span>')
      + '<div class="tt">' + (v.step ? '<small>' + E(v.step) + '</small>' : '') + '<h2 id="w342sh">' + E(v.title || '') + '</h2></div>'
      + '<button type="button" class="w342ib" data-w342x="1" aria-label="Close">' + ic('x') + '</button></div>'
      + '<div class="bd">' + (v.sub ? '<p class="lead">' + v.sub + '</p>' : '') + (v.body || '') + '</div>'
      + (v.foot ? '<div class="ft">' + v.foot + '</div>' : '');
    var bd = pn.querySelector('.bd'); if (bd && !focus) bd.scrollTop = top;
    if (focus) { var f = pn.querySelector('[autofocus]') || pn.querySelector('.bd button, .bd input, .bd select, .bd textarea') || pn; try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    else if (keep) { var again = pn.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(keep) : keep)) || pn.querySelector('[data-w342k="' + keep + '"]'); if (again) { try { again.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }
  }
  function sheetClose(now) {
    var el = SH.el; if (!el) return;
    var back = SH.back, oc = SH.onclose; SH.el = null; SH.paint = null; SH.onclose = null; SH.back = null;
    document.documentElement.classList.remove('w342lock');
    el.classList.remove('in');
    var done = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    if (now) done(); else setTimeout(done, 220);
    if (back && back.focus && document.contains(back)) { try { back.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    if (oc) { try { oc(); } catch (e) { /* fine */ } }
  }
  document.addEventListener('keydown', function (e) {
    if (!SH.el) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); sheetClose(); return; }
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(SH.el.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (x) { return !x.disabled && x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, true);

  /* ---------- New event ---------- */
  var W = null;
  var PROG = ['kind', 'format', 'when', 'spots', 'review'], FUND = ['kind', 'fund', 'roles', 'forms', 'shift'];
  function defaultDate() {
    var t = today(), last = null;
    try { (WA_VOL_EVENTS || []).forEach(function (e) { if (isMtl(e) && e.kind === 'service' && lower(e.status) === 'planned' && String(e.event_date) >= t && (!last || e.event_date > last)) last = e.event_date; }); } catch (e) { /* fine */ }
    if (last) return addDays(last, 14);
    var d = dateOf(t), add = (7 - d.getUTCDay()) % 7 || 7; return addDays(t, add);
  }
  function usualSpots() { var u = targetsFor({ kind: 'service' }), o = {}; ROLE_ORDER.forEach(function (k) { o[k] = u[k] || 0; }); return o; }
  function newEvent(preset) {
    if (!staff()) return;
    W = { step: 'kind', kind: null, fmt: null, date: defaultDate(), time: '12:00', place: 'Montreal', title: '', kplace: '', kshift: '', spots: usualSpots(), srvTouched: false, busy: false, err: '', warn: '', made: null,
      fund: null, fundNew: '', fundList: null, fd: null, role: { name: '', spots: '', description: '' }, shift: { date: '', time: '', title: '', place: '', spots: {} }, shiftMade: null, formMade: 0 };
    if (preset && preset.date) W.date = preset.date;
    sheetOpen(wizView, function () { W = null; });
    load(false).then(function () { if (W && W.step === 'kind') { W.spots = usualSpots(); W.date = (preset && preset.date) || defaultDate(); } });
  }
  function stepNo() { var list = W.kind === 'fundraiser' ? FUND : PROG, i = list.indexOf(W.step); return i < 0 ? '' : 'Step ' + (i + 1) + ' of ' + list.length; }
  function choice(k, v, icon, title, text, on) { return '<button type="button" class="w342pick' + (on ? ' on' : '') + '" data-w342w="' + k + '" data-v="' + E(v) + '" aria-pressed="' + (on ? 'true' : 'false') + '"><span class="i">' + ic(icon) + '</span><span class="t"><b>' + E(title) + '</b><span>' + E(text) + '</span></span></button>'; }
  function field(label, html, hint) { return '<label class="w342fld"><span>' + E(label) + '</span>' + html + (hint ? '<small>' + hint + '</small>' : '') + '</label>'; }
  function errLine() { return (W.err ? '<p class="w342err" role="alert">' + E(W.err) + '</p>' : '') + (W.warn ? '<p class="w342warn" role="alert">' + E(W.warn) + '</p>' : ''); }
  function spotsTotal() { var n = 0; ROLE_ORDER.forEach(function (k) { n += Number(W.spots[k]) || 0; }); return n; }
  function ruleLine() {
    if (!S.rule) return '';
    var want = (Number(W.spots.cook) || 0) * S.rule, have = Number(W.spots.server) || 0;
    return have === want ? S.rule + ' per cook' : 'The rule says ' + want + ' (' + S.rule + ' per cook). <button type="button" class="w342lnk" data-w342w="rule">Use the rule</button>';
  }
  function spotRows() {
    return '<div class="w342spots">' + ROLE_ORDER.map(function (k) {
      var hint = k === 'server' ? ruleLine() : k === 'cook' ? 'The minimum. Add more any time, up to ' + (S.cookMax || 15) + ': each opens ' + (S.rule || 2) + ' server spots' : k === 'community_debrief' ? '2 on conversations, 1 on the count' : '';
      return '<div class="sp"><div class="l"><b>' + E(MANY[k]) + '</b>' + (hint ? '<small data-w342hint="' + k + '">' + hint + '</small>' : '') + '</div><div class="st"><button type="button" class="w342ib" data-w342w="dec" data-v="' + k + '" aria-label="One fewer ' + E(ONE[k].toLowerCase()) + '">−</button>'
        + '<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-w342k="sp-' + k + '" data-w342sp="' + k + '" value="' + E(W.spots[k]) + '" aria-label="' + E(MANY[k]) + ' needed">'
        + '<button type="button" class="w342ib" data-w342w="inc" data-v="' + k + '" aria-label="One more ' + E(ONE[k].toLowerCase()) + '">+</button></div></div>';
    }).join('') + '</div><p class="w342total" id="w342total"><b>' + spotsTotal() + '</b> volunteers needed</p>';
  }
  function liveRoles() { return ((W.fd && W.fd.roles) || []).filter(function (r) { return !r.retired_at; }); }
  function wizView() {
    if (!W) return {};
    var busy = W.busy ? ' disabled' : '';
    if (W.step === 'kind') return { title: 'New event', sub: 'What are you planning?',
      body: '<div class="w342picks">' + choice('kind', 'program', 'pot', 'A program', 'A serving: meals cooked and served to the people we support.', W.kind === 'program')
        + choice('kind', 'fundraiser', 'gift', 'A fundraiser', 'Volunteers for a fundraising event: its roles, its sign-up forms and its shifts.', W.kind === 'fundraiser') + '</div>' };
    if (W.step === 'format') return { back: 1, step: stepNo(), title: 'Where is the food cooked?', sub: 'This decides what the cooks are asked and how the day runs.',
      body: '<div class="w342picks">' + choice('fmt', 'community_kitchen', 'pot', 'Kitchen-based', 'Community kitchen: the cooks cook together in a kitchen before the serving.', W.fmt === 'community_kitchen')
        + choice('fmt', 'home_cooked', 'home', 'Cook from home', 'Home-cooked: each cook prepares at home, then drops the food off or has it picked up.', W.fmt === 'home_cooked') + '</div>' };
    if (W.step === 'when') return { back: 1, step: stepNo(), title: 'When and where?',
      body: '<div class="w342form">' + field('Date', '<input type="date" id="w342d" data-w342in="date" min="' + today() + '" value="' + E(W.date) + '" required>', W.date ? E(fmtDay(W.date, 'full')) + (dateOf(W.date).getUTCDay() !== 0 ? ' · not a Sunday' : '') : '')
        + field('The serving starts at', '<input type="time" id="w342t" data-w342in="time" value="' + E(W.time) + '">')
        + field('Where the meals are served', '<input type="text" id="w342p" data-w342in="place" maxlength="160" value="' + E(W.place) + '" placeholder="Montreal" autocomplete="off">')
        + (W.fmt === 'community_kitchen' ? field('The kitchen', '<input type="text" id="w342kp" data-w342in="kplace" maxlength="160" value="' + E(W.kplace) + '" placeholder="Name and address" autocomplete="off">', 'You can add it later.')
          + field('Kitchen time', '<input type="text" id="w342ks" data-w342in="kshift" maxlength="80" value="' + E(W.kshift) + '" placeholder="9:00 am to 11:30 am" autocomplete="off">') : '')
        + field('Name', '<input type="text" id="w342n" data-w342in="title" maxlength="120" value="' + E(W.title) + '" placeholder="Sunday serving" autocomplete="off">', 'Leave it empty for “Sunday serving”.') + '</div>' + errLine(),
      foot: '<button type="button" class="w342btn pri" data-w342w="next">Next</button>' };
    if (W.step === 'spots') return { back: 1, step: stepNo(), title: 'Who do you need?', sub: 'These are the usual numbers. Change any of them for this event only.',
      body: spotRows() + errLine(), foot: '<button type="button" class="w342btn pri" data-w342w="next">Next</button>' };
    if (W.step === 'review') return { back: 1, step: stepNo(), title: 'Ready to create?',
      body: '<dl class="w342sum"><dt>What</dt><dd>A program, ' + (W.fmt === 'community_kitchen' ? 'kitchen-based' : 'cooked from home') + '</dd><dt>When</dt><dd>' + E(fmtDay(W.date, 'full')) + ', ' + E(hm(W.time) || 'noon') + '</dd><dt>Where</dt><dd>' + E(W.place || 'Montreal') + (W.fmt === 'community_kitchen' && W.kplace ? '<br>Kitchen: ' + E(W.kplace) + (W.kshift ? ', ' + E(W.kshift) : '') : '') + '</dd><dt>Name</dt><dd>' + E(W.title || 'Sunday serving') + '</dd>'
        + '<dt>Volunteers</dt><dd>' + spotsTotal() + ' needed: ' + ROLE_ORDER.filter(function (k) { return W.spots[k] > 0; }).map(function (k) { return W.spots[k] + ' ' + (W.spots[k] === 1 ? ONE[k] : MANY[k]).toLowerCase(); }).join(', ') + '</dd></dl>'
        + '<p class="w342quiet">Creating it adds the event to the calendar and copies the checklist. Nobody is messaged.</p>' + errLine(),
      foot: '<button type="button" class="w342btn pri" data-w342w="create"' + busy + '>' + (W.busy ? 'Creating…' : W.warn ? 'Create it anyway' : 'Create the event') + '</button>' };
    if (W.step === 'done' && W.kind === 'program') return { title: (W.made && W.made.code ? W.made.code + ' is' : 'It is') + ' on the calendar',
      body: '<div class="w342done">' + ic('check') + '<p><b>' + E(fmtDay(W.date, 'full')) + '</b><br>Its checklist is ready and its spots are set.</p></div>'
        + '<ol class="w342next"><li><b>Share the sign-up form.</b> Everyone who signs up for this date lands on the event’s “Signed up, to place” list.</li><li><b>Place them and add your regulars.</b> From the event’s Team tab.</li><li><b>Ask everyone to confirm.</b> From the event’s Messages tab, when it is time. Nothing goes out by itself.</li></ol>',
      foot: '<button type="button" class="w342btn" data-w342w="again">Add another</button><button type="button" class="w342btn pri" data-w342w="openev" data-v="' + E(W.made && W.made.id) + '">Open the event</button>' };
    /* ----- a fundraiser ----- */
    if (W.step === 'fund') {
      var list = W.fundList, body;
      if (!list) body = '<p class="w342quiet" role="status">Loading the fundraisers…</p>';
      else {
        var on = list.filter(function (f) { return f.volunteer_on; }), other = list.filter(function (f) { return !f.volunteer_on && lower(f.status) !== 'done'; });
        body = (on.length ? '<p class="w342lbl">Already taking volunteers</p><div class="w342picks">' + on.map(function (f) { return choice('fundpick', f.id, 'gift', f.title, [plural(f.roles || 0, 'role'), plural(f.forms || 0, 'form'), plural(f.shifts || 0, 'shift')].join(' · '), String(W.fund) === String(f.id)); }).join('') + '</div>' : '')
          + '<div class="w342form">' + (other.length ? field('Another fundraising event', '<select id="w342fo" data-w342in="fundsel"><option value="">Pick one…</option>' + other.map(function (f) { return '<option value="' + E(f.id) + '"' + (String(W.fund) === String(f.id) ? ' selected' : '') + '>' + E(f.title) + '</option>'; }).join('') + '</select>') : '')
          + field('Or a new one', '<input type="text" id="w342fn" data-w342in="fundnew" maxlength="120" value="' + E(W.fundNew) + '" placeholder="Its name, e.g. Golf Tournament 2027" autocomplete="off">', 'It also shows in the Fundraising app’s Events, with its dates to be confirmed.') + '</div>';
      }
      return { back: 1, step: stepNo(), title: 'Which fundraiser?', body: body + errLine(), foot: '<button type="button" class="w342btn pri" data-w342w="next"' + busy + '>' + (W.busy ? 'Opening…' : 'Next') + '</button>' };
    }
    var ft = W.fd && W.fd.event ? W.fd.event.title : 'This fundraiser';
    if (W.step === 'roles') { var rs = liveRoles();
      return { back: 1, step: stepNo(), title: 'What will volunteers do?', sub: E(ft) + ': its roles. The sign-up form offers them as choices.',
        body: (rs.length ? '<ul class="w342list">' + rs.map(function (r) { return '<li><b>' + E(r.name) + '</b><span>' + (r.spots ? plural(r.spots, 'person', 'people') + ' needed' : 'number not set') + (r.description ? ' · ' + E(r.description) : '') + '</span></li>'; }).join('') + '</ul>' : '<p class="w342quiet">No roles yet. Add the first one.</p>')
          + '<div class="w342form box"><p class="w342lbl">Add a role</p>' + field('Role', '<input type="text" id="w342rn" data-w342in="rname" maxlength="80" value="' + E(W.role.name) + '" placeholder="e.g. Gift wrapping" autocomplete="off">')
          + field('How many people', '<input type="text" inputmode="numeric" pattern="[0-9]*" id="w342rs" data-w342in="rspots" maxlength="3" value="' + E(W.role.spots) + '" placeholder="Optional">')
          + field('What it involves', '<input type="text" id="w342rd" data-w342in="rdesc" maxlength="200" value="' + E(W.role.description) + '" placeholder="One line" autocomplete="off">')
          + '<button type="button" class="w342btn" data-w342w="addrole"' + busy + '>' + ic('plus') + 'Add the role</button></div>' + errLine(),
        foot: '<button type="button" class="w342btn pri" data-w342w="next"' + busy + '>Next</button>' }; }
    if (W.step === 'forms') { var fs = (W.fd && W.fd.forms) || [], vol = fs.filter(function (f) { return f.kind === 'volunteer' || f.purpose === 'volunteers'; }), others = ((W.fd && W.fd.other_forms) || []).filter(function (f) { return lower(f.status) !== 'closed'; });
      return { back: 1, step: stepNo(), title: 'How do people sign up?', sub: 'Link the volunteer form for ' + E(ft) + '. Everyone who fills it in files under this fundraiser.',
        body: (fs.length ? '<ul class="w342list">' + fs.map(function (f) { return '<li><b>' + E(f.title) + '</b><span><em class="w342chip ' + (lower(f.status) === 'published' ? 'yes' : 'wait') + '">' + (lower(f.status) === 'published' ? 'Live' : 'Draft') + '</em> ' + E(String(f.lang || '').toUpperCase()) + (f.n != null ? ' · ' + plural(Number(f.n) || 0, 'answer') : '') + '</span></li>'; }).join('') + '</ul>' : '<p class="w342quiet">No form linked yet.</p>')
          + (vol.length ? '' : '<p class="w342warn">There is no volunteer form for this fundraiser yet. Make one below, or link one you already have.</p>')
          + '<div class="w342form box"><p class="w342lbl">Make a volunteer form</p><div class="w342row"><button type="button" class="w342btn" data-w342w="mkform" data-v="en"' + busy + '>In English</button><button type="button" class="w342btn" data-w342w="mkform" data-v="fr"' + busy + '>In French</button></div>'
          + '<small>It starts as a draft with this fundraiser’s roles as its choices. Check it and publish it in the CRM, under Forms.</small>'
          + (others.length ? field('Or link a form you already have', '<select id="w342fl" data-w342in="linkform"><option value="">Pick a form…</option>' + others.map(function (f) { return '<option value="' + E(f.id) + '">' + E(f.title) + ' (' + E(String(f.lang || '').toUpperCase()) + ', ' + E(lower(f.status) === 'published' ? 'live' : f.status) + ')</option>'; }).join('') + '</select>') : '') + '</div>' + errLine(),
        foot: '<button type="button" class="w342btn pri" data-w342w="next"' + busy + '>Next</button>' }; }
    if (W.step === 'shift') { var lr = liveRoles();
      return { back: 1, step: stepNo(), title: 'When do you need people?', sub: 'A shift is one day and time people come to help. Each shift gets its own team page, like a serving.',
        body: '<div class="w342form">' + field('Date', '<input type="date" id="w342sd" data-w342in="sdate" min="' + today() + '" value="' + E(W.shift.date) + '">', W.shift.date ? E(fmtDay(W.shift.date, 'full')) : '')
          + field('Starts at', '<input type="time" id="w342st" data-w342in="stime" value="' + E(W.shift.time) + '">')
          + field('Name', '<input type="text" id="w342sn" data-w342in="stitle" maxlength="120" value="' + E(W.shift.title) + '" placeholder="e.g. Wrapping, day 1" autocomplete="off">')
          + field('Place', '<input type="text" id="w342sp" data-w342in="splace" maxlength="160" value="' + E(W.shift.place) + '" placeholder="Address or venue" autocomplete="off">') + '</div>'
          + (lr.length ? '<p class="w342lbl">People needed</p><div class="w342spots">' + lr.map(function (r) { return '<div class="sp"><div class="l"><b>' + E(r.name) + '</b></div><div class="st"><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" data-w342k="ss-' + E(r.key) + '" data-w342ss="' + E(r.key) + '" value="' + E(W.shift.spots[r.key] != null ? W.shift.spots[r.key] : (r.spots || '')) + '" aria-label="' + E(r.name) + ': people needed" placeholder="0"></div></div>'; }).join('') + '</div>' : '') + errLine(),
        foot: '<button type="button" class="w342btn" data-w342w="skipshift"' + busy + '>Dates not set yet</button><button type="button" class="w342btn pri" data-w342w="addshift"' + busy + '>' + (W.busy ? 'Saving…' : 'Add the shift') + '</button>' }; }
    if (W.step === 'done') { var nr = liveRoles().length, nf = ((W.fd && W.fd.forms) || []).length, lf = ((W.fd && W.fd.forms) || []).filter(function (f) { return lower(f.status) === 'published'; }).length;
      return { title: ft + ' is set up for volunteers',
        body: '<div class="w342done">' + ic('check') + '<p>' + plural(nr, 'role') + ' · ' + plural(nf, 'form') + (nf ? ' (' + lf + ' live)' : '') + (W.shiftMade ? ' · a shift on <b>' + E(fmtDay(W.shift.date, 'long')) + '</b>' : ' · no shift yet') + '</p></div>'
          + '<ol class="w342next">' + (nf > lf ? '<li><b>Publish the draft form.</b> In the CRM, under Forms. Then share its link.</li>' : '<li><b>Share the form’s link.</b> Sign-ups file under this fundraiser by themselves.</li>')
          + '<li><b>See who applied.</b> On the fundraiser’s page, under Who applied.</li><li><b>Place people on a shift.</b> ' + (W.shiftMade ? 'Pick the shift and a role for each person.' : 'Add a shift once the dates are known.') + ' Nobody is messaged until you choose to.</li></ol>',
        foot: (W.shiftMade ? '<button type="button" class="w342btn" data-w342w="openev" data-v="' + E(W.shiftMade) + '">Open the shift</button>' : '') + '<button type="button" class="w342btn pri" data-w342w="openfund" data-v="' + E(W.fund) + '">Open the fundraiser</button>' }; }
    return { title: 'New event' };
  }
  async function rpc(fn, args) { var r = await db.rpc(fn, args); if (r && r.error) throw r.error; return r ? r.data : null; }
  async function fundReload() { W.fd = await rpc('wa309_fund_get', { p_id: Number(W.fund) }); }
  function readIn() {
    if (!SH.el || !W) return;
    Array.prototype.forEach.call(SH.el.querySelectorAll('[data-w342in]'), function (i) {
      var k = i.getAttribute('data-w342in'), v = i.value;
      if (k === 'date') W.date = v; else if (k === 'time') W.time = v; else if (k === 'place') W.place = v; else if (k === 'title') W.title = v; else if (k === 'kplace') W.kplace = v; else if (k === 'kshift') W.kshift = v;
      else if (k === 'fundnew') { W.fundNew = v; } else if (k === 'fundsel') { if (v) W.fund = v; }
      else if (k === 'rname') W.role.name = v; else if (k === 'rspots') W.role.spots = v.replace(/\D/g, ''); else if (k === 'rdesc') W.role.description = v;
      else if (k === 'sdate') W.shift.date = v; else if (k === 'stime') W.shift.time = v; else if (k === 'stitle') W.shift.title = v; else if (k === 'splace') W.shift.place = v;
    });
    Array.prototype.forEach.call(SH.el.querySelectorAll('[data-w342sp]'), function (i) { var n = Math.max(0, Math.min(60, parseInt(i.value, 10) || 0)); W.spots[i.getAttribute('data-w342sp')] = n; });
    Array.prototype.forEach.call(SH.el.querySelectorAll('[data-w342ss]'), function (i) { var n = parseInt(i.value, 10); W.shift.spots[i.getAttribute('data-w342ss')] = isFinite(n) && n > 0 ? Math.min(200, n) : 0; });
  }
  function setSpot(k, n) {
    n = Math.max(0, Math.min(k === 'cook' ? (S.cookMax || 15) : 60, n)); W.spots[k] = n;
    if (k === 'cook' && S.rule && !W.srvTouched) W.spots.server = Math.min(60, n * S.rule);
    if (k === 'server') W.srvTouched = S.rule ? n !== (Number(W.spots.cook) || 0) * S.rule : true;
  }
  async function wizAct(a, v, el) {
    if (!W) return;
    readIn(); W.err = '';
    try {
      if (a === 'back') { W.warn = ''; var list = W.kind === 'fundraiser' ? FUND : PROG, i = list.indexOf(W.step); W.step = i > 0 ? list[i - 1] : 'kind'; sheetPaint(true); return; }
      if (a === 'kind') { W.kind = v; W.step = v === 'fundraiser' ? 'fund' : 'format'; sheetPaint(true); if (v === 'fundraiser' && !W.fundList) { var d = await rpc('wa309_fund_get', { p_id: null }); if (!W) return; W.fundList = (d && d.events) || []; sheetPaint(false); } return; }
      if (a === 'fmt') { W.fmt = v; W.step = 'when'; sheetPaint(true); return; }
      if (a === 'inc' || a === 'dec') { setSpot(v, (Number(W.spots[v]) || 0) + (a === 'inc' ? 1 : -1)); sheetPaint(false); return; }
      if (a === 'rule') { W.srvTouched = false; W.spots.server = Math.min(60, (Number(W.spots.cook) || 0) * S.rule); sheetPaint(false); return; }
      if (a === 'fundpick') { W.fund = v; W.fundNew = ''; sheetPaint(false); return; }
      if (a === 'next') {
        if (W.step === 'when') { if (!W.date) { W.err = 'Pick a date.'; sheetPaint(false); return; } if (W.date < today()) { W.err = 'That date has passed.'; sheetPaint(false); return; } W.step = 'spots'; sheetPaint(true); return; }
        if (W.step === 'spots') { if (!spotsTotal()) { W.err = 'An event needs at least one volunteer.'; sheetPaint(false); return; } W.step = 'review'; sheetPaint(true); return; }
        if (W.step === 'fund') {
          var name = String(W.fundNew || '').trim();
          if (!name && !W.fund) { W.err = 'Pick a fundraiser, or name a new one.'; sheetPaint(false); return; }
          W.busy = true; sheetPaint(false);
          var o = await rpc('wa309_fund_open', name ? { p_id: null, p_title: name } : { p_id: Number(W.fund), p_title: null });
          if (!W) return; W.fund = o && o.id != null ? o.id : W.fund; W.fundNew = ''; W.fundList = null; await fundReload(); if (!W) return; W.busy = false; W.step = 'roles'; S.at = 0; sheetPaint(true); return;
        }
        if (W.step === 'roles') { if (String(W.role.name || '').trim()) { await wizAct('addrole'); if (!W || W.err) return; } W.step = 'forms'; sheetPaint(true); return; }
        if (W.step === 'forms') { W.step = 'shift'; if (!W.shift.title) W.shift.title = ''; sheetPaint(true); return; }
      }
      if (a === 'create') {
        W.busy = true; sheetPaint(false);
        var made = await rpc('wa342_event_create', { p: { event_date: W.date, start_time: W.time || '12:00', location: String(W.place || '').trim() || 'Montreal', title: String(W.title || '').trim() || null, format: W.fmt, kitchen_place: W.kplace || null, kitchen_shift: W.kshift || null, spot_counts: (function () { var sc = Object.assign({}, W.spots); if (S.rule > 0 && Number(sc.server) === (Number(sc.cook) || 0) * S.rule) delete sc.server; return sc; })(), allow_same_day: !!W.warn } });
        if (!W) return; W.busy = false;
        if (made && made.same_day && !made.id) { W.warn = 'There is already an event that day (' + made.same_day + ').'; sheetPaint(false); return; }
        W.made = made; W.warn = ''; W.step = 'done'; sheetPaint(true);
        try { WA_VOL_LOADED = false; } catch (e) { /* fine */ } S.sel = made && made.id; S.month = monthOf(W.date); await load(true); if (onEvents()) paintEvents(); return;
      }
      if (a === 'again') { var keepKind = W.kind; newEvent(); if (W) { W.kind = keepKind; } return; }
      if (a === 'openev') { var id = v; sheetClose(); location.hash = '#volunteering/e/' + id; return; }
      if (a === 'openfund') { var fid = v; sheetClose(); location.hash = '#volunteering/fundraisers/' + fid; return; }
      if (a === 'addrole') {
        if (!String(W.role.name || '').trim()) { W.err = 'Give the role a name.'; sheetPaint(false); return; }
        W.busy = true; sheetPaint(false);
        await rpc('wa309_role_save', { p: { fund_event_id: Number(W.fund), name: String(W.role.name).trim(), spots: W.role.spots === '' ? null : Number(W.role.spots), description: String(W.role.description || '').trim() || null } });
        if (!W) return; W.role = { name: '', spots: '', description: '' }; await fundReload(); if (!W) return; W.busy = false; sheetPaint(false); return;
      }
      if (a === 'mkform') {
        if (!liveRoles().length) { W.err = 'Add a role first: the form offers the roles as its choices.'; sheetPaint(false); return; }
        W.busy = true; sheetPaint(false); await rpc('wa309_form_create', { p_event: Number(W.fund), p_lang: v }); if (!W) return; W.formMade++; await fundReload(); if (!W) return; W.busy = false; sheetPaint(false); return;
      }
      if (a === 'linkform') { if (!v) return; W.busy = true; sheetPaint(false); await rpc('wa309_form_link', { p_form: Number(v), p_event: Number(W.fund) }); if (!W) return; await fundReload(); if (!W) return; W.busy = false; sheetPaint(false); return; }
      if (a === 'skipshift') { W.shiftMade = null; W.step = 'done'; sheetPaint(true); S.at = 0; return; }
      if (a === 'addshift') {
        if (!W.shift.date) { W.err = 'Pick the date, or choose “Dates not set yet”.'; sheetPaint(false); return; }
        var sc = {}; Object.keys(W.shift.spots).forEach(function (k) { if (W.shift.spots[k] > 0) sc[k] = W.shift.spots[k]; });
        W.busy = true; sheetPaint(false);
        var sh = await rpc('wa309_shift_save', { p: { fund_event_id: Number(W.fund), event_date: W.shift.date, start_time: W.shift.time || null, title: String(W.shift.title || '').trim() || 'Shift', location: String(W.shift.place || '').trim() || null, spot_counts: sc } });
        if (!W) return; W.shiftMade = sh && sh.id; await fundReload(); if (!W) return; W.busy = false; W.step = 'done'; sheetPaint(true);
        try { WA_VOL_LOADED = false; } catch (e) { /* fine */ } S.sel = W.shiftMade; S.month = monthOf(W.shift.date); await load(true); if (onEvents()) paintEvents(); return;
      }
    } catch (e) { if (!W) return; W.busy = false; W.err = msgOf(e) || 'That did not save. Try again.'; sheetPaint(false); }
  }

  /* ---------- each event: Signed up, to place ---------- */
  var TR = { all: false, last: null, busy: false };
  function curD() { try { return (WA_VOL_DETAIL && String(WA_VOL_DETAIL.id) === String(WA_VOL_EVENT)) ? WA_VOL_DETAIL : null; } catch (e) { return null; } }
  function curEv() { var e = null; try { (WA_VOL_EVENTS || []).forEach(function (x) { if (String(x.id) === String(WA_VOL_EVENT)) e = x; }); } catch (x) { /* fine */ } return e; }
  function countsD(D) { try { if (window.w191 && typeof w191.counts === 'function') { var c = w191.counts(D); if (c && c.placeRows) return c; } } catch (e) { /* fine */ } return tallyD(D); }
  function choicesOf(r) { var d = r.detail || {}; if (roleKey(r.role) === 'volunteer') return Array.isArray(d.role_choices) ? d.role_choices.map(roleKey).filter(function (k, i, a) { return k !== 'volunteer' && a.indexOf(k) === i; }) : []; return [roleKey(r.role)]; }
  function roomIn(t, k) { if (k === 'cook' && S.rule > 0 && t.cookMin) return (t.cookMax || 15) - (t.by.cook || 0);   /* every cook is welcome, up to the most one serving takes */
    return (t.T[k] || 0) - (t.byConf[k] || 0) - (t.byWait[k] || 0); }
  function trayHtml(D) {
    var ev = curEv(); if (!ev || lower(ev.status) === 'cancelled' || lower(ev.status) === 'completed') return '';
    var t = countsD(D), rows = (t.placeRows || []).slice().sort(function (a, b) { return String(a.created_at || '') < String(b.created_at || '') ? -1 : String(a.created_at || '') > String(b.created_at || '') ? 1 : Number(a.id) - Number(b.id); });
    var undo = TR.last && String(TR.last.ev) === String(D.id) ? '<div class="w342undo" role="status"><span>' + E(TR.last.say) + '</span><button type="button" class="w342lnk" data-w342undo="1">Undo</button></div>' : '';
    if (!rows.length) return undo ? '<div class="th"><h4>Signed up, to place</h4></div>' + undo + '<p class="w342quiet">Everyone who signed up has a place.</p>' : '';
    var free = Math.max(0, t.need - t.filled - t.waitIn), over = rows.length > free;
    var shown = TR.all ? rows : rows.slice(0, 6);
    var h = '<div class="th"><h4>Signed up, to place <span class="n">' + rows.length + '</span></h4><p>They signed up themselves and are waiting for a spot. Placing someone messages nobody: you ask them to confirm from Messages.</p></div>' + undo;
    if (over) h += '<div class="w342cheer in">' + ic('heart') + '<p><b>' + plural(rows.length, 'person', 'people') + ' raised a hand</b> for ' + (free ? plural(free, 'open spot') : 'an event that is full') + '. Place who fits, then offer the others another date so they stay involved.</p>'
      + (rows.length > 1 ? '<button type="button" class="w342btn sm" data-w342bulk="1">Offer another date…</button>' : '') + '</div>';
    var cooksAsk = rows.filter(function (r) { return choicesOf(r)[0] === 'cook'; }).length;
    if (cooksAsk && S.rule > 0 && t.cookMin) h += '<div class="w342cheer in">' + ic('heart') + '<p><b>' + plural(cooksAsk, 'person', 'people') + ' offered to cook.</b> ' + (roomIn(t, 'cook') > 0 ? 'Place ' + (cooksAsk === 1 ? 'them' : 'them all') + ' early (a serving takes up to ' + (t.cookMax || 15) + ' cooks): every cook opens ' + S.rule + ' more server spots, so more people can join. Encourage them to bring their dish and serve it.' : 'This serving has its ' + (t.cookMax || 15) + ' cooks. Offer them another date so they stay involved.') + '</p></div>';
    h += '<ul class="w342rows">' + shown.map(function (r) {
      var ch = choicesOf(r), when = r.created_at ? 'signed up ' + fmtDay(String(r.created_at).slice(0, 10), 'md') : '';
      var asked = ch.length ? 'asked for ' + ch.map(function (k) { return roleOne(k).toLowerCase(); }).join(' or ') : 'no role chosen';
      var full = ch.filter(function (k) { return (t.T[k] || 0) > 0 && roomIn(t, k) <= 0; });
      return '<li data-w342row="' + E(r.id) + '"><div class="who"><b>' + E(r.person_name || 'Unnamed') + '</b><small>' + E([asked, when].filter(Boolean).join(' · ')) + (full.length ? ' <em>' + E(full.map(function (k) { return roleMany(k); }).join(' and ') + (full.length === 1 ? ' are' : ' are') + ' full') + '</em>' : '') + '</small></div>'
        + '<div class="acts">' + ch.map(function (k, i) { return '<button type="button" class="w342btn sm' + (i === 0 && roomIn(t, k) > 0 ? ' pri' : '') + '" data-w342place="' + E(r.id) + '" data-role="' + E(k) + '"' + (TR.busy ? ' disabled' : '') + '>Place as ' + E(roleOne(k).toLowerCase()) + '</button>'; }).join('')
        + '<button type="button" class="w342btn sm" data-w342other="' + E(r.id) + '" aria-label="Other choices for ' + E(r.person_name || 'this person') + '"' + (TR.busy ? ' disabled' : '') + '>Other…</button></div></li>';
    }).join('') + '</ul>';
    if (rows.length > shown.length) h += '<button type="button" class="w342btn sm" data-w342all="1">Show all ' + rows.length + '</button>';
    return h;
  }
  function syncTray() {
    var team = document.querySelector('#w119.w191 #w191team > .b'); if (!team) return;
    var D = curD(); if (!D) return;
    var html = staff() ? trayHtml(D) : '';
    var el = document.getElementById('w342tray');
    if (!html) { if (el && el.parentNode) el.parentNode.removeChild(el); return; }
    if (!el) { el = document.createElement('section'); el.id = 'w342tray'; el.className = 'w342tray'; el.setAttribute('aria-label', 'Signed up, to place'); el.__h = ''; }
    var card = team.querySelector(':scope > .w191roster');
    if (el.parentNode !== team || (card && el.nextElementSibling !== card)) team.insertBefore(el, card || null);
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
  }
  function repaintEvent() {
    try { if (window.w119x && w119x.board) w119x.board(); } catch (e) { /* fine */ }
    try { if (window.w191 && w191.refresh) w191.refresh(); } catch (e) { /* fine */ }
    try { WA_VOL_LOADED = false; } catch (e) { /* fine */ }
    S.at = 0; syncTray();
  }
  function rowsById(ids) { var D = curD(); return ((D && D.roster) || []).filter(function (r) { return ids.indexOf(String(r.id)) >= 0; }); }
  async function place(ids, action, role, evTo) {
    var D = curD(); if (!D || TR.busy) return false;
    ids = ids.map(String); var rows = rowsById(ids); if (!rows.length) return false;
    var before = rows.map(function (r) { return { id: r.id, role: r.role, status: r.status, detail: Object.assign({}, r.detail || {}), event_id: r.event_id }; });
    TR.busy = true; syncTray();
    try {
      var res = await rpc('wa342_place', { p_rows: rows.map(function (r) { return Number(r.id); }), p_action: action, p_role: role || null, p_event: evTo != null ? Number(evTo) : null });
      var done = ((res && res.ids) || []).map(String);
      rows.forEach(function (r) {
        if (done.indexOf(String(r.id)) < 0) return;
        if (action === 'place') { if (role) r.role = role; r.detail = Object.assign({}, r.detail || {}, { placed_at: new Date().toISOString() }); }
        else if (action === 'decline') { r.status = 'Unavailable'; r.detail = Object.assign({}, r.detail || {}, { not_placed: true }); }
        else if (action === 'move') { D.roster.splice(D.roster.indexOf(r), 1); }
        else if (action === 'unplace') { var d2 = Object.assign({}, r.detail || {}); delete d2.placed_at; delete d2.placed_by; if (d2.not_placed) { r.status = 'TBD'; delete d2.not_placed; } r.detail = d2; }
      });
      var names = rows.length === 1 ? (rows[0].person_name || 'They') : rows.length + ' people';
      var to = evTo != null ? S.events.filter(function (e) { return String(e.id) === String(evTo); })[0] : null;
      TR.last = action === 'unplace' ? null : { ev: D.id, ids: done, action: action, before: before, to: evTo,
        say: action === 'place' ? names + (rows.length === 1 ? ' is' : ' are') + ' placed' + (role ? ' as ' + roleOne(role).toLowerCase() : '') + '.' : action === 'move' ? names + (rows.length === 1 ? ' is' : ' are') + ' on ' + (to ? fmtDay(to.event_date) : 'the other date') + ' now.' : names + (rows.length === 1 ? ' is' : ' are') + ' not placed this time.' };
      TR.busy = false; repaintEvent();
      if (res && res.skipped) say(plural(res.skipped, 'person', 'people') + ' still need a role chosen');
      return true;
    } catch (e) { TR.busy = false; syncTray(); say('Could not save: ' + msgOf(e)); return false; }
  }
  async function undoLast() {
    var L = TR.last, D = curD(); if (!L || !D || TR.busy) return;
    TR.busy = true; syncTray();
    try {
      if (L.action === 'move') { await rpc('wa342_place', { p_rows: L.ids.map(Number), p_action: 'move', p_role: null, p_event: Number(D.id) }); TR.last = null; TR.busy = false; try { WA_VOL_DETAIL = null; WA_VOL_LOADED = false; } catch (x) { /* fine */ } S.at = 0; if (typeof waVolRender === 'function') waVolRender(); return; }
      await rpc('wa342_place', { p_rows: L.ids.map(Number), p_action: 'unplace', p_role: null, p_event: null });
      L.before.forEach(function (b) { var r = D.roster.filter(function (x) { return String(x.id) === String(b.id); })[0]; if (r) { r.role = b.role; r.status = b.status; r.detail = b.detail; } });
      TR.last = null; TR.busy = false; repaintEvent();
    } catch (e) { TR.busy = false; syncTray(); say('Could not undo: ' + msgOf(e)); }
  }
  /* the Other... sheet: a role, another date, or not this time; then (for the last two) the email a person reviews and sends */
  var PS = null;
  function otherDates() {
    var t = today(), cur = curEv();
    return S.events.filter(function (e) { return e.kind === 'service' && lower(e.status) === 'planned' && String(e.event_date) >= t && (!cur || String(e.id) !== String(cur.id)); })
      .sort(function (a, b) { return String(a.event_date) < String(b.event_date) ? -1 : 1; }).slice(0, 8).map(function (e) { var x = tallyOf(e); return { e: e, open: Math.max(0, x.need - x.filled - x.waitIn), place: x.place }; });
  }
  function placeSheet(ids) {
    var rows = rowsById(ids.map(String)); if (!rows.length) return;
    PS = { ids: rows.map(function (r) { return String(r.id); }), people: rows.map(function (r) { return r.person_id; }).filter(function (x) { return x != null; }), names: rows.map(function (r) { return r.person_name || 'Unnamed'; }), mode: 'menu', busy: false, err: '', msg: '', pre: null, to: null, action: '', sent: false, loading: !S.loaded };
    sheetOpen(placeView, function () { PS = null; });
    load(false).then(function () { if (PS) { PS.loading = false; sheetPaint(false); } });
  }
  function placeView() {
    if (!PS) return {};
    var D = curD(), t = D ? countsD(D) : null, one = PS.ids.length === 1, who = one ? PS.names[0] : PS.ids.length + ' people', ev = curEv(), dis = PS.busy ? ' disabled' : '';
    var err = PS.err ? '<p class="w342err" role="alert">' + E(PS.err) + '</p>' : '';
    if (PS.mode === 'menu') {
      var roles = t ? t.roles.filter(function (k) { return (t.T[k] || 0) > 0; }) : [];
      var dates = otherDates();
      return { title: one ? 'Place ' + who : 'Place ' + who, sub: one ? '' : E(PS.names.slice(0, 6).join(', ')) + (PS.names.length > 6 ? ' and ' + (PS.names.length - 6) + ' more' : ''),
        body: (one ? '<p class="w342lbl">In a role on this event</p><div class="w342opts">' + roles.map(function (k) { var room = roomIn(t, k); return '<button type="button" class="w342opt" data-w342ps="role" data-v="' + E(k) + '"' + dis + '><b>' + E(roleOne(k, evFull(ev || {}))) + '</b><span>' + (t.byConf[k] || 0) + ' of ' + (t.T[k] || 0) + ' confirmed' + ((t.byWait[k] || 0) ? ', ' + t.byWait[k] + ' waiting' : '') + (room <= 0 ? ' · full' : '') + '</span></button>'; }).join('') + '</div>' : '')
          + '<p class="w342lbl">On another date</p>' + (PS.loading ? '<p class="w342quiet" role="status">Loading the dates…</p>' : dates.length ? '<div class="w342opts">' + dates.map(function (x) { return '<button type="button" class="w342opt" data-w342ps="date" data-v="' + E(x.e.id) + '"' + dis + '><b>' + E(fmtDay(x.e.event_date)) + '</b><span>' + (x.open ? plural(x.open, 'spot') + ' open' : 'full') + (x.place ? ' · ' + x.place + ' to place' : '') + '</span></button>'; }).join('') + '</div>' : '<p class="w342quiet">No other date is planned yet. Add one with New event.</p>')
          + '<p class="w342lbl">Or</p><div class="w342opts"><button type="button" class="w342opt warn" data-w342ps="decline"' + dis + '><b>Not this time</b><span>' + (one ? 'They stay in Volunteers for the next dates.' : 'They stay in Volunteers for the next dates.') + '</span></button></div>' + err };
    }
    if (PS.mode === 'tell') {
      var noMail = PS.ids.length - PS.people.length;
      return { title: 'Tell ' + (one ? who.split(' ')[0] : 'them') + '?', sub: (PS.action === 'move' ? E(who) + (one ? ' is' : ' are') + ' on <b>' + E(PS.to ? fmtDay(PS.to.event_date, 'long') : 'the other date') + '</b> now. ' : E(who) + (one ? ' is' : ' are') + ' not placed this time. ') + 'Nothing has been sent. Review the email, then send it, or skip.',
        body: '<label class="w342fld"><span>The email</span><textarea id="w342msg" data-w342in="psmsg" rows="7" maxlength="1200">' + E(PS.msg) + '</textarea><small>{{first_name}} becomes each person’s first name.</small></label>'
          + (PS.pre ? '<div class="w342pre"><b>Goes to ' + plural(PS.pre.recipients || 0, 'person', 'people') + '</b>' + (PS.pre.no_email ? ' · ' + PS.pre.no_email + ' without an email' : '') + (noMail ? ' · ' + noMail + ' not matched to a volunteer record' : '') + ((PS.pre.previews || [])[0] ? '<p>' + E(PS.pre.previews[0].text) + '</p>' : '') + '</div>' : '') + err,
        foot: '<button type="button" class="w342btn" data-w342ps="skip"' + dis + '>Skip</button>' + (PS.people.length ? (PS.pre && PS.pre.recipients ? '<button type="button" class="w342btn pri" data-w342ps="send"' + dis + '>' + (PS.busy ? 'Sending…' : 'Send the email') + '</button>' : '<button type="button" class="w342btn pri" data-w342ps="preview"' + dis + '>' + (PS.busy ? 'Checking…' : 'Review who gets it') + '</button>') : '') };
    }
    return { title: 'Done' };
  }
  async function placeAct(a, v) {
    if (!PS) return; PS.err = '';
    var ta = SH.el && SH.el.querySelector('#w342msg'); if (ta) PS.msg = ta.value;
    var ev = curEv();
    try {
      if (a === 'role') { var ids = PS.ids.slice(); sheetClose(); await place(ids, 'place', v); return; }
      if (a === 'date' || a === 'decline') {
        PS.busy = true; sheetPaint(false);
        var to = a === 'date' ? S.events.filter(function (e) { return String(e.id) === String(v); })[0] : null;
        var ok = await place(PS.ids.slice(), a === 'date' ? 'move' : 'decline', null, a === 'date' ? v : null);
        if (!PS) return; PS.busy = false;
        if (!ok) { PS.err = 'That did not save. Try again.'; sheetPaint(false); return; }
        PS.action = a === 'date' ? 'move' : 'decline'; PS.to = to; PS.mode = 'tell'; PS.pre = null;
        var d0 = ev ? fmtDay(ev.event_date, 'long') : 'the serving';
        PS.msg = a === 'date'
          ? 'Hi {{first_name}}, thank you for signing up to volunteer with Welfare Avenue on ' + d0 + '! That day filled up quickly, so we saved you a place on ' + (to ? fmtDay(to.event_date, 'long') : 'our next date') + ' instead. We will write to you closer to the day with the details. If that date does not work for you, just reply to this email and we will find another one.'
          : 'Hi {{first_name}}, thank you for signing up to volunteer with Welfare Avenue on ' + d0 + '! Every spot is taken for that day. We would love to have you at one of our next servings, and we will write to you as soon as the next dates open.';
        sheetPaint(true); return;
      }
      if (a === 'skip') { sheetClose(); return; }
      if (a === 'preview' || a === 'send') {
        if (String(PS.msg || '').trim().length < 5) { PS.err = 'Write the message first.'; sheetPaint(false); return; }
        PS.busy = true; sheetPaint(false);
        var evId = PS.action === 'move' && PS.to ? Number(PS.to.id) : (ev ? Number(ev.id) : null);
        var r = await rpc('wa340_message_people', { p_people: PS.people.map(Number), p_message: PS.msg, p_event: evId, p_event_date: PS.to ? fmtDay(PS.to.event_date, 'long') : (ev ? fmtDay(ev.event_date, 'long') : ''), p_role: null, p_dry: a === 'preview' });
        if (!PS) return; PS.busy = false;
        if (a === 'preview') { PS.pre = r || { recipients: 0 }; if (!PS.pre.recipients) PS.err = 'Nobody here has an email on file.'; sheetPaint(false); return; }
        var n = (r && r.recipients) || 0; sheetClose(); say(plural(n, 'email') + ' on ' + (n === 1 ? 'its' : 'their') + ' way'); return;
      }
    } catch (e) { if (!PS) return; PS.busy = false; PS.err = msgOf(e) || 'That did not work. Try again.'; sheetPaint(false); }
  }

  /* ---------- community leads: conversations (two people) and the count (one; a server can take it) ---------- */
  function clRows(D) { return ((D && D.roster) || []).filter(function (r) { return !isOut(r) && !toPlace(r) && roleKey(r.role) === 'community_debrief'; }); }
  function lentRow(D) { return ((D && D.roster) || []).filter(function (r) { return !isOut(r) && roleKey(r.role) === 'server' && (r.detail || {}).cl_job === 'count'; })[0] || null; }
  function cardBits(r, D) {
    if (!r || isOut(r)) return '';
    var k = roleKey(r.role), job = (r.detail || {}).cl_job || '';
    if (k === 'community_debrief') {
      if (!staff()) return job ? '<span class="w342jobs"><span class="w342chip">' + (job === 'count' ? 'The count' : 'Conversations') + '</span></span>' : '';
      return '<span class="w342jobs" role="group" aria-label="Job at the serving"><button type="button" data-w342job="' + E(r.id) + '" data-v="talk" aria-pressed="' + (job === 'talk' ? 'true' : 'false') + '" title="Talks with people to gather what they tell us">Conversations</button><button type="button" data-w342job="' + E(r.id) + '" data-v="count" aria-pressed="' + (job === 'count' ? 'true' : 'false') + '" title="Enters each person served, one by one">The count</button></span>';
    }
    if (k === 'cook') {
      var sv = !!(r.detail || {}).serves_too;
      if (!staff()) return sv ? '<span class="w342jobs"><span class="w342chip">Also serving</span></span>' : '';
      return '<span class="w342jobs" role="group" aria-label="On the day"><button type="button" data-w342serve="' + E(r.id) + '" aria-pressed="' + (sv ? 'true' : 'false') + '" title="They bring their dish and stay to serve it: they count as a server too">' + (sv ? '✓ Brings it and serves' : 'Brings it and serves?') + '</button></span>';
    }
    if (k === 'server' && job === 'count') return '<span class="w342lent">Keeps the count for the community leads' + (staff() ? '<button type="button" data-w342job="' + E(r.id) + '" data-v="" aria-label="Take the count back from ' + E(r.person_name || 'them') + '">×</button>' : '') + '</span>';
    return '';
  }
  function colNote(role, D) {
    if (!D) return '';
    if (roleKey(role) === 'cook' || roleKey(role) === 'server') {
      var c = countsD(D); if (!c || !c.cookMin || !(S.rule > 0)) return '';
      if (roleKey(role) === 'cook') return '<div class="w342cl"><span><b>Minimum</b> ' + c.cookMin + ', up to ' + (c.cookMax || 15) + '</span><span>Every cook opens ' + S.rule + ' server spots</span>'
        + (c.pickMax ? '<span><b>Food picked up</b> ' + (c.pickups >= c.pickMax ? '<em>' + c.pickups + ' of ' + c.pickMax + ', full</em>' : c.pickups + ' of ' + c.pickMax) + '</span>' : '') + ((c.by.cook || 0) >= (c.cookMax || 15) ? '<small>This serving has all the cooks it takes.</small>' : '') + '</div>';
      var names = (c.serving || []).map(function (r) { return String(r.person_name || 'A cook').split(' ')[0]; });
      return '<div class="w342cl"><span>' + S.rule + ' for each of the ' + plural(c.T.cook || 0, 'cook') + '</span>' + (names.length ? '<span><b>Also serving</b> ' + E(names.join(', ')) + ' (cook' + (names.length === 1 ? '' : 's') + ')</span>' : '') + '</div>';
    }
    if (roleKey(role) !== 'community_debrief') return '';
    var rows = clRows(D), talk = rows.filter(function (r) { return (r.detail || {}).cl_job === 'talk'; }).length, cnt = rows.filter(function (r) { return (r.detail || {}).cl_job === 'count'; })[0] || null, lent = lentRow(D);
    var servers = (D.roster || []).some(function (r) { return !isOut(r) && !toPlace(r) && roleKey(r.role) === 'server'; });
    var who = cnt ? (cnt.person_name || 'a community lead') : lent ? (lent.person_name || 'a server') + ' (server)' : '';
    return '<div class="w342cl"><span><b>Conversations</b> ' + talk + ' of 2</span><span><b>The count</b> ' + (who ? E(who) : '<em>nobody yet</em>') + '</span>'
      + (!who && staff() && servers ? '<button type="button" class="w342lnk" data-w342lend="1">Give the count to a server</button>' : '')
      + (rows.length > 1 && !talk && !cnt && !lent ? '<small>Set who talks with people and who keeps the count, so they know before the day.</small>' : '') + '</div>';
  }
  async function setJob(id, job) {
    var D = curD(); if (!D) return; var r = D.roster.filter(function (x) { return String(x.id) === String(id); })[0]; if (!r) return;
    var was = (r.detail || {}).cl_job || ''; if (job && was === job) job = '';
    var d2 = Object.assign({}, r.detail || {}); if (job) d2.cl_job = job; else delete d2.cl_job; var keep = r.detail; r.detail = d2; repaintEvent();
    try { await rpc('wa342_cl_job', { p_roster: Number(id), p_job: job || null }); }
    catch (e) { r.detail = keep; repaintEvent(); say('Could not save: ' + msgOf(e)); }
  }
  /* no more pick-ups once the drivers' limit is reached (a cook already on pick-up keeps theirs) */
  function pickFull() { var D = curD(); if (!D || !S.pickMax) return false; var c = countsD(D); return !!c && c.pickups >= S.pickMax; }
  async function setServe(id) {
    var D = curD(); if (!D) return; var r = D.roster.filter(function (x) { return String(x.id) === String(id); })[0]; if (!r) return;
    var on = !(r.detail || {}).serves_too, keep = r.detail, d2 = Object.assign({}, r.detail || {}); if (on) d2.serves_too = true; else delete d2.serves_too; r.detail = d2; repaintEvent();
    try { await rpc('wa342_cook_serves', { p_roster: Number(id), p_on: on }); say(on ? (r.person_name || 'This cook') + ' also counts as a server' : 'Back to cooking only'); }
    catch (e) { r.detail = keep; repaintEvent(); say('Could not save: ' + msgOf(e)); }
  }
  function lendSheet() {
    var D = curD(); if (!D) return;
    var servers = D.roster.filter(function (r) { return !isOut(r) && !toPlace(r) && roleKey(r.role) === 'server'; }).sort(function (a, b) { return (isConf(b) ? 1 : 0) - (isConf(a) ? 1 : 0); });
    sheetOpen(function () {
      return { title: 'Who keeps the count?', sub: 'The count is the one-by-one entry of each person served. With no community lead free for it, a server can take it.',
        body: servers.length ? '<div class="w342opts">' + servers.map(function (r) { return '<button type="button" class="w342opt" data-w342lendto="' + E(r.id) + '"><b>' + E(r.person_name || 'Unnamed') + '</b><span>' + (isConf(r) ? 'Confirmed' : 'Waiting to confirm') + '</span></button>'; }).join('') + '</div>' : '<p class="w342quiet">No server is on this event yet.</p>' };
    });
  }

  /* ---------- the menu's places (the rail on a computer, the row of links on a phone) ---------- */
  var PLACES = [['', 'Events', '#volunteering'], ['people', 'Volunteers', '#volunteering/people'], ['phone', 'Messages', '#volunteering/phone'], ['fundraisers', 'Fundraisers', '#volunteering/fundraisers'], ['recipes', 'Recipes', '#volunteering/recipes'], ['inventory', 'Inventory', '#volunteering/inventory'], ['sop', 'The SOP', '#volunteering/sop'], ['setup', 'Setup', '#volunteering/setup']];
  function placeOf(s) { s = String(s || ''); if (s === 'applicants' || s === 'signoffs' || s === 'people') return 'people'; if (s === 'phone' || s === 'messages') return 'phone'; if (s === 'calendar' || s === 'e' || s === '') return ''; return PLACES.some(function (p) { return p[0] === s; }) ? s : ''; }
  function chips() { return '<nav class="w342chips" aria-label="Volunteer Manager">' + PLACES.map(function (p) { return '<a href="' + p[2] + '"' + (p[0] === '' ? ' class="on" aria-current="page"' : '') + '>' + E(p[1]) + '</a>'; }).join('') + '</nav>'; }

  /* ---------- wiring ---------- */
  function tabTo(k) { var b = document.querySelector('#w307tabs [data-w307tab="' + k + '"]'); if (b && b.getAttribute('aria-selected') !== 'true') b.click(); return !!b; }
  function pickDay(iso) {
    var evs = S.events.filter(function (e) { return e.event_date === iso; }); if (!evs.length) return;
    var live = evs.filter(function (e) { return lower(e.status) !== 'cancelled'; });
    var i = evs.map(function (e) { return String(e.id); }).indexOf(String(S.sel));
    if (i >= 0 && evs.length === 1) { location.hash = '#volunteering/e/' + evs[0].id; return; }
    var nx = i >= 0 ? evs[(i + 1) % evs.length] : (live[0] || evs[0]);
    S.sel = nx.id; paintEvents();
    try { if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) { var h = document.getElementById('w342hero'); if (h) h.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } } catch (e) { /* fine */ }
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return; var x;
    if (SH.el) {
      if ((x = t.closest('#w342sheet [data-w342x]'))) { e.preventDefault(); sheetClose(); return; }
      if ((x = t.closest('#w342sheet [data-w342w]'))) { e.preventDefault(); wizAct(x.getAttribute('data-w342w'), x.getAttribute('data-v'), x); return; }
      if ((x = t.closest('#w342sheet [data-w342ps]'))) { e.preventDefault(); placeAct(x.getAttribute('data-w342ps'), x.getAttribute('data-v')); return; }
      if ((x = t.closest('#w342sheet [data-w342lendto]'))) { e.preventDefault(); var lid = x.getAttribute('data-w342lendto'); sheetClose(); setJob(lid, 'count'); return; }
      return;
    }
    /* the event's More menu: all of it in view when it opens; a press anywhere else closes it */
    if (t.closest('#w191head [data-w191go="menu"]')) setTimeout(function () { var m = document.querySelector('#w191head .more.open .menu'); if (!m) return; var r = m.getBoundingClientRect(), vh = window.innerHeight || 0; if (r.bottom > vh - 8) { try { window.scrollBy({ top: Math.min(r.bottom - vh + 16, r.top - 70), behavior: 'smooth' }); } catch (e5) { window.scrollBy(0, r.bottom - vh + 16); } } }, 30);
    else if (!t.closest('#w191head .more')) Array.prototype.forEach.call(document.querySelectorAll('#w191head .more.open'), function (m) { m.classList.remove('open'); });
    if ((x = t.closest('[data-w342new]'))) { e.preventDefault(); newEvent(); return; }
    if ((x = t.closest('#w342root [data-w342day]'))) { e.preventDefault(); pickDay(x.getAttribute('data-w342day')); return; }
    if ((x = t.closest('#w342root [data-w342m]'))) {
      e.preventDefault(); var d = Number(x.getAttribute('data-w342m')), m = S.month || monthOf(today());
      if (!d) { S.month = monthOf(today()); S.sel = null; } else { var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + d; var nd = new Date(Date.UTC(y, mo, 1, 12)); S.month = nd.getUTCFullYear() + '-' + pad(nd.getUTCMonth() + 1); }
      paintEvents(); var again = document.querySelector('#w342root [data-w342m="' + x.getAttribute('data-w342m') + '"]'); if (again) { try { again.focus({ preventScroll: true }); } catch (e2) { /* fine */ } } return;
    }
    if ((x = t.closest('#w342root [data-w342f]'))) { e.preventDefault(); S.filter = x.getAttribute('data-w342f'); paintEvents(); return; }
    if ((x = t.closest('#w342root [data-w342past]'))) { e.preventDefault(); S.pastOpen = !S.pastOpen; paintEvents(); var pb = document.querySelector('#w342root [data-w342past]'); if (pb) { try { pb.focus({ preventScroll: true }); } catch (e3) { /* fine */ } } return; }
    if ((x = t.closest('#w342root [data-w342more]'))) { e.preventDefault(); S.pastN += 30; paintEvents(); return; }
    if ((x = t.closest('#w342tray [data-w342place]'))) { e.preventDefault(); place([x.getAttribute('data-w342place')], 'place', x.getAttribute('data-role')); return; }
    if ((x = t.closest('#w342tray [data-w342other]'))) { e.preventDefault(); placeSheet([x.getAttribute('data-w342other')]); return; }
    if ((x = t.closest('#w342tray [data-w342bulk]'))) { e.preventDefault(); var D = curD(); if (D) placeSheet(countsD(D).placeRows.map(function (r) { return String(r.id); })); return; }
    if ((x = t.closest('#w342tray [data-w342all]'))) { e.preventDefault(); TR.all = true; syncTray(); return; }
    if ((x = t.closest('#w342tray [data-w342undo]'))) { e.preventDefault(); undoLast(); return; }
    if ((x = t.closest('#w119 [data-w342job]'))) { e.preventDefault(); e.stopPropagation(); setJob(x.getAttribute('data-w342job'), x.getAttribute('data-v')); return; }
    if ((x = t.closest('#w119 [data-w342serve]'))) { e.preventDefault(); e.stopPropagation(); setServe(x.getAttribute('data-w342serve')); return; }
    if ((x = t.closest('#w119 [data-w342lend]'))) { e.preventDefault(); lendSheet(); return; }
    if ((x = t.closest('#w119 [data-w342tab]'))) { e.preventDefault(); tabTo(x.getAttribute('data-w342tab')); return; }
    if ((x = t.closest('#w119 [data-w342msg]'))) { e.preventDefault(); try { if (typeof waTxtModal === 'function') waTxtModal(); } catch (e4) { /* fine */ } return; }
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !SH.el || !t.closest('#w342sheet') || !W) return;
    var k = t.getAttribute('data-w342in');
    if (k === 'linkform') { wizAct('linkform', t.value); return; }
    if (k === 'fundsel') { W.fund = t.value || null; if (t.value) W.fundNew = ''; sheetPaint(false); return; }
    if (k === 'date' || k === 'sdate') { readIn(); sheetPaint(false); return; }
    if (t.hasAttribute('data-w342sp')) { var key = t.getAttribute('data-w342sp'); setSpot(key, parseInt(t.value, 10) || 0); sheetPaint(false); return; }
  }, true);
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    /* the rule in the older spot-count screens too (an event's Spot counts, Setup's usual counts): servers follow the cooks */
    var at = t.hasAttribute && (t.hasAttribute('data-w232sp') ? 'data-w232sp' : t.hasAttribute('data-w259sp') ? 'data-w259sp' : '');
    if (at && t.getAttribute(at) === 'cook' && S.rule > 0) { var sv = document.querySelector('[' + at + '="server"]'), n = Math.round(Number(t.value)); if (sv && t.value !== '' && isFinite(n) && n >= 0) sv.value = Math.min(60, n * S.rule); return; }
    if (!SH.el || !W || !t.closest('#w342sheet')) return;
    if (t.getAttribute('data-w342in') === 'fundnew' && t.value && W.fund) { W.fund = null; Array.prototype.forEach.call(SH.el.querySelectorAll('.w342pick.on'), function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); var sel = SH.el.querySelector('[data-w342in="fundsel"]'); if (sel) sel.value = ''; }
  }, true);

  function arm() {
    if (typeof waVolRender !== 'function' || waVolRender.__w342) return typeof waVolRender === 'function';
    var prev = waVolRender;
    var mine = async function () { if (staff() && onEvents()) return renderEvents(false); var r = document.getElementById('w342root'); if (r && r.parentNode) r.parentNode.removeChild(r); return prev.apply(this, arguments); };
    Object.keys(prev).forEach(function (k) { try { mine[k] = prev[k]; } catch (e) { /* fine */ } });
    mine.__w342 = true; waVolRender = mine;
    /* the app's own New event (the masthead on a computer, the app bar on a phone) */
    try {
      var A = window.WA_APP;
      if (A && typeof A.act === 'function' && !A.act.__w342) { /* handled in the source (act) */ }
    } catch (e) { /* fine */ }
    return true;
  }
  if (!arm()) { setTimeout(arm, 600); setTimeout(arm, 2500); }
  window.addEventListener('hashchange', function () { if (SH.el) sheetClose(true); TR.all = false; if (!/^#volunteering\/e\//.test(String(location.hash || ''))) TR.last = null; });
  /* one observer on the Volunteer Manager: the sign-up list keeps its place above the board as the older waves repaint */
  var raf = 0;
  function soon() { if (raf) return; raf = (window.requestAnimationFrame || setTimeout)(function () { raf = 0; try {
    if (typeof WA_VOL_VIEW !== 'undefined' && WA_VOL_VIEW === 'event') syncTray();
    /* an older wave painting its list late (a timer, a reply from the database) does not land under the Events page */
    else if (staff() && onEvents()) { var sec = document.getElementById('volunteering'), r = document.getElementById('w342root'); if (sec && r && Array.prototype.some.call(sec.children, function (c) { return c !== r && !c.classList.contains('w118mast'); })) paintEvents(); }
  } catch (e) { /* fine */ } }); }
  /* which automatic messages are on for Montreal (wave297's switches): '' when a person sends every round */
  function auto() { try { var c = window.w297 && w297.state().cfg, s = c && c.montreal; return s ? (s.emails && s.texts ? 'both' : s.emails ? 'email' : s.texts ? 'text' : '') : ''; } catch (e) { return ''; } }
  function watch() { var sec = document.getElementById('volunteering'); if (!sec || sec.__w342) return !!sec; sec.__w342 = true; try { new MutationObserver(soon).observe(sec, { childList: true, subtree: true }); } catch (e) { /* fine */ } return true; }
  if (!watch()) { setTimeout(watch, 800); setTimeout(watch, 3000); }
  /* the guides (the usual spots) for every screen that counts, as soon as someone opens the Volunteer Manager */
  async function ensureGuides() {
    if (S.guides && S.guides.length) return S.guides;
    try { var r = await db.from('volunteer_role_guides').select('role,target,label_en'); if (r && r.data && r.data.length) S.guides = r.data; var c = await db.from('app_config').select('key,value').in('key', ['vol_servers_per_cook', 'vol_cooks_max', 'vol_pickups_max']); ((c && c.data) || []).forEach(function (c) { var n = Number(c.value); if (!isFinite(n) || n < 0) return; if (c.key === 'vol_servers_per_cook') S.rule = n; if (c.key === 'vol_cooks_max' && n > 0) S.cookMax = n; if (c.key === 'vol_pickups_max') S.pickMax = n; }); } catch (e) { /* the fallback counts */ }
    return S.guides;
  }
  document.addEventListener('wa153app', function (e) { try { if (e.detail && e.detail.app === 'volunteer' && staff()) ensureGuides().then(function () { if (typeof WA_VOL_VIEW !== 'undefined' && WA_VOL_VIEW === 'event') repaintEvent(); }); } catch (x) { /* fine */ } });

  /* ---------- the page tour (How this page works; train to unlock): the new page, in the same training ---------- */
  function tour() {
    try {
      var TT = window.w122 && window.w122.tours, vs = TT && TT.volunteering && TT.volunteering.steps; if (!vs || vs.__w342) return !!(vs && vs.__w342);
      var open = function () { var a = document.querySelector('#w342hero') || document.querySelector('#w342root [data-w342ev]'); if (a) location.hash = '#volunteering/e/' + a.getAttribute('data-w342ev'); };
      var out = [
        { s: '#volunteering > .w118mast', t: 'Events', p: 'Every Montreal event that needs volunteers: the programs (the servings) and the fundraisers. The menu on the left has Volunteers and Messages, and under More: Fundraisers, Recipes, Inventory, The SOP and Setup.' },
        { s: '#volunteering .w118mast .w197pact || #w153bar [data-w153act="newevent"]', t: 'New event', p: 'Plan a program (kitchen-based or cooked from home) or set up a fundraiser for volunteers, step by step. A program gets its checklist and its spots; a fundraiser gets its roles, its sign-up forms and its shifts.', opt: 1 },
        { s: '#w342cal', t: 'The calendar', p: 'The month, with a dot on every day that has an event. Pick a day to see its event next to it; pick it again to open it.', opt: 1 },
        { s: '#w342hero', t: 'The next event', p: 'How many people are confirmed out of how many the event needs, role by role. Gold is people still waiting to confirm. “Signed up, to place” are people who put their hand up and wait for a spot.', opt: 1 },
        { s: '#w342up', t: 'Upcoming', p: 'Every event after the next one. Past events fold away at the bottom of the page.', opt: 1 },
        { s: '#w191head', t: 'An event', p: 'Its date, its place and the one count that matters: confirmed out of needed. Find volunteers looks through the CRM; Message the team writes to the people on this event; More holds everything else.', opt: 1, go: open },
        { s: '#w307tabs', t: 'Five tabs', p: 'Team: who is coming. To do: the checklist, stage by stage. Messages: each round, reviewed and sent by a person. Plan: the meals, the itinerary and the drivers’ run. Wrap up: the survey and closing the event.', opt: 1 },
        { s: '#w342tray', t: 'Signed up, to place', p: 'People who signed up for this event themselves. Place them in a role, offer another date, or tell them not this time. Nobody is messaged until you choose to.', opt: 1 },
        { s: '#w191team .board', t: 'The team', p: 'One column per role with confirmed out of needed. Add people with + Add, change a status, or move someone to another role. People who can’t make it fold away under each role.', opt: 1 }
      ];
      vs.length = 0; out.forEach(function (x) { vs.push(x); }); vs.__w191 = true; vs.__w342 = true; return true;
    } catch (e) { return false; }
  }
  [1500, 4000, 9000].forEach(function (ms) { setTimeout(tour, ms); });

  /* ---------- the look: the Hub's tokens and faces, Toronto's shapes, Montreal's green ----------
     Every selector sits under this wave's own ids. Motion only where something is touched or opens: a press (scale .97,
     160 ms), the sheet (the drawer curve, in and out along the same path), the bars filling once. Hover only with a real
     pointer; reduced motion keeps the fades and drops the movement. Inputs are 16 px on a phone, so the page never zooms. */
  var TAP = '-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-user-select:none;user-select:none;';
  var R = '#w342root', SHT = '#w342sheet', TY = '#w342tray';
  var css = ''
    + R + ',' + SHT + ',' + TY + '{--v-ac:' + GREEN + ';--v-ink:var(--wa-text,#1F201E);--v-card:var(--wa-card,' + CREAM + ');--v-mut:rgba(31,32,30,.72);--v-line:rgba(16,63,57,.12);--v-line2:rgba(16,63,57,.24);--v-surf:rgba(16,63,57,.05);--v-surf2:rgba(16,63,57,.09);--v-gold:' + GOLD + ';--v-goldt:rgba(220,165,39,.24);--v-flag:' + FLAG + ';--v-flagt:rgba(179,64,47,.11);--v-fund:' + PURPLE + ';}'
    + R + '{display:block;max-width:1180px;color:var(--v-ink);font:400 15px/1.45 ' + BODY + ';}'
    + R + ' a:focus-visible,' + R + ' button:focus-visible,' + SHT + ' button:focus-visible,' + SHT + ' input:focus-visible,' + SHT + ' select:focus-visible,' + SHT + ' textarea:focus-visible,' + TY + ' button:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;box-shadow:none;}'
    + R + ' .w342blk{margin:0 0 30px;min-width:0;}'
    + R + ' .w342kick{margin:0 0 10px;font:700 14px/1.2 ' + BODY + ';letter-spacing:.02em;color:' + TEAL + ';}'
    + R + ' .w342h2{margin:0;font:500 30px/1.05 ' + HEAD + ';letter-spacing:0;color:' + GREEN + ';}'
    + R + ' .w342hrow{display:flex;align-items:center;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;margin:0 0 12px;}'
    + R + ' .w342quiet,' + SHT + ' .w342quiet,' + TY + ' .w342quiet{margin:6px 0;font-size:14px;color:var(--v-mut);}'
    + R + ' .w342err,' + SHT + ' .w342err{margin:10px 0 0;font-size:14px;font-weight:600;color:var(--v-flag);}'
    + SHT + ' .w342warn{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:var(--v-goldt);font-size:14px;font-weight:600;color:var(--v-ink);}'
    /* buttons, chips */
    + '.w342btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 16px;border-radius:10px;border:1px solid var(--v-line2,rgba(16,63,57,.24));background:var(--v-card,' + CREAM + ');color:' + GREEN + ';font:600 14px/1.1 ' + BODY + ';text-decoration:none;white-space:nowrap;cursor:pointer;' + TAP + 'transition:transform 160ms ' + OUT + ',background-color 200ms ' + OUT + ',border-color 200ms ' + OUT + ';}'
    + '.w342btn.pri{background:' + GREEN + ';border-color:' + GREEN + ';color:' + CREAM + ';}.w342btn.sm{min-height:34px;padding:0 12px;font-size:13px;}.w342btn:disabled{opacity:.5;cursor:not-allowed;}.w342btn svg{width:18px;height:18px;flex:0 0 18px;}'
    + '.w342btn:active:not(:disabled),.w342ib:active,.w342pick:active,.w342opt:active:not(:disabled){transform:scale(.97);}'
    + '.w342ib{display:inline-grid;place-items:center;width:40px;height:40px;flex:0 0 40px;padding:0;border:0;border-radius:10px;background:none;color:' + GREEN + ';font:600 20px/1 ' + BODY + ';cursor:pointer;' + TAP + 'transition:transform 160ms ' + OUT + ',background-color 200ms ' + OUT + ';}.w342ib svg{width:20px;height:20px;}.w342ib.fw svg{transform:scaleX(-1);}'
    + '.w342lnk{display:inline;padding:0;border:0;background:none;font:inherit;font-weight:700;color:' + GREEN + ';text-decoration:underline;text-underline-offset:2px;cursor:pointer;' + TAP + '}'
    + '.w342chip{display:inline-flex;align-items:center;gap:5px;min-height:24px;padding:2px 9px;border-radius:999px;background:var(--v-surf2,rgba(16,63,57,.09));color:' + GREEN + ';font:600 12px/1.2 ' + BODY + ';font-style:normal;white-space:nowrap;}'
    + '.w342chip.gold{background:' + GOLD + ';color:' + GREEN + ';}.w342chip.no{background:rgba(179,64,47,.11);color:' + FLAG + ';}.w342chip.yes{background:rgba(16,63,57,.12);}.w342chip.wait{background:rgba(220,165,39,.26);color:#1F201E;}'
    /* what needs attention */
    + R + ' .w342nudges{display:grid;gap:8px;margin:0 0 18px;}'
    + R + ' .w342nudge{display:flex;align-items:center;gap:10px 12px;flex-wrap:wrap;padding:11px 14px;border-radius:14px;background:var(--v-goldt);color:var(--v-ink);text-decoration:none;font-size:14px;' + TAP + 'transition:transform 160ms ' + OUT + ';}'
    + R + ' .w342nudge > svg{width:20px;height:20px;flex:0 0 20px;color:' + GREEN + ';}' + R + ' .w342nudge span{flex:1 1 220px;min-width:0;}' + R + ' .w342nudge em{display:inline-flex;align-items:center;gap:2px;font-style:normal;font-weight:700;color:' + GREEN + ';white-space:nowrap;}' + R + ' .w342nudge em svg{width:16px;height:16px;}'
    + R + ' .w342nudge:active{transform:scale(.99);}'
    /* the calendar and the next event, side by side on a computer */
    + R + ' .w342top{display:grid;grid-template-columns:minmax(0,1fr);gap:22px;margin:0 0 6px;}'
    + '@media (min-width:1000px){' + R + ' .w342top{grid-template-columns:minmax(300px,360px) minmax(0,1fr);align-items:start;}}'
    + R + ' .w342side{min-width:0;}'
    + R + ' .w342cal{padding:16px 16px 12px;border-radius:20px;background:var(--v-card);border:1px solid var(--v-line);margin:0 0 30px;}'
    + R + ' .w342cal .top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;}'
    + R + ' .w342cal .mo{margin:0 0 0 4px;font:500 26px/1.05 ' + HEAD + ';color:' + GREEN + ';}'
    + R + ' .w342cal .nav{display:flex;align-items:center;gap:2px;}'
    + R + ' .w342cal .wk,' + R + ' .w342cal .grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;}'
    + R + ' .w342cal .wk span{padding:4px 0;text-align:center;font:600 11.5px/1.2 ' + BODY + ';color:var(--v-mut);}'
    + R + ' .w342cal .d{position:relative;display:grid;place-items:center;aspect-ratio:1 / 1;min-height:40px;border:0;border-radius:12px;background:none;color:var(--v-mut);font:500 14px/1 ' + BODY + ';font-variant-numeric:tabular-nums;padding:0;}'
    + R + ' .w342cal .d.today{box-shadow:inset 0 0 0 1.5px var(--v-line2);color:var(--v-ink);font-weight:700;}'
    + R + ' .w342cal button.d{cursor:pointer;background:var(--v-surf2);color:' + GREEN + ';font-weight:700;' + TAP + 'transition:transform 160ms ' + OUT + ',background-color 200ms ' + OUT + ';}'
    + R + ' .w342cal button.d:active{transform:scale(.94);}'
    + R + ' .w342cal button.d.on{background:' + GREEN + ';color:' + CREAM + ';}'
    + R + ' .w342cal button.d.past{background:var(--v-surf);font-weight:600;}' + R + ' .w342cal button.d.past.on{background:' + GREEN + ';}'
    + R + ' .w342cal button.d.off{background:none;box-shadow:inset 0 0 0 1px var(--v-line2);color:var(--v-mut);text-decoration:line-through;}'
    + R + ' .w342cal .dots{position:absolute;left:0;right:0;bottom:5px;display:flex;justify-content:center;gap:3px;}'
    + R + ' .w342cal .dots i,' + R + ' .w342cal .leg i{width:6px;height:6px;border-radius:50%;background:' + TEAL + ';}' + R + ' .w342cal .dots i.f,' + R + ' .w342cal .leg i.f{background:' + PURPLE + ';}'
    + R + ' .w342cal button.d.on .dots i{background:' + GOLD + ';}'
    + R + ' .w342cal .leg{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:10px 4px 0;font-size:12.5px;color:var(--v-mut);}' + R + ' .w342cal .leg span{display:inline-flex;align-items:center;gap:6px;}' + R + ' .w342cal .leg i{width:8px;height:8px;}' + R + ' .w342cal .leg .q{margin-left:auto;}'
    /* the next event */
    + R + ' .w342hero{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;padding:20px;border-radius:20px;background:' + GREEN + ';color:' + CREAM + ';text-decoration:none;box-shadow:0 1px 2px rgba(16,63,57,.12),0 12px 32px rgba(16,63,57,.14);' + TAP + 'transition:transform 160ms ' + OUT + ';}'
    + '@media (min-width:700px){' + R + ' .w342hero{grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:28px;padding:24px 26px;}}'
    + R + ' .w342hero.fund{background:#3d3566;}'
    + R + ' .w342hero:active{transform:scale(.995);}'
    + R + ' .w342hero .hl,' + R + ' .w342hero .hr{min-width:0;}'
    + R + ' .w342hero .ht{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}'
    + R + ' .w342hero .date{display:block;font:500 48px/.95 ' + HEAD + ';letter-spacing:-.01em;}'
    + R + ' .w342hero .tt{margin:14px 0 6px;font:600 19px/1.25 ' + BODY + ';color:' + CREAM + ';overflow-wrap:anywhere;text-transform:none;letter-spacing:0;}'
    + R + ' .w342hero .meta{margin:2px 0;color:rgba(255,250,242,.86);font-size:14px;overflow-wrap:anywhere;}'
    + R + ' .w342open{display:inline-flex;align-items:center;gap:4px;margin:16px 0 0;min-height:38px;padding:0 14px;border-radius:10px;background:' + GOLD + ';color:' + GREEN + ';font:700 14px/1 ' + BODY + ';}' + R + ' .w342open svg{width:16px;height:16px;}'
    + R + ' .w342hero .conf{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;margin:0 0 4px;font-size:15px;color:rgba(255,250,242,.9);}'
    + R + ' .w342hero .conf b{font:500 46px/1 ' + HEAD + ';letter-spacing:-.01em;color:' + CREAM + ';font-variant-numeric:tabular-nums;}'
    + R + ' .w342hero .side{margin:0 0 12px;font-size:13.5px;color:rgba(255,250,242,.86);}' + R + ' .w342hero .side .pl{color:' + GOLD + ';}'
    + R + ' .w342brs{display:grid;grid-template-columns:minmax(84px,auto) minmax(0,1fr) minmax(40px,auto);align-items:center;gap:9px 10px;margin:8px 0;font-size:13.5px;}' + R + ' .w342br{display:contents;}'
    + R + ' .w342br .l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;}' + R + ' .w342br .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}' + R + ' .w342br .n.ok{font-weight:700;}'
    + R + ' .w342bar{position:relative;display:block;height:8px;border-radius:99px;background:var(--v-surf2);overflow:hidden;}'
    + R + ' .w342bar i{position:absolute;left:0;top:0;bottom:0;width:100%;transform:scaleX(var(--s,0));transform-origin:left center;border-radius:99px;}'
    + R + '.w342in .w342bar i{animation:w342grow 420ms ' + OUT + ' both;}@keyframes w342grow{from{transform:scaleX(0)}}'
    + R + ' .w342bar .w{background:rgba(220,165,39,.55);}' + R + ' .w342bar .c{background:' + TEAL + ';}'
    + R + ' .w342hero .w342bar{background:rgba(255,250,242,.2);}' + R + ' .w342hero .w342bar .c{background:' + CREAM + ';}' + R + ' .w342hero .w342bar .w{background:' + GOLD + ';}'
    + R + ' .w342hero .leg{display:flex;flex-wrap:wrap;gap:6px 14px;margin:12px 0 0;font-size:12.5px;color:rgba(255,250,242,.86);}' + R + ' .w342hero .leg span{display:inline-flex;align-items:center;gap:6px;}' + R + ' .w342hero .leg i{width:10px;height:10px;border-radius:3px;background:' + CREAM + ';}' + R + ' .w342hero .leg i.w{background:' + GOLD + ';}'
    + '.w342cheer{display:flex;align-items:center;gap:10px 12px;flex-wrap:wrap;margin:10px 0 0;padding:12px 14px;border-radius:14px;background:rgba(220,165,39,.2);font:400 14px/1.45 ' + BODY + ';color:#1F201E;}.w342cheer > svg{width:20px;height:20px;flex:0 0 20px;color:' + FLAG + ';}.w342cheer p{flex:1 1 240px;min-width:0;margin:0;}'
    /* upcoming */
    + R + ' .w342seg{display:inline-flex;padding:3px;border-radius:999px;background:var(--v-surf2);}'
    + R + ' .w342seg button{min-height:34px;padding:0 14px;border:0;border-radius:999px;background:none;color:' + GREEN + ';font:600 13px/1 ' + BODY + ';cursor:pointer;' + TAP + 'transition:background-color 200ms ' + OUT + ',transform 160ms ' + OUT + ';}' + R + ' .w342seg button[aria-pressed="true"]{background:var(--v-card);box-shadow:0 1px 2px rgba(16,32,29,.14);}' + R + ' .w342seg button:active{transform:scale(.97);}'
    + R + ' .w342grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}'
    + '@media (max-width:600px){' + R + ' .w342grid{grid-template-columns:minmax(0,1fr);}}'
    + R + ' .w342card{display:flex;flex-direction:column;gap:2px;min-width:0;padding:16px 16px 14px;border-radius:16px;background:var(--v-card);border:1px solid var(--v-line);color:var(--v-ink);text-decoration:none;' + TAP + 'transition:transform 160ms ' + OUT + ',box-shadow 200ms ' + OUT + ',border-color 200ms ' + OUT + ';}'
    + R + ' .w342card:active,' + R + ' .w342prow:active{transform:scale(.985);}'
    + R + ' .w342card.off{border-style:dashed;background:none;}' + R + ' .w342card.sel{border-color:' + GREEN + ';box-shadow:0 0 0 1px ' + GREEN + ';}'
    + R + ' .w342card.fund{border-left:4px solid ' + PURPLE + ';}'
    + R + ' .w342card .ct{display:flex;align-items:center;justify-content:space-between;gap:8px;}' + R + ' .w342card .cd{font:500 30px/1 ' + HEAD + ';color:' + GREEN + ';}'
    + R + ' .w342card .tt{margin:10px 0 2px;font:600 16px/1.3 ' + BODY + ';color:var(--v-ink);overflow-wrap:anywhere;text-transform:none;letter-spacing:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}'
    + R + ' .w342card .meta{margin:0;font-size:13.5px;color:var(--v-mut);overflow-wrap:anywhere;}'
    + R + ' .w342card .cf{margin:12px 0 6px;font-size:13.5px;color:var(--v-mut);}' + R + ' .w342card .cf b{font:500 24px/1 ' + HEAD + ';color:' + GREEN + ';margin-right:4px;font-variant-numeric:tabular-nums;}'
    + R + ' .w342card .side{margin:8px 0 0;font-size:13px;color:var(--v-mut);}' + R + ' .w342card .side .pl{color:#8a6200;}'
    /* past */
    + R + ' .w342fold{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 4px 0 0;border:0;background:none;font:inherit;color:inherit;cursor:pointer;border-radius:8px;' + TAP + '}' + R + ' .w342fold svg{width:22px;height:22px;transition:transform 200ms ' + OUT + ';}' + R + ' .w342fold[aria-expanded="true"] svg{transform:rotate(90deg);}'
    + R + ' #w342pastl{margin-top:10px;}'
    + R + ' .w342prow{display:grid;grid-template-columns:130px minmax(0,1fr) auto;align-items:center;gap:6px 14px;margin:0 0 8px;padding:12px 16px;border-radius:12px;background:var(--v-card);border:1px solid var(--v-line);color:var(--v-ink);text-decoration:none;' + TAP + 'transition:transform 160ms ' + OUT + ',border-color 200ms ' + OUT + ';}'
    + R + ' .w342prow .d{font:500 20px/1 ' + HEAD + ';color:' + GREEN + ';}' + R + ' .w342prow .t{font-weight:600;overflow-wrap:anywhere;min-width:0;}' + R + ' .w342prow .t small{margin-left:8px;font-weight:400;font-size:12.5px;color:var(--v-mut);}' + R + ' .w342prow .m{font-size:13.5px;color:var(--v-mut);text-align:right;}'
    + '@media (max-width:600px){' + R + ' .w342prow{grid-template-columns:minmax(0,1fr) auto;}' + R + ' .w342prow .d{grid-column:1 / -1;}}'
    + R + ' .w342empty{padding:26px 22px;border-radius:18px;background:var(--v-surf);}' + R + ' .w342empty .tt{margin:0 0 6px;font:500 28px/1.05 ' + HEAD + ';color:' + GREEN + ';text-transform:none;}' + R + ' .w342empty p{margin:0 0 14px;color:var(--v-mut);max-width:520px;}'
    /* the menu's places, on a phone */
    + R + ' .w342chips{display:none;}'
    + '@media (max-width:900px){' + R + ' .w342chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;margin:0 -4px 14px 0;padding:2px 4px 2px 0;}' + R + ' .w342chips::-webkit-scrollbar{display:none;}'
    + R + ' .w342chips a{flex:0 0 auto;display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;background:var(--v-surf2);color:' + GREEN + ';font:600 13.5px/1 ' + BODY + ';text-decoration:none;white-space:nowrap;' + TAP + '}' + R + ' .w342chips a.on{background:' + GREEN + ';color:' + CREAM + ';}}'
    /* the sheet */
    + 'html.w342lock{overflow:hidden;}'
    + SHT + '{position:fixed;inset:0;z-index:2147482600;display:flex;align-items:center;justify-content:center;padding:24px;font:400 15px/1.45 ' + BODY + ';color:var(--v-ink);}'
    + SHT + ' .bk{position:absolute;inset:0;background:rgba(16,32,29,.44);opacity:0;transition:opacity 220ms ease;}'
    + SHT + ' .pn{position:relative;display:flex;flex-direction:column;width:min(560px,100%);max-height:min(88vh,860px);max-height:min(88dvh,860px);background:#fffdf7;border-radius:22px;box-shadow:0 24px 60px rgba(16,32,29,.28),0 0 0 1px rgba(16,63,57,.08);opacity:0;transform:translateY(10px) scale(.985);transition:opacity 220ms ' + OUT + ',transform 260ms ' + OUT + ';outline:none;}'
    + SHT + '.in .bk{opacity:1;}' + SHT + '.in .pn{opacity:1;transform:none;}'
    + SHT + ' .hd{display:flex;align-items:center;gap:6px;padding:12px 12px 8px;}' + SHT + ' .hd .sp{width:40px;flex:0 0 40px;}' + SHT + ' .hd .tt{flex:1 1 auto;min-width:0;text-align:center;}'
    + SHT + ' .hd small{display:block;font:600 12px/1.3 ' + BODY + ';color:var(--v-mut);}' + SHT + ' .hd h2{margin:0;font:500 26px/1.1 ' + HEAD + ';color:' + GREEN + ';text-transform:none;letter-spacing:0;overflow-wrap:anywhere;}'
    + SHT + ' .bd{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:4px 22px 18px;}'
    + SHT + ' .lead{margin:0 0 14px;text-align:center;color:var(--v-mut);font-size:14.5px;}'
    + SHT + ' .ft{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;padding:12px 22px calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--v-line);}' + SHT + ' .ft .w342btn{min-height:44px;flex:0 1 auto;}'
    + SHT + ' .w342picks{display:grid;gap:10px;margin:4px 0 6px;}'
    + SHT + ' .w342pick{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;border-radius:16px;border:1.5px solid var(--v-line2);background:var(--v-card);color:var(--v-ink);text-align:left;font:inherit;cursor:pointer;' + TAP + 'transition:transform 160ms ' + OUT + ',border-color 200ms ' + OUT + ',background-color 200ms ' + OUT + ';}'
    + SHT + ' .w342pick .i{display:grid;place-items:center;width:44px;height:44px;flex:0 0 44px;border-radius:12px;background:var(--v-surf2);color:' + GREEN + ';}' + SHT + ' .w342pick .i svg{width:24px;height:24px;}'
    + SHT + ' .w342pick .t{min-width:0;}' + SHT + ' .w342pick b{display:block;font:600 16.5px/1.25 ' + BODY + ';color:' + GREEN + ';overflow-wrap:anywhere;}' + SHT + ' .w342pick .t span{display:block;margin-top:2px;font-size:13.5px;color:var(--v-mut);}'
    + SHT + ' .w342pick.on{border-color:' + GREEN + ';background:rgba(16,63,57,.06);}' + SHT + ' .w342pick.on .i{background:' + GREEN + ';color:' + CREAM + ';}'
    + SHT + ' .w342form{display:grid;gap:12px;margin:6px 0 0;}' + SHT + ' .w342form.box{margin-top:16px;padding:14px;border-radius:14px;background:var(--v-surf);}' + SHT + ' .w342form.box > small{font-size:12.5px;color:var(--v-mut);}'
    + SHT + ' .w342fld{display:grid;gap:5px;min-width:0;}' + SHT + ' .w342fld > span,' + SHT + ' .w342lbl{font:600 13px/1.3 ' + BODY + ';color:' + GREEN + ';margin:0;}' + SHT + ' p.w342lbl{margin:16px 0 8px;}' + SHT + ' .w342form.box p.w342lbl{margin:0;}'
    + SHT + ' .w342fld small{font-size:12.5px;color:var(--v-mut);}'
    + SHT + ' input,' + SHT + ' select,' + SHT + ' textarea{width:100%;box-sizing:border-box;min-height:44px;padding:9px 12px;border-radius:10px;border:1px solid var(--v-line2);background:#fff;color:var(--v-ink);font:400 16px/1.3 ' + BODY + ';}' + SHT + ' textarea{min-height:150px;resize:vertical;line-height:1.45;}'
    + SHT + ' .w342row{display:flex;flex-wrap:wrap;gap:8px;}'
    + SHT + ' .w342spots{display:grid;gap:2px;}' + SHT + ' .w342spots .sp{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--v-line);}' + SHT + ' .w342spots .sp:first-child{border-top:0;}'
    + SHT + ' .w342spots .l{min-width:0;}' + SHT + ' .w342spots .l b{display:block;font-weight:600;overflow-wrap:anywhere;}' + SHT + ' .w342spots .l small{display:block;font-size:12.5px;color:var(--v-mut);}'
    + SHT + ' .w342spots .st{display:flex;align-items:center;gap:4px;flex:0 0 auto;}' + SHT + ' .w342spots .st .w342ib{background:var(--v-surf2);border-radius:50%;}' + SHT + ' .w342spots input{width:58px;min-height:40px;padding:6px 4px;text-align:center;font-variant-numeric:tabular-nums;font-weight:600;}'
    + SHT + ' .w342total{margin:12px 0 0;padding:10px 12px;border-radius:10px;background:var(--v-surf);font-size:14px;}' + SHT + ' .w342total b{font:500 22px/1 ' + HEAD + ';color:' + GREEN + ';margin-right:4px;}'
    + SHT + ' .w342sum{display:grid;grid-template-columns:minmax(84px,auto) minmax(0,1fr);gap:8px 14px;margin:6px 0 14px;}' + SHT + ' .w342sum dt{color:var(--v-mut);font-size:13.5px;}' + SHT + ' .w342sum dd{margin:0;font-weight:600;overflow-wrap:anywhere;}'
    + SHT + ' .w342done{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:16px;background:rgba(42,140,122,.12);}' + SHT + ' .w342done svg{width:30px;height:30px;flex:0 0 30px;padding:6px;border-radius:50%;background:' + TEAL + ';color:#fff;box-sizing:content-box;}' + SHT + ' .w342done p{margin:0;}'
    + SHT + ' .w342next{margin:16px 0 0;padding-left:20px;display:grid;gap:8px;font-size:14px;}' + SHT + ' .w342next b{color:' + GREEN + ';}'
    + SHT + ' .w342list{list-style:none;margin:0;padding:0;}' + SHT + ' .w342list li{display:grid;gap:2px;padding:9px 0;border-top:1px solid var(--v-line);}' + SHT + ' .w342list li:first-child{border-top:0;}' + SHT + ' .w342list b{overflow-wrap:anywhere;}' + SHT + ' .w342list span{font-size:13.5px;color:var(--v-mut);overflow-wrap:anywhere;}'
    + SHT + ' .w342opts{display:grid;gap:8px;}' + SHT + ' .w342opt{display:flex;align-items:center;justify-content:space-between;gap:10px 14px;flex-wrap:wrap;width:100%;min-height:48px;padding:10px 14px;border-radius:12px;border:1px solid var(--v-line2);background:var(--v-card);color:var(--v-ink);text-align:left;font:inherit;cursor:pointer;' + TAP + 'transition:transform 160ms ' + OUT + ',background-color 200ms ' + OUT + ';}'
    + SHT + ' .w342opt b{font-weight:600;color:' + GREEN + ';overflow-wrap:anywhere;min-width:0;}' + SHT + ' .w342opt span{font-size:13px;color:var(--v-mut);}' + SHT + ' .w342opt.warn b{color:var(--v-flag);}' + SHT + ' .w342opt:disabled{opacity:.5;cursor:not-allowed;}'
    + SHT + ' .w342pre{margin:12px 0 0;padding:10px 12px;border-radius:10px;background:var(--v-surf);font-size:13.5px;}' + SHT + ' .w342pre p{margin:6px 0 0;color:var(--v-mut);white-space:pre-wrap;overflow-wrap:anywhere;}'
    + '@media (max-width:640px){' + SHT + '{align-items:flex-end;padding:0;}' + SHT + ' .pn{width:100%;max-height:92vh;max-height:92dvh;border-radius:22px 22px 0 0;transform:translateY(28px);}' + SHT + ' .ft .w342btn{flex:1 1 0;}}'
    /* each event: the sign-up list */
    + TY + '{margin:0 0 16px;padding:14px 16px;border-radius:16px;background:rgba(220,165,39,.12);border:1px solid rgba(220,165,39,.5);font:400 14px/1.45 ' + BODY + ';color:var(--v-ink);}'
    + TY + ' .th h4{display:flex;align-items:center;gap:8px;margin:0 0 2px;font:600 20px/1.1 ' + HEAD + ';letter-spacing:.3px;text-transform:uppercase;color:' + GREEN + ';}' + TY + ' .th .n{font:700 12.5px/1.5 ' + BODY + ';padding:0 8px;border-radius:999px;background:' + GOLD + ';color:' + GREEN + ';}'
    + TY + ' .th p{margin:0 0 8px;font-size:13px;color:var(--v-mut);}'
    + TY + ' .w342rows{list-style:none;margin:0;padding:0;}' + TY + ' .w342rows li{display:flex;align-items:center;justify-content:space-between;gap:8px 14px;flex-wrap:wrap;padding:9px 0;border-top:1px solid rgba(16,63,57,.1);}'
    + TY + ' .who{flex:1 1 220px;min-width:0;}' + TY + ' .who b{display:block;font-weight:600;overflow-wrap:anywhere;}' + TY + ' .who small{display:block;font-size:12.5px;color:var(--v-mut);}' + TY + ' .who em{font-style:normal;font-weight:600;color:#8a6200;}'
    + TY + ' .acts{display:flex;flex-wrap:wrap;gap:6px;flex:0 1 auto;}'
    + TY + ' > .w342btn{margin-top:8px;}' + TY + ' .w342cheer.in{margin:0 0 6px;background:rgba(255,253,247,.8);}'
    + TY + ' .w342undo{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px;padding:8px 12px;border-radius:10px;background:rgba(42,140,122,.14);font-size:13.5px;}'
    + '@media (max-width:640px){' + TY + ' .acts{flex:1 1 100%;}' + TY + ' .acts .w342btn{flex:1 1 auto;min-height:40px;}}'
    /* each event: the header (wave191's, in the new shape), the More menu in full, the board with the people who can't come folded */
    + '#w191head{overflow:visible !important;}#w191head:before{right:0 !important;top:0 !important;width:min(340px,60%) !important;height:100% !important;border-radius:0 22px 22px 0 !important;background:radial-gradient(circle at 88% 0%,rgba(111,100,171,.42),rgba(111,100,171,0) 68%) !important;}'
    + '#w191head .w342back{display:inline-flex;align-items:center;gap:6px;min-height:32px;margin:-4px 0 6px -2px;color:rgba(255,250,242,.9);font:600 13.5px/1 ' + BODY + ';text-decoration:none;border-radius:8px;position:relative;' + TAP + '}#w191head .w342back svg{width:16px;height:16px;}'
    + '#w191head .w342ehc{position:relative;display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;margin:14px 0 0;font:400 14px/1.3 ' + BODY + ';color:rgba(255,250,242,.9);}'
    + '#w191head .w342ehc .big{font-size:15px;white-space:nowrap;}#w191head .w342ehc .big b{font:500 38px/1 ' + HEAD + ';color:' + CREAM + ';margin-right:6px;font-variant-numeric:tabular-nums;}'
    + '#w191head .w342ehc .w342bar{position:relative;flex:1 1 180px;max-width:320px;height:8px;border-radius:99px;background:rgba(255,250,242,.2);overflow:hidden;}#w191head .w342ehc .w342bar i{position:absolute;left:0;top:0;bottom:0;width:100%;transform:scaleX(var(--s,0));transform-origin:left center;border-radius:99px;background:' + CREAM + ';}#w191head .w342ehc .w342bar i.w{background:' + GOLD + ';}'
    + '#w191head .w342ehc small{flex:1 1 100%;font-size:13px;color:rgba(255,250,242,.86);}#w191head .w342ehc small b{color:' + GOLD + ';}'
    + '#w191head .w191bar.w342sb{display:flex !important;overflow:visible !important;padding:0 !important;gap:0 !important;margin:10px 0 0 !important;position:relative;}'
    + '#w119.w307 #w191team > .b > .w191own{display:none !important;}'   /* the role pills repeated the board's own headers */
    + '#w191head .w342stage{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 11px;border:0;border-radius:999px;background:rgba(255,250,242,.14);color:' + CREAM + ';font:600 12.5px/1 ' + BODY + ';cursor:pointer;' + TAP + '}#w191head .w342stage i{font-style:normal;color:' + GOLD + ';}'
    + '#w191head .menu{z-index:60 !important;max-height:min(70vh,560px);overflow-y:auto;overscroll-behavior:contain;min-width:250px !important;}#w191head .menu .mh{display:block;padding:8px 12px 3px;font:700 11px/1.3 ' + BODY + ';letter-spacing:.08em;text-transform:uppercase;color:#6d6a60;}'
    + '@media (max-width:700px){#w191head .more{position:static !important;}#w191head .menu{left:12px !important;right:12px !important;top:auto !important;margin-top:8px;}}'
    + '#w119 .rc details.w342gone{margin:8px 0 0;}#w119 .rc details.w342gone > summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;min-height:36px;padding:0 4px;font:600 12.5px/1.2 ' + BODY + ';color:#6d6a60;border-radius:8px;' + TAP + '}#w119 .rc details.w342gone > summary::-webkit-details-marker{display:none;}#w119 .rc details.w342gone > summary:before{content:"\\25B8";font-size:11px;transition:transform 200ms ' + OUT + ';}#w119 .rc details.w342gone[open] > summary:before{transform:rotate(90deg);}'
    + '#w119 .pc .w342jobs{display:flex;gap:4px;margin-top:6px;padding:3px;border-radius:999px;background:rgba(16,63,57,.08);width:max-content;max-width:100%;}#w119 .pc .w342jobs button{min-height:28px;padding:0 10px;border:0;border-radius:999px;background:none;color:' + GREEN + ';font:600 11.5px/1 ' + BODY + ';cursor:pointer;' + TAP + '}#w119 .pc .w342jobs button[aria-pressed="true"]{background:' + GREEN + ';color:' + CREAM + ';}'
    + '#w119 .pc .w342lent{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px;padding:4px 6px 4px 9px;border-radius:9px;background:rgba(111,100,171,.16);font:600 11.5px/1.3 ' + BODY + ';color:#3d3566;}#w119 .pc .w342lent button{width:24px;height:24px;border:0;border-radius:50%;background:none;color:inherit;font-size:15px;cursor:pointer;}'
    + '#w119 .rc .w342cl{display:flex;flex-wrap:wrap;gap:3px 10px;margin:-2px 0 8px;font:400 11.5px/1.4 ' + BODY + ';color:#5b5a57;}#w119 .rc .w342cl b{color:' + GREEN + ';}#w119 .rc .w342cl em{font-style:normal;font-weight:700;color:' + FLAG + ';}#w119 .rc .w342cl small{flex:1 1 100%;font-size:11px;}#w119 .rc .w342cl .w342lnk{font-size:11.5px;}'
    /* the Volunteer Manager's own masthead: one primary button; the page help lives in Setup */
    + 'body.w153volunteer #volunteering .w43help,body.w153volunteer #volunteering .w43helprow{display:none !important;}body.w153volunteer #volunteering #w259how .w43help{display:inline-flex !important;position:static !important;float:none !important;}'
    + 'body.w153volunteer #volunteering > .w118mast .w197pact{min-height:40px;padding:0 16px;border-radius:10px;}'
    + '@media (max-width:900px){body.w153volunteer #w153bar .w153btn[data-w153act="newevent"]{min-height:36px;}}'
    + '@media (hover:hover) and (pointer:fine){.w342btn:hover:not(:disabled){border-color:' + GREEN + ';}.w342btn.pri:hover:not(:disabled){background:#0c332e;}.w342ib:hover{background:rgba(16,63,57,.09);}' + R + ' .w342card:hover{border-color:var(--v-line2);box-shadow:0 6px 18px rgba(16,63,57,.1);}' + R + ' .w342prow:hover{border-color:var(--v-line2);}' + R + ' .w342cal button.d:hover:not(.on){background:rgba(16,63,57,.16);}' + SHT + ' .w342pick:hover{border-color:' + GREEN + ';}' + SHT + ' .w342opt:hover:not(:disabled){background:rgba(16,63,57,.05);}#w191head .w342back:hover{color:#fff;}#w119 .pc .w342jobs button:hover:not([aria-pressed="true"]){background:rgba(16,63,57,.1);}}'
    + '@media (pointer:coarse){.w342btn.sm{min-height:40px;}.w342ib{width:44px;height:44px;flex-basis:44px;}#w119 .pc .w342jobs button{min-height:36px;}}'
    + '@media (prefers-reduced-motion:reduce){' + R + '.w342in .w342bar i{animation:none;}' + SHT + ' .pn{transform:none !important;transition:opacity 160ms ease;}.w342btn:active,.w342ib:active,.w342pick:active,.w342opt:active,' + R + ' .w342card:active,' + R + ' .w342hero:active,' + R + ' .w342cal button.d:active{transform:none !important;}}';
  var st = document.createElement('style'); st.id = 'wa342css'; st.textContent = css; document.head.appendChild(st);

  window.w342 = { tally: tally, tallyD: tallyD, toPlace: toPlace, isConf: isConf, isOut: isOut, targetsFor: targetsFor, usual: usual, today: today, newEvent: newEvent, render: renderEvents, load: load, state: function () { return S; },
    cardBits: cardBits, colNote: colNote, syncTray: syncTray, tabTo: tabTo, places: PLACES, placeOf: placeOf, rule: function () { return S.rule; }, ensureGuides: ensureGuides, sheet: function () { return SH; }, auto: auto, pickFull: pickFull, caps: function () { return { cooks: S.cookMax, pickups: S.pickMax }; } };
})();

/* =====================================================================
   WA v110 boot veil + self-provisioning$n48$, chr(13), '')];
begin
  select string_agg(content, '' order by part) into v from public.site_files where path = 'index.html';
  if v is null then raise exception 'index.html not found'; end if;
  if (select count(*) from public.site_files where path = 'index.html') <> 10 then raise exception 'index.html is not in 10 parts'; end if;
  if position('window.w342 = ' in v) > 0 then raise exception 'index.html already has wave342'; end if;
  if position('WA v341 n: confirmed per role' in v) > 0 then raise exception 'wave341 was run on its own: tell Claude, this file expects the page without it'; end if;
  if md5(v) <> '04a6163f23704c9a2c7ec0b845219ff2' then raise notice 'index.html has moved since this file was made (md5 %): each edit applies only if it still matches', md5(v); end if;
  if not exists (select 1 from public.site_files_bak_wa342) then
    insert into public.site_files_bak_wa342 select path, part, content, updated_at from public.site_files where path = 'index.html';
  end if;
  -- what the undo needs from the database, saved once
  insert into public.wa342_undo (k, v) select 'fn171', pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'wa171_queue_confirms' on conflict (k) do nothing;
  insert into public.wa342_undo (k, v) select 'fn340', pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'wa340_round_people' on conflict (k) do nothing;
  insert into public.wa342_undo (k, v) select 'guides', jsonb_object_agg(role, target)::text from public.volunteer_role_guides on conflict (k) do nothing;
  insert into public.wa342_undo (k, v) values ('rule', (select value from public.app_config where key = 'vol_servers_per_cook')) on conflict (k) do nothing;
  if (select count(*) from public.wa342_undo where k in ('fn171', 'fn340', 'guides')) <> 3 then raise exception 'could not save what the undo needs'; end if;
  -- the database part
  execute $db342$
-- wave342, the database part: sign-ups to place, the new event, community lead jobs, and 2 servers per cook.

-- a. who is "signed up, to place": someone who signed up themselves (a form, their volunteer page) or is waiting for a role,
--    whom nobody on the team has placed, asked or heard from yet. The page uses the same rule (w342.toPlace).
create or replace function public.wa342_to_place(r public.event_roster)
returns boolean language sql immutable set search_path to '' as $$
  select lower(coalesce(r.status, '')) in ('', 'tbd')
     and r.confirm_status is null
     and not (coalesce(r.detail, '{}'::jsonb) ? 'placed_at')
     and not (coalesce(r.detail, '{}'::jsonb) ? 'assigned_at')
     and coalesce(r.detail->>'partner', '') <> 'true'
     and (lower(coalesce(r.role, '')) = 'volunteer'
          or lower(coalesce(r.detail->>'source', '')) in ('hub_form', 'form')
          or lower(coalesce(r.detail->>'source', '')) like 'self sign-up%');
$$;
revoke all on function public.wa342_to_place(public.event_roster) from public, anon;
grant execute on function public.wa342_to_place(public.event_roster) to authenticated, service_role;

-- b. the season words the Volunteer Manager already uses (Fall, Winter, Spring, Summer)
create or replace function public.wa342_season(p_day date)
returns text language sql immutable set search_path to '' as $$
  select case when (extract(month from p_day) = 3 and extract(day from p_day) >= 20) or extract(month from p_day) in (4, 5) or (extract(month from p_day) = 6 and extract(day from p_day) <= 20) then 'Spring'
              when extract(month from p_day) in (6, 7, 8) or (extract(month from p_day) = 9 and extract(day from p_day) <= 21) then 'Summer'
              when extract(month from p_day) in (9, 10) then 'Fall'
              else 'Winter' end;
$$;
revoke all on function public.wa342_season(date) from public, anon;
grant execute on function public.wa342_season(date) to authenticated, service_role;

-- c. New event, a program: one serving with its format, time, place and spots. The table's own trigger copies the checklist.
create or replace function public.wa342_event_create(p jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_who text := coalesce(auth.jwt()->>'email', 'staff');
        v_date date; v_fmt text := nullif(btrim(coalesce(p->>'format', '')), ''); v_title text := nullif(btrim(coalesce(p->>'title', '')), '');
        v_loc text := nullif(btrim(coalesce(p->>'location', '')), ''); v_time time; v_yy text; v_n int; v_code text; v_id bigint;
        v_spots jsonb := '{}'::jsonb; k text; v_num numeric; v_usual int; v_same text; v_today date := (now() at time zone 'America/Toronto')::date;
begin
  if not public.is_wa_staff() then raise exception 'Staff only.'; end if;
  begin v_date := (p->>'event_date')::date; exception when others then v_date := null; end;
  if v_date is null then raise exception 'Pick a date.'; end if;
  if v_date < v_today then raise exception 'That date has passed.'; end if;
  if v_date > v_today + 800 then raise exception 'That date is too far away.'; end if;
  if v_fmt is null or v_fmt not in ('home_cooked', 'community_kitchen') then raise exception 'Choose kitchen-based or cook from home.'; end if;
  begin v_time := coalesce(nullif(p->>'start_time', ''), '12:00')::time; exception when others then raise exception 'That start time does not read as a time.'; end;
  if length(coalesce(v_title, '')) > 120 then raise exception 'Keep the name under 120 characters.'; end if;
  if length(coalesce(v_loc, '')) > 160 then raise exception 'Keep the place under 160 characters.'; end if;
  select string_agg(e.code, ', ') into v_same from public.volunteer_events e where e.event_date = v_date and e.kind = 'service' and e.status <> 'cancelled';
  if v_same is not null and not coalesce((p->>'allow_same_day')::boolean, false) then
    return jsonb_build_object('same_day', v_same);
  end if;
  -- the spots this event sets for itself: only where they differ from the usual counts
  if jsonb_typeof(p->'spot_counts') = 'object' then
    for k in select jsonb_object_keys(p->'spot_counts') loop
      select g.target into v_usual from public.volunteer_role_guides g where g.role = k;
      if not found then continue; end if;
      begin v_num := (p->'spot_counts'->>k)::numeric; exception when others then v_num := null; end;
      if v_num is null or v_num < 0 or v_num > 60 then raise exception 'Spots are a number from 0 to 60.'; end if;
      if round(v_num)::int is distinct from coalesce(v_usual, 0) then v_spots := v_spots || jsonb_build_object(k, round(v_num)::int); end if;
    end loop;
  end if;
  v_yy := to_char(v_date, 'YY');
  perform pg_advisory_xact_lock(hashtext('wa342_event_code'));
  select coalesce(max((regexp_match(e.code, '^WA-' || v_yy || '-(\d+)$'))[1]::int), 0) + 1 into v_n from public.volunteer_events e where e.code ~ ('^WA-' || v_yy || '-\d+$');
  v_code := 'WA-' || v_yy || '-' || lpad(v_n::text, 2, '0');
  insert into public.volunteer_events (code, event_date, season, location, notes, status, kind, title, format, kitchen_place, kitchen_shift, start_time, planned_meals, spot_counts)
  values (v_code, v_date, public.wa342_season(v_date), coalesce(v_loc, 'Montreal'), nullif(btrim(coalesce(p->>'notes', '')), ''), 'planned', 'service', coalesce(v_title, 'Sunday serving'), v_fmt,
          case when v_fmt = 'community_kitchen' then nullif(btrim(coalesce(p->>'kitchen_place', '')), '') end,
          case when v_fmt = 'community_kitchen' then nullif(btrim(coalesce(p->>'kitchen_shift', '')), '') end,
          v_time, nullif(p->>'planned_meals', '')::int, case when v_spots = '{}'::jsonb then null else v_spots end)
  returning id into v_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_event', v_id::text, 'created', null, v_code || ': ' || to_char(v_date, 'YYYY-MM-DD') || ', ' || v_fmt || ' (New event)', v_who);
  return jsonb_build_object('id', v_id, 'code', v_code, 'event_date', v_date);
end $$;
revoke all on function public.wa342_event_create(jsonb) from public, anon;
grant execute on function public.wa342_event_create(jsonb) to authenticated, service_role;

-- d. Signed up, to place: place people in a role, move them to another date, or tell the list they are not placed this time.
--    Nobody is messaged here: the team writes to them when they choose.
create or replace function public.wa342_place(p_rows bigint[], p_action text, p_role text default null, p_event bigint default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_who text := coalesce(auth.jwt()->>'email', 'staff'); v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
        r public.event_roster; v_to public.volunteer_events; v_role text := nullif(lower(btrim(coalesce(p_role, ''))), ''); v_done bigint[] := '{}'; v_skip int := 0; v_dup boolean; v_cooks int;
        v_max int := coalesce((select nullif(value, '')::int from public.app_config where key = 'vol_cooks_max'), 15);
begin
  if not public.is_wa_staff() then raise exception 'Staff only.'; end if;
  if p_action is null or p_action not in ('place', 'move', 'decline', 'unplace') then raise exception 'Place, move, decline or unplace.'; end if;
  if p_rows is null or cardinality(p_rows) = 0 then raise exception 'Nobody chosen.'; end if;
  if cardinality(p_rows) > 100 then raise exception 'At most 100 people at a time.'; end if;
  if v_role is not null and (length(v_role) > 40 or v_role !~ '^[a-z0-9_]+$') then raise exception 'That role does not read as a role.'; end if;
  if p_action = 'move' then
    select * into v_to from public.volunteer_events e where e.id = p_event;
    if not found then raise exception 'No such event.'; end if;
    if v_to.status <> 'planned' or v_to.event_date < (now() at time zone 'America/Toronto')::date then raise exception 'That event is over or cancelled.'; end if;
  end if;
  for r in select * from public.event_roster er where er.id = any (p_rows) order by er.id for update loop
    if p_action = 'place' then
      if lower(coalesce(r.role, '')) = 'volunteer' and v_role is null then v_skip := v_skip + 1; continue; end if;   -- they picked two roles: one has to be chosen
      if coalesce(v_role, lower(coalesce(r.role, ''))) = 'cook' then   -- one serving takes at most v_max cooks
        select count(*) into v_cooks from public.event_roster x where x.event_id = r.event_id and x.id <> r.id and lower(coalesce(x.role, '')) = 'cook'
           and lower(coalesce(x.status, '')) not in ('cancelled', 'unavailable') and x.confirm_status is distinct from 'declined' and not public.wa342_to_place(x);
        if v_cooks >= v_max then raise exception 'This serving already has its % cooks. Offer them another date.', v_max; end if;
      end if;
      update public.event_roster set role = coalesce(v_role, role), detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('placed_at', v_now, 'placed_by', v_who) where id = r.id;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('event_roster', r.id::text, 'placed', r.role, coalesce(r.person_name, '') || ': placed as ' || coalesce(v_role, r.role), v_who);
    elsif p_action = 'move' then
      if r.event_id = p_event then v_skip := v_skip + 1; continue; end if;
      select exists (select 1 from public.event_roster x where x.event_id = p_event and x.id <> r.id and lower(coalesce(x.status, '')) not in ('cancelled', 'unavailable')
                     and ((r.person_id is not null and x.person_id = r.person_id) or (r.person_id is null and lower(coalesce(x.person_name, '')) = lower(coalesce(r.person_name, ''))))) into v_dup;
      if v_dup then   -- already on that date: this sign-up is closed instead of doubled
        update public.event_roster set status = 'Unavailable', detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('not_placed', true, 'not_placed_at', v_now, 'not_placed_by', v_who, 'moved_to', p_event) where id = r.id;
      else
        update public.event_roster set event_id = p_event, detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('moved_from', r.event_id, 'moved_at', v_now, 'moved_by', v_who) where id = r.id;
      end if;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('event_roster', r.id::text, 'moved', r.event_id::text, coalesce(r.person_name, '') || ': to ' || v_to.code || case when v_dup then ' (already on it)' else '' end, v_who);
    elsif p_action = 'decline' then
      update public.event_roster set status = 'Unavailable', detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('not_placed', true, 'not_placed_at', v_now, 'not_placed_by', v_who) where id = r.id;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('event_roster', r.id::text, 'not placed', r.status, coalesce(r.person_name, '') || ': not placed this time', v_who);
    else   -- unplace: back to the list (undo)
      update public.event_roster set status = case when coalesce(detail->>'not_placed', '') = 'true' then 'TBD' else status end,
             detail = (coalesce(detail, '{}'::jsonb) - 'placed_at' - 'placed_by' - 'not_placed' - 'not_placed_at' - 'not_placed_by') where id = r.id;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('event_roster', r.id::text, 'unplaced', null, coalesce(r.person_name, '') || ': back on the sign-up list', v_who);
    end if;
    v_done := v_done || r.id;
  end loop;
  return jsonb_build_object('done', cardinality(v_done), 'ids', to_jsonb(v_done), 'skipped', v_skip);
end $$;
revoke all on function public.wa342_place(bigint[], text, text, bigint) from public, anon;
grant execute on function public.wa342_place(bigint[], text, text, bigint) to authenticated, service_role;

-- e. Community leads: who talks with people and who keeps the count (the count can go to a server).
create or replace function public.wa342_cl_job(p_roster bigint, p_job text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_who text := coalesce(auth.jwt()->>'email', 'staff'); r public.event_roster; v_job text := nullif(lower(btrim(coalesce(p_job, ''))), '');
begin
  if not public.is_wa_staff() then raise exception 'Staff only.'; end if;
  if v_job is not null and v_job not in ('talk', 'count') then raise exception 'Conversations or the count.'; end if;
  select * into r from public.event_roster where id = p_roster for update;
  if not found then raise exception 'Not on this event.'; end if;
  if v_job = 'count' and lower(coalesce(r.role, '')) not in ('community_debrief', 'community_talker', 'server') then raise exception 'The count goes to a community lead or a server.'; end if;
  if v_job = 'talk' and lower(coalesce(r.role, '')) not in ('community_debrief', 'community_talker') then raise exception 'Conversations are for community leads.'; end if;
  update public.event_roster set detail = case when v_job is null then coalesce(detail, '{}'::jsonb) - 'cl_job' else coalesce(detail, '{}'::jsonb) || jsonb_build_object('cl_job', v_job) end where id = r.id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('event_roster', r.id::text, 'community lead job', r.detail->>'cl_job', coalesce(r.person_name, '') || ': ' || coalesce(v_job, 'no job set'), v_who);
  return jsonb_build_object('id', r.id, 'job', v_job);
end $$;
revoke all on function public.wa342_cl_job(bigint, text) from public, anon;
grant execute on function public.wa342_cl_job(bigint, text) to authenticated, service_role;

-- e2. A cook who brings their dish and stays to serve it counts as a server too.
create or replace function public.wa342_cook_serves(p_roster bigint, p_on boolean)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_who text := coalesce(auth.jwt()->>'email', 'staff'); r public.event_roster;
begin
  if not public.is_wa_staff() then raise exception 'Staff only.'; end if;
  select * into r from public.event_roster where id = p_roster for update;
  if not found then raise exception 'Not on this event.'; end if;
  if lower(coalesce(r.role, '')) <> 'cook' then raise exception 'Only a cook can bring their dish and serve it.'; end if;
  update public.event_roster set detail = case when coalesce(p_on, false) then coalesce(detail, '{}'::jsonb) || jsonb_build_object('serves_too', true) else coalesce(detail, '{}'::jsonb) - 'serves_too' end where id = r.id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('event_roster', r.id::text, 'cook also serves', r.detail->>'serves_too', coalesce(r.person_name, '') || ': ' || case when coalesce(p_on, false) then 'brings their dish and serves it' else 'cooks only' end, v_who);
  return jsonb_build_object('id', r.id, 'serves_too', coalesce(p_on, false));
end $$;
revoke all on function public.wa342_cook_serves(bigint, boolean) from public, anon;
grant execute on function public.wa342_cook_serves(bigint, boolean) to authenticated, service_role;

-- f. The rule: servers needed for each cook. Saving it sets the usual server count from the usual cook count.
create or replace function public.wa342_rule_save(p_per_cook int)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_who text := coalesce(auth.jwt()->>'email', 'staff'); v_n int := greatest(0, least(10, coalesce(p_per_cook, 0))); v_cook int; v_old text;
begin
  if not public.wa256_can_text() then raise exception 'Only leaders, HR and admins can change the usual counts.'; end if;
  select value into v_old from public.app_config where key = 'vol_servers_per_cook';
  insert into public.app_config (key, value) values ('vol_servers_per_cook', v_n::text) on conflict (key) do update set value = excluded.value;
  select coalesce(target, 0) into v_cook from public.volunteer_role_guides where role = 'cook';
  if v_n > 0 then update public.volunteer_role_guides set target = coalesce(v_cook, 0) * v_n where role = 'server'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_role_guides', 'target', 'servers_per_cook', v_old, v_n::text, v_who);
  return jsonb_build_object('per_cook', v_n, 'cook', v_cook, 'server', case when v_n > 0 then coalesce(v_cook, 0) * v_n end);
end $$;
revoke all on function public.wa342_rule_save(int) from public, anon;
grant execute on function public.wa342_rule_save(int) to authenticated, service_role;

-- g. A confirmation round skips people who are still on the sign-up list (the same way it already skips people waiting for a role).
--    Montreal servings only (kind service): Toronto has no sign-up list, so its rounds are unchanged.
do $g$
declare d text; f1 text := $f$and (p_roster is not null or not (lower(coalesce(er.role, '')) = 'volunteer' and er.detail ? 'role_choices'))$f$;
        f2 text := $f$and not (lower(coalesce(er.role, '')) = 'volunteer' and er.detail ? 'role_choices')$f$; n int;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public' and p.proname = 'wa171_queue_confirms';
  if d is null then raise exception 'wa171_queue_confirms not found'; end if;
  if position('wa342_to_place' in d) = 0 then
    n := (length(d) - length(replace(d, f1, ''))) / length(f1);
    if n <> 1 then raise exception 'wa171_queue_confirms: the line to extend matches % times (expected 1)', n; end if;
    execute replace(d, f1, f1 || ' and (p_roster is not null or e.kind <> ''service'' or not public.wa342_to_place(er))');
  end if;
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public' and p.proname = 'wa340_round_people';
  if d is null then raise exception 'wa340_round_people not found'; end if;
  if position('wa342_to_place' in d) = 0 then
    n := (length(d) - length(replace(d, f2, ''))) / length(f2);
    if n < 1 then raise exception 'wa340_round_people: the line to extend was not found'; end if;
    execute replace(d, f2, f2 || ' and not (public.wa342_to_place(er) and exists (select 1 from public.volunteer_events e342 where e342.id = er.event_id and e342.kind = ''service''))');
  end if;
end $g$;

-- h. the data: at least 4 cooks, the rule (2 servers per cook), three community leads, and people the team has already written to are placed
insert into public.app_config (key, value) values ('vol_servers_per_cook', '2') on conflict (key) do update set value = excluded.value;
insert into public.app_config (key, value) values ('vol_cooks_max', '15'), ('vol_pickups_max', '6') on conflict (key) do nothing;
update public.volunteer_role_guides set target = 4 where role = 'cook';
update public.volunteer_role_guides set target = (select coalesce(g.target, 0) * 2 from public.volunteer_role_guides g where g.role = 'cook') where role = 'server';
update public.volunteer_role_guides set target = 3 where role = 'community_debrief';
update public.event_roster r set detail = coalesce(r.detail, '{}'::jsonb) || jsonb_build_object('placed_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'placed_by', 'wave342 (already written to)')
  from public.volunteer_events e
 where e.id = r.event_id and e.event_date >= (now() at time zone 'America/Toronto')::date
   and public.wa342_to_place(r) and lower(coalesce(r.role, '')) <> 'volunteer'
   and (r.detail ? 'confirm_emailed_at' or exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.direction = 'out' and q.kind in ('confirm', 'recruit') and q.status in ('queued', 'sent', 'blocked')));

$db342$;
  -- the page
  v_new := v;
  for i in 1..array_length(olds, 1) loop
    o := olds[i]; nw := news[i];
    n := (length(v_new) - length(replace(v_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'index.html: edit % matches % times (expected 1), nothing changed', i, n; end if;
    v_new := replace(v_new, o, nw);
  end loop;
  if md5(v) = '04a6163f23704c9a2c7ec0b845219ff2' and md5(v_new) <> 'd0e8555c5d2052edb0da59f45cf7bda5' then raise exception 'index.html: unexpected result %', md5(v_new); end if;
  if right(v_new, 8) <> E'</html>\n' then raise exception 'index.html: tail mismatch'; end if;
  sz := ceil(length(v_new) / 10.0);
  for i in 1..10 loop
    update public.site_files set content = substr(v_new, (i - 1) * sz + 1, sz), updated_at = now() where path = 'index.html' and part = i;
    if not found then raise exception 'index.html part % missing', i; end if;
  end loop;
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') <> md5(v_new) then raise exception 'index.html: post-check failed'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave342', md5(v), md5(v_new) || ': Volunteer Manager revised: Events, New event, sign-ups to place, confirmed of needed', 'Claude for Steel (14/11/26)');
end $pg$;

select public.call_edge('host-sync', '{}'::jsonb) as host_sync,
  (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') as hub_md5,
  (select count(*) from public.event_roster r join public.volunteer_events e on e.id = r.event_id where e.kind = 'service' and e.event_date >= current_date and public.wa342_to_place(r)) as signed_up_to_place;
