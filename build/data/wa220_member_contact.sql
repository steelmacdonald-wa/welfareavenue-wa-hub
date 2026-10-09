-- wave220 (09/10/26): one record per team member, phone included, for everyone added from now on.
-- Steel: "Phone numbers of my team - please add them to their profiles (volunteer, crm, and hub
-- profiles). The same goes for new onboardees."
-- Applied 09/10/26 as migration wa220_member_contact (the copy here has each comment on one line for gen_data_model.py).

alter table public.hub_candidates add column if not exists member_id bigint references public.team_members(id) on delete set null;
create index if not exists hub_candidates_member_id_idx on public.hub_candidates (member_id);
comment on column public.hub_candidates.member_id is 'wave220: the roster row (team_members) this applicant became once hired. Set by wa220_member_contact (wa220_cand_for: the name or WA email matching a hired applicant) or by hand; the hire''s phone and personal email then reach the team member''s CRM contact through wa220_member_contact.';

-- the last 10 digits of a phone, for comparing numbers typed in any format
create or replace function public.wa220_digits(p text) returns text
language sql immutable set search_path to '' as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10), '')
$$;
comment on function public.wa220_digits(text) is 'wave220: the last 10 digits of a phone number (null when none), to compare numbers typed in any format.';

-- the hired applicant who became this team member, when there is exactly one
create or replace function public.wa220_cand_for(p_member bigint) returns bigint
language sql stable security definer set search_path to '' as $$
  with m as (select id, name, email from public.team_members where id = p_member),
  linked as (select c.id from public.hub_candidates c where c.member_id = p_member and not coalesce(c.practice, false) order by c.updated_at desc nulls last, c.id desc limit 1),
  guess as (
    select c.id from public.hub_candidates c, m
     where c.status = 'hired' and c.member_id is null and not coalesce(c.practice, false)
       and (public.crm_fold(btrim(c.name)) = public.crm_fold(btrim(m.name))
         or public.crm_fold(btrim(c.name)) = public.crm_fold(replace(split_part(m.email, '@', 1), '.', ' '))
         or (position(' ' in btrim(m.name)) = 0 and public.crm_fold(split_part(btrim(c.name), ' ', 1)) = public.crm_fold(btrim(m.name))))
  )
  select coalesce((select id from linked), (select id from guess where (select count(*) from guess) = 1))
$$;
comment on function public.wa220_cand_for(bigint) is 'wave220: the hired applicant (hub_candidates) behind a team member: the one linked by member_id, else the only hired, unlinked applicant whose name matches the roster name or the WA email (first.last). Null when none or ambiguous.';

-- make sure a team member has exactly one CRM contact, carrying their phone; returns the contact id
create or replace function public.wa220_member_contact(p_member bigint, p_volunteer boolean default false) returns bigint
language plpgsql security definer set search_path to '' as $$
declare
  m public.team_members%rowtype;
  cand public.hub_candidates%rowtype;
  v_cand bigint;
  v_keep bigint;
  v_other bigint;
  k public.crm_contacts%rowtype;
  v_vol bigint;
  v_name text;
