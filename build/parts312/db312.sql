-- wave312 (12/11/26): Campaigns in the CRM (a folder per campaign), Email insights, the photo albums, and the Content Studio's
-- "it went out" notice. Soraya Tyree's CRM review at the 11 November marketing meeting; Steel: "make this all capable for
-- Soraya and others using the crm", and "those approvals for post going to KK and Ian should be sent by notification on slack
-- to Ian's active account and KK. They should also get a notification once it's approved and sent out."

-- 1. A campaign's folder ----------------------------------------------------------------------------------------------
alter table public.wa_campaigns add column if not exists brief text check (brief is null or length(brief) <= 4000);
alter table public.wa_campaigns add column if not exists facts jsonb not null default '[]'::jsonb check (jsonb_typeof(facts) = 'array');
alter table public.wa_campaigns add column if not exists links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array');
alter table public.wa_campaigns add column if not exists hashtags text[] not null default '{}';
alter table public.wa_campaigns add column if not exists post_names text[] not null default '{}';
alter table public.wa_campaigns add column if not exists fund_event_id bigint references public.fund_events(id) on delete set null;
alter table public.wa_campaigns add column if not exists updated_at timestamptz;
alter table public.wa_campaigns add column if not exists updated_by text;
create index if not exists wa_campaigns_fund_event_idx on public.wa_campaigns(fund_event_id) where fund_event_id is not null;
comment on column public.wa_campaigns.brief is 'wave312: what the campaign is, the why and the how, for someone new (the folder on #crm/folders). Written by wa312_campaign_save.';
comment on column public.wa_campaigns.facts is 'wave312: the key facts, [{label, value}] (dates, the rules in short, what a gift does, who leads it). Written by wa312_campaign_save.';
comment on column public.wa_campaigns.links is 'wave312: the folder''s links, [{label, url (https), note?}] (the Drive folder, the rules, the one-pager, Canva). Written by wa312_campaign_save.';
comment on column public.wa_campaigns.hashtags is 'wave312: the campaign''s hashtags, without the #.';
comment on column public.wa_campaigns.post_names is 'wave312: the values of content_posts.campaign that belong to this campaign (matched without case), besides its name.';
comment on column public.wa_campaigns.fund_event_id is 'wave312: the Fundraising event (fund_events) this campaign belongs to, if any: its dates and its volunteers.';
alter table public.wa_campaigns drop constraint if exists wa_campaigns_type_check;
alter table public.wa_campaigns add constraint wa_campaigns_type_check check (type = any (array['fundraising_event', 'drive', 'appeal', 'program', 'challenge', 'other']));

-- everything the Campaigns page shows: the list (p_id null) or one campaign's folder
create or replace function public.wa312_campaigns(p_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare r jsonb; c public.wa_campaigns%rowtype; v_names text[];
begin
  if not public.is_wa_staff() or not coalesce(public.wa_page_ok('crm'), true) then raise exception 'Staff only'; end if;
  if p_id is null then
    select jsonb_build_object(
      'campaigns', coalesce(jsonb_agg(x order by (x ->> 'status') = 'done', (x ->> 'year') desc nulls last, x ->> 'name'), '[]'),
      'fund_events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title) order by e.start_date nulls last, e.title), '[]') from public.fund_events e where e.status not in ('cancelled')))
      into r from (
      select jsonb_build_object('id', w.id, 'name', w.name, 'type', w.type, 'year', w.year, 'status', w.status, 'goal_amount', w.goal_amount, 'donate_key', w.donate_key,
        'raised', (select coalesce(sum(d.amount - coalesce(d.refunded_amount, 0)), 0) from public.crm_donations d where d.campaign_id = w.id),
        'forms', (select count(*) from public.crm_forms f where f.settings ->> 'campaign_id' = w.id::text),
        'posts', (select count(*) from public.content_posts p where lower(btrim(coalesce(p.campaign, ''))) = any (array(select lower(btrim(n)) from unnest(array_append(w.post_names, w.name)) n))),
        'links', jsonb_array_length(w.links)) x
      from public.wa_campaigns w where w.status <> 'archived') q;
    return r;
  end if;
  select * into c from public.wa_campaigns where id = p_id; if not found then raise exception 'No such campaign'; end if;
  v_names := array(select lower(btrim(n)) from unnest(array_append(c.post_names, c.name)) n);
  select jsonb_build_object(
    'campaign', to_jsonb(c) - 'keela_name',
    'forms', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'slug', f.slug, 'title', f.title, 'lang', f.lang, 'status', f.status,
              'n', (select count(*) from public.crm_form_submissions s where s.form_id = f.id and not coalesce(s.is_test, false))) order by f.status <> 'published', f.title)
              from public.crm_forms f where f.settings ->> 'campaign_id' = c.id::text and f.status <> 'archived'), '[]'),
    'posts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'status', p.status, 'approval_status', p.approval_status, 'scheduled_at', p.scheduled_at, 'published_at', p.published_at, 'platforms', p.platforms)
              order by coalesce(p.published_at, p.scheduled_at, p.created_at) desc) from public.content_posts p where lower(btrim(coalesce(p.campaign, ''))) = any (v_names) and p.banked_at is null), '[]'),
    'gifts', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(d.amount - coalesce(d.refunded_amount, 0)), 0), 'last', max(d.donated_at)) from public.crm_donations d where d.campaign_id = c.id),
    'people', (select count(*) from public.wa_campaign_people p where p.campaign_id = c.id),
    'fund_event', (select jsonb_build_object('id', e.id, 'title', e.title, 'timing', e.timing, 'start_date', e.start_date, 'end_date', e.end_date, 'volunteer_on', e.volunteer_on) from public.fund_events e where e.id = c.fund_event_id),
    'fund_events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title) order by e.start_date nulls last, e.title), '[]') from public.fund_events e where e.status not in ('cancelled'))
  ) into r;
  return r;
