-- wa155b_lists_campaigns_v2 (27/09/26, after the CRM deep dive): lists with AND/OR groups of conditions, the volunteer
-- message kind (Steel 27/09/26: volunteer call-outs go "Keela's way", to everyone not unsubscribed or bouncing),
-- per-campaign senders, a daily sending cap for Resend's free plan (100 a day; campaigns take at most 80), and a claim
-- on queued sends so two pump runs never take the same row.

-- ---------- the volunteer kind in the rule ----------
create or replace function public.crm_email_permission(p_contact_id bigint, p_kind text default 'newsletter')
returns table(allowed boolean, basis text, until date, email text, status text)
language plpgsql stable set search_path to '' as $function$
declare
  c record; last_gift date; last_serve date; last_act date; imp_until date; exemption text;
begin
  select x.id, coalesce(x.primary_email, x.emails[1]) as em, coalesce(x.email_status, 'unknown') as st, x.email_consent, x.consent_source, x.implied_consent_until, x.merged_into, x.volunteer_id
    into c from public.crm_contacts x where x.id = p_contact_id;
  if c.id is null then return query select false, 'no such contact', null::date, null::text, null::text; return; end if;
  if c.merged_into is not null then return query select false, 'merged into another contact', null::date, c.em::text, c.st::text; return; end if;
  if c.em is null or c.em = '' then return query select false, 'no email address', null::date, null::text, c.st::text; return; end if;
  if c.st in ('bounced', 'complained') then return query select false, c.st::text, null::date, c.em::text, c.st::text; return; end if;
  if p_kind = 'transactional' or p_kind = 'test' then return query select true, 'transactional: a confirmation, reminder or receipt, not a commercial message'::text, null::date, c.em::text, c.st::text; return; end if;
  if c.st = 'unsubscribed' then return query select false, 'unsubscribed'::text, null::date, c.em::text, c.st::text; return; end if;
  if c.email_consent = 'express' then
    return query select true, ('express consent' || coalesce(' (' || c.consent_source || ')', ''))::text, null::date, c.em::text, c.st::text; return;
  end if;
  /* a volunteer call-out goes to everyone with a working address who has not unsubscribed (Steel, 27/09/26: "Keela's way", opted in and unknown) */
  if p_kind = 'volunteer' then
    return query select true, 'volunteer message: not unsubscribed (the team''s rule since 27/09/26)'::text, null::date, c.em::text, c.st::text; return;
  end if;
  /* implied consent (CASL s.10(13)): a gift to, or volunteering for, a registered charity within the last two years */
  select max(d.donated_at)::date into last_gift from public.crm_donations d where d.contact_id = p_contact_id;
  select max(y.d) into last_serve from (
    select e.event_date as d from public.event_roster r join public.volunteer_events e on e.id = r.event_id
      where c.volunteer_id is not null and r.person_id = c.volunteer_id and r.status = 'Confirmed' and e.status = 'completed'
    union all
    select h.event_at::date from public.crm_volunteer_history h where h.contact_id = p_contact_id and h.attended
  ) y;
  last_act := greatest(last_gift, last_serve);
  if c.email_consent = 'implied' and c.implied_consent_until is not null then
    imp_until := greatest(c.implied_consent_until, (last_act + interval '2 years')::date);
  elsif last_act is not null then
    imp_until := (last_act + interval '2 years')::date;
  end if;
  if imp_until is not null and imp_until >= current_date then
    return query select true, ('implied consent until ' || to_char(imp_until, 'DD Mon YYYY') || case when last_act = last_gift then ' (gift on ' when last_act is not null then ' (volunteered on ' else ' (' end
      || coalesce(to_char(last_act, 'DD Mon YYYY'), coalesce(c.consent_source, 'recorded by the team')) || ')')::text, imp_until, c.em::text, c.st::text;
    return;
  end if;
  if p_kind = 'fundraising' then
    select value into exemption from public.app_config where key = 'mail_fundraising_exemption';
    if exemption = 'on' then
      return query select true, 'fundraising by a registered charity (CASL s.6 does not apply); no consent on file'::text, null::date, c.em::text, c.st::text; return;
    end if;
  end if;
  return query select false, (case when imp_until is not null then 'implied consent ran out on ' || to_char(imp_until, 'DD Mon YYYY') else 'no consent recorded' end)::text, imp_until, c.em::text, c.st::text;
