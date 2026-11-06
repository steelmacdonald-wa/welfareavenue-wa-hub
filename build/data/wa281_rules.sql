-- Welfare Avenue Hub: wave281, 06/11/26. Hub CRM slice 1, Phase 1: the CRM rules in the database (design CRM-S1 v2, Part A).
-- No visible change for staff. It adds: chapters (Montreal, Toronto) and who is in which; the consent log; do-not-contact; STOP that sticks to the
-- phone number; private birth dates and an age band; Campaigns, with gifts and the drive forms linked; organisation fields; access checks (wa_can).
-- Live functions are changed by exact replacement of an anchor in their live text (pg_get_functiondef), as wave273 did: if an anchor is missing the
-- whole migration fails rather than overwrite something that moved. Each patch first looks for its own wave281 text and skips when it is already
-- there, and every other step is guarded too, so the file is safe to run twice. The live text of every changed function, of crm_contacts_v and of the
-- hub_roles_self_member policy is copied into build/data/wa281_undo.sql.
-- No transaction control in this file: the release runs it through the Supabase connector, and build/sql_rollback_test.py runs it inside a block
-- that rolls back. Proved offline first: node test/w281sql.mjs (PGlite, test/w281schema.sql, test/w281sql.sql).
-- Built 06/11/26, not released. Undo: build/data/wa281_undo.sql.

-- ============================================================================================ 1.1 chapters
create table if not exists public.crm_chapters (
  code text primary key,
  name_en text,
  name_fr text,
  active boolean default true,
  mail_route text not null,
  ops_team text not null,
  sort int
);
alter table public.crm_chapters enable row level security;
revoke all on table public.crm_chapters from public, anon, authenticated;
grant select, insert, update, delete on table public.crm_chapters to authenticated;
grant all on table public.crm_chapters to service_role;
drop policy if exists crm_chapters_staff_read on public.crm_chapters;
create policy crm_chapters_staff_read on public.crm_chapters for select to authenticated using (public.is_wa_staff());
drop policy if exists crm_chapters_admin_write on public.crm_chapters;
create policy crm_chapters_admin_write on public.crm_chapters for all to authenticated using (public.is_wa_admin()) with check (public.is_wa_admin());
insert into public.crm_chapters (code, name_en, name_fr, active, mail_route, ops_team, sort) values
  ('montreal', 'Montreal', 'Montréal', true, 'volunteer', 'opsmtl', 1),
  ('toronto', 'Toronto', 'Toronto', true, 'toronto', 'opsto', 2)
on conflict (code) do nothing;
comment on table public.crm_chapters is 'wave281: the chapters (Montreal, Toronto; Ottawa may be added later). Staff read; admins write.';
comment on column public.crm_chapters.mail_route is 'wave281: the app_config mail_senders route this chapter''s volunteer email goes from: volunteer (volunteer@) for Montreal, toronto (toronto@) for Toronto.';
comment on column public.crm_chapters.ops_team is 'wave281: the chapter''s operations team code (dept_meta): opsmtl or opsto.';
comment on column public.crm_chapters.code is 'wave281: the chapter''s code, in lower case: montreal or toronto. crm_contact_chapters.chapter points here.';
comment on column public.crm_chapters.name_en is 'wave281: the chapter''s name in English (Montreal, Toronto).';
comment on column public.crm_chapters.name_fr is 'wave281: the chapter''s name in French (Montréal, Toronto).';
comment on column public.crm_chapters.active is 'wave281: false for a chapter that is no longer used; its rows stay.';
comment on column public.crm_chapters.sort is 'wave281: the order chapters are listed in (Montreal 1, Toronto 2).';

create table if not exists public.crm_contact_chapters (
  contact_id bigint references public.crm_contacts(id) on delete cascade,
  chapter text references public.crm_chapters(code),
  source text check (source in ('form', 'serving', 'application', 'import', 'hand', 'evidence')),
  source_ref text,
  added_at timestamptz default now(),
  added_by text,
  primary key (contact_id, chapter)
);
create index if not exists crm_contact_chapters_chapter_idx on public.crm_contact_chapters (chapter);
alter table public.crm_contact_chapters enable row level security;
revoke all on table public.crm_contact_chapters from public, anon, authenticated;
grant select, insert, delete on table public.crm_contact_chapters to authenticated;
grant all on table public.crm_contact_chapters to service_role;
drop policy if exists crm_contact_chapters_staff_read on public.crm_contact_chapters;
create policy crm_contact_chapters_staff_read on public.crm_contact_chapters for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_contact_chapters_staff_insert on public.crm_contact_chapters;
create policy crm_contact_chapters_staff_insert on public.crm_contact_chapters for insert to authenticated with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_contact_chapters_staff_delete on public.crm_contact_chapters;
create policy crm_contact_chapters_staff_delete on public.crm_contact_chapters for delete to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
comment on table public.crm_contact_chapters is 'wave281: which chapter a person belongs to, one row per person per chapter (a person can have both). Rows come only from evidence: a form answer, a confirmed serving, an application, the Keela import, set by hand, or the wave281 backfill (source evidence). crm_in_chapter() holds the filter rule. CRM staff read, add and remove rows; security-definer writers use crm_add_chapter; crm_merge_contacts moves them.';
comment on column public.crm_contact_chapters.source is 'wave281: where the row came from: form, serving, application, import, hand, or evidence (the wave281 backfill from tags and history).';
comment on column public.crm_contact_chapters.source_ref is 'wave281: what the source was, in a few words (for the backfill: tag, keela tag, serving, old website serving, form, application).';
comment on column public.crm_contact_chapters.contact_id is 'wave281: the person (crm_contacts). Deleting the contact deletes the row; a merge moves it.';
comment on column public.crm_contact_chapters.chapter is 'wave281: the chapter code (crm_chapters): montreal or toronto.';
comment on column public.crm_contact_chapters.added_at is 'wave281: when the row was added.';
comment on column public.crm_contact_chapters.added_by is 'wave281: the signed-in email that added it, system for a writer with nobody signed in, or wave281 for the backfill.';

create or replace function public.crm_add_chapter(p_contact bigint, p_chapter text, p_source text, p_ref text)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare v_n int;
begin
  insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by)
  values (p_contact, p_chapter, p_source, p_ref, coalesce(lower(nullif(auth.email(), '')), 'system'))
  on conflict (contact_id, chapter) do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $function$;
revoke all on function public.crm_add_chapter(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.crm_add_chapter(bigint, text, text, text) to service_role;
comment on function public.crm_add_chapter(bigint, text, text, text) is 'wave281: adds a person to a chapter (contact, chapter code, source, source note); does nothing when the row is already there, and says true when it added one. Service role only: its callers are security-definer functions and triggers (forms, servings, applications, the import). The page writes crm_contact_chapters directly under its policies.';

create or replace function public.crm_in_chapter(p_contact bigint, p_code text)
returns boolean language sql stable security invoker set search_path to '' as $function$
  select case lower(coalesce(p_code, ''))
    when 'all' then true
    when 'montreal' then exists (select 1 from public.crm_contact_chapters x where x.contact_id = p_contact and x.chapter = 'montreal')
                      or not exists (select 1 from public.crm_contact_chapters x where x.contact_id = p_contact)
    else exists (select 1 from public.crm_contact_chapters x where x.contact_id = p_contact and x.chapter = lower(p_code))
  end
$function$;
revoke all on function public.crm_in_chapter(bigint, text) from public, anon;
grant execute on function public.crm_in_chapter(bigint, text) to authenticated, service_role;
comment on function public.crm_in_chapter(bigint, text) is 'wave281: the chapter filter rule. toronto: the person has a toronto row. montreal: a montreal row, or no chapter row at all (so Montreal lists stay as they were). all: everyone. Any other code: a row for that code. Security invoker: it reads crm_contact_chapters as the caller, under its row security.';

-- the evidence backfill (source evidence); a row already there is kept as it is
insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by)
select c.id, 'toronto', 'evidence', 'tag', 'wave281'
  from public.crm_contacts c
 where c.merged_into is null and exists (select 1 from unnest(c.tags) t where t ilike '%toronto%')
