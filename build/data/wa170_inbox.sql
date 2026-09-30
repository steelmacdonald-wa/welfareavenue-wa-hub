-- wa170_inbox (30/09/26): the inbox assistant (a person's own mailbox, sorted, sent on to a team and answered with them) and
-- info@ mail passed on to the right team or person with a one-line ask.
-- Steel (29/09/26): "review my steel.macdonald@welfareavenue.com emails as well and to start categorizing them in to my different
-- folders, sending them to the necessary teams, and helping me draft replies in a reply tool that asks me questions to clarify how
-- to respond to individuals the emailed me. It needs to use steel-voice and wa-writing to make sure replies sound like me. This is
-- a tool I'd like to roll out to others later" and "with info@welfareavenue.com we get a few emails there as well that needs to
-- forwarded to the correct groups and individuals with a brief note of an ask of what they should take action on."
-- His answers: the assistant labels by itself (every 15 minutes), the rest waits for him; replies are Gmail drafts he sends himself;
-- per person, owner only; personal mail is skipped; an email he sends to a team lands in the team's Hub inbox (and
-- their Slack channel); info@ mail goes out automatically through the Hub and Slack (a DM for a person, the channel for a team).

-- 0. who the signed-in person is, as a mailbox: their Welfare Avenue address, also when they signed in with an alias
--    (wa_email_aliases: Steel signs in with his gmail too)
create or replace function public.mybox_me()
 returns text
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select coalesce((select a.email from public.wa_email_aliases a
                    where public.wa_email() = any (select lower(x) from unnest(a.aliases) x) limit 1), public.wa_email())
$function$;
revoke all on function public.mybox_me() from public, anon;
grant execute on function public.mybox_me() to authenticated;
comment on function public.mybox_me() is 'wave170: the signed-in person''s own mailbox: their email, or the Welfare Avenue address an alias they signed in with belongs to (wa_email_aliases). The inbox assistant''s tables use it for "your own rows only".';

