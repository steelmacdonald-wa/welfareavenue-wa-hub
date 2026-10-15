# 15/10/26 - wave244: two roles at most, read before signing up, the coordinator places people who pick two

Steel, 15/10/26: "I want to limit people from being able to sign up to two or more positions ... it can get difficult for
our team to kind of decide where to put them ... when they choose the positions on the website, they should be 100% aware
and have reviewed ... what the role is. For example, a driver, they need to know that they have to bring their own car.
That is critical ... I want to make sure that they click check a box that they've read what positions they are signing up
to." Asked where someone who picks two goes: "Wait for coordinator to choose". Then: "remove the not sure ... take off the
dishwasher role [on the website], but still keep it on the volunteer manager side".

## How people were classified before (for the record)
crm_form_apply put every date a person picked on the roster under one role: the first of cook, driver, server, dishwasher,
photographer, videographer, Community lead that they ticked. Picking five roles made them a cook. On 15/10/26, 24 upcoming
roster rows (10 people) had come in that way, most as cook; they were left as they are.

## Now
- **Forms (volunteer, benevole; crm_forms):** the roles question allows 2 (`max: 2`), each option carries what it involves
  (`d`; the driver's says "You drive your own car ... You need a licence ... gas is reimbursed up to $15"; the label is
  "Driving (your own car)"), the help says the coordinator chooses when 2 are picked. A required question `roles_read`
  ("Read before you sign up": "I have read what the roles I picked involve (drivers: I bring my own car).") follows it.
  Dishwasher is gone from the choices (it was never a website account choice for drivers; `vol_signup_roles` is now
  server, cook, photographer, community_debrief). Videographer stays on the forms.
- **form-submit v8** (platform version 14): options keep `d`, the question carries `max`, a submission with more than `max`
  is refused ("Please pick at most 2." / "Veuillez en choisir 2 au plus.").
- **crm_form_apply:** one role picked lands in that role as before; two land as role `volunteer` with
  `detail.role_choices` (e.g. ["driver","server"]).
- **Texts:** `wa171_queue_confirms` skips those rows (the 7-day confirmation waits) unless a person is texted on purpose
  (p_roster); `wa172_queue_signups` names both ("Sunday, November 1 (driver or server)") and adds "Our coordinator will
  choose your role and let you know before we confirm." (FR: "Notre coordination choisira votre rôle et vous le dira avant
  de confirmer.").
- **welfareavenue.com** (www_files, deployed by www-sync, 15 files): forms.js renders the descriptions, switches the other
  boxes off at 2 and checks it again on send; "Apply for this role" on the role cards stops at 2; forms.css styles the
  descriptions; the volunteer page (EN/FR) lost the Dishwashing and "Not sure yet?" cards; the events pages lost Dishwashers
  in "Who do we need?"; the signed-in account's "Sign up as ...?" box says what the role is and needs "I have read what this
  role involves" ticked (account.js). forms.js, forms.css and account.js versions bumped on the 10 pages that load them.
  Copies in build/www/live/. **Port into build/www/content.py before the next make.py run** (the role cards and events
  list).
- **Hub form page** (hub.welfareavenue.com/f/<slug>, build/f/src.html): the same descriptions, limit and check.
- **Hub** (build/src/244_wave244.seg): on a serving's roster board, a card waiting for a role says "Picked Driver or Server"
  with "Make driver" / "Make server"; one click uses the board's own Move (change log, toast, counts). The column's head
  says "Picked two roles on the form: choose one for each". The serving cards' spots bar adds "· N to place".
- **Dishwasher stays in the Hub:** the board, Plan the roster, the bench, the guide and the spot target are unchanged, so a
  person or a partner can still be assigned to it.

## Release
- Data: build/data/wa244_two_roles.sql (migrations wa244_two_roles, wa244_roles_read_label). Tested in rolled-back
  transactions: a two-role submission lands as volunteer with role_choices; the sign-up text; the confirmation held.
- Hub: index.html 5879e6f29afee0b0d584ce991f10b151 -> d3aaf527ee0f215069ce3be9e8fc837b (gate wa244_deploy_gate, stage
  wa_stage_244, closed to the API after). **The live page carried waves 250-254 (the Meta additions in the Content Studio,
  another session, 15/10/26) that were not in the repo this wave was built from (a6fbd9ff, wave243)**, so 244 was spliced
  into the live page right after 242's segment rather than built from the repo; rebuild from the sources only once 250-254
  are in them (check build.sh's output against the live md5 before any deploy).
  f/index.html e377b2fa -> efdb9627.
- Website: www-sync deploy 6ad114735593956dd349de50 ready, 15 uploaded. Pages checked live.
- Tests: test/w244site.js (28: both languages, the pages, the descriptions, the limit, the read box, the role cards'
  button, the events pages), test/w244f.js (14: the Hub form page at 1280 and 390 px), test/w244drive.js (20: the bar, the
  card line, the buttons, placing both, staff at 1366 and 390 px). w234drive and w235drive unchanged on the new build.
