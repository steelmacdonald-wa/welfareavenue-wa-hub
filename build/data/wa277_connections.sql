-- =====================================================================
-- wave277 (02/11/26): the platform registry, one table instead of six hard-coded lists
-- =====================================================================
-- Steel, 02/11/26: the Content Studio kept its platform list in many places (labels and colours in the Hub, the connect
-- steps and console links in the Connections page, scopes and caps in the edge functions). This puts them in one table.
-- 1. public.studio_platforms: key, label, short, colour, sort, auth, console link and note, connect steps, caps, scopes,
--    modes, active. Seeded with the six platforms from today's values. Staff read it; admins write it.
-- 2. public.wa277_platforms(): the whole registry in one call for the Hub (staff and the service role).
-- 3. public.wa277_publishers(): who may publish, the set wa225_publisher() allows (admins, marketing leaders, approvers); service role only.
-- 4. content_slots.platform and social_comments.platform now reference studio_platforms(key) instead of a CHECK list.
--    Each is guarded: if a row holds a platform outside the six keys the CHECK stays and a notice is raised.
--    social_accounts.platform keeps its CHECK (it also allows ga4 for analytics accounts, which is not a publishing platform).
-- Idempotent: safe to run again; the seed never overwrites admin edits (on conflict do nothing). No row deleted.
-- =====================================================================

create table if not exists public.studio_platforms (
  key text primary key,
  label text not null,
  short text not null,
  colour text not null,
  sort int not null default 0,
  auth text not null check (auth in ('oauth', 'meta_token')),
  console_url text,
  console_note text,
  steps jsonb not null default '[]'::jsonb,
  caps jsonb not null default '{}'::jsonb,
  scopes text[] not null default '{}'::text[],
  modes jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.studio_platforms is 'wave277: the Content Studio platform registry (labels, colours, connect steps, caps, scopes, posting modes). Staff read; admins write.';

alter table public.studio_platforms enable row level security;
drop policy if exists studio_platforms_read on public.studio_platforms;
create policy studio_platforms_read on public.studio_platforms for select to authenticated using (public.is_wa_staff());
drop policy if exists studio_platforms_admin on public.studio_platforms;
create policy studio_platforms_admin on public.studio_platforms for all to authenticated
  using (exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role = 'admin'))
  with check (exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role = 'admin'));
grant select on public.studio_platforms to authenticated;
grant insert, update, delete on public.studio_platforms to authenticated;

insert into public.studio_platforms (key, label, short, colour, sort, auth, console_url, console_note, steps, caps, scopes, modes, active, updated_at) values
('instagram', 'Instagram', 'IG', '#C13584', 1, 'meta_token', null, null, '[]'::jsonb,
  '{"text":true,"images":true,"max_images":10,"video":true,"max_video_s":900,"comments":true,"analytics":true,"link_in_caption":false}'::jsonb,
  '{}'::text[],
  '{"direct":"Posts directly","reminder":"Reminder to post by hand"}'::jsonb, true, now()),
('facebook', 'Facebook', 'f', '#1877F2', 2, 'meta_token', null, null, '[]'::jsonb,
  '{"text":true,"images":true,"max_images":10,"video":true,"max_video_s":90,"comments":true,"analytics":true,"link_in_caption":true}'::jsonb,
  '{}'::text[],
  '{"direct":"Posts directly","reminder":"Reminder to post by hand"}'::jsonb, true, now()),
('threads', 'Threads', '@', '#1F201E', 3, 'oauth',
  'https://developers.facebook.com/apps/',
  'Meta for Developers: the Welfare Avenue Threads app, Use cases, Access the Threads API, Settings',
  '["Steel adds the Welfare Avenue Threads account as a Threads tester in the app and accepts the invite in Threads (Settings, Account, Website permissions).","Copy the Threads app ID and app secret below and save them.","Press Connect and sign in to Threads as @welfareavenue."]'::jsonb,
  '{"text":true,"images":true,"max_images":20,"video":true,"max_video_s":300,"comments":true,"analytics":true,"link_in_caption":true}'::jsonb,
  array['threads_basic','threads_content_publish','threads_manage_replies','threads_read_replies','threads_manage_insights','threads_manage_mentions','threads_delete'],
  '{"direct":"Posts directly","reminder":"Reminder to post by hand"}'::jsonb, true, now()),
('linkedin', 'LinkedIn', 'in', '#0A66C2', 4, 'oauth',
  'https://www.linkedin.com/developers/apps',
  'LinkedIn Developers: My apps, the Welfare Avenue app, Auth',
  '["Copy the client ID and secret from the LinkedIn app''s Auth tab and save them below.","Press Connect and sign in as an admin of the Welfare Avenue Page."]'::jsonb,
  '{"text":true,"images":true,"max_images":20,"video":true,"max_video_s":600,"comments":true,"analytics":true,"link_in_caption":true}'::jsonb,
  array['w_organization_social','r_organization_social','rw_organization_admin','r_organization_social_feed','w_organization_social_feed','r_organization_followers'],
  '{"direct":"Posts directly","make":"Posts through Make","reminder":"Reminder to post by hand"}'::jsonb, true, now()),
