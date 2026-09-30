-- wa180d_email (30/09/26): each announcement is emailed as well. Steel (30/09/26), on how the team hears about it: "Actually last
-- question it should be emailed as well". From hub@welfareavenue.com to each person it is for (not the poster), with replies going
-- to the poster; the poster can untick it. team-inbox v1.5 sends it with the Slack post (event announcement). The people it is for
-- are one list (wa180_audience) for the email and for "how many of the people it is for answered" in wa180_results.
alter table public.hub_announcements
  add column if not exists post_email boolean not null default true,
  add column if not exists emailed jsonb;
-- what was posted before the email existed is never emailed
update public.hub_announcements set post_email = false where emailed is null and created_at < now();
comment on column public.hub_announcements.post_email is 'wave180d: email it once to each person it is for when it is posted (from hub@welfareavenue.com, replies to the poster; team-inbox, event announcement).';
comment on column public.hub_announcements.emailed is 'wave180d: what the email did (team-inbox): {state, sent, to_count, failed: [names], skipped, at}. No addresses are kept here.';
comment on table public.hub_announcements is 'Announcements (wave116g; wave180: for everyone, the leaders or some teams, with a poll or a short form the team answers). Shown at the top of Home for the people they are for and in What''s new on the Executive dashboard; each gets one Slack post and an email (wave180d). Posted by leaders (to everyone, the leaders or their own team), HR and admins (to anyone); read by the people they are for, the poster, leaders, HR and admins.';

-- the people an announcement is for, from the roster (the email goes to them; wa180_results counts them)
create or replace function public.wa180_audience(p_audience text, p_teams text[])
 returns table (email text, name text)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select distinct on (lower(tm.email)) lower(tm.email) as email, tm.name
    from public.team_members tm
   where tm.active is not false and tm.email is not null and tm.email like '%@%'
     and case p_audience
           when 'everyone' then coalesce(tm.department, '') <> 'board'
           when 'leaders' then exists (select 1 from public.hub_roles hr where hr.email = lower(tm.email) and hr.role in ('admin', 'leader'))
           when 'teams' then tm.department = any(coalesce(p_teams, '{}'::text[]))
           else false end
   order by lower(tm.email), tm.name
$function$;
comment on function public.wa180_audience(text, text[]) is 'wave180d: the people an announcement is for, from the active roster (everyone: the team without the board; leaders: leaders and admins; teams: the people on those teams). team-inbox emails them; wa180_results counts them. Server only.';
revoke all on function public.wa180_audience(text, text[]) from public, anon, authenticated;
grant execute on function public.wa180_audience(text, text[]) to service_role;

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
    /* the people it is for (wa180_audience, the same list the email goes to) and who of them has not answered */
    select count(*)::int, (count(*) filter (where not x.done))::int, coalesce(jsonb_agg(x.name order by x.name) filter (where not x.done), '[]'::jsonb)
      into n_aud, n_missing, missing
      from (select m.name,
                   exists (select 1 from public.hub_announcement_answers r where r.announcement_id = p_id and r.email = m.email) as done
              from public.wa180_audience(a.audience, a.teams) m) x;
  end if;
  return jsonb_build_object('ok', true, 'visible', true, 'manage', manage, 'anonymous', a.anonymous, 'type', a.ask->>'type', 'answered', n_ans, 'closed', closed, 'mine', mine, 'questions', qo)
      || case when manage then jsonb_build_object('audience', n_aud, 'missing_count', n_missing, 'missing', case when a.anonymous then null else missing end, 'rows', rows_) else '{}'::jsonb end;
end $function$;
revoke all on function public.wa180_results(bigint) from public, anon;
grant execute on function public.wa180_results(bigint) to authenticated;

create or replace function public.trg_wa180_announce_post()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if (new.post_slack and new.slack is null) or (new.post_email and new.emailed is null) then
    begin
      perform public.call_edge('team-inbox', jsonb_build_object('event', 'announcement', 'id', new.id));
    exception when others then null;
    end;
  end if;
  return new;
end $function$;
comment on function public.trg_wa180_announce_post() is 'wave180: a new announcement with post_slack or post_email asks team-inbox to post it once in Slack and email it to the people it is for.';
revoke all on function public.trg_wa180_announce_post() from public, anon, authenticated;

-- the training and the profiles say it is emailed too
update public.trainings
   set description = replace(description, 'and each one goes once to Slack)', 'and each one goes once to Slack and by email)'), updated_at = now()
 where id = 39 and position('and each one goes once to Slack)' in description) > 0;
update public.hub_access_profiles
   set lead_note = replace(lead_note, '(the top of Home and one Slack post)', '(the top of Home, one Slack post and an email)'), updated_at = now(), updated_by = 'wave180d'
 where position('(the top of Home and one Slack post)' in coalesce(lead_note, '')) > 0;