end $f$;
comment on function public.wa312_campaigns(bigint) is 'wave312: the CRM''s Campaigns page. With no id, every campaign that is not archived with its gifts total, forms, posts and folder links; with an id, the campaign and its folder, its forms (settings.campaign_id), its posts (content_posts.campaign matching its name or post_names), its gifts, its people and its Fundraising event. Staff with the CRM.';
revoke all on function public.wa312_campaigns(bigint) from public, anon;
grant execute on function public.wa312_campaigns(bigint) to authenticated;

-- add a campaign or change its folder (p: id?, name, type, year, status, goal_amount, brief, facts, links, hashtags, post_names, fund_event_id)
create or replace function public.wa312_campaign_save(p jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_id bigint := nullif(p ->> 'id', '')::bigint; v_name text := btrim(coalesce(p ->> 'name', '')); v_by text; v_facts jsonb := '[]'; v_links jsonb := '[]'; x jsonb;
  v_type text := coalesce(nullif(p ->> 'type', ''), 'drive'); v_status text := coalesce(nullif(p ->> 'status', ''), 'planned'); v_fe bigint := nullif(p ->> 'fund_event_id', '')::bigint;
begin
  if not public.is_wa_staff() or not coalesce(public.wa_page_ok('crm'), true) then raise exception 'Staff only'; end if;
  v_by := coalesce((select m.name from public.team_members m where lower(m.email) = lower(auth.jwt() ->> 'email') limit 1), lower(auth.jwt() ->> 'email'), 'The Hub');
  if length(v_name) < 3 then raise exception 'Give the campaign a name'; end if;
  if v_type not in ('fundraising_event', 'drive', 'appeal', 'program', 'challenge', 'other') then raise exception 'Pick what the campaign is'; end if;
  if v_status not in ('planned', 'active', 'done', 'archived') then raise exception 'Unknown status'; end if;
  if v_fe is not null and not exists (select 1 from public.fund_events where id = v_fe) then raise exception 'No such Fundraising event'; end if;
  for x in select * from jsonb_array_elements(coalesce(p -> 'facts', '[]')) loop
    if coalesce(btrim(x ->> 'label'), '') = '' and coalesce(btrim(x ->> 'value'), '') = '' then continue; end if;
    v_facts := v_facts || jsonb_build_object('label', left(btrim(coalesce(x ->> 'label', '')), 60), 'value', left(btrim(coalesce(x ->> 'value', '')), 300));
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'links', '[]')) loop
    if coalesce(btrim(x ->> 'url'), '') = '' then continue; end if;
    if btrim(x ->> 'url') !~* '^https://\S+$' then raise exception 'Links start with https://'; end if;
    v_links := v_links || jsonb_strip_nulls(jsonb_build_object('label', left(coalesce(nullif(btrim(x ->> 'label'), ''), 'Link'), 80), 'url', left(btrim(x ->> 'url'), 500), 'note', nullif(left(btrim(coalesce(x ->> 'note', '')), 160), '')));
  end loop;
  if jsonb_array_length(v_facts) > 20 or jsonb_array_length(v_links) > 20 then raise exception 'Twenty facts and twenty links at most'; end if;
  if v_id is null then
    if exists (select 1 from public.wa_campaigns where lower(name) = lower(v_name)) then raise exception 'A campaign with that name exists already'; end if;
    insert into public.wa_campaigns (name, type, year, status, goal_amount, brief, facts, links, hashtags, post_names, fund_event_id, created_by, updated_at, updated_by)
    values (left(v_name, 120), v_type, nullif(p ->> 'year', '')::int, v_status, nullif(p ->> 'goal_amount', '')::numeric, nullif(btrim(coalesce(p ->> 'brief', '')), ''), v_facts, v_links,
            coalesce(array(select left(lower(regexp_replace(btrim(t), '^#+', '')), 60) from jsonb_array_elements_text(coalesce(p -> 'hashtags', '[]')) t where btrim(t) <> '' limit 12), '{}'),
            coalesce(array(select left(btrim(t), 120) from jsonb_array_elements_text(coalesce(p -> 'post_names', '[]')) t where btrim(t) <> '' limit 12), '{}'), v_fe, v_by, now(), v_by)
    returning id into v_id;
    insert into public.change_log (entity_type, entity_id, field, new_value, changed_by) values ('wa_campaign', v_id::text, 'created', v_name, v_by);
  else
    update public.wa_campaigns set name = left(v_name, 120), type = v_type, year = nullif(p ->> 'year', '')::int, status = v_status, goal_amount = nullif(p ->> 'goal_amount', '')::numeric,
           brief = nullif(btrim(coalesce(p ->> 'brief', '')), ''), facts = v_facts, links = v_links,
           hashtags = coalesce(array(select left(lower(regexp_replace(btrim(t), '^#+', '')), 60) from jsonb_array_elements_text(coalesce(p -> 'hashtags', '[]')) t where btrim(t) <> '' limit 12), '{}'),
           post_names = coalesce(array(select left(btrim(t), 120) from jsonb_array_elements_text(coalesce(p -> 'post_names', '[]')) t where btrim(t) <> '' limit 12), '{}'),
           fund_event_id = v_fe, updated_at = now(), updated_by = v_by
     where id = v_id;
    if not found then raise exception 'No such campaign'; end if;
    insert into public.change_log (entity_type, entity_id, field, new_value, changed_by) values ('wa_campaign', v_id::text, 'folder', v_name || ': ' || jsonb_array_length(v_facts) || ' facts, ' || jsonb_array_length(v_links) || ' links', v_by);
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $f$;
comment on function public.wa312_campaign_save(jsonb) is 'wave312: adds a campaign or changes its folder (name, type, year, status, goal, brief, facts, https links, hashtags, post names, Fundraising event). Anyone on staff with the CRM (Steel, 12/11/26: Soraya and others). The donation key stays with the admins. Logged in change_log.';
revoke all on function public.wa312_campaign_save(jsonb) from public, anon;
grant execute on function public.wa312_campaign_save(jsonb) to authenticated;

