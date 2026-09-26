# 26/09/26 - wave130: the browser test fixes

Live md5 `46295a8b143d86b1413d19f855cceb9c` (3,517,962 bytes), deployed through the gated pipeline (`wa_stage_qz`, guarded on the live md5 `dc8c3c44` and dropped after). No schema change.

## What Steel asked

On the browser test (#43): "For the bugs worth fixing first, feel free to fix them all."

## What changed, by the numbers in the findings

1. **Phones no longer scroll sideways.** Menus are capped at the width of their card (Activity, The Brain, the audit trail) and the onboarding row on a person page wraps.
2. to 4. **People and access, access requests on a phone, the Access profiles matrix:** fixed by the People and access redesign (wave131), which follows this wave.
5. **Hub inbox has one header**, the masthead, with the fuller line (what the team copies to hub@, where each email is filed, and that each filing can be undone).
6. **Board view: a staff page says so.** A director who opens Finances, Department goals, a team page, a person or any staff page lands on the Executive dashboard with a notice under the masthead ("Finances are for staff accounts") and a link to each page the board view opens (Board overview, Committees, Calendar, Events calendar, Marketing analytics, Content calendar, Photo library). The address changes to the page they are on. Links to staff pages stop looking like links for directors (header links are hidden, others read as plain text) and a click says why instead of moving. Staff sent back from a page outside their access profile get the same notice, pointing to Request more access on My page.
7. **Board view: no tick boxes on the executive decisions**, and the intro says the executives record each outcome instead of "Tick an item".
8. **Calendar: a Board layer.** Board meetings (with the agenda and minutes links), "Committee meetings due" the week before each coming board meeting, and the fiscal year-end on September 30. It only shows for people who can read the board (directors, executives, admins and leads), and it is on by default. A director's Up next now shows the year-end, the committees' week (October 12) and the Q3 board meeting (October 19). Each opens with a link to Board overview or Committees.
9. **Servings read as servings:** "Sunday serving, Montreal" instead of "WA-26-21" on the Executive dashboard (Next up and Coming up), on the calendar, and in the cancelled-serving notes.
10. **Ask the Hub is a round button** that opens its label on hover or keyboard focus, and it steps aside while you type (on a phone the bottom bar does too).
11. **One coach mark at a time.** The check-in note under the pill is two short lines ("Starting a session?", then Check in, "so your hours count", Not now), so it stays clear of the tiles on Home. Meet Ask the Hub waits until the check-in note is gone and never shows beside the Get started card, which already has "Ask the Hub a question".
12. **Request more access** is never offered to admins, and it no longer flashes before the page knows who you are.
13. **Policies:** Open and read and the sign-off sit apart (stacked on a phone), the "signed" pill stays on one line, and the sign-off only works once the document has been opened on that device (the button says "Open and read it first" until then).
14. **Refresh the recommendation** updates the card you are looking at, and the team page's recommendation boxes have their own ids.
15. **Goal page footnotes** sit inside their card (Department goals, Organizational goals, Goal alignment).

Also: the board's strategy block names the board chair from the seat ("led by the board chair (Kellian)"), since the old wording looked for an incoming chair.

## Data changes

- Transcripts 1, 2 and 67: their dates are back to June 29 and July 21 (they were recorded those evenings, and the titles were a day late because the recordings are named by the UTC date); the three titles now say the same day.
- The academy lesson "Page tour: Calendar" mentions board dates.

## Release checklist

- Access: no new page and no change to who can open what. The notice only explains the access that already applies. The Board layer reads `board_meetings`, which the database already limits to people who can see the board.
- Training: the Calendar tour's first step and the Calendar lesson mention the board dates. The Ask the Hub tour step still points at the (now round) button.

## Verification

`test/w130drive.js`: admin at 1366 (30 checks) and 390 (29), a board viewer at 1366 (17) and 390 (19), a staff member on the HR profile (5). Drives for waves 122 (36/36, with a new check that the sign-off waits until the policy is opened), 124 (35 and 20, updated for the Board layer), 125, 126, 127 (five cases), 128 (three cases) and 129 (two cases) all green. Harness x3 against the live build: only the intended pages differ. Churn clean on 15 pages. Live md5 matches the build.
