# 09/10/26 - wave225 the Content Studio

Steel (09/10/26), after the Buffer comparison: "Okay go ahead and build it entirely on the content calendar. Make it the most sophisticated content calendar possible. Consider making it an app in the hub."

His choices:

- An app of its own in the 9 dots. The calendar and the analytics move in and leave the Hub menu.
- Marketing leads and admins publish. Everyone else sends a post for approval; the leads hear in the Hub and on Slack.
- The marketing team and admins answer comments. Deleting is for leads and admins.
- LinkedIn, TikTok and YouTube use the reminder flow until their connections are approved.

## What shipped (live a1593f2e, 09/10/26)

The app (`#studio`, rose tile, after Fundraising) has these sections:

- **Overview**: six numbers, the week ahead, what needs attention, approvals, weekly goals and streak, how each platform posts, latest comments and the best post.
- **Calendar**: wave121's calendar for six platforms.
  - The composer handles per-platform captions and formats, alt text and people tags, and a first comment.
  - It also does tracked links and UTM, Next in the queue, repeats, tags, the hashtag and template pickers, and Save as template.
  - It shows an approval banner, offers Send for approval to non-leads, has Mark posted per platform, can tailor a caption for each platform, and previews all six platforms.
- **Queue and schedule**: the next 14 days with free slots ("Fill with an idea"), the posting times per platform and weekday, suggested times from our own results, weekly goals, and the Instagram grid preview.
- **Approvals**: Waiting, Sent back, Mine and Approved; a note is required to send a post back.
- **Comments**: Instagram, Facebook, Threads and YouTube comments, checked every 10 minutes.
  - Actions: reply (saved replies, suggested replies), like on Facebook, hide, resolve, assign, and delete for leads.
  - It shows a comment score and the typical reply time.
- **Library**: templates, hashtag groups (warns past Instagram's 5), saved replies and tags.
- **Links and link in bio**: short links `hub.welfareavenue.com/l/<code>` with click counts, and the public page `hub.welfareavenue.com/links`.
- **Analytics** (wave120), plus a **Report**: a printable month with month-on-month change and a copyable summary.
- **Connections**: Meta (replace the token, permission chips), Threads, YouTube, TikTok and LinkedIn (app keys into the vault, Connect, Disconnect), Make.com for LinkedIn (webhook, filter code, sample, test post after a confirm), and the reminders card.

## Pieces

- **Database:**
  - `wa225_studio` holds the content_posts columns, the approval guard and its notify triggers, studio_submit and studio_decide, and the tables content_tags, content_snippets, content_slots, short_links, short_link_clicks and social_comments.
  - `wa225b_studio` holds wa225_click (the service role only), studio_settings_save, the crons wa-social-inbox (every 10 minutes) and wa-social-connect-refresh (Mondays), and `pages.studio` in every access profile: marketing, fundraising, executive and admin get all; other teams' leads get it; the board gets none.
- **Functions:**
  - social-publish v3 (verify_jwt off)
  - social-connect v1 (off; OAuth callbacks)
  - social-inbox v1 (off)
  - go v1 (off; public redirect)
  - hub-push v2 (the `studio` event)
  - host-sync v13 (`links/index.html`)
- **Site:**
  - `_redirects`: `/links` and `/l/*` go to the go function.
  - `_headers`: the strict policy for `/links`.
  - The page source is `build/links/src.html`, built by `make.py`.
- **Front end:** `build/parts225` builds `src/225_wave225.seg`. The patches to `121_wave121.seg` are `parts225/patch121*.py`, with their chunks in `parts225/c121`. The app frame lives in parts153 and the menu groups in parts127, parts131 and parts134.
- **Tour:** `w122.tours.contentstudio`, from trainings row `tour:contentstudio`. The key `tour:studio` already belongs to the Email studio from wave202.
- **Tests:**
  - `test/w225drive.js` (48 checks)
  - `test/w225links.js`
  - updated w153, w163 and w193

## Notes

- Live was rebased onto the parallel waves 220, 221, 222 and 226. The Studio says "the Hub", never "AI", as wave221 asks.
- The first comments sync read 27 Instagram comments; 25 are open, from the last 45 days.
- `wa_slack_ids` maps Ian to U057BRKP1R9, but his canonical delivery account is U0A7DF871FS. Approval and reminder DMs follow that map. Not changed: it is Steel's call.
- What Steel still has to do outside the Hub is in the Claude Doc "09/10/26 - Content Studio: everything to do outside the Hub". That covers the Meta token, the Threads tester, the Google Cloud client, the TikTok app, the LinkedIn Community Management API and the Make scenario.
