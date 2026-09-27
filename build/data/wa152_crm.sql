-- wa152_crm (27/09/26): the CRM page (People > CRM, #crm) on the wave150 foundation.
-- 1. Pairs someone marked as different people leave the duplicates list (crm_dupe_dismissals).
-- 2. crm_duplicates_v leaves those pairs out.
-- 3. The CRM tables follow the page access in the database (wa_page_ok('crm')), as the finance tables do.
-- 4. crm_merge_contacts(keep, drop): one contact from two, their volunteer records too (volunteer_merge).
-- 5. Comments on every CRM object; no write grants on the views.

-- ---------- 1. different people ----------
create table if not exists public.crm_dupe_dismissals (
  a_id bigint not null references public.crm_contacts(id) on delete cascade,
  b_id bigint not null references public.crm_contacts(id) on delete cascade,
  dismissed_by text,
  dismissed_at timestamptz not null default now(),
  primary key (a_id, b_id),
  constraint crm_dupe_dismissals_order check (a_id < b_id)
);
alter table public.crm_dupe_dismissals enable row level security;
revoke all on public.crm_dupe_dismissals from anon;
drop policy if exists crm_dupe_dismissals_staff_read on public.crm_dupe_dismissals;
create policy crm_dupe_dismissals_staff_read on public.crm_dupe_dismissals for select to authenticated
  using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_dupe_dismissals_staff_insert on public.crm_dupe_dismissals;
create policy crm_dupe_dismissals_staff_insert on public.crm_dupe_dismissals for insert to authenticated
  with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_dupe_dismissals_admin_delete on public.crm_dupe_dismissals;
create policy crm_dupe_dismissals_admin_delete on public.crm_dupe_dismissals for delete to authenticated using (public.is_wa_admin());

-- ---------- 2. the duplicates view ----------
create or replace view public.crm_duplicates_v with (security_invoker = true) as
select d.contact_id, d.duplicate_id, d.matched_on, d.value
from (
  select a.id as contact_id, b.id as duplicate_id, 'email'::text as matched_on, a.primary_email as value
  from public.crm_contacts a
  join public.crm_contacts b on b.primary_email = a.primary_email and a.id < b.id
  where a.merged_into is null and b.merged_into is null and a.primary_email is not null
  union all
  select a.id, b.id, 'phone'::text, p.phone
  from public.crm_contacts a
  cross join lateral unnest(a.phones) as p(phone)
  join public.crm_contacts b on p.phone = any (b.phones) and a.id < b.id
  where a.merged_into is null and b.merged_into is null and btrim(p.phone) <> ''
) d
where not exists (select 1 from public.crm_dupe_dismissals x where x.a_id = d.contact_id and x.b_id = d.duplicate_id);
revoke all on public.crm_duplicates_v from anon;
revoke insert, update, delete on public.crm_contacts_v, public.crm_duplicates_v from anon, authenticated;

-- ---------- 3. the page access, in the database ----------
alter policy crm_contacts_staff_read on public.crm_contacts using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_contacts_staff_insert on public.crm_contacts with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_contacts_staff_update on public.crm_contacts using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_contact_orgs_staff_read on public.crm_contact_orgs using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_contact_orgs_staff_insert on public.crm_contact_orgs with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_contact_orgs_staff_update on public.crm_contact_orgs using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_interactions_staff_read on public.crm_interactions using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_interactions_staff_insert on public.crm_interactions with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_interactions_staff_update on public.crm_interactions using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_donations_staff_read on public.crm_donations using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_donations_staff_insert on public.crm_donations with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_donations_staff_update on public.crm_donations using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
alter policy crm_volunteer_history_staff_read on public.crm_volunteer_history using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
-- a note or an email someone logged is theirs to delete; admins can delete anything
drop policy if exists crm_interactions_admin_delete on public.crm_interactions;
create policy crm_interactions_delete on public.crm_interactions for delete to authenticated
  using (public.is_wa_admin() or (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and source = 'hub' and lower(coalesce(created_by, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));
-- a link to an organization can be undone by any staff who can see the CRM
drop policy if exists crm_contact_orgs_admin_delete on public.crm_contact_orgs;
create policy crm_contact_orgs_staff_delete on public.crm_contact_orgs for delete to authenticated
  using (public.is_wa_admin() or (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)));

-- ---------- 4. merging two contacts ----------
create or replace function public.crm_merge_contacts(p_keep bigint, p_drop bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.crm_contacts%rowtype;
  d public.crm_contacts%rowtype;
  n_int int := 0; n_gift int := 0; n_hist int := 0; n_org int := 0;
  vol jsonb := null;
  who text := lower(coalesce(auth.jwt() ->> 'email', 'staff'));
begin
  if not (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) then raise exception 'not allowed'; end if;
  if p_keep = p_drop then raise exception 'same contact'; end if;
  select * into k from public.crm_contacts where id = p_keep and merged_into is null;
  if not found then raise exception 'contact % is not in the CRM', p_keep; end if;
  select * into d from public.crm_contacts where id = p_drop and merged_into is null;
  if not found then raise exception 'contact % is not in the CRM', p_drop; end if;

  -- the history moves to the one we keep
  update public.crm_interactions set contact_id = p_keep where contact_id = p_drop; get diagnostics n_int = row_count;
  update public.crm_donations set contact_id = p_keep where contact_id = p_drop; get diagnostics n_gift = row_count;
  update public.crm_volunteer_history set contact_id = p_keep where contact_id = p_drop; get diagnostics n_hist = row_count;
  delete from public.crm_contact_orgs o where o.contact_id = p_drop
    and exists (select 1 from public.crm_contact_orgs x where x.contact_id = p_keep and x.partner_id = o.partner_id);
  update public.crm_contact_orgs set contact_id = p_keep where contact_id = p_drop; get diagnostics n_org = row_count;
  delete from public.crm_dupe_dismissals where a_id in (p_keep, p_drop) or b_id in (p_keep, p_drop);

  -- the copy gives up its links first (they are unique per contact)
  update public.crm_contacts set volunteer_id = null, member_id = null, auth_user_id = null where id = p_drop;

  -- the details: what we keep wins, the copy fills the gaps; the lists join up
  update public.crm_contacts set
    emails = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(k.emails, '{}') || coalesce(d.emails, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
    phones = coalesce((select array_agg(x order by ord) from (select distinct on (btrim(x)) btrim(x) as x, ord from unnest(coalesce(k.phones, '{}') || coalesce(d.phones, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by btrim(x), ord) s), '{}'),
    tags = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(k.tags, '{}') || coalesce(d.tags, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
    kinds = coalesce((select array_agg(x order by ord) from (select distinct on (x) x, ord from unnest(coalesce(k.kinds, '{}') || coalesce(d.kinds, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by x, ord) s), '{}'),
    first_name = coalesce(nullif(k.first_name, ''), d.first_name),
    last_name = coalesce(nullif(k.last_name, ''), d.last_name),
    address = coalesce(nullif(k.address, ''), d.address),
    city = coalesce(nullif(k.city, ''), d.city),
    province = coalesce(nullif(k.province, ''), d.province),
    postal_code = coalesce(nullif(k.postal_code, ''), d.postal_code),
    country = coalesce(nullif(k.country, ''), d.country),
    language = coalesce(nullif(k.language, ''), d.language),
    email_status = case when k.email_status in ('unsubscribed', 'complained', 'bounced') then k.email_status
                        when d.email_status in ('unsubscribed', 'complained', 'bounced') then d.email_status else k.email_status end,
    email_consent = case when 'express' in (k.email_consent, d.email_consent) then 'express'
                         when 'implied' in (k.email_consent, d.email_consent) then 'implied' else coalesce(k.email_consent, d.email_consent) end,
    consent_source = case when k.email_consent = 'express' then k.consent_source when d.email_consent = 'express' then d.consent_source else coalesce(k.consent_source, d.consent_source) end,
    consent_at = greatest(k.consent_at, d.consent_at),
    implied_consent_until = greatest(k.implied_consent_until, d.implied_consent_until),
    sms_opt_out = coalesce(k.sms_opt_out, false) or coalesce(d.sms_opt_out, false),
    notes = case when coalesce(d.notes, '') = '' then k.notes when coalesce(k.notes, '') = '' then d.notes else k.notes || E'\n' || d.notes end,
    legacy_refs = coalesce(k.legacy_refs, '{}'::jsonb) || coalesce(d.legacy_refs, '{}'::jsonb) || jsonb_build_object('merged_contact_ids', coalesce(k.legacy_refs -> 'merged_contact_ids', '[]'::jsonb) || to_jsonb(p_drop)),
    member_id = coalesce(k.member_id, d.member_id),
    auth_user_id = coalesce(k.auth_user_id, d.auth_user_id),
    owner_member_id = coalesce(k.owner_member_id, d.owner_member_id),
    last_activity_at = greatest(k.last_activity_at, d.last_activity_at),
    volunteer_id = coalesce(k.volunteer_id, d.volunteer_id),
    updated_by = who
  where id = p_keep;

  -- two volunteer records become one (the rosters move with them)
  if k.volunteer_id is not null and d.volunteer_id is not null and k.volunteer_id <> d.volunteer_id then
    vol := public.volunteer_merge(k.volunteer_id, d.volunteer_id);
  end if;

  update public.crm_contacts set merged_into = p_keep, updated_by = who where id = p_drop;
  begin
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('crm_contact', p_keep::text, 'merged', d.full_name || ' (#' || p_drop || ')', k.full_name || ' (+' || (n_int + n_gift + n_hist + n_org) || ' rows of history)', who);
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'keep', p_keep, 'drop', p_drop, 'interactions', n_int, 'donations', n_gift, 'history', n_hist, 'organizations', n_org, 'volunteers', vol);
end $$;
revoke execute on function public.crm_merge_contacts(bigint, bigint) from public, anon;
grant execute on function public.crm_merge_contacts(bigint, bigint) to authenticated;

-- ---------- 5. what everything is ----------
comment on table public.crm_contacts is 'The CRM (wave150/152): one row per person Welfare Avenue knows (volunteers, donors, partner contacts, supporters, staff, alumni). Staff with the CRM page read and write it (wa_page_ok(''crm'')); directors never. A volunteer''s name, emails, phones and address come from volunteer_people through crm_sync_from_volunteer; edit them there. A merged copy keeps its row with merged_into set; read crm_contacts_v for the live ones.';
comment on column public.crm_contacts.kinds is 'What they are to us, several allowed: volunteer, donor, partner, supporter, staff, alumni, board.';
comment on column public.crm_contacts.tags is 'Free tags staff give on the CRM page (lower case).';
comment on column public.crm_contacts.source is 'Where the contact came from: django_website_export (the old website''s volunteers, July 2026), hub_roster (staff and alumni), hub_volunteers (MTL volunteering), hub (added on the CRM page), zeffy, website, keela.';
comment on column public.crm_contacts.volunteer_id is 'Their volunteer record (volunteer_people.id), unique; the trigger keeps the names and contact details in step.';
comment on column public.crm_contacts.member_id is 'Their roster row (team_members.id) for staff and alumni.';
comment on column public.crm_contacts.legacy_refs is 'Ids in the systems they came from: volunteer_people_id, django user/volunteer ids, keela contact id, zeffy ids, merged_contact_ids.';
comment on column public.crm_contacts.email_status is 'What their address does: unknown, subscribed, unsubscribed, bounced, complained. An opt-out or a bounce wins over any consent.';
comment on column public.crm_contacts.email_consent is 'CASL: express (they said yes), implied (an existing relationship: a gift, volunteering, a membership), none. Campaigns go only to express, or implied that has not run out.';
comment on column public.crm_contacts.consent_source is 'Where the consent came from (the website form, a sign-up sheet, an email).';
comment on column public.crm_contacts.consent_at is 'When express consent was given.';
comment on column public.crm_contacts.implied_consent_until is 'The day implied consent runs out (two years after the last gift, membership or volunteering).';
comment on column public.crm_contacts.merged_into is 'Set when this row was merged into another contact (crm_merge_contacts); the row stays for the record.';
comment on column public.crm_contacts.last_activity_at is 'The last outward or inward touch logged on their timeline (not internal notes).';
comment on table public.crm_contact_orgs is 'A contact''s organizations from Partners (wa_partners), with their role there. Staff with the CRM page write it.';
comment on table public.crm_interactions is 'A contact''s timeline: notes, calls, meetings, emails and texts logged on the CRM page (source hub), and later the website''s messages (website_message) and campaign emails. The author (or an admin) deletes an entry.';
comment on column public.crm_interactions.kind is 'note, call, meeting, email, sms, website_message, form, campaign.';
comment on column public.crm_interactions.direction is 'in (they reached us), out (we reached them), internal (a note).';
comment on column public.crm_interactions.source_ref is 'The id in the system it came from (a website message id, a campaign send id); unique when set.';
comment on table public.crm_donations is 'Gifts: amount, date, platform (zeffy, keela, stripe, cash), campaign, and the tax receipt (number, date, link, who issued it). Zeffy and the Keela export fill it; staff with the CRM page may add a gift by hand.';
comment on column public.crm_donations.external_id is 'The gift''s id in its platform; unique per platform.';
comment on column public.crm_donations.receipt_source is 'Who issued the receipt: zeffy, keela, hub, none.';
comment on table public.crm_volunteer_history is 'The old website''s volunteering history (Django VolunteerAssignment rows): each sign-up, whether it was approved, confirmed, attended, the hours. Admin-only writes (the import); everyone with the CRM page reads it.';
comment on table public.crm_dupe_dismissals is 'Pairs of contacts someone marked as different people on the CRM page (family members sharing a phone, say); crm_duplicates_v leaves them out. Smaller id first.';
comment on view public.crm_contacts_v is 'The live contacts (not merged) with their volunteer roles and tags, Hub servings (confirmed at completed events), the old website''s servings and hours, gift totals and organization names. The CRM page reads this.';
comment on view public.crm_duplicates_v is 'Pairs of live contacts with the same email or phone, less the pairs marked as different people. The CRM page''s Possible duplicates tab.';
comment on function public.crm_merge_contacts(bigint, bigint) is 'Keep one contact and merge the other into it: the history, gifts, old website history and organizations move, the lists join up, the copy fills the gaps in the details, two volunteer records become one (volunteer_merge). Staff with the CRM page; logged in change_log.';
comment on function public.crm_sync_from_volunteer() is 'Trigger on volunteer_people: a new or changed volunteer creates or updates their CRM contact (linking an existing contact with the same email instead of duplicating).';
