/* =====================================================================
   WA v130 the browser test fixes (26/09/26)
   =====================================================================
   Steel, on the browser test (#43): "For the bugs worth fixing first,
   feel free to fix them all." What this wave changes, by the numbers in
   the findings doc (docs/26-09-26 - hub browser test):
   1.  Phones: menus never wider than the screen (Activity, The Brain,
       the audit trail) and the onboarding row on a person page wraps.
   5.  Hub inbox: one header (the masthead), with the fuller purpose line.
   6.  Board view: a page the board cannot open says so, on the Executive
       dashboard where the viewer lands, with the pages the board view
       does open; links to staff pages stop being links for directors.
       Staff sent back from a page outside their access profile get the
       same notice, pointing to Request more access.
   7.  Board view: no tick boxes on the executive decisions, and the
       intro no longer says "Tick an item".
   8.  Calendar: a Board layer (board meetings, the committees' week
       before, the fiscal year-end) lives in wave124's parts.
   9.  Servings without a title read "Sunday serving, Montreal" (waves
       124 and 128, and the cancelled-serving notes in 116g and 106).
   10. Ask the Hub: a round button that opens its label on hover or
       focus, and steps aside while you type (on phones the bottom bar
       does too).
   11. First visit: one coach mark at a time. The check-in note is two
       short lines (edited in 118b) so it stays clear of the tiles; Meet
       Ask the Hub waits
       until the check-in note is gone and never shows beside the Get
       started card (which already has "Ask the Hub a question").
   12. Request more access: never for admins, and no flash before the
       role is known.
   13. Policies: Open and read and the sign-off sit apart (stacked on a
       phone), the signed pill stays on one line, and the sign-off only
       works once the document has been opened.
   14. Refresh the recommendation (waves 3 and 116, edited in place).
   15. Goal page footnotes sit inside their card.
   Bugs 2 to 4 (People and access, access requests on a phone, the
   Access profiles matrix) are fixed by the People and access redesign
   that follows this wave.
   ===================================================================== */
