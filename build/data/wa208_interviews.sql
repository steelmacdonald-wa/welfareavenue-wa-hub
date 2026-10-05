-- wave208 (applied as migrations wa208_interviews and wa208b_interview_trigger, cron by hand: jobid 92)
-- interview transcripts linked to applications and reviewed against the JD and the MCC hiring framework
create table if not exists public.hub_candidate_interviews (
  id bigserial primary key,
  transcript_id bigint not null unique references public.transcripts(id) on delete cascade,
  candidate_id bigint references public.hub_candidates(id) on delete set null,
  status text not null default 'unmatched',      -- linked | unmatched | not_applicant
  match_how text,                                 -- auto | manual
  match_note text,
  suggestions jsonb,                              -- [{id, name, score, why}] when unmatched
  level text,                                     -- board | csuite | staff | chapter_president | chapter_vp | ambassador
  level_set boolean not null default false,       -- a person chose the level
  analysis jsonb,                                 -- strengths, weaknesses, insights, jd_fit, mcc, follow_ups, next_step
  analysis_status text,                           -- pending | running | done | failed
  analysis_error text,
  analysis_model text,
  analysed_at timestamptz,
  jd_read text,                                   -- google_doc | docx | pdf | no_jd | no_position | unreadable (...)
  linked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hub_candidate_interviews_cand on public.hub_candidate_interviews(candidate_id);
alter table public.hub_candidate_interviews enable row level security;
-- staff only, and only when the reader can read the transcript itself (its RLS: board only, leadership, speakers)
create policy hub_candidate_interviews_read on public.hub_candidate_interviews for select
  using (((select public.is_wa_staff()) or (select public.is_hub_admin())) and exists (select 1 from public.transcripts t where t.id = transcript_id));
grant select on public.hub_candidate_interviews to authenticated;
-- writes go through interview-review (service role)

-- the model route
insert into public.ai_routes (task, label, chain, jev, mode, max_tokens, notes)
values ('interview_review', 'Interviews: review against the JD and the MCC framework', array['anthropic/claude-sonnet-5', 'openai/gpt-5', 'anthropic/claude-sonnet-4.5'], false, 'chain', 6000, 'wave208: interview-review')
on conflict (task) do nothing;

-- a transcript titled "... Interview" is matched as soon as it lands (or is retitled)
create or replace function public.wa208_interview_scan() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if new.title ~* '\m(interview|interviews|entrevue|entretien)\M' and (tg_op = 'INSERT' or new.title is distinct from old.title) then
    perform public.call_edge('interview-review', jsonb_build_object('action', 'scan', 'transcript_id', new.id));
  end if;
  return new;
end $$;
create trigger trg_wa208_interview after insert or update of title on public.transcripts
  for each row execute function public.wa208_interview_scan();

-- every 30 minutes: anything missed, applicants added after their interview, reviews to retry
select cron.schedule('wa-interview-review', '7,37 * * * *', $$select public.call_edge('interview-review', '{"action":"scan"}'::jsonb)$$);
