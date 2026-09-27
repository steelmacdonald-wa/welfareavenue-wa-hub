-- Wave 152 (27/09/26): the old website's volunteering events become MTL volunteering's past events.
-- Steel: "You can probably add a lot of our past events given the volunteering events recorded in the old website".
-- Every Django volunteering event (site_events, kind volunteering, from the old site) gets a volunteer_events row (the 2026
-- Sundays already in the Hub are linked, not copied), the people who served go on its roster (Confirmed, their role), the
-- history rows point at the Hub event (volunteer_event_id) so the CRM counts each serving once, through the Hub roster.
-- Schema part (migration wa152_history_into_hub): the column, the index, the view. Data part: one transaction.

-- ---------- schema ----------
alter table public.crm_volunteer_history add column if not exists volunteer_event_id bigint references public.volunteer_events(id) on delete set null;
comment on column public.crm_volunteer_history.volunteer_event_id is 'The Hub''s volunteer event (volunteer_events) this sign-up belongs to, once the old website''s event was brought into MTL volunteering (wave 152); a serving with it set is counted through the Hub roster, not here.';
create index if not exists crm_vh_event_idx on public.crm_volunteer_history (volunteer_event_id);

create or replace view public.crm_contacts_v with (security_invoker = true) as
select c.id, c.full_name, c.first_name, c.last_name, c.emails, c.phones, c.primary_email, c.address, c.city, c.province, c.postal_code, c.country, c.language,
  c.kinds, c.tags, c.source, c.volunteer_id, c.member_id, c.auth_user_id, c.legacy_refs, c.email_status, c.email_consent, c.consent_source, c.consent_at,
  c.implied_consent_until, c.sms_opt_out, c.notes, c.owner_member_id, c.last_activity_at, c.merged_into, c.created_at, c.updated_at, c.created_by, c.updated_by,
  vp.roles as volunteer_roles, vp.tags as volunteer_tags, vp.organization as volunteer_organization, vp.last_applied, vp.needs_review as volunteer_needs_review,
  vp.quo_contact_id is not null as in_quo,
  coalesce(h.legacy_servings, 0::bigint) as legacy_servings, coalesce(h.legacy_hours, 0::numeric) as legacy_hours,
  coalesce(r.hub_servings, 0::bigint) as hub_servings, r.last_serving_on,
  coalesce(d.donation_total, 0::numeric) as donation_total, coalesce(d.donation_count, 0::bigint) as donation_count, d.last_donation_at,
  o.org_names
from public.crm_contacts c
left join public.volunteer_people vp on vp.id = c.volunteer_id
left join lateral (select count(*) filter (where x.attended and x.volunteer_event_id is null) as legacy_servings,
                          sum(x.hours) filter (where x.attended) as legacy_hours
                   from public.crm_volunteer_history x where x.contact_id = c.id) h on true
left join lateral (select count(*) as hub_servings, max(e.event_date) as last_serving_on
                   from public.event_roster er join public.volunteer_events e on e.id = er.event_id
                   where c.volunteer_id is not null and er.person_id = c.volunteer_id and er.status = 'Confirmed' and e.status = 'completed') r on true
left join lateral (select sum(x.amount) as donation_total, count(*) as donation_count, max(x.donated_at) as last_donation_at
                   from public.crm_donations x where x.contact_id = c.id) d on true
left join lateral (select array_agg(p.name order by co.is_primary desc, p.name) as org_names
                   from public.crm_contact_orgs co join public.wa_partners p on p.id = co.partner_id where co.contact_id = c.id) o on true
where c.merged_into is null;
comment on view public.crm_contacts_v is 'The live contacts (not merged) with their volunteer roles and tags, Hub servings (confirmed at completed events, the old website''s events included since wave 152), the old website''s servings not yet in the Hub and its recorded hours, gift totals and organization names. The CRM page reads this.';
revoke insert, update, delete on public.crm_contacts_v from anon, authenticated;
comment on column public.volunteer_events.kind is 'service (Sunday serving), drive, planning or outreach (tabling days from the old website).';

-- ---------- data ----------
begin;

-- 1. the old website's events not yet in the Hub (the 2026 Sundays already there were linked by day)
create temp table _ev on commit drop as
select s.id site_id, (s.legacy->>'django_id')::int django_id, s.title, (s.starts_at at time zone 'America/Toronto')::date d, s.location venue, s.city, s.meals_served, s.published,
  (select count(*) from crm_volunteer_history h where h.legacy_event_id = (s.legacy->>'django_id')::int) signups,
  (select count(*) from crm_volunteer_history h where h.legacy_event_id = (s.legacy->>'django_id')::int and h.attended) served
from site_events s where s.kind = 'volunteering' and s.legacy->>'django_kind' = 'VolunteeringEvents' and s.volunteer_event_id is null;

