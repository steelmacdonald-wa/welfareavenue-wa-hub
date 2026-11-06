# wave291: the opted-out check, fast (built 06/11/26, not released)

Steel asked for this on 06/11/26, after the wave281 timing run. Built and tested on 06/11/26. **Not released**: nothing has been applied to the live database and no function has been deployed. It goes live only on Steel's yes. It can go before or after wave281 (target Tue 10 Nov 2026).

## What changes for staff

Nothing visible. The text schedule, Find volunteers and the other text queues give exactly the same answers, faster. There is no page change and no function change.

## What was slow

`wa171_opted_out(person, phone)` asks one question: is a live contact with this volunteer, or with this number, marked no texts? The text queues ask it once for each person, so it runs in loops. Twelve live functions call it (`wa171_queue_confirms`, `wa172_queue_signups`, `wa191_recruit_send`, `wa239_pool_send`, `wa257_assign` and others).

1. **Today's text.** Its query starts with `c.sms_opt_out and c.merged_into is null`, but no index on `crm_contacts` matches that. The plan was `Seq Scan on crm_contacts c`, Filter `(sms_opt_out AND (merged_into IS NULL) AND ((volunteer_id = $1) OR EXISTS(SubPlan 1)))`. Every call read all 1,814 contacts (306 pages) to find the people marked no texts, and today nobody is. Over 1,805 contacts: 1,122 ms in our run (1,237 ms in wave281's).
2. **wave281's text** adds a check against `wa_stopped_phones_v`. That view works out the number (`wa171_digits`) of every STOP and START text on each call: `Index Scan using quo_messages_wa281_keyword_idx`, Filter `(wa171_digits(phone) = wa171_digits($2))`. Over 1,805 contacts: 1,427 ms.

## The fix

Two partial indexes. No function, view, table, column, grant or row changes.

1. **`crm_contacts_wa291_opted_out_idx`**, on `crm_contacts (id) where sms_opt_out and merged_into is null`: only the live contacts marked no texts. Each call now reads that short list (none today) instead of every contact: `Index Scan using crm_contacts_wa291_opted_out_idx on crm_contacts c`. This is the fix under today's text and under wave281's.
2. **`quo_messages_wa291_stop_digits_idx`**, on `quo_messages (wa171_digits(phone)) where direction = 'in' and handled in ('opted_out', 'opted_in')`: the STOP and START texts by their number. Under wave281's text the stopped-phones check looks one number up instead of working out every keyword text: `Index Scan using quo_messages_wa291_stop_digits_idx`, Index Cond `((wa171_digits(phone) IS NOT NULL) AND (wa171_digits(phone) = wa171_digits($2)))`. Under today's text nothing reads it yet.

Why no function change: wave281 replaces a line of `wa171_opted_out`'s live text, so a wave291 change to that text would break wave281's anchor or be overwritten by it. The planner picks these indexes for the same text, today's or wave281's, so the two waves can go live in either order. wave281's undo puts the function back and drops its own view and indexes; it leaves these two alone.

Each index has a COMMENT: what it holds, that Postgres keeps it and nobody writes it, and who reads it. The migration adds a release line to change_log.

## Files

- `build/data/wa291_optout_speed.sql`: the migration. Safe to run twice; it stops if an index of either name exists with another definition.
- `build/data/wa291_undo.sql`: the undo. It drops the two indexes, which puts live back exactly.
- Tests: `test/w291schema.sql`, `test/w291sql.mjs` (offline), and `test/w291live_before.sql`, `test/w291live_time.sql`, `test/w291live.sql`, `test/w291live_marked.sql`, `test/w291live_undo.sql`, `test/w291live_report.sql` (live checks that always roll back).
- `test/w291_w281text.sql` and `test/w291_w281undo.sql`: wave281's text for `wa171_opted_out` (its view, its two keyword indexes, its patch, its grants and comment) and wave281's undo of the function, copied unchanged from `build/data/wa281_rules.sql` and `build/data/wa281_undo.sql` on crm-slice1-280-284 (b489858). Test only, never a migration.
- `build/sql_rollback_test.py` and the PGlite line in `test/package.json` and `test/package-lock.json`, copied unchanged from crm-slice1-280-284 (this branch starts from main, which does not have them yet).
- `docs/DATA_MODEL.md` regenerated.

## Checks so far

- **Offline:** `node test/w291sql.mjs` passes (106 checks; PGlite needs `npm ci --prefix test`). The fixture holds the live text of `wa171_opted_out` and `wa171_digits`, checked against the live md5 of each, and 2,000 invented contacts (20 marked no texts, 22 merged, numbers in six spellings, shared numbers, STOP and START texts on the ops line and a STOP on WhatsApp). It proves, under today's text and under wave281's:
  - the migration twice adds the two indexes once, and nothing else; the function is untouched (definition, comment, grants);
  - the plans read the indexes; every answer (4,542 of them) is the same as before, and 14 fixed cases answer as designed;
  - either order (wave281 then wave291, or wave291 then wave281) ends with the same function and the same indexes;
  - the undo, twice, puts the plan and every answer back; an index of either name with another definition stops the migration;
  - the live check files themselves, in the order of the live run.
