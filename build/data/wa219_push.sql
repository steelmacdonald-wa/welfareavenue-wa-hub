-- wave219 (07/10/26): Hub notifications on computers and phones (Web Push).
-- Steel: "I'm wondering if when I add the Hub website as an app on my Android phone, or if I could do that on Apple, um, and
-- even in the browser, if it can send in-app notifications on updates, I would like to do that if it's possible, especially
-- browser use for those that are using the computer, which is most right now." His choices: mentions and assigned work, and
-- announcements; each person chooses Hub notifications, Slack or both (both by default); one gentle prompt on Home per
-- device, and a switch in Settings any time (on iPhone, Add to Home Screen first).
-- This file: the devices (hub_push_subs) and their RPCs, the choice of where (wa_notify_prefs.prefs.channel, wa219_channel_set),
-- the calls to hub-push next to the existing notify calls, two new triggers (a person gives someone a new task; a new
-- announcement), and the switch app_config push_on.
-- Applied in three parts (07/10/26): wa219_push_a_table, wa219_push_b_rpcs, wa219_push_d_calls. The connector's approval
-- for statements it reads as destructive (revoke, delete, drop) did not reach Steel, so this file holds only what ran:
-- no revokes (the table's RLS allows a person to read their own rows and nothing else; wa219_push_call does nothing
-- unless a trigger calls it), and no wa219_push_drop (Turn off and Remove go through hub-push, action drop, which
-- deletes only the caller's own row).

-- ---------- the devices ----------
create table if not exists public.hub_push_subs (
  id bigint generated always as identity primary key,
  email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sent_at timestamptz,
  last_error text,
  failures int not null default 0
);
create index if not exists hub_push_subs_email on public.hub_push_subs (email);
comment on table public.hub_push_subs is 'wave219: one row per browser or installed Hub app where a person turned Hub notifications on (the Web Push subscription: endpoint, p256dh, auth). Saved by the person''s own page through wa219_push_save and removed through hub-push (drop); read by hub-push (service role) to send. The person reads their own rows; nobody else does. A device the push service no longer knows is deleted by hub-push.';
alter table public.hub_push_subs enable row level security;
create policy hub_push_subs_own_read on public.hub_push_subs for select to authenticated using (email = public.wa_email());

-- the push services the browsers use (Chrome and Edge on Android: Google; Edge on Windows: Microsoft; Firefox: Mozilla; Safari: Apple)
create or replace function public.wa219_push_host_ok(p_endpoint text)
returns boolean language sql immutable set search_path = ''
as $$ select coalesce(p_endpoint, '') ~* '^https://([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|mozaws\.net|windows\.com|apple\.com)(:[0-9]+)?/' and length(p_endpoint) <= 1000 $$;

-- turn Hub notifications on for this device (the person's own; a device someone else used moves to whoever turned it on last)
create or replace function public.wa219_push_save(p_endpoint text, p_p256dh text, p_auth text, p_device text default null)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare me text := public.wa_email(); v_id bigint;
begin
  if me = '' or not public.is_wa_staff() then raise exception 'Sign in to the Hub first.'; end if;
  if not public.wa219_push_host_ok(p_endpoint) then raise exception 'That browser''s push address is not one the Hub sends to.'; end if;
  if coalesce(length(p_p256dh), 0) not between 80 and 100 or coalesce(length(p_auth), 0) not between 16 and 30 then
    raise exception 'The device keys look wrong.';
  end if;
  insert into public.hub_push_subs as s (email, endpoint, p256dh, auth, device)
  values (me, p_endpoint, p_p256dh, p_auth, nullif(left(btrim(coalesce(p_device, '')), 80), ''))
  on conflict (endpoint) do update
     set email = excluded.email, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device,
         updated_at = now(), failures = 0, last_error = null
  returning s.id into v_id;
  return v_id;
end $$;
comment on function public.wa219_push_save(text, text, text, text) is 'wave219: the page saves this device''s Web Push subscription for the signed-in staff member (upsert by endpoint). Known push services only.';

-- where mentions and work for you reach the person: both (the default), hub (Hub notifications instead of Slack), slack
create or replace function public.wa219_channel_set(p_channel text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare me text := public.wa_email();
begin
  if me = '' or not public.is_wa_staff() then raise exception 'Sign in to the Hub first.'; end if;
  if p_channel not in ('both', 'hub', 'slack') then raise exception 'Choose both, hub or slack.'; end if;
  insert into public.wa_notify_prefs as p (email, prefs, updated_at)
  values (me, jsonb_build_object('channel', p_channel), now())
  on conflict (email) do update set prefs = coalesce(p.prefs, '{}'::jsonb) || jsonb_build_object('channel', p_channel), updated_at = now();
  return p_channel;
end $$;
comment on function public.wa219_channel_set(text) is 'wave219: the person''s choice of where mentions and work for them arrive (wa_notify_prefs.prefs.channel): both, hub or slack. notify skips the Slack DM for hub when the person has a device on; hub-push skips slack.';

-- ---------- the calls ----------
insert into public.app_config (key, value) values ('push_on', 'on') on conflict (key) do nothing;

create or replace function public.wa219_push_call(p jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if pg_trigger_depth() = 0 then return; end if;   /* only from a trigger: a direct API call does nothing */
  if coalesce((select value from public.app_config where key = 'push_on'), 'on') <> 'on' then return; end if;
  if not exists (select 1 from public.hub_push_subs) then return; end if;
  perform public.call_edge('hub-push', p);
exception when others then
  null;
end $$;
comment on function public.wa219_push_call(jsonb) is 'wave219: hands an event to hub-push (trigger secret), only from a trigger, only when app_config push_on is on and some device has Hub notifications on. Never raises.';

-- the four events notify already sends on Slack (wave89's triggers call wa_notify_call) also reach Hub notifications
create or replace function public.wa_notify_call(payload jsonb)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  begin
    perform public.call_edge('notify', payload);
  exception when others then
    null;
  end;
  if payload->>'event' in ('request_filed', 'task_reassigned', 'suggestion_accepted', 'mentioned') then
    perform public.wa219_push_call(payload);   /* wave219 */
  end if;
exception when others then
  null;
end $$;

-- an @mention anywhere in the Hub: the Slack DM (notify) and the Hub notification (hub-push)
create or replace function public.trg_hub_mention_dm()
returns trigger
language plpgsql security definer set search_path to ''
as $$
begin
  begin
    perform public.call_edge('notify', jsonb_build_object('event', 'comment_mention', 'mention_id', new.id));
  exception when others then
    null;
  end;
  perform public.wa219_push_call(jsonb_build_object('event', 'comment_mention', 'mention_id', new.id));   /* wave219 */
  return new;
exception when others then
  return new;
end $$;

-- a person makes a task for someone else (a task given by a meeting's AI or a job is not a person: no call)
create or replace function public.wa219_task_assigned()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare me text := public.wa_email();
begin
  if me <> '' and new.owner is not null and btrim(new.owner) <> '' and coalesce(new.done, false) = false then
    perform public.wa219_push_call(jsonb_build_object('event', 'task_assigned', 'task_id', new.id, 'by', me));
  end if;
  return new;
exception when others then
  return new;
end $$;
comment on function public.wa219_task_assigned() is 'wave219: a new open task with an owner, made by a signed-in person, goes to hub-push (task_assigned); hub-push skips the person who made it.';
create trigger trg_wa219_task_assigned after insert on public.dept_tasks for each row execute function public.wa219_task_assigned();

-- a new announcement reaches the people it is for (its Slack post and email are wave180's, unchanged)
create or replace function public.wa219_announce_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.wa219_push_call(jsonb_build_object('event', 'announcement', 'id', new.id));
  return new;
exception when others then
  return new;
end $$;
comment on function public.wa219_announce_push() is 'wave219: a new announcement goes to hub-push, which sends it to wa180_audience (not the poster).';
create trigger trg_wa219_announce_push after insert on public.hub_announcements for each row execute function public.wa219_announce_push();

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'wave219', 'database', null, 'Hub notifications (Web Push): hub_push_subs, wa219_push_save, wa219_channel_set, wa219_push_call next to notify''s calls (mentions, meeting mentions, tasks handed over, requests, accepted suggestions), new tasks given by a person, new announcements; app_config push_on.', 'assistant (wave219 session)');
