-- wave218 (07/10/26): an applicant who would rather volunteer, from the HR centre to the Volunteer Manager.
-- Steel: "sometimes when we call applicants, they ended up wanting to just do volunteer work ... cook, server, driver,
-- team leader, community lead ... I want the ability to send applicants that come in through the HR center over to the
-- volunteer manager whenever an applicant says that they want to do something outside of the management team."
-- His choices: the card closes as Volunteering (kept, with a link to their volunteer record); HR may put them on upcoming
-- servings in the same step (Waiting for response, no text); nobody is notified (no Request, no Slack, no text).
--
-- wa218_to_volunteer(p_id, p_roles, p_events, p_note):
--   1. the person through wa209_volunteer_apply (found by email then phone in the volunteer directory, or added, one record
--      with the CRM): the roles picked, tags, the Review flag, a CRM timeline entry, and an application in Applicants received
--      ("Volunteer instead of <what they applied for>", source hr centre) with the CV and what they wrote;
--   2. the servings picked (upcoming, not cancelled or completed): a roster row Waiting For Response in the first role picked,
--      detail.source 'hr', never a text (a row they already have is left alone);
--   3. the card: status volunteering, close_reason "Volunteering: Cook, Server", volunteer_id. The stage trigger
--      (wa210_stage_moved) does not fire for volunteering, so nothing reaches Slack.
-- A practice card (Avenue Academy walkthroughs) closes the same way without touching Volunteers, the CRM or a roster.
-- Staff only. The earlier wa209_move_to_volunteers (which deleted the card) stays for the intake's own use.

alter table public.hub_candidates add column if not exists volunteer_id bigint;
comment on column public.hub_candidates.volunteer_id is 'wave218: the volunteer record this applicant became when the card was closed as volunteering.';

