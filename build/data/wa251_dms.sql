-- wave251 (15/10/26): Messenger and Instagram direct messages in the Content Studio's inbox.
-- Steel, 14/10/26 (the Meta additions): "Messenger and Instagram DMs in the Studio inbox — read and reply from the Hub, same
-- permissions model as comments (marketing team and admins reply; leads delete)."
--
-- What this migration does:
--   1. social_threads: one row per conversation with a person on Messenger or Instagram (the person, the last message, whether
--      we can still answer inside Meta's 24-hour window, open / resolved / archived, who it is assigned to).
--   2. social_messages: the messages of those conversations, ours and theirs.
--   Both are written only by social-inbox (dm_sync every 10 minutes with the comments, and at once when meta-events hears a
--   message) with the service key; the marketing team and admins read them (wa225_marketing / wa225_publisher), as comments.
--   Meta's API cannot delete a conversation: "delete" in the Hub archives it (leads and admins); a new message from the person
--   brings it back.

create table if not exists public.social_threads (
  id bigint generated always as identity primary key,
  platform text not null,
  external_id text not null,
  participant_id text,
  participant_name text,
  participant_handle text,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_from_us boolean not null default false,
  last_snippet text,
  message_count integer not null default 0,
  unread integer not null default 0,
  status text not null default 'open',
  assigned_to text,
  archived_at timestamptz,
  archived_by text,
  replied_at timestamptz,
  replied_by text,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_threads_platform_chk check (platform in ('facebook', 'instagram')),
  constraint social_threads_status_chk check (status in ('open', 'resolved', 'archived')),
  constraint social_threads_uniq unique (platform, external_id)
);
create index if not exists social_threads_last_idx on public.social_threads (last_message_at desc);
create index if not exists social_threads_participant_idx on public.social_threads (platform, participant_id);
comment on table public.social_threads is 'wave251: a Messenger or Instagram conversation between Welfare Avenue''s Page or Instagram account and one person (the Content Studio''s Messages). Written by social-inbox (dm_sync, dm_reply and the dm_* actions) with the service key; read by the marketing team and admins (wa225_marketing, wa225_publisher).';
comment on column public.social_threads.platform is 'wave251: facebook (Messenger) or instagram (Instagram Direct).';
comment on column public.social_threads.external_id is 'wave251: Meta''s conversation id (t_... for Messenger, an Instagram conversation id).';
comment on column public.social_threads.participant_id is 'wave251: the person''s page-scoped id (PSID on Messenger, IGSID on Instagram); the reply goes to it.';
comment on column public.social_threads.last_inbound_at is 'wave251: when the person last wrote. Meta lets a Page answer for 24 hours after that (standard messaging); the Hub says so and refuses after it.';
comment on column public.social_threads.last_from_us is 'wave251: true when the last message in the conversation is ours (answered).';
comment on column public.social_threads.last_snippet is 'wave251: the first 140 characters of the last message, for the list.';
comment on column public.social_threads.unread is 'wave251: messages from the person since our last reply (Messenger''s own unread count when Meta gives it).';
comment on column public.social_threads.status is 'wave251: open (waiting for us), resolved (answered or closed by hand), archived (a lead or admin took it out of the inbox; Meta cannot remove a conversation). A new message from the person reopens it.';
comment on column public.social_threads.assigned_to is 'wave251: the team member''s name the conversation is given to, as for comments.';

create table if not exists public.social_messages (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.social_threads(id),
  platform text not null,
  external_id text not null,
  from_us boolean not null default false,
  author_name text,
  text text,
  attachments jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  sent_by text,
  created_at timestamptz not null default now(),
  constraint social_messages_platform_chk check (platform in ('facebook', 'instagram')),
  constraint social_messages_uniq unique (platform, external_id)
);
create index if not exists social_messages_thread_idx on public.social_messages (thread_id, sent_at);
comment on table public.social_messages is 'wave251: the messages of a social_threads conversation, the person''s and ours (from_us), read through Meta''s Graph API (conversations, messages). Written by social-inbox with the service key; read by the marketing team and admins.';
comment on column public.social_messages.external_id is 'wave251: Meta''s message id (mid).';
comment on column public.social_messages.attachments is 'wave251: what came with the message: [{type, name, url}] (image, video, file, sticker, story mention, share). Meta''s links expire; the Hub opens them, it does not copy them.';
comment on column public.social_messages.sent_by is 'wave251: the Hub person who sent our reply from the Hub; null for messages from the person or sent from Meta''s own inbox.';

alter table public.social_threads enable row level security;
alter table public.social_messages enable row level security;
create policy social_threads_read on public.social_threads for select to authenticated using (public.wa225_marketing() or public.wa225_publisher());
create policy social_messages_read on public.social_messages for select to authenticated using (public.wa225_marketing() or public.wa225_publisher());
grant select on public.social_threads, public.social_messages to authenticated;