begin
  select * into m from public.team_members where id = p_member;
  if not found then return null; end if;
  v_cand := public.wa220_cand_for(p_member);
  if v_cand is not null then
    select * into cand from public.hub_candidates where id = v_cand;
    if cand.member_id is null then update public.hub_candidates set member_id = p_member where id = v_cand; end if;
  end if;

  -- crm_merge_contacts checks the caller; a roster change by the Hub's service jobs has no caller
  if coalesce(auth.jwt() ->> 'email', '') = '' then
    perform set_config('request.jwt.claims', '{"email":"hub-roster@welfareavenue.com","role":"service_role"}', true);
  end if;
  perform set_config('wa.merge_from_volunteers', 'on', true);
  perform set_config('wa.no_automations', 'on', true);

  select id into v_keep from public.crm_contacts where member_id = p_member and merged_into is null order by id limit 1;

  -- the same person under another record: the roster email, or the hire's email, or the hire's phone with the same first name
  for v_other in
    select c.id from public.crm_contacts c
     where c.merged_into is null and c.id is distinct from v_keep and (c.member_id is null or c.member_id = p_member)
       and (exists (select 1 from unnest(coalesce(c.emails, '{}')) e where lower(btrim(e)) = lower(btrim(m.email)) and coalesce(m.email, '') <> '')
         or (v_cand is not null and coalesce(cand.email, '') <> '' and exists (select 1 from unnest(coalesce(c.emails, '{}')) e where lower(btrim(e)) = lower(btrim(cand.email))))
         or (v_cand is not null and public.wa220_digits(cand.phone) is not null
             and exists (select 1 from unnest(coalesce(c.phones, '{}')) p where public.wa220_digits(p) = public.wa220_digits(cand.phone))
             and public.crm_fold(split_part(btrim(coalesce(c.full_name, '')), ' ', 1)) = public.crm_fold(split_part(btrim(coalesce(cand.name, m.name)), ' ', 1))))
     order by (c.volunteer_id is not null) desc, c.id
  loop
    if v_keep is null then
      v_keep := v_other;
      update public.crm_contacts set member_id = p_member where id = v_keep;
    else
      perform public.crm_merge_contacts(v_keep, v_other);
    end if;
  end loop;

  if v_keep is null then
    insert into public.crm_contacts (full_name, first_name, emails, phones, kinds, source, member_id, created_by, updated_by)
    values (coalesce(nullif(btrim(cand.name), ''), m.name), split_part(btrim(coalesce(nullif(btrim(cand.name), ''), m.name)), ' ', 1),
            case when coalesce(m.email, '') <> '' then array[lower(btrim(m.email))] else '{}'::text[] end,
            '{}'::text[], array['staff'], 'hub_roster', p_member, 'wave220', 'wave220')
    returning id into v_keep;
  end if;

  select * into k from public.crm_contacts where id = v_keep;
  -- the fullest name we know (the roster often has a first name only)
  v_name := k.full_name;
  if position(' ' in btrim(coalesce(v_name, ''))) = 0 then
    if position(' ' in btrim(coalesce(m.name, ''))) > 0 then v_name := btrim(m.name);
    elsif v_cand is not null and position(' ' in btrim(coalesce(cand.name, ''))) > 0 then v_name := btrim(cand.name);
    end if;
  end if;

  update public.crm_contacts c set
    full_name = coalesce(nullif(v_name, ''), c.full_name),
    emails = case when coalesce(m.email, '') <> '' and not exists (select 1 from unnest(coalesce(c.emails, '{}')) e where lower(btrim(e)) = lower(btrim(m.email)))
                  then array[lower(btrim(m.email))] || coalesce(c.emails, '{}') else coalesce(c.emails, '{}') end
             || case when v_cand is not null and coalesce(cand.email, '') <> '' and not exists (select 1 from unnest(coalesce(c.emails, '{}')) e where lower(btrim(e)) = lower(btrim(cand.email)))
                       and lower(btrim(cand.email)) <> lower(btrim(coalesce(m.email, '')))
                     then array[btrim(cand.email)] else '{}'::text[] end,
    phones = case when v_cand is not null and public.wa220_digits(cand.phone) is not null
                       and not exists (select 1 from unnest(coalesce(c.phones, '{}')) p where public.wa220_digits(p) = public.wa220_digits(cand.phone))
                  then coalesce(c.phones, '{}') || btrim(cand.phone) else c.phones end,
    kinds = case when m.active is not false then (case when 'staff' = any(coalesce(c.kinds, '{}')) then c.kinds else array_append(coalesce(c.kinds, '{}'), 'staff') end) else c.kinds end,
    member_id = p_member,
    updated_by = coalesce(nullif(public.wa_email(), ''), 'wave220')
  where c.id = v_keep;

  -- a new team member also gets a volunteer record (every member serves four times a year)
  if p_volunteer and m.active is not false and coalesce(m.department, '') <> 'board'
     and not exists (select 1 from public.crm_contacts where id = v_keep and volunteer_id is not null) then
    insert into public.volunteer_profiles (roles, joined_note) values ('{}', 'Team member') returning id into v_vol;
    update public.crm_contacts set volunteer_id = v_vol where id = v_keep;
  end if;
  return v_keep;
end $$;
comment on function public.wa220_member_contact(bigint, boolean) is 'wave220: makes sure a team member has one CRM contact (crm_contacts.member_id): links or creates it, merges the same person''s other records (the roster email, the hired applicant''s email, or the applicant''s phone with the same first name; never another team member''s), carries the hire''s phone and personal email, restores the full name and, with p_volunteer, gives an active non-board member a volunteer record. Called by the team_members and hub_candidates triggers and by wa220_set_member_phone; not callable from the API.';
revoke all on function public.wa220_member_contact(bigint, boolean) from public, anon, authenticated;
revoke all on function public.wa220_cand_for(bigint) from public, anon, authenticated;

-- the roster trigger: a new team member, a changed email or name, or someone back on the team
create or replace function public.wa220_member_trg() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'INSERT'
     or new.email is distinct from old.email or new.name is distinct from old.name
     or (new.active is not false and old.active is false) then
    begin
      perform public.wa220_member_contact(new.id, tg_op = 'INSERT');
    exception when others then
      raise warning 'wa220_member_contact(%) failed: %', new.id, sqlerrm;
    end;
  end if;
  return null;
end $$;
comment on function public.wa220_member_trg() is 'wave220: after a team member is added (or their email, name or return changes), keeps their one CRM contact (wa220_member_contact). A failure is a warning, never a failed roster save.';
create or replace trigger trg_wa220_member_contact after insert or update of email, name, active on public.team_members
  for each row execute function public.wa220_member_trg();