-- 2. Email insights ------------------------------------------------------------------------------------------------------
create or replace function public.wa312_mail_insights(p_days integer default 180)
returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare v_from timestamptz := now() - make_interval(days => greatest(30, least(coalesce(p_days, 180), 730)));
begin
  if not public.is_wa_staff() or not coalesce(public.wa_page_ok('crm'), true) then raise exception 'Staff only'; end if;
  return jsonb_build_object(
    'tracking', exists (select 1 from public.crm_email_sends s where (s.opened_at is not null or s.clicked_at is not null) and s.created_at > now() - interval '120 days'),
    'months', coalesce((select jsonb_agg(m order by m ->> 'month' desc) from (
        select jsonb_build_object('month', to_char(date_trunc('month', s.sent_at at time zone 'America/Toronto'), 'YYYY-MM-DD'),
          'sent', count(*), 'delivered', count(s.delivered_at), 'opened', count(s.opened_at), 'clicked', count(s.clicked_at), 'unsubscribed', count(s.unsubscribed_at), 'bounced', count(s.bounced_at)) m
        from public.crm_email_sends s where not coalesce(s.is_test, false) and s.sent_at >= v_from group by date_trunc('month', s.sent_at at time zone 'America/Toronto')) q), '[]'),
    'heat', coalesce((select jsonb_agg(jsonb_build_object('dow', dow, 'slot', slot, 'sends', sends, 'opens', opens)) from (
        select dow, slot, sum(sends)::int sends, sum(opens)::int opens from (
          select extract(dow from s.sent_at at time zone 'America/Toronto')::int dow,
                 case when extract(hour from s.sent_at at time zone 'America/Toronto') between 6 and 8 then 6 when extract(hour from s.sent_at at time zone 'America/Toronto') between 9 and 11 then 9
                      when extract(hour from s.sent_at at time zone 'America/Toronto') between 12 and 14 then 12 when extract(hour from s.sent_at at time zone 'America/Toronto') between 15 and 17 then 15
                      when extract(hour from s.sent_at at time zone 'America/Toronto') between 18 and 20 then 18 else 21 end slot, 1 sends, 0 opens
            from public.crm_email_sends s where not coalesce(s.is_test, false) and s.sent_at >= v_from
          union all
          select extract(dow from s.opened_at at time zone 'America/Toronto')::int,
                 case when extract(hour from s.opened_at at time zone 'America/Toronto') between 6 and 8 then 6 when extract(hour from s.opened_at at time zone 'America/Toronto') between 9 and 11 then 9
                      when extract(hour from s.opened_at at time zone 'America/Toronto') between 12 and 14 then 12 when extract(hour from s.opened_at at time zone 'America/Toronto') between 15 and 17 then 15
                      when extract(hour from s.opened_at at time zone 'America/Toronto') between 18 and 20 then 18 else 21 end, 0, 1
            from public.crm_email_sends s where not coalesce(s.is_test, false) and s.opened_at >= v_from
        ) z group by dow, slot) h), '[]')
  );
