-- wave195 (02/10/26): volunteer sign-offs.
-- Steel (02/10/26): "I'd also like to add my signature to volunteer recognition and volunteer hours sign off requests
-- that volunteers can ask for on their profile in the website. This would appear on our volunteer manager as it's own page
-- to sign off on hours completed with us." His choices: three kinds of request (an hours sign-off letter, a recognition
-- letter, their own form signed); signers are "Operation leads, admins, and others assigned to sign the sheet", each with
-- their own saved signature; the signed PDF appears on the volunteer's profile and an email says it is ready (through
-- mail-send, so it follows the email switch).
--
-- Safety: requests are made only by a signed-in website account for its own volunteer record (account_* functions); the
-- team reads them with the Volunteer Manager's access; only a signer can sign or decline; signatures, uploaded forms and
-- signed letters sit in the private bucket signoffs and are only ever handed out as short-lived links by the signoff and
-- site-account functions after these checks. Nobody can read another signer's signature.

-- 1. the private bucket ----------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signoffs', 'signoffs', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- 2. signers ---------------------------------------------------------------------------------------------------------------
create table if not exists public.volunteer_signers (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  name text check (length(name) <= 120),
  title text check (length(title) <= 120),
  title_fr text check (length(title_fr) <= 120),
  assigned boolean not null default false,
  signature_path text,
  signature_at timestamptz,
  assigned_by text,
  assigned_at timestamptz,
  updated_at timestamptz not null default now()
);
comment on table public.volunteer_signers is 'wave195: the people who sign volunteer sign-offs, with the name and title printed under their signature (English and French) and where their saved signature image is (signoffs bucket, private; only the signoff function reads it). Admins and Operations leads (hub_roles leader with the opsmtl or opsto profile) may sign without being assigned; anyone else an admin assigns (assigned). Written only through the signoff_signer_* functions and the signoff edge function.';
alter table public.volunteer_signers enable row level security;
revoke all on public.volunteer_signers from anon, authenticated;

-- 3. requests and what was signed ------------------------------------------------------------------------------------------
create table if not exists public.volunteer_signoffs (
  id bigint generated always as identity primary key,
  contact_id bigint not null references public.crm_contacts(id),
  person_id bigint references public.volunteer_profiles(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('hours', 'recognition', 'form')),
  status text not null default 'requested' check (status in ('requested', 'signed', 'declined', 'cancelled')),
  lang text not null default 'en' check (lang in ('en', 'fr')),
  for_org text check (length(for_org) <= 120),
  purpose text check (length(purpose) <= 300),
  period_from date,
  period_to date,
  notes text check (length(notes) <= 1000),
  form_path text, form_name text, form_type text, form_bytes int,
  servings int, hours numeric(8,2), items jsonb,
  signer_note text check (length(signer_note) <= 1500),
  placement jsonb,
  decline_reason text check (length(decline_reason) <= 500),
  reference text unique,
  signer_email text, signer_name text, signer_title text,
  letter_path text, letter_sha256 text,
  signed_at timestamptz, declined_at timestamptz, declined_by text, cancelled_at timestamptz,
  emailed_at timestamptz, email_send_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.volunteer_signoffs is 'wave195: what volunteers ask for on their welfareavenue.com profile and what the team signed: an hours sign-off letter (hours), a recognition letter (recognition) or their own form (form, the upload at form_path). status requested, signed, declined (with the reason) or cancelled (by the volunteer). When signed: the servings listed and their hours (items, servings, hours), the signer''s note (recognition), where the signature went on their form (placement), the reference printed on it (WA-VS-xxxxxx), the signer as printed, and the PDF (letter_path in the private signoffs bucket, with its SHA-256). Volunteer Manager staff read; written only through the functions.';
create index if not exists volunteer_signoffs_status on public.volunteer_signoffs (status, created_at desc);
create index if not exists volunteer_signoffs_contact on public.volunteer_signoffs (contact_id);
alter table public.volunteer_signoffs enable row level security;
revoke all on public.volunteer_signoffs from anon, authenticated;
grant select on public.volunteer_signoffs to authenticated;
create policy volunteer_signoffs_staff_read on public.volunteer_signoffs for select to authenticated
  using (public.is_wa_staff() and coalesce(public.wa_page_ok('volunteering'), true));

insert into public.app_config (key, value) values ('signoff_max_open', '3') on conflict (key) do nothing;

-- 4. helpers (internal) ----------------------------------------------------------------------------------------------------
create or replace function public.signoff_can_sign_email(p_email text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(lower(btrim(p_email)), '') <> ''
     and not exists (select 1 from public.hub_roles r where r.email = lower(btrim(p_email)) and r.role = 'blocked')
     and (exists (select 1 from public.hub_roles r where r.email = lower(btrim(p_email)) and r.role = 'admin')
       or exists (select 1 from public.hub_roles r where r.email = lower(btrim(p_email)) and r.role = 'leader' and r.profile in ('opsmtl', 'opsto'))
       or exists (select 1 from public.volunteer_signers s where s.email = lower(btrim(p_email)) and s.assigned));
$function$;
comment on function public.signoff_can_sign_email(text) is 'wave195 (internal): whether this address may sign volunteer sign-offs: an admin, an Operations lead (leader with the opsmtl or opsto profile) or someone an admin assigned; never a blocked address.';
revoke execute on function public.signoff_can_sign_email(text) from public, anon, authenticated;

create or replace function public.signoff_servings(p_person bigint, p_from date default null, p_to date default null)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('roster_id', x.id, 'date', x.event_date, 'role', x.role, 'role_en', public.wa171_role_label(x.role, 'en'),
           'role_fr', public.wa171_role_label(x.role, 'fr'), 'location', x.location, 'hours', x.hours) order by x.event_date, x.id), '[]'::jsonb)
    from (select er.id, e.event_date, lower(er.role) as role, coalesce(nullif(e.location, ''), 'Montreal') as location,
                 coalesce(nullif(er.detail->>'hours', '')::numeric, coalesce(nullif((select value from public.app_config where key = 'vol_default_hours'), '')::numeric, 2)) as hours
            from public.event_roster er join public.volunteer_events e on e.id = er.event_id
           where er.person_id = p_person and e.kind = 'service' and e.status <> 'cancelled'
             and e.event_date < (now() at time zone 'America/Toronto')::date and lower(coalesce(er.status, '')) = 'confirmed'
             and (p_from is null or e.event_date >= p_from) and (p_to is null or e.event_date <= p_to)) x;
