-- wa157_automations (28/09/26): the CRM's automations (step 5 of the CRM plan, wave157 of the deep dive).
-- An automation starts for one contact when something happens (a form is filled in, a tag is added, a gift is
-- recorded, a serving they signed up for comes near) and runs its steps: send an email, wait, wait until an email is
-- opened (a yes and a no path), add or remove tags, make a task on a team's board, notify team members. Every email
-- goes through mail-send and its rule (queued here, sent by the pump); nothing is sent while mail_mode is test except
-- a test run to the person trying it. Automations are made as drafts; staff with the CRM turn them on (as with
-- campaigns, Steel 27/09/26: anyone with CRM access sends). Replaces Keela's welcome series and donor follow-up.

-- ---------- the automations ----------
create table if not exists public.crm_automations (
  id bigint generated always as identity primary key,
  name text not null check (length(btrim(name)) between 1 and 120),
  description text,
  status text not null default 'draft' check (status in ('draft', 'on', 'paused')),
  trigger jsonb not null default '{}'::jsonb check (jsonb_typeof(trigger) = 'object'),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  turned_on_at timestamptz,
  turned_on_by text,
  paused_at timestamptz,
  paused_by text
);
comment on table public.crm_automations is 'The CRM''s automations (wave157): when something happens to a contact (trigger), the Hub runs the steps for them, one run per contact (crm_automation_runs). status: draft (only a test run on yourself), on (people join as the trigger fires), paused (nobody joins, the runs wait where they are). Staff with the CRM page make, edit and turn them on; turning on checks the steps (crm_automation_problems) and every status change is in change_log. Emails go through mail-send and its rule.';
comment on column public.crm_automations.trigger is 'What starts a run: {"kind": "form", "form_id"} (a submission of that form is processed; any form when form_id is empty), {"kind": "tag", "tag"} (the tag is added to a contact), {"kind": "gift", "first_only", "min_amount"} (a gift dated in the last 7 days is recorded), {"kind": "serving", "days_before", "location", "include_unconfirmed"} (N days before a planned serving they are on the roster for, Confirmed unless include_unconfirmed).';
comment on column public.crm_automations.steps is 'The steps in order, each {"id", "type", ...}: send {"email": "write" or "template", "template_key", "kind" (transactional, volunteer, newsletter, fundraising), "subject", "preheader", "headline", "body", "cta_label", "cta_url", "from" (org or custom), "from_name", "from_email"}; wait {"days"}; wait_open {"step" (an earlier send), "days", "yes", "no" (next, end, or a later step id)}; tag {"add", "remove"}; task {"department", "title", "note", "due_days"}; notify {"to" (team emails), "message"}; end. Texts take {{first_name}}, {{full_name}}, {{email}} and the trigger''s details ({{form_title}}, {{amount}}, {{event_day}}), with a fallback after a bar: {{first_name|there}}.';
comment on column public.crm_automations.settings is 'reentry (true: the same contact can go through it again each time the trigger fires; a gift automation does so by default), notes.';
alter table public.crm_automations enable row level security;
drop policy if exists crm_automations_staff_read on public.crm_automations;
create policy crm_automations_staff_read on public.crm_automations for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_automations_staff_insert on public.crm_automations;
create policy crm_automations_staff_insert on public.crm_automations for insert to authenticated with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and status = 'draft');
drop policy if exists crm_automations_staff_update on public.crm_automations;
create policy crm_automations_staff_update on public.crm_automations for update to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_automations_staff_delete on public.crm_automations;
create policy crm_automations_staff_delete on public.crm_automations for delete to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and status = 'draft');
grant select, insert, update, delete on public.crm_automations to authenticated;
grant usage, select on sequence public.crm_automations_id_seq to authenticated;

-- ---------- the runs: one contact going through one automation ----------
create table if not exists public.crm_automation_runs (
  id bigint generated always as identity primary key,
  automation_id bigint not null references public.crm_automations(id) on delete cascade,
  contact_id bigint not null references public.crm_contacts(id) on delete cascade,
  run_key text not null default 'once',
  status text not null default 'active' check (status in ('active', 'done', 'stopped', 'error')),
  step_id text,
  next_at timestamptz not null default now(),
  wait_until timestamptz,
  send_id bigint,
  is_test boolean not null default false,
  context jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  created_by text,
  unique (automation_id, contact_id, run_key)
);
create index if not exists crm_automation_runs_due_idx on public.crm_automation_runs (next_at) where status = 'active';
create index if not exists crm_automation_runs_contact_idx on public.crm_automation_runs (contact_id);
comment on table public.crm_automation_runs is 'One contact going through one automation (wave157). step_id is the step to run next (empty: the first), next_at when the engine looks again, wait_until the end of a wait, send_id the queued email it waits on. run_key keeps one run per contact (once) unless the automation lets people through again (the trigger''s reference: a form answer, a gift, an event). context holds what started it (form, gift, tag, serving) and the email sent at each step; history is what each step did, in words. is_test marks a test run started with Try it on me (its emails go only to that team member, waits count minutes instead of days, tags, tasks and notices are skipped). Staff with the CRM page read; the functions write.';
alter table public.crm_automation_runs enable row level security;
drop policy if exists crm_automation_runs_staff_read on public.crm_automation_runs;
create policy crm_automation_runs_staff_read on public.crm_automation_runs for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
grant select on public.crm_automation_runs to authenticated;

-- the send log knows which automation, run and step an email came from
alter table public.crm_email_sends add column if not exists automation_id bigint references public.crm_automations(id) on delete set null;
alter table public.crm_email_sends add column if not exists automation_run_id bigint references public.crm_automation_runs(id) on delete set null;
alter table public.crm_email_sends add column if not exists step_id text;
create index if not exists crm_email_sends_automation_idx on public.crm_email_sends (automation_id) where automation_id is not null;
create unique index if not exists crm_email_sends_run_step_uq on public.crm_email_sends (automation_run_id, step_id) where automation_run_id is not null;
comment on column public.crm_email_sends.automation_id is 'The automation that queued this email (wave157), with automation_run_id and step_id; one email per run and step.';

create or replace view public.crm_automation_stats_v with (security_invoker = true) as
  select a.id as automation_id,
         count(r.id) filter (where r.status = 'active' and not r.is_test) as active,
         count(r.id) filter (where r.status = 'done' and not r.is_test) as done,
         count(r.id) filter (where r.status = 'stopped' and not r.is_test) as stopped,
         count(r.id) filter (where r.status = 'error' and not r.is_test) as errors,
         count(r.id) filter (where r.is_test) as tests,
         max(r.started_at) filter (where not r.is_test) as last_started,
         (select count(*) from public.crm_email_sends s where s.automation_id = a.id and not s.is_test and s.sent_at is not null) as emails_sent
    from public.crm_automations a left join public.crm_automation_runs r on r.automation_id = a.id
   group by a.id;
