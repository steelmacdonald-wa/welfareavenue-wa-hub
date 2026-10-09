-- wave227 (09/10/26): the weekly introduction. Steel: "once every week someone gets a pop-up window when they open up the
-- hub to introduce them to someone that they may have not interacted with that's at Welfare Avenue that might be worth
-- ... introducing themselves to because of potential work or projects that they can work on together".
-- His choices: the team plus the board; the Hub picks the person and writes why; Say hi on Slack, Book a 15-minute
-- coffee chat and Tell the other person too, all as options on the pop-up.

create table public.hub_intros (
  id bigint generated always as identity primary key,
  week date not null,
  member_id bigint not null references public.team_members(id) on delete cascade,
  other_id bigint not null references public.team_members(id) on delete cascade,
  source text not null default 'weekly' check (source in ('weekly', 'shared')),
  from_intro bigint references public.hub_intros(id) on delete set null,
  note text,
  hello text,
  note_back text,
  hello_back text,
  signals jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'seen', 'later', 'acted')),
  actions text[] not null default '{}',
  seen_at timestamptz,
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (week, member_id, other_id, source)
);
create index hub_intros_member_idx on public.hub_intros (member_id, week);
create index hub_intros_other_idx on public.hub_intros (other_id);
create index hub_intros_from_idx on public.hub_intros (from_intro);
comment on table public.hub_intros is 'wave227: the weekly introduction. One row per person a week (source weekly: the Hub picked other_id, someone they have not worked with, and wrote note and hello for them; note_back and hello_back are the same introduction seen from the other side), plus source shared when someone pressed Tell <name> too (from_intro). Written by the intros edge function and wa227_intro_act; read by the person through wa227_my_intro, admins read all.';
comment on column public.hub_intros.week is 'The Monday (Toronto) of the week the introduction belongs to.';
comment on column public.hub_intros.member_id is 'team_members.id of the person who sees the introduction.';
comment on column public.hub_intros.other_id is 'team_members.id of the person they are introduced to.';
comment on column public.hub_intros.note is 'Why they might connect, written by the Hub for member_id (their language), from open profile facts only.';
comment on column public.hub_intros.hello is 'A friendly first line member_id can paste into Slack.';
comment on column public.hub_intros.note_back is 'The same introduction written for other_id; becomes the note of the shared row when member_id presses Tell <name> too.';
comment on column public.hub_intros.signals is 'What the match used: shared goals, projects, words, teams, the score. Never confidential meetings.';
comment on column public.hub_intros.status is 'new (not shown yet), seen (shown), later (Maybe later: not again this week), acted (they said hi, booked a chat or told the other person).';
comment on column public.hub_intros.actions is 'What they did: slack, coffee, shared, profile.';

alter table public.hub_intros enable row level security;
create policy hub_intros_admin_read on public.hub_intros for select to authenticated using (public.is_wa_admin());
grant select on public.hub_intros to authenticated;

-- who the signed-in person is on the roster (the team email, or a board member's other address)
create or replace function public.wa227_my_member() returns bigint
language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select m.id from public.team_members m where lower(m.email) = public.wa_email() and public.wa_email() <> '' and m.active is not false order by m.id limit 1),
    (select m.id from public.board_members b join public.team_members m
        on lower(split_part(btrim(m.name), ' ', 1)) = lower(split_part(btrim(b.name), ' ', 1)) and m.department = 'board' and m.active is not false
      where public.wa_email() <> '' and public.wa_email() = any(select lower(x) from unnest(coalesce(b.emails, '{}')) x)
      order by m.id limit 1))
$$;
comment on function public.wa227_my_member() is 'wave227: the roster id (team_members) of the signed-in person: their team email, or for a director the board_members address they sign in with.';

-- the people the weekly introduction runs for: the active team and the board on the roster
create or replace function public.wa227_people() returns table (id bigint, name text, first text, department text, role text, email text, lang text)
language sql stable security definer set search_path to '' as $$
  select m.id, btrim(m.name), lower(split_part(btrim(m.name), ' ', 1)), m.department, m.role,
         coalesce(m.email, (select b.emails[1] from public.board_members b where lower(split_part(btrim(b.name), ' ', 1)) = lower(split_part(btrim(m.name), ' ', 1)) and b.status = 'active' limit 1)),
         coalesce((select p.lang from public.hub_user_prefs p where lower(p.email) = lower(m.email)), 'en')
    from public.team_members m
   where m.active is not false and coalesce(btrim(m.name), '') <> ''
     and (m.email is not null or (m.department = 'board' and exists (select 1 from public.board_members b where lower(split_part(btrim(b.name), ' ', 1)) = lower(split_part(btrim(m.name), ' ', 1)) and b.status = 'active' and cardinality(b.emails) > 0)))
