/* =====================================================================
   WA v195 Sign-offs: volunteers' letters and forms, signed (02/10/26)
   =====================================================================
   Steel (02/10/26): "I'd also like to add my signature to volunteer recognition and volunteer hours sign off requests
   that volunteers can ask for on their profile in the ebsite. This would appear on our volunteer manager as it's own
   page to sign off on hours completed with us." His choices: an hours sign-off letter, a letter of recognition, or the
   volunteer's own form signed; Operations leads, admins and the people an admin assigns sign; the signed PDF goes to the
   volunteer's profile on welfareavenue.com and by email.

   - The Volunteer Manager's Sign-offs page (#volunteering/signoffs; in the rail under People, with the waiting count;
     a chip on phones): Waiting, Signed, Declined, All. Volunteers ask from their profile (wave194's account page).
   - A request opens in a sheet: what they asked for and who it is for, their record, then, for a signer: the servings to
     list with their hours (each can be changed or left out), the signer's own words on a recognition letter, where the
     signature goes on the volunteer's own form (a page, a corner, a size; our hours page after it), a preview of the PDF,
     Sign and send (the volunteer is emailed that it is ready, unless the signer says not to) or Decline with a reason the
     volunteer sees. A signed request keeps its PDF and reference (WA-VS-xxxxxx) to download again.
   - My signature: the name and title printed under it (English, and French for French letters), the signature drawn
     with a finger or the mouse, or uploaded; Steel's can come from the signature he sent for the Academy certificate
     (app_config cert_signature, wave194 of another session). A sample letter shows how it prints.
   - Signers: who can sign (admins, Operations leads, people assigned); admins assign or remove team members.
   - The page tour "signoffs" (the Academy row Page tour: Sign-offs).
   Everything else is in the database (wa195_signoffs: signoff_list, signoff_detail, signoff_decline, signoff_signer_me,
   signoff_signer_save, signoff_signers, signoff_signer_assign, signoff_counts) and the signoff edge function (the PDFs
   and the signatures, in the private signoffs bucket). Nothing here switches mail_mode. The page hooks into the
   Volunteer Manager at run time (waVolShell, waVolRender, WA_APP.apps.volunteer.groups, the masthead), so no other
   segment changes.
   ===================================================================== */
