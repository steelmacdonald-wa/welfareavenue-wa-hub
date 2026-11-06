-- Welfare Avenue Hub: wave284, 06/11/26. Hub CRM slice 1, Phase 4: the Import page (design CRM-S1 v2, Phase 4, items 23 to 28; B.1).
-- Admins stage Keela's exports, compare each kind of import with the Hub, and apply it in reviewed batches with an undo. It adds: the private
-- bucket imports; the schema import_stage (the staged rows, reachable by nobody but these functions); crm_import_runs, crm_import_batches and
-- crm_import_changes (admins read them); the mapping settings (app_config keela_*); the wa284_* functions (the service role only: the crm-import
-- edge function calls them after checking wa_can('import_admin') as the caller); and a guard trigger on nine tables that refuses any row an
-- import would write there (requests, emails, texts, automations, notifications, applications, form answers, roster rows).
-- Needs wave281 first (wa_can, the chapter, consent, private-data and Campaign tables): the file stops at the top without it. It changes no live
-- function. Every step is guarded, so the file is safe to run twice. Undo: build/data/wa284_undo.sql. No transaction control: the release runs it
-- through the Supabase connector, and build/sql_rollback_test.py runs it inside a block that rolls back. Proved offline first: node test/w284sql.mjs
-- (PGlite). Built 06/11/26, not released. Rule for Claude sessions: never query import_stage (it holds Keela's raw rows); read the reports instead.

do $wa284$
begin
  if to_regprocedure('public.wa_can(text)') is null or to_regclass('public.crm_contact_chapters') is null or to_regclass('public.wa_campaign_people') is null
     or to_regclass('public.crm_contact_private') is null or to_regclass('public.crm_consent_events') is null then
    raise exception 'wave284 needs wave281 first (wa_can and the chapter, consent, private-data and Campaign tables are missing)';
  end if;
end $wa284$;

-- ============================================================================================ 1. runs, batches and change records
create table if not exists public.crm_import_runs (
  id bigserial primary key,
  label text,
  created_by text,
  created_at timestamptz default now(),
  last_applied_at timestamptz,
  purged_at timestamptz
);
alter table public.crm_import_runs enable row level security;
revoke all on table public.crm_import_runs from public, anon, authenticated;
grant select on table public.crm_import_runs to authenticated;
grant all on table public.crm_import_runs to service_role;
revoke all on sequence public.crm_import_runs_id_seq from public, anon, authenticated;
drop policy if exists crm_import_runs_admin_read on public.crm_import_runs;
create policy crm_import_runs_admin_read on public.crm_import_runs for select to authenticated using (public.wa_can('import_admin'));
comment on table public.crm_import_runs is 'wave284: one Keela import run on the Import page (#crm/settings/imports): its staged files (import_stage.files), its batches (crm_import_batches) and their change records. Admins (wa_can import_admin) read it; only the wa284_* functions write it (the crm-import edge function).';
comment on column public.crm_import_runs.id is 'wave284: the run''s number.';
comment on column public.crm_import_runs.label is 'wave284: a name for the run, typed by the admin who started it (for example Keela final export).';
comment on column public.crm_import_runs.created_by is 'wave284: the email of the admin who started the run.';
comment on column public.crm_import_runs.created_at is 'wave284: when the run was started.';
comment on column public.crm_import_runs.last_applied_at is 'wave284: when a batch of this run was last applied. The page reminds the admin to purge the run 30 days after it.';
comment on column public.crm_import_runs.purged_at is 'wave284: when the run was purged (wa284_purge): its staged rows, uploaded files and change records are gone, so its batches can no longer be compared, applied or undone.';

create table if not exists public.crm_import_batches (
  id bigserial primary key,
  run_id bigint references public.crm_import_runs(id) on delete cascade,
  kind text check (kind in ('optouts', 'legacy_fields', 'people', 'fields', 'orgs', 'consent', 'participation', 'form_answers')),
  status text not null default 'new' check (status in ('new', 'compared', 'applied', 'undone', 'failed')),
  report jsonb,
  error text,
  applied_at timestamptz,
  applied_by text,
  undone_at timestamptz,
  undone_by text,
  unique (run_id, kind)
);
alter table public.crm_import_batches enable row level security;
revoke all on table public.crm_import_batches from public, anon, authenticated;
grant select on table public.crm_import_batches to authenticated;
grant all on table public.crm_import_batches to service_role;
revoke all on sequence public.crm_import_batches_id_seq from public, anon, authenticated;
drop policy if exists crm_import_batches_admin_read on public.crm_import_batches;
create policy crm_import_batches_admin_read on public.crm_import_batches for select to authenticated using (public.wa_can('import_admin'));
comment on table public.crm_import_batches is 'wave284: one kind of import applied once in a run (B.1): optouts, legacy_fields, people, fields, orgs, consent, participation, form_answers, run in that order. Compare runs the writer and rolls it back, keeping only the report; Apply runs it for real with automations off and the side-effect guard on; Undo puts back what is unchanged since (never for optouts and consent). Admins read it; only the wa284_* functions write it.';
comment on column public.crm_import_batches.id is 'wave284: the batch''s number (wa.import_batch while it runs; crm_consent_events.import_batch_id).';
comment on column public.crm_import_batches.run_id is 'wave284: the run (crm_import_runs). One batch per kind per run.';
comment on column public.crm_import_batches.kind is 'wave284: which import: optouts, legacy_fields, people, fields, orgs, consent, participation or form_answers (the B.1 table).';
comment on column public.crm_import_batches.status is 'wave284: new, compared (a report is ready), applied, undone, or failed (the error says why, with row numbers, never values).';
comment on column public.crm_import_batches.report is 'wave284: the report of the last compare, apply or undo: {kind, counts {rows_read, matched, created, updated {field: n}, kept_hub_value {field: n}, skipped {reason: n}}, lists {keela_ids_skipped, org_pairs, assignees_unmapped, campaigns_to_create, changed_since_kept, created_review, ...}, changes}. Lists hold Keela ids, Hub ids, staff names, organisation names and Keela option labels only: never an email, phone, address, birth date or note.';
comment on column public.crm_import_batches.error is 'wave284: why the last compare or apply stopped (missing key <name>, a row number, or the database''s error code); never a value from the data.';
comment on column public.crm_import_batches.applied_at is 'wave284: when the batch was applied.';
comment on column public.crm_import_batches.applied_by is 'wave284: the email of the admin who applied it.';
comment on column public.crm_import_batches.undone_at is 'wave284: when the batch was undone.';
comment on column public.crm_import_batches.undone_by is 'wave284: the email of the admin who undid it.';

create table if not exists public.crm_import_changes (
  id bigserial primary key,
  batch_id bigint references public.crm_import_batches(id) on delete cascade,
  table_name text,
  row_id text,
  column_name text,
  old_value jsonb,
  new_value jsonb,
  action text check (action in ('insert', 'update')),
  sensitive boolean default false
);
create index if not exists crm_import_changes_batch_idx on public.crm_import_changes (batch_id, id);
alter table public.crm_import_changes enable row level security;
revoke all on table public.crm_import_changes from public, anon, authenticated;
grant select on table public.crm_import_changes to authenticated;
grant all on table public.crm_import_changes to service_role;
revoke all on sequence public.crm_import_changes_id_seq from public, anon, authenticated;
drop policy if exists crm_import_changes_admin_read on public.crm_import_changes;
create policy crm_import_changes_admin_read on public.crm_import_changes for select to authenticated using (public.wa_can('import_admin'));
comment on table public.crm_import_changes is 'wave284: every change an applied import batch made, one row per changed column or inserted row, in order: what wa284_undo reads. A birth date is never kept here (sensitive rows store "set"). Deleted by wa284_purge. Admins read it; only the wa284_* functions write it.';
comment on column public.crm_import_changes.id is 'wave284: the order the changes were made in (undo walks it backwards).';
comment on column public.crm_import_changes.batch_id is 'wave284: the batch (crm_import_batches).';
comment on column public.crm_import_changes.table_name is 'wave284: the table changed (crm_contacts, wa_partners, wa_campaigns, crm_contact_fields, crm_contact_private, crm_contact_orgs, crm_contact_chapters, wa_campaign_people, crm_interactions, crm_consent_events).';
comment on column public.crm_import_changes.row_id is 'wave284: the row: its id, or its key parts joined by colons (crm_contact_fields contact:field, crm_contact_chapters contact:chapter, wa_campaign_people campaign:contact:part).';
comment on column public.crm_import_changes.column_name is 'wave284: the column changed (for an update), or the custom field or column written (for an insert).';
comment on column public.crm_import_changes.old_value is 'wave284: the value before an update, as JSON; null for an insert.';
comment on column public.crm_import_changes.new_value is 'wave284: the value after an update, or the whole inserted row, as JSON; "set" for a sensitive row (a birth date), whose value is never kept.';
comment on column public.crm_import_changes.action is 'wave284: insert or update.';
comment on column public.crm_import_changes.sensitive is 'wave284: true for a birth date: new_value says "set" and holds no value.';

-- ============================================================================================ 2. the staged rows (import_stage: no grants at all)
create schema if not exists import_stage;
revoke all on schema import_stage from public, anon, authenticated;
comment on schema import_stage is 'wave284: Keela''s exports staged for the Import page, one jsonb per row. No role but the database owner reaches it: only the wa284_* functions read and write it, and wa284_purge empties a run. Claude sessions never query it.';
create table if not exists import_stage.files (
  id bigserial primary key,
  run_id bigint references public.crm_import_runs(id) on delete cascade,
  name text,
  kind text check (kind in ('keela_contacts_json', 'keela_responses_json', 'keela_interactions_csv', 'keela_transactions_csv')),
  rows int,
  staged_through int,
  staged_at timestamptz
);
create table if not exists import_stage.rows (
  run_id bigint,
  file_id bigint references import_stage.files(id) on delete cascade,
  row_no int,
  data jsonb,
  primary key (file_id, row_no)
);
create index if not exists rows_run_idx on import_stage.rows (run_id);
alter table import_stage.files enable row level security;
alter table import_stage.rows enable row level security;
revoke all on all tables in schema import_stage from public, anon, authenticated, service_role;
revoke all on all sequences in schema import_stage from public, anon, authenticated, service_role;
comment on table import_stage.files is 'wave284: one uploaded Keela export in a run: its path in the imports bucket, its kind, how many rows it has and how many are staged. Reached only through the wa284_* functions.';
comment on column import_stage.files.id is 'wave284: the file''s number.';
comment on column import_stage.files.run_id is 'wave284: the run (crm_import_runs).';
comment on column import_stage.files.name is 'wave284: the file''s path in the private bucket imports (<run>/<time>-<name>).';
comment on column import_stage.files.kind is 'wave284: keela_contacts_json (export 15, people and companies), keela_responses_json (export 12), keela_interactions_csv or keela_transactions_csv.';
comment on column import_stage.files.rows is 'wave284: how many rows the file holds (set when staging starts).';
comment on column import_stage.files.staged_through is 'wave284: how many rows are staged so far; the file is ready when it equals rows.';
comment on column import_stage.files.staged_at is 'wave284: when rows were last staged.';
comment on table import_stage.rows is 'wave284: one row of a staged file, as one jsonb object (the CSV header or the JSON record''s keys). Staging a file from row 0 first deletes its rows. Reached only through the wa284_* functions; never queried by Claude sessions.';
comment on column import_stage.rows.run_id is 'wave284: the run (crm_import_runs).';
comment on column import_stage.rows.file_id is 'wave284: the file (import_stage.files).';
comment on column import_stage.rows.row_no is 'wave284: the row''s number in the file, from 1 (errors name it, never its values).';
comment on column import_stage.rows.data is 'wave284: the row''s keys and values as Keela exported them.';

-- ============================================================================================ 3. the private bucket imports
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, 104857600, array['application/json', 'text/csv'])
on conflict (id) do update set public = false, file_size_limit = 104857600, allowed_mime_types = array['application/json', 'text/csv'];
drop policy if exists wa284_imports_insert on storage.objects;
create policy wa284_imports_insert on storage.objects for insert to authenticated with check (bucket_id = 'imports' and public.wa_can('import_admin'));
drop policy if exists wa284_imports_select on storage.objects;
create policy wa284_imports_select on storage.objects for select to authenticated using (bucket_id = 'imports' and public.wa_can('import_admin'));
drop policy if exists wa284_imports_delete on storage.objects;
create policy wa284_imports_delete on storage.objects for delete to authenticated using (bucket_id = 'imports' and public.wa_can('import_admin'));

-- ============================================================================================ 4. the mapping settings (keela_: admins only, wave281 item 1.10)
-- keela_keys holds only the key names that differ from the defaults in wa284_key (the [FIELDS] names) and the subscription history key, which has
-- no default: an admin picks it from the Keys list before batch 1's compare. A key set to "" means "not in this export" (that field is skipped).
insert into public.app_config (key, value)
select x.k, x.v
  from (values
    ('keela_assignee_map', '{}'),
    ('keela_org_pairs_ok', '[]'),
    ('keela_company_category_map', '{}'),
    ('keela_status_map', '{"To contact": "prospect", "Developing": "prospect", "Established relationship": "active"}'),
    ('keela_tag_map', '{"Rally Paper Participant": {"campaign": "Rally Paper 2026", "part": "participant"}, "Flag Football 2025": {"campaign": "Football Fundraiser 2025", "part": "participant"}, "2026 Gift Basket Volunteer": {"campaign": "Gift Basket Drive 2026", "part": "volunteer"}, "Toronto Contacts": {"chapter": "toronto"}, "Toronto Volunteers": {"chapter": "toronto"}, "Welcome Series Exit #1": {"skip": true}, "Donor": {"skip": true}, "Past Donor": {"skip": true}, "Reoccurring Donor": {"skip": true}}'),
    ('keela_keys', '{}'),
    ('keela_campaign_types', '{}')
  ) as x(k, v)
 where not exists (select 1 from public.app_config c where c.key = x.k);

create index if not exists crm_contacts_wa284_keela_idx on public.crm_contacts ((legacy_refs -> 'keela' ->> 'contact_id'));
comment on index public.crm_contacts_wa284_keela_idx is 'wave284: finds a contact by its Keela contact id (the import matches on it first).';

-- ============================================================================================ 5. helpers (the service role only)
create or replace function public.wa284_cfg(p_key text)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select case when c.value is null or btrim(c.value) = '' then null else c.value::jsonb end from public.app_config c where c.key = p_key
$function$;
comment on function public.wa284_cfg(text) is 'wave284: an app_config value read as JSON (null when missing or empty). The service role only.';

