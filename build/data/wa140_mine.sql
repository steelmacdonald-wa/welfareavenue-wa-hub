-- wave140 (26/09/26): the mining pipeline. drive-mine v2 reads the text of every candidate document (drive_text),
-- Jev screens it (keep, skip, private), an OpenRouter model extracts events, partners, lessons, resources and facts
-- with quotes, and Jev checks each item against its source (drive_mined). Also: Canva designs and the charity's own
-- social posts as sources, the two AI routes, and the pump that keeps the workers going while a run is on.

alter table public.drive_inventory drop constraint if exists drive_inventory_source_check;
alter table public.drive_inventory add constraint drive_inventory_source_check
  check (source in ('shared_drive', 'my_drive', 'shared_with_me', 'connector', 'canva', 'social'));
comment on column public.drive_inventory.source is 'Where the item was found: shared_drive, my_drive, shared_with_me (Steel''s welfareavenue.com view through drive-mine), connector (legacy files), canva (a Canva design, read on 26/09/26), social (the charity''s own posts, grouped by quarter from social_posts).';

create table if not exists public.drive_text (
  file_id text primary key references public.drive_inventory (file_id) on delete cascade,
  text text not null default '',
  chars int not null default 0,
  hash text,
  method text,
  truncated boolean not null default false,
  error text,
  extracted_at timestamptz not null default now()
);
create index if not exists idx_drive_text_hash on public.drive_text (hash);
alter table public.drive_text enable row level security;
revoke all on public.drive_text from anon, authenticated;
comment on table public.drive_text is 'The plain text of each candidate document for the wave140 mining (Google Docs and Slides exported as text, Sheets through the Sheets API, Word, PowerPoint and Excel files unzipped; PDFs are read by the model itself and have no row text). Text of a document later found private is deleted. hash (md5 of the normalised text) finds copies. No policies: only the service role reads or writes.';

create table if not exists public.drive_mined (
  file_id text primary key references public.drive_inventory (file_id) on delete cascade,
  stage text not null default 'extract' check (stage in ('extract', 'screen', 'mine', 'check', 'done', 'skipped', 'private', 'failed')),
  status text not null default 'todo' check (status in ('todo', 'doing')),
  priority int not null default 2,
  attempts int not null default 0,
  claimed_at timestamptz,
  error text,
  screen jsonb,
  result jsonb,
  checked jsonb,
  model text,
  cost numeric,
  updated_at timestamptz not null default now()
);
create index if not exists idx_drive_mined_stage on public.drive_mined (stage, status, priority);
alter table public.drive_mined enable row level security;
drop policy if exists drive_mined_admin_read on public.drive_mined;
create policy drive_mined_admin_read on public.drive_mined for select to authenticated using (public.is_hub_admin());
revoke all on public.drive_mined from anon, authenticated;
grant select on public.drive_mined to authenticated;
comment on table public.drive_mined is 'One row per document in the wave140 mining. stage: extract (read the text), screen (Jev: keep, skip or private), mine (an OpenRouter model records events, partners, lessons, resources and facts, each with a quote), check (Jev checks each item against the source), then done, skipped, private or failed. screen holds Jev''s answers, result the extraction, checked Jev''s check per item; model and cost are the extraction''s. Admins read; the service role writes.';

create or replace function public.drive_mine_claim(p_stage text, p_n int)
returns table (file_id text)
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- a worker that stopped three times on the same document gives it up
  update public.drive_mined m set stage = 'failed', status = 'todo', updated_at = now(),
         error = coalesce(m.error || ' / ', '') || 'gave up after ' || m.attempts || ' tries at ' || m.stage
   where m.stage = p_stage and m.attempts >= 3 and (m.status = 'todo' or m.claimed_at < now() - interval '5 minutes');
  return query
  update public.drive_mined m set status = 'doing', claimed_at = now(), attempts = m.attempts + 1, updated_at = now()
   where m.file_id in (
     select x.file_id from public.drive_mined x
      where x.stage = p_stage and x.attempts < 3 and (x.status = 'todo' or (x.status = 'doing' and x.claimed_at < now() - interval '5 minutes'))
      order by x.priority, x.file_id
      limit greatest(1, least(p_n, 20))
      for update skip locked)
  returning m.file_id;
end;
$$;
revoke all on function public.drive_mine_claim(text, int) from public, anon, authenticated;
grant execute on function public.drive_mine_claim(text, int) to service_role;
comment on function public.drive_mine_claim(text, int) is 'Hands a drive-mine worker up to p_n documents waiting at a stage (or held more than 5 minutes by a worker that stopped); a document that failed three times at a stage is marked failed instead. Access: service role only.';