update public.hub_access_profiles p
   set can = (select jsonb_agg(to_jsonb(replace(x.e, '(the top of Home and one Slack post)', '(the top of Home, one Slack post and an email)')) order by x.i)
                from jsonb_array_elements_text(p.can) with ordinality as x(e, i)),
       updated_at = now(), updated_by = 'wave180d'
 where exists (select 1 from jsonb_array_elements_text(p.can) e where position('(the top of Home and one Slack post)' in e) > 0);

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260930133000', 'wa180d_email', array[$m$alter table public.hub_announcements
  add column if not exists post_email boolean not null default true,
  add column if not exists emailed jsonb$m$,$m$update public.hub_announcements set post_email = false where emailed is null and created_at < now()$m$,$m$comment on column public.hub_announcements.post_email is 'wave180d: email it once to each person it is for when it is posted (from hub@welfareavenue.com, replies to the poster; team-inbox, event announcement).'$m$,$m$comment on column public.hub_announcements.emailed is 'wave180d: what the email did (team-inbox): {state, sent, to_count, failed: [names], skipped, at}. No addresses are kept here.'$m$,$m$comment on table public.hub_announcements is 'Announcements (wave116g; wave180: for everyone, the leaders or some teams, with a poll or a short form the team answers). Shown at the top of Home for the people they are for and in What''s new on the Executive dashboard; each gets one Slack post and an email (wave180d). Posted by leaders (to everyone, the leaders or their own team), HR and admins (to anyone); read by the people they are for, the poster, leaders, HR and admins.'$m$,$m$create or replace function public.wa180_audience(p_audience text, p_teams text[])
 returns table (email text, name text)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select distinct on (lower(tm.email)) lower(tm.email) as email, tm.name
    from public.team_members tm
   where tm.active is not false and tm.email is not null and tm.email like '%@%'
     and case p_audience
           when 'everyone' then coalesce(tm.department, '') <> 'board'
           when 'leaders' then exists (select 1 from public.hub_roles hr where hr.email = lower(tm.email) and hr.role in ('admin', 'leader'))
           when 'teams' then tm.department = any(coalesce(p_teams, '{}'::text[]))
           else false end
   order by lower(tm.email), tm.name
$function$$m$,$m$comment on function public.wa180_audience(text, text[]) is 'wave180d: the people an announcement is for, from the active roster (everyone: the team without the board; leaders: leaders and admins; teams: the people on those teams). team-inbox emails them; wa180_results counts them. Server only.'$m$,$m$revoke all on function public.wa180_audience(text, text[]) from public, anon, authenticated$m$,$m$grant execute on function public.wa180_audience(text, text[]) to service_role$m$,$m$create or replace function public.wa180_results(p_id bigint)
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
    /* the people it is for (wa180_audience, the same list the email goes to) and who of them has not answered */
    select count(*)::int, (count(*) filter (where not x.done))::int, coalesce(jsonb_agg(x.name order by x.name) filter (where not x.done), '[]'::jsonb)
      into n_aud, n_missing, missing
      from (select m.name,
                   exists (select 1 from public.hub_announcement_answers r where r.announcement_id = p_id and r.email = m.email) as done
              from public.wa180_audience(a.audience, a.teams) m) x;
  end if;
  return jsonb_build_object('ok', true, 'visible', true, 'manage', manage, 'anonymous', a.anonymous, 'type', a.ask->>'type', 'answered', n_ans, 'closed', closed, 'mine', mine, 'questions', qo)
      || case when manage then jsonb_build_object('audience', n_aud, 'missing_count', n_missing, 'missing', case when a.anonymous then null else missing end, 'rows', rows_) else '{}'::jsonb end;
end $function$$m$,$m$revoke all on function public.wa180_results(bigint) from public, anon$m$,$m$grant execute on function public.wa180_results(bigint) to authenticated$m$,$m$create or replace function public.trg_wa180_announce_post()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if (new.post_slack and new.slack is null) or (new.post_email and new.emailed is null) then
    begin
      perform public.call_edge('team-inbox', jsonb_build_object('event', 'announcement', 'id', new.id));
    exception when others then null;
    end;
  end if;
  return new;
end $function$$m$,$m$comment on function public.trg_wa180_announce_post() is 'wave180: a new announcement with post_slack or post_email asks team-inbox to post it once in Slack and email it to the people it is for.'$m$,$m$revoke all on function public.trg_wa180_announce_post() from public, anon, authenticated$m$,$m$update public.trainings
   set description = replace(description, 'and each one goes once to Slack)', 'and each one goes once to Slack and by email)'), updated_at = now()
 where id = 39 and position('and each one goes once to Slack)' in description) > 0$m$,$m$update public.hub_access_profiles
   set lead_note = replace(lead_note, '(the top of Home and one Slack post)', '(the top of Home, one Slack post and an email)'), updated_at = now(), updated_by = 'wave180d'
 where position('(the top of Home and one Slack post)' in coalesce(lead_note, '')) > 0$m$,$m$update public.hub_access_profiles p
   set can = (select jsonb_agg(to_jsonb(replace(x.e, '(the top of Home and one Slack post)', '(the top of Home, one Slack post and an email)')) order by x.i)
                from jsonb_array_elements_text(p.can) with ordinality as x(e, i)),
       updated_at = now(), updated_by = 'wave180d'
 where exists (select 1 from jsonb_array_elements_text(p.can) e where position('(the top of Home and one Slack post)' in e) > 0)$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
