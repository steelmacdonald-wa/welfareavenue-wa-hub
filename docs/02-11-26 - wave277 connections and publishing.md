# 02/11/26 - wave277: Connections, one registry of platforms, and the Studio's publishing

Steel (02/11/26): one place to see every account the Hub posts to and whether it still works; LinkedIn posts with photos and video; the limits of each platform known in one place instead of scattered through the composer; and the people who approve posts chosen from the marketing team, not named in the code. This wave is built and tested on branch `wave277-connections`. Some of it is live already (the database registry and two functions); the Hub page, the notify function and the Academy copy wait for Steel's go. See "Live state today".

## What changed and why

**The registry.** `studio_platforms` (`build/data/wa277_connections.sql`) is the single list of platforms the Studio publishes to: key, label, short label, colour, sort, how it connects (`oauth` or `meta_token`), console link and note, setup steps, capabilities (`caps`: image and video limits, caption length and so on), the scopes it asks for, its publish modes, and whether it is active. Before, each of these lived in a different file and a new platform meant edits in five places. `content_slots` and `social_comments` now point at the registry with a foreign key instead of a CHECK list (`social_accounts` keeps its CHECK because it also holds `ga4` for analytics, which is not a publishing platform). The seed uses `on conflict (key) do nothing`, so an admin's edit survives; a change of value later ships as an explicit update in its own migration.

**The shared platform module.** `fn/_shared/platforms.ts` reads the registry for the functions (cached, with a fallback when the registry cannot be read). `fn/social-connect` and `fn/social-publish` import it.

**social-connect v3.** Each platform has an adapter for connecting, refreshing and checking. It computes a health for every OAuth connection (`ok`, `expiring`, `failed`), renews tokens weekly, and tells `notify` when a connection is within seven days of expiring. LinkedIn now asks for six scopes (the app holds all six, checked on its Auth tab on 02/11/26). TikTok's expiry is taken from `refresh_expires_in`: the access token lives one day, so the refresh token is the real expiry, and a warning on TikTok can come late rather than early. Meta (Instagram and Facebook) reads granted or missing rather than a health.

**social-publish v6.** Adapters per platform, with limits read from the registry. LinkedIn publishes photos (up to its limit) and video. A LinkedIn video can take longer than a request allows: the adapter polls at most twice (about 10 seconds), then the post goes into the pending pipeline like Instagram and Threads, `finishPending` posts it once LinkedIn reports it AVAILABLE, fails it on PROCESSING_FAILED, and fails it after 30 minutes. So a slow LinkedIn video can go out up to five minutes after its slot, and it is never announced as published before it is. The Make fallback: when a post has more photos than the platform allows, Make now sends a reminder instead of posting one photo (Make was never configured, and a reminder is safer than a silent partial post).

**notify v19.** A new event, `connection_expiring`, sends the warning to the people who publish, as a Hub notification and a Slack message, with a link to the Connections page. `build/data/wa277_release.sql` adds its row to `hub_notification_kinds` so each person has a Hub and a Slack switch for it and Send me a sample works. `test/w277notify.test.mjs` covers the event.

**The Connections page.** `build/parts277` (segment `277_wave277`, placed after 225 and before 110) replaces wave225's Connections section with one list from the registry: a health pill, capability chips and one action per row, an attention strip for what expires or fails, a disclosure per row with scopes asked against scopes granted, the keys and the console link, the Make hook under LinkedIn (Advanced), and the Hub's own modal in place of confirm and prompt. wave225 hands over through three hooks (paint, connAct, loadConn); wave250's Meta live and WhatsApp cards stay. When the registry cannot be read, the page builds its list from wave225's own platform table, with no capability chips and a quiet note. Address: `#studio/connections`.

**The composer.** `build/parts277/patch121.py` patches the wave121 segment so the composer takes its limits (images, video length, caption length) and the platforms it offers from the registry.

**The approvers.** `build/parts225/e_approvals.js` gains a picker on the Approvals page: the approvers are chosen from the marketing team, not fixed as Ian and KK. The Academy lesson `lesson:studio` is reworded to match (see the release SQL).

## Where each piece lives

| Piece | Where |
|---|---|
| Registry, FKs, `wa277_publishers()` | `build/data/wa277_connections.sql` |
| Release SQL (notify kind, Academy copy, log line) | `build/data/wa277_release.sql` |
| Shared platform module and its test | `fn/_shared/platforms.ts`, `platforms.test.ts` |
| Connect, health, renewal | `fn/social-connect/` (`index.ts`, `health.ts`, `adapters/`) |
| Publish | `fn/social-publish/` (`index.ts`, `capabilities.ts`, `adapters/`) |
| Expiry warning | `fn/notify/index.ts` (v19), `test/w277notify.test.mjs` |
| Connections page | `build/parts277/`, segment `build/src/277_wave277.seg`, MANIFEST entry `277_wave277` |
| Composer | `build/parts277/patch121.py` into `build/src/121_wave121.seg` |
| Approvers picker | `build/parts225/e_approvals.js` |
| Drives | `test/w277drive.js` (48), `test/w225drive.js` (48), `test/w241drive.js` (15) |
| The record of decisions | `.superpowers/sdd/2026-11-02-wave277-connections/progress.md` |

A function that imports `./platforms.ts` has a companion file, so `fn.py` and fn-deploy (which send one file) cannot deploy it: `fn.py` refuses and prints the connector instruction. Deploy these functions through the Supabase connector with the `files` array. Extending fn-deploy to carry files is deferred.