create or replace function public.wa284_key(p_name text)
returns text language sql stable security definer set search_path to '' as $function$
  select case when jsonb_typeof(k.o) = 'object' and k.o ? p_name then nullif(k.o ->> p_name, '')
              else '{"contact_id": "Contact Id", "contact_type": "Contact Type", "full_name": "Full Name", "first_name": "First Name", "last_name": "Last Name",
                     "email": "Primary Email", "phone": "Primary Phone", "street": "Street", "line2": "Street Line 2", "city": "City", "province": "Province",
                     "postal_code": "Postal Code", "country": "Country", "notes": "Notes", "job_title": "Title", "birth_date": "Birth Date",
                     "car": "Car: \"Make, Model, Type\"", "linkedin": "LinkedIn", "food_licence": "Food Licensing Certification", "tags": "Tags",
                     "companies": "Companies", "company_name": "Full Name", "company_type": "Company Type", "org_status": "Status", "org_goal": "Goal",
                     "sub_date": "date", "sub_type": "type", "sub_form": "form_name", "sub_channel": "channel",
                     "resp_id": "Response Id", "resp_form": "Form Name", "resp_contact": "Contact Id", "resp_email": "Email", "resp_date": "Submitted Date",
                     "resp_answers": "Answers", "ans_q": "question", "ans_a": "answer"}'::jsonb ->> p_name end
    from (select coalesce(public.wa284_cfg('keela_keys'), '{}'::jsonb) as o) k
$function$;
comment on function public.wa284_key(text) is 'wave284: the key in Keela''s export that holds a field (contact_id, email, birth_date, subscription_history, ...): app_config keela_keys when it names the field, else the [FIELDS] name. subscription_history has no default. A key set to "" means the export has no such key. The service role only.';

create or replace function public.wa284_need(p_file bigint, p_name text, p_required boolean default true)
returns text language plpgsql stable security definer set search_path to '' as $function$
declare k text := public.wa284_key(p_name); o jsonb := coalesce(public.wa284_cfg('keela_keys'), '{}'::jsonb);
begin
  if k is null then
    if (jsonb_typeof(o) = 'object' and o ? p_name) or not p_required then return null; end if;
    raise exception 'missing key % (set app_config keela_keys.% to the key the Keys list shows)', p_name, p_name;
  end if;
  if not exists (select 1 from import_stage.rows r where r.file_id = p_file and r.data ? k) then
    if not p_required then return null; end if;
    raise exception 'missing key %', k;
  end if;
  return k;
end $function$;
comment on function public.wa284_need(bigint, text, boolean) is 'wave284: the key a writer reads for a field, checked against the staged file: it stops the writer with "missing key <name>" when no row has it (a field marked "" in keela_keys, or an optional one, is skipped instead). The service role only.';

create or replace function public.wa284_need_in(p_file bigint, p_list text, p_name text)
returns text language plpgsql stable security definer set search_path to '' as $function$
declare k text := public.wa284_key(p_name);
begin
  if k is null then return null; end if;
  if not exists (select 1 from import_stage.rows r, jsonb_array_elements(case when jsonb_typeof(r.data -> p_list) = 'array' then r.data -> p_list else '[]'::jsonb end) e
                  where r.file_id = p_file and jsonb_typeof(e) = 'object' and e ? k) then
    raise exception 'missing key % (in %)', k, p_list;
  end if;
  return k;
end $function$;
comment on function public.wa284_need_in(bigint, text, text) is 'wave284: like wa284_need for a key inside the objects of a list (the subscription history''s date, type and form name). The service role only.';

