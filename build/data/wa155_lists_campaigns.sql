-- wa155_lists_campaigns (28/09/26): lists and campaigns for the CRM (step 3 of the 27/09/26 plan, first half).
-- Saved lists (a dynamic list keeps the CRM's filters and is evaluated in SQL by crm_list_members; a static list keeps
-- the ids), campaigns (a template, a list, the words; the send is a queue in crm_email_sends drained by mail-send's
-- campaign_pump at Resend's pace), per-campaign stats, and the minute cron that drains the queue while anything waits.

-- ---------- lists ----------
create table if not exists public.crm_lists (
  id bigserial primary key,
  name text not null,
  description text,
  kind text not null default 'dynamic' check (kind in ('dynamic', 'static')),
  filter jsonb not null default '{}'::jsonb,
  member_ids bigint[] not null default '{}'::bigint[],
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table public.crm_lists is 'Saved lists of contacts for campaigns (wave155). A dynamic list keeps the CRM page''s filters in filter (kind, role, act, perm, q, city, tags) and is evaluated by crm_list_members() when it is read, so it follows the data; a static list keeps member_ids picked by hand. Staff with the CRM page read and write.';
comment on column public.crm_lists.filter is 'The CRM page''s filters as JSON: kind (volunteer, donor, partner, supporter, staff, alumni, board), role (a volunteer role), act (served12, served, never, review, noemail, new30), perm (express, implied, unknown, none, unsub), q (a search), city, tags (any of).';
alter table public.crm_lists enable row level security;
drop policy if exists crm_lists_staff_read on public.crm_lists;
create policy crm_lists_staff_read on public.crm_lists for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_lists_staff_write on public.crm_lists;
create policy crm_lists_staff_write on public.crm_lists for insert to authenticated with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_lists_staff_update on public.crm_lists;
create policy crm_lists_staff_update on public.crm_lists for update to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_lists_staff_delete on public.crm_lists;
create policy crm_lists_staff_delete on public.crm_lists for delete to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
grant select, insert, update, delete on public.crm_lists to authenticated;
grant usage, select on sequence public.crm_lists_id_seq to authenticated;

-- the permission key the CRM page shows (permKey in parts152), in SQL, for list filters
create or replace function public.crm_perm_key(p_status text, p_consent text, p_until date)
returns text language sql immutable set search_path to '' as $$
  select case
    when lower(coalesce(p_status, '')) in ('unsubscribed', 'complained') then 'unsub'
    when lower(coalesce(p_status, '')) = 'bounced' then 'bounced'
    when lower(coalesce(p_consent, '')) = 'express' then 'express'
    when lower(coalesce(p_consent, '')) = 'implied' then case when p_until is null or p_until >= current_date then 'implied' else 'unknown' end
    when lower(coalesce(p_consent, '')) = 'none' then 'none'
    else 'unknown' end
$$;
comment on function public.crm_perm_key(text, text, date) is 'The email permission as the CRM page shows it (wave155): unsub, bounced, express, implied (not run out), none, unknown. The same rule as permKey in the page; crm_email_permission() is the one to trust before a send.';

-- for matching, as the page's fold(): lower case, the common accents off (Émilie finds emilie)
create or replace function public.crm_fold(p text)
returns text language sql immutable set search_path to '' as $$
  select translate(lower(coalesce(p, '')), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa')
$$;
comment on function public.crm_fold(text) is 'Lower case with the common accents removed, for matching names and searches (wave155); the page''s fold() in SQL.';

-- the members of a filter (the CRM page''s filters, evaluated in the database; applied 28/09/26 as wa155_lists_campaigns, the
-- search made token-by-token with crm_fold in wa155_list_search the same evening)
create or replace function public.crm_list_preview(p_filter jsonb)
returns setof bigint language sql stable security invoker set search_path to '' as $$
  with f as (
    select nullif(p_filter->>'kind', '') as kind, nullif(p_filter->>'role', '') as role, nullif(p_filter->>'act', '') as act,
           nullif(p_filter->>'perm', '') as perm, nullif(public.crm_fold(trim(p_filter->>'q')), '') as q, nullif(public.crm_fold(trim(p_filter->>'city')), '') as city,
           coalesce((select array_agg(public.crm_fold(x)) from jsonb_array_elements_text(case when jsonb_typeof(p_filter->'tags') = 'array' then p_filter->'tags' else '[]'::jsonb end) x), '{}'::text[]) as tags
  )
  select c.id
  from public.crm_contacts_v c, f
  where c.merged_into is null
    and (f.kind is null or case f.kind
          when 'donor' then ('donor' = any(coalesce(c.kinds, '{}')) or coalesce(c.donation_count, 0) > 0)
          when 'partner' then ('partner' = any(coalesce(c.kinds, '{}')) or coalesce(array_length(c.org_names, 1), 0) > 0)
          else f.kind = any(coalesce(c.kinds, '{}')) end)
    and (f.role is null or f.role = any(coalesce(c.volunteer_roles, '{}')) or f.role = any(coalesce(c.volunteer_tags, '{}')))
    and (f.act is null or case f.act
          when 'served12' then c.last_serving_on >= current_date - 365
          when 'served' then coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) > 0
          when 'never' then 'volunteer' = any(coalesce(c.kinds, '{}')) and coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) = 0
          when 'review' then coalesce(c.volunteer_needs_review, false)
          when 'noemail' then coalesce(array_length(c.emails, 1), 0) = 0
          when 'new30' then c.created_at >= now() - interval '30 days'
          else true end)
    and (f.perm is null or public.crm_perm_key(c.email_status, c.email_consent, c.implied_consent_until) = f.perm
         or (f.perm = 'unsub' and public.crm_perm_key(c.email_status, c.email_consent, c.implied_consent_until) = 'bounced'))
    and (f.city is null or public.crm_fold(c.city) like '%' || f.city || '%')
    and (cardinality(f.tags) = 0 or exists (select 1 from unnest(coalesce(c.tags, '{}')) t where public.crm_fold(t) = any(f.tags)))
    -- every word of the search somewhere in the name, the emails, the phones, the city, the organizations, the tags (the page's _hay)
    and (f.q is null or not exists (
          select 1 from unnest(string_to_array(f.q, ' ')) w
          where w <> '' and position(w in public.crm_fold(coalesce(c.full_name, '') || ' ' || array_to_string(coalesce(c.emails, '{}'), ' ') || ' ' || array_to_string(coalesce(c.phones, '{}'), ' ') || ' ' || coalesce(c.city, '') || ' ' || coalesce(c.volunteer_organization, '') || ' ' || array_to_string(coalesce(c.org_names, '{}'), ' ') || ' ' || array_to_string(coalesce(c.tags, '{}'), ' ') || ' ' || array_to_string(coalesce(c.volunteer_roles, '{}'), ' ') || ' ' || array_to_string(coalesce(c.kinds, '{}'), ' '))) = 0))
$$;
comment on function public.crm_list_preview(jsonb) is 'The contact ids a CRM filter (crm_lists.filter shape) selects today (wave155). Runs with the reader''s rights over crm_contacts_v. The page uses it to count a list; mail-send uses it to build a campaign''s queue.';
revoke all on function public.crm_list_preview(jsonb) from public, anon;
grant execute on function public.crm_list_preview(jsonb) to authenticated, service_role;

create or replace function public.crm_list_members(p_list_id bigint)
returns setof bigint language sql stable security invoker set search_path to '' as $$
  select m from (
    select unnest(l.member_ids) as m from public.crm_lists l where l.id = p_list_id and l.kind = 'static'
    union
    select x from public.crm_lists l, public.crm_list_preview(l.filter) x where l.id = p_list_id and l.kind = 'dynamic'
  ) s where exists (select 1 from public.crm_contacts_v c where c.id = s.m and c.merged_into is null)
$$;
comment on function public.crm_list_members(bigint) is 'The live contact ids in a list (wave155): the filter''s result for a dynamic list, the picked ids (still live) for a static one.';
revoke all on function public.crm_list_members(bigint) from public, anon;
grant execute on function public.crm_list_members(bigint) to authenticated, service_role;

-- ---------- campaigns ----------
create table if not exists public.crm_campaigns (
  id bigserial primary key,
  name text not null,
  list_id bigint references public.crm_lists(id) on delete set null,
  template_key text references public.crm_email_templates(key) on delete set null,
  kind text not null default 'newsletter' check (kind in ('newsletter', 'fundraising', 'transactional')),
  subject text,
  preheader text,
  vars jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'queued', 'sending', 'sent', 'cancelled')),
  audience int,
  eligible int,
  held int,
  queued_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table public.crm_campaigns is 'An email campaign (wave155): a list, a template, the words (subject, preheader, vars such as headline, body_html, cta_url, cta_label) and its life: draft (staff edit it on the Campaigns tab), queued and sending (mail-send campaign_queue built the rows in crm_email_sends after the CASL rule; campaign_pump drains them), sent, cancelled. Counts: audience (people in the list), eligible (the rule said yes), held (the rule said no). Staff with the CRM page read and edit drafts; the functions move the status.';
comment on column public.crm_campaigns.kind is 'What the messages are under CASL: newsletter (consent needed), fundraising (consent needed unless the exemption setting is on), transactional (anyone with a working address). mail-send applies crm_email_permission with this kind.';
comment on column public.crm_campaigns.vars is 'The placeholders for the template: headline, body_html (paragraphs), cta_url, cta_label, and anything else the template names.';
alter table public.crm_campaigns enable row level security;
drop policy if exists crm_campaigns_staff_read on public.crm_campaigns;
create policy crm_campaigns_staff_read on public.crm_campaigns for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_campaigns_staff_insert on public.crm_campaigns;
create policy crm_campaigns_staff_insert on public.crm_campaigns for insert to authenticated with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and status = 'draft');
drop policy if exists crm_campaigns_staff_update on public.crm_campaigns;
create policy crm_campaigns_staff_update on public.crm_campaigns for update to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and status = 'draft') with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and status = 'draft');
drop policy if exists crm_campaigns_staff_delete on public.crm_campaigns;
create policy crm_campaigns_staff_delete on public.crm_campaigns for delete to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and status = 'draft');
grant select, insert, update, delete on public.crm_campaigns to authenticated;
grant usage, select on sequence public.crm_campaigns_id_seq to authenticated;

