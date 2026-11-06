-- wa274b_budget (05/11/26): the anticipated spend of a volunteering event. Applied 06/11/26 by Steel in the SQL editor, with wa274_toronto.sql.
-- Steel (05/11/26): "they technically have the same calendar, and it would be good to see on the calendar how much we
-- anticipate spending for these events."
-- The brief: docs/toronto/wave274b brief.md. The release note: docs/05-11-26 - wave274b anticipated spend on the calendar.md.
--
-- One optional column on volunteer_events, in Canadian dollars, from 0 to 100,000. The Toronto Volunteers app (wave274) sets it
-- in New event and Edit the event and shows it in Plan; the Hub calendar (wave124) shows it on every event that has one, Toronto
-- or Montreal, and the month's total. Until this runs, both ask again without the column and say nothing about it.
-- The table's row security already covers the new column: nothing else changes. Safe to run twice.
-- Undo: alter table public.volunteer_events drop column if exists budget;

alter table public.volunteer_events
  add column if not exists budget numeric(10,2) constraint volunteer_events_budget_range check (budget is null or budget between 0 and 100000);

comment on column public.volunteer_events.budget is 'wave274b: the anticipated spend for this event in Canadian dollars, set in the Toronto Volunteers app, shown on the Hub calendar';
