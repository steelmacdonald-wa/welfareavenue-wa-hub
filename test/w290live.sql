-- wave290: assertions on the live database, after build/data/wa290_home_servings.sql. Runs only inside the block build/sql_rollback_test.py
-- prints, after test/w290live_before.sql and the migration, so everything rolls back: the invented member, their servings, the Requests and
-- the change_log lines. No transaction control. Raises on the first failure with the check's name and counts only; personal data never leaves
-- the database. Invented rows only (Test W290, test.w290.member@welfareavenue.com). Requests are announced through pg_net (call_edge), which
-- only sends after a commit, so nothing reaches Slack, email or a phone. Works on any day of the year: the start day is moved for the checks.

do $live$
declare e record; v text; r jsonb; x record; n int;
  v_email text := 'test.w290.member@welfareavenue.com'; v_tm bigint; v_pid bigint; v_ev bigint[]; v_req bigint;
  v_today date; v_from date; v_to date; v_nov date;
begin
  select * into e from pg_temp.w290_expect;
  v_today := (now() at time zone 'America/Toronto')::date;
  v_from := make_date(extract(year from v_today)::int - case when extract(month from v_today) >= 10 then 0 else 1 end, 10, 1);
  v_to := (v_from + interval '1 year' - interval '1 day')::date;
  v_nov := make_date(extract(year from v_from)::int, 11, 15);

  -- 1. the objects: patched once, grants and comment kept, the setting, who may run the new functions
  v := pg_get_functiondef('public.wa191_onb_signup(bigint[],text,text)'::regprocedure);
  if (length(v) - length(replace(v, 'wa.signup_via', ''))) / length('wa.signup_via') <> 1 then raise exception 'w290live 1: wa191_onb_signup is not patched exactly once'; end if;
  if (length(v) - length(replace(v, 'v_via', ''))) / length('v_via') <> 9 then raise exception 'w290live 1: wa191_onb_signup has % v_via, expected 9', (length(v) - length(replace(v, 'v_via', ''))) / length('v_via'); end if;
  if (select p.proacl::text from pg_proc p where p.oid = 'public.wa191_onb_signup(bigint[],text,text)'::regprocedure) is distinct from e.signup_acl then raise exception 'w290live 1: wa191_onb_signup grants changed'; end if;
  if obj_description('public.wa191_onb_signup(bigint[],text,text)'::regprocedure, 'pg_proc') not like e.signup_comment || ' wave290: %' then raise exception 'w290live 1: wa191_onb_signup comment is not the old one plus wave290'; end if;
  if (select c.value from public.app_config c where c.key = 'servings_card_from') is distinct from '11-15' then raise exception 'w290live 1: servings_card_from is not 11-15'; end if;
  if has_function_privilege('anon', 'public.wa290_home_servings()', 'execute') or has_function_privilege('anon', 'public.wa290_home_signup(bigint[],text)', 'execute') then raise exception 'w290live 1: anon can run a wa290 function'; end if;
  if not has_function_privilege('authenticated', 'public.wa290_home_servings()', 'execute') or not has_function_privilege('authenticated', 'public.wa290_home_signup(bigint[],text)', 'execute') then raise exception 'w290live 1: signed-in people cannot run a wa290 function'; end if;
  if obj_description('public.wa290_home_servings()'::regprocedure, 'pg_proc') is null or obj_description('public.wa290_home_signup(bigint[],text)'::regprocedure, 'pg_proc') is null then raise exception 'w290live 1: a wa290 function has no comment'; end if;

  -- 2. signed out: no card
  perform set_config('request.jwt.claims', '', true);
  r := public.wa290_home_servings();
  if r->>'show' <> 'false' or r->>'why' <> 'staff' then raise exception 'w290live 2: signed out: %', r->>'why'; end if;

  -- 3. an invented Montreal team member, signed in
  insert into public.team_members (name, email, department, role, active) values ('Test W290', v_email, 'marketing', 'Test member', true) returning id into v_tm;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_email)::text, true);
  r := public.wa290_home_servings();
  if v_today < v_nov then
    if r->>'show' <> 'false' or r->>'why' <> 'later' or (r->>'show_from')::date <> v_nov then raise exception 'w290live 3: before 15 November: show %, why %, from %', r->>'show', r->>'why', r->>'show_from'; end if;
  else
    if r->>'show' <> 'true' or (r->>'show_from')::date <> v_nov then raise exception 'w290live 3: from 15 November: show %, from %', r->>'show', r->>'show_from'; end if;
  end if;
  -- the start day moves with the setting; a value it cannot read falls back to 15 November
  update public.app_config set value = '09-30' where key = 'servings_card_from';
  r := public.wa290_home_servings();
  if (r->>'show_from')::date is distinct from v_to then raise exception 'w290live 3: 09-30 should start on the last day of the fiscal year, got %', r->>'show_from'; end if;
  update public.app_config set value = 'soon' where key = 'servings_card_from';
  r := public.wa290_home_servings();
  if (r->>'show_from')::date is distinct from v_nov then raise exception 'w290live 3: an unreadable value did not fall back to 15 November'; end if;
  update public.app_config set value = '02-30' where key = 'servings_card_from';
  r := public.wa290_home_servings();
  if (r->>'show_from')::date is distinct from v_nov then raise exception 'w290live 3: an impossible date did not fall back to 15 November'; end if;
  update public.app_config set value = '10-01' where key = 'servings_card_from';
  r := public.wa290_home_servings();
  if r->>'show' <> 'true' or r->>'state' <> 'todo' or (r#>>'{year,done}')::int <> 0 or (r#>>'{year,target}')::int <> 4 then raise exception 'w290live 3: the card for someone with no servings: show %, state %, done %', r->>'show', r->>'state', r#>>'{year,done}'; end if;
  if (r#>>'{year,from}')::date <> v_from or (r#>>'{year,to}')::date <> v_to then raise exception 'w290live 3: the year is not the fiscal year'; end if;
  if jsonb_typeof(r->'servings') <> 'array' or r->'me' is null then raise exception 'w290live 3: the servings or me are missing'; end if;

  -- the next four open servings to sign up for
  select array_agg(q.id order by q.event_date, q.id) into v_ev from (
    select ev.id, ev.event_date from public.volunteer_events ev
     where ev.kind = 'service' and coalesce(ev.status, '') not in ('cancelled', 'completed') and ev.event_date >= v_today and ev.event_date <= v_to
     order by ev.event_date, ev.id limit 4) q;
  if coalesce(array_length(v_ev, 1), 0) < 4 then raise exception 'w290live 3: fewer than four open servings to test with (%)', coalesce(array_length(v_ev, 1), 0); end if;

  -- 4. Confirm my servings from Home: Confirmed, marked as from Home, a Request that says so
  r := public.wa290_home_signup(array[v_ev[1]], 'server');
  if r->>'ok' <> 'true' then raise exception 'w290live 4: the Home sign-up did not say ok'; end if;
  if current_setting('wa.signup_via', true) is distinct from '' then raise exception 'w290live 4: the setting was left on after the call'; end if;
  v_req := (r->>'request')::bigint;
  select * into x from public.dept_requests d where d.id = v_req;
  if not found or x.source <> 'home' or x.type_key <> 'serving-signup' or x.department <> 'opsmtl' or x.details->>'From' <> 'Home: they are already Confirmed on the roster' or x.details->>'Message' <> '(no message)' then raise exception 'w290live 4: the Request is not marked as from Home'; end if;
  select * into x from public.event_roster ro where ro.event_id = v_ev[1] and ro.detail->>'member' = v_email;
  if not found or x.status <> 'Confirmed' or x.confirm_status <> 'confirmed' or x.confirm->>'via' <> 'home' or x.detail->>'source' <> 'home' then raise exception 'w290live 4: the roster row is not Confirmed from Home'; end if;
  v_pid := x.person_id;
  if not exists (select 1 from public.change_log c where c.entity_type = 'event_roster' and c.entity_id = x.id::text and c.new_value like '% (Home)') then raise exception 'w290live 4: no change_log line ending (Home)'; end if;
  if not exists (select 1 from public.volunteer_people vp where vp.id = v_pid and vp.joined_note like '%from Home (wave290)%') then raise exception 'w290live 4: the new volunteer record does not say it came from Home'; end if;
  r := public.wa290_home_servings();
  if (r#>>'{year,done}')::int <> 1 or r->>'state' <> 'todo' then raise exception 'w290live 4: after one sign-up: done %, state %', r#>>'{year,done}', r->>'state'; end if;
  if not exists (select 1 from jsonb_array_elements(r->'servings') s where (s->>'id')::bigint = v_ev[1] and (s#>>'{mine,confirmed}')::boolean) then raise exception 'w290live 4: the serving they chose does not say it is theirs'; end if;

  -- 5. the onboarding path is unchanged, in the same transaction, right after a Home sign-up
  r := public.wa191_onb_signup(array[v_ev[2]], 'photographer', 'Test W290 message');
  select * into x from public.dept_requests d where d.id = (r->>'request')::bigint;
  if x.source <> 'onboarding' or x.details->>'From' <> 'The onboarding: they are already Confirmed on the roster' or x.details->>'Message' <> 'Test W290 message' then raise exception 'w290live 5: the onboarding Request changed'; end if;
  select * into x from public.event_roster ro where ro.event_id = v_ev[2] and ro.person_id = v_pid;
  if x.confirm->>'via' <> 'onboarding' or x.detail->>'source' <> 'onboarding' then raise exception 'w290live 5: the onboarding roster row changed'; end if;
  if not exists (select 1 from public.change_log c where c.entity_type = 'event_roster' and c.entity_id = x.id::text and c.new_value like '% (the onboarding)') then raise exception 'w290live 5: the onboarding change_log line changed'; end if;

  -- 6. four of four: the thank-you for seven days, then the card leaves
  r := public.wa290_home_signup(array[v_ev[3], v_ev[4]], 'server');
  r := public.wa290_home_servings();
  if (r#>>'{year,done}')::int <> 4 or r->>'show' <> 'true' or r->>'state' <> 'thanks' then raise exception 'w290live 6: at four: done %, show %, state %', r#>>'{year,done}', r->>'show', r->>'state'; end if;
  if (r->>'until')::timestamptz < now() + interval '6 days 23 hours' or (r->>'until')::timestamptz > now() + interval '7 days 1 minute' then raise exception 'w290live 6: the thank-you does not last seven days'; end if;
  update public.event_roster set confirmed_at = now() - interval '8 days' where person_id = v_pid and event_id = any (v_ev);
  r := public.wa290_home_servings();
  if r->>'show' <> 'false' or r->>'why' <> 'done' then raise exception 'w290live 6: eight days after four: show %, why %', r->>'show', r->>'why'; end if;
  update public.event_roster set confirmed_at = now() - interval '6 days' where person_id = v_pid and event_id = v_ev[4];
  r := public.wa290_home_servings();
  if r->>'state' is distinct from 'thanks' then raise exception 'w290live 6: the fourth six days ago should still thank them'; end if;

  -- 7. Toronto, the board and a former member do not see it
  update public.team_members set department = 'opsto' where id = v_tm;
  r := public.wa290_home_servings();
  if r->>'show' <> 'false' or r->>'why' <> 'montreal' then raise exception 'w290live 7: Toronto sees the card'; end if;
  update public.team_members set department = 'board' where id = v_tm;
  r := public.wa290_home_servings();
  if r->>'show' <> 'false' or r->>'why' <> 'montreal' then raise exception 'w290live 7: the board sees the card'; end if;
  update public.team_members set department = 'marketing', active = false where id = v_tm;
  r := public.wa290_home_servings();
  if r->>'show' <> 'false' or r->>'why' <> 'member' then raise exception 'w290live 7: a former member sees the card'; end if;

  perform set_config('request.jwt.claims', '', true);
  raise notice 'w290live: every check passed';
end $live$;
