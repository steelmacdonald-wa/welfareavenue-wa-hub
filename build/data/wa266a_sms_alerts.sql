-- Welfare Avenue Hub: wave266 (266a), S1, 26/10/26. Volunteer texts: no more silent loop, and one alert per pause.
-- Safe to run twice: every step checks live state first. Each function is patched from its LIVE definition
-- (pg_get_functiondef), and every patch must match exactly once or the whole migration stops.
-- Undo: claude/backups/26-10-26 - wave266 undo, live definitions before 266a.sql (and redeploy quo-send v17).

-- 1. quo_messages may be 'blocked' (a number Quo refuses: never sent again, never queued again)
do $$
begin
  if pg_get_constraintdef((select oid from pg_constraint where conrelid = 'public.quo_messages'::regclass and conname = 'quo_messages_status_check')) not like '%blocked%' then
    alter table public.quo_messages drop constraint quo_messages_status_check;
    alter table public.quo_messages add constraint quo_messages_status_check
      check (status = any (array['dry_run'::text, 'queued'::text, 'sent'::text, 'failed'::text, 'skipped'::text, 'received'::text, 'blocked'::text]));
  end if;
end $$;

-- 2. the patcher: replace one exact piece of a live function, once, or stop
create or replace function public.wa266_patch(p_fn regprocedure, p_marker text, p_old text, p_new text)
returns text language plpgsql set search_path to '' as $f$
declare d text; n int;
begin
  d := pg_get_functiondef(p_fn);
  if position(p_marker in d) > 0 then return p_fn::text || ': already patched'; end if;
  n := (length(d) - length(replace(d, p_old, ''))) / length(p_old);
  if n <> 1 then raise exception 'wave266: % matched % times in %', left(p_old, 60), n, p_fn::text; end if;
  execute replace(d, p_old, p_new);
  return p_fn::text || ': patched';
end $f$;
revoke all on function public.wa266_patch(regprocedure, text, text, text) from public, anon, authenticated;

-- 3. the queue functions skip a blocked text like a sent one
select public.wa266_patch('public.wa171_queue_confirms(bigint,bigint[],text)'::regprocedure, '''sent'', ''blocked''',
  $o$q.created_at > now() - interval '2 days')) and q.status in ('queued', 'sent')) then$o$,
  $n$q.created_at > now() - interval '2 days')) and q.status in ('queued', 'sent', 'blocked')) then   -- wave266: blocked is final$n$);

select public.wa266_patch('public.wa172_queue_surveys()'::regprocedure, '''sent'', ''blocked''',
  $o$q.kind = 'survey' and q.status in ('queued', 'sent'))$o$,
  $n$q.kind = 'survey' and q.status in ('queued', 'sent', 'blocked'))   -- wave266$n$);

select public.wa266_patch('public.wa258_queue_nudges(bigint)'::regprocedure, '''sent'', ''blocked''',
  $o$q.kind = k and q.status in ('queued', 'sent'))$o$,
  $n$q.kind = k and q.status in ('queued', 'sent', 'blocked'))   -- wave266$n$);

-- 4. the round notice counts a blocked text as not delivered
select public.wa266_patch('public.wa258_round_notices()'::regprocedure, '''failed'', ''blocked''',
  $o$count(*) filter (where q.status = 'failed') failed$o$,
  $n$count(*) filter (where q.status in ('failed', 'blocked')) failed$n$);
do $$
begin
  if position($m$q.kind = x.kind and q.status in ('failed', 'blocked')$m$ in pg_get_functiondef('public.wa258_round_notices()'::regprocedure)) = 0 then
    perform public.wa266_patch('public.wa258_round_notices()'::regprocedure, $m$q.kind = x.kind and q.status in ('failed', 'blocked')$m$,
      $o$q.kind = x.kind and q.status = 'failed'$o$,
      $n$q.kind = x.kind and q.status in ('failed', 'blocked')$n$);
  end if;
end $$;

-- 5. who else gets the alerts (besides app_config texts_notify)
insert into public.app_config (key, value) values ('sms_alert_also', 'steel.macdonald@welfareavenue.com') on conflict (key) do nothing;