$function$;
comment on function public.signoff_servings(bigint, date, date) is 'wave195 (internal): a volunteer''s confirmed past servings (optionally within dates) with their roles and hours (the roster''s hours, else vol_default_hours), for the sign-off letters.';
revoke execute on function public.signoff_servings(bigint, date, date) from public, anon, authenticated;

create or replace function public.account_person(p_uid uuid)
 returns table (contact_id bigint, person_id bigint)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select c.id, c.volunteer_id from public.crm_contacts c where c.auth_user_id = p_uid and c.merged_into is null limit 1;
$function$;
comment on function public.account_person(uuid) is 'wave195 (internal): the contact and volunteer record of a website account.';
revoke execute on function public.account_person(uuid) from public, anon, authenticated;

-- 5. the volunteer's side (website profile) --------------------------------------------------------------------------------
create or replace function public.account_signoffs()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_uid uuid; v_cid bigint; v_pid bigint; v_serv jsonb; v_list jsonb;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'hook'); end if;
  v_cid := public.account_link_user(v_uid, null);
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_linked'); end if;
  select person_id into v_pid from public.account_person(v_uid);
  v_serv := case when v_pid is null then '[]'::jsonb else public.signoff_servings(v_pid, null, null) end;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'status', s.status, 'for_org', s.for_org, 'purpose', s.purpose,
           'period_from', s.period_from, 'period_to', s.period_to, 'notes', s.notes, 'form_name', s.form_name,
           'requested', (s.created_at at time zone 'America/Toronto')::date, 'signed', (s.signed_at at time zone 'America/Toronto')::date,
           'reference', s.reference, 'signer', s.signer_name, 'hours', s.hours, 'servings', s.servings, 'letter', s.letter_path is not null,
           'declined', (s.declined_at at time zone 'America/Toronto')::date, 'decline_reason', s.decline_reason) order by s.created_at desc), '[]'::jsonb)
    into v_list from public.volunteer_signoffs s where s.contact_id = v_cid and s.status <> 'cancelled';
  return jsonb_build_object('ok', true, 'volunteer', v_pid is not null,
    'servings', jsonb_array_length(v_serv), 'hours', coalesce((select sum((x->>'hours')::numeric) from jsonb_array_elements(v_serv) x), 0),
    'first', v_serv->0->>'date', 'last', v_serv->-1->>'date', 'requests', v_list,
    'max_open', coalesce(nullif((select value from public.app_config where key = 'signoff_max_open'), '')::int, 3));
end $function$;
comment on function public.account_signoffs() is 'wave195: the signed-in volunteer''s sign-off requests (not the cancelled ones) and their confirmed servings and hours, for their profile.';
revoke execute on function public.account_signoffs() from public;
grant execute on function public.account_signoffs() to anon, authenticated;

