# 27/09/26 - wave151: the news banner moves to Home

Steel (27/09/26): "I see the news banner, I don't want [it] to be on the loading page, instead put it on the dashboard itself." Asked which page (staff land on Home, the board on the Executive dashboard), he chose Home.

Live md5 `45c22e45c441d46257b474b314de17d3` (4,132,541 bytes), through the gated pipeline (`wa_stage_ry`, dropped). Migration `wa151_news_home` (comments, Hub module 1, the Admin access profile; no schema change). New segment `151_wave151`.

## What changed

- **Home**: the news banner sits under the greeting and above the counts: the gold News label and the day's news scrolling on the green, admins' updates first. It is read live from `hub_reel_current()` when Home draws (again after ten minutes, and every half hour on an open page), so an admin's update shows at once. No news, no banner. Items with a link open it: a Hub page in place, a web page in a new tab; anything else is plain text.
- **Stopping it**: hovering or focusing it pauses it; the pause button stops it until pressed again (remembered in that browser). With reduced motion it shows one item at a time. A keyboard focus on an item brings it into view. Screen readers read the list once; the copies that make the loop seamless are hidden from them and from the keyboard.
- **The loading screen** keeps its rotating milestones, shout-outs, lessons, learnings and fun facts, and no longer shows or caches the news (`wa149reel` v3 holds only the lines and the shout-outs).
- **Admin, Loading screen and news** (renamed): the same lines, news and updates, now described as the news banner at the top of Home; taking an item off, putting it back, adding an update or rebuilding also refreshes the banner.
- **Who sees it**: everyone with Home (staff accounts). Board viewer accounts land on the Executive dashboard and do not have Home, so they no longer see the news (they did on the loading screen).
- **Training**: the Home tour has a News stop after the greeting; Hub module 1 describes the banner; the Admin tour and the Admin access profile say "Loading screen and news".

## Checks

- `test/w151drive.js` (26): placement, order and links (a Hub link, a web link, a disallowed link as text), the seamless loop and its hidden copies, hover, the pause button remembered across a redraw, keyboard focus, clicking through, the Home tour stop, reduced motion, no news, a board viewer, a phone.
- `test/w149drive.js` updated (42): no banner on the loading screen, the cache without news, the renamed Admin section.
- w150drive, w144drive and w112drive unchanged on the candidate; live against candidate for staff, the board and a member: only the Admin section's new name and the known HR centre timing flake differ. The live page passes w151drive and w149drive.
