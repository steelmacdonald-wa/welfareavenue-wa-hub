-- Welfare Avenue Hub: wave290b, 06/11/26. The Next serving card for everyone, and a shout-out at four servings (Steel, 06/11/26).
-- Steel: "those that have volunteered 4 times should be given a shout-out on the hub updates. Next to the upcoming up with a sign up button that
-- opens a volunteer form. Or whatever makes it seem less for operations." His choices: two views of the Next serving card (Operations Montreal keep
-- theirs, everyone else sees a friendly one with Sign up), and the shout-out in the Hub's shout-outs (hub_shoutouts: the loading screen, the HR
-- centre and the Executive dashboard). Runs after build/data/wa290_home_servings.sql (wa290_home_signup is the sign-up the pop-up uses).
--   1. wa290_next_serving(): the friendly card's facts for the signed-in team member: the next Montreal serving, its spots still open per role,
--      how many are confirmed, whether they are on it, and whether they are in Operations Montreal (who keep the operations view).
--   2. wa290_servings_shoutouts(): writes one shout-out per team member per fiscal year when they have volunteered at four servings (served:
--      the serving is completed or its day has passed, and they were Confirmed on it). Nothing else is sent: no Slack, email or notification.
--   3. The cron job wa-servings-shoutouts, every morning at 11:25 UTC (07:25 in Toronto), after the shoutouts job (11:10).
-- Safe to run twice. No transaction control. Built 06/11/26, not released. Undo: build/data/wa290b_undo.sql.

