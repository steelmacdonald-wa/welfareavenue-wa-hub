# 14/10/26 - wave237: meetings from Loom only, and the tasks set right

Steel, after tonight's marketing meeting came out of the Hub with missing, doubled and wrongly owned tasks: "we should only
be reading from Loom, not Read AI or Otter AI. Those are no longer supposed to be added to the meetings. [...] definitely make
sure the tasks are set correctly. [...] if confirmations are needed, put it in the pop-up that people get when they open the
hub on confirming tasks and have them just confirm, okay, this is my task. No, this is someone else's task. [...] hopefully we
can avoid that without it prompting people to clarify tasks as much. I'd rather it just be where the AI takes care of that."

## What went wrong (the 14/10 marketing meeting)
- The meeting was processed three times: Loom's recap email (transcript 277, 15,000 characters), Read AI's recap email
  (278, 58,000 characters) and, two days later, the Loom pull's full transcript. Each run made its own tasks.
- The model saw only the first 30,000 characters of a transcript (TRANSCRIPT_MAX), about half of an hour-long meeting:
  the commitments of the last twenty minutes (the photographer, the LinkedIn questions, the Friday review) were lost.
- The roster had Roberto twice ("Robert", July, no account; "Roberto Toto", October, with his account): tasks landed on
  "Robert" and never reached Roberto's due-date check.
- content_ideas_from_meeting forced every idea onto Instagram and Facebook, whatever platform the meeting named.

## Meetings come from Loom only
- mail-pull v11: a Loom recap email hands its recording's id to loom-pull (`{action: 'pull', loom_id, why}`), which fetches
  the full transcript and files it by the sync's rules (team meeting, leadership, one-on-one, needs a look, waiting for Loom's
  transcript); the email itself is filed as `filed.type` loom with the pull's answer and posts no Slack line (the meeting's
  own processing posts the usual one). A recap from Read AI, Otter, Fireflies, tl;dv, Plaud or Fathom is ignored
  (`filed.type` recap_skipped, Gmail label Hub/Ignored, a change_log line). A pasted transcript with no recorder behind it
  still files as before.
- loom-pull v3: the `pull` action (one recording, now), and the sync every half hour, 7:00 to 23:30 Toronto
  (cron `wa-loom-pull`, `*/30 11-23,0-3 * * *`; it was Monday, Wednesday and Friday at 7:30). `loom_pull_slack` is on:
  meetings the pull files post the usual Slack line (the recap-email path that used to post it is gone).

## The tasks set right (process-transcript v18, migration wa237_tasks_set_right)
- The whole transcript is read (180,000 characters; max_tokens 6,000). Rule 17: every commitment, one task each.
- `team_members.nicknames` (text[]): Roberto Toto {Robert, Rob}, Patricia {Trish, Tricia}, Kahkashan {KK}, Steel {Steele,
  Sue}. The roster the model sees carries `also_called`; a nickname the model keeps is mapped to the roster name after the
  call (canon()); a name nobody has stays for the verify-name flag. The roster is the whole organisation (this team first,
  then `other_people`), so a marketing meeting can hand work to the operations lead.
- "Robert" (team_members 24) is merged into Roberto Toto (52): 21 tasks re-owned, assignments moved, the old row inactive.
- `wa237_upcoming_dates(dept, from)`: the named dates in the next 45 days (serving events, fundraisers up to 60 days, the
  team's own meetings) as one line each; rule 8: a task for an event is due the day before it, a task "for next meeting" on
  that meeting's date.
- Rule 18, `owner_sure`: false for a guess, a toss-up or work for the whole team (then the team's lead is the owner).
  After apply_transcript_result the task is marked `dept_tasks.owner_unsure`; the due-date check asks.
- No doubles: `sameWork(a, b)` (the words that carry meaning, no stop words or plurals; the same text, one inside the other
  with four or more words, or three fifths of the smaller set shared). Two tasks for the same work in one meeting are
  merged (assignees joined, the first title kept); a task already open on the board is not added again and gets a
  change_log line "mentioned again". The Slack line counts "doubles left out" and "owners to confirm".
- Content ideas: emails and newsletters are not ideas (the Email studio holds those); the platforms the meeting named are
  kept, any of the Studio's six (Instagram and Facebook when it named none).

## The due-date check asks about owners (wa237_due_check, confirm_due_check; page in build/parts213)
- `wa237_due_check()` replaces `my_due_date_check()` for the pop-up (the old function stays for pages still open on the
  old build; its return type cannot change in place). New rows: `why` owner_check (owner_unsure, "Is this yours?") and
  needs_owner (`for_lead`: a team's lead sees the team's tasks nobody on the roster owns, and unsure tasks that landed on
  the lead by name or by the team's label: "Who owns this?"). A lead is a Hub admin or leader, or a director.
- While an owner is unsure the check goes by the name on the task, not by old assignments (so "not mine" sticks).
- confirm_due_check: `mine: true` clears owner_unsure (and adds the assignment); `action: 'notmine'` gives the task to the
  team's director or leader (else the team's label), still unsure, and re-points the assignment to them; `action: 'assign'`
  (a lead) names the owner from the roster, with a date. **Discard now closes the task with the status "Discarded"
  instead of deleting it** (the connector held the deleting version for Steel's approval, twice; nothing in the migration
  removes rows now). The change_log keeps every answer.
- The page: "Is this yours?" rows with Mine / Not mine (the date choices appear after Mine); "Your team's tasks with no
  owner yet: who takes them?" with a Give it to select and a date; the counts, the Save label and the toast say "given an
  owner", "not yours", "passed to your lead".

## Deploy
- Database: build/data/wa237_tasks_set_right.sql, applied 14/10/26 22:30 to 22:45 in two parts through execute_sql.
- Edge functions: process-transcript v25 (file v18), loom-pull v13 (v3), mail-pull v22 (v11); each answers.
- Tonight's two recap transcripts (277, 278) and their 12 tasks (785 to 796): see the project doc of the night for what
  Steel decided; the cron was paused during the clean-up and re-enabled after.
- Tests: test/w213drive.js 21 of 21 (the owner questions). Regression on the candidate: w177 36, w217 36, w192 75 of 80
  (the same five fail on the shipped wave235 build: the chrome tour step and the reading's headings, steps and callouts,
  wave225 drift, not this wave).
