# 26/09/26 - wave147: Google Search in Analytics

Live md5 `93349ceb1eff4d1ce301b95f0ee1e70b` (4,073,756 bytes), deployed through the gated pipeline (`wa_stage_rt`, guarded on the live md5 `e6645074` and dropped after). Data: migrations `wa147_search` (three tables, read like the rest of Analytics) and `wa147_search_cron` (the daily read and the profiles). Function: `search-console` v1 (new). Page: segment `147_wave147`.

## What Steel asked

"go for all the above": the Google projects the delegated access opened. This is the fifth, Search Console in Analytics.

## Where it stands

Built and live, waiting for one step only Steel can take. The Search Console API answers for both the Hub's service account and Steel's account, but neither can see the Welfare Avenue property yet. In Google Search Console: open the Welfare Avenue property, Settings, Users and permissions, Add user, and add `wa-hub-drive@welfare-avenue-dashboard.iam.gserviceaccount.com` (the same account Google Analytics uses) with Restricted permission. The daily read then connects on its own and fills 90 days of history; nothing else to do.

## What it shows

On the Analytics page, under the platform tiles, a **Google Search** card: clicks from Google, how often Welfare Avenue appeared in results, the share of those who clicked, and the average position, over the last 28 days of data against the 28 before; the clicks day by day; the ten searches that brought the most people and the pages they opened. Google reports about three days late, and the card says which days it covers. Until it is connected, staff see the one step above in the card; directors see nothing.

## How it works underneath

- `fn/search-console/index.ts`: `sites()` lists what each identity can see (the service account itself, then Steel through delegation); `pick()` prefers the domain property (`sc-domain:welfareavenue.com`) to the https one; `sync()` connects when nothing is connected, then reads `searchAnalytics.query` by date (90 days the first time, then 10) and by query and page for the last 28 days of data, replacing `search_top` each time. A failed read is kept on `search_sites.last_error` and shown in the card.
- `147_wave147.seg`: reads the three tables, draws `#w147` after `#socialstats .w120tiles`, and puts it back when the page repaints; asks the function for the service account's email (once, with one retry) for the setup line; a step in the Analytics tour.
- Search data sits in its own tables, not in `social_daily` or `social_posts`, so the social media lists, insights and charts are unchanged.

## What the challenge changed

- The first plan stored searches as Analytics "posts": they would have shown up in the social media lists and insights. They have their own tables.
- It would have needed Steel to come back and press connect. It connects itself on the first daily read after access is given.
- The setup line would have shown a placeholder when the page asked before the Hub was ready. It asks once more after a few seconds.

## Release checklist

- **Access:** three tables readable by staff and directors (like Analytics), written only by the function; the Marketing and Executive profiles mention it.
- **Training:** a step in the Analytics tour.
- **Security review:** read-only scope; the service account needs only Restricted access in Search Console.
- **Tests:** `test/w147drive.js` (12 checks with made-up numbers: its place, the four figures and their change, the chart, the top searches and pages, the window, the tour, the setup line with the service account, a director before and after it is connected, no page errors). The harness differs only on Analytics (the card) and known timing noise.
