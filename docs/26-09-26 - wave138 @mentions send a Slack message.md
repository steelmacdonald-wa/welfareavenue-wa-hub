# 26/09/26 - wave138: @mentions send a Slack message

Live md5 `07f597fd73979e89d2d5ba5bfc5a530c` (3,884,514 bytes), deployed through the gated pipeline (`wa_stage_ri`, guarded on the live md5 `b6560e93` and dropped after). Schema: `wa138_mentions`, `wa138_mentions_2`, `wa138_training`. Edge functions: notify v11, slack-connect v2 (new).

## What Steel asked

"I should be able to @ people in the comments of tasks, and goals."

Then: "For the @mentions I want the ability to @ someone anywhere in the hub and it will send them a direct message from me in Slack - no asking this is done automatically. I'd like the same capabilities for everyone at the charity. So if Ian comments @joy on a content task on slack Ian will have sent her a message of the comment and link to the task on the hub"

## What it does

**Type @ and a name** and a list of people opens, with their photo and team (someone the Hub cannot reach on Slack says so). It works in task comments (the task drawer and the comments window), a task's description, goal comments, request notes, team updates, decisions (the suggested move and the decision note), committee notes, project descriptions and the notes for the team on a Content calendar post. The arrow keys and Enter (or Tab) choose, a click works too, and Escape closes the list without closing the drawer. People Slack can reach come first, then the team the task or page belongs to.

**Under the field**, a line says who will get a Slack message and how, for example "Joy gets a Slack message when you post it, from the Hub with your name." There is nothing to confirm: posting is sending.

**The message.** When Ian mentions Joy on a content task:

- once Ian has connected Slack, Joy gets a DM from Ian with his comment and "Open the task "..." in the Hub", linking straight to it;
- until then, it comes from the Hub bot: "Ian mentioned you on the task "...":" with the comment quoted and the link.

A confidential, board-only or restricted item (and every committee note) names only the kind of item and links to it; the text stays in the Hub. A long text is quoted around the mention (600 characters). A task description saves as you type, so its mention waits 20 seconds and quotes the description as it stands then; a mention deleted in those seconds is not sent. Editing a text only messages people who are newly mentioned. Nobody gets a message for their own name, for text written by the AI or a sync job, or for an email address or an Instagram handle such as @joy.dumansi.

**Settings, Connections: Send @mentions as you.** Connect Slack opens Slack's own page; the Hub checks that the Slack account is the person's own (same email) and keeps the token in the vault. Disconnect undoes it. The same card lists your latest mentions and what happened to each (Sent as you, Sent from the Hub, Not sent: no Slack account found, and so on).

**Settings, Notifications:** "Someone @mentions me in the Hub" can be switched off.

**Comments show mentions:** a mentioned name is highlighted in task comments, goal comments and request notes.

## How it works underneath

- Triggers on `task_comments`, `dept_tasks` (description), `goal_comments`, `request_notes`, `dept_updates`, `decisions`, `board_touchpoints`, `projects` and `content_posts` (notes only, because captions tag Instagram accounts) call `wa_mention_notify()`. It reads the mentions the way the page does (`wa_mentioned_members()`: the longest active roster name after an @ that is not part of an email address), keeps only the new ones and files a row in `hub_mentions` as the signed-in writer. A job or the AI (no signed-in person) mentions nobody.
- A trigger on `hub_mentions` asks notify (event `comment_mention`) to send the DM. notify answers the database at once, does the work in the background and records the outcome on the row (`dm_status`, `dm_via`, `dm_error`).
- slack-connect: Slack's OAuth for user tokens (chat:write, im:write), a signed state, the email check; tokens in the vault as `slack_user_token:<email>` (`slack_link_save()`, `slack_link_drop()`); `slack_links` records who connected.
- The page: `build/parts138` (the picker, the line under fields, the Settings card, the return from Slack), with small hooks in 116j (Settings), 116b, 051, 016, 116f and parts123 (highlighted names). The tasks tour step is in parts122.

## Release checklist

