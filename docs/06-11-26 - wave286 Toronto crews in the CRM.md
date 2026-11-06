# wave286: Toronto crews in the CRM (built 06/11/26, not released)

Hub CRM slice 1, Phase 5b, as Steel reduced it on 06/11/26. Built on 06/11/26 on branch `crm-slice1-wave286`, on top of wave281 (the CRM rules), which is built and not released. Nothing is live. Release waits for Steel's yes, and wave281 goes first.

## Why this wave is small

The design (CRM-S1 v2, items 35 to 43) planned a whole wave for the Volunteer Manager by chapter: a Montreal, Toronto or All switch, a chapter on every serving, Text a group and Find volunteers by chapter, and Toronto emails from toronto@. Before it was finished, another session released wave274 (live on 06/11/26): one Volunteer Manager for both cities, with its own Montreal | Toronto switch and Toronto's own screens. A Toronto event there is a `volunteer_events` row with kind `meal` and location `Toronto`, and its crew is added with `wa274_crew_add`.

On 06/11/26 Steel folded the design's Phase 5b into wave274's app. wave274 stays as it is. What is left for wave286 is the one thing wave274 does not do: link a Toronto crew to the CRM's Toronto chapter, so the CRM's Toronto filter finds the people who help in Toronto.

What was dropped, and why:
- **The switch, the chapter filters, the chips, Text a group and Find volunteers by chapter, and the New serving chapter (the page work).** wave274 already gives the Volunteer Manager a Montreal | Toronto switch and Toronto's own screens. A second switch would clash with it. The page work in progress was reverted (`b3796b2`).
- **`volunteer_events.chapter` and the chapter on `volunteer_event_summary`.** wave274 already tells the cities apart by kind and location. A second marker could disagree with it. A new Toronto event would have defaulted to Montreal.
- **Find volunteers by chapter (`wa191_recruit_pool` with `p_chapter`).** This went with the page work. Montreal's Find volunteers stays as it is.
- **The serving's chapter route in the email drain, and mail-send v8 (itinerary from toronto@).** Both read `volunteer_events.chapter`. Montreal's automatic emails only ever look at kind `service`, so Toronto events never get them anyway. mail-send stays at wave282's v7 (`159f702` reverts v8).
- **`wa286_volunteer_chapters`.** It was only there to feed the page's People filter.

## What changes for staff

Nothing on any page. In the CRM, someone put on a Toronto event's crew now counts as a Toronto person: the contact gets a Toronto chapter row, so the CRM's Toronto lists and filters (`crm_in_chapter`, wave281) include them. Montreal is untouched. No serving, roster row, function or Montreal chapter row changes, nothing adds Montreal, and nothing removes a chapter.

## What it changes

- **`wa286_crew_contact(detail, person)`:** finds the crew member's CRM contact. It uses the contact named in the roster row's `detail.contact_id` first (as `wa274_crew_add` writes it), then the contact whose `volunteer_id` is the row's `person_id`. It never picks a merged contact. Service role only.
- **The trigger `trg_wa286_toronto_crew` on `event_roster`:** runs after a row is added, and after a row's `event_id` or `person_id` changes. When the row's event is a Toronto event in wave274's sense, the contact joins the Toronto chapter through wave281's `crm_add_chapter`. The source is `serving` (wave281's source for being on a Toronto serving) and the source note is `Toronto crew: <event code>`. A Toronto row that is already there is kept as it was. The trigger function is security definer with an empty search path, and has no grant. If wave281 has been undone first, the trigger does nothing, so it never blocks a crew add.
- **A backfill** does the same for the crews already on Toronto events, once. It adds only people who are not in Toronto yet. On live today it adds nobody: there are no Toronto events yet (checked read-only on 06/11/26: wave274's `wa274_next_code`, `wa274_crew_add` and `volunteer_event_recipients` are live; 0 Toronto meal events; 0 roster rows on them). The release line in `change_log` records the count.
- **A crew row with status TBD counts.** `wa274_crew_add` adds crew as TBD, and being put on a Toronto crew is the evidence. Removing a crew member later leaves their Toronto row, because a chapter row is never removed.

## Files

- `build/data/wa286_vm_chapter.sql`: the migration (needs wave281; safe to run twice).
- `build/data/wa286_undo.sql`: the undo.
- `test/w286schema.sql`, `test/w286sql.sql`, `test/w286sql.mjs`: the offline proof (PGlite).
- `test/w286live_before.sql`, `test/w286live.sql`, `test/w286live_undo.sql`: the live checks, run only inside `build/sql_rollback_test.py`'s block.
- `docs/DATA_MODEL.md`: regenerated (the two new functions).

## Checks (06/11/26)

- `node test/w286sql.mjs`: **OK**, 23 runner checks plus the assertion script, run three times. It covers:
  - a crew add on a Toronto event adds the Toronto row (by `detail.contact_id`, or through the volunteer record);
  - a Montreal serving, even one held in Toronto, adds nothing;
  - running the migration twice adds nothing more;
  - a merged contact is skipped;
  - setting a person on a crew row later, or moving a row to a Toronto event, adds the row;
  - removing or moving a crew row away never removes a chapter row, and nothing adds Montreal;
  - the undo, run twice, removes only wave286's rows and leaves every earlier chapter row alone (including a Toronto row added by hand);
  - the migration refuses to run without wave281;
  - with wave281 undone first, crew adds keep working.
- **Live, in a block that rolls back** (`build/sql_rollback_test.py` at `2e9fae1`):
  - wave281, then the before file, the migration twice and the live checks: **ROLLBACK_OK** (5 files). The backfill added the expected number of people (0), every earlier chapter row was still there, and a crew add on a test Toronto event made inside the block added the Toronto row, while one on a Montreal serving added nothing.
  - wave281, the before file, the migration, the undo twice and the undo checks: **ROLLBACK_OK** (6 files). Every chapter row was back as it was, and the trigger and both functions were gone.
  - Afterwards live showed nothing kept.
- There is no page change in this wave, so there is no candidate and no drive test.

## Release steps (on Steel's yes)

1. wave281 first (`build/data/wa281_rules.sql`), with its own checks.
2. Run `build/data/wa286_vm_chapter.sql` through the Supabase connector. It may go before or after the Toronto forms wave (wave288); it needs neither wave288 nor any page release.
3. Check: `trg_wa286_toronto_crew` exists; the release line's count is the number of people on Toronto crews who were not in Toronto (0 today); add a test crew member on a Toronto event and see their Toronto chapter row in the CRM.

## Undo

Run `build/data/wa286_undo.sql`. It drops the trigger and both functions, then removes only the Toronto rows whose source note starts with `Toronto crew:`. Undo wave286 before wave281. Run the other way round, wave286's undo is still harmless, and crew adds keep working in between.

One case to know: if a person joined Toronto through a crew and later gave other Toronto evidence (a Toronto form, the import), their row still carries wave286's note, because `crm_add_chapter` keeps the row already there. The undo removes that row too, and the other evidence adds it back the next time it is applied.
