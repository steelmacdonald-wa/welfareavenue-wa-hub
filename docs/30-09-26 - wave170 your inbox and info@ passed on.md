# 30/09/26 - wave170: Your inbox (the assistant for your own mailbox), and info@ passed on

Steel (29/09/26): "I'd also like for Jev to review my steel.macdonald@welfareavenue.com emails as well and to start categorizing them in to my different folders, sending them to the necessary teams, and helping me draft replies in a reply tool that asks me questions to clarify how to respond to individuals the emailed me. It needs to use /steel-writing:steel-voice /steel-writing:wa-writing to make sure replies sound like me. This is a tool I'd like to roll out to others later" and "Also with info@welfareavenue.com we get a few emails there as well that needs to forwarded to the correct groups and individuals with a brief note of an ask of what they should take action on."

His choices: the assistant files his mail into his folders by itself, every 15 minutes (a switch in its settings); the rest waits for him; a reply is a Gmail draft he sends himself; it is per person and only the owner sees it; personal mail is left alone; an email he sends to a team lands in the team's Hub inbox with his one-line ask (their channel hears about it; nothing is emailed). info@ mail is passed on automatically through the Hub and Slack: a DM for a person, the channel for a team.

## Your inbox

A card on Home, **Your inbox**, for the people whose mailbox the assistant works on (Steel for now): how many emails wait on a reply, how many a team could handle and how many were sorted today, when it last sorted and on what schedule. **Open your inbox** (or `#mypage/inbox`) opens the assistant full screen:

