# 29/09/26 - wave168: photos and the brand on the fundraising events and the forms

Steel (29/09/26): "Also where possible add photos to our fundraising events pages, all forms in the CRM - in fact really try to enhance branding here." Asked which event pages, he answered: both (the Hub's and the new website's).

The rule for every picture: a Photo library photo marked ready (team, volunteers, food; no close-ups of the people we serve), or a poster from the old website's archive, from the Hub's own storage only. A photo from an earlier edition says so.

## The Events calendar (Hub)

- **The cards.** Each event shows its cover (the photo's small size), labelled when it comes from an earlier edition ("The 2025 edition"). An event with no photo of its own shows the poster of the latest past fundraiser like it ("From March 2023"), resized by Supabase's image service (the original loads if that service does not answer). An event with no picture yet gets the brand's band: the green, the E that moves and a gold doodle (a different doodle per event). Ideas stay chips.
- **The event's page** opens on the photo with a gold star ("Photo: the 2026 edition"), or on the poster, which opens full size. Below the details: **Photos** (the event's series, or "Photos from the 2025 edition") and **Past fundraisers like it** (their posters, names and dates, oldest first). Any photo or poster opens full size over the page; a click or Escape closes it. With no picture yet, the people who edit see how to add one.
- **Editing** (leaders and the fundraising team): Cover photo (the ready photos of the Photo library, the chosen one first), Photos shown (a series, with how many ready photos it has) and Past fundraisers like it (the website's twelve, ticked). Record the result never touches the photos, and if the Photo library did not load, Save keeps what was set.
- **What is set now:** Flag Football 2026 (its own celebration photo and the 2026 series), Flag Football 2027 (last summer's team photo, labelled), Gift Basket Drive 2026 (last December's crew and the 2025 series). Past fundraisers like them: Flag Football, both years, and the Sports Tournament (the FlagPlus tournament, December 2023), the Gift Basket Drive (Holiday Gift Baskets 2025), St. Patrick's Party at Reggie's (the three nights at Reggie's: both Party for a Good Cause nights of 2022 and the St. Patty's party of March 2023), the Corporate Cook-Off (the two cupcake sales and Adaptavist's team cooking for us), the One Bag Challenge (the Hotel Zero1 clothing drive), the talent show idea (both variety shows) and tabling (the Vanier tabling day). All editable on each event's page.
- The St. Patty's party at Reggie's was on 17 March 2023 (its poster); the archive had the day it was posted (10 November). Its date is right now, as the new website already had it.

## The CRM's forms

- **The public page** (hub.welfareavenue.com/f/...) opens on the form's photo behind the logo lockup, with a gold star, what the form is for (Volunteer with us, Stay in touch; in French Bénévolat, Restez au courant) and the title in the brand's type. The thank-you keeps the photo and shows the E that moves and a heart; the brand line (Service is solidarity, not charity.) sits at the foot of English forms. A closed form keeps its photo and names itself above "This form is closed." A photo that does not load leaves the green band.
- **The photo:** each form's cover (`crm_forms.cover_photo_id`), or the default for its kind: a volunteer form, two volunteers plating (autumn 2024); a newsletter, salads and grapes; any other, the autumn crew at the tents (2022). Set now: the volunteer forms (English and French) the two volunteers plating, Toronto's volunteer form the crew behind the table (October 2023), the newsletters salads and grapes, the contact forms the autumn crew. Only ready photos are ever sent: a cover that stops being ready gives way to the default.
- **In the Forms editor:** Cover photo under "What it is for" (the default for the kind, or Chosen for this form with Use the default; the ready landscape photos to pick from), and the preview now opens like the public page (the photo, the lockup, the star, the eyebrow and the title, following the typing and the language).
- `form-submit` v4 returns the cover with a live or closed form (url, crop point, alt text).

## The website (preview, not launched)

- The events page opens on a photo (the flag football celebration, August 2026) behind the green, with the gold star.
- **Fundraisers coming up:** the Holiday Gift Basket Drive and the Flag Football Tournament show last year's photo, said so on it (The 2025 drive, The 2026 tournament); the One Bag Challenge and Rally Paper, with no photos of their own yet, show the brand's green with the E that moves and a doodle.
- Past events without a poster (Rally Paper 2026) are branded the same way.
- Deployed to the preview (16 files: the pages, whose stylesheet link changed, and the stylesheet).

## Also

- The leads' card on Home shows the new person's photo (wave167 made `wa166_person_card` return it), only from the Hub's own storage; anyone else gets their initials.
- Training: the Events calendar tour (the photos, the past fundraisers, how to add them), the CRM tour's Forms stop (the cover photo), the Photo library tour (only ready photos can be a cover), and the two tours' descriptions in the Academy.
- Access: no changes. The new columns follow their tables' rules (events: staff edit, board members read; forms: staff with the CRM), board members see the photos and cannot edit, and the public page only ever shows ready photos.

## For Steel

- The One Bag Challenge, Rally Paper, the Women's Day fundraiser and the other plans have no photos yet: photos taken at the next one, added to the Photo library and marked ready, can be picked on the event's page in a click.
- The posters keep the old website's titles in the Hub (for example "Cupcake fundraiser with  Daniella's Delight's"); the new website has its own, cleaned-up titles.

## Releases

- The page: `7e01b3a7a5fb5969b4a836a67eb3fdbc` to `74c812c4f1525bcce15a294f96f8115c` (29/09/26, 23:29 UTC; gated deploy, host-sync, the live page checked byte for byte; change_log 3634).
- The form page (`f/index.html` in `site_files`): `c7dd0e1d5422e51a41b17a6256c21f98` to `805e2747fe8568ba32fc51a327d33f00` (host-sync; checked byte for byte on hub.welfareavenue.com/f/volunteer, and the live volunteer form loads its photo with no policy error).
- `form-submit` v4 (platform version 9).
- The website preview: 16 files through `www-sync` (167 files, state ready), checked on the preview.
- Migrations: `wa168_photos_brand` (20260929100000), `wa168b_more_posters` (20260929101000), `wa168c_training` (20260929102000).

## Files

- `build/parts124/e2_media.js` (new) and `b_css.js`, `c_data.js` (the Photo library and the website's fundraisers), `e_fund.js` (the card), `f_sheet.js` (the page and the form), `h_tours.js`; `build/parts152/i_forms.js` (the picker and the preview) and `f_wire.js` (the tour); `build/parts166/a_head.js`, `d_lead.js` (the photo on the leads' card); `122` (the Photo library tour).
- `build/f/src.html` and `make.py` (the public form page); `fn/form-submit/index.ts` (v4).
- `build/www/content.py` (`EVENTS_HERO`, `FUND_NEXT_MEDIA`), `make.py` (`page_hero_photo`, `e_svg`, the fundraiser cards, the branded placeholder) and `assets/site.css`.
- `build/data/wa168_photos_brand.sql`, `wa168b_more_posters.sql`, `wa168c_training.sql` (each with its `.rec.sql`).
- Tests: `test/w168drive.js` (42 checks), `test/w168page.js` (15), `test/w162www.js` (three more checks, 548), `test/fx_w168.json` (the live rows the tests use); `test/w124drive.js`'s menu check follows wave163's layout (Home, Avenue Academy, the Executive dashboard, Calendar).

## Tests

Before the release, on the build: the drive tests from wave130 to wave168 (36 files), the Events calendar for staff and a board member, the form pages and the phone sweep: 1,193 checks passed and one failed, `w124drive.js`'s menu check, which fails on the live wave167 page too (the menu changed in wave163); brought up to date, it passes (35 of 35) on the final build, which differs from the tested one only by the Photo library tour's sentence. The website: 548 checks on the built site served the way Netlify serves it.