on conflict (contact_id, chapter) do nothing;
insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by)
select c.id, 'toronto', 'evidence', 'keela tag', 'wave281'
  from public.crm_contacts c
 where c.merged_into is null and jsonb_typeof(c.legacy_refs -> 'keela' -> 'tags') = 'array'
   and exists (select 1 from jsonb_array_elements_text(c.legacy_refs -> 'keela' -> 'tags') t where t ilike '%toronto%')
on conflict (contact_id, chapter) do nothing;
-- a Toronto meal (wave274: kind meal, location Toronto) is not Montreal evidence; wave286 puts its crew in Toronto
insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by)
select c.id, 'montreal', 'evidence', 'serving', 'wave281'
  from public.crm_contacts c
 where c.merged_into is null and c.volunteer_id is not null
   and exists (select 1 from public.event_roster r join public.volunteer_events e on e.id = r.event_id
                where r.person_id = c.volunteer_id and r.status = 'Confirmed' and e.status = 'completed'
                  and not (coalesce(e.kind, '') = 'meal' and coalesce(e.location, '') = 'Toronto'))
on conflict (contact_id, chapter) do nothing;
insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by)
select c.id, 'montreal', 'evidence', 'old website serving', 'wave281'
  from public.crm_contacts c
 where c.merged_into is null and exists (select 1 from public.crm_volunteer_history h where h.contact_id = c.id and h.attended)
on conflict (contact_id, chapter) do nothing;
insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by)
select c.id, 'montreal', 'evidence', 'form', 'wave281'
  from public.crm_contacts c
 where c.merged_into is null
   and exists (select 1 from public.crm_form_submissions s join public.crm_forms f on f.id = s.form_id
                where s.contact_id = c.id and s.status = 'processed' and f.settings ->> 'city' = 'Montreal')
on conflict (contact_id, chapter) do nothing;
insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by)
select c.id, 'montreal', 'evidence', 'application', 'wave281'
  from public.crm_contacts c
 where c.merged_into is null
   and exists (select 1 from public.volunteer_applications a where a.contact_id = c.id or (c.volunteer_id is not null and a.person_id = c.volunteer_id))
on conflict (contact_id, chapter) do nothing;

-- ============================================================================================ 1.2 the consent log
create table if not exists public.crm_consent_events (
  id bigserial primary key,
  contact_id bigint not null references public.crm_contacts(id) on delete cascade,
  channel text check (channel in ('email', 'sms', 'whatsapp')),
  column_name text not null,
  old_value text,
  new_value text,
  source text not null,
  words text,
  actor text,
  occurred_at timestamptz not null default now(),
  import_batch_id bigint
);
create index if not exists crm_consent_events_contact_idx on public.crm_consent_events (contact_id, occurred_at);
alter table public.crm_consent_events enable row level security;
revoke all on table public.crm_consent_events from public, anon, authenticated, service_role;
grant select on table public.crm_consent_events to authenticated;
grant select, insert, update, delete, references, trigger on table public.crm_consent_events to service_role;   -- no truncate: the log is append-only
revoke all on sequence public.crm_consent_events_id_seq from public, anon, authenticated;
drop policy if exists crm_consent_events_staff_read on public.crm_consent_events;
create policy crm_consent_events_staff_read on public.crm_consent_events for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
comment on table public.crm_consent_events is 'wave281: the consent log, one row per changed consent column of a person (email_status, email_consent: email; sms_opt_out, sms_consent: sms; whatsapp_opt_out: whatsapp), written by the trigger trg_wa281_consent_log, plus the wave281 backfill (form consent answers, change_log rows). Append-only: CRM staff read it and nobody writes it directly; a truncate is always refused (no role holds the right, and a trigger refuses it), and an update or delete is refused unless wa.consent_merge is on (crm_merge_contacts) or, for a delete, the contact itself is being deleted.';
comment on column public.crm_consent_events.column_name is 'wave281: the crm_contacts column that changed (email_status, email_consent, sms_opt_out, sms_consent, whatsapp_opt_out), or form consent for a form answer loaded by the backfill.';
comment on column public.crm_consent_events.source is 'wave281: who or what made the change: the setting wa.consent_source if the writer set it (form: <slug>, STOP text, START text, daily implied-consent refresh, do not contact: <reason>, Keela import), else the new consent_source text if it changed in the same update, else staff for a signed-in staff member, else website account for any other signed-in person, else system. change_log for rows copied from change_log.';
comment on column public.crm_consent_events.words is 'wave281: the words the person saw or wrote (the setting wa.consent_words; for a form answer, the consent sentence).';
comment on column public.crm_consent_events.actor is 'wave281: the signed-in email that made the change, or system (wave281 backfill for the form answers loaded once).';
comment on column public.crm_consent_events.import_batch_id is 'wave281: the import batch (crm_import_batches, a later wave) when the import made the change (the setting wa.import_batch).';
comment on column public.crm_consent_events.id is 'wave281: the row''s number, in the order rows were written.';
comment on column public.crm_consent_events.contact_id is 'wave281: the person (crm_contacts). Deleting the contact deletes its rows; a merge moves them to the kept contact.';
comment on column public.crm_consent_events.channel is 'wave281: email (email_status, email_consent, form consent), sms (sms_opt_out, sms_consent) or whatsapp (whatsapp_opt_out).';
comment on column public.crm_consent_events.old_value is 'wave281: the value before the change, as text (true or false for the opt-outs); null when the contact was just created, and for a form answer.';
comment on column public.crm_consent_events.new_value is 'wave281: the value after the change, as text; for a form answer, given or not given.';
comment on column public.crm_consent_events.occurred_at is 'wave281: when the change happened (for a form answer, the time it was given; for a change_log row, its time).';

alter table public.crm_contacts add column if not exists sms_consent text check (sms_consent in ('express'));
alter table public.crm_contacts add column if not exists sms_consent_source text;
alter table public.crm_contacts add column if not exists sms_consent_at timestamptz;
comment on column public.crm_contacts.sms_consent is 'wave281: express when the person said yes to texts (a form''s text box, a Keela text opt-in); otherwise null. sms_opt_out stays the stop switch.';
comment on column public.crm_contacts.sms_consent_source is 'wave281: where the text consent came from (form: <slug>, Keela import).';
comment on column public.crm_contacts.sms_consent_at is 'wave281: when the text consent was given.';

