# Welfare Avenue Hub: edge functions and cron audit

Date: 26 Sep 2026. Project `zwnmulmnvopclzcvytce`. Read only: nothing was deployed, invoked, inserted, updated or deleted.

Evidence used:
- `list_edge_functions` and `get_edge_function` (live list, live source of the 17 functions missing from the repo).
- Repo sources in `/root/wa-hub/fn/*/index.ts` (37 functions), release notes in `/root/wa-hub/docs`, the front end `build/candidate.html` and `build/src/*.seg`.
- SQL (SELECT and catalog only): `cron.job`, `cron.job_run_details`, `pg_proc`, `pg_trigger`, `pg_policies`, `net._http_response`, `information_schema`, vault secret names (names only, no values), counts and dates from public tables.
- Edge logs (`function_edge_logs`, `function_logs`) for every day from 12 Sep 05:50 UTC to 26 Sep 05:50 UTC (14 days).

Two corrections to the brief: the project has **54** live functions, not 55 (37 in the repo, 17 live only; nothing in the repo is missing from live). There are **21** cron jobs (ids 1 to 20 and 24; ids 21 to 23 were deleted and have no history).

---

## 0. The findings that matter most

1. **Four functions still call Anthropic directly and the Anthropic account is out of credit.** `slack-pull`, `transcript-requests`, `finance-import` and `hub-edit` bypass the `llm` router. Logs and data show the error "Your credit balance is too low": slack-pull has not completed since 24 Aug (four missed Mondays) and finance-import failed on 25 Sep. transcript-requests swallows model errors (`catch (_) {}`) and still marks the transcript as scanned: its last output of any kind was on 24 Aug, and the only new meeting since (25 Sep, scanned one hour after finance-import hit the credit error) is now marked done with nothing extracted and will never be retried. The release note for the router says "Nothing talks to api.anthropic.com any more", which is wrong. [OBVIOUS]
2. **Cron cannot see any of this.** Every cron job calls `public.call_edge`, which only queues an HTTP request through pg_net and returns in under 0.1 s. `cron.job_run_details` shows 100% "succeeded" for 14 days, while edge logs show 38 failed runs (37 of them on 12 to 14 Sep, when PostgREST timeouts made functions answer 401 or 500, including three nights with no database backup) plus the silent background failures above. `health-check` only watches the model router, so it reports green. [OBVIOUS]
3. **"Staff" in the edge functions means any @welfareavenue.com sign-in, not the Hub's access model.** The database helper `is_wa_staff()` refuses the 5 people with role `blocked`, but 44 functions only check the email domain and then read or write with the service role. Two blocked people still have auth accounts. The worst reachable actions: search the whole hub@ mailbox with any Gmail query (`mail-pull` probe), delete a social account and, by cascade, about 19,500 analytics rows (`social-pull` disconnect), commit to the GitHub repo (`repo-sync`), post as the Hub bot to any public channel (`checkin-post` say). [OBVIOUS]
4. **Program Development is missing from 14 of the 20 hard-coded department lists.** In `process-leadership` and `transcript-preview` the list is the model's enum, so leadership outcomes and previews can never land in Program Development; `transcript-requests` silently drops its suggestions. The live Hub has 7 departments. [OBVIOUS]
5. **Broken internal calls.** `slack-command` and the `on_onboarding_help` trigger call `notify` without a JWT (notify has verify_jwt on, so the gateway rejects them); the onboarding trigger also sends an event name notify does not handle, so the onboarding "I need help" button has never notified anyone. `hub-invite` plus the `trg_wa89_invited` trigger send the welcome DM twice: 3 people received it twice within two minutes (10 welcome DMs sent in total). [OBVIOUS]
6. **Heavy copy and paste.** `getSecret` is defined 51 times, CORS and `json()` 48 times, the auth helper 46 times under six different names, Google service-account signing 7 times, the site URL hard-coded in 19 functions. Pairs share up to 72% of their lines (goal-propose and goal-suggest; weekly-digest and daily-alerts 69%). [DECISION: a shared module needs a small change to fn-deploy]
7. **Seven functions are legacy and can go:** `import-images`, `dashboard`, `site`, `attach-rehost`, `sop-import`, `quo-sync`, `clickup-pull` (plus cron job 5). None had a single call in 14 days except clickup-pull, whose output the release notes say nothing reads. `sop-import` is dangerous to re-run (it would overwrite Hub edits) and contains a hard-coded shared password (location in section 4.6).

---

## 1. All 54 functions

