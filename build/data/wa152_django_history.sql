-- Wave 152 (27/09/26): the old website's volunteering history into the CRM.
-- Source: public.wa_stage_django_history, one row per Django VolunteeringEvents change page (event_id, payload jsonb:
-- {event:{id,title,datetime_0,datetime_1,location,city,hide_event,meals,end_time}, assignments:[{aid, position, volunteer_id,
-- volunteer_name, approved, confirmed, waitlisted, hours, attended, food_drop_off, details, details_html}]}), read from the
-- admin's inline rows (the site has no export with the attendance fields). Some events were posted twice; the latest row wins.
-- Run in one transaction (begin ... commit); the dry run ends with rollback.
begin;

-- 1. every sign-up, parsed: the volunteer's email / address / postal code / phone come from the inline's Details column
create temp table _h on commit drop as
with d as (select distinct on (event_id) * from public.wa_stage_django_history order by event_id, id desc),
a as (select d.event_id, d.payload->'event' ev, x from d, jsonb_array_elements(d.payload->'assignments') x),
p as (select a.*, regexp_split_to_array(regexp_replace(regexp_replace(coalesce(x->>'details_html', ''), '\s+', ' ', 'g'), '^.*?<p>|</p>.*$', '', 'g'), '\s*<br>\s*') parts from a)
select event_id, ev, x, (x->>'aid')::bigint aid, (x->>'volunteer_id')::bigint vid, nullif(btrim(x->>'volunteer_name'), '') vname,
  nullif(lower(btrim(parts[1])), '') em, nullif(nullif(btrim(parts[2]), ''), 'None') addr, nullif(nullif(btrim(parts[3]), ''), 'None') zip, nullif(nullif(btrim(parts[4]), ''), 'None') phone,
  case when length(regexp_replace(coalesce(parts[4], ''), '\D', '', 'g')) >= 7 then right(regexp_replace(parts[4], '\D', '', 'g'), 10) end ph,
  ((ev->>'datetime_0') || ' ' || coalesce(nullif(ev->>'datetime_1', ''), '12:00:00'))::timestamp at time zone 'America/Toronto' event_at,
  nullif(btrim(ev->>'title'), '') title, nullif(btrim(ev->>'location'), '') location, nullif(btrim(ev->>'city'), '') city,
  case lower(x->>'position') when 'leader' then 'team_leader' else lower(x->>'position') end position,
  coalesce((x->>'approved')::boolean, false) approved, lower(coalesce(x->>'confirmed', '')) = 'true' confirmed,
  coalesce((x->>'waitlisted')::boolean, false) waitlisted, coalesce((x->>'attended')::boolean, false) attended,
  nullif(btrim(x->>'hours'), '')::numeric hours
from p;

-- 2. one CRM contact per Django volunteer: by email, else by phone; when the two disagree, the contact whose name matches
--    the sign-up and who has a volunteer record wins (the other is the same person twice: the added email makes the pair show
--    under Possible duplicates)
create temp table _v on commit drop as
with v as (select vid, min(vname) vname, min(em) em, min(ph) ph, min(phone) phone, min(addr) addr, min(zip) zip, count(*) n,
             max(event_at) filter (where attended) last_att from _h group by vid),
c as (select v.*, cand.id cid, cand.volunteer_id, cand.how,
        (case when lower(regexp_replace(coalesce(cand.full_name, ''), '\s+', ' ', 'g')) = lower(regexp_replace(coalesce(v.vname, ''), '\s+', ' ', 'g')) then 2 else 0 end
         + case when cand.volunteer_id is not null then 1 else 0 end) score
      from v cross join lateral (
        select c.id, c.volunteer_id, c.full_name, 'email' how from crm_contacts c
         where c.merged_into is null and v.em is not null and exists (select 1 from unnest(c.emails) e where lower(btrim(e)) = v.em)
        union all
        select c.id, c.volunteer_id, c.full_name, 'phone' from crm_contacts c
         where c.merged_into is null and v.ph is not null and exists (select 1 from unnest(c.phones) p2 where right(regexp_replace(p2, '\D', '', 'g'), 10) = v.ph)
      ) cand)
select distinct on (vid) * from c order by vid, score desc, (how = 'email') desc, cid;

