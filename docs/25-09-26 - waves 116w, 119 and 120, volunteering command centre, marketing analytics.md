# 25/09/26 - waves 116w, 119 and 120: the mentions fix, the volunteering command centre, Marketing analytics

Shipped on 25/09/26 in four deploys on top of wave118b from Steel's other session. Live at the end: `7859d524b4edc8f68bf2ac5892eb1b1a` (2,457,713 bytes). Repo: steelmacdonald-wa/welfareavenue-wa-hub, pushes 34f718a7 (119 + 116w), de039c52 (120), 4e558b1a (119b), 3c216c2b (social-pull v1.1) and e4259e45 (wa116x).

## What Steel asked for

- "In Home, when I take a look at mentions and try to click Got it, it doesn't go away."
- "MTL Volunteering can use some Apple-looking UI and ClickUp robustness, dragging and dropping, AI features and any other recommendations you'd say."
- "Can the marketing department have a new page that reads analytics from our Meta insights dashboard, TikTok, LinkedIn etc?" then "Walk me through step by step for Meta first."

## wave116w: Got it on a mention

Two causes. wave65's handler looked for its own row class (`.w65men`) while wave74 renders the Home list as `.w74men`, so the row never changed on screen; and the `mentions` update policy only let a person mark their own mentions, so an admin reading everyone's saw nothing happen. Migration `wa116w_mentions_seen_admins` widens the policy to hub admins; the new capture-phase handler saves with `.select('id')` (so a silent no-row update shows as "Could not mark it as seen"), fades the row in either list and removes the button.

## wave119: MTL Volunteering, cut 1 (the event command centre)

The event page is regrouped into `#w119` after wave20/26/28/31/59 paint it; every old handler keeps running on the same nodes.

- Masthead: code and season, the date, status pill, title, venue, meals, countdown, two readiness rings (checklist done, roster confirmed against 22 places), the counts line, and the Cancel/Restore button that wave106 adds to the hero (adopted into the masthead even when it arrives late).
- What's next: the three most urgent unticked steps (due date first, then phase and sort), one-tap tick that clicks the real checkbox (or calls `waVolToggleStep` when the step is not on screen), rings and list repaint after the save.
- Grid: checklist on the left (the same `details.vl-phase` blocks), roster board on the right: a column per role with targets `{team_leader 2, cook 4, driver 2, server 8, dishwasher 2, photographer 1, community_talker 2, community_debrief 1}`, counts coloured short/full, volunteer cards (name, status select `data-vlrstat` so wave20 saves it, phone as tel: link, email, notes, "not matched" flag), remove (x), and "move" (a role select, the touch fallback for drag). HTML5 drag and drop moves a card between columns (`event_roster.role`) or drops a bench person into a role (insert with status Waiting For Response). The `+` on a column opens the bench: the volunteer list (people not already on the event, those with the role first, search by name or tag), Add.
- Side rail: wave31's event summary (moved in even though it renders asynchronously), the meeting extras, and the hidden originals.
- Calendar: a month grid (‹ Today, Next event ›) beside the list; each event chip carries two dots (checklist, roster) and opens the event; the upcoming cards get gap pills ("5 to confirm", "10 steps left", "roster confirmed", "checklist done").
- The month view keys on a data-key so the body MutationObserver never loops; own insertions (`#w119`, `#w119cal`, `.w119gaps`) are ignored by it.

## wave119b: MTL Volunteering, cut 2 (the Volunteers page, planning, the recap)

