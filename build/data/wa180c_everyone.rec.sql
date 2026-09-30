-- wa180c_everyone (30/09/26): "everyone" is the team (staff): board viewers see an announcement when it is for the board.
create or replace function public.wa180_for_me(p_audience text, p_teams text[])
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select case p_audience
    when 'everyone' then public.is_wa_staff()
    when 'leaders' then public.is_hub_leader()
    when 'teams' then coalesce(p_teams, '{}'::text[]) && public.wa180_my_teams()
      or ('board' = any(coalesce(p_teams, '{}'::text[])) and public.is_board_viewer())
    else false end
$function$;
comment on function public.wa180_for_me(text, text[]) is 'wave180: is an announcement with this audience for the signed-in person (everyone: the team, that is anyone on staff; leaders: leaders and admins; teams: people on those teams, and board viewers when the board is one of them).';
revoke all on function public.wa180_for_me(text, text[]) from public, anon;
grant execute on function public.wa180_for_me(text, text[]) to authenticated;

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260930132000', 'wa180c_everyone', array[$m$create or replace function public.wa180_for_me(p_audience text, p_teams text[])
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select case p_audience
    when 'everyone' then public.is_wa_staff()
    when 'leaders' then public.is_hub_leader()
    when 'teams' then coalesce(p_teams, '{}'::text[]) && public.wa180_my_teams()
      or ('board' = any(coalesce(p_teams, '{}'::text[])) and public.is_board_viewer())
    else false end
$function$$m$,$m$comment on function public.wa180_for_me(text, text[]) is 'wave180: is an announcement with this audience for the signed-in person (everyone: the team, that is anyone on staff; leaders: leaders and admins; teams: people on those teams, and board viewers when the board is one of them).'$m$,$m$revoke all on function public.wa180_for_me(text, text[]) from public, anon$m$,$m$grant execute on function public.wa180_for_me(text, text[]) to authenticated$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
