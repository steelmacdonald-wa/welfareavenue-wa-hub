-- wa180b_answers_training (30/09/26): wa180_results also gives the poster, leaders, HR and admins each person's answer (for the CSV:
-- no name and no time when it is anonymous); the Academy's Hub module 1, the Home tour and the access profiles say what wave180
-- added (announcements with a poll or a short form, at the top of Home, posted by leaders, HR and admins).

create or replace function public.wa180_results(p_id bigint)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare a public.hub_announcements; me text; manage boolean; mine jsonb; closed boolean; n_ans int; n_aud int := 0; n_missing int := 0; missing jsonb := '[]'::jsonb; rows_ jsonb := '[]'::jsonb;
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
    /* each person's answer, for the CSV (no name and no time when it is anonymous) */
    select coalesce(jsonb_agg(jsonb_build_object('name', case when named then r.name end, 'at', case when a.anonymous then null else r.updated_at end, 'answers', r.answers)
                              order by case when a.anonymous then md5(r.id::text || p_id::text) else to_char(r.updated_at, 'YYYYMMDDHH24MISS') || lpad(r.id::text, 12, '0') end), '[]'::jsonb)
      into rows_
      from public.hub_announcement_answers r where r.announcement_id = p_id;
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
      || case when manage then jsonb_build_object('audience', n_aud, 'missing_count', n_missing, 'missing', case when a.anonymous then null else missing end, 'rows', rows_) else '{}'::jsonb end;
end $function$;
comment on function public.wa180_results(bigint) is 'wave180: an announcement''s results as the signed-in person may see them: the poster, leaders, HR and admins see the totals, the names (unless anonymous), the text answers, each person''s answer (rows, for the CSV; no name or time when anonymous), how many it is for and who has not answered (a count only when anonymous); the people it is for see the totals once they have answered or it has closed, when the poster allows; nobody else sees anything.';
revoke all on function public.wa180_results(bigint) from public, anon;
grant execute on function public.wa180_results(bigint) to authenticated;

-- Hub module 1: My page (Home) and the announcements
update public.trainings
   set description = replace(description,
         'Below it: your open tasks with due dates',
         'Below it: the announcements for you, from your leaders, HR and the admins (a poll is answered with a tap, a short form in a window, and the totals show once you answer when the poster shares them; leaders, HR and admins post them from there, and each one goes once to Slack), your open tasks with due dates'),
       updated_at = now()
 where id = 39 and title = 'Hub module 1: My page and finding your work'
   and position('Below it: your open tasks with due dates' in description) > 0
   and position('announcements for you' in description) = 0;

-- the Home tour
update public.trainings set description = 'Your personal queue: announcements to answer, meetings, tasks, mentions, updates and time, and your inbox when the assistant is on for you.', updated_at = now()
 where id = 54 and key = 'tour:home' and description = 'Your personal queue: meetings, tasks, mentions, updates and time, and your inbox when the assistant is on for you.';

-- the access profiles: who posts announcements
update public.hub_access_profiles
   set lead_note = lead_note || ' A lead also posts announcements with a poll or a short form to their own team, the leaders or everyone (the top of Home and one Slack post), and sees the answers.',
       updated_at = now(), updated_by = 'wave180'
 where key in ('marketing', 'fundraising', 'progdev', 'opsmtl', 'opsto', 'hr') and coalesce(lead_note, '') <> '' and position('posts announcements' in lead_note) = 0;
update public.hub_access_profiles
   set can = can || to_jsonb(array['Post announcements with a poll or a short form to anyone (the top of Home and one Slack post), and see the answers to every announcement']),
       updated_at = now(), updated_by = 'wave180'
 where key in ('hr', 'admin') and not exists (select 1 from jsonb_array_elements_text(can) e where e like 'Post announcements%');
update public.hub_access_profiles
   set can = can || to_jsonb(array['Post announcements with a poll or a short form to everyone, the leaders or your own team (the top of Home and one Slack post), and see the answers to every announcement']),
       updated_at = now(), updated_by = 'wave180'
 where key = 'executive' and not exists (select 1 from jsonb_array_elements_text(can) e where e like 'Post announcements%');
