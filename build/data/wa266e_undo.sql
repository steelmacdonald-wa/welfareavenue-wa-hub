-- Welfare Avenue Hub: UNDO for wave266 (266e). Puts the three patched functions back as they were after 266a,
-- then removes the 266e functions, settings and column. Safe to run twice.
do $$
declare d text; i int;
  p text[][] := array[
    -- wa171_sms_tick
    array['public.wa171_sms_tick()', $n$
  begin res := res || jsonb_build_object('fallbacks', public.wa266_confirm_fallbacks()); exception when others then null; end;   -- wave266e$n$, ''],
    -- wa258_queue_nudges
    array['public.wa258_queue_nudges(bigint)', $n$
         and coalesce(nullif(e.confirm_channels, ''), (select value from public.app_config where key = 'confirm_channels_default'), 'text') <> 'email'   -- wave266e$n$, ''],
    -- wa171_queue_confirms
    array['public.wa171_queue_confirms(bigint,bigint[],text)', $n$n_q int := 0; n_mail int := 0; v_fb boolean; n_skip_phone int := 0;$n$, $o$n_q int := 0; n_skip_phone int := 0;$o$],
    array['public.wa171_queue_confirms(bigint,bigint[],text)', $n$
  v_fb := coalesce((select value from public.app_config where key = 'confirm_email_fallback'), 'on') = 'on';   -- wave266e$n$, ''],
    array['public.wa171_queue_confirms(bigint,bigint[],text)', $n$, coalesce(er.detail, '{}'::jsonb) ? 'confirm_emailed_at' as emailed,
           coalesce(nullif(e.confirm_channels, ''), (select value from public.app_config where key = 'confirm_channels_default'), 'text') as ch   -- wave266e$n$, ''],
    array['public.wa171_queue_confirms(bigint,bigint[],text)', $n$
    -- wave266e: by email instead of, or as well as, the text; a person already emailed is not texted unless the serving says both
    if r.ch in ('email', 'both') and public.wa266_confirm_email(r.id, 'serving set to ' || r.ch) then n_mail := n_mail + 1; end if;
    if r.ch = 'email' or (r.ch = 'text' and r.emailed) then n_done := n_done + 1; continue; end if;$n$, ''],
    array['public.wa171_queue_confirms(bigint,bigint[],text)', $n$if v_phone is null then
      n_skip_phone := n_skip_phone + 1;
      if v_fb and public.wa266_confirm_email(r.id, 'no phone number') then n_mail := n_mail + 1; end if;   -- wave266e
      continue;
    end if;$n$, $o$if v_phone is null then n_skip_phone := n_skip_phone + 1; continue; end if;$o$],
    array['public.wa171_queue_confirms(bigint,bigint[],text)', $n$'held_by_test_mode', n_skip_test, 'emailed', n_mail);$n$, $o$'held_by_test_mode', n_skip_test);$o$]];
begin
  for i in 1 .. array_length(p, 1) loop
    d := pg_get_functiondef(p[i][1]::regprocedure);
    if position(p[i][2] in d) > 0 then execute replace(d, p[i][2], p[i][3]); end if;
  end loop;
end $$;
drop function if exists public.wa266_confirm_fallbacks();
drop function if exists public.wa266_confirm_email(bigint, text);
delete from public.app_config where key in ('confirm_channels_default', 'confirm_email_fallback', 'confirm_email_hold_hours');
alter table public.volunteer_events drop constraint if exists volunteer_events_confirm_channels_check;
alter table public.volunteer_events drop column if exists confirm_channels;
-- event_roster.detail keeps confirm_emailed_at / confirm_emailed_why as a record of who was emailed (harmless).
