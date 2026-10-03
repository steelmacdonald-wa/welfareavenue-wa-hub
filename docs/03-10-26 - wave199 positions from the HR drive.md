# 03/10/26 - wave199: positions, job descriptions and CVs from the HR drive

Live md5 cef66f5ab2143de5eaaf710a2e625b75 (wave199b, on wave199's 8e07cca7, on wave198's 4b608fb4).

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

## Data (migration wa199_positions)

hub_positions, hub_position_files, hub_position_people (staff-only RLS); hub_candidates.position_id, drive_file_id; team_members.position_id; app_config jd_drive_sync. Seeded: ClickUp's 11 positions (stage, owner, needed by, link; the two template tasks skipped), the Hub-only roles (Operations Manager interviewing, HR Technician and Volunteer Cook posted, Event Coordinator filled), 38 applications linked by role, 28 team members linked to their position by their JD, Ahmed's history (Volunteer Relations Coordinator from 02/08/25, then Operations Manager), four staff CVs marked as the person's.

## Edge function

jd-drive v1 (verify_jwt on): sync, privacy, create_position, upload, move_file, push, apply (secret only). See EDGE_FUNCTIONS.md.

## Tests

test/w199drive.js 41 checks (incl. the interview day and time) (Positions, the sheet, Ahmed's roles, add from a CV, new position, sync, Applications filter, card, sheet and position change, the privacy warning, French, a phone, an HR member). Regression on the shipped build: w152 68, w153 46, w157 26, w164 31, w176 14, w181 61, w193 44, w196 52, w197 98, w198 20.

## Open

- Link sharing on *Recruitment* (Steel's call).
- Board JDs for President / Chair and Member at Large live elsewhere (team JD links); copy them in if Steel wants them here.
- Samson's role has no position folder or JD; HR Consultant and Recruitment Specialist have no JD yet.
- The CABM CVs (in the Hub's storage) can be copied into their Resumes folders with jd-drive push once link sharing is off.
- ClickUp's Recruitment list can be archived.
