-- wave225: the Content Studio (Steel, 09/10/26: "build it entirely on the content calendar. Make it the most sophisticated
-- content calendar possible. Consider making it an app in the hub."). His choices: an app of its own (the calendar and the
-- analytics move into it); marketing leads and admins publish, everyone else asks for approval; the marketing team and admins
-- answer comments (deleting is leads and admins); LinkedIn, TikTok and YouTube by the reminder flow until their connections
-- are approved.

-- ---------- who ----------
create or replace function public.wa225_marketing() returns boolean
language sql stable security definer set search_path to '' as $$
  select public.is_wa_staff() and (
    exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role = 'admin')
    or exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role <> 'blocked' and r.profile = 'marketing')
    or exists (select 1 from public.team_members t where lower(t.email) = public.wa_email() and t.active and t.department = 'marketing'));
$$;
comment on function public.wa225_marketing() is 'wave225: the marketing team and admins (the Content Studio''s people who reply to comments and edit the library). Staff with the marketing profile or in the marketing department, or an admin.';

create or replace function public.wa225_publisher() returns boolean
language sql stable security definer set search_path to '' as $$
  select public.is_wa_staff() and (
    exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role = 'admin')
    or (exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role = 'leader')
        and public.wa225_marketing()));
$$;
comment on function public.wa225_publisher() is 'wave225: who publishes without an approval (Steel, 09/10/26: marketing leads and admins). Admins, and leaders on the marketing team. Everyone else sends a post for approval.';

-- ---------- the post ----------
alter table public.content_posts
  add column if not exists variants jsonb not null default '{}'::jsonb,
  add column if not exists first_comment text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists approval_status text not null default 'none',
  add column if not exists approval_note text,
  add column if not exists submitted_by text,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists repeat_rule jsonb,
  add column if not exists repeat_of bigint references public.content_posts(id) on delete set null,
  add column if not exists track_links boolean not null default true,
  add column if not exists utm jsonb,
  add column if not exists manual jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'content_posts_approval_check') then
    alter table public.content_posts add constraint content_posts_approval_check check (approval_status in ('none', 'pending', 'approved', 'changes'));
  end if;
end $$;
create index if not exists content_posts_repeat_of_idx on public.content_posts(repeat_of);
create index if not exists content_posts_approval_idx on public.content_posts(approval_status) where approval_status = 'pending';
comment on column public.content_posts.platforms is 'Target platforms: instagram, facebook, threads, linkedin, tiktok, youtube (wave225 adds the last four).';
comment on column public.content_posts.variants is 'wave225: per-platform settings and overrides, {platform: {caption, kind (feed|reel|story), first_comment, collaborators[], user_tags[{username,x,y,media}], location {id,name}, alt [per photo], cover_ms, share_to_feed, title, privacy, made_for_kids}}. Empty keys fall back to the shared caption and first comment.';
comment on column public.content_posts.first_comment is 'wave225: the first comment posted right after the post (Instagram, Facebook, Threads reply), unless a platform variant has its own.';
comment on column public.content_posts.tags is 'wave225: the post''s tags (content_tags names), for filters in the calendar, the queue and the analytics.';
comment on column public.content_posts.approval_status is 'wave225: none (a publisher''s post), pending (sent for approval), approved, changes (sent back with approval_note). Only wa225_publisher() can schedule or publish a post that is not approved (trigger wa225_post_guard).';
comment on column public.content_posts.repeat_rule is 'wave225: {every: week|2weeks|month, times: n, until: date}; after a repeating post goes out, social-publish makes the next one (repeat_of points at the first).';
comment on column public.content_posts.track_links is 'wave225: links in the caption become hub.welfareavenue.com/l/<code> short links with UTM tags when the post goes out (short_links counts the clicks).';
comment on column public.content_posts.utm is 'wave225: UTM overrides {source, medium, campaign}; the default is the platform, social, and the post''s campaign.';
comment on column public.content_posts.manual is 'wave225: the reminder flow for platforms the Hub cannot post to directly: {platform: {reminded_at, posted_at, posted_by, url}}.';

