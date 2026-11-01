-- Welfare Avenue Hub: wave266 (266e), S1, 26/10/26. Confirm by text, email or both, and an email when a text cannot go.
-- Steel's yes (relayed 26/10): "go for the texts and emails sending out as long as you use the Welfare Avenue brand templates".
-- Every confirm email goes through mail-send's branded layout with the existing templates volunteer_assigned and
-- volunteer_assigned_fr (the same call wa257_assign makes). Confirm texts keep their wording. Safe to run twice.
-- Undo: claude/build/wa266e_undo.sql

-- 1. the choice: per serving (null = the global default), the global default, the fallback switch
alter table public.volunteer_events add column if not exists confirm_channels text;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.volunteer_events'::regclass and conname = 'volunteer_events_confirm_channels_check') then
    alter table public.volunteer_events add constraint volunteer_events_confirm_channels_check check (confirm_channels is null or confirm_channels in ('text', 'email', 'both'));
  end if;
end $$;
insert into public.app_config (key, value) values ('confirm_channels_default', 'text'), ('confirm_email_fallback', 'on'), ('confirm_email_hold_hours', '2')
on conflict (key) do nothing;

-- 2. one branded confirm email for one roster row, once per serving (event_roster.detail.confirm_emailed_at)
create or replace function public.wa266_confirm_email(p_roster bigint, p_why text)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare r record; v_em jsonb; v_lang text; v_first text; v_token text; v_role text; v_day text; v_items text; v_items_t text;
begin
  select er.id, er.person_id, er.person_name, er.role, er.status, er.confirm_status, er.confirm_token, er.detail,
         e.event_date, e.start_time, e.location, e.status as e_status, e.kind
    into r from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found or r.kind <> 'service' or r.e_status in ('cancelled', 'completed') or r.event_date <= (now() at time zone 'America/Toronto')::date then return false; end if;
  if coalesce(r.detail, '{}'::jsonb) ? 'confirm_emailed_at' then return false; end if;
  if r.confirm_status is not null or lower(coalesce(r.status, '')) in ('confirmed', 'unavailable', 'cancelled') then return false; end if;
  v_em := public.wa182_roster_email(p_roster);
  if (v_em->>'contact_id') is null or coalesce(v_em->>'email', '') = '' then return false; end if;
  v_token := r.confirm_token;
  if v_token is null then
    v_token := substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 20);
    update public.event_roster set confirm_token = v_token where id = p_roster;
  end if;
  v_lang := public.wa171_lang(r.person_id);
  v_first := nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), '');
  v_role := lower(public.wa171_role_label(r.role, v_lang));
  v_day := public.wa171_date_words(r.event_date, v_lang);
  v_items := '<ul><li><strong>' || replace(replace(v_day, '&', '&amp;'), '<', '&lt;') || '</strong>, ' || v_role
          || ' (' || to_char(coalesce(r.start_time, '12:00'::time), 'HH24:MI') || ', '
          || replace(replace(coalesce(nullif(r.location, ''), 'Montreal'), '&', '&amp;'), '<', '&lt;') || ')</li></ul>';
  v_items_t := '- ' || v_day || ', ' || v_role;
  update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('confirm_emailed_at', now(), 'confirm_emailed_why', p_why) where id = p_roster;
  perform public.call_edge('mail-send', jsonb_build_object('action', 'send', 'template_key', case when v_lang = 'fr' then 'volunteer_assigned_fr' else 'volunteer_assigned' end,
    'contact_id', (v_em->>'contact_id')::bigint,
    'vars', jsonb_build_object('first_name', coalesce(v_first, ''), 'role', v_role, 'extra_html', v_items, 'extra_text', v_items_t, 'count', '1',
              'confirm_url', coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || v_token)));
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', p_roster::text, 'confirm_email', null, left(p_why, 200), '266e');
  return true;
end $function$;
revoke all on function public.wa266_confirm_email(bigint, text) from public, anon, authenticated;

-- 3. a text that cannot go: blocked by Quo, or held on credits for more than confirm_email_hold_hours
create or replace function public.wa266_confirm_fallbacks()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare x record; v_hold timestamptz; v_hours int; n_blocked int := 0; n_held int := 0; v_today date := (now() at time zone 'America/Toronto')::date;
begin
  if coalesce((select value from public.app_config where key = 'confirm_email_fallback'), 'on') <> 'on' then return jsonb_build_object('fallback', 'off'); end if;
  for x in
    select distinct q.roster_id from public.quo_messages q join public.event_roster er on er.id = q.roster_id join public.volunteer_events e on e.id = er.event_id
     where q.direction = 'out' and q.kind = 'confirm' and q.status = 'blocked' and e.event_date > v_today and not (coalesce(er.detail, '{}'::jsonb) ? 'confirm_emailed_at')
  loop
    if public.wa266_confirm_email(x.roster_id, 'the text was blocked') then n_blocked := n_blocked + 1; end if;
  end loop;
  begin v_hold := split_part((select value from public.app_config where key = 'sms_credit_hold'), ' ', 1)::timestamptz; exception when others then v_hold := null; end;
  v_hours := coalesce(nullif((select value from public.app_config where key = 'confirm_email_hold_hours'), '')::int, 2);
  if v_hold is not null and v_hold < now() - make_interval(hours => v_hours) then
    for x in
      select q.id, q.roster_id from public.quo_messages q join public.event_roster er on er.id = q.roster_id join public.volunteer_events e on e.id = er.event_id
       where q.direction = 'out' and q.kind = 'confirm' and q.status = 'queued' and e.event_date > v_today and not (coalesce(er.detail, '{}'::jsonb) ? 'confirm_emailed_at')
    loop
      if public.wa266_confirm_email(x.roster_id, 'texts paused (no Quo credits)') then
        update public.quo_messages set status = 'skipped', error = 'emailed instead: texts were paused (no Quo credits)' where id = x.id and status = 'queued';
        n_held := n_held + 1;
      end if;
    end loop;
  end if;
  return jsonb_build_object('emailed_blocked', n_blocked, 'emailed_held', n_held);