end $function$;
comment on function public.crm_email_permission(bigint, text) is 'The CASL rule for one contact and one kind of message (wave154; the volunteer kind wave155b). transactional/test: any working address. volunteer: any working address that has not unsubscribed (Steel, 27/09/26). newsletter/fundraising: express consent, or implied consent within two years of a gift or a serving; fundraising also under the exemption setting. Bounced and complained get nothing.';

-- ---------- campaigns: the volunteer kind, the sender ----------
alter table public.crm_campaigns drop constraint if exists crm_campaigns_kind_check;
alter table public.crm_campaigns add constraint crm_campaigns_kind_check check (kind in ('newsletter', 'fundraising', 'volunteer', 'transactional'));
alter table public.crm_campaigns add column if not exists from_name text;
alter table public.crm_campaigns add column if not exists from_email text;
alter table public.crm_campaigns add column if not exists reply_to text;
comment on column public.crm_campaigns.from_name is 'Who the campaign comes from (wave155b): empty = the mail_from_name setting ("Welfare Avenue"), or a team member''s name.';
comment on column public.crm_campaigns.from_email is 'The sending address (wave155b): empty = mail_from_email (info@), or a team member''s own @welfareavenue.com address; mail-send refuses any other domain.';
comment on column public.crm_campaigns.reply_to is 'Where replies go (wave155b): empty = the sender when it is a person, else mail_reply_to.';
comment on column public.crm_campaigns.kind is 'What the messages are: newsletter (consent needed), fundraising (consent needed unless the exemption setting is on), volunteer (a call-out: anyone not unsubscribed, Steel 27/09/26), transactional (anyone with a working address). mail-send applies crm_email_permission with this kind.';

-- ---------- the send log: a claim for the pump ----------
alter table public.crm_email_sends drop constraint if exists crm_email_sends_status_check;
alter table public.crm_email_sends add constraint crm_email_sends_status_check check (status in ('queued', 'sending', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'suppressed', 'cancelled'));
alter table public.crm_email_sends add column if not exists claimed_at timestamptz;
comment on column public.crm_email_sends.claimed_at is 'When a pump run took this queued send (wave155b); a claim older than 10 minutes goes back to the queue (Resend''s idempotency key stops a double send).';

create or replace function public.crm_claim_queued(p_limit int)
returns setof public.crm_email_sends language sql volatile set search_path to '' as $$
  with stale as (
    update public.crm_email_sends set status = 'queued', claimed_at = null
    where status = 'sending' and claimed_at < now() - interval '10 minutes' returning id
  ), picked as (
    select id from public.crm_email_sends where status = 'queued' order by id limit greatest(p_limit, 0) for update skip locked
  )
  update public.crm_email_sends s set status = 'sending', claimed_at = now() from picked where s.id = picked.id returning s.*
$$;
comment on function public.crm_claim_queued(int) is 'Takes up to p_limit queued sends for mail-send''s campaign_pump (wave155b): status sending, claimed_at now; stale claims (over 10 minutes) go back to the queue. Service role only.';
revoke all on function public.crm_claim_queued(int) from public, anon, authenticated;
grant execute on function public.crm_claim_queued(int) to service_role;

create or replace view public.crm_campaign_stats_v with (security_invoker = true) as
select c.id as campaign_id,
  count(s.id) as total,
  count(s.id) filter (where s.status in ('queued', 'sending')) as queued,
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
comment on view public.crm_campaign_stats_v is 'Per-campaign counts from the send log (wave155): queued (waiting or being sent), sent, delivered, opened, clicked, bounced, complained, failed, suppressed (the rule said no), cancelled, unsubscribed. Reader''s rights (security_invoker).';
grant select on public.crm_campaign_stats_v to authenticated;

