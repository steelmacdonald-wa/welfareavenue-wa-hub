-- wa123_requests_inbox: the Requests redo and the team inbox (wave123). Idempotent.
-- Steel: requests go to the department's Slack channel; each department's overview
-- page gets an inbox with what came in through Requests and through the Hub inbox,
-- and Jev decides whether an email is worth pinging the team about.

-- 1. requests: who asked (email), when it is needed, priority, where it came from, the Slack post
alter table public.dept_requests
  add column if not exists requested_email text default nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''),
  add column if not exists needed_by date,
  add column if not exists priority text not null default 'normal',
  add column if not exists source text,
  add column if not exists mail_id bigint,
  add column if not exists slack jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dept_requests_priority_chk') then
    alter table public.dept_requests add constraint dept_requests_priority_chk check (priority in ('normal', 'urgent'));
  end if;
end $$;
create index if not exists dept_requests_dept_idx on public.dept_requests(department, done, created_at desc);
create index if not exists dept_requests_email_idx on public.dept_requests(requested_email);

-- backfill who asked: "Chat (first.last)", "Meeting AI (accepted by Name)", or the sign-in name
update public.dept_requests r set requested_email = lower(split_part(substring(r.requested_by from '^Chat \(([^)]+)\)'), '@', 1)) || '@welfareavenue.com'
  where r.requested_email is null and r.requested_by ~ '^Chat \([^)]+\)$';
