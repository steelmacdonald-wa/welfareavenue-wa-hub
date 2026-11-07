-- Welfare Avenue Hub: wave282, 06/11/26. Hub CRM slice 1, Phase 2: the email rule (design CRM-S1 v2, Part A.4, Phase 2 item 7).
-- For staff: newsletters and fundraising Sends can reach everyone who has not unsubscribed (Steel's rule of 5 Nov 2026). The "Fundraising without
-- consent" setting goes away, and a Send can no longer be transactional. It changes: crm_email_permission (the fundraising-exemption block becomes the
-- new rule for newsletter and fundraising; express and implied consent keep their basis text), the app_config key mail_fundraising_exemption (deleted),
-- the crm_campaigns kind check (newsletter, fundraising, volunteer). It adds crm_email_first_contact (who has never had an email from Welfare Avenue)
-- and wa282_newsletter_lists (the first newsletter's two static lists: main, and first contacts; E1, "Yes, two Sends").
-- Needs wave281 first (crm_email_permission must already refuse do-not-contact): the file stops at the top without it. crm_email_permission is changed
-- by exact replacement of an anchor in its live text (pg_get_functiondef), as wave273 and wave281 did: if the anchor is missing the whole file fails
-- rather than overwrite something that moved. The patch skips when its wave282 text is already there and every other step is guarded, so the file is
-- safe to run twice. The live text of crm_email_permission (as wave281 leaves it), the old kind check, the old setting and the old comments are in
-- build/data/wa282_undo.sql. No transaction control: the release runs it through the Supabase connector, and build/sql_rollback_test.py runs it inside
-- a block that rolls back. Proved offline first: node test/w282sql.mjs (PGlite). Built 06/11/26, not released.

do $wa282$
begin
  if to_regprocedure('public.wa_can(text)') is null
     or position($x$'do not contact'::text$x$ in pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure)) = 0 then
    raise exception 'wave282 needs wave281 first (crm_email_permission does not refuse do-not-contact yet)';
  end if;
end $wa282$;

-- ============================================================================================ 7.1 crm_email_permission: Steel's rule of 5 Nov 2026
-- The order stays: bounced and complained, do-not-contact, transactional, unsubscribed, express, the volunteer branch (unchanged), implied consent.
-- Only the fundraising-exemption block after implied consent is replaced: a newsletter or fundraising email to someone with no express and no valid
-- implied consent is now allowed, with the basis not unsubscribed (WA rule of 5 Nov 2026).
do $wa282$
declare v text; a1 text;
begin
  v := pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure);
  if position('WA rule of 5 Nov 2026' in v) = 0 then
    a1 := $x$  if p_kind = 'fundraising' then
    select value into exemption from public.app_config where key = 'mail_fundraising_exemption';
    if exemption = 'on' then
      return query select true, 'fundraising by a registered charity (CASL s.6 does not apply); no consent on file'::text, null::date, c.em::text, c.st::text; return;
    end if;
  end if;$x$;
    if length(v) - length(replace(v, a1, '')) <> length(a1) then raise exception 'wave282: a live function moved: crm_email_permission'; end if;
    v := replace(v, a1, $x$  if p_kind in ('newsletter', 'fundraising') then return query select true, 'not unsubscribed (WA rule of 5 Nov 2026)'::text, null::date, c.em::text, c.st::text; return; end if;$x$);
    execute v;
  end if;
end $wa282$;
revoke all on function public.crm_email_permission(bigint, text) from public, anon;
grant execute on function public.crm_email_permission(bigint, text) to authenticated, service_role;
comment on function public.crm_email_permission(bigint, text) is 'The CASL rule for one contact and one kind of message (wave154; the volunteer kind wave155b). transactional/test: any working address. volunteer: any working address that has not unsubscribed (Steel, 27/09/26). newsletter/fundraising (wave282, Steel''s rule of 5 Nov 2026): any working address that has not unsubscribed; the basis is express consent or implied consent (within two years of a gift or a serving) when there is one, otherwise not unsubscribed (WA rule of 5 Nov 2026). Bounced and complained get nothing; since wave281 a do-not-contact person gets nothing either, transactional included (basis do not contact).';

-- ============================================================================================ 7.2 the exemption setting goes
delete from public.app_config where key = 'mail_fundraising_exemption';

