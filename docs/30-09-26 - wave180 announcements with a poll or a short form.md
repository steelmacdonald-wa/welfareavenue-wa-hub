# 30/09/26 - wave180: announcements that lead to a poll or a short form

Steel (29/09/26): "I'd also like for leaders to be able ot make announcements that lead to forms or polls that our team can answer."

His answers (30/09/26): the team hears about it at the top of Home plus one Slack post; polls and short forms are answered inside the Hub, and the poster sees the results and who has not answered; leaders post to their own team or everyone, HR and admins to anyone.

Numbered 180 on purpose: another session shipped wave171 to wave175 tonight (volunteer texts, role surveys, volunteer accounts), so 176 to 179 are left to it.

## What people see

- **Announcements, at the top of Home**, right under who is online, for the people each one is for: the pinned ones first, then what waits on their answer, then the rest (three at a time, See all announcements for the others). The header says how many wait on an answer.
- **A poll** is answered with a tap (or, when people can pick more than one, a few taps and Send my answer). The totals show once they answer, when the poster shares them ("Steel keeps the totals for now" when not), with their choice marked; Change my answer until it closes. One they just answered stays where it was until the page reloads.
- **A short form** (up to 8 questions: a short answer, a paragraph, one choice, several choices, yes or no, a date, a number; any of them required) opens in a window: Send my answers, and later Change my answers until it closes. It says plainly whether the poster sees their name ("Steel sees your name with your answers") or only the totals (anonymous).
- **The poster, leaders, HR and admins** get See the answers: how many of the people it is for answered, the totals with who chose what (unless anonymous), the text answers, who has not answered yet (a count only when anonymous), and Download the answers (CSV). The poster (and admins) can Close the answers now and Take it down (a second press confirms).
- **The Slack link**: each announcement is posted once in Slack (the team's channel, #general for everyone, #leaders for the leaders) with a link that opens it on Home (`#announce/<id>`); `#announce/all` opens them all.

## Posting

**Post an announcement** (on the card, in See all, and What's new on the Executive dashboard now opens the same form): a headline, a line or two of detail, who it is for (Everyone, The leaders, or teams: a leader's own team, any team for HR and admins, the Executive team and the board included), what they answer (nothing, a poll, a short form, with an editor for each), when answers close (the end of that day in Toronto), anonymous, show people the totals once they answer, a link, when it comes down, pin it, and Post it once in Slack too (on by default; it says where). The form checks what the database checks (two choices at least, no two the same, 2 to 10 choices for a choice question, nothing closing in the past) and says so in a line.

## How it works

- `hub_announcements` (wave116g's table) gains `audience` (everyone, leaders, teams), `teams`, `ask` (the poll or the form, checked by `wa180_ask_ok`), `anonymous`, `show_results`, `closes_at`, `post_slack`, `slack` (what the post did), `created_name` and `updated_at`. Row security: the people it is for (`wa180_for_me`: everyone is the staff team; the board sees what is for the board), its poster, leaders, HR and admins read it; leaders, HR and admins post (`wa180_can_post`), as themselves only; the poster and admins change it.
- `hub_announcement_answers`: one answer per person, changed until it closes. People read only their own; `wa180_answer` checks the answer against the ask (it must be for them and open); `wa180_results` gives the totals to people who answered (when the poster allows) and everything to the poster, leaders, HR and admins, never the names when anonymous.
- A new announcement with Post it once in Slack asks team-inbox (v1.4, event `announcement`) to post it; the channels for everyone and the leaders are `hub_settings.team_inbox.announce`.

## Checked

In the database, as the people themselves (then rolled back): Steel posts to a team and to everyone; a malformed poll is refused; Ahmed (a leader) posts to his team and everyone, not to Fundraising, and not as someone else; Joy (a member) cannot post, sees only what is for her, and cannot answer another team's poll; Samson (HR) posts to Fundraising; Mary answers once (two choices refused on a one-choice poll, a missing required answer refused, an extra field dropped), sees the totals without names and never the text answers, and cannot edit Steel's post; after it closes her answer is refused. Steel (signed in with his gmail) sees who answered and who has not; on an anonymous form he sees the totals and the text without names, and a count of who has not answered. team-inbox's dry run showed the Slack text and that #operations-mtl, #program-development and #general are reachable; nothing was posted.

## Training and access

Hub module 1 (the announcements on Home), the Home tour (a stop for the card, and its description), the access profiles (a team lead posts to their own team, the leaders or everyone; HR and admins to anyone; the executive profile to everyone, the leaders or their own team).

## For Steel

Nothing to do. The first announcement you or a leader posts goes to Slack once, where you chose.

## Releases

- Migrations: `wa180_announce` (20260930130000), `wa180b_answers_training` (20260930131000: each person's answer for the CSV, the training and the profiles), `wa180c_everyone` (20260930132000: everyone is the staff team).
- Function: `team-inbox` v1.4 (version 12).
- The page: `7652fc5f723e294fddb3f5e283a3ce56` to `ce6841f3e7077685d09bac53255942c5` (30/09/26, 04:20 UTC; gated deploy, host-sync, both addresses checked byte for byte; change_log 3724). Built on the live page, which by then carried wave171 to wave175 from another session: their segment was taken from the live page (the build reproduced the live page exactly before this wave's changes went on) and their wave174 files from GitHub.

## Files

- `build/parts180/` (a_head: the look; b_data: who is looking and the data; c_card: the card and the poll; d_modal: the windows, the form, the answers, the CSV, See all; e_post: the post form; z_wire: the wiring, the address, the tour) into `build/src/180_wave180.seg`; `116g` (What's new opens a poll or a form where it is answered).
- `fn/team-inbox/` (v1.4).
- `build/data/wa180_announce.sql`, `wa180b_answers_training.sql`, `wa180c_everyone.sql`, each with its `.rec.sql`.
- `test/w180drive.js` (51 checks).

## Tests

Before the release, on the build: every drive test from wave130 to wave180 (41 files, the other session's wave173 and wave174 included), `test/w124drive.js` for staff and a board member, the form pages and the phone sweep passed. `test/w180drive.js` (51 checks; the database calls caught and answered as the database does): the card's place and order, what counts as to answer, See all, the tour stop; a poll (a tap, the totals with the choice marked, the poster's names, Change my answer); a form (required questions, the answers as the database checks them); See the answers (how many of how many, who has not answered, the CSV, closing, taking it down with a second press); an anonymous form (no names, a count); posting (the defaults, a headline and two choices needed, every team for an admin, where the Slack post goes, the row as written, at once on Home); the Slack link at load, What's new's Post, `#announce/all`; Joy (only what is for her, her answered form, a poll whose totals the poster keeps, a refused answer's reason); a leader (their own team only, a refused post explained); HR (any team); a board viewer (no card); phones.