create or replace function public.account_signoff_request(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid; v_cid bigint; v_pid bigint; v_kind text; v_org text; v_purpose text; v_notes text; v_from date; v_to date; v_lang text;
  v_path text; v_name text; v_type text; v_bytes int; v_open int; v_max int; v_n int; v_id bigint; errs jsonb := '{}'::jsonb;
  v_label text;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'hook'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  v_cid := public.account_link_user(v_uid, null);
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_linked'); end if;
  select person_id into v_pid from public.account_person(v_uid);
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'not_volunteer'); end if;
  if jsonb_array_length(public.signoff_servings(v_pid, null, null)) = 0 then return jsonb_build_object('ok', false, 'reason', 'no_servings'); end if;
  v_kind := lower(coalesce(p->>'kind', ''));
  if v_kind not in ('hours', 'recognition', 'form') then return jsonb_build_object('ok', false, 'reason', 'kind'); end if;
  v_max := coalesce(nullif((select value from public.app_config where key = 'signoff_max_open'), '')::int, 3);
  select count(*) into v_open from public.volunteer_signoffs where contact_id = v_cid and status = 'requested';
  if v_open >= v_max then return jsonb_build_object('ok', false, 'reason', 'too_many', 'max_open', v_max); end if;

  v_org := nullif(btrim(coalesce(p->>'for_org', '')), '');
  v_purpose := nullif(btrim(coalesce(p->>'purpose', '')), '');
  v_notes := nullif(btrim(coalesce(p->>'notes', '')), '');
  v_lang := case when p->>'lang' = 'fr' then 'fr' else 'en' end;
  if length(coalesce(v_org, '')) > 120 then errs := errs || '{"for_org":"long"}'; end if;
  if length(coalesce(v_purpose, '')) > 300 then errs := errs || '{"purpose":"long"}'; end if;
  if length(coalesce(v_notes, '')) > 1000 then errs := errs || '{"notes":"long"}'; end if;
  begin
    v_from := nullif(p->>'period_from', '')::date; v_to := nullif(p->>'period_to', '')::date;
  exception when others then errs := errs || '{"period":"date"}';
  end;
  if v_from is not null and v_to is not null and v_from > v_to then errs := errs || '{"period":"order"}'; end if;
  if v_from is not null and v_from < date '2020-01-01' then errs := errs || '{"period":"range"}'; end if;
  if v_kind = 'form' then
    v_path := nullif(btrim(coalesce(p->>'form_path', '')), '');
    v_name := left(nullif(btrim(coalesce(p->>'form_name', '')), ''), 160);
    if v_path is null or v_path not like 'requests/' || v_uid::text || '/%' or v_path like '%..%' then
      errs := errs || '{"form":"missing"}';
    else
      select o.metadata->>'mimetype', (o.metadata->>'size')::int into v_type, v_bytes from storage.objects o where o.bucket_id = 'signoffs' and o.name = v_path;
      if not found then errs := errs || '{"form":"missing"}';
      elsif coalesce(v_type, '') not in ('application/pdf', 'image/png', 'image/jpeg') then errs := errs || '{"form":"type"}';
      elsif exists (select 1 from public.volunteer_signoffs s where s.form_path = v_path) then errs := errs || '{"form":"used"}';
      end if;
    end if;
  end if;
  if v_kind <> 'recognition' and v_from is not null and v_to is not null then
    if jsonb_array_length(public.signoff_servings(v_pid, v_from, v_to)) = 0 then errs := errs || '{"period":"empty"}'; end if;
  end if;
  if errs <> '{}'::jsonb then return jsonb_build_object('ok', false, 'reason', 'invalid', 'errors', errs); end if;

  insert into public.volunteer_signoffs (contact_id, person_id, user_id, kind, lang, for_org, purpose, period_from, period_to, notes, form_path, form_name, form_type, form_bytes)
  values (v_cid, v_pid, v_uid, v_kind, v_lang, v_org, v_purpose, v_from, v_to, v_notes, v_path, v_name, v_type, v_bytes)
  returning id into v_id;
  v_label := case v_kind when 'hours' then 'an hours sign-off letter' when 'recognition' then 'a recognition letter' else 'their own form signed' end;
  insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
  values (v_cid, 'signoff', 'in', 'web', 'Asked for ' || v_label,
          concat_ws(E'\n', case when v_org is not null then 'For: ' || v_org end, case when v_purpose is not null then 'Purpose: ' || v_purpose end,
                    case when v_from is not null or v_to is not null then 'Period: ' || coalesce(v_from::text, 'the start') || ' to ' || coalesce(v_to::text, 'today') end),
          now(), 'website', 'signoff:' || v_id, jsonb_build_object('signoff_id', v_id, 'kind', v_kind), 'website account');
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_signoffs', v_id::text, 'status', null, 'requested (' || v_kind || ') on the website profile', 'website (account)');
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;
comment on function public.account_signoff_request(jsonb) is 'wave195: the signed-in volunteer asks for an hours sign-off letter, a recognition letter or their own form signed (uploaded first through the site-account function into requests/<their account>/ in the signoffs bucket). Needs their own volunteer record with at least one confirmed serving; at most signoff_max_open open requests. Logged on their timeline and in change_log.';
revoke execute on function public.account_signoff_request(jsonb) from public;
grant execute on function public.account_signoff_request(jsonb) to anon, authenticated;

create or replace function public.account_signoff_cancel(p_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_uid uuid; v_cid bigint;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'hook'); end if;
  v_cid := public.account_link_user(v_uid, null);
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_linked'); end if;
  update public.volunteer_signoffs set status = 'cancelled', cancelled_at = now(), updated_at = now()
   where id = p_id and contact_id = v_cid and status = 'requested';
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_signoffs', p_id::text, 'status', 'requested', 'cancelled by the volunteer', 'website (account)');
  return jsonb_build_object('ok', true);
end $function$;
comment on function public.account_signoff_cancel(bigint) is 'wave195: the signed-in volunteer withdraws one of their own open requests.';
revoke execute on function public.account_signoff_cancel(bigint) from public;
grant execute on function public.account_signoff_cancel(bigint) to anon, authenticated;

