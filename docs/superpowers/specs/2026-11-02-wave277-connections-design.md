# wave277: Connections and publishing, rebuilt

Date: 2 November 2026. Author: Claude, from Steel's request on 2 November ("rebuild all of it using Emil's design skills, considering user experience from top to bottom, and scalability as we add new connections and grow our marketing team"). Steel chose to skip the brainstorming questions, so every choice below is Claude's call unless marked "Steel said".

## Intent

The Content Studio's connections layer grew one platform at a time. The platform list is hard-coded in at least fifteen places, the Connections page still tells the team that LinkedIn is waiting for approval, LinkedIn posts fall to "post by hand" when there are two images or a video, nothing warns anyone before a token lapses, and the approvers are two email addresses seeded in SQL. Ian and KK publish; Steel fixes connections. As the team grows and platforms are added, that stops working.

wave277 makes one place define a platform, one page show the team the health of every account, one publisher adapter per platform behind a common interface, and one setting for who approves, chosen from the team list. The composer keeps its layout and reads platform limits from the registry instead of hand-written warnings.

Steel said (2 November, earlier Hub rules in memory): remove no functionality; copy with no dashes, ASCII in the parts; the Hub's existing stack, no framework.

## Goals

1. A content manager can see at a glance which accounts post, what each can carry (photos, how many, video, comments, analytics), and when any of them needs attention, without reading a card of setup prose.
2. Adding a platform is one registry row plus one adapter file in the publish function and one in the connect function. Nothing else changes.
3. LinkedIn posts with up to twenty images or one video go out directly, like text and single-image posts do today.
4. A token that will lapse is reported a week ahead to the people who can fix it, and the page says who connected it and when it expires.
5. Approvers are chosen from the marketing team by name, not typed as emails. The publish function and the database agree on who is a publisher.
6. The page is built to the Home craft bar (wave272): one quiet surface, 48px rows, hairlines, press feedback, nothing animating on arrival.

## Non-goals

- The composer's layout, the approvals queue, the comments inbox, messages, hashtags, link pages, ads and the monthly report. They keep working as they are. Only the composer's platform warnings change (they read the registry).
- Dark mode (the Hub has none).
- A second LinkedIn app for Share on LinkedIn. One account per platform for now; the registry allows more later.
- Removing the Make.com route from the publish function. It stays as a fallback in code; its card leaves the page (see Anti-goals).

## Anti-goals (what would make this a failure)

- A platform that posted yesterday no longer posts, or posts differently, after the release.
- Secrets shown on screen or in a test fixture.
- Steel has to run SQL by hand to add an approver or a platform's console link.
- The page animates on open. People open it when something is wrong; it must be instant.

## Constraints

- Parts live in `build/parts277/*.js`, assembled by an `assemble.py` that escapes non-ASCII to `\uXXXX` (copy `build/parts225/assemble.py`), into `build/src/277_wave277.seg`, listed in `build/src/MANIFEST.txt` after `225_wave225` and before `110_wave110` so it can wrap wave225's globals.
- One IIFE behind `window.__wa277`. It extends wave225 by replacing `connectHtml` and the connection event handlers through `window.w225` where wave225 exposes them, and by wrapping where it does not. wave225's file is not edited except to expose what wave277 needs.
- Edge functions deploy through the Supabase connector (deploy_edge_function), keeping `verify_jwt: false` on social-connect. Database changes go through `apply_migration`, saved under `build/data/wa277_connections.sql`.
- Tests: a Playwright drive `test/w277drive.js` in the style of `test/w241drive.js`, run with `CAND=build/candidate.html node test/w277drive.js`, plus a fixture `test/fx_w277.json`. The drive asserts no em dash in the seg.
- Copy: plain, warm, specific, Canadian spelling, no dashes. Headings in Barlow Condensed, body in Space Grotesk, colours from the Hub tokens (`--wa-green`, `--wa-gold`, `--wa-card`, `--wa-line`, `--wa-muted`, `--wa-flag`). No new hex colours; the Studio's teal and rose stay where wave225 uses them.

## The design

### 1. The platform registry (database, one source of truth)

New table `studio_platforms`:

