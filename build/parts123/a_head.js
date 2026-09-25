/* =====================================================================
   WA v123 Requests and the team inbox (25/09/26)
   =====================================================================
   Steel: "you need to redo the Request tab, it's hard to navigate and I
   want to make sure requests are also sent to the department's channel
   as well as have an inbox on the department's overview page showing
   the requests that came in via requests and via Hub Inbox (jev decides
   whether to notify team or not)".

   The Requests page (#requests) becomes four simple views:
   - New request: pick the team, pick what you need (or "something
     else"), fill in a short form. A side panel says where it goes (the
     team inbox, the Slack channel, who picks it up) and how it moves.
   - My requests: everything you asked for, with a progress bar per
     request and the status the team set.
   - Team inbox: what came in for a team, in one list: requests, emails
     the Hub inbox filed for the team (with Jev's call on whether the
     team was pinged), and asks spotted in meetings to accept or dismiss.
   - All requests (leaders) and Slack settings (admins): each team's
     channel, fallbacks, test posts, and how emails are handled.
   Every request and email opens in a sheet: status steps, assign, done,
   notes (mirrored into the Slack thread), the Slack link, the activity.
   Each department's overview page gets a Team inbox card at the top.
   The team-inbox edge function does the Slack side from database
   triggers (wa123_requests_inbox): a post in the team channel for every
   new request, thread replies for status, done and notes, a DM to the
   requester when it is done, and Jev's decision for each filed email.
   Deep links: #requests/new[/team[/type]], /mine, /team[/team], /all,
   /settings, /r/<request id>, /m/<email id>.
   ===================================================================== */
