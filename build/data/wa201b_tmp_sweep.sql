-- wa201b_tmp_sweep (03/10/26): the hourly sweep of the build sessions' temporary tables and helpers.
-- Steel (03/10/26), on the cleanup prompts he kept being asked to approve or paste: "Why do I need to do all this manual
-- supabase stuff", then "Let's set up number one" (an hourly job that removes temporary tables once they have been idle a day).
-- Every Hub wave stages its build, its repo pull and its GitHub push in temporary tables (wa_stage_* and wa_tmp_*), and the
-- Supabase connector holds every drop for the owner's approval, so they piled up: 68 tables, 223 MB of a 416 MB database.
-- What runs: wa_tmp_sweep() every hour (cron wa-tmp-sweep). A table whose name starts wa_stage or wa_tmp is dropped once its
-- row activity (inserts, updates, deletes in pg_stat_user_tables) has not moved for a day; a numbered helper function
-- (wa_tmp<digits>...) once it has been there a day. Plain drops (never cascade): anything another object depends on stays,
-- and the failure is logged. Each drop is a change_log line (entity_type tmp_sweep). wa_tmp_call_edge_long, the shared
-- helper the pull and push procedures reuse, is not numbered and is never swept.
-- Rule for later waves: a permanent table never takes the wa_stage or wa_tmp prefix; a session that must keep a temporary
-- table idle for more than a day sets keep_until on its wa_tmp_registry row.

create table if not exists public.wa_tmp_registry (
  kind text not null check (kind in ('table', 'function')),
  name text not null,
  fingerprint text,
  first_seen timestamptz not null default now(),
  last_active timestamptz not null default now(),
  keep_until timestamptz,
  primary key (kind, name)
);
alter table public.wa_tmp_registry enable row level security;
revoke all on public.wa_tmp_registry from anon, authenticated;
comment on table public.wa_tmp_registry is 'wave201b: what the hourly sweep (wa_tmp_sweep, cron wa-tmp-sweep) knows of the build sessions'' temporary tables (wa_stage_*, wa_tmp_*) and numbered helper functions (wa_tmp<digits>*): when it first saw each, its row-activity fingerprint and when that last moved. Written by wa_tmp_sweep only; no API access. keep_until (set by hand) holds a table past the one-day idle rule.';
comment on column public.wa_tmp_registry.fingerprint is 'wave201b: n_tup_ins + n_tup_upd + n_tup_del from pg_stat_user_tables at the last sweep (tables); a change means the table is still in use.';
comment on column public.wa_tmp_registry.last_active is 'wave201b: when the fingerprint last changed (tables) or when the sweep first saw the function; dropped a day after.';
comment on column public.wa_tmp_registry.keep_until is 'wave201b: set by hand to keep a temporary table or helper past the one-day rule until this time.';