- Volunteers: cards instead of the table. Initials avatar, name, organisation or car, roles and tags as chips, phone as a tel: link plus a Text (sms:) link, email, notes, and the reliability line from `volunteer_history()` ("5 of 6 events confirmed, last Jul 12" with a bar). Badges: Reliable (3+ events, 80%+), New, Quiet n mo, Often unavailable, Review (the wave26 flag). Sort by most reliable, most recent or name; the stats strip (volunteers, active in 90 days, confirm rate, have served, need a review); search (name, phone digits, email, role, tag) and the role chips as before; edit still opens wave26's modal.
- Duplicates: people sharing a phone (last 10 digits), an email or a normalised full name are grouped (union-find); each card in a group says who it looks like and why, "Possible duplicates (n)" filters to them, and Merge X into this calls `volunteer_merge(keep, drop)`: event_roster and quo_messages rows move, phones/emails/roles/tags are unioned, address/car/organisation/notes kept, the copy deleted, a change_log row written.
- Plan the roster (event masthead, staff): for every role short of its target, the people not on the event ranked by 0.55 x confirm rate (Laplace prior) + 0.25 x recency of the last confirmed event + 0.2 x role fit (on file, tagged, none), minus 0.15 when they were unavailable half the time; each person is pre-ticked for one role only. Jev (router task `decide`, four parallel workers, at most 24 calls, about 0.002 cents each) answers "if asked today, will this volunteer confirm and show up?" per candidate and the score becomes half history, half Jev's odds; ticks survive the re-sort once touched. Add the ticked people inserts them as Waiting For Response and repaints the event.
- Recap (event masthead, staff): the router (task `draft`) writes a Slack recap from the roster by role, meals, checklist progress and the meeting extras (a plain template if the model fails); edit it, pick the channel (checkin-post v2 `channels`, #operations-mtl remembered per browser), Post to Slack (`say`: the bot joins a public channel it is not in yet; a private one needs the bot added) or Copy.
- The two body MutationObservers (119, 119b) are throttles, not debounces: the hub repaints small things constantly, so a reset timer never fired.

Not yet (cut 3): Ask the Hub roster commands ("add Mary as a cook on Oct 4"), inventory stock bars, recipe scaling and the shopping list.

## wave120: Marketing analytics

`#socialstats`, in the Marketing menu (adopted into the `.w42sub` and re-placed whenever wave116 rebuilds the bar; enrolled in the wave40 access model for admin/leader/member and anyone whose tabs include marketing; board viewers by link).

- Tiles per platform (Instagram, Facebook, TikTok, LinkedIn, Website): followers (or sessions) with the change over the window, three stats with the change against the previous window, a sparkline, the live/CSV/not connected/check state, last sync.
- By day: one SVG chart across platforms for reach, views, engagement, new followers or sessions over the window (7/30/90 days).
- This week's note: written by the router (task `digest`, caller `social-pull`) from the window's numbers and the top posts; staff can rewrite it.
- What worked: the best posts (reach/views/likes/comments/shares/saves), platform filter chips, most read website pages.
- Set up (staff): Meta (token in vault, Find my pages, Connect), GA4 (service account email to add as Viewer, property id, site), TikTok and LinkedIn CSV import with a column mapper (daily numbers or posts), account rows with Sync and Remove.

### Backend

- Migration `wa120_social`: `social_accounts`, `social_daily` (platform, account, day, metric, value; unique), `social_posts` (platform, external_id unique; reach, views, likes, comments, shares, saves, clicks, engagement), `social_notes`; read for staff and board; writes only through the function. `social_overview(p_days)` returns accounts, totals per metric for the window and the previous one, followers now/then, 90-day series, the top 24 posts and the latest note.
- Edge function `social-pull` v1 (verify_jwt off; staff JWT, service key or `x-wa-secret`): `status`, `probe`, `connect_meta {page_id}`, `connect_ga4 {property_id, site}`, `disconnect`, `sync {account_id?, days?}`, `import_csv {platform, rows, posts, handle}`, `note {days}`. Meta: `/me/accounts` (pages with `instagram_business_account`), the Page token from `/{page}?fields=access_token`, Page insights tried metric by metric (`page_follows`, `page_daily_follows_unique`, `page_daily_unfollows_unique`, `page_post_engagements`, `page_views_total`, `page_total_media_view_unique`, `page_media_view`, `page_video_views`, then `page_impressions_unique` as the fallback; whichever Meta still serves is stored), `followers_count` for today, `published_posts` with reactions, comments, shares and post insights. Instagram: `reach` and `follower_count` as daily series, the `total_value` metrics (views, profile_views, accounts_engaged, total_interactions, likes, comments, shares, saves) one call per missing day, media with per-media insights. GA4: `runReport` by date (sessions, users, new users, page views), Organic Social sessions, top pages; the service account (`GOOGLE_SA_KEY`, no delegation) must be a Viewer on the property.
- Cron: `wa-social-pull` 06:20 UTC daily (`sync`), `wa-social-note` Mondays 12:20 UTC (`note`).
- checkin-post v2: `channels` and `say {channel, text}` for the recap (and anything else that wants to post as the bot).
- Migration `wa119b_volunteer_merge_history`: `volunteer_history()`, `volunteer_merge(bigint, bigint)`.
- Secrets: `META_SYSTEM_TOKEN` (system user token from Business settings with pages_show_list, pages_read_engagement, read_insights, instagram_basic, instagram_manage_insights, business_management), `GOOGLE_SA_KEY` (existing).

### Meta set-up (sent to Steel)

Create a Business app at developers.facebook.com (use case Other, connected to the Welfare Avenue portfolio, stays in Development mode); Business settings > Users > System users > Add (`hub-analytics`, Admin); Add assets: the app (full control), the Page (full control), the Instagram account (insights); Generate new token (never expires) with the permissions above; store as `META_SYSTEM_TOKEN` in the Supabase vault, never in chat. Meta retired impressions and the fan metrics in November 2025 and most reach breakdowns in June 2026, so the Facebook tiles show views, followers and engagement; Instagram carries the richer set.

## wa116x: "HR centre is glitching"

Traced with `test/hrprobe.js` and `test/hrwho.js` (which functions write to the panel): 104 mutations every 4 seconds inside #hrcentre, all from wave116p's `decorateTabs` and `hero`. The tab-count painter rewrote the tab buttons' innerHTML on every pass, which woke its own observer (150 ms), so `decorate()` ran forever; each pass also rebuilt the hero with an `<h2>HR centre</h2>` that wave118's masthead code hid again 60 ms later, so the heading flashed six times a second and hover and click states on the tiles kept resetting. Fix: the hero and the tab counts only write when the markup changed (`data-html`), the hero lost its duplicate heading (wave118's masthead carries the title), and the watcher ignores childList changes inside the tab strip. `test/churn.js` then measured every page: a second loop in wave77 (`w77Num` assigning `textContent` on every pass across the hidden department panels) ran at about seventy mutations a second on every page since wave77; now idempotent, all pages sit at zero background mutations. While there: wave118's admin sections had no home for the Adoption board (`#w116rcard` was hidden in every section), so Admin now has an Adoption section (`#adminpanel/adoption`) and `test/w116pdrive.js` goes there.

## Tests

- `test/w119drive.js`: Home Got it, the month grid (prev/Today/Next event, stable across mutations), the event page (masthead, rings, next, columns, cards, rail), tick, status, drag (synthetic HTML5 events; Playwright's mouse drag does not raise drag events in headless Chromium), the bench with search and Add, the move select, remove, narrow viewport.
- `test/w119bdrive.js`: the Volunteers cards, badges, sort, search, role chip, duplicates filter and merge, plan the roster (roles short, candidates, one pre-tick per person, Jev odds, the inserts), the recap (draft, channel list, post).
- `test/w120drive.js`: nav placement, the team pill, tiles and deltas, sparklines, chart lines and metric toggle, note, posts and filter, period switch, sync and note calls, the set-up drawer (probe, Connect, GA4 form), TikTok overview CSV and a LinkedIn posts CSV through the mapper.
- Harness: 34 pages x 3 identities, only the expected `ERR_FAILED` resource loads.

## Follow-ups

- Run the first Meta pull with Steel once the token is in the vault; check which Page metrics Meta still returns and trim `FB_METRICS` accordingly.
- TikTok (Display API `user.info.stats`, `video.list`) and LinkedIn (Community Management API) applications; the CSV path covers them until then.
- Volunteering cuts 1b and 2 (above).
- The harness "member" identity is a synthetic mode (`MODE = 'member'`), so staff-gated pages (volunteering, analytics) fall through to Overview for it; in production every welfareavenue.com account is MODE staff.