comment on view public.crm_automation_stats_v is 'Per-automation counts (wave157): people in it now, finished, stopped, needing a look, test runs, the last start, and the emails it sent.';
grant select on public.crm_automation_stats_v to authenticated;

-- ---------- helpers ----------
create or replace function public.crm_fill(p_text text, p_vars jsonb)
returns text language plpgsql immutable set search_path to '' as $function$
declare out text := coalesce(p_text, ''); m text[]; v text;
begin
  for m in select regexp_matches(coalesce(p_text, ''), '(\{\{\s*([a-zA-Z0-9_]+)\s*(\|[^}]*)?\}\})', 'g') loop
    v := nullif(btrim(coalesce(p_vars ->> m[2], '')), '');
    out := replace(out, m[1], coalesce(v, substr(coalesce(m[3], '|'), 2)));
  end loop;
  return out;
end $function$;
comment on function public.crm_fill(text, jsonb) is 'Fills {{key}} and {{key|fallback}} in a text from a JSON object of values (wave157: automation task titles and notices; mail-send fills the emails the same way).';

create or replace function public.crm_text_html(p_text text)
returns text language sql immutable set search_path to '' as $function$
  select coalesce(string_agg('<p>' || replace(replace(replace(replace(replace(replace(btrim(p), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;'), E'\n', '<br>') || '</p>', '' order by n), '')
    from regexp_split_to_table(replace(coalesce(p_text, ''), E'\r', ''), E'\\n\\s*\\n') with ordinality t(p, n)
   where btrim(p) <> ''
$function$;
comment on function public.crm_text_html(text) is 'A message typed in the Hub as HTML paragraphs (a blank line starts a paragraph, a line break stays), escaped; the same as the campaign composer (wave157).';

create or replace function public.crm_automation_problems(p_trigger jsonb, p_steps jsonb)
returns text[] language plpgsql stable set search_path to '' as $function$
declare out text[] := '{}'; s jsonb; i int := 0; n int := jsonb_array_length(coalesce(p_steps, '[]'::jsonb)); ids text[] := '{}'; sends text[] := '{}';
  t text; k text; tgt text; j int; acts int := 0; lbl text;
begin
  t := coalesce(p_trigger ->> 'kind', '');
  if t = '' then out := out || 'Pick what starts it.'::text;
  elsif t = 'form' then
    if nullif(p_trigger ->> 'form_id', '') is not null and not exists (select 1 from public.crm_forms f where f.id::text = p_trigger ->> 'form_id') then out := out || 'The form it starts from is gone.'::text; end if;
  elsif t = 'tag' then
    if nullif(btrim(coalesce(p_trigger ->> 'tag', '')), '') is null then out := out || 'Name the tag that starts it.'::text; end if;
  elsif t = 'serving' then
    if coalesce((p_trigger ->> 'days_before')::numeric, 0) not between 1 and 14 then out := out || 'A serving reminder goes 1 to 14 days before.'::text; end if;
  elsif t <> 'gift' then out := out || ('It cannot start on "' || t || '".')::text;
  end if;
  if n = 0 then return out || 'Add at least one step.'::text; end if;
  for j in 0 .. n - 1 loop ids := ids || coalesce(p_steps -> j ->> 'id', ''); end loop;
  for i in 0 .. n - 1 loop
    s := p_steps -> i; k := coalesce(s ->> 'type', ''); lbl := 'Step ' || (i + 1) || ': ';
    if coalesce(s ->> 'id', '') = '' or (select count(*) from unnest(ids) x where x = s ->> 'id') > 1 then out := out || (lbl || 'it needs its own id.')::text; end if;
    if k = 'send' then
      acts := acts + 1; sends := sends || coalesce(s ->> 'id', '');
      if coalesce(s ->> 'kind', '') not in ('transactional', 'volunteer', 'newsletter', 'fundraising') then out := out || (lbl || 'say who can receive the email.')::text; end if;
      if coalesce(s ->> 'email', 'write') = 'template' then
        if not exists (select 1 from public.crm_email_templates e where e.key = s ->> 'template_key' and e.active and e.key <> 'test') then out := out || (lbl || 'the saved email is missing or switched off.')::text; end if;
      else
        if nullif(btrim(coalesce(s ->> 'subject', '')), '') is null then out := out || (lbl || 'the email needs a subject.')::text; end if;
        if nullif(btrim(coalesce(s ->> 'body', '')), '') is null then out := out || (lbl || 'the email needs a message.')::text; end if;
        if position('[Paste' in coalesce(s ->> 'subject', '') || coalesce(s ->> 'body', '') || coalesce(s ->> 'headline', '')) > 0 then out := out || (lbl || 'the email still has a [Paste ...] note: put the real words in.')::text; end if;
        if nullif(s ->> 'cta_url', '') is not null and (s ->> 'cta_url') !~ '^https://' then out := out || (lbl || 'the button link must start with https://.')::text; end if;
      end if;
      if coalesce(s ->> 'from', 'org') = 'custom' and coalesce(s ->> 'from_email', '') !~* '^[^@\s]+@welfareavenue\.com$' then out := out || (lbl || 'the sender must be an @welfareavenue.com address.')::text; end if;
    elsif k = 'wait' then
      if coalesce((s ->> 'days')::numeric, 0) <= 0 or (s ->> 'days')::numeric > 90 then out := out || (lbl || 'a wait is more than 0 and at most 90 days.')::text; end if;
    elsif k = 'wait_open' then
      if not (coalesce(s ->> 'step', '') = any(sends)) then out := out || (lbl || 'pick an earlier email to watch.')::text; end if;
      if coalesce((s ->> 'days')::numeric, 0) not between 1 and 30 then out := out || (lbl || 'wait 1 to 30 days for the open.')::text; end if;
      foreach tgt in array array[coalesce(s ->> 'yes', 'next'), coalesce(s ->> 'no', 'next')] loop
        if tgt not in ('next', 'end') and not (tgt = any(ids[i + 2 : n])) then out := out || (lbl || 'a path can only go to a later step, the next one or the end.')::text; end if;
      end loop;
    elsif k = 'tag' then
      acts := acts + 1;
      if coalesce(jsonb_array_length(s -> 'add'), 0) + coalesce(jsonb_array_length(s -> 'remove'), 0) = 0 then out := out || (lbl || 'name a tag to add or remove.')::text; end if;
    elsif k = 'task' then
      acts := acts + 1;
      if not exists (select 1 from public.dept_meta d where d.department = s ->> 'department') then out := out || (lbl || 'pick the team whose board gets the task.')::text; end if;
      if nullif(btrim(coalesce(s ->> 'title', '')), '') is null then out := out || (lbl || 'the task needs a title.')::text; end if;
    elsif k = 'notify' then
      acts := acts + 1;
      if not exists (select 1 from jsonb_array_elements_text(coalesce(s -> 'to', '[]'::jsonb)) e join public.team_members m on lower(m.email) = lower(btrim(e)) and coalesce(m.active, true)) then out := out || (lbl || 'pick at least one team member to notify.')::text; end if;
      if nullif(btrim(coalesce(s ->> 'message', '')), '') is null then out := out || (lbl || 'the notice needs a message.')::text; end if;
    elsif k <> 'end' then out := out || (lbl || 'unknown step "' || k || '".')::text;
    end if;
  end loop;
  if acts = 0 then out := out || 'It needs at least one step that does something (an email, a tag, a task or a notice).'::text; end if;
  return out;
end $function$;
comment on function public.crm_automation_problems(jsonb, jsonb) is 'What stops an automation from being turned on, in words (wave157): the trigger, each step''s fields, a [Paste ...] note left in an email, paths that go backwards. Empty when it is ready. The Automations tab shows it; crm_automations_stamp enforces it.';
grant execute on function public.crm_automation_problems(jsonb, jsonb) to authenticated;

-- ---------- status changes: the checks, stamps, change_log ----------
create or replace function public.crm_automations_stamp()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare who text := coalesce(nullif(lower(auth.jwt() ->> 'email'), ''), new.updated_by, 'staff'); p text[];
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'on' then
      p := public.crm_automation_problems(new.trigger, new.steps);
      if cardinality(p) > 0 then raise exception 'Not ready to turn on: %', array_to_string(p, ' '); end if;
      new.turned_on_at := now(); new.turned_on_by := who; new.paused_at := null;
    elsif new.status = 'paused' then
      new.paused_at := now(); new.paused_by := who;
    elsif new.status = 'draft' and old.status <> 'draft' then
      raise exception 'An automation that has been on can be paused, not made a draft again.';
    end if;
    begin
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('crm_automation', new.id::text, 'status', old.status, new.status || ' (' || new.name || ')', who);
    exception when others then null; end;
  end if;
  return new;
end $function$;
revoke execute on function public.crm_automations_stamp() from public, anon, authenticated;
drop trigger if exists crm_automations_stamp on public.crm_automations;
create trigger crm_automations_stamp before update on public.crm_automations for each row execute function public.crm_automations_stamp();
comment on function public.crm_automations_stamp() is 'Trigger on crm_automations (wave157): updated_at; turning on runs crm_automation_problems and refuses with the reasons; turned_on_at/by and paused_at/by; a change_log line for every status change.';

-- ---------- joining: one run per contact (or per trigger when people may go through again) ----------
create or replace function public.crm_automation_enroll(p_automation_id bigint, p_contact_id bigint, p_key text, p_context jsonb, p_test boolean default false, p_by text default null)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare a record; cid bigint := p_contact_id; nxt bigint; rid bigint; i int;
begin
  select * into a from public.crm_automations where id = p_automation_id;
  if not found or (a.status <> 'on' and not p_test) then return null; end if;
  for i in 1 .. 5 loop
    select merged_into into nxt from public.crm_contacts where id = cid;
    exit when nxt is null; cid := nxt;
  end loop;
  if not exists (select 1 from public.crm_contacts where id = cid and merged_into is null) then return null; end if;
  insert into public.crm_automation_runs (automation_id, contact_id, run_key, context, is_test, created_by, next_at, history)
  values (a.id, cid, coalesce(nullif(p_key, ''), 'once'), coalesce(p_context, '{}'::jsonb), coalesce(p_test, false), coalesce(p_by, 'automation'), now(),
          jsonb_build_array(jsonb_build_object('at', now(), 'type', 'start', 'note', coalesce(p_context ->> 'why', 'Joined'))))
  on conflict (automation_id, contact_id, run_key) do nothing
  returning id into rid;
  return rid;
end $function$;
revoke execute on function public.crm_automation_enroll(bigint, bigint, text, jsonb, boolean, text) from public, anon, authenticated;
comment on function public.crm_automation_enroll(bigint, bigint, text, jsonb, boolean, text) is 'Starts one run (wave157): only for an automation that is on (or a test run), following merges to the kept contact, once per run_key (on conflict nothing). Called by the trigger functions and crm_automation_try; service role only.';

create or replace function public.crm_auto_on_form()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare a record; f record;
begin
  if new.status <> 'processed' or old.status is not distinct from new.status or new.is_test or new.contact_id is null then return new; end if;
  if coalesce(current_setting('wa.no_automations', true), '') = 'on' then return new; end if;
  select id, title, slug into f from public.crm_forms where id = new.form_id;
  for a in select * from public.crm_automations where status = 'on' and trigger ->> 'kind' = 'form' and (nullif(trigger ->> 'form_id', '') is null or trigger ->> 'form_id' = new.form_id::text) loop
    perform public.crm_automation_enroll(a.id, new.contact_id,
      case when coalesce((a.settings ->> 'reentry')::boolean, false) then 'form:' || new.id else 'once' end,
      jsonb_build_object('trigger', 'form', 'form_id', new.form_id, 'submission_id', new.id, 'form_title', f.title, 'why', 'Filled in "' || coalesce(f.title, 'a form') || '"'));
  end loop;
  return new;
exception when others then return new;
end $function$;
revoke execute on function public.crm_auto_on_form() from public, anon, authenticated;
drop trigger if exists crm_auto_on_form on public.crm_form_submissions;
create trigger crm_auto_on_form after update of status on public.crm_form_submissions for each row execute function public.crm_auto_on_form();
comment on function public.crm_auto_on_form() is 'Trigger on crm_form_submissions (wave157): a real answer that reaches processed starts the automations that listen to that form (or to any form). Never fails the submission; skipped when the session sets wa.no_automations.';

create or replace function public.crm_auto_on_tags()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare a record; added text[];
begin
  if new.merged_into is not null or coalesce(current_setting('wa.no_automations', true), '') = 'on' then return new; end if;
  select coalesce(array_agg(distinct lower(btrim(x))), '{}') into added from unnest(coalesce(new.tags, '{}')) x
   where btrim(x) <> '' and (tg_op = 'INSERT' or not (lower(btrim(x)) = any(select lower(btrim(y)) from unnest(coalesce(old.tags, '{}')) y)));
  if cardinality(added) = 0 then return new; end if;
  for a in select * from public.crm_automations where status = 'on' and trigger ->> 'kind' = 'tag' and lower(btrim(coalesce(trigger ->> 'tag', ''))) = any(added) loop
    perform public.crm_automation_enroll(a.id, new.id,
      case when coalesce((a.settings ->> 'reentry')::boolean, false) then 'tag:' || extract(epoch from now())::bigint else 'once' end,
      jsonb_build_object('trigger', 'tag', 'tag', a.trigger ->> 'tag', 'why', 'Tagged ' || (a.trigger ->> 'tag')));
  end loop;
  return new;
exception when others then return new;
end $function$;
revoke execute on function public.crm_auto_on_tags() from public, anon, authenticated;
drop trigger if exists crm_auto_on_tags on public.crm_contacts;
create trigger crm_auto_on_tags after insert or update of tags on public.crm_contacts for each row execute function public.crm_auto_on_tags();
comment on function public.crm_auto_on_tags() is 'Trigger on crm_contacts (wave157): a tag that was not there before starts the automations listening to it. Never fails the change; an import sets wa.no_automations to stay quiet.';

create or replace function public.crm_auto_on_gift()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare a record;
begin
  if new.contact_id is null or new.donated_at is null or new.donated_at < now() - interval '7 days' then return new; end if;
  if coalesce(current_setting('wa.no_automations', true), '') = 'on' then return new; end if;
  for a in select * from public.crm_automations where status = 'on' and trigger ->> 'kind' = 'gift' loop
    if nullif(a.trigger ->> 'min_amount', '') is not null and coalesce(new.amount, 0) < (a.trigger ->> 'min_amount')::numeric then continue; end if;
    if coalesce((a.trigger ->> 'first_only')::boolean, false) and exists (select 1 from public.crm_donations d where d.contact_id = new.contact_id and d.id <> new.id and d.donated_at <= new.donated_at) then continue; end if;
    perform public.crm_automation_enroll(a.id, new.contact_id,
      case when coalesce((a.settings ->> 'reentry')::boolean, true) then 'gift:' || new.id else 'once' end,
      jsonb_build_object('trigger', 'gift', 'donation_id', new.id, 'amount', to_char(coalesce(new.amount, 0), 'FM$999,999,990.00'),
        'gift_date', to_char((new.donated_at at time zone 'America/Toronto')::date, 'FMDD Mon YYYY'),
        'gift_date_line', ' on ' || to_char((new.donated_at at time zone 'America/Toronto')::date, 'FMDD Mon YYYY'),
        'campaign', new.campaign, 'why', 'Gave ' || to_char(coalesce(new.amount, 0), 'FM$999,999,990.00')));
  end loop;
  return new;
exception when others then return new;
end $function$;
revoke execute on function public.crm_auto_on_gift() from public, anon, authenticated;
drop trigger if exists crm_auto_on_gift on public.crm_donations;
create trigger crm_auto_on_gift after insert on public.crm_donations for each row execute function public.crm_auto_on_gift();
comment on function public.crm_auto_on_gift() is 'Trigger on crm_donations (wave157): a gift dated in the last 7 days starts the gift automations (a minimum amount, first gifts only); an import of older gifts starts nothing. Never fails the insert.';

create or replace function public.crm_automation_scan_servings()
returns int language plpgsql security definer set search_path to '' as $function$
declare a record; r record; n int := 0; today date := (now() at time zone 'America/Toronto')::date; loc text; rolename text;
begin
  for a in select * from public.crm_automations where status = 'on' and trigger ->> 'kind' = 'serving' loop
    loc := coalesce(nullif(a.trigger ->> 'location', ''), 'Montreal');
    for r in select ro.id as roster_id, ro.role, ro.status, e.id as event_id, e.event_date, e.title, e.code, e.location, c.id as contact_id
               from public.event_roster ro
               join public.volunteer_events e on e.id = ro.event_id
               join public.crm_contacts c on c.volunteer_id = ro.person_id and c.merged_into is null
              where e.status = 'planned' and lower(coalesce(e.kind, '')) = 'service'
                and (loc = 'any' or e.location = loc)
                and e.event_date > today and e.event_date <= today + coalesce((a.trigger ->> 'days_before')::int, 2)
                and (ro.status = 'Confirmed' or (coalesce((a.trigger ->> 'include_unconfirmed')::boolean, false) and ro.status in ('TBD', 'Waiting For Response')))
    loop
      rolename := lower(replace(coalesce(nullif(r.role, ''), 'volunteer'), '_', ' '));
      if public.crm_automation_enroll(a.id, r.contact_id, 'event:' || r.event_id,
           jsonb_build_object('trigger', 'serving', 'event_id', r.event_id, 'roster_id', r.roster_id,
             'event_day', trim(to_char(r.event_date, 'FMDay')), 'event_when', trim(to_char(r.event_date, 'FMDay FMDD FMMonth YYYY')),
             'event_title', coalesce(nullif(r.title, ''), 'the serving on ' || trim(to_char(r.event_date, 'FMDay FMDD FMMonth'))),
             'role', case when rolename ~ '^[aeiou]' then 'an ' else 'a ' end || rolename,
             'why', 'On the roster for ' || to_char(r.event_date, 'FMDD Mon'))) is not null then n := n + 1; end if;
    end loop;
  end loop;
  return n;
end $function$;
revoke execute on function public.crm_automation_scan_servings() from public, anon, authenticated;
comment on function public.crm_automation_scan_servings() is 'Starts the serving-reminder automations (wave157): everyone on the roster of a planned serving (Confirmed, or also TBD and waiting when the trigger says so) whose date is within the trigger''s days_before, once per event. Run by crm_automation_tick.';

-- ---------- the engine ----------
create or replace function public.crm_automation_advance(p_run_id bigint)
returns text language plpgsql security definer set search_path to '' as $function$
declare
  r record; a record; c record; s jsonb; steps jsonb; n int; i int; guard int := 0; k text; sid text; note text; nxt text;
  cfg jsonb; live boolean; tests text[]; toronto timestamp; vars jsonb; perm record; em text; tpl text; kind text; ins bigint;
  snd record; opened boolean; addt text[]; remt text[]; dept text; m record; tgt text; days numeric; unit interval; ctxv jsonb; tvars jsonb; fname text;
begin
  select * into r from public.crm_automation_runs where id = p_run_id for update;
  if not found or r.status <> 'active' then return 'not active'; end if;
  select * into a from public.crm_automations where id = r.automation_id;
  if not found then update public.crm_automation_runs set status = 'stopped', finished_at = now(), updated_at = now() where id = r.id; return 'automation gone'; end if;
  if a.status <> 'on' and not r.is_test then return 'waiting: the automation is ' || a.status; end if;
  steps := a.steps; n := jsonb_array_length(steps);
  select jsonb_object_agg(key, value) into cfg from public.app_config where key like 'mail_%';
  live := coalesce(cfg ->> 'mail_mode', 'test') = 'live';
  tests := coalesce((select array_agg(lower(btrim(x))) from regexp_split_to_table(coalesce(cfg ->> 'mail_test_recipients', ''), '[,;\s]+') x where btrim(x) <> ''), '{}');
  unit := case when r.is_test then interval '1 minute' else interval '1 day' end;
  loop
    guard := guard + 1;
    if guard > 30 then update public.crm_automation_runs set next_at = now() + interval '1 minute', updated_at = now() where id = r.id; return 'yield'; end if;
    select * into c from public.crm_contacts where id = r.contact_id;
    -- where are we
    if r.step_id is null then i := 0;
    else
      select o - 1 into i from jsonb_array_elements(steps) with ordinality t(x, o) where x ->> 'id' = r.step_id limit 1;
      if i is null then
        update public.crm_automation_runs set status = 'stopped', finished_at = now(), updated_at = now(), step_id = null,
          history = history || jsonb_build_array(jsonb_build_object('at', now(), 'type', 'stop', 'note', 'The step it was on was removed, so it stopped here.'))
        where id = r.id;
        return 'step removed';
      end if;
    end if;
    if i >= n then
      update public.crm_automation_runs set status = 'done', finished_at = now(), updated_at = now(), step_id = null, wait_until = null, send_id = null,
        history = history || jsonb_build_array(jsonb_build_object('at', now(), 'type', 'end', 'note', 'Finished'))
      where id = r.id;
      return 'done';
    end if;
    s := steps -> i; k := coalesce(s ->> 'type', ''); sid := s ->> 'id';
    nxt := case when i + 1 < n then steps -> (i + 1) ->> 'id' else '__end' end;
    note := null; tgt := null;
    -- the trigger's details go into every text; the contact's own fields are added by mail-send for emails, here for tasks and notices
    ctxv := jsonb_strip_nulls(coalesce(r.context, '{}'::jsonb) - 'sends' - 'why' - 'test_to' - 'sample') || jsonb_build_object('automation', a.name);
    fname := coalesce(nullif(btrim(c.first_name), ''), case when coalesce(c.full_name, '') ~* '^\s*(\(no name\))?\s*$' then null else split_part(btrim(c.full_name), ' ', 1) end);
    vars := ctxv || jsonb_strip_nulls(jsonb_build_object('first_name', fname, 'full_name', c.full_name, 'email', coalesce(c.primary_email, c.emails[1]), 'phone', c.phones[1],
      'contact_url', 'https://hub.welfareavenue.com/#crm/c/' || c.id));
    -- a task's text must not carry an email address: an @ there reads as a mention of a team member
    tvars := vars || jsonb_strip_nulls(jsonb_build_object('email', replace(coalesce(c.primary_email, c.emails[1]), '@', ' at ')));

    if k = 'send' then
      if r.send_id is not null then
        select * into snd from public.crm_email_sends where id = r.send_id;
        if found and snd.status in ('queued', 'sending') and snd.created_at > now() - interval '3 days' then
          update public.crm_automation_runs set next_at = now() + interval '1 minute', updated_at = now() where id = r.id; return 'waiting for the send';
        end if;
        if found and snd.status in ('queued', 'sending') then
          update public.crm_email_sends set status = 'cancelled', claimed_at = null, error = 'not sent within 3 days' where id = snd.id;
          note := 'Not sent within 3 days (the daily cap or the mail engine), so it moved on.';
        elsif not found then note := 'The email''s record is gone.';
        elsif snd.sent_at is not null then note := 'Sent "' || coalesce(snd.subject, s ->> 'subject', 'an email') || '"';
        elsif snd.status = 'suppressed' then note := 'Not sent: ' || coalesce(snd.permission_basis, 'the permission rule said no');
        else note := 'Not sent (' || snd.status || '): ' || coalesce(snd.error, 'no detail');
        end if;
        tgt := 'next';
      else
        toronto := now() at time zone 'America/Toronto';
        if not r.is_test and (extract(hour from toronto) < 8 or extract(hour from toronto) >= 20) then
          update public.crm_automation_runs set next_at = ((case when extract(hour from toronto) >= 20 then toronto::date + 1 else toronto::date end) + time '08:00') at time zone 'America/Toronto', updated_at = now()
           where id = r.id;
          return 'quiet hours';
        end if;
        kind := coalesce(nullif(s ->> 'kind', ''), 'transactional');
        tpl := case when coalesce(s ->> 'email', 'write') = 'template' then coalesce(s ->> 'template_key', 'welcome_volunteer') else 'newsletter' end;
        select * into perm from public.crm_email_permission(c.id, kind) limit 1;
        em := lower(btrim(coalesce(perm.email, c.primary_email, c.emails[1], '')));
        if r.is_test then em := lower(btrim(coalesce(r.context ->> 'test_to', em))); end if;
        if em = '' then note := 'Not sent: no email address.';
        elsif not r.is_test and not coalesce(perm.allowed, false) then note := 'Not sent: ' || coalesce(perm.basis, 'the permission rule said no');
        elsif not live and not (em = any(tests)) and not (r.is_test and em ~ '@welfareavenue\.com$') then note := 'Not sent: the Hub is in test mode (only test addresses get email).';
        else
          insert into public.crm_email_sends (contact_id, to_email, template_key, kind, status, is_test, permission_basis, automation_id, automation_run_id, step_id, subject, meta, created_by)
          values (c.id, em, tpl, kind, 'queued', r.is_test, case when r.is_test then 'test run of automation ' || a.id else coalesce(perm.basis, 'automation') end, a.id, r.id, sid,
                  case when tpl = 'newsletter' then public.crm_fill(s ->> 'subject', vars) end,
                  jsonb_build_object('automation', a.name, 'step', sid, 'caller', 'automation:' || a.id,
                    'content', jsonb_build_object('template_key', tpl, 'kind', kind,
                      'subject', case when tpl = 'newsletter' then s ->> 'subject' end, 'preheader', case when tpl = 'newsletter' then s ->> 'preheader' end,
                      'vars', ctxv || case when tpl = 'newsletter' then jsonb_build_object('headline', coalesce(s ->> 'headline', ''), 'body_text', coalesce(s ->> 'body', ''),
                                'body_html', public.crm_text_html(s ->> 'body'), 'cta_label', coalesce(nullif(s ->> 'cta_label', ''), 'Visit welfareavenue.com'),
                                'cta_url', coalesce(nullif(s ->> 'cta_url', ''), 'https://welfareavenue.com')) else '{}'::jsonb end,
                      'sender', case when coalesce(s ->> 'from', 'org') = 'custom' then jsonb_build_object('name', s ->> 'from_name', 'email', lower(s ->> 'from_email')) else null end)),
                  'automation:' || a.id)
          on conflict (automation_run_id, step_id) where automation_run_id is not null do nothing
          returning id into ins;
          if ins is null then select id into ins from public.crm_email_sends where automation_run_id = r.id and step_id = sid; end if;
          update public.crm_automation_runs set send_id = ins, next_at = now() + interval '1 minute', updated_at = now(),
            context = jsonb_set(context, '{sends}', coalesce(context -> 'sends', '{}'::jsonb) || jsonb_build_object(sid, ins))
           where id = r.id;
          return 'queued';
        end if;
        tgt := 'next';
      end if;

    elsif k = 'wait' then
      days := greatest(coalesce((s ->> 'days')::numeric, 1), 0.01);
      if r.wait_until is null then
        update public.crm_automation_runs set wait_until = now() + unit * days, next_at = now() + unit * days, updated_at = now() where id = r.id;
        return 'waiting';
      elsif now() < r.wait_until then
        update public.crm_automation_runs set next_at = r.wait_until, updated_at = now() where id = r.id; return 'waiting';
      end if;
      note := 'Waited ' || trim(to_char(days, 'FM999990.##')) || case when r.is_test then ' minute(s) (a test)' when days = 1 then ' day' else ' days' end;
      tgt := 'next';

    elsif k = 'wait_open' then
      days := greatest(coalesce((s ->> 'days')::numeric, 3), 1);
      if r.wait_until is null then
        update public.crm_automation_runs set wait_until = now() + unit * days, next_at = now() + least(unit * days, interval '30 minutes'), updated_at = now() where id = r.id;
        r.wait_until := now() + unit * days;
      end if;
      select exists (select 1 from public.crm_email_sends e where e.id = nullif(r.context -> 'sends' ->> (s ->> 'step'), '')::bigint and e.opened_at is not null) into opened;
      if opened then note := 'Opened the email: took the yes path'; tgt := coalesce(nullif(s ->> 'yes', ''), 'next');
      elsif now() >= r.wait_until then note := 'Did not open the email in ' || trim(to_char(days, 'FM999990.##')) || case when r.is_test then ' minute(s): took the no path' else ' days: took the no path' end; tgt := coalesce(nullif(s ->> 'no', ''), 'next');
      else
        update public.crm_automation_runs set next_at = least(r.wait_until, now() + case when r.is_test then interval '1 minute' else interval '30 minutes' end), updated_at = now() where id = r.id;
        return 'watching for the open';
      end if;

    elsif k = 'tag' then
      addt := coalesce((select array_agg(distinct lower(btrim(x))) from jsonb_array_elements_text(coalesce(s -> 'add', '[]'::jsonb)) x where btrim(x) <> ''), '{}');
      remt := coalesce((select array_agg(distinct lower(btrim(x))) from jsonb_array_elements_text(coalesce(s -> 'remove', '[]'::jsonb)) x where btrim(x) <> ''), '{}');
      if r.is_test then note := 'Tags skipped in a test (' || array_to_string(addt || remt, ', ') || ')';
      else
        update public.crm_contacts cc set tags = (select coalesce(array_agg(q.x order by lower(q.x)), '{}') from (
                 select y as x from unnest(coalesce(cc.tags, '{}')) y where not (lower(btrim(y)) = any(remt))
                 union
                 select t2 from unnest(addt) t2 where not exists (select 1 from unnest(coalesce(cc.tags, '{}')) z where lower(btrim(z)) = t2)) q),
               updated_by = 'automation:' || a.id
         where cc.id = c.id;
        note := concat_ws('; ', case when cardinality(addt) > 0 then 'Tagged ' || array_to_string(addt, ', ') end, case when cardinality(remt) > 0 then 'Untagged ' || array_to_string(remt, ', ') end);
      end if;
      tgt := 'next';

    elsif k = 'task' then
      select coalesce(nullif(label, ''), department) into dept from public.dept_meta where department = s ->> 'department';
      if r.is_test then note := 'Task skipped in a test: "' || public.crm_fill(s ->> 'title', tvars) || '" for ' || coalesce(dept, s ->> 'department');
      else
        insert into public.dept_tasks (department, subsection, title, description, status, done, due_date, updated_by, updated_at)
        values (s ->> 'department', 'General', left(public.crm_fill(s ->> 'title', tvars), 300),
                btrim(concat_ws(E'\n\n', nullif(public.crm_fill(s ->> 'note', tvars), ''), 'From the CRM automation "' || a.name || '" for ' || coalesce(c.full_name, 'a contact') || ': https://hub.welfareavenue.com/#crm/c/' || c.id)),
                'Open', false, (now() at time zone 'America/Toronto')::date + coalesce((s ->> 'due_days')::int, 3), 'CRM automation: ' || a.name, now())
        returning id into ins;
        note := 'Task made for ' || coalesce(dept, s ->> 'department') || ': "' || public.crm_fill(s ->> 'title', tvars) || '"';
      end if;
      tgt := 'next';

    elsif k = 'notify' then
      if r.is_test then note := 'Notice skipped in a test (to ' || coalesce((select string_agg(x, ', ') from jsonb_array_elements_text(coalesce(s -> 'to', '[]'::jsonb)) x), 'nobody') || ')';
      else
        note := '';
        for m in select distinct on (lower(tm.email)) tm.id, tm.name, lower(tm.email) as email
                   from jsonb_array_elements_text(coalesce(s -> 'to', '[]'::jsonb)) e join public.team_members tm on lower(tm.email) = lower(btrim(e)) and coalesce(tm.active, true) loop
          insert into public.hub_mentions (from_email, from_name, to_member_id, to_name, to_email, kind, ref_id, ref_title, snippet, url, private, source_table, source_id)
          values ('crm@welfareavenue.com', 'The CRM', m.id, m.name, m.email, 'crm', a.id, a.name, left(public.crm_fill(s ->> 'message', vars), 600), '#crm/c/' || c.id, false, 'crm_automation_runs', r.id);
          note := note || case when note = '' then '' else ', ' end || coalesce(m.name, m.email);
        end loop;
        note := case when note = '' then 'Nobody to notify (no active team member)' else 'Notified ' || note end;
      end if;
      tgt := 'next';

    elsif k = 'end' then
      tgt := 'end'; note := 'Reached the end';
    else
      tgt := 'next'; note := 'Skipped an unknown step';
    end if;

    -- record and move
    if tgt = 'end' then nxt := '__end';
    elsif tgt <> 'next' then nxt := tgt;
    end if;
    update public.crm_automation_runs
       set history = case when jsonb_array_length(history) >= 80 then history - 1 else history end || jsonb_build_array(jsonb_build_object('at', now(), 'step', sid, 'type', k, 'note', note)),
           step_id = case when nxt = '__end' then '__end' else nxt end, wait_until = null, send_id = null, next_at = now(), updated_at = now()
     where id = r.id
     returning * into r;
    if r.step_id = '__end' then
      update public.crm_automation_runs set status = 'done', finished_at = now(), step_id = null,
        history = history || jsonb_build_array(jsonb_build_object('at', now(), 'type', 'end', 'note', 'Finished'))
       where id = r.id;
      return 'done';
    end if;
  end loop;
end $function$;
revoke execute on function public.crm_automation_advance(bigint) from public, anon, authenticated;
comment on function public.crm_automation_advance(bigint) is 'Runs one contact''s automation as far as it can go now (wave157): a send queues one email in crm_email_sends (after the permission rule and the mode: in test mode only test addresses, or the team member''s own address in a test run) and waits for mail-send to send it; emails go out between 8 am and 8 pm Toronto; waits count days (minutes in a test run); wait_open takes the yes path when the email was opened; tags, tasks on a team''s board (dept_tasks) and notices (hub_mentions, which DM on Slack) are skipped in a test run. Every step writes a line of history.';

create or replace function public.crm_automation_tick(p_limit int default 100)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r record; joined int := 0; ran int := 0; failed int := 0; res text;
begin
  if exists (select 1 from public.crm_automations where status = 'on' and trigger ->> 'kind' = 'serving') then joined := public.crm_automation_scan_servings(); end if;
  for r in select ru.id from public.crm_automation_runs ru join public.crm_automations a on a.id = ru.automation_id
            where ru.status = 'active' and ru.next_at <= now() and (a.status = 'on' or ru.is_test)
            order by ru.next_at limit greatest(p_limit, 1)
  loop
    begin
      res := public.crm_automation_advance(r.id); ran := ran + 1;
    exception when others then
      failed := failed + 1;
      update public.crm_automation_runs set status = 'error', error = left(sqlerrm, 400), updated_at = now(),
        history = history || jsonb_build_array(jsonb_build_object('at', now(), 'type', 'error', 'note', 'Stopped on an error: ' || left(sqlerrm, 200)))
       where id = r.id;
    end;
  end loop;
  return jsonb_build_object('joined', joined, 'ran', ran, 'failed', failed);
end $function$;
revoke execute on function public.crm_automation_tick(int) from public, anon, authenticated;
comment on function public.crm_automation_tick(int) is 'The automations'' clock (wave157, cron wa-crm-automations every minute): starts the serving reminders that are due, then advances every run whose time has come (of an automation that is on, or a test run); a run that fails is marked error with the reason and the others go on.';

-- ---------- staff actions ----------
create or replace function public.crm_automation_try(p_automation_id bigint)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare me text := lower(coalesce(auth.jwt() ->> 'email', '')); cid bigint; a record; ctx jsonb; ev record; rid bigint;
begin
  if not (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) then raise exception 'The CRM is for the Welfare Avenue team.'; end if;
  select * into a from public.crm_automations where id = p_automation_id;
  if not found then raise exception 'No such automation.'; end if;
  select c.id into cid from public.crm_contacts c
   where c.merged_into is null and (lower(btrim(c.primary_email)) = me or exists (select 1 from unnest(c.emails) x where lower(btrim(x)) = me))
   order by (lower(btrim(c.primary_email)) = me) desc, c.id limit 1;
  if cid is null then raise exception 'You need a contact in the CRM with your address (%) to try it on yourself.', me; end if;
  ctx := jsonb_build_object('trigger', coalesce(a.trigger ->> 'kind', ''), 'sample', true, 'test_to', me, 'why', 'Test run started by ' || me);
  if a.trigger ->> 'kind' = 'form' then
    ctx := ctx || jsonb_build_object('form_title', coalesce((select title from public.crm_forms where id::text = a.trigger ->> 'form_id'), 'a form'));
  elsif a.trigger ->> 'kind' = 'gift' then
    ctx := ctx || jsonb_build_object('amount', '$25.00', 'gift_date', to_char((now() at time zone 'America/Toronto')::date, 'FMDD Mon YYYY'), 'gift_date_line', ' on ' || to_char((now() at time zone 'America/Toronto')::date, 'FMDD Mon YYYY'));
  elsif a.trigger ->> 'kind' = 'serving' then
    select id, event_date, title into ev from public.volunteer_events where status = 'planned' and lower(coalesce(kind, '')) = 'service' and event_date > (now() at time zone 'America/Toronto')::date order by event_date limit 1;
    if found then ctx := ctx || jsonb_build_object('event_day', trim(to_char(ev.event_date, 'FMDay')), 'event_when', trim(to_char(ev.event_date, 'FMDay FMDD FMMonth YYYY')),
      'event_title', coalesce(nullif(ev.title, ''), 'the serving on ' || trim(to_char(ev.event_date, 'FMDay FMDD FMMonth'))), 'role', 'a server'); end if;
  elsif a.trigger ->> 'kind' = 'tag' then ctx := ctx || jsonb_build_object('tag', a.trigger ->> 'tag');
  end if;
  rid := public.crm_automation_enroll(a.id, cid, 'test:' || extract(epoch from clock_timestamp())::bigint || ':' || floor(random() * 1000)::int, ctx, true, me);
  return rid;
end $function$;
revoke execute on function public.crm_automation_try(bigint) from public, anon;
grant execute on function public.crm_automation_try(bigint) to authenticated;
comment on function public.crm_automation_try(bigint) is 'Try it on me (wave157): a test run of any automation (a draft too) on the caller''s own contact: its emails go only to the caller''s address (allowed in test mode for a team or test address), marked as tests; each day of waiting is a minute; tags, tasks and notices are only described. Staff with the CRM page.';

create or replace function public.crm_automation_stop(p_run_id bigint)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare me text := lower(coalesce(auth.jwt() ->> 'email', 'staff'));
begin
  if not (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) then raise exception 'The CRM is for the Welfare Avenue team.'; end if;
  update public.crm_email_sends set status = 'cancelled', claimed_at = null, error = 'the run was stopped by ' || me where automation_run_id = p_run_id and status = 'queued';
  update public.crm_automation_runs set status = 'stopped', finished_at = now(), updated_at = now(), send_id = null,
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'type', 'stop', 'note', 'Stopped by ' || me))
   where id = p_run_id and status in ('active', 'error');
  return found;
end $function$;
revoke execute on function public.crm_automation_stop(bigint) from public, anon;
grant execute on function public.crm_automation_stop(bigint) to authenticated;
comment on function public.crm_automation_stop(bigint) is 'Stops one person''s run (wave157), cancelling its email still waiting in the queue. Staff with the CRM page.';

-- ---------- the send queue: automations first, then campaigns ----------
create or replace function public.crm_claim_queued(p_limit integer)
returns setof public.crm_email_sends language sql set search_path to '' as $function$
  with stale as (
    update public.crm_email_sends set status = 'queued', claimed_at = null
    where status = 'sending' and claimed_at < now() - interval '10 minutes' and campaign_id is not null returning id
  ), picked as (
    select id from public.crm_email_sends where status = 'queued' and campaign_id is not null order by id limit greatest(p_limit, 0) for update skip locked
  )
  update public.crm_email_sends s set status = 'sending', claimed_at = now() from picked where s.id = picked.id returning s.*
$function$;
comment on function public.crm_claim_queued(integer) is 'mail-send v6''s claim (wave155), campaign rows only since wave157 so an older pump never touches an automation''s email.';
create or replace function public.crm_claim_queued(p_limit integer, p_source text)
returns setof public.crm_email_sends language sql set search_path to '' as $function$
  with stale as (
    update public.crm_email_sends set status = 'queued', claimed_at = null
    where status = 'sending' and claimed_at < now() - interval '10 minutes'
      and case p_source when 'automation' then automation_run_id is not null when 'campaign' then campaign_id is not null else true end returning id
  ), picked as (
    select id from public.crm_email_sends where status = 'queued'
      and case p_source when 'automation' then automation_run_id is not null when 'campaign' then campaign_id is not null else true end
     order by id limit greatest(p_limit, 0) for update skip locked
  )
  update public.crm_email_sends s set status = 'sending', claimed_at = now() from picked where s.id = picked.id returning s.*
$function$;
revoke execute on function public.crm_claim_queued(integer, text) from public, anon, authenticated;
comment on function public.crm_claim_queued(integer, text) is 'Takes up to p_limit queued emails for mail-send''s pump (wave157): p_source automation (an automation''s emails, sent first, within the daily cap) or campaign (within the campaign cap too); a claim older than 10 minutes goes back to the queue. FOR UPDATE SKIP LOCKED, so two pumps never take the same row.';

-- ---------- merging two contacts moves their runs ----------
do $mrg$
declare def text;
begin
  def := pg_get_functiondef('public.crm_merge_contacts(bigint, bigint)'::regprocedure);
  if position('crm_automation_runs' in def) = 0 then
    def := replace(def, 'update public.crm_email_sends set contact_id = p_keep where contact_id = p_drop;',
      'update public.crm_email_sends set contact_id = p_keep where contact_id = p_drop;' || E'\n' ||
      '  delete from public.crm_automation_runs ar where ar.contact_id = p_drop and exists (select 1 from public.crm_automation_runs x where x.contact_id = p_keep and x.automation_id = ar.automation_id and x.run_key = ar.run_key);' || E'\n' ||
      '  update public.crm_automation_runs set contact_id = p_keep where contact_id = p_drop;');
    if position('crm_automation_runs' in def) = 0 then raise exception 'crm_merge_contacts: the email sends line was not found'; end if;
    execute def;
  end if;
end $mrg$;

-- ---------- the clock ----------
select cron.unschedule(jobid) from cron.job where jobname = 'wa-crm-automations';
select cron.schedule('wa-crm-automations', '* * * * *', 'select public.crm_automation_tick() where exists (select 1 from public.crm_automation_runs where status = ''active'' and next_at <= now()) or exists (select 1 from public.crm_automations where status = ''on'' and trigger ->> ''kind'' = ''serving'');');

-- ---------- the first automations, all drafts ----------
insert into public.crm_automations (name, description, status, trigger, steps, settings, created_by, updated_by)
select v.name, v.description, 'draft', v.trigger, v.steps, v.settings, 'wave157', 'wave157'
  from (values
  ('Welcome new volunteers (Montreal)',
   'Keela''s volunteer welcome series, rebuilt: the welcome on the day they apply, then four emails three days apart, and a task for Ops Montreal to book their first serving. Keela sent the four in a different order to openers and non-openers; one sequence does the same job. Paste the words of Keela''s four emails before turning it on.',
   jsonb_build_object('kind', 'form', 'form_id', (select id from public.crm_forms where slug = 'volunteer')),
   '[{"id": "s1", "type": "send", "email": "template", "template_key": "welcome_volunteer", "kind": "transactional"},
     {"id": "s2", "type": "task", "department": "opsmtl", "title": "Welcome {{full_name}} and book their first serving", "note": "They applied through the volunteer form. Phone: {{phone|not given}}.", "due_days": 3},
     {"id": "s3", "type": "wait", "days": 2},
     {"id": "s4", "type": "send", "email": "write", "kind": "volunteer", "subject": "Welcome to our community", "preheader": "", "headline": "Welcome to our community", "body": "[Paste the words of Keela''s email \"Welcome to our community\" here]", "cta_label": "", "cta_url": ""},
     {"id": "s5", "type": "wait", "days": 3},
     {"id": "s6", "type": "send", "email": "write", "kind": "volunteer", "subject": "Why I started Welfare Avenue", "preheader": "", "headline": "Why I started Welfare Avenue", "body": "[Paste the words of Keela''s email \"Why I started Welfare Avenue\" here]", "cta_label": "", "cta_url": ""},
     {"id": "s7", "type": "wait", "days": 3},
     {"id": "s8", "type": "send", "email": "write", "kind": "volunteer", "subject": "What we do at Welfare Avenue", "preheader": "", "headline": "What we do at Welfare Avenue", "body": "[Paste the words of Keela''s email \"What we do at Welfare Avenue\" here]", "cta_label": "", "cta_url": ""},
     {"id": "s9", "type": "wait", "days": 3},
     {"id": "s10", "type": "send", "email": "write", "kind": "volunteer", "subject": "One conversation changed everything", "preheader": "", "headline": "One conversation changed everything", "body": "[Paste the words of Keela''s email \"One conversation changed everything\" here]", "cta_label": "", "cta_url": ""}]'::jsonb,
   '{"reentry": false}'::jsonb),
  ('Welcome new volunteers (Toronto)',
   'The welcome for people who register on the Toronto form, and a task for Ops Toronto to reach out. Paste the words of Keela''s Toronto welcome before turning it on.',
   jsonb_build_object('kind', 'form', 'form_id', (select id from public.crm_forms where slug = 'toronto-volunteer')),
   '[{"id": "s1", "type": "send", "email": "write", "kind": "volunteer", "subject": "Welcome to the Welfare Avenue crew, {{first_name|friend}}", "preheader": "", "headline": "Welcome to the crew", "body": "[Paste the words of Keela''s Toronto welcome email here]", "cta_label": "", "cta_url": ""},
     {"id": "s2", "type": "task", "department": "opsto", "title": "Reach out to {{full_name}}, a new Toronto volunteer", "note": "They registered through the Toronto form. Phone: {{phone|not given}}.", "due_days": 3}]'::jsonb,
   '{"reentry": false}'::jsonb),
  ('Welcome new newsletter subscribers',
   'A thank-you when someone signs up for the newsletter. Paste the words of Keela''s subscriber welcome before turning it on.',
   jsonb_build_object('kind', 'form', 'form_id', (select id from public.crm_forms where slug = 'newsletter')),
   '[{"id": "s1", "type": "send", "email": "write", "kind": "newsletter", "subject": "Welcome to the Welfare Avenue newsletter", "preheader": "", "headline": "Thank you for joining us", "body": "[Paste the words of Keela''s subscriber welcome email here]", "cta_label": "Visit welfareavenue.com", "cta_url": "https://welfareavenue.com"}]'::jsonb,
   '{"reentry": false}'::jsonb),
  ('Thank donors for a gift',
   'The thank-you email for every gift recorded in the Hub (dated in the last 7 days), from the saved email "Thank you for a gift". The CRA receipt stays separate (wave158).',
   '{"kind": "gift", "first_only": false, "min_amount": null}'::jsonb,
   '[{"id": "s1", "type": "send", "email": "template", "template_key": "thank_you_gift", "kind": "transactional"}]'::jsonb,
   '{"reentry": true}'::jsonb),
  ('Remind volunteers before a serving',
   'Two days before each planned Montreal serving, the saved email "Reminder before a serving" to everyone confirmed on its roster.',
   '{"kind": "serving", "days_before": 2, "location": "Montreal", "include_unconfirmed": false}'::jsonb,
   '[{"id": "s1", "type": "send", "email": "template", "template_key": "serving_reminder", "kind": "transactional"}]'::jsonb,
   '{"reentry": true}'::jsonb)
  ) as v(name, description, trigger, steps, settings)
 where not exists (select 1 from public.crm_automations x where x.name = v.name);

notify pgrst, 'reload schema';
