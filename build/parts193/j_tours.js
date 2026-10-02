
  /* ---------- the page tour for the academy (wave122's engine; trainings row tour:fund) ---------- */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours || W.tours.fund) return;
      var OPT = { opt: 1 };
      var S = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      var jump = function (h) { return function () { if (location.hash !== h) location.hash = h; }; };
      W.tours.fund = { tab: 'fund', icon: 'target', hash: '#fund', steps: [
        S('#fund > .w118mast', 'The Fundraising app', 'Where the money comes from, in one app: the events and their calendar, the donor program, the event SOPs, and the grants with their scanner and writer. Its menu is on the left (Menu on a phone).'),
        S('#w193host .w193kpis', 'At a glance', 'Open grants and what they ask for, what is due in the next 30 days, what the scanner found, what was won this fiscal year, what the events raised against the target, and the monthly donors.', OPT),
        S('#w193host .w193hero', 'Up next and the scanner', 'Every dated thing on the left: deadlines, reports, next steps, events. On the right, where the grants stand and the scanner’s last run; Scan now runs it today.', OPT),
        S('#w193host .w193rows', 'The pipeline', 'Every opportunity and application by stage: watching, found, screened, relationship, drafting, submitted, awarded, reporting, and the closed ones. Open a row for its sheet: the dates, the fit, the links, the documents on file and everything that happened. Change the stage from the sheet.', { opt: 1, go: jump('#fund/grants') }),
        S('#w193host .w193finds || #w193host .w193card', 'Found for you', 'Every Monday the scanner re-reads the funder pages on the watchlist and runs its web searches; what is new lands here and in #grants. Keep puts it in the pipeline; Dismiss sets it aside; Not for us also stops the funder being proposed.', { opt: 1, go: jump('#fund/grants/found') }),
        S('#w193host .w193rows', 'The funders', 'Every funder we know: the watchlist, the ones we applied to since 2022, the ones screened out and why. Open one for its page, its history with us and its grants.', { opt: 1, go: jump('#fund/grants/funders') }),
        S('#w193host .w193writer', 'The grant writer', 'Paste the funder’s questions, pick the grant, and the assistant drafts every answer from the fact base and our past applications, in our voice, within the word limits. Edit here, ask for a program officer’s review, copy the answers into the funder’s form, and keep the final as a past application.', { opt: 1, go: jump('#fund/grants/write') }),
        S('#w193host .w193md', 'How we win grants', 'The approach: the fit screen (the hard gates and the seven dimensions), the proposal sections, the budget, the writing rules, why applications fail, and the pipeline discipline. Score the fit on a grant runs the screen for you.', { opt: 1, go: jump('#fund/grants/playbook') }),
        S('#w193host .w193facts', 'The fact base', 'Welfare Avenue in its own words, each fact with its source and whether it is verified. The writer uses verified facts as written, warns about the ones that need a check, and never states a figure in conflict. Keep it true and the drafts stay true.', { opt: 1, go: jump('#fund/grants/facts') }),
        S('#w193host .w193grid', 'The calendar', 'Events, grant deadlines, reports and renewals, and next steps, month by month, with Up next on the side. Switch any layer off.', { opt: 1, go: jump('#fund/calendar') }),
        S('#w193host .w193meter', 'The donor program', 'Monthly donors against the goal, the tiers, the stewardship rhythm and the launch plan, with the giving totals from the CRM. Leaders tick what is in place and set the goals.', { opt: 1, go: jump('#fund/donors') }),
        S('#w193host .w193sops || #w193host .w193card', 'Event SOPs', 'How we run each fundraising event, step by step, with the lessons from last time. They live in the Avenue Academy; read them here, edit them there.', { opt: 1, go: jump('#fund/sops') })
      ] };
    } catch (e) { /* fine */ }
  }
  addTours();
