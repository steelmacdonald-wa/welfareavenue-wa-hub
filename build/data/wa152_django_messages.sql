-- Wave 152 (27/09/26): the old website's contact-form messages (Django ContactForm: email, name, subject, content; no date)
-- into the CRM. Staged in public.wa_stage_django_messages (legacy_id, payload) from the admin's change pages.
-- The site saved most messages several times over (582 rows, 236 distinct messages), so one interaction per distinct
-- sender + subject + text; a handful of bot messages (gibberish, marketing) stay out. The form never recorded a date, so the
-- messages carry occurred_at 2000-01-01 and meta.undated = true; the CRM shows "date not recorded" and keeps them at the end
-- of the timeline. Senders not yet in the CRM join it as supporters from the website (no email permission recorded).
begin;

create temp table _m on commit drop as
with m as (select legacy_id, lower(btrim(payload->>'email')) em, nullif(btrim(payload->>'name'), '') nm, nullif(btrim(payload->>'subject'), '') sj, nullif(btrim(payload->>'content'), '') ct
           from public.wa_stage_django_messages),
k as (select *, md5(coalesce(em, '') || '|' || coalesce(sj, '') || '|' || regexp_replace(coalesce(ct, ''), '\s+', ' ', 'g')) key,
  ((nm ~ '^[A-Za-z]{5,} [A-Za-z]{5,}$' and sj ~ '^[A-Za-z]{10,}$' and ct ~ '^[A-Za-z]{10,}$')
   or ct ~* 'seo\M|backlink|traffic to your website|keywords|rank(ing)? on google|crypto|bitcoin|casino|dominatingkeywords|google maps ranking|web design services|lead generation|https?://[^ ]*(bit\.ly|tinyurl|t\.me)'
   or em ~* 'dominatingkeywords|\.ru$|\.xyz$') spam from m)
select key, min(legacy_id) first_id, array_agg(legacy_id order by legacy_id) ids, count(*) n, min(em) em, min(nm) nm, min(sj) sj, min(ct) ct, bool_or(spam) spam
from k where em ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]+$' group by key;

-- 1. senders the CRM does not have yet
create temp table _new on commit drop as
select distinct on (em) em, nm, first_id from _m where not spam and not exists (select 1 from crm_contacts c, unnest(c.emails) e where c.merged_into is null and lower(btrim(e)) = _m.em)
order by em, first_id;

insert into crm_contacts (full_name, first_name, last_name, emails, phones, kinds, tags, source, legacy_refs, email_status, email_consent, created_by, updated_by)
select coalesce(nm, '(no name)'), split_part(coalesce(nm, ''), ' ', 1), nullif(btrim(substr(coalesce(nm, ''), length(split_part(coalesce(nm, ''), ' ', 1)) + 1)), ''),
  array[em], '{}', array['supporter'], array['wrote to us'] || case when nm is null then array['no name'] else '{}' end, 'website',
  jsonb_build_object('django', jsonb_build_object('contact_form_id', first_id)), 'unknown', null, 'wa152_import', 'wa152_import'
from _new;

-- 2. one interaction per distinct message, on the sender's contact
insert into crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
select c.id, 'website_message', 'in', 'website', m.sj, m.ct, '2000-01-01T00:00:00Z', 'website', 'contactform:' || m.first_id,
  jsonb_build_object('undated', true, 'legacy_ids', to_jsonb(m.ids), 'times_submitted', m.n, 'sender_name', m.nm, 'sender_email', m.em),
  'wa152_import'
from _m m
join lateral (select c.id from crm_contacts c, unnest(c.emails) e where c.merged_into is null and lower(btrim(e)) = m.em order by (c.source = 'website') desc, c.id limit 1) c on true
where not m.spam and not exists (select 1 from crm_interactions x where x.source_ref = 'contactform:' || m.first_id);

-- 3. the audit trail
insert into change_log (entity_type, entity_id, field, new_value, changed_by)
select 'crm_interactions', 'import', 'website messages 27-09-26',
  (select count(*) from _m where not spam) || ' messages (' || (select sum(n) from _m) || ' submissions, ' || (select count(*) from _m where spam) || ' bot messages left out) for ' ||
  (select count(distinct em) from _m where not spam) || ' senders; ' || (select count(*) from _new) || ' senders added as supporters from the website', 'wa152_import';

select (select count(*) from _m) distinct_messages, (select sum(n) from _m) submissions, (select count(*) from _m where spam) spam,
  (select count(*) from _new) senders_added, (select count(*) from crm_interactions where kind = 'website_message') messages_in,
  (select count(distinct contact_id) from crm_interactions where kind = 'website_message') contacts_with_messages,
  (select count(*) from crm_contacts where source = 'website') website_contacts, (select count(*) from crm_contacts_v) contacts_now;

commit;
