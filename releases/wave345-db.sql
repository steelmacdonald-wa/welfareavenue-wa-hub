-- wave345 database part: Settings for the Montreal Volunteer Manager, an event's own automatic-messages setting,
-- who replies go to, and the Photos mark on Wrap up.

-- an event may say "nothing goes by itself" (wa297_channel already understands 'none')
alter table public.volunteer_events drop constraint if exists volunteer_events_confirm_channels_check;
alter table public.volunteer_events add constraint volunteer_events_confirm_channels_check
  check (confirm_channels is null or confirm_channels in ('text', 'email', 'both', 'none'));
alter table public.volunteer_events add column if not exists photos_in_at timestamptz;
alter table public.volunteer_events add column if not exists photos_in_by text;
comment on column public.volunteer_events.photos_in_at is 'wave345: when someone marked the photos as in the album (Wrap up, Photos).';

create or replace function public.wa345_settings_get() returns jsonb
language plpgsql stable security definer set search_path to '' as $f$
declare c jsonb;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into c from public.app_config
   where key in ('vol_servers_per_cook', 'vol_cooks_max', 'vol_pickups_max', 'mail_role_owner_from', 'mail_role_owner_ready', 'vol_reply_default',
                 'vol_auto_emails_montreal', 'vol_auto_texts_montreal', 'vol_whatsapp_community_url');
  return jsonb_build_object(
    'can', coalesce(public.is_wa_leader(), false),
    'can_auto', coalesce(public.wa297_can('montreal'), false),
    'cook_min', (select target from public.volunteer_role_guides where role = 'cook'),
    'community_leads', (select target from public.volunteer_role_guides where role = 'community_debrief'),
    'per_cook', coalesce(nullif(c->>'vol_servers_per_cook', '')::int, 2),
    'cooks_max', coalesce(nullif(c->>'vol_cooks_max', '')::int, 15),
    'pickups_max', coalesce(nullif(c->>'vol_pickups_max', '')::int, 6),
    'owner_from', coalesce(c->>'mail_role_owner_from', 'off'),
    'owner_ready', coalesce(c->>'mail_role_owner_ready', 'off') = 'on',
    'reply_default', coalesce(nullif(c->>'vol_reply_default', ''), 'sender'),
    'auto', jsonb_build_object('emails', coalesce(c->>'vol_auto_emails_montreal', 'off') = 'on', 'texts', coalesce(c->>'vol_auto_texts_montreal', 'off') = 'on'),
    'whatsapp', coalesce(c->>'vol_whatsapp_community_url', ''),
    'team', (select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'email', lower(m.email)) order by m.name), '[]'::jsonb)
               from public.team_members m where m.active and m.department = 'opsmtl' and lower(m.email) like '%@welfareavenue.com'));
end $f$;
revoke all on function public.wa345_settings_get() from public, anon;
grant execute on function public.wa345_settings_get() to authenticated, service_role;

