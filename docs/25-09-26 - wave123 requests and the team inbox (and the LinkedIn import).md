# 25/09/26 - wave123 Requests and the team inbox (plus the LinkedIn import)

Live md5 `52b187105ea6f3c3e4838485753b2795` (3,068,516 bytes), deployed through the gated pipeline (`wa_stage_qr`, guard on live `a7e4ca21`, dropped after).

## What Steel asked

"You need to redo the Request tab, it's hard to navigate and I want to make sure requests are also sent to the department's channel as well as have an inbox on the department's overview page showing the requests that came in via requests and via Hub Inbox (Jev decides whether to notify team or not)."

## The Requests page (#requests)

The old catalogue (fifteen cards from every team in one grid, a search box, six recent requests with no status) is replaced by four views under the masthead:

- **New request**: "Who do you need something from?" with a tile per team (what the team is asked for, how many kinds of request, its Slack channel), a search across every kind of request, "Again" chips for the kinds you used before, and the asks spotted in meetings. Then "What do you need from Marketing?" (the team's request types, plus Something else). Then a short form with a side panel: where it goes (the team inbox, the Slack channel, who picks it up) and how it moves (the type's statuses). Needed by (or the type's own date field), an urgent switch, "Anything else". Drafts survive going back and forth. Time off opens the existing time off form (wave105, now exported as `window.w105ReqModal`). After sending: a confirmation that shows when the Slack post landed (or why it did not).
- **My requests**: open requests with a progress bar per request (the type's status steps), then done.
- **Team inbox**: one list per team (chips for every team the person may see): requests to the team, emails the Hub inbox filed for the team (with Jev's call), and asks spotted in its meetings (accept, add to an open request, or dismiss). Filters: Open or Done and earlier; Everything, Requests, Emails, From meetings; With me. Urgent and late first, then due within three days, then newest.
- **All requests** (leaders and admins): every team, open or done, with search.
- **Slack settings** (leaders see, admins change): each team's channels (tried in order), whether emails are Jev's call or always or never pinged, a test post per team, and the three switches (post new requests, thread replies, message the requester).

Every request and email opens in a sheet (deep links `#requests/r/<id>` and `#requests/m/<id>`):
- Request: team and type, who asked and when, needed by, status steps you can click, status and "with" selects, Mark done or Reopen, what they asked for, the Slack post (link to the thread, or the reason it did not post and "Post it now"), and the activity (created, status changes, hand-offs, notes). Notes go into the Slack thread and reach the requester.
- Email: Jev's decision (pinged which channel and why, or filed quietly, with how sure Jev was), the summary, what the Hub did with it (task, meeting pipeline, Recruitment, team update) with a link, attachments, the email itself (HR mail only for leaders and HR), "Mark handled", "With", and "Make it a request" (a tracked request with the email as its source; the email shows "Tracked as a request").

Deep links: `#requests/new[/team[/type]]`, `/sent/<id>`, `/mine`, `/team[/team]`, `/all`, `/settings`.

## The Team inbox card on every department overview

`#team/<team>` gets a Team inbox card at the top of the left column: counts (open requests, how many are urgent or late, emails from the Hub inbox, asks from meetings), the first five items, "open the inbox", "+ Ask <team> for something" and the channel requests post to. Rows open the sheet in place (the page stays where it is).

## Slack: the team-inbox edge function

Database triggers (migration `wa123_requests_inbox`) call `team-inbox` through `public.call_edge`, so every way a request is filed (the new page, Ask the Hub, meeting suggestions, time off, HR forms, a converted email) is covered:
- **New request**: posted in the team's channel with the type, a link to the request, up to five detail lines, who asked, needed by, urgent, and a mention of the owner (the assignee or the type's default). Time off is posted without its details. The channel, ts and link are kept on `dept_requests.slack`.
- **Status, done, hand-off**: a reply in the request's thread; the requester gets a DM when it is done, a new owner when it is handed to them.
- **Notes**: into the thread; the requester (or the owner, when the requester wrote it) gets a DM.
- **Emails the Hub inbox files for a team**: Jev (OpenRouter's decision model, task `mail_triage`) is asked whether the team should hear about it now (a question or request to them, a deadline, a bill, an applicant, a partner or donor waiting) or whether finding it in the inbox is enough, what it is (act, deadline, FYI, record) and whether it is really a request. A ping goes to the team channel only when Jev says so (55% or more, or act/deadline with confidence); the decision is kept on `hub_mail.notify` and shown in the inbox, the sheet and as a chip on the Hub inbox page. If Jev does not answer, bills, applicants and anything due within ten days get a ping.

Channels (hub_settings `team_inbox`, editable in Slack settings): Operations Montreal #operations-mtl, Program Development #program-development, Operations Toronto #toronto-operations then #general-toronto, Marketing #social-media, Fundraising and Finances #fundraising (grant information requests go to #grants), HR #human-resources, Board #board-of-directors. The Hub bot is in every one of these except #toronto-operations (private): until someone adds the Hub app there, Toronto requests post in #general-toronto. The old `notify` DMs on a new request (assignee or two team leads) keep working.

## Data (migration wa123_requests_inbox)

- `dept_requests` + `requested_email` (defaults to the signed-in email; backfilled from names), `needed_by`, `priority` (normal, urgent), `source` (requests, meeting, ask, timeoff, email), `mail_id`, `slack`.
- `request_types` + `channel` (per type override), `channel_mode` (time off: brief).
- `request_notes` (staff read; insert own; delete own or admin).
- `hub_mail` + `notify`, `team_state` (open, done, request), `team_done_by`, `team_done_at`, `assignee`, `request_id`; staff change these only through `team_inbox_mail()` (security definer), so the rest of `hub_mail` stays read-only.
- Triggers `trg_wa123_request_new`, `trg_wa123_request_update` (status, done or assignee changed), `trg_wa123_note_new`, `trg_wa123_mail_filed` (filed to a team, not test mail).
- Notification settings gain "A request I asked for is done, or someone adds a note to it" (`request_update`, wave116j).

## mail-pull v8

- A `List-Unsubscribe` header alone no longer marks mail as noise (Google Groups add one to real people's mail). Bulk senders (no-reply, newsletter, mailing services, Precedence bulk) still do. One real email was ignored by the old rule: "Re: Volunteer Available on Weekends" (hub_mail 20); File anyway from the Hub inbox page puts it in front of Ops Montreal.
- "Invitation with note" and "Cancelled event with note" are calendar mail.
- Job applications now match open positions in `dept_requests` (the table name was wrong, so no application was ever linked to a position).

## Tours and training

The Requests page tour is rewritten for the new page (six steps) and the team page tour gains the Team inbox card. Hub module 4 (training 42) describes the new flow.

## Tests

`test/w123drive.js`: 52 checks as Steel (search, team, need, form validation, drafts, sending, the sheet, status, assign, notes, done, reopen, last step, Escape, My requests, Something else, the inbox and its filters, the email sheet with Jev's call, the email body, make it a request, accept and dismiss suggestions, the team card in place and after a re-render, time off, a deep link to a request that did not post, all requests, settings save, keyboard), 50 as Amanda, 52 at phone width, 3 as a board viewer (no takeover, staff-only message). Harness 36 pages x3 roles: only ERR_FAILED; page diffs against the live build with the same fixture are only requests, team, hubmail (the chips) and the known timing noise on goals and hrcentre. Churn zero on ten Requests, team and Hub inbox views. Academy drive 35/35 and every tour, including the new Requests and team tours. `test/w123shots.js` for screenshots. Fixture rows from `build/data/w123_fixture.py`.

## LinkedIn (Steel's exports, 25/09/26)

`build/data/linkedin_import.py` read the three exports (content, followers, visitors: 24/09/25 to 23/09/26) into Social analytics through `social-pull` v1.5 `import_csv` (which now keeps post clicks, engagement and raw fields, and audience breakdowns in the account meta): 3,285 daily numbers (impressions as views, unique impressions as reach, clicks, reactions, comments, reposts, engagement, new followers, page views), 37 posts (impressions, reactions, comments, reposts, clicks, CTR, engagement rate, follows), and the follower and visitor breakdowns by location, job function, seniority, industry and company size. In the year: 20,030 impressions, 1,139 engagements, 264 new followers, 1,678 page views. LinkedIn's export has no running follower total, so the tile's follower number stays empty until we have the current count from the page (one number, then the line can be drawn back from the daily new followers).

## Open

- Add the Hub app to #toronto-operations (then Toronto requests post there instead of #general-toronto).
- `slack_sources` still lists #operations-toronto, which is archived.
- The LinkedIn follower total, and the analytics depth work (breakdowns on the page, longer ranges, per-post depth).
