# 15/10/26 - wave245: the notifications, more robust and more descriptive

Steel, 15/10/26 13:48 Toronto: "The notifications need to be even more robust and descriptive". Three parts, live
15/10/26 about 14:46 Toronto (the Hub b4b062f70950f2f140fd673bcad4ac0f, 7,286,251 bytes): the centre lists every kind the
Hub sends a person, with what each one says; the messages themselves say more; and delivery is one shared path with one
log of what was sent and whether it landed.

## 1. The notification centre, second cut (build/src/242_wave242.seg v2, Settings > Notifications)
- The kinds come from a registry, `hub_notification_kinds` (20 rows): 14 switchable kinds in groups (My work: a task is
  mine, my tasks are due, a request for my team, a meeting suggestion becomes a request, a request of mine moved
  (Slack only); Mentions: in a meeting, @mentioned in the Hub; the Content Studio; Volunteers: a photographer or
  videographer applied; People (HR): a time-off request, an applicant moved; the Loop: Still in?; Announcements), and 6
  channel kinds that go to Slack channels, not to a person (the daily alerts, the weekly digest, shoutouts, the HR
  channel line, the Studio's channel confirmations, the Loop channel), shown for the record without switches.
- Each kind: when it fires, a Hub switch and a Slack switch (`wa242_prefs_set`, all 14 written at once so the choice is
  explicit), Details (what it says, an example with its title and body, who gets it, who sends it) and "Send me a
  sample" (notify `sample` {kind}: the example, for real, through the person's switches on both channels; the toast says
  what Slack and the Hub did).
- A status line (how many devices of theirs have Hub notifications on; whether the Hub knows their Slack account) and a
  warning on a kind that reaches nobody (Hub only and no device on; both off; Hub notifications on but no device yet).
- Recent: the person's last 30 rows of `hub_notifications_sent` (newest first), each with the kind, the channel, the
  title, the words and the outcome in plain words (sent, sent to 2 devices, skipped: switched off here, skipped: no device
  with Hub notifications on, skipped: no Slack account found, failed: ...).
- With the registry unreachable the centre falls back to the ten kinds of the first cut. `test/w242drive.js` (31 checks,
  fixture `test/fx_w245.json` from the SQL seed) covers the groups, the rows, the defaults, the warnings, Details, the
  sample call, the saving, Recent and the fallback.

## 2. The messages (notify v15, hub-push v4)
- A task is now yours: the title, then the team, the project, the due date in words (due today, due tomorrow, due Fri 17
  Oct (in 2 days), was due 3 Oct (12 days ago)), priority, who gave it (and whose it was), the first lines of the
  description (never for a confidential, board-only or restricted task), Open the task.
- New request for your team: the title (and its type), the team, from whom, needed by (in words), priority, the details.
- A meeting suggestion is now a request: the title, the team, the meeting it came from, the quote, the details.
- You were mentioned in a meeting: the meeting, its date, the team, the sentence (a leadership meeting's stays in the
  Hub).
- Your tasks today: each task with its team, its project, when it is due and the first line of its description
  (`wa242_due_lists` carries team, project, line, priority, due_date now).
- The Hub notifications (hub-push) say the same things in short: the task adds the team, the project, the due date and
  priority; the request adds the team, who asked, needed by and the details.

## 3. Robust delivery
- One shared check in the database, `wa245_notify_allowed(email, kind, channel)`: the kind's availability on that
  channel, the person's saved switch for it, the old disabled list, the channel choice (Slack only; Hub only with a
  device). The TypeScript senders apply the same rules (notify `optedOut`/`hubOnly`, hub-push `wants`).
- One log, `hub_notifications_sent` (email, kind, channel, title, body, url, outcome, ref, sent_by, sent_at; RLS: a
  person sees their own rows, admins all; `wa245_log_sent` for SQL senders): notify writes every Slack attempt, hub-push
  every Hub attempt, with the outcome in words. The centre reads it as Recent; an admin can answer "did it land?".
- Three kinds that went straight to Slack with no switch now go through notify as relay events {event, to[], text,
  title, body, url, tag}: `timeoff_request` (hr-notify v3, platform 4), `applicant` (recruit-actions v7, platform 8:
  stage_moved's DM to the person handling the applicant), `loop_still` (checkin-post v8, platform 19: the Still in? DM
  at 3 hours). notify sends the Slack DM through the person's switch and logs it, then asks hub-push (`relay`, sync) for
  the Hub notification through the same person's Hub switch. Each sender keeps its own direct DM as the fallback for
  when notify cannot be reached, and says in change_log which way it went.
- notify's HUB_EVENTS includes the three, so a person on Hub only (with a device) gets no Slack DM for them either, as
  for the other kinds.

## Versions
notify v15 = platform 26 (verify_jwt on); hub-push v4 = platform 5 (off); hr-notify v3 = platform 4 (on); checkin-post
v8 = platform 19 (off); recruit-actions v7 = platform 8 (on). The live copies equal the repo's `fn/*/index.ts` (the
platform turns some `\uXXXX` escapes into the characters; compare modulo escapes).

## The database (build/data/wa245_notification_centre.sql, migration 20261015180000)
`hub_notification_kinds` (seeded, on conflict update), `hub_notifications_sent`, `wa245_notify_allowed`, `wa245_log_sent`,
`wa242_due_lists` re-created with team, project, line, priority, due_date; execute revoked from public, anon and
authenticated, then granted to authenticated where the Hub calls (`wa245_notify_allowed`; `wa245_log_sent` for the
service role only). After the security advisor check, execute on the trigger function `wa239_volunteer_applied()` was
revoked from public, anon and authenticated too.

## Not changed
team-inbox (a request of mine moved) and linkpage still read only the disabled list (the centre keeps it in step).
social-publish v5 reads the switches itself and does not log to `hub_notifications_sent` yet. A sample sent to oneself
is a real message (nothing is sent in the tests). Nobody had a device with Hub notifications on at 14:50 on 15/10
(hub-push's dry relay answered devices 0 for Steel and Valex), so the Hub side of the relayed kinds will show as
"skipped: no device with Hub notifications on" until people turn a device on.

## Also in this release (from the live build, not this wave)
wave244 (another session, 15/10/26: two roles at most on the forms; the coordinator places people who picked two) was
live before this deploy; its segment is now `build/src/244_wave244.seg` in the manifest after 242, with its two `#fff`
baked to the brand cream (`#FFFAF2`) so the build guard passes.
