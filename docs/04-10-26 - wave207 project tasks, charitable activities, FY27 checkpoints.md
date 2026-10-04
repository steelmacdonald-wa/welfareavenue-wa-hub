# 04/10/26 - wave207: project tasks are department tasks; the charitable activities; this year's goals (FY27)

Live md5 `10204c4162add6bd190e75449db9be0b` (6,530,303 bytes) on wave206's `7a739c22`, one deploy (stage `wa_stage_207d`, closed to the API; host-sync; the served page checked by md5 and loaded live with no page error). Migrations `wa207a_history_kinds`, `wa207_activities_fy27` (staged in `wa_stage_207q` run 2, md5 checked, recorded as version 20261004213000), `wa207b_link_tasks`, `wa207c_checkpoint_comments`, `wa207_deploy_gate` (with `build/data/wa207_release.sql`), `wa207_release_line`. change_log release line `release / wave207 / hub_build`.

## 1. Project tasks are department tasks

Steel: "I need the tasks of a project to [use] the data found on the home page of each department. Individuals should be able to open the tasks the same way they find them in their department task page to edit descriptions, due dates, assignees, push to the bank etc."

- Opening: since wave206 every task title on `#project/<id>`, open and completed, opens the team pages' own drawer (`w116Board.open`, with 116t's description, subtasks and attachments, 116m's chips, 132's Move to the bank, 138's @mentions). Nothing new here; checked again in `test/w207drive.js`.
- Ticking (`src/207_wave207.seg`): the project page's checkbox now goes through `toggleTask`, the team pages' save (dept_tasks plus its `dept_task` change_log line), with an Undo on the row for 10 seconds, then the page repaints in place (`w206.repaint`). wave27's own update ("(project page)" change_log lines) no longer runs.
- Link existing tasks: staff (not board viewers) get a picker on a named project: the team's open tasks not in this project (or every team's), searchable by title, workstream, owner or number, each saying where it sits now ("moves from Beneficiary Feedback Project", "no project yet"). Linking updates `dept_tasks.project_id` and writes a change_log line per task (old project, new project).
- A project made from a retired goal (wave205's Make it a project) says so and lists the team's projects that serve the same goal with their open tasks.
- A project linked to a quarterly checkpoint shows "Serves the checkpoint FY27 Qn: ..." under its goal line.
- The project page already read the same rows as the team pages: wave99 loads `dept_tasks` by `project_id` across every team (subtasks included, as the boards show them). Nothing to change there.

### The empty Program Development project

Project 31, "Implement a comprehensive beneficiary feedback system by August 30, 2026...", was made by Steel at 20:20 UTC on 04/10/26 from the retired goal 19 with Make it a project. `strategy_retired_to_project` creates an empty project (the retired goals carried no task ids), so "0 of 0 tasks complete" was true. The team's related work sits in other projects: Beneficiary Feedback Project (4) holds #11 (beneficiary data capture at every event) and #342 (beneficiary name and needs tracking); Survey Project (3) holds the survey and questionnaire tasks; task #4 ("Plan August beneficiary event + volunteer recognition") is in Volunteer Relations (22, Operations Montreal). Projects 4 and 31 overlap; which tasks move, or whether 31 replaces 4, is for the team.

### Linked in the database (unambiguous only, `wa207b_link_tasks`)

16 completed Fundraising tasks whose workstream names exactly one project of their team: Donor program to Donor Program (4: #42, #84, #109, #134), Fundraising events to Fundraising Events (6: #38, #41, #94, #96, #352, #362), Grants to Grants Program (6: #28, #30, #32, #90, #92, #93). Each has a change_log line by "wave207 migration".

### Left for people

- Project 31 and project 4 (above).
- Open tasks with no project: Finance's six bills (#616 Netlify, #617 Quo, #645 Atlassian, #660 and #661 DigitalOcean, #675 BMO), Program Development's #622 (softball and flag football leagues, Brianna) and #636 (Ola's bracelet initiative document, Shima).

## 2. The charitable activities

From the plan's section "Anchored in our 8 charitable activities" and each goal's "Charitable activities:" line (the Claude Doc "29/09/26 - Welfare Avenue Organizational Goals FY27-FY31 (Draft)", revision 369), in its words:

- `charitable_activities` (the 8, migrations only: the wording is what the CRA holds).
- `goal_activities` (goal, activity, the short reason): goal 1: 3, 4, 7; goal 2: 2, 5, 8; goal 3: 6, 1; goal 4: 1, 7; goal 5: 6. `goals.activities_note`: goal 4 "It funds all eight.", goal 5 "It keeps all eight running."
- On the page (`build/parts205/g_year.js`): chips on each goal (the reason on hover, and on tap), a Charitable activities column in the goals at a glance, the "8 activities" strip with every activity's goals and "All 8 covered" (a tile with no goal would be flagged). Owners and admins add or take off an activity (`strategy_activity_set`) and edit the reason (`strategy_save` 'activity'), live, with history and Restore.

## 3. This year's goals (FY27)

From "This year's goals: FY27 (Oct 1, 2026 to Sep 30, 2027)", in its words: `goal_year_targets` (one per goal and year: the target and who reports on it) and `goal_checkpoints` (Q1 to Q4, due Dec 31 2026, Mar 31, Jun 30 and Sep 30 2027; status not started, on track, at risk or done). The plan's title, intro and note are `strategy_plan` `year_fy27`.

- The This year view at the top of Goals: the four quarters with the current one highlighted (Q1 on 04/10/26), Due next (Dec 31, 2026, the five Q1 checkpoints), Overdue (checkpoints past their date and not done, flagged in red), the FY27 table (target, Q1 to Q4 with status, owners; the current quarter's column highlighted; a row opens the goal), and the plan's note.
- Each goal card holds its FY27 block: the target and its owners (editable), the four checkpoints (status, words, due date), their comments (`strategy_checkpoint_comment_add`, threaded, @mentions through the existing flow) and the projects serving each (link icon).
- Projects link to a checkpoint as well as a goal: the link sheet offers the goal's checkpoints (`strategy_link_checkpoint`); moving a project to another goal clears a checkpoint of the old one (`strategy_link_project`, replaced with the same signature).
- Everything through the checked functions: `strategy_save` learns the entities activity, target and checkpoint (and the goal's `activities_note`); `strategy_restore` restores them; the trigger `wa205_hist()` records them (`goal_history.entity` now allows activity, target, checkpoint; a project's `checkpoint_id`). Row security as wave205: staff and board viewers read; the goal's owners and admins edit; staff who may comment link projects and comment; nothing for anon. Realtime publication gains the three tables.

## Permissions checked

Rolled-back checks in the database: Shima (owner of 1, 2, 5) saves a goal 1 checkpoint, gets the conflict answer on a stale value, edits a reason and the owners, adds an activity, is refused on goal 3 and on a direct table update; links a project to a checkpoint (history row); Samson (member) is refused and reads; Tamara (board viewer) reads and cannot link; anon reads nothing. Security advisor: no new ERROR (only the older `volunteer_people` view).

## Tests

- `test/w207drive.js` 118 of 118 (fixture `test/w207fixture.js`): the Goals page as admin (This year: Q1 now, Due next Dec 31 in 88 days, nothing overdue, the table in the plan's words; the strip: All 8 covered with the right goals; the glance column; chips with the reason on hover and tap; checkpoint status, words and due date autosave with the old value; the target's owners; a live save from Ian; the activities sheet: add, reason, take off; checkpoint comments; linking a project to a checkpoint; history in words with Restore), on 15 Jan 2027 (Q2 now, five Q1 checkpoints overdue, flagged in the box, the table and the card; done leaves the list), as Shima (edits her goals only), a member (reads, comments, links), a board viewer (read only), and at 390 px (no sideways scroll, everything stacks, a tap shows the reason). The project page as admin, member, leader and phone (the retired-goal note and the sibling projects, the picker: team filter, search, picks kept, two tasks linked with their change_log lines, the page repaints; the title opens the drawer with Move to the bank; ticking through toggleTask with Undo; after ten seconds the task moves to Completed) and as a board viewer (no picker).
- Regression on the wave207 build: w205 91, w206 134 (its tick check now expects the Undo), w134 34, w153 46, w163 40, w152 68, w164 31, w176 14, w193 44, w197 99, w198 20, w201 39, w202 88, w204 83.
- Tours: orggoals 20/20 (four new steps), project 5/8 (one new step; the fixture project has no lead or goal sections), projects 6/6, goalmap 6/6, strategylib 4/4. Churn zero on #project/5, #projects, #orggoals, #team/marketing, #team/marketing/tasks, #mypage.
- Harness x3 (staff, board, member) against the live build: only the project page differs (the training and HR-centre byte differences are the timing-dependent markers noted in wave206); one more blocked network request for staff and board, no page error.

## Files

`build/parts205/g_year.js` (new) and edits in a_head, c_data, d_goals, e_drawers, h_tours, z_wire, assemble.py; `build/src/207_wave207.seg` (new, MANIFEST after 206); `build/parts122/f_tours.js` (the project tour); `build/data/wa207a_history_kinds.sql`, `wa207_activities_fy27.sql` (+ `.rec.sql`), `wa207b_link_tasks.sql`, `wa207c_checkpoint_comments.sql`, `wa207_release.sql`; `test/w207drive.js`, `test/w207fixture.js`, `test/w206drive.js`; `docs/DATA_MODEL.md`, `docs/HUB_RELEASE_CHECKLIST.md`.
