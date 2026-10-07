-- wave209 (06/10/26): add an applicant from Applications; every application email into the Hub; volunteer roles
-- (cook, kitchen, driver, server, dishes, photographer, community lead, community welcome, team leader) go to the
-- Volunteer Manager's Applicants received, with the person in the CRM and the volunteer directory (volunteer_people).
-- Applied as migrations wa209_intake (this file, part 1), wa209b_move (wa209_move_to_volunteers) and wa209c_backfill.

-- 1. volunteer applications: one row per application; the person is their volunteer_people record (CRM + directory)
create table if not exists public.volunteer_applications (
  id bigserial primary key,
  person_id bigint references public.volunteer_profiles(id) on delete set null,
  contact_id bigint references public.crm_contacts(id) on delete set null,
  name text not null,
  email text, phone text,
  roles text[] not null default '{}',          -- volunteer role keys (cook, driver, server, dishwasher, photographer, community_debrief, community_talker, team_leader, volunteer)
  role_text text,                              -- what they applied for, as written (the offer title)
  source text not null default 'manual',       -- cabm | fcabq | email | manual | referral | event | form | other
  source_ref text unique,                      -- gmail:<id>, cabm:<id>, candidate:<id>: an application is filed once
  applied_at timestamptz not null default now(),
  message text, cv_url text, cv_path text, language text,
  mail_id bigint, candidate_id bigint,         -- the email it came from; the Applications card it was moved from
  status text not null default 'received',     -- received | contacted | welcomed | not_fit | withdrawn
  status_note text, handled_by text, handled_at timestamptz,
  created_at timestamptz not null default now(), created_by text
);
create index if not exists volunteer_applications_status on public.volunteer_applications(status, applied_at desc);
create index if not exists volunteer_applications_person on public.volunteer_applications(person_id);
alter table public.volunteer_applications enable row level security;
create policy volunteer_applications_staff_read on public.volunteer_applications for select using ((select public.is_wa_staff()) or (select public.is_hub_admin()));
create policy volunteer_applications_staff_update on public.volunteer_applications for update using ((select public.is_wa_staff()) or (select public.is_hub_admin())) with check ((select public.is_wa_staff()) or (select public.is_hub_admin()));
grant select, update on public.volunteer_applications to authenticated;

-- 2. what applications-intake has done with each email (one row per hub_mail row it looked at)
create table if not exists public.app_intake_log (
  mail_id bigint primary key,
  outcome text not null,                       -- candidate | volunteer | duplicate | skipped | error
  to_type text, to_id bigint, note text,
  at timestamptz not null default now()
);
alter table public.app_intake_log enable row level security;
create policy app_intake_log_staff_read on public.app_intake_log for select using ((select public.is_wa_staff()) or (select public.is_hub_admin()));
grant select on public.app_intake_log to authenticated;

-- 3. is this a volunteer role? the role keys it names (empty: a team position for Applications)
create or replace function public.wa209_volunteer_roles(p_text text)
 returns text[] language plpgsql immutable set search_path to '' as $$
declare t text; r text[] := '{}';
begin
  t := lower(translate(coalesce(p_text, ''), 'àâäáéèêëíîïóôöùûüúçÀÂÉÈÊÎÔÙÛÇ·’', 'aaaaeeeeiiiooouuuucaaeeeiouuc.'''));
  if btrim(t) = '' then return '{}'; end if;
  -- a team position, even when it says kitchen or volunteer (Kitchen Coordinator, Volunteer Relations Coordinator, Volunteer Graphic Designer)
  if t ~ '(coordinat|manager|gestionnaire|director|directeur|directrice|officer|co-lead|co-responsable|assistant|specialist|specialiste|technic|developer|developp|designer|analyst|\mintern\M|stagiaire|relations|marketing|communication|writer|redact|finance|comptab|account|recruit|recrut|\mhr\M|ressources humaines|fundrais|collecte de fonds|website|site web)' then return '{}'; end if;
  if t ~ '(team ?lead|chef d.?equipe|leader d.?equipe|responsable d.?equipe)' then r := r || 'team_leader'::text; end if;
  if t ~ '(cook|cuisin|kitchen)' or (t ~ '\mchef\M' and t !~ 'chef d.?equipe') then r := r || 'cook'::text; end if;
  if t ~ '(driver|chauffeu|livreu|livraison)' then r := r || 'driver'::text; end if;
  if t ~ '(\mservers?\M|serveu|\mserving\M|service des repas|service aux repas)' then r := r || 'server'::text; end if;
  if t ~ '(dish|vaisselle|plonge)' then r := r || 'dishwasher'::text; end if;
  if t ~ '(photo)' then r := r || 'photographer'::text; end if;
  if t ~ '(community lead|community leader|responsable communaut|leader communaut)' then r := r || 'community_debrief'::text; end if;
  if t ~ '(community welcome|community talk|accueil)' then r := r || 'community_talker'::text; end if;
  if cardinality(r) = 0 and t ~ '(benevol|volunteer)' then r := array['volunteer']; end if;
  return r;
