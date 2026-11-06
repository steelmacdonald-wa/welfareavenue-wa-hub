# CRM slice 1: the release runbook (written 06/11/26, not released)

One plan for releasing the whole CRM slice: waves 281, 282, 283, 284, 286 and 288, from branch `crm-slice1-280-284`. It replaces the release and undo steps for the page in each wave's own document. Those documents still hold each wave's checks.

Nothing here runs without Steel's yes. Each numbered step below is its own yes.

## What is live today, and what replaces it

Read on 06/11/26 (read-only: an md5 over `site_files`, and `list_edge_functions`):

| Thing | Live today | After the release |
|---|---|---|
| Hub page `index.html` | `bae461b90fba79837582ec328976e4b5`, 8,379,788 bytes, 10 parts (wave287, branch `origin/wave287-projects-overview` at 940c905) | the candidate: **`ff9aeae04a1100ecb43c0ce98d9ca3b4`, 8,447,299 bytes** (232 segments, LF) |
| Form page `f/index.html` | `efdb9627a2c812f2e8239eb6ee80d8b3`, 52,174 bytes | **`4adaf708d25a2fe4f6f0715c6fa4f244`, 52,764 bytes**: the committed LF blob `build/f/index.html` |
| quo-send | deployment 18, source v8 (wave266) | v9 (wave281) |
| whatsapp-send | deployment 1, source v1 (wave254) | v2 (wave281, with the final review's SMS stops) |
| mail-send | deployment 18, source v6 (wave273) | v7 (wave282) |
| receipt-pdf | deployment 9, source v2 (wave185) | v3 (wave283) |
| crm-import | not deployed | v1 (wave284), new |
| form-submit | deployment 15, source v9 (wave264) | v10 (wave288) |

"Deployment" is the number Supabase shows, which goes up by one with each deploy. "Source" is the version in the function's first line.

The candidate is the page built from the release commit with `python3 ".superpowers/sdd/01 foundations and Keela import - design/pybuild.py" build <out>`, then every CRLF turned into LF. Against bae461b9 it changes four segments only: `152_wave152`, `153_wave153`, `202_wave202`, and the new `284_wave284` (added to the manifest after `287_wave287`).

**The old candidates are history, not release instructions.** Each wave's document names the candidate it was tested on, on the older live page 0b8e0fa6: dac9bf9d (wave283), 39bbf0b8 (wave284), be00054e (wave288). The integration onto today's live page gave 64bbeaf6 and then a0cab8b7. None of them is the page to publish. Only the candidate above is, and only while live is still bae461b9.

**The release commit** is the tip of `crm-slice1-280-284` on the day, once Steel says yes to it. Every SQL file is fetched inside the database at that commit, and every function is a one-line stub importing `fn/<name>/index.ts` at that commit (the house rule since wave273, while the vault's access token that `build/fn.py` needs is invalid; crm-import may instead go up with the connector's `files` array).

## 0. Before anything: is live still where this plan expects it?

1. Read-only: `select path, md5(string_agg(content, '' order by part)) from public.site_files where path in ('index.html', 'f/index.html') group by path;` must give bae461b9 and efdb9627.
2. `list_edge_functions` must show the deployments in the table above.
3. If either has moved, stop and go to step 4 ("If live moves").

## 1. Database and functions: one wave at a time, in number order

For each wave: first the rollback check (`python3 build/sql_rollback_test.py <release sha> <files>`, run through the Supabase connector, which must answer ROLLBACK_OK and keeps nothing), then Steel's yes, then the SQL, then its checks, then its functions. The checks for each wave are in its own document under "Release steps". Each wave's rollback block assumes the waves before it are already applied for real.

1. **wave281, the CRM rules** (`docs/06-11-26 - wave281 CRM rules.md`).
   - Rollback check: `test/w281live_before.sql build/data/wa281_rules.sql test/w281live.sql`.
   - SQL: `build/data/wa281_rules.sql`, by pinned fetch at the release commit.
   - Check: the chapter rows the morning's data predicts, the consent rows, 7 Campaigns, the release line, and the trigger `trg_wa281_dnc_hold` (do-not-contact holds texts, WhatsApp and email on its own).
   - Functions: quo-send v9 and whatsapp-send v2, each as the pinned one-line stub. Then the live check in the wave281 document (a STOP phone skipped by both, with `sms_mode` on test).
2. **wave282, who may be emailed** (`docs/06-11-26 - wave282 who may be emailed.md`).
   - Rollback check: `test/w282live_before.sql build/data/wa282_mail_rule.sql test/w282live.sql`.
   - SQL: `build/data/wa282_mail_rule.sql`. Function: mail-send v7, pinned stub, after the SQL.
   - **Hold:** `mail_mode` is live, so no newsletter or fundraising Send goes out until the two planned Sends (the main list, then the first contacts) that the wave282 document describes.
3. **wave283, the CRM page's rules and gift rights** (`docs/06-11-26 - wave283 CRM page and gift rights.md`).
   - Rollback check: `test/w283live_before.sql build/data/wa283_page.sql test/w283live.sql`.
   - SQL: `build/data/wa283_page.sql`. Function: receipt-pdf v3, pinned stub, after the SQL.
4. **wave284, the Import page** (`docs/06-11-26 - wave284 the Import page.md`).
   - Rollback check: `build/data/wa284_import.sql test/w284live.sql`. `test/w284live.sql` always goes last in any block it shares: `wa284_apply` and `wa284_undo` leave their import settings on for the rest of the transaction.
   - SQL: `build/data/wa284_import.sql`. Function: crm-import v1 (new): the Supabase connector's `files` array (`index.ts`, `stage.mjs`) or the one-line stub at the release commit, verify_jwt on.
   - No batch is applied yet. Once the page is live (step 2 below), stage the files and time each batch's Compare through the real page before any Apply.
5. **wave286, Toronto crews in the CRM** (`docs/06-11-26 - wave286 Toronto crews in the CRM.md`).
   - Rollback check: `test/w286live_before.sql build/data/wa286_vm_chapter.sql test/w286live.sql`. SQL: `build/data/wa286_vm_chapter.sql`. No function, no page.
6. **wave288, the Toronto forms** (`docs/06-11-26 - wave288 Toronto forms.md`).
   - Rollback check: `test/w288live_before.sql build/data/wa288_toronto.sql test/w288live.sql`. SQL: `build/data/wa288_toronto.sql`. Function: form-submit v10, pinned stub, after the SQL.

The whole stack was also checked in one block in release order, and the undo in one block in reverse order (the final fixes report, `task-9-report.md`, has the runs). On release day each wave is still applied and checked on its own.

## 2. One page swap

After wave281, wave282, wave283 and wave284's SQL, receipt-pdf v3 and crm-import are in. (The page needs `wa_my_caps` from 281, the gift rights from 283 and the Import functions from 284; Email it for team leads needs mail-send v7 from 282.) wave286 and wave288 can come before or after it.

1. Build the candidate from the release commit (as above). Its md5 must be `ff9aeae04a1100ecb43c0ce98d9ca3b4` and `python3 build/check_remaps.py build/candidate.html` must say clean. Any other md5 means the branch moved: stop.
2. Stage and gate, as `build/deploy_stage.py` and `build/deploy_gate.py` do:
   - `python3 build/deploy_stage.py build/candidate.html <stage table>`
   - `python3 build/deploy_gate.py <stage table> bae461b90fba79837582ec328976e4b5 data-w281dnc,data-w283spam,__wa284`
   - Run the printed block through the connector. It refuses unless live is still bae461b9, checks every part's md5 and length, the tail and the markers, swaps the ten parts into `site_files` and checks the result.
3. `f/index.html`: write the committed LF blob, fetched inside the database at the release commit (`build/f/index.html`), never a fresh `build/f/make.py` output (it writes CRLF on this PC). Guard it: live must be efdb9627 before and 4adaf708 after.
4. host-sync (the gate's last line calls it; call it again after `f/index.html`).
5. Re-check live: `index.html` ff9aeae0, `f/index.html` 4adaf708.

The new `/f/` page is safe before wave288: it shows the second box only when form-submit v10 hands it a form whose text box is on, which only wave288's SQL sets.

## 3. The website

The website pull request, steelmacdonald-wa/welfareavenue-site-frontend#7 (the Toronto forms on the site), merges only after wave288 is live.

## 4. If live moves before the release

If another session publishes a page, or deploys one of these functions, before the release: stop. Merge the new live branch into `crm-slice1-280-284` (as Task 8 did with 940c905), regenerate every touched segment from its parts, `build/f/index.html` and `docs/DATA_MODEL.md`, rebuild the candidate, run the PGlite runners and the drive tests again, and write the new live md5, candidate md5 and function versions into this document before step 0.

## 5. Undo

In this order. (Only if any Keela batch was applied: while the Import page is still live, undo every applied batch that should be undone, opt-outs and consent never are, and purge every run, as the wave284 document's undo says. After the page is back the same can be done with `wa284_undo` and the purge through the connector.)

1. **The page first.** Republish bae461b9, rebuilt from `origin/wave287-projects-overview` at 940c905, so wave274's single Volunteer Manager, wave285, wave287 and every other live change stay. Never rebuild from "the commit before wave28N's page commit": that would drop other sessions' live work.
   - `git fetch origin`, then `git worktree add --detach <scratch folder> 940c905`.
   - `python3 ".superpowers/sdd/01 foundations and Keela import - design/pybuild.py" <scratch folder>/build <out>`, then turn every CRLF into LF. The md5 must be `bae461b90fba79837582ec328976e4b5` and the size 8,379,788 bytes.
   - Stage and gate it with `deploy_stage.py` and `deploy_gate.py`, the expected live md5 now being the candidate's (ff9aeae0), and markers that bae461b9 holds (for example `__wa287`).
   - `f/index.html` back to efdb9627: the blob at 940c905 (`git show 940c905:build/f/index.html`, 52,174 bytes, LF), guarded (4adaf708 before, efdb9627 after).
   - host-sync, then re-check both md5s. Remove the scratch worktree.
2. **Then the undo files, newest first:** `build/data/wa288_undo.sql`, `wa286_undo.sql`, `wa284_undo.sql`, `wa283_undo.sql`, `wa282_undo.sql`, `wa281_undo.sql`, each by pinned fetch, each with its own undo checks (`test/w28Nlive_undo.sql`).
   - What the undos never take back: opt-outs, consent and what people said. wave281's undo keeps the consent log, do-not-contact, text consent and the chapter rows as data; wave288's keeps the forms' chapter rows, text consent and log rows; wave284's never puts back a consent or opt-out column.
3. **Then each function back to its version before the slice**, each as a one-line stub at the commit named:
   - form-submit v9 at 0c92b53; receipt-pdf v2 at 79a1de8; mail-send v6 at a9ed5f4; quo-send v8 and whatsapp-send v1 at 94f6942.
   - crm-import is new: disable it (or delete it) once no run is left.
   - Each newer version also works on the older database (the wave documents say so for each), so this step can follow the SQL.
4. Re-read live: `site_files` md5s, `list_edge_functions`, and no slice function, trigger or policy left (the kept tables excepted).