create or replace function public.wa345_settings_save(p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $f$
declare v_who text := coalesce(auth.jwt()->>'email', 'staff'); k text; v text; o text; n int;
        v_cook int; v_max int; v_rule int; v_old text; v_new text;
        lims jsonb := '{"cook_min":[1,40],"cooks_max":[1,40],"per_cook":[0,6],"pickups_max":[0,40],"community_leads":[0,10]}'::jsonb;
        cfg jsonb := '{"cooks_max":"vol_cooks_max","per_cook":"vol_servers_per_cook","pickups_max":"vol_pickups_max"}'::jsonb;
begin
  if not coalesce(public.is_wa_leader(), false) then raise exception 'Only leads and admins change the Volunteer Manager settings.'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Nothing to save.'; end if;
  -- the numbers
  for k in select jsonb_object_keys(lims) loop
    if p ? k then
      if coalesce(p->>k, '') !~ '^\d{1,3}$' then raise exception 'That is not a whole number: %', replace(k, '_', ' '); end if;
      n := (p->>k)::int;
      if n < (lims->k->>0)::int or n > (lims->k->>1)::int then raise exception '% must be between % and %.', initcap(replace(k, '_', ' ')), lims->k->>0, lims->k->>1; end if;
    end if;
  end loop;
  v_cook := coalesce((p->>'cook_min')::int, (select target from public.volunteer_role_guides where role = 'cook'), 4);
  v_max := coalesce((p->>'cooks_max')::int, nullif((select value from public.app_config where key = 'vol_cooks_max'), '')::int, 15);
  if v_max < v_cook then raise exception 'The most cooks (%) cannot be fewer than the minimum (%).', v_max, v_cook; end if;
  for k in select jsonb_object_keys(lims) loop
    if not p ? k then continue; end if;
    v := (p->>k)::int::text;
    if k in ('cook_min', 'community_leads') then
      select target::text into o from public.volunteer_role_guides where role = case k when 'cook_min' then 'cook' else 'community_debrief' end;
      if o is distinct from v then
        update public.volunteer_role_guides set target = v::int where role = case k when 'cook_min' then 'cook' else 'community_debrief' end;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_role_guides', 'target', k, o, v, v_who);
      end if;
    else
      select value into o from public.app_config where key = cfg->>k;
      if o is distinct from v then
        insert into public.app_config (key, value) values (cfg->>k, v) on conflict (key) do update set value = excluded.value;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('app_config', cfg->>k, 'value', o, v, v_who);
      end if;
    end if;
  end loop;
  -- servers follow the cooks
  v_rule := coalesce(nullif((select value from public.app_config where key = 'vol_servers_per_cook'), '')::int, 0);
  if v_rule > 0 and (p ? 'cook_min' or p ? 'per_cook') then
    update public.volunteer_role_guides set target = v_cook * v_rule where role = 'server' and target is distinct from v_cook * v_rule;
  end if;
  -- who emails come from
  if p ? 'owner_from' then
    v := lower(coalesce(p->>'owner_from', ''));
    if v not in ('on', 'off') then raise exception 'Send from the role owner: on or off.'; end if;
    if v = 'on' and coalesce((select value from public.app_config where key = 'mail_role_owner_ready'), 'off') <> 'on' then
      raise exception 'Sending from the role owner is not available yet: it arrives with the next update to the mail sender.';
    end if;
    select value into o from public.app_config where key = 'mail_role_owner_from';
    if o is distinct from v then
      insert into public.app_config (key, value) values ('mail_role_owner_from', v) on conflict (key) do update set value = excluded.value;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('app_config', 'mail_role_owner_from', 'value', o, v, v_who);
    end if;
  end if;
  -- who replies go to
  if p ? 'reply_default' then
    v := lower(btrim(coalesce(p->>'reply_default', '')));
    if v not in ('sender', 'owner', 'volunteer')
       and not (v ~ '^[^@\s]+@welfareavenue\.com$' and exists (select 1 from public.team_members m where m.active and lower(m.email) = v)) then
      raise exception 'Replies go to: the person who pressed Send, the role owner, the ops inbox, or someone on the team.';
    end if;
    select value into o from public.app_config where key = 'vol_reply_default';
    if coalesce(o, 'sender') is distinct from v then
      insert into public.app_config (key, value) values ('vol_reply_default', v) on conflict (key) do update set value = excluded.value;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('app_config', 'vol_reply_default', 'value', o, v, v_who);
    end if;
  end if;
  -- the WhatsApp community link; the welcome emails follow
  if p ? 'whatsapp' then
    v_new := btrim(coalesce(p->>'whatsapp', ''));
    if v_new <> '' and v_new !~ '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{8,}(\?[A-Za-z0-9_=&.-]*)?$' then
      raise exception 'That does not look like a WhatsApp invite link (https://chat.whatsapp.com/...).';
    end if;
    select coalesce(value, '') into v_old from public.app_config where key = 'vol_whatsapp_community_url';
    v_old := coalesce(v_old, '');
    if v_old is distinct from v_new then
      if v_new = '' and exists (select 1 from public.crm_automations a where v_old <> '' and position(v_old in a.steps::text) > 0 and a.status = 'on') then
        raise exception 'The welcome emails use this link and are switched on. Paste the new link instead of clearing it.';
      end if;
      insert into public.app_config (key, value) values ('vol_whatsapp_community_url', v_new) on conflict (key) do update set value = excluded.value;
      if v_old <> '' and v_new <> '' then
        update public.crm_automations a set steps = replace(a.steps::text, v_old, v_new)::jsonb where position(v_old in a.steps::text) > 0;
      end if;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('app_config', 'vol_whatsapp_community_url', 'value', case when v_old = '' then null else 'a link' end, case when v_new = '' then 'cleared' else 'a new link' end, v_who);
    end if;
  end if;
  return public.wa345_settings_get();
end $f$;
revoke all on function public.wa345_settings_save(jsonb) from public, anon;
grant execute on function public.wa345_settings_save(jsonb) to authenticated, service_role;

create or replace function public.wa345_event_channels(p_event bigint, p_value text) returns jsonb
language plpgsql security definer set search_path to '' as $f$
declare v_who text := coalesce(auth.jwt()->>'email', 'staff'); v text := nullif(lower(btrim(coalesce(p_value, ''))), ''); o text; v_city text;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  if not exists (select 1 from public.volunteer_events e where e.id = p_event) then raise exception 'No such event.'; end if;
  v_city := public.wa297_city(p_event);
  if not public.wa297_can(v_city) then raise exception 'Only the team that runs % volunteers can change this.', initcap(v_city); end if;
  if v is not null and v not in ('text', 'email', 'both', 'none') then raise exception 'Choose emails, texts, both, nothing, or the % setting.', initcap(v_city); end if;
  select confirm_channels into o from public.volunteer_events where id = p_event;
  if o is distinct from v then
    update public.volunteer_events set confirm_channels = v where id = p_event;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_events', p_event::text, 'confirm_channels', coalesce(o, 'the ' || v_city || ' setting'), coalesce(v, 'the ' || v_city || ' setting') || ' (automatic messages, this event)', v_who);
  end if;
  return jsonb_build_object('value', coalesce(v, ''), 'channel', public.wa297_channel(p_event));
end $f$;
revoke all on function public.wa345_event_channels(bigint, text) from public, anon;
grant execute on function public.wa345_event_channels(bigint, text) to authenticated, service_role;

-- who a volunteer's reply reaches. Montreal follows Settings (vol_reply_default); Toronto is as before.
create or replace function public.wa345_reply_to(p_event bigint, p_role text, p_sender text default null) returns text
language plpgsql stable security definer set search_path to '' as $f$
declare s text := case when lower(coalesce(p_sender, '')) ~ '^[^@\s]+@welfareavenue\.com$' then lower(p_sender) end; o text; d text;
begin
  if p_event is null then return s; end if;
  o := public.wa297_reply_to(p_event, p_role);
  if public.wa297_city(p_event) = 'toronto' then return coalesce(s, o); end if;
  d := lower(coalesce(nullif((select value from public.app_config where key = 'vol_reply_default'), ''), 'sender'));
  return case when d = 'owner' then coalesce(o, s)
              when d = 'volunteer' then 'volunteer@welfareavenue.com'
              when d ~ '^[^@\s]+@welfareavenue\.com$' and exists (select 1 from public.team_members m where m.active and lower(m.email) = d) then d
              else coalesce(s, o) end;
end $f$;
revoke all on function public.wa345_reply_to(bigint, text, text) from public, anon;
grant execute on function public.wa345_reply_to(bigint, text, text) to authenticated, service_role;

-- Wrap up, Photos: read, or mark the photos as in the album (p_on true / false)
create or replace function public.wa346_photos(p_event bigint, p_on boolean default null) returns jsonb
language plpgsql security definer set search_path to '' as $f$
declare v_who text := lower(coalesce(auth.jwt()->>'email', 'staff')); e record;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  if p_on is not null then
    update public.volunteer_events set photos_in_at = case when p_on then now() end, photos_in_by = case when p_on then v_who end where id = p_event;
    if not found then raise exception 'No such event.'; end if;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_events', p_event::text, 'photos_in', null, case when p_on then 'the photos are in the album' else 'not in yet' end, v_who);
  end if;
  select id, photos_album_url, photos_in_at, photos_in_by into e from public.volunteer_events where id = p_event;
  if e.id is null then raise exception 'No such event.'; end if;
  return jsonb_build_object('album', nullif(btrim(coalesce(e.photos_album_url, '')), ''), 'in_at', e.photos_in_at,
    'by', case when e.photos_in_by is null then null else coalesce((select split_part(m.name, ' ', 1) from public.team_members m where lower(m.email) = e.photos_in_by limit 1), split_part(e.photos_in_by, '@', 1)) end,
    'when', case when e.photos_in_at is null then null else to_char(e.photos_in_at at time zone 'America/Toronto', 'FMMon FMDD') end,
    'people', (select coalesce(jsonb_agg(jsonb_build_object('name', r.person_name, 'role', r.role, 'status', r.status) order by r.role, r.person_name), '[]'::jsonb)
                 from public.event_roster r where r.event_id = p_event and r.role in ('photographer', 'videographer') and lower(coalesce(r.status, '')) not in ('cancelled', 'unavailable')));
end $f$;
revoke all on function public.wa346_photos(bigint, boolean) from public, anon;
grant execute on function public.wa346_photos(bigint, boolean) to authenticated, service_role;

-- the four places that write the reply address of a volunteer email now ask wa345_reply_to
do $patch$
declare d text; n text; old1 text := $o$'reply_to', public.wa297_reply_to(r.event_id, r.role)$o$; new1 text := $o$'reply_to', public.wa345_reply_to(r.event_id, r.role)$o$;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'wa340_email_drain';
  n := regexp_replace(d, 'v_reply := case when lower\(coalesce\(q\.sent_by.*?wa297_reply_to\(q\.event_id, v_role\) end;', 'v_reply := public.wa345_reply_to(q.event_id, v_role, q.sent_by);   -- wave345: Settings decides who replies reach');
  if n = d or position('wa345_reply_to(q.event_id, v_role, q.sent_by)' in n) = 0 then raise exception 'wa340_email_drain: the reply line was not found'; end if;
  execute n;
  foreach n in array array['wa297_email_copy', 'wa266_confirm_email', 'wa266f_email_drain'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = n;
    if d is null or (length(d) - length(replace(d, old1, ''))) / length(old1) <> 1 then raise exception '%: the reply line was not found once', n; end if;
    execute replace(d, old1, new1);
  end loop;
end $patch$;

insert into public.app_config (key, value) values ('vol_reply_default', 'sender') on conflict (key) do nothing;
insert into public.app_config (key, value) values ('mail_role_owner_ready', 'off') on conflict (key) do nothing;