-- the send log learns campaigns and a cancelled state
alter table public.crm_email_sends add column if not exists campaign_id bigint references public.crm_campaigns(id) on delete set null;
comment on column public.crm_email_sends.campaign_id is 'The campaign this send belongs to (wave155); null for a single send from a contact''s page or a test.';
alter table public.crm_email_sends drop constraint if exists crm_email_sends_status_check;
alter table public.crm_email_sends add constraint crm_email_sends_status_check check (status in ('queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'suppressed', 'cancelled'));
create index if not exists crm_email_sends_campaign_idx on public.crm_email_sends (campaign_id, status);
create index if not exists crm_email_sends_queue_idx on public.crm_email_sends (id) where status = 'queued';

create or replace view public.crm_campaign_stats_v with (security_invoker = true) as
select c.id as campaign_id,
  count(s.id) as total,
  count(s.id) filter (where s.status = 'queued') as queued,
  count(s.id) filter (where s.status in ('sent', 'delivered', 'delayed', 'bounced', 'complained')) as sent,
  count(s.id) filter (where s.status = 'delivered' or s.delivered_at is not null) as delivered,
  count(s.id) filter (where s.opened_at is not null) as opened,
  count(s.id) filter (where s.clicked_at is not null) as clicked,
  count(s.id) filter (where s.status = 'bounced') as bounced,
  count(s.id) filter (where s.status = 'complained') as complained,
  count(s.id) filter (where s.status = 'failed') as failed,
  count(s.id) filter (where s.status = 'suppressed') as suppressed,
  count(s.id) filter (where s.status = 'cancelled') as cancelled,
  count(s.id) filter (where s.unsubscribed_at is not null) as unsubscribed,
  min(s.sent_at) as first_sent_at, max(s.sent_at) as last_sent_at
from public.crm_campaigns c left join public.crm_email_sends s on s.campaign_id = c.id
group by c.id;
comment on view public.crm_campaign_stats_v is 'Per-campaign counts from the send log (wave155): queued, sent, delivered, opened, clicked, bounced, complained, failed, suppressed (the rule said no), cancelled, unsubscribed. Reader''s rights (security_invoker).';
grant select on public.crm_campaign_stats_v to authenticated;

-- ---------- the queue drains every minute while anything waits ----------
select cron.unschedule('wa-mail-pump') where exists (select 1 from cron.job where jobname = 'wa-mail-pump');
select cron.schedule('wa-mail-pump', '* * * * *', $$select public.call_edge('mail-send', '{"action":"campaign_pump"}'::jsonb) where exists (select 1 from public.crm_email_sends where status = 'queued');$$);