- **Access:** no page changed hands. Anyone who can write in those places can mention, directors writing committee notes included. Connecting Slack is for staff (slack-connect checks `is_wa_staff()`). `hub_mentions`: people read the mentions they wrote or received, admins all, and only the triggers write. `slack_links`: people read their own row, admins all, and only the service role writes. The parser, which returns roster emails, is for the service role and the triggers only (`wa138_mentions_2`).
- **Training:** the tasks tour step says what @ does; Hub module 2 in the Avenue Academy has a paragraph on @mentions and Connect Slack, and its "Done when" includes bringing someone in with @.
- **Security review:** the new functions are security definer with a fixed search_path; the vault functions and the triggers are closed to anonymous and signed-in callers; the advisor shows no ERROR. User tokens never leave the vault and the edge functions.

## Verification

- The migration ran as a rolled-back dry run twice: a comment mentioning @joy and @Mary, with an email address and @joy.dumansi in it, filed Joy and Mary once each; a long description filed Tate with the 600 characters around the mention, and a second edit did not file him again; Content calendar captions mention nobody.
- End to end on the live database, with a roster person who has no email (so nothing was sent): the trigger reached notify, which marked the row "no email on the roster"; the task description path waited 20 seconds in the background and marked its row "removed before sending". Both rows and their log lines were deleted.
- `test/w138drive.js` 37 of 37: the picker by keys and by mouse, the line under the field in each state, posting, no picker for an email address, someone without an email, not me in my own list, the description, goal comments, Settings before connecting, Connect Slack going to Slack's page, connected with the latest mentions, Disconnect, back from Slack with and without an error, and a member.
- Regression: w123 52 of 52, w126 35 of 35, w134 37 of 37, w136 16 of 16, w122 36 of 36 with every tour to the end, w116t with no page errors (w116j stops on an old step that fails on the live build too). The harness for three identities differs from the live build only on the HR centre, which varies from run to run on its own; no repaint loops on the changed pages.
- Live: the md5 matches the build; slack-connect answers "Sign in to the Hub first" without a sign-in, and sends an expired link back to the Hub with the reason.

## For Steel

- Click **Connect Slack** in Settings, Connections (Send @mentions as you). It is the first real test of the Slack app settings you updated. If Slack shows an error about the redirect or the scopes, the app needs the redirect URL `https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/slack-connect` and the user token scopes chat:write and im:write.
- Everyone else connects the same way. Until they do, their mentions still go out, from the Hub with their name.

## After release (26/09/26)

- **The Slack app** needed the redirect URL added (Steel's first Connect showed "redirect_uri did not match"); after that, Steel connected.
- **The first real mention** (Steel, "@Ian" in a task description) went out as Steel 21 seconds later, to Ian's work account (ian.odhiambo@welfareavenue.com, U0A7DF871FS), the account the Hub delivers to for Ian, in the same DM as the weekly marketing briefs. It is not in the DM with his personal account.
- **slack-connect v3**: Slack gives a person the same user token each time they authorize the app, so Steel's mention token is also `SLACK_USER_TOKEN`, which hours-pull (daily) and slack-pull read. Disconnect used to revoke the token at Slack, which would have stopped the hours job; it now forgets the token for mentions and only revokes it when no Hub job uses it. The same guard covers a refused connection.
- **Ian's messages now go to his personal Slack account** (U057BRKP1R9). Steel: "He's the only one that hasn't changed to a Welfare Avenue email account (his WA account is inactive) - send it to his personal email account". `wa_slack_ids` for ian.odhiambo@welfareavenue.com and the `wa_slack_names` entries for "ian" now point there, marked `pinned`, so every Hub DM (mentions, requests, task handovers) and every @Ian in a project's Slack post reaches that account. slack-connect v4 treats a pinned account as the person's own (so Ian can connect it for "Send @mentions as you") and never replaces a pin; directory-sync v1.6 takes the photo from the pinned account (Ian's photo now comes from his personal account). His Hub sign-in stays ian.odhiambo@welfareavenue.com.
