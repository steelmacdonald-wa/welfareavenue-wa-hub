-- wave262c (20/10/26): hashtag watch for the Content Studio.
-- Kahkashan, 19/10/26 leadership meeting: "one place where we can ... monitor the hashtags, so we can put out a fire before it
-- becomes a wildfire" (the OneBagChallenge). Instagram's hashtag search (ig_hashtag_search, recent_media, top_media) works with
-- the Hub's existing Meta token (checked 20/10/26). Facebook and TikTok have no hashtag search in their APIs.

create table if not exists public.social_hashtag_watch (
  id bigserial primary key,
  tag text not null unique check (tag ~ '^[a-z0-9_]{2,60}$'),
  ig_hashtag_id text,
  active boolean not null default true,
  added_by text,
  added_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_error text
);
comment on table public.social_hashtag_watch is 'wave262c: the Instagram hashtags the Content Studio watches (Hashtags section). tag is lower case without the #; ig_hashtag_id is Instagram''s id, cached by hashtag-watch (Instagram allows 30 different hashtags a week). Written through wa262_hashtag_set (the marketing team and admins); read by the marketing team and admins (wa225_marketing).';

create table if not exists public.social_hashtag_posts (
  id bigserial primary key,
  tag text not null references public.social_hashtag_watch(tag) on update cascade on delete cascade,
  media_id text not null,
  permalink text,
  media_type text,
  caption text,
  posted_at timestamptz,
  like_count integer,
  comments_count integer,
  source text check (source in ('recent', 'top')),
  first_seen_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'ok', 'flagged', 'reported')),
  reviewed_by text,
  reviewed_at timestamptz,
  note text,
  unique (tag, media_id)
);
create index if not exists social_hashtag_posts_tag_idx on public.social_hashtag_posts (tag, posted_at desc);
create index if not exists social_hashtag_posts_status_idx on public.social_hashtag_posts (status);
comment on table public.social_hashtag_posts is 'wave262c: public Instagram posts found under a watched hashtag (hashtag-watch, every 30 minutes). status: new (nobody looked yet), ok (looks fine), flagged (needs attention), reported (asked Instagram to take it down or contacted the poster). The review goes through wa262_hashtag_review; read by the marketing team and admins.';
comment on column public.social_hashtag_posts.source is 'recent: Instagram''s recent_media (public posts of the last 24 hours); top: top_media (the most popular).';

alter table public.social_hashtag_watch enable row level security;
alter table public.social_hashtag_posts enable row level security;
drop policy if exists social_hashtag_watch_read on public.social_hashtag_watch;
create policy social_hashtag_watch_read on public.social_hashtag_watch for select to authenticated using (public.wa225_marketing());
drop policy if exists social_hashtag_posts_read on public.social_hashtag_posts;
create policy social_hashtag_posts_read on public.social_hashtag_posts for select to authenticated using (public.wa225_marketing());
revoke all on public.social_hashtag_watch, public.social_hashtag_posts from anon;
revoke insert, update, delete on public.social_hashtag_watch, public.social_hashtag_posts from authenticated;
grant select on public.social_hashtag_watch, public.social_hashtag_posts to authenticated;

create or replace function public.wa262_hashtag_set(p_tag text, p_active boolean)
 returns jsonb language plpgsql security definer set search_path to ''
as $f$
declare v_tag text; v_n int;
begin
  if not public.wa225_marketing() then raise exception 'the marketing team and admins only'; end if;
  v_tag := lower(regexp_replace(coalesce(p_tag, ''), '[^A-Za-z0-9_]', '', 'g'));
  if v_tag !~ '^[a-z0-9_]{2,60}$' then raise exception 'a hashtag is 2 to 60 letters, numbers or _'; end if;
  if p_active then
    select count(*) into v_n from public.social_hashtag_watch where active and tag <> v_tag;
    if v_n >= 10 then raise exception 'ten hashtags at most (Instagram allows 30 different ones a week)'; end if;
  end if;
  insert into public.social_hashtag_watch (tag, active, added_by) values (v_tag, p_active, public.wa_email())
  on conflict (tag) do update set active = excluded.active;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('social_hashtag', v_tag, 'active', null, p_active::text, public.wa_email());
  return jsonb_build_object('tag', v_tag, 'active', p_active);
end $f$;
comment on function public.wa262_hashtag_set(text, boolean) is 'wave262c: watch (true) or stop watching (false) an Instagram hashtag in the Content Studio. The marketing team and admins (wa225_marketing, checked inside); ten active at most. Access: authenticated.';

create or replace function public.wa262_hashtag_review(p_id bigint, p_status text, p_note text default null)
 returns jsonb language plpgsql security definer set search_path to ''
as $f$
declare v_old text;
begin
  if not public.wa225_marketing() then raise exception 'the marketing team and admins only'; end if;
  if p_status not in ('new', 'ok', 'flagged', 'reported') then raise exception 'unknown status'; end if;
  select status into v_old from public.social_hashtag_posts where id = p_id;
  if v_old is null then raise exception 'post not found'; end if;
  update public.social_hashtag_posts set status = p_status, reviewed_by = public.wa_email(), reviewed_at = now(),
         note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note) where id = p_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('social_hashtag_post', p_id::text, 'status', v_old, p_status, public.wa_email());
  return jsonb_build_object('id', p_id, 'status', p_status);
end $f$;
comment on function public.wa262_hashtag_review(bigint, text, text) is 'wave262c: the marketing team marks a hashtag post looked at (ok), needing attention (flagged) or reported, with an optional note; a change_log line each. Checked inside (wa225_marketing). Access: authenticated.';

revoke execute on function public.wa262_hashtag_set(text, boolean) from public, anon, authenticated;
grant execute on function public.wa262_hashtag_set(text, boolean) to authenticated;
revoke execute on function public.wa262_hashtag_review(bigint, text, text) from public, anon, authenticated;
grant execute on function public.wa262_hashtag_review(bigint, text, text) to authenticated;

insert into public.social_hashtag_watch (tag, active, added_by) values ('onebagchallenge', true, 'steel.macdonald@welfareavenue.com')
on conflict (tag) do nothing;

select cron.schedule('wa-hashtag-watch', '7,37 * * * *', $c$select public.call_edge('hashtag-watch', '{"action":"sync"}'::jsonb)$c$);
