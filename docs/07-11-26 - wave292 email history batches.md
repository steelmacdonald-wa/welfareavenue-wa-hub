# wave292: the email history batches and the summary pass (built 07/11/26, not released)

The second of three waves that bring Steel's mailbox and hub@ (info@ arrives there) back to April 2020 into the CRM (design "03 email history, interactions and insights" v2, section 11.4). wave289 scans the mail into a private holding area; this wave moves what the scan found into the CRM through wave284's Import page, one reviewed card at a time (Compare, Steel's yes, Apply, Undo), and writes a short relationship summary for each person afterwards.

Built on branch `email-history-289`, on top of wave289 (305386a) and CRM slice 1 with its UI work (merged at ef5431d from 92dc070). Slice 1 and wave289 are built but not released, and wave292 needs both. **Status: built, not released. Nothing is deployed, no mailbox was read, the router was never called, and no batch ran against real data.**

## What it does

An email-history run on the Import page shows a **Scan card** instead of the files card: each mailbox with its phase, its counts and what was set aside, the oldest email, the estimate, the spend and the cap, with Start reading (its confirmation repeats the estimate and the cap), Pause, Resume, Raise the cap, Look at them (the people found, 50 at a time, with Leave out and Not an opt-out) and, once the emails are applied, Write the summaries.

Below it come **five cards**, compared and applied top down and undone bottom up:

1. **Opt-outs from the email history** (`mail_optouts`). People who asked to stop, and addresses that bounced for good, go on the suppression list and stop getting email on every contact holding the address. A bounce counts only on the address the Hub sends to, and not when the person wrote again later. Newer consent is listed, not changed. Never undone.
2. **Organisations** (`mail_orgs`). Found on their own homepages; matched to Partners by domain, website or name with blanks filled, or added new with what the homepage prints. New organisations are never deleted by Undo.
3. **New people** (`mail_people`). A contact for each person who wrote in and is not in the Hub yet, with their type. No consent is set; an address on the suppression list arrives opted out. Undo tags the new contacts `email history: review`, which keeps them out of every Send, and **Delete created and untouched** removes them afterwards on Steel's yes.
4. **People already in the Hub** (`mail_enrich`). Empty fields filled from their signature, the tag `email history`, and their type. Never an opt-out or consent.
5. **Emails on the timeline** (`mail_interactions`). One timeline item per email per person: date, in or out, mailbox, cleaned subject and one line. Never the email itself, never a left-out thread. Its report counts the first contacts among the run's people.

Then **the summary pass** (`mail-history` `summarise`) reads each person's email lines (never a body) and writes topics, anything still open and two or three plain sentences. It shares the run's spend and cap and resumes where it stopped. One email gets a line without a model. A profile's Refresh (`insight`) does the same for one person.

## Purposes (for the privacy assessment)

1. Keeping Welfare Avenue's relationships with the people who wrote to it.
2. Prospection: newsletters, fundraising and volunteer emails to them under the rule of 5 Nov 2026 (anyone not unsubscribed), with people who never answered a Welfare Avenue email going to the watched first-contacts Send.
3. Model typing and summarising: a model read their emails to type them and write one line each (wave289), and now reads those lines to write a summary.

Purposes 2 and 3 are new uses the legal adviser must confirm before any Send.

## The rule for Claude sessions

**Claude sessions never query `import_stage`.** Read the batch reports (counts, Hub ids and organisation names only), `wa289_status` and `crm_mail_scans`. Look at them and Leave out never take the trigger secret.

## What it changes

**Database** (`build/data/wa292_batches.sql`, md5 `7e9e10d5ddd94240815919a7b64d5631`; needs wave289, wave284, wave282 and wave281; safe to run twice):
1. The batch kind check gains the five mail kinds.
2. `wa_partners` gains `domain` (unique when set) and `address`.
3. `crm_email_relationship`: one row per contact with the type and confidence, topics, anything open, the summary, from Steel's mailbox or not, stale, model, cost, when and by whom. CRM staff read it, except rows from Steel's mailbox, which only admins read until `mail_history_steel_open` is true. Nobody signed in writes it.
4. `crm_email_relationship_v` (security invoker): first and last email, in and out, threads, by year, mailboxes, live from the email lines.
5. Two restrictive policies on `crm_interactions`: Steel's mailbox lines are read by admins only until `mail_history_steel_open`; nobody signed in updates an email line.
6. Two triggers on `crm_contacts`: an address on the suppression list (asked to stop, unsubscribed or bounced) makes a new or changed contact opted out, from any source; deleting a contact with email history suppresses its addresses so a later run never brings them back (Delete created marks its deletions as undo instead, which blocks nothing).
7. The writers (`wa292_w_optouts`, `_orgs`, `_people`, `_enrich`, `_interactions`), `wa292_write`, `wa292_basis`, the undo checks, `wa292_purge` (the run's staging; its `mail_seen` hashes only when its `mail_interactions` batch was never applied, eh-289 I8; never `mail_left_alone` or the suppressions), `wa292_delete_created`, and the summary support (`crm_insight_input`, `crm_insight_save`, `wa292_summary_start`, `_todo`, `_done`, `_active`). Every one is the service role's only.
8. Eleven live functions changed by exact anchor (the file stops if an anchor is missing or appears twice): `wa284_write`, `wa284_basis`, `wa284_new_batch` (mail kinds on an email-history run only), `wa284_undo` (bottom up; quarantine), `wa284_unrow`, `wa284_set`, `wa284_upd`, `wa284_purge`, `crm_email_first_contact` (an outgoing email the person answered in the same thread means they already had an email from Welfare Avenue), `crm_email_permission` (a general inbox or a contact waiting for review gets no volunteer, newsletter or fundraising email: "not for bulk email"), `crm_merge_contacts` (the summary row is kept or moved and marked stale).
9. One release line in `change_log`.

**crm-import v2** (`fn/crm-import/index.ts`, md5 `d85f37c0529c87a143007a0d137b0689`): the five mail kinds, and `delete_created {batch_id}`.

**mail-history v2** (`fn/mail-history/index.ts`, md5 `abd40dae6a19eb0ca34af019f21794c4`; `summary.ts`, md5 `ae9726aaa018bd4f17836ba366604a7d`; `scan.ts` unchanged): `summarise {run_id}` and `insight {contact_id}`; continue and pump carry the summary pass.

**The page**: segment 284 (`build/parts284` with the new `c_mail.js`, md5 `7834bf6001c94ecb32e267e490026fda`) and segment 152 (the `email_history` source, md5 `6cfd38e3640e215e0aefdaa66f4e4eba`); candidate md5 `5f309d7c0099778820633c82a118cfbd` (LF).

## Proofs

- `node test/w292sql.mjs` (PGlite, slice 1 and wave289 loaded): the migration twice with bodies, grants and comments compared; the assertions twice (the five batches end to end on invented people, the order, the basis, the suppression trigger, the policies as a member and an admin, the H1 setting, the summary functions, the merge, Undo bottom up with quarantine, Delete created, a staff deletion, Purge); the undo twice with the eleven live functions back exactly as they were (md5); the undo's refusal while a batch is applied; a kept summary keeping its table; the stop without wave289; the live check files offline.
- `node --test test/w292summary.test.mjs`: the summary pass on a fake router (cuts at a link or address, unknown topics dropped, one email without a model, a second pass pays nothing, two refused answers fall back to counts and dates, the cap pauses it, Refresh).
- `node test/w292drive.js`: 36 checks on the page. `node test/w284drive.js`: 40 passed. `test/crm1ui_imports_worst.js`: 104 passed (demo), 92 passed (worst).
- Live, rolled back at d8636ef (slice 1's six files in release order, then wa289, then wa292): with `test/w292live.sql` ROLLBACK_OK; with the undo twice and `test/w292live_undo.sql` ROLLBACK_OK. A read afterwards found nothing kept.

## Release steps (after wave289's release, each on Steel's yes)

1. Run `build/data/wa292_batches.sql` through the Supabase connector (a rolled-back run first with `build/sql_rollback_test.py`), together with wave293's database when it is built. Check the advisor shows no ERROR.
2. Deploy crm-import v2 (index.ts and stage.mjs) and mail-history v2 (index.ts, scan.ts, summary.ts and mail_rules.ts) through the connector's files array.
3. Swap the page once, carrying wave292 and wave293.
4. On the Import page, the five cards in order, each Compare read and approved by Steel before Apply. After the first Hub newsletter's two Sends (H9).
5. Steel spot-checks his own mailbox's lines; then, on his word, `mail_history_steel_open` to true (H1).
6. Write the summaries. Purge the run 30 days after the last Apply. (A run purged without its email lines ever applied gives its Message-ID hashes back, so a later run reads that mail again.)

## Undo

- **A card:** Undo on the Import page, bottom up. Opt-outs are never undone. New people are tagged `email history: review`, never deleted by Undo; Delete created and untouched removes those nobody touched, on Steel's yes. Undo works only before Purge.
- **The page:** swap back to the previous page.
- **The functions:** crm-import v1, mail-history v1.
- **The database:** `build/data/wa292_undo.sql` (md5 `e6618da31e3816789fdec64e6ea6d9c2`), after every card but the opt-outs is undone. It takes wave292's text back out of the eleven live functions (so each returns exactly to what it was), drops the triggers, the two policies, the functions and the view, drops `crm_email_relationship` only when empty and `wa_partners.domain` and `address` only when every row is empty, and puts the kind check back when no email-history batch remains. The suppression list is kept: opt-outs are never undone.

## Where the build differs from the design, and why

- **The undo takes the inserted text back out instead of pasting a copy of each live definition.** The eleven functions are slice 1's and not live yet, so there is no live text to copy; taking out exactly what was inserted returns each to its slice 1 text, and the PGlite proof checks the md5s match.
- **The suppression trigger sets `consent_source` to "suppression list"** rather than the setting `wa.consent_source`, because a setting would stay for the rest of the transaction; the consent log reads the changed `consent_source` when no setting is in force, and "Email history" during an import.
- **The trigger watches `emails` only**: `primary_email` is generated from `emails[1]` on live and cannot be named in a trigger's column list.
- **An organisation whose writers' type is `other` is not created** (the map gives it no relationship, and `wa_partners.relationship` cannot be empty); it is counted as skipped.
- **The first-contact count in the report** uses a copy of the rule (`wa292_first_contact`), because `crm_email_first_contact` answers only signed-in staff and the batches run as the service role.
- **Extra counts** (by kind, by type, first contacts) sit in the report's `lists.mail`, because wave284's report keeps a fixed set of counts and this wave does not change it.
- **The policies call `crm_mail_steel_open()`**, a small function signed-in users may run, because `wa284_cfg` is the service role's only.
- **A card cannot compare until the scan has finished**, and the page says so.

## The eh-292 fix round (07/11/26, from the review)

- **One first-contact rule.** The rule now lives in `wa282_first_contact_core(p_contact)` (wave282's file, the service role only). `crm_email_first_contact` keeps its staff gate and calls it; the mail_interactions report calls it too (the copy `wa292_first_contact` is gone). wave292 anchors its thread clause into the core only. A test checks both give the same answer for every contact.
- **The summary pass honours Pause and the cap before spending.** `wa292_summary_gate(run)` is read at the top of every summary step and before each contact; `wa292_summary_start` refuses a paused run or one at its cap; every router call's cost is added to the run as it happens (`wa289_spend` inside the attempt loop), so a later failure loses nothing, and a call that reaches the cap is the last.
- **Newsletters through info@ add no one.** For a post through WA's group, `groupBulk` also looks at the original sender: a bulk domain (news., updates., ...) or a no-reply, newsletter or notifications local part is automated; hello@, info@ and contact@ never count.
- **The undo restores the saved live definitions** (ground rule 11.1). The migration saves the eleven functions it changes into `wa292_fn_backup` (no grants): each as it was before wave292 (`def`) and as wave292 left it (`def_after`, eh-293 B-I1). The undo executes `def` only while the live definition still equals `def_after`; a function changed since falls back to taking wave292's text out, which keeps a later change made elsewhere and stops with "changed since wave292" when wave292's own text was touched. Without the table it takes the text out. The table is dropped at the end.
- **No forged email lines.** A third restrictive policy on `crm_interactions` refuses a signed-in insert of a `gmail` row.
- **Suppression after an undo.** The undo keeps `trg_wa292_suppress` and `wa292_suppress_check` (they need only wave289's `crm_email_suppressions`), so a suppressed address is still born opted out; wave289's undo drops them with the table.
- **A Refresh limit.** `mail_history_refresh_daily` (20 by default): `wa292_refresh_left(email)` counts the person's email summary lines today (Toronto day) and mail-history `insight` refuses at 0 with "You have reached today's limit for writing summaries. Try again tomorrow."
- **The " via " swap** happens only for the group's own posts (its List-Id) or a From at welfareavenue.com, so "X via Eventbrite" keeps its own sender.
- **Deleting a contact** with email history removes that address's staging rows from unpurged runs (`wa292_suppress_on_delete`), so a batch compared before the delete needs a new Compare before Apply.
- **eh-293 review:** a later run's new lines mark an existing summary stale (the summary pass writes it again) and a line or type from Steel's mailbox marks the row `from_steel` (B-M2); `no_reply@`, `noreply-x@` and `newsletter+fr@` through the group are automated (B-M3); the header names `wa282_first_contact_core` as anchored (B-M1).
- **eh-293 N1:** `crm_insight_input(contact, p_hub_only)` and `crm_insight_save(..., p_hub_only)`: a non-admin's Refresh reads hub@ and info@ lines only, and a hub-only save never replaces a row from Steel's mailbox (the write is skipped, the quota line still logged).
- **Runbook: never re-run wave282 after wave292.** Its `create or replace` of `wa282_first_contact_core` drops wave292's thread clause; if it ever happens, run `wa292_batches.sql` again straight after.

## Files

`build/data/wa292_batches.sql`, `build/data/wa292_undo.sql`, `fn/crm-import/index.ts`, `fn/mail-history/index.ts`, `fn/mail-history/summary.ts`, `build/parts284/a_import.js`, `build/parts284/c_mail.js`, `build/parts284/b_css.js`, `build/parts284/assemble.py`, `build/parts152/a_head.js`, `build/src/284_wave284.seg`, `build/src/152_wave152.seg`, `build/candidate.html`, `test/w292schema.sql`, `test/w292sql.sql`, `test/w292sql.mjs`, `test/w292live.sql`, `test/w292live_undo.sql`, `test/w292summary.test.mjs`, `test/w292drive.js`, `test/w292fx.js`, `docs/EDGE_FUNCTIONS.md`, `docs/DATA_MODEL.md`.
