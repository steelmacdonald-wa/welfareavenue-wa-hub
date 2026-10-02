/* =====================================================================
   WA v171 Volunteers confirm by text (planned as wave169a), and the serving's format (30/09/26)
   =====================================================================
   Steel (29/09/26): "confirm with volunteers using a Quo text function in the hub. It sends them a personalized message to
   confirm their volunteer date and position via a link for them to press confirm on their phone which then opens up what
   they should expect in their position in Welfare Avenue branding and photos"; "confirmations should be 7 days before with
   a link to confirm which shows the dashboard it's confirmed". And the format on every upcoming serving (home-cooked or
   community kitchen).

   The database (wa169a_texts, renamed by wa171_texts) texts each volunteer 7 days before the serving (10 am Toronto; at once for anyone added
   later), from the ops line through Quo (quo-send v3), with their own link to hub.welfareavenue.com/c/<token> (build/c,
   the public confirm page). A tap, or a YES/NO text (quo-events, the Quo webhook), sets the roster row, so this segment
   shows it where the team looks:
   - the event page: a Texts card in the side rail (texts on or off, who is confirmed, by text or by hand, who was texted
     and is still waiting, who cannot make it, replies that came back, Text to confirm, Send me a test, Text settings);
     each roster card says how the person answered; the masthead says "x of y confirmed" and the format; the page
     refreshes itself every 30 seconds while it is open, so a tap shows up without reloading;
   - the Volunteering calendar: the format on each upcoming serving and a "format not set" gap;
   - Home and the Executive dashboard: the next serving's confirmations (staff only).
   Text settings: the mode (off, test, live; admins switch it, logged; the assistant never does), the test phone, and
   what volunteers see per role (the photo from the Photo library's ready photos, what to expect, bring and arrival, in
   English and French).
   wave172 (30/09/26): the roster cards also say what volunteers told us on their page (a cook's recipe, a server's
   donations, a new driver's car, how a photographer will share) and when the sign-up notice and the survey went; Text
   settings gains the survey (link, roles, hour) and each role's forms and guides (links).
   wave173 (30/09/26): a cook's pickup (neighbourhood and address) or drop-off (and staying to serve) on their card; Text
   settings holds the pickup areas and the drop-off.
   wave174 (30/09/26, f_w174.js): the Survey and itinerary card on the event (the start time, each role's arrival, the
   drivers' parts, previews, the survey answers); Text settings gains the itineraries and each role's survey questions.
   wave175 (30/09/26, g_w175.js): volunteer accounts (hub.welfareavenue.com/me): tags for self sign-ups and accounts; Text
   settings gains the sign-up settings and a check of an hours letter's reference.
   wave191k (01/10/26, c_event.js): Send me a test picks the role and the person (it always sent the first on the list, a
   cook), shows their text and their page, and keeps the exact text that went out.
   ===================================================================== */