end $f$;
comment on function public.wa312_mail_insights(integer) is 'wave312: the CRM''s Email insights: each month''s emails the Hub sent (not tests): sent, delivered, opened, clicked, unsubscribed, bounced; emails sent and opened by weekday and three-hour slot (Toronto; 21 is 9 pm to 6 am); tracking says whether any open or click arrived in the last 120 days. Staff with the CRM.';
revoke all on function public.wa312_mail_insights(integer) from public, anon;
grant execute on function public.wa312_mail_insights(integer) to authenticated;

-- 3. The albums in Google Photos, listed with the Photo library ------------------------------------------------------------
create table if not exists public.wa_photo_albums (
  id bigserial primary key,
  label text not null check (length(btrim(label)) between 2 and 80),
  url text not null check (url ~* '^https://(photos\.app\.goo\.gl|photos\.google\.com|goo\.gl/photos)/'),
  taken_on date,
  note text check (note is null or length(note) <= 200),
  added_by text,
  created_at timestamptz not null default now()
);
comment on table public.wa_photo_albums is 'wave312: the team''s Google Photos albums (share links), listed above the Photo library: Google Photos lets no other app read an album since March 2025, so the team picks the best photos by hand (Add photos). Staff read and add; board viewers read; admins delete.';
alter table public.wa_photo_albums enable row level security;
drop policy if exists wa_photo_albums_read on public.wa_photo_albums;
create policy wa_photo_albums_read on public.wa_photo_albums for select to authenticated using ((select public.is_wa_staff()) or (select public.is_board_viewer()));
drop policy if exists wa_photo_albums_add on public.wa_photo_albums;
create policy wa_photo_albums_add on public.wa_photo_albums for insert to authenticated with check ((select public.is_wa_staff()));
drop policy if exists wa_photo_albums_admin_delete on public.wa_photo_albums;
create policy wa_photo_albums_admin_delete on public.wa_photo_albums for delete to authenticated using ((select public.is_wa_admin()));
revoke all on public.wa_photo_albums from anon;
grant select, insert, delete on public.wa_photo_albums to authenticated;
grant usage, select on sequence public.wa_photo_albums_id_seq to authenticated;