create temp table _new on commit drop as
select e.*,
  'WA-' || to_char(e.d, 'YY') || '-' || lpad((row_number() over (partition by extract(year from e.d) order by e.d, e.django_id))::text, 2, '0') code,
  case when e.d >= make_date(extract(year from e.d)::int, 11, 15) or e.d < make_date(extract(year from e.d)::int, 3, 15) then 'Winter'
       when e.d < make_date(extract(year from e.d)::int, 5, 25) then 'Spring'
       when e.d < make_date(extract(year from e.d)::int, 9, 1) then 'Summer' else 'Fall' end season,
  case when e.title ~* 'tabling' then 'outreach' else 'service' end kind,
  case when e.title ~* '^open to\s+everyone' then null else nullif(btrim(e.title), '') end hub_title,
  case when e.served = 0 and not e.published then 'cancelled' else 'completed' end status,
  'From the old website (event ' || e.django_id || ')' || case when e.venue is not null and e.venue <> '' then ' at ' || e.venue else '' end ||
    case when e.meals_served is not null then ' · ' || e.meals_served || ' meals served' else '' end ||
    case when e.served > 0 then ' · ' || e.served || ' of ' || e.signups || ' sign-ups served'
         when e.signups > 0 then ' · ' || e.signups || ' sign-ups; attendance was not recorded there' else ' · no sign-ups recorded there' end ||
    case when not e.published then ' · hidden on the site' else '' end notes
from _ev e;

insert into volunteer_events (code, event_date, season, location, notes, status, kind, title)
select n.code, n.d, n.season, coalesce(n.city, 'Montreal'), n.notes, n.status, n.kind, n.hub_title from _new n order by n.d, n.django_id;

create temp table _made on commit drop as
select n.*, v.id hub_id from _new n join volunteer_events v on v.code = n.code;

-- the run-sheet steps the trigger seeded are not for past events
delete from sop_event_steps where event_id in (select hub_id from _made);

-- 2. the links: the website event and the history rows point at the Hub event
update site_events s set volunteer_event_id = m.hub_id from _made m where m.site_id = s.id;
update crm_volunteer_history h set volunteer_event_id = s.volunteer_event_id
from site_events s where s.kind = 'volunteering' and (s.legacy->>'django_id')::int = h.legacy_event_id and s.volunteer_event_id is not null and h.volunteer_event_id is null;

-- 3. the rosters: everyone who served, in their role
insert into event_roster (event_id, person_id, person_name, role, status, sort, detail, confirmed_at)
select h.volunteer_event_id, h.volunteer_id, vp.full_name, h.position, 'Confirmed', 0,
  jsonb_strip_nulls(jsonb_build_object('source', 'old website', 'legacy_assignment_id', h.legacy_assignment_id, 'hours', h.hours,
    'email', c.legacy_refs->'django'->>'email', 'phone', c.legacy_refs->'django'->>'phone', 'address', c.legacy_refs->'django'->>'address')),
  h.event_at
from crm_volunteer_history h join crm_contacts c on c.id = h.contact_id join volunteer_people vp on vp.id = h.volunteer_id
join volunteer_events v on v.id = h.volunteer_event_id
where h.attended and h.volunteer_id is not null and v.id in (select hub_id from _made)
  and not exists (select 1 from event_roster r where r.event_id = h.volunteer_event_id and r.person_id = h.volunteer_id);

-- the roles they served in go on their volunteer record
update volunteer_people vp set roles = (select array_agg(distinct x) from unnest(coalesce(vp.roles, '{}') || s.roles) x)
from (select h.volunteer_id, array_agg(distinct h.position) roles from crm_volunteer_history h where h.attended and h.volunteer_id is not null and h.position is not null group by h.volunteer_id) s
where s.volunteer_id = vp.id and not (coalesce(vp.roles, '{}') @> s.roles);

-- 4. the audit trail
insert into change_log (entity_type, entity_id, field, new_value, changed_by)
select 'volunteer_events', 'import', 'old website events 27-09-26',
  (select count(*) from _made) || ' past events added (' || (select count(*) from _made where status = 'completed') || ' completed, ' || (select count(*) from _made where status = 'cancelled') || ' cancelled), ' ||
  (select count(*) from event_roster r where r.detail->>'source' = 'old website') || ' roster rows (who served), ' ||
  (select count(*) from crm_volunteer_history where volunteer_event_id is not null) || ' history rows linked', 'wa152_import';

select (select count(*) from _made) events_added, (select min(d) from _made) first_day, (select max(d) from _made) last_day,
  (select count(*) from _made where status = 'cancelled') cancelled, (select count(*) from _made where kind = 'outreach') outreach,
  (select count(*) from _made where hub_title is null) untitled_sundays,
  (select count(*) from event_roster r where r.detail->>'source' = 'old website') roster_rows,
  (select count(distinct person_id) from event_roster r where r.detail->>'source' = 'old website') people_on_rosters,
  (select count(*) from crm_volunteer_history where volunteer_event_id is not null) history_linked,
  (select count(*) from crm_volunteer_history where volunteer_event_id is null) history_unlinked,
  (select count(*) from site_events where kind = 'volunteering' and volunteer_event_id is null) site_unlinked,
  (select count(*) from sop_event_steps s where s.event_id in (select hub_id from _made)) steps_left,
  (select count(*) from volunteer_events) hub_events_now,
  (select sum(hub_servings) from crm_contacts_v) hub_servings_total, (select sum(legacy_servings) from crm_contacts_v) legacy_servings_total,
  (select jsonb_agg(jsonb_build_object('code', code, 'd', d, 'title', hub_title, 'kind', kind, 'status', status, 'served', served, 'notes', notes) order by d) from (select * from _made order by d limit 5) s) sample,
  (select jsonb_agg(jsonb_build_object('id', id, 'name', full_name, 'hub', hub_servings, 'legacy', legacy_servings, 'hours', legacy_hours, 'last', last_serving_on) order by hub_servings desc) from (select * from crm_contacts_v order by hub_servings desc limit 4) s) top;

commit;
