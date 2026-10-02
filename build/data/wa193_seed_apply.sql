-- wa193_seed_apply (02/10/26): move the seed rows posted by wa193_seed.py (wa_stage_193seed) into the fund_* tables,
-- and copy the past applications kept as Google Docs (wa_drive_docs) into fund_documents. Idempotent on the funder names.
do $$
declare r record; fid bigint; gid bigint; n int := 0;
begin
  -- 1. funders
  for r in select v from public.wa_stage_193seed where k = 'funder' loop
    insert into public.fund_funders (name, aliases, kind, region, url, portal, contact, eligibility, funds_what, cycle, next_deadline, amount_min, amount_max, fit, fit_note, relationship, notes, watch, screened_out, screened_reason, source, created_by, updated_by)
    values (r.v->>'name', coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(r.v->'aliases', '[]'::jsonb)) x), '{}'), coalesce(r.v->>'kind', 'other'), coalesce(r.v->>'region', 'canada'), nullif(r.v->>'url', ''), left(r.v->>'portal', 600), left(r.v->>'contact', 400), r.v->>'eligibility', r.v->>'funds_what', left(r.v->>'cycle', 600), nullif(r.v->>'next_deadline', '')::date,
      nullif(r.v->>'amount_min', '')::numeric, nullif(r.v->>'amount_max', '')::numeric, coalesce(r.v->>'fit', 'unknown'), r.v->>'fit_note', r.v->>'relationship', r.v->>'notes', coalesce((r.v->>'watch')::boolean, false), coalesce((r.v->>'screened_out')::boolean, false), r.v->>'screened_reason', r.v->>'source', 'wave193', 'wave193')
    on conflict ((lower(name))) do update set aliases = excluded.aliases, kind = excluded.kind, region = excluded.region, url = coalesce(excluded.url, public.fund_funders.url), portal = excluded.portal, contact = excluded.contact, eligibility = excluded.eligibility, funds_what = excluded.funds_what, cycle = excluded.cycle, next_deadline = excluded.next_deadline, amount_min = excluded.amount_min, amount_max = excluded.amount_max, fit = excluded.fit, fit_note = excluded.fit_note, relationship = excluded.relationship, notes = excluded.notes, watch = excluded.watch, screened_out = excluded.screened_out, screened_reason = excluded.screened_reason, source = excluded.source, updated_by = 'wave193';
    n := n + 1;
  end loop;
  raise notice 'funders %', n; n := 0;
  -- 2. grants (one per funder and program; a rerun does not duplicate)
  for r in select v from public.wa_stage_193seed where k = 'grant' loop
    select id into fid from public.fund_funders where lower(name) = lower(r.v->>'funder');
    if fid is null then raise notice 'no funder for %', r.v->>'funder'; continue; end if;
    if exists (select 1 from public.fund_grants g where g.funder_id = fid and lower(g.program) = lower(r.v->>'program')) then continue; end if;
    insert into public.fund_grants (funder_id, program, title, stage, amount_ask, amount_awarded, deadline, deadline_note, submitted_on, decided_on, decision_note, owner_name, partner, program_area, next_action, links, source, source_ref, notes, created_by, updated_by)
    values (fid, r.v->>'program', r.v->>'title', coalesce(r.v->>'stage', 'watching'), nullif(r.v->>'amount_ask', '')::numeric, nullif(r.v->>'amount_awarded', '')::numeric, nullif(r.v->>'deadline', '')::date, left(r.v->>'deadline_note', 300), nullif(r.v->>'submitted_on', '')::date, nullif(r.v->>'decided_on', '')::date, r.v->>'decision_note', left(r.v->>'owner_name', 200), r.v->>'partner', r.v->>'program_area', r.v->>'next_action', coalesce(r.v->'links', '[]'::jsonb), r.v->>'source', left(r.v->>'source_ref', 600), r.v->>'notes', 'wave193', 'wave193')
    returning id into gid;
    insert into public.fund_grant_log (grant_id, who, kind, text) values (gid, 'wave193', 'note', 'Seeded on 02/10/26 from ' || coalesce(r.v->>'source', 'the research') || ' at stage ' || replace(coalesce(r.v->>'stage', 'watching'), '_', ' ') || '.');
    n := n + 1;
  end loop;
  raise notice 'grants %', n; n := 0;
  -- 3. the scanner's sources
  for r in select v from public.wa_stage_193seed where k = 'source' loop
    fid := null;
    if r.v->>'funder' is not null then select id into fid from public.fund_funders where lower(name) = lower(r.v->>'funder'); end if;
    if exists (select 1 from public.fund_sources s where s.name = r.v->>'name') then continue; end if;
    insert into public.fund_sources (funder_id, name, kind, url, query, active, notes) values (fid, r.v->>'name', coalesce(r.v->>'kind', 'funder_page'), nullif(r.v->>'url', ''), r.v->>'query', coalesce((r.v->>'active')::boolean, true), r.v->>'notes');
    n := n + 1;
  end loop;
  raise notice 'sources %', n; n := 0;
  -- 4. facts
  for r in select v from public.wa_stage_193seed where k = 'fact' loop
    insert into public.fund_facts (key, category, title, body, body_fr, source, status, sort, notes, verified_on, verified_by, updated_by)
    values (r.v->>'key', r.v->>'category', r.v->>'title', r.v->>'body', r.v->>'body_fr', r.v->>'source', coalesce(r.v->>'status', 'needs_check'), coalesce((r.v->>'sort')::int, 100), r.v->>'notes', case when r.v->>'status' = 'verified' then date '2026-10-02' end, case when r.v->>'status' = 'verified' then 'wave193 (against the documents on file)' end, 'wave193')
    on conflict (key) do update set category = excluded.category, title = excluded.title, body = excluded.body, source = excluded.source, status = excluded.status, sort = excluded.sort, notes = excluded.notes, updated_by = 'wave193';
    n := n + 1;
  end loop;
  raise notice 'facts %', n; n := 0;
  -- 5. documents posted (the OCR texts and the three Drive docs read on 02/10/26)
  for r in select v from public.wa_stage_193seed where k = 'doc' loop
    if exists (select 1 from public.fund_documents d where d.title = r.v->>'title') then continue; end if;
    fid := null; gid := null;
    if r.v->>'funder' is not null then select id into fid from public.fund_funders where lower(name) = lower(r.v->>'funder'); end if;
    if fid is not null and r.v->>'grant_hint' is not null then select id into gid from public.fund_grants g where g.funder_id = fid and g.program ilike '%' || (r.v->>'grant_hint') || '%' order by id limit 1; end if;
    insert into public.fund_documents (grant_id, funder_id, title, kind, lang, doc_date, text, words, source_url, source, created_by)
    values (gid, fid, r.v->>'title', coalesce(r.v->>'kind', 'other'), coalesce(r.v->>'lang', 'en'), nullif(r.v->>'doc_date', '')::date, r.v->>'text', (r.v->>'words')::int, r.v->>'source_url', r.v->>'source', 'wave193');
    n := n + 1;
  end loop;
  raise notice 'docs posted %', n; n := 0;
  -- 6. documents that live in Drive as Google Docs: their text is already in the Hub (wa_drive_docs)
  for r in select * from (values
      ('16xQZtQt_EXpMJaIgAwo1sVzEuda20UE-kUwNYPMM7V0', 'DESTA and Welfare Avenue partnership grant application, with the answers bank (Sept 2026)', 'answers', '2026-09-10', 'Fondation Choquette-Legault', 'intention'),
      ('1YODVdIoqC17o9e3tM6BTVF7S8NNtLT6s_Q9biReQftg', 'Canada Service Corps micro-grants stream: the application draft (Dec 2023)', 'application', '2023-12-18', 'Employment and Social Development Canada (ESDC)', 'service corps'),
      ('1LBt18Y_Dbdmva5l6ioX1mCDRDqS55CgiJEXPaVrBjAQ', 'Recent grant application overview: EmpowerMTL (Feb 2024)', 'application', '2024-02-12', 'Employment and Social Development Canada (ESDC)', 'service corps'),
      ('1rheiFFkySbW7ACl8-hHg5j5AGNazBVNmLVbJPjanhy8', 'Salvation Army proposal letter: the holiday gift baskets (Dec 2024)', 'letter', '2024-12-11', null, null),
      ('1wkM6ObaprR65n7tq7r-HWED9e-7iPfuUNoWEapUNfwM', 'Current grant submissions (Apr 2024)', 'plan', '2024-04-30', null, null),
      ('1LDK7h5RC_nYENuQZ_DixtEXbhSDGLkJEFw-g_lT6mLA', 'Potential grant opportunities (Sept 2025)', 'plan', '2025-09-16', null, null),
      ('1K60jJ58CoY6UkJ1duS8xI3M7X5nAZHreVplDGZnaGsk', 'Potential grant opportunities (2024)', 'plan', '2024-02-27', null, null),
      ('1OSXzT_YE6qWwbs4IFk-QlCdcUldMRcMz0ijU__qHP9Y', 'Grant Coordinator: the role (Jun 2025)', 'plan', '2025-06-21', null, null),
      ('1lDO44e3AdHrOS57B30A6vp993dq1i-aCC339sbVZTNc', 'Zensurance Small Business Grant entry story (Nov 2024)', 'application', '2024-11-07', 'Zensurance', 'small business'),
      ('1cp7AHjqNh388VjOYNBluuT0_to2f6zTJZRpn6RLe5FA', 'Grant update info (Nov 2024)', 'plan', '2024-11-07', null, null),
      ('1NztYq0rpT8lT00mwyWEj8Kjo9hImoe3NG3ydBFI7Bcw', 'Grant info (Nov 2024, first)', 'plan', '2024-11-06', null, null),
      ('11BC05UMHgnGevJW0erIkIK8j_jcuSpmUooe8rtGkA7c', 'Grant info (Nov 2024, second)', 'plan', '2024-11-06', null, null),
      ('1LPEKWos7lTSqzCIAVT1-RI2KliphGYOmaUKad1IWeL8', 'Donor Program Outline 2026', 'plan', '2026-04-16', null, null),
      ('1jAI1bjMCwtXoxs1i6cy65dLEPT57f0z8RQcjkIhvKzM', 'Donor program 2026: the three-month plan', 'plan', '2026-08-04', null, null),
      ('1kECFIy1JnZpYBpKVGA-2nHge6PbuJzV5cRploCz1ic0', 'Recurring Donor Program Outline', 'plan', '2026-03-17', null, null),
      ('11ExK-xHk4coXSYwLGB1hpmbVL4iAC1vVpkVe9DKABk0', 'Sponsorship proposal for Rally Paper (Sept 2025)', 'letter', '2025-09-10', null, null),
      ('1-E9xCT9VKdKVk6sb2lA973tEfxQQhqi1BBltL8jaoeA', 'Sponsorship proposal: Poulet Rouge (Aug 2025)', 'letter', '2025-08-28', null, null)
    ) as t(file_id, title, kind, doc_date, funder, hint) loop
    if exists (select 1 from public.fund_documents d where d.title = r.title) then continue; end if;
    fid := null; gid := null;
    if r.funder is not null then select id into fid from public.fund_funders where lower(name) = lower(r.funder); end if;
    if fid is not null and r.hint is not null then select id into gid from public.fund_grants g where g.funder_id = fid and g.program ilike '%' || r.hint || '%' order by id limit 1; end if;
    insert into public.fund_documents (grant_id, funder_id, title, kind, lang, doc_date, text, words, source_url, source, created_by)
    select gid, fid, r.title, r.kind, 'en', r.doc_date::date, d.text_content, array_length(regexp_split_to_array(d.text_content, '\s+'), 1), d.url, 'Google Drive: ' || d.name, 'wave193'
    from public.wa_drive_docs d where d.file_id = r.file_id and coalesce(d.text_content, '') <> '';
    if found then n := n + 1; end if;
  end loop;
  raise notice 'docs from drive %', n; n := 0;
  -- 7. settings
  for r in select v from public.wa_stage_193seed where k = 'setting' loop
    insert into public.fund_settings (key, value, updated_by) values (r.v->>'key', r.v->'value', 'wave193')
    on conflict (key) do update set value = excluded.value, updated_by = 'wave193';
    n := n + 1;
  end loop;
  raise notice 'settings %', n;
end $$;
select (select count(*) from public.fund_funders) as funders, (select count(*) from public.fund_grants) as grants, (select count(*) from public.fund_sources) as sources, (select count(*) from public.fund_facts) as facts, (select count(*) from public.fund_documents) as documents, (select count(*) from public.fund_settings) as settings;