-- ============================================================================================ 7.3 a Send is never transactional
-- Live Sends on 06/11/26: 0, so no row breaks. Replaced only while the old check (which allows transactional) is there.
do $wa282$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.crm_campaigns'::regclass and conname = 'crm_campaigns_kind_check'
                    and position('transactional' in pg_get_constraintdef(oid)) = 0) then
    alter table public.crm_campaigns drop constraint if exists crm_campaigns_kind_check;
    alter table public.crm_campaigns add constraint crm_campaigns_kind_check check (kind in ('newsletter', 'fundraising', 'volunteer'));
  end if;
end $wa282$;
comment on column public.crm_campaigns.kind is 'What the messages are (a Send''s kind): newsletter, fundraising or volunteer. Since wave282 (Steel''s rule of 5 Nov 2026) all three go to anyone with a working address who has not unsubscribed and is not do-not-contact; transactional is refused, so a Send never takes the transactional path, which ignores unsubscribes. mail-send applies crm_email_permission with this kind.';

-- ============================================================================================ 7.4 first contact
-- eh-292 fix 1: the rule lives in one service-role core function; crm_email_first_contact keeps the staff gate and calls it, and the email
-- history's report (wave292) calls the same core, so the two can never drift. Later waves anchor only the core.
create or replace function public.wa282_first_contact_core(p_contact bigint)
returns boolean language plpgsql stable security definer set search_path to '' as $function$
declare v_allowed boolean; v_basis text; v_open text;
begin
  -- allowed for a newsletter only under the WA rule: no express and no valid implied consent
  select p.allowed, p.basis into v_allowed, v_basis from public.crm_email_permission(p_contact, 'newsletter') p;
  if not coalesce(v_allowed, false) or v_basis is distinct from 'not unsubscribed (WA rule of 5 Nov 2026)' then return false; end if;
  -- never had a Hub delivery
  if exists (select 1 from public.crm_email_sends s
              where s.contact_id = p_contact and s.is_test = false
                and (s.status in ('sent', 'delivered') or s.opened_at is not null or s.clicked_at is not null)) then return false; end if;
  -- no Keela newsletter opened in the last 12 months (YYYY-MM-DD; anything else counts as never opened). ISO dates compare as text.
  select c.legacy_refs -> 'keela' -> 'email_marketing' ->> 'last_opened' into v_open from public.crm_contacts c where c.id = p_contact;
  if v_open ~ '^\d{4}-\d{2}-\d{2}$' and v_open >= to_char(current_date - interval '12 months', 'YYYY-MM-DD') then return false; end if;
  return true;
end $function$;
revoke all on function public.wa282_first_contact_core(bigint) from public, anon, authenticated;
grant execute on function public.wa282_first_contact_core(bigint) to service_role;
comment on function public.wa282_first_contact_core(bigint) is 'wave282 (eh-292 fix 1): the first-contact rule itself, with no caller check: true when crm_email_permission allows a newsletter with the basis exactly not unsubscribed (WA rule of 5 Nov 2026), there is no crm_email_sends row that is not a test and was sent, delivered, opened or clicked, and no Keela newsletter was opened in the last 12 months. crm_email_first_contact (staff) and the email history''s report (the service role) both call it. The service role only.';
create or replace function public.crm_email_first_contact(p_contact bigint)
returns boolean language plpgsql stable security definer set search_path to '' as $function$
begin
  if not coalesce(public.is_wa_staff(), false) then return null; end if;
  return public.wa282_first_contact_core(p_contact);
end $function$;
revoke all on function public.crm_email_first_contact(bigint) from public, anon;
grant execute on function public.crm_email_first_contact(bigint) to authenticated, service_role;
comment on function public.crm_email_first_contact(bigint) is 'wave282: true when a person would get their first email from Welfare Avenue: crm_email_permission allows a newsletter with the basis exactly not unsubscribed (WA rule of 5 Nov 2026) (no express and no valid implied consent), they have no crm_email_sends row that is not a test and was sent, delivered, opened or clicked, and they have not opened a Keela newsletter in the last 12 months (legacy_refs keela email_marketing last_opened, read only when it is YYYY-MM-DD). Null for anyone who is not staff (is_wa_staff), the service role included; mail-send calls it as the signed-in person. The rule itself is wa282_first_contact_core (eh-292 fix 1).';

