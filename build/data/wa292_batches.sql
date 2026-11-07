-- Welfare Avenue Hub: wave292, 07/11/26. The email history batches and the summary pass (design "03 email history, interactions and insights" v2,
-- 11.4; 5.5 to 5.9; 6). The second of three waves that bring Steel's mailbox and hub@ (info@ arrives there) since April 2020 into the CRM. wave289
-- scanned the mail into a private holding area; this wave moves it into the CRM through wave284's Import page (stage, Compare, Apply, Undo).
-- It adds: five batch kinds (mail_optouts, mail_orgs, mail_people, mail_enrich, mail_interactions) and their writers; crm_email_relationship (the
-- type and the summary, one row per contact) and crm_email_relationship_v (counts and dates, live from crm_interactions); two restrictive policies
-- on crm_interactions (Steel's mailbox lines read by admins only until mail_history_steel_open; nobody signed in updates an email line); the
-- suppression triggers on crm_contacts (a suppressed address is born opted out; deleting a contact with email history suppresses its addresses);
-- wa_partners.domain and address; the delete-created action; crm_insight_input and crm_insight_save for the summary pass (mail-history v2).
-- It changes these live functions by exact anchor (each anchor must appear exactly once, or the file stops): wa284_write, wa284_basis,
-- wa284_new_batch, wa284_undo, wa284_unrow, wa284_set, wa284_upd, wa284_purge, crm_email_first_contact, crm_email_permission, crm_merge_contacts.
-- The undo (build/data/wa292_undo.sql) takes each insertion back out by the same exact text, so the definitions return to what they were.
-- Never kept anywhere: a body, a quoted history, a snippet or a page's text. Reports hold counts, Hub ids and organisation names only.
-- Needs wave289, wave284, wave282 and wave281 first: the file stops at the top without them. Every step is guarded, so the file is safe to run twice.
-- No transaction control. Proved offline first: node test/w292sql.mjs (PGlite). Built 07/11/26, not released.
-- Rule for Claude sessions: never query import_stage; read the batch reports and wa289_status instead.

do $wa292$
begin
  if to_regclass('public.crm_mail_scans') is null or to_regprocedure('public.wa289_match(text,text)') is null
     or to_regprocedure('public.wa284_write(bigint,boolean)') is null or to_regprocedure('public.wa_can(text)') is null
     or to_regprocedure('public.crm_email_first_contact(bigint)') is null or to_regclass('public.crm_email_suppressions') is null then
    raise exception 'wave292 needs wave289, wave284, wave282 and wave281 first (crm_mail_scans, wa289_match, wa284_write, wa_can or crm_email_first_contact is missing)';
  end if;
end $wa292$;

-- ============================================================================================ 1. email lines go with the contact (M8)
-- crm_interactions_contact_id_fkey is on delete cascade on live (checked 06/11/26 and 07/11/26). Should it ever not be, a trigger deletes the
-- contact's gmail rows before the contact goes.
create or replace function public.wa292_gmail_cleanup()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  delete from public.crm_interactions i where i.contact_id = old.id and i.source = 'gmail';
  return old;
end $function$;
comment on function public.wa292_gmail_cleanup() is 'wave292: trigger function (trg_wa292_gmail_cleanup, created only if crm_interactions_contact_id_fkey is not on delete cascade): deletes a contact''s email history lines (source gmail) before the contact is deleted. No direct execute grant.';
do $wa292$
begin
  if (select c.confdeltype from pg_constraint c where c.conname = 'crm_interactions_contact_id_fkey' and c.conrelid = 'public.crm_interactions'::regclass) is distinct from 'c' then
    drop trigger if exists trg_wa292_gmail_cleanup on public.crm_contacts;
    create trigger trg_wa292_gmail_cleanup before delete on public.crm_contacts for each row execute function public.wa292_gmail_cleanup();
  end if;
end $wa292$;

-- ============================================================================================ 2. the five mail kinds
do $wa292$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.crm_import_batches'::regclass and conname = 'crm_import_batches_kind_check'
                    and position('mail_interactions' in pg_get_constraintdef(oid)) > 0) then
    alter table public.crm_import_batches drop constraint if exists crm_import_batches_kind_check;
    alter table public.crm_import_batches add constraint crm_import_batches_kind_check check (kind in ('optouts', 'legacy_fields', 'people', 'fields', 'orgs', 'consent', 'participation',
      'form_answers', 'mail_optouts', 'mail_orgs', 'mail_people', 'mail_enrich', 'mail_interactions'));
  end if;
end $wa292$;
comment on column public.crm_import_batches.kind is 'wave284: which import: optouts, legacy_fields, people, fields, orgs, consent, participation or form_answers (the B.1 table); wave292 adds the email-history kinds mail_optouts, mail_orgs, mail_people, mail_enrich and mail_interactions (an email-history run only, applied in that order and undone in reverse).';

-- ============================================================================================ 3. organisations: domain and address (5.5)
alter table public.wa_partners add column if not exists domain text;
alter table public.wa_partners add column if not exists address text;
create unique index if not exists wa_partners_domain_uq on public.wa_partners (lower(domain)) where domain is not null;
comment on column public.wa_partners.domain is 'wave292: the organisation''s email and web domain (example.org), unique when set; the email history matches writers to organisations by it.';
comment on column public.wa_partners.address is 'wave292: the organisation''s public address as its homepage prints it (street, city, province, postal code, country), from the email history''s homepage lookup. Never a person''s address.';

-- ============================================================================================ 4. crm_email_relationship (5.9)
create or replace function public.crm_mail_steel_open()
returns boolean language sql stable security definer set search_path to '' as $function$
  select coalesce((select btrim(c.value) = 'true' from public.app_config c where c.key = 'mail_history_steel_open'), false)
$function$;
revoke all on function public.crm_mail_steel_open() from public, anon;
grant execute on function public.crm_mail_steel_open() to authenticated, service_role;
comment on function public.crm_mail_steel_open() is 'wave292: true when app_config mail_history_steel_open is true (Steel''s decision H1 after his spot check): his mailbox''s email lines and summaries are then readable by every CRM user, not only admins. The policies on crm_interactions and crm_email_relationship call it. Signed-in users and the service role.';

create table if not exists public.crm_email_relationship (
  id bigserial primary key,
  contact_id bigint not null unique references public.crm_contacts(id) on delete cascade,
  rel_type text check (rel_type in ('donor', 'partner', 'volunteer', 'supporter', 'vendor', 'media', 'government', 'other')),
  rel_conf numeric(3, 2) check (rel_conf between 0 and 1),
  topics text[] not null default '{}',
  open_item text,
  summary text,
  from_steel boolean not null default false,
  stale boolean not null default false,
  model text,
  cost numeric(8, 5),
  generated_at timestamptz,
  generated_by text
);
alter table public.crm_email_relationship enable row level security;
revoke all on table public.crm_email_relationship from public, anon, authenticated;
grant select on table public.crm_email_relationship to authenticated;
grant all on table public.crm_email_relationship to service_role;
revoke all on sequence public.crm_email_relationship_id_seq from public, anon, authenticated;
drop policy if exists crm_email_relationship_staff_read on public.crm_email_relationship;
create policy crm_email_relationship_staff_read on public.crm_email_relationship for select to authenticated
  using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and (not from_steel or public.is_wa_admin() or public.crm_mail_steel_open()));
comment on table public.crm_email_relationship is 'wave292: what the email history says about one contact: the writer''s type and confidence (from the scan, written by the mail_people and mail_enrich batches) and the relationship summary (topics, anything open, a short summary) written by the summary pass (crm_insight_save). One row per contact; goes with the contact; crm_merge_contacts keeps or moves it and marks it stale. CRM staff read it, except rows from Steel''s mailbox while mail_history_steel_open is false (admins only). No write policies: only the import writers and crm_insight_save write it. Counts and dates come from crm_email_relationship_v.';
comment on column public.crm_email_relationship.id is 'wave292: the row''s number.';
comment on column public.crm_email_relationship.contact_id is 'wave292: the contact (crm_contacts), one row each; deleting the contact deletes it.';
comment on column public.crm_email_relationship.rel_type is 'wave292: the writer''s type from the scan (one Jev decision): donor, partner, volunteer, supporter, vendor, media, government or other. Never decides an email permission.';
comment on column public.crm_email_relationship.rel_conf is 'wave292: the confidence of that type, 0 to 1 (under mail_history_type_unsure the profile says Not sure).';
comment on column public.crm_email_relationship.topics is 'wave292: the topics of their emails from the summary pass (donation, partnership, volunteering, event, media, supplier, government, program, other).';
comment on column public.crm_email_relationship.open_item is 'wave292: anything still open in the correspondence, in plain words (at most 300 characters, no address, link or phone), or null.';
comment on column public.crm_email_relationship.summary is 'wave292: the relationship in a few plain sentences (at most 600 characters, no address, link or phone), from the email lines only, never a body. One email gets a line without a model.';
comment on column public.crm_email_relationship.from_steel is 'wave292: true when any email line behind this row came from Steel''s mailbox: then only admins read the row until mail_history_steel_open is true (M3, H1).';
comment on column public.crm_email_relationship.stale is 'wave292: true when the summary may be out of date (a merge brought in more history); Refresh or the next summary pass rewrites it.';
comment on column public.crm_email_relationship.model is 'wave292: the model that wrote the summary (from the router), or none for a one-email line.';
comment on column public.crm_email_relationship.cost is 'wave292: what the summary cost in US dollars (the router''s _wa.cost).';
comment on column public.crm_email_relationship.generated_at is 'wave292: when the summary was written ("Written by the Hub on <date>").';
comment on column public.crm_email_relationship.generated_by is 'wave292: who asked for it: Email history (the import or the summary pass) or the staff member who pressed Refresh.';