"Gate" is what really protects the function. `verify_jwt = true` only proves the caller holds some valid JWT, and the public anon key is one, so the in-code check matters for every function. "Staff" below means: the trigger secret header (`x-wa-secret`) or a JWT whose email ends in @welfareavenue.com (18 functions also accept the owner's personal Gmail address). "Last evidence" counts non-OPTIONS requests in the 14-day edge logs unless stated.

| # | Function | Purpose | Triggered by | verify_jwt | Gate in code | In repo | Last evidence | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | agenda-share | Shareable agenda link: staff create, revoke and post it to Slack; anyone with the link reads that agenda and adds items | Front end agenda card (create_link, revoke_link, post_slack); public link page (get, add) | false | Public token for get and add (random, no expiry, no rate limit); staff for the rest | no | 0 calls. 2 links live, 0 public additions ever, last link made 28 Jul | unknown (keep and harden, or retire) |
| 2 | ask | Ask the Hub (the Brain): answers from a fixed context, proposes confirm-first actions | Front end chat | true | Staff; `board_circle` decides board access | yes | 13 calls, 7 failed with 500 between 14 and 23 Sep (no console error logged; most likely the Anthropic credit outage, since they stop once the OpenRouter key was added on 23 Sep) | keep |
| 3 | attach-rehost | One-off: copied ClickUp attachments into the sop-shots bucket | Nothing (manual, July) | false | Staff | no | 0 calls; single version from 27 Jul | legacy |
| 4 | build-agenda | AI agenda builder (department, 1:1, group, leaders) | Front end agenda card | true | Staff | yes | 3 calls (2 returned 400 on 24 Sep) | keep |
| 5 | calendar-sync | Mirrors the hub@ Google Calendar into `hub_events` | Cron 13 (every 30 min) | true | Staff | yes | 71 calls since 24 Sep, all 200; state table OK | keep |
| 6 | checkin-post | Check in and out to the check-in Slack channel, AI bullet summary, closes ticked tasks; also a generic `say` (post any text to any named channel as the bot) | Front end check-in, volunteering recap, content calendar | false | Staff (the secret may impersonate anyone via `as_email`) | yes | 20 calls, all 200 | keep (move `say` out) |
| 7 | checkin-scope | Weekly AI scope of work per person from every check-in-out channel | Cron 10 (Mon); front end HR centre refresh | true | Staff | yes | Both cron runs failed (14 Sep 401, 21 Sep 500); last success 24 Aug | merge candidate (check-in data) |
| 8 | clickup-pull | Weekly ClickUp snapshot per department into `clickup_weekly`, plus a Slack line | Cron 5 (Mon) | false | Staff | no | 2 runs (14 Sep 401, 21 Sep OK). Wave116 notes: nothing reads the table any more | legacy |
| 9 | daily-alerts | Daily Slack alert: tasks just overdue or a week overdue, decisions open 14 or 30 days | Cron 2 (daily) | false | Staff | yes | 14 runs, 2 failed (12 Sep 500, 14 Sep 401) | merge candidate (digests) |
| 10 | dashboard | Old stable link that redirects to `app_config.site_url` | Nothing (only a fallback URL in two digests) | false | None, public redirect | no | 0 calls | legacy |
| 11 | db-backup | Nightly JSON export of every public table to the private `db-backups` bucket, 30-day retention | Cron 8 (daily) | true | Trigger secret only | no | 14 runs, 3 failed (12 and 13 Sep "Gateway Timeout", 14 Sep 401): three nights without a backup, unnoticed | keep (add alerting) |
| 12 | directory-sync | Mirrors the Workspace directory: roster queue, deactivations, Google photos | Cron 15 (daily); front end People and access | true | Secret, or admin (hub_roles, plus a hard-coded fallback list) | yes | 97 calls, all 200 | keep |
| 13 | draft-content | Create page: AI drafts in the house style, review routing to Slack | Front end Create page | false | Staff | yes | 0 real calls (one smoke test); last draft 29 Jul | keep |
| 14 | drive-pull | Indexes Drive files the service account can see (and Google Doc text) into `wa_drive_docs` | Cron 11 (daily) | true | Staff | no | 14 runs, 2 failed (13 and 14 Sep 401) | keep |
| 15 | finance-import | Bank statement (text or PDF) to categorised transactions via AI | Front end Finance | true | Staff | no | 1 call on 25 Sep, failed: "credit balance is too low" | keep (fix: use llm) |
| 16 | fn-deploy | Build tool: list, get and deploy functions through the Management API with a personal access token from the vault | `build/fn.py` | true | Trigger secret only | yes | 135 calls, all 200 | keep (build tool) |
| 17 | goal-propose | AI proposes quarterly goals for one department | Front end goals page | true | Staff | yes | 1 call (25 Sep, OK) | merge candidate (with goal-suggest) |
| 18 | goal-suggest | AI gap analysis for one goal: missing tasks | Front end goals page | true | Staff | yes | 0 real calls; last suggestion 3 Aug | merge candidate |
| 19 | goal-sync | Two-way sync of goals and goal comments with ClickUp goal lists | Cron 6 (daily); front end status and comments | false | Staff | yes | 17 calls, 4 non-2xx (12 and 14 Sep 401, two 404 on 24 Sep) | keep (owner: is ClickUp still the goal source?) |
| 20 | health-check | Daily check of the model router and Jev; Slack alert on a state change | Cron 12 (daily) | false | Staff | yes | 3 calls, all 200 | keep (extend to job freshness) |
| 21 | host-sync | Build tool: assembles `site_files` and deploys index.html and `_headers` to Netlify | `build/deploy_gate.py` through SQL `call_edge` | true | Trigger secret only | yes | 43 calls, all 200 | keep (build tool) |
| 22 | hours-pull | Parses "in" and "out" lines in Slack check-in channels into weekly hours per member | Cron 4 (daily); front end manual run | false | Staff | no | 14 runs, 1 failed (13 Sep 401); completes daily | merge candidate (check-in data) |
| 23 | hub-connect | Per-person connections: Slack match, Google Calendar and Drive delegation, RSVP, recent Drive files | Front end Settings | true | Staff | yes | 95 calls, one 401 | keep |
| 24 | hub-edit | Admin "Edit with AI": instruction to a preview of content operations | Front end admin | true | Admin (hub_roles, plus a hard-coded founders list) | no | 0 calls, no change_log entry ever; calls Anthropic directly (no credit) | unknown (fix or retire) |
| 25 | hub-invite | People and access: invite (Gmail from hub@), bulk invite, sign-in link, set email, remove | Front end People and access | true | Admin or leader (role-aware) | yes | 48 calls, two expected 403 | keep |
| 26 | import-images | One-off: re-hosted department header images | Nothing (2 Jul) | false | Trigger secret only | no | 0 calls | legacy |
| 27 | inventory-share | Expiring, rate-limited volunteer inventory editor link | Front end (create, revoke); public editor page in storage | true | Staff for link admin; token for list and save | no | 0 calls; a link is live until 4 Nov; inventory last edited 27 Jul | unknown (keep, or revoke the link and retire) |
| 28 | llm | The model router: every AI job to OpenRouter per `ai_routes`; Jev decisions; `ai_calls` log; route admin | 21 functions; front end (AI models card, photo labels, volunteering recap, captions, Brain suggestions, Jev) | true | Service key, trigger secret or staff; admin for route edits | yes | 169 calls, 2 failed (24 Sep) | keep |
| 29 | mail-pull | Reads the hub@ inbox, classifies with AI, files invoices, meeting summaries, updates and job applications; undo, refile, test, probe | Cron 14 (every 30 min); front end Hub inbox | true | Staff for every action | yes | 74 calls, all 2xx; state table clean | keep (tighten actions) |
| 30 | notify | Slack notifications: DMs (opt-outs, Slack id cache) and channel posts | DB triggers (5 through `wa_notify_call`, plus `on_onboarding_help`); front end (test, welcome kit, change requests); hub-invite; slack-command | true | Trigger secret for all events; staff JWT for 5 events | no | 24 calls, all 200; last delivery 25 Sep | keep (make it the one Slack sender) |
| 31 | person-profile | AI job description for one member from their tasks and SOP steps | Front end profile | true | Staff | yes | 57 calls, all 200 | keep |
| 32 | photo-library | Build tool: upload, check, remove photos under `content-images/photos` | Build sessions | false | Secret, or `is_wa_staff()` with the caller's JWT (role-aware); admin to remove | yes | 16 calls on 25 Sep, all 200 | keep (build tool) |
| 33 | process-leadership | Leadership meetings: AI extraction fanned out across departments | DB trigger `trg_wa65_leadership` (department like "leadership") | true | Staff | yes | 0 real calls; last leadership transcript 4 Aug | merge candidate (transcript pipeline) |
| 34 | process-transcript | Department meetings: updates, tasks (owner, project, due date, priority), closures, decisions, bank; Jev checks | DB trigger `trg_transcript_insert` (every insert); front end reprocess; mail-pull (direct call, see 3.6) | true | Staff | yes | 6 calls, one 401 | keep |
| 35 | project-report | AI narrative for a downloadable project report (nothing stored) | Front end project page | true | Staff JWT only | yes | 0 real calls | keep |
| 36 | project-slack | Posts a project summary with @mentions to a chosen channel | Front end project page | true | Staff | yes | 2 calls on 14 Sep; last recorded send 7 Aug | keep (share the Slack helper) |
| 37 | quo-pull | Reads recent inbound SMS replies (Quo) from one event's roster | Front end event summary | true | Staff | no | 1 call (24 Sep, OK) | merge candidate (quo) |
| 38 | quo-send | Draft-and-confirm SMS to volunteers, with personal confirmation links | Front end volunteer texting | true | Staff (any staff, up to 200 recipients) | yes | 0 calls; 4 messages ever, last 27 Jul | merge candidate (quo) |
| 39 | quo-sync | One-off: linked volunteer records to Quo contacts by phone | Nothing | true | Staff | no | 0 calls; last sync 27 Jul | legacy |
| 40 | recommend-decision | AI recommendation for an executive decision, with Jev odds | Front end decision card | false | Staff | yes | 3 calls (one 400); last recommendation 25 Sep | keep |
| 41 | repo-sync | Build tool: GitHub probe, tree, read blob, create blobs, commit, with the vault GitHub token | `build/repo_push.py`, `build/repo_pull.py` | false | Secret, or ANY staff JWT | yes | 242 calls (3 x 400); zero staff-JWT calls | keep (restrict to the secret) |
| 42 | shoutouts | Daily AI shout-outs into `hub_shoutouts`; staff add and remove | Cron 17 (daily); front end HR centre | true | Secret or admin for refresh; staff for add | yes | 2 calls, both 200 | keep |
| 43 | site | Old host: served index.html from `site_files` for a Netlify proxy | Nothing (host-sync now deploys straight to Netlify; no `_redirects`) | false | None, public | no | 0 calls | legacy |
| 44 | slack-command | The `/hub` slash command (tasks, project, request) | Slack (external webhook) | false | Slack signing secret (HMAC v0, 5-minute window, constant-time compare) | yes | 1 smoke test. `SLACK_SIGNING_SECRET` is not in the vault, so every command is refused | unknown (finish or retire) |
| 45 | slack-digest | Weekly per-department digest to each department's channel | Cron 9 (Mon) | true | Staff | yes | 2 runs (14 Sep 401, 21 Sep OK) | merge candidate (digests) |
| 46 | slack-pull | Reads Slack channels and the token owner's DMs; AI turns work items into per-department digest transcripts and team pulse scores | Cron 3 (Mon); front end manual run | false | Staff | no | Both runs failed (14 Sep 401; 21 Sep accepted then "credit balance too low"); last success 24 Aug | unknown (fix via llm, or retire) |
| 47 | social-publish | Content calendar publisher to Facebook and Instagram; confirms posts against analytics | Cron 20 (every 5 min); front end content calendar; social-pull | false | Secret, service key or staff | yes | 205 calls since 25 Sep, all 200; the calendar holds 1 post | keep (run less often) |
| 48 | social-pull | Marketing analytics: Meta, GA4, CSV imports, backfill, weekly AI note | Cron 18 (daily) and 19 (Mon); front end analytics | false | Staff; admin for some actions | yes | 55 calls, all 200 | keep (gate `disconnect`) |
| 49 | sop-import | One-off: imported the Sunday Serving SOP from ClickUp | Nothing | false | Staff | no | 0 calls; single version from 27 Jul | legacy |
| 50 | suggest-reason | AI reason category and rationale for a decision or flagged task | Front end | false | Staff | yes | 0 calls | merge candidate (into recommend-decision) |
| 51 | team-inbox | Requests and filed mail to team channels, threaded updates, DMs on done and hand-over; Jev decides mail notices | DB triggers (dept_requests insert and update, request_notes insert, hub_mail update); front end settings | true | Trigger secret for events; staff or leaders for actions | yes | 13 calls, all 2xx | merge candidate (Slack delivery with notify) |
| 52 | transcript-preview | Dry run before upload: expected actions, nothing written | Front end upload | true | Staff | yes | 1 real call (24 Sep) | merge candidate (dry-run mode of the pipeline) |
| 53 | transcript-requests | Every 2 hours: new transcripts to request suggestions, task comments, due dates, goal wins, mentions | Cron 7 (every 2 h) | true | Staff | yes | 168 runs, 22 failed (12 to 14 Sep); last output of any kind 24 Aug; the 25 Sep meeting produced nothing | keep (fix now) |
| 54 | weekly-digest | Monday executive summary to Slack | Cron 1 (Mon) | false | Staff | yes | 2 runs (14 Sep 500, 21 Sep OK) | merge candidate (digests) |

Counts: verify_jwt false on 22 functions, true on 32. In repo: 37. Keep: 29. Legacy: 7. Merge candidates: 13. Unknown (owner decides): 5.

### Saved sources for the 17 live-only functions

`audit/fn_src/<name>/index.ts` is the live source byte for byte (extracted from the tool results by script, not retyped), with `meta.json` in the repo format (`verify_jwt`, `version`). `audit/fn_src_manifest.json` records version, dates and the bundle sha for each. One redaction: `sop-import/index.ts` line 62 hard-codes a shared volunteer password as a scrub pattern; the saved copy says `REDACTED` there. No other secrets, keys or tokens appear in any of the 54 sources. The saved files still carry the same kind of non-secret identifiers the repo already holds (the owner's personal Gmail in the staff allowlist, the organisation's Quo phone number, a ClickUp list id, and staff first names in two SOP review notes in sop-import); strip them before committing if the repo should not hold them. Four repo functions have no `meta.json`: calendar-sync (live verify_jwt true, v2), goal-sync (false, v3), hub-invite (true, v5), photo-library (false, v1). The 33 repo `meta.json` versions all match live; file contents were not diffed byte for byte (`build/fn.py get` can do it).

---

## 2. Cron jobs

All schedules are UTC (`cron.timezone` is GMT). Toronto times below are for daylight time; from 1 Nov every job runs one hour earlier in local time, so "9am" jobs become 8am.

| id | Job | Schedule (UTC) | Toronto (EDT) | Runs | cron status, 14 days | Real result from edge logs, 14 days |
|---|---|---|---|---|---|---|
| 1 | wa-weekly-digest | `0 12 * * 1` | Mon 08:00 | weekly-digest | 2 succeeded | 14 Sep 500, 21 Sep 200 |
| 2 | wa-daily-alerts | `0 13 * * *` | daily 09:00 | daily-alerts | 14 succeeded | 2 failed (12 Sep 500, 14 Sep 401) |
| 3 | wa-slack-pull | `30 11 * * 1` | Mon 07:30 | slack-pull | 2 succeeded | 14 Sep 401; 21 Sep 202 then failed in the background. No completion since 24 Aug |
| 4 | wa-hours-pull | `15 12 * * *` | daily 08:15 | hours-pull | 14 succeeded | 1 failed (13 Sep 401); change_log shows daily completion |
| 5 | wa-clickup-pull | `20 11 * * 1` | Mon 07:20 | clickup-pull | 2 succeeded | 14 Sep 401, 21 Sep completed. Output unread |
| 6 | wa-goals-sync | `10 11 * * *` | daily 07:10 | goal-sync | 14 succeeded | 2 failed (12 and 14 Sep 401) |
| 7 | wa-transcript-requests | `25 */2 * * *` | every 2 h | transcript-requests | 168 succeeded | 22 failed (12 to 14 Sep); since then 200, but the one new meeting (25 Sep) produced nothing |
| 8 | wa-db-backup | `10 7 * * *` | daily 03:10 | db-backup | 14 succeeded | 3 failed (12, 13 Sep 500; 14 Sep 401) |
| 9 | wa-slack-weekly-digest | `0 13 * * 1` | Mon 09:00 | slack-digest `run` | 2 succeeded | 14 Sep 401, 21 Sep 200 |
| 10 | wa-checkin-scope | `45 11 * * 1` | Mon 07:45 | checkin-scope | 2 succeeded | 14 Sep 401, 21 Sep 500. Last success 24 Aug (now routed via llm; next run 28 Sep) |
| 11 | wa-drive-sync | `40 7 * * *` | daily 03:40 | drive-pull `sync` | 14 succeeded | 2 failed (13 and 14 Sep 401) |
| 12 | wa-health-check | `50 11 * * *` | daily 07:50 | health-check | 1 succeeded (new) | 200 |
| 13 | wa-calendar-sync | `5,35 * * * *` | every 30 min | calendar-sync `sync` | 68 succeeded | all 200 (since 24 Sep) |
| 14 | wa-mail-pull | `12,42 * * * *` | every 30 min | mail-pull `sync` | 61 succeeded | all 202; state table clean |
| 15 | wa-directory-sync | `20 10 * * *` | daily 06:20 | directory-sync `sync` | 1 succeeded (new) | 200 |
| 16 | wa-ai-calls-prune | `25 3 * * *` | daily 23:25 | SQL: delete `ai_calls` older than 90 days | 2 succeeded | not an edge call |
| 17 | wa-shoutouts | `10 11 * * *` | daily 07:10 | shoutouts `refresh` | 1 succeeded (new) | 200 |
| 18 | wa-social-pull | `20 6 * * *` | daily 02:20 | social-pull `sync` | 1 succeeded (new) | 200 |
| 19 | wa-social-note | `20 12 * * 1` | Mon 08:20 | social-pull `note` | not run yet | first run 28 Sep |
| 20 | wa-social-publish | `*/5 * * * *` | every 5 min | social-publish `run` | 185 succeeded | all 200 |
| 24 | wa-bank-resurface | `5 10 * * *` | daily 06:05 | SQL: `bank_resurface()` | not run yet | first run 26 Sep |

**Why the cron status is meaningless for edge jobs.** `call_edge(fn, payload)` runs `net.http_post` (10 s timeout) and returns the request id. The job "succeeds" when the request is queued. The HTTP result lands in `net._http_response`, which pg_net keeps for about 6 hours, and nothing reads it. Eight functions also answer 202 and keep working in the background (`EdgeRuntime.waitUntil`), so even the HTTP status says nothing about the outcome. Across the 14 days: 0 failures in `cron.job_run_details`, 38 non-2xx edge results on cron-driven functions, plus the silent failures in slack-pull, transcript-requests and checkin-scope.

**12 to 14 Sep incident.** PostgREST answered "Gateway Timeout" (db-backup: "decisions: Gateway Timeout"; daily-alerts: "secret SLACK_WEBHOOK_URL unavailable"). Every function's auth check calls `get_secret` over PostgREST, treats a failed lookup as "not authorised" and answers 401, so an infrastructure outage looked like an auth failure. No retries and no alert. Three nightly backups were lost.

**Jobs that point at legacy or broken targets.** Job 5 (clickup-pull: output unread, legacy). Job 3 (slack-pull: broken since 24 Aug). Job 7 (transcript-requests: model errors are swallowed, so a failed scan looks like an empty meeting). Job 10 (checkin-scope: failing since 24 Aug, possibly fixed by the 25 Sep router change; unconfirmed until 28 Sep). All 19 edge targets exist.

**Overlapping and questionable schedules.**
- Monday morning cluster: jobs 5, 3, 10, 1, 19, 9 and 2 run between 11:20 and 13:00 UTC. Four of them (clickup-pull, slack-pull, weekly-digest, daily-alerts) post to the same webhook channel within 100 minutes, and slack-digest posts to every department channel at the same minute as daily-alerts. [DECISION] one Monday digest.
- The same Slack check-in channels are read by three jobs: hours-pull (daily), checkin-scope (weekly) and slack-pull (weekly; one of its 13 sources is a check-in channel). Meanwhile the Hub's own check-in (`checkin-post`, `hub_checkins`) exists but holds 7 rows. [DECISION]
- Job 20 boots social-publish 288 times a day for a calendar with one entry. [DECISION] every 15 minutes, or guard the cron with an SQL `exists` check on due posts.
- Job 7 runs 12 times a day; one transcript arrived in 14 days. [OBVIOUS] guard with `where exists (unscanned transcript)` in SQL, or call it at the end of process-transcript.
- Jobs 6 and 17 share the 11:10 minute. Harmless.
- DST: every comment says "9am Toronto"; from 1 Nov the jobs run at 8am local. [DECISION] accept, or set times in the comments as UTC.

### Database triggers that call functions

| Table | Trigger | Fires on | Calls | Status |
|---|---|---|---|---|
| transcripts | trg_transcript_insert | every insert | process-transcript (direct `net.http_post`, hard-coded URL and anon key) | works; also fires for leadership meetings, which process-leadership then handles too |
| transcripts | trg_wa65_leadership | insert where department is like "leadership" | process-leadership (`call_edge`) | works |
| dept_requests | trg_wa89_request_filed | insert | notify `request_filed` (DM to assignee or leaders, after a 3 s sleep) | works |
| dept_requests | trg_wa123_request_new | insert | team-inbox `request_new` (post in team channel) | works; same event as above, two functions |
| dept_requests | trg_wa123_request_update | update of status, done, assignee | team-inbox `request_update` | works |
| request_notes | trg_wa123_note_new | insert | team-inbox `request_note` | works |
| hub_mail | trg_wa123_mail_filed | update to filed | team-inbox `mail_filed` | works |
| dept_tasks | trg_wa89_task_reassigned | owner change | notify | works |
| mentions | trg_wa89_mentioned | insert | notify | works (no mentions created since 19 Aug, see 0.1) |
| request_suggestions | trg_wa89_suggestion_accepted | pending to accepted | notify | works |
| team_members | trg_wa89_invited | insert, or reactivation | notify `invited` | works, but hub-invite also sends `invited`: 3 people got the welcome DM twice |
| onboarding_help | trg_onboarding_help | insert (front end "I need help" button) | notify, event `onboarding_help` | broken twice: no JWT (gateway 401) and notify has no such event |

---

## 3. Overlaps and repetition

### 3.1 Shared boilerplate
Across 14,944 lines: `getSecret` 51 copies, `CORS` and `json()` 48, the auth helper 46 (named `authorize`, `staffEmail`, `staff`, `caller`, `who`, `adminEmail`), `siteUrl` 9 plus the Netlify URL hard-coded in 19 functions, Google service-account signing (`b64url`, `pemToDer`, token exchange) 7, Slack user lookup (`users.list` or `lookupByEmail`) in 8, webhook posting in 13, bot `chat.postMessage` in 7, `EdgeRuntime.waitUntil` background runs in 8.
- [DECISION] One `_shared/` module (auth `who()`, secrets, CORS and json, Slack send, Google token, site URL, department list, llm call). `fn-deploy` currently uploads a single `index.ts`; the Management API accepts several files, so fn-deploy needs a small change first. Without that, a generated header block pasted by the build is the fallback.

### 3.2 Model calls
- [OBVIOUS] Route `slack-pull`, `transcript-requests`, `finance-import` and `hub-edit` through `llm` (same Anthropic body, add `x-wa-task`). They are the only users of `ANTHROPIC_API_KEY`; after the change that secret can be removed.
- [OBVIOUS] Delete the dead `MODELS` arrays in the 14 router callers. The router deletes the caller's `model` field (it only logs it as "wanted"), so each caller's loop over three Claude model ids does nothing useful.
- [DECISION] `ask` still carries its own fallback straight to OpenRouter (`openrouterCall`, three open models), which bypasses `ai_routes` and the `ai_calls` log. Keep it as a safety net, or remove it for one door.
- [OBVIOUS] Pick one way to name the job: the router accepts `x-wa-task` header or `task` in the body; the front end uses both. `team-inbox` borrows the `mail_triage` route for its own decision.
- Prompts live in 20 functions and in the front end bundle (captions, volunteering recap, photo labels, Brain suggestions). [DECISION] a short registry of which prompt lives where is enough; a prompts table is optional.

### 3.3 Slack posters and digests
17 functions post to Slack through three mechanisms (incoming webhook, bot `chat.postMessage`, DMs). Two functions each resolve Slack ids and send DMs (`notify`, `team-inbox`), and two name caches exist (`wa_slack_ids`, `wa_slack_names`).
- [DECISION] Make `notify` (or a renamed `slack-send`) the only Slack sender: channel post, thread reply, DM, opt-outs, id resolution. `team-inbox`, `checkin-post say`, `project-slack` and the digests call it.
- Digest family: `weekly-digest`, `daily-alerts` (69% identical lines) and `slack-digest` read the same tables. [DECISION] one `digest` function with modes (exec weekly, daily alerts, per team weekly).
- [OBVIOUS] Filters differ between posters: `slack-digest`, `project-slack` and `slack-command` exclude confidential, restricted and banked tasks; `weekly-digest` and `daily-alerts` exclude only `board_only`. No rows are affected today (0 open confidential, restricted or banked tasks), so this is latent. Use one filter.

### 3.4 Several pullers of the same source
- Slack check-in channels: `hours-pull`, `checkin-scope`, `slack-pull` (and `checkin-post` writes to them). [DECISION] one check-in job, or derive hours from `hub_checkins` once people use the Hub check-in.
- ClickUp: `clickup-pull` (legacy), `goal-sync`, `sop-import` (legacy), `attach-rehost` (legacy), each with its own API helper. [DECISION] if ClickUp is no longer the source of goals, `goal-sync` can go too.
- Quo: `quo-send`, `quo-pull`, `quo-sync` (legacy). [DECISION] one `quo` function with actions.
- Google (one service account, domain-wide delegation): `calendar-sync`, `directory-sync`, `drive-pull`, `hub-connect`, `hub-invite`, `mail-pull`, `social-pull` each sign their own token (drive-pull and calendar-sync share 52% of lines). [OBVIOUS once 3.1 exists] one Google token helper.

### 3.5 Goal functions
`goal-propose` (new goals for a department) and `goal-suggest` (missing tasks for one goal) share 72% of their lines and nearly the same names. `goal-sync` is a different job (ClickUp). [DECISION] merge the first two into one `goal-ai` with actions `propose` and `gaps`, or at least rename `goal-suggest` to say what it does.

### 3.6 Transcript functions
Four functions and up to seven model passes per meeting: `transcript-preview` (1 pass), `process-transcript` or `process-leadership` (1 pass each, 16% shared), `transcript-requests` (5 passes). `transcript-preview` shares 60% of its lines with `process-leadership`, and their department enums have drifted (see 5.3).
- [OBVIOUS] Add `WHEN (new.department not ilike '%leadership%')` to `trg_transcript_insert` so leadership meetings run one pipeline, not two. Confirm first that process-transcript does nothing for leadership meetings besides writing the failure note that process-leadership overwrites.
- [OBVIOUS] Remove mail-pull's direct call to process-transcript: it sends no JWT (the gateway rejects it) and the insert trigger already runs the pipeline.
- [DECISION] One transcript pipeline with modes (`preview`, `department`, `leadership`) and one shared context loader; `transcript-requests` becomes its enrich step, run on insert instead of every 2 hours.

### 3.7 Share links and small duplicates
- `agenda-share` and `inventory-share` solve the same problem (public token link). inventory-share has expiry and rate limiting; agenda-share has neither. [OBVIOUS] give agenda-share's public `add` the same rate limit; [DECISION] keep both features at all (neither has been used by outsiders since July).
- `suggest-reason` shares 61% with `recommend-decision`. [DECISION] fold it in as an action.
- `slack-digest` and `project-slack` share 53% (mention resolution). Covered by 3.3.

### 3.8 Hard-coded values that should have one home
- Department lists in 20 functions (14 miss `progdev`); the source of truth is `dept_meta` (7 rows). [OBVIOUS]
- "Who is admin" in four places: `hub_roles` and `is_hub_admin()`, `hub-edit` FOUNDERS list, `directory-sync` fallback list, the owner's personal Gmail accepted as staff in 18 functions. [OBVIOUS] use `is_hub_admin()` and `is_wa_staff()` only.
- The site URL in 19 functions and the project URL plus anon key in `call_edge` and `on_transcript_insert`. [OBVIOUS] read `app_config.site_url`; make `on_transcript_insert` use `call_edge`.
- The org phone number in `quo-pull` and `quo-send`, a ClickUp list id in `sop-import`, a Slack user id in comments. Low priority.

### 3.9 Run tracking
Six conventions: `hub_mail_state`, `hub_calendar_state`, `hub_directory_state`, `wa_health_checks`, `app_config` keys (`slack_last_pull`), and `change_log` rows (some functions log success only). [DECISION] one `job_runs` table (job, started, finished, ok, error, summary) written by every scheduled function, and `health-check` alerts when a job is failing or stale (for example slack-pull older than 8 days). A cheaper first step [OBVIOUS]: a cron job that copies non-2xx rows from `net._http_response` into a log table before pg_net deletes them.

---

## 4. Security

### 4.1 Open endpoints
No function is callable without some check, except by design: `site` (public HTML shell, legacy), `dashboard` (public redirect, legacy), `agenda-share` `get` and `add` (anyone with the link), `inventory-share` `list` and `save` (token, expiring, rate limited), `slack-command` (Slack signature). No function accepts a table name, column list or SQL from the caller with the service role: the only dynamic table name is `db-backup` `restore_check` (trigger secret only, regex-checked, returns counts), and `ask`'s PostgREST filters are built from keywords stripped to letters and digits.

### 4.2 Blocked people still pass the edge functions [OBVIOUS]
44 functions accept any JWT whose email ends in @welfareavenue.com and then use the service role, which bypasses RLS (some add admin or leader checks for a few actions, but the base gate is the domain). `is_wa_staff()` (used by RLS and by `photo-library`) returns false for role `blocked`; the edge functions never ask. 5 people are blocked and 2 of them still have auth accounts; nothing in the database stops a blocked person with an active Workspace account from signing in again with Google (no auth triggers or hooks exist). Fix: one shared `who()` like photo-library's (call `is_wa_staff` and `is_hub_admin` with the caller's JWT). Same result for everyone except blocked people. Also [DECISION, verify] confirm in Auth settings that email sign-ups are off or need confirmation; every function trusts the email domain alone.

