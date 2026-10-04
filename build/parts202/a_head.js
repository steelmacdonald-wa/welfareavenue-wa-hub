/* =====================================================================
   WA v202 (03/10/26): the email studio. CRM > Studio (#crm/studio).
   =====================================================================
   Steel (03/10/26), with the Rally Paper 2026 emails as the example: "For our emails, I'd like to be able to produce these
   types of emails for one-off emails and template emails going forward for both our volunteers and donors." Then: "These
   are just examples of what we used at the rally paper, we need to create templates that follow the same brand guidelines.
   To start an email they should be given the option to put in what they wrote, and the photos for the email and then the
   AI puts it together. Or they use a template with their written information and the hub ai puts it together in an html
   structured email. I want there to be a few options they could take to build emails. Also, if there's missing
   information, I want the hub to prompt the user to ensure they've got all necessary and correct information for the
   newsletter. I'd like them to also have created emails used for automation workflows." His shelves: volunteers (welcome
   and serving; call-outs and events) and donors (thanks and impact; appeals and events). Where they go: saved templates,
   one-off to a list, one-off to one person.

   - Three ways to start: Tell the Hub (what you wrote and your photos; the Hub puts it together), Start from a template
     (the template plus your details; the Hub fills it in, or you do), Build it yourself (blocks).
   - The Hub checks before anything goes out: its own questions about missing or doubtful details (a date that is not that
     weekday, a link nobody gave, a number it would have to invent), and the studio's checks (anything left in [brackets],
     the subject, links, alt text, dates, Welfare Avenue's words and no em dashes, the CASL kind).
   - The editor: blocks in the brand (a headline with the E that moves and a doodle, text, details, a dot list, the gold
     button, photos, a video card, the green band of links, a quote, numbers, the sign-off) with the email beside it as it
     will look (mail-send's own layout, ported: MAIL202.layout), on a computer or a phone. Ask the Hub to change it.
   - Send: a test to yourself, one person (the permission rule decides, mail_mode still gates), a list (a campaign draft
     the Campaigns tab checks and sends), or save it as a template, which the automations' "Saved email" list picks up.
   - wave203 (04/10/26), the voices: Steel, "draft a WA voice code from the brand guide and keep mine too as options". Welfare
     Avenue (the house voice code, app_config mail_voice_wa, admins edit it in the Voices panel) or My voice (the writer's own
     guide from Your inbox). g2_voices.js; the choice is saved with the email (design.voice), never the guide's text.
   - wave204 (04/10/26), Soraya Tyree's review: Undo and Redo for every change, with Cmd/Ctrl+Z (l_history.js), and a way back
     from the Hub's draft to what you wrote or your details; a moving preview for the video card, a few silent seconds of your
     own video made into an animated GIF in the browser (m_gif.js, m_moving.js), since inboxes do not play video; text pasted
     from a document keeps its bold, links and paragraphs, and B and Link buttons mark text without typing the symbols (n_text.js).
     Steel, the same day: the costs in the studio "so they know how much they are spending" (o_costs.js: each email's AI spend,
     about 2 cents by every AI button, the What it costs panel with the month's total), and "come with their content first. It
     is unacceptable to only use AI. Bad input = bad output." (p_content.js: 40 words of your own before Tell the Hub, every
     detail before the Hub fills a template, and a prompt that never pads thin input).
   Data: crm_email_templates (design, one_off and the shelf columns; wa202_email_studio), written only through
   email_studio_save and email_studio_remove. AI through the llm router (x-wa-task email_studio). Photos from the Photo
   library (wa_photos_list, ready ones first) or uploaded to content-images/email/. Nothing here sends on its own, and
   nothing switches mail_mode.
   ===================================================================== */
