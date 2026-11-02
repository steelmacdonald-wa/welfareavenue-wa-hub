/* =====================================================================
   WA v272 The new Home: what do I do next, for everyone (02/11/26)
   =====================================================================
   Steel (01/11/26): "I need like a better UI. Maybe it should look like more of an Apple design. I really want you to
   consider that the homepage is for everyone, right? And it should be something simple to use."; "ensure you aren't removing
   any functionality from the old home page"; directors: "Yes, give them Home"; "make it part of onboarding and a pop up on
   hub to add the hub as an app on their phone and computer without it looking forced only encouraged. Also I want a very
   easy experience for setting up the notifications. It should maybe be a small section close to the top of home called
   setting up hub." and how-to animations for iPhone and Android.

   Nothing is rebuilt: every card the older waves draw on Home stays theirs, with its wiring, and this segment only lays them
   out (CSS order and a grid on #mpBody) and adds:
   - a plain sentence under the greeting (the chips stay, as the same buttons);
   - Up next: the one task to do now, with Open task, Mark as done (Undo for 5 seconds) and Do this later;
   - My tasks shows what is due today or overdue, with the rest behind Later (remembered on this device);
   - Your apps: the launcher's apps on Home (the launcher stays);
   - Set up your Hub: add the Hub as an app, turn on notifications. One tap where the browser allows it, a how-to film where
     it does not. Both optional; Not now hides it and Show everything brings it back. It stands in for wave219's card.
   - a small corner note, at most twice on a device and 14 days apart, never over another window;
   - directors get Home: greeting, Set up your Hub (the app only: Hub notifications are staff only, wa219_push_save), their
     meetings and their Board pages; Home is their landing page and the Board overview stays in their menu.
   window.w272: paint, state, setupOpen, tryTip, nextTask, todayCount. */
(function () {
  'use strict';
  if (window.__wa272) return; window.__wa272 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', PURPLE = '#6F64AB';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function staff() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function board() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function classic() { return lsGet('wa114classic') === '1'; }
  function onHome() { var h = String(location.hash || ''); return !h || h === '#' || /^#mypage(\/|$)/.test(h); }
  function say(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  var WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  function word(n) { return WORD[n] || String(n); }
  function isoToday() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
