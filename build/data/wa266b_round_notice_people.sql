-- Welfare Avenue Hub: wave266 (266b), S1, 26/10/26. The round notice counts people, not rows.
-- Why: after 266a the notice can fire again, and a day of the old retry loop left up to ~40 failed rows per person.
-- The notice now counts each person once, and counts someone as failed only if no text of that kind reached them
-- (or is waiting for them). Safe to run twice. Undo: the wa258_round_notices definition in
-- claude/backups/26-10-26 - wave266 undo, live definitions before 266a.sql (then re-apply 266a's two blocked patches if 266a stays).
do $$
declare d text; a text; b text; c text; n int;
begin
  d := pg_get_functiondef('public.wa258_round_notices()'::regprocedure);
  if position('count(distinct q.roster_id)' in d) > 0 then raise notice 'wave266b: already applied'; return; end if;
  a := $o$count(*) filter (where q.status = 'sent') sent, count(*) filter (where q.status in ('failed', 'blocked')) failed, count(*) filter (where q.status = 'skipped') skipped$o$;
  b := $o$select string_agg(split_part(coalesce(er.person_name, 'someone'), ' ', 1), ', ') into v_fail$o$;
  c := $o$q.kind = x.kind and q.status in ('failed', 'blocked') and (q.created_at at time zone 'America/Toronto')::date = v_today;$o$;
  foreach n in array array[(length(d) - length(replace(d, a, ''))) / length(a), (length(d) - length(replace(d, b, ''))) / length(b), (length(d) - length(replace(d, c, ''))) / length(c)] loop
    if n <> 1 then raise exception 'wave266b: a piece of wa258_round_notices matched % times', n; end if;
  end loop;
  d := replace(d, a, $n$count(distinct q.roster_id) filter (where q.status = 'sent') sent,
           count(distinct q.roster_id) filter (where q.status in ('failed', 'blocked') and not exists (select 1 from public.quo_messages s where s.roster_id = q.roster_id and s.kind = q.kind and s.direction = 'out' and s.status in ('sent', 'queued'))) failed,
           count(distinct q.roster_id) filter (where q.status = 'skipped') skipped   -- wave266b: people, not rows$n$);
  d := replace(d, b, $n$select string_agg(distinct split_part(coalesce(er.person_name, 'someone'), ' ', 1), ', ') into v_fail$n$);
  d := replace(d, c, $n$q.kind = x.kind and q.status in ('failed', 'blocked') and (q.created_at at time zone 'America/Toronto')::date = v_today
       and not exists (select 1 from public.quo_messages s where s.roster_id = q.roster_id and s.kind = q.kind and s.direction = 'out' and s.status in ('sent', 'queued'));$n$);
  execute d;
end $$;
