-- wave291 test only: wave281's text for wa171_opted_out, so the wave291 checks can run under it as well as under today's text. Every statement below
-- is copied unchanged from build/data/wa281_rules.sql on branch crm-slice1-280-284 (at b489858, unchanged at 79a1de8): section 1.4 (the two keyword
-- indexes and wa_stopped_phones_v, with its grants and comments), the 1.4 patch of wa171_opted_out (inside the same kind of block, with the
-- variables it uses), and its grants and comment. Nothing else of wave281. Never a migration: it lives in test/ and only runs inside a block that
-- rolls back (build/sql_rollback_test.py, test/w291sql.mjs). Safe to run twice, as wave281's own file is.

-- ============================================================================================ 1.4 STOP sticks to the phone number
create index if not exists quo_messages_wa281_keyword_idx on public.quo_messages (phone, created_at) where direction = 'in' and handled in ('opted_out', 'opted_in');
create index if not exists whatsapp_messages_wa281_keyword_idx on public.whatsapp_messages (phone, created_at) where direction = 'in' and handled in ('opted_out', 'opted_in');
create or replace view public.wa_stopped_phones_v with (security_invoker = on) as
  select s.phone_digits, 'sms'::text as channel
    from (select distinct on (public.wa171_digits(q.phone)) public.wa171_digits(q.phone) as phone_digits, q.handled
            from public.quo_messages q
           where q.direction = 'in' and q.handled in ('opted_out', 'opted_in') and public.wa171_digits(q.phone) is not null
           order by public.wa171_digits(q.phone), q.created_at desc, q.id desc) s
   where s.handled = 'opted_out'
  union all
  select w.phone_digits, 'whatsapp'::text as channel
    from (select distinct on (public.wa171_digits(m.phone)) public.wa171_digits(m.phone) as phone_digits, m.handled
            from public.whatsapp_messages m
           where m.direction = 'in' and m.handled in ('opted_out', 'opted_in') and public.wa171_digits(m.phone) is not null
           order by public.wa171_digits(m.phone), m.created_at desc, m.id desc) w
   where w.handled = 'opted_out';
revoke all on table public.wa_stopped_phones_v from public, anon, authenticated;
grant select on table public.wa_stopped_phones_v to service_role;
comment on view public.wa_stopped_phones_v is 'wave281: the stopped phones: for each phone (10 digits, wa171_digits) and channel (sms: quo_messages; whatsapp: whatsapp_messages), the latest inbound keyword text (handled opted_out or opted_in) was a STOP. A STOP sticks to the number even when no contact holds it; a later START (opted_in) clears it. Service role only (wa171_digits is not granted to signed-in users): read by wa171_opted_out (security definer), quo-send (sms) and whatsapp-send (whatsapp).';
comment on column public.wa_stopped_phones_v.phone_digits is 'wave281: the phone number''s last 10 digits (wa171_digits).';
comment on column public.wa_stopped_phones_v.channel is 'wave281: sms for a STOP texted to the ops line (quo_messages), whatsapp for a STOP sent on WhatsApp (whatsapp_messages).';

-- the 1.4 patch of wa171_opted_out, as wave281 runs it (its block declares v and a1)
do $wa281$
declare v text; a1 text;
begin
  -- 1.4 wa171_opted_out: also true for a phone whose latest SMS keyword text was STOP
  v := pg_get_functiondef('public.wa171_opted_out(bigint,text)'::regprocedure);
  if position('wa_stopped_phones_v' in v) = 0 then
    a1 := $x$= public.wa171_digits(p_phone))));$x$;
    if length(v) - length(replace(v, a1, '')) <> length(a1) then raise exception 'wave281: a live function moved: wa171_opted_out'; end if;
    v := replace(v, a1, $x$= public.wa171_digits(p_phone)))) or exists (select 1 from public.wa_stopped_phones_v s where s.channel = 'sms' and s.phone_digits = public.wa171_digits(p_phone));$x$);
    execute v;
  end if;
end $wa281$;

-- the grants and the comment wave281 gives it
revoke all on function public.wa171_opted_out(bigint, text) from public, anon, authenticated;
grant execute on function public.wa171_opted_out(bigint, text) to service_role;
comment on function public.wa171_opted_out(bigint, text) is 'wave171: true when the volunteer (or anyone with that number) replied STOP or was marked no texts in the CRM (crm_contacts.sms_opt_out); since wave281 also when the number''s latest SMS keyword text was a STOP (wa_stopped_phones_v, channel sms), even if no contact holds it.';
