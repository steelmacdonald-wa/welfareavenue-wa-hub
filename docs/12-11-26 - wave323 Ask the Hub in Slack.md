# 12/11/26 - wave323: Ask the Hub in Slack, and Ask the Hub knows who is asking

Steel, 12/11/26: "Ask the Hub in Slack: DM @wa_hub or /hub, answers and confirm buttons in Slack. Goes where people already
are. I really want this ready to use."

Two edge functions and two small tables. No change to the Hub page.

## What a person can do
- **Send WA HUB a direct message** with any question or ask. A "Looking into it..." note appears and turns into the answer.
- **Type `/hub` and a question** in any channel. Only they see the answer.
- **Ask for an action** ("add a task for me: call the caterer by Friday", "put in a request to Marketing for a poster"). A
  card arrives with **Confirm, do it** and **Cancel**. Nothing is saved until they confirm, and only the person who asked can.
- **`tasks`** (in a direct message) or **`/hub tasks`**: their open tasks at once, with no model call.
- `/hub project <name>`: a project snapshot. `/hub idea <text>`: a change to the Hub itself (this was `/hub request` in the
  August version, which was never switched on; "request ..." now goes to Ask the Hub, which drafts a team request).
- A mention in a channel gets a private note: ask in a direct message, so the answer stays between us.
- In Slack's side panel for apps (when the app has it), a new chat opens with four ways to start: this week's focus,
  overdue tasks, what is waiting on them, and adding a task.
- A file with no words gets a short note (words only for now). A file with words is answered on its words.

## Who gets an answer
The Slack account is matched to an **active roster person by email** (`wa_slack_ids`, else the email on their Slack
profile), and that email must be a **Welfare Avenue account**: the rule Ask the Hub has always had in the Hub (its sign-in
path takes that domain only). So Slack opens nothing the Hub does not. The rule covers every command, `/hub project` and
`/hub idea` included (the August version answered those for anyone in the workspace). Bots never match, and a name is never
guessed from a display name (the August version did, for `/hub tasks`). A roster person without a Welfare Avenue account
gets a short note that points to the Hub; an account the Hub does not know gets the how-to-link note.

## How it stays the same Ask the Hub
`slack-command` verifies Slack's signature, then calls the `ask` function over a trusted path: the Vault's
`WA_TRIGGER_SECRET` in `x-wa-secret`, and `x-wa-as: <their email>`. That secret never reaches a browser (the Hub page does
not carry it). `ask` refuses the path for an email that is not an active roster person with a Welfare Avenue account. From there it is the same function:
the same context, the same four confidentiality layers, the same voice.

What is different on that path, because it carries no sign-in of theirs:
- the meetings come from the open-visibility search, never from `wa_ask_meetings` (which runs as the signed-in person);
- a task cannot be banked (the tool is not offered, and the executor refuses);
- actions are signed `Chat (name via slack)`.

## Ask the Hub now knows who is asking (the Hub's own chat too)
Before this, the model was never told who was asking or what day it was, so "Which of my tasks are overdue?", one of the
starter prompts on Home, could not be answered. The context now opens with:

    WHO IS ASKING: <name> (<team>). "I", "me" and "my" in the question mean <first name>.
    TODAY IS Thursday, 12 November 2026 (2026-11-12).
    THEIR OPEN TASKS (3 open, 1 past the due date; ...):
    1. ... (Marketing, due 2026-11-09, OVERDUE by 3 days)
    REQUESTS WAITING ON THEM (1; ...):

Their tasks are the ones assigned to them or carrying their first name as a whole word, with the rules of every other task
block applied twice (in the query and again in the function): nothing banked, done, confidential, board-only, restricted,
from the Board team, or with a title that touches an off-limits topic. The add-a-task action is told that "me" means that
person, so "add a task for me" comes back with them as the owner. A new task goes on the board of the team they name, else
their own team; when neither is known the Hub asks which board, and it never picks the Board team unless they name it.

## One request, one identity
`ask` kept the asker's sign-in and name in two shared variables. Two people asking at the same moment could have crossed:
one person's sign-in used for the other's meeting search. Each request now carries its own values (`rq`), passed down to
the calls that need them. `test/fn_slack_ask_test.mjs` asks as two people at once and checks each context and each call.

## What is stored
Nothing a person types and nothing the Hub answers.
- `slack_ask_log`: one line per Slack event (so a repeat delivery is answered once) and one per question: who, when, direct
  message or slash. The limit is 25 questions a person in 24 hours.
- `slack_ask_pending`: a card waiting for its button. Its content is wiped once confirmed, cancelled or a day old.
Both are for the service role only. A follow-up question reads the last turns of the conversation from Slack itself (the
past 30 minutes). The function's log notes the kind of any Slack event it does not handle (the kind only, never content).

## Slack app settings (one time)
The bot already holds every permission this needs. What has to be set in the app:
1. The app's **Signing Secret** in the Vault as `SLACK_SIGNING_SECRET`.
2. **Event Subscriptions** on, Request URL `<project>/functions/v1/slack-command`, bot events `message.im`
   (direct messages), `app_mention` (the private note in channels) and `assistant_thread_started` (the four starters in
   the side panel).
3. **Interactivity** on, the same Request URL.
4. **Slash command** `/hub`, the same Request URL.
5. **App Home**: the Messages tab on, with "Allow users to send Slash commands and messages from the messages tab".

## Switched on, 12/11/26 13:48 Toronto
Steel asked for it to be done on his computer, and watched. In the Claude desktop app's browser:
- **The signing secret** went from Slack's Basic Information page straight into the vault through a one-time ticket
  (`build/data/wa323_slack_key_drop.sql`, the pattern wave302 used for the QuickBooks keys). A short script on that page
  read the Signing Secret field, checked it was not the Client Secret, and sent it with the ticket. It returned only
  "saved". The page was never read or captured, and anon's right to call the function was taken away straight after.
- **Event Subscriptions**: on, the Request URL verified by Slack, bot events `message.im`, `app_mention`,
  `assistant_thread_started`, saved. **Interactivity**: on, the same address, saved.
- **`/hub`** was already there from August with the right address, and **App Home** already let people send messages:
  neither was changed. Slack asked for no reinstall.
- The app has Slack's side panel for apps turned on (suggested prompts set to Dynamic, which is what the starters use).
  Slack shows a notice that this experience is changing, with an Update button. It was left alone: Ask the Hub has not
  been checked in the new layout.

Live checks after the switch, with requests signed inside the database (the secret never left it): `/hub tasks` and
`/hub` answered at once for a roster person; an unknown Slack account got the how-to-link note and no project; another
workspace got 403; a tampered body got 401; `/hub` and a question was acknowledged in under a tenth of a second and
answered by `ask` in the background (7 seconds), which shows the runtime keeps the function alive for that work.

## Tests
`node test/fn_slack_ask_test.mjs` (116 checks). Both functions run together under Node with `test/fn_harness.mjs`: signed
Slack requests in, the real `ask` over the trusted path, a mock model, a mock Slack. It covers who may ask, what the model
is told, what never reaches the context, that nothing typed is stored, the cards and their buttons, the limit, repeat
deliveries, two people asking at once, the Welfare Avenue account rule on every command, the starters, and a signing
secret pasted with a stray space.

## Deploy and undo
Both functions are deployed as one line that imports `fn/<name>/index.ts` from this repo at a pinned commit, as
qbo-connect is. Database: `build/data/wa323_slack_ask.sql`. Undo: redeploy the two functions pinned to the commit
before this wave, and drop the two tables.
