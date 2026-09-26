# 26/09/26 - wave143: the board pack from Docs and Slides

Live md5 `ebf852bd5c8550d347661a711c9f7ff9` (3,982,895 bytes), deployed through the gated pipeline (`wa_stage_rn`, guarded on the live md5 `40bb7a85` and dropped after). Data: migrations `wa143_board_pack` (the pack on the meeting), `wa143_access` and `wa143_tour_text` (the profiles and the tour say who builds it). Function: `board-pack` v12 (new). Page: segment `143_wave143`.

## What Steel asked

"go for all the above": the Google projects that the new delegated access opened, starting with the board pack from Docs and Slides (then Meet attendance, Forms flows, a monthly security check and Search Console in Analytics).

## What the board pack is

For one board meeting, the Hub makes three files in the Board of Directors shared drive, in `Board Meetings <year> / <Month day> - <meeting>` (for the Q3 meeting: `Board Meetings 2026 / October 19th - Q3 board meeting`):

- **The agenda** (Google Doc), in the board's usual layout: the meeting, the date, the time (Eastern), the place, links to the notes and the deck, and the items numbered with who speaks to each.
- **The meeting notes** (Google Doc) to fill in during the meeting: call to order, the roll call of the directors, the motions, each topic with room for notes, and the close.
- **The deck** (Google Slides, 15 slides in the Welfare Avenue style: green, cream and gold, Barlow Condensed headings): the cover, tonight's agenda, the state of Welfare Avenue at a glance, one slide per team (progress, priorities and wins from their updates), the organization goals, the finances, the three jobs of the board, the committees, the decisions and the items at risk, and what comes next.

Everything comes from the Hub's own tables: the board meetings and items, the directors and committees, the teams' updates, the goals and the bank statements. The Q3 pack (the meeting of 19 October 2026) was built on 26 September with numbers as of that day.

## What stays out

- **People matters.** The HR slide shows counts only (people, goals and open tasks). Any sentence in a team's update about retention, resignations, successors, handovers, discipline, pay, health, leave, complaints or candidates is dropped, and so is any sentence naming a prospective hire.
- **Transactions.** The finances slide shows totals: money in and money out for the months the bank statements reach, against the same months a year before, and what events raised. Never single transactions, the same rule as the Board overview.
- **The July 2026 board deck.** It was never used as a template or a source.

## On the Board overview

Under the next meeting, a Board pack card:

- Before it is built: what the pack holds and, for an admin or someone on the Executive profile, **Build the board pack** (about half a minute). Directors and team leaders read that the executive directors build it.
- Once built: links to the Agenda, the Meeting notes, the Deck and the Folder, when it was built and by whom, and the date of its numbers. Admins and the Executive profile have **Refresh the deck numbers**, which rewrites only the Hub's own slides with today's numbers: slides someone added stay, and the agenda and the notes are never touched once built (people write in them).
- The card follows the board page when it repaints.

## How it works underneath

- `fn/board-pack/index.ts`: `gather(meetingId)` builds the content (the meeting, the last and next meetings, the chair and the treasurer, the directors, the agenda items, the glance tiles, the teams through `safe()`, the HR counts, the goals, the finances from `bank_statements` with a real period end, the board's jobs, the committees, the decisions, what is at risk, the renewals). `agendaDoc`/`notesDoc` turn it into Docs requests; `Deck`/`deckRequests` into Slides requests whose object ids start with `wagen` and the build's tag, so a refresh can find and replace the Hub's own slides. `boardFolder` finds the Board of Directors shared drive and makes the year and meeting folders. `build` is resumable: each step saves to `board_meetings.pack` (`agenda_ok`, `notes_ok`, `deck_ok`), so a timeout picks up where it stopped.
- Who may call it: an admin or someone on the Executive profile, checked with their Hub session (`is_hub_leader` and their `hub_roles` row), or the automation with the trigger secret. The `pdf` action (a PDF of one file, for checking the layout) is the automation's only.
- Google: the service account acting as steel.macdonald@welfareavenue.com with the drive scope (domain-wide delegation).
- Page: `143_wave143.seg` watches `#governance`, finds the next meeting in `w126.state()`, draws `.w143pack` after `.w126meet`, calls `db.functions.invoke('board-pack', { body: { action, meeting_id } })` and adds a step to the Board overview tour.

## What the challenge changed

- The first build put a departure and two named candidates from a team's update on a slide. The pack now drops people sentences and prospective hires, and the HR slide is counts only.
- The first deck overflowed its right-hand panels and restarted the agenda numbering after sub-items; the text is budgeted and sub-items are nested.
- The first version let any team leader build a pack; it is now the admins and the Executive profile, in the function and on the card.

## Release checklist

- **Access:** the Executive profile's line now says it builds the board pack; the Board member profile's line says directors see the pack with the next meeting. The function checks the caller; the card hides the buttons from everyone else.
- **Training:** the Board overview page tour has a step for the pack, and its Academy description mentions it.
- **Security review:** one new function with a caller check; no new tables or policies (two columns on `board_meetings`, read under its existing policies); no secrets read into the page.
- **Tests:** `test/w143drive.js` (15 checks: the card's place, build and busy state, the call, the links, who built it, refresh, the tour step, the repaint, a director and a team leader). The live-versus-candidate harness differs only on the Board overview.
