-- wave256 (15/10/26): the Volunteer Manager's Phone page (texts and calls on the ops line in one place).
-- Steel: "The volunteer manager needs to have a page where the phone and messages can be used. Similar to the text
-- volunteers pop up. That should also be a page in itself. I'm also curious if phone calls itself can be done there."
-- Quo's API reads calls but cannot place one: the Hub's Call buttons open the Quo app (tel:), and quo-calls copies the
-- ops line's calls here every 10 minutes.

create table if not exists public.quo_calls (
  id bigserial primary key,
  quo_id text not null unique,
  phone text,
  ph text,
  direction text not null check (direction in ('in', 'out')),
  status text,
  duration int,
  answered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  quo_user text,
  ai_handled boolean not null default false,
  summary text,
  next_steps text,
  voicemail_text text,
  voicemail_seconds int,
  has_voicemail boolean not null default false,
  handled_at timestamptz,
  handled_by text,
  synced_at timestamptz not null default now()
);
create index if not exists quo_calls_ph_idx on public.quo_calls (ph, created_at desc);
create index if not exists quo_calls_created_idx on public.quo_calls (created_at desc);
alter table public.quo_calls enable row level security;
-- no direct reads: the Hub reads calls through wa256_phone_inbox and wa256_phone_calls (summaries and voicemails only
-- for leaders, HR and admins); quo-calls writes with the service role.
revoke all on public.quo_calls from anon, authenticated;
revoke all on sequence public.quo_calls_id_seq from anon, authenticated;
comment on table public.quo_calls is 'wave256: the ops line''s calls (438) 808-7754, copied from Quo by the quo-calls edge function (cron wa-quo-calls, every 10 minutes, and Check now on the Phone page). One row per Quo call (quo_id). No direct grants: read through wa256_phone_inbox and wa256_phone_calls.';
comment on column public.quo_calls.quo_id is 'Quo''s call id (AC...).';
comment on column public.quo_calls.phone is 'The other party''s number as Quo gives it (E.164).';
comment on column public.quo_calls.ph is 'The other party''s last 10 digits, the key the Hub''s conversations use (as wa171_digits).';
comment on column public.quo_calls.direction is 'in (they called the ops line) or out (the team called them from the Quo app).';
comment on column public.quo_calls.status is 'Quo''s status: completed, missed, answered, no-answer, in-progress, voicemail...';
comment on column public.quo_calls.duration is 'Seconds, as Quo reports.';
comment on column public.quo_calls.answered_at is 'When someone picked up (null for a missed call).';
comment on column public.quo_calls.completed_at is 'When the call ended.';
comment on column public.quo_calls.created_at is 'When the call started (Quo''s createdAt).';
comment on column public.quo_calls.quo_user is 'The Quo user who answered or placed it (Quo''s US... id), when Quo says.';
comment on column public.quo_calls.ai_handled is 'Quo''s own AI agent answered it.';
comment on column public.quo_calls.summary is 'Quo''s call summary, when the plan makes one. Shown to leaders, HR and admins only.';
comment on column public.quo_calls.next_steps is 'Quo''s next steps from the summary, when given. Leaders, HR and admins only.';
comment on column public.quo_calls.voicemail_text is 'The voicemail''s transcript, when Quo has one. Leaders, HR and admins only.';
comment on column public.quo_calls.voicemail_seconds is 'The voicemail''s length in seconds.';
comment on column public.quo_calls.has_voicemail is 'They left a voicemail.';
comment on column public.quo_calls.handled_at is 'A missed call someone dealt with (No call back needed on the Phone page); a later call or text to the number also clears it.';
comment on column public.quo_calls.handled_by is 'Who marked the missed call dealt with.';
comment on column public.quo_calls.synced_at is 'When quo-calls last wrote the row.';

