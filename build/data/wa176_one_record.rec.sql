-- wa176_one_record (30/09/26): one record per person. The CRM contact holds the person (name, emails, phones, address,
-- notes, tags, organization); the Volunteer Manager keeps only what is about volunteering (roles, car, review, Quo link,
-- when they applied). volunteer_people stays as the name every page, function and edge function already uses, but it
-- is now a live view over the two, so there is nothing to copy and nothing to drift.
-- Steel (30/09/26): "I do want to make sure that changes in volunteer records are reflected in both the CRM and Volunteer
-- Manager. I need to ensure that we don't have redundant data and that changes can reflect both areas." His answers: one
-- shared record for everything across both apps (details, notes and tags), edited from either app.
-- Before: volunteer_people held the person and crm_sync_from_volunteer copied it into crm_contacts (one way; the CRM wrote
-- both). After: volunteer_profiles (the old table, renamed, same ids, so every roster row, text, account and letter keeps
-- its link) + crm_contacts (linked by crm_contacts.volunteer_id, as before).

set local wa.no_automations = 'on';   -- merging tags must not start tag automations

-- 1. every volunteer has a contact (the old sync makes one for any volunteer still without)
update public.volunteer_people vp set full_name = vp.full_name
 where not exists (select 1 from public.crm_contacts c where c.volunteer_id = vp.id and c.merged_into is null);

-- 2. the contact can hold a volunteer's organization (free text; partners stay in crm_contact_orgs)
alter table public.crm_contacts add column if not exists organization text;
comment on column public.crm_contacts.organization is 'wave176: the organization the person gave (free text, for example a school or employer), shared with the Volunteer Manager. Partners with a record are in crm_contact_orgs.';