-- 3. the history (one row per sign-up; a second run adds nothing)
insert into crm_volunteer_history (contact_id, volunteer_id, source, legacy_assignment_id, legacy_event_id, legacy_volunteer_id, event_at, event_title, city, location,
                                   position, approved, confirmed, attended, hours, withdrawn, waitlisted)
select v.cid, v.volunteer_id, 'django', h.aid, h.event_id, h.vid, h.event_at, h.title, h.city, h.location,
       h.position, h.approved, h.confirmed, h.attended, h.hours, null, h.waitlisted
from _h h join _v v on v.vid = h.vid
on conflict (source, legacy_assignment_id) do nothing;

-- 4. the contacts: the Django reference, the email / phone / address the site had, the volunteer kind, the last time they served
create temp table _added on commit drop as
select c.id, v.volunteer_id,
  case when v.em is not null and not exists (select 1 from unnest(c.emails) e where lower(btrim(e)) = v.em) then v.em end add_email,
  case when v.phone is not null and v.ph is not null and not exists (select 1 from unnest(c.phones) p2 where right(regexp_replace(p2, '\D', '', 'g'), 10) = v.ph) then v.phone end add_phone
from crm_contacts c join _v v on v.cid = c.id;

update crm_contacts c set
  legacy_refs = coalesce(c.legacy_refs, '{}'::jsonb) || jsonb_build_object('django', jsonb_strip_nulls(jsonb_build_object('volunteer_id', v.vid, 'email', v.em, 'phone', v.phone, 'address', v.addr, 'postal_code', v.zip))),
  emails = case when a.add_email is not null then c.emails || a.add_email else c.emails end,
  phones = case when a.add_phone is not null then c.phones || a.add_phone else c.phones end,
  address = coalesce(nullif(c.address, ''), v.addr),
  postal_code = coalesce(nullif(c.postal_code, ''), v.zip),
  kinds = case when 'volunteer' = any (c.kinds) then c.kinds else array_append(array_remove(c.kinds, 'supporter'), 'volunteer') end,
  last_activity_at = greatest(c.last_activity_at, v.last_att),
  updated_by = 'wa152_import', updated_at = now()
from _v v join _added a on a.id = v.cid where v.cid = c.id;

-- the volunteer record follows (MTL volunteering and the CRM stay one record)
update volunteer_people vp set
  emails = case when a.add_email is not null and not exists (select 1 from unnest(vp.emails) e where lower(btrim(e)) = a.add_email) then vp.emails || a.add_email else vp.emails end,
  phones = case when a.add_phone is not null and not exists (select 1 from unnest(vp.phones) p2 where right(regexp_replace(p2, '\D', '', 'g'), 10) = right(regexp_replace(a.add_phone, '\D', '', 'g'), 10)) then vp.phones || a.add_phone else vp.phones end
from _added a where a.volunteer_id = vp.id and (a.add_email is not null or a.add_phone is not null);

-- 5. the four events the site hides (cancelled Sundays): kept, unpublished, on the standard poster the bucket already holds
insert into site_events (kind, slug, title, starts_at, ends_at, location, city, description, summary, meals_served, poster_url, gallery, published, legacy)
select 'volunteering', 'open-to-everyone-' || (ev->>'datetime_0'), ev->>'title',
  ((ev->>'datetime_0') || ' ' || coalesce(nullif(ev->>'datetime_1', ''), '12:00:00'))::timestamp at time zone 'America/Toronto',
  ((ev->>'datetime_0') || ' ' || coalesce(nullif(ev->>'end_time', ''), '14:30:00'))::timestamp at time zone 'America/Toronto',
  ev->>'location', ev->>'city', b.body, null, nullif(ev->>'meals', '')::int,
  'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/site-media/events/volunteering/event-logo.jpeg', '{}', false,
  jsonb_build_object('django_id', event_id, 'django_kind', 'VolunteeringEvents', 'hidden', true, 'poster', x.poster, 'images', '[]'::jsonb, 'spots', x.spots)
