# 06/10/26 - wave209: applicants in (by hand, by email), volunteer roles to the Volunteer Manager

Live md5 627d1f09dd26dba44f18b07f0d0e1fcc (on wave208's bf7fd829).

## What Steel asked (06/10/26)

> "I also want to be able to add new applicants via the applications page. Also emails that come through the hub as an application should be added directly to the applications page. Volunteer cook, kitchen, driver, server, photographer, community lead, and team leader should be redirected to the volunteer manager to applicants received and should update both the crm and volunteers records to have that applicant a visible in our searches for volunteers"

## What was wrong with the emails

mail-pull reads hub@ (on job@ and volunteer@). CABM and VBM notifications (no-reply@yapla.org) carry the applicant only in the HTML part; the text part is a link, so mail-pull filed 27 of them as noise since July, including Jack Robertson (Operations Co-Lead), Albert Huang (Fundraising Co-Lead) and their forwarded copies. Je Bénévole emails were read, but the two volunteer cooks became Applications cards.

## Built

- **applications-intake** (edge, cron every 10 minutes, after mail-pull): reads CABM / VBM (direct, the HTML from Gmail; or forwarded) and Je Bénévole emails field by field and files each once. Volunteer roles go to the Volunteer Manager; team roles become New cards with the summary, language, pronoun and the CV copied into the Hub. A card mail-pull made for a volunteer role is moved.
- **Volunteer roles, one rule** (public.wa209_volunteer_roles): cook, cuisinier, kitchen; driver, chauffeur; server; dishes; photographer; community lead; community welcome; team leader, chef d'équipe; a general "volunteer" application. Anything with coordinator, manager, director, co-lead, assistant, designer, marketing, fundraising and so on is a team position (Kitchen Coordinator, Volunteer Relations Coordinator and Volunteer Graphic Designer stay in Applications).
- **A volunteer applicant** (public.wa209_volunteer_apply): found by email, then phone, in the volunteer directory, or added; roles and tags (volunteer applicant, the source, applied YYYY-MM) merged, last applied and Review set, the language on the contact, a timeline entry in the CRM, and the application in volunteer_applications. So the Volunteers search, the CRM and Find volunteers ("Never came") all find them.
- **Applications (HR centre)**: Add an applicant (name, email, phone, position or role, where they applied, when, what they wrote, a link). A volunteer role is said as it is typed and goes to the Volunteer Manager; anything else becomes a New card and opens so the CV can be uploaded to Drive. The same person for the same role within 90 days opens their card. A card for a volunteer role has Move to the Volunteer Manager.
- **Volunteer Manager > Applicants received** (#volunteering/applicants, rail item under People with the count, the Applicants chip): To handle (received first, then contacted), Welcomed, Not a fit or withdrawn, All; search, role and source filters; each card: roles, when and where they applied, language, email and phone, the message (More), the CV, In the CRM, In Volunteers (the directory searched for them); Contacted, Welcome, Not a fit, Withdrawn, Back to To handle, each with an optional note (who and when show on the card). Welcome, Not a fit and Withdrawn clear the Review flag once nothing else is open for that person; Welcome tags them welcomed. Add an applicant with the roles to tick. Staff only.

## First run (06/10/26)

- 61 volunteer applications in Applicants received: the 59 CABM and Je Bénévole applications imported on 01/10/26 (all To handle; the import had not set them as handled) and the two Je Bénévole cooks moved from Applications (Héloïse Dehling-Freyd, Sophie Ould Saada).
- From the missed emails since 1 October: Niloofar Bakhshaee (CABM cook) to Applicants received; Albert Huang (Fundraising Co-Lead), Jack Robertson and Mathilde Dommerc (Operations Co-Lead) to Applications with their CVs; the two forwarded copies noted on the cards ("Forwarded from hub@ to ...").
- CABM offers 01983 (Operations Co-Lead) and 01984 (Fundraising Co-Lead: Outreach and Partnerships) have no position folder yet, so the cards carry the role only.

## Data

volunteer_applications, app_intake_log; functions wa209_volunteer_roles, wa209_volunteer_apply, wa209_intake, wa209_move_to_volunteers, wa209_vol_app_status; app_config cabm_offers; cron wa-applications-intake (jobid 93). Migrations wa209_intake, wa209a_roles_text, wa209b_move, wa209c_backfill, wa209d_caller_check. build/data/wa209_intake.sql.

## Tests

test/w209drive.js 29 checks. Regression: w152 68, w176 14, w191 39, w193 44, w195 52, w197 99 (alone; the Policies and Discipline checks are the known parallel-run flake), w199 58, w200 49, w207 118, w208 35.

## Open

- Create position folders for Operations Co-Lead and Fundraising Co-Lead (Positions > New position) so those cards link to a position and a JD.
- A forwarded application's note names the forwarder (hub@ shows as "Hub Avenue"); the two from 06/10 were rewritten by hand with who it went to.
- Make sure hub@ stays a member of job@ and volunteer@.
