# wave274b brief: anticipated spend on the shared calendar (for one builder with no other context)

Repository: `/home/user/welfareavenue-wa-hub`, branch `ccr-50e3ba2b-mbnz80`. Do not commit, push, deploy, apply SQL or
touch any database or network. Read the whole brief first.

## 1. The goal

Steel (05/11/26): "they technically have the same calendar, and it would be good to see on the calendar how much we
anticipate spending for these events."

Toronto events and Montreal servings are both rows in `volunteer_events`, and both show on the Hub's Calendar
(`#calendar`, wave124, the Volunteering layer). Nothing in the Hub stores what an event is expected to cost (finance has
transactions and department budgets, never per event). Deliver:

1. A `budget` amount on `volunteer_events`: the anticipated spend for that event, in Canadian dollars, optional.
2. In the **Toronto Volunteers app** (wave274): set it in New event and Edit the event, and see it in the Plan step.
3. On the **Calendar**: every event that has one shows its anticipated spend, and the month shows its total, whatever the
   city (Montreal servings show it too once someone sets one; setting it for Montreal is not in this wave).

## 2. What exists (read these)

- The Toronto app: `build/parts274/*.js`, assembled by `python3 build/parts274/assemble.py` into
  `build/src/274_wave274.seg` (never edit a `.seg` by hand). Its brief: `docs/toronto/wave274 brief.md` (section 6 is the
  design bar, which applies here unchanged). Its release note: `docs/05-11-26 - wave274 the Toronto Volunteers app.md`.
  - `c_data.js`: `EV_COLS` (an explicit column list), `loadEvents`, `createEvent`, `saveEvent` (which writes the audit
    trail), `missingFn` (how the app detects a missing table or function and falls back: follow that pattern).
  - `g_sheets.js`: `eventSheet()` (New event and Edit the event) and how it validates and saves.
  - `e_event.js`: the Plan step (`planHtml` and the kitchen box with its `dl.w274dl`).
  - `a_head.js`: `nf()` (Canadian number format) and the other helpers.
- The Calendar: `build/parts124/*.js`, assembled by `python3 build/parts124/assemble.py` into `build/src/124_wave124.seg`
  (the parts and the segment match today; check `git status` after assembling). `c_data.js` `loadRange()` selects
  `volunteer_events` with an explicit column list; `d_cal.js` draws the month and agenda views and `items()` makes the
  Volunteering items (`k: 'vol'`); `f_sheet.js` draws an item's sheet (`it.k === 'vol'`). Mark every edit there with
  `/* wave274b */`.
- Tests boot with `test/boot.js` (`fresh(browser, { who, width, hash, init, rpcs })`); see `test/w274drive.js`,
  `test/w274fx.js` and `test/w124drive.js` for the patterns. The stub (`test/stub_supabase.js`) accepts any column, so to
  test the fallback, wrap `db.from` in your `init` so a select or write that names `budget` returns
  `{ data: null, error: { code: '42703', message: 'column volunteer_events.budget does not exist' } }`.
  Run with `export WA_CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome; bash build/build.sh && CAND=build/candidate.html node test/<name>.js`.

## 3. The work

1. `build/data/wa274b_budget.sql` (a file only, idempotent):
   `alter table public.volunteer_events add column if not exists budget numeric(10,2)` with a check (null, or 0 to
   100000), and a comment ("wave274b: the anticipated spend for this event in Canadian dollars, set in the Toronto
   Volunteers app, shown on the Hub calendar"). Nothing else: the table's row security already covers it.
2. **Toronto app (parts274):**
   - `EV_COLS` gains `budget`. If the select fails because the column does not exist (42703, PGRST204, "column ... does
     not exist"), load again without it and set `S.budgetOk = false`; otherwise `true`. Inserts and updates never send
     `budget` while `S.budgetOk` is false.
   - New event and Edit the event: an optional field **Anticipated spend** after Planned meals, a text input with
     `inputmode="decimal"`, a `$` shown before it (a decorative prefix, the label says "Anticipated spend, in dollars"),
     and the hint "Groceries and supplies you expect to pay for. It shows on the Hub calendar." Accept `250`, `250.5`,
     `$1,250.00`; reject anything else, or over 100,000, in words beside the field (the existing error pattern). Empty
     clears it (null). While `S.budgetOk` is false the field is not shown and the sheet says nothing about it.
   - Plan: the kitchen box's list gains a row **Anticipated spend** with the amount (`$250`, `$1,250.50`: Canadian
     format, cents only when there are cents) or "Not set" in the muted style. While `S.budgetOk` is false the row reads
     "Opens once the Toronto database update is applied."
   - The save goes through `saveEvent` (so the audit trail records it) and repaints Plan in place.
3. **Calendar (parts124):**
   - `loadRange()` selects `budget` too; on the missing-column error it asks again without it, and does not ask for it
     again in that page load.
   - A Volunteering item with a budget shows it: in the agenda view on its line (for example "Anticipated spend $250"),
     in the month view as a short tag after the title only where it fits (never widening a cell or making the page
     scroll sideways at 390 px), and in the item's sheet as its own line.
   - **The month's total**: with the Volunteering layer on and at least one event in the shown month with a budget, one
     quiet line near the month's title or the legend: "Anticipated spend this month: $1,250 on 3 events", and when both
     cities have one, "(Toronto $750, Montreal $500)". A city is Toronto when `location` says Toronto, otherwise
     Montreal. Cancelled events are left out of the total. Nothing shows when no event has a budget.
   - Only the Hub's tokens and the calendar's existing styles; no new colours or fonts.
4. **Tests:** `test/w274bdrive.js`, admin and plain (the opsto profile, as in `w274drive.js`) at 1366 and 390 px:
   - New event with a budget writes it, Edit changes it and clears it, a bad value is refused in words.
   - Plan shows it, and "Not set" when empty.
   - The Calendar shows it on the item, in the sheet and in the month total. A Montreal serving with a budget counts
     under Montreal.
   - The fallback without the column: Toronto loads, the field is hidden, Plan says why, nothing sends `budget`, and the
     Calendar still shows every event.
   - No sideways scroll (compare with `screen.width`, as `w274drive.js` does), no page errors.
   - Regression: `w274drive.js` (222), `w274break.js` (238), `w124drive.js`, `w153drive.js` (45 of 46 is the known
     baseline). Report before and after.
5. **Docs:** `docs/05-11-26 - wave274b anticipated spend on the calendar.md` (what it does, the data, the fallback, the
   tests), and a one-paragraph `docs/ARCHITECTURE.md` entry after wave274's. Put in your report what the plan's ledger
   should say.

## 4. Do not

- Edit any `.seg` by hand, or any parts folder except `parts274` and `parts124`.
- Add the field to the Montreal Volunteer Manager (a later decision for Steel).
- Touch `site_files`, deploy scripts, edge functions or SQL other than the new file.

## 5. Hand back

The files changed; the test counts before and after; a screenshot folder
(`/tmp/claude-0/-home-user/84a99a95-9e9a-5af9-9254-00335e8dcb61/scratchpad/shots274b2/`) with the Plan, the sheets and the
Calendar month and agenda at both widths; anything the elephant should know.