- **Live rollback run 1**, at 6305a9b (the contacts index only), through the Supabase connector on 06/11/26. The files were inlined in the block, each checked against its md5 in git, since this branch is not pushed. Every check passed and everything rolled back. It added four invented contacts and one invented volunteer, kept 3,803 answers (every contact, every number, every volunteer) under today's text and under wave281's, and found all 3,803 the same with the index, under both texts and in both orders. wave281's text loaded with md5 36f0272e, the same as offline. Over 1,805 contacts:
  - today's text, no index: 1,122 ms (`Seq Scan on crm_contacts c`);
  - wave281's text, no index: 1,427 ms;
  - today's text, with the contacts index: 157.5 ms (`Index Scan using crm_contacts_wa291_opted_out_idx`), with the invented contact marked;
  - wave281's text, with the contacts index: 403.5 ms. The stopped-phones view was now the slow part, which is why the second index was added;
  - wave281's text, with the contacts index and 21 marked: 1,118 ms.
- After run 1, a read-only check found live as before: the function md5 48dadf06, no wave291 or wave281 object, no invented row, no change_log line.
- **Live rollback run 2**, at 57a1dc0 on `claude/open-tasks-review-wy88mn` (both indexes; the same 21 files as the block planned at 66f28b8, fetched from GitHub at the pushed commit, with the 2 s lock limit), through the Supabase connector on 06/11/26: every check passed and it ended with the W291_TIMING report, so everything rolled back. Answers: 3,803 the same before and after, under both texts. A read-only check afterwards found live as before (no wave291 index, `wa171_opted_out` md5 48dadf06 unchanged, no test contacts).

**Performance.** The slice's target is under 300 ms in total, with `crm_in_chapter` and `crm_email_permission` at 155 ms.

Run 2 over 1,805 contacts (the best of the runs shown):

| Function text | Before | With both indexes, nobody marked (as live is today) | One marked | 21 marked |
| --- | --- | --- | --- | --- |
| Today's | 1,129.8 ms | 20.9 ms | 161.1 ms | 1,012.2 ms |
| wave281's | 1,437.2 ms | 109.4 ms | 253.8 ms | 983.4 ms |

With wave281 and nobody marked, the three checks together take about 265 ms (109.4 ms plus 155 ms), under the 300 ms target. Each contact marked no texts still adds about 40 ms over 1,805 calls, so the target holds while that list stays small.

## Release steps (on Steel's yes)

1. Push, then run the rollback check once more on the morning's data: `python3 build/sql_rollback_test.py <sha> test/w291live_before.sql test/w291live_time.sql test/w291_w281text.sql test/w291live_before.sql test/w291live_time.sql build/data/wa291_optout_speed.sql build/data/wa291_optout_speed.sql test/w291live.sql test/w291live_time.sql test/w291live_marked.sql test/w291_w281undo.sql test/w291live.sql test/w291live_time.sql test/w291live_marked.sql build/data/wa291_undo.sql build/data/wa291_undo.sql test/w291live_undo.sql build/data/wa291_optout_speed.sql test/w291_w281text.sql test/w291live.sql test/w291live_report.sql`. It must end with W291_TIMING (the report raises it after every check has passed). If wave281 is already live, leave out the four wave281 files and the second before and time: `before, time, migration, migration, live, time, marked, undo, undo, live_undo, migration, live, report`.
2. Claude applies `build/data/wa291_optout_speed.sql` through the Supabase connector, fetched inside the database at the pushed commit. Check: both indexes valid, with their comments; the release line in change_log.
3. Read-only check: `explain (generic_plan)` of the function's query shows `Index Scan using crm_contacts_wa291_opted_out_idx` (and, once wave281 is live, `quo_messages_wa291_stop_digits_idx`).
4. Add the release record to this document.

## Undo

Claude applies `build/data/wa291_undo.sql`. It drops the two indexes and nothing else, so `wa171_opted_out` reads every contact again: slow, with the same answers. The release line stays in change_log and an undo line is added.

## Worth knowing

- With the indexes, the cost grows with the number of live contacts marked no texts: each call still compares every number of every marked contact (`wa171_digits`, twice a number), about 36 ms per marked contact over 1,805 calls. Today nobody is marked. STOP texts and wave281's do-not-contact both mark people. If the list grows to dozens, a change to the function text (after wave281) would be the next step; Steel decides then.
- About 65 microseconds a call is the cost of calling a security-definer SQL function with its own search path, which no index removes: around 120 ms over 1,805 calls.
- `quo_messages_wa291_stop_digits_idx` is built on `wa171_digits`. If that function ever changes, rebuild the index (reindex).
- The check run locks for a few seconds: wave281's keyword indexes and the digits index hold writes to `quo_messages`, and the contacts index holds writes to `crm_contacts`; the undo's drop holds every reader of `crm_contacts` for the last part of a second. The block sets a 2 s lock timeout for itself.
- The generator for `docs/DATA_MODEL.md` lists tables, views, columns and functions, not indexes, so the two index comments live only in the database. The regeneration also picked up the wave262c, wave265 and wave273 comments, which had not been regenerated on main.
- The rollback runs used a few numbers from live id sequences (contacts, volunteers, change_log), which never roll back. That leaves small gaps in those ids and nothing else.