-- only publishers schedule or publish what is not approved; anyone may plan drafts and mark a post posted by hand
create or replace function public.wa225_post_guard() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if auth.uid() is null then return new; end if;   -- the service role and the pipeline
  -- a publisher's own schedule counts as approved, so a teammate can still move its date
  if new.status in ('scheduled', 'publishing', 'published') and coalesce(new.approval_status, 'none') = 'none' and public.wa225_publisher() then
    new.approval_status := 'approved'; new.approved_by := public.wa_email(); new.approved_at := now();
  end if;
  if new.status in ('scheduled', 'publishing', 'published')
     and (tg_op = 'INSERT' or old.status is distinct from new.status or old.scheduled_at is distinct from new.scheduled_at
          or old.caption is distinct from new.caption or old.media is distinct from new.media or old.variants is distinct from new.variants or old.platforms is distinct from new.platforms)
     and coalesce(new.approval_status, 'none') <> 'approved'
     and not public.wa225_publisher() then
    raise exception 'needs approval: a marketing lead or an admin approves this post before it is scheduled' using errcode = '42501';
  end if;
  -- an approved post that is edited by someone who cannot publish goes back for approval
  if tg_op = 'UPDATE' and old.approval_status = 'approved' and not public.wa225_publisher()
     and (old.caption is distinct from new.caption or old.media is distinct from new.media or old.variants is distinct from new.variants or old.platforms is distinct from new.platforms) then
    new.approval_status := 'pending'; new.submitted_by := coalesce(new.updated_by, old.submitted_by); new.submitted_at := now();
    if new.status = 'scheduled' then new.status := 'draft'; end if;
  end if;
  return new;
end $$;
comment on function public.wa225_post_guard() is 'wave225: refuses a schedule or publish of a post that is not approved unless the person is a publisher (wa225_publisher); an approved post edited by a non-publisher goes back to pending.';
create or replace trigger trg_wa225_post_guard before insert or update on public.content_posts for each row execute function public.wa225_post_guard();

-- approvals go through these, with the check inside
create or replace function public.studio_submit(p_id bigint, p_note text default null) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare me text := public.wa_email(); r public.content_posts;
begin
  if not public.is_wa_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  update public.content_posts set approval_status = 'pending', approval_note = nullif(trim(p_note), ''), submitted_by = me, submitted_at = now(),
    status = case when status in ('scheduled', 'failed') then 'draft' else status end, updated_at = now()
  where id = p_id and status not in ('published', 'posted', 'publishing') returning * into r;
  if r.id is null then raise exception 'not found or already out'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('content_post', p_id::text, 'approval', null, 'sent for approval', me);
  return to_jsonb(r);
end $$;
comment on function public.studio_submit(bigint, text) is 'wave225: send a post for approval (anyone on staff). Notifies the publishers through the trigger trg_wa225_approval_notify.';

create or replace function public.studio_decide(p_id bigint, p_decision text, p_note text default null) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare me text := public.wa_email(); r public.content_posts;
begin
  if not public.wa225_publisher() then raise exception 'only marketing leads and admins approve posts' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'changes') then raise exception 'approve or changes'; end if;
  update public.content_posts set
    approval_status = case when p_decision = 'approve' then 'approved' else 'changes' end,
    approval_note = nullif(trim(p_note), ''), approved_by = me, approved_at = now(),
    status = case when p_decision = 'approve' and scheduled_at is not null and status = 'draft' then 'scheduled' else status end,
    updated_at = now(), updated_by = me
  where id = p_id and approval_status = 'pending' returning * into r;
  if r.id is null then raise exception 'not waiting for approval'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('content_post', p_id::text, 'approval', 'pending', case when p_decision = 'approve' then 'approved' else 'changes asked' end || coalesce(': ' || left(p_note, 200), ''), me);
  return to_jsonb(r);
end $$;
comment on function public.studio_decide(bigint, text, text) is 'wave225: a publisher approves a pending post (it becomes scheduled when it has a date) or sends it back with a note.';

-- the people who hear about approvals: a Hub notification and a Slack DM through social-publish (action approval_notify)
create or replace function public.wa225_approval_notify() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if new.approval_status is distinct from old.approval_status and (new.approval_status = 'pending' or (old.approval_status = 'pending' and new.approval_status in ('approved', 'changes')))
     and coalesce((select value from public.app_config where key = 'studio_notify'), 'on') <> 'off' then
    perform public.call_edge('social-publish', jsonb_build_object('action', 'approval_notify', 'post_id', new.id, 'state', new.approval_status));
  end if;
  return new;