-- 6. the alerts: once per pause (no prepaid credits), once per serving and reason (a number Quo refuses)
create or replace function public.wa266_sms_alerts(p_test_to text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_to text[]; v_hold text; v_tag text; v_title text; v_body text; v_wait int; x record; n int := 0;
begin
  v_to := array(select distinct y from unnest(public.wa258_texts_people()
            || string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'sms_alert_also'), '')), ' ', ''), ',')) y
          where y like '%@%');
  if p_test_to is not null then
    v_to := array[lower(trim(p_test_to))];
    v_hold := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') || '-test';
  else
    v_hold := nullif((select value from public.app_config where key = 'sms_credit_hold'), '');
  end if;
  if coalesce(array_length(v_to, 1), 0) = 0 then return jsonb_build_object('alerts', 0, 'reason', 'nobody to tell'); end if;

  if v_hold is not null then
    v_tag := 'texts-credits-' || split_part(v_hold, ' ', 1);
    if not exists (select 1 from public.change_log c where c.entity_type = 'sms_alert' and c.field = 'notice' and c.entity_id = v_tag) then
      select count(*) into v_wait from public.quo_messages where direction = 'out' and status = 'queued';
      v_title := case when p_test_to is not null then 'TEST: ' else '' end || 'Volunteer texts are paused: Quo has no prepaid credits';
      v_body := 'Quo refused a text because the account has no prepaid credits. ' || v_wait
             || ' texts are waiting in the queue and will go by themselves after a top-up (between 9 am and 7 pm). Nobody gets a text twice.'
             || ' Top up in Quo, and turn on auto-recharge so this does not happen again.';
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('sms_alert', v_tag, 'notice', array_to_string(v_to, ','), left(v_title || ': ' || v_body, 400), 'wave266');
      perform public.wa258_notify(v_to, v_title, v_body, '/#volunteering', v_tag);
      perform public.call_edge('quo-send', jsonb_build_object('action', 'alert', 'to', to_jsonb(v_to), 'subject', v_title, 'tag', v_tag,
        'text', v_body || E'\n\n' || 'You get this once per pause, not once per text.' || E'\n' || 'The Welfare Avenue Hub'));
      n := n + 1;
    end if;
  end if;
  if p_test_to is not null then return jsonb_build_object('alerts', n, 'test', true, 'tag', v_tag); end if;

  for x in
    select coalesce(q.event_id, 0) as event_id, case when q.error ilike '%A2P%' then 'a2p' else 'refused' end as reason, max(e.event_date) as event_date,
           string_agg(distinct coalesce(nullif(trim(er.person_name), ''), 'the number ending ' || right(q.phone, 4)), ', ') as names
      from public.quo_messages q left join public.event_roster er on er.id = q.roster_id left join public.volunteer_events e on e.id = q.event_id
     where q.direction = 'out' and q.status = 'blocked'
     group by 1, 2
  loop
    v_tag := 'texts-blocked-' || x.event_id || '-' || x.reason;
    if exists (select 1 from public.change_log c where c.entity_type = 'sms_alert' and c.field = 'notice' and c.entity_id = v_tag) then continue; end if;
    v_title := case when x.event_date is not null then 'Texts cannot reach someone on ' || to_char(x.event_date, 'Dy Mon FMDD') else 'A text could not be delivered' end;
    v_body := x.names || case when x.reason = 'a2p'
                then ': a US number, and Quo cannot text US numbers until Welfare Avenue registers for A2P.'
                else ': Quo refused the number.' end
           || ' The Hub will not try again. Please phone them.';
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('sms_alert', v_tag, 'notice', array_to_string(v_to, ','), left(v_title || ': ' || v_body, 400), 'wave266');
    perform public.wa258_notify(v_to, v_title, v_body, case when x.event_id > 0 then '/#volunteering/e/' || x.event_id else '/#volunteering' end, v_tag);
    perform public.call_edge('quo-send', jsonb_build_object('action', 'alert', 'to', to_jsonb(v_to), 'subject', v_title, 'tag', v_tag,
      'text', v_body || E'\n\n' || 'You get this once per serving and reason, not once per text.' || E'\n' || 'The Welfare Avenue Hub'));
    n := n + 1;
  end loop;
  return jsonb_build_object('alerts', n);
end $function$;
revoke all on function public.wa266_sms_alerts(text) from public, anon, authenticated;

-- 7. the quarter-hour tick runs the alerts after the round notices
select public.wa266_patch('public.wa171_sms_tick()'::regprocedure, 'wa266_sms_alerts',
  $o$  begin res := res || jsonb_build_object('notices', public.wa258_round_notices()); exception when others then null; end;$o$,
  $n$  begin res := res || jsonb_build_object('notices', public.wa258_round_notices()); exception when others then null; end;
  begin res := res || jsonb_build_object('alerts', public.wa266_sms_alerts()); exception when others then null; end;   -- wave266$n$);

-- 8. the patcher was only for this migration
drop function public.wa266_patch(regprocedure, text, text, text);