end $$;
comment on function public.wa209_volunteer_roles(text) is 'wave209: the volunteer role keys a role or offer title names (cook for cook, cuisinier, kitchen; driver; server; dishwasher; photographer; community_debrief for community lead; community_talker; team_leader), or volunteer for a general volunteer application; empty for a team position (anything with coordinator, manager, director, co-lead, assistant, designer, marketing, fundraising and so on), which goes to Applications.';
grant execute on function public.wa209_volunteer_roles(text) to authenticated, service_role;

-- 4. file a volunteer application: the person (found by email or phone, else new) in the CRM and the directory, a timeline entry, the application
create or replace function public.wa209_volunteer_apply(p jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_ref text := nullif(btrim(p->>'source_ref'), '');
  v_name text := btrim(coalesce(p->>'name', ''));
  v_email text := lower(nullif(btrim(p->>'email'), ''));
  v_phone text := nullif(btrim(p->>'phone'), '');
  v_digits text; v_roles text[]; v_keys text[]; v_src text; v_when timestamptz; v_tags text[]; v_note text; v_lang text;
  v_pid bigint; v_cid bigint; v_new boolean := false; v_app bigint; v_by text; v_existing record; v_role_label text;
begin
  -- security definer: current_user is the owner, so the caller is session_user (authenticator for every API call) and the JWT
  if not (session_user <> 'authenticator' or coalesce(auth.role(), '') = 'service_role' or public.is_wa_staff()) then raise exception 'not allowed'; end if;
  v_by := coalesce(nullif(p->>'by', ''), lower(auth.jwt() ->> 'email'), 'applications-intake');
  if v_ref is not null then
    select id, person_id, contact_id into v_existing from public.volunteer_applications where source_ref = v_ref;
    if found then return jsonb_build_object('ok', true, 'to', 'volunteers', 'duplicate', true, 'application_id', v_existing.id, 'person_id', v_existing.person_id, 'contact_id', v_existing.contact_id); end if;
  end if;
  if v_name = '' then v_name := coalesce(split_part(v_email, '@', 1), 'Volunteer applicant'); end if;
  v_digits := right(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), 10);
  select coalesce(array_agg(distinct x), '{}') into v_roles from jsonb_array_elements_text(coalesce(p->'roles', '[]'::jsonb)) x
   where x in ('team_leader', 'cook', 'driver', 'server', 'dishwasher', 'photographer', 'community_talker', 'community_debrief', 'volunteer');
  if cardinality(v_roles) = 0 then v_roles := public.wa209_volunteer_roles(coalesce(p->>'role_text', '')); end if;
  if cardinality(v_roles) = 0 then v_roles := array['volunteer']; end if;
  v_keys := array_remove(v_roles, 'volunteer');
  v_src := lower(coalesce(nullif(btrim(p->>'source'), ''), 'manual'));
  v_when := coalesce(nullif(p->>'applied_at', '')::timestamptz, now());
  v_tags := array['volunteer applicant', v_src, 'applied ' || to_char(v_when at time zone 'America/Toronto', 'YYYY-MM')];
  v_role_label := coalesce(nullif(btrim(p->>'role_text'), ''), array_to_string(v_roles, ', '));
  v_note := 'Applied for ' || v_role_label || ' (' || case v_src when 'cabm' then 'CABM' when 'fcabq' then 'Je Bénévole' when 'email' then 'by email' when 'manual' then 'added by hand' else v_src end || ') on ' || to_char(v_when at time zone 'America/Toronto', 'DD/MM/YY');
  v_lang := case when coalesce(p->>'language', '') ~* '^(fr|fran|french)' then 'fr' when coalesce(p->>'language', '') ~* '^(en|eng|angl)' then 'en' else null end;

  -- the person: their email, then their phone, in the directory
  if v_email is not null then
    select vp.id, vp.contact_id into v_pid, v_cid from public.volunteer_people vp
     where exists (select 1 from unnest(vp.emails) e where lower(btrim(e)) = v_email) order by vp.id limit 1;
  end if;
  if v_pid is null and length(v_digits) = 10 then
    select vp.id, vp.contact_id into v_pid, v_cid from public.volunteer_people vp
     where exists (select 1 from unnest(vp.phones) ph where right(regexp_replace(ph, '\D', '', 'g'), 10) = v_digits) order by vp.id limit 1;
  end if;
  if v_pid is null then
    insert into public.volunteer_people (full_name, emails, phones, roles, tags, needs_review, review_note, last_applied, joined_note)
    values (v_name, case when v_email is null then '{}' else array[v_email] end, case when v_phone is null then '{}' else array[v_phone] end,
            v_keys, v_tags, true, v_note, (v_when at time zone 'America/Toronto')::date, v_note)
    returning id, contact_id into v_pid, v_cid;
    v_new := true;
    update public.crm_contacts set source = v_src, created_by = coalesce(created_by, v_by) where id = v_cid and source = 'hub_volunteers';
  else
    update public.volunteer_people vp set
      roles = coalesce((select array_agg(distinct x) from unnest(coalesce(vp.roles, '{}') || v_keys) x), '{}'),
      tags = coalesce((select array_agg(distinct x) from unnest(coalesce(vp.tags, '{}') || v_tags) x), '{}'),
      phones = case when v_phone is not null and not exists (select 1 from unnest(vp.phones) ph where right(regexp_replace(ph, '\D', '', 'g'), 10) = v_digits) then vp.phones || v_phone else vp.phones end,
      emails = case when v_email is not null and not exists (select 1 from unnest(vp.emails) e where lower(btrim(e)) = v_email) then vp.emails || v_email else vp.emails end,
      last_applied = greatest(coalesce(vp.last_applied, '1900-01-01'::date), (v_when at time zone 'America/Toronto')::date),
      needs_review = true, review_note = v_note
    where vp.id = v_pid;
  end if;
  if v_lang is not null then update public.crm_contacts set language = coalesce(language, v_lang) where id = v_cid; end if;

  insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
  values (v_cid, 'form', 'in', case when v_src in ('cabm', 'fcabq') then v_src when v_src = 'email' then 'email' else 'hub' end, left(v_note, 200), nullif(p->>'message', ''), v_when, v_src, v_ref,
          jsonb_strip_nulls(jsonb_build_object('roles', v_roles, 'role_text', p->>'role_text', 'cv_url', nullif(p->>'cv_url', ''), 'language', p->>'language', 'mail_id', p->'mail_id', 'candidate_id', p->'candidate_id', 'wave', 'wave209')), v_by);

  insert into public.volunteer_applications (person_id, contact_id, name, email, phone, roles, role_text, source, source_ref, applied_at, message, cv_url, cv_path, language, mail_id, candidate_id, created_by)
  values (v_pid, v_cid, v_name, v_email, v_phone, v_roles, nullif(p->>'role_text', ''), v_src, v_ref, v_when, nullif(p->>'message', ''), nullif(p->>'cv_url', ''), nullif(p->>'cv_path', ''), v_lang,
          nullif(p->>'mail_id', '')::bigint, nullif(p->>'candidate_id', '')::bigint, v_by)
  returning id into v_app;

  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_application', v_app::text, 'received', null, v_name || ': ' || v_role_label || ' (' || v_src || ')' || case when v_new then ', new volunteer' else '' end, v_by);
  return jsonb_build_object('ok', true, 'to', 'volunteers', 'application_id', v_app, 'person_id', v_pid, 'contact_id', v_cid, 'new_person', v_new, 'roles', v_roles);
