# 06-11-26 - wave287 team overview, tasks and projects

Built on branch `wave287-projects-overview` (cut from `b30c0fa`, an early wave285 commit). Merged with the live Hub on branch `wave287-merge` (80eb1ff: wave285 c4b1dc2, index.html 9977c375, which carries wave274, 274b and one app; c4b1dc2 rebuilds the live page byte for byte; the merge was clean, manifest 279, 274, 285, 287, 164). **Release from `wave287-merge`**: its candidate is md5 bae461b9, 8,379,788 bytes, all LF. Not released, not staged, no live data changed. The spec is `claude/06-11-26 - Team overview, tasks and projects, design (wave287).md`, sections 2, 3 and 5. This is the page half; the data half is `build/wa287a_projects.sql` (another session), and the page is written against its contract: `projects.is_general` (one per team), `projects.workstream`, a project on every task.

## What changed

### The task pages (Tasks on every team page, the Fundraising boards, #grants, Finance's board)
- **The Apple Reminders shape.** A sidebar picks the list:
  - **Smart lists**, as two-column tiles with a coloured round icon and a big count: Today (overdue and due today), Scheduled (has a due date), All (open), Flagged (executive flag), Mine (owner or assignee), Completed.
  - **Projects**: the team's projects as rows, General first, sub-projects indented under their parent, each with its colour dot and open count. **Other teams' projects** that hold this team's tasks follow under a quiet heading. **New project** (staff) opens the existing add-project form.
  - Under 900px the sidebar is a sticky row of chips that scrolls sideways, smart lists first; the open chip stays in view.