create or replace function public.drive_mine_seed()
returns int
language sql
security definer
set search_path to ''
as $$
  with ins as (
    insert into public.drive_mined (file_id, stage, priority)
    select d.file_id,
           case when d.source in ('social', 'canva') then 'mine' else 'extract' end,
           case when d.source in ('social', 'canva') then 1 when d.triage = 'gold' then 1 else 2 end
      from public.drive_inventory d
     where d.triage in ('gold', 'ore') and d.mine_note is null and not d.trashed
       and (d.source in ('social', 'canva') or d.mime in (
            'application/vnd.google-apps.document', 'application/vnd.google-apps.presentation', 'application/vnd.google-apps.spreadsheet',
            'application/pdf', 'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
    on conflict (file_id) do nothing
    returning 1)
  select count(*)::int from ins;
$$;
revoke all on function public.drive_mine_seed() from public, anon, authenticated;
grant execute on function public.drive_mine_seed() to service_role;
comment on function public.drive_mine_seed() is 'Queues every gold or ore document (not a duplicate, not trashed, a type drive-mine can read) that is not queued yet: Drive files start at extract, Canva designs and social posts (text already there) at mine. Returns how many were added. Access: service role only.';

-- copies by name: a PDF or Office file named like a Google document (its export), and "Copy of X" next to X
with g as (
  select file_id, triage, mime,
         lower(regexp_replace(regexp_replace(trim(name), '\.(pdf|docx|doc|pptx|xlsx|txt)$', '', 'i'), '^(copy of |copie de |copy de )', '', 'i')) as base,
         (name ~* '^(copy of |copie de |copy de )') as is_copy
    from public.drive_inventory where triage in ('gold', 'ore') and not trashed
), native as (
  select base from g where mime like 'application/vnd.google-apps.%' and not is_copy
)
update public.drive_inventory d set mine_note = 'duplicate (read once)'
  from g
 where g.file_id = d.file_id
   and ((g.mime not like 'application/vnd.google-apps.%' and g.base in (select base from native))
        or (g.is_copy and g.base in (select base from native)));

-- the charity's own posts, one document per quarter (a Facebook post that repeats an Instagram caption the same day is left out)
with p as (
  select distinct on (published_at::date, left(lower(regexp_replace(caption, '\s+', ' ', 'g')), 60))
         platform, published_at, url, regexp_replace(left(caption, 1500), '\s+', ' ', 'g') as cap
    from public.social_posts
   where platform in ('instagram', 'facebook', 'linkedin') and length(coalesce(caption, '')) > 40
   order by published_at::date, left(lower(regexp_replace(caption, '\s+', ' ', 'g')), 60), (platform = 'instagram') desc
), q as (
  select to_char(published_at, 'YYYY') || '-Q' || to_char(published_at, 'Q') as qtr, platform, published_at, url, cap from p
)
insert into public.drive_inventory (file_id, name, mime, source, created_time, modified_time, path, owner_email, web_url, triage, triage_reason, seen_at)
select 'social:' || qtr, 'Welfare Avenue posts on Instagram, Facebook and LinkedIn, ' || qtr, 'text/plain', 'social',
       min(published_at), max(published_at), 'Social posts', null, null, 'gold', 'the charity''s own public posts: a dated record of events', now()
  from q group by qtr
on conflict (file_id) do update set name = excluded.name, created_time = excluded.created_time, modified_time = excluded.modified_time, seen_at = now();

with p as (
  select distinct on (published_at::date, left(lower(regexp_replace(caption, '\s+', ' ', 'g')), 60))
         platform, published_at, url, regexp_replace(left(caption, 1500), '\s+', ' ', 'g') as cap
    from public.social_posts
   where platform in ('instagram', 'facebook', 'linkedin') and length(coalesce(caption, '')) > 40
   order by published_at::date, left(lower(regexp_replace(caption, '\s+', ' ', 'g')), 60), (platform = 'instagram') desc
), t as (
  select 'social:' || to_char(published_at, 'YYYY') || '-Q' || to_char(published_at, 'Q') as fid,
         string_agg(to_char(published_at, 'YYYY-MM-DD') || ' (' || platform || ') ' || cap || coalesce(' [' || url || ']', ''), E'\n\n' order by published_at) as txt
    from p group by 1
)
insert into public.drive_text (file_id, text, chars, hash, method, extracted_at)
select fid, txt, length(txt), md5(txt), 'social_posts', now() from t
on conflict (file_id) do update set text = excluded.text, chars = excluded.chars, hash = excluded.hash, extracted_at = now();

-- the AI routes: text documents (Jev picks the cheapest model that will do each one well), PDFs (Claude reads the file itself)
insert into public.ai_routes (task, label, chain, jev, mode, max_tokens, notes, updated_at, updated_by)
values ('drive_mine', 'Drive mining: history, partners, lessons', array['openai/gpt-5-mini', 'anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5'], true, 'jev', 6000,
        'wave140: reads one document and records events, partners, lessons, resources and facts, each with a quote. Jev picks the model per document and checks every item afterwards.', now(), 'wave140'),
       ('drive_mine_pdf', 'Drive mining: PDFs', array['anthropic/claude-haiku-4.5', 'anthropic/claude-sonnet-5'], true, 'chain', 6000,
        'wave140: the same job for a PDF, which only Claude models read as a file (scans included).', now(), 'wave140')
on conflict (task) do update set label = excluded.label, chain = excluded.chain, jev = excluded.jev, mode = excluded.mode, max_tokens = excluded.max_tokens, notes = excluded.notes, updated_at = now(), updated_by = 'wave140';

-- the pump: while a run is on, three workers a minute (each works for up to two minutes, then stops)
select cron.schedule('wa-drive-mine-pump', '* * * * *',
  $c$select public.call_edge('drive-mine', '{"action":"work"}'::jsonb) from generate_series(1, 3) where (select status from public.drive_mine_state where id = 1) = 'mining'$c$);
