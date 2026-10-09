-- wave225b: the Content Studio's clicks, settings, crons and access profiles (applied with the release)
create or replace function public.wa225_click(p_link bigint, p_ref text, p_device text, p_country text) returns void
language plpgsql security definer set search_path to '' as $$
begin
  /* only the go function (the service key) counts a click; a signed-out or signed-in call does nothing */
  if coalesce(auth.role(), '') <> 'service_role' then return; end if;
  insert into public.short_link_clicks (link_id, referrer_host, device, country) values (p_link, left(p_ref, 120), case when p_device in ('phone', 'computer') then p_device else null end, left(upper(p_country), 2));
  update public.short_links set clicks = clicks + 1, last_click_at = now() where id = p_link;
end $$;
comment on function public.wa225_click(bigint, text, text, text) is 'wave225: one click on a short link (the go function, with the service key): the row in short_link_clicks and the count on short_links.';

create or replace function public.studio_settings_save(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare me text := public.wa_email();
begin
  if p_key not in ('content_studio', 'link_page') then raise exception 'unknown setting'; end if;
  if not public.wa225_marketing() then raise exception 'the marketing team and admins change the Content Studio settings' using errcode = '42501'; end if;
  if jsonb_typeof(p_value) <> 'object' or length(p_value::text) > 20000 then raise exception 'bad value'; end if;
  insert into public.hub_settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), me)
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = me;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('studio_settings', p_key, 'value', null, left(p_value::text, 300), me);
  return p_value;
end $$;
comment on function public.studio_settings_save(text, jsonb) is 'wave225: save the Content Studio settings (content_studio: goals, the hashtag cap, link tracking) or the link-in-bio page (link_page); the marketing team and admins only.';
grant execute on function public.studio_settings_save(text, jsonb) to authenticated;

-- the comments inbox reads every 10 minutes; Threads logins are refreshed weekly (social-connect refresh)
select cron.schedule('wa-social-inbox', '*/10 * * * *', $c$select public.call_edge('social-inbox', '{"action":"sync","days":45}'::jsonb)$c$);
select cron.schedule('wa-social-connect-refresh', '35 9 * * 1', $c$select public.call_edge('social-connect', '{"action":"refresh"}'::jsonb)$c$);

-- the page in every access profile (Steel's choices: the marketing team, fundraising, executives and admins; other teams' leads)
update public.hub_access_profiles set pages = pages || jsonb_build_object('studio', case key
  when 'marketing' then 'all' when 'fundraising' then 'all' when 'executive' then 'all' when 'admin' then 'all' when 'board' then 'none' else 'lead' end),
  updated_by = 'wave225', updated_at = now();
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('access_profile', 'all', 'pages', null, 'studio: marketing, fundraising, executive, admin all; other teams lead; board none (wave225, the Content Studio)', 'wave225');
