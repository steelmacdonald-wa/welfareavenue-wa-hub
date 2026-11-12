-- 12/11/26 - wave312 release (built as wave310; renumbered after the Clarity release took wave310): Campaigns in the CRM, Email insights, buttons to a form or the donation page, a form's donate
-- button, the photo albums, and the Content Studio's "it went out" notice for Ian, KK and the sender.
--
-- STEP 1 FIRST (Supabase dashboard, Edge Functions): replace each function's index.ts with its one line, then Deploy.
--   social-publish (verify JWT off, as now):
--     import 'https://raw.githubusercontent.com/steelmacdonald-wa/welfareavenue-wa-hub/efb706c5477b943e218037f7932a1d97e7b5cb01/fn/social-publish/index.ts';
--   form-submit (verify JWT on, as now):
--     import 'https://raw.githubusercontent.com/steelmacdonald-wa/welfareavenue-wa-hub/efb706c5477b943e218037f7932a1d97e7b5cb01/fn/form-submit/index.ts';
--   social-publish must be v7 before this file runs: the new trigger asks it for the "went out" notice, which v6 does not know.
--
-- STEP 2: run this whole file once in the SQL editor (project zwnmulmnvopclzcvytce). One transaction: if any check fails,
-- nothing changes. Made against the live Hub page 9cd38ba16139f97b90e62406aefe835d (after wave310, Clarity) and f/index.html da9c679fa5e1a8d3a20926e918652543.
-- What it does:
--   1. keeps a copy of today's pages (table site_files_bak_wa312, for the undo)
--   2. the database: wa_campaigns' folder columns, wa312_campaigns, wa312_campaign_save, wa312_mail_insights, wa_photo_albums,
--      the trigger trg_wa312_post_out, two page tours, and the folders we know (Gift Basket Drive 2026, One Bag Challenge 2026,
--      Rally Paper 2026, Football Fundraiser 2026)
--   3. the Hub page (index.html) and the public form page (f/index.html)
--   4. publishes through host-sync (about a minute).
-- Nobody is messaged by any of this. Undo: "12-11-26 - wave312 undo (only if needed).sql".

create table if not exists public.site_files_bak_wa312 (path text, part int, content text, updated_at timestamptz);
alter table public.site_files_bak_wa312 enable row level security;
revoke all on public.site_files_bak_wa312 from anon, authenticated;
grant all on public.site_files_bak_wa312 to service_role;
comment on table public.site_files_bak_wa312 is 'wave312 (12/11/26): index.html and f/index.html before wave312, for its undo. Drop after a week.';
do $bk$
begin
  if not exists (select 1 from public.site_files_bak_wa312) then
    insert into public.site_files_bak_wa312 select path, part, content, updated_at from public.site_files where path in ('index.html', 'f/index.html');
  end if;
end $bk$;

-- 2. the database
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


