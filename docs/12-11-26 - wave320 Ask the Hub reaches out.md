# 12/11/26 - wave320: Ask the Hub reaches out

Steel, 12/11/26 00:12 Toronto: "I want ask the hub to engage individuals more often to have them ask questions, submit
requests, and do other really cool actions within the hub - it should be agentic, support it on progression to
completing tasks". His answers the same night: ship as ready, confirm card first, keep the cost near today's, and the
Hub may reach out inside the Hub, by Slack DM, by email and in the Monday digest.

This wave is the part inside the Hub. One block in the page (`build/parts320/320_v320.js`, inserted before WA v110 by
`build/parts320/patch320.py`), no database change, no edge function change, and nothing is sent to anyone.

## What a person sees
- **The Hub suggests.** With Ask the Hub open and no thread yet, up to three cards about their own work: tasks past
  their date, mentions not read, requests waiting on them, tasks due in the next 7 days, their team page one tour away,
  tasks with no date. Each card has one main button. When nothing waits: "You are all caught up" and one question to ask.
- **I can also.** Four tiles under the cards: File a request, Add a task, Find a page, Find a document. A tile writes
  the start of the sentence in the box and waits for the person to finish it.
- **A note beside the Ask button**, once a day at most, eight seconds after the Hub opens: "Hi Joy, 2 tasks past their
  date and 1 mention to read." Show me, Not today, Stop these notes. It never shows over a window (the due-date check,
  the meeting pop-up, a tour, the install note, any dialog) and it leaves by itself after 14 seconds.
- **A gold dot** on the Ask button (and on Ask in the phone bar) until the suggestions have been seen that day.
- **Help me finish this**, on the cards and in every task drawer: Ask the Hub is asked for the next three steps, the
  page, document or person that can help, and any follow-up task or request to confirm. Never offered on a confidential,
  board-only, restricted or banked task, and a confidential title is never shown on a card.
- **Starter prompts send on one tap** (a tap used to only fill the box).
- **The Ask button says "Ask the Hub"** for six seconds on a person's first three visits, then goes back to the E.
- **A confirmed action** draws its tick.

## Fixes in the same release
- **Muted text.** `#797773` (4.3, 4.0 and 3.7 to 1 on the Hub's three backgrounds) becomes `#585B57`, the website's own
  muted grey (6.6, 6.1 and 5.6 to 1). 389 places. New waves should use `#585B57`.
- **Touch areas on a phone.** Hide for now, Don't show again, How this page works and the small links on the setup card
  get 44 px of touch area; the Get started ticks grow to 28 px.
- **Whose task it is.** `waTasksOf`, wave109's My tasks and wave54's task stats matched the owner by a piece of a word,
  so "Ian" also counted Brianna's tasks (4 open tasks on 12/11/26). They now match a whole word, as the database's
  due-date check already did.
- **Names.** The Ask button's tooltip says Ask the Hub. The Academy's topic filter and the wave301 chart tooltip have a
  name for screen readers.

## How it works
- The cards are worked out in the browser from what the page already holds (`DB_TASKS`, `DB_ASSIGN`, `DB_MEMBERS`), plus
  two small reads the person is already allowed (their unseen `mentions`, the open `dept_requests` assigned to them).
  No model call until the person taps a button, so the running cost stays where it is.
- The task cards are worked out fresh each time; the two reads are kept two minutes. A ticked task or a date moved in
  the due-date check changes the cards at once.
- Stored on the device only: `wa320.seen` and `wa320.peek` (the day), `wa320.off` (Stop these notes), `wa320.visits`.
- `window.w320 = { suggest, paint, peek, coach, mine, blocked, state }`.
- Motion: 200 ms, `cubic-bezier(.23,1,.32,1)`, opacity and transform only, a 40 ms stagger on the cards, press scale
  .97. Reduced motion turns it all off.

## What it never does
- It never sends a Slack message, an email or a notification. The weekly Slack and email versions are the next wave,
  built switched off, and wait for Steel's yes on the words and on who gets them.
- It never acts by itself: every action is still a confirm card from the ask function.
- It never says "AI".

## Tests
`test/w320drive.js` (44 checks): an admin on a computer, the cards following the tasks, a starter prompt, the note
behind the due-date check, a team member on a phone, a director, reduced motion. Regression: `w272drive` (152),
`w306drive` (44), `w310drive` (25).

## Release and undo
`build/parts320/release320.sh prepare | stage | verify` (see the top of the file). Step 1 makes the backup
`site_files_bak_wa320` and a short-lived stage table; step 2 is the gated swap, the `change_log` line and host-sync in
one transaction. `build/parts320/wave320_undo.sql` puts the page back; it refuses if a later release sits on top.