-- 1. whose mailbox the assistant works on (one row per person; writes through the mybox function only)
create table if not exists public.mybox_owners (
  email text primary key check (email = lower(email) and email like '%@welfareavenue.com'),
  name text,
  enabled boolean not null default false,
  auto_sort boolean not null default false,
  days_back int not null default 3 check (days_back between 1 and 14),
  archive_labels text[] not null default '{}',
  label_notes jsonb not null default '{}'::jsonb,
  skip_senders text[] not null default '{}',
  skip_words text[] not null default '{}',
  voice text,
  labels jsonb not null default '[]'::jsonb,
  labels_at timestamptz,
  last_sort_at timestamptz,
  last_result text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mybox_owners enable row level security;
drop policy if exists mybox_owners_own on public.mybox_owners;
create policy mybox_owners_own on public.mybox_owners for select to authenticated using (email = public.mybox_me());
revoke all on public.mybox_owners from anon;
grant select on public.mybox_owners to authenticated;
comment on table public.mybox_owners is 'wave170: the people whose own mailbox the inbox assistant works on (the mybox function, through the Hub''s Google delegation acting as them). Each person reads only their own row; every write goes through the mybox function. enabled: the assistant is on; auto_sort: it sorts new inbox mail into their labels every 15 minutes (cron wa-mybox-sort).';
comment on column public.mybox_owners.archive_labels is 'wave170: the labels whose mail also leaves the inbox when the assistant files it there (none by default: a label is only added).';
comment on column public.mybox_owners.label_notes is 'wave170: what goes in each label, in the owner''s words ({label id: note}); the sorting reads it.';
comment on column public.mybox_owners.skip_senders is 'wave170: senders or domains the assistant never reads (personal mail): it keeps nothing but the message id.';
comment on column public.mybox_owners.skip_words is 'wave170: words in a subject that make the assistant leave a message unread and unkept, like skip_senders.';
comment on column public.mybox_owners.voice is 'wave170: how the owner''s replies sound, given to the model that drafts them (Steel''s: his steel-voice and wa-writing guides, for Welfare Avenue mail).';
comment on column public.mybox_owners.labels is 'wave170: the owner''s own Gmail labels as last read: [{id, name, examples: [subjects of recent mail in it]}].';

-- 2. what the assistant did with each message (owner only; a skipped message keeps nothing but its id)
create table if not exists public.mybox_mail (
  id bigint generated always as identity primary key,
  owner text not null references public.mybox_owners(email) on delete cascade,
  gmail_id text not null,
  thread_id text,
  received_at timestamptz,
  skipped boolean not null default false,
  from_email text,
  from_name text,
  subject text,
  snippet text,
  label_id text,
  label_name text,
  label_conf numeric,
  labelled_at timestamptz,
  archived boolean not null default false,
  team text check (team is null or team in ('opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'finance', 'hr', 'board')),
  team_conf numeric,
  team_state text check (team_state is null or team_state in ('sent', 'dismissed')),
  sent_mail_id bigint references public.hub_mail(id) on delete set null,
  sent_at timestamptz,
  reply_p numeric,
  reply_state text check (reply_state is null or reply_state in ('drafted', 'done', 'dismissed')),
  draft_id text,
  drafted_at timestamptz,
  state text not null default 'sorted' check (state in ('sorted', 'skipped', 'error')),
  error text,
  created_at timestamptz not null default now(),
  unique (owner, gmail_id),
  check (not skipped or (from_email is null and from_name is null and subject is null and snippet is null and label_id is null and team is null))
);
create index if not exists mybox_mail_owner_received on public.mybox_mail (owner, received_at desc);
create index if not exists mybox_mail_sent_mail on public.mybox_mail (sent_mail_id);
alter table public.mybox_mail enable row level security;
drop policy if exists mybox_mail_own on public.mybox_mail;
create policy mybox_mail_own on public.mybox_mail for select to authenticated using (owner = public.mybox_me());
revoke all on public.mybox_mail from anon;
grant select on public.mybox_mail to authenticated;
comment on table public.mybox_mail is 'wave170: what the inbox assistant did with each message in its owner''s inbox: the label it added (and how sure it was), a team it could go to, whether it needs the owner''s reply, the Gmail draft saved from the reply tool, and the Hub inbox row when the owner sent it to a team. The owner reads only their own rows; personal mail is kept as its id alone (skipped). Written by the mybox function.';
comment on column public.mybox_mail.skipped is 'wave170: personal mail (the owner''s never-read list, a sensitive subject, or the model''s call): nothing is kept but the id, so it is never read again.';
comment on column public.mybox_mail.reply_p is 'wave170: how likely it needs the owner''s own reply (0 to 1).';
comment on column public.mybox_mail.sent_mail_id is 'wave170: the hub_mail row the owner created by sending this email to a team (mailbox person).';

-- 3. the Hub inbox: where an email came from, the ask, the person it is for
alter table public.hub_mail add column if not exists mailbox text check (mailbox is null or mailbox in ('hub', 'info', 'person'));
alter table public.hub_mail add column if not exists ask text;
alter table public.hub_mail add column if not exists assignee_email text;
alter table public.hub_mail add column if not exists forwarded_by text;
comment on column public.hub_mail.mailbox is 'wave170: where the email came in: hub (cc''d to hub@), info (sent to info@, which forwards to hub@: always passed on with an ask), person (sent to a team from someone''s inbox assistant).';
comment on column public.hub_mail.ask is 'wave170: the one line the team or person reads: what they should do about it (written by the model for info@ mail, by the sender for a forward).';
comment on column public.hub_mail.assignee_email is 'wave170: the person it is for (their Slack DM), with assignee their name.';
comment on column public.hub_mail.forwarded_by is 'wave170: who sent it to the team from their inbox assistant (their name).';

-- 4. the model routes: sorting (Jev decides) and the reply tool
insert into public.ai_routes (task, label, chain, jev, mode, max_tokens, notes, updated_at, updated_by)
values ('mybox_sort', 'Your inbox: sorting', array['anthropic/claude-haiku-4.5', 'openai/gpt-5-mini', 'google/gemini-3.8-flash'], true, 'chain', null,
        'wave170: the inbox assistant: Jev decides a person''s own mail: personal (left alone), which of their labels, a team it could go to, whether it needs their reply.', now(), 'wave170'),
       ('mybox_reply', 'Your inbox: replies', array['anthropic/claude-sonnet-5', 'openai/gpt-5', 'anthropic/claude-sonnet-4.5'], false, 'chain', null,
        'wave170: the reply tool: the questions before a draft, the reply in the person''s own voice (Steel: steel-voice and wa-writing), the one-line ask for a team. Sonnet first: writing that matters.', now(), 'wave170')
on conflict (task) do nothing;

-- 5. Steel's mailbox (on; the 15-minute sorting is switched on after a first run he can review). His voice (the drafting guide,
--    condensed from his steel-voice and wa-writing guides) is written straight to his row, which only he can read: it is personal
--    to him and is not kept in the repo or in this record.
insert into public.mybox_owners (email, name, enabled, auto_sort)
values ('steel.macdonald@welfareavenue.com', 'Steel', true, false)
on conflict (email) do nothing;

-- 6. the 15-minute sorting (runs only for owners who turned it on)
do $$ begin perform cron.unschedule(jobid) from cron.job where jobname = 'wa-mybox-sort'; exception when others then null; end $$;
select cron.schedule('wa-mybox-sort', '4,19,34,49 * * * *',
  $cron$select public.call_edge('mybox', '{"action":"sort"}'::jsonb) where exists (select 1 from public.mybox_owners where enabled and auto_sort)$cron$);
