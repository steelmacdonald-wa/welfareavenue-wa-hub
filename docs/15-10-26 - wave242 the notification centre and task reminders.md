# 15/10/26 - wave242: the notification centre and the day's task reminders

Steel, 14/10/26 marketing meeting: a notification centre where each person chooses, kind by kind, what reaches them in
the Hub and what reaches them on Slack; and reminders for the tasks that are due. Live 15/10/26 about 14:50 Toronto.

## Settings > Notifications (build/src/242_wave242.seg)
- Ten kinds, each with a Hub switch and a Slack switch: a meeting mentions me; someone @mentions me in the Hub; a task is
  given or handed to me; my tasks due today, tomorrow or overdue; a request is filed for my team; a meeting suggestion
  becomes a request for my team; a request I asked for is done or gets a note (Slack only); the Content Studio (a post
  waits for my approval, is decided, or is mine to post by hand); a photographer or videographer applies (the owner of the
  photographer step); a new announcement for me (Hub only: its Slack post and email stay as they are).
- Each switch saves by itself through `wa242_prefs_set` (every kind is written, so the choice is explicit from then on).
  Before a person touches the centre, the switches show the old rules: the disabled list, the Hub/Slack channel with a
  device on.
- wave116j's checkbox list and wave219's "where they arrive" radios and announcement checkbox stay in the code and are
  hidden once the centre is mounted (the device row, the other devices, the test and Install stay).
- The reminders row says what is due right now (`wa242_due_mine`: due today, due tomorrow, overdue) and has "Send me
  today's reminder" (`wa242_remind_me`, at most three a day).

## The database (build/data/wa242_notifications.sql, migration wa242_notifications)
- `wa_notify_prefs.prefs.kinds[kind] = {hub, slack}`; `disabled` kept in step (a kind with Slack off is listed) for the
  senders that only read that list (team-inbox: a request update; linkpage).
- `wa242_name_is(cand, email, name, nicknames)`: is this owner or allowed person this team member (the email, the full
  name, a unique first name as a whole word, a nickname).
- `wa242_due_lists(member)`: the member's open tasks with a date (today, overdue 60 days, tomorrow), a task being theirs
  when they are an assignee or the named owner, and only when they could open it (board_only, visibility, allowed_people
  as wa_sees_restricted reads them). `wa242_due_mine()`: the caller's.
- `wa242_due_reminders(p_dry)`: weekdays 8:30 Toronto (cron `wa-task-due`, `30 12 * * 1-5`): each active team member
  (not blocked, not a viewer) with tasks due today or tomorrow, or overdue when it is Monday, gets the payload
  `{event: task_due, email, name, day, due_today, overdue, due_tomorrow}` through `call_edge('notify')` and, with a device
  on and push_on, `call_edge('hub-push')`; once a day a person (change_log entity_type task_due, field the day). The dry
  run returns the plan and sends nothing. `app_config task_due = off` pauses it. The dry run on 15/10 named six people
  (Ahmed, Ian, Eduardo, Amanda, Jemeela, Steel).
- `wa242_remind_me()`: the caller's reminder now (logged with field "<day> asked").
- Execute revoked from anon and authenticated on the internal functions; the caller's three stay for authenticated.

## The senders
- notify v14 (platform 23) and hub-push v3 (platform 3) already read `prefs.kinds` (deployed with wave239).
- social-publish v5 (platform 13): `channelOf` reads `kinds.content_studio`: Slack off means no DM whatever the devices
  ('hub-only'), Hub off means no Hub notification, both off means switched off; no entry means the old rules.

## Deploy
- Front end: index.html 6f0b740cd5b78569dab8a020d0ca1ddf (7,223,199 bytes) over ed7af015.
- Tests: test/w242drive.js 21 of 21 (the centre and its ten kinds, the defaults, the hidden older controls, a flip saving
  every kind with the one change and the saved answer, the reminder row and button, saved switches and the old rules read
  back, a member); test/w219drive.js 82 of 82 (one expectation widened for the centre's line). w116jdrive, w116j2drive and
  w138drive fail the same way on the previous live build (stale tests, not regressions).
