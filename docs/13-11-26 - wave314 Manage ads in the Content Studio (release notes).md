# 13/11/26 - wave314: Manage ads in the Content Studio (marketing leads only)

Status: the server side is LIVE; the page needs two steps from Steel (below). Undo: `13-11-26 - wave314 undo (only if needed).sql`.

The number 314 was also used for yesterday's Toronto release (12/11/26). That one changed only data and kept its backup in `site_files_bak_w314`. This one keeps its backup in `site_files_bak_wa314` and its page code under `w314`/`M314`. They don't touch each other.

## What was asked
- Steel pasted a Meta Marketing API token (ads_management, ads_read, read_insights) and asked: "Please add this functional in content studio".
- He chose all three uses, "but only marketing leads":
  - boost a published post
  - build a campaign as paused, to check in Ads Manager
  - pause, resume and change budgets

## What changes
**Content Studio > Results > Paid (`#studio/ads`)**
- A new **Manage ads** card under the Paid numbers, shown only to marketing leads.
- The ads token's state: who it belongs to, whether it can manage ads, when it expires (amber under 14 days), and the spending limits.
- Each running or paused campaign shows:
  - its status (Running, Paused, In review, or an issue)
  - its budget and what it spent in the last 7 days
  - **Pause** or **Turn on**, **Budget** (change it in place), and **Ads Manager**
- **Boost a post**:
  - Pick a Facebook or Instagram post from the last year.
  - Then the ad account, the goal (engagement, reach, or link visits for Facebook), and the place: Montreal 25 km, Toronto 25 km, both, or Canada.
  - Then the ages, a daily or total budget, and the start and end dates.
  - It says "it can spend up to $X" before anything is sent.
  - **Save as paused** builds it switched off. **Launch now** asks a second time ("Yes, spend up to $X") before it goes.
- **Recent changes**: the last 8 actions, with who did what.
- Everyone else sees the Paid card as before, labelled read-only. Their page never calls the new function.

**Who counts as a marketing lead** (`wa314_ads_lead`):
- the named approvers, plus leaders and admins in the marketing team
- today that's Ian, KK and Eduardo
- Steel and Suhaib (admins outside marketing) keep read-only, as asked

**Guards, enforced by the server, not the page** (`social-ads-manage` v1):
- Spending limits in hub_settings `studio_ads_limits`: $50 a day, $300 per boost, 30 days. An admin can change them.
- Every boost needs an end date.
- Only Welfare Avenue's own ad accounts. A campaign is only paused or changed after Meta confirms it belongs to one of them.
- A boost that fails part way deletes what it made.
- Every action goes in `social_ad_actions` and change_log.
- A launch, a turn-on or a budget increase DMs the other leads on Slack.
- The token stays on the server, never in the page.

## Live already (done in this session)
- Edge function `social-ads-manage` v1 (verify_jwt off; it checks the caller itself). Signed-out calls get 401.
- Migration `wave314_ads_manage` added:
  - `wa314_ads_lead()` and `wa314_ads_leads()`
  - the table `social_ad_actions` (leads and admins read; only the function writes)
  - `studio_ads_limits`

## Steel's two steps
1. **Add the token**: Supabase > Edge Functions > Secrets > add `META_ADS_TOKEN` with the token from the Marketing API page.
   - Until it's there, the card says the token isn't set, and nothing can change.
   - The function reads this secret first and the vault second. It never uses the read-only system token.
2. **Publish the page**: run `13-11-26 - wave314 release.sql` in the SQL editor.
   - It was made against Hub page 095f882d (after wave340) and gives 04a6163f.
   - It stops on its own if an edit no longer matches.

## The token
- It came from the Marketing API quickstart, for an app on the **development_access** tier. That tier is fine for Welfare Avenue's own ad accounts, at low rate limits.
- Tokens from that page are user tokens and usually expire. The card shows the date.
- For something permanent: a system-user token with ads_management in Business Settings, put in the same secret.
- It was pasted in chat once. If that's a worry, generate a fresh one before adding it.

## Tests
- `test/w314drive.js`: 46 of 46, run on the stubbed Hub (Meta stubbed, nothing sent), for a lead and a non-lead, on desktop and phone. Covered:
  - the card drawn only for a lead
  - the token line and the campaigns
  - Pause, and a budget of 15 a day
  - the boost summary ($80 for $10 a day over 8 days)
  - over the daily limit, Launch is blocked
  - Launch asks twice, and the request carries the right post, account and dates
  - no sideways scroll, and no page errors
- Not yet tested against Meta itself: that needs the token in place. First real test: Boost a post > **Save as paused** on a small budget, then check it in Ads Manager and delete it there.

## Not done
- Steering a boost toward a specific Meta audience or interest. Place and age only, for now.
- Quebec and Ontario as places: Meta's region codes weren't verified, so they're left out rather than risk the wrong province.