-- 3. bring the volunteer's details into their contact: the volunteer record wins on name and address (it was the source),
--    emails, phones and tags are combined (volunteer first), notes are joined when they differ
update public.crm_contacts c set
  full_name = case when btrim(coalesce(vp.full_name, '')) <> '' then btrim(vp.full_name) else c.full_name end,
  first_name = case when btrim(coalesce(vp.full_name, '')) <> '' then nullif(split_part(btrim(vp.full_name), ' ', 1), '') else c.first_name end,
  last_name = case when btrim(coalesce(vp.full_name, '')) <> '' then nullif(btrim(substr(btrim(vp.full_name), length(split_part(btrim(vp.full_name), ' ', 1)) + 1)), '') else c.last_name end,
  emails = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(vp.emails, '{}') || coalesce(c.emails, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
  phones = coalesce((select array_agg(x order by ord) from (select distinct on (right(regexp_replace(x, '\D', '', 'g'), 10)) btrim(x) as x, ord from unnest(coalesce(vp.phones, '{}') || coalesce(c.phones, '{}')) with ordinality as t(x, ord) where regexp_replace(coalesce(x, ''), '\D', '', 'g') <> '' order by right(regexp_replace(x, '\D', '', 'g'), 10), ord) s), '{}'),
  address = coalesce(nullif(btrim(vp.address), ''), c.address),
  notes = case when coalesce(btrim(vp.notes), '') = '' then c.notes
               when coalesce(btrim(c.notes), '') = '' then vp.notes
               when position(btrim(vp.notes) in c.notes) > 0 then c.notes
               when position(btrim(c.notes) in vp.notes) > 0 then vp.notes
               else c.notes || E'\n\n' || vp.notes end,
  tags = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(vp.tags, '{}') || coalesce(c.tags, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
  organization = coalesce(nullif(btrim(vp.organization), ''), c.organization),
  kinds = case when 'volunteer' = any(c.kinds) then c.kinds else c.kinds || array['volunteer'] end,
  updated_by = 'wa176 one record'
from public.volunteer_people vp
where c.volunteer_id = vp.id and c.merged_into is null;

-- 4. the old table becomes the volunteering profile; the copy trigger goes
drop trigger if exists crm_sync_from_volunteer on public.volunteer_people;
drop function if exists public.crm_sync_from_volunteer();
alter table public.volunteer_people rename to volunteer_profiles;
comment on table public.volunteer_profiles is 'wave176: what is about volunteering for a person (roles, car, review flag and note, the Quo contact, when they applied and joined); the person themselves (name, emails, phones, address, notes, tags, organization) is their CRM contact (crm_contacts.volunteer_id = id). Same ids as the old volunteer_people, so roster rows, texts, accounts and letters keep their links. Read and write the person through the volunteer_people view. Staff only.';

-- 5. volunteer_people: the live view the whole Hub already uses (same columns, plus the contact's id)
create view public.volunteer_people as
  select p.id, c.full_name, c.emails, c.phones, p.roles, c.address, c.notes, p.needs_review, p.review_note, p.created_at,
         p.quo_contact_id, p.quo_synced_at, c.tags, c.organization, p.car_type, p.joined_note, p.last_applied, c.id as contact_id
    from public.volunteer_profiles p
    join public.crm_contacts c on c.volunteer_id = p.id and c.merged_into is null
   where current_user not in ('anon', 'authenticated') or public.is_wa_staff();
comment on view public.volunteer_people is 'wave176: the volunteer directory as one record per person: the volunteering profile (volunteer_profiles) joined to the person''s CRM contact. Reading and writing it reads and writes both (instead-of triggers): the name, emails, phones, address, notes, tags and organization are the contact''s, so the CRM and the Volunteer Manager always show the same. Staff only (functions and the service role read it too). contact_id is the CRM contact.';
revoke all on public.volunteer_people from public, anon;
grant select, insert, update, delete on public.volunteer_people to authenticated, service_role;

-- the view's writes
create or replace function public.wa176_vp_write()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare v_id bigint; v_cid bigint; v_name text; v_email text; v_who text;
begin
  -- a signed-in account must be on the team (the view is closed to anon; functions that write here check their own callers)
  if coalesce(auth.role(), '') = 'authenticated' and not public.is_wa_staff() then raise exception 'not allowed'; end if;
  v_who := coalesce(lower(auth.jwt() ->> 'email'), 'volunteer_manager');
  if tg_op = 'DELETE' then
    delete from public.volunteer_profiles where id = old.id;
    update public.crm_contacts set kinds = array_remove(kinds, 'volunteer'), updated_by = v_who where id = old.contact_id;
    return old;
  end if;
  v_name := btrim(coalesce(new.full_name, ''));
  if tg_op = 'INSERT' then
    v_id := coalesce(new.id, nextval('public.volunteer_people_id_seq'));
    insert into public.volunteer_profiles (id, roles, needs_review, review_note, created_at, quo_contact_id, quo_synced_at, car_type, joined_note, last_applied)
    values (v_id, coalesce(new.roles, '{}'), coalesce(new.needs_review, false), new.review_note, coalesce(new.created_at, now()), new.quo_contact_id, new.quo_synced_at, new.car_type, new.joined_note, new.last_applied);
    v_email := lower(nullif(btrim((coalesce(new.emails, '{}'::text[]))[1]), ''));
    -- someone already in the CRM (a donor, say) who now volunteers: their contact, not a second one
    if v_email is not null then
      select id into v_cid from public.crm_contacts where volunteer_id is null and merged_into is null and primary_email = v_email order by id limit 1;
    end if;
    if v_cid is not null then
      update public.crm_contacts c set
        volunteer_id = v_id,
        full_name = case when v_name <> '' then v_name else c.full_name end,
        first_name = case when v_name <> '' then nullif(split_part(v_name, ' ', 1), '') else c.first_name end,
        last_name = case when v_name <> '' then nullif(btrim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), '') else c.last_name end,
        emails = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(new.emails, '{}') || coalesce(c.emails, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
        phones = coalesce((select array_agg(x order by ord) from (select distinct on (right(regexp_replace(x, '\D', '', 'g'), 10)) btrim(x) as x, ord from unnest(coalesce(new.phones, '{}') || coalesce(c.phones, '{}')) with ordinality as t(x, ord) where regexp_replace(coalesce(x, ''), '\D', '', 'g') <> '' order by right(regexp_replace(x, '\D', '', 'g'), 10), ord) s), '{}'),
        address = coalesce(nullif(btrim(new.address), ''), c.address),
        notes = case when coalesce(btrim(new.notes), '') = '' then c.notes when coalesce(btrim(c.notes), '') = '' then new.notes else c.notes || E'\n\n' || new.notes end,
        tags = coalesce((select array_agg(distinct x) from unnest(coalesce(c.tags, '{}') || coalesce(new.tags, '{}')) x where btrim(coalesce(x, '')) <> ''), '{}'),
        organization = coalesce(nullif(btrim(new.organization), ''), c.organization),
        kinds = case when 'volunteer' = any(c.kinds) then c.kinds else c.kinds || array['volunteer'] end,
        updated_by = v_who
      where c.id = v_cid;
    else
      insert into public.crm_contacts (full_name, first_name, last_name, emails, phones, address, notes, tags, organization, kinds, source, volunteer_id, legacy_refs, created_by)
      values (case when v_name <> '' then v_name else '(no name)' end, nullif(split_part(v_name, ' ', 1), ''), nullif(btrim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), ''),
              coalesce(new.emails, '{}'), coalesce(new.phones, '{}'), new.address, new.notes, coalesce(new.tags, '{}'), new.organization,
              array['volunteer'], 'hub_volunteers', v_id, jsonb_build_object('volunteer_people_id', v_id), v_who)
      returning id into v_cid;
    end if;
    new.id := v_id; new.contact_id := v_cid;
    return new;
  end if;
  -- UPDATE: the volunteering part to the profile, the person to their contact (only when something about them changed)
  if new.id is distinct from old.id then raise exception 'a volunteer''s id does not change'; end if;
  update public.volunteer_profiles set roles = coalesce(new.roles, '{}'), needs_review = coalesce(new.needs_review, false), review_note = new.review_note,
         quo_contact_id = new.quo_contact_id, quo_synced_at = new.quo_synced_at, car_type = new.car_type, joined_note = new.joined_note, last_applied = new.last_applied
   where id = old.id
     and (roles, needs_review, review_note, quo_contact_id, quo_synced_at, car_type, joined_note, last_applied) is distinct from
         (coalesce(new.roles, '{}'), coalesce(new.needs_review, false), new.review_note, new.quo_contact_id, new.quo_synced_at, new.car_type, new.joined_note, new.last_applied);
  if (new.full_name, new.emails, new.phones, new.address, new.notes, new.tags, new.organization) is distinct from
     (old.full_name, old.emails, old.phones, old.address, old.notes, old.tags, old.organization) then
    update public.crm_contacts set
      full_name = case when v_name <> '' then v_name else full_name end,
      first_name = case when v_name <> '' and v_name is distinct from old.full_name then nullif(split_part(v_name, ' ', 1), '') else first_name end,
      last_name = case when v_name <> '' and v_name is distinct from old.full_name then nullif(btrim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), '') else last_name end,
      emails = coalesce(new.emails, '{}'), phones = coalesce(new.phones, '{}'), address = new.address, notes = new.notes,
      tags = coalesce(new.tags, '{}'), organization = new.organization, updated_by = v_who
    where id = old.contact_id;
  end if;
  return new;
end $$;
comment on function public.wa176_vp_write() is 'wave176: writes through the volunteer_people view: a new volunteer gets a profile and a contact (or the existing contact with their email, a donor who now volunteers); an edit goes to the profile (roles, car, review, Quo, applied) and to the contact (name, emails, phones, address, notes, tags, organization); deleting removes the profile and leaves the person in the CRM. Staff and the service role only.';
revoke all on function public.wa176_vp_write() from public, anon, authenticated;
create trigger volunteer_people_write instead of insert or update or delete on public.volunteer_people for each row execute function public.wa176_vp_write();

-- 6. merging two volunteers now merges the person once: the profiles here, the contacts through crm_merge_contacts
create or replace function public.volunteer_merge(p_keep bigint, p_drop bigint)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare k public.volunteer_profiles%rowtype; d public.volunteer_profiles%rowtype; moved int := 0; moved_msgs int := 0; kc bigint; dc bigint; cm jsonb; kname text; dname text;
begin
  if not public.is_wa_staff() then raise exception 'not allowed'; end if;
  if p_keep = p_drop then raise exception 'same person'; end if;
  select * into k from public.volunteer_profiles where id = p_keep; if not found then raise exception 'person % not found', p_keep; end if;
  select * into d from public.volunteer_profiles where id = p_drop; if not found then raise exception 'person % not found', p_drop; end if;
  select id, full_name into kc, kname from public.crm_contacts where volunteer_id = p_keep and merged_into is null;
  select id, full_name into dc, dname from public.crm_contacts where volunteer_id = p_drop and merged_into is null;
  update public.event_roster set person_id = p_keep where person_id = p_drop; get diagnostics moved = row_count;
  begin update public.quo_messages set person_id = p_keep where person_id = p_drop; get diagnostics moved_msgs = row_count; exception when undefined_table then moved_msgs := 0; end;
  update public.crm_volunteer_history set volunteer_id = p_keep where volunteer_id = p_drop;
  update public.volunteer_accounts set person_id = p_keep where person_id = p_drop;
  update public.volunteer_hour_letters set person_id = p_keep where person_id = p_drop;
  update public.volunteer_profiles set
    roles = coalesce((select array_agg(distinct x) from unnest(coalesce(k.roles, '{}'::text[]) || coalesce(d.roles, '{}'::text[])) x where x is not null and x <> ''), '{}'::text[]),
    car_type = coalesce(nullif(k.car_type, ''), d.car_type),
    quo_contact_id = coalesce(k.quo_contact_id, d.quo_contact_id),
    last_applied = greatest(k.last_applied, d.last_applied),
    joined_note = coalesce(nullif(k.joined_note, ''), d.joined_note),
    created_at = least(k.created_at, d.created_at),
    needs_review = false, review_note = null
  where id = p_keep;
  -- the person: the dropped volunteer's contact is merged into the kept one (unlinked first, so the CRM merge does not come back here)
  if dc is not null then
    update public.crm_contacts set volunteer_id = null where id = dc;
    if kc is not null and kc <> dc then
      perform set_config('wa.merge_from_volunteers', 'on', true);
      cm := public.crm_merge_contacts(kc, dc);
      perform set_config('wa.merge_from_volunteers', '', true);
    end if;
  end if;
  delete from public.volunteer_profiles where id = p_drop;
  begin
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_people', p_keep::text, 'merged', coalesce(dname, '?') || ' (#' || p_drop || ')', coalesce(kname, '?') || ' (+' || moved || ' roster rows)', coalesce(auth.jwt() ->> 'email', 'staff'));
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'moved', moved, 'moved_messages', moved_msgs, 'keep', p_keep, 'contacts', cm);
end $$;
comment on function public.volunteer_merge(bigint, bigint) is 'wave176: merges two volunteers into one: their roster rows, texts, history, accounts and letters move to the kept one, the volunteering profiles combine (roles, car, Quo, applied), and the dropped person''s CRM contact is merged into the kept contact (crm_merge_contacts: emails, phones, tags, notes, gifts, history). Staff; logged.';

-- the CRM merge accepts a merge that comes from the Volunteer Manager (staff without the CRM page merging two volunteers)
do $$ declare d text; begin
  d := pg_get_functiondef('public.crm_merge_contacts(bigint, bigint)'::regprocedure);
  d := replace(d, $x$if not (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) then raise exception 'not allowed'; end if;$x$,
                  $x$if not (public.is_wa_staff() and (coalesce(public.wa_page_ok('crm'), true) or coalesce(current_setting('wa.merge_from_volunteers', true), '') = 'on')) then raise exception 'not allowed'; end if;$x$);
  if position('wa.merge_from_volunteers' in d) = 0 then raise exception 'crm_merge_contacts was not patched'; end if;
  execute d;
end $$;

-- 7. the profile no longer holds the person (the view reads them from the contact)
do $$ declare v_def text; v_opts text[]; begin
  -- crm_contacts_v read volunteer_people; now it reads the view by that name, the profile columns stay as they were
  select pg_get_viewdef('public.crm_contacts_v'::regclass, true), reloptions into v_def, v_opts from pg_class where oid = 'public.crm_contacts_v'::regclass;
  v_def := replace(v_def, 'volunteer_profiles', 'volunteer_people');
  execute 'create or replace view public.crm_contacts_v as ' || v_def;
  if v_opts is not null then execute 'alter view public.crm_contacts_v set (' || array_to_string(v_opts, ', ') || ')'; end if;
end $$;
alter table public.volunteer_profiles drop column full_name, drop column emails, drop column phones, drop column address, drop column notes, drop column tags, drop column organization;

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260930170000', 'wa176_one_record', array[$m$set local wa.no_automations = 'on';   -- merging tags must not start tag automations

-- 1. every volunteer has a contact (the old sync makes one for any volunteer still without)
update public.volunteer_people vp set full_name = vp.full_name
 where not exists (select 1 from public.crm_contacts c where c.volunteer_id = vp.id and c.merged_into is null)$m$,$m$alter table public.crm_contacts add column if not exists organization text$m$,$m$comment on column public.crm_contacts.organization is 'wave176: the organization the person gave (free text, for example a school or employer), shared with the Volunteer Manager. Partners with a record are in crm_contact_orgs.'$m$,$m$update public.crm_contacts c set
  full_name = case when btrim(coalesce(vp.full_name, '')) <> '' then btrim(vp.full_name) else c.full_name end,
  first_name = case when btrim(coalesce(vp.full_name, '')) <> '' then nullif(split_part(btrim(vp.full_name), ' ', 1), '') else c.first_name end,
  last_name = case when btrim(coalesce(vp.full_name, '')) <> '' then nullif(btrim(substr(btrim(vp.full_name), length(split_part(btrim(vp.full_name), ' ', 1)) + 1)), '') else c.last_name end,
  emails = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(vp.emails, '{}') || coalesce(c.emails, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
  phones = coalesce((select array_agg(x order by ord) from (select distinct on (right(regexp_replace(x, '\D', '', 'g'), 10)) btrim(x) as x, ord from unnest(coalesce(vp.phones, '{}') || coalesce(c.phones, '{}')) with ordinality as t(x, ord) where regexp_replace(coalesce(x, ''), '\D', '', 'g') <> '' order by right(regexp_replace(x, '\D', '', 'g'), 10), ord) s), '{}'),
  address = coalesce(nullif(btrim(vp.address), ''), c.address),
  notes = case when coalesce(btrim(vp.notes), '') = '' then c.notes
               when coalesce(btrim(c.notes), '') = '' then vp.notes
               when position(btrim(vp.notes) in c.notes) > 0 then c.notes
               when position(btrim(c.notes) in vp.notes) > 0 then vp.notes
               else c.notes || E'\n\n' || vp.notes end,
  tags = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(vp.tags, '{}') || coalesce(c.tags, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
  organization = coalesce(nullif(btrim(vp.organization), ''), c.organization),
  kinds = case when 'volunteer' = any(c.kinds) then c.kinds else c.kinds || array['volunteer'] end,
  updated_by = 'wa176 one record'
from public.volunteer_people vp
where c.volunteer_id = vp.id and c.merged_into is null$m$,$m$drop trigger if exists crm_sync_from_volunteer on public.volunteer_people$m$,$m$drop function if exists public.crm_sync_from_volunteer()$m$,$m$alter table public.volunteer_people rename to volunteer_profiles$m$,$m$comment on table public.volunteer_profiles is 'wave176: what is about volunteering for a person (roles, car, review flag and note, the Quo contact, when they applied and joined); the person themselves (name, emails, phones, address, notes, tags, organization) is their CRM contact (crm_contacts.volunteer_id = id). Same ids as the old volunteer_people, so roster rows, texts, accounts and letters keep their links. Read and write the person through the volunteer_people view. Staff only.'$m$,$m$create view public.volunteer_people as
  select p.id, c.full_name, c.emails, c.phones, p.roles, c.address, c.notes, p.needs_review, p.review_note, p.created_at,
         p.quo_contact_id, p.quo_synced_at, c.tags, c.organization, p.car_type, p.joined_note, p.last_applied, c.id as contact_id
    from public.volunteer_profiles p
    join public.crm_contacts c on c.volunteer_id = p.id and c.merged_into is null
   where current_user not in ('anon', 'authenticated') or public.is_wa_staff()$m$,$m$comment on view public.volunteer_people is 'wave176: the volunteer directory as one record per person: the volunteering profile (volunteer_profiles) joined to the person''s CRM contact. Reading and writing it reads and writes both (instead-of triggers): the name, emails, phones, address, notes, tags and organization are the contact''s, so the CRM and the Volunteer Manager always show the same. Staff only (functions and the service role read it too). contact_id is the CRM contact.'$m$,$m$revoke all on public.volunteer_people from public, anon$m$,$m$grant select, insert, update, delete on public.volunteer_people to authenticated, service_role$m$,$m$create or replace function public.wa176_vp_write()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare v_id bigint; v_cid bigint; v_name text; v_email text; v_who text;
begin
  -- a signed-in account must be on the team (the view is closed to anon; functions that write here check their own callers)
  if coalesce(auth.role(), '') = 'authenticated' and not public.is_wa_staff() then raise exception 'not allowed'; end if;
  v_who := coalesce(lower(auth.jwt() ->> 'email'), 'volunteer_manager');
  if tg_op = 'DELETE' then
    delete from public.volunteer_profiles where id = old.id;
    update public.crm_contacts set kinds = array_remove(kinds, 'volunteer'), updated_by = v_who where id = old.contact_id;
    return old;
  end if;
  v_name := btrim(coalesce(new.full_name, ''));
  if tg_op = 'INSERT' then
    v_id := coalesce(new.id, nextval('public.volunteer_people_id_seq'));
    insert into public.volunteer_profiles (id, roles, needs_review, review_note, created_at, quo_contact_id, quo_synced_at, car_type, joined_note, last_applied)
    values (v_id, coalesce(new.roles, '{}'), coalesce(new.needs_review, false), new.review_note, coalesce(new.created_at, now()), new.quo_contact_id, new.quo_synced_at, new.car_type, new.joined_note, new.last_applied);
    v_email := lower(nullif(btrim((coalesce(new.emails, '{}'::text[]))[1]), ''));
    -- someone already in the CRM (a donor, say) who now volunteers: their contact, not a second one
    if v_email is not null then
      select id into v_cid from public.crm_contacts where volunteer_id is null and merged_into is null and primary_email = v_email order by id limit 1;
    end if;
    if v_cid is not null then
      update public.crm_contacts c set
        volunteer_id = v_id,
        full_name = case when v_name <> '' then v_name else c.full_name end,
        first_name = case when v_name <> '' then nullif(split_part(v_name, ' ', 1), '') else c.first_name end,
        last_name = case when v_name <> '' then nullif(btrim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), '') else c.last_name end,
        emails = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(new.emails, '{}') || coalesce(c.emails, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
        phones = coalesce((select array_agg(x order by ord) from (select distinct on (right(regexp_replace(x, '\D', '', 'g'), 10)) btrim(x) as x, ord from unnest(coalesce(new.phones, '{}') || coalesce(c.phones, '{}')) with ordinality as t(x, ord) where regexp_replace(coalesce(x, ''), '\D', '', 'g') <> '' order by right(regexp_replace(x, '\D', '', 'g'), 10), ord) s), '{}'),
        address = coalesce(nullif(btrim(new.address), ''), c.address),
        notes = case when coalesce(btrim(new.notes), '') = '' then c.notes when coalesce(btrim(c.notes), '') = '' then new.notes else c.notes || E'\n\n' || new.notes end,
        tags = coalesce((select array_agg(distinct x) from unnest(coalesce(c.tags, '{}') || coalesce(new.tags, '{}')) x where btrim(coalesce(x, '')) <> ''), '{}'),
        organization = coalesce(nullif(btrim(new.organization), ''), c.organization),
        kinds = case when 'volunteer' = any(c.kinds) then c.kinds else c.kinds || array['volunteer'] end,
        updated_by = v_who
      where c.id = v_cid;
    else
      insert into public.crm_contacts (full_name, first_name, last_name, emails, phones, address, notes, tags, organization, kinds, source, volunteer_id, legacy_refs, created_by)
      values (case when v_name <> '' then v_name else '(no name)' end, nullif(split_part(v_name, ' ', 1), ''), nullif(btrim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), ''),
              coalesce(new.emails, '{}'), coalesce(new.phones, '{}'), new.address, new.notes, coalesce(new.tags, '{}'), new.organization,
              array['volunteer'], 'hub_volunteers', v_id, jsonb_build_object('volunteer_people_id', v_id), v_who)
      returning id into v_cid;
    end if;
    new.id := v_id; new.contact_id := v_cid;
    return new;
  end if;
  -- UPDATE: the volunteering part to the profile, the person to their contact (only when something about them changed)
  if new.id is distinct from old.id then raise exception 'a volunteer''s id does not change'; end if;
  update public.volunteer_profiles set roles = coalesce(new.roles, '{}'), needs_review = coalesce(new.needs_review, false), review_note = new.review_note,
         quo_contact_id = new.quo_contact_id, quo_synced_at = new.quo_synced_at, car_type = new.car_type, joined_note = new.joined_note, last_applied = new.last_applied
   where id = old.id
     and (roles, needs_review, review_note, quo_contact_id, quo_synced_at, car_type, joined_note, last_applied) is distinct from
         (coalesce(new.roles, '{}'), coalesce(new.needs_review, false), new.review_note, new.quo_contact_id, new.quo_synced_at, new.car_type, new.joined_note, new.last_applied);
  if (new.full_name, new.emails, new.phones, new.address, new.notes, new.tags, new.organization) is distinct from
     (old.full_name, old.emails, old.phones, old.address, old.notes, old.tags, old.organization) then
    update public.crm_contacts set
      full_name = case when v_name <> '' then v_name else full_name end,
      first_name = case when v_name <> '' and v_name is distinct from old.full_name then nullif(split_part(v_name, ' ', 1), '') else first_name end,
      last_name = case when v_name <> '' and v_name is distinct from old.full_name then nullif(btrim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), '') else last_name end,
      emails = coalesce(new.emails, '{}'), phones = coalesce(new.phones, '{}'), address = new.address, notes = new.notes,
      tags = coalesce(new.tags, '{}'), organization = new.organization, updated_by = v_who
    where id = old.contact_id;
  end if;
  return new;
end $$$m$,$m$comment on function public.wa176_vp_write() is 'wave176: writes through the volunteer_people view: a new volunteer gets a profile and a contact (or the existing contact with their email, a donor who now volunteers); an edit goes to the profile (roles, car, review, Quo, applied) and to the contact (name, emails, phones, address, notes, tags, organization); deleting removes the profile and leaves the person in the CRM. Staff and the service role only.'$m$,$m$revoke all on function public.wa176_vp_write() from public, anon, authenticated$m$,$m$create trigger volunteer_people_write instead of insert or update or delete on public.volunteer_people for each row execute function public.wa176_vp_write()$m$,$m$create or replace function public.volunteer_merge(p_keep bigint, p_drop bigint)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare k public.volunteer_profiles%rowtype; d public.volunteer_profiles%rowtype; moved int := 0; moved_msgs int := 0; kc bigint; dc bigint; cm jsonb; kname text; dname text;
begin
  if not public.is_wa_staff() then raise exception 'not allowed'; end if;
  if p_keep = p_drop then raise exception 'same person'; end if;
  select * into k from public.volunteer_profiles where id = p_keep; if not found then raise exception 'person % not found', p_keep; end if;
  select * into d from public.volunteer_profiles where id = p_drop; if not found then raise exception 'person % not found', p_drop; end if;
  select id, full_name into kc, kname from public.crm_contacts where volunteer_id = p_keep and merged_into is null;
  select id, full_name into dc, dname from public.crm_contacts where volunteer_id = p_drop and merged_into is null;
  update public.event_roster set person_id = p_keep where person_id = p_drop; get diagnostics moved = row_count;
  begin update public.quo_messages set person_id = p_keep where person_id = p_drop; get diagnostics moved_msgs = row_count; exception when undefined_table then moved_msgs := 0; end;
  update public.crm_volunteer_history set volunteer_id = p_keep where volunteer_id = p_drop;
  update public.volunteer_accounts set person_id = p_keep where person_id = p_drop;
  update public.volunteer_hour_letters set person_id = p_keep where person_id = p_drop;
  update public.volunteer_profiles set
    roles = coalesce((select array_agg(distinct x) from unnest(coalesce(k.roles, '{}'::text[]) || coalesce(d.roles, '{}'::text[])) x where x is not null and x <> ''), '{}'::text[]),
    car_type = coalesce(nullif(k.car_type, ''), d.car_type),
    quo_contact_id = coalesce(k.quo_contact_id, d.quo_contact_id),
    last_applied = greatest(k.last_applied, d.last_applied),
    joined_note = coalesce(nullif(k.joined_note, ''), d.joined_note),
    created_at = least(k.created_at, d.created_at),
    needs_review = false, review_note = null
  where id = p_keep;
  -- the person: the dropped volunteer's contact is merged into the kept one (unlinked first, so the CRM merge does not come back here)
  if dc is not null then
    update public.crm_contacts set volunteer_id = null where id = dc;
    if kc is not null and kc <> dc then
      perform set_config('wa.merge_from_volunteers', 'on', true);
      cm := public.crm_merge_contacts(kc, dc);
      perform set_config('wa.merge_from_volunteers', '', true);
    end if;
  end if;
  delete from public.volunteer_profiles where id = p_drop;
  begin
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_people', p_keep::text, 'merged', coalesce(dname, '?') || ' (#' || p_drop || ')', coalesce(kname, '?') || ' (+' || moved || ' roster rows)', coalesce(auth.jwt() ->> 'email', 'staff'));
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'moved', moved, 'moved_messages', moved_msgs, 'keep', p_keep, 'contacts', cm);
end $$$m$,$m$comment on function public.volunteer_merge(bigint, bigint) is 'wave176: merges two volunteers into one: their roster rows, texts, history, accounts and letters move to the kept one, the volunteering profiles combine (roles, car, Quo, applied), and the dropped person''s CRM contact is merged into the kept contact (crm_merge_contacts: emails, phones, tags, notes, gifts, history). Staff; logged.'$m$,$m$do $$ declare d text; begin
  d := pg_get_functiondef('public.crm_merge_contacts(bigint, bigint)'::regprocedure);
  d := replace(d, $x$if not (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) then raise exception 'not allowed'; end if;$x$,
                  $x$if not (public.is_wa_staff() and (coalesce(public.wa_page_ok('crm'), true) or coalesce(current_setting('wa.merge_from_volunteers', true), '') = 'on')) then raise exception 'not allowed'; end if;$x$);
  if position('wa.merge_from_volunteers' in d) = 0 then raise exception 'crm_merge_contacts was not patched'; end if;
  execute d;
end $$$m$,$m$do $$ declare v_def text; v_opts text[]; begin
  -- crm_contacts_v read volunteer_people; now it reads the view by that name, the profile columns stay as they were
  select pg_get_viewdef('public.crm_contacts_v'::regclass, true), reloptions into v_def, v_opts from pg_class where oid = 'public.crm_contacts_v'::regclass;
  v_def := replace(v_def, 'volunteer_profiles', 'volunteer_people');
  execute 'create or replace view public.crm_contacts_v as ' || v_def;
  if v_opts is not null then execute 'alter view public.crm_contacts_v set (' || array_to_string(v_opts, ', ') || ')'; end if;
end $$$m$,$m$alter table public.volunteer_profiles drop column full_name, drop column emails, drop column phones, drop column address, drop column notes, drop column tags, drop column organization$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