create or replace function public.crm_consent_log()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  col text; v_src text; v_words text; v_actor text; v_batch bigint; v_hit boolean;
begin
  v_src := coalesce(nullif(current_setting('wa.consent_source', true), ''),
                    case when (n ->> 'consent_source') is distinct from (o ->> 'consent_source') then n ->> 'consent_source' end,
                    case when coalesce(public.is_wa_staff(), false) then 'staff' end,
                    case when auth.uid() is not null then 'website account' end,
                    'system');
  v_words := nullif(current_setting('wa.consent_words', true), '');
  v_actor := coalesce(nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''), 'system');
  v_batch := nullif(current_setting('wa.import_batch', true), '')::bigint;
  foreach col in array array['email_status', 'email_consent', 'sms_opt_out', 'sms_consent', 'whatsapp_opt_out'] loop
    -- on update: the value changed; on insert: the value differs from the column default (so a plain new contact writes nothing)
    v_hit := case when tg_op = 'UPDATE' then (n ->> col) is distinct from (o ->> col)
                  when col = 'email_status' then coalesce(n ->> col, 'unknown') <> 'unknown'
                  when col in ('sms_opt_out', 'whatsapp_opt_out') then coalesce((n ->> col)::boolean, false)
                  else (n ->> col) is not null end;
    if v_hit then
      insert into public.crm_consent_events (contact_id, channel, column_name, old_value, new_value, source, words, actor, import_batch_id)
      values (new.id, case when col like 'email%' then 'email' when col like 'sms%' then 'sms' else 'whatsapp' end,
              col, o ->> col, n ->> col, v_src, v_words, v_actor, v_batch);
    end if;
  end loop;
  return null;
end $function$;
revoke all on function public.crm_consent_log() from public, anon, authenticated;
comment on function public.crm_consent_log() is 'wave281: trigger function on crm_contacts (trg_wa281_consent_log). Writes one crm_consent_events row for each of email_status, email_consent, sms_opt_out, sms_consent and whatsapp_opt_out whose value changed (on insert: each that differs from the column default, so a plain new contact writes nothing). Source: wa.consent_source, else a changed consent_source, else staff, else website account (a signed-in person who is not staff), else system. Actor: the signed-in email, or system.';
-- its trigger, trg_wa281_consent_log, is created in 1.3, after the do_not_contact column it also fires on

