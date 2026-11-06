-- Welfare Avenue Hub: wave290, 06/11/26. Your servings this year, on Home (Steel, 06/11/26).
-- Every member volunteers at four servings a year, counted by the fiscal year (October to September), as the onboarding says (wave191p).
-- From 15 November each fiscal year, Home shows a Montreal team member how many they have of the four and the next servings to pick;
-- once they reach four it thanks them for seven days, then leaves until the next fiscal year. Toronto (department opsto) and the board do
-- not see it. It adds:
--   1. wa191_onb_signup learns where a sign-up came from: the onboarding (as today) or Home, read from the setting wa.signup_via for the
--      rest of the transaction. The roster row, the change_log line, the Request to Operations Montreal and a new volunteer record say so.
--      Changed by exact replacement of anchors in its live text (pg_get_functiondef), as wave273 and wave281 did: if an anchor is missing
--      or appears an unexpected number of times the whole migration stops rather than overwrite something that moved. It first looks for
--      its own wave290 text and skips when it is already there.
--   2. wa290_home_servings(): what the Home card shows, and whether it shows at all.
--   3. wa290_home_signup(p_events, p_role): Home's Confirm my servings, the same sign-up marked as from Home.
--   4. app_config servings_card_from: the day the card starts each fiscal year, as MM-DD (11-15).
-- Safe to run twice. No transaction control: the release runs it through the Supabase connector, and build/sql_rollback_test.py runs it
-- inside a block that rolls back. Built 06/11/26, not released. Undo: build/data/wa290_undo.sql.

-- ============================================================================================ 1. where a sign-up came from
do $mig$
declare v text; a text[]; b text[]; k int[]; i int; n int;
begin
  v := pg_get_functiondef('public.wa191_onb_signup(bigint[],text,text)'::regprocedure);
  if position('wa.signup_via' in v) = 0 then
    a := array[
      $x$v_n int := 0; v_step boolean := false;$x$,
      $x$'Team member; signed up for a serving in the onboarding (wave191p)'$x$,
      $x$jsonb_build_object('attending', 'yes', 'via', 'onboarding', 'at', now()), jsonb_build_object('source', 'onboarding', 'member', v_email), 960)$x$,
      $x$|| ' (the onboarding)', v_email);$x$,
      $x$|| jsonb_build_object('attending', 'yes', 'via', 'onboarding', 'at', now())$x$,
      $x$'From', 'The onboarding: they are already Confirmed on the roster'),$x$,
      $x$'requested', v_name, v_email, 'onboarding', v_ops->>'name')$x$
    ];
    b := array[
      $x$v_n int := 0; v_step boolean := false; v_via text := case when current_setting('wa.signup_via', true) = 'home' then 'home' else 'onboarding' end;$x$,
      $x$'Team member; signed up for a serving ' || case when v_via = 'home' then 'from Home (wave290)' else 'in the onboarding (wave191p)' end$x$,
      $x$jsonb_build_object('attending', 'yes', 'via', v_via, 'at', now()), jsonb_build_object('source', v_via, 'member', v_email), 960)$x$,
      $x$|| case when v_via = 'home' then ' (Home)' else ' (the onboarding)' end, v_email);$x$,
      $x$|| jsonb_build_object('attending', 'yes', 'via', v_via, 'at', now())$x$,
      $x$'From', case when v_via = 'home' then 'Home: they are already Confirmed on the roster' else 'The onboarding: they are already Confirmed on the roster' end),$x$,
      $x$'requested', v_name, v_email, v_via, v_ops->>'name')$x$
    ];
    k := array[1, 2, 1, 1, 1, 1, 1];
    for i in 1 .. array_length(a, 1) loop
      n := (length(v) - length(replace(v, a[i], ''))) / length(a[i]);
      if n <> k[i] then raise exception 'wave290: a live function moved: wa191_onb_signup (anchor %, found % times, expected %)', i, n, k[i]; end if;
      v := replace(v, a[i], b[i]);
    end loop;
    execute v;
  end if;
end $mig$;
comment on function public.wa191_onb_signup(bigint[], text, text) is 'wave191p: a team member chooses servings in the onboarding: found by their email (the volunteer list, then the CRM, else a new volunteer record, one record with the CRM), Confirmed on each open serving chosen (six at most; confirm.via onboarding; role server, photographer, community_talker, cook or driver), a Request to Operations Montreal (serving-signup, assigned to the operations lead) with the dates, the role and their message, and their onboarding step Mandatory volunteering (86e1cj9hg) ticked (step: true when they have it and it is done). Logged; autotick. Team members only. wave290: Home''s card calls it through wa290_home_signup, which sets wa.signup_via to home for the transaction: then confirm.via, detail.source and the Request''s source are home, the Request says From Home, and the change_log line ends (Home). Without the setting it behaves as before.';

-- ============================================================================================ 2. what Home shows
create or replace function public.wa290_home_servings()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_email text; m record; v_today date; v_from date; v_to date; v_cfg text; v_mm int; v_dd int; v_show date;
  v_data jsonb; v_done int; v_target int; v_pid bigint; v_reached timestamptz; v_until timestamptz;
