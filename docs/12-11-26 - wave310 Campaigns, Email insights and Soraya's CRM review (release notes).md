# 12/11/26 - wave310: Campaigns in the CRM, Email insights, buttons to a form or the donation page, and post notices

Status: READY, NOT LIVE. My session can't deploy to production, so Steel runs two steps: the edge functions, then the SQL. Undo: `12-11-26 - wave310 undo (only if needed).sql`.

Built against the live Hub page a52ac4e9 (wave309) and f/index.html da9c679f. Results: the page becomes 26f5c760 and the form page 5d6c1efd. Nobody is messaged by anything in this release.

## What was asked
- Soraya's CRM review at the 11 November marketing meeting. Keela closes on 5 December.
  - She couldn't find how to add a donation button, or how to put an existing form into an automation email.
  - She wants a campaigns tab or folder with everything about each campaign, for new people.
  - The photos in the Hub don't match Google Photos.
  - She wants a monthly email recap showing the best send times.
  - Ian wants send-time A/B tests.
  - She wants a video preview that links to the full video.
- Steel: "go ahead and make this all capable for Soraya and others using the crm".
- Steel, on post approvals: "should be sent by notification on slack to Ian's active account and KK. They should also get a notification once it's approved and sent out".

## What changes

**Campaigns (CRM, Campaigns and giving > Campaigns, `#crm/folders`)**
- Every campaign in the CRM (`wa_campaigns`) gets a folder:
  - what it is: the why and the how, for someone new
  - key facts
  - links: https only, such as the Drive folder, the rules, the one-pager and Canva
  - hashtags
  - which Content calendar posts belong to it
- It also shows what the Hub already knows about the campaign:
  - the forms filed under it, with their live links and answer counts
  - its posts and their state
  - gifts and the goal, as a progress bar
  - the donation link to copy
  - the Fundraising event it belongs to, with its volunteers
- Anyone on the team with the CRM can add a campaign and edit a folder. The donation key stays with admins.
- Folders filled from what was already said and known:
  - **Gift Basket Drive 2026**: the $5,000 online goal and 6,000 gifts, the volunteer roles and the forms.
  - **One Bag Challenge 2026** (new):
    - target $3,000 to $4,000
    - what $20 to $25 fills
    - launch the week of 16 November
    - the hashtag #onebagchallenge
    - where the rules live: their links still need adding.
  - **Rally Paper 2026** and **Football Fundraiser 2026** are linked to their events.
- Checked against live data in a rolled-back run: the Gift Basket Drive shows 8 forms, 10 posts and the $750 gift.

**Email insights (CRM, Email > Email insights, `#crm/insights`)**
- Each month: sent, delivered, opened, clicked, unsubscribed and bounced, for the Hub's own emails (not tests).
- When people open: a weekday by time-of-day grid in Toronto time, and the best window.
- "Find our best send time": Ian's four slots to rotate, one a week.
- **Opens and clicks are not counted today.** Resend has never sent the Hub an open or click event: 283 sent and delivered events, nothing else. The page says so. To fix it, an admin does two things in Resend:
  - Domains > welfareavenue.com: turn on open and click tracking.
  - Webhooks: add `email.opened` and `email.clicked`.

**Point it at a form or the donation page**
- In the email studio's Button block, and in an automation's own email under Button and Button link, there's now a list to pick from:
  - Our donation page, or a donation campaign's page (`/give?c=gift-basket-drive`)
  - any live form (`/f/<slug>`)
- Picking one fills the link, and fills the button's words if they're empty.
- A saved studio template still reaches automations as a "Saved email", so a form button can now go into any automation.

**A donate button on a form's thank-you**
- In Forms, the editor has a new box: "Show a donate button on the thank-you page", with the button's words and which campaign the gift counts for.
- form-submit v13 passes it to the public page, which shows a gold button to our donation page. It only accepts our own `/give` link, in the form's language.

**The Photo library**
- A new card, "The albums in Google Photos": the team's albums, plus "+ List an album" and "Add photos to the library".
- The year counts now say "in the library".
- Why there's no automatic sync: Google stopped letting other apps read Google Photos albums on 31 March 2025. Only the Picker API is left, where a person picks photos by hand. Today the library holds the photos picked in September, which is why it showed only Flag Football for 2026.

**Video in emails**
- This already exists: the studio's Video card shows a moving preview and opens the full video when tapped, including a Google Drive link. Nothing to build.

**Post approvals on Slack (social-publish v7)**
- Already in place since wave241: a post sent for approval DMs Ian and KK (`hub_settings` content_studio approvers). Ian's DM goes to his personal Slack account U057BRKP1R9, the one he uses (pinned 05/11).
- New: when Ian or KK approves or sends back a post, the other one hears too.
- New: when a post goes out (published, or marked posted), the sender, the owner, Ian and KK each get "it went out" with the links. The person who pressed Publish doesn't.
- Note: no post has ever been sent for approval in the Hub (every post's approval status is "none"). Joy's Friday post went out another way, so the approval flow has never actually run.

## Database
- `wa_campaigns`:
  - new columns: brief, facts, links, hashtags, post_names, fund_event_id, updated_at, updated_by
  - the type check now also allows `challenge` and `other`
- New functions: `wa310_campaigns`, `wa310_campaign_save` and `wa310_mail_insights`. All are for staff with the CRM, with the check inside, and saves are logged in change_log.
- New table `wa_photo_albums`: staff read and add, board viewers read, admins delete, share links only.
- New trigger `trg_wa310_post_out` on content_posts, using `wa310_post_out`. Switched off with app_config `studio_notify` off.
- New `trainings` rows: `tour:crmcampaigns` and `tour:crminsights` (Hub page tours).

## Tests
- `test/w310drive.js`: 46 of 46. Covered:
  - the rail
  - the list, new campaign, the folder and editing (an http link is refused)
  - insights
  - both pickers
  - the form editor's donate box, and Save writing `settings.donate`
  - the public form page: our link shows a button; no link or a foreign link shows none
  - the Photo library card
  - phone width with no sideways scroll, and no page errors
- Regression:
  - w156 26/26, w157 26/26, w288 30/30.
  - w202 87/88: the one failure (Amara's permission line) fails on the live page too.
  - The rail-list checks in w156, w157 and w202 now include Campaigns and Email insights.
- The database part ran on the live project as a rolled-back transaction:
  - staff could read and save; an http link and a bad album URL were refused
  - an outside account was refused
- The page edits and the undo ran in a local Postgres copy: the md5s matched, a second run was refused, and the undo restored both pages.

## Not done
- The send-time test is a plan on the page, not automatic scheduling.
- A Google Photos Picker ("bring photos in from Google Photos") would need a Google Cloud OAuth client with the Picker scope.
- The links to the One Bag rules (the volunteer document and Steel's one-pager) need adding to its folder.

Source: branch `claude/wave310-crm-campaigns`, commit 6d1d998 (fn/social-publish, fn/form-submit, build/f, build/parts310, test/w310drive.js).