### 4.3 Over-broad actions (reachable by any staff sign-in)
| Function and action | What it allows | Recommendation |
|---|---|---|
| mail-pull `probe` | Any Gmail search query on the whole hub@ mailbox; returns sender, recipients, subject and a snippet for up to 25 messages (the mailbox receives invoices and job applications) | [OBVIOUS] trigger secret or admin only |
| mail-pull `test`, `undo`, `refile` | Create fake filings; undo deletes the tasks, updates, candidates, decisions and transcript an email created | [OBVIOUS] leaders or admins |
| social-pull `disconnect` | Deletes a social account; `social_daily` and `social_posts` cascade (about 19,500 rows) | [OBVIOUS] admins |
| repo-sync (all actions) | Lists the token's repositories, reads files, pushes commits with a caller-chosen author name | [OBVIOUS] trigger secret only (the build never uses a staff JWT) |
| checkin-post `say` | Posts up to 3,000 characters as the Hub bot into any public channel (auto-joins) | [DECISION] leaders only, or a channel allowlist |
| notify `welcome_kit`, `test` | DMs arbitrary text as the Hub bot to any colleague | [DECISION] HR and admins |
| quo-send | Sends SMS from the Welfare phone to up to 200 people | [DECISION] leaders only |

### 4.4 One secret opens everything [DECISION]
`WA_TRIGGER_SECRET` is used by the database (every `call_edge`), function to function, and the build sandbox. With it a caller can run `fn-deploy` (which deploys any code with the owner's personal Supabase access token, valid for every project on that account), `repo-sync`, `host-sync` and `db-backup`. The secret is not in the repo (the build reads it from `/tmp`). Consider a separate build secret for fn-deploy, repo-sync and host-sync, and deploying from CI instead of storing a personal access token in the vault.

### 4.5 Two background-token risks [DECISION]
- `SLACK_USER_TOKEN` (used by `slack-pull` and `hours-pull`) reads one person's private DMs; slack-pull turns work items from them into transcripts visible to staff. It also stops working if that person leaves.
- `drive-pull` indexes 1,820 files (421 with text), including 13 board-named and 89 with names like salary, payroll, contract, confidential or budget. `wa_drive_docs` RLS lets any @welfareavenue.com account read all of it, and `ask` searches it with no board filter (its other blocks respect `board_only`). Unshare those folders from the service account or add a confidentiality flag.

### 4.6 Secret hygiene
- Hard-coded secret: `sop-import/index.ts` line 62 (live version 1) contains a shared volunteer password inside a regex. [OBVIOUS] rotate that password, retire the function. The saved copy is redacted.
- Code asks for three secrets that are not in the vault: `SLACK_SIGNING_SECRET` (slack-command never works), `SLACK_REVIEW_WEBHOOK_URL`, `SLACK_AGENDA_WEBHOOK_URL` (both fall back to the main webhook).
- [OBVIOUS] When `get_secret` fails, answer 503, not 401 (see the 12 to 14 Sep incident).
- `get_secret` and `call_edge` are SECURITY DEFINER and executable only by postgres and service_role. Good. Trigger functions are executable by PUBLIC, which is harmless (they cannot be called outside a trigger), but `sop_sync_all_events` is callable by anon via RPC (database audit scope).

---

## 5. Consistency for agents and developers

### 5.1 Naming
Verbs are mixed: `pull` (7 functions), `sync` (6, of which only `goal-sync` and `repo-sync` are two-way; `calendar-sync` and `directory-sync` are one-way pulls, `host-sync` is a deploy), `import` (`finance-import`, `sop-import`, and `import-images` with the verb first), `process-`, `suggest-`, `recommend-`, `build-`, `draft-` also verb first. Names that hide the job: `goal-suggest` vs `goal-propose`, `project-slack`, `hub-edit`, `site`, `dashboard`, `llm`. [DECISION] a `<domain>-<verb>` convention for new functions and a one-page catalogue for the rest (renaming live functions means changing cron, triggers and the front end).

### 5.2 How functions describe themselves
Headers vary from 3 lines (`slack-pull`) to 30 (`process-transcript`, mostly version history before the purpose). About 21 of 54 state their auth, about 22 list their actions, about 24 say what triggers them. No function states which tables it reads and writes or which Slack or email side effects it has. [OBVIOUS] one header template: Purpose; Triggered by; Auth; Actions (input and output); Reads; Writes; Side effects (Slack, email, SMS, GitHub); Secrets. Move version history to the bottom or to git. Only 5 of 118 tables have a table comment.

### 5.3 What the AI functions tell the model about the database
- `ask` gives the model no schema. It fills a fixed context from about 12 tables (transcripts, decisions, dept_tasks, banked projects, dept_requests, request_types, team_members, dept_meta, wa_drive_docs, hub_knowledge, board_circle) and says "Answer ONLY from the provided context". The database has 118 tables and 4 views; everything added since wave116 is invisible to the Brain: goals, active projects, the calendar (`hub_events`, `fund_events`), finance, volunteers and events, the training academy and SOPs, the board section, check-ins and hours, social analytics, recruitment, time off, the org chart, and `dept_updates`. Nothing in the prompt is stale; it is incomplete. [DECISION] add blocks for the most asked areas, or give the Brain read tools over a curated set of views.
- Every other AI function builds its own context the same way (no schema), each with its own department constant. Stale descriptions found:
  - Department enums without `progdev` in `process-leadership` (model enum and insert filter), `transcript-preview` (model enum, three places), `transcript-requests` (insert filter), `finance-import` (allocation enum), and label maps without it in `build-agenda`, `clickup-pull`, `daily-alerts`, `weekly-digest`, `project-slack`, `slack-command`, `slack-digest`, `slack-pull`, `hub-edit` (prompt text), and the area-to-department mapping in `recommend-decision`. [OBVIOUS] read the list from `dept_meta`.
  - Old department labels ("Ops and Program Dev Montreal", "Fundraising and Grants") in `build-agenda` and `slack-pull` prompts; the Hub now uses "Operations Montreal" and "Fundraising and Finances".
  - The router release note says nothing calls api.anthropic.com; four functions do. [OBVIOUS] correct the note when fixing 3.2.
  - 16 functions filter banked work (wave132); `weekly-digest` and `daily-alerts`, which post overdue tasks to Slack, do not.
  - `transcript_request_scans.n_found` only counts request suggestions, not the comments, due dates, goal wins and mentions the same scan writes, so it reads as "nothing found" when four passes did produce output. [OBVIOUS] store all five counts, or rename the column.
- All tables referenced in code exist in the database (no dangling references).

### 5.4 verify_jwt has no rule
22 functions have it off, 32 on, and the choice does not follow a pattern (for example `recommend-decision` off, `person-profile` on, both front-end only). Because the anon key is public, it adds little; it mainly breaks internal callers that forget the header (slack-command, the onboarding trigger, mail-pull). [DECISION] write the rule down (for example: on for everything the front end calls, off only for webhooks and build tools) and have every internal caller use one helper that sends the anon key and the secret.

### 5.5 Repo completeness
17 functions existed only live; their sources are now in `audit/fn_src/`. After committing them, the repo matches live one to one (54 of 54).

---

## 6. Suggested order of work

Safe now [OBVIOUS]:
1. Route slack-pull, transcript-requests, finance-import, hub-edit through `llm`. Stop transcript-requests marking a transcript scanned when a pass fails, then delete the scan row for the 25 Sep meeting so it runs again (and re-run the failed 25 Sep bank statement import).
2. Shared `who()` that honours `blocked`; tighten mail-pull `probe` `test` `undo` `refile`, social-pull `disconnect`, repo-sync.
3. Department list from `dept_meta` (fixes Program Development in leadership, preview and request suggestions).
4. Fix the internal calls: onboarding_help trigger (use `call_edge`, add the event to notify), slack-command to notify, remove mail-pull's direct call, stop the double welcome DM (drop either the trigger path or hub-invite's call).
5. Run visibility: copy non-2xx `net._http_response` rows to a log table; health-check reads job freshness; return 503 when a secret lookup fails.
6. Retire the legacy functions: import-images, dashboard, site, attach-rehost, sop-import (after rotating the password), quo-sync. Commit their sources first.
7. Delete dead `MODELS` arrays; one Slack filter for confidential, restricted and banked tasks; guard job 7 with an `exists` check; standard header on every function.