begin
  if not public.is_wa_staff() then return jsonb_build_object('show', false, 'why', 'staff'); end if;
  v_email := lower(auth.jwt() ->> 'email');
  select tm.id, tm.department, tm.active into m from public.team_members tm where lower(tm.email) = v_email order by tm.active desc nulls last, tm.id limit 1;
  if m.id is null or not coalesce(m.active, false) then return jsonb_build_object('show', false, 'why', 'member'); end if;
  if coalesce(m.department, '') in ('opsto', 'board') then return jsonb_build_object('show', false, 'why', 'montreal'); end if;
  -- the fiscal year, as wa191_onb_servings counts it
  v_today := (now() at time zone 'America/Toronto')::date;
  v_from := make_date(extract(year from v_today)::int - case when extract(month from v_today) >= 10 then 0 else 1 end, 10, 1);
  v_to := (v_from + interval '1 year' - interval '1 day')::date;
  -- the day the card starts this fiscal year: app_config servings_card_from (MM-DD), 11-15 when unset or unreadable
  v_cfg := coalesce((select btrim(c.value) from public.app_config c where c.key = 'servings_card_from'), '11-15');
  if v_cfg !~ '^[0-9]{2}-[0-9]{2}$' then v_cfg := '11-15'; end if;
  v_mm := split_part(v_cfg, '-', 1)::int; v_dd := split_part(v_cfg, '-', 2)::int;
  begin
    v_show := make_date(extract(year from v_from)::int + case when v_mm < 10 then 1 else 0 end, v_mm, v_dd);
  exception when others then
    v_show := make_date(extract(year from v_from)::int, 11, 15);
  end;
  if v_today < v_show then return jsonb_build_object('show', false, 'why', 'later', 'show_from', v_show); end if;
  v_data := public.wa191_onb_servings();
  v_done := coalesce((v_data #>> '{year,done}')::int, 0);
  v_target := coalesce((v_data #>> '{year,target}')::int, 4);
  if v_done >= v_target then
    -- when they reached the target: the moment their fourth counted serving was confirmed (the same rows wa191_onb_servings counts)
    select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.emails) y where lower(btrim(y)) = v_email) order by vp.id limit 1;
    select q.t into v_reached from (
      select coalesce(r.confirmed_at, r.created_at) as t
        from public.event_roster r join public.volunteer_events e on e.id = r.event_id
       where v_pid is not null and r.person_id = v_pid and e.kind = 'service' and e.event_date between v_from and v_to and coalesce(e.status, '') <> 'cancelled'
         and (lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed')
       order by 1 nulls first offset greatest(v_target - 1, 0) limit 1) q;
    v_until := coalesce(v_reached, '-infinity'::timestamptz) + interval '7 days';
    if now() >= v_until then return jsonb_build_object('show', false, 'why', 'done', 'done', v_done, 'target', v_target); end if;
    return v_data || jsonb_build_object('show', true, 'state', 'thanks', 'until', v_until, 'show_from', v_show);
  end if;
  return v_data || jsonb_build_object('show', true, 'state', 'todo', 'show_from', v_show);
end $function$;
revoke all on function public.wa290_home_servings() from public, anon;
grant execute on function public.wa290_home_servings() to authenticated, service_role;
comment on function public.wa290_home_servings() is 'wave290: the Your servings card on Home, for the signed-in team member. show false (with why) for anyone not staff (staff), without an active team_members row (member), in Toronto or on the board (department opsto or board: montreal), before the start day this fiscal year (later, with show_from; app_config servings_card_from, MM-DD, 11-15 by default), or seven days after they reached the target (done). Otherwise wa191_onb_servings (me, ops, year with done of target, the next six servings) plus show true, state todo or thanks, show_from, and until (the end of the thank-you). Reads only. Staff only.';

-- ============================================================================================ 3. Home's Confirm my servings
create or replace function public.wa290_home_signup(p_events bigint[], p_role text default 'server')
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r jsonb;
begin
  perform set_config('wa.signup_via', 'home', true);
  r := public.wa191_onb_signup(p_events, p_role, null);
  perform set_config('wa.signup_via', '', true);
  return r;
end $function$;
revoke all on function public.wa290_home_signup(bigint[], text) from public, anon;
grant execute on function public.wa290_home_signup(bigint[], text) to authenticated, service_role;
comment on function public.wa290_home_signup(bigint[], text) is 'wave290: Confirm my servings on Home''s Your servings card: wa191_onb_signup with wa.signup_via set to home for the call (no message), so the member is Confirmed on each serving chosen and Operations Montreal gets a Request that says From Home. Returns what wa191_onb_signup returns. Team members only (checked inside wa191_onb_signup).';

-- ============================================================================================ 4. the start day
insert into public.app_config (key, value, updated_at)
select 'servings_card_from', '11-15', now()
 where not exists (select 1 from public.app_config c where c.key = 'servings_card_from');
