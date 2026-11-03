# Team availability (when-to-meet) design

Date: 2026-11-02. Owner: Steel. Status: draft for builder check.

## Intent

Managers lose time every term finding a meeting slot that works for their team. Many members are students, so availability shifts at the start of the school year, the new year and the start of summer, and managers get no heads up. Today the search happens by Slack back-and-forth.

This wave adds a typical-week availability grid to the Hub. Every team member enters the hours they could meet, effective from a date. The team's Agenda tab overlays everyone's grid so the manager can see which slots work for the whole team and propose a new time in one click.

## Goals

- A member can enter a typical week of availability in under two minutes, from a Home pop-up or from the Agenda tab.
- A manager can open the Agenda tab and see, without clicking, which half-hour slots the most people can make.
- Availability refreshes at the moments it actually changes: the member sets an effective-from date, and the Hub re-asks at term boundaries.
- Light nudge toward enough hours (10 hour minimum), never a block.

## Non-goals

- Booking the meeting into Google Calendar. The manager still creates the event the way they do today. (The existing hub@ calendar mirror greys out clashing slots in the grid; that is reuse, not new work.)
- Specific-date availability or per-week exceptions. Typical week only, confirmed by Steel.
- Volunteers (volunteer_people / event_roster). This is for team members in `team_members` only.
- Replacing the HR onboarding grid from wave271. It stays as is; this wave reuses its code and settings pattern.

## Anti-goals

- A pop-up that nags. If it fires every visit, or cannot be dismissed, people will enter junk to make it go away.
- A hard gate on 10 hours. Someone with a genuinely tight week must still be able to save.
- Showing one person's availability as a judgement. The overlay is a heat map, not a list of who is "least available".

## Who sees what

- **Member** (any row in `team_members`, any `hub_roles` level that can sign in): enters and edits their own availability. Sees the team heat map on the Agenda tab too (transparency helps compromise, which Steel cares about).
- **Manager** (the person a seat reports to in `org_positions.reports_to`, or `hub_roles.leader` for the department; same rule as `wa271_default_manager()`): everything a member sees, plus "Propose this slot" and "Ask the team to update availability".
- **Admin / HR**: same as manager for every team.

## The member flow

1. **Home pop-up.** On Home, a centred dialog (bottom sheet on phones) in the visual style of wave177's `#w177pop`: "Your availability for [team] meetings". It shows when the member has no grid, or their grid was saved before the current ask (see triggers). Unlike wave177 since wave238, this one does have "Ask me later": a 3-day snooze stored in `hub_team_avail.snoozed_until` (a stub row with empty slots is allowed), plus Escape. Wave272's `otherOpen()` is private to its segment, so wave276 copies the same id list, adds `#w276pop` to it, and wave272's list gets `#w276pop` added too, so neither stacks on the other.
2. **The grid.** A half-hour grid keyed to weekday, not absolute date: 7 columns Mon to Sun, rows from `avail_grid_start` to `avail_grid_end` (defaults 08:00 to 22:00, `cell_min` 30, in `app_config` like the onboarding keys). Drag to paint. This is new client code in the Hub bundle, ported from the paint grid on the public onboarding page (`build/o/index.html`); `parts271/b_pick.js` is HR's click-to-pick view over dated slots and is not reusable as is.
   **Calendar clashes (my call):** read the member's hub@ meetings for the next 4 weeks through `calendar_my_meetings()`, fold them onto weekdays, and dim a cell when it clashes in 3 or more of those 4 weeks (a recurring meeting). One-off clashes are not shown. The same fold gives the manager's "fewest clashes" ranking: a slot's clash score is the sum over team members of recurring clashes.
3. **Effective from.** A date field above the grid, default today. Label: "Valid from". One helper line: "Pick the date your week changes, for example the first day of term."
4. **Hour count and note.** A live total of selected hours. Under 10 hours, the approved note appears beneath the grid (not a toast, not red):

   > Thanks for adding your availability. Could you add a little more? We ask for at least 10 hours so your manager has room to find a time that works for the whole team.
   >
   > If your week is tight, that's fine. Even an extra hour or two near the times you already picked helps, since the next person can plan around them.

   Save stays enabled.
5. **Save.** Writes one row per person per team per effective-from date. Previous rows stay (history), the newest effective-from on or before today is the active one.
6. **Edit later.** Agenda tab has "My availability" button that opens the same dialog.

