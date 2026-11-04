-- Welfare Avenue Hub: wave278 (278a), Task 1, 04/11/26. The database for the new-employee onboarding experience, on top of wave275b (live).
-- A new hire gets one welcome email from the person who sent the offer and one Hub page with twelve setup steps, while the Hub adds them to their Google
-- Groups, shared drives, weekly meeting and Slack onboarding channel. This file only gives the database what the rest of the wave needs:
--   the settings HR can change (the four step switches, the leader titles, the groups, drives and weekly meetings rules, the Slack channel, the setup video),
--   hub_candidates.offer_sent_by (who pressed Send on the offer, so the welcome goes from them),
--   hub_onboard_flows.leader (the leader decision) and welcome_cc (the staff who get a copy of the welcome),
--   the card row (wa275_flow_row) with leader, welcome_cc, offer_sent_by and owner_email,
--   wa278_hub_seen(), which the Hub page calls on sign-in to tick the hire's "Sign in to the Hub" step (rd_hub),
--   and the one-time carry-over of the rundown ticks from wave275's keys to the twelve new ones.
-- Nothing here sends anything, adds anyone to a group, drive, meeting or channel, or creates an account.
-- Design: claude/04-11-26 - New-employee onboarding experience, design (wave278).md. Plan: docs/superpowers/plans/2026-11-04-new-employee-onboarding-wave278.md.
-- Proved offline first: node test/w271sql.mjs (PGlite, with test/w278sql.sql). Safe to run twice: the settings are added once (on conflict do nothing, so a value
-- HR set stays), the columns only if absent, and the carry-over only touches rows that still hold an old key.
-- Needs wa275a_streamlined.sql and wa275b_optional.sql first. Undo: build/wa278a_undo.sql (before build/wa275b_undo.sql).

-- 1. the offer: who pressed Send
alter table public.hub_candidates add column if not exists offer_sent_by text;
comment on column public.hub_candidates.offer_sent_by is 'wave278: the email of the Hub user who pressed Send on the offer. Written by recruit-actions when the offer goes out; read by onboard-run, which sends the welcome email from that person (then the candidate''s owner, then hub@welfareavenue.com) with Reply-To set to the sender, and by the card through wa275_flow_row. Null: an offer from before wave278.';

-- 2. the flow: the leader decision and the staff copies of the welcome
alter table public.hub_onboard_flows add column if not exists leader boolean;
alter table public.hub_onboard_flows add column if not exists welcome_cc text[] not null default '{}'::text[];
comment on column public.hub_onboard_flows.leader is 'wave278: whether the new hire is added as a leader (true) or a member (false). Set by onboard-run at Accept from app_config onboard_leader_titles (a position title holding one of those words, whole word, any case, means leader), and changed by HR from the card (onboard-run set_leader). Read by the groups and drives steps (leaders get the leaders groups and every shared drive but the ones named) and by the card. Null: not decided yet.';
comment on column public.hub_onboard_flows.welcome_cc is 'wave278: the staff emails HR ticked on the card to get a copy of the welcome email (onboard-run set_welcome_cc writes it). Read by onboard-run when it sends the welcome: the staff copies are a second send with the password line replaced. Holds no secrets. {} until HR ticks someone.';
grant select (leader, welcome_cc) on public.hub_onboard_flows to authenticated;   -- as every column but pw_nonce (271a); row security keeps it to HR and admins; the service key has it all

