
  /* ---------- page tours (wave122's engine; trainings rows tour:governance and tour:committees) ---------- */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours) return;
      var OPT = { opt: 1 };
      var S = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      if (!W.tours.governance) W.tours.governance = { tab: 'governance', icon: 'shield', hash: '#governance', steps: [
        S('#governance > .w118mast', 'The board', 'Everything the board does ladders up to one of three jobs: steward leadership, fiduciary oversight, and direction and strategy.'),
        S('#w126gov .w126seg', 'The board pages', 'The overview, the committees and the directors; leaders also get the board’s agendas and tasks.', OPT),
        S('#w126gov .w126meet', 'The next board meeting', 'When it is, when the committees should have met (a week before), the last meeting’s minutes and the strategy session.', OPT),
        S('#w126job-steward', 'Steward leadership', 'The executive directors, succession, the seats and every director’s term and renewal.', OPT),
        S('#w126job-fiduciary', 'Fiduciary oversight', 'The finances for the fiscal year, insurance, by-laws, filings and disclosures. Open an item to see or change where it stands.', OPT),
        S('#w126job-strategy', 'Direction and strategy', 'The three steps to a strategy (assumptions, who we serve, the plan) and the organizational goals.', OPT),
        S('#w126dirs', 'The directors', 'Each director’s committees, how far each committee is this cycle, what they logged, their board tasks and their term. Open a director for the detail.', OPT)
      ] };
      if (!W.tours.committees) W.tours.committees = { tab: 'committees', icon: 'people', hash: '#committees', steps: [
        S('#committees > .w118mast', 'Committees', 'Four working committees, each chaired by a director. Strategy stays with the whole board.'),
        S('#w126com .w126how', 'How a committee works', 'The chair, a touchpoint with the team lead, a working session with an outside professional, then a recommendation for the board.', OPT),
        S('#w126com .w126cyc', 'This cycle', 'From the last board meeting to the next. Committees meet a week before the board does.', OPT),
        S('#w126com .w126com', 'A committee', 'Its chair, directors, internal leads and the professional to recruit, and where it is in the four steps this cycle.', OPT),
        S('#w126com .w126part', 'Each director', 'What each director on the committee logged this cycle.', OPT),
        S('#w126com [data-w126log]', 'Log a touchpoint', 'Directors log their own touchpoints and recommendations here; they count toward the committee’s cycle.', OPT),
        S('#w126com .w126strat', 'Strategy and cadence', 'The strategy block, the rhythm of meetings, and where to recruit beyond the board.', OPT)
      ] };
    } catch (e) { /* fine */ }
  }
  addTours();

  /* ---------- test hook ---------- */
  window.w126 = { state: function () { return B; }, load: load, me: loadMe, gov: govPaint, com: comPaint, steps: steps, cycle: function () { return { start: cycleStart(), end: cycleEnd(), next: nextMeeting(), last: lastMeeting() }; }, log: openLog, close: closeSheet };
})();
