# 01/10/26 - wave192: The Loop (I'm in, close the loop)

Live md5 `dd5e9f4701094a443163a5de5a879866` (5,299,714 bytes), deployed through the gated pipeline on top of `5196804b` (wave190 and wave177), host-sync `netlify=ready` at 18:47 UTC. Migrations: `wa192_the_loop`, `wa192b_loop_feed`, `wa192c_sessions_private`. Function: checkin-post v13 (platform version 13, ezbr `a4ea838d`). Numbered 192: a parallel session holds 191.

## What Steel asked

Steel (01/10/26), about the Loom training on checking in and out (training 216): "I want you to replace my loom video on how to check in [...] maybe just make the check-in check-out a walkthrough on the hub instead. Also, I'm questioning whether our checkins should be in our slack channels for everyone to see, I really don't want people to feel like they are tracked but more that work that's being done is shared to keep everyone in the loop. Also when people check out, it might be helpful to track their clicks in the hub in order to help give them a summary of what they did, the voice to text is likely also very helpful. Goal: re do the onboarding module for check-in-out and instead position it differently, brand it, make it easy, and rethink its processes, values and intended purpose."

His choices (01/10/26):

- **The name:** The Loop. I'm in to start, Close the loop to finish, and #the-loop for everyone.
- **Where a note goes:** the person's team channel by default, or everyone, or just the Hub, their choice each time. Starting posts nothing.
- **What is shared:** only what moved (the lines and the closed tasks). No clock time, no hours. Hours stay with the person and HR.
- **The draft:** from the records the person changed in the Hub, never from clicks or pages.

## What changed for people

