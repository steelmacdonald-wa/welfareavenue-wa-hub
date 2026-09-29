/* =====================================================================
   WA v166 Onboarding around the Hub and the Avenue Academy (29/09/26)
   =====================================================================
   Steel (29/09/26): "please consider embedding Loom videos in the Avenue Academy for trainings and for the onboarding as
   well (which I believe needs some revision giving the move away from ClickUp, the new Hub). In fact the onboarding could
   include members doing some of the Avenue Academy modules. Give the onboarding a whole revamp. I also believe that
   managers or leads that have people onboarding should have something on their home page to show the progress their
   member is making and where they need to come in to ensure they progress."

   What changed where:
   - The plan (wa166_onboarding): ClickUp and Keela are out; the Hub and the Avenue Academy are in. A step can be done in
     the Academy (onboarding_template.training_id: a module; academy_path: an avenue, 'team' or 'any') and ticks itself
     when the person finishes it there (wa166_onb_sync on training_progress). The week 1 Loom videos are Academy modules
     in a new avenue, Your first week.
   - Here, the plan as the member and HR see it (wa37Checklist, replaced again): each Academy step says so, shows how far
     the person is and opens the module or the avenue; the ClickUp "syncing" note is gone. The plan sheet gets "Stuck on
     a step? Ask for help" (the help request HR and the lead see).
   - Here, Loom links in onboarding steps, Academy lessons and readings and the HR checklists get "Watch here": the video
     plays in place (a Loom embed, loaded only when asked). The Loom card's meeting links are left alone.
   - Here, the leads' card on Home (#w166lead, onboarding_lead_view): each person the signed-in lead is onboarding, how
     far they are and what is late, the avenues, their help requests, and "Where you come in": the lead's moments with
     their dates (introduce them, first tasks, the two-week and 30-day check-ins, the quizzes, probation), ticked here
     (onboarding_lead_tick). The plan itself opens in place.
   - Elsewhere: the Home tour (122), the welcome kit and the onboarding email (046, 108: no ClickUp or Keela, the real
     setup video), the help request's promise (039: the Hub, not Slack), Hub module 7.
   ===================================================================== */
