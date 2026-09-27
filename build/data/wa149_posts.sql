-- wave149: Instagram and Facebook post photos on the Analytics page. Steel (27/09/26): "the photos from instagram posts
-- don't show up". They never could: the Hub's content security policy only lets the page load images from the Hub and its
-- Supabase project, and Meta's photo links (cdninstagram.com, fbcdn.net) also expire after a few days. social-pull v1.7
-- now keeps a copy of each post's photo in Hub storage (content-images/social/<platform>/<id>.<ext>) and the Analytics
-- functions hand the page that copy.
alter table public.social_posts
  add column if not exists thumb_cached text,
  add column if not exists thumb_cached_at timestamptz,
  add column if not exists thumb_error text;
comment on column public.social_posts.thumb_url is 'The platform''s own photo link for the post (Meta links expire after a few days and are refreshed by each sync); the page never loads it: see thumb_cached.';
comment on column public.social_posts.thumb_cached is 'The Hub''s copy of the post''s photo in storage (content-images/social/<platform>/<external_id>.<ext>), written by social-pull (v1.7, wave149); what the Analytics page shows.';
comment on column public.social_posts.thumb_cached_at is 'When social-pull last tried to copy the photo (success or not); a failed copy is retried after three days.';
comment on column public.social_posts.thumb_error is 'Why the last copy failed (the photo link had expired and Meta gave no new one, not an image, too large), or null.';

/* the Analytics functions hand the page the Hub's copy as thumb_url (the page code stays the same) */
do $$
declare d text;
begin
  d := pg_get_functiondef('public.social_range(date,date)'::regprocedure);
  if position('thumb_cached as thumb_url' in d) = 0 then
    d := replace(d, ', thumb_url, published_at', ', thumb_cached as thumb_url, published_at');
    execute d;
  end if;
  d := pg_get_functiondef('public.social_overview(integer)'::regprocedure);
  if position('thumb_cached as thumb_url' in d) = 0 then
    d := replace(d, ', thumb_url, published_at', ', thumb_cached as thumb_url, published_at');
    execute d;
  end if;
end $$;

notify pgrst, 'reload schema';
