# wave162: the new welfareavenue.com (preview), 28/09/26

Steel, 28/09/26: "let's build the actual website first with the new branding". His answers the same evening: pages Home and About, Volunteer, Events and photos, Press and Contact (Donate either way); English and French at launch; forms only, no accounts; lean and fast, about 9 October. Later: "By the way I've uploaded photos here ... you can label them and add them to the website".

**Where it is:** a preview at https://welfareavenue-www.netlify.app (its own Netlify site, `welfareavenue-www`). Nothing on welfareavenue.com has changed: the old website and its Keela buttons stay until Steel points the domain at the new site. The preview is kept out of search engines (a `noindex` meta tag, an `X-Robots-Tag: noindex` header and a `robots.txt` that disallows everything); the launch build flips all three and lists the sitemap.

## The pages

Fifteen pages, English at `/` and French at `/fr/`, each with its counterpart one click away (the language link in the menu, `hreflang` alternates, canonical addresses on welfareavenue.com):

| English | French | What is on it |
|---|---|---|
| `/` | `/fr/` | Hero ("We meet people wh≡re they are", the one moving E on the site), the four pillars, four figures from the 2025 impact report, the next three Sunday servings, the volunteer call, a partner quote, the press line, the newsletter form and the donate card |
| `/about/` | `/fr/a-propos/` | Solidarity, not charity; the four pillars and figures; the story since 2020 (twelve dated moments from the Hub's Our story highlights); who we work with (Montreal, Toronto, Ottawa); the partner quote; the registered charity line |
| `/volunteer/` | `/fr/benevolat/` | Ways to help (serve, cook, drive, wash dishes, take photos, not sure yet), how it works, the next five servings, the volunteer form, a volunteer's quote, Toronto (its own form behind a fold), bring your team |
| `/events/` | `/fr/evenements/` | Coming up (servings and any published fundraiser), 24 photos from the servings with a viewer, 14 past events with their posters, host a fundraiser |
| `/press/` | `/fr/presse/` | CBC News, CTV News Montreal and CityNews Montreal (videos load only when pressed, from youtube-nocookie), the media contact |
| `/contact/` | `/fr/contact/` | The contact form, email, socials, the Google review link, partners and sponsors, the newsletter form |
| `/donate/` | `/fr/donner/` | Give online (the Hub's donation page), what a gift makes possible, the figures, give essentials, companies and foundations |

Plus a bilingual 404 page and 20 permanent redirects from the old website's addresses (`/activity/volunteer/*`, `/about/gallery`, `/activity/fundraising/*`, `/activity/donate-essentials`, `/signup`, `/signin`, `/give` and the rest) to the new pages.

The copy follows wa-brand and wa-writing (people we serve, community, youth-powered, food as a starting point; no em dashes; impact first). Facts come from the 2025 impact report as used in the Hub since 26/09/26, the Hub's Our story highlights (wa_history, published, visible to everyone), wa_partners (active, visible to everyone), site_events, the Hub's forms and the old website's press page. A second pass checked every page against those sources, the voice rules and Quebec French usage; its fixes are in (for example "repas du dimanche" rather than "services", "trousses d'hygiène", "petits gâteaux", the lowercase job titles, the non-breaking spaces). The two quotes (François Bergeron, CDC Centre-Sud; Alejandra M., volunteer cook) are the old website's, word for word, each with a translation marked as such.

## How it is built

- `build/www/make.py` (the generator; `--launch` for the launch build), `build/www/content.py` (the copy in both languages), `build/www/assets/site.css`, `site.js` and `forms.js`. Brand: the five colours, Barlow Condensed and Space Grotesk from Google Fonts, the lockup and wordmark drawn from the Hub's wave117 paths (`assets/logo-cream.svg`, `lockup-cream.svg`), the moving E from the brand's `e-medium.svg`, one gold star doodle.
- No inline script, style attribute or event handler anywhere, so the Content-Security-Policy is strict: `script-src 'self'` (plus hub.welfareavenue.com for the donation popup later), no `unsafe-inline`, `frame-ancestors 'none'`, `object-src 'none'`; images from the site, Supabase storage and YouTube thumbnails; connections to Supabase only.
- **Next servings and events** (`site.js`): the build writes the Hub's list into each page as a first paint, then asks the Hub (`rpc www_upcoming`, anonymous) for the current one; past dates drop off; if the Hub is unreachable the build's list stays.
- **Forms** (`forms.js`): each `data-wa-form` box asks the Hub's `form-submit` for a published form (with fallbacks, so French pages show the English form until the French one is live) and posts answers with the same token, hidden field and timing checks as the Hub's own form page. A draft is not found, so the box keeps the page's own message (write to info@welfareavenue.com) until Steel puts the form live. The newsletter form is live, so it already works on the preview.
- **Donate**: every donate button goes to https://hub.welfareavenue.com/give and carries `data-wa-donate`, so the parked popup (wave161c) can take them over by adding one script line.
- **Images** (`build/www/images.py`): vetted photos and posters resized to 480, 960 and 1600 pixels (progressive JPEG) with width and height on every image; social cards (`img/og-en.jpg`, `og-fr.jpg`) rendered from `build/www/og/og.html`; icons from `build/www/icons.py`.
- **Hosting**: `build/www/stage.py` puts the built files into a temporary stage (checked file by file with md5), SQL copies them into `www_files`, and the new `www-sync` function deploys them to the site. The preview's address is allowed in `form-submit` (v3).

## Photos

Steel uploaded 230 files to `content-images/Good photos` between 22:05 and 22:10 on 28/09/26 (each file twice, so 102 pictures and 13 videos; four pictures also came as HEIC). Eighteen of the pictures were already in the photo library or were near-identical takes (3 to 4 seconds apart) of a photo labelled in the same pass, found by image hash, and one HEIC was the twin of a JPEG. The other **83 are now in the photo library** (`wa_photos`, labelled by Claude (Cowork), 28/09/26, 99 photos in all), each with its three sizes under `photos/full` (2400 px), `photos/web` (1600 px) and `photos/thumb` (640 px), uploaded through `photo-library`:

- **56 ready**: volunteers at work or posing, food, lines seen from behind or far away.
- **4 crop first**: the October 2022 wide crew shot (passers-by and an arm at the edges), a food pickup with a house number in view, and two takes at a donor's front door.
- **22 consent needed**: the eight film scans from a serving (community members recognizable), the Nikon photos of October 2024 where the person served is the subject, photos with children (a young volunteer, a crew with a young helper, a group with families, a serving with a young helper), a man on a mobility scooter, a woman with her plate in July 2024, a man posing by the tent in March 2022 who may be someone we serve, the November 2021 line, a delivery at a building's door, and two wide March 2022 shots where faces may be recognizable at full size.
- **1 internal**: a finished social post from January 2021 in the old branding.
- 16 picks. Dates come from the cameras (the film scans carry only the scanner's date; one Canon's clock reads the evening; the Nikon set keeps the approximate Friday of the first batch). Places are Montreal unless the photo shows Place Émilie-Gamelin. People are described by role, never by name.

The website uses 16 of the new ready photos (the home hero is now the October 2022 autumn crew; the volunteer, events and donate pages use others) and 8 from the first batch, 24 in the events gallery. Only photos marked ready are on the website. The videos were not used.

## New in the database

- `public.www_files` (the website's files, service role only) and `public.www_upcoming(int)` (anonymous, the next servings and fundraisers). Migrations `wa162_www_upcoming` and `wa162_www_files`.
- Four draft forms (Steel puts them live): `contact` ("Write to us"), `nous-joindre` (the same in French), `benevole` (the volunteer form in French, creating or updating the MTL volunteering record like `volunteer`) and `infolettre` (the newsletter in French, permission required). Their answers land on the contact's timeline like every Hub form.
- `app_config`: `www_netlify_site_id`, `www_preview_url`.
- Functions: `www-sync` v1 (new), `form-submit` v3 (the preview origin).

## Verification

- `test/w162www.js` (offline, the build served the way Netlify serves it by `test/www_serve.js`, with the real `_headers`, the Hub mocked and LinkedIn never reached): 542 checks, all passing (505 at the first release; the popup, team, company posts and fundraiser checks came later). Every page in both languages at 1280, 390 and 320 pixels (status, language, one heading, no sideways scroll, no console error, no CSP violation, canonical and hreflang, the language link, alt text, skip link); every internal link; every old address lands on a page; the 404; the phone menu; the next servings (order, servings only on the home page, the build's copy when the Hub is down, past dates dropping off, the French note); the forms (draft keeps the page's message, published form renders, missing answers marked, the exact post, the thank-you, French falling back to English, the rate limit keeping the answers, two forms on one page keeping unique ids); the photo viewer (caption, arrow keys, Escape and focus); the press videos; the French hint for French browsers; no em dash, inline style, inline script or event handler in any page.
- Live after the later deploys: the popup on four pages at both widths (the Hub's page framed, payments allowed in the frame, Escape closes it), the team's 41 people and 15 photos, the three posts' frames, and a sweep of all 14 pages at desktop and phone widths (28 page loads with no console error, broken image or policy block).
- Live on the preview after each deploy: all 15 pages at desktop and phone widths (no errors besides the expected 404s of the draft forms), the redirects answered by Netlify, the security headers, the newsletter form rendering from the Hub, the upcoming list from `www_upcoming`, `form-submit` answering the preview's origin and still refusing others.

## Later the same night (28/09/26, after Steel's review)

Steel asked for five more things; all five are live on the preview.

- **Donate pops up on the page you are on.** Every donate button (`data-wa-donate`) now opens the Hub's donation page in a popup over the page, in both languages, on a computer and a phone. The popup is the parked wave161c work, brought back: `https://hub.welfareavenue.com/give/embed.js` (served by host-sync v7 with `give/embed.css`, so the website's strict policy needs no inline styles) opens `/give/?embed=1` in a frame with `allow="payment *"`. The Hub's `_headers` lets only welfareavenue.com, www and the preview address frame `/give`. The website's `Permissions-Policy` now reads `payment=(self "https://hub.welfareavenue.com")` (it was `payment=()`, which would have blocked Apple Pay and Google Pay inside the frame; checked live: payments are allowed in the frame). The donate copy says the gift goes through Stripe "without leaving this page".
- **The volunteer forms are live and linked.** `volunteer`, `toronto-volunteer` and the French `benevole` are published (Steel's go-ahead). Each answer creates or updates the person in the CRM, creates or updates their volunteering record (flagged for review), puts them on the chosen servings as TBD, and adds the answer and their consent to their timeline. Checked end to end in a rolled-back test first.
- **The team on About** (`#team`): all 41 active people in the Hub's team list, in eight groups (leadership, board, operations Montreal, Toronto, program development, fundraising and events, marketing and content, people and logistics). First names only, a public version of each role (French in épicène forms), the Hub photo for 15 people (Slack's letter placeholders and a two-person photo left out) and initials for the rest. The line under each name is the servings counted from their linked volunteer record ("23 servings since 2020") or, without servings, the year they joined from their Hub start date; the year is left out where the start date is the Google workspace's setup day (17/01/2024). Only 6 team profiles are linked to a volunteer record, so most people show the year they joined. A note invites team members to ask for changes or removal. Data in `content.TEAM`, photos by `build/www/team.py` (sources in the avatars bucket).
- **Companies that work with us** (About, `#companies`): the LinkedIn posts Steel shared from Adaptavist (Bryan, January 2025), GHD (June 2025) and RBC (July 2023), embedded (LinkedIn's frames, lazy-loaded, `frame-src https://www.linkedin.com`), each with a one-line card and an Open on LinkedIn link. LinkedIn does not let the assistant read the posts, so the cards say only what Steel said; the dates come from the posts' ids. Steel's personal note about the GHD day stays off the site.
- **Events from the fundraising calendar.** A new "Fundraisers coming up" band lists the recurring fundraisers in the Hub's 2026-27 plan that have a season: One Bag Challenge (November and December 2026), the Holiday Gift Basket Drive (December 2026), the Flag Football Tournament and Rally Paper (summer 2027). Past events gain Flag Football 2026 (13 teams and 78 players with the Montreal Flag Football League, $2,800 raised, thanks to Guru, DOSE, Lush and La Licorne de Feu) and Rally Paper 2026 (the challenge weekend of September 19 and 20), from `fund_events`. The list is in `content.FUNDRAISERS_NEXT` (a rebuild picks up changes).
- **Photos from the Flag football and Gift basket folders.** All 241 pictures in `content-images/Flagfootball 2026` (218, the tournament; the Canon's clock reads May 2025, the leaves and the phones say 8 August 2026) and `content-images/Gift basket drive` (23, December 2025) were reviewed. Twelve are on the events page in a new "From our fundraisers" gallery (seven from the tournament, five from the gift baskets) and on the two past-event cards. **178 were moved, not deleted**, into a `Not for website` folder beside them: repeats from bursts and near-identical takes, far-away or empty field shots, blurry frames, camera screens, a handwritten sheet with numbers, and handwritten cards whose messages are readable. Steel can look through those folders and delete them himself. The 104 videos were not touched. The move uses a new `sideline` action in photo-library (v2; the trigger secret or a Hub admin; only these two folders; nothing is ever deleted). The twelve are also in the Hub's photo library (wa_photos, 111 photos now; usage ready, series flag-football-2026 and gift-baskets-2025, labelled by Claude (Cowork); their three sizes under photos/ made by `build/www/fund_library.py`).

## For Steel

1. Look through the preview on a computer and a phone, in both languages.
2. Stripe: add welfareavenue.com and www.welfareavenue.com (and welfareavenue-www.netlify.app to try it on the preview) under Payment method domains, so Apple Pay, Google Pay and Link show in the popup. The donation page itself is still English only.
3. Check the team's public roles and first names on About; link more team profiles to their volunteer records in the Hub so their servings show.
4. Look through the two `Not for website` folders (178 pictures) and delete them if you agree. Storage is well over the free plan's 1 GB (about 4.5 GB, much of it videos).
5. Put the remaining forms live when happy: `contact`, `nous-joindre`, `infolettre`, and decide who hears about contact-form messages.
6. In the Hub, record Rally Paper 2026's result so it can go on the site.
7. At launch: point welfareavenue.com and www at the Netlify site (a DNS change you make; the assistant writes the exact records), then the launch build (`make.py --launch`) and one `www-sync` deploy.

## Release

Repo commit afc85563 on GitHub (steelmacdonald-wa/welfareavenue-wa-hub, main; local 3b8c72e), 31 files. The preview's deploy then: 119 files (www-sync). Migrations wa162_www_upcoming and wa162_www_files.

wave162b, the same night: repo commit da2aac63 (local 6d9e459), 20 files, then this docs commit; host-sync v7 (platform version 14) and photo-library v2 (platform version 9), both through fn-deploy; the Hub's give/embed.js, give/embed.css and `_headers` in site_files; the preview's last deploy 167 files, state ready. No migration. The temporary stage tables and helpers were dropped after the release.
