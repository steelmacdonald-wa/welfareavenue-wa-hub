-- Wave 152 (27/09/26): Possible duplicates looks at every email and phone a contact has, not only the first email.
-- The first cut compared primary_email (the first address) and phones as typed; imports add second addresses
-- (Keela, the old website's history) and phones come in every format, so pairs went unseen.
create or replace view public.crm_duplicates_v with (security_invoker = true) as
with live as (select id, emails, phones from public.crm_contacts where merged_into is null),
e as (select l.id, lower(btrim(x)) as e from live l, unnest(l.emails) x where btrim(x) <> ''),
p as (select l.id, x as phone, right(regexp_replace(x, '\D', '', 'g'), 10) as digits from live l, unnest(l.phones) x
      where length(regexp_replace(x, '\D', '', 'g')) >= 7),
d as (
  select a.id as contact_id, b.id as duplicate_id, 'email'::text as matched_on, a.e as value
  from e a join e b on b.e = a.e and a.id < b.id
  union
  select a.id, b.id, 'phone'::text, a.phone
  from p a join p b on b.digits = a.digits and a.id < b.id
)
select d.contact_id, d.duplicate_id, d.matched_on, d.value from d
where not exists (select 1 from public.crm_dupe_dismissals x where x.a_id = d.contact_id and x.b_id = d.duplicate_id);

comment on view public.crm_duplicates_v is 'Pairs of live contacts sharing an email (any of theirs, case ignored) or a phone (same digits, any format), less the pairs marked as different people. The CRM page''s Possible duplicates tab.';
revoke insert, update, delete on public.crm_duplicates_v from anon, authenticated;
