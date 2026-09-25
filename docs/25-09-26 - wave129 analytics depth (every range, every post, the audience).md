# 25/09/26 - wave129 analytics depth: every range, every post, the audience

Live md5 `dc8c3c44b3593c74418836d6e446d0d1` (3,487,381 bytes), deployed through the gated pipeline (`wa_stage_qx` then a small follow-up through `wa_stage_qy`, each guarded on the live md5 and dropped after). Migration `wa129_social_range` and `wa129_social_range_prev` (file: `build/data/wa129_social_range.sql`). Edge function `social-pull` v1.6 (deployed as version 8).

## What Steel asked

"More granular data from Instagram and Facebook", "even do WhatsApp maybe", and "look as far back as possible in time for analytics and have all analytics, as many as possible, visible to me."

## What the Analytics page has now (Marketing, Branding & Web > Analytics)

- **Any range.** 7, 30 or 90 days, 6 months, 1 year, 2 years, all time, or two dates (Custom, in either order). Up to 120 days the chart goes by day, up to 540 days by week, and beyond that by month. A week or month only partly inside the range, or only partly counted by a platform, is drawn dashed so a short last month does not read as a drop. The ticks are monthly or quarterly with the year on long ranges, and all time starts where the numbers start rather than in 2020.
- **Honest comparisons.** The change against the previous period only shows when that period is at least 90% covered. A two-year range has no previous two years (Meta keeps two years), so it shows the totals without a misleading percentage.
- **What the numbers say and What worked follow the range.** The evidence header names the range, the posting rhythm counts the platforms actually in the posts and ends at the end of the range, and the post dates carry the year once the range is long.
- **Every post.** Every post in the range (up to 3,000) with reach, views, likes, comments, shares, saves, clicks, engagements and the engagement rate (engagements over reach, or over views where a platform gives no reach). Filter by platform, type (posts, reels, videos) and words in the caption; sort any column (blanks last); show 50 more at a time. On a phone each post is a card with reach, views, engagements and rate, and a sort menu stands in for the column headers. "Download these posts (CSV)" saves exactly what is filtered.
- **Who follows us.** Instagram followers by age, gender, top cities and top countries (from the API, refreshed weekly); LinkedIn followers or page visitors by industry, seniority, job function, location and company size (from the export). Shares are of everyone counted, or of the follower total when that is larger, so city shares are shares of all followers.
- **How far back.** Each platform's daily numbers and posts, and what the platform keeps. Staff get Load more history (Facebook, Instagram, the website) with a progress bar, Set the total for LinkedIn, and Check for WhatsApp. Everyone gets "Download the daily numbers (CSV)".
- **The page tour** covers the new sections, and the academy lesson "Page tour: Marketing analytics" says what the page now holds (3 minutes).

## What the data holds today (September 25)

- Instagram: daily numbers since September 26, 2024 (730 days) and all 326 posts and reels since September 2020, with reach, views, likes, comments, shares and saves.
- Facebook: daily numbers since September 25, 2024 (731 days) and all 281 posts since October 2020, with reach, views, reactions, comments, shares and clicks.
- Website (GA4): daily sessions, visitors, new visitors, page views and visits from social since September 25, 2024, and the top 25 pages.
- LinkedIn: the export's year (September 24, 2025 to September 23, 2026) and 37 posts.
- In all: 18,780 daily numbers across 20 measures and 644 posts.

## What the platforms do not give

- Meta keeps two years of daily Page and account numbers; older posts keep their own numbers.
- Instagram only gives the follower total for the last 30 days, so the follower change over a long range starts when the Hub started collecting.
- Meta no longer shares Facebook Page audience breakdowns (age, gender, city) through its API; Meta Business Suite still shows them.
- LinkedIn has no API access for the Page yet; the export covers a year at a time and has daily new followers but not the follower total.
- WhatsApp: the Meta token can read WhatsApp, but no WhatsApp Business account is shared with the Hub's system user. The WhatsApp Business app on a phone has no analytics API; the WhatsApp Business Platform does.
- TikTok's analytics API needs an approval first; its CSV export works in Set up.

## For Steel

1. **LinkedIn follower total:** type the total shown on the LinkedIn Page into How far back > LinkedIn > Set the total. The Hub rebuilds the year of totals from the daily new followers (new followers do not net out unfollows, so earlier totals are close, not exact).
2. **WhatsApp:** if Welfare Avenue uses the WhatsApp Business Platform, in Meta Business settings go to Accounts > WhatsApp accounts > the account > Assign people > the Hub's system user, then press Check. If it is the WhatsApp Business app on a phone, there is nothing to connect.

## Release checklist

- Access: no new page; the Analytics page keeps its profile settings. The buttons that change data (Load more history, Set the total, Check) are for staff, and `social-pull` only accepts Welfare Avenue accounts. `social_range()` answers staff and board viewers only; anon can no longer execute it.
- Training: the Analytics tour gains Every post, Who follows us and How far back, and its time window and chart steps are rewritten; the academy lesson text and length are updated.

## Backend

- `social_range(p_from, p_to)`: totals with the previous period (only when 90% covered), followers now and then, series by day, week or month, the top 24 posts, every post in the range, the top pages, coverage per platform, the note and the insights. All time is from the first daily number or the first post. Timing: 30 days 53 ms, 2 years 151 ms, all time 638 ms.
- `social-pull` v1.6: `backfill` walks one account back a step at a time (Facebook and Instagram daily numbers to two years, every post and reel with its numbers, the website since the property started), weekly Instagram demographics in the sync, a WhatsApp check in `probe`, GA4 pages merged before saving (one row per page).

## Verification

`test/w129drive.js` with a synthetic `social_range()` (`test/w129data.js`): admin at desktop 40 checks (ranges, custom dates, chart buckets and ticks, dashed part periods, all time from the first number, the table's filters, search with the focus kept, sorts, show more, both CSV downloads, the audience order and shares, the coverage states, Load more history step by step, the WhatsApp check, the LinkedIn rebuild, no blanking on wave120 repaints, the tour with every section, no idle churn), admin on a phone 38, a marketing lead 39, a board viewer 35 (reads, no buttons). Harness 38 pages x3 against the live build: only the Analytics page differs. Churn clean on every page. Drives for waves 122 (35/35), 124, 125, 126, 127 and 128 green. Live md5 matches the build.