create or replace function public.crm_consent_guard()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if tg_op = 'TRUNCATE' then raise exception 'The consent log is append-only: truncate is refused.'; end if;
  if coalesce(current_setting('wa.consent_merge', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  -- the on delete cascade of a contact's removal: the contact is already gone
  if tg_op = 'DELETE' and not exists (select 1 from public.crm_contacts c where c.id = old.contact_id) then return old; end if;
  raise exception 'The consent log is append-only: % is refused (only crm_merge_contacts moves rows).', lower(tg_op);
end $function$;
revoke all on function public.crm_consent_guard() from public, anon, authenticated;
comment on function public.crm_consent_guard() is 'wave281: trigger function on crm_consent_events (trg_wa281_consent_guard, trg_wa281_consent_no_truncate). Refuses a truncate always, and any update or delete unless the setting wa.consent_merge is on (only crm_merge_contacts sets it, while it moves rows to the kept contact) or, for a delete, the contact no longer exists (its removal cascades).';
drop trigger if exists trg_wa281_consent_guard on public.crm_consent_events;
create trigger trg_wa281_consent_guard before update or delete on public.crm_consent_events
  for each row execute function public.crm_consent_guard();
comment on trigger trg_wa281_consent_guard on public.crm_consent_events is 'wave281: keeps the consent log append-only.';
drop trigger if exists trg_wa281_consent_no_truncate on public.crm_consent_events;
create trigger trg_wa281_consent_no_truncate before truncate on public.crm_consent_events
  for each statement execute function public.crm_consent_guard();
comment on trigger trg_wa281_consent_no_truncate on public.crm_consent_events is 'wave281: a truncate (which fires no row trigger) is refused, even through a cascade from crm_contacts.';

-- backfill (a): every processed Hub form answer with consent. form-submit stores {asked, given, at, form} (fn/form-submit/index.ts line 372).
insert into public.crm_consent_events (contact_id, channel, column_name, old_value, new_value, source, words, actor, occurred_at)
select s.contact_id, 'email', 'form consent', null,
       case when (s.consent ->> 'given')::boolean then 'given' else 'not given' end,
       'form: ' || f.slug, s.consent ->> 'asked', 'wave281 backfill', coalesce((s.consent ->> 'at')::timestamptz, s.created_at)
  from public.crm_form_submissions s
  join public.crm_forms f on f.id = s.form_id
  join public.crm_contacts c on c.id = s.contact_id
 where s.consent is not null and s.contact_id is not null and s.status = 'processed' and not s.is_test
   and not exists (select 1 from public.crm_consent_events e where e.contact_id = s.contact_id and e.column_name = 'form consent'
                    and e.source = 'form: ' || f.slug and e.occurred_at = coalesce((s.consent ->> 'at')::timestamptz, s.created_at));
-- backfill (b): the consent changes change_log recorded on contacts
insert into public.crm_consent_events (contact_id, channel, column_name, old_value, new_value, source, words, actor, occurred_at)
select c.id, case when l.field = 'sms_opt_out' then 'sms' else 'email' end, l.field, l.old_value, l.new_value, 'change_log', null, l.changed_by, l.changed_at
  from public.change_log l
  join public.crm_contacts c on c.id = case when l.entity_id ~ '^[0-9]{1,18}$' then l.entity_id::bigint end   -- entity_id is text; rows whose contact is gone drop out
 where l.entity_type in ('crm_contact', 'crm_contacts') and l.field in ('email_permission', 'email_status', 'email_consent', 'sms_opt_out')
   and not exists (select 1 from public.crm_consent_events e where e.contact_id = c.id and e.column_name = l.field
                    and e.source = 'change_log' and e.occurred_at = l.changed_at);

-- ============================================================================================ 1.3 do-not-contact
alter table public.crm_contacts add column if not exists do_not_contact boolean not null default false;
alter table public.crm_contacts add column if not exists dnc_reason text check (dnc_reason in ('deceased', 'asked', 'other'));
alter table public.crm_contacts add column if not exists dnc_at timestamptz;
alter table public.crm_contacts add column if not exists dnc_by text;
comment on column public.crm_contacts.do_not_contact is 'wave281: true when nobody may contact this person by any channel (crm_set_do_not_contact). crm_email_permission refuses every kind of email, transactional included; setting it also unsubscribes the email and stops texts and WhatsApp, and while it is on trg_wa281_dnc_hold keeps them that way. Receipts are still issued and stored, not emailed.';
comment on column public.crm_contacts.dnc_reason is 'wave281: why the person is do-not-contact: deceased, asked or other.';
comment on column public.crm_contacts.dnc_at is 'wave281: when do-not-contact was set.';
comment on column public.crm_contacts.dnc_by is 'wave281: the signed-in email that set do-not-contact.';

create or replace function public.crm_set_do_not_contact(p_contact bigint, p_reason text)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_old text; v_who text := lower(coalesce(nullif(auth.email(), ''), 'staff'));
begin
  if not (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) then raise exception 'not allowed'; end if;
  if p_reason is not null and p_reason not in ('deceased', 'asked', 'other') then raise exception 'the reason is deceased, asked or other'; end if;
  select c.id, c.dnc_reason into v_id, v_old from public.crm_contacts c where c.id = p_contact and c.merged_into is null;
  if v_id is null then raise exception 'contact % is not in the CRM', p_contact; end if;
  perform set_config('wa.consent_source', 'do not contact: ' || coalesce(p_reason, 'cleared'), true);
  if p_reason is null then
    -- clears the flag only: never resubscribes anyone
    update public.crm_contacts set do_not_contact = false, dnc_reason = null, dnc_at = null, dnc_by = null, updated_by = v_who where id = p_contact;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('crm_contact', p_contact::text, 'do_not_contact', v_old, 'do not contact cleared', v_who);
  else
    update public.crm_contacts set do_not_contact = true, dnc_reason = p_reason, dnc_at = now(), dnc_by = auth.email(),
           email_status = case when email_status in ('bounced', 'complained') then email_status else 'unsubscribed' end,
           sms_opt_out = true, whatsapp_opt_out = true, consent_source = 'do not contact: ' || p_reason, updated_by = v_who
     where id = p_contact;
  end if;
end $function$;
revoke all on function public.crm_set_do_not_contact(bigint, text) from public, anon;
grant execute on function public.crm_set_do_not_contact(bigint, text) to authenticated, service_role;
comment on function public.crm_set_do_not_contact(bigint, text) is 'wave281: sets or clears do-not-contact for one person. CRM staff only. With a reason (deceased, asked, other): the flag, reason, time and who, email_status unsubscribed (bounced or complained are kept), sms_opt_out and whatsapp_opt_out true, consent_source do not contact: <reason>; the consent log records each change. With a null reason: clears the four do-not-contact fields only (never resubscribes anyone) and writes a change_log line, do not contact cleared.';

-- do-not-contact holds the opt-outs on its own (final review, 06/11/26). Whoever writes the row (the page, a START text, a merge, an import), while
-- do_not_contact is true texts and WhatsApp stay stopped and the email stays unsubscribed; a bounce or a complaint stays as it is. Clearing it changes
-- nothing, so nobody is resubscribed. It runs before the row is written and the consent log (after) compares the final values, so a value it holds
-- that was already on writes no log row.
create or replace function public.crm_dnc_hold()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.do_not_contact then
    new.sms_opt_out := true;
    new.whatsapp_opt_out := true;
    if new.email_status is null or new.email_status not in ('unsubscribed', 'bounced', 'complained') then new.email_status := 'unsubscribed'; end if;
    if tg_op = 'UPDATE' then
      if old.email_status in ('bounced', 'complained') and new.email_status not in ('bounced', 'complained') then new.email_status := old.email_status; end if;
    end if;
  end if;
  return new;
end $function$;
revoke all on function public.crm_dnc_hold() from public, anon, authenticated, service_role;
comment on function public.crm_dnc_hold() is 'wave281 (final review, 06/11/26): trigger function on crm_contacts (trg_wa281_dnc_hold). While do_not_contact is true it keeps sms_opt_out and whatsapp_opt_out true and email_status unsubscribed (bounced or complained stay as they are), whoever writes the row: the page, a START text through wa171_inbound, a merge, an import. Clearing do_not_contact changes nothing, so nobody is resubscribed. No direct execute grant.';
drop trigger if exists trg_wa281_dnc_hold on public.crm_contacts;
create trigger trg_wa281_dnc_hold before insert or update of do_not_contact, sms_opt_out, whatsapp_opt_out, email_status on public.crm_contacts
  for each row execute function public.crm_dnc_hold();
comment on trigger trg_wa281_dnc_hold on public.crm_contacts is 'wave281: while do-not-contact is on, texts, WhatsApp and email stay off (crm_dnc_hold).';
-- the consent log's trigger (1.2): it also fires when do_not_contact is written, so the opt-outs trg_wa281_dnc_hold sets are recorded
drop trigger if exists trg_wa281_consent_log on public.crm_contacts;
create trigger trg_wa281_consent_log after insert or update of email_status, email_consent, sms_opt_out, sms_consent, whatsapp_opt_out, do_not_contact on public.crm_contacts
  for each row execute function public.crm_consent_log();
comment on trigger trg_wa281_consent_log on public.crm_contacts is 'wave281: writes the consent log (crm_consent_events) when a consent column changes; it also fires when do_not_contact is written, so the opt-outs trg_wa281_dnc_hold sets are recorded.';
-- a do-not-contact person whose opt-outs moved while this rule was off (the undo keeps the flag) is put right; the consent log records it
do $wa281dnc$
declare r record;
begin
  for r in select c.id, c.dnc_reason from public.crm_contacts c
            where c.do_not_contact and (not c.sms_opt_out or not c.whatsapp_opt_out or coalesce(c.email_status, '') not in ('unsubscribed', 'bounced', 'complained')) loop
    perform set_config('wa.consent_source', 'do not contact: ' || coalesce(r.dnc_reason, 'other'), true);
    update public.crm_contacts set sms_opt_out = true where id = r.id;
  end loop;
  perform set_config('wa.consent_source', '', true);
end $wa281dnc$;

-- ============================================================================================ 1.4 STOP sticks to the phone number
create index if not exists quo_messages_wa281_keyword_idx on public.quo_messages (phone, created_at) where direction = 'in' and handled in ('opted_out', 'opted_in');
create index if not exists whatsapp_messages_wa281_keyword_idx on public.whatsapp_messages (phone, created_at) where direction = 'in' and handled in ('opted_out', 'opted_in');
create or replace view public.wa_stopped_phones_v with (security_invoker = on) as
  select s.phone_digits, 'sms'::text as channel
    from (select distinct on (public.wa171_digits(q.phone)) public.wa171_digits(q.phone) as phone_digits, q.handled
            from public.quo_messages q
           where q.direction = 'in' and q.handled in ('opted_out', 'opted_in') and public.wa171_digits(q.phone) is not null
           order by public.wa171_digits(q.phone), q.created_at desc, q.id desc) s
   where s.handled = 'opted_out'
  union all
  select w.phone_digits, 'whatsapp'::text as channel
    from (select distinct on (public.wa171_digits(m.phone)) public.wa171_digits(m.phone) as phone_digits, m.handled
            from public.whatsapp_messages m
           where m.direction = 'in' and m.handled in ('opted_out', 'opted_in') and public.wa171_digits(m.phone) is not null
           order by public.wa171_digits(m.phone), m.created_at desc, m.id desc) w
   where w.handled = 'opted_out';
revoke all on table public.wa_stopped_phones_v from public, anon, authenticated;
grant select on table public.wa_stopped_phones_v to service_role;
comment on view public.wa_stopped_phones_v is 'wave281: the stopped phones: for each phone (10 digits, wa171_digits) and channel (sms: quo_messages; whatsapp: whatsapp_messages), the latest inbound keyword text (handled opted_out or opted_in) was a STOP. A STOP sticks to the number even when no contact holds it; a later START (opted_in) clears it. Service role only (wa171_digits is not granted to signed-in users): read by wa171_opted_out (security definer), quo-send (sms) and whatsapp-send (whatsapp).';
comment on column public.wa_stopped_phones_v.phone_digits is 'wave281: the phone number''s last 10 digits (wa171_digits).';
comment on column public.wa_stopped_phones_v.channel is 'wave281: sms for a STOP texted to the ops line (quo_messages), whatsapp for a STOP sent on WhatsApp (whatsapp_messages).';

-- ============================================================================================ 1.5 private data and fields
alter table public.crm_contacts add column if not exists job_title text;
comment on column public.crm_contacts.job_title is 'wave281: the person''s job title (Keela has 21).';

create table if not exists public.crm_contact_private (
  contact_id bigint primary key references public.crm_contacts(id) on delete cascade,
  birth_date date,
  source text,
  updated_at timestamptz,
  updated_by text
);
alter table public.crm_contact_private enable row level security;
revoke all on table public.crm_contact_private from public, anon, authenticated;
grant select, insert, update, delete on table public.crm_contact_private to authenticated;
grant all on table public.crm_contact_private to service_role;
drop policy if exists crm_contact_private_hr on public.crm_contact_private;
create policy crm_contact_private_hr on public.crm_contact_private for all to authenticated using (public.wa_is_hr() or public.is_wa_admin()) with check (public.wa_is_hr() or public.is_wa_admin());
comment on table public.crm_contact_private is 'wave281: private data about a person, one row per contact: the birth date (from Keela only; Hub forms ask "Are you 16 or older?" instead). Only HR and admins read or write it; staff see crm_age_band(). crm_merge_contacts moves it.';
comment on column public.crm_contact_private.birth_date is 'wave281: the date of birth. Never copied into the timeline, change_log or the import''s change records.';
comment on column public.crm_contact_private.contact_id is 'wave281: the person (crm_contacts), one row each. Deleting the contact deletes the row; a merge moves it.';
comment on column public.crm_contact_private.source is 'wave281: where the birth date came from (the Keela import, or set by HR).';
comment on column public.crm_contact_private.updated_at is 'wave281: when the row last changed.';
comment on column public.crm_contact_private.updated_by is 'wave281: who last changed it (an email, or the import).';

create or replace function public.crm_age_band(p_contact bigint)
returns text language sql stable security definer set search_path to '' as $function$
  select case when a.y is null then null when a.y < 16 then 'under 16' when a.y < 18 then '16 to 17' else '18 or older' end
    from (select extract(year from age((now() at time zone 'America/Toronto')::date, p.birth_date))::int as y
            from public.crm_contact_private p
           where p.contact_id = p_contact and public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) a
$function$;
revoke all on function public.crm_age_band(bigint) from public, anon;
grant execute on function public.crm_age_band(bigint) to authenticated, service_role;
comment on function public.crm_age_band(bigint) is 'wave281: a person''s age band on today''s date in Toronto: under 16, 16 to 17, 18 or older, or null when no birth date is stored. Never returns the date. Null for anyone who is not CRM staff.';

insert into public.crm_fields (key, label, type, options, help, sort, created_by, updated_by)
select x.key, x.label, x.type, x.options, x.help, (select coalesce(max(f.sort), 0) from public.crm_fields f) + x.n * 10, 'wave281', 'wave281'
  from (values
    (1, 'linkedin', 'LinkedIn', 'text', '[]'::jsonb, null::text),
    (2, 'car_make_model', 'Car (make and model)', 'text', '[]'::jsonb, null),
    (3, 'car_seats', 'Car seats', 'number', '[]'::jsonb, null),
    (4, 'food_licence', 'Food licence (MAPAQ)', 'choice', '["MAPAQ permit acquired", "Interested", "Not interested"]'::jsonb, 'MAPAQ is Quebec''s food permit.')
  ) as x(n, key, label, type, options, help)
on conflict (key) do nothing;

-- crm_contacts_v: the live definition with job_title, do_not_contact and dnc_reason appended (read live, one anchor replaced)
do $view$
declare v text; v_sp text := current_setting('search_path'); a text := 'o.org_names';
begin
  v := pg_get_viewdef('public.crm_contacts_v'::regclass, true);
  if position('do_not_contact' in v) = 0 then
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave281: crm_contacts_v moved (anchor o.org_names)'; end if;
    v := replace(v, a, 'o.org_names, c.job_title, c.do_not_contact, c.dnc_reason');
    perform set_config('search_path', 'public', true);
    execute 'create or replace view public.crm_contacts_v with (security_invoker = true) as ' || v;   -- live stores true
    perform set_config('search_path', v_sp, true);
  end if;
end $view$;
revoke all on table public.crm_contacts_v from anon;
revoke insert, update, delete on table public.crm_contacts_v from authenticated;
grant select on table public.crm_contacts_v to authenticated;
grant all on table public.crm_contacts_v to service_role;
comment on view public.crm_contacts_v is 'The live contacts (not merged) with their volunteer roles and tags, Hub servings (confirmed at completed events, the old website''s events included since wave 152), the old website''s servings not yet in the Hub and its recorded hours, gift totals and organization names; since wave281 also job_title, do_not_contact and dnc_reason. The CRM page reads this.';

-- ============================================================================================ 1.6 access
alter table public.hub_roles add column if not exists caps jsonb not null default '{}';
comment on column public.hub_roles.caps is 'wave281: extra capabilities given to one person, as {"name": true}. Today only gifts_edit (named finance people). Read through wa_can(). Only admins set it (hub_roles_admin_write); a member''s self-added row must leave it empty.';
-- protect caps from self-service: the live check of hub_roles_self_member, plus caps empty (the live text is in the undo)
alter policy hub_roles_self_member on public.hub_roles with check (
  (email = lower(coalesce((auth.jwt() ->> 'email'::text), ''::text))) and (email ~~ '%@welfareavenue.com'::text) and (role = 'member'::text)
  and (profile is null) and (tabs is null) and (caps = '{}'::jsonb));

create or replace function public.wa_can(p_cap text)
returns boolean language sql stable security definer set search_path to '' as $function$
  select case
    when r.email is null or r.role = 'blocked' then false
    when p_cap = 'gifts_edit' then coalesce(public.is_wa_leader(), false) or coalesce(r.caps ->> 'gifts_edit', '') = 'true'
    when p_cap = 'import_admin' then coalesce(public.is_wa_admin(), false)
    when p_cap = 'hr_private' then coalesce(public.wa_is_hr(), false) or coalesce(public.is_wa_admin(), false)
    else false
  end
  from (select 1) one
  left join public.hub_roles r on r.email = public.wa_email() and r.email <> ''
$function$;
revoke all on function public.wa_can(text) from public, anon;
grant execute on function public.wa_can(text) to authenticated, service_role;
comment on function public.wa_can(text) is 'wave281: true when the signed-in person has a capability. gifts_edit: leaders and admins, or hub_roles.caps gifts_edit true (named finance people). import_admin: admins. hr_private: HR or admins. False for an unknown capability and for anyone without a hub_roles row or with role blocked.';

create or replace function public.wa_my_caps()
returns jsonb language sql stable set search_path to '' as $function$
  select jsonb_build_object('gifts_edit', public.wa_can('gifts_edit'), 'import_admin', public.wa_can('import_admin'), 'hr_private', public.wa_can('hr_private'))
$function$;
revoke all on function public.wa_my_caps() from public, anon;
grant execute on function public.wa_my_caps() to authenticated, service_role;
comment on function public.wa_my_caps() is 'wave281: the signed-in person''s three capabilities, {gifts_edit, import_admin, hr_private}, each true or false (wa_can).';

-- ============================================================================================ 1.7 Campaigns
create table if not exists public.wa_campaigns (
  id bigserial primary key,
  name text not null,
  type text not null check (type in ('fundraising_event', 'drive', 'appeal', 'program')),
  year int,
  goal_amount numeric,
  status text not null default 'active' check (status in ('planned', 'active', 'done', 'archived')),
  donate_key text unique,
  keela_name text unique,
  created_at timestamptz not null default now(),
  created_by text
);
alter table public.wa_campaigns enable row level security;
revoke all on table public.wa_campaigns from public, anon, authenticated;
grant select, insert, update, delete on table public.wa_campaigns to authenticated;
grant all on table public.wa_campaigns to service_role;
revoke all on sequence public.wa_campaigns_id_seq from public, anon, authenticated;
grant usage, select on sequence public.wa_campaigns_id_seq to authenticated;
drop policy if exists wa_campaigns_staff_read on public.wa_campaigns;
create policy wa_campaigns_staff_read on public.wa_campaigns for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists wa_campaigns_leader_write on public.wa_campaigns;
create policy wa_campaigns_leader_write on public.wa_campaigns for all to authenticated using (public.is_wa_leader()) with check (public.is_wa_leader());
comment on table public.wa_campaigns is 'wave281: a Campaign: a fundraising event, drive, appeal or program (not a Send, which is crm_campaigns). CRM staff read; leaders and admins write.';
comment on column public.wa_campaigns.type is 'wave281: fundraising_event, drive, appeal or program.';
comment on column public.wa_campaigns.goal_amount is 'wave281: the money goal in dollars, if any.';
comment on column public.wa_campaigns.status is 'wave281: planned, active, done or archived.';
comment on column public.wa_campaigns.donate_key is 'wave281: the key the donation page and forms use for this campaign (crm_forms.settings.campaign, for example gift-basket-drive).';
comment on column public.wa_campaigns.keela_name is 'wave281: the campaign''s name in Keela, for the import.';
comment on column public.wa_campaigns.id is 'wave281: the campaign''s number. crm_donations.campaign_id, wa_campaign_people.campaign_id and crm_forms.settings.campaign_id point here.';
comment on column public.wa_campaigns.name is 'wave281: the campaign''s name as staff see it (for example Gift Basket Drive 2026).';
comment on column public.wa_campaigns.year is 'wave281: the year the campaign runs in.';
comment on column public.wa_campaigns.created_at is 'wave281: when the row was added.';
comment on column public.wa_campaigns.created_by is 'wave281: who added it (an email, or wave281 for the seed rows).';

create table if not exists public.wa_campaign_people (
  campaign_id bigint references public.wa_campaigns(id) on delete cascade,
  contact_id bigint references public.crm_contacts(id) on delete cascade,
  part text check (part in ('participant', 'registrant', 'volunteer', 'donor', 'sponsor')),
  source text not null,
  source_ref text,
  added_at timestamptz default now(),
  primary key (campaign_id, contact_id, part)
);
create index if not exists wa_campaign_people_contact_idx on public.wa_campaign_people (contact_id);
alter table public.wa_campaign_people enable row level security;
revoke all on table public.wa_campaign_people from public, anon, authenticated;
grant select, insert, update, delete on table public.wa_campaign_people to authenticated;
grant all on table public.wa_campaign_people to service_role;
drop policy if exists wa_campaign_people_staff on public.wa_campaign_people;
create policy wa_campaign_people_staff on public.wa_campaign_people for all to authenticated
  using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
comment on table public.wa_campaign_people is 'wave281: who took part in a Campaign and how (participant, registrant, volunteer, donor, sponsor), shown as "<campaign>, <part>". CRM staff read and write; crm_merge_contacts moves the rows.';
comment on column public.wa_campaign_people.source is 'wave281: where the row came from (for example form, import, hand).';
comment on column public.wa_campaign_people.campaign_id is 'wave281: the campaign (wa_campaigns). Deleting the campaign deletes its rows.';
comment on column public.wa_campaign_people.contact_id is 'wave281: the person (crm_contacts). Deleting the contact deletes the row; a merge moves it.';
comment on column public.wa_campaign_people.part is 'wave281: how the person took part: participant, registrant, volunteer, donor or sponsor. One person can have several parts in one campaign.';
comment on column public.wa_campaign_people.source_ref is 'wave281: what the source was, in a few words (for example the form slug or the import batch).';
comment on column public.wa_campaign_people.added_at is 'wave281: when the row was added.';

insert into public.wa_campaigns (name, type, year, goal_amount, keela_name, donate_key, status, created_by)
select x.name, x.type, x.year, x.goal, x.keela, x.donate, x.status, 'wave281'
  from (values
    (1, 'Rally Paper 2026', 'fundraising_event', 2026, null::numeric, 'Rally Paper 2026', null::text, 'active'),
    (2, 'Football Fundraiser 2025', 'fundraising_event', 2025, null, 'Football Fundraiser 2025', null, 'done'),
    (3, 'Football Fundraiser 2026', 'fundraising_event', 2026, null, 'Football Fundraiser 2026', null, 'active'),
    (4, 'Program Development', 'appeal', 2026, 5000, 'Program Development', null, 'active'),
    (5, 'Collaborative Sunday Servings', 'program', 2026, null, 'Collaborative Sunday Servings', null, 'active'),
    (6, 'Holiday Gift Baskets', 'drive', 2025, 1000, 'Holiday Gift Baskets', null, 'done'),
    (7, 'Gift Basket Drive 2026', 'drive', 2026, null, null, 'gift-basket-drive', 'active')
  ) as x(n, name, type, year, goal, keela, donate, status)
 where not exists (select 1 from public.wa_campaigns w where w.name = x.name)
 order by x.n;

create or replace function public.crm_gift_campaign_id(p_text text)
returns bigint language sql stable set search_path to '' as $function$
  select w.id
    from public.wa_campaigns w
   where lower(btrim(p_text)) = lower(w.name) or lower(btrim(p_text)) = lower(w.keela_name)
      or (lower(btrim(p_text)) = 'holiday gift basket drive 2026' and w.donate_key = 'gift-basket-drive')
   order by (lower(btrim(p_text)) = lower(w.name) or lower(btrim(p_text)) = lower(w.keela_name)) desc, w.id
   limit 1
$function$;
revoke all on function public.crm_gift_campaign_id(text) from public, anon, authenticated;
grant execute on function public.crm_gift_campaign_id(text) to service_role;
comment on function public.crm_gift_campaign_id(text) is 'wave281: the Campaign a gift''s campaign text means: the wa_campaigns row whose name or keela_name equals it, ignoring case; Holiday Gift Basket Drive 2026 means Gift Basket Drive 2026. Anything else (fundraising campaign included) gives null. Service role only; the trigger trg_wa281_gift_campaign uses it.';

alter table public.crm_donations add column if not exists campaign_id bigint references public.wa_campaigns(id);
create index if not exists crm_donations_campaign_idx on public.crm_donations (campaign_id);
comment on column public.crm_donations.campaign_id is 'wave281: the Campaign (wa_campaigns) this gift belongs to, next to the free-text campaign. Set from the text by crm_gift_campaign_id (the wave281 backfill, then trg_wa281_gift_campaign on every new gift or changed campaign text).';

create or replace function public.wa281_gift_campaign()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if tg_op = 'INSERT' then
    if new.campaign_id is null then new.campaign_id := public.crm_gift_campaign_id(new.campaign); end if;
  elsif new.campaign is distinct from old.campaign and new.campaign_id is not distinct from old.campaign_id then
    new.campaign_id := public.crm_gift_campaign_id(new.campaign);
  end if;
  return new;
end $function$;
revoke all on function public.wa281_gift_campaign() from public, anon, authenticated;
comment on function public.wa281_gift_campaign() is 'wave281: trigger function on crm_donations (trg_wa281_gift_campaign). A new gift, or a changed campaign text, gets campaign_id from crm_gift_campaign_id, unless the writer set campaign_id itself in the same statement.';
drop trigger if exists trg_wa281_gift_campaign on public.crm_donations;
create trigger trg_wa281_gift_campaign before insert or update of campaign on public.crm_donations
  for each row execute function public.wa281_gift_campaign();
comment on trigger trg_wa281_gift_campaign on public.crm_donations is 'wave281: keeps campaign_id linked to the campaign text, so new drive gifts stay linked.';

-- backfill every gift once (campaign_id only, so the trigger above does not fire)
update public.crm_donations d set campaign_id = public.crm_gift_campaign_id(d.campaign)
 where d.campaign_id is null and d.campaign is not null and public.crm_gift_campaign_id(d.campaign) is not null;

update public.crm_forms f set settings = f.settings || jsonb_build_object('campaign_id', w.id)
  from public.wa_campaigns w
 where w.donate_key = 'gift-basket-drive' and f.settings ->> 'campaign' = 'gift-basket-drive'
   and (f.settings -> 'campaign_id') is distinct from to_jsonb(w.id);

-- ============================================================================================ 1.8 organisations
alter table public.wa_partners add column if not exists keela_company_id text unique;
alter table public.wa_partners add column if not exists goals text[] not null default '{}';
comment on column public.wa_partners.keela_company_id is 'wave281: the organisation''s company id in Keela, for the import (unique).';
comment on column public.wa_partners.goals is 'wave281: what the partnership is for, as short phrases (from Keela).';
drop policy if exists wa_partners_staff_insert on public.wa_partners;
create policy wa_partners_staff_insert on public.wa_partners for insert to authenticated
  with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and visibility = 'everyone');

-- ============================================================================================ 1.3, 1.4, 1.9, 1.10 the live functions, by exact anchor
-- Each block: skip when the wave281 text is already in the live definition; otherwise every anchor must be there exactly once, or the migration stops.
do $wa281$
declare v text; a1 text; a2 text;
begin
  -- 1.3 crm_email_permission: do-not-contact refuses every kind of email
  v := pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure);
  if position($x$'do not contact'::text$x$ in v) = 0 then
    a1 := $x$x.merged_into, x.volunteer_id$x$;
    a2 := $x$  if c.st in ('bounced', 'complained') then return query select false, c.st::text, null::date, c.em::text, c.st::text; return; end if;$x$;
    if length(v) - length(replace(v, a1, '')) <> length(a1) or length(v) - length(replace(v, a2, '')) <> length(a2) then
      raise exception 'wave281: a live function moved: crm_email_permission';
    end if;
    v := replace(v, a1, a1 || ', x.do_not_contact');
    v := replace(v, a2, a2 || E'\n' || $x$  if c.do_not_contact then return query select false, 'do not contact'::text, null::date, c.em::text, c.st::text; return; end if;$x$);
    execute v;
  end if;

  -- 1.4 wa171_opted_out: also true for a phone whose latest SMS keyword text was STOP
  v := pg_get_functiondef('public.wa171_opted_out(bigint,text)'::regprocedure);
  if position('wa_stopped_phones_v' in v) = 0 then
    a1 := $x$= public.wa171_digits(p_phone))));$x$;
    if length(v) - length(replace(v, a1, '')) <> length(a1) then raise exception 'wave281: a live function moved: wa171_opted_out'; end if;
    v := replace(v, a1, $x$= public.wa171_digits(p_phone)))) or exists (select 1 from public.wa_stopped_phones_v s where s.channel = 'sms' and s.phone_digits = public.wa171_digits(p_phone));$x$);
    execute v;
  end if;

  -- 1.4 wa171_inbound: the consent log records STOP text and START text
  v := pg_get_functiondef('public.wa171_inbound(jsonb)'::regprocedure);
  if position($x$'STOP text'$x$ in v) = 0 then
    a1 := $x$update public.crm_contacts c set sms_opt_out = true, updated_at = now()$x$;
    a2 := $x$update public.crm_contacts c set sms_opt_out = false, updated_at = now()$x$;
    if length(v) - length(replace(v, a1, '')) <> length(a1) or length(v) - length(replace(v, a2, '')) <> length(a2) then
      raise exception 'wave281: a live function moved: wa171_inbound';
    end if;
    v := replace(v, a1, $x$perform set_config('wa.consent_source', 'STOP text', true);
    $x$ || a1);
    v := replace(v, a2, $x$perform set_config('wa.consent_source', 'START text', true);
    $x$ || a2);
    execute v;
  end if;

  -- 1.4 wa254_inbound (WhatsApp): the consent log records WhatsApp STOP
  v := pg_get_functiondef('public.wa254_inbound(jsonb)'::regprocedure);
  if position($x$'WhatsApp STOP'$x$ in v) = 0 then
    a1 := $x$update public.crm_contacts c set whatsapp_opt_out = true, updated_at = now()$x$;
    if length(v) - length(replace(v, a1, '')) <> length(a1) then raise exception 'wave281: a live function moved: wa254_inbound'; end if;
    v := replace(v, a1, $x$perform set_config('wa.consent_source', 'WhatsApp STOP', true);
    $x$ || a1);
    execute v;
  end if;

  -- 1.4 crm_refresh_implied_consent: the consent log records the daily refresh (the update sits in a CTE, so the setting goes before the statement)
  v := pg_get_functiondef('public.crm_refresh_implied_consent()'::regprocedure);
  if position('daily implied-consent refresh' in v) = 0 then
    a1 := $x$  with act as ($x$;
    if length(v) - length(replace(v, a1, '')) <> length(a1) then raise exception 'wave281: a live function moved: crm_refresh_implied_consent'; end if;
    v := replace(v, a1, $x$  perform set_config('wa.consent_source', 'daily implied-consent refresh', true);
$x$ || a1);
    execute v;
  end if;

  -- 1.9 crm_merge_contacts: chapters, the consent log, Campaigns, private data and do-not-contact follow the merge
  v := pg_get_functiondef('public.crm_merge_contacts(bigint,bigint)'::regprocedure);
  if position('crm_contact_chapters' in v) = 0 then
    a1 := $x$  update public.crm_email_sends set contact_id = p_keep where contact_id = p_drop;$x$;
    if length(v) - length(replace(v, a1, '')) <> length(a1) then raise exception 'wave281: a live function moved: crm_merge_contacts'; end if;
    v := replace(v, a1, a1 || $x$
  -- wave281: chapters, the consent log, Campaigns, private data and do-not-contact follow the merge
  insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_at, added_by)
    select p_keep, x.chapter, x.source, x.source_ref, x.added_at, x.added_by from public.crm_contact_chapters x where x.contact_id = p_drop
    on conflict (contact_id, chapter) do nothing;
  delete from public.crm_contact_chapters where contact_id = p_drop;
  perform set_config('wa.consent_merge', 'on', true);
  update public.crm_consent_events set contact_id = p_keep where contact_id = p_drop;
  perform set_config('wa.consent_merge', '', true);
  insert into public.wa_campaign_people (campaign_id, contact_id, part, source, source_ref, added_at)
    select x.campaign_id, p_keep, x.part, x.source, x.source_ref, x.added_at from public.wa_campaign_people x where x.contact_id = p_drop
    on conflict (campaign_id, contact_id, part) do nothing;
  delete from public.wa_campaign_people where contact_id = p_drop;
  if exists (select 1 from public.crm_contact_private x where x.contact_id = p_keep) then
    delete from public.crm_contact_private where contact_id = p_drop;
  else
    update public.crm_contact_private set contact_id = p_keep where contact_id = p_drop;
  end if;
  update public.crm_contacts set
    do_not_contact = k.do_not_contact or d.do_not_contact,
    dnc_reason = case when k.do_not_contact then k.dnc_reason when d.do_not_contact then d.dnc_reason else k.dnc_reason end,
    dnc_at = case when k.do_not_contact then k.dnc_at when d.do_not_contact then d.dnc_at else k.dnc_at end,
    dnc_by = case when k.do_not_contact then k.dnc_by when d.do_not_contact then d.dnc_by else k.dnc_by end,
    sms_consent = coalesce(k.sms_consent, d.sms_consent),
    sms_consent_source = case when k.sms_consent is null and d.sms_consent is not null then d.sms_consent_source else k.sms_consent_source end,
    sms_consent_at = case when k.sms_consent is null and d.sms_consent is not null then d.sms_consent_at else k.sms_consent_at end,
    job_title = coalesce(nullif(k.job_title, ''), d.job_title),
    whatsapp_opt_out = coalesce(k.whatsapp_opt_out, false) or coalesce(d.whatsapp_opt_out, false)
  where id = p_keep;$x$);
    execute v;
  end if;

  -- 1.10 wa_app_config_guard: only admins change the keela_ settings (admins are exactly who passes wa_can('import_admin'))
  v := pg_get_functiondef('public.wa_app_config_guard()'::regprocedure);
  if position($x$keela\_%$x$ in v) = 0 then
    a1 := $x$k like 'mail\_%'$x$;
    if length(v) - length(replace(v, a1, '')) <> length(a1) then raise exception 'wave281: a live function moved: wa_app_config_guard'; end if;
    v := replace(v, a1, $x$k like 'keela\_%' or k like 'mail\_%'$x$);
    execute v;
  end if;