create or replace function public.wa218_to_volunteer(p_id bigint, p_roles text[], p_events bigint[] default '{}', p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  c public.hub_candidates%rowtype; v_by text; v_title text; v_roles text[]; v_labels text; r jsonb; v_pid bigint; v_cid bigint;
  v_today date := (now() at time zone 'America/Toronto')::date; v_role text; v_phone text; ev record; v_rid bigint;
  n_added int := 0; n_kept int := 0; v_dates text[] := '{}'; v_reason text;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  v_by := coalesce((select m.name from public.team_members m where lower(m.email) = lower(auth.jwt() ->> 'email') limit 1), lower(auth.jwt() ->> 'email'), 'hr centre');
  select * into c from public.hub_candidates where id = p_id for update;
  if not found then raise exception 'No such applicant.'; end if;
  if c.status = 'volunteering' then raise exception '% is already with the Volunteer Manager.', coalesce(c.name, 'This applicant'); end if;

  select coalesce(array_agg(distinct x order by x), '{}') into v_roles from unnest(coalesce(p_roles, '{}')) x
   where x in ('team_leader', 'cook', 'driver', 'server', 'dishwasher', 'photographer', 'community_talker', 'community_debrief', 'volunteer');
  if cardinality(v_roles) = 0 then raise exception 'Pick at least one volunteer role.'; end if;
  select string_agg(coalesce(g.label_en, initcap(replace(x, '_', ' '))), ', ' order by array_position(array['team_leader','cook','driver','server','dishwasher','photographer','community_debrief','community_talker','volunteer'], x))
    into v_labels from unnest(v_roles) x left join public.volunteer_role_guides g on g.role = x;
  select title into v_title from public.hub_positions where id = c.position_id;
  v_reason := 'Volunteering: ' || v_labels;

  if not coalesce(c.practice, false) then
    r := public.wa209_volunteer_apply(jsonb_build_object(
      'name', c.name, 'email', c.email, 'phone', c.phone,
      'role_text', v_labels || ' (instead of ' || coalesce(nullif(btrim(coalesce(v_title, c.role, '')), ''), 'a team role') || ')',
      'roles', to_jsonb(v_roles), 'source', 'hr centre', 'source_ref', 'candidate:' || c.id || ':volunteer',
      'applied_at', now(), 'message', nullif(concat_ws(E'\n\n', nullif(btrim(coalesce(p_note, '')), ''), c.summary, c.notes), ''),
      'cv_path', c.cv_path, 'mail_id', c.mail_id, 'candidate_id', c.id, 'by', v_by));
    v_pid := nullif(r->>'person_id', '')::bigint; v_cid := nullif(r->>'contact_id', '')::bigint;

    -- the servings picked: waiting for their answer, never texted from here
    if v_pid is not null and cardinality(coalesce(p_events, '{}')) > 0 then
      v_role := coalesce((select x from unnest(v_roles) x where x <> 'volunteer' order by array_position(array['team_leader','cook','driver','server','dishwasher','photographer','community_debrief','community_talker'], x) limit 1), 'server');
      if not exists (select 1 from public.volunteer_role_guides g where g.role = v_role) then v_role := 'server'; end if;
      v_phone := right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10);
      for ev in select e.id, e.event_date from public.volunteer_events e
                 where e.id = any (p_events) and e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date >= v_today
                 order by e.event_date, e.id loop
        v_rid := null;
        select r2.id into v_rid from public.event_roster r2 where r2.event_id = ev.id and r2.person_id = v_pid and lower(coalesce(r2.status, '')) <> 'cancelled' limit 1;
        if v_rid is not null then n_kept := n_kept + 1; continue; end if;
        insert into public.event_roster (event_id, person_id, person_name, role, status, detail, sort)
        values (ev.id, v_pid, coalesce(nullif(btrim(c.name), ''), 'Volunteer'), v_role, 'Waiting For Response',
                jsonb_strip_nulls(jsonb_build_object('source', 'hr', 'candidate', c.id, 'by', v_by, 'at', now(),
                  'phone', case when length(v_phone) = 10 then '(' || substr(v_phone, 1, 3) || ') ' || substr(v_phone, 4, 3) || '-' || substr(v_phone, 7, 4) end)), 900);
        n_added := n_added + 1; v_dates := v_dates || to_char(ev.event_date, 'DD/MM');
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('volunteer_event', ev.id::text, 'roster', null, coalesce(c.name, 'An applicant') || ' added from the HR centre as ' || v_role || ' (waiting for response, not texted)', v_by);
        perform public.wa191_autotick(ev.id);
      end loop;
    end if;
  end if;

  update public.hub_candidates set status = 'volunteering', stage_at = now(), close_reason = v_reason, volunteer_id = coalesce(v_pid, volunteer_id),
         updated_at = now(), updated_by = v_by
   where id = c.id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('candidate', c.id::text, 'status', c.status,
          'volunteering (' || v_labels || case when n_added > 0 then '; ' || n_added || ' serving' || case when n_added = 1 then '' else 's' end || ' ' || array_to_string(v_dates, ', ') else '' end ||
          case when coalesce(c.practice, false) then '; practice' else '; volunteer ' || coalesce(v_pid::text, '?') end || ')', v_by);

  return jsonb_strip_nulls(jsonb_build_object('ok', true, 'practice', case when coalesce(c.practice, false) then true end, 'person_id', v_pid, 'contact_id', v_cid,
    'new_person', r->'new_person', 'application_id', r->'application_id', 'roles', to_jsonb(v_roles), 'labels', v_labels,
    'added', n_added, 'already_on', n_kept, 'dates', to_jsonb(v_dates), 'close_reason', v_reason));
end $$;
revoke execute on function public.wa218_to_volunteer(bigint, text[], bigint[], text) from public, anon;
grant execute on function public.wa218_to_volunteer(bigint, text[], bigint[], text) to authenticated;
comment on function public.wa218_to_volunteer(bigint, text[], bigint[], text) is 'wave218: an applicant who would rather volunteer: into Volunteers and Applicants received (wa209_volunteer_apply), optionally on upcoming servings as Waiting For Response (no text), and the card closed as volunteering. Staff only; practice cards only close.';
