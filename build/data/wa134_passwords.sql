-- wave134 (26/09/26): Important info stays open to everyone on staff; a password is shown only to
-- the people an admin has approved (and to whoever added it, and to admins).
-- Steel: "By default the important info section with passwords should be there for everyone and if
-- they want to see a password they must request it"

-- 1. who may see which login
create table if not exists public.info_link_access (
  id bigint generated always as identity primary key,
  link_id bigint not null references public.info_links(id) on update cascade on delete cascade,
  email text not null,
  status text not null default 'requested' check (status in ('requested', 'granted', 'declined', 'revoked')),
  note text,
  requested_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  unique (link_id, email)
);
create index if not exists idx_info_link_access_email on public.info_link_access (email);
alter table public.info_link_access enable row level security;
drop policy if exists info_link_access_read on public.info_link_access;
create policy info_link_access_read on public.info_link_access for select to authenticated
  using (email = public.wa_email() or public.is_hub_admin());
revoke all on public.info_link_access from anon, authenticated;
grant select on public.info_link_access to authenticated;
comment on table public.info_link_access is 'Who may see which password on the Important info page (info_links rows with kind = password). One row per login and person (email, lower case): requested, granted, declined or revoked. Written only through info_request(), info_decide() and info_grant(); the person who adds a login is granted automatically. People read their own rows; admins read all.';
comment on column public.info_link_access.status is 'requested (waiting for an admin), granted, declined or revoked.';
comment on column public.info_link_access.note is 'Why the person needs it (optional, from the request).';
comment on column public.info_link_access.decided_by is 'Email of the admin who decided, or ''added it'' for the person who added the login.';

-- 2. the password column is no longer readable through the API (everything else on the page is)
revoke select on public.info_links from anon, authenticated;
grant select (id, kind, label, url, username, department, notes, sort, added_by, updated_at) on public.info_links to authenticated;
comment on column public.info_links.secret is 'For kind = password: the shared login. Not readable through the API: info_secret() returns it to admins, to whoever added it and to people an admin approved (info_link_access), and logs each view. Never copy it into prompts, logs or messages.';

-- 3. whoever adds a login can see it
create or replace function public.info_links_grant_adder()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.kind = 'password' and public.wa_email() <> '' then
    insert into public.info_link_access (link_id, email, status, decided_by, decided_at)
    values (new.id, public.wa_email(), 'granted', 'added it', now())
    on conflict (link_id, email) do update set status = 'granted', decided_by = 'added it', decided_at = now();
  end if;
  return new;
end $$;
revoke all on function public.info_links_grant_adder() from public, anon, authenticated;
drop trigger if exists info_links_grant_adder on public.info_links;
create trigger info_links_grant_adder after insert on public.info_links for each row execute function public.info_links_grant_adder();

-- 4. show a password (admins, whoever added it, and approved people); every view goes in the audit trail
create or replace function public.info_secret(p_link_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_email text := public.wa_email(); r public.info_links;
begin
  if v_email = '' or not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select * into r from public.info_links where id = p_link_id;
  if r.id is null then raise exception 'That login is gone'; end if;
  if not (public.is_hub_admin() or exists (select 1 from public.info_link_access a where a.link_id = r.id and a.email = v_email and a.status = 'granted')) then
    raise exception 'Request access to see this password';
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('info_link', r.id::text, 'password viewed', null, r.label, public.wa_actor_name());
  return jsonb_build_object('id', r.id, 'username', r.username, 'secret', r.secret);
end $$;

-- 5. ask to see one
create or replace function public.info_request(p_link_id bigint, p_note text default null)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare v_email text := public.wa_email(); v_status text; r public.info_links;
begin
  if v_email = '' or not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select * into r from public.info_links where id = p_link_id;
  if r.id is null then raise exception 'That login is gone'; end if;
  if public.is_hub_admin() then return 'granted'; end if;
  select status into v_status from public.info_link_access where link_id = r.id and email = v_email;
  if v_status = 'granted' then return 'granted'; end if;
  insert into public.info_link_access (link_id, email, status, note)
  values (r.id, v_email, 'requested', left(nullif(trim(coalesce(p_note, '')), ''), 300))
  on conflict (link_id, email) do update set status = 'requested', note = excluded.note, requested_at = now(), decided_by = null, decided_at = null;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('info_link', r.id::text, 'password requested', v_status, r.label, public.wa_actor_name());
  return 'requested';
end $$;

-- 6. an admin grants, declines or revokes a request
create or replace function public.info_decide(p_access_id bigint, p_status text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare a public.info_link_access; v_label text;
begin
  if not public.is_hub_admin() then raise exception 'Only admins decide who sees a password'; end if;
  if p_status not in ('granted', 'declined', 'revoked') then raise exception 'Unknown decision'; end if;
  update public.info_link_access set status = p_status, decided_by = public.wa_email(), decided_at = now()
  where id = p_access_id returning * into a;
  if a.id is null then raise exception 'That request is gone'; end if;
  select label into v_label from public.info_links where id = a.link_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('info_link', a.link_id::text, 'password ' || p_status, a.email, v_label, public.wa_actor_name());
  return p_status;
end $$;

-- 7. an admin gives someone access without a request
create or replace function public.info_grant(p_link_id bigint, p_email text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_label text;
begin
  if not public.is_hub_admin() then raise exception 'Only admins decide who sees a password'; end if;
  if v_email = '' then raise exception 'Pick a person'; end if;
  select label into v_label from public.info_links where id = p_link_id and kind = 'password';
  if v_label is null then raise exception 'That login is gone'; end if;
  insert into public.info_link_access (link_id, email, status, decided_by, decided_at)
  values (p_link_id, v_email, 'granted', public.wa_email(), now())
  on conflict (link_id, email) do update set status = 'granted', decided_by = public.wa_email(), decided_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('info_link', p_link_id::text, 'password granted', v_email, v_label, public.wa_actor_name());
  return 'granted';
end $$;

revoke all on function public.info_secret(bigint) from public, anon;
revoke all on function public.info_request(bigint, text) from public, anon;
revoke all on function public.info_decide(bigint, text) from public, anon;
revoke all on function public.info_grant(bigint, text) from public, anon;
grant execute on function public.info_secret(bigint) to authenticated;
grant execute on function public.info_request(bigint, text) to authenticated;
grant execute on function public.info_decide(bigint, text) to authenticated;
grant execute on function public.info_grant(bigint, text) to authenticated;
comment on function public.info_secret(bigint) is 'Returns {id, username, secret} of a login on the Important info page to admins, to whoever added it and to people an admin approved; logs each view in change_log. Access: authenticated (checks inside).';
comment on function public.info_request(bigint, text) is 'Asks to see a password on the Important info page (with an optional reason); admins decide. Staff only. Access: authenticated.';
comment on function public.info_decide(bigint, text) is 'Admins grant, decline or revoke a request to see a password (info_link_access). Logged. Access: authenticated (admins only, checked inside).';
comment on function public.info_grant(bigint, text) is 'Admins give a person access to a password without a request. Logged. Access: authenticated (admins only, checked inside).';
comment on function public.info_links_grant_adder() is 'Trigger on info_links insert: whoever adds a password can see it (a granted info_link_access row).';