-- ============================================================================================ 5. crm_email_relationship_v (counts and dates, nothing kept in step)
create or replace view public.crm_email_relationship_v with (security_invoker = true) as
  select i.contact_id,
         min(i.occurred_at) as first_email_at,
         max(i.occurred_at) as last_email_at,
         count(*) filter (where i.direction = 'in') as emails_in,
         count(*) filter (where i.direction = 'out') as emails_out,
         count(distinct i.meta ->> 'thread') as threads,
         (select jsonb_object_agg(y.yr, y.n) from (select extract(year from j.occurred_at)::int::text as yr, count(*) as n from public.crm_interactions j
                                                    where j.contact_id = i.contact_id and j.source = 'gmail' group by 1) y) as emails_by_year,
         array_agg(distinct i.meta ->> 'mailbox') as mailboxes
    from public.crm_interactions i
   where i.source = 'gmail'
   group by i.contact_id;
revoke all on table public.crm_email_relationship_v from public, anon, authenticated;
grant select on table public.crm_email_relationship_v to authenticated, service_role;
comment on view public.crm_email_relationship_v is 'wave292: per contact, from their email history lines (crm_interactions source gmail): first and last email, emails in and out, threads, emails by year, mailboxes. security_invoker, so the crm_interactions policies apply: Steel''s mailbox lines count only for those allowed to read them.';

-- ============================================================================================ 6. crm_interactions: two restrictive policies (M3)
drop policy if exists crm_interactions_wa292_steel_read on public.crm_interactions;
create policy crm_interactions_wa292_steel_read on public.crm_interactions as restrictive for select to authenticated
  using (source is distinct from 'gmail' or (meta ->> 'mailbox') is distinct from 'steel' or public.is_wa_admin() or public.crm_mail_steel_open());
drop policy if exists crm_interactions_wa292_no_update on public.crm_interactions;
create policy crm_interactions_wa292_no_update on public.crm_interactions as restrictive for update to authenticated
  using (source is distinct from 'gmail');

-- ============================================================================================ 7. suppressions (B3, M7)
create or replace function public.wa292_suppress_check()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_new text[]; v_kind text;
begin
  if new.email_status not in ('unknown', 'subscribed') then return new; end if;
  select coalesce(array_agg(distinct lower(btrim(a))), '{}') into v_new
    from unnest(coalesce(new.emails, '{}'::text[]) || coalesce(new.primary_email, '')) a
   where btrim(a) <> '' and (tg_op = 'INSERT' or not exists (select 1 from unnest(coalesce(old.emails, '{}'::text[]) || coalesce(old.primary_email, '')) o
                                                              where lower(btrim(o)) = lower(btrim(a))));
  if cardinality(v_new) = 0 then return new; end if;
  select case when bool_or(s.kind in ('asked_to_stop', 'unsubscribed')) then 'unsubscribed' when bool_or(s.kind = 'bounced') then 'bounced' end into v_kind
    from public.crm_email_suppressions s where s.addr_md5 in (select md5(x) from unnest(v_new) x) and s.kind in ('asked_to_stop', 'unsubscribed', 'bounced');
  if v_kind is not null then
    new.email_status := v_kind;
    new.consent_source := 'suppression list';
  end if;
  return new;
end $function$;
comment on function public.wa292_suppress_check() is 'wave292: trigger function on crm_contacts (trg_wa292_suppress, before insert and before an update of emails; primary_email is generated from emails[1] on live). Looks up the addresses the row gains in crm_email_suppressions (md5 of the lower-cased, trimmed address): asked_to_stop or unsubscribed sets email_status unsubscribed, bounced sets bounced, only from unknown or subscribed, with consent_source suppression list (the consent log records it). deleted and undo do nothing here. Forms, the Volunteer Manager and the import all pass through it. No direct execute grant.';
drop trigger if exists trg_wa292_suppress on public.crm_contacts;
create trigger trg_wa292_suppress before insert or update of emails on public.crm_contacts for each row execute function public.wa292_suppress_check();
comment on trigger trg_wa292_suppress on public.crm_contacts is 'wave292: a suppressed address is never emailable again (wa292_suppress_check).';

create or replace function public.wa292_suppress_on_delete()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_kind text := coalesce(nullif(current_setting('wa.suppress_kind', true), ''), 'deleted'); a text;
begin
  if v_kind not in ('deleted', 'undo') then v_kind := 'deleted'; end if;
  if not (coalesce(old.legacy_refs, '{}'::jsonb) ? 'email_history'
          or exists (select 1 from public.crm_interactions i where i.contact_id = old.id and i.source = 'gmail')) then return old; end if;
  for a in select distinct lower(btrim(x)) from unnest(coalesce(old.emails, '{}'::text[]) || coalesce(old.primary_email, '')) x where btrim(x) <> '' loop
    insert into public.crm_email_suppressions (addr_md5, kind, at, source)
    values (md5(a), v_kind, current_date, case when v_kind = 'undo' then 'Email history: deleted after an undo' else 'Contact deleted' end)
    on conflict (addr_md5, kind) do nothing;
    if v_kind = 'deleted' then
      delete from import_stage.mail_people p using public.crm_import_runs r where r.id = p.run_id and r.purged_at is null and p.key = a;
      delete from import_stage.mail_messages m using public.crm_import_runs r where r.id = m.run_id and r.purged_at is null and m.writer = a;
    end if;
  end loop;
  return old;
end $function$;
comment on function public.wa292_suppress_on_delete() is 'wave292: trigger function on crm_contacts (trg_wa292_suppress_del, before delete). A contact with email history (a gmail interaction or legacy_refs.email_history) adds each of its addresses to crm_email_suppressions as kind deleted (a staff deletion: a later email-history run never brings them back) and deletes that address''s staged rows in runs not purged; when wa.suppress_kind is undo (wa292_delete_created) the kind is undo, which blocks nothing, and staging is kept. No direct execute grant.';
drop trigger if exists trg_wa292_suppress_del on public.crm_contacts;
create trigger trg_wa292_suppress_del before delete on public.crm_contacts for each row execute function public.wa292_suppress_on_delete();
comment on trigger trg_wa292_suppress_del on public.crm_contacts is 'wave292: deleting a contact with email history suppresses its addresses (wa292_suppress_on_delete).';

-- ============================================================================================ 8. helpers (the service role only)
create or replace function public.wa292_kinds()
returns text[] language sql immutable set search_path to '' as $function$
  select array['mail_optouts', 'mail_orgs', 'mail_people', 'mail_enrich', 'mail_interactions']
$function$;
comment on function public.wa292_kinds() is 'wave292: the five email-history batch kinds in their order (Compare and Apply top down, Undo bottom up). The service role only.';

create or replace function public.wa292_contacts_with(p_key text)
returns setof bigint language sql stable security definer set search_path to '' as $function$
  select c.id from public.crm_contacts c
   where c.merged_into is null and nullif(btrim(coalesce(p_key, '')), '') is not null
     and (lower(btrim(c.primary_email)) = lower(btrim(p_key)) or exists (select 1 from unnest(c.emails) e where lower(btrim(e)) = lower(btrim(p_key))))
   order by c.id
$function$;
comment on function public.wa292_contacts_with(text) is 'wave292: every active contact holding an address (primary or any email, lower case and trimmed), whatever its match kind: an opt-out applies to all of them (B3). The service role only.';

create or replace function public.wa292_newer_consent(p_contact bigint, p_date date)
returns boolean language sql stable security definer set search_path to '' as $function$
  select p_date is not null and (
    exists (select 1 from public.crm_contacts c where c.id = p_contact and c.email_consent = 'express' and c.consent_at is not null and c.consent_at::date > p_date)
    or exists (select 1 from public.crm_consent_events e where e.contact_id = p_contact and e.column_name = 'email_status' and e.new_value = 'subscribed' and e.occurred_at::date > p_date))
$function$;
comment on function public.wa292_newer_consent(bigint, date) is 'wave292: true when a contact gave express email consent or resubscribed after a date (M6): an older opt-out from the email history is then listed (newer_consent), not applied. The service role only.';

create or replace function public.wa292_org_for(p_domain text, p_org text)
returns bigint language sql stable security definer set search_path to '' as $function$
  select coalesce(
    (select w.id from public.wa_partners w where p_domain is not null and lower(w.domain) = lower(p_domain)
        and not public.wa289_in_list(p_domain, public.wa284_cfg('mail_history_freemail')) order by w.id limit 1),
    (select w.id from public.wa_partners w where nullif(btrim(coalesce(p_org, '')), '') is not null
        and (public.wa284_norm(w.name) = public.wa284_norm(p_org) or exists (select 1 from unnest(w.aka) a where public.wa284_norm(a) = public.wa284_norm(p_org)))
      order by w.id limit 1))
$function$;
comment on function public.wa292_org_for(text, text) is 'wave292: the Hub organisation for a writer: by their email domain (wa_partners.domain; never free mail), then by the signature''s organisation name or an aka (normalised). The service role only.';

