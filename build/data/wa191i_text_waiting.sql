-- wa191i_text_waiting (01/10/26): what "waiting for an answer" means in Conversations and on This week.
-- After wa191h copied the team's Quo app replies in, 8 of 19 conversations still showed as waiting. Three of them were a
-- "Thanks", a "No worries" and an iPhone reaction (an SMS that reads Loved "Hi Aaliya, ..."), which need no answer, and
-- the team had no way to say so short of texting back. And a question followed by an automatic text (a confirmation, an
-- itinerary) stopped counting as waiting, although no person had answered it.
-- Now a conversation waits while the volunteer has a text that no person answered: newer than the last text a person
-- sent them (a reply in the Hub, Text volunteers, or a text typed in the Quo app), not a YES, NO, STOP or START the Hub
-- handled, not already answered, and not a reaction (Loved, Liked, Laughed at, Emphasized, an emoji reaction; Disliked
-- and Questioned still wait). "No reply needed" (leaders, HR and admins) closes the open texts of one number, logged.

/* ---------- 1. a reaction is not a question ---------- */
create or replace function public.wa191_is_reaction(p_body text) returns boolean
language sql immutable set search_path to '' as $$
  select coalesce(btrim(p_body), '') ~* ('^(loved|liked|laughed at|emphasi[sz]ed|reacted \S{1,16} to|removed .{1,40}? from'
    || '|a adoré|a aimé|a ri de|a souligné|a mis en avant|a réagi \S{1,16} à|[^[:alnum:][:space:]]{1,8} to)\s*[“"«„]')
$$;
comment on function public.wa191_is_reaction(text) is 'wave191i: true when a text is a phone''s reaction to an earlier text sent as SMS (Loved “…”, Liked “…”, Laughed at “…”, Emphasized “…”, Reacted 😊 to “…”, Removed a heart from “…”, the French A adoré « … » and the like). Disliked and Questioned are not counted: they may need a person.';
revoke all on function public.wa191_is_reaction(text) from public, anon;
grant execute on function public.wa191_is_reaction(text) to authenticated;

/* ---------- 2. Conversations: who waits ---------- */
create or replace function public.wa191_recruit_inbox(p_events bigint[] default null, p_days int default 21) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  with m as (
    select right(regexp_replace(q.phone, '\D', '', 'g'), 10) ph, q.*
      from public.quo_messages q
     where q.created_at > now() - make_interval(days => greatest(coalesce(p_days, 21), 1)) and q.status <> 'dry_run' and q.kind <> 'confirm_test'
  ), ppl as (
    select m.ph, max(m.person_id) pid from m group by m.ph
  ), last_m as (
    select distinct on (m.ph) m.ph, m.direction, m.body, m.created_at, m.handled, m.kind, m.status from m order by m.ph, m.created_at desc, m.id desc
  ), agg as (
    select m.ph, count(*) n, count(*) filter (where m.direction = 'in') n_in, array_agg(distinct m.event_id) filter (where m.event_id is not null) evs,
           max(m.created_at) filter (where m.direction = 'out' and m.kind in ('manual', 'reply') and m.status in ('queued', 'sent')) person_at
      from m group by m.ph
  ), open_in as (
    -- the volunteer's texts no person answered: newer than the last text a person sent them, not handled by the Hub, not a reaction
    select m.ph, count(*) n_open, max(m.created_at) open_at
      from m join agg a on a.ph = m.ph
     where m.direction = 'in' and (a.person_at is null or m.created_at > a.person_at)
       and coalesce(m.handled, '') not in ('confirmed', 'declined', 'opted_out', 'opted_in', 'duplicate', 'ignored', 'answered', 'done')
       and not public.wa191_is_reaction(m.body)
     group by m.ph
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'ph', l.ph, 'phf', '(' || substr(l.ph, 1, 3) || ') ' || substr(l.ph, 4, 3) || '-' || substr(l.ph, 7, 4),
           'p', ppl.pid, 'n', coalesce((select vp.full_name from public.volunteer_people vp where vp.id = ppl.pid), (select cc.full_name from public.crm_contacts cc where cc.merged_into is null and exists (select 1 from unnest(cc.phones) y where public.wa171_digits(y) = l.ph) order by cc.id limit 1)),
           'at', l.created_at, 'dir', l.direction, 'last', left(l.body, 160), 'kind', l.kind, 'st', l.status, 'h', l.handled,
           'wait', case when o.n_open > 0 then true end, 'open', o.n_open, 'open_at', o.open_at,
           'cnt', a.n, 'cin', a.n_in, 'evs', to_jsonb(a.evs))) order by l.created_at desc), '[]'::jsonb)
    into v
    from last_m l join agg a on a.ph = l.ph join ppl on ppl.ph = l.ph left join open_in o on o.ph = l.ph
   where l.ph is not null and length(l.ph) = 10
     and (p_events is null or a.evs && p_events
          or exists (select 1 from public.event_roster r where r.event_id = any (p_events) and r.person_id = ppl.pid));
  return v;
end $$;
comment on function public.wa191_recruit_inbox(bigint[], int) is 'wave191e/191i: the conversations on the ops line in the last p_days days, one per phone number: the person, the last text, how many, and wait with open (how many of their texts no person answered: newer than the last text a person sent them, in the Hub or the Quo app; not a YES, NO, STOP or START the Hub handled; not answered or marked no reply needed; not a reaction). With p_events, the numbers texted about those servings or of people on their rosters. Staff only.';
revoke all on function public.wa191_recruit_inbox(bigint[], int) from public, anon;
grant execute on function public.wa191_recruit_inbox(bigint[], int) to authenticated;

/* ---------- 3. No reply needed ---------- */
create or replace function public.wa191_text_done(p_phone text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_ph text := public.wa171_digits(p_phone); v_n int; v_pid bigint; v_who text := coalesce(auth.jwt()->>'email', 'staff');
begin
  if not (coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false)) then
    raise exception 'Only leaders, HR and admins can answer volunteers.';
  end if;
  if v_ph is null then raise exception 'Which number?'; end if;
  update public.quo_messages set handled = 'done'
   where direction = 'in' and right(regexp_replace(phone, '\D', '', 'g'), 10) = v_ph
     and coalesce(handled, '') not in ('confirmed', 'declined', 'opted_out', 'opted_in', 'duplicate', 'ignored', 'answered', 'done');
  get diagnostics v_n = row_count;
  if v_n > 0 then
    select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) y where public.wa171_digits(y) = v_ph) order by vp.id limit 1;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_text', coalesce(v_pid::text, 'number ending ' || right(v_ph, 4)), 'handled', null,
            v_n || ' text' || case when v_n = 1 then '' else 's' end || ' marked no reply needed in Conversations', v_who);
  end if;
  return jsonb_build_object('done', v_n);
end $$;
comment on function public.wa191_text_done(text) is 'wave191i: "No reply needed" in Conversations: the open texts from one number (not a YES, NO, STOP or START, not answered) are marked handled done, so the conversation stops waiting. Leaders, HR and admins; logged in change_log (volunteer_text, the volunteer record or the last 4 digits).';
revoke all on function public.wa191_text_done(text) from public, anon;
grant execute on function public.wa191_text_done(text) to authenticated;
