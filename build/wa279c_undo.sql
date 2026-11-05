-- Welfare Avenue Hub: wave279 (279c) undo, 04/11/26. Puts onboardings 4 (Alyx Denison) and 5 (Zachee Leonel Ngue) back on their day one before the
-- release restart, 25 September 2026, with every step's due date as it stood before the restart. The literals below were read live, read only, on
-- 04/11/26: 46 steps each, with the section each step's template had that day and its due date (every one of them then onb_due(that section, 25 September)).
-- wa279b runs between that capture and the restart, and it moves four steps to another section (wa166usehub, 86e1cj9gr, 86e1cj9h8, 86e1cj9h6), giving
-- their OPEN rows the new section's date, and adds new steps. So, for each of the two plans whose started_at is not 25 September 2026 any more:
--   1. a step whose due date is still the one the restart gave it (onb_due(its section now, the restart date)), and that is not a listed step still in its
--      listed section, goes back to onb_due(its section now, 25 September 2026): the date wa279b gave it (a new step, or a moved one);
--   2. a listed step still in its listed section gets its listed due date back (a step ticked after the restart included; the tick stays);
--   3. started_at = 25 September 2026, and one change_log row (onboardings / started_at, changed_by 'wave279c undo').
-- A step that was done before the restart keeps its date (the restart never moved it). Steps wa279b deleted are not put back here (wa279b's undo does that).
-- team_members and done ticks are never touched. Safe to run twice: a plan already on 25 September 2026 is skipped. Run it before wa279b's and wa279a's undo.
-- Proved offline: node test/w279sql.mjs (PGlite).

do $wa279c_undo$
declare
  r record; v_n int; v_m int;
  c_old constant date := date '2026-09-25';
  c_cap constant jsonb := '[
    {"o":4, "t":"86e1cj9gh", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9he", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9gj", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9gp", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":4, "t":"86e1cj9gx", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9gr", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9gy", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9gn", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":4, "t":"86e1cj9ha", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9h6", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9hh", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9h0", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":4, "t":"86e1cj9gm", "s":"WEEK 2", "d":"2026-10-09"}, {"o":4, "t":"86e1cj9gv", "s":"WEEK 2", "d":"2026-10-09"}, {"o":4, "t":"86e1cj9hg", "s":"WEEK 3", "d":"2026-10-16"}, {"o":4, "t":"86e1cj9hz", "s":"WEEK 4", "d":"2026-10-23"},
    {"o":4, "t":"86e1cj9j0", "s":"60 DAYS", "d":"2026-11-24"}, {"o":4, "t":"86e1cj9gq", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9h2", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9hc", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":4, "t":"86e1cj9h8", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9h3", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"86e1cj9j3", "s":"60 DAYS", "d":"2026-11-24"}, {"o":4, "t":"86e1cj9j4", "s":"60 DAYS", "d":"2026-11-24"},
    {"o":4, "t":"86e1cj9j6", "s":"60 DAYS", "d":"2026-11-24"}, {"o":4, "t":"86e1cj9hm", "s":"WEEK 3", "d":"2026-10-16"}, {"o":4, "t":"86e1cj9hx", "s":"WEEK 4", "d":"2026-10-23"}, {"o":4, "t":"86e1cj9hv", "s":"WEEK 4", "d":"2026-10-23"},
    {"o":4, "t":"86e1cj9hw", "s":"WEEK 4", "d":"2026-10-23"}, {"o":4, "t":"86e1cj9j1", "s":"60 DAYS", "d":"2026-11-24"}, {"o":4, "t":"86e1cj9ht", "s":"WEEK 4", "d":"2026-10-23"}, {"o":4, "t":"86e1cj9hr", "s":"WEEK 4", "d":"2026-10-23"},
    {"o":4, "t":"wa166hub", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"wa166hubfirst", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"wa166usehub", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"wa166slack2", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":4, "t":"wa166found", "s":"WEEK 2", "d":"2026-10-09"}, {"o":4, "t":"wa166brand", "s":"WEEK 2", "d":"2026-10-09"}, {"o":4, "t":"wa166work", "s":"WEEK 2", "d":"2026-10-09"}, {"o":4, "t":"wa166team", "s":"WEEK 3", "d":"2026-10-16"},
    {"o":4, "t":"wa166meeting", "s":"WEEK 3", "d":"2026-10-16"}, {"o":4, "t":"wa167w1", "s":"WEEK 1", "d":"2026-10-02"}, {"o":4, "t":"wa167w2", "s":"WEEK 2", "d":"2026-10-09"}, {"o":4, "t":"wa167w3", "s":"WEEK 3", "d":"2026-10-16"},
    {"o":4, "t":"wa167w4", "s":"WEEK 4", "d":"2026-10-23"}, {"o":4, "t":"wa272appsetup", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9gh", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9he", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":5, "t":"86e1cj9gj", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9gp", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9gx", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9gr", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":5, "t":"86e1cj9gy", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9gn", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9ha", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9h6", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":5, "t":"86e1cj9hh", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9h0", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9gm", "s":"WEEK 2", "d":"2026-10-09"}, {"o":5, "t":"86e1cj9gv", "s":"WEEK 2", "d":"2026-10-09"},
    {"o":5, "t":"86e1cj9hg", "s":"WEEK 3", "d":"2026-10-16"}, {"o":5, "t":"86e1cj9hz", "s":"WEEK 4", "d":"2026-10-23"}, {"o":5, "t":"86e1cj9j0", "s":"60 DAYS", "d":"2026-11-24"}, {"o":5, "t":"86e1cj9gq", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":5, "t":"86e1cj9h2", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9hc", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9h8", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"86e1cj9h3", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":5, "t":"86e1cj9j3", "s":"60 DAYS", "d":"2026-11-24"}, {"o":5, "t":"86e1cj9j4", "s":"60 DAYS", "d":"2026-11-24"}, {"o":5, "t":"86e1cj9j6", "s":"60 DAYS", "d":"2026-11-24"}, {"o":5, "t":"86e1cj9hm", "s":"WEEK 3", "d":"2026-10-16"},
    {"o":5, "t":"86e1cj9hx", "s":"WEEK 4", "d":"2026-10-23"}, {"o":5, "t":"86e1cj9hv", "s":"WEEK 4", "d":"2026-10-23"}, {"o":5, "t":"86e1cj9hw", "s":"WEEK 4", "d":"2026-10-23"}, {"o":5, "t":"86e1cj9j1", "s":"60 DAYS", "d":"2026-11-24"},
    {"o":5, "t":"86e1cj9ht", "s":"WEEK 4", "d":"2026-10-23"}, {"o":5, "t":"86e1cj9hr", "s":"WEEK 4", "d":"2026-10-23"}, {"o":5, "t":"wa166hub", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"wa166hubfirst", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":5, "t":"wa166usehub", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"wa166slack2", "s":"WEEK 1", "d":"2026-10-02"}, {"o":5, "t":"wa166found", "s":"WEEK 2", "d":"2026-10-09"}, {"o":5, "t":"wa166brand", "s":"WEEK 2", "d":"2026-10-09"},
    {"o":5, "t":"wa166work", "s":"WEEK 2", "d":"2026-10-09"}, {"o":5, "t":"wa166team", "s":"WEEK 3", "d":"2026-10-16"}, {"o":5, "t":"wa166meeting", "s":"WEEK 3", "d":"2026-10-16"}, {"o":5, "t":"wa167w1", "s":"WEEK 1", "d":"2026-10-02"},
    {"o":5, "t":"wa167w2", "s":"WEEK 2", "d":"2026-10-09"}, {"o":5, "t":"wa167w3", "s":"WEEK 3", "d":"2026-10-16"}, {"o":5, "t":"wa167w4", "s":"WEEK 4", "d":"2026-10-23"}, {"o":5, "t":"wa272appsetup", "s":"WEEK 1", "d":"2026-10-02"}
  ]'::jsonb;
begin
  for r in select o.id, o.started_at from public.onboardings o where o.id in (4, 5) order by o.id for update loop
    if r.started_at = c_old then continue; end if;   -- not restarted, or already undone
    -- 1. what the restart re-dated and the list does not cover as it stands: back to its section's date from 25 September
    update public.onboarding_steps s set due_date = public.onb_due(t.section, c_old)
      from public.onboarding_template t
     where s.onboarding_id = r.id and t.id = s.template_id
       and s.due_date is not distinct from public.onb_due(t.section, r.started_at)
       and not exists (select 1 from jsonb_to_recordset(c_cap) c(o bigint, t text, s text, d date) where c.o = r.id and c.t = s.template_id and c.s = t.section);
    get diagnostics v_n = row_count;
    -- 2. the listed steps still in their listed section: the listed date
    update public.onboarding_steps s set due_date = c.d
      from jsonb_to_recordset(c_cap) c(o bigint, t text, s text, d date), public.onboarding_template t
     where c.o = r.id and s.onboarding_id = r.id and s.template_id = c.t and t.id = s.template_id and t.section = c.s and s.due_date is distinct from c.d;
    get diagnostics v_m = row_count;
    update public.onboardings set started_at = c_old where id = r.id;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('onboardings', r.id::text, 'started_at', r.started_at::text, c_old::text, 'wave279c undo');
    raise notice 'wa279c undo: onboarding % back on % (% listed and % other steps re-dated)', r.id, c_old, v_m, v_n;
  end loop;
end $wa279c_undo$;
