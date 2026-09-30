-- wa180_announce (30/09/26): announcements that lead to a poll or a short form the team answers.
-- Steel (29/09/26): "I'd also like for leaders to be able ot make announcements that lead to forms or polls that our team can answer."
-- His answers (30/09/26): the top of Home plus one Slack post (the team's channel, #general for everyone, #leaders for the
-- leaders); polls (one or several choices, named or anonymous) and short forms (up to 8 questions) answered inside the Hub, the
-- poster sees the results and who has not answered; leaders post to their own team or everyone, HR and admins to anyone.
-- Numbered 180: another session ships wave171 onwards tonight; 175 to 179 are left to it.

-- 0. who the signed-in person is: their teams, HR, and whether an announcement is for them or theirs to manage
create or replace function public.wa180_my_teams()
 returns text[]
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select coalesce(array_agg(distinct m.department) filter (where m.department is not null), '{}'::text[])
    from public.team_members m
   where m.active is not false and lower(m.email) in (public.wa_email(), public.mybox_me())
$function$;
comment on function public.wa180_my_teams() is 'wave180: the signed-in person''s teams (their roster rows; an alias counts as the Welfare Avenue address it belongs to).';

create or replace function public.wa180_is_hr()
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.hub_roles r where r.email in (public.wa_email(), public.mybox_me()) and r.role <> 'blocked' and r.profile = 'hr')
$function$;
comment on function public.wa180_is_hr() is 'wave180: the signed-in person has the HR access profile (and is not blocked).';

create or replace function public.wa180_can_post(p_audience text, p_teams text[])
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select case
    when public.is_hub_admin() or public.wa180_is_hr() then p_audience in ('everyone', 'leaders', 'teams')
    when public.is_hub_leader() then p_audience in ('everyone', 'leaders')
      or (p_audience = 'teams' and cardinality(coalesce(p_teams, '{}'::text[])) > 0 and coalesce(p_teams, '{}'::text[]) <@ public.wa180_my_teams())
    else false end
$function$;
comment on function public.wa180_can_post(text, text[]) is 'wave180: may the signed-in person post an announcement to this audience: admins and HR to anyone; leaders to everyone, the leaders, or their own team(s).';

create or replace function public.wa180_for_me(p_audience text, p_teams text[])
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select case p_audience
    when 'everyone' then public.is_wa_staff() or public.is_board_viewer()
    when 'leaders' then public.is_hub_leader()
    when 'teams' then coalesce(p_teams, '{}'::text[]) && public.wa180_my_teams()
      or ('board' = any(coalesce(p_teams, '{}'::text[])) and public.is_board_viewer())
    else false end
$function$;
comment on function public.wa180_for_me(text, text[]) is 'wave180: is an announcement with this audience for the signed-in person (everyone: anyone on the Hub; leaders: leaders and admins; teams: people on those teams, board viewers for board).';

create or replace function public.wa180_manages(p_created_by text)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select public.is_hub_admin() or public.is_hub_leader() or public.wa180_is_hr()
      or lower(coalesce(p_created_by, '')) in (public.wa_email(), public.mybox_me())
$function$;
comment on function public.wa180_manages(text) is 'wave180: may the signed-in person see an announcement''s results and who has not answered: its poster, leaders, HR and admins.';

-- 1. what the poll or the form asks (checked on every write)
create or replace function public.wa180_ask_ok(p jsonb)
 returns boolean
 language plpgsql
 immutable
 set search_path to ''
