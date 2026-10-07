# 07/10/26 - wave217: the light Still in? checks

Live md5 `dfe7f61f1e037fdebe9442d22bcd4446` (6,748,064 bytes), deployed through the gated pipeline on top of `41f9ee39` (wave215 and wave216). Function: checkin-post v7 (platform version 17). Migrations: `wa217_loop_checks`, `wa217b_loop_dm_cron`, `wa217c_loop_words` (build/data/wa217_loop_checks.sql). Cron `wa-loop-still-dm` (every 5 minutes).

## What Steel asked

Steel (07/10/26): "After an hour, hour and a half, 2 hours, and 2.5 hours being in, I want you to do a light check to confirm if they are still in." Asked, he chose:

- **Where:** "Hub only, slack sent to their own dm after 3 hours". The checks are in the Hub; at 3 hours the person also gets one Slack DM from the Hub.
- **No answer:** nothing happens. The session keeps running; hours change only when the person closes the loop or sets the time.
- **After 2.5 hours:** keep asking every half hour.

## What changed for people

- **Still in?** under the Close the loop button at 1h, 1.5h, 2h, 2.5h, then every half hour (3h, 3.5h ...), once per mark. It says their own time ("1h 31m so far (only you see this)") with Still in, Close the loop and Set the time. Still in hides it until the next mark. The x also waits for the next mark. An unanswered note stays and moves on to the next mark with the new time. Welcome back (away 20 minutes or more) still comes first, and its Still working counts as Still in.
- **The Slack DM at 3 hours**, from the Hub bot to the person only: "Hi Name, you have been in the loop for 3 hours. Still going? Tap Still in. All done? Close the loop and share what moved." with two links, Still in (`?loop=still`) and Close the loop (`?loop=close`), and "Only you get this message. Nothing changes if you leave it." Once per session. It is skipped when they answered Still in during the last 40 minutes, so someone working in the Hub who answers the 2.5-hour or 3-hour check gets no DM. Sent between 3 and 4 hours in; after 4 hours none.
- **The links:** `?loop=still` answers Still in and says "Got it, you're still in."; `?loop=close` opens the wrap-up sheet; either says "Your loop is already closed." when it is. The query leaves the address.
- **Training 216** (the reading) has a Good to know on the checks and the DM.
- **Put back:** the wrap-up sheet of wave214 (Where it goes, #check-in-out-wa, no choice). A deploy after wave214 had been built from older sources and brought back Who sees it on the live page; the function kept posting only in #check-in-out-wa throughout. This build carries wave214's segment again.

## Data and server

- `hub_checkins.still_in_at` (the last Still in, written by the person's own page through `hub_checkins_own_update`; other devices count that mark as answered) and `hub_checkins.loop_dm_at` (set by the function when it claims the session, before sending, so at most one DM per session).
- `wa217_loop_dm_due()`: open sessions 3 to 4 hours in, not DMed, no Still in in the last 40 minutes. `wa217_loop_dm_tick()`: the cron's tick; calls checkin-post `{action: still_dm}` only when a session is due and `app_config.loop_still_dm` is `on`. Both closed to the API.
- checkin-post v7 `still_dm`: trigger secret only (never a person); `conversations.open` then `chat.postMessage` with the bot (scopes im:write, chat:write); change_log line "Still in? Slack DM sent" (or why not), never the hours. `dry: true` lists the due sessions with their messages; `dry` with `checkin_id` previews one. Neither claims nor sends.
- To stop the DMs: set `app_config.loop_still_dm` to `off`. The Hub's checks stay.

## Files

- `build/src/118b_wave118b.seg` (the marks, `stillIn`, the links; `window.__wa118b` gains `markAt`, `markDone`, `fromLink`, `state`).
- `build/src/192_wave192.seg` unchanged on GitHub (wave214's); only the live page needed it back.
- `fn/checkin-post/index.ts`, `meta.json` (version 17).
- `build/data/wa217_loop_checks.sql`.
- `test/w217drive.js` (new, 33 checks), `test/fx_w192.json` (216's new paragraph).
- `docs/EDGE_FUNCTIONS.md`, `docs/HUB_RELEASE_CHECKLIST.md`.

## Verification

- `test/w217drive.js` 33 of 33 on the candidate: the marks; no check before the hour; the note at 1h with the time and "only you see this"; Still in hides it and writes still_in_at alone; nothing until the next mark; the x waits; unanswered moves on (1.5h, 2h, 2.5h, 3h, 3.5h); another device's still_in_at; Set the time and Cancel; Welcome back first and Still working counts; `?loop=still`, `?loop=close`, a closed loop; the query leaves the address; a phone; no page errors.
- `test/w192drive.js` 76 passed, 4 failed: the same 4 as on the live build before (the chrome tour's step and the reading's headings, numbered steps and callouts; drift from later waves).
- checkin-post v7 live, no message sent: `still_dm` dry answered due 0; a preview for one session gave the message above (the bot can reach that person); a dry close still answers #check-in-out-wa.
- No DM was sent from a test.

## For the next session

- build/candidate.html on GitHub is not the live build (not pushed this time: joining the 6.7 MB file in one pg_net call restarted the database once). Rebuild from the sources, and compare with the live page before building on it: this wave found the live page carrying an older 192 segment than GitHub.