(function () {
  if (window.__wa195) return; window.__wa195 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', INK = '#1F201E', MUTED = '#797773', LINE = 'rgba(16,63,57,.14)';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var KINDS = {
    hours: { l: 'Hours sign-off letter', s: 'Their servings and hours, signed' },
    recognition: { l: 'Letter of recognition', s: 'A letter about what they bring to our community, signed' },
    form: { l: 'Their own form', s: 'The form their school or employer gave them, signed' }
  };
  var STATUS = { requested: 'Waiting', signed: 'Signed', declined: 'Declined', all: 'All' };
  /* where the signature goes on their form: the top left corner and the width, as parts of the page */
  var PLACES = [['br', 'Bottom right', 0.58, 0.80], ['bl', 'Bottom left', 0.10, 0.80], ['bc', 'Bottom centre', 0.36, 0.80], ['mr', 'Middle right', 0.58, 0.48], ['tr', 'Top right', 0.62, 0.08]];
  var SIZES = [['s', 'Small', 0.2], ['m', 'Medium', 0.28], ['l', 'Large', 0.38]];
  var S = {
    status: 'requested', list: null, counts: {}, canSign: false, err: '', loading: false, me: null, signers: null, signersBusy: false,
    waiting: null, det: null, items: null, note: '', place: 'br', size: 'm', page: '', addPage: true, caption: true, notify: true,
    preview: null, previewBusy: false, step: '', reason: '', busy: false, sheetErr: '', sigUrl: null, sigAt: 0, cert: undefined,
    mine: null, mineErr: '', mineBusy: false, sampleBusy: false
  };

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function staff() { try { return typeof isStaff === 'function' ? isStaff() : false; } catch (e) { return false; } }
  function onView() { try { return typeof WA_VOL_VIEW !== 'undefined' && WA_VOL_VIEW === 'signoffs'; } catch (e) { return false; } }
  function lower(s) { return String(s || '').trim().toLowerCase(); }
  function first(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
  function msgOf(err) { var m = String((err && (err.message || err.error_description || err.error)) || err || ''); return m.replace(/^.*?:\s(?=[A-Z])/, '') || 'Something went wrong.'; }
  function fmtDay(iso, long) {
    if (!iso) return '';
    try { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-CA', long ? { timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' } : { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return String(iso).slice(0, 10); }
  }
  function ago(ts) {
    if (!ts) return '';
    var d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? d + ' days ago' : fmtDay(ts);
  }
  function num(n) { var x = Math.round(Number(n || 0) * 100) / 100; return String(x); }
  function plural(n, one, many) { return n + ' ' + (Number(n) === 1 ? one : many); }
  async function rpc(fn, args) { try { return await db.rpc(fn, args || {}); } catch (e) { return { error: e }; } }
  /* the signoff function, as the signed-in person (their Hub sign-in); an error's own words when it has some */
  async function call(body) {
    try {
      var r = await db.functions.invoke('signoff', { body: body });
      if (!r.error) return { ok: true, data: r.data || {} };
      var j = null;
      try { j = r.error.context && typeof r.error.context.json === 'function' ? await r.error.context.json() : null; } catch (e) { j = null; }
      return { ok: false, data: j || {}, error: (j && (j.error === 'server' && j.detail ? j.detail : j.error)) || msgOf(r.error) };
    } catch (e) { return { ok: false, data: {}, error: msgOf(e) }; }
  }
  var WORDS = { not_allowed: 'This is for the Volunteer Manager’s team.', not_found: 'That request is gone.', not_signer: 'Only a signer can do that.', signin: 'Your session ended. Sign in again.' };
  function words(e) { return WORDS[e] || e || 'Something went wrong.'; }

  /* ---------- the look ---------- */
  function css() {
    if (document.getElementById('w195css')) return;
    var st = document.createElement('style'); st.id = 'w195css';
    st.textContent = ''
      + '#w195{font-family:' + BODY + ';color:' + INK + ';}'
      + '#w195 .w195top{display:grid;gap:18px;align-items:start;}'
      + '@media (min-width:1000px){#w195 .w195top{grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);}}'
      + '#w195 .w195lead{font-size:14px;line-height:1.55;color:' + MUTED + ';margin:0 0 14px;max-width:62em;}'
      + '#w195 .w195f{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 12px;}'
      + '#w195 .w195f button{font:600 13px ' + BODY + ';border:1px solid ' + LINE + ';background:#FFFAF2;color:' + GREEN + ';border-radius:999px;padding:6px 12px;cursor:pointer;}'
      + '#w195 .w195f button.on{background:' + GREEN + ';border-color:' + GREEN + ';color:#FFFAF2;}'
      + '#w195 .w195f small{font-weight:700;margin-left:6px;opacity:.8;}'
      + '#w195 .w195list{display:grid;gap:8px;}'
      + '#w195 .w195row{display:grid;grid-template-columns:1fr auto;gap:2px 12px;text-align:left;width:100%;background:#FFFAF2;border:1px solid ' + LINE + ';border-radius:12px;padding:12px 14px;cursor:pointer;font:inherit;color:inherit;}'
      + '#w195 .w195row:hover{border-color:' + GREEN + ';box-shadow:0 2px 10px rgba(16,63,57,.08);}'
      + '#w195 .w195row .k{grid-column:1;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:' + MUTED + ';}'
      + '#w195 .w195row b{grid-column:1;font-size:15.5px;color:' + GREEN + ';}'
      + '#w195 .w195row .m{grid-column:1;font-size:13px;color:' + MUTED + ';}'
      + '#w195 .w195row .w195st{grid-column:2;grid-row:1 / span 3;align-self:center;}'
      + '#w195 .w195st,#w195sheet .w195st{display:inline-block;font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 10px;background:rgba(220,165,39,.2);color:#6b4d05;white-space:nowrap;}'
      + '#w195 .w195st.signed,#w195sheet .w195st.signed{background:rgba(42,140,122,.15);color:#1c6b5d;}'
      + '#w195 .w195st.declined,#w195sheet .w195st.declined{background:rgba(179,64,47,.1);color:' + FLAG + ';}'
      + '#w195 .w195empty{background:#FFFAF2;border:1px dashed ' + LINE + ';border-radius:12px;padding:18px;font-size:14px;color:' + MUTED + ';}'
      + '#w195 .w195card{background:#FFFAF2;border:1px solid ' + LINE + ';border-radius:14px;padding:16px 16px 14px;margin:0 0 14px;}'
      + '#w195 .w195card h3{font-family:' + HEAD + ';font-weight:600;font-size:20px;letter-spacing:.3px;color:' + GREEN + ';margin:0 0 8px;}'
      + '#w195 .w195card p{font-size:13.5px;line-height:1.5;margin:0 0 8px;}'
      + '#w195 .w195sig{display:block;max-width:100%;max-height:74px;margin:4px 0 8px;}'
      + '#w195 .w195who{font-weight:700;color:' + INK + ';}'
      + '#w195 .w195muted,#w195sheet .w195muted{color:' + MUTED + ';font-size:13px;}'
      + '#w195 .w195signers{list-style:none;margin:0 0 10px;padding:0;}'
      + '#w195 .w195signers li{display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid ' + LINE + ';font-size:13.5px;}'
      + '#w195 .w195signers li:first-child{border-top:0;}'
      + '#w195 .w195signers .why{margin-left:auto;font-size:11.5px;color:' + MUTED + ';}'
      + '#w195 .w195add{display:flex;gap:6px;flex-wrap:wrap;}'
      + '#w195 select,#w195sheet select,#w195sheet input[type=text],#w195sheet input[type=number],#w195sheet textarea{font:14px ' + BODY + ';border:1px solid ' + LINE + ';border-radius:9px;padding:8px 10px;background:#FFFAF2;color:' + INK + ';max-width:100%;}'
      + '#w195 .w195btn,#w195sheet .w195btn{font:600 13.5px ' + BODY + ';background:' + GREEN + ';color:#FFFAF2;border:1px solid ' + GREEN + ';border-radius:10px;padding:8px 14px;cursor:pointer;}'
      + '#w195 .w195btn.ghost,#w195sheet .w195btn.ghost{background:#FFFAF2;color:' + GREEN + ';}'
      + '#w195 .w195btn.flag,#w195sheet .w195btn.flag{background:#FFFAF2;color:' + FLAG + ';border-color:rgba(179,64,47,.45);}'
      + '#w195 .w195btn[disabled],#w195sheet .w195btn[disabled]{opacity:.55;cursor:progress;}'
      + '#w195 .w195link,#w195sheet .w195link{background:none;border:0;padding:0;font:inherit;color:' + GREEN + ';text-decoration:underline;text-underline-offset:3px;cursor:pointer;}'
      + '#w195 .w195warn,#w195sheet .w195warn{background:rgba(179,64,47,.08);color:#7e2b1f;border-radius:10px;padding:9px 12px;font-size:13.5px;margin:0 0 12px;}'
      + '#w195 .w195ok,#w195sheet .w195ok{background:rgba(42,140,122,.1);color:#1c5b4f;border-radius:10px;padding:9px 12px;font-size:13.5px;margin:0 0 12px;}'
      /* the sheet */
      + '#w195sheet{position:fixed;inset:0;z-index:9000;background:rgba(15,30,28,.45);display:flex;justify-content:flex-end;}'
      + '#w195sheet .w195pane{width:min(820px,100%);height:100%;overflow-y:auto;background:' + CREAM + ';box-shadow:-12px 0 40px rgba(0,0,0,.18);padding:22px 24px 40px;font-family:' + BODY + ';color:' + INK + ';}'
      + '@media (max-width:700px){#w195sheet .w195pane{padding:16px 14px 40px;}}'
      + '#w195sheet .w195x{position:sticky;top:0;float:right;font:600 22px/1 ' + BODY + ';background:#FFFAF2;border:1px solid ' + LINE + ';border-radius:10px;width:38px;height:38px;cursor:pointer;color:' + GREEN + ';}'
      + '#w195sheet h2{font-family:' + HEAD + ';font-weight:600;font-size:28px;line-height:1.1;color:' + GREEN + ';margin:2px 0 4px;}'
      + '#w195sheet h3{font-family:' + HEAD + ';font-weight:600;font-size:19px;letter-spacing:.3px;color:' + GREEN + ';margin:20px 0 8px;}'
      + '#w195sheet .w195k{font-size:11px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:' + MUTED + ';}'
      + '#w195sheet .w195box{background:#FFFAF2;border:1px solid ' + LINE + ';border-radius:12px;padding:12px 14px;margin:0 0 10px;}'
      + '#w195sheet dl{display:grid;grid-template-columns:9em 1fr;gap:6px 12px;margin:0;font-size:14px;}'
      + '#w195sheet dt{color:' + MUTED + ';}'
      + '#w195sheet dd{margin:0;}'
      + '#w195sheet .w195q{white-space:pre-line;font-style:italic;}'
      + '#w195sheet table{width:100%;border-collapse:collapse;font-size:13.5px;}'
      + '#w195sheet th{text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:' + MUTED + ';padding:6px 6px;border-bottom:1px solid ' + GREEN + ';}'
      + '#w195sheet td{padding:6px 6px;border-bottom:1px solid ' + LINE + ';}'
      + '#w195sheet td input[type=number]{width:5.5em;padding:5px 7px;}'
      + '#w195sheet tr.off td{color:' + MUTED + ';text-decoration:line-through;}'
      + '#w195sheet tr.off td input{text-decoration:none;}'
      + '#w195sheet .w195tot{text-align:right;font-weight:700;color:' + GREEN + ';padding-top:8px;font-size:14px;}'
      + '#w195sheet .w195row2{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:6px 0;}'
      + '#w195sheet .w195row2 label{display:inline-flex;align-items:center;gap:6px;font-size:14px;cursor:pointer;}'
      + '#w195sheet .w195acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:18px 0 6px;}'
      + '#w195sheet .w195acts .w195btn.flag{margin-left:auto;}'
      + '#w195sheet iframe{width:100%;height:72vh;border:1px solid ' + LINE + ';border-radius:10px;background:#FFFAF2;}'
      + '#w195sheet .w195confirm{background:#FFFAF2;border:1.5px solid ' + GOLD + ';border-radius:12px;padding:14px;margin:14px 0 6px;font-size:14.5px;}'
      + '#w195sheet textarea{width:100%;min-height:90px;resize:vertical;}'
      + '#w195sheet .w195pad{position:relative;background:#FFFAF2;border:1.5px dashed rgba(16,63,57,.3);border-radius:12px;touch-action:none;}'
      + '#w195sheet .w195pad canvas{display:block;width:100%;height:200px;cursor:crosshair;}'
      + '#w195sheet .w195pad .w195line{position:absolute;left:8%;right:8%;bottom:46px;border-bottom:1px solid rgba(16,63,57,.25);pointer-events:none;}'
      + '#w195sheet .w195tabs{display:flex;gap:6px;margin:0 0 10px;flex-wrap:wrap;}'
      + '#w195sheet .w195tabs button{font:600 13px ' + BODY + ';border:1px solid ' + LINE + ';background:#FFFAF2;color:' + GREEN + ';border-radius:999px;padding:6px 12px;cursor:pointer;}'
      + '#w195sheet .w195tabs button.on{background:' + GREEN + ';color:#FFFAF2;border-color:' + GREEN + ';}'
      + '#w195sheet .w195grid{display:grid;gap:10px;}'
      + '@media (min-width:640px){#w195sheet .w195grid{grid-template-columns:1fr 1fr;}}'
      + '#w195sheet .w195grid label{display:block;font-size:13px;color:' + MUTED + ';margin:0 0 4px;}'
      + '#w195sheet .w195grid input{width:100%;}'
      + '#w195sheet .w195cert{display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:#FFFAF2;border:1px solid ' + LINE + ';border-radius:12px;padding:10px 12px;margin:0 0 10px;}'
      + '#w195sheet .w195cert img{max-height:60px;max-width:220px;}'
      + '#w195sheet .w195big{display:block;max-height:90px;max-width:100%;margin-top:8px;}'
      + '#w195sheet #w195pgn{width:4.5em;padding:5px 7px;}'
      + '#w195sheet .sr,#w195 .sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}';
    document.head.appendChild(st);
  }
