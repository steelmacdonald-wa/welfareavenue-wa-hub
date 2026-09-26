# Welfare Avenue Hub: edge functions

Every edge function, what it does, what runs it and who may call it. The source of each is in `fn/<name>/index.ts` with its `meta.json` (all 55 live functions are in the repo; slack-connect joined with wave138). Deploy with `python3 build/fn.py deploy <name>`. The detailed audit, with evidence and the open questions, is `docs/audit/fn_findings.md`.

Rules for a new or changed function:

- Every model call goes through the `llm` router with an `x-wa-task` header naming a route in `ai_routes` (Admin > AI models shows them). No function calls a model provider directly.
- Team lists come from `dept_meta` (code, label, sort); do not hard-code them.
- Say at the top of the file: what it does, what runs it, who may call it, its actions, the tables it reads and writes, and any Slack, email, SMS or GitHub side effect.
- A staff sign-in is not enough for anything destructive or outward-facing: check `is_hub_admin()`, `is_hub_leader()` or `wa_page_ok()` with the caller's token, as mail-pull and social-pull do.

| Function | What it does | Run by | Who may call it | Notes |
|---|---|---|---|---|
| `agenda-share` | Shareable agenda link: staff create, revoke and post it to Slack; anyone with the link reads that agenda and adds items | Front end agenda card (create_link, revoke_link, post_slack); public link page (get, add) | Public token for get and add (random, no expiry, no rate limit); staff for the rest (no gateway JWT check) | Status: unknown (keep and harden, or retire). |
| `ask` | Ask the Hub (the Brain): answers from a fixed context, proposes confirm-first actions | Front end chat | Staff; `board_circle` decides board access | Status: keep. |
| `attach-rehost` | One-off: copied ClickUp attachments into the sop-shots bucket | Nothing (manual, July) | Staff (no gateway JWT check) | Status: legacy. |
| `build-agenda` | AI agenda builder (department, 1:1, group, leaders) | Front end agenda card | Staff | Status: keep. |
| `calendar-sync` | Mirrors the hub@ Google Calendar into `hub_events` | Cron 13 (every 30 min) | Staff | Status: keep. |
| `checkin-post` | Check in and out to the check-in Slack channel, AI bullet summary, closes ticked tasks; also a generic `say` (post any text to any named channel as the bot) | Front end check-in, volunteering recap, content calendar | Staff (the secret may impersonate anyone via `as_email`) (no gateway JWT check) | Status: keep (move `say` out). |
| `checkin-scope` | Weekly AI scope of work per person from every check-in-out channel | Cron 10 (Mon); front end HR centre refresh | Staff | Status: merge candidate (check-in data). |
| `clickup-pull` | Weekly ClickUp snapshot per department into `clickup_weekly`, plus a Slack line | Cron 5 (Mon) | Staff (no gateway JWT check) | Status: legacy. |
| `daily-alerts` | Daily Slack alert: tasks just overdue or a week overdue, decisions open 14 or 30 days | Cron 2 (daily) | Staff (no gateway JWT check) | Status: merge candidate (digests). |
| `dashboard` | Old stable link that redirects to `app_config.site_url` | Nothing (only a fallback URL in two digests) | None, public redirect (no gateway JWT check) | Status: legacy. |
| `db-backup` | Nightly JSON export of every public table to the private `db-backups` bucket, 30-day retention | Cron 8 (daily) | Trigger secret only | Status: keep (add alerting). |
| `directory-sync` | Mirrors the Workspace directory: roster queue, deactivations, Google photos | Cron 15 (daily); front end People and access | Secret, or admin (hub_roles, plus a hard-coded fallback list) | Status: keep. |
| `draft-content` | Create page: AI drafts in the house style, review routing to Slack | Front end Create page | Staff (no gateway JWT check) | Status: keep. |
| `drive-pull` | Indexes Drive files the service account can see (and Google Doc text) into `wa_drive_docs` | Cron 11 (daily) | Staff | Status: keep. |
| `finance-import` | Bank statement (text or PDF) to categorised transactions via AI | Front end Finance | Staff | Through the llm router (route finance_import, Claude models for PDF statements) since 26/09/26; the 25 Sep statement needs uploading again. Status: keep. |
| `fn-deploy` | Build tool: list, get and deploy functions through the Management API with a personal access token from the vault | `build/fn.py` | Trigger secret only | Status: keep (build tool). |
| `goal-propose` | AI proposes quarterly goals for one department | Front end goals page | Staff | Status: merge candidate (with goal-suggest). |
| `goal-suggest` | AI gap analysis for one goal: missing tasks | Front end goals page | Staff | Status: merge candidate. |
| `goal-sync` | Two-way sync of goals and goal comments with ClickUp goal lists | Cron 6 (daily); front end status and comments | Staff (no gateway JWT check) | Status: keep (owner: is ClickUp still the goal source?). |
| `health-check` | Daily check of the model router and Jev; Slack alert on a state change | Cron 12 (daily) | Staff (no gateway JWT check) | Status: keep (extend to job freshness). |
| `host-sync` | Build tool: assembles `site_files` and deploys index.html and `_headers` to Netlify | `build/deploy_gate.py` through SQL `call_edge` | Trigger secret only | Status: keep (build tool). |
| `hours-pull` | Parses "in" and "out" lines in Slack check-in channels into weekly hours per member | Cron 4 (daily); front end manual run | Staff (no gateway JWT check) | Status: merge candidate (check-in data). |
| `hub-connect` | Per-person connections: Slack match, Google Calendar and Drive delegation, RSVP, recent Drive files | Front end Settings | Staff | Status: keep. |
| `hub-edit` | Admin "Edit with AI": instruction to a preview of content operations | Front end admin | Admin (hub_roles, plus a hard-coded founders list) | Through the llm router since 26/09/26. Status: owner decides: keep or retire. |
| `hub-invite` | People and access: invite (Gmail from hub@), bulk invite, sign-in link, set email, remove | Front end People and access | Admin or leader (role-aware) | Status: keep. |
| `import-images` | One-off: re-hosted department header images | Nothing (2 Jul) | Trigger secret only (no gateway JWT check) | Status: legacy. |
| `inventory-share` | Expiring, rate-limited volunteer inventory editor link | Front end (create, revoke); public editor page in storage | Staff for link admin; token for list and save | Status: unknown (keep, or revoke the link and retire). |
| `llm` | The model router: every AI job to OpenRouter per `ai_routes`; Jev decisions; `ai_calls` log; route admin | 21 functions; front end (AI models card, photo labels, volunteering recap, captions, Brain suggestions, Jev) | Service key, trigger secret or staff; admin for route edits | Status: keep. |
| `mail-pull` | Reads the hub@ inbox, classifies with AI, files invoices, meeting summaries, updates and job applications; undo, refile, test, probe | Cron 14 (every 30 min); front end Hub inbox | Staff for every action | Since 26/09/26 probe and test are for the pipeline and admins; undo and refile for leaders, admins and profiles with the Hub inbox. Status: keep. |
| `notify` | Slack notifications: DMs (opt-outs, Slack id cache) and channel posts; since wave138 the @mention DMs (`comment_mention`: as the writer with their own Slack token when they connected Slack, else from the bot with their name; a task description's mention waits 20 seconds in the background and quotes the text as it stands then) | DB triggers (5 through `wa_notify_call`, plus `on_onboarding_help`, plus `hub_mentions_dm`); front end (test, welcome kit, change requests); hub-invite; slack-command | Trigger secret for all events; staff JWT for 5 events | Status: keep (make it the one Slack sender). |
| `person-profile` | AI job description for one member from their tasks and SOP steps | Front end profile | Staff | Status: keep. |
| `photo-library` | Build tool: upload, check, remove photos under `content-images/photos` | Build sessions | Secret, or `is_wa_staff()` with the caller's JWT (role-aware); admin to remove (no gateway JWT check) | Status: keep (build tool). |
| `process-leadership` | Leadership meetings: AI extraction fanned out across departments | DB trigger `trg_wa65_leadership` (department like "leadership") | Staff | Program Development added to its team list (26/09/26). Status: keep. |
| `process-transcript` | Department meetings: updates, tasks (owner, project, due date, priority), closures, decisions, bank; Jev checks | DB trigger `trg_transcript_insert` (every insert); front end reprocess; mail-pull (direct call, see 3.6) | Staff | Status: keep. |
| `project-report` | AI narrative for a downloadable project report (nothing stored) | Front end project page | Staff JWT only | Status: keep. |
| `project-slack` | Posts a project summary with @mentions to a chosen channel | Front end project page | Staff | Status: keep (share the Slack helper). |
| `quo-pull` | Reads recent inbound SMS replies (Quo) from one event's roster | Front end event summary | Staff | Status: merge candidate (quo). |
| `quo-send` | Draft-and-confirm SMS to volunteers, with personal confirmation links | Front end volunteer texting | Staff (any staff, up to 200 recipients) | Status: merge candidate (quo). |
| `quo-sync` | One-off: linked volunteer records to Quo contacts by phone | Nothing | Staff | Status: legacy. |
| `recommend-decision` | AI recommendation for an executive decision, with Jev odds | Front end decision card | Staff (no gateway JWT check) | Status: keep. |
| `repo-sync` | Build tool: GitHub probe, tree, read blob, create blobs, commit, with the vault GitHub token | `build/repo_push.py`, `build/repo_pull.py` | Secret, or ANY staff JWT (no gateway JWT check) | Trigger secret only since 26/09/26 (a staff sign-in no longer reaches GitHub). Status: keep (build tool). |
| `shoutouts` | Daily AI shout-outs into `hub_shoutouts`; staff add and remove | Cron 17 (daily); front end HR centre | Secret or admin for refresh; staff for add | Status: keep. |
| `site` | Old host: served index.html from `site_files` for a Netlify proxy | Nothing (host-sync now deploys straight to Netlify; no `_redirects`) | None, public (no gateway JWT check) | Status: legacy. |
| `slack-command` | The `/hub` slash command (tasks, project, request) | Slack (external webhook) | Slack signing secret (HMAC v0, 5-minute window, constant-time compare) (no gateway JWT check) | Status: unknown (finish or retire). |
| `slack-connect` | Connects a person's own Slack account (OAuth, user scopes chat:write and im:write) so their @mentions reach people as a DM from them; status, start, disconnect; Slack's redirect lands here and sends the browser back to the Hub with ?slack=connected or error | Front end Settings, Connections (Send @mentions as you); Slack's OAuth redirect | Staff for status, start and disconnect; the redirect is checked by its signed state (HMAC with the trigger secret, 15 minutes) and the Slack account's email must be the person's own (no gateway JWT check) | User tokens live in the vault as `slack_user_token:<email>` (slack_link_save, slack_link_drop; service role only); `slack_links` records who connected. Added 26/09/26 (wave138). Status: keep. |
| `slack-digest` | Weekly per-department digest to each department's channel | Cron 9 (Mon) | Staff | Status: merge candidate (digests). |
| `slack-pull` | Reads Slack channels and the token owner's DMs; AI turns work items into per-department digest transcripts and team pulse scores | Cron 3 (Mon); front end manual run | Staff (no gateway JWT check) | Still calls Anthropic directly, so it fails; it reads one person's direct messages. Left as is until the owner decides. Status: owner decides: fix or retire. |
| `social-publish` | Content calendar publisher to Facebook and Instagram; confirms posts against analytics | Cron 20 (every 5 min); front end content calendar; social-pull | Secret, service key or staff (no gateway JWT check) | Status: keep (run less often). |
| `social-pull` | Marketing analytics: Meta, GA4, CSV imports, backfill, weekly AI note | Cron 18 (daily) and 19 (Mon); front end analytics | Staff; admin for some actions (no gateway JWT check) | Disconnecting an account (it deletes its analytics history) is for admins since 26/09/26. Status: keep. |
| `sop-import` | One-off: imported the Sunday Serving SOP from ClickUp | Nothing | Staff (no gateway JWT check) | Retired 26/09/26: answers 410. The old code held a shared volunteer password (rotate it). Status: retired. |
| `suggest-reason` | AI reason category and rationale for a decision or flagged task | Front end | Staff (no gateway JWT check) | Status: merge candidate (into recommend-decision). |
| `team-inbox` | Requests and filed mail to team channels, threaded updates, DMs on done and hand-over; Jev decides mail notices | DB triggers (dept_requests insert and update, request_notes insert, hub_mail update); front end settings | Trigger secret for events; staff or leaders for actions | Status: merge candidate (Slack delivery with notify). |
| `transcript-preview` | Dry run before upload: expected actions, nothing written | Front end upload | Staff | Program Development added to its team list (26/09/26). Status: keep. |
| `transcript-requests` | Every 2 hours: new transcripts to request suggestions, task comments, due dates, goal wins, mentions | Cron 7 (every 2 h) | Staff | Through the llm router since 26/09/26 (it had stopped on 24 Aug when the direct Anthropic account ran out of credit); a meeting whose every pass fails is retried on the next run. Status: keep. |
| `weekly-digest` | Monday executive summary to Slack | Cron 1 (Mon) | Staff (no gateway JWT check) | Status: merge candidate (digests). |

## Cron jobs (UTC)

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

Cron marks a job "succeeded" when the HTTP request is queued, not when the function worked; see `docs/audit/fn_findings.md` section 2 for the real results and the open fix (a job health log).

