-- wave149: the loading screen. Steel (27/09/26): "On the loading page: I want you to put learnings, lessons, and milestones
-- along with shoutouts ... And refresh it every week. Also at the bottom ... a news banner of events that happened recently,
-- updates that the organization should know about."
-- hub_reel holds the week's lines (lessons, learnings, milestones: batch = the Monday, rebuilt once a week), the news
-- banner (news: batch = the day, rebuilt every morning) and the admins' own updates for the banner (update: no batch, shown
-- until a day). Written by the hub-reel edge function (service role) and the admin functions below; read through
-- hub_reel_current() (everyone on the Hub) and hub_reel_admin() (admins). No direct table access.
create table if not exists public.hub_reel (
  id bigserial primary key,
  batch date,
  kind text not null check (kind in ('lesson', 'learning', 'milestone', 'news', 'update')),
  text text not null check (char_length(text) between 3 and 220),
  link text,
  source text,
  source_key text,
  sort int not null default 0,
  hidden boolean not null default false,
  hidden_by text,
  hidden_at timestamptz,
  until date,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists hub_reel_kind_batch on public.hub_reel (kind, batch desc);
alter table public.hub_reel enable row level security;
revoke all on public.hub_reel from anon, authenticated;
revoke all on sequence public.hub_reel_id_seq from anon, authenticated;

comment on table public.hub_reel is 'The loading screen (wave149). kind lesson, learning, milestone: the week''s lines (batch = Monday, Toronto time; rebuilt once a week by hub-reel from wa_lessons, form_summaries, social_notes, search_top, wa_history and goal_wins, phrased by the model). kind news: the news banner along the bottom (batch = the day; rebuilt every morning from servings, fundraising events, new starters and wins). kind update: an admin''s own line for the news banner, shown until the day in until. hidden: taken off the loading screen by an admin (Admin, Loading screen). Shout-outs stay in hub_shoutouts. Read through hub_reel_current() and hub_reel_admin(); nothing about leadership changes, roles or departures is written here (hub-reel filters every line).';
comment on column public.hub_reel.batch is 'The Monday of the week (lesson, learning, milestone) or the day (news), Toronto time; null for an update.';
comment on column public.hub_reel.source_key is 'Where the line came from, e.g. lesson:<wa_lessons.key>, history:<wa_history.key>, win:<goal_wins.id>, event:<volunteer_events.id>; used so a lesson or milestone does not come back for eight weeks.';
comment on column public.hub_reel.until is 'An update shows on the news banner until the end of this day.';

/* what the loading screen shows: this week's lines and today's news (updates first) */
create or replace function public.hub_reel_current() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_week date; v_day date; v_lines jsonb; v_news jsonb;
begin
  if not (public.is_wa_staff() or public.is_board_viewer() or public.is_hub_admin()) then
    raise exception 'not allowed';
  end if;
  select max(batch) into v_week from public.hub_reel where kind in ('lesson', 'learning', 'milestone') and batch <= v_today;
  select max(batch) into v_day from public.hub_reel where kind = 'news' and batch <= v_today;
  select coalesce(jsonb_agg(jsonb_build_object('k', r.kind, 't', r.text) order by r.sort, r.id), '[]'::jsonb) into v_lines
    from public.hub_reel r where r.kind in ('lesson', 'learning', 'milestone') and r.batch = v_week and not r.hidden;
  select coalesce(jsonb_agg(jsonb_build_object('t', x.text, 'link', x.link) order by x.o, x.sort, x.id), '[]'::jsonb) into v_news from (
    select 0 as o, u.sort, u.id, u.text, u.link from public.hub_reel u where u.kind = 'update' and not u.hidden and (u.until is null or u.until >= v_today)
    union all
    select 1, n.sort, n.id, n.text, n.link from public.hub_reel n where n.kind = 'news' and n.batch = v_day and not n.hidden
  ) x;
  return jsonb_build_object('week', v_week, 'day', v_day, 'lines', v_lines, 'news', v_news);
end $$;

/* the admin view: every line of the week and today's news with its id and whether it is hidden, and the updates */
create or replace function public.hub_reel_admin() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_week date; v_day date;
begin
  if not public.is_hub_admin() then raise exception 'admins only'; end if;
  select max(batch) into v_week from public.hub_reel where kind in ('lesson', 'learning', 'milestone') and batch <= v_today;
  select max(batch) into v_day from public.hub_reel where kind = 'news' and batch <= v_today;
  return jsonb_build_object(
    'week', v_week, 'day', v_day, 'today', v_today,
    'built_at', (select max(created_at) from public.hub_reel where kind in ('lesson', 'learning', 'milestone') and batch = v_week),
    'news_at', (select max(created_at) from public.hub_reel where kind = 'news' and batch = v_day),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'text', r.text, 'source', r.source, 'hidden', r.hidden, 'hidden_by', r.hidden_by) order by r.kind, r.sort, r.id)
      from public.hub_reel r where r.kind in ('lesson', 'learning', 'milestone') and r.batch = v_week), '[]'::jsonb),
    'news', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'text', n.text, 'link', n.link, 'source', n.source, 'hidden', n.hidden, 'hidden_by', n.hidden_by) order by n.sort, n.id)
      from public.hub_reel n where n.kind = 'news' and n.batch = v_day), '[]'::jsonb),
    'updates', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'text', u.text, 'link', u.link, 'until', u.until, 'hidden', u.hidden, 'by', u.created_by, 'at', u.created_at, 'live', (not u.hidden and (u.until is null or u.until >= v_today))) order by u.created_at desc)
      from (select * from public.hub_reel where kind = 'update' and (until is null or until >= v_today - 30) order by created_at desc limit 30) u), '[]'::jsonb));
