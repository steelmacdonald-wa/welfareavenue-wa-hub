# wave282: who may be emailed (built 06/11/26, not released)

Phase 2 of Hub CRM slice 1 (design CRM-S1 v2, Part A.4, Phase 2 items 7 to 11). Built and tested on 06/11/26. **Not released**: nothing has been applied to the live database and mail-send has not been deployed. It goes live only on Steel's yes, after wave281. Target: Thu 12 Nov 2026.

## What changes for staff

- Newsletters and fundraising Sends can reach everyone with a working address who has not unsubscribed and is not marked do not contact. This is Steel's rule of 5 Nov 2026.
- People with express or implied consent keep that reason on their email record. Everyone else's reason reads "not unsubscribed (WA rule of 5 Nov 2026)".
- The "Fundraising without consent" setting is gone. (wave283's page already has no switch for it.)
- A Send can no longer be transactional. Only newsletter, fundraising and volunteer are accepted.
- The composer can show how many people on a Send would get their first email from Welfare Avenue (wave283's page reads it).
- Team leads and named finance people can email receipts, not only admins (mail-send v7; see Worth knowing).

There is no page change in this wave.

## What it adds

1. **The rule** (`crm_email_permission`). The order stays: bounced and complained, do not contact, transactional, unsubscribed, express consent, the volunteer branch (unchanged), implied consent. The fundraising-exemption block after implied consent is replaced by one line: a newsletter or fundraising email is allowed with the reason "not unsubscribed (WA rule of 5 Nov 2026)". The change is an exact replacement in the live text, so anything that moved stops the whole file.
2. **The setting** `mail_fundraising_exemption` is deleted from `app_config` (it was off).
3. **Sends** (`crm_campaigns`): the kind check is now newsletter, fundraising or volunteer. There are no Sends yet, so nothing breaks.
4. **`crm_email_first_contact(contact)`**: true when the person is allowed a newsletter only under the new rule (no express and no valid implied consent), has never had a Hub email (no non-test delivery that was sent, delivered, opened or clicked), and has not opened a Keela newsletter in the last 12 months. A Keela date that is not written YYYY-MM-DD counts as never opened. It answers staff only; for anyone else, the service role included, it says nothing (null).
5. **`wa282_newsletter_lists(name)`**: builds the first newsletter's two static lists and returns both counts. "<name>: main" is everyone allowed a newsletter except first contacts (Send 1). "<name>: first contacts" is the first contacts (Send 2, the next day). Admins, and members of the marketing or fundraising teams, can run it. Anyone else is refused.
6. **mail-send v7** (`fn/mail-send/index.ts`, not deployed):
   - Change the settings no longer takes `mail_fundraising_exemption`.
   - Send and receipt answer `{ok:false, reason:'do not contact'}` when the rule says do not contact, and never call Resend. The answer also carries `status: 'suppressed'` and `basis: 'do not contact'`, which the wave283 page reads to show "Receipt not emailed: do not contact". The receipt asks the rule before it draws the PDF. The receipt itself stays issued and stored.
   - Receipt emailing is allowed for anyone who passes `wa_can('gifts_edit')`, or the automation.
   - `campaign_check` adds `first_contacts`.

## Files

- `build/data/wa282_mail_rule.sql`: the migration. Needs wave281 first: it stops at the top without it. Safe to run twice.
- `build/data/wa282_undo.sql`: the undo, with the text of `crm_email_permission` as wave281 leaves it.
- `fn/mail-send/index.ts` (v7).
- Tests: `test/w282schema.sql`, `test/w282sql.sql`, `test/w282sql.mjs` (offline), and `test/w282live_before.sql`, `test/w282live.sql`, `test/w282live_undo.sql`, `test/w282live_timing.sql` (live checks that always roll back).
- `docs/DATA_MODEL.md` regenerated, `docs/EDGE_FUNCTIONS.md` (mail-send v7).

## Checks so far

- **Offline:** `node test/w282sql.mjs` passes (56 runner checks, the assertion script three times). It loads the wave281 fixture (its `crm_email_permission` matches the live md5 d402bc03), runs wave281, checks the result against md5 38706b77 (the text the undo restores), then runs the migration twice, the assertions twice, the undo twice, and the migration and assertions again. It also proves that a moved anchor stops the migration with nothing kept, that the migration refuses to run without wave281, that the wave282 undo leaves the older function alone if wave281 was undone first, and that the live check files pass on the fixture.
- **What the assertions cover:** for a newsletter, unknown consent is allowed, and unsubscribed, bounced, complained and do not contact are refused; express and implied consent keep their reason; transactional mail is allowed for an unsubscribed person and refused for do not contact; the volunteer branch is unchanged; a transactional or test Send is refused; a first contact is no longer one after a delivered or sent Hub email, or with a Keela open in the last 12 months; the two lists add up to the direct count of allowed contacts, nobody is on both, and only admins, marketing and fundraising can build them.
- **mail-send:** there is no Deno on this machine. The file was checked with `node --experimental-strip-types --check` (it parses with the types stripped; this is not a type check) and by careful review.
- **Live rollback checks** (`build/sql_rollback_test.py` at 342f5c3, run through the Supabase connector on 06/11/26; everything rolled back each time):
  1. wave281, the before snapshot, the migration twice, the live checks. **ROLLBACK_OK.** For every contact, transactional and volunteer answers are unchanged. Newsletter and fundraising answers are unchanged for everyone allowed before and everyone refused for a reason other than consent. Everyone refused for no consent before is now allowed with the new reason. The first-contact count matches the rule written out directly in SQL, and the two lists add up to the allowed count.
  2. wave281, the before snapshot, the migration, the undo twice, the undo checks, the migration again, the live checks. **ROLLBACK_OK.** The undo put `crm_email_permission` back exactly (definition md5, comment, grants), every contact's answer for every kind matched the snapshot, and the kind check, its comment and the setting (off) came back.
  3. Timing and counts, after wave281 and wave282 (this run always ends with its own message): over 1,802 contacts, `crm_email_permission` (newsletter) 91 ms, 1,251 allowed; `crm_email_first_contact` 245 ms, 349 first contacts; `wa282_newsletter_lists` 406 ms (main 902, first contacts 349).
- After the runs, a read-only check confirmed live is as before: `crm_email_permission` md5 d402bc03, the setting off, the old kind check, no wave281 or wave282 function, list or change_log line.

**Counts on 06/11/26** (read-only, before the change): 325 contacts may get a newsletter today. Under the new rule, 1,251 may (926 more). Of the 926, 349 are first contacts: 218 who were never on Keela's email list, 58 who were sent Keela email and never opened it, and 73 whose last Keela open is more than 12 months old. 571 opened a Keela newsletter in the last 12 months and 9 have had a Hub email, so they are not first contacts.

## Release steps (on Steel's yes)

1. wave281 is released first (its own document). wave282's SQL stops at the top without it.
2. Run the rollback check once more on the morning's data, at the pushed commit: `python3 build/sql_rollback_test.py <sha> build/data/wa281_rules.sql test/w282live_before.sql build/data/wa282_mail_rule.sql build/data/wa282_mail_rule.sql test/w282live.sql`, then the undo cycle (`... build/data/wa281_rules.sql test/w282live_before.sql build/data/wa282_mail_rule.sql build/data/wa282_undo.sql build/data/wa282_undo.sql test/w282live_undo.sql`). Once wave281 is live, leave `build/data/wa281_rules.sql` out of both. Both must answer ROLLBACK_OK.
3. Claude applies `build/data/wa282_mail_rule.sql` through the Supabase connector, fetched inside the database at the pushed commit. Check: `crm_email_permission` holds "WA rule of 5 Nov 2026" once and no longer mentions the exemption setting; `mail_fundraising_exemption` is gone; the kind check is the three kinds; the two new functions exist; one release line in change_log.
4. Deploy mail-send v7 with `build/fn.py` or the one-line stub pinned to the pushed commit, after step 3. (Deployed before it, the first-contact count would be missing and nothing else would change.)
5. Live checks, signed in as Steel, with `mail_mode` on test: `crm_email_first_contact(<a contact>)` answers true or false; a draft Send's check shows the first-contact count; Email it on a do-not-contact test contact's receipt says "Receipt not emailed: do not contact"; Change the settings saves without the fundraising key. Call `wa282_newsletter_lists` for real the day before the first newsletter (design B.3), or once with a test name and then delete its two lists.
6. Add the release record to this document.

## Undo

1. Redeploy mail-send v6 (the source at a9ed5f4).
2. Claude applies `build/data/wa282_undo.sql`. It puts `crm_email_permission` back as wave281 leaves it (only while the wave282 line is there), drops the two new functions, puts back the old kind check and its comment, and re-inserts `mail_fundraising_exemption` as off. An undo line goes in change_log.
   - Lists built by `wa282_newsletter_lists` stay; delete them by hand if wanted.
   - wave283's page has no switch for the setting, so after the undo it can only be changed in the database.
   - Undo wave282 before wave281. If wave281 is undone first, its undo also takes `crm_email_permission` back to the consent rule, and the wave282 undo then leaves that function alone.

## Worth knowing

- **Send 2 is bigger than the design said.** The design estimated 220 to 290 first contacts. The rule as written counts 349, because people whose last Keela open is more than 12 months old are first contacts too (73 of them). At the planned cap of 200 a day, Send 2 takes two days through the queue, or an admin splits it. Steel decides.
- **The footer still says** "You are receiving this email because you said yes to our news, or gave or volunteered with us in the last two years" for newsletters and fundraising. That is not true for people emailed under the new rule. Changing the words is not part of this wave.
- **Receipts:** mail-send v7 lets anyone with `gifts_edit` email a receipt, but wave283's page still shows Email it to admins only. The function is the wider of the two, so nothing breaks; the page can open it later.
- **Do-not-contact answers** from Send and receipt still write a suppressed row in `crm_email_sends`, as every refusal does today, so the person's email history shows the attempt.
- **Two contacts with one address:** the lists hold contacts, and mail-send removes duplicate addresses within a Send but not across the two Sends. If two records share an address and only one is a first contact, that address can get both Sends.
- `crm_email_first_contact` answers only signed-in staff, so mail-send asks it as the signed-in person, 25 at a time. For the automation (no person) the count is left out. `wa282_newsletter_lists` refuses the service role, as the design gives it.
- The rollback checks used a few numbers from live id sequences (lists, change_log, and wave281's tables), which never roll back. That leaves small gaps in those ids and nothing else.