- **The header button** is I'm in, then Close the loop (with the person's own time beside it, for their eyes). Pressing I'm in posts nothing anywhere; the ring on their photo shows teammates they are around.
- **Close the loop** opens the wrap-up sheet:
  - What moved: lines the Hub drafted from their own records (tasks closed, opened, commented or edited; requests; meetings joined; Academy modules; goals; decisions; updates; transcripts; @mentions; announcements; posts; rosters; team emails; CRM contacts; onboarding steps). Private work (confidential, board-only, one-on-ones and other restricted rows) is never pre-filled; the sheet says how many were left out.
  - Anything the Hub could not see: say it or type it; Add to the note folds it in through the model (router task `checkin`) and names the open tasks the words show are finished, ticked.
  - Who sees it: My team (the team's channel from `hub_settings.team_inbox`, shown by name), Everyone (the Loop channel), Just the Hub. People without a team channel (the Executive team) get Everyone first.
  - Close the loop, or Close without a note (ends the session, shares nothing). Words typed but not folded in still go as a line.
- **The post** reads `:repeat: *Name* closed the loop`, the lines, and `Closed:` with the open task titles; a private task is counted ("1 private task"), never named. No mention ping, no time, no hours.
- **Home** has In the loop under your meetings: the week's notes from everyone (name, team, the day only), five then Show all.
- **The person page:** Their loop (Your loop on your own). Hours (the tile and the card) show on your own page and to HR, leaders and admins, with a line saying teammates never see them.
- **The nudges (wave118b)** sit under the new button in The Loop's words: "Starting some work?", "Close as of 12:40", "Still in? (only you see this)". A close as of a time ends the session then opens the wrap-up sheet; nothing is posted on its own, and the audit line keeps the time, not the hours.
- **The walkthrough:** the page tour "loop" (Academy row 226, Hub page tours). It opens the sheet in preview, marked Walkthrough, with sample lines; nothing is read or written, and the preview closes with the tour. The reading links to it ("See it for yourself").

## The words

- **Training 216** is a reading, "The Loop: I'm in, close the loop" (3 min): Goal; Two buttons, one habit; Why we do it; What it is not; How to close the loop (six steps); Tip; Good to know; Try it; Done when. The Loom (ee8af322…) is no longer linked; the old row's text is in change_log.
- **The WEEK 1 step** (`86e1cj9gn`): "The Loop: I'm in, close the loop (every time you work)". It ticks itself the first time the person closes the loop (`trg_wa192_loop_done` marks 216 done; `trg_wa166_tp_onb` ticks the step). Its updated_at moved once, at 18:02 UTC (a real change); the later wording fix kept it.
- **Elsewhere:** the Week 1 lesson's card (The Loop, the refresh icon) and its second question (`wa167_journey.py` and training 222), the journey's week 1 goal (through `onboarding_journey_save`, as Steel, with an audit line saying the assistant made it), the Running a team lesson ("no progress or loop notes during the week"), Hub module 1 ("your own hours (only you and HR see them)"), the chrome tour's step and its description (training 53).

## Privacy, in the database

- `hub_checkins` rows (and so hours) are read by the person, admins and HR (`wa169_can_assign`: the HR profile, leaders, admins), `wa192c`. Before, any staff member or board viewer could read everyone's sessions.
- Everyone else reads `loop_feed(p_days, p_email)` (the shared notes: who, team, day, lines, closed count, open titles; no time, no minutes) and `loop_in_now()` (emails in a session now, for the ring).
- `loop_trail(email, since, until)` drafts the note; a signed-in person can only read their own; checkin-post reads it with the service key for the person closing. The trail is never stored (the `trail` column added at first was never used and was dropped in the cleanup, 03/10/26).
- change_log lines from the Loop carry no hours.

## Edge function: checkin-post v13

New actions `start` (keeps the focus, posts nothing), `draft` (the trail as lines, the hidden count, open tasks, `team_channel`, `everyone_channel`), `tidy` (the model folds words into the draft), `close` (`share_to` team, everyone or hub; `dry: true` returns the post and changes nothing). The old `in`, `summarise` and `out` stay for cached pages, without clock times or durations. The Loop channel is `app_config.loop_channel` (`the-loop`), falling back to #check-in-out-wa until the channel is renamed.

## Release checklist

- **Access:** no new page. The button is for staff; board viewers see none. Session rows locked as above (checked as Steel, an HR-profile member, a plain member, a second admin and a board viewer, rolled back).
- **Training:** training 216 rewritten; the walkthrough row 226; the chrome tour's step; the lessons and module above.
- **Security review:** the advisor shows two ERRORs, neither from this wave (the view `volunteer_people` with security definer; the parallel session's `wa_stage_pull191_rids` without row security). This wave's functions: `loop_feed`, `loop_in_now`, `loop_trail` are executable by signed-in users on purpose and check inside; `wa192_loop_done` (a trigger) is closed to the API.

## Verification

- `test/w192drive.js` 79 of 79 on the live build: the button and I'm in (nothing posted); the sheet end to end; closing without a note, words not folded in, an empty note; no old action called; In the loop (days, no clock time); the person page as a plain member, HR and yourself; the walkthrough (every step highlighted, the preview opens and closes, nothing called); the chrome tour's step; wave118b's notes and the close as of a time; a phone; a board viewer; the live rows (the reading's headings, six numbered steps, callouts, the walkthrough card, the Week 1 lesson's card); no page errors.
- `test/w134drive.js` 34 of 34 (its nudge check updated to the new words), `test/w190drive.js` 25 of 25, `test/w177drive.js` 32 of 32, `test/w116kdrive.js` no errors, every page tour completes (`test/tour1.js all`; chrome, home and person identical to the live build before), `test/w116ndrive.js` times out on the old live build too (its check-in half is superseded by w192drive).
- checkin-post v13 on live data: a draft and a dry close for Steel's session 4 (no channel for the Executive team, so Everyone; the post carries the lines and the closed task, nothing else; the task stayed open).
- The trigger, rolled back: a plain member's session end marks 216 done; Alyx's open plan step ticks "by Avenue Academy".

## For Steel

- **Rename #check-in-out-wa to #the-loop** in Slack (channel settings). The Hub posts there by name once renamed, and to the old name until then. Nothing else to change.
- **Who sees a team's notes:** each team's channel is the first one in Settings, Team inbox channels (the same as requests). Toronto posts in #general-toronto until the Hub app is added to #toronto-operations.
- **People who checked out before today** (Alyx on 30/09) have the WEEK 1 step open; it ticks the first time they close the loop.
- **Cleanup: done.** Steel ran it in the Supabase SQL editor on 03/10/26 (`build/data/wa192e_wa194_cleanup.sql`): the session's temporary tables (`wa_stage_192`, `wa_stage_fn192`, `wa_stage_pull_loop`, `_rids`, `_tree`, `wa_stage_push192`, `_rids`) and the unused `hub_checkins.trail` column are gone.

## Files

- `build/src/192_wave192.seg` (new; after 190 in the manifest), `116j` (who is in), `116k` (hours), `118b` (the nudges), `122` (the chrome tour's step).
- `build/data/wa192_the_loop.sql`, `wa192b_loop_feed.sql`, `wa192c_sessions_private.sql`, `wa192_words.sql` (the first words), `wa192_release.sql` (the words at release), `wa167_journey.py`.
- `fn/checkin-post/index.ts`, `meta.json`.
- `test/w192drive.js`, `test/fx_w192.json`, `test/w134drive.js`.
