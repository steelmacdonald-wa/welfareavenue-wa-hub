-- wa191b_close_evidence (01/10/26): finished servings close themselves only when the Hub can tell they happened.
-- The first run of wa191_close_past (wa191_flow) closed WA-26-20 (20/09/26) as completed; the operations sheet
-- ("Reoccurring Volunteers 2026", 2026 Schedule tab) has it as Cancelled. Four of the five closes matched the sheet.
-- 1. WA-26-20 goes back to cancelled, logged.
-- 2. wa191_close_past closes a past serving as completed only with evidence it happened: someone on its roster confirmed,
--    a survey answer, or a step ticked by a person. Without evidence the serving stays as it is and wa191_unclosed() lists it
--    for This week's "Did it happen?" (Happened or Cancelled, one tap, staff; wa191_settle).

update public.volunteer_events set status = 'cancelled' where code = 'WA-26-20' and status = 'completed';
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'volunteer_event', id::text, 'status', 'completed', 'cancelled (the operations sheet has it cancelled; wave191 had closed it as completed)', 'the Hub (wave191b)' from public.volunteer_events where code = 'WA-26-20';

create or replace function public.wa191_happened(p_event bigint) returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.event_roster r where r.event_id = p_event and (lower(coalesce(r.status, '')) = 'confirmed' or coalesce(r.confirm_status, '') = 'confirmed'))
      or exists (select 1 from public.volunteer_survey_responses s where s.event_id = p_event)
      or exists (select 1 from public.sop_event_steps s where s.event_id = p_event and s.done and coalesce(s.done_source, 'manual') = 'manual')
$$;
comment on function public.wa191_happened(bigint) is 'wave191b: whether the Hub holds evidence that a serving took place: someone on its roster confirmed, a survey answer, or a step a person ticked. wa191_close_past closes only these; the rest wait for a person (wa191_settle).';
revoke all on function public.wa191_happened(bigint) from public, anon;
grant execute on function public.wa191_happened(bigint) to authenticated;

create or replace function public.wa191_close_past() returns int
language plpgsql security definer set search_path to '' as $$
declare n int := 0; r record;
begin
  for r in select id, code, status from public.volunteer_events
           where kind = 'service' and status in ('planned', 'in progress') and event_date < (now() at time zone 'America/Toronto')::date loop
    if public.wa191_happened(r.id) then
      update public.volunteer_events set status = 'completed' where id = r.id;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_event', r.id::text, 'status', r.status, 'completed (the day after the serving; confirmations or a survey show it happened)', 'the Hub (wave191)');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
comment on function public.wa191_close_past() is 'wave191 (evidence rule from wave191b): a past serving still planned becomes completed when wa191_happened says it took place; one without evidence is left for a person to settle (wa191_unclosed, wa191_settle). Run by cron wa-serving-flow; logged in change_log.';
revoke all on function public.wa191_close_past() from public, anon, authenticated;

create or replace function public.wa191_settle(p_event bigint, p_status text) returns text
language plpgsql security definer set search_path to '' as $$
declare v_old text; v_who text := coalesce(auth.jwt()->>'email', 'staff');
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  if p_status not in ('completed', 'cancelled', 'planned') then raise exception 'completed, cancelled or planned'; end if;
  select status into v_old from public.volunteer_events where id = p_event and kind = 'service';
  if not found then raise exception 'No such serving'; end if;
  update public.volunteer_events set status = p_status where id = p_event;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_event', p_event::text, 'status', v_old, p_status, v_who);
  return p_status;
end $$;
comment on function public.wa191_settle(bigint, text) is 'wave191b: staff set a serving''s status to completed (it happened), cancelled or planned (reopened), logged. Used by This week''s "Did it happen?" and the serving''s Close and Reopen.';
revoke all on function public.wa191_settle(bigint, text) from public, anon;
grant execute on function public.wa191_settle(bigint, text) to authenticated;

create or replace function public.wa191_this_week_unclosed() returns jsonb
language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'code', e.code, 'date', e.event_date, 'title', e.title) order by e.event_date), '[]'::jsonb)
  from public.volunteer_events e
  where public.is_wa_staff() and e.kind = 'service' and e.status in ('planned', 'in progress')
    and e.event_date < (now() at time zone 'America/Toronto')::date and e.event_date >= (now() at time zone 'America/Toronto')::date - 120
$$;
comment on function public.wa191_this_week_unclosed() is 'wave191b: past servings (last 120 days) still planned, so the Hub could not tell whether they happened; This week asks "Did it happen?". Staff only (empty otherwise).';
revoke all on function public.wa191_this_week_unclosed() from public, anon;
grant execute on function public.wa191_this_week_unclosed() to authenticated;
