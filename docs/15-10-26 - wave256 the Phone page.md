# 15/10/26 - wave256: the Volunteer Manager's Phone page (texts and calls), and the usual spot counts

Steel (15/10/26): "The volunteer manager needs to have a page where the phone and messages can be used. Similar to the text
volunteers pop up. That should also be a page in itself. I'm also curious if phone calls itself can be done there." Then:
"Also where do I edit the number of positions per event".

## Can calls be made in the Hub?

Quo's API (2026-03-30 and v1) lists calls, recordings, summaries, transcripts and voicemails, but has no endpoint that starts
a call. A web page cannot ring a phone on its own without a voice provider (Twilio and the like would mean moving the ops
line off Quo). So:
- **Call** in the Hub is a `tel:` link. On a computer with the Quo desktop app set as the calling app (Windows: Default apps,
  TEL; Mac: FaceTime, Default for calls), Quo opens with the number filled in and calls from the selected line. On a phone it
  opens the dialer or Quo.
- **Every call shows in the Hub**: quo-calls copies the ops line's calls into `quo_calls` every 10 minutes (and on Check now):
  missed, answered and their length, voicemails, Quo's call summary when the plan makes one.

## The page (`#volunteering/phone`, build/src/256_wave256.seg)

- The Volunteer Manager's rail: People > Phone, with the number of people who wait (a text nobody answered, or a missed call
  nobody returned). The classic Volunteering page gets a Phone chip.
- Header: the ops line, whether texts send now (9 am to 7 pm Montreal), New text, Text a group (wave23's Text volunteers
  window), How calls work. Counts: texts waiting, missed calls to return (each filters the list), when calls were last
  checked, Check now.
- The list: every number texted or called in 60 days, waiting first; filters All, Waiting, Missed calls, Texts, Calls;
  search by name or digits.
- A conversation: the name, number, volunteer record, Call; their next servings (folded; Coming / Can't make it / Add as
  coming, wa191_text_roster); one timeline of texts (the Hub's copy plus what was typed in Quo) and calls (a call card; the
  voicemail and Quo's summary for leaders, HR and admins); what waits (No reply needed, Call back, No call back needed); the
  reply box (wa191_text_reply).
- New text: a volunteer or CRM contact by name or number (wa256_phone_lookup), or any typed number.
- Re-reads every 30 seconds while open. Phone width: the list, then the conversation with Back.
- Leaders, HR and admins text and mark; other staff read (no summaries or voicemail text) and can still Call.
- Tour `w122.tours.phone`, trainings row `tour:phone` (Hub page tours).

## Usual spot counts (parts191/c_event.js)

The serving's More > Spot counts window (wave232) sets one serving's numbers. It now also has **Make these the usual
counts** (leaders, HR and admins, with a confirm listing the changes): writes `volunteer_role_guides.target` for the
changed roles, logs `change_log` (volunteer_role_guides, usual_spot_counts), and puts this serving back on the usual counts.

## Data (build/data/wa256_phone.sql)

- `quo_calls` (no grants; read through the functions): quo_id, phone, ph, direction, status, duration, answered_at,
  completed_at, created_at, quo_user, ai_handled, summary, next_steps, voicemail_text, voicemail_seconds, has_voicemail,
  handled_at, handled_by, synced_at.
- `wa256_phone_inbox(p_days)` (staff): {texts (wa191_recruit_inbox), calls (one row a number), can, synced_at, window}.
- `wa256_phone_calls(p_phone)` (staff; summaries and voicemail text for leaders, HR and admins).
- `wa256_call_done(p_phone)` (leaders, HR, admins; change_log volunteer_call).
- `wa256_phone_lookup(p_q)` (staff), `wa256_can_text()`, `wa256_missed_open(ph)` (internal).
- app_config `quo_calls_synced_at`. Cron `wa-quo-calls` (`6,16,26,36,46,56 * * * *`, quo-calls sync).

## Edge function quo-calls v1 (platform 1, fn/quo-calls)

`sync` (trigger secret or a leader, HR person or admin): the calls since the last sync (two days back again for late
summaries; 30 days on a first run; at most 8 pages of 50), upserted on quo_id. `probe` (admins). Never places a call or
sends anything. First run 15/10/26: 41 calls in 30 days, then 81 over 88 days; 9 numbers had missed calls not yet returned.

## Release

- Live 15/10/26 about 17:25 Toronto: index.html `3d68e04e29a43b34bfd24fc34fd6f1e0` (on wave245's `b4b062f7`), gated
  deploy (stage wa_stage_256, closed to the API after), host-sync 200, live checked byte for byte.
- Tests: test/w256drive.js 30/30 (rail and count, header, counts, list order and badges, filters, search, timeline, waiting
  lines, No call back needed, Send, Coming, Check now, New text lookup and typed number, Text a group, How calls work,
  a staff member who cannot text, phone width, Make these the usual counts). Regression on the candidate: w191rec 50/50,
  w191drive 39/39, w153drive 46/46, w191board 9/9; w134drive 29/34 and w163drive 38/40 fail the same checks on the live
  build (older menu drift). Tour `phone` 5 of 6 steps highlighted (New text only shows to people who can text).
- The real functions tried as Steel in a rolled-back block: 71 text conversations, 39 numbers with calls, 9 with missed
  calls to return.
- Security advisor: no new ERROR (volunteer_people view and another session's wa_stage_push244_rids remain); the wa256
  functions are in the usual security-definer WARN list.

## For Steel

1. Reload the Hub, open the Volunteer Manager, People > Phone.
2. To call from the Hub on your computer, install the Quo desktop app and set it as the calling app (How calls work on the
   page has the steps).
3. 9 numbers have missed calls nobody returned in the last 30 days: Call back, text, or No call back needed.