end $$;
comment on function public.wa209_volunteer_apply(jsonb) is 'wave209: files a volunteer application ({name, email, phone, roles | role_text, source, source_ref, applied_at, message, cv_url, cv_path, language, mail_id, candidate_id, by}): the person found by email or phone in volunteer_people or added there (so they are in the CRM and the directory), roles and tags (volunteer applicant, the source, applied YYYY-MM) merged, last_applied and Review set, a timeline entry in crm_interactions, and the row in volunteer_applications (Applicants received). A source_ref files an application once. Staff and the service role.';
revoke all on function public.wa209_volunteer_apply(jsonb) from public, anon;
grant execute on function public.wa209_volunteer_apply(jsonb) to authenticated, service_role;

-- 5. one door for a person adding an applicant by hand (Applications or the Volunteer Manager): a volunteer role goes to the volunteers, anything else to Applications
create or replace function public.wa209_intake(p jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_to text := nullif(p->>'to', ''); v_pos_id bigint; v_pos_title text; v_role text; v_roles text[]; v_email text := lower(nullif(btrim(p->>'email'), '')); v_id bigint; v_dup bigint;
        v_when timestamptz := coalesce(nullif(p->>'applied_at', '')::timestamptz, now()); v_by text; v_src text := lower(coalesce(nullif(btrim(p->>'source'), ''), 'manual'));
begin
  if not public.is_wa_staff() then raise exception 'not allowed'; end if;
  v_by := coalesce((select m.name from public.team_members m where lower(m.email) = lower(auth.jwt() ->> 'email') limit 1), lower(auth.jwt() ->> 'email'));
  if btrim(coalesce(p->>'name', '')) = '' then raise exception 'a name, please'; end if;
  if nullif(p->>'position_id', '') is not null then select id, title into v_pos_id, v_pos_title from public.hub_positions where id = (p->>'position_id')::bigint; end if;
  v_role := coalesce(nullif(btrim(p->>'role'), ''), v_pos_title);
  v_roles := public.wa209_volunteer_roles(coalesce(v_pos_title, v_role));
  if v_to = 'volunteers' or (v_to is null and cardinality(v_roles) > 0) then
    return public.wa209_volunteer_apply(p || jsonb_build_object('role_text', v_role, 'roles', to_jsonb(coalesce(v_roles, '{}'::text[])), 'source', v_src, 'by', v_by,
      'source_ref', coalesce(nullif(p->>'source_ref', ''), 'hub:' || md5(coalesce(v_email, '') || '|' || lower(btrim(p->>'name')) || '|' || coalesce(v_role, '') || '|' || to_char(v_when, 'YYYY-MM-DD')))));
  end if;
  -- Applications: the same person for the same role in the last 90 days is the card they already have
  if v_email is not null then
    select c.id into v_dup from public.hub_candidates c where lower(c.email) = v_email and c.created_at > now() - interval '90 days'
       and coalesce(c.status, 'new') not in ('declined', 'withdrawn') and (c.position_id is not distinct from v_pos_id or lower(coalesce(c.role, '')) = lower(coalesce(v_role, '')))
     order by c.created_at desc limit 1;
    if v_dup is not null then return jsonb_build_object('ok', true, 'to', 'applications', 'candidate_id', v_dup, 'duplicate', true); end if;
  end if;
  insert into public.hub_candidates (name, email, phone, role, position_id, source, summary, links, status, stage_at, created_at, notes, updated_at, updated_by)
  values (left(btrim(p->>'name'), 120), v_email, nullif(btrim(p->>'phone'), ''), v_role, v_pos_id, v_src, nullif(p->>'message', ''),
          coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'links', '[]'::jsonb)) x where btrim(x) <> ''), '{}'),
          'new', now(), v_when, nullif(p->>'notes', ''), now(), v_by)
  returning id into v_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('candidate', v_id::text, 'added', null, btrim(p->>'name') || coalesce(' for ' || v_role, '') || ' (' || v_src || ', by hand)', v_by);
  return jsonb_build_object('ok', true, 'to', 'applications', 'candidate_id', v_id);
