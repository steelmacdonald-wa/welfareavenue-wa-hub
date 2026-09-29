
  /* ---------- page tours for the academy (wave122's engine; trainings rows tour:calendar and tour:fundevents) ---------- */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours) return;
      var OPT = { opt: 1 };
      var S = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      if (!W.tours.calendar) W.tours.calendar = { tab: 'calendar', icon: 'clock', hash: '#calendar', steps: [
        S('#calendar > .w118mast', 'Calendar', 'Everything with a date in one place: fundraising events, your meetings, marketing posts, volunteering and birthdays, and for the board and the executives, the board\u2019s dates.'),
        S('#w124cal .w124bar', 'Move around', 'Step through the months, jump back to today, and switch between the month grid and the agenda list.', OPT),
        S('#w124cal .w124layers', 'Layers', 'Switch each layer on or off; the Hub remembers your choice. My meetings are only the meetings you are invited to.', OPT),
        S('#w124cal .w124band', 'All month long', 'Fundraising events that run all month or all season sit above the grid.', OPT),
        S('#w124cal .w124grid || #w124cal .w124ag', 'Open anything', 'Each item opens with its details and links: join the meeting, open the event, the post or the serving.', OPT),
        S('#w124cal .w124up', 'Up next', 'The next things on your calendar over the coming five weeks.', OPT),
        S('#w124cal .w124side [data-w124bday]', 'Your birthday', 'Add your birthday (month and day only) and choose who sees it: everyone, your team, or only you. You can also add it from your profile.', OPT)
      ] };
      if (!W.tours.fundevents) W.tours.fundevents = { tab: 'fundevents', icon: 'target', hash: '#fundevents', steps: [
        S('#fundevents > .w118mast', 'Events calendar', 'The year’s fundraising events, season by season, from the 2026-27 plan.'),
        S('#w124fund .w124goals', 'The goals', 'What the events raised this fiscal year (from October 1) against the minimum, healthy and target amounts.', OPT),
        S('#w124fund .w124sw', 'The year at a glance', 'Every dated event on one line, month by month. The mark before October is where the fiscal year starts.', OPT),
        S('#w124fund .w124evs', 'Season by season', 'Each card shows its photo, the partners, the target, where it stands and links to its project board and SOP. Open one for its page: the photos, past fundraisers like it (their posters open full size) and the details.', OPT),
        S('#w124fund .w124ideas', 'Ideas', 'Ideas parked for later. Open one to give it a season and a date.', OPT),
        S('#w124fund [data-w124fadd]', 'Add and update', 'Leaders and the fundraising team add events, edit them (a cover photo from the Photo library, the photos shown and past fundraisers like it) and record what each one raised once it is done.', OPT)
      ] };
    } catch (e) { /* fine */ }
  }
  addTours();