(function () {
  if (window.__wa123) return; window.__wa123 = true;
  var T = window.WA_TEAMS || { order: ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board'], labels: {}, short: {} };
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB', INK = '#1F201E', STEM = '#2B6F55';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var SH2 = '0 2px 6px rgba(16,63,57,.08),0 18px 44px rgba(16,63,57,.12)';
  var DEFAULT_STATUSES = ['Requested', 'In progress', 'Done'];
  var DEFAULT_CHANNELS = { opsmtl: ['operations-mtl'], progdev: ['program-development'], opsto: ['toronto-operations', 'general-toronto'], marketing: ['social-media'], fundraising: ['fundraising'], hr: ['human-resources'], board: ['board-of-directors'] };
  /* what each team is asked for, in a few words (the tiles on the first step) */
  var TEAM_BLURB = {
    opsmtl: 'Supplies, volunteers and transport for servings',
    progdev: 'Program data, research, partner coordination',
    opsto: 'Help with anything happening in Toronto',
    marketing: 'Social posts, emails, design, printing, event coverage',
    fundraising: 'Reimbursements, purchases, grant information',
    hr: 'Hiring, onboarding, access to tools, time off',
    board: 'Consent and media release, governance questions'
  };
  var MAIL_KIND = {
    invoice: { l: 'Invoice', c: '#B9851B', icon: 'receipt' },
    meeting_summary: { l: 'Meeting summary', c: PURPLE, icon: 'mic' },
    update: { l: 'Email', c: TEAL, icon: 'mail' },
    application: { l: 'Job application', c: '#3a6ea5', icon: 'userplus' }
  };
  var WHY = { act: 'someone needs to act', deadline: 'it has a deadline', fyi: 'good to know', record: 'for the record' };
  var DATE_KEYS = /^(needed_by|send_date|event_date|first_day)$/;

  /* ---------- icons (one stroke family, 24 grid) ---------- */
  var P = {
    inbox: '<path d="M4 13h4l1.5 2.5h5L16 13h4"/><path d="M5.5 5.5h13L21 13v5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-5z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    chev: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17.2v.3"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.9-3.9 4-6 7.5-6s6.6 2.1 7.5 6"/>',
    userplus: '<circle cx="10" cy="8.5" r="3.6"/><path d="M3.5 20c.8-3.7 3.6-5.8 6.5-5.8 1.5 0 2.9.5 4 1.4M18 12v6M15 15h6"/>',
    hash: '<path d="M9.5 3.5 7.5 20.5M16.5 3.5l-2 17M4.5 9h16M3.5 15h16"/>',
    spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/><path d="M18.5 3.5v3M17 5h3"/>',
    note: '<path d="M5 4.5h14v10.5l-5 5H5z"/><path d="M14 20v-5h5M8.5 9h7M8.5 12.5h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/>',
    megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>',
    pen: '<path d="m4 20 1.2-4.6L15.8 4.8a2.3 2.3 0 0 1 3.3 3.3L8.6 18.8z"/><path d="m14 6.6 3.3 3.3"/>',
    camera: '<path d="M4 8h3.2l1.6-2.5h6.4L16.8 8H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
    printer: '<path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6H7z"/>',
    receipt: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6M9 12h6M9 15.5h3.5"/>',
    cart: '<circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/><path d="M3 4h2.5l2.3 11h10.4L20.5 7.5H6.4"/>',
    doc: '<path d="M6.5 3.5h7L18 8v12.5h-11.5z"/><path d="M13.5 3.5V8H18M9 12.5h6M9 16h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M18 5l2 2"/>',
    box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    people: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.3 3.1-5.2 6-5.2s5.3 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.3c2.3.2 4 1.8 4.5 4.7"/>',
    truck: '<path d="M2.5 6.5h11v9.5h-11zM13.5 10H18l3.5 3.5V16h-8"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    pot: '<path d="M4 10h16v5.5A4.5 4.5 0 0 1 15.5 20h-7A4.5 4.5 0 0 1 4 15.5z"/><path d="M2.5 10h19M9 6.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5"/>',
    sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4 2.7-6.5 7-6.5 0 4.3-2.7 6.5-7 6.5zM12 14c0-3.1-2.2-5.2-5.8-5.2 0 3.4 2.2 5.2 5.8 5.2z"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    columns: '<path d="M3 20.5h18M4.5 17.5h15M6 10v7.5M10 10v7.5M14 10v7.5M18 10v7.5M3.5 8.5 12 3.5l8.5 5z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    undo: '<path d="M9 14 4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'
  };
  function I(name, cls) { return '<svg class="w123i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.spark) + '</svg>'; }
  var TYPE_ICON = { 'post-request': 'megaphone', 'email-request': 'mail', 'design-request': 'pen', 'event-coverage': 'camera', 'print-request': 'printer', 'reimbursement': 'receipt', 'purchase-order': 'cart', 'grant-info': 'doc', 'time-off': 'sun', 'hiring-request': 'userplus', 'onboarding-request': 'flag', 'access-request': 'key', 'event-supplies': 'box', 'volunteer-support': 'people', 'transport-request': 'truck', 'media-release': 'shield' };
  var TEAM_ICON = { opsmtl: 'pot', progdev: 'sprout', opsto: 'pin', marketing: 'megaphone', fundraising: 'heart', hr: 'people', board: 'columns' };

  /* ---------- small helpers ---------- */
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function cap(s) { s = String(s || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function now() { return Date.now(); }
  function isoDay(d) { var x = d ? new Date(d) : new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function asDate(v) { if (!v) return null; var s = String(v); var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s); return isNaN(d.getTime()) ? null : d; }
  function fmtDay(v) { var d = asDate(v); if (!d) return ''; return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); }
  function fmtLong(v) { var d = asDate(v); if (!d) return ''; return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }); }
  function fmtWhen(v) { var d = asDate(v); if (!d) return ''; return d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function ago(v) {
    var d = asDate(v); if (!d) return '';
    var m = Math.round((now() - d.getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    var dd = Math.round(h / 24); if (dd < 7) return dd + (dd === 1 ? ' day ago' : ' days ago');
    return fmtDay(d);
  }
  function daysUntil(v) { var d = asDate(v); if (!d) return null; var t = new Date(isoDay() + 'T12:00:00'); return Math.round((new Date(isoDay(d) + 'T12:00:00').getTime() - t.getTime()) / 86400000); }
  function dueText(v) {
    var n = daysUntil(v); if (n === null) return '';
    if (n < 0) return 'overdue by ' + (-n) + (n === -1 ? ' day' : ' days');
    if (n === 0) return 'needed today'; if (n === 1) return 'needed tomorrow';
    if (n < 7) return 'needed in ' + n + ' days';
    return 'needed by ' + fmtDay(v);
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* fine */ } }
  function reduced() { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function initials(n) { var p = String(n || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function hue(n) { var h = 0, s = String(n || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return ['#103F39', '#6F64AB', '#B9851B', '#2A8C7A', '#c87a2f', '#3a6ea5', '#B3402F'][h % 7]; }
  function avatar(name, size) { size = size || 24; return '<span class="w123av" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.42) + 'px;background:' + hue(name) + '" title="' + E(name) + '">' + E(initials(name)) + '</span>'; }