$$;
comment on function public.wa227_people() is 'wave227: who the weekly introduction runs for: active team members with an address, directors included (their board address when the roster has none).';

-- how much two people already work together (0 = never crossed paths in the Hub)
create or replace function public.wa227_together(a bigint, b bigint) returns int
language sql stable security definer set search_path to '' as $$
  with pa as (select * from public.wa227_people() where id = a), pb as (select * from public.wa227_people() where id = b)
  select
    (case when (select department from pa) = (select department from pb) then 5 else 0 end)
  + (case when ((select department from pa) = 'exec' and (select department from pb) = 'board') or ((select department from pa) = 'board' and (select department from pb) = 'exec') then 5 else 0 end)
  + (select count(*)::int from public.task_assignees x join public.task_assignees y on y.task_id = x.task_id where x.member_id = a and y.member_id = b)
  + (select count(*)::int from public.transcripts t where t.meeting_date > current_date - 180 and t.speakers is not null
       and exists (select 1 from unnest(t.speakers) s where lower(split_part(btrim(s), ' ', 1)) = (select first from pa))
       and exists (select 1 from unnest(t.speakers) s where lower(split_part(btrim(s), ' ', 1)) = (select first from pb)))
  + (select count(*)::int * 5 from public.org_positions x join public.org_positions y on (y.id = x.reports_to or x.id = y.reports_to) where x.member_id = a and y.member_id = b)
  + (select count(*)::int * 10 from public.hub_intros i where i.week > current_date - 84 and ((i.member_id = a and i.other_id = b) or (i.member_id = b and i.other_id = a)))
$$;
comment on function public.wa227_together(bigint, bigint) is 'wave227: how much two roster members already work together: same team (5), the executive team and the board (5, they meet at board meetings), shared tasks, meetings both spoke in (last 180 days), a reporting line (5), an introduction in the last 12 weeks (10). Read by wa227_intro_plan only.';

-- what one person is about, from open facts only (role, team, responsibilities, profile line, projects led, organizational goals owned)
create or replace function public.wa227_profile(p bigint) returns jsonb
language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'id', m.id, 'name', btrim(m.name), 'role', m.role,
    'team', coalesce((select d.label from public.dept_meta d where d.department = m.department), case m.department when 'exec' then 'Executive team' else m.department end),
    'department', m.department,
    'city', case when m.department = 'opsto' then 'Toronto' when m.department = 'board' then null else 'Montreal' end,
    'responsibilities', (select jsonb_agg(r) from (select r from jsonb_array_elements_text(case when jsonb_typeof(m.responsibilities) = 'array' then m.responsibilities else '[]'::jsonb end) r limit 6) z),
    'about', left(coalesce(m.ai_bio, ''), 400),
    'projects_led', (select jsonb_agg(pr.name) from (select pr.name from public.projects pr
        where pr.banked_at is null and coalesce(pr.status, '') not in ('done', 'archived')
          and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(pr.leads) = 'array' then pr.leads else '[]'::jsonb end) l where lower(split_part(btrim(l), ' ', 1)) = lower(split_part(btrim(m.name), ' ', 1)))
        order by pr.id limit 5) pr),
    'goals_owned', (select jsonb_agg(g.title) from public.goal_owners o join public.goals g on g.id = o.goal_id where o.member_id = m.id and o.removed_at is null and g.retired_at is null))
  from public.team_members m where m.id = p
$$;
comment on function public.wa227_profile(bigint) is 'wave227: one person for the weekly introduction, from open facts only: role, team, city, responsibilities, the profile line, open projects they lead, organizational goals they own. No meetings, tasks or anything confidential.';

-- the week's pairs: everyone gets one person they have not worked with, chosen for what they could do together
create or replace function public.wa227_intro_plan(p_week date) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  me record; best record; v_out jsonb := '[]'::jsonb; v_picked jsonb := '{}'::jsonb;
  v_stop text[] := array['the','and','for','with','their','they','from','this','that','team','welfare','avenue','montreal','toronto','work','works','into','about','across','other','member','members','support','supports','including','events','event','currently','recently','keeps','while','through','ensures','ensuring','manages','managing','leads','leading','coordinates','coordinating','oversees','serves','builds','building','check','review','reviews','follow','smoothly','helps','handles','works','runs'];