end $function$;
revoke all on function public.wa266_confirm_fallbacks() from public, anon, authenticated;

-- 4. the patcher (this migration only)
create or replace function public.wa266_patch(p_fn regprocedure, p_marker text, p_old text, p_new text)
returns text language plpgsql set search_path to '' as $f$
declare d text; n int;
begin
  d := pg_get_functiondef(p_fn);
  if position(p_marker in d) > 0 then return p_fn::text || ': already patched'; end if;
  n := (length(d) - length(replace(d, p_old, ''))) / length(p_old);
  if n <> 1 then raise exception 'wave266e: % matched % times in %', left(p_old, 60), n, p_fn::text; end if;
  execute replace(d, p_old, p_new);
  return p_fn::text || ': patched';
end $f$;
revoke all on function public.wa266_patch(regprocedure, text, text, text) from public, anon, authenticated;

-- 5. wa171_queue_confirms follows the choice, and emails a person with no phone number
create or replace function public.wa266_patch_confirms() returns void language plpgsql set search_path to '' as $f$
declare d text; pieces text[][] := array[
  array[$o$n_q int := 0; n_skip_phone int := 0;$o$, $n$n_q int := 0; n_mail int := 0; v_fb boolean; n_skip_phone int := 0;$n$],
  array[$o$v_now := now() at time zone 'America/Toronto'; v_today := v_now::date;$o$,
        $n$v_now := now() at time zone 'America/Toronto'; v_today := v_now::date;
  v_fb := coalesce((select value from public.app_config where key = 'confirm_email_fallback'), 'on') = 'on';   -- wave266e$n$],
  array[$o$select er.id, er.person_id, er.confirm_token, e.id as event_id, e.event_date$o$,
        $n$select er.id, er.person_id, er.confirm_token, e.id as event_id, e.event_date, coalesce(er.detail, '{}'::jsonb) ? 'confirm_emailed_at' as emailed,
           coalesce(nullif(e.confirm_channels, ''), (select value from public.app_config where key = 'confirm_channels_default'), 'text') as ch   -- wave266e$n$],
  array[$o$  loop
    if exists (select 1 from public.quo_messages q where q.roster_id = r.id$o$,
        $n$  loop
    -- wave266e: by email instead of, or as well as, the text; a person already emailed is not texted unless the serving says both
    if r.ch in ('email', 'both') and public.wa266_confirm_email(r.id, 'serving set to ' || r.ch) then n_mail := n_mail + 1; end if;
    if r.ch = 'email' or (r.ch = 'text' and r.emailed) then n_done := n_done + 1; continue; end if;
    if exists (select 1 from public.quo_messages q where q.roster_id = r.id$n$],
  array[$o$if v_phone is null then n_skip_phone := n_skip_phone + 1; continue; end if;$o$,
        $n$if v_phone is null then
      n_skip_phone := n_skip_phone + 1;
      if v_fb and public.wa266_confirm_email(r.id, 'no phone number') then n_mail := n_mail + 1; end if;   -- wave266e
      continue;
    end if;$n$],
  array[$o$'held_by_test_mode', n_skip_test);$o$, $n$'held_by_test_mode', n_skip_test, 'emailed', n_mail);$n$]];
  i int; n int;
begin
  d := pg_get_functiondef('public.wa171_queue_confirms(bigint,bigint[],text)'::regprocedure);
  if position('wa266_confirm_email' in d) > 0 then return; end if;
  for i in 1 .. array_length(pieces, 1) loop
    n := (length(d) - length(replace(d, pieces[i][1], ''))) / length(pieces[i][1]);
    if n <> 1 then raise exception 'wave266e: piece % of wa171_queue_confirms matched % times', i, n; end if;
    d := replace(d, pieces[i][1], pieces[i][2]);
  end loop;
  execute d;
end $f$;
select public.wa266_patch_confirms();
drop function public.wa266_patch_confirms();

-- 6. reminders and check-ins follow the choice too: a serving set to email only gets no reminder texts
select public.wa266_patch('public.wa258_queue_nudges(bigint)'::regprocedure, 'confirm_channels',
  $o$and coalesce(er.detail->>'partner', '') <> 'true' and er.confirm_token is not null$o$,
  $n$and coalesce(er.detail->>'partner', '') <> 'true' and er.confirm_token is not null
         and coalesce(nullif(e.confirm_channels, ''), (select value from public.app_config where key = 'confirm_channels_default'), 'text') <> 'email'   -- wave266e$n$);

-- 7. the tick runs the fallbacks after the alerts
select public.wa266_patch('public.wa171_sms_tick()'::regprocedure, 'wa266_confirm_fallbacks',
  $o$  begin res := res || jsonb_build_object('alerts', public.wa266_sms_alerts()); exception when others then null; end;   -- wave266$o$,
  $n$  begin res := res || jsonb_build_object('alerts', public.wa266_sms_alerts()); exception when others then null; end;   -- wave266
  begin res := res || jsonb_build_object('fallbacks', public.wa266_confirm_fallbacks()); exception when others then null; end;   -- wave266e$n$);

drop function public.wa266_patch(regprocedure, text, text, text);
