# 16/10/26 - wave261: the Holiday Gift Basket Drive's pop-up forms, the CRM's form groups, and the gift counter

Steel, 16/10/26: "I think we should have a new volunteer application form via the hub so that we can collect them on that page as a
pop-up form, to donate gifts and essentials, to volunteer with us. I don't want it to bring people to a different page. I want it to
pop up a form for each of those actions that they can take. Same thing for companies and sponsors and schools and groups. The forms in
the CRM need to be maybe grouped. We can maybe group forms for different purposes, like volunteers." And the drive page's gift counter:
"this should be editable".

## What it does

- **Website** (welfareavenue.com/gift-basket-drive/, /fr/paniers-cadeaux/): the four non-money actions open a Hub form in a pop-up
  (wave236's mechanism in `assets/forms.js`, extended with `data-wa-popup-id` and `data-wa-popup-bare`): Donate gifts and essentials
  (`#give-items`), Wrap with us (`#wrap-with-us`, also the green band's Volunteer button), Companies and sponsors (`#sponsor`), Schools
  and groups (`#groups-drive`). Modal `<dialog>` (focus kept inside, Escape, ×, click outside, focus back to the launcher), full screen
  on phones, the page's own link as the fallback without JavaScript, an address with the hash opens the pop-up. The Stripe donation
  pop-up is unchanged. Under the 6,000 goal: "N gifts collected so far" with a gold bar and "x% of the way to 6,000 gifts", from
  `www_campaign_totals.gifts_in`, hidden while 0.
- **Forms** (crm_forms, live, `build/data/wa261_forms.py`): gift-drive-give / paniers-donner (purpose gifts, a pledge), gift-drive-volunteer /
  paniers-benevole (purpose volunteers, kind volunteer with a volunteering record: Applicants received, role text "Holiday Gift Basket
  Drive: <tasks>"), gift-drive-sponsor / paniers-entreprises (sponsors), gift-drive-group / paniers-groupes (groups). All tagged
  `gift-basket-drive` (settings.campaign), each real answer files a Request `gift-drive` for Fundraising, assigned to Amanda, posted
  brief (details stay in the Hub, never the email or phone).
- **crm_form_apply**: settings.request (the Request), settings.gift_pledge (a pledged `campaign_gifts` row waiting for a Confirm),
  settings.role_text / role_q (Applicants received), and an address at a reserved test domain (example.com/.org/.net, .test, .example,
  .invalid) is a test everywhere (no Request, pledge or applicant; the submission is marked is_test).
- **CRM, Forms**: the form groups (`crm_forms.purpose`: volunteers, gifts, sponsors, groups, other) as chips (All plus each group with its
  count) and sections; the editor's Group select; a new form takes the chosen group. Saving a form now keeps what the editor does not show
  (a multi's `max`, the options' `d`, `lead`, `u`), so giving the volunteer form a group never drops its two-role limit.
- **Fundraising app, the drive's event** (fund_events 4, through app_config donate_campaigns fund_event_id): Gifts collected: the count
  toward 6,000 (what the website shows), the pledges that wait, every batch, Add gifts, Edit, Confirm, Mark received, Remove (asks
  first). `wa261_gifts`, `wa261_gift_save`, both checking `wa_fund_ok()` inside.
- **What counts on the website**: received batches and confirmed pledges. A pledge from the website form waits for a staff Confirm.
  Seed: 616 Books received 15/10/26 (Amanda, the 15/10/26 meeting), counted.

## Files

- Hub: `build/src/261_wave261.seg` (new, after 260 in MANIFEST), `build/parts152/i_forms.js` (form groups, safe saves),
  `build/parts124/f_sheet.js` (openFund calls w261.slot and w261.fill).
- Website: `build/www/patches/261_drive_popups.py`, `build/www/live/` (the two pages, forms.js, forms.css, drive.js, drive.css; other
  page copies refreshed from the live site).
- Data: `build/data/wa261_drive_forms.sql` (migration), `build/data/wa261_forms.py` (the eight forms), `build/data/wa261_www_deploy.sql`
  (the website's md5-guarded swap and www-sync).
- Tests: `test/w261site.js` (108 checks, offline with the real `_headers` CSP), `test/w261drive.js` (33), `test/w261forms.json`.

## Release order (each step is a database write Steel approves)

1. Migration `wa261_drive_forms` (`build/data/wa261_drive_forms.sql`).
2. Get advisors (security): no new ERROR.
3. Website: run `build/data/wa261_www_deploy.sql` (refuses if any of the six www_files rows moved), then check the six files live byte
   for byte and the pages in a browser (EN, FR, desktop, phone) with a test submission at an `@example.com` address, then remove that
   test contact, its interactions and submission.
4. Hub: re-check the live md5 (`1cecc2a367cc40157ab74d5b02797f29` when built), `bash build/build.sh candidate.html`, stage through
   `wa_stage_261`, `build/deploy_gate.py wa_stage_261 <live md5> "WA v261,w261.slot,data-w261grp"`, host-sync, curl until it matches;
   change_log release row (`wave261`).
5. Push this commit to GitHub main through `build/repo_push_via_db.py` (repo-sync), on top of whatever head is there.
