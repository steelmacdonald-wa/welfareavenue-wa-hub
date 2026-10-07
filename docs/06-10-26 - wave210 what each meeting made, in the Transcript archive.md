# 06/10/26 - wave210: what each meeting made, in the Transcript archive

Live md5 e9a8fb2265e70b6c226af0264a847f3a (on wave209's 627d1f09, the parallel session's applicant intake).

## What Steel asked (06/10/26)

> "Can the transcript archive also show what tasks were created with their owner and due date to visualize what it processed"

then

> "Only do it for the recent meetings please"

Recent was taken as meetings dated from 1 September 2026 on (and every meeting after). Older meetings look as they did.

## What it does

- Each recent, processed meeting in the Transcript archive gets a line under its summary: how many tasks it made, put in the bank and closed, how many are still open and overdue, and **Show the tasks**.
- Show the tasks opens a table grouped as Tasks this meeting made, Put in the bank until later, Tasks this meeting closed: the title (opens the task's drawer, #task/<id>), the team, the owner, the due date ("no date" when none) and where it stands today (Open, Overdue, Done, In the bank until <date>, Closed by this meeting). On a phone the owner, due date and status sit under the title.
- A recent meeting that made nothing says "This meeting made no tasks". Archive-only recordings show nothing.
- Owner, due date and state are the task's live values; a task the reader may not see (its own visibility rule) is left out.

## Underneath

- `transcript_tasks` (transcript_id, task_id, kind added / banked / closed, title, owner and due date as made, created_at; unique per transcript, task and kind). RLS: readable when the transcript is; written only by the database.
- `apply_transcript_result` sets the transaction setting `wa209.tx` to its transcript; the trigger `trg_wa209_task_link` (function `wa209_task_link`) on dept_tasks writes the link for any task inserted, or closed, with `updated_by` 'AI: <title>' (the setting first, otherwise the transcript of that title still being processed, then the latest). That covers apply_transcript_result, process-leadership's inserts and closes, and process-transcript's closes, with no edge function change.
- `transcript_outcomes(bigint[])` (security invoker) joins the links to dept_tasks under the reader's rules; a banked task's snapshot is kept because the bank is hidden from every board.
- Backfill from change_log (AI rows matched to the transcript of the same title, nearest processing time): 526 added, 1 banked, 104 closed across all meetings. The page only asks for recent ones.
- **Naming:** built as wave209 and renumbered at release because the parallel session shipped applicant intake as wave209 the same day. The migration is recorded as `wa209_transcript_tasks` and the database objects keep wa209 names; the page code, segment, test and data file are wave210 (`build/parts210`, `210_wave210.seg`, `test/w210drive.js`, `build/data/wa210_transcript_tasks.sql`).

## At release (as Steel, through the database rules)

13 recent meetings, all with tasks: 62 made, 61 still open, 6 overdue. 52 of the 62 have no due date (the meetings rarely set one).

## Tests

test/w210drive.js 25 checks (the line, counts, open and overdue, an old meeting untouched, no tasks, archive-only, the table groups, owner and due date, each status, the drawer links, escaping, toggling, the phone layout). Regression on the shipped build: w209 29, w165 15, w162 48, w208 35.

## Release note: the database restart, and build/candidate.html

Pushing to GitHub, one statement joined the 17 staged chunks of build/candidate.html (6.6 MB) into one base64 value and sent it to repo-sync in the same call; the MCP connection dropped (502) and the free-tier database stopped answering from about 22:11 to 22:30 Toronto, when it restarted by itself (pg_postmaster_start_time 02:30:17 UTC). Nothing was lost (transcript_tasks 631 rows, the live build e9a8fb22 intact). **The push of this wave leaves build/candidate.html out**: the repo's copy is wave209's (627d1f09); the sources here rebuild the live build exactly (build/build.sh gives e9a8fb22). Next session: rebuild from the sources before building on candidate.html, and never join a multi-MB file and post it through pg_net in one statement: stage it, then send the blob in its own statement, or leave the candidate to be rebuilt.
