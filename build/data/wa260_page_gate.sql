-- wave260 (16/10/26): train to unlock, and the Executive dashboard for the admins (Steel's decisions, 16/10/26).
-- Applied as migration wa260_page_gate. The page side is build/src/260_wave260.seg.

-- 1. the settings (app_config; only admins change them, through wa260_gate_set or the guard below)
insert into public.app_config (key, value, updated_at) values
  ('dashboard_people', '["shima.butera@welfareavenue.com"]', now()),
  ('page_gate', 'on', now()),
  ('page_gate_exempt', '[]', now()),
  ('page_gate_map', '{"overview":"overview","dashboard":"dashboard","team":"team","opsmtl":"team","progdev":"team","opsto":"team","marketing":"team","fundraising":"team","hr":"team","board":"team","requests":"requests","calendar":"calendar","brain":"brain","transcripts":"transcripts","agendas":"agendas","hubmail":"hubmail","orgchart":"orgchart","volunteering":"volunteering","hrcentre":"hrcentre","finances":"finances","contentcal":"contentcal","socialstats":"socialstats","create":"create","importantinfo":"importantinfo","photos":"photos","activity":"activity","adminpanel":"adminpanel","fundevents":"fundevents","governance":"governance","committees":"committees","bank":"bank","ourstory":"ourstory","partners":"partners","documents":"documents","crm":"crm","fund":"fund","grants":"grants","studio":"contentstudio","orggoals":"orggoals","projects":"projects","goalmap":"goalmap","projectpage":"project"}', now())
on conflict (key) do nothing;

-- 2. the guard: the four keys are admin-only, like mail_*, receipt_*, donate_*, loom_*, sms_* and cert_*
create or replace function public.wa_app_config_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%' or k like 'loom\_%' or k like 'sms\_%' or k like 'cert\_%'
      or k in ('dashboard_people', 'page_gate', 'page_gate_exempt', 'page_gate_map'))
     and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt, donation page, Loom pull, text, certificate, Dashboard and page tour settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;
comment on function public.wa_app_config_guard() is 'Trigger on app_config: only admins (or the service role) change the mail_, receipt_, donate_, loom_, sms_ and cert_ settings and, since wave260, dashboard_people, page_gate, page_gate_exempt and page_gate_map. Other staff keep their existing app_config rights.';