end $$;
comment on function public.wa225_approval_notify() is 'wave225: tells social-publish (approval_notify) when a post is sent for approval, approved or sent back; off with app_config studio_notify = off.';
create or replace trigger trg_wa225_approval_notify after update of approval_status on public.content_posts for each row execute function public.wa225_approval_notify();

-- ---------- the library ----------
create table if not exists public.content_tags (
  id bigserial primary key, name text not null unique, color text not null default '#6F64AB',
  created_by text, created_at timestamptz not null default now());
comment on table public.content_tags is 'wave225: the Content Studio''s tags (name and colour). Posts carry the names in content_posts.tags. Staff read; the marketing team and admins write.';

create table if not exists public.content_snippets (
  id bigserial primary key,
  kind text not null check (kind in ('hashtags', 'template', 'reply', 'caption')),
  name text not null, body text not null default '', data jsonb not null default '{}'::jsonb,
  uses integer not null default 0, created_by text, updated_by text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists content_snippets_kind_idx on public.content_snippets(kind);
comment on table public.content_snippets is 'wave225: the library: hashtag groups (body = the hashtags), post templates (data = platforms, caption, first comment, tags, variants), saved replies for the comments inbox, and caption snippets. Staff read; the marketing team and admins write.';

create table if not exists public.content_slots (
  id bigserial primary key,
  platform text not null check (platform in ('instagram', 'facebook', 'threads', 'linkedin', 'tiktok', 'youtube')),
  weekday smallint not null check (weekday between 0 and 6), at time not null,
  source text not null default 'manual' check (source in ('manual', 'suggested')),
  created_by text, created_at timestamptz not null default now(),
  unique (platform, weekday, at));
comment on table public.content_slots is 'wave225: the posting schedule per platform (weekday 0 = Monday, the time in Toronto). Add to queue fills the next free slot. Staff read; the marketing team and admins write.';

-- ---------- short links ----------
create table if not exists public.short_links (
  id bigserial primary key,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{3,40}$'),
  url text not null check (url ~ '^https?://'),
  label text, post_id bigint references public.content_posts(id) on delete set null, platform text, campaign text,
  clicks integer not null default 0, last_click_at timestamptz, active boolean not null default true,
  created_by text, created_at timestamptz not null default now());
create index if not exists short_links_post_idx on public.short_links(post_id);
comment on table public.short_links is 'wave225: hub.welfareavenue.com/l/<code> links (made for a post''s links when track_links is on, by hand in Links, and for the link-in-bio page). The go function redirects and counts. Staff read; the marketing team and admins write.';

create table if not exists public.short_link_clicks (
  id bigserial primary key, link_id bigint not null references public.short_links(id) on delete cascade,
  at timestamptz not null default now(), referrer_host text, device text, country text);
create index if not exists short_link_clicks_link_idx on public.short_link_clicks(link_id, at);
comment on table public.short_link_clicks is 'wave225: one row per click on a short link: when, the referring site''s host, phone or computer, the country when the host says it. No address, no cookie, nothing that names a person. Written only by the go function.';

-- the public link-in-bio page reads this (signed-out)
create or replace function public.studio_link_page() returns jsonb
language sql stable security definer set search_path to '' as $$
  select coalesce((select value from public.hub_settings where key = 'link_page'), '{}'::jsonb)
    || jsonb_build_object('links', coalesce((select jsonb_agg(jsonb_build_object('code', l.code, 'label', l.label) order by l.id)
         from public.short_links l where l.active and l.code like 'bio-%'), '[]'::jsonb));
$$;
comment on function public.studio_link_page() is 'wave225: what hub.welfareavenue.com/links shows: the settings in hub_settings link_page (title, bio, blocks, theme) and the active bio-* short links. Executable signed-out.';

-- ---------- the comments inbox ----------
create table if not exists public.social_comments (
  id bigserial primary key,
  platform text not null check (platform in ('instagram', 'facebook', 'threads', 'linkedin', 'tiktok', 'youtube')),
  external_id text not null, media_external_id text, parent_external_id text,
  social_post_id bigint references public.social_posts(id) on delete set null,
  content_post_id bigint references public.content_posts(id) on delete set null,
  author_name text, author_handle text, author_id text, text text, commented_at timestamptz, like_count integer,
  from_us boolean not null default false,
  status text not null default 'open' check (status in ('open', 'resolved', 'hidden', 'deleted')),
  hidden boolean not null default false, liked_by_us boolean not null default false,
  replied_at timestamptz, replied_by text, reply_text text, assigned_to text, permalink text,
  raw jsonb, fetched_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (platform, external_id));
create index if not exists social_comments_open_idx on public.social_comments(status, commented_at desc);
create index if not exists social_comments_media_idx on public.social_comments(platform, media_external_id);
create index if not exists social_comments_post_idx on public.social_comments(social_post_id);
create index if not exists social_comments_cpost_idx on public.social_comments(content_post_id);
comment on table public.social_comments is 'wave225: comments on Welfare Avenue''s own posts (Instagram, Facebook, Threads, YouTube; LinkedIn and TikTok when connected), filled every 10 minutes by social-inbox. Public comments, kept 24 months (the privacy notice). Read by the marketing team and admins; written only by social-inbox (reply, like, hide, delete, resolve go through it).';

-- ---------- settings ----------
insert into public.hub_settings (key, value, updated_at, updated_by)
values ('content_studio', jsonb_build_object(
  'goals', jsonb_build_object('instagram', 3, 'facebook', 3, 'threads', 0, 'linkedin', 1, 'tiktok', 1, 'youtube', 0),
  'hashtag_cap', 5, 'track_links', true, 'tz', 'America/Toronto', 'reminders', true), now(), 'wave225')
on conflict (key) do nothing;
insert into public.hub_settings (key, value, updated_at, updated_by)
values ('link_page', jsonb_build_object('title', 'Welfare Avenue', 'bio', 'Youth-powered meals and community in Montreal and Toronto.', 'theme', 'green', 'blocks', '[]'::jsonb), now(), 'wave225')
on conflict (key) do nothing;
insert into public.app_config (key, value, updated_at) values ('studio_notify', 'on', now()) on conflict (key) do nothing;

-- ---------- row security ----------
alter table public.content_tags enable row level security;
alter table public.content_snippets enable row level security;
alter table public.content_slots enable row level security;
alter table public.short_links enable row level security;
alter table public.short_link_clicks enable row level security;
alter table public.social_comments enable row level security;

create policy content_tags_read on public.content_tags for select to authenticated using (public.is_wa_staff());
create policy content_tags_write on public.content_tags for insert to authenticated with check (public.wa225_marketing());
create policy content_tags_edit on public.content_tags for update to authenticated using (public.wa225_marketing()) with check (public.wa225_marketing());
create policy content_tags_remove on public.content_tags for delete to authenticated using (public.wa225_marketing());
create policy content_snippets_read on public.content_snippets for select to authenticated using (public.is_wa_staff());
create policy content_snippets_write on public.content_snippets for insert to authenticated with check (public.wa225_marketing());
create policy content_snippets_edit on public.content_snippets for update to authenticated using (public.is_wa_staff()) with check (public.is_wa_staff());
create policy content_snippets_remove on public.content_snippets for delete to authenticated using (public.wa225_marketing());
create policy content_slots_read on public.content_slots for select to authenticated using (public.is_wa_staff());
create policy content_slots_write on public.content_slots for insert to authenticated with check (public.wa225_marketing());
create policy content_slots_remove on public.content_slots for delete to authenticated using (public.wa225_marketing());
create policy short_links_read on public.short_links for select to authenticated using (public.is_wa_staff());
create policy short_links_write on public.short_links for insert to authenticated with check (public.is_wa_staff());
create policy short_links_edit on public.short_links for update to authenticated using (public.wa225_marketing()) with check (public.wa225_marketing());
create policy short_link_clicks_read on public.short_link_clicks for select to authenticated using (public.is_wa_staff());
create policy social_comments_read on public.social_comments for select to authenticated using (public.wa225_marketing() or public.wa225_publisher());

grant select, insert, update, delete on public.content_tags, public.content_snippets to authenticated;
grant select, insert, delete on public.content_slots to authenticated;
grant select, insert, update on public.short_links to authenticated;
grant select on public.short_link_clicks, public.social_comments to authenticated;
grant usage, select on sequence public.content_tags_id_seq, public.content_snippets_id_seq, public.content_slots_id_seq, public.short_links_id_seq to authenticated;
grant execute on function public.studio_link_page() to anon, authenticated;
grant execute on function public.studio_submit(bigint, text), public.studio_decide(bigint, text, text), public.wa225_marketing(), public.wa225_publisher() to authenticated;
