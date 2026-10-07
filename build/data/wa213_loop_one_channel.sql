-- wave214 (06/10/26): every closed loop goes to #check-in-out-wa. Numbered 214 at release (a parallel session shipped the
-- due-date check as wave213 first); this file, its migration (wa213_loop_one_channel) and its change_log lines keep the
-- wa213 / wave213 name.
-- Steel: "All closed loops should be done in the check in out channel". Asked where a note goes, he chose only
-- #check-in-out-wa: no team channel and no Just the Hub (checkin-post v6, platform version 15). wave212 (a parallel
-- session, checkin-post v5) had already made I'm in post "is in the loop" there.
-- This file: the reading (training 216) and the walkthrough row (226) say where notes go; app_config loop_channel, the
-- fallback the function and older pages read, names the same channel (the rename to #the-loop is off); release lines.
-- Applied as migration wa213_loop_one_channel. Each replace must match, or the block stops.
do $$
declare
  d_old text; d_new text; t_old text; t_new text;
begin
  select description into d_old from public.trainings where id = 216;
  d_new := d_old;
  d_new := replace(d_new,
    'Nobody is told when you start; the green ring on your photo only shows teammates you are around.',
    'When you press I''m in, a short line in #check-in-out-wa says you are in, without the time, and the green ring on your photo shows teammates you are around.');
  d_new := replace(d_new,
    '5. Choose who sees it: your team''s channel (the usual choice), everyone in the Loop channel, or just the Hub. Every note also shows on Home.',
    '5. Your note goes to #check-in-out-wa in Slack, where the whole team sees what moved. Every note also shows on Home.');
  d_new := replace(d_new,
    'The button replaces the in and out lines some of us typed in Slack.',
    'The Hub posts your in and out lines in #check-in-out-wa for you, so there is nothing to type in Slack.');
  d_new := replace(d_new,
    'Then press I''m in for real, and close the loop with a note to just the Hub.',
    'Then press I''m in for real, and close the loop with a short note. It lands in #check-in-out-wa like every note.');
  if d_new = d_old or d_new ~* '(just the hub|choose who sees it|nobody is told when you start)' then
    raise exception 'wa213: training 216 did not take every change';
  end if;
  update public.trainings set description = d_new, updated_at = now() where id = 216;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('training', '216', 'description', d_old, 'wave213: notes go to #check-in-out-wa (step 5, What it is not, Good to know, Try it)', 'assistant (wave213 session)');

  select description into t_old from public.trainings where id = 226;
  t_new := replace(t_old, 'what moved, who sees it, and what never goes in the post', 'what moved, where it goes, and what never goes in the post');
  if t_new = t_old then raise exception 'wa213: training 226 did not change'; end if;
  update public.trainings set description = t_new, updated_at = now() where id = 226;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('training', '226', 'description', t_old, t_new, 'assistant (wave213 session)');

  update public.app_config set value = 'check-in-out-wa', updated_at = now() where key = 'loop_channel' and value is distinct from 'check-in-out-wa';
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('app_config', 'loop_channel', 'value', 'the-loop', 'check-in-out-wa (wave213: every closed loop goes to #check-in-out-wa; the rename to #the-loop is off)', 'assistant (wave213 session)');

  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'wave213', 'edge', null, 'checkin-post v6 (platform version 15): every closed loop posts once in #check-in-out-wa (the note with the closed tasks, or the one line "closed the loop" without a note); no team channel, no Just the Hub; share_to from the page is ignored. Built on wave212''s v5 (I''m in posts "is in the loop" there).', 'assistant (wave213 session)');
end $$;
