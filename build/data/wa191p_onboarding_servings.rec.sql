-- records wa191p_onboarding_servings (applied 02/10/26 as written; wa191_onb_signup applied again the same day with 'step'); this file only records it
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261002006000', 'wa191p_onboarding_servings', array[$m$-- wa191p_onboarding_servings (02/10/26): in the onboarding, choose your servings and tell the operations lead.
-- Steel (01/10/26): "in the onboarding, I want onboardees to view the next upcoming volunteering events and select 1 or more
-- so that they have confirmed date and to communicate with the operations manager", and "for the onboarding explain why it's
-- important to volunteer, really highlight this and add photos to encourage. It's critical to understanding the
-- organization, helps them fulfill their role better, and it required 4 times a year." (The lessons said "at least twice
-- a year".)
-- wa191_onb_servings: the next six servings, the member's place on each, how many they have this fiscal year (October to
-- September) of the four, and the operations lead in Montreal (org_positions). wa191_onb_signup: the member (found by their
-- email on the volunteer list or in the CRM, else a new volunteer record, one record with the CRM) is Confirmed on each
-- serving chosen (confirm.via onboarding), the Operations Montreal inbox gets a Request (serving-signup, assigned to the
-- operations lead) with the dates, the role and their message, and their onboarding step "Mandatory volunteering" ticks
-- itself. Team members only. The lessons: Week 3's chapter becomes "Why you volunteer" (photos, required four times a year,
-- why it matters, the servings to choose); Week 1 and the quiz say four times a year; the step and the journey say so too.

/* ---------- 1. the Request type (Operations Montreal) ---------- */
insert into public.request_types (key, label, department, description, fields, statuses, default_status, source, enabled, sort, default_assignee, channel, channel_mode)
values ('serving-signup', 'Serving sign-up', 'opsmtl', 'A team member signs up to volunteer at one or more servings (from the onboarding): the dates, the role they would like and their message. They are already Confirmed on the roster: welcome them and pair them with a team leader.',
        '[]'::jsonb, '["Requested", "In progress", "Done"]'::jsonb, 'requested', 'wave191p', true, 20, null, null, 'full')
on conflict (key) do nothing;

/* ---------- 2. the operations lead in Montreal (org chart) ---------- */
create or replace function public.wa191_ops_lead() returns jsonb
language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('name', tm.name, 'title', op.title, 'email', tm.email)
    from public.org_positions op join public.team_members tm on tm.id = op.member_id
   where op.department = 'opsmtl' and op.status = 'filled' and (op.title ilike 'operations lead%' or op.title ilike 'operations manager%')
   order by op.sort nulls last, op.id limit 1;
$$;
comment on function public.wa191_ops_lead() is 'wave191p: the operations lead (or manager) in Montreal from the org chart: name, title, email. Internal.';
revoke all on function public.wa191_ops_lead() from public, anon, authenticated;

