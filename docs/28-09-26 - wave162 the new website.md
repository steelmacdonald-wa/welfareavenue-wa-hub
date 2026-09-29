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

- `test/w162www.js` (offline, the build served the way Netlify serves it by `test/www_serve.js`, with the real `_headers` and the Hub mocked): 505 checks, all passing. Every page in both languages at 1280, 390 and 320 pixels (status, language, one heading, no sideways scroll, no console error, no CSP violation, canonical and hreflang, the language link, alt text, skip link); every internal link; every old address lands on a page; the 404; the phone menu; the next servings (order, servings only on the home page, the build's copy when the Hub is down, past dates dropping off, the French note); the forms (draft keeps the page's message, published form renders, missing answers marked, the exact post, the thank-you, French falling back to English, the rate limit keeping the answers, two forms on one page keeping unique ids); the photo viewer (caption, arrow keys, Escape and focus); the press videos; the French hint for French browsers; no em dash, inline style, inline script or event handler in any page.
- Live on the preview after each deploy: all 15 pages at desktop and phone widths (no errors besides the expected 404s of the draft forms), the redirects answered by Netlify, the security headers, the newsletter form rendering from the Hub, the upcoming list from `www_upcoming`, `form-submit` answering the preview's origin and still refusing others.

## For Steel

1. Look through the preview on a computer and a phone, in both languages.
2. Put the forms live in the CRM's Forms tab when happy: `volunteer`, `toronto-volunteer`, `contact`, and the French `benevole`, `nous-joindre`, `infolettre` (the English newsletter is already live). Until then those boxes show "write to info@welfareavenue.com".
3. Decide who hears about contact-form messages (an automation can email info@welfareavenue.com for each one).
4. Confirm the partners named on About (the shelters were left off until they agree to be named), and whether you want a team section.
5. At launch: the donate buttons can open the popup (wave161c) instead of leaving for the Hub; the French donation page is still English; point welfareavenue.com and www at the Netlify site (a DNS change you make; the assistant writes the exact records), then the launch build (`make.py --launch`) and one `www-sync` deploy.
