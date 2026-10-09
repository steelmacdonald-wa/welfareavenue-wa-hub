# Wave230: Link pages in the Content Studio (09/10/26)

Steel asked for "a linktree section of the studio with the ability to track insights on who clicking what link and make it similar to linktree pro but much better".

He chose:

- **Who clicks:** anonymous insights with no cookies. A person is named only when they sign up or give.
- **Pages:** several pages: the link in bio, plus campaign, event and city pages.
- **Smart links:** schedules, a featured link, A/B tests and fallbacks.
- **Sign-ups and donations:** volunteer, newsletter and donation blocks, credited to the page.
- **Content blocks:** Instagram, YouTube, events, impact numbers, English and French.
- **Source links and QR codes:** a tracked address per source and per QR code, plus a weekly summary.

## Where it lives

- **The Studio:** Content Studio, Toolkit, Link pages (`#studio/pages`). The tabs are Pages, Insights, Sources and QR codes, and People. The editor is at `#studio/pages/edit/<id>`. Short links stay at `#studio/links`.
- **The public pages:** hub.welfareavenue.com/links (the bio page, slug main) and /links/<slug>. Add `?s=<source>` for a tracked source and `&lang=fr` for French.

## The editor

- **The page:** the title and the line under it, each in English and French; the picture; the address.
- **Blocks:** links, sign-up forms (any published CRM form, with an optional French form), donate, heading, text, YouTube, Instagram posts, upcoming events, impact numbers and social icons. You can move, duplicate, remove or switch off each block.
- **Each button:**
  - an emoji or picture, and a small line under it
  - featured (gold, gently pulsing)
  - show from and until
  - a fallback for when it is switched off
  - an A/B test of its text, with views, clicks, rate and confidence; Keep A or Keep B picks the winner
- **Look:** five themes, custom colours, button shape, language rule and the page's fallback.
- **The live phone preview:** the real page in a frame, updated as you type. It can show EN or FR, and A or B. Faded buttons are off or scheduled.
- **Saving:** every link button becomes its own `lp-<slug>-xxxx` short link, so the go function counts it. Save and publish puts a draft page live.

## Insights

- **The numbers:** views, people, came back, clicks, click rate, sign-ups, and gifts started and made, each compared with the period before.
- **What it says:** the top source, which source clicks most and least, the top button, the peak time and the share of visits on phones.
- **The charts:**
  - views and clicks a day
  - buttons, with clicks, people, share of views and sign-ups
  - sources, with views, people, clicks, rate and sign-ups
  - the funnel from views to people, clicks and sign-ups or gifts
  - cities and regions, and countries
  - device, app or browser, system and language
  - a 7 by 24 heatmap of when people visit
- **Export:** a CSV of every event. It has no hashes.
- **People:** who signed up or gave after a click, linked to their CRM record, with the minutes between the click and the sign-up.
- **Sources and QR codes:**
  - a tracked address per source
  - its views, clicks and sign-ups
  - a QR code in our green with a gold W, as a 1200px PNG or an SVG
  - you can add a source or retire one

## Privacy

- **No cookie, and no address kept.** The functions reduce the network to two keyed hashes (WA_FORM_SECRET):
  - `ipm` is the same hash the forms and the donation page keep. A sign-up or gift is credited to the last link page click from the same network in the 2 hours before it (`wa230_conversions`).
  - `visitor` changes every month. It is used to count people and repeat visits within the month.
- **Location** comes from Netlify's geo header, else the country headers, else the browser's time zone.

## Data and functions

- **Migrations:** `wa230_link_pages` and `wa230_conversions_service` (`build/data/wa230_link_pages.sql`).
  - Tables: `link_pages`, `link_page_sources` and `link_page_events`, plus `short_links.fallback_url`.
  - The rpc `wa230_conversions`.
  - The seeded bio page and sources.
  - The cron `wa-link-pages-digest` (Mondays 13:10 UTC).
- **Functions:**
  - `linkpage` v1 (new; load and digest; files index.ts and lp.ts; verify_jwt off).
  - `go` v2 (the click events and fallbacks).
- **Site files:**
  - `links/index.html` (the renderer, built by `build/links/make.py`)
  - `_redirects` (`/links/*` and `/lp` added)
  - `_headers` (a /links and /links/* policy: our storage, Instagram and YouTube images, youtube-nocookie on a tap, framed by the Hub only)
- **Hub sources:**
  - `build/parts225/l_pages.js` (new)
  - a_head (the section)
  - b_css (the w230 styles)
  - h_links and z_wire (the old bio editor removed; `#studio/links/bio` goes to Link pages)
  - k_tours
  - parts153 a_head (the rail: Link pages and Short links)

## Tests

- **test/w230drive.js:** 43 checks. They cover:
  - the rail and the pages, making a page, and refusing a taken address
  - the editor: blocks, badges, the preview frame kept across repaints, theme, FR and B in the preview, the A/B table, link validation, and save writing the short links and the page
  - publishing
  - insights: the numbers, chart, heatmap, funnel, buttons, sources, tips, places and devices, one page at a time, 7 days, and the CSV
  - People with the CRM links
  - sources, the SVG and PNG QR codes, and adding a source
  - the old address and Short links
  - read-only staff
  - phone and desktop widths
- **test/w225links.js:** 17 checks of the public renderer under the real `_headers` policy.
- **Regressions:** w225drive 47, w153 46, w163 40 and w193 44, all passing.

## Release

- **Live md5:** fcc73d92764d16465a13396dfe6c4e13. This is a three-way merge onto the other session's wave227 (live 01625102).
- **Site files:** links/index.html a8286ac7, _headers afafb14b and _redirects c485f484. All were written in the same gated block.
- **The stage table** wa_stage_230 is blanked and closed.
- **Smoke tests:**
  - linkpage load (bot user agent, nothing recorded) returned the bio page with six Instagram posts.
  - go sends /f/volunteer to the Hub and refuses an outside address.
  - digest without the secret answers 401; the dry run answers "no visits".
- **Netlify:** right after the release, Netlify began answering 503 "Usage exceeded" for both hub.welfareavenue.com and welfareavenue.com, because the account ran out of credits. Steel adds credits or changes the plan. Then check that `/lp` works through the proxy, and that Netlify passes `x-nf-client-connection-ip` and `x-nf-geo` (look at the first real event's ipm, city and country).