- **Projects replace workstreams.** A task with no project counts in its team's General project (No project only when a team has no General). Grouping by workstream, the drawer's Workstream field and the quick add's workstream are gone. `subsection` stays in the data; the Fundraising boards and their Sub-team grouping still read it, and a task added on a board still gets the board's workstream.
- **The list.** Its name large in the project's colour (gold and the lighter team colours darkened to stay readable on cream) with its open count beside it, one line of what the list is, New task on the right. The toolbar is lighter: List, Board, Calendar (and wave116t's Tree), Group by, one Filters button with a count, search. Active filters show as chips with a cross and Clear all.
- **Grouping.** A smart list groups by project (only the projects with tasks in it, in the sidebar's order); a project list groups by due window (Overdue, Today, This week, Later, No date; the empty windows are left out, No date stays as the place to add). Status, Owner, Due date, No grouping and Fundraising's Sub-team are still offered.
- **Rows.** A round tick edged in the project's colour, the title (up to three lines), and one quiet line of facts: owner and assignee avatars with the owner's first name, a due chip (Today, Tomorrow, the weekday, the date, or red "3 days overdue"), the project tag when the list is not already that project, a team tag on another team's task, the Exec flag, the comment count, the status when it is not Open, and wave116t's subtask count. Hover (fine pointers only) shows the controls that have nothing yet: set an owner, add a date, the Open status. Bulk select keeps its checkbox, which shows on hover and once anything is selected.
- **The tick.** Feedback on pointer-down (the circle scales to 0.9, the row takes a soft background), the circle fills in 160ms ease-out, the task is saved as done, an Undo bar shows for six seconds, and the row folds away after 1.4s. Undo puts back the status it had. The tick is a keyboard control (Enter or Space).
- **Adding a task.** A "New task" line with a plus circle closes every group; the line becomes an input with a dashed circle; Enter saves and keeps it open for the next; Escape or leaving it empty closes it. The open list files the task: its project, today for Today and Scheduled, the flag for Flagged.
- **Cross-team projects.** An owning team's project list shows every task in the project, other teams' tasks included (with their team's tag), and its sidebar count includes them. A team's smart lists stay its own tasks. Example: the Gift Basket Drive on Fundraising shows Marketing's promo graphics task; on Marketing it sits under Other teams' projects.
- **Drag and drop.** Everything that dragged still does (reorder, between groups, Board columns, Calendar days); a task can also be dropped on a project in the sidebar.
- **The drawer** slides in from the right on the iOS drawer curve (`cubic-bezier(0.32, 0.72, 0, 1)`), 280ms in and 200ms out, the same way back; the backdrop fades. Its Project field shows General for a task with none. Moving a task to another team moves it from the old team's General to the new team's General.
- **Old links.** `#team/<d>/tasks/<workstream>` opens the project that replaced the workstream (`projects.workstream`; "General" opens the team's General), else All, and the address loses the workstream. `#team/fundraising/tasks/Grants` goes to `#grants`.
- **Grants.** wave258 keeps grants off the Fundraising team page, so Grants Program's row and card there point to the Grants page (with an arrow) instead of opening an empty list, and the All list ends with wave258's own pointer ("Grants has its own page now: open Grants"), where its Grants group used to be.

### The team Overview
- **Header.** The team name, the team's read clamped to two lines with More (shown only when the read is cut), the avatars, and the tabs as one segmented control with a light thumb that slides to the current tab (only `transform` animates; no slide with reduced motion). On a phone the tabs scroll sideways instead of wrapping.
- **Now.** One sentence ("4 open requests, 3 tasks overdue, 4 due this week and 2 done in the last 30 days.", the requests from wave123's inbox when it has loaded) and three tiles that open the matching list: Open (All), Overdue (Today with the Overdue filter; red when above 0) and Due this week (Scheduled with the Due this week filter). A tile at zero says "Nothing overdue" quietly instead of a big 0. Operations Montreal's next-serving tile still joins them.
- **Left column**, in reading order: **Needs attention** (up to six overdue or due within seven days, in the task-row style with a working tick and Undo; a row opens the drawer; "see all" opens Today), **Projects** (a grid of cards: General first and quieter, sub-projects with their parent's name above; the dot and name, a progress ring for done against total, "n open, m overdue", the next task due, the leads' avatars; a click opens that project's list; a dashed New project card for staff), the **Team inbox** (wave123's card, where wave123 puts it: first in the column's DOM, shown third with CSS `order`), **Updates** (the latest four, show all), **Mentions from other teams**, **Executive decisions**.
- **Right column**: Upcoming meetings, KPIs we track, Team, Where the team is (the pulse), then Tools as one compact row of chips, kept last after the cards later waves add (Our SOPs, the bank).
- **The "Asked of" banner** (wave258) is no longer drawn on the Overview, where the Team inbox card holds the same requests with more actions. It stays on Agenda and Tasks. The Home "requests" chip now lands on the Team inbox card.
- Every container later waves inject into stays: `.w116kpis` (wave258's Fundraising totals and its "overview ready" check, wave116's serving tile), `.w116grid`, both `.w116col`, `#w116meet`, `#w116updcard`, `.w116dec`, the h3 texts the tours look for.

## Segments touched
- New: `build/src/287_wave287.seg` (the CSS; the tabs' thumb, More on the read, the Overview's task rows and keyboard on its tiles and cards), in MANIFEST after 285_wave285 and before 164 and 110, so its CSS follows every wave that styles the team pages and the board.
- Edited in place (wrapping is impossible: the board's state and the Overview are closure-internal):
  - `116_wave116.seg`: the project helpers, published for every page (`w116IsGeneral`, `w116GeneralOf`, `w116ProjOf`, `w116ProjColor`, `w116Ink`, `w116Elsewhere`, `w116ProjForWs`); the Overview; the clamped read and the tabs' thumb in `header()`; old workstream links in `renderTasks()`; the host's page class in `route()`.
  - `116b_wave116b.seg`: the board (lists, sidebar, rows, groups, quick add, the tick and Undo, the drawer without Workstream, drop on a sidebar project). New in `window.w116Board`: `set(patch)`, `list(name)`, `state()`, `model()`, `complete(id)`, and the presets `today`, `scheduled`, `all`, `flagged`, `mine`, `completed`, `week` (the older `overdue`, `done`, `projects` and `project:<id>` now open lists). Also `window.w116RowHtml` and `window.w116DueChip` for the Overview.
  - `116t_wave116t.seg`: the Tree no longer sorts a project's tasks into workstreams; tasks with no project sit in General.
  - `258_wave258.seg`: `placeReq` skips the Overview.
  - `122_wave122.seg` (by hand; its parts are stale, see ARCHITECTURE): the team and tasks tours describe the new pages (Now, Needs attention, Projects, Lists and projects, the toolbar's grouping).
- No SQL, edge function, table or site_files change from this half.

## How to undo
Put back the previous index.html (the live page at release time: md5 9977c375 on 06/11/26, built from c4b1dc2 with `build/build_lf.py`). The page reads `is_general` only when it is there and falls back to the "General <team>" project, so the page and the SQL can be undone in either order; the data's own undo is `build/wa287a_undo.sql`.

## Tests (offline, against build/candidate.html md5 20183d5e, 8,165,629 bytes, all LF)
- `test/w287drive.js` with `test/w287fx.js` (the fixture as wa287a leaves it: is_general, workstream, the six new projects, Survey and Beneficiary Feedback in Program Development, tasks per team for overdue, today, this week, later, no date, flagged, done, a subtask, sub-projects, a cross-team task, a task with no project, a long title and the goal-sentence project 31; widths 390, 768, 1280, a 200% root font, reduced motion; `ONLY=13` runs some sections): **170 passed, 0 failed**, no page or console errors. It checks the smart-list and project counts against the fixture, a project list showing only that project, the tick, Undo and the fold (on the task page and on the Overview), the drawer (open, close, the curve and durations, no Workstream, General for a task with none), quick add filing into the open project, Board, Calendar, Tree, filters and chips, bulk edit, drop on a sidebar project, renames reaching the sidebar, the title and the cards, the Fundraising boards, `#grants`, the Finance board, the old workstream links, the Overview's ids, order, sentence, tiles, Needs attention, cards, thumb and More, the "Asked of" banner only off the Overview, no sideways scroll, no "undefined", "NaN", "null" or "[object".
- Older drives that touch the team pages and the board, run on md5 5ea3dace (this build less two CSS rules that keep the team pulse label on one line) and on the base build of `b30c0fa` (md5 cd81628c) with the same preload (Chrome from this PC, and screenshots made non-fatal because full-page captures of the task pages time out here; none of these drives asserts on a screenshot). There is no w262 drive in `test/`.
  - Same result on both builds: w258drive 36 passed 0 failed; w276drive 26/0; w272drive "all 152 passed"; w258page all green (29 of 29); w116j2drive, w116kdrive and w116tdrive produce the same JSON (w116tdrive's description status reads "Saved" on the new build and "" on the base, a timing of its 1.2s autosave); w116drive, w116fdrive, w116jdrive, w116ldrive, w116mdrive, w116ndrive and w116pdrive stop at the same line on both builds, on controls later waves changed (the profile editor, the KPI fold, check in, the HR centre tabs, the AI models card), so they were already failing.
  - Different by design: w116idrive's Overview card list (the new order) and its two rename checks, which read the retired markup (`.w116pro .p .n span` on the Overview, a project's group header on the board, where a project with no tasks now has no group); the rename itself still reaches the store, and the new drive checks it in the sidebar, the list title and the Overview's card. w258fund: the base build gives 41 passed, 1 failed ("Alexis: decisions open the Fundraising page"); this build fails "requests: at the top of the team page, above the tabs" (the banner is off the Overview by design) and then stops, because its next step clicks a request in that banner. Run on a test-only copy of this build with only wave258's Overview skip taken out, w258fund gives **42 passed, 0 failed** (the Grants pointer, the Grants page, the totals without grants and the decisions routing included).
- Screenshots, before (base) and after (this build), Overview and Tasks for Marketing, Operations Montreal and Fundraising at 1280 and 390: `claude/wave287 screenshots/`.

- **On the merged build** (`wave287-merge` 80eb1ff, candidate md5 bae461b9; 06/11/26, run in the main session): w287drive 170 passed 0 failed; w285drive 209/0; w274drive 222/0; w274bdrive 134/0; w274onedrive 163/0; w279drive 113/0; w272drive all 152 passed; w258drive 36/0; w258page all green; w276drive 26/0. The worktrees have no test modules: NODE_PATH points at `hub-repo/test/node_modules`.

## Found in the screenshots and the drive, fixed
- On a phone, Needs attention squeezed each title into a 24px column (a phone grid rule meant for the board's rows); titles now keep their width at 390, 768 and a 200% root font.
- The project cards and the New task plus circle shared a class name, which broke the cards' layout.
- The toolbar wrapped its search onto a second line at 1280 (flex basis); New task moved to the list's title row.
- A tick on the Overview saved the task but left the row until the next repaint when no task board had been opened yet; the Overview now repaints after the fold and after Undo.
- Opening the Fundraising Tasks page straight from a link drew Grants Program as an empty list at first paint; the pointer no longer waits for the menu.
- Program Development's goal-sentence project made a five-line title; long names get a smaller title.
- The team pulse label wrapped in the narrower right column.
- A folded group's header now says so to screen readers (aria-expanded).

## Design decisions for Steel
- A project list shows only that project: a parent such as Fundraising Events does not pull in its sub-projects' tasks (they have their own rows, indented).
- An owning team's project list includes other teams' tasks in that project (with their team's tag); smart lists are the team's own tasks.
- "See all" on Needs attention opens Today (overdue and due today), as the spec says, while the card itself looks seven days ahead.
- Switching lists clears the list-shaped filters (due, status, project, flag, mine, show done) and keeps owner, search and sort.
- Done tasks are greyed with a filled tick, without the strike-through.
- The Open status shows only on hover (desktop); on a phone an Open task's status is changed in the drawer or the Board view, as are an empty owner and due date.
- Projects have no colour column: General wears the team's colour, the others take a colour from the brand-led set by their id (stable when projects are added).
- The Overview's old tiles (done in 30 days, active projects, meetings in the last 30 days, upcoming meetings) are now the sentence, the project cards and the meetings card; Transcripts stays in Tools.
- The Updates card shows the latest four (was six); "show all" shows the rest.
- Grants Program on the Fundraising page points to `#grants` rather than opening a list wave258 keeps empty.
- Section 4 (the Projects page in the card look) is not in this wave: the spec puts its rework after Steel has seen this one.

## Not verified live
Signed in on the real page with live data: the counts against the migrated tasks, the 111 cross-team tasks in other teams' projects, the drawer's motion on a real phone, the Overview with wave123's real inbox and wave132's bank card.

## Released 06/11/26 (Steel: "Yes, release it")

1. Live was 9977c375 (wave285 c4b1dc2), the base this branch merged; checked twice before the swap.
2. Data: migration `wa287a_projects` applied (the file `build/wa287a_projects.sql`). Before: 879 tasks, 141 with no project, 27 projects. After: 879 tasks, **0 with no project**, 245 moves logged in change_log (`wa287 (projects replace workstreams)`), 33 projects, one General per team (Governance 21, General Finance 47, General Fundraising 20, General HR 17, General Marketing 19, General Ops Montreal 18, General Ops Toronto 16, General Program Development 50), no task in another team's General, trigger `trg_wa287_task_project` in place, backups `wa_tmp287_tasks_backup` (879 rows) and `wa_tmp287_projects_backup` (27 rows).
3. Page: candidate bae461b9 (8,379,788 bytes, LF) staged in 10 parts in `wa_stage287` (all posted plainly; anon access closed right after posting; the staged copy's md5 checked; table dropped after the swap); gated swap with expected live 9977c375 and markers `wave285: the one progress rule` and `window.__wa287 = true`; host-sync answered 200 (8,379,610 characters).
4. Served by hub.welfareavenue.com: md5 bae461b9 on the first fetch. Signed out: no console errors; `window.__wa287`, `w116Board.state` and `w285.plan` present.

Not seen yet: signed in with live data (the counts on each team's Overview and Tasks, the cross-team tasks, the drawer on a real phone).

## Undo (after release)

1. Page: build c4b1dc2 with `build/build_lf.py` (gives 9977c375), stage it, gate it with expected live bae461b9, run host-sync.
2. Data: run `build/wa287a_undo.sql`. Either order works: the old page ignores `is_general`, and the new page falls back to the "General <team>" project when it is gone. A task created after the release in one of the six new projects keeps it; the undo's last line counts them.