update public.dept_requests r set requested_email = lower(u.email)
  from auth.users u
  where r.requested_email is null
    and lower(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')) =
        lower(coalesce(substring(r.requested_by from 'accepted by ([^)]+)\)'), r.requested_by));
update public.dept_requests set source = case
    when requested_by like 'Meeting AI%' then 'meeting'
    when requested_by like 'Chat (%' then 'ask'
    when type_key = 'time-off' then 'timeoff'
    else 'requests' end
  where source is null;

-- 2. request types: a channel override and how much of the request goes into Slack
alter table public.request_types
  add column if not exists channel text,
  add column if not exists channel_mode text not null default 'full';
update public.request_types set channel = 'grants' where key = 'grant-info' and channel is null;
update public.request_types set channel_mode = 'brief' where key = 'time-off';
update public.request_types set description = 'Ask HR for time off. It is recorded against your time off for the year, and HR confirms it.'
  where key = 'time-off' and description is null;

-- 3. notes on a request (the requester and the team talk on it; each note also goes into the Slack thread)
create table if not exists public.request_notes (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.dept_requests(id) on delete cascade,
  author text not null,
  email text default nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists request_notes_req_idx on public.request_notes(request_id, created_at);
alter table public.request_notes enable row level security;
drop policy if exists request_notes_read on public.request_notes;
create policy request_notes_read on public.request_notes for select to authenticated using (public.is_wa_staff());
drop policy if exists request_notes_insert on public.request_notes;
create policy request_notes_insert on public.request_notes for insert to authenticated
  with check (public.is_wa_staff() and lower(coalesce(email, '')) = public.wa_email());
drop policy if exists request_notes_delete on public.request_notes;
create policy request_notes_delete on public.request_notes for delete to authenticated
  using (lower(coalesce(email, '')) = public.wa_email() or public.is_hub_admin());
grant select, insert, delete on public.request_notes to authenticated;

-- 4. the Hub inbox rows as team inbox items: Jev's decision, the team's state, who has it, the request it became
alter table public.hub_mail
  add column if not exists notify jsonb,
  add column if not exists team_state text,
  add column if not exists team_done_by text,
  add column if not exists team_done_at timestamptz,
  add column if not exists assignee text,
  add column if not exists request_id bigint;
create index if not exists hub_mail_dept_idx on public.hub_mail(department, internal_date desc);

-- staff change only the team fields of a Hub inbox row (hub_mail stays read-only otherwise)
create or replace function public.team_inbox_mail(p_id bigint, p_state text default null, p_assignee text default null,
  p_request_id bigint default null, p_clear_assignee boolean default false, p_by text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_by text := coalesce(nullif(trim(p_by), ''), public.wa_email());
begin
  if not public.is_wa_staff() then raise exception 'staff only'; end if;
  if p_state is not null and p_state not in ('open', 'done', 'request') then raise exception 'bad state'; end if;
  if not exists (select 1 from public.hub_mail where id = p_id) then raise exception 'not found'; end if;
  update public.hub_mail set
    team_state = coalesce(p_state, team_state),
    team_done_by = case when p_state in ('done', 'request') then v_by when p_state = 'open' then null else team_done_by end,
    team_done_at = case when p_state in ('done', 'request') then now() when p_state = 'open' then null else team_done_at end,
    assignee = case when p_clear_assignee then null else coalesce(nullif(trim(p_assignee), ''), assignee) end,
    request_id = coalesce(p_request_id, request_id)
  where id = p_id;
  insert into public.change_log(entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('hub_mail', p_id::text, 'team inbox', null,
    concat_ws(', ', 'state ' || p_state, 'assigned ' || nullif(trim(p_assignee), ''), case when p_clear_assignee then 'unassigned' end, 'request ' || p_request_id::text), v_by);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.team_inbox_mail(bigint, text, text, bigint, boolean, text) from public;
grant execute on function public.team_inbox_mail(bigint, text, text, bigint, boolean, text) to authenticated;

-- 5. settings: each team's channel (tried in order), what gets posted, and how emails are handled
insert into public.hub_settings(key, value, updated_by) values ('team_inbox', $j${
  "channels": {
    "opsmtl": ["operations-mtl"],
    "progdev": ["program-development"],
    "opsto": ["toronto-operations", "general-toronto"],
    "marketing": ["social-media"],
    "fundraising": ["fundraising"],
    "hr": ["human-resources"],
    "board": ["board-of-directors"]
  },
  "post_requests": true,
  "thread_updates": true,
  "dm_requester": true,
  "email_mode": {}
}$j$::jsonb, 'wa123') on conflict (key) do nothing;

-- 6. triggers: the team-inbox function does the Slack work (asynchronously, through pg_net)
create or replace function public.trg_wa123_request_new() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  begin
    perform public.call_edge('team-inbox', jsonb_build_object('event', 'request_new', 'request_id', new.id));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_wa123_request_new on public.dept_requests;
create trigger trg_wa123_request_new after insert on public.dept_requests
  for each row execute function public.trg_wa123_request_new();

create or replace function public.trg_wa123_request_update() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if (old.status is distinct from new.status) or (old.done is distinct from new.done) or (old.assignee is distinct from new.assignee) then
    begin
      perform public.call_edge('team-inbox', jsonb_build_object('event', 'request_update', 'request_id', new.id,
        'old_status', old.status, 'new_status', new.status, 'old_done', old.done, 'new_done', new.done,
        'old_assignee', old.assignee, 'new_assignee', new.assignee, 'by', new.updated_by));
    exception when others then null;
    end;
  end if;
  return new;
end $$;
drop trigger if exists trg_wa123_request_update on public.dept_requests;
create trigger trg_wa123_request_update after update on public.dept_requests
  for each row execute function public.trg_wa123_request_update();

create or replace function public.trg_wa123_note_new() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  begin
    perform public.call_edge('team-inbox', jsonb_build_object('event', 'request_note', 'note_id', new.id));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_wa123_note_new on public.request_notes;
create trigger trg_wa123_note_new after insert on public.request_notes
  for each row execute function public.trg_wa123_note_new();

create or replace function public.trg_wa123_mail_filed() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.status = 'filed' and new.department is not null and coalesce(new.kind, '') <> 'noise'
     and coalesce(new.gmail_id, '') not like 'test-%'
     and ((old.status is distinct from 'filed') or (old.department is distinct from new.department)) then
    begin
      perform public.call_edge('team-inbox', jsonb_build_object('event', 'mail_filed', 'mail_id', new.id));
    exception when others then null;
    end;
  end if;
  return new;
end $$;
drop trigger if exists trg_wa123_mail_filed on public.hub_mail;
create trigger trg_wa123_mail_filed after update on public.hub_mail
  for each row execute function public.trg_wa123_mail_filed();