-- 3. the Hub page and the public form page
do $pg$
declare v text; v_new text; n int; i int; sz int; o text; nw text;
  olds text[] := array[replace($o0$
/* =====================================================================
   WA v110 boot veil + self-provisioning$o0$, chr(13), ''),
    replace($o1$sub === 'reports' ? 'reports' : (sub === 'settings' && parts[2] === 'imports') ? 'imports' : 'contacts';$o1$, chr(13), ''),
    replace($o2$    if (sub === 'reports') openReports(parts);
$o2$, chr(13), ''),
    replace($o3$    else if (S.ui.tab === 'imports') paintImports(root);
$o3$, chr(13), ''),
    replace($o4$inp(i, 'caption', 'Small line under it', b.caption, { ph: 'Two minutes \u00b7 your volunteer hours count' }); }$o4$, chr(13), ''),
    replace($o5$fld('cta_url', 'Button link', s.cta_url, 'https://welfareavenue.com') + '</div>') +$o5$, chr(13), ''),
    replace($o6$      inp('thank_you', 'Thank-you message (after they send it)', 'Thank you. We have your answers.', true) +
$o6$, chr(13), ''),
    replace($o7$    var list = shown(), html = toolbar();
$o7$, chr(13), ''),
    replace($o8$'<div class="grp"><h3>' + E(g.y) + '</h3><span>' + all + ' photo' + (all === 1 ? '' : 's') + '</span></div>$o8$, chr(13), '')];
  news text[] := array[replace($n0$
/* =====================================================================
   WA v312 Campaigns in the CRM, email insights, buttons to a form or the donation page, and the photo albums (12/11/26)
   =====================================================================
   Soraya Tyree's review of the CRM at the 11 November marketing meeting (Keela closes on 5 December), and Steel: "Okay go
   ahead and make this all capable for Soraya and others using the crm".
   - Campaigns (#crm/folders, in the CRM's rail): every campaign (wa_campaigns, the CRM's own: a drive, an appeal, an event)
     with its folder: what it is, the key facts, its links (the Drive folder, the rules, the one-pager, Canva), its hashtags,
     and what the Hub already knows about it: the forms that file under it, its posts in the Content calendar, the gifts and
     the goal, its donation link and its volunteers. Anyone on the team adds a campaign and fills its folder, so a new
     person finds everything in one place instead of searching Slack.
   - Email insights (#crm/insights): each month's emails (sent, delivered, opened, clicked, unsubscribed), when people open
     them (weekday and time of day, Toronto), the best window, and a send-time test: four slots to rotate, one a week, so the
     month's recap tells the team when our contacts read. Opens and clicks count only once Resend's tracking is on: the page
     says so plainly while none arrive.
   - A button that goes to one of our forms or to the donation page: in the email studio's Button block and in an
     automation's own email (Point it at), so an existing form drops into any email or automation without copying links.
   - A form can show a donate button on its thank-you page (Forms, the form's editor), with the campaign the gift counts for.
   - The Photo library: the albums in Google Photos, listed with the library (Google stopped letting other apps read albums
     in March 2025, so the Hub cannot copy them by itself), and the counts say "in the library".
   Reads and writes through wa312_* (staff, checked inside) and wa_photo_albums (staff). No timers on the menu.
   ===================================================================== */
(function () {
  'use strict';
  if (window.w312) return;
  var GREEN = '#103F39', GOLD = '#DCA527', MUTED = '#6D6A60', FLAG = '#B3402F', CREAM = '#F6F1E6';
  var FORM_HOST = 'https://hub.welfareavenue.com/f/', GIVE = 'https://hub.welfareavenue.com/give';
  var S = {
    forms: null, formsBusy: null, give: null, giveBusy: null,
    c: { list: null, id: null, d: null, busy: false, err: '', edit: false, draft: null, saving: false, newOpen: false, msg: '' },
    m: { d: null, busy: false, err: '', days: 180 },
    albums: null, albumsBusy: null, albumOpen: false, albumErr: '', albumSaving: false
  };
  var TYPES = [['drive', 'A drive'], ['appeal', 'An appeal'], ['fundraising_event', 'A fundraising event'], ['challenge', 'A challenge'], ['program', 'A program'], ['other', 'Something else']];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var SLOTS = [['6', '6 to 9 am'], ['9', '9 am to noon'], ['12', 'Noon to 3 pm'], ['15', '3 to 6 pm'], ['18', '6 to 9 pm'], ['21', '9 pm to 6 am']];
  /* the send-time test: Ian's slots at the 11 November meeting, one a week, then the month's recap shows the winner */
  var TEST_SLOTS = [['Tue', '11:30 am', 'Tuesday late morning'], ['Mon', '9:00 am', 'Monday morning'], ['Wed', '5:00 pm', 'Wednesday after work'], ['Thu', '8:30 am', 'Thursday early morning']];

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lower(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function staff() { try { return typeof isStaff === 'function' ? isStaff() : true; } catch (e) { return false; } }
  function say(t) { try { if (typeof toast === 'function') toast(t); } catch (e) { /* fine */ } }
  function msgOf(e) { return String((e && (e.message || e.details)) || e || '').replace(/^.*?ERROR:\s*/, '').slice(0, 180); }
  function money(n) { var v = Number(n || 0); return '$' + v.toLocaleString('en-CA', { maximumFractionDigits: v % 1 ? 2 : 0, minimumFractionDigits: v % 1 ? 2 : 0 }); }
  function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '–'; }
  function dayTxt(iso) { if (!iso) return ''; try { return new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return String(iso); } }
  function monthTxt(iso) { try { return new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }); } catch (e) { return String(iso); } }
  function opt(v, l, cur) { return '<option value="' + E(v) + '"' + (String(cur == null ? '' : cur) === String(v) ? ' selected' : '') + '>' + E(l) + '</option>'; }
  function okUrl(u) { return /^https:\/\/\S+$/i.test(String(u || '').trim()); }
  function go(h) { try { location.hash = h; } catch (e) { /* fine */ } }

  var cssDone = false;
  function css() {
    if (cssDone) return; cssDone = true;
    var st = document.createElement('style'); st.id = 'w312css';
    st.textContent = ''
      + '.w312{font-size:14px;color:#1F201E;}'
      + '.w312 h3{font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif;text-transform:uppercase;letter-spacing:.02em;color:' + GREEN + ';margin:20px 0 8px;font-size:20px;}'
      + '.w312 .lead{margin:0 0 14px;color:' + MUTED + ';font-size:13px;line-height:1.5;max-width:760px;}'
      + '.w312 .m{color:' + MUTED + ';font-size:12px;}'
      + '.w312 .err{color:' + FLAG + ';font-weight:600;font-size:13px;}'
      + '.w312 .ok{color:' + GREEN + ';font-weight:600;font-size:13px;}'
      + '.w312 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px;}'
      + '.w312 .card{display:block;width:100%;box-sizing:border-box;text-align:left;font:inherit;padding:14px 16px;border:1px solid rgba(16,63,57,.16);border-radius:14px;background:#fff;color:#1F201E;cursor:pointer;transition:transform 140ms cubic-bezier(.23,1,.32,1),border-color 140ms ease-out;}'
      + '.w312 .card b{display:block;color:' + GREEN + ';font-size:16px;margin:0 0 4px;overflow-wrap:anywhere;}'
      + '.w312 .card small{display:block;color:' + MUTED + ';font-size:12px;line-height:1.5;}'
      + '.w312 .card:active{transform:scale(.98);}'
      + '@media (hover:hover) and (pointer:fine){.w312 .card:hover{border-color:' + GREEN + ';}}'
      + '.w312 .bar{height:6px;border-radius:3px;background:#ECE7DC;overflow:hidden;margin:8px 0 2px;}.w312 .bar i{display:block;height:100%;background:' + GOLD + ';border-radius:3px;}'
      + '.w312 .box{border:1px solid rgba(16,63,57,.14);border-radius:14px;background:#fff;padding:14px 16px;margin:0 0 12px;}'
      + '.w312 .box.soft{background:' + CREAM + ';border-color:transparent;}'
      + '.w312 .row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;}'
      + '.w312 .row > *{min-width:0;}'
      + '.w312 .sp{flex:1 1 auto;}'
      + '.w312 .chip{display:inline-block;font-size:12px;padding:2px 9px;border-radius:999px;background:#EAF1EF;color:' + GREEN + ';margin:0 4px 4px 0;}'
      + '.w312 .chip.gold{background:#F6E4C0;color:#6B4F0E;}.w312 .chip.off{background:#ECE7DC;color:' + MUTED + ';}'
      + '.w312 a{color:' + GREEN + ';}'
      + '.w312 ul.l{list-style:none;margin:0;padding:0;}.w312 ul.l li{padding:8px 0;border-top:1px solid rgba(16,63,57,.08);}.w312 ul.l li:first-child{border-top:0;}'
      + '.w312 dl.facts{display:grid;grid-template-columns:minmax(120px,32%) 1fr;gap:6px 14px;margin:0;}.w312 dl.facts dt{font-weight:700;color:' + GREEN + ';}.w312 dl.facts dd{margin:0;overflow-wrap:anywhere;}'
      + '.w312 .brief{white-space:pre-line;line-height:1.55;margin:0;}'
      + '.w312 .fld{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:600;color:' + MUTED + ';flex:1 1 180px;}'
      + '.w312 input,.w312 select,.w312 textarea{font:inherit;font-size:14px;padding:8px 10px;border:1px solid rgba(16,63,57,.25);border-radius:10px;background:#fff;color:#1F201E;min-width:0;box-sizing:border-box;}'
      + '.w312 textarea{width:100%;min-height:90px;resize:vertical;}'
      + '.w312 .pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr) auto;gap:6px;margin:0 0 6px;}'
      + '.w312 .x{border:0;background:none;color:' + MUTED + ';cursor:pointer;font-size:18px;line-height:1;padding:4px 8px;}'
      + '.w312 .kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:0 0 12px;}'
      + '.w312 .kpi{padding:12px 14px;border-radius:12px;background:' + CREAM + ';}.w312 .kpi b{display:block;font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif;font-size:28px;line-height:1.1;color:' + GREEN + ';}.w312 .kpi span{font-size:12px;color:' + MUTED + ';}'
      + '.w312 table.t{width:100%;border-collapse:collapse;font-size:13px;}.w312 table.t th,.w312 table.t td{padding:8px 10px;text-align:right;border-bottom:1px solid rgba(16,63,57,.08);white-space:nowrap;}.w312 table.t th:first-child,.w312 table.t td:first-child{text-align:left;}'
      + '.w312 table.t th{font-size:12px;color:' + MUTED + ';font-weight:600;}'
      + '.w312 .tw{overflow-x:auto;}'
      + '.w312 table.heat{border-collapse:separate;border-spacing:3px;font-size:12px;}.w312 table.heat th{color:' + MUTED + ';font-weight:600;padding:2px 6px;text-align:left;white-space:nowrap;}'
      + '.w312 table.heat td{width:46px;height:30px;border-radius:6px;text-align:center;color:' + GREEN + ';font-weight:600;}'
      + '.w312 .note{padding:10px 12px;border-radius:10px;background:#F6E4C0;color:#4A3608;font-size:13px;line-height:1.5;margin:0 0 12px;}'
      + '.w312 ol.plan{margin:6px 0 0 18px;padding:0;line-height:1.7;}'
      + '@media (max-width:700px){.w312 .pair{grid-template-columns:1fr auto;}.w312 .pair input:first-child{grid-column:1/-1;}.w312 dl.facts{grid-template-columns:1fr;}.w312 input,.w312 select,.w312 textarea{font-size:16px;}}'
      + '@media (prefers-reduced-motion:reduce){.w312 .card{transition:none;}}'
      /* the pickers inside the studio, the automations and the form editor */
      + '.w312pick{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 10px;font-size:12px;color:' + MUTED + ';}'
      + '.w312pick select{font:inherit;font-size:13px;padding:6px 8px;border:1px solid rgba(16,63,57,.25);border-radius:9px;background:#fff;max-width:100%;}'
      + '.w312fd{border:1px solid rgba(16,63,57,.14);border-radius:12px;padding:10px 12px;margin:12px 0;background:rgba(16,63,57,.025);}'
      + '.w312fd label{display:flex;gap:8px;align-items:flex-start;font-size:14px;}'
      + '.w312fd .two{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}'
      + '.w312fd .two label{flex-direction:column;gap:3px;font-size:12px;font-weight:600;color:' + MUTED + ';}'
      + '.w312fd input[type=text],.w312fd select{font:inherit;font-size:14px;padding:7px 9px;border:1px solid rgba(16,63,57,.25);border-radius:9px;background:#fff;}'
      + '@media (max-width:700px){.w312fd .two{grid-template-columns:1fr;}}'
      /* the photo albums */
      + '.w312al{border:1px solid rgba(16,63,57,.14);border-radius:14px;background:' + CREAM + ';padding:12px 14px;margin:12px 0 4px;font-size:13px;line-height:1.5;}'
      + '.w312al b.h{display:block;color:' + GREEN + ';font-size:15px;margin:0 0 4px;}'
      + '.w312al .als{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px;}'
      + '.w312al .als a{display:inline-block;padding:5px 11px;border-radius:999px;background:#fff;border:1px solid rgba(16,63,57,.2);color:' + GREEN + ';text-decoration:none;font-weight:600;font-size:12px;}'
      + '.w312al .acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px;}'
      + '.w312al button{font:inherit;font-size:12px;font-weight:600;border:1px solid ' + GREEN + ';background:#fff;color:' + GREEN + ';border-radius:999px;padding:5px 12px;cursor:pointer;}'
      + '.w312al .f{display:grid;grid-template-columns:1fr 2fr auto;gap:6px;margin-top:8px;}'
      + '.w312al .f input{font:inherit;font-size:13px;padding:6px 8px;border:1px solid rgba(16,63,57,.25);border-radius:9px;min-width:0;}'
      + '@media (max-width:700px){.w312al .f{grid-template-columns:1fr;}.w312al .f input{font-size:16px;}}';
    document.head.appendChild(st);
  }

  /* ---------- shared: the published forms and the donation campaigns ---------- */
  function loadForms() {
    if (S.forms) return Promise.resolve(S.forms);
    if (S.formsBusy) return S.formsBusy;
    S.formsBusy = Promise.resolve(db.from('crm_forms').select('id,slug,title,lang,status,purpose,settings').eq('status', 'published')).then(function (r) {
      S.forms = ((r && r.data) || []).slice().sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); }); S.formsBusy = null; return S.forms;
    }).catch(function () { S.forms = []; S.formsBusy = null; return S.forms; });
    return S.formsBusy;
  }
  function loadGive() {
    if (S.give) return Promise.resolve(S.give);
    if (S.giveBusy) return S.giveBusy;
    S.giveBusy = Promise.resolve(db.from('app_config').select('key,value').in('key', ['donate_campaigns', 'donate_mode'])).then(function (r) {
      var out = { mode: '', list: [] };
      ((r && r.data) || []).forEach(function (x) {
        if (x.key === 'donate_mode') out.mode = String(x.value || '');
        if (x.key === 'donate_campaigns') {
          var v = x.value; try { if (typeof v === 'string') v = JSON.parse(v); } catch (e) { v = {}; }
          Object.keys(v || {}).forEach(function (k) { if (v[k] && v[k].open !== false) out.list.push([k, v[k].name || k]); });
        }
      });
      S.give = out; S.giveBusy = null; return out;
    }).catch(function () { S.give = { mode: '', list: [] }; S.giveBusy = null; return S.give; });
    return S.giveBusy;
  }
  function giveUrl(key, fr) { var q = []; if (key) q.push('c=' + encodeURIComponent(key)); if (fr) q.push('lang=fr'); return GIVE + (q.length ? '?' + q.join('&') : ''); }
  /* the choices of "Point it at": our donation page (and each open donation campaign), then every live form */
  function targetOptions() {
    var h = '<option value="">Point it at…</option>';
    var g = S.give || { list: [] };
    h += '<optgroup label="Donations">' + opt('give:', 'Our donation page', '') + g.list.map(function (c) { return opt('give:' + c[0], 'Donation page: ' + c[1], ''); }).join('') + '</optgroup>';
    var fs = S.forms || [];
    if (fs.length) h += '<optgroup label="Our live forms">' + fs.map(function (f) { return opt('form:' + f.slug, f.title + ' (' + String(f.lang || 'en').toUpperCase() + ')', ''); }).join('') + '</optgroup>';
    return h;
  }
  function targetOf(v) {
    if (/^give:/.test(v)) { var k = v.slice(5), c = ((S.give && S.give.list) || []).filter(function (x) { return x[0] === k; })[0]; return { url: giveUrl(k, false), label: 'Give now', what: c ? 'the donation page for ' + c[1] : 'our donation page' }; }
    if (/^form:/.test(v)) { var s = v.slice(5), f = (S.forms || []).filter(function (x) { return x.slug === s; })[0]; return { url: FORM_HOST + s, label: f && f.lang === 'fr' ? 'Remplir le formulaire' : 'Fill in the form', what: f ? '“' + f.title + '”' : 'the form' }; }
    return null;
  }
  function setVal(el, v) {
    if (!el) return;
    el.value = v;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { /* fine */ }
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* fine */ }
  }
  function ensureTargets(repaint) {
    if (S.forms && S.give) return;
    Promise.all([loadForms(), loadGive()]).then(function () {
      document.querySelectorAll('select[data-w312btn],select[data-w312cta]').forEach(function (sel) { if (sel.options.length < 3) sel.innerHTML = targetOptions(); });
      if (repaint) repaint();
    });
  }

  /* the email studio's Button block: the picker under its fields (blockForm calls btnPick) */
  function btnPick(i) {
    css(); ensureTargets();
    return '<div class="w312pick"><span>Or send it to</span><select data-w312btn="' + E(i) + '" aria-label="Point the button at a form or the donation page">' + targetOptions() + '</select></div>';
  }
  /* an automation's own email: the picker under Button and Button link (stepBody calls ctaPick) */
  function ctaPick() {
    css(); ensureTargets();
    return '<div class="w312pick"><span>The button goes to</span><select data-w312cta="1" aria-label="Point the button at a form or the donation page">' + targetOptions() + '</select><span>(or type any link)</span></div>';
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    var v = t.value, tg;
    if (t.hasAttribute('data-w312btn')) {
      tg = targetOf(v); if (!tg) return;
      var i = t.getAttribute('data-w312btn'), box = t.closest('.w202bf') || document;
      var u = box.querySelector('[data-w202f="' + i + '.url"]'), l = box.querySelector('[data-w202f="' + i + '.label"]');
      if (l && !String(l.value || '').trim()) setVal(l, tg.label);
      setVal(u, tg.url);
      say('The button now goes to ' + tg.what);
      return;
    }
    if (t.hasAttribute('data-w312cta')) {
      tg = targetOf(v); if (!tg) return;
      var st = t.closest('.w157step') || t.parentNode.parentNode;
      var cu = st.querySelector('[data-w157s="cta_url"]'), cl = st.querySelector('[data-w157s="cta_label"]');
      if (cl && !String(cl.value || '').trim()) setVal(cl, tg.label);
      setVal(cu, tg.url);
      say('The button now goes to ' + tg.what);
      return;
    }
  }, true);

  /* ---------- a form's donate button (the form editor calls formDonate before the thank-you message) ---------- */
  var FD = { f: null };
  function formDonate(f) {
    css(); FD.f = f;
    if (!S.give) loadGive().then(function () { var el = document.querySelector('[data-w312fdc]'); if (el && FD.f) el.innerHTML = fdCampOpts(FD.f); });
    var d = (f.settings && f.settings.donate) || {}, on = d.on === true, fr = f.lang === 'fr';
    return '<div class="w312fd" data-w312fd="1"><label><input type="checkbox" data-w312fdk="on"' + (on ? ' checked' : '') + '><span><b>Show a donate button on the thank-you page</b><br><span style="font-size:12px;color:' + MUTED + '">After they send the form, a gold button takes them to our donation page (hub.welfareavenue.com/give)' + (fr ? ', in French' : '') + '.</span></span></label>'
      + (on ? '<div class="two"><label>The button’s words<input type="text" maxlength="60" data-w312fdk="label" value="' + E(d.label || '') + '" placeholder="' + E(fr ? 'Faire un don' : 'Give to Welfare Avenue') + '" data-w198skip></label>'
        + '<label>The gift counts for<select data-w312fdk="campaign" data-w312fdc="1">' + fdCampOpts(f) + '</select></label></div>' : '') + '</div>';
  }
  function fdCampOpts(f) {
    var d = (f.settings && f.settings.donate) || {}, cur = d.campaign || '';
    return opt('', 'Where it is needed most', cur) + (((S.give && S.give.list) || []).map(function (c) { return opt(c[0], c[1], cur); }).join(''));
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-w312fdk') || !FD.f) return;
    var f = FD.f; f.settings = f.settings || {}; var d = Object.assign({}, f.settings.donate || {}), k = t.getAttribute('data-w312fdk');
    if (k === 'on') d.on = !!t.checked;
    else if (k === 'label') d.label = String(t.value || '').trim().slice(0, 60) || undefined;
    else if (k === 'campaign') d.campaign = t.value || undefined;
    if (d.on) f.settings.donate = JSON.parse(JSON.stringify(d)); else if (f.settings.donate) { f.settings.donate = { on: false }; }
    if (k === 'on') { var box = t.closest('[data-w312fd]'); if (box) box.outerHTML = formDonate(f); }
    try { if (typeof window.w156dirty === 'function') window.w156dirty(); } catch (x) { /* fine */ }
  }, true);

  /* =====================================================================
     Campaigns (#crm/folders)
     ===================================================================== */
  function cLoad(id) {
    S.c.busy = true; S.c.err = '';
    return Promise.resolve(db.rpc('wa312_campaigns', { p_id: id || null })).then(function (r) {
      if (r && r.error) throw r.error;
      if (id) { S.c.d = r.data || null; S.c.id = id; } else S.c.list = (r.data && r.data.campaigns) || [];
      if (!id && r.data && r.data.fund_events) S.c.funds = r.data.fund_events;
    }).catch(function (e) { S.c.err = 'Could not load the campaigns: ' + msgOf(e); }).then(function () { S.c.busy = false; repaint(); });
  }
  var ROOT = { el: null, top: '' };
  function repaint() {
    var el = ROOT.el; if (!el || !document.body.contains(el)) return;
    var tab = S.tab;
    el.innerHTML = ROOT.top + '<div class="w312" id="w312">' + (tab === 'insights' ? insightsHtml() : campaignsHtml()) + '</div>';
  }
  function typeName(k) { var t = TYPES.filter(function (x) { return x[0] === k; })[0], w = t ? t[1].replace(/^An? /, '') : (k || 'campaign'); return w.charAt(0).toUpperCase() + w.slice(1); }
  function statusChip(s) { return s === 'active' ? '<span class="chip">Running</span>' : s === 'done' ? '<span class="chip off">Done</span>' : s === 'planned' ? '<span class="chip gold">Planned</span>' : '<span class="chip off">' + E(s || '') + '</span>'; }
  function campaignsHtml() {
    if (S.c.err && !S.c.list && !S.c.d) return '<p class="err">' + E(S.c.err) + '</p>';
    var id = S.c.id;
    return id ? detailHtml() : listHtml();
  }
  function listHtml() {
    var L = S.c.list;
    if (L === null) return '<p class="m">Loading the campaigns…</p>';
    var act = L.filter(function (c) { return c.status !== 'done'; }), done = L.filter(function (c) { return c.status === 'done'; });
    var card = function (c) {
      var goal = Number(c.goal_amount || 0), raised = Number(c.raised || 0);
      return '<button type="button" class="card" data-w312c="' + E(c.id) + '"><b data-w198skip>' + E(c.name) + '</b>'
        + '<small>' + E(typeName(c.type)) + (c.year ? ' · ' + E(c.year) : '') + ' · ' + (c.status === 'active' ? 'running' : E(c.status || '')) + '</small>'
        + (goal ? '<div class="bar" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(100 * raised / goal)) + '%"></i></div><small>' + money(raised) + ' of ' + money(goal) + '</small>' : (raised ? '<small>' + money(raised) + ' given</small>' : ''))
        + '<small>' + [c.forms ? c.forms + ' form' + (c.forms === 1 ? '' : 's') : '', c.posts ? c.posts + ' post' + (c.posts === 1 ? '' : 's') : '', c.links ? c.links + ' link' + (c.links === 1 ? '' : 's') + ' in its folder' : 'folder empty'].filter(Boolean).join(' · ') + '</small></button>';
    };
    var h = '<p class="lead">Everything about each campaign in one place: what it is, the key facts and rules, its links (the Drive folder, the one-pager, the Canva designs), and what the Hub already knows (its forms, its posts, the gifts and the goal). New to a campaign? Start here instead of searching Slack.</p>';
    h += '<div class="row" style="margin:0 0 12px">' + '<button type="button" class="w152btn" data-w312new="1">+ New campaign</button>' + (S.c.msg ? '<span class="ok">' + E(S.c.msg) + '</span>' : '') + '</div>';
    if (S.c.newOpen) h += newHtml();
    h += act.length ? '<div class="grid" role="list">' + act.map(card).join('') + '</div>' : '<p class="m">No running or planned campaign yet.</p>';
    if (done.length) h += '<h3>Done</h3><div class="grid">' + done.map(card).join('') + '</div>';
    return h;
  }
  function newHtml() {
    var y = new Date().getFullYear();
    var funds = S.c.funds || [];
    return '<div class="box soft"><div class="row">'
      + '<label class="fld">Name<input id="w312nn" maxlength="120" placeholder="e.g. One Bag Challenge 2026" data-w198skip></label>'
      + '<label class="fld" style="flex:0 1 190px">What it is<select id="w312nt">' + TYPES.map(function (t) { return opt(t[0], t[1], 'drive'); }).join('') + '</select></label>'
      + '<label class="fld" style="flex:0 1 110px">Year<input id="w312ny" type="number" inputmode="numeric" min="2015" max="2100" value="' + y + '"></label>'
      + '<label class="fld" style="flex:0 1 140px">Goal ($, optional)<input id="w312ng" type="number" inputmode="decimal" min="0" step="1"></label></div>'
      + (funds.length ? '<div class="row" style="margin-top:8px"><label class="fld">The Fundraising event it belongs to (optional)<select id="w312nf">' + opt('', 'None', '') + funds.map(function (f) { return opt(String(f.id), f.title, ''); }).join('') + '</select></label></div>' : '')
      + '<div class="row" style="margin-top:10px"><button type="button" class="w152btn" data-w312create="1"' + (S.c.saving ? ' disabled' : '') + '>' + (S.c.saving ? 'Making it…' : 'Make the campaign') + '</button><button type="button" class="w152btn ghost" data-w312newx="1">Cancel</button>' + (S.c.err ? '<span class="err">' + E(S.c.err) + '</span>' : '') + '</div></div>';
  }
  function detailHtml() {
    var d = S.c.d;
    if (!d || !d.campaign) return S.c.busy ? '<p class="m">Loading…</p>' : '<p class="err">' + E(S.c.err || 'This campaign could not be found.') + '</p><p><a href="#crm/folders">← All campaigns</a></p>';
    var c = d.campaign, ed = S.c.edit, k = d.gifts || {};
    var goal = Number(c.goal_amount || 0), raised = Number(k.total || 0);
    var h = '<p><a href="#crm/folders">← All campaigns</a></p>';
    h += '<div class="box"><div class="row"><b style="font-size:20px;color:' + GREEN + '" data-w198skip>' + E(c.name) + '</b>' + statusChip(c.status) + '<span class="m">' + E(typeName(c.type)) + (c.year ? ' · ' + E(c.year) : '') + '</span><span class="sp"></span>'
      + (ed ? '' : '<button type="button" class="w152btn sm" data-w312edit="1">Edit the folder</button>') + '</div>'
      + (goal || raised ? '<div class="bar" aria-hidden="true"><i style="width:' + (goal ? Math.min(100, Math.round(100 * raised / goal)) : 100) + '%"></i></div><p class="m" style="margin:2px 0 0">' + money(raised) + ' given' + (goal ? ' of the ' + money(goal) + ' goal' : '') + (k.n ? ' · ' + k.n + ' gift' + (k.n === 1 ? '' : 's') + (k.last ? ', the latest ' + E(dayTxt(k.last)) : '') : '') + ' · <a href="#crm/gifts">Gifts</a></p>' : '')
      + (c.updated_at ? '<p class="m" style="margin:6px 0 0">Folder updated ' + E(dayTxt(c.updated_at)) + (c.updated_by ? ' by ' + E(String(c.updated_by).split('@')[0]) : '') + '</p>' : '') + '</div>';
    if (ed) return h + editHtml(c);
    /* about */
    h += '<h3>What it is</h3><div class="box">' + (String(c.brief || '').trim() ? '<p class="brief" data-w198skip>' + E(c.brief) + '</p>' : '<p class="m">Nothing written yet. <button type="button" class="w152mini" data-w312edit="1">Write what it is</button> so a new person knows the why, the who and the how.</p>') + '</div>';
    var facts = (c.facts || []).filter(function (x) { return x && (x.label || x.value); });
    h += '<h3>Key facts</h3><div class="box">' + (facts.length ? '<dl class="facts">' + facts.map(function (x) { return '<dt data-w198skip>' + E(x.label) + '</dt><dd data-w198skip>' + E(x.value) + '</dd>'; }).join('') + '</dl>' : '<p class="m">No facts yet (the dates, the rules in short, what a gift does, who leads it).</p>')
      + ((c.hashtags || []).length ? '<p style="margin:10px 0 0">' + c.hashtags.map(function (t) { return '<span class="chip" data-w198skip>#' + E(String(t).replace(/^#/, '')) + '</span>'; }).join('') + '</p>' : '') + '</div>';
    var links = (c.links || []).filter(function (x) { return x && okUrl(x.url); });
    h += '<h3>The folder</h3><div class="box">' + (links.length ? '<ul class="l">' + links.map(function (x) { return '<li><a href="' + E(x.url) + '" target="_blank" rel="noopener" data-w198skip>' + E(x.label || x.url) + '</a>' + (x.note ? ' <span class="m" data-w198skip>' + E(x.note) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="m">No links yet. Add the Drive folder, the rules, the one-pager, the Canva designs, anything a teammate needs.</p>') + '</div>';
    /* what the Hub knows */
    var fs = d.forms || [];
    h += '<h3>Its forms</h3><div class="box">' + (fs.length ? '<ul class="l">' + fs.map(function (f) {
      return '<li><div class="row"><b data-w198skip>' + E(f.title) + '</b><span class="chip' + (f.status === 'published' ? '' : ' off') + '">' + (f.status === 'published' ? 'Live' : E(f.status)) + '</span><span class="m">' + E(String(f.lang || '').toUpperCase()) + ' · ' + (f.n || 0) + ' answer' + (f.n === 1 ? '' : 's') + '</span><span class="sp"></span>'
        + (f.status === 'published' ? '<a href="' + E(FORM_HOST + f.slug) + '" target="_blank" rel="noopener">Open</a>' : '') + '<a href="#crm/forms/' + E(f.id) + '">Edit</a></div></li>';
    }).join('') + '</ul>' : '<p class="m">No form files under it yet. In Forms, open a form and pick this campaign under Campaign.</p>') + '</div>';
    var ps = d.posts || [];
    h += '<h3>Its posts</h3><div class="box">' + (ps.length ? '<ul class="l">' + ps.slice(0, 12).map(function (p) {
      var st = p.status === 'published' || p.status === 'posted' ? '<span class="chip">Out ' + E(dayTxt(p.published_at || p.scheduled_at)) + '</span>' : p.approval_status === 'pending' ? '<span class="chip gold">Waiting for approval</span>' : p.scheduled_at ? '<span class="chip gold">' + E(dayTxt(p.scheduled_at)) + '</span>' : '<span class="chip off">Idea or draft</span>';
      return '<li><div class="row"><span data-w198skip>' + E(p.title || 'Post #' + p.id) + '</span>' + st + '<span class="sp"></span><a href="#contentcal/' + E(p.id) + '">Open</a></div></li>';
    }).join('') + '</ul>' + (ps.length > 12 ? '<p class="m">' + (ps.length - 12) + ' more in the Content calendar.</p>' : '') : '<p class="m">No posts carry this campaign yet. In the Content calendar, a post’s Campaign field links it here' + ((c.post_names || []).length ? ' (it matches: ' + E(c.post_names.join(', ')) + ')' : '') + '.</p>') + '</div>';
    h += '<h3>Giving and volunteers</h3><div class="box"><ul class="l">'
      + '<li><div class="row"><b>Donation link</b><span class="sp"></span>' + (c.donate_key ? '<code style="font-size:12px" data-w198skip>' + E(giveUrl(c.donate_key)) + '</code><button type="button" class="w152mini" data-w312copy="' + E(giveUrl(c.donate_key)) + '">Copy</button>' : '<span class="m">Gifts through the donation page go to “where it is needed most”; ask an admin to give this campaign its own donation link.</span>') + '</div></li>'
      + (d.fund_event ? '<li><div class="row"><b>Fundraising event</b><span data-w198skip>' + E(d.fund_event.title) + '</span><span class="m">' + E(d.fund_event.timing || '') + '</span><span class="sp"></span>' + (d.fund_event.volunteer_on ? '<a href="#volunteering/fundraisers/' + E(d.fund_event.id) + '">Its volunteers</a>' : '') + '<a href="#fund">The Fundraising app</a></div></li>' : '')
      + (d.people ? '<li><div class="row"><b>People in it</b><span>' + d.people + '</span><span class="m">contacts the CRM links to this campaign</span></div></li>' : '')
      + '</ul></div>';
    return h;
  }
  function editHtml(c) {
    var dr = S.c.draft || (S.c.draft = JSON.parse(JSON.stringify({ name: c.name, type: c.type, year: c.year, status: c.status, goal_amount: c.goal_amount, brief: c.brief || '', facts: c.facts || [], links: c.links || [], hashtags: (c.hashtags || []).map(function (t) { return '#' + t; }).join(' '), post_names: (c.post_names || []).join(', '), fund_event_id: c.fund_event_id || '' })));
    while (dr.facts.length < 2) dr.facts.push({ label: '', value: '' });
    while (dr.links.length < 2) dr.links.push({ label: '', url: '' });
    var funds = (S.c.d && S.c.d.fund_events) || [];
    return '<div class="box" data-w312ed="1"><div class="row">'
      + '<label class="fld">Name<input data-w312k="name" maxlength="120" value="' + E(dr.name) + '" data-w198skip></label>'
      + '<label class="fld" style="flex:0 1 180px">What it is<select data-w312k="type">' + TYPES.map(function (t) { return opt(t[0], t[1], dr.type); }).join('') + '</select></label>'
      + '<label class="fld" style="flex:0 1 100px">Year<input data-w312k="year" type="number" inputmode="numeric" value="' + E(dr.year || '') + '"></label>'
      + '<label class="fld" style="flex:0 1 140px">Status<select data-w312k="status">' + opt('planned', 'Planned', dr.status) + opt('active', 'Running', dr.status) + opt('done', 'Done', dr.status) + '</select></label>'
      + '<label class="fld" style="flex:0 1 130px">Goal ($)<input data-w312k="goal_amount" type="number" inputmode="decimal" min="0" value="' + E(dr.goal_amount == null ? '' : dr.goal_amount) + '"></label></div>'
      + '<label class="fld" style="margin-top:10px">What it is, the why and the how (for someone new)<textarea data-w312k="brief" maxlength="4000" rows="6" data-w198skip>' + E(dr.brief) + '</textarea></label>'
      + '<p class="m" style="margin:12px 0 4px">Key facts (dates, the rules in short, what a gift does, who leads it)</p>'
      + dr.facts.map(function (x, i) { return '<div class="pair"><input data-w312f="facts.' + i + '.label" maxlength="60" placeholder="e.g. What $25 does" value="' + E(x.label) + '" data-w198skip><input data-w312f="facts.' + i + '.value" maxlength="300" placeholder="e.g. Fills one bag: hygiene products, clothing, hand warmers, a book" value="' + E(x.value) + '" data-w198skip><button type="button" class="x" data-w312del="facts.' + i + '" aria-label="Remove this fact">×</button></div>'; }).join('')
      + '<button type="button" class="w152mini" data-w312add="facts">+ A fact</button>'
      + '<p class="m" style="margin:12px 0 4px">Links (https): the Drive folder, the rules, the one-pager, the Canva designs</p>'
      + dr.links.map(function (x, i) { return '<div class="pair"><input data-w312f="links.' + i + '.label" maxlength="80" placeholder="e.g. The rules (volunteer doc)" value="' + E(x.label) + '" data-w198skip><input data-w312f="links.' + i + '.url" type="url" inputmode="url" maxlength="500" placeholder="https://docs.google.com/..." value="' + E(x.url) + '"><button type="button" class="x" data-w312del="links.' + i + '" aria-label="Remove this link">×</button></div>'; }).join('')
      + '<button type="button" class="w152mini" data-w312add="links">+ A link</button>'
      + '<div class="row" style="margin-top:12px"><label class="fld">Hashtags (with or without #)<input data-w312k="hashtags" maxlength="200" value="' + E(dr.hashtags) + '" placeholder="#onebagchallenge" data-w198skip></label>'
      + '<label class="fld">Its posts in the Content calendar carry the campaign<input data-w312k="post_names" maxlength="300" value="' + E(dr.post_names) + '" placeholder="One Bag Challenge, One Bag Challenge launch" data-w198skip></label></div>'
      + (funds.length ? '<div class="row" style="margin-top:8px"><label class="fld">The Fundraising event it belongs to<select data-w312k="fund_event_id">' + opt('', 'None', dr.fund_event_id) + funds.map(function (f) { return opt(String(f.id), f.title, dr.fund_event_id); }).join('') + '</select></label></div>' : '')
      + '<div class="row" style="margin-top:12px"><button type="button" class="w152btn" data-w312save="1"' + (S.c.saving ? ' disabled' : '') + '>' + (S.c.saving ? 'Saving…' : 'Save the folder') + '</button><button type="button" class="w152btn ghost" data-w312cancel="1">Cancel</button>' + (S.c.err ? '<span class="err">' + E(S.c.err) + '</span>' : '') + '</div></div>';
  }
  function draftSet(path, val) {
    var dr = S.c.draft; if (!dr) return;
    var p = path.split('.'); if (p.length === 1) { dr[p[0]] = val; return; }
    var arr = dr[p[0]]; var i = Number(p[1]); if (!arr[i]) arr[i] = {}; arr[i][p[2]] = val;
  }
  function draftOut() {
    var dr = S.c.draft;
    var tags = String(dr.hashtags || '').split(/[\s,]+/).map(function (t) { return t.replace(/^#+/, '').trim(); }).filter(Boolean);
    var names = String(dr.post_names || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    return {
      id: S.c.id, name: String(dr.name || '').trim(), type: dr.type, year: dr.year ? Number(dr.year) : null, status: dr.status,
      goal_amount: dr.goal_amount === '' || dr.goal_amount == null ? null : Number(dr.goal_amount), brief: String(dr.brief || ''),
      facts: (dr.facts || []).filter(function (x) { return x && (String(x.label || '').trim() || String(x.value || '').trim()); }),
      links: (dr.links || []).filter(function (x) { return x && String(x.url || '').trim(); }),
      hashtags: tags, post_names: names, fund_event_id: dr.fund_event_id ? Number(dr.fund_event_id) : null
    };
  }

  /* =====================================================================
     Email insights (#crm/insights)
     ===================================================================== */
  function mLoad() {
    S.m.busy = true; S.m.err = '';
    return Promise.resolve(db.rpc('wa312_mail_insights', { p_days: S.m.days })).then(function (r) { if (r && r.error) throw r.error; S.m.d = r.data || {}; })
      .catch(function (e) { S.m.err = 'Could not load the insights: ' + msgOf(e); }).then(function () { S.m.busy = false; repaint(); });
  }
  function insightsHtml() {
    var d = S.m.d;
    if (!d) return S.m.err ? '<p class="err">' + E(S.m.err) + '</p>' : '<p class="m">Loading the insights…</p>';
    var months = d.months || [], heat = d.heat || [], tot = { sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0 };
    months.forEach(function (m) { Object.keys(tot).forEach(function (k) { tot[k] += Number(m[k] || 0); }); });
    var h = '<p class="lead">How our emails do, month by month, and when our contacts open them. It counts the emails the Hub sends (one person, Sends to a list and automations), not the tests. Newsletters sent from Keela until 5 December are not in it.</p>';
    if (!d.tracking) h += '<div class="note"><b>Opens and clicks are not being counted yet.</b> Resend only tells the Hub about them when open and click tracking is on for welfareavenue.com. An admin turns both on in Resend, Domains, welfareavenue.com, Configuration, and adds <i>email.opened</i> and <i>email.clicked</i> to the Hub’s webhook in Resend, Webhooks. From then on this page fills in by itself.</div>';
    h += '<div class="kpis"><div class="kpi"><b>' + tot.sent + '</b><span>sent, last ' + Math.round(S.m.days / 30) + ' months</span></div><div class="kpi"><b>' + pct(tot.delivered, tot.sent) + '</b><span>delivered</span></div>'
      + '<div class="kpi"><b>' + (d.tracking ? pct(tot.opened, tot.delivered) : '–') + '</b><span>opened</span></div><div class="kpi"><b>' + (d.tracking ? pct(tot.clicked, tot.delivered) : '–') + '</b><span>clicked a link</span></div>'
      + '<div class="kpi"><b>' + tot.unsubscribed + '</b><span>unsubscribed</span></div></div>';
    h += '<h3>Each month</h3><div class="box tw">' + (months.length ? '<table class="t"><thead><tr><th>Month</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Clicked</th><th>Unsubscribed</th><th>Bounced</th></tr></thead><tbody>'
      + months.map(function (m) { return '<tr><td>' + E(monthTxt(m.month)) + '</td><td>' + m.sent + '</td><td>' + m.delivered + '</td><td>' + (d.tracking ? m.opened + ' (' + pct(m.opened, m.delivered) + ')' : '–') + '</td><td>' + (d.tracking ? m.clicked + ' (' + pct(m.clicked, m.delivered) + ')' : '–') + '</td><td>' + m.unsubscribed + '</td><td>' + m.bounced + '</td></tr>'; }).join('')
      + '</tbody></table>' : '<p class="m">No email sent from the Hub in this window.</p>') + '</div>';
    /* when people open: weekday x time of day */
    var by = {}, max = 0, best = null;
    heat.forEach(function (c) { var k = c.dow + ':' + c.slot; by[k] = c; if (Number(c.opens) > max) max = Number(c.opens); if (!best || Number(c.opens) > Number(best.opens)) best = c; });
    h += '<h3>When people open them</h3><div class="box">';
    if (!d.tracking || !max) h += '<p class="m">' + (d.tracking ? 'No opens in this window yet.' : 'This fills in once opens are counted (see above).') + ' Until then, the times the emails went out are below.</p>';
    else h += '<p style="margin:0 0 8px">The most opens: <b>' + E(DAYS[best.dow]) + ', ' + E((SLOTS.filter(function (s) { return String(s[0]) === String(best.slot); })[0] || [0, ''])[1]) + '</b> (Toronto time, ' + best.opens + ' open' + (best.opens === 1 ? '' : 's') + ').</p>';
    var cellMax = max || heat.reduce(function (a, c) { return Math.max(a, Number(c.sends || 0)); }, 0) || 1, useOpens = !!(d.tracking && max);
    h += '<div class="tw"><table class="heat"><thead><tr><th></th>' + [1, 2, 3, 4, 5, 6, 0].map(function (w) { return '<th>' + DAYS[w] + '</th>'; }).join('') + '</tr></thead><tbody>'
      + SLOTS.map(function (s) {
        return '<tr><th>' + E(s[1]) + '</th>' + [1, 2, 3, 4, 5, 6, 0].map(function (w) {
          var c = by[w + ':' + s[0]] || {}, n = Number(useOpens ? c.opens : c.sends) || 0, a = n ? 0.12 + 0.78 * n / cellMax : 0;
          return '<td style="background:' + (n ? 'rgba(220,165,39,' + a.toFixed(2) + ')' : '#F3EFE6') + '" title="' + DAYS[w] + ', ' + E(s[1]) + ': ' + n + (useOpens ? ' opens' : ' sent') + '">' + (n || '') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="m" style="margin:6px 0 0">' + (useOpens ? 'Opens' : 'Emails sent') + ' by weekday and time of day, Toronto time.</p></div>';
    /* the send-time test */
    h += '<h3>Find our best send time</h3><div class="box soft"><p style="margin:0">For the next four newsletters, send each at a different time, then read this page at the end of the month: the opens show when our contacts read.</p><ol class="plan">'
      + TEST_SLOTS.map(function (t, i) { return '<li>Week ' + (i + 1) + ': ' + E(t[2]) + ' (' + E(t[0]) + ', ' + E(t[1]) + ')</li>'; }).join('') + '</ol>'
      + '<p class="m" style="margin:8px 0 0">Schedule a Send for its time in Sends; keep the subject style the same so the time is the only change.</p></div>';
    return h;
  }

  /* ---------- the CRM's two new tabs ---------- */
  S.tab = '';
  function route(parts) {
    var sub = parts[1] || '';
    S.tab = sub === 'insights' ? 'insights' : 'folders';
    if (S.tab === 'folders') {
      var id = parts[2] && /^\d+$/.test(parts[2]) ? Number(parts[2]) : null;
      if (id !== S.c.id) { S.c.edit = false; S.c.draft = null; S.c.err = ''; }
      S.c.id = id;
      if (id) { if (!S.c.d || S.c.d.campaign && Number(S.c.d.campaign.id) !== id) { S.c.d = null; cLoad(id); } }
      else { S.c.d = null; if (S.c.list === null || S.c.stale) { S.c.stale = false; cLoad(null); } }
    } else if (!S.m.d && !S.m.busy) mLoad();
  }
  function paintCrm(root, tab, top) {
    css(); ROOT.el = root; ROOT.top = top || ''; S.tab = tab;
    repaint();
    mast(tab);
  }
  function mast(tab) {
    try {
      var sec = document.getElementById('crm'); if (!sec) return;
      var m = sec.querySelector('.w118mast'); if (!m) return;
      var h1 = m.querySelector('h1'), p = m.querySelector(':scope > p');
      var t = tab === 'insights' ? ['Email insights', 'How our emails do and when our contacts open them'] : ['Campaigns', 'Each campaign’s folder: what it is, its facts and links, its forms, posts and gifts'];
      if (h1 && h1.textContent !== t[0]) h1.textContent = t[0];
      if (p && p.textContent !== t[1]) p.textContent = t[1];
    } catch (e) { /* fine */ }
  }

  /* the CRM's rail: Campaigns (with Gifts) and Email insights */
  function arm() {
    var A = window.WA_APP && window.WA_APP.apps;
    if (!A || !A.crm || typeof A.crm.groups !== 'function') return false;
    if (A.crm.__w312) return true;
    var g0 = A.crm.groups;
    A.crm.groups = function () {
      var gs = g0.apply(this, arguments);
      try {
        var giving = gs.filter(function (g) { return /giving/i.test(g.label || ''); })[0];
        var it = { h: '#crm/folders', l: 'Campaigns', ic: 'box', page: 'crm' };
        if (giving) { giving.label = 'Campaigns and giving'; if (!giving.items.some(function (x) { return x.h === it.h; })) giving.items.unshift(it); }
        else gs.splice(1, 0, { label: 'Campaigns', items: [it] });
        var em = gs.filter(function (g) { return /email/i.test(g.label || ''); })[0];
        var it2 = { h: '#crm/insights', l: 'Email insights', ic: 'chart', page: 'crm' };
        if (em && !em.items.some(function (x) { return x.h === it2.h; })) em.items.push(it2);
      } catch (e) { /* the rail as it was */ }
      return gs;
    };
    A.crm.__w312 = true;
    return true;
  }
  if (!arm()) { setTimeout(arm, 800); setTimeout(arm, 2500); setTimeout(arm, 6000); }

  /* ---------- clicks and fields on the two pages ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#w312 [data-w312c],#w312 [data-w312new],#w312 [data-w312newx],#w312 [data-w312create],#w312 [data-w312edit],#w312 [data-w312cancel],#w312 [data-w312save],#w312 [data-w312add],#w312 [data-w312del],#w312 [data-w312copy]') : null;
    if (!t) return;
    if (t.hasAttribute('data-w312c')) { go('#crm/folders/' + t.getAttribute('data-w312c')); return; }
    if (t.hasAttribute('data-w312new')) { S.c.newOpen = true; S.c.err = ''; S.c.msg = ''; repaint(); var n = document.getElementById('w312nn'); if (n) n.focus(); return; }
    if (t.hasAttribute('data-w312newx')) { S.c.newOpen = false; S.c.err = ''; repaint(); return; }
    if (t.hasAttribute('data-w312create')) {
      var nm = ((document.getElementById('w312nn') || {}).value || '').trim();
      if (nm.length < 3) { S.c.err = 'Give the campaign a name.'; repaint(); return; }
      var p = { name: nm, type: (document.getElementById('w312nt') || {}).value || 'drive', year: Number((document.getElementById('w312ny') || {}).value) || null, status: 'planned',
        goal_amount: (document.getElementById('w312ng') || {}).value ? Number(document.getElementById('w312ng').value) : null, fund_event_id: (document.getElementById('w312nf') || {}).value ? Number(document.getElementById('w312nf').value) : null };
      S.c.saving = true; S.c.err = ''; repaint();
      Promise.resolve(db.rpc('wa312_campaign_save', { p: p })).then(function (r) {
        S.c.saving = false;
        if (r && r.error) { S.c.err = msgOf(r.error); repaint(); return; }
        S.c.newOpen = false; S.c.list = null; S.c.stale = true; say('Campaign made: now fill its folder');
        go('#crm/folders/' + (r.data && r.data.id));
      });
      return;
    }
    if (t.hasAttribute('data-w312edit')) { S.c.edit = true; S.c.draft = null; S.c.err = ''; repaint(); return; }
    if (t.hasAttribute('data-w312cancel')) { S.c.edit = false; S.c.draft = null; S.c.err = ''; repaint(); return; }
    if (t.hasAttribute('data-w312add')) { var k = t.getAttribute('data-w312add'); if (S.c.draft) { if (S.c.draft[k].length >= 20) return; S.c.draft[k].push(k === 'facts' ? { label: '', value: '' } : { label: '', url: '' }); repaint(); } return; }
    if (t.hasAttribute('data-w312del')) { var q = t.getAttribute('data-w312del').split('.'); if (S.c.draft) { S.c.draft[q[0]].splice(Number(q[1]), 1); repaint(); } return; }
    if (t.hasAttribute('data-w312save')) {
      var out = draftOut();
      if (out.name.length < 3) { S.c.err = 'Give the campaign a name.'; repaint(); return; }
      var bad = out.links.filter(function (x) { return !okUrl(x.url); })[0];
      if (bad) { S.c.err = 'Links start with https:// (' + String(bad.url).slice(0, 40) + ')'; repaint(); return; }
      S.c.saving = true; S.c.err = ''; repaint();
      Promise.resolve(db.rpc('wa312_campaign_save', { p: out })).then(function (r) {
        S.c.saving = false;
        if (r && r.error) { S.c.err = msgOf(r.error); repaint(); return; }
        S.c.edit = false; S.c.draft = null; S.c.stale = true; say('Folder saved'); cLoad(S.c.id);
      });
      return;
    }
    if (t.hasAttribute('data-w312copy')) { var v = t.getAttribute('data-w312copy'); try { navigator.clipboard.writeText(v).then(function () { say('Link copied'); }, function () { say(v); }); } catch (x) { say(v); } return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w312 [data-w312ed]')) return;
    if (t.hasAttribute('data-w312k')) draftSet(t.getAttribute('data-w312k'), t.value);
    else if (t.hasAttribute('data-w312f')) draftSet(t.getAttribute('data-w312f'), t.value);
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w312 [data-w312ed]')) return;
    if (t.hasAttribute('data-w312k')) draftSet(t.getAttribute('data-w312k'), t.value);
  });

  /* =====================================================================
     The Photo library: the albums in Google Photos (the library's paint calls albumsHtml)
     ===================================================================== */
  function loadAlbums() {
    if (S.albums || S.albumsBusy) return;
    S.albumsBusy = Promise.resolve(db.from('wa_photo_albums').select('id,label,url,taken_on,note').order('taken_on', { ascending: false, nullsFirst: false }).limit(40)).then(function (r) {
      S.albums = (r && !r.error && r.data) || []; S.albumsBusy = null; albumsPaint();
    }).catch(function () { S.albums = []; S.albumsBusy = null; });
  }
  function albumsPaint() { var el = document.querySelector('.w312al'); if (el) el.outerHTML = albumsHtml(); }
  function albumsHtml() {
    css(); if (!S.albums) loadAlbums();
    var al = S.albums || [];
    var canAdd = staff();
    return '<div class="w312al" data-w118c="1"><b class="h">The albums in Google Photos</b>'
      + 'The team’s photos live in Google Photos (thousands of them). The library below holds the ones picked, labelled and cleared to use. Google stopped letting other apps read albums in March 2025, so the Hub cannot copy them by itself: open an album, download the best few, then Add photos.'
      + (al.length ? '<div class="als">' + al.map(function (a) { return '<a href="' + E(a.url) + '" target="_blank" rel="noopener" data-w198skip>' + E(a.label) + (a.taken_on ? ' · ' + E(dayTxt(a.taken_on)) : '') + '</a>'; }).join('') + '</div>' : (S.albums ? '<p style="margin:6px 0 0;color:' + MUTED + '">No album listed yet.</p>' : ''))
      + (canAdd ? (S.albumOpen ? '<div class="f"><input id="w312alab" maxlength="80" placeholder="Album name, e.g. Oberoi serving, 1 Nov" data-w198skip><input id="w312aurl" type="url" inputmode="url" placeholder="https://photos.app.goo.gl/..."><button type="button" data-w312asave="1"' + (S.albumSaving ? ' disabled' : '') + '>' + (S.albumSaving ? 'Adding…' : 'Add it') + '</button></div>' + (S.albumErr ? '<p class="err" style="color:' + FLAG + ';margin:4px 0 0">' + E(S.albumErr) + '</p>' : '')
        : '<div class="acts"><button type="button" data-w312aopen="1">+ List an album</button><a href="#photos/new">Add photos to the library</a></div>') : '')
      + '</div>';
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-w312aopen],[data-w312asave]') : null; if (!t) return;
    if (t.hasAttribute('data-w312aopen')) { S.albumOpen = true; S.albumErr = ''; albumsPaint(); var i = document.getElementById('w312alab'); if (i) i.focus(); return; }
    var lab = ((document.getElementById('w312alab') || {}).value || '').trim(), url = ((document.getElementById('w312aurl') || {}).value || '').trim();
    if (lab.length < 2) { S.albumErr = 'Give the album a name.'; albumsPaint(); return; }
    if (!/^https:\/\/(photos\.app\.goo\.gl|photos\.google\.com|goo\.gl\/photos)\//i.test(url)) { S.albumErr = 'Paste the album’s share link (https://photos.app.goo.gl/...).'; albumsPaint(); return; }
    S.albumSaving = true; S.albumErr = ''; albumsPaint();
    var me = ''; try { me = (USER && USER.email) || ''; } catch (x) { /* fine */ }
    Promise.resolve(db.from('wa_photo_albums').insert({ label: lab.slice(0, 80), url: url.slice(0, 500), added_by: me || null })).then(function (r) {
      S.albumSaving = false;
      if (r && r.error) { S.albumErr = 'Not added: ' + msgOf(r.error); albumsPaint(); return; }
      S.albumOpen = false; S.albums = null; say('Album listed'); loadAlbums();
    });
  });

  /* page tours (Hub page tours): Campaigns and Email insights */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours) return false; if (W.tours.crmcampaigns) return true;
      var T = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      var OPT = { opt: 1 };
      W.tours.crmcampaigns = { tab: 'crm', icon: 'box', hash: '#crm/folders', steps: [
        T('#w153rail [data-w153go="#crm/folders"]', 'Campaigns', 'Every campaign has a folder here: a drive, an appeal, an event, a challenge. New to one? Start here instead of searching Slack.', OPT),
        T('#w312 [data-w312new]', 'Add a campaign', 'Anyone on the team can add one: its name, what it is, the year and the goal.', OPT),
        T('#w312 .grid', 'Each campaign', 'The goal and what has been given so far, its forms, its posts and how full its folder is. Open one to see everything.', OPT),
        { c: 1, t: 'Inside a campaign', p: 'What it is (the why and the how), the key facts and rules, the folder of links (Drive, the one-pager, Canva), its hashtags, then what the Hub already knows: the forms that file under it, its posts in the Content calendar, the gifts, its donation link and its volunteers. Edit the folder keeps it up to date for the next person.' }
      ] };
      W.tours.crminsights = { tab: 'crm', icon: 'chart', hash: '#crm/insights', steps: [
        T('#w153rail [data-w153go="#crm/insights"]', 'Email insights', 'How our emails do and when our contacts open them.', OPT),
        T('#w312 .kpis', 'The numbers', 'Sent, delivered, opened, clicked and unsubscribed, for the emails the Hub sends (not the tests).', OPT),
        T('#w312 table.heat', 'When people open', 'Weekday by time of day, Toronto time: the darker the gold, the more opens. Until opens are counted it shows when the emails went out.', OPT),
        T('#w312 ol.plan', 'Find our best send time', 'Send four newsletters at four different times, one a week, then read the month here.', OPT)
      ] };
      return true;
    } catch (e) { return false; }
  }
  if (!addTours()) { var tt = 0, tiv = setInterval(function () { if (addTours() || ++tt > 40) clearInterval(tiv); }, 500); }

  window.w312 = { btnPick: btnPick, ctaPick: ctaPick, formDonate: formDonate, route: route, paintCrm: paintCrm, albumsHtml: albumsHtml, state: function () { return S; }, targetOf: targetOf, giveUrl: giveUrl };
})();

/* =====================================================================
   WA v110 boot veil + self-provisioning$n0$, chr(13), ''),
    replace($n1$sub === 'reports' ? 'reports' : (sub === 'folders' || sub === 'insights') ? sub : (sub === 'settings' && parts[2] === 'imports') ? 'imports' : 'contacts';   /* wave312: Campaigns and Email insights */$n1$, chr(13), ''),
    replace($n2$    if (sub === 'reports') openReports(parts);
    if ((sub === 'folders' || sub === 'insights') && window.w312) window.w312.route(parts);   /* wave312 */
$n2$, chr(13), ''),
    replace($n3$    else if (S.ui.tab === 'imports') paintImports(root);
    else if ((S.ui.tab === 'folders' || S.ui.tab === 'insights') && window.w312) window.w312.paintCrm(root, S.ui.tab, tabsHtml());   /* wave312 */
$n3$, chr(13), ''),
    replace($n4$inp(i, 'caption', 'Small line under it', b.caption, { ph: 'Two minutes \u00b7 your volunteer hours count' }) + (window.w312 ? window.w312.btnPick(i) : ''); }   /* wave312 */$n4$, chr(13), ''),
    replace($n5$fld('cta_url', 'Button link', s.cta_url, 'https://welfareavenue.com') + '</div>' + (window.w312 ? window.w312.ctaPick() : '')) +   /* wave312 */$n5$, chr(13), ''),
    replace($n6$      (window.w312 ? window.w312.formDonate(f) : '') +   /* wave312: a donate button on the thank-you */
      inp('thank_you', 'Thank-you message (after they send it)', 'Thank you. We have your answers.', true) +
$n6$, chr(13), ''),
    replace($n7$    var list = shown(), html = toolbar() + (window.w312 ? window.w312.albumsHtml() : '');   /* wave312: the albums in Google Photos */
$n7$, chr(13), ''),
    replace($n8$'<div class="grp"><h3>' + E(g.y) + '</h3><span>' + all + ' photo' + (all === 1 ? '' : 's') + ' in the library</span></div>$n8$, chr(13), '')];
begin
  select string_agg(content, '' order by part) into v from public.site_files where path = 'index.html';
  if v is null then raise exception 'index.html not found'; end if;
  if position('wave312' in v) > 0 then raise exception 'index.html already has wave312'; end if;
  if md5(v) <> '9cd38ba16139f97b90e62406aefe835d' then raise notice 'index.html has moved since this file was made (md5 %): the edits apply only if each still matches exactly once', md5(v); end if;
  v_new := v;
  for i in 1..array_length(olds, 1) loop
    o := olds[i]; nw := news[i];
    n := (length(v_new) - length(replace(v_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'index.html: edit % matches % times, nothing changed', i, n; end if;
    v_new := replace(v_new, o, nw);
  end loop;
  if md5(v) = '9cd38ba16139f97b90e62406aefe835d' and md5(v_new) <> '31637730c5e8f2bfad8137fa6b3a5de3' then raise exception 'index.html: unexpected result %', md5(v_new); end if;
  if right(v_new, 8) <> E'</html>\n' then raise exception 'index.html: tail mismatch'; end if;
  sz := ceil(length(v_new) / 10.0);
  for i in 1..10 loop
    update public.site_files set content = substr(v_new, (i - 1) * sz + 1, sz), updated_at = now() where path = 'index.html' and part = i;
    if not found then raise exception 'index.html part % missing', i; end if;
  end loop;
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') <> md5(v_new) then raise exception 'index.html: post-check failed'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave312', md5(v), md5(v_new) || ': Campaigns and Email insights in the CRM, buttons to a form or the donation page, the donate button on forms, the photo albums', 'Claude for Steel (12/11/26)');
end $pg$;
do $pg$
declare v text; v_new text; n int; i int; sz int; o text; nw text;
  olds text[] := array[replace($o0$<!-- Welfare Avenue: the public page of the CRM's forms (wave156, 28/09/26).$o0$, chr(13), ''),
    replace($o1$.done .heart{position:absolute;right:-6px;top:-10px;width:70px;height:auto;transform:rotate(10deg)}
$o1$, chr(13), ''),
    replace($o2$<p>' + E(msg) + '</p><p><a href="https://welfareavenue.com">'$o2$, chr(13), '')];
  news text[] := array[replace($n0$<!-- Welfare Avenue: the public page of the CRM's forms (wave156, 28/09/26; wave312, 12/11/26: a donate button on the thank-you when the form asks for one).$n0$, chr(13), ''),
    replace($n1$.done .heart{position:absolute;right:-6px;top:-10px;width:70px;height:auto;transform:rotate(10deg)}
.done .give{display:inline-block;font-weight:600;font-size:17px;border-radius:999px;padding:13px 28px;background:var(--gold);color:var(--ink);text-decoration:none;margin:4px 0 6px;transition:transform 160ms cubic-bezier(.23,1,.32,1)}
.done .give:active{transform:scale(.97)}
.done .give:focus-visible{outline:3px solid var(--green);outline-offset:3px}
$n1$, chr(13), ''),
    replace($n2$<p>' + E(msg) + '</p>' + (S.form && S.form.donate && /^https:\/\/hub\.welfareavenue\.com\/give/.test(S.form.donate.url) ? '<p><a class="give" href="' + E(S.form.donate.url) + '" target="_blank" rel="noopener">' + E(S.form.donate.label) + '</a></p>' : '') + '<p><a href="https://welfareavenue.com">'$n2$, chr(13), '')];
begin
  select string_agg(content, '' order by part) into v from public.site_files where path = 'f/index.html';
  if v is null then raise exception 'f/index.html not found'; end if;
  if position('wave312' in v) > 0 then raise exception 'f/index.html already has wave312'; end if;
  if md5(v) <> 'da9c679fa5e1a8d3a20926e918652543' then raise notice 'f/index.html has moved since this file was made (md5 %): the edits apply only if each still matches exactly once', md5(v); end if;
  v_new := v;
  for i in 1..array_length(olds, 1) loop
    o := olds[i]; nw := news[i];
    n := (length(v_new) - length(replace(v_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'f/index.html: edit % matches % times, nothing changed', i, n; end if;
    v_new := replace(v_new, o, nw);
  end loop;
  if md5(v) = 'da9c679fa5e1a8d3a20926e918652543' and md5(v_new) <> 'fd573bb15c2c100ab110f35e15558eac' then raise exception 'f/index.html: unexpected result %', md5(v_new); end if;
  if right(v_new, 8) <> E'</html>\n' then raise exception 'f/index.html: tail mismatch'; end if;
  update public.site_files set content = v_new, updated_at = now() where path = 'f/index.html';
  if not found then raise exception 'f/index.html missing'; end if;
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'f/index.html') <> md5(v_new) then raise exception 'f/index.html: post-check failed'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'f/index.html', 'wave312', md5(v), md5(v_new) || ': a donate button on the thank-you', 'Claude for Steel (12/11/26)');
end $pg$;

-- 4. publish
select public.call_edge('host-sync', '{}'::jsonb) as host_sync,
  (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') as hub_md5,
  (select md5(content) from public.site_files where path = 'f/index.html') as form_md5;
