# 29/09/26 - wave165: one-on-ones only for the people speaking in them, and the Loom archive

Steel (29/09/26), after the inventory of Loom meetings the Hub did not have: "Yea so pull all these in, including July and August but don't create any tasks from them just enhance the "Ask the Hub". 1on1s should be confidential and not searchable by anyone except for those that are speaking in the meeting. Loom gives you those that are speaking in the meeting."

## One-on-ones

- A new level of who sees a meeting, `speakers`: only the people in `allowed_people` (the people speaking in it, matched to the roster, as names and every address they sign in with). No admin, leader, director or uploader override (`wa_sees_restricted` checks it before the admin line).
- **The 29 one-on-ones already in the archive were open to every member.** They are `speakers` now, and so is everything they filed: 30 updates, 181 tasks (each also for its owner and assignees), 5 goal wins, 20 mentions, 307 audit rows, 33 notes the meeting scanner left on tasks, 15 Loom rows. Their 9 due-date suggestions waiting for a yes were set aside (dismissed, "from a one-on-one"); the 4 serving-event items they made keep their task but no longer name the meeting. The one of them that was board-only (#144) is not any more: its speakers read it.
- Who counts as speaking: the speakers Loom's transcript names, plus the names a one-on-one's title joins ("Suhaib / Steel", since Loom does not always name every voice), plus, when that still leaves one person, the people Loom lists on the meeting (not its recorder). Titles read as one-on-ones: 1on1, 1:1, one-on-one, or names joined by /, x, & or + (four speakers at most). A one-on-one is filed for its speakers before the sensitive check (nobody else reads it anyway).
- What follows the meeting: its tasks, updates, decisions, wins, mentions, task notes and its audit rows (`change_log` gained `visibility` and `allowed_people`, read like the meeting; the meeting's own audit row with its summary is written before it is marked processed so the stamp covers it). A task's comments show only where the task does (`wa_task_visible`). A mention from a one-on-one is never sent (notify), and shows only to those who can read the meeting.
- A one-on-one leaves the team's narrative (progress, mood, priorities) alone, routes nothing to serving events, gives no content ideas, closes and decides only work of its own kind (its evidence never lands on open work), is never escalated to board-only, and posts nothing in Slack (process-transcript v17, process-leadership v4). The meeting scanner (transcript-requests v7) never scans one.
- Every service-key reader that shows work to many people now reads open work only: the weekly digest, daily alerts, shout-outs, profiles, goal proposals and suggestions, drafts, decision recommendations, project reports, the upload preview, check-out suggestions.
- The upload form offers "One-on-one (only the people in it, not even admins)" with the people picker; the database adds their addresses (`trg_wa165_people`). The Loom card offers it when filing by hand, and shows an admin who was not in a one-on-one only that one was filed ("A one-on-one", no title, names or link). The archive marks one-on-ones ("one-on-one · only its speakers").
- Checked with the database's own rules as each person: Ian reads his 10 one-on-ones, Suhaib (an admin) only his 7, Steel (on his gmail) his 22, Tuna none.

## The Loom archive (no tasks)

- `transcripts.archive_only`: kept for the archive, search and Ask the Hub only. The insert triggers skip it (no tasks, updates, decisions, suggestions or ideas); the archive shows "archive only" and no Reprocess.
- `loom-pull` v2.1 `backfill`: 73 recordings from May 2025 to August 2026, each with a summary (Discussed, Decided, Next steps; llm route `transcript_archive`, Loom's own notes as a hint): 43 team meetings for everyone under their team, 15 one-on-ones for their speakers, 7 leadership meetings, the board management session and the HR progress review for the leaders, 6 planning sessions for everyone. Three team meetings that may hold something sensitive went to the leaders instead (Operations, January 7 2026; Human resources, May 6 2026; Weekly Operations, May 11 2026); an admin can open them up. Left out on purpose: the 19 interviews, the 8 onboarding call recordings, "How to Access Loom and Join Meetings", "Gabriel Chat", "Enterprise Nodes".

## Ask the Hub

- `ask` v14: MEETINGS MATCHING THE QUESTION comes from `wa_ask_meetings`, run as the asker: any word of the question, each weighted by how rare it is among the meetings (title words count double), with each meeting's summary and the passage around the rarest words, from every meeting the asker may read. "When did we start the Keela training?" now finds the Keela training meeting first (it was fourth). Restricted meetings are marked ONE-ON-ONE, LEADERS or CONFIDENTIAL and the model keeps their details out of anything others read. Program Development no longer counts twice.
- `search_transcripts` (Search everything) now applies the same rule (it ran with the owner's rights and showed restricted snippets).

## Releases

- The page: `2146ee67b705fac75753e30d48da5fb5` to `0711df6833b691d900551661f899ac31` (4,672,357 bytes), gated deploy, host-sync, byte-for-byte check; stage tables dropped.
- Functions: loom-pull v12 (v2.1), process-transcript v24 (v17), process-leadership v15 (v4), transcript-requests v16 (v7), ask v23 (v14), notify v21, goal-propose v11, draft-content v15, recommend-decision v14, goal-suggest v11, person-profile v11, project-report v11, shoutouts v14, transcript-preview v14, weekly-digest v12, daily-alerts v12, checkin-post v11.
- Migrations: `wa165_speakers` (20260929080000), `wa165b_speakers_fix` (20260929081000: four backfilled one-on-ones got the person Loom had not named), `wa165c_ask_rank` (20260929082000). Hub module 3 (training 41) says who sees a one-on-one, what archive-only means and what Ask the Hub answers from; the upload tour and the pipeline guide too.

## For Steel

- The interviews already in the archive (#35, #78, #137) are open to every member. Say if they should be HR and leaders only.
- The department narratives (progress, mood, priorities) that one-on-ones updated before today may still hold something from them; they are rewritten by the next team meeting.
- The public "How to Access Loom and Join Meetings" video's summary spells out the start of the shared Loom password (not changed; yours to fix).
- A help request on an onboarding step does not reach Slack (the trigger's notice was never wired); it shows in the HR centre.

## Files

- `fn/loom-pull`, `fn/process-transcript`, `fn/process-leadership`, `fn/transcript-requests`, `fn/ask`, `fn/notify`, and the open-only readers above.
- `build/src/002_wave2.seg` (no Reprocess on archive-only), `062_wave62.seg` (the one-on-one choice, chips, the page trusts row security for `speakers`), `065_wave65.seg`, `066_wave66.seg` (notes), `122_wave122.seg` (the upload tour), `162_wave162.seg` (the Loom card: the chip, the masked row, the file form, Finance, the archive count).
- `build/data/wa165_speakers.sql`, `wa165b_speakers_fix.sql`, `wa165c_ask_rank.sql` (each with its `.rec.sql`).
- Tests: `test/w165drive.js` (15), `test/w162_fn_test.ts` (106: one-on-ones, the backfill, summaries, the sensitive raise), `test/w162drive.js` (the file form); the drive suite from w130 to w165 and w118cphone pass.