-- 3. the settings (HR can change them in app_config). Every rule that names a group, drive, meeting or title is one of these.
--    onboard_auto_groups, onboard_auto_drives, onboard_auto_meeting, onboard_auto_channel: the four new onboard-run steps, on (anything but on: the step is skipped).
--    onboard_leader_titles: the words that make a position title a leader's, comma separated.
--    onboard_groups: the Google Groups a new hire joins (all, leaders, and by department code). A group that does not exist is reported, not failed.
--    onboard_drives: the shared drives a new hire joins as writer (Drive's "Content manager"). The ids are filled in at release (Task 7) from drives.list;
--      until then every id is the placeholder "<fill at release>". In order: all = Org's Files; leaders_all_except = Accounting, Board of Directors (leaders
--      get every shared drive the service account can list but these); marketing = Marketing & Web; fundraising = Fundraising; opsmtl = Operations;
--      opsto = Operations, Toronto Branch; hr = Human Resources; progdev = Program Development; finance = Accounting.
--    onboard_weekly_meetings: {"<department>": "<recurring_event_id>"}, seeded from hub_events at release; {} until then.
--    onboard_slack_channel_link: the share link to the Slack onboarding channel, put in the welcome and on the setup page.
--    onboard_slack_channel_id: the channel id HR pastes; empty means the channel step ends as an HR task ("no channel id").
--    onboard_setup_video: the walkthrough video shown at the top of the setup page when set; empty until Steel records it.
insert into public.app_config (key, value) values
  ('onboard_auto_groups', 'on'), ('onboard_auto_drives', 'on'), ('onboard_auto_meeting', 'on'), ('onboard_auto_channel', 'on'),
  ('onboard_leader_titles', 'director, lead, head, chief, manager'),
  ('onboard_groups', '{"all": ["org@welfareavenue.com"], "leaders": ["admin@welfareavenue.com", "directors@welfareavenue.com"], "by_department": {"marketing": ["marketing@welfareavenue.com"], "fundraising": ["fundraising@welfareavenue.com", "grants@welfareavenue.com"], "opsmtl": ["operations@welfareavenue.com"], "opsto": ["operations@welfareavenue.com", "toronto@welfareavenue.com"], "outreach": ["outreach@welfareavenue.com"], "hr": ["job@welfareavenue.com"], "finance": ["finance@welfareavenue.com"], "progdev": []}}'),
  ('onboard_drives', '{"all": ["<fill at release>"], "leaders_all_except": ["<fill at release>", "<fill at release>"], "by_department": {"marketing": ["<fill at release>"], "fundraising": ["<fill at release>"], "opsmtl": ["<fill at release>"], "opsto": ["<fill at release>", "<fill at release>"], "hr": ["<fill at release>"], "progdev": ["<fill at release>"], "finance": ["<fill at release>"]}}'),
  ('onboard_weekly_meetings', '{}'),
  ('onboard_slack_channel_link', 'https://join.slack.com/share/enQtMTI1MDM3NDg0MjE0NDQtMDUyMjMzYjY0ZDY5MDUyMjI2NzMzNTg5N2VlYTgzMjExYjU2MjUzMjdkZmVlMDk0Yzg2ODliY2QwYTg2ZWU2NQ'),
  ('onboard_slack_channel_id', ''),
  ('onboard_setup_video', '')
on conflict (key) do nothing;