(function () {
  if (window.__wa130) return; window.__wa130 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";

  var css = ''
    /* 1. phones: nothing wider than the screen */
    + '@media (max-width:760px){'
    + 'select{max-width:100%;}'
    + '#activity .filters select,.w86bar select,.w86bar input,.w87bar select{min-width:0;max-width:100%;}'
    + '.w37profbar{flex-wrap:wrap;max-width:100% !important;}'
    + '.w37profbar .w37bar{min-width:60px;flex:1 1 60px;}'
    + '}'
    /* 5. Hub inbox: the masthead is the header */
    + '#hubmail > .w116ptop{display:none !important;}'
    /* 6 and 7. the board view */
    + 'body.w130board #decisionList input[type=checkbox],body.w130board #decisionDoneList input[type=checkbox]{display:none !important;}'
    + 'body.w130board [data-w130off="text"]{color:inherit !important;text-decoration:none !important;cursor:default !important;font-weight:inherit;}'
    + 'body.w130board [data-w130off="hide"]{display:none !important;}'
    + 'body.w130board [data-w130off="text"] > svg:last-child{display:none !important;}'
    + '.w130deny{position:relative;display:flex;gap:14px;align-items:flex-start;background:var(--wa-card,' + CREAM + ');border:1px solid rgba(16,63,57,.12);border-left:4px solid ' + GOLD + ';border-radius:16px;padding:14px 46px 14px 16px;margin:0 0 16px;box-shadow:0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06);font-family:' + BODY + ';}'
    + '.w130deny .ic{flex:none;width:36px;height:36px;border-radius:50%;background:rgba(220,165,39,.2);color:' + GREEN + ';display:flex;align-items:center;justify-content:center;}'
    + '.w130deny .ic svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;}'
    + '.w130deny b{display:block;font-family:' + HEAD + ';font-weight:600;font-size:19px;line-height:1.15;letter-spacing:.4px;text-transform:uppercase;color:' + GREEN + ';margin:2px 0 4px;}'
    + '.w130deny p{margin:0 0 9px;font-size:13px;line-height:1.5;color:var(--wa-muted,#5c6b66);}'
    + '.w130deny .lk{display:flex;flex-wrap:wrap;gap:6px;}'
    + '.w130deny .lk a{font-size:12.5px;font-weight:600;color:' + GREEN + ';background:rgba(16,63,57,.07);border-radius:999px;padding:7px 13px;text-decoration:none;cursor:pointer;line-height:1.2;}'
    + '.w130deny .lk a:hover{background:rgba(16,63,57,.13);}'
    + '.w130deny .x{position:absolute;top:8px;right:8px;width:34px;height:34px;border:none;background:none;border-radius:9px;cursor:pointer;color:var(--wa-muted,#5c6b66);font-size:20px;line-height:1;}'
    + '.w130deny .x:hover{background:rgba(16,63,57,.07);color:' + GREEN + ';}'
    /* 10. Ask the Hub: round, the label opens on hover or focus */
    + '#waChatBtn{transition:transform .18s ease,box-shadow .18s ease,opacity .18s ease,padding .28s ease !important;}'
    + '@media (min-width:901px){'
    + 'html body #waChatBtn{min-width:56px;height:56px !important;padding:0 13px !important;gap:0 !important;justify-content:center;right:20px;bottom:20px;}'
    + 'html body #waChatBtn .w117ei{margin:0 !important;}'
    + '#waChatBtn .w130lbl{display:inline-block;max-width:0;opacity:0;overflow:hidden;white-space:nowrap;transition:max-width .28s ease,opacity .2s ease,margin .28s ease;}'
    + 'html body #waChatBtn:hover,html body #waChatBtn:focus-visible{padding:0 20px 0 15px !important;}'
    + '#waChatBtn:hover .w130lbl,#waChatBtn:focus-visible .w130lbl{max-width:170px;opacity:1;margin-left:8px;}'
    + '#w75nudge{right:20px !important;bottom:90px !important;}'
    + '#w75nudge:after{right:41px !important;}'
    + '}'
    + 'body.w130typing #waChatBtn{opacity:0 !important;pointer-events:none !important;transform:translateY(12px) scale(.9) !important;}'
    + '@media (max-width:900px){body.w130typing #w114bar{display:none !important;}}'
    /* 11. one coach mark at a time */
    + 'body.w130typing #w75nudge,body.w130wait #w75nudge{display:none !important;}'
    /* 12. Request more access: only once the role is known, never for admins */
    + 'body:not(.w130canreq) #w110btn{display:none !important;}'
    /* 13. policies */
    + '.w105sign > div{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}'
    + '.w105ok{white-space:nowrap;}'
    + '[data-w130lock]{opacity:.5;cursor:not-allowed !important;}'
    + '@keyframes w130hint{0%{box-shadow:0 0 0 0 rgba(220,165,39,.75);}100%{box-shadow:0 0 0 10px rgba(220,165,39,0);}}'
    + '.w130hint{animation:w130hint .9s ease-out 2;}'
    + '@media (max-width:640px){'
    + '.w105sign > div{flex-direction:column;align-items:stretch;gap:12px;}'
    + '.w105sign > div > .btn{justify-content:center;text-align:center;min-height:40px;}'
    + '#w122 .w122trk .it .ia{flex-direction:column;align-items:stretch;gap:12px;}'
    + '#w122 .w122trk .it .ia .go{text-align:center;padding:9px 14px;}'
    + '}'
    /* 15. goal page footnotes inside their card */
    + '.w116g > p.note{margin:12px 0 0 !important;padding:0 18px 16px !important;}';

  (function () {
    var st = document.getElementById('w130css');
    if (!st) { st = document.createElement('style'); st.id = 'w130css'; (document.head || document.documentElement).appendChild(st); }
    st.textContent = css;
  })();
