/* =====================================================================
   WA v164 Finance on its own (29/09/26)
   =====================================================================
   Steel (29/09/26), on the Finance app's Trends page: "It's a little repetitive here and still shows fundraising and
   finance being togther. these should be seperate". Earlier the same day: "for the Hub Inbox, all finance related
   emails like invoices, receipts, reimbursements should go straight to the finance slack channel not fundraising",
   and "accounting-finance is the private channel" (he added the Hub's Slack app to it).

   Where each change lives (the older waves hold their own pages; this segment draws what is new on the Finance page):
   - The team is Fundraising (001 wave116a, the base, 038, 110, 116, 118, 124, 127, 131, 140, 122's tours): Grants,
     Event fundraising and Donor relations. Finance is not a Fundraising sub-team any more: it has its own key
     ('finance', label Finance, its own gold) with no team page, like the executive team. #team/finance opens the
     Finance app's Tasks.
   - The Finance app (153): its own gold instead of Fundraising's orange; Tasks after the Overview; no group heading
     that repeats the app's name (the HR centre too); on a computer the rail is the menu, so the page's own tab strip
     (and the HR centre's) is hidden, the HR centre's counts moving into the rail; inside any app the crumb is hidden
     (the app bar is the crumb).
   - Requests (123): Finance receives requests (T.inbox: the seven teams plus Finance), reimbursements and purchase
     orders go to Finance (wa164_finance_own), its channel is #accounting-finance, its team inbox card is on the Finance
     Overview (drawn here).
   - The Hub inbox page (116h): money emails are Finance's; Filing to a team offers Finance.
   - The Finance page (22, 24, 93, 94): the Fundraising page no longer links to it; Tasks is a section of its own
     (94); the fold on the Overview lists the money work on other teams' boards, without grants and donors (93); a
     meeting tagged Finance files under Finance.
   - Here: the page's title follows the section (Finance on the Overview, then Tasks, Trends, Money map, Budget,
     Transactions, each with a line saying what it holds), the Tasks section draws the task board for Finance
     (w116Board, department finance), and the Overview shows Finance's team inbox (requests and the emails the Hub
     inbox filed for Finance).
   ===================================================================== */
(function () {
  if (window.__wa164) return; window.__wa164 = true;
  var F = { drawn: 0, board: 0, inbox: 0, titled: '', sec: null };
  /* the time frame does not apply to the task board */
  if (!document.getElementById('wa164css')) { var st = document.createElement('style'); st.id = 'wa164css'; st.textContent = '#finances.w164t #w92pills,#finances.w164t .w92note{display:none !important;}#finances #w164inbox{margin:14px 0 18px;}'; document.head.appendChild(st); }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function panel() { return document.getElementById('finances'); }
  function shell(id) { return document.querySelector('#finances .w94sec[data-w94sec="' + id + '"]'); }
  function curSec() {
    var t = document.querySelector('#finances .w94tab.on');
    if (t) return t.getAttribute('data-w94tab');
    try { return window.w94Cur ? window.w94Cur() : 'overview'; } catch (e) { return 'overview'; }
  }