## Live state today

- Database: `wa277_connections.sql` is applied (the registry, the FKs, `wa277_publishers()`).
- `social-connect`: live, platform version 6 (the repo's v3).
- `social-publish`: live, platform version 15 (the repo's v6).
- Not yet live: `notify` v19 (live notify is a two-line stub that imports GitHub commit 3ca456bc; its one `RELAY_URL` difference is folded into the repo file), the `connection_expiring` row in `hub_notification_kinds`, the Academy copy, and the Hub page itself (`build/candidate.html` is not in `site_files`). Until notify ships, no expiry warning goes to Slack or the Hub; social-connect tolerates a notify failure and the Connections page shows the expiry itself.

## Release steps left, in order (each waits for Steel's approval)

1. Push the branch `wave277-connections`.
2. Fetch `build/candidate.html` at the release commit into `site_files` by pinned commit sha with `extensions.http_get`, check the status and `md5(content)`, as `claude/01-11-26 - Publishing workspace setup.md` (line 49) describes; for a multi-megabyte file, in ranges, never in one call. Then run `select public.wa_tmp_call_edge_long('host-sync', '{}'::jsonb);`. Confirm `hub.welfareavenue.com/#studio/connections` shows the new page signed in as Steel and the md5 matches.
3. Deploy `notify` v19 through the Supabase connector with files `index.ts` only and `verify_jwt` true.
4. Apply `build/data/wa277_release.sql` (the notify kind first, then the Academy copy, then the log line). Its select shows `still_names_ian_and_kk` false.
5. Steel reconnects LinkedIn once on the Connections page for the new scopes. Check `select value->'linkedin' from hub_settings where key='studio_connections'`: `scopes_granted` has six entries and `health` is `ok`. Then a two-photo post from the Hub to the Page.

## Undo

- Database: drop `content_slots_platform_fk` and `social_comments_platform_fk`, and put back the CHECKs on `platform` with the six keys (instagram, facebook, threads, linkedin, tiktok, youtube). The registry table can stay.
- The page and composer: remove `277_wave277` from `build/src/MANIFEST.txt`; revert the composer with `git checkout 900ac71^ -- build/src/121_wave121.seg`; revert the picker with `git checkout 9d7bc6b^ -- build/parts225/e_approvals.js`; assemble and run the same pipeline with the earlier `build/candidate.html`.
- Functions: redeploy `social-connect` at commit 70ec7e7 (v2.1) and `social-publish` v5 at commit eb53b61 (the wave242 commit that held v5; `fn/social-publish` is identical at the commit before wave277), both through the connector, no companion file.
- Notify: if v19 was deployed, redeploy the previous stub; remove the kind with `delete from public.hub_notification_kinds where key = 'connection_expiring';`.
- Academy: the two `replace` calls can be reversed by replacing the new phrases with the old ones ('the approvers set on the Approvals page' back to 'the named approvers (Ian and KK)', and 'how it goes to the approvers' back to 'how it goes to Ian and KK for approval').

## Tests

On Windows set `WA_CHROME` to `C:/Users/iolui/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe` and `NODE_PATH` to `C:/Users/iolui/Welfare Avenue Hub & Web/hub-repo/test/node_modules`, and `CAND=build/candidate.html`. Assemble first: `python build/parts277/assemble.py && python build/parts225/assemble.py && node build/assemble_all.js`. Results on 02/11/26 at the release commit:

- `node test/w277drive.js`: 48 passed, 0 failed.
- `node test/w241drive.js`: 15 passed, 0 failed.
- `node test/w243drive.js`: 18 passed, 0 failed.
- `node test/w225drive.js`: 48 passed, 0 failed.
- `node test/tour1.js all`: 56 tours ran. tour1 hardcodes a Linux chrome path, so it ran with a preload that sets `executablePath` from `WA_CHROME` (`node -r <preload> test/tour1.js all`); it then exits 1 only because `test/shots_p122/` does not exist in this worktree. The studio and contentstudio tours complete. Tour step counts drift between runs of the same build (timing), so read them as a smoke test.
- `npx --yes deno@2 test --allow-env fn/_shared/ fn/social-connect/ fn/social-publish/`: 24 passed, 0 failed.
- `node --test test/w277notify.test.mjs`: 3 passed, 0 failed.

## Deferred minors

- The three trailing caps updates in the registry SQL are unconditional; `updated_at` has no trigger; the RPC returns inactive rows and callers filter.
- No in-flight dedup on cold concurrent registry reads; `fn.py`'s guard matches single-quoted imports only.
- `warned_at` is not cleared on reconnect; no tests for the Threads, YouTube and TikTok adapters or for `check` and warn; the concurrent TikTok refresh race is unchanged.
- Video download without a status check; untested midway failure, PROCESSING_FAILED, missing ETag and empty title; when the registry is down on a cold start, `capabilities` returns no platforms.
- Notify tests do not cover the 12 cap or tag dedupe; check the notification centre draws a one-kind group at release.
- Connections page: no busy guard on save keys, Make hook, Make sample and reminder preview; Disconnect and Open console sit in the disclosure, not an overflow; the Meta row's chips come from the first Meta platform; the masthead line is patched after paint.
- Composer: wave225 keeps its own literal platform order for goals, the queue sort and the spend table; a saved post on a platform that later turns inactive loses its preview and variant tabs.
- Approvers: a stored approver outside the marketing list is dropped on the next picker save; no drive assertion for all unticked.
