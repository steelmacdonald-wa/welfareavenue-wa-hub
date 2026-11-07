-- Welfare Avenue Hub: wave282 undo, 06/11/26. Reverses build/data/wa282_mail_rule.sql, in reverse order: the consent rule comes back.
-- crm_email_permission comes back exactly as wave281 leaves it (the live text of 06/11/26, read with the Supabase connector, md5 d402bc03..., with
-- wave281's do-not-contact patch applied: md5 38706b77..., checked in test/w282sql.mjs), with its grants and comment. It is put back only while the
-- wave282 text is there, so running this after the wave281 undo leaves the older function alone. Then the two new functions are dropped, the old
-- crm_campaigns kind check (which allows transactional) and its column comment come back, and mail_fundraising_exemption is re-inserted as off.
-- What stays: lists built by wa282_newsletter_lists (ordinary static lists; delete them by hand if wanted), the release line in change_log (an undo
-- line is added). Comment statements here are indented on purpose: build/gen_data_model.py reads every file in build/data, and must keep reading the
-- migration's text. No transaction control (see the migration). Safe to run twice.

-- ============================================================================================ 1. crm_email_permission back (as wave281 leaves it)
do $u282$
begin
  if position('WA rule of 5 Nov 2026' in pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure)) > 0 then
    execute $f282$CREATE OR REPLACE FUNCTION public.crm_email_permission(p_contact_id bigint, p_kind text DEFAULT 'newsletter'::text)
 RETURNS TABLE(allowed boolean, basis text, until date, email text, status text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  c record; last_gift date; last_serve date; last_act date; imp_until date; exemption text;
begin
  select x.id, coalesce(x.primary_email, x.emails[1]) as em, coalesce(x.email_status, 'unknown') as st, x.email_consent, x.consent_source, x.implied_consent_until, x.merged_into, x.volunteer_id, x.do_not_contact
    into c from public.crm_contacts x where x.id = p_contact_id;
  if c.id is null then return query select false, 'no such contact', null::date, null::text, null::text; return; end if;
  if c.merged_into is not null then return query select false, 'merged into another contact', null::date, c.em::text, c.st::text; return; end if;
  if c.em is null or c.em = '' then return query select false, 'no email address', null::date, null::text, c.st::text; return; end if;
  if c.st in ('bounced', 'complained') then return query select false, c.st::text, null::date, c.em::text, c.st::text; return; end if;
  if c.do_not_contact then return query select false, 'do not contact'::text, null::date, c.em::text, c.st::text; return; end if;
  if p_kind = 'transactional' or p_kind = 'test' then return query select true, 'transactional: a confirmation, reminder or receipt, not a commercial message'::text, null::date, c.em::text, c.st::text; return; end if;
  if c.st = 'unsubscribed' then return query select false, 'unsubscribed'::text, null::date, c.em::text, c.st::text; return; end if;
  if c.email_consent = 'express' then
    return query select true, ('express consent' || coalesce(' (' || c.consent_source || ')', ''))::text, null::date, c.em::text, c.st::text; return;
  end if;
  /* a volunteer call-out goes to everyone with a working address who has not unsubscribed (Steel, 27/09/26: "Keela's way", opted in and unknown) */
  if p_kind = 'volunteer' then
    return query select true, 'volunteer message: not unsubscribed (the team''s rule since 27/09/26)'::text, null::date, c.em::text, c.st::text; return;
  end if;
  /* implied consent (CASL s.10(13)): a gift to, or volunteering for, a registered charity within the last two years */
  select max(d.donated_at)::date into last_gift from public.crm_donations d where d.contact_id = p_contact_id;
  select max(y.d) into last_serve from (
    select e.event_date as d from public.event_roster r join public.volunteer_events e on e.id = r.event_id
      where c.volunteer_id is not null and r.person_id = c.volunteer_id and r.status = 'Confirmed' and e.status = 'completed'
    union all
    select h.event_at::date from public.crm_volunteer_history h where h.contact_id = p_contact_id and h.attended
  ) y;
  last_act := greatest(last_gift, last_serve);
  if c.email_consent = 'implied' and c.implied_consent_until is not null then
    imp_until := greatest(c.implied_consent_until, (last_act + interval '2 years')::date);
  elsif last_act is not null then
    imp_until := (last_act + interval '2 years')::date;
  end if;
  if imp_until is not null and imp_until >= current_date then
    return query select true, ('implied consent until ' || to_char(imp_until, 'DD Mon YYYY') || case when last_act = last_gift then ' (gift on ' when last_act is not null then ' (volunteered on ' else ' (' end
      || coalesce(to_char(last_act, 'DD Mon YYYY'), coalesce(c.consent_source, 'recorded by the team')) || ')')::text, imp_until, c.em::text, c.st::text;
    return;
  end if;
  if p_kind = 'fundraising' then
    select value into exemption from public.app_config where key = 'mail_fundraising_exemption';
    if exemption = 'on' then
      return query select true, 'fundraising by a registered charity (CASL s.6 does not apply); no consent on file'::text, null::date, c.em::text, c.st::text; return;
    end if;
  end if;
  return query select false, (case when imp_until is not null then 'implied consent ran out on ' || to_char(imp_until, 'DD Mon YYYY') else 'no consent recorded' end)::text, imp_until, c.em::text, c.st::text;
end $function$
$f282$;
      comment on function public.crm_email_permission(bigint, text) is 'The CASL rule for one contact and one kind of message (wave154; the volunteer kind wave155b). transactional/test: any working address. volunteer: any working address that has not unsubscribed (Steel, 27/09/26). newsletter/fundraising: express consent, or implied consent within two years of a gift or a serving; fundraising also under the exemption setting. Bounced and complained get nothing; since wave281 a do-not-contact person gets nothing either, transactional included (basis do not contact).';
  end if;
end $u282$;
revoke all on function public.crm_email_permission(bigint, text) from public, anon;
grant execute on function public.crm_email_permission(bigint, text) to authenticated, service_role;

-- ============================================================================================ 2. the two new functions
drop function if exists public.wa282_newsletter_lists(text);
drop function if exists public.crm_email_first_contact(bigint);
drop function if exists public.wa282_first_contact_core(bigint);   -- eh-292 fix 1

-- ============================================================================================ 3. the old kind check on Sends (live text, 06/11/26)
do $u282$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.crm_campaigns'::regclass and conname = 'crm_campaigns_kind_check'
                    and position('transactional' in pg_get_constraintdef(oid)) > 0) then
    alter table public.crm_campaigns drop constraint if exists crm_campaigns_kind_check;
    alter table public.crm_campaigns add constraint crm_campaigns_kind_check check ((kind = any (array['newsletter'::text, 'fundraising'::text, 'volunteer'::text, 'transactional'::text])));
  end if;
end $u282$;
  comment on column public.crm_campaigns.kind is 'What the messages are: newsletter (consent needed), fundraising (consent needed unless the exemption setting is on), volunteer (a call-out: anyone not unsubscribed, Steel 27/09/26), transactional (anyone with a working address). mail-send applies crm_email_permission with this kind.';

-- ============================================================================================ 4. the exemption setting back, off (live value on 06/11/26)
insert into public.app_config (key, value, updated_at) values ('mail_fundraising_exemption', 'off', now()) on conflict (key) do nothing;

-- the undo record (once per release)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave282', 'wave282 undo', null, 'wave282 undone: newsletters and fundraising need express or implied consent again (crm_email_permission back as wave281 left it), the fundraising exemption setting is back (off), Sends may be transactional again, crm_email_first_contact and wa282_newsletter_lists dropped.', 'wave282 undo'
 where not exists (select 1 from public.change_log u where u.entity_type = 'release' and u.entity_id = 'wave282' and u.field = 'wave282 undo'
                    and u.changed_at >= coalesce((select max(r.changed_at) from public.change_log r where r.entity_type = 'release' and r.entity_id = 'wave282' and r.field = 'wave282'), '-infinity'::timestamptz));
