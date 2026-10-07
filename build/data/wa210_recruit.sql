-- wave210 (06/10/26): the HR meeting's recruitment asks. "Still interested?" texts from the board, the offer letter when a card
-- reaches Offer, Slack when a card moves to Interview, Offer or Hired, and every CV read (any file type, scanned PDFs included).
-- The work is done by the edge function recruit-actions.
alter table public.hub_candidates add column if not exists interest_texted_at timestamptz;
alter table public.hub_candidates add column if not exists interest_link text;
alter table public.hub_candidates add column if not exists offer_sent_at timestamptz;
alter table public.hub_candidates add column if not exists offer_doc_id text;
alter table public.hub_candidates add column if not exists offer_doc_url text;
alter table public.hub_candidates add column if not exists offer_email_to text;
alter table public.hub_candidates add column if not exists cv_profile jsonb;        -- what the CV says: name, email, phone, city, languages, current role, experience, education, summary, skills
alter table public.hub_candidates add column if not exists cv_read_at timestamptz;
alter table public.hub_candidates add column if not exists cv_read_error text;

-- the CV's text, apart from the cards (the board reads every card's columns)
create table if not exists public.hub_candidate_cv (
  candidate_id bigint primary key references public.hub_candidates(id) on delete cascade,
  text text, how text, chars int, read_at timestamptz not null default now()
);
alter table public.hub_candidate_cv enable row level security;
create policy hub_candidate_cv_staff on public.hub_candidate_cv for select using ((select public.is_wa_staff()) or (select public.is_hub_admin()));
grant select on public.hub_candidate_cv to authenticated;

insert into public.ai_routes (task, label, chain, jev, mode, max_tokens, notes)
values ('cv_read', 'Applications: reading a CV', array['anthropic/claude-haiku-4.5', 'openai/gpt-5-mini', 'anthropic/claude-sonnet-5'], false, 'chain', 1500, 'wave210: recruit-actions')
on conflict (task) do nothing;

insert into public.app_config (key, value) values ('offer_folder', '1IKMWxdu8NvrN14cUmnRaPFyGGNNx4Gxa') on conflict (key) do nothing;   -- Recruitment > Offer Letters

-- a card moved to Interview, Offer or Hired (or closed after Interview) tells the HR channel and the person handling it
create or replace function public.wa210_stage_moved() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if new.status is distinct from old.status and (new.status in ('interview', 'offer', 'hired') or (old.status in ('interview', 'offer') and new.status in ('declined', 'withdrawn'))) then
    perform public.call_edge('recruit-actions', jsonb_build_object('action', 'stage_moved', 'id', new.id, 'old', old.status, 'new', new.status, 'by', new.updated_by));
  end if;
  return new;
end $$;
create trigger trg_wa210_stage after update of status on public.hub_candidates for each row execute function public.wa210_stage_moved();

-- every CV read, five a run, every 15 minutes
-- select cron.schedule('wa-cv-read', '9,24,39,54 * * * *', $$select public.call_edge('recruit-actions', '{"action":"cv_scan"}'::jsonb)$$);
