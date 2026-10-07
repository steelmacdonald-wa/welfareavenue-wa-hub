# 06/10/26 - wave211: stage gates, CV links, offers and still-interested texts

From the HR meeting (Steel, Valex, Samson) and Steel's follow-ups the same day. Numbered wave211 at release: a parallel session shipped the Transcript archive's tasks as wave210 first; this wave's database objects keep their wa210 names (wa210_recruit.sql, wa210_stage_moved, trg_wa210_stage, migration wa210b_call_quo_gates). Live md5 52a7f8065d83a8afc690d7a9034be46e.

## Stage gates (Steel: "enforce mandatory fields when moving them from one stage to the other")
- Reviewing: Handled by.
- Interview: + the position, a call logged (Find their calls in Quo: the last 60 days on every line, with Quo's summary; Use this call saves its summary and transcript; or log it by hand), the interview day and time.
- Offer: + their email, the interview has happened, interview impressions. The offer letter opens next.
- Hired: + the offer letter (or "The offer was made another way"), the day they accepted, the start date (not before it).
- Declined / Withdrawn: a reason (a list per stage; Other needs a note).
- Skipping stages asks for everything in between; moving back asks nothing; a complete card just moves.
- The selection bar: ready cards move, the others are listed with what each needs; closing several asks one reason.
- The sheet shows impressions, accepted and start dates, and why a card closed.

## Adding an applicant by hand
The CV's Google Drive link is required (not for volunteer roles, which go to the Volunteer Manager). The Hub checks it can open the file (not a folder, shared with hub@), then copies it into the position's Resumes folder (Unsorted Resumes without a position) and reads it. "Where do I find the link?" covers a file in Drive (Share > Copy link), an email attachment (Add to Drive), a file on the computer (upload into the Resumes folder, with a button that opens it; or skip the form, a CV dropped there becomes a New card within 10 minutes). LinkedIn or portfolio is a separate, optional field.

## Also in this wave
- Text: still interested? (the sheet at New or Reviewing, and the selection bar): the exact texts first, then send; Yes moves the card to Reviewing.
- The offer letter at Offer: Google Doc in Recruitment > Offer Letters, the PDF by email (test mode sends to the test inboxes).
- From the CV: every CV read (any file type, OCR), a profile on the card.
- Slack when a card moves to Interview, Offer or Hired (HR channel and a DM to the handler).

## Data
hub_candidates: close_reason, accepted_on, start_date, impressions (plus wave210's interest_*, offer_*, cv_*). hub_candidate_calls: quo_call_id, summary, transcript, duration. Edge: recruit-actions v2 (quo_log new). Tests: test/w211drive.js (34), w197, w199, w209 updated for the gates.

## Storage (same day)
storage-tidy moved 295 unused files into content-images/To delete/ (Videos 1.82 GB; Originals already in the photo library 378 MB; Originals not in the photo library 350 MB, the only copies; Duplicates and not for website 4 MB) for Steel to delete. Nothing deleted by the assistant.
