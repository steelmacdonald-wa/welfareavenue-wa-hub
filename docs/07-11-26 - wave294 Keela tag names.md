# wave294: Keela tag names (built 07/11/26, not released)

Hub CRM, Contacts filters and Keela data (design `05 Contacts filters and Keela data - design.md`, "Wave 294"). Built on 07/11/26 on its own branch (`wave294-keela-tags`), on top of wave281 (the CRM rules in the database) and wave284 (the Import page). It is database only: no page, no edge function. Nothing is live. Release waits for Steel's yes, and wave284 must be live first.

## What changes for people

- **Keela's tag names become the Hub's tag names.** When batch 7 (participation) of the Import page runs on a fresh Keela export, a contact tagged "Volunteer Server" in Keela gets the Hub tag `server`, not a second tag called "Volunteer Server". The same goes for every Keela tag seen on contacts: "Volunteer Cook" is `cook`, "Monthly Newsletter Subscriber" is `newsletter`, "Volunteer Driver New" is `driver`, "Reoccuring Volunteers" is `recurring volunteer`, "WA Team Applicants" is `team applicant`, "Donated Essential Items" is `donated items`, "Program Event Collaboration" is `program collaboration`, "Trajet Volunteers" is `trajet volunteer`, "WA Admin" and "WA Admin 2026" are `wa admin`, "Team Leader Volunteer" is `team leader`, and so on. A tag the contact already has is not added again, whatever its capital letters, and two Keela tags that mean the same Hub tag add it once.
- **Donor tags are kept.** "Donor", "Past Donor" and "Reoccurring Donor" used to be skipped by the import. They now come in as `donor`, `past donor` and `recurring donor` (Steel wants donor tags).
- **Campaign and Toronto tags work as before.** Rally Paper Participant, Flag Football 2025 and 2026 Gift Basket Volunteer still go to their Campaigns; Toronto Contacts and Toronto Volunteers still put the person in the Toronto chapter. "Welcome Series Exit #1" is still skipped: it marks an automation in Keela and is not a tag.
- **Finding people by Keela's names.** A small read-only list, `crm_tag_aliases()`, pairs each Keela name with its Hub tag ("volunteer server" with `server`). The filters on the Contacts page (wave295) and search will use it, so typing a Keela name finds the Hub tag. Nothing on the page changes in this wave.
- **An admin's own edits to the tag map are safe.** If someone changed an entry of the map (Import page settings) after wave284, the release leaves that entry alone and only adds the entries that are missing.
- **Nothing happens to contacts by itself.** The release changes no contact. Tags are added only when someone runs batch 7 on the Import page, on Steel's yes for that batch.

## What was built

**Database** (`build/data/wa294_keela_tags.sql`, needs wave284; stops at the top with a plain message without it, and also stops if `wa284_w_participation` is no longer the text wave284 left):

1. `public.wa284_w_participation` replaced. The one new branch: a map entry `{"tag": "<hub tag>"}` adds that Hub tag to the contact when it is not there yet (case-insensitive), and once per contact when two Keela tags name the same Hub tag. The tag goes through the same path as the old `tags[]` additions, so the change records and the batch's Undo behave exactly as today (adds only; Undo puts the tags back). The new text is wave284's text with three lines added (the test proves this line by line); the comment says wave294 changed it. Grants unchanged (service role only).
2. `app_config` `keela_tag_map`: the full map (32 entries, Keela's capitalised labels as keys; the writer matches them case-insensitively). If the value still equals wave284's default, it is replaced by the full map. If an admin changed it, only the keys it does not have yet are added (compared without regard to case) and no existing entry is touched. A map that is not readable JSON, or not an object, is left alone with a notice. The value before and after is written to `change_log` (entity `release`, id `wave294`, field `keela_tag_map`) so the Undo can put it back.
3. `public.crm_tag_aliases()` returns `(alias, tag)`: the map's `tag` entries, lower-cased, one row per pair, in alias order, 26 rows with the standard map. Entries that go to a campaign, a chapter or skip give no row. Security definer, stable, search path pinned, executable by signed-in users only (revoked from public and anon), with a comment.
4. One release line in `change_log`. A comment on every changed or new object.

**The map** (key in Keela → Hub tag): Donor `donor`; Past Donor `past donor`; Reoccurring Donor `recurring donor`; Volunteer Server and Server `server`; Volunteer Cook `cook`; Monthly Newsletter Subscriber `newsletter`; Volunteer Driver New `driver`; Reoccuring Volunteers and Reoccurring Volunteers `recurring volunteer`; WA Team Applicants `team applicant`; Donated Essential Items `donated items`; WA Admin and WA Admin 2026 `wa admin`; Volunteer Applicant `volunteer applicant`; Program Event Collaboration `program collaboration`; Trajet Volunteers `trajet volunteer`; Photographer `photographer`; Workshop Opportunities `workshop opportunities`; Partner `partner`; Corporate Fundraising `corporate fundraising`; Team Leader Volunteer `team leader`; Drop-Off `drop-off`; Pickup `pickup`; Pending Location Check `pending location check`; Location Approved `location approved`. Kept as wave284 had them: the three Campaigns, the two Toronto chapter tags, the skipped Welcome Series Exit #1.

## Files

- `build/data/wa294_keela_tags.sql`, `build/data/wa294_undo.sql`
- `test/w294sql.sql` (assertions), `test/w294sql.mjs` (PGlite runner), `test/w294live.sql`, `test/w294live_undo.sql` (run on live only inside `build/sql_rollback_test.py`'s block)
- this document

## Checks

- **Offline SQL:** `node test/w294sql.mjs` (loads waves 281 and 284, then wave294). It proves: the assertions fail before the migration; the migration twice (bodies, grants, comments, the map and the change log identical after the second run); the writer differs from wave284's by exactly the three added lines; the assertion script three times (twice before the undo, once after a fresh migration); the undo twice (wave284's writer back byte for byte with its comment, the map back as text, the function gone, one undo line); a migration again after the undo; a rename entry adds the Hub tag and never the raw Keela label; an existing tag is not duplicated (`Server` and `server`; `donor` and `donor`); two Keela tags for one Hub tag add it once; donor tags land as `donor`, `past donor` and `recurring donor`; the 18 renames for one person; the unmapped label still goes in under its own name; the Toronto chapter still works; the batch's Undo puts the tags back; a map an admin changed is not overwritten (case-insensitive key match, absent keys added, the before value recorded, the Undo restoring it); a map changed after the migration is left alone by the Undo; an unreadable map is left alone; the aliases (26 pairs, lower case, ordered, no campaign, chapter or skip entries, follow an admin's entries, none for an unreadable map); anon cannot run `crm_tag_aliases`, signed-in users can, and the batch 7 writer is still closed to both; the migration stops without wave284 and on a writer whose anchor line moved, keeping nothing; and the two live check files pass offline in one transaction each.
- **Live rollback checks:** not run yet. Run them at the pushed commit before the release (see step 2 below).