-- the missed calls nobody answered: incoming, never picked up, not marked dealt with, and no call or person-written text
-- to that number after it
create or replace function public.wa256_missed_open(p_ph text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.quo_calls c
   where c.ph = p_ph and c.direction = 'in' and c.answered_at is null and c.handled_at is null and not c.ai_handled
     and c.created_at > now() - interval '30 days'
     and not exists (select 1 from public.quo_calls o where o.ph = c.ph and o.direction = 'out' and o.created_at > c.created_at)
     and not exists (select 1 from public.quo_messages m where right(regexp_replace(m.phone, '\D', '', 'g'), 10) = c.ph
                       and m.direction = 'out' and m.kind in ('manual', 'reply') and m.status in ('queued', 'sent') and m.created_at > c.created_at)
$$;
comment on function public.wa256_missed_open(text) is 'wave256: how many missed calls from one number still wait for a call back (internal; used by wa256_phone_inbox).';

create or replace function public.wa256_can_text() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false)
$$;
comment on function public.wa256_can_text() is 'wave256: leaders, HR and admins (who text volunteers, read call summaries and voicemails).';

-- the Phone page's list: every number that texted, was texted, called or was called in the last p_days
create or replace function public.wa256_phone_inbox(p_days int default 60) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_texts jsonb; v_calls jsonb; v_days int := least(greatest(coalesce(p_days, 60), 1), 365);
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  v_texts := public.wa191_recruit_inbox(null, v_days);
  with c as (
    select * from public.quo_calls where ph is not null and length(ph) = 10 and created_at > now() - make_interval(days => v_days)
  ), last_c as (
    select distinct on (ph) ph, direction, status, created_at, answered_at, duration, has_voicemail from c order by ph, created_at desc, id desc
  ), agg as (
    select ph, count(*) n, count(*) filter (where direction = 'in' and answered_at is null and not ai_handled) n_missed, bool_or(has_voicemail) vm from c group by ph
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'ph', l.ph, 'phf', '(' || substr(l.ph, 1, 3) || ') ' || substr(l.ph, 4, 3) || '-' || substr(l.ph, 7, 4),
           'n', coalesce((select vp.full_name from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) y where public.wa171_digits(y) = l.ph) order by vp.id limit 1),
                         (select cc.full_name from public.crm_contacts cc where cc.merged_into is null and exists (select 1 from unnest(cc.phones) y where public.wa171_digits(y) = l.ph) order by cc.id limit 1)),
           'p', (select vp.id from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) y where public.wa171_digits(y) = l.ph) order by vp.id limit 1),
           'at', l.created_at, 'dir', l.direction, 'st', l.status, 'ans', l.answered_at is not null, 'dur', l.duration,
           'cnt', a.n, 'missed', nullif(a.n_missed, 0), 'vm', case when a.vm then true end,
           'open', nullif(public.wa256_missed_open(l.ph), 0))) order by l.created_at desc), '[]'::jsonb)
    into v_calls
    from last_c l join agg a on a.ph = l.ph;
  return jsonb_build_object('texts', coalesce(v_texts, '[]'::jsonb), 'calls', v_calls, 'can', public.wa256_can_text(),
    'synced_at', (select value from public.app_config where key = 'quo_calls_synced_at'), 'window', public.wa191_sms_window());
end $$;
comment on function public.wa256_phone_inbox(int) is 'wave256: the Phone page''s list (staff): {texts: wa191_recruit_inbox over p_days, calls: one row a number (last call, counts, missed calls still open), can (may text), synced_at, window (texts send now)}.';

-- one number's calls (staff); summaries and voicemail transcripts for leaders, HR and admins only
create or replace function public.wa256_phone_calls(p_phone text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_ph text := public.wa171_digits(p_phone); v_can boolean := public.wa256_can_text(); v jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  if v_ph is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', c.id, 'at', c.created_at, 'dir', c.direction, 'st', c.status, 'dur', c.duration, 'ans', c.answered_at is not null,
           'ai', case when c.ai_handled then true end, 'vm', case when c.has_voicemail then true end, 'vms', c.voicemail_seconds,
           'done', case when c.handled_at is not null then true end,
           'summary', case when v_can then c.summary end, 'next', case when v_can then c.next_steps end,
           'vmt', case when v_can then c.voicemail_text end)) order by c.created_at), '[]'::jsonb)
    into v
    from (select * from public.quo_calls where ph = v_ph order by created_at desc limit 50) c;
  return v;