-- files a website account may download (internal; the site-account function hands out a short-lived link)
create or replace function public.account_file_path(p_uid uuid, p_kind text, p_id bigint)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_cid bigint; v_path text; v_name text;
begin
  select contact_id into v_cid from public.account_person(p_uid);
  if v_cid is null then return null; end if;
  if p_kind = 'signoff' then
    select s.letter_path, 'Welfare-Avenue-' || coalesce(s.reference, 'letter') || '.pdf' into v_path, v_name
      from public.volunteer_signoffs s where s.id = p_id and s.contact_id = v_cid and s.status = 'signed';
    if v_path is null then return null; end if;
    return jsonb_build_object('bucket', 'signoffs', 'path', v_path, 'name', v_name);
  elsif p_kind = 'receipt' then
    select r.pdf_path, 'Welfare-Avenue-receipt-' || r.serial || '.pdf' into v_path, v_name
      from public.crm_receipts r where r.id = p_id and r.contact_id = v_cid and r.status = 'issued';
    if v_path is null then return null; end if;
    return jsonb_build_object('bucket', 'receipts', 'path', v_path, 'name', v_name);
  end if;
  return null;
end $function$;
comment on function public.account_file_path(uuid, text, bigint) is 'wave195 (internal): where a website account''s own signed letter or official receipt PDF is, for the site-account function''s short-lived link; null for anything not theirs.';
revoke execute on function public.account_file_path(uuid, text, bigint) from public, anon, authenticated;

-- 6. the team's side (the Sign-offs page in the Volunteer Manager) ---------------------------------------------------------
create or replace function public.signoff_staff_ok()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select public.is_wa_staff() and coalesce(public.wa_page_ok('volunteering'), true);
$function$;
revoke execute on function public.signoff_staff_ok() from public, anon;
grant execute on function public.signoff_staff_ok() to authenticated;
comment on function public.signoff_staff_ok() is 'wave195 (internal): whether the caller is staff with the Volunteer Manager (is_wa_staff and wa_page_ok(''volunteering'')); the signoff_* staff functions check it.';

create or replace function public.signoff_list(p_status text default 'requested')
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_rows jsonb; v_counts jsonb;
begin
  if not public.signoff_staff_ok() then raise exception 'not allowed'; end if;
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into v_counts from (select status, count(*) n from public.volunteer_signoffs group by status) x;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'status', s.status, 'lang', s.lang, 'name', c.full_name, 'contact_id', s.contact_id, 'person_id', s.person_id,
           'for_org', s.for_org, 'purpose', s.purpose, 'period_from', s.period_from, 'period_to', s.period_to, 'notes', s.notes, 'form_name', s.form_name,
           'requested', s.created_at, 'signed', s.signed_at, 'signer', s.signer_name, 'reference', s.reference, 'hours', s.hours, 'servings', s.servings,
           'declined', s.declined_at, 'decline_reason', s.decline_reason, 'emailed', s.emailed_at,
           'now_servings', (select jsonb_array_length(public.signoff_servings(s.person_id, s.period_from, s.period_to))))
           order by case when s.status = 'requested' then s.created_at end asc nulls last, coalesce(s.signed_at, s.declined_at, s.created_at) desc), '[]'::jsonb)
    into v_rows
    from public.volunteer_signoffs s join public.crm_contacts c on c.id = s.contact_id
   where (p_status is null or p_status = 'all' or s.status = p_status) and s.status <> 'cancelled'
   limit 300;
  return jsonb_build_object('rows', v_rows, 'counts', v_counts, 'can_sign', public.signoff_can_sign_email(auth.jwt()->>'email'));
end $function$;
comment on function public.signoff_list(text) is 'wave195: Volunteer Manager staff: the sign-off requests (requested first, oldest first; signed and declined after, newest first), the counts by status, and whether the caller can sign.';
revoke execute on function public.signoff_list(text) from public, anon;
grant execute on function public.signoff_list(text) to authenticated;

create or replace function public.signoff_detail(p_id bigint)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare s record; c record; v_all jsonb; v_in jsonb;
begin
  if not public.signoff_staff_ok() then raise exception 'not allowed'; end if;
  select * into s from public.volunteer_signoffs where id = p_id;
  if not found then return null; end if;
  select * into c from public.crm_contacts where id = s.contact_id;
  v_all := case when s.person_id is null then '[]'::jsonb else public.signoff_servings(s.person_id, null, null) end;
  v_in := case when s.person_id is null then '[]'::jsonb else public.signoff_servings(s.person_id, s.period_from, s.period_to) end;
  return jsonb_build_object('request', to_jsonb(s) - 'letter_sha256' - 'user_id',
    'name', c.full_name, 'first_name', coalesce(nullif(c.first_name, ''), split_part(coalesce(c.full_name, ''), ' ', 1)), 'email', c.primary_email,
    'servings', v_in, 'all_count', jsonb_array_length(v_all),
    'all_hours', coalesce((select sum((x->>'hours')::numeric) from jsonb_array_elements(v_all) x), 0),
    'first', v_all->0->>'date', 'last', v_all->-1->>'date',
    'roles', (select coalesce(jsonb_agg(distinct x->>'role_en'), '[]'::jsonb) from jsonb_array_elements(v_all) x),
    'can_sign', public.signoff_can_sign_email(auth.jwt()->>'email'));
