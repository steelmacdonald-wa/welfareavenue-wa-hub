# wave280: the Loom pull fixed, and a watchdog that tells the admins (05/11/26)

## What happened

- On 26/10/26 at about 23:00 UTC (19:00 Toronto) Atlassian replaced the Loom tools on its MCP server. `listLoomVideos`, `listLoomVideosSharedWithMe` and `getLoomVideo` were gone. The server now offers:
  - `listLoomObjects`: takes a scope, a date range and an offset, answers 25 at a time, and says `hasNextPage` and `nextOffset`.
  - `getLoomObjectsContent`: takes ARIs or share links, never a bare id. The transcript comes as a component, `READY` or `UNAVAILABLE`, in pages with a `nextCursor`.
- loom-pull v4 looked for the old names. Its broad fallback picked `listLoomObjectFolders`, so every scheduled run failed with "The Loom tools are not on this MCP server": 344 runs up to 05/11/26.
- The recap-email path (mail-pull handing a Loom id over) failed too. No meeting since 26/10/26 became a Hub transcript, task or request.
- **Nobody was told.** `call_edge` sends a job's request and forgets it. pg_net keeps the answer for about six hours without saying which function it came from. loom-pull answers "started" before its run fails in the background. health-check only checked the AI models.

## What changed

1. **loom-pull v5** (`fn/loom-pull/index.ts`):
   - The new tools are picked by name first, and a folder tool never. The old names still work if they come back.
   - The list runs once for MINE and once for SHARED_WITH_ME (the two old lists), with `createdAtRange`, paging by `hasNextPage` and `nextOffset`. A page can be short or empty while more remain.
   - A transcript is read from its transcript component, page by page with `resume`. A line cut between pages runs on.
   - `UNAVAILABLE` is asked once more. If still unavailable, the recording waits, as an unfinished transcript always has.
   - Identifiers are the ARI from the list, or the share link, never the bare id.
2. **The watchdog** (`build/wa280a_watchdog.sql`, `fn/health-check/index.ts` v3):
   - `call_edge` notes which function each request went to (`wa_edge_calls`, kept two days). A failed note never stops a job.
   - `wa280_job_health()` reports three kinds of job:
     - The Loom pull: down when its last three finished runs all failed.
     - The Meet attendance sync: down when there has been no success for 13 hours.
     - Every function `call_edge` calls: down when its last three answers all failed (fewer answers for a job seldom called). A failure is a 5xx, a 401 or 403, or a 2xx that says `"ok": false`. Timeouts after `call_edge`'s 10 seconds don't count, because many jobs run longer.
   - health-check `jobs` runs every hour at :20 (cron `wa-job-watch`). The daily run at 11:50 checks the models and the jobs.
   - When a job stops working, each admin gets a Slack DM from the Hub bot, and the alert channel gets a post as before. While the job stays down, the DM comes again once a day; when it works again, one more DM.
   - Admins are `hub_roles` admin (Steel, Suhaib, Ian, Valex), or the comma list in `app_config.health_alert_to` when set. Every alert is logged in `change_log` (entity_type `health`).
   - Links go to hub.welfareavenue.com.

## Tests

- `test/w280_fn_test.ts`, 31/31. Runs against a mock of the new Atlassian server, with the folder tool listed first, as the real one does. Covers:
  - the tools picked
  - the scopes and date range
  - at most 25 a page
  - paging through an empty page
  - a three-page transcript cut mid-line
  - `UNAVAILABLE` then `READY`
  - a transcript never ready
  - no bare id
  - the probe
- `test/w280_health_test.ts`, 23/23. Covers:
  - down, quiet within the day, the daily reminder, back up
  - one DM per Slack account
  - an address with no Slack account
  - non-admins not told
  - `health_alert_to`
  - the daily run
  - the 401 for an unknown caller
- `test/w162_fn_test.ts`: 92 passed and 14 failed. That is the same result as on the released v4: the 14 come from wave258's transcript-length rule against that test's short sample transcripts, not from this change.
- `wa280_job_health()` was run against live data in a rolled-back transaction. It reported the Loom pull down since 26/10 23:00 UTC with the real error, the Meet sync within its 13 hours, a real 500 as down, normal answers as fine, and timeouts left out. Testing it caught two bugs, both fixed: a variable that clashed with a column name, and a regex repeat count above Postgres's 255.

Run the tests with `deno run -A --config <dir>/deno.json --node-modules-dir=auto test/<file>` (a `deno.json` with `{"nodeModulesDir": "auto"}`).

## Release (on Steel's yes)

1. Deploy loom-pull as a stub pinned to this branch's commit. Run a pull (`{action:'sync', why:'release'}`) and check `loom_pull_runs` and `loom_videos`.
2. Apply `build/wa280a_watchdog.sql`.
3. Deploy health-check as a stub pinned to the same commit. Run `{action:'jobs'}` and check `wa_health_checks`. No alert should go out when everything is fine.

## Undo

1. health-check: redeploy v2 (the source at 2b05b11, `fn/health-check/index.ts`).
2. `build/wa280a_undo.sql`: puts back `call_edge`, drops the watchdog function, the call log and the cron job.
3. loom-pull: redeploy v4 (the source at 2b05b11). The pull then fails again, as before.