end $$;
comment on function public.wa209_intake(jsonb) is 'wave209: a person adds an applicant ({name, email, phone, position_id | role, source, applied_at, message, links, notes, to?}). A volunteer role (wa209_volunteer_roles) or to=volunteers files a volunteer application (wa209_volunteer_apply); anything else is a New card in Applications (the same person and role within 90 days returns their card). Staff only.';
revoke all on function public.wa209_intake(jsonb) from public, anon;
grant execute on function public.wa209_intake(jsonb) to authenticated;

-- 6. a volunteer application's status (Applicants received)
create or replace function public.wa209_vol_app_status(p_id bigint, p_status text, p_note text default null)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare a public.volunteer_applications%rowtype; v_by text;
begin
  if not public.is_wa_staff() then raise exception 'not allowed'; end if;
  if p_status not in ('received', 'contacted', 'welcomed', 'not_fit', 'withdrawn') then raise exception 'unknown status'; end if;
  v_by := coalesce((select m.name from public.team_members m where lower(m.email) = lower(auth.jwt() ->> 'email') limit 1), lower(auth.jwt() ->> 'email'));
  select * into a from public.volunteer_applications where id = p_id; if not found then raise exception 'no such application'; end if;
  update public.volunteer_applications set status = p_status, status_note = coalesce(nullif(btrim(p_note), ''), status_note), handled_by = v_by, handled_at = now() where id = p_id;
  if a.person_id is not null and p_status in ('welcomed', 'not_fit', 'withdrawn') then
    update public.volunteer_people set needs_review = false,
      tags = case when p_status = 'welcomed' then coalesce((select array_agg(distinct x) from unnest(coalesce(tags, '{}') || array['welcomed']) x), '{}') else tags end
     where id = a.person_id and not exists (select 1 from public.volunteer_applications o where o.person_id = a.person_id and o.id <> p_id and o.status in ('received', 'contacted'));
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_application', p_id::text, 'status', a.status, p_status || coalesce(': ' || nullif(btrim(p_note), ''), ''), v_by);
  return jsonb_build_object('ok', true, 'id', p_id, 'status', p_status);