end $function$;
comment on function public.signoff_detail(bigint) is 'wave195: Volunteer Manager staff: one request with the volunteer''s confirmed servings in its period (and their whole record''s count and hours), and whether the caller can sign.';
revoke execute on function public.signoff_detail(bigint) from public, anon;
grant execute on function public.signoff_detail(bigint) to authenticated;

create or replace function public.signoff_decline(p_id bigint, p_reason text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_email text := lower(coalesce(auth.jwt()->>'email', '')); s record; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.signoff_staff_ok() or not public.signoff_can_sign_email(v_email) then raise exception 'Only a signer can decline a request.'; end if;
  if v_reason is null or length(v_reason) < 3 then raise exception 'Say why in a few words (the volunteer sees it).'; end if;
  if length(v_reason) > 500 then raise exception 'Keep the reason under 500 characters.'; end if;
  update public.volunteer_signoffs set status = 'declined', decline_reason = v_reason, declined_at = now(), declined_by = v_email, updated_at = now()
   where id = p_id and status = 'requested' returning * into s;
  if not found then raise exception 'This request is no longer waiting.'; end if;
  insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, meta, created_by)
  values (s.contact_id, 'signoff', 'out', 'web', 'Sign-off request declined', v_reason, now(), 'hub', jsonb_build_object('signoff_id', s.id, 'kind', s.kind), v_email);
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_signoffs', p_id::text, 'status', 'requested', 'declined: ' || v_reason, v_email);
  return jsonb_build_object('ok', true);
end $function$;
comment on function public.signoff_decline(bigint, text) is 'wave195: a signer declines a waiting request with a reason the volunteer sees on their profile. Logged.';
revoke execute on function public.signoff_decline(bigint, text) from public, anon;
grant execute on function public.signoff_decline(bigint, text) to authenticated;

create or replace function public.signoff_signer_me()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_email text := lower(coalesce(auth.jwt()->>'email', '')); s record; v_name text;
begin
  if not public.signoff_staff_ok() then raise exception 'not allowed'; end if;
  select * into s from public.volunteer_signers where email = v_email;
  select m.name into v_name from public.team_members m where lower(m.email) = v_email order by m.active desc limit 1;
  return jsonb_build_object('email', v_email, 'can_sign', public.signoff_can_sign_email(v_email),
    'name', coalesce(s.name, v_name), 'title', s.title, 'title_fr', s.title_fr, 'has_signature', s.signature_path is not null, 'signature_at', s.signature_at,
    'admin', public.is_wa_admin());
end $function$;
comment on function public.signoff_signer_me() is 'wave195: the caller''s signer profile: whether they can sign, the name and titles printed under their signature, and whether a signature is saved (never the image).';
revoke execute on function public.signoff_signer_me() from public, anon;
grant execute on function public.signoff_signer_me() to authenticated;

create or replace function public.signoff_signer_save(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_email text := lower(coalesce(auth.jwt()->>'email', '')); v_name text; v_title text; v_title_fr text;
begin
  if not public.signoff_staff_ok() or not public.signoff_can_sign_email(v_email) then raise exception 'Only a signer can save a signer profile.'; end if;
  v_name := nullif(btrim(coalesce(p->>'name', '')), ''); v_title := nullif(btrim(coalesce(p->>'title', '')), ''); v_title_fr := nullif(btrim(coalesce(p->>'title_fr', '')), '');
  if v_name is null then raise exception 'Your name is printed under your signature.'; end if;
  if v_title is null then raise exception 'Your title is printed under your name.'; end if;
  if length(v_name) > 120 or length(v_title) > 120 or length(coalesce(v_title_fr, '')) > 120 then raise exception 'Keep each line under 120 characters.'; end if;
  insert into public.volunteer_signers (email, name, title, title_fr, updated_at) values (v_email, v_name, v_title, v_title_fr, now())
  on conflict (email) do update set name = excluded.name, title = excluded.title, title_fr = excluded.title_fr, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_signers', v_email, 'profile', null, v_name || ', ' || v_title, v_email);
  return jsonb_build_object('ok', true);
end $function$;
comment on function public.signoff_signer_save(jsonb) is 'wave195: a signer sets the name and title (English, and French) printed under their signature.';
revoke execute on function public.signoff_signer_save(jsonb) from public, anon;
grant execute on function public.signoff_signer_save(jsonb) to authenticated;

create or replace function public.signoff_signers()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_list jsonb; v_people jsonb;
begin
  if not public.signoff_staff_ok() then raise exception 'not allowed'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('email', e.email, 'name', coalesce(s.name, (select m.name from public.team_members m where lower(m.email) = e.email order by m.active desc limit 1), e.email),
           'title', s.title, 'has_signature', s.signature_path is not null, 'why', e.why, 'assigned', coalesce(s.assigned, false)) order by e.why, e.email), '[]'::jsonb)
    into v_list
    from (select r.email, case when r.role = 'admin' then 'admin' else 'lead' end as why from public.hub_roles r
           where r.role = 'admin' or (r.role = 'leader' and r.profile in ('opsmtl', 'opsto'))
          union
          select v.email, 'assigned' from public.volunteer_signers v where v.assigned
            and not exists (select 1 from public.hub_roles r where r.email = v.email and (r.role = 'admin' or (r.role = 'leader' and r.profile in ('opsmtl', 'opsto'))))) e
    left join public.volunteer_signers s on s.email = e.email
   where not exists (select 1 from public.hub_roles b where b.email = e.email and b.role = 'blocked');
  if public.is_wa_admin() then
    select coalesce(jsonb_agg(jsonb_build_object('email', lower(m.email), 'name', m.name, 'department', m.department) order by m.name), '[]'::jsonb) into v_people
      from public.team_members m where m.active and coalesce(m.email, '') like '%@%'
       and not public.signoff_can_sign_email(m.email);
  end if;
  return jsonb_build_object('signers', v_list, 'people', coalesce(v_people, '[]'::jsonb), 'admin', public.is_wa_admin());