(function () {
  if (window.__wa166) return; window.__wa166 = true;
  var GREEN = '#103F39', GOLD = '#DCA527', MUTED = '#797773', FLAG = '#B3402F', TEAL = '#2A8C7A', LINE = '#E7E2D6', CREAM = '#FFFAF2';
  var S = { lead: null, loading: null, at: 0, err: null, busy: {}, open: {} };
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function todayIso() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function fmtDay(iso) {
    if (!iso) return '';
    try { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }); } catch (e) { return String(iso).slice(0, 10); }
  }
  function ago(iso) {
    if (!iso) return '';
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (!(d >= 0)) return '';
    return d === 0 ? 'today' : (d === 1 ? 'yesterday' : d + ' days ago');
  }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); }
  function teamName(d) { try { return (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; } catch (e) { return d || ''; } }
  function meName() { try { var m = (typeof wa28Me === 'function') ? wa28Me() : null; return (m && m.name) || ''; } catch (e) { return ''; } }

  var CSS = ''
    /* Loom players in place */
    + '.w166play{display:inline-flex;align-items:center;gap:5px;margin:0 0 0 8px;padding:2px 10px;border-radius:999px;border:1px solid ' + GREEN + ';background:' + CREAM + ';color:' + GREEN + ';font-family:inherit;font-weight:700;font-size:11.5px;line-height:1.6;cursor:pointer;vertical-align:1px;}'
    + '.w166play:hover{background:' + GREEN + ';color:' + CREAM + ';}'
    + '.w166vidwrap{position:relative;width:100%;max-width:720px;aspect-ratio:16/9;margin:8px 0 10px;border-radius:10px;overflow:hidden;background:#1F201E;}'
    + '.w166vidwrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}'
    /* Academy steps in the plan */
    + '.w166acad{display:inline-flex;align-items:center;gap:6px;margin:4px 0 2px;padding:2px 9px;border-radius:999px;background:rgba(42,140,122,.12);color:' + TEAL + ';font-size:11px;font-weight:700;letter-spacing:.3px;}'
    + '.w166acad.ok{background:rgba(16,63,57,.1);color:' + GREEN + ';}'
    + '.w166go{margin-left:8px;border:0;background:none;padding:0;color:' + GREEN + ';font-weight:700;font-size:12px;text-decoration:underline;cursor:pointer;}'
    + '.w166help{margin:10px 0 0;}'
    + '.w166hform{display:none;margin-top:10px;gap:8px;max-width:560px;}.w166hform.on{display:grid;}'
    + '.w166help > button{border:1px solid ' + LINE + ';background:' + CREAM + ';border-radius:999px;padding:5px 12px;font-weight:700;font-size:12.5px;color:' + GREEN + ';cursor:pointer;}'
    /* the leads’ card on Home */
    + '#w166lead{margin:12px 0;}'
    + '#w166lead .w166ppl{display:grid;gap:12px;}'
    + '#w166lead .w166p{border:1px solid ' + LINE + ';border-radius:12px;background:' + CREAM + ';padding:12px 14px;}'
    + '#w166lead .w166top{display:flex;gap:12px;align-items:center;}'
    + '#w166lead .w166av{flex:0 0 38px;height:38px;border-radius:50%;background:' + GREEN + ';color:' + CREAM + ';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;}'
    + '#w166lead .w166who{flex:1;min-width:0;}'
    + '#w166lead .w166who b{display:block;font-size:14.5px;color:#1F201E;}'
    + '#w166lead .w166who span{display:block;font-size:12px;color:' + MUTED + ';}'
    + '#w166lead .w166day{text-align:right;font-weight:800;font-size:15px;color:' + GREEN + ';line-height:1.1;}'
    + '#w166lead .w166day span{display:block;font-weight:600;font-size:11px;color:' + MUTED + ';}'
    + '#w166lead .w166bar{height:7px;border-radius:99px;background:#F1EDE2;margin:10px 0 6px;overflow:hidden;}'
    + '#w166lead .w166bar i{display:block;height:100%;background:' + GREEN + ';border-radius:99px;}'
    + '#w166lead .w166sum{font-size:12.5px;color:#4a5551;}'
    + '#w166lead .w166sum .late{color:' + FLAG + ';font-weight:800;}'
    + '#w166lead .w166sum .ok{color:' + TEAL + ';font-weight:800;}'
    + '#w166lead .w166wks{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 2px;}'
    + '#w166lead .w166wk{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#F4F2EA;color:#4a5551;}'
    + '#w166lead .w166wk.done{background:rgba(16,63,57,.1);color:' + GREEN + ';}'
    + '#w166lead .w166wk.late{background:rgba(179,64,47,.1);color:' + FLAG + ';}'
    + '#w166lead .w166you{margin-top:10px;padding:10px 12px;border-radius:10px;background:#F4F2EA;border:1px solid ' + LINE + ';}'
    + '#w166lead .w166h{font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:' + GREEN + ';margin:0 0 6px;}'
    + '#w166lead .w166ls{display:flex;gap:9px;align-items:flex-start;padding:4px 0;font-size:13px;color:#1F201E;}'
    + '#w166lead .w166ls input{margin-top:3px;width:15px;height:15px;accent-color:' + GREEN + ';}'
    + '#w166lead .w166ls .w166due{font-size:11.5px;color:' + MUTED + ';margin-left:6px;white-space:nowrap;}'
    + '#w166lead .w166ls .w166due.late{color:' + FLAG + ';font-weight:700;}'
    + '#w166lead .w166ls .w166due.soon{color:#8a6414;font-weight:700;}'
    + '#w166lead .w166ls.done{color:' + MUTED + ';text-decoration:line-through;}'
    + '#w166lead .w166ls small{display:block;color:' + MUTED + ';font-size:11.5px;text-decoration:none;}'
    + '#w166lead .w166ask{margin:6px 0 2px;padding:7px 10px;border-radius:8px;background:rgba(220,165,39,.14);font-size:12.5px;color:#5c4410;}'
    + '#w166lead .w166ask button,#w166lead .w166act{margin-left:6px;border:1px solid ' + LINE + ';background:' + CREAM + ';border-radius:999px;padding:2px 10px;font-weight:700;font-size:11.5px;color:' + GREEN + ';cursor:pointer;}'
    + '#w166lead .w166note{font-size:12.5px;color:#4a5551;margin:6px 0 0;}'
    + '#w166lead .w166av2{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0;}'
    + '#w166lead .w166av2 span{font-size:11px;padding:2px 8px;border-radius:999px;background:#F4F2EA;color:#4a5551;}'
    + '#w166lead .w166av2 b{font-size:10.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:' + TEAL + ';align-self:center;margin-right:2px;}'
    + '#w166lead .w166av2 span.ok{background:rgba(16,63,57,.1);color:' + GREEN + ';font-weight:700;}'
    + '#w166lead details.w166plan{margin-top:8px;}'
    + '#w166lead details.w166plan summary{cursor:pointer;font-weight:700;font-size:12.5px;color:' + GREEN + ';}'
    + '#w166lead .w166sec{margin:8px 0 0;}'
    + '#w166lead .w166sec b{font-size:11px;letter-spacing:.5px;color:' + GREEN + ';}'
    + '#w166lead .w166st{font-size:12.5px;padding:2px 0 2px 18px;position:relative;color:#1F201E;}'
    + '#w166lead .w166st.child{padding-left:32px;}'
    + '#w166lead .w166st:before{content:"";position:absolute;left:2px;top:7px;width:9px;height:9px;border-radius:50%;border:1.5px solid ' + MUTED + ';}'
    + '#w166lead .w166st.child:before{left:16px;}'
    + '#w166lead .w166st.done{color:' + MUTED + ';}'
    + '#w166lead .w166st.done:before{background:' + GREEN + ';border-color:' + GREEN + ';}'
    + '#w166lead .w166st.late{color:' + FLAG + ';}'
    + '#w166lead .w166st em{font-style:normal;font-size:11px;color:' + TEAL + ';margin-left:6px;}'
    + '@media (max-width:700px){#w166lead .w166top{flex-wrap:wrap;}#w166lead .w166day{text-align:left;}}';
  if (!document.getElementById('wa166css')) { var st = document.createElement('style'); st.id = 'wa166css'; st.textContent = CSS; document.head.appendChild(st); }