/* ---------- 3. the next servings for the onboarding (team members) ---------- */
create or replace function public.wa191_onb_servings() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v_email text; m record; v_pid bigint; v_today date; v_from date; v_to date; v_n int; v_srv jsonb; v_ops jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Team members only'; end if;
  v_email := lower(auth.jwt() ->> 'email');
  select tm.id, tm.name, tm.department into m from public.team_members tm where lower(tm.email) = v_email order by tm.active desc nulls last, tm.id limit 1;
  select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.emails) y where lower(btrim(y)) = v_email) order by vp.id limit 1;
  v_today := (now() at time zone 'America/Toronto')::date;
  v_from := make_date(extract(year from v_today)::int - case when extract(month from v_today) >= 10 then 0 else 1 end, 10, 1);
  v_to := (v_from + interval '1 year' - interval '1 day')::date;
  select count(*) into v_n from public.event_roster r join public.volunteer_events e on e.id = r.event_id
   where v_pid is not null and r.person_id = v_pid and e.kind = 'service' and e.event_date between v_from and v_to and coalesce(e.status, '') <> 'cancelled'
     and (lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed');
  select coalesce(jsonb_agg(x order by x->>'date'), '[]'::jsonb) into v_srv from (
    select jsonb_build_object('id', e.id, 'code', e.code, 'date', e.event_date, 'start', public.wa174_hm(coalesce(e.start_time, '12:00'::time)), 'title', e.title,
             'location', coalesce(nullif(e.location, ''), 'Montreal'),
             'partner', (select p.partner_name from public.volunteer_event_partners p where p.event_id = e.id and p.active),
             'mine', (select jsonb_build_object('status', r.status, 'role', r.role, 'confirmed', lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed')
                        from public.event_roster r where v_pid is not null and r.event_id = e.id and r.person_id = v_pid and lower(coalesce(r.status, '')) <> 'cancelled' order by r.id limit 1)) as x
      from public.volunteer_events e
     where e.kind = 'service' and coalesce(e.status, '') not in ('cancelled', 'completed') and e.event_date >= v_today
     order by e.event_date limit 6) q;
  v_ops := public.wa191_ops_lead();
  return jsonb_build_object('me', jsonb_build_object('name', m.name, 'department', m.department),
    'ops', case when v_ops is not null then jsonb_build_object('name', v_ops->>'name', 'title', v_ops->>'title') end,
    'year', jsonb_build_object('from', v_from, 'to', v_to, 'done', v_n, 'target', 4), 'servings', v_srv);
end $$;
comment on function public.wa191_onb_servings() is 'wave191p: for the onboarding: the next six open servings (date, start, place, title, a partner organization) with the signed-in member''s place on each (by their email on the volunteer list), how many servings they have this fiscal year (October to September) of the four everyone gives, and the operations lead in Montreal. Team members only.';
grant execute on function public.wa191_onb_servings() to authenticated;

/* ---------- 4. signing up from the onboarding ---------- */
create or replace function public.wa191_onb_signup(p_events bigint[], p_role text, p_message text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_email text; m record; v_pid bigint; v_cid bigint; v_role text; e record; v_rid bigint; v_added jsonb := '[]'::jsonb; v_already jsonb := '[]'::jsonb;
  v_msg text; v_req bigint; v_ops jsonb; v_dates text; v_name text; v_n int := 0; v_step boolean := false;
begin
  if not public.is_wa_staff() then raise exception 'Team members only'; end if;
  v_email := lower(auth.jwt() ->> 'email');
  if v_email is null then raise exception 'Sign in first.'; end if;
  if p_events is null or coalesce(array_length(p_events, 1), 0) = 0 then raise exception 'Choose at least one serving.'; end if;
  if array_length(p_events, 1) > 6 then raise exception 'Six servings at most at once.'; end if;
  v_role := lower(coalesce(nullif(p_role, ''), 'server'));
  if v_role not in ('server', 'photographer', 'community_talker', 'cook', 'driver') then raise exception 'Which role would you like?'; end if;
  v_msg := nullif(left(btrim(coalesce(p_message, '')), 1500), '');
  select tm.id, tm.name, tm.department into m from public.team_members tm where lower(tm.email) = v_email order by tm.active desc nulls last, tm.id limit 1;
  v_name := coalesce(nullif(btrim(coalesce(m.name, '')), ''), split_part(v_email, '@', 1));
  -- their volunteer record: by email on the volunteer list, then the CRM (a volunteer record linked to it), else a new one
  select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.emails) y where lower(btrim(y)) = v_email) order by vp.id limit 1;
  if v_pid is null then
    select cc.id, cc.volunteer_id into v_cid, v_pid from public.crm_contacts cc
     where cc.merged_into is null and (lower(cc.primary_email) = v_email or exists (select 1 from unnest(cc.emails) y where lower(btrim(y)) = v_email)) order by cc.id limit 1;
    if v_cid is not null and v_pid is null then
      v_pid := nextval('public.volunteer_people_id_seq');
      insert into public.volunteer_profiles (id, roles, needs_review, created_at, joined_note)
      values (v_pid, array[v_role], false, now(), 'Team member; signed up for a serving in the onboarding (wave191p)');
      update public.crm_contacts set volunteer_id = v_pid, kinds = case when 'volunteer' = any (kinds) then kinds else kinds || array['volunteer'] end, updated_by = v_email, updated_at = now()
       where id = v_cid and volunteer_id is null;
    elsif v_pid is null then
      insert into public.volunteer_people (full_name, emails, phones, roles, tags, organization, joined_note)
      values (v_name, array[v_email], '{}'::text[], array[v_role], array['team member'], 'Welfare Avenue', 'Team member; signed up for a serving in the onboarding (wave191p)')
      returning id into v_pid;
    end if;
  end if;
  -- confirmed on each serving chosen
  for e in select ev.id, ev.code, ev.event_date from public.volunteer_events ev
            where ev.id = any (p_events) and ev.kind = 'service' and coalesce(ev.status, '') not in ('cancelled', 'completed') and ev.event_date >= (now() at time zone 'America/Toronto')::date
            order by ev.event_date loop
    v_rid := null;
    select r.id into v_rid from public.event_roster r where r.event_id = e.id and r.person_id = v_pid and lower(coalesce(r.status, '')) <> 'cancelled' order by r.id limit 1;
    if v_rid is null then
      insert into public.event_roster (event_id, person_id, person_name, role, status, confirm_status, confirmed_at, confirm, detail, sort)
      values (e.id, v_pid, coalesce((select vp.full_name from public.volunteer_people vp where vp.id = v_pid), v_name), v_role, 'Confirmed', 'confirmed', now(),
              jsonb_build_object('attending', 'yes', 'via', 'onboarding', 'at', now()), jsonb_build_object('source', 'onboarding', 'member', v_email), 960)
      returning id into v_rid;
      v_added := v_added || jsonb_build_array(jsonb_build_object('id', e.id, 'date', e.event_date, 'row', v_rid));
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('event_roster', v_rid::text, 'added', null, v_name || ': Confirmed as ' || v_role || ' on ' || coalesce(e.code, e.id::text) || ' (the onboarding)', v_email);
    else
      update public.event_roster set status = 'Confirmed', confirm_status = 'confirmed', confirmed_at = coalesce(confirmed_at, now()),
             confirm = coalesce(confirm, '{}'::jsonb) || jsonb_build_object('attending', 'yes', 'via', 'onboarding', 'at', now())
       where id = v_rid and lower(coalesce(status, '')) <> 'confirmed';
      v_already := v_already || jsonb_build_array(jsonb_build_object('id', e.id, 'date', e.event_date, 'row', v_rid));
    end if;
    v_n := v_n + 1;
    perform public.wa191_autotick(e.id);
  end loop;
  if v_n = 0 then raise exception 'Those servings are not open any more. Pick another one.'; end if;
  -- the operations team hears about it in their Requests inbox, with the message
  v_ops := public.wa191_ops_lead();
  select string_agg(to_char(x.d, 'FMDay, FMMonth FMDD'), '; ' order by x.d) into v_dates from (select distinct (j->>'date')::date as d from jsonb_array_elements(v_added || v_already) j) x;
  insert into public.dept_requests (type_key, department, title, details, status, requested_by, requested_email, source, assignee)
  values ('serving-signup', 'opsmtl', 'Serving sign-up: ' || v_name || ', ' || v_dates,
          jsonb_build_object('Servings', v_dates, 'Role', public.wa171_role_label(v_role, 'en'), 'Message', coalesce(v_msg, '(no message)'),
                             'Team', coalesce(m.department, ''), 'From', 'The onboarding: they are already Confirmed on the roster'),
          'requested', v_name, v_email, 'onboarding', v_ops->>'name')
  returning id into v_req;
  -- their onboarding step "Mandatory volunteering" ticks itself
  update public.onboarding_steps s set done = true, done_at = now(), done_by = 'the Hub'
    from public.onboardings o where o.id = s.onboarding_id and o.member_id = m.id and s.template_id = '86e1cj9hg' and not coalesce(s.done, false);
  -- step: whether they have that step and it is done now (the page says so only then)
  select exists (select 1 from public.onboarding_steps s join public.onboardings o on o.id = s.onboarding_id
                  where o.member_id = m.id and s.template_id = '86e1cj9hg' and s.done) into v_step;
  return jsonb_build_object('ok', true, 'added', v_added, 'already', v_already, 'request', v_req, 'ops', v_ops->>'name', 'dates', v_dates, 'step', coalesce(v_step, false));
end $$;
comment on function public.wa191_onb_signup(bigint[], text, text) is 'wave191p: a team member chooses servings in the onboarding: found by their email (the volunteer list, then the CRM, else a new volunteer record, one record with the CRM), Confirmed on each open serving chosen (six at most; confirm.via onboarding; role server, photographer, community_talker, cook or driver), a Request to Operations Montreal (serving-signup, assigned to the operations lead) with the dates, the role and their message, and their onboarding step Mandatory volunteering (86e1cj9hg) ticked (step: true when they have it and it is done). Logged; autotick. Team members only.';
grant execute on function public.wa191_onb_signup(bigint[], text, text) to authenticated;

/* ---------- 5. the lessons, the step and the journey: four times a year, and why ---------- */
-- Week 1, "Your time": four times a year
update public.trainings set body = replace(body::text, 'volunteer at a serving at least twice a year', 'volunteer at a serving four times a year')::jsonb, updated_at = now()
 where id = 222 and body::text like '%volunteer at a serving at least twice a year%';
-- Week 3: the chapter becomes "Why you volunteer" (photos, required, why, the servings to choose)
update public.trainings set body = jsonb_set(body, '{chapters}', (
    select jsonb_agg(case when c->>'id' = 'serve' then $j${
      "t": "Why you volunteer", "id": "serve",
      "blocks": [
        {"type": "photos", "items": [
          {"src": "https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/photos/web/2024-07-summer-team-under-the-tent.jpg", "fx": 0.5, "fy": 0.52, "alt": "Thirteen volunteers in green Welfare Avenue vests pose under the green tent in a leafy park.", "cap": "The team under the tent, summer 2024."},
          {"src": "https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/photos/web/2024-10-autumn-volunteers-plating.jpg", "fx": 0.42, "fy": 0.45, "alt": "Two volunteers in green vests plate food side by side.", "cap": "Plating together, autumn 2024."}
        ]},
        {"type": "lead", "text": "Every member volunteers at a serving **four times a year**, starting in your onboarding. It is the heart of our work, and the fastest way to understand it."},
        {"type": "callout", "tone": "warn", "t": "Required: four servings a year", "text": "Volunteering is part of every role at Welfare Avenue, whatever your team. Choose your first servings below: they count from your first week."},
        {"type": "cards", "items": [
          {"t": "Understand Welfare Avenue", "d": "You see who we serve, what a Sunday takes and why it matters. Everything else we do starts at the table.", "icon": "heart"},
          {"t": "Do your role better", "d": "Marketing, fundraising, HR or finance: what you make lands at a serving. Once you have been there, you write, plan and decide better.", "icon": "target"},
          {"t": "Meet the community", "d": "The people we serve, our volunteers and your colleagues, side by side for an afternoon.", "icon": "people"}
        ]},
        {"type": "photo", "src": "https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/photos/web/2024-07-summer-servers-at-the-table.jpg", "fx": 0.6, "fy": 0.55, "alt": "Four volunteers in green vests and gloves serve salad from foil trays along the table under the tent.", "cap": "Serving under the tent, summer 2024."},
        {"type": "h", "text": "Choose your servings"},
        {"type": "servings"},
        {"type": "list", "items": [
          "Arrive at 12:00 for the setup, dressed for the weather.",
          "The team leader briefs you on the day: you might set up, serve, hand out clothing or talk with people.",
          "Afterwards a two-minute survey comes by text: tell us how it went."
        ]}
      ]}$j$::jsonb else c end order by o)
      from jsonb_array_elements(body->'chapters') with ordinality t(c, o))), updated_at = now()
 where id = 224 and body->'chapters' @> '[{"id": "serve"}]';
update public.trainings set body = replace(replace(replace(body::text,
    '"At least twice a year"', '"Four times a year"'),
    '"At least twice a year, starting in your onboarding."', '"Four times a year, starting in your onboarding: it is how you understand our work and do your role better."'),
    'your tasks and requests in the Hub, and your first serving.', 'your tasks and requests in the Hub, and why every member volunteers four times a year.')::jsonb, updated_at = now()
 where id = 224;
update public.trainings set description = 'The teams and what each one does, how a good team meeting runs, your tasks and requests in the Hub, and why every member volunteers four times a year.', updated_at = now()
 where id = 224 and description = 'The teams and what each one does, how a good team meeting runs, your tasks and requests in the Hub, and your first serving.';
update public.onboarding_template set description = 'An 8-minute lesson: our teams, how a good team meeting runs, your tasks and requests in the Hub, and why every member volunteers four times a year (you choose your first servings in it), with a short knowledge check.' || E'\n\n' || '*This step ticks itself when you pass the knowledge check.*', updated_at = now()
 where id = 'wa167w3';
update public.onboarding_template set description = 'Volunteering at a serving is part of every role at Welfare Avenue: every member volunteers **four times a year**. It is how you come to understand our work, and it helps you do your role better.' || E'\n\n'
    || 'Choose your first servings in this week''s lesson, or on this week''s page in your onboarding: they are confirmed right away, and the operations lead gets your message.' || E'\n\n' || '*This step ticks itself when you confirm a serving.*', updated_at = now()
 where id = '86e1cj9hg';
update public.app_config set value = jsonb_set(jsonb_set(value::jsonb, '{weeks,WEEK 3,why}',
    to_jsonb('This is where you start contributing: your team, your tasks, and your first serving. Every member volunteers four times a year: it is how you understand our work and do your role better.'::text)),
    '{weeks,WEEK 3,learn,2}', to_jsonb('Choose your first servings and confirm them'::text))::text
 where key = 'onboarding_journey' and value::jsonb ? 'weeks';
$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