If a member is on more than one team, the pop-up asks once per team, one team per visit, most recently asked team last. Rows are keyed by the signed-in (canonical) email, never a `team_members` alias, and a member of two teams has one grid per team (my call: meeting windows differ by team, and the heat map is per team).

## The manager flow (Agenda tab)

Above the existing agenda tool on `#team/<code>/agenda`, a new panel "When can we meet?":

- **Heat map.** The same 7 x N grid, each cell shaded by the number of active members available. Hover or tap shows names available and names not. Members with no grid are listed as "not yet entered" with a count, not shaded as unavailable.
- **Best slots.** Top three contiguous windows of at least 60 minutes ranked by headcount, then by fewest calendar clashes. Each has "Propose".
- **Propose.** Opens a short confirm: slot, who can make it, who cannot. On confirm, calls `notify` with a new relay event `meet_propose` that DMs each team member: "[Manager] is proposing [team] meetings move to [Day HH:MM]. Reply on Slack if that does not work." Logs to `hub_notifications_sent` as every relay does. No calendar write.
- **Ask for availability.** Button that sets a new "ask" for the team (see triggers) and DMs members without a current grid, relay event `meet_avail_ask`, text: "[Team] is planning meeting times. Add your typical week in the Hub: [url]".
- **Last updated.** Small line: "12 of 15 entered, 3 outstanding", with names on tap for the manager.

## Triggers (when the Hub asks again)

A per-team "ask" row with a date. The pop-up fires for a member when they have no grid for that team, or their newest row's `updated_at` is before the team's latest ask date (my call: comparing `updated_at`, not `effective_from`, so someone who entered "valid from 1 Sept" in August is not re-asked by the September ask).

- Manager or admin can set an ask from the Agenda tab (above).
- Default asks are seeded for every team at three dates a year: first Monday of September, first Monday of January, first Monday of May. These are rows, so Steel can edit them in SQL or a later admin screen. My call: seeding beats building a settings UI now.
- The pop-up is also allowed to show once at most every 3 days after a snooze.

## Data

New tables (RLS on, grants explicit, every column commented, DATA_MODEL regenerated):

- `hub_team_avail`: id, email, department (team code), effective_from date, slots (text or jsonb of weekday+slot indexes, same encoding family as `hub_onboard_grids`), hours numeric, created_at, updated_at, snoozed_until. Own-row insert/select/update by email. Team-wide select through a new predicate `wa_avail_can_see(dept)`: true when the reader is on that team, manages it, or is admin or HR. (The `wa_timeoff` policies gate on HR only, so this predicate is new, not copied.)
- `hub_team_avail_ask`: id, department, ask_date, set_by email, note, created_at. Insert allowed where `wa_avail_can_manage(dept)`; staff may read.
- `wa_avail_can_manage(dept)`: true for admin, HR, the person that team's seats report to in `org_positions`, and any `hub_roles.leader` on that team (Steel's decision, 02/11/26).
- `app_config` keys: `avail_grid_start`, `avail_grid_end`, `avail_cell_min`, `avail_min_hours` (10).
- RPC `wa_avail_team(code)` security definer with the access check inside, returning the active row per member plus the "not entered" list, so the client never has to compute "active" itself.

## Edge function changes

`notify`: two new relay kinds, `meet_propose` and `meet_avail_ask`, added to the relay `if`, the title/url maps and `HUB_EVENTS`. Called from the client with the staff JWT path (manager action), so add both kinds to the list of events the JWT path allows. **Authorisation (my call):** the JWT path today checks only the event name, which would let any staff member DM a whole team. For these two kinds `notify` must additionally call `wa_avail_can_manage(dept)` with the caller's email through the service client and refuse with 403 otherwise. Recipients are always resolved server-side from `team_members` for that dept, never taken from the request body.

## Build and release

New wave folder `build/parts276/` with `assemble.py`, segment inserted in MANIFEST after 272 and before 271 per the current tail order. Follow `docs/HUB_RELEASE_CHECKLIST.md`: stage, gate, `host-sync`. SQL runs through the connector as usual (Steel's standing rule). Migrations by `fn.py` for notify.

## Left to the builder

- Exact slot encoding, so long as the team RPC returns something the heat map can shade in one pass.
- Heat map colours, within the Hub's existing palette.
- Whether the Agenda panel is collapsed by default on phones.
- Test drive script in `test/` like the other waves.

## Decisions from the builder check

- Several leaders on a team: every leader gets Propose and Ask, not only the reporting line. Steel, 02/11/26.

Status: approved by Steel 02/11/26.