create or replace function public.wa284_txt(j jsonb)
returns text language sql immutable set search_path to '' as $function$
  select case jsonb_typeof(j) when 'string' then nullif(nullif(btrim(j #>> '{}'), ''), '-') when 'number' then j #>> '{}' else null end
$function$;
comment on function public.wa284_txt(jsonb) is 'wave284: a staged value as trimmed text; null for blank, "-", null, lists and objects. The service role only.';

create or replace function public.wa284_list(j jsonb)
returns text[] language sql immutable set search_path to '' as $function$
  select coalesce(case jsonb_typeof(j)
    when 'array' then (select array_agg(y.t order by y.o) from (select coalesce(public.wa284_txt(x.e), public.wa284_txt(x.e -> 'name'), public.wa284_txt(x.e -> 'label')) as t, x.o
                                                                  from jsonb_array_elements(j) with ordinality as x(e, o)) y where y.t is not null)
    when 'string' then (select array_agg(btrim(u.t) order by u.o) from unnest(string_to_array(j #>> '{}', ', ')) with ordinality as u(t, o) where nullif(nullif(btrim(u.t), ''), '-') is not null)
    else null end, '{}'::text[])
$function$;
comment on function public.wa284_list(jsonb) is 'wave284: a staged value as a list of text: a JSON list as it is (an object''s name or label), a text split on ", ". The service role only.';

create or replace function public.wa284_date(p text)
returns date language plpgsql immutable set search_path to '' as $function$
declare s text := btrim(coalesce(p, '')); y int; m int; d int;
begin
  -- checked part by part, so a wrong date never reaches a cast (its error would name the value)
  if s !~ '^\d{4}-\d{2}-\d{2}($|[T ])' then return null; end if;
  y := substr(s, 1, 4)::int; m := substr(s, 6, 2)::int; d := substr(s, 9, 2)::int;
  if y < 1900 or y > 2100 or m < 1 or m > 12 or d < 1 then return null; end if;
  if d > extract(day from (make_date(y, m, 1) + interval '1 month - 1 day'))::int then return null; end if;
  return make_date(y, m, d);
end $function$;
comment on function public.wa284_date(text) is 'wave284: an ISO date (YYYY-MM-DD, with or without a time) as a date, or null when it is anything else or not a real day. Never raises, so no error names a value. The service role only.';

create or replace function public.wa284_norm(p text)
returns text language sql immutable set search_path to '' as $function$
  select btrim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[[:punct:]]+', ' ', 'g'), '\m(inc|ltd|corp)\M', ' ', 'g'), '\s+', ' ', 'g'))
$function$;
comment on function public.wa284_norm(text) is 'wave284: an organisation name normalised for matching: lower case, no punctuation, without the words inc, ltd and corp. The service role only.';

create or replace function public.wa284_w0()
returns jsonb language sql immutable set search_path to '' as $function$
  select '{"counts": {"rows_read": 0, "matched": 0, "kept_hub_value": {}, "skipped": {}}, "lists": {}}'::jsonb
$function$;
comment on function public.wa284_w0() is 'wave284: an empty writer result (counts and lists) that each writer fills in. The service role only.';

create or replace function public.wa284_bump(j jsonb, p_path text[], n int default 1)
returns jsonb language sql immutable set search_path to '' as $function$
  select jsonb_set(case when cardinality(p_path) > 2 and (j #> p_path[1:cardinality(p_path) - 1]) is null
                        then jsonb_set(j, p_path[1:cardinality(p_path) - 1], '{}'::jsonb, true) else j end,
                   p_path, to_jsonb(coalesce((j #>> p_path)::int, 0) + n), true)
$function$;
comment on function public.wa284_bump(jsonb, text[], int) is 'wave284: adds n to a count in a writer result. The service role only.';

create or replace function public.wa284_push(j jsonb, p_list text, p_item jsonb)
returns jsonb language sql immutable set search_path to '' as $function$
  select case when coalesce(j #> array['lists', p_list], '[]'::jsonb) @> jsonb_build_array(p_item) then j
              else jsonb_set(j, array['lists', p_list], coalesce(j #> array['lists', p_list], '[]'::jsonb) || jsonb_build_array(p_item), true) end
$function$;
comment on function public.wa284_push(jsonb, text, jsonb) is 'wave284: adds an item (a Keela id, a Hub id, a staff or organisation name) to a list in a writer result, once. The service role only.';

create or replace function public.wa284_chg(p_batch bigint, p_table text, p_row text, p_col text, p_old jsonb, p_new jsonb, p_action text, p_sensitive boolean default false)
returns void language sql security definer set search_path to '' as $function$
  insert into public.crm_import_changes (batch_id, table_name, row_id, column_name, old_value, new_value, action, sensitive)
  values (p_batch, p_table, p_row, p_col, case when p_sensitive then null else p_old end, case when p_sensitive then '"set"'::jsonb else p_new end, p_action, p_sensitive)
$function$;
comment on function public.wa284_chg(bigint, text, text, text, jsonb, jsonb, text, boolean) is 'wave284: records one change of an import batch in crm_import_changes; a sensitive change keeps "set" and never the value. The service role only.';

create or replace function public.wa284_set(p_table text, p_id bigint, p_col text, p_val jsonb)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if p_table not in ('crm_contacts', 'wa_partners') then raise exception 'wa284: wa284_set does not write %', p_table; end if;
  execute format('update public.%I t set %I = (jsonb_populate_record(null::public.%I, jsonb_build_object(%L, $1::jsonb))).%I where t.id = $2', p_table, p_col, p_table, p_col, p_col)
    using p_val, p_id;
end $function$;
comment on function public.wa284_set(text, bigint, text, jsonb) is 'wave284: writes one column of one crm_contacts or wa_partners row from a JSON value (any column type). The service role only.';

create or replace function public.wa284_upd(p_batch bigint, p_table text, p_id bigint, p_col text, p_new jsonb)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare v_old jsonb;
begin
  if p_table not in ('crm_contacts', 'wa_partners') then raise exception 'wa284: wa284_upd does not write %', p_table; end if;
  execute format('select to_jsonb(t.%I) from public.%I t where t.id = $1', p_col, p_table) into v_old using p_id;
  if v_old is not distinct from p_new then return false; end if;
  perform public.wa284_set(p_table, p_id, p_col, p_new);
  perform public.wa284_chg(p_batch, p_table, p_id::text, p_col, v_old, p_new, 'update');
  return true;
end $function$;
comment on function public.wa284_upd(bigint, text, bigint, text, jsonb) is 'wave284: changes one column of one crm_contacts or wa_partners row and records the old and new value in crm_import_changes; does nothing when the value is already that. The service role only.';

create or replace function public.wa284_fill(p_batch bigint, p_table text, p_id bigint, p_col text, p_hub text, p_keela text, w jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  if p_keela is null then return w; end if;
  if p_hub is null or btrim(p_hub) = '' then
    perform public.wa284_upd(p_batch, p_table, p_id, p_col, to_jsonb(p_keela));
  elsif lower(btrim(p_hub)) <> lower(btrim(p_keela)) then
    w := public.wa284_bump(w, array['counts', 'kept_hub_value', p_col]);
  end if;
  return w;
end $function$;
comment on function public.wa284_fill(bigint, text, bigint, text, text, text, jsonb) is 'wave284: fills an empty text column from Keela; when the Hub already holds a different value the Hub wins and kept_hub_value counts it. The service role only.';

create or replace function public.wa284_field(p_batch bigint, p_contact bigint, p_key text, p_value jsonb)
returns text language plpgsql security definer set search_path to '' as $function$
declare v_fid bigint; v_old jsonb; r public.crm_contact_fields;
begin
  select f.id into v_fid from public.crm_fields f where f.key = p_key;
  if v_fid is null then raise exception 'wa284: the custom field % is missing', p_key; end if;
  select cf.value into v_old from public.crm_contact_fields cf where cf.contact_id = p_contact and cf.field_id = v_fid;
  if found then return case when v_old = p_value then 'same' else 'kept' end; end if;
  insert into public.crm_contact_fields (contact_id, field_id, value, source, updated_by)
  values (p_contact, v_fid, p_value, 'keela import', 'Keela import') returning * into r;
  perform public.wa284_chg(p_batch, 'crm_contact_fields', p_contact || ':' || v_fid, p_key, null, to_jsonb(r), 'insert');
  return 'set';
end $function$;
comment on function public.wa284_field(bigint, bigint, text, jsonb) is 'wave284: sets a custom field (crm_contact_fields) for a contact only when it has no value yet, and records the insert; says set, same or kept (the Hub''s value wins). The service role only.';

create or replace function public.wa284_contact(p_kid text, p_email text)
returns bigint language sql stable security definer set search_path to '' as $function$
  select coalesce(
    (select c.id from public.crm_contacts c
      where c.merged_into is null and p_kid is not null
        and ((c.legacy_refs -> 'keela' ->> 'contact_id') = p_kid or coalesce(c.legacy_refs -> 'keela_extra_ids', '[]'::jsonb) ? p_kid)
      order by c.id limit 1),
    (select c.id from public.crm_contacts c
      where c.merged_into is null and nullif(p_email, '') is not null
        and (lower(btrim(c.primary_email)) = lower(btrim(p_email)) or exists (select 1 from unnest(c.emails) e where lower(btrim(e)) = lower(btrim(p_email))))
      order by c.id limit 1))
$function$;
comment on function public.wa284_contact(text, text) is 'wave284: the active Hub contact for a Keela person: by Keela id (legacy_refs.keela.contact_id or keela_extra_ids), then by email (lower case, trimmed). Never by phone alone. The service role only.';

create or replace function public.wa284_file(p_run bigint, p_kind text)
returns bigint language plpgsql stable security definer set search_path to '' as $function$
declare v bigint;
begin
  select f.id into v from import_stage.files f
   where f.run_id = p_run and f.kind = p_kind and f.rows is not null and f.staged_through = f.rows
   order by f.id desc limit 1;
  if v is null then raise exception 'wa284: this run has no fully staged % file', p_kind; end if;
  return v;
end $function$;
comment on function public.wa284_file(bigint, text) is 'wave284: the run''s latest fully staged file of a kind; stops when there is none. The service role only.';

create or replace function public.wa284_ev_kind(p_type text)
returns text language sql immutable set search_path to '' as $function$
  select case when x.t ~* 'spam|complain|abuse' then 'complaint'
              when x.t ~* 'unsubscri|opt(ed)?[ -]?out' then 'unsubscribe'
              when x.t ~* 'bounce' and x.t !~* 'soft' then 'bounce'
              when x.t ~* 'opt(ed)?[ -]?in|subscri' then 'optin'
              else 'other' end
    from (select coalesce(p_type, '') as t) x
$function$;
comment on function public.wa284_ev_kind(text) is 'wave284: the kind of a Keela subscription event from its type''s words: complaint (spam, complaint, abuse), unsubscribe (unsubscribed, opted out), bounce (a bounce that is not soft), optin (opted in, subscribed) or other. The service role only.';

create or replace function public.wa284_events(p_list jsonb, p_kd text, p_kt text, p_kf text, p_kc text)
returns table (occurred date, at_text text, kind text, channel text, type_text text, form text)
language sql immutable set search_path to '' as $function$
  select public.wa284_date(public.wa284_txt(x.e -> p_kd)), public.wa284_txt(x.e -> p_kd),
         public.wa284_ev_kind(y.t),
         case when coalesce(public.wa284_txt(x.e -> p_kc), y.t) ~* '\m(text|sms)\M' then 'sms' else 'email' end,
         left(y.t, 80), public.wa284_txt(x.e -> p_kf)
    from jsonb_array_elements(case when jsonb_typeof(p_list) = 'array' then p_list else '[]'::jsonb end) as x(e)
    cross join lateral (select coalesce(public.wa284_txt(x.e -> p_kt), '') as t) y
   where jsonb_typeof(x.e) = 'object'
$function$;
comment on function public.wa284_events(jsonb, text, text, text, text) is 'wave284: a Keela person''s subscription history as rows: the date (ISO only; anything else is undated), the kind (wa284_ev_kind: complaint, unsubscribe, bounce, optin or other), the channel (sms when the type or channel says text or SMS, else email), the type''s words and the form name. The service role only.';

-- the opt-out a channel's history says to honour (Steel: every unsubscribe and bounce is honoured)
create or replace function public.wa284_ev_rows(p_list jsonb, p_kd text, p_kt text, p_kc text, p_channel text)
returns table (pos bigint, d date, at_text text, kind text)
language sql immutable set search_path to '' as $function$
  select x.o, public.wa284_date(public.wa284_txt(x.e -> p_kd)), public.wa284_txt(x.e -> p_kd), public.wa284_ev_kind(public.wa284_txt(x.e -> p_kt))
    from jsonb_array_elements(case when jsonb_typeof(p_list) = 'array' then p_list else '[]'::jsonb end) with ordinality as x(e, o)
   where jsonb_typeof(x.e) = 'object'
     and (case when coalesce(public.wa284_txt(x.e -> p_kc), public.wa284_txt(x.e -> p_kt), '') ~* '\m(text|sms)\M' then 'sms' else 'email' end) = p_channel
$function$;
comment on function public.wa284_ev_rows(jsonb, text, text, text, text) is 'wave284: one channel''s events of a Keela subscription history, with their place in the list (pos), date (null when it cannot be read), date text and kind. The service role only.';

create or replace function public.wa284_opt_state(p_list jsonb, p_kd text, p_kt text, p_kc text, p_channel text,
  out optout text, out optout_date date, out undated int, out undated_optouts int, out overridden int, out latest_kind text, out latest_date date)
language plpgsql immutable set search_path to '' as $function$
declare v_lpos bigint; v_order text; u record; v_rank jsonb := '{"unsubscribe": 1, "bounce": 2, "complaint": 3}';
begin
  undated := 0; undated_optouts := 0; overridden := 0;
  select count(*) into undated from public.wa284_ev_rows(p_list, p_kd, p_kt, p_kc, p_channel) t where t.d is null;
  -- the latest dated event
  select t.kind, t.d, t.pos into latest_kind, latest_date, v_lpos from public.wa284_ev_rows(p_list, p_kd, p_kt, p_kc, p_channel) t
   where t.d is not null and t.kind <> 'other' order by t.d desc, t.at_text desc, t.pos desc limit 1;
  if latest_kind in ('unsubscribe', 'bounce', 'complaint') then optout := latest_kind; optout_date := latest_date; end if;
  -- the list's order, when its dated events tell it: oldest first (asc) or newest first (desc); otherwise unknown
  select case when bool_and(z.d >= z.pd) and bool_or(z.d > z.pd) then 'asc' when bool_and(z.d <= z.pd) and bool_or(z.d < z.pd) then 'desc' end into v_order
    from (select t.d, lag(t.d) over (order by t.pos) as pd from public.wa284_ev_rows(p_list, p_kd, p_kt, p_kc, p_channel) t where t.d is not null) z
   where z.pd is not null;
  -- an opt-out with no readable date is honoured, unless the latest dated event is an opt-in that the list's known order puts after it
  for u in select t.kind, t.pos from public.wa284_ev_rows(p_list, p_kd, p_kt, p_kc, p_channel) t
            where t.d is null and t.kind in ('unsubscribe', 'bounce', 'complaint') order by t.pos loop
    undated_optouts := undated_optouts + 1;
    if latest_kind = 'optin' and ((v_order = 'asc' and v_lpos > u.pos) or (v_order = 'desc' and v_lpos < u.pos)) then overridden := overridden + 1; continue; end if;
    if optout is null or (v_rank ->> u.kind)::int > (v_rank ->> optout)::int then optout := u.kind; optout_date := null; end if;
  end loop;
end $function$;
comment on function public.wa284_opt_state(jsonb, text, text, text, text) is 'wave284: what one channel''s Keela history says (email or sms). optout: the opt-out to honour (unsubscribe, bounce or complaint), from the latest dated event, or from any event whose date cannot be read unless the latest dated event is an opt-in that the list''s known order (its dated events oldest first or newest first) puts after it; the strongest wins (complaint, bounce, unsubscribe). optout_date: its date, null when it came from an undated event. Also the counts of undated events, undated opt-outs and undated opt-outs overridden, and the latest dated event''s kind and date. The service role only.';

create or replace function public.wa284_optout_status(p_kind text)
returns text language sql immutable set search_path to '' as $function$
  select case p_kind when 'complaint' then 'complained' when 'bounce' then 'bounced' when 'unsubscribe' then 'unsubscribed' end
$function$;
comment on function public.wa284_optout_status(text) is 'wave284: the email_status a Keela opt-out sets: complaint complained (A.4: not a working address), bounce bounced, unsubscribe unsubscribed. The service role only.';

create or replace function public.wa284_optout_words(p_kind text, p_date date)
returns text language sql immutable set search_path to '' as $function$
  select 'Keela: ' || case p_kind when 'complaint' then 'spam complaint' when 'bounce' then 'hard bounce' else 'unsubscribe' end || ' '
         || coalesce(to_char(p_date, 'YYYY-MM-DD'), '(undated)')
$function$;
comment on function public.wa284_optout_words(text, date) is 'wave284: the consent_source words for a Keela opt-out: "Keela: unsubscribe 2025-06-01", "Keela: hard bounce ...", "Keela: spam complaint ...", or "(undated)" when its date could not be read. The service role only.';

create or replace function public.wa284_types(p_file bigint, p_key text)
returns int language plpgsql stable security definer set search_path to '' as $function$
declare n int;
begin
  if not exists (select 1 from import_stage.rows r where r.file_id = p_file and lower(coalesce(public.wa284_txt(r.data -> p_key), '')) in ('individual', 'company')) then
    raise exception 'wa284: no staged row has a % of Individual or Company; check the Keys list and the export', p_key;
  end if;
  select count(*) into n from import_stage.rows r where r.file_id = p_file and lower(coalesce(public.wa284_txt(r.data -> p_key), '')) not in ('individual', 'company');
  return n;
end $function$;
comment on function public.wa284_types(bigint, text) is 'wave284: stops a writer loudly when no staged row has a Contact Type of Individual or Company (the values the import knows), so a different spelling can never make a batch read nothing and skip every opt-out in silence; otherwise says how many rows have another type (the report counts them as skipped). The service role only.';

-- ============================================================================================ 6. the writers (B.1), one per kind; no exception blocks of their own
-- Each returns its counts and lists; every change goes through wa284_upd, wa284_field or an insert recorded with wa284_chg.

-- 1. optouts: the email opt-out the history says to honour (the latest dated one, or one with no readable date), on a Hub contact that can still be emailed
create or replace function public.wa284_w_optouts(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0();
  f bigint := public.wa284_file(p_run, 'keela_contacts_json');
  k_id text := public.wa284_need(f, 'contact_id'); k_type text := public.wa284_need(f, 'contact_type'); k_email text := public.wa284_need(f, 'email');
  k_hist text := public.wa284_need(f, 'subscription_history');
  k_d text := public.wa284_need_in(f, k_hist, 'sub_date'); k_t text := public.wa284_need_in(f, k_hist, 'sub_type'); k_f text := public.wa284_need_in(f, k_hist, 'sub_form');
  k_c text := public.wa284_key('sub_channel');
  v_other int := public.wa284_types(f, k_type);
  r record; o record; v_kid text; v_id bigint; v_st text; v_new text;
begin
  if v_other > 0 then w := public.wa284_bump(w, '{counts,skipped,unrecognised Contact Type}', v_other); end if;
  w := jsonb_set(w, '{counts,undated_events}', '0'::jsonb);
  for r in select x.row_no, x.data from import_stage.rows x
            where x.file_id = f and lower(coalesce(public.wa284_txt(x.data -> k_type), '')) = 'individual' order by x.row_no loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    select * into o from public.wa284_opt_state(r.data -> k_hist, k_d, k_t, k_c, 'email');
    if o.undated > 0 then w := public.wa284_bump(w, '{counts,undated_events}', o.undated); end if;
    if o.optout is null then
      w := public.wa284_bump(w, case when o.overridden > 0 then '{counts,skipped,undated opt-out followed by an opt-in}' else '{counts,skipped,latest event is not an opt-out}' end::text[]);
      continue;
    end if;
    v_kid := public.wa284_txt(r.data -> k_id);
    v_id := public.wa284_contact(v_kid, lower(public.wa284_txt(r.data -> k_email)));
    if v_id is null then
      w := public.wa284_bump(w, '{counts,skipped,no Hub contact}');
      w := public.wa284_push(w, 'keela_ids_skipped', jsonb_build_object('keela_id', v_kid, 'reason', 'no Hub contact'));
      continue;
    end if;
    w := public.wa284_bump(w, '{counts,matched}');
    select c.email_status into v_st from public.crm_contacts c where c.id = v_id;
    v_new := public.wa284_optout_status(o.optout);
    -- already not emailed: kept, unless Keela says complained and the Hub only says unsubscribed (a complaint is the stronger word)
    if v_st in ('bounced', 'complained') or (v_st = 'unsubscribed' and v_new <> 'complained') then w := public.wa284_bump(w, '{counts,skipped,already not emailed}'); continue; end if;
    if o.optout_date is null then w := public.wa284_bump(w, '{counts,undated_optouts_honoured}'); end if;
    perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'email_status', to_jsonb(v_new));
    perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'consent_source', to_jsonb(public.wa284_optout_words(o.optout, o.optout_date)));
  end loop;
  return w;
end $function$;
comment on function public.wa284_w_optouts(bigint, bigint, boolean) is 'wave284: batch 1 (optouts). For each Keela person, the email opt-out wa284_opt_state says to honour: the latest dated event if it is an unsubscribe, a hard bounce or a spam complaint, or any opt-out whose date cannot be read unless a dated opt-in clearly follows it. On a Hub contact that can still be emailed it sets email_status unsubscribed, bounced or complained and consent_source "Keela: <event> <date>" (or "(undated)"). The report counts the events with no readable date (undated_events). The opt-out always applies; it is never undone. The service role only.';

-- 2. legacy_fields: from legacy_refs.keela (no upload); fills empty fields only
create or replace function public.wa284_w_legacy_fields(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0();
  v_amap jsonb := coalesce(public.wa284_cfg('keela_assignee_map'), '{}'::jsonb);
  v_popts jsonb := (select f.options from public.crm_fields f where f.key = 'volunteer_positions');
  v_ropts jsonb := (select f.options from public.crm_fields f where f.key = 'rally_paper_team');
  c record; v_piece text; v_bare text; v_opt text; v_mapped text[]; v_list text[]; v_v text; v_res text; v_m text;
begin
  if v_popts is null or v_ropts is null then raise exception 'wa284: the custom fields volunteer_positions and rally_paper_team are needed'; end if;
  for c in select x.id, x.legacy_refs -> 'keela' as k, x.owner_member_id from public.crm_contacts x
            where x.merged_into is null and jsonb_typeof(x.legacy_refs -> 'keela') = 'object' order by x.id loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    w := public.wa284_bump(w, '{counts,matched}');
    -- positions: split on ", " and mapped to the volunteer_positions options by label (or a role guide's label for that role)
    v_mapped := '{}';
    foreach v_piece in array (select coalesce(array_agg(btrim(p)), '{}') from unnest(public.wa284_list(c.k -> 'positions')) l, unnest(string_to_array(l, ', ')) p where btrim(p) <> '') loop
      v_bare := btrim(regexp_replace(regexp_replace(v_piece, '^\s*volunteer\s+', '', 'i'), '\s+volunteer\s*$', '', 'i'));
      select o into v_opt from jsonb_array_elements_text(v_popts) o
       where lower(o) = lower(v_bare) or lower(o) = lower(v_piece)
          or exists (select 1 from public.volunteer_role_guides g where lower(g.label_en) = lower(v_bare) and g.role = replace(lower(o), ' ', '_'))
       limit 1;
      if v_opt is null then
        w := public.wa284_bump(w, '{counts,skipped,position not mapped}');
        w := public.wa284_push(w, 'positions_unmapped', to_jsonb(v_piece));
      elsif not v_opt = any(v_mapped) then v_mapped := v_mapped || v_opt;
      end if;
    end loop;
    if cardinality(v_mapped) > 0 then
      v_res := public.wa284_field(p_batch, c.id, 'volunteer_positions', to_jsonb(v_mapped));
      if v_res = 'kept' then w := public.wa284_bump(w, '{counts,kept_hub_value,volunteer_positions}'); end if;
    end if;
    -- availability and dates volunteered: kept as one line each (dates volunteered is a field, not servings)
    v_list := public.wa284_list(c.k -> 'availability');
    if cardinality(v_list) > 0 then
      v_res := public.wa284_field(p_batch, c.id, 'volunteer_availability', to_jsonb(array_to_string(v_list, ', ')));
      if v_res = 'kept' then w := public.wa284_bump(w, '{counts,kept_hub_value,volunteer_availability}'); end if;
    end if;
    v_list := public.wa284_list(c.k -> 'dates_volunteered');
    if cardinality(v_list) > 0 then
      v_res := public.wa284_field(p_batch, c.id, 'dates_volunteered', to_jsonb(array_to_string(v_list, ', ')));
      if v_res = 'kept' then w := public.wa284_bump(w, '{counts,kept_hub_value,dates_volunteered}'); end if;
    end if;
    -- Rally Paper team: the option it names (or the one option that starts with it)
    v_v := public.wa284_txt(c.k -> 'rally_paper_team');
    if v_v is not null then
      select min(o) into v_opt from jsonb_array_elements_text(v_ropts) o where lower(o) = lower(v_v);
      if v_opt is null and (select count(*) from jsonb_array_elements_text(v_ropts) o where lower(o) like lower(v_v) || '%') = 1 then
        select min(o) into v_opt from jsonb_array_elements_text(v_ropts) o where lower(o) like lower(v_v) || '%';
      end if;
      if v_opt is null then w := public.wa284_bump(w, '{counts,skipped,rally team not an option}');
      else
        v_res := public.wa284_field(p_batch, c.id, 'rally_paper_team', to_jsonb(v_opt));
        if v_res = 'kept' then w := public.wa284_bump(w, '{counts,kept_hub_value,rally_paper_team}'); end if;
      end if;
    end if;
    -- donor readiness: Ready R, Shows potential SP, Not ready NR
    v_v := public.wa284_txt(c.k -> 'donor_readiness');
    if v_v is not null then
      v_opt := case lower(v_v) when 'ready' then 'R' when 'r' then 'R' when 'shows potential' then 'SP' when 'sp' then 'SP' when 'not ready' then 'NR' when 'nr' then 'NR' end;
      if v_opt is null then w := public.wa284_bump(w, '{counts,skipped,donor readiness not mapped}');
      else
        v_res := public.wa284_field(p_batch, c.id, 'donor_readiness', to_jsonb(v_opt));
        if v_res = 'kept' then w := public.wa284_bump(w, '{counts,kept_hub_value,donor_readiness}'); end if;
      end if;
    end if;
    -- assignee: a Keela user mapped to a Hub member on the Import page (keela_assignee_map); unmapped ones stay empty and are listed
    v_v := public.wa284_txt(c.k -> 'assignee');
    if v_v is not null then
      v_m := case when jsonb_typeof(v_amap) = 'object' then v_amap ->> v_v end;
      if v_m is null or v_m !~ '^[0-9]{1,18}$' or not exists (select 1 from public.team_members t where t.id = v_m::bigint) then
        w := public.wa284_bump(w, '{counts,skipped,assignee not mapped}');
        w := public.wa284_push(w, 'assignees_unmapped', to_jsonb(v_v));
      elsif c.owner_member_id is null then
        perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'owner_member_id', to_jsonb(v_m::bigint));
      elsif c.owner_member_id <> v_m::bigint then
        w := public.wa284_bump(w, '{counts,kept_hub_value,owner_member_id}');
      end if;
    end if;
  end loop;
  return w;
end $function$;
comment on function public.wa284_w_legacy_fields(bigint, bigint, boolean) is 'wave284: batch 2 (legacy_fields), from legacy_refs.keela with no upload: positions split on ", " and mapped to volunteer_positions by label (unmapped ones listed), availability, dates volunteered (a field, not servings), the Rally Paper team, donor readiness (Ready R, Shows potential SP, Not ready NR), and the assignee as owner_member_id through app_config keela_assignee_map (unmapped ones listed). Fills empty fields only. The service role only.';

-- 3. people: match by Keela id, then email, then phone (listed, never merged); new people with an email or phone; the Hub wins
create or replace function public.wa284_w_people(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0();
  f bigint := public.wa284_file(p_run, 'keela_contacts_json');
  k_id text := public.wa284_need(f, 'contact_id'); k_type text := public.wa284_need(f, 'contact_type');
  k_full text := public.wa284_need(f, 'full_name'); k_first text := public.wa284_need(f, 'first_name'); k_last text := public.wa284_need(f, 'last_name');
  k_email text := public.wa284_need(f, 'email'); k_phone text := public.wa284_need(f, 'phone');
  k_street text := public.wa284_need(f, 'street'); k_line2 text := public.wa284_need(f, 'line2'); k_city text := public.wa284_need(f, 'city');
  k_prov text := public.wa284_need(f, 'province'); k_postal text := public.wa284_need(f, 'postal_code'); k_country text := public.wa284_need(f, 'country');
  k_notes text := public.wa284_need(f, 'notes');
  -- the subscription history too: a new contact starts with the opt-out Keela recorded (Steel: every unsubscribe and bounce is honoured)
  k_hist text := public.wa284_need(f, 'subscription_history');
  k_d text := public.wa284_need_in(f, k_hist, 'sub_date'); k_t text := public.wa284_need_in(f, k_hist, 'sub_type');
  k_c text := public.wa284_key('sub_channel');
  v_other int := public.wa284_types(f, k_type);
  r record; c public.crm_contacts; o record; v_kid text; v_email text; v_phone text; v_digits text; v_id bigint; v_how text;
  v_full text; v_first text; v_last text; v_addr text; v_note text; v_refs jsonb; v_k jsonb;
begin
  if v_other > 0 then w := public.wa284_bump(w, '{counts,skipped,unrecognised Contact Type}', v_other); end if;
  for r in select x.row_no, x.data from import_stage.rows x
            where x.file_id = f and lower(coalesce(public.wa284_txt(x.data -> k_type), '')) = 'individual' order by x.row_no loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    v_kid := public.wa284_txt(r.data -> k_id);
    v_email := lower(public.wa284_txt(r.data -> k_email));
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; w := public.wa284_bump(w, '{counts,skipped,email not an address}'); end if;
    v_phone := public.wa284_txt(r.data -> k_phone); v_digits := public.wa171_digits(v_phone);
    if v_phone is not null and v_digits is null then v_phone := null; w := public.wa284_bump(w, '{counts,skipped,phone not a number}'); end if;
    v_full := public.wa284_txt(r.data -> k_full); v_first := public.wa284_txt(r.data -> k_first); v_last := public.wa284_txt(r.data -> k_last);
    v_addr := nullif(concat_ws(', ', public.wa284_txt(r.data -> k_street), public.wa284_txt(r.data -> k_line2)), '');
    v_note := public.wa284_txt(r.data -> k_notes);
    if v_kid is null then w := public.wa284_bump(w, '{counts,skipped,no Keela id}'); continue; end if;
    v_id := null; v_how := null;
    select x.id into v_id from public.crm_contacts x
     where x.merged_into is null and ((x.legacy_refs -> 'keela' ->> 'contact_id') = v_kid or coalesce(x.legacy_refs -> 'keela_extra_ids', '[]'::jsonb) ? v_kid)
     order by x.id limit 1;
    if v_id is not null then v_how := 'id';
    elsif v_email is not null then
      v_id := public.wa284_contact(null, v_email);
      if v_id is not null then v_how := 'email'; end if;
    end if;
    if v_id is null and v_digits is not null then
      select x.id into v_id from public.crm_contacts x
       where x.merged_into is null and exists (select 1 from unnest(x.phones) p where public.wa171_digits(p) = v_digits) order by x.id limit 1;
      if v_id is not null then
        w := public.wa284_bump(w, '{counts,skipped,phone-only match (listed only)}');
        w := public.wa284_push(w, 'phone_only', jsonb_build_object('keela_id', v_kid, 'contact_id', v_id));
        continue;
      end if;
    end if;
    if v_id is null then
      if v_email is null and v_digits is null then
        w := public.wa284_bump(w, '{counts,skipped,no email or phone}');
        w := public.wa284_push(w, 'keela_ids_skipped', jsonb_build_object('keela_id', v_kid, 'reason', 'no email or phone'));
        continue;
      end if;
      -- primary_email is generated from emails[1] on live, so it is never written. The email opt-out Keela recorded comes with the person
      -- (batch 1 ran before they existed); it is never undone (the contact is listed for review, never deleted)
      select * into o from public.wa284_opt_state(r.data -> k_hist, k_d, k_t, k_c, 'email');
      insert into public.crm_contacts (full_name, first_name, last_name, emails, phones, address, city, province, postal_code, country, notes,
                                       email_status, consent_source, source, legacy_refs, created_by, updated_by)
      values (coalesce(v_full, nullif(concat_ws(' ', v_first, v_last), ''), v_email, 'Keela contact ' || v_kid), v_first, v_last,
              case when v_email is null then '{}'::text[] else array[v_email] end, case when v_phone is null then '{}'::text[] else array[v_phone] end,
              v_addr, public.wa284_txt(r.data -> k_city), public.wa284_txt(r.data -> k_prov), public.wa284_txt(r.data -> k_postal), public.wa284_txt(r.data -> k_country),
              case when v_note is null then null else 'From Keela: ' || v_note end,
              coalesce(public.wa284_optout_status(o.optout), 'unknown'), case when o.optout is not null then public.wa284_optout_words(o.optout, o.optout_date) end,
              'keela', jsonb_build_object('keela', jsonb_build_object('contact_id', v_kid)), 'Keela import', 'Keela import')
      returning * into c;
      perform public.wa284_chg(p_batch, 'crm_contacts', c.id::text, null, null, to_jsonb(c), 'insert');
      if o.optout is not null then w := public.wa284_bump(w, array['counts', 'created_not_emailed', public.wa284_optout_status(o.optout)]); end if;
      continue;
    end if;
    w := public.wa284_bump(w, '{counts,matched}');
    select * into c from public.crm_contacts x where x.id = v_id;
    -- names: a full name that is empty or an email address counts as empty
    if v_full is not null and (btrim(c.full_name) = '' or position('@' in c.full_name) > 0) then
      perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'full_name', to_jsonb(v_full));
    elsif v_full is not null and lower(btrim(c.full_name)) <> lower(v_full) then
      w := public.wa284_bump(w, '{counts,kept_hub_value,full_name}');
    end if;
    w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'first_name', c.first_name, v_first, w);
    w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'last_name', c.last_name, v_last, w);
    w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'address', c.address, v_addr, w);
    w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'city', c.city, public.wa284_txt(r.data -> k_city), w);
    w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'province', c.province, public.wa284_txt(r.data -> k_prov), w);
    w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'postal_code', c.postal_code, public.wa284_txt(r.data -> k_postal), w);
    w := public.wa284_fill(p_batch, 'crm_contacts', c.id, 'country', c.country, public.wa284_txt(r.data -> k_country), w);
    -- a missing phone or email is added (primary_email follows emails[1] by itself)
    if v_digits is not null and not exists (select 1 from unnest(c.phones) p where public.wa171_digits(p) = v_digits) then
      perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'phones', to_jsonb(c.phones || v_phone));
    end if;
    if v_email is not null and not exists (select 1 from unnest(c.emails) e where lower(btrim(e)) = v_email) then
      perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'emails', to_jsonb(c.emails || v_email));
    end if;
    -- notes are appended once, as "From Keela: ..."
    if v_note is not null and position('From Keela: ' || v_note in coalesce(c.notes, '')) = 0 then
      perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'notes', to_jsonb(coalesce(nullif(c.notes, '') || E'\n\n', '') || 'From Keela: ' || v_note));
    end if;
    -- the Keela id: kept as the contact's own when it has none, otherwise added to keela_extra_ids (a Keela duplicate)
    select x.legacy_refs into v_refs from public.crm_contacts x where x.id = c.id;
    v_k := case when jsonb_typeof(v_refs -> 'keela') = 'object' then v_refs -> 'keela' else '{}'::jsonb end;
    if (v_k ->> 'contact_id') is null then
      perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'legacy_refs', v_refs || jsonb_build_object('keela', v_k || jsonb_build_object('contact_id', v_kid)));
    elsif (v_k ->> 'contact_id') <> v_kid and not coalesce(v_refs -> 'keela_extra_ids', '[]'::jsonb) ? v_kid then
      perform public.wa284_upd(p_batch, 'crm_contacts', c.id, 'legacy_refs',
        v_refs || jsonb_build_object('keela_extra_ids', (case when jsonb_typeof(v_refs -> 'keela_extra_ids') = 'array' then v_refs -> 'keela_extra_ids' else '[]'::jsonb end) || to_jsonb(v_kid)));
    end if;
  end loop;
  return w;
end $function$;
comment on function public.wa284_w_people(bigint, bigint, boolean) is 'wave284: batch 3 (people). Each Keela person (Contact Type Individual) is matched by Keela id (legacy_refs.keela.contact_id or keela_extra_ids), then email, then phone; a phone-only match is listed, never merged. No match with an email or phone: a new contact (source keela), which starts with the email opt-out its Keela history says to honour (wa284_opt_state: email_status unsubscribed, bounced or complained, consent_source "Keela: ..."; batch 1 ran before it existed; never undone). Neither: skipped and listed. Fills empty names and address fields, adds missing phones and emails, appends notes as "From Keela: ...", and keeps duplicate Keela ids in legacy_refs.keela_extra_ids. The Hub wins. Never writes through volunteer_people. The service role only.';

-- 4. fields: job title, birth date (private, never in a change record), car, LinkedIn, food licence; fills empty fields only
create or replace function public.wa284_w_fields(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0();
  f bigint := public.wa284_file(p_run, 'keela_contacts_json');
  k_id text := public.wa284_need(f, 'contact_id'); k_type text := public.wa284_need(f, 'contact_type'); k_email text := public.wa284_need(f, 'email');
  k_job text := public.wa284_need(f, 'job_title'); k_birth text := public.wa284_need(f, 'birth_date'); k_car text := public.wa284_need(f, 'car');
  k_li text := public.wa284_need(f, 'linkedin'); k_food text := public.wa284_need(f, 'food_licence');
  v_fopts jsonb := (select x.options from public.crm_fields x where x.key = 'food_licence');
  v_other int := public.wa284_types(f, k_type);
  r record; v_id bigint; v_job text; v_b text; v_d date; v_v text; v_opt text; v_res text;
begin
  if v_other > 0 then w := public.wa284_bump(w, '{counts,skipped,unrecognised Contact Type}', v_other); end if;
  if v_fopts is null or not exists (select 1 from public.crm_fields x where x.key = 'car_make_model') or not exists (select 1 from public.crm_fields x where x.key = 'linkedin') then
    raise exception 'wa284: the custom fields linkedin, car_make_model and food_licence are needed (wave281)';
  end if;
  for r in select x.row_no, x.data from import_stage.rows x
            where x.file_id = f and lower(coalesce(public.wa284_txt(x.data -> k_type), '')) = 'individual' order by x.row_no loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    v_id := public.wa284_contact(public.wa284_txt(r.data -> k_id), lower(public.wa284_txt(r.data -> k_email)));
    if v_id is null then w := public.wa284_bump(w, '{counts,skipped,no Hub contact}'); continue; end if;
    w := public.wa284_bump(w, '{counts,matched}');
    if k_job is not null then
      select x.job_title into v_job from public.crm_contacts x where x.id = v_id;
      w := public.wa284_fill(p_batch, 'crm_contacts', v_id, 'job_title', v_job, public.wa284_txt(r.data -> k_job), w);
    end if;
    -- the birth date: only into crm_contact_private, only when the person has no private row; the change record says "set"
    v_b := case when k_birth is null then null else public.wa284_txt(r.data -> k_birth) end;
    if v_b is not null then
      v_d := public.wa284_date(v_b);
      if v_d is null then w := public.wa284_bump(w, '{counts,skipped,birth date not a date}');
      elsif exists (select 1 from public.crm_contact_private p where p.contact_id = v_id) then w := public.wa284_bump(w, '{counts,kept_hub_value,birth_date}');
      else
        insert into public.crm_contact_private (contact_id, birth_date, source, updated_at, updated_by) values (v_id, v_d, 'Keela import', now(), 'Keela import');
        perform public.wa284_chg(p_batch, 'crm_contact_private', v_id::text, 'birth_date', null, null, 'insert', true);
      end if;
    end if;
    if k_car is not null and public.wa284_txt(r.data -> k_car) is not null then
      v_res := public.wa284_field(p_batch, v_id, 'car_make_model', to_jsonb(public.wa284_txt(r.data -> k_car)));
      if v_res = 'kept' then w := public.wa284_bump(w, '{counts,kept_hub_value,car_make_model}'); end if;
    end if;
    if k_li is not null and public.wa284_txt(r.data -> k_li) is not null then
      v_res := public.wa284_field(p_batch, v_id, 'linkedin', to_jsonb(public.wa284_txt(r.data -> k_li)));
      if v_res = 'kept' then w := public.wa284_bump(w, '{counts,kept_hub_value,linkedin}'); end if;
    end if;
    v_v := case when k_food is null then null else public.wa284_txt(r.data -> k_food) end;
    if v_v is not null then
      select min(o) into v_opt from jsonb_array_elements_text(v_fopts) o where lower(o) = lower(v_v);
      if v_opt is null then w := public.wa284_bump(w, '{counts,skipped,food licence not an option}');
      else
        v_res := public.wa284_field(p_batch, v_id, 'food_licence', to_jsonb(v_opt));
        if v_res = 'kept' then w := public.wa284_bump(w, '{counts,kept_hub_value,food_licence}'); end if;
      end if;
    end if;
  end loop;
  return w;
end $function$;
comment on function public.wa284_w_fields(bigint, bigint, boolean) is 'wave284: batch 4 (fields): the job title; the birth date into crm_contact_private only (the change record says "set", never the date; only ISO dates; a person who already has a private row keeps it); the car, LinkedIn and food licence custom fields. Fills empty fields only. The service role only.';

-- 5. orgs: Keela companies matched to wa_partners by normalised name; close pairs ticked by an admin; real new ones created; people linked
create or replace function public.wa284_w_orgs(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0();
  f bigint := public.wa284_file(p_run, 'keela_contacts_json');
  k_id text := public.wa284_need(f, 'contact_id'); k_type text := public.wa284_need(f, 'contact_type'); k_email text := public.wa284_need(f, 'email');
  k_name text := public.wa284_need(f, 'company_name'); k_ctype text := public.wa284_need(f, 'company_type');
  k_status text := public.wa284_need(f, 'org_status'); k_goal text := public.wa284_need(f, 'org_goal');
  k_full text := public.wa284_need(f, 'full_name'); k_comp text := public.wa284_need(f, 'companies');
  v_cat jsonb := coalesce(public.wa284_cfg('keela_company_category_map'), '{}'::jsonb);
  v_stat jsonb := coalesce(public.wa284_cfg('keela_status_map'), '{}'::jsonb);
  v_ok jsonb := coalesce(public.wa284_cfg('keela_org_pairs_ok'), '[]'::jsonb);
  r record; p public.wa_partners; v_kid text; v_name text; v_n text; v_pid bigint; v_goals text[]; v_ctype text; v_category text; v_status text; v_cid bigint;
  v_comp text; v_comps text[]; v_link public.crm_contact_orgs; v_pair record; v_ticked boolean;
  v_other int := public.wa284_types(f, k_type);
  v_people jsonb; v_cmap jsonb; v_pmap jsonb; v_kmap jsonb; v_cn text;
begin
  if v_other > 0 then w := public.wa284_bump(w, '{counts,skipped,unrecognised Contact Type}', v_other); end if;
  -- the normalised names, worked out once and kept as lookup maps (jsonb keys), so no company or person rescans the staged rows or the contacts
  select coalesce(jsonb_object_agg(z.n, true), '{}'::jsonb) into v_people
    from (select public.wa284_norm(c.full_name) as n from public.crm_contacts c where c.merged_into is null
          union
          select public.wa284_norm(public.wa284_txt(y.data -> k_full)) from import_stage.rows y
           where y.file_id = f and lower(coalesce(public.wa284_txt(y.data -> k_type), '')) = 'individual') z
   where z.n <> '';
  select coalesce(jsonb_object_agg(z.n, z.ids), '{}'::jsonb) into v_cmap
    from (select public.wa284_norm(public.wa284_txt(y.data -> k_name)) as n, jsonb_agg(public.wa284_txt(y.data -> k_id) order by y.row_no) as ids
            from import_stage.rows y where y.file_id = f and lower(coalesce(public.wa284_txt(y.data -> k_type), '')) = 'company'
           group by 1) z
   where z.n <> '';
  -- the companies
  for r in select x.row_no, x.data from import_stage.rows x
            where x.file_id = f and lower(coalesce(public.wa284_txt(x.data -> k_type), '')) = 'company' order by x.row_no loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    v_kid := public.wa284_txt(r.data -> k_id);
    v_name := public.wa284_txt(r.data -> k_name); v_n := public.wa284_norm(v_name);
    if v_kid is null or v_n = '' then w := public.wa284_bump(w, '{counts,skipped,no Keela id or name}'); continue; end if;
    -- not organisations: a person's name, a phone number, Welfare Avenue itself (listed by Keela id only, never by name)
    if v_n like '%welfare avenue%' or v_n like '%avenue du bien%' then
      w := public.wa284_bump(w, '{counts,skipped,Welfare Avenue}');
      w := public.wa284_push(w, 'keela_ids_skipped', jsonb_build_object('keela_id', v_kid, 'reason', 'Welfare Avenue')); continue;
    end if;
    if v_name ~ '^[0-9\s()+.-]+$' and public.wa171_digits(v_name) is not null then
      w := public.wa284_bump(w, '{counts,skipped,a phone number}');
      w := public.wa284_push(w, 'keela_ids_skipped', jsonb_build_object('keela_id', v_kid, 'reason', 'a phone number')); continue;
    end if;
    if v_people ? v_n then
      w := public.wa284_bump(w, '{counts,skipped,a person''s name}');
      w := public.wa284_push(w, 'keela_ids_skipped', jsonb_build_object('keela_id', v_kid, 'reason', 'a person''s name')); continue;
    end if;
    v_goals := public.wa284_list(r.data -> k_goal);
    v_ctype := public.wa284_txt(r.data -> k_ctype);
    -- already linked, or an exact match on the name or an aka
    select * into p from public.wa_partners x where x.keela_company_id = v_kid limit 1;
    if p.id is null then
      select * into p from public.wa_partners x
       where public.wa284_norm(x.name) = v_n or exists (select 1 from unnest(x.aka) a where public.wa284_norm(a) = v_n) order by x.id limit 1;
    end if;
    -- a close pair (one name contains the other): linked only when an admin ticked it (keela_org_pairs_ok)
    if p.id is null then
      v_ticked := false;
      for v_pair in select x.id, x.name from public.wa_partners x
                     where length(v_n) >= 4 and length(public.wa284_norm(x.name)) >= 4
                       and (position(public.wa284_norm(x.name) in v_n) > 0 or position(v_n in public.wa284_norm(x.name)) > 0) order by x.id loop
        if jsonb_typeof(v_ok) = 'array' and v_ok @> jsonb_build_array(jsonb_build_object('keela_company_id', v_kid, 'partner_id', v_pair.id)) then
          select * into p from public.wa_partners x where x.id = v_pair.id; v_ticked := true; exit;
        end if;
        w := public.wa284_push(w, 'org_pairs', jsonb_build_object('keela_company_id', v_kid, 'keela_name', v_name, 'partner_id', v_pair.id, 'partner_name', v_pair.name));
      end loop;
      if p.id is null and exists (select 1 from jsonb_array_elements(coalesce(w #> '{lists,org_pairs}', '[]'::jsonb)) e where e ->> 'keela_company_id' = v_kid) then
        w := public.wa284_bump(w, '{counts,skipped,close pair not ticked}'); continue;
      end if;
    end if;
    if p.id is not null then
      w := public.wa284_bump(w, '{counts,matched}');
      if p.keela_company_id is null and not exists (select 1 from public.wa_partners x where x.keela_company_id = v_kid) then
        perform public.wa284_upd(p_batch, 'wa_partners', p.id, 'keela_company_id', to_jsonb(v_kid));
      end if;
      if cardinality(v_goals) > 0 then
        if cardinality(coalesce(p.goals, '{}')) = 0 then perform public.wa284_upd(p_batch, 'wa_partners', p.id, 'goals', to_jsonb(v_goals));
        elsif p.goals <> v_goals then w := public.wa284_bump(w, '{counts,kept_hub_value,goals}'); end if;
      end if;
      continue;
    end if;
    -- a real new organisation
    v_category := case when jsonb_typeof(v_cat) = 'object' and v_ctype is not null then v_cat ->> v_ctype end;
    if v_category is not null and v_category not in ('partner', 'collaborator', 'sponsor') then v_category := null; end if;
    if v_category is null and v_ctype is not null then w := public.wa284_push(w, 'company_types_unmapped', to_jsonb(v_ctype)); end if;
    v_status := case when jsonb_typeof(v_stat) = 'object' then (select v_stat ->> s from unnest(public.wa284_list(r.data -> k_status)) s where v_stat ? s limit 1) end;
    if v_status is not null and v_status not in ('active', 'past', 'prospect', 'declined') then v_status := null; end if;
    insert into public.wa_partners (name, category, status, visibility, keela_company_id, goals, created_by, updated_by)
    values (v_name, coalesce(v_category, 'partner'), coalesce(v_status, 'past'), 'everyone', v_kid, v_goals, 'Keela import', 'Keela import')
    returning * into p;
    perform public.wa284_chg(p_batch, 'wa_partners', p.id::text, null, null, to_jsonb(p), 'insert');
  end loop;
  -- people linked to their organisations (crm_contact_orgs); the partners' names and Keela ids as maps, once (after the companies were added)
  select coalesce(jsonb_object_agg(z.n, z.id), '{}'::jsonb) into v_pmap
    from (select distinct on (public.wa284_norm(x.name)) public.wa284_norm(x.name) as n, x.id from public.wa_partners x
           order by public.wa284_norm(x.name), (x.keela_company_id is null), x.id) z
   where z.n <> '';
  select coalesce(jsonb_object_agg(x.keela_company_id, x.id), '{}'::jsonb) into v_kmap from public.wa_partners x where x.keela_company_id is not null;
  for r in select x.row_no, x.data from import_stage.rows x
            where x.file_id = f and lower(coalesce(public.wa284_txt(x.data -> k_type), '')) = 'individual'
              and (public.wa284_txt(x.data -> k_comp) is not null or jsonb_typeof(x.data -> k_comp) = 'array')
            order by x.row_no loop
    v_comps := public.wa284_list(r.data -> k_comp);
    if jsonb_typeof(r.data -> k_comp) = 'string' and cardinality(v_comps) > 1
       and v_pmap ? public.wa284_norm(public.wa284_txt(r.data -> k_comp)) then
      v_comps := array[public.wa284_txt(r.data -> k_comp)];   -- one name with a comma in it
    end if;
    if cardinality(v_comps) = 0 then continue; end if;
    v_cid := public.wa284_contact(public.wa284_txt(r.data -> k_id), lower(public.wa284_txt(r.data -> k_email)));
    if v_cid is null then w := public.wa284_bump(w, '{counts,skipped,link: no Hub contact}'); continue; end if;
    foreach v_comp in array v_comps loop
      v_cn := public.wa284_norm(v_comp);
      select min((v_kmap ->> k.v)::bigint) into v_pid from jsonb_array_elements_text(coalesce(v_cmap -> v_cn, '[]'::jsonb)) as k(v) where v_kmap ? k.v;
      if v_pid is null then v_pid := (v_pmap ->> v_cn)::bigint; end if;
      if v_pid is null then w := public.wa284_bump(w, '{counts,skipped,link: organisation not in the Hub}'); continue; end if;
      if exists (select 1 from public.crm_contact_orgs o where o.contact_id = v_cid and o.partner_id = v_pid) then continue; end if;
      insert into public.crm_contact_orgs (contact_id, partner_id, created_by) values (v_cid, v_pid, 'Keela import') returning * into v_link;
      perform public.wa284_chg(p_batch, 'crm_contact_orgs', v_link.id::text, null, null, to_jsonb(v_link), 'insert');
    end loop;
  end loop;
  return w;
end $function$;
comment on function public.wa284_w_orgs(bigint, bigint, boolean) is 'wave284: batch 5 (orgs). Keela companies (Contact Type Company) matched to wa_partners by keela_company_id, then by normalised name or aka (lower case, no punctuation, no inc, ltd or corp): exact matches are linked (keela_company_id and empty goals filled). A pair where one name contains the other is listed (org_pairs) and linked only once an admin ticks it (app_config keela_org_pairs_ok); an unticked pair is skipped. Other real organisations are created (category from keela_company_category_map, else partner (the column''s default) with the type listed; status from keela_status_map, else past (the column''s default); visibility everyone; Keela Goal into goals). A person''s name, a phone number or Welfare Avenue is skipped and listed by Keela id only. People are linked through crm_contact_orgs. The Hub wins. The service role only.';

-- 6. consent: the dated subscription events into the consent log; express email consent only with dated proof; text opt-ins as sms_consent
create or replace function public.wa284_w_consent(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0();
  f bigint := public.wa284_file(p_run, 'keela_contacts_json');
  k_id text := public.wa284_need(f, 'contact_id'); k_type text := public.wa284_need(f, 'contact_type'); k_email text := public.wa284_need(f, 'email');
  k_hist text := public.wa284_need(f, 'subscription_history');
  k_d text := public.wa284_need_in(f, k_hist, 'sub_date'); k_t text := public.wa284_need_in(f, k_hist, 'sub_type'); k_f text := public.wa284_need_in(f, k_hist, 'sub_form');
  k_c text := public.wa284_key('sub_channel');
  v_other int := public.wa284_types(f, k_type);
  r record; e record; c public.crm_contacts; oe record; os record; v_id bigint; v_ev public.crm_consent_events; v_at timestamptz; v_kind text; v_occ date; v_form text;
begin
  if v_other > 0 then w := public.wa284_bump(w, '{counts,skipped,unrecognised Contact Type}', v_other); end if;
  for r in select x.row_no, x.data from import_stage.rows x
            where x.file_id = f and lower(coalesce(public.wa284_txt(x.data -> k_type), '')) = 'individual' order by x.row_no loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    v_id := public.wa284_contact(public.wa284_txt(r.data -> k_id), lower(public.wa284_txt(r.data -> k_email)));
    if v_id is null then w := public.wa284_bump(w, '{counts,skipped,no Hub contact}'); continue; end if;
    w := public.wa284_bump(w, '{counts,matched}');
    -- every dated event, once, into the consent log (source keela)
    for e in select * from public.wa284_events(r.data -> k_hist, k_d, k_t, k_f, k_c) ev order by ev.occurred, ev.at_text loop
      if e.occurred is null then w := public.wa284_bump(w, '{counts,skipped,undated event}'); continue; end if;
      v_at := (e.occurred + time '12:00') at time zone 'America/Toronto';
      if exists (select 1 from public.crm_consent_events x where x.contact_id = v_id and x.source = 'keela' and x.occurred_at = v_at
                  and x.column_name = 'keela ' || e.channel || ' subscription' and x.new_value is not distinct from e.type_text) then continue; end if;
      insert into public.crm_consent_events (contact_id, channel, column_name, old_value, new_value, source, words, actor, occurred_at, import_batch_id)
      values (v_id, e.channel, 'keela ' || e.channel || ' subscription', null, e.type_text, 'keela', e.form, 'Keela import', v_at, p_batch)
      returning * into v_ev;
      perform public.wa284_chg(p_batch, 'crm_consent_events', v_ev.id::text, null, null, to_jsonb(v_ev), 'insert');
    end loop;
    select * into c from public.crm_contacts x where x.id = v_id;
    -- express email consent: the latest dated email event is an opt-in with a form name; never for an unsubscribed, bounced or complained address,
    -- and never past an opt-out whose date cannot be read (it may be the newest)
    select * into oe from public.wa284_opt_state(r.data -> k_hist, k_d, k_t, k_c, 'email');
    v_kind := null; v_occ := null; v_form := null;
    select ev.kind, ev.occurred, ev.form into v_kind, v_occ, v_form from public.wa284_events(r.data -> k_hist, k_d, k_t, k_f, k_c) ev
     where ev.channel = 'email' and ev.occurred is not null order by ev.occurred desc, ev.at_text desc limit 1;
    if v_kind = 'optin' and v_form is not null then
      if oe.undated_optouts > 0 then w := public.wa284_bump(w, '{counts,skipped,undated opt-out (no express consent)}');
      elsif c.email_status in ('unsubscribed', 'bounced', 'complained') or c.do_not_contact then w := public.wa284_bump(w, '{counts,skipped,opt-in on an address that is not emailed}');
      elsif c.email_consent = 'express' then w := public.wa284_bump(w, '{counts,kept_hub_value,email_consent}');
      else
        perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'email_consent', to_jsonb('express'::text));
        perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'consent_source', to_jsonb('Keela: opted in on ' || left(v_form, 120) || ' ' || to_char(v_occ, 'YYYY-MM-DD')));
        perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'consent_at', to_jsonb((v_occ + time '12:00') at time zone 'America/Toronto'));
      end if;
    elsif v_kind = 'optin' then w := public.wa284_bump(w, '{counts,skipped,opt-in with no form name}');
    end if;
    -- texts: a Keela text opt-out stops texts (sms_opt_out), unless the phone texted START to the Hub after it; a text opt-in becomes text consent
    select * into os from public.wa284_opt_state(r.data -> k_hist, k_d, k_t, k_c, 'sms');
    if os.optout is not null then
      if c.sms_opt_out then w := public.wa284_bump(w, '{counts,skipped,texts already stopped}');
      elsif exists (select 1 from public.quo_messages q
                     where q.direction = 'in' and q.handled = 'opted_in'
                       and public.wa171_digits(q.phone) in (select public.wa171_digits(p) from unnest(c.phones) p where public.wa171_digits(p) is not null)
                       and (os.optout_date is null or (q.created_at at time zone 'America/Toronto')::date > os.optout_date)) then
        w := public.wa284_bump(w, '{counts,skipped,text opt-out followed by a Hub START}');
      else
        perform set_config('wa.consent_source', 'Keela: text opt-out ' || coalesce(to_char(os.optout_date, 'YYYY-MM-DD'), '(undated)'), true);
        perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'sms_opt_out', 'true'::jsonb);
        perform set_config('wa.consent_source', 'Keela import', true);
      end if;
    end if;
    v_kind := os.latest_kind; v_occ := os.latest_date;
    if os.optout is null and v_kind = 'optin' then
      if os.undated_optouts > 0 then w := public.wa284_bump(w, '{counts,skipped,undated text opt-out (no text consent)}');
      elsif c.sms_opt_out or c.do_not_contact then w := public.wa284_bump(w, '{counts,skipped,text opt-in on a stopped phone}');
      elsif c.sms_consent is not null then w := public.wa284_bump(w, '{counts,kept_hub_value,sms_consent}');
      else
        perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'sms_consent', to_jsonb('express'::text));
        perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'sms_consent_source', to_jsonb('Keela import'::text));
        perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'sms_consent_at', to_jsonb((v_occ + time '12:00') at time zone 'America/Toronto'));
      end if;
    end if;
  end loop;
  return w;
end $function$;
comment on function public.wa284_w_consent(bigint, bigint, boolean) is 'wave284: batch 6 (consent). Each dated Keela subscription event goes into crm_consent_events once (source keela, column keela email|sms subscription, the type''s words, the form name, the batch). Express email consent only when the latest dated email event is an opt-in with a form name, there is no email opt-out with an unreadable date, the Hub has no express consent yet, and the address is not unsubscribed, bounced, complained or do-not-contact. A Keela text opt-out (wa284_opt_state, channel sms) sets sms_opt_out, with the consent log source "Keela: text opt-out <date>", unless one of the contact''s phones texted START to the Hub after it. A text opt-in (the latest dated text event, no unreadable text opt-out) becomes sms_consent express, unless texts are stopped. Never undone. The service role only.';

-- 7. participation: Keela tags by keela_tag_map to Campaign rows, a chapter, skip, or tags[]; adds only
create or replace function public.wa284_w_participation(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0();
  f bigint := public.wa284_file(p_run, 'keela_contacts_json');
  k_id text := public.wa284_need(f, 'contact_id'); k_type text := public.wa284_need(f, 'contact_type'); k_email text := public.wa284_need(f, 'email');
  k_tags text := public.wa284_need(f, 'tags');
  v_map jsonb := coalesce(public.wa284_cfg('keela_tag_map'), '{}'::jsonb);
  v_types jsonb := coalesce(public.wa284_cfg('keela_campaign_types'), '{}'::jsonb);
  r record; v_id bigint; v_tag text; m jsonb; v_camp public.wa_campaigns; v_cname text; v_type text; v_part text; v_cp public.wa_campaign_people;
  v_ch public.crm_contact_chapters; v_tags text[]; v_add text[]; v_mark text := 'Keela import batch ' || p_batch;
  v_other int := public.wa284_types(f, k_type);
begin
  if v_other > 0 then w := public.wa284_bump(w, '{counts,skipped,unrecognised Contact Type}', v_other); end if;
  if jsonb_typeof(v_map) <> 'object' then raise exception 'wa284: app_config keela_tag_map is not a map'; end if;
  for r in select x.row_no, x.data from import_stage.rows x
            where x.file_id = f and lower(coalesce(public.wa284_txt(x.data -> k_type), '')) = 'individual' order by x.row_no loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    if cardinality(public.wa284_list(r.data -> k_tags)) = 0 then continue; end if;
    v_id := public.wa284_contact(public.wa284_txt(r.data -> k_id), lower(public.wa284_txt(r.data -> k_email)));
    if v_id is null then w := public.wa284_bump(w, '{counts,skipped,no Hub contact}'); continue; end if;
    w := public.wa284_bump(w, '{counts,matched}');
    v_add := '{}';
    foreach v_tag in array public.wa284_list(r.data -> k_tags) loop
      m := (select e.value from jsonb_each(v_map) e where lower(e.key) = lower(v_tag) limit 1);
      if m is not null and coalesce((m ->> 'skip')::boolean, false) then
        w := public.wa284_bump(w, '{counts,skipped,tag skipped}');
      elsif m is not null and m ? 'campaign' then
        v_cname := m ->> 'campaign'; v_part := coalesce(m ->> 'part', 'participant');
        v_camp := null;
        select * into v_camp from public.wa_campaigns x where lower(x.keela_name) = lower(v_cname) or lower(x.name) = lower(v_cname)
         order by (lower(x.keela_name) = lower(v_cname)) desc nulls last, x.id limit 1;
        if v_camp.id is null then
          v_type := case when jsonb_typeof(v_types) = 'object' then v_types ->> v_cname end;
          if v_type is null or v_type not in ('fundraising_event', 'drive', 'appeal', 'program') then
            w := public.wa284_bump(w, '{counts,skipped,campaign has no type yet}');
            w := public.wa284_push(w, 'campaigns_to_create', to_jsonb(v_cname));
            continue;
          end if;
          insert into public.wa_campaigns (name, type, year, keela_name, status, created_by)
          values (v_cname, v_type, (substring(v_cname from '(20[0-9]{2})'))::int, v_cname, 'active', 'Keela import') returning * into v_camp;
          perform public.wa284_chg(p_batch, 'wa_campaigns', v_camp.id::text, null, null, to_jsonb(v_camp), 'insert');
          w := public.wa284_push(w, 'campaigns_created', to_jsonb(v_cname));
        end if;
        v_cp := null;
        insert into public.wa_campaign_people (campaign_id, contact_id, part, source, source_ref) values (v_camp.id, v_id, v_part, 'import', v_mark)
        on conflict (campaign_id, contact_id, part) do nothing returning * into v_cp;
        if v_cp.campaign_id is not null then
          perform public.wa284_chg(p_batch, 'wa_campaign_people', v_cp.campaign_id || ':' || v_cp.contact_id || ':' || v_cp.part, v_cname, null, to_jsonb(v_cp), 'insert');
        end if;
      elsif m is not null and m ? 'chapter' then
        v_ch := null;
        insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by) values (v_id, m ->> 'chapter', 'import', v_mark, 'Keela import')
        on conflict (contact_id, chapter) do nothing returning * into v_ch;
        if v_ch.contact_id is not null then
          perform public.wa284_chg(p_batch, 'crm_contact_chapters', v_ch.contact_id || ':' || v_ch.chapter, m ->> 'chapter', null, to_jsonb(v_ch), 'insert');
        end if;
      else
        v_add := v_add || v_tag;
      end if;
    end loop;
    if cardinality(v_add) > 0 then
      select x.tags into v_tags from public.crm_contacts x where x.id = v_id;
      v_add := array(select t from unnest(v_add) t where not exists (select 1 from unnest(v_tags) h where lower(h) = lower(t)));
      if cardinality(v_add) > 0 then perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'tags', to_jsonb(v_tags || v_add)); end if;
    end if;
  end loop;
  return w;
end $function$;
comment on function public.wa284_w_participation(bigint, bigint, boolean) is 'wave284: batch 7 (participation). Each Keela tag goes by app_config keela_tag_map: to wa_campaign_people (the campaign by keela_name, else by name, with its part), to a chapter (the Toronto tags), to skip (the welcome-series and donor tags), or to tags[] for the rest. A campaign not yet in the Hub is created with the type an admin picked on the Import page (keela_campaign_types), else listed in campaigns_to_create. Adds only. The service role only.';

-- 8. form_answers: Keela responses with no Hub interaction of the same response id become timeline items, without sensitive answers
create or replace function public.wa284_w_form_answers(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0();
  f bigint := public.wa284_file(p_run, 'keela_responses_json');
  k_rid text := public.wa284_need(f, 'resp_id'); k_form text := public.wa284_need(f, 'resp_form'); k_cid text := public.wa284_need(f, 'resp_contact');
  k_email text := public.wa284_need(f, 'resp_email', false); k_date text := public.wa284_need(f, 'resp_date'); k_ans text := public.wa284_need(f, 'resp_answers');
  k_q text := public.wa284_key('ans_q'); k_a text := public.wa284_key('ans_a');
  v_sens text := '(birth|naissance|\mdob\M|\mddn\M|health|sant[eé]|medical|m[eé]dical|medicat|m[eé]dicament|condition|disabilit|handicap|dietary|di[eé]t|injur|blessure|allerg|address|adresse|street|postal)';
  r record; v_rid text; v_form text; v_id bigint; v_d date; v_body text; v_lines text[]; v_skipped int; q record; v_i public.crm_interactions; v_ch public.crm_contact_chapters;
begin
  for r in select x.row_no, x.data from import_stage.rows x where x.file_id = f order by x.row_no loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    v_rid := public.wa284_txt(r.data -> k_rid); v_form := public.wa284_txt(r.data -> k_form);
    if v_rid is null then w := public.wa284_bump(w, '{counts,skipped,no response id}'); continue; end if;
    if exists (select 1 from public.crm_interactions i where i.source = 'keela' and i.source_ref in (v_rid, 'keela:' || v_rid)) then
      w := public.wa284_bump(w, '{counts,skipped,already in the Hub}'); continue;
    end if;
    v_id := public.wa284_contact(public.wa284_txt(r.data -> k_cid), case when k_email is null then null else lower(public.wa284_txt(r.data -> k_email)) end);
    if v_id is null then
      w := public.wa284_bump(w, '{counts,skipped,no Hub contact}');
      w := public.wa284_push(w, 'keela_ids_skipped', jsonb_build_object('response_id', v_rid, 'reason', 'no Hub contact')); continue;
    end if;
    v_d := public.wa284_date(public.wa284_txt(r.data -> k_date));
    if v_d is null then w := public.wa284_bump(w, '{counts,skipped,no date}'); continue; end if;
    w := public.wa284_bump(w, '{counts,matched}');
    -- the answers as "Question: answer" lines, leaving out birth date, health and home address answers
    v_lines := '{}'; v_skipped := 0;
    for q in
      select y.qn, y.an, y.o from (
        select e.key as qn, coalesce(public.wa284_txt(e.value), nullif(array_to_string(public.wa284_list(e.value), ', '), '')) as an, 0::bigint as o
          from jsonb_each(case when jsonb_typeof(r.data -> k_ans) = 'object' then r.data -> k_ans else '{}'::jsonb end) e
        union all
        select coalesce(public.wa284_txt(a.e -> k_q), ''), coalesce(public.wa284_txt(a.e -> k_a), nullif(array_to_string(public.wa284_list(a.e -> k_a), ', '), ''), public.wa284_txt(a.e)), a.o
          from jsonb_array_elements(case when jsonb_typeof(r.data -> k_ans) = 'array' then r.data -> k_ans else '[]'::jsonb end) with ordinality as a(e, o)
      ) y order by y.o, y.qn
    loop
      if q.an is null then continue; end if;
      if q.qn ~* v_sens then v_skipped := v_skipped + 1; continue; end if;
      v_lines := v_lines || (case when q.qn = '' then q.an else q.qn || ': ' || q.an end);
    end loop;
    if v_skipped > 0 then w := public.wa284_bump(w, '{counts,skipped,sensitive answer left out}', v_skipped); end if;
    v_body := array_to_string(v_lines, E'\n');
    insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
    values (v_id, 'form', 'in', 'website', coalesce(v_form, 'Keela form'), nullif(v_body, ''), (v_d + time '12:00') at time zone 'America/Toronto', 'keela', 'keela:' || v_rid,
            jsonb_build_object('type', 'Form Response', 'form', v_form, 'import_batch', p_batch), 'Keela import')
    returning * into v_i;
    perform public.wa284_chg(p_batch, 'crm_interactions', v_i.id::text, null, null, to_jsonb(v_i), 'insert');
    if v_form ~* 'toronto' then
      v_ch := null;
      insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by) values (v_id, 'toronto', 'import', 'Keela import batch ' || p_batch, 'Keela import')
      on conflict (contact_id, chapter) do nothing returning * into v_ch;
      if v_ch.contact_id is not null then perform public.wa284_chg(p_batch, 'crm_contact_chapters', v_ch.contact_id || ':toronto', 'toronto', null, to_jsonb(v_ch), 'insert'); end if;
    end if;
  end loop;
  return w;
end $function$;
comment on function public.wa284_w_form_answers(bigint, bigint, boolean) is 'wave284: batch 8 (form_answers). Keela responses with no Hub interaction of the same response id (source keela, source_ref keela:<id>, as the first import wrote them) become crm_interactions rows: kind form, direction in, channel website, the form name as subject, the answers as "Question: answer" lines (answers about a birth date or DOB, health, a medical matter, medication, a condition, a disability, diet, an injury, allergies or a home address left out), the day it was given. A Toronto form adds the Toronto chapter. Adds only. The service role only.';

-- ============================================================================================ 7. dispatch, report, compare, apply, undo, purge
create or replace function public.wa284_write(p_batch bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare b public.crm_import_batches;
begin
  select * into b from public.crm_import_batches x where x.id = p_batch;
  if b.id is null then raise exception 'wa284: there is no batch %', p_batch; end if;
  return case b.kind
    when 'optouts' then public.wa284_w_optouts(p_batch, b.run_id, p_rehearse)
    when 'legacy_fields' then public.wa284_w_legacy_fields(p_batch, b.run_id, p_rehearse)
    when 'people' then public.wa284_w_people(p_batch, b.run_id, p_rehearse)
    when 'fields' then public.wa284_w_fields(p_batch, b.run_id, p_rehearse)
    when 'orgs' then public.wa284_w_orgs(p_batch, b.run_id, p_rehearse)
    when 'consent' then public.wa284_w_consent(p_batch, b.run_id, p_rehearse)
    when 'participation' then public.wa284_w_participation(p_batch, b.run_id, p_rehearse)
    when 'form_answers' then public.wa284_w_form_answers(p_batch, b.run_id, p_rehearse)
  end;
end $function$;
comment on function public.wa284_write(bigint, boolean) is 'wave284: runs the writer for a batch''s kind (wa284_w_<kind>) and returns its counts and lists. Compare and Apply both call it, so a compare''s report is exactly what Apply will do. The service role only.';

create or replace function public.wa284_report(p_batch bigint, p_w jsonb)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'kind', (select b.kind from public.crm_import_batches b where b.id = p_batch),
    'counts', jsonb_build_object(
      'rows_read', coalesce((p_w #>> '{counts,rows_read}')::int, 0),
      'matched', coalesce((p_w #>> '{counts,matched}')::int, 0),
      'created', (select count(*) from public.crm_import_changes c where c.batch_id = p_batch and c.action = 'insert' and c.table_name in ('crm_contacts', 'wa_partners', 'wa_campaigns')),
      'updated', coalesce((select jsonb_object_agg(g.f, g.n) from (select case when c.action = 'update' then c.column_name else c.table_name end as f, count(*) as n
                                                                       from public.crm_import_changes c
                                                                      where c.batch_id = p_batch and not (c.action = 'insert' and c.table_name in ('crm_contacts', 'wa_partners', 'wa_campaigns'))
                                                                      group by 1) g), '{}'::jsonb),
      'kept_hub_value', coalesce(p_w #> '{counts,kept_hub_value}', '{}'::jsonb),
      'skipped', coalesce(p_w #> '{counts,skipped}', '{}'::jsonb))
      || jsonb_strip_nulls(jsonb_build_object('undated_events', p_w #> '{counts,undated_events}', 'undated_optouts_honoured', p_w #> '{counts,undated_optouts_honoured}',
                                   'created_not_emailed', p_w #> '{counts,created_not_emailed}')),
    'lists', '{"keela_ids_skipped": [], "org_pairs": [], "assignees_unmapped": [], "campaigns_to_create": [], "changed_since_kept": [], "created_review": []}'::jsonb
             || coalesce(p_w -> 'lists', '{}'::jsonb),
    'changes', (select count(*) from public.crm_import_changes c where c.batch_id = p_batch))
$function$;
comment on function public.wa284_report(bigint, jsonb) is 'wave284: a batch''s report: the writer''s counts and lists, plus created and updated counted from the batch''s crm_import_changes rows. Never holds an email, phone, address, birth date or note. The service role only.';

create or replace function public.wa284_guard()
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if to_regclass('net.http_request_queue') is not null
     and exists (select 1 from net.http_request_queue q where q.xmin::text = (pg_current_xact_id()::text::bigint % 4294967296)::text) then
    raise exception 'import side effect blocked (net.http_request_queue)';
  end if;
end $function$;
comment on function public.wa284_guard() is 'wave284: the side-effect guard''s last check after a writer runs in wa284_apply: any web call this transaction queued (net.http_request_queue rows whose xmin is this transaction) stops the batch. The nine guarded tables are covered by trg_wa284_import_guard. The service role only.';

create or replace function public.wa284_import_guard()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if nullif(current_setting('wa.import_batch', true), '') is not null then
    raise exception 'import side effect blocked (%)', tg_table_name;
  end if;
  return new;
end $function$;
revoke all on function public.wa284_import_guard() from public, anon, authenticated;
comment on function public.wa284_import_guard() is 'wave284: trigger function (trg_wa284_import_guard, before insert) on dept_requests, crm_email_sends, quo_messages, whatsapp_messages, crm_automation_runs, hub_notifications_sent, volunteer_applications, crm_form_submissions and event_roster: refuses the row with "import side effect blocked" whenever wa.import_batch is set (an import batch is comparing, applying or undoing), even inside a subtransaction.';
do $wa284$
declare t text;
begin
  foreach t in array array['dept_requests', 'crm_email_sends', 'quo_messages', 'whatsapp_messages', 'crm_automation_runs', 'hub_notifications_sent',
                           'volunteer_applications', 'crm_form_submissions', 'event_roster'] loop
    if to_regclass('public.' || t) is null then raise exception 'wave284: the guarded table % is missing', t; end if;
    execute format('drop trigger if exists trg_wa284_import_guard on public.%I', t);
    execute format('create trigger trg_wa284_import_guard before insert on public.%I for each row execute function public.wa284_import_guard()', t);
    execute format('comment on trigger trg_wa284_import_guard on public.%I is %L', t, 'wave284: no row here while an import batch runs (wa284_import_guard).');
  end loop;
end $wa284$;

create or replace function public.wa284_basis(p_batch bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare b public.crm_import_batches; v_kind text; v_keys text[]; f import_stage.files;
begin
  select * into b from public.crm_import_batches x where x.id = p_batch;
  v_kind := case b.kind when 'legacy_fields' then null when 'form_answers' then 'keela_responses_json' else 'keela_contacts_json' end;
  if v_kind is not null then
    select * into f from import_stage.files x where x.run_id = b.run_id and x.kind = v_kind and x.rows is not null and x.staged_through = x.rows order by x.id desc limit 1;
  end if;
  v_keys := case b.kind when 'legacy_fields' then array['keela_assignee_map']
                        when 'orgs' then array['keela_keys', 'keela_org_pairs_ok', 'keela_company_category_map', 'keela_status_map']
                        when 'participation' then array['keela_keys', 'keela_tag_map', 'keela_campaign_types']
                        else array['keela_keys'] end;
  return jsonb_build_object('file_id', f.id, 'rows', f.rows, 'staged_at', extract(epoch from f.staged_at),   -- as a number: the same whatever the session's time zone
    'settings', (select md5(string_agg(k.k || '=' || coalesce(c.value, ''), '|' order by k.k)) from unnest(v_keys) as k(k) left join public.app_config c on c.key = k.k));
end $function$;
comment on function public.wa284_basis(bigint) is 'wave284: what a batch''s compare was based on: the staged file it read (id, rows, when it was staged) and a checksum of the settings it uses (keela_keys; the assignee map for legacy_fields; the pairs, category and status maps for orgs; the tag map and campaign types for participation). wa284_compare keeps it in the report as basis, and wa284_apply refuses when it has changed since, so what is applied is what was compared. The service role only.';

create or replace function public.wa284_compare(p_batch bigint, p_by text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare b public.crm_import_batches; v_w jsonb; v_report jsonb; v_err text; v_state text; v_table text; v_col text; v_con text;
begin
  select * into b from public.crm_import_batches x where x.id = p_batch for update;
  if b.id is null then raise exception 'wa284: there is no batch %', p_batch; end if;
  if b.status = 'applied' then raise exception 'wa284: this batch is applied; undo it before comparing again'; end if;
  if (select r.purged_at from public.crm_import_runs r where r.id = b.run_id) is not null then raise exception 'wa284: this run was purged; start a new run'; end if;
  begin
    perform set_config('wa.no_automations', 'on', true);
    perform set_config('wa.import_batch', p_batch::text, true);
    perform set_config('wa.consent_source', 'Keela import', true);
    delete from public.crm_import_changes c where c.batch_id = p_batch;   -- the records of an earlier, undone apply (back after the rollback)
    v_w := public.wa284_write(p_batch, true);
    v_report := public.wa284_report(p_batch, v_w) || jsonb_build_object('basis', public.wa284_basis(p_batch));
    raise exception using errcode = 'WA284', message = 'wa284: compare rolled back';
  exception
    when sqlstate 'WA284' then
      update public.crm_import_batches x set status = 'compared', report = v_report, error = null where x.id = p_batch;
    when others then
      get stacked diagnostics v_err = message_text, v_state = returned_sqlstate, v_table = table_name, v_col = column_name, v_con = constraint_name;
      v_err := case when v_err ~ '^(missing key|wa284:|import side effect blocked)' then left(v_err, 300)
                    else 'stopped by the database (' || v_state || coalesce(', ' || nullif(v_table, ''), '') || coalesce('.' || nullif(v_col, ''), '')
                         || coalesce(', ' || nullif(v_con, ''), '') || ')' end;
      update public.crm_import_batches x set status = 'failed', report = null, error = v_err where x.id = p_batch;
      v_report := null;
  end;
  return coalesce(v_report, jsonb_build_object('error', v_err));
end $function$;
comment on function public.wa284_compare(bigint, text) is 'wave284: Compare. Runs the batch''s writer with the same settings as Apply (automations off, the guard on), builds the report from its change records, then raises WA284 so the exception block rolls every change back; the handler stores the report and sets status compared. Any other error sets status failed with a message that names a key, a row number or the database''s error code, never a value. The service role only.';

create or replace function public.wa284_apply(p_batch bigint, p_by text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare b public.crm_import_batches; v_w jsonb; v_report jsonb;
begin
  select * into b from public.crm_import_batches x where x.id = p_batch for update;
  if b.id is null then raise exception 'wa284: there is no batch %', p_batch; end if;
  if b.status <> 'compared' then raise exception 'wa284: compare this batch first (it is %)', b.status; end if;
  if (select r.purged_at from public.crm_import_runs r where r.id = b.run_id) is not null then raise exception 'wa284: this run was purged; start a new run'; end if;
  -- what is applied is what was compared: the same staged file and the same settings
  if (b.report -> 'basis') is distinct from public.wa284_basis(p_batch) then
    raise exception 'wa284: the staged file or the settings changed since the compare; compare again';
  end if;
  perform set_config('wa.no_automations', 'on', true);
  perform set_config('wa.import_batch', p_batch::text, true);
  perform set_config('wa.consent_source', 'Keela import', true);
  delete from public.crm_import_changes c where c.batch_id = p_batch;   -- the records of an earlier apply that was undone
  v_w := public.wa284_write(p_batch, false);
  perform public.wa284_guard();
  v_report := public.wa284_report(p_batch, v_w) || jsonb_build_object('basis', b.report -> 'basis');
  update public.crm_import_batches x set status = 'applied', report = v_report, error = null, applied_at = now(), applied_by = coalesce(nullif(p_by, ''), 'service'),
         undone_at = null, undone_by = null
   where x.id = p_batch;
  update public.crm_import_runs r set last_applied_at = now() where r.id = b.run_id;
  return v_report;
end $function$;
comment on function public.wa284_apply(bigint, text) is 'wave284: Apply, on an admin''s yes after a compare. It refuses when the staged file or the settings the compare read have changed since (wa284_basis). In one transaction: wa.no_automations on, wa.import_batch the batch and wa.consent_source Keela import; the writer; the side-effect guard (wa284_guard, and the trigger trg_wa284_import_guard on nine tables); then status applied, the report, who and when, and crm_import_runs.last_applied_at. Any error rolls all of it back (crm-import then records it with wa284_fail). The service role only.';

create or replace function public.wa284_fail(p_batch bigint, p_error text)
returns void language sql security definer set search_path to '' as $function$
  update public.crm_import_batches x set status = 'failed', error = left(coalesce(p_error, 'stopped'), 300) where x.id = p_batch and x.status <> 'applied'
$function$;
comment on function public.wa284_fail(bigint, text) is 'wave284: records that an apply stopped (crm-import passes the cleaned message: a key, a row number or an error code, never a value). The service role only.';

create or replace function public.wa284_unrow(p_table text, p_row text, p_new jsonb)
returns int language plpgsql security definer set search_path to '' as $function$
declare n int := 0; ts text[] := array['updated_at', 'created_at', 'added_at'];
begin
  if p_table = 'crm_contact_fields' then
    delete from public.crm_contact_fields t where t.contact_id = split_part(p_row, ':', 1)::bigint and t.field_id = split_part(p_row, ':', 2)::bigint and (to_jsonb(t) - ts) = (p_new - ts);
  elsif p_table = 'wa_campaign_people' then
    delete from public.wa_campaign_people t where t.campaign_id = split_part(p_row, ':', 1)::bigint and t.contact_id = split_part(p_row, ':', 2)::bigint
       and t.part = split_part(p_row, ':', 3) and (to_jsonb(t) - ts) = (p_new - ts);
  elsif p_table = 'crm_contact_chapters' then
    delete from public.crm_contact_chapters t where t.contact_id = split_part(p_row, ':', 1)::bigint and t.chapter = split_part(p_row, ':', 2) and (to_jsonb(t) - ts) = (p_new - ts);
  elsif p_table = 'crm_interactions' then
    delete from public.crm_interactions t where t.id = p_row::bigint and (to_jsonb(t) - ts) = (p_new - ts);
  elsif p_table = 'crm_contact_orgs' then
    delete from public.crm_contact_orgs t where t.id = p_row::bigint and (to_jsonb(t) - ts) = (p_new - ts);
  else
    return 0;
  end if;
  get diagnostics n = row_count;
  return n;
end $function$;
comment on function public.wa284_unrow(text, text, jsonb) is 'wave284: removes a row an import inserted (crm_contact_fields, wa_campaign_people, crm_contact_chapters, crm_interactions, crm_contact_orgs) only when it is unchanged since (every column but its timestamps equals the recorded row); says how many it removed (0 or 1). The service role only.';

create or replace function public.wa284_undo(p_batch bigint, p_by text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  b public.crm_import_batches; c record; v_cur jsonb; v_n int; v_kept jsonb := '[]'; v_review jsonb := '[]'; v_restored int := 0; v_removed int := 0; v_report jsonb;
  v_never text[] := array['email_status', 'email_consent', 'consent_source', 'consent_at', 'sms_opt_out', 'sms_consent', 'sms_consent_source', 'sms_consent_at',
                          'whatsapp_opt_out', 'do_not_contact', 'dnc_reason', 'dnc_at', 'dnc_by'];
begin
  select * into b from public.crm_import_batches x where x.id = p_batch for update;
  if b.id is null then raise exception 'wa284: there is no batch %', p_batch; end if;
  if b.kind in ('optouts', 'consent') then raise exception 'wa284: the % batch is never undone (opt-outs and consent stay)', b.kind; end if;
  if b.status <> 'applied' then raise exception 'wa284: only an applied batch can be undone (it is %)', b.status; end if;
  if (select r.purged_at from public.crm_import_runs r where r.id = b.run_id) is not null then raise exception 'wa284: this run was purged; its change records are gone'; end if;
  perform set_config('wa.no_automations', 'on', true);
  perform set_config('wa.import_batch', p_batch::text, true);
  perform set_config('wa.consent_source', 'Keela import undo', true);
  for c in select * from public.crm_import_changes x where x.batch_id = p_batch order by x.id desc loop
    if c.action = 'update' then
      if c.column_name = any(v_never) then
        v_kept := v_kept || jsonb_build_object('table', c.table_name, 'row_id', c.row_id, 'column', c.column_name, 'why', 'consent is never undone');
        continue;
      end if;
      execute format('select to_jsonb(t.%I) from public.%I t where t.id = $1', c.column_name, c.table_name) into v_cur using c.row_id::bigint;
      if v_cur is not distinct from c.new_value then
        perform public.wa284_set(c.table_name, c.row_id::bigint, c.column_name, c.old_value);
        v_restored := v_restored + 1;
      else
        v_kept := v_kept || jsonb_build_object('table', c.table_name, 'row_id', c.row_id, 'column', c.column_name, 'why', 'changed since');
      end if;
    elsif c.table_name in ('crm_contacts', 'wa_partners', 'wa_campaigns') then
      v_review := v_review || jsonb_build_object('table', c.table_name, 'row_id', c.row_id);
    elsif c.table_name = 'crm_contact_private' then
      delete from public.crm_contact_private p where p.contact_id = c.row_id::bigint and p.source = 'Keela import' and p.updated_at = b.applied_at;
      get diagnostics v_n = row_count;
      if v_n > 0 then v_removed := v_removed + 1;
      else v_kept := v_kept || jsonb_build_object('table', c.table_name, 'row_id', c.row_id, 'column', 'birth_date', 'why', 'changed since'); end if;
    else
      v_n := public.wa284_unrow(c.table_name, c.row_id, c.new_value);
      if v_n > 0 then v_removed := v_removed + 1;
      else v_kept := v_kept || jsonb_build_object('table', c.table_name, 'row_id', c.row_id, 'column', c.column_name, 'why', 'changed since'); end if;
    end if;
  end loop;
  v_report := coalesce(b.report, jsonb_build_object('kind', b.kind, 'counts', '{}'::jsonb, 'lists', '{}'::jsonb));
  v_report := jsonb_set(v_report, '{lists}', coalesce(v_report -> 'lists', '{}'::jsonb) || jsonb_build_object('changed_since_kept', v_kept, 'created_review', v_review), true);
  v_report := v_report || jsonb_build_object('undo', jsonb_build_object('restored', v_restored, 'removed', v_removed, 'kept', jsonb_array_length(v_kept), 'review', jsonb_array_length(v_review)));
  update public.crm_import_batches x set status = 'undone', report = v_report, undone_at = now(), undone_by = coalesce(nullif(p_by, ''), 'service') where x.id = p_batch;
  return v_report;
end $function$;
comment on function public.wa284_undo(bigint, text) is 'wave284: Undo an applied batch (never optouts or consent). Walks its changes backwards: an update whose column still holds the new value gets its old value back, otherwise it is kept and listed (changed_since_kept); consent and opt-out columns are never put back. A new contact, organisation or campaign is listed for review by hand (created_review), never deleted. A row the import added (custom field, Campaign row, chapter, timeline item, organisation link) is removed only when unchanged since; a birth-date row only when its source and time are still the import''s. Status undone. The service role only.';

create or replace function public.wa284_purge(p_run bigint)
returns text[] language plpgsql security definer set search_path to '' as $function$
declare v_paths text[];
begin
  if not exists (select 1 from public.crm_import_runs r where r.id = p_run) then raise exception 'wa284: there is no run %', p_run; end if;
  select coalesce(array_agg(f.name order by f.id), '{}') into v_paths from import_stage.files f where f.run_id = p_run and f.name is not null;
  delete from import_stage.rows x where x.run_id = p_run;
  delete from import_stage.files f where f.run_id = p_run;
  delete from public.crm_import_changes c where c.batch_id in (select b.id from public.crm_import_batches b where b.run_id = p_run);
  update public.crm_import_runs r set purged_at = now() where r.id = p_run;
  return v_paths;
end $function$;
comment on function public.wa284_purge(bigint) is 'wave284: Purge a run: deletes its staged rows, its file records and its change records (so its batches can no longer be undone), marks it purged, and returns the storage paths crm-import then deletes from the imports bucket. The service role only.';

-- ============================================================================================ 8. helpers for crm-import (the API cannot reach import_stage)
create or replace function public.wa284_new_run(p_label text, p_by text default null)
returns bigint language sql security definer set search_path to '' as $function$
  insert into public.crm_import_runs (label, created_by) values (left(nullif(btrim(coalesce(p_label, '')), ''), 120), nullif(p_by, '')) returning id
$function$;
comment on function public.wa284_new_run(text, text) is 'wave284: starts a run with a label (at most 120 characters) and who started it; returns its id. The service role only.';

create or replace function public.wa284_register(p_run bigint, p_path text, p_kind text)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v bigint;
begin
  if not exists (select 1 from public.crm_import_runs r where r.id = p_run and r.purged_at is null) then raise exception 'wa284: there is no open run %', p_run; end if;
  if p_kind not in ('keela_contacts_json', 'keela_responses_json', 'keela_interactions_csv', 'keela_transactions_csv') then raise exception 'wa284: unknown file kind %', p_kind; end if;
  if p_path is null or position(p_run::text || '/' in p_path) <> 1 or p_path like '%..%' then raise exception 'wa284: the file must be in the run''s folder'; end if;
  insert into import_stage.files (run_id, name, kind) values (p_run, p_path, p_kind) returning id into v;
  return v;
end $function$;
comment on function public.wa284_register(bigint, text, text) is 'wave284: records an uploaded file (its path in the imports bucket, inside the run''s folder <run>/, and its kind) for a run that is not purged; returns its id. The service role only.';

create or replace function public.wa284_stage_rows(p_file bigint, p_from int, p_rows jsonb, p_total int default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare f import_stage.files; n int;
begin
  select * into f from import_stage.files x where x.id = p_file for update;
  if f.id is null then raise exception 'wa284: there is no file %', p_file; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'wa284: rows must be a list'; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) e where jsonb_typeof(e) <> 'object') then raise exception 'wa284: every row must be an object'; end if;
  if p_from = 0 then
    delete from import_stage.rows x where x.file_id = p_file;
    update import_stage.files x set rows = p_total, staged_through = 0 where x.id = p_file;
  elsif p_from <> coalesce(f.staged_through, -1) then
    raise exception 'wa284: rows are staged in order (the next row is %)', coalesce(f.staged_through, 0) + 1;
  end if;
  insert into import_stage.rows (run_id, file_id, row_no, data)
  select f.run_id, p_file, p_from + e.o::int, e.v from jsonb_array_elements(p_rows) with ordinality as e(v, o);
  n := jsonb_array_length(p_rows);
  update import_stage.files x set staged_through = p_from + n, staged_at = now(), rows = coalesce(p_total, x.rows) where x.id = p_file;
  return (select jsonb_build_object('file_id', x.id, 'rows', x.rows, 'staged_through', x.staged_through) from import_stage.files x where x.id = p_file);
end $function$;
comment on function public.wa284_stage_rows(bigint, int, jsonb, int) is 'wave284: stages one chunk of a file''s rows (a list of objects) from row p_from: from 0 it first deletes the file''s rows and sets the total; later chunks must follow on. Rows are numbered from 1. Returns the file''s rows and staged_through. The service role only.';

create or replace function public.wa284_files(p_run bigint, p_file bigint default null)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'run_id', f.run_id, 'name', f.name, 'kind', f.kind, 'rows', f.rows, 'staged_through', f.staged_through, 'staged_at', f.staged_at)
                            order by f.id), '[]'::jsonb)
    from import_stage.files f where (p_run is null or f.run_id = p_run) and (p_file is null or f.id = p_file)
$function$;
comment on function public.wa284_files(bigint, bigint) is 'wave284: a run''s files (or one file): id, path, kind, rows and how many are staged. No values. The service role only.';

create or replace function public.wa284_keys(p_file bigint)
returns table (key text, filled bigint) language sql stable security definer set search_path to '' as $function$
  select k.key, count(*) filter (where public.wa284_txt(k.value) is not null or (jsonb_typeof(k.value) in ('array', 'object') and k.value not in ('[]'::jsonb, '{}'::jsonb))
                                 or (jsonb_typeof(k.value) = 'boolean' and k.value = 'true'::jsonb))
    from import_stage.rows r, jsonb_each(r.data) k where r.file_id = p_file group by k.key
  union all
  select r2.key || '[].' || i.key, count(*) filter (where public.wa284_txt(i.value) is not null)
    from import_stage.rows r, jsonb_each(r.data) r2, jsonb_array_elements(case when jsonb_typeof(r2.value) = 'array' then r2.value else '[]'::jsonb end) e,
         jsonb_each(case when jsonb_typeof(e) = 'object' then e else '{}'::jsonb end) i
   where r.file_id = p_file group by r2.key, i.key
   order by 1
$function$;
comment on function public.wa284_keys(bigint) is 'wave284: a staged file''s keys (the CSV headers or the JSON keys) with how many rows have a value for each, and the keys inside lists of objects as <key>[].<inner key>. Never a value. The Import page shows it before the first compare. The service role only.';

create or replace function public.wa284_new_batch(p_run bigint, p_kind text)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v bigint;
begin
  if not exists (select 1 from public.crm_import_runs r where r.id = p_run and r.purged_at is null) then raise exception 'wa284: there is no open run %', p_run; end if;
  if p_kind not in ('optouts', 'legacy_fields', 'people', 'fields', 'orgs', 'consent', 'participation', 'form_answers') then raise exception 'wa284: unknown batch kind %', p_kind; end if;
  insert into public.crm_import_batches (run_id, kind) values (p_run, p_kind) on conflict (run_id, kind) do nothing;
  select b.id into v from public.crm_import_batches b where b.run_id = p_run and b.kind = p_kind;
  return v;
end $function$;
comment on function public.wa284_new_batch(bigint, text) is 'wave284: the run''s batch of a kind, created (status new) the first time; one per kind per run. The service role only.';

-- ============================================================================================ 9. every wa284_ function: the service role only
do $wa284$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'wa284\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname <> 'wa284_import_guard' then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $wa284$;

-- ============================================================================================ 10. the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave284', 'wave284', null,
       'The Import page: the private bucket imports, import_stage, crm_import_runs, crm_import_batches and crm_import_changes, the keela_ mapping settings, the wa284_ functions (service role only) and the side-effect guard on nine tables.', 'wave284'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave284' and field = 'wave284');
