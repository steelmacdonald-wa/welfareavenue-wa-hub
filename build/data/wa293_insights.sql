-- Welfare Avenue Hub: wave293, 07/11/26. The CRM Insights tab's one function (design "03 email history, interactions and insights" v2, 11.5 item 15;
-- 5.9). The third of three waves that bring Steel's mailbox and hub@ (info@ arrives there) since April 2020 into the CRM: wave289 scanned the
-- mail, wave292 moved it into the CRM through the Import page and wrote the summaries, and wave293 shows it (the contact page's email threads
-- and Relationship card, and the slim Insights tab at #crm/insights).
-- It adds one function, crm_insights_overview() (security invoker, signed-in users), and changes nothing live. Being security invoker, every
-- row it counts passes the reader's own row security: Steel's mailbox lines (crm_interactions source gmail, meta.mailbox steel) and summaries
-- marked from_steel count only for admins until mail_history_steel_open is true (wave292's policies, H1); partners marked leadership count only
-- for leaders; someone without the CRM page (or a board viewer) gets the empty answer.
-- It returns no email line, subject or summary: counts, dates, organisation names and the names of the people who have gone quiet (CRM staff
-- read those on the contacts list already). No "waiting on a reply" list (5.9).
-- Needs wave292 first (crm_email_relationship) and wave281 (do_not_contact): the file stops at the top without them. Safe to run twice.
-- No transaction control. Proved offline first: node test/w293sql.mjs (PGlite). Built 07/11/26, not released.
-- Undo: build/data/wa293_undo.sql. Fix round 07/11/26 (eh-293): do-not-contact people never go quiet (A-I2); the last 12 months ranked on their own (A-M1).

do $wa293$
begin
  if to_regclass('public.crm_email_relationship') is null or to_regprocedure('public.crm_mail_steel_open()') is null then
    raise exception 'wave293 needs wave292 first (crm_email_relationship or crm_mail_steel_open is missing)';
  end if;
  if not exists (select 1 from pg_attribute where attrelid = 'public.crm_contacts'::regclass and attname = 'dnc_reason' and not attisdropped) then
    raise exception 'wave293 needs wave281 first (crm_contacts.dnc_reason is missing)';
  end if;
end $wa293$;

-- ============================================================================================ 1. crm_insights_overview() (5.9)
create or replace function public.crm_insights_overview()
returns jsonb language plpgsql stable security invoker set search_path to '' as $function$
declare
  v_months int := 12;
  v_raw text;
  v_by jsonb; v_orgs jsonb; v_org_total int; v_orgs12 jsonb; v_org12_total int; v_quiet jsonb; v_quiet_total int;
begin
  if not coalesce(public.is_wa_staff(), false) or coalesce(public.wa_page_ok('crm'), true) = false then
    return jsonb_build_object('allowed', false, 'by_type_year', '[]'::jsonb, 'orgs', '[]'::jsonb, 'orgs_total', 0, 'orgs_12', '[]'::jsonb, 'orgs_12_total', 0, 'quiet', '[]'::jsonb, 'quiet_total', 0,
                              'quiet_months', v_months, 'admin', false, 'steel_open', false, 'as_of', now());
  end if;
  select c.value into v_raw from public.app_config c where c.key = 'mail_insights_quiet_months';
  if btrim(coalesce(v_raw, '')) ~ '^[0-9]{1,3}$' then v_months := least(greatest(btrim(v_raw)::int, 1), 120); end if;

  -- people who emailed with Welfare Avenue each year since 2020, by their type (none when untyped or when the reader cannot see the type row)
  select coalesce(jsonb_agg(jsonb_build_object('year', q.yr, 'type', q.t, 'people', q.n) order by q.yr, q.t), '[]'::jsonb) into v_by
    from (select extract(year from i.occurred_at at time zone 'America/Toronto')::int as yr, coalesce(r.rel_type, 'none') as t, count(distinct i.contact_id)::int as n
            from public.crm_interactions i
            join public.crm_contacts c on c.id = i.contact_id and c.merged_into is null
            left join public.crm_email_relationship r on r.contact_id = i.contact_id
           where i.source = 'gmail' and i.occurred_at >= timestamptz '2020-01-01 00:00 America/Toronto'
           group by 1, 2) q;

  -- organisations by the people who wrote and their emails, all time and the last 12 months (top 25, with how many there are)
  with o as (
    select p.id, p.name, p.relationship, p.status, p.category,
           count(distinct i.contact_id)::int as writers, count(distinct i.id)::int as emails,
           (count(distinct i.contact_id) filter (where i.occurred_at >= now() - interval '12 months'))::int as writers_12,
           (count(distinct i.id) filter (where i.occurred_at >= now() - interval '12 months'))::int as emails_12,
           max(i.occurred_at) as last_at
      from public.wa_partners p
      join public.crm_contact_orgs l on l.partner_id = p.id
      join public.crm_contacts c on c.id = l.contact_id and c.merged_into is null
      join public.crm_interactions i on i.contact_id = l.contact_id and i.source = 'gmail'
     group by p.id, p.name, p.relationship, p.status, p.category)
  select (select count(*)::int from o),
         coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'relationship', x.relationship, 'status', x.status, 'category', x.category,
                                                       'writers', x.writers, 'emails', x.emails, 'writers_12', x.writers_12, 'emails_12', x.emails_12, 'last_at', x.last_at)
                                    order by x.writers desc, x.emails desc, x.name)
                     from (select * from o order by writers desc, emails desc, name limit 25) x), '[]'::jsonb),
         -- eh-293 A-M1: the last 12 months ranked on their own (an organisation busy this year may be outside the all-time 25)
         (select count(*)::int from o where o.writers_12 > 0),
         coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'relationship', x.relationship, 'status', x.status, 'category', x.category,
                                                       'writers', x.writers, 'emails', x.emails, 'writers_12', x.writers_12, 'emails_12', x.emails_12, 'last_at', x.last_at)
                                    order by x.writers_12 desc, x.emails_12 desc, x.name)
                     from (select * from o where o.writers_12 > 0 order by writers_12 desc, emails_12 desc, name limit 25) x), '[]'::jsonb)
    into v_org_total, v_orgs, v_org12_total, v_orgs12;

  -- gone quiet: donors, partners, supporters and volunteers with some history and nothing on their timeline (any source) and no gift for
  -- mail_insights_quiet_months; never a merged contact, someone marked deceased or anyone marked do not contact (eh-293 A-I2). The 100 who went quiet most recently first.
  with k as (
    select c.id, c.full_name, c.kinds, r.rel_type,
           (select max(i.occurred_at) from public.crm_interactions i where i.contact_id = c.id) as last_int,
           (select max(d.donated_at) from public.crm_donations d where d.contact_id = c.id) as last_gift
      from public.crm_contacts c
      left join public.crm_email_relationship r on r.contact_id = c.id
     where c.merged_into is null and coalesce(c.dnc_reason, '') <> 'deceased' and not coalesce(c.do_not_contact, false)),   -- eh-293 A-I2
  q as (
    select k.id, k.full_name, k.last_int, k.last_gift, greatest(k.last_int, k.last_gift) as last_at,
           case when k.last_gift is not null or 'donor' = any(k.kinds) then 'donor'
                when 'partner' = any(k.kinds) then 'partner'
                when 'supporter' = any(k.kinds) then 'supporter'
                when 'volunteer' = any(k.kinds) then 'volunteer'
                else k.rel_type end as kind
      from k
     where k.last_int is not null or k.last_gift is not null)
  select (select count(*)::int from q where q.kind in ('donor', 'partner', 'supporter', 'volunteer') and q.last_at < now() - make_interval(months => v_months)),
         coalesce((select jsonb_agg(jsonb_build_object('contact_id', x.id, 'name', x.full_name, 'kind', x.kind, 'last_at', x.last_at,
                                                       'last_was', case when x.last_gift is not null and (x.last_int is null or x.last_gift >= x.last_int) then 'gift' else 'timeline' end)
                                    order by x.last_at desc, x.id)
                     from (select * from q where q.kind in ('donor', 'partner', 'supporter', 'volunteer') and q.last_at < now() - make_interval(months => v_months)
                            order by q.last_at desc, q.id limit 100) x), '[]'::jsonb)
    into v_quiet_total, v_quiet;

  return jsonb_build_object('allowed', true, 'by_type_year', v_by, 'orgs', v_orgs, 'orgs_total', v_org_total, 'orgs_12', v_orgs12, 'orgs_12_total', v_org12_total, 'quiet', v_quiet, 'quiet_total', v_quiet_total,
                            'quiet_months', v_months, 'admin', coalesce(public.is_wa_admin(), false), 'steel_open', coalesce(public.crm_mail_steel_open(), false), 'as_of', now());
end $function$;
revoke all on function public.crm_insights_overview() from public, anon;
grant execute on function public.crm_insights_overview() to authenticated, service_role;
comment on function public.crm_insights_overview() is 'wave293: the CRM Insights tab (#crm/insights) in one call: by_type_year (people who emailed with Welfare Avenue each year since 2020, by their email-history type, none when untyped), orgs (the 25 organisations with the most writers and emails all time, with relationship and status; orgs_total), orgs_12 (the 25 with the most in the last 12 months, ranked on their own; orgs_12_total), quiet (the 100 donors, partners, supporters and volunteers with history but nothing on their timeline and no gift for mail_insights_quiet_months, most recent first, never deceased, merged or do-not-contact people; quiet_total), quiet_months, admin, steel_open and as_of. Security invoker: the reader''s row security decides every count, so Steel''s mailbox lines count only for admins until mail_history_steel_open; someone without the CRM page gets allowed false and empty lists. No email line, subject or summary is returned. Signed-in users.';

-- ============================================================================================ 2. the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave293', 'wave293', null,
       'The email history on profiles and the Insights tab: crm_insights_overview() (security invoker) for #crm/insights; the contact page''s email threads, filters and Relationship card are page-only.', 'wave293'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave293' and field = 'wave293');
