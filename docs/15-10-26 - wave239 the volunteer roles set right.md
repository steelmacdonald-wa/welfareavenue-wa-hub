# 15/10/26 - wave239: the volunteer roles set right

Steel, 14/10/26 marketing meeting: the Volunteers list's filters for photographers, servers, community leads and drivers
must work; "we should text the people who signed up as photographers to see if they are still in", and the text must say
it is Welfare Avenue; a videographer role; website photographer applicants in Applicants received; the photographer
applicant alerts go to whoever owns the photographer step in the serving SOP. Live 15/10/26 about 11:25 Toronto.

## The Volunteers list (Volunteering > Volunteers; build/src/239_wave239.seg, the final waVolRenderPeople)
- The chips are the roles in a fixed order: Everyone, Team leaders, Cooks, Drivers, Servers, Dishwashers, Photographers,
  Videographers, Community lead. A person counts for a role when it is in their roles or in their tags (the directory
  carries both: 315 servers by role, 270 by tag). The other tags (recurring volunteer, cabm, applied 2026-04, ...)
  moved behind a Tag select; a role, a tag and the search narrow the rows together. The Roles and tags column shows the
  roles in green, the tags in cream. The edit link, the review flags and the cook address and driver car columns stay.
- Still in?: with a role chip on, leaders, HR and admins see "Text: still in?". The modal lists the people shown who have
  a phone (each ticked; someone who said no is unticked), the text they will get, and the rules (French contacts get the
  French text; sent now between 9 and 19 Toronto, else at 9 tomorrow; nobody who texted STOP; nobody asked in the last
  14 days; sms_mode decides, test mode reaches the test phones only). Send calls `wa239_pool_send(role, people[])`.
- The text: "Hi <first>, it's Welfare Avenue! A while back you signed up to volunteer with us as a photographer. Are you
  still up for it? Tell us here, one tap: hub.welfareavenue.com/c/<token> (or reply YES or NO). Reply STOP to stop
  texts." (`wa239_pool_text`; the French mirrors wa171's confirmation wording). One quo_messages row a person, kind
  `reconfirm` (migration wa239_reconfirm_kind), queued like the confirmations: quo-send drains at once inside the
  window, the tick sends the rest at 9.
- The answers: the /c/ page (`wa239_pool_get` by token: a first name and the role only; `wa239_pool_answer`: Yes, count
  me in / Not any more, an optional note, a second screen that lets them change their mind), or a YES or NO reply when
  the person has no serving coming (wa171_inbound, patched in place: `pool_yes` / `pool_no`, with a thank-you text).
  The list shows a Still in? column (Yes 3 Oct, No 3 Oct, Asked 12 Oct with the text's status) and filters Said yes /
  Said no / No answer yet (`wa239_pool_list`: the latest check per person, staff only). Nothing was sent by the build.
- Data: `volunteer_pool_checks` (batch_id, person_id, role, phone, token, message_id, asked_by, answer yes/no,
  answered_at, via page/reply, note; RLS staff read). change_log: `volunteer_pool` lines for each batch and each answer.

## The videographer role
- `wa209_volunteer_apply` takes it; `wa209_volunteer_roles` reads video, film, cinema, tournage; `volunteer_role_guides`
  has a row copied from the photographer's with video wording (no spot by default: target 0); the website forms (crm_forms
  volunteer and benevole) offer "Filming video" / "Filmer des vidéos" after "Taking photos"; `crm_form_apply` rosters a
  videographer who picks a date as one. In the Hub: WA_VOL_ROLELABEL (020), the text audiences (023), the roster's role
  order (119, 119b, parts152, parts191, 234's spots), the texting roles (parts171), the sign-up form (parts218), the
  Applicants received roles and parser (parts209).

## Applicants received (build/parts209)
- The role filter lists every role with its count ("Photographer (4)"), not only the roles present.
- The website's volunteer forms (those that keep a volunteering record: volunteer, benevole, toronto-volunteer) now file
  the application too: `crm_form_apply` step 7c calls `wa209_volunteer_apply` (source website, source_ref form:<id>,
  the roles as labels, the note as the message, the form's language), never for a test and not twice in a week for
  one person. The 15 submissions of 02/10 to 15/10 were backfilled (14 applications: one person had sent the form
  twice the same day); they sit in To handle, including Steel's own test of 02/10.

## Photographer applicants alert the SOP's photographer owner
- `wa239_photo_owner()`: the owner of "Volunteer Photographers" (sop_template 86e04vj8k) on the next serving's
  sop_event_steps, else the template's default owner (Ian), matched to team_members by name or nickname.
- `trg_wa239_volunteer_applied` (after insert on volunteer_applications, roles photographer or videographer) calls
  `wa_notify_call({event: 'volunteer_applied', application_id, to_name, to_email})`: notify v14 (Slack DM: who applied,
  where, the other roles, their note, the Applicants received link; v23 on the platform) and hub-push v3 (a Hub
  notification; v3 on the platform). wa_notify_call's push list carries the event. The backfill ran before the trigger
  existed, so no alert went out for the past applicants.
- Both functions also carry wave242's per-kind choice (`wa_notify_prefs.prefs.kinds[kind] = {hub, slack}`) and the
  `task_due` event, so the notification centre ships without another deploy.

## Deploy
- Database: build/data/wa239_roles_pool.sql (migration wa239_roles_pool, staged through wa_stage_sqlq239 and run in one
  DO block; wa239_reconfirm_kind through apply_migration). Functions patched in place from their live definitions:
  wa209_volunteer_apply, wa209_volunteer_roles, crm_form_apply, wa171_inbound, wa_notify_call. No row deleted.
- Edge: notify v14 (platform 23), hub-push v3 (platform 3). Dry runs answered (hub-push volunteer_applied and task_due
  with dry: true; notify routes the event).
- Front end: index.html 686584e6bc08392b9309940939965554 (7,182,317 bytes) over 7ae4ff65; c/index.html
  3fddef9dbde70645d61977a7d5f72b1f (build/c/make.py). Stage tables wa_stage_239, wa_stage_239c, wa_stage_sqlq239
  (policies closed; the hourly sweep drops them).
- Tests: test/w239drive.js 44 of 44 (the chips and counts, the tag select, the photographer filter, the Still in? column,
  chips and filter, the modal's text, people and ticks, the RPC call, the Applicants role select counts and lead, a
  member sees no text button). w234drive 27, w209drive 34, w218drive 27 unchanged.
