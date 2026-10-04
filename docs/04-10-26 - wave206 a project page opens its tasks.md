# 04/10/26 - wave206: a project page opens its tasks

Live md5 `7a739c22e35c50696b27af2d03adb9a8` (on wave205b's `d775535b`), one deploy (Netlify deploy 6ac2bc0505839c2f09f2e92f, ready; the served page checked by md5), stage `wa_stage_206d` (closed to the API). Migrations `wa206_deploy_gate` (the gated deploy and the page tour's training row, `build/data/wa206_release.sql`) and `wa206_release_line`. change_log release line `release / wave206 / hub_build`.

## What Steel asked (04/10/26)

On a project's own page (`#project/<id>`, for example Brand Refresh) he wants to open a task the way he can on a department page. The project page listed each task as a checkbox, the title and an "owner, due, move" line; clicking the task did nothing.

## What changed (`build/src/206_wave206.seg`, in MANIFEST after 205)

- Every task title on the project page, in the open list and under Completed, is a button that opens the team pages' own task drawer: `window.w116Board.open(id)` from wave116b, with everything later waves add to it (wave116t's description, subtasks and attachments; wave116m's profile chips; wave132's Move to the bank; wave138's @mentions in comments). Status, owner, assignees, due date, project, workstream, team, flags, comments, activity, Mark done or Reopen, Department page, Delete: exactly what the team page shows. There is no second task view.
- Before opening, the task's row is read again from `dept_tasks` and put into `DB_TASKS` (the drawer reads from there): a task just added with the project page's quick add, or ticked on it, opens current.
- While the drawer is open, every saved change repaints the project page in place (debounced 700 ms; scroll position, the Completed fold and anything typed in the quick add are kept), and once more when the drawer closes (Esc, the backdrop, the close button). The open task's row is marked in gold. The repaint calls `renderAllSections` once so wave51's latest comment and wave52's due pill come back on the rows.
- The checkbox is unchanged: wave27's own save (`dept_tasks` update plus a change_log line "(project page)"), then a repaint. It does not go through `toggleTask` and has no Undo; that was already so before this wave.
- Keyboard: Tab to a title, Enter or Space opens it.
- Works wherever `#project/<id>` opens: inside the Strategy app (`APPS.strategy` pages include `project`, Projects is marked in the rail), from Projects, Goal alignment, the team pages, search, a person's page.
- Two fixes found on the way: on a phone, wave51's latest-comment line (appended to each task row) sat on top of the title and squeezed it to one word a line; it now goes under the task. And a deep link to a project whose goal was retired in wave205 said "Rolls up to the goal: <the retired goal> (archived)" (GOALS_CACHE is cleaned only after the first paint): `wa27Goal` now skips retired goals and the page says "Not linked to one of the five goals yet. Link it from Goals (Strategy)."
- Help text (wave43's "How this page works") and the page tour's Open tasks step (122) say a task opens; training `tour:project` (63) description updated.

## Permissions

Nothing new. The drawer writes through the same `dept_tasks`, `task_comments`, `task_assignees` and `change_log` rows, under the same row security, as on the team pages. Board viewers can open a task to read it as on the team pages; the database refuses their writes.

## Tests

- `test/w206drive.js` 134 of 134: admin (staff), a member and a leader, each at 1366 px and 390 px, plus a board viewer: every title is a button; inside the Strategy app; the drawer opens on the right task with owner, assignees, due date, description, comments and activity; one drawer with its own footer; on a phone the drawer fills the width with no sideways scroll; editing the due date and the title saves through the drawer and the project page shows both in place; a comment posts; Esc closes and the page stays; the checkbox still ticks and opens nothing; a completed task opens (Reopen); Enter opens; a task just added opens; it opens after arriving from Projects and from the team page; the team page still opens its tasks; the due pill and latest comment come back after the repaint; no retired goal; the menu shows once; no page errors. The test applies dept_tasks and task_comments writes to the fixture (the stub only acknowledges them).
- Regression on the wave206 build: w205 91, w134 34, w153 46, w163 40, w152 68, w164 31, w176 14, w193 44, w197 99, w202 88, w204 83; w116tdrive and w116mdrive reports identical to the live build's; w116drive stops at the same person-page step on the live build (unrelated).
- Tours: project 4/7 (as on live; the fixture project has no lead or goal sections), projects 6/6.
- Churn zero on #project/5, #projects, #orggoals, #team/marketing, #team/marketing/tasks, #mypage.
- Harness x3 (staff, board, member) against the live build: only the project page differs; the training and HR-centre byte differences are timing-dependent markers (wave130's read-first lock, observer flags) unrelated to this wave; no page errors on either.