begin
  for me in select * from public.wa227_people() order by random() loop
    if exists (select 1 from public.hub_intros i where i.week = p_week and i.member_id = me.id and i.source = 'weekly') then continue; end if;
    select o.id, o.name,
           s.together, s.goals, s.projects, s.words,
           (case when s.together = 0 then 10 else 0 end) - s.together
           + 3 * cardinality(s.goals) + 2 * cardinality(s.projects) + least(cardinality(s.words), 4)
           + case when (me.department = 'board') <> (o.department = 'board') then 1 else 0 end
           - 2 * coalesce((v_picked ->> o.id::text)::int, 0)
           + random() as score
      into best
      from public.wa227_people() o
      cross join lateral (
        select public.wa227_together(me.id, o.id) as together,
          coalesce((select array_agg(distinct g.title) from public.goal_owners x join public.goal_owners y on y.goal_id = x.goal_id join public.goals g on g.id = x.goal_id
                     where x.member_id = me.id and y.member_id = o.id and x.removed_at is null and y.removed_at is null and g.retired_at is null), '{}') as goals,
          coalesce((select array_agg(distinct p1.name) from public.projects p1 join public.projects p2 on p2.goal_id = p1.goal_id and p1.goal_id is not null
                     where p1.banked_at is null and p2.banked_at is null
                       and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p1.leads) = 'array' then p1.leads else '[]'::jsonb end) l where lower(split_part(btrim(l), ' ', 1)) = me.first)
                       and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p2.leads) = 'array' then p2.leads else '[]'::jsonb end) l where lower(split_part(btrim(l), ' ', 1)) = o.first)), '{}') as projects,
          coalesce((select array_agg(w) from (
             select w from regexp_split_to_table(lower(coalesce(me.role, '') || ' ' || coalesce((select string_agg(r, ' ') from public.team_members t, jsonb_array_elements_text(case when jsonb_typeof(t.responsibilities) = 'array' then t.responsibilities else '[]'::jsonb end) r where t.id = me.id), '') || ' ' || coalesce((select t.ai_bio from public.team_members t where t.id = me.id), '')), '[^a-z]+') w
              where length(w) > 4 and not (w = any(v_stop))
             intersect
             select w from regexp_split_to_table(lower(coalesce(o.role, '') || ' ' || coalesce((select string_agg(r, ' ') from public.team_members t, jsonb_array_elements_text(case when jsonb_typeof(t.responsibilities) = 'array' then t.responsibilities else '[]'::jsonb end) r where t.id = o.id), '') || ' ' || coalesce((select t.ai_bio from public.team_members t where t.id = o.id), '')), '[^a-z]+') w
              where length(w) > 4 and not (w = any(v_stop))
             limit 8) z), '{}') as words
      ) s
     where o.id <> me.id and o.department is distinct from me.department
     order by score desc
     limit 1;
    if best.id is null then continue; end if;
    v_picked := v_picked || jsonb_build_object(best.id::text, coalesce((v_picked ->> best.id::text)::int, 0) + 1);
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'member_id', me.id, 'other_id', best.id, 'lang', me.lang,
      'other_lang', (select lang from public.wa227_people() where id = best.id),
      'me', public.wa227_profile(me.id), 'other', public.wa227_profile(best.id),
      'signals', jsonb_build_object('together', best.together, 'shared_goals', to_jsonb(best.goals), 'goal_projects', to_jsonb(best.projects), 'shared_words', to_jsonb(best.words), 'score', round(best.score::numeric, 2))));
  end loop;
  return v_out;
end $$;
comment on function public.wa227_intro_plan(date) is 'wave227: the week''s introductions: for each person (random order) the one they have not worked with (wa227_together) whose goals, projects and role words overlap most, someone already picked this week a little less likely, never their own team. Returns both profiles and the signals for the intros function to write the notes. Service role only.';