(function () {
  if (window.__wa202) return; window.__wa202 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', PURPLE = '#6F64AB', INK = '#1F201E', FLAG = '#B3402F', TEAL = '#2A8C7A', MUTED = '#797773';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif", HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var KIND = {
    transactional: { l: 'A thank-you, reminder or confirmation', s: 'About their sign-up, serving or gift. Goes to anyone with a working address.', short: 'Confirmation' },
    volunteer: { l: 'A volunteer call-out', s: 'Asking volunteers to come. Goes to everyone on the list who has not unsubscribed.', short: 'Call-out' },
    newsletter: { l: 'News', s: 'For people who said yes to our news, or gave or served in the last two years.', short: 'News' },
    fundraising: { l: 'An appeal for gifts', s: 'Asking for gifts. The same people as news (the fundraising exemption is off).', short: 'Appeal' }
  };
  var AUD = { volunteers: 'Volunteers', donors: 'Donors', everyone: 'Everyone' };
  var SHELF = [
    ['volunteers_welcome', 'Volunteers: welcome and serving'], ['volunteers_callouts', 'Volunteers: call-outs and events'],
    ['donors_thanks', 'Donors: thanks and impact'], ['donors_appeals', 'Donors: appeals and events'], ['other', 'Other templates']
  ];
  var SS = {
    view: 'home', key: null, to: null, d: null, dirty: false, saving: false, savedAt: null, msg: '', err: '', busy: '',
    filter: 'all', open: {}, device: 'desktop', tab: 'edit', questions: [], answers: {}, notes: '', change: '',
    start: { brief: '', audience: 'volunteers', kind: 'volunteer', lang: 'en', photos: [], tpl: null, asks: {}, extra: '', voice: 'wa' },
    send: null, pick: null, lib: null, libQ: '', libBusy: false, uploads: 0, confirmDel: false, peek: null, allRecent: false, ro: false, pendingKey: null,
    saveNote: '', undo: null, root: null, saveAgain: false, savingP: null,
    hist: { past: [], future: [], cur: null, field: null, at: 0 }, back: null, startNote: null, mv: null   /* wave204 */
  };

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function str(s) { return String(s == null ? '' : s); }
  function lower(s) { return str(s).trim().toLowerCase(); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function plural(n, one, many) { return Number(n).toLocaleString('en-CA') + ' ' + (Number(n) === 1 ? one : many); }
  function myEmail() { try { return lower(USER && USER.email); } catch (e) { return ''; } }
  function myName() {
    try { var n = (USER && USER.user_metadata && (USER.user_metadata.full_name || USER.user_metadata.name)) || ''; if (n) return String(n); } catch (e) { /* fine */ }
    return myEmail().split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, function (x) { return x.toUpperCase(); });
  }
  function wRole() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function amAdmin() { return wRole() === 'admin' || ['steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com', 'suhaib.abdillahi@welfareavenue.com'].indexOf(myEmail()) >= 0; }
  function canEdit(t) { if (!t || !t.design) return false; if (amAdmin()) return true; return t.created_by && t.created_by !== 'starter' && lower(t.created_by) === myEmail(); }
  function crm() { return window.w152 || null; }
  function cstate() { var c = crm(); try { return c ? c.state() : {}; } catch (e) { return {}; } }
  function templates() { return (cstate().templates || []).slice(); }
  function tplByKey(k) { return templates().filter(function (t) { return t.key === k; })[0] || null; }
  function contacts() { return cstate().contacts || []; }
  function lists() { return cstate().lists || []; }
  function go(h) { if (location.hash === h) { try { if (typeof applyHash === 'function') applyHash(); } catch (e) { /* fine */ } } else location.hash = h; }
  function setHash(h) { try { history.replaceState(null, '', h); } catch (e) { /* fine */ } }
  function msgOf(err) { var m = str((err && (err.message || err.error_description || err.error)) || err || ''); return m || 'Something went wrong.'; }
  var WORDS = { not_allowed: 'Saving designs is for the team with the CRM.', not_found: 'That email is gone.', not_studio: 'That is one of the Email tab’s system templates.', not_yours: 'Only the person who made it, or an admin, can change it. Copy it instead.',
    subject: 'It needs a subject first.', body: 'The email is empty or too long.', design: 'The design did not save.', kind: 'Pick what kind of email it is.' };
  function words(e) { var m = msgOf(e); var k = Object.keys(WORDS).filter(function (w) { return m.indexOf(w) >= 0; })[0]; return k ? WORDS[k] : m; }
  async function rpc(fn, args) { try { var r = await db.rpc(fn, args || {}); return r || {}; } catch (e) { return { error: e }; } }
  /* mail-send through the CRM's own caller when it is there (the function's own words on a refusal) */
  function mailFn(action, body) {
    var c = crm(); if (c && c.mailFn) return c.mailFn(action, body);
    return Promise.resolve(db.functions.invoke('mail-send', { body: Object.assign({ action: action }, body || {}) })).then(function (r) { return r && r.error ? { error: msgOf(r.error) } : ((r && r.data) || {}); }, function (e) { return { error: msgOf(e) }; });
  }
  function mailSettings() { var c = crm(); var st = c && c.mail && c.mail.st; return st && st.settings ? st.settings : null; }
  function loadMailSettings() {
    var c = crm(); if (mailSettings()) return Promise.resolve(mailSettings());
    return mailFn('settings').then(function (r) { if (r && !r.error && c && c.mail) c.mail.st = r; return r && r.settings ? r.settings : null; });
  }
  function reloadTemplates() { var c = crm(); return c && c.load ? Promise.resolve(c.load('templates', true)) : Promise.resolve(); }
  function fmtDay(ts) { if (!ts) return ''; try { return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return str(ts).slice(0, 10); } }
  function ago(ts) {
    if (!ts) return '';
    var m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    var d = Math.round(h / 24); return d <= 1 ? 'yesterday' : d < 14 ? d + ' days ago' : fmtDay(ts);
  }
  var IC = {
    spark: '<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z"/>',
    layout: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9 9.5v10"/>',
    blocks: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><path d="M16.5 13.5v6M13.5 16.5h6"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/>',
    send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5z"/>', person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    list: '<path d="M8 7h12M8 12h12M8 17h12"/><circle cx="4.5" cy="7" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17" r="1"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>', copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-3a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>', up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4.5 18 5.5-5.5 4 4 2.5-2.5 3 3"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4.5 16v3.5h15V16"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>', desktop: '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    voice: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z"/><path d="M8 10h8M8 13h5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>', bolt: '<path d="M13 3 5 13.5h6L10 21l8-11h-6z"/>', chev: '<path d="m9 5 7 7-7 7"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    film: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M10.5 9.5v5l4-2.5z"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.6c-.5-.9-1.4-1.4-2.6-1.4-1.5 0-2.6.8-2.6 1.9 0 2.6 5.3 1.4 5.3 4 0 1.1-1.1 1.9-2.7 1.9-1.2 0-2.2-.5-2.7-1.5M12 6.6v1.6M12 15.9v1.5"/>'
  };
  function I(n) { return '<svg class="w202i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || IC.spark) + '</svg>'; }
  function busyHtml(m) { return '<div class="w202busy" role="status"><span class="w202spin" aria-hidden="true"></span>' + E(m) + '</div>'; }
