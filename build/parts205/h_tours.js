
  /* ---------- the page tours (wave122's engine): tour:orggoals (Goals), tour:strategylib (the library), tour:goalmap ---------- */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours || (W.tours.orggoals && W.tours.orggoals.__w205)) return;
      var OPT = { opt: 1 };
      var T = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      var jump = function (h) { return function () { if (location.hash !== h) location.hash = h; }; };
      W.tours.orggoals = { __w205: true, tab: 'orggoals', icon: 'target', hash: '#orggoals', steps: [
        T('#w205 .w205mast', 'Goals', 'Welfare Avenue’s five organizational goals for FY27 to FY29, with a gated view to FY31. Teams own projects, and every project serves one of these goals.'),
        T('#w205 .w205hero', 'The mission first', 'Every goal serves the mission the board adopted in July 2026.', OPT),
        T('#w205 .w205status', 'Draft or approved', 'Until the board votes (Oct 19, 2026) the goals say Draft for board approval. An admin marks them approved after the vote.', OPT),
        T('#w205 [data-w207year]', 'This year', 'This year’s goals: each goal’s target for the fiscal year and its four quarterly checkpoints. The current quarter is highlighted, Due next lists what comes due first, and anything past its date and not done is flagged Overdue. Click a row to open the goal.', OPT),
        T('#w205 [data-w205pres]', 'Who is here', 'The people on this page right now. On a goal, their faces show which goal they are in; a field someone is typing in says so.', OPT),
        T('#w205 [data-w205glance]', 'At a glance', 'One line per goal: the headline measure, the baseline, the FY29 and FY31 targets, the owners and the milestones done. Click a row to jump to the goal.', OPT),
        T('#w205 [data-w207cov]', 'Our 8 charitable activities', 'The eight activities Welfare Avenue is registered for, and the goals that serve each one. A tile with no goal would be flagged; today all eight are covered.', OPT),
        T('#w205 .w205goal .w205ghd', 'A goal', 'Its number, its title and its status. If you own the goal (or you are an admin), click any text and type: it saves as you go, and Saved shows when it is in.', OPT),
        T('#w205 .w205goal .w205owners', 'Owners', 'One to three owners, one lead. Owners and admins edit the goal; everyone on staff reads it and comments.', OPT),
        T('#w205 .w205goal .w207acts', 'Charitable activities', 'The registered activities this goal serves. Hover or tap a chip for why. Owners and admins add or take off an activity with + Activities.', OPT),
        T('#w205 .w205goal .w205two', 'SMART and Why', 'The goal as the board reads it, and why it matters.', OPT),
        T('#w205 .w205goal .w205meas', 'The targets', 'The headline measure, where we started, the 3-year target (FY29) and the 5-year target (FY31, only if the FY29 gate is met).', OPT),
        T('#w205 .w205goal .w205paths', 'Paths', 'How we get there. Owners add, change and remove paths.', OPT),
        T('#w205 .w205goal .w207yb', 'This year’s target', 'The goal’s target for this fiscal year, who reports on it, and its Q1 to Q4 checkpoints. Owners set each checkpoint’s status (not started, on track, at risk, done) and its due date; the speech bubble holds its comments and the link icon ties a project to it.', OPT),
        T('#w205 .w205goal .w205years', 'Milestones by year', 'Each fiscal year’s milestones with their status (tap the circle). The projects serving a milestone sit under it; the speech bubble is its own comments.', OPT),
        T('#w205 .w205goal [data-w205projs]', 'Projects serving the goal', 'Teams link their projects here, to the goal or to one milestone. Link a project picks the project and the milestone.', OPT),
        T('#w205 .w205goal .w205gft', 'Comments and history', 'Comments are threaded; type @ to bring someone in. History lists every change, who made it and when; Restore puts an old version back.', OPT),
        T('#w205 .w205road', 'The roadmap', 'Three years to prove it: stabilize, strengthen, scale. The checkpoint in Oct 2027 and the FY29 gate in Oct 2029 decide whether FY30 and FY31 go ahead.', OPT),
        T('#w205 .w205lib', 'The Strategy Library', 'The pinned documents that set our direction. The full library is in the menu.', OPT),
        T('#w205 [data-w205unlinked]', 'Not linked yet', 'Active projects that do not serve a goal yet. Link each one so the goals show the work behind them.', OPT)
      ] };
      W.tours.strategylib = { __w205: true, tab: 'orggoals', icon: 'book', hash: '#orggoals/library', steps: [
        T('#w205 .w205mast', 'The Strategy Library', 'The documents that set Welfare Avenue’s direction: our plans, the consulting work, the sources.', { go: jump('#orggoals/library') }),
        T('#w205 .w205search', 'Search', 'Find a document by its title, what it sets or where it stands.', OPT),
        T('#w205 .w205doc', 'A document', 'What it says, when it was written, where it stands today, and the goals it feeds. Open takes you to the document.', OPT),
        T('#w205 .w205pinb', 'Pinned', 'Pinned documents lead the library and show on the Goals page. Admins pin and unpin, and add new documents.', OPT)
      ] };
      W.tours.goalmap = { __w205: true, tab: 'goalmap', icon: 'link', hash: '#goalmap', steps: [
        T('#goalmap .w116ptop', 'How it all connects', 'Every active project and the organizational goal it serves. Department goals are retired: departments own projects, and projects serve the goals.'),
        T('#w116maphost .sum', 'Gaps at a glance', 'Projects without a goal, and goals with no project yet.', OPT),
        T('#w116maphost .chips', 'Filter by team', 'Focus the map on one team.', OPT),
        T('#w116maphost .w116mcols > .w116mcol:nth-child(1)', 'Projects', 'The work underway. A project marked Link to a goal is not connected yet: click it to link it.', OPT),
        T('#w116maphost .w116mcols > .w116mcol:nth-child(2)', 'The goals', 'The five organizational goals and the milestones their projects serve.', OPT),
        T('#w116maphost p.note', 'Try it', 'Hover anything to light up its chain; click it to pin it.', OPT)
      ] };
      if (W.tours.goals) delete W.tours.goals;   /* the Department goals page is retired */
    } catch (e) { /* fine */ }
  }