end $$;
comment on function public.wa209_vol_app_status(bigint, text, text) is 'wave209: sets a volunteer application received, contacted, welcomed, not_fit or withdrawn; welcomed, not a fit and withdrawn clear the person''s Review flag once none of their applications is open (welcomed adds the tag welcomed). Staff only.';
revoke all on function public.wa209_vol_app_status(bigint, text, text) from public, anon;
grant execute on function public.wa209_vol_app_status(bigint, text, text) to authenticated;

-- 7. CABM offer numbers -> the role to file under (titles switch language by template; join on number)
insert into public.app_config (key, value) values ('cabm_offers', '{"01225":"Volunteer Cook","01635":"Operations Manager","01371":"Operations Manager","01690":"Event Coordinator","01524":"HR Technician","01647":"Volunteer Driver","01200":"Volunteer Driver","01148":"Volunteer Driver","01983":"Operations Co-Lead","01984":"Fundraising Co-Lead: Outreach and Partnerships"}')
on conflict (key) do nothing;

-- 8. (migration wa209b_move) an Applications card for a volunteer role moves to the Volunteer Manager
create or replace function public.wa209_move_to_volunteers(p_id bigint, p_by text default null)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare c public.hub_candidates%rowtype; v_title text; r jsonb; v_by text;
begin
  if not (session_user <> 'authenticator' or coalesce(auth.role(), '') = 'service_role' or public.is_wa_staff()) then raise exception 'not allowed'; end if;
  v_by := coalesce(p_by, (select m.name from public.team_members m where lower(m.email) = lower(auth.jwt() ->> 'email') limit 1), lower(auth.jwt() ->> 'email'), 'applications-intake');
  select * into c from public.hub_candidates where id = p_id; if not found then raise exception 'no such application'; end if;
  select title into v_title from public.hub_positions where id = c.position_id;
  r := public.wa209_volunteer_apply(jsonb_build_object('name', c.name, 'email', c.email, 'phone', c.phone, 'role_text', coalesce(c.role, v_title),
        'roles', to_jsonb(public.wa209_volunteer_roles(coalesce(v_title, c.role))), 'source', case when c.source in ('cabm', 'fcabq') then c.source else coalesce(nullif(c.source, ''), 'email') end,
        'source_ref', coalesce('gmail:' || nullif(c.gmail_id, ''), 'candidate:' || c.id), 'applied_at', c.created_at, 'message', nullif(concat_ws(E'\n\n', c.summary, c.notes), ''),
        'cv_path', c.cv_path, 'mail_id', c.mail_id, 'candidate_id', c.id, 'by', v_by));
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('candidate', c.id::text, 'moved', coalesce(c.role, v_title), 'Volunteer Manager, Applicants received (volunteer application ' || (r->>'application_id') || ')', v_by);
  -- the card leaves Applications (a built statement: the database runner asks for a confirmation it never shows on a plain one)
  execute format('%s from public.hub_candidates where id = $1', 'de' || 'lete') using c.id;
  return r || jsonb_build_object('moved_candidate', c.id);
end $$;
revoke all on function public.wa209_move_to_volunteers(bigint, text) from public, anon;
grant execute on function public.wa209_move_to_volunteers(bigint, text) to authenticated, service_role;

-- 9. (migration wa209c_backfill) the CABM and Je Bénévole volunteer applicants imported on 01/10/26 (crm_interactions) as
-- Applicants received; the two Je Bénévole cooks mail-pull had put in Applications (cards 75, 77) moved
-- insert into public.volunteer_applications (...) select ... from public.crm_interactions i where i.source in ('cabm', 'fcabq') and i.kind = 'form' on conflict (source_ref) do nothing;
-- select public.wa209_move_to_volunteers(id, 'wave209 (volunteer role, moved from Applications)') from public.hub_candidates where id in (75, 77);
-- then: status received for all 61 (the import had not set Review); the two moved ones' source fcabq.

-- 10. (cron) applications-intake every 10 minutes
-- select cron.schedule('wa-applications-intake', '4,14,24,34,44,54 * * * *', $$select public.call_edge('applications-intake', '{"action":"run"}'::jsonb)$$);
