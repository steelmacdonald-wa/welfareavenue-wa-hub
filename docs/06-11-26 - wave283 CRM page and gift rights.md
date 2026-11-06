# wave283: the CRM page and gift rights (built 06/11/26, not released)

Hub CRM slice 1, Phase 3 (design CRM-S1 v2, items 12 to 22; Part A.9). Built on 06/11/26 on branch `crm-slice1-280-284`, on top of wave281 (the CRM rules in the database, also built and not released). Nothing is live. Release waits for Steel's yes, and wave281 goes first.

## What changes for staff

- The CRM rail and tabs say **Sends** where they said Campaigns. A Send is one email to many people; Campaigns (fundraising events, drives, appeals) are a different thing (wave281's `wa_campaigns`).
- **Only team leads, admins and finance change gifts and receipts.** Everyone with the CRM still reads every gift. For anyone else, Record a gift is not shown (Gifts tab, a contact's page), a gift opens read-only with no Save or Delete, and if the database refuses a change the row says "Only team leads, admins and finance can change gifts." Team leads and finance can now also delete a gift recorded in the Hub (before, admins only).
- **Receipts:** Issue, the year-end run, Replace, Cancel and Make the PDF follow the same right (team leads, admins, finance). The receipt settings, turning receipts on or off, the signature, the automatic switch for online gifts and Email it stay with admins (their functions and mail-send still check admin). When a donor is do-not-contact, Email it leaves the receipt kept and the row says "Receipt not emailed: do not contact".
- **A contact's page:** a "Do not contact (reason)" banner under the name when it is set, and a Do not contact section to set it (deceased, they asked, other) or clear it. Clearing asks first and says "This does not resubscribe them." The details show the job title and "Age" (an age band: under 16, 16 to 17, 18 or older; never the date). The postal code is not shown twice when the address already holds it. In the Email permission form (final review, 06/11/26): unticking "They unsubscribed" clears an unsubscribe only, and a spam complaint stays, with a line that says why (M4); for a do-not-contact person the form is read-only, its email and text boxes disabled, with "Do not contact is on. Clear it first to change these." (I1).
- **Edit a contact:** a job title field; one toggle per chapter (Montreal, Toronto), which adds or removes the person's chapter row by hand; and, for HR and admins only, the birth date.
- **Email settings:** the "Fundraising without consent" switch is gone. The rule is written once: "Newsletters, fundraising and volunteer emails go to everyone with a working address who has not unsubscribed. Receipts and confirmations go to any working address." The Sends composer's kind help lines say the same, and the composer shows "{n} of them have never had an email from Welfare Avenue: send them as a separate Send" when mail-send's check reports first contacts (that number comes with wave282).
- **Your apps:** Marketing also has the CRM; Toronto also has the Volunteer Manager. The Volunteer Manager tile reads "Servings and events in Montreal and Toronto": wave274 (one app, live 06/11/26) already names both cities, so at the integration onto the live page (Task 8) its blurb and the rail's own line (`line`) were kept and this wave's wording was dropped.
- **Smaller fixes:** Leaving Keela counts published forms (it looked for a status the forms never have); Sources names every source the CRM has today (CABM, Drive 2020-2023, Je Bénévole (FCABQ), By email, Website account, Hub form); "What joins next" says gifts from Keela, not Zeffy; the CRM tour uses the one rule and says who records gifts. `amAdmin()` on the CRM and in the Studio means role admin only (the three hard-coded addresses are gone).
- French: Sends is Envois, Imports is Importations, Do not contact is Ne pas contacter.

## What it changes

**Database** (`build/data/wa283_page.sql`, needs wave281):
1. `crm_donations`: the three write policies (`crm_donations_staff_insert`, `crm_donations_staff_update`, `crm_donations_admin_delete`) are replaced by `crm_donations_gifts_insert`, `_update` and `_delete`, each `is_wa_staff() and wa_can('gifts_edit') and coalesce(wa_page_ok('crm'), true)` (the CRM page lock stays, so a lead or a finance person whose profile leaves the CRM out cannot write gifts through the API). Reading is unchanged.
2. `trg_wa283_gift_audit` (function `wa283_gift_audit`, security definer): one `change_log` row for every gift recorded, changed or deleted: `entity_type crm_donations`, `entity_id` the gift id, `field gift`, the amount, date (Toronto), kind, campaign and contact before and after as JSON text, `changed_by` the signed-in email or `system`. A receipt number written on a gift counts as a change too.
3. `crm_receipt_issue`, `crm_receipt_replace`, `crm_receipt_cancel`: the admin check becomes `wa_can('gifts_edit')` ("Only team leads, admins and finance can ... a receipt."). Exact anchor, as wave273 and wave281 did.
4. `crm_receipt_config` and `crm_receipt_doc` also return `can_issue` (`wa_can('gifts_edit')`; the service role too for the doc). `is_admin` stays.
5. Three `hub_i18n` rows. "Send" already has a row (Envoyer, the verb every Send button uses), so it is left alone.
6. One release line in `change_log`.

**receipt-pdf v3** (`fn/receipt-pdf`, not deployed): `render` follows `can_issue` instead of `is_admin`. It reads `is_admin` only while the database is older than wave283, so v3 is safe before the SQL lands and after its undo.

**The page** (parts 152, 153, 202; segments regenerated by `assemble.py`): `openCrm` loads `wa_my_caps` first (a busy state, then the page; `{}` on an error), `can(cap)` reads it, and `window.w152` exports `can` and `caps`. Every change listed above for staff.

## Files

- `build/data/wa283_page.sql`, `build/data/wa283_undo.sql`
- `test/w283schema.sql`, `test/w283sql.sql`, `test/w283sql.mjs` (PGlite), `test/w283live_before.sql`, `test/w283live.sql`, `test/w283live_undo.sql` (run on live only inside `build/sql_rollback_test.py`'s block)
- `fn/receipt-pdf/serve.ts`, `build.py`, `index.ts` (rebuilt)
- `build/parts152/a_head.js`, `c_list.js`, `d_sheet.js`, `e_dupes.js`, `e_gifts.js`, `f_wire.js`, `g_email.js`, `h_campaigns.js`, `k_gifts.js`, `m_receipts.js`, `n_keela.js`; `build/parts153/a_head.js`; `build/parts202/a_head.js` (and `i_editor.js`, see Worth knowing); `build/src/152_wave152.seg`, `153_wave153.seg`, `202_wave202.seg`
- `test/w283drive.js` (new), `test/stub_supabase.js`, and the assertions in `w152drive.js`, `w153drive.js`, `w154drive.js`, `w155drive.js`, `w156drive.js`, `w157drive.js`, `w159drive.js`, `w160drive.js`, `w202drive.js`
- `docs/DATA_MODEL.md` (regenerated), `docs/EDGE_FUNCTIONS.md`, `docs/HUB_RELEASE_CHECKLIST.md`, this document

## Checks

- **Offline SQL:** `node test/w283sql.mjs` passes (79 runner checks, the assertion script three times). The fixture holds the live text of the five receipt functions, checked against the live md5 of each, and the four live `crm_donations` policies. It proves: the migration twice (the second run changes nothing), the assertions as a member, a named finance person (`hub_roles.caps`), a team lead, an admin, HR, a blocked person, the service role and nobody signed in; the undo twice (every function, comment, grant and policy back exactly); the migration again after the undo; that the file stops without wave281 and stops on a moved anchor, keeping nothing; and the three live check files. `node test/w281sql.mjs` still passes.
- **Live rollback checks** (`build/sql_rollback_test.py` at 79a1de8, run through the Supabase connector on 06/11/26; everything rolled back each time):
  1. wave281, the before snapshot, the migration twice, the live checks: **ROLLBACK_OK.** The checks signed in as a real member, team lead and admin picked inside the database (never printed): a member was refused a gift insert by row security and changed or deleted nothing; a team lead recorded, changed and deleted a gift on an invented contact; the member with caps gifts_edit (this transaction only) recorded one; the four gift log rows carried the brief's JSON and the team lead's email; no real gift changed; `crm_receipt_config` and `crm_receipt_doc` said `can_issue` right for each person; a member's receipt issue was refused with the new words.
  2. wave281, the before snapshot, the migration, the undo twice, the undo checks, the migration again, the live checks: **ROLLBACK_OK.** The undo put back all five functions (md5, comment, grants), the four policies and the triggers exactly, and removed the trigger function and the three words.
  - A read-only check afterwards found live as before: the five function md5s, the four old policies, no wave281 or wave283 object, no release line, no test contact.
- **receipt-pdf:** `index.ts` rebuilt with `build.py`; `node --experimental-strip-types --check` on a copy passes (no Deno on this PC).
- **The page:** the branch at 3b2fa5e rebuilt the live page exactly (md5 `0b8e0fa61570538acc811b319c47909b`, all LF). The candidate is **`dac9bf9d24c44c9ea8d8f090f5085ccd`, 7,996,879 bytes** (228 segments, LF), `check_remaps.py` clean. Against live it differs only in the three regenerated segments: 247 lines added and 62 removed, exactly the 152 (241/57), 153 (5/4) and 202 (1/1) segment diffs. The three segments pass `node --check`.
- **Drive tests** on the final candidate: `w152drive` 68, `w153drive` 45 of 46, `w154drive` 30, `w155drive` 22, `w156drive` 26, `w157drive` 26, `w158drive` 23, `w158bdrive` 25, `w159drive` 12, `w160drive` 39, `w161drive` 21, `w176drive` 14, `w185drive` 16, `w191drive` 39, `w191board` 9, `w202drive` 88, `w279drive` 113 and the new `w283drive` 43: 659 passed, 1 failed. The one failure is w153's "it stays in view at the foot of the menu", which fails the same way on the live page with this PC's browser (a window-height quirk, not this wave).
- **The CRM tour** (`test/tour1.js crm`, run with this PC's browser): the same six steps highlighted on live and on the candidate, step by step.

## Release steps (on Steel's yes)

1. wave281 is released first (its own document). wave283's SQL stops at the top without it.
2. Run the rollback check once more on the morning's data, at the pushed commit: `python3 build/sql_rollback_test.py <sha> build/data/wa281_rules.sql test/w283live_before.sql build/data/wa283_page.sql build/data/wa283_page.sql test/w283live.sql`, then the undo cycle (`... wa283_page.sql wa283_undo.sql wa283_undo.sql test/w283live_undo.sql wa283_page.sql test/w283live.sql`). Once wave281 is live, leave `build/data/wa281_rules.sql` out of both lists (`test/w283live_before.sql` first). Both must answer ROLLBACK_OK.
3. Claude applies `build/data/wa283_page.sql` through the Supabase connector, fetched inside the database at the pushed commit. Check: the four `crm_donations` policies (read plus the three `gifts_` ones), `trg_wa283_gift_audit`, the five functions' md5 changed, the three words, the release line.
4. Deploy receipt-pdf v3 with `build/fn.py` or the one-line stub pinned to the pushed commit (after step 3).
5. Publish the page through the gated pipeline (`docs/HUB_RELEASE_CHECKLIST.md`): the candidate is `build/candidate.html` built from this branch (md5 in Checks), and the live md5 must match it afterwards.
6. Live checks, signed in as Steel: the rail says Sends; Record a gift is there; a contact shows the Do not contact section; Edit shows the chapters and the birth date; Email settings has no fundraising switch; `wa_my_caps()` gives all three. Then, with a team lead's account if one is at hand, Record a gift is there and the receipts settings are not.
7. Add the release record to this document and commit `build/candidate.html` with it.

## Undo

1. Put the page back: the previous segments `152_wave152.seg`, `153_wave153.seg` and `202_wave202.seg` (the commit before wave283's page commit), rebuilt and published through the gated pipeline; the live md5 goes back to `0b8e0fa61570538acc811b319c47909b` if nothing else changed.
2. Redeploy receipt-pdf v2 (the commit before wave283's receipt-pdf commit). v3 also works on the old database, so this can wait.
3. Claude runs `build/data/wa283_undo.sql` through the connector: the five receipt functions and the three old policies back exactly as live had them on 06/11/26, the gift audit off, the three words removed, an undo line. The gift log rows already written stay.
4. Run wave283's undo before wave281's undo, never after (the gift policies call `wa_can`, which wave281's undo drops).

## Worth knowing

- **Order.** wave281 before wave283 (the SQL refuses to run without `wa_can`, and the page reads `wa_my_caps`; without it nobody, admins included, would see the gift controls). The SQL before receipt-pdf v3 and the page; undo in the reverse order, and wave283's undo before wave281's.
- **Email it stays with admins.** Part A.9 says emailing a receipt needs `gifts_edit`, but mail-send's `receipt` action checks admin, and mail-send is not in this phase's files. So the page shows Email it to admins only, and team leads and finance issue receipts that an admin emails. Changing mail-send is a small follow-up for Steel to decide on. The receipt settings, the mode switch, the signature and the automatic switch also stay admin-only, because their functions and the storage policy check admin; the design names lines 66 and 81 of `m_receipts.js`, which hold those controls, but making them follow `can_issue` would show team leads buttons the database refuses.
- **"Send" in French.** The design's item 12 asks for Send as Envoi, but live already has Send as Envoyer, which every Send button uses. The design's French section lists only Sends, Imports and Do not contact, so wave283 seeds those three and leaves Send alone.
- **The contact's permission line still says the old rule.** "Newsletters and appeals: yes or no (why)" on a contact's page and the Sources permission counts still follow express or implied consent, while the database (wave281) and the rule card now follow "not unsubscribed". Neither was in this phase's list; the Profile document is the natural place, or a one-line follow-up. The Reports tab still says "campaigns" for Sends in two sentences, for the same reason.
- **The gift log** writes a row for every gift change, the receipt number a receipt writes on a gift included. If wave281's migration were ever run again after wave283, its campaign backfill would log a row for every gift it touches.
- **parts202 drift.** `build/parts202/i_editor.js` still had `costsHtml()` in the editor view, which the live segment never shipped, so `assemble.py` did not rebuild live. It was fixed first (its own commit), so the 202 segment diff is wave283's one line.
- **Test support.** `test/stub_supabase.js` answers `wa_my_caps` from the fixture's `hub_roles` row (all three for an admin, `gifts_edit` for a team lead or a caps row, `{}` for a member) and lets a test choose one table's write answer (`window.__WA_TABLE_RESULTS`). The drive tests ran here with the main repo's Playwright (`NODE_PATH` to `hub-repo/test/node_modules`, `WA_CHROME` to this PC's Chromium).