(function () {
  if (window.__wa171) return; window.__wa171 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB', INK = '#1F201E', MUTED = '#797773';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var ST = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/';
  var FORMATS = { home_cooked: 'Home-cooked', community_kitchen: 'Community kitchen' };
  var MODES = { off: 'Texts off', test: 'Test mode', live: 'Texts on' };
  var ROLES = ['team_leader', 'cook', 'driver', 'server', 'dishwasher', 'photographer', 'community_talker', 'community_debrief', 'volunteer'];
  var S = { can: null, canAt: 0, mode: null, modeAt: 0, cfg: {}, msgs: {}, msgsAt: {}, sig: {}, poll: null, busy: false,
            next: null, nextAt: 0, guides: null, photos: null, set: { role: 'cook' }, dec: null };

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function lower(s) { return String(s || '').trim().toLowerCase(); }
  function staff() { try { return typeof isStaff === 'function' ? isStaff() : false; } catch (e) { return false; } }
  function todayIso() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function addDays(iso, n) { var d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function fmtDay(iso, long) { if (!iso) return ''; try { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-CA', long ? { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' } : { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return String(iso); } }
  function fmtWhen(ts) { if (!ts) return ''; try { return new Date(ts).toLocaleString('en-CA', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return String(ts).slice(0, 16); } }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  var ONE = { team_leader: 'Team leader', cook: 'Cook', driver: 'Driver', server: 'Server', dishwasher: 'Dishwasher', photographer: 'Photographer', community_talker: 'Community welcome', community_debrief: 'Community lead', volunteer: 'Volunteer' };
  function one(r) { return ONE[r] || String(r || 'volunteer').replace(/_/g, ' ').replace(/^./, function (m) { return m.toUpperCase(); }); }
  function roleLabel(r) { try { return typeof waVolRoleLabel === 'function' ? waVolRoleLabel(r) : r; } catch (e) { return r; } }
  function isConf(r) { return lower(r.status) === 'confirmed' || r.confirm_status === 'confirmed'; }
  function isDecl(r) { return lower(r.status) === 'unavailable' || r.confirm_status === 'declined'; }
  function isOff(r) { return lower(r.status) === 'cancelled'; }
  function via(r) { var c = r.confirm || {}; return c.via || (r.confirm_status ? 'link' : ''); }
  function phoneOf(r) {
    var d = r.detail || {}; if (d.phone) return String(d.phone);
    try { var p = (WA_VOL_PEOPLE || []).filter(function (x) { return x.id === r.person_id; })[0]; if (p && (p.phones || [])[0]) return String(p.phones[0]); } catch (e) { /* fine */ }
    return '';
  }

  var CSS = ''
    + '.w171tag{display:block;margin-top:5px;font-size:10.5px;line-height:1.3;font-weight:700;letter-spacing:.2px;border-radius:8px;padding:3px 7px;font-family:' + BODY + ';}'
    + '.w171tag.ok{background:rgba(42,140,122,.14);color:#1c6b5d;}'
    + '.w171tag.no{background:rgba(179,64,47,.1);color:' + FLAG + ';}'
    + '.w171tag.wait{background:rgba(220,165,39,.2);color:' + INK + ';}'
    + '.w171tag.mute{background:rgba(16,63,57,.06);color:' + MUTED + ';font-weight:600;}'
    + '.w171pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 10px;font-size:11.5px;font-weight:700;letter-spacing:.3px;font-family:' + BODY + ';}'
    + '#w119 .mast .w171pill{background:rgba(255,250,242,.14);color:' + CREAM + ';border:1px solid rgba(255,250,242,.3);}'
    + '#w119 .mast .w171pill.gold{background:' + GOLD + ';color:' + INK + ';border-color:' + GOLD + ';}'
    + '#w119 .mast .w171pill[data-w171fmt]{cursor:pointer;}'
    + '.w171card h4{display:flex;align-items:center;gap:8px;}'
    + '.w171card .mode{margin-left:auto;font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;border-radius:999px;padding:2px 9px;font-family:' + BODY + ';}'
    + '.w171card .mode.off{background:rgba(16,63,57,.08);color:' + MUTED + ';}'
    + '.w171card .mode.test{background:rgba(111,100,171,.16);color:' + PURPLE + ';}'
    + '.w171card .mode.live{background:rgba(42,140,122,.18);color:#1c6b5d;}'
    + '.w171nums{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0 10px;}'
    + '.w171nums div{background:rgba(16,63,57,.05);border-radius:10px;padding:7px 6px;text-align:center;}'
    + '.w171nums b{display:block;font-family:' + HEAD + ';font-size:22px;line-height:1;color:' + GREEN + ';}'
    + '.w171nums span{display:block;font-size:10.5px;color:' + MUTED + ';margin-top:3px;line-height:1.2;}'
    + '.w171note{font-size:12px;color:' + MUTED + ';margin:0 0 8px;line-height:1.45;}'
    + '.w171btns{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 4px;}'
    + '.w171btn{border:0;border-radius:999px;padding:7px 14px;font:700 12.5px ' + BODY + ';background:' + GOLD + ';color:' + INK + ';cursor:pointer;}'
    + '.w171btn.ghost{background:transparent;border:1.5px solid rgba(16,63,57,.25);color:' + GREEN + ';}'
    + '.w171btn[disabled]{opacity:.5;cursor:not-allowed;}'
    + '.w171rep{border-top:1px solid rgba(16,63,57,.1);padding:7px 0;font-size:12.5px;}'
    + '.w171rep .h{display:flex;gap:6px;align-items:center;flex-wrap:wrap;color:' + MUTED + ';font-size:11.5px;}'
    + '.w171rep .h b{color:' + INK + ';font-size:12.5px;}'
    + '.w171rep p{margin:3px 0 0;white-space:pre-wrap;word-break:break-word;}'
    + '.w171h{font:700 11px ' + BODY + ';letter-spacing:1.2px;text-transform:uppercase;color:' + MUTED + ';margin:12px 0 4px;}'
    + '.w171m h3{font-family:' + HEAD + ';text-transform:uppercase;letter-spacing:.3px;color:' + GREEN + ';font-size:26px;margin:0 0 4px;}'
    + '.w171m .sub{color:' + MUTED + ';font-size:13px;margin:0 0 12px;}'
    + '.w171m .row{display:flex;gap:10px;align-items:center;padding:7px 0;border-top:1px solid rgba(16,63,57,.1);font-size:13.5px;}'
    + '.w171m .row input[type=checkbox]{width:17px;height:17px;accent-color:' + GREEN + ';flex:none;}'
    + '.w171m .row .who{flex:1;min-width:0;}'
    + '.w171m .row .who small{display:block;color:' + MUTED + ';font-size:11.5px;}'
    + '.w171m .prev{background:rgba(16,63,57,.05);border-radius:12px;padding:10px 12px;font-size:13px;margin:10px 0;white-space:pre-wrap;}'
    + '.w171m label.f{display:block;font-size:12px;font-weight:700;color:' + MUTED + ';margin:10px 0 4px;letter-spacing:.3px;}'
    + '.w171m input[type=text],.w171m textarea,.w171m select{width:100%;box-sizing:border-box;font:14px ' + BODY + ';border:1.5px solid rgba(16,63,57,.18);border-radius:10px;padding:8px 10px;background:' + CREAM + ';color:' + INK + ';}'
    + '.w171m textarea{min-height:92px;resize:vertical;}'
    + '.w171m .two{display:grid;grid-template-columns:1fr 1fr;gap:10px;}'
    + '@media (max-width:620px){.w171m .two{grid-template-columns:1fr;}.w171nums{grid-template-columns:repeat(2,1fr);}}'
    + '.w171m .modes{display:grid;gap:8px;margin:6px 0;}'
    + '.w171m .modes label{display:flex;gap:10px;align-items:flex-start;border:1.5px solid rgba(16,63,57,.16);border-radius:12px;padding:9px 11px;cursor:pointer;font-size:13.5px;}'
    + '.w171m .modes label.on{border-color:' + GREEN + ';background:rgba(16,63,57,.04);}'
    + '.w171m .modes small{display:block;color:' + MUTED + ';font-size:12px;}'
    + '.w171m .pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px;max-height:220px;overflow:auto;margin:4px 0;}'
    + '.w171m .pics button{border:2px solid transparent;border-radius:10px;padding:0;height:66px;background:' + GREEN + ' center/cover no-repeat;cursor:pointer;}'
    + '.w171m .pics button.on{border-color:' + GOLD + ';box-shadow:0 0 0 2px ' + GOLD + ';}'
    + '.w171m .foot{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;}'
    + '.w171m .warn{background:rgba(179,64,47,.08);color:#7e2b1f;border-radius:10px;padding:8px 10px;font-size:13px;margin:8px 0;}'
    + '.w171m .info{background:rgba(220,165,39,.18);border-radius:10px;padding:8px 10px;font-size:13px;margin:8px 0;}'
    /* wave191k: Send me a test, as any role */
    + '.w171tm .roles{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:6px;margin:4px 0 2px;}'
    + '.w171tm .roles label{position:relative;display:flex;flex-direction:column;gap:1px;border:1.5px solid rgba(16,63,57,.16);border-radius:12px;padding:8px 10px;cursor:pointer;background:' + CREAM + ';}'
    + '.w171tm .roles label.on{border-color:' + GREEN + ';background:rgba(16,63,57,.05);box-shadow:inset 0 0 0 1px ' + GREEN + ';}'
    + '.w171tm .roles label:focus-within{outline:2px solid ' + GOLD + ';outline-offset:1px;}'
    + '.w171tm .roles input{position:absolute;opacity:0;width:1px;height:1px;margin:0;}'
    + '.w171tm .roles b{font-size:13.5px;color:' + GREEN + ';}.w171tm .roles small{color:' + MUTED + ';font-size:11.5px;}'
    + '.w171tm .roles i{position:absolute;top:7px;right:9px;font-style:normal;font-size:10.5px;font-weight:700;color:#1c6b5d;}'
    + '.w171tm .sms{background:#E9E9EB;color:#111;border-radius:18px 18px 18px 4px;padding:10px 13px;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;white-space:pre-wrap;max-width:380px;margin:12px 0 4px;word-break:break-word;}'
    + '.w171tm .sent{font-size:12.5px;color:#1c6b5d;font-weight:700;margin:4px 0 0;}.w171tm .sent.no{color:' + FLAG + ';}'
    + '.w171fmt.cal{display:inline-block;margin:4px 4px 0 0;font-size:10.5px;font-weight:700;border-radius:999px;padding:1px 8px;background:rgba(111,100,171,.14);color:' + PURPLE + ';}'
    + '#w171next{border-radius:18px;background:' + GREEN + ';color:' + CREAM + ';padding:16px 18px;margin:0 0 16px;position:relative;overflow:hidden;font-family:' + BODY + ';}'
    + '#w171next:after{content:"";position:absolute;right:-60px;top:-80px;width:220px;height:220px;border-radius:50%;background:radial-gradient(closest-side,rgba(220,165,39,.35),rgba(220,165,39,0));pointer-events:none;}'
    + '#w171next .k{font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:' + GOLD + ';font-weight:700;}'
    + '#w171next h3{font-family:' + HEAD + ';font-size:26px;margin:2px 0 6px;color:' + CREAM + ';text-transform:uppercase;letter-spacing:.3px;}'
    + '#w171next .bar{height:8px;border-radius:8px;background:rgba(255,250,242,.18);overflow:hidden;margin:8px 0;max-width:420px;}'
    + '#w171next .bar i{display:block;height:100%;background:' + GOLD + ';border-radius:8px;}'
    + '#w171next p{margin:4px 0;font-size:13px;color:rgba(255,250,242,.88);position:relative;z-index:1;}'
    + '#w171next .go{position:relative;z-index:1;margin-top:8px;border:0;border-radius:999px;padding:7px 14px;font:700 12.5px ' + BODY + ';background:' + GOLD + ';color:' + INK + ';cursor:pointer;}';
  if (!document.getElementById('wa171css')) { var st = document.createElement('style'); st.id = 'wa171css'; st.textContent = CSS; document.head.appendChild(st); }
