# 27/09/26 - wave149: the loading screen, attendance in the HR centre, Analytics hover and post photos

Live md5 `07dcbc32db5e60807941b4e81e58f9b7` (4,111,116 bytes), deployed through the gated pipeline twice (`wa_stage_rv`, then `wa_stage_rw` after the review; both dropped). Data: migrations `wa149_reel`, `wa149_posts`, `wa149_attendance`, `wa149_cron`, `wa149_reel_fix`. Functions: `hub-reel` v9 (new), `social-pull` v11 (v1.7), `shoutouts` v6 (v1.1). Model route `reel` (Sonnet 5, then Haiku 4.5, then GPT-5 mini).

Steel (27/09/26): "On the loading page: I want you to put learnings, lessons, and milestones along with shoutouts. I've been seeing more shoutouts. And refresh it every week. Also at the bottom, I'd like for you to add sort of like a news banner of events that happened recently, updates that the organization should know about." "For attendance, I dont think it should be on the department overview page. I think it should only be seen on the HR center or in one of the admin pages." "For the analytics graphs in marketing, I'd like to be able to hover accross to and see numbers." "The photos from instagram posts don't show up."

## The loading screen

- The first-paint script (000_head_base) rotates five kinds in turn, one of each before any repeats and in a random order each time: milestones, shout-outs, lessons learned, learnings and the fun facts. Each line stays up for 3.2 to 6.5 seconds depending on its length. Before, two lines in three were shout-outs.
- The week's lines come from `hub-reel`, rebuilt on the first morning run of each week (Monday, Toronto): six lessons (Our story's lessons learned, not repeated for eight weeks), up to four learnings (what volunteers said after recent servings, the latest Analytics insights, Google Search once connected) and up to five milestones (this week in our history, wins from team meetings, highlights). The model shortens them to one sentence each (route `reel`); templates if it cannot.
- The news banner along the bottom scrolls the day's news: the next servings, a thank-you after a serving that happened, fundraising events coming up or done, people who joined a team, wins from team meetings, and admins' own updates first. Rebuilt every morning (cron `wa-hub-reel`, 10:21 UTC). With reduced motion it shows one item at a time.
- The screen can only use what the browser kept from the last visit, so after sign-in the page stores this week's lines, today's news and the Hub's own shout-outs (`wa149reel`). It shows them only while the browser holds a Hub sign-in, news only from today or yesterday, and the cache is cleared on sign-out, for a former member and when the read fails. The older shout-out cache (`wa116s`) is no longer written or read.
- Admin, Loading screen (admins): this week's lines by kind and today's news, each with Take off and Put back; an update for the banner (under 140 characters, until a day, two weeks by default); Rebuild now. What is taken off stays off for 120 days, across days and weeks.

### Confidential by design

Everyone sees the loading screen (staff, volunteer leads, the board), so nothing about leadership changes, roles, anyone leaving, HR matters or pay reaches it, and nothing describes the people we serve:

- wins only from team meetings (never board, leadership or executive meetings, nor a private or board-only transcript); welcomes only for people joining a team; no hire announcements (shoutouts v1.1); no event audits;
- a filter on every line (roles and titles, promotions, handovers, departures and farewells, succession, the board and executive team, HR and pay words, and words that describe the people served), applied after the model writes and again to shout-outs in the page;
- only the Hub's own shout-outs (kind `auto`); ones staff post stay in the HR centre;
- the change log records which line was taken off without repeating its words.

## Meet attendance: the HR centre only

The team pages and the Board overview no longer show attendance. The HR centre card (admins and the Executive profile) now opens each team's last eight meetings in place (click a team: the strip, who came, who is not on the invite) and lists the board meetings (the last one's turnout, each director over twelve months). The database follows: `meet_meetings` and `meet_attendance` are read by `wa_org_editor()` only. The access profiles, Hub modules 2 and 9 and the tours say so.

## Analytics: hover for the numbers

Hovering across the main graph shows a guide line, a dot on each platform's line and a card with the date (day, week or month) and each platform's number with the total; the platform tiles' lines and the Google Search line do the same; the insight bars and the audience bars show their counts. A tap and drag works on a phone, and the arrow keys when a graph has focus.

## Post photos

They never loaded: the Hub's content security policy only allows images from the Hub and its Supabase project, and Meta's links expire after a few days. `social-pull` v1.7 copies each post's photo into `content-images/social/<platform>/<id>` (all 587 copied on the day; each sync copies the new ones; only Meta's hosts, 15 seconds and 8 MB at most, an expired link is asked for again), and the Analytics functions hand the page that copy. A photo that still cannot load shows the platform mark.

## Review

An independent review found two leaks and four other issues, all fixed before closing: the welcome template and meeting wins could carry role and departure news past the filter; staff-written and hire shout-outs reached the loading screen unfiltered; taken-off lines came back the next day; the change log repeated hidden text; the browser cache outlived access. All fixed (above), plus a locked replace for each rebuild (`hub_reel_replace`), a new-year fix for "this week in our history", and limits on the photo copy.

## Checks

- `test/w149drive.js`: 45 checks (the rotation and the banner, reduced motion, the cache and its rules, Admin > Loading screen, attendance in the HR centre only, the hover with mouse, keyboard and touch, the photo fallback). `test/w144drive.js` rewritten for the HR centre only (27). w143, w145, w146, w147 and w129 pass unchanged; w120drive fails the same way on the live build before this wave (test drift).
- Live against candidate on every page for staff, the board and a member: only Admin and the HR centre differ, as intended.
- In the database: a line taken off on one day is not re-added on the next (rolled back); an HR member who is not an admin reads no attendance, an admin reads all of it.