('tiktok', 'TikTok', 'Tk', '#EE1D52', 5, 'oauth',
  'https://developers.tiktok.com/apps/',
  'TikTok for Developers: Manage apps, the Welfare Avenue app, Basic information',
  '["The TikTok app has Login Kit and Content Posting API with video.upload, and the redirect address below.","Copy the client key and client secret below and save them.","Press Connect and sign in to TikTok as Welfare Avenue. Videos then land in the TikTok drafts to finish in the app."]'::jsonb,
  '{"text":true,"images":false,"max_images":0,"video":true,"max_video_s":600,"comments":false,"analytics":true,"link_in_caption":false}'::jsonb,
  array['user.info.basic','user.info.profile','user.info.stats','video.list','video.upload'],
  '{"drafts":"Lands in TikTok drafts","reminder":"Reminder to post by hand"}'::jsonb, true, now()),
('youtube', 'YouTube', chr(9654), '#FF0000', 6, 'oauth',
  'https://console.cloud.google.com/apis/credentials',
  'Google Cloud: APIs and services, Credentials, the Web client',
  '["In Google Cloud, the OAuth client lists the redirect address below and the YouTube Data API v3 is on.","Copy the client ID and client secret below and save them.","Press Connect and pick the Welfare Avenue channel (the brand account)."]'::jsonb,
  '{"text":true,"images":false,"max_images":0,"video":true,"max_video_s":180,"comments":false,"analytics":false,"link_in_caption":true}'::jsonb,
  array['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/youtube.force-ssl'],
  '{"direct":"Posts directly","reminder":"Reminder to post by hand"}'::jsonb, true, now())
on conflict (key) do nothing;

-- wave277 caps fix: every platform carries all eight caps keys (the seed itself never overwrites)
update public.studio_platforms set caps = '{"text":true,"images":true,"max_images":20,"video":true,"max_video_s":300,"comments":true,"analytics":true,"link_in_caption":true}'::jsonb, updated_at = now() where key = 'threads';
update public.studio_platforms set caps = '{"text":true,"images":false,"max_images":0,"video":true,"max_video_s":600,"comments":false,"analytics":true,"link_in_caption":false}'::jsonb, updated_at = now() where key = 'tiktok';
update public.studio_platforms set caps = '{"text":true,"images":false,"max_images":0,"video":true,"max_video_s":180,"comments":false,"analytics":false,"link_in_caption":true}'::jsonb, updated_at = now() where key = 'youtube';

-- the whole registry in one call for the Hub (staff only; the service role too, for the edge functions)
create or replace function public.wa277_platforms()
returns setof public.studio_platforms language sql stable security definer set search_path to '' as $$
  select p.* from public.studio_platforms p where (public.is_wa_staff() or coalesce(auth.role(), '') = 'service_role') order by p.sort, p.key;
$$;
revoke all on function public.wa277_platforms() from public, anon;
grant execute on function public.wa277_platforms() to authenticated, service_role;

-- who may publish (final review, wa277_publishers_v2): the same set wa225_publisher() answers true for, over every person:
-- admins, leaders on the marketing team (profile marketing or an active marketing team_members row), and the approvers
-- (wa241_approvers); distinct, lower-cased, welfareavenue.com only. Only the edge functions (service role) call it.
create or replace function public.wa277_publishers()
returns text[] language sql stable security definer set search_path to '' as $$
  select coalesce(array_agg(distinct u.e order by u.e), '{}'::text[]) from (
    select lower(btrim(r.email)) as e from public.hub_roles r where r.role = 'admin'
    union
    select lower(btrim(r.email)) from public.hub_roles r
     where r.role = 'leader'
       and (r.profile = 'marketing'
            or exists (select 1 from public.team_members t where lower(t.email) = lower(r.email) and t.active and t.department = 'marketing'))
    union
    select lower(btrim(x)) from unnest(public.wa241_approvers()) x
  ) u where u.e ~ '@welfareavenue\.com$';
$$;
revoke execute on function public.wa277_publishers() from public, anon, authenticated;
grant execute on function public.wa277_publishers() to service_role;

-- content_slots and social_comments: platform references the registry instead of a CHECK list
do $do$
declare t text; cn text; nbad bigint;
begin
  foreach t in array array['content_slots', 'social_comments'] loop
    cn := t || '_platform_fk';
    if exists (select 1 from pg_constraint where conrelid = ('public.' || t)::regclass and conname = cn) then
      continue;
    end if;
    execute format('select count(*) from public.%I where platform is null or platform not in (select key from public.studio_platforms)', t) into nbad;
    if nbad > 0 then
      raise notice 'wave277: % has % row(s) with a platform outside the registry; its CHECK is kept', t, nbad;
    else
      execute format('alter table public.%I add constraint %I foreign key (platform) references public.studio_platforms(key)', t, cn);
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_platform_check');
    end if;
  end loop;
end
$do$;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'wave', 'wave277', 'release', null, 'studio_platforms registry', 'wave277'
where not exists (select 1 from public.change_log where entity_type = 'wave' and entity_id = 'wave277' and field = 'release');

-- release copy (applied at release)
update public.trainings set body = replace(body::text, 'the named approvers (Ian and KK)', 'the approvers set on the Approvals page')::jsonb where key = 'lesson:studio';
update public.trainings set body = replace(body::text, 'how it goes to Ian and KK for approval', 'how it goes to the approvers')::jsonb where key = 'lesson:studio';