Needs the owner [DECISION]:
- clickup-pull and cron job 5 (does anyone read the Monday ClickUp line?), goal-sync (is ClickUp still the goal source?).
- slack-pull: fix or retire (it reads one person's DMs); hub-edit, slack-command, agenda-share, inventory-share: finish or retire.
- Merges: digests into one; goal-propose with goal-suggest; transcript pipeline; quo family; notify as the only Slack sender; suggest-reason into recommend-decision; check-in data sources.
- Shared module (needs fn-deploy to upload several files); a build-only secret; deploy from CI instead of a personal access token.
- Brain coverage of the newer Hub areas; Drive index confidentiality; who may use checkin-post `say`, notify welcome kit and quo-send; social-publish frequency.

---

## 7. Appendix: 14-day edge results for cron-driven functions

Non-2xx responses per day (UTC days starting 05:50). Blank means all calls succeeded or the job did not run that day.

| Function | 12 Sep | 13 Sep | 14 Sep | 15 to 20 Sep | 21 Sep | 22 to 25 Sep |
|---|---|---|---|---|---|---|
| daily-alerts | 500 | | 401 | | | |
| db-backup | 500 | 500 | 401 | | | |
| drive-pull | | 401 | 401 | | | |
| goal-sync | 401 | | 401 | | | 2 x 404 (manual, 24 Sep) |
| hours-pull | | 401 | | | | |
| transcript-requests | 8 x 401, 1 x 500 | 9 x 401, 1 x 500 | 3 x 401 | | | |
| weekly-digest | | | 500 | | | |
| slack-pull | | | 401 | | 202 then failed | |
| clickup-pull | | | 401 | | | |
| slack-digest | | | 401 | | | |
| checkin-scope | | | 401 | | 500 | |

Other evidence used above: `slack_last_pull` = 24 Aug; change_log last `slack_pull` and `checkin_scope` = 24 Aug; `finance_statements` one failed row with the credit error (25 Sep 03:20); transcript-requests outputs: last request suggestion 15 Aug, last mention 19 Aug, last AI task comment, due-date suggestion and goal win 24 Aug, nothing from the 25 Sep meeting scanned at 04:25; `ai_routes` has 18 tasks; vault holds 13 secrets (names only checked).