create or replace function public.wa292_field(p_batch bigint, p_contact bigint, p_key text, p_value jsonb)
returns text language plpgsql security definer set search_path to '' as $function$
declare v_fid bigint; r public.crm_contact_fields;
begin
  select f.id into v_fid from public.crm_fields f where f.key = p_key;
  if v_fid is null or p_value is null then return 'missing'; end if;
  if exists (select 1 from public.crm_contact_fields cf where cf.contact_id = p_contact and cf.field_id = v_fid) then return 'kept'; end if;
  insert into public.crm_contact_fields (contact_id, field_id, value, source, updated_by) values (p_contact, v_fid, p_value, 'email history', 'Email history') returning * into r;
  perform public.wa284_chg(p_batch, 'crm_contact_fields', p_contact || ':' || v_fid, p_key, null, to_jsonb(r), 'insert');
  return 'set';
end $function$;
comment on function public.wa292_field(bigint, bigint, text, jsonb) is 'wave292: sets a custom field (the LinkedIn profile) for a contact only when it has none, with source email history, and records the insert; says set, kept or missing. The service role only.';

create or replace function public.wa292_first_contact(p_contact bigint)
returns boolean language plpgsql stable security definer set search_path to '' as $function$
declare v_allowed boolean; v_basis text; v_open text;
begin
  -- the same rules as crm_email_first_contact (wave282 and wave292's clause), for the report: that function answers only signed-in staff
  select p.allowed, p.basis into v_allowed, v_basis from public.crm_email_permission(p_contact, 'newsletter') p;
  if not coalesce(v_allowed, false) or v_basis is distinct from 'not unsubscribed (WA rule of 5 Nov 2026)' then return false; end if;
  if exists (select 1 from public.crm_email_sends s where s.contact_id = p_contact and s.is_test = false and s.status in ('sent', 'delivered')) then return false; end if;
  select c.legacy_refs -> 'keela' -> 'email_marketing' ->> 'last_opened' into v_open from public.crm_contacts c where c.id = p_contact;
  if v_open ~ '^\d{4}-\d{2}-\d{2}$' and v_open >= to_char(current_date - interval '12 months', 'YYYY-MM-DD') then return false; end if;
  if exists (select 1 from public.crm_interactions o join public.crm_interactions i on i.contact_id = o.contact_id and i.source = 'gmail' and i.direction = 'in' and i.meta->>'thread' = o.meta->>'thread'
              where o.contact_id = p_contact and o.source = 'gmail' and o.direction = 'out') then return false; end if;
  return true;
end $function$;
comment on function public.wa292_first_contact(bigint) is 'wave292: the first-contact rule (crm_email_first_contact with wave292''s clause) for the mail_interactions report, which runs as the service role: allowed a newsletter only under the WA rule of 5 Nov 2026, never sent a Hub email, no Keela newsletter opened in 12 months, and no outgoing email they answered in the same thread. The service role only.';

-- ============================================================================================ 9. the writers (5.7), on wave284's helpers; no exception blocks of their own
-- Each returns wave284's writer result; the email-history counts that wave284's report does not carry go in lists.mail (an object of counts).

-- 1. mail_optouts: the staged opt-outs into the suppression list and onto every active contact holding the address; never undone
create or replace function public.wa292_w_optouts(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare w jsonb := public.wa284_w0(); p record; v_id bigint; c record; n int; v_new text;
begin
  w := jsonb_set(w, '{lists,mail}', '{"by_kind": {}, "suppressions_added": 0, "contacts_changed": 0}'::jsonb, true);
  for p in select * from import_stage.mail_people x where x.run_id = p_run and x.optout is not null order by x.key loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    if p.not_optout then w := public.wa284_bump(w, '{counts,skipped,marked not an opt-out}'); continue; end if;
    -- a bounce followed by incoming mail from the same address is ignored (M6)
    if p.optout = 'bounced' and exists (select 1 from import_stage.mail_messages m where m.run_id = p_run and m.writer = p.key and m.direction = 'in'
                                           and p.optout_at is not null and m.sent_at::date > p.optout_at) then
      w := public.wa284_bump(w, '{counts,skipped,bounce followed by incoming mail}');
      for v_id in select * from public.wa292_contacts_with(p.key) loop w := public.wa284_push(w, 'bounce_then_inbound', jsonb_build_object('contact_id', v_id)); end loop;
      continue;
    end if;
    w := public.wa284_bump(w, array['lists', 'mail', 'by_kind', p.optout]);
    insert into public.crm_email_suppressions (addr_md5, kind, at, source) values (md5(p.key), p.optout, p.optout_at, 'Email history run ' || p_run)
    on conflict (addr_md5, kind) do nothing;
    get diagnostics n = row_count;
    if n > 0 then w := public.wa284_bump(w, '{lists,mail,suppressions_added}'); end if;
    for v_id in select * from public.wa292_contacts_with(p.key) loop
      w := public.wa284_bump(w, '{counts,matched}');
      select x.email_status, lower(btrim(coalesce(x.primary_email, x.emails[1]))) as em into c from public.crm_contacts x where x.id = v_id;
      if c.email_status not in ('unknown', 'subscribed') then w := public.wa284_bump(w, '{counts,skipped,already not emailed}'); continue; end if;
      if p.optout = 'bounced' and c.em is distinct from p.key then
        w := public.wa284_bump(w, '{counts,skipped,bounce not on the sending address}');
        w := public.wa284_push(w, 'bounce_not_sending_address', jsonb_build_object('contact_id', v_id)); continue;
      end if;
      if public.wa292_newer_consent(v_id, p.optout_at) then
        w := public.wa284_bump(w, '{counts,skipped,newer consent}');
        w := public.wa284_push(w, 'newer_consent', jsonb_build_object('contact_id', v_id)); continue;
      end if;
      v_new := case when p.optout = 'asked_to_stop' then 'unsubscribed' else 'bounced' end;
      perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'email_status', to_jsonb(v_new));
      perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'consent_source',
        to_jsonb('Email history: ' || case when p.optout = 'asked_to_stop' then 'asked to stop' else 'bounce' end || coalesce(' ' || to_char(p.optout_at, 'YYYY-MM-DD'), '')));
      w := public.wa284_bump(w, '{lists,mail,contacts_changed}');
    end loop;
  end loop;
  return w;
end $function$;
comment on function public.wa292_w_optouts(bigint, bigint, boolean) is 'wave292: batch 1 (mail_optouts). Each staged opt-out (asked to stop, or a permanent bounce) not marked Not an opt-out goes into crm_email_suppressions and onto every active contact holding the address, excluded or not (B3): asked to stop sets unsubscribed; a bounce sets bounced only when it is the address the mail rule uses (coalesce(primary_email, emails[1])) and is ignored when later incoming mail came from it (M6). Only unknown or subscribed change; express consent or a resubscription after the request is listed (newer_consent), not changed. consent_source Email history: asked to stop <date> or ...: bounce <date>. Never undone. The service role only.';

