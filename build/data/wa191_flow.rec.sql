-- wa191_flow (01/10/26): the Volunteer Manager's event flow.
-- Steel (01/10/26): "our operations team needs the Volunteer manager to be easy to use and make each part of the event planning
-- process as seamless as possible. There's a lot of information everywhere and I'd like to clean it up and better show the flow
-- of our event planning process." His choices: everything, SOP included; the master SOP's steps the Hub now does are linked to
-- the Hub so they tick themselves, with a draft replacement for the steps nobody does any more (ops approves); finished servings
-- close themselves the day after.
--
-- 1. Six stages on the master SOP (sop_template.stage): plan, recruit, confirm, prepare, day_of, wrap_up. Every active step gets one.
-- 2. Steps the Hub does carry a signal (sop_template.hub_signal) and a note for ops (hub_note). wa191_autotick() ticks a serving's
--    step when its signal holds (done_by 'the Hub', done_source 'hub') and unticks a Hub tick when the signal stops holding; a
--    person's untick (done_source 'manual_off') is never overridden. A parent step ticks when its children are done (signal children).
-- 3. Proposals (sop_template.proposal): the wording the Hub suggests for an outdated step (reword) or that it should go (retire);
--    wa191_sop_proposal(id, 'approve' | 'dismiss') applies or clears it (leaders, HR, admins), logged.
-- 4. Role targets on volunteer_role_guides.target (how many of each role a serving needs), the numbers the roster board used.
-- 5. wa191_stage(event): the stage a serving is in by its date (plan > 14 days, recruit 14 to 8, confirm 7 to 3, prepare 2 to 1,
--    day_of, wrap_up after; done or cancelled by status). wa191_this_week(): the ops home (servings by stage with their next step,
--    overdue steps, steps with no owner, the caller's own steps). Staff only.
-- 6. wa191_close_past(): a serving becomes completed the day after its date (Toronto), logged; cron wa-serving-flow every 15 minutes
--    runs the ticks and the closing. The seven past servings still planned are closed by this migration.
-- Reversible: sop_template is copied to sop_template_backup_20261001 first; statuses are logged in change_log; nothing is deleted.

create table if not exists public.sop_template_backup_20261001 as select * from public.sop_template;
comment on table public.sop_template_backup_20261001 is 'Frozen copy of sop_template taken on 1 Oct 2026, before wave191 added stages, Hub signals and proposals. No primary key, no policies, no code references, not in the nightly export. Candidate for removal once wave191 has settled.';
alter table public.sop_template_backup_20261001 enable row level security;

/* ---------- 1 and 2: the columns ---------- */
alter table public.sop_template add column if not exists stage text;
alter table public.sop_template drop constraint if exists sop_template_stage_check;
alter table public.sop_template add constraint sop_template_stage_check check (stage is null or stage in ('plan', 'recruit', 'confirm', 'prepare', 'day_of', 'wrap_up'));
alter table public.sop_template add column if not exists hub_signal text;
alter table public.sop_template add column if not exists hub_note text;
alter table public.sop_template add column if not exists proposal jsonb;
comment on column public.sop_template.stage is 'wave191: the stage of the serving''s flow this step belongs to: plan, recruit, confirm, prepare, day_of or wrap_up. The serving page groups its checklist by it; defaults from the phase and the section, edited in the SOP.';
comment on column public.sop_template.hub_signal is 'wave191: when set, the Hub ticks this step on every serving by itself when the signal holds (wa191_signal): roster_contacts, confirmed_<role>, texted_cook, itinerary_ready, itinerary_lead, itinerary_server, whatsapp_link, survey_sent, survey_answered, kpi_recorded, format_set, plan_set, children (a parent: all its children done). Null: a person ticks it.';
comment on column public.sop_template.hub_note is 'wave191: the sentence ops reads under a Hub-done step: what the Hub does and when the step ticks.';
comment on column public.sop_template.proposal is 'wave191: a change the Hub proposes for an outdated step, waiting for ops: {kind: reword | retire, name, description, why, by, at}. wa191_sop_proposal approves (applies it) or dismisses (clears it). Null: nothing proposed.';

alter table public.sop_event_steps add column if not exists done_source text;
alter table public.sop_event_steps drop constraint if exists sop_event_steps_done_source_check;
alter table public.sop_event_steps add constraint sop_event_steps_done_source_check check (done_source is null or done_source in ('hub', 'manual', 'manual_off'));
comment on column public.sop_event_steps.done_source is 'wave191: who last changed done: hub (ticked by wa191_autotick from a signal), manual (a person ticked it), manual_off (a person unticked it; the Hub then leaves it alone). Null: untouched since before wave191.';
create index if not exists sop_event_steps_event_tmpl on public.sop_event_steps (event_id, template_id);

alter table public.volunteer_role_guides add column if not exists target int;
comment on column public.volunteer_role_guides.target is 'wave191: how many of this role a serving needs (the roster board''s targets, the gaps on the calendar and This week). Null: no target.';
update public.volunteer_role_guides set target = v.t from (values ('team_leader', 2), ('cook', 4), ('driver', 2), ('server', 8), ('dishwasher', 2), ('photographer', 1), ('community_talker', 2), ('community_debrief', 1)) v(r, t) where role = v.r and target is null;

/* ---------- the stages, by phase and section first, then the steps that differ ---------- */
update public.sop_template set stage = case
  when phase = 'post_event' then 'wrap_up'
  when phase = 'event_day' then 'day_of'
  when phase in ('week_of', 't_minus_1w') then 'prepare'
  when section = 'Location Specific Requirements' then 'plan'
  else 'recruit' end
where active and stage is null;
-- confirming (the calls, the confirmations, the sheets that became the roster)
update public.sop_template set stage = 'confirm' where id in ('86e04w1m1', '86e04vjam', '86e04vjap', '86e056mr2', '86e04vjax', '86e04vjb0', '86e04vjbb', '86e04vjaq', '86e04vjb4', '86e04vjbt', '86e04vjbj', '86e04vjbr');
-- preparing (what the cooks get, the WhatsApp ask)
update public.sop_template set stage = 'prepare' where id in ('86e04vjb5', '86e04vjan', '86e04vjj7');

/* ---------- the steps the Hub does ---------- */
update public.sop_template set hub_signal = 'children', hub_note = 'Ticks itself when every step under it is done.' where active and hub_signal is null and exists (select 1 from public.sop_template c where c.parent_id = sop_template.id and c.active);
update public.sop_template set hub_signal = v.sig, hub_note = v.note, proposal = case when v.pname is null then proposal else jsonb_build_object('kind', 'reword', 'name', v.pname, 'description', v.pdesc, 'why', v.why, 'by', 'the Hub (wave191)', 'at', now()) end
from (values
  ('86e04w1m1', 'roster_contacts', 'Ticks itself when everyone on the roster has a phone number. The roster in the Hub is the sheet now.', 'Check the roster has a phone number for every cook', 'Open the serving in the Volunteer Manager. Every cook on the roster needs a phone number (the confirmation text and the driver''s route use it). Add the missing ones from the CRM contact.', 'The Excel sheet is replaced by the roster in the Hub.'),
  ('86e056mr2', 'roster_contacts', 'Ticks itself when everyone on the roster has a phone number. The roster in the Hub is the sheet now.', 'Check the roster has a phone number for every driver', 'Open the serving in the Volunteer Manager. Every driver on the roster needs a phone number. Add the missing ones from the CRM contact.', 'The Excel sheet is replaced by the roster in the Hub.'),
  ('86e04vjbj', 'roster_contacts', 'Ticks itself when everyone on the roster has a phone number. The roster in the Hub is the sheet now.', 'Check the roster has a phone number for every server', 'Open the serving in the Volunteer Manager. Every server on the roster needs a phone number so the confirmation and the itinerary reach them. Recurring volunteers are on the Volunteers page (Most reliable first).', 'The "Reoccuring Volunteers 2026" sheet is replaced by the Volunteers page and the roster.'),
  ('86e04vjr7', 'roster_contacts', 'Ticks itself when everyone on the roster has a phone number.', 'Check every volunteer on the roster has a phone number', 'The itineraries go by text and email from the Hub to the people on the roster. Anyone without a phone or an email gets nothing: add it from their CRM contact.', 'The Excel sheet is replaced by the roster in the Hub.'),
  ('86e04vjam', 'confirmed_cook', 'Ticks itself when every cook on the roster has confirmed (by the text link, by replying YES, or set by hand).', null, null, null),
  ('86e04vjax', 'confirmed_driver', 'Ticks itself when every driver on the roster has confirmed.', null, null, null),
  ('86e04vjaq', 'confirmed_team_leader', 'Ticks itself when the team leader on the roster has confirmed.', null, null, null),
  ('86e04vjbt', 'confirmed_server', 'Ticks itself when every server on the roster has confirmed.', null, null, null),
  ('86e04vjbr', 'confirmed_server', 'Ticks itself when every server on the roster has confirmed.', 'Servers confirmed by Thursday, so the itineraries can go out', 'The Hub sends the itineraries the day before the serving to everyone confirmed. By Thursday, every server on the roster should be confirmed or replaced.', 'The itinerary send-out is the Hub''s now.'),
  ('86e04vjb5', 'texted_cook', 'Ticks itself when every cook has received the confirmation text: its link opens the cook''s guide.', 'Cooks have their guide', 'The confirmation text every cook gets links to their page, which carries the cook''s guide, the recipe book and what to bring. Nothing to send by hand; check the guide is current in Text settings.', 'The guideline document is on the volunteer''s page now.'),
  ('86e04vjj7', 'itinerary_server', 'Ticks itself when the servers have received their itinerary (it carries the WhatsApp link).', 'Servers get the WhatsApp link with their itinerary', 'Paste the group''s invite link on the serving (This serving''s itinerary). The itinerary the Hub sends the day before carries it, so nobody needs a separate message.', 'The WhatsApp ask travels with the itinerary now.'),
  ('86e04vjp1', 'itinerary_ready', 'Ticks itself when the serving has its start time, its format and the WhatsApp link: the itinerary is built from them.', 'Check this serving''s itinerary in the Hub', 'The itinerary is generated from the serving: set the start time, the format and paste the WhatsApp invite link (This serving''s itinerary). Preview the team leader''s, the driver''s and the server''s pages before Thursday.', 'The Canva itinerary is replaced by the Hub''s itinerary pages.'),
  ('86e04vjrb', 'itinerary_ready', 'Each volunteer''s itinerary is their own personal link now; there is no public link to make.', null, null, null),
  ('86e04vjrc', 'itinerary_lead', 'Ticks itself when the team leader and the drivers have received their itinerary.', 'Team leader and driver itineraries sent', 'Send itineraries on the serving (text, email or both), or let the Hub send them the day before at 5 pm. Sent and scheduled shows who got theirs.', 'The email drafts are replaced by Send itineraries.'),
  ('86e04vjrd', 'itinerary_server', 'Ticks itself when the servers and the photographer have received their itinerary.', 'Server and photographer itineraries sent', 'Send itineraries on the serving, or let the Hub send them the day before at 5 pm. Sent and scheduled shows who got theirs.', 'The email drafts are replaced by Send itineraries.'),
  ('86e04vjrh', 'survey_sent', 'Ticks itself when the survey text has gone out after the serving.', 'Volunteers get their survey by text after the serving', 'The Hub texts every confirmed volunteer their own two-minute survey after the serving. Read the answers on the serving (Wrap up).', 'The survey is the Hub''s now.'),
  ('86e04vjr8', 'whatsapp_link', 'Ticks itself when the group''s invite link is on the serving.', 'Create the WhatsApp group and paste its invite link on the serving', 'Create the group in WhatsApp, copy its invite link and paste it on the serving (This serving''s itinerary). The itinerary texts and emails carry it; nobody is added by hand.', 'The link travels with the itinerary now.'),
  ('86e04vjxf', 'survey_answered', 'Ticks itself when at least one volunteer has answered the survey.', null, null, null),
  ('86e04vjwu', 'kpi_recorded', 'Ticks itself when the team leader has reported the meals served in their survey.', null, null, null)
) v(id, sig, note, pname, pdesc, why) where sop_template.id = v.id;
update public.sop_template set proposal = jsonb_build_object('kind', 'retire', 'why', 'Each volunteer''s itinerary is their own personal link from the Hub; there is no public link to make any more.', 'by', 'the Hub (wave191)', 'at', now()) where id = '86e04vjrb';

/* ---------- the signals ---------- */
create or replace function public.wa191_signal(p_event bigint, p_signal text, p_template text default null) returns boolean
language plpgsql stable security definer set search_path to '' as $$
declare v boolean; e record;
begin
  select * into e from public.volunteer_events where id = p_event;
  if not found then return false; end if;
  case p_signal
    when 'format_set' then return e.format is not null;
    when 'plan_set' then return e.planned_meals is not null and e.location is not null;
    when 'whatsapp_link' then return e.whatsapp_url is not null;
    when 'itinerary_ready' then return e.start_time is not null and e.format is not null and e.whatsapp_url is not null;
    when 'roster_contacts' then
      select count(*) > 0 and bool_and(coalesce(nullif(trim(r.detail->>'phone'), ''), (select p.phones[1] from public.volunteer_people p where p.id = r.person_id)) is not null)
        into v from public.event_roster r where r.event_id = p_event and lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled') and coalesce(r.confirm_status, '') <> 'declined';
      return coalesce(v, false);
    when 'texted_cook' then
      select count(*) > 0 and bool_and(exists (select 1 from public.quo_messages m where m.roster_id = r.id and m.direction = 'out' and m.kind in ('confirm', 'signup') and m.status = 'sent'))
        into v from public.event_roster r where r.event_id = p_event and r.role = 'cook' and lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled') and coalesce(r.confirm_status, '') <> 'declined';
      return coalesce(v, false);
    when 'itinerary_lead', 'itinerary_server' then
      select count(*) > 0 and bool_and(exists (select 1 from public.volunteer_itinerary_sends s where s.roster_id = r.id and s.status in ('queued', 'sent')))
        into v from public.event_roster r where r.event_id = p_event
          and (case when p_signal = 'itinerary_lead' then r.role in ('team_leader', 'driver') else r.role in ('server', 'photographer', 'dishwasher', 'community_talker', 'community_debrief', 'volunteer') end)
          and lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled') and coalesce(r.confirm_status, '') <> 'declined';
      return coalesce(v, false);
    when 'survey_sent' then return exists (select 1 from public.quo_messages m where m.event_id = p_event and m.direction = 'out' and m.kind = 'survey' and m.status = 'sent');
    when 'survey_answered' then return exists (select 1 from public.volunteer_survey_responses s where s.event_id = p_event);
    when 'kpi_recorded' then return exists (select 1 from public.volunteer_survey_responses s where s.event_id = p_event and (s.answers ? 'meals'));
    when 'children' then
      if p_template is null then return false; end if;
      select count(*) > 0 and bool_and(coalesce(s.done, false)) into v
        from public.sop_template c left join public.sop_event_steps s on s.template_id = c.id and s.event_id = p_event
        where c.parent_id = p_template and c.active;
      return coalesce(v, false);
    else
      if p_signal like 'confirmed\_%' then
        select count(*) > 0 and bool_and(lower(coalesce(r.status, '')) = 'confirmed' or coalesce(r.confirm_status, '') = 'confirmed') into v
          from public.event_roster r where r.event_id = p_event and r.role = substr(p_signal, 11)
            and lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled') and coalesce(r.confirm_status, '') <> 'declined';
        return coalesce(v, false);
      end if;
      return false;
  end case;
end $$;
comment on function public.wa191_signal(bigint, text, text) is 'wave191: whether a Hub signal holds for a serving: format_set, plan_set, whatsapp_link, itinerary_ready (start time, format and WhatsApp link), roster_contacts (everyone on the roster has a phone), texted_cook (every cook got the confirmation text), confirmed_<role> (everyone of the role confirmed), itinerary_lead and itinerary_server (everyone of those roles got an itinerary), survey_sent, survey_answered, kpi_recorded (the team leader reported the meals), children (every child step of the template done). Declined and cancelled people are left out.';
revoke all on function public.wa191_signal(bigint, text, text) from public, anon;
grant execute on function public.wa191_signal(bigint, text, text) to authenticated;

create or replace function public.wa191_autotick(p_event bigint default null) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare r record; v boolean; n_on int := 0; n_off int := 0; pass int; v_today date := (now() at time zone 'America/Toronto')::date;
begin
  if not (public.is_wa_staff() or current_user in ('postgres', 'supabase_admin', 'service_role')) then raise exception 'Staff only'; end if;
  -- pass 1: the signals; passes 2 to 4: parents, bottom up (the SOP nests three deep)
  for pass in 1..4 loop
    for r in
      select s.id, s.event_id, s.done, s.done_source, t.id tid, t.hub_signal
      from public.sop_event_steps s join public.sop_template t on t.id = s.template_id join public.volunteer_events e on e.id = s.event_id
      where t.active and t.hub_signal is not null and (p_event is null or s.event_id = p_event)
        and (p_event is not null or (e.kind = 'service' and e.status <> 'cancelled' and e.event_date between v_today - 21 and v_today + 60))
        and ((pass = 1 and t.hub_signal <> 'children') or (pass > 1 and t.hub_signal = 'children'))
      order by s.event_id, t.depth desc, t.sort
    loop
      v := public.wa191_signal(r.event_id, r.hub_signal, r.tid);
      if v and not coalesce(r.done, false) and coalesce(r.done_source, '') <> 'manual_off' then
        update public.sop_event_steps set done = true, done_at = now(), done_by = 'the Hub', done_source = 'hub' where id = r.id; n_on := n_on + 1;
      elsif not v and coalesce(r.done, false) and r.done_source = 'hub' then
        update public.sop_event_steps set done = false, done_at = null, done_by = null, done_source = null where id = r.id; n_off := n_off + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('ticked', n_on, 'unticked', n_off);
end $$;
comment on function public.wa191_autotick(bigint) is 'wave191: ticks the Hub-done steps (sop_template.hub_signal) of upcoming and recent servings when their signal holds (done_by the Hub, done_source hub), unticks a Hub tick whose signal stopped holding, and never touches a step a person unticked (manual_off). Parents (children) run last. One serving when p_event is given (staff), every serving from 21 days back to 60 ahead otherwise (the cron). Returns the counts.';
revoke all on function public.wa191_autotick(bigint) from public, anon;
grant execute on function public.wa191_autotick(bigint) to authenticated;

/* ---------- proposals ---------- */
create or replace function public.wa191_sop_proposal(p_id text, p_action text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare t record; v_who text := coalesce(auth.jwt()->>'email', 'staff');
begin
  if not (public.is_wa_admin() or public.is_wa_leader() or public.wa_is_hr()) then raise exception 'Only leaders, HR and admins decide on the SOP''s proposals'; end if;
  select * into t from public.sop_template where id = p_id;
  if not found or t.proposal is null then raise exception 'Nothing proposed for this step'; end if;
  if p_action = 'approve' then
    if t.proposal->>'kind' = 'retire' then
      update public.sop_template set active = false, proposal = null, updated_at = now() where id = p_id;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('sop_template', p_id, 'retired', t.name, 'retired (proposed by the Hub, approved)', v_who);
    else
      update public.sop_template set name = coalesce(t.proposal->>'name', name), description = coalesce(t.proposal->>'description', description), proposal = null, updated_at = now() where id = p_id;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('sop_template', p_id, 'reworded', t.name, coalesce(t.proposal->>'name', t.name), v_who);
    end if;
  elsif p_action = 'dismiss' then
    update public.sop_template set proposal = null, updated_at = now() where id = p_id;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('sop_template', p_id, 'proposal_dismissed', t.proposal->>'kind', null, v_who);
  else raise exception 'approve or dismiss'; end if;
  return jsonb_build_object('ok', true, 'action', p_action, 'kind', t.proposal->>'kind');
end $$;
comment on function public.wa191_sop_proposal(text, text) is 'wave191: a leader, HR or an admin approves a proposal on a master SOP step (reword: the name and description change for the master and every serving, since the steps reference the template; retire: the step is deactivated) or dismisses it. Logged in change_log.';
revoke all on function public.wa191_sop_proposal(text, text) from public, anon;
grant execute on function public.wa191_sop_proposal(text, text) to authenticated;

/* ---------- the stage of a serving, This week, closing ---------- */
create or replace function public.wa191_stage(p_date date, p_status text) returns text
language sql stable as $$
  select case
    when p_status = 'cancelled' then 'cancelled'
    when p_status = 'completed' then 'done'
    when p_date < (now() at time zone 'America/Toronto')::date then 'wrap_up'
    when p_date = (now() at time zone 'America/Toronto')::date then 'day_of'
    when p_date - (now() at time zone 'America/Toronto')::date <= 2 then 'prepare'
    when p_date - (now() at time zone 'America/Toronto')::date <= 7 then 'confirm'
    when p_date - (now() at time zone 'America/Toronto')::date <= 14 then 'recruit'
    else 'plan' end
$$;
comment on function public.wa191_stage(date, text) is 'wave191: the stage a serving is in today (Toronto): plan (more than 14 days out), recruit (14 to 8), confirm (7 to 3), prepare (2 to 1), day_of, wrap_up (after, until closed), done (completed) or cancelled.';

create or replace function public.wa191_this_week(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v_today date := (now() at time zone 'America/Toronto')::date; v_email text := lower(coalesce(auth.jwt()->>'email', '')); v_me text; v_first text; out jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select name into v_me from public.team_members where lower(email) = v_email limit 1;
  v_first := split_part(coalesce(v_me, ''), ' ', 1);
  with ev as (
    select e.id, e.code, e.event_date, e.title, e.format, e.status, e.location, e.planned_meals, e.start_time, e.whatsapp_url,
      public.wa191_stage(e.event_date, e.status) stage, e.event_date - v_today days
    from public.volunteer_events e
    where e.kind = 'service' and e.status <> 'cancelled' and e.event_date between v_today - 3 and v_today + p_days
  ), ro as (
    select r.event_id,
      count(*) filter (where lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled') and coalesce(r.confirm_status, '') <> 'declined') on_list,
      count(*) filter (where lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed') confirmed,
      (select jsonb_object_agg(q.role, q.n) from (select x.role, count(*) n from public.event_roster x where x.event_id = r.event_id and lower(coalesce(x.status, '')) not in ('unavailable', 'cancelled') and coalesce(x.confirm_status, '') <> 'declined' group by x.role) q) by_role
    from public.event_roster r group by r.event_id
  ), st as (
    select s.event_id, count(*) total, count(*) filter (where s.done) done,
      count(*) filter (where not coalesce(s.done, false) and s.due_date < v_today) overdue,
      count(*) filter (where not coalesce(s.done, false) and coalesce(trim(s.owner), '') = '' and coalesce(trim(t.default_owner), '') = '' and s.due_date <= v_today + 14) unassigned,
      count(*) filter (where not coalesce(s.done, false) and t.hub_signal is not null) hub_waiting
    from public.sop_event_steps s join public.sop_template t on t.id = s.template_id where t.active group by s.event_id
  ), nx as (
    select distinct on (s.event_id) s.event_id, s.id step_id, t.name, coalesce(nullif(s.owner, ''), t.default_owner) owner, s.due_date, t.stage, t.hub_signal is not null hub
    from public.sop_event_steps s join public.sop_template t on t.id = s.template_id
    where t.active and not coalesce(s.done, false) and t.hub_signal is null and not exists (select 1 from public.sop_template c where c.parent_id = t.id and c.active)
    order by s.event_id, s.due_date nulls last, t.sort
  ), tg as (select coalesce(sum(target), 0) total from public.volunteer_role_guides where target is not null and role in ('team_leader', 'cook', 'driver', 'server', 'dishwasher', 'photographer', 'community_talker', 'community_debrief'))
  select jsonb_build_object(
    'today', v_today, 'me', v_me,
    'servings', coalesce((select jsonb_agg(jsonb_build_object('id', ev.id, 'code', ev.code, 'date', ev.event_date, 'title', ev.title, 'format', ev.format, 'status', ev.status, 'stage', ev.stage, 'days', ev.days,
        'location', ev.location, 'meals', ev.planned_meals, 'start_time', ev.start_time, 'whatsapp', ev.whatsapp_url is not null,
        'on_list', coalesce(ro.on_list, 0), 'confirmed', coalesce(ro.confirmed, 0), 'by_role', coalesce(ro.by_role, '{}'::jsonb), 'target', (select total from tg),
        'steps_total', coalesce(st.total, 0), 'steps_done', coalesce(st.done, 0), 'overdue', coalesce(st.overdue, 0), 'unassigned', coalesce(st.unassigned, 0), 'hub_waiting', coalesce(st.hub_waiting, 0),
        'next', case when nx.step_id is null then null else jsonb_build_object('step_id', nx.step_id, 'name', nx.name, 'owner', nx.owner, 'due', nx.due_date, 'stage', nx.stage) end
      ) order by ev.event_date) from ev left join ro on ro.event_id = ev.id left join st on st.event_id = ev.id left join nx on nx.event_id = ev.id), '[]'::jsonb),
    'overdue', coalesce((select jsonb_agg(x order by x->>'due', x->>'date') from (
        select jsonb_build_object('step_id', s.id, 'event_id', e.id, 'code', e.code, 'date', e.event_date, 'name', t.name, 'owner', coalesce(nullif(s.owner, ''), t.default_owner), 'due', s.due_date, 'stage', t.stage, 'hub', t.hub_signal is not null) x
        from public.sop_event_steps s join public.sop_template t on t.id = s.template_id join ev e on e.id = s.event_id
        where t.active and not coalesce(s.done, false) and s.due_date < v_today and e.stage not in ('done', 'cancelled')
          and not exists (select 1 from public.sop_template c where c.parent_id = t.id and c.active) limit 40) q), '[]'::jsonb),
    'unassigned', coalesce((select jsonb_agg(x order by x->>'due') from (
        select jsonb_build_object('step_id', s.id, 'event_id', e.id, 'code', e.code, 'date', e.event_date, 'name', t.name, 'due', s.due_date, 'stage', t.stage) x
        from public.sop_event_steps s join public.sop_template t on t.id = s.template_id join ev e on e.id = s.event_id
        where t.active and not coalesce(s.done, false) and t.hub_signal is null and coalesce(trim(s.owner), '') = '' and coalesce(trim(t.default_owner), '') = ''
          and s.due_date <= v_today + 14 and not exists (select 1 from public.sop_template c where c.parent_id = t.id and c.active) limit 40) q), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(x order by x->>'due') from (
        select jsonb_build_object('step_id', s.id, 'event_id', e.id, 'code', e.code, 'date', e.event_date, 'name', t.name, 'due', s.due_date, 'stage', t.stage, 'overdue', s.due_date < v_today) x
        from public.sop_event_steps s join public.sop_template t on t.id = s.template_id join ev e on e.id = s.event_id
        where t.active and not coalesce(s.done, false) and t.hub_signal is null and v_first <> ''
          and (lower(coalesce(nullif(s.owner, ''), t.default_owner, '')) = lower(v_me) or split_part(lower(coalesce(nullif(s.owner, ''), t.default_owner, '')), ' ', 1) = lower(v_first))
          and s.due_date <= v_today + 7 and not exists (select 1 from public.sop_template c where c.parent_id = t.id and c.active) limit 40) q), '[]'::jsonb)
  ) into out;
  return out;
end $$;
comment on function public.wa191_this_week(int) is 'wave191: the Volunteer Manager''s ops home: the servings from 3 days back to p_days ahead (stage, days, who is on the list and confirmed against the role targets, steps done, overdue and unassigned counts, the next step for a person), the overdue steps, the steps with no owner due within 14 days, and the caller''s own steps due within 7 days (matched by their team_members name). Staff only.';
revoke all on function public.wa191_this_week(int) from public, anon;
grant execute on function public.wa191_this_week(int) to authenticated;

create or replace function public.wa191_close_past() returns int
language plpgsql security definer set search_path to '' as $$
declare n int := 0; r record;
begin
  for r in select id, code, status from public.volunteer_events where kind = 'service' and status in ('planned', 'in progress') and event_date < (now() at time zone 'America/Toronto')::date loop
    update public.volunteer_events set status = 'completed' where id = r.id;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_event', r.id::text, 'status', r.status, 'completed (the day after the serving)', 'the Hub (wave191)');
    n := n + 1;
  end loop;
  return n;
end $$;
comment on function public.wa191_close_past() is 'wave191: a planned serving becomes completed the day after its date (Toronto), logged in change_log. Run by cron wa-serving-flow; reversible by setting the status back.';
revoke all on function public.wa191_close_past() from public, anon, authenticated;

/* ---------- the cron, the first run ---------- */
do $$ begin
  perform cron.unschedule('wa-serving-flow') where exists (select 1 from cron.job where jobname = 'wa-serving-flow');
  perform cron.schedule('wa-serving-flow', '7,22,37,52 * * * *', $c$select public.wa191_close_past(), public.wa191_autotick() where exists (select 1 from public.volunteer_events where kind = 'service' and status <> 'cancelled' and event_date between current_date - 21 and current_date + 60)$c$);
end $$;
select public.wa191_close_past() as closed, public.wa191_autotick() as ticks;

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261001180000', 'wa191_flow', array[$m$create table if not exists public.sop_template_backup_20261001 as select * from public.sop_template$m$,$m$comment on table public.sop_template_backup_20261001 is 'Frozen copy of sop_template taken on 1 Oct 2026, before wave191 added stages, Hub signals and proposals. No primary key, no policies, no code references, not in the nightly export. Candidate for removal once wave191 has settled.'$m$,$m$alter table public.sop_template_backup_20261001 enable row level security$m$,$m$/* ---------- 1 and 2: the columns ---------- */
alter table public.sop_template add column if not exists stage text$m$,$m$alter table public.sop_template drop constraint if exists sop_template_stage_check$m$,$m$alter table public.sop_template add constraint sop_template_stage_check check (stage is null or stage in ('plan', 'recruit', 'confirm', 'prepare', 'day_of', 'wrap_up'))$m$,$m$alter table public.sop_template add column if not exists hub_signal text$m$,$m$alter table public.sop_template add column if not exists hub_note text$m$,$m$alter table public.sop_template add column if not exists proposal jsonb$m$,$m$comment on column public.sop_template.stage is 'wave191: the stage of the serving''s flow this step belongs to: plan, recruit, confirm, prepare, day_of or wrap_up. The serving page groups its checklist by it; defaults from the phase and the section, edited in the SOP.'$m$,$m$comment on column public.sop_template.hub_signal is 'wave191: when set, the Hub ticks this step on every serving by itself when the signal holds (wa191_signal): roster_contacts, confirmed_<role>, texted_cook, itinerary_ready, itinerary_lead, itinerary_server, whatsapp_link, survey_sent, survey_answered, kpi_recorded, format_set, plan_set, children (a parent: all its children done). Null: a person ticks it.'$m$,$m$comment on column public.sop_template.hub_note is 'wave191: the sentence ops reads under a Hub-done step: what the Hub does and when the step ticks.'$m$,$m$comment on column public.sop_template.proposal is 'wave191: a change the Hub proposes for an outdated step, waiting for ops: {kind: reword | retire, name, description, why, by, at}. wa191_sop_proposal approves (applies it) or dismisses (clears it). Null: nothing proposed.'$m$,$m$alter table public.sop_event_steps add column if not exists done_source text$m$,$m$alter table public.sop_event_steps drop constraint if exists sop_event_steps_done_source_check$m$,$m$alter table public.sop_event_steps add constraint sop_event_steps_done_source_check check (done_source is null or done_source in ('hub', 'manual', 'manual_off'))$m$,$m$comment on column public.sop_event_steps.done_source is 'wave191: who last changed done: hub (ticked by wa191_autotick from a signal), manual (a person ticked it), manual_off (a person unticked it; the Hub then leaves it alone). Null: untouched since before wave191.'$m$,$m$create index if not exists sop_event_steps_event_tmpl on public.sop_event_steps (event_id, template_id)$m$,$m$alter table public.volunteer_role_guides add column if not exists target int$m$,$m$comment on column public.volunteer_role_guides.target is 'wave191: how many of this role a serving needs (the roster board''s targets, the gaps on the calendar and This week). Null: no target.'$m$,$m$update public.volunteer_role_guides set target = v.t from (values ('team_leader', 2), ('cook', 4), ('driver', 2), ('server', 8), ('dishwasher', 2), ('photographer', 1), ('community_talker', 2), ('community_debrief', 1)) v(r, t) where role = v.r and target is null$m$,$m$/* ---------- the stages, by phase and section first, then the steps that differ ---------- */
update public.sop_template set stage = case
  when phase = 'post_event' then 'wrap_up'
  when phase = 'event_day' then 'day_of'
  when phase in ('week_of', 't_minus_1w') then 'prepare'
  when section = 'Location Specific Requirements' then 'plan'
  else 'recruit' end
where active and stage is null$m$,$m$update public.sop_template set stage = 'confirm' where id in ('86e04w1m1', '86e04vjam', '86e04vjap', '86e056mr2', '86e04vjax', '86e04vjb0', '86e04vjbb', '86e04vjaq', '86e04vjb4', '86e04vjbt', '86e04vjbj', '86e04vjbr')$m$,$m$update public.sop_template set stage = 'prepare' where id in ('86e04vjb5', '86e04vjan', '86e04vjj7')$m$,$m$/* ---------- the steps the Hub does ---------- */
update public.sop_template set hub_signal = 'children', hub_note = 'Ticks itself when every step under it is done.' where active and hub_signal is null and exists (select 1 from public.sop_template c where c.parent_id = sop_template.id and c.active)$m$,$m$update public.sop_template set hub_signal = v.sig, hub_note = v.note, proposal = case when v.pname is null then proposal else jsonb_build_object('kind', 'reword', 'name', v.pname, 'description', v.pdesc, 'why', v.why, 'by', 'the Hub (wave191)', 'at', now()) end
from (values
  ('86e04w1m1', 'roster_contacts', 'Ticks itself when everyone on the roster has a phone number. The roster in the Hub is the sheet now.', 'Check the roster has a phone number for every cook', 'Open the serving in the Volunteer Manager. Every cook on the roster needs a phone number (the confirmation text and the driver''s route use it). Add the missing ones from the CRM contact.', 'The Excel sheet is replaced by the roster in the Hub.'),
  ('86e056mr2', 'roster_contacts', 'Ticks itself when everyone on the roster has a phone number. The roster in the Hub is the sheet now.', 'Check the roster has a phone number for every driver', 'Open the serving in the Volunteer Manager. Every driver on the roster needs a phone number. Add the missing ones from the CRM contact.', 'The Excel sheet is replaced by the roster in the Hub.'),
  ('86e04vjbj', 'roster_contacts', 'Ticks itself when everyone on the roster has a phone number. The roster in the Hub is the sheet now.', 'Check the roster has a phone number for every server', 'Open the serving in the Volunteer Manager. Every server on the roster needs a phone number so the confirmation and the itinerary reach them. Recurring volunteers are on the Volunteers page (Most reliable first).', 'The "Reoccuring Volunteers 2026" sheet is replaced by the Volunteers page and the roster.'),
  ('86e04vjr7', 'roster_contacts', 'Ticks itself when everyone on the roster has a phone number.', 'Check every volunteer on the roster has a phone number', 'The itineraries go by text and email from the Hub to the people on the roster. Anyone without a phone or an email gets nothing: add it from their CRM contact.', 'The Excel sheet is replaced by the roster in the Hub.'),
  ('86e04vjam', 'confirmed_cook', 'Ticks itself when every cook on the roster has confirmed (by the text link, by replying YES, or set by hand).', null, null, null),
  ('86e04vjax', 'confirmed_driver', 'Ticks itself when every driver on the roster has confirmed.', null, null, null),
  ('86e04vjaq', 'confirmed_team_leader', 'Ticks itself when the team leader on the roster has confirmed.', null, null, null),
  ('86e04vjbt', 'confirmed_server', 'Ticks itself when every server on the roster has confirmed.', null, null, null),
  ('86e04vjbr', 'confirmed_server', 'Ticks itself when every server on the roster has confirmed.', 'Servers confirmed by Thursday, so the itineraries can go out', 'The Hub sends the itineraries the day before the serving to everyone confirmed. By Thursday, every server on the roster should be confirmed or replaced.', 'The itinerary send-out is the Hub''s now.'),
  ('86e04vjb5', 'texted_cook', 'Ticks itself when every cook has received the confirmation text: its link opens the cook''s guide.', 'Cooks have their guide', 'The confirmation text every cook gets links to their page, which carries the cook''s guide, the recipe book and what to bring. Nothing to send by hand; check the guide is current in Text settings.', 'The guideline document is on the volunteer''s page now.'),
  ('86e04vjj7', 'itinerary_server', 'Ticks itself when the servers have received their itinerary (it carries the WhatsApp link).', 'Servers get the WhatsApp link with their itinerary', 'Paste the group''s invite link on the serving (This serving''s itinerary). The itinerary the Hub sends the day before carries it, so nobody needs a separate message.', 'The WhatsApp ask travels with the itinerary now.'),
  ('86e04vjp1', 'itinerary_ready', 'Ticks itself when the serving has its start time, its format and the WhatsApp link: the itinerary is built from them.', 'Check this serving''s itinerary in the Hub', 'The itinerary is generated from the serving: set the start time, the format and paste the WhatsApp invite link (This serving''s itinerary). Preview the team leader''s, the driver''s and the server''s pages before Thursday.', 'The Canva itinerary is replaced by the Hub''s itinerary pages.'),
  ('86e04vjrb', 'itinerary_ready', 'Each volunteer''s itinerary is their own personal link now; there is no public link to make.', null, null, null),
  ('86e04vjrc', 'itinerary_lead', 'Ticks itself when the team leader and the drivers have received their itinerary.', 'Team leader and driver itineraries sent', 'Send itineraries on the serving (text, email or both), or let the Hub send them the day before at 5 pm. Sent and scheduled shows who got theirs.', 'The email drafts are replaced by Send itineraries.'),
  ('86e04vjrd', 'itinerary_server', 'Ticks itself when the servers and the photographer have received their itinerary.', 'Server and photographer itineraries sent', 'Send itineraries on the serving, or let the Hub send them the day before at 5 pm. Sent and scheduled shows who got theirs.', 'The email drafts are replaced by Send itineraries.'),
  ('86e04vjrh', 'survey_sent', 'Ticks itself when the survey text has gone out after the serving.', 'Volunteers get their survey by text after the serving', 'The Hub texts every confirmed volunteer their own two-minute survey after the serving. Read the answers on the serving (Wrap up).', 'The survey is the Hub''s now.'),
  ('86e04vjr8', 'whatsapp_link', 'Ticks itself when the group''s invite link is on the serving.', 'Create the WhatsApp group and paste its invite link on the serving', 'Create the group in WhatsApp, copy its invite link and paste it on the serving (This serving''s itinerary). The itinerary texts and emails carry it; nobody is added by hand.', 'The link travels with the itinerary now.'),
  ('86e04vjxf', 'survey_answered', 'Ticks itself when at least one volunteer has answered the survey.', null, null, null),
  ('86e04vjwu', 'kpi_recorded', 'Ticks itself when the team leader has reported the meals served in their survey.', null, null, null)
) v(id, sig, note, pname, pdesc, why) where sop_template.id = v.id$m$,$m$update public.sop_template set proposal = jsonb_build_object('kind', 'retire', 'why', 'Each volunteer''s itinerary is their own personal link from the Hub; there is no public link to make any more.', 'by', 'the Hub (wave191)', 'at', now()) where id = '86e04vjrb'$m$,$m$/* ---------- the signals ---------- */
create or replace function public.wa191_signal(p_event bigint, p_signal text, p_template text default null) returns boolean
language plpgsql stable security definer set search_path to '' as $$
declare v boolean; e record;
begin
  select * into e from public.volunteer_events where id = p_event;
  if not found then return false; end if;
  case p_signal
    when 'format_set' then return e.format is not null;
    when 'plan_set' then return e.planned_meals is not null and e.location is not null;
    when 'whatsapp_link' then return e.whatsapp_url is not null;
    when 'itinerary_ready' then return e.start_time is not null and e.format is not null and e.whatsapp_url is not null;
    when 'roster_contacts' then
      select count(*) > 0 and bool_and(coalesce(nullif(trim(r.detail->>'phone'), ''), (select p.phones[1] from public.volunteer_people p where p.id = r.person_id)) is not null)
        into v from public.event_roster r where r.event_id = p_event and lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled') and coalesce(r.confirm_status, '') <> 'declined';
      return coalesce(v, false);
    when 'texted_cook' then
      select count(*) > 0 and bool_and(exists (select 1 from public.quo_messages m where m.roster_id = r.id and m.direction = 'out' and m.kind in ('confirm', 'signup') and m.status = 'sent'))
        into v from public.event_roster r where r.event_id = p_event and r.role = 'cook' and lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled') and coalesce(r.confirm_status, '') <> 'declined';
      return coalesce(v, false);
    when 'itinerary_lead', 'itinerary_server' then
      select count(*) > 0 and bool_and(exists (select 1 from public.volunteer_itinerary_sends s where s.roster_id = r.id and s.status in ('queued', 'sent')))
        into v from public.event_roster r where r.event_id = p_event
          and (case when p_signal = 'itinerary_lead' then r.role in ('team_leader', 'driver') else r.role in ('server', 'photographer', 'dishwasher', 'community_talker', 'community_debrief', 'volunteer') end)
          and lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled') and coalesce(r.confirm_status, '') <> 'declined';
      return coalesce(v, false);
    when 'survey_sent' then return exists (select 1 from public.quo_messages m where m.event_id = p_event and m.direction = 'out' and m.kind = 'survey' and m.status = 'sent');
    when 'survey_answered' then return exists (select 1 from public.volunteer_survey_responses s where s.event_id = p_event);
    when 'kpi_recorded' then return exists (select 1 from public.volunteer_survey_responses s where s.event_id = p_event and (s.answers ? 'meals'));
    when 'children' then
      if p_template is null then return false; end if;
      select count(*) > 0 and bool_and(coalesce(s.done, false)) into v
        from public.sop_template c left join public.sop_event_steps s on s.template_id = c.id and s.event_id = p_event
        where c.parent_id = p_template and c.active;
      return coalesce(v, false);
    else
      if p_signal like 'confirmed\_%' then
        select count(*) > 0 and bool_and(lower(coalesce(r.status, '')) = 'confirmed' or coalesce(r.confirm_status, '') = 'confirmed') into v
          from public.event_roster r where r.event_id = p_event and r.role = substr(p_signal, 11)
            and lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled') and coalesce(r.confirm_status, '') <> 'declined';
        return coalesce(v, false);
      end if;
      return false;
  end case;
end $$$m$,$m$comment on function public.wa191_signal(bigint, text, text) is 'wave191: whether a Hub signal holds for a serving: format_set, plan_set, whatsapp_link, itinerary_ready (start time, format and WhatsApp link), roster_contacts (everyone on the roster has a phone), texted_cook (every cook got the confirmation text), confirmed_<role> (everyone of the role confirmed), itinerary_lead and itinerary_server (everyone of those roles got an itinerary), survey_sent, survey_answered, kpi_recorded (the team leader reported the meals), children (every child step of the template done). Declined and cancelled people are left out.'$m$,$m$revoke all on function public.wa191_signal(bigint, text, text) from public, anon$m$,$m$grant execute on function public.wa191_signal(bigint, text, text) to authenticated$m$,$m$create or replace function public.wa191_autotick(p_event bigint default null) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare r record; v boolean; n_on int := 0; n_off int := 0; pass int; v_today date := (now() at time zone 'America/Toronto')::date;
begin
  if not (public.is_wa_staff() or current_user in ('postgres', 'supabase_admin', 'service_role')) then raise exception 'Staff only'; end if;
  -- pass 1: the signals; passes 2 to 4: parents, bottom up (the SOP nests three deep)
  for pass in 1..4 loop
    for r in
      select s.id, s.event_id, s.done, s.done_source, t.id tid, t.hub_signal
      from public.sop_event_steps s join public.sop_template t on t.id = s.template_id join public.volunteer_events e on e.id = s.event_id
      where t.active and t.hub_signal is not null and (p_event is null or s.event_id = p_event)
        and (p_event is not null or (e.kind = 'service' and e.status <> 'cancelled' and e.event_date between v_today - 21 and v_today + 60))
        and ((pass = 1 and t.hub_signal <> 'children') or (pass > 1 and t.hub_signal = 'children'))
      order by s.event_id, t.depth desc, t.sort
    loop
      v := public.wa191_signal(r.event_id, r.hub_signal, r.tid);
      if v and not coalesce(r.done, false) and coalesce(r.done_source, '') <> 'manual_off' then
        update public.sop_event_steps set done = true, done_at = now(), done_by = 'the Hub', done_source = 'hub' where id = r.id; n_on := n_on + 1;
      elsif not v and coalesce(r.done, false) and r.done_source = 'hub' then
        update public.sop_event_steps set done = false, done_at = null, done_by = null, done_source = null where id = r.id; n_off := n_off + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('ticked', n_on, 'unticked', n_off);
end $$$m$,$m$comment on function public.wa191_autotick(bigint) is 'wave191: ticks the Hub-done steps (sop_template.hub_signal) of upcoming and recent servings when their signal holds (done_by the Hub, done_source hub), unticks a Hub tick whose signal stopped holding, and never touches a step a person unticked (manual_off). Parents (children) run last. One serving when p_event is given (staff), every serving from 21 days back to 60 ahead otherwise (the cron). Returns the counts.'$m$,$m$revoke all on function public.wa191_autotick(bigint) from public, anon$m$,$m$grant execute on function public.wa191_autotick(bigint) to authenticated$m$,$m$/* ---------- proposals ---------- */
create or replace function public.wa191_sop_proposal(p_id text, p_action text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare t record; v_who text := coalesce(auth.jwt()->>'email', 'staff');
begin
  if not (public.is_wa_admin() or public.is_wa_leader() or public.wa_is_hr()) then raise exception 'Only leaders, HR and admins decide on the SOP''s proposals'; end if;
  select * into t from public.sop_template where id = p_id;
  if not found or t.proposal is null then raise exception 'Nothing proposed for this step'; end if;
  if p_action = 'approve' then
    if t.proposal->>'kind' = 'retire' then
      update public.sop_template set active = false, proposal = null, updated_at = now() where id = p_id;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('sop_template', p_id, 'retired', t.name, 'retired (proposed by the Hub, approved)', v_who);
    else
      update public.sop_template set name = coalesce(t.proposal->>'name', name), description = coalesce(t.proposal->>'description', description), proposal = null, updated_at = now() where id = p_id;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('sop_template', p_id, 'reworded', t.name, coalesce(t.proposal->>'name', t.name), v_who);
    end if;
  elsif p_action = 'dismiss' then
    update public.sop_template set proposal = null, updated_at = now() where id = p_id;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('sop_template', p_id, 'proposal_dismissed', t.proposal->>'kind', null, v_who);
  else raise exception 'approve or dismiss'; end if;
  return jsonb_build_object('ok', true, 'action', p_action, 'kind', t.proposal->>'kind');
end $$$m$,$m$comment on function public.wa191_sop_proposal(text, text) is 'wave191: a leader, HR or an admin approves a proposal on a master SOP step (reword: the name and description change for the master and every serving, since the steps reference the template; retire: the step is deactivated) or dismisses it. Logged in change_log.'$m$,$m$revoke all on function public.wa191_sop_proposal(text, text) from public, anon$m$,$m$grant execute on function public.wa191_sop_proposal(text, text) to authenticated$m$,$m$/* ---------- the stage of a serving, This week, closing ---------- */
create or replace function public.wa191_stage(p_date date, p_status text) returns text
language sql stable as $$
  select case
    when p_status = 'cancelled' then 'cancelled'
    when p_status = 'completed' then 'done'
    when p_date < (now() at time zone 'America/Toronto')::date then 'wrap_up'
    when p_date = (now() at time zone 'America/Toronto')::date then 'day_of'
    when p_date - (now() at time zone 'America/Toronto')::date <= 2 then 'prepare'
    when p_date - (now() at time zone 'America/Toronto')::date <= 7 then 'confirm'
    when p_date - (now() at time zone 'America/Toronto')::date <= 14 then 'recruit'
    else 'plan' end
$$$m$,$m$comment on function public.wa191_stage(date, text) is 'wave191: the stage a serving is in today (Toronto): plan (more than 14 days out), recruit (14 to 8), confirm (7 to 3), prepare (2 to 1), day_of, wrap_up (after, until closed), done (completed) or cancelled.'$m$,$m$create or replace function public.wa191_this_week(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v_today date := (now() at time zone 'America/Toronto')::date; v_email text := lower(coalesce(auth.jwt()->>'email', '')); v_me text; v_first text; out jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select name into v_me from public.team_members where lower(email) = v_email limit 1;
  v_first := split_part(coalesce(v_me, ''), ' ', 1);
  with ev as (
    select e.id, e.code, e.event_date, e.title, e.format, e.status, e.location, e.planned_meals, e.start_time, e.whatsapp_url,
      public.wa191_stage(e.event_date, e.status) stage, e.event_date - v_today days
    from public.volunteer_events e
    where e.kind = 'service' and e.status <> 'cancelled' and e.event_date between v_today - 3 and v_today + p_days
  ), ro as (
    select r.event_id,
      count(*) filter (where lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled') and coalesce(r.confirm_status, '') <> 'declined') on_list,
      count(*) filter (where lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed') confirmed,
      (select jsonb_object_agg(q.role, q.n) from (select x.role, count(*) n from public.event_roster x where x.event_id = r.event_id and lower(coalesce(x.status, '')) not in ('unavailable', 'cancelled') and coalesce(x.confirm_status, '') <> 'declined' group by x.role) q) by_role
    from public.event_roster r group by r.event_id
  ), st as (
    select s.event_id, count(*) total, count(*) filter (where s.done) done,
      count(*) filter (where not coalesce(s.done, false) and s.due_date < v_today) overdue,
      count(*) filter (where not coalesce(s.done, false) and coalesce(trim(s.owner), '') = '' and coalesce(trim(t.default_owner), '') = '' and s.due_date <= v_today + 14) unassigned,
      count(*) filter (where not coalesce(s.done, false) and t.hub_signal is not null) hub_waiting
    from public.sop_event_steps s join public.sop_template t on t.id = s.template_id where t.active group by s.event_id
  ), nx as (
    select distinct on (s.event_id) s.event_id, s.id step_id, t.name, coalesce(nullif(s.owner, ''), t.default_owner) owner, s.due_date, t.stage, t.hub_signal is not null hub
    from public.sop_event_steps s join public.sop_template t on t.id = s.template_id
    where t.active and not coalesce(s.done, false) and t.hub_signal is null and not exists (select 1 from public.sop_template c where c.parent_id = t.id and c.active)
    order by s.event_id, s.due_date nulls last, t.sort
  ), tg as (select coalesce(sum(target), 0) total from public.volunteer_role_guides where target is not null and role in ('team_leader', 'cook', 'driver', 'server', 'dishwasher', 'photographer', 'community_talker', 'community_debrief'))
  select jsonb_build_object(
    'today', v_today, 'me', v_me,
    'servings', coalesce((select jsonb_agg(jsonb_build_object('id', ev.id, 'code', ev.code, 'date', ev.event_date, 'title', ev.title, 'format', ev.format, 'status', ev.status, 'stage', ev.stage, 'days', ev.days,
        'location', ev.location, 'meals', ev.planned_meals, 'start_time', ev.start_time, 'whatsapp', ev.whatsapp_url is not null,
        'on_list', coalesce(ro.on_list, 0), 'confirmed', coalesce(ro.confirmed, 0), 'by_role', coalesce(ro.by_role, '{}'::jsonb), 'target', (select total from tg),
        'steps_total', coalesce(st.total, 0), 'steps_done', coalesce(st.done, 0), 'overdue', coalesce(st.overdue, 0), 'unassigned', coalesce(st.unassigned, 0), 'hub_waiting', coalesce(st.hub_waiting, 0),
        'next', case when nx.step_id is null then null else jsonb_build_object('step_id', nx.step_id, 'name', nx.name, 'owner', nx.owner, 'due', nx.due_date, 'stage', nx.stage) end
      ) order by ev.event_date) from ev left join ro on ro.event_id = ev.id left join st on st.event_id = ev.id left join nx on nx.event_id = ev.id), '[]'::jsonb),
    'overdue', coalesce((select jsonb_agg(x order by x->>'due', x->>'date') from (
        select jsonb_build_object('step_id', s.id, 'event_id', e.id, 'code', e.code, 'date', e.event_date, 'name', t.name, 'owner', coalesce(nullif(s.owner, ''), t.default_owner), 'due', s.due_date, 'stage', t.stage, 'hub', t.hub_signal is not null) x
        from public.sop_event_steps s join public.sop_template t on t.id = s.template_id join ev e on e.id = s.event_id
        where t.active and not coalesce(s.done, false) and s.due_date < v_today and e.stage not in ('done', 'cancelled')
          and not exists (select 1 from public.sop_template c where c.parent_id = t.id and c.active) limit 40) q), '[]'::jsonb),
    'unassigned', coalesce((select jsonb_agg(x order by x->>'due') from (
        select jsonb_build_object('step_id', s.id, 'event_id', e.id, 'code', e.code, 'date', e.event_date, 'name', t.name, 'due', s.due_date, 'stage', t.stage) x
        from public.sop_event_steps s join public.sop_template t on t.id = s.template_id join ev e on e.id = s.event_id
        where t.active and not coalesce(s.done, false) and t.hub_signal is null and coalesce(trim(s.owner), '') = '' and coalesce(trim(t.default_owner), '') = ''
          and s.due_date <= v_today + 14 and not exists (select 1 from public.sop_template c where c.parent_id = t.id and c.active) limit 40) q), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(x order by x->>'due') from (
        select jsonb_build_object('step_id', s.id, 'event_id', e.id, 'code', e.code, 'date', e.event_date, 'name', t.name, 'due', s.due_date, 'stage', t.stage, 'overdue', s.due_date < v_today) x
        from public.sop_event_steps s join public.sop_template t on t.id = s.template_id join ev e on e.id = s.event_id
        where t.active and not coalesce(s.done, false) and t.hub_signal is null and v_first <> ''
          and (lower(coalesce(nullif(s.owner, ''), t.default_owner, '')) = lower(v_me) or split_part(lower(coalesce(nullif(s.owner, ''), t.default_owner, '')), ' ', 1) = lower(v_first))
          and s.due_date <= v_today + 7 and not exists (select 1 from public.sop_template c where c.parent_id = t.id and c.active) limit 40) q), '[]'::jsonb)
  ) into out;
  return out;
end $$$m$,$m$comment on function public.wa191_this_week(int) is 'wave191: the Volunteer Manager''s ops home: the servings from 3 days back to p_days ahead (stage, days, who is on the list and confirmed against the role targets, steps done, overdue and unassigned counts, the next step for a person), the overdue steps, the steps with no owner due within 14 days, and the caller''s own steps due within 7 days (matched by their team_members name). Staff only.'$m$,$m$revoke all on function public.wa191_this_week(int) from public, anon$m$,$m$grant execute on function public.wa191_this_week(int) to authenticated$m$,$m$create or replace function public.wa191_close_past() returns int
language plpgsql security definer set search_path to '' as $$
declare n int := 0; r record;
begin
  for r in select id, code, status from public.volunteer_events where kind = 'service' and status in ('planned', 'in progress') and event_date < (now() at time zone 'America/Toronto')::date loop
    update public.volunteer_events set status = 'completed' where id = r.id;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('volunteer_event', r.id::text, 'status', r.status, 'completed (the day after the serving)', 'the Hub (wave191)');
    n := n + 1;
  end loop;
  return n;
end $$$m$,$m$comment on function public.wa191_close_past() is 'wave191: a planned serving becomes completed the day after its date (Toronto), logged in change_log. Run by cron wa-serving-flow; reversible by setting the status back.'$m$,$m$revoke all on function public.wa191_close_past() from public, anon, authenticated$m$,$m$/* ---------- the cron, the first run ---------- */
do $$ begin
  perform cron.unschedule('wa-serving-flow') where exists (select 1 from cron.job where jobname = 'wa-serving-flow');
  perform cron.schedule('wa-serving-flow', '7,22,37,52 * * * *', $c$select public.wa191_close_past(), public.wa191_autotick() where exists (select 1 from public.volunteer_events where kind = 'service' and status <> 'cancelled' and event_date between current_date - 21 and current_date + 60)$c$);
end $$$m$,$m$select public.wa191_close_past() as closed, public.wa191_autotick() as ticks$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
