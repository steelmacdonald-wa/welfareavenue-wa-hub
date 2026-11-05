# wave274c brief: Toronto intake in the Hub (for one builder with no other context)

Status: **ready once wave274 is merged and Tate has sent the school list.** Read the whole brief first. Repositories:
`/home/user/welfareavenue-wa-hub` (the Hub) and `/home/user/welfareavenue-site-frontend` (welfareavenue.com; read its
`AGENTS.md` in full, its rules bind you there). Do not commit, push, deploy, apply SQL or touch any database.

## 1. The goal

Toronto volunteers register today on two Keela forms (general and student, the student one with the school). Sama reads
the answers in the admin inbox and confirms people by hand. Welfare Avenue cancels Keela by 05/12/26. Tate asked
(12/10/26): "Will this be remade in the hub, so we can distinguish Toronto volunteers on our contact system. General
compared to student, school etc?"

Deliver:
1. **Two Hub forms**, English and French: *Volunteer in Toronto* (`toronto-volunteer`, reopened) and *Student volunteers
   in Toronto* (`toronto-student`, new), plus `toronto-benevole` and `toronto-etudiant` in French. Both make a volunteer
   record (`settings.volunteer_record: true`), city Toronto, tags `toronto` (and `toronto student` for the student forms),
   so a sign-up lands in the CRM and in the Toronto app.
2. **The school question** lists only Toronto schools.
3. **Sign-ups** in the Toronto Volunteers app (`#toronto/signups`, rail People > Sign-ups with the waiting count): Sama's
   inbox of new Toronto sign-ups, newest first, each with the answers, Welcome (marks it welcomed; the email itself comes in
   wave274e, so for now Copy email and a mailto link), Called (with who and when), Add to an event (wave274's picker), Not
   for now. It reads `volunteer_applications` and `crm_form_submissions` for the four Toronto forms.
4. **The website's Toronto page** in both languages uses the Hub forms instead of the Keela embeds.

## 2. What exists (read these)

- The forms: `build/data/wa156_forms.sql:365-382` (`toronto-volunteer`, its questions and CRM fields); the Montreal
  volunteer form beside it; `crm_forms` columns `slug, title, intro, lang, kind, status, questions, consent, thank_you,
  settings, purpose, cover_photo_id`. Group: `purpose = 'volunteers'` (wave261, `build/data/wa261_drive_forms.sql:23-35`).
- The pipeline: `fn/form-submit/index.ts` (v9) and `crm_form_apply` (`build/data/wa261_drive_forms.sql:221-503`):
  `settings.city` is written on a new contact or an empty city; `settings.tags` merge in; `volunteer_record` makes the
  `volunteer_people` row and files Applicants received through `wa209_volunteer_apply`; a question with
  `source: "organizations"` and `to: "volunteer.organization"` offers `volunteer_orgs` (`on_form = true`, `status =
  'listed'`) and sets the contact's `org_id` (wave264; `form-submit/index.ts:110-116, 141, 150-151, 228-231`).
- **The gap**: `orgOpts` lists every organization on the forms (the Montreal schools and companies too). Add a city to
  `volunteer_orgs` (`city text`, null for any) in the wave's SQL, and in form-submit v10 let a question carry
  `org_city: "Toronto"` so only those (and the null-city ones only if the question says so) are offered and accepted.
  Bump the header and `fn/form-submit/meta.json`. Do not deploy it.
- The Toronto app: `build/parts274/` (wave274) and its brief `docs/toronto/wave274 brief.md` (the patterns, the data, the
  design bar in section 6, which applies here unchanged).
- The website: `site/toronto/index.html` and `site/fr/toronto/index.html`, section `id="register"`, the two cards
  `id="volunteer"` and the student card, each with Keela links and `iframe.kf-gen` / `iframe.kf-stu`. The Hub form pattern
  is `<div class="form-card" data-wa-form="volunteer" data-wa-popup="Sign up" data-wa-popup-note="...">` in
  `site/volunteer/index.html` (French: `data-wa-form="benevole,volunteer"` in `site/fr/benevolat/index.html`).
  `site/assets/toronto.css` styles the Keela frames.

## 3. The work

1. `build/data/wa274c_toronto_forms.sql` (file only): `volunteer_orgs.city`; the Toronto schools from Tate's list set to
   city Toronto and `on_form` true (TMU and the University of Toronto exist; add only schools Tate names); the four form
   rows (upsert by slug; the English ones published, the French ones published), with the student forms' school question
   `{"id": "school", "type": "choice", "source": "organizations", "org_city": "Toronto", "to": "volunteer.organization",
   "label": "Which school do you go to?", "required": true}` and the same questions as `toronto-volunteer` otherwise;
   thank-you lines in the voice of the existing ones. The French text in natural Quebec French, marked in your report for
   Steel to check.
2. `fn/form-submit/index.ts` v10: `org_city` as above.
3. The Sign-ups page in a new `build/parts274c/` wave (after 274 in MANIFEST), the rail item added the wave195 way
   (`build/parts195/z_wire.js:66-84`) or by editing `APPS.toronto` in `build/parts153/a_head.js`.
4. The website, both languages, in the same change: replace each Keela card's buttons and iframe with a Hub form card
   (`data-wa-form="toronto-volunteer"`, `data-wa-form="toronto-student"`; French `toronto-benevole,toronto-volunteer` and
   `toronto-etudiant,toronto-student`), keep every `id`, change the line "The forms are run by Keela ..." to say nothing
   about Keela, remove the Keela-only CSS from `toronto.css` only if nothing else uses it. **Leave `site/_headers` alone**
   (removing Keela from the security policy is Steel's call, after the forms are live). Run `node tools/check.mjs site`.
5. Tests: `test/w274cdrive.js` (Sign-ups for admin and plain at 1366 and 390: the list, Welcome, Called, Add to an event,
   Not for now, the rail count, no sideways scroll, no page errors) and regression `w274drive.js`, `w259drive.js`,
   `w153drive.js`. The website: the check script passes.
6. Docs: `docs/<date> - wave274c Toronto intake in the Hub.md`, an ARCHITECTURE.md entry, and a line in the plan's ledger
   is the elephant's job: put what it should say in your report.

## 4. Hand back

The files changed in each repository; the French text for Steel to check; the test counts; the website check output;
anything the elephant should know.
