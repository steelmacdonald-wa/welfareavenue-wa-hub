# 28/09/26 - wave157: automations (the CRM's Automations tab, the engine, the automations' emails)

Step 5 of the plan (the CRM toward replacing Keela), after wave156 (forms). The deep dive's gap: "Automations: start on a form, a tag, a gift or a date; delays; wait until opened, with a yes and a no path; send, tag, create a task, notify", which replaces Keela's volunteer welcome series and donor follow-up. Forms came first because Keela has no API or webhooks, so the Hub only hears about new people once it owns the forms. Standing decisions that apply: anyone with CRM access sends (Steel, 27/09/26, for campaigns; automations follow it), "Deploy if all green", and no automated email, Slack post or DM without Steel's explicit OK, so every automation is made as a draft and nothing is on.

## What it does

- **Automations** (`crm_automations`, the CRM's Automations tab at `#crm/automations`, in the rail under Email). An automation has a trigger and steps. Triggers: someone fills in a form (one form or any; the answer must reach processed, tests never count), a tag is added to a contact, a gift is recorded (dated in the last 7 days, so an import of older gifts starts nothing; a minimum amount; first gifts only), or a serving they are on the roster for is N days away (Montreal, Toronto or any; Confirmed, or also TBD and waiting). A person goes through once unless the automation lets them through again (each gift gets its thank-you by default).
- **Steps.** Send an email: a saved email (Welcome, new volunteer; Thank you for a gift; Reminder before a serving, with the gift's amount and date or the serving's day, date and role filled in) or one written in the step (subject, preview text, headline, message, button) in the Welfare Avenue layout; who can get it (about something they did, volunteer news, newsletter, fundraising: the permission rule's kinds); from Welfare Avenue or a team member. Wait N days. Wait until opened: watch an earlier email for up to N days, then a yes path and a no path (the next step, the end, or a later step; never backwards, so a run always ends). Add or remove tags. Make a task on a team's board (dept_tasks, due in N days, linking to their CRM page). Notify team members (a hub_mentions row from "The CRM", which shows in their mentions and DMs them on Slack like an @mention). End here.
- **The editor.** Name, what it is for, the trigger, the steps with Preview for each email (mail-send renders it with sample details), and "In plain words" beside it. Save; Turn on… runs the database's check (`crm_automation_problems`: a missing subject or message, a `[Paste ...]` note left in, a path that goes backwards, a task with no team, a notice with no team member) and lists what is not ready, or asks first (who starts it, the 8 am to 8 pm window, test mode); Pause stops new people and keeps the others where they are; Try it on me; People; Delete the draft.
- **Try it on me** (`crm_automation_try`): a test run on your own contact, a draft included. Its emails go only to your address (allowed in test mode for a team or test address) and are marked as tests, a day of waiting is a minute, and tags, tasks and notices are only described in its history.
- **People** (`#crm/automations/<id>/people`): every run with the person, the next step and when, the status (in it now, finished, stopped, needs a look, test run), the history line by line, Open their page and Stop it for them (which cancels an email still waiting). A contact's page lists the automations they are in.
- **The engine** (`crm_automation_tick`, cron `wa-crm-automations` every minute while anything is due). It starts the serving reminders that are due, then advances each run as far as it can: a send queues one email in `crm_email_sends` (after the permission rule, and in test mode only for a test address) and waits for mail-send; an email to a contact goes out only between 8 am and 8 pm Toronto; a wait counts days; wait until opened checks the email's `opened_at`; tags, tasks and notices happen at once. Every step writes a line of history; a run that fails is marked needs a look with the reason and the others go on. An email not sent within 3 days (the daily cap) is cancelled and the run moves on.
- **mail-send v3** sends the automations' emails first, within the daily cap (100 on Resend's free plan), then the campaigns within both caps. Test mode: an automation's email reaches only a test address or a test run's own team address; anything else is cancelled with the reason.

## Found and fixed on the way (wave155)

- `crm_email_sends` refused the volunteer kind (its check predates wave155's volunteer call-outs), so a volunteer call-out campaign could not have been queued. Fixed by the migration `wa157b_sends_kind`. Nothing had been sent: mail_mode has stayed test.
- A {{placeholder}} typed inside a campaign's headline, message or button reached the email unfilled (only the subject and preview text were filled). mail-send v3 fills them; checked with a preview ("Hi there," and "Hello friend", nothing left in braces).

## The first automations, all drafts

| Automation | Starts when | Steps | Before turning it on |
|---|---|---|---|
| Welcome new volunteers (Montreal) | Someone fills in "Volunteer with Welfare Avenue" | The saved welcome; a task for Ops Montreal to book their first serving (due in 3 days); then four emails 2 and 3 days apart | Paste the words of Keela's four emails (Welcome to our community, Why I started Welfare Avenue, What we do at Welfare Avenue, One conversation changed everything) into steps 4, 6, 8 and 10 |
| Welcome new volunteers (Toronto) | Someone fills in "Volunteer in Toronto" | A welcome email; a task for Ops Toronto to reach out | Paste Keela's Toronto welcome |
| Welcome new newsletter subscribers | Someone fills in the newsletter form | A welcome email (newsletter kind) | Paste Keela's subscriber welcome |
| Thank donors for a gift | A gift is recorded (each gift) | The saved "Thank you for a gift" with the amount and the date | Ready; the CRA receipt stays separate (wave158) |
| Remind volunteers before a serving | 2 days before a Montreal serving they are confirmed for | The saved "Reminder before a serving" | Ready; complements the SMS confirmations |

Keela sent its volunteer series in a different order to openers and non-openers; the deep dive recommended one sequence instead, and wait until opened is there when the team wants a branch. Opens are only recorded when Resend's open tracking is on for welfareavenue.com (no open has been recorded so far), and some mail apps open everything, so a yes path is a hint.

## Access

No new page: the tab follows the CRM page (`wa_page_ok('crm')`). `crm_automations`: staff with the CRM page read, create drafts, edit, turn on and pause (the stamp trigger checks and logs every status change in `change_log`), delete drafts. `crm_automation_runs`: staff with the CRM page read; the functions write. `crm_automation_try`, `crm_automation_stop`, `crm_automation_problems`: authenticated, and the first two check the CRM page inside. `crm_automation_enroll`, `crm_automation_advance`, `crm_automation_tick`, `crm_automation_scan_servings`, the trigger functions and `crm_claim_queued`: service role only. Security advisor after the migrations: the two staff RPCs join the known list of security-definer functions callable by signed-in users (they check the caller themselves); nothing else from wave157.

## Files

`build/data/wa157_automations.sql` (applied as `wa157_automations`), `wa157b_sends_kind.sql` (applied as `wa157b_sends_kind`), the migration `wa157c_problems_grant` (the check is for signed-in staff only); `build/data/wa156_forms.sql` now seeds the two draft labels tidied on the live drafts (Instagram and the Toronto support note no longer say "optional" twice); `fn/mail-send` (v3) and `fn/notify` (a label for CRM notices); `build/parts152/j_autos.js` (the tab, the editor, People, a contact's automations) with hooks in `c_list.js` (the ninth tab, routes, loaders), `d_sheet.js` (their automations on a contact's page), `f_wire.js` (tour step, test hook), `assemble.py`; `build/parts153/a_head.js` (Automations in the CRM rail) and `e_wire.js` (tour text); `test/w157drive.js` (26 checks); `w152drive` to `w156drive` updated for nine tabs and the new rail item.

## Deploy

Live since 08:38 on 28/09/26 (Toronto): the Hub at md5 993a22057990aaf7b78bfcec7c0e8355 (4,470,674 bytes), with the form page and `_redirects` unchanged. mail-send platform version 7 (ezbr 75714ce04ade863e6ec6a1efb195ec30832e3b6ee899442100ec7e573a7a3d94) and notify platform version 15 (ezbr 847bb938148c1044206e565b791ad0fb54ad182e22085ddc727fc5bc51f03723), both deployed through fn-deploy from SQL with the sources staged in a temporary table (dropped). The release is in `change_log` (entity_type release, wave157). Nothing is on and nothing was sent.

## Tests

On the candidate: `w157drive` 26, `w156drive` 26, `w156page` 14, `w155drive` 22, `w154drive` 30, `w153drive` 44, `w152drive` 68, `w151drive` 26, `w147drive` 12, `w143drive` 16, `w141drive` 11, `w140drive` 50, `w139drive` 7, `w136drive` 16, `w134drive` 37, all green; `w150drive` 34 of 35 (the logo check needs the network, as on the previous build).

The engine was tested against the live database inside transactions that were rolled back: a gift in test mode (the email held back, the run finished); the same in live mode (the email queued with its amount and date, then sent, then finished); the Montreal welcome from a processed form answer (the saved welcome queued, the task on the Ops Montreal board without the email address, the 2-day wait, the written email queued with its message as escaped paragraphs and the placeholders left for mail-send); a path going backwards refused on turning on, with the reason; a tag trigger (case-insensitive) with wait until opened, the yes path (tags added and removed, other tags keeping their case) and the no path (the follow-up queued); Stop (the waiting email cancelled); Try it on me as Steel's account (a test run to his team address, queued in test mode). Nothing from these tests stayed in the database. After the deploy: mail-send's pump answered in the new shape and a preview filled the placeholders.

## Open on Steel's side

1. Paste the words of Keela's welcome emails into the three welcome drafts (or tell the assistant to copy them from Keela in the browser, read-only), try each on yourself, then turn them on after the forms are live.
2. The gift thank-you and the serving reminder are ready to turn on when you want them (their emails wait for the live mode like everything else).
3. Opens: turning on open tracking for welfareavenue.com in Resend makes "wait until opened" meaningful; say if you want it.
4. Who may turn automations on: it follows the campaign decision (anyone with the CRM). Say if you would rather keep it to admins.

## Next

wave158, gifts and receipts (online gifts, cheques and e-transfers, CRA receipts with numbering, the year-end run; the gift thank-you above then runs for new gifts), then wave159, leaving Keela.