- **To reply.** What needs his own reply (Jev's call: a question or a request to him, an invitation, someone waiting on him; never a newsletter, a notification or an update). Open one to read it and its thread. **Help me reply** asks only what it needs to know (his decision, a fact only he knows, how far to commit), each with likely answers to tap or his own words, and a line for anything else. **Write my reply** drafts it in his voice (the steel-voice and wa-writing guides, condensed into his own settings): anything he did not give goes in [brackets], and **Before you send** lists what to fill in. He changes anything, then **Save as a Gmail draft** puts it in the thread in his Gmail (reply or reply to everyone); a part still in [brackets] is pointed out first. Nothing is ever sent for him. **I replied already** and **No reply needed** clear it; a reply he sends from Gmail clears it by itself.
- **For a team.** What a team could handle (outside mail: a colleague's email is already with a team), with the team the assistant thinks of and a first line written for it (**Suggest the line** writes another). He can change the team, pick one person on it, and edit the line; **Send** puts the email in that team's Hub inbox with his line first, and their channel hears about it (or the person gets a Slack message). **Not for a team** keeps it with him.
- **Sorted.** The last three weeks by day: the folder each email went into (and whether it also left the inbox), what was left in the inbox, how many personal emails were left alone, anything that could not be sorted (**Try again**), and **Take the label off** for a folder it got wrong.
- **Settings.** The 15-minute sorting (on), how far back it looks, his folders with a few words each on what goes there (so the sorting gets it right) and a tick for the folders whose mail also leaves the inbox (none by default), **Read my folders again**, and the never-read list: senders and words in a subject that are left alone before anything reads them.

How it sorts: every 15 minutes it looks at new mail in his inbox (the last 3 days, 25 at a time). It adds a folder only when Jev is sure (70%), marks a team when it is fairly sure (60%) and a reply when it is more likely than not (55%). Personal mail is left alone: the owner's own senders and words, and sensitive subjects for everyone (health, support groups, family matters), before any model reads it; then Jev's own call. Only the message id is kept for those, so they are never read again. The change log gets counts, never a subject or a sender.

The first sort (30/09/26, run with the settings as he chose them): 25 new emails, 8 filed in his folders, 3 to reply (one he had already answered), 9 for a team, 1 left alone as personal. Then the 15-minute sorting was switched on; its first run sorted the other 20 of the last three days (6 filed, 2 to reply). Team suggestions on colleagues' own emails were then cleared (8), leaving 9 outside emails for a team.

## info@ passed on

Mail to info@ reaches hub@, where the Hub inbox already reads everything. Now an info@ email that is not noise is passed on:

- The Hub picks the team and, when a role clearly fits, the person, and writes one line of what to do ("Send Robert Chen his tax receipt for the $250 he gave on August 14.").
- It lands in the team's inbox (the Requests page and the team's overview page) with that line first, marked info@. The person gets a Slack message; for the whole team, the channel does.
- When someone on the team is already on the email (they wrote it, or it went to them too, as in a volunteer thread Ahmed is answering), it is filed quietly: the line is there, and nobody is pinged about a thread they are in.
- Security mail (codes, password resets, sign-in and security alerts) is never filed or passed on, whichever address it came to. A meeting invite's "Passcode:" line does not count.
- Invoices and job applications sent to info@ go where they always went (Finance's board, Recruitment) and are passed on with the line too.

In the last week, 15 emails reached info@: DMARC reports, newsletters, security codes and a volunteer thread Ahmed was already answering. Under these rules one would have been filed quietly for Ahmed and none would have pinged anyone.

## Also

- The team inbox shows the line first ("To do:") for info@ emails and emails sent on from someone's inbox, says who heard (Sent to Alexis, the channel, or Filed quietly), and **What the Hub did** says it plainly. The Hub inbox page (leaders) shows them too: info@, passed on (to whom), info@, filed quietly (who is on the email), Sent on from an inbox, and Applicant (in Recruitment).
- Moving an info@ email to another team clears the person it was for; an email sent on from someone's inbox stays that when moved.
- Training: Hub module 1 (Your inbox on Home), Hub module 4 (info@ emails and emails sent on, in the team inbox), the Home, Requests and Hub inbox page tours; the team profiles say each team answers the emails in its inbox too, info@ ones included. The Home tour has a stop for the card (only for the people it is on for).
- Access: Your inbox is not a page in the access profiles; it is on for the people with a row in `mybox_owners`, and only for their own mailbox.

## For Steel

- Nothing to do. It is sorting every 15 minutes now; open **Your inbox** on Home.
- Worth two minutes in **Settings**: a few words on what goes in each folder makes the sorting sharper, and tick any folder whose mail should also leave the inbox.
- Rolling it out to someone else later is one row in `mybox_owners` (their Welfare Avenue address, on) and, if they want replies in their own voice, their own drafting guide in that row.

## Releases

- Functions: `mybox` v1 to v1.3 (versions 1 to 4: the prompts written for any owner, sensitive subjects left alone for everyone, bulk mail never waits on a reply, colleagues' mail not offered to a team), `mail-pull` v10 (versions 19 to 21), `team-inbox` v1.3 (version 11).
- Migrations: `wa170_inbox` (20260930100000: `mybox_me`, `mybox_owners`, `mybox_mail`, `hub_mail.mailbox`, `ask`, `assignee_email`, `forwarded_by`, the routes `mybox_sort` and `mybox_reply`, Steel's row, the cron job `wa-mybox-sort`), `wa170b_wording` (20260930110000: the notes say personal mail plainly; the recorded wa170_inbox no longer carries an owner's voice, which lives in their row only), `wa170c_training` (20260930120000).
- The page: `75c6e7bd6b6e4df3284f5241559065fc` to `040084275c40a3be0d9d93890d3976d6` (30/09/26, 03:05 UTC; gated deploy, host-sync, both addresses checked byte for byte; change_log 3709). Built on the live page, which by then carried wave171 to wave173 (volunteers confirm by text, from another session, shipped while this was built): their segment and their small changes in `031`, `020` and `152` were taken from the live page (the build reproduced each live page exactly before this wave's changes went on), then merged with their GitHub push.

## Files

- `build/parts170/` (a_head: the look; b_data: the owner, the rows and the mybox function; c_card: the card on Home; d_sheet: the assistant; z_wire: the reply tool, the team, the settings, the address, the tour) into `build/src/170_wave170.seg`; `123` (the team inbox: the line first, who heard, what the Hub did), `116h` (the Hub inbox page).
- `fn/mybox/`, `fn/mail-pull/` (v10), `fn/team-inbox/` (v1.3).
- `build/data/wa170_inbox.sql`, `wa170b_wording.sql`, `wa170c_training.sql`, each with its `.rec.sql`.
- `test/w170drive.js` (65 checks).

## Tests

Before the release, on the build: the drive tests from wave130 to wave170 (42 files) passed, as did `test/w124drive.js` for staff and a board member, the form pages and the phone sweep; after taking in wave171 to wave173, the Home, onboarding, Finance, CRM, access, menu and news tests, w124 and the phone sweep were run again on the final build and passed. `test/w170drive.js` (65 checks, made-up mail, the mybox function caught): the card and its counts, the tour stop; the assistant (the tabs, the list, the email and its thread, Open in Gmail), the reply tool (the questions, a tapped answer and one in his own words, the draft, what to fill in, reply to everyone, the [brackets] check, the Gmail draft, the counts following, Next email, No reply needed, the ones dealt with), For a team (the first line, a person on the live Program Development team, changing the team, an empty line refused, Send, Not for a team), Sorted (the summary, by day, Take the label off), Settings (what is sent, Read my folders again), Check now, Escape, the address at load and when it changes, not on for a team member, not shown to a board member, phones; and the team inbox's info@ email passed on, filed quietly, and sent on from an inbox.

The info@ passing on was tried on the live functions with made-up emails (a volunteer, a donor's receipt, a volunteer thread with Ahmed on it, a security code, a partner's Zoom invite): opsmtl with a line to sign her up; fundraising for Alexis; filed quietly for Ahmed; never filed; progdev for Zachee. What team-inbox would send was read with `jev_dry`. The test rows, and the one candidate a test created, were removed.