create or replace function public.wa_tmp_sweep(p_idle interval default interval '24 hours')
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r record; v_dropped text[] := '{}'; v_failed text[] := '{}'; v_kept int := 0;
begin
  /* tables: register, refresh the activity fingerprint */
  for r in
    select c.relname as name, coalesce((s.n_tup_ins + s.n_tup_upd + s.n_tup_del)::text, '-') as fp
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    left join pg_stat_user_tables s on s.relid = c.oid
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname ~ '^wa_(stage|tmp)' and c.relname <> 'wa_tmp_registry'
  loop
    insert into public.wa_tmp_registry (kind, name, fingerprint) values ('table', r.name, r.fp)
    on conflict (kind, name) do update set fingerprint = excluded.fingerprint,
      last_active = case when public.wa_tmp_registry.fingerprint is distinct from excluded.fingerprint then now() else public.wa_tmp_registry.last_active end;
  end loop;
  /* numbered helper functions: register (their age counts from when the sweep first saw them) */
  for r in
    select p.oid::regprocedure::text as name
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname ~ '^wa_tmp[0-9]'
  loop
    insert into public.wa_tmp_registry (kind, name) values ('function', r.name) on conflict (kind, name) do nothing;
  end loop;
  /* forget what is already gone */
  delete from public.wa_tmp_registry g where g.kind = 'table' and to_regclass('public.' || quote_ident(g.name)) is null;
  delete from public.wa_tmp_registry g where g.kind = 'function' and to_regprocedure(g.name) is null;
  /* drop what has been idle for a day (plain drops: a dependency keeps the object and the failure is logged) */
  for r in
    select kind, name, first_seen, last_active from public.wa_tmp_registry
    where last_active < now() - p_idle and (keep_until is null or keep_until < now())
    order by kind desc, name
  loop
    begin
      if r.kind = 'table' then execute format('drop table public.%I', r.name);
      else execute format('drop function %s', r.name); end if;
      delete from public.wa_tmp_registry where kind = r.kind and name = r.name;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('tmp_sweep', left(r.name, 120), 'dropped', null, r.kind || ' idle since ' || to_char(r.last_active at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') || ' Toronto (first seen ' || to_char(r.first_seen at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') || ')', 'wa-tmp-sweep');
      v_dropped := v_dropped || r.name;
    exception when others then
      v_failed := v_failed || (r.name || ': ' || left(sqlerrm, 120));
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('tmp_sweep', left(r.name, 120), 'not dropped', null, left(sqlerrm, 300), 'wa-tmp-sweep');
    end;
  end loop;
  select count(*) into v_kept from public.wa_tmp_registry;
  return jsonb_build_object('dropped', to_jsonb(v_dropped), 'failed', to_jsonb(v_failed), 'waiting', v_kept);
end $$;
revoke all on function public.wa_tmp_sweep(interval) from public, anon, authenticated;
comment on function public.wa_tmp_sweep(interval) is 'wave201b: the hourly sweep (cron wa-tmp-sweep). Drops public tables named wa_stage* or wa_tmp* once their row activity has not moved for p_idle (a day), and numbered helper functions wa_tmp<digits>* a day after it first saw them; plain drops only, each logged in change_log (tmp_sweep). Not callable through the API.';

/* the leftovers already known to be finished (waves 177 to 198, the www2 and www3 website sessions, and this session's
   own wave201 tables): removed now. wave199's and wave200's, and the shared wa_stage_fn, wa_stage_push, wa_stage_push_rids
   and wa_stage_push_chunks, wait for the sweep (a day idle), in case a session is still using them. */
drop table if exists public.wa_stage_191, public.wa_stage_191b, public.wa_stage_191c, public.wa_stage_193, public.wa_stage_193seed,
  public.wa_stage_196, public.wa_stage_fx191, public.wa_stage_pull191, public.wa_stage_pull191_rids, public.wa_stage_pull193,
  public.wa_stage_pull193_tree, public.wa_stage_pull_w3, public.wa_stage_push191, public.wa_stage_push191_rids,
  public.wa_stage_push191c, public.wa_stage_push191c_rids, public.wa_stage_push193, public.wa_stage_push193_rids,
  public.wa_stage_push196, public.wa_stage_push196_rids, public.wa_stage_push196b, public.wa_stage_sheet191,
  public.wa_stage_sql181, public.wa_stage_sql191, public.wa_stage_w194, public.wa_stage_www2, public.wa_stage_www2_files,
  public.wa_stage_www2_push, public.wa_stage_www3, public.wa_tmp196_blobs, public.wa_tmp196_tree, public.wa_tmp197_blobs,
  public.wa_tmp197_tree, public.wa_stage_201, public.wa_stage_push201, public.wa_stage_push201_chunks,
  public.wa_stage_push201_rids, public.wa_tmp201_tree, public.wa_tmp201_pull, public.wa_tmp201_tree2, public.wa_tmp201_pull2;
drop function if exists public.wa_tmp177_call(text, jsonb), public.wa_tmp193_call_edge_jwt_long(text, jsonb),
  public.wa_tmp193_pull_batch(integer), public.wa_tmp193_pull_collect(), public.wa_tmp201_pull_batch(integer),
  public.wa_tmp201_pull_collect(), public.wa_tmp201_pull2_go(), public.wa_tmp201_pull2_collect();

select cron.schedule('wa-tmp-sweep', '23 * * * *', $c$select public.wa_tmp_sweep()$c$);
select public.wa_tmp_sweep();

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('cron', 'wa-tmp-sweep', 'created', null, 'Hourly at :23: wa_tmp_sweep() drops the build sessions'' temporary tables (wa_stage*, wa_tmp*) once idle a day and numbered helpers a day after first seen; each drop logged (tmp_sweep). 41 finished leftovers and 8 helpers removed at setup (about 149 MB). Steel''s OK, 03/10/26.', 'assistant (wave201 session)');