as $function$
declare t text; q jsonb; n int; ids text[] := '{}'::text[];
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  t := p->>'type';
  if t = 'poll' then
    if length(btrim(coalesce(p->>'question', ''))) not between 1 and 300 then return false; end if;
    if jsonb_typeof(p->'options') is distinct from 'array' then return false; end if;
    n := jsonb_array_length(p->'options');
    if n < 2 or n > 8 then return false; end if;
    if exists (select 1 from jsonb_array_elements(p->'options') o(v) where jsonb_typeof(o.v) <> 'string' or length(btrim(o.v #>> '{}')) not between 1 and 120) then return false; end if;
    return true;
  elsif t = 'form' then
    if jsonb_typeof(p->'questions') is distinct from 'array' then return false; end if;
    n := jsonb_array_length(p->'questions');
    if n < 1 or n > 8 then return false; end if;
    for q in select x.v from jsonb_array_elements(p->'questions') x(v) loop
      if jsonb_typeof(q) <> 'object' then return false; end if;
      if coalesce(q->>'id', '') !~ '^q[0-9]{1,2}$' or (q->>'id') = any(ids) then return false; end if;
      ids := ids || (q->>'id');
      if length(btrim(coalesce(q->>'label', ''))) not between 1 and 300 then return false; end if;
      if coalesce(q->>'type', '') not in ('short', 'long', 'one', 'several', 'yesno', 'date', 'number') then return false; end if;
      if q->>'type' in ('one', 'several') then
        if jsonb_typeof(q->'options') is distinct from 'array' then return false; end if;
        if jsonb_array_length(q->'options') not between 2 and 10 then return false; end if;
        if exists (select 1 from jsonb_array_elements(q->'options') o(v) where jsonb_typeof(o.v) <> 'string' or length(btrim(o.v #>> '{}')) not between 1 and 120) then return false; end if;
      end if;
    end loop;
    return true;
  end if;
  return false;
end $function$;
comment on function public.wa180_ask_ok(jsonb) is 'wave180: is an announcement''s ask well formed: null; a poll {type poll, question, options (2 to 8), multi}; or a form {type form, questions (1 to 8): id q1.., label, type short|long|one|several|yesno|date|number, required, options (2 to 10) for one and several}.';

-- 2. the announcements: who they are for, the poll or the form, and the one Slack post
alter table public.hub_announcements
  add column if not exists audience text not null default 'everyone',
  add column if not exists teams text[] not null default '{}'::text[],
  add column if not exists ask jsonb,
  add column if not exists anonymous boolean not null default false,
  add column if not exists show_results boolean not null default true,
  add column if not exists closes_at timestamptz,
  add column if not exists post_slack boolean not null default true,
  add column if not exists slack jsonb,
  add column if not exists created_name text,
  add column if not exists updated_at timestamptz not null default now();
alter table public.hub_announcements drop constraint if exists hub_announcements_audience_check;
alter table public.hub_announcements add constraint hub_announcements_audience_check
  check (audience in ('everyone', 'leaders', 'teams') and (audience <> 'teams' or cardinality(teams) > 0)
         and teams <@ array['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'finance', 'hr', 'board', 'exec']::text[]);
alter table public.hub_announcements drop constraint if exists hub_announcements_ask_check;
alter table public.hub_announcements add constraint hub_announcements_ask_check check (public.wa180_ask_ok(ask));
alter table public.hub_announcements drop constraint if exists hub_announcements_text_check;
alter table public.hub_announcements add constraint hub_announcements_text_check
  check (length(btrim(title)) between 1 and 200 and (body is null or length(body) <= 2000));
comment on table public.hub_announcements is 'Announcements (wave116g; wave180: for everyone, the leaders or some teams, with a poll or a short form the team answers). Shown at the top of Home for the people they are for and in What''s new on the Executive dashboard; each gets one Slack post. Posted by leaders (to everyone, the leaders or their own team), HR and admins (to anyone); read by the people they are for, the poster, leaders, HR and admins.';
comment on column public.hub_announcements.audience is 'wave180: who it is for: everyone (anyone on the Hub), leaders (leaders and admins) or teams (the teams in teams).';
comment on column public.hub_announcements.teams is 'wave180: the team codes it is for when audience is teams (the dept codes, finance and exec included).';
comment on column public.hub_announcements.ask is 'wave180: what people answer: null, a poll {type poll, question, options, multi} or a short form {type form, questions [{id, label, type, required, options}]} (wa180_ask_ok). Answers are hub_announcement_answers.';
comment on column public.hub_announcements.anonymous is 'wave180: the results never say who answered what (the poster sees the totals only; who has not answered is a count).';
comment on column public.hub_announcements.show_results is 'wave180: people see the totals once they have answered (or once it closes); text answers are never shown to them.';
comment on column public.hub_announcements.closes_at is 'wave180: answers are taken until then (null: until it is taken down).';
comment on column public.hub_announcements.post_slack is 'wave180: post it once in Slack when it is posted (the teams'' channels, #general for everyone, #leaders for the leaders; team-inbox, event announcement).';
comment on column public.hub_announcements.slack is 'wave180: what the Slack post did: {posts: [{channel, ts, url}], errors, at} (team-inbox).';
comment on column public.hub_announcements.created_name is 'wave180: the poster''s name as it shows (created_by is their email).';
comment on column public.hub_announcements.updated_at is 'wave180: last change (closing it, taking it down).';

create or replace function public.trg_wa180_touch()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$ begin new.updated_at := now(); return new; end $function$;
drop trigger if exists trg_wa180_touch on public.hub_announcements;
create trigger trg_wa180_touch before update on public.hub_announcements for each row execute function public.trg_wa180_touch();
comment on function public.trg_wa180_touch() is 'wave180: keeps hub_announcements.updated_at.';

-- who reads and writes them
drop policy if exists hub_announcements_read on public.hub_announcements;
drop policy if exists hub_announcements_write on public.hub_announcements;
drop policy if exists hub_announcements_insert on public.hub_announcements;
drop policy if exists hub_announcements_update on public.hub_announcements;
drop policy if exists hub_announcements_delete on public.hub_announcements;
create policy hub_announcements_read on public.hub_announcements for select to authenticated
  using (public.wa180_manages(created_by) or public.wa180_for_me(audience, teams));
create policy hub_announcements_insert on public.hub_announcements for insert to authenticated
  with check (public.wa180_can_post(audience, teams) and lower(coalesce(created_by, '')) in (public.wa_email(), public.mybox_me()));
create policy hub_announcements_update on public.hub_announcements for update to authenticated
  using (public.is_hub_admin() or lower(coalesce(created_by, '')) in (public.wa_email(), public.mybox_me()))
  with check (public.wa180_can_post(audience, teams));
create policy hub_announcements_delete on public.hub_announcements for delete to authenticated
  using (public.is_hub_admin() or lower(coalesce(created_by, '')) in (public.wa_email(), public.mybox_me()));

-- 3. the answers: one per person, changed until it closes (written by wa180_answer only)
create table if not exists public.hub_announcement_answers (
  id bigint generated always as identity primary key,
  announcement_id bigint not null references public.hub_announcements(id) on delete cascade,
  email text not null check (email = lower(email)),
  name text,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (announcement_id, email)
);
create index if not exists hub_announcement_answers_ann_idx on public.hub_announcement_answers (announcement_id);
alter table public.hub_announcement_answers enable row level security;
drop policy if exists hub_announcement_answers_own on public.hub_announcement_answers;
create policy hub_announcement_answers_own on public.hub_announcement_answers for select to authenticated
  using (email in (public.wa_email(), public.mybox_me()));
revoke all on public.hub_announcement_answers from anon;
revoke insert, update, delete, truncate, references, trigger on public.hub_announcement_answers from authenticated;
grant select on public.hub_announcement_answers to authenticated;
comment on table public.hub_announcement_answers is 'wave180: each person''s answer to an announcement''s poll or short form (one per person, changed until it closes). A person reads only their own; the totals and who answered come from wa180_results. Written by wa180_answer only.';
comment on column public.hub_announcement_answers.email is 'wave180: who answered (their Welfare Avenue address; an alias counts as it).';
comment on column public.hub_announcement_answers.name is 'wave180: their name as the roster has it, for the results (never shown when the announcement is anonymous).';
comment on column public.hub_announcement_answers.answers is 'wave180: the answer, checked against the ask: a poll {choice: [option indexes]}; a form {q1: text | option index | [indexes] | true/false | YYYY-MM-DD | number}.';

-- 4. answering (checked against the ask, while it is open, by the people it is for)
create or replace function public.wa180_answer(p_id bigint, p_answers jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare a public.hub_announcements; me text; nm text; q jsonb; v jsonb; clean jsonb := '{}'::jsonb; k text; arr jsonb; nopt int; lab text;
begin
  me := public.mybox_me();
  if coalesce(me, '') = '' then raise exception 'Sign in to the Hub first.'; end if;
  select * into a from public.hub_announcements where id = p_id;
  if not found then raise exception 'That announcement is not there any more.'; end if;
  if not public.wa180_for_me(a.audience, a.teams) then raise exception 'This one is not for you.'; end if;
  if a.ask is null then raise exception 'There is nothing to answer here.'; end if;
  if a.expires_at is not null and a.expires_at <= (now() at time zone 'America/Toronto')::date then raise exception 'It was taken down.'; end if;
  if a.closes_at is not null and a.closes_at <= now() then raise exception 'It closed on %.', to_char(a.closes_at at time zone 'America/Toronto', 'FMMonth FMDD'); end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'The answer did not come through.'; end if;
  if a.ask->>'type' = 'poll' then
    arr := p_answers->'choice';
    if jsonb_typeof(arr) is distinct from 'array' or jsonb_array_length(arr) = 0 then raise exception 'Pick an answer.'; end if;
    if not coalesce((a.ask->>'multi')::boolean, false) and jsonb_array_length(arr) > 1 then raise exception 'Pick one answer.'; end if;
    nopt := jsonb_array_length(a.ask->'options');
    if exists (select 1 from jsonb_array_elements(arr) x(v) where jsonb_typeof(x.v) <> 'number' or (x.v #>> '{}')::numeric <> floor((x.v #>> '{}')::numeric)
                 or (x.v #>> '{}')::numeric < 0 or (x.v #>> '{}')::numeric >= nopt) then raise exception 'That answer is not one of the choices.'; end if;
    clean := jsonb_build_object('choice', (select jsonb_agg(distinct (x.v #>> '{}')::int) from jsonb_array_elements(arr) x(v)));
  else
    for q in select x.v from jsonb_array_elements(a.ask->'questions') x(v) loop
      k := q->>'id'; v := p_answers->k; lab := q->>'label';
      if v is null or v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '') or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0) then
        if coalesce((q->>'required')::boolean, false) then raise exception 'Please answer: %', lab; end if;
        continue;
      end if;
      if q->>'type' = 'short' then
        if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 300 then raise exception 'Keep it to a line: %', lab; end if;
        clean := clean || jsonb_build_object(k, btrim(v #>> '{}'));
      elsif q->>'type' = 'long' then
        if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 3000 then raise exception 'That answer is too long: %', lab; end if;
        clean := clean || jsonb_build_object(k, btrim(v #>> '{}'));
      elsif q->>'type' = 'one' then
        nopt := jsonb_array_length(q->'options');
        if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric) or (v #>> '{}')::numeric < 0 or (v #>> '{}')::numeric >= nopt then raise exception 'Pick one of the choices: %', lab; end if;
        clean := clean || jsonb_build_object(k, (v #>> '{}')::int);
      elsif q->>'type' = 'several' then
        nopt := jsonb_array_length(q->'options');
        if jsonb_typeof(v) <> 'array' or exists (select 1 from jsonb_array_elements(v) x(e) where jsonb_typeof(x.e) <> 'number' or (x.e #>> '{}')::numeric <> floor((x.e #>> '{}')::numeric)
                 or (x.e #>> '{}')::numeric < 0 or (x.e #>> '{}')::numeric >= nopt) then raise exception 'Pick from the choices: %', lab; end if;
        clean := clean || jsonb_build_object(k, (select jsonb_agg(distinct (x.e #>> '{}')::int) from jsonb_array_elements(v) x(e)));
      elsif q->>'type' = 'yesno' then
        if jsonb_typeof(v) <> 'boolean' then raise exception 'Yes or no: %', lab; end if;
        clean := clean || jsonb_build_object(k, v);
      elsif q->>'type' = 'date' then
        if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Pick a date: %', lab; end if;
        begin perform (v #>> '{}')::date; exception when others then raise exception 'Pick a real date: %', lab; end;
        clean := clean || jsonb_build_object(k, v #>> '{}');
      elsif q->>'type' = 'number' then
        if jsonb_typeof(v) <> 'number' then raise exception 'A number, please: %', lab; end if;
        clean := clean || jsonb_build_object(k, v);
      end if;
    end loop;
    if clean = '{}'::jsonb then raise exception 'Answer at least one question.'; end if;
  end if;
  select m.name into nm from public.team_members m where lower(m.email) in (me, public.wa_email()) order by (m.active is not false) desc limit 1;
  insert into public.hub_announcement_answers (announcement_id, email, name, answers)
  values (p_id, me, coalesce(nm, split_part(me, '@', 1)), clean)
  on conflict (announcement_id, email) do update set answers = excluded.answers, name = excluded.name, updated_at = now();
  return jsonb_build_object('ok', true, 'answers', clean, 'results', public.wa180_results(p_id));
end $function$;
comment on function public.wa180_answer(bigint, jsonb) is 'wave180: answer (or change the answer to) an announcement''s poll or short form, as the signed-in person: it must be for them, open (not closed or taken down), and the answer is checked against the ask. Returns the answer kept and the results they may see.';

-- 5. the results (the totals for the people who answered, when the poster allows; everything for the poster, leaders, HR, admins)
create or replace function public.wa180_results(p_id bigint)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare a public.hub_announcements; me text; manage boolean; mine jsonb; closed boolean; n_ans int; n_aud int := 0; n_missing int := 0; missing jsonb := '[]'::jsonb;
        qs jsonb; q jsonb; k text; qo jsonb := '[]'::jsonb; counts jsonb; vals jsonb; named boolean;
begin
  me := public.mybox_me();
  select * into a from public.hub_announcements where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'That announcement is not there any more.'); end if;
  manage := public.wa180_manages(a.created_by);
  if not manage and not public.wa180_for_me(a.audience, a.teams) then return jsonb_build_object('ok', false, 'error', 'This one is not for you.'); end if;
  select r.answers into mine from public.hub_announcement_answers r where r.announcement_id = p_id and r.email in (me, public.wa_email()) limit 1;
  closed := a.closes_at is not null and a.closes_at <= now();
  select count(*) into n_ans from public.hub_announcement_answers r where r.announcement_id = p_id;
  if a.ask is null then return jsonb_build_object('ok', true, 'visible', false, 'manage', manage, 'mine', mine, 'answered', n_ans, 'closed', closed); end if;
  if not manage and not (a.show_results and (mine is not null or closed)) then
    return jsonb_build_object('ok', true, 'visible', false, 'manage', false, 'mine', mine, 'answered', n_ans, 'closed', closed);
  end if;
  named := manage and not a.anonymous;
  if a.ask->>'type' = 'poll' then
    qs := jsonb_build_array(jsonb_build_object('id', 'choice', 'label', a.ask->>'question', 'type', case when coalesce((a.ask->>'multi')::boolean, false) then 'several' else 'one' end, 'options', a.ask->'options'));
  else
    qs := a.ask->'questions';
  end if;
  for q in select x.v from jsonb_array_elements(qs) x(v) loop
    k := q->>'id';
    if q->>'type' in ('one', 'several') then
      select coalesce(jsonb_agg(jsonb_build_object('label', o.v #>> '{}', 'count', c.n) || case when named then jsonb_build_object('names', c.names) else '{}'::jsonb end order by o.ord), '[]'::jsonb)
        into counts
        from jsonb_array_elements(q->'options') with ordinality o(v, ord)
        cross join lateral (
          select count(*)::int as n, coalesce(jsonb_agg(r.name order by r.name) filter (where r.name is not null), '[]'::jsonb) as names
            from public.hub_announcement_answers r
           where r.announcement_id = p_id
             and case jsonb_typeof(r.answers->k)
                   when 'array' then (r.answers->k) @> to_jsonb((o.ord - 1)::int)
                   when 'number' then (r.answers->>k)::numeric = (o.ord - 1)
                   else false end
        ) c;
      qo := qo || jsonb_build_array(jsonb_build_object('id', k, 'label', q->>'label', 'type', q->>'type', 'options', counts));
    elsif q->>'type' = 'yesno' then
      select jsonb_build_array(
               jsonb_build_object('label', 'Yes', 'count', count(*) filter (where r.answers->k = 'true'::jsonb))
                 || case when named then jsonb_build_object('names', coalesce(jsonb_agg(r.name order by r.name) filter (where r.answers->k = 'true'::jsonb), '[]'::jsonb)) else '{}'::jsonb end,
               jsonb_build_object('label', 'No', 'count', count(*) filter (where r.answers->k = 'false'::jsonb))
                 || case when named then jsonb_build_object('names', coalesce(jsonb_agg(r.name order by r.name) filter (where r.answers->k = 'false'::jsonb), '[]'::jsonb)) else '{}'::jsonb end)
        into counts
        from public.hub_announcement_answers r where r.announcement_id = p_id;
      qo := qo || jsonb_build_array(jsonb_build_object('id', k, 'label', q->>'label', 'type', 'yesno', 'options', counts));
    else
      vals := null;
      if manage then
        select coalesce(jsonb_agg(jsonb_build_object('v', r.answers->k) || case when named then jsonb_build_object('name', r.name) else '{}'::jsonb end order by r.updated_at), '[]'::jsonb)
          into vals
          from public.hub_announcement_answers r where r.announcement_id = p_id and r.answers ? k;
      end if;
      qo := qo || jsonb_build_array(jsonb_build_object('id', k, 'label', q->>'label', 'type', q->>'type',
               'count', (select count(*) from public.hub_announcement_answers r where r.announcement_id = p_id and r.answers ? k))
               || case when vals is not null then jsonb_build_object('values', vals) else '{}'::jsonb end);
    end if;
  end loop;
  if manage then
    select count(*)::int, (count(*) filter (where not x.done))::int, coalesce(jsonb_agg(x.name order by x.name) filter (where not x.done), '[]'::jsonb)
      into n_aud, n_missing, missing
      from (select m.name,
                   exists (select 1 from public.hub_announcement_answers r where r.announcement_id = p_id and r.email = m.email) as done
              from (select distinct on (lower(tm.email)) lower(tm.email) as email, tm.name
                      from public.team_members tm
                     where tm.active is not false and tm.email is not null and tm.email like '%@%'
                       and case a.audience
                             when 'everyone' then coalesce(tm.department, '') <> 'board'
                             when 'leaders' then exists (select 1 from public.hub_roles hr where hr.email = lower(tm.email) and hr.role in ('admin', 'leader'))
                             when 'teams' then tm.department = any(a.teams)
                             else false end
                     order by lower(tm.email), tm.name) m) x;
  end if;
  return jsonb_build_object('ok', true, 'visible', true, 'manage', manage, 'anonymous', a.anonymous, 'type', a.ask->>'type', 'answered', n_ans, 'closed', closed, 'mine', mine, 'questions', qo)
      || case when manage then jsonb_build_object('audience', n_aud, 'missing_count', n_missing, 'missing', case when a.anonymous then null else missing end) else '{}'::jsonb end;
end $function$;
comment on function public.wa180_results(bigint) is 'wave180: an announcement''s results as the signed-in person may see them: the poster, leaders, HR and admins see the totals, the names (unless anonymous), the text answers, how many it is for and who has not answered (a count only when anonymous); the people it is for see the totals once they have answered or it has closed, when the poster allows; nobody else sees anything.';

-- 6. the one Slack post (team-inbox, event announcement), when it is posted
create or replace function public.trg_wa180_announce_post()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.post_slack and new.slack is null then
    begin
      perform public.call_edge('team-inbox', jsonb_build_object('event', 'announcement', 'id', new.id));
    exception when others then null;
    end;
  end if;
  return new;
end $function$;
drop trigger if exists trg_wa180_announce_post on public.hub_announcements;
create trigger trg_wa180_announce_post after insert on public.hub_announcements for each row execute function public.trg_wa180_announce_post();
comment on function public.trg_wa180_announce_post() is 'wave180: a new announcement with post_slack asks team-inbox to post it once in Slack.';

-- where the post goes for everyone and for the leaders (the teams' channels are team_inbox.channels)
update public.hub_settings
   set value = jsonb_set(value, '{announce}', '{"everyone": "general", "leaders": "leaders"}'::jsonb, true), updated_at = now(), updated_by = 'wave180'
 where key = 'team_inbox' and not (value ? 'announce');

-- 7. who may call what
revoke all on function public.wa180_my_teams() from public, anon;
revoke all on function public.wa180_is_hr() from public, anon;
revoke all on function public.wa180_can_post(text, text[]) from public, anon;
revoke all on function public.wa180_for_me(text, text[]) from public, anon;
revoke all on function public.wa180_manages(text) from public, anon;
revoke all on function public.wa180_ask_ok(jsonb) from public, anon;
revoke all on function public.wa180_answer(bigint, jsonb) from public, anon;
revoke all on function public.wa180_results(bigint) from public, anon;
revoke all on function public.trg_wa180_announce_post() from public, anon, authenticated;
revoke all on function public.trg_wa180_touch() from public, anon, authenticated;
grant execute on function public.wa180_my_teams() to authenticated;
grant execute on function public.wa180_is_hr() to authenticated;
grant execute on function public.wa180_can_post(text, text[]) to authenticated;
grant execute on function public.wa180_for_me(text, text[]) to authenticated;
grant execute on function public.wa180_manages(text) to authenticated;
grant execute on function public.wa180_ask_ok(jsonb) to authenticated;
grant execute on function public.wa180_answer(bigint, jsonb) to authenticated;
grant execute on function public.wa180_results(bigint) to authenticated;