-- 4. the rundown ticks carried over to the twelve new keys (google, chrome, bookmarks, drive, groups, hub, slack, canva, academy, jd, weekly, phone), once,
--    for live flows that ticked wave275's rundown: rd_profile becomes rd_chrome and rd_drives becomes rd_drive, rd_loom is dropped, and every other key
--    (bookmarks, hub, slack, canva, academy, weekly, and the Hub's own keys such as hire_times_at) stays as it is. A new key that is already set is never
--    overwritten (the old key is still dropped); an old key holding json null carries nothing. Only rows that still hold an old key are written, so a second
--    run changes nothing.
update public.hub_onboard_flows f
   set setup_ticks = (f.setup_ticks - 'rd_profile' - 'rd_drives' - 'rd_loom')
         || case when f.setup_ticks ->> 'rd_profile' is not null and f.setup_ticks ->> 'rd_chrome' is null
                 then jsonb_build_object('rd_chrome', f.setup_ticks -> 'rd_profile') else '{}'::jsonb end
         || case when f.setup_ticks ->> 'rd_drives' is not null and f.setup_ticks ->> 'rd_drive' is null
                 then jsonb_build_object('rd_drive', f.setup_ticks -> 'rd_drives') else '{}'::jsonb end,
       updated_at = now()
 where f.setup_ticks ?| array['rd_profile', 'rd_drives', 'rd_loom'];

-- 5. the Hub-signed-in tick: the Hub page calls this right after sign-in. It ticks rd_hub (the time, as the page's own ticks hold it) on the flow whose
--    wa_email is the signed-in email, only while rd_hub is unset, through wa275_tick_set (the same merge the setup page uses, so no other tick is touched).
create or replace function public.wa278_hub_seen()
returns boolean language plpgsql security definer set search_path to '' as $function$
declare v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', ''))); v_flow bigint; v_ticked boolean := false;
begin
  if v_email = '' then return false; end if;
  for v_flow in select f.id from public.hub_onboard_flows f
                 where lower(trim(f.wa_email)) = v_email and f.setup_ticks ->> 'rd_hub' is null order by f.id loop
    if public.wa275_tick_set(v_flow, 'rd_hub', to_jsonb(to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true) then v_ticked := true; end if;
  end loop;
  return v_ticked;
end $function$;
revoke all on function public.wa278_hub_seen() from public, anon;
grant execute on function public.wa278_hub_seen() to authenticated;
comment on function public.wa278_hub_seen() is 'wave278: called by the Hub page right after sign-in. Sets hub_onboard_flows.setup_ticks.rd_hub (the "Sign in to the Hub" step of the setup page) to the time, on the flow whose wa_email is the signed-in email (auth.jwt() email, any case), only while rd_hub is unset, through wa275_tick_set with p_if_unset. Returns true when a flow was ticked, false otherwise (already ticked, no matching flow, or no email). Touches no other tick and no other flow. Signed-in users only.';

-- 6. the card row (wa275b section 5, replaced in full; only the last four fields are new): the leader decision, the welcome copies, who sent the offer, and
--    the email of the candidate's owner (recruitment), who is copied on the welcome. owner is a name on the roster (as recruit-actions reads it) or an email:
--    an email is used as it is; a name is matched to team_members by name or email, the active row first; a name with no match is null.
create or replace function public.wa275_flow_row(p_flow bigint)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'flow_id', f.id,
    'candidate_id', c.id,
    'status', f.status,
    'practice', f.practice,
    'name', c.name,
    'role', c.role,
    'email', c.email,
    'accepted_on', c.accepted_on,
    'offer_respond_by', c.offer_respond_by,
    'offer_start', c.offer_start,
    'late', coalesce(c.accepted_on > c.offer_respond_by, false),
    'grids', jsonb_build_object(
      'hire', case when exists (select 1 from public.hub_onboard_grids g where g.flow_id = f.id and g.who = 'hire' and cardinality(g.slots) > 0) then 'marked' else 'none' end,
      'manager', case when exists (select 1 from public.hub_onboard_grids g where g.flow_id = f.id and g.who = 'manager' and cardinality(g.slots) > 0) then 'marked' else 'none' end),
    'call_at', f.call_at,
    'one_on_one_at', f.one_on_one_at,
    'manager_member_id', f.manager_member_id,
    'manager_name', m.name,
    'default_manager', case when public.wa271_can() then public.wa271_default_manager(c.id) end,   -- HR only; null for a manager (the function raises for anyone else)
    'other_open_rows', (select count(*) from public.hub_candidates o
                         where o.id <> c.id and nullif(lower(trim(coalesce(c.email, ''))), '') is not null
                           and lower(trim(coalesce(o.email, ''))) = lower(trim(c.email))
                           and o.status not in ('declined', 'withdrawn')),
    'offer_hours', c.offer_hours,
    'hours_confirmed_at', c.hours_confirmed_at,
    'proposed_call_at', f.proposed_call_at,
    'proposed_one_on_one_at', f.proposed_one_on_one_at,
    'proposed_by', f.proposed_by,
    'proposed_at', f.proposed_at,
    'hire_answer', f.hire_answer,
    'hire_answered_at', f.hire_answered_at,
    'ask_availability', f.ask_availability,
    'setup_ticks', f.setup_ticks,
    'welcome_sent_at', f.welcome_sent_at,
    'accounts_at', f.accounts_at,
    'manager_availability_at', w.week -> 'availability_at',
    'manager_no_week', coalesce(w.week -> 'no_week', 'true'::jsonb),
    'manager_week_stale', coalesce(w.week -> 'stale', 'true'::jsonb))
  || jsonb_build_object(   -- Task 6: what the card shows for a manager, who cannot read the flow and step tables themselves
    'offer_sent_at', c.offer_sent_at,
    'created_at', f.created_at,
    'propose_path', (f.status = 'offered' or f.proposed_at is not null
                     or coalesce(f.created_at >= (select case when trim(k.value) ~ '^\d{4}-\d{2}-\d{2}' then trim(k.value)::timestamptz end from public.app_config k where k.key = 'onboard_v2_since'), false)),
    'member_id', c.member_id,
    'wa_email', f.wa_email,
    'canva_link', f.canva_link,
    'roster_created', f.roster_created,
    'slack_channel_id', f.slack_channel_id,
    'onboarding_id', f.onboarding_id,
    'group_session', f.group_session,
    'started_at', f.started_at,
    'updated_at', f.updated_at,
    'steps', coalesce((select jsonb_agg(jsonb_build_object('step', s.step, 'status', s.status, 'detail', s.detail, 'practice', s.practice, 'at', s.at) order by s.step)
                         from public.hub_onboard_steps s where s.flow_id = f.id), '[]'::jsonb),
    'manager_hours', coalesce((select lower(trim(k.value)) = 'on' from public.app_config k where k.key = 'onboard_manager_hours'), false))   -- wave275b
  || jsonb_build_object(   -- wave278
    'leader', f.leader,
    'welcome_cc', to_jsonb(f.welcome_cc),
    'offer_sent_by', c.offer_sent_by,
    'owner_email', case when nullif(trim(coalesce(c.owner, '')), '') is null then null
                        when trim(c.owner) like '%@%' then lower(trim(c.owner))
                        else (select lower(trim(t.email)) from public.team_members t
                               where nullif(trim(coalesce(t.email, '')), '') is not null
                                 and (lower(trim(t.name)) = lower(trim(c.owner)) or lower(trim(t.email)) = lower(trim(c.owner)))
                               order by t.active desc, t.id limit 1) end)
  from public.hub_onboard_flows f
  left join lateral (select public.wa275_week_of(f.manager_member_id) as week) w on f.manager_member_id is not null
  join public.hub_candidates c on c.id = f.candidate_id
  left join public.team_members m on m.id = f.manager_member_id
  where f.id = p_flow
$function$;
revoke all on function public.wa275_flow_row(bigint) from public, anon, authenticated;
comment on function public.wa275_flow_row(bigint) is 'wave275, wave275b, wave278: one flow as the card list shows it (jsonb): everything wave271''s Ready list gave (flow_id, candidate_id, status, practice, name, role, email, accepted_on, offer dates, late, grids, call_at, one_on_one_at, manager_member_id, default_manager, other_open_rows) plus manager_name, offer_hours, hours_confirmed_at, the proposal (proposed_call_at, proposed_one_on_one_at, proposed_by, proposed_at), the answer (hire_answer, hire_answered_at), ask_availability, setup_ticks, welcome_sent_at, accounts_at, and the manager''s week (amended 02/11/26: wa275_week_of, wave276''s typical week): manager_availability_at (when it was saved), manager_no_week and manager_week_stale, (wave275b) manager_hours: app_config onboard_manager_hours is on, so the week limits the times (off or absent: false, the week is information only), and (wave278) leader (the leader decision, null until decided), welcome_cc (the staff copies of the welcome, a json array), offer_sent_by (who pressed Send on the offer) and owner_email (the candidate''s owner as an email: an owner that is an email as it is, a name matched on the roster, the active row first; null when there is no owner or no match). default_manager is HR''s only (null for a manager). Does no access check of its own: only wa271_ready_list and wa275_my_cards call it, after theirs. Not callable from the browser.';
