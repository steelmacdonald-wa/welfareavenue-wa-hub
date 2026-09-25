# 25/09/26 - waves 116n to 116t: the model router and Jev, HR centre, adoption, tasks

Shipped on 25/09/26 on top of wave117 (the brand feel, from Steel's other session). Live at the end of the day: `160dce6bd6b0990de12ccbc5b500d910` (2,262,868 bytes). Repo: steelmacdonald-wa/welfareavenue-wa-hub, commits f1bdef5, c1614ba, plus the pushes 55013931, 43c22f1c, f464b201.

## What Steel asked for

- "I want all to use OpenRouter using the right model for the right task; Sonnet, Qwen, Kimi, GPT, whatever you suggest. Jev ID: ~typesafe/jev-latest, it helps with making decisions on things, this should be used alongside other models."
- "Any requests I file through Ask the Hub should let me make some edits and give me suggestions."
- "Make the did-you-knows give shout-outs to individuals for completing projects or doing something amazing."
- "The HR centre really needs a revamp: Apple kind of branding, easy to use, big, the robustness of ClickUp, use photos from the database."
- "Hub at Welfare Avenue used for job application emails; add them to the Recruitment tab."
- "Start dates based on everyone's Google account."
- "Check in should post to #check-in-out-wa; check out with bullet points; voice to text; the AI suggests closing tasks."
- "Last 3 times each member logged in; an adoption board in admin settings: AI usage from OpenRouter, time on the hub, tasks closed, daily, weekly, monthly."
- Ahmed: "Task hierarchy like ClickUp; formatting in descriptions; attaching files and pictures."
- "I only see one person online with two accounts."

## The model router (`llm` v1.4)

Every AI job in the hub now goes through one edge function, `llm`, to OpenRouter's Anthropic-compatible endpoint (`POST https://openrouter.ai/api/v1/messages`). Callers send the same Anthropic Messages body they always did plus `x-wa-task` (the job) and `x-wa-caller` (the function); the router answers in Anthropic format, so callers still parse `content` blocks. Nothing talks to api.anthropic.com any more.

- `ai_routes` (table): one row per job with `chain` (model ids; first is primary, the rest are fallbacks, up to three passed to OpenRouter as `fallbacks`), `mode` (`chain` or `jev`), `jev` (whether the job also runs Jev checks), notes. Seeded jobs: brain, brain_suggest, transcript_extract, transcript_preview, leadership, mail_triage, mail_recruit, decision, reason, draft, goals, profile, digest, checkin, shoutout, decide, default.
- Jev picks (`mode = jev`, used by brain, draft, transcript_extract, leadership, goals, decision, default): the router sends Jev (`~typesafe/jev-latest`, the Decisions API, `POST /api/alpha/decisions`) the job, an excerpt of the request, its size, tools and each candidate's price, and asks which model should handle it, "the cheapest that will do it well". A simple lookup goes to GPT-5 mini (99%), a funder note goes to Sonnet (88%). A Jev pick costs about a hundredth of a cent.
- Reasoning models (GPT-5, Kimi, Gemini, Qwen) get `reasoning: {effort: 'low'}` and 4,096 extra output tokens so the answer is not eaten by thinking; a cut-off or empty tool call counts as a failure and the next model takes over.
- `ai_calls` (table, 90-day prune): every call with task, caller, requested and actual model, ok, ms, tokens, cost (OpenRouter's `usage.cost`), `via` (chain, jev, test). `ai_usage(days)` aggregates per task.
- Admin actions (staff sign-in): `routes`, `models` (OpenRouter's catalogue, curated vendors), `set_route`, `delete_route`, `test` (optional `model`).
- health-check v2 watches the router (Sonnet and Haiku through OpenRouter) and Jev; the old direct Anthropic and OpenRouter rows were retired.

Routed callers (build/route_patch.py rewrote the fetch, nothing else): ask (brain), process-transcript (transcript_extract), process-leadership (leadership), transcript-preview, suggest-reason (reason), recommend-decision (decision), draft-content, build-agenda and project-report (draft), goal-suggest and goal-propose (goals), person-profile (profile), checkin-scope (checkin), mail-pull (mail_triage). weekly-digest, daily-alerts and slack-digest do not call a model.

Jev alongside the generators:

- process-transcript v9 `jevCheck`: for every extracted task, Jev reads the transcript lines that mention it and answers "is this a real commitment", "is the owner right" (with a choice among the people mentioned), "is the due date stated". Under 30% real: dropped; wrong owner with a confident pick: corrected; unsupported due date: cleared. New decisions and task closures get the same treatment. The Slack summary ends with ":mag: Jev checked N items: ...".
- mail-pull v7 `jevMail`: Jev reads the same email and says whether the proposed kind and team are right. Strong disagreement sends it to the Hub inbox for a person instead of filing it wrongly; a confident team fills a missing one.
- recommend-decision v5 `jevScore`: "Jev's odds: the recommended approach 95%, alternative A 0%, alternative B 5%" under every recommendation.

## Build tools

- `fn-deploy` (edge function) + `build/fn.py`: `get <name>` pulls a deployed function's source out of its eszip bundle, `deploy <name>` pushes `fn/<name>/index.ts` through the Management API with the vault `SUPABASE_ACCESS_TOKEN`. No more pasting source by hand. `deploy-all a b c`.
- `repo-sync` v3 (`tree`, `get`) + `build/repo_pull.py`: compares GitHub's tree with the workspace and pulls what another session shipped (that is how wave117 came in). Report first, `--apply <prefix>...` to write.
- `build/llm_test.sh <task> [body.json]`: one router call from the build box.

## Google, Slack and the vault

- Delegated scopes verified with `directory-sync {action: probe}`: admin.directory.user, admin.directory.group.member, admin.directory.group.readonly, drive, calendar.events, gmail.send, admin.datatransfer all granted (onboarding and offboarding can be built).
- Slack app (`hub-connect {action: slack_scopes}`): everything needed except `users:read.email`; Steel to add it and reinstall (it is also what lets the hub match a person's email to their Slack account).
- Start dates: `team_members.start_date` / `start_source` filled from the Workspace account creation date on every directory sync (34 of 44 active people on the first pass); HR can overwrite (source `manual`) from the HR centre.

## The waves

- `116n_wave116n` Admin > AI models: every job, its models, who picks, 7/30-day calls and cost, Test, Edit (ordered list with the OpenRouter catalogue), last 40 calls.
- `116o_wave116o` Ask the Hub: the confirmation card is a form (task: title, team, owner, due, project, priority, details; request: title, team, type, for, details; a note for close_task; a status for set_request_status). Chips: people on the team whose responsibilities match the words, matching projects, quick dates, then the model's own suggestions (router task brain_suggest) and tips. Confirm sends what is on the form. `ask` v11 takes `project_id` and `priority`, knows Program Development, and tags calls with who asked (`x-wa-caller: ask:<email>`).
- `116q_wave116q` Check in and out: checking in posts to #check-in-out-wa (`checkin-post` v1, bot chat.postMessage, joins the channel if needed). Checking out opens a sheet: talk (Web Speech API, Chrome, Edge, Safari) or type, "Make it bullets" (router task checkin) returns 2 to 6 bullets and the open tasks the words show are finished; edit, tick, "Check out and post" closes them and posts hours plus bullets. wave116j exposes `window.w116jCk` for this.
- `116p_wave116p` HR centre: hero with the numbers, big pill tabs, a People tab (photos, role, team, started and tenure, hours this month, open tasks, profile button, team filter, search), shout-outs block with posting, Recruitment: applications (hub_candidates: stage, handled by, position, CV via signed URL, notes), restyled older dashboards. The loading screen takes over wave117's fact rotation and mixes in shout-outs from localStorage (`wa116s`) once the hub has loaded them.
- `116r_wave116r` Adoption: `hub_visits` written at boot (once per six hours per browser); Admin > Adoption reads `hub_adoption()`: today / 7 / 30 days (people, visits, hours, tasks closed and opened, AI calls and cost, Jev calls, questions, transcripts, emails filed, shout-outs), 30-day bars per measure, the people table with the last three sign-ins (visits, else `auth.sessions`), last active, visits, hours, tasks closed, questions.
- `116t_wave116t` Tasks: `parent_task_id` subtasks (drawer list with tick and add, breadcrumb Team > Project > Parent, indented rows with "subtask of", parents with "n/m subtasks"), `description` (light Markdown, toolbar, preview, Ctrl+B/I/Enter), attachments (`task_files` + private bucket `task-files`, drop, pick, paste, thumbnails, signed links), and a Tree view on every team task page (Team > Projects > sub-projects > tasks > subtasks, collapsible, show done).
- `wa116u`: `user_state` was readable own-row only, so presence never showed anyone else; staff, admins and board can now read everyone's `last_seen_at`.

## Backend

- Edge functions: llm v1.4 (new), fn-deploy v1.1 (new), checkin-post v1 (new), shoutouts v2 (new; cron `wa-shoutouts` 07:10 Toronto), health-check v2, ask v11, process-transcript v9, mail-pull v7 (application kind, `fileApplication`, label Hub/Recruitment, `jevMail`), recommend-decision v5, directory-sync v1.3 (probe, start dates), hub-connect v4 (slack_scopes), repo-sync v3, plus the 10 routed functions.
- Migrations: wa116n_ai_routes (+ jev mode), wa116o_hub_candidates, wa116p_start_dates, wa116q_checkins_slack_summary, wa116s_shoutouts, wa116r_visits_and_adoption (+ questions per person), wa116t_task_hierarchy_descriptions_files, wa116u_presence_visible_to_staff.
- Cron: wa-ai-calls-prune 03:25 UTC, wa-shoutouts 11:10 UTC.

## Tests

- `test/w116ndrive.js` (AI models card, editable proposal, check in and out), `test/w116pdrive.js` (HR centre, adoption), `test/w116tdrive.js` (drawer sections, subtasks, description toolbar, tree). Harness: 33 pages x 3 identities, only the expected `ERR_FAILED` resource loads (fonts and brand images the harness aborts).

## Follow-ups

- Slack: add `users:read.email` and reinstall; then the check-in posts @-mention people and Settings matches accounts by email.
- Onboarding and offboarding through the hub (create the Workspace account, add to groups and shared drives, calendar series, the Slack invite link, welcome email; mirror on leaving): scopes are all in place, the Slack invite link is still to come from Steel.
- Shout-outs: add "give a shout-out to X for ..." to Ask the Hub; consider posting the morning lines to Slack.
- Adoption: `hub_visits` starts 25/09, so the sign-in history is thin for a couple of weeks.
- Subtasks on the classic department page (renderSection) are not indented yet; the boards and the drawer are.
- Anthropic credit no longer matters; keep OpenRouter topped up (https://openrouter.ai/settings/credits).
