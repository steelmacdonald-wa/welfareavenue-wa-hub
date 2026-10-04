
  /* ---------- page tours: the steps (they point at the live DOM) ---------- */
  function S(sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; }
  function H(re, up, t, p, o) { var x = { h: re, up: up, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; }
  function C(t, p) { return { c: 1, t: t, p: p }; }
  var OPT = { opt: 1 };
  var TOURS = {
    chrome: { tab: 'mypage', icon: 'compass', hash: '#mypage', steps: [
      C('Welcome to the Hub', 'This two-minute tour shows the parts of the Hub that follow you on every page. Use the arrow keys or the buttons to move through it, and Esc to stop.'),
      S('nav.wa-nav || #w114bar', 'The menu', 'Every page lives here: Home, the Executive dashboard and the Calendar at the top, then Departments, Goals and projects, Meetings, Requests and inbox, People, Resources and Admin. A department folds open to show its team’s own pages, like Volunteering or the Content calendar.'),
      S('#globalSearch || .search-wrap', 'Search everything', 'Type a task, a person, a goal or a meeting and jump straight to it. It searches the whole Hub, not just the page you are on.', OPT),
      S('#w116jck', 'Check in', 'Starting a work session? Check in, and your hours on the Hub count from that moment. They show on your profile and in the HR centre.', OPT),
      S('.wa-toolbar .w115pill || #signOutBtn', 'Your account', 'Your name and the sign-out button live here.', OPT),
      S('#waChatBtn', 'Ask the Hub', 'Ask anything about what is happening at Welfare Avenue, or type a request or a task in plain words. It answers from the Hub’s live data and asks you to confirm before it saves anything.', OPT),
      C('Help on every page', 'Most pages have a How this page works button, and every page has a guided tour like this one in the Avenue Academy.')
    ] },
    home: { tab: 'mypage', icon: 'home', hash: '#mypage', steps: [
      S('#mpBody .mp-head', 'Your day at a glance', 'Home greets you with the date and your role. If you only check one page, check this one.'),
      S('#mpBody .mp-chips', 'Quick counts', 'Your open tasks, your team’s tasks, open decisions and new mentions. Click a chip to jump to that list.', OPT),
      S('#w116home', 'Your upcoming meetings', 'Meetings from the shared calendar that include you, with the agenda one click away.', OPT),
      S('#w112wrap', 'Get started with the Hub', 'Five first steps for new people. Each one ticks itself when you do it. They also live in the Onboarding section of the Avenue Academy.', OPT),
      S('#w74attn', 'Needs your attention', 'Mentions from meetings you were not in, and other things that need a look. Hit Got it once you have read one.', OPT),
      S('#w75card', 'Ask the Hub anything', 'Suggested questions to try with the assistant, based on what is happening this week.', OPT),
      H(/^My tasks/i, '.mp-sec', 'My tasks', 'Everything with your name on it, across every team, soonest due first. Tick a task to close it; overdue ones turn red.', OPT),
      H(/^Updates for you/i, '.mp-sec', 'Updates for you', 'Meeting notes that mention you or your team, newest first.', OPT),
      S('#w65menbox', 'Mentions', 'When a meeting you were not in discusses you, a card lands here so you stay in the loop.', OPT),
      H(/^My team/i, '.mp-sec', 'My team', 'Your teammates and their open work. Open a name to see what is on their plate.', OPT),
      H(/^Time commitments/i, '.mp-sec', 'Time commitments', 'Check-in hours for the last three weeks, so everyone can see how time is being spent.', OPT),
      S('#w89box', 'Slack notifications', 'Choose which Hub updates reach you in Slack.', OPT),
      S('#w105my', 'Time off', 'Request time off here. HR approves it in the HR centre and your days update.', OPT),
      S('#w105sign', 'Policies', 'Policies you still need to read and sign. They also appear in the Onboarding section of the Avenue Academy.', OPT)
    ] },
    team: { tab: 'dept', icon: 'people', hash: function () { return '#team/' + deptTab(); }, steps: [
      S('#w116host .w116top', 'Your team’s home', 'The team page brings together the team’s pulse, decisions, updates and meetings. The line under the name is the AI’s read of how the team is doing, from recent meetings.'),
      S('#w116host .w116seg', 'The team’s pages', 'Switch between Overview, Agenda, Tasks and any boards the team runs, like Volunteering or the Content calendar.', OPT),
      S('#w116host .w116kpis', 'Key numbers', 'Open and overdue tasks, work finished in the last 30 days, active projects and meetings coming up. Click a number to open the list behind it.', OPT),
      H(/^Where the team is/i, '.w116card', 'Where the team is', 'The pulse score and the high priority list, rebuilt from the latest transcripts. Re-run it after a big meeting.', OPT),
      H(/^Executive decisions for this team/i, '.w116card', 'Decisions for this team', 'Calls waiting on an executive, with who decides and the AI’s recommendation. Decide them on the Executive dashboard.', OPT),
      S('#w123tcard', 'Team inbox', 'Requests to this team, emails the Hub inbox filed for it (Jev pings the team\u2019s Slack channel only when one needs you soon) and asks spotted in its meetings. Open one to set its status, hand it on or mark it done.', OPT),
      S('#w116updcard', 'Updates', 'What each meeting changed for this team, newest first. Add an update or a task from the bottom of the card.', OPT),
      H(/^Mentions from other teams/i, '.w116card', 'Mentions from other teams', 'Where other teams talked about your people or your work, so nothing falls between teams.', OPT),
      S('#w116meet', 'Upcoming meetings', 'The team’s next meetings, with a link to build or open the agenda.', OPT),
      H(/^KPIs we track/i, '.w116card', 'KPIs we track', 'The measures this team reports on, with the latest value.', OPT),
      H(/^Projects/i, '.w116card', 'Projects', 'The team’s projects with their open tasks. Add a project here, or open All projects.', OPT),
      S('#w122sopcard', 'Our SOPs', 'The team\u2019s standard operating procedures, kept in the Avenue Academy. Open one before running the event or process again, and update it afterwards.', OPT),
      H(/^Team org chart/i, '.w116card', 'The team', 'Who is on the team. Click a person to open their profile.', OPT),
      H(/^Tools/i, '.w116card', 'Tools', 'Shortcuts to the pages this team uses most.', OPT)
    ] },
    tasks: { tab: 'dept', icon: 'list', hash: function () { return '#team/' + deptTab() + '/tasks'; }, steps: [
      S('#w116tasks .w116tb', 'Pick your view', 'See the team’s work as a List, a Board, a Calendar or a Tree, grouped by project, workstream, status or owner.'),
      S('#w116tasks .w116g', 'Groups', 'Each group folds open. Use + Add task inside a group to add a task straight into it.', OPT),
      S('#w116tasks .w116note', 'Working with tasks', 'Click a task for its details, comments and history. Type @ and a name in a comment to bring someone in: they get a Slack message with a link. Drag to reorder a task or move it to another group.', OPT),
      S('#w116agHost || #w116host .w116agnote', 'The team agenda', 'Agendas for this team’s meetings, drafted from transcripts and open work. Tick items off during the meeting.', { opt: 1, hash: function () { return '#team/' + deptTab() + '/agenda'; } })
    ] },
    overview: { tab: 'overview', icon: 'target', hash: '#overview', steps: [
      S('#overview > .w118mast', 'The executive view', 'The numbers, what changed, and the decisions that sit with the executives.'),
      S('#w35stats', 'The numbers', 'Open tasks across the organization, work finished this fiscal year and other headline counts. Our fiscal year runs October 1 to September 30.', OPT),
      S('#w116news', 'What’s new', 'Major announcements and changes since you last looked.', OPT),
      S('#w111folds', 'Folders', 'Decisions waiting, overdue tasks and the delivery numbers, each folded away until you open it.', OPT),
      S('#overview .w28my', 'Your plate', 'Your own open items, so the executive view never hides your to-do list.', OPT),
      S('#decFilters', 'Filter the decisions', 'Narrow the list by category: people, board, strategy, budget and more.', OPT),
      S('#decisionList', 'Executive decisions', 'Each decision names who decides and carries an AI recommendation. Tick one to record what was decided; you will be asked for a short note.', OPT),
      S('#overview .add-row', 'Add a decision', 'Anyone can raise a call that needs an executive.', OPT),
      S('#decDoneWrap', 'Decided', 'Every decision made, with its note, stays here for the record.', OPT)
    ] },
    dashboard: { tab: 'dashboard', icon: 'target', hash: '#dashboard', avail: function () { return staffOk() && !!document.getElementById('overview'); }, steps: [
      S('#w111body .w118mast || #dashboard .w118mast', 'How work moves', 'Time to close, open workload and aging, team by team.'),
      S('#w111body .progress-box', 'The headline', 'Open versus completed tasks, and the average days to close across the organization.', OPT),
      S('#w111body .dash', 'Days to close, by team', 'How long tasks take from first raised to closed, per department. Shorter bars mean work moves faster.', OPT),
      S('#w111body table.wa-tbl', 'Open workload and aging', 'How much is open per team and how old it is. Old open work is the first thing to review in a team meeting.', OPT)
    ] },
    orggoals: { tab: 'orggoals', icon: 'flag', hash: '#orggoals', steps: [
      S('#orggoals .w116ptop', 'Where we are going', 'The organization’s yearly and multi-year goals. Department goals roll up into these.'),
      S('#w116orghost .sum', 'At a glance', 'How many goals are in play, on track, or at risk.', OPT),
      S('#w116orghost .tb', 'Filter and add', 'Switch the horizon, filter by status, or add a new organizational goal.', OPT),
      S('#w116orghost article.w116og .hd', 'A goal', 'Each goal shows its horizon, status and owner. Click any part to edit it.', OPT),
      S('#w116orghost article.w116og .w116smart', 'SMART', 'Specific, Measurable, Achievable, Relevant and Time-bound. Fill in each letter so everyone reads the goal the same way.', OPT),
      S('#w116orghost article.w116og .w116win', 'What achieved looks like', 'Describe the day the goal is met. It keeps the goal honest.', OPT),
      S('#w116orghost article.w116og .w116inv', 'Who is involved', 'The teams, department goals, projects and tasks that roll up into this goal.', OPT),
      S('#w116orghost article.w116og .ft', 'Actions', 'Edit it, add a department goal under it, comment, or see it on the alignment map.', OPT)
    ] },
    goals: { tab: 'goals', icon: 'target', hash: '#goals', steps: [
      S('#goals > .w118mast', 'Every team’s goals', 'Quarterly goals for every team, with the projects and tasks that carry them.'),
      S('#glBody .sum', 'At a glance', 'Goals in play this quarter, the ones at risk or past due, and the ones achieved.', OPT),
      S('#glBody .chips', 'Filter by team', 'Show one team or all of them.', OPT),
      S('#glBody .tb', 'Pick the quarter', 'This quarter, next quarter or all quarters. Our fiscal year starts October 1.', OPT),
      S('#glBody .w116gg .gh', 'A team’s goals', 'Each team folds open. Use + Add goal to add one.', OPT),
      S('#glBody .w116ggrid', 'Goal cards', 'Status, due date and progress. Open a goal for its SMART detail, tasks and projects, and roll it up to an organizational goal.', OPT),
      S('#glBody details.w116sug', 'Suggested goals', 'The AI suggests goals it hears in transcripts and board meetings. Nothing is added until someone accepts one.', OPT)
    ] },
    projects: { tab: 'projects', icon: 'box', hash: '#projects', steps: [
      S('#projects .w116ptop', 'Every active project', 'Projects by team, with their status, lead and the goal they serve.'),
      S('#w116projhost .sum', 'At a glance', 'Active projects, open tasks in projects, and projects still without a lead.', OPT),
      S('#w116projhost .tb', 'Views and filters', 'Cards or a list, filtered by team.', OPT),
      S('#w116projhost .w116pg .gh', 'A team’s projects', 'Fold a team open, or add a project with + Add project.', OPT),
      S('#w116projhost .w116pc', 'A project card', 'Status, lead, owner team, linked goal and open tasks. Click it to open the project page.', OPT),
      S('#w116projhost p.note', 'One lead per project', 'Every project should have one lead: the person accountable for it.', OPT)
    ] },
    goalmap: { tab: 'goalmap', icon: 'link', hash: '#goalmap', steps: [
      S('#goalmap .w116ptop', 'How it all connects', 'Projects feed department goals, which feed organizational goals.'),
      S('#w116maphost .sum', 'Gaps at a glance', 'Projects without a goal and goals without projects show up here.', OPT),
      S('#w116maphost .chips', 'Filter by team', 'Focus the map on one team.', OPT),
      S('#w116maphost .w116mcols > .w116mcol:nth-child(1)', 'Projects', 'The work underway. A project marked Link to a goal is not connected yet: click it to link it.', OPT),
      S('#w116maphost .w116mcols > .w116mcol:nth-child(2)', 'Department goals', 'Quarterly goals per team, rolling up to the organization.', OPT),
      S('#w116maphost .w116mcols > .w116mcol:nth-child(3)', 'Organizational goals', 'The yearly and multi-year direction.', OPT),
      S('#w116maphost p.note', 'Try it', 'Hover anything to light up its chain; click it to pin it.', OPT)
    ] },
    project: { tab: 'projects', icon: 'box', hash: function () { return '#project/' + projectId(); }, avail: function () { return !!projectId(); }, steps: [
      S('#projectpage .card > h2', 'A project page', 'One project’s name, team and status.'),
      S('#projectpage .w27-desc', 'What it is', 'A short description of the project.', OPT),
      S('#w104', 'Progress and people', 'Tasks complete, the lead (the one person accountable) and the contributors. Change the lead here.', OPT),
      S('#projectpage .w27-task', 'Open tasks', 'Tasks from every team working on this project. Click a title to open the task, as on a team page: status, owner, assignees, due date, description, subtasks, comments and its history. Push it to the bank from there too. Tick one done (Undo stays on the row for a few seconds), or move it to another project.', OPT),
      S('#projectpage .add-row', 'Add a task', 'Quick-add a task straight into the project.', OPT),
      S('#projectpage [data-w207link]', 'Link existing tasks', 'Bring in tasks that already exist: search the team’s open tasks (or every team’s), tick the ones that belong here and link them. A task in another project moves.', OPT),
      S('#projectpage details.completed', 'Completed', 'Finished tasks keep their history.', OPT)
    ] },
    requests: { tab: 'requests', icon: 'chat', hash: '#requests/new', steps: [
      S('#requests > .w118mast', 'Asking another team', 'Ask another team for something, follow it through to done, and see what came in for your own team.'),
      S('#w123 .w123seg', 'Three places', 'New request to ask a team for something. My requests to follow what you asked for. Team inbox for what came in for your team. Leaders also see All requests.'),
      S('#w123 .w123search', 'Search or pick', 'Type what you need (a flyer, a reimbursement, time off, volunteers) to jump straight to the right form.', OPT),
      S('#w123 .w123teams', 'Start with the team', 'Each tile says what the team is asked for and the Slack channel where your request is posted. Pick one, then pick what you need or Something else, and fill in the short form.', OPT),
      S('#w123 .w123list', 'Spotted in meetings', 'Asks the Hub heard in recent meetings. Nothing is filed until someone accepts it; they also wait in the team\u2019s inbox.', OPT),
      S('#w123 .w123seg a[data-w123go^="#requests/team"]', 'Your team inbox', 'Requests to your team, emails the Hub inbox filed for it, and asks spotted in its meetings, in one list. Open anything to set its status, hand it on, mark it done or add a note; notes go into the Slack thread too.', OPT)
    ] },
    transcripts: { tab: 'transcripts', icon: 'mic', hash: '#transcripts', steps: [
      S('#transcripts > .w118mast', 'Meetings become work', 'Every meeting the Hub has read, and where to add the next one.'),
      S('#txDept', 'Pick the department', 'Choose the team the meeting belongs to, or Leadership to spread it across every team.', OPT),
      S('#txBody', 'Paste the transcript', 'Paste the full transcript from Otter, Plaud, Zoom or Meet. Add the date and a title if the Hub cannot read them from the text.', OPT),
      S('#w62type || #w62people', 'Who can see it', 'Everyone, leaders only, or confidential to the people you pick. Restricted meetings stay sealed, even from the assistant.', OPT),
      S('#txSave', 'Save and review', 'You get a preview of every task, closure, update, decision and mention the AI wants to file. Nothing saves until you approve it.', OPT),
      S('#txSearch || #txFilter', 'Find a meeting', 'Search the archive, or filter it by team.', OPT),
      S('#txList', 'The archive', 'Every transcript shows what it contributed. Use Reprocess if something did not land.', OPT)
    ] },
    agendas: { tab: 'agendas', icon: 'list', hash: '#agendas', steps: [
      S('#agendas > .w118mast', 'Agendas', 'Build the agenda, run the meeting, tick items off as they happen.'),
      S('#agendas .ag-new', 'Start a new agenda', 'Pick the meeting type (a department, the leaders, or a one-on-one or group), the team, the people and the date.', OPT),
      S('#w53purpose', 'Say what the meeting is for', 'A one-line purpose helps the AI pull the right tasks and topics.', OPT),
      S('#agNewGen', 'Generate', 'Drafts the agenda from recent transcripts and live tasks. Items linked to real tasks carry live checkboxes.', OPT),
      S('#agendas .ag-filters', 'Filter', 'By department or status. You only see agendas you are part of.', OPT),
      S('#agPageBody .ag-row', 'An agenda', 'Open it to reorder items, add your own, mark it final, or share a private link with people outside the Hub.', OPT)
    ] },
    hubmail: { tab: 'hubmail', icon: 'chat', hash: '#hubmail', steps: [
      S('#hubmail .w116ptop || #hubmail > .w118mast', 'The Hub inbox', 'Cc hub@welfareavenue.com on anything worth keeping. The Hub reads it and files it in the right place.'),
      S('#w116mailhost .top', 'Last check', 'When the inbox was last read, and what happened: filed, ignored or failed.', OPT),
      S('#w116mailhost .sum', 'What was filed', 'Invoices go to Finance, meeting summaries become transcripts, and updates land on the right team page.', OPT),
      S('#w116mailhost .how', 'How it works', 'The short version of what to cc and what happens next.', OPT),
      S('#w116mailhost .chips', 'Filter', 'Everything, invoices, meeting summaries, updates, or emails waiting for a team.', OPT),
      S('#w116mailhost .w116mr', 'An email', 'Who sent it, when, what the Hub decided it was, and where it filed it.', OPT)
    ] },
    orgchart: { tab: 'orgchart', icon: 'people', hash: '#orgchart', steps: [
      S('#orgchart > .w118mast', 'Who does what', 'The live structure, built from the team roster.'),
      S('#ocBody > div:nth-child(2)', 'The board', 'The board of directors.', OPT),
      S('#ocBody > div:nth-child(4)', 'The executive directors', 'The co-executive directors who lead day to day.', OPT),
      S('#ocBody > div:nth-child(6)', 'The departments', 'Each team with its lead and members. Show team opens the full list.', OPT),
      S('#ocBody .oc-card', 'A department', 'Click anyone to open their profile: responsibilities, current plate, meetings and training progress.', OPT)
    ] },
    person: { tab: 'orgchart', icon: 'user', hash: function () { return '#person/' + personId(); }, avail: function () { return !!personId(); }, steps: [
      S('#personpage .w116k .crumbs', 'A person’s page', 'Everyone has one. Get here from the Org chart or by clicking a name anywhere in the Hub.'),
      S('#personpage .w116k > .w116card', 'Who they are', 'Name, role, team and contact.', OPT),
      S('#personpage .w116kpis', 'Their numbers', 'Open work, work finished this fiscal year and hours on the Hub this month.', OPT),
      S('#w116krespcard', 'Main responsibilities', 'Three to five lines on what this person owns. Keep yours current.', OPT),
      S('#w116kopen', 'On their plate', 'Open tasks with their name on them.', OPT),
      S('#w116kabout', 'About', 'A bio written from their latest work. Rewrite it from the latest work whenever it drifts.', OPT),
      S('#w122pk || #w116ktrain', 'Avenue Academy', 'Their level, certificates and badges from the Avenue Academy.', OPT),
      S('#w116kmeet', 'Their meetings', 'Upcoming meetings they are part of.', OPT)
    ] },
    academy: { tab: 'training', icon: 'book', hash: '#training', steps: [
      S('#w122 .w122onb', 'Onboarding comes first', 'Your onboarding plan, the Hub first steps and the policies to sign, in one place at the top.', OPT),
      S('#w122 .w122hero', 'Your progress', 'Your level, XP, streak, certificates and badges. The rings show onboarding, required learning and your progress to the next level.'),
      S('#w122 [data-sec="next"]', 'Up next', 'What you started, what was assigned to you, and what is recommended for your team.', OPT),
      S('#w122 [data-sec="paths"]', 'Learning Avenues', 'Short series with a certificate at the end.', OPT),
      S('#w122 [data-sec="sops"]', 'Our SOPs', 'How we run the things we do again and again, step by step, with what we learned last time. Your team\u2019s come first, and each one links to its events on the events calendar. Leaders and team members can write and update them.', OPT),
      S('#w122 [data-sec="tours"]', 'Page tours', 'A guided walkthrough for every page of the Hub. Tour them all for the Hub Navigator certificate.', OPT),
      S('#w122 [data-sec="library"]', 'The library', 'Every training: videos, lessons, reading and documents. Filter by type or topic, or search.', OPT),
      S('#w122 [data-sec="trophies"]', 'Trophy case', 'Your certificates and badges. Certificates can be printed or shared with the team.', OPT),
      S('#w122 [data-sec="feed"]', 'Celebrate each other', 'What people across Welfare Avenue earned recently.', OPT)
    ] },
    volunteering: { tab: 'volunteering', icon: 'bowl', hash: '#volunteering', steps: [
      S('#volunteering > .w118mast', 'The serving programme', 'Events, volunteers and supplies for Montreal, end to end.'),
      S('#volunteering .vl-sub', 'Sections', 'The calendar, the master program SOP, volunteers, inventory, recipes and texting volunteers.', OPT),
      S('#w106add', 'Add an event', 'Create a serving or a special event. It copies the master SOP checklist so nothing is missed.', OPT),
      S('#volunteering .vl-hero', 'The next event', 'The countdown, readiness and what still needs doing.', OPT),
      S('#w119cal', 'The month', 'Every event on a calendar, with its readiness and gaps.', OPT),
      S('#volunteering .vl-grid', 'Events', 'Each card shows readiness and gaps. Open one for its command centre.', OPT),
      S('#w119 .mast', 'The event command centre', 'Date, countdown, venue, meals and two readiness rings: the checklist and the roster.', { opt: 1, go: function () { var e = document.querySelector('#volunteering .vl-grid [data-vlev]') || document.querySelector('#volunteering [data-vlev]'); if (e) location.hash = '#volunteering/e/' + e.getAttribute('data-vlev'); } }),
      S('#w119 .next', 'What’s next', 'The three most urgent unticked steps, each with a one-tap tick.', OPT),
      S('#w119left', 'The checklist', 'Every step from the master SOP, grouped by phase. Tick as you go; owners follow the role assignments.', OPT),
      S('#w119right', 'The roster board', 'One column per role. Drag volunteers between roles, or add them from the bench of available people.', OPT),
      S('#w119rail', 'Side rail', 'The event summary, tasks that came from meetings, and cancelling the event.', OPT)
    ] },
    hrcentre: { tab: 'hrcentre', icon: 'people', hash: '#hrcentre', steps: [
      S('#hrcentre > .w118mast', 'HR centre', 'People records, hours, onboarding, training, hiring and policies in one place.'),
      S('#w116phero', 'At a glance', 'Headcount, hours, onboarding in flight and trainings outstanding. Click a tile to jump to it.', OPT),
      S('#w46body .w47tabs', 'Sections', 'People, Onboarding, Training, Recruitment, Commitment, Policies and Discipline.', OPT),
      S('#w116pshouts', 'Shout-outs', 'Good work, noticed. Add one for a teammate; Avenue Academy certificates can be shared here too.', OPT),
      S('#w116ppeople .grid || #w116ppeople', 'People', 'Everyone on the roster with their team, start date and hours this month.', OPT),
      S('#w103scope', 'Scope of work', 'What each person has been working on, from their check-ins.', OPT),
      S('#w105to', 'Time off', 'Requests waiting on a decision, and the days taken this fiscal year.', OPT),
      S('#w93eng', 'Hub engagement', 'Who is using the Hub: last sign-in, visits and time on the Hub.', OPT)
    ] },
    finances: { tab: 'finances', icon: 'scale', hash: '#finances', steps: [
      S('#finances > .w118mast', 'Finances and budgeting', 'Statements, the ledger and budgets per team. The fiscal year runs October 1 to September 30.'),
      S('#finances .fin-head', 'The source', 'Which fiscal year you are looking at and where the budgets come from. Import a statement from here.', OPT),
      S('#w92pills', 'Time frame', 'Last fiscal year, this one, or the forecast.', OPT),
      S('#w94nav', 'Views', 'The overview, trends, the money map, budget against actual, and every transaction.', OPT),
      S('#finances .fin-kpis', 'The headline', 'Income, spending and net for the fiscal year so far.', OPT),
      S('#w92health', 'Nonprofit health', 'Standard charity-sector measures computed from the ledger, with guidelines for a young Canadian charity.', OPT),
      S('#w93tasks', 'Finance tasks', 'Every finance task across the Hub in one list.', OPT),
      S('#w93meet', 'Finance meetings', 'The meetings where money was discussed.', OPT)
    ] },
    contentcal: { tab: 'contentcal', icon: 'grid', hash: '#contentcal', steps: [
      S('#contentcal .w116top', 'Content calendar', 'Plan, publish and confirm Instagram and Facebook posts.'),
      S('#contentcal .ctl', 'Views', 'Month, week or list, and move between months.', OPT),
      S('#contentcal .chips', 'Filters', 'By platform, and by state: planned, live, or needs attention.', OPT),
      S('#contentcal .cap', 'The Meta connection', 'Shows whether the Hub can publish for you. With publishing on, you can schedule and publish from here; otherwise it plans posts and confirms them when they appear on Meta.', OPT),
      S('#contentcal .glance', 'This week', 'Planned and live posts this week, the next post, anything that needs attention, and ideas waiting for a date.', OPT),
      S('#contentcal .mg || #contentcal .lay', 'The calendar', 'Click + on a day to plan a post. Drag posts between days; you can undo a move.', OPT),
      S('#contentcal .tray', 'Ideas', 'Posts without a date. Ideas raised in marketing meetings land here too, with the meeting they came from. Drag one onto a day to plan it, or open it and put it in the bank until later.', OPT),
      C('The composer', 'Open any post to write the caption (the AI drafts it in the Welfare Avenue voice), add images, check the preview, then plan it, schedule it or publish it now.')
    ] },
    socialstats: { tab: 'socialstats', icon: 'target', hash: '#socialstats', steps: [
      S('#socialstats .w116top', 'Marketing analytics', 'Followers, reach and what worked across Instagram, Facebook, TikTok, LinkedIn and the website.'),
      S('#socialstats .w120ctl', 'Time window', 'Look at the last 7, 30 or 90 days.', OPT),
      S('#socialstats .hero', 'Connections', 'What is connected, and what still needs setting up.', OPT),
      S('#socialstats .w120tiles', 'Platforms', 'Followers and reach per platform, with the change since the previous period.', OPT),
      S('#socialstats .ins', 'Insights', 'Directional recommendations from the evidence: the best days and times, the formats that work. Plan it sends a suggestion to the content calendar.', OPT),
      S('#socialstats .cardy.chart', 'By day', 'Daily numbers per platform. Switch the measure at the top of the chart.', OPT),
      S('#socialstats .posts', 'Top posts', 'Recent posts ranked by what worked.', OPT)
    ] },
    create: { tab: 'create', icon: 'sparkle', hash: '#create', avail: function () { return staffOk() && !!document.getElementById('create'); }, steps: [
      S('#create > .w118mast', 'Create studio', 'Branded drafts from a short brief.'),
      S('#cdType', 'What are you making?', 'An email, a social post or graphic, a one-pager, a newsletter and more.', OPT),
      S('#cdAud', 'Who is it for?', 'Partners, donors, volunteers, the board, staff or the public. The tone adapts.', OPT),
      S('#cdLang', 'Language', 'English or French.', OPT),
      S('#cdDept', 'Ground it in a team', 'Pulls that team’s recent meeting notes, open tasks and goals into the draft, so it is specific.', OPT),
      S('#cdBrief', 'The brief', 'A few lines on what you need. The more specific, the better the draft.', OPT),
      S('#cdGo', 'Write it', 'The draft appears in the Welfare Avenue brand. Refine it with follow-up instructions, then copy, download or send it for review.', OPT),
      S('#cdList', 'Recent drafts', 'Everything drafted recently, to reopen or reuse.', OPT)
    ] },
    brain: { tab: 'brain', icon: 'compass', hash: '#brain', steps: [
      S('#brain > .w118mast', 'The Brain', 'How work flows through Welfare Avenue: people, meetings, tasks, projects, goals and decisions on one living map.'),
      S('#brain .w87bar', 'Controls', 'Pick the time window, press Time-lapse to watch the month unfold, or focus on one person or goal.', OPT),
      S('#brain .w87wrap', 'The map', 'Drag to move around, scroll to zoom, and click any dot to see what it is and what it connects to.', OPT),
      S('#brain .w87leg', 'The legend', 'What each colour means. Quiet items are hidden to keep the map readable.', OPT)
    ] },
    importantinfo: { tab: 'importantinfo', icon: 'doc', hash: '#importantinfo', steps: [
      S('#importantinfo > .w118mast', 'Important info', 'Logins, links and documents the team reaches for most.'),
      S('#infoBody .pw-note', 'Logins', 'Everyone on staff sees the list. A password stays hidden until you press Request access and an admin approves it; then you can show and copy it. Whoever adds a login can always see it.', OPT),
      S('#infoBody .w134req', 'Requests (admins)', 'Admins see who asked for which login, and grant or decline it here. The number next to Important info in the menu says how many are waiting.', OPT),
      H(/^Training videos/i, null, 'Training videos', 'Loom walkthroughs worth knowing, tagged by team. The full video library lives in the Avenue Academy.', { opt: 1, range: 1 }),
      H(/^Shared Google Drive/i, null, 'Shared drives', 'Team drives and document sets.', { opt: 1, range: 1 }),
      H(/^Other key links/i, null, 'Other key links', 'Decks, brand files and the other links everyone uses.', { opt: 1, range: 1 }),
      S('#infoBody .info-add', 'Add an entry', 'Staff can add a login, video, folder or link, tagged to a team.', OPT)
    ] },
    photos: { tab: 'photos', icon: 'sparkle', hash: '#photos', steps: [
      S('#photos .w116ptop', 'Photo library', 'Our photos, labelled and cleared for use. Each one says what it is cleared for before you post it.'),
      S('#w118cq || #photos .srch', 'Search', 'Search titles, alt text, captions, tags, places, sets and years.', OPT),
      S('#w118cscene', 'Scene and order', 'Filter by scene (serving, volunteers, food, media, portraits, setup) and choose the order.', OPT),
      S('#photos .chips', 'Cleared for use', 'Ready is fine for public use; Crop first names the edge to crop; Consent needed means someone recognizable has to agree before public use.', OPT),
      S('#photos .grid', 'The photos', 'Grouped by year, newest first. Open a photo for its alt text, caption and downloads, or to use it in the Create studio or a post.', OPT),
      S('#photos .add', 'Add photos', 'Staff can add photos: the Hub makes three sizes, strips location data and suggests labels for you to check.', OPT)
    ] },
    activity: { tab: 'activity', icon: 'clock', hash: '#activity', steps: [
      S('#activity > .w118mast', 'Activity', 'Every change in the Hub, human or AI, newest first: the audit trail.'),
      S('#activity .filters', 'Filters', 'Filter by type, person and time window.', OPT),
      S('#activity table.wa-tbl', 'The log', 'When, who, what changed, and the before and after.', OPT)
    ] },
    adminpanel: { tab: 'adminpanel', icon: 'shield', hash: '#adminpanel/ai', steps: [
      S('#adminpanel > .w118mast', 'Admin', 'The settings that shape the Hub for everyone.'),
      S('#adminpanel nav.w118adm', 'Sections', 'AI models, adoption, workspace accounts, people and access, security, and changing the Hub.', OPT),
      S('#w116ncard', 'AI models', 'Which model answers each job, with fallbacks and weekly spend.', OPT),
      S('#w116rcard', 'Adoption', 'Who uses the Hub and how much: sign-ins, hours, tasks closed and AI spend.', { opt: 1, hash: '#adminpanel/adoption' }),
      S('#w116lcard', 'Workspace accounts', 'Google Workspace accounts, placed on the roster or set aside.', { opt: 1, hash: '#adminpanel/accounts' }),
      S('#w113card', 'People and access', 'Everyone on the roster, what they can see, their invitations and the access requests.', { opt: 1, hash: '#adminpanel/people' }),
      S('#w86card', 'Security and audit', 'What the Hub enforces, the backups, and every change with who made it.', { opt: 1, hash: '#adminpanel/security' }),
      S('#w96card', 'Change the Hub', 'Edit content with AI, or file a build request.', { opt: 1, hash: '#adminpanel/change' })
    ] }
  };
  function tourAvail(key) {
    var d = TOURS[key]; if (!d) return false;
    if (d.avail) return !!d.avail() && (d.tab === 'dept' || !d.tab || d.tab === 'dashboard' || d.tab === 'create' || tabVisible(d.tab) || allowed(d.tab));
    if (d.tab === 'dept') return !!deptTab();
    return !d.tab || tabVisible(d.tab) || allowed(d.tab);
  }
  function allowed(tab) { try { return typeof wa40Allowed === 'function' && wa40Allowed().indexOf(tab) >= 0 && !!document.getElementById(tab); } catch (e) { return false; } }

  /* ---------- the tour engine ---------- */
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function vis(el) { if (!el || !el.getClientRects || !el.getClientRects().length) return false; var r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; var cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.02; }
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function resolveStep(st) {
    if (!st || st.c) return null;
    if (st.s) {
      var alts = st.s.split('||');
      for (var i = 0; i < alts.length; i++) {
        var list; try { list = document.querySelectorAll(alts[i].trim()); } catch (e) { list = []; }
        for (var j = 0; j < list.length; j++) if (vis(list[j])) return st.up ? (list[j].closest(st.up) || list[j]) : list[j];
      }
      return null;
    }
    if (st.h) {
      var root = document.querySelector('.panel.active') || document;
      var hs = root.querySelectorAll('h1,h2,h3,h4,summary');
      for (var k = 0; k < hs.length; k++) if (vis(hs[k]) && st.h.test(norm(hs[k].textContent))) return st.up ? (hs[k].closest(st.up) || hs[k]) : hs[k];
    }
    return null;
  }
  function stepRect(st, el) {
    var r = el.getBoundingClientRect(), box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    if (st.range) {
      var tag = el.tagName, n = el.nextElementSibling, guard = 0;
      while (n && n.tagName !== tag && guard++ < 40) { if (vis(n)) { var q = n.getBoundingClientRect(); box.l = Math.min(box.l, q.left); box.r = Math.max(box.r, q.right); box.b = Math.max(box.b, q.bottom); } n = n.nextElementSibling; }
    }
    return box;
  }
  function waitFor(fn, ms) {
    return new Promise(function (res) {
      var t0 = performance.now();
      (function poll() { var v = null; try { v = fn(); } catch (e) { v = null; } if (v || performance.now() - t0 > ms || !T) return res(v || null); setTimeout(poll, 150); })();
    });
  }
  function goHash(h) {
    return new Promise(function (res) {
      if (!h || location.hash === h) return res(false);
      location.hash = h; if (T) T.navAt = performance.now(); setTimeout(function () { res(true); }, 650);
    });
  }
  function tourLayer() {
    var el = document.querySelector('.w122tp');
    if (!el) {
      el = document.createElement('div'); el.className = 'w122tp';
      el.innerHTML = '<div class="catch"></div><div class="hole none"></div><div class="pop" role="dialog" aria-live="polite"></div>';
      document.body.appendChild(el);
    }
    return el;
  }
  function startTour(key) {
    var d = TOURS[key];
    if (!d || !tourAvail(key)) { toastS('That tour is not available for your account'); return; }
    closeSheet(true); endTour(true);
    var steps = (typeof d.steps === 'function' ? d.steps() : d.steps).slice();
    T = { key: key, d: d, steps: steps, i: -1, max: 0, tr: A.byKey['tour:' + key] || null, busy: false, navAt: performance.now() };
    var tr = T.tr; if (tr) { var cur = mine(tr.id); if (!cur || cur.status !== 'done') saveProg(tr, { status: cur && cur.status === 'assigned' ? 'assigned' : 'started', started_at: (cur && cur.started_at) || nowIso(), last_step: 0 }); }
    tourLayer();
    var h = typeof d.hash === 'function' ? d.hash() : d.hash;
    goHash(h).then(function () { showStep(0, 1); });
  }
  async function showStep(i, dir) {
    if (!T) return;
    if (i < 0) i = 0;
    if (i >= T.steps.length) return finishTour();
    var st = T.steps[i]; T.i = i; T.busy = true;
    var pop = document.querySelector('.w122tp .pop'); if (pop) pop.style.opacity = '.4';
    if (st.hash) { var h = typeof st.hash === 'function' ? st.hash() : st.hash; if (h) await goHash(h); }
    if (st.go) { try { st.go(); T.navAt = performance.now(); } catch (e) { /* the step shows centred */ } await wait(1100); }
    /* right after a navigation the page is still drawing, so wait longer; otherwise a missing optional part is skipped quickly */
    var fresh = performance.now() - (T.navAt || 0) < 3500;
    var el = st.c ? null : await waitFor(function () { return resolveStep(st); }, fresh ? (st.opt ? 2600 : 4500) : (st.opt ? 450 : 1500));
    if (!T || T.i !== i) return;
    if (!el && st.opt && !st.c) {
      var ni = i + (dir < 0 ? -1 : 1);
      if (ni < 0) { dir = 1; ni = i + 1; }
      return showStep(ni, dir);
    }
    T.el = el; T.max = Math.max(T.max, i);
    if (el) {
      var r = el.getBoundingClientRect(), vh = innerHeight;
      if (r.top < 70 || r.bottom > vh - 30) {
        var top = scrollY + r.top - (r.height < vh - 220 ? Math.max(80, (vh - r.height) / 2 - 40) : 90);
        window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' });
        await wait(reduced() ? 60 : 480);
      }
    }
    T.busy = false;
    renderPop(st); place();
  }
  function renderPop(st) {
    var pop = document.querySelector('.w122tp .pop'); if (!pop || !T) return;
    var n = T.steps.length, i = T.i;
    var tt = T.tr ? String(T.tr.title).replace(/^Page tour:\s*/, '') : T.key;
    var dots = n <= 16 ? '<div class="dots">' + T.steps.map(function (s, k) { return '<i class="' + (k === i ? 'on' : (k < i ? 'ok' : '')) + '"></i>'; }).join('') + '</div>' : '<div class="dots" style="font-size:12px;color:#797773">' + (i + 1) + ' of ' + n + '</div>';
    pop.innerHTML = '<div class="tk">' + ic('map') + ' ' + E(tt) + '<span class="sp"></span><button data-w122tx="1" title="End the tour (Esc)">' + ic('x') + '</button></div><h4>' + E(st.t) + '</h4><p>' + E(st.p) + '</p>' +
      '<div class="pf">' + dots + (i > 0 ? '<button class="w122btn soft sm" data-w122tprev="1">Back</button>' : '') + '<button class="w122btn sm" data-w122tnext="1">' + (i >= n - 1 ? 'Finish' : 'Next') + '</button></div>';
    pop.style.opacity = '1';
    var nb = pop.querySelector('[data-w122tnext]'); if (nb) try { nb.focus({ preventScroll: true }); } catch (e) { /* fine */ }
  }
  function place() {
    if (!T) return;
    var L = document.querySelector('.w122tp'); if (!L) return;
    var hole = L.querySelector('.hole'), pop = L.querySelector('.pop');
    var st = T.steps[T.i] || {}, el = T.el && T.el.isConnected ? T.el : null;
    if (!el && !st.c && T.el) { el = resolveStep(st); T.el = el; }   /* the page repainted under the tour: find the part again */
    var W = innerWidth, Hh = innerHeight, pw = Math.min(360, W - 24), ph = pop.offsetHeight || 200;
    if (!el) {
      hole.className = 'hole none';
      pop.style.left = Math.round((W - pw) / 2) + 'px'; pop.style.top = Math.round(Math.max(20, (Hh - ph) / 2)) + 'px';
      return;
    }
    var b = stepRect(st, el), pad = 8;
    var l = Math.max(6, b.l - pad), t = Math.max(6, b.t - pad), r = Math.min(W - 6, b.r + pad), bt = Math.min(Hh - 6, b.b + pad);
    if (bt - t < 24) { bt = t + 24; }
    hole.className = 'hole';
    hole.style.left = l + 'px'; hole.style.top = t + 'px'; hole.style.width = Math.max(24, r - l) + 'px'; hole.style.height = Math.max(24, bt - t) + 'px';
    if (W < 700) return;
    var x, y;
    if (r + 16 + pw <= W - 12) { x = r + 16; y = Math.min(Math.max(12, t), Hh - ph - 12); }
    else if (l - 16 - pw >= 12) { x = l - 16 - pw; y = Math.min(Math.max(12, t), Hh - ph - 12); }
    else if (bt + 14 + ph <= Hh - 12) { y = bt + 14; x = Math.min(Math.max(12, l), W - pw - 12); }
    else if (t - 14 - ph >= 12) { y = t - 14 - ph; x = Math.min(Math.max(12, l), W - pw - 12); }
    else { x = W - pw - 20; y = Hh - ph - 20; }
    pop.style.left = Math.round(x) + 'px'; pop.style.top = Math.round(y) + 'px';
  }
  var placeQ = 0;
  function placeSoon() { if (!T || placeQ) return; placeQ = requestAnimationFrame(function () { placeQ = 0; place(); }); }
  window.addEventListener('scroll', placeSoon, { passive: true });
  window.addEventListener('resize', placeSoon);
  function endTour(silent) {
    var L = document.querySelector('.w122tp'); if (L) L.remove();
    if (T && !silent && T.tr && !isDone(T.tr.id)) saveProg(T.tr, { last_step: T.max, pct: Math.min(95, Math.round(100 * (T.max + 1) / Math.max(1, T.steps.length))) });
    var was = T; T = null;
    if (was && !silent) toastS('Tour paused. Pick it up again from the Avenue Academy.');
  }
  async function finishTour() {
    if (!T) return;
    var tr = T.tr, key = T.key;
    var L = document.querySelector('.w122tp'); if (L) L.remove();
    T = null;
    if (tr) await complete(tr, { last_step: TOURS[key] ? TOURS[key].steps.length : 0 });
    else celebrate(null, { s: stats() });
  }