end $$;
comment on function public.wa256_phone_calls(text) is 'wave256: one number''s last 50 calls for the Phone page''s conversation (staff; summary, next steps and voicemail transcript only for leaders, HR and admins).';

-- a missed call needs no call back
create or replace function public.wa256_call_done(p_phone text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_ph text := public.wa171_digits(p_phone); v_n int; v_who text := coalesce(auth.jwt()->>'email', 'staff');
begin
  if not public.wa256_can_text() then raise exception 'Only leaders, HR and admins can mark calls.'; end if;
  if v_ph is null then raise exception 'Which number?'; end if;
  update public.quo_calls set handled_at = now(), handled_by = v_who
   where ph = v_ph and direction = 'in' and answered_at is null and handled_at is null;
  get diagnostics v_n = row_count;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_call', v_ph, 'no_callback', null, v_n || ' missed call(s) marked dealt with', v_who);
  return v_n;
end $$;
comment on function public.wa256_call_done(text) is 'wave256: marks a number''s missed calls as needing no call back (leaders, HR and admins; change_log volunteer_call).';

-- New text: find a person by name or number (staff)
create or replace function public.wa256_phone_lookup(p_q text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := btrim(coalesce(p_q, '')); v_d text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g'); v jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  if length(v_q) < 2 then return '[]'::jsonb; end if;
  with hits as (
    select 'p' k, vp.id, vp.full_name n, vp.phones ph, vp.roles r from public.volunteer_people vp
     where vp.phones is not null and cardinality(vp.phones) > 0
       and (vp.full_name ilike '%' || v_q || '%' or (length(v_d) >= 3 and exists (select 1 from unnest(vp.phones) y where regexp_replace(y, '\D', '', 'g') like '%' || v_d || '%')))
    union all
    select 'c', cc.id, cc.full_name, cc.phones, null from public.crm_contacts cc
     where cc.merged_into is null and cc.phones is not null and cardinality(cc.phones) > 0
       and (cc.full_name ilike '%' || v_q || '%' or (length(v_d) >= 3 and exists (select 1 from unnest(cc.phones) y where regexp_replace(y, '\D', '', 'g') like '%' || v_d || '%')))
  ), flat as (
    select distinct on (public.wa171_digits(y)) h.k, h.id, h.n, public.wa171_digits(y) ph, h.r
      from hits h, unnest(h.ph) y where public.wa171_digits(y) is not null
     order by public.wa171_digits(y), h.k desc, h.id
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('k', k, 'id', id, 'n', n, 'ph', ph,
           'phf', '(' || substr(ph, 1, 3) || ') ' || substr(ph, 4, 3) || '-' || substr(ph, 7, 4), 'r', to_jsonb(r))) order by n), '[]'::jsonb)
    into v from (select * from flat order by n limit 12) f;
  return v;
end $$;
comment on function public.wa256_phone_lookup(text) is 'wave256: New text on the Phone page: volunteers and CRM contacts with a phone whose name or number matches (staff; at most 12, one row a number).';

revoke execute on function public.wa256_missed_open(text) from public, anon, authenticated;
revoke execute on function public.wa256_can_text() from public, anon, authenticated;
revoke execute on function public.wa256_phone_inbox(int) from public, anon, authenticated;
revoke execute on function public.wa256_phone_calls(text) from public, anon, authenticated;
revoke execute on function public.wa256_call_done(text) from public, anon, authenticated;
revoke execute on function public.wa256_phone_lookup(text) from public, anon, authenticated;
grant execute on function public.wa256_can_text() to authenticated;
grant execute on function public.wa256_phone_inbox(int) to authenticated;
grant execute on function public.wa256_phone_calls(text) to authenticated;
grant execute on function public.wa256_call_done(text) to authenticated;
grant execute on function public.wa256_phone_lookup(text) to authenticated;
