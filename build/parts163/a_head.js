/* =====================================================================
   WA v163 the menu's new shape, the Strategy app, Partners in the CRM, and a menu that stays still (29/09/26)
   =====================================================================
   Steel (29/09/26): "Could you add the following pages to an App called strategy" (Organizational goals, Department
   goals, Projects, Goal alignment); "Put Avenue Academy below Home"; a section "Other Tools" (Important Info, The Task
   Bank (previously The bank), Agenda, Document Finder, Transcript Archive, Photo Library) and a section "Organization"
   (Org Chart, Our Story, Hub Inbox); "move partners to the CRM for now"; "remove trainings from" Important info; and
   "when the page loads the website keeps reordering the menu based on all the pushs and updates I've made. Could you
   please have that stop". His choices: The Brain stays in the Hub, under the Calendar; Requests joins Other Tools.
   Earlier the same day: "ensure to distinguish, partner, collaborator, and sponsors" (the Partners page, wave140).

   Where each change lives (the older waves hold their own pages; this segment only keeps the menu still):
   - wave134 (parts134): the layout (Avenue Academy under Home, The Brain after the Calendar, Other Tools, Organization,
     the apps' pages kept together out of sight; Other Tools takes any page the layout does not name) and Important info
     without its Training videos section.
   - wave153 (parts153): the Strategy app (its four pages, and a project's own page with Projects marked) and Partners in
     the CRM's rail; the apps' pages never show in the Hub menu.
   - wave140 (parts140): Partners shows partner, collaborator and sponsor (wa_partners.category).
   - The crumbs, the access profile editor's groups, the tours and The Task Bank's name in 110, 116d, 116f, 116h, 118,
     118c, 122, 127, 131, 132 and 152.
   - Here: the menu stays out of sight until it has its final shape. Each wave that shapes the menu runs after its own
     data arrives, so on a slow load the page used to show the menu while it was still being put together (the loading
     screen lifts after 9 seconds at the latest). Now the menu shows once, whole: after the last wave has run, the layout
     is applied one final time and the menu shows when it has been still for a moment (at most 2.5 seconds later; if the
     Hub never finishes starting, after 20 seconds anyway). wave110 waits for it (at most 1.5 seconds) before it lifts
     the loading screen, so on a normal load nothing changes but the order: the whole page appears at once.
   ===================================================================== */
(function () {
  if (window.__wa163) return; window.__wa163 = true;
  var GOLD = '#DCA527';
  var G = { ready: false, why: '', t0: (function () { try { return performance.now(); } catch (e) { return Date.now(); } })(), at: null, settling: false, after: 0 };