-- ============================================================================================ 1. the friendly Next serving card
create or replace function public.wa290_next_serving()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_email text; m record; v_ops boolean; v_today date; e record; v_pids bigint[]; v_roles jsonb; v_total int; v_open int; v_conf int; v_mine boolean;
begin
  if not public.is_wa_staff() then raise exception 'Team members only'; end if;
  v_email := lower(auth.jwt() ->> 'email');
  select tm.id, tm.department into m from public.team_members tm where lower(tm.email) = v_email order by tm.active desc nulls last, tm.id limit 1;
  v_ops := coalesce(m.department, '') = 'opsmtl' or exists (select 1 from public.hub_roles r where r.email = v_email and r.profile = 'opsmtl');
  v_today := (now() at time zone 'America/Toronto')::date;
  -- the same serving the Next serving card shows (wave171): the next Montreal service that is not cancelled
  select ev.id, ev.event_date, ev.start_time, ev.location, ev.format, ev.spot_counts into e
    from public.volunteer_events ev
   where ev.kind = 'service' and ev.event_date >= v_today and coalesce(ev.status, '') <> 'cancelled' and coalesce(ev.location, '') not ilike '%toronto%'
   order by ev.event_date, ev.id limit 1;
  if e.id is null then return jsonb_build_object('ops', v_ops, 'event', null); end if;
  select coalesce(array_agg(vp.id), '{}') into v_pids from public.volunteer_people vp where exists (select 1 from unnest(vp.emails) y where lower(btrim(y)) = v_email);
  -- per role: the spots (this serving's spot_counts, else the role guide's target), filled = Confirmed on the roster plus a partner's headcount
  with t as (
    select g.role, coalesce(g.label_en, initcap(replace(g.role, '_', ' '))) as label, coalesce((e.spot_counts ->> g.role)::int, g.target, 0) as spots
      from public.volunteer_role_guides g where g.role not in ('community_talker', 'volunteer')
  ), c as (
    select r.role, count(*)::int as n from public.event_roster r
     where r.event_id = e.id and (lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed') and lower(coalesce(r.status, '')) not in ('cancelled', 'unavailable')
     group by r.role
  ), p as (
    select k.key as role, sum(case when k.value ~ '^[0-9]+$' then k.value::int else 0 end)::int as n
      from public.volunteer_event_partners vep, jsonb_each_text(coalesce(vep.covers, '{}'::jsonb)) k
     where vep.event_id = e.id and vep.active group by k.key
  ), o as (
    select t.role, t.label, t.spots, greatest(0, t.spots - coalesce(c.n, 0) - coalesce(p.n, 0)) as open
      from t left join c on c.role = t.role left join p on p.role = t.role where t.spots > 0
  )
  select coalesce(sum(o.spots), 0)::int, coalesce(sum(o.open), 0)::int,
         coalesce(jsonb_agg(jsonb_build_object('role', o.role, 'label', o.label, 'open', o.open) order by o.open desc, o.label) filter (where o.open > 0), '[]'::jsonb)
    into v_total, v_open, v_roles from o;
  select count(*)::int into v_conf from public.event_roster r
   where r.event_id = e.id and (lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed') and lower(coalesce(r.status, '')) not in ('cancelled', 'unavailable');
  select exists (select 1 from public.event_roster r where r.event_id = e.id and r.person_id = any (v_pids)
                  and (lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed') and lower(coalesce(r.status, '')) not in ('cancelled', 'unavailable')) into v_mine;
  return jsonb_build_object('ops', v_ops,
    'event', jsonb_build_object('id', e.id, 'date', e.event_date, 'start', public.wa174_hm(coalesce(e.start_time, '12:00'::time)), 'location', coalesce(nullif(e.location, ''), 'Montreal'),
                                'partner', (select vep.partner_name from public.volunteer_event_partners vep where vep.event_id = e.id and vep.active limit 1)),
    'spots', jsonb_build_object('total', v_total, 'open', v_open, 'roles', v_roles), 'confirmed', v_conf, 'mine', coalesce(v_mine, false));
end $function$;
revoke all on function public.wa290_next_serving() from public, anon;
grant execute on function public.wa290_next_serving() to authenticated, service_role;
comment on function public.wa290_next_serving() is 'wave290b: the friendly Next serving card on Home, for the signed-in team member: ops (true for Operations Montreal: department or access profile opsmtl, who keep wave171''s operations view), the next Montreal serving (the one wave171''s card shows: id, date, start, location, partner), spots (total, open and the open roles with their labels: this serving''s spot_counts, else volunteer_role_guides.target; filled = Confirmed on the roster plus an active partner''s covers), confirmed (everyone Confirmed) and mine (they are Confirmed on it). Reads only; names nobody. Team members only.';

-- ============================================================================================ 2. the shout-out at four servings
create or replace function public.wa290_servings_shoutouts()
returns integer language plpgsql security definer set search_path to '' as $function$
declare v_today date; v_from date; v_to date; v_fy int; n int := 0; r record;
begin
  v_today := (now() at time zone 'America/Toronto')::date;
  v_from := make_date(extract(year from v_today)::int - case when extract(month from v_today) >= 10 then 0 else 1 end, 10, 1);
  v_to := (v_from + interval '1 year' - interval '1 day')::date;
  v_fy := extract(year from v_from)::int + 1;   -- the fiscal year is named for the year it ends in (FY27: October 2026 to September 2027)
  for r in
    select tm.id, tm.name, tm.department, count(distinct e.id)::int as served
      from public.team_members tm
      join public.volunteer_people vp on exists (select 1 from unnest(vp.emails) y where lower(btrim(y)) = lower(tm.email))
      join public.event_roster ro on ro.person_id = vp.id
      join public.volunteer_events e on e.id = ro.event_id
     where tm.active and coalesce(tm.department, '') <> 'board' and coalesce(tm.email, '') <> ''
       and e.kind = 'service' and e.event_date between v_from and v_to and coalesce(e.status, '') <> 'cancelled'
       and (e.status = 'completed' or e.event_date < v_today)
       and (lower(coalesce(ro.status, '')) = 'confirmed' or ro.confirm_status = 'confirmed') and lower(coalesce(ro.status, '')) not in ('cancelled', 'unavailable')
     group by tm.id, tm.name, tm.department
    having count(distinct e.id) >= 4
  loop
    if not exists (select 1 from public.hub_shoutouts s where s.ref = 'servings:' || v_fy || ':' || r.id) then
      insert into public.hub_shoutouts (kind, source, ref, person, member_id, team, text, by, expires_at, active)
      values ('auto', 'servings', 'servings:' || v_fy || ':' || r.id, r.name, r.id, r.department,
              split_part(btrim(r.name), ' ', 1) || ' has volunteered at four servings this year. Thank you for showing up for our community!',
              'the hub', now() + interval '10 days', true);
      n := n + 1;
    end if;
  end loop;
  return n;
end $function$;
revoke all on function public.wa290_servings_shoutouts() from public, anon, authenticated;
grant execute on function public.wa290_servings_shoutouts() to service_role;
comment on function public.wa290_servings_shoutouts() is 'wave290b: writes a shout-out (hub_shoutouts kind auto, source servings, ref servings:<fiscal year>:<team member id>, ten days) for each active team member, not the board, who has volunteered at four Montreal servings this fiscal year (October to September): Confirmed on a service that is completed or whose day has passed, not cancelled. Once per member per fiscal year. Sends nothing else. Run every morning by the cron job wa-servings-shoutouts; returns how many it wrote. Service role only.';

-- ============================================================================================ 3. every morning
do $cron$
begin
  if not exists (select 1 from cron.job where jobname = 'wa-servings-shoutouts') then
    perform cron.schedule('wa-servings-shoutouts', '25 11 * * *', 'select public.wa290_servings_shoutouts()');
  end if;
end $cron$;
