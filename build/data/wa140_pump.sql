-- wave140 (26/09/26): the Drive mining pump runs only during a run. drive-mine's start action turns it on; done, paused and
-- stopped turn it off (so cron is not woken every minute for nothing between runs). Only the service role may call it.
create or replace function public.drive_mine_pump(p_on boolean) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if p_on then
    if not exists (select 1 from cron.job where jobname = 'wa-drive-mine-pump') then
      perform cron.schedule('wa-drive-mine-pump', '* * * * *',
        $c$select public.call_edge('drive-mine', '{"action":"work"}'::jsonb) from generate_series(1, 6) where (select status from public.drive_mine_state where id = 1) = 'mining'$c$);
    end if;
    return 'on';
  end if;
  if exists (select 1 from cron.job where jobname = 'wa-drive-mine-pump') then
    perform cron.unschedule('wa-drive-mine-pump');
  end if;
  return 'off';
end
$$;
revoke all on function public.drive_mine_pump(boolean) from public, anon, authenticated;
grant execute on function public.drive_mine_pump(boolean) to service_role;

-- the run is done: take the pump off now
select public.drive_mine_pump(false) where (select status from public.drive_mine_state where id = 1) <> 'mining';

comment on function public.drive_mine_pump(boolean) is 'Schedules (true) or removes (false) the cron job wa-drive-mine-pump, six drive-mine workers a minute; drive-mine turns it on at start and off when a run is done, paused or stopped (wave140). Access: service role only.';
