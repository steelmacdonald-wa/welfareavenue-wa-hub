# 26/09/26 - wave132: the bank

Live md5 `a73fdd9e2bbf4a8cb282cd57d08a7da6` (3,720,214 bytes), deployed through the gated pipeline (`wa_stage_rb`, guarded on the live md5 `43f95848` and dropped after). Schema: `wa132_bank` (with `wa132_bank_grants`, `wa132_bank_undo` and `wa132_bank_general_lists`), and `wa132_tours` for the academy.

## What Steel asked

"Store tasks that can't be done, you know, in the next three to six months, but kept in a bank to resurface later on, like projects as well." And: "I also want to give you the option."

## What it is

**The bank** (Strategy > The bank, `#bank`) holds work that cannot start for three months or more. Anything in it leaves every board, list, count, alert, digest and agenda, and comes back on its own on its date.

- **The page**: how much is waiting, what comes back in the next 30 days, what came back in the last two weeks (with Open), a chip per team and a search, then everything grouped by the month it comes back. Each item says its team, project, owner, subtasks, why it waits, who put it there and when, and whether its due date comes back with it. Open one for its description (or, for a project, the tasks waiting with it). **Bring back now** and **New date** on every item; **Put something in the bank** adds something new straight in (what, team, project, when, why). `#bank/<team>` opens one team's bank.
- **Move to the bank** in every task drawer: pick in 3 months, in 6 months or a day, and say why. Its open subtasks go with it; its due date is kept aside and comes back with it if still ahead. An **Undo** follows every move.
- **A whole project** from its page (the project's lead or a leader): the project, its sub-projects and every open task in them go together and come back together. A team's general list cannot be banked.
- **Coming back**: at 6:05 every morning (Toronto) whatever has reached its date goes back to its team's board with its owner, subtasks and project, and carries **back from the bank** on the board for two weeks. Nothing comes back before the project or parent task it belongs to.
- **Team pages** show an **In the bank** card when the team has something waiting or something just back.
- **The AI**: when a meeting clearly puts work off by three months or more, process-transcript v13 still files it as a task but straight into the bank, with the reason (never for work within three months, and never earlier than 45 days out). Banked tasks are marked in the list the model reads, so it does not add them again, and it can bring one back when a meeting starts it. The Slack line counts what was banked. The upload preview says which new tasks go to the bank. **Ask the Hub** can propose moving a task to the bank (you confirm it on its card, where the date and the reason can be changed) and can answer what is in the bank.

Also: the task drawer is tidied (the title is one line tall again, and "Open Ian's profile" sits under the owner instead of pushing every field out of line), and a page's tab title no longer turns into "AI models" when Admin was open earlier.

## How it works underneath

- `dept_tasks` and `projects` gain `banked_at`, `bank_until`, `bank_note`, `banked_by`, `resurfaced_at` (tasks also `bank_due` and `bank_project_id`). A restrictive read policy (`banked_at is null`) means the web app never reads a banked row, so every board and count leaves the bank out with no change to their code. Things banked together share one `banked_at` and come back together.
- The bank itself goes through checked functions: `bank_list()`, `bank_task()`, `bank_add_task()`, `bank_project()`, `bank_unbank()`, `bank_redate()`, `bank_undo()` (within 30 minutes). The work sits in `bank_task_do`, `bank_project_do` and `bank_unbank_do`, which only the database and the edge functions can call. The daily job is `bank_resurface()` (`wa-bank-resurface`, 10:05 UTC).
- Closing a banked task from anywhere (a meeting, a check-in, the chat) takes it out of the bank as done, so its history shows.
- `board_home()` leaves banked board tasks out; `apply_transcript_result()` banks what the AI marks and never routes a task into a banked project.
- Edge functions that read open tasks or projects with the service key leave the bank out: ask v12, build-agenda v8, checkin-post v3, slack-digest v2, person-profile v3, process-leadership v4, project-report v3, draft-content v7, goal-propose v3, goal-suggest v3, recommend-decision v6, transcript-preview v4, slack-command v2, project-slack v6, transcript-requests v7, and process-transcript v13. slack-command, project-slack and transcript-requests are now in the repo.

## Release checklist

- **Access**: a new page, The bank, in every access profile: Everyone for the staff profiles, Executive and Admin; Nobody for Board member (logged in the audit trail as a Hub release). Board viewers never see it. The database checks every move again: staff with a working role can bank and bring back tasks they can see; a whole project needs its lead or a leader. The profile editor lists the page under Strategy with a note that the database enforces it; Request more access offers it.
- **Training**: a page tour for the bank (six steps, "Page tour: The bank" in the academy); a step on the project page tour; Hub module 2 teaches Move to the bank and now includes the bank tour; Hub module 3 says the AI banks what a meeting puts off; the project tour's description mentions it.

## Verification

- Database: a dry run in one rolled-back transaction covered banking a task with subtasks (hidden from the web app's reads, listed once with its subtasks), a new date, bringing it back (due dates restored), the back list, closing a banked task, dates in the past refused, banking a project with a sub-project and a subtask with no project, the general list refused, the daily job, a task that must not come back before its project, adding straight to the bank, the board's own list, the AI path (banked, too soon, a banked project never used), the AI bringing one back, and someone outside staff refused. Undo was checked the same way.
- `test/w132drive.js`: admin at 1366 (52 checks) and 390 (55), a member on the HR profile at 1366 and 390, a board viewer at 1366 and 390. Drives for waves 131 (1366 and 390), 127 (five cases; the Toronto profile now expects the bank among its pages), 130 (three cases), 129, 126, 124, 122 (36/36) and 116t green; 116m green once pointed at the classic people table (stale since wave131). Harness x3 against the live build: only the bank page, the menu and the project page differ, with the same error counts; churn clean on eight pages; the bank and project tours walk without errors. Live md5 matches the build.
- process-transcript v13 on a real digest (dry run, nothing written) returns the new fields; all sixteen redeployed edge functions answer.