-- 3. admins change the gate's settings through one checked function (logged)
create or replace function public.wa260_gate_set(p_key text, p_value jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v text; old_v text; arr jsonb;
begin
  if not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change who opens the Dashboard and the page tour lock.';
  end if;
  if p_key = 'page_gate' then
    if jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') not in ('on', 'off') then raise exception 'page_gate is on or off.'; end if;
    v := p_value #>> '{}';
  elsif p_key in ('page_gate_exempt', 'dashboard_people') then
    if jsonb_typeof(p_value) <> 'array' then raise exception '% is a list of email addresses.', p_key; end if;
    select coalesce(jsonb_agg(distinct lower(trim(x))), '[]'::jsonb) into arr
      from jsonb_array_elements_text(p_value) x where trim(x) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';
    v := arr::text;
  else
    raise exception 'Unknown setting %.', p_key;
  end if;
  select value into old_v from public.app_config where key = p_key;
  insert into public.app_config (key, value, updated_at) values (p_key, v, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('app_config', p_key, 'value', old_v, v, coalesce(nullif(public.wa_email(), ''), 'admin'));
  return jsonb_build_object('key', p_key, 'value', v);
end $function$;
comment on function public.wa260_gate_set(text, jsonb) is 'wave260: Admin, Page tours. Admins set page_gate (on or off), page_gate_exempt (emails let through every page tour lock) and dashboard_people (emails that open the Executive dashboard besides the admins). Checks is_wa_admin() inside; writes app_config and a change_log line. Called by the Hub (authenticated).';

-- 4. who has taken which page tour (Admin, Page tours; and the count before the release)
create or replace function public.wa260_page_tours()
 returns table (email text, name text, role text, profile text, tour_key text, tour_title text, minutes integer, can_open boolean, done boolean, exempt boolean)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
  if not coalesce(public.is_wa_admin(), false) and coalesce(auth.role(), '') = 'authenticated' then
    raise exception 'Only an admin can see everyone''s page tours.';
  end if;
  return query
  with cfg as (
    select coalesce((select a.value::jsonb from public.app_config a where a.key = 'page_gate_map'), '{}'::jsonb) as m,
           coalesce((select a.value::jsonb from public.app_config a where a.key = 'dashboard_people'), '[]'::jsonb) as dash,
           coalesce((select a.value::jsonb from public.app_config a where a.key = 'page_gate_exempt'), '[]'::jsonb) as ex
  ), pages as (
    select e.key as page, e.value as tkey from cfg, jsonb_each_text(cfg.m) e
  ), tours as (
    select t.id, substr(t.key, 6) as tkey, t.title, t.minutes from public.trainings t
    where t.key like 'tour:%' and t.active is not false
  ), ppl as (
    select r.email, coalesce(tm.name, split_part(r.email, '@', 1)) as name, r.role, r.profile, p.pages, cfg.dash, cfg.ex
    from public.hub_roles r
    cross join cfg
    left join public.team_members tm on lower(tm.email) = r.email
    left join public.hub_access_profiles p on p.key = r.profile
    where r.role in ('leader', 'member', 'viewer') and tm.active is distinct from false
  ), opens as (
    select pp.email, pg.tkey,
      bool_or(case
        when pg.page in ('overview', 'dashboard') then pp.dash ? pp.email
        when pg.page = 'importantinfo' then pp.role <> 'viewer' or (pp.pages ->> pg.page) = 'all'
        when pg.page = 'projectpage' then coalesce(pp.pages ->> 'projects', case when pp.role = 'viewer' then 'none' else 'all' end) = 'all'
        when pp.pages is null then pp.role <> 'viewer' and pg.page not in ('adminpanel', 'activity')
        when (pp.pages ->> pg.page) = 'all' then true
        when (pp.pages ->> pg.page) = 'lead' then pp.role = 'leader'
        when (pp.pages ->> pg.page) is null then pp.role <> 'viewer' and pg.page not in ('adminpanel', 'activity')
        else false end) as can_open
    from ppl pp cross join pages pg
    group by pp.email, pg.tkey
  )
  select pp.email, pp.name, pp.role, pp.profile, t.tkey, t.title, t.minutes, o.can_open,
    exists (select 1 from public.training_progress tp where tp.training_id = t.id and tp.status = 'done'
            and (lower(tp.email) = pp.email or lower(tp.person_name) = lower(pp.name))) as done,
    pp.ex ? pp.email as exempt
  from ppl pp
  join opens o on o.email = pp.email
  join tours t on t.tkey = o.tkey
  order by pp.name, t.tkey;
end $function$;
comment on function public.wa260_page_tours() is 'wave260: for Admin, Page tours: every person on hub_roles who is not an admin or blocked (team_members not inactive) against every page tour that unlocks a page (app_config page_gate_map, active trainings tour:<key>): can_open (from the access profile: all, lead for leaders, undecided pages follow the role; overview and dashboard only for dashboard_people), done (training_progress done, by email or roster name), exempt (page_gate_exempt). Admins only (checked inside); read-only.';

revoke execute on function public.wa260_gate_set(text, jsonb) from public, anon, authenticated;
grant execute on function public.wa260_gate_set(text, jsonb) to authenticated;
revoke execute on function public.wa260_page_tours() from public, anon, authenticated;
grant execute on function public.wa260_page_tours() to authenticated;

-- 5. the access profiles say what the page does: the Executive dashboard and its numbers are none for every profile but Admin
--    (the page enforces it for everyone but the admins and dashboard_people, whatever a profile says)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'access_profile', p.key, 'pages',
  jsonb_build_object('overview', p.pages -> 'overview', 'dashboard', p.pages -> 'dashboard')::text,
  '{"overview": "none", "dashboard": "none"}',
  'Claude (16/10 page gate)'
from public.hub_access_profiles p
where p.key <> 'admin' and ((p.pages ->> 'overview') is distinct from 'none' or (p.pages ->> 'dashboard') is distinct from 'none');
update public.hub_access_profiles
   set pages = pages || '{"overview": "none", "dashboard": "none"}'::jsonb
 where key <> 'admin' and ((pages ->> 'overview') is distinct from 'none' or (pages ->> 'dashboard') is distinct from 'none');

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values
  ('app_config', 'dashboard_people', 'value', null, '["shima.butera@welfareavenue.com"]', 'Claude (16/10 page gate)'),
  ('app_config', 'page_gate', 'value', null, 'on', 'Claude (16/10 page gate)'),
  ('app_config', 'page_gate_exempt', 'value', null, '[]', 'Claude (16/10 page gate)'),
  ('app_config', 'page_gate_map', 'value', null, 'page id to page tour (42 pages; Home, the Academy, people pages and Needs me are never locked)', 'Claude (16/10 page gate)');

-- 6. Hub module 1 says what the menu shows now, and what a lock means (wording only: updated_at kept)
update public.trainings
   set description = replace(replace(description,
     '- **At the top:** Home, the Avenue Academy, the Executive dashboard, Team Requests, the Calendar and The Brain.',
     '- **At the top:** Home, the Avenue Academy, Team Requests, the Calendar and The Brain (the admins also see the Executive dashboard).'),
     'You see the pages your access profile opens (Hub module 9 explains how).',
     'You see the pages your access profile opens (Hub module 9 explains how).' || chr(10) || chr(10) || 'Tip: a page with a small lock opens once you take its tour. Start the tour on the page itself (it takes a minute or three), or take it in the Avenue Academy under Page tours. Once you finish, the page stays open for you.')
 where id = 39 and description like '%the Executive dashboard, Team Requests%';
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('trainings', '39', 'description', 'At the top: ... the Executive dashboard ...', 'At the top without the Executive dashboard (admins only); a Tip on the page tour locks', 'Claude (16/10 page gate)');
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'index.html', 'wave260', '<old md5>', '<new md5>: wave260 train to unlock (every page with a tour is locked until its tour is done, admins aside; Admin, Page tours) and the Executive dashboard for the admins and Shima', 'Claude (16/10 page gate)');