-- 2. mail_orgs: new organisations for qualifying unmatched domains; blanks filled on matches (5.5)
create or replace function public.wa292_w_orgs(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0(); o record; p public.wa_partners; f jsonb; v_name text; v_addr text; v_type text; v_rel jsonb; v_status text;
  v_map jsonb := public.wa284_cfg('mail_history_org_map');
begin
  for o in select * from import_stage.mail_orgs x where x.run_id = p_run order by x.domain loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    if o.outcome is distinct from 'found' or jsonb_typeof(o.facts) is distinct from 'object' then
      w := public.wa284_bump(w, array['counts', 'skipped', case o.outcome when 'none_found' then 'none found' when 'robots' then 'robots.txt refused' when 'refused_address' then 'refused address'
                                       when 'fetch_failed' then 'fetch failed' when 'not_html' then 'not a web page' when 'over_cap' then 'over the cap' else 'no facts' end]);
      continue;
    end if;
    f := o.facts; v_name := nullif(btrim(coalesce(f ->> 'name', '')), '');
    v_addr := nullif(concat_ws(', ', nullif(btrim(f ->> 'street'), ''), nullif(btrim(f ->> 'city'), ''), nullif(btrim(f ->> 'province'), ''), nullif(btrim(f ->> 'postal_code'), ''),
                               nullif(btrim(f ->> 'country'), '')), '');
    -- match first: the domain, the scan's website match, the host of a website, the normalised name or an aka
    p := null;
    select * into p from public.wa_partners x where lower(x.domain) = o.domain order by x.id limit 1;
    if p.id is null and o.partner_id is not null then select * into p from public.wa_partners x where x.id = o.partner_id; end if;
    if p.id is null then
      select * into p from public.wa_partners x where lower(regexp_replace(regexp_replace(coalesce(x.website, ''), '^[a-z]+://(www\.)?', '', 'i'), '[/:?#].*$', '')) = o.domain order by x.id limit 1;
    end if;
    if p.id is null and v_name is not null then
      select * into p from public.wa_partners x where public.wa284_norm(x.name) = public.wa284_norm(v_name) or exists (select 1 from unnest(x.aka) a where public.wa284_norm(a) = public.wa284_norm(v_name))
       order by x.id limit 1;
    end if;
    if p.id is not null then
      w := public.wa284_bump(w, '{counts,matched}');
      if p.domain is null and not exists (select 1 from public.wa_partners x where lower(x.domain) = o.domain) then
        perform public.wa284_upd(p_batch, 'wa_partners', p.id, 'domain', to_jsonb(o.domain));
      end if;
      w := public.wa284_fill(p_batch, 'wa_partners', p.id, 'website', p.website, left(o.url, 300), w);
      w := public.wa284_fill(p_batch, 'wa_partners', p.id, 'kind', p.kind, left(f ->> 'kind', 60), w);
      w := public.wa284_fill(p_batch, 'wa_partners', p.id, 'address', p.address, v_addr, w);
      w := public.wa284_fill(p_batch, 'wa_partners', p.id, 'city', p.city, nullif(btrim(f ->> 'city'), ''), w);
      w := public.wa284_fill(p_batch, 'wa_partners', p.id, 'summary', p.summary, left(nullif(btrim(f ->> 'description'), ''), 600), w);
      continue;
    end if;
    -- relationship and category from its writers' most common type (mail_history_org_map; other has none: not created)
    select q.rel_type into v_type from (select x.rel_type, count(*) as n from import_stage.mail_people x
                                         where x.run_id = p_run and x.domain = o.domain and x.writer and not x.excluded and x.rel_type is not null
                                         group by 1 order by 2 desc, 1 limit 1) q;
    v_rel := case when jsonb_typeof(v_map) = 'object' and v_type is not null then v_map -> v_type end;
    if jsonb_typeof(v_rel) is distinct from 'object' then w := public.wa284_bump(w, '{counts,skipped,no relationship for its writers'' type}'); continue; end if;
    v_status := case when exists (select 1 from import_stage.mail_people x where x.run_id = p_run and x.domain = o.domain and x.writer and x.last_at > now() - interval '12 months')
                     then 'active' else 'past' end;
    insert into public.wa_partners (name, kind, city, relationship, category, status, visibility, website, summary, domain, address, sources, created_by, updated_by)
    values (coalesce(v_name, o.domain), left(f ->> 'kind', 60), nullif(btrim(f ->> 'city'), ''), coalesce(v_rel ->> 'relationship', 'partner'),
            case when v_rel ->> 'category' in ('partner', 'collaborator', 'sponsor') then v_rel ->> 'category' else 'partner' end, v_status, 'everyone', left(o.url, 300),
            left(nullif(btrim(f ->> 'description'), ''), 600), o.domain, v_addr,
            jsonb_build_array(jsonb_build_object('source', 'email history', 'run', p_run, 'domain', o.domain)), 'Email history', 'Email history')
    returning * into p;
    perform public.wa284_chg(p_batch, 'wa_partners', p.id::text, null, null, to_jsonb(p), 'insert');
    w := public.wa284_push(w, 'names_created', to_jsonb(p.name));
  end loop;
  return w;
end $function$;
comment on function public.wa292_w_orgs(bigint, bigint, boolean) is 'wave292: batch 2 (mail_orgs). Each organisation domain the scan looked up with facts found: matched to wa_partners by domain, the scan''s website match, the host of a website, then the normalised name or an aka; a match gets its blanks filled (domain, website, kind, address, city, summary; the Hub wins). Otherwise a new organisation: name, kind, one-sentence summary and the printed address from its homepage, relationship and category from its writers'' most common type (mail_history_org_map; type other creates none), status active when someone there wrote in the last 12 months else past, visibility everyone, sources {source email history, run, domain}. Skipped by outcome (none found, robots.txt refused, refused address, fetch failed, not a web page, over the cap). New ones are listed by name and never deleted by Undo. The service role only.';

-- 3. mail_people: a contact for each writer with no match (5.7); the type row; no consent set
create or replace function public.wa292_w_people(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0(); p record; m jsonb; c public.crm_contacts; r public.crm_email_relationship; l public.crm_contact_orgs;
  v_name text; v_full text; v_first text; v_last text; v_org text; v_pid bigint; v_phone text; v_kinds text[]; v_tags text[]; v_li text;
  v_min numeric := public.wa289_num('mail_history_kind_min', 0.8);
begin
  w := jsonb_set(w, '{lists,mail}', jsonb_build_object('by_type', '{}'::jsonb, 'by_confidence', '{}'::jsonb, 'suppressed', 0, 'born_opted_out', 0,
         'outbound_only', coalesce((select max((s.counts #>> '{run,outbound_only}')::int) from public.crm_mail_scans s where s.run_id = p_run), 0)), true);
  for p in select * from import_stage.mail_people x where x.run_id = p_run and x.writer order by x.key loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    if p.excluded then w := public.wa284_bump(w, '{counts,skipped,left out}'); continue; end if;
    if exists (select 1 from public.crm_email_suppressions s where s.addr_md5 = md5(p.key) and s.kind = 'deleted') then
      w := public.wa284_bump(w, '{counts,skipped,suppressed (a deleted contact)}'); w := public.wa284_bump(w, '{lists,mail,suppressed}'); continue;
    end if;
    m := public.wa289_match(p.key, p.sig ->> 'phone');
    if m ->> 'kind' = 'internal' then w := public.wa284_bump(w, '{counts,skipped,internal}'); continue; end if;
    if m ->> 'kind' in ('email', 'merged') then w := public.wa284_bump(w, '{counts,matched}'); continue; end if;
    if m ->> 'kind' = 'phone_only' then
      w := public.wa284_bump(w, '{counts,skipped,phone-only match (listed only)}');
      w := public.wa284_push(w, 'phone_only', jsonb_build_object('contact_id', (m ->> 'id')::bigint)); continue;
    end if;
    -- a new contact
    v_name := nullif(btrim(coalesce(p.name, '')), '');
    if v_name like '%@%' then v_name := null; end if;
    v_name := left(coalesce(v_name, nullif(btrim(coalesce(p.sig ->> 'name', '')), '')), 160);
    v_org := left(nullif(btrim(coalesce(p.sig ->> 'organization', '')), ''), 160);
    v_pid := public.wa292_org_for(p.domain, v_org);
    v_tags := array['email history'];
    if p.general_inbox then
      v_full := coalesce(v_org, (select x.name from public.wa_partners x where x.id = v_pid), p.domain) || ' (general inbox)';
      v_first := null; v_last := null; v_tags := v_tags || 'general inbox'::text;
    else
      v_full := coalesce(v_name, p.key);
      v_first := case when v_name is null then null when position(' ' in v_name) > 0 then split_part(v_name, ' ', 1) else v_name end;
      v_last := case when position(' ' in coalesce(v_name, '')) > 0 then btrim(substr(v_name, position(' ' in v_name) + 1)) end;
    end if;
    v_phone := public.wa171_digits(p.sig ->> 'phone');
    v_kinds := case when p.rel_type in ('partner', 'supporter') and p.rel_conf >= v_min then array[p.rel_type] else '{}'::text[] end;
    insert into public.crm_contacts (full_name, first_name, last_name, emails, phones, job_title, organization, language, kinds, tags, source, legacy_refs, created_by, updated_by)
    values (v_full, v_first, v_last, array[p.key], case when v_phone is null then '{}'::text[] else array[v_phone] end,
            left(nullif(btrim(coalesce(p.sig ->> 'title', '')), ''), 160), v_org, case when p.lang in ('en', 'fr') then p.lang end, v_kinds, v_tags, 'email_history',
            jsonb_build_object('email_history', jsonb_build_object('run', p_run, 'batch', p_batch)), 'Email history', 'Email history')
    returning * into c;
    perform public.wa284_chg(p_batch, 'crm_contacts', c.id::text, null, null, to_jsonb(c), 'insert');
    if c.email_status <> 'unknown' then w := public.wa284_bump(w, '{lists,mail,born_opted_out}'); end if;
    w := public.wa284_bump(w, array['lists', 'mail', 'by_type', coalesce(p.rel_type, 'none')]);
    w := public.wa284_bump(w, array['lists', 'mail', 'by_confidence', case when p.rel_conf is null then 'none' when p.rel_conf < 0.5 then 'under 50%' when p.rel_conf < 0.8 then '50 to 79%' else '80% or more' end]);
    if v_pid is not null then
      insert into public.crm_contact_orgs (contact_id, partner_id, role_title, created_by) values (c.id, v_pid, left(nullif(btrim(coalesce(p.sig ->> 'title', '')), ''), 160), 'Email history')
      returning * into l;
      perform public.wa284_chg(p_batch, 'crm_contact_orgs', l.id::text, null, null, to_jsonb(l), 'insert');
    end if;
    v_li := p.sig ->> 'website';
    if v_li ~* '^(https?://)?([a-z]+\.)?linkedin\.com/in/' then perform public.wa292_field(p_batch, c.id, 'linkedin', to_jsonb(left(v_li, 300))); end if;
    if p.rel_type is not null then
      insert into public.crm_email_relationship (contact_id, rel_type, rel_conf, from_steel, generated_by)
      values (c.id, p.rel_type, round(p.rel_conf, 2), 'steel' = any(coalesce(p.mailboxes, '{}'::text[])), 'Email history') returning * into r;
      perform public.wa284_chg(p_batch, 'crm_email_relationship', r.id::text, null, null, to_jsonb(r), 'insert');
    end if;
  end loop;
  return w;
end $function$;
comment on function public.wa292_w_people(bigint, bigint, boolean) is 'wave292: batch 3 (mail_people). For each writer not left out and not suppressed as deleted, matched again at write time (wa289_match): an existing contact is left to batch 4, a team member''s is internal, a phone-only match is listed by Hub id; no match makes a contact: name (display name, else signature; an organisation''s general address becomes "<organisation> (general inbox)", tagged general inbox), the address, the signature phone as digits, title, organisation, language, source email_history, tags email history, kinds partner or supporter at mail_history_kind_min or more (H3), legacy_refs.email_history {run, batch}, the organisation link, the LinkedIn field; and a crm_email_relationship row with the type only. No consent is set: the suppression trigger makes a suppressed address born opted out. Undo tags created contacts unchanged since email history: review and removes links, fields and type rows unchanged since. The service role only.';

-- 4. mail_enrich: each matched contact's blanks filled (5.4), the tag, a type row if none; never an opt-out or consent column
create or replace function public.wa292_w_enrich(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0(); p record; m jsonb; c public.crm_contacts; r public.crm_email_relationship; l public.crm_contact_orgs;
  v_name text; v_org text; v_pid bigint; v_phone text; v_li text; v_min numeric := public.wa289_num('mail_history_kind_min', 0.8);
begin
  for p in select * from import_stage.mail_people x where x.run_id = p_run and x.writer order by x.key loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    if p.excluded then w := public.wa284_bump(w, '{counts,skipped,left out}'); continue; end if;
    m := public.wa289_match(p.key, null);
    if coalesce(m ->> 'kind', 'none') not in ('email', 'merged') then
      w := public.wa284_bump(w, array['counts', 'skipped', case m ->> 'kind' when 'internal' then 'internal' else 'not an existing contact' end]); continue;
    end if;
    select * into c from public.crm_contacts x where x.id = (m ->> 'id')::bigint;
    if c.source = 'email_history' and (c.legacy_refs #>> '{email_history,run}') = p_run::text then w := public.wa284_bump(w, '{counts,skipped,created by this run}'); continue; end if;
    w := public.wa284_bump(w, '{counts,matched}');
    v_name := nullif(btrim(coalesce(p.name, '')), '');
    if v_name like '%@%' then v_name := null; end if;
    v_name := left(coalesce(v_name, nullif(btrim(coalesce(p.sig ->> 'name', '')), '')), 160);
    if v_name is not null and not p.general_inbox and (btrim(c.full_name) = '' or position('@' in c.full_name) > 0) then
      perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'full_name', to_jsonb(v_name));
      w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'first_name', c.first_name, case when position(' ' in v_name) > 0 then split_part(v_name, ' ', 1) else v_name end, w);
      w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'last_name', c.last_name, case when position(' ' in v_name) > 0 then btrim(substr(v_name, position(' ' in v_name) + 1)) end, w);
    end if;
    w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'job_title', c.job_title, left(nullif(btrim(coalesce(p.sig ->> 'title', '')), ''), 160), w);
    v_org := left(nullif(btrim(coalesce(p.sig ->> 'organization', '')), ''), 160);
    w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'organization', c.organization, v_org, w);
    v_phone := public.wa171_digits(p.sig ->> 'phone');
    if v_phone is not null and cardinality(c.phones) = 0 then perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'phones', to_jsonb(array[v_phone])); end if;
    if c.language is null and p.lang in ('en', 'fr') then perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'language', to_jsonb(p.lang)); end if;
    if not ('email history' = any(c.tags)) then perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'tags', to_jsonb(c.tags || 'email history'::text)); end if;
    if cardinality(c.kinds) = 0 and p.rel_type in ('partner', 'supporter') and p.rel_conf >= v_min then
      perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'kinds', to_jsonb(array[p.rel_type]));
    end if;
    v_pid := public.wa292_org_for(p.domain, v_org);
    if v_pid is not null and not exists (select 1 from public.crm_contact_orgs x where x.contact_id = c.id) then
      insert into public.crm_contact_orgs (contact_id, partner_id, role_title, created_by) values (c.id, v_pid, left(nullif(btrim(coalesce(p.sig ->> 'title', '')), ''), 160), 'Email history')
      returning * into l;
      perform public.wa284_chg(p_batch, 'crm_contact_orgs', l.id::text, null, null, to_jsonb(l), 'insert');
    end if;
    v_li := p.sig ->> 'website';
    if v_li ~* '^(https?://)?([a-z]+\.)?linkedin\.com/in/' then
      if public.wa292_field(p_batch, c.id, 'linkedin', to_jsonb(left(v_li, 300))) = 'kept' then w := public.wa284_bump(w, '{counts,kept_hub_value,linkedin}'); end if;
    end if;
    if p.rel_type is not null then
      select * into r from public.crm_email_relationship x where x.contact_id = c.id;
      if r.id is null then
        insert into public.crm_email_relationship (contact_id, rel_type, rel_conf, from_steel, generated_by)
        values (c.id, p.rel_type, round(p.rel_conf, 2), 'steel' = any(coalesce(p.mailboxes, '{}'::text[])), 'Email history') returning * into r;
        perform public.wa284_chg(p_batch, 'crm_email_relationship', r.id::text, null, null, to_jsonb(r), 'insert');
      elsif r.rel_type is null then
        perform public.wa284_upd(p_batch, 'crm_email_relationship', r.id, 'rel_type', to_jsonb(p.rel_type));
        perform public.wa284_upd(p_batch, 'crm_email_relationship', r.id, 'rel_conf', to_jsonb(round(p.rel_conf, 2)));
      end if;
    end if;
  end loop;
  return w;
end $function$;
comment on function public.wa292_w_enrich(bigint, bigint, boolean) is 'wave292: batch 4 (mail_enrich). Each writer not left out who matches an existing contact (wa289_match by email or a followed merge; not one this run created): blanks filled from the signature and the display name (5.4: a name only when the contact''s name is empty or an address; title, organisation, a phone only when they have none, language), the tag email history, kinds partner or supporter only when their kinds are empty (H3), an organisation link only when they have none, the LinkedIn field only when empty, and a type row if they have none. Never an opt-out or consent column; the Hub wins (kept_hub_value). Undo is value-checked. The service role only.';

-- 5. mail_interactions: one timeline row per kept email per person (5.8); adds only
create or replace function public.wa292_w_interactions(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare w jsonb := public.wa284_w0(); p record; e record; m jsonb; v_id bigint; v_k text; v_ref text; i public.crm_interactions; v_ids bigint[] := '{}';
begin
  w := jsonb_set(w, '{lists,mail}', '{"by_mailbox": {}, "by_year": {}, "by_direction": {}, "first_contacts": 0}'::jsonb, true);
  for p in select * from import_stage.mail_people x where x.run_id = p_run and x.writer order by x.key loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    if p.excluded then w := public.wa284_bump(w, '{counts,skipped,left out}'); continue; end if;
    m := public.wa289_match(p.key, null);
    if coalesce(m ->> 'kind', 'none') not in ('email', 'merged') then
      w := public.wa284_bump(w, array['counts', 'skipped', case m ->> 'kind' when 'internal' then 'internal' else 'no Hub contact' end]); continue;
    end if;
    v_id := (m ->> 'id')::bigint; v_k := left(md5(p.key), 8);
    w := public.wa284_bump(w, '{counts,matched}');
    if not (v_id = any(v_ids)) then v_ids := v_ids || v_id; end if;
    for e in select * from import_stage.mail_messages x where x.run_id = p_run and x.state = 'kept'
                and (x.writer = p.key or p.key = any(coalesce(x.recipients, '{}'::text[]))) order by x.sent_at, x.gmail_id loop
      v_ref := e.mailbox || ':' || e.gmail_id || ':' || v_k;
      if exists (select 1 from public.crm_interactions x where x.source = 'gmail' and x.source_ref = v_ref) then w := public.wa284_bump(w, '{counts,skipped,already in the Hub}'); continue; end if;
      insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
      values (v_id, 'email', e.direction, 'email', e.subject, e.line, coalesce(e.sent_at, now()), 'gmail', v_ref,
              jsonb_build_object('mailbox', coalesce(e.box, e.mailbox), 'thread', e.mailbox || ':' || coalesce(e.thread_id, e.gmail_id), 'topic', e.topic, 'run', p_run, 'import_batch', p_batch),
              'Email history')
      returning * into i;
      perform public.wa284_chg(p_batch, 'crm_interactions', i.id::text, null, null, to_jsonb(i), 'insert');
      w := public.wa284_bump(w, array['lists', 'mail', 'by_mailbox', coalesce(e.box, e.mailbox)]);
      w := public.wa284_bump(w, array['lists', 'mail', 'by_year', coalesce(extract(year from e.sent_at)::int::text, 'undated')]);
      w := public.wa284_bump(w, array['lists', 'mail', 'by_direction', coalesce(e.direction, 'in')]);
    end loop;
  end loop;
  -- first contacts among this run's people after the apply (6.3): the rule reads the rows just written
  w := jsonb_set(w, '{lists,mail,first_contacts}', to_jsonb((select count(*) from unnest(v_ids) x where public.wa292_first_contact(x))), true);
  return w;
end $function$;
comment on function public.wa292_w_interactions(bigint, bigint, boolean) is 'wave292: batch 5 (mail_interactions). For each writer not left out with a Hub contact (matched by email at write time), one crm_interactions row per kept email they wrote or received (as one of at most mail_history_max_recipients): kind and channel email, direction, the cleaned subject, the validated one line as body (never the email''s text), the email''s date, source gmail, source_ref <mailbox>:<gmail id>:<short md5 of the address>, meta {mailbox steel, hub or info; thread; topic; run; import_batch}, created_by Email history. Left-out threads never appear. Counts by mailbox, year and direction, and the first contacts among the run''s people after the apply. Adds only; Undo removes its rows unchanged since. The service role only.';

-- ============================================================================================ 10. dispatch, basis, undo, purge, delete created
create or replace function public.wa292_write(p_batch bigint, p_kind text, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_i int := array_position(public.wa292_kinds(), p_kind); v_miss text;
begin
  if v_i is null then raise exception 'wa284: unknown batch kind %', p_kind; end if;
  if (select r.source from public.crm_import_runs r where r.id = p_run) is distinct from 'email_history' then
    raise exception 'wa284: email history: batch % is not on an email-history run', p_batch;
  end if;
  if not exists (select 1 from public.crm_mail_scans s where s.run_id = p_run)
     or exists (select 1 from public.crm_mail_scans s where s.run_id = p_run and s.phase not in ('done', 'summaries', 'summarised')) then
    raise exception 'wa284: email history: the scan of run % has not finished', p_run;
  end if;
  select string_agg(k, ', ' order by o) into v_miss from unnest((public.wa292_kinds())[1:v_i - 1]) with ordinality as u(k, o)
   where not exists (select 1 from public.crm_import_batches b where b.run_id = p_run and b.kind = u.k and b.status = 'applied');
  if v_miss is not null then raise exception 'wa284: email history: apply % first', v_miss; end if;
  perform set_config('wa.consent_source', 'Email history', true);
  return case p_kind
    when 'mail_optouts' then public.wa292_w_optouts(p_batch, p_run, p_rehearse)
    when 'mail_orgs' then public.wa292_w_orgs(p_batch, p_run, p_rehearse)
    when 'mail_people' then public.wa292_w_people(p_batch, p_run, p_rehearse)
    when 'mail_enrich' then public.wa292_w_enrich(p_batch, p_run, p_rehearse)
    when 'mail_interactions' then public.wa292_w_interactions(p_batch, p_run, p_rehearse)
  end;
end $function$;
comment on function public.wa292_write(bigint, text, bigint, boolean) is 'wave292: wa284_write''s branch for the five email-history kinds: refuses a batch that is not on an email-history run, a scan that has not finished, and a kind whose cards above are not all applied (Compare and Apply top down); sets wa.consent_source Email history (the consent log''s source) and runs the writer. The service role only.';

create or replace function public.wa292_basis(p_batch bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare b public.crm_import_batches; v_i int;
begin
  select * into b from public.crm_import_batches x where x.id = p_batch;
  v_i := array_position(public.wa292_kinds(), b.kind);
  return jsonb_build_object(
    'scans', (select jsonb_agg(jsonb_build_object('mailbox', s.mailbox, 'finished', extract(epoch from s.finished_at), 'counts', s.counts -> 'run') order by s.mailbox)
                from public.crm_mail_scans s where s.run_id = b.run_id),
    'people', (select md5(coalesce(string_agg(p.key || ':' || p.excluded || ':' || p.not_optout || ':' || coalesce(p.rel_type, '') || ':' || coalesce(p.rel_conf::text, ''), '|' order by p.key), ''))
                 from import_stage.mail_people p where p.run_id = b.run_id),
    'orgs', (select md5(coalesce(string_agg(o.domain || ':' || coalesce(o.outcome, '') || ':' || coalesce(o.conf::text, '') || ':' || coalesce(md5(o.facts::text), ''), '|' order by o.domain), ''))
               from import_stage.mail_orgs o where o.run_id = b.run_id),
    'settings', (select md5(string_agg(k.k || '=' || coalesce(c.value, ''), '|' order by k.k))
                   from unnest(array['mail_history_kind_min', 'mail_history_org_map', 'mail_history_freemail', 'mail_history_type_unsure', 'mail_history_org_type_min']) as k(k)
                   left join public.app_config c on c.key = k.k),
    'above', (select coalesce(jsonb_agg(x.id order by x.id), '[]'::jsonb) from public.crm_import_batches x
               where x.run_id = b.run_id and x.status = 'applied' and x.kind = any((public.wa292_kinds())[1:coalesce(v_i, 1) - 1])));
end $function$;
comment on function public.wa292_basis(bigint) is 'wave292: what an email-history batch''s compare was based on (wa284_basis''s branch): both scans'' finish times and counts, an md5 of the people''s exclusions, opt-out marks and types, an md5 of the organisation lookups, an md5 of the settings the batches read, and the ids of the applied batches above. wa284_apply refuses when it changed since the compare. Hashes and counts only. The service role only.';

create or replace function public.wa292_undo_check(p_batch bigint)
returns void language plpgsql stable security definer set search_path to '' as $function$
declare b public.crm_import_batches; v_i int; v_later text;
begin
  select * into b from public.crm_import_batches x where x.id = p_batch;
  v_i := array_position(public.wa292_kinds(), b.kind);
  if v_i is null then return; end if;
  select string_agg(x.kind, ', ' order by array_position(public.wa292_kinds(), x.kind) desc) into v_later from public.crm_import_batches x
   where x.run_id = b.run_id and x.status = 'applied' and array_position(public.wa292_kinds(), x.kind) > v_i;
  if v_later is not null then raise exception 'wa284: email history: undo % first (Undo goes bottom up)', v_later; end if;
end $function$;
comment on function public.wa292_undo_check(bigint) is 'wave292: wa284_undo''s check for an email-history batch: refuses while any later email-history card of the same run is applied (Undo bottom up). The service role only.';

create or replace function public.wa292_undo_after(p_batch bigint, p_report jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare b public.crm_import_batches; c record; v_cur jsonb; v_q jsonb := '[]'::jsonb; ts text[] := array['updated_at', 'updated_by', 'created_at', 'last_activity_at'];
begin
  select * into b from public.crm_import_batches x where x.id = p_batch;
  if b.kind is distinct from 'mail_people' then return p_report; end if;
  for c in select x.row_id::bigint as id, x.new_value from public.crm_import_changes x where x.batch_id = p_batch and x.table_name = 'crm_contacts' and x.action = 'insert' order by x.id loop
    select to_jsonb(t) into v_cur from public.crm_contacts t where t.id = c.id;
    if v_cur is null then continue; end if;
    if (v_cur - ts) = (c.new_value - ts) then
      update public.crm_contacts t set tags = t.tags || 'email history: review'::text where t.id = c.id and not ('email history: review' = any(t.tags));
      v_q := v_q || to_jsonb(c.id);
    end if;
  end loop;
  return jsonb_set(p_report, '{lists,quarantined}', v_q, true) || jsonb_build_object('undo', coalesce(p_report -> 'undo', '{}'::jsonb) || jsonb_build_object('quarantined', jsonb_array_length(v_q)));
end $function$;
comment on function public.wa292_undo_after(bigint, jsonb) is 'wave292: after wa284_undo walks a mail_people batch back: the contacts it created that are unchanged since get the tag email history: review, which keeps them out of every Send (crm_email_permission), and are listed (quarantined, Hub ids). Nothing is deleted; Delete created and untouched (wa292_delete_created) is a separate action. Other kinds pass through. The service role only.';

create or replace function public.wa292_purge(p_run bigint)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  delete from import_stage.mail_messages x where x.run_id = p_run;
  delete from import_stage.mail_people x where x.run_id = p_run;
  delete from import_stage.mail_orgs x where x.run_id = p_run;
end $function$;
comment on function public.wa292_purge(bigint) is 'wave292: wa284_purge''s step for an email-history run: deletes the run''s staged messages, people and organisations. Never mail_seen, mail_left_alone or crm_email_suppressions, which are kept across runs. The service role only.';

create or replace function public.wa292_delete_created(p_batch bigint, p_by text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  b public.crm_import_batches; c record; v_cur jsonb; v_exp jsonb; v_ids bigint[] := '{}'; v_kept int := 0; v_hold boolean;
  ts text[] := array['updated_at', 'updated_by', 'created_at', 'last_activity_at', 'tags'];
begin
  select * into b from public.crm_import_batches x where x.id = p_batch for update;
  if b.id is null then raise exception 'wa284: there is no batch %', p_batch; end if;
  if b.kind is distinct from 'mail_people' or b.status is distinct from 'undone' then raise exception 'wa284: email history: Delete created works on an undone mail_people batch only'; end if;
  if (select r.purged_at from public.crm_import_runs r where r.id = b.run_id) is not null then raise exception 'wa284: this run was purged; its change records are gone'; end if;
  for c in select x.row_id::bigint as id, x.new_value from public.crm_import_changes x where x.batch_id = p_batch and x.table_name = 'crm_contacts' and x.action = 'insert' order by x.id loop
    select to_jsonb(t) into v_cur from public.crm_contacts t where t.id = c.id;
    if v_cur is null then continue; end if;
    v_exp := c.new_value;
    -- unchanged since, apart from the review tag
    if (v_cur - ts) is distinct from (v_exp - ts)
       or (select coalesce(array_agg(x order by x), '{}') from jsonb_array_elements_text(v_cur -> 'tags') x)
          is distinct from (select coalesce(array_agg(x order by x), '{}') from (select jsonb_array_elements_text(v_exp -> 'tags') union select 'email history: review') q(x)) then
      v_kept := v_kept + 1; continue;
    end if;
    -- holds nothing else
    v_hold := exists (select 1 from public.crm_donations x where x.contact_id = c.id) or exists (select 1 from public.crm_interactions x where x.contact_id = c.id)
           or exists (select 1 from public.crm_contact_orgs x where x.contact_id = c.id) or exists (select 1 from public.crm_contact_fields x where x.contact_id = c.id)
           or exists (select 1 from public.crm_form_submissions x where x.contact_id = c.id) or exists (select 1 from public.crm_email_sends x where x.contact_id = c.id)
           or exists (select 1 from public.volunteer_applications x where x.contact_id = c.id) or exists (select 1 from public.crm_email_relationship x where x.contact_id = c.id)
           or exists (select 1 from public.wa_campaign_people x where x.contact_id = c.id)
           or ((v_cur ->> 'volunteer_id') is not null and exists (select 1 from public.event_roster x where x.person_id = (v_cur ->> 'volunteer_id')::bigint));
    if not v_hold and to_regclass('public.crm_lists') is not null then
      execute 'select exists (select 1 from public.crm_lists l where $1 = any(l.member_ids))' into v_hold using c.id;
    end if;
    if v_hold then v_kept := v_kept + 1; continue; end if;
    v_ids := v_ids || c.id;
  end loop;
  perform set_config('wa.suppress_kind', 'undo', true);
  delete from public.crm_contacts t where t.id = any(v_ids);
  perform set_config('wa.suppress_kind', '', true);
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_import_batches', p_batch::text, 'delete created', null, 'Deleted ' || cardinality(v_ids) || ' contacts created by the email history and untouched since; kept ' || v_kept, coalesce(nullif(p_by, ''), 'service'));
  update public.crm_import_batches x set report = jsonb_set(coalesce(x.report, '{}'::jsonb), '{deleted_created}', jsonb_build_object('deleted', cardinality(v_ids), 'kept', v_kept, 'at', now()), true)
   where x.id = p_batch;
  return jsonb_build_object('deleted', cardinality(v_ids), 'kept', v_kept);
end $function$;
comment on function public.wa292_delete_created(bigint, text) is 'wave292: Delete created and untouched (5.7), on an undone mail_people batch of a run not purged, after the page''s centred confirmation and Steel''s yes: deletes the contacts the batch created that are unchanged since (apart from the review tag) and hold nothing else (no gift, interaction, organisation link, custom field, form answer, application, Send, type row, Campaign row, roster row or list). The deletions are suppressed as kind undo (wa.suppress_kind), which does not block a later run. Logged in change_log and the batch report (counts only). The service role only.';

-- ============================================================================================ 11. the summary pass (5.9; mail-history v2 calls these)
create or replace function public.crm_insight_input(p_contact bigint)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'contact_id', p_contact,
    'count', (select count(*) from public.crm_interactions i where i.contact_id = p_contact and i.source = 'gmail'),
    'from_steel', exists (select 1 from public.crm_interactions i where i.contact_id = p_contact and i.source = 'gmail' and i.meta ->> 'mailbox' = 'steel'),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('date', to_char(q.occurred_at at time zone 'America/Toronto', 'YYYY-MM-DD'), 'direction', q.direction,
                                                          'mailbox', q.meta ->> 'mailbox', 'subject', q.subject, 'line', q.body, 'topic', q.meta ->> 'topic') order by q.occurred_at), '[]'::jsonb)
               from (select * from public.crm_interactions i where i.contact_id = p_contact and i.source = 'gmail' order by i.occurred_at desc
                      limit coalesce((public.wa284_cfg('mail_history_clips') ->> 'rows_per_summary')::int, 60)) q))
$function$;
comment on function public.crm_insight_input(bigint) is 'wave292: what the summary pass and Refresh read for one contact: their email history lines only (crm_interactions source gmail: date, direction, mailbox, cleaned subject, one line, topic), the latest mail_history_clips.rows_per_summary (60), how many there are and whether any came from Steel''s mailbox. Never a body or a left-out thread. The service role only (mail-history checks the caller first).';

create or replace function public.crm_insight_save(p_contact bigint, p_row jsonb, p_by text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare k text; v_topics text[]; v_sum text; v_open text; v_steel boolean; v_bad text := '(https?://|www\.|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(\+?\d[\s.()-]*){10,})';
begin
  if not exists (select 1 from public.crm_contacts c where c.id = p_contact) then raise exception 'wa284: email history: there is no contact %', p_contact; end if;
  if jsonb_typeof(p_row) is distinct from 'object' or public.wa289_body_keys(p_row) then raise exception 'wa284: email history: a summary may not carry body, text, snippet or html'; end if;
  for k in select jsonb_object_keys(p_row) loop
    if k not in ('topics', 'open_item', 'summary', 'model', 'cost') then raise exception 'wa284: email history: a summary does not take %', k; end if;
  end loop;
  v_sum := nullif(btrim(coalesce(p_row ->> 'summary', '')), '');
  v_open := nullif(btrim(coalesce(p_row ->> 'open_item', '')), '');
  if v_sum is null or length(v_sum) > 600 or coalesce(length(v_open), 0) > 300 then raise exception 'wa284: email history: a summary must have 1 to 600 characters and anything open at most 300'; end if;
  if v_sum ~* v_bad or coalesce(v_open, '') ~* v_bad then raise exception 'wa284: email history: a summary may not hold a link, an email address or a phone number'; end if;
  select coalesce(array_agg(distinct t), '{}') into v_topics from jsonb_array_elements_text(case when jsonb_typeof(p_row -> 'topics') = 'array' then p_row -> 'topics' else '[]'::jsonb end) t;
  if exists (select 1 from unnest(v_topics) t where t not in ('donation', 'partnership', 'volunteering', 'event', 'media', 'supplier', 'government', 'program', 'other')) then
    raise exception 'wa284: email history: unknown topic';
  end if;
  v_steel := exists (select 1 from public.crm_interactions i where i.contact_id = p_contact and i.source = 'gmail' and i.meta ->> 'mailbox' = 'steel');
  insert into public.crm_email_relationship as r (contact_id, topics, open_item, summary, from_steel, stale, model, cost, generated_at, generated_by)
  values (p_contact, v_topics, v_open, v_sum, v_steel, false, left(p_row ->> 'model', 120), greatest(coalesce((p_row ->> 'cost')::numeric, 0), 0), now(), left(coalesce(nullif(p_by, ''), 'Email history'), 120))
  on conflict (contact_id) do update set topics = excluded.topics, open_item = excluded.open_item, summary = excluded.summary, from_steel = r.from_steel or excluded.from_steel,
         stale = false, model = excluded.model, cost = excluded.cost, generated_at = excluded.generated_at, generated_by = excluded.generated_by;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_contact', p_contact::text, 'email summary', null, 'Written by the Hub', left(coalesce(nullif(p_by, ''), 'Email history'), 120));
  return jsonb_build_object('ok', true, 'from_steel', v_steel);
end $function$;
comment on function public.crm_insight_save(bigint, jsonb, text) is 'wave292: saves one contact''s relationship summary ({topics, open_item, summary, model, cost}) into crm_email_relationship (upsert; stale false; from_steel when any of their lines came from Steel''s mailbox). Refuses other keys, body-like keys, a summary over 600 characters or anything open over 300, a link, address or phone, and unknown topics. Logged in change_log without the text. The service role only.';

create or replace function public.wa292_summary_start(p_run bigint, p_by text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  if not exists (select 1 from public.crm_import_batches b where b.run_id = p_run and b.kind = 'mail_interactions' and b.status = 'applied') then
    raise exception 'wa284: email history: write the summaries after the email lines (mail_interactions) are applied';
  end if;
  if exists (select 1 from public.crm_mail_scans s where s.run_id = p_run and s.phase not in ('done', 'summaries', 'summarised')) then
    raise exception 'wa284: email history: the scan of run % has not finished', p_run;
  end if;
  update public.crm_mail_scans s set phase = 'summaries', step_at = null, finished_at = null where s.run_id = p_run;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_mail_scans', p_run::text, 'summarise', null, 'Email history summaries started', coalesce(nullif(p_by, ''), 'mail-history'));
  return jsonb_build_object('todo', (select count(*) from public.wa292_summary_todo(p_run, 100000)));
end $function$;
comment on function public.wa292_summary_start(bigint, text) is 'wave292: starts (or restarts) the summary pass of a run: needs mail_interactions applied and the scan finished; puts the run''s scans at phase summaries; logged. Returns how many contacts wait for a summary. The service role only.';

create or replace function public.wa292_summary_todo(p_run bigint, p_limit int default 20)
returns setof bigint language sql stable security definer set search_path to '' as $function$
  select q.contact_id from (
    select distinct i.contact_id from public.crm_interactions i join public.crm_contacts c on c.id = i.contact_id and c.merged_into is null
     where i.source = 'gmail' and i.meta ->> 'run' = p_run::text) q
   where not exists (select 1 from public.crm_email_relationship r where r.contact_id = q.contact_id and r.summary is not null and not r.stale)
   order by q.contact_id limit greatest(coalesce(p_limit, 20), 1)
$function$;
comment on function public.wa292_summary_todo(bigint, int) is 'wave292: the next contacts of a run (with email lines from it) whose summary is missing or stale, so the pass resumes where it stopped and never pays twice. Hub ids only. The service role only.';

create or replace function public.wa292_summary_done(p_run bigint)
returns void language sql security definer set search_path to '' as $function$
  update public.crm_mail_scans s set phase = 'summarised', finished_at = now(), step_at = null where s.run_id = p_run and s.phase = 'summaries'
$function$;
comment on function public.wa292_summary_done(bigint) is 'wave292: marks a run''s summary pass finished (phase summarised). The service role only.';

create or replace function public.wa292_summary_active()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(distinct s.run_id), '[]'::jsonb) from public.crm_mail_scans s join public.crm_import_runs r on r.id = s.run_id
   where r.purged_at is null and not s.paused and s.phase = 'summaries'
     and (s.step_at is null or s.step_at < now() - make_interval(secs => coalesce((public.wa284_cfg('mail_history_step_seconds') ->> 'lease')::int, 180)))
$function$;
comment on function public.wa292_summary_active() is 'wave292: the runs whose summary pass the pump should continue: phase summaries, not paused, lease free or run out. The service role only.';

-- ============================================================================================ 12. the live functions, by exact anchor
-- Each block skips when its wave292 text is already there; otherwise every anchor must appear exactly once, or the file stops. Inserted text is
-- joined with chr(10), so build/data/wa292_undo.sql can take exactly the same text back out.
do $wa292$
declare v text; a text; n text; a2 text; n2 text; nl text := chr(10);
  function_moved text := 'wave292: a live function moved: ';
begin
  -- wa284_write: the mail kinds go to wa292_write
  v := pg_get_functiondef('public.wa284_write(bigint,boolean)'::regprocedure);
  if position('wa292_write' in v) = 0 then
    a := $x$when 'form_answers' then public.wa284_w_form_answers(p_batch, b.run_id, p_rehearse)$x$;
    n := a || nl || $x$    else public.wa292_write(p_batch, b.kind, b.run_id, p_rehearse)$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception '%wa284_write', function_moved; end if;
    execute replace(v, a, n);
  end if;
  -- wa284_basis
  v := pg_get_functiondef('public.wa284_basis(bigint)'::regprocedure);
  if position('wa292_basis' in v) = 0 then
    a := $x$select * into b from public.crm_import_batches x where x.id = p_batch;$x$;
    n := a || nl || $x$  if b.kind like 'mail\_%' then return public.wa292_basis(p_batch); end if;$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception '%wa284_basis', function_moved; end if;
    execute replace(v, a, n);
  end if;
  -- wa284_new_batch: the five mail kinds, on an email-history run only (and the Keela kinds never on one)
  v := pg_get_functiondef('public.wa284_new_batch(bigint,text)'::regprocedure);
  if position('mail_interactions' in v) = 0 then
    a := $x$'participation', 'form_answers') then raise exception 'wa284: unknown batch kind %'$x$;
    n := $x$'participation', 'form_answers', 'mail_optouts', 'mail_orgs', 'mail_people', 'mail_enrich', 'mail_interactions')$x$ || nl
         || $x$     or (p_kind like 'mail\_%') is distinct from exists (select 1 from public.crm_import_runs r where r.id = p_run and r.source = 'email_history') then raise exception 'wa284: unknown batch kind %'$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception '%wa284_new_batch', function_moved; end if;
    execute replace(v, a, n);
  end if;
  -- wa284_undo: mail_optouts never; bottom up; a mail_people undo quarantines its untouched contacts
  v := pg_get_functiondef('public.wa284_undo(bigint,text)'::regprocedure);
  if position('wa292_undo_check' in v) = 0 then
    a := $x$if b.kind in ('optouts', 'consent') then$x$;
    n := $x$if b.kind like 'mail\_%' then perform public.wa292_undo_check(p_batch); end if;$x$ || nl || $x$  if b.kind in ('optouts', 'consent', 'mail_optouts') then$x$;
    a2 := $x$update public.crm_import_batches x set status = 'undone', report = v_report,$x$;
    n2 := $x$if b.kind like 'mail\_%' then v_report := public.wa292_undo_after(p_batch, v_report); end if;$x$ || nl || '  ' || a2;
    if length(v) - length(replace(v, a, '')) <> length(a) or length(v) - length(replace(v, a2, '')) <> length(a2) then raise exception '%wa284_undo', function_moved; end if;
    execute replace(replace(v, a, n), a2, n2);
  end if;
  -- wa284_unrow: a type row is removed when unchanged
  v := pg_get_functiondef('public.wa284_unrow(text,text,jsonb)'::regprocedure);
  if position('crm_email_relationship' in v) = 0 then
    a := $x$elsif p_table = 'crm_contact_orgs' then$x$;
    n := $x$elsif p_table = 'crm_email_relationship' then$x$ || nl
         || $x$    delete from public.crm_email_relationship t where t.id = p_row::bigint and (to_jsonb(t) - ts) = (p_new - ts);$x$ || nl || '  ' || a;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception '%wa284_unrow', function_moved; end if;
    execute replace(v, a, n);
  end if;
  -- wa284_set and wa284_upd also write crm_email_relationship
  a := $x$if p_table not in ('crm_contacts', 'wa_partners') then$x$;
  n := $x$if p_table not in ('crm_contacts', 'wa_partners', 'crm_email_relationship') then$x$;
  v := pg_get_functiondef('public.wa284_set(text,bigint,text,jsonb)'::regprocedure);
  if position('crm_email_relationship' in v) = 0 then
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception '%wa284_set', function_moved; end if;
    execute replace(v, a, n);
  end if;
  v := pg_get_functiondef('public.wa284_upd(bigint,text,bigint,text,jsonb)'::regprocedure);
  if position('crm_email_relationship' in v) = 0 then
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception '%wa284_upd', function_moved; end if;
    execute replace(v, a, n);
  end if;
  -- wa284_purge: the mail staging too
  v := pg_get_functiondef('public.wa284_purge(bigint)'::regprocedure);
  if position('wa292_purge' in v) = 0 then
    a := $x$delete from import_stage.rows x where x.run_id = p_run;$x$;
    n := $x$perform public.wa292_purge(p_run);$x$ || nl || '  ' || a;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception '%wa284_purge', function_moved; end if;
    execute replace(v, a, n);
  end if;
  -- crm_email_first_contact: an outgoing WA email they answered in the same thread means they had an email from WA (6.3, B1, H8)
  v := pg_get_functiondef('public.crm_email_first_contact(bigint)'::regprocedure);
  if position('gmail' in v) = 0 then
    a := $x$if v_open ~ '^\d{4}-\d{2}-\d{2}$' and v_open >= to_char(current_date - interval '12 months', 'YYYY-MM-DD') then return false; end if;$x$;
    n := a || nl || $x$  if exists (select 1 from public.crm_interactions o join public.crm_interactions i on i.contact_id = o.contact_id and i.source = 'gmail' and i.direction = 'in' and i.meta->>'thread' = o.meta->>'thread' where o.contact_id = p_contact and o.source = 'gmail' and o.direction = 'out') then return false; end if;$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception '%crm_email_first_contact', function_moved; end if;
    execute replace(v, a, n);
  end if;
  -- crm_email_permission: general inboxes and contacts waiting for review are not for bulk email (6.3)
  v := pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure);
  if position('not for bulk email' in v) = 0 then
    a := $x$x.volunteer_id, x.do_not_contact$x$;
    n := $x$x.volunteer_id, x.do_not_contact, x.tags$x$;
    a2 := $x$  if c.do_not_contact then return query select false, 'do not contact'::text, null::date, c.em::text, c.st::text; return; end if;$x$;
    n2 := a2 || nl || $x$  if p_kind in ('volunteer', 'newsletter', 'fundraising') and coalesce(c.tags, '{}'::text[]) && array['general inbox', 'email history: review'] then return query select false, 'not for bulk email'::text, null::date, c.em::text, c.st::text; return; end if;$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) or length(v) - length(replace(v, a2, '')) <> length(a2) then raise exception '%crm_email_permission', function_moved; end if;
    execute replace(replace(v, a2, n2), a, n);
  end if;
  -- crm_merge_contacts: the type and summary row is kept or moved, and marked stale
  v := pg_get_functiondef('public.crm_merge_contacts(bigint,bigint)'::regprocedure);
  if position('crm_email_relationship' in v) = 0 then
    a := $x$  if exists (select 1 from public.crm_contact_private x where x.contact_id = p_keep) then$x$;
    n := $x$  if exists (select 1 from public.crm_email_relationship x where x.contact_id = p_keep) then delete from public.crm_email_relationship where contact_id = p_drop; else update public.crm_email_relationship set contact_id = p_keep where contact_id = p_drop; end if; update public.crm_email_relationship set stale = true where contact_id = p_keep;$x$ || nl || a;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception '%crm_merge_contacts', function_moved; end if;
    execute replace(v, a, n);
  end if;