-- 4. The Content Studio: when a post goes out, everyone involved hears it (social-publish v7) -------------------------------
create or replace function public.wa312_post_out()
returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  if new.status in ('published', 'posted') and coalesce(old.status, '') not in ('published', 'posted')
     and coalesce((select value from public.app_config where key = 'studio_notify'), 'on') <> 'off' then
    perform public.call_edge('social-publish', jsonb_build_object('action', 'approval_notify', 'post_id', new.id, 'state', 'published', 'by', coalesce(new.updated_by, '')));
  end if;
  return new;
end $f$;
comment on function public.wa312_post_out() is 'wave312: after a Content Studio post goes out (status published or posted), social-publish tells the person who sent it for approval, its owner and the approvers (hub_settings content_studio.approvers: Ian and KK), never the person who pressed Publish. Off with app_config studio_notify off.';
drop trigger if exists trg_wa312_post_out on public.content_posts;
create trigger trg_wa312_post_out after update of status on public.content_posts for each row execute function public.wa312_post_out();

-- 5. Page tours -------------------------------------------------------------------------------------------------------------
insert into public.trainings (key, kind, title, description, category, path_group, sort, minutes, xp, active, source, body)
select v.key, 'tour', v.title, v.description, 'Hub tours', 'Hub page tours', v.sort, 2, 20, true, 'hub', v.body::jsonb
from (values
  ('tour:crmcampaigns', 'Page tour: Campaigns', 'Every campaign''s folder in the CRM: what it is, the key facts and links, and what the Hub knows (its forms, posts, gifts, donation link and volunteers). Add a campaign and keep its folder up to date.', 43, '{"tab": "crm", "tour": "crmcampaigns"}'),
  ('tour:crminsights', 'Page tour: Email insights', 'How our emails do month by month, when our contacts open them, and the send-time test that finds our best time.', 44, '{"tab": "crm", "tour": "crminsights"}')
) v(key, title, description, sort, body)
where not exists (select 1 from public.trainings t where t.key = v.key);

-- 6. The folders we already know, from what the team has said and the Hub holds -------------------------------------------
update public.wa_campaigns set fund_event_id = 4, goal_amount = coalesce(goal_amount, 5000),
  post_names = array['Gift Basket Drive', 'Gift basket drive'],
  brief = coalesce(brief, 'Every gift helps us fill, wrap and hand-deliver holiday gifts across Montreal this December. It runs near Christmas; the One Bag Challenge in November raises money to fill its gaps.'),
  facts = case when facts = '[]'::jsonb then '[{"label": "Goal", "value": "$5,000 online (the donation page''s progress bar), and 6,000 gifts"}, {"label": "Volunteers", "value": "Gift wrapping, collecting and sorting donations, delivering gifts (Volunteer Manager, Fundraisers)"}, {"label": "Forms", "value": "Eight drive forms (English and French); a confirmation email goes from fundraising@"}]'::jsonb else facts end,
  updated_at = now(), updated_by = 'the Hub'
 where id = 7;
insert into public.wa_campaigns (name, type, year, status, goal_amount, brief, facts, links, hashtags, post_names, fund_event_id, created_by, updated_at, updated_by)
select 'One Bag Challenge 2026', 'challenge', 2026, 'planned', null,
  'The fundraiser that feeds the Gift Basket Drive, held in November to avoid December overload: every dollar fills the gaps for the drive at the end of the year. The leaders'' videos go up first, then the JMCC delegates''.',
  '[{"label": "Target", "value": "$3,000 to $4,000, November to December"}, {"label": "What $20 to $25 does", "value": "Fills one bag: hygiene products, clothing, hand warmers for the winter, a couple of books"}, {"label": "Launch", "value": "The week of 16 November 2026, with the two static posts (what $25 does, the rules)"}, {"label": "The rules", "value": "In the volunteer document (Slack) and Steel''s one-pager: add their links to the folder"}]'::jsonb,
  '[]'::jsonb, array['onebagchallenge'], array['One Bag Challenge', 'One Bag Challenge launch campaign'], 3, 'wave312', now(), 'the Hub'
where not exists (select 1 from public.wa_campaigns where lower(name) like 'one bag challenge%');
update public.wa_campaigns set fund_event_id = 2, post_names = array['Rally Paper', 'Rally Paper 2026'], updated_at = now(), updated_by = 'the Hub' where id = 1 and fund_event_id is null;
update public.wa_campaigns set fund_event_id = 1, updated_at = now(), updated_by = 'the Hub' where id = 3 and fund_event_id is null;