-- ---------- the daily cap (Resend's free plan: 100 a day; Steel 27/09/26: stay on it for now) ----------
insert into public.app_config (key, value) values ('mail_daily_cap', '100'), ('mail_campaign_daily_cap', '80')
on conflict (key) do nothing;

-- ---------- lists: groups of conditions ----------
create or replace function public.crm_contact_match(c public.crm_contacts_v, k jsonb)
returns boolean language plpgsql stable set search_path to '' as $$
declare
  f text := k->>'f'; op text := coalesce(k->>'op', ''); v text := coalesce(k->>'v', ''); n numeric; r boolean; w text;
begin
  if f is null or f = '' then return true; end if;
  begin n := nullif(trim(v), '')::numeric; exception when others then n := null; end;
  if f = 'kind' then
    r := case v when 'donor' then ('donor' = any(coalesce(c.kinds, '{}')) or coalesce(c.donation_count, 0) > 0)
                when 'partner' then ('partner' = any(coalesce(c.kinds, '{}')) or coalesce(array_length(c.org_names, 1), 0) > 0)
                else v = any(coalesce(c.kinds, '{}')) end;
  elsif f = 'role' then r := v = any(coalesce(c.volunteer_roles, '{}')) or v = any(coalesce(c.volunteer_tags, '{}'));
  elsif f = 'tag' then r := exists (select 1 from unnest(coalesce(c.tags, '{}')) t where public.crm_fold(t) = public.crm_fold(v));
  elsif f = 'perm' then
    w := public.crm_perm_key(c.email_status, c.email_consent, c.implied_consent_until);
    r := w = v or (v = 'unsub' and w = 'bounced');
  elsif f = 'email' then r := coalesce(array_length(c.emails, 1), 0) > 0 or coalesce(c.primary_email, '') <> '';
  elsif f = 'served' then
    r := case op when 'never' then coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) = 0
                 when 'within' then c.last_serving_on >= current_date - coalesce(n, 365)::int
                 when 'count_gte' then coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) >= coalesce(n, 1)
                 else coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) > 0 end;
  elsif f = 'gave' then
    r := case op when 'never' then coalesce(c.donation_count, 0) = 0
                 when 'within' then c.last_donation_at >= now() - make_interval(days => coalesce(n, 365)::int)
                 when 'lapsed' then c.last_donation_at < now() - make_interval(days => coalesce(n, 365)::int)
                 when 'total_gte' then coalesce(c.donation_total, 0) >= coalesce(n, 0)
                 when 'count_gte' then coalesce(c.donation_count, 0) >= coalesce(n, 1)
                 else coalesce(c.donation_count, 0) > 0 end;
  elsif f = 'city' then r := public.crm_fold(c.city) like '%' || public.crm_fold(v) || '%';
  elsif f = 'language' then r := lower(coalesce(c.language, '')) like lower(v) || '%';
  elsif f = 'source' then r := coalesce(c.source, '') = v;
  elsif f = 'added' then r := c.created_at >= now() - make_interval(days => coalesce(n, 30)::int);
  elsif f = 'active' then r := c.last_activity_at >= now() - make_interval(days => coalesce(n, 90)::int);
  elsif f = 'opened' then r := exists (select 1 from public.crm_email_sends s where s.contact_id = c.id and not s.is_test and s.opened_at >= now() - make_interval(days => coalesce(n, 90)::int));
  elsif f = 'clicked' then r := exists (select 1 from public.crm_email_sends s where s.contact_id = c.id and not s.is_test and s.clicked_at >= now() - make_interval(days => coalesce(n, 90)::int));
  elsif f = 'review' then r := coalesce(c.volunteer_needs_review, false);
  elsif f = 'search' then
    r := not exists (
      select 1 from unnest(string_to_array(public.crm_fold(trim(v)), ' ')) x
      where x <> '' and position(x in public.crm_fold(coalesce(c.full_name, '') || ' ' || array_to_string(coalesce(c.emails, '{}'), ' ') || ' ' || array_to_string(coalesce(c.phones, '{}'), ' ') || ' ' || coalesce(c.city, '') || ' ' || coalesce(c.volunteer_organization, '') || ' ' || array_to_string(coalesce(c.org_names, '{}'), ' ') || ' ' || array_to_string(coalesce(c.tags, '{}'), ' '))) = 0);
  else r := true;
  end if;
  r := coalesce(r, false);
  if op in ('not', 'none') then return not r; end if;
  return r;