end $$;

/* take a line off the loading screen, or put it back (admins) */
create or replace function public.hub_reel_hide(p_id bigint, p_hidden boolean default true) returns void
language plpgsql volatile security definer set search_path to '' as $$
declare v_text text;
begin
  if not public.is_hub_admin() then raise exception 'admins only'; end if;
  update public.hub_reel set hidden = coalesce(p_hidden, true), hidden_by = case when coalesce(p_hidden, true) then public.wa_email() else null end,
         hidden_at = case when coalesce(p_hidden, true) then now() else null end
   where id = p_id returning text into v_text;
  if v_text is null then raise exception 'no such line'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('hub_reel', p_id::text, case when coalesce(p_hidden, true) then 'hidden' else 'shown' end, null, left(v_text, 200), public.wa_email());
end $$;

/* an admin's own line for the news banner: under 140 characters, a Hub page (#...) or a web address as the link, shown
   until a day (two weeks by default, three months at most) */
create or replace function public.hub_news_add(p_text text, p_link text default null, p_until date default null) returns bigint
language plpgsql volatile security definer set search_path to '' as $$
declare
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_text text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_until date := coalesce(p_until, v_today + 14);
  v_id bigint;
begin
  if not public.is_hub_admin() then raise exception 'admins only'; end if;
  if char_length(v_text) < 3 then raise exception 'Write the update first'; end if;
  if char_length(v_text) > 140 then raise exception 'Keep it under 140 characters'; end if;
  if v_link is not null and not (v_link ~ '^#[A-Za-z0-9/_-]{1,120}$' or v_link ~* '^https://[^\s<>"]{3,400}$') then v_link := null; end if;
  if v_until < v_today then v_until := v_today; end if;
  if v_until > v_today + 90 then v_until := v_today + 90; end if;
  insert into public.hub_reel (kind, text, link, until, source, created_by) values ('update', v_text, v_link, v_until, 'admin', public.wa_email()) returning id into v_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('hub_reel', v_id::text, 'update posted', null, left(v_text, 200), public.wa_email());
  return v_id;
end $$;

revoke all on function public.hub_reel_current() from public, anon;
revoke all on function public.hub_reel_admin() from public, anon;
revoke all on function public.hub_reel_hide(bigint, boolean) from public, anon;
revoke all on function public.hub_news_add(text, text, date) from public, anon;
grant execute on function public.hub_reel_current() to authenticated;
grant execute on function public.hub_reel_admin() to authenticated;
grant execute on function public.hub_reel_hide(bigint, boolean) to authenticated;
grant execute on function public.hub_news_add(text, text, date) to authenticated;
comment on function public.hub_reel_current() is 'The loading screen (wave149): this week''s lessons, learnings and milestones and today''s news banner (live updates first), without hidden lines. Everyone on the Hub (staff, the board, admins).';
comment on function public.hub_reel_admin() is 'Admin, Loading screen (wave149): the week''s lines and today''s news with ids and hidden flags, and the admins'' updates of the last 30 days. Admins only.';
comment on function public.hub_reel_hide(bigint, boolean) is 'Takes a loading screen line or news item off (p_hidden true) or puts it back. Admins only; logged in change_log.';
comment on function public.hub_news_add(text, text, date) is 'Adds an admin''s update to the news banner on the loading screen (under 140 characters; link a Hub page #... or an https address; shown until p_until, two weeks by default, 90 days at most). Admins only; logged in change_log.';

notify pgrst, 'reload schema';
