# wave281: the CRM rules in the database (built 06/11/26, not released)

Phase 1 of Hub CRM slice 1 (design CRM-S1 v2, Part A). Built and tested on 06/11/26. **Not released**: nothing has been applied to the live database and no function has been deployed. It goes live only on Steel's yes. Target: Tue 10 Nov 2026.

## What changes for staff

Nothing visible. wave281 has no page change of its own. (When it was built the live page was 0b8e0fa6; on 06/11/26 it is bae461b9. The slice's one page swap, and its order against this SQL, are in `docs/06-11-26 - CRM slice 1 release runbook.md`.) Later waves build the CRM page, the Import page and the Toronto forms on these rules.

## What it adds

1. **Chapters.** `crm_chapters` has two rows: Montreal (volunteer@, opsmtl) and Toronto (toronto@, opsto). `crm_contact_chapters` says which chapter a person belongs to.
   - `crm_in_chapter(contact, code)` is the filter rule. Toronto means a toronto row. Montreal means a montreal row, or no chapter row at all, so Montreal lists stay as they are. All means everyone.
   - The backfill, from evidence only: Toronto for the 44 contacts tagged Toronto (in tags or in Keela's tags). Montreal for 462 contacts with a confirmed completed serving, an attended old-website serving, a processed Montreal form answer or a volunteer application. A serving at a Toronto meal (wave274: kind meal, location Toronto) does not count for Montreal (final review M1); wave286 puts those crews in Toronto. The 462 was counted before that rule; the live check works the number out again from the morning's data.
   - `crm_add_chapter` is for the service role only. The page writes the table under its own policies.
2. **The consent log** (`crm_consent_events`). One row each time an email status, email consent, text opt-out, text consent or WhatsApp opt-out changes. It records where the change came from: staff, a website account, the system, or a named writer (STOP text, START text, WhatsApp STOP, daily implied-consent refresh, do not contact). A plain new contact writes nothing.
   - Nobody can edit, delete or truncate log rows. Only a merge moves them, and deleting a contact takes its rows with it. No API role holds the right to truncate, and a trigger refuses a truncate from anyone else.
   - Loaded once: the 59 Hub form answers with consent (39 given, 20 not given) and the 1 consent change in change_log.
   - New text-consent columns on contacts: `sms_consent`, `sms_consent_source`, `sms_consent_at`.
3. **Do-not-contact.** `crm_set_do_not_contact(contact, reason)` (deceased, asked or other). It sets the flag, unsubscribes the email (a bounced or complained address keeps that status), stops texts and WhatsApp, and logs each change. `crm_email_permission` then refuses every kind of email, transactional included. Clearing it (no reason) clears the flag only, never resubscribes anyone, and writes a change_log line.
   - **Do-not-contact holds on its own** (final review, 06/11/26). The trigger `trg_wa281_dnc_hold` (`crm_dnc_hold`) runs before every write of the flag, the text and WhatsApp opt-outs or the email status. While the flag is on, texts and WhatsApp stay stopped and the email stays unsubscribed (bounced and complained stay as they are), whoever writes the row: the page's Email permission form, a START text (`wa171_inbound`), a merge, an import. So quo-send, whatsapp-send and every other check that reads `sms_opt_out` also stop a do-not-contact person. Clearing the flag changes nothing. The consent log compares the final values, so a held value that was already on writes no row; its trigger also fires when the flag alone is written, so the opt-outs the hold sets are logged. A do-not-contact person whose opt-outs moved while the rule was off (after an undo, which keeps the flag) is put right when the migration runs again.
   - On the page, the Email permission form of a do-not-contact person shows the email and text boxes disabled, with "Do not contact is on. Clear it first to change these.", and is read-only (no Save).
4. **STOP sticks to the phone number.** `wa_stopped_phones_v` lists every phone whose latest STOP or START text was a STOP, for texts and for WhatsApp, even when no contact holds the number (the 2 Oct 2026 case). Two phones are on it today. quo-send leaves out the phones stopped by SMS; whatsapp-send leaves out those stopped on either channel (final review M3: its own rule is nobody who said STOP on WhatsApp or SMS).
   - `wa171_opted_out` (the text schedule and Find volunteers) now also says no for a stopped phone.
   - quo-send v9 and whatsapp-send v2 leave stopped phones out.
5. **Private data.** `crm_contacts.job_title`. Birth dates go in `crm_contact_private`, which only HR and admins can read. Everyone else with the CRM sees `crm_age_band` (under 16, 16 to 17, 18 or older). Four new custom fields: LinkedIn, Car (make and model), Car seats, Food licence (MAPAQ).
6. **Campaigns.** `wa_campaigns` with the seven seed rows (Football Fundraiser 2025 and Holiday Gift Baskets are done, the rest active), and `wa_campaign_people`.
   - 39 gifts are linked to their campaign by their text. Holiday Gift Basket Drive 2026 means Gift Basket Drive 2026. The 9 "fundraising campaign" gifts and the 8 with no text stay unlinked.
   - A trigger keeps new gifts linked the same way.
   - The 8 gift-basket-drive forms carry the campaign's id.
7. **Organisations.** `wa_partners` gets `keela_company_id` and `goals`. CRM staff can add an organisation that everyone can see; editing and deleting stay with leaders.
8. **Access.** `hub_roles.caps` and `wa_can(capability)`: gifts_edit (leaders, admins, or caps), import_admin (admins), hr_private (HR or admins). `wa_my_caps()` gives all three.
   - Security fix: a new staff member who adds their own Hub row can no longer give themselves a capability (`hub_roles_self_member` now requires empty caps).
   - Only admins can change the `keela_` settings.
9. **Merges** now move chapters, consent rows, campaign rows and private data. The kept contact also takes, where it has none, the other record's do-not-contact (with reason, time and author), text consent, job title and WhatsApp opt-out.

Seven live functions are changed by exact replacement of a line in their live text, so anything that moved makes the whole migration stop: `crm_email_permission`, `wa171_opted_out`, `wa171_inbound`, `wa254_inbound`, `crm_refresh_implied_consent`, `crm_merge_contacts`, `wa_app_config_guard`. `crm_contacts_v` gains three columns at the end (job title, do-not-contact, reason). Each keeps its grants.

## Files

- `build/data/wa281_rules.sql`: the migration. Safe to run twice.
- `build/data/wa281_undo.sql`: the undo, with the live text of everything changed.
- `fn/quo-send/index.ts` (v9) and `fn/whatsapp-send/index.ts` (v2).
- Tests: `test/w281schema.sql`, `test/w281sql.sql`, `test/w281sql.mjs` (offline), and `test/w281live_before.sql`, `test/w281live.sql`, `test/w281live_undo.sql`, `test/w281live_timing.sql` (live checks that always roll back).
- `docs/DATA_MODEL.md` regenerated (it also picked up wave277's `studio_platforms` comment, which had not been regenerated), `docs/EDGE_FUNCTIONS.md`.

## Checks so far

- **Offline:** `node test/w281sql.mjs` passes (165 runner checks, the assertion script three times). The fixture holds the live text of the seven functions, `crm_contact_match` and `crm_contacts_v`, checked against the live md5 of each.
- **After the review fixes** (every column of the new tables commented; the consent log cannot be truncated), at b489858: run 1 (the migration twice, the live checks) and run 2 (the full undo cycle) both answered **ROLLBACK_OK**. A read-only check afterwards found live as before.
- **Live rollback checks** (`build/sql_rollback_test.py`, run through the Supabase connector on 06/11/26; everything rolled back each time):
  1. At 8669fdd: the before snapshot, the migration twice, the live checks. **ROLLBACK_OK.** The backfills gave exactly what the live rows predict. Nobody's email permission changed for any kind. The only texting change was the stopped phones. The contacts view rows were unchanged.
  2. At 8669fdd: the before snapshot, the migration, the undo twice, the undo checks, the migration again, the live checks. **ROLLBACK_OK.** The undo put back all seven functions, `crm_contact_match`, `crm_contacts_v` and the policy exactly (definition, comment, grants, options), and removed every wave281 object. The first try of this run, at cf8e621, found that live stores the view's option as `security_invoker=true` and the undo wrote `on`; fixed in 8669fdd.
  3. Timing, after the migration (this run always ends with its own message): over 1,802 contacts, `crm_in_chapter` (Montreal and Toronto) 66 ms, `crm_email_permission` (newsletter) 89 ms, `wa171_opted_out` 1,237 ms; total 1,392 ms.
- After the runs, a read-only check confirmed live is as before: the seven function md5s, the view md5 and the policy unchanged, and no wave281 object or change_log line.

**Performance.** The target was under 300 ms in total. `crm_in_chapter` and `crm_email_permission` together take 155 ms. `wa171_opted_out` takes about 1.24 s over every contact, and it took 1.25 s before wave281 (read-only EXPLAIN ANALYZE on 06/11/26): it reads every contact on each call. wave281 adds nothing measurable to it. Making it fast (for example an index for opted-out contacts) is a separate change for Steel to decide on.

## Release steps (on Steel's yes)

1. Run the rollback check once more on the morning's data: `python3 build/sql_rollback_test.py <sha> test/w281live_before.sql build/data/wa281_rules.sql build/data/wa281_rules.sql test/w281live.sql`, then the same with the undo files. Both must answer ROLLBACK_OK.
2. Claude applies `build/data/wa281_rules.sql` through the Supabase connector, fetched inside the database at the pushed commit. Check: 44 Toronto rows (or what the morning's data predicts), the consent rows, 7 campaigns, the release line in change_log.
3. Deploy quo-send (v9) and whatsapp-send (v2) with `build/fn.py` or the one-line stub pinned to the pushed commit. Apply the SQL first: before it, the functions read no stopped phones and behave as today.
4. Live check, with `sms_mode` on test: queue a text to a test phone that has texted STOP. Expect it skipped with "they texted STOP", from both the quo-send drain and Text volunteers. Then expect whatsapp-send to skip it too ("they said STOP").
5. As Steel, call each new function once: `wa_my_caps()`, `crm_in_chapter(<a contact>, 'toronto')`, `crm_age_band(<a contact>)` (null until birth dates come in), `crm_set_do_not_contact` only on a test contact.
6. Add the release record to this document.

## Release record (07/11/26, on Steel's yes)

- **Before:** live page bae461b9, form page efdb9627, quo-send deployment 18, whatsapp-send deployment 1, as the runbook expects.
- **Rollback checks at c157e49:** the migration twice plus the live checks: ROLLBACK_OK. The full undo cycle (migration, undo twice, undo checks, migration again, live checks): ROLLBACK_OK. The first try of the second run hit a GitHub fetch timeout (SSL), not a test failure; the retry passed.
- **Applied** `build/data/wa281_rules.sql` (md5 c1f836b6612dd80c5884267c40b7ce5b) by pinned fetch at c157e49, about 13:52 UTC.
- **Checks:** 44 Toronto and 463 Montreal chapter rows; 65 consent rows; 7 Campaigns (in `wa_campaigns`; the older `crm_campaigns` table is unrelated and has 0); `trg_wa281_dnc_hold` present; 2 phones in `wa_stopped_phones_v`; release line change_log 13676.
- **Functions:** quo-send v9 (deployment 19, verify_jwt on) and whatsapp-send v2 (deployment 2, verify_jwt off, as before), each as the one-line stub pinned to c157e49.
- **Step 5, as Steel's WA account, in a rolled-back block:** `is_wa_admin` true; `wa_my_caps` gives gifts_edit, hr_private and import_admin true; `crm_in_chapter` true for a Toronto contact; `crm_age_band` null. `crm_set_do_not_contact` on an invented contact set do-not-contact (reason other), all three opt-outs (texts, WhatsApp, email unsubscribed) and 3 consent rows; nothing kept. Note: `is_wa_admin` reads the email in the token, so an impersonation test must put `email` in `request.jwt.claims`.
- **Step 4 (live STOP check) not run.** `sms_mode` is live, not test, and neither stopped phone is a test phone; both belong to real people. Running it as written would mean texting a person who said STOP if the check failed, or switching every automatic text to test mode. Waiting on Steel: text STOP from a test phone (then START after), or accept the offline and rollback proof.

## Undo

1. Claude applies `build/data/wa281_undo.sql`. It puts back the seven functions, `crm_contacts_v`, `crm_contact_match` and the policy exactly as live had them on 06/11/26, then drops the functions, triggers, policies, views and grants wave281 added.
   - **What stays, and why.** Steel's rule: an undo never undoes opt-outs or consent, and evidence is not thrown away. So the undo keeps, as data: the consent log (`crm_consent_events`) and its rows; the do-not-contact flag with `dnc_reason`, `dnc_at` and `dnc_by`; text consent (`sms_consent`, its source and date); and the chapters (`crm_chapters`, `crm_contact_chapters`) with their rows. Nothing of wave281 acts on them after the undo. The log's append-only guard goes with the rest, so every API role (anon, authenticated, service_role) loses its rights on the three kept tables too, and the kept log stays untouched. The text and WhatsApp opt-outs and the email status were live columns before wave281 and keep their values.
   - **What goes.** Birth dates, job titles, Campaigns, gift and form links, caps, the four custom fields and their values, the organisation columns. Take a copy first.
   - **Running wave281 again** after the undo works: every table and column is created only if missing, the backfills skip rows already there, and the comments, policies, grants and triggers come back. A do-not-contact person whose texts were turned back on while the rule was off is stopped again, with a log row.
   - Contacts, gifts and forms themselves are never deleted. An undo line goes in change_log.
2. Then redeploy quo-send v8 and whatsapp-send v1 (the source at 94f6942), as the slice runbook's undo says (SQL first, then the functions). The v9 and v2 functions also work on the older database, so this step can wait.

## Worth knowing

- The 300 ms check is not met because of the existing `wa171_opted_out` (1,248 ms before this wave, 1,237 ms after). wave281 doesn't change that. Steel decides whether to waive the check or schedule a fix.
- `crm_in_chapter` is security invoker, so a caller without the CRM page gets Montreal for everyone. Code for people without the CRM page needs its own staff-checked reader; wave286 planned one (`wa286_volunteer_chapters`) for the Volunteer Manager's People filter, but it went with that page work and does not exist.
- A few writers set the consent source for the rest of their transaction (`crm_set_do_not_contact`, `wa171_inbound`, `wa254_inbound`, the refresh). Each Hub call is its own transaction, so this only matters to someone running several in one SQL session.
- The rollback checks used a few numbers from live id sequences (contacts, gifts, change_log), which never roll back. That leaves small gaps in those ids and nothing else.
