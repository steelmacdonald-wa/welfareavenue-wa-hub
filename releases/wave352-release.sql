-- Welfare Avenue Hub, wave352 (17/11/26): no text leaves the Hub on its own.
-- Steel, 17/11/26: "zero messages going out from the hub to Quo unless clicked by a human".
-- 1. The automatic thank-you after a reply ("Thanks X, you're confirmed..." / "Thanks for letting us know...") is off.
--    Switch: app_config sms_auto_reply (off). The same switch covers WhatsApp replies.
-- 2. A reply changes someone's answer only when it is three words or fewer AND the last message they got was one of the
--    Hub's own asks (confirmation, call-out, reminder, check-in). Otherwise it waits for a person in Replies.
-- 3. New events no longer start with "send itineraries automatically" on.
-- Database only, no page change. Undo: the file beside this one.
do $rel$
declare d text; olds text[]; news text[]; i int; n int;
begin
  create table if not exists public.wa352_undo (k text primary key, v text, saved_at timestamptz default now());
  alter table public.wa352_undo enable row level security;
  revoke all on public.wa352_undo from anon, authenticated;
  grant all on public.wa352_undo to service_role;
  comment on table public.wa352_undo is 'wave352 (17/11/26): wa171_inbound and wa254_inbound as they were before wave352, for its undo. Drop after a month.';
  insert into public.wa352_undo (k, v) values
    ('wa171_inbound', pg_get_functiondef('public.wa171_inbound(jsonb)'::regprocedure)),
    ('wa254_inbound', pg_get_functiondef('public.wa254_inbound(jsonb)'::regprocedure)),
    ('itinerary_auto_default', (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_events' and column_name = 'itinerary_auto')),
    ('sms_auto_reply', (select value from public.app_config where key = 'sms_auto_reply'))
  on conflict (k) do nothing;

  -- did the last thing this person got from us come from the Hub asking, or from a person writing?
  create or replace function public.wa352_follows_ask(p_roster bigint, p_person bigint, p_phone text)
  returns boolean language sql stable security definer set search_path = '' as $f$
    select coalesce((
      select q.roster_id = p_roster and q.kind in ('confirm', 'recruit', 'reminder', 'checkin')
        from public.quo_messages q
       where q.direction = 'out' and q.status = 'sent' and q.kind <> 'ack'
         and coalesce(q.sent_at, q.created_at) > now() - interval '14 days'
         and (q.roster_id = p_roster or (p_person is not null and q.person_id = p_person)
              or (p_phone is not null and right(regexp_replace(coalesce(q.phone, ''), '\D', '', 'g'), 10) = p_phone))
       order by coalesce(q.sent_at, q.created_at) desc, q.id desc limit 1), false)
  $f$;
  revoke all on function public.wa352_follows_ask(bigint, bigint, text) from public, anon, authenticated;
  grant execute on function public.wa352_follows_ask(bigint, bigint, text) to service_role;

  insert into public.app_config (key, value) values ('sms_auto_reply', 'off') on conflict (key) do nothing;

  d := pg_get_functiondef('public.wa171_inbound(jsonb)'::regprocedure);
  if position('wave352' in d) > 0 then raise exception 'wave352 is already in wa171_inbound'; end if;
  olds := array[
    'v_reply text; v_act boolean;',
    'v_act := v_mode = ''live'' or (v_mode = ''test'' and public.wa171_test_phone(v_phone));',
    '''CONFIRME'', ''CONFIRMEE'', ''OK'', ''OKAY'') and v_row.roster_id is not null then',
    'elsif v_word in (''NO'', ''N'', ''NON'', ''NOPE'') and v_row.roster_id is not null then',
    '''NO'', ''N'', ''NON'', ''NOPE'') and v_row.roster_id is null',
    'if v_handled in (''pool_yes'', ''pool_no'') then',
    'if v_handled in (''confirmed'', ''declined'') then'
  ];
  news := array[
    'v_reply text; v_act boolean; v_short boolean; v_asked boolean; v_ack boolean;',
    'v_act := v_mode = ''live'' or (v_mode = ''test'' and public.wa171_test_phone(v_phone));
  -- wave352 (17/11/26, Steel): no thank-you text goes out on its own (sms_auto_reply, off unless someone switches it on),
  -- and a reply only counts as a yes or a no when it is three words or fewer and the last thing this person got from us
  -- was one of the Hub''s own asks, not a message a person wrote. Everything else waits for a person in Replies.
  v_ack := coalesce((select value from public.app_config where key = ''sms_auto_reply''), ''off'') = ''on'';
  v_short := coalesce(array_length(regexp_split_to_array(btrim(regexp_replace(v_text, ''[^[:alnum:]'''']+'', '' '', ''g'')), ''\s+''), 1), 0) <= 3;
  v_asked := v_row.roster_id is not null and public.wa352_follows_ask(v_row.roster_id, v_pid, v_phone);',
    '''CONFIRME'', ''CONFIRMEE'', ''OK'', ''OKAY'') and v_row.roster_id is not null and v_short and v_asked then',
    'elsif v_word in (''NO'', ''N'', ''NON'', ''NOPE'') and v_row.roster_id is not null and v_short and v_asked then',
    '''NO'', ''N'', ''NON'', ''NOPE'') and v_row.roster_id is null and v_short',
    'if v_ack and v_handled in (''pool_yes'', ''pool_no'') then',
    'if v_ack and v_handled in (''confirmed'', ''declined'') then'
  ];
  for i in 1 .. array_length(olds, 1) loop
    n := (length(d) - length(replace(d, olds[i], ''))) / length(olds[i]);
    if n <> 1 then raise exception 'wave352: edit % of wa171_inbound matches % times, nothing changed', i, n; end if;
    d := replace(d, olds[i], news[i]);
  end loop;
  execute d;

  d := pg_get_functiondef('public.wa254_inbound(jsonb)'::regprocedure);
  olds := array[
    'if v_handled in (''confirmed'', ''declined'', ''pool_yes'', ''pool_no'') then'
  ];
  news := array[
    'if coalesce((select value from public.app_config where key = ''sms_auto_reply''), ''off'') = ''on'' and v_handled in (''confirmed'', ''declined'', ''pool_yes'', ''pool_no'') then   -- wave352'
  ];
  for i in 1 .. array_length(olds, 1) loop
    n := (length(d) - length(replace(d, olds[i], ''))) / length(olds[i]);
    if n <> 1 then raise exception 'wave352: edit % of wa254_inbound matches % times, nothing changed', i, n; end if;
    d := replace(d, olds[i], news[i]);
  end loop;
  execute d;

  alter table public.volunteer_events alter column itinerary_auto set default false;

  -- nothing may be left waiting to go
  update public.quo_messages set status = 'skipped', error = 'wave352: automatic replies are off' where direction = 'out' and kind = 'ack' and status = 'queued';

  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'texts', 'wave352', 'automatic thank-you replies on', 'no text leaves the Hub on its own: thank-you replies off (sms_auto_reply), a reply counts as an answer only after a Hub ask and in three words or fewer, new events start with automatic itineraries off', 'wave352');
end $rel$;