from (select distinct on (event_id) event_id, payload->'event' ev from public.wa_stage_django_history order by event_id, id desc) d
join (values
  (52, '/images/IMG_8967_6QZPrXR_WskykNN.jpeg', '{"driver_num":1,"cook_num":4,"servers_num":5,"dishwashers_num":1,"photographers_num":1}'::jsonb),
  (87, '/images/EVENT_LOGO_P7p4P9c.jpeg', '{"driver_num":2,"cook_num":5,"servers_num":5,"dishwashers_num":1,"photographers_num":1}'::jsonb),
  (95, '/images/EVENT_LOGO_j38TZw1_IADxImE.jpeg', '{"driver_num":1,"cook_num":4,"servers_num":5,"dishwashers_num":1,"photographers_num":1}'::jsonb),
  (102, '/images/EVENT_LOGO_j38TZw1_IADxImE_Y3LlaRc.jpeg', '{"driver_num":2,"cook_num":4,"servers_num":5,"dishwashers_num":1,"photographers_num":1}'::jsonb)
) x(id, poster, spots) on x.id = d.event_id
cross join lateral (select case d.event_id when 95 then E'Hey Future and Recurring Volunteers, This is our standard volunteering event! OPEN TO ALL! Please sign up for the position most suitable for you! We can''t wait to see you out there\U0001F49A\n\n--> Start time may vary between 10:00 A.M to 12:00 P.M <--\n\n(Itinerary with confirmed details will be sent to your email as event date approaches.)'
  else E'Hey Future and Recurring Volunteers, This is our standard volunteering event! OPEN TO ALL! Please sign up for the position most suitable for you! We can''t wait to see you out there\U0001F49A' end body) b
where not exists (select 1 from site_events s where (s.legacy->>'django_id')::int = d.event_id and s.legacy->>'django_kind' = 'VolunteeringEvents');

-- 6. the website's 2026 Sundays are the Hub's serving events: link them by day (one candidate, the live one first)
update site_events s set volunteer_event_id = m.eid
from (select s2.id sid,
        (select e.id from volunteer_events e where e.event_date = (s2.starts_at at time zone 'America/Toronto')::date and e.status <> 'cancelled' limit 1) live_eid,
        (select count(*) from volunteer_events e where e.event_date = (s2.starts_at at time zone 'America/Toronto')::date and e.status <> 'cancelled') n_live,
        (select e.id from volunteer_events e where e.event_date = (s2.starts_at at time zone 'America/Toronto')::date limit 1) any_eid,
        (select count(*) from volunteer_events e where e.event_date = (s2.starts_at at time zone 'America/Toronto')::date) n_any
      from site_events s2 where s2.kind = 'volunteering' and s2.volunteer_event_id is null) q
cross join lateral (select case when q.n_live = 1 then q.live_eid when q.n_live = 0 and q.n_any = 1 then q.any_eid end eid) m
where s.id = q.sid and m.eid is not null;

-- 7. the audit trail
insert into change_log (entity_type, entity_id, field, new_value, changed_by)
select 'crm_volunteer_history', 'import', 'django history 27-09-26',
  (select count(*) from crm_volunteer_history where source = 'django') || ' sign-ups at ' || (select count(distinct legacy_event_id) from crm_volunteer_history where source = 'django') || ' events for ' ||
  (select count(distinct contact_id) from crm_volunteer_history where source = 'django') || ' contacts; ' || (select count(*) from _added where add_email is not null) || ' emails and ' ||
  (select count(*) from _added where add_phone is not null) || ' phones added; 4 hidden events kept unpublished', 'wa152_import';

-- what happened
select (select count(*) from _h) parsed, (select count(*) from _v) volunteers, (select count(*) from _v where how = 'phone') by_phone,
  (select count(*) from crm_volunteer_history where source = 'django') history_rows, (select count(distinct contact_id) from crm_volunteer_history where source = 'django') contacts,
  (select count(*) from crm_volunteer_history where source = 'django' and attended) served, (select sum(hours) from crm_volunteer_history where source = 'django' and attended) hours,
  (select count(*) from _added where add_email is not null) emails_added, (select count(*) from _added where add_phone is not null) phones_added,
  (select count(*) from crm_contacts where legacy_refs ? 'django') with_django_ref, (select count(*) from crm_contacts where merged_into is null and 'volunteer' = any (kinds)) volunteers_now,
  (select count(*) from crm_contacts where merged_into is null and 'supporter' = any (kinds)) supporters_now, (select count(*) from crm_duplicates_v) dupe_pairs,
  (select count(*) from site_events where kind = 'volunteering') site_vol_events, (select count(*) from site_events where not published) unpublished,
  (select count(*) from site_events where volunteer_event_id is not null) linked_to_hub,
  (select count(*) from crm_contacts_v where legacy_servings > 0) contacts_with_servings, (select max(legacy_servings) from crm_contacts_v) most_servings;

rollback;
