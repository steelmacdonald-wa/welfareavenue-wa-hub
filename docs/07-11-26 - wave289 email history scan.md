# wave289: the email history scan (built 07/11/26, not released)

The first of three waves that bring Steel's mailbox and hub@ (info@ arrives there) back to April 2020 into the CRM (design "03 email history, interactions and insights" v2, section 11.3). This wave builds only the scan and its private holding area. **Nothing reaches the CRM**: no contact, organisation, timeline item or opt-out is written until wave292's batches, each on Steel's yes.

Built on branch `email-history-289`, from f70a406 (CRM slice 1 with its final fixes). Slice 1 is built but not released, and wave289 needs it: the file stops at the top without wave284. **Status: built, not released. No function is deployed, no Gmail mailbox was read, and the router was never called.**

## What it does

When an admin (or Claude, on Steel's yes) starts a run, the `mail-history` function:

1. **Lists** every email in each mailbox since 1 April 2020, leaving out spam, trash, chats and drafts, and saves its place after each page. Emails already imported, left alone or seen in an earlier run are marked done at once.
2. **Reads the headers only** and sorts each email by rule, without any model, in this order: Steel's personal never-read list (mybox's rule a); the rule-only personal filter (rule b: every outside address is free mail and the sender shares Steel's family name or the subject has a personal word); security mail; calendar mail; delivery reports (to the bounce parser); automated mail as mybox decides it (a List-Unsubscribe header together with a bulk sign, Google's notices, platforms, anything hub@ sent itself); list mail not addressed to the mailbox (a person writing through a Google Group to info@ is kept); internal mail (in the database). Everything else is kept with its direction, outside addresses, cleaned subject, thread, date and mailbox. A message with the DRAFT label is dropped.
3. **Dedupes** once both mailboxes are done: later copies of the same Message-ID are skipped (Steel's copy is kept), and every kept Message-ID is remembered (as an md5) so a later run skips it too.
4. **Parses bounces** without a model: a delivery-status part with Action failed and a 5.x.x status, or a report with exactly one address and 550 or 5.1.x. Anything else is ignored.
5. **Calibrates**: reads 50 random kept threads with the thread reader (the only spend before go, at most $0.25), works out the estimate for the whole run from their real cost, and waits.
6. After **go** (Steel's yes; the cap is 1.5 times the estimate, never above $60): reads each kept thread (one validated line per email, the topic, the language, the left-out call, asks-to-stop and signature fields), groups the people who wrote in, types each with one Jev decision, and looks up their organisations' homepages. Then it is done and waits for wave292.

It never labels, files, moves or sends mail and never posts anywhere. It keeps no body, snippet, quoted history, attachment, signature block or page text.

## The rule for Claude sessions

**Claude sessions never query `import_stage`** (wave284's rule, extended to the `mail_` tables). Read `wa289_status(run)` (counts only) or `crm_mail_scans`. The `people` and `exclude` actions never take the trigger secret, so personal data cannot reach a Claude conversation through `call_edge`.

## What it changes

**Database** (`build/data/wa289_scan.sql`, md5 `adc9a22969948a0244c33308412e9445`; needs wave284; changes no live function; safe to run twice):
1. `crm_import_runs.source` (`keela`, the default, or `email_history`).
2. `crm_mail_scans`: one row per run and mailbox (phase, page token, counts, oldest date, estimate, spend, cap, paused, who and when, the step lease, the last error as a step name and a code). Admins read it.
3. `crm_email_suppressions`: the table only (md5 of the address, kind, date, source), empty. wave292 fills and checks it; this wave only reads the `deleted` kind when grouping.
4. In `import_stage` (no grants at all): `mail_messages`, `mail_people`, `mail_orgs` (purged with the run) and `mail_seen`, `mail_left_alone` (kept across runs: hashes and ids only). No body, snippet or page-text column; every comment says so.
5. `ai_routes.provider` (jsonb) and four routes, each carrying `{"data_collection": "deny", "zdr": true}`: `mail_history_thread` (gpt-5-mini, then Haiku 4.5), `mail_history_type` (Jev), `mail_history_org` (gpt-5-mini, then Haiku 4.5), `mail_history_insight` (Haiku 4.5, then gpt-5-mini; used by wave292). The two wording routes copy the confidentiality rule (`system_add`) from `reel` when it has one.
6. The 18 settings of 11.2 under `mail_` (admins only): `mail_history_mailboxes`, `_since` 2020-04-01, `_cap_usd` 60, `_sample_cap_usd` 0.25, `_read_rate`, `_step_seconds` (100, lease 180), `_max_recipients` 5, `_personal_words`, `_platforms`, `_freemail`, `_type_unsure` 0.5, `_kind_min` 0.8, `_org_type_min` 0.6, `_org_cap`, `_org_map`, `_steel_open` false, `mail_insights_quiet_months` 12, `mail_history_clips`.
7. The `wa289_*` functions (37, every one for the service role only): runs, leases, phases, spend and cap (`wa289_new_run`, `_lease`, `_scan_set`, `_spend`, `_go`, `_set_cap`, `_pause`, `_active`, `_pump`, `_ready`, `_status`), the free phases (`_context`, `_stage_ids`, `_newest`, `_todo`, `_thread_rows`, `_save_headers`, `_dedupe`, `_save_bounce`, `_leave_alone`, `_sizes`), the paid phases (`_save_thread`, `_match`, `_group`, `_save_person`, `_orgs_todo`, `_save_org`), Look at them (`_people`, `_exclude`, `_is_steel`), and helpers. Every save refuses keys named body, text, snippet, html, payload or raw. `wa289_people` and `wa289_exclude` refuse people from Steel's mailbox to anyone but Steel (M3). `wa289_match` is a thin wrapper over wave284's `wa284_contact` that follows merged contacts (a loop stops it) and lists a signature phone match as phone only.
8. One release line in `change_log`. Start, go, cap, pause, resume and Leave out are logged with counts only.

**llm v1.7** (`fn/llm/index.ts`, md5 `b7ff78524523330ddbe49deac73d8ca1`): reads `ai_routes.provider` and, when a route has one, sends it as OpenRouter's `provider` field on chat and decide calls; the reply's `_wa.provider` shows it. A route without one sends nothing new. No other change.

**The shared rules** (`fn/_shared/mail_rules.ts`, md5 `a17cf835f38b48698fb9dea8de7f152b`): `NEVER_READ` and `neverRead`, mybox's bulk combination (`isBulk`), Google's notices, calendar, security, noise and info@ tests, `addressedToMailbox`, `freshPart`, `parseAddr`, `addrList`, `cleanSubject`, `normKey`, `probablyPersonal`, the delivery-report parsers, `validateRead`, `validateOrg`, `safeHost`, `robotsRefuses`. mybox and mail-pull keep their own copies until their next reviewed change moves them here.

**mail-history v1** (`fn/mail-history/index.ts`, md5 `996671b33f0abe71c1297d5f1827742f`; `scan.ts`, md5 `fcc59b104c96ab64c09fb8aea13d0819`; `meta.json` verify_jwt true). Actions, auth and side effects are in its header and in `docs/EDGE_FUNCTIONS.md`. `build/fn.py` refuses it: deploy through the Supabase connector with index.ts, scan.ts and mail_rules.ts in the files array.

## Proofs

- `node --test fn/_shared/mail_rules.test.ts`: 14 tests on invented mail (mybox's bulk rule, the Google Group fixture kept, addressing, cleaning, rule b, bounces, validation, `safeHost` on every private range and on ports).
- `node test/w289sql.mjs` (PGlite, slice 1 loaded): the migration twice with bodies, grants and comments compared, the assertions twice, the undo twice and its guards, the migration again, the stop without wave284, and the live check files offline. 22 runner checks plus the assertion script.
- `node --test test/w289scan.test.mjs`: 8 tests running the engine against invented Gmail responses, a fake router that fails on a marker only personal mail carries, fake DNS and HTTP, and PGlite: drafts dropped, personal mail never reaches the router, mailings add no one, outbound-only recipients counted not grouped, duplicates across mailboxes and against an earlier run, bounce parsing, asks-to-stop kept from a left-out thread and nothing else, a 429 retried on the same id, a refused page token restarting one day before the newest date, the sample under its cap and setting the estimate, the cap pausing the run, no paid call repeated after a restart, and robots, the DNS check and port 443 stopping a fetch with only the homepage fetched.
- Live, rolled back (`build/sql_rollback_test.py` at 52a03b8, slice 1's six files first): `wa289_scan.sql` plus `test/w289live.sql` gave ROLLBACK_OK; `wa289_scan.sql`, `wa289_undo.sql` and `test/w289live_undo.sql` gave ROLLBACK_OK. A read afterwards found nothing kept.

## Blocking checks before the scan may start

1. **The no-retention provider setting (M2).** After llm v1.7 is deployed, one test call on each `mail_history_*` route must show the provider setting sent and accepted (`_wa.provider` in the reply, and no provider error from OpenRouter), and each provider's no-retention terms must be recorded. OpenRouter's Anthropic-compatible endpoint and the Decisions API (Jev) have not yet been seen to accept the field; that is exactly what this check proves. Any route that fails does not ship, and the scan does not start.
2. **The confidentiality rule.** The design expected wave226's `system_add` on `reel`. Live (read 07/11/26) has no `system_add` on any route, so nothing is copied, and `wa289_ready()` reports "route mail_history_thread has no confidentiality rule (system_add)" (and the same for `mail_history_insight`). `start` refuses until both routes carry the rule. Steel (or a release step he approves) must put wave226's wording on those routes first.
3. **The privacy impact assessment** (design 6.1), signed by Steel and reviewed by the second person (H11), before the first `start`.

## Release steps (after slice 1 is released, each on Steel's yes)

1. Run `build/data/wa289_scan.sql` through the Supabase connector (a rolled-back run first with `build/sql_rollback_test.py`, which now passes). Check the objects exist and the advisor shows no ERROR.
2. Deploy llm v1.7 alone and run blocking check 1. Then deploy `mail-history` v1 (index.ts, scan.ts, mail_rules.ts) with verify_jwt on.
3. Settle blocking checks 2 and 3. Then `start` through `public.call_edge('mail-history', '{"action": "start", "label": "Email history 2020 to 2026"}')`. Read `status` for the counts by reason, hub@'s oldest email and the sample's estimate. Counts only reach Claude.
4. On Steel's yes to the estimate and cap: `go`. Watch the spend stay under the cap; the pump exists only while the run works.
5. Then wave292 (the batches) and wave293 (the profile and Insights).

## Undo

- **Stop a run:** `pause`, then set the scans to failed. The pump removes itself when no run is working.
- **The function:** delete `mail-history`; put llm back to v1.6 (it does not read `provider`).
- **The database:** `build/data/wa289_undo.sql` (md5 `0de685aa682bb6b84f6c6c1ed1a036f9`), after llm v1.6 is back. It refuses while a scan runs, while an email-history run has a batch, while `crm_email_suppressions` holds rows (opt-outs are never dropped) or while another route carries a provider setting. It removes the pump, the functions, the four routes, the settings that still hold wave289's value, `ai_routes.provider`, the email-history runs with their staging, the `mail_` tables, `crm_mail_scans`, `crm_email_suppressions` and `crm_import_runs.source`. wave289 changed no live function, so there is no live text to put back.

## Where the build differs from the design, and why

- **The confidentiality rule is not copied, and `start` refuses instead of the migration raising.** The design said the copy "raises if empty". On live it is empty, so a raise would have made the migration unreleasable; the refusal keeps the same protection at the point where a model would first be called.
- **The estimate includes the sample's spend.** Section 7 counts the sample in the run's total, and the cap is 1.5 times the estimate; without the sample in it, the cap could be reached before the paid phases begin.
- **The cap during the sample** is the sample cap ($0.25) on every scan row until go sets the real one.
- **Message-IDs reach the database raw for one call** and are stored only as their md5 (Deno's Web Crypto has no md5).
- **Look at them hides a person from anyone but Steel when any of their mail came from his mailbox**, and counts them as hidden; the design says rows for Steel's mailbox answer only Steel, and a person can have mail in both.
- **The pump** is turned on by `start`, `go` and `resume` and turns itself off when no run is working.
- **Homepage fetches resolve each host and check every answer before the request**, but Deno's `fetch` cannot be pinned to the checked address, so a host whose DNS changes between the check and the request is a residual risk (DNS rebinding). The fetch is GET only, https on port 443, with no cookies, at most 1 MB and 8 seconds.

## Files

- `build/data/wa289_scan.sql`, `build/data/wa289_undo.sql`
- `fn/_shared/mail_rules.ts`, `fn/_shared/mail_rules.test.ts`
- `fn/llm/index.ts` (v1.7)
- `fn/mail-history/index.ts`, `fn/mail-history/scan.ts`, `fn/mail-history/meta.json`
- `build/fn.py` (refuses functions that import `./mail_rules.ts` or `./scan.ts`)
- `test/w289schema.sql`, `test/w289sql.sql`, `test/w289sql.mjs`, `test/w289live.sql`, `test/w289live_undo.sql`, `test/w289scan.test.mjs`
- `docs/EDGE_FUNCTIONS.md` (mail-history, llm v1.7, the pump), `docs/DATA_MODEL.md` (regenerated)
