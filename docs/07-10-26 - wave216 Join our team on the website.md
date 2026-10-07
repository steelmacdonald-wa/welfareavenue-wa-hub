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