end $$;
comment on function public.crm_contact_match(public.crm_contacts_v, jsonb) is 'One list condition {f, op, v} against one contact (wave155b). Fields: kind, role, tag, perm, email, served (ever, never, within days, count_gte), gave (ever, never, within days, lapsed days, total_gte, count_gte), city, language, source, added (days), active (days), opened and clicked (a Hub email within days), review, search. op not/none negates.';

-- the flat filter of wave155 keeps working (the Contacts tab's filters); groups are the new shape
alter function public.crm_list_preview(jsonb) rename to crm_list_preview_flat;
comment on function public.crm_list_preview_flat(jsonb) is 'The CRM page''s flat filters (kind, role, act, perm, q, city, tags) evaluated in the database (wave155); crm_list_preview calls it when a filter has no groups.';

create or replace function public.crm_list_preview(p_filter jsonb)
returns setof bigint language sql stable security invoker set search_path to '' as $$
  select x from public.crm_list_preview_flat(p_filter) x where jsonb_typeof(p_filter->'groups') is distinct from 'array'
  union all
  select c.id from public.crm_contacts_v c
  where jsonb_typeof(p_filter->'groups') = 'array' and c.merged_into is null
    and (jsonb_array_length(p_filter->'groups') = 0 or exists (
      select 1 from jsonb_array_elements(p_filter->'groups') g
      where not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(g->'all') = 'array' then g->'all' else '[]'::jsonb end) k where not public.crm_contact_match(c, k))))
$$;
comment on function public.crm_list_preview(jsonb) is 'The contact ids a list filter selects today (wave155, groups wave155b): {"groups":[{"all":[{f,op,v},...]},...]} is OR between groups and AND inside one; a filter without groups is the Contacts tab''s flat shape. Reader''s rights.';
revoke all on function public.crm_list_preview(jsonb) from public, anon;
grant execute on function public.crm_list_preview(jsonb) to authenticated, service_role;
revoke all on function public.crm_list_preview_flat(jsonb) from public, anon;
grant execute on function public.crm_list_preview_flat(jsonb) to authenticated, service_role;
revoke all on function public.crm_contact_match(public.crm_contacts_v, jsonb) from public, anon;
grant execute on function public.crm_contact_match(public.crm_contacts_v, jsonb) to authenticated, service_role;

create or replace function public.crm_list_sizes()
returns table(list_id bigint, members bigint) language sql stable security invoker set search_path to '' as $$
  select l.id, (select count(*) from public.crm_list_members(l.id)) from public.crm_lists l
$$;
comment on function public.crm_list_sizes() is 'How many live contacts each saved list holds today (wave155b), for the Lists tab.';
revoke all on function public.crm_list_sizes() from public, anon;
grant execute on function public.crm_list_sizes() to authenticated, service_role;

create or replace function public.crm_campaign_audience(p_campaign_id bigint)
returns table(contact_id bigint, email text, allowed boolean, basis text) language sql stable security invoker set search_path to '' as $$
  select m.contact_id, p.email, p.allowed, p.basis
  from public.crm_campaigns k
  cross join lateral public.crm_list_members(k.list_id) as m(contact_id)
  cross join lateral public.crm_email_permission(m.contact_id, k.kind) p
  where k.id = p_campaign_id
$$;
comment on function public.crm_campaign_audience(bigint) is 'Everyone in a campaign''s list with the rule''s answer for the campaign''s kind (wave155b): mail-send campaign_check and campaign_queue read it.';
revoke all on function public.crm_campaign_audience(bigint) from public, anon;
grant execute on function public.crm_campaign_audience(bigint) to authenticated, service_role;

-- the minute pump also runs while a claim is waiting to be picked up again
select cron.unschedule('wa-mail-pump') where exists (select 1 from cron.job where jobname = 'wa-mail-pump');
select cron.schedule('wa-mail-pump', '* * * * *', $$select public.call_edge('mail-send', '{"action":"campaign_pump"}'::jsonb) where exists (select 1 from public.crm_email_sends where status in ('queued', 'sending'));$$);
