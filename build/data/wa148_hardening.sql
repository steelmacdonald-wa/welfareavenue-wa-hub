-- wave148 (the review of waves 143 to 147): the board pack's file pointers are the Hub's to write. A leader who can edit a
-- board meeting cannot point the pack at another Drive file (the function also checks every file is its own, in the Board
-- of Directors drive, before writing).
create or replace function public.wa_board_pack_guard() returns trigger
language plpgsql set search_path to '' as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then return new; end if;
  if tg_op = 'INSERT' then new.pack := null; return new; end if;
  new.pack := old.pack;
  return new;
end $$;
drop trigger if exists trg_board_pack_guard on public.board_meetings;
create trigger trg_board_pack_guard before insert or update on public.board_meetings for each row execute function public.wa_board_pack_guard();
comment on function public.wa_board_pack_guard() is 'Keeps board_meetings.pack for the board-pack function (service role): anyone else''s insert or update leaves it as it was.';

-- the forms sync takes a lease so the six-hourly run and Sync now never file the same answers twice at once
create table if not exists public.forms_flow_lease (id int primary key default 1 check (id = 1), locked_until timestamptz not null default 'epoch', holder text);
insert into public.forms_flow_lease (id) values (1) on conflict (id) do nothing;
alter table public.forms_flow_lease enable row level security;
revoke all on public.forms_flow_lease from anon, authenticated;
create or replace function public.forms_flow_lease(p_seconds int, p_holder text) returns boolean
language sql security definer set search_path to '' as $$
  update public.forms_flow_lease set locked_until = now() + make_interval(secs => greatest(10, least(p_seconds, 600))), holder = p_holder
   where id = 1 and locked_until < now()
  returning true;
$$;
create or replace function public.forms_flow_release(p_holder text) returns void
language sql security definer set search_path to '' as $$
  update public.forms_flow_lease set locked_until = 'epoch' where id = 1 and holder = p_holder;
$$;
revoke execute on function public.forms_flow_lease(int, text), public.forms_flow_release(text) from public, anon, authenticated;
grant execute on function public.forms_flow_lease(int, text), public.forms_flow_release(text) to service_role;
comment on table public.forms_flow_lease is 'One row: while locked_until is in the future a forms-flow run is filing answers, and another run waits for the next turn.';