-- the introduction to show the signed-in person now (this week's, or one someone shared with them), with the other person's card
create or replace function public.wa227_my_intro() returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_me bigint := public.wa227_my_member(); r public.hub_intros%rowtype; o public.team_members%rowtype; v_slack text; v_from text;
begin
  if v_me is null or coalesce(lower(btrim((select value from public.app_config where key = 'intros_on'))), 'true') = 'false' then return null; end if;
  select * into r from public.hub_intros i
   where i.member_id = v_me and i.status = 'new' and i.week >= current_date - 13
   order by (i.source = 'shared') desc, i.week desc, i.id desc limit 1;
  if not found then return null; end if;
  select * into o from public.team_members where id = r.other_id;
  select s.slack_id into v_slack from public.wa_slack_ids s where lower(s.email) = lower(o.email) limit 1;
  if r.source = 'shared' and r.from_intro is not null then select m.name into v_from from public.hub_intros f join public.team_members m on m.id = f.member_id where f.id = r.from_intro; end if;
  return jsonb_build_object('id', r.id, 'week', r.week, 'source', r.source, 'status', r.status, 'note', r.note, 'hello', r.hello, 'from', v_from,
    'can_share', r.source = 'weekly' and not exists (select 1 from public.hub_intros s where s.from_intro = r.id),
    'other', jsonb_build_object('id', o.id, 'name', btrim(o.name), 'first', split_part(btrim(o.name), ' ', 1), 'role', o.role, 'department', o.department,
      'team', coalesce((select d.label from public.dept_meta d where d.department = o.department), case o.department when 'exec' then 'Executive team' else o.department end), 'email', o.email, 'avatar_url', o.avatar_url, 'color', o.color, 'slack_id', v_slack),
    'me', jsonb_build_object('id', v_me, 'name', (select btrim(name) from public.team_members where id = v_me)));
end $$;
comment on function public.wa227_my_intro() is 'wave227: the introduction the signed-in person should see (a shared one first, else this week''s), with the other person''s card (role, team, avatar, Slack id) and whether they can still tell them. It pops up once: only a new one is returned (the page marks it seen). Null when there is none or when app_config intros_on is false.';

-- what the person did: seen, later, slack, coffee, profile, share (the other person gets the introduction too)
create or replace function public.wa227_intro_act(p_id bigint, p_action text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_me bigint := public.wa227_my_member(); r public.hub_intros%rowtype; v_new bigint;
begin
  if p_action not in ('seen', 'later', 'slack', 'coffee', 'profile', 'share') then raise exception 'unknown action'; end if;
  select * into r from public.hub_intros where id = p_id;
  if not found or v_me is null or r.member_id <> v_me then raise exception 'not your introduction'; end if;
  if p_action = 'seen' then
    update public.hub_intros set status = case when status = 'new' then 'seen' else status end, seen_at = coalesce(seen_at, now()) where id = p_id;
  elsif p_action = 'later' then
    update public.hub_intros set status = case when status = 'acted' then status else 'later' end, seen_at = coalesce(seen_at, now()) where id = p_id;
  elsif p_action = 'share' then
    if r.source <> 'weekly' then raise exception 'only your own weekly introduction can be shared'; end if;
    insert into public.hub_intros (week, member_id, other_id, source, from_intro, note, hello, signals)
    values (r.week, r.other_id, r.member_id, 'shared', r.id, coalesce(r.note_back, r.note), coalesce(r.hello_back, r.hello), r.signals)
    on conflict (week, member_id, other_id, source) do nothing returning id into v_new;
    update public.hub_intros set status = 'acted', acted_at = coalesce(acted_at, now()), actions = (select array_agg(distinct a) from unnest(actions || 'shared') a) where id = p_id;
  else
    update public.hub_intros set status = case when p_action = 'profile' and status = 'new' then 'seen' when p_action = 'profile' then status else 'acted' end,
           acted_at = case when p_action = 'profile' then acted_at else coalesce(acted_at, now()) end,
           actions = (select array_agg(distinct a) from unnest(actions || p_action) a) where id = p_id;
  end if;
  return jsonb_build_object('ok', true, 'shared', v_new);
end $$;
comment on function public.wa227_intro_act(bigint, text) is 'wave227: records what the person did with their introduction (seen, later, slack, coffee, profile) and, for share, gives the other person the same introduction from their side (a shared row with note_back) in their next pop-up. Only the person it is for.';

revoke all on function public.wa227_intro_plan(date) from public, anon, authenticated;
revoke all on function public.wa227_together(bigint, bigint) from public, anon, authenticated;
revoke all on function public.wa227_profile(bigint) from public, anon, authenticated;
revoke all on function public.wa227_people() from public, anon, authenticated;
revoke all on function public.wa227_my_member() from public, anon;
revoke all on function public.wa227_my_intro() from public, anon;
revoke all on function public.wa227_intro_act(bigint, text) from public, anon;
grant execute on function public.wa227_my_intro() to authenticated;
grant execute on function public.wa227_intro_act(bigint, text) to authenticated;
grant execute on function public.wa227_my_member() to authenticated;

insert into public.app_config (key, value) values ('intros_on', 'true') on conflict (key) do nothing;

insert into public.ai_routes (task, label, chain, max_tokens, notes, mode, updated_by)
values ('intro_note', 'The weekly introduction (why two people should meet)', array['anthropic/claude-haiku-4.5', 'openai/gpt-5-mini', 'google/gemini-3.8-flash'], 700,
        'wave227: the intros edge function, one call per pair a week (both sides, the reader''s language).', 'chain', 'wave227')
on conflict (task) do nothing;