end $wa292$;
comment on function public.crm_email_permission(bigint, text) is 'The CASL rule for one contact and one kind of message (wave154; the volunteer kind wave155b). transactional/test: any working address. volunteer: any working address that has not unsubscribed (Steel, 27/09/26). newsletter/fundraising (wave282, Steel''s rule of 5 Nov 2026): any working address that has not unsubscribed; the basis is express consent or implied consent (within two years of a gift or a serving) when there is one, otherwise not unsubscribed (WA rule of 5 Nov 2026). Bounced and complained get nothing; since wave281 a do-not-contact person gets nothing either, transactional included (basis do not contact). Since wave292 a contact tagged general inbox or email history: review gets no volunteer, newsletter or fundraising email (basis not for bulk email).';
comment on function public.crm_email_first_contact(bigint) is 'wave282: true when a person would get their first email from Welfare Avenue: crm_email_permission allows a newsletter with the basis exactly not unsubscribed (WA rule of 5 Nov 2026) (no express and no valid implied consent), they have no crm_email_sends row that is not a test and was sent, delivered, opened or clicked, and they have not opened a Keela newsletter in the last 12 months (legacy_refs keela email_marketing last_opened, read only when it is YYYY-MM-DD). Since wave292 not when the email history holds an outgoing WA email to them in a thread where they also wrote (a gmail row out and a gmail row in with the same meta thread). Null for anyone who is not staff (is_wa_staff), the service role included; mail-send calls it as the signed-in person.';

-- ============================================================================================ 13. grants: every wa292_ function the service role's only
do $wa292$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'wa292\_%' or p.proname in ('crm_insight_input', 'crm_insight_save')) loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not in ('wa292_suppress_check', 'wa292_suppress_on_delete', 'wa292_gmail_cleanup') then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $wa292$;

-- ============================================================================================ 14. the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave292', 'wave292', null,
       'The email history batches: five mail batch kinds and their writers on the Import page, crm_email_relationship and its view, the suppression triggers, two restrictive policies on crm_interactions, wa_partners.domain and address, the not-for-bulk-email and first-contact clauses, the merge and delete hooks, and the summary pass functions (crm_insight_input, crm_insight_save).', 'wave292'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave292' and field = 'wave292');