| column | meaning |
| --- | --- |
| key (pk) | instagram, facebook, threads, linkedin, tiktok, youtube |
| label, short, colour | display name, two-letter mark, brand colour (moved from PLX) |
| sort | order on the page and in the composer |
| auth | `oauth` (threads, youtube, tiktok, linkedin) or `meta_token` (instagram, facebook) |
| console_url, console_note | where the keys come from |
| steps (jsonb) | the setup steps, shown only inside the Set up disclosure |
| caps (jsonb) | `{text, images, video, max_images, max_video_s, comments, analytics, link_in_caption}` |
| scopes (text[]) | what the Hub asks for at connect time |
| modes (jsonb) | the label for each publishing mode this platform can be in: direct, drafts, reminder, make |
| active | a platform can be parked without deleting it |

Seeded from today's hard-coded values. `caps` for LinkedIn becomes `images: true, max_images: 20, video: true, max_video_s: 600`. Scopes for LinkedIn become `w_organization_social r_organization_social rw_organization_admin r_organization_social_feed w_organization_social_feed r_organization_followers`.

Read by: the front end (one select at load, cached in `S.platforms`), social-connect (authorize URL and labels), social-publish (`capabilities` and validation). The three hard-coded lists in the front end (`PLX`, `PORDER`, `PL`, `PORDER` in the composer, `CONSOLE`, `CX_STEPS`) are replaced by lookups; the functions' `PLATFORMS`, `NAME`, `PNAME`, `ALL` read the table at request time with a 60-second in-memory cache. The CHECK constraints on `content_slots.platform`, `social_comments.platform` and `social_accounts.platform` become foreign keys to `studio_platforms.key`.

Builder's call: the composer's `PL` and `PORDER` are replaced by a getter so the existing code paths keep their shape.

### 2. Connection records

`hub_settings.studio_connections` stays the store (no migration of live data), but every record gains the same shape, written by social-connect on connect and by the health job:

`{ status, mode, name, handle, account_id, scopes_granted, connected_by, connected_at, expires_at, last_checked_at, last_error, health }` where `health` is `ok | expiring | expired | error | not_connected`.

`expires_at` is set wherever the platform tells us (LinkedIn, TikTok, Threads 60 days from refresh). `scopes_granted` comes from the token response; the page compares it with `scopes` in the registry and offers Reconnect when the Hub now asks for more.

### 3. Adapters (functions)

social-connect gains `fn/social-connect/adapters/<key>.ts` each exporting `{ authorizeUrl, finish, refresh?, health? }`; the switch in `authorizeUrl` and `finish` becomes a lookup. social-publish gains `fn/social-publish/adapters/<key>.ts` each exporting `{ publish(post, caps), modeOf(conn, secrets) }`; `PUBLISHERS` and the mode block in `capabilities` become lookups. Adapters are plain TypeScript files included in the deploy upload. The Make.com route is the LinkedIn adapter's fallback when no direct token exists and a hook is saved, exactly as today.

LinkedIn adapter, publish:
- text and one image: as today (`/rest/images` initializeUpload, then `/rest/posts`).
- two to twenty images: one `initializeUpload` per image, then a post with `content.multiImage.images[]` carrying each image urn and alt text.
- one video: `/rest/videos?action=initializeUpload` with the file size, upload the parts to the returned URLs, `finalizeUpload`, then a post with `content.media.id` set to the video urn and the post title as `content.media.title`.
- more than one video, or video plus images: Manual with the reason "LinkedIn takes one video, or up to twenty photos, per post".

### 4. Health and renewal

The Monday cron `wa-social-connect-refresh` calls `refresh`, which now runs every adapter's `refresh` (Threads as today, TikTok and YouTube by refresh token) and `health` (a cheap authenticated call, for example LinkedIn `/rest/organizationAcls` with the saved token). It writes `health`, `last_checked_at`, `expires_at` back to the record. When `expires_at` is within 7 days and the platform cannot refresh itself (LinkedIn), it notifies the publishers through the Hub's `notify` function (the channel the team already uses for approvals) once, and records `warned_at`. The Connections page shows the same state, so nobody depends on the message.

### 5. Approvers from the team

`content_studio.approvers` keeps its shape (emails). The Approvers box in `e_approvals.js` is replaced by a picker that lists active `team_members` in the marketing department, with the current approvers ticked. Saving calls `studio_settings_save` as today. social-publish's `publishers()` gains the approvers from `wa241_approvers()` so it matches the database rule (today it does not: an approver can approve in the Hub but the function would not count them as a publisher).

