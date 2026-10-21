/* =====================================================================
   WA v262 A simpler Hub for each person (20/10/26)
   =====================================================================
   After the 19/10/26 leadership meeting (Valex: "maybe if we can try to reduce the information"; Ian, for KK: opening the
   Hub to a pile of tasks "can be a bit overwhelming"; Amanda: "I always open up and have like 80 tasks"; Ian: clearing tasks
   from the pop-up failed), Steel, 20/10/26: "go for all of these improvements as long as we're not taking functionality away
   and maybe just storing it in a place that other individuals could go and get afterwards"; and "make an introduction pop-up
   to take a tour of how things have changed for each person ... allow them to look through the apps that are available to
   them".

   - The menu (parts134): your team sits open under Teams; the other teams fold under "Other teams (n)" (open by default for
     admins); The Brain, Other Tools and Organization fold under More. Folds open by themselves on one of their pages and
     remember a click on this device. Computers only: the phone's Menu sheet lists every page.
   - The apps (parts153): Your apps (your team's) first, then More apps.
   - Home (this segment): what matters first (your counts, what needs you, your tasks and your team's requests, your
     meetings, announcements); the rest (who is online, In the loop, Ask the Hub ideas, Updates for you, time commitments,
     Slack notifications, time off) waits behind "Show everything on Home". Nothing is removed; the choice is remembered.
   - What changed (this segment): once per person, a pop-up on Home that says what moved for them (their team, their apps,
     what sits under More) with a one-minute tour (trainings tour:whatsnew). It waits for the must-answer pop-ups.
   - The due-date check (parts213, data wa262a and wa262b): batched saves, "All in this section", and tasks due today.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__wa262) return; window.__wa262 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#797773';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function staff() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function readLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function writeLS(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function first() { try { var n = (typeof WA_ME !== 'undefined' && WA_ME && WA_ME.name) ? String(WA_ME.name).trim().split(/\s+/)[0] : ''; return n; } catch (e) { return ''; } }
  function myDept() { try { return (typeof WA_ME !== 'undefined' && WA_ME && WA_ME.department) || ''; } catch (e) { return ''; } }
  function teamLabel(d) { try { return (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || ''; } catch (e) { return ''; } }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