end $function$;
comment on function public.signoff_signers() is 'wave195: Volunteer Manager staff: who can sign (admins, Operations leads, people assigned) and whether each has a signature saved; admins also get the team members who could be assigned.';
revoke execute on function public.signoff_signers() from public, anon;
grant execute on function public.signoff_signers() to authenticated;

create or replace function public.signoff_signer_assign(p_email text, p_on boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_me text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if not public.is_wa_staff() or not public.is_wa_admin() then raise exception 'Only an admin can choose who signs.'; end if;
  if position('@' in v_email) < 2 then raise exception 'That is not an email address.'; end if;
  if p_on and not exists (select 1 from public.team_members m where lower(m.email) = v_email and m.active)
         and not exists (select 1 from public.hub_roles r where r.email = v_email and r.role in ('admin', 'leader', 'member')) then
    raise exception 'Only someone on the team can sign.';
  end if;
  insert into public.volunteer_signers (email, assigned, assigned_by, assigned_at, updated_at) values (v_email, coalesce(p_on, false), v_me, now(), now())
  on conflict (email) do update set assigned = coalesce(p_on, false), assigned_by = v_me, assigned_at = now(), updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_signers', v_email, 'assigned', null, case when p_on then 'can sign volunteer sign-offs' else 'no longer assigned to sign' end, v_me);
  return jsonb_build_object('ok', true);
end $function$;
comment on function public.signoff_signer_assign(text, boolean) is 'wave195: an admin assigns (or unassigns) a team member to sign volunteer sign-offs. Logged.';
revoke execute on function public.signoff_signer_assign(text, boolean) from public, anon;
grant execute on function public.signoff_signer_assign(text, boolean) to authenticated;

create or replace function public.signoff_counts()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case when public.signoff_staff_ok() then jsonb_build_object('requested', (select count(*) from public.volunteer_signoffs where status = 'requested')) else '{}'::jsonb end;
$function$;
comment on function public.signoff_counts() is 'wave195: the number of waiting sign-off requests, for the Volunteer Manager''s menu.';
revoke execute on function public.signoff_counts() from public, anon;
grant execute on function public.signoff_counts() to authenticated;

-- 7. the signoff function's side (service role only) ------------------------------------------------------------------------
create or replace function public.signoff_signature_set(p_email text, p_path text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_old text;
begin
  select signature_path into v_old from public.volunteer_signers where email = lower(btrim(p_email));
  insert into public.volunteer_signers (email, signature_path, signature_at, updated_at) values (lower(btrim(p_email)), p_path, now(), now())
  on conflict (email) do update set signature_path = excluded.signature_path, signature_at = now(), updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_signers', lower(btrim(p_email)), 'signature', case when v_old is null then null else 'replaced' end, 'signature saved', lower(btrim(p_email)));
  return jsonb_build_object('ok', true, 'old_path', v_old);
end $function$;
comment on function public.signoff_signature_set(text, text) is 'wave195 (service role): records where a signer''s newly saved signature image is; returns the old path so the function can remove it.';
revoke execute on function public.signoff_signature_set(text, text) from public, anon, authenticated;

create or replace function public.signoff_sign_data(p_id bigint, p_email text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare s record; c record; g record; v_ref text; v_all jsonb; v_cfg jsonb;
begin
  select * into s from public.volunteer_signoffs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.signoff_can_sign_email(p_email) then return jsonb_build_object('ok', false, 'reason', 'not_signer'); end if;
  select * into g from public.volunteer_signers where email = lower(btrim(p_email));
  select * into c from public.crm_contacts where id = s.contact_id;
  v_ref := s.reference;
  if v_ref is null then
    loop
      v_ref := 'WA-VS-' || upper(substr(md5(random()::text || clock_timestamp()::text || p_id::text), 1, 6));
      exit when not exists (select 1 from public.volunteer_signoffs where reference = v_ref);
    end loop;
  end if;
  v_all := case when s.person_id is null then '[]'::jsonb else public.signoff_servings(s.person_id, null, null) end;
  select jsonb_object_agg(key, value) into v_cfg from public.app_config where key in ('mail_charity_number', 'mail_postal_address', 'mail_from_name', 'mail_reply_to');
  return jsonb_build_object('ok', true, 'request', to_jsonb(s) - 'user_id', 'reference', v_ref,
    'volunteer', jsonb_build_object('name', c.full_name, 'first_name', coalesce(nullif(c.first_name, ''), split_part(coalesce(c.full_name, ''), ' ', 1)),
       'lang', coalesce(nullif(c.language, ''), s.lang)),
    'servings', case when s.person_id is null then '[]'::jsonb else public.signoff_servings(s.person_id, s.period_from, s.period_to) end,
    'all', jsonb_build_object('count', jsonb_array_length(v_all), 'hours', coalesce((select sum((x->>'hours')::numeric) from jsonb_array_elements(v_all) x), 0),
       'first', v_all->0->>'date', 'last', v_all->-1->>'date'),
    'signer', jsonb_build_object('email', lower(btrim(p_email)), 'name', coalesce(g.name, (select m.name from public.team_members m where lower(m.email) = lower(btrim(p_email)) order by m.active desc limit 1)),
       'title', g.title, 'title_fr', g.title_fr, 'signature_path', g.signature_path),
    'org', v_cfg);
end $function$;
comment on function public.signoff_sign_data(bigint, text) is 'wave195 (service role): everything the signoff function draws on a letter: the request, the volunteer, their servings in the period and their whole record, the signer (with the path of their signature) and the charity''s details, and the reference (a new WA-VS- one the first time).';
revoke execute on function public.signoff_sign_data(bigint, text) from public, anon, authenticated;

create or replace function public.signoff_mark_signed(p_id bigint, p_email text, p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare s record; v_kind_label text;
begin
  if not public.signoff_can_sign_email(p_email) then raise exception 'not a signer'; end if;
  update public.volunteer_signoffs set status = 'signed', signed_at = now(), updated_at = now(),
         reference = p->>'reference', items = p->'items', servings = nullif(p->>'servings', '')::int, hours = nullif(p->>'hours', '')::numeric,
         signer_note = nullif(p->>'note', ''), placement = p->'placement', signer_email = lower(btrim(p_email)), signer_name = p->>'signer_name', signer_title = p->>'signer_title',
         letter_path = p->>'letter_path', letter_sha256 = p->>'sha256'
   where id = p_id and status = 'requested' returning * into s;
  if not found then raise exception 'This request is no longer waiting.'; end if;
  v_kind_label := case s.kind when 'hours' then 'Hours sign-off letter' when 'recognition' then 'Recognition letter' else 'Their form' end;
  insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
  values (s.contact_id, 'signoff', 'out', 'web', v_kind_label || ' signed by ' || coalesce(s.signer_name, s.signer_email),
          concat_ws(E'\n', 'Reference ' || s.reference, case when s.hours is not null then s.hours::text || ' hours over ' || coalesce(s.servings, 0) || ' servings' end),
          now(), 'hub', 'signoff-signed:' || s.id, jsonb_build_object('signoff_id', s.id, 'kind', s.kind, 'reference', s.reference), s.signer_email);
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_signoffs', p_id::text, 'status', 'requested', 'signed ' || s.reference || coalesce(' (' || s.hours::text || ' h)', ''), s.signer_email);
  return jsonb_build_object('ok', true, 'contact_id', s.contact_id, 'lang', s.lang, 'kind', s.kind, 'reference', s.reference, 'for_org', s.for_org);
end $function$;
comment on function public.signoff_mark_signed(bigint, text, jsonb) is 'wave195 (service role): records a signed request (what was signed, by whom, the reference and the PDF), on the timeline and in change_log.';
revoke execute on function public.signoff_mark_signed(bigint, text, jsonb) from public, anon, authenticated;

create or replace function public.signoff_mark_emailed(p_id bigint, p_send_id bigint)
 returns void
 language sql
 security definer
 set search_path to ''
as $function$
  update public.volunteer_signoffs set emailed_at = now(), email_send_id = p_send_id, updated_at = now() where id = p_id;
$function$;
revoke execute on function public.signoff_mark_emailed(bigint, bigint) from public, anon, authenticated;
comment on function public.signoff_mark_emailed(bigint, bigint) is 'wave195 (service role): records that the volunteer was emailed about a signed letter (emailed_at, the mail-send send id); called by the signoff function.';

-- 8. the email that says a letter is ready (transactional, through mail-send) ----------------------------------------------
insert into public.crm_email_templates (key, name, kind, subject, preheader, html_body, text_body, vars, active, sort, updated_by, updated_at)
values
('signoff_ready', 'A signed volunteer letter is ready', 'transactional', 'Your {{doc_name|signed letter}} is ready', 'Sign in to your Welfare Avenue profile to download it.',
 E'<h1>Your {{doc_name|signed letter}} is ready</h1>\n<p>Hi {{first_name|there}},</p>\n<p>{{signer_name|Our team}} signed your {{doc_name|letter}}{{for_line}}. It is on your profile at welfareavenue.com, ready to download as a PDF.</p>\n<p>Its reference, <strong>{{reference}}</strong>, lets a school or an employer check it with us at info@welfareavenue.com.</p>\n<a class="btn" href="{{account_url|https://welfareavenue.com/account/}}">Open my profile</a>\n<p>Thank you for the time you give our community.</p>\n<p>The Welfare Avenue team</p>',
 E'Hi {{first_name|there}},\n\n{{signer_name|Our team}} signed your {{doc_name|letter}}{{for_line}}. It is on your profile at welfareavenue.com, ready to download as a PDF: {{account_url|https://welfareavenue.com/account/}}\n\nIts reference, {{reference}}, lets a school or an employer check it with us at info@welfareavenue.com.\n\nThank you for the time you give our community.\n\nThe Welfare Avenue team',
 '["first_name","doc_name","for_line","signer_name","reference","account_url"]'::jsonb, true, 60, 'wave195', now()),
('signoff_ready_fr', 'Une lettre de bénévolat signée est prête', 'transactional', 'Votre {{doc_name|lettre signée}} est prête', 'Connectez-vous à votre profil Welfare Avenue pour la télécharger.',
 E'<h1>Votre {{doc_name|lettre signée}} est prête</h1>\n<p>Bonjour {{first_name|}},</p>\n<p>{{signer_name|Notre équipe}} a signé votre {{doc_name|lettre}}{{for_line}}. Elle se trouve dans votre profil sur welfareavenue.com, prête à télécharger en PDF.</p>\n<p>Sa référence, <strong>{{reference}}</strong>, permet à une école ou à un employeur de la vérifier auprès de nous à info@welfareavenue.com.</p>\n<a class="btn" href="{{account_url|https://welfareavenue.com/fr/compte/}}">Ouvrir mon profil</a>\n<p>Merci du temps que vous donnez à notre communauté.</p>\n<p>L''équipe Welfare Avenue</p>',
 E'Bonjour {{first_name|}},\n\n{{signer_name|Notre équipe}} a signé votre {{doc_name|lettre}}{{for_line}}. Elle se trouve dans votre profil sur welfareavenue.com, prête à télécharger en PDF : {{account_url|https://welfareavenue.com/fr/compte/}}\n\nSa référence, {{reference}}, permet à une école ou à un employeur de la vérifier auprès de nous à info@welfareavenue.com.\n\nMerci du temps que vous donnez à notre communauté.\n\nL''équipe Welfare Avenue',
 '["first_name","doc_name","for_line","signer_name","reference","account_url"]'::jsonb, true, 61, 'wave195', now())
on conflict (key) do nothing;

-- 9. the template wording as applied after the migration (02/10/26): one sentence works for a letter or a form in both languages
update public.crm_email_templates set
  subject = 'Your signed {{doc_name|letter}} is ready',
  html_body = E'<h1>Your signed {{doc_name|letter}} is ready</h1>\n<p>Hi {{first_name|there}},</p>\n<p>{{signer_name|Our team}} signed your {{doc_name|letter}}{{for_line}}. It is on your profile at welfareavenue.com, ready to download as a PDF.</p>\n<p>Its reference, <strong>{{reference}}</strong>, lets a school or an employer check it with us at info@welfareavenue.com.</p>\n<a class="btn" href="{{account_url|https://welfareavenue.com/account/}}">Open my profile</a>\n<p>Thank you for the time you give our community.</p>\n<p>The Welfare Avenue team</p>',
  text_body = E'Hi {{first_name|there}},\n\n{{signer_name|Our team}} signed your {{doc_name|letter}}{{for_line}}. It is on your profile at welfareavenue.com, ready to download as a PDF: {{account_url|https://welfareavenue.com/account/}}\n\nIts reference, {{reference}}, lets a school or an employer check it with us at info@welfareavenue.com.\n\nThank you for the time you give our community.\n\nThe Welfare Avenue team',
  updated_at = now()
 where key = 'signoff_ready';
update public.crm_email_templates set
  subject = 'Votre document signé est prêt',
  html_body = E'<h1>Votre document signé est prêt</h1>\n<p>Bonjour {{first_name|}},</p>\n<p>{{signer_name|Notre équipe}} a signé {{doc_name|votre lettre}}{{for_line}}. Le document se trouve dans votre profil sur welfareavenue.com, prêt à télécharger en PDF.</p>\n<p>Sa référence, <strong>{{reference}}</strong>, permet à une école ou à un employeur de le vérifier auprès de nous à info@welfareavenue.com.</p>\n<a class="btn" href="{{account_url|https://welfareavenue.com/fr/compte/}}">Ouvrir mon profil</a>\n<p>Merci du temps que vous donnez à notre communauté.</p>\n<p>L''équipe Welfare Avenue</p>',
  text_body = E'Bonjour {{first_name|}},\n\n{{signer_name|Notre équipe}} a signé {{doc_name|votre lettre}}{{for_line}}. Le document se trouve dans votre profil sur welfareavenue.com, prêt à télécharger en PDF : {{account_url|https://welfareavenue.com/fr/compte/}}\n\nSa référence, {{reference}}, permet à une école ou à un employeur de le vérifier auprès de nous à info@welfareavenue.com.\n\nMerci du temps que vous donnez à notre communauté.\n\nL''équipe Welfare Avenue',
  updated_at = now()
 where key = 'signoff_ready_fr';