### 6. The Connections page

Route `#studio/connections`, unchanged. Layout, top to bottom:

1. **Masthead** as wave225 draws it, title "Connections", line "Every account the Hub posts to, and what each one can carry."
2. **Attention strip** (only when something needs it): one row per account whose health is expiring, expired or error, with the plain reason and one button (Reconnect, or Fix keys). Flag colour on a hairline, no fill.
3. **Accounts**: one list, one row per platform in registry order, 48px tall at rest, inside one card with hairlines between rows. Each row: the mark (two letters on the brand colour, 28px, radius 8), the platform name in Barlow Condensed with the account handle or name beside it in muted body text, a status pill (Connected, Expires in 12 days, Expired, Not connected, To TikTok drafts, By reminder), then the capability chips (Photos 20, Video, Comments, Analytics) in muted text, then the one action on the right: Connect (gold), Reconnect (gold) or a quiet overflow with Disconnect and Open console. Pressing a row toggles its disclosure.
4. **Row disclosure** (one open at a time, 180ms ease-out on height and opacity, none under reduced motion): who connected and when, expires on, scopes granted versus asked (with Reconnect when short), the console link, the redirect address with a Copy button, and the key fields (id and secret, password type, never echoed back; a Save keys button). Instagram and Facebook share one Meta row whose disclosure holds the system token field and the granted and missing permissions, as the Meta card does today.
5. **Test and reminders** (one quiet row at the bottom): "Send a test reminder" for the reminder flow, as `remindCard` offers today.

Removed from the page: the Make.com card (nothing was ever saved in it; the fallback stays in code and the hook can still be saved through the LinkedIn row's disclosure under "Advanced"), the per-platform prose cards, `confirm()` and `prompt()` (replaced by the Hub modal with one clear sentence and a primary button).

Motion and feel (Emil): press feedback `transform: scale(.97)` over 160ms with `cubic-bezier(.23,1,.32,1)` on every button and on rows; status pills change by opacity crossfade of 150ms, no movement; disclosure opens with ease-out, closes faster (120ms); nothing staggers or fades on page open; hover rules behind `(hover: hover) and (pointer: fine)`; `prefers-reduced-motion` keeps opacity changes and drops the height transition. Focus rings visible, every control reachable by keyboard, rows toggle on Enter and Space.

Responsive: at 620px the capability chips wrap under the name and the action stays on the right; at 480px the row becomes two lines with the action full width.

### 7. The composer's warnings

The validation block in `121_wave121.seg` (lines 702 to 750) is replaced by one function that reads `caps` for each selected platform: too many images, video not supported, video too long, link in caption. The per-platform strings are generated from the registry ("LinkedIn takes up to 20 photos", "TikTok takes one video"). `modeOf` and `stateOf` read `modes` labels from the registry. Default platforms for a new post stay Instagram and Facebook (unchanged behaviour).

### 8. Academy and copy

The Academy lesson that names "Ian and KK" as the approvers changes to "the approvers set on the Approvals page". The wave225 header comment and `wa225_studio.sql` header gain a line pointing at wave277.

## What is left to the builder

- The exact TypeScript shape of the adapter interface, as long as every adapter implements the same one.
- How the registry cache is invalidated in the functions (a 60-second TTL is fine).
- The LinkedIn video upload chunk size and retry.
- The fixture values in `test/fx_w277.json`.
- Whether the Meta row's permissions chips keep the wave225 markup or the new chip style (either, as long as the text is unchanged).

## Verification

- `CAND=build/candidate.html node test/w277drive.js` as admin, leader (marketing) and member: the page lists six platforms in registry order, the attention strip shows for an expiring fixture, the disclosure opens and the keys form posts `save_app`, the approver picker lists marketing team members and saves emails, the composer warns from caps (two images on LinkedIn no longer warns; two videos do), no em dash in the seg.
- `node test/tour1.js all` still passes.
- Deployed: social-connect `status` returns `platforms` and records with `health`; a LinkedIn post with two images from the live Hub publishes directly (Steel confirms on the Page); the Monday refresh writes `last_checked_at`.
