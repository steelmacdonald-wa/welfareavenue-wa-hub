# 05/11/26 - wave274b: anticipated spend on the calendar

Steel (05/11/26): "they technically have the same calendar, and it would be good to see on the calendar how much we anticipate spending for these events."

Toronto events and Montreal servings are both rows in `volunteer_events`, and both show on the Hub's Calendar (`#calendar`, wave124, the Volunteering layer). Until now nothing in the Hub said what an event is expected to cost: finance has transactions and department budgets, never per event. This wave adds an optional anticipated spend to every volunteering event, lets the Toronto team set it, and shows it on the Calendar for any city. The brief is `docs/toronto/wave274b brief.md`.

## What it does

| Where | What you see |
|---|---|
| Toronto Volunteers, New event and Edit the event | **Anticipated spend** (optional), right after Meals planned: a text field with the number keyboard on a phone and a `$` inside it before the amount. The `$` is decorative; the label reads "Anticipated spend, in dollars" to a screen reader. The hint: "Groceries and supplies you expect to pay for. It shows on the Hub calendar." It takes `250`, `250.5` or `$1,250.00`. Anything else is refused in words right under the field ("Anticipated spend is an amount in dollars, like 250 or 1,250.50."), and so is more than 100,000 ("Anticipated spend can be up to $100,000."). Empty clears it. |
| Toronto Volunteers, Plan | The kitchen box's list gains **Anticipated spend**: `$250` or `$1,250.50` (Canadian format, cents only when there are cents), or "Not set" in the muted style. Saving only the spend redraws Plan in place; any other change redraws the page as before. |
| Calendar, month view | A volunteering event with a spend shows a short tag after its title (`$750`, `$1.3K`), only where the pill has room for it and a few letters of the title: at 1366 px yes, at 1280 px no. Each pill is its own size container, so a cell never widens. On a phone the pills are coloured bars with no text, as before. The full amount is in the pill's tooltip. |
| Calendar, agenda and Up next | On the event's line: "Toronto · Anticipated spend $750". A cancelled event with a spend says "Cancelled" on that line, since the total leaves it out. |
| Calendar, the item's sheet | Its own line, with a banknote icon: "Anticipated spend **$750**". |
| Calendar, the month's total | One quiet line under the layers, in the Volunteering layer's ink (5.7 to 1 on the page) with its dot: "Anticipated spend this month: **$1,250** on 3 events", and when both cities have one, "(Toronto $750, Montreal $500)". It shows while the Volunteering layer is on and at least one event of the shown month (not the grid's overflow days) has a spend. Cancelled events are left out. A city is Toronto when the location says Toronto, otherwise Montreal. It waits until the shown month is loaded, so it never shows a part of a month. |

Montreal servings show their spend on the Calendar too, once someone sets one. Setting it for Montreal (in the Volunteer Manager) is not in this wave; it is a later decision for Steel.

## The data

- `build/data/wa274b_budget.sql` (not applied): `volunteer_events.budget numeric(10,2)`, null or 0 to 100,000 (the check `volunteer_events_budget_range`), with its comment. Safe to run twice. The table's row security already covers it.
- Toronto Volunteers: `EV_COLS` names `budget`. Edits go through `saveEvent`, so the audit trail records `budget` with its old and new value (`logChange('volunteer_event', id, 'budget', ...)`). New event writes it with the insert.
- Calendar: `loadRange()` reads `volunteer_events` with `budget` (`volRange` in `parts124/c_data.js`).
- After any Toronto save to `volunteer_events`, the app sends `wa:volevents` on `document`; the Calendar then reads its range again on its next draw, so a spend set in Toronto shows on the Calendar without a reload.

## Before the SQL is applied

PostgREST answers a select or a write that names a missing column with `42703` (or `PGRST204`).

- **Toronto Volunteers**: asks again without `budget` and sets `S.budgetOk = false`. The field is not in New event or Edit, the sheet says nothing about it, and inserts and updates never send `budget`. Plan's row reads "Opens once the Toronto database update is applied." Each full load asks with the column first, so the field appears once the SQL is in.
- **Calendar**: asks again without it and does not ask for it again in that page load. Every event still shows; no tags, no total.

## Tests

- `test/w274bdrive.js`: admin and plain (a member on the opsto profile) at 1366 and 390 px, then the fallback for admin at 1366 and plain at 390. The fixture is `test/w274fx.js` with TO-26-2 at $750, the Montreal serving WA-26-40 at $500, WA-26-22 at $125.50 and a cancelled Toronto event at $300, all in October 2026.
  - The Calendar: October's line "Anticipated spend this month: $1,375.50 on 3 events (Toronto $750, Montreal $625.50)" under the layers, the tags where they fit (none on a phone) and the tooltips, cells that keep their width, the Toronto and Montreal sheets, the agenda lines (the cancelled one says so), the layer off, and November with no line.
  - Toronto: New event with "12 dollars" and "150000" refused in words beside the field, then "$1,250.50" written as 1250.5 and shown in Plan. TO-26-3's Plan reads "Not set"; Edit sets 250 (only `budget` is sent, the audit trail has it, Plan is redrawn in place), changes it to 300.5 ($300.50), then clears it (null, "Not set"). TO-26-2's field shows 750 and saves 800; an Edit of the meals alone sends no budget.
  - The Calendar again in the same page: October follows ($1,425.50, Toronto $800), November shows the new event ("$1,250.50 on 1 event", no cities, its tag $1.3K at 1366).
  - The fallback: every select or write naming `budget` answers 42703. Toronto loads its events, New event and Edit have no field, Create and Edit send no budget, Plan says why, the Calendar shows all five October events with no line or tags, and asks for the budget once in the page load.
  - No sideways scroll (checked against `screen.width`, as `w274drive.js` does) and no page errors throughout.
  - 134 passed, 0 failed.
- Regression, before and after on the same fixtures: `w274drive` 222 of 222 and 222 of 222, `w274break` 238 of 238 and 238 of 238, `w153drive` 45 of 46 and 45 of 46 (the known "dock stays in view" check), `w124drive` 34 of 35 and 34 of 35 for an admin ("Calendar tab just after Home" fails on the unchanged build too; the menu order comes from a later wave) and 20 of 20 and 20 of 20 for a board viewer. `w124drive` names an old browser path, so here it runs with a preload that points Playwright at `WA_CHROME`.
- Run it with `export WA_CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome; bash build/build.sh && CAND=build/candidate.html node test/w274bdrive.js` (`WA_SHOTS=<folder>` saves the screenshots).

## Left for later

- Setting the spend for Montreal servings (the Volunteer Manager).
- Applying `build/data/wa274b_budget.sql` (Steel).
