# 07/10/26 - wave218: Volunteer instead (HR centre to the Volunteer Manager)

Steel (07/10/26): "sometimes when we call applicants, they ended up wanting to just do volunteer work on like hands on, like cook, server, driver, team leader, team community lead and all those roles. So I want the ability to send applicants that come in through the HR center over to the volunteer manager whenever an applicant says that they want to do something outside of the management team."

His choices:
- **The card:** closes as Volunteering, kept with a link to their volunteer record.
- **Servings:** optional in the same step; picked servings put them on the roster as Waiting for response, with no text.
- **Handoff:** nobody is notified (no Request, no Slack, no text); they appear in Volunteers and Applicants received.

## In the Hub

- Every open card's sheet (HR centre > Applications) has **Volunteer instead**. A card for a volunteer role keeps wave209's wording ("Cook is a volunteer role") and its **Move to the Volunteer Manager** now opens the same step, with that role ticked. The stage row has a **Volunteering** stage; clicking it opens the step instead of moving the card.
- **The step:** what they would like to do (Cook, Server, Driver, Team leader, Community lead, Community welcome, Photographer, Dishes; at least one), the next six servings (a serving titled TEST is left out), a note for Operations. Move to the Volunteer Manager.
- **Afterwards:** the card shows "Volunteering: Cook, Driver", with Their volunteer record and Applicants received; its Next line says Operations welcomes them from Applicants received. The board's closed list counts volunteering. The Volunteering stage is green, not the red of Declined.

## In the database (wa218_to_volunteer)

- The person goes through `wa209_volunteer_apply`: found by email, then phone, in the volunteer directory, or added (one record with the CRM); roles merged, tags (volunteer applicant, hr centre, applied YYYY-MM), the Review flag, a CRM timeline entry, and an application in Applicants received (To handle) reading "Cook, Driver (instead of Operations Manager)", with the CV, the note and what they wrote.
- Servings picked (upcoming, not cancelled or completed): a roster row Waiting For Response in their first role, `detail.source` hr; a row they already have is left alone; change_log per serving; the serving's steps tick themselves. Nothing is texted.
- The card: status `volunteering`, `close_reason` "Volunteering: ...", new column `hub_candidates.volunteer_id`. The stage trigger (wa210_stage_moved) does not fire for volunteering, so nothing reaches Slack.
- Practice cards (Avenue Academy walkthroughs) only close; nothing reaches Volunteers, the CRM or a roster.
- Staff only. Tried as Steel in a rolled-back block: a new volunteer record (Cook, Server, Review on), application 64 To handle, a Waiting For Response row on 11/10, the card closed, no text queued.

## Pieces

- Migration `wa218_to_volunteer` (build/data/wa218_to_volunteer.sql).
- Hub: build/parts218/a_vol.js into src/218_wave218.seg (MANIFEST before 164); hooks in parts197 (CLOSED, moveTo, the closed list, NEXT, the tour), parts209 (sheetBits and moveCard open the step; `wa209_move_to_volunteers`, which deleted the card, stays for the intake), parts211 (volunteering is a closed stage).
- Tests: test/w218drive.js 27; test/w209drive.js updated (34); w197 100, w199 61, w211 34, w215 47.
- Live: Hub md5 bd732998ee25d49b2f22c05d04c33403, gated over 87d836eb with host-sync.
