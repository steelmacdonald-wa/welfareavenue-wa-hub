-- wave234 (Steel, 14/10/26): "Community Lead position and Community Talker is the same position - please combine the 2 and
-- keep the name Community Lead"; one Community lead spot a serving, assigned by staff (not picked on the website).
-- community_talker (Community welcome) folds into community_debrief (Community lead) everywhere.

-- 1. the people's roles on file (8 volunteer records had Community welcome; none had both)
update public.volunteer_profiles
   set roles = (select coalesce(array_agg(distinct case when x = 'community_talker' then 'community_debrief' else x end), '{}') from unnest(roles) x)
 where 'community_talker' = any(roles);
update public.volunteer_applications
   set roles = (select coalesce(array_agg(distinct case when x = 'community_talker' then 'community_debrief' else x end), '{}') from unnest(roles) x)
 where 'community_talker' = any(roles);
update public.event_roster set role = 'community_debrief' where role = 'community_talker';

-- 2. from now on the old key cannot come back: anything that still sends it is filed as Community lead
create or replace function public.wa234_fold_role() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'event_roster' then
    if new.role = 'community_talker' then new.role := 'community_debrief'; end if;
  elsif new.roles is not null and 'community_talker' = any(new.roles) then
    new.roles := (select coalesce(array_agg(distinct case when x = 'community_talker' then 'community_debrief' else x end), '{}') from unnest(new.roles) x);
  end if;
  return new;
end $$;
comment on function public.wa234_fold_role() is 'wave234: Community welcome (community_talker) is Community lead (community_debrief). Before insert or update on event_roster (role), volunteer_profiles and volunteer_applications (roles): the old key is written as the new one. Trigger only.';
create or replace trigger trg_wa234_fold_role before insert or update of role on public.event_roster for each row execute function public.wa234_fold_role();
create or replace trigger trg_wa234_fold_roles before insert or update of roles on public.volunteer_profiles for each row execute function public.wa234_fold_role();
create or replace trigger trg_wa234_fold_roles before insert or update of roles on public.volunteer_applications for each row execute function public.wa234_fold_role();

-- 3. the targets and the website's sign-up roles: one Community lead a serving, staff assign it
update public.app_config set value = (value::jsonb - 'community_talker')::text, updated_at = now() where key = 'vol_role_targets';
update public.app_config set value = array_to_string(array_remove(string_to_array(replace(value, ' ', ''), ','), 'community_talker'), ','), updated_at = now() where key = 'vol_signup_roles';

-- 4. the public volunteer forms no longer offer it (EN volunteer, FR benevole)
update public.crm_forms f
   set questions = (select jsonb_agg(case when q->>'id' = 'roles' and jsonb_typeof(q->'options') = 'array'
                                          then jsonb_set(q, '{options}', coalesce((select jsonb_agg(o) from jsonb_array_elements(q->'options') o
                                                                                    where o->>'v' not in ('community_debrief', 'community_talker')), '[]'::jsonb))
                                          else q end order by n)
                      from jsonb_array_elements(f.questions) with ordinality t(q, n)),
       updated_at = now(), updated_by = 'wa234'
 where f.slug in ('volunteer', 'benevole') and f.questions::text like '%community_%';

-- 5. the functions that offered Community welcome as a choice
do $$
declare d text;
begin
  d := pg_get_functiondef('public.wa191_onb_signup'::regproc);
  if strpos(d, '''server'', ''photographer'', ''community_talker'', ''cook'', ''driver''') = 0 then raise exception 'wa191_onb_signup changed'; end if;
  execute replace(d, '''server'', ''photographer'', ''community_talker'', ''cook'', ''driver''', '''server'', ''photographer'', ''cook'', ''driver''');
  d := pg_get_functiondef('public.wa191_partner_save'::regproc);
  if strpos(d, '''dishwasher'', ''community_talker'')') = 0 then raise exception 'wa191_partner_save changed'; end if;
  execute replace(d, '''dishwasher'', ''community_talker'')', '''dishwasher'')');
  d := pg_get_functiondef('public.wa209_volunteer_roles'::regproc);
  if strpos(d, 'r := r || ''community_talker''::text;') = 0 then raise exception 'wa209_volunteer_roles changed'; end if;
  execute replace(d, 'r := r || ''community_talker''::text;', 'if not (''community_debrief'' = any(r)) then r := r || ''community_debrief''::text; end if;');
end $$;

comment on table public.volunteer_role_guides is 'Each volunteer role''s guide (what to expect, bring, arrive; links; itinerary kind; target spots a serving). wave234: community_talker (Community welcome) is retired and folded into community_debrief (Community lead); its row is kept only for history.';

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('volunteer_role', 'community_talker', 'merged', 'Community welcome', 'community_debrief (Community lead): roles on file, targets, sign-up roles, the volunteer forms, the onboarding and partner choices', 'claude (cowork) wave234');