end $wa281$;

-- the patched functions keep their live grants (re-applied) and get comments that say what wave281 added
revoke all on function public.crm_email_permission(bigint, text) from public, anon;
grant execute on function public.crm_email_permission(bigint, text) to authenticated, service_role;
revoke all on function public.wa171_opted_out(bigint, text) from public, anon, authenticated;
grant execute on function public.wa171_opted_out(bigint, text) to service_role;
revoke all on function public.wa171_inbound(jsonb) from public, anon, authenticated;
grant execute on function public.wa171_inbound(jsonb) to service_role;
revoke all on function public.wa254_inbound(jsonb) from public, anon, authenticated;
grant execute on function public.wa254_inbound(jsonb) to service_role;
revoke all on function public.crm_refresh_implied_consent() from public, anon;
grant execute on function public.crm_refresh_implied_consent() to authenticated, service_role;
revoke all on function public.crm_merge_contacts(bigint, bigint) from public, anon;
grant execute on function public.crm_merge_contacts(bigint, bigint) to authenticated, service_role;
revoke all on function public.wa_app_config_guard() from public, anon, authenticated;
grant execute on function public.wa_app_config_guard() to service_role;
comment on function public.crm_email_permission(bigint, text) is 'The CASL rule for one contact and one kind of message (wave154; the volunteer kind wave155b). transactional/test: any working address. volunteer: any working address that has not unsubscribed (Steel, 27/09/26). newsletter/fundraising: express consent, or implied consent within two years of a gift or a serving; fundraising also under the exemption setting. Bounced and complained get nothing; since wave281 a do-not-contact person gets nothing either, transactional included (basis do not contact).';
comment on function public.wa171_opted_out(bigint, text) is 'wave171: true when the volunteer (or anyone with that number) replied STOP or was marked no texts in the CRM (crm_contacts.sms_opt_out); since wave281 also when the number''s latest SMS keyword text was a STOP (wa_stopped_phones_v, channel sms), even if no contact holds it.';
comment on function public.wa254_inbound(jsonb) is 'wave254: files a WhatsApp reply ({phone, text, button, wamid, at}) from whatsapp-send: stored in whatsapp_messages, STOP always honoured (crm_contacts.whatsapp_opt_out); YES / NO (or the template''s buttons) act on the last template sent to that number in 14 days (a serving confirmation through volunteer_confirm_submit, a "still in?" through wa239_pool_answer) only when sms_whatsapp_mode is live, or test and the number is a test phone; a thank-you is queued on WhatsApp. The consent log records WhatsApp STOP (wave281). Service role only.';
comment on function public.wa171_inbound(jsonb) is 'wave171: files an incoming text ({phone, text, quo_id, at}) in quo_messages (direction in, once per quo_id) matched to the volunteer and their next serving, then acts on keywords: STOP/ARRET always sets crm_contacts.sms_opt_out; while sms_mode is live (or test, for the test phones) YES/OUI confirms the roster row, NO/NON marks it Unavailable (both queue a short thank-you, kind ack), START opts back in; anything else is a question for the team (wave169b). The consent log records STOP text and START text (wave281). Service role only (quo-events).';
comment on function public.crm_refresh_implied_consent() is 'Writes implied consent onto the contacts (wave154): every live contact who is not express, unsubscribed, bounced or complained and who gave or served within two years gets email_consent implied, implied_consent_until two years after that last gift or serving, and a consent_source that says so. Never shortens a consent recorded by the team. Admins (the Email tab) and the daily cron job wa-crm-consent run it; returns the counts. The consent log records it as daily implied-consent refresh (wave281).';
comment on function public.crm_merge_contacts(bigint, bigint) is 'Keep one contact and merge the other into it: the history, gifts, old website history and organizations move, the lists join up, the copy fills the gaps in the details, two volunteer records become one (volunteer_merge). Since wave281 also the chapters, the consent log, Campaign rows and private data move, and the kept contact takes from the other what it lacks: do-not-contact with its reason, time and author (on wins), text consent with its source and date, the job title, and the WhatsApp opt-out (on wins). Staff with the CRM page; logged in change_log.';
comment on function public.wa_app_config_guard() is 'Trigger on app_config: only admins (or the service role) change the mail_, receipt_, donate_, loom_, sms_ and cert_ settings and, since wave260, dashboard_people, page_gate, page_gate_exempt and page_gate_map, and since wave281 the keela_ settings. Other staff keep their existing app_config rights.';

-- the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave281', 'wave281', null,
       'CRM rules: chapters (' || (select count(*) from public.crm_contact_chapters where chapter = 'toronto') || ' Toronto, '
       || (select count(*) from public.crm_contact_chapters where chapter = 'montreal') || ' Montreal from evidence), the consent log ('
       || (select count(*) from public.crm_consent_events) || ' rows loaded), do-not-contact, STOP that sticks to the number, private birth dates, Campaigns ('
       || (select count(*) from public.crm_donations where campaign_id is not null) || ' gifts linked), organisation fields, wa_can.', 'wave281'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave281' and field = 'wave281');
