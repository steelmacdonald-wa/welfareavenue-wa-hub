# 03/10/26 - wave199: positions, job descriptions and CVs from the HR drive

Live md5 f2f3e08c42243f0b19c04b2fba3d698c (wave199e calls and bulk, on wave199d's d03a9d7c, on wave199c's ba741e64 (grades), on wave199b's cef66f5a, on wave199's 8e07cca7, on wave198's 4b608fb4).

## What Steel asked (03/10/26)

> "Could you pull from [ClickUp's Recruitment list] to get a list of the positions that are in the recruitment process. I'd also like for you to add other positions with JDs from the human resources shared drive, I'd also like to add CVs that are linked to current positions like Ahmed who started as a volunteer relations coordinator to Operations manager. The job descriptions / positions title should be properly linked to the applications module where we can see the pipeline of recruits. And we should be able to upload CVs to a folder in google drive ... by department ... a folder for all the resumes, a single file that is the latest version of the job description of the position, and a folder of older job descriptions ... Could you please reorganize that folder of the shared drive and make these helpful changes to the hub."

His choices: the Hub's eight departments; CVs already in the shared drive moved, Valex's own CVs folder copied (then, mid-way: "No go for the copies from Valex's folder", so nothing was copied from it); positions open in the Hub from now on, ClickUp's list imported once.

## The drive (HR shared drive, *Recruitment* > Job descriptions)

- Department folders: Executive, Board, Fundraising, Marketing, Human Resources, Program Development, Operations Montreal, Operations Toronto (the four old "J.D. - … Department" folders renamed; four new). Templates & Other stays. Unsorted Resumes for CVs with no known position.
- 47 position folders, each with Resumes, the latest JD at the top, and Older JDs when there are older versions (Outreach Assistant, Outreach Director, Director of Operations (incl. its Scope of Work), Content Developer, Writer, Co-Executive Director).
- Moved in: every JD from the department folders, Old Outreach Job Descrip., Old Positions, Volunteer Descriptions (Cook, Driver, Server) and the Writer PDF; the CVs from the old *Recruitment* > Resumes folders (Operations Manager 9, Logistics Manager 8, Roberto, Joy, Kellian, Ahmed's CV shortcut) and the loose CVs in *Recruitment* (to Unsorted Resumes). The emptied old folders are in the drive's trash (restorable). *Recruitment* > Resumes keeps one file nobody could place (CV (school version).pages).
- Not touched: Valex's own CVs folder, the "Feel free to drop your CV" form responses, Interview Questions, Offer Letters, Signed Member Contracts, Recruit Strat Docs.
- **Privacy:** *Recruitment* is shared as "Anyone with the link can comment" plus seven outside accounts. jd-drive refuses to upload or push CVs into it until link sharing is off. Raised with Steel 03/10/26.

## The Hub

- **HR centre > Positions** (build/parts199): every position by department; Hiring now (stage not Filled or Not hiring) or All positions; search and department filter; Sync with Drive; New position (makes the folder and its Resumes folder); Open in Drive. A card shows the stage, JD or No JD, older versions, CVs, open applications and who holds the role.
- **A position's sheet:** stage (Requested, Role defined, Job posted, Interviewing, Offer accepted, Filled, Not hiring), the JD and its older versions, the applications for it, the CVs in Drive (open, add to Applications, move to another position or Unsorted), Upload a CV (into Resumes, and into Applications as New), the people in the role (now and earlier; Add a person, Moved on), handled by, needed by, notes.
- **Applications:** the filter is by position; cards and the sheet show the position's title; the sheet picks the position from hub_positions by department, links the JD and the position, opens the CV in Drive or uploads one.
- A CV dropped into a Resumes folder in Drive becomes an application at the next sync (only CVs added after the position was first read; the ones there on 03/10/26 are kept on file).

## Follow-ups the same day (wave199b)

- Steel: "These recruits should link to a position in the organization whether they are filled already or not." Every application is linked (Alyx Denison: Event Coordinator, filled). A trigger (wa199_link_position) links any new or edited application whose role matches a position's title. The position list on an application shows every position, marked (filled) or (not hiring now). If the positions are still loading when the sheet opens, it waits and redraws. Steel's screenshot was from a page opened before the deploy.
- Steel: "Those in interview stage should have a day and time." hub_candidates.interview_at. Interview cards show "Interview Tue, Sep 29, 2:30 p.m." (or "Interviewed …" once past), or "No interview time" in red. Moving a card to Interview with no time opens its sheet on the day-and-time field. The Interview column is in date order. The sheet shows the field at Reviewing, Interview and Offer.
- Steel: "New applications should be added once a resume is added to the resume folder of a position." Cron wa-jd-drive-sync (jobid 90) runs jd-drive sync every 10 minutes (:02, :12, …), so a CV dropped in a Resumes folder becomes a New application within about 10 minutes. Checked live with a test file (candidate 76, now withdrawn and named as a test row; the file is in the drive's trash).

## Grades (wave199c)

Steel: "I'd like to also grade applicants and have that show as well." His choices: 1 to 5 stars; each person grades. hub_candidate_grades (one row per applicant and grader: stars, an optional why, the stage it was given at; staff-only RLS). The sheet has your five stars (the same star again clears it), a why field once you have graded, and everyone else's grades with their names. Cards show the average and how many graded (★ 4.5 (2)), gold, green at 4 and up, red under 2.5. Best graded first on the board sorts each column by the average. The applications listed on a position's sheet show it too.

## JDs from the HR Plan 2026 (Canva) (wave199d)

Steel shared the HR Plan 2026 Canva (org charts by department, proposed structures, and six written JDs). Filed as Google Docs in their position folders, the newest version, so sync moved the older JD into Older JDs: Executive Assistant, Director of Fundraising (first JD), Events Director (the Outreach Director folder renamed: the JD says "previously Outreach Director"), Program & Development Coordinator, Operations Assistant, Writer. The Canva's CFO JD and two pages are empty templates and were not filed. Edits while filing: the Program Development Coordinator's second section was headed "Sponsorship & Partnership Engagement" by a copy-paste slip in the Canva and is filed as "Community Engagement & Feedback"; the Operations Assistant's named managers (Simran, Michael) became their roles.
Fix: app_config.value is text, so jd_drive_sync is stored as a JSON string; the Positions page and jd-drive move_file (v2) now parse it ("Read from Drive …" line and moving a CV to Unsorted Resumes).

## Calls and bulk actions (wave199e)

- Steel: "We should check whether people in reviewed have been called or not." hub_candidate_calls (one row per call: outcome reached / left a voicemail / no answer / wrong number, an optional note, who, the stage, when). The sheet has Log a call (one button per outcome, with the note field) and the call history. Cards at Reviewing say "Not called yet" in red; cards at Reviewing, Interview or Offer show "Called Sep 25" or "Tried Sep 24 (left a voicemail, 2x)". The board's "Not called yet (n)" box shows only the Reviewing applicants nobody has called. There is no phone integration for calls (Quo has texts only), so calls are logged by hand.
- Steel: "the ability to select multiple applicants at a time to do bulk operations." Select on the board turns card clicks into selection (a tick, an outline; dragging is off) and opens a bar: n selected, Select all shown, Clear, Move to (any stage; Declined and Withdrawn ask first), Handled by, Position (sets position and role), Done. Each change is one update for all, logged per applicant in change_log ("… (bulk)").
- The grader and caller name comes from the roster when the session has no display name.

## Data (migration wa199_positions)

hub_positions, hub_position_files, hub_position_people (staff-only RLS); hub_candidates.position_id, drive_file_id; team_members.position_id; app_config jd_drive_sync. Seeded: ClickUp's 11 positions (stage, owner, needed by, link; the two template tasks skipped), the Hub-only roles (Operations Manager interviewing, HR Technician and Volunteer Cook posted, Event Coordinator filled), 38 applications linked by role, 28 team members linked to their position by their JD, Ahmed's history (Volunteer Relations Coordinator from 02/08/25, then Operations Manager), four staff CVs marked as the person's.

## Edge function

jd-drive v1 (verify_jwt on): sync, privacy, create_position, upload, move_file, push, apply (secret only). See EDGE_FUNCTIONS.md.

## Tests

test/w199drive.js 58 checks (incl. the interview day and time, grades, calls and bulk actions) (Positions, the sheet, Ahmed's roles, add from a CV, new position, sync, Applications filter, card, sheet and position change, the privacy warning, French, a phone, an HR member). Regression on the shipped build: w152 68, w153 46, w157 26, w164 31, w176 14, w181 61, w193 44, w196 52, w197 98, w198 20.

## Open

- Link sharing on *Recruitment* (Steel's call).
- Board JDs for President / Chair and Member at Large live elsewhere (team JD links); copy them in if Steel wants them here.
- Samson's role has no position folder or JD; HR Consultant and Recruitment Specialist have no JD yet.
- The CABM CVs (in the Hub's storage) can be copied into their Resumes folders with jd-drive push once link sharing is off.
- ClickUp's Recruitment list can be archived.
