-- wave212 (06/10/26): time off that works for HR, and its notice to Valex and Samson.
-- Time off access (wa212b): wa_can_timeoff() = the HR access list (wa_is_hr, unchanged) or the HR access profile in hub_roles
-- (Samson, Tuna), used by the wa_timeoff policies only (Valex: "time off disappeared"). See migration wa212b_timeoff_access.
create or replace function public.wa_can_timeoff() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.wa_is_hr()
      or exists (select 1 from hub_roles where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and profile = 'hr' and coalesce(role, '') not in ('blocked', 'viewer'))
$$;
grant execute on function public.wa_can_timeoff() to authenticated;
alter policy timeoff_hr_delete on public.wa_timeoff using (public.wa_can_timeoff());
alter policy timeoff_hr_update on public.wa_timeoff using (public.wa_can_timeoff()) with check (public.wa_can_timeoff());
alter policy timeoff_own_insert on public.wa_timeoff with check ((email = lower(coalesce(auth.jwt() ->> 'email', ''))) or public.wa_can_timeoff());
alter policy timeoff_own_read on public.wa_timeoff using ((email = lower(coalesce(auth.jwt() ->> 'email', ''))) or public.wa_can_timeoff());

alter table public.wa_timeoff add column if not exists decline_reason text;

insert into public.app_config (key, value) values ('hr_notify_emails', 'valex.sanon@welfareavenue.com,samson.jules@welfareavenue.com') on conflict (key) do nothing;
insert into public.app_config (key, value) values ('checkinout_channel', 'check-in-out-wa') on conflict (key) do nothing;

-- a new request tells Valex and Samson (hr-notify, Slack DM)
create or replace function public.wa212_timeoff_requested() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if new.status = 'requested' then
    perform public.call_edge('hr-notify', jsonb_build_object('action', 'timeoff_requested', 'id', new.id));
  end if;
  return new;
end $$;
create trigger trg_wa212_timeoff after insert on public.wa_timeoff for each row execute function public.wa212_timeoff_requested();