-- the applicant trigger: hired (or linked) applicants hand their phone to the team member's contact
create or replace function public.wa220_cand_trg() returns trigger
language plpgsql security definer set search_path to '' as $$
declare v_member bigint;
begin
  if coalesce(new.practice, false) then return null; end if;
  v_member := new.member_id;
  if v_member is null and new.status = 'hired' then
    select m.id into v_member from public.team_members m
     where m.active is not false and public.wa220_cand_for(m.id) = new.id
     order by m.id desc limit 1;
  end if;
  if v_member is not null and (tg_op = 'INSERT' or new.status is distinct from old.status or new.member_id is distinct from old.member_id
                               or new.phone is distinct from old.phone or new.email is distinct from old.email) then
    begin
      perform public.wa220_member_contact(v_member, false);
    exception when others then
      raise warning 'wa220_member_contact(%) from applicant % failed: %', v_member, new.id, sqlerrm;
    end;
  end if;
  return null;
end $$;
comment on function public.wa220_cand_trg() is 'wave220: when an applicant is hired or linked to a team member (or their phone or email changes), their phone and email reach the team member''s CRM contact.';
create or replace trigger trg_wa220_cand_contact after insert or update of status, member_id, phone, email on public.hub_candidates
  for each row execute function public.wa220_cand_trg();

-- the Hub profile: a team member's phone (read by staff, not board viewers), and whether the reader may change it
create or replace function public.wa220_member_phone(p_member bigint)
returns table (contact_id bigint, phones text[], can_edit boolean)
language sql stable security definer set search_path to '' as $$
  select c.id, coalesce(c.phones, '{}'),
         (public.wa169_can_assign() or exists (select 1 from public.team_members m where m.id = p_member and lower(m.email) = public.wa_email() and public.wa_email() <> ''))
    from (select 1) one
    left join public.crm_contacts c on c.member_id = p_member and c.merged_into is null
   where public.is_wa_staff()
     and not exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role in ('viewer', 'blocked'))
   order by c.id nulls last
   limit 1
$$;
comment on function public.wa220_member_phone(bigint) is 'wave220: the phone numbers on a team member''s CRM contact for their Hub profile (#person/<id>), and can_edit (the person themselves, HR, leaders and admins). Staff only; board viewers and blocked accounts get no row.';
revoke all on function public.wa220_member_phone(bigint) from public, anon;
grant execute on function public.wa220_member_phone(bigint) to authenticated;

-- the Hub profile's edit: the person, HR, leaders and admins set the main number (first in the list); empty removes it
create or replace function public.wa220_set_member_phone(p_member bigint, p_phone text)
returns text[]
language plpgsql security definer set search_path to '' as $$
declare
  v_contact bigint; v_old text[]; v_new text[]; v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_self boolean;
begin
  if not public.is_wa_staff() or exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role in ('viewer', 'blocked')) then
    raise exception 'not allowed';
  end if;
  select (lower(m.email) = public.wa_email() and public.wa_email() <> '') into v_self from public.team_members m where m.id = p_member;
  if v_self is null then raise exception 'team member % not found', p_member; end if;
  if not (v_self or public.wa169_can_assign()) then raise exception 'only the person, HR, leaders and admins change a team phone'; end if;
  if v_phone is not null and (length(regexp_replace(v_phone, '\D', '', 'g')) not between 7 and 15 or v_phone ~ '[^0-9 ()+.extEXT-]') then
    raise exception 'that does not look like a phone number';
  end if;
  v_contact := public.wa220_member_contact(p_member, false);
  select coalesce(phones, '{}') into v_old from public.crm_contacts where id = v_contact;
  -- the new number replaces the main one; other numbers stay unless they are the same number
  select coalesce(array_agg(p order by ord), '{}') into v_new
    from unnest(v_old) with ordinality as x(p, ord)
   where ord > 1 and public.wa220_digits(p) is distinct from public.wa220_digits(v_phone);
  if v_phone is not null then v_new := array[v_phone] || v_new; end if;
  update public.crm_contacts set phones = v_new, updated_by = public.wa_email() where id = v_contact;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_contact', v_contact::text, 'phones', case when cardinality(v_old) > 0 then 'a number' end,
          case when v_phone is null then 'removed the main number' else 'changed the main number' end || ' (Hub profile)', public.wa_email());
  return v_new;
end $$;
comment on function public.wa220_set_member_phone(bigint, text) is 'wave220: sets a team member''s main phone (the first in crm_contacts.phones) from their Hub profile; the person, HR, leaders and admins only. The CRM and the Volunteer Manager show the same number (one record). change_log records that it changed, not the number.';
revoke all on function public.wa220_set_member_phone(bigint, text) from public, anon;
grant execute on function public.wa220_set_member_phone(bigint, text) to authenticated;
