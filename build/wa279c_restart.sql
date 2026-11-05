-- Welfare Avenue Hub: wave279 (279c), 04/11/26. The release restart for the two plans that were running before wave279: onboardings 4 (Alyx Denison) and
-- 5 (Zachee Leonel Ngue), both day one 25 September 2026.
-- Design (Steel, 04/11: "Restart dates"): their open steps get new due dates counted from release day, as if day one were the release day. Done steps keep
-- their ticks and dates.
-- Why not wa271_move_start: it also sets team_members.start_date and start_source = 'manual' (the start date shows on the reel, shout-outs, the board pack and
-- the anniversaries) and it refuses without a signed-in HR person (execute_sql has no JWT). This block changes only the onboarding plan.
-- What it does, for onboardings 4 and 5 only, and only while they are active:
--   onboardings.started_at = the release date; every OPEN onboarding_steps row = onb_due(its template section, the release date); one change_log row per
--   plan (onboardings / started_at, old -> new, changed_by 'wave279c'). Nothing else: team_members, hub_candidates and done steps are not touched.
-- The release date is app_config onboard_behind_since, which release step 4.3 sets to the release date just before this runs (so no date is typed here).
--   Not a date: it refuses and changes nothing.
-- Safe to run twice: a plan whose started_at is already the release date is skipped (no second change_log row). A plan whose started_at is neither
--   25 September 2026 nor the release date was moved by someone else: it refuses and changes nothing, because the undo's dates would then be wrong.
-- Runs after wa279a and wa279b (so wa279b's new steps are re-dated too). Undo: build/wa279c_undo.sql (run it before wa279b's and wa279a's undo).
-- Proved offline: node test/w279sql.mjs (PGlite, a copy of the two plans' 92 steps as they stood on 04/11/26).

do $wa279c$
declare
  v_raw text; v_new date; r record; v_n int;
  c_old constant date := date '2026-09-25';   -- day one of both plans on 04/11/26 (read live)
begin
  select nullif(btrim(c.value), '') into v_raw from public.app_config c where c.key = 'onboard_behind_since';
  if v_raw is null or v_raw !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'wa279c: app_config onboard_behind_since is not a date (%). Set it to the release date first (release step 4.3).', coalesce(v_raw, 'empty');
  end if;
  v_new := v_raw::date;
  -- check both plans before changing either
  for r in select o.id, o.started_at from public.onboardings o where o.id in (4, 5) and o.status = 'active' order by o.id for update loop
    if r.started_at is distinct from c_old and r.started_at is distinct from v_new then
      raise exception 'wa279c: onboarding % starts on %, not % or %. Someone moved it: check before restarting.', r.id, r.started_at, c_old, v_new;
    end if;
  end loop;
  for r in select o.id, o.started_at from public.onboardings o where o.id in (4, 5) and o.status = 'active' order by o.id loop
    if r.started_at = v_new then continue; end if;   -- already restarted
    update public.onboardings set started_at = v_new where id = r.id;
    update public.onboarding_steps s set due_date = public.onb_due(t.section, v_new)
      from public.onboarding_template t
     where s.onboarding_id = r.id and t.id = s.template_id and not coalesce(s.done, false);
    get diagnostics v_n = row_count;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('onboardings', r.id::text, 'started_at', r.started_at::text, v_new::text, 'wave279c');
    raise notice 'wa279c: onboarding % restarted on % (% open steps re-dated)', r.id, v_new, v_n;
  end loop;
end $wa279c$;
