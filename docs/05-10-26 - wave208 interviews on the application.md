# 05/10/26 - wave208: interviews on the application, reviewed against the JD and the MCC framework

Live md5 bf7fd829b7275a6726b1f14b6cf25790 (on wave207's 10204c41).

## What Steel asked (05/10/26)

> "Okay when an interview comes in through the transcript archive it should be linked to the applicant's profile to view the interview. It should also fill in the strengths, weaknesses and insights from the interview. It should also compare the interviewee's answers to the job description and the MCC framework on hiring"

## How it works

- **Linking.** A transcript whose title says Interview (or Entrevue, Entretien) is an interview. When it lands in the archive (or is retitled), the trigger trg_wa208_interview asks interview-review to match it to an application by name: the full name in the speakers or the title, or first and last name, or the first name, with a bonus when the position's title is in the title. Only one clear best match (full name, or first and last name) links by itself. Anything less sure waits in **Interviews to link** on the Applications board, with who it could be, to link by hand or mark "Not an applicant". A sheet at Interview with no interview offers "Link an interview from the archive". Cron wa-interview-review (jobid 92, :07 and :37) catches anything missed and retries.
- **The review.** Once linked, the interview is read by the model router (task interview_review: Sonnet 5 first) with the position's JD from the HR drive (Google Doc or Word; a PDF JD is not read and the sheet says the review compared with the title only) and the MCC hiring framework from the CMP X WA National Expansion Manual: the nine qualities (quick learner, self-starter, experience, intelligence, integrity, energy, problem-solver, vision, referrals), the profile for the role's level (Board, C-Suite, Directors and below, Chapter President, Chapter VP, Brand Ambassador) and the five recruitment philosophies. The manual has no figure for Directors and below, so that level uses philosophies 3 and 5: integrity, intelligence, energy and the ability to learn. The level comes from the position (board department: Board; Chief, Executive Director, Chair: C-Suite; otherwise Directors and below) and can be changed on the sheet, which reviews again.
- **On the sheet.** A button at the top ("The interview and its review (JD 3/5, MCC 3/5) ↓") jumps to the Interview section: the title and date, Read the interview (the transcript, loaded when asked), The recording, Review again, Unlink; then the summary, strengths and weaknesses (each with its evidence), insights, against the job description (each requirement: Strong, Partly, Gap or Not covered, with evidence, and a 1 to 5 fit), against the MCC framework (the level, the nine qualities with dots, the level's ones first and marked, "Not covered" when the interview did not show it, the profile score from the level's qualities), the recruitment philosophies, what to follow up, and a suggested next step. "A suggestion from the transcript: the decision stays with the hiring team."
- **On the board.** Cards say "Interview reviewed · JD 3/5 · MCC 3/5", "Interview linked", or "(review failed)".
- **Fairness and privacy.** The prompt tells the model to leave out and never weigh protected characteristics, and to treat the transcript and JD as data. hub_candidate_interviews can only be read by staff who can also read the transcript itself (its board-only, leadership and speakers-only rules carry over). The review is stored on the row, not written into the applicant's notes.

## First run (05/10/26)

Three interview transcripts in the archive: Alyx - Event Coordinator Interview linked to Alyx Denison (full name and the position) and reviewed (Sonnet 5; JD 3/5 from the Event Coordinator Google Doc; MCC 3/5 for Directors and below). Rim - Accountant Interview and Daniela Second Interview have no application in the Hub, so they wait in Interviews to link.

## Data

hub_candidate_interviews (transcript_id unique, candidate_id, status linked / unmatched / not_applicant, match_how, match_note, suggestions, level, level_set, analysis jsonb, analysis_status pending / running / done / failed, analysis_error, analysis_model, analysed_at, jd_read, linked_by). ai_routes interview_review. Migrations wa208_interviews, wa208b_interview_trigger. build/data/wa208_interviews.sql.

## Tests

test/w208drive.js 35 checks (the card, the bar, the sheet's review, escaping, Read the interview, Review again, the level, Unlink, a failed review, linking from the sheet and from Interviews to link, Not an applicant, a phone, no interviews). Regression on the shipped build: w181 61, w193 44, w196 52, w197 99 (alone; the discipline check is the known parallel-run flake), w198 20, w199 58, w200 49, w201 39, w205 91, w206 134, w207 118.

## Open

- The vault's SUPABASE_ACCESS_TOKEN is no longer accepted (fn-deploy got 401), so functions were deployed through the Supabase connector instead. A new token in the vault puts build/fn.py back to work.
- A .docx JD is read from its XML; none of the interviews so far had one, so that path is untested live.
- Rim and Daniela have no application in the Hub: add them (or mark Not an applicant) from Interviews to link.