## Release steps (on Steel's yes)

1. wave284 must be live (the file stops at the top without it). Order: wave284, then this one. Nothing else depends on it until wave295.
2. Run the rollback check at the pushed commit, with whatever of waves 281 to 284 is not yet live in front: `python3 build/sql_rollback_test.py <sha> build/data/wa294_keela_tags.sql build/data/wa294_keela_tags.sql test/w294live.sql`, then the undo cycle `... build/data/wa294_keela_tags.sql test/w294live.sql build/data/wa294_undo.sql build/data/wa294_undo.sql test/w294live_undo.sql build/data/wa294_keela_tags.sql test/w294live.sql`. Both must answer ROLLBACK_OK. (`test/w294live_undo.sql` expects the map to have held wave284's value when wave294 went on.)
3. Claude applies `build/data/wa294_keela_tags.sql` through the Supabase connector, fetched inside the database at the pushed commit (pinned by commit, as the runbook does for the other waves). The md5 of the fetched text is compared with the file's md5 before it runs; it is never pasted.
4. Check afterwards (read-only, no names, emails, phones, addresses, notes or birth dates): `keela_tag_map` holds the full map (or the admin's entries plus the new keys); `crm_tag_aliases()` answers 26 rows for the standard map; `wa284_w_participation` has the rename branch and its comment says wave294; anon cannot run `crm_tag_aliases`; one `wave294` release line and one `keela_tag_map` record in `change_log`.
5. No page and no edge function go out with this wave.
6. Then, outside the wave and on Steel's yes for each batch: compare batch 7 on a fresh Keela export, report to Steel, Apply on his yes.
7. Add the release record to this document with the md5 of the applied file and commit it.

## Undo

1. If batch 7 was already applied with this wave and the tags should go, use that batch's own Undo on the Import page first (it removes the tags it added).
2. Claude runs `build/data/wa294_undo.sql` through the connector: wave284's `wa284_w_participation` and its comment come back exactly, `keela_tag_map` goes back to the value wave294 replaced, only if the map still holds wave294's value (otherwise it is left alone and a notice says so), and `crm_tag_aliases()` is dropped. Two `change_log` lines record it. Safe to run twice.
3. Tags a batch already added stay unless that batch is undone. If wave295 is live and uses `crm_tag_aliases()`, take wave295 out first (its filter then simply finds no Keela names).

## Worth knowing

- **Toronto Volunteers is a chapter, not a tag.** The design's Hub-tag list names `toronto volunteer` for it, but the instruction for this wave is to keep wave284's entries exactly, so Toronto Volunteers and Toronto Contacts stay chapter entries and give no alias. If Steel wants the tag `toronto volunteer` as well, that is a one-line change to the map entry in a later wave (the writer takes one action per entry).
- **A rename entry beats nothing.** An entry is read in this order: skip, campaign, chapter, tag. An entry with more than one of these does the first. `crm_tag_aliases()` leaves out any entry that goes to a campaign, a chapter or skip.
- **An admin's map keeps its entries even where they differ from wave294's.** For example, if an admin kept `Donor` as skipped, it stays skipped; the release only adds keys the map does not have.
- **The map is a text setting.** `app_config.value` holds the JSON as text; the migration compares and merges it as JSON, so spacing and key order in an admin's copy do not matter.
- **Line endings on this PC.** Git checks files out with CRLF here; `test/w294sql.mjs` reads every file as LF, so it passes either way. The undo's copy of wave284's body is taken from the LF text.
