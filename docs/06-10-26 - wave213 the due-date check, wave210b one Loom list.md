# 06/10/26 - wave213: the due-date check; wave210b: one list of meetings

Live md5 269c4fb5dbb36594fcf1400a8c7c4760, on a054a93c (wave210b) on 52a7f806 (the parallel session's wave211, stage gates).

## wave210b: the Loom card no longer repeats the Archive

Steel (06/10/26): "now there's 2 sections with the same list of meetings, why? Can we combine the 2?" The Loom card's "Latest from Loom" listed the meetings it had filed, which the Archive lists again. Now the card lists only what Loom sent that was **not filed** (skipped, waiting, could not read), under "Not filed", and says "Meetings filed from Loom are in the Archive below." Needs a look, the counts, Pull now and the note are unchanged. Change in build/src/162_wave162.seg (html()); tests w162drive (46) and w165drive (14) updated.

## wave213: the due-date check

Steel (06/10/26): first "assume due dates ... the next team meeting [or] the following one", then "I'd rather a pop up when the user gets on to the hub that they should [set] their due dates for the tasks or confirm the due dates provided make sense" (new and existing open tasks), then "it should pop with the best assumptions of due dates and allow the user to make edits if needed but they [should not] be able to exit until they confirm their due dates. Also overdue tasks should also pop to ask if items are done and if they aren't to push the due date to a realistic date". (Read as: cannot exit until saved.)

- **What it lists** (`my_due_date_check()`, security invoker): the signed-in person's open, unbanked tasks (owner contains their first name as a word, or assigned through task_assignees) that are **overdue**, have **no due date**, or carry **a date a meeting set** that nobody confirmed (meeting tasks from 1 Sep 2026; `transcript_tasks` date unchanged and `due_confirmed_at` null).
- **The best guess:** the team's next meeting from the Hub calendar (`hub_events.department`, via `wa213_team_meetings`, dates only), or the one after when the next is less than two days away; a week / two weeks out when the team has no meeting on the calendar (Finance, Board). A date a meeting set stays as set.
- **The pop-up** (#w213pop, parts213): a moment after the Hub opens, never over the meeting pop-up or a modal. Groups: Overdue (Done / Still open, push to), No due date yet, Dates a meeting set. Each has the date field and Next meeting / Following buttons. No x, Escape or outside click; Save refuses a missing or past date. If saving fails it says so and only then offers "Try again later", so a fault never locks anyone out.
- **Saving** (`confirm_due_dates(jsonb)`, security invoker, only tasks in the person's own list): sets due_date, `due_confirmed_at`, `due_confirmed_by`; Done marks the task done (closed_at by the existing trigger). One change_log line each. It comes back next visit only for what is still overdue or undated.
- New columns dept_tasks.due_confirmed_at, due_confirmed_by. Migrations wa213_due_date_check, wa213b_overdue_and_done.
- At release: Steel 11 tasks (10 undated, 1 meeting-dated); heaviest lists Ian (~39 overdue or undated) and Amanda (~31).

## Tests

test/w213drive.js 19 (opens, groups, best guesses, Done/push, cannot close, past date refused, failed save then Try again later, what is sent, nothing to check, phone). Regression on the shipped build: w210 25, w162 46, w177 32. w209drive fails one check (Add: the CV link is now required, wave211's change); it fails the same way on the live build before this wave.

## Repo note

build/src/MANIFEST.txt is not in this push (the parallel session's wave211/212 MANIFEST lines were not on GitHub yet; pushing ours would drop theirs or theirs ours). **Add these lines after `210_wave210`** when the next session merges:

    # 213_wave213: the due-date check: on opening the Hub, a pop-up (that stays until saved) for the person's overdue, undated and meeting-dated open tasks, suggested from their team's next meeting (my_due_date_check, confirm_due_dates). Built from build/parts213.
    213_wave213

and the 162 comment: "wave210b (06/10/26): the card lists only what was not filed; filed meetings are in the Archive." Wave 213 sits before 164/163/110 (startApp wrapper order). build/candidate.html is not pushed either: the live build is live md5 269c4fb5.
