# 15/10/26 - wave241: approvals in the Content Studio, the Canva link, LinkedIn articles, posts by partner

Steel, 14/10/26 marketing meeting: "Robert schedules the posts, it goes to approval, and it's sent a message [...] to you
and KK, and it's like a button, you can literally just click a button to approve in Slack, or you can do it in the hub."
Ian: the content approval method "so that we don't have to rely on sending Slack messages, waiting a couple of days".
Roberto: the LinkedIn article, and last summer's article he could not find. Live 15/10/26 about 12:55 Toronto.

## Scheduling goes to approval
- Someone who cannot publish (not an admin, a marketing lead or a named approver) sees "Schedule for approval" once the
  post has a date (else "Send for approval"): the post keeps its date, waits as pending, and goes out at that time once
  approved (studio_decide already scheduled an approved post with a date). The toast says so.
- The database says the same for every other path: `wa225_post_guard` turns a non-publisher's "scheduled" into a pending
  draft (date kept, submitted_by, submitted_at) and asks social-publish to tell the approvers at once, instead of raising
  "needs approval". Publishing by hand still raises.

## The approvers: Ian and KK
- `hub_settings content_studio.approvers` (emails): the people pinged when a post waits. Set to Ian and KK by the
  migration; the Approvals page has an Approvers box (publishers only) that saves it through studio_settings_save. Empty
  means every publisher (the marketing leads and admins), as before.
- `wa241_approvers()` reads it; `wa225_publisher()` also counts a listed approver as a publisher, so they can approve and
  publish whatever their Hub role.

## Approve or Send it back from Slack (social-publish v4, platform 12)
- The pending DM goes to the approvers (minus the sender): who sent what, the platforms and time, their note, "Open the
  design in Canva" when the post has a Canva link, then three links: Approve, Send it back, Open the Studio. Approve opens
  `hub.welfareavenue.com/#studio/approvals?post=<id>&do=approve`: the Hub, once signed in, approves the post on the spot
  (an approver only; "Already approved by ..." when someone was first). Send it back (`do=back`) opens the Approvals page
  on the card with the note box focused (a note is required). The Hub notification carries the same link.
- The decision DM to the sender is unchanged (approved and the time it goes out, or the changes asked).

## The composer (build/src/121_wave121.seg, patch121f.py)
- Canva design (optional): the link, with Open in Canva; the approval card shows Open in Canva too.
- Partner organization (optional): a select over wa_partners (content_posts.partner_id).
- LinkedIn article: a switch shown when LinkedIn is among the platforms; the name above is the headline, the caption the
  body; the preview shows the article look; format `article`. LinkedIn articles are posted by hand: the reminder flow at
  the post's time, then Mark posted with the link.
- Saved through rowFromEdit (canva_url, partner_id, format).

## Library > By partner (build/parts225/g_library.js)
- A partner picker; every post that names the organization, newest first, with the platforms, the state, the date, a
  "LinkedIn article" mark, Open, Canva and Link. `#studio/library/partners?partner=<id>` opens it on a partner.

## Deploy
- Database: build/data/wa241_approvals.sql (migration wa241_approvals): content_posts.canva_url, partner_id (+ index);
  wa241_approvers(); wa225_publisher() re-created; wa225_post_guard patched in place; the approvers setting; no row deleted.
- Edge: social-publish v4 (platform 12). Note: the platform showed a version 11 deployed by the Meta session (waves 250+)
  between 14:45 and 15:45 UTC; it was not in the repo, so v4 was built on v3 and that session must re-apply its change
  on top (Steel was told).
- Front end: index.html ed7af015e2f251d39a44e426ead1318c over 35c48f8a.
- Tests: test/w241drive.js 15 of 15 (the Approvers box and its save, Open in Canva on the card, the Approve link, the
  Send it back link, By partner, the composer's three fields and their save, a member's Schedule for approval and no
  approving from the link); test/w225drive.js (the member's intro wording updated) and test/w121drive.js unchanged.