-- ============================================================================================ 7.5 the first newsletter's two lists (E1: two Sends)
create or replace function public.wa282_newsletter_lists(p_name text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_who text := public.wa_email();
  v_day text := to_char(now() at time zone 'America/Toronto', 'DD/MM/YY');
  v_main bigint[]; v_first bigint[]; v_main_id bigint; v_first_id bigint; v_allowed int;
begin
  if not (coalesce(public.is_wa_admin(), false)
          or (coalesce(public.is_wa_staff(), false)
              and exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role <> 'blocked' and r.profile in ('marketing', 'fundraising')))) then
    raise exception 'not allowed: admins and the marketing and fundraising teams build the newsletter lists';
  end if;
  if v_name = '' then raise exception 'a name is needed'; end if;
  -- one address at most once in each list, and never on both: mail-send removes repeated addresses within a Send but not across the two Sends.
  -- The address is the one mail-send would use (crm_email_permission's email), compared lower-cased and trimmed. When records share an address the
  -- lowest contact id stands for it; an address already on the main list leaves the first-contacts list.
  with p as (
    select c.id, x.allowed, x.basis, lower(btrim(x.email)) as addr
      from public.crm_contacts c
      cross join lateral public.crm_email_permission(c.id, 'newsletter') x
     where c.merged_into is null),
  f as (
    select p.id, p.addr,
           case when p.basis = 'not unsubscribed (WA rule of 5 Nov 2026)' then coalesce(public.crm_email_first_contact(p.id), false) else false end as first
      from p
     where p.allowed and coalesce(p.addr, '') <> ''),
  m as (
    select distinct on (f.addr) f.id, f.addr from f where not f.first order by f.addr, f.id),
  fc as (
    select distinct on (f.addr) f.id from f where f.first and not exists (select 1 from m where m.addr = f.addr) order by f.addr, f.id)
  select (select coalesce(array_agg(m.id order by m.id), '{}'::bigint[]) from m),
         (select coalesce(array_agg(fc.id order by fc.id), '{}'::bigint[]) from fc),
         (select count(*)::int from f)
    into v_main, v_first, v_allowed;
  insert into public.crm_lists (name, description, kind, filter, member_ids, created_by, updated_by)
  values (v_name || ': main', 'wave282: everyone who may get a newsletter except first contacts, one record per address, on ' || v_day || '. Send 1 of the two-Send newsletter.',
          'static', '{}'::jsonb, v_main, v_who, v_who)
  returning id into v_main_id;
  insert into public.crm_lists (name, description, kind, filter, member_ids, created_by, updated_by)
  values (v_name || ': first contacts', 'wave282: first contacts (crm_email_first_contact), one record per address and none already on the main list, on ' || v_day || '. Send 2, the day after Send 1.',
          'static', '{}'::jsonb, v_first, v_who, v_who)
  returning id into v_first_id;
  return jsonb_build_object('main', cardinality(v_main), 'first_contacts', cardinality(v_first),
                            'main_list_id', v_main_id, 'first_contacts_list_id', v_first_id,
                            'left_out_same_address', v_allowed - cardinality(v_main) - cardinality(v_first));
end $function$;
revoke all on function public.wa282_newsletter_lists(text) from public, anon;
grant execute on function public.wa282_newsletter_lists(text) to authenticated, service_role;
comment on function public.wa282_newsletter_lists(text) is 'wave282: builds the first Hub newsletter''s two static lists (E1, two Sends) and returns {main, first_contacts, main_list_id, first_contacts_list_id, left_out_same_address}: "<name>: main" holds the live contacts crm_email_permission allows a newsletter who are not first contacts (Send 1); "<name>: first contacts" holds the first contacts (crm_email_first_contact; Send 2, the next day). One address (lower-cased, trimmed) appears at most once in each list (the lowest contact id stands for it) and never on both: an address already on the main list leaves the first-contacts list. Admins, or a signed-in member of the marketing or fundraising profile; anyone else (the service role included) is refused.';

-- the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave282', 'wave282', null,
       'Who may be emailed: newsletters and fundraising go to anyone with a working address who has not unsubscribed (Steel''s rule of 5 Nov 2026; express and implied consent keep their basis), '
       || 'the fundraising exemption setting is gone, a Send can no longer be transactional, crm_email_first_contact and wa282_newsletter_lists added.', 'wave282'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave282' and field = 'wave282');
