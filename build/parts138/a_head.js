/* =====================================================================
   WA v138 @mentions: bring someone in, and they hear about it on Slack (26/09/26)
   =====================================================================
   Steel: "I want the ability to @ someone anywhere in the hub and it will send them a direct message
   from me in Slack - no asking this is done automatically. I'd like the same capabilities for
   everyone at the charity. So if Ian comments @joy on a content task on slack Ian will have sent
   her a message of the comment and link to the task on the hub"

   - Type @ in a task comment or description, a goal comment, a request note, a team update, a
     decision, a committee note, a project description or a Content calendar post's notes: a list of
     people opens (the roster, with photos and teams); pick one with the keys or the mouse.
   - Under the field, a line says who will get a Slack message and how (as you, or from the Hub with
     your name until you connect Slack). Nothing to confirm: saving is sending.
   - The database does the sending (wa138_mentions): a trigger on each of those places files the new
     mentions in hub_mentions, and notify (comment_mention) sends the DM with the text and a link.
   - Settings, Connections: "Send @mentions as you" connects your own Slack account (slack-connect,
     Slack's sign-in page), and lists your recent mentions with what happened to each. Settings,
     Notifications: "Someone @mentions me in the Hub" can be switched off.
   - Mentions show as a highlighted name in task comments, goal comments and request notes.
   ===================================================================== */
(function () {
  if (window.__wa138) return; window.__wa138 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', INK = '#1F201E', MUTED = '#797773', SLACK = '#4A154B';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var PAL = [['#103F39', '#FFFAF2'], ['#DCA527', '#1F201E'], ['#2A8C7A', '#FFFAF2'], ['#E9DCC4', '#103F39'], ['#8C6A2E', '#FFFAF2'], ['#B3402F', '#FFFAF2']];

  /* the places people write that send @mentions (each has a trigger in wa138_mentions) */
  var FIELDS = [
    { sel: '#w116cmtx', kind: 'comment' },                               /* task drawer comment -> task_comments */
    { sel: '#w51new', kind: 'comment' },                                 /* task comments window -> task_comments */
    { sel: '#w116ted', kind: 'desc' },                                   /* task description (rich) -> dept_tasks */
    { sel: 'input[data-glci]', kind: 'comment' },                        /* goal comment -> goal_comments */
    { sel: 'textarea[data-w123note]', kind: 'comment' },                 /* request note -> request_notes */
    { sel: '#w116ut', kind: 'save' },                                    /* team update -> dept_updates */
    { sel: '#dmMove', kind: 'save' }, { sel: '#ddNote', kind: 'save' },  /* decision -> decisions */
    { sel: '#w116pd', kind: 'save' }, { sel: '#w116ed', kind: 'save' },  /* project description -> projects */
    { sel: '#w121notes', kind: 'save' },                                 /* Content calendar notes for the team -> content_posts */
    { sel: '#w126sheet textarea[name="summary"]', kind: 'save', priv: true },          /* committee note -> board_touchpoints */
    { sel: '#w126sheet textarea[name="recommendation"]', kind: 'save', priv: true }
  ];
  var FIELD_SEL = FIELDS.map(function (f) { return f.sel; }).join(',');
  function fieldOf(el) {
    if (!el || !el.matches) return null;
    for (var i = 0; i < FIELDS.length; i++) { try { if (el.matches(FIELDS[i].sel)) return FIELDS[i]; } catch (e) { /* fine */ } }
    return null;
  }

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function myEmail() { try { return lower(USER && USER.email); } catch (e) { return ''; } }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  /* anyone signed in can mention (directors write committee notes too); connecting Slack is for staff (slack-connect checks) */
  function signedIn() { return !!myEmail(); }
  function teamShort(d) {
    try { return (window.WA_TEAMS && WA_TEAMS.short && WA_TEAMS.short[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || ''; } catch (e) { return ''; }
  }

  /* ---------- the roster the page already holds (team_members, active) ---------- */
  var R = { src: null, list: [], byLen: [] };
  function roster() {
    var src = null;
    try { src = (typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || null; } catch (e) { src = null; }
    if (src !== R.src) {
      R.src = src;
      R.list = (src || []).filter(function (m) { return m && m.active !== false && String(m.name || '').trim(); });
      /* the database picks the longest name after the @ (then the lowest id): the page does the same */
      R.byLen = R.list.slice().sort(function (a, b) { return String(b.name).trim().length - String(a.name).trim().length || Number(a.id) - Number(b.id); });
    }
    return R.list;
  }
  function meRow() { var em = myEmail(); return roster().filter(function (m) { return lower(m.email) === em; })[0] || null; }
  function initials(name) { var p = String(name || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function palette(name) { var h = 0, s = String(name || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PAL[h % PAL.length]; }
  function avatar(m, size) {
    var st = 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.4) + 'px;';
    if (m && m.avatar_url) return '<span class="w138av" style="' + st + '"><img src="' + E(m.avatar_url) + '" alt="" loading="lazy" /></span>';
    var p = palette(m && m.name);
    return '<span class="w138av" style="' + st + 'background:' + p[0] + ';color:' + p[1] + '">' + E(initials(m && m.name)) + '</span>';
  }

  /* who a text @mentions, exactly as the database reads it (wa_mentioned_members): after each @ that is not part of an
     email address, the longest roster name that follows and ends on a word boundary (@joy.dumansi is a handle) */
  var WORD = /[0-9A-Za-z_À-ɏ]/;
  function mentioned(text) {
    var t = String(text || ''), low = t.toLowerCase(), out = [], seen = {};
    roster();
    if (t.indexOf('@') < 0) return out;
    for (var i = 0; i < t.length && i < 8000; i++) {
      if (t.charAt(i) !== '@') continue;
      if (i > 0 && (WORD.test(t.charAt(i - 1)) || t.charAt(i - 1) === '.')) continue;
      var rest = low.slice(i + 1, i + 61);
      for (var j = 0; j < R.byLen.length; j++) {
        var m = R.byLen[j], n = String(m.name).trim().toLowerCase();
        if (rest.indexOf(n) !== 0) continue;
        var nx = rest.charAt(n.length), nx2 = rest.charAt(n.length + 1);
        if (nx && WORD.test(nx)) continue;
        if (nx === '.' && nx2 && WORD.test(nx2)) continue;
        if (!seen[m.id]) { seen[m.id] = 1; out.push(m); }
        break;
      }
    }
    return out;
  }
  function names(list) {
    var n = list.map(function (m) { return String(m.name).trim(); });
    if (n.length <= 1) return n.join('');
    return n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  }

