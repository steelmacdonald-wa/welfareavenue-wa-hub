# 07/10/26 - wave216: Join our team on the website

Steel, 07/10/26: "I'd like for individuals to also have a spot to apply to join our team on the website. It should be a form built through the CRM that links new applicants to the applications section of the hr center." His answers: open positions plus a general application; the CV required; publish once the tests pass.

## What shipped
- **The form:** CRM > Forms has a new kind, "Join the team (HR centre)", and two question types for it: The open positions (live from the HR centre: Posted or Interviewing, serving roles excepted, plus a general application) and A file (the CV). The forms `join` (English) and `rejoindre` (French) are live.
- **The website:** welfareavenue.com/join/ and /fr/rejoindre/ (also /careers, /jobs, /fr/carrieres, /fr/emplois): why join, the open roles (each with "Apply for this role", which picks it in the form), how it works, the form, and a pointer to the Sunday volunteer form. Linked from the footer and the volunteer page. hub.welfareavenue.com/f/join works too.
- **Into the HR centre:** each application is a New card in Applications (source website) with the role, the CV (private, read by the CV reader), links, why and hours. The CRM keeps the contact and the timeline. A second application for the same role within 90 days adds to the open card.
- **Database:** migration wa216_join (crm_forms kind application, crm_form_uploads, wa216_open_positions(), crm_form_apply step 7b). form-submit v6.

## Checks
- test/w216join.js: 34/34 (the page, roles, validation, upload, a failed upload, French, phone width, the Hub page). w162www 779 passed (the 5 failures are photos missing from this workspace, the same before the change), w194www 110/110, w152drive 68/68, w156drive 26/26, w211drive 34/34.
- Live: a made-up application through welfareavenue.com/join/ landed on the board with its CV (card 116, marked practice; card 115 was the test-mode one). Clear practice on Applications removes both.

## Live
Hub 41f9ee39; website deploy 6ac6606e (26 files).

## wave216b-d (07/10/26, same day)

- Copy: team roles take between 4 and 8 hours a week, flexible around work and school (EN/FR on /join and in the form).
- Leadership note: only on the form, shown only while a leadership role is picked (form-submit v7 `lead`/`lead_note`; forms.js and the Hub's /f page). The static note on the roles list was removed.
- Job descriptions: linked on /join's roles list, on each option of the form, and on each card in HR centre > Positions (Drive file), with "The PDF applicants see" in the position's sheet. PDFs are published by recruit-actions jd_publish into content-images/jobs/.
- Rebranded JDs (no VCSA), new Google Docs in each role's Drive folder: HR Technician (new), Co-Director of Marketing, Operations Manager, Logistics Manager (same text as Operations Manager, retitled, per Steel), Content Manager (6-8 hours kept from its original). Source: build/data/jd216/make_jds.py. The older JDs move to Older JDs through jd-drive.
- Tests: test/w216join.js 45 checks (JD links, the note hidden until a leadership role is picked, both pages); test/w199drive.js 61 checks (JD link on the card and the PDF in the sheet).
- Migrations: build/data/wa216c_jd_public.sql, build/data/wa216d_jd_hold_leadership.sql.

## wave216f (07/10/26): JDs checked against wa-brand v1

- Only the five brand colours: cream page (#FFFAF2), dark green band, fact labels and borders (#103F39), purple subtitle (#6F64AB), gold accents (#DCA527), Ground body text (#1F201E). The off-palette sand, grey and border colours are gone.
- Headings are set in uppercase text (Google Docs ignores CSS text-transform). The overline is Space Grotesk Bold; sub-heads are Space Grotesk Regular, set as styled paragraphs because Docs bolds h3.
- Docs' HTML import only renders Regular or Bold, so H1/H2 are Barlow Condensed Bold, not the brand's Medium. Medium would need a manual font change in each Doc.
- The import sometimes drops the brand fonts and leaves a Doc in Arial (3 of 5 on the first try). Check each new Doc's fonts with a PDF export (pdffonts) before relying on it; re-uploading fixed it. The faulty uploads are in Drive's trash.
